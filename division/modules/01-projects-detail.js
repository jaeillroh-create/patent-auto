// 1. 프로젝트 목록
// ═══════════════════════════════════════════
Division.loadProjects = async function(){
  var el = document.getElementById('divisionProjectList');
  if(!el) return;
  try {
    // T15: spec_full_text 제외 — 대용량 텍스트 컬럼은 분석/조립/검증 시에만 개별 조회
    var {data, error} = await sb.from('division_projects')
      .select('id, user_id, name, reference_number, application_number, division_type, status, analysis_meta, title_candidates, created_at, updated_at')
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
      + '<div style="font-size:32px;margin-bottom:8px"><span class="ico" data-icon="mail"></span></div>'
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

  var inclPriorArt = document.getElementById('divisionInclPriorArt')?.checked || false;
  var origTitleKo = (document.getElementById('divisionOrigTitleKo')?.value || '').trim();
  var origTitleEn = (document.getElementById('divisionOrigTitleEn')?.value || '').trim();

  try {
    var {data, error} = await sb.from('division_projects').insert({
      name: name,
      reference_number: refNum || '',
      application_number: appNum || '',
      division_type: typeVal,
      include_prior_art: inclPriorArt,
      original_title_ko: origTitleKo || null,
      original_title_en: origTitleEn || null,
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
  Division.state.currentStepKey = null; // 새 프로젝트 진입 시 DB 상태 기준
  document.getElementById('divisionListView').style.display = 'none';
  document.getElementById('divisionDetailView').style.display = 'block';
  Division.renderDetail();
  await Division.loadData(id);
};

Division.backToList = function(){
  Division.state.current = null;
  Division.state.view = 'list';
  Division.state.currentStepKey = null;
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
  // 저장된 청구항 개수 설정 복원
  var p = Division.state.current;
  if(p && p.analysis_meta){
    if(p.analysis_meta.indep_count) Division.state.indepCount = p.analysis_meta.indep_count;
    if(p.analysis_meta.dep_count) Division.state.depCount = p.analysis_meta.dep_count;
  }
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

// 현재 화면을 유지하면서 내용만 갱신 (유형 전환, 체크박스, 개수 변경 등)
Division.renderStay = function(){
  var p = Division.state.current; if(!p) return;
  var t = Division.TYPES[p.division_type] || { code:'?', label:'미정', css:'dtype-merge', icon:'❓' };
  var s = Division.STATUS[p.status] || { label:p.status, css:'dstatus-created' };
  document.getElementById('divisionDetailType').innerHTML = '<span class="division-type-badge ' + t.css + '">' + t.icon + ' ' + t.label + '</span>';
  document.getElementById('divisionDetailStatus').innerHTML = '<span class="division-status-badge ' + s.css + '">' + s.label + '</span>';
  Division.renderPipeline(p);
  // currentStepKey가 있으면 해당 화면 유지, 없으면 DB 상태 기준
  if(Division.state.currentStepKey){
    Division.renderMainForStep(p, Division.state.currentStepKey);
  } else {
    Division.renderMain(p);
  }
};

// ═══ 분할유형 전환 (파싱/분석 단계에서 변경 가능) ═══
Division._renderTypeSwitch = function(currentType){
  var h = '<div class="division-type-switch">';
  h += '<span style="font-size:12px;font-weight:600;color:var(--color-text-secondary);margin-right:8px">분할 유형:</span>';
  ['merge','category_change','strategic'].forEach(function(type){
    var info = Division.TYPES[type];
    var active = currentType === type;
    h += '<button class="division-type-switch-btn' + (active?' active':'') + '" onclick="Division.switchType(\'' + type + '\')">';
    h += info.icon + ' ' + info.label + '</button>';
  });
  h += '</div>';
  return h;
};

Division.switchType = async function(newType){
  var p = Division.state.current; if(!p) return;
  if(p.division_type === newType) return;
  var oldType = p.division_type;
  try {
    await sb.from('division_projects').update({ division_type:newType, updated_at:new Date().toISOString() }).eq('id', p.id);
    p.division_type = newType;
    showToast(Division.TYPES[newType].label + '로 변경됨');

    // 분석 단계 이후면 재분석 필요 안내
    var step = Division.STATUS_TO_STEP[p.status] || 0;
    if(step >= 2){ // analyzed 이상
      showToast('유형 변경 후 재분석을 권장합니다', 'info');
    }
    Division.renderStay(); // 현재 단계 유지
  } catch(e){ showToast('유형 변경 실패: ' + e.message, 'error'); p.division_type = oldType; }
};

// ═══════════════════════════════════════════
