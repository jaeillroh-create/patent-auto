/**
 * review-engine/profiles/opinion/agents/examiner_B.js
 * 에이전트 정의(선언형) — 기재불비·명확성·뒷받침(§42) 적대 심사관 (spec §4.1/§4.2).
 * provider=Gemini(편향 상쇄). reads 에 spec(명세서 본문) 포함 — 뒷받침 판단 소스.
 * @module review-engine/profiles/opinion/agents/examiner_B
 */
export const examiner_B = Object.freeze({
  id: 'examiner_B',
  role: 'examiner',
  provider: 'gemini',
  model: 'gemini_pro',
  fallbackProvider: 'gpt',
  temperature: 0.2,
  maxTokens: 4096,
  mode: 'both',
  triggers: ['review'],
  reads: ['claims', 'spec'],
  writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/opinion/examiner_B.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
  retryPolicy: { maxRetry: 1, onFail: 'escalate' },
});
export default examiner_B;
