// ═══════════════════════════════════════════════════════════════
// 사건등록 (Docket Registration) Module v3.0
// DOCKET_SPEC_FINAL 기반 — 사건등록 + 견적서 발송 통합 워크플로우
// ═══════════════════════════════════════════════════════════════

var Docket = {};

// ── 기본 설정 ──
// Supabase URL/anon key는 하드코딩 (common.js 로드 타이밍 문제 회피).
// anon key는 브라우저에 이미 노출되므로 민감정보 아님 (Supabase anon은 RLS로 보호).
Docket.config = {
  recipient: 'docket@didimip.com',
  emailFunctionUrl: 'https://uvrzwhfjtzqujawmscca.supabase.co/functions/v1/send-docket-email',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cnp3aGZqdHpxdWphd21zY2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTEwNDgsImV4cCI6MjA4NTUyNzA0OH0.JSSPMPIHsXfbNm6pgRzCTGH7aNQATl-okIkcXHl7Mkk',
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

// DB별 템플릿 파일 경로 반환
// 인자: dbName (string) — 생략 시 dkt-db 라디오에서 현재 선택된 DB 사용
Docket.getTemplatePath = function(dbName) {
  if (!dbName) {
    var sel = document.getElementById('dkt-db');
    dbName = sel ? sel.value : Docket.defaultDB;
  }
  var cfg = Docket.dbConfig[dbName] || Docket.dbConfig[Docket.defaultDB];
  return cfg.template;
};

// ── 수가표 (2025-05-01, 부가세·관납료 별도) ──
// 구조: feeSchedule[권리유형] = { notesCategory, items[] }
//   items[i] = { key, name, unitPrice, defaultChecked, linkedGov[] }
//   linkedGov = 이 수수료 항목 체크 시 자동 포함되는 특허청관납료 항목
Docket.feeSchedule = {
  // 특허 관납료 매핑 (DOCKET_SPEC_FINAL §5 특허):
  //   출원착수금 → 출원료 109,500
  //   성사금(등록) → 등록료 44,100
  //   우선심사 → 우선심사료 200,000
  //   중간사건 → 보정료 4,000
  '특허': {
    notesCategory: 'patent',
    items: [
      { key: 'application', name: '출원착수금', unitPrice: 1800000, defaultChecked: true,
        linkedGov: [{ name: '출원료', unitPrice: 109500 }] },
      { key: 'registration', name: '성사금(등록)', unitPrice: 1800000, defaultChecked: false,
        linkedGov: [{ name: '등록료', unitPrice: 44100 }] },
      { key: 'priority', name: '우선심사', unitPrice: 600000, defaultChecked: false,
        linkedGov: [{ name: '우선심사료', unitPrice: 200000 }] },
      { key: 'oa', name: '중간사건', unitPrice: 400000, defaultChecked: false,
        linkedGov: [{ name: '보정료', unitPrice: 4000 }] },
      { key: 'consulting', name: 'IP창출컨설팅', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [] },
      { key: 'interview', name: '심사관면담', unitPrice: 400000, defaultChecked: false,
        linkedGov: [] },
      // ── 심판 (수가표 미확정 → placeholder, 사용자 확정 시 업데이트) ──
      { key: 'appeal_reject', name: '거절결정불복심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 159000 }] },
      { key: 'appeal_invalidation', name: '무효심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 159000 }] },
      { key: 'appeal_correction', name: '정정심판', unitPrice: 500000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 159000 }] },
    ],
  },
  // 상표 관납료 매핑 (DOCKET_SPEC_FINAL §5 상표):
  //   출원착수금 → 출원료 (비고시명칭 52,000 / 고시명칭 46,000, dkt-trademark-term 라디오로 선택)
  //   성사금(등록) → 등록료 210,120
  //   우선심사 → 우선심사료 160,000
  //   중간사건 → 보정료 4,000
  '상표': {
    notesCategory: 'trademark',
    items: [
      { key: 'application', name: '출원착수금', unitPrice: 300000, defaultChecked: true,
        linkedGov: [{ name: '출원료(비고시명칭)', unitPrice: 52000 }] },
      { key: 'registration', name: '성사금(등록)', unitPrice: 300000, defaultChecked: false,
        linkedGov: [{ name: '등록료', unitPrice: 210120 }] },
      { key: 'priority', name: '우선심사', unitPrice: 300000, defaultChecked: false,
        linkedGov: [{ name: '우선심사료', unitPrice: 160000 }] },
      { key: 'oa', name: '중간사건', unitPrice: 500000, defaultChecked: false,
        linkedGov: [{ name: '보정료', unitPrice: 4000 }] },
      { key: 'opposition', name: '이의신청대응', unitPrice: 1500000, defaultChecked: false,
        linkedGov: [] },
      { key: 'info', name: '정보제공', unitPrice: 600000, defaultChecked: false,
        linkedGov: [] },
      // ── 심판 ──
      { key: 'appeal_reject', name: '거절결정불복심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 240000 }] },
      { key: 'appeal_invalidation', name: '무효심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 240000 }] },
      { key: 'appeal_cancel', name: '취소심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 240000 }] },
    ],
  },
  // 디자인 관납료 매핑 (DOCKET_SPEC_FINAL §5 디자인):
  //   출원착수금 → 출원료 28,200
  //   성사금(등록) → 등록료 22,500
  //   우선심사 → 우선심사료 70,000
  //   중간사건 → 보정료 4,000
  //   도면작성료: 연동 관납료 없음
  '디자인': {
    notesCategory: 'patent',
    items: [
      { key: 'application', name: '출원착수금', unitPrice: 350000, defaultChecked: true,
        linkedGov: [{ name: '출원료', unitPrice: 28200 }] },
      { key: 'registration', name: '성사금(등록)', unitPrice: 350000, defaultChecked: false,
        linkedGov: [{ name: '등록료', unitPrice: 22500 }] },
      { key: 'drawing', name: '도면작성료', unitPrice: 60000, defaultChecked: false,
        linkedGov: [] },
      { key: 'priority', name: '우선심사', unitPrice: 300000, defaultChecked: false,
        linkedGov: [{ name: '우선심사료', unitPrice: 70000 }] },
      { key: 'oa', name: '중간사건', unitPrice: 300000, defaultChecked: false,
        linkedGov: [{ name: '보정료', unitPrice: 4000 }] },
      // ── 심판 ──
      { key: 'appeal_reject', name: '거절결정불복심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 159000 }] },
      { key: 'appeal_invalidation', name: '무효심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 159000 }] },
    ],
  },
  // 실용신안 관납료 매핑 (DOCKET_SPEC_FINAL §5 실용신안):
  //   출원착수금 → 출원료 44,400
  //   성사금(등록) → 등록료 20,000
  //   우선심사 → 우선심사료 100,000
  //   중간사건 → 보정료 4,000
  '실용신안': {
    notesCategory: 'patent',
    items: [
      { key: 'application', name: '출원착수금', unitPrice: 1200000, defaultChecked: true,
        linkedGov: [{ name: '출원료', unitPrice: 44400 }] },
      { key: 'registration', name: '성사금(등록)', unitPrice: 1200000, defaultChecked: false,
        linkedGov: [{ name: '등록료', unitPrice: 20000 }] },
      { key: 'priority', name: '우선심사', unitPrice: 600000, defaultChecked: false,
        linkedGov: [{ name: '우선심사료', unitPrice: 100000 }] },
      { key: 'oa', name: '중간사건', unitPrice: 400000, defaultChecked: false,
        linkedGov: [{ name: '보정료', unitPrice: 4000 }] },
      { key: 'consulting', name: 'IP창출컨설팅', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [] },
      // ── 심판 ──
      { key: 'appeal_reject', name: '거절결정불복심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 159000 }] },
      { key: 'appeal_invalidation', name: '무효심판', unitPrice: 1000000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 159000 }] },
      { key: 'appeal_correction', name: '정정심판', unitPrice: 500000, defaultChecked: false,
        linkedGov: [{ name: '심판청구료', unitPrice: 159000 }] },
    ],
  },
};

// ── 견적서 상세 조항 (권리유형 + 단계별 8개 카테고리) ──
// 카테고리 자동 선택: 심판 체크 시 _appeal, 그 외 _filing
Docket.defaultNotes = {
  patent_filing: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 대리인 수수료와 무관한 특허청에 납부하는 금액입니다.',
    '2) 특허청 출원관납료에 포함된 심사청구료 및 가산료는 청구항의 수에 따라 청구됩니다. 본 견적에는 3개항으로 견적하였으며, 실제 청구항수에 따라 가감될 수 있습니다.',
    '3) 중소기업기본법 제2조에 따라 중소기업·벤처기업에 해당할 경우, 출원료·심사청구료·최초 3년분 등록료의 70% 감면 혜택이 적용됩니다. (증빙서류 제출 필수)',
    '4) 본 특허의 등록 시에는 출원착수금의 100%가 성공보수금으로 청구됩니다. (부가세·특허청 등록관납료 별도) 의견제출통지서 1회 대응 비용이 포함되어 있으며, 2회 이상 및 거절결정 대응 비용은 미포함입니다.',
    '5) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '6) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '7) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  patent_appeal: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 별개의 특허청 납부 금액입니다.',
    '2) 심판 착수금에는 심판청구서 작성 및 제출 비용이 포함되어 있습니다.',
    '3) 심판 결과에 따라 추가 대응(보정, 의견서 제출 등) 비용이 발생할 수 있으며, 이는 별도 협의됩니다.',
    '4) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '5) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '6) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  trademark_filing: [
    '1) 대리인 수수료는 상표출원에 대한 금액이며, 특허청 관납료는 별개의 특허청 납부 금액입니다.',
    '2) 본 상표의 등록 시에는 대리인수수료의 100%가 성공보수금으로 청구됩니다. (부가세·특허청 등록관납료 별도)',
    '3) 부가세 포함 대리인수수료에 대하여는 세금계산서(현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다. 입금 시 사업자등록증 사본을 회신 부탁드립니다.',
    '4) 지정상품 추가 시 상품류별 관납료가 추가될 수 있습니다.',
    '5) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '6) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  trademark_appeal: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 별개의 특허청 납부 금액입니다.',
    '2) 심판 착수금에는 심판청구서(또는 답변서) 작성 및 제출 비용이 포함되어 있습니다.',
    '3) 심판 결과에 따라 추가 대응 비용이 발생할 수 있으며, 이는 별도 협의됩니다.',
    '4) 부가세 포함 대리인수수료에 대하여는 세금계산서(현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '5) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '6) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  design_filing: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 대리인 수수료와 무관한 특허청에 납부하는 금액입니다.',
    '2) 도면작성료는 디자인 도면 작성에 따른 비용이며, 도면의 수·복잡도에 따라 가감될 수 있습니다.',
    '3) 중소기업기본법 제2조에 따라 중소기업·벤처기업에 해당할 경우, 출원료·등록료의 70% 감면 혜택이 적용됩니다. (증빙서류 제출 필수)',
    '4) 본 디자인의 등록 시에는 출원착수금의 100%가 성공보수금으로 청구됩니다. (부가세·특허청 등록관납료 별도)',
    '5) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '6) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '7) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  design_appeal: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 별개의 특허청 납부 금액입니다.',
    '2) 심판 착수금에는 심판청구서 작성 및 제출 비용이 포함되어 있습니다.',
    '3) 심판 결과에 따라 추가 대응 비용이 발생할 수 있으며, 이는 별도 협의됩니다.',
    '4) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '5) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '6) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  utility_filing: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 대리인 수수료와 무관한 특허청에 납부하는 금액입니다.',
    '2) 특허청 관납료에 포함된 심사청구료는 청구항의 수에 따라 청구됩니다. 본 견적에는 3개항으로 견적하였으며, 실제 청구항수에 따라 가감될 수 있습니다.',
    '3) 중소기업기본법 제2조에 따라 중소기업·벤처기업에 해당할 경우, 출원료·심사청구료·등록료의 70% 감면 혜택이 적용됩니다. (증빙서류 제출 필수)',
    '4) 본 실용신안의 등록 시에는 출원착수금의 100%가 성공보수금으로 청구됩니다. (부가세·특허청 등록관납료 별도) 의견제출통지서 1회 대응 비용이 포함되어 있으며, 2회 이상 비용은 미포함입니다.',
    '5) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '6) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '7) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  utility_appeal: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 별개의 특허청 납부 금액입니다.',
    '2) 심판 착수금에는 심판청구서 작성 및 제출 비용이 포함되어 있습니다.',
    '3) 심판 결과에 따라 추가 대응(보정, 의견서 제출 등) 비용이 발생할 수 있으며, 이는 별도 협의됩니다.',
    '4) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '5) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '6) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
};

// ─── 유틸 ───
Docket.fmt = function(n) { return (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
Docket.fmtMan = function(n) { return Math.round((n || 0) / 10000).toLocaleString(); };

// ═══════════════════════════════════════════════════════════════
// UI 렌더링 및 이벤트 핸들러
// ═══════════════════════════════════════════════════════════════

