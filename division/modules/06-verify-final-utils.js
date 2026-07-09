// 15. Checkpoint 4 화면: 검증 결과
// ═══════════════════════════════════════════
Division.renderVerify = function(left, right, p){
  var results = Division.state.validationResults;
  var h = '';

  // T14: Pass 1 (코드 자동 검증) 결과 — 메모리 또는 DB에서 추출
  var autoIssues = Division.state._autoVerifyIssues || [];
  if(!autoIssues.length){
    results.forEach(function(r){ if(r.auto_verify_issues && r.auto_verify_issues.length) autoIssues = autoIssues.concat(r.auto_verify_issues); });
  }

  // ─── T17: Pass 1 — 자동 검증 (코드) ───
  var severityIcons = {CRITICAL:'🔴',HIGH:'🟠',MEDIUM:'🟡'};
  h += '<div class="card division-autocheck-section">';
  h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="search"></span> 자동 검증 (코드)</div>';
  if(!autoIssues.length){
    h += '<div class="division-autocheck-pass"><span class="ico" data-icon="check-circle"></span> 코드 레벨 검증 통과 — 자동 감지된 이슈 없음</div>';
  } else {
    autoIssues.forEach(function(issue, aiIdx){
      if(issue._accepted){ return; } // 수용된 항목은 숨김
      var icon = severityIcons[issue.severity] || '🟡';
      h += '<div class="division-autocheck-item severity-'+issue.severity+'" id="divAutoIssue'+aiIdx+'">';
      h += '<div class="division-autocheck-header">';
      h += '<span>'+icon+'</span><span class="division-severity-badge severity-'+issue.severity+'">'+issue.severity+'</span>';
      h += '<span class="division-check-tag">'+escapeHtml(issue.check)+'</span>';
      h += '</div>';
      h += '<div style="font-size:13px;font-weight:500">'+escapeHtml(issue.message)+'</div>';
      if(issue.detail) h += '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px">'+escapeHtml(issue.detail)+'</div>';
      // 수용/수정 버튼 (CRITICAL 제외 — CRITICAL은 수용 불가, 수정만 가능)
      h += '<div style="margin-top:8px;display:flex;gap:6px">';
      if(issue.severity !== 'CRITICAL'){
        h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();Division.acceptAutoIssue('+aiIdx+')"><span class="ico" data-icon="check-circle"></span> 수용</button>';
      }
      h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();Division.editClaimText('+aiIdx+')"><span class="ico" data-icon="edit"></span> 수정</button>';
      h += '</div>';
      h += '</div>';
    });
    // 수용된 항목이 있으면 요약 표시
    var acceptedCount = autoIssues.filter(function(i){return i._accepted;}).length;
    if(acceptedCount > 0){
      h += '<div style="padding:6px 10px;font-size:11px;color:var(--color-text-tertiary)"><span class="ico" data-icon="check-circle"></span> 수용 처리됨: '+acceptedCount+'건</div>';
    }
  }
  h += '</div>';

  // ─── Pass 2: AI 검증 (LLM) ───
  var passCount = results.filter(function(r){ return r.result==='pass'; }).length;
  var warnCount = results.filter(function(r){ return r.result==='warning'; }).length;
  var failCount = results.filter(function(r){ return r.result==='fail'; }).length;
  h += '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="robot"></span> AI 검증 (LLM)</div>';
  h += '<div class="division-val-summary"><div class="division-val-stat pass"><span class="ico" data-icon="check-circle"></span> 통과 '+passCount+'</div><div class="division-val-stat warn"><span class="ico" data-icon="warning"></span> 주의 '+warnCount+'</div><div class="division-val-stat fail"><span class="ico" data-icon="x"></span> 실패 '+failCount+'</div></div>';
  var typeLabels = {new_matter:'신규사항',basis_scope:'basis 보존/원출원 범위',double_patenting:'이중 특허',spec_support:'명세서 뒷받침',support:'명세서 뒷받침',format:'형식',abstract_expression:'추상적 표현',functional_limitation:'기능적 기재',overlap:'구성 중복'};
  if(!results.length){ h += '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">검증 결과가 없습니다.</div>'; }
  else { results.forEach(function(vr, vrIdx){
    var resultCss = vr.result==='pass'?'vr-pass':vr.result==='warning'?'vr-warn':'vr-fail';
    var resultIcon = vr.result==='pass'?'<span class="ico" data-icon="check-circle" data-size="14"></span>':vr.result==='warning'?'<span class="ico" data-icon="warning" data-size="14"></span>':'<span class="ico" data-icon="x-circle" data-size="14"></span>';
    var typeLabel = typeLabels[vr.check_type]||vr.check_type;
    h += '<div class="division-val-row '+resultCss+'" id="divValRow'+vrIdx+'" onclick="this.classList.toggle(\'expanded\')">';
    h += '<div class="division-val-row-header"><span>'+resultIcon+'</span><span style="font-weight:500;flex:1">'+typeLabel+'</span><span class="division-val-result-badge '+resultCss+'">'+vr.result+'</span></div>';
    h += '<div class="division-val-row-body">';
    if(vr.target_text) h += '<div style="margin-bottom:6px"><strong>대상:</strong> '+escapeHtml(vr.target_text)+'</div>';
    if(vr.detail) h += '<div style="margin-bottom:6px">'+escapeHtml(vr.detail)+'</div>';
    if(vr.suggestion) h += '<div style="padding:8px;background:var(--color-primary-light);border-radius:var(--radius-sm);border-left:3px solid var(--color-primary)"><span class="ico" data-icon="lightbulb"></span> '+escapeHtml(vr.suggestion)+'</div>';
    if(vr.spec_paragraph_number) h += '<div style="margin-top:4px;font-size:11px;color:var(--color-text-tertiary)">근거: 【'+vr.spec_paragraph_number+'】'+(vr.spec_quote?' — "'+escapeHtml(vr.spec_quote)+'"':'')+'</div>';
    if(vr.support_type){ var stLabels={direct:'직접 기재',substantial:'실질적 뒷받침',derivable:'자명한 도출',none:'근거 없음'}; var stColors={direct:'var(--color-success)',substantial:'var(--color-success)',derivable:'var(--color-warning)',none:'var(--color-error)'}; h+='<div style="margin-top:2px;font-size:11px;color:'+stColors[vr.support_type]+'">뒷받침: '+(stLabels[vr.support_type]||vr.support_type)+'</div>'; }
    // V2: 액션 버튼 (warning/fail 항목에만)
    if(vr.result === 'warning' || vr.result === 'fail'){
      h += '<div class="division-val-actions" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--color-divider);display:flex;gap:6px;flex-wrap:wrap">';
      if(vr.result === 'warning'){
        h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();Division.acceptWarning('+vrIdx+')" title="실질적 뒷받침 인정"><span class="ico" data-icon="check-circle"></span> 수용</button>';
      }
      if(vr.result === 'fail'){
        h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px;color:var(--color-error)" onclick="event.stopPropagation();Division.removeFailedComponent('+vrIdx+')" title="해당 구성 제거 후 분석 화면으로 이동"><span class="ico" data-icon="trash"></span> 구성 제거</button>';
      }
      h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();Division.editClaimText('+vrIdx+')" title="청구항 문언 직접 수정"><span class="ico" data-icon="edit"></span> 수정</button>';
      h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();Division.specifyBasis('+vrIdx+')" title="뒷받침 근거 단락 지정"><span class="ico" data-icon="doc"></span> 근거 지정</button>';
      h += '</div>';
    }
    h += '</div></div>';
  }); }
  h += '</div>';
  left.innerHTML = h;

  var rh = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="tag"></span> 발명의 명칭</div>';

  // 원출원 명칭 표시
  if(p.original_title_ko){
    rh += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:10px;padding:8px 10px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm)">';
    rh += '<div><strong>원출원:</strong> ' + escapeHtml(p.original_title_ko) + '</div>';
    if(p.original_title_en) rh += '<div style="margin-top:2px;font-size:11px">' + escapeHtml(p.original_title_en) + '</div>';
    rh += '</div>';
  }

  // 명칭 선택: 원출원 동일 / AI 제안 / 직접 입력
  rh += '<div style="font-size:12px;font-weight:600;color:var(--color-text-secondary);margin-bottom:8px">분할출원 명칭 선택</div>';

  // 옵션 0: 원출원과 동일
  if(p.original_title_ko){
    rh += '<label class="division-title-option"><input type="radio" name="divisionTitle" value="original" checked /><div>';
    rh += '<div style="font-size:13px;font-weight:500">원출원과 동일</div>';
    rh += '<div style="font-size:11px;color:var(--color-text-tertiary)">' + escapeHtml(p.original_title_ko) + '</div>';
    rh += '</div></label>';
  }

  // 구성 선택 시 생성된 suggestedTitles (최상단 표시)
  var suggested = Division.state.suggestedTitles || [];
  if(suggested.length > 0){
    suggested.forEach(function(st, si){
      if(!st.ko) return;
      rh += '<label class="division-title-option" style="border-color:var(--color-primary);background:var(--color-primary-light)"><input type="radio" name="divisionTitle" value="suggested_'+si+'"'+(si===0 && !p.original_title_ko?' checked':'')+' /><div>';
      rh += '<div style="font-size:13px;font-weight:500">'+escapeHtml(st.ko)+'</div>';
      if(st.en) rh += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">'+escapeHtml(st.en)+'</div>';
      rh += '<div style="font-size:11px;color:var(--color-primary);margin-top:2px"><span class="ico" data-icon="tag"></span> 구성 선택 기반 제안</div>';
      rh += '</div></label>';
    });
  }

  // 옵션 1~N: AI 제안 — reason, based_on_element, 교차확인 표시
  var candidates = p.title_candidates || [];
  // 독립항 텍스트 (교차확인용)
  var indepClaimTexts = (Division.state.divisionClaims || []).filter(function(c){ return c.claim_type==='independent'; }).map(function(c){ return c.claim_text||''; });
  var allClaimText = indepClaimTexts.join(' ');

  if(candidates.length > 0){
    candidates.forEach(function(tc,i){
      rh += '<label class="division-title-option" style="flex-direction:column;align-items:stretch"><div style="display:flex;align-items:flex-start;gap:10px">';
      rh += '<input type="radio" name="divisionTitle" value="'+i+'"' + (!p.original_title_ko && i===0 ? ' checked' : '') + ' style="margin-top:4px;flex-shrink:0" />';
      rh += '<div style="flex:1">';
      rh += '<div style="font-size:13px;font-weight:500">'+escapeHtml(tc.ko)+'</div>';
      rh += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">'+escapeHtml(tc.en)+'</div>';
      // reason
      if(tc.reason){
        rh += '<div style="font-size:11px;color:var(--color-primary);margin-top:4px"><span class="ico" data-icon="lightbulb"></span> 근거: '+escapeHtml(tc.reason)+'</div>';
      }
      // based_on_element + 교차확인
      if(tc.based_on_element){
        var elementText = tc.based_on_element;
        // 교차확인: based_on_element가 독립항에 실제 포함되는지
        var found = allClaimText.indexOf(elementText.substring(0, Math.min(20, elementText.length))) >= 0;
        rh += '<div style="font-size:11px;margin-top:2px;padding:4px 8px;border-radius:var(--radius-sm);background:'+(found?'#f0fdf4':'#FEECEC')+'">';
        rh += '<span style="color:'+(found?'var(--color-success)':'var(--color-error)')+'"><span class="ico" data-icon="flag"></span> 청구항 포함 확인: '+(found?'<span class="ico" data-icon="check-circle" data-size="12"></span> 포함':'<span class="ico" data-icon="warning" data-size="12"></span> 미포함')+'</span>';
        rh += '<div style="color:var(--color-text-secondary);margin-top:2px">"'+escapeHtml(elementText.substring(0,120))+(elementText.length>120?'...':'')+'"</div>';
        rh += '</div>';
      }
      rh += '</div></div></label>';
    });
  }

  // 옵션: 직접 입력
  rh += '<label class="division-title-option"><input type="radio" name="divisionTitle" value="custom" onchange="Division.onTitleRadioChange()" /><div style="flex:1">';
  rh += '<div style="font-size:13px;font-weight:500;margin-bottom:6px">직접 입력</div>';
  rh += '<input type="text" class="input-field" id="divisionCustomTitle" placeholder="국문 명칭" style="font-size:13px;padding:6px 10px;margin-bottom:4px" />';
  rh += '<input type="text" class="input-field" id="divisionCustomTitleEn" placeholder="영문 명칭" style="font-size:13px;padding:6px 10px" />';
  rh += '</div></label>';

  // ⚠️ 명칭 변경 시 경고
  rh += '<div id="divisionTitleWarning" class="division-title-warning" style="display:none">';
  rh += '<div style="font-weight:600;margin-bottom:4px"><span class="ico" data-icon="warning"></span> 발명의 명칭 변경 시 유의사항</div>';
  rh += '<div style="font-size:12px;line-height:1.7">';
  rh += '분할출원의 명칭을 원출원과 다르게 하는 경우, 명세서의 다음 부분도 함께 변경해야 합니다:';
  rh += '<ul style="margin:6px 0 0 16px;padding:0"><li>【발명의 명칭】 항목</li><li>【요약서】의 발명 제목</li><li>【국제특허분류】가 달라지는 경우 IPC 코드</li><li>출원서 표지의 발명의 명칭란</li></ul>';
  rh += '명칭 변경은 분할출원의 권리범위 해석에 영향을 줄 수 있으므로 신중히 결정하세요.';
  rh += '</div></div>';
  rh += '</div>';
  // 최종확정 활성화 판단 — 미처리 이슈 기반
  // Pass 1: CRITICAL은 수용 불가(반드시 수정), HIGH/MEDIUM은 수용 가능
  var unhandledCritical = autoIssues.filter(function(i){ return i.severity==='CRITICAL' && !i._accepted; }).length;
  var unhandledHigh = autoIssues.filter(function(i){ return (i.severity==='HIGH'||i.severity==='MEDIUM') && !i._accepted; }).length;
  // Pass 2: fail은 미처리, warning 중 수용 안 된 것
  var unhandledFail = failCount;
  var unhandledWarn = warnCount; // warning은 수용하면 pass로 전환되므로 남은 것이 미처리

  var totalBlocking = unhandledCritical + unhandledFail;
  var totalWarning = unhandledHigh + unhandledWarn;

  if(totalBlocking > 0){
    var msgs = [];
    if(unhandledFail > 0) msgs.push('AI 검증 실패 '+unhandledFail+'건');
    if(unhandledCritical > 0) msgs.push('자동 검증 CRITICAL '+unhandledCritical+'건');
    if(totalWarning > 0) msgs.push('주의 '+totalWarning+'건');
    rh += '<div style="margin-top:12px;padding:12px;background:var(--color-error-light);border-radius:var(--radius-sm);font-size:13px;color:var(--color-error)"><span class="ico" data-icon="x"></span> '+msgs.join(' / ')+' — 수정하거나 구성을 제거한 후 재검증하세요.</div>';
  } else if(totalWarning > 0){
    rh += '<div style="margin-top:12px;padding:12px;background:var(--color-warning-light);border-radius:var(--radius-sm);font-size:13px;color:#663A00"><span class="ico" data-icon="warning"></span> 주의 '+totalWarning+'건 — "수용" 또는 "수정"을 선택하면 최종 확정할 수 있습니다.</div>';
  } else {
    rh += '<div style="margin-top:12px;padding:12px;background:#D9FFE6;border-radius:var(--radius-sm);font-size:13px;color:#006E25"><span class="ico" data-icon="check-circle"></span> 모든 검증 통과 — 최종 확정할 수 있습니다.</div>';
  }
  rh += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-ghost" onclick="Division.runVerify()" style="flex:1;padding:12px"><span class="ico" data-icon="refresh"></span> 재검증</button>';
  var canConfirm = totalBlocking === 0 && totalWarning === 0;
  rh += '<button class="btn btn-primary" onclick="'+(canConfirm ? 'Division.confirmFinal()' : 'showToast(\'미처리 이슈를 먼저 해결하세요\',\'error\')')+'" style="flex:1;padding:12px'+(canConfirm?'':';opacity:0.5;cursor:not-allowed')+'"><span class="ico" data-icon="flag"></span> 최종 확정</button></div>';
  right.innerHTML = rh;
  Division._bindTitleRadios();
};

// ═══════════════════════════════════════════
// 15-1. 검증 결과 액션 (V3/V4 + V5/V6 스텁)
// ═══════════════════════════════════════════

// V3: warning 수용 — pass로 전환 + 사유 기록
Division.acceptWarning = async function(vrIdx){
  var results = Division.state.validationResults;
  var vr = results[vrIdx];
  if(!vr || vr.result !== 'warning'){ showToast('수용할 수 없는 항목입니다','error'); return; }

  var reason = prompt('수용 사유를 입력하세요 (예: 실질적 뒷받침 인정, 동일 기술적 개념)');
  if(!reason) return;

  // DB 업데이트: result → pass
  try {
    await sb.from('division_validation_results').update({ result:'pass' }).eq('id', vr.id);
    vr.result = 'pass';
    Division._log('[Division] V3 수용: 항목', vrIdx, '<span class="ico" data-icon="arrow-right"></span> pass, 사유:', reason);

    // user_accepted_warnings 기록 시도 (컬럼 있을 때만)
    try {
      var accepted = vr.user_accepted_warnings || [];
      accepted.push({ check_index:vrIdx, reason:reason, timestamp:new Date().toISOString() });
      await sb.from('division_validation_results').update({ user_accepted_warnings:accepted }).eq('id', vr.id);
    } catch(e){ console.warn('[Division] user_accepted_warnings 저장 실패 (컬럼 미존재?):', e.message); }

    showToast('항목을 수용했습니다 (pass로 전환)', 'success');
    Division.renderStay();
  } catch(e){ showToast('수용 처리 실패: '+e.message, 'error'); }
};

// Pass 1 이슈 수용 — _accepted 플래그로 표시, UI 갱신
Division.acceptAutoIssue = function(aiIdx){
  var autoIssues = Division.state._autoVerifyIssues || [];
  var issue = autoIssues[aiIdx];
  if(!issue){ showToast('항목을 찾을 수 없습니다','error'); return; }
  if(issue.severity === 'CRITICAL'){ showToast('CRITICAL 항목은 수용할 수 없습니다','error'); return; }

  var reason = prompt('수용 사유를 입력하세요 (예: AI 검증에서 pass 확인됨)');
  if(!reason) return;

  issue._accepted = true;
  issue._acceptReason = reason;
  Division._log('[Division] Pass 1 이슈 수용:', aiIdx, issue.check, '사유:', reason);
  showToast('자동 검증 항목을 수용했습니다', 'success');
  Division.renderStay();
};

// V4: 구성 제거 — 해당 구성 선택 해제 + 분석 화면으로 복귀
Division.removeFailedComponent = async function(vrIdx){
  var results = Division.state.validationResults;
  var vr = results[vrIdx];
  if(!vr){ showToast('항목을 찾을 수 없습니다','error'); return; }

  var targetText = vr.target_text || vr.detail || '';
  if(!confirm('이 구성을 제거하고 분석 화면으로 돌아가시겠습니까?\n\n대상: ' + targetText.substring(0,100))) return;

  // target_text와 매칭되는 unused_component 찾아서 선택 해제
  var unused = Division.state.unusedComponents;
  var matched = null;
  if(targetText){
    for(var i=0; i<unused.length; i++){
      if(unused[i].content && targetText.indexOf(unused[i].content.substring(0,30)) >= 0){
        matched = unused[i]; break;
      }
      if(unused[i].insertion_point && targetText.indexOf(unused[i].insertion_point.substring(0,30)) >= 0){
        matched = unused[i]; break;
      }
    }
  }

  if(matched){
    try {
      await sb.from('division_unused_components').update({user_selection:'excluded'}).eq('id', matched.id);
      matched.user_selection = 'excluded';
      Division._log('[Division] V4 구성 제거:', matched.content.substring(0,50));
    } catch(e){ console.warn('[Division] 구성 해제 실패:', e.message); }
  }

  // 분석 화면으로 복귀 — 사용자가 다른 D를 선택할 수 있도록
  var p = Division.state.current;
  if(p){
    await sb.from('division_projects').update({status:'analyzed', updated_at:new Date().toISOString()}).eq('id', p.id);
    p.status = 'analyzed';
  }
  Division.state.currentStepKey = 'analyze';
  showToast('구성이 제거되었습니다. 다른 구성을 선택하고 재조립하세요.', 'info');
  Division.renderStay();
};

// ═══ V5: 청구항 문언 직접 수정 ═══
Division.editClaimText = function(vrIdx){
  var results = Division.state.validationResults;
  var vr = results[vrIdx];
  if(!vr){ showToast('항목을 찾을 수 없습니다','error'); return; }

  // 문제가 된 청구항 찾기 — target_text로 매칭
  var divClaims = Division.state.divisionClaims;
  var targetClaim = null;
  if(vr.target_text){
    for(var i=0; i<divClaims.length; i++){
      if(divClaims[i].claim_text && divClaims[i].claim_text.indexOf(vr.target_text.substring(0,30)) >= 0){
        targetClaim = divClaims[i]; break;
      }
    }
  }
  if(!targetClaim && divClaims.length > 0) targetClaim = divClaims[0]; // 폴백: 첫 번째 청구항

  var rowEl = document.getElementById('divValRow'+vrIdx);
  if(!rowEl) return;
  // 이미 편집 중이면 무시
  if(rowEl.querySelector('.division-edit-area')) return;
  rowEl.classList.add('expanded');

  var bodyEl = rowEl.querySelector('.division-val-row-body');
  if(!bodyEl) return;

  var claimText = targetClaim ? targetClaim.claim_text : '';
  var editHtml = '<div class="division-edit-area" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--color-divider)">';
  editHtml += '<div style="font-size:12px;font-weight:600;margin-bottom:6px"><span class="ico" data-icon="edit"></span> 청구항 '+((targetClaim&&targetClaim.claim_number)||'?')+' 문언 수정</div>';
  editHtml += '<textarea id="divEditClaim'+vrIdx+'" style="width:100%;min-height:120px;font-size:12px;line-height:1.7;padding:10px;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-family:var(--font-family);resize:vertical">'+escapeHtml(claimText)+'</textarea>';
  editHtml += '<div style="display:flex;gap:6px;margin-top:8px">';
  editHtml += '<button class="btn btn-primary" style="font-size:11px;padding:6px 14px" onclick="Division._submitClaimEdit('+vrIdx+',\''+((targetClaim&&targetClaim.id)||'')+'\')">재검증 실행</button>';
  editHtml += '<button class="btn btn-ghost" style="font-size:11px;padding:6px 14px" onclick="this.closest(\'.division-edit-area\').remove()">취소</button>';
  editHtml += '</div></div>';
  bodyEl.insertAdjacentHTML('beforeend', editHtml);
};

Division._submitClaimEdit = async function(vrIdx, claimId){
  var textarea = document.getElementById('divEditClaim'+vrIdx);
  if(!textarea){ showToast('편집 영역을 찾을 수 없습니다','error'); return; }
  var newText = textarea.value.trim();
  if(!newText){ showToast('청구항 내용을 입력하세요','error'); return; }

  // 수정 전 텍스트 저장
  var dc = Division.state.divisionClaims.find(function(c){ return c.id === claimId; });
  var beforeText = dc ? dc.claim_text : '';

  // DB 업데이트
  if(claimId){
    try {
      await sb.from('division_claims_output').update({ claim_text:newText }).eq('id', claimId);
      if(dc){ dc.claim_text = newText; dc.claim_text_highlighted = dc.claim_text_highlighted || newText; }
    } catch(e){ showToast('청구항 저장 실패: '+e.message,'error'); return; }
  }

  // 수정 이력을 메모리에 보관
  if(!Division.state._revisionHistory) Division.state._revisionHistory = [];
  Division.state._revisionHistory.push({
    round: Division.state._revisionHistory.length + 1,
    action: 'edit_claim',
    before: beforeText.substring(0,500),
    after: newText.substring(0,500),
    reason: '문언 직접 수정 (검증 항목 '+vrIdx+')',
    timestamp: new Date().toISOString()
  });

  showToast('청구항이 수정되었습니다. 재검증을 실행합니다...', 'info');
  // V8: 재검증 실행
  Division.runReVerify({ beforeText:beforeText, afterText:newText, reason:'문언 직접 수정' });
};

// ═══ V6: 뒷받침 근거 단락 지정 ═══
Division.specifyBasis = function(vrIdx){
  var results = Division.state.validationResults;
  var vr = results[vrIdx];
  if(!vr){ showToast('항목을 찾을 수 없습니다','error'); return; }

  var rowEl = document.getElementById('divValRow'+vrIdx);
  if(!rowEl) return;
  if(rowEl.querySelector('.division-basis-area')) return;
  rowEl.classList.add('expanded');

  var bodyEl = rowEl.querySelector('.division-val-row-body');
  if(!bodyEl) return;

  // 명세서 단락 목록
  var paragraphs = Division.state.specParagraphs || [];
  var basisHtml = '<div class="division-basis-area" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--color-divider)">';
  basisHtml += '<div style="font-size:12px;font-weight:600;margin-bottom:6px"><span class="ico" data-icon="doc"></span> 근거 단락 지정</div>';
  basisHtml += '<input type="text" id="divBasisSearch'+vrIdx+'" placeholder="단락번호 또는 내용으로 검색..." style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:8px;font-family:var(--font-family)" oninput="Division._filterBasisList('+vrIdx+')" />';
  basisHtml += '<div id="divBasisList'+vrIdx+'" style="max-height:200px;overflow-y:auto;border:1px solid var(--color-border);border-radius:var(--radius-sm)">';
  if(!paragraphs.length){
    basisHtml += '<div style="padding:12px;font-size:12px;color:var(--color-text-tertiary)">명세서 단락이 없습니다. 파싱을 먼저 실행해 주세요.</div>';
  } else {
    paragraphs.forEach(function(para){
      basisHtml += '<label class="division-basis-item" style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-bottom:1px solid var(--color-divider);cursor:pointer;font-size:12px" data-para-num="'+para.paragraph_number+'" data-para-content="'+escapeHtml((para.content||'').substring(0,100)).toLowerCase()+'">';
      basisHtml += '<input type="checkbox" data-basis-para="'+para.paragraph_number+'" style="margin-top:2px;flex-shrink:0" />';
      basisHtml += '<div><strong>【'+para.paragraph_number+'】</strong> '+escapeHtml((para.content||'').substring(0,150))+(para.content&&para.content.length>150?'...':'')+'</div>';
      basisHtml += '</label>';
    });
  }
  basisHtml += '</div>';
  basisHtml += '<div style="display:flex;gap:6px;margin-top:8px">';
  basisHtml += '<button class="btn btn-primary" style="font-size:11px;padding:6px 14px" onclick="Division._submitBasisSpec('+vrIdx+')">이 단락으로 재검증</button>';
  basisHtml += '<button class="btn btn-ghost" style="font-size:11px;padding:6px 14px" onclick="this.closest(\'.division-basis-area\').remove()">취소</button>';
  basisHtml += '</div></div>';
  bodyEl.insertAdjacentHTML('beforeend', basisHtml);
};

Division._filterBasisList = function(vrIdx){
  var input = document.getElementById('divBasisSearch'+vrIdx);
  var query = (input ? input.value : '').toLowerCase();
  var items = document.querySelectorAll('#divBasisList'+vrIdx+' .division-basis-item');
  items.forEach(function(item){
    var num = item.dataset.paraNum || '';
    var content = item.dataset.paraContent || '';
    item.style.display = (num.indexOf(query) >= 0 || content.indexOf(query) >= 0) ? '' : 'none';
  });
};

Division._submitBasisSpec = async function(vrIdx){
  var checked = document.querySelectorAll('#divBasisList'+vrIdx+' input[data-basis-para]:checked');
  if(!checked.length){ showToast('근거 단락을 1개 이상 선택하세요','error'); return; }

  var selectedParas = [];
  var paragraphs = Division.state.specParagraphs || [];
  checked.forEach(function(cb){
    var num = cb.dataset.basisPara;
    var para = paragraphs.find(function(p){ return p.paragraph_number === num; });
    selectedParas.push({ number:num, content: para ? para.content : '' });
  });

  // 수정 이력
  if(!Division.state._revisionHistory) Division.state._revisionHistory = [];
  Division.state._revisionHistory.push({
    round: Division.state._revisionHistory.length + 1,
    action: 'add_basis',
    before: '',
    after: selectedParas.map(function(p){ return '【'+p.number+'】'; }).join(', '),
    reason: '근거 단락 지정 (검증 항목 '+vrIdx+')',
    timestamp: new Date().toISOString()
  });

  showToast('근거 단락이 지정되었습니다. 재검증을 실행합니다...', 'info');
  Division.runReVerify({
    userSpecifiedParagraphs: selectedParas,
    reason: '사용자가 근거 단락을 지정함: ' + selectedParas.map(function(p){ return '【'+p.number+'】'; }).join(', ')
  });
};

// ═══ V7: 재검증 프롬프트 ═══
Division._buildReVerifyPrompt = function(claimsText, specText, origClaimsText, editContext){
  var principles = Division.DIVISION_PRINCIPLES;

  var contextBlock = '';
  if(editContext.beforeText && editContext.afterText){
    contextBlock += '\n[수정 전 청구항]\n' + editContext.beforeText +
      '\n\n[수정 후 청구항]\n' + editContext.afterText +
      '\n\n[수정 사유]\n' + (editContext.reason||'문언 수정');
  }
  if(editContext.userSpecifiedParagraphs && editContext.userSpecifiedParagraphs.length > 0){
    contextBlock += '\n\n[사용자 지정 근거 단락]\n';
    editContext.userSpecifiedParagraphs.forEach(function(p){
      contextBlock += '【'+p.number+'】 '+p.content+'\n';
    });
    contextBlock += '\n→ 위 단락이 해당 구성을 실질적으로 뒷받침하는지 집중 검토하라.';
  }

  return principles +
    '\n\n아래 분할출원 청구항이 수정되었다. 수정 전후를 비교하고,\n' +
    '수정 후 청구항이 원출원 명세서에 의해 뒷받침되는지 재검증하라.\n' +
    contextBlock +
    '\n\n[현재 분할출원 청구항]\n' + claimsText +
    '\n\n[원출원 등록 청구항]\n' + (origClaimsText||'(없음)') +
    '\n\n[명세서 전문]\n' + (specText||'(없음)').substring(0,40000) +
    '\n\n[뒷받침 판단 기준]\n' +
    '"뒷받침된다"는 것은 동일한 단어가 명세서에 있다는 것이 아니다.\n' +
    '명세서의 기술적 내용이 해당 청구항 구성을 실질적으로 설명하고 있으면 뒷받침이 인정된다.\n' +
    '- "direct": 동일 표현 → pass\n' +
    '- "substantial": 다른 표현이나 동일 기술적 개념 → pass\n' +
    '- "derivable": 당업자 도출 가능 → warning\n' +
    '- "none": 근거 없음 → fail\n' +
    '\n검증 항목: 신규사항 → basis 보존 → 이중특허 → 뒷받침 → 형식\n' +
    '\n★★★ JSON만 출력. ★★★\n\n출력 JSON:\n' +
    '{"overall":"pass|warning|fail","results":[{' +
    '"check_type":"new_matter|basis_scope|double_patenting|spec_support|format",' +
    '"target_text":"구절","result":"pass|warning|fail",' +
    '"detail":"분석","suggestion":"제안",' +
    '"spec_paragraph_number":"단락번호",' +
    '"spec_quote":"원문 30자","support_type":"direct|substantial|derivable|none"}]}';
};

// ═══ V8: 재검증 실행 흐름 ═══
Division.runReVerify = async function(editContext){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;

  try {
    // 상태 전이: re_verifying
    await sb.from('division_projects').update({status:'re_verifying', updated_at:new Date().toISOString()}).eq('id', p.id);
    p.status = 're_verifying';

    var right = document.getElementById('divisionDetailRight');
    if(right) right.innerHTML = '<div class="card" style="padding:20px;text-align:center"><div style="font-size:32px;margin-bottom:12px"><span class="ico" data-icon="refresh"></span></div><div style="font-size:14px;font-weight:600;margin-bottom:8px">재검증 진행 중...</div><div id="divisionReVerifyProgress"></div></div>';

    // 1) 청구항 텍스트
    App.showProgress('divisionReVerifyProgress','재검증 준비 중...',1,5);
    var divClaims = Division.state.divisionClaims;
    var claimsText = divClaims.map(function(dc){ return '【청구항 '+dc.claim_number+'】\n'+dc.claim_text; }).join('\n\n');

    // 2) 명세서 전문 로드 (유틸 함수 사용)
    App.showProgress('divisionReVerifyProgress','명세서 로드 중...',2,5);
    var specText = await Division._loadSpecText(p, Division.state.specParagraphs);

    // 3) 원출원 청구항
    var origClaimsText = Division.state.claims.map(function(c){
      return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text||'').substring(0,1000);
    }).join('\n');

    // 4) Pass 1: 코드 레벨 자동 검증
    App.showProgress('divisionReVerifyProgress','자동 검증 (Pass 1)...',3,5);
    var basisClaim = Division.state.claims.find(function(c){ return c.division_role==='basis'; }) ||
      Division.state.claims.find(function(c){ return c.claim_type==='independent'; });
    var autoIssues = Division.runAutoVerify(divClaims, basisClaim, Division.state.claims, specText, p.division_type);
    Division.state._autoVerifyIssues = autoIssues;

    // 5) Pass 2: LLM 재검증
    App.showProgress('divisionReVerifyProgress','AI 재검증 (Pass 2)...',4,5);
    var reVerifyPrompt = Division._buildReVerifyPrompt(claimsText, specText, origClaimsText, editContext || {});
    var result = await Division.callAI(reVerifyPrompt);
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 재검증 중 프로젝트 전환됨'); App.clearProgress('divisionReVerifyProgress'); return; }

    App.showProgress('divisionReVerifyProgress','결과 저장 중...',5,5);
    var verified;
    try { verified = Division._extractJSON(result.text); }
    catch(e) { showToast('재검증 결과 해석 실패: '+e.message.substring(0,80),'error'); App.clearProgress('divisionReVerifyProgress'); return; }

    // DB 저장
    var VALID_CHECK = ['new_matter','basis_scope','double_patenting','spec_support','support','format','abstract_expression','functional_limitation','overlap'];
    var VALID_RESULT = ['pass','warning','fail'];
    var sEnum = Division._sanitizeEnum;

    var VALID_SUPPORT = ['direct','substantial','derivable','none'];
    await sb.from('division_validation_results').delete().eq('project_id',p.id);
    if(verified.results && verified.results.length > 0){
      var rows = verified.results.map(function(vr){
        return {
          project_id:p.id,
          check_type:sEnum(vr.check_type,VALID_CHECK,'format'),
          target_text:(vr.target_text||'').substring(0,5000),
          result:sEnum(vr.result,VALID_RESULT,'pass'),
          detail:(vr.detail||'').substring(0,5000),
          suggestion:(vr.suggestion||'').substring(0,5000),
          spec_paragraph_number:vr.spec_paragraph_number ? String(vr.spec_paragraph_number).substring(0,20) : null,
          spec_quote:vr.spec_quote ? String(vr.spec_quote).substring(0,200) : null,
          support_type:vr.support_type ? sEnum(vr.support_type,VALID_SUPPORT,null) : null
        };
      });
      var {error:reVerr} = await sb.from('division_validation_results').insert(rows);
      if(reVerr && /column.*does not exist|Could not find.*column|schema cache/i.test(reVerr.message||'')){
        console.warn('[Division] spec_quote/support_type 컬럼 미존재 — 폴백 재시도');
        var legacyRows = rows.map(function(r){ var c = Object.assign({}, r); delete c.spec_quote; delete c.support_type; return c; });
        await sb.from('division_validation_results').insert(legacyRows);
      }
    }

    // 상태: verified로 복귀
    await sb.from('division_projects').update({status:'verified', updated_at:new Date().toISOString()}).eq('id', p.id);
    p.status = 'verified';
    App.clearProgress('divisionReVerifyProgress');
    showToast('재검증 완료!');
    Division.state.currentStepKey = 'verify';
    await Division.loadData(p.id);
  } catch(e) {
    App.clearProgress('divisionReVerifyProgress');
    // 에러 시 verified 상태로 복귀
    try { await sb.from('division_projects').update({status:'verified'}).eq('id', p.id); p.status='verified'; } catch(e2){}
    showToast('재검증 실패: '+e.message,'error');
  }
};

// ═══════════════════════════════════════════
// 16. 최종 확정
// ═══════════════════════════════════════════
Division.onTitleRadioChange = function(){
  var sel = document.querySelector('input[name="divisionTitle"]:checked');
  var warn = document.getElementById('divisionTitleWarning');
  if(!warn) return;
  // 원출원과 동일이 아닌 옵션 선택 시 경고 표시
  warn.style.display = (sel && sel.value !== 'original') ? 'block' : 'none';
};

// 타이틀 라디오 변경 이벤트 바인딩 (renderVerify 후)
Division._bindTitleRadios = function(){
  setTimeout(function(){
    document.querySelectorAll('input[name="divisionTitle"]').forEach(function(r){
      r.addEventListener('change', Division.onTitleRadioChange);
    });
  }, 0);
};

Division.confirmFinal = async function(){
  var p = Division.state.current; if(!p) return;
  var sel = document.querySelector('input[name="divisionTitle"]:checked');
  var titleKo = '', titleEn = '', candidates = p.title_candidates || [];
  if(sel){
    if(sel.value === 'original'){
      titleKo = p.original_title_ko || '';
      titleEn = p.original_title_en || '';
    } else if(sel.value === 'custom'){
      titleKo = (document.getElementById('divisionCustomTitle')?.value || '').trim();
      titleEn = (document.getElementById('divisionCustomTitleEn')?.value || '').trim();
    } else if(sel.value.indexOf('suggested_') === 0){
      var si = parseInt(sel.value.replace('suggested_',''));
      var suggested = Division.state.suggestedTitles || [];
      if(suggested[si]){ titleKo = suggested[si].ko; titleEn = suggested[si].en || ''; }
    } else {
      var idx = parseInt(sel.value);
      if(candidates[idx]){ titleKo = candidates[idx].ko; titleEn = candidates[idx].en; }
    }
  } else {
    titleKo = (document.getElementById('divisionCustomTitle')?.value || '').trim();
    titleEn = (document.getElementById('divisionCustomTitleEn')?.value || '').trim();
  }
  if(!titleKo){ showToast('발명의 명칭을 선택하거나 입력해 주세요','error'); return; }

  // 명칭 변경 여부 확인
  var titleChanged = p.original_title_ko && titleKo !== p.original_title_ko;
  if(titleChanged){
    if(!confirm('발명의 명칭이 원출원과 다릅니다.\n명세서의 【발명의 명칭】, 【요약서】 등도 함께 수정해야 합니다.\n계속하시겠습니까?')) return;
  }

  try {
    await sb.from('division_projects').update({ status:'confirmed', title_ko:titleKo, title_en:titleEn, title_changed:titleChanged||false, updated_at:new Date().toISOString() }).eq('id',p.id);
    p.status='confirmed'; p.title_ko=titleKo; p.title_en=titleEn; p.title_changed=titleChanged||false;
    showToast('최종 확정 완료!');
    Division.state.currentStepKey = 'confirm';
    Division.renderDetail();
  } catch(e) { showToast('확정 실패: '+e.message,'error'); }
};

// ═══════════════════════════════════════════
// 17. 최종 출력 화면
// ═══════════════════════════════════════════
Division.renderConfirm = function(left, right, p){
  var divClaims = Division.state.divisionClaims;
  var plainText = divClaims.map(function(dc){ return '【청구항 '+dc.claim_number+'】\n'+(dc.claim_text||'').replace(/;\s*/g,';\n'); }).join('\n\n');
  var h = '<div class="card" style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<div style="font-size:14px;font-weight:700"><span class="ico" data-icon="clipboard"></span> 청구항 전문</div>';
  h += '<button class="btn btn-outline btn-sm" onclick="Division.copyText(\'divisionOutputText\')"><span class="ico" data-icon="clipboard"></span> 전체 복사</button></div>';
  h += '<div id="divisionOutputText" style="white-space:pre-wrap;font-size:13px;line-height:1.8;background:var(--color-bg-tertiary);padding:16px;border-radius:var(--radius-sm);max-height:60vh;overflow-y:auto">'+escapeHtml(plainText)+'</div></div>';
  left.innerHTML = h;

  var rh = '<div class="card" style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  rh += '<div style="font-size:14px;font-weight:700"><span class="ico" data-icon="tag"></span> 발명의 명칭</div>';
  rh += '<button class="btn btn-outline btn-sm" onclick="Division.copyText(\'divisionOutputTitle\')"><span class="ico" data-icon="clipboard"></span> 복사</button></div>';
  rh += '<div id="divisionOutputTitle" style="font-size:13px;line-height:1.7"><div><strong>【국문】</strong>'+escapeHtml(p.title_ko||'')+'</div>';
  rh += '<div style="margin-top:4px"><strong>【영문】</strong>'+escapeHtml(p.title_en||'')+'</div></div>';
  if(p.title_changed){
    rh += '<div style="margin-top:10px;padding:10px 12px;background:var(--color-warning-light);border-radius:var(--radius-sm);border-left:3px solid var(--color-warning);font-size:12px;line-height:1.6">';
    rh += '<strong><span class="ico" data-icon="warning"></span> 명칭 변경됨</strong> — 원출원과 발명의 명칭이 다릅니다.<br>';
    rh += '명세서의 【발명의 명칭】, 【요약서】, 출원서 표지도 함께 수정하세요.';
    if(p.original_title_ko) rh += '<div style="margin-top:6px;color:var(--color-text-tertiary)">원출원: ' + escapeHtml(p.original_title_ko) + '</div>';
    rh += '</div>';
  }
  rh += '</div>';
  rh += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="edit"></span> 하이라이트 버전</div>';
  rh += '<div style="font-size:13px;line-height:1.8">';
  divClaims.forEach(function(dc){
    var d = escapeHtml(dc.claim_text_highlighted||dc.claim_text);
    d = d.replace(/\*\*\*(.*?)\*\*\*/g,'<span class="division-hl-merge">$1</span>').replace(/\*\*(.*?)\*\*/g,'<span class="division-hl-added">$1</span>');
    d = d.replace(/;\s*/g,';<br>');
    rh += '<div style="margin-bottom:12px"><span style="font-weight:700;color:var(--color-primary)">【청구항 '+dc.claim_number+'】</span><br>'+d+'</div>';
  });
  rh += '</div></div>';
  rh += '<button class="btn btn-ghost btn-full" onclick="Division.backToList()" style="margin-top:12px;padding:12px"><span class="ico" data-icon="arrow-left"></span> 목록으로</button>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 18. 유틸리티
// ═══════════════════════════════════════════

// 분할출원 종속항에 대응하는 원출원 종속항 찾기 (텍스트 유사도 기반)
Division._findBestOrigMatch = function(divClaim, origClaims){
  if(!divClaim || !origClaims || !origClaims.length) return null;
  var divText = (divClaim.claim_text || '').replace(/\*{2,3}/g, '').substring(0, 300);
  if(!divText) return null;
  var best = null, bestScore = 0;
  origClaims.forEach(function(oc){
    var origText = (oc.amended_text || oc.original_text || '').substring(0, 300);
    if(!origText) return;
    // 단어 집합 겹침 비율로 유사도 측정
    var divWords = divText.split(/\s+/).filter(function(w){ return w.length > 1; });
    var origWords = origText.split(/\s+/).filter(function(w){ return w.length > 1; });
    if(!divWords.length || !origWords.length) return;
    var origSet = {};
    origWords.forEach(function(w){ origSet[w] = true; });
    var overlap = 0;
    divWords.forEach(function(w){ if(origSet[w]) overlap++; });
    var score = overlap / Math.max(divWords.length, origWords.length);
    if(score > bestScore){ bestScore = score; best = oc; }
  });
  // 최소 30% 이상 겹쳐야 매칭으로 인정
  return bestScore >= 0.3 ? best : null;
};

Division.copyText = function(elementId){
  var el = document.getElementById(elementId); if(!el) return;
  navigator.clipboard.writeText(el.innerText||el.textContent).then(function(){ showToast('복사되었습니다'); }).catch(function(){ showToast('복사 실패','error'); });
};
