/**
 * review-engine/profiles/division/agents/index.js
 * 분할(division) 도메인 에이전트 정의 배럴 (spec §4.2, §8.2). 선언형.
 *
 * ★ T7 범위: 선언형 정의 + outputSchemaByMode(구조). 실제 LLM 프롬프트 본문(.md)은 후속
 *   (DoD의 §47 검출은 consistency 구조검사로 동작 — LLM 불필요). opinion agents 와 동일 형상이라
 *   동일 runAgent(adapters/runAgent.js)가 모듈 불문으로 재사용한다(I-6 증명의 일부).
 * 적대 초점(§8.2): 신규사항(§47)·원출원범위이탈·이중특허·단일성.
 * @module review-engine/profiles/division/agents
 */

/** 공통 retry/모드 기본값을 줄이기 위한 헬퍼. */
const A = (o) => Object.freeze(Object.assign({
  temperature: 0.2, maxTokens: 4096, mode: 'both', triggers: ['review'],
  retryPolicy: { maxRetry: 1, onFail: 'escalate' },
}, o));

/** examiner_A — 신규사항(§47): 추가 구성이 원출원 범위를 벗어난 신규사항인가. */
export const examiner_A = A({
  id: 'examiner_A', role: 'examiner', provider: 'gpt', model: 'gpt4o', fallbackProvider: 'gemini',
  reads: ['claims', 'spec', 'moduleContext'], writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/division/examiner_A.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
});

/** examiner_B — 원출원 뒷받침/범위이탈: basis 보존 + 명세서 직접 기재 여부. */
export const examiner_B = A({
  id: 'examiner_B', role: 'examiner', provider: 'gemini', model: 'gemini_pro', fallbackProvider: 'gpt',
  reads: ['claims', 'spec'], writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/division/examiner_B.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
});

/** examiner_C — 이중특허·단일성: 원출원 청구항과의 동일성/발명 단일성. */
export const examiner_C = A({
  id: 'examiner_C', role: 'examiner', provider: 'gpt', model: 'gpt4o', fallbackProvider: 'gemini',
  reads: ['claims', 'moduleContext'], writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/division/examiner_C.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
});

/** attorney_author — 분할 청구항 방어·보정 방향(텍스트 수정 금지). */
export const attorney_author = A({
  id: 'attorney_author', role: 'attorney_author', provider: 'claude', model: 'sonnet', fallbackProvider: 'gpt',
  temperature: 0.3, reads: ['issues', 'moduleContext'], writes: ['rebuttals'], triggers: ['rebut'],
  systemPromptRef: '.claude/rules/agents/division/attorney_author.md',
  outputSchemaByMode: { discover: 'RebuttalSet', recheck: 'RebuttalSet' },
});

/** attorney_reviewer — 독립 검토(과축소·신규사항 유발 견제). recheck 전용. */
export const attorney_reviewer = A({
  id: 'attorney_reviewer', role: 'attorney_reviewer', provider: 'gpt', model: 'gpt4o', fallbackProvider: 'gemini',
  mode: 'recheck', triggers: ['recheck'], reads: ['issues', 'patchPlans'], writes: ['verdicts'],
  systemPromptRef: '.claude/rules/agents/division/attorney_reviewer.md',
  outputSchemaByMode: { recheck: 'Verdict' },
});

/** domain_expert — 실시가능성·사업목적(법조 비인용). */
export const domain_expert = A({
  id: 'domain_expert', role: 'domain_expert', provider: 'gemini', model: 'gemini_pro', fallbackProvider: 'gpt',
  temperature: 0.3, reads: ['invention', 'claims'], writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/division/domain_expert.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
});

export const DIVISION_AGENTS = Object.freeze([
  examiner_A, examiner_B, examiner_C, attorney_author, attorney_reviewer, domain_expert,
]);

export const AGENT_BY_ID = Object.freeze(
  DIVISION_AGENTS.reduce((m, a) => { m[a.id] = a; return m; }, {})
);

export default DIVISION_AGENTS;
