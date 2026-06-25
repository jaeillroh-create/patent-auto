# DIAG — 검토 반영(applyReview)이 B1 예시도 설명을 삭제하는 회귀

> 브랜치: `review-engine/diag-review-apply-deletes-concept` · 기준: `origin/main`(8dfe1a1, #212 머지 포함) · 코드 변경 0
> 증상(회귀): B1(#212)으로 Step 8 상세설명에 예시도 설명이 네이티브로 생성됨 ✅ → Step 13 **검토 반영(applyReview)** 하니 그 예시도 설명이 **삭제됨** ✗.

---

## 0. 결론 (한 줄)

**`sanitizeMethodFromDevice`(patent.js:5111, applyReview 전용 후처리)가 "장치 도면 최대 번호(deviceMax)를 초과하는 모든 도면을 방법 도면으로 간주"(5124)하고 그 단락을 삭제(5151)한다. 예시도(도 4·5 > deviceMax=3)가 방법 도면으로 오분류돼 삭제된다.** 이 함수는 **예시도(step_07c) 인지가 전혀 없다.** 생성 경로는 예시도-인지 sanitizer(`sanitizeDescFigureRefs`)만 쓰므로 살아남고, 반영 경로만 이 비인지 sanitizer를 추가로 써서 죽인다. B1·B2·4475 모순·재생성 덮어쓰기 **모두 무관** — 순수 후처리 코드 버그.

---

## 1. ★ 검토 반영이 왜 예시도 설명을 지우나 (삭제 메커니즘)

`applyReview`(patent.js:5394)의 장치 상세설명 처리 순서:
1. `baseDesc = stripMathBlocks(cur)` — cur=getLatestDescription()=step_08(B1 네이티브, 예시도 포함). **baseDesc에 예시도 있음.**
2. `finalDesc = applyEditInstructions(baseDesc, edits)`(5474) — **원문 보존 + 편집 적용**(applyEditInstructions 5235: `result=originalText` 기반, ADD/MODIFY만). → **예시도 보존.**
3. `finalDesc = sanitizeMethodFromDevice(finalDesc)`(**5478**) — ★ **여기서 예시도 삭제.**
4. `finalDesc = sanitizeDescFigureRefs(finalDesc,'device')`(5479) — 예시도 인지(보존).
5. `outputs.step_13_applied = finalDesc`(5524) → getLatestDescription 최신본 → 명세서에 반영 = **예시도 없는 본문.**

### ★ `sanitizeMethodFromDevice`의 버그 (patent.js:5111)
```js
const deviceMax = getLastFigureNumber(outputs.step_07||'') || optDeviceFigures;  // 장치 도면 최대(예: 3)
...
const allFigRefs = [...text.matchAll(/도\s+(\d+)/g)].map(...);
allFigRefs.forEach(n => { if(n > deviceMax) methodFigNums.add(n); });   // ★ 5124: deviceMax 초과 = 전부 "방법"
...
// 5151: methodFigNums 단락 제거 → 도 4·5(예시도) 단락 삭제
```
- `deviceMax = 3`(장치 도면 도 1·2·3). 예시도 = 도 4·5.
- 5124: `4 > 3`, `5 > 3` → **도 4·5를 "방법 도면"으로 추가** → 5133~5151에서 "도 4를 참조하면…", "도 5를 참조하면…" **단락 통째로 삭제.**
- **이 함수엔 예시도(step_07c) 도 번호를 방법에서 제외하는 로직이 없다.** "deviceMax 초과 = 방법"이라는 가정이 예시도(장치도 아니고 방법도 아닌 제3 카테고리)를 무시한다.

### 실측 (vm 재현)
- 입력: `도 1~3을 참조하면…(장치) + 도 4를 참조하면, 검색창(31)… + 도 5를 참조하면, 레코드(41)…`, step_07=`도 1:·도 2:·도 3:`, 예시도 2개.
- `sanitizeDescFigureRefs(…,'device')` → **도 4·5 보존**(maxAllowed=devMax3+concCount2=5).
- `sanitizeMethodFromDevice(…)` → **도 4·5 삭제**(>deviceMax3 → 방법 오분류). ★ 단독 재현 확인.

---

## 2. ★ 왜 생성은 살고 반영만 죽나 (호출부 비대칭 — 핵심)

| 경로 | 호출 sanitizer | 예시도 인지 | 예시도 |
|---|---|---|---|
| **Step 8 생성**(runLongStep 5006) | `sanitizeDescFigureRefs('device')` **만** | ✅ (maxAllowed=devMax+**concCount**, 3162) | **보존** ✅ |
| **검토 반영**(applyReview 5478·5479) | `sanitizeMethodFromDevice`(5478) **+** sanitizeDescFigureRefs(5479) | ❌ sanitizeMethodFromDevice는 인지 없음 | **삭제** ✗ |

- `sanitizeMethodFromDevice`는 **5478(applyReview)에서만** 호출된다(전 코드 통틀어 호출부 1곳). → **검토 반영에서만** 예시도가 죽는다.
- `sanitizeDescFigureRefs`는 생성·반영 양쪽에서 호출되나 예시도-인지(concCount 합산)라 무해.
- → B1이 생성에 예시도를 넣는 데 성공한 이유(생성은 인지 sanitizer만 사용)와, 반영이 지우는 이유(반영만 비인지 sanitizer 추가 사용)가 **동일 원인의 양면.**

---

## 3. ★ 다른 가설 배제

| 가설 | 판정 | 근거 |
|---|---|---|
| 반영이 step_08 재생성하며 덮어쓰나 | ❌ | applyEditInstructions(5474)는 원문 보존+편집(전문 재작성 아님). 삭제는 그 뒤 5478 후처리. |
| 반영 프롬프트에 4475 모순 남았나 | ❌ | 삭제는 LLM 프롬프트가 아니라 **CODE 후처리(5124)**. 편집지시 LLM은 "삭제 금지"라 delete 안 냄. B1이 생성 프롬프트만 고친 건 맞으나, 회귀 원인은 프롬프트가 아니라 sanitizer. |
| B2(applyReview step_07c 입력)가 역효과인가 | ❌ | B2는 **edit-GEN 입력**(예시도 누락 시 ADD용). 삭제는 B2와 무관한 sanitizeMethodFromDevice(5478). B2를 빼도 삭제는 동일. |
| sanitizeDescFigureRefs(도면 범위)가 지우나 | ❌ | 실측 보존(concCount 인지). 범인은 sanitizeMethodFromDevice. |

---

## 4. ★ 예시도 설명 보존 방법

`sanitizeMethodFromDevice`가 **예시도 도 번호를 "방법"에서 제외**하게 한다.
- 예시도 도 번호 = `getAutoFigNums('step_07c')`(이미 전역 헬퍼, ③·#210에서 검증).
- 5124 수정:
  ```js
  const conceptFigNums = new Set(getAutoFigNums('step_07c'));   // 예시도 = 방법 아님
  allFigRefs.forEach(n => { if(n > deviceMax && !conceptFigNums.has(n)) methodFigNums.add(n); });
  ```
- → 도 4·5(예시도)는 methodFigNums에 안 들어감 → 단락 보존. 진짜 방법 도면(예시도 범위 밖, 순서도)은 여전히 제거(예시도와 방법은 번호 disjoint: device→concept→method 순).
- (일관성 강화) `deviceMax` 기준 자체를 sanitizeDescFigureRefs처럼 "장치+예시도"로 인지시켜도 됨. 단 최소 변경은 5124 제외구.

---

## 5. 원인 요약 (file:line)

| # | 원인 | 영향 | 위치 |
|---|---|---|---|
| **P (주)** | `sanitizeMethodFromDevice`가 deviceMax 초과 도면을 전부 방법으로 간주(예시도 인지 없음) → 단락 삭제 | 검토 반영 시 예시도 설명 삭제 | patent.js:**5124**(분류)·5151(삭제) |
| S1 | 호출부 비대칭 — sanitizeMethodFromDevice는 applyReview(5478)에서만 호출 | 생성은 살고 반영만 죽음 | 5478 |
| — | applyEditInstructions·sanitizeDescFigureRefs·B1·B2는 무관 | (배제) | 5235·3162 |

---

## 6. 수정 방향 / Task 분할

| Task | 내용 | 의존 | 비고 |
|---|---|---|---|
| **1 (핵심)** | `sanitizeMethodFromDevice`(5124)에서 예시도 도 번호(`getAutoFigNums('step_07c')`) 제외 → 예시도를 방법으로 오분류·삭제하지 않음 | — | 최소 변경, 회귀 직격 |
| **2** | (일관성) deviceMax/methodFigNums 계산을 예시도 인지로 정합(sanitizeDescFigureRefs와 동일 기준) | 1 | 선택 |
| **3 (검증)** | applyReview 후 예시도 단락 보존 테스트 + 진짜 방법 도면은 여전히 제거 회귀 | 1 | 멱등·보존 |

★ Task 1만으로 회귀 해소. 예시도 없으면 conceptFigNums 빈셋 → 기존과 동일(no-op).

---

## 7. 검증 관찰 포인트(수정 후)
- B1으로 step_08에 생성된 예시도 설명(도 N…31~)이 **검토 반영(applyReview) 후에도 보존**되나.
- 진짜 방법 도면(순서도, 예시도 범위 밖)은 여전히 device 상세설명에서 제거되나(회귀 0).
- 예시도 없는 사건은 기존과 동일(no-op).
- 장치 설명(도 1~3) 회귀 0.
