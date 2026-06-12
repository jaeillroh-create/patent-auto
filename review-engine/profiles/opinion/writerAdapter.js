/**
 * review-engine/profiles/opinion/writerAdapter.js
 * ─────────────────────────────────────────────────────────────
 * 엔진-side WriterModule (spec §10) — SIMULATE_MODE 옵션 B.
 *
 * ★ 책임 분리(옵션 B):
 *   - 단조성용 simulate 의 "근사 정합성"은 **여기서** 산출한다(T2 consistencyRules, 순수 구조검사).
 *     orchestrator 루프는 writer.applyAmendments({simulate:true}) 만 호출하므로(orchestrator.js:173),
 *     이 모듈은 **opinion.js 를 절대 건드리지 않는다**(브라우저 Opinion.state 미접촉).
 *   - 실(實)반영(사람 승인분)은 **브라우저** Opinion.applyAmendments 가 담당한다(opinion.js, T6).
 *   - simulate 는 아무것도 쓰지 않으므로 txnId=null → orchestrator 의 rollback 가드(:181)에서 미호출.
 *
 * getState 클로저로 현재 ReviewState 를 주입받아(요청별) 구조적 정합성을 계산한다.
 * @module review-engine/profiles/opinion/writerAdapter
 */
import { consistencyRules } from './consistency.js';

/** ReviewState → 구조적 정합성(ConsistencyResult). state 없으면 중립(true). */
export function structuralConsistency(state) {
  if (!state) return { claimSpecOk: true, refSignOk: true, abstractOk: true };
  const violations = [];
  for (const rule of consistencyRules) {
    if (typeof rule.check === 'function') {
      for (const v of (rule.check(state) || [])) violations.push(v);
    }
  }
  const has = (ruleId) => violations.some((v) => v.ruleId === ruleId);
  return {
    // 청구항↔상세설명(뒷받침) 정합: anchor spec_basis 구조 위반 없음
    claimSpecOk: !has('opinion.anchor_spec_basis_structural'),
    // 도면부호 정합: opinion 도면 미보유(adapter figures=[]) → 항상 OK
    refSignOk: true,
    // 요약/거절 해소(구조) 정합: rejection 미해소 구조 위반 없음
    abstractOk: !has('opinion.rejection_unresolved_structural'),
  };
}

/**
 * makeEngineWriter — getState 클로저로 ReviewState 를 주입받는 엔진-side WriterModule.
 * @param {()=>(Object|null)} getState  현재 ReviewState 접근자(요청별 주입). 없으면 중립.
 * @returns {import('../../contracts/WriterModule.js').WriterModule}
 */
export function makeEngineWriter(getState) {
  const get = typeof getState === 'function' ? getState : () => null;
  let _txn = 0;
  return {
    exportSnapshot(/* caseId */) {
      const st = get();
      if (!st) throw new Error('engineWriter.exportSnapshot: state 미주입 — 브라우저에서는 Opinion.exportSnapshot 사용');
      return {
        snapshot: st.source && st.source.snapshot,
        selfReviewLog: st.source && st.source.selfReviewLog,
        claimsWithKind: (st.claims || []).map((c) => ({ id: c.id, kind: c.kind })),
      };
    },
    async applyAmendments(_caseId, plans, opts) {
      // 엔진 루프는 항상 simulate. 실반영(simulate:false)은 이 경로로 오지 않는다(브라우저가 담당).
      const simulate = !(opts && opts.simulate === false);
      const consistency = structuralConsistency(get());
      return {
        applied: (plans || []).map((p) => p.id),
        rejected: [],
        consistency,
        renderCheck: { svg: true, pptx: true, canvas: true }, // opinion 3경로 렌더 비해당(E-13)
        txnId: simulate ? null : ('tx_' + (++_txn)),           // simulate → null → rollback 미호출
      };
    },
    async rollback(/* caseId, txnId */) {
      // simulate 는 아무것도 쓰지 않았으므로 no-op. 실패 동결(ESCALATE)은 edge 핸들러 책임(E-27).
      return { ok: true };
    },
  };
}

export default { makeEngineWriter, structuralConsistency };
