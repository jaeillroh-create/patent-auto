/**
 * review-engine/contracts/stateSchema.js
 * ─────────────────────────────────────────────────────────────
 * 공통 상태 스키마 (Blackboard) — spec §3.
 * T0 범위: 스키마(타입 계약) + schemaVersion + 열거형 상수만. **로직 없음.**
 *
 * Core(kernel)는 이 스키마의 `module` 문자열 외에 모듈별 분기를 갖지 않는다(I-6).
 * `moduleContext`는 Profile이 채우고 Core는 불투명(opaque) 취급한다.
 * @module review-engine/contracts/stateSchema
 */

/** 스키마 버전. 상태 직렬화 호환성 판정에 사용. */
export const REVIEW_STATE_SCHEMA_VERSION = '0.3.0';

/** ReviewState.phase 허용값 (spec §3). */
export const PHASE = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  CONVERGED: 'converged',
  ESCALATED: 'escalated',
  HUMAN_REVIEW: 'human_review',
  FINALIZED: 'finalized',
});

/** issue.severity 허용값. low는 기록만(루프 미발동, spec §6.1). */
export const SEVERITY = Object.freeze({ HIGH: 'high', MEDIUM: 'medium', LOW: 'low' });

/** issue.status 허용값 (spec §3). */
export const ISSUE_STATUS = Object.freeze({
  OPEN: 'open',
  REBUTTED: 'rebutted',
  AMEND_PLANNED: 'amend_planned',
  RESOLVED: 'resolved',
  ACCEPTED: 'accepted',
  DEADLOCK: 'deadlock',
  REGRESSION: 'regression',
});

/** claim.kind — 차등검증 키 (spec §5). unknown은 격리→사람 유형지정(E-12). */
export const CLAIM_KIND = Object.freeze({ GENERAL: 'general', ANCHOR: 'anchor', UNKNOWN: 'unknown' });

/** claim.type. */
export const CLAIM_TYPE = Object.freeze({ INDEPENDENT: 'independent', DEPENDENT: 'dependent' });

/** 에이전트 동작 모드 (spec §4.4). recheck는 신규지적 금지. */
export const REVIEW_MODE = Object.freeze({ DISCOVER: 'discover', RECHECK: 'recheck' });

/** 지원 모듈 식별자. Profile.module과 1:1 (spec §2). */
export const MODULE = Object.freeze({ PATENT: 'patent', OPINION: 'opinion', DIVISION: 'division' });

/**
 * ── ReviewState 타입 계약 (JSDoc) — spec §3 ──
 * Core는 아래 형상에만 의존한다. 실제 인스턴스 생성/검증 로직은 T1(stateStore)에서 구현.
 *
 * @typedef {Object} ClaimHistoryEntry
 * @property {number} round
 * @property {string} actor
 * @property {string} action
 * @property {string} before
 * @property {string} after
 *
 * @typedef {Object} Claim
 * @property {string} id
 * @property {number} no
 * @property {'independent'|'dependent'} type
 * @property {'general'|'anchor'|'unknown'} kind   차등검증 키 (§5)
 * @property {string} text
 * @property {string} status
 * @property {number} attempts
 * @property {ClaimHistoryEntry[]} history
 *
 * @typedef {Object} SpecSection
 * @property {string} key
 * @property {string} text
 *
 * @typedef {Object} CitedPrior
 * @property {string} id
 * @property {string} label
 * @property {string} summary
 *
 * @typedef {Object} RefSign
 * @property {string} sign
 * @property {string} term
 *
 * @typedef {Object} Figure
 * @property {string} id
 * @property {string} label
 * @property {RefSign[]} refSigns
 *
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string} type
 * @property {'high'|'medium'|'low'} severity
 * @property {string[]} target            영향 ref 목록
 * @property {string} raisedBy
 * @property {string} legalBasis
 * @property {string} description
 * @property {string} fingerprint         동일성 해시 (§6.3)
 * @property {number} occurrences         반복 카운트 (≥2 → deadlock)
 * @property {string} status              ISSUE_STATUS 중 하나
 * @property {?{actor:string, action:string, note:string}} resolution
 *
 * @typedef {Object} PatchOp
 * @property {string} op
 * @property {string} target
 * @property {string} content
 * @property {string} reason              연관 issueId (1:1 추적)
 *
 * @typedef {Object} RippleEntry
 * @property {string} affected
 * @property {string} change
 *
 * @typedef {Object} PatchPlan
 * @property {string} id
 * @property {string[]} addressesIssues
 * @property {PatchOp[]} ops
 * @property {RippleEntry[]} ripple
 * @property {boolean} simulated
 * @property {number} scoreBefore
 * @property {number} scoreAfter
 * @property {?boolean} accepted          사람만 변경 (I-2)
 *
 * @typedef {Object} RoundRecord
 * @property {number} n
 * @property {string} agent
 * @property {'discover'|'recheck'} mode
 * @property {string} inputRef
 * @property {*} output
 * @property {string} provider
 * @property {number} cost
 * @property {number} latencyMs
 * @property {number|string} ts
 *
 * @typedef {Object} Budget
 * @property {number} capUsd
 * @property {number} spentUsd
 * @property {number} maxRounds
 * @property {number} roundsUsed
 * @property {number} perIssueAttemptCap
 *
 * @typedef {Object} ReviewState
 * @property {string} reviewId
 * @property {string} caseId
 * @property {'patent'|'opinion'|'division'} module
 * @property {string} schemaVersion
 * @property {{snapshot:*, selfReviewLog:*}} source       읽기전용 (I-1)
 * @property {{title:string, field:string, problem:string, solution:string, keyComponents:string[]}} invention
 * @property {Claim[]} claims
 * @property {{sections:SpecSection[]}} spec
 * @property {CitedPrior[]} citedPrior
 * @property {Figure[]} figures
 * @property {Object} moduleContext        Profile이 채움, Core는 불투명 취급
 * @property {Issue[]} issues
 * @property {PatchPlan[]} patchPlans
 * @property {{examiner:boolean, attorney:boolean, expert:boolean}} consensus
 * @property {{round:number, score:number, breakdown:Object}[]} scoreHistory
 * @property {RoundRecord[]} rounds
 * @property {Budget} budget
 * @property {number} version              낙관적 동시성 (E-20)
 * @property {*} lock
 * @property {string} phase                PHASE 중 하나
 */

/** @type {undefined} 런타임 export 없음 — 본 파일은 타입 계약·상수만 제공. */
export const __contractOnly = true;
