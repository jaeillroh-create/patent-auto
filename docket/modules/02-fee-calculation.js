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

  // 사용자가 수정한 금액을 DOM에서 읽기 (수가표 기본값 override)
  var customPrices = {};
  document.querySelectorAll('#dkt-fee-checkboxes input[type="number"].price').forEach(function(inp) {
    if (inp.dataset.key) {
      customPrices[inp.dataset.key] = parseInt(inp.value) || 0;
    }
  });

  var feeItems = [];
  var govItems = [];
  if (schedule) {
    schedule.items.forEach(function(item) {
      if (!checkedKeys[item.key]) return;
      // 사용자 수정값이 있으면 그걸 사용, 없으면 수가표 기본값
      var price = (customPrices[item.key] != null) ? customPrices[item.key] : item.unitPrice;
      feeItems.push({ name: item.name, unitPrice: price, qty: cnt });
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

  // 체크박스 변경 시 상세 조항 카테고리 자동 전환 (심판 ↔ 출원)
  Docket.updateNotesTextarea();
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
