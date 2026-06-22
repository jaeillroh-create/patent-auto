# DIAG — 첨부 템플릿 톤앤매너(문체)가 LLM 프롬프트에 실제 전달되는가 (전 사슬 실측)

> 브랜치: `review-engine/diag-template-tone-tracing` · 코드 변경 0 (진단 문서만)
> 방법: 업로드~프롬프트 주입 전 사슬을 file:line 으로 추적 + 현실적 ~12K 양식을 **실제 `sanitizeTemplate`** 에 통과시켜 정량 측정(vm/node, 추정 0).
> **결론 한 줄: 들어간다. 첨부 양식의 문체(어투·종결어미·연결어·강조)는 최종 LLM 프롬프트에 거의 100% 원형으로 살아 전달된다. 단 (a) "마커(제N항/조문/인용/단락) 포함 문장"은 통째 redact 되어 그 문장의 문체(특히 표준 서두·결어)는 손실되고, (b) `~부` 과잉마스킹이 일부 연결어를 갉는다.**

---

## 0. ★ 정량 실측 (원문 ~12K → 최종 프롬프트)

현실적 의견서 양식(문체 문장 + 마커 문장 혼합, 원문 **11,687자**)을 실제 `Opinion.sanitizeTemplate` 에 통과:

| 측정 | 값 |
|---|---|
| 원문 | 11,687자 |
| sanitized(=프롬프트 주입본) | 8,632자 |
| 마커 문장 redact(`[사건특유 문장 생략]`) | 124개 |
| **문체 char-mass 생존** | **약 100%** (5,797/5,797자 — 마커 없는 문체 문장 **원형 보존**) |
| 문체 토큰(`사료됩니다`·`앙망하는 바입니다`·`이상과 같이`·`살피건대`·`따라서`) 최종 프롬프트 존재 | **YES (전부)** |
| 내용 누수(`가중 보정부`·`소셜미디어`·`제어회로`·`120℃`) | **0건** (전부 redact/mask) |

→ **문체는 산다, 내용은 죽는다** = 설계 의도대로 동작. "참고 안 하는 듯"의 체감은 §4 의 2차 손실(서두·결어 문체 redact, 과잉마스킹 잡음) 때문이지 "문체가 프롬프트에 없어서"가 아니다.

---

## 1. 전 사슬 (file:line + 단계별 데이터 변환)

| # | 단계 | file:line | 데이터 변환 |
|---|------|-----------|-------------|
| 1 | 업로드 | `opinion.js:1132` `handleRefUpload` | `extractTextFromFile(file)` → `text`. `text.length<50` 이면 거부(1138). |
| 2 | 저장 | `opinion.js:1059` `saveTemplate` | `template={name,text,…}` → localStorage(1064)+DB `opinion_user_settings`(1067)+ **`state.templates[type]=template`(1077)**. ★ **원문 전체 무손실 저장**(여기선 절삭/가공 0). inventive_step 이면 `customTemplate`/`refText` 도 세팅(1080-1083). |
| 3 | 로드 | `opinion.js:1147` `getActiveTemplate(type)` | `templates[type].text` 있으면 → **`sanitizeTemplate(text,type).sanitized` 반환**(1151-1154) + forbiddenSpans 누적(1153). 없으면 `customTemplate`(1156), 그래도 없으면 **DEFAULT 구조문**(1162-1163, ★문체 0 — 구조+style_notes만). |
| 4 | ★정제 | `opinion.js:1200` `sanitizeTemplate` | `maskedFull = _maskCaseSpecific(_redactMarkerSentences(rawText))`(1242) → 25K 캡(1243) → 헤더+본문. **문체 손실 의심 지점(§3)**. |
| 5 | 주입(ref) | `opinion.js:2928-2930` `getContext('ref')` | `templateText=getActiveTemplate(rejection_type)` → `ctx += '[★ 본 사무소 표준 의견서 양식 시작 — 이 양식의 스타일·문체를 반드시 따를 것]\n'+templateText+'\n[★…끝]\n\n'`. ★ **sanitized 양식 전문이 ctx 에 통째로 들어감**. |
| 6 | 프롬프트 | `opinion.js:3437` `startOpinionDraft` | `prompt = SYS_PROMPT + getTemplateGuard() + '\n\n' + ctx + revCtx + styleGuide + mixedOpinionDirective + tpl[t]`. ★ ctx(=ref 포함) + styleGuide(=문체 지시) 가 한 문자열로 결합. |
| 7 | 호출 | `opinion.js:3438` | `App.callClaude(prompt)` — 위 prompt 문자열이 그대로 LLM 으로. |

★ 핵심: 5→6→7 에서 **sanitized 양식 + styleGuide 가 최종 prompt 문자열에 실재**(실측 §0 에서 문체 토큰 전부 존재 확인).

---

## 2. styleGuide — 문체 지시 강도 (opinion.js:3419-3431)

`activeTemplObj`(=`state.templates[t]`)가 있을 때만 생성. 강도는 **강함**:
- `★★★ 문체·톤 준수 지시 (최우선 적용) ★★★`(3419) + ref 래퍼도 "이 양식의 스타일·문체를 반드시 따를 것"(2930).
- 6요소 명시(3422-3428): ①호칭 ②본원/인용 명칭 ③종결어미 ④강조어구 ⑤단락 기호체계 ⑥결어.
- 내용·구조 차용 금지(3430), §42 조문 보호(3431) — 오염 차단과 양립.
- ⚠️ **약점**: "양식의 [*] 마스킹·기술내용·논증은 차용 금지, 어투만 학습"(3420). 즉 LLM 이 보는 예시는 **마스킹+서두 redact 된 양식**이라, ①호칭·⑥결어(주로 서두/결어=마커 문장)의 **학습 표본이 빈약**할 수 있다(§3-2).

---

## 3. ★ 문체가 손실되는 정확한 지점 (정제 단계)

### 3-1. `_redactMarkerSentences` (opinion.js:1228-1237) — 마커 문장 통째 삭제
```js
var HIGH_SENT = /제\s*\d+\s*항|청구항\s*\d+|인용문헌\s*\d+|…|【\s*\d{1,4}\s*】|\d{4}-\d{6,}/;
parts[i] = HIGH_SENT.test(parts[i]) ? ' [사건특유 문장 생략] ' : parts[i];
```
- 마커(제N항·조문 제M항·인용N·【단락】·출원번호) **포함 문장 전체**를 `[사건특유 문장 생략]`으로 치환(실측 124개).
- ★ **표준 서두 "귀청께서는 …특허법 제42조 제3항…의견제출통지서를…" 도 제N항 동반 시 통째 redact** → 그 서두의 문체(①호칭·도입 어투)가 LLM 예시에서 사라짐. 결어가 조문/항을 인용하면 ⑥결어도 일부 손실.
- 단, 핵심 어투(종결어미·연결어·강조)는 **마커 없는 논증 문장**에 충분히 반복되어 살아남음(실측 100%).

### 3-2. `_maskCaseSpecific` (opinion.js:1204-1221) — `~부` 과잉마스킹
`.replace(/[가-힣]{2,12}부/g,'[구성*]')`(1218)가 구성명사뿐 아니라 **연결어도 갉는다**(실측):
| 원문 | 마스킹 후 |
|---|---|
| 본원발명은 인용발명으로**부터** 용이하게 | 본원발명은 **[구성\*]터** 용이하게 |
| 그러한 구성으로**부터** 효과가 | 그러한 **[구성\*]터** 효과가 |
- "…로부터" 등 조사·연결어가 `[구성*]터`로 훼손 → 문체 자연스러움 경미 저하(의미 전달엔 큰 영향 없으나 잡음).

### 3-3. DEFAULT 폴백 — 문체 0 (해당 시)
- 업로드 양식이 그 유형에 없고 `customTemplate` 도 없으면 `getActiveTemplate` 가 **DEFAULT 구조문**(1162-1163) 반환 = 업로드 문체 0, styleGuide 도 빈 문자열(3411 `activeTemplObj` false).
- ★ **유형 불일치 특이**: inventive_step 양식만 올리고 사건이 description_deficiency/partial_rejection 이면 — `getContext('ref')` 의 `getActiveTemplate` 는 `customTemplate`(=inventive_step)로 폴백해 **ref 엔 문체가 들어가나**, `styleGuide` 는 `templates[t]` 부재로 **빈 문자열**(3411) + `_templateTypeMismatch` 경고(3398-3402). → ref 문체는 있으나 6요소 지시가 빠진 **반쪽 적용**.

---

## 4. ★ 핵심 질문 — 코드로 답

| # | 질문 | 답 (실측·file:line) |
|---|------|---------------------|
| 1 | 첨부 템플릿이 최종 프롬프트에 실제로 들어가나 | **YES**. getContext ref(2930)→prompt(3437)→callClaude(3438). 실측: 문체 토큰 전부 최종 문자열 존재. |
| 2 | 문체가 얼마나 살아남나 | **마커 없는 문체 ≈100% 원형 보존**(어투·종결어미·연결어·강조). 마커 문장 문체만 손실. |
| 3 | 안 들어가거나 빈약하면 어느 단계 | (a) `_redactMarkerSentences`(1228)가 서두·조문·인용 문장 통째 삭제 → **표준 서두/결어 문체 손실**. (b) `_maskCaseSpecific` `~부`(1218) 연결어 훼손. (c) 유형 불일치 시 styleGuide 누락(3411). |
| 4 | styleGuide 충분히 강한가 | 지시는 **강함**(3419-3431, 6요소·최우선). 단 예시 표본이 마스킹+서두 redact 라 ①호칭·⑥결어 **학습 근거가 빈약**. |
| 5 | #190(법조 가드)이 문체 보존에 준 영향 | **문체 content 에는 영향 0.** #190 은 forbiddenSpans/validate(**생성 차단 게이트**)만 고쳐 "정형 서두 때문에 생성이 high 로 차단되던 것"을 풀었다(생성 완주 가능). `_redactMarkerSentences`(LLM-facing 텍스트)는 미수정 → 정형 서두는 **여전히 sanitized 에서 redact**. 즉 #190 = "차단 해소"이지 "서두 문체 복원"이 아님. |

---

## 5. 해결 방향 (수정은 별도 PR)

문체 전달 자체는 정상이나, **서두·결어 문체 손실 + 과잉마스킹**을 줄이면 톤 재현이 강해진다.
1. **`_redactMarkerSentences` 를 #190 정합으로 — "정형 마커 문장은 redact 말고 마스킹만".** `_isBoilerplateSentence`(정형 서두·조문)면 통째 생략 대신 `_maskCaseSpecific` 만 적용 → 서두/결어 문체(①호칭·⑥결어) 보존 + 내용 차단 양립. (사건고유 마커 문장만 redact.)
2. **`~부` 마스킹 경계 강화**(1218): `(?<![으로])…부` 류 보호 또는 "…로부터/…로서/…에서" 등 조사·연결 화이트리스트 → 연결어 훼손 제거.
3. **styleGuide 보강**(선택): redact 로 사라진 서두/결어 예시를 "마스킹된 표준 서두/결어" 형태로 styleGuide 에 별도 1~2문장 제공 → ①호칭·⑥결어 학습 근거 보강.

---

## 6. ★ 사용자 콘솔 직접 확인법 (코드 수정 없이)

```js
// (1) 업로드 원문이 저장됐나 + 몇 자
Object.keys(Opinion.state.templates||{}).map(k=>[k, (Opinion.state.templates[k].text||"").length]);

// (2) 정제된 양식(=프롬프트에 들어갈 본문)에 문체가 남았나 — 직접 반환값 확인
var T = Opinion.getActiveTemplate(Opinion.state.current.rejection_type);
console.log("길이:", T.length,
  "| 문체존재:", /사료됩니다|앙망|이상과 같이|살피건대|따라서/.test(T),
  "| 서두redact:", (T.match(/\[사건특유 문장 생략\]/g)||[]).length, "개");
console.log(T.slice(0,800)); // 눈으로 문체 확인

// (3) 최종 프롬프트에 문체가 실리는지 — callClaude 1회용 런타임 후킹(코드수정 아님, 콘솔 붙여넣기)
var _o=App.callClaude; App.callClaude=function(p){
  console.log("PROMPT len:", (p||"").length,
    "| 양식블록:", (p||"").indexOf("표준 의견서 양식")>=0,
    "| 문체토큰:", /사료됩니다|앙망|이상과 같이|살피건대/.test(p||""));
  return _o.apply(this, arguments);
};
// → 의견서 생성 1회 실행 후 콘솔 확인. 끝나면 App.callClaude=_o; 로 복원.
```
- (2)에서 `문체존재:true` + (3)에서 `양식블록:true, 문체토큰:true` 면 → **문체가 프롬프트에 실재**(실측과 일치).
- DEFAULT 폴백 여부: (2)의 반환이 `'[의견서 작성 양식]\n구조:…'` 로 시작하면 업로드 양식이 아닌 **기본 구조문**(문체 0) — 유형 불일치/미업로드 신호.

**요지: 첨부 양식의 문체는 최종 LLM 프롬프트에 ≈100% 살아 전달된다(실측). 다만 마커 문장(표준 서두·조문) 문체는 `_redactMarkerSentences` 가 통째 지우고 `~부` 마스킹이 연결어를 일부 갉는 2차 손실이 있어, 톤 재현 체감이 약할 수 있다. #190 은 차단을 풀었을 뿐 서두 문체를 복원하진 않았다.**
