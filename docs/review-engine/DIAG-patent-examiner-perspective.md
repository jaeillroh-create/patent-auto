# DIAG — patent examiner .md 관점 확인: 청구항 중심 뒷받침(§42④)인가 opinion식(§29)인가

> 브랜치: `review-engine/diag-patent-examiner-perspective` · 코드 변경 0 (확인 문서만)
> 변리사 지적: patent(출원 전) 검증의 본질 = "청구항이 명세서로 충분히 뒷받침되는가"(청구항 중심). 현재 .md 가 이걸 보는지, opinion식 §29에 머물렀는지.
> **결론 한 줄: 청구항 중심 §42④ 뒷받침 검증이 이미 시스템의 핵심이다 — examiner_B 가 "청구항 구성요소 → 상세설명(step_08/12) 뒷받침"을 전담(앵커 1차 관문, severity high, 점수 가중 1.5× 최중량)하고, adaptSnapshot 이 claims+상세설명을 실제로 공급한다. opinion 복붙 아님(출원 전 재구성). §29(examiner_A)는 3개 중 1개 레인일 뿐. 사용자가 본 8 issues 가 진짜 진보성 위주였는지는 result.issues 의 raisedBy/type 분포로 역추적해야 확정된다.**

---

## 0. TL;DR — 관점 판정

| examiner | 담당(조문) | 청구항 중심? | severity |
|---|---|---|---|
| **examiner_B** | **§42④ 뒷받침**(청구항 구성요소→상세설명) + §42③ 명확성 | ★★★ **YES — 청구항-명세서 정합의 핵심** | anchor 뒷받침 부재 = **high** |
| **examiner_C** | §42④ 형식(청구범위 적정)·§45 단일성·§42③ 실시가능성 | ★★ YES(청구항 적정·실시) | medium |
| examiner_A | §29① 신규성·§29② 진보성 | △ (opinion식 관점 — 단 출원 전 재구성) | general 진보성 high / anchor medium |
| attorney_author | 방어 + 보정 "방향"(상세설명 step_08/12 근거) | ★ YES — §42④ 뒷받침 근거로 보정 방향 | — |
| attorney_reviewer | 보정 방향 독립 검토(과축소 견제) | — | — |
| domain_expert | 실시가능성·기술정확성(기술 관점, 법조 비인용) | △ | — |

→ **3개 examiner 중 2개(B·C)가 청구항 중심 §42**, 1개(A)가 §29. 그리고 **점수 가중은 anchor 뒷받침(§42④)이 최중량**(high 10 × anchor 1.5 = 15). **청구항 뒷받침이 빠진 게 아니라 시스템의 1차 관문이다.**

---

## 1. examiner 6종이 실제 검증하는 것 (원문 인용)

### examiner_B — ★ 청구항 중심 뒷받침(§42④) 전담 (patent 본질)
`.claude/rules/agents/patent/examiner_B.md`:
- §1: "**§42④ 뒷받침요건**: 청구항의 각 구성요소가 **발명의 설명(상세설명)에 의해 뒷받침**되는가(상세설명에 그 구성에 대한 설명이 존재하는가)."
- §2: "`spec.sections[]` — **상세설명(장치 step_08·방법 step_12)** … ★ patent는 상세설명이 실제 입력이므로 **뒷받침 매핑을 실제로 확인한다**."
- §5.2: "**anchor**: ★ **너가 1차 관문이다.** anchor 종속항의 구성요소가 **상세설명(step_08/12)에 뒷받침이 존재하는가**를 **최우선·엄격하게** 검토 … 뒷받침 부재 = **§42④ 위반, severity high.**"
→ **정확히 "청구항이 명세서로 뒷받침되는가"를 본다.** 사용자가 말한 patent 본질 그 자체.

### examiner_C — 청구범위 적정성·단일성·실시가능성(청구항 중심)
- "**청구범위 적정성(§42④ 형식)**: 청구항의 한정이 적정한가 … **§45 단일성** … **실시가능성(§42③)**: 통상의 기술자가 청구항·상세설명으로 그 발명을 실제로 구현할 수 있는가."
→ 청구항 자체의 명확·적정·실시 — 청구항 중심.

### examiner_A — §29 신규성·진보성(opinion식 관점이나 출원 전 재구성)
- "'이 청구항이 출원되면 §29로 거절될 것인가'를 적대적으로 검증. (의견서 대응이 아니라 **출원 전 자체 명세서 검증**이다.)"
- E-02(§7): "`citedPrior` 가 비어 있으면 진보성 high issue 생성 금지 → low 강등 / 번호만 있고 요약 빈약하면 medium 이하 강등."
→ §29는 opinion 과 같은 조문이나, **출원 전**으로 재구성되고 인용발명 없으면 강등. 1/3 레인.

### attorney_author — 보정 "방향"이 §42④ 뒷받침 기준
- §5: "보정 방향은 반드시 **상세설명(step_08/12)에 근거가 있는 구성**으로 잡아라(상세설명에 없는 구성을 청구항에 새로 넣으면 **§42④ 뒷받침 부재**를 유발 — examiner_B가 잡는다)."
→ 보정 방향도 청구항-명세서 정합(§42④) 기준. 청구항 중심.

---

## 2. ★ 청구항 중심이 "말뿐"이 아니라 실제 배선됐는가 — adaptSnapshot 확인

`review-engine/profiles/patent/adapter.js` (출원물 → ReviewState):
```
claims      ← step_06(장치) + step_10(방법) 파싱, anchorStart 로 kind(general|anchor) 판정 (line 112-122)
spec.sections ← step_08(장치 상세설명)·step_12(방법 상세설명)·step_18(부호)·step_19(요약) (line 123-129)
citedPrior  ← step_04(선행기술 검색) 또는 raw.citedPrior (line 131-135)
invention   ← step_01/02/05/17, selfReviewLog ← scopeCheckResults+step_13/15(2단방어)
```
→ **examiner_B 가 읽는 `claims` + `spec.sections`(step_08/12 상세설명)가 실제로 공급된다** → "청구항 구성요소 → 상세설명 뒷받침" 매핑을 **진짜로 수행 가능**. 말뿐 아님.

`PatentProfile.issueCatalog`: `기재불비(§42④, anchor=high)`·`명확성(§42④)`·`단일성(§45)`·`실시가능성(§42③)` + `진보성/신규성(§29)`. → §42 청구항 중심 type 들이 1급 시민.
`scoreWeights`: `high:10, anchor 1.5×` → **anchor §42④ 뒷받침 부재 = 10×1.5 = 15, 전 issue 중 최중량.** 청구항 뒷받침이 점수상 최우선.

---

## 3. opinion .md 복붙인가? — 아니오(출원 전 재구성)

| 구분 | opinion examiner_B | patent examiner_B |
|---|---|---|
| 대상 | 보정안(OA 대응) 뒷받침 | **출원 전 명세서 청구항**의 상세설명 뒷받침 |
| 입력 | 명세서(있으면) | ★ **상세설명이 실제 입력**(step_08/12) — "뒷받침 매핑 실제 확인" |
| 특유 | anchorType='부가' 1차 관문 | **anchor 1차 관문**(step_08/12 뒷받침 최우선) + selfReview 2단방어 |
- patent 전반: "출원 전 자체 명세서 검증", "§47 신규사항 비핵심(분할 아님)", "자기검토 2단방어(§8.4)", "차등검증 general/anchor" — **patent 고유**. 복붙 아님.

---

## 4. 빠진 관점? — 없음 (§47만 정당하게 제외)

| 사용자 우려 "빠졌나" | 실제 |
|---|---|
| 청구항 뒷받침(§42④) | ✅ **있음 — examiner_B 핵심, 최중량** |
| 명확성(§42③/④) | ✅ 있음(examiner_B 명확성 + examiner_C 청구범위 형식) |
| 실시가능성(§42③) | ✅ 있음(examiner_C) / 기술관점(domain_expert) |
| 단일성(§45) | ✅ 있음(examiner_C) |
| **신규사항(§47)** | ⛔ **정당하게 제외** — patent 는 **최초 출원**(분할·보정 아님)이라 §47 신규사항 비해당. examiner_A·C 가 "§47 issue 생성 금지" 명시. |
→ **누락 관점 없음.** §47만 출원 전이라 의도적 제외(올바름).

---

## 5. ★ issues 8개 관점 역추적 (이게 진짜 판정 — DB/콘솔로)

`.md`는 청구항 중심이 맞으나, **사용자가 본 8 issues 가 실제로 어느 관점이었는지**는 result 를 봐야 확정된다(코드만으론 분포 단정 불가). 아래로 즉시 역추적:

**SQL (Supabase):**
```sql
WITH latest AS (
  SELECT result FROM review_runs
   WHERE module='patent' AND status='done'
   ORDER BY created_at DESC LIMIT 1)
SELECT i->>'raisedBy' AS examiner, i->>'type' AS type,
       i->>'legalBasis' AS legal, i->>'severity' AS sev, i->'target' AS target
  FROM latest, jsonb_array_elements(result->'issues') i;
```
**콘솔(결과 모달 열린 상태):**
```js
window.__patentReviewState.issues.map(x => ({ by:x.raisedBy, type:x.type, law:x.legalBasis, sev:x.severity }));
```
**해석:**
- `examiner_B` + `기재불비/명확성` + `§42④/§42③` → ★ **청구항 뒷받침/명확(patent 본질, 정상)**.
- `examiner_C` + `단일성/실시가능성` → 청구범위/실시(정상).
- `examiner_A` + `진보성/신규성` + `§29` → §29 관점(opinion식).
- **8개 중 B·C 가 다수면 = 청구항 중심 정상.** A(§29)가 다수면 → 인용발명(step_04 선행기술) 품질·E-02 강등 적용 점검(인용발명 없는데 진보성 다발이면 그게 버그).

---

## 6. 해결 방향 (수정은 별도 — 확정 후)

1. **.md 재작성 불필요.** 청구항 중심 §42④ 뒷받침은 이미 핵심(examiner_B·1차 관문·최중량) + 배선 완비(claims+step_08/12 공급). 사용자 우려(누락/opinion식)는 **대체로 반증**.
2. **먼저 §5 로 8 issues 분포 확인.** 
   - B·C 다수(§42 중심) → **정상. 조치 불요**(사용자 인상이 §29 일부 issue 때문이었을 수 있음).
   - A(§29) 다수인데 인용발명 부실 → E-02 강등이 안 먹은 것 → examiner_A 프롬프트/citedPrior 매핑 점검(별도).
3. (선택) **출원 전 = 뒷받침 우선**을 더 강화하고 싶으면: discover 에서 §42④ 우선 노출 / severityRule·scoreWeights 추가 가중(이미 1.5×). ⚠️ **§29(examiner_A) 제거는 비권장** — 특허는 진보성도 갖춰야 하므로 출원 전 §29 점검도 정당. "청구항 중심"은 §29를 빼는 게 아니라 §42④를 1차로 두는 것(이미 그러함).

**요지: patent examiner 는 청구항 중심 뒷받침(§42④, examiner_B)이 핵심·최중량으로 이미 들어있고 claims+상세설명이 실제 공급된다. opinion 복붙도 아니다. §29(A)는 정당한 1개 레인. 진짜 판정은 "사용자가 본 8 issues 의 raisedBy/type 분포"이며, §5 의 SQL/콘솔 한 번이면 청구항 중심이 작동했는지 vs §29가 과다발했는지 확정된다.**
