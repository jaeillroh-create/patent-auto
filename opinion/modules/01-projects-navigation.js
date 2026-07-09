// 1. 프로젝트 목록
// ═══════════════════════════════════════════
Opinion.loadProjects = async function(){
  var el=document.getElementById('opinionProjectList'); if(!el)return;
  try {
    var {data,error}=await sb.from('opinion_projects').select('*').eq('created_by',currentUser.id).order('updated_at',{ascending:false});
    if(error)throw error;
    Opinion.state.projects=data||[];
  } catch(e){ console.error('[Opinion] load:',e); Opinion.state.projects=[]; }
  Opinion.renderList();
};

Opinion.renderList = function(){
  var el=document.getElementById('opinionProjectList'), cnt=document.getElementById('opinionProjectCount');
  if(!el)return;
  var ps=Opinion.state.projects;
  if(cnt) cnt.textContent='총 '+ps.length+'건';
  if(!ps.length){ el.innerHTML='<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--color-text-tertiary);font-size:13px"><div style="font-size:32px;margin-bottom:8px"><span class="ico" data-icon="mail"></span></div>의견서 대응 프로젝트가 없습니다.<br><span style="font-size:12px">새 프로젝트를 만들어 의견제출통지서에 대응하세요.</span></td></tr>'; return; }
  el.innerHTML=ps.map(function(p){
    var t=Opinion.TYPES[p.rejection_type]||{code:'?',label:'미정',css:'type-unknown',icon:'❓'};
    var s=Opinion.STATUS[p.status]||{label:p.status,css:'status-created'};
    var d=p.updated_at?new Date(p.updated_at).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}):'-';
    var dl=p.deadline_date?new Date(p.deadline_date).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}):'-';
    return '<tr style="border-bottom:1px solid var(--color-divider);cursor:pointer" onclick="Opinion.open(\''+p.id+'\')">'
      +'<td style="padding:10px 12px;font-weight:600;font-size:12px;color:var(--color-primary)">'+escapeHtml(p.application_no||'-')+'</td>'
      +'<td style="padding:10px 12px"><div style="font-size:13px;font-weight:500">'+escapeHtml(p.title||'무제')+'</div><div style="margin-top:3px"><span class="opinion-type-badge '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</span></div></td>'
      +'<td style="padding:10px 12px;text-align:center"><span class="opinion-status-badge '+s.css+'">'+s.label+'</span></td>'
      +'<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--color-text-secondary)">'+dl+'</td>'
      +'<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--color-text-tertiary)">'+d+'</td>'
      +'<td style="padding:10px 12px;text-align:center"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Opinion.del(\''+p.id+'\')" style="font-size:11px;color:var(--color-error)">삭제</button></td></tr>';
  }).join('');
};

// ═══════════════════════════════════════════
// 2. 생성 / 삭제
// ═══════════════════════════════════════════
Opinion.openCreateModal = function(){ document.getElementById('opinionCreateModal').style.display='flex'; };
Opinion.closeCreateModal = function(){ document.getElementById('opinionCreateModal').style.display='none'; };

Opinion.create = async function(){
  var title=(document.getElementById('opinionNewTitle').value||'').trim();
  var appNo=(document.getElementById('opinionNewAppNo').value||'').trim();
  var deadline=(document.getElementById('opinionNewDeadline').value||'').trim();
  if(!title){showToast('사건명을 입력해 주세요','error');return;}
  try{
    var {data,error}=await sb.from('opinion_projects').insert({title:title,application_no:appNo||'',status:'created',rejection_type:'inventive_step',deadline_date:deadline||null,created_by:currentUser.id,expert_id:currentUser.id}).select().single();
    if(error)throw error;
    showToast('프로젝트가 생성되었습니다');
    Opinion.closeCreateModal();
    Opinion.state.projects.unshift(data);
    Opinion.renderList();
    Opinion.open(data.id);
  }catch(e){showToast('생성 실패: '+e.message,'error');}
};

Opinion.del = async function(id){
  if(!confirm('이 프로젝트를 삭제하시겠습니까?'))return;
  try{ await sb.from('opinion_projects').delete().eq('id',id);
    Opinion.state.projects=Opinion.state.projects.filter(function(p){return p.id!==id;});
    Opinion.renderList(); showToast('삭제됨');
  }catch(e){showToast('삭제 실패','error');}
};

// ═══════════════════════════════════════════
// 3. 프로젝트 상세
// ═══════════════════════════════════════════
Opinion.open = async function(id){
  // 이전 프로젝트 메모리·파일·usage 초기화 + 진행 중 비동기 작업 취소 (P1 #23, P2 #7, #24)
  Opinion.resetState({ keepProjectId: false });

  var p=Opinion.state.projects.find(function(x){return x.id===id;});
  if(!p){showToast('프로젝트를 찾을 수 없습니다','error');return;}
  Opinion.state.current=p; Opinion.state.view='detail'; Opinion.state.viewStep=null;

  // 새 파이프라인 실행 토큰 발급 (P2 #24)
  Opinion._currentRun = new AbortController();

  document.getElementById('opinionListView').style.display='none';
  document.getElementById('opinionDetailView').style.display='block';
  Opinion.renderDetail();
  await Opinion.loadData(id);
};

Opinion.backToList = function(){
  // 이전 프로젝트 상태·진행 중 작업 모두 초기화 (P1 #23, P2 #24)
  Opinion.resetState({ keepProjectId: false });
  Opinion.state.view='list';
  document.getElementById('opinionDetailView').style.display='none';
  document.getElementById('opinionListView').style.display='block';
  Opinion.loadProjects();
};

Opinion.renderDetail = function(){
  var p=Opinion.state.current; if(!p)return;
  var t=Opinion.TYPES[p.rejection_type]||{code:'?',label:'미정',css:'type-unknown',icon:'❓'};
  var s=Opinion.STATUS[p.status]||{label:p.status,css:'status-created'};
  document.getElementById('opinionDetailTitle').textContent=p.title||'무제';
  document.getElementById('opinionDetailAppNo').textContent=p.application_no||'-';
  // ── Cycle 5: 혼합 모드 헤더 chip ──
  var mixedChip = '';
  if (Opinion.state._mixed_mode && Opinion.state._mixed_secondary) {
    var sInfo = Opinion.TYPES[Opinion.state._mixed_secondary] || {};
    mixedChip = ' <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#e3f2fd;border-radius:10px;font-size:10px;font-weight:600;color:var(--dt-brand-hover);margin-left:4px">+ 부 거절: §'+(sInfo.code||'')+'</span>';
  }
  document.getElementById('opinionDetailType').innerHTML='<span class="opinion-type-badge '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</span>'+mixedChip;
  document.getElementById('opinionDetailStatus').innerHTML='<span class="opinion-status-badge '+s.css+'">'+s.label+'</span> <span id="opinionUsage" style="font-size:11px;color:var(--color-text-tertiary);margin-left:8px"></span>';
  Opinion.updateUsageDisplay();
  Opinion.renderPipeline(p);
  Opinion.renderMain(p);
};

// ═══ Step ↔ Status 매핑 (7단계 파이프라인) ═══
Opinion.STEP_GROUP = {upload:0,parse:0,type:0,strategy:1,draft:2,opinion:3,output:4};
Opinion.GROUP_ORDER = ['init','strategy','draft','opinion','output'];

// step key → 해당 단계의 "완료" 상태 (뷰 전환용)
Opinion.STEP_TO_VIEW_STATUS = function(stepKey, type) {
  var map = {
    upload:'created', parse:'parsed', type:'type_determined',
    strategy: type==='description_deficiency'?'correction_confirmed':type==='partial_rejection'?'merge_confirmed':'strategy_confirmed',
    draft: type==='description_deficiency'?'correction_validated':type==='partial_rejection'?'merge_validated':'validated',
    opinion:'opinion_drafted', output:'completed'
  };
  return map[stepKey] || 'created';
};

// step key → 해당 단계의 "시작" 상태 (되돌리기용)
Opinion.STEP_TO_RESET_STATUS = function(stepKey, type) {
  var map = {
    upload:'created', parse:'created', type:'parsed',
    strategy:'type_determined',
    draft: type==='description_deficiency'?'correction_confirmed':type==='partial_rejection'?'merge_confirmed':'strategy_confirmed',
    opinion: type==='description_deficiency'?'correction_validated':type==='partial_rejection'?'merge_validated':'validated',
    output:'opinion_drafted'
  };
  return map[stepKey] || 'created';
};

Opinion.renderPipeline = function(p){
  var el=document.getElementById('opinionPipeline'); if(!el)return;
  var type=p.rejection_type||'inventive_step';
  var steps=[].concat(Opinion.PIPELINE.common_entry, Opinion.PIPELINE[type]||Opinion.PIPELINE.inventive_step, Opinion.PIPELINE.common_exit);
  var cg=(Opinion.STATUS[p.status]||{}).g||'init';
  var ci=Opinion.GROUP_ORDER.indexOf(cg);
  var viewStep=Opinion.state.viewStep;
  var h='';
  steps.forEach(function(step,i){
    var si=Opinion.STEP_GROUP[step.key]!==undefined?Opinion.STEP_GROUP[step.key]:-1;
    var st=si<ci?'done':si===ci?'active':'pending';
    var isViewing = viewStep===step.key;
    var clickable = st==='done' || st==='active';
    if(i>0) h+='<div class="opinion-step-connector '+(st==='done'?'done':'')+'"></div>';
    h+='<div class="opinion-step '+st+(isViewing?' viewing':'')+'"'
      +(clickable?' onclick="Opinion.goToStep(\''+step.key+'\')" style="cursor:pointer"':'')+'>'
      +'<div class="opinion-step-dot">'+(st==='done'?'✓':String(i+1))+'</div>'
      +'<span class="opinion-step-label">'+step.label+'</span>'
      +'</div>';
  });
  el.innerHTML=h;
};

// ═══ 파이프라인 스텝 클릭 → 해당 단계 뷰 전환 ═══
Opinion.goToStep = function(stepKey) {
  var p=Opinion.state.current; if(!p)return;
  var type=p.rejection_type||'inventive_step';
  var cg=(Opinion.STATUS[p.status]||{}).g||'init';
  var ci=Opinion.GROUP_ORDER.indexOf(cg);
  var si=Opinion.STEP_GROUP[stepKey]!==undefined?Opinion.STEP_GROUP[stepKey]:-1;

  // 현재 단계이거나 미래 단계 → viewStep 해제 (현재 상태 그대로 표시)
  if(si>=ci) { Opinion.state.viewStep=null; Opinion.renderDetail(); return; }

  // 과거 단계 → viewStep 설정하여 과거 뷰 표시
  Opinion.state.viewStep=stepKey;
  Opinion.renderDetail();
};

// ═══ 현재 단계로 돌아가기 ═══
Opinion.goToCurrent = function() {
  Opinion.state.viewStep=null;
  Opinion.renderDetail();
};

// ═══ 이전 단계로 되돌리기 (상태 롤백) ═══
Opinion.rollbackToStep = async function(stepKey) {
  var p=Opinion.state.current; if(!p)return;
  var type=p.rejection_type||'inventive_step';
  var targetStatus = Opinion.STEP_TO_RESET_STATUS(stepKey, type);
  var stepLabel = '';
  var allSteps=[].concat(Opinion.PIPELINE.common_entry, Opinion.PIPELINE[type]||Opinion.PIPELINE.inventive_step, Opinion.PIPELINE.common_exit);
  allSteps.forEach(function(s){ if(s.key===stepKey) stepLabel=s.label; });

  if(!confirm('프로젝트를 "'+stepLabel+'" 단계로 되돌리시겠습니까?\n해당 단계 이후의 진행 상태가 초기화됩니다.'))return;

  try{
    await Opinion.setStatus(p.id, targetStatus);
    Opinion.state.viewStep=null;
    showToast('"'+stepLabel+'" 단계로 되돌렸습니다');
    Opinion.renderDetail();
  }catch(e){showToast('되돌리기 실패','error');}
};

// ═══ 네비게이션 바 HTML 생성 (각 화면 상단에 삽입) ═══
Opinion.renderNavBar = function(currentStepKey) {
  var p=Opinion.state.current; if(!p) return '';
  var type=p.rejection_type||'inventive_step';
  var allSteps=[].concat(Opinion.PIPELINE.common_entry, Opinion.PIPELINE[type]||Opinion.PIPELINE.inventive_step, Opinion.PIPELINE.common_exit);
  var cg=(Opinion.STATUS[p.status]||{}).g||'init';
  var ci=Opinion.GROUP_ORDER.indexOf(cg);
  var si=Opinion.STEP_GROUP[currentStepKey]!==undefined?Opinion.STEP_GROUP[currentStepKey]:-1;
  var isViewingPast = Opinion.state.viewStep !== null;

  // 이전/다음 스텝 찾기
  var currentIdx=-1;
  allSteps.forEach(function(s,i){ if(s.key===currentStepKey) currentIdx=i; });
  var prevStep = currentIdx>0 ? allSteps[currentIdx-1] : null;
  var prevClickable = prevStep && (Opinion.STEP_GROUP[prevStep.key]<ci);

  var h='<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">';

  // 이전 단계 보기
  if(prevClickable) {
    h+='<button class="btn btn-ghost btn-sm" onclick="Opinion.goToStep(\''+prevStep.key+'\')" style="font-size:12px">'
      +'<span class="ico" data-icon="arrow-left"></span> '+prevStep.label+'</button>';
  }

  // 현재 단계로 돌아가기 (과거 뷰일 때만)
  if(isViewingPast) {
    h+='<button class="btn btn-primary btn-sm" onclick="Opinion.goToCurrent()" style="font-size:12px">'
      +'<span class="ico" data-icon="arrow-right"></span> 현재 단계로</button>';
  }

  // 이 단계로 되돌리기 (과거 뷰일 때, 해당 단계부터 다시 시작)
  if(isViewingPast && si < ci) {
    h+='<button class="btn btn-outline btn-sm" onclick="Opinion.rollbackToStep(\''+currentStepKey+'\')" style="font-size:12px;color:var(--color-warning);border-color:var(--color-warning)">'
      +'<span class="ico" data-icon="refresh"></span> 여기서 다시 시작</button>';
  }

  // 파일 추가 (어느 단계에서든 파일 업로드 단계로 되돌릴 수 있음)
  if(!isViewingPast && currentStepKey !== 'upload' && si > 0) {
    h+='<button class="btn btn-ghost btn-sm" onclick="Opinion.rollbackToStep(\'upload\')" style="font-size:11px;margin-left:auto">'
      +'<span class="ico" data-icon="link"></span> 파일 추가/재업로드</button>';
  }

  h+='</div>';
  return h;
};

// ═══════════════════════════════════════════
// 4. 상태별 메인 콘텐츠 (viewStep 오버라이드 지원)
// ═══════════════════════════════════════════
