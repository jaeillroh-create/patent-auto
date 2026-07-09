// 4. 파이프라인 스테퍼
// ═══════════════════════════════════════════
Division.renderPipeline = function(p){
  var el = document.getElementById('divisionPipeline'); if(!el) return;
  var currentStep = Division.STATUS_TO_STEP[p.status] || 0;
  var h = '';
  Division.PIPELINE.forEach(function(step, i){
    var st = i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending';
    var clickable = st === 'done' || st === 'active';
    if(i > 0) h += '<div class="division-step-connector ' + (i <= currentStep ? 'done' : '') + '"></div>';
    h += '<div class="division-step ' + st + '"'
      + (clickable ? ' onclick="Division.goToStep(\'' + step.key + '\')" style="cursor:pointer"' : '') + '>'
      + '<div class="division-step-dot">' + (st === 'done' ? '✓' : step.icon) + '</div>'
      + '<span class="division-step-label">' + step.label + '</span></div>';
  });
  el.innerHTML = h;
};

Division.goToStep = function(stepKey){
  var p = Division.state.current; if(!p) return;
  Division.state.currentStepKey = stepKey; // 현재 보고 있는 단계 추적
  Division.renderMainForStep(p, stepKey);
};

// ═══════════════════════════════════════════
// 5. 메인 콘텐츠 분기
// ═══════════════════════════════════════════
Division.renderMain = function(p){
  var step = Division.STATUS_TO_STEP[p.status] || 0;
  var keys = ['upload','parse','analyze','assemble','verify','confirm'];
  var targetKey = Division.state.currentStepKey || keys[step] || 'upload';
  Division.state.currentStepKey = targetKey; // 추적
  Division.renderMainForStep(p, targetKey);
};

Division.renderMainForStep = function(p, stepKey){
  var left = document.getElementById('divisionDetailLeft');
  var right = document.getElementById('divisionDetailRight');
  if(!left || !right) return;
  switch(stepKey){
    case 'upload':  Division.renderUpload(left, right, p); break;
    case 'parse':   Division.renderParse(left, right, p); break;
    case 'analyze': Division.renderAnalyze(left, right, p); break;
    case 'assemble':Division.renderAssemble(left, right, p); break;
    case 'verify':  Division.renderVerify(left, right, p); break;
    case 'confirm': Division.renderConfirm(left, right, p); break;
    default:        Division.renderUpload(left, right, p); break;
  }
};

// ═══════════════════════════════════════════
// 6. 화면: 파일 업로드 (드래그앤드롭 + 이중 모드)
// ═══════════════════════════════════════════
Division.renderUpload = function(left, right, p){
  var files = Division.state.files;
  var inputMode = p.input_mode || 'full';

  var h = '';

  // 모드 토글
  h += '<div class="division-mode-toggle">';
  h += '<button class="division-mode-btn' + (inputMode==='full'?' active':'') + '" onclick="Division.switchInputMode(\'full\')"><span class="ico" data-icon="clipboard"></span> 문서 업로드</button>';
  h += '<button class="division-mode-btn' + (inputMode==='direct'?' active':'') + '" onclick="Division.switchInputMode(\'direct\')"><span class="ico" data-icon="edit"></span> 청구항 직접 입력</button>';
  h += '</div>';

  if(inputMode === 'full'){
    // ── 모드 A: 통합 드롭존 + 자동 분류 ──

    // 통합 드롭존 (여러 파일 한 번에)
    var allRequiredDone = ['application','notification','opinion','amendment'].every(function(ft){ return files.some(function(f){ return f.file_type===ft; }); });
    if(!allRequiredDone){
      h += '<div class="division-bulk-drop" id="divisionBulkDrop">';
      h += '<div class="division-bulk-drop-inner">';
      h += '<div style="font-size:32px;margin-bottom:8px"><span class="ico" data-icon="folder"></span></div>';
      h += '<div style="font-size:14px;font-weight:600;margin-bottom:4px">PDF 파일을 여기에 드래그하세요</div>';
      h += '<div style="font-size:12px;color:var(--color-text-tertiary)">출원서 · 통지서 · 의견서 · 보정서를 한번에 넣으면 자동 분류합니다</div>';
      h += '<div style="margin-top:12px"><label class="btn btn-outline btn-sm" style="cursor:pointer"><span class="ico" data-icon="doc"></span> 또는 파일 선택';
      h += '<input type="file" accept=".pdf" multiple style="display:none" onchange="Division.handleBulkFiles(event)" />';
      h += '</label></div>';
      h += '</div></div>';
    }

    // 분류된 파일 목록
    h += '<div class="card" style="padding:16px;' + (allRequiredDone ? '' : 'margin-top:12px') + '">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="folder"></span> 파일 분류 결과</div>';

    ['application','notification','opinion','amendment','prior_art','decision'].forEach(function(ft){
      var info = Division.FILE_TYPES[ft];
      var uploaded = files.find(function(f){ return f.file_type === ft; });
      var isRequired = info.required;

      if(uploaded){
        h += '<div class="division-file-row-uploaded">';
        h += '<span class="division-file-icon">' + info.icon + '</span>';
        h += '<div class="division-file-info"><div class="division-file-label">' + info.label + (isRequired?' <span style="color:var(--color-error);font-size:10px">필수</span>':'') + '</div>';
        h += '<div class="division-file-name">' + escapeHtml(uploaded.file_name || '') + '</div></div>';
        // 유형 변경 드롭다운
        h += '<select class="division-role-select" onchange="Division.reclassifyFile(\'' + uploaded.id + '\',this.value)" style="font-size:11px">';
        ['application','notification','opinion','amendment','prior_art','decision'].forEach(function(opt){
          h += '<option value="' + opt + '"' + (opt===ft?' selected':'') + '>' + Division.FILE_TYPES[opt].label + '</option>';
        });
        h += '</select>';
        h += '<button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + uploaded.id + '\')" style="font-size:10px;color:var(--color-error);padding:4px 8px"><span class="ico" data-icon="x"></span></button>';
        h += '</div>';
      } else if(isRequired) {
        h += '<div class="division-file-row-missing">';
        h += '<span class="division-file-icon" style="opacity:0.4">' + info.icon + '</span>';
        h += '<span class="division-file-label" style="color:var(--color-text-tertiary)">' + info.label + ' <span style="color:var(--color-error);font-size:10px">필수</span></span>';
        h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px"><span class="ico" data-icon="doc"></span> 선택';
        h += '<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'' + ft + '\')" /></label>';
        h += '</div>';
      }
    });
    h += '</div>';

    // 분류 중 상태
    h += '<div id="divisionClassifyStatus" style="margin-top:8px"></div>';

  } else {
    // ── 모드 B: 출원서 + 직접 입력 ──
    h += '<div class="card" style="padding:16px">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:4px"><span class="ico" data-icon="doc"></span> 특허출원서</div>';
    h += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:12px">명세서 원문이 포함된 출원서 PDF</div>';
    var appFile = files.find(function(f){ return f.file_type === 'application'; });
    if(appFile){
      h += '<div class="division-file-row-uploaded"><span class="division-file-icon"><span class="ico" data-icon="doc"></span></span>';
      h += '<div class="division-file-info"><div class="division-file-label">특허출원서</div><div class="division-file-name">' + escapeHtml(appFile.file_name||'') + '</div></div>';
      h += '<span class="division-file-check"><span class="ico" data-icon="check-circle"></span></span>';
      h += '<button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + appFile.id + '\')" style="font-size:10px;color:var(--color-error);padding:4px 8px"><span class="ico" data-icon="x"></span></button></div>';
    } else {
      h += '<div class="division-bulk-drop" id="divisionBulkDrop" style="padding:20px">';
      h += '<div class="division-bulk-drop-inner"><span class="ico" data-icon="doc"></span> <span style="font-size:13px">출원서 PDF 드래그 또는 </span>';
      h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px;margin-left:8px">선택<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'application\')" /></label>';
      h += '</div></div>';
    }
    h += '</div>';

    h += '<div class="card" style="padding:16px;margin-top:12px">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:4px"><span class="ico" data-icon="edit"></span> 최종 등록 청구항</div>';
    h += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:12px">등록결정 시 확정된 청구항 전문을 붙여넣으세요.</div>';
    h += '<textarea class="textarea-field" id="divisionDirectClaims" rows="12" placeholder="【청구항 1】\n생두의 수분 함량을...\n\n【청구항 2】\n제1항에 있어서,\n..." style="font-size:13px;line-height:1.7">' + escapeHtml(p.direct_claims_text || '') + '</textarea>';
    h += '<button class="btn btn-outline btn-sm" onclick="Division.saveDirectClaims()" style="margin-top:8px"><span class="ico" data-icon="save"></span> 저장</button>';
    h += '</div>';
  }

  // 선택 파일 (공통)
  h += '<div class="card" style="padding:16px;margin-top:12px">';
  h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="link"></span> 선택 파일</div>';
  h += '<label class="checkbox-label" style="margin-bottom:8px"><input type="checkbox" ' + (p.include_prior_art?'checked':'') + ' onchange="Division.togglePriorArt(this.checked)" /><span>인용발명 대비 분석 포함</span></label>';
  if(p.include_prior_art){
    var priorFile = files.find(function(f){ return f.file_type==='prior_art'; });
    h += '<div class="division-file-row" style="margin-left:20px"><span class="division-file-icon">📚</span><span class="division-file-label">인용발명 PDF</span>';
    if(priorFile){ h += '<span class="division-file-status uploaded"><span class="ico" data-icon="check-circle"></span></span><button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + priorFile.id + '\')" style="font-size:10px;color:var(--color-error)">삭제</button>'; }
    else { h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px"><span class="ico" data-icon="doc"></span> 선택<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'prior_art\')" /></label>'; }
    h += '</div>';
  }
  h += '</div>';
  left.innerHTML = h;

  // 통합 드롭존 이벤트 바인딩
  setTimeout(function(){
    var bulkZone = document.getElementById('divisionBulkDrop');
    if(bulkZone){
      bulkZone.addEventListener('dragover', function(e){ e.preventDefault(); e.stopPropagation(); bulkZone.classList.add('dragover'); });
      bulkZone.addEventListener('dragleave', function(e){ e.preventDefault(); e.stopPropagation(); bulkZone.classList.remove('dragover'); });
      bulkZone.addEventListener('drop', function(e){ e.preventDefault(); e.stopPropagation(); bulkZone.classList.remove('dragover'); Division.handleBulkDrop(e); });
    }
  }, 0);

  // === 오른쪽: 안내 + 파싱 ===
  var canParse = false;
  if(inputMode==='full'){
    canParse = ['application','notification','opinion','amendment'].every(function(ft){ return files.some(function(f){ return f.file_type===ft; }); });
  } else {
    canParse = files.some(function(f){ return f.file_type==='application'; }) && !!(p.direct_claims_text && p.direct_claims_text.trim());
  }

  var rh = '<div class="card" style="padding:20px">';
  rh += '<div style="font-size:16px;font-weight:700;margin-bottom:12px"><span class="ico" data-icon="split"></span> 분할출원 청구항 자동 작성</div>';
  rh += '<div style="font-size:13px;line-height:1.7;color:var(--color-text-secondary);margin-bottom:16px">';
  rh += inputMode==='full' ? '원출원 문서를 업로드하면, AI가 자동 분류·파싱·분석하고<br>분할출원에 적합한 새 청구항을 조립합니다.'
    : '출원서와 최종 등록 청구항을 입력하면,<br>AI가 분할출원 청구항을 구성합니다.';
  rh += '</div>';
  rh += '<div class="division-info-box"><div style="font-weight:600;margin-bottom:8px"><span class="ico" data-icon="clipboard"></span> 처리 단계</div>';
  rh += '<div style="font-size:12px;line-height:1.8;color:var(--color-text-secondary)">① 파싱 — 출원서·청구항 구조화<br>② 분석 — 미활용 구성 탐색 + 리스크 스크리닝<br>③ 조립 — 독립항/종속항 자동 구성<br>④ 검증 — 기재불비 + 형식 검증<br>⑤ 확정 — 발명 명칭 + 최종 출력</div></div>';
  rh += '<div id="divisionProgress" style="margin-top:12px"></div>';
  if(canParse){
    rh += '<button class="btn btn-primary btn-full" id="btnDivisionParse" onclick="Division.runParse()" style="margin-top:16px;padding:14px;font-size:14px"><span class="ico" data-icon="search"></span> 파싱 시작</button>';
  } else {
    var uploadedTypes = files.map(function(f){ return f.file_type; });
    var missing = ['application','notification','opinion','amendment'].filter(function(ft){ return uploadedTypes.indexOf(ft)<0; });
    var missingLabels = missing.map(function(ft){ return Division.FILE_TYPES[ft].label; }).join(', ');
    var msg = inputMode==='full' ? '⚠️ 미업로드: ' + (missingLabels||'없음') : '⚠️ 출원서 업로드 + 청구항 입력 필요';
    rh += '<div style="margin-top:16px;padding:12px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);text-align:center;font-size:13px;color:var(--color-text-tertiary)">' + msg + '</div>';
  }
  rh += '</div>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 6-1. 입력 모드 전환 + 직접 입력 저장
// ═══════════════════════════════════════════
Division.switchInputMode = async function(mode){
  var p = Division.state.current; if(!p) return;
  p.input_mode = mode;
  await sb.from('division_projects').update({input_mode: mode}).eq('id', p.id);
  Division.renderStay();
};

Division.saveDirectClaims = async function(){
  var p = Division.state.current; if(!p) return;
  var text = (document.getElementById('divisionDirectClaims')?.value || '').trim();
  if(!text){ showToast('청구항 텍스트를 입력해 주세요', 'error'); return; }
  await sb.from('division_projects').update({direct_claims_text: text, updated_at: new Date().toISOString()}).eq('id', p.id);
  p.direct_claims_text = text;
  showToast('저장되었습니다');
  Division.renderStay();
};

// ═══════════════════════════════════════════
// 7. 자동 분류 + 파일 업로드
// ═══════════════════════════════════════════

// PDF 텍스트 패턴 기반 자동 분류
Division.CLASSIFY_RULES = [
  { type:'application',  patterns:[/【발명의\s*명칭】/, /【특허청구범위】/, /【발명의\s*상세한\s*설명】/, /【요약서】/, /【도면의\s*간단한\s*설명】/], minMatch:2 },
  { type:'notification', patterns:[/의견제출통지서/, /거절이유통지서/, /특허법\s*제63조/, /거절이유를?\s*아래와?\s*같이/, /진보성이?\s*부정/], minMatch:1 },
  { type:'amendment',    patterns:[/【보정대상항목】/, /보정서/, /【보정방법】/, /【보정내용】/], minMatch:1 },
  { type:'opinion',      patterns:[/【의견내용】/, /의견서\s*$/, /위\s*거절이유에?\s*대하여/, /아래와?\s*같이\s*의견/], minMatch:1 },
  { type:'decision',     patterns:[/등록결정/, /특허결정/, /설정등록/, /등록사정/], minMatch:1 },
  { type:'prior_art',    patterns:[/인용발명/, /선행기술/, /비교대상발명/], minMatch:1 }
];

Division._classifyPdf = function(text){
  if(!text || text.length < 50) return 'unknown';
  var snippet = text.substring(0, 5000); // 첫 5000자로 판별
  var scores = {};
  Division.CLASSIFY_RULES.forEach(function(rule){
    var matchCount = 0;
    rule.patterns.forEach(function(pat){ if(pat.test(snippet)) matchCount++; });
    if(matchCount >= rule.minMatch) scores[rule.type] = matchCount;
  });
  // 가장 높은 매치 반환
  var best = null, bestScore = 0;
  for(var k in scores){ if(scores[k] > bestScore){ bestScore = scores[k]; best = k; } }
  return best || 'unknown';
};

// 여러 파일 한번에 드롭
Division.handleBulkDrop = function(e){
  var fileList = e.dataTransfer ? e.dataTransfer.files : [];
  if(!fileList || !fileList.length) return;
  var pdfFiles = [];
  for(var i = 0; i < fileList.length; i++){
    if(fileList[i].name.toLowerCase().endsWith('.pdf')) pdfFiles.push(fileList[i]);
  }
  if(!pdfFiles.length){ showToast('PDF 파일만 업로드 가능합니다','error'); return; }
  Division._classifyAndUpload(pdfFiles);
};

// input[multiple]에서 선택
Division.handleBulkFiles = function(e){
  var fileList = e.target.files;
  if(!fileList || !fileList.length) return;
  var pdfFiles = [];
  for(var i = 0; i < fileList.length; i++){
    if(fileList[i].name.toLowerCase().endsWith('.pdf')) pdfFiles.push(fileList[i]);
  }
  if(!pdfFiles.length){ showToast('PDF 파일만 업로드 가능합니다','error'); return; }
  Division._classifyAndUpload(pdfFiles);
};

// 핵심: 분류 → 업로드 → 화면 갱신
Division._classifyAndUpload = async function(pdfFiles){
  var p = Division.state.current; if(!p) return;
  var statusEl = document.getElementById('divisionClassifyStatus');
  if(statusEl) statusEl.innerHTML = '<div style="padding:10px;text-align:center;font-size:13px;color:var(--color-primary)"><span class="ico" data-icon="search"></span> ' + pdfFiles.length + '개 파일 분류 중...</div>';

  var results = []; // {file, type, confidence}

  for(var i = 0; i < pdfFiles.length; i++){
    var file = pdfFiles[i];
    if(statusEl) statusEl.innerHTML = '<div style="padding:10px;text-align:center;font-size:13px;color:var(--color-primary)"><span class="ico" data-icon="search"></span> ' + (i+1) + '/' + pdfFiles.length + ' 분류 중: ' + escapeHtml(file.name) + '</div>';

    try {
      // PDF 텍스트 추출 (첫 몇 페이지)
      var buf = await file.arrayBuffer();
      var text = await App.extractPdfText(buf);
      var classified = Division._classifyPdf(text);

      // 이미 해당 유형이 있으면 다른 유형으로 대체 시도
      var existingTypes = Division.state.files.map(function(f){ return f.file_type; });
      var alreadyQueued = results.map(function(r){ return r.type; });
      var taken = existingTypes.concat(alreadyQueued);

      if(classified !== 'unknown' && taken.indexOf(classified) >= 0){
        // 해당 유형이 이미 점유 → 다른 빈 유형 찾기
        var fallbackOrder = ['application','notification','opinion','amendment','prior_art','decision'];
        var found = false;
        for(var j = 0; j < fallbackOrder.length; j++){
          if(taken.indexOf(fallbackOrder[j]) < 0){ classified = fallbackOrder[j]; found = true; break; }
        }
        if(!found) classified = 'prior_art'; // 모두 차면 인용발명으로
      }

      if(classified === 'unknown'){
        // 미분류 → 빈 필수 슬롯 중 첫 번째
        var emptyRequired = ['application','notification','opinion','amendment'].filter(function(ft){ return taken.indexOf(ft) < 0; });
        classified = emptyRequired[0] || 'prior_art';
      }

      results.push({ file:file, type:classified });
      Division._log('[Division] 자동 분류:', file.name, '→', classified);
    } catch(e){
      console.warn('[Division] 분류 실패:', file.name, e);
      results.push({ file:file, type:'prior_art' }); // 실패하면 인용발명으로
    }
  }

  // 분류 결과 요약 토스트
  var summary = results.map(function(r){ return Division.FILE_TYPES[r.type].label; }).join(', ');
  showToast('분류 완료: ' + summary);

  // 순차 업로드
  for(var k = 0; k < results.length; k++){
    var r = results[k];
    if(statusEl) statusEl.innerHTML = '<div style="padding:10px;text-align:center;font-size:13px;color:var(--color-primary)"><span class="ico" data-icon="upload"></span> ' + (k+1) + '/' + results.length + ' 업로드 중: ' + escapeHtml(r.file.name) + '</div>';
    await Division._doUpload(r.file, r.type);
  }

  if(statusEl) statusEl.innerHTML = '';
  Division.renderStay();
};

// 파일 유형 재분류 (드롭다운 변경 시)
Division.reclassifyFile = async function(fileId, newType){
  try {
    await sb.from('division_files').update({file_type: newType}).eq('id', fileId);
    var file = Division.state.files.find(function(f){ return f.id === fileId; });
    if(file) file.file_type = newType;
    showToast(Division.FILE_TYPES[newType].label + '로 변경됨');
    Division.renderStay();
  } catch(e){ showToast('변경 실패','error'); }
};

// 개별 파일 업로드 (기존 호환)
Division.handleDragOver = function(e){ e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('dragover'); };
Division.handleDragLeave = function(e){ e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('dragover'); };
Division.handleDrop = function(e, fileType){ e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('dragover');
  var file = e.dataTransfer.files[0]; if(!file) return;
  if(!file.name.toLowerCase().endsWith('.pdf')){ showToast('PDF 파일만','error'); return; }
  Division._doUpload(file, fileType);
};
Division.uploadFile = async function(event, fileType){
  var file = event.target.files[0]; if(!file) return;
  if(!file.name.toLowerCase().endsWith('.pdf')){ showToast('PDF 파일만','error'); return; }
  Division._doUpload(file, fileType);
};

Division._doUpload = async function(file, fileType){
  var p = Division.state.current; if(!p) return;
  try {
    showToast('업로드 중...');
    var storagePath = 'division/' + p.id + '/' + fileType + '_' + Date.now() + '.pdf';
    var {error:uploadErr} = await sb.storage.from('division-files').upload(storagePath, file);
    if(uploadErr) throw uploadErr;
    var {data, error} = await sb.from('division_files').insert({ project_id:p.id, file_type:fileType, storage_path:storagePath, file_name:file.name, file_size:file.size }).select().single();
    if(error) throw error;
    Division.state.files.push(data);
    // 상태 전이: 입력 모드에 따라 필수 조건 다름
    var ready = false;
    if(p.input_mode === 'direct'){
      ready = Division.state.files.some(function(f){ return f.file_type==='application'; }) && !!(p.direct_claims_text && p.direct_claims_text.trim());
    } else {
      var requiredTypes = ['application','notification','opinion','amendment'];
      ready = requiredTypes.every(function(ft){ return Division.state.files.some(function(f){ return f.file_type === ft; }); });
    }
    if(ready && p.status === 'created'){
      await sb.from('division_projects').update({status:'uploaded', updated_at: new Date().toISOString()}).eq('id', p.id);
      p.status = 'uploaded';
    }
    showToast(Division.FILE_TYPES[fileType].label + ' 업로드 완료');
    Division.renderStay();
  } catch(e) { showToast('업로드 실패: ' + e.message, 'error'); }
};

Division.removeFile = async function(fileId){
  if(!confirm('파일을 삭제하시겠습니까?')) return;
  try {
    var file = Division.state.files.find(function(f){ return f.id === fileId; });
    if(file) await sb.storage.from('division-files').remove([file.storage_path]);
    await sb.from('division_files').delete().eq('id', fileId);
    Division.state.files = Division.state.files.filter(function(f){ return f.id !== fileId; });
    // 파싱 이후 상태에서 파일 삭제 시 상태 역전이 — uploaded로 리셋
    var p = Division.state.current;
    if(p && p.status !== 'created' && p.status !== 'uploaded'){
      await sb.from('division_projects').update({ status:'uploaded' }).eq('id', p.id);
      p.status = 'uploaded';
      // 파싱 결과도 초기화
      await sb.from('division_claims_parsed').delete().eq('project_id', p.id);
      await sb.from('division_spec_paragraphs').delete().eq('project_id', p.id);
      Division.state.claims = [];
      Division.state.specParagraphs = [];
    }
    showToast('파일 삭제됨'); Division.renderStay();
  } catch(e) { showToast('삭제 실패', 'error'); }
};

Division.togglePriorArt = async function(checked){
  var p = Division.state.current; if(!p) return;
  await sb.from('division_projects').update({include_prior_art: checked}).eq('id', p.id);
  p.include_prior_art = checked; Division.renderStay();
};

// ═══════════════════════════════════════════
