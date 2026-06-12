/**
 * review-engine/ui/reviewViewModel.js
 * ─────────────────────────────────────────────────────────────
 * ReviewState → UI 뷰모델 (순수, DOM 비의존 — 테스트 가능). spec §9 UI 매핑.
 * 렌더(DOM)는 opinion-review-panel.js 가 이 뷰모델을 소비한다.
 * ★ 읽기 전용: state 를 변형하지 않는다. accepted 등은 읽기만.
 * @module review-engine/ui/reviewViewModel
 */
import { pendingHumanDecisions, gateView, decisionOf } from '../kernel/humanGate.js';
import { ISSUE_STATUS, SEVERITY } from '../contracts/stateSchema.js';

/** 보정 op → diff 색상 클래스 (image 17: 초록=추가, 빨강=축소, 회색=문맥). */
export function opDiffClass(op) {
  switch (op) {
    case 'add_limitation': case 'add_antecedent': case 'add_spec_support': case 'merge_claim': return 'add';   // 초록
    case 'narrow_scope': return 'narrow'; // 빨강(권리 축소)
    case 'fix_term': return 'fix';        // 앰버(정정)
    default: return 'context';            // 회색
  }
}

/** issue severity → 통과/주의/실패 (image 14). */
function verdictOfSeverity(sev) {
  if (sev === SEVERITY.HIGH) return 'fail';
  if (sev === SEVERITY.MEDIUM) return 'warn';
  return 'pass';
}

/**
 * 뷰모델 생성.
 * @param {Object} state ReviewState
 * @returns {Object} 화면별 매핑 데이터
 */
export function buildViewModel(state) {
  const issues = state.issues || [];
  const isOpen = (it) => it.status === ISSUE_STATUS.OPEN || it.status === ISSUE_STATUS.REGRESSION;

  // ── image 14: 통과/주의/실패 카운트(open 기준) ──
  const openIssues = issues.filter(isOpen);
  const fail = openIssues.filter((it) => it.severity === SEVERITY.HIGH);
  const warn = openIssues.filter((it) => it.severity === SEVERITY.MEDIUM);
  const lowOpen = openIssues.filter((it) => it.severity === SEVERITY.LOW);
  const overall = fail.length ? 'fail' : warn.length ? 'warn' : 'pass';

  // ── image 19: pass 카운트(해소 vs 전체) ──
  const resolved = issues.filter((it) => it.status === ISSUE_STATUS.RESOLVED || it.status === ISSUE_STATUS.ACCEPTED);
  const passCount = { resolved: resolved.length, total: issues.length, highOpen: fail.length, medOpen: warn.length };

  // ── image 33: 쟁점·전략 (raisedBy/legalBasis 그룹) ──
  const byAgent = {};
  for (const it of issues) {
    const k = it.raisedBy || 'unknown';
    (byAgent[k] = byAgent[k] || []).push({
      id: it.id, severity: it.severity, verdict: verdictOfSeverity(it.severity),
      legalBasis: it.legalBasis, type: it.type, target: it.target || [],
      description: it.description, status: it.status,
    });
  }
  const issuesByAgent = Object.entries(byAgent).map(([agent, items]) => ({ agent, items }));

  // ── image 17: 보정 diff (표시만 — accepted 읽기만) ──
  const diffs = gateView(state).map((g) => ({
    planId: g.planId,
    addressesIssues: g.addressesIssues,
    decision: g.decision,             // approved|rejected|pending (사람 결정)
    accepted: g.accepted,             // 읽기만
    scoreBefore: g.scoreBefore, scoreAfter: g.scoreAfter,
    ops: g.ops.map((o) => ({ op: o.op, target: o.target, content: o.content, reason: o.reason, diffClass: opDiffClass(o.op) })),
    ripple: g.ripple,
  }));

  // ── image 13/15: 비용·지연 ──
  const rounds = (state.rounds || []).map((r) => ({ n: r.n, mode: r.mode, agent: r.agent, provider: r.provider, cost: r.cost || 0, latencyMs: r.latencyMs || 0, issueCount: r.output && r.output.issueCount }));
  const budget = state.budget || {};
  const cost = { rounds, spentUsd: budget.spentUsd || 0, capUsd: budget.capUsd || 0, roundsUsed: budget.roundsUsed || 0, maxRounds: budget.maxRounds || 0 };

  // ── spec §9: 사람 결정 필요 ──
  const humanNeeded = pendingHumanDecisions(state);

  return {
    phase: state.phase,
    overall,                                  // image 14 종합
    severity: { fail, warn, low: lowOpen },   // image 14 분류
    passCount,                                // image 19
    issuesByAgent,                            // image 33
    diffs,                                    // image 17
    cost,                                     // image 13/15
    humanNeeded,                              // §9
    consensus: state.consensus || {},
    // §12: 비결정성 고지(UI 필수 문구)
    nondeterministicNotice: '검증은 비결정적입니다. 결과를 참고한 뒤 사람이 최종 확정하세요.',
  };
}

export default { buildViewModel, opDiffClass };
