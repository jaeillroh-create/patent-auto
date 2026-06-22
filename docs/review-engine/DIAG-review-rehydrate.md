# DIAG — 검증 결과가 새로고침마다 초기화: review_runs 에 저장됐는데 로드 시 재수화 없음

> 브랜치: `review-engine/diag-review-rehydrate` · 코드 변경 0 (진단 문서만)
> 증상: patent(·opinion) 검증 결과 정상 표시 → **새로고침하면 사라지고 "출원 전 검증 시작"만**. DB(review_runs)엔 status=done·result(issues) 저장 확인. 매번 재검증($15·2분) 낭비.
> 결론 한 줄: **검증 결과(reviewState)는 review_runs.result 에 저장되지만 메모리(`__patentReviewState`/`Opinion.state.reviewState`)에만 들고 있고, 사건 로드(openProject/loadData)가 review_runs 를 전혀 조회하지 않는다 — 저장은 되는데 재수화 코드가 없다. patent·opinion 공통. 사건 로드 시 "최신 done review_runs.result → 메모리 reviewState 복원" 한 쿼리면 해결(승인 상태도 result 안에 함께 들어 있어 같이 복원됨).**

---

## 0. 저장 vs 로드 격차 (한눈에)

| | 저장(되는 곳) | 로드(안 읽는 곳) |
|---|---|---|
| **patent** | `review_runs.result`(Edge persist + `_persistReviewDecision` patent.js:14131) / 메모리 `window.__patentReviewState`(patent.js:14030) | `openProject`(patent.js:495)가 `current_state_json`(outputs)만 복원 — **review_runs 미조회, `__patentReviewState` 미복원** |
| **opinion** | `review_runs.result`(opinion.js:898) / 메모리 `Opinion.state.reviewState`(opinion.js:826) | `loadData`(opinion.js:4165) 5개 병렬 쿼리 — **review_runs 없음, `reviewState` 미복원** |
| review_runs SELECT 위치 | — | **오직 폴링(by run id)** patent:14112·opinion:966 뿐. 사건 로드 경로엔 0 |

→ **review_runs.result 에 결과가 있는데, 사건 로드가 그걸 읽는 코드가 아예 없다.** 새로고침 → 메모리 휘발 → 카드 사라짐.

---

## 1. 검증 결과 저장 위치 (file:line)

- **엔진 결과 → review_runs.result**: Edge dual-mode 가 비동기 완주 시 `persistRun(reviewRunId, {status:'done', result:payload})` (review-orchestrate). + 승인/거부 시 `_persistReviewDecision` 가 `review_runs.result = reviewState`(patchPlans[].accepted 포함) 로 덮어씀 (patent.js:14131 / opinion.js:898).
- **메모리**: `window.__patentReviewState = result`(patent.js:14030) / `Opinion.state.reviewState = result`(opinion.js:826). ★ 이게 화면 카드 발화 조건(patent renderPreview 훅 13857 `if (window.__patentReviewState)`, opinion renderOutput 마운트).
- **projects.current_state_json 엔 미포함**: patent saveProject 페이로드(outputs·title·usage…)에 `__patentReviewState` **없음** → 검증 결과는 projects 가 아니라 **review_runs 에만** 산다.

## 2. 페이지 로드 시 재수화 — 없음 (★ 핵심 격차)

### patent `openProject(pid)` (patent.js:495)
```js
currentProjectId = data.id;
const s = data.current_state_json || {}; outputs = s.outputs || {}; …   // outputs 등 복원
// ⛔ review_runs 조회 없음. window.__patentReviewState 설정 없음.
```
→ 로드 후 `__patentReviewState` = undefined → renderPreview 훅(13857)이 카드 안 띄움 → "출원 전 검증 시작"만.

### opinion `loadData(id)` (opinion.js:4165)
```js
Promise.all([
  opinion_issue_analyses, opinion_draft_claims, opinion_validation_results,
  opinion_opinion_drafts, opinion_type_determinations   // ⛔ review_runs 없음(5개뿐)
]);
// Opinion.state.reviewState 복원 코드 없음.
```
→ 동일하게 reviewState 휘발.

## 3. opinion·patent 공통인가 — ★ YES (동일 격차)

- 둘 다 결과를 `review_runs.result`(공유 테이블, `module` 컬럼 구분)에 저장하고 메모리에만 유지.
- 둘 다 사건 로드(openProject/loadData)가 review_runs 를 조회하지 않음.
- → **공통 해결**: 각 로드 함수에 동일 패턴(review_runs 최신 done 조회 → 메모리 reviewState 복원) 추가.

## 4. ★ 재수화 설계 (사건 로드 → review_runs 조회 → state 복원)

### 쿼리 (공통) — 인덱스·RLS 준비됨
`review_runs` 마이그레이션에 **인덱스 `(user_id, project_id, module, created_at DESC)`**(20260616_review_runs.sql:39)와 **RLS `review_runs_own`(본인 user_id)**(:68)이 이미 있음 → 아래 쿼리가 효율적·허용됨(폴링이 같은 테이블 이미 읽음).
```js
const rr = await App.sb.from('review_runs')
  .select('result')
  .eq('project_id', String(projectId))
  .eq('module', MODULE)            // 'patent' | 'opinion'
  .eq('status', 'done')            // 완주분만(진행 중 running 스킵)
  .order('created_at', { ascending: false })
  .limit(1).maybeSingle();
if (rr && rr.data && rr.data.result) { /* 메모리 복원 */ }
```

### 복원 + 발화
| 모듈 | 복원 | 발화(렌더) |
|---|---|---|
| patent | `window.__patentReviewState = rr.data.result` (openProject 의 current_state_json 복원 직후) | renderPreview 훅(13857)이 카드 "검증 결과 보기 (N건)" 표시 + `Patent.openReviewModal()` 가능 |
| opinion | `Opinion.state.reviewState = rr.data.result` (loadData 6번째 병렬 쿼리) | renderOutput 마운트(`_mountReviewResult`)가 "검증 결과 보기" 표시 |

### 승인 상태(accepted)도 함께 복원됨 (★ 한 쿼리로 충분)
- `_persistReviewDecision` 가 `review_runs.result = reviewState`(**patchPlans[].accepted 포함**)로 저장 → **result 재수화 = issues + 보정안 + 승인 상태 동시 복원**. 별도 작업 불필요.

## 5. review_amendments 재수화 포함? — 별도 불필요

- opinion 의 `review_amendments`(`amended_claims[].review_amendments[]`)는 **테이블이 아니라 opinion_draft_claims.draft_data 안의 필드** → loadData 가 이미 draft_data 로 재로드(opinion.js:4165 #2). **이미 영속·복원됨.**
- 승인 보정의 "반영 상태"(accepted)는 review_runs.result 에 있음(§4) → result 재수화로 복원.
- → **review_runs.result 재수화 하나면 검증결과+승인상태 복원. review_amendments(보정 방향)는 draft_data 로 이미 보존.** 추가 작업 0.

## 6. 수정 범위 (구현은 별도)

| # | 변경 | 위치 | LOC |
|---|---|---|---|
| 1 | openProject 에 review_runs 조회 + `__patentReviewState` 복원 | `patent.js:495`(current_state_json 복원 직후) | ~6 |
| 2 | loadData 에 review_runs 6번째 병렬 쿼리 + `Opinion.state.reviewState` 복원 | `opinion.js:4165` | ~6 |
| 3 | (확인) 로드 후 렌더가 복원된 reviewState 로 카드 표시 | patent renderPreview(13857)·opinion `_mountReviewResult` — **기존 훅 그대로 발화**(추가 0) | 0 |
- **kernel 0**(클라 로드 함수만). examiner .md·severity·Edge·DB 스키마 불변(인덱스·RLS 기존). `patent.js`·`opinion.js` `?v=` 갱신.
- 비용 효과: 새로고침 후 재검증($15·2분) 불필요 — 저장된 결과 즉시 표시.

---

## 7. ★ 핵심 질문 — 코드로 답
1. **DB(review_runs)에 있는데 왜 로드 시 안 읽나** → openProject(patent:495)·loadData(opinion:4165)가 **review_runs 를 조회하지 않음**. review_runs SELECT 는 폴링(by run id, patent:14112/opinion:966)에서만. 사건 로드 재수화 코드 **부재**.
2. **재수화 코드 없나** → 없음. `__patentReviewState`/`reviewState` 는 검증 실행(14030/826) 때만 설정, 로드 복원 0.
3. **opinion·patent 공통?** → YES, 동일 격차.
4. **review_amendments 도 재수화?** → review_runs.result 재수화로 승인상태(accepted) 복원. review_amendments(보정 방향)는 opinion_draft_claims.draft_data 로 **이미 영속·복원**(추가 0).

**요지: 검증 결과는 review_runs.result 에 정상 저장되나, 사건 로드(openProject/loadData)가 review_runs 를 조회하지 않아 메모리 reviewState 가 휘발한다(patent·opinion 공통). 로드 시 "최신 done review_runs.result → 메모리 복원" 한 쿼리(인덱스·RLS 기존)면 issues·보정안·승인상태가 한 번에 복원되고, 새로고침마다 재검증하던 낭비가 사라진다.**
