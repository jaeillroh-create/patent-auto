/**
 * review-engine/profiles/opinion/OpinionProfile.js
 * ─────────────────────────────────────────────────────────────
 * ReviewProfile 계약 구현체 (의견서 — 1순위) — spec §2, §8.1.
 * Core는 이 Profile만 주입받아 동작(I-6). 모듈 특수성(판정 predicate·정합성·op·가중치·정책)을
 * 전부 여기서 소유한다. issueCatalog.severityRule, consistencyRules.check는 함수로 주입.
 * @module review-engine/profiles/opinion/OpinionProfile
 */
import { adaptSnapshot } from './adapter.js';
import { consistencyRules } from './consistency.js';
import { makeEngineWriter } from './writerAdapter.js';

/**
 * 에이전트 구성(선언형, spec §4.2). 실제 프롬프트=T3, 실 LLM 연결=T4.
 * 모델 배정(§4.1): examiner=GPT/Gemini, attorney_author=Claude, attorney_reviewer=GPT, expert=Gemini.
 * @type {import('../../contracts/ReviewProfile.js').AgentDef[]}
 */
export const agents = [
  { id: 'examiner_A', role: 'examiner', provider: 'gpt', temperature: 0.2, mode: 'both', triggers: ['review'], reads: ['claims', 'citedPrior', 'moduleContext'], writes: ['issues'], systemPromptRef: '.claude/rules/agents/opinion/examiner_A.md', outputSchema: 'IssueList', retryPolicy: { maxRetry: 1, onFail: 'escalate' } },
  { id: 'examiner_B', role: 'examiner', provider: 'gemini', temperature: 0.2, mode: 'both', triggers: ['review'], reads: ['claims', 'spec'], writes: ['issues'], systemPromptRef: '.claude/rules/agents/opinion/examiner_B.md', outputSchema: 'IssueList', retryPolicy: { maxRetry: 1, onFail: 'escalate' } },
  { id: 'examiner_C', role: 'examiner', provider: 'gpt', temperature: 0.2, mode: 'both', triggers: ['review'], reads: ['claims', 'moduleContext'], writes: ['issues'], systemPromptRef: '.claude/rules/agents/opinion/examiner_C.md', outputSchema: 'IssueList', retryPolicy: { maxRetry: 1, onFail: 'escalate' } },
  { id: 'attorney_author', role: 'attorney_author', provider: 'claude', temperature: 0.3, mode: 'both', triggers: ['rebut'], reads: ['issues', 'moduleContext'], writes: ['rebuttals'], systemPromptRef: '.claude/rules/agents/opinion/attorney_author.md', outputSchema: 'RebuttalSet', retryPolicy: { maxRetry: 1, onFail: 'escalate' } },
  { id: 'attorney_reviewer', role: 'attorney_reviewer', provider: 'gpt', temperature: 0.2, mode: 'recheck', triggers: ['recheck'], reads: ['issues', 'patchPlans'], writes: ['verdicts'], systemPromptRef: '.claude/rules/agents/opinion/attorney_reviewer.md', outputSchema: 'Verdict', retryPolicy: { maxRetry: 1, onFail: 'escalate' } },
  { id: 'domain_expert', role: 'domain_expert', provider: 'gemini', temperature: 0.3, mode: 'both', triggers: ['review'], reads: ['invention', 'claims'], writes: ['issues'], systemPromptRef: '.claude/rules/agents/opinion/domain_expert.md', outputSchema: 'IssueList', retryPolicy: { maxRetry: 1, onFail: 'escalate' } },
];

/**
 * issue 분류 + severity 판정 predicate (§2 (3), §8.1).
 * severityRule(ctx)→sev. ctx = {issue?, claim?, state?} (Core는 호출만, 판정은 Profile 소유).
 * @type {import('../../contracts/ReviewProfile.js').IssueTypeDef[]}
 */
export const issueCatalog = [
  { type: '거절미해소', legalBasis: '§29/§42', severityRule: () => 'high' },
  {
    type: '신규사항', legalBasis: '§47',
    // 부가(anchorType) 보정의 뒷받침 부재 → high(§47), 그 외 → medium
    severityRule: (ctx) => (ctx && ctx.claim && ctx.claim.anchorType === '부가' ? 'high' : 'medium'),
  },
  { type: '논리결함', legalBasis: '의견논리', severityRule: () => 'medium' },
  { type: '보정범위이탈', legalBasis: '§47', severityRule: () => 'high' },
  { type: '청구항-의견정합', legalBasis: '정합성', severityRule: () => 'medium' },
];

/** scorer 가중치 (§2 (5), §6.2). byKind: anchor 이슈를 더 무겁게(뒷받침 엄격). */
export const scoreWeights = {
  high: 10,
  medium: 3,
  scopeShrink: 1,
  inconsistency: 8,
  byKind: { anchor: 1.5, general: 1.0, unknown: 1.0 },
};

/** 보정 허용 op (§2 (6), §7.1①) — 의견서 도메인. */
export const amendmentOps = [
  { op: 'add_limitation' },   // 한정 부가
  { op: 'narrow_scope' },     // 범위 축소
  { op: 'add_antecedent' },   // 선행기재 보충
  { op: 'fix_term' },         // 용어 정정
  { op: 'add_spec_support' }, // 명세서 뒷받침 보강
  { op: 'merge_claim' },      // 청구항 병합(일부거절 대응)
];

/** Ripple 규칙 (§2 (6), §7.1②) — 보정 → 의견서 주장 정합 추적. */
export const rippleRules = [
  {
    id: 'opinion.amend_to_opinion',
    // 청구항 보정은 의견서 본문(주장)·정합성에 영향 → ripple로 표시(구조적)
    trace: (op) => [{ affected: 'opinion_argument', change: `op ${op.op} on ${op.target} → 의견서 주장 정합 재확인` }],
  },
];

/** 종료 정책 (§2 (7), §13). capUsd=$5(opinion). */
export const terminationPolicy = { K: 1, maxRounds: 12, capUsd: 5, perIssueAttemptCap: 2 };

/**
 * 작성모듈 반영 계약 (§2 (8), §10) — T6 연동(SIMULATE_MODE 옵션 B).
 *  - 엔진-side writer: 단조성 simulate 의 근사 정합성만 산출(makeEngineWriter, writerAdapter.js).
 *    기본값은 state 미주입(중립) — edge 핸들러가 요청별 makeEngineWriter(()=>state) 로 교체 주입한다.
 *  - 실(實)반영(사람 승인분)은 브라우저 Opinion.applyAmendments(opinion.js) 가 담당한다.
 * @type {import('../../contracts/WriterModule.js').WriterModule}
 */
export const writer = makeEngineWriter(() => null);

/** ReviewProfile 8멤버 (spec §2). */
const OpinionProfile = {
  module: 'opinion',          // discriminator
  adaptSnapshot,              // (1)
  agents,                     // (2)
  issueCatalog,               // (3)
  consistencyRules,           // (4)
  scoreWeights,               // (5)
  amendmentOps,               // (6a)
  rippleRules,                // (6b)
  terminationPolicy,          // (7)
  writer,                     // (8)
};

export default OpinionProfile;
export { OpinionProfile };
