# 설계 — D2: 승인 보정방향 자동 문언화 (LLM 청구항 재작성) · 1단계 설계만

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-d2-autorewrite` · **READ-ONLY, 코드 수정 0**
> 전제: D1(#173, 승인 방향 권고 렌더 — read만) 머지됨. D2 = 그 방향을 **청구항 문언에 자동 반영**.
> ★ LLM 재작성이라 신중 — 특히 §2(범위제어)·§3(부수효과 방어)가 핵심. **자동적용보다 변리사 확인 권장.**

---

## 0. 핵심 결론 (먼저)

1. **옵션 A(revNote 채널)는 "전체 재작성"이다 — 범위제어 위험.** `startDraft`(opinion.js:2670)는 거절된 **모든** 독립항의 `amended_claims` 를 매번 새로 생성한다(targetClaimsCtx 2705). revNote(2683)는 "추가 지시"로 들어갈 뿐이라, claim_5 방향을 주입해도 LLM이 claim_1·2도 **재서술(drift)** 할 수 있다. 기존 보존 게이트(`_validateClaimPreservation` 2808)는 **미거절 청구항만** 보호하므로 "다른 거절 청구항의 drift"는 못 잡는다.
2. **권장: 옵션 B(외과적 splice).** 현재 `draftResult.amended_claims` 에서 **대상 청구항만** LLM으로 재작성하고 **나머지는 기존 문언을 그대로 복사(byte-identical)**. → "claim_5만, 나머지 보존"이 **프롬프트가 아니라 구조로 보장**된다(drift 불가능). 비용·시간도 1개 청구항이라 작다.
3. **D3 게이트는 대부분 이미 있다.** `_validateSpecBasis`(2798)·`_validateClaimReferences`(2838)·`_validateClaimPreservation`(2808)를 재작성 결과에 재실행 + "비대상 청구항 불변" diff 단언만 추가하면 부수효과 방어 완성.
4. **자동적용 금지 → 변리사 확인 후 확정.** LLM 재작성은 틀릴 수 있으므로 "보정 전/후" diff 검토 후 변리사가 **확정 버튼**으로 적용. 승인(AC-T1 빠른 영속)과 분리된 **별도 명시 액션**.
5. **kernel 0.** 전부 opinion.js 작성부(client). review-engine/kernel 미접촉.

---

## 1. revNote 주입 + 재작성 경로 (file:line)

### 현행 revNote 채널
- `Opinion.state.lastRevisionNote` — init opinion.js:190, **게이트 수정 시 주입** 2619(`Opinion.state.lastRevisionNote = note; → startDraft()` 2620), **startDraft 소비** 2682-2684:
  ```js
  var revNote = Opinion.state.lastRevisionNote || '';
  var revCtx = revNote ? '\n\n[사용자 수정 지시]\n'+revNote+'\n이 지시를 반드시 반영하여 작성하세요.\n' : '';
  Opinion.state.lastRevisionNote = ''; // 사용 후 초기화
  ```
- `revCtx` 는 draft 프롬프트(2708 inventive_step 등)에 문자열로 합쳐져 LLM에 전달된다. **즉 "자유 텍스트 추가 지시" 채널**이다.

### 옵션 A (정찰이 제안한 경로) — revNote에 승인 방향 주입
- `_collectApprovedDirections(state.draftResult)`(507) → `[{claim_no, directions[]}]` 를 포맷:
  ```
  [AI 검증 승인 보정 반영 지시]
  · 청구항 5: {direction} (명세서 기재 범위 내에서만, 신규사항 금지)
  ```
  을 `lastRevisionNote` 에 넣고 `startDraft()` 재실행.
- **장점**: 기존 파이프라인 + 게이트(§3) 전부 자동 재사용. 구현 작음.
- **단점(치명)**: §2 — **전체 재작성**이라 비대상 청구항 drift. + draftResult 덮어쓰기(2852-2853)로 **인메모리 review_amendments 소실**(D1 권고 입력 사라짐).

### 옵션 B (권장) — 외과적 splice (신규 소함수)
- `Opinion.applyDirectionRewrite(claimNos, directions)`(신규, ~60 LOC 예상):
  1. `cur = structuredClone(state.draftResult)`.
  2. 대상 청구항만 LLM 재작성: 프롬프트에 **그 청구항의 현재 amended 문언 + 승인 방향 + 명세서 단락** 만 주고 `{claim_no, amended, spec_basis, amendment_methods}` 1건(또는 N건) 반환.
  3. `cur.amended_claims` 에서 대상 `claim_no` 만 교체, **나머지는 그대로**(복사). → drift 구조적 불가.
  4. 게이트 재실행(§3) → 통과 시 **새 draftResult 후보**로 보류(자동커밋 X, §5 변리사 확정).
- **장점**: 범위제어가 구조로 보장, 비용↓, review_amendments 보존(splice라 유지). **단점**: 신규 코드 경로 + 게이트 수동 재호출.

> ★ 어느 옵션이든 LLM 호출은 **client-side**(`callForJSON`→`App.callClaude`, common.js 180s/콜)다. **edge wall-clock(~150s)과 무관**(§6).

---

## 2. ★ 재작성 범위 제어 (핵심 위험)

| | 옵션 A (revNote 전체 재작성) | 옵션 B (splice 외과적) |
|---|---|---|
| 대상만 변경? | ❌ 보장 못 함(LLM이 전 청구항 재생성) | ✅ **구조 보장**(비대상은 복사) |
| 비대상 거절 청구항 drift | 위험(게이트 못 잡음) | 불가능 |
| 보장 수단 | 프롬프트 "대상만 고치고 나머지 원문 유지" + diff 게이트로 사후 탐지·복원 | splice(코드)로 사전 차단 |

- `startDraft` 는 `rejectedIndependentNos`(2697-2704) 전부를 `amended_claims` 로 재생성(2705 targetClaimsCtx, 2746 출력 스키마). **부분 재작성 모드가 없다.**
- 옵션 A로 가려면: ① 프롬프트에 "**[보정 대상] 청구항 N만 수정**, 그 외 청구항은 직전 draftResult의 amended 문언을 **한 글자도 바꾸지 말고 그대로 출력**" 강제 + ② **diff 게이트**(아래 §3-신규)로 비대상 청구항이 직전과 다르면 **drift 경고/자동 원복**. 프롬프트는 약속일 뿐이라 ②가 필수.
- 옵션 B는 ②가 필요 없다(애초에 비대상을 LLM에 안 보냄). **그래서 권장.**

---

## 3. ★ D3 검증 게이트 (부수효과 방어, 필수)

### 이미 존재(startDraft 내) — 재작성 결과에 재실행하면 됨
| 게이트 | 위치 | 역할 | D2 적용 |
|---|---|---|---|
| `_validateSpecBasis` | 2798 / 정의 226 | 재작성 spec_basis 단락이 명세서에 실재하는지(할루시네이션) | 재작성 청구항에 재실행 |
| `_validateClaimPreservation` | 2808 / 정의 273 | **미거절** 청구항 변경/누락 감지 | 그대로 유효 |
| `_validateClaimReferences` | 2838 / 정의 313 | 보정 후 인용관계 적법 | 전체 spliced 집합에 재실행 |
| 4중 뒷받침 검증 | startValidation 2879 / dr.validation 2847 | term/context/combination/cited_ref 뒷받침 | 재작성 후 재실행 권장 |

### ★ 신규 필요 — "대상만 반영, 나머지 보존" 단언 (옵션 A엔 필수, B엔 확인용)
- **비대상 청구항 불변 diff**: `재작성본.amended_claims[n].amended === 직전.amended_claims[n].amended` (대상 claim_no 제외 전부). 다르면 drift → 경고/원복.
  - 옵션 B: splice라 **항상 참**(단언만). 옵션 A: LLM drift 탐지의 **핵심 방어선**.
- **대상 청구항 방향 반영 확인(선택)**: 재작성 결과가 승인 방향의 핵심 구성을 포함하는지(약한 키워드 체크 또는 LLM 자기검증). 과신 금지(보조 지표).

> 결론: D3는 **기존 3게이트 재실행 + 비대상-불변 diff 1종 추가**면 충분. 옵션 B면 diff는 자명 단언.

---

## 4. 보정서 반영 + D1과의 관계

- 보정서 빌더 `_buildAmendmentDocxHtml`: **가.보정전**(3657, `ac.original`) → **나.보정후**(`ac.amended`) → **다.보정사유**(+ D1 권고 블록 3685). **나.보정후는 `ac.amended` 를 그대로 렌더**하므로, D2가 `ac.amended` 를 재작성하면 **보정서에 자동 반영**된다(별도 작업 0).
- **D1 ↔ D2 관계(공존)**:
  - D1(다.보정사유의 "[AI 검증 보정 권고]")은 **방향(텍스트)** 을 권고로 보여줌(read).
  - D2는 그 방향을 **나.보정후 문언에 반영**(write).
  - D2 적용 후엔 방향이 이미 문언에 녹아 있으므로 D1 권고 블록은 **확인용(중복)** 이 된다. → **옵션**: D2 적용된 청구항은 D1 권고를 "(반영됨)" 라벨로 표기하거나 숨김. 미적용 청구항은 D1 권고 유지. **공존하되 상태 표시로 구분**(대체 아님).
- 의견서: `getContext('draft')`(2650)가 승인 방향을 컨텍스트로 첨부(D1). D2 적용 후 `ac.amended` 가 갱신되면 의견서도 갱신된 문언을 인용 → 자동 정합.

---

## 5. ★ 비교 검토 UI (자동 vs 변리사 확인)

- **현황: opinion에 보정 전/후 청구항 diff UI 없음.** (`ac.original`·`ac.amended` 데이터는 있음 — division의 `_lcs` 류는 opinion 미적용.) → **신규 UI 필요.**
- **권장: 변리사 확인 후 적용(자동적용 금지).** 근거:
  - LLM 재작성은 신규사항·과축소·문맥오류 가능 → 사람 최종 책임(특허 실무).
  - 흐름: `applyDirectionRewrite` → **후보 draftResult 보류**(state에 `_pendingRewrite`) → **diff 모달**("보정 전 → 후", 대상 청구항 강조 + 게이트 결과 ✅/⚠️) → 변리사 **[확정]**(state.draftResult 커밋 + opinion_draft_claims insert) / **[취소]**(폐기).
  - diff 렌더: `ac.original`(또는 직전 amended) vs 재작성 amended 를 LCS/단어 강조. division의 diff 패턴 참조(코드 공유 X, 패턴만).
- **자동적용은 비권장**(되돌리기 어려운 문언 변경 + LLM 오류 위험). 굳이 하려면 게이트 전원 pass + 비대상 불변 단언 통과 시에만, 그래도 "되돌리기" 제공.

---

## 6. wall-clock / 비용 (호출 시점)

- **재작성 = client-side LLM 호출**(`callForJSON`→`App.callClaude`). **edge wall-clock(~150s) 무관** — 검증 엔진(edge)과 별개. 콜당 common.js 180s 타임아웃.
- **호출 시점(AC-T1 보존)**: 승인 onChange(605)는 **빠른 영속만**(608, 자동 재검증 제거). D2 재작성을 **승인에 자동 트리거하면 AC-T1 위반**(승인이 느려짐). → **별도 명시 액션**(버튼 "승인 방향 반영하여 재작성")으로 분리. 승인은 그대로 빠르게, 재작성은 변리사가 원할 때.
- 비용: 옵션 B(대상 1~소수 청구항)가 옵션 A(전체 재드래프트)보다 입력·출력 토큰 작음 → 저렴·빠름.

---

## 7. ★ Task 분할 (권장)

LLM 재작성 위험이 커서 **한 번에 하지 말고 분할**:

| Task | 범위 | 의존 | 위험 | 핵심 수용 기준 |
|---|---|---|---|---|
| **D2a** 재작성 엔진(옵션 B splice) | `applyDirectionRewrite(claimNos,directions)` — 대상만 LLM 재작성 + 나머지 복사, 후보 보류 | D1 | 🟠 | 비대상 청구항 byte-identical(테스트), 대상만 변경 |
| **D2b** D3 게이트 배선 | 기존 3게이트 재실행 + **비대상 불변 diff 단언** | D2a | 🟡 | spec_basis/preservation/references 재실행, drift 탐지 |
| **D2c** 비교 UI + 확정 | 보정 전/후 diff 모달 + [확정]/[취소], 자동적용 금지 | D2a,D2b | 🟢 | 변리사 확정 전 미커밋, 게이트 결과 표시 |
| **D2d** D1 공존 표시 | D2 적용 청구항은 권고 "(반영됨)" 라벨 | D2c | 🟢 | 보정서/화면에서 D1↔D2 구분 |

- **세션 분할**: D2a(엔진) → D2b(게이트) → D2c(UI) → D2d(표시). D2a+D2b가 안전 핵심, D2c가 사람 방어선.
- 옵션 A를 택하면 D2a가 "프롬프트 강제 + drift diff 원복"으로 더 복잡·위험 → **옵션 B 권장**.

---

## 8. kernel 영향 / 제약

- **kernel 0**: D2는 전부 `opinion.js` 작성부(client writer/draft). review-engine/kernel·adapters·schemas 미접촉. 검증 엔진은 방향을 **생산**(이미 D1까지 됨), D2는 client에서 **소비·문언화**.
- **I-6 무관**(kernel 규칙) — opinion.js 로컬.
- **재배포**: opinion.js는 GitHub Pages 자동배포 + `?v=` 갱신(edge 재배포 불필요 — client only).
- **데이터**: 재작성본은 opinion_draft_claims 새 row(확정 시) — 스키마 변경 0(기존 draft_data JSONB 재사용). `_pendingRewrite` 는 인메모리.

---

## 9. 권장 요약

1. **옵션 B(외과적 splice)** 로 범위제어를 구조 보장 — 옵션 A(전체 재드래프트)의 drift 위험 회피.
2. **기존 3게이트 재실행 + 비대상-불변 diff** 로 부수효과 방어(D3).
3. **변리사 확인 후 확정**(자동적용 금지) — diff 모달.
4. **별도 명시 액션**으로 호출(AC-T1 빠른 승인 보존), client-side라 edge wall-clock 무관.
5. **D2a→D2b→D2c→D2d 분할**, kernel 0.
6. D1 권고는 **공존**(D2 적용분은 "(반영됨)" 표시) — 대체 아님.
