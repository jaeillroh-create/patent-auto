# DIAG — patent [반영하기] "승인 보정 없음" (승인 표시 ↔ 반영 데이터 불일치)

> 브랜치: `review-engine/diag-patent-d2-approve-mismatch` · READ-ONLY 진단(코드 0)
> 결론 한 줄: **승인된 plan 의 `op` 는 `add_spec_support` 로 맞지만 `direction`(=`op.content`=`issue.amendmentDirection`)이 비어 있고, `applyDirectionRewrite` 필터가 "direction 비어있지 않을 것"을 요구하므로 전건 탈락 → 0건.** 화면 "승인됨"은 `plan.accepted`만 보고, 반영 엔진은 추가로 `direction` 을 요구하는 **계약 불일치**.

---

## 1. 증상

- patent 검증 → `plan_1~3` 화면에 **[승인됨]** 표시 (라벨 "명세서 근거 추가 @ claim_2").
- [승인 방향 반영] 클릭 → **"반영할 승인 보정(상세설명 뒷받침)이 없습니다"** (0건).
- 즉 **화면 승인 표시 ≠ 반영 엔진이 읽는 데이터.**

---

## 2. 핵심 질문 — 직답

| 질문 | 답 | 근거(file:line) |
|------|----|----|
| 승인이 `_review_applied`에 기록되나 | **기록되긴 함(단 direction='')** — 단, ★E-11 롤백 시 미기록(2차 가설) | patent.js:14183, 14201 / 롤백 14189–14193 |
| op 문자열이 `add_spec_support` 맞나 (examiner vs 엔진) | **맞다.** 화면 라벨 "명세서 근거 추가"가 곧 `add_spec_support` | opinion-review-panel.js:83 `OP_LABEL.add_spec_support='명세서 근거 추가'` |
| `applyDirectionRewrite` 필터가 왜 0건 | **`direction`(op.content)이 비어 있어** `&& String(e.direction\|\|'').trim()` 에서 전건 탈락 | patent.js:14240 |
| 화면 "승인됨" vs 데이터 불일치 지점 | 패널은 `plan.accepted`만으로 "승인됨" 표기(반영 데이터와 무관). 반영 엔진은 추가로 `direction` 요구 | 패널 188 vs patent.js:14240 |

---

## 3. 데이터 흐름 추적 (op·direction 의 출처)

### 3-1. op 문자열 — `add_spec_support` 가 맞는 이유 (op 불일치 아님)

examiner 의 IssueList 스키마에는 `intentOps`/`suggestedOp` **필드가 없다**(검색 0건). 따라서 컴파일러가 op 후보를 못 받아 **첫 허용 op 로 폴백**한다.

```
amendmentCompiler.js:29   const requested = issue.intentOps?.length ? issue.intentOps
                                          : (issue.suggestedOp ? [issue.suggestedOp] : []);   // → []
amendmentCompiler.js:33   const chosen = requested.filter(op => allowedNames.has(op));        // → []
amendmentCompiler.js:35   if (chosen.length === 0 && allowed.length) chosen.push(allowed[0].op); // ★ 폴백
```

`allowed[0]` = `PatentProfile.amendmentOps[0]` = **`{op:'add_spec_support'}`** (PatentProfile.js:47).
→ 모든 patent issue 가 `op='add_spec_support'` 로 컴파일된다. 화면 라벨 "명세서 근거 추가"(panel:83)와 일치. **op 불일치 아님(확정).**

### 3-2. direction(op.content) — 비어 있는 이유 (★ 진짜 원인)

컴파일러는 `op.content` 를 **issue.amendmentDirection** 으로 채운다.

```
amendmentCompiler.js:40   content: issue.amendmentDirection || '',   // ← 비어 있으면 ''
```

`issue.amendmentDirection` 은 **REBUT 라운드의 출원인측 변리사(attorney_author)가 concede/partial 한 issue 에만** 병합된다.

```
orchestrator.js:96-103  ingestRebuttals(): rb.amendmentDirection 있을 때만 issue.amendmentDirection 설정
attorney_author.md §5   "반박(rebut) 우선 … 보정 불가피할 때만 concede + amendmentDirection"
```

→ 변리사가 **rebut(방어)** 하거나 enrichment 가 그 issue 를 덮지 못하면 `amendmentDirection` = 빈값.
→ 화면 라벨 render 에서 **content 가 비면 "— direction" 접미를 아예 안 붙인다**:

```
opinion-review-panel.js:190   ${o.content ? ' — ' + esc(o.content) : ''}
```

사용자 라벨이 **"명세서 근거 추가 @ claim_2"** (접미 없음) → **content(direction) 비어 있음을 화면이 증명.** ★

### 3-3. 승인 → `_review_applied` (direction 그대로 빈값 전파)

```
patent.js (onChange)      var acc = rs.patchPlans.filter(pp => pp.accepted===true);
                          if (acc.length) Patent.applyAmendments(acc);            // (14053–14055)
patent.js:14183           log.push({ op: op.op, target: op.target, direction: op.content || '', … });  // direction=''
patent.js:14201           outputs._review_applied = log;   // [{op:'add_spec_support', direction:'', …} ×3]
```

### 3-4. 반영 엔진 — direction 비어서 전건 탈락

```
patent.js:14240   var specOps = log.filter(e => e && e.op === 'add_spec_support'
                                              && String(e.direction || '').trim());   // ← direction='' → 0건
patent.js:14238   if (!specOps.length) { showToast('반영할 승인 보정(상세설명 뒷받침)이 없습니다','info'); return null; }
```

**op 는 통과하지만 `&& direction.trim()` 에서 전건 탈락 → 0 → 토스트.** ★ 이것이 직접 원인.

---

## 4. 불일치 지점 — 한 장 요약

```
            ┌── 승인(humanGate.approvePlan) → plan.accepted=true ──→ 패널 "승인됨"  (op만 보면 충분)
issue ──compile──▶ plan{ op:'add_spec_support'(폴백), content:'' (amendmentDirection 빈값) }
            └── onChange → applyAmendments → _review_applied[{op:add_spec_support, direction:''}]
                                                              │
                              applyDirectionRewrite 필터: op===add_spec_support  ✅  &&  direction.trim()  ❌(빈값)
                                                              │
                                                          0건 → "승인 보정 없음"
```

**패널은 `accepted` 만으로 승인 표기 / 반영 엔진은 추가로 `direction` 을 요구** → 둘이 보는 데이터 계약이 다름.

---

## 5. 가설 정리

| # | 가설 | 상태 | 판별 |
|---|------|------|------|
| **H1 (★주원인)** | 승인 plan 의 `direction`(amendmentDirection) 빈값 → 필터 `&& direction.trim()` 전건 탈락 | **화면 라벨로 확정**(접미 "—" 없음 = content 빈값) | 콘솔: `outputs._review_applied` 에 3건 있고 각 `direction===''` |
| **H2 (2차)** | `applyAmendments` 의 E-11 게이트(`_reviewRenderCheck()`)가 도면부호 불일치로 **롤백** → `_review_applied` 아예 미기록(onChange가 throw 삼킴) | 가능(프로젝트 도면·부호 의존) | 콘솔: `outputs._review_applied === undefined` 면 H2 |
| H3 (배제) | op 문자열 불일치(add_spec_support 아님) | **배제** | 화면 라벨 "명세서 근거 추가" = add_spec_support(panel:83) |

H1·H2 둘 다 "0건" 증상을 낳는다. 화면 라벨 증거는 **H1(빈 direction)** 을 가리킨다. H2 는 콘솔로 즉시 배제/확정 가능.

---

## 6. 사용자 콘솔 병행 (즉시 판별)

검증 후 사건 화면(main)에서 콘솔:

```js
// (1) 승인 plan 의 op·direction·accepted
window.__patentReviewState.patchPlans.map(p => ({
  id: p.id, accepted: p.accepted,
  ops: (p.ops||[]).map(o => ({ op: o.op, target: o.target, content: o.content }))
}));
//  기대(H1): op:'add_spec_support', content:'' (빈 문자열), accepted:true

// (2) 반영 엔진이 읽는 로그
outputs._review_applied;
//  H1 → [{op:'add_spec_support', direction:'', …} ×3]   (있지만 direction 빈값)
//  H2 → undefined                                         (E-11 롤백으로 미기록)

// (3) (H2 의심 시) 도면부호 정합
Patent._reviewRenderCheck();   // {svg,pptx,canvas, missing:[...]} — missing 있으면 H2(applyAmendments 롤백)
```

- `content`/`direction` 가 **빈 문자열** → **H1 확정**.
- `_review_applied` 가 **undefined** → **H2(E-11 롤백)** 동반.

---

## 7. 해결 방향 (제안만 — 코드 0)

근본은 **반영 엔진이 attorney `direction` 을 필수로 요구하지만, 파이프라인이 그것을 보장하지 않는다**는 계약 불일치. `add_spec_support` 는 direction 없이도 (op + target claim + **issue 본문**)만으로 단락 생성이 가능하므로, 다음을 권장:

- **F1 (권장·핵심) — 필터에서 direction 필수 조건 제거 + 생성기에 issue 본문 공급.**
  `applyDirectionRewrite` 필터를 `e.op==='add_spec_support'` 만으로(= `&& direction.trim()` 제거).
  `_genSpecSupportParagraph` 가 `direction` 이 비면 **issue 본문(description·legalBasis)** 을 basis 로 사용.
  현재 `_review_applied[].reason` 은 **issueId** 뿐이므로(amendmentCompiler.js:41, patent.js:14183),
  반영 시 `window.__patentReviewState.issues` 에서 `id===reason` 로 **issue.description 을 조회**해 생성 근거로 넘긴다.
  → 변리사가 rebut 했든 concede 했든, 승인한 §42④ 지적의 "본문"으로 뒷받침 단락을 생성(가장 견고).

- **F2 (보강) — 로그에 issue 본문 동봉.** `applyAmendments` 가 `direction` 빈값일 때 `reason`/별도 필드에 `issue.description` 을 실어, 반영 엔진이 별도 조회 없이 사용.

- **F3 (별건) — H2 동반 시 E-11 롤백 가시화.** `applyAmendments` 롤백이 `onChange` 의 `try{}catch{}` 에 삼켜져 **사용자에게 무신호**(patent.js:14055). 롤백 시 토스트로 "도면부호 불일치로 미반영"을 노출(또는 반영 시점에 재검사)하여 "승인됨인데 0건"의 침묵을 제거.

> ⚠️ direction 을 attorney 가 항상 채우도록 강제(REBUT 튜닝)하는 방향은 LLM 의존이라 비권장. **add_spec_support 는 issue 본문만으로 자족**하므로 F1 이 가장 견고하다.

---

## 8. 참조 (file:line)

- 필터(0건): `patent/patent.js:14240`
- 로그 빌드(direction=op.content): `patent/patent.js:14183` · 기록: `:14201` · E-11 롤백: `:14189–14193`
- onChange 승인→applyAmendments(롤백 삼킴): `patent/patent.js:14053–14055`
- op 폴백(add_spec_support): `review-engine/kernel/amendmentCompiler.js:29–35` · `profiles/patent/PatentProfile.js:46–52`
- content=amendmentDirection: `amendmentCompiler.js:40`
- amendmentDirection 병합(concede/partial 한정): `orchestrator.js:96–103` · `agents/patent/attorney_author.md §5`
- 화면 라벨(op→한글, content 접미 조건): `review-engine/ui/opinion-review-panel.js:83, 190`
- 승인 표기(accepted만): `opinion-review-panel.js:188, 242`
