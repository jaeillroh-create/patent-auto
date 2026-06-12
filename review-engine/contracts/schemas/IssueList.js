/**
 * review-engine/contracts/schemas/IssueList.js
 * 에이전트 discover/recheck 출력 스키마 — issue 목록 (spec §3 Issue, §4.3).
 * JSON Schema (draft-07). T0: 스키마 데이터만, 검증 로직 없음.
 * @module review-engine/contracts/schemas/IssueList
 */
export const IssueListSchema = Object.freeze({
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'review-engine/IssueList',
  title: 'IssueList',
  type: 'object',
  required: ['issues'],
  additionalProperties: false,
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'severity', 'target', 'description', 'legalBasis'],
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          target: { type: 'array', items: { type: 'string' } },
          raisedBy: { type: 'string' },
          legalBasis: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
});

export default IssueListSchema;
