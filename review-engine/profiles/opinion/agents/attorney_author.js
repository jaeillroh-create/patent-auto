/**
 * review-engine/profiles/opinion/agents/attorney_author.js
 * 에이전트 정의(선언형) — 초안 방어·대응의견·보정 *방향* (spec §4.1/§4.2).
 * provider=Claude. 수정 금지(방향만) — 출력 RebuttalSet. trigger='rebut'(R1 발화 아님).
 * @module review-engine/profiles/opinion/agents/attorney_author
 */
export const attorney_author = Object.freeze({
  id: 'attorney_author',
  role: 'attorney_author',
  provider: 'claude',
  model: 'sonnet',
  fallbackProvider: 'gpt',
  temperature: 0.3,
  maxTokens: 8192, // RebuttalSet 전수 발화(보정방향 enrichment 포함) 장문 → truncation 방지(examiner와 동일 cap)
  mode: 'both',
  triggers: ['rebut'],
  reads: ['issues', 'moduleContext'],
  writes: ['rebuttals'],
  systemPromptRef: '.claude/rules/agents/opinion/attorney_author.md',
  outputSchemaByMode: { discover: 'RebuttalSet', recheck: 'RebuttalSet', rebut: 'RebuttalSet' }, // rebut: AC-T3a 보정방향 enrichment
  retryPolicy: { maxRetry: 1, onFail: 'escalate' },
});
export default attorney_author;
