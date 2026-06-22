/**
 * review-engine/kernel/convergence.js
 * ─────────────────────────────────────────────────────────────
 * 종료 판정 — spec §6.2. T1 범위: L1(Severity Gate) + L3(하드캡)만.
 *   L1: high_open == 0 AND med_open ≤ K   → CONVERGED 후보
 *   L3: roundsUsed ≥ maxRounds OR spentUsd ≥ capUsd → ESCALATE (자동통과 금지, E-17)
 * 수렴신호(consensus)는 orchestrator가 별도 판단(설계 결정 — T4에서 실 consensus).
 * 순수·결정적. 모듈명 분기 없음(I-6). 가중치/정책은 인자 주입.
 * @module review-engine/kernel/convergence
 */
import { openCounts } from './scorer.js';

/** 종료 판정 결과 코드. */
export const VERDICT = Object.freeze({
  CONVERGED: 'CONVERGED', // L1 충족(severity 게이트 통과). orchestrator가 consensus와 AND.
  ESCALATE: 'ESCALATE',   // L3 하드캡 도달. high 잔존 시 자동통과 금지.
  CONTINUE: 'CONTINUE',   // 계속 진행.
});

/**
 * L3(하드캡) 우선 평가 → L1(severity) 평가. L3가 항상 먼저 검사되어 유한 종료를 보장(I-4).
 * @param {import('../contracts/stateSchema.js').ReviewState} state
 * @param {import('../contracts/ReviewProfile.js').TerminationPolicy} terminationPolicy  주입
 * @returns {{verdict:string, highOpen:number, medOpen:number, capReason:?string}}
 */
export function evaluate(state, terminationPolicy) {
  const tp = terminationPolicy || {};
  const b = state.budget || {};
  const maxRounds = tp.maxRounds ?? b.maxRounds ?? 0;
  const capUsd = tp.capUsd ?? b.capUsd ?? 0;
  const K = tp.K ?? 0;

  // ── L3 하드캡 (먼저 평가 — 종료 보장) ──
  let capReason = null;
  if (maxRounds > 0 && (b.roundsUsed || 0) >= maxRounds) capReason = 'maxRounds';
  else if (capUsd > 0 && (b.spentUsd || 0) >= capUsd) capReason = 'capUsd';
  if (capReason) {
    return { verdict: VERDICT.ESCALATE, ...countsOf(state), capReason };
  }

  // ── L1 Severity Gate ──
  const { high, medium } = openCounts(state);
  if (high === 0 && medium <= K) {
    return { verdict: VERDICT.CONVERGED, highOpen: high, medOpen: medium, capReason: null };
  }
  return { verdict: VERDICT.CONTINUE, highOpen: high, medOpen: medium, capReason: null };
}

function countsOf(state) {
  const { high, medium } = openCounts(state);
  return { highOpen: high, medOpen: medium };
}

/** ESCALATE 종료 시 high 잔존 여부(자동통과 금지 판단용, E-17). */
export function hasUnresolvedHigh(state) {
  return openCounts(state).high > 0;
}

export default { VERDICT, evaluate, hasUnresolvedHigh };
