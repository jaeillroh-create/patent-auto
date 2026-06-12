/**
 * review-engine/kernel/logger.js
 * ─────────────────────────────────────────────────────────────
 * 라운드·상태전이 append-only 로그 — spec §12, §15, I-5(감사성).
 * 순수 함수: 주어진 state.rounds / state.transitions 배열에 append만 한다(불변 갱신).
 * 모듈명 분기 없음(I-6).
 * @module review-engine/kernel/logger
 */

/**
 * 라운드 레코드를 append (spec §3 rounds[]).
 * @param {import('../contracts/stateSchema.js').ReviewState} state
 * @param {import('../contracts/stateSchema.js').RoundRecord} record
 * @returns {void} state.rounds 에 push (append-only)
 */
export function logRound(state, record) {
  if (!Array.isArray(state.rounds)) state.rounds = [];
  state.rounds.push(Object.freeze({ ...record }));
}

/**
 * issue/엔진 상태 전이를 append. (감사 추적 — 누가·언제·무엇이 왜 바뀌었나)
 * @param {import('../contracts/stateSchema.js').ReviewState} state
 * @param {{round:number, kind:string, ref?:string, from?:string, to:string, actor:string, note?:string}} transition
 * @returns {void}
 */
export function logTransition(state, transition) {
  if (!Array.isArray(state.transitions)) state.transitions = [];
  state.transitions.push(Object.freeze({ ts: Date.now(), ...transition }));
}

/**
 * scoreHistory append (단조성 감사용, spec §3/§6.2).
 * @param {import('../contracts/stateSchema.js').ReviewState} state
 * @param {{round:number, score:number, breakdown:Object}} entry
 * @returns {void}
 */
export function logScore(state, entry) {
  if (!Array.isArray(state.scoreHistory)) state.scoreHistory = [];
  state.scoreHistory.push(Object.freeze({ ...entry }));
}

export default { logRound, logTransition, logScore };
