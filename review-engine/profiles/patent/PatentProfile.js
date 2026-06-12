/**
 * review-engine/profiles/patent/PatentProfile.js
 * ─────────────────────────────────────────────────────────────
 * ReviewProfile 계약 구현체 (특허 작성 — 3순위, 최복잡) — spec §2, §8.3, §8.4, §5.
 * Core(kernel)는 이 Profile만 주입받아 동작(I-6). 동일 kernel을 변경 없이 사용한다.
 * 특허 특수성(진보성/기재불비/명확성/단일성/실시가능성 판정·3경로 정합·general/anchor 차등)을 소유.
 * @module review-engine/profiles/patent/PatentProfile
 */
import { adaptSnapshot } from './adapter.js';
import { consistencyRules } from './consistency.js';
import { makeEngineWriter } from './writerAdapter.js';
import { PATENT_AGENTS } from './agents/index.js';

export const agents = PATENT_AGENTS;

/**
 * issue 분류 + severity 판정 predicate (§2 (3), §8.3, §5).
 * ★ general/anchor 차등(§5): 앵커 뒷받침(기재불비)은 anchor 에서 엄격(high),
 *   진보성은 general 에서 강하게(high), anchor 는 관대(medium).
 * @type {import('../../contracts/ReviewProfile.js').IssueTypeDef[]}
 */
export const issueCatalog = [
  {
    type: '진보성', legalBasis: '§29②',
    // §5: general 과광범 → 진보성 부정 위험 high, anchor 는 관대(medium)
    severityRule: (ctx) => (ctx && ctx.claim && ctx.claim.kind === 'anchor' ? 'medium' : 'high'),
  },
  { type: '신규성', legalBasis: '§29①', severityRule: () => 'high' },
  {
    type: '기재불비', legalBasis: '§42④',
    // §5.2: anchor 뒷받침 부재 → high(앵커 1차 관문), general → medium
    severityRule: (ctx) => (ctx && ctx.claim && ctx.claim.kind === 'anchor' ? 'high' : 'medium'),
  },
  { type: '명확성', legalBasis: '§42④', severityRule: () => 'medium' },
  { type: '단일성', legalBasis: '§45', severityRule: () => 'medium' },
  { type: '실시가능성', legalBasis: '§42③', severityRule: () => 'medium' },
];

/** scorer 가중치 (§2 (5), §6.2, §5). anchor 이슈(뒷받침)를 더 무겁게. */
export const scoreWeights = {
  high: 10, medium: 3, scopeShrink: 1, inconsistency: 8,
  byKind: { anchor: 1.5, general: 1.0, unknown: 1.0 },
};

/** 보정 허용 op (§2 (6), §7.1①) — 특허 작성 도메인. */
export const amendmentOps = [
  { op: 'add_spec_support' }, // 상세설명 뒷받침 보강(앵커 1차 관문 대응)
  { op: 'add_limitation' },   // 한정 부가(진보성)
  { op: 'narrow_scope' },     // 범위 축소(general 과광범)
  { op: 'fix_ref_sign' },     // 도면부호 정정(E-11 3경로 정합)
  { op: 'fix_term' },         // 용어 정정(명확성)
];

/** Ripple 규칙 (§2 (6), §7.1②) — 청구항 보정 → 상세설명·도면·요약 정합 재확인. */
export const rippleRules = [
  {
    id: 'patent.amend_to_spec_figures',
    trace: (op) => [
      { affected: 'detail_support', change: `op ${op.op} on ${op.target} → 상세설명 뒷받침 재확인` },
      { affected: 'render_3path', change: `op ${op.op} on ${op.target} → 도면 3경로(SVG/PPTX/Canvas) 정합 재확인(E-11)` },
    ],
  },
];

/** 종료 정책 (§2 (7), §13). capUsd=$15(patent, 최복잡). */
export const terminationPolicy = { K: 1, maxRounds: 12, capUsd: 15, perIssueAttemptCap: 2 };

/**
 * 작성모듈 반영 계약 (§2 (8), §10) — 옵션 B.
 *  - 엔진-side: 단조성 simulate 근사 정합성(makeEngineWriter). 기본 state 미주입(중립),
 *    edge가 요청별 makeEngineWriter(()=>state)로 교체.
 *  - 실(實)반영 + 3경로 renderCheck(E-11)는 브라우저 Patent.applyAmendments(patent.js)가 담당.
 * @type {import('../../contracts/WriterModule.js').WriterModule}
 */
export const writer = makeEngineWriter(() => null);

/** ReviewProfile 8멤버 (spec §2). */
const PatentProfile = {
  module: 'patent',
  adaptSnapshot, agents, issueCatalog, consistencyRules,
  scoreWeights, amendmentOps, rippleRules, terminationPolicy, writer,
};

export default PatentProfile;
export { PatentProfile };
