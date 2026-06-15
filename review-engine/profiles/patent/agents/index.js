/**
 * review-engine/profiles/patent/agents/index.js
 * 특허(patent) 도메인 에이전트 정의 배럴 (spec §4.2, §8.3, §8.4). 선언형.
 *
 * ★ T8 범위: 선언형 정의 + outputSchemaByMode(구조). LLM 프롬프트 본문(.md)은 후속
 *   (DoD의 앵커 뒷받침/3경로 정합/중복판정은 consistency 구조검사로 동작 — LLM 불필요).
 * 적대 초점(§8.3): 진보성·신규성·기재불비·명확성·단일성·실시가능성.
 * 자기검토 2단방어(§8.4): selfReviewLog 를 reads 에 포함해 통과근거를 알고 적대(중복판정은 consistency dedupe).
 * @module review-engine/profiles/patent/agents
 */
const A = (o) => Object.freeze(Object.assign({
  temperature: 0.2, maxTokens: 4096, mode: 'both', triggers: ['review'],
  retryPolicy: { maxRetry: 1, onFail: 'escalate' },
}, o));

/** examiner_A — 진보성·신규성(§29). */
export const examiner_A = A({
  id: 'examiner_A', role: 'examiner', provider: 'gpt', model: 'gpt4o', fallbackProvider: 'gemini',
  reads: ['claims', 'citedPrior', 'moduleContext'], writes: ['issues'], maxTokens: 8192, // truncation 방지(전수 발굴 장문 출력)
  systemPromptRef: '.claude/rules/agents/patent/examiner_A.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
});

/** examiner_B — 기재불비·명확성·뒷받침(§42, 앵커 1차 관문). selfReview 통과근거 활용. */
export const examiner_B = A({
  id: 'examiner_B', role: 'examiner', provider: 'gemini', model: 'gemini_pro', fallbackProvider: 'gpt',
  reads: ['claims', 'spec', 'moduleContext'], writes: ['issues'], maxTokens: 8192, // spec 입력 최대 → 출력 최대 → truncation 방지
  systemPromptRef: '.claude/rules/agents/patent/examiner_B.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
});

/** examiner_C — 단일성·도면정합(§45, E-11 3경로). */
export const examiner_C = A({
  id: 'examiner_C', role: 'examiner', provider: 'gpt', model: 'gpt4o', fallbackProvider: 'gemini',
  reads: ['claims', 'moduleContext'], writes: ['issues'], maxTokens: 8192, // truncation 방지
  systemPromptRef: '.claude/rules/agents/patent/examiner_C.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
});

/** attorney_author — 방어·보정 방향(텍스트 수정 금지). */
export const attorney_author = A({
  id: 'attorney_author', role: 'attorney_author', provider: 'claude', model: 'sonnet', fallbackProvider: 'gpt',
  temperature: 0.3, reads: ['issues', 'moduleContext'], writes: ['rebuttals'], triggers: ['rebut'],
  systemPromptRef: '.claude/rules/agents/patent/attorney_author.md',
  outputSchemaByMode: { discover: 'RebuttalSet', recheck: 'RebuttalSet' },
});

/** attorney_reviewer — 독립 검토(과축소 견제). recheck 전용. */
export const attorney_reviewer = A({
  id: 'attorney_reviewer', role: 'attorney_reviewer', provider: 'gpt', model: 'gpt4o', fallbackProvider: 'gemini',
  mode: 'recheck', triggers: ['recheck'], reads: ['issues', 'patchPlans'], writes: ['verdicts'],
  systemPromptRef: '.claude/rules/agents/patent/attorney_reviewer.md',
  outputSchemaByMode: { recheck: 'Verdict' },
});

/** domain_expert — 실시가능성·기술정확성(법조 비인용). */
export const domain_expert = A({
  id: 'domain_expert', role: 'domain_expert', provider: 'gemini', model: 'gemini_pro', fallbackProvider: 'gpt',
  temperature: 0.3, reads: ['invention', 'claims'], writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/patent/domain_expert.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
});

export const PATENT_AGENTS = Object.freeze([
  examiner_A, examiner_B, examiner_C, attorney_author, attorney_reviewer, domain_expert,
]);

export const AGENT_BY_ID = Object.freeze(
  PATENT_AGENTS.reduce((m, a) => { m[a.id] = a; return m; }, {})
);

export default PATENT_AGENTS;
