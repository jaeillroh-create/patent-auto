/**
 * review-engine/contracts/ReviewProfile.js
 * ─────────────────────────────────────────────────────────────
 * ReviewProfile 인터페이스 (통합 계약) — spec §2.
 * T0 범위: JSDoc 타입 계약 + 멤버 목록 상수만. **로직 없음.**
 *
 * 설계 원칙(spec §2.1):
 *  - 데이터가 아니라 "행위(predicate)"까지 주입 → 모듈 특수성이 Core로 새지 않음(I-6).
 *  - Core는 predicate를 호출만 하고 결과(boolean/severity)만 받는다.
 *  - 신규 모듈 = 신규 Profile 1개. Core 불변.
 *
 * @module review-engine/contracts/ReviewProfile
 */

/**
 * ReviewProfile 계약 멤버 목록 (spec §2의 번호 (1)~(8) + discriminator `module`).
 * 계약 적합성 검증(T2 이후)과 DoD 증명에 사용한다.
 * (6)은 단일 번호 아래 amendmentOps + rippleRules 두 필드를 묶는다(spec §2 (6)).
 * @type {ReadonlyArray<{n:number|null, key:string|string[], kind:'field'|'method'|'array'}>}
 */
export const REVIEW_PROFILE_MEMBERS = Object.freeze([
  { n: null, key: 'module',            kind: 'field'  }, // discriminator: "patent"|"opinion"|"division"
  { n: 1,    key: 'adaptSnapshot',     kind: 'method' }, // (1) 입력 어댑터: WriterSnapshot → ReviewState
  { n: 2,    key: 'agents',            kind: 'array'  }, // (2) 에이전트 구성 (AgentDef[])
  { n: 3,    key: 'issueCatalog',      kind: 'array'  }, // (3) issue 분류 + severityRule predicate
  { n: 4,    key: 'consistencyRules',  kind: 'array'  }, // (4) 정합성 규칙 (check(state)→Violation[])
  { n: 5,    key: 'scoreWeights',      kind: 'field'  }, // (5) scorer 가중치 + kind별 분기 배수
  { n: 6,    key: ['amendmentOps', 'rippleRules'], kind: 'array' }, // (6) 보정 op 허용집합 + Ripple 규칙
  { n: 7,    key: 'terminationPolicy', kind: 'field'  }, // (7) 종료 정책 {K, maxRounds, capUsd, perIssueAttemptCap}
  { n: 8,    key: 'writer',            kind: 'field'  }, // (8) 작성모듈 반영 계약 (WriterModule)
]);

/** 평탄화된 필수 키 집합(검증 편의용). (6)의 두 키를 모두 포함. */
export const REVIEW_PROFILE_REQUIRED_KEYS = Object.freeze(
  REVIEW_PROFILE_MEMBERS.flatMap((m) => (Array.isArray(m.key) ? m.key : [m.key]))
);

/**
 * ── ReviewProfile 타입 계약 (JSDoc) — spec §2 ──
 *
 * @typedef {Object} AgentDef                         spec §4.2
 * @property {string} id
 * @property {string} role
 * @property {string} provider
 * @property {number} temperature
 * @property {'discover'|'recheck'|'both'} mode
 * @property {string[]} triggers
 * @property {string[]} reads
 * @property {string[]} writes
 * @property {string} systemPromptRef                 .claude/rules/agents/<module>/<id>.md
 * @property {Object} outputSchema
 * @property {{maxRetry:number, onFail:string}} retryPolicy
 *
 * @typedef {Object} IssueTypeDef                      spec §2 (3)
 * @property {string} type
 * @property {string} legalBasis
 * @property {(ctx:*)=>('high'|'medium'|'low')} severityRule   판정 predicate (Core는 호출만)
 *
 * @typedef {Object} ConsistencyRule                   spec §2 (4)
 * @property {string} id
 * @property {string} scope
 * @property {(state:import('./stateSchema.js').ReviewState)=>Array<Object>} check  Violation[] 반환
 *
 * @typedef {Object} ScoreWeights                      spec §2 (5), §6.2
 * @property {number} high
 * @property {number} medium
 * @property {number} scopeShrink
 * @property {number} inconsistency
 * @property {Object<string, number>} byKind           claim.kind별 분기 배수
 *
 * @typedef {Object} OpDef                             spec §2 (6), §7.1①
 * @property {string} op
 * @property {Object} [params]
 *
 * @typedef {Object} RippleRule                        spec §2 (6), §7.1②
 * @property {string} id
 * @property {(op:OpDef, state:*)=>Array<Object>} trace   전파 영향 반환
 *
 * @typedef {Object} TerminationPolicy                 spec §2 (7)
 * @property {number} K                                medium 종료 임계 (§6.1)
 * @property {number} maxRounds
 * @property {number} capUsd
 * @property {number} perIssueAttemptCap
 *
 * @typedef {Object} ReviewProfile
 * @property {'patent'|'opinion'|'division'} module
 * @property {(raw:*, selfReview:*)=>import('./stateSchema.js').ReviewState} adaptSnapshot  (1)
 * @property {AgentDef[]} agents                         (2)
 * @property {IssueTypeDef[]} issueCatalog               (3)
 * @property {ConsistencyRule[]} consistencyRules        (4)
 * @property {ScoreWeights} scoreWeights                 (5)
 * @property {OpDef[]} amendmentOps                      (6a)
 * @property {RippleRule[]} rippleRules                  (6b)
 * @property {TerminationPolicy} terminationPolicy       (7)
 * @property {import('./WriterModule.js').WriterModule} writer  (8)
 */

export const __contractOnly = true;
