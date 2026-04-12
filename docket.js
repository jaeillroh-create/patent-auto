// ═══════════════════════════════════════════════════════════════
// 사건등록 (Docket Registration) Module v3.0
// DOCKET_SPEC_FINAL 기반 — 사건등록 + 견적서 발송 통합 워크플로우
// ═══════════════════════════════════════════════════════════════

var Docket = {};

// ── 기본 설정 ──
Docket.config = {
  recipient: 'docket@didimip.com',
  emailFunctionUrl: '',
};

// ── DB(담당 변리사)별 고정값 ──
// 계좌/예금주/할인 비고 텍스트는 템플릿 xlsx 내에 이미 고정값으로 기재됨
Docket.dbConfig = {
  '노재일': {
    template: 'templates/quote-template-노재일.xlsx',
    discountLabel: '노재일 변리사 담당 우대',
    bank: '기업은행 257-155360-01-013',
    holder: '노재일(특허그룹디딤)',
  },
  '이용환': {
    template: 'templates/quote-template-이용환.xlsx',
    discountLabel: '이용환 변리사 담당 우대',
    bank: '농협은행 302-2089-3014-01',
    holder: '이용환(특허그룹디딤)',
  },
};
Docket.defaultDB = '노재일';

// ── 수가표 (2025-05-01, 부가세·관납료 별도) ──
// 구조: feeSchedule[권리유형][사건단계_심사형태] = { label, notesCategory, fees[], gov[] }
Docket.feeSchedule = {
  '특허': {
    '출원_일반': {
      label: '출원(일반)', notesCategory: 'patent',
      fees: [
        { name: '착수금', unitPrice: 1800000 },
        { name: '성사금', unitPrice: 1800000 },
        { name: '중간사건', unitPrice: 400000 },
      ],
      gov: [
        { name: '출원', unitPrice: 109500 },
        { name: '보정', unitPrice: 4000 },
      ],
    },
    '출원_우선': {
      label: '출원(우선)', notesCategory: 'patent',
      fees: [
        { name: '착수금', unitPrice: 1800000 },
        { name: '성사금', unitPrice: 1800000 },
        { name: '우선심사', unitPrice: 600000 },
        { name: '중간사건', unitPrice: 400000 },
      ],
      gov: [
        { name: '출원', unitPrice: 109500 },
        { name: '우선심사', unitPrice: 200000 },
        { name: '보정', unitPrice: 4000 },
      ],
    },
    'OA대응': {
      label: 'OA대응', notesCategory: 'patent',
      fees: [{ name: '의견서', unitPrice: 400000 }],
      gov: [{ name: '보정', unitPrice: 4000 }],
    },
    '정보제공': {
      label: '정보제공', notesCategory: 'patent',
      fees: [{ name: '정보제공서', unitPrice: 600000 }],
      gov: [],
    },
    '등록': {
      label: '등록', notesCategory: 'patent',
      fees: [{ name: '등록성사금', unitPrice: 1800000 }],
      gov: [{ name: '등록', unitPrice: 44100 }],
    },
  },
  '상표': {
    '출원_일반': {
      label: '출원(일반)', notesCategory: 'trademark',
      fees: [
        { name: '착수금', unitPrice: 300000 },
        { name: '성사금', unitPrice: 300000 },
        { name: '중간사건', unitPrice: 500000 },
      ],
      gov: [
        { name: '출원', unitPrice: 52000 },
        { name: '보정', unitPrice: 4000 },
        { name: '등록', unitPrice: 210120 },
      ],
    },
    '출원_우선': {
      label: '출원(우선)', notesCategory: 'trademark',
      fees: [
        { name: '착수금', unitPrice: 300000 },
        { name: '성사금', unitPrice: 300000 },
        { name: '우선심사', unitPrice: 300000 },
        { name: '중간사건', unitPrice: 500000 },
      ],
      gov: [
        { name: '출원', unitPrice: 52000 },
        { name: '우선심사', unitPrice: 160000 },
        { name: '보정', unitPrice: 4000 },
        { name: '등록', unitPrice: 210120 },
      ],
    },
    'OA대응': {
      label: 'OA대응', notesCategory: 'trademark',
      fees: [{ name: '의견서', unitPrice: 500000 }],
      gov: [{ name: '보정', unitPrice: 4000 }],
    },
    '이의신청': {
      label: '이의신청', notesCategory: 'trademark',
      fees: [{ name: '답변서', unitPrice: 1500000 }],
      gov: [],
    },
    '정보제공': {
      label: '정보제공', notesCategory: 'trademark',
      fees: [{ name: '정보제공서', unitPrice: 600000 }],
      gov: [],
    },
    '등록': {
      label: '등록', notesCategory: 'trademark',
      fees: [{ name: '등록성사금', unitPrice: 300000 }],
      gov: [{ name: '등록', unitPrice: 210120 }],
    },
  },
  '디자인': {
    '출원_일반': {
      label: '출원(일반)', notesCategory: 'patent',
      fees: [
        { name: '착수금', unitPrice: 350000 },
        { name: '성사금', unitPrice: 350000 },
        { name: '도면', unitPrice: 60000 },
        { name: '중간사건', unitPrice: 300000 },
      ],
      gov: [
        { name: '출원', unitPrice: 28200 },
        { name: '보정', unitPrice: 4000 },
        { name: '등록', unitPrice: 22500 },
      ],
    },
    '출원_우선': {
      label: '출원(우선)', notesCategory: 'patent',
      fees: [
        { name: '착수금', unitPrice: 350000 },
        { name: '성사금', unitPrice: 350000 },
        { name: '도면', unitPrice: 60000 },
        { name: '우선심사', unitPrice: 300000 },
        { name: '중간사건', unitPrice: 300000 },
      ],
      gov: [
        { name: '출원', unitPrice: 28200 },
        { name: '우선심사', unitPrice: 70000 },
        { name: '보정', unitPrice: 4000 },
        { name: '등록', unitPrice: 22500 },
      ],
    },
    'OA대응': {
      label: 'OA대응', notesCategory: 'patent',
      fees: [{ name: '의견서', unitPrice: 300000 }],
      gov: [{ name: '보정', unitPrice: 4000 }],
    },
    '등록': {
      label: '등록', notesCategory: 'patent',
      fees: [{ name: '등록성사금', unitPrice: 350000 }],
      gov: [{ name: '등록', unitPrice: 22500 }],
    },
  },
  '실용신안': {
    '출원_일반': {
      label: '출원(일반)', notesCategory: 'patent',
      fees: [
        { name: '착수금', unitPrice: 1200000 },
        { name: '성사금', unitPrice: 1200000 },
        { name: '중간사건', unitPrice: 400000 },
      ],
      gov: [
        { name: '출원', unitPrice: 44400 },
        { name: '보정', unitPrice: 4000 },
      ],
    },
    '출원_우선': {
      label: '출원(우선)', notesCategory: 'patent',
      fees: [
        { name: '착수금', unitPrice: 1200000 },
        { name: '성사금', unitPrice: 1200000 },
        { name: '우선심사', unitPrice: 600000 },
        { name: '중간사건', unitPrice: 400000 },
      ],
      gov: [
        { name: '출원', unitPrice: 44400 },
        { name: '우선심사', unitPrice: 100000 },
        { name: '보정', unitPrice: 4000 },
      ],
    },
    'OA대응': {
      label: 'OA대응', notesCategory: 'patent',
      fees: [{ name: '의견서', unitPrice: 400000 }],
      gov: [{ name: '보정', unitPrice: 4000 }],
    },
    '정보제공': {
      label: '정보제공', notesCategory: 'patent',
      fees: [{ name: '정보제공서', unitPrice: 600000 }],
      gov: [],
    },
    '등록': {
      label: '등록', notesCategory: 'patent',
      fees: [{ name: '등록성사금', unitPrice: 1200000 }],
      gov: [{ name: '등록', unitPrice: 20000 }],
    },
  },
};

// ── 권리유형별 가능한 사건단계 목록 ──
Docket.rightStages = {
  '특허':    ['출원_일반', '출원_우선', 'OA대응', '정보제공', '등록'],
  '상표':    ['출원_일반', '출원_우선', 'OA대응', '이의신청', '정보제공', '등록'],
  '디자인':  ['출원_일반', '출원_우선', 'OA대응', '등록'],
  '실용신안': ['출원_일반', '출원_우선', 'OA대응', '정보제공', '등록'],
};

// ── 견적서 상세 조항 표준 텍스트 (특허/실용/디자인 공통, 상표 별도) ──
Docket.defaultNotes = {
  patent: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 대리인 수수료와 무관한 특허청에 납부하는 금액입니다.',
    '2) 특허청 출원관납료에 포함된 심사청구료 및 가산료는 청구항의 수에 따라 청구됩니다. 본 견적에는 3개항으로 견적하였으며, 실제 청구항수에 따라 가감될 수 있습니다.',
    '3) 중소기업기본법 제2조에 따라 중소기업·벤처기업에 해당할 경우, 출원료·심사청구료·최초 3년분 등록료의 70% 감면 혜택이 적용됩니다. (증빙서류 제출 필수)',
    '4) 본 특허의 등록 시에는 출원착수금의 100%가 성공보수금으로 청구됩니다. (부가세·특허청 등록관납료 별도) 의견제출통지서 1회 대응 비용이 포함되어 있으며, 2회 이상 및 거절결정 대응 비용은 미포함입니다.',
    '5) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '6) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '7) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  trademark: [
    '1) 대리인 수수료는 상표출원에 대한 금액이며, 특허청 관납료는 대리인 수수료와 별개의 특허청 납부 금액입니다.',
    '2) 본 상표의 등록 시에는 대리인수수료의 100%가 성공보수금으로 청구됩니다. (부가세·특허청 등록관납료 별도)',
    '3) 부가세 포함 대리인수수료에 대하여는 세금계산서(현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다. 입금 시 사업자등록증 사본을 회신 부탁드립니다.',
    '4) 지정상품 추가 시 상품류별 관납료가 추가될 수 있습니다.',
    '5) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '6) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
};

// ─── 유틸 ───
Docket.fmt = function(n) { return (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
Docket.fmtMan = function(n) { return Math.round((n || 0) / 10000).toLocaleString(); };

// ═══ Stub 함수들 (후속 단계에서 구현) ═══
Docket.init = function() {};
Docket.onRightChange = function() {};
Docket.onStageChange = function() {};
Docket.onDBChange = function() {};
Docket.renderFeeTable = function() {};
Docket.recalc = function() {};
Docket.collectData = function() { return {}; };
Docket.generateEmailBodyHtml = function() { return ''; };
Docket.generateFromTemplate = async function() { return null; };
Docket.downloadExcel = function() {};
Docket.sendEmail = async function() {};
Docket.preview = function() {};
Docket.closePreview = function() {};
Docket.resetForm = function() {};
Docket.resetNotes = function() {};
