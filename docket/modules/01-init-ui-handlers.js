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
      '<input type="number" class="price" data-key="' + item.key + '"' +
      ' value="' + item.unitPrice + '" oninput="Docket.recalc()"' +
      ' onclick="event.stopPropagation()" />';
    container.appendChild(row);
  });
};

// 상세 조항 카테고리 동적 결정: 권리유형 + 체크된 항목 기반
//   심판(appeal_*) 체크 시 → {right}_appeal
//   그 외 → {right}_filing
Docket._getNotesCategory = function() {
  var right = document.getElementById('dkt-right').value;
  var rightKey = right === '상표' ? 'trademark' : right === '디자인' ? 'design' : right === '실용신안' ? 'utility' : 'patent';

  // 심판 체크 여부 확인
  var hasAppeal = false;
  document.querySelectorAll('#dkt-fee-checkboxes input[type="checkbox"]:checked').forEach(function(cb) {
    if (cb.dataset.key && cb.dataset.key.indexOf('appeal_') === 0) hasAppeal = true;
  });

  return hasAppeal ? rightKey + '_appeal' : rightKey + '_filing';
};

// 상세 조항 textarea 자동 입력 (권리유형 + 체크 항목 → 카테고리)
Docket.updateNotesTextarea = function() {
  var area = document.getElementById('dkt-notes');
  if (!area || area.dataset.userEdited) return;
  var category = Docket._getNotesCategory();
  area.value = (Docket.defaultNotes[category] || Docket.defaultNotes['patent_filing'] || []).join('\n');
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
