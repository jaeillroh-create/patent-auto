# 진단 — 의견서 템플릿(톤앤매너 양식) 미적용

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-template-not-applied` · **READ-ONLY, 코드 수정 0**
> 증상: 유형별 의견서 양식(.docx 13K/11K) 업로드됨. UI는 "문체·구조 자동 참고"라 표시. 그러나 생성된 의견서가 그 양식의 문체·구조를 안 따름.

---

## 0. 결론 (한 줄)

**업로드→저장→로드→프롬프트 주입 "배관"은 전부 정상이다.** 끊긴 곳은 **변환 단계 `sanitizeTemplate`(opinion.js:1200)** — 13K 양식을 통째로 주입하지 않고, **DEFAULT 구조 + 추출된 스타일 패턴 조각(5~20줄, 마스킹) + DEFAULT 작성지침**으로 **축약**한다("사건 내용 철저 제외", 프라이버시 설계). 게다가 `tpl[t]`(3344)가 엔진 고유 섹션 구조를 강제한다. → **양식의 "구조"는 애초에 주입되지 않고(DEFAULT 사용), "문체"는 조각만** 전달돼 거의 안 따른다.

---

## 1. 업로드·저장 — 정상

- `handleRefUpload(event, type)`(opinion.js:1132): `extractTextFromFile` → `saveTemplate(file.name, text, type)`. (type 은 업로드 핸들러 바인딩이 전달; 기본 `inventive_step`.)
- `saveTemplate(name, text, type)`(1059): `state.templates[type]=template`(1077) + localStorage(`_getTemplateKey`, 1064) + **DB upsert `opinion_user_settings.setting_key='template_'+type`**(1062/1069). ✅

## 2. 로드 — 정상 (save↔load 키 일치)

- `loadSavedTemplate`(989, init 985에서 호출): types=`['inventive_step','description_deficiency','partial_rejection']`(991), 각 `tKey='template_'+types[i]`(995)로 **DB 조회**(1000-1004) → `state.templates[types[i]]=setting_value`(1006). localStorage 폴백(1015).
- **저장 키(1062)=로드 키(995)='template_'+type** → 크로스세션 로드 정상. ✅

## 3. 프롬프트 주입 — 배선은 정상

- `startOpinionDraft`(3322): `ctxSections = skipTemplate ? [...] : ['parsed','analysis','draft','validation','ref']`(3336) → `getContext(ctxSections)`(3337). ★ 'ref' 포함.
- `getContext` 'ref'(2940-2942): `templateText = getActiveTemplate(rejection_type)`(2941) → `ctx += '[★ 본 사무소 표준 의견서 양식 시작 …]\n'+templateText+…`(2942).
- `styleGuide`(3415-3435): `state.templates[t]` 있으면 "문체·톤 준수 지시(최우선)" 강력 블록 생성.
- 최종 프롬프트(3462): `SYS + getTemplateGuard() + ctx + revCtx + styleGuide + mixedOpinionDirective + tpl[t]`. ✅ 배선 OK.

> ※ grep 이 'ref'를 못 잡았던 건 `getContext(ctxSections)` **변수형** 호출이라서(literal `getContext([…])` 아님). 실제론 'ref' 주입됨.

## 4. ★ 끊긴 곳 — `getActiveTemplate`→`sanitizeTemplate` 변환 (opinion.js:1147→1200)

`getContext`가 주입하는 `templateText`는 **원본 13K가 아니라** `getActiveTemplate(type)`(1147)의 반환값이고, 그건 `sanitizeTemplate(templates[type].text, type)`(1151)이다. `sanitizeTemplate`(1200-1280)이 하는 일:

1. **원본을 라인별로 훑어 6가지 패턴만 추출**(1230-1258): 제목/호칭/종결어미/강조어구/결어. **그 외 모든 내용(=양식 본문·구조 prose)은 버림**("사건 내용 철저 제외", 1203·1260).
2. **조립**(1261-1280):
   ```
   [★ 본 사무소 표준 의견서 양식 — 스타일·문체 학습 자료 (내용 사용 금지)]
   기본 구조: {def.structure}                ← ★ DEFAULT 구조(사용자 양식 아님! 1262)
   [⑤ 단락 구조 패턴] {추출 ≤20줄, 마스킹}
   [① 호칭] {≤5}  [③ 종결어미] {≤5}  [④ 강조어구] {≤5}  [⑥ 결어] {≤8}
   작성 지침: {def.style_notes}              ← ★ DEFAULT 지침(1280)
   ```
   - `def = DEFAULT_TEMPLATES[type]`(1201) → **구조·작성지침은 기본값**. **사용자 양식의 구조는 주입되지 않는다.**
3. **추출은 라인별 정규식**(headingPattern·salutPattern 등, per-line `^…$`). **.docx 추출 텍스트가 긴 문단/줄바꿈 부족이면 매칭 라인이 적어 패턴도 거의 안 잡힌다** → 스타일 전이 ≈ 0.

→ **결과: 13K 양식이 "DEFAULT 구조 + 소량 스타일 조각"으로 줄어든다.** 의견서는 (a) `tpl[t]`(3344, 아래)와 (b) DEFAULT 구조를 따르고, 사용자 양식의 **구조는 전혀**, **문체는 조각만** 반영 → "안 따름"으로 체감.

## 5. ★ 2차 — `tpl[t]`가 엔진 섹션 구조를 강제 (opinion.js:3344)

- 양식이 잘 주입돼도, `tpl[t]`(inventive_step 등, 3344-3401)가 **고정 섹션을 강제**한다: `## 서두 / ## 1. 보정내용 / ## 2. 보정의 적법성 / ## 3. 구체적 의견내용 → ### (1)~(4)`. 3351: "양식의 형식을 따르되, **아래 섹션 구분자(## 제목)를 반드시 사용**". → 양식 구조와 충돌 시 **엔진 구조 우선**.
- styleGuide(3434)도 "양식의 구체적 기술 내용·표현은 차용 금지, **문체만**"으로 한정. → **설계상 양식의 "구조"는 따르지 않고 "문체(톤)"만** 참고하게 돼 있다. UI 문구("문체·**구조** 자동 참고")와 실제 동작 불일치.

## 6. 보조 — 유형 불일치 시 양식 0

- `getActiveTemplate(rejection_type)`에서 `state.templates[rejection_type]` 없으면 **DEFAULT 전체**(1162-1163, 조각도 없음).
- 양식은 `inventive_step`/`description_deficiency` 2종. **사건이 `partial_rejection`이면 양식 없음→DEFAULT.** 또한 업로드 type ≠ 사건 type 이면 미적용.

---

## ★ 사슬 어디서 끊겼나 (요약)

| 단계 | 상태 | 근거 |
|---|---|---|
| 업로드 | ✅ | handleRefUpload(1132)→saveTemplate |
| 저장(DB/local/state) | ✅ | saveTemplate(1059), setting_key='template_'+type |
| 로드 | ✅ | loadSavedTemplate(989), 동일 키(995) |
| 프롬프트 주입 배선 | ✅ | getContext 'ref'(2940)+styleGuide(3415)+prompt(3462) |
| **변환(sanitize)** | ❌ **여기** | sanitizeTemplate(1200): 원본→DEFAULT 구조+패턴 조각으로 축약(1262/1280), 라인 정규식 의존 |
| **구조 강제(tpl[t])** | ❌ **여기** | tpl[t](3344) 고정 섹션 강제, 양식 구조 무시(3351) |
| 유형 매칭 | ⚠️ | partial_rejection/타입 불일치 시 DEFAULT(1162) |

**즉 "업로드는 되는데 생성에 안 쓰임"의 정체는 "저장/로드 실패"가 아니라 "주입 직전 sanitize가 양식을 DEFAULT 구조+스타일 조각으로 축약 + tpl[t]가 구조를 덮어씀"이다.** 양식은 들어가긴 하지만(조각 형태), "구조"는 설계상 DEFAULT/엔진이 이긴다.

---

## ★ 검증 방법 (사용자가 확인)

- **F12 콘솔**: `Opinion.getActiveTemplate(Opinion.state.current.rejection_type)` 실행 → 반환 문자열을 보라. **13K가 아니라 수백 자~수 K의 "패턴 학습 자료"**면 §4 확정(축약). "기본 구조: …"로 시작하면 DEFAULT 구조 사용 중.
- `Opinion.state.templates` 확인: 해당 type 키에 `{text: 13K…}` 있나(있으면 저장·로드 OK, 문제는 sanitize). 없으면 §6 유형 불일치/로드.

## 7. 해결책 (수정 안 함 — 권고)

1. **양식 본문을 더 많이 주입(프라이버시 마스킹 유지)**: 추출 패턴 조각 대신, `_maskCaseSpecific`(1221, 청구항/단락/출원번호 마스킹)를 **양식 전문에 적용한 버전**을 주입 → LLM이 실제 구조·문체를 보게. (사건 내용 누출은 마스킹으로 차단.)
2. **양식의 구조를 추출해 `def.structure` 대신 사용**: 사용자 양식의 섹션 제목/순서를 뽑아 "기본 구조"로 주입(1262) + `tpl[t]`가 그 구조에 양보(3351 완화). → "구조 참고" UI 문구와 정합.
3. **추출 cap 상향 + .docx 라인 정규화**: 패턴 cap(≤5~20) 확대, extractTextFromFile 결과의 문단을 줄단위로 정규화해 라인 정규식 매칭률↑.
4. **유형 매칭 보강**: partial_rejection 양식 슬롯 추가 또는 폴백 유형 안내. 업로드 type↔사건 type 일치 확인.
5. **UI 문구 정합**: 현 설계가 "문체만"이면 "구조"를 빼거나, "구조"도 따르게 하려면 1·2 적용.

> **권장**: 사용자 의도가 "양식대로(구조+문체)"면 **1+2**가 핵심(sanitize를 마스킹-전문 주입으로 + 양식 구조 채택). 현 sanitize는 "문체 조각만" 설계라 양식이 사실상 거의 반영되지 않는다.

---

## 8. 한 줄 요약

배관(업로드 1132 / 저장 1059 / 로드 989 / 주입 2940·3462)은 전부 정상. **끊긴 곳은 `sanitizeTemplate`(1200)** — 13K 양식을 **DEFAULT 구조 + 마스킹된 스타일 패턴 조각**으로 축약(1262·1280, 라인 정규식 의존)하고, `tpl[t]`(3344)가 엔진 섹션 구조를 강제한다. 그래서 양식의 "구조"는 안 따르고(DEFAULT/엔진), "문체"는 조각만 반영. 확인은 F12에서 `getActiveTemplate(type)` 반환이 13K인지 수백 자 패턴 자료인지 보면 즉시 갈린다.
