// 12. Checkpoint 3: 조립
// ═══════════════════════════════════════════
Division.runAssemble = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;
  try {
    App.setButtonLoading('btnDivisionAssemble',true);
    App.showProgress('divisionAssembleProgress','청구항 조립 중...',1,3);
    var selected = Division.state.unusedComponents.filter(function(uc){ return uc.user_selection==='selected'||(uc.user_selection==='pending'&&uc.risk_level==='safe'); });
    // S1: 단락번호 미지정 구성 경고
    var noSource = selected.filter(function(uc){ return !uc.paragraph_number || String(uc.paragraph_number).trim() === ''; });
    if(noSource.length > 0){
      var names = noSource.map(function(uc){ return '"'+(uc.content||'').substring(0,30)+'..."'; }).join(', ');
      showToast('⚠️ 명세서 단락번호가 없는 구성 '+noSource.length+'건: '+names+' — 신규사항 위험에 주의하세요.', 'info');
    }
    var claims = Division.state.claims;
    var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
    if(!basisClaim) basisClaim = claims.find(function(c){ return c.claim_type==='independent'; });
    if(!basisClaim){ showToast('기초 청구항을 찾을 수 없습니다','error'); App.setButtonLoading('btnDivisionAssemble',false); return; }
    var depCandidates = claims.filter(function(c){ return c.division_role==='dep_candidate'; });
    var assemblePrompt = Division._buildAssemblePrompt(basisClaim, selected, depCandidates, Division.state.indepCount||1, Division.state.depCount);
    var result = await Division.callAI(assemblePrompt);
    if(result.stopReason === 'max_tokens'){
      console.warn('[Division] 조립 응답 max_tokens 잘림, 이어쓰기 시도');
      showToast('응답이 잘려 이어쓰기 중...', 'info');
      var contPrompt = '이전 응답이 잘렸다. 아래 JSON을 이어서 완성하라. 중복 없이 잘린 지점부터 이어쓰라.\n\n' + result.text.substring(result.text.length - 500);
      var cont = await Division.callAI(contPrompt);
      result.text = result.text + (cont.text || '');
    }
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 조립 중 프로젝트 전환됨'); App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false); return; }
    App.showProgress('divisionAssembleProgress','결과 저장 중...',2,3);
    var assembled;
    try { assembled = Division._extractJSON(result.text); }
    catch(e) { showToast('조립 결과 해석 실패: ' + e.message.substring(0,80),'error'); App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false); return; }
    await sb.from('division_claims_output').delete().eq('project_id',p.id);
    if(assembled.division_claims && assembled.division_claims.length > 0){
      var rows = assembled.division_claims.map(function(dc){
        // ** 마크다운 마커 제거 — claim_text는 순수 텍스트만
        var cleanText = (dc.claim_text||'').replace(/\*{2,3}/g,'');
        return { project_id:p.id, claim_number:dc.claim_number, claim_type:dc.claim_type||'independent', parent_claim_number:dc.parent_claim_number||null, claim_text:cleanText, claim_text_highlighted:dc.claim_text_highlighted||dc.claim_text||'', version:1 };
      });
      // T9 메타데이터를 메모리에 보관 (UI용)
      Division.state._assembledMeta = {
        claims: assembled.division_claims.map(function(dc){
          return { claim_number:dc.claim_number, basis_preserved:dc.basis_preserved, added_components:dc.added_components||[] };
        }),
        new_matter_check: assembled.new_matter_check || ''
      };

      // DB INSERT — 실제 테이블 컬럼만 사용
      Division._log('[Division] ── claims_output INSERT 디버그 ──');
      Division._log('[Division] INSERT 행 수:', rows.length);
      Division._log('[Division] INSERT 컬럼:', Object.keys(rows[0]));
      Division._log('[Division] 첫 행 샘플:', JSON.stringify(rows[0]).substring(0, 500));
      rows.forEach(function(r,i){ Division._log('[Division] 행'+i+' claim_number:'+r.claim_number+' type:'+r.claim_type+' text길이:'+(r.claim_text||'').length); });

      var {error:claimErr} = await sb.from('division_claims_output').insert(rows);
      if(claimErr){
        console.error('[Division] claims_output INSERT 실패:', claimErr.message, claimErr.details, claimErr.code);
        // 행별 폴백
        var saved = 0;
        for(var ci=0; ci<rows.length; ci++){
          Division._log('[Division] 행별 시도 '+ci+':', JSON.stringify(rows[ci]).substring(0, 300));
          var {error:rowErr} = await sb.from('division_claims_output').insert(rows[ci]);
          if(rowErr){ console.error('[Division] 행 '+ci+' 실패:', rowErr.message, rowErr.details); }
          else { saved++; }
        }
        Division._log('[Division] 행별 결과:', saved+'/'+rows.length+'건 성공');
      } else {
        Division._log('[Division] claims_output INSERT 성공:', rows.length, '건');
      }
    }
    var updateData = { status:'assembled', updated_at:new Date().toISOString() };
    // title_candidates는 JSONB 컬럼이 있으면 저장, 없으면 무시
    if(assembled.title_candidates){
      // suggestedTitles에 저장 — 이후 재조립/검증 화면에서 활용
      Division.state.suggestedTitles = assembled.title_candidates;
      try {
        await sb.from('division_projects').update({ title_candidates:assembled.title_candidates }).eq('id',p.id);
        p.title_candidates = assembled.title_candidates;
      } catch(e){ console.warn('[Division] title_candidates 저장 실패 (컬럼 미존재?):', e.message); p.title_candidates = assembled.title_candidates; }
    }
    await sb.from('division_projects').update(updateData).eq('id',p.id);
    p.status = 'assembled'; if(assembled.title_candidates) p.title_candidates = assembled.title_candidates;
    App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false);
    showToast('조립 완료! 초안을 검토해 주세요.');
    Division.state.currentStepKey = 'assemble'; // 조립 결과 화면으로 이동
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false); showToast('조립 실패: '+e.message,'error'); }
};

Division._buildAssemblePrompt = function(basisClaim, selectedComponents, depCandidates, indepCount, depCount){
  var basisText = basisClaim ? (basisClaim.amended_text||basisClaim.original_text||'') : '(기초 청구항 없음)';
  var compList = selectedComponents.map(function(uc){
    var cd = uc.component_data || {};
    return '- 내용: '+uc.content+'\n  삽입위치: '+uc.insertion_point+'\n  유형: '+uc.limitation_type +
      '\n  근거단락: 【'+uc.paragraph_number+'】' +
      (cd.spec_source_text ? '\n  명세서원문: "'+cd.spec_source_text.substring(0,200)+'"' : '');
  }).join('\n');
  var depList = depCandidates.map(function(c){ return '제'+c.claim_number+'항: '+((c.amended_text||c.original_text||'').substring(0,1000)); }).join('\n\n');
  var p = Division.state.current;
  var divType = p ? p.division_type : 'merge';
  indepCount = indepCount || 1;
  var depInstr = depCount === 0 ? '종속항 없이 독립항만 작성' : depCount > 0 ? '각 독립항에 종속항 '+depCount+'개씩 작성' : '각 독립항에 적절한 수의 종속항을 자동 구성 (원출원 종속항 후보 활용)';

  // T3: 공통 원칙 주입
  var principles = Division.DIVISION_PRINCIPLES;

  var claimCountRule = '\n\n★★★ 청구항 구성 지시 ★★★\n- 독립항: 정확히 ' + indepCount + '개 작성\n- 종속항: ' + depInstr + '\n- 청구항 번호는 1부터 연번\n';

  // T9/T10/T11: 3유형 공통 품질 규칙 (명세서 기반 검증 강화)
  var qualityRules = '\n\n[품질 규칙 — 3유형 공통]\n' +
    '1. 추상적 표현 금지: "신속하게","효과적으로","최적의" → 구체적 수치/구조로 대체\n' +
    '2. 기능적 기재 최소화: "~하기 위한 수단" → 구조적 표현\n' +
    '3. "상기" 일관 사용, 세미콜론(;), 말미 마침표(.)\n' +
    '4. claim_text에는 마크다운 없이 순수 텍스트만\n' +
    '5. claim_text_highlighted에만 표시 (**부가**, **변환**)\n' +
    '6. 최종 점검: 조립된 청구항의 모든 구성이 원출원 명세서에 있는지 재확인\n' +
    '\n[명칭 규칙]\n' +
    '- 명칭에 포함하는 기술적 특징은 반드시 조립된 독립항에 실제로 기재된 표현이어야 한다\n' +
    '- 청구항에 없는 특징을 명칭에 넣지 마라\n' +
    '- 국문/영문 각 2개 후보 제안\n' +
    '- 각 후보에 reason(제안 근거)과 based_on_element(독립항 내 해당 표현 원문 인용)를 포함하라\n' +
    '\n★★★ 원출원 명세서에 기재되지 않은 내용은 절대 포함하지 마라 ★★★\n';

  // 이전 조립에서 생성된 명칭 후보가 있으면 참고 정보로 전달
  var suggestedBlock = '';
  var suggested = Division.state.suggestedTitles;
  if(suggested && suggested.length > 0){
    suggestedBlock = '\n[이전 명칭 후보 — 참고용]\n사용자가 이전에 검토한 명칭 후보이다. 이 명칭과 일관된 title_candidates를 생성하라:\n';
    suggested.forEach(function(t){ suggestedBlock += '- ' + t.ko + ' / ' + t.en + '\n'; });
  }

  // T9/T10/T11: 공통 출력 스키마 — basis_preserved, added_components, new_matter_check 추가
  var outputSchema = '{"division_claims":[{"claim_number":1,"claim_type":"independent|dependent",' +
    '"parent_claim_number":null,"claim_text":"순수텍스트","claim_text_highlighted":"변경표시",' +
    '"basis_preserved":true,"added_components":[{"content":"추가된 D 내용","paragraph_number":"0098","limitation_type":"structural"}]}],' +
    '"new_matter_check":"신규사항 확인 결과 요약 (모든 구성의 명세서 뒷받침 여부)",' +
    '"title_candidates":[{"ko":"국문명칭","en":"English Title","reason":"이 명칭을 제안한 근거","based_on_element":"명칭의 근거가 된 청구항 내 표현 원문 인용"}]}';

  // T10: 카테고리변경형
  if(divType === 'category_change'){
    var meta = p.analysis_meta || {};
    return principles +
      '\n\n이것은 "카테고리 변경형" 분할출원 조립이다.\n' +
      '목적: 등록 청구항의 기술적 내용(A+B+C)을 보존하면서, 방법↔장치 카테고리를 전환한다.\n' +
      '★ 변환 시 명세서에 없는 구성요소명(~부, ~수단)을 임의로 생성하지 마라.\n' +
      '★ 변환된 각 구성요소명이 명세서에 실제 기재되어 있어야 한다.\n' +
      '★ A+B+C의 기술적 내용을 보존하라 (형태만 방법↔장치 전환).\n' +
      '\n[등록 청구항 (basis) — '+(meta.original_category==='method'?'방법':'장치')+']\n'+basisText+
      '\n\n[변환 방향]\n'+(meta.original_category==='method'?'방법 → 장치':'장치 → 방법')+
      '\n\n[변환에 활용할 구성]\n'+(compList||'(없음)')+
      '\n\n[종속항 후보]\n'+(depList||'(없음)')+
      claimCountRule+
      '\n조립 규칙:\n' +
      '1. 방법→장치: "~하는 단계"→"~하는 ~부/수단" (명세서 기재 구성요소명만 사용), 말미 "~을 포함하는 [장치명]."\n' +
      '2. 장치→방법: "~부/수단"→"~하는 단계", 말미 "~을 포함하는 방법."\n' +
      '3. ★ 변환 시 추가되는 구성요소명은 반드시 명세서에 기재된 것만 사용\n' +
      '4. 명칭: [명칭 규칙] 참조 — reason + based_on_element 필수\n' +
      '5. basis_preserved: 기술적 내용 보존 여부 (true/false)\n' +
      '6. added_components: 변환 과정에서 추가된 구성 (각각 명세서 단락번호 포함)\n' +
      qualityRules+ suggestedBlock +
      '\n★★★ JSON만 출력. ★★★\n\n출력: ' + outputSchema;
  }

  // T11: 전략형
  if(divType === 'strategic'){
    var themes = (p.analysis_meta && p.analysis_meta.themes) || [];
    var selectedThemes = [];
    try { var themeCheckboxes = document.querySelectorAll('[data-theme-id]:checked');
      themeCheckboxes.forEach(function(cb){ var tid=cb.dataset.themeId; var t=themes.find(function(x){return x.theme_id===tid;}); if(t) selectedThemes.push(t); });
    } catch(e){}
    if(!selectedThemes.length && themes.length > 0) selectedThemes = themes.slice(0, indepCount);
    var themesDesc = selectedThemes.map(function(t){
      return '테마: '+t.theme_name+'\n설명: '+t.description+
        '\n핵심: '+(t.key_elements||[]).join(', ')+
        '\n근거단락: '+(t.spec_paragraphs||[]).map(function(s){return '【'+s+'】';}).join(' ');
    }).join('\n\n');

    return principles +
      '\n\n이것은 "전략형" 분할출원 조립이다.\n' +
      '목적: 등록 청구항과 다른 관점의 새로운 독립항을 명세서 범위 내에서 작성한다.\n' +
      '★ 신규사항 추가 위험이 가장 높은 유형이다.\n' +
      '★ 새 독립항의 모든 구성요소에 명세서 단락번호 1:1 대응이 필수이다.\n' +
      '★ 명세서에 기재되지 않은 구성은 절대 포함하지 마라.\n' +
      '\n[등록 청구항 (basis — 참고용)]\n'+basisText+
      '\n\n[선택된 테마]\n'+(themesDesc||'(없음)')+
      '\n\n[활용 구성]\n'+(compList||'(없음)')+
      '\n\n[종속항 후보]\n'+(depList||'(없음)')+
      claimCountRule+
      '\n조립 규칙:\n' +
      '1. 테마별 새 독립항 — 기존 등록 청구항과 다른 관점으로 작성\n' +
      '2. ★ 모든 구성요소에 명세서 단락번호 대응 필수 (added_components에 paragraph_number 기재)\n' +
      '3. ★ basis를 참고하되 직접 복사하지 않음 — "원출원 범위 내" 확인\n' +
      '4. 명칭: [명칭 규칙] 참조 — reason + based_on_element 필수\n' +
      '5. basis_preserved: 전략형은 false (새 독립항이므로)\n' +
      '6. added_components: 독립항의 모든 구성요소를 나열 (각각 명세서 단락번호 포함)\n' +
      '7. new_matter_check: 각 구성의 명세서 뒷받침 여부를 요약\n' +
      qualityRules+ suggestedBlock +
      '\n★★★ JSON만 출력. ★★★\n\n출력: ' + outputSchema;
  }

  // 병합형 (merge) — D의 출처는 오직 unused_components(명세서 기재 + 청구항 미기재)만
  return principles +
    '\n\n이것은 "병합형" 분할출원 조립이다.\n' +
    '목적: 등록 청구항(A+B+C)을 그대로 유지하면서, 명세서에만 기재되어 있고\n' +
    '기존 어떤 청구항(종속항 포함)에도 없었던 구성(D)을 추가하여 A+B+C+D로 출원한다.\n' +
    '★★★ 등록결정 구성(A+B+C)은 한 글자도 수정·삭제하지 마라. ★★★\n' +
    '★★★ D는 오직 아래 [선택된 부가 구성]에서만 가져온다. 기존 종속항의 내용을 독립항에 병합하지 마라. ★★★\n' +
    '\n[등록 청구항 (basis) — 이 구성을 한 글자도 변경하지 말 것]\n'+basisText+
    '\n\n[선택된 부가 구성 (D) — 명세서에만 기재, 기존 청구항 미포함]\n'+(compList||'(없음)')+
    '\n\n[종속항 후보]\n'+(depList||'(없음)')+
    claimCountRule+
    '\n조립 규칙:\n' +
    '1. ★★★ basis 원문 보존: 등록 청구항(A+B+C)을 독립항 앞부분에 원문 그대로 기재. 절대 수정 금지.\n' +
    '2. D 삽입: structural→명칭앞 형용구, material→재질병기, shape→형상추가, functional→뒤에부가\n' +
    '3. 종속항: dep_candidate→"제1항에 있어서," 변환, 번호재매핑\n' +
    '4. 명칭: 국문/영문 각 2개\n' +
    '5. basis_preserved: basis 원문이 독립항에 그대로 포함되었는지 (true/false)\n' +
    '6. added_components: 추가된 D 목록 (각각 content, paragraph_number, limitation_type 포함)\n' +
    '7. new_matter_check: 모든 D의 명세서 뒷받침 확인 요약\n' +
    qualityRules+ suggestedBlock +
    '\n★★★ JSON만 출력. {로 시작 }로 끝. ★★★\n\n출력: ' + outputSchema;
};

// ═══════════════════════════════════════════
// 13. Checkpoint 3 화면: 초안 검토
// ═══════════════════════════════════════════
Division.renderAssemble = function(left, right, p){
  var divClaims = Division.state.divisionClaims;
  var origClaims = Division.state.claims;
  var basisClaim = origClaims.find(function(c){ return c.division_role==='basis'; }) || origClaims.find(function(c){ return c.claim_type==='independent'; });

  // === 왼쪽: 등록 청구항 vs 분할출원 청구항 비교 ===
  var h = '';

  if(!divClaims.length){
    h += '<div class="card" style="padding:20px;text-align:center;color:var(--color-text-tertiary)">조립된 청구항이 없습니다.</div>';
  } else {
    // 독립항 비교
    var divIndeps = divClaims.filter(function(c){ return c.claim_type==='independent'; });
    divIndeps.forEach(function(dc){
      var registeredText = basisClaim ? (basisClaim.amended_text || basisClaim.original_text || '') : '';
      var divText = (dc.claim_text || '').replace(/\*{2,3}/g, ''); // ** 마커 제거

      // 단어 단위 diff 생성
      var diffResult = Division._wordDiff(registeredText, divText);

      h += '<div class="division-compare">';
      h += '<div class="division-compare-header"><span class="ico" data-icon="scales"></span> 청구항 ' + dc.claim_number + ' 비교 (독립항)';
      h += '<span style="margin-left:auto;font-size:11px;font-weight:400;color:var(--color-text-tertiary)">추가 ' + diffResult.addedCount + ' / 삭제 ' + diffResult.removedCount + '</span>';
      h += '</div>';
      h += '<div class="division-compare-titles">';
      h += '<div class="division-compare-col-title original"><span class="ico" data-icon="doc"></span> 등록 청구항 (원본)</div>';
      h += '<div class="division-compare-col-title division"><span class="ico" data-icon="split"></span> 분할출원 청구항 (신규)</div>';
      h += '</div>';
      h += '<div class="division-compare-body">';
      h += '<div class="division-compare-col">' + escapeHtml(Division._formatClaimText(registeredText)) + '</div>';
      h += '<div class="division-compare-col">' + diffResult.html + '</div>';
      h += '</div></div>';
    });

    // 종속항 목록
    var divDeps = divClaims.filter(function(c){ return c.claim_type==='dependent'; });
    if(divDeps.length > 0){
      h += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="link"></span> 종속항 (' + divDeps.length + '항)</div>';
      divDeps.forEach(function(dc){
        var divCleanText = (dc.claim_text || '').replace(/\*{2,3}/g, '');

        // 원본 종속항 찾기: 텍스트 유사도 기반 매칭 (번호 불일치 가능)
        var origDep = Division._findBestOrigMatch(dc, origClaims);

        h += '<div class="division-claim-block">';
        h += '<div class="division-claim-header">';
        h += '<span style="font-weight:700;color:var(--color-primary)">【청구항 ' + dc.claim_number + '】</span>';
        h += '<span class="division-claim-type-tag">종속항 → 제' + (dc.parent_claim_number||1) + '항</span>';
        h += '</div>';
        h += '<div class="division-claim-body" style="white-space:pre-wrap">' + escapeHtml(Division._formatClaimText(divCleanText)) + '</div>';
        if(origDep){
          h += '<details style="margin-top:8px"><summary style="font-size:11px;color:var(--color-text-tertiary);cursor:pointer">원본 제' + origDep.claim_number + '항 보기</summary>';
          h += '<div style="font-size:12px;line-height:1.7;padding:8px;background:var(--dt-g50);border-radius:4px;margin-top:4px">' + escapeHtml(origDep.amended_text || origDep.original_text || '') + '</div>';
          h += '</details>';
        }
        h += '</div>';
      });
      h += '</div>';
    }
  }

  left.innerHTML = h;

  // === 오른쪽: 변경사항 요약 + 범례 + 버튼 ===
  var indepCnt = divClaims.filter(function(c){ return c.claim_type==='independent'; }).length;
  var depCnt = divClaims.filter(function(c){ return c.claim_type==='dependent'; }).length;

  var rh = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="chart"></span> 변경사항 요약</div>';
  rh += '<div class="division-summary-grid">';
  rh += '<div class="division-summary-item"><div class="division-summary-num">' + indepCnt + '</div><div class="division-summary-label">독립항</div></div>';
  rh += '<div class="division-summary-item"><div class="division-summary-num">' + depCnt + '</div><div class="division-summary-label">종속항</div></div>';
  rh += '<div class="division-summary-item"><div class="division-summary-num">' + divClaims.length + '</div><div class="division-summary-label">총 청구항</div></div>';
  rh += '</div></div>';

  // 범례
  rh += '<div class="card" style="padding:14px;margin-top:12px"><div style="font-size:12px;font-weight:600;margin-bottom:8px">🖍️ 색상 범례</div>';
  rh += '<div style="font-size:12px;line-height:2">';
  rh += '<span class="division-diff-added" style="padding:2px 8px">초록 배경</span> 부가/병합/변환된 구성 (원본에 없던 내용)<br>';
  rh += '<span style="padding:2px 8px;background:var(--dt-g50);border:1px solid var(--dt-g150);border-radius:2px">회색 배경</span> 원본 유지 부분';
  rh += '</div></div>';

  rh += '<div id="divisionVerifyProgress" style="margin-top:12px"></div>';
  rh += '<div style="display:flex;gap:8px;margin-top:12px">';
  rh += '<button class="btn btn-ghost" onclick="Division.goToStep(\'analyze\')" style="flex:1;padding:12px"><span class="ico" data-icon="refresh"></span> 재조립 (구성 선택)</button>';
  rh += '<button class="btn btn-primary" id="btnDivisionVerify" onclick="Division.runVerify()" style="flex:1;padding:12px"><span class="ico" data-icon="check-circle"></span> 검증 실행</button></div>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 14. Checkpoint 4: 검증
// ═══════════════════════════════════════════
Division.runVerify = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;
  try {
    App.setButtonLoading('btnDivisionVerify',true);
    App.showProgress('divisionVerifyProgress','명세서 전문 추출 중...',1,4);

    // 1) 분할출원 청구항 텍스트
    var divClaims = Division.state.divisionClaims;
    var claimsText = divClaims.map(function(dc){ return '【청구항 '+dc.claim_number+'】\n'+dc.claim_text; }).join('\n\n');

    // 2) 명세서 전문 로드 (유틸 함수 사용)
    var specText = await Division._loadSpecText(p);

    // 3) 등록 청구항 (원본 대비 중복 체크용)
    var origClaimsText = Division.state.claims.map(function(c){
      return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text||'').substring(0,1000);
    }).join('\n');

    // T14: Pass 1 — 코드 레벨 자동 검증
    App.showProgress('divisionVerifyProgress','자동 검증 (Pass 1) 실행 중...',2,5);
    var basisClaim = Division.state.claims.find(function(c){ return c.division_role==='basis'; }) ||
      Division.state.claims.find(function(c){ return c.claim_type==='independent'; });
    var autoIssues = Division.runAutoVerify(divClaims, basisClaim, Division.state.claims, specText, p.division_type);
    Division._log('[Division] Pass 1 완료:', autoIssues.length, '건');

    // T14: Pass 2 — LLM 의미 검증 (Pass 1 결과와 무관하게 항상 실행)
    App.showProgress('divisionVerifyProgress','AI 검증 (Pass 2) 분석 중...',3,5);
    var verifyPrompt = Division._buildVerifyPrompt(claimsText, specText, origClaimsText);
    var result = await Division.callAI(verifyPrompt);
    if(result.stopReason === 'max_tokens'){
      console.warn('[Division] 검증 응답 max_tokens 잘림, 이어쓰기 시도');
      var contPrompt = '이전 응답이 잘렸다. 아래 JSON을 이어서 완성하라.\n\n' + result.text.substring(result.text.length - 500);
      var cont = await Division.callAI(contPrompt);
      result.text = result.text + (cont.text || '');
    }
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 검증 중 프로젝트 전환됨'); App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false); return; }
    App.showProgress('divisionVerifyProgress','결과 저장 중...',4,5);
    var verified;
    try { verified = Division._extractJSON(result.text); }
    catch(e) { showToast('검증 결과 해석 실패: ' + e.message.substring(0,80),'error'); App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false); return; }

    // T14: DB 저장 — Pass 1 (auto_verify_issues) + Pass 2 (result_data) 통합
    var VALID_CHECK = ['new_matter','basis_scope','double_patenting','spec_support','support','format','abstract_expression','functional_limitation','overlap'];
    var VALID_RESULT = ['pass','warning','fail'];
    var sEnum = Division._sanitizeEnum;

    // Pass 1 결과를 메모리에 보관 (UI 렌더링용)
    Division.state._autoVerifyIssues = autoIssues;

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
      var {error:valErr} = await sb.from('division_validation_results').insert(rows);
      if(valErr){
        // spec_quote/support_type 컬럼 미존재 폴백
        var isColumnErr = /column.*does not exist|Could not find.*column|schema cache/i.test(valErr.message||'');
        if(isColumnErr){
          console.warn('[Division] spec_quote/support_type 컬럼 미존재 — 폴백 재시도');
          var legacyRows = rows.map(function(r){ var c = Object.assign({}, r); delete c.spec_quote; delete c.support_type; return c; });
          var {error:legacyErr} = await sb.from('division_validation_results').insert(legacyRows);
          if(legacyErr){
            console.error('[Division] 검증 결과 저장 실패 (폴백):', legacyErr.message);
            for(var vi=0;vi<legacyRows.length;vi++){
              var {error:re}=await sb.from('division_validation_results').insert(legacyRows[vi]);
              if(re) console.warn('[Division] 검증 행 '+vi+' 실패:', re.message);
            }
          }
        } else {
          console.error('[Division] 검증 결과 저장 실패:', valErr.message);
          for(var vi=0;vi<rows.length;vi++){
            var {error:re}=await sb.from('division_validation_results').insert(rows[vi]);
            if(re) console.warn('[Division] 검증 행 '+vi+' 실패:', re.message);
          }
        }
      }
    } else {
      // Pass 2 결과가 없을 때 빈 결과 저장
      if(autoIssues.length > 0){
        await sb.from('division_validation_results').insert({
          project_id:p.id, check_type:'format', result:'pass', detail:'LLM 검증 결과 없음'
        });
      }
    }
    await sb.from('division_projects').update({status:'verified', updated_at:new Date().toISOString()}).eq('id',p.id);
    p.status = 'verified';
    App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false);
    showToast('검증 완료!');
    Division.state.currentStepKey = 'verify';
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false); showToast('검증 실패: '+e.message,'error'); }
};

// ═══ T12: Pass 1 — 코드 레벨 자동 검증 (LLM 호출 전) ═══
/**
 * 3유형 공통으로 사용. divisionType에 따라 일부 검증 항목 분기.
 * @returns {Array} issues [{severity, check, message, detail}]
 */
Division.runAutoVerify = function(divisionClaims, basisClaim, allOriginalClaims, specFullText, divisionType){
  var issues = [];
  var basisText = basisClaim ? (basisClaim.amended_text || basisClaim.original_text || '') : '';

  // ─── [검증 1] basis 보존 확인 (유형별 분기) ───
  // 병합형: A+B+C 절대 보존 (CRITICAL)
  if(divisionType === 'merge'){
    divisionClaims.filter(function(c){ return c.claim_type === 'independent'; }).forEach(function(c){
      if(basisText && basisText.length > 20){
        var refParts = basisText.match(/[가-힣a-zA-Z]+\s*[\(\(]\s*\d+\s*[\)\)]/g) || [];
        var nouns = (basisText.match(/[가-힣]{3,}/g) || []).filter(function(kw){
          return Division.STOPWORDS.indexOf(kw) < 0;
        });
        var checkItems = [], seen = {};
        refParts.forEach(function(rp){
          var key = rp.replace(/\s/g,'');
          if(!seen[key]){ seen[key]=true; checkItems.push(key); }
        });
        nouns.forEach(function(n){
          var stem = Division._stripKoreanSuffix(n);
          if(stem.length < 2) return;
          if(!seen[stem]){ seen[stem]=true; checkItems.push(stem); }
        });
        if(checkItems.length > 0){
          var claimTextNoSpace = c.claim_text.replace(/\s/g,'');
          var missing = checkItems.filter(function(item){
            return claimTextNoSpace.indexOf(item) < 0;
          });
          var ratio = 1 - (missing.length / checkItems.length);
          if(ratio < Division.THRESHOLDS.BASIS_PRESERVATION){
            issues.push({ severity:'CRITICAL', check:'basis_preservation',
              message:'독립항 '+c.claim_number+'에서 basis 핵심 구성요소 보존율 '+Math.round(ratio*100)+'%',
              detail:'미발견('+missing.length+'/'+checkItems.length+'): '+missing.slice(0,5).join(', ')+(missing.length>5?' 외 '+(missing.length-5)+'개':'')
            });
          } else if(ratio < Division.THRESHOLDS.BASIS_WARN && missing.length > 0){
            issues.push({ severity:'MEDIUM', check:'basis_preservation',
              message:'독립항 '+c.claim_number+'에서 basis 일부 변경 가능성 (보존율 '+Math.round(ratio*100)+'%)',
              detail:'미발견: '+missing.join(', ')
            });
          }
        }
      }
    });
  }

  // 카테고리변경형: 기술적 내용 보존 (키워드 보존율, HIGH) — 조사/어미 무시
  if(divisionType === 'category_change'){
    divisionClaims.filter(function(c){ return c.claim_type === 'independent'; }).forEach(function(c){
      if(basisText){
        var stemMap = {};
        (basisText.match(/[가-힣]{3,}/g) || []).forEach(function(kw){
          if(Division.STOPWORDS.indexOf(kw) >= 0) return;
          var stem = Division._stripKoreanSuffix(kw);
          if(stem.length < 2 || Division.STOPWORDS.indexOf(stem) >= 0) return;
          stemMap[stem] = true;
        });
        var basisKw = Object.keys(stemMap);
        if(basisKw.length > 0){
          var preserved = basisKw.filter(function(kw){ return c.claim_text.indexOf(kw) >= 0; });
          var ratio = preserved.length / basisKw.length;
          if(ratio < Division.THRESHOLDS.CATEGORY_PRESERVATION){
            issues.push({ severity:'HIGH', check:'basis_preservation',
              message:'독립항 '+c.claim_number+'의 기술적 내용 보존율 '+Math.round(ratio*100)+'%',
              detail:'카테고리 변환 시 기술적 내용의 '+Math.round(Division.THRESHOLDS.CATEGORY_PRESERVATION*100)+'% 이상이 보존되어야 합니다'
            });
          }
        }
      }
    });
  }

  // 전략형: basis 보존 검사 비적용 — 대신 원출원 명세서 범위 내 검사 강화 (조사/어미 무시 + 중복 제거)
  if(divisionType === 'strategic' && specFullText && specFullText.length > 100){
    divisionClaims.forEach(function(dc){
      var rawKw = (dc.claim_text.match(/[가-힣]{3,}/g) || []);
      var stemSet = {};
      rawKw.forEach(function(kw){
        if(Division.STOPWORDS.indexOf(kw) >= 0) return;
        var stem = Division._stripKoreanSuffix(kw);
        if(stem.length < 2 || Division.STOPWORDS.indexOf(stem) >= 0) return;
        stemSet[stem] = true;
      });
      var meaningful = Object.keys(stemSet);
      var missing = meaningful.filter(function(kw){ return !Division._isKeywordInSpec(kw, specFullText); });
      // 전략형은 더 엄격: 미발견 임계값 이상이면 경고
      if(missing.length > Division.THRESHOLDS.COMPONENT_MISSING_KW){
        issues.push({ severity:'HIGH', check:'spec_scope_strategic',
          message:'전략형 청구항 '+dc.claim_number+'에 명세서 미발견 용어 '+missing.length+'개',
          detail:'미발견: '+missing.slice(0,5).join(', ')+(missing.length>5?' 외 '+(missing.length-5)+'개':'')
        });
      }
    });
  }

  // ─── [검증 2] 이중 특허 방지 (3유형 공통) ───
  divisionClaims.forEach(function(dc){
    allOriginalClaims.forEach(function(oc){
      var ocText = oc.amended_text || oc.original_text || '';
      var sim = Division._lcsRatio(dc.claim_text, ocText);
      if(sim > Division.THRESHOLDS.DOUBLE_PATENTING){
        issues.push({
          severity: 'HIGH', check: 'double_patenting',
          message: '분할 청구항 ' + dc.claim_number + '이 원출원 청구항 ' + oc.claim_number + '과 ' + Math.round(sim*100) + '% 동일',
          detail: '이중 특허 위험 — 추가 구성(D)이 충분히 차별화되지 않았습니다'
        });
      }
    });
  });

  // ─── [검증 3] 신규사항 위험 — 키워드 기반 (조사/어미 무시 + 중복 제거) ───
  if(specFullText && specFullText.length > 100){
    divisionClaims.forEach(function(dc){
      var keywords = (dc.claim_text.match(/[가-힣]{2,}/g) || []);
      var stemSet = {};
      keywords.forEach(function(kw){
        if(Division.STOPWORDS.indexOf(kw) >= 0 || kw.length < 3) return;
        var stem = Division._stripKoreanSuffix(kw);
        if(stem.length < 2 || Division.STOPWORDS.indexOf(stem) >= 0) return;
        stemSet[stem] = true;
      });
      var meaningful = Object.keys(stemSet);
      var missing = meaningful.filter(function(kw){ return !Division._isKeywordInSpec(kw, specFullText); });
      if(missing.length > Division.THRESHOLDS.CLAIM_MISSING_KW){
        issues.push({
          severity: 'HIGH', check: 'new_matter_risk',
          message: '청구항 ' + dc.claim_number + '에 명세서 미발견 용어 ' + missing.length + '개',
          detail: '미발견: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ' 외 ' + (missing.length-5) + '개' : '')
        });
      }
    });
  } else {
    issues.push({
      severity: 'MEDIUM', check: 'spec_missing',
      message: '명세서 전문이 없거나 너무 짧아 신규사항 키워드 검사를 수행할 수 없습니다',
      detail: 'spec_full_text 길이: ' + (specFullText ? specFullText.length : 0) + '자'
    });
  }

  // ─── [검증 4] 추가 구성(D) 교차 확인 (draft_data.added_components 있을 때) ───
  divisionClaims.forEach(function(dc){
    var dd = dc.draft_data || {};
    if(dd.added_components && dd.added_components.length){
      dd.added_components.forEach(function(comp){
        allOriginalClaims.forEach(function(oc){
          var ocText = oc.amended_text || oc.original_text || '';
          var sim = Division._lcsRatio(comp.content || '', ocText);
          if(sim > Division.THRESHOLDS.COMPONENT_OVERLAP){
            issues.push({
              severity: 'MEDIUM', check: 'component_overlap',
              message: '추가 구성 "' + (comp.content||'').slice(0,20) + '..."이 기존 청구항 ' + oc.claim_number + '과 ' + Math.round(sim*100) + '% 유사',
              detail: '이중 특허 위험 검토 필요'
            });
          }
        });
      });
    }
  });

  // ─── [검증 5] 종속항 인용 관계 검사 (3유형 공통) ───
  var claimNums = divisionClaims.map(function(c){ return c.claim_number; });
  divisionClaims.forEach(function(dc){
    if(dc.claim_type === 'dependent'){
      if(!dc.parent_claim_number){
        issues.push({
          severity: 'MEDIUM', check: 'dependency_format',
          message: '종속항 ' + dc.claim_number + '의 인용 청구항 번호가 없습니다',
          detail: 'parent_claim_number가 null'
        });
      } else if(claimNums.indexOf(dc.parent_claim_number) < 0){
        issues.push({
          severity: 'HIGH', check: 'dependency_format',
          message: '종속항 ' + dc.claim_number + '이 존재하지 않는 청구항 ' + dc.parent_claim_number + '을 인용',
          detail: '유효한 청구항 번호: ' + claimNums.join(', ')
        });
      }
    }
  });

  Division._log('[Division] Pass 1 자동 검증 완료:', issues.length, '건 이슈');
  return issues;
};

// ═══ T13: Pass 2 — LLM 검증 프롬프트 강화 ═══
Division._buildVerifyPrompt = function(claimsText, specText, origClaimsText){
  var principles = Division.DIVISION_PRINCIPLES;
  var p = Division.state.current;
  var divType = p ? p.division_type : 'merge';

  // 유형별 추가 검증 지시
  var typeSpecific = '';
  if(divType === 'merge'){
    typeSpecific = '\n[유형별 검증 — 병합형]\n' +
      '- basis 보존: 등록결정 청구항(A+B+C)이 독립항에 원문 그대로 포함되었는지 확인\n' +
      '- 추가 구성(D)만 명세서 뒷받침 여부 중점 확인\n';
  } else if(divType === 'category_change'){
    typeSpecific = '\n[유형별 검증 — 카테고리변경형]\n' +
      '- 변환 구성요소명(~부, ~수단)이 명세서에 실제 기재되어 있는지 확인\n' +
      '- A+B+C의 기술적 내용이 변환 후에도 보존되었는지 확인\n';
  } else if(divType === 'strategic'){
    typeSpecific = '\n[유형별 검증 — 전략형]\n' +
      '- 새 독립항의 모든 구성요소에 명세서 단락번호 1:1 대응이 있는지 확인\n' +
      '- 원출원 범위를 초과하는 신규사항이 없는지 특히 엄격하게 확인\n';
  }

  // V9: 실질적 뒷받침 판단 기준
  var supportGuidelines =
    '\n[뒷받침 판단 기준 — 실무 수준]\n\n' +
    '"뒷받침된다"는 것은 동일한 단어가 명세서에 있다는 것이 아니다.\n' +
    '명세서의 기술적 내용이 해당 청구항 구성을 실질적으로 설명하고 있으면 뒷받침이 인정된다.\n\n' +
    '판단 절차:\n' +
    '1. 청구항의 각 구성요소를 분리한다\n' +
    '2. 각 구성요소에 대해 명세서에서 대응하는 기술적 설명을 찾는다\n' +
    '3. 대응 관계를 판단한다:\n' +
    '   - "direct" (직접 기재): 명세서에 동일/거의 동일한 표현 있음 → pass\n' +
    '   - "substantial" (실질적 뒷받침): 표현은 다르지만 동일 기술적 개념 → pass\n' +
    '     (근거 단락번호 + 대응 설명 기재)\n' +
    '   - "derivable" (자명한 도출): 명세서 내용에서 당업자가 도출 가능 → warning\n' +
    '     (근거 단락번호 + 도출 논리 기재)\n' +
    '   - "none" (근거 없음): 명세서에 대응하는 기술적 내용 없음 → fail\n\n' +
    '예시:\n' +
    '- 청구항 "정합성 검증부" vs 명세서 "무결성 확인 모듈"\n' +
    '  → pass (substantial, 동일 기술적 개념)\n' +
    '- 청구항 "딥러닝 기반 분석부" vs 명세서 "기계학습 모델을 활용한 분석"\n' +
    '  → warning (derivable, 딥러닝⊂기계학습이지만 명세서가 딥러닝을 특정하지 않음)\n' +
    '- 청구항 "블록체인 인증 모듈" vs 명세서에 블록체인 언급 없음\n' +
    '  → fail (none, 신규사항)\n\n' +
    '★ 단순 키워드 매칭으로 "용어가 다르다"고 바로 fail 처리하면 안 됨\n' +
    '★ 명세서에서 동일한 기술적 개념을 다른 표현으로 설명하는 경우를 반드시 인식하라\n';

  return principles +
    typeSpecific +
    supportGuidelines +
    '\n아래 분할출원 청구항에 대해 검증을 수행하라.\n' +
    '\n[분할출원 청구항]\n'+claimsText+
    '\n\n[원출원 등록 청구항 (중복 체크 대상)]\n'+(origClaimsText||'(없음)')+
    '\n\n[명세서 전문]\n'+(specText||'(없음)').substring(0,40000)+
    '\n\n검증 항목 — 우선순위순 (3유형 공통):\n' +
    '1순위 [CRITICAL] new_matter (신규사항 검증):\n' +
    '  - 분할 청구항의 모든 구성이 원출원 명세서에 직접 기재된 사항인지 확인\n' +
    '  - 명세서에 없는 용어/개념이 포함되어 있으면 fail\n' +
    '  - 각 구성에 대해 해당 명세서 단락번호를 특정하라\n' +
    '2순위 [CRITICAL] basis_scope (basis 보존 / 원출원 범위 내 검증):\n' +
    '  - 병합형: basis 원문이 독립항에 그대로 보존되었는지\n' +
    '  - 카테고리변경형: 기술적 내용이 보존되었는지\n' +
    '  - 전략형: 모든 구성이 원출원 명세서 범위 내인지\n' +
    '3순위 [HIGH] double_patenting (이중 특허 방지):\n' +
    '  - 분할 독립항이 원출원 등록 청구항과 실질적으로 동일하면 안 됨\n' +
    '  - 추가/변환/신규 부분이 실질적 차이를 만드는지 확인\n' +
    '4순위 [HIGH] spec_support (뒷받침 검증):\n' +
    '  - 위의 [뒷받침 판단 기준]을 적용하여 각 구성요소를 검증\n' +
    '  - support_type을 반드시 기재 (direct/substantial/derivable/none)\n' +
    '  - spec_quote로 명세서 원문 30자 이내 발췌\n' +
    '5순위 [MEDIUM] format (형식 검증):\n' +
    '  - 마침표(.) 누락, "상기" 일관성, 종속항 인용 정확성\n' +
    '  - 추상적 표현, 기능적 기재 존재 여부\n' +
    '\n★ 검증은 반드시 구체적 target_text(해당 구절)를 포함하여 어디가 문제인지 특정하라.\n' +
    '★ 각 결과에 명세서 근거 단락번호(spec_paragraph_number)를 반드시 포함하라.\n' +
    '\n★★★ JSON만 출력. ★★★\n\n출력 JSON:\n' +
    '{"overall":"pass|warning|fail","results":[{' +
    '"check_type":"new_matter|basis_scope|double_patenting|spec_support|format",' +
    '"target_text":"검증 대상 청구항 구절",' +
    '"result":"pass|warning|fail",' +
    '"detail":"구체적 분석 (명세서 단락 인용 포함)",' +
    '"suggestion":"수정 제안",' +
    '"spec_paragraph_number":"근거 명세서 단락번호",' +
    '"spec_quote":"명세서 근거 원문 30자 이내 발췌",' +
    '"support_type":"direct|substantial|derivable|none"}]}';
};

// ═══════════════════════════════════════════
