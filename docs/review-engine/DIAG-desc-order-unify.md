# DIAG — 상세설명 순서 모순 + UI 분리 (장치→예시도 통합)

> 브랜치: `review-engine/diag-desc-order-unify` · 코드 0 (진단 전용, 수정·PR 없음)
> 대상: 장치 상세설명(step_08) ↔ 예시도 상세설명(step_08c) 의 **생성 순서**·**UI 통합**
> 전제: #215(step_08c 분리)·#217(끼워넣기 reflect 은퇴) 머지 완료. 화면 검증됨.

본인 두 요구:
- **① 순서**: 장치 상세설명(step_08) 완결 → 그 내용을 **전제**로 예시도 설명(step_08c). 현재 거꾸로 가능(예시도가 프로세서(120) 참조하는데 장치 설명 미완 → 전제 없음).
- **② UI**: "상세설명 생성" **한 버튼** → 장치 + 예시도 함께(모듈은 내부 구분 유지, 순서 장치→예시). 현재 별도 버튼 2개.

---

## 1. 현재 순서·버튼 구조 (사실)

### 1-1. 버튼 — 2개, 별도 카드, 별도 핸들러

| 버튼 | 위치 | 핸들러 | 카드 |
|---|---|---|---|
| **"예시도 상세설명 생성"** (`btnStep08c`) | `index.html:1069` | `runConceptDescStep()` | **Step 7c 카드 내부**(예시도 생성 바로 아래) |
| **"상세설명 생성"** (`btnStep08`) | `index.html:1108` | `runLongStep('step_08')` | **Step 8 카드** |

→ 두 버튼은 **완전 독립**. "상세설명 생성"(step_08)을 눌러도 예시도(step_08c)는 **실행되지 않는다**. 예시도 설명은 사용자가 Step 7c 카드의 별도 버튼을 따로 눌러야 생성됨.

### 1-2. 순서 강제 — **없음** (① 모순의 근원)

- `runLongStep('step_08')` (`patent.js:5038`): 장치 상세설명 생성 후 sanitizer·`runScopeCheck`만 수행. **step_08c로 이어지는 체이닝 없음**(`patent.js:5067`까지 확인).
- `runConceptDescStep()` (`patent.js:5070`): 진입 가드가 `outputs.step_06`(장치 청구항) + 예시도 존재만 검사 — **`outputs.step_08`(장치 상세설명)은 검사하지 않음**(`patent.js:5072-5073`).
- `STEP_DEPENDENCIES.step_08c = {MUST:[], SHOULD:['step_18']}` (`patent.js:2487`) — **step_08c가 step_08에 의존한다는 간선(edge)이 그래프에 없다.**
- `checkDependency()` (`patent.js:4944-4949`)에는 **step_08c 항목 자체가 없음**(runConceptDescStep이 호출하지도 않음).

**결론:** step_08c는 step_08보다 **먼저 실행 가능**하다. 의존성 맵·진입 가드·체이닝 어디에도 "장치 먼저" 강제가 없다. → 본인 ① "거꾸로 가능" 확인.

### 1-3. step_08c는 장치 상세설명을 **입력으로 받긴 한다** (전제 주입은 존재)

`patent.js:4532` (step_08c 프롬프트 말미):
```
[장치 상세설명 — 참고: 동일 명칭·참조번호 사용] ${(getLatestDescription()||'').slice(0,3000)}
```
→ step_08c 프롬프트는 `getLatestDescription()`(=step_13_applied>step_09>step_08)을 **참고 입력으로 주입**한다. 예시도 요소가 프로세서(120) 등 장치 구성에 의해 동작·구현됨을 기술하라는 지시(`patent.js:4522`)도 이 입력을 전제로 한다.

**문제:** step_08이 **아직 생성 안 됐으면** `getLatestDescription()`이 `''` → 이 입력이 **빈 값** → 예시도가 참조할 장치 구성(프로세서(120) 등)의 근거가 프롬프트에 없음. **전제 주입 경로는 있으나, 순서 미강제로 전제가 비는 것**이 ①의 실체다.

---

## 2. 핵심 질문 답변

| 질문 | 답 | 근거 |
|---|---|---|
| step_08·step_08c 순서 강제되나? (예시도 먼저 가능?) | **강제 안 됨. 예시도 먼저 가능.** | 의존성 간선 없음(2487), 진입 가드 step_08 미검사(5072-73), 체이닝 없음 |
| step_08c가 장치 상세설명(step_08) 입력받나? | **받는다(프롬프트). 단 step_08 미생성이면 빈 값.** | 4532 `getLatestDescription().slice(0,3000)` |
| "상세설명 생성" 한 버튼에 장치→예시도 순차 가능? | **가능. 단 `globalProcessing` 가드 충돌 처리 필요.** | 3장 |
| 모듈(step_08/step_08c) 내부 유지하며 UI 통합? | **가능(조립은 이미 일원화됨).** | `buildImplementationBody()` 3108 |
| 검토 반영 짧은 포함 원인? | **Step 13 입력에 step_08c 없음 + applyReview가 step_07c brief로 짧은 stub을 device에 ADD_AFTER 주입.** | 4장 |

---

## 3. 통합 방법 — ① 순서 + ② 한 버튼 (수정 방향, 미구현)

### 3-1. UI 통합 (② 한 버튼)

- **"상세설명 생성"(`btnStep08`)** 핸들러를 `runLongStep('step_08')` → **새 통합 핸들러**(예: `runImplementationDesc()`)로 교체.
  - 내부: `step_08`(장치) 생성 **완결** → 예시도 존재하면(`conceptDiagramTypes.some(ct=>ct.svgContent)`) `step_08c`(예시도) **이어서** 생성.
  - 예시도 없으면 step_08만(조건부). → 본인 ② "예시도 없으면 step_08만".
- **모듈 내부 구분 유지**: step_08/step_08c는 별도 `outputs` 키·별도 프롬프트·별도 러너 그대로. 버튼만 하나로. 조립(`buildImplementationBody()` `patent.js:3108`)은 이미 `[device, concept, method]`를 순서대로 합치므로 **추가 변경 불필요**.
- **`btnStep08c`(Step 7c 카드)** 는 제거 또는 "예시도만 재생성"용 보조 버튼으로 강등(통합 버튼이 1차 경로).

### 3-2. 순서 강제 (① 장치→예시 전제)

- ★ `globalProcessing` 가드 충돌 주의: `runLongStep`(5038)·`runConceptDescStep`(5071) 모두 진입 시 `if(globalProcessing)return;`. 통합 핸들러가 둘을 연달아 부르면 **내부 두 번째 호출이 가드에 막혀 early-return**된다. → **가드 없는 코어 함수로 분리**(`_genDeviceDesc()`/`_genConceptDesc()`)하거나, 통합 핸들러가 `globalProcessing`을 1회만 잡고 코어를 순차 호출하는 구조로 리팩터.
- **의존성 명문화**(자동 cascade·수동 둘 다 장치 먼저 보장):
  - `STEP_DEPENDENCIES`에 step_08c의 step_08 의존을 표현(또는 `checkDependency`에 `step_08c:()=>outputs.step_08?null:'장치 상세설명 먼저'` 추가)하여 **topologicalSort**(`patent.js:2785`)와 수동 실행 양쪽에서 device-first 보장.
- step_08c 프롬프트는 이미 `getLatestDescription()`을 전제로 주입(4532)하므로, **순서만 강제되면 전제가 항상 채워진다**(추가 주입 불필요).

---

## 4. "검토 반영 짧게만 포함" 원인 (④ — 별개 땜질, #217 미은퇴)

#217은 `reflectConceptsToSpec()`의 **step_08 APPEND**만 은퇴시켰다. 그러나 **검토(Step 13)·검토 반영(applyReview) 경로에는 동일한 끼워넣기 땜질이 남아 있다.**

### 4-1. Step 13 입력에 step_08c(전체 예시도 설명)가 **없다**

`patent.js:4812` (step_13 검토 입력):
```
[상세설명] ${getLatestDescription().slice(0,6000)}            ← device-only(은퇴 후)
[예시도/개념도 설계 …] ${outputs.step_07c.slice(0,1500)}      ← 예시도 "설계"(brief), step_08c 아님
```
→ Step 13은 **장치 상세설명(예시도 없음)** + **예시도 설계(brief)** 만 본다. **step_08c(완성된 예시도 상세설명)는 입력에 없다.**

### 4-2. Step 13이 "예시도 설명 누락"으로 오판 → 짧은 문장 제시

`patent.js:4800-4802` ([12] 예시도 정합 검토 항목):
```
각 예시도(도 N)가 상세설명에 "도 N을 참조하면, …" 형태로 기술되어 있는지 확인하라.
기재 누락 시 지적하고, 추가할 문장(도 N 소개 + 예시도 부호 설명)을 제시하라.
```
→ [상세설명](device)에 예시도 단락이 없으니 **"누락"으로 지적**하고, step_07c brief 기반의 **짧은 한 문장**(도 N 소개 + 부호)을 제안한다.

### 4-3. applyReview가 그 짧은 문장을 **장치 검토반영본(step_13_applied)에 주입**

`patent.js:5529` (applyReview 장치 편집지시 입력):
```
${outputs.step_07c ? '[예시도 설계 …] '+outputs.step_07c.slice(0,1200)
  +'\n★ 검토가 예시도(도 N) 설명/부호 누락을 지적하면, … "도 N을 참조하면, …" 예시도 단락을 ADD_AFTER 로 추가하라.' : ''}
```
→ 검토 반영 시 **step_07c brief 기반 짧은 예시도 단락**을 `step_13_applied`(**장치** 상세설명)에 `ADD_AFTER`로 끼워넣는다.

### 4-4. 결과 — "짧게만 포함" / 중복

- 조립(`buildImplementationBody`)은 `device(step_13_applied, 짧은 stub 포함) + concept(step_08c, 전체) + method`.
- step_08c를 **생성한 경우**: 장치 섹션에 **짧은 stub** + 예시도 섹션에 **전체** → **중복**.
- step_08c를 **생성 안 한 경우**(순서 미강제·버튼 분리로 흔함): 예시도 섹션 비고, 장치 섹션의 **짧은 stub만** → **"검토 반영하면 예시도 설명이 짧게만 포함"** = 본인 증상 정확히 일치.

**∴ ④는 ①·②와 한 묶음:** 버튼 통합(장치→예시 자동) + 순서 강제로 **step_08c가 항상 채워지고**, 동시에 **검토 경로의 짧은 stick-in(4-1~4-3)을 은퇴**하면(또는 검토를 step_08c로 라우팅) "짧게만" 증상이 해소된다.

---

## 5. 부수 발견 — cascade 디스패치 갭

`runCascadeRegeneration`(`patent.js:2775`)의 러너 디스패치(`2804-2809`)에 **`runConceptDescStep` 케이스가 없다.** step_08c의 러너는 `runConceptDescStep`(STEP_RUNNERS `2508`)인데, 디스패치에 매칭이 없어 **`else → _cascadeRunShort(sid)`** 로 빠진다(전용 focused 경로 미사용). 또한 topologicalSort에 step_08→step_08c 간선이 없어 **cascade에서도 예시도가 장치보다 먼저 재생성될 수 있다**(①과 동일 결함). → 순서 강제(3-2) 시 함께 교정 권장.

---

## 6. Task 분할 (구현 시)

| # | Task | 요구 | 핵심 변경(예상) | 위험 |
|---|---|---|---|---|
| **T1** | UI 통합 — 한 버튼 | ② | `btnStep08` → 통합 핸들러(`runImplementationDesc`); 내부 device→concept 순차; 예시도 없으면 device만; `btnStep08c` 강등/제거 | 🟡 `globalProcessing` 가드 충돌 → 코어 분리 필수 |
| **T2** | 순서 강제 — 장치 전제 | ① | `checkDependency` step_08c 항목(step_08 선행) + 의존 간선; runConceptDescStep `outputs.step_08` 가드 | 🟡 cascade topo 정합 |
| **T3** | 검토 짧은 stub 은퇴 | ④ | applyReview(5529) 예시도 ADD_AFTER 주입 제거 + Step 13 입력에 step_08c 추가(누락 오판 차단) + [12]를 step_08c 기준으로 | 🟠 검토 반영 회귀 주의(장치 회귀 0 검증) |
| **T4** | cascade 디스패치 갭 | 부수 | 2804 디스패치에 `runConceptDescStep` 케이스 + topo 간선 | 🟢 |

**권장 순서:** T2(순서 토대) → T1(버튼 통합) → T3(검토 은퇴) → T4(cascade). 각 단계 테스트 + 장치 상세설명 회귀 0 + 예시도 설명 중복 0 검증.

---

## 7. 회귀 가드 (구현 시 필수 검증)

- 장치 상세설명(step_08) 단독 생성·내용 회귀 0.
- 예시도 설명은 **step_08c로만** 1회(검토 반영 후에도 device 섹션에 짧은 stub 없음).
- 부호의 설명(step_18) 예시도 부호(31~) 유지(#217 경로 보존).
- 예시도 없는 사건 → step_08만, step_08c·예시 관련 경로 no-op.
- 통합 버튼 `globalProcessing` 1회 점유·정상 해제(중첩 early-return 없음).
