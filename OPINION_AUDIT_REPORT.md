# OPINION_AUDIT_REPORT — opinion.js 종합 검증

- **검증 일시**: 2026-04-27
- **대상 파일**: `opinion/opinion.js` (2279 LOC), `index.html` (opinion 영역 ~70줄), `opinion/opinion.css` (140줄)
- **opinion-migration.sql**: 저장소에 부재. `opinion_*` 테이블은 Supabase 측 별도 마이그레이션. 스키마는 코드 호출 시점 추론 기준.
- **방식**: 코드 수정 0건 / Supabase 쓰기 0건 / 실제 LLM 호출 0건. mock fixture는 `/tmp/opinion-audit/fixtures/` 하위에만 작성, 레포 미커밋.
- **mock fixture 경로**:
  - `/tmp/opinion-audit/fixtures/scenario-P-prompts.md` — 진보성 §29
  - `/tmp/opinion-audit/fixtures/scenario-D-prompts.md` — 기재불비 §42
  - `/tmp/opinion-audit/fixtures/scenario-M-prompts.md` — 혼합

## 시나리오 통과·실패 매트릭스 (최종 판정은 청크 7에서 확정)

| 시나리오 | 자동 흐름 | 도메인 정확성 | 출력물 즉시 제출 가능성 |
|---------|----------|--------------|----------------------|
| P (진보성/신규성) | ⚠️ Gate 약함, fallback silent | ❌ 사후적 고찰 누락, 1항만 보정 강제 | ❌ 보정서 분리 없음 |
| D (기재불비) | ❌ §42 1호/4호 분리 없음, fallback silent | ❌ spec_basis cross-check 없음 (P0) | ❌ §47② 단언만, 검증 없음 |
| M (혼합) | ❌ secondary_type 미사용, 단일 분기 | ❌ 두 거절이유 분리 논변 불가 | ❌ 보정서 누락 + 분리 논변 누락 |

## CHUNK 1/7 — 검증 메타 + 단계 입출력 계약

[누적 카운트: P0 0 / P1 0 / P2 0]

### 7단계 파이프라인 — 각 단계의 입력→출력 필드 계약

| # | 단계 | 진입 함수 | 핵심 입력 (이전 단계 출력) | 핵심 출력 (DB 저장) | 다음 단계 의존 필드 |
|---|------|----------|------------------------|-------------------|------------------|
| 1 | upload | `Opinion.startParsing` (L815) | `Opinion.state.files[].{name, _role}` | — (메모리) | `_role` (notification/specification/cited_ref/other) |
| 2 | parse | `Opinion.startParsing` (L913 callForJSON) | 6개 역할별 `textByRole`, `citedRefGuide` | `opinion_parsed_documents.{raw_text, parsed_data}` | `parsed_data.{rejection_reasons, cited_references, claims, comparison_table}` |
| 3 | type | `Opinion.determineType` (L1047) | `parsed_data.rejection_reasons` 등 + `raw_text` 발췌 | `opinion_type_determinations.{determined_type, confidence, reasoning}` + `opinion_projects.{rejection_type, secondary_rejection_type}` | `rejection_type` 단일값만 |
| 4 | strategy(분석) | `Opinion.startAnalysis` (L1158) | `parsed_data` 5K + raw_text 20K | `opinion_issue_analyses.result_data` (3종 스키마 분기) | `result_data.{discussion, elements, strategies, items, rejected_claims, allowable_claims, merge_suggestion}` |
| 5 | draft(보정+검증) | `Opinion.startDraft` (L1591) → `startValidation` (L1698) | `getContext(['parsed','analysis'])` + `selectedStrategy` | `opinion_draft_claims.draft_data` + `opinion_validation_results.result_data` | `dr.{amended_claims/corrected_claims/merged_claim, validation:{summary, elements:[{checks:[]}]}}` |
| 6 | opinion | `Opinion.startOpinionDraft` (L1791) | `getContext(['parsed','analysis','draft','validation','ref'])` | `opinion_opinion_drafts.content` (sections JSON) | `content.sections[].{heading, content}` |
| 7 | output | `Opinion.startOutput` (L1963) → `downloadDocx` (L2030) | `opinionDraft.sections` + `validation.elements` | — (.doc Blob) | — |

### 발견 #1 (계약 위반)

### [P0] secondary_rejection_type DB에 저장되나 어디서도 소비되지 않음
**위치:** opinion.js L1088 (저장) / 그 외 어떤 곳에서도 read 없음
**증거:**
```js
// L1088
await sb.from('opinion_projects').update({
  rejection_type:tr.primary_type||'inventive_step',
  secondary_rejection_type:tr.secondary_type||null,
  status:'type_determined'
}).eq('id',p.id);
```
`grep secondary_rejection_type opinion.js` → 1건만 (L1088 저장 시점뿐). PIPELINE 분기(L519, L543, L565, L584), prompts dict(L1169, L1605, L1803), getContext, downloadDocx 모두 `rejection_type` 단일값만 사용.
**왜 문제인가:** 시나리오 M(진보성+기재불비 동시) 케이스가 코드 구조상 표현 불가. 사용자가 한 거절유형을 선택하면 다른 유형의 거절은 분석/보정/의견서 어디에도 반영되지 않는다.
**영향:** 혼합 거절통지서를 받은 사용자는 둘 중 하나만 대응 가능. 누락된 거절이유는 후속 OA로 다시 통지될 위험.
**개선 방향:** PIPELINE에 ['inventive_step+description_deficiency'] 같은 결합 유형 추가하거나, secondary_type을 prompt context에 명시 주입하여 의견서 단계에서 별도 섹션으로 처리. 단기 우회: type 단계에서 secondary 감지 시 사용자에게 경고 + 두 프로젝트 분기 권장.

### 발견 #2 (계약 위반)

### [P0] type 단계의 `_parse_failed` 침묵 fallback → 헤더-본문 모순의 근원
**위치:** opinion.js L1079-L1090 `Opinion.determineType`
**증거:**
```js
// L1079-1090
var tr = await Opinion.callForJSON( ... 유형판별 prompt ..., schemaHint );
await sb.from('opinion_type_determinations').insert({...,determined_type:tr.primary_type||'inventive_step', ...});
await sb.from('opinion_projects').update({rejection_type:tr.primary_type||'inventive_step', ...}).eq('id',p.id);
p.rejection_type=tr.primary_type||'inventive_step';
```
`callForJSON`은 JSON 파싱 실패 시 `{_parse_failed:true, raw_text:...}` 객체를 반환(L2272-L2276). 위 코드는 `tr._parse_failed` 체크가 없고, `tr.primary_type`이 undefined이면 그냥 'inventive_step'으로 silent fallback.
**왜 문제인가:** 사용자가 관찰한 "헤더 A 진보성 / 본문 §42" 모순의 직접 원인 후보. 통지서가 §42 기재불비여도 LLM 응답이 마크다운 코드블록·앞뒤 잡설 등으로 JSON 파싱 실패하면 → 헤더는 inventive_step으로 굳음. 이후 분석/보정/의견서는 모두 진보성 법리로 흐른다.
**영향:** 잘못된 법리의 의견서가 자동 생성되어 사용자가 그대로 KIPO 제출 시 거절이유 불해소. 변리사 신뢰도 직격.
**개선 방향:** `if (tr._parse_failed || !tr.primary_type) { showToast 차단 + 사용자에게 수동 선택 강제 }` 추가. Toast로 "유형 자동 판별 실패 — 직접 선택해 주세요" 명시 후 type override UI(L1104-L1108)를 자동 펼침.

### 발견 #3 (계약 위반)

### [P1] parsing 단계 `rejection_reasons.article` 예시가 §29만 보여줌 → §42 사례 패턴 이탈
**위치:** opinion.js L923, L928 (파싱 prompt schema 예시)
**증거:**
```js
// L923
+'4. rejection_reasons: [{claim_nos:[N], article:"§29②", reason:"진보성 위반", cited_refs:["인용문헌1"]}]\n'
// L928 schemaHint
'{"application_no":"10-...",..."rejection_reasons":[...],"cited_references":[...]}'
```
schema 예시에 §29②만 있고 §42②/§42④ 사례 없음. cited_refs 필드도 §42 케이스에는 빈 배열이어야 하나 예시가 채워진 형태라 LLM이 빈 인용문헌 케이스를 비표준으로 인식할 위험.
**왜 문제인가:** few-shot 효과로 LLM이 통지서의 §42 조항을 §29로 바꿔 출력하거나 cited_refs를 가짜로 채우는 환각이 가능. 이후 type 단계의 분류 근거가 오염.
**영향:** 시나리오 D에서 type 단계 입력이 왜곡 → §42를 §29로 오분류 → fallback 없이도 inventive_step 분기 발생 가능.
**개선 방향:** schema 예시에 3가지 거절유형 사례 모두 포함:
- `{claim_nos:[1], article:"§29②", reason:"진보성", cited_refs:["인용문헌1"]}`
- `{claim_nos:[1,2,3], article:"§42② 1호 또는 §42④ 1호", reason:"명확성 흠결", cited_refs:[]}`
- `{claim_nos:[2], article:"§42② 4호 또는 §42④ 2호", reason:"뒷받침 흠결", cited_refs:[]}`

### 발견 #4 (계약 위반)

### [P1] 분석 단계 description_deficiency 출력에 §42 1호/4호 분리 없음
**위치:** opinion.js L1188-L1191 (description_deficiency 분석 prompt)
**증거:**
```js
description_deficiency:'위 의견제출통지서의 기재불비 지적사항을 분석하세요.\n\n'
  +...
  +'JSON:\n{"discussion":[{"role":"심사관","text":"..."},{"role":"변리사","text":"..."}],\n
   "items":[{"claim_no":N,"deficiency_type":"unclear|inconsistent|unsupported",
            "examiner_comment":"심사관 지적 원문","spec_reference":"【0001】등 관련 단락",
            "suggested_correction":"구체적 수정 문언 제안"}]}',
```
`deficiency_type: unclear|inconsistent|unsupported` — 명확성(§42② 1호) ↔ 뒷받침(§42② 4호 또는 §42④ 2호)이 어느 enum에 매핑되는지 불명. LLM이 자유 분류 → 후속 보정/의견서가 두 조문을 혼동.
**왜 문제인가:** 명확성 흠결과 뒷받침 흠결은 보정 전략이 다르다.
- 명확성: 청구항 문언을 명확화 (권리범위 보존)
- 뒷받침: 청구항 문언이 명세서 기재 범위 내로 축소 (권리범위 축소 가능)
한 의견서에서 두 조문을 같은 논리로 다루면 심사관이 "지적 미해소"로 거절 유지.
**영향:** 시나리오 D의 의견서가 두 조문에 대해 동일한 변명문을 반복 → 즉시 제출 부적합.
**개선 방향:** `deficiency_type: clarity|support|description_lack|inconsistent` + 각각에 KIPO 조문 매핑 명시. 의견서 prompt도 조문별 별도 섹션 강제.

### 발견 #5 (계약 위반)

### [P1] startDraft에 검증 결과가 응답에 포함될 때만 저장 — 누락 시 별도 startValidation 호출하나 그 결과의 element_text는 "검증 항목"만 표시
**위치:** opinion.js L1666-L1686, L1706-L1714
**증거:**
```js
// L1666-1686
if (dr.validation) {
  Opinion.state.validation = dr.validation;
  await sb.from('opinion_validation_results').insert({...,result_data:dr.validation,summary:dr.validation.summary||{}});
}
await sb.from('opinion_draft_claims').insert({project_id:p.id,draft_type:t,draft_data:dr,status:'draft'});
...
if (dr.validation) { await Opinion.setStatus(p.id,vs); ... }
else { await Opinion.setStatus(p.id,dd); ... await Opinion.startValidation(); }
```
한 LLM 응답에 보정 청구항 + 5중 검증 결과를 모두 담도록 prompt 작성 (L1644). 그러나 LLM이 길이 제한이나 형식 문제로 validation 키를 생략하면 자동으로 startValidation을 별도 호출. 별도 호출 시 prompt(L1706)에는 "위 보정 청구항 초안을 명세서 원문과 대조하여" 라고 적혀 있으나, 실제 ctx에는 명세서 원문이 직접 들어가지 않음 (parsed의 raw_text 8K만, 명세서가 그 안에 있을지 보장 없음).
**왜 문제인가:** 별도 검증 호출에서 명세서 원문 미포함 시 LLM은 명세서를 보지 못한 채 "검증 결과"만 만들어냄 → 환각 검증.
**영향:** spec_support 검증이 의미 없는 pass 응답 → 신규사항 추가 위험을 잡지 못함.
**개선 방향:** startValidation의 ctx에 명세서 원문(specification 역할 파일)을 명시적으로 잘라 주입. 또는 startDraft 단일 응답으로 검증까지 강제 통합 (validation 누락 시 재시도).

---
**CHUNK 1 완료.** 발견: P0 2 / P1 3 / P2 0. 다음 청크(2) 진행하려면 "다음" 입력.
