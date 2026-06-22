# DIAG/설계 — patent 검증 D2: 승인 보정 → 실제 명세서 반영 → 수정본 다운로드

> 브랜치: `review-engine/diag-patent-d2-design` · 코드 변경 0 (설계 문서만)
> 사용자 요구: 검증 → 반영여부 결정 → 반영하면 수정방향대로 명세서 수정 → 수정본 다운로드.
> 결론 한 줄: **현재 patent applyAmendments 는 승인 "방향"을 `outputs._review_applied` 에 로그로만 기록하고 산문(step_06/08)은 안 고친다(T6 의도). 실제 반영 = opinion D2 splice 패턴을 patent 에 이식 — 승인 방향을 ★대상 섹션만★ LLM 재작성해 `pending` outputs 에 splice → 비교모달 → [확정] → outputs 커밋. patent 명세서가 outputs.step_* 이고 다운로드가 그걸 serialize 하므로 outputs 만 고치면 다운로드는 자동 반영(T3 추가 0). 단 patent 주력 op 는 add_spec_support(상세설명 단락 추가)로 opinion(청구항 문언 교체)과 달라 그 부분만 patent 전용.**

---

## 1. 현재 "미반영(T6)" 이유 + 실제 반영 경로

### 현재 (patent.js:14168 `applyAmendments`)
```js
// 승인 방향을 구조적으로 기록(작업 로그 — 산문 미수정).
log.push({ op, target, direction: op.content, reason, planId, approvedBy });
…
outputs._review_applied = log;          // ★ 방향 로그만 저장. step_06/08 텍스트는 불변.
```
- 주석: **"★ 산문(청구항/상세설명) 텍스트는 재작성하지 않는다(op.content=보정 '방향')"**. 검증엔진은 "완성 문언"이 아니라 "방향"만 산출(attorney_author 계약). 그래서 명세서 미수정 = **T6(작성모듈 미연동)**.
- 결과: 다운로드(outputs serialize, patent.js:5870-5890)는 **원본 명세서** 그대로 → "반영 안 됨" 체감.

### 실제 반영하려면
`outputs._review_applied`(승인 방향) → **LLM 으로 대상 섹션을 재작성** → `outputs.step_06/08/...` 교체 → 다운로드 자동 반영. opinion D2 가 청구항에 대해 이미 하는 일(splice 재작성)을 patent 명세서에 적용.

---

## 2. patent 보정 plan 성격 (op → 수정 대상)

`PatentProfile.amendmentOps`:
| op | 의미 | 수정 대상(outputs) | opinion 대비 |
|---|---|---|---|
| **`add_spec_support`** ★주력 | 상세설명 뒷받침 보강(§42④ 앵커 1차 관문 — DB high×2가 이것) | **step_08/12 상세설명에 단락 추가** | ★ opinion 없음(patent 전용) |
| `add_limitation` | 한정 부가(진보성) | step_06/10 대상 청구항 | opinion 청구항 보정과 유사 |
| `narrow_scope` | 범위 축소(과광범) | step_06/10 대상 청구항 | 유사 |
| `fix_ref_sign` | 도면부호 정정(E-11) | step_18 부호의 설명 | patent 전용 |
| `fix_term` | 용어 정정(명확성) | step_08 등 | 유사 |

- op = `{ op, target('claim_N'|'spec'), content(보정 "방향"), reason }`. **content 는 방향이지 완성 문언이 아님** → LLM 재작성 필요(opinion 과 동일).
- ★ **핵심 차이**: opinion D2 = 청구항 문언 교체. patent 주력(add_spec_support) = **상세설명에 뒷받침 단락 ADD**(교체 아님). 이게 patent 전용 설계 포인트.

---

## 3. 명세서 구조 (수정 대상) + 다운로드 (자동 반영)

- **명세서 = `outputs.step_*`**(전역): step_06/10(청구항)·step_08/12(상세설명)·step_18(부호)·step_19(요약). TEXT BLOB. `current_state_json` 으로 영속(saveProject).
- **수정**: `outputs.step_08 = …` 교체 → `renderOutput('step_08', …)` 재렌더 → saveProject 영속.
- **다운로드(patent.js:5870-5890)**: `secs` 를 `desc`(=step_08)·`claim`(=step_06)·techField 등으로 구성 → Word(.doc) blob. → **outputs 수정 시 다운로드 자동 반영**(별도 작업 0).
- ★ 즉 **outputs.step_* 만 고치면 화면(renderOutput)·다운로드(Word) 둘 다 자동 반영.**

---

## 4. opinion D2 재사용 vs patent 전용

### opinion D2a `applyDirectionRewrite`(opinion.js:532) — 참고 패턴
1. `_collectApprovedDirections`(승인 방향만) → 2. `structuredClone(draftResult)` = `pending`(원본 불변) → 3. **★대상 청구항만 LLM 재작성**(비대상은 클론 그대로 byte-identical) → 4. `_gatePendingRewrite`(검증 게이트) → 5. `state._pendingRewrite`(보류, 자동적용 금지) → D2c 비교모달 → [확정] `confirmRewrite`(commit→draftResult→DB).

### 매핑
| 요소 | opinion | patent (이식) |
|---|---|---|
| 승인 방향 입력 | review_amendments | **`outputs._review_applied`**(applyAmendments 가 이미 채움) |
| 원본 불변 splice | structuredClone(draftResult) | **structuredClone({step_06,08,10,12,18})** 대상 섹션만 |
| 대상만 재작성 | 청구항 1건씩 LLM | **add_spec_support: 단락 생성 후 step_08 APPEND / claim ops: step_06 대상 제N항 splice** |
| 보류 | `state._pendingRewrite` | `state._pendingPatentRewrite`(신규) |
| 게이트 | `_gatePendingRewrite`(비대상 변경 차단 등) | **E-11 render check(`Patent._reviewRenderCheck` 이미 있음, 14156) + 비대상 byte-identical 검사** |
| 비교모달 | D2c before/after | 동형(변경 섹션 before/after) |
| 확정 커밋 | `confirmRewrite`→draftResult→DB | `confirmPatentRewrite`→outputs→saveProject |
| 다운로드 반영 | 보정서가 ac.amended 자동 렌더 | **Word(outputs serialize) 자동 반영(0)** |

### 재사용(실코드) vs patent 전용
- **재사용(실)**: `Patent._reviewRenderCheck`(E-11), LLM 호출(App.callClaude), `renderOutput`/saveProject/다운로드(기존), structuredClone splice **기법**.
- **재사용(패턴)**: pending+gate+비교모달+confirm 구조(코드는 네임스페이스 분리 — Patent 전용 함수로 재구현).
- **patent 전용(신규)**: ① **add_spec_support = 상세설명 단락 ADD**(opinion 없음 — 생성+삽입), ② **text blob 다중 섹션 splice**(step_06 청구항 파싱 splice + step_08 단락), ③ **§47 없음**(출원 전 — 최초 명세서 작성 중이라 신규사항 제약 없음; 안전은 기술 일관성+E-11+비대상 불변으로).

---

## 5. ★ patent D2 설계 (승인 → 명세서 수정 → 다운로드)

```
[흐름]
검증 결과(모달) → 보정 N건 승인(applyAmendments 가 _review_applied 에 방향 기록, #195 AC-T1: 자동 재검증 0)
  → [명세서에 반영] 버튼 (신규, 명시적)
     → Patent.applyDirectionRewrite():
        · pending = structuredClone(대상 섹션)  (outputs 불변)
        · op별 splice(대상만 LLM):
           - add_spec_support@claim_N → 뒷받침 단락 생성(target 구성+기존 step_08 컨텍스트) → pending.step_08 APPEND(기존 텍스트 byte-identical)
           - add_limitation/narrow_scope@claim_N → step_06 파싱→대상 제N항만 재작성→재직렬화
        · E-11 render check(pending) — 불일치 시 롤백
        · state._pendingPatentRewrite = {pending, before/after, gates}  (보류)
  → 비교 모달: 변경 섹션 before/after + 게이트(canConfirm) 표시
     → [확정] Patent.confirmPatentRewrite():
        · outputs.step_06/08/... = pending.*  (커밋)
        · _review_applied 마킹(applied) + renderOutput 재렌더 + saveProject
  → F.산출물 "수정본 다운로드"(기존 Word) — outputs 반영본 자동 serialize
```

---

## 6. Task 분할 (반영 엔진 → 비교/확정 → 다운로드)

| Task | 내용 | 핵심 | 위험 |
|---|---|---|---|
| **T1 반영 엔진** | `Patent.applyDirectionRewrite` — `_review_applied` 읽기 → op별 splice(add_spec_support 단락 APPEND / claim splice) → pending(섹션 클론) → E-11 gate → `_pendingPatentRewrite` | 대상만 LLM(비대상 불변) | 🟠 (add_spec_support 신규 + blob splice) |
| **T2 비교/확정** | 비교 모달(변경 섹션 before/after, canConfirm) + `Patent.confirmPatentRewrite`(outputs 커밋 + renderOutput + saveProject) | 변리사 [확정] 전 자동적용 금지 | 🟡 |
| **T3 다운로드 연결** | 기존 Word 다운로드(outputs serialize) 그대로 — **검증만**(outputs 반영본이 desc/claim 으로 들어가는지) | 0 작업 예상 | 🟢 |

**권장**: T1(add_spec_support 단락 APPEND 우선 — DB high×2가 §42④ 뒷받침) → T2(비교/확정) → T3(검증). claim ops(add_limitation/narrow_scope)는 T1 2차(파싱 splice 복잡).

---

## 7. ★ 안전장치 (opinion 교훈 — 명세서 직접 수정이라 중요)

| 안전장치 | 방법 | opinion 교훈 |
|---|---|---|
| **비대상 drift 차단** | LLM 에 **대상 섹션/청구항만** 전달, 비대상은 structuredClone 그대로(byte-identical). add_spec_support 는 **APPEND**(기존 step_08 전체 불변). | ★ "splice 로 drift 구조적 불가" |
| **자동적용 금지** | `_pendingPatentRewrite` 보류 → 변리사 [확정](confirmPatentRewrite)에서만 커밋 | ★ "승인이 자동 재작성 안 함(명시 버튼)" |
| **도면 정합** | E-11 `Patent._reviewRenderCheck`(부호 ⊆ 부호의설명) — pending 에 적용, 불일치 시 롤백 | applyAmendments 에 이미 있음 |
| **기술 일관성** | 추가 단락이 기존 발명/청구항과 정합(LLM 프롬프트 + 변리사 비교모달 확인) | — |
| **원자성** | 커밋-앳-엔드: pending 전체 통과 시에만 outputs 교체(부분 반영 금지) | applyAmendments 패턴 |
| ⚠️ **§47 비적용** | patent 는 출원 전(최초 명세서 작성 중) → 신규사항 §47 제약 없음. opinion(보정)의 "최초 명세서 범위 내" 게이트는 **patent 에 불필요**(대신 기술 일관성). | ★ opinion 과 다른 점 |

---

## 8. ★ 핵심 질문 — 코드로 답
1. **승인 보정을 명세서에 실제 반영하는 법** → `_review_applied`(승인 방향) → LLM 대상 섹션 재작성 → outputs.step_* splice. add_spec_support 는 step_08 에 뒷받침 단락 APPEND.
2. **opinion splice 재사용?** → 패턴(pending+gate+비교+confirm)·기법(structuredClone splice)·E-11(`_reviewRenderCheck`)·LLM·다운로드 **재사용**. add_spec_support(상세설명 ADD)·blob 다중섹션 splice·§47 비적용은 **patent 전용**.
3. **명세서 수정 → 기존 다운로드 자동 반영?** → ★ **YES.** 다운로드(5890)가 outputs serialize → outputs.step_* 커밋만 하면 Word 자동 반영(T3 0).
4. **비교 모달 필요?** → ★ YES(변리사 확정 전 before/after). opinion D2c 동형. 명세서 직접 수정이라 더 중요.
5. **patent plan 에 수정 위치·내용 충분?** → op.target(claim_N/spec)+op.content(방향)+reason 있음. 단 **완성 문언은 없음** → LLM 재작성 필수(opinion 과 동일). add_spec_support 는 target 구성을 step_08 컨텍스트로 LLM 이 뒷받침 단락 생성.

**요지: patent 명세서는 outputs.step_* 이고 다운로드가 그걸 serialize 하므로, 승인 방향(`_review_applied`)을 opinion D2 splice 로 대상 섹션만 재작성해 outputs 에 커밋하면 화면·다운로드가 자동 반영된다. 재사용은 pending/gate/비교/confirm 패턴 + E-11 + LLM + 다운로드. patent 전용은 add_spec_support(상세설명 단락 ADD) + blob splice + §47 비적용. 안전은 'splice 대상만+APPEND+보류+변리사 확정'으로 opinion 교훈 그대로.**
