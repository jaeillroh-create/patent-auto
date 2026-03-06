/* ═══════════════════════════════════════════════════════════
   분할출원 청구항 자동 작성 v1.0 — division.js
   유형: 병합형 / 카테고리변경형(준비중) / 전략형(준비중)
   namespace: window.Division  |  DB: division_*  |  CSS: division-
   의존: common.js (App, sb, callClaude, showToast, escapeHtml 등)
   ═══════════════════════════════════════════════════════════ */
window.Division = window.Division || {};

// ═══ Constants ═══
Division.TYPES = {
  merge:           { code:'M', label:'청구항 병합형',     icon:'🔀', css:'dtype-merge',    desc:'등록항 + 미활용 구성 부가' },
  category_change: { code:'C', label:'카테고리 변경형',   icon:'🔄', css:'dtype-category', desc:'방법↔장치 전환', disabled:true },
  strategic:       { code:'S', label:'전략적 분할',       icon:'🎯', css:'dtype-strategic', desc:'새 독립항 구성', disabled:true }
};

Division.STATUS = {
  created:   { label:'생성됨',     css:'dstatus-created',   step:0 },
  uploaded:  { label:'업로드완료', css:'dstatus-uploaded',  step:1 },
  parsed:    { label:'파싱완료',   css:'dstatus-parsed',    step:2 },
  analyzed:  { label:'분석완료',   css:'dstatus-analyzed',  step:3 },
  assembled: { label:'조립완료',   css:'dstatus-assembled', step:4 },
  verified:  { label:'검증완료',   css:'dstatus-verified',  step:5 },
  confirmed: { label:'확정',       css:'dstatus-confirmed', step:6 },
  error:     { label:'오류',       css:'dstatus-error',     step:-1 }
};

Division.PIPELINE = [
  { key:'upload',   label:'파일 업로드',  icon:'📁' },
  { key:'parse',    label:'파싱',         icon:'🔍' },
  { key:'analyze',  label:'분석',         icon:'📊' },
  { key:'assemble', label:'조립',         icon:'🔧' },
  { key:'verify',   label:'검증',         icon:'✅' },
  { key:'confirm',  label:'확정',         icon:'🏁' }
];

Division.STEP_TO_STATUS = { upload:'uploaded', parse:'parsed', analyze:'analyzed', assemble:'assembled', verify:'verified', confirm:'confirmed' };
Division.STATUS_TO_STEP = { created:0, uploaded:1, parsed:2, analyzed:3, assembled:4, verified:5, confirmed:6 };

Division.FILE_TYPES = {
  application:  { label:'특허출원서',       icon:'📄', required:true },
  notification: { label:'의견제출통지서',   icon:'📨', required:true },
  opinion:      { label:'의견서',           icon:'📝', required:true },
  amendment:    { label:'보정서',           icon:'✏️', required:true },
  prior_art:    { label:'인용발명',         icon:'📚', required:false },
  decision:     { label:'등록결정서',       icon:'🏆', required:false }
};

Division.RISK_LABELS = {
  safe:    { label:'안전',   icon:'🟢', css:'risk-safe' },
  caution: { label:'주의',   icon:'🟡', css:'risk-caution' },
  danger:  { label:'위험',   icon:'🔴', css:'risk-danger' }
};

Division.SYS_PROMPT = '너는 대한민국 특허청(KIPO) 분할출원 실무에 정통한 15년 차 수석 변리사이다.\n원칙:\n1. 한국 특허법 제52조(분할출원)에 근거\n2. 원출원 명세서 범위 내에서만 청구항 구성\n3. 기재불비(§42③④) 회피를 최우선\n4. 특허청 표준 서식과 문체\n5. 구조화된 JSON 반환';

// ═══ State ═══
Division.state = {
  projects: [],
  current: null,
  view: 'list',
  files: [],
  claims: [],
  claimComponents: [],
  unusedComponents: [],
  divisionClaims: [],
  validationResults: [],
  specParagraphs: []
};

// ═══ Init ═══
Division.init = function(){
  console.log('[Division] init');
  Division.loadProjects();
};

// ═══════════════════════════════════════════
// 1. 프로젝트 목록
// ═══════════════════════════════════════════
Division.loadProjects = async function(){
  var el = document.getElementById('divisionProjectList');
  if(!el) return;
  try {
    var {data, error} = await sb.from('division_projects')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('updated_at', {ascending:false});
    if(error) throw error;
    Division.state.projects = data || [];
  } catch(e) {
    console.error('[Division] load:', e);
    Division.state.projects = [];
  }
  Division.renderList();
};

Division.renderList = function(){
  var el = document.getElementById('divisionProjectList');
  var cnt = document.getElementById('divisionProjectCount');
  if(!el) return;
  var ps = Division.state.projects;
  if(cnt) cnt.textContent = '총 ' + ps.length + '건';

  if(!ps.length){
    el.innerHTML = '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--color-text-tertiary);font-size:13px">'
      + '<div style="font-size:32px;margin-bottom:8px"><span class="tossface">📭</span></div>'
      + '분할출원 프로젝트가 없습니다.<br><span style="font-size:12px">새 프로젝트를 만들어 분할출원 청구항을 작성하세요.</span></td></tr>';
    return;
  }

  el.innerHTML = ps.map(function(p){
    var t = Division.TYPES[p.division_type] || { code:'?', label:'미정', css:'dtype-merge', icon:'❓' };
    var s = Division.STATUS[p.status] || { label:p.status, css:'dstatus-created' };
    var d = p.updated_at ? new Date(p.updated_at).toLocaleDateString('ko-KR', {month:'short', day:'numeric'}) : '-';
    return '<tr style="border-bottom:1px solid var(--color-divider);cursor:pointer" onclick="Division.open(\'' + p.id + '\')">'
      + '<td style="padding:10px 12px;font-weight:600;font-size:12px;color:var(--color-primary)">' + escapeHtml(p.reference_number || '-') + '</td>'
      + '<td style="padding:10px 12px"><div style="font-size:13px;font-weight:500">' + escapeHtml(p.name || '무제') + '</div>'
      + '<div style="margin-top:3px"><span class="division-type-badge ' + t.css + '">' + t.icon + ' ' + t.label + '</span></div></td>'
      + '<td style="padding:10px 12px;text-align:center"><span class="division-status-badge ' + s.css + '">' + s.label + '</span></td>'
      + '<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--color-text-tertiary)">' + d + '</td>'
      + '<td style="padding:10px 12px;text-align:center"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Division.del(\'' + p.id + '\')" style="font-size:11px;color:var(--color-error)">삭제</button></td>'
      + '</tr>';
  }).join('');
};

// ═══════════════════════════════════════════
// 2. 생성 / 삭제
// ═══════════════════════════════════════════
Division.openCreateModal = function(){
  document.getElementById('divisionCreateModal').style.display = 'flex';
};
Division.closeCreateModal = function(){
  document.getElementById('divisionCreateModal').style.display = 'none';
};

Division.create = async function(){
  var name = (document.getElementById('divisionNewName').value || '').trim();
  var refNum = (document.getElementById('divisionNewRefNum').value || '').trim();
  var appNum = (document.getElementById('divisionNewAppNum').value || '').trim();
  var divType = document.querySelector('input[name="divisionType"]:checked');

  if(!name){ showToast('프로젝트명을 입력해 주세요', 'error'); return; }
  if(!divType){ showToast('분할출원 유형을 선택해 주세요', 'error'); return; }

  var typeVal = divType.value;
  if(Division.TYPES[typeVal] && Division.TYPES[typeVal].disabled){
    showToast('해당 유형은 준비 중입니다', 'error'); return;
  }

  var inclPriorArt = document.getElementById('divisionInclPriorArt')?.checked || false;

  try {
    var {data, error} = await sb.from('division_projects').insert({
      name: name,
      reference_number: refNum || '',
      application_number: appNum || '',
      division_type: typeVal,
      include_prior_art: inclPriorArt,
      status: 'created',
      user_id: currentUser.id
    }).select().single();
    if(error) throw error;

    showToast('프로젝트가 생성되었습니다');
    Division.closeCreateModal();
    Division.state.projects.unshift(data);
    Division.renderList();
    Division.open(data.id);
  } catch(e) {
    showToast('생성 실패: ' + e.message, 'error');
  }
};

Division.del = async function(id){
  if(!confirm('이 프로젝트를 삭제하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
  try {
    await sb.from('division_projects').delete().eq('id', id);
    Division.state.projects = Division.state.projects.filter(function(p){ return p.id !== id; });
    Division.renderList(); showToast('삭제됨');
  } catch(e) { showToast('삭제 실패', 'error'); }
};

// ═══════════════════════════════════════════
// 3. 프로젝트 상세 (Work View)
// ═══════════════════════════════════════════
Division.open = async function(id){
  var p = Division.state.projects.find(function(x){ return x.id === id; });
  if(!p){ showToast('프로젝트를 찾을 수 없습니다', 'error'); return; }
  Division.state.current = p;
  Division.state.view = 'detail';
  document.getElementById('divisionListView').style.display = 'none';
  document.getElementById('divisionDetailView').style.display = 'block';
  Division.renderDetail();
  await Division.loadData(id);
};

Division.backToList = function(){
  Division.state.current = null;
  Division.state.view = 'list';
  document.getElementById('divisionDetailView').style.display = 'none';
  document.getElementById('divisionListView').style.display = 'block';
  Division.loadProjects();
};

Division.loadData = async function(id){
  try {
    var {data:files} = await sb.from('division_files').select('*').eq('project_id', id).order('created_at');
    Division.state.files = files || [];
    var {data:claims} = await sb.from('division_claims_parsed').select('*').eq('project_id', id).order('claim_number');
    Division.state.claims = claims || [];
    var {data:unused} = await sb.from('division_unused_components').select('*').eq('project_id', id);
    Division.state.unusedComponents = unused || [];
    var {data:divClaims} = await sb.from('division_claims_output').select('*').eq('project_id', id).order('claim_number');
    Division.state.divisionClaims = divClaims || [];
    var {data:valResults} = await sb.from('division_validation_results').select('*').eq('project_id', id);
    Division.state.validationResults = valResults || [];
  } catch(e) { console.error('[Division] loadData:', e); }
  Division.renderDetail();
};

Division.renderDetail = function(){
  var p = Division.state.current; if(!p) return;
  var t = Division.TYPES[p.division_type] || { code:'?', label:'미정', css:'dtype-merge', icon:'❓' };
  var s = Division.STATUS[p.status] || { label:p.status, css:'dstatus-created' };
  document.getElementById('divisionDetailTitle').textContent = p.name || '무제';
  document.getElementById('divisionDetailRef').textContent = p.reference_number || '-';
  document.getElementById('divisionDetailType').innerHTML = '<span class="division-type-badge ' + t.css + '">' + t.icon + ' ' + t.label + '</span>';
  document.getElementById('divisionDetailStatus').innerHTML = '<span class="division-status-badge ' + s.css + '">' + s.label + '</span>';
  Division.renderPipeline(p);
  Division.renderMain(p);
};

// ═══════════════════════════════════════════
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
  Division.renderMainForStep(p, stepKey);
};

// ═══════════════════════════════════════════
// 5. 메인 콘텐츠 분기
// ═══════════════════════════════════════════
Division.renderMain = function(p){
  var step = Division.STATUS_TO_STEP[p.status] || 0;
  var keys = ['upload','parse','analyze','assemble','verify','confirm'];
  Division.renderMainForStep(p, keys[step] || 'upload');
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
// 6. 화면: 파일 업로드
// ═══════════════════════════════════════════
Division.renderUpload = function(left, right, p){
  var files = Division.state.files;
  var h = '<div class="card" style="padding:16px">';
  h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">📁</span> 필수 파일</div>';
  ['application','notification','opinion','amendment'].forEach(function(ft){
    var info = Division.FILE_TYPES[ft];
    var uploaded = files.find(function(f){ return f.file_type === ft; });
    h += '<div class="division-file-row">';
    h += '<span class="division-file-icon">' + info.icon + '</span>';
    h += '<span class="division-file-label">' + info.label + '</span>';
    if(uploaded){
      h += '<span class="division-file-status uploaded">✅ 업로드됨</span>';
      h += '<button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + uploaded.id + '\')" style="font-size:10px;color:var(--color-error)">삭제</button>';
    } else {
      h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px"><span class="tossface">📄</span> 선택';
      h += '<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'' + ft + '\')" /></label>';
    }
    h += '</div>';
  });
  h += '</div>';

  // 선택 파일
  h += '<div class="card" style="padding:16px;margin-top:12px">';
  h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">📎</span> 선택 파일</div>';
  h += '<label class="checkbox-label" style="margin-bottom:8px"><input type="checkbox" ' + (p.include_prior_art ? 'checked' : '') + ' onchange="Division.togglePriorArt(this.checked)" /><span>인용발명 대비 분석 포함</span></label>';
  if(p.include_prior_art){
    var priorFile = files.find(function(f){ return f.file_type === 'prior_art'; });
    h += '<div class="division-file-row" style="margin-left:20px"><span class="division-file-icon">📚</span><span class="division-file-label">인용발명 PDF</span>';
    if(priorFile){ h += '<span class="division-file-status uploaded">✅</span><button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + priorFile.id + '\')" style="font-size:10px;color:var(--color-error)">삭제</button>'; }
    else { h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px"><span class="tossface">📄</span> 선택<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'prior_art\')" /></label>'; }
    h += '</div>';
  }
  var decFile = files.find(function(f){ return f.file_type === 'decision'; });
  h += '<div class="division-file-row"><span class="division-file-icon">🏆</span><span class="division-file-label">등록결정서</span>';
  if(decFile){ h += '<span class="division-file-status uploaded">✅</span><button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + decFile.id + '\')" style="font-size:10px;color:var(--color-error)">삭제</button>'; }
  else { h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px"><span class="tossface">📄</span> 선택<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'decision\')" /></label>'; }
  h += '</div></div>';
  left.innerHTML = h;

  // 오른쪽
  var requiredTypes = ['application','notification','opinion','amendment'];
  var allUploaded = requiredTypes.every(function(ft){ return files.some(function(f){ return f.file_type === ft; }); });
  var rh = '<div class="card" style="padding:20px">';
  rh += '<div style="font-size:16px;font-weight:700;margin-bottom:12px"><span class="tossface">🔀</span> 분할출원 청구항 자동 작성</div>';
  rh += '<div style="font-size:13px;line-height:1.7;color:var(--color-text-secondary);margin-bottom:16px">원출원 문서를 업로드하면, AI가 청구항을 파싱·분석하고<br>분할출원에 적합한 새 청구항을 자동으로 조립합니다.</div>';
  rh += '<div class="division-info-box"><div style="font-weight:600;margin-bottom:8px">📋 처리 단계</div>';
  rh += '<div style="font-size:12px;line-height:1.8;color:var(--color-text-secondary)">① 파싱 — 출원서·통지서·보정서 구조화<br>② 분석 — 미활용 구성 탐색 + 리스크 스크리닝<br>③ 조립 — 독립항/종속항 자동 구성<br>④ 검증 — 기재불비 검증 + 형식 검증<br>⑤ 확정 — 발명 명칭 + 최종 출력</div></div>';
  rh += '<div id="divisionProgress" style="margin-top:12px"></div>';
  if(allUploaded){
    rh += '<button class="btn btn-primary btn-full" id="btnDivisionParse" onclick="Division.runParse()" style="margin-top:16px;padding:14px;font-size:14px"><span class="tossface">🔍</span> 파싱 시작</button>';
  } else {
    rh += '<div style="margin-top:16px;padding:12px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);text-align:center;font-size:13px;color:var(--color-text-tertiary)">⚠️ 필수 파일 4종을 모두 업로드하면 파싱을 시작할 수 있습니다.</div>';
  }
  rh += '</div>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 7. 파일 업로드/삭제
// ═══════════════════════════════════════════
Division.uploadFile = async function(event, fileType){
  var file = event.target.files[0]; if(!file) return;
  if(!file.name.toLowerCase().endsWith('.pdf')){ showToast('PDF 파일만 업로드 가능합니다', 'error'); return; }
  var p = Division.state.current; if(!p) return;
  try {
    showToast('업로드 중...');
    var storagePath = 'division/' + p.id + '/' + fileType + '_' + Date.now() + '.pdf';
    var {error:uploadErr} = await sb.storage.from('division-files').upload(storagePath, file);
    if(uploadErr) throw uploadErr;
    var {data, error} = await sb.from('division_files').insert({ project_id:p.id, file_type:fileType, storage_path:storagePath, file_name:file.name, file_size:file.size }).select().single();
    if(error) throw error;
    Division.state.files.push(data);
    var requiredTypes = ['application','notification','opinion','amendment'];
    var allUploaded = requiredTypes.every(function(ft){ return Division.state.files.some(function(f){ return f.file_type === ft; }); });
    if(allUploaded && p.status === 'created'){
      await sb.from('division_projects').update({status:'uploaded', updated_at: new Date().toISOString()}).eq('id', p.id);
      p.status = 'uploaded';
    }
    showToast(Division.FILE_TYPES[fileType].label + ' 업로드 완료');
    Division.renderDetail();
  } catch(e) { showToast('업로드 실패: ' + e.message, 'error'); }
};

Division.removeFile = async function(fileId){
  if(!confirm('파일을 삭제하시겠습니까?')) return;
  try {
    var file = Division.state.files.find(function(f){ return f.id === fileId; });
    if(file) await sb.storage.from('division-files').remove([file.storage_path]);
    await sb.from('division_files').delete().eq('id', fileId);
    Division.state.files = Division.state.files.filter(function(f){ return f.id !== fileId; });
    showToast('파일 삭제됨'); Division.renderDetail();
  } catch(e) { showToast('삭제 실패', 'error'); }
};

Division.togglePriorArt = async function(checked){
  var p = Division.state.current; if(!p) return;
  await sb.from('division_projects').update({include_prior_art: checked}).eq('id', p.id);
  p.include_prior_art = checked; Division.renderDetail();
};

// ═══════════════════════════════════════════
// 8. Checkpoint 1: 파싱
// ═══════════════════════════════════════════
Division.runParse = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
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
    App.showProgress('divisionProgress', 'AI 파싱 분석 중...', files.length + 1, files.length + 3);
    var parsePrompt = Division._buildParsePrompt(fileTexts, p);
    var result = await App.callClaude(parsePrompt);
    App.showProgress('divisionProgress', '결과 저장 중...', files.length + 2, files.length + 3);
    var parsed;
    try { var cleaned = result.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim(); parsed = JSON.parse(cleaned); }
    catch(e) { showToast('파싱 결과 JSON 해석 실패. 재시도해 주세요.', 'error'); App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return; }
    if(parsed.claims && parsed.claims.length > 0){
      var claimRows = parsed.claims.map(function(c){ return { project_id:p.id, claim_number:c.claim_number, claim_type:c.claim_type||'independent', parent_claim_number:c.parent_claim_number||null, original_text:c.original_text||'', amended_text:c.amended_text||null, rejection_status:c.rejection_status||'not_rejected', amendment_status:c.amendment_status||'maintained', division_role:c.division_role||'dep_candidate' }; });
      await sb.from('division_claims_parsed').delete().eq('project_id', p.id);
      await sb.from('division_claims_parsed').insert(claimRows);
    }
    if(parsed.paragraphs){
      await sb.from('division_spec_paragraphs').delete().eq('project_id', p.id);
      if(parsed.paragraphs.length > 0){
        var paraRows = parsed.paragraphs.map(function(para){ return { project_id:p.id, paragraph_number:para.number, content:para.content }; });
        await sb.from('division_spec_paragraphs').insert(paraRows);
      }
    }
    await sb.from('division_projects').update({status:'parsed', updated_at: new Date().toISOString()}).eq('id', p.id);
    p.status = 'parsed';
    App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false);
    showToast('파싱 완료! 결과를 확인해 주세요.');
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); showToast('파싱 실패: ' + e.message, 'error'); }
};

Division._buildParsePrompt = function(fileTexts, p){
  return '아래 한국 특허 문서들을 분석하여 구조화된 JSON으로 파싱하라.\n\n[특허출원서]\n' + (fileTexts.application || '(없음)').substring(0, 30000) + '\n\n[의견제출통지서]\n' + (fileTexts.notification || '(없음)').substring(0, 10000) + '\n\n[의견서]\n' + (fileTexts.opinion || '(없음)').substring(0, 10000) + '\n\n[보정서]\n' + (fileTexts.amendment || '(없음)').substring(0, 15000) + '\n\n출력 JSON 형식:\n{"claims":[{"claim_number":1,"claim_type":"independent|dependent","parent_claim_number":null,"original_text":"원문","amended_text":"보정후(정정된경우)","rejection_status":"rejected|not_rejected","amendment_status":"amended|deleted|maintained","division_role":"basis|merge_candidate|dep_candidate|excluded|included_in_basis|product_claim"}],"paragraphs":[{"number":"0001","content":"단락내용"}],"reference_symbols":[{"name":"장치하우징","number":"100"}],"warnings":[]}\n\n파싱 규칙:\n1. 【청구항 N】 패턴으로 청구항 분리\n2. "제N항에 있어서" → dependent, parent=N\n3. 통지서에서 거절 대상 청구항 추출 → rejection_status\n4. 보정서에서 정정/삭제/유지 상태 추출 → amendment_status\n5. division_role 자동 분류: 거절+정정(병합포함)→basis, 미지적+유지→merge_candidate, 거절+유지→dep_candidate, 삭제(다른항병합)→included_in_basis\n6. 명세서 단락은 【NNNN】 패턴으로 분리\n7. 구성요소명(참조번호) 패턴 추출\n\nJSON만 출력하라. 설명 없이 순수 JSON만.';
};

// ═══════════════════════════════════════════
// 9. Checkpoint 1 화면: 파싱 결과
// ═══════════════════════════════════════════
Division.renderParse = function(left, right, p){
  var claims = Division.state.claims;
  var h = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">📊</span> 청구항 분류 매트릭스</div>';
  if(claims.length === 0){ h += '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">파싱된 청구항이 없습니다.</div>'; }
  else {
    h += '<table class="division-matrix-table"><thead><tr><th>청구항</th><th>거절여부</th><th>보정상태</th><th>분할 역할</th></tr></thead><tbody>';
    claims.forEach(function(c){
      var rejLabel = c.rejection_status==='rejected'?'거절':'미지적';
      var rejCss = c.rejection_status==='rejected'?'rej-yes':'rej-no';
      var amdLabel = c.amendment_status==='amended'?'정정':c.amendment_status==='deleted'?'삭제':'유지';
      var roleLabels = {basis:'기초',merge_candidate:'병합 후보',dep_candidate:'종속항 후보',excluded:'제외',included_in_basis:'기초에 포함됨',product_claim:'물건항 후보'};
      h += '<tr><td style="font-weight:600">제' + c.claim_number + '항</td>';
      h += '<td><span class="division-rej-badge ' + rejCss + '">' + rejLabel + '</span></td><td>' + amdLabel + '</td>';
      h += '<td><select class="division-role-select" data-claim-id="' + c.id + '" onchange="Division.updateClaimRole(this)">';
      ['basis','merge_candidate','dep_candidate','excluded','included_in_basis','product_claim'].forEach(function(role){
        h += '<option value="' + role + '"' + (c.division_role===role?' selected':'') + '>' + (roleLabels[role]||role) + '</option>';
      });
      h += '</select></td></tr>';
    });
    h += '</tbody></table>';
  }
  h += '</div>';
  left.innerHTML = h;

  var rh = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">📜</span> 등록 청구항 (보정 후 확정본)</div>';
  var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
  if(basisClaim){
    var displayText = basisClaim.amended_text || basisClaim.original_text;
    rh += '<div class="division-claim-text"><div style="font-weight:600;margin-bottom:4px;color:var(--color-primary)">【청구항 ' + basisClaim.claim_number + '】(기초)</div>';
    rh += '<div style="white-space:pre-wrap;font-size:13px;line-height:1.8">' + escapeHtml(displayText) + '</div></div>';
  } else { rh += '<div style="text-align:center;padding:16px;color:var(--color-text-tertiary)">기초(basis) 역할의 청구항을 지정해 주세요.</div>'; }
  rh += '</div>';
  rh += '<div style="display:flex;gap:8px;margin-top:12px">';
  rh += '<button class="btn btn-ghost" onclick="Division.rerunParse()" style="flex:1;padding:12px"><span class="tossface">🔄</span> 재파싱</button>';
  rh += '<button class="btn btn-primary" onclick="Division.confirmParse()" style="flex:1;padding:12px"><span class="tossface">✅</span> 파싱 승인 → 분석</button></div>';
  rh += '<div style="margin-top:8px;padding:10px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);font-size:12px;color:var(--color-text-tertiary)">⚠️ 파싱 결과가 정확한지 확인 후 승인을 눌러주세요. 각 셀을 클릭하여 수정할 수 있습니다.</div>';
  right.innerHTML = rh;
};

Division.updateClaimRole = async function(sel){
  var id = sel.dataset.claimId, role = sel.value;
  try { await sb.from('division_claims_parsed').update({division_role:role}).eq('id',id);
    var c = Division.state.claims.find(function(x){return x.id===id;}); if(c) c.division_role=role;
    Division.renderDetail();
  } catch(e) { showToast('역할 변경 실패','error'); }
};
Division.confirmParse = async function(){ var p=Division.state.current; if(!p) return; showToast('파싱 승인 완료. 분석을 시작합니다.'); Division.runAnalyze(); };
Division.rerunParse = function(){ Division.renderUpload(document.getElementById('divisionDetailLeft'),document.getElementById('divisionDetailRight'),Division.state.current); };

// ═══════════════════════════════════════════
// 10. Checkpoint 2: 분석
// ═══════════════════════════════════════════
Division.runAnalyze = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var right = document.getElementById('divisionDetailRight');
  right.innerHTML = '<div class="card" style="padding:20px;text-align:center"><div style="font-size:32px;margin-bottom:12px"><span class="tossface">🔍</span></div><div style="font-size:14px;font-weight:600;margin-bottom:8px">분석 진행 중...</div><div id="divisionAnalyzeProgress"></div></div>';
  try {
    App.showProgress('divisionAnalyzeProgress','구성요소 분해 중...',1,4);
    var {data:paragraphs} = await sb.from('division_spec_paragraphs').select('*').eq('project_id',p.id).order('paragraph_number');
    Division.state.specParagraphs = paragraphs || [];
    var claims = Division.state.claims;
    var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
    if(!basisClaim){ showToast('기초 청구항이 지정되지 않았습니다','error'); return; }
    App.showProgress('divisionAnalyzeProgress','미활용 구성 탐색 중...',2,4);
    var specText = (paragraphs||[]).map(function(para){ return '【'+para.paragraph_number+'】 '+para.content; }).join('\n');
    var excludedClaims = claims.filter(function(c){ return c.division_role==='excluded'; });
    var excludedText = excludedClaims.map(function(c){ return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text); }).join('\n');
    var analyzePrompt = Division._buildAnalyzePrompt(basisClaim, specText, excludedText, claims);
    var result = await App.callClaude(analyzePrompt);
    App.showProgress('divisionAnalyzeProgress','결과 저장 중...',3,4);
    var analyzed;
    try { var cleaned = result.text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim(); analyzed = JSON.parse(cleaned); }
    catch(e) { showToast('분석 결과 JSON 해석 실패','error'); return; }
    await sb.from('division_unused_components').delete().eq('project_id',p.id);
    if(analyzed.unused_components && analyzed.unused_components.length > 0){
      var compRows = analyzed.unused_components.map(function(uc){ return { project_id:p.id, paragraph_number:uc.paragraph_number||'', content:uc.content||'', related_element:uc.related_element||'', limitation_type:uc.limitation_type||'functional', risk_level:uc.risk_level||'safe', risk_flags:uc.risk_flags||[], insertion_point:uc.insertion_point||'', suggestion:uc.suggestion||'', user_selection:'pending' }; });
      await sb.from('division_unused_components').insert(compRows);
    }
    await sb.from('division_projects').update({status:'analyzed', updated_at: new Date().toISOString()}).eq('id',p.id);
    p.status = 'analyzed';
    App.clearProgress('divisionAnalyzeProgress');
    showToast('분석 완료! 부가 구성을 선택해 주세요.');
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionAnalyzeProgress'); showToast('분석 실패: '+e.message,'error'); }
};

Division._buildAnalyzePrompt = function(basisClaim, specText, excludedText, allClaims){
  var basisText = basisClaim.amended_text||basisClaim.original_text;
  var allClaimsText = allClaims.map(function(c){ return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text).substring(0,500); }).join('\n');
  return '아래 등록 청구항과 명세서를 분석하여, 분할출원에 활용 가능한 미활용 구성을 추출하라.\n\n[등록 청구항 (basis)]\n'+basisText+'\n\n[전체 청구항]\n'+allClaimsText+'\n\n[명세서 전 단락]\n'+specText.substring(0,40000)+'\n\n[제외 대상 청구항]\n'+(excludedText||'(없음)')+'\n\n규칙:\n1. 명세서 단락 중 어떤 청구항에도 기재되지 않은 구성을 추출\n2. 제외 대상 청구항의 구성과 중복되는 것은 제외\n3. 각 구성 분류: limitation_type(structural/material/shape/arrangement/functional), risk_level(safe:flag0/caution:flag1/danger:flag2+), risk_flags(금지어,추상적표현 등)\n4. insertion_point: 어느 구성요소 앞/뒤에 삽입할지\n\n출력 JSON:\n{"unused_components":[{"paragraph_number":"0098","content":"밀폐된 공간 구조를 형성하는","related_element":"장치 하우징","limitation_type":"structural","risk_level":"safe","risk_flags":[],"insertion_point":"장치 하우징 앞에 삽입","suggestion":""}]}\n\nJSON만 출력하라.';
};

// ═══════════════════════════════════════════
// 11. Checkpoint 2 화면: 구성 선택
// ═══════════════════════════════════════════
Division.renderAnalyze = function(left, right, p){
  var unused = Division.state.unusedComponents;
  var claims = Division.state.claims;
  var groups = { safe:[], caution:[], danger:[] };
  unused.forEach(function(uc){ (groups[uc.risk_level]||groups.safe).push(uc); });
  var h = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">🔧</span> 병합할 청구항</div>';
  var mergeCandidates = claims.filter(function(c){ return c.division_role==='merge_candidate'; });
  if(!mergeCandidates.length){ h += '<div style="font-size:13px;color:var(--color-text-tertiary);padding:8px">병합 후보 청구항이 없습니다.</div>'; }
  else { mergeCandidates.forEach(function(c){ h += '<label class="checkbox-label" style="margin-bottom:6px;font-size:13px"><input type="checkbox" checked data-merge-claim="'+c.claim_number+'" /><span>제'+c.claim_number+'항 — '+escapeHtml((c.amended_text||c.original_text).substring(0,60))+'...</span></label>'; }); }
  h += '</div>';
  ['safe','caution','danger'].forEach(function(level){
    var items = groups[level]; var info = Division.RISK_LABELS[level]; if(!items.length) return;
    h += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:12px">'+info.icon+' '+info.label+' ('+items.length+'건)</div>';
    items.forEach(function(uc){
      var isChecked = uc.user_selection==='selected'||(uc.user_selection==='pending'&&level==='safe');
      h += '<div class="division-component-row '+info.css+'"><label class="checkbox-label" style="flex:1"><input type="checkbox" '+(isChecked?'checked':'')+' data-component-id="'+uc.id+'" onchange="Division.toggleComponent(this)" /><div>';
      h += '<div style="font-weight:500">'+escapeHtml(uc.content)+'</div>';
      h += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:2px">【'+uc.paragraph_number+'】 → '+escapeHtml(uc.related_element)+' ('+uc.limitation_type+')</div>';
      if(uc.risk_flags&&uc.risk_flags.length) h += '<div style="font-size:11px;color:var(--color-warning);margin-top:2px">⚠️ '+escapeHtml(uc.risk_flags.join(', '))+'</div>';
      if(uc.suggestion) h += '<div style="font-size:11px;color:var(--color-primary);margin-top:2px">💡 제안: '+escapeHtml(uc.suggestion)+'</div>';
      h += '</div></label></div>';
    });
    h += '</div>';
  });
  left.innerHTML = h;

  var selectedCount = unused.filter(function(uc){ return uc.user_selection==='selected'||(uc.user_selection==='pending'&&uc.risk_level==='safe'); }).length;
  var rh = '<div class="card" style="padding:20px"><div style="font-size:16px;font-weight:700;margin-bottom:16px"><span class="tossface">📋</span> 구성 요약</div>';
  rh += '<div class="division-summary-grid"><div class="division-summary-item"><div class="division-summary-num">'+selectedCount+'</div><div class="division-summary-label">선택된 부가 구성</div></div>';
  rh += '<div class="division-summary-item"><div class="division-summary-num">'+mergeCandidates.length+'</div><div class="division-summary-label">병합 청구항</div></div></div></div>';
  rh += '<div id="divisionAssembleProgress" style="margin-top:12px"></div>';
  rh += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-ghost" onclick="Division.rerunAnalyze()" style="flex:1;padding:12px"><span class="tossface">🔄</span> 재분석</button>';
  rh += '<button class="btn btn-primary" id="btnDivisionAssemble" onclick="Division.runAssemble()" style="flex:1;padding:12px"><span class="tossface">🔧</span> 조립 실행</button></div>';
  right.innerHTML = rh;
};

Division.toggleComponent = async function(cb){
  var id=cb.dataset.componentId, val=cb.checked?'selected':'excluded';
  try { await sb.from('division_unused_components').update({user_selection:val}).eq('id',id);
    var c=Division.state.unusedComponents.find(function(x){return x.id===id;}); if(c) c.user_selection=val;
  } catch(e) { showToast('변경 실패','error'); }
};
Division.rerunAnalyze = function(){ Division.runAnalyze(); };

// ═══════════════════════════════════════════
// 12. Checkpoint 3: 조립
// ═══════════════════════════════════════════
Division.runAssemble = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  try {
    App.setButtonLoading('btnDivisionAssemble',true);
    App.showProgress('divisionAssembleProgress','청구항 조립 중...',1,3);
    var selected = Division.state.unusedComponents.filter(function(uc){ return uc.user_selection==='selected'||(uc.user_selection==='pending'&&uc.risk_level==='safe'); });
    var mergeCheckboxes = document.querySelectorAll('[data-merge-claim]:checked');
    var mergeNums = []; mergeCheckboxes.forEach(function(cb){ mergeNums.push(parseInt(cb.dataset.mergeClaim)); });
    var claims = Division.state.claims;
    var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
    var mergeClaims = claims.filter(function(c){ return mergeNums.indexOf(c.claim_number)>=0; });
    var depCandidates = claims.filter(function(c){ return c.division_role==='dep_candidate'; });
    var assemblePrompt = Division._buildAssemblePrompt(basisClaim, selected, mergeClaims, depCandidates);
    var result = await App.callClaude(assemblePrompt);
    App.showProgress('divisionAssembleProgress','결과 저장 중...',2,3);
    var assembled;
    try { var cleaned = result.text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim(); assembled = JSON.parse(cleaned); }
    catch(e) { showToast('조립 결과 JSON 해석 실패','error'); App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false); return; }
    await sb.from('division_claims_output').delete().eq('project_id',p.id);
    if(assembled.division_claims && assembled.division_claims.length > 0){
      var rows = assembled.division_claims.map(function(dc){ return { project_id:p.id, claim_number:dc.claim_number, claim_type:dc.claim_type||'independent', parent_claim_number:dc.parent_claim_number||null, claim_text:dc.claim_text||'', claim_text_highlighted:dc.claim_text_highlighted||'', version:1 }; });
      await sb.from('division_claims_output').insert(rows);
    }
    var updateData = { status:'assembled', updated_at:new Date().toISOString() };
    if(assembled.title_candidates) updateData.title_candidates = assembled.title_candidates;
    await sb.from('division_projects').update(updateData).eq('id',p.id);
    p.status = 'assembled'; if(assembled.title_candidates) p.title_candidates = assembled.title_candidates;
    App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false);
    showToast('조립 완료! 초안을 검토해 주세요.');
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false); showToast('조립 실패: '+e.message,'error'); }
};

Division._buildAssemblePrompt = function(basisClaim, selectedComponents, mergeClaims, depCandidates){
  var basisText = basisClaim.amended_text||basisClaim.original_text;
  var compList = selectedComponents.map(function(uc){ return '- 내용: '+uc.content+'\n  삽입위치: '+uc.insertion_point+'\n  유형: '+uc.limitation_type; }).join('\n');
  var mergeList = mergeClaims.map(function(c){ return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text); }).join('\n\n');
  var depList = depCandidates.map(function(c){ return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text); }).join('\n\n');
  return '아래 등록 청구항에 부가 구성을 삽입하고 병합 청구항을 결합하여 분할출원 청구항을 조립하라.\n\n[등록 청구항 (basis)]\n'+basisText+'\n\n[선택된 부가 구성]\n'+(compList||'(없음)')+'\n\n[병합 대상 청구항]\n'+(mergeList||'(없음)')+'\n\n[종속항 후보]\n'+(depList||'(없음)')+'\n\n조립 규칙:\n1. 독립항: structural→명칭앞형용구, material→재질병기, shape→형상추가, functional→뒤에부가\n2. 병합: "제N항에있어서,"제거, "상기{구성요소}는,"이하추출, 말미앞삽입\n3. 종속항: dep_candidate→"제1항에있어서,"변환, 삭제번호건너뛰기재번호\n4. 명칭: 국문/영문 각 2개\n\n출력 JSON:\n{"division_claims":[{"claim_number":1,"claim_type":"independent","parent_claim_number":null,"claim_text":"최종텍스트","claim_text_highlighted":"**부가**와 ***병합*** 표시"}],"title_candidates":[{"ko":"국문명칭","en":"English title"}]}\n\nJSON만 출력하라.';
};

// ═══════════════════════════════════════════
// 13. Checkpoint 3 화면: 초안 검토
// ═══════════════════════════════════════════
Division.renderAssemble = function(left, right, p){
  var divClaims = Division.state.divisionClaims;
  var h = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">📝</span> 분할출원 청구항 초안</div>';
  if(!divClaims.length){ h += '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">조립된 청구항이 없습니다.</div>'; }
  else { divClaims.forEach(function(dc){
    h += '<div class="division-claim-block"><div class="division-claim-header"><span style="font-weight:700;color:var(--color-primary)">【청구항 '+dc.claim_number+'】</span>';
    h += '<span class="division-claim-type-tag">'+(dc.claim_type==='independent'?'독립항':'종속항')+'</span></div>';
    var displayText = dc.claim_text_highlighted||dc.claim_text;
    displayText = displayText.replace(/\*\*\*(.*?)\*\*\*/g,'<span class="division-hl-merge">$1</span>').replace(/\*\*(.*?)\*\*/g,'<span class="division-hl-added">$1</span>');
    h += '<div class="division-claim-body">'+displayText+'</div></div>';
  }); }
  h += '</div>';
  left.innerHTML = h;

  var indepCnt = divClaims.filter(function(c){ return c.claim_type==='independent'; }).length;
  var depCnt = divClaims.filter(function(c){ return c.claim_type==='dependent'; }).length;
  var rh = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">📊</span> 변경사항 요약</div>';
  rh += '<div style="font-size:13px;line-height:1.7;color:var(--color-text-secondary)">독립항: '+indepCnt+'건<br>종속항: '+depCnt+'건<br>총: '+divClaims.length+'항</div></div>';
  rh += '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap"><div style="display:flex;align-items:center;gap:4px;font-size:11px"><span class="division-hl-added" style="padding:1px 6px">부가 구성</span></div>';
  rh += '<div style="display:flex;align-items:center;gap:4px;font-size:11px"><span class="division-hl-merge" style="padding:1px 6px">병합 구성</span></div></div>';
  rh += '<div id="divisionVerifyProgress" style="margin-top:12px"></div>';
  rh += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-ghost" onclick="Division.runAssemble()" style="flex:1;padding:12px"><span class="tossface">🔄</span> 재조립</button>';
  rh += '<button class="btn btn-primary" id="btnDivisionVerify" onclick="Division.runVerify()" style="flex:1;padding:12px"><span class="tossface">✅</span> 검증 실행</button></div>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 14. Checkpoint 4: 검증
// ═══════════════════════════════════════════
Division.runVerify = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  try {
    App.setButtonLoading('btnDivisionVerify',true);
    App.showProgress('divisionVerifyProgress','기재불비 검증 중...',1,3);
    var divClaims = Division.state.divisionClaims;
    var claimsText = divClaims.map(function(dc){ return '【청구항 '+dc.claim_number+'】\n'+dc.claim_text; }).join('\n\n');
    var {data:paragraphs} = await sb.from('division_spec_paragraphs').select('*').eq('project_id',p.id);
    var specText = (paragraphs||[]).map(function(para){ return '【'+para.paragraph_number+'】 '+para.content; }).join('\n');
    App.showProgress('divisionVerifyProgress','AI 검증 분석 중...',2,3);
    var verifyPrompt = Division._buildVerifyPrompt(claimsText, specText);
    var result = await App.callClaude(verifyPrompt);
    var verified;
    try { var cleaned = result.text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim(); verified = JSON.parse(cleaned); }
    catch(e) { showToast('검증 결과 JSON 해석 실패','error'); App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false); return; }
    await sb.from('division_validation_results').delete().eq('project_id',p.id);
    if(verified.results && verified.results.length > 0){
      var rows = verified.results.map(function(vr){ return { project_id:p.id, check_type:vr.check_type||'format', target_text:vr.target_text||'', result:vr.result||'pass', detail:vr.detail||'', suggestion:vr.suggestion||'', spec_paragraph_number:vr.spec_paragraph_number||null }; });
      await sb.from('division_validation_results').insert(rows);
    }
    await sb.from('division_projects').update({status:'verified', updated_at:new Date().toISOString()}).eq('id',p.id);
    p.status = 'verified';
    App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false);
    showToast('검증 완료!'); await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false); showToast('검증 실패: '+e.message,'error'); }
};

Division._buildVerifyPrompt = function(claimsText, specText){
  return '아래 분할출원 청구항에 대해 기재불비 검증을 수행하라.\n\n[분할출원 청구항]\n'+claimsText+'\n\n[명세서 전문]\n'+specText.substring(0,40000)+'\n\n검증 항목:\n1. abstract_expression: 추상적 표현\n2. functional_limitation: 기능적 기재\n3. support: 명세서 뒷받침\n4. overlap: 구성 중복\n5. format: 형식\n\n출력 JSON:\n{"overall":"pass|warning|fail","results":[{"check_type":"abstract_expression|functional_limitation|support|overlap|format","target_text":"검증대상","result":"pass|warning|fail","detail":"상세","suggestion":"수정제안","spec_paragraph_number":"0098"}],"format_checks":{"spacing":"pass|fail","ending":"pass|fail","dep_references":"pass|fail","overlap":"pass|fail"}}\n\nJSON만 출력하라.';
};

// ═══════════════════════════════════════════
// 15. Checkpoint 4 화면: 검증 결과
// ═══════════════════════════════════════════
Division.renderVerify = function(left, right, p){
  var results = Division.state.validationResults;
  var passCount = results.filter(function(r){ return r.result==='pass'; }).length;
  var warnCount = results.filter(function(r){ return r.result==='warning'; }).length;
  var failCount = results.filter(function(r){ return r.result==='fail'; }).length;
  var h = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">✅</span> 기재불비 검증 결과</div>';
  h += '<div class="division-val-summary"><div class="division-val-stat pass">✅ 통과 '+passCount+'</div><div class="division-val-stat warn">⚠️ 주의 '+warnCount+'</div><div class="division-val-stat fail">❌ 실패 '+failCount+'</div></div>';
  if(!results.length){ h += '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">검증 결과가 없습니다.</div>'; }
  else { results.forEach(function(vr){
    var resultCss = vr.result==='pass'?'vr-pass':vr.result==='warning'?'vr-warn':'vr-fail';
    var resultIcon = vr.result==='pass'?'✅':vr.result==='warning'?'⚠️':'❌';
    var typeLabel = {abstract_expression:'추상적 표현',functional_limitation:'기능적 기재',support:'명세서 뒷받침',overlap:'구성 중복',format:'형식'}[vr.check_type]||vr.check_type;
    h += '<div class="division-val-row '+resultCss+'" onclick="this.classList.toggle(\'expanded\')">';
    h += '<div class="division-val-row-header"><span>'+resultIcon+'</span><span style="font-weight:500;flex:1">'+typeLabel+'</span><span class="division-val-result-badge '+resultCss+'">'+vr.result+'</span></div>';
    h += '<div class="division-val-row-body">';
    if(vr.target_text) h += '<div style="margin-bottom:6px"><strong>대상:</strong> '+escapeHtml(vr.target_text)+'</div>';
    if(vr.detail) h += '<div style="margin-bottom:6px">'+escapeHtml(vr.detail)+'</div>';
    if(vr.suggestion) h += '<div style="padding:8px;background:var(--color-primary-light);border-radius:var(--radius-sm);border-left:3px solid var(--color-primary)">💡 '+escapeHtml(vr.suggestion)+'</div>';
    if(vr.spec_paragraph_number) h += '<div style="margin-top:4px;font-size:11px;color:var(--color-text-tertiary)">근거: 【'+vr.spec_paragraph_number+'】</div>';
    h += '</div></div>';
  }); }
  h += '</div>';
  left.innerHTML = h;

  var rh = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">🏷️</span> 발명의 명칭</div>';
  var candidates = p.title_candidates || [];
  if(candidates.length > 0){
    candidates.forEach(function(tc,i){
      rh += '<label class="division-title-option"><input type="radio" name="divisionTitle" value="'+i+'"'+(i===0?' checked':'')+' /><div>';
      rh += '<div style="font-size:13px;font-weight:500">'+escapeHtml(tc.ko)+'</div>';
      rh += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">'+escapeHtml(tc.en)+'</div></div></label>';
    });
    rh += '<label class="division-title-option"><input type="radio" name="divisionTitle" value="custom" /><div style="flex:1"><input type="text" class="input-field" id="divisionCustomTitle" placeholder="직접 입력 (국문)" style="font-size:13px;padding:6px 10px" /></div></label>';
  } else {
    rh += '<input type="text" class="input-field" id="divisionCustomTitle" placeholder="국문 명칭" style="margin-top:8px;font-size:13px;padding:8px 10px" />';
    rh += '<input type="text" class="input-field" id="divisionCustomTitleEn" placeholder="영문 명칭" style="margin-top:6px;font-size:13px;padding:8px 10px" />';
  }
  rh += '</div>';
  if(failCount > 0){ rh += '<div style="margin-top:12px;padding:12px;background:var(--color-error-light);border-radius:var(--radius-sm);font-size:13px;color:var(--color-error)">⚠️ 검증 실패 항목이 있습니다. 수정하거나 제외한 후 재검증하세요.<br>명세서 뒷받침이 부족한 구성은 제외하거나, 별도 명세서 보정이 필요합니다.</div>'; }
  rh += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-ghost" onclick="Division.runVerify()" style="flex:1;padding:12px"><span class="tossface">🔄</span> 재검증</button>';
  rh += '<button class="btn btn-primary" onclick="Division.confirmFinal()" style="flex:1;padding:12px"><span class="tossface">🏁</span> 최종 확정</button></div>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 16. 최종 확정
// ═══════════════════════════════════════════
Division.confirmFinal = async function(){
  var p = Division.state.current; if(!p) return;
  var sel = document.querySelector('input[name="divisionTitle"]:checked');
  var titleKo = '', titleEn = '', candidates = p.title_candidates || [];
  if(sel){
    if(sel.value==='custom'){ titleKo=(document.getElementById('divisionCustomTitle')?.value||'').trim(); titleEn=(document.getElementById('divisionCustomTitleEn')?.value||'').trim(); }
    else { var idx=parseInt(sel.value); if(candidates[idx]){ titleKo=candidates[idx].ko; titleEn=candidates[idx].en; } }
  } else { titleKo=(document.getElementById('divisionCustomTitle')?.value||'').trim(); titleEn=(document.getElementById('divisionCustomTitleEn')?.value||'').trim(); }
  if(!titleKo){ showToast('발명의 명칭을 선택하거나 입력해 주세요','error'); return; }
  try {
    await sb.from('division_projects').update({ status:'confirmed', title_ko:titleKo, title_en:titleEn, updated_at:new Date().toISOString() }).eq('id',p.id);
    p.status='confirmed'; p.title_ko=titleKo; p.title_en=titleEn;
    showToast('최종 확정 완료!'); Division.renderDetail();
  } catch(e) { showToast('확정 실패: '+e.message,'error'); }
};

// ═══════════════════════════════════════════
// 17. 최종 출력 화면
// ═══════════════════════════════════════════
Division.renderConfirm = function(left, right, p){
  var divClaims = Division.state.divisionClaims;
  var plainText = divClaims.map(function(dc){ return '【청구항 '+dc.claim_number+'】\n'+dc.claim_text; }).join('\n\n');
  var h = '<div class="card" style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<div style="font-size:14px;font-weight:700"><span class="tossface">📋</span> 청구항 전문</div>';
  h += '<button class="btn btn-outline btn-sm" onclick="Division.copyText(\'divisionOutputText\')"><span class="tossface">📋</span> 전체 복사</button></div>';
  h += '<div id="divisionOutputText" style="white-space:pre-wrap;font-size:13px;line-height:1.8;background:var(--color-bg-tertiary);padding:16px;border-radius:var(--radius-sm);max-height:60vh;overflow-y:auto">'+escapeHtml(plainText)+'</div></div>';
  left.innerHTML = h;

  var rh = '<div class="card" style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  rh += '<div style="font-size:14px;font-weight:700"><span class="tossface">🏷️</span> 발명의 명칭</div>';
  rh += '<button class="btn btn-outline btn-sm" onclick="Division.copyText(\'divisionOutputTitle\')"><span class="tossface">📋</span> 복사</button></div>';
  rh += '<div id="divisionOutputTitle" style="font-size:13px;line-height:1.7"><div><strong>【국문】</strong>'+escapeHtml(p.title_ko||'')+'</div>';
  rh += '<div style="margin-top:4px"><strong>【영문】</strong>'+escapeHtml(p.title_en||'')+'</div></div></div>';
  rh += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tossface">🖍️</span> 하이라이트 버전</div>';
  rh += '<div style="font-size:13px;line-height:1.8">';
  divClaims.forEach(function(dc){
    var d = dc.claim_text_highlighted||dc.claim_text;
    d = d.replace(/\*\*\*(.*?)\*\*\*/g,'<span class="division-hl-merge">$1</span>').replace(/\*\*(.*?)\*\*/g,'<span class="division-hl-added">$1</span>');
    rh += '<div style="margin-bottom:12px"><span style="font-weight:700;color:var(--color-primary)">【청구항 '+dc.claim_number+'】</span><br>'+d+'</div>';
  });
  rh += '</div></div>';
  rh += '<button class="btn btn-ghost btn-full" onclick="Division.backToList()" style="margin-top:12px;padding:12px"><span class="tossface">←</span> 목록으로</button>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 18. 유틸리티
// ═══════════════════════════════════════════
Division.copyText = function(elementId){
  var el = document.getElementById(elementId); if(!el) return;
  navigator.clipboard.writeText(el.innerText||el.textContent).then(function(){ showToast('복사되었습니다'); }).catch(function(){ showToast('복사 실패','error'); });
};
