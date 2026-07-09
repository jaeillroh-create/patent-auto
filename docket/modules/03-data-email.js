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
    announcements: (function() {
      // 3개 체크박스 + 특이사항 텍스트 → 구조화 문자열
      var cb = function(id) { var el = document.getElementById(id); return el && el.checked; };
      var parts = [
        '출원안내메일: ' + (cb('dkt-need-guide-mail') ? '필요' : '불필요'),
        '견적서: ' + (cb('dkt-need-quote') ? '필요' : '불필요'),
        '위임계약서: ' + (cb('dkt-need-contract') ? '필요' : '불필요'),
      ];
      var note = v('dkt-guide-note');
      var joined = parts.join(' / ');
      if (note) joined += '\n※ ' + note;
      return joined;
    })(),
    caseContent: v('dkt-case-content'),
    priorCaseNo: v('dkt-prior-case-no'),
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
  if (data.priorCaseNo) h += row('원사건번호', esc(data.priorCaseNo));
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
  if (data.priorCaseNo) lines.push('원사건번호 | ' + data.priorCaseNo);
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
