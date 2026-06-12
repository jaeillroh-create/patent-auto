/**
 * review-engine/contracts/schemas/PatchPlan.js
 * 보정 컴파일러 산출 스키마 — Patch Plan (spec §3 PatchPlan, §7).
 * 각 op ↔ issue 1:1 추적. accepted는 사람만 변경(I-2).
 * JSON Schema (draft-07). T0: 스키마 데이터만.
 * @module review-engine/contracts/schemas/PatchPlan
 */
export const PatchPlanSchema = Object.freeze({
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'review-engine/PatchPlan',
  title: 'PatchPlan',
  type: 'object',
  required: ['id', 'addressesIssues', 'ops'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    addressesIssues: { type: 'array', items: { type: 'string' } },
    ops: {
      type: 'array',
      items: {
        type: 'object',
        required: ['op', 'target', 'reason'],
        additionalProperties: false,
        properties: {
          op: { type: 'string' },
          target: { type: 'string' },
          content: { type: 'string' },
          reason: { type: 'string', description: '연관 issueId (1:1 추적)' },
        },
      },
    },
    ripple: {
      type: 'array',
      items: {
        type: 'object',
        required: ['affected', 'change'],
        additionalProperties: false,
        properties: {
          affected: { type: 'string' },
          change: { type: 'string' },
        },
      },
    },
    simulated: { type: 'boolean' },
    scoreBefore: { type: 'number' },
    scoreAfter: { type: 'number' },
    accepted: { type: ['boolean', 'null'], description: '사람만 변경 (I-2)' },
  },
});

export default PatchPlanSchema;
