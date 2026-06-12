/**
 * review-engine/profiles/opinion/agents/examiner_C.js
 * 에이전트 정의(선언형) — 청구범위·단일성·신규사항(§47·§45) 적대 심사관 (spec §4.1/§4.2).
 * provider=GPT. division 에서 §47 전담 강화(spec §4.1 비고).
 * @module review-engine/profiles/opinion/agents/examiner_C
 */
export const examiner_C = Object.freeze({
  id: 'examiner_C',
  role: 'examiner',
  provider: 'gpt',
  model: 'gpt4o',
  fallbackProvider: 'gemini',
  temperature: 0.2,
  maxTokens: 4096,
  mode: 'both',
  triggers: ['review'],
  reads: ['claims', 'moduleContext'],
  writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/opinion/examiner_C.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
  retryPolicy: { maxRetry: 1, onFail: 'escalate' },
});
export default examiner_C;
