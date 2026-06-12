/**
 * review-engine/profiles/_shared/engineWriter.js
 * ─────────────────────────────────────────────────────────────
 * 모듈 불문 공통 — 엔진-side WriterModule 팩토리 (spec §10, SIMULATE_MODE 옵션 B).
 * T7 Core 추출: T6에서 opinion writerAdapter 에 있던 범용 로직을 끌어올린 것.
 *   - 단조성 simulate 의 "근사 정합성"을 profile 의 consistencyRules 로 산출하고,
 *     profile 별 mapConsistency(violations)→{claimSpecOk,refSignOk,abstractOk} 로 매핑한다.
 *   - opinion/division 양쪽이 자기 rules+mapping 만 주입해 재사용한다(중복 제거, DRY).
 *   - 작성 모듈(opinion.js/division.js)을 절대 건드리지 않는다(실반영은 브라우저가 담당).
 * @module review-engine/profiles/_shared/engineWriter
 */

/** profile.consistencyRules 전체를 state 에 적용해 Violation[] 누적. */
export function runConsistencyRules(consistencyRules, state) {
  const violations = [];
  for (const rule of (consistencyRules || [])) {
    if (typeof rule.check === 'function') {
      for (const v of (rule.check(state) || [])) violations.push(v);
    }
  }
  return violations;
}

/** mapConsistency 미주입 시 기본(중립). */
function defaultMap() { return { claimSpecOk: true, refSignOk: true, abstractOk: true }; }

/**
 * makeEngineWriter — getState 클로저로 ReviewState 를 주입받는 엔진-side WriterModule.
 * @param {{
 *   consistencyRules: Array<{check:(state:Object)=>Array<Object>}>,
 *   mapConsistency?: (violations:Array<Object>, state:?Object)=>{claimSpecOk:boolean,refSignOk:boolean,abstractOk:boolean},
 *   getState: ()=>(Object|null)
 * }} cfg
 * @returns {import('../../contracts/WriterModule.js').WriterModule}
 */
export function makeEngineWriter(cfg) {
  const consistencyRules = (cfg && cfg.consistencyRules) || [];
  const mapC = (cfg && typeof cfg.mapConsistency === 'function') ? cfg.mapConsistency : defaultMap;
  const get = (cfg && typeof cfg.getState === 'function') ? cfg.getState : () => null;
  let _txn = 0;
  return {
    exportSnapshot(/* caseId */) {
      const st = get();
      if (!st) throw new Error('engineWriter.exportSnapshot: state 미주입 — 브라우저에서는 작성모듈 exportSnapshot 사용');
      return {
        snapshot: st.source && st.source.snapshot,
        selfReviewLog: st.source && st.source.selfReviewLog,
        claimsWithKind: (st.claims || []).map((c) => ({ id: c.id, kind: c.kind })),
      };
    },
    async applyAmendments(_caseId, plans, opts) {
      // 엔진 루프는 항상 simulate(orchestrator.js:173). 실반영(simulate:false)은 브라우저가 담당.
      const simulate = !(opts && opts.simulate === false);
      const st = get();
      const violations = st ? runConsistencyRules(consistencyRules, st) : [];
      const consistency = mapC(violations, st);
      return {
        applied: (plans || []).map((p) => p.id),
        rejected: [],
        consistency,
        renderCheck: { svg: true, pptx: true, canvas: true },
        txnId: simulate ? null : ('tx_' + (++_txn)), // simulate → null → orchestrator rollback 미호출
      };
    },
    async rollback(/* caseId, txnId */) {
      // simulate 는 아무것도 쓰지 않았으므로 no-op. 실패 동결(ESCALATE)은 edge 핸들러 책임(E-27).
      return { ok: true };
    },
  };
}

export default { makeEngineWriter, runConsistencyRules };
