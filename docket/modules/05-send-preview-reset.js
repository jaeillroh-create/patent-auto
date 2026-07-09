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

  // 푸터 이미지 추가 offset: 결제계좌 행 위에 덮이지 않도록 3행 아래로 밀어냄.
  //   threshold=20은 로고(row 1-7 또는 0-6)보다는 크고 푸터(row 42+)보다는 작아서
  //   로고에는 영향 없이 푸터 앵커만 3 rows 내려감.
  drawingShifts.push({ threshold: 20, amount: 3 });

  // 3-2) NOTES 셀에 wrapText를 적용할 새 cellXf를 styles.xml에 추가
  //      (기존 NOTE_TEXT 셀의 스타일을 복제해서 alignment에 wrapText 추가)
  var noteCellStyleIdx = null;
  if (notesSrcInfo) {
    var noteCellMatch = notesSrcInfo.xml.match(/<c r="B\d+"[^>]*\ss="(\d+)"[^>]*>\s*<is><t[^>]*>\{\{NOTE_TEXT\}\}/);
    if (noteCellMatch) noteCellStyleIdx = parseInt(noteCellMatch[1]);
  }
  var wrapStyleIdx = await Docket._addWrapTextXf(zip, noteCellStyleIdx);

  // 3-3) 내역 테이블 범위(rows 24-38: 헤더 ~ 견적금액)의 B~J 셀에 full thin border 적용
  //      확장 전에 수행 → 복제되는 FEE/GOV 행도 자동으로 border 상속
  //      NOTES 영역(row 40+)은 제외 (상세 조항은 표 밖)
  //      Row 37은 '총계'(36)와 '견적금액'(38) 사이 얇은 spacer(ht=9.75)이므로 skip
  xml = await Docket._applyTableBorders(zip, xml, 24, 38, [37]);

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
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ico" data-icon="history"></span> 발송 중...'; }

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
      App.showToast('<span class="ico" data-icon="check-circle"></span> 사건등록이 ' + data.recipient + '으로 발송되었습니다', 'success');
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
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="ico" data-icon="mail"></span> 사건등록 발송'; }
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
    'dkt-case-content','dkt-prior-case-no','dkt-draft-date','dkt-priority-reason-etc',
    'dkt-guide-note','dkt-must-check','dkt-actual-fee',
  ];
  textIds.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });

  // 출원안내/견적서/위임계약서 체크박스 해제
  ['dkt-need-guide-mail','dkt-need-quote','dkt-need-contract'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.checked = false;
  });

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
