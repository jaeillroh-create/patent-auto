/**
 * review-engine/profiles/patent/writerAdapter.js
 * ─────────────────────────────────────────────────────────────
 * 엔진-side WriterModule (patent) — 공통 팩토리(_shared/engineWriter) 위의 얇은 래퍼.
 * patent 고유 consistencyRules + mapConsistency(앵커뒷받침/렌더정합 → 3정합 boolean)만 주입.
 * ★ 옵션 B: simulate 근사 정합성만. patent.js 미접촉(실반영·3경로 renderCheck는 브라우저 Patent.applyAmendments).
 * @module review-engine/profiles/patent/writerAdapter
 */
import { makeEngineWriter as makeShared, runConsistencyRules } from '../_shared/engineWriter.js';
import { consistencyRules } from './consistency.js';

/** patent Violation[] → ConsistencyResult 매핑. */
export function mapConsistency(violations) {
  const has = (ruleId) => violations.some((v) => v.ruleId === ruleId);
  return {
    // 청구항↔상세설명(앵커 뒷받침) 정합
    claimSpecOk: !has('patent.anchor_support_structural'),
    // 도면부호 정합(E-11): 3경로 공유 소스 ↔ 부호의 설명
    refSignOk: !has('patent.render_consistency_structural'),
    // 요약/범위 정합
    abstractOk: !has('patent.scope_coverage_structural'),
  };
}

/** ReviewState → 구조적 정합성. state 없으면 중립(true). */
export function structuralConsistency(state) {
  return mapConsistency(state ? runConsistencyRules(consistencyRules, state) : []);
}

/** patent 엔진-side WriterModule (getState 클로저 주입). */
export function makeEngineWriter(getState) {
  return makeShared({ consistencyRules, mapConsistency, getState });
}

export default { makeEngineWriter, structuralConsistency, mapConsistency };
