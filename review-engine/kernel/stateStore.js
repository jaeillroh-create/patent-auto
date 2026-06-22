/**
 * review-engine/kernel/stateStore.js
 * ─────────────────────────────────────────────────────────────
 * Blackboard CRUD + 낙관적 락(version) — spec §3, E-20.
 * 인메모리 결정적 저장소. 모듈명 분기 없음(I-6). 작성모듈 원본 미접근(I-1).
 * @module review-engine/kernel/stateStore
 */
import { REVIEW_STATE_SCHEMA_VERSION, PHASE } from '../contracts/stateSchema.js';

/** 구조적 깊은 복제(결정적, 함수 제외 — 상태는 순수 데이터). */
export function deepClone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

/**
 * 빈 ReviewState 골격 생성 (spec §3). adapter(T2)가 invention/claims/issues 등을 채운다.
 * @param {{reviewId:string, caseId:string, module:string, terminationPolicy?:Object}} seed
 * @returns {import('../contracts/stateSchema.js').ReviewState}
 */
export function createState(seed) {
  const tp = seed.terminationPolicy || {};
  return {
    reviewId: seed.reviewId,
    caseId: seed.caseId,
    module: seed.module,
    schemaVersion: REVIEW_STATE_SCHEMA_VERSION,
    source: { snapshot: null, selfReviewLog: null },
    invention: { title: '', field: '', problem: '', solution: '', keyComponents: [] },
    claims: [],
    spec: { sections: [] },
    citedPrior: [],
    figures: [],
    moduleContext: {},
    issues: [],
    patchPlans: [],
    consensus: { examiner: false, attorney: false, expert: false },
    scoreHistory: [],
    rounds: [],
    transitions: [],
    // 점수 부가 입력(§6.2 scopeShrinkPenalty/inconsistency). orchestrator가 simulate 시 갱신.
    scoreInputs: { scopeShrink: 0, inconsistency: 0 },
    budget: {
      capUsd: tp.capUsd ?? 0,
      spentUsd: 0,
      maxRounds: tp.maxRounds ?? 0,
      roundsUsed: 0,
      perIssueAttemptCap: tp.perIssueAttemptCap ?? 2,
    },
    version: 0,
    lock: null,
    phase: PHASE.IDLE,
  };
}

/**
 * 낙관적 락 기반 변경 적용 (E-20). expectVersion 불일치 시 충돌 throw → 재기준화 요청.
 * mutator는 state를 직접 변형(인메모리)하고, 성공 시 version++.
 * @param {import('../contracts/stateSchema.js').ReviewState} state
 * @param {(s:import('../contracts/stateSchema.js').ReviewState)=>void} mutator
 * @param {number} [expectVersion]  지정 시 현재 version과 일치해야 함
 * @returns {number} 갱신된 version
 */
export function apply(state, mutator, expectVersion) {
  if (expectVersion != null && state.version !== expectVersion) {
    const err = new Error(
      `stateStore: version conflict (expected ${expectVersion}, got ${state.version})`
    );
    err.code = 'VERSION_CONFLICT'; // E-20
    throw err;
  }
  mutator(state);
  state.version += 1;
  return state.version;
}

/** phase 설정 + version 증가 (전이 기록은 호출측 logger 담당). */
export function setPhase(state, phase) {
  return apply(state, (s) => {
    s.phase = phase;
  });
}

/** 읽기전용 스냅샷(복사본) 반환 — 외부 노출용(I-1). */
export function snapshot(state) {
  return deepClone(state);
}

export default { deepClone, createState, apply, setPhase, snapshot };
