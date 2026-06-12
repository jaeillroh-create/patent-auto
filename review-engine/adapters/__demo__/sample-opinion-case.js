/**
 * review-engine/adapters/__demo__/sample-opinion-case.js
 * ─────────────────────────────────────────────────────────────
 * T4 데모용 실(實)-형상 opinion 케이스 1건 (WriterSnapshot.raw 형상).
 * OpinionProfile.adaptSnapshot 입력 계약(profiles/opinion/adapter.js:48-122)에 맞춘다.
 *
 * 시나리오: "차량 배터리 열관리 시스템" — §29② 진보성 거절 + 보정으로
 *   '냉각 유로'(부가=anchor, 명세서 뒷받침 있음)와 '머신러닝 예측 모듈'(부가지만
 *   명세서 뒷받침이 약함 — examiner_B가 §42④로 잡도록 의도) 추가.
 * @module review-engine/adapters/__demo__/sample-opinion-case
 */
export const sampleOpinionCase = {
  caseId: '10-2024-0123456',
  reviewId: 'rev_demo_thermal',
  refText: [
    '【0001】 본 발명은 차량용 배터리의 열을 관리하는 시스템에 관한 것이다.',
    '【0021】 배터리 모듈(100)은 복수의 배터리 셀(110)과, 셀 사이에 배치되는 냉각 유로(120)를 포함한다. 냉각 유로(120)는 셀 사이를 사행(蛇行) 형상으로 통과하며 냉각 유체를 순환시켜 셀 간 온도 편차를 저감한다.',
    '【0022】 온도 센서(130)는 각 셀의 표면 온도를 측정하여 제어부(140)로 전달한다.',
    '【0035】 제어부(140)는 측정된 온도에 기초하여 냉각 펌프(150)의 유량을 가변 제어한다.',
    // 주의: '머신러닝 예측 모듈'을 직접 설명하는 단락은 명세서에 의도적으로 없음(B의 §42④ 표적).
  ].join('\n'),
  parsed: {
    invention_title: '차량 배터리 열관리 시스템',
    application_no: '10-2024-0123456',
    applicant: '디딤모빌리티 주식회사',
    claims: [
      { no: 1, text: '복수의 배터리 셀과; 상기 셀 사이에 배치되는 냉각 유로와; 상기 셀의 온도를 측정하는 온도 센서와; 상기 온도에 기초하여 냉각 펌프의 유량을 제어하는 제어부를 포함하는 차량 배터리 열관리 시스템.' },
      { no: 2, text: '제1항에 있어서, 상기 냉각 유로는 상기 셀 사이를 사행 형상으로 통과하는 차량 배터리 열관리 시스템.' },
    ],
    cited_references: [
      { ref_no: 1, title: '배터리 냉각 장치(인용발명1)', publication_no: 'KR-10-2019-0011111' },
    ],
    rejection_reasons: [
      { article: '§29②', target_claims: [1], cited: [1], reason: '청구항 1은 인용발명1(배터리 셀 사이 냉각 유로 + 온도 기반 펌프 제어)로부터 통상의 기술자가 용이하게 도출할 수 있어 진보성이 인정되지 않는다.' },
    ],
  },
  typeResult: {
    primary_type: '진보성',
    secondary_type: null,
    claim_summary: { rejected_claims: [1] },
  },
  draftResult: {
    amended_claims: [
      {
        claim_no: 1,
        amended: '복수의 배터리 셀과; 상기 셀 사이에 배치되어 냉각 유체를 사행 형상으로 순환시키는 냉각 유로와; 상기 셀의 온도를 측정하는 온도 센서와; 상기 온도에 기초하여 냉각 펌프의 유량을 제어하는 제어부와; 상기 온도의 시계열로부터 셀 과열을 사전 예측하는 머신러닝 예측 모듈을 포함하는 차량 배터리 열관리 시스템.',
        amendment_methods: [{ method: '부가', element: '머신러닝 예측 모듈' }, { method: '구체화', element: '냉각 유로(사행 순환)' }],
      },
    ],
  },
  analysis: {
    issues: ['인용발명1 대비 사행 냉각 + 예측 제어의 결합 곤란성 주장 가능'],
  },
};

export default sampleOpinionCase;
