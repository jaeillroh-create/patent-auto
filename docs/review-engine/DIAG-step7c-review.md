# DIAG — Step 7c(예시도/개념도) 전면 검토 + 더 나은 도구 가용성

> 브랜치: `review-engine/diag-step7c-review` · READ-ONLY 진단(코드 0)
> 결론 한 줄: **Step 7c는 LLM이 SVG를 손으로 직접 써 내려가는 방식**(mermaid 아님, 3-path 아님)이다. UI 화면·스틱 피겨 같은 시각적 장면엔 **SVG-direct가 올바른 도구**(mermaid·graphviz는 노드-그래프 전용이라 불가, 이미지생성 모델은 래스터라 특허 선화 부적합). 진짜 한계는 **포맷이 아니라 "LLM SVG 품질 + QA 루프 부재"**다. ★ 가장 큰 개선 = **머지된 T1 비전(callVision)으로 "생성→렌더→비전 비평→수정" 루프** 추가(자기 도면을 보고 고침). 부수로 **프롬프트 2곳 분산(math와 동형)·E-11 미검사 갭**.

---

## 1. Step 7c 현재 구현 (file:line)

### 1-1. 방식 — LLM이 SVG를 직접 생성(텍스트→SVG, mermaid 아님)
```
runConceptDiagramStep (5504)        — 메인 생성. App.callClaude(prompt,16384) → 응답에서 <svg>...</svg> 파싱
_cascadeRunConceptDiagram (2708)    — 연쇄 재생성. 동일 메커니즘(프롬프트만 축약 — §3-3)
프롬프트(5523~): "예시도/개념도를 SVG 코드로 직접 생성하라" + 상세 규칙(시각 어휘·SVG 기술규칙·유형별 지시)
파싱(2733~2741): ---CONCEPT_FIG_N--- 마커 또는 <svg> 정규식 → ct.svgContent(원시 SVG) 저장. 실패 시 "SVG 생성 실패" 폴백
참조번호 추출(2741): /\((\d+)\)/ 중 31~79 → ct.refNums
산출(2744): outputs.step_07c = 텍스트 요약(도 N·라벨·참조번호·간단설명). ★ SVG 자체는 conceptDiagramTypes[].svgContent 에만
```

### 1-2. 유형 — 5종 (CONCEPT_DIAGRAM_TYPES 79–85)
| type | 라벨 | refRange |
|------|------|----------|
| ui_screen | UI 화면 | 31–50 |
| user_scenario | 사용자 시나리오 | 51–60 |
| data_structure | 데이터 구조 | 61–70 |
| device_appearance | 장치 외관 | 71–80 |
| process_scene | 프로세스 장면 | 81–99 |

### 1-3. 렌더·다운로드
- **미리보기**: `renderConceptDiagramCards (2061~)` — `area.innerHTML = ct.svgContent`(원시 SVG 그대로 삽입, 2077).
- **다운로드**: `downloadConceptPptx (13608)` — **SVG→Blob→Image→Canvas(1360×1000)→PNG→PptxGenJS addImage**(13631~). 즉 SVG를 래스터화해 PPTX 슬라이드로.

---

## 2. 도면 생성 전반 — Step 7(장치) vs Step 7c(예시도)

| | **Step 7 장치 도면** | **Step 7c 예시도/개념도** |
|---|---|---|
| LLM 출력 | **mermaid 텍스트** | **SVG 코드 직접** |
| 레이아웃 | `parseMermaidGraph`→`layoutGraph` (프로그램 자동배치) | LLM이 좌표까지 수기 작성(자동배치 없음) |
| 렌더 경로 | **3-path**(SVG/PPTX/Canvas, 공유 mermaid 소스에서 파생) | 단일 SVG → innerHTML / SVG→PNG(PPTX) |
| 3-path 불일치 위험 | **있음**(E-11 delta 게이트로 방어) | **없음**(단일 SVG 소스 — 구조적으로 일관) |
| 표현력 | 노드-엣지 그래프(블록도) | **UI 화면·스틱피겨·테이블·외관**(자유 시각) |
| 부호 정합(E-11) | **검사함**(step_07_mermaid ⊆ step_18) | ★ **검사 안 함**(아래 §3) |

> 핵심 대비: Step 7은 **구조적·검증가능하나 표현 제한**(블록도만), Step 7c는 **표현 자유롭되 품질·검증이 LLM에 전적 의존**. 둘은 상보적이고, 예시도엔 SVG-direct가 맞다.

---

## 3. 한계·문제

| # | 한계 | 근거 | 영향 |
|---|------|------|------|
| L1 | ★ **LLM 수기 SVG 품질** — 자동배치 없이 좌표를 손으로 → 요소 겹침·비율 왜곡·정렬 흐트러짐 | 5504/2708 SVG 직접 생성, layoutGraph 미사용 | 도면 품질이 들쭉날쭉(특히 복잡한 UI) |
| L2 | ★ **단발성·QA 루프 부재** — 1회 생성으로 끝. 결과를 모델이 다시 보지 않음 | `App.callClaude` 1회(5523), 검증·재시도 없음 | 첫 출력이 곧 최종(자가수정 불가) |
| L3 | ★ **프롬프트 2곳 분산**(math와 동형) — 메인(5523, 상세) vs 캐스케이드(2714, 축약) | 5523 long / 2714 short | 캐스케이드 재생성 시 규칙 빈약 → 품질 저하 |
| L4 | **E-11 미검사 갭** — step_07c 참조번호(31~79)가 부호의 설명(step_18) 정합 검사 밖 | `_reviewRenderCheck`는 step_07_mermaid·step_11_mermaid만(14328) | 예시도 부호 누락/충돌이 렌더검사에 안 잡힘 |
| L5 | **파싱 실패 폴백** — `<svg>` 못 찾으면 "SVG 생성 실패" 플레이스홀더 | 2737 | 조용한 품질 저하(재시도 없음) |
| L6 | (경미) **원시 SVG innerHTML** — LLM SVG를 그대로 삽입(살균 없음) | 2077 | 준신뢰 입력이나 XSS 표면(저위험) |

> ⚠️ 단, **3-path 불일치는 Step 7c엔 해당 없음**(단일 SVG라 구조적 일관). 사용자가 우려한 "3-path 메모리 불일치"는 mermaid(step_07/11) 영역이고 delta 게이트로 이미 방어됨.

---

## 4. 더 나은 도구 가용성 ★ (핵심)

### 4-1. 이미지 생성 모델 — ❌ 특허 도면엔 부적합
- GPT(gpt-image-1/DALL·E)·Gemini(Imagen/2.0 image-gen)는 **래스터(비트맵) 이미지**를 만든다. 특허 도면 요건(흑백 **선화**, 정확한 **참조번호**, 편집가능 벡터, 청장 규격)과 **근본 충돌** — 사진풍·비편집·번호 부정확. **도입 비권장**(예시도를 망친다).

### 4-2. 다른 다이어그램 도구 — ❌ 예시도엔 부적합
- mermaid·graphviz(DOT)·d3는 **노드-엣지 그래프 전용** → UI 화면·스틱피겨·외관을 못 그린다(예시도의 본질과 불일치). excalidraw(손그림풍)는 LLM 네이티브 생성 경로가 없어 비용 대비 이득 낮음. → **현 SVG-direct가 예시도엔 최적 포맷**(바꿀 필요 없음).

### 4-3. ★ T1 비전(callVision, 머지됨) — ✅ 최고 레버리지
- 이제 **모델이 이미지를 본다**(#203). 이를 도면 **생성**이 아니라 **QA·정련**에 쓴다:
  - **생성→렌더(SVG→PNG)→비전 비평→수정 SVG** 루프. "이 도면의 요소 겹침·비율·규격 위반·번호 누락을 지적하고 고친 SVG를 출력하라"를 callVision으로.
  - L1(품질)·L2(QA 부재)를 **신규 비용 없이**(기존 SVG→PNG 변환 13631 재사용) 직접 해소. 1~2회 반복으로 품질 급상승.
- ★ 즉 "더 나은 도구"의 정답은 **새 다이어그램 도구가 아니라, 새로 생긴 비전 능력으로 자기 SVG를 검수·수정하는 루프**다.

### 4-4. 최신 LLM — ✅ 이미 자동 적용
- step_07c는 `App.callClaude`(selectedModel=기본 Opus 4.8). v11.0 당시보다 **SVG 작성력이 향상된 최신 모델이 이미 자동 사용**된다(모델 선택만으로 품질 상승). 별도 작업 불필요.

---

## 5. 개선 방향 (보완 vs 새 도구)

**판정: 새 포맷/도구 도입 ❌, 현 SVG-direct 유지 + 신능력(비전)·단일화로 보완 ✅.**

| 방향 | 내용 | 트레이드오프 |
|------|------|--------------|
| ★ **A. 비전 정련 루프** | 생성 SVG를 SVG→PNG 후 `callVision`으로 결함 비평→수정 SVG(1~2회) | 호출 1~2회 추가 비용 ↔ 품질 대폭 향상. 최고 ROI |
| **B. 프롬프트 단일화** | 메인(5523)·캐스케이드(2714) SVG 프롬프트를 `buildConceptDiagramPrompt()` 단일화(math 단일화와 동형) | 저위험·중이득(캐스케이드 품질 정상화) |
| **C. E-11 확장** | step_07c refNums(31~79)도 부호의 설명(step_18) 정합 검사에 포함 | 저위험·중이득(예시도 부호 누락/충돌 표면화) |
| **D. 파싱실패 재시도** | `<svg>` 미검출 시 1회 재생성(폴백 전) | 저위험·소이득 |
| ✗ 이미지생성/타도구 | 래스터·노드그래프 부적합 → 비도입 | — |

---

## 6. Task 분할 (개선 시)

| # | Task | 의존 | 핵심 |
|---|------|------|------|
| C1 | `buildConceptDiagramPrompt()` 단일 소스로 메인·캐스케이드 통합(L3) | — | math 단일화 패턴. 저위험 선행 |
| C2 | **비전 정련 루프**: SVG→PNG→`callVision`(결함 비평+수정 SVG)→교체. 반복 1~2회·옵션 토글 | T1(머지됨), C1 | ★ 핵심 품질 개선. 기존 SVG→PNG(13631) 재사용 |
| C3 | 파싱 실패/저품질 시 재생성 폴백(L5) | C1 | 조용한 실패 제거 |
| C4 | E-11에 step_07c 부호 정합 포함(L4) | — | `_reviewRenderCheck`에 step_07c refNums 반영 |
| C5 | (선택) 원시 SVG 살균(허용 태그 화이트리스트) | — | XSS 표면 축소(저위험) |

**권장 순서**: C1(단일화) → C2(비전 정련 — 체감 최대) → C3 → C4 → C5.

---

## 7. 핵심 질문 — 직답

- **Step 7c 현재 어떻게 생성하나** → **LLM(Claude, 16384tok)이 SVG 코드를 직접 작성**(mermaid 아님). `<svg>` 파싱→`conceptDiagramTypes[].svgContent`. UI/스틱피겨/테이블/외관 5유형. 미리보기는 원시 SVG innerHTML, 다운로드는 SVG→PNG→PPTX.
- **한계가 뭔가** → ★ **LLM 수기 SVG 품질**(자동배치 없음·겹침) + **QA 루프 부재**(단발) + 프롬프트 2곳 분산 + E-11 미검사. (3-path 불일치는 step_07c엔 **해당 없음** — 단일 SVG.)
- **더 나은 도구·LLM 가용한가** → **이미지생성·mermaid/graphviz는 예시도에 부적합**(래스터/노드그래프). ★ **머지된 T1 비전(callVision)으로 자기 SVG를 검수·수정하는 정련 루프**가 진짜 개선. 최신 모델(Opus 4.8)은 이미 자동 적용.
- **현재 보완 vs 새 도구 도입** → **보완**(SVG-direct 유지). 비전 정련 루프 + 프롬프트 단일화 + E-11 확장. 새 포맷 도입은 역효과.

---

## 8. 참조 (file:line)
- 유형: `CONCEPT_DIAGRAM_TYPES 79–85` · 상태: `conceptDiagramTypes 62`
- 메인 생성·프롬프트: `runConceptDiagramStep 5504`(프롬프트 5523~) · 캐스케이드: `_cascadeRunConceptDiagram 2708`(프롬프트 2714~)
- 파싱·저장: `2733–2744`(폴백 2737) · 산출 텍스트: `outputs.step_07c 2744`
- 렌더: `renderConceptDiagramCards 2061`(원시 SVG innerHTML 2077) · 다운로드: `downloadConceptPptx 13608`(SVG→PNG→PPTX 13631)
- 대비(mermaid 3-path): `parseMermaidGraph 8098`·`layoutGraph 8222`·`renderDiagrams 11841`
- E-11 경계(step_07c 미검사): `_reviewRenderCheck`의 `diagram=refsOf(step_07_mermaid)+refsOf(step_11_mermaid)` (14328)
- 의존: `step_07c MUST step_08·step_18` (2238)
