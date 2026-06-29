# DIAG — 수학식(step_09) 삽입 시 예시도 설명 중복 (합본 #220 연관)

> 브랜치: `review-engine/diag-math-duplicate` · 코드 0 (진단 전용, 수정·PR 없음)
> 증상: 수학식 삽입 시 **동일 내용(예시도 상세설명)이 중복** 삽입. 합본(#220) 이후 의심.

---

## 결론 요약 (먼저)

- ★ **근본 원인 확정(실측):** `buildImplementationBody()`의 **취약한 중복제거** — `conceptIn = device.indexOf(concept.slice(0,40)) >= 0` (`patent.js:3188`). 수학식이 **예시도 설명의 첫 40자 안쪽에 삽입**되면(짧은 첫 문장에 앵커) 그 40자 연속 매칭이 깨져 `conceptIn=false` → 예시도(step_08c)를 step_09(이미 예시도 포함) 위에 **다시 더함** → 중복. — §2·§3
- ★ **#220 연관 확정:** #220 전엔 step_09 = 장치-only+수학식(예시도 없음) → 조립이 예시도를 항상 별도 1회 추가(중복 없음). #220 합본 후 step_09 = **장치+예시도+수학식** → 조립의 dedup이 예시도 첫 40자 연속성에 의존하는데 **수학식 삽입이 이를 교란** → 중복. — §4
- ★ **무엇이·언제:** 중복되는 건 **예시도 상세설명**(장치/수학식 아님). **한 번** 수학식 삽입으로 발생(누적 아님), 수학식이 예시도 시작부에 삽입될 때 결정적. — §3
- ★ **수정 방향:** dedup을 수학식·공백에 견고하게(수학식 제거 + 공백 무시 비교) 또는 마커/플래그 기반. — §6

---

## 1. 수학식 삽입·조립 흐름 (file:line)

- `runMathInsertion`(`5191`): `base=getLatestDescription()` → `outputs.step_09=insertMathBlocks(base, r.text)`.
  - 합본(#220) 후 `getLatestDescription()`=step_08(=장치+예시도) → base에 예시도 포함 → **step_09 = 장치+예시도+수학식**.
- `insertMathBlocks`(`7062`): `stripMathBlocks(base)` 후 `【수학식】` 블록을 **앵커 문장 끝에 삽입**(`r.slice(0,ip)+'\n\n'+formula+'\n\n'+r.slice(ip)`).
- 조립 `buildImplementationBody`(`3182`):
  ```js
  const device=getLatestDescription();            // step_09 (장치+예시도+수학식)
  const concept=getLatestConceptDescription();    // step_08c (예시도)
  const conceptIn = concept && device && device.indexOf(concept.slice(0,40))>=0;   // ★ 취약
  const core=[device, conceptIn?'':concept, method].filter(Boolean).join('\n\n');
  ```
- `buildSpecification`(`14438`)·`downloadAsWord`(`14451`) 모두 `buildImplementationBody()` 사용 → 미리보기·다운로드 양쪽 중복.

---

## 2. ★ 근본 원인 — 취약한 40자 연속 매칭

`conceptIn`은 "예시도 설명의 **첫 40자가 device에 연속으로 존재**하면 이미 포함된 것"으로 판단(`3188`).
그러나 `insertMathBlocks`가 **예시도 첫 40자 안쪽에 `\n\n【수학식 N】\n\n`을 끼워넣으면** 그 40자가 더 이상 연속이 아니다 →
`device.indexOf(concept.slice(0,40))` = **-1** → `conceptIn=false` → 예시도가 `core`에 **다시 추가** → device(step_09)에 이미 있는 예시도와 **이중 표시**.

---

## 3. ★ 실측 재현 (3 케이스)

진단 스크립트로 device→예시도→합본→수학식→조립을 시뮬레이션:

| 케이스 | 예시도(step_08c) 첫 문장 / 수학식 앵커 | conceptIn(40자) | 검색창(51) 출현 |
|---|---|---|---|
| **A** | 긴 첫 문장 / 앵커=**장치** 문장 | `true` | **1회(정상)** |
| **B** | **짧은 첫 문장**("도 5는 화면이다.") / 앵커=그 문장 → 수학식이 첫 40자 안쪽 삽입 | **`false`** | **2회 ★중복** |
| C | 앞 줄바꿈 | `true` | 1회(정상) |

→ ★ **케이스 B 결정적 재현**: 수학식이 예시도 시작부에 삽입되면 40자 매칭 붕괴 → `conceptIn=false` → 예시도 설명 **중복**. (A처럼 수학식이 장치 문장에 앵커되면 우연히 안 깨져 정상 — 그래서 "가끔/특정 발명에서" 처럼 보일 수 있음.)

---

## 4. ★ #220(합본) 연관

| | step_09 내용 | 조립 dedup | 결과 |
|---|---|---|---|
| **#220 전** | 장치-only + 수학식 (예시도 없음) | `conceptIn`은 항상 false지만 step_09에 예시도가 없으니 **별도 1회 추가 = 정상** | 중복 없음 |
| **#220 후** | **장치 + 예시도 + 수학식** | `conceptIn`이 예시도 첫 40자 연속성에 의존 → **수학식 삽입이 교란** | conceptIn=false 시 **예시도 중복** |

→ 합본 자체는 의도대로(후속 자동 공유)지만, **조립의 dedup이 수학식 삽입에 취약**해 중복 발생. 사용자 직감("조립의 문제, 합본 이후") 정확.

---

## 5. 핵심 질문 답변

| 질문 | 답 |
|---|---|
| 무엇이 중복되나? | **예시도 상세설명(step_08c)**. 장치·수학식 아님(§3). |
| 한 번에? 여러 번 눌러야? | **한 번**(수학식 1회 삽입). 누적 아님(insertMathBlocks가 stripMathBlocks로 멱등). |
| 합본(#220) 연관? | **그렇다.** step_09에 예시도가 들어가며 조립 dedup이 취약해짐(§4). |
| getLatestDescription 체인 중복? | 체인은 1개 반환(중복 아님). 중복은 **조립**에서 device(예시도 포함)+concept(예시도) 이중 추가. |
| 멱등 장치? | 수학식 삽입 자체는 멱등(stripMathBlocks). 그러나 **조립 dedup이 수학식 perturbation에 비멱등적으로 실패**. |

---

## 6. 수정 방향 + Task 분할 (구현 시)

| # | Task | 내용 | 위험 |
|---|---|---|---|
| **T1** ★ | 견고한 dedup | `conceptIn` 판정을 수학식·공백에 견고하게: `stripMathBlocks(device)` 후 **공백 무시** 비교(예: `dev.replace(/\s+/g,'').includes(concept.slice(0,N).replace(/\s+/g,''))`). 수학식 블록 제거 + 공백 정규화로 첫-N자 연속성 복원 | 🟡 N·정규화 경계 |
| **T2** | (대안) 마커/플래그 | 합본 시 예시도 구간을 sentinel 로 감싸거나 step_08 "예시도 포함" 플래그 → 조립이 substring 매칭 없이 dedup | 🟠 마커 출력 노출 주의 |
| **T3** | 테스트 | 수학식이 예시도 시작부 앵커여도 중복 0(케이스 B), 정상 케이스(A·C) 회귀 0, 미합본 구사건 예시도 1회 유지 | 🟢 |

**권장:** T1(견고한 dedup) — 수학식 블록 제거 + 공백 무시 containment. 최소 변경으로 케이스 B 해소. ※ 실행/생성 로직 무변경, **조립 dedup만** 손봄.

---

## 7. 회귀 가드 (구현 시)

- 수학식 삽입(앵커 위치 무관) 후 예시도 설명 **정확히 1회**.
- 미합본 구사건(step_09=장치-only+수학식)은 예시도 **별도 1회 추가 유지**(누락 0).
- 장치·방법·수학식 본문 회귀 0, 수학식 멱등 유지.
- buildSpecification·downloadAsWord 양쪽 동일.
