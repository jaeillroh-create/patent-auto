/**
 * review-engine/profiles/opinion/agents/attorney_reviewer.js
 * 에이전트 정의(선언형) — 독립 검토·과축소 견제·해소판정 (spec §4.1/§4.2).
 * provider=GPT(독립관점 위해 비-Claude). recheck 전용 — 출력 Verdict.
 * @module review-engine/profiles/opinion/agents/attorney_reviewer
 */
export const attorney_reviewer = Object.freeze({
  id: 'attorney_reviewer',
  role: 'attorney_reviewer',
  provider: 'gpt',
  model: 'gpt4o',
  fallbackProvider: 'gemini',
  temperature: 0.2,
  maxTokens: 4096,
  mode: 'recheck',
  triggers: ['recheck'],
  reads: ['issues', 'patchPlans'],
  writes: ['verdicts'],
  systemPromptRef: '.claude/rules/agents/opinion/attorney_reviewer.md',
  outputSchemaByMode: { recheck: 'Verdict' },
  retryPolicy: { maxRetry: 1, onFail: 'escalate' },
});
export default attorney_reviewer;
