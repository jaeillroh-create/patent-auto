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
**CHUNK 1 완료.** 발견: P0 2 / P1 3 / P2 0.

---

## CHUNK 2/7 — Axis A 후반: Gate 실효성·파서 견고성·오염 방어·fallback 처리

[누적 카운트: P0 2 / P1 3 / P2 0]

### 발견 #6 (계약 위반)

### [P1] Gate 1·2·3 모두 실제 차단 조건 없음 — 검증 실패 상태에서도 무조건 통과
**위치:** opinion.js L1507-L1537 `Opinion.approveGate`
**증거:**
```js
// L1507-1537 — Gate 전체 로직
Opinion.approveGate = async function(gn){
  var p=Opinion.state.current;if(!p)return;var type=p.rejection_type,next;
  if(gn===1){
    next=type==='description_deficiency'?'correction_confirmed':...;
    var radioEl = document.querySelector('input[name="opinionStrategy"]:checked');
    if(radioEl && type==='inventive_step') {
      var idx = parseInt(radioEl.value,10);
      Opinion.state.selectedStrategy = extracted.strategies[idx] || null;
    }
    // ★ radioEl이 null이어도(전략 미선택) 차단하지 않음
  }
  else if(gn===2){ next='claims_confirmed'; } // ★ 검증 실패 항목 수 체크 없음
  else if(gn===3){ next='approved'; }         // ★ 의견서 sections 길이 체크 없음
  ...
  await Opinion.startDraft();  // 전략 null인 채로 보정 시작 가능
```
**Gate별 누락 차단 조건:**
| Gate | 원래 목적 | 실제 차단 조건 |
|------|----------|--------------|
| Gate 1 | 전략 확정 | 전략 radio 미선택 시 비차단. `selectedStrategy`=null로 진행 |
| Gate 2 | 보정 청구항 확정 | `validation.elements` 중 fail 건수 무관 통과 |
| Gate 3 | 의견서 최종 확인 | `opinionDraft.sections` 빈 배열이어도 통과 |

**왜 문제인가:** Gate 1에서 전략이 선택되지 않으면 `Opinion.state.selectedStrategy`가 null로 유지된다. `getContext()`(L1571)는 `if(Opinion.state.selectedStrategy)` 분기로 전략 컨텍스트를 선택적으로 주입하므로, null이면 전략 없이 보정 프롬프트가 실행된다 → LLM이 임의로 전략을 결정. Gate 2에서는 validation.fail 항목이 있어도 의견서 작성이 시작되어, 신규사항 추가 위험이 있는 보정안이 의견서 본문에 그대로 인용된다.
**영향:** Gates가 UI 장식으로만 기능. "검증 fail → 사용자 확인 → 통과 차단" 안전망이 실질적으로 존재하지 않음.
**개선 방향:**
- Gate 1: `if(type==='inventive_step' && !radioEl) { showToast('전략을 선택해 주세요','error'); return; }`
- Gate 2: `var fails=(Opinion.state.validation?.elements||[]).filter(e=>e.checks?.some(c=>c.result==='fail')); if(fails.length>0 && !confirm('검증 실패 '+fails.length+'건을 확인하셨나요?')) return;`
- Gate 3: `if(!(Opinion.state.opinionDraft?.sections?.length>0)){ showToast('의견서가 없습니다','error'); return; }`

---

### 발견 #7 (상태 관리)

### [P2] `Opinion.usage` 프로젝트 전환 시 미초기화 — 호출 횟수 누산
**위치:** opinion.js L742 (선언) / L467 (`openProject` 내 loadData 호출, usage 미리셋 없음)
**증거:**
```js
// L742 — 모듈 최상단, 파일 로드 시 1회만 초기화
Opinion.usage = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };

// L461-467 — 프로젝트 전환 시
Opinion.openProject = async function(id) {
  var p = Opinion.state.projects.find(...);
  Opinion.state.current = p;
  await Opinion.loadData(id);
  // ★ Opinion.usage 초기화 없음
};

// L2270 — callForJSON 내부
Opinion.usage.calls++;
// L1842 — startOpinionDraft 직접 호출 (callForJSON 우회)
Opinion.usage.calls++;
```
**왜 문제인가:** 세션 중 프로젝트 A(3회) → 프로젝트 B(2회) 처리 시 B의 카운터는 5회로 표시. UI의 "API: 5회" 표시는 현재 프로젝트 비용이 아닌 세션 누산값. 사용자가 비용 과다를 오인할 수 있고, 추후 호출 횟수 기반 제한 로직 추가 시 오동작.
**영향:** UI 신뢰도 저하. 실비용 추정 불가.
**개선 방향:** `Opinion.openProject` 또는 `Opinion.loadData` 진입부에 `Opinion.usage = { calls:0, inputTokens:0, outputTokens:0, cost:0 };` 한 줄 추가.

---

### 발견 #8 (출력 파서)

### [P1] `parseOpinionSections` — `##`/`###`만 인식, 필수 섹션 검증 없음
**위치:** opinion.js L1870-L1915
**증거:**
```js
// L1881 — 섹션 구분 패턴
var headingMatch = line.match(/^#{2,3}\s+(.+)/);
```
인식 범위: `##`(레벨2), `###`(레벨3)만. `#`(레벨1), `####`(레벨4), 한국 법률 문서에서 흔한 `1.`, `가.`, `(1)` 형식의 제목은 섹션 경계로 인식하지 않음.

LLM 응답에서 발생하는 두 가지 실패 모드:
1. **레벨1 헤더 사용:** `# 서두` → `sections=[]` → 전체 텍스트가 단일 섹션으로 뭉쳐짐
2. **마크다운 미사용 응답:** `1. 보정내용` → 역시 단일 섹션. `downloadDocx`(L2072-2083)는 sections 배열로 문서를 조립하므로, 섹션 분리 실패 시 구조 없는 벽 텍스트가 단일 단락으로 Word 출력됨.

필수 섹션 검증 없음: `parseOpinionSections`는 섹션 수/제목을 체크하지 않는다. 의견서에 "서두", "보정내용", "구체적 의견내용", "결론"이 모두 있어야 KIPO 제출 형식에 맞지만 이를 코드 레벨에서 보장하지 않음.
**영향:** 포맷이 틀린 LLM 응답을 파싱 성공으로 간주 → 구조 없는 의견서가 사용자에게 제공됨. 변리사가 Word를 열기 전까지 발견 불가.
**개선 방향:**
```js
// parseOpinionSections 후 필수 섹션 검증
var headings = od.sections.map(function(s){return s.heading;});
var required = ['서두','보정내용','의견내용','결론'];
var missing = required.filter(function(r){ return !headings.some(function(h){ return h.indexOf(r)>=0; }); });
if (missing.length>0) showToast('의견서 섹션 누락: '+missing.join(', '),'error');
```

---

### 발견 #9 (오염 방어)

### [P2] `validateNoTemplateContamination` — 경고만, 비차단. 안전 구절 목록이 도메인 용어를 광범위 면제
**위치:** opinion.js L337-L381 / L1850-L1856 (호출 시점)
**증거:**
```js
// L1850-1856 — 호출 결과 처리
var check = Opinion.validateNoTemplateContamination(fullText);
if (check.warnings.length > 0) {
  od._contamination_warnings = check.warnings;
  showToast('⚠️ 참고 양식 내용 일부가 포함된 것으로 보입니다. 검토해 주세요.', 'info');
}
// ★ 차단 없음. od는 DB에 그대로 저장됨.
```

**SAFE_PHRASES 과다 면제 문제(L345-L349):**
```js
var SAFE_PHRASES = [
  '의견을 제출합니다','특허등록되어야','신규사항에 해당하지','보정의 적법성',
  '보정내용','구체적 의견내용','결론','서두','소결','기술적 요지',
  '인용발명','본원발명','구성요소','결합의 용이성','명세서에 기재된 범위'
];
```
`'인용발명'`, `'본원발명'`, `'구성요소'`는 단독 키워드로 SAFE 처리된다. 참고 양식에 "**인용발명** 갑호증의 A 구성은 X이고 B 구성은 Y이다"와 같이 실제 인용발명 내용이 들어 있어도, `indexOf('인용발명') >= 0`이면 해당 문장 전체가 면제된다. 결과적으로 양식의 사건별 내용(인용발명 분석, 구성요소 설명)이 의견서에 그대로 복사되어도 경고를 생성하지 않을 수 있다.
**영향:** 최악 시나리오: 이전 사건의 인용발명 분석문이 새 사건 의견서에 등장해도 무음 통과. 실무에서 오사건 내용 혼입 → 의견서 기각.
**개선 방향:** SAFE_PHRASES에서 단독 도메인 명사(`'인용발명'`, `'본원발명'`, `'구성요소'`) 제거. 이 단어들은 어떤 의견서에도 등장하므로 면제 기준으로 적합하지 않음. 대신 순수 연결어/서식어만 면제.

---

### 발견 #10 (오염 방어)

### [P2] `sanitizeTemplate` — 60자 내 styleExample이 특정 사건 내용을 포함할 수 있음
**위치:** opinion.js L295-L334
**증거:**
```js
// L312-315
else if (trimmed.length > 10 && trimmed.length < 80) {
  if (/^(이상과 같이|상기|따라서|그러므로|살펴보면|검토하면|대비하면|종합하면|결론적으로|이에|아래와 같이|상기 출원|수령하였기에)/.test(trimmed)) {
    styleExamples.push(trimmed.slice(0, 60));
  }
}
```
`"따라서"`, `"상기"`로 시작하는 문장은 60자까지 styleExample로 수집된다. 예시:
- `"따라서 인용발명1의 탄소나노튜브 정렬 공정은 본원발명의 X 구성과 다르다"` → 60자 이내이면 template으로 전달.
- `"상기 청구항 1의 'A 장치를 이용하여 B를 수행하는 단계'는 명세서 단락 [0045]에 뒷받침된다"` → 역시 60자 내 가능.

이렇게 수집된 styleExample은 opinion prompt의 `[참고 의견서 양식]` 블록에 포함되어 LLM에 전달된다. LLM이 톤 참고 용도로 제공된 이 예시 문장의 특정 내용(탄소나노튜브, A 장치, [0045])을 의견서 본문에 반영하면 오사건 내용 혼입이 발생한다.
**영향:** `TEMPLATE_GUARD`(L1789) 경고문과 함께 프롬프트에 들어가지만, LLM이 "참고 양식 내용은 절대 사용 금지"와 "styleExample로 제공된 문장을 참고하여 문체 구성" 사이에서 혼동할 수 있음.
**개선 방향:** styleExamples 수집 기준을 20자 이하의 순수 접속부사/관용구로 제한. 또는 styleExamples를 완전히 제거하고 structurePatterns만 남김.

---

### 발견 #11 (계약 위반)

### [P1] 한국 특허법 §29 / §42 외 조문 거절이유 → `inventive_step` 무음 fallback
**위치:** opinion.js L10-L14 (`Opinion.TYPES`) / L1088 (type 결정)
**증거:**
```js
// L10-14
Opinion.TYPES = {
  inventive_step:         { code:'A', label:'진보성/신규성 위반', law:'§29①②' },
  description_deficiency: { code:'B', label:'기재불비 위반',      law:'§42③④' },
  partial_rejection:      { code:'C', label:'일부 청구항 거절',   law:'§29 등' }
};
```
시스템에 등록된 거절유형: 3개뿐. KIPO 실무에서 자주 출원되는 나머지 조문:

| 조문 | 내용 | 대응 없음 |
|------|------|----------|
| §32 | 불특허 발명 (핵공학 등) | ✗ |
| §33 | 무권리자 출원 | ✗ |
| §36 | 선출원 위반 | ✗ |
| §45 | 단일성 위반 | ✗ |
| §62 각호 | 거절결정 | ✗ |

`determineType`(L1087-L1089)의 LLM 응답에서 `primary_type`이 'inventive_step' / 'description_deficiency' / 'partial_rejection' 외 값을 반환하면:
```js
// L1088 — 3가지 TYPES 밖의 값도 그대로 DB에 저장됨
p.rejection_type = tr.primary_type || 'inventive_step';
// L519 이하 — PIPELINE은 fallback
var type = p.rejection_type || 'inventive_step';
```
`Opinion.TYPES[p.rejection_type]`이 undefined가 되면 L413에서 `{code:'?',label:'미정',css:'type-unknown'}` fallback. 그러나 분석/보정/의견서 prompt selector(L1169, L1605, L1803)는 단순 문자열 비교로 분기하므로, 알 수 없는 type은 어떤 prompt 분기에도 해당하지 않아 undefined prompt가 주입됨. 실제 실행 시 LLM에 빈 프롬프트 또는 undefined 문자열이 들어갈 수 있음.
**영향:** §45 단일성 위반 통지서를 입력하면 의견서 전체가 진보성 법리로 작성될 위험.
**개선 방향:**
1. `determineType` 응답이 알 수 없는 type이면 `showToast('거절유형 미지원: '+tr.primary_type+' — 수동 선택','error')` + type override UI 자동 펼침
2. prompt selector에 `else { throw new Error('지원하지 않는 거절유형: '+type); }` 추가

---

### 발견 #12 (견고성)

### [P2] `setStatus` catch가 예외를 삼킴 — DB 실패 시 메모리·DB 불일치
**위치:** opinion.js L2151
**증거:**
```js
// L2151 — 원라인 압축
Opinion.setStatus=async function(id,s){
  try{
    await sb.from('opinion_projects').update({status:s,...}).eq('id',id);
    var p=Opinion.state.current;
    if(p&&p.id===id) p.status=s;          // ★ DB 성공 확인 전에 메모리 갱신
    Opinion.state.projects.forEach(function(x){if(x.id===id)x.status=s;});
  }catch(e){
    console.error('[Opinion] status:',e);  // ★ re-throw 없음
  }
};
```
코드 흐름: DB update → 예외 발생 → catch에서 로그만 → 함수 정상 반환 (Promise 이행). 호출자는 await 후 예외를 받지 못함. 메모리는 이미 갱신되었으나 DB는 이전 상태. 이후 `loadData`로 재로드 시 DB 값으로 덮어써지나, 로드 전 사용자가 버튼을 클릭하면 잘못된 상태로 다음 단계가 시작됨.
**영향:** 네트워크 단절이나 Supabase RLS 오류 시 무음으로 상태 불일치 발생. 디버깅 시 메모리(진행)와 DB(이전 상태)가 달라 재현 불가.
**개선 방향:** `catch(e){ console.error('[Opinion] status:',e); throw e; }` — re-throw로 호출자가 `showToast` 오류 처리를 수행하도록 함.

---

**CHUNK 2 완료.** 발견: P0 0 / P1 3 / P2 4. **누적: P0 2 / P1 6 / P2 4.**

---

## CHUNK 3/7 — 시나리오 P (§29② 진보성): 동적 흐름 추적 + 도메인 품질 + 4축 점수

[누적 카운트: P0 2 / P1 6 / P2 4]

### 시나리오 P 입력 전제
```
본원:   청구항 6개 (1·3·5 거절 / 2·4·6 미거절)
인용발명: 인용문헌1, 인용문헌2 (조합 거절 §29②)
파일 역할: notification, specification, cited_ref×2
```

### P-흐름 1 — 파싱 (L913-L949)

파싱 prompt의 schema 예시가 `article:"§29②"`만 제시하므로 진보성 통지서에서는 §29 분기에 유리하게 작동. `rejection_reasons`에 `{claim_nos:[1,3,5], article:"§29②", cited_refs:["인용문헌1","인용문헌2"]}` 정상 구조화 예상.

단, `citedRefGuide`(인용문헌 역할 파일)가 별도로 분리되어 prompt에 주입(L920-L926)되므로, 인용발명 내용이 파싱 단계에서 이미 컨텍스트에 포함된다. 이는 **진보성 시나리오에서의 강점** (인용발명과 본원 대비 가능).

**관찰:** 파싱 후 `opinion_parsed_documents.parsed_data`에 청구항 전문(`claims:[]`)이 저장되어야 하나, 파싱 prompt(L914-L928)의 JSON schema에 `claims` 필드가 있음. 그러나 LLM이 6개 청구항 전문을 모두 생성하지 않으면 3·5번이 독립항인지 종속항인지 이후 단계에서 판단 불가.

---

### P-흐름 2 — 유형 판별 (L1047-L1093)

정상 케이스: `tr.primary_type='inventive_step'` → `p.rejection_type='inventive_step'`. 이후 PIPELINE 전체가 inventive_step 분기로 흐름.

비정상 케이스(CHUNK 1 발견 #2): JSON 파싱 실패 시 `'inventive_step'` silent fallback. 진보성 통지서에서는 fallback이 맞는 방향이지만, LLM 실패를 사용자가 인지하지 못함.

---

### P-흐름 3 — 전략 분석 (L1170-L1187)

분석 prompt가 요구하는 출력:
- `elements[]`: 각 구성요소별 인용발명 대비, `non_obviousness_argument` 포함
- `strategies[]`: 2~3개 보정 전략, `spec_paragraphs` 포함
- `cited_references[]`: 인용발명 요약

**흐름 Gap #1:** `strategies[].spec_paragraphs`가 LLM 응답에서 빈 배열 `[]`로 반환되어도 Gate 1 통과 가능 (발견 #6). 전략 근거 단락이 없는 채로 보정 단계 진입.

---

### P-흐름 4 — 보정 청구항 작성 (L1606-L1644)

#### [P1] 독립 청구항 1항 한정 보정의 맹점 — 거절된 청구항 3·5가 독립항이면 미처리
**위치:** opinion.js L1612
**증거:**
```js
// L1612-1613
+'1. 독립 청구항 1항만 보정하세요. 독립항이 보정되면 종속항은 당연히 신규성/진보성이 인정되므로 종속항 보정은 불필요합니다.\n'
+'2. 단, 종속항 중 거절이유에서 별도로 지적된 것이 있으면 그것만 추가 보정하세요.\n'
```
시나리오 P에서 청구항 1·3·5가 거절됨. 이 prompt는 **청구항 3·5가 청구항 1의 종속항**이라고 가정한다. 만약 파싱 결과에서 청구항 3이 독립항이면:
- 심사관은 청구항 3을 청구항 1과 독립적으로 거절
- 청구항 1 보정으로는 청구항 3의 거절이유 해소 불가
- 그러나 prompt는 "종속항은 자동 인정" 가정으로 청구항 3·5 보정을 생략하도록 유도
- 결과: 청구항 3·5 거절이유 미해소 의견서 제출 위험

코드 레벨에서 파싱 결과의 청구항 구조(독립/종속 여부)를 확인하여 보정 범위를 결정하는 로직이 없다. `claims[]` 파싱 데이터가 있어도 prompt builder(L1600)에서 이를 활용하지 않는다.

**영향:** 진보성 통지서에서 청구항 1 외 독립항이 별도 거절된 경우 (한국 출원에서 드물지 않음), 의견서로 청구항 1만 해소 → 다음 OA에서 청구항 3·5 재거절.

---

### P-흐름 5 — 의견서 작성 (L1804-L1822)

#### [P1] 사후적 고찰(hindsight bias) 반박 논거 누락
**위치:** opinion.js L1820
**증거:**
```js
// L1820 — "결합의 용이성에 대한 반박" 섹션 지시
+'### (4) 결합의 용이성에 대한 반박\n'
+'(① 결합 동기 부재 ② 기술 분야의 상이 ③ 현저한 효과 — 각각에 구체적 기술적 근거 제시)\n'
```
제공된 반박 논거 3가지: **결합 동기 부재 / 기술 분야의 상이 / 현저한 효과**.

KIPO 진보성 심사 실무에서 필수적인 **사후적 고찰 차단 논거**가 없다:
- 한국 특허법원 판례(2019허7688 등): "심사관의 결합 자명성 판단은 본원 발명을 알고 난 후의 사후적 고찰에 기인한다"
- 출원일 당시 당업자의 시점에서의 결합 비자명성을 주장해야 함
- KSR 법리(미국)에서도 "hindsight reconstruction" 차단이 핵심 논변

"결합 동기 부재"는 사후적 고찰과 관련되나 동일하지 않다. 별도 섹션으로 "본원 발명 출원일 당시 당업자가 인용발명들을 결합할 이유가 없었음 → 결합을 시도한 것 자체가 사후적 고찰"이라는 논변 전개가 실무적으로 요구된다.

**영향:** 생성된 의견서가 KIPO 심사관에게 "표준 논변" 없이 제출 → 거절 유지 위험 증가.

---

### P-흐름 6 — 출력 (L2030-L2113)

#### [P0] 보정서(補正書) 별도 출력 없음 — 의견서 내 대비표만 존재
**위치:** opinion.js L2065-L2076, L2106-L2112
**증거:**
```js
// L2065-L2076 — downloadDocx type 분기
if(type==='opinion'||type==='all') {
  // 의견서 HTML 생성
}
if(type==='all') {
  // 검증보고서 HTML 추가
}
// ★ type==='amendment' (보정서) 분기 없음
```
`downloadDocx`가 생성하는 문서: **의견서** + **검증보고서**. 보정서(補正書, 특허법 시행규칙 별지 제13호 서식) 별도 출력 없음.

**한국 특허 실무 요건:**
- KIPO 제출 시 의견서(意見書)와 보정서(補正書)는 **별도 서류**로 제출
- 보정서는 특정 양식(출원번호, 보정서류명, 보정 전·후 대비표, 제출인 날인)이 요구됨
- 현재 시스템은 의견서 "## 1. 보정내용" 섹션에 보정 내용이 기술되지만, KIPO 제출용 보정서 양식이 아님

**영향:** 사용자가 다운로드한 .doc 파일로는 KIPO에 보정서를 직접 제출 불가. 변리사가 별도로 KIPO 보정서 양식을 작성해야 함. 시스템의 "즉시 제출 가능" 가정이 오도적.

이 발견을 P0으로 분류하는 이유: 사용자가 생성된 파일만으로 KIPO에 제출할 수 없음에도 시스템이 "완료"로 표시하며 파일을 제공. 사용자가 제출 절차를 모른다면 보정서 없이 의견서만 제출하는 치명적 실수 가능.

---

### 시나리오 P — 4축 출력 점수

| 축 | 점수 | 주요 근거 |
|----|------|---------|
| 자동 흐름 완전성 | 🟡 60/100 | Gate 1 전략 미선택 비차단. spec_basis LLM 자기증언. 단, inventive_step 분기 자체는 존재 |
| 도메인 정확성 | 🟠 50/100 | 사후적 고찰 논거 누락. 청구항 3·5 독립항 케이스 미처리. 결합 용이성 반박은 3항목 제공되나 hindsight 없음 |
| 출력 즉시 제출 가능성 | 🔴 30/100 | 보정서 별도 출력 없음. 의견서는 생성되나 KIPO 제출 패키지 미완성 |
| 법리 완전성 | 🟡 55/100 | §29② 논변 구조는 있으나 사후적 고찰 차단 누락. §47③ 신규사항 검증은 LLM 자기증언에 의존 |

**시나리오 P CHUNK 3 신규 발견:**
- 발견 #13 [P1]: 독립 청구항 1항 보정 한정 — 3·5가 독립항이면 미처리
- 발견 #14 [P1]: 사후적 고찰 반박 논거 누락
- 발견 #15 [P0]: 보정서 별도 출력 없음

**CHUNK 3 완료.** 발견: P0 1 / P1 2 / P2 0. **누적: P0 3 / P1 8 / P2 4.** 다음 청크(4) 진행하려면 "다음" 입력.
