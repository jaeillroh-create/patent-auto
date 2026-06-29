# DIAG — 예시도 상세설명(step_08c) 후속 단계 누락 → step_08 합본 설계

> 브랜치: `review-engine/diag-concept-desc-merge-into-step08` · 코드 0 (진단 전용, 수정·PR 없음)
> 본인 요구: 예시도 설명을 **기존 상세설명(step_08) 본문에 합본** → 후속 단계(수학식·검토·검토반영)가 자동 공유. 단 **생성 분리(#215 과부하 방지)는 유지** = "생성 분리 + 저장 합본".

---

## 결론 요약 (먼저)

- ★ **뿌리 확정**: 예시도 설명이 `outputs.step_08c`로 **별도 저장**되고, 후속 단계 대부분은 `getLatestDescription()`(= step_13_applied>step_09>step_08, **device-only**)만 읽는다. 그래서 **수학식·특허성검토·대안청구항·검토반영**에 예시도가 빠진다. 예시도는 **최종 조립(buildImplementationBody)·step_13 입력(#218)·부호(step_18, #217)** 에만 합류. — §3
- ★ **합본은 안전하다**: 장치 sanitizer 2종이 모두 **예시도-aware**(31~99/도 5·6 보존) → step_08에 합본해도 #213 삭제가 재발하지 않는다. — §4
- ★ **권장 설계**: 생성은 분리 유지(LLM 재호출 없음), 생성 직후 **step_08 본문에 예시도 텍스트 병합**(device-only 스냅샷으로 멱등). 합본 후 `getLatestDescription` 체인이 예시도를 품으므로 후속 단계가 자동 공유. 조립·표시는 **중복 제거**. — §5

---

## 1. 증상 (본인) · 뿌리

- 장치 상세설명(`step_08`) ↔ 예시도 상세설명(`step_08c`)이 **별도 출력**.
- ① 수학식 삽입 시 예시도 안 따라감 · ② AI 검토/검토 반영에 예시도 미적용 · ③ 후속 단계 계속 누락.
- ★ 뿌리: 예시도가 `step_08` 본문에 **물리적으로 안 합쳐짐** — 오직 **조립(buildImplementationBody)** 때만 합쳐진다(중간 단계는 device-only).

---

## 2. 현재 예시도 흐름 (file:line)

- 생성: `runImplementationDesc`(통합) → `_longStepCore('step_08')`(device) → `_conceptDescCore()`(concept, `outputs.step_08c`). 분리 생성(#215).
- 저장: `outputs.step_08`(device) / `outputs.step_08c`(concept) **분리**.
- 접근자: `getLatestDescription()`(`patent.js:3044`) = step_13_applied>step_09>step_08 — **device-only**(step_08c 불포함). `getLatestConceptDescription()`(`3068`) = `outputs.step_08c`.
- 합류: `buildImplementationBody()`(`3108`) = `[device(getLatestDescription) + concept(step_08c) + method]` — **조립 시점에만** 합쳐짐(최종 산출물·미리보기).

---

## 3. ★ 손실 지점 전수 — 후속 단계가 device-only만 읽음

후속 단계 대부분이 `getLatestDescription()`(device-only)을 읽어 **예시도(step_08c)를 못 본다**:

| 단계 | 위치 | 입력 | 예시도 포함? |
|---|---|---|---|
| **수학식(step_09)** | `4536` `buildMathPrompt(stripMathBlocks(getLatestDescription()…))` · `5125` `baseDesc=getLatestDescription()` | device-only | ❌ **누락**(math가 예시도에 안 붙음) |
| **특허성 검토(step_15)** | `4835` `[상세설명 요약] getLatestDescription().slice` | device-only | ❌ 누락 |
| **대안 청구항(step_14)** | `4824` `[상세설명 참고용] getLatestDescription().slice` | device-only | ❌ 누락 |
| **효과(step_16)** | `4850` `[상세설명] getLatestDescription().slice` | device-only | ❌ 누락 |
| **AI 검토(step_13)** | `4813` `[상세설명] getLatestDescription()` **+** `[예시도 상세설명] step_08c`(#218) | device-only + 별도 블록 | △ 별도 블록으로만 봄 |
| **검토 반영(applyReview)** | `5490` `cur=getLatestDescription()` → `step_13_applied=device-review`; **step_08c 미접촉** | device-only | ❌ **예시도에 검토 미반영** |
| 최종 조립 | `3110` device+concept+method | device-only + step_08c | ✅ 합류(여기서만) |

→ ★ 본인 ①②③ 모두 사실. 예시도는 **수학식·특허성·대안·검토반영**에서 누락되고, **최종 조립 때만** 합류한다.

---

## 4. ★ 합본 안전성 — sanitizer 가 예시도를 안 지운다(#213 재발 X)

예시도를 step_08에 합치면 장치 후처리(sanitizer)가 예시도 단락(도 5·6, 부호 31~99)을 지울 위험이 핵심 우려였다(#213이 분리한 이유). **확인 결과 둘 다 예시도-aware → 안전:**

- `sanitizeDescFigureRefs(text,'device')`(`3132~`): 허용 도면 `maxAllowed = _devMax + _concCount`(`3179`). 예시도 도(5·6)는 범위 내 → **삭제 안 됨**. (도 참조만 검사; 부호 31~99는 "도 N"이 아니라 비대상.)
- `sanitizeMethodFromDevice(text)`(`5193~`): `conceptFigNums = getAutoFigNums('step_07c')`를 methodFigNums에서 **제외**(`5210`) → 예시도 단락 **삭제 안 됨**.

→ ★ step_08 합본 후 `_longStepCore`의 `sanitizeDescFigureRefs`(`5048`)·`applyReview`의 sanitizer 2종(`5542~5543`)을 타도 예시도 보존. **합본은 안전.**
> 단, ③ 도면 순서 override 로 예시도 번호가 device 사이에 끼면 `maxAllowed`(범위식)가 어긋날 여지 — 기존 엣지(합본이 새로 만든 결함 아님). 합본 시 회귀 확인 권장.

---

## 5. ★ 합본 저장 설계 (생성 분리 + step_08 합본) — 권장

### 5-1. 핵심 — "생성은 분리, 저장은 합본"
- **생성(분리 유지)**: `_longStepCore('step_08')`(device) → `_conceptDescCore()`(concept). LLM 호출은 그대로 분리 → 과부하/누락 재발 없음(#215 보존). 합본은 **텍스트 병합**(LLM 재호출 아님).
- **저장(합본)**: concept 생성 직후 `outputs.step_08 = <device-only> + '\n\n' + <concept>`.
- → `getLatestDescription()` 체인(step_08→step_09→step_13_applied)이 예시도를 품으므로 **수학식·특허성·대안·검토반영이 자동 공유**(§3 누락 일괄 해소). 후속 호출부 개별 수정 불필요.

### 5-2. ★ 멱등 — device-only 스냅샷 (재생성 안전)
합본을 반복해도 중복/오염되지 않게:
- device 생성 시 **device-only 스냅샷 보존**(예: `outputs.step_08_device`).
- 합본 = `step_08 = step_08_device + concept`(항상 스냅샷에서 재구성 → 중복 append 없음).
- **통합 버튼 재생성**: device 덮어쓰기→스냅샷 갱신→concept→합본(깨끗이 재구성).
- **보조 "예시도만 재생성"**: 스냅샷(device-only)에서 재합본(멱등). ★ 마커 불필요.

### 5-3. concept 생성 입력은 device-only (자기참조 방지)
- `case 'step_08c'` 프롬프트의 `[장치 상세설명]`(`4533` `getLatestDescription()`)은 **device-only(스냅샷)** 를 넣어야 한다. 합본된 step_08을 넣으면 concept가 **이전 concept를 자기참조**.
- 통합 흐름에선 concept 생성이 **합본 전**(step_08=device-only)이라 자연히 device-only. 보조 재생성은 §5-2 스냅샷 사용.

### 5-4. 중복 제거 (조립·표시) — ★ 합본의 필수 짝
합본하면 device 체인에 예시도가 이미 있으므로 **별도 concept 합류를 제거**해야 중복이 안 생긴다:
- `buildImplementationBody()`(`3110`): 현재 `device + concept(step_08c) + method`. → **`getLatestDescription()(=device+concept) + method`** 로(별도 concept 슬롯 제거). 안 그러면 예시도 **2회**.
- 표시(#219): `resultStep08`(우측)이 이제 device+concept를 함께 표시 → `resultStep08c`(별도 렌더)는 **중복/불필요** → 숨김 또는 제거(또는 보조 재생성 미리보기 용도로만).
- `step_18` `_refSources`(`4865`)는 step_08·step_08c 둘 다 포함 — 합본 후 step_08c는 잉여지만 부호 중복은 dedup되어 무해(유지 가능).

### 5-5. step_08c 역할
- **제거하지 않음.** `step_08c` = 예시도 **정본(source)** — 합본 step_08을 (재)구성하고, 보조 재생성·표시의 원천. step_08 = 후속 단계가 읽는 **합본 정본**.

---

## 6. 핵심 질문 답변

| 질문 | 답 |
|---|---|
| 예시도가 후속(수학식·검토)에 왜 안 가나? | 후속이 `getLatestDescription()`(device-only)만 읽고 step_08c는 별도 출력이라(§3). |
| step_08 본문 합본하면 후속이 자동 보나? | **그렇다.** getLatestDescription 체인이 예시도를 품어 수학식·특허성·대안·검토반영 일괄 해소(§5-1). |
| 합본해도 생성 과부하 재발 안 하나? | **안 한다.** 생성은 분리 유지, 합본은 텍스트 병합(LLM 재호출 아님)(§5-1). |
| 합본 후 조립·표시 중복 안 되나? | buildImplementationBody의 별도 concept 슬롯 제거 + resultStep08c 숨김 필요(§5-4). 안 하면 2회. |
| step_08c 역할? | **정본 source 유지**(합본 재구성·보조 재생성·표시 원천). 제거 X(§5-5). |
| sanitizer가 예시도 지우나? | **안 지운다**(둘 다 예시도-aware, §4) → 합본 안전. |

---

## 7. Task 분할 (구현 시)

| # | Task | 내용 | 위험 |
|---|---|---|---|
| **T1** ★ | 합본 저장 | device 생성 시 device-only 스냅샷 보존 + concept 생성 직후 `step_08 = 스냅샷 + concept` 병합(멱등) | 🟡 멱등·재생성 |
| **T2** | concept-gen 입력 device-only | `case 'step_08c'` `[장치 상세설명]`에 device-only 스냅샷 주입(자기참조 방지) | 🟢 |
| **T3** ★ | 중복 제거 | `buildImplementationBody` 별도 concept 슬롯 제거(=getLatestDescription+method) + `resultStep08c` 숨김(#219 표시 일원화) | 🟠 중복/표시 회귀 |
| **T4** | 후속 자동 공유 검증 | 수학식·특허성·대안·검토반영이 합본 step_08 읽어 예시도 포함되는지(코드 무수정, 테스트로 확인) | 🟢 |
| **T5** | sanitizer 회귀 | 합본 step_08이 `sanitizeDescFigureRefs`/`sanitizeMethodFromDevice` 거쳐도 예시도 보존(③ override 엣지 포함) | 🟡 |

**권장 순서**: T1(합본)+T2(입력) → T3(중복 제거) → T4·T5(검증). 생성 로직(LLM 호출)은 분리 유지, **저장·조립·표시 계층만** 손본다.

---

## 8. 회귀 가드 (구현 시)

- 장치 상세설명(C1) 회귀 0 · 예시도(C1c) 정확히 **1회**(조립·표시 중복 0).
- 후속(수학식·특허성·대안·검토반영)이 예시도 포함(자동 공유) — 핵심 수용 기준.
- 생성 과부하 재발 0(LLM 호출 분리 유지).
- sanitizer 통과 후 예시도 보존(#213 재발 0).
- 재생성(통합·보조) 멱등 — 예시도 중복 append 0.
- 최종 산출물(미리보기·다운로드) 예시도 1회 유지.
