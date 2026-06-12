/**
 * review-engine/profiles/division/writerAdapter.js
 * ─────────────────────────────────────────────────────────────
 * 엔진-side WriterModule (division) — 공통 팩토리(_shared/engineWriter) 위의 얇은 래퍼.
 * division 고유 consistencyRules + mapConsistency(§47/이중특허 → 3정합 boolean)만 주입.
 * ★ 옵션 B: simulate 근사 정합성만. division.js 미접촉(실반영은 브라우저 Division.applyAmendments).
 * @module review-engine/profiles/division/writerAdapter
 */
import { makeEngineWriter as makeShared, runConsistencyRules } from '../_shared/engineWriter.js';
import { consistencyRules } from './consistency.js';

/** division Violation[] → ConsistencyResult 매핑. */
export function mapConsistency(violations) {
  const has = (ruleId) => violations.some((v) => v.ruleId === ruleId);
  return {
    // 청구항↔원출원 뒷받침/범위 정합: 신규사항·범위이탈 구조 위반 없음(§47)
    claimSpecOk: !has('division.new_matter_structural') && !has('division.basis_scope_structural'),
    // 도면부호 정합: division 부호정합 skip → 항상 OK
    refSignOk: true,
    // 이중특허(단일성/요약 축으로 근사) 위반 없음
    abstractOk: !has('division.double_patenting_structural'),
  };
}

/** ReviewState → 구조적 정합성. state 없으면 중립(true). */
export function structuralConsistency(state) {
  return mapConsistency(state ? runConsistencyRules(consistencyRules, state) : []);
}

/** division 엔진-side WriterModule (getState 클로저 주입). */
export function makeEngineWriter(getState) {
  return makeShared({ consistencyRules, mapConsistency, getState });
}

export default { makeEngineWriter, structuralConsistency, mapConsistency };
