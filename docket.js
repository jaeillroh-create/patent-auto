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
    Object.keys(Docket.rightStages).forEach(function(name) {
      var opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      rightSel.appendChild(opt);
    });
    rightSel.value = '특허';
  }

  Docket.onRightChange();
};

// 권리유형 변경 → 가능한 사건단계 목록 재구성
Docket.onRightChange = function() {
  var right = document.getElementById('dkt-right').value;
  var stageSel = document.getElementById('dkt-stage');
  if (!stageSel) return;
  var currentStage = stageSel.value;
  stageSel.innerHTML = '';
  Docket.rightStages[right].forEach(function(key) {
    var tmpl = Docket.feeSchedule[right][key];
    var opt = document.createElement('option');
    opt.value = key; opt.textContent = tmpl.label;
    stageSel.appendChild(opt);
  });
  // 기존 선택 유지 시도
  if (currentStage && Docket.feeSchedule[right][currentStage]) {
    stageSel.value = currentStage;
  }
  Docket.onStageChange();
};

// 사건단계/건수 변경 → 수가표 재렌더 + 재계산
Docket.onStageChange = function() {
  Docket.renderFeeTable();
  Docket.updateNotesTextarea();
  Docket.recalc();
};

// DB 변경 (특별한 폼 업데이트 없음 — 템플릿/할인은 엑셀 생성 시점에 적용)
Docket.onDBChange = function() {
  // noop: DB별 고정값은 collectData/generateFromTemplate에서 자동 적용
};

// 수가표(읽기 전용) 테이블 렌더링
Docket.renderFeeTable = function() {
  var right = document.getElementById('dkt-right').value;
  var stage = document.getElementById('dkt-stage').value;
  var tmpl = Docket.feeSchedule[right] && Docket.feeSchedule[right][stage];
  if (!tmpl) return;
  var cnt = parseInt(document.getElementById('dkt-case-count').value) || 1;

  // 대리인수수료 수가표
  var feeBody = document.getElementById('dkt-fee-summary');
  if (feeBody) {
    feeBody.innerHTML = '';
    var feeTotal = 0;
    tmpl.fees.forEach(function(item) {
      var amt = item.unitPrice * cnt;
      feeTotal += amt;
      feeBody.innerHTML += '<tr><td>'+item.name+'</td><td class="n">'+Docket.fmt(item.unitPrice)+'</td><td class="n">'+cnt+'</td><td class="n">'+Docket.fmt(amt)+'</td></tr>';
    });
    feeBody.innerHTML += '<tr class="total"><td colspan="3"><strong>수가표 합계</strong></td><td class="n"><strong>'+Docket.fmt(feeTotal)+'</strong></td></tr>';
  }

  // 특허청관납료 수가표
  var govBody = document.getElementById('dkt-gov-summary');
  if (govBody) {
    govBody.innerHTML = '';
    if (tmpl.gov.length === 0) {
      govBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999">관납료 없음</td></tr>';
    } else {
      var govTotal = 0;
      tmpl.gov.forEach(function(item) {
        var amt = item.unitPrice * cnt;
        govTotal += amt;
        govBody.innerHTML += '<tr><td>'+item.name+'</td><td class="n">'+Docket.fmt(item.unitPrice)+'</td><td class="n">'+cnt+'</td><td class="n">'+Docket.fmt(amt)+'</td></tr>';
      });
      govBody.innerHTML += '<tr class="total"><td colspan="3"><strong>관납료 합계</strong></td><td class="n"><strong>'+Docket.fmt(govTotal)+'</strong></td></tr>';
    }
  }
};

// 상세 조항 textarea 자동 입력 (권리유형 → 카테고리)
Docket.updateNotesTextarea = function() {
  var area = document.getElementById('dkt-notes');
  if (!area || area.dataset.userEdited) return;
  var right = document.getElementById('dkt-right').value;
  var category = right === '상표' ? 'trademark' : 'patent';
  area.value = (Docket.defaultNotes[category] || []).join('\n');
};

// 실제 청구금액 입력 → 할인 자동 계산
Docket.recalc = function() {
  var right = document.getElementById('dkt-right').value;
  var stage = document.getElementById('dkt-stage').value;
  var tmpl = Docket.feeSchedule[right] && Docket.feeSchedule[right][stage];
  if (!tmpl) return;
  var cnt = parseInt(document.getElementById('dkt-case-count').value) || 1;

  // 수가표 합계
  var listedTotal = tmpl.fees.reduce(function(s, i) { return s + i.unitPrice * cnt; }, 0);
  var govTotal = tmpl.gov.reduce(function(s, i) { return s + i.unitPrice * cnt; }, 0);

  // 실제 청구금액 입력 (사용자)
  var actualInput = parseInt(document.getElementById('dkt-actual-fee').value) || 0;
  var vatRadio = document.querySelector('input[name="dkt-vat-included"]:checked');
  var vatIncluded = vatRadio ? vatRadio.value === 'yes' : false;

  // 부가세 포함 여부에 따라 실제수수료 산출
  // vatIncluded=true  → 실제수수료 = round(actual / 1.1)
  // vatIncluded=false → 실제수수료 = actual
  var actualFee = vatIncluded ? Math.round(actualInput / 1.1) : actualInput;

  // 할인 = 수가표 - 실제수수료 (양수 = 우대, 음수 = 프리미엄)
  var discount = listedTotal - actualFee;
  var vat = Math.round(actualFee * 0.1);
  var grand = actualFee + vat + govTotal;

  // DOM 업데이트
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = Docket.fmt(val); };
  set('dkt-listed-total', listedTotal);
  set('dkt-actual-fee-display', actualFee);
  set('dkt-discount-display', discount);
  set('dkt-vat-display', vat);
  set('dkt-gov-total-display', govTotal);
  set('dkt-grand-total', grand);
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

  var right = v('dkt-right');
  var stage = v('dkt-stage');
  var tmpl = (Docket.feeSchedule[right] || {})[stage];
  var cnt = parseInt(v('dkt-case-count')) || 1;
  var db = v('dkt-db') || Docket.defaultDB;
  var dbCfg = Docket.dbConfig[db] || Docket.dbConfig[Docket.defaultDB];

  // 수가표 기반 금액 계산
  var listedTotal = tmpl ? tmpl.fees.reduce(function(s,i){return s+i.unitPrice*cnt;}, 0) : 0;
  var govTotal = tmpl ? tmpl.gov.reduce(function(s,i){return s+i.unitPrice*cnt;}, 0) : 0;
  var actualInput = parseInt(v('dkt-actual-fee')) || 0;
  var vatIncluded = radio('dkt-vat-included') === 'yes';
  var govIncluded = radio('dkt-gov-included') === 'yes';
  var actualFee = vatIncluded ? Math.round(actualInput / 1.1) : actualInput;
  var discount = listedTotal - actualFee;
  var vat = Math.round(actualFee * 0.1);
  var grand = actualFee + vat + govTotal;

  // 심사형태 라벨
  var examType = stage === '출원_우선' ? '우선'
                : stage === '출원_일반' ? '일반'
                : (tmpl ? tmpl.label : stage);

  return {
    // 사건종류
    right: right,
    stage: stage,
    stageLabel: tmpl ? tmpl.label : stage,
    examType: examType,
    caseCount: cnt,

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

    // 비용
    listedTotal: listedTotal,
    actualInput: actualInput,
    actualFee: actualFee,
    discount: discount,
    vat: vat,
    govTotal: govTotal,
    grand: grand,
    vatIncluded: vatIncluded,
    govIncluded: govIncluded,

    // 견적서 raw (수가표 원본 복사)
    feeItems: tmpl ? tmpl.fees.map(function(i){return {name:i.name, unitPrice:i.unitPrice, qty:cnt};}) : [],
    govItems: tmpl ? tmpl.gov.map(function(i){return {name:i.name, unitPrice:i.unitPrice, qty:cnt};}) : [],

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

Docket.generateFromTemplate = async function(data) {
  if (typeof ExcelJS === 'undefined') {
    throw new Error('ExcelJS 라이브러리가 로드되지 않았습니다');
  }

  var cfg = data.dbConfig || Docket.dbConfig[Docket.defaultDB];
  var templatePath = cfg.template.replace(/([^\/]+)$/, function(m) {
    return encodeURIComponent(m);
  });

  // 1) 템플릿 로드
  var res = await fetch(templatePath);
  if (!res.ok) throw new Error('템플릿 로드 실패: ' + templatePath + ' (HTTP ' + res.status + ')');
  var buf = await res.arrayBuffer();

  var wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  var ws = wb.worksheets[0];

  // 2) 금액 계산
  var feeTotal = 0; data.feeItems.forEach(function(i){feeTotal+=i.unitPrice*i.qty;});
  var disc = (data.discountAmount || 0) * (data.discountQty || 1);
  var afterDisc = feeTotal + disc;
  var vat = Math.round(afterDisc * 0.1);
  var feeSub = afterDisc + vat;
  var govTotal = 0; data.govItems.forEach(function(i){govTotal+=i.unitPrice*i.qty;});
  var grand = feeSub + govTotal;

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
    if (!Docket.feeSchedule[data.right] || !Docket.feeSchedule[data.right][data.stage]) {
      App.showToast('사건종류를 먼저 선택해 주세요', 'error'); return;
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
  if (!data.clientCompany) { App.showToast('회사명을 입력해 주세요', 'error'); return; }
  if (!data.recipient)     { App.showToast('수신인 이메일을 입력해 주세요', 'error'); return; }
  if (!data.actualInput)   { App.showToast('실제 청구금액을 입력해 주세요', 'error'); return; }

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

  if (!data.clientCompany) { App.showToast('회사명을 입력해 주세요', 'error'); return; }
  if (!data.actualInput)   { App.showToast('실제 청구금액을 입력해 주세요', 'error'); return; }

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

  Docket.onStageChange();
  App.showToast('초기화되었습니다', 'info');
};
