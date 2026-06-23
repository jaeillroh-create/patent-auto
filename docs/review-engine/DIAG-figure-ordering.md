# DIAG — 도면 순서 사용자 지정(③) — 현재 순서 로직 + 통합 계획·삽입 밀림 설계

> 브랜치: `review-engine/diag-figure-ordering` · READ-ONLY 진단(코드 0)
> 결론 한 줄: 순서는 `computeFigNums`(3305)가 **장치→예시→방법으로 하드코딩** 배정하고, 사용자 지정은 **`requiredFigures.num`(업로드 이미지)뿐**이다 — 이게 이미 "번호 예약 + 뒤 도면 밀림"을 한다(★ 즉 "삽입 밀림" 메커니즘은 **이미 존재**, 다만 예시도엔 미적용). ★ ③ = 그 **검증된 skip 패턴을 예시도(conceptDiagramTypes)에도 부여**(위치 지정 필드) + **통합 순서 뷰**. ① 제목은 렌더 시 `getAutoFigNums`로 **live 추종**(SoT만 바꾸면 자동), 라벨·간단한설명도 live. **단 step_08·step_18(④)은 baked 텍스트라 "재생성"이 필요** → ③가 순서 변경 시 **무효화(invalidateDownstream)를 걸어야** ④가 따라온다(현재 requiredFigures 변경은 무효화 안 함 — 갭).

---

## 1. 현재 순서 계산 구조 — 하드코딩 배정 + 사용자 번호 skip

### 1-1. `computeFigNums(devCount, methCount, conceptCount)` (3305)
```
userNums = requiredFigures.map(num)           // 사용자 업로드 이미지 번호
c=1
장치: devCount 개  → c 부터, userNums 는 skip   (1,2,4,5… 식)
예시: conceptCount 개 → 이어서, userNums skip
방법: methCount 개   → 이어서, userNums skip
반환 { device, concept, method }              // ★ 순서 device→concept→method 고정
```
- ★ **유일한 사용자 제어 = `requiredFigures.num`**(업로드 이미지). 그 번호를 **예약**하면 자동 도면(장치/예시/방법)이 그 자리를 **건너뛰어** 뒤로 밀린다. → **"도 3 예약 → 기존 자동 도 3이 도 4로 밀림"이 이미 작동**(본인 ③의 "삽입 밀림"과 동일 메커니즘).
- ★ 그러나 **예시도(conceptDiagramTypes)에는 위치 지정 필드가 없다** — `{type,title,figNum:0,svgContent,refNums}`(2104)의 `figNum`은 **생성 시 계산값**이 들어갈 뿐, 사용자가 정하는 값이 아니다. 그래서 예시도는 항상 장치 뒤(positional).

### 1-2. 카운트 출처 — ★ 분산(통합 계획 없음)
| 도면군 | 개수 출처 | 위치 |
|--------|-----------|------|
| 장치 | `optDeviceFigures`(UI, 기본4, max10) | index.html:1038 · 호출 2723/2762 |
| 방법 | `optMethodFigures`(UI, 기본2) | 1114 |
| 예시도 | `conceptDiagramTypes.filter(svgContent).length` | Step 7c 카드 1045 |
| 사용자 이미지 | `requiredFigures`(번호 지정 max30) | inpRequiredFigNum 2004 |
→ **개수가 세 곳(UI 2 + 예시 리스트 + 사용자)에 흩어져** 있고, **순서는 코드가 device→concept→method로 고정**. "전체 도면을 한 목록으로 보고 순서를 짜는" 화면·자료구조가 없다.

---

## 2. 통합 순서 계획 UI — 어디·어떻게 (신규)

### 2-1. 현재 생성 흐름 (분리)
- **Step 7(장치 도면)**: `runDiagramStep`(mermaid), 개수=optDeviceFigures.
- **Step 7c(예시도)**: `runConceptDiagramStep`(SVG-direct), 개수=conceptDiagramTypes.
- **사용자 도면**: requiredFigures(업로드+번호).
→ 셋이 **별도 카드/버튼**. 통합 "도면 계획" 단계가 없다.

### 2-2. 통합 계획을 넣을 자리 — Step 7 영역(도면 설정 카드)에 "도면 순서" 패널
- 장치 N개 + 예시도 M개 + (사용자 K개)를 **하나의 순서 리스트**로 표시: `[도1 장치, 도2 장치, 도3 예시(UI), 도4 장치, …]`.
- 사용자가 예시도의 **삽입 위치(도 번호)** 를 지정 → 뒤 도면 +1 밀림.

### 2-3. 설계 옵션
| 옵션 | 방법 | 트레이드오프 |
|------|------|--------------|
| ★ **A. requiredFigures 패턴 확장(권장·저위험)** | conceptDiagramTypes 에 `figNumOverride`(원하는 도 번호) 필드 추가. computeFigNums 가 그 번호를 **예약**(requiredFigures 처럼)하고 장치/나머지 자동 도면이 밀려서 채움. UI=예시도 카드에 "도 번호 지정" + 통합 순서 미리보기 | 검증된 skip 재사용. 장치는 여전히 개수(개별 슬롯 아님)라 "장치끼리 재배열"은 불가(예시 삽입 위치만 지정) |
| **B. 통합 도면 플랜 리스트(완전·고위험)** | `figurePlan=[{kind:device|concept|method|user, ref, num}]` 단일 순서 리스트로 모델 교체. computeFigNums 대체. 드래그 재배열 | 장치도 개별 슬롯화 필요(현재 개수 기반)·기존 호출처 9곳 영향. 모델 대수술 |

→ 본인 설계("최초 생성 시 일반/예시 순서 함께 계획 + 삽입 밀림")는 **A로 충족 가능**(예시도에 위치 지정 + 통합 순서 뷰). 장치끼리의 임의 재배열까지 원하면 B. **A 권장**(삽입 밀림이 핵심이고 이미 검증된 패턴).

---

## 3. 삽입 밀림 로직 — 이미 있음(requiredFigures), 예시도로 확장만

```
현재: requiredFigures.num=3 → computeFigNums userNums={3} → 자동 장치도면이 3을 skip → 1,2,4,5
                              (기존 자동 도3 → 도4 로 "밀림")   ← ★ 삽입 밀림 이미 작동

③ 확장: conceptDiagramTypes[i].figNumOverride=3 도 userNums 처럼 예약 →
        예시도가 도3, 장치도면이 1,2,4,5 로 밀림.  (computeFigNums 가 override 를 reserved 집합에 합침)
```
- ★ `computeFigNums`의 `userNums` 예약 집합에 **예시도 override 번호도 합치고**, 예약 위치엔 해당 예시도를 놓고 자동 도면은 skip — 이 한 군데 변경으로 삽입 밀림이 예시도에 확장된다.
- SoT(computeFigNums) 가 사용자 순서를 반영 → 저장(conceptDiagramTypes.figNumOverride 는 이미 saveProject 의 conceptDiagramTypes 에 포함되어 영속).

---

## 4. 파생 추종 — ① live(자동), ④ 재생성 필요(③가 무효화 걸어야)

| 파생 | 추종 방식 | SoT(순서) 변경 시 |
|------|-----------|-------------------|
| ★ ① SVG 제목 | 렌더/다운로드 시 `_conceptSvgApplyTitle(…, getAutoFigNums)` | **자동(live)** — ③가 SoT만 바꾸면 제목 즉시 반영(#208) |
| 라벨(카드) | `getAutoFigNums` 렌더 시 | **자동(live)** |
| 도면의 간단한 설명 | `getAutoFigNums` buildSpecification 시(3118) | **자동(live)** |
| ④ step_08 상세설명 | 생성 시 `getAutoFigNums`+refMap baked(4157) | ★ **재생성 필요** — 본문 "도 N 참조"가 baked. step_07c 변경 시만 무효화(5694) |
| ④ step_18 부호의 설명 | step_08·step_07c 텍스트 파싱 | ★ **재생성 필요** |

- ★ **핵심 갭**: `requiredFigures` 추가/삭제(번호 이동 유발)는 **invalidateDownstream 을 호출하지 않는다**(addRequiredFigure/removeRequiredFigure 는 saveProject 만). → 번호가 밀려도 step_08/step_18 은 **옛 번호로 stale**. 
- → ③ 구현 시 **순서 변경(예시도 override·requiredFigures 변경) 후 step_08·step_18 을 invalidateDownstream** 해야 ④가 따라온다. ①·라벨·간단한설명은 live라 손댈 필요 없음.

---

## 5. ①④ 자동 추종 여부 — ③ 후 재작업?

- **①(제목)**: ✅ 자동. ③가 SoT만 바꾸면 제목 추종(#208에서 render-time 변환으로 만들어 둠) — **재작업 없음**.
- **라벨·간단한설명**: ✅ 자동(live getAutoFigNums) — 재작업 없음.
- **④(step_08/step_18)**: ⚠️ **재생성 시에만** 추종. ③가 **순서 변경에 invalidateDownstream 을 걸면** 자동 추종(별도 큰 재작업 아님, 무효화 1줄 + 사용자 재생성). 안 걸면 stale.
- **②(식별번호 도N→N0번대)**: ③ 후 **별도 작업**(이번 범위 외). ③로 도 번호 SoT가 확정되면 ②가 그 위에서 N0번대 파생.

---

## 6. Task 분할 (③ 구현 시)

| # | Task | 핵심 |
|---|------|------|
| ③-1 | `computeFigNums` 가 예시도 override 번호를 예약(userNums 와 합산) | 삽입 밀림 핵심. requiredFigures skip 패턴 확장 |
| ③-2 | conceptDiagramTypes 에 `figNumOverride` 필드 + 예시도 카드에 "도 번호 지정" UI | 사용자 지정 입력(이미 saveProject 영속) |
| ③-3 | 통합 순서 미리보기(장치+예시+방법+사용자를 도 번호 순 리스트로 표시) | "통합 계획" 뷰 |
| ★ ③-4 | 순서 변경 시 `invalidateDownstream`(step_08·step_18 무효화) | ④ 추종 트리거(현재 갭 메움) |
| ③-5 | 번호 충돌·범위 검증(override 중복·≤30 정책 등) | requiredFigures.num 과 충돌 방지 |

**권장 순서**: ③-1·③-2(SoT 확장) → ③-4(무효화) → ③-3(통합 뷰) → ③-5(검증). ★ ①은 이미 자동 추종이라 ③는 SoT만 바꾸면 제목이 따라온다.

---

## 7. 핵심 질문 — 직답
- **현재 순서 어떻게 정하나** → `computeFigNums`(3305)가 **device→concept→method 하드코딩**. 사용자 제어는 `requiredFigures.num`(업로드 이미지)뿐 — 그 번호를 예약하면 자동 도면이 skip되어 밀린다.
- **통합 순서 계획 UI 어디** → 현재 없음(장치/예시/방법 분리 카드). Step 7 도면 설정 영역에 "도면 순서" 리스트(장치+예시+사용자 통합) 신설.
- **삽입 밀림 어떻게** → **이미 작동**(requiredFigures.num + computeFigNums skip). 예시도에 `figNumOverride` 추가하고 computeFigNums 예약 집합에 합치면 예시도도 삽입 밀림(한 군데 변경).
- **SoT 바꾸면 ①(제목)④(설명) 자동 추종하나** → ① 제목·라벨·간단한설명 **자동(live)**. ④ step_08/step_18 은 **재생성 필요** — ③가 순서 변경에 `invalidateDownstream` 을 걸어야 추종(현재 requiredFigures 변경은 무효화 안 함 — 갭).
- **★ 안전하게 순서 로직 바꿀 방법** → **옵션 A**(requiredFigures skip 패턴을 예시도로 확장) — 검증된 메커니즘 재사용, 장치 슬롯 모델 대수술(B) 회피. + 순서 변경 시 무효화로 ④ 동기화.

---

## 8. 참조 (file:line)
- 순서 계산: `computeFigNums 3305`(device→concept→method, userNums skip 3310~) · 동적 `getAutoFigNums 3321`
- 카운트: `optDeviceFigures` index.html:1038 · `optMethodFigures` 1114 · `conceptDiagramTypes`(Step 7c) 1045 · 호출 `2762`·`4358`
- 예시도 구조(위치 필드 없음): `conceptDiagramTypes.push({type,title,figNum:0,…}) 2104`
- 사용자 번호 지정(삽입 밀림 원형): `inpRequiredFigNum 2004`(max30) · skip `computeFigNums 3307`
- 무효화 갭: addRequiredFigure/removeRequiredFigure(saveProject만, invalidate 없음) · step_07c 무효화 `invalidateDownstream('step_07c') 5694`
- 파생 추종: ① 제목 `_conceptSvgApplyTitle`(render-time, #208) · 라벨 `2148` · 간단한설명 `3118` · step_08 `4157`(getAutoFigNums baked)
