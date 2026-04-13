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
    ],
  },
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

// ═══════════════════════════════════════════════════════════════
// UI 렌더링 및 이벤트 핸들러
// ═══════════════════════════════════════════════════════════════

Docket.init = function() {
  // Edge Function URL은 Docket.config.emailFunctionUrl에 하드코딩됨.
  // 동적 재설정 로직은 제거: App.supabaseUrl 의존성 없이 안정적으로 동작.

  // DB 드롭다운 채우기
  var dbSel = document.getElementById('dkt-db');
  if (dbSel) {
    dbSel.innerHTML = '';
    Object.keys(Docket.dbConfig).forEach(function(name) {
      var opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      dbSel.appendChild(opt);
    });
    dbSel.value = Docket.defaultDB;
  }

  // 권리유형 드롭다운 채우기
  var rightSel = document.getElementById('dkt-right');
  if (rightSel) {
    rightSel.innerHTML = '';
    Object.keys(Docket.feeSchedule).forEach(function(name) {
      var opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      rightSel.appendChild(opt);
    });
    rightSel.value = '특허';
  }

  Docket.onRightChange();
};

// 권리유형 변경 → 체크박스 리스트 재렌더 + 상세 조항 업데이트 + 재계산
Docket.onRightChange = function() {
  Docket.renderFeeCheckboxes();
  Docket.updateNotesTextarea();
  var right = document.getElementById('dkt-right').value;
  // 상표 상품명 유형 토글 표시/숨김
  var tmToggle = document.getElementById('dkt-trademark-term-wrap');
  if (tmToggle) tmToggle.style.display = (right === '상표') ? '' : 'none';
  // 특허·실용신안 감면 패널 표시/숨김
  var patentOpts = document.getElementById('dkt-patent-options-wrap');
  if (patentOpts) patentOpts.style.display = (right === '특허' || right === '실용신안') ? '' : 'none';
  Docket.recalc();
};

// DB 변경 (특별한 폼 업데이트 없음 — 템플릿/할인은 엑셀 생성 시점에 적용)
Docket.onDBChange = function() {
  // noop: DB별 고정값은 collectData/generateFromTemplate에서 자동 적용
};

// 우선심사 O/X 라디오 변경 → 사유 선택 박스 표시/숨김
Docket.onPriorityExamChange = function() {
  var sel = document.querySelector('input[name="dkt-priority-exam"]:checked');
  var wrap = document.getElementById('dkt-priority-reasons-wrap');
  if (!wrap) return;
  wrap.style.display = (sel && sel.value === 'O') ? '' : 'none';
};

// 수수료 체크박스 리스트 렌더링 (권리유형 변경 시 호출)
Docket.renderFeeCheckboxes = function() {
  var right = document.getElementById('dkt-right').value;
  var schedule = Docket.feeSchedule[right];
  var container = document.getElementById('dkt-fee-checkboxes');
  if (!container || !schedule) return;

  container.innerHTML = '';
  schedule.items.forEach(function(item) {
    var row = document.createElement('label');
    row.className = 'dkt-fee-cb-row';
    row.innerHTML =
      '<input type="checkbox" data-key="' + item.key + '"' +
      (item.defaultChecked ? ' checked' : '') +
      ' onchange="Docket.recalc()" />' +
      '<span class="name">' + item.name + '</span>' +
      '<span class="price">' + Docket.fmt(item.unitPrice) + '</span>';
    container.appendChild(row);
  });
};

// 상세 조항 textarea 자동 입력 (권리유형 → notesCategory)
Docket.updateNotesTextarea = function() {
  var area = document.getElementById('dkt-notes');
  if (!area || area.dataset.userEdited) return;
  var right = document.getElementById('dkt-right').value;
  var schedule = Docket.feeSchedule[right];
  var category = (schedule && schedule.notesCategory) || 'patent';
  area.value = (Docket.defaultNotes[category] || []).join('\n');
};

// 실제 청구금액을 4가지 시나리오(부가세/관납료 × 별도/포함)에 따라 분해.
// 반환: { actualFee(순수수료), vat, feeSub(수수료+VAT), govTotal, grand, discount }
//
// 시나리오:
//   A) 별도/별도: 입력=순수수료, grand = 입력 + VAT + 관납료
//   B) 포함/별도: 입력=수수료+VAT, grand = 입력 + 관납료
//   C) 별도/포함: 입력=수수료+관납료, grand = 입력 + VAT
//   D) 포함/포함: 입력=수수료+VAT+관납료, grand = 입력 (불변)
//
// 계산 절차:
//   1. govIncluded → actualInput에서 관납료 제거 → withoutGov
//   2. vatIncluded → withoutGov에서 VAT 제거 → fee; vat = withoutGov - fee (반올림 보정)
//   3. grand = fee + vat + govTotal (항상 동일 공식)
Docket._computeFees = function(listedTotal, govTotal, actualInput, vatIncluded, govIncluded) {
  // 실제 청구금액 미입력(또는 0 이하) → 수가표 기준가를 그대로 사용 (할인 없음)
  //   actualFee = listedTotal, discount = 0
  //   할인 행은 엑셀 생성 시 숨김 처리됨
  if (!actualInput || actualInput <= 0) {
    var vat0 = Math.round(listedTotal * 0.1);
    return {
      listedTotal: listedTotal,
      actualInput: 0,
      actualFee: listedTotal,
      vat: vat0,
      feeSub: listedTotal + vat0,
      govTotal: govTotal,
      grand: listedTotal + vat0 + govTotal,
      discount: 0,
      vatIncluded: vatIncluded,
      govIncluded: govIncluded,
    };
  }

  var withoutGov = govIncluded ? (actualInput - govTotal) : actualInput;
  var fee, vat;
  if (vatIncluded) {
    fee = Math.round(withoutGov / 1.1);
    vat = withoutGov - fee; // 나누기 후 차감으로 반올림 오차 제거
  } else {
    fee = withoutGov;
    vat = Math.round(fee * 0.1);
  }
  var feeSub = fee + vat;
  var grand = feeSub + govTotal;
  var discount = listedTotal - fee;
  return {
    listedTotal: listedTotal,
    actualInput: actualInput,
    actualFee: fee,
    vat: vat,
    feeSub: feeSub,
    govTotal: govTotal,
    grand: grand,
    discount: discount,
    vatIncluded: vatIncluded,
    govIncluded: govIncluded,
  };
};

// 상표 상품명 유형 (비고시명칭 / 고시명칭) — 출원료 관납료 단가 결정
//   non-gazetted: 52,000원 (기본값)
//   gazetted:     46,000원
Docket.getTrademarkTermType = function() {
  var el = document.querySelector('input[name="dkt-trademark-term"]:checked');
  return el ? el.value : 'non-gazetted';
};

// ── 특허·실용신안 관납료 단가 (2024년 전자출원 기준) ──
// 출처: 특허청 공고 수수료 단가표. 실제 고시 개정 시 업데이트 필요.
// 청구항 수와 기업 규모에 따라 동적 계산됨.
Docket.patentGovRates = {
  patent: {
    application:         46000,    // 출원료 (청구항 무관)
    examinationBase:    166000,    // 심사청구료 기본
    examinationPerClaim: 51000,    // 청구항당 심사청구 가산료
    priorityExam:       200000,    // 우선심사신청료
    amendment:            4000,    // 보정료 (감면 대상 X)
    registrationBase:    15000,    // 설정등록료 기본 (연간)
    registrationPerClaim: 13000,   // 청구항당 등록료 가산 (연간)
    registrationYears:       3,    // 최초 3년분
  },
  utility: {
    application:         20000,
    examinationBase:     71000,
    examinationPerClaim: 19000,
    priorityExam:       200000,
    amendment:            4000,
    registrationBase:    12000,
    registrationPerClaim: 4000,
    registrationYears:       3,
  },
};

// 기업 규모별 감면율 (부담율)
//   small  = 중소기업/개인/벤처 → 70% 감면 = 30% 부담
//   medium = 중견기업           → 50% 감면 = 50% 부담
//   large  = 대기업             → 감면 없음 = 100% 부담
// 적용 대상: 출원료·심사청구료·우선심사료·최초 3년분 등록료
// 제외 대상: 보정료
Docket.reductionRates = {
  small:  { rate: 0.3, label: '중소기업/개인/벤처 (70% 감면)' },
  medium: { rate: 0.5, label: '중견기업 (50% 감면)' },
  large:  { rate: 1.0, label: '대기업 (감면 없음)' },
};

// 청구항 수 입력값 반환 (기본 3)
Docket.getPatentClaims = function() {
  var el = document.getElementById('dkt-patent-claims');
  return el ? Math.max(1, parseInt(el.value) || 3) : 3;
};

// 기업 규모 라디오 값 반환 (기본 small)
Docket.getReduction = function() {
  var el = document.querySelector('input[name="dkt-reduction"]:checked');
  return el ? el.value : 'small';
};

// 특허/실용신안 관납료 동적 계산 (청구항 + 감면 반영)
Docket._resolvePatentGov = function(item, rightKey) {
  var rates = Docket.patentGovRates[rightKey];
  if (!rates) return item.linkedGov || [];
  var claims = Docket.getPatentClaims();
  var reductionKey = Docket.getReduction();
  var reductionCfg = Docket.reductionRates[reductionKey] || Docket.reductionRates.small;
  var rate = reductionCfg.rate;

  switch (item.key) {
    case 'application': {
      var appFee = rates.application + rates.examinationBase + rates.examinationPerClaim * claims;
      return [{
        name: '출원료+심사청구료 (' + claims + '항)',
        unitPrice: Math.round(appFee * rate),
      }];
    }
    case 'priority':
      return [{ name: '우선심사신청료', unitPrice: Math.round(rates.priorityExam * rate) }];
    case 'oa':
      // 보정료는 감면 대상 아님
      return [{ name: '보정료', unitPrice: rates.amendment }];
    case 'registration': {
      var reg = (rates.registrationBase + rates.registrationPerClaim * claims) * rates.registrationYears;
      return [{
        name: '등록료 (설정+1~3년, ' + claims + '항)',
        unitPrice: Math.round(reg * rate),
      }];
    }
    default:
      return item.linkedGov || [];
  }
};

// 특정 수수료 항목에 대한 실제 연동 관납료 반환
//   - 상표 출원착수금: term type(비고시/고시)에 따라 variant 교체
//   - 특허/실용신안: 청구항 수 + 기업 규모 감면율 동적 계산
//   - 그 외: 정적 linkedGov 반환
Docket._resolveLinkedGov = function(right, item) {
  if (right === '상표' && item.key === 'application') {
    var termType = Docket.getTrademarkTermType();
    if (termType === 'gazetted') {
      return [{ name: '출원료(고시명칭)', unitPrice: 46000 }];
    }
    return [{ name: '출원료(비고시명칭)', unitPrice: 52000 }];
  }
  if (right === '특허') return Docket._resolvePatentGov(item, 'patent');
  if (right === '실용신안') return Docket._resolvePatentGov(item, 'utility');
  return item.linkedGov || [];
};

// 체크된 수수료 항목 + 연동 관납료를 반환 (recalc/collectData 공용)
Docket._selection = function() {
  var right = document.getElementById('dkt-right').value;
  var schedule = Docket.feeSchedule[right];
  var cnt = parseInt(document.getElementById('dkt-case-count').value) || 1;

  var checkedKeys = {};
  document.querySelectorAll('#dkt-fee-checkboxes input[type="checkbox"]:checked').forEach(function(cb) {
    checkedKeys[cb.dataset.key] = true;
  });

  var feeItems = [];
  var govItems = [];
  if (schedule) {
    schedule.items.forEach(function(item) {
      if (!checkedKeys[item.key]) return;
      feeItems.push({ name: item.name, unitPrice: item.unitPrice, qty: cnt });
      var linkedGov = Docket._resolveLinkedGov(right, item);
      linkedGov.forEach(function(g) {
        govItems.push({ name: g.name, unitPrice: g.unitPrice, qty: cnt });
      });
    });
  }

  return { right: right, cnt: cnt, feeItems: feeItems, govItems: govItems, checkedKeys: checkedKeys };
};

// 체크박스 변경 / 실제 청구금액 입력 → 할인 자동 계산
Docket.recalc = function() {
  var sel = Docket._selection();
  var feeItems = sel.feeItems;
  var govItems = sel.govItems;

  // 합계 계산
  var listedTotal = feeItems.reduce(function(s, i) { return s + i.unitPrice * i.qty; }, 0);
  var govTotal = govItems.reduce(function(s, i) { return s + i.unitPrice * i.qty; }, 0);

  // 연동 관납료 테이블 렌더링
  var govBody = document.getElementById('dkt-gov-summary');
  if (govBody) {
    govBody.innerHTML = '';
    if (govItems.length === 0) {
      govBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;padding:12px">선택된 수수료 항목이 없거나 연동 관납료가 없습니다</td></tr>';
    } else {
      govItems.forEach(function(g) {
        var amt = g.unitPrice * g.qty;
        govBody.innerHTML += '<tr><td>' + g.name + '</td><td class="n">' + Docket.fmt(g.unitPrice) + '</td><td class="n">' + g.qty + '</td><td class="n">' + Docket.fmt(amt) + '</td></tr>';
      });
      govBody.innerHTML += '<tr class="total"><td colspan="3"><strong>관납료 합계</strong></td><td class="n"><strong>' + Docket.fmt(govTotal) + '</strong></td></tr>';
    }
  }

  // 실제 청구금액 + 부가세/관납료 포함여부 옵션으로 할인·VAT 분해
  var actualInput = parseInt(document.getElementById('dkt-actual-fee').value) || 0;
  var vatRadio = document.querySelector('input[name="dkt-vat-included"]:checked');
  var govRadio = document.querySelector('input[name="dkt-gov-included"]:checked');
  var vatIncluded = vatRadio ? vatRadio.value === 'yes' : false;
  var govIncluded = govRadio ? govRadio.value === 'yes' : false;

  var calc = Docket._computeFees(listedTotal, govTotal, actualInput, vatIncluded, govIncluded);

  // DOM 업데이트
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = Docket.fmt(val); };
  set('dkt-listed-total', calc.listedTotal);
  set('dkt-actual-fee-display', calc.actualFee);
  set('dkt-discount-display', calc.discount);
  set('dkt-vat-display', calc.vat);
  set('dkt-fee-with-vat-display', calc.feeSub);
  set('dkt-gov-total-display', calc.govTotal);
  set('dkt-grand-total', calc.grand);
};

// 상세 조항 기본값 복원
Docket.resetNotes = function() {
  var area = document.getElementById('dkt-notes');
  if (!area) return;
  delete area.dataset.userEdited;
  Docket.updateNotesTextarea();
};

// ═══════════════════════════════════════════════════════════════
// 폼 데이터 수집 + 이메일 본문 생성
// ═══════════════════════════════════════════════════════════════

// 폼에서 모든 입력값을 수집하여 data 객체로 반환
Docket.collectData = function() {
  var v = function(id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  var radio = function(name) { var el = document.querySelector('input[name="'+name+'"]:checked'); return el ? el.value : ''; };

  var sel = Docket._selection();
  var right = sel.right;
  var cnt = sel.cnt;
  var feeItems = sel.feeItems;
  var govItems = sel.govItems;
  var db = v('dkt-db') || Docket.defaultDB;
  var dbCfg = Docket.dbConfig[db] || Docket.dbConfig[Docket.defaultDB];

  // 수가표 기반 금액 계산 (체크된 항목만) — 헬퍼로 중앙화
  var listedTotal = feeItems.reduce(function(s,i){return s+i.unitPrice*i.qty;}, 0);
  var govTotal = govItems.reduce(function(s,i){return s+i.unitPrice*i.qty;}, 0);
  var actualInput = parseInt(v('dkt-actual-fee')) || 0;
  var vatIncluded = radio('dkt-vat-included') === 'yes';
  var govIncluded = radio('dkt-gov-included') === 'yes';
  var calc = Docket._computeFees(listedTotal, govTotal, actualInput, vatIncluded, govIncluded);
  var actualFee = calc.actualFee;
  var discount = calc.discount;
  var vat = calc.vat;
  var feeSub = calc.feeSub;
  var grand = calc.grand;

  // 심사형태: 우선심사 체크 여부로 결정
  var examType = sel.checkedKeys['priority'] ? '우선' : '일반';

  // 선택된 항목 라벨 (이메일 표시용)
  var selectedItemsLabel = feeItems.map(function(i){return i.name;}).join(', ');

  return {
    // 사건종류
    right: right,
    examType: examType,
    caseCount: cnt,
    selectedItemsLabel: selectedItemsLabel,
    checkedKeys: sel.checkedKeys,

    // 출원인
    clientCompany: v('dkt-client-company'),
    clientType: radio('dkt-client-type'),
    contactName: v('dkt-contact-name'),
    contactEmail: v('dkt-contact-email'),
    contactPhone: v('dkt-contact-phone'),
    contactCc: v('dkt-contact-cc'),

    // 관계자
    inventor: v('dkt-inventor'),
    worker: v('dkt-worker'),
    mandator: v('dkt-mandator'),
    db: db,
    dbConfig: dbCfg,
    introducer: v('dkt-introducer'),

    // 비용 (모두 _computeFees 결과)
    listedTotal: listedTotal,
    actualInput: actualInput,
    actualFee: actualFee,
    discount: discount,
    vat: vat,
    feeSub: feeSub,
    govTotal: govTotal,
    grand: grand,
    vatIncluded: vatIncluded,
    govIncluded: govIncluded,

    // 특허·실용신안 감면 제도 메타데이터
    patentClaims: (right === '특허' || right === '실용신안') ? Docket.getPatentClaims() : null,
    reductionKey: (right === '특허' || right === '실용신안') ? Docket.getReduction() : null,
    reductionLabel: (right === '특허' || right === '실용신안')
      ? ((Docket.reductionRates[Docket.getReduction()] || {}).label || '')
      : null,

    // 견적서 raw (체크된 항목만)
    feeItems: feeItems,
    govItems: govItems,

    // 기타
    announcements: v('dkt-announcements'),
    caseContent: v('dkt-case-content'),
    priorityExam: (function() {
      // O/X 라디오 + 사유 체크박스 조합 → 문자열로 반환
      var radio = document.querySelector('input[name="dkt-priority-exam"]:checked');
      var val = radio ? radio.value : 'X';
      if (val !== 'O') return val;
      // 체크된 사유 수집
      var reasons = [];
      document.querySelectorAll('input[name="dkt-priority-reason"]:checked').forEach(function(cb) {
        reasons.push(cb.value);
      });
      var etc = v('dkt-priority-reason-etc');
      if (etc) reasons.push(etc);
      return reasons.length ? 'O (' + reasons.join(', ') + ')' : 'O';
    })(),
    draftDate: v('dkt-draft-date'),
    mustCheck: v('dkt-must-check'),

    // 상세 조항 (견적서용)
    notes: v('dkt-notes').split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean),

    // 수신인
    recipient: v('dkt-recipient') || Docket.config.recipient,

    // 견적서 엑셀용 파생 필드
    date: new Date().toISOString().split('T')[0],
    caseNumber: '',
    clientName: v('dkt-client-company'),
    caseTitle: v('dkt-case-content'),
    subject: right + '(' + examType + ') ' + cnt + '건에 대한 비용견적의 건',
    discountAmount: -Math.abs(discount), // 엑셀에는 음수로 표기
    discountQty: 1,
    discountAttorney: db,
  };
};

// 이메일 제목
Docket.buildEmailSubject = function(data) {
  return '[사건등록][의뢰인: ' + (data.clientCompany || '-') + '][' + data.right + ' 총 ' + data.caseCount + '건]';
};

// 이메일 본문 HTML (워드 양식 표 재현)
Docket.generateEmailBodyHtml = function(data) {
  var esc = function(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  };
  var row = function(label, value) {
    return '<tr>'
      + '<td style="font-weight:bold;padding:6px 14px;border:1px solid #ddd;vertical-align:top;white-space:nowrap;background:#f7f7f8">'+esc(label)+'</td>'
      + '<td style="padding:6px 14px;border:1px solid #ddd;vertical-align:top">'+value+'</td>'
      + '</tr>';
  };

  var clientLabel = data.clientType === 'new' ? '신규고객'
                  : data.clientType === 'existing' ? '기존고객' : '';
  var clientField = esc(data.clientCompany) + (clientLabel ? ' <span style="color:#666">['+clientLabel+']</span>' : '');

  var contactLines = [];
  if (data.contactName)  contactLines.push('담당자&amp;수신: ' + esc(data.contactName));
  if (data.contactEmail) contactLines.push('이메일: ' + esc(data.contactEmail));
  if (data.contactPhone) contactLines.push('전화번호: ' + esc(data.contactPhone));
  if (data.contactCc)    contactLines.push('참조: ' + esc(data.contactCc));
  var clientCell = clientField + (contactLines.length ? '<br>' + contactLines.join('<br>') : '');

  var costLines = [
    '대리인 수수료 ' + Docket.fmtMan(data.actualFee) + '만',
    '<span style="color:#666">(수가표 ' + Docket.fmtMan(data.listedTotal) + '만: ' + esc(data.db) + ' 변리사 담당 우대 반영 후 ' + Docket.fmtMan(data.actualFee) + '만)</span>',
    '부가세 포함여부: ' + (data.vatIncluded ? 'O' : 'X'),
    '관납료 포함여부: ' + (data.govIncluded ? 'O' : 'X'),
  ].join('<br>');

  var h = '<div style="font-family:\'Malgun Gothic\',\'Apple SD Gothic Neo\',sans-serif;font-size:14px;line-height:1.7;color:#222">';
  h += '<p>안녕하세요 ' + esc(data.db) + ' 변리사입니다.</p>';
  h += '<p>사건등록 해주세요.</p>';
  h += '<table style="border-collapse:collapse;font-size:13px;margin-top:12px;min-width:520px">';
  h += row('사건종류', esc(data.right) + '(' + esc(data.examType) + ') ' + data.caseCount + '건');
  if (data.selectedItemsLabel) h += row('수수료항목', esc(data.selectedItemsLabel));
  if (data.patentClaims) {
    h += row('청구항수', data.patentClaims + '항');
    h += row('감면구분', esc(data.reductionLabel || ''));
  }
  h += row('출원인', clientCell);
  h += row('발명자', esc(data.inventor) || '-');
  h += row('실무자', esc(data.worker) || '-');
  h += row('수임자', esc(data.mandator) || '-');
  h += row('DB', esc(data.db));
  h += row('소개자', esc(data.introducer) || '-');
  h += row('비용', costLines);
  h += row('출원안내', esc(data.announcements).replace(/\n/g,'<br>') || '-');
  h += row('사건내용', esc(data.caseContent) || '-');
  h += row('우선심사', esc(data.priorityExam) || '-');
  h += row('초안발송', esc(data.draftDate) || '-');
  h += row('필수확인', esc(data.mustCheck).replace(/\n/g,'<br>') || '-');
  h += '</table>';
  h += '<p style="margin-top:18px">감사합니다.<br>' + esc(data.db) + ' 드림</p>';
  h += '</div>';
  return h;
};

// 이메일 본문 plain text (Gmail fallback용)
Docket.generateEmailBodyText = function(data) {
  var pad = function(s, w) {
    var n = w - [].concat.call([], s).length;
    return s + (n > 0 ? ' '.repeat(n) : '');
  };
  var lines = [];
  lines.push('[사건등록][의뢰인: ' + (data.clientCompany || '-') + '][' + data.right + ' 총 ' + data.caseCount + '건]');
  lines.push('');
  lines.push('안녕하세요 ' + data.db + ' 변리사입니다.');
  lines.push('사건등록 해주세요.');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('사건종류 | ' + data.right + '(' + data.examType + ') ' + data.caseCount + '건');
  if (data.selectedItemsLabel) lines.push('수수료항목 | ' + data.selectedItemsLabel);
  if (data.patentClaims) {
    lines.push('청구항수 | ' + data.patentClaims + '항');
    lines.push('감면구분 | ' + (data.reductionLabel || ''));
  }
  var clientLabel = data.clientType === 'new' ? '신규고객' : data.clientType === 'existing' ? '기존고객' : '';
  lines.push('출원인   | ' + (data.clientCompany || '-') + (clientLabel ? ' [' + clientLabel + ']' : ''));
  if (data.contactName)  lines.push('         | 담당자&수신: ' + data.contactName);
  if (data.contactEmail) lines.push('         | 이메일: ' + data.contactEmail);
  if (data.contactPhone) lines.push('         | 전화번호: ' + data.contactPhone);
  if (data.contactCc)    lines.push('         | 참조: ' + data.contactCc);
  lines.push('발명자   | ' + (data.inventor || '-'));
  lines.push('실무자   | ' + (data.worker || '-'));
  lines.push('수임자   | ' + (data.mandator || '-'));
  lines.push('DB       | ' + data.db);
  lines.push('소개자   | ' + (data.introducer || '-'));
  lines.push('비용     | 대리인 수수료 ' + Docket.fmtMan(data.actualFee) + '만');
  lines.push('         | (수가표 ' + Docket.fmtMan(data.listedTotal) + '만: ' + data.db + ' 변리사 담당 우대 반영 후 ' + Docket.fmtMan(data.actualFee) + '만)');
  lines.push('         | 부가세 포함여부: ' + (data.vatIncluded ? 'O' : 'X'));
  lines.push('         | 관납료 포함여부: ' + (data.govIncluded ? 'O' : 'X'));
  lines.push('출원안내 | ' + (data.announcements || '-').replace(/\n/g, '\n         | '));
  lines.push('사건내용 | ' + (data.caseContent || '-'));
  lines.push('우선심사 | ' + (data.priorityExam || '-'));
  lines.push('초안발송 | ' + (data.draftDate || '-'));
  lines.push('필수확인 | ' + (data.mustCheck || '-').replace(/\n/g, '\n         | '));
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('감사합니다.');
  lines.push(data.db + ' 드림');
  return lines.join('\n');
};

// ═══════════════════════════════════════════════════════════════
// 견적서 엑셀 생성 (JSZip + sheet1.xml 직접 조작)
// ═══════════════════════════════════════════════════════════════
// ExcelJS는 이미지 포함 xlsx 템플릿을 재구성할 때 서식/로고를 손상시키고
// orphan Content Type을 만들어 Excel 호환성 문제를 일으키므로, 템플릿을
// zip으로 직접 열어 xl/worksheets/sheet1.xml 만 string 조작한다.
// 장점: 로고/푸터/이미지/서식/병합이 byte 단위로 완전 보존됨.

// XML 이스케이프
Docket._escapeXml = function(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

// 숫자 → 한글 (예: 5857600 → "오백팔십오만칠천육백")
Docket.toKorean = function(num) {
  if (num === 0 || !num) return '영';
  num = Math.round(num);
  var d = ['','일','이','삼','사','오','육','칠','팔','구'];
  var u = ['','만','억','조'];
  var s = ['','십','백','천'];
  var r = '', neg = num < 0;
  if (neg) num = -num;
  var ui = 0;
  while (num > 0) {
    var chunk = num % 10000;
    if (chunk > 0) {
      var cs = '';
      for (var i = 0; chunk > 0; i++) {
        var dd = chunk % 10;
        if (dd > 0) cs = (dd === 1 && i > 0 ? '' : d[dd]) + s[i] + cs;
        chunk = Math.floor(chunk / 10);
      }
      r = cs + u[ui] + r;
    }
    num = Math.floor(num / 10000);
    ui++;
  }
  return (neg ? '마이너스 ' : '') + r;
};

// 행 XML에서 특정 컬럼 셀의 값을 숫자로 설정 (inlineStr → t="n" 변환)
Docket._setCellNum = function(rowXml, col, value) {
  var re = new RegExp('<c r="' + col + '\\d+"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)');
  return rowXml.replace(re, function(match) {
    var openRe = /^<c r="([A-Z]+\d+)"([^\/>]*)/;
    var m = openRe.exec(match);
    if (!m) return match;
    var ref = m[1];
    var attrs = (m[2] || '').replace(/\s*t="[^"]*"/g, '');
    return '<c r="' + ref + '"' + attrs + ' t="n"><v>' + value + '</v></c>';
  });
};

// 행 XML에서 특정 컬럼 셀의 값을 inlineStr로 설정
Docket._setCellStr = function(rowXml, col, value) {
  var escaped = Docket._escapeXml(value);
  var re = new RegExp('<c r="' + col + '\\d+"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)');
  return rowXml.replace(re, function(match) {
    var openRe = /^<c r="([A-Z]+\d+)"([^\/>]*)/;
    var m = openRe.exec(match);
    if (!m) return match;
    var ref = m[1];
    var attrs = (m[2] || '').replace(/\s*t="[^"]*"/g, '');
    return '<c r="' + ref + '"' + attrs + ' t="inlineStr"><is><t>' + escaped + '</t></is></c>';
  });
};

// 행 XML 복제 시 row/cell 번호 이동 (oldNum → newNum)
Docket._shiftRowXml = function(rowXml, oldNum, newNum) {
  var oldStr = String(oldNum), newStr = String(newNum);
  var out = rowXml.replace(new RegExp('(<row r=")' + oldStr + '(")'), '$1' + newStr + '$2');
  out = out.replace(new RegExp('(<c r="[A-Z]+)' + oldStr + '(")', 'g'), '$1' + newStr + '$2');
  return out;
};

// 행 XML의 <row ...> 열기 태그에 ht/customHeight 속성 설정 (기존 값 있으면 교체)
// 주의: \s+ (0이 아닌 1+ 공백)를 요구해야 customHeight="1" 내부의 ht="1" 부분문자열과
//       충돌하지 않음 (\s*는 0공백도 허용 → customHeig[ht="1"] 파편 발생)
Docket._setRowHeight = function(rowXml, heightPt) {
  return rowXml.replace(/^<row r="(\d+)"([^>]*)>/, function(match, num, attrs) {
    var cleaned = attrs
      .replace(/\s+ht="[^"]*"/g, '')
      .replace(/\s+customHeight="[^"]*"/g, '');
    return '<row r="' + num + '" ht="' + heightPt + '" customHeight="1"' + cleaned + '>';
  });
};

// 행 XML의 <row ...> 열기 태그에 hidden="1" 속성 설정
Docket._setRowHidden = function(rowXml) {
  return rowXml.replace(/^<row r="(\d+)"([^>]*)>/, function(match, num, attrs) {
    var cleaned = attrs.replace(/\s+hidden="[^"]*"/g, '');
    return '<row r="' + num + '" hidden="1"' + cleaned + '>';
  });
};

// drawing1.xml의 <row>N</row> 앵커 참조를 shifts 배열에 따라 보정
//   shifts = [{ threshold, amount }, ...] — 원본 행 번호 기준
//   각 앵커 row에 대해, original >= threshold인 모든 shift의 amount를 합산하여 이동
//   이로써 행 삽입 시 푸터/로고 이미지가 올바른 위치로 따라가고 세로 stretch 방지
Docket._shiftDrawingRows = function(drawingXml, shifts) {
  if (!shifts || shifts.length === 0) return drawingXml;
  return drawingXml.replace(/<row>(\d+)<\/row>/g, function(match, numStr) {
    var num = parseInt(numStr);
    var newNum = num;
    shifts.forEach(function(s) {
      if (num >= s.threshold) newNum += s.amount;
    });
    return '<row>' + newNum + '</row>';
  });
};

// 특정 컬럼의 셀 s(style) 속성 값을 새 인덱스로 교체
Docket._setCellStyleInRow = function(rowXml, col, styleIdx) {
  var re = new RegExp('<c r="' + col + '\\d+"[^>]*>');
  return rowXml.replace(re, function(match) {
    if (/\ss="[^"]*"/.test(match)) {
      return match.replace(/\ss="[^"]*"/, ' s="' + styleIdx + '"');
    }
    return match.replace(/(\/?>)$/, ' s="' + styleIdx + '"$1');
  });
};

// 특정 텍스트를 포함한 행을 찾아 { rowNum, startIdx, endIdx, xml } 반환
Docket._findRowWithText = function(xml, searchText) {
  var mIdx = xml.indexOf(searchText);
  if (mIdx < 0) return null;
  var rowStart = xml.lastIndexOf('<row ', mIdx);
  if (rowStart < 0) return null;
  var rowEnd = xml.indexOf('</row>', mIdx);
  if (rowEnd < 0) return null;
  rowEnd += '</row>'.length;
  var rowXml = xml.substring(rowStart, rowEnd);
  var numMatch = rowXml.match(/^<row r="(\d+)"/);
  if (!numMatch) return null;
  return { rowNum: parseInt(numMatch[1]), startIdx: rowStart, endIdx: rowEnd, xml: rowXml };
};

// styles.xml에 wrapText 속성이 있는 새 xf(cellXf)를 추가하고 그 인덱스를 반환
// cloneXfIdx가 지정되면 해당 xf를 복제해서 alignment만 수정 (font/border 유지)
Docket._addWrapTextXf = async function(zip, cloneXfIdx) {
  var stylesFile = zip.file('xl/styles.xml');
  if (!stylesFile) return null;
  var xml = await stylesFile.async('string');

  var cellXfsRe = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/;
  var match = cellXfsRe.exec(xml);
  if (!match) return null;

  var count = parseInt(match[1]);
  var body = match[2];

  // Parse existing xf elements (self-closing + nested 모두 지원)
  var xfRe = /<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g;
  var xfs = [];
  var xm;
  while ((xm = xfRe.exec(body)) !== null) {
    xfs.push(xm[0]);
  }

  // 복제 대상 xf (지정 인덱스 또는 기본값)
  var srcXf = (cloneXfIdx != null && xfs[cloneXfIdx]) ? xfs[cloneXfIdx] :
              '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1" xfId="0"><alignment vertical="top"/></xf>';

  // applyAlignment="1" 속성 보장
  if (!/applyAlignment="1"/.test(srcXf)) {
    srcXf = srcXf.replace(/<xf\b/, '<xf applyAlignment="1"');
  }

  var newXf = srcXf;
  // alignment 속성 수정: vertical="top" + wrapText="1"
  if (/<alignment[^>]*\/>/.test(newXf)) {
    newXf = newXf.replace(/<alignment([^>]*)\/>/, function(m, attrs) {
      var cleaned = attrs.replace(/\s*wrapText="[^"]*"/g, '').replace(/\s*vertical="[^"]*"/g, '');
      return '<alignment' + cleaned + ' vertical="top" wrapText="1"/>';
    });
  } else if (/<alignment[^>]*>/.test(newXf)) {
    newXf = newXf.replace(/<alignment([^>]*)>/, function(m, attrs) {
      var cleaned = attrs.replace(/\s*wrapText="[^"]*"/g, '').replace(/\s*vertical="[^"]*"/g, '');
      return '<alignment' + cleaned + ' vertical="top" wrapText="1">';
    });
  } else {
    // alignment 엘리먼트 없음 → 추가
    if (/<\/xf>$/.test(newXf)) {
      newXf = newXf.replace(/<\/xf>$/, '<alignment vertical="top" wrapText="1"/></xf>');
    } else if (/\/>$/.test(newXf)) {
      newXf = newXf.replace(/\/>$/, '><alignment vertical="top" wrapText="1"/></xf>');
    }
  }

  // cellXfs 뒤에 추가 + count 갱신
  var newIndex = count;
  xml = xml.replace(cellXfsRe, '<cellXfs count="' + (count + 1) + '">' + body + newXf + '</cellXfs>');
  zip.file('xl/styles.xml', xml);
  return newIndex;
};

// XML 내의 모든 row/cell/merge 참조를 threshold 이상이면 amount만큼 이동
// 병합 셀은 span/shift를 적절히 처리 (앞쪽 경계는 유지, 뒤쪽만 증가 → vertical merge 확장)
Docket._shiftXmlRefs = function(xml, threshold, amount) {
  // <row r="N">
  var out = xml.replace(/(<row r=")(\d+)(")/g, function(m, pre, n, post) {
    var num = parseInt(n);
    return num >= threshold ? pre + (num + amount) + post : m;
  });
  // <c r="ColN">
  out = out.replace(/(<c r=")([A-Z]+)(\d+)(")/g, function(m, pre, col, n, post) {
    var num = parseInt(n);
    return num >= threshold ? pre + col + (num + amount) + post : m;
  });
  // <mergeCell ref="C1R1:C2R2"/>
  out = out.replace(/(<mergeCell ref=")([A-Z]+)(\d+)(:)([A-Z]+)(\d+)(")/g, function(m, p1, c1, r1, sep, c2, r2, p2) {
    var rn1 = parseInt(r1), rn2 = parseInt(r2);
    var nr1 = rn1 >= threshold ? rn1 + amount : rn1;
    var nr2 = rn2 >= threshold ? rn2 + amount : rn2;
    return p1 + c1 + nr1 + sep + c2 + nr2 + p2;
  });
  // <dimension ref="C1R1:C2R2"/> — 하단만 확장
  out = out.replace(/(<dimension ref=")([A-Z]+)(\d+)(:)([A-Z]+)(\d+)(")/g, function(m, p1, c1, r1, sep, c2, r2, p2) {
    var rn2 = parseInt(r2);
    var nr2 = rn2 >= threshold ? rn2 + amount : rn2;
    return p1 + c1 + r1 + sep + c2 + nr2 + p2;
  });
  return out;
};

// 마커 이름을 포함한 행을 찾아 { rowNum, startIdx, endIdx, xml } 반환
Docket._findRowWithMarker = function(xml, markerName) {
  var mIdx = xml.search(new RegExp('\\{\\{' + markerName + '\\}\\}'));
  if (mIdx < 0) return null;
  var rowStart = xml.lastIndexOf('<row ', mIdx);
  if (rowStart < 0) return null;
  var rowEnd = xml.indexOf('</row>', mIdx);
  if (rowEnd < 0) return null;
  rowEnd += '</row>'.length;
  var rowXml = xml.substring(rowStart, rowEnd);
  var numMatch = rowXml.match(/^<row r="(\d+)"/);
  if (!numMatch) return null;
  return { rowNum: parseInt(numMatch[1]), startIdx: rowStart, endIdx: rowEnd, xml: rowXml };
};

// 범위 확장: source 행을 items.length번 복제하고 각 복제본에 item 데이터를 채움
// 이후 뒤쪽 행/셀/병합 참조를 shift만큼 이동하고 source 행의 horizontal merge를 복제
Docket._expandRange = function(xml, markerName, items, fillFn) {
  if (!items || items.length === 0) return xml;
  var src = Docket._findRowWithMarker(xml, markerName);
  if (!src) return xml;

  var sourceRow = src.rowNum;
  var shift = items.length - 1;

  // 복제된 행 XML 생성
  var newRows = '';
  for (var i = 0; i < items.length; i++) {
    var rowXml = src.xml;
    if (i > 0) rowXml = Docket._shiftRowXml(rowXml, sourceRow, sourceRow + i);
    rowXml = fillFn(rowXml, items[i], i);
    newRows += rowXml;
  }

  // 원본 행의 horizontal merge 수집 (복제된 행들에 복사해야 함)
  var horizontalMerges = [];
  var mRe = /<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g;
  var mm;
  while ((mm = mRe.exec(xml)) !== null) {
    var r1 = parseInt(mm[2]), r2 = parseInt(mm[4]);
    if (r1 === sourceRow && r2 === sourceRow) {
      horizontalMerges.push({ c1: mm[1], c2: mm[3] });
    }
  }

  // 원본 행을 newRows로 치환
  xml = xml.substring(0, src.startIdx) + newRows + xml.substring(src.endIdx);

  // 뒤쪽 섹션을 shift만큼 이동 (병합 참조 포함)
  if (shift > 0) {
    var afterStart = src.startIdx + newRows.length;
    var before = xml.substring(0, afterStart);
    var after = xml.substring(afterStart);
    after = Docket._shiftXmlRefs(after, sourceRow + 1, shift);
    xml = before + after;

    // 복제된 행들에 새 horizontal merge 생성
    if (horizontalMerges.length > 0) {
      var newMergeXml = '';
      horizontalMerges.forEach(function(hm) {
        for (var k = 1; k <= shift; k++) {
          newMergeXml += '<mergeCell ref="' + hm.c1 + (sourceRow + k) + ':' + hm.c2 + (sourceRow + k) + '"/>';
        }
      });
      xml = xml.replace('</mergeCells>', newMergeXml + '</mergeCells>');
      // mergeCells count 갱신
      var newCount = (xml.match(/<mergeCell /g) || []).length;
      xml = xml.replace(/<mergeCells count="\d+"/, '<mergeCells count="' + newCount + '"');
    }
  }

  return xml;
};

// sheet1.xml 전체 처리 (범위 확장 + 단순 마커 치환)
Docket._processSheetXml = function(xml, data) {
  // 1) 범위 확장: NOTES → GOV → FEE (bottom-up)
  //    NOTES 셀에 wrapText 스타일 적용 + 텍스트 길이에 따라 행 높이 자동 조정
  //    B~J 병합 셀 폭 기준 한 줄 약 85자, 줄당 15pt, 최소 15pt
  var wrapIdx = data._wrapStyleIdx;
  xml = Docket._expandRange(xml, 'NOTE_TEXT', (data.notes || []).map(function(n){return {text:n};}),
    function(rowXml, item) {
      rowXml = rowXml.replace(/\{\{NOTES_START\}\}/g, '');
      rowXml = rowXml.replace(/\{\{NOTE_TEXT\}\}/g, Docket._escapeXml(item.text));
      // wrapText 스타일 적용 (B 셀이 B:J 병합의 top-left)
      if (wrapIdx != null) {
        rowXml = Docket._setCellStyleInRow(rowXml, 'B', wrapIdx);
      }
      // 행 높이: 85자 기준, 줄당 15pt, 최소 15pt
      var txt = item.text || '';
      var height = Math.max(15, Math.ceil(txt.length / 85) * 15);
      rowXml = Docket._setRowHeight(rowXml, height);
      return rowXml;
    });

  // 1-2) "3. 상세" 제목 행 높이를 15pt로 고정 (템플릿 기본 4.5pt는 너무 작음)
  //      XML 내 인코딩: "3. &#49345;&#49464;"
  var detailTitleInfo = Docket._findRowWithText(xml, '3. &#49345;&#49464;');
  if (detailTitleInfo) {
    var titleRow = Docket._setRowHeight(detailTitleInfo.xml, 15);
    xml = xml.substring(0, detailTitleInfo.startIdx) + titleRow + xml.substring(detailTitleInfo.endIdx);
  }

  xml = Docket._expandRange(xml, 'GOV_ITEM_NAME', (data.govItems || []),
    function(rowXml, item) {
      rowXml = rowXml.replace(/\{\{GOV_START\}\}/g, '');
      rowXml = Docket._setCellStr(rowXml, 'C', item.name);
      rowXml = Docket._setCellNum(rowXml, 'D', item.unitPrice);
      rowXml = Docket._setCellNum(rowXml, 'E', item.qty);
      rowXml = Docket._setCellNum(rowXml, 'G', item.unitPrice * item.qty);
      return rowXml;
    });

  xml = Docket._expandRange(xml, 'FEE_ITEM_NAME', (data.feeItems || []),
    function(rowXml, item) {
      rowXml = rowXml.replace(/\{\{FEE_START\}\}/g, '');
      rowXml = Docket._setCellStr(rowXml, 'C', item.name);
      rowXml = Docket._setCellNum(rowXml, 'D', item.unitPrice);
      rowXml = Docket._setCellNum(rowXml, 'E', item.qty);
      rowXml = Docket._setCellNum(rowXml, 'G', item.unitPrice * item.qty);
      return rowXml;
    });

  // 2) FEE_END (할인 행) 처리 — FEE 확장 후 아래로 밀려 있음
  //    할인 금액이 0이면 행을 숨김 처리 (실제 청구금액 미입력 시)
  var feeEndInfo = Docket._findRowWithMarker(xml, 'FEE_END');
  if (feeEndInfo) {
    var discRow = feeEndInfo.xml;
    discRow = discRow.replace(/\{\{FEE_END\}\}/g, '');
    var dAmt = data.discountAmount || 0;
    var dQty = data.discountQty || 1;

    if (dAmt !== 0) {
      // 할인 있음 → 값 주입
      discRow = Docket._setCellNum(discRow, 'D', dAmt);
      discRow = Docket._setCellNum(discRow, 'E', dQty);
      discRow = Docket._setCellNum(discRow, 'G', dAmt * dQty);
    } else {
      // 할인 없음 → 행 숨김 (hidden="1"); 셀 값은 건드리지 않음
      discRow = Docket._setRowHidden(discRow);
    }

    xml = xml.substring(0, feeEndInfo.startIdx) + discRow + xml.substring(feeEndInfo.endIdx);
  }

  // 3) 잔여 NOTES_END / GOV_END 마커 클린업
  xml = xml.replace(/\{\{NOTES_END\}\}/g, '');
  xml = xml.replace(/\{\{GOV_END\}\}/g, '');

  // 4) 단순 마커
  var grand = data.grand || 0;

  // 텍스트 마커: {{MARKER}} → 값 (셀 구조 유지)
  var textMarkers = {
    CASE_NUMBER:  data.caseNumber || '',
    DATE:         data.date || '',
    CLIENT_NAME:  data.clientName || '',
    SUBJECT:      data.subject || '',
    CASE_TITLE:   data.caseTitle || '',
    TOTAL_KOREAN: Docket.toKorean(grand) + ' 원정',
  };
  Object.keys(textMarkers).forEach(function(key) {
    var val = Docket._escapeXml(textMarkers[key]);
    xml = xml.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), val);
  });

  // 숫자 마커: <c ... t="inlineStr"><is><t>{{MARKER}}</t></is></c> → <c ... t="n"><v>숫자</v></c>
  var numMarkers = {
    TOTAL_AMOUNT:  grand,
    FEE_SUBTOTAL:  data.actualFee || 0,
    VAT:           data.vat || 0,
    FEE_WITH_VAT:  data.feeSub || 0,
    GOV_SUBTOTAL:  data.govTotal || 0,
    GRAND_TOTAL:   grand,
  };
  Object.keys(numMarkers).forEach(function(key) {
    var re = new RegExp('<c([^>]*?)\\s*t="inlineStr"([^>]*?)>\\s*<is>\\s*<t[^>]*>\\{\\{' + key + '\\}\\}</t>\\s*</is>\\s*</c>', 'g');
    xml = xml.replace(re, function(match, before, after) {
      var combined = (before + after).replace(/\s+/g, ' ').replace(/\s*$/, '');
      return '<c' + combined + ' t="n"><v>' + numMarkers[key] + '</v></c>';
    });
  });

  return xml;
};

// 템플릿 기반 견적서 엑셀 생성 (JSZip 직접 조작)
// 반환: ArrayBuffer
Docket.generateFromTemplate = async function(data) {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip 라이브러리가 로드되지 않았습니다');
  }

  // 1) 템플릿 로드
  var templatePath = Docket.getTemplatePath(data.db);
  var res = await fetch(templatePath);
  if (!res.ok) throw new Error('템플릿 로드 실패: ' + templatePath + ' (HTTP ' + res.status + ')');
  var buf = await res.arrayBuffer();

  // 2) zip으로 열기
  var zip = await JSZip.loadAsync(buf);
  var sheetPath = 'xl/worksheets/sheet1.xml';
  var sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error('템플릿에 ' + sheetPath + '이 없습니다');
  var xml = await sheetFile.async('string');

  // 3) 원본 sheet에서 source 행 위치를 스캔 (drawing 앵커 보정용)
  //    FEE/GOV/NOTES 각 source row의 원본 번호를 구한다
  var feeSrcInfo = Docket._findRowWithMarker(xml, 'FEE_ITEM_NAME');
  var govSrcInfo = Docket._findRowWithMarker(xml, 'GOV_ITEM_NAME');
  var notesSrcInfo = Docket._findRowWithMarker(xml, 'NOTE_TEXT');

  var feeCount = (data.feeItems || []).length;
  var govCount = (data.govItems || []).length;
  var notesCount = (data.notes || []).length;

  var drawingShifts = [];
  if (feeSrcInfo && feeCount > 1) drawingShifts.push({ threshold: feeSrcInfo.rowNum + 1, amount: feeCount - 1 });
  if (govSrcInfo && govCount > 1) drawingShifts.push({ threshold: govSrcInfo.rowNum + 1, amount: govCount - 1 });
  if (notesSrcInfo && notesCount > 1) drawingShifts.push({ threshold: notesSrcInfo.rowNum + 1, amount: notesCount - 1 });

  // 3-2) NOTES 셀에 wrapText를 적용할 새 cellXf를 styles.xml에 추가
  //      (기존 NOTE_TEXT 셀의 스타일을 복제해서 alignment에 wrapText 추가)
  var noteCellStyleIdx = null;
  if (notesSrcInfo) {
    var noteCellMatch = notesSrcInfo.xml.match(/<c r="B\d+"[^>]*\ss="(\d+)"[^>]*>\s*<is><t[^>]*>\{\{NOTE_TEXT\}\}/);
    if (noteCellMatch) noteCellStyleIdx = parseInt(noteCellMatch[1]);
  }
  var wrapStyleIdx = await Docket._addWrapTextXf(zip, noteCellStyleIdx);

  // 4) sheet1.xml 조작 (범위 확장 + 마커 치환 + wrapText 스타일 적용)
  data._wrapStyleIdx = wrapStyleIdx;
  xml = Docket._processSheetXml(xml, data);
  zip.file(sheetPath, xml);

  // 5) 행 삽입으로 밀려난 drawing 앵커 좌표 보정
  //    푸터 이미지가 엉뚱한 위치에 표시되거나 세로로 늘어나는 것 방지
  if (drawingShifts.length > 0) {
    var drawingPath = 'xl/drawings/drawing1.xml';
    var drawingFile = zip.file(drawingPath);
    if (drawingFile) {
      var drawingXml = await drawingFile.async('string');
      drawingXml = Docket._shiftDrawingRows(drawingXml, drawingShifts);
      zip.file(drawingPath, drawingXml);
    }
  }

  // 6) zip을 ArrayBuffer로 재패킹 (DEFLATE 압축)
  return await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

// ArrayBuffer → Blob (다운로드용)
Docket.workbookToBlob = async function(bufOrPromise) {
  var buffer = bufOrPromise instanceof ArrayBuffer ? bufOrPromise : await bufOrPromise;
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// ArrayBuffer → base64 (이메일 첨부용)
Docket.workbookToBase64 = async function(bufOrPromise) {
  var buffer = bufOrPromise instanceof ArrayBuffer ? bufOrPromise : await bufOrPromise;
  var bytes = new Uint8Array(buffer);
  var bin = '';
  var chunkSize = 8192;
  for (var i = 0; i < bytes.byteLength; i += chunkSize) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(bin);
};

// ═══════════════════════════════════════════════════════════════
// 다운로드 / 발송 / 미리보기 / 초기화
// ═══════════════════════════════════════════════════════════════

// 견적서 엑셀만 다운로드
Docket.downloadExcel = async function() {
  try {
    var data = Docket.collectData();
    if (!data.feeItems || data.feeItems.length === 0) {
      App.showToast('수수료 항목을 1개 이상 선택해 주세요', 'error'); return;
    }
    var wb = await Docket.generateFromTemplate(data);
    var blob = await Docket.workbookToBlob(wb);
    var fileName = '[특허그룹 디딤] ' + data.subject + '.xlsx';
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
    App.showToast('견적서가 다운로드되었습니다', 'success');
  } catch (err) {
    console.error('downloadExcel error:', err);
    App.showToast('견적서 생성 실패: ' + err.message, 'error');
  }
};

// 사건등록 이메일 발송 (본문 HTML + 견적서 첨부)
Docket.sendEmail = async function() {
  var data = Docket.collectData();

  // 필수 필드 검증
  if (!data.clientCompany)              { App.showToast('회사명을 입력해 주세요', 'error'); return; }
  if (!data.recipient)                  { App.showToast('수신인 이메일을 입력해 주세요', 'error'); return; }
  if (!data.feeItems.length)            { App.showToast('수수료 항목을 1개 이상 선택해 주세요', 'error'); return; }
  if (!data.actualInput)                { App.showToast('실제 청구금액을 입력해 주세요', 'error'); return; }

  // 견적서 엑셀 생성
  var wbout, fileName;
  try {
    var wb = await Docket.generateFromTemplate(data);
    wbout = await Docket.workbookToBase64(wb);
    fileName = '[특허그룹 디딤] ' + data.subject + '.xlsx';
  } catch (err) {
    console.error('generateFromTemplate error:', err);
    App.showToast('견적서 생성 실패: ' + err.message, 'error');
    return;
  }

  var subject = Docket.buildEmailSubject(data);
  var html = Docket.generateEmailBodyHtml(data);

  var btn = document.getElementById('dkt-send-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="tossface">⏳</span> 발송 중...'; }

  try {
    // Edge Function URL + anon key는 Docket.config에 하드코딩됨
    var fnUrl = Docket.config.emailFunctionUrl;
    if (!fnUrl) throw new Error('Edge Function URL 미설정');

    // Supabase Edge Function은 Authorization + apikey 헤더 모두 anon key 필요.
    // window.SUPABASE_ANON_KEY가 있으면 우선 사용, 없으면 Docket.config 값 사용.
    var anonKey = (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || Docket.config.supabaseAnonKey;
    if (!anonKey) throw new Error('Supabase anon key 미설정');

    var res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + anonKey,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        to: data.recipient,
        subject: subject,
        html: html,
        attachments: [{ filename: fileName, content: wbout }],
      }),
    });
    var result = await res.json();
    if (res.ok && result.success) {
      App.showToast('✅ 사건등록이 ' + data.recipient + '으로 발송되었습니다', 'success');
      Docket.closePreview();
    } else {
      throw new Error(result.error || '발송 실패');
    }
  } catch (err) {
    console.error('Email error:', err);
    App.showToast('발송 실패: ' + err.message, 'error');
    if (confirm('자동 발송 실패.\nGmail 작성창으로 대체하시겠습니까?\n(견적서 파일은 별도 다운로드됩니다)')) {
      await Docket.downloadExcel();
      var body = Docket.generateEmailBodyText(data);
      var gmailUrl = 'https://mail.google.com/mail/?view=cm'
        + '&to=' + encodeURIComponent(data.recipient)
        + '&su=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);
      window.open(gmailUrl, '_blank');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="tossface">📧</span> 사건등록 발송'; }
  }
};

// 미리보기 모달 표시 (이메일 본문 + 견적서 요약)
Docket.preview = function() {
  var data = Docket.collectData();

  if (!data.clientCompany)   { App.showToast('회사명을 입력해 주세요', 'error'); return; }
  if (!data.feeItems.length) { App.showToast('수수료 항목을 1개 이상 선택해 주세요', 'error'); return; }
  if (!data.actualInput)     { App.showToast('실제 청구금액을 입력해 주세요', 'error'); return; }

  var subject = Docket.buildEmailSubject(data);
  var html = Docket.generateEmailBodyHtml(data);

  var box = '';
  box += '<div style="background:#f7f7f8;padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:12px;color:#555">';
  box += '<div><strong>수신:</strong> ' + data.recipient + '</div>';
  box += '<div><strong>제목:</strong> ' + subject + '</div>';
  box += '<div><strong>첨부:</strong> [특허그룹 디딤] ' + data.subject + '.xlsx</div>';
  box += '</div>';
  box += '<div style="border:1px solid #e5e5e7;border-radius:8px;padding:16px 20px;background:#fff">' + html + '</div>';

  var content = document.getElementById('docket-preview-content');
  if (content) content.innerHTML = box;
  var modal = document.getElementById('docketPreviewModal');
  if (modal) modal.style.display = 'flex';
};

Docket.closePreview = function() {
  var modal = document.getElementById('docketPreviewModal');
  if (modal) modal.style.display = 'none';
};

// 폼 초기화
Docket.resetForm = function() {
  if (!confirm('입력 내용을 모두 초기화하시겠습니까?')) return;
  var textIds = [
    'dkt-client-company','dkt-contact-name','dkt-contact-email','dkt-contact-phone','dkt-contact-cc',
    'dkt-inventor','dkt-worker','dkt-mandator','dkt-introducer',
    'dkt-case-content','dkt-draft-date','dkt-priority-reason-etc',
    'dkt-announcements','dkt-must-check','dkt-actual-fee',
  ];
  textIds.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });

  // 우선심사 사유 체크박스 초기화
  document.querySelectorAll('input[name="dkt-priority-reason"]').forEach(function(cb) { cb.checked = false; });

  var cntEl = document.getElementById('dkt-case-count'); if (cntEl) cntEl.value = '1';

  // 라디오 기본값 복원
  var r = function(name, val) { var el = document.querySelector('input[name="'+name+'"][value="'+val+'"]'); if (el) el.checked = true; };
  r('dkt-client-type', 'new');
  r('dkt-vat-included', 'no');
  r('dkt-gov-included', 'no');
  r('dkt-priority-exam', 'X');
  Docket.onPriorityExamChange();

  // 상세 조항 재주입
  var notesArea = document.getElementById('dkt-notes');
  if (notesArea) { delete notesArea.dataset.userEdited; notesArea.value = ''; }

  Docket.onRightChange();
  App.showToast('초기화되었습니다', 'info');
};
