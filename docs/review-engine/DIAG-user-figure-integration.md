# DIAG — 사용자 도면(이미지) 추가 기능 현황 (분석 → 정합 → 출력 반영)

> 브랜치: `review-engine/diag-user-figure-integration` · READ-ONLY 진단(코드 0)
> 결론 한 줄: **현재는 "도면 번호 예약 + 사용자가 직접 쓴 텍스트 설명 주입 + 등록 카드 썸네일"** 수준이다. **이미지 자체는 base64로 저장만 되고(비전 분석 0), 추출된 부호/구성으로 명세서와 정합하지도, 다운로드(Word/PPTX/이미지)·미리보기에 삽입되지도 않는다.** 목표 5단계 중 ②분석·③(이미지)정합·⑤출력반영이 미구현.

---

## 1. 목표 흐름 대비 현황 (한눈)

| # | 목표 단계 | 현재 | 근거(file:line) |
|---|-----------|------|------|
| 1 | 이미지 업로드 | ✅ **됨** | 파일 입력(image/*,.pdf) 1948 · FileReader→`fileDataUrl`(base64) 1981–1985 · `current_state_json.requiredFigures` 영속 581 |
| 2 | **이미지 분석(비전)** | ❌ **없음** | 이미지는 저장만(`fileDataUrl`) — 비전 호출 0. 설명은 사용자 **수기 입력**(필수) 1942–1943, 1961–1963 |
| 3 | **명세서 정합** | △ **텍스트만** | 사용자가 쓴 `description`을 상세설명·간단한설명 프롬프트에 주입 3253–3257, 4216 → LLM이 텍스트 정합. **이미지 기반 부호/구성 정합 ❌** |
| 4 | 설명 구성 | △ **텍스트만** | "도 N: 설명"이 도면 간단한설명·상세설명에 들어감 3013, 3224, 4050. **부호의 설명(step_18)에 사용자 도면 부호 자동 추출 ❌** |
| 5 | **출력 반영(다운로드/미리보기)** | ❌ **미포함** | `fileDataUrl` 소비처는 **저장(1983)·썸네일(2005) 뿐**. Word/PPTX/이미지 다운로드·미리보기는 mermaid 자동도면만 |
| — | 도면 번호 통합 | ✅ **됨** | `computeFigNums`가 사용자 번호 스킵 3227–3231 · "도 3 추가→자동 1,2,4,5" 1951 |

> **요약:** 사용자 도면은 **메타데이터(번호+설명) + 첨부 이미지(미사용)** 수준. "분석→정합→출력"의 핵심 3축이 빠져 있다.

---

## 2. 현재 구현 상세 (코드)

### 2-1. 업로드·저장 — `addRequiredFigure` (1958–1989)
```
figData = {num, description}                       // 번호 + 사용자 수기 설명(필수)
file 있으면: figData.fileName, fileSize 저장
  image면:  FileReader.readAsDataURL → figData.fileDataUrl (base64 data URL)   // 1981–1985
requiredFigures.push(figData) → saveProject(true)  // current_state_json 에 영속(581)
```
- ★ 이미지를 읽어 **base64로 보관만** 한다. **비전 분석·부호 추출 없음.** `description`은 100% 사용자 타이핑.
- 등록 리스트(2004–2013)에 40×40 썸네일(`<img src=fileDataUrl>`)만 표시.

### 2-2. 텍스트 정합(있는 것) — 프롬프트 주입
- **상세설명(step_08/12)**: `getUserFigureDescBlock`(3253–3257) → "사용자가 제공한 도면이며, 상세설명에서 해당 도면 번호를 참조하여 설명을 포함하라. 발명 내용과 정합되도록 기술하라." + step_08 프롬프트 4216 "도 N을 참조하면, 형태로 … 청구범위와 정합되도록 … 도면 설명을 기초로 기술적 의미를 보완".
- **도면의 간단한 설명**: 4048–4050 "생성 도면과 사용자 도면 **모두**에 간단한 설명 작성".
- ★ 즉 LLM은 **사용자가 쓴 `description` 텍스트만** 보고 도 N 설명을 짓는다. **이미지를 보지 않는다.** "정합"은 텍스트-설명 정합이지 이미지-부호 정합이 아니다.

### 2-3. 번호 통합(있는 것) — `computeFigNums` (3227–3251)
- `userNums = requiredFigures.map(num)` 를 **스킵**하고 자동 도면 번호를 채운다 → 충돌 회피 작동(확인).

### 2-4. 출력(빠진 것) — 다운로드/미리보기
- `downloadAsWord`(buildSpecification 기반)·PPTX(5949+)·도면 이미지 다운로드는 **mermaid 자동도면(step_07/11_mermaid)·diagramData**만 사용.
- ★ `fileDataUrl` 은 **어떤 출력 함수도 참조하지 않는다**(grep 전수: 1983 저장 / 2005 썸네일, 끝). 사용자 이미지는 최종 명세서 어디에도 들어가지 않는다.
- ★ 부호의 설명(step_18)에도 사용자 도면 부호가 직접 주입되지 않는다(추출된 부호가 없으므로).

---

## 3. 비전(이미지 분석) 가능성

- **모델**: Claude(sonnet/opus 4.x)·GPT-4o·Gemini 2.0 Flash/2.5 Pro — **셋 다 비전(멀티모달) 지원**. 모델 자체는 가능.
- **현재 파이프라인은 텍스트 전용**: `buildAPIRequest`(common.js:136–140)가 3사 모두 **텍스트 content만** 전송 —
  - claude: `messages:[{role:'user',content:user}]` (문자열)
  - gpt: `messages:[…{role:'user',content:user}]` (문자열)
  - gemini: `contents:[{parts:[{text:user}]}]`
  → **이미지 content 블록 미지원.** 비전 쓰려면 멀티모달 content를 만드는 **별도 경로**가 필요:
  - claude: `content:[{type:'image',source:{type:'base64',media_type,data}},{type:'text',text}]`
  - gpt: `content:[{type:'image_url',image_url:{url:dataUrl}},{type:'text',…}]`
  - gemini: `parts:[{inlineData:{mimeType,data}},{text}]`
- ★ **호재**: 이미지는 이미 `fileDataUrl`(base64 data URL)로 보관 중 → `data:(media_type);base64,(data)` 파싱만 하면 바로 비전 입력으로 사용 가능. 업로드/저장은 재사용.

---

## 4. 구현 설계 (분석 → 정합 → 출력)

### 단계 A. 비전 분석 인프라 (LLM 레이어)
- `common.js`에 **비전 호출 경로** 추가: `callVision(prompt, imageDataUrls[], maxTok)` →
  `buildAPIRequest`를 멀티모달 content 지원하도록 확장(프로바이더별 이미지 블록). 텍스트 전용 기존 경로는 불변(후방호환).
- 폴백: 선택된 프로바이더가 비전 불가 모델이면 비전 가능 모델로 자동 승격(gpt4o/gemini_pro/claude)하거나 안내.

### 단계 B. 사용자 도면 분석 (구성요소·부호·구조)
- `addRequiredFigure`에서 이미지 업로드 시(또는 명시 버튼) `callVision`으로 분석 →
  `figData.analysis = { components:[{label, refNum?}], structure, suggestedRefs:[{num,name}] , ocrText }`.
- 분석 결과를 등록 카드에 표시(사용자 확인·수정 가능 — 할루시네이션 방어).

### 단계 C. 명세서 정합 (이미지 ↔ 부호/구성)
- 분석 `suggestedRefs`(도면 내 부호) ↔ **부호의 설명(step_18)** 교차: 누락 부호는 step_18 보강 후보로,
  충돌(같은 번호 다른 의미)은 경고. (기존 `_reviewRenderCheck` 도면↔부호 정합 로직 재사용 가능.)
- 분석 `components` ↔ **상세설명(step_08/12)**: 사용자 도면 구성요소가 상세설명에 등장하도록 프롬프트에
  `description` 대신/추가로 **분석 추출물**을 주입(기존 3253–3257 자리 확장).

### 단계 D. 출력 반영 (다운로드·미리보기)
- **미리보기**: `renderPreview`/산출물에 사용자 도면 이미지(`fileDataUrl`)를 도 N 위치에 렌더.
- **Word(.doc)**: `downloadAsWord` HTML에 `<img src=fileDataUrl>`를 해당 도면 위치(도면의 간단한 설명/별지)에 삽입.
- **PPTX/이미지**: 도면 묶음(자동 mermaid + 사용자 이미지)을 함께 출력 — PptxGenJS `addImage({data:fileDataUrl})`.
- **부호의 설명**: 단계 C에서 정합된 사용자 도면 부호를 step_18에 통합.

### 단계 E. 저장 최적화(선택)
- base64를 `current_state_json`에 넣으면 행 비대(다이어그 로그 581가 payload 크기 경고). 대용량은
  Supabase Storage 버킷(예: `patent-figures`)로 이전하고 URL만 보관 권장(상표 `trademark-specimens` 패턴 참조).

---

## 5. Task 분할 (의존순)

| # | Task | 의존 | 핵심 |
|---|------|------|------|
| T1 | `buildAPIRequest` 멀티모달 확장 + `callVision` (common.js) | — | 3사 이미지 content 블록. 텍스트 경로 불변(후방호환) |
| T2 | 업로드 시 비전 분석 → `figData.analysis` 저장 + 카드 표시(사용자 확인) | T1 | 구성요소·부호·구조·OCR. 할루시네이션 방어(수정 가능) |
| T3 | 정합: 분석 부호 ↔ step_18, 구성 ↔ step_08/12 (프롬프트 주입 확장) | T2 | 기존 3253–3257·_reviewRenderCheck 재사용 |
| T4 | 출력: 미리보기·Word `<img>` 삽입 | T2 | `fileDataUrl` 렌더(가장 체감 큰 단계) |
| T5 | 출력: PPTX/이미지 다운로드에 사용자 도면 포함 | T4 | PptxGenJS addImage |
| T6 | (선택) 이미지 Storage 이전(행 비대 회피) | — | 대용량 대비 |

**권장 순서**: T4(출력 반영 — 지금도 이미지 있으니 즉효) → T1·T2(비전 분석) → T3(정합) → T5 → T6.
※ 출력(T4)은 비전 없이도 **지금 당장 가능**(이미지 이미 보유) — 사용자 체감 가장 큰 빠른 개선.

---

## 6. 핵심 질문 — 직답

- **단순 첨부인가, 분석·정합까지인가** → **번호 예약 + 사용자 텍스트 설명 주입 + 썸네일** 수준. 이미지 자체는 **첨부(저장)만**, 분석·이미지정합·출력 모두 ❌.
- **이미지 비전 분석 있나** → **없음.** `buildAPIRequest`가 텍스트 전용(common.js:136–140). 모델은 비전 가능하나 경로 미구현.
- **사용자 도면 ↔ 명세서 부호/구성 정합 있나** → **이미지 기반 정합 없음.** 사용자가 쓴 `description` 텍스트만 상세설명/간단한설명에 주입(텍스트 정합).
- **다운로드에 사용자 도면 포함되나** → **아니오.** `fileDataUrl`은 등록 카드 썸네일에만. Word/PPTX/이미지·미리보기 모두 미포함.
- **빠진 단계** → ②비전 분석, ③이미지-부호/구성 정합, ⑤출력 반영(+부호의 설명 통합). (①업로드·④번호통합·텍스트설명주입은 됨.)

---

## 7. 참조 (file:line)

- UI 폼(번호/설명/파일): `patent.js:1938–1953` · 카드 마운트: `index.html:1030`
- 업로드·base64 저장: `patent.js:1958–1989`(이미지 `fileDataUrl` 1981–1985) · 썸네일: `2004–2013`
- 영속(current_state_json.requiredFigures): `581` · 복원: `506`
- 텍스트 설명 주입(상세설명/간단한설명): `3253–3257`, `4216`, `4048–4050`, `3013·3224`
- 번호 스킵: `computeFigNums 3227–3251`
- LLM 텍스트 전용(비전 미지원): `common.js buildAPIRequest 136–140`
- `fileDataUrl` 전수(출력 미사용 증거): `1983`(저장) · `2005`(썸네일) — 그 외 0
