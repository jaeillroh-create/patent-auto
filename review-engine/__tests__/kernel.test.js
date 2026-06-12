/**
 * review-engine/__tests__/kernel.test.js
 * T1 DoD 골든/단위 테스트 (ESM, 결정적). 에이전트·writer는 모킹 주입.
 * 실행: node review-engine/__tests__/kernel.test.js
 */
import * as stateStore from '../kernel/stateStore.js';
import * as scorer from '../kernel/scorer.js';
import * as convergence from '../kernel/convergence.js';
import * as fingerprint from '../kernel/fingerprint.js';
import * as compiler from '../kernel/amendmentCompiler.js';
import * as orchestrator from '../kernel/orchestrator.js';
import { PHASE, ISSUE_STATUS } from '../contracts/stateSchema.js';

let pass = 0, fail = 0; const fails = [];
function ok(c, n) { if (c) pass++; else { fail++; fails.push('✗ ' + n); } }
function eq(a, b, n) { ok(JSON.stringify(a) === JSON.stringify(b), `${n} (a=${JSON.stringify(a)} b=${JSON.stringify(b)})`); }

// ── 모킹 헬퍼 ──
function mockWriter(consistency) {
  return {
    applyAmendments: async (_c, plans) => ({
      applied: plans.map((p) => p.id), rejected: [],
      consistency: consistency || { claimSpecOk: true, refSignOk: true, abstractOk: true },
      renderCheck: { svg: true, pptx: true, canvas: true }, txnId: 'tx',
    }),
    rollback: async () => ({ ok: true }),
  };
}
function makeProfile(over = {}) {
  return {
    module: 'opinion',
    adaptSnapshot: () => {}, agents: [], issueCatalog: [], consistencyRules: [],
    scoreWeights: over.scoreWeights || { high: 10, medium: 3, scopeShrink: 1, inconsistency: 10, byKind: {} },
    terminationPolicy: over.terminationPolicy || { K: 0, maxRounds: 50, capUsd: 5, perIssueAttemptCap: 2 },
    amendmentOps: over.amendmentOps || [{ op: 'add_limitation' }, { op: 'narrow_scope' }],
    rippleRules: over.rippleRules || [],
    writer: over.writer || mockWriter(),
  };
}
function makeState(tp, claims) {
  const s = stateStore.createState({ reviewId: 'r1', caseId: 'c1', module: 'opinion', terminationPolicy: tp });
  s.claims = claims || [{ id: 'c1', no: 1, type: 'independent', kind: 'general', text: 'X', status: 'open', attempts: 0, history: [] }];
  return s;
}
function issue(o) {
  return { id: o.id, status: o.status || 'open', type: o.type || 'rejection', severity: o.severity || 'high', target: o.target || ['c1'], raisedBy: 'examiner_A', legalBasis: o.legalBasis || '§29', description: o.desc || 'd', coreElement: o.core || o.id, suggestedOp: o.suggestedOp || 'add_limitation', tradeoff: o.tradeoff || false, occurrences: 1, ...o };
}
const ALL_TRUE = { examiner: true, attorney: true, expert: true };
function agent({ discover, recheck, consensus }) {
  return async ({ mode, state, issue: iss }) => {
    if (mode === 'discover') return { issues: discover || [], consensus: consensus || ALL_TRUE, cost: 0.01 };
    return { verdicts: recheck ? recheck(iss, state) : [{ issueId: iss.id, result: 'resolved' }], consensus: consensus || ALL_TRUE, cost: 0.01 };
  };
}

(async function () {
  // ════ A. scorer 단조성 (I-3) ════
  // 점수 계산
  let st = makeState();
  st.issues = [issue({ id: 'i1', severity: 'high' }), issue({ id: 'i2', severity: 'medium' })];
  const sc = scorer.score(st, { high: 10, medium: 3, scopeShrink: 1, inconsistency: 10, byKind: {} });
  eq(sc.score, 13, 'A1: score = 10(high)+3(med) = 13');
  eq(sc.breakdown.highOpen, 1, 'A1: highOpen=1');
  ok(scorer.isMonotonicImprovement(13, 5) === true, 'A2: 점수 하락 → 개선(true)');
  ok(scorer.isMonotonicImprovement(5, 5) === false, 'A3: 점수 정체 → 비개선(false) → 거부');
  ok(scorer.isMonotonicImprovement(5, 6) === false, 'A4: 점수 상승 → 비개선(false) → 거부');

  // ════ B. convergence L1/L3 단위 ════
  st = makeState({ K: 0, maxRounds: 10, capUsd: 5, perIssueAttemptCap: 2 });
  st.issues = [];
  eq(convergence.evaluate(st, { K: 0, maxRounds: 10, capUsd: 5 }).verdict, 'CONVERGED', 'B1: open 0, K=0 → CONVERGED(L1)');
  st.issues = [issue({ id: 'h', severity: 'high' })];
  eq(convergence.evaluate(st, { K: 0, maxRounds: 10, capUsd: 5 }).verdict, 'CONTINUE', 'B2: high open → CONTINUE');
  st.budget.roundsUsed = 10;
  const e = convergence.evaluate(st, { K: 0, maxRounds: 10, capUsd: 5 });
  eq(e.verdict, 'ESCALATE', 'B3: roundsUsed>=maxRounds → ESCALATE(L3) high 있어도');
  ok(convergence.hasUnresolvedHigh(st) === true, 'B3: hasUnresolvedHigh=true');

  // ════ C. orchestrator CONVERGED (path a: consensus=true) — I-4 유한 종료 ════
  compiler._resetSeq();
  let prof = makeProfile({ terminationPolicy: { K: 0, maxRounds: 50, capUsd: 5, perIssueAttemptCap: 2 } });
  st = makeState(prof.terminationPolicy);
  let A = agent({ discover: [issue({ id: 'i1', severity: 'high' }), issue({ id: 'i2', severity: 'high' })], consensus: ALL_TRUE });
  let res = await orchestrator.run(prof, st, { runAgent: A });
  eq(res.phase, PHASE.CONVERGED, 'C1: consensus=true + 전부 해소 → CONVERGED');
  ok(res.budget.roundsUsed < 50, `C1: 유한 라운드 종료 (roundsUsed=${res.budget.roundsUsed})`);
  ok(res.issues.every((i) => i.status === ISSUE_STATUS.RESOLVED), 'C1: 모든 issue 해소');

  // ════ D. orchestrator ESCALATE (path b: consensus=false) — I-4 무한루프 부재 ════
  compiler._resetSeq();
  prof = makeProfile({ terminationPolicy: { K: 0, maxRounds: 6, capUsd: 5, perIssueAttemptCap: 2 } });
  st = makeState(prof.terminationPolicy);
  A = agent({ discover: [issue({ id: 'i1', severity: 'high' })], consensus: { examiner: false, attorney: false, expert: false } });
  res = await orchestrator.run(prof, st, { runAgent: A });
  eq(res.phase, PHASE.ESCALATED, 'D1: consensus=false → CONVERGED 불가 → 캡 도달 ESCALATE');
  ok(res.budget.roundsUsed <= 7, `D1: 유한 종료(roundsUsed=${res.budget.roundsUsed} ≤ maxRounds+1)`);

  // ════ E. 진동 시나리오 (E-08): 단조성 위반 → accepted ════
  compiler._resetSeq();
  // writer가 정합성 실패 회신 → inconsistency 페널티(+10) 가 high 해소(−10) 상쇄 → s1≥s0 → 거부
  prof = makeProfile({ writer: mockWriter({ claimSpecOk: false, refSignOk: true, abstractOk: true }) });
  st = makeState(prof.terminationPolicy);
  A = agent({ discover: [issue({ id: 'i1', severity: 'high' })], consensus: ALL_TRUE });
  res = await orchestrator.run(prof, st, { runAgent: A });
  const i1 = res.issues.find((i) => i.id === 'i1');
  eq(i1.status, ISSUE_STATUS.ACCEPTED, 'E1: 진동(보정 비개선) → accepted (단조성 거부, E-08)');
  ok(res.patchPlans.some((p) => p.scoreAfter >= p.scoreBefore), 'E1: 거부된 plan은 scoreAfter≥scoreBefore 기록');

  // ════ F. occurrences≥2 → deadlock (E-09) ════
  compiler._resetSeq();
  prof = makeProfile();
  st = makeState(prof.terminationPolicy);
  // 동일 (type,target,core) 2건 → fingerprint 병합 occurrences=2
  A = agent({ discover: [issue({ id: 'a', severity: 'high', core: 'same' }), issue({ id: 'b', severity: 'high', core: 'same' })], consensus: ALL_TRUE });
  res = await orchestrator.run(prof, st, { runAgent: A });
  ok(res.issues.length === 1 && res.issues[0].occurrences === 2, 'F1: 동일 지문 2건 병합 occurrences=2');
  eq(res.issues[0].status, ISSUE_STATUS.DEADLOCK, 'F1: occurrences≥2 → deadlock (E-09)');

  // ════ G. attempts≥cap → accepted (E-10) ════
  compiler._resetSeq();
  prof = makeProfile({ terminationPolicy: { K: 0, maxRounds: 50, capUsd: 5, perIssueAttemptCap: 2 } });
  st = makeState(prof.terminationPolicy);
  // recheck가 항상 'remaining' → 해소 안 됨 → attempts 누적 → cap(2) 도달 accepted
  A = agent({ discover: [issue({ id: 'i1', severity: 'high', target: ['c1'] })], consensus: ALL_TRUE, recheck: (iss) => [{ issueId: iss.id, result: 'remaining' }] });
  res = await orchestrator.run(prof, st, { runAgent: A });
  const g1 = res.issues.find((i) => i.id === 'i1');
  eq(g1.status, ISSUE_STATUS.ACCEPTED, 'G1: attempts≥cap → accepted (E-10)');
  eq(res.claims.find((c) => c.id === 'c1').attempts, 2, 'G1: claim.attempts == cap(2)');

  // ════ H. 캡 도달 + high 잔존 → ESCALATE, 자동통과 금지 (E-17) ════
  compiler._resetSeq();
  prof = makeProfile({ terminationPolicy: { K: 0, maxRounds: 1, capUsd: 5, perIssueAttemptCap: 2 } });
  st = makeState(prof.terminationPolicy);
  A = agent({ discover: [issue({ id: 'h1', severity: 'high' }), issue({ id: 'h2', severity: 'high' }), issue({ id: 'h3', severity: 'high' })], consensus: ALL_TRUE });
  res = await orchestrator.run(prof, st, { runAgent: A });
  eq(res.phase, PHASE.ESCALATED, 'H1: 캡 도달 → ESCALATE');
  ok(convergence.hasUnresolvedHigh(res) === true, 'H1: high 잔존 (자동통과 금지)');
  ok(res.issues.filter((i) => i.severity === 'high' && (i.status === 'open' || i.status === 'regression')).length === 3, 'H1: high 3건 미해소 보존(자동 resolved 0건)');

  // ════ I. 종료 보장 — 어떤 시나리오도 roundsUsed가 maxRounds 초과 안 함 (I-4) ════
  ok(res.budget.roundsUsed <= prof.terminationPolicy.maxRounds + 1, 'I1: roundsUsed ≤ maxRounds+1 (무한루프 부재)');

  console.log('='.repeat(54));
  console.log(`review-engine T1 kernel 테스트: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail})`);
  console.log('='.repeat(54));
  if (fails.length) { console.log('\n[실패]'); fails.forEach((f) => console.log(f)); }
  process.exit(fail ? 1 : 0);
})();
