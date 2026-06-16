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
  // ★ top-level 여분 키 허용(true): 모델이 wrapper 에 summary/consensus 등을 붙여도 거부하지 않는다
  //   (verdicts 필수 가드는 유지). 형식 드리프트로 인한 검증 실패 방지.
  additionalProperties: true,
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['issueId', 'result'],
        // ★ 계약 정합(핵심): orchestrator.js 의 recheck regression 처리는 verdict 의
        //   severity·type·target·legalBasis·coreElement·id 를 읽는다(orchestrator.js:213).
        //   IssueList 항목(additionalProperties:true)과 동형으로 완화하여, 모델이 그 필드를
        //   제공해도(또는 안 해도) 검증 통과 → 스키마-소비자 불일치(계약 버그) 해소. issueId·result
        //   필수와 result enum 가드는 유지.
        additionalProperties: true,
        properties: {
          issueId: { type: 'string' },
          // 통과 | 잔존 | 회귀 (recheck 3분류)
          result: { type: 'string', enum: ['resolved', 'remaining', 'regression'] },
          note: { type: 'string' },
          // 회귀일 때 직전 보정이 유발한 신규 issue (§4.4 예외 허용)
          regressionOf: { type: 'string' },
          // ↓ orchestrator 가 regression verdict 에서 읽는 선택 필드(있으면 그대로 사용, 없으면 기본값)
          severity: { type: 'string' },
          type: { type: 'string' },
          target: { type: 'array', items: { type: 'string' } },
          legalBasis: { type: 'string' },
          coreElement: { type: 'string' },
          id: { type: 'string' },
        },
      },
    },
  },
});

export default VerdictSchema;
