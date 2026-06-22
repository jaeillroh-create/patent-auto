/**
 * review-engine/kernel/amendmentCompiler.js
 * ─────────────────────────────────────────────────────────────
 * 지적(issue) → PatchPlan 컴파일 — spec §7.1 ①~③.
 *   ① Intent Extraction: issue → 제한 op 집합 (profile.amendmentOps 허용집합 내)
 *   ② Ripple Analysis: profile.rippleRules.trace(op, state) 로 전파 영향 수집
 *   ③ Patch Plan 생성: op ↔ issue 1:1 추적(reason=issueId)
 * 실제 텍스트 수술/Apply(④)·정합성(⑤)은 writer 책임(§7.2). 여기선 구조화 Plan까지만.
 * op/ripple 규칙은 전부 인자 주입 — kernel은 모듈을 모름(I-6).
 * @module review-engine/kernel/amendmentCompiler
 */

let _seq = 0;
function nextId() { _seq += 1; return `plan_${_seq}`; }
/** 테스트 결정성용 시퀀스 리셋. */
export function _resetSeq() { _seq = 0; }

/**
 * issue 1건에 대한 PatchPlan 생성.
 * @param {import('../contracts/stateSchema.js').Issue} issue
 * @param {import('../contracts/ReviewProfile.js').OpDef[]} amendmentOps  허용 op 정의(주입)
 * @param {import('../contracts/ReviewProfile.js').RippleRule[]} rippleRules  전파 규칙(주입)
 * @param {import('../contracts/stateSchema.js').ReviewState} state  ripple trace 입력
 * @returns {import('../contracts/stateSchema.js').PatchPlan}
 */
export function compile(issue, amendmentOps, rippleRules, state) {
  const allowed = Array.isArray(amendmentOps) ? amendmentOps : [];
  // ① Intent: issue.intentOps(있으면)와 허용 op 교집합. 없으면 issue.type을 op 후보로.
  const requested = Array.isArray(issue.intentOps) && issue.intentOps.length
    ? issue.intentOps
    : (issue.suggestedOp ? [issue.suggestedOp] : []);
  const allowedNames = new Set(allowed.map((o) => o.op));
  const chosen = requested.filter((op) => allowedNames.has(op));
  // 허용 op이 비면(매핑 실패) 안전하게 첫 허용 op로 폴백, 그래도 없으면 빈 ops.
  if (chosen.length === 0 && allowed.length) chosen.push(allowed[0].op);

  const ops = chosen.map((op) => ({
    op,
    target: (issue.target && issue.target[0]) || '',
    content: issue.amendmentDirection || '',
    reason: issue.id, // op ↔ issue 1:1 추적
  }));

  // ② Ripple: 각 op에 대해 주입된 trace 규칙 적용(누적).
  const ripple = [];
  const rules = Array.isArray(rippleRules) ? rippleRules : [];
  for (const opObj of ops) {
    for (const rule of rules) {
      if (typeof rule.trace !== 'function') continue;
      const effects = rule.trace(opObj, state) || [];
      for (const eff of effects) ripple.push({ affected: eff.affected, change: eff.change });
    }
  }

  // ③ Patch Plan
  return {
    id: nextId(),
    addressesIssues: [issue.id],
    ops,
    ripple,
    simulated: false,
    scoreBefore: 0,
    scoreAfter: 0,
    accepted: null, // 사람만 변경 (I-2)
  };
}

export default { compile, _resetSeq };
