/**
 * review-engine/profiles/opinion/writerAdapter.js
 * ─────────────────────────────────────────────────────────────
 * 엔진-side WriterModule (opinion) — T7 이후 공통 팩토리(_shared/engineWriter) 위의 얇은 래퍼.
 *   opinion 고유의 consistencyRules + mapConsistency(opinion ruleId→3정합 boolean)만 주입한다.
 *   공개 API(makeEngineWriter/structuralConsistency)는 T6과 동일 — 기존 동작·테스트 불변(골든).
 *
 * ★ 옵션 B: simulate 근사 정합성만 산출. opinion.js 미접촉(실반영은 브라우저 Opinion.applyAmendments).
 * @module review-engine/profiles/opinion/writerAdapter
 */
import { makeEngineWriter as makeShared, runConsistencyRules } from '../_shared/engineWriter.js';
import { consistencyRules } from './consistency.js';

/** opinion Violation[] → ConsistencyResult 매핑. */
export function mapConsistency(violations) {
  const has = (ruleId) => violations.some((v) => v.ruleId === ruleId);
  return {
    // 청구항↔상세설명(뒷받침) 정합: anchor spec_basis 구조 위반 없음
    claimSpecOk: !has('opinion.anchor_spec_basis_structural'),
    // 도면부호 정합: opinion 도면 미보유(adapter figures=[]) → 항상 OK
    refSignOk: true,
    // 거절 해소(구조) 정합: rejection 미해소 구조 위반 없음
    abstractOk: !has('opinion.rejection_unresolved_structural'),
  };
}

/** ReviewState → 구조적 정합성(ConsistencyResult). state 없으면 중립(true). (T6 공개 API 보존) */
export function structuralConsistency(state) {
  return mapConsistency(state ? runConsistencyRules(consistencyRules, state) : []);
}

/** opinion 엔진-side WriterModule (getState 클로저 주입). (T6 공개 API 보존) */
export function makeEngineWriter(getState) {
  return makeShared({ consistencyRules, mapConsistency, getState });
}

export default { makeEngineWriter, structuralConsistency, mapConsistency };
