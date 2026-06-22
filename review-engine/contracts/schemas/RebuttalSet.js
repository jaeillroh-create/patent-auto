/**
 * review-engine/contracts/schemas/RebuttalSet.js
 * attorney(방어) 출력 스키마 — RebuttalSet (spec §4.3).
 * attorney_author는 "방어·대응의견·보정 방향"만 제시하고 직접 수정하지 않는다(spec §4.1).
 * JSON Schema (draft-07). T0: 스키마 데이터만.
 * @module review-engine/contracts/schemas/RebuttalSet
 */
export const RebuttalSetSchema = Object.freeze({
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'review-engine/RebuttalSet',
  title: 'RebuttalSet',
  type: 'object',
  required: ['rebuttals'],
  additionalProperties: false,
  properties: {
    rebuttals: {
      type: 'array',
      items: {
        type: 'object',
        required: ['issueId', 'stance', 'argument'],
        additionalProperties: false,
        properties: {
          issueId: { type: 'string' },
          // 반박(지적 부당) | 인정(보정 필요) | 일부인정
          stance: { type: 'string', enum: ['rebut', 'concede', 'partial'] },
          argument: { type: 'string', description: '대응 의견 논리' },
          legalBasis: { type: 'string' },
          // 보정 "방향"만 (구체적 텍스트 수술은 작성모듈 책임)
          amendmentDirection: { type: 'string' },
        },
      },
    },
  },
});

export default RebuttalSetSchema;
