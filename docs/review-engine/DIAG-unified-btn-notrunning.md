# DIAG — 통합 버튼(장치+예시도) 화면서 예시도 안 보임

> 브랜치: `review-engine/diag-unified-btn-notrunning` · 코드 0 (진단 전용, 수정·PR 없음)
> 증상: "상세설명 생성(장치+예시도)"(btnStep08→runImplementationDesc) 눌러도 **Step 8 결과에 장치(1~4)만, 예시도(5~6) 없음**. 표준 "예시도 상세설명 생성" 버튼은 따로 누르면 생성됨.

---

## 결론 요약 (먼저)

- ★ **순차 실행(device→concept)은 코드상 정상 작동한다.** globalProcessing 코어 분리도 정상이다(사용자 의심과 달리 concept가 막히지 않음). — §2, §3
- ★ **진짜 원인은 "표시 분리"다.** 예시도 상세설명(step_08c, C1c)은 **`resultStep08c`(좌측 Step 7c 카드 영역)** 에 렌더된다. 사용자가 보는 **"Step 8 결과"(`resultStep08`, 우측 패널)** 에는 **장치(C1)만** 나온다. 통합 실행이 성공해도 "Step 8 결과"에는 예시도가 **구조상 안 보인다.** — §4
- ★ **btnStep08c는 "보조"로 남겼을 뿐 제거/숨김은 안 했다**(여전히 보임). 사용자 기대(강등=숨김/제거)와 표시상 어긋남. — §5
- ★ **결정적 확인법**: 최종 산출물(미리보기)에 예시도 5~6이 있으면 → 실행 정상(순수 표시 문제). 없으면 → 캐시/배포 잔존 의심. — §6

---

## 1. 증상 재정리

| 관찰 | 사용자 보고 |
|---|---|
| 통합 버튼 라벨 | "상세설명 생성 (장치+예시도)"로 바뀜 → ★ **새 index.html·patent.js(?v=20260658) 로드됨**(라벨이 patent.js가 아니라 index.html 소관이므로 신버전 확정) |
| 통합 버튼 클릭 결과 | Step 8 결과에 **장치(1~4)만**, 예시도(5~6) 없음 |
| 표준 예시도 버튼 | 따로 누르면 C1c 생성됨(= `conceptDiagramTypes.some(svgContent)` 참) |
| btnStep08c | 여전히 살아있음 |

라벨이 신버전이라는 점이 중요하다 — **실행 중인 코드는 runImplementationDesc(신규)다.** 따라서 "버튼이 옛 runLongStep을 부른다"는 가설은 배제된다.

---

## 2. 실행 경로 추적 — 순차 실행은 정상 (file:line)

`runImplementationDesc` (`patent.js:5100`):
```js
async function runImplementationDesc(){
  if(globalProcessing)return;
  const dep=checkDependency('step_08');if(dep){...return;}
  setGlobalProcessing(true);
  try{
    await _longStepCore('step_08');                                   // ① 장치
    if(outputs.step_08 && outputs.step_06 && conceptDiagramTypes.some(ct=>ct.svgContent)){
      await _conceptDescCore();                                       // ② 예시도
    }
  }finally{setGlobalProcessing(false);}
}
```

- **①장치 완결 → ②예시도 호출**: `await _longStepCore('step_08')` 후 조건 충족 시 `await _conceptDescCore()`. 직선 경로, 사이에 early-return 없음.
- ★ **_longStepCore는 자기 오류를 자기 try/catch로 삼킨다**(`patent.js:5046~5070`). 즉 device 단계에서 무슨 throw가 나도 catch가 먹고 정상 반환 → **concept 호출을 막을 수 없다.** (device가 화면에 보인다 = `outputs.step_08=t`까지 도달 = 정상 반환)
- 조건 3개 = 표준 버튼 가드(`patent.js:5076~5078`)와 **완전히 동일**. 표준 버튼이 C1c를 만든다 = 세 조건 모두 참 = 통합 경로에서도 참 → **concept 실행됨.**

---

## 3. globalProcessing 코어 분리 — 정상 (사용자 핵심 의심 반증)

- `_conceptDescCore` (`patent.js:5083`)에는 **`if(globalProcessing)return` 가드가 없다.** 따라서 runImplementationDesc가 globalProcessing=true인 상태로 호출해도 **막히지 않는다.**
- `_longStepCore` (`patent.js:5041`)도 가드 없음. globalProcessing은 **핸들러가 1회만** 점유(`setGlobalProcessing(true)` 1회 → finally 1회 해제).
- device 도중 `runScopeCheck`(`patent.js:1024`)가 끼어도 **runScopeCheck는 setGlobalProcessing을 건드리지 않는다**(text/mermaid 변형 929/971 모두 미접촉). → concept 차단 경로 없음.
- ★ **검증**: vm 테스트 `patent-desc-order-unify.test.js`의 "runImplementationDesc — 장치+예시도 둘 다 생성(순차)"가 **outputs.step_08·step_08c 둘 다 set됨을 통과**시킨다(549 pass). 실행 로직은 증명됨.

**∴ 사용자의 "globalProcessing 코어 분리 실패" 의심은 코드상 성립하지 않는다. 순차 실행은 작동한다.**

---

## 4. ★ 진짜 원인 — 표시 분리 (resultStep08c ↔ Step 8 결과)

`renderOutput` (`patent.js:14065`)의 cid 규칙:
```js
const cid=`result${sid.charAt(0).toUpperCase()+sid.slice(1).replace('_','')}`;
```
| sid | cid | 위치 |
|---|---|---|
| `step_08`(장치 C1) | **`resultStep08`** | **우측 패널 "Step 8 결과"**(`index.html:1162~1164`, resultCard08) |
| `step_08c`(예시도 C1c) | **`resultStep08c`** | **좌측 Step 7c 카드 영역**(`index.html:1072`, btnStep08c 바로 아래) |

→ 통합 버튼이 ②concept를 실행하면 C1c는 **`resultStep08c`(좌측, Step 7c 옆)** 에 렌더된다. 사용자가 보는 **"Step 8 결과"(우측 resultStep08)** 에는 **device(C1)만** 들어간다. **예시도는 "Step 8 결과"에 구조상 절대 안 나온다** — 통합 실행 성공 여부와 무관.

즉 사용자가 "Step 8 결과 = 장치만"이라고 본 것은 **정상 동작**이다(예시도는 화면 다른 곳/최종 산출물에 있음). "한 버튼 → 장치+예시도 함께"라는 기대는 **한 화면(한 결과 카드)에서 둘 다 보이는 것**인데, 현재 구조는 C1=우측, C1c=좌측으로 **갈라져** 있다.

> 단, 만약 사용자가 **`resultStep08c`(좌측)까지 확인했는데도 비어 있다면** 그건 표시 문제가 아니라 실행 문제다 → §6 확인법으로 판별.

---

## 5. 버튼 강등 현황 (②)

- `btnStep08c`("예시도 상세설명 생성")는 `index.html:1069`에 **그대로 존재**(onclick=runConceptDescStep, 보조). #218에서 **제거/숨김이 아니라 "보조로 강등 + 안내문구 추가"**(`index.html:1068`)만 했다.
- 따라서 사용자 눈에 **"여전히 살아있음"**은 의도된 상태(보조)다. 다만 사용자는 강등=숨김/제거를 기대 → 표시상 어긋남. (지금은 step_08c가 stale일 때 btn-primary로 강조까지 됨 — `_updateConceptDescBtn` `patent.js:3074`.)

---

## 6. ★ 결정적 확인법 (사용자 실행)

표시 문제인지 실행 문제인지 1분 판별:

1. 통합 버튼 클릭 후 **좌측 Step 7c 카드의 `resultStep08c`** 를 본다.
   - 채워져 있으면 → **실행 정상**, 순수 표시 분리(§4) 확정.
2. 또는 **최종 산출물(미리보기/page4)** 을 연다. `buildImplementationBody`(`patent.js:3108`)가 `[장치→예시도→방법]`을 합치므로 **예시도 5~6이 산출물에 있으면 실행 정상.**
3. 둘 다 비어 있으면 → 실행 문제. 이때만 (a) 하드리프레시(브라우저가 옛 patent.js 캐시), (b) 콘솔 에러 확인.

(코드 추적·테스트상으로는 1·2가 "채워짐"으로 나와야 정상이다.)

---

## 7. 핵심 질문 답변

| 질문 | 답 |
|---|---|
| runImplementationDesc가 device→concept 순차 실제 실행? | **그렇다**(코어 가드프리·조건 동일·테스트 통과). §2·§3 |
| globalProcessing이 concept을 막나? | **아니다**(코어에 가드 없음, runScopeCheck 미접촉). §3 |
| 예시도 조건 분기가 skip? | **아니다**(device-gen이 conceptDiagramTypes/svgContent를 clear하지 않음 — invalidateDownstream은 step_13_applied만 삭제). §2 |
| 생성됐는데 표시가 안 되나, 생성 자체가 안 됐나? | ★ **생성은 됨(C1c→resultStep08c), "Step 8 결과"에 표시만 안 됨.** §4·§6으로 최종 확인 |
| 버튼 강등 안 된 이유? | **제거가 아니라 "보조"로만 강등**(의도). §5 |

---

## 8. 수정 방향 + Task 분할

| # | Task | 내용 | 비고 |
|---|---|---|---|
| **T1** ★ | 표시 통합 | "Step 8 결과"(우측 resultStep08)에 **C1c(예시도 상세설명)도 노출** — device 아래 "예시도 상세설명" 서브섹션, 또는 통합 버튼이 device+concept 합본을 우측에 렌더. → "한 버튼 → 한 화면에 장치+예시도" | renderOutput('step_08c') 타깃 추가/미러 또는 runImplementationDesc 후 합본 렌더 |
| **T2** | 버튼 강등 명확화 | btnStep08c **숨김(display:none, 평상시)** 또는 Step 8 카드로 이동(소형 "예시도만 재생성"). 통합 버튼이 1차 경로임을 시각적으로 | step_08c stale일 때만 노출 등 |
| **T3** | 완료 가시화(선택) | 통합 버튼 완료 토스트 "장치+예시도 상세설명 완료" + (선택) 콘솔 트레이스 | 순차 실행 사용자 체감 |
| **T0** | (확인) 캐시/배포 | §6에서 실행 문제로 판명되면 ?v= 재확인·하드리프레시 안내 | 표시 문제면 불필요 |

**권장**: T1(표시 통합)이 핵심 — 사용자 기대("장치+예시도 함께")를 한 결과 화면에서 충족. T2로 버튼 정리. 실행 로직은 이미 정상이므로 **로직 수정 불필요**, UI/렌더 계층만 손본다.

---

## 9. 회귀 가드 (수정 시)

- 장치 상세설명(C1) "Step 8 결과" 표시 회귀 0.
- 예시도 상세설명(C1c)이 좌측 resultStep08c·최종 산출물에서 사라지지 않게(미러면 양쪽 동기).
- 통합 순차 실행(device→concept)·globalProcessing 1회 점유 유지(이미 정상).
- 표준 버튼(보조) 동작 유지.
