# DIAG/설계 — opinion review-engine 작업의 patent 이식 (1단계 설계, READ-ONLY)

> 브랜치: `review-engine/diag-patent-review-port` · 코드 변경 0 (설계 문서만)
> 목표: opinion 에서 한 review-engine 검증 작업을 patent 에 이식. **무엇이 이미 공유(0 작업)** 이고 **무엇이 patent 전용 작업**인지 file:line 매핑. ★ **504 위험 최우선**.
> 결론 한 줄: **엔진·스키마·에이전트·프롬프트(.md 6개)·Edge 비동기·#187 백스톱은 전부 이미 patent 를 커버한다. patent 전용으로 남은 핵심은 단 둘 — ① 클라 러너를 동기→비동기(reviewRunId+폴링)로 바꾸고 ② PatentProfile maxRounds 12→2 로 줄이는 것(둘 다 안 하면 504/타임아웃).**

---

## A. ★ 504 위험 (최우선) — 정확한 지점

### A-1. 두 개의 wall-clock
| 한계 | 무엇 | 초과 시 |
|---|---|---|
| **게이트웨이(동기 invoke)** | 클라가 `functions.invoke` 를 **블로킹**으로 기다림 | 응답이 ~150s 안에 안 오면 **504** |
| **워커(Edge background)** | 202 비동기라도 `waitUntil(bg)` 워커가 ~150s 안에 끝나야 persist | 초과 시 worker 사망 → review_runs 'running' 박제 → 클라 180s killer → "검증 시간 초과" |

→ **둘 다** 막아야 patent 검증이 "완주"한다. opinion 은 (비동기)+( maxRounds 2)로 둘 다 해결했다.

### A-2. patent 의 현재 상태 = 동기 + maxRounds 12 (504 확정)
**patent.js:14049 `Patent._defaultReviewRunner`:**
```js
var res = await App.sb.functions.invoke('review-orchestrate',
  { body: { snapshot, caseId, module:'patent', keys, assignments } });  // ★ reviewRunId 없음!
return (res && res.data) || null;
```
- **`reviewRunId` 미전송** → Edge dual-mode(review-orchestrate.ts:180-194)가 **동기 분기(line 194, 200 블로킹)** 로 감.
- **`PatentProfile.js:66` `terminationPolicy = { K:1, maxRounds:12, capUsd:15, … }`** → 최대 12라운드(라운드당 LLM 3~5인).
- ∴ **동기 블로킹 + 12라운드** = 게이트웨이 ~150s 확정 초과 → **504**. (그냥 토글 켜면 죽는 이유.)

### A-3. opinion 비동기 패턴 (이식 대상) — opinion.js:917-937
```js
// 1) review_runs INSERT(RLS own) → reviewRunId
var ins = await App.sb.from('review_runs')
  .insert({ user_id, project_id, module:'opinion', status:'running' }).select('id').single();
reviewRunId = ins.data.id;
Opinion.state.reviewRunId = reviewRunId;                 // AC-T1 결정 영속용
// 2) invoke WITH reviewRunId → Edge 202(비동기)
var res = await App.sb.functions.invoke('review-orchestrate',
  { body:{ snapshot, caseId, keys, assignments, reviewRunId } });
if (!reviewRunId) return d;                                // 동기 폴백(테이블 없음)
if (d && d.status !== 'running') return d;                 // 구 Edge 동기 결과
// 3) 폴링(180s killer)
return await Opinion._pollReviewRun(reviewRunId);          // opinion.js:942
```
- `_pollReviewRun`(942): `review_runs` 2s 폴링(`ReviewUI.subscribePolling`), done→result/failed→null, 180s killer + RLS `update status='failed'`(957).
- `_persistReviewDecision`(895): 승인/거부 시 `review_runs.result` patchPlans 상태만 빠른 UPDATE(풀 재검증 아님, AC-T1).

★ **Edge·DB 인프라는 이미 모듈 무관(공유)** — `review-orchestrate.ts:180-192` dual-mode·`persistRun`(72)·`review_runs`(module 컬럼)·`ReviewUI`. patent 가 **reviewRunId 만 보내면** 그대로 비동기로 돈다. → **patent 전용 작업은 "클라 러너 3줄 패턴 이식"뿐**.

### A-4. maxRounds — patent 도 축소 필요
- `OpinionProfile.js:81` `maxRounds:2`(주석 73: "Claude 단독 6역할 1키 worker wall-clock ~150s 안에 들도록 3→2 축소").
- patent 는 라운드당 에이전트 수 동급(examiner 3 + recheck 시 reviewer/expert)인데 **입력이 더 큼**(명세서 = 청구항 step_06/10/20 + 상세설명 step_08/12 + 도면/수학식 ≫ opinion 보정안). → 12라운드는 워커 wall-clock 확정 초과.
- ∴ **PatentProfile maxRounds 12 → 2**(opinion 동급)로 축소해야 비동기여도 **완주**. (안 하면 504는 아니지만 180s 타임아웃.)

---

## B. 공유(이미 됨) vs patent 전용(할 것)

### B-1. 이미 공유 — patent 도 커버됨 (0 작업)
| 항목 | 위치 | patent 커버 이유 |
|---|---|---|
| kernel·orchestrator·runAgent·Verdict/IssueList 스키마 | `review-engine/kernel`, `adapters` | 모듈 무관 엔진 |
| Edge dual-mode(202+폴링)·persistRun | `review-orchestrate.ts:180-192, 72` | reviewRunId 만 보내면 모듈 무관 동작 |
| **#187 resolveAgentProviders 백스톱** | `review-orchestrate.ts` | Edge, 모듈 무관 → **patent agents 도 1키→claude 백스톱 적용** ✅ |
| review_runs 테이블·ReviewUI(토글/모달/폴링) | DB·`window.ReviewUI` | module 컬럼으로 구분, UI 공용 |
| **patent 프롬프트 6종(.md)** | `.claude/rules/agents/patent/{examiner_A,B,C,attorney_author,attorney_reviewer,domain_expert}.md` | **이미 존재**(메모리의 "division .md 0개"는 division 한정 — patent 는 완비) |
| PATENT_AGENTS·PatentProfile(agents/writer/scoreWeights/amendmentOps/rippleRules) | `profiles/patent/*` | 완비. systemPromptRef 6개 .md 연결됨(agents/index.js:20-62) |
| 토글 게이트·applyAmendments·recheck 루프 | `patent.js:14008, 14081, 14040` | 이미 wired |

### B-2. patent 전용 — 할 것
| # | 작업 | 위치 | 비고 |
|---|---|---|---|
| **A1** | 클라 러너 비동기화 (review_runs INSERT + reviewRunId + 폴링) | `patent.js:14049` `_defaultReviewRunner` | opinion.js:917-937 이식. **504 직접 해소** |
| **A2** | maxRounds 12→2 | `PatentProfile.js:66` | 워커 wall-clock 완주(미축소 시 타임아웃) |
| **A3** | `_pollReviewRun` + `_persistReviewDecision` 이식 | `patent.js`(신규) | opinion.js:942/895 그대로 복제(모듈 무관, project_id 만 patent) |

### B-3. 공유 아님 — opinion 전용(patent N/A)
| 항목 | 왜 patent 무관 |
|---|---|
| **#190/#191 (opinion.js 오염·문체)** | opinion 의 **의견서 양식 업로드(sanitizeTemplate)** 기능. patent 는 양식 업로드 없음(명세서 자가작성) → **N/A** |
| **#186 (opinion_projects.status)** | opinion 테이블. patent 는 `projects` 테이블·별도 status → N/A |
| opinion maxRounds=2 값 | patent 는 자기 값(12→2) 별도 |

---

## C. ★ patent 검증 대상 — 의견서와의 차이 (명확화)
| | opinion(의견서) | patent(명세서 작성) |
|---|---|---|
| 시점 | **출원 후** 거절이유통지(OA) 대응 | **출원 전** 자가 명세서 |
| 검증 대상 | 보정안 + 의견서(거절이유 방어) | 작성 중 **명세서 자체**(청구항 step_06/10/20 + 상세설명 step_08/12 + 도면/수학식) |
| 목적 | 이미 거절된 것 방어 | 출원 전 **거절이유 사전 차단** |
| 에이전트 초점(.md) | OA 조문 대응 | examiner_A §29·B §42·C §45/§42③·domain_expert 기술정확성 (출원 전 명세서 대상) |
| patchPlan 의미 | 보정안 반영 | 명세서/청구항 보정 반영(`Patent.applyAmendments` 14081) |

→ **검증 대상은 다르지만(보정안 vs 작성 명세서), 엔진·스키마·에이전트는 patent .md 로 이미 분리 완비.** 이식은 "대상"이 아니라 "**호출 경로(동기→비동기)+라운드 수**"만 손대면 된다.

---

## D. D2(자동 반영) — patent 엔? ★ 사용자 확정 대상
- patent 는 **이미** 핵심 루프 보유: `Patent.applyAmendments`(14081, 실정의) + `_reviewModalOpts.onChange`(14040)에서 **승인 patchPlan → applyAmendments → recheck 재트리거**. → "승인→반영→재검증" D2-등가가 **이미 wired**.
- opinion 의 **풍부한 D2**(D2a/D2c — 보정 "방향" splice 재작성 게이트 UI)는 *보정안* 개념에 특화. patent 는 명세서 자가작성이라 "방향" 개념이 다름.
- **★ 확정 필요(택1):**
  - (가) **이번 이식 = 검증만**(A1+A2+A3). 반영은 기존 `applyAmendments`+recheck 재사용으로 충분 — **권장**(504 먼저, 최소 변경).
  - (나) opinion 의 direction-gate D2 UI 까지 이식(범위 큼, patent 구조와 매핑 재설계 필요).

---

## E. ★ Task 분할 (504 먼저)

| Task | 내용 | file:line | 의존 | 위험 |
|---|---|---|---|---|
| **T1 (BLOCKER·504)** | 클라 러너 비동기화 + maxRounds 축소 + 폴링/결정영속 이식 | `patent.js:14049`(A1), `PatentProfile.js:66`(A2), `patent.js` 신규(A3) | 없음 | 🟠 |
| **T2 (D2 결정 후)** | (가)면 0 작업(applyAmendments 재사용 확인 테스트만) / (나)면 direction-gate 이식 | `patent.js:14040/14081` | T1 + 사용자확정 | (나)면 🔴 |
| **T3 (선택·완주 강화)** | 명세서 입력이 크면 Edge adaptSnapshot 입력 truncation·라운드별 비용 가드 | `PatentProfile.adaptSnapshot` / `_reviewCostEstimate`(13963) | T1 | 🟡 |

**권장 실행:** **T1 단독 먼저**(504 해소 = 검증이 돌게 됨) → 변리사 실물로 검증 품질 확인 → D2(나) 필요성 판단 → T3.

---

## F. ★ 핵심 질문 — 코드로 답
1. **patent 504 정확한 지점** → `patent.js:14053` 동기 invoke(reviewRunId 미전송→Edge 동기분기 194) + `PatentProfile.js:66` maxRounds 12. 동기+12라운드 = 게이트웨이 ~150s 초과.
2. **opinion async 이식법** → review_runs INSERT(module:'patent')→reviewRunId→invoke 동봉→`_pollReviewRun`. Edge dual-mode(180-192)·persistRun 이미 모듈 무관이라 **클라만** 고치면 됨.
3. **공유 vs 전용** → 엔진/스키마/Edge/#187/프롬프트(.md 6)/PatentProfile/applyAmendments = **공유·완비**. #190/#191/#186 = opinion 전용 N/A. 전용 작업 = A1 러너 + A2 maxRounds + A3 폴링.
4. **patent .md 프롬프트** → **6개 전부 존재**(`.claude/rules/agents/patent/*.md`). 작성 불필요.
5. **D2 필요?** → 기본(승인→applyAmendments→recheck)은 **이미 있음**(14040/14081). opinion 의 direction-gate D2 추가 이식 여부만 **사용자 확정**(권장: 이번엔 검증만).

**요지: patent 검증은 "엔진이 없어서"가 아니라 "동기 호출 + 12라운드"라서 504. T1(비동기화 + maxRounds 2)만 하면 살아난다. 프롬프트·엔진·#187·applyAmendments 는 이미 patent 를 커버한다. D2 풍부화는 별도 확정.**
