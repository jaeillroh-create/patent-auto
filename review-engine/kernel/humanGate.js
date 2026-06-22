/**
 * review-engine/kernel/humanGate.js
 * ─────────────────────────────────────────────────────────────
 * Human Gate — patchPlans 건별 승인/거부 상태관리 (spec §9, I-2, §12 감사).
 * ★ 불변식 I-2: `patchPlan.accepted` 는 **오직 사람 액션**으로만 바뀐다.
 *   - 코드/엔진이 자동으로 accepted=true 를 설정하는 경로는 존재하지 않는다.
 *   - 본 모듈의 approve/reject 는 호출 시 `actor`(사람 식별자)를 **필수**로 요구하고,
 *     없으면 throw 하여 "익명/자동" 승인을 원천 차단한다.
 * ★ 이 단계는 "읽고 지적만": writer.applyAmendments 를 **호출하지 않는다**(반영은 T6).
 *   승인은 상태(accepted=true)와 감사로그만 남기고, 실제 작성모듈 반영은 후속 태스크가 수행한다.
 *
 * 순수 모듈: orchestrator 등 기존 kernel 로직을 수정하지 않는다(신규 파일).
 * @module review-engine/kernel/humanGate
 */
import * as loggerMod from './logger.js';
import { ISSUE_STATUS, CLAIM_KIND, SEVERITY, PHASE } from '../contracts/stateSchema.js';

/** 게이트 결정 상태(파생값 — accepted 로부터 계산). */
export const GATE_DECISION = Object.freeze({ APPROVED: 'approved', REJECTED: 'rejected', PENDING: 'pending' });

/** plan.accepted(boolean|undefined) → 결정 상태. */
export function decisionOf(plan) {
  if (plan == null || plan.accepted == null) return GATE_DECISION.PENDING;
  return plan.accepted ? GATE_DECISION.APPROVED : GATE_DECISION.REJECTED;
}

/**
 * 사람 승인/거부 공통(내부). accepted 를 사람 액션으로만 설정 + 감사로그(§12).
 * @param {Object} state
 * @param {string} planId
 * @param {boolean} accepted
 * @param {string} actor   사람 식별자(필수 — 없으면 throw, I-2 자동승인 차단)
 * @param {{ note?:string, logger?:Object }} opts
 */
function setDecision(state, planId, accepted, actor, opts = {}) {
  if (!actor || typeof actor !== 'string') {
    throw new Error('humanGate: actor(사람 식별자) 필수 — 자동/익명 accepted 변경 금지 (I-2)');
  }
  const plan = (state.patchPlans || []).find((p) => p.id === planId);
  if (!plan) throw new Error(`humanGate: patchPlan '${planId}' 없음`);
  const logger = opts.logger || loggerMod;
  const from = decisionOf(plan);
  plan.accepted = accepted; // ★ 유일한 accepted 변경 지점(사람 경유)
  const to = decisionOf(plan);
  // §12 감사: 누가·언제·무엇이 왜 — append-only.
  logger.logTransition(state, {
    round: state.budget ? state.budget.roundsUsed : 0,
    kind: 'human_gate', ref: planId, from, to, actor,
    note: opts.note || `사람 ${accepted ? '승인' : '거부'} (반영 보류 — writer 미호출, T6)`,
  });
  return plan;
}

/** 사람 승인 — accepted=true (반영은 T6, 여기선 상태·로그만). */
export function approvePlan(state, planId, actor, opts = {}) {
  return setDecision(state, planId, true, actor, opts);
}

/** 사람 거부 — accepted=false (미승인 로그 보존, spec §9). */
export function rejectPlan(state, planId, actor, opts = {}) {
  return setDecision(state, planId, false, actor, opts);
}

/**
 * 필수 사람결정 집합 (spec §9): deadlock·trade-off·잔여 high(escalate)·unknown kind.
 * 기계 종결 금지 대상을 UI 가 "사람 결정 필요"로 표시할 수 있도록 분류해 반환.
 * @param {Object} state
 * @returns {{ deadlocks:Object[], tradeoffs:Object[], residualHigh:Object[], unknownKind:Object[], required:boolean }}
 */
export function pendingHumanDecisions(state) {
  const issues = state.issues || [];
  const claims = state.claims || [];
  const isOpen = (it) => it.status === ISSUE_STATUS.OPEN || it.status === ISSUE_STATUS.REGRESSION;

  const deadlocks = issues.filter((it) => it.status === ISSUE_STATUS.DEADLOCK);
  const tradeoffs = issues.filter((it) => it.tradeoff === true && it.status !== ISSUE_STATUS.RESOLVED);
  // 잔여 high: escalate 종료인데 high 가 open/regression (E-17 자동통과 금지)
  const residualHigh = state.phase === PHASE.ESCALATED
    ? issues.filter((it) => it.severity === SEVERITY.HIGH && isOpen(it))
    : [];
  const unknownKind = claims.filter((c) => c.kind === CLAIM_KIND.UNKNOWN);

  const required = deadlocks.length + tradeoffs.length + residualHigh.length + unknownKind.length > 0;
  return { deadlocks, tradeoffs, residualHigh, unknownKind, required };
}

/**
 * patchPlan 게이트 뷰(승인 UI 용). accepted 는 읽기만(변경은 approve/reject 경유).
 * @param {Object} state
 * @returns {{ planId:string, addressesIssues:string[], decision:string, accepted:?boolean,
 *             ops:Object[], scoreBefore:number, scoreAfter:number }[]}
 */
export function gateView(state) {
  return (state.patchPlans || []).map((p) => ({
    planId: p.id,
    addressesIssues: p.addressesIssues || [],
    decision: decisionOf(p),
    accepted: p.accepted == null ? null : p.accepted,
    ops: p.ops || [],
    ripple: p.ripple || [],
    scoreBefore: p.scoreBefore,
    scoreAfter: p.scoreAfter,
  }));
}

export default { GATE_DECISION, decisionOf, approvePlan, rejectPlan, pendingHumanDecisions, gateView };
