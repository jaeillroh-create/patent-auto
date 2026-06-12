/**
 * review-engine/contracts/schemas/Verdict.js
 * recheck/해소판정 출력 스키마 — Verdict (spec §4.3, §4.4).
 * recheck 모드는 신규 지적 금지: {통과|잔존|회귀}만 (골대이동 차단).
 * JSON Schema (draft-07). T0: 스키마 데이터만.
 * @module review-engine/contracts/schemas/Verdict
 */
export const VerdictSchema = Object.freeze({
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'review-engine/Verdict',
  title: 'Verdict',
  type: 'object',
  required: ['verdicts'],
  additionalProperties: false,
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['issueId', 'result'],
        additionalProperties: false,
        properties: {
          issueId: { type: 'string' },
          // 통과 | 잔존 | 회귀 (recheck 3분류)
          result: { type: 'string', enum: ['resolved', 'remaining', 'regression'] },
          note: { type: 'string' },
          // 회귀일 때 직전 보정이 유발한 신규 issue (§4.4 예외 허용)
          regressionOf: { type: 'string' },
        },
      },
    },
  },
});

export default VerdictSchema;
