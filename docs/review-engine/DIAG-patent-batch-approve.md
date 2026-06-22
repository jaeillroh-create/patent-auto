# DIAG — patent 승인이 매번 재검증(running) 트리거: opinion D2 "확정 후 일괄"로 정리

> 브랜치: `review-engine/diag-patent-batch-approve` · 코드 변경 0 (진단 문서만)
> 증상: patent 검증 결과 정상(high 우선+minor 접힘). 권장 보정 5건의 "승인" 버튼을 **하나 누를 때마다 즉시 "검증 중(running)"** — 매 승인마다 재검증. 원함: 5건 승인 → 1회만 재검증.
> 결론 한 줄: **patent onChange(patent.js:14040)가 매 승인 클릭마다 `runReviewEngine(recheck)`를 즉시 호출하기 때문이다. opinion 은 이 자동 재검증을 이미 AC-T1으로 제거했다(승인=인메모리 반영+영속만, 재검증은 '검증 시작' 버튼 1회). 동일 패턴을 patent onChange 에 적용 = 1줄 제거로 일괄화. 신규 UI 0.**

---

## 0. 끊긴 곳 — 한눈에

| 단계 | 동작 | 문제 |
|---|---|---|
| 공유 패널 버튼 | 매 approve/reject 클릭 → `opts.onChange(state)` 호출 (`opinion-review-panel.js:245`) | (정상 — 호출처가 처리) |
| **patent onChange** | `applyAmendments(acc)` + **`runReviewEngine(recheck)`** (`patent.js:14040`) | ★ **매 승인마다 즉시 재검증(running)** |
| opinion onChange (대조) | `applyAmendments(acc)` + `_persistReviewDecision` + `renderDetail` — **재검증 호출 없음**(`opinion.js:884` AC-T1) | 승인=결정만, 재검증은 명시적 버튼 |

→ **patent 만 onChange 에 자동 recheck 가 남아 있다.** opinion 이 이미 푼 것을 patent 가 답습 안 함.

---

## 1. 승인 → 재검증 즉시 트리거 지점 (file:line)

### (a) 공유 패널: 승인 클릭마다 onChange 발화
`review-engine/ui/opinion-review-panel.js:236-247`:
```js
el.querySelectorAll('button[data-act]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (act === 'approve') approvePlan(state, planId, opts.actor);  // 그 plan.accepted=true
    render(state, el, opts);              // 모달 재렌더(상태 반영)
    if (opts.onChange) opts.onChange(state);   // ★ 매 클릭 → onChange(state)
  });
});
```
→ **승인 1건당 onChange 1회.** (패널은 모듈 무관 — 동작은 호출측 onChange 가 결정.)

### (b) patent onChange: 매번 재검증 (★ 버그)
`patent/patent.js:14040`:
```js
onChange: function(rs){
  var acc = (rs.patchPlans||[]).filter(pp => pp.accepted === true);
  if (acc.length) {
    Patent.applyAmendments(acc);
    if (Patent._reviewRunner) Patent.runReviewEngine(Patent._reviewRunner, { recheck: true }); // ★ 즉시 recheck
  }
  try { Patent._persistReviewDecision(rs); } catch(_e){}
}
```
→ 승인할 때마다 `runReviewEngine(...,{recheck:true})` → `_defaultReviewRunner` → review_runs INSERT + invoke → **"검증 중(running)"**. 5건 승인 = **5회 재검증**.

### (c) opinion onChange: 자동 재검증 제거(AC-T1) — 우리가 따라야 할 패턴
`opinion/opinion.js:881-890`:
```js
onChange: function(rs){
  var acc = (rs.patchPlans||[]).filter(pp => pp.accepted === true);
  if (acc.length) { try { Opinion.applyAmendments(acc); } catch(_e){} }  // 인메모리 구조 반영만
  // ★ AC-T1: 자동 runReviewEngine(recheck) 제거 — 승인 한 번이 discover부터 풀 재검증을 재실행해 타임아웃하던 버그.
  //   재검증은 '의견서 검증 시작' 버튼으로 사용자가 명시적으로.
  try { Opinion._persistReviewDecision(rs); } catch(_e){}
  try { Opinion.renderDetail(); } catch(_e){}   // 클라 재렌더(승인 방향 반영) — edge 재검증 아님
}
```
→ **승인 = applyAmendments(인메모리) + 결정 영속 + 재렌더.** 재검증 0. opinion 이 정확히 이 문제(매 승인 재검증)를 AC-T1으로 이미 해결했다.

---

## 2. ★ 일괄 적용 설계 (선택 누적 → 1회 재검증)

opinion D2 "확정 후 일괄" = **승인은 누적만, 재검증은 명시적 1회**. patent 에 그대로:

```
[변리사 흐름]
1. 결과 모달에서 보정 5건을 검토 → 승인/거부 개별 클릭
   · 매 승인: applyAmendments(누적 acc, 인메모리 방향 기록) + 결정 영속(_persistReviewDecision) + 모달 재렌더(패널 244가 이미 처리)
   · ★ 재검증(runReviewEngine) 호출 안 함 → "running" 안 뜸
2. 5건 승인 끝 → 모달 닫고 '출원 전 검증 시작'(btnPatentReview) 1회 클릭
   · runReviewEngine() → 비용 confirm(G3) → 누적 승인분 반영된 1회 재검증(recheck)
```
- **선택 누적**: 승인 클릭마다 `rs.patchPlans[].accepted` 누적 + `applyAmendments(acc)`(acc=현재까지 전체 승인분) 인메모리 반영. 신규 상태저장 불필요.
- **1회 재검증**: '출원 전 검증 시작' 버튼이 이미 재검증 트리거(공유 메커니즘). opinion 의 '검증 시작'과 동일.
- **신규 UI 0**: 별도 "[전체 적용]" 버튼 안 만들어도 됨(승인 누적 → 기존 검증 버튼 = 일괄). opinion 과 동일 UX.

### applyAmendments 누적 안전성 (확인)
`Patent.applyAmendments`(patent.js:14150)는 승인 plan 의 **방향을 log 로 기록**(산문 미수정) + E-11 3경로 렌더 정합 검사. **청구항/상세설명 텍스트를 누적 변형하지 않는다**(방향 기록만) → `acc`(전체 승인분)로 매번 호출해도 **재기록일 뿐, 중복 손상 없음**. opinion 과 동일. ∴ onChange 에서 applyAmendments 유지해도 안전, **제거 대상은 runReviewEngine 한 줄뿐**.

---

## 3. opinion D2 재사용 여부 → YES (패턴 그대로, 코드 공유는 없음)

- **재사용**: opinion AC-T1 패턴(자동 recheck 제거 + 명시적 재검증 버튼)을 patent onChange 에 **동일 적용**. 검증된 해법.
- **코드 공유 아님**: `Opinion._reviewModalOpts` ↔ `Patent._reviewModalOpts` 는 네임스페이스 분리(공유 함수 호출 X). patent onChange 본문만 opinion 형태로 맞춘다.
- **patent 고유 보존**: applyAmendments(E-11 렌더정합)·_persistReviewDecision(reviewRunId)·renderPreview(page4)는 patent 것 그대로.

---

## 4. 수정 범위 (구현은 별도)

| # | 변경 | 위치 | 비고 |
|---|---|---|---|
| 1 | onChange 에서 **`runReviewEngine(...,{recheck:true})` 제거** | `patent.js:14040` | ★ 핵심 1줄. applyAmendments+persist 는 유지 |
| 2 | (권장) 승인 후 **best-effort 재렌더** 추가 | `patent.js:14040` | opinion 의 `renderDetail` 대응 — `renderPreview()`(page4 "승인 반영" 갱신). 패널 모달은 244가 이미 재렌더 |
| 3 | 주석 정정 | `patent.js:14036` "승인→applyAmendments→recheck" → "승인→applyAmendments+persist(재검증은 명시적 버튼)" | 의도 명문화 |
- **kernel 0**(클라 onChange만). examiner .md·severity·Edge 불변. `patent.js ?v=` 갱신.
- **테스트**: 승인 N회 → `runReviewEngine` 호출 0(recheck 0) / `applyAmendments`·`_persistReviewDecision` 는 호출 / 명시적 버튼 → recheck 1. opinion 회귀 0.

---

## 5. 핵심 질문 — 코드로 답
1. **승인이 왜 즉시 재검증?** → patent onChange(14040)가 매 승인마다 `runReviewEngine(recheck)` 호출. 공유 패널(245)이 클릭마다 onChange 발화하므로 승인 1건=재검증 1회.
2. **5건 누적 → 1회로?** → onChange 에서 recheck 제거(승인=누적 반영+영속만). 누적 승인분은 `rs.patchPlans[].accepted`+`applyAmendments(acc)`로 인메모리 보존, 재검증은 '출원 전 검증 시작' 버튼 1회. = opinion AC-T1.
3. **opinion D2 재사용?** → YES. opinion 이 동일 버그를 AC-T1(자동 recheck 제거)로 이미 해결 — 그 패턴을 patent onChange 에 적용.

**요지: patent.js:14040 onChange 의 `runReviewEngine(recheck)` 한 줄이 매 승인 재검증의 원인. opinion 이 이미 제거한 AC-T1 패턴을 그대로 적용하면 "5건 승인 누적 → 검증 버튼 1회 → 1 recheck" 일괄이 신규 UI 없이 완성된다.**
