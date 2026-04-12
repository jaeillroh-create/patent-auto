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
  if (window.App && App.supabaseUrl) {
    Docket.config.emailFunctionUrl = App.supabaseUrl + '/functions/v1/send-docket-email';
  }

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
  // 상표 상품명 유형 토글 표시/숨김
  var right = document.getElementById('dkt-right').value;
  var tmToggle = document.getElementById('dkt-trademark-term-wrap');
  if (tmToggle) tmToggle.style.display = (right === '상표') ? '' : 'none';
  Docket.recalc();
};

// DB 변경 (특별한 폼 업데이트 없음 — 템플릿/할인은 엑셀 생성 시점에 적용)
Docket.onDBChange = function() {
  // noop: DB별 고정값은 collectData/generateFromTemplate에서 자동 적용
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

// 특정 수수료 항목에 대한 실제 연동 관납료 반환 (상표 출원착수금은 term type에 따라 variant 교체)
Docket._resolveLinkedGov = function(right, item) {
  var linkedGov = item.linkedGov || [];
  if (right === '상표' && item.key === 'application') {
    var termType = Docket.getTrademarkTermType();
    if (termType === 'gazetted') {
      return [{ name: '출원료(고시명칭)', unitPrice: 46000 }];
    }
    return [{ name: '출원료(비고시명칭)', unitPrice: 52000 }];
  }
  return linkedGov;
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

    // 견적서 raw (체크된 항목만)
    feeItems: feeItems,
    govItems: govItems,

    // 기타
    announcements: v('dkt-announcements'),
    caseContent: v('dkt-case-content'),
    priorityExam: v('dkt-priority-exam'),
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
// 견적서 엑셀 생성 (ExcelJS + 템플릿 마커 교체)
// ═══════════════════════════════════════════════════════════════
// templates/quote-template-{DB}.xlsx 를 로드하여 마커 치환.
// 템플릿의 로고/테두리/이미지/서식을 100% 보존.
// FEE/GOV/NOTES 범위는 bottom-up 순서로 duplicateRow 확장.

// xlsx 내부의 drawings/media 파일을 제거하여 ExcelJS 이미지 파싱 버그를 우회
// 입력: ArrayBuffer (xlsx 원본) → 출력: ArrayBuffer (drawings 제거됨)
Docket._stripDrawings = async function(arrayBuffer) {
  var zip = await JSZip.loadAsync(arrayBuffer);

  // 1) drawings/media 파일 전체 삭제
  var toRemove = [];
  zip.forEach(function(path, file) {
    if (path.indexOf('xl/drawings/') === 0 || path.indexOf('xl/media/') === 0) {
      toRemove.push(path);
    }
  });
  toRemove.forEach(function(p) { zip.remove(p); });

  // 2) 각 sheet XML에서 <drawing .../>, <legacyDrawing .../>, <oleObjects> 요소 제거
  //    주의: 속성값에 URL이 포함(예: xmlns:r="http://...")되므로 `/`가 아닌 `>`를 경계로 사용
  var sheetFiles = Object.keys(zip.files).filter(function(p) {
    return /^xl\/worksheets\/sheet\d+\.xml$/.test(p);
  });
  for (var i = 0; i < sheetFiles.length; i++) {
    var sp = sheetFiles[i];
    var xml = await zip.file(sp).async('string');
    xml = xml.replace(/<drawing\s[^>]*\/>/g, '');
    xml = xml.replace(/<legacyDrawing\s[^>]*\/>/g, '');
    xml = xml.replace(/<picture\s[^>]*\/>/g, '');
    xml = xml.replace(/<oleObjects>[\s\S]*?<\/oleObjects>/g, '');
    zip.file(sp, xml);
  }

  // 3) sheet rels 파일에서 drawing 관계 제거
  var relsFiles = Object.keys(zip.files).filter(function(p) {
    return /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(p);
  });
  for (var j = 0; j < relsFiles.length; j++) {
    var rp = relsFiles[j];
    var rxml = await zip.file(rp).async('string');
    // Type에 drawing 또는 vmlDrawing이 포함된 Relationship 엘리먼트 제거
    rxml = rxml.replace(/<Relationship[^>]*Type="[^"]*(?:drawing|vmlDrawing|oleObject|image)[^"]*"[^>]*\/>/g, '');
    zip.file(rp, rxml);
  }

  // 4) [Content_Types].xml에서 drawing Override 제거
  var ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    var ct = await ctFile.async('string');
    ct = ct.replace(/<Override[^>]*PartName="[^"]*drawings?[^"]*"[^>]*\/>/g, '');
    ct = ct.replace(/<Override[^>]*PartName="[^"]*media[^"]*"[^>]*\/>/g, '');
    zip.file('[Content_Types].xml', ct);
  }

  return await zip.generateAsync({ type: 'arraybuffer' });
};

Docket.generateFromTemplate = async function(data) {
  if (typeof ExcelJS === 'undefined') {
    throw new Error('ExcelJS 라이브러리가 로드되지 않았습니다');
  }
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip 라이브러리가 로드되지 않았습니다');
  }

  var cfg = data.dbConfig || Docket.dbConfig[Docket.defaultDB];
  var templatePath = cfg.template.replace(/([^\/]+)$/, function(m) {
    return encodeURIComponent(m);
  });

  // 1) 템플릿 로드
  var res = await fetch(templatePath);
  if (!res.ok) throw new Error('템플릿 로드 실패: ' + templatePath + ' (HTTP ' + res.status + ')');
  var buf = await res.arrayBuffer();

  // 1-1) ExcelJS가 템플릿 내부의 이미지(drawings)를 파싱하다가
  //      "Cannot read properties of undefined (reading 'anchors')" 에러를 발생시키는
  //      알려진 버그를 우회하기 위해, 로드 전 JSZip으로 drawings/media를 제거한다.
  //      트레이드오프: 로고/이미지는 출력에서 사라지지만 테두리·셀 서식·폰트는 보존됨.
  try {
    buf = await Docket._stripDrawings(buf);
  } catch (e) {
    console.warn('drawings 스트리핑 실패, 원본으로 진행합니다:', e);
  }

  var wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  var ws = wb.worksheets[0];

  // 2) 금액 — collectData에서 _computeFees로 이미 계산된 값 사용 (UI/엑셀 일치 보장)
  var feeTotal = 0; data.feeItems.forEach(function(i){feeTotal+=i.unitPrice*i.qty;});
  var disc = (data.discountAmount || 0) * (data.discountQty || 1);
  var afterDisc = data.actualFee;  // = feeTotal + disc
  var vat = data.vat;
  var feeSub = data.feeSub;         // = afterDisc + vat
  var govTotal = data.govTotal;
  var grand = data.grand;

  // 3) 마커 스캔
  var markers = {};
  ws.eachRow({includeEmpty: true}, function(row, rowNum) {
    row.eachCell({includeEmpty: false}, function(cell, colNum) {
      var val = cell.value;
      if (val && typeof val === 'object' && val.richText) {
        val = val.richText.map(function(r){return r.text;}).join('');
      }
      if (typeof val === 'string') {
        var re = /\{\{([A-Z_]+)\}\}/g, m;
        while ((m = re.exec(val)) !== null) {
          if (!markers[m[1]]) markers[m[1]] = [];
          markers[m[1]].push({ row: rowNum, col: colNum });
        }
      }
    });
  });

  // 4) 단순 마커 치환
  // FEE_SUBTOTAL = afterDisc (할인 후 순수수료, pre-VAT)
  //   템플릿 레이아웃: [items] → [discount row] → [FEE_SUBTOTAL] → [VAT] → [FEE_WITH_VAT]
  //   이 순서에서 FEE_SUBTOTAL은 할인 행 이후의 소계이므로 afterDisc가 옳음.
  //   VAT는 FEE_SUBTOTAL의 10% (afterDisc × 0.1), 관납료에는 적용하지 않음.
  //   FEE_WITH_VAT = FEE_SUBTOTAL + VAT = afterDisc + VAT
  var simple = {
    CASE_NUMBER: data.caseNumber || '',
    DATE: data.date || '',
    CLIENT_NAME: data.clientName || '',
    SUBJECT: data.subject || '',
    CASE_TITLE: data.caseTitle || '',
    TOTAL_KOREAN: Docket.toKorean(grand) + ' 원정',
    TOTAL_AMOUNT: grand,
    FEE_SUBTOTAL: afterDisc,
    VAT: vat,
    FEE_WITH_VAT: feeSub,
    GOV_SUBTOTAL: govTotal,
    GRAND_TOTAL: grand,
  };
  Object.keys(simple).forEach(function(key) {
    (markers[key] || []).forEach(function(pos) {
      ws.getCell(pos.row, pos.col).value = simple[key];
    });
  });

  // 5) 범위 마커 처리 — bottom-up (NOTES → GOV → FEE)

  // ── NOTES 영역
  if (markers.NOTES_START && markers.NOTE_TEXT) {
    var noteRow = markers.NOTE_TEXT[0].row;
    var noteCol = markers.NOTE_TEXT[0].col;
    var notes = data.notes || [];
    var nInsert = Math.max(0, notes.length - 1);
    if (nInsert > 0) {
      try { ws.duplicateRow(noteRow, nInsert, true); } catch (e) { console.warn('NOTES duplicateRow 실패:', e); }
    }
    var nsCol = (markers.NOTES_START && markers.NOTES_START[0]) ? markers.NOTES_START[0].col : null;
    for (var i = 0; i < notes.length; i++) {
      var row = ws.getRow(noteRow + i);
      if (nsCol) row.getCell(nsCol).value = null;
      row.getCell(noteCol).value = notes[i];
    }
    if (markers.NOTES_END && markers.NOTES_END[0]) {
      var endRowNum = markers.NOTES_END[0].row + nInsert;
      ws.getCell(endRowNum, markers.NOTES_END[0].col).value = null;
    }
  }

  // ── GOV 영역
  if (markers.GOV_START && markers.GOV_ITEM_NAME) {
    var govRow = markers.GOV_START[0].row;
    var govItems = data.govItems || [];
    var nInsertG = Math.max(0, govItems.length - 1);
    if (nInsertG > 0) {
      try { ws.duplicateRow(govRow, nInsertG, true); } catch (e) { console.warn('GOV duplicateRow 실패:', e); }
    }
    for (var i2 = 0; i2 < govItems.length; i2++) {
      var gitem = govItems[i2];
      var grow = ws.getRow(govRow + i2);
      grow.getCell(markers.GOV_START[0].col).value = null;
      grow.getCell(markers.GOV_ITEM_NAME[0].col).value = gitem.name;
      grow.getCell(4).value = gitem.unitPrice;
      grow.getCell(5).value = gitem.qty;
      grow.getCell(7).value = gitem.unitPrice * gitem.qty;
      if (gitem.note) grow.getCell(10).value = gitem.note;
    }
    if (markers.GOV_END && markers.GOV_END[0]) {
      var govEndRow = markers.GOV_END[0].row + nInsertG;
      ws.getCell(govEndRow, markers.GOV_END[0].col).value = null;
    }
  }

  // ── FEE 영역
  if (markers.FEE_START && markers.FEE_ITEM_NAME) {
    var feeRow = markers.FEE_START[0].row;
    var feeItems = data.feeItems || [];
    var nInsertF = Math.max(0, feeItems.length - 1);
    if (nInsertF > 0) {
      try { ws.duplicateRow(feeRow, nInsertF, true); } catch (e) { console.warn('FEE duplicateRow 실패:', e); }
    }
    for (var i3 = 0; i3 < feeItems.length; i3++) {
      var fitem = feeItems[i3];
      var frow = ws.getRow(feeRow + i3);
      frow.getCell(markers.FEE_START[0].col).value = null;
      frow.getCell(markers.FEE_ITEM_NAME[0].col).value = fitem.name;
      frow.getCell(4).value = fitem.unitPrice;
      frow.getCell(5).value = fitem.qty;
      frow.getCell(7).value = fitem.unitPrice * fitem.qty;
      if (fitem.note) frow.getCell(10).value = fitem.note;
    }
    // 할인 행 (FEE_END)
    if (markers.FEE_END && markers.FEE_END[0]) {
      var discRowNum = markers.FEE_END[0].row + nInsertF;
      var discRow = ws.getRow(discRowNum);
      discRow.getCell(markers.FEE_END[0].col).value = null;
      discRow.getCell(4).value = data.discountAmount;
      discRow.getCell(5).value = data.discountQty;
      discRow.getCell(7).value = disc;
    }
  }

  // 6) 최종 cleanup: 병합 셀에서 duplicateRow가 마커 값을 복제하는 버그를 우회.
  //    셀 값이 순수 {{MARKER}} 패턴이면 null로 치환.
  ws.eachRow({includeEmpty: false}, function(row) {
    row.eachCell({includeEmpty: false}, function(cell) {
      var v = cell.value;
      if (typeof v === 'object' && v && v.richText) {
        v = v.richText.map(function(r){return r.text;}).join('');
      }
      if (typeof v === 'string' && /^\s*\{\{[A-Z_]+\}\}\s*$/.test(v)) {
        cell.value = null;
      }
    });
  });

  return wb;
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

// workbook → Blob
Docket.workbookToBlob = async function(wb) {
  var buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// workbook → base64 (이메일 첨부용)
Docket.workbookToBase64 = async function(wb) {
  var buffer = await wb.xlsx.writeBuffer();
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
    var fnUrl = Docket.config.emailFunctionUrl;
    if (!fnUrl && window.App && App.supabase) {
      fnUrl = App.supabase.supabaseUrl + '/functions/v1/send-docket-email';
    }
    if (!fnUrl) throw new Error('Edge Function URL 미설정');

    var token = '';
    if (window.App && App.supabase) {
      var sess = await App.supabase.auth.getSession();
      if (sess.data && sess.data.session) token = sess.data.session.access_token;
    }

    var res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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
    'dkt-case-content','dkt-priority-exam','dkt-draft-date',
    'dkt-announcements','dkt-must-check','dkt-actual-fee',
  ];
  textIds.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });

  var cntEl = document.getElementById('dkt-case-count'); if (cntEl) cntEl.value = '1';

  // 라디오 기본값 복원
  var r = function(name, val) { var el = document.querySelector('input[name="'+name+'"][value="'+val+'"]'); if (el) el.checked = true; };
  r('dkt-client-type', 'new');
  r('dkt-vat-included', 'no');
  r('dkt-gov-included', 'no');

  // 상세 조항 재주입
  var notesArea = document.getElementById('dkt-notes');
  if (notesArea) { delete notesArea.dataset.userEdited; notesArea.value = ''; }

  Docket.onRightChange();
  App.showToast('초기화되었습니다', 'info');
};
