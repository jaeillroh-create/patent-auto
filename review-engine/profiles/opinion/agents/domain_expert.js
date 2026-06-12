/**
 * review-engine/profiles/opinion/agents/domain_expert.js
 * 에이전트 정의(선언형) — 실시가능성·기술정확성·사업목적 (spec §4.1/§4.2).
 * provider=Gemini. 분야 컨텍스트 주입({기술분야} 슬롯). 법조 인용 금지(기술·사업 관점).
 * @module review-engine/profiles/opinion/agents/domain_expert
 */
export const domain_expert = Object.freeze({
  id: 'domain_expert',
  role: 'domain_expert',
  provider: 'gemini',
  model: 'gemini_pro',
  fallbackProvider: 'gpt',
  temperature: 0.3,
  maxTokens: 4096,
  mode: 'both',
  triggers: ['review'],
  reads: ['invention', 'claims'],
  writes: ['issues'],
  systemPromptRef: '.claude/rules/agents/opinion/domain_expert.md',
  outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
  retryPolicy: { maxRetry: 1, onFail: 'escalate' },
});
export default domain_expert;
