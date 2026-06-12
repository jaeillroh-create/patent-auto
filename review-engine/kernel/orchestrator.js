/**
 * review-engine/kernel/orchestrator.js
 * ─────────────────────────────────────────────────────────────
 * 수렴 라운드 루프 — spec §6.4. 에이전트(runAgent)·writer는 의존성 주입(모킹 가능).
 * 모듈명 분기 없음(I-6). 모듈 특수성(가중치/정책/op/ripple/runAgent/writer)은 전부 인자.
 *
 * 종료 보장(I-4): 모든 외부 루프 1회는 budget.roundsUsed 를 1 증가시킨다 →
 *   convergence.evaluate가 L3(roundsUsed≥maxRounds)를 먼저 검사하므로 최대 maxRounds회 후
 *   반드시 ESCALATE. 무한루프 불가.
 * 단조성(I-3): simulate 점수 s1 ≥ s0 이면 보정 거부(rollback)+accepted (진동/trade-off 차단).
 * 자동통과 금지(E-17): ESCALATE 종료 시 high 잔존을 해소된 것으로 처리하지 않는다.
 *
 * @module review-engine/kernel/orchestrator
 */
import { PHASE, ISSUE_STATUS, REVIEW_MODE } from '../contracts/stateSchema.js';
import * as scorerMod from './scorer.js';
import * as convergenceMod from './convergence.js';
import * as compilerMod from './amendmentCompiler.js';
import * as fingerprintMod from './fingerprint.js';
import * as stateStoreMod from './stateStore.js';
import * as loggerMod from './logger.js';

const NARROW_RE = /narrow|shrink|limit|한정|축소/i;

/** consensus 3주체 전부 true 인가 (수렴신호, §6.1 — T1은 orchestrator가 판단). */
function consensusReached(state) {
  const c = state.consensus || {};
  return c.examiner === true && c.attorney === true && c.expert === true;
}

/** 우선순위 정렬: [anchor 뒷받침, high, medium], 동순위는 occurrences desc → id (결정적). */
function prioritize(state) {
  const open = state.issues.filter(
    (it) => it.status === ISSUE_STATUS.OPEN || it.status === ISSUE_STATUS.REGRESSION
  );
  const kindOf = (issue) => {
    const t = (issue.target && issue.target[0]) || '';
    const c = state.claims.find((cl) => cl.id === t || String(cl.no) === String(t));
    return c ? c.kind : 'general';
  };
  return open.sort((a, b) => {
    const aa = kindOf(a) === 'anchor' ? 0 : 1;
    const ba = kindOf(b) === 'anchor' ? 0 : 1;
    if (aa !== ba) return aa - ba;
    const sev = (x) => (x.severity === 'high' ? 0 : x.severity === 'medium' ? 1 : 2);
    if (sev(a) !== sev(b)) return sev(a) - sev(b);
    if ((b.occurrences || 1) !== (a.occurrences || 1)) return (b.occurrences || 1) - (a.occurrences || 1);
    return String(a.id).localeCompare(String(b.id));
  });
}

/** issue가 가리키는 claim(없으면 null). attempts 카운팅 단위. */
function targetClaim(state, issue) {
  const t = (issue.target && issue.target[0]) || '';
  return state.claims.find((cl) => cl.id === t || String(cl.no) === String(t)) || null;
}
function attemptsOf(state, issue) {
  const c = targetClaim(state, issue);
  return c ? (c.attempts || 0) : (issue.attempts || 0);
}
function bumpAttempts(state, issue) {
  const c = targetClaim(state, issue);
  if (c) c.attempts = (c.attempts || 0) + 1;
  else issue.attempts = (issue.attempts || 0) + 1;
}

/** simulate 반영본 생성: 대상 issue 잠정 해소 + 구조적 페널티(scopeShrink/inconsistency). */
function simulateApply(state, plan, applyRes, deps) {
  const sim = deps.stateStore.deepClone(state);
  for (const id of plan.addressesIssues) {
    const it = sim.issues.find((i) => i.id === id);
    if (it) { it.status = ISSUE_STATUS.RESOLVED; it.resolution = { actor: 'engine', action: 'simulate_resolve', note: plan.id }; }
  }
  if (!sim.scoreInputs) sim.scoreInputs = { scopeShrink: 0, inconsistency: 0 };
  const narrowCount = plan.ops.filter((o) => NARROW_RE.test(o.op)).length;
  sim.scoreInputs.scopeShrink += narrowCount;
  const cons = applyRes && applyRes.consistency;
  const consistencyFail = cons && !(cons.claimSpecOk && cons.refSignOk && cons.abstractOk);
  if (consistencyFail) sim.scoreInputs.inconsistency += 1;
  return sim;
}

/** 새 issue들을 fingerprint 병합으로 반영(occurrences 증가 포함). consensus 갱신. */
function ingest(state, agentOut, deps) {
  if (Array.isArray(agentOut.issues)) {
    for (const raw of agentOut.issues) {
      const issue = { status: ISSUE_STATUS.OPEN, occurrences: 1, ...raw };
      deps.fingerprint.mergeIssue(state, issue);
    }
  }
  if (agentOut.consensus) state.consensus = { ...state.consensus, ...agentOut.consensus };
}

/**
 * 수렴 루프 실행.
 * @param {import('../contracts/ReviewProfile.js').ReviewProfile} profile
 * @param {import('../contracts/stateSchema.js').ReviewState} state
 * @param {{ runAgent:Function, scorer?:Object, convergence?:Object, compiler?:Object,
 *           fingerprint?:Object, stateStore?:Object, logger?:Object }} deps  runAgent 필수(DI)
 * @returns {Promise<import('../contracts/stateSchema.js').ReviewState>} 종료 상태(phase converged|escalated)
 */
export async function run(profile, state, deps) {
  deps = deps || {};
  if (typeof deps.runAgent !== 'function') throw new Error('orchestrator.run: deps.runAgent (function) required');
  const D = {
    runAgent: deps.runAgent,
    scorer: deps.scorer || scorerMod,
    convergence: deps.convergence || convergenceMod,
    compiler: deps.compiler || compilerMod,
    fingerprint: deps.fingerprint || fingerprintMod,
    stateStore: deps.stateStore || stateStoreMod,
    logger: deps.logger || loggerMod,
  };
  const tp = profile.terminationPolicy || {};
  const weights = profile.scoreWeights || {};
  const writer = profile.writer;

  state.phase = PHASE.RUNNING;

  // ── R1: discover (전수 발굴) ──
  const r1 = await D.runAgent({ mode: REVIEW_MODE.DISCOVER, state });
  state.budget.spentUsd += r1.cost || 0;
  state.budget.roundsUsed += 1;
  ingest(state, r1, D);
  D.logger.logRound(state, { n: state.budget.roundsUsed, agent: r1.agent || 'examiners', mode: REVIEW_MODE.DISCOVER, inputRef: 'snapshot', output: { issueCount: state.issues.length }, provider: r1.provider || 'mock', cost: r1.cost || 0, latencyMs: r1.latencyMs || 0, ts: Date.now() });

  // ── 수렴 루프 ──
  // 종료 보장: 매 반복 roundsUsed 최소 1 증가(아래 끝) → convergence가 L3로 반드시 종료.
  for (;;) {
    const conv = D.convergence.evaluate(state, tp);

    if (conv.verdict === D.convergence.VERDICT.ESCALATE) {
      state.phase = PHASE.ESCALATED; // E-17: high 잔존이어도 자동통과 금지(해소 처리 안 함)
      D.logger.logTransition(state, { round: state.budget.roundsUsed, kind: 'engine', to: PHASE.ESCALATED, actor: 'engine', note: `cap:${conv.capReason}; highOpen=${conv.highOpen}` });
      break;
    }
    if (conv.verdict === D.convergence.VERDICT.CONVERGED && consensusReached(state)) {
      state.phase = PHASE.CONVERGED;
      D.logger.logTransition(state, { round: state.budget.roundsUsed, kind: 'engine', to: PHASE.CONVERGED, actor: 'engine', note: `medOpen=${conv.medOpen}` });
      break;
    }
    // (CONVERGED 이나 consensus 미충족 → 계속 진행. 처리할 open이 없으면 라운드만 소진하다 L3로 ESCALATE.)

    const queue = prioritize(state);
    for (const issue of queue) {
      // 진동/교착(§6.3) — occurrences≥2 → deadlock(사람)
      if ((issue.occurrences || 1) >= 2) {
        issue.status = ISSUE_STATUS.DEADLOCK;
        D.logger.logTransition(state, { round: state.budget.roundsUsed, kind: 'issue', ref: issue.id, from: ISSUE_STATUS.OPEN, to: ISSUE_STATUS.DEADLOCK, actor: 'engine', note: 'occurrences>=2 (E-09)' });
        continue;
      }
      // 예산(§6.3) — attempts≥cap → accepted
      if (attemptsOf(state, issue) >= (state.budget.perIssueAttemptCap || 2)) {
        issue.status = ISSUE_STATUS.ACCEPTED;
        D.logger.logTransition(state, { round: state.budget.roundsUsed, kind: 'issue', ref: issue.id, from: ISSUE_STATUS.OPEN, to: ISSUE_STATUS.ACCEPTED, actor: 'engine', note: 'attempts>=cap (E-10)' });
        continue;
      }
      // 권리범위 trade-off(§5.3) → deadlock(사람)
      if (issue.tradeoff === true) {
        issue.status = ISSUE_STATUS.DEADLOCK;
        D.logger.logTransition(state, { round: state.budget.roundsUsed, kind: 'issue', ref: issue.id, from: ISSUE_STATUS.OPEN, to: ISSUE_STATUS.DEADLOCK, actor: 'engine', note: 'scope trade-off (§5.3)' });
        continue;
      }
      if (!writer) {
        // simulate 불가(writer 미주입) → 자동해소 불가, 사람 결정
        issue.status = ISSUE_STATUS.DEADLOCK;
        continue;
      }

      // 보정 컴파일 → simulate → 단조성 게이트
      const plan = D.compiler.compile(issue, profile.amendmentOps, profile.rippleRules, state);
      const s0 = D.scorer.score(state, weights).score;
      const applyRes = await writer.applyAmendments(state.caseId, [plan], { simulate: true });
      const sim = simulateApply(state, plan, applyRes, D);
      const s1 = D.scorer.score(sim, weights).score;
      plan.simulated = true; plan.scoreBefore = s0; plan.scoreAfter = s1;
      state.patchPlans.push(plan);

      if (!D.scorer.isMonotonicImprovement(s0, s1)) {
        // 비개선 → 거부(rollback)+accepted (L2 단조성, E-08 진동/trade-off 차단)
        if (typeof writer.rollback === 'function' && applyRes.txnId) await writer.rollback(state.caseId, applyRes.txnId);
        issue.status = ISSUE_STATUS.ACCEPTED;
        D.logger.logScore(state, { round: state.budget.roundsUsed, score: s0, breakdown: { rejectedPlan: plan.id, s1 } });
        D.logger.logTransition(state, { round: state.budget.roundsUsed, kind: 'issue', ref: issue.id, from: ISSUE_STATUS.OPEN, to: ISSUE_STATUS.ACCEPTED, actor: 'engine', note: `monotonicity reject s1(${s1})>=s0(${s0}) (E-08)` });
        continue;
      }

      // 개선 → 커밋 + recheck
      state.issues = sim.issues;
      state.scoreInputs = sim.scoreInputs;
      const rc = await D.runAgent({ mode: REVIEW_MODE.RECHECK, state, issue });
      state.budget.spentUsd += rc.cost || 0;
      if (rc.consensus) state.consensus = { ...state.consensus, ...rc.consensus };
      for (const v of rc.verdicts || []) {
        if (v.result === 'regression') {
          const reg = { status: ISSUE_STATUS.OPEN, occurrences: 1, severity: v.severity || 'high', type: v.type || 'regression', target: v.target || issue.target, description: v.note || 'regression', legalBasis: v.legalBasis || '', coreElement: v.coreElement, id: v.id || `reg_${state.issues.length + 1}`, regressionOf: v.regressionOf || issue.id };
          D.fingerprint.mergeIssue(state, reg); // 동일 지문이면 occurrences++ → 추후 deadlock
        } else if (v.result === 'remaining') {
          const it = state.issues.find((i) => i.id === v.issueId);
          if (it) it.status = ISSUE_STATUS.OPEN; // 미해소 → 재개
        }
        // resolved: 이미 sim에서 resolved 유지
      }
      bumpAttempts(state, issue);
      D.logger.logScore(state, { round: state.budget.roundsUsed, score: s1, breakdown: D.scorer.score(state, weights).breakdown });
      D.logger.logRound(state, { n: state.budget.roundsUsed, agent: 'recheck', mode: REVIEW_MODE.RECHECK, inputRef: issue.id, output: { verdicts: (rc.verdicts || []).length }, provider: rc.provider || 'mock', cost: rc.cost || 0, latencyMs: rc.latencyMs || 0, ts: Date.now() });
      break; // 한 보정 후 수렴 재평가
    }

    // ── 종료 보장(I-4): 매 외부 반복 라운드 1 증가 ──
    state.budget.roundsUsed += 1;
  }

  return state;
}

export default { run };
