/**
 * review-engine/kernel/scorer.js
 * ─────────────────────────────────────────────────────────────
 * 단조성 스칼라 점수 — spec §6.2. 가중치는 Profile 주입(인자), kernel은 모듈을 모름(I-6).
 *   score = w_high·high_open + w_med·med_open + w_shrink·scopeShrink + w_incon·inconsistency
 *   (w는 issue가 가리키는 claim.kind별 분기 배수 byKind 적용)
 * 순수·결정적 함수. 단조성(I-3)은 isMonotonicImprovement 게이트로 호출측이 강제.
 * @module review-engine/kernel/scorer
 */
import { SEVERITY, ISSUE_STATUS } from '../contracts/stateSchema.js';

/** issue가 가리키는 첫 target claim의 kind 반환(없으면 'general' 기본). */
function targetKind(state, issue) {
  const targets = Array.isArray(issue.target) ? issue.target : [];
  for (const ref of targets) {
    const c = state.claims.find((cl) => cl.id === ref || String(cl.no) === String(ref));
    if (c && c.kind) return c.kind;
  }
  return 'general';
}

/**
 * 상태 점수 계산.
 * @param {import('../contracts/stateSchema.js').ReviewState} state
 * @param {import('../contracts/ReviewProfile.js').ScoreWeights} weights  주입(profile.scoreWeights)
 * @returns {{score:number, breakdown:{high:number, medium:number, scopeShrink:number, inconsistency:number,
 *   highOpen:number, medOpen:number}}}
 */
export function score(state, weights) {
  const w = weights || {};
  const byKind = w.byKind || {};
  let highTerm = 0, medTerm = 0, highOpen = 0, medOpen = 0;

  for (const issue of state.issues) {
    if (issue.status !== ISSUE_STATUS.OPEN && issue.status !== ISSUE_STATUS.REGRESSION) continue;
    const mult = byKind[targetKind(state, issue)] ?? 1;
    if (issue.severity === SEVERITY.HIGH) { highTerm += (w.high ?? 0) * mult; highOpen += 1; }
    else if (issue.severity === SEVERITY.MEDIUM) { medTerm += (w.medium ?? 0) * mult; medOpen += 1; }
    // low: 점수 미반영(기록만, §6.1)
  }

  const si = state.scoreInputs || { scopeShrink: 0, inconsistency: 0 };
  const shrinkTerm = (w.scopeShrink ?? 0) * (si.scopeShrink || 0);
  const inconTerm = (w.inconsistency ?? 0) * (si.inconsistency || 0);

  const total = highTerm + medTerm + shrinkTerm + inconTerm;
  return {
    score: total,
    breakdown: {
      high: highTerm, medium: medTerm, scopeShrink: shrinkTerm, inconsistency: inconTerm,
      highOpen, medOpen,
    },
  };
}

/** open(또는 regression) high/medium issue 개수 (convergence L1용). */
export function openCounts(state) {
  let high = 0, medium = 0, low = 0;
  for (const it of state.issues) {
    if (it.status !== ISSUE_STATUS.OPEN && it.status !== ISSUE_STATUS.REGRESSION) continue;
    if (it.severity === SEVERITY.HIGH) high += 1;
    else if (it.severity === SEVERITY.MEDIUM) medium += 1;
    else low += 1;
  }
  return { high, medium, low };
}

/**
 * 단조 개선 판정 (I-3 핵심 게이트). 채택 보정은 점수를 "반드시" 낮춰야 한다.
 * scoreAfter ≥ scoreBefore 이면 개선 아님 → 호출측은 거부(rollback)·accepted 처리(§6.2).
 * @param {number} scoreBefore
 * @param {number} scoreAfter
 * @returns {boolean} true면 개선(채택 가능), false면 비개선(거부)
 */
export function isMonotonicImprovement(scoreBefore, scoreAfter) {
  return scoreAfter < scoreBefore;
}

export default { score, openCounts, isMonotonicImprovement };
