// ═══════════════════════════════════════════════════════════════
// 사건등록 (Docket Registration) Module v2.0
// 견적서 엑셀 자동생성 + Supabase Edge Function 이메일 발송
// ═══════════════════════════════════════════════════════════════

var Docket = {};

Docket.config = {
  recipient: 'docket@didimip.com',
  emailFunctionUrl: '',
};

// ── DB(담당 변리사) 목록 ──
// 각 DB에 대응하는 템플릿 파일이 templates/ 폴더에 존재해야 함
// 계좌/예금주/할인 비고는 템플릿 xlsx 내에 고정값으로 기재됨
Docket.dbList = ['노재일', '이용환'];
Docket.defaultDB = '노재일';
Docket.getTemplatePath = function(dbName) {
  return 'templates/quote-template-' + encodeURIComponent(dbName) + '.xlsx';
};

// ── 상세 조항 표준 텍스트 (특허/상표) ──
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

// 현재 선택된 DB 반환
Docket.getDB = function() {
  var sel = document.getElementById('dkt-db');
  return sel ? sel.value : Docket.defaultDB;
};

// DB 변경 시 할인란 변리사명 동기화
Docket.onDBChange = function() {
  var db = Docket.getDB();
  var discEl = document.getElementById('dkt-discount-attorney');
  if (discEl) discEl.value = db;
};

// 상세 조항 기본값 복원
Docket.resetNotes = function() {
  var area = document.getElementById('dkt-notes');
  if (!area) return;
  var tmplKey = document.getElementById('dkt-case-template').value;
  var tmpl = Docket.caseTemplates[tmplKey];
  var category = (tmpl && tmpl.notesCategory) || 'patent';
  area.value = Docket.defaultNotes[category].join('\n');
  delete area.dataset.userEdited;
};

// ── 사건 유형별 수수료 템플릿 ──
Docket.caseTemplates = {
  'patent-priority': {
    label: '우선 특허출원 + 중간사건', subject: '우선 특허 출원 및 중간사건 {count}건에 대한 비용견적의 건',
    notesCategory: 'patent',
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
  },
  'patent-priority-guarantee': {
    label: '우선 특허출원 등록보장', subject: '우선 특허출원 등록보장 {count}건에 대한 비용견적의 건',
    notesCategory: 'patent',
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
  },
  'patent-division-priority': {
    label: '분할출원 (우선)', subject: '국내 특허(분할) 출원 총 {count}건에 대한 비용견적의 건',
    notesCategory: 'patent',
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
  },
  'patent-division-general': {
    label: '분할출원 (일반)', subject: '국내 특허(분할) 출원 총 {count}건에 대한 비용견적의 건',
    notesCategory: 'patent',
    feeItems: [
      { name: '특허 분할출원', unitPrice: 800000, qty: 1 },
      { name: '특허 분할등록', unitPrice: 800000, qty: 1 },
    ],
    govItems: [
      { name: '특허 출원 관납료', unitPrice: 78900, qty: 1, note: '*중소기업 또는 개인 70% 감면적용 (청구항 5~10항 기준)' },
      { name: '특허 등록 관납료', unitPrice: 22500, qty: 1 },
      { name: '특허 우선심사 관납료', unitPrice: 200000, qty: 1 },
    ],
  },
  'tm-general': {
    label: '일반 상표출원', subject: '일반 상표 출원 {count}건에 대한 비용견적의 건',
    notesCategory: 'trademark',
    feeItems: [{ name: '출원착수금', unitPrice: 300000, qty: 1 }],
    govItems: [{ name: '출원료', unitPrice: 52000, qty: 1, note: '■ 1상품류마다 10개의 지정상품' }],
  },
  'tm-priority': {
    label: '우선 상표출원 + 중간사건', subject: '우선 상표 출원 및 중간사건 {count}건에 대한 비용견적의 건',
    notesCategory: 'trademark',
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
  },
  'tm-priority-reg': {
    label: '우선 상표출원 + 중간 + 등록', subject: '우선 상표 출원 및 중간사건 {count}건에 대한 비용견적의 건',
    notesCategory: 'trademark',
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
  },
  'tm-oa': {
    label: '상표 중간사건 (의견서 대응)', subject: '상표 중간사건 의견서 대응 {count}건에 대한 비용견적의 건',
    notesCategory: 'trademark',
    feeItems: [{ name: '의견서 작성 및 제출', unitPrice: 600000, qty: 1 }],
    govItems: [{ name: '보정서', unitPrice: 4000, qty: 1 }],
  },
  'tm-cancel-trial': {
    label: '취소심판', subject: '취소심판 {count}건에 대한 비용견적의 건',
    notesCategory: 'trademark',
    feeItems: [{ name: '심판착수금', unitPrice: 1000000, qty: 1 }],
    govItems: [{ name: '심판청구료', unitPrice: 240000, qty: 1 }],
  },
  'patent-pct': {
    label: 'PCT 출원', subject: '가출원, 본출원 및 PCT출원에 대한 비용견적의 건',
    notesCategory: 'patent',
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
  },
};

Docket.init = function() {
  if (window.App && App.supabaseUrl) {
    Docket.config.emailFunctionUrl = App.supabaseUrl + '/functions/v1/send-docket-email';
  }
  var dateField = document.getElementById('dkt-date');
  if (dateField && !dateField.value) dateField.value = new Date().toISOString().split('T')[0];

  // DB 선택 기본값 적용
  var dbSel = document.getElementById('dkt-db');
  if (dbSel && !dbSel.value) dbSel.value = Docket.defaultDB;
  Docket.onDBChange();

  Docket.renderFeeTable();
};

Docket.renderFeeTable = function() {
  var tmplKey = document.getElementById('dkt-case-template').value;
  var tmpl = Docket.caseTemplates[tmplKey];
  if (!tmpl) return;
  var cnt = parseInt(document.getElementById('dkt-case-count').value) || 1;

  // 상세 조항 자동 입력 (사용자가 편집하지 않은 경우에만)
  var notesArea = document.getElementById('dkt-notes');
  if (notesArea && !notesArea.dataset.userEdited) {
    var category = tmpl.notesCategory || 'patent';
    notesArea.value = (Docket.defaultNotes[category] || []).join('\n');
  }

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

  var db = Docket.getDB();

  // 상세 조항: textarea 내용 → 배열 (빈 줄 제거)
  var notesRaw = v('dkt-notes');
  var notes;
  if (notesRaw) {
    notes = notesRaw.split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean);
  } else {
    var category = tmpl.notesCategory || 'patent';
    notes = Docket.defaultNotes[category] || [];
  }

  return {
    templateKey: tmplKey, template: tmpl,
    caseNumber: v('dkt-case-number'), date: v('dkt-date') || new Date().toISOString().split('T')[0],
    recipient: v('dkt-recipient'), clientName: v('dkt-client-name'), caseTitle: v('dkt-case-title'),
    subject: tmpl.subject.replace('{count}', cnt), caseCount: cnt,
    feeItems: feeItems, govItems: govItems,
    discountAmount: parseInt(v('dkt-discount-amount')) || 0,
    discountQty: parseInt(v('dkt-discount-qty')) || 1,
    discountAttorney: v('dkt-discount-attorney') || db,
    notes: notes,
    db: db,
  };
};

// ═══ 엑셀 생성 (ExcelJS + 템플릿) ═══
// templates/quote-template-{DB}.xlsx 를 로드하여 마커를 치환.
// FEE/GOV/NOTES 범위는 bottom-up 순서로 행을 복제하여 확장한다.
Docket.generateFromTemplate = async function(data) {
  if (typeof ExcelJS === 'undefined') {
    throw new Error('ExcelJS 라이브러리가 로드되지 않았습니다');
  }

  // 1) 템플릿 로드
  var templatePath = Docket.getTemplatePath(data.db);
  var res = await fetch(templatePath);
  if (!res.ok) throw new Error('템플릿 로드 실패: ' + templatePath + ' (HTTP ' + res.status + ')');
  var buf = await res.arrayBuffer();

  var wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  var ws = wb.worksheets[0];

  // 2) 금액 계산
  var feeTotal = 0; data.feeItems.forEach(function(i){feeTotal+=i.unitPrice*i.qty;});
  var disc = data.discountAmount * data.discountQty;
  var afterDisc = feeTotal + disc;
  var vat = Math.round(afterDisc * 0.1);
  var feeSub = afterDisc + vat;
  var govTotal = 0; data.govItems.forEach(function(i){govTotal+=i.unitPrice*i.qty;});
  var grand = feeSub + govTotal;

  // 3) 마커 스캔 (셀 값에서 {{NAME}} 패턴 추출)
  var markers = {}; // name → [{row, col}, ...]
  ws.eachRow({includeEmpty: true}, function(row, rowNum) {
    row.eachCell({includeEmpty: false}, function(cell, colNum) {
      var val = cell.value;
      if (typeof val === 'object' && val && val.richText) {
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

  // 4) 단순 마커 치환 (값이 곧 셀 값)
  var simple = {
    CASE_NUMBER: data.caseNumber || '',
    DATE: data.date || '',
    CLIENT_NAME: data.clientName || '',
    SUBJECT: data.subject || '',
    CASE_TITLE: data.caseTitle || '',
    TOTAL_KOREAN: Docket.toKorean(grand) + ' 원정',
    TOTAL_AMOUNT: grand,
    FEE_SUBTOTAL: feeTotal,
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

  // 5) 범위 마커 처리 — bottom-up 순서 (NOTES → GOV → FEE)
  //    이렇게 하면 아래쪽 행 삽입이 위쪽 마커 위치에 영향을 주지 않음.

  // ── NOTES 영역: row 40 (sample), row 41 (end)
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
      // NOTES_START 마커 셀 클리어 (모든 확장 행에서)
      if (nsCol) row.getCell(nsCol).value = null;
      row.getCell(noteCol).value = notes[i];
    }
    // NOTES_END 마커 클리어 (확장된 만큼 행 번호 이동)
    if (markers.NOTES_END && markers.NOTES_END[0]) {
      var endRowNum = markers.NOTES_END[0].row + nInsert;
      ws.getCell(endRowNum, markers.NOTES_END[0].col).value = null;
    }
  }

  // ── GOV 영역: row 32 (sample), row 34 (end, 지불 비어있을 수 있음)
  if (markers.GOV_START && markers.GOV_ITEM_NAME) {
    var govRow = markers.GOV_START[0].row;
    var govItems = data.govItems || [];
    var nInsertG = Math.max(0, govItems.length - 1);
    if (nInsertG > 0) {
      try { ws.duplicateRow(govRow, nInsertG, true); } catch (e) { console.warn('GOV duplicateRow 실패:', e); }
    }
    for (var i = 0; i < govItems.length; i++) {
      var item = govItems[i];
      var row = ws.getRow(govRow + i);
      // A열(GOV_START 마커) 클리어
      row.getCell(markers.GOV_START[0].col).value = null;
      // C열(GOV_ITEM_NAME) — 항목명
      row.getCell(markers.GOV_ITEM_NAME[0].col).value = item.name;
      // D열(단가), E열(수량), G열(금액) — 템플릿 레이아웃 기준
      row.getCell(4).value = item.unitPrice;
      row.getCell(5).value = item.qty;
      row.getCell(7).value = item.unitPrice * item.qty;
      if (item.note) row.getCell(10).value = item.note; // J열 비고
    }
    // GOV_END 마커 클리어
    if (markers.GOV_END && markers.GOV_END[0]) {
      var govEndRow = markers.GOV_END[0].row + nInsertG;
      ws.getCell(govEndRow, markers.GOV_END[0].col).value = null;
    }
  }

  // ── FEE 영역: row 25 (sample), row 26 (discount row, FEE_END)
  if (markers.FEE_START && markers.FEE_ITEM_NAME) {
    var feeRow = markers.FEE_START[0].row;
    var feeItems = data.feeItems || [];
    var nInsertF = Math.max(0, feeItems.length - 1);
    if (nInsertF > 0) {
      try { ws.duplicateRow(feeRow, nInsertF, true); } catch (e) { console.warn('FEE duplicateRow 실패:', e); }
    }
    for (var i = 0; i < feeItems.length; i++) {
      var item = feeItems[i];
      var row = ws.getRow(feeRow + i);
      row.getCell(markers.FEE_START[0].col).value = null;
      row.getCell(markers.FEE_ITEM_NAME[0].col).value = item.name;
      row.getCell(4).value = item.unitPrice;
      row.getCell(5).value = item.qty;
      row.getCell(7).value = item.unitPrice * item.qty;
      if (item.note) row.getCell(10).value = item.note;
    }
    // 할인 행 (FEE_END) — nInsertF만큼 아래로 이동
    if (markers.FEE_END && markers.FEE_END[0]) {
      var discRowNum = markers.FEE_END[0].row + nInsertF;
      var discRow = ws.getRow(discRowNum);
      discRow.getCell(markers.FEE_END[0].col).value = null;
      discRow.getCell(4).value = data.discountAmount;
      discRow.getCell(5).value = data.discountQty;
      discRow.getCell(7).value = disc;
    }
  }

  return wb;
};

// workbook → Blob 변환
Docket.workbookToBlob = async function(wb) {
  var buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// workbook → base64 (이메일 첨부용)
Docket.workbookToBase64 = async function(wb) {
  var buffer = await wb.xlsx.writeBuffer();
  // ArrayBuffer → base64
  var bytes = new Uint8Array(buffer);
  var bin = '';
  for (var i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

Docket.downloadExcel = async function() {
  try {
    var data = Docket.collectData();
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

// ═══ 이메일 발송 ═══
Docket.sendEmail = async function() {
  var data = Docket.collectData();
  if (!data.clientName) { App.showToast('수신(고객사명)을 입력해 주세요', 'error'); return; }
  if (!data.recipient) { App.showToast('수신인 이메일을 입력해 주세요', 'error'); return; }

  var wb, wbout, fileName;
  try {
    wb = await Docket.generateFromTemplate(data);
    wbout = await Docket.workbookToBase64(wb);
    fileName = '[특허그룹 디딤] ' + data.subject + '.xlsx';
  } catch (err) {
    console.error('generateFromTemplate error:', err);
    App.showToast('견적서 생성 실패: ' + err.message, 'error');
    return;
  }

  var feeTotal=0; data.feeItems.forEach(function(i){feeTotal+=i.unitPrice*i.qty;});
  var disc = data.discountAmount*data.discountQty;
  var afterDisc=feeTotal+disc, vat=Math.round(afterDisc*0.1), feeSub=afterDisc+vat;
  var govTotal=0; data.govItems.forEach(function(i){govTotal+=i.unitPrice*i.qty;});
  var grand=feeSub+govTotal;

  var senderName = data.db;
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
      await Docket.downloadExcel();
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
  // 상세 조항 userEdited 플래그 해제 → 다음 renderFeeTable에서 기본값 재주입
  var notesArea = document.getElementById('dkt-notes');
  if (notesArea) { delete notesArea.dataset.userEdited; notesArea.value = ''; }
  Docket.renderFeeTable();
  App.showToast('초기화되었습니다', 'info');
};
