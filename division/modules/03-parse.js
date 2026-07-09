// 8. Checkpoint 1: 파싱
// ═══════════════════════════════════════════
Division.runParse = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;
  try {
    App.setButtonLoading('btnDivisionParse', true);
    App.showProgress('divisionProgress', '파일 텍스트 추출 중...', 1, 5);
    var fileTexts = {};
    var files = Division.state.files;
    for(var i = 0; i < files.length; i++){
      var f = files[i];
      App.showProgress('divisionProgress', f.file_type + ' 텍스트 추출...', i+1, files.length + 3);
      try {
        var {data:blob, error:dlErr} = await sb.storage.from('division-files').download(f.storage_path);
        if(dlErr) throw dlErr;
        var buf = await blob.arrayBuffer();
        var text = await App.extractPdfText(buf);
        fileTexts[f.file_type] = text;
      } catch(e) { console.warn('[Division] 파일 추출 실패:', f.file_type, e); fileTexts[f.file_type] = ''; }
    }
    // 직접 입력 모드: direct_claims_text를 fileTexts에 주입
    if(p.input_mode === 'direct' && p.direct_claims_text){
      fileTexts._direct_claims = p.direct_claims_text;
    }
    App.showProgress('divisionProgress', 'AI 파싱 분석 중...', files.length + 1, files.length + 3);
    var parsePrompt = Division._buildParsePrompt(fileTexts, p);
    var result = await Division.callAI(parsePrompt);

    // 프로젝트 전환 감지
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 파싱 중 프로젝트 전환됨 — 결과 폐기'); App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return; }

    // 응답 잘림 감지
    if(result.stopReason === 'max_tokens'){
      console.warn('[Division] 파싱 응답이 max_tokens로 잘림. 응답 길이:', result.text.length);
      showToast('응답이 길어 잘렸습니다. 재시도 중...', 'info');
      // 잘린 경우: 텍스트 입력 축소 후 재시도
      var shorterPrompt = Division._buildParsePrompt(fileTexts, p, true); // shortened=true
      result = await Division.callAI(shorterPrompt);
    }

    App.showProgress('divisionProgress', '결과 저장 중...', files.length + 2, files.length + 3);
    var parsed;
    try { parsed = Division._extractJSON(result.text); }
    catch(e) {
      console.error('[Division] JSON 추출 실패:', e.message);
      showToast('파싱 결과 해석 실패: ' + e.message.substring(0, 80), 'error');
      App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return;
    }
    // ── 데이터 정제(sanitize) + DB 저장 ──
    var VALID_CLAIM_TYPE = ['independent','dependent'];
    var VALID_REJ = ['rejected','not_rejected'];
    var VALID_AMD = ['amended','deleted','maintained'];
    var VALID_ROLE = ['basis','merge_candidate','dep_candidate','excluded','included_in_basis','product_claim'];
    var sanitize = Division._sanitizeEnum;

    var claimsSaved = false;
    if(parsed.claims && parsed.claims.length > 0){
      // 1) 행 데이터 정제
      var claimRows = [];
      parsed.claims.forEach(function(c, idx){
        if(!c || !c.claim_number) return; // 빈 항목 무시
        claimRows.push({
          project_id: p.id,
          claim_number: parseInt(c.claim_number) || (idx+1),
          claim_type: sanitize(c.claim_type, VALID_CLAIM_TYPE, 'independent'),
          parent_claim_number: c.parent_claim_number ? parseInt(c.parent_claim_number) : null,
          original_text: String(c.original_text || c.text || '(파싱 실패)').substring(0, 50000),
          amended_text: c.amended_text ? String(c.amended_text).substring(0, 50000) : null,
          rejection_status: sanitize(c.rejection_status, VALID_REJ, 'not_rejected'),
          amendment_status: sanitize(c.amendment_status, VALID_AMD, 'maintained'),
          division_role: sanitize(c.division_role, VALID_ROLE, 'dep_candidate')
        });
      });

      // 2) 중복 claim_number 제거
      var seen = {};
      claimRows = claimRows.filter(function(r){ if(seen[r.claim_number]) return false; seen[r.claim_number]=true; return true; });

      // 3) 기초(basis) 자동 지정: 등록 청구항 = 독립항 중 가장 먼저 나오는 항
      //    보정서가 있으면 amended_text가 최종본, 없으면 original_text가 최종본
      var hasBasis = claimRows.some(function(r){ return r.division_role === 'basis'; });
      if(!hasBasis){
        // 독립항 중 첫 번째를 basis로 자동 지정
        for(var bi = 0; bi < claimRows.length; bi++){
          if(claimRows[bi].claim_type === 'independent'){
            claimRows[bi].division_role = 'basis';
            Division._log('[Division] 기초 청구항 자동 지정: 제' + claimRows[bi].claim_number + '항');
            break;
          }
        }
      }

      Division._log('[Division] 저장할 청구항:', claimRows.length, '건');
      Division._log('[Division] 첫 행 샘플:', JSON.stringify(claimRows[0]).substring(0, 300));

      // 4) DB 저장 (배치 → 실패 시 행별 폴백)
      await sb.from('division_claims_parsed').delete().eq('project_id', p.id);
      var {error:batchErr} = await sb.from('division_claims_parsed').insert(claimRows);

      if(batchErr){
        console.warn('[Division] 배치 INSERT 실패, 행별 삽입 시도:', batchErr.message || batchErr.details);
        // 행별로 삽입 시도 — 실패한 행은 스킵
        var savedCount = 0;
        for(var ri = 0; ri < claimRows.length; ri++){
          var {error:rowErr} = await sb.from('division_claims_parsed').insert(claimRows[ri]);
          if(rowErr){
            console.error('[Division] 행 ' + ri + ' 실패:', rowErr.message || rowErr.details, '데이터:', JSON.stringify(claimRows[ri]).substring(0, 200));
          } else { savedCount++; }
        }
        if(savedCount === 0){
          showToast('청구항 DB 저장 전체 실패. 콘솔을 확인해 주세요.', 'error');
          App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return;
        }
        showToast(savedCount + '/' + claimRows.length + '건 저장 (일부 실패)', 'info');
        claimsSaved = true;
      } else {
        claimsSaved = true;
      }
    }

    // 단락 저장
    if(parsed.paragraphs && parsed.paragraphs.length > 0){
      await sb.from('division_spec_paragraphs').delete().eq('project_id', p.id);
      var paraRows = [];
      var seenPara = {};
      parsed.paragraphs.forEach(function(para){
        var num = String(para.number || para.paragraph_number || '0000').replace(/[^0-9]/g, '').substring(0, 10);
        if(!num || seenPara[num]) return;
        seenPara[num] = true;
        paraRows.push({ project_id: p.id, paragraph_number: num, content: String(para.content || '').substring(0, 50000) });
      });
      if(paraRows.length > 0){
        var {error:paraErr} = await sb.from('division_spec_paragraphs').insert(paraRows);
        if(paraErr) console.warn('[Division] 단락 저장 실패 (무시):', paraErr.message);
      }
    }

    if(!claimsSaved){
      showToast('파싱된 청구항이 없습니다. 문서를 확인해 주세요.', 'error');
      App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return;
    }

    // T2: 명세서 전문(spec_full_text) 1회 저장 — 이후 분석·조립·검증에서 재사용
    var specFullText = fileTexts['application'] || fileTexts['specification'] || '';
    if(!specFullText){
      // 출원서 파일이 없으면 모든 파일 텍스트를 합산
      Object.keys(fileTexts).forEach(function(k){ if(k !== '_direct_claims' && fileTexts[k]) specFullText += fileTexts[k] + '\n'; });
    }
    if(specFullText){
      var {error:specErr} = await sb.from('division_projects').update({spec_full_text: specFullText}).eq('id', p.id);
      if(specErr) console.warn('[Division] spec_full_text 저장 실패 (무시):', specErr.message);
      else Division._log('[Division] spec_full_text 저장 완료:', specFullText.length, '글자');
      p.spec_full_text = specFullText;
    }

    // 원출원 발명의 명칭 추출 → original_title_ko 저장
    if(!p.original_title_ko && specFullText){
      var titleMatch = specFullText.match(/【발명의\s*명칭】\s*([^\n【]+)/);
      if(!titleMatch) titleMatch = specFullText.match(/\[발명의\s*명칭\]\s*([^\n\[]+)/);
      if(!titleMatch) titleMatch = specFullText.match(/발명의\s*명칭\s*[:\s]\s*([^\n]{5,80})/);
      if(titleMatch){
        var extractedTitle = titleMatch[1].trim().replace(/\s+/g,' ');
        Division._log('[Division] 원출원 명칭 추출:', extractedTitle);
        try {
          await sb.from('division_projects').update({original_title_ko: extractedTitle}).eq('id', p.id);
          p.original_title_ko = extractedTitle;
        } catch(e){ console.warn('[Division] original_title_ko 저장 실패:', e.message); p.original_title_ko = extractedTitle; }
      } else {
        console.warn('[Division] 원출원 명칭 추출 실패 — 【발명의 명칭】 패턴 미발견');
      }
    }

    await sb.from('division_projects').update({status:'parsed', updated_at: new Date().toISOString()}).eq('id', p.id);
    p.status = 'parsed';
    App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false);
    showToast('파싱 완료! 결과를 확인해 주세요.');
    Division.state.currentStepKey = 'parse'; // 파싱 결과 화면으로 이동
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); showToast('파싱 실패: ' + e.message, 'error'); }
};

Division._buildParsePrompt = function(fileTexts, p, shortened){
  var appLimit = shortened ? 15000 : 30000;
  var notiLimit = shortened ? 5000 : 10000;
  var opnLimit = shortened ? 5000 : 10000;
  var amdLimit = shortened ? 8000 : 15000;
  var paraInstruction = shortened
    ? '6. 명세서 단락은 생략하라 (paragraphs: []). 청구항만 파싱.\n'
    : '6. 명세서 단락은 【NNNN】 패턴으로 분리. 단, content는 각 단락의 첫 200자만 포함.\n';

  // 직접 입력 모드
  if(p.input_mode === 'direct' && fileTexts._direct_claims){
    return '아래 한국 특허 출원서와 최종 등록 청구항을 분석하여 구조화된 JSON으로 파싱하라.\n\n[특허출원서 (명세서 포함)]\n' + (fileTexts.application || '(없음)').substring(0, appLimit) + '\n\n[최종 등록 청구항 (사용자 직접 입력)]\n' + fileTexts._direct_claims.substring(0, 15000) + '\n\n※ 이 건은 의견제출통지서 없이 등록결정된 건입니다. 모든 청구항은 거절 이력이 없습니다.\n\n★★★ 반드시 JSON만 출력하라. 설명·인사·마크다운 없이 { 로 시작하고 } 로 끝나는 순수 JSON만. ★★★\n\n출력 JSON 형식:\n{"claims":[{"claim_number":1,"claim_type":"independent|dependent","parent_claim_number":null,"original_text":"등록 청구항 원문","amended_text":null,"rejection_status":"not_rejected","amendment_status":"maintained","division_role":"basis|dep_candidate|product_claim"}],"paragraphs":[{"number":"0001","content":"단락 첫200자"}],"reference_symbols":[{"name":"장치하우징","number":"100"}],"warnings":[]}\n\n파싱 규칙:\n1. 【청구항 N】 패턴으로 청구항 분리\n2. "제N항에 있어서" → dependent, parent=N\n3. 거절 이력 없음 → 모든 rejection_status="not_rejected", amendment_status="maintained"\n4. 독립항 중 가장 넓은 범위를 가진 항 → basis\n5. 나머지 독립항 → product_claim 또는 dep_candidate\n6. 종속항 → dep_candidate\n' + paraInstruction;
  }

  // 전체 문서 업로드 모드
  return '아래 한국 특허 문서들을 분석하여 구조화된 JSON으로 파싱하라.\n\n[특허출원서]\n' + (fileTexts.application || '(없음)').substring(0, appLimit) + '\n\n[의견제출통지서]\n' + (fileTexts.notification || '(없음)').substring(0, notiLimit) + '\n\n[의견서]\n' + (fileTexts.opinion || '(없음)').substring(0, opnLimit) + '\n\n[보정서]\n' + (fileTexts.amendment || '(없음)').substring(0, amdLimit) + '\n\n★★★ 반드시 JSON만 출력하라. 설명·인사·마크다운 없이 { 로 시작하고 } 로 끝나는 순수 JSON만. ★★★\n\n출력 JSON 형식:\n{"claims":[{"claim_number":1,"claim_type":"independent|dependent","parent_claim_number":null,"original_text":"원문","amended_text":"보정후(정정된경우)","rejection_status":"rejected|not_rejected","amendment_status":"amended|deleted|maintained","division_role":"basis|merge_candidate|dep_candidate|excluded|included_in_basis|product_claim"}],"paragraphs":[{"number":"0001","content":"단락 첫200자"}],"reference_symbols":[{"name":"장치하우징","number":"100"}],"warnings":[]}\n\n파싱 규칙:\n1. 【청구항 N】 패턴으로 청구항 분리\n2. "제N항에 있어서" → dependent, parent=N\n3. 통지서에서 거절 대상 청구항 추출 → rejection_status\n4. 보정서에서 정정/삭제/유지 상태 추출 → amendment_status\n5. division_role 자동 분류: 거절+정정(병합포함)→basis, 미지적+유지→merge_candidate, 거절+유지→dep_candidate, 삭제(다른항병합)→included_in_basis\n' + paraInstruction + '7. 구성요소명(참조번호) 패턴 추출';
};

// ═══════════════════════════════════════════
// 9. Checkpoint 1 화면: 파싱 결과
// ═══════════════════════════════════════════
Division.renderParse = function(left, right, p){
  var claims = Division.state.claims;

  // === 왼쪽: 청구항 분류 매트릭스 + 등록 청구항 전문 ===
  var h = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="chart"></span> 청구항 분류 매트릭스</div>';
  if(claims.length === 0){ h += '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">파싱된 청구항이 없습니다.</div>'; }
  else {
    h += '<table class="division-matrix-table"><thead><tr><th>청구항</th><th>거절</th><th>보정</th><th>분할 역할</th></tr></thead><tbody>';
    claims.forEach(function(c){
      var rejLabel = c.rejection_status==='rejected'?'거절':'미지적';
      var rejCss = c.rejection_status==='rejected'?'rej-yes':'rej-no';
      var amdLabel = c.amendment_status==='amended'?'정정':c.amendment_status==='deleted'?'삭제':'유지';
      var amdCss = c.amendment_status==='amended'?'amd-amended':c.amendment_status==='deleted'?'amd-deleted':'amd-maintained';
      var roleLabels = {basis:'기초',merge_candidate:'병합 후보',dep_candidate:'종속항 후보',excluded:'제외',included_in_basis:'기초에 포함됨',product_claim:'물건항 후보'};
      h += '<tr' + (c.amendment_status==='deleted'?' style="opacity:0.5"':'') + '><td style="font-weight:600">제' + c.claim_number + '항</td>';
      h += '<td><span class="division-rej-badge ' + rejCss + '">' + rejLabel + '</span></td>';
      h += '<td><span class="division-amd-badge ' + amdCss + '">' + amdLabel + '</span></td>';
      h += '<td><select class="division-role-select" data-claim-id="' + c.id + '" onchange="Division.updateClaimRole(this)">';
      ['basis','merge_candidate','dep_candidate','excluded','included_in_basis','product_claim'].forEach(function(role){
        h += '<option value="' + role + '"' + (c.division_role===role?' selected':'') + '>' + (roleLabels[role]||role) + '</option>';
      });
      h += '</select></td></tr>';
    });
    h += '</tbody></table>';
  }
  h += '</div>';

  // 등록 청구항 전문 (삭제 제외, 전체 표시)
  var activeClaims = claims.filter(function(c){ return c.amendment_status !== 'deleted'; });
  if(activeClaims.length > 0){
    h += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="doc"></span> 최종 등록 청구항 전문 <span style="font-size:11px;font-weight:400;color:var(--color-text-tertiary)">(삭제항 제외 ' + activeClaims.length + '항)</span></div>';
    activeClaims.forEach(function(c, idx){
      var registeredText = c.amended_text || c.original_text || '';
      var isBasis = c.division_role === 'basis';
      var source = c.amended_text ? '보정' : '원문';
      var roleLabels = {basis:'기초',merge_candidate:'병합후보',dep_candidate:'종속후보',excluded:'제외',included_in_basis:'기초포함',product_claim:'물건항'};

      h += '<div class="division-registered-claim' + (isBasis ? ' expanded' : '') + '" id="regClaim_' + idx + '">';
      h += '<div class="claim-header" onclick="document.getElementById(\'regClaim_'+idx+'\').classList.toggle(\'expanded\')">';
      h += '<span style="font-weight:700;color:' + (isBasis?'var(--color-primary)':'var(--color-text-primary)') + '">【청구항 ' + c.claim_number + '】</span>';
      h += '<span class="division-amd-badge amd-' + (c.amendment_status||'maintained') + '">' + source + '</span>';
      if(isBasis) h += '<span style="font-size:10px;padding:1px 6px;border-radius:var(--radius-full);background:var(--color-primary-light);color:var(--color-primary);font-weight:600">★ 기초</span>';
      else h += '<span style="font-size:10px;color:var(--color-text-tertiary)">' + (roleLabels[c.division_role]||'') + '</span>';
      h += '<span style="margin-left:auto;font-size:11px;color:var(--color-text-tertiary)">▼</span>';
      h += '</div>';
      h += '<div class="claim-text">' + escapeHtml(Division._formatClaimText(registeredText)) + '</div>';
      if(registeredText.length > 100) h += '<span class="claim-toggle" onclick="document.getElementById(\'regClaim_'+idx+'\').classList.toggle(\'expanded\')">▼ 전문 보기 / 접기</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  left.innerHTML = h;

  // === 오른쪽: 기초 청구항 요약 + 승인 버튼 ===
  var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
  if(!basisClaim) basisClaim = claims.find(function(c){ return c.claim_type==='independent'; });

  var rh = Division._renderTypeSwitch(p.division_type);
  rh += '<div class="card" style="padding:16px">';
  rh += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="flag"></span> 분할출원 기초 청구항</div>';
  if(basisClaim){
    var regText = basisClaim.amended_text || basisClaim.original_text || '';
    rh += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:8px">제' + basisClaim.claim_number + '항 | ' + (basisClaim.amended_text ? '보정 후 확정본' : '원출원 그대로') + '</div>';
    rh += '<div style="background:var(--color-bg-tertiary);padding:12px;border-radius:var(--radius-sm);font-size:13px;line-height:1.8;white-space:pre-wrap;max-height:250px;overflow-y:auto">' + escapeHtml(Division._formatClaimText(regText)) + '</div>';
  } else {
    rh += '<div style="text-align:center;padding:16px;color:var(--color-text-tertiary)">독립항이 파싱되지 않았습니다.</div>';
  }
  rh += '</div>';

  // 파싱 요약 통계
  var statCounts = { total:claims.length, deleted:claims.filter(function(c){return c.amendment_status==='deleted';}).length, amended:claims.filter(function(c){return c.amendment_status==='amended';}).length, basis:claims.filter(function(c){return c.division_role==='basis';}).length };
  rh += '<div class="card" style="padding:14px;margin-top:12px"><div style="font-size:13px;line-height:1.8;color:var(--color-text-secondary)">';
  rh += '전체 청구항: <strong>' + statCounts.total + '</strong>항<br>';
  rh += '정정(보정): <strong>' + statCounts.amended + '</strong>항 | 삭제: <strong>' + statCounts.deleted + '</strong>항<br>';
  rh += '기초 청구항: <strong>' + statCounts.basis + '</strong>항';
  rh += '</div></div>';

  rh += '<div style="display:flex;gap:8px;margin-top:12px">';
  rh += '<button class="btn btn-ghost" onclick="Division.rerunParse()" style="flex:1;padding:12px"><span class="ico" data-icon="refresh"></span> 재파싱</button>';
  rh += '<button class="btn btn-primary" onclick="Division.confirmParse()" style="flex:1;padding:12px"><span class="ico" data-icon="check-circle"></span> 파싱 승인 → 분석</button></div>';
  rh += '<div style="margin-top:8px;padding:10px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);font-size:12px;color:var(--color-text-tertiary)"><span class="ico" data-icon="warning"></span> 파싱 결과가 정확한지 확인 후 승인을 눌러주세요. 역할은 드롭다운으로 수정 가능합니다.</div>';
  right.innerHTML = rh;
};

Division.updateClaimRole = async function(sel){
  var id = sel.dataset.claimId, role = sel.value;
  try { await sb.from('division_claims_parsed').update({division_role:role}).eq('id',id);
    var c = Division.state.claims.find(function(x){return x.id===id;}); if(c) c.division_role=role;
    Division.renderStay();
  } catch(e) { showToast('역할 변경 실패','error'); }
};
Division.confirmParse = async function(){
  var p = Division.state.current; if(!p) return;
  var claims = Division.state.claims;
  if(!claims || claims.length === 0){
    showToast('파싱된 청구항이 없습니다. 먼저 파싱을 실행해 주세요.', 'error'); return;
  }
  // 기초(basis) 미지정 시 자동 지정
  var hasBasis = claims.some(function(c){ return c.division_role === 'basis'; });
  if(!hasBasis){
    var firstIndep = claims.find(function(c){ return c.claim_type === 'independent'; });
    if(firstIndep){
      await sb.from('division_claims_parsed').update({division_role:'basis'}).eq('id', firstIndep.id);
      firstIndep.division_role = 'basis';
      showToast('제' + firstIndep.claim_number + '항을 기초 청구항으로 자동 지정했습니다.', 'info');
    }
  }
  showToast('파싱 승인 완료. 분석을 시작합니다.');
  Division.runAnalyze();
};
Division.rerunParse = function(){
  Division.state.currentStepKey = 'upload';
  Division.renderStay();
};

// ═══════════════════════════════════════════
