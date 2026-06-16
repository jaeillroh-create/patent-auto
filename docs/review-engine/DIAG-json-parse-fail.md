# 진단 — examiner_B·C recheck JSON 파싱/검증 실패 (잘림 아님, 형식 문제)

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-json-parse-fail` · **코드 수정 0(진단 문서만)**
> 로그 확정: examiner_C(truncated:false, end_turn, ot:4926, textLen:5982), examiner_B(truncated:false, end_turn, ot:3393, textLen:6631)
> → 모델이 **정상 종료(end_turn) + 충분한 출력**인데 JSON 단계 실패. **#161(max_tokens 잘림)과 다른 층위**.

---

## 0. 결론 (3줄)

1. **#161과 다름**: #161은 `stopReason=max_tokens`(생성 길이 부족 → JSON 중간 절단). 이번은 `end_turn`+긴 출력 → **출력 "형식/모양" 문제**(생성은 끝까지 됨). 재시도 시 maxTokens 상향(runAgent.js:130)은 이번엔 무효(잘림이 아님).
2. **실패 지점은 둘 중 하나**(runAgent.js:84-90). `errors` 값으로 즉시 갈린다 — 그리고 **그 `errors`는 이미 Supabase 함수 로그에 찍혀 있다**(runAgent.js:128 → edge console.log:140).
   - (A) `extractJson` 가 **null** 반환 → `errors=['JSON 파싱 실패(빈/비정형 응답)']`. 출력에 파싱 가능한 균형 JSON이 없음(가장 흔한 원인: **긴 note 안의 이스케이프 안 된 큰따옴표**, trailing comma, 주석, 배열/프로즈 래핑).
   - (B) `extractJson` 성공했으나 **스키마 검증 실패** → `errors`에 스키마 메시지. 주원인: **Verdict 항목 `additionalProperties:false`** 가 Claude의 여분 필드를 거부.
3. **discover는 되고 recheck만 깨지는 이유**가 구조에 있다: **IssueList 항목은 `additionalProperties:true`(관용), Verdict 항목은 `false`(엄격)**. 게다가 **스키마가 kernel이 실제로 읽는 필드를 금지**하는 불일치까지 있다(아래 §3).

---

## 1. #161과의 차이 (잘림 vs 형식) — 코드로 확정

`callOnce`(runAgent.js:79-90):
```
const parsed = extractJson(r.text);
if (!parsed) {
  const truncated = r.stopReason === 'max_tokens';          // ← #161 경로
  return { ok:false, truncated,
    errors:[ truncated ? '출력 토큰 한도 초과(잘림)…' : 'JSON 파싱 실패(빈/비정형 응답)' ], raw:r };
}
const v = validate(schema, parsed);                          // ← 이번 경로(형식/스키마)
return { ok:v.ok, errors:v.errors, data:parsed, raw:r };
```
- 로그가 `truncated:false, stopReason:end_turn` → `r.stopReason !== 'max_tokens'` → **잘림 경로 아님**. 따라서 실패는 (A) extractJson null(파싱) 또는 (B) validate 실패(스키마) 둘 중 하나다.
- 재시도(runAgent.js:130): `retryMax = res.truncated ? 16000 : agent.maxTokens` — **잘림이 아니므로 maxTokens 안 올리고 같은 한도로 "엄격 준수" 지시만 재전송**. 모델이 같은 형식 습관을 반복하면 재시도도 실패 → `SchemaEscalateError`(133) → **그 에이전트만 격리**(allSettled, runAgent.js:181) → recheck가 B·C verdict를 잃음 → 해당 issue가 `remaining`으로 남아 수렴 약화.

---

## 2. extractJson 관용성 한계 (runAgent.js:35-55) — (A) 경로

```
const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) s = fence[1].trim();  // 펜스 1개 처리
const start = s.indexOf('{'); if (start < 0) return null;                                // '{' 필요
… 균형 스캔(문자열 inStr/esc 추적) … JSON.parse(slice) 실패 시 catch→null               // 단일 parse, 복구 없음
```
- ✅ 처리됨: ```json 펜스, `{` 앞 프로즈("다음은 결과:"), `}` 뒤 프로즈(균형에서 멈춤).
- ❌ 못 건지는 패턴(end_turn 완전 출력인데 null 되는 실제 원인 후보):
  1. **이스케이프 안 된 큰따옴표(최유력, ot 큼)**: recheck `note`는 법리 프로즈라 길고(예: `청구항 "동적 가중부"는…`), 모델이 내부 `"`를 이스케이프 안 하면 — (ⓐ) 균형 스캐너의 `inStr` 추적이 조기 종료되어 depth 오계산 → 엉뚱한 slice, (ⓑ) JSON.parse 실패 → **null**. ot=4926(C)·textLen 5982가 "긴 note" 가설과 정합.
  2. **trailing comma / 주석(`//`) / 단일따옴표 키·값**: JSON.parse 실패 → null.
  3. **top-level 배열** `[{…}]`(verdicts 래퍼 없이 배열만): `indexOf('{')`가 배열 내부 첫 객체를 잡아 **단일 verdict만** 반환 → §3의 스키마에서 `verdicts` 필수 누락으로 (B) 실패.
  4. **프로즈 안의 `{`**(예: 집합표기 `{i1, i2}`, 남은 `{기술분야}` 류)를 먼저 잡아 그 지점부터 파싱 → 실패 → null.
- extractJson은 **단일 JSON.parse + 복구 없음**이라, 위 패턴에 약하다(첫 균형 객체 하나만 시도).

---

## 3. ★ 스키마 비대칭 + 스키마-소비자 불일치 — (B) 경로 (discover↔recheck 차이의 정체)

| | top-level | item-level | 의미 |
|---|---|---|---|
| **IssueList**(discover) | `additionalProperties:false` (IssueList.js:13) | **`true`** (IssueList.js:20) | issue 항목에 **여분 필드 허용** → Claude가 필드 더 붙여도 통과 |
| **Verdict**(recheck) | `additionalProperties:false` (Verdict.js:14) | **`false`** (Verdict.js:21) | verdict 항목에 **여분 필드 금지** → 하나만 더 붙어도 거부 |

- 검증기(schemaValidate.js:23-26)는 `additionalProperties:false`에서 **허용목록 밖 키마다 에러**를 쌓는다.
- recheck 입력에 **`targetIssue`(id/type/target/description)가 주입**된다(runAgent.js:68). Claude가 verdict에 그 `type/target/severity/legalBasis`를 **echo**하거나, wrapper에 `summary/consensus`를 붙이면 → **여분 키 거부 → (B) 실패**. discover는 항목 `true`라 같은 습관도 통과 → **이것이 "discover OK, recheck FAIL"의 구조적 원인**.
- **★ 스키마-소비자 불일치(독립 결함)**: orchestrator는 regression verdict에서 **`v.severity·v.type·v.target·v.legalBasis·v.coreElement·v.id`를 읽는다**(orchestrator.js:213):
  ```
  const reg = { … severity: v.severity||'high', type: v.type||'regression',
                target: v.target||issue.target, legalBasis: v.legalBasis||'',
                coreElement: v.coreElement, id: v.id|| … , regressionOf: v.regressionOf||issue.id };
  ```
  그런데 Verdict 스키마는 **issueId·result·note·regressionOf만 허용**(나머지 금지). 즉 **kernel이 필요로 하는 필드를 스키마가 거부**한다 — 모델이 (올바르게) regression 근거 필드를 채우면 오히려 검증 탈락. 이건 단순 파싱 문제를 넘어선 **계약 버그**.

> 참고(왜 하필 B·C, 그리고 Claude 단독): 에이전트 정의 기본은 examiner_B=Gemini, examiner_C=GPT로 **그 모델에 맞춰 .md가 튜닝**돼 있는데, "1키 전역"으로 **6역할이 Claude로 강제**(common.js 규칙)되어 Claude의 출력 습관(여분 필드/프로즈/따옴표)이 가장 엄격한 recheck(Verdict)에서 드러난 것. 멀티프로바이더면 B·C가 설계대로 Gemini·GPT로 가 형식 드리프트가 줄 수 있으나, 사용자는 Claude 단독 유지 → **스키마/프롬프트 측 수정이 정답**.

---

## 4. ★ 실제 응답을 보는 법 (로깅)

1. **지금 당장(코드 0)**: schema_retry 이벤트는 **이미 `errors`를 포함**(runAgent.js:128)하고 edge가 `console.log('[review-engine event]', …)`로 출력한다(review-orchestrate.ts:140). **Supabase 대시보드 → Edge Functions → review-orchestrate → Logs**에서 `kind:"schema_retry"` 이벤트의 **`errors` 배열**을 확인하면 즉시 (A)/(B) 판별:
   - `errors:["JSON 파싱 실패(빈/비정형 응답)"]` → **(A) extractJson null** (§2: 따옴표/trailing comma/배열/프로즈).
   - `errors:["$.verdicts[0].type: 허용되지 않은 추가 필드…"]` 류 → **(B) 스키마 위반**(§3: 여분 필드).
   - `errors:["$.verdicts: 필수 필드 누락"]` / `"$: object 기대, 실제 array"` → **(A의 3) 배열/래퍼 누락**.
2. **더 정밀(코드 0 — 제안)**: schema_retry 이벤트에 **응답 원문 앞/뒤 토막**을 추가하면 정확한 결함이 눈에 보인다. runAgent.js:128 한 줄 확장 제안:
   ```js
   deps.onEvent && deps.onEvent({ kind:'schema_retry', agent: agent.id, errors: res.errors,
     truncated: !!res.truncated, stopReason: res.raw?.stopReason, ot: res.raw?.ot,
     textLen: (res.raw?.text||'').length,
     head: (res.raw?.text||'').slice(0,300),                 // ← 추가: 시작 300자(프로즈/펜스/배열 즉시 식별)
     tail: (res.raw?.text||'').slice(-160) });               // ← 추가: 끝 160자(trailing comma/잘린 따옴표 식별)
   ```
   ⚠️ 프라이버시: head/tail은 **사건 분석 텍스트**(키·시크릿 아님)지만 의뢰인 내용이므로, 진단 후 제거하거나 길이를 줄이는 게 안전.

---

## 5. 해결책 (수정 안 함 — 권고)

| 우선 | 대상 | 조치 | 효과 |
|---|---|---|---|
| ★1 | **Verdict.js** | item-level `additionalProperties:false → true`(IssueList와 동형). top-level은 유지 가능 | (B) 즉시 해소 + **kernel이 읽는 severity/type/target/legalBasis 허용**(스키마-소비자 불일치 해소). 가장 견고 |
| ★2 | **runAgent.js extractJson** | (i) 먼저 `JSON.parse(s)` 통째 시도, (ii) `{` 없거나 실패 시 **`[` 배열 폴백**, (iii) **trailing comma 제거** 후 재시도, (iv) 펜스 우선 | (A) 상당수 흡수(배열/트레일링콤마/프로즈). 단, **이스케이프 안 된 따옴표**는 정규식 복구가 위험 → 프롬프트로 차단 |
| 3 | **examiner_B/C.md** §8 | "verdicts 항목에 issueId·result·note·regressionOf **외 키 금지**(추가 키 거부됨)", "targetIssue의 type/target/severity/legalBasis를 **다시 쓰지 마라**", "note 안 **큰따옴표 금지**(필요시 「」), 줄바꿈 금지, **순수 JSON·코드펜스 금지**" | (A)·(B) 재발 억제(LLM 드리프트 보강). 단독으로는 불완전 → 스키마/코드와 병행 |
| 4 | **logging** | §4-2 head/tail 추가 | 원인 확정·재발 감시 |

- **권장 조합**: 먼저 **§4-1로 errors 확인** → (B)면 **★1(Verdict 스키마 완화)** 가 정답이자 계약 정합, (A)면 **★2(extractJson 강화)+프롬프트 따옴표 차단**. 양쪽 다 대비하려면 **★1 + ★2 + 프롬프트**를 함께. (★1은 스키마-소비자 불일치까지 고치므로 어느 경우든 가치.)
- ⚠️ 재시도 로직(runAgent.js:130)은 형식 실패에 maxTokens를 안 올린다(정상) — 형식 문제엔 위 구조적 수정이 필요하지, 길이 조정으론 안 풀린다.

---

## 6. #161 vs 이번 (요약)

| | #161 | 이번 |
|---|---|---|
| stopReason | `max_tokens`(잘림) | `end_turn`(정상 종료) |
| 출력 | JSON 중간 절단 | 완전(ot/textLen 충분) |
| 실패 층위 | 생성 길이 | **출력 형식/스키마** |
| 해결 | maxTokens↑(16000 재시도) | **스키마 완화 / extractJson 강화 / 프롬프트**(길이 무관) |
| 코드 | runAgent.js:130 truncated 분기 | Verdict.js:21 / extractJson:35-55 / examiner_B·C.md §8 |
