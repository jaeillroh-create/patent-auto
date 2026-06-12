/**
 * review-engine/profiles/division/DivisionProfile.js
 * ─────────────────────────────────────────────────────────────
 * ReviewProfile 계약 구현체 (분할 — 2순위) — spec §2, §8.2.
 * Core(kernel)는 이 Profile만 주입받아 동작(I-6). 동일 kernel을 변경 없이 사용한다.
 * 분할 특수성(신규사항§47 판정·이중특허·단일성·op·가중치·정책)을 전부 여기서 소유한다.
 * @module review-engine/profiles/division/DivisionProfile
 */
import { adaptSnapshot } from './adapter.js';
import { consistencyRules } from './consistency.js';
import { makeEngineWriter } from './writerAdapter.js';
import { DIVISION_AGENTS } from './agents/index.js';

/** 에이전트 구성(선언형, spec §4.2·§8.2). 모델 배정은 opinion과 동형(편향 상쇄). */
export const agents = DIVISION_AGENTS;

/**
 * issue 분류 + severity 판정 predicate (§2 (3), §8.2).
 * ★ 신규사항(§47) 판정 predicate는 여기(Profile)에 정의 — kernel은 severityRule을 호출만(I-6).
 * @type {import('../../contracts/ReviewProfile.js').IssueTypeDef[]}
 */
export const issueCatalog = [
  {
    type: '신규사항추가', legalBasis: '§47',
    // 추가구성(anchorType='부가')의 신규사항 → high, 그 외 → medium
    severityRule: (ctx) => (ctx && ctx.claim && ctx.claim.anchorType === '부가' ? 'high' : 'medium'),
  },
  { type: '원출원범위이탈', legalBasis: '§47', severityRule: () => 'high' },
  { type: '이중특허', legalBasis: '이중특허', severityRule: () => 'high' },
  { type: '단일성', legalBasis: '§45', severityRule: () => 'medium' },
];

/** scorer 가중치 (§2 (5), §6.2). anchor(추가구성) 이슈를 더 무겁게(§47 엄격). */
export const scoreWeights = {
  high: 10, medium: 3, scopeShrink: 1, inconsistency: 8,
  byKind: { anchor: 1.5, general: 1.0, unknown: 1.0 },
};

/** 보정 허용 op (§2 (6), §7.1①) — 분할 도메인(§47 회피 방향). */
export const amendmentOps = [
  { op: 'add_spec_support' }, // 명세서 근거(spec_source_text) 보강
  { op: 'narrow_to_basis' },  // basis(등록항) 범위로 환원(scopeShrink — 'narrow' 매칭)
  { op: 'remove_component' },  // 신규사항 위험 추가구성 제거
  { op: 'fix_term' },          // 용어 정정(원출원 용어 일치)
];

/** Ripple 규칙 (§2 (6), §7.1②) — 분할항 보정 → basis 보존·이중특허 재확인. */
export const rippleRules = [
  {
    id: 'division.amend_to_basis',
    trace: (op) => [{ affected: 'basis_preservation', change: `op ${op.op} on ${op.target} → basis 보존·이중특허 재확인` }],
  },
];

/** 종료 정책 (§2 (7), §13). capUsd=$8(division). */
export const terminationPolicy = { K: 1, maxRounds: 12, capUsd: 8, perIssueAttemptCap: 2 };

/**
 * 작성모듈 반영 계약 (§2 (8), §10) — 옵션 B.
 *  - 엔진-side: 단조성 simulate 근사 정합성(makeEngineWriter). 기본 state 미주입(중립),
 *    edge가 요청별 makeEngineWriter(()=>state)로 교체.
 *  - 실(實)반영은 브라우저 Division.applyAmendments(division.js)가 담당.
 * @type {import('../../contracts/WriterModule.js').WriterModule}
 */
export const writer = makeEngineWriter(() => null);

/** ReviewProfile 8멤버 (spec §2). */
const DivisionProfile = {
  module: 'division',     // discriminator
  adaptSnapshot,          // (1)
  agents,                 // (2)
  issueCatalog,           // (3)
  consistencyRules,       // (4)
  scoreWeights,           // (5)
  amendmentOps,           // (6a)
  rippleRules,            // (6b)
  terminationPolicy,      // (7)
  writer,                 // (8)
};

export default DivisionProfile;
export { DivisionProfile };
