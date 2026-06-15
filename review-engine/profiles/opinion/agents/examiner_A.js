/**
 * review-engine/profiles/opinion/agents/examiner_A.js
 * 에이전트 정의(선언형) — 진보성·신규성 적대 심사관 (spec §4.1/§4.2).
 * provider=GPT(작성자 Claude와 다른 모델로 편향 상쇄). OpinionProfile.agents[0] 와 정합 +
 * T4 실행 필드(model/maxTokens/fallbackProvider/outputSchemaByMode) 보강.
 * @module review-engine/profiles/opinion/agents/examiner_A
 */
export const examiner_A = Object.freeze({
  id: 'examiner_A',
  role: 'examiner',
  provider: 'gpt',
  model: 'gpt4o',
  fallbackProvider: 'gemini', // E-05: 장애 시 1회 폴백(다른 프로바이더)
  temperature: 0.2,
  maxTokens: 8192,
  mode: 'both',
  triggers: ['review'],
  reads: ['claims', 'citedPrior', 'moduleContext'],
  writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/opinion/examiner_A.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
  retryPolicy: { maxRetry: 1, onFail: 'escalate' },
});
export default examiner_A;
