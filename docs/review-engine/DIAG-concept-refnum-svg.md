# DIAG — 예시도 SVG 그림 식별번호 미치환(텍스트만 51~, 그림은 30·40번대)

> 브랜치: `review-engine/diag-concept-refnum-svg` · 코드 0 (진단 전용, 수정·PR 없음)
> 증상: #221 후 예시도 설명/부호(텍스트)는 새 번호(51~) 적용 ✅, 그러나 **예시도 그림(도 5·6 SVG)은 여전히 30·40번대** ⛔. `_conceptSvgApplyRefNums`(SVG 치환)가 안 먹음.

---

## 결론 요약 (먼저)

- ★ **근본 원인: 형식 불일치.** SVG의 참조번호는 **"리더라인 + 숫자"(맨숫자, 예 `<text>31</text>`)** 로 그려진다(생성 규칙 `patent.js:5981`). 그런데 `_conceptSvgApplyRefNums`(`169`)의 정규식은 **`\((\d{2,4})\)` — 괄호 `(NN)` 형식만** 치환한다. → SVG의 맨숫자는 **하나도 매칭 안 됨** → 그림은 31~ 그대로. — §2
- ★ **텍스트는 되는 이유:** step_08c·step_18·step_07c는 **refMap을 읽어** 번호를 출력하고, refMap은 sync에서 51~로 (재)배정됨. 그림(svgContent)만 치환 실패 → **refMap=51 / SVG=31 괴리.** — §3
- ★ **도 제목은 되는데 식별번호는 안 되는 차이:** 제목(`_conceptSvgApplyTitle`)은 render 시점에 텍스트를 **오버레이(추가)** — 기존 숫자와 매칭 불필요. 식별번호는 기존 숫자를 **매칭·교체**해야 하는데 형식(괄호) 가정이 틀림. 게다가 식별번호 치환은 render가 아니라 **생성/③ 시점의 물리 치환**(sync)에만 있음. — §4
- ★ **2차 괴리(복구 난점):** 일단 refMap=51 / SVG=31 로 갈린 뒤엔 sync의 oldToNew가 **현재 refMap(51) 기준**이라 `{51→51}`(멱등 skip) — SVG의 31을 가리키는 키가 없어 **재-sync로도 복구 불가**. 정규식만 고쳐도 기존 사건은 재생성해야 복구됨. — §5

---

## 1. 현재 식별번호 SoT 흐름 (#221)

- 생성 직후/③ override 시 `_syncConceptRefNums()`(`173`) 호출:
  - `oldToNew` = 현재 refMap.signNumber → figN 기반(`_conceptRefNumFor`).
  - `ct.svgContent=_conceptSvgApplyRefNums(ct.svgContent, oldToNew)` (`184`) — SVG 치환.
  - refMap.signNumber·refNums 갱신, step_07c 재구성.
- step_08c(`_cList`)·step_18(`_conceptRefPairs`)·step_07c(`_buildConceptOutputText`)는 refMap을 읽음 → 텍스트는 51~.

---

## 2. ★ 근본 원인 — SVG 숫자는 맨숫자, 치환 정규식은 괄호만

| 측 | 형식 | 근거 |
|---|---|---|
| **SVG 그림의 참조번호** | **맨숫자**(리더라인 + 숫자, 괄호 없음) — `<text …>31</text>` | 생성 규칙 `5981`: "참조번호 표기: 리더라인(얇은 선) + 숫자" |
| **`_conceptSvgApplyRefNums` 치환 대상** | **괄호 `(NN)` 만** | `169`: `replace(/\((\d{2,4})\)/g, …)` |

→ SVG의 `<text>31</text>`(맨숫자)는 `\((\d{2,4})\)`(괄호)에 **매칭되지 않음** → `oldToNew{31→51}`가 있어도 SVG는 **치환 0** → 그림은 31~ 유지. ★ 확정.

> 참고: 파서의 SVG 폴백(`117`)도 `\((\d{2,3})\)`(괄호) 가정 → 맨숫자 SVG에선 폴백이 안 잡힘. refMap은 REF_MAP 블록(`113`, "31: 이름")에서만 채워짐. 그래서 refMap은 정상(→51 sync), SVG만 31.

---

## 3. ★ 텍스트 vs 그림 경로 차이

- **텍스트(step_08c·step_18·step_07c)**: refMap.signNumber를 읽어 출력. sync가 refMap을 51~로 재배정 → **텍스트 51~** ✅.
- **그림(svgContent)**: sync가 `_conceptSvgApplyRefNums`로 물리 치환하나, **괄호 정규식이 맨숫자를 못 잡아** svgContent 불변 → **그림 31~** ⛔.
- 결과: 같은 예시도인데 **설명/부호=51, 그림=31** 괴리.

---

## 4. ★ 도 제목 치환과의 차이 (왜 제목은 되나)

| | 제목(`_conceptSvgApplyTitle`) | 식별번호(`_conceptSvgApplyRefNums`) |
|---|---|---|
| 방식 | **오버레이(추가)** — 【도 N】 텍스트를 `<svg>` 직후 삽입(`257`), 기존 숫자 매칭 불필요 | **매칭·교체** — 기존 숫자를 찾아 치환(형식 일치 필수) |
| 호출 시점 | **render마다**(카드 `2323` + 다운로드) | **생성/③ sync 시점만**(`184`), render엔 없음 |
| 결과 | figNum SoT 추종 ✅ | 괄호 정규식 → 맨숫자 미스 → ⛔ |

→ 제목은 "넣기"라 형식 무관하게 매번 SoT를 그리지만, 식별번호는 "바꾸기"라 **SVG 실제 형식(맨숫자)** 을 잡아야 하는데 못 잡았다. 또 render 경로에도 없어 한 번 실패하면 끝.

---

## 5. ★ 2차 괴리 — 재-sync로도 복구 안 되는 이유

`_syncConceptRefNums`의 `oldToNew`는 **현재 refMap** 기준(`181`):
- 정상 생성 시: refMap=31 → `{31→51}` → (정규식 맞으면) SVG 31→51. 하지만 정규식이 못 잡아 SVG=31 잔존, refMap만 51.
- 이후 재호출: refMap=51 → `{51→51}` → `hasChange=false`(`182`) **skip**. SVG의 31을 가리키는 키(31) 없음 → **복구 불가**.
- ③ override(도5→도6): refMap=51 → `{51→61}` → SVG의 31은 키 31이 없어 미치환(정규식까지 고쳐도 31 미스). → 여전히 괴리.

→ **정규식만 고쳐도 "이미 갈린" 기존 사건**(SVG31/refMap51)은 자동 복구 안 됨 → **예시도 재생성**(refMap이 31로 재파싱되는 시점)에만 정상화. 또는 위치(position) 기반 재번호로 복구.

---

## 6. 핵심 질문 답변

| 질문 | 답 |
|---|---|
| `_conceptSvgApplyRefNums` 만들어지고 호출되나? | **있음**(`168`), 호출은 sync(`184`) 1곳. render엔 없음. |
| 제목은 되는데 식별번호는 왜 안 되나? | 제목=오버레이(형식 무관)·render마다, 식별번호=매칭교체(괄호 가정 오류)·sync만(§4). |
| SVG 안 번호 패턴을 잡나? | **못 잡음.** SVG는 맨숫자(`5981`), 정규식은 괄호 `(NN)`만(`169`)(§2). |
| 텍스트는 되고 그림은 안 되는 차이? | 텍스트=refMap(51), 그림=svgContent 물리치환 실패(31)(§3). |
| 기존 SVG(31 박힘) 치환되나? | **안 됨.** 정규식 미스 + 괴리로 재-sync도 불가 → 재생성 필요(§5). |

---

## 7. 수정 방향 + Task 분할 (구현 시)

| # | Task | 내용 | 위험 |
|---|---|---|---|
| **T1** ★ | SVG 맨숫자 치환 | `_conceptSvgApplyRefNums`가 **`<text>`/`<tspan>` 텍스트노드의 맨숫자**(리더라인 부호)도 치환 — 좌표/속성(x=,y=,d=,font-size,stroke-width,viewBox) 미접촉. oldToNew 키 매칭 가드(알려진 부호만). 괄호형도 유지 | 🟠 좌표 오염 회피(텍스트노드 한정) |
| **T2** ★ | 괴리 복구(기존 사건) | **위치(position) 기반** 재번호: SVG의 i번째 참조번호 → `_conceptRefNumFor(figNum,i,total)`(현재값 무관) → SVG31/refMap51 갈린 것도 복구. 또는 render 시점 적용(제목 패턴)으로 기존 사건 즉시 정상화 | 🟠 다중출현·순서 가드 |
| **T3** | render 경로 적용(선택) | 제목처럼 render(카드·다운로드)에서도 식별번호 SoT 적용 → svgContent 미변경에도 표시 정합(기존 사건 무재생성 복구) | 🟡 |
| **T4** | 파서 폴백 정합 | `_parseConceptRefMap` SVG 폴백(`117`)도 맨숫자 인식(괄호 한정 해제) — refMap 누락 보강 일관 | 🟢 |

**권장**: T1(맨숫자 치환) + T2(위치 기반 또는 render 적용) — 형식 일치 + 괴리 복구. 텍스트(refMap)는 이미 정상이므로 **SVG 치환 경로만** 손본다.

---

## 8. 회귀 가드 (구현 시)

- SVG 그림 식별번호 = 텍스트(refMap)와 일치(도5→그림도 51~).
- 좌표/크기/path 등 비-부호 숫자 미변경(치환 정확도).
- ③ override 후 그림·텍스트 동시 추종.
- 기존 사건(SVG31/refMap51) 복구(위치 기반 또는 재생성 안내).
- 제목(_conceptSvgApplyTitle)·멱등 유지.
