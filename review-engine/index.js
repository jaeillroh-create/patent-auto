/**
 * review-engine/index.js
 * ─────────────────────────────────────────────────────────────
 * 통합 리뷰 엔진 진입점 — spec §1.2, §10, §18.
 * T0 범위: `engine.run(profile, snapshot)` 시그니처 스텁 + 토글 게이트만. **수렴 로직 없음.**
 *
 * 동작:
 *  - FEATURE_FLAGS.reviewEngine === false  → 무동작 즉시 return (E-21, I-1 보강).
 *  - true                                  → 커널 미구현(T1) → 명시적 에러로 차단.
 *    (T0에서 ON 경로를 가짜로 통과시키지 않는다. 커널은 T1에서 orchestrator 주입.)
 *
 * @module review-engine
 */

import { PHASE } from './contracts/stateSchema.js';

/**
 * 기능 토글 (spec §10). OFF가 기본값 — T0~P1 동안 리뷰 엔진은 비활성.
 * 가변 객체로 노출하여 런타임/테스트에서 토글 가능.
 * @type {{ reviewEngine: boolean }}
 */
export const FEATURE_FLAGS = { reviewEngine: false };

/**
 * 토글 OFF 시 반환되는 무동작 결과.
 * @typedef {Object} SkippedResult
 * @property {true} skipped
 * @property {'idle'} phase
 * @property {string} reason
 */

/**
 * 엔진 실행 진입점 (spec §1.2: Core는 Profile 구현체를 런타임 주입으로만 획득).
 * T0: 토글 게이트만. 실제 라운드 루프는 T1 orchestrator에서 구현.
 *
 * @param {import('./contracts/ReviewProfile.js').ReviewProfile} profile
 * @param {import('./contracts/stateSchema.js').ReviewState} snapshot
 * @returns {SkippedResult}  토글 OFF 시. (ON 시 throw — T0 미구현)
 */
function run(profile, snapshot) {
  // ── 토글 게이트 (E-21): OFF면 어떤 일도 하지 않고 즉시 반환 ──
  if (!FEATURE_FLAGS.reviewEngine) {
    return Object.freeze({
      skipped: true,
      phase: PHASE.IDLE,
      reason: 'FEATURE_FLAGS.reviewEngine is OFF (T0 scaffolding)',
    });
  }

  // ── ON 경로: 커널 미구현 (T1) — 가짜 통과 금지, 명시적 차단 ──
  // 주의: 여기에 모듈명 문자열 분기를 두지 않는다(I-6). 커널은 Profile만 의존.
  throw new Error(
    'review-engine: kernel not implemented yet (T0 scaffolding only; see worksheet T1)'
  );
}

/** 엔진 공개 API. */
export const engine = Object.freeze({ run });

export default engine;
