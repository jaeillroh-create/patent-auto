// ═══════════════════════════════════════════════════════════════
// 사건등록 (Docket Registration) Module v2.0
// 견적서 엑셀 자동생성 + Supabase Edge Function 이메일 발송
// ═══════════════════════════════════════════════════════════════

var Docket = {};

Docket.config = {
  recipient: 'docket@didimip.com',
  emailFunctionUrl: '',
};

// ── 담당 변리사(DB) 프로필 ──
// 보내는 사람 선택 시 계좌번호·예금주·이름 자동 입력
Docket.attorneys = {
  '노재일': {
    name: '노재일',
    bankAccount: '기업은행 : 257-155360-01-013',
    bankHolder: '노재일(특허그룹디딤)',
  },
  // 변리사 추가 시 여기에 항목 추가
  // '홍길동': {
  //   name: '홍길동',
  //   bankAccount: '신한은행 : 110-xxx-xxxxxx',
  //   bankHolder: '홍길동(특허그룹디딤)',
  // },
};
Docket.defaultAttorney = '노재일';

// 현재 선택된 변리사 정보를 반환
Docket.getAttorney = function() {
  var sel = document.getElementById('dkt-attorney');
  var name = sel ? sel.value : Docket.defaultAttorney;
  return Docket.attorneys[name] || Docket.attorneys[Docket.defaultAttorney];
};

// 변리사 선택 시 자동 채움
Docket.onAttorneyChange = function() {
  var att = Docket.getAttorney();
  // 할인란 변리사명 동기화
  var discEl = document.getElementById('dkt-discount-attorney');
  if (discEl) discEl.value = att.name;
  // 계좌 정보 표시
  var bankEl = document.getElementById('dkt-bank-display');
  if (bankEl) bankEl.textContent = att.bankAccount + ' (예금주: ' + att.bankHolder + ')';
};

// ── 사건 유형별 수수료 템플릿 ──
Docket.caseTemplates = {
  'patent-priority': {
    label: '우선 특허출원 + 중간사건', subject: '우선 특허 출원 및 중간사건 {count}건에 대한 비용견적의 건',
    feeItems: [
      { name: '출원착수금', unitPrice: 1800000, qty: 1 },
      { name: '우선심사신청', unitPrice: 600000, qty: 1 },
      { name: '중간사건', unitPrice: 400000, qty: 1, note: '■ 의견제출통지서 대응' },
    ],
    govItems: [
      { name: '출원료', unitPrice: 109500, qty: 1, note: '■ 청구항 3항 및 심사청구 有, 70% 감면적용' },
      { name: '우선심사신청료', unitPrice: 200000, qty: 1 },
      { name: '보정료(중간사건)', unitPrice: 4000, qty: 1, note: '■ 의견제출통지서 대응에 따른 특허청 보정관납료' },
    ],
    notes: ['1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 대리인 수수료와 무관한 특허청에 납부하는 금액입니다.','2) 특허청 출원관납료에 포함된 심사청구료 및 가산료는 청구항의 수로 청구됩니다. 본 견적에는 3개항으로 견적하였으며, 특허출원서에 기재된 청구항수에 따라 가감청구 될 수 있음을 알려드립니다.','3) 중소기업기본법 제2조에 따라 중소기업, 벤처기업에 해당 할 경우, 관납료의 70% 감면 혜택을 받으실 수 있습니다. (증빙서류 제출 필수)','4) 본 특허의 등록 시에는 상기 출원착수금의 100%가 성공보수금으로 청구됩니다. (부가세, 특허청 등록관납료 별도)','5) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.','6) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1) 발급드릴 예정입니다.'],
  },
  'patent-priority-guarantee': {
    label: '우선 특허출원 등록보장', subject: '우선 특허출원 등록보장 {count}건에 대한 비용견적의 건',
    feeItems: [
      { name: '출원착수금', unitPrice: 1800000, qty: 1 },
      { name: '우선심사신청', unitPrice: 600000, qty: 1 },
      { name: 'IP창출 컨설팅', unitPrice: 1000000, qty: 1 },
      { name: '중간사건', unitPrice: 400000, qty: 1 },
      { name: '심사관 면담', unitPrice: 400000, qty: 1 },
      { name: '등록성사금', unitPrice: 1800000, qty: 1 },
    ],
    govItems: [
      { name: '출원료', unitPrice: 109500, qty: 1, note: '■ 청구항 3항 및 심사청구 有, 70% 감면적용' },
      { name: '우선심사신청료', unitPrice: 200000, qty: 1 },
      { name: '보정료(중간사건)', unitPrice: 4000, qty: 1, note: '■ 의견제출통지서 대응에 따른 특허청 보정관납료' },
      { name: '등록료', unitPrice: 44100, qty: 1, note: '■ 청구항 3항, 70% 감면적용' },
    ],
    notes: ['1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 대리인 수수료와 무관한 특허청에 납부하는 금액입니다.','2) 특허청 관납료는 청구항수에 따라 가감청구 될 수 있습니다.','3) 중소기업, 벤처기업 해당 시 관납료 70% 감면 혜택이 적용됩니다. (증빙서류 제출 필수)','4) 등록 시 출원착수금의 100%가 성공보수금(부가세 별도)으로 청구됩니다. 의견제출통지서 2회 이상 및 거절결정 대응 비용은 미포함입니다.','5) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.','6) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1) 발급드릴 예정입니다.'],
  },
  'patent-division-priority': {
    label: '분할출원 (우선)', subject: '국내 특허(분할) 출원 총 {count}건에 대한 비용견적의 건',
    feeItems: [
      { name: '특허 분할출원', unitPrice: 800000, qty: 1 },
      { name: '특허 분할등록', unitPrice: 800000, qty: 1 },
      { name: '특허 우선심사(실시)', unitPrice: 600000, qty: 1 },
    ],
    govItems: [
      { name: '특허 출원 관납료', unitPrice: 78900, qty: 1, note: '*중소기업 또는 개인 70% 감면적용 (청구항 5~10항 기준)' },
      { name: '특허 등록 관납료', unitPrice: 22500, qty: 1 },
      { name: '특허 우선심사 관납료', unitPrice: 200000, qty: 1 },
    ],
    notes: ['1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 대리인 수수료와 무관한 특허청에 납부하는 금액입니다.','2) 관납료는 청구항수에 따라 가감 될 수 있습니다.','3) 중소기업, 벤처기업 해당 시 관납료 70% 감면 혜택이 적용됩니다. (증빙서류 제출 필수)','4) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.'],
  },
  'patent-division-general': {
    label: '분할출원 (일반)', subject: '국내 특허(분할) 출원 총 {count}건에 대한 비용견적의 건',
    feeItems: [
      { name: '특허 분할출원', unitPrice: 800000, qty: 1 },
      { name: '특허 분할등록', unitPrice: 800000, qty: 1 },
    ],
    govItems: [
      { name: '특허 출원 관납료', unitPrice: 78900, qty: 1, note: '*중소기업 또는 개인 70% 감면적용 (청구항 5~10항 기준)' },
      { name: '특허 등록 관납료', unitPrice: 22500, qty: 1 },
      { name: '특허 우선심사 관납료', unitPrice: 200000, qty: 1 },
    ],
    notes: ['1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 별개입니다.','2) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.'],
  },
  'tm-general': {
    label: '일반 상표출원', subject: '일반 상표 출원 {count}건에 대한 비용견적의 건',
    feeItems: [{ name: '출원착수금', unitPrice: 300000, qty: 1 }],
    govItems: [{ name: '출원료', unitPrice: 52000, qty: 1, note: '■ 1상품류마다 10개의 지정상품' }],
    notes: ['1) 대리인 수수료는 상표출원에 대한 금액이며, 특허청 관납료는 별개입니다.','2) 등록 시 대리인수수료의 100%가 성공보수금(부가세 및 등록관납료 별도)으로 청구됩니다.','3) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.','4) 부가세 포함 대리인수수료에 대하여는 세금계산서 발급드릴 예정입니다. 입금시 사업자등록증 사본을 부탁드립니다.'],
  },
  'tm-priority': {
    label: '우선 상표출원 + 중간사건', subject: '우선 상표 출원 및 중간사건 {count}건에 대한 비용견적의 건',
    feeItems: [
      { name: '출원착수금', unitPrice: 300000, qty: 1 },
      { name: '우선심사신청', unitPrice: 300000, qty: 1 },
      { name: '중간사건', unitPrice: 500000, qty: 1, note: '■ 의견제출통지서 대응' },
    ],
    govItems: [
      { name: '출원료', unitPrice: 52000, qty: 1, note: '■ 1상품류마다 10개의 지정상품' },
      { name: '우선심사신청료', unitPrice: 160000, qty: 1 },
      { name: '보정료', unitPrice: 4000, qty: 1, note: '■ 의견제출통지서 대응 특허청관납료' },
    ],
    notes: ['1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 별개입니다.','2) 등록 시 출원착수금의 100%가 성공보수금으로 청구됩니다. 의견제출통지서 2회 이상 및 거절결정 대응시 별도 청구됩니다.','3) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.','4) 부가세 포함 대리인수수료에 대하여는 세금계산서 발급드릴 예정입니다.'],
  },
  'tm-priority-reg': {
    label: '우선 상표출원 + 중간 + 등록', subject: '우선 상표 출원 및 중간사건 {count}건에 대한 비용견적의 건',
    feeItems: [
      { name: '출원착수금', unitPrice: 300000, qty: 1 },
      { name: '우선심사신청', unitPrice: 300000, qty: 1 },
      { name: '중간사건', unitPrice: 500000, qty: 1, note: '■ 의견제출통지서 대응' },
      { name: '등록성사금', unitPrice: 300000, qty: 1 },
    ],
    govItems: [
      { name: '출원료', unitPrice: 52000, qty: 1, note: '■ 1상품류마다 10개의 지정상품' },
      { name: '우선심사신청료', unitPrice: 160000, qty: 1 },
      { name: '보정료', unitPrice: 4000, qty: 1, note: '■ 의견제출통지서 대응 특허청관납료' },
      { name: '등록료', unitPrice: 210120, qty: 1, note: '■ 1상품류마다 10개의 지정상품' },
    ],
    notes: ['1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 별개입니다.','2) 등록 시 출원착수금의 100%가 성공보수금으로 청구됩니다. 의견제출통지서 2회 이상 및 거절결정 대응시 별도 청구됩니다.','3) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.','4) 부가세 포함 대리인수수료에 대하여는 세금계산서 발급드릴 예정입니다.'],
  },
  'tm-oa': {
    label: '상표 중간사건 (의견서 대응)', subject: '상표 중간사건 의견서 대응 {count}건에 대한 비용견적의 건',
    feeItems: [{ name: '의견서 작성 및 제출', unitPrice: 600000, qty: 1 }],
    govItems: [{ name: '보정서', unitPrice: 4000, qty: 1 }],
    notes: ['1) 대리인 수수료는 의견제출통지서 대응 금액이며, 특허청 관납료는 별개입니다.','2) 등록 시 등록성사금, 부가세, 특허청 등록관납료가 발생됩니다.','3) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.'],
  },
  'tm-cancel-trial': {
    label: '취소심판', subject: '취소심판 {count}건에 대한 비용견적의 건',
    feeItems: [{ name: '심판착수금', unitPrice: 1000000, qty: 1 }],
    govItems: [{ name: '심판청구료', unitPrice: 240000, qty: 1 }],
    notes: ['1) 대리인 수수료는 심판 수임료이며, 특허청 관납료는 별개입니다.','2) 성공 시 대리인수수료의 100%가 성공보수금으로 청구됩니다.','3) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.','4) 부가세 포함 대리인수수료에 대하여는 세금계산서 발급드릴 예정입니다.'],
  },
  'patent-pct': {
    label: 'PCT 출원', subject: '가출원, 본출원 및 PCT출원에 대한 비용견적의 건',
    feeItems: [
      { name: '가출원 착수금', unitPrice: 300000, qty: 1 },
      { name: '본출원 착수금', unitPrice: 6000000, qty: 1 },
      { name: 'PCT출원 착수금', unitPrice: 1500000, qty: 1 },
    ],
    govItems: [
      { name: '출원료_가출원', unitPrice: 13800, qty: 1, note: '* 소기업 70% 감면적용' },
      { name: '출원료_본출원(우선)', unitPrice: 416600, qty: 1, note: '* 청구항 10항 기준' },
      { name: 'PCT_WIPO 관납료', unitPrice: 1802500, qty: 1, note: 'CHF 1,030.00 기준' },
      { name: 'PCT_국제조사료', unitPrice: 450000, qty: 1 },
      { name: 'PCT_송달료', unitPrice: 45000, qty: 1 },
      { name: 'PCT_송금수수료', unitPrice: 1500, qty: 1 },
    ],
    notes: ['1) 대리인 수수료는 특허출원에 대한 금액이며, 특허청 관납료는 별개입니다.','2) 본 견적서는 성공보수금이 포함된 금액입니다.','3) 상기 금액은 견적 내용이며, 문의 내용이 있으시면 연락 주시기 바랍니다.','4) 부가세 포함 대리인수수료에 대하여는 세금계산서 발급드릴 예정입니다.','5) PCT 출원서 30면 기준이며, 초과 1면당 CHF 15.00(약 26,500원)씩 가산됩니다. 환율에 따라 변동될 수 있습니다.'],
  },
};

Docket.init = function() {
  if (window.App && App.supabaseUrl) {
    Docket.config.emailFunctionUrl = App.supabaseUrl + '/functions/v1/send-docket-email';
  }
  var dateField = document.getElementById('dkt-date');
  if (dateField && !dateField.value) dateField.value = new Date().toISOString().split('T')[0];

  // 담당 변리사 드롭다운 채우기
  var attSel = document.getElementById('dkt-attorney');
  if (attSel && attSel.options.length <= 1) {
    attSel.innerHTML = '';
    Object.keys(Docket.attorneys).forEach(function(name) {
      var opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      if (name === Docket.defaultAttorney) opt.selected = true;
      attSel.appendChild(opt);
    });
  }
  Docket.onAttorneyChange();
  Docket.renderFeeTable();
};

Docket.renderFeeTable = function() {
  var tmplKey = document.getElementById('dkt-case-template').value;
  var tmpl = Docket.caseTemplates[tmplKey];
  if (!tmpl) return;
  var cnt = parseInt(document.getElementById('dkt-case-count').value) || 1;

  var feeBody = document.getElementById('dkt-fee-items');
  feeBody.innerHTML = '';
  tmpl.feeItems.forEach(function(item, i) {
    var q = item.qty * cnt;
    feeBody.innerHTML += '<tr><td><input type="text" class="input-field" value="'+item.name+'" data-field="name"/></td><td><input type="number" class="input-field" value="'+item.unitPrice+'" data-field="unitPrice" onchange="Docket.recalc()"/></td><td><input type="number" class="input-field" value="'+q+'" data-field="qty" min="1" onchange="Docket.recalc()"/></td><td class="fee-amount">'+Docket.fmt(item.unitPrice*q)+'</td><td><input type="text" class="input-field" value="'+(item.note||'')+'" data-field="note"/></td><td><button class="btn btn-ghost btn-sm" onclick="this.closest(\'tr\').remove();Docket.recalc()">✕</button></td></tr>';
  });

  var govBody = document.getElementById('dkt-gov-items');
  govBody.innerHTML = '';
  tmpl.govItems.forEach(function(item, i) {
    var q = item.qty * cnt;
    govBody.innerHTML += '<tr><td><input type="text" class="input-field" value="'+item.name+'" data-field="name"/></td><td><input type="number" class="input-field" value="'+item.unitPrice+'" data-field="unitPrice" onchange="Docket.recalc()"/></td><td><input type="number" class="input-field" value="'+q+'" data-field="qty" min="1" onchange="Docket.recalc()"/></td><td class="fee-amount">'+Docket.fmt(item.unitPrice*q)+'</td><td><input type="text" class="input-field" value="'+(item.note||'')+'" data-field="note"/></td><td><button class="btn btn-ghost btn-sm" onclick="this.closest(\'tr\').remove();Docket.recalc()">✕</button></td></tr>';
  });
  Docket.recalc();
};

Docket.addRow = function(tbodyId) {
  var tbody = document.getElementById(tbodyId);
  tbody.innerHTML += '<tr><td><input type="text" class="input-field" value="" data-field="name" placeholder="항목명"/></td><td><input type="number" class="input-field" value="0" data-field="unitPrice" onchange="Docket.recalc()"/></td><td><input type="number" class="input-field" value="1" data-field="qty" min="1" onchange="Docket.recalc()"/></td><td class="fee-amount">0</td><td><input type="text" class="input-field" value="" data-field="note"/></td><td><button class="btn btn-ghost btn-sm" onclick="this.closest(\'tr\').remove();Docket.recalc()">✕</button></td></tr>';
};

Docket.recalc = function() {
  var dAmt = parseInt(document.getElementById('dkt-discount-amount').value) || 0;
  var dQty = parseInt(document.getElementById('dkt-discount-qty').value) || 1;
  var totalDiscount = dAmt * dQty; // negative number

  var feeTotal = 0;
  document.querySelectorAll('#dkt-fee-items tr').forEach(function(tr) {
    var up = parseInt(tr.querySelector('[data-field="unitPrice"]').value) || 0;
    var qt = parseInt(tr.querySelector('[data-field="qty"]').value) || 1;
    tr.querySelector('.fee-amount').textContent = Docket.fmt(up * qt);
    feeTotal += up * qt;
  });

  var afterDiscount = feeTotal + totalDiscount;
  var vat = Math.round(afterDiscount * 0.1);
  var feeSub = afterDiscount + vat;

  var govTotal = 0;
  document.querySelectorAll('#dkt-gov-items tr').forEach(function(tr) {
    var up = parseInt(tr.querySelector('[data-field="unitPrice"]').value) || 0;
    var qt = parseInt(tr.querySelector('[data-field="qty"]').value) || 1;
    tr.querySelector('.fee-amount').textContent = Docket.fmt(up * qt);
    govTotal += up * qt;
  });

  var grand = feeSub + govTotal;
  document.getElementById('dkt-fee-subtotal').textContent = Docket.fmt(feeTotal);
  document.getElementById('dkt-discount-total').textContent = Docket.fmt(totalDiscount);
  document.getElementById('dkt-vat').textContent = Docket.fmt(vat);
  document.getElementById('dkt-fee-with-vat').textContent = Docket.fmt(feeSub);
  document.getElementById('dkt-gov-subtotal').textContent = Docket.fmt(govTotal);
  document.getElementById('dkt-grand-total').textContent = Docket.fmt(grand);
  document.getElementById('dkt-grand-total-korean').textContent = Docket.toKorean(grand) + ' 원정';
};

Docket.fmt = function(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

Docket.toKorean = function(num) {
  if (num === 0) return '영';
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

Docket.collectData = function() {
  var v = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var tmplKey = v('dkt-case-template');
  var tmpl = Docket.caseTemplates[tmplKey];
  var cnt = parseInt(v('dkt-case-count')) || 1;

  var feeItems = [], govItems = [];
  document.querySelectorAll('#dkt-fee-items tr').forEach(function(tr) {
    feeItems.push({ name: tr.querySelector('[data-field="name"]').value, unitPrice: parseInt(tr.querySelector('[data-field="unitPrice"]').value)||0, qty: parseInt(tr.querySelector('[data-field="qty"]').value)||1, note: tr.querySelector('[data-field="note"]').value });
  });
  document.querySelectorAll('#dkt-gov-items tr').forEach(function(tr) {
    govItems.push({ name: tr.querySelector('[data-field="name"]').value, unitPrice: parseInt(tr.querySelector('[data-field="unitPrice"]').value)||0, qty: parseInt(tr.querySelector('[data-field="qty"]').value)||1, note: tr.querySelector('[data-field="note"]').value });
  });

  var att = Docket.getAttorney();
  return {
    templateKey: tmplKey, template: tmpl,
    caseNumber: v('dkt-case-number'), date: v('dkt-date') || new Date().toISOString().split('T')[0],
    recipient: v('dkt-recipient'), clientName: v('dkt-client-name'), caseTitle: v('dkt-case-title'),
    subject: tmpl.subject.replace('{count}', cnt), caseCount: cnt,
    feeItems: feeItems, govItems: govItems,
    discountAmount: parseInt(v('dkt-discount-amount')) || 0,
    discountQty: parseInt(v('dkt-discount-qty')) || 1,
    discountAttorney: v('dkt-discount-attorney') || att.name,
    notes: tmpl.notes,
    attorney: att,
  };
};

// ═══ 엑셀 생성 (SheetJS) ═══
Docket.generateExcel = function(data) {
  if (typeof XLSX === 'undefined') { App.showToast('SheetJS 로딩 중...', 'error'); return null; }
  var wb = XLSX.utils.book_new();
  var ws = {}, merges = [], r = 0;
  var set = function(row, col, val) { ws[XLSX.utils.encode_cell({r:row,c:col})] = { v: val, t: typeof val === 'number' ? 'n' : 's' }; };
  var merge = function(r1,c1,r2,c2) { merges.push({s:{r:r1,c:c1},e:{r:r2,c:c2}}); };

  // 금액 계산
  var feeTotal = 0; data.feeItems.forEach(function(i){feeTotal+=i.unitPrice*i.qty;});
  var disc = data.discountAmount * data.discountQty;
  var afterDisc = feeTotal + disc;
  var vat = Math.round(afterDisc * 0.1);
  var feeSub = afterDisc + vat;
  var govTotal = 0; data.govItems.forEach(function(i){govTotal+=i.unitPrice*i.qty;});
  var grand = feeSub + govTotal;

  // 헤더
  set(1,8,'견  적  서'); merge(1,8,3,9);
  merge(4,0,4,9);
  set(6,8,'당소번호:'); set(6,9,data.caseNumber||'');
  set(7,8,'날     짜:'); set(7,9,data.date);

  set(10,1,'수      신 :'); set(10,2,data.clientName); merge(10,2,10,3);
  set(11,1,'제      목 :'); set(11,2,data.subject); merge(11,2,11,9);
  set(12,1,'명      칭 :'); set(12,2,data.caseTitle||''); merge(12,2,12,9);
  set(15,1,'   표제의 건에 대한 비용을 다음과 같이 견적하오니 참고하여 주시기 바랍니다.'); merge(15,1,15,9);
  set(17,2,'       -   다      음  -'); merge(17,2,17,6);

  // 견적금액
  set(19,1,'1. 견적금액 : '); set(19,2,Docket.toKorean(grand)); merge(19,2,19,3);
  set(19,4,'원정'); set(19,5,'('); set(19,6,grand); merge(19,6,19,8); set(19,9,')');
  set(21,1,'2. 내역');

  // 테이블 헤더
  r = 23;
  set(r,1,'항    목'); merge(r,1,r,2); set(r,3,'단가'); set(r,4,'수량'); merge(r,4,r,5);
  set(r,6,'금       액'); merge(r,6,r,8); set(r,9,'비  고');

  // 대리인수수료
  r = 24; var feeStart = r;
  data.feeItems.forEach(function(item,i) {
    if (i===0) set(r,1,'대리인수수료');
    set(r,2,item.name); set(r,3,item.unitPrice); set(r,4,item.qty); merge(r,4,r,5);
    set(r,6,item.unitPrice*item.qty); merge(r,6,r,8);
    if (item.note) set(r,9,item.note);
    r++;
  });

  // 할인
  if (disc !== 0) {
    set(r,3,data.discountAmount); set(r,4,data.discountQty); merge(r,4,r,5);
    set(r,6,disc); merge(r,6,r,8);
    set(r,9,data.discountAttorney+' 변리사 담당 우대');
    r++;
  }
  if (r - feeStart > 1) merge(feeStart,1,r-1,1);

  // 부가세 + 소계
  set(r,1,'부가가치세'); merge(r,1,r,2); set(r,4,1); merge(r,4,r,5); set(r,6,vat); merge(r,6,r,8); r++;
  set(r,1,'소           계'); merge(r,1,r,5); set(r,6,feeSub); merge(r,6,r,8); r++;

  // 관납료
  var govStart = r;
  data.govItems.forEach(function(item,i) {
    if (i===0) set(r,1,'특허청관납료');
    set(r,2,item.name); set(r,3,item.unitPrice); set(r,4,item.qty); merge(r,4,r,5);
    set(r,6,item.unitPrice*item.qty); merge(r,6,r,8);
    if (item.note) set(r,9,item.note);
    r++;
  });
  if (r - govStart > 1) merge(govStart,1,r-1,1);

  set(r,1,'소           계'); merge(r,1,r,5); set(r,6,govTotal); merge(r,6,r,8); r++;
  set(r,1,' 총           계'); merge(r,1,r,5); set(r,6,grand); merge(r,6,r,8); r+=2;
  set(r,1,'견  적  금  액'); merge(r,1,r,5); set(r,6,grand); merge(r,6,r,8); r+=2;

  // 상세
  set(r,1,'3. 상세'); r++;
  data.notes.forEach(function(n){ set(r,1,n); merge(r,1,r,9); r++; }); r++;
  set(r,1,'4. 결제계좌 (예금주: '+data.attorney.bankHolder+')'); r++;
  set(r,1,'     '+data.attorney.bankAccount);

  ws['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:r,c:11}});
  ws['!merges'] = merges;
  ws['!cols'] = [{wch:3},{wch:8},{wch:18},{wch:12},{wch:5},{wch:5},{wch:14},{wch:3},{wch:3},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, data.caseNumber || 'Sheet1');
  return wb;
};

Docket.downloadExcel = function() {
  var data = Docket.collectData();
  var wb = Docket.generateExcel(data);
  if (!wb) return;
  XLSX.writeFile(wb, '[특허그룹 디딤] ' + data.subject + '.xlsx');
  App.showToast('견적서가 다운로드되었습니다', 'success');
};

// ═══ 이메일 발송 ═══
Docket.sendEmail = async function() {
  var data = Docket.collectData();
  if (!data.clientName) { App.showToast('수신(고객사명)을 입력해 주세요', 'error'); return; }
  if (!data.recipient) { App.showToast('수신인 이메일을 입력해 주세요', 'error'); return; }

  var wb = Docket.generateExcel(data);
  if (!wb) return;
  var wbout = XLSX.write(wb, { bookType:'xlsx', type:'base64' });
  var fileName = '[특허그룹 디딤] ' + data.subject + '.xlsx';

  var feeTotal=0; data.feeItems.forEach(function(i){feeTotal+=i.unitPrice*i.qty;});
  var disc = data.discountAmount*data.discountQty;
  var afterDisc=feeTotal+disc, vat=Math.round(afterDisc*0.1), feeSub=afterDisc+vat;
  var govTotal=0; data.govItems.forEach(function(i){govTotal+=i.unitPrice*i.qty;});
  var grand=feeSub+govTotal;

  var senderName = data.attorney.name;
  var html = '<div style="font-family:Malgun Gothic,sans-serif;font-size:14px;line-height:1.8">';
  html += '<p>안녕하세요, '+senderName+' 변리사입니다.</p>';
  html += '<p>'+data.subject+'에 대한 견적서를 첨부드립니다.</p><br/>';
  html += '<table style="border-collapse:collapse;font-size:13px">';
  html += '<tr><td style="padding:4px 12px;font-weight:bold">수신</td><td>'+data.clientName+'</td></tr>';
  html += '<tr><td style="padding:4px 12px;font-weight:bold">명칭</td><td>'+(data.caseTitle||'-')+'</td></tr>';
  html += '<tr><td style="padding:4px 12px;font-weight:bold">견적금액</td><td style="font-weight:bold;color:#3182F6">'+Docket.fmt(grand)+'원</td></tr>';
  if (disc!==0) html += '<tr><td style="padding:4px 12px;font-weight:bold">할인</td><td style="color:#FF3B30">'+data.discountAttorney+' 변리사 담당 우대 ('+Docket.fmt(disc)+'원)</td></tr>';
  html += '</table><br/>';
  html += '<p>상세 내역은 첨부된 견적서를 확인해 주시기 바랍니다.</p>';
  html += '<p>감사합니다.<br/>'+senderName+' 드림</p></div>';

  var btn = document.getElementById('dkt-send-btn');
  btn.disabled = true; btn.innerHTML = '<span class="tossface">⏳</span> 발송 중...';

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
      body: JSON.stringify({ to: data.recipient, subject: '[특허그룹 디딤] '+data.subject, html: html, attachments: [{ filename: fileName, content: wbout }] }),
    });
    var result = await res.json();
    if (res.ok && result.success) {
      App.showToast('✅ 견적서가 '+data.recipient+'으로 발송되었습니다', 'success');
      Docket.closePreview();
    } else throw new Error(result.error || '발송 실패');
  } catch (err) {
    console.error('Email error:', err);
    App.showToast('발송 실패: '+err.message, 'error');
    if (confirm('자동 발송 실패.\nGmail 작성창으로 대체하시겠습니까?\n(견적서 파일은 별도 다운로드됩니다)')) {
      Docket.downloadExcel();
      var url = 'https://mail.google.com/mail/?view=cm&to='+encodeURIComponent(data.recipient)+'&su='+encodeURIComponent('[특허그룹 디딤] '+data.subject)+'&body='+encodeURIComponent('안녕하세요, '+senderName+' 변리사입니다.\n\n견적서를 첨부드립니다.\n\n감사합니다.\n'+senderName+' 드림');
      window.open(url, '_blank');
    }
  } finally {
    btn.disabled = false; btn.innerHTML = '<span class="tossface">📧</span> 견적서 발송';
  }
};

// ═══ 미리보기 ═══
Docket.preview = function() {
  var data = Docket.collectData();
  var feeTotal=0; data.feeItems.forEach(function(i){feeTotal+=i.unitPrice*i.qty;});
  var disc=data.discountAmount*data.discountQty;
  var afterDisc=feeTotal+disc, vat=Math.round(afterDisc*0.1), feeSub=afterDisc+vat;
  var govTotal=0; data.govItems.forEach(function(i){govTotal+=i.unitPrice*i.qty;});
  var grand=feeSub+govTotal;

  var h = '<div class="dkt-pv-header"><div class="dkt-pv-title">견 적 서</div>';
  h += '<div class="dkt-pv-meta">당소번호: '+(data.caseNumber||'-')+' | 날짜: '+data.date+'</div></div>';
  h += '<div class="dkt-pv-info"><div>수신: <strong>'+data.clientName+'</strong></div>';
  h += '<div>제목: '+data.subject+'</div>';
  h += '<div>명칭: '+(data.caseTitle||'-')+'</div></div>';
  h += '<div class="dkt-pv-amount">견적금액: <strong>'+Docket.toKorean(grand)+'</strong> 원정 (<strong>'+Docket.fmt(grand)+'</strong>원)</div>';

  h += '<table class="dkt-pv-table"><thead><tr><th>항목</th><th>단가</th><th>수량</th><th>금액</th><th>비고</th></tr></thead><tbody>';
  data.feeItems.forEach(function(item,i) {
    h += '<tr><td>'+(i===0?'대리인수수료 — ':'')+item.name+'</td><td class="n">'+Docket.fmt(item.unitPrice)+'</td><td class="n">'+item.qty+'</td><td class="n">'+Docket.fmt(item.unitPrice*item.qty)+'</td><td>'+(item.note||'')+'</td></tr>';
  });
  if (disc!==0) h += '<tr class="dr"><td>'+data.discountAttorney+' 변리사 담당 우대</td><td class="n">'+Docket.fmt(data.discountAmount)+'</td><td class="n">'+data.discountQty+'</td><td class="n">'+Docket.fmt(disc)+'</td><td></td></tr>';
  h += '<tr class="st"><td colspan="3">부가가치세</td><td class="n">'+Docket.fmt(vat)+'</td><td></td></tr>';
  h += '<tr class="st"><td colspan="3"><strong>소계</strong></td><td class="n"><strong>'+Docket.fmt(feeSub)+'</strong></td><td></td></tr>';
  data.govItems.forEach(function(item,i) {
    h += '<tr><td>'+(i===0?'특허청관납료 — ':'')+item.name+'</td><td class="n">'+Docket.fmt(item.unitPrice)+'</td><td class="n">'+item.qty+'</td><td class="n">'+Docket.fmt(item.unitPrice*item.qty)+'</td><td>'+(item.note||'')+'</td></tr>';
  });
  h += '<tr class="st"><td colspan="3"><strong>관납료 소계</strong></td><td class="n"><strong>'+Docket.fmt(govTotal)+'</strong></td><td></td></tr>';
  h += '<tr class="tt"><td colspan="3"><strong>총계</strong></td><td class="n"><strong>'+Docket.fmt(grand)+'</strong></td><td></td></tr>';
  h += '</tbody></table>';
  h += '<div class="dkt-pv-recv">📧 수신: '+data.recipient+'</div>';

  document.getElementById('docket-preview-content').innerHTML = h;
  document.getElementById('docketPreviewModal').style.display = 'flex';
};

Docket.closePreview = function() { document.getElementById('docketPreviewModal').style.display = 'none'; };

Docket.resetForm = function() {
  if (!confirm('입력 내용을 모두 초기화하시겠습니까?')) return;
  ['dkt-client-name','dkt-case-title','dkt-case-number'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('dkt-discount-amount').value = '0';
  document.getElementById('dkt-discount-qty').value = '1';
  document.getElementById('dkt-case-count').value = '1';
  Docket.renderFeeTable();
  App.showToast('초기화되었습니다', 'info');
};
