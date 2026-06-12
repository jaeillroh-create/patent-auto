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
 * 기능 토글 (spec §10) — 마스터 + 모듈별 (B2).
 *  - `reviewEngine`(마스터): 전역 kill-switch. false면 모듈 토글과 무관하게 전부 무동작.
 *  - `modules`: 모듈별 격리 토글. 마스터 ON 이어도 해당 모듈이 false면 그 모듈은 무동작.
 * 미검증 모듈(division/patent: 프롬프트 본문·라이브 검증 미완)이 마스터 ON 시 동시 활성화되는 것을
 * 구조적으로 차단한다("트리거 부재"라는 우연한 안전에 기대지 않음).
 * 모든 토글 기본값 false. 가변 객체로 노출하여 런타임/테스트에서 토글 가능.
 * @type {{ reviewEngine: boolean, modules: { opinion: boolean, division: boolean, patent: boolean } }}
 */
export const FEATURE_FLAGS = {
  reviewEngine: false,
  modules: { opinion: false, division: false, patent: false },
};

/**
 * 모듈 활성 여부 = 마스터 ON AND 해당 모듈 ON (B2).
 *  - module 인자가 없으면 마스터만 검사(후방호환).
 *  - ★ modules[module]은 데이터 키 조회다(문자열 분기 아님) → I-6 유지.
 * @param {string} [module]  'opinion'|'division'|'patent'
 * @returns {boolean}
 */
export function isModuleEnabled(module) {
  if (!FEATURE_FLAGS.reviewEngine) return false;          // 마스터 OFF → 전부 무동작
  if (module == null) return true;                         // 인자 없음 → 마스터만(후방호환)
  return FEATURE_FLAGS.modules[module] === true;           // 데이터 키 조회(분기 아님)
}

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
  // ── 토글 게이트 (E-21): 마스터 OFF 또는 해당 모듈 OFF면 무동작 즉시 반환 ──
  //    profile.module 은 데이터 키 조회(문자열 분기 아님) → I-6 유지. kernel 미접촉.
  if (!isModuleEnabled(profile && profile.module)) {
    return Object.freeze({
      skipped: true,
      phase: PHASE.IDLE,
      reason: `review-engine OFF (master=${FEATURE_FLAGS.reviewEngine}, module=${profile && profile.module})`,
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
