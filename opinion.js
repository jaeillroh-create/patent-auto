/* ═══════════════════════════════════════════════════════════
   의견서 대응 자동화 v2.0 — opinion.js
   3대 거절이유: A(진보성) / B(기재불비) / C(일부거절)
   namespace: window.Opinion  |  DB: opinion_*  |  CSS: opinion-
   의존: common.js (App, sb, callClaude, showToast, escapeHtml 등)
   ═══════════════════════════════════════════════════════════ */
window.Opinion = window.Opinion || {};

// ═══ Constants ═══
Opinion.TYPES = {
  inventive_step:         { code:'A', label:'진보성/신규성 위반', icon:'⚖️', css:'type-a', law:'§29①②' },
  description_deficiency: { code:'B', label:'기재불비 위반',      icon:'📝', css:'type-b', law:'§42③④' },
  partial_rejection:      { code:'C', label:'일부 청구항 거절',   icon:'📋', css:'type-c', law:'§29 등' }
};
Opinion.STATUS = {
  created:{label:'생성됨',css:'status-created',g:'init'},parsing:{label:'파싱 중',css:'status-parsing',g:'init'},parsed:{label:'파싱 완료',css:'status-analyzing',g:'init'},parse_failed:{label:'파싱 실패',css:'status-failed',g:'init'},type_determined:{label:'유형 판별됨',css:'status-analyzing',g:'init'},
  analyzing:{label:'분석 중',css:'status-analyzing',g:'analysis'},analyzed:{label:'분석 완료',css:'status-gate',g:'analysis'},strategy_confirmed:{label:'전략 확정',css:'status-drafting',g:'gate1'},
  deficiency_analyzed:{label:'지적분석 완료',css:'status-gate',g:'analysis'},correction_confirmed:{label:'수정방향 확정',css:'status-drafting',g:'gate1'},
  allowable_identified:{label:'등록가능 식별',css:'status-gate',g:'analysis'},merge_confirmed:{label:'병합 확정',css:'status-drafting',g:'gate1'},
  drafting_claims:{label:'청구항 작성 중',css:'status-drafting',g:'draft'},claims_drafted:{label:'청구항 초안',css:'status-validating',g:'draft'},
  drafting_corrections:{label:'수정 작성 중',css:'status-drafting',g:'draft'},corrections_drafted:{label:'수정 완료',css:'status-validating',g:'draft'},
  drafting_merge:{label:'병합 작성 중',css:'status-drafting',g:'draft'},merge_drafted:{label:'병합 완료',css:'status-validating',g:'draft'},
  validating:{label:'검증 중',css:'status-validating',g:'validate'},validated:{label:'검증 완료',css:'status-gate',g:'validate'},correction_validated:{label:'범위검증 완료',css:'status-gate',g:'validate'},merge_validated:{label:'병합검증 완료',css:'status-gate',g:'validate'},
  claims_confirmed:{label:'청구항 확정',css:'status-drafting',g:'gate2'},drafting_opinion:{label:'의견서 작성 중',css:'status-drafting',g:'opinion'},opinion_drafted:{label:'의견서 초안',css:'status-gate',g:'opinion'},
  approved:{label:'최종 승인',css:'status-approved',g:'gate3'},generating_docs:{label:'문서 생성 중',css:'status-drafting',g:'output'},completed:{label:'완료',css:'status-completed',g:'output'}
};
Opinion.PIPELINE = {
  common_entry:[{key:'upload',label:'파일 업로드'},{key:'parse',label:'파싱'},{key:'type',label:'유형 판별'}],
  inventive_step:[{key:'analyze',label:'차이 분석'},{key:'gate1',label:'Gate 1'},{key:'draft',label:'청구항 초안'},{key:'validate',label:'뒷받침 검증'},{key:'gate2',label:'Gate 2'}],
  description_deficiency:[{key:'analyze',label:'지적사항 분석'},{key:'gate1',label:'Gate 1'},{key:'draft',label:'수정 청구항'},{key:'validate',label:'범위 검증'},{key:'gate2',label:'Gate 2'}],
  partial_rejection:[{key:'analyze',label:'등록가능 식별'},{key:'gate1',label:'Gate 1'},{key:'draft',label:'병합 청구항'},{key:'validate',label:'병합 검증'},{key:'gate2',label:'Gate 2'}],
  common_exit:[{key:'opinion',label:'의견서'},{key:'gate3',label:'Gate 3'},{key:'output',label:'출력'}]
};
Opinion.SYS_PROMPT = '너는 대한민국 특허청(KIPO) 의견제출통지서 대응 실무에 정통한 15년 차 수석 변리사이다.\n원칙:\n1. 한국 특허법 조항(§29, §42 등)에 근거하여 판단\n2. 특허청 표준 서식과 문체\n3. 명세서 뒷받침(신규사항 추가 금지) 최우선\n4. 인용발명 유래 용어 금지\n5. 구조화된 JSON 반환';

// ═══ State ═══
Opinion.state = { projects:[], current:null, view:'list', files:[], analysis:null, validation:null, opinionDraft:null, typeResult:null, gateDecisions:{} };

// ═══ Init ═══
Opinion.init = function(){ console.log('[Opinion] init'); Opinion.loadProjects(); };

// ═══ Sub-Tab ═══
App.switchPatentSubTab = function(sub){
  document.querySelectorAll('.patent-sub-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.subtab===sub); });
  document.querySelectorAll('.patent-sub-panel').forEach(function(p){ p.classList.remove('active'); });
  var el=document.getElementById('patent-sub-'+sub); if(el) el.classList.add('active');
  if(sub==='opinion') Opinion.init();
  history.replaceState(null,'','#patent-'+sub);
};

// ═══════════════════════════════════════════
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
  if(!ps.length){ el.innerHTML='<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--color-text-tertiary);font-size:13px"><div style="font-size:32px;margin-bottom:8px"><span class="tossface">📭</span></div>의견서 대응 프로젝트가 없습니다.<br><span style="font-size:12px">새 프로젝트를 만들어 의견제출통지서에 대응하세요.</span></td></tr>'; return; }
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
  var p=Opinion.state.projects.find(function(x){return x.id===id;});
  if(!p){showToast('프로젝트를 찾을 수 없습니다','error');return;}
  Opinion.state.current=p; Opinion.state.view='detail'; Opinion.state.viewStep=null;
  document.getElementById('opinionListView').style.display='none';
  document.getElementById('opinionDetailView').style.display='block';
  Opinion.renderDetail();
  await Opinion.loadData(id);
};

Opinion.backToList = function(){
  Opinion.state.current=null; Opinion.state.view='list'; Opinion.state.viewStep=null;
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
  document.getElementById('opinionDetailType').innerHTML='<span class="opinion-type-badge '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</span>';
  document.getElementById('opinionDetailStatus').innerHTML='<span class="opinion-status-badge '+s.css+'">'+s.label+'</span>';
  Opinion.renderPipeline(p);
  Opinion.renderMain(p);
};

// ═══ Step ↔ Status 매핑 ═══
Opinion.STEP_GROUP = {upload:0,parse:0,type:0,analyze:1,gate1:2,draft:3,validate:4,gate2:5,opinion:6,gate3:7,output:8};
Opinion.GROUP_ORDER = ['init','analysis','gate1','draft','validate','gate2','opinion','gate3','output'];

// step key → 해당 단계의 "완료" 상태 (뷰 전환용)
Opinion.STEP_TO_VIEW_STATUS = function(stepKey, type) {
  var map = {
    upload:'created', parse:'parsed', type:'type_determined',
    analyze: type==='description_deficiency'?'deficiency_analyzed':type==='partial_rejection'?'allowable_identified':'analyzed',
    gate1: type==='description_deficiency'?'correction_confirmed':type==='partial_rejection'?'merge_confirmed':'strategy_confirmed',
    draft: type==='description_deficiency'?'corrections_drafted':type==='partial_rejection'?'merge_drafted':'claims_drafted',
    validate: type==='description_deficiency'?'correction_validated':type==='partial_rejection'?'merge_validated':'validated',
    gate2:'claims_confirmed', opinion:'opinion_drafted', gate3:'approved', output:'completed'
  };
  return map[stepKey] || 'created';
};

// step key → 해당 단계의 "시작" 상태 (되돌리기용)
Opinion.STEP_TO_RESET_STATUS = function(stepKey, type) {
  var map = {
    upload:'created', parse:'created', type:'parsed',
    analyze:'type_determined',
    gate1: type==='description_deficiency'?'deficiency_analyzed':type==='partial_rejection'?'allowable_identified':'analyzed',
    draft: type==='description_deficiency'?'correction_confirmed':type==='partial_rejection'?'merge_confirmed':'strategy_confirmed',
    validate: type==='description_deficiency'?'drafting_corrections':type==='partial_rejection'?'drafting_merge':'drafting_claims',
    gate2: type==='description_deficiency'?'correction_validated':type==='partial_rejection'?'merge_validated':'validated',
    opinion:'claims_confirmed', gate3:'opinion_drafted', output:'approved'
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
      +'<span class="tossface">←</span> '+prevStep.label+'</button>';
  }

  // 현재 단계로 돌아가기 (과거 뷰일 때만)
  if(isViewingPast) {
    h+='<button class="btn btn-primary btn-sm" onclick="Opinion.goToCurrent()" style="font-size:12px">'
      +'<span class="tossface">▶</span> 현재 단계로</button>';
  }

  // 이 단계로 되돌리기 (과거 뷰일 때, 해당 단계부터 다시 시작)
  if(isViewingPast && si < ci) {
    h+='<button class="btn btn-outline btn-sm" onclick="Opinion.rollbackToStep(\''+currentStepKey+'\')" style="font-size:12px;color:var(--color-warning);border-color:var(--color-warning)">'
      +'<span class="tossface">↩️</span> 여기서 다시 시작</button>';
  }

  h+='</div>';
  return h;
};

// ═══════════════════════════════════════════
// 4. 상태별 메인 콘텐츠 (viewStep 오버라이드 지원)
// ═══════════════════════════════════════════
Opinion.renderMain = function(p){
  var L=document.getElementById('opinionDetailLeft'), R=document.getElementById('opinionDetailRight');
  if(!L||!R)return;

  // viewStep이 설정되어 있으면 해당 단계의 뷰를 표시
  var viewStep=Opinion.state.viewStep;
  var s = viewStep ? Opinion.STEP_TO_VIEW_STATUS(viewStep, p.rejection_type) : p.status;

  if(s==='created') return Opinion.renderUpload(L,R);
  if(s==='parsing') return Opinion.renderLoading(L,R,'문서 파싱 중...','PDF에서 텍스트를 추출하고 있습니다');
  if(s==='parsed') return Opinion.renderParsed(L,R);
  if(s==='parse_failed') return Opinion.renderFailed(L,R);
  if(s==='type_determined') return Opinion.renderTypeView(L,R);
  if(['analyzing','analyzed','deficiency_analyzed','allowable_identified'].indexOf(s)>=0) return Opinion.renderAnalysis(L,R,s);
  if(['strategy_confirmed','correction_confirmed','merge_confirmed'].indexOf(s)>=0) return Opinion.renderAnalysis(L,R,s==='correction_confirmed'?'deficiency_analyzed':s==='merge_confirmed'?'allowable_identified':'analyzed');
  if(['validating','validated','correction_validated','merge_validated'].indexOf(s)>=0) return Opinion.renderValidation(L,R,s);
  if(['claims_confirmed','drafting_opinion','opinion_drafted'].indexOf(s)>=0) return Opinion.renderOpinion(L,R,s);
  if(['approved','generating_docs','completed'].indexOf(s)>=0) return Opinion.renderOutput(L,R,s);
  // drafting states
  if(['drafting_claims','claims_drafted','drafting_corrections','corrections_drafted','drafting_merge','merge_drafted'].indexOf(s)>=0) {
    return Opinion.renderLoading(L,R,'청구항 작성 중...','AI가 초안을 생성하고 있습니다');
  }
  Opinion.renderUpload(L,R);
};

Opinion.renderLoading = function(L,R,title,desc){
  L.innerHTML='<div class="card" style="text-align:center;padding:40px"><div class="progress-dot" style="width:32px;height:32px;margin:0 auto 12px;animation:pulse 1.5s infinite"></div><div style="font-size:14px;font-weight:600">'+title+'</div><p style="font-size:12px;color:var(--color-text-tertiary);margin-top:6px">'+desc+'</p></div>';
  R.innerHTML='';
};

// ═══════════════════════════════════════════
// 5. 파일 업로드
// ═══════════════════════════════════════════
Opinion.renderUpload = function(L,R){
  Opinion.state.files=[];
  L.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">📁</span> 파일 업로드</div></div>'
    +'<div class="opinion-upload-zone" id="opinionUploadZone" onclick="document.getElementById(\'opinionFileInput\').click()" ondragover="event.preventDefault();this.classList.add(\'dragover\')" ondragleave="this.classList.remove(\'dragover\')" ondrop="event.preventDefault();this.classList.remove(\'dragover\');Opinion.handleDrop(event)">'
    +'<div style="font-size:36px;margin-bottom:8px"><span class="tossface">📎</span></div>'
    +'<div style="font-size:13px;color:var(--color-text-secondary)">클릭 또는 드래그하여 파일 업로드<br><span style="font-size:11px;color:var(--color-text-tertiary)">PDF, DOCX, HWP, TXT</span></div></div>'
    +'<input type="file" id="opinionFileInput" multiple accept=".pdf,.docx,.doc,.hwp,.hwpx,.txt" style="display:none" onchange="Opinion.handleFiles(event)" />'
    +'<div id="opinionFileList" class="opinion-file-list"></div></div>'
    +'<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">ℹ️</span> 필수 파일</div></div>'
    +'<div style="font-size:12px;line-height:1.7;color:var(--color-text-secondary)">'
    +'<div style="margin-bottom:4px"><span class="tossface">📋</span> <b>의견제출통지서</b> (필수)</div>'
    +'<div style="margin-bottom:4px"><span class="tossface">📄</span> <b>인용발명 공보</b> (유형 A/C 필수)</div>'
    +'<div><span class="tossface">📑</span> <b>출원 명세서</b> (필수)</div></div></div>'
    +'<div id="opinionParseProgress" style="margin-top:8px"></div>'
    +'<button class="btn btn-primary btn-full" id="btnOpinionParse" onclick="Opinion.startParsing()" disabled><span class="tossface">🔍</span> 문서 파싱 시작</button>';
  R.innerHTML='<div class="card" style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:12px"><span class="tossface">📋</span></div><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">의견제출통지서를 업로드하세요</h3><p style="font-size:13px;color:var(--color-text-secondary);line-height:1.6;max-width:400px;margin:0 auto">통지서를 업로드하면 AI가 자동으로 거절이유를 분석하고,<br>보정 전략 → 청구항 초안 → 검증 → 의견서 생성까지 안내합니다.</p></div>';
};
Opinion.handleFiles=function(e){Array.from(e.target.files||[]).forEach(function(f){Opinion.addFile(f);});e.target.value='';};
Opinion.handleDrop=function(e){Array.from(e.dataTransfer.files||[]).forEach(function(f){Opinion.addFile(f);});};
Opinion.addFile=function(f){
  var ext='.'+f.name.split('.').pop().toLowerCase();
  if(['.pdf','.docx','.doc','.hwp','.hwpx','.txt'].indexOf(ext)<0){showToast('지원하지 않는 형식: '+ext,'error');return;}
  if(Opinion.state.files.some(function(x){return x.name===f.name;})){return;}
  Opinion.state.files.push(f); Opinion.renderFiles();
  var btn=document.getElementById('btnOpinionParse'); if(btn) btn.disabled=!Opinion.state.files.length;
};
Opinion.removeFile=function(i){Opinion.state.files.splice(i,1);Opinion.renderFiles();var btn=document.getElementById('btnOpinionParse');if(btn)btn.disabled=!Opinion.state.files.length;};
Opinion.renderFiles=function(){
  var el=document.getElementById('opinionFileList'); if(!el)return;
  el.innerHTML=Opinion.state.files.map(function(f,i){
    var ext=f.name.split('.').pop().toUpperCase();
    var icon=ext==='PDF'?'📕':ext==='DOCX'||ext==='DOC'?'📘':'📄';
    var sz=f.size<1048576?Math.round(f.size/1024)+'KB':(f.size/1048576).toFixed(1)+'MB';
    return '<div class="opinion-file-item"><span class="tossface">'+icon+'</span><span class="file-name">'+escapeHtml(f.name)+'</span><span class="file-type">'+ext+' · '+sz+'</span><button class="file-remove" onclick="Opinion.removeFile('+i+')">✕</button></div>';
  }).join('');
};

// ═══════════════════════════════════════════
// 6. 파싱 (Phase 1)
// ═══════════════════════════════════════════
// 텍스트 추출 — common.js의 App.extractTextFromFile 활용
Opinion.extractFileText = async function(file) {
  try {
    return await extractTextFromFile(file);
  } catch (e) {
    console.warn('[Opinion] Extract failed:', file.name, e);
    return '[텍스트 추출 실패: ' + file.name + ']';
  }
};

Opinion.startParsing = async function(){
  var p=Opinion.state.current; if(!p||!Opinion.state.files.length)return;
  setButtonLoading('btnOpinionParse',true);
  await Opinion.setStatus(p.id,'parsing');
  Opinion.renderDetail();

  try{
    // 1. 파일 메타 DB 저장
    for(var i=0;i<Opinion.state.files.length;i++){
      var f=Opinion.state.files[i];
      try { await sb.from('opinion_project_files').insert({
        project_id:p.id, file_name:f.name, file_path:f.name, file_size:f.size
      }); } catch(dbErr) { console.warn('[Opinion] File DB insert skipped:', dbErr.message); }
    }

    // 2. 파일별 텍스트 추출 (common.js의 extractTextFromFile 활용)
    var allText = '';
    var totalFiles = Opinion.state.files.length;
    for(var j=0;j<totalFiles;j++){
      var ff=Opinion.state.files[j];
      showProgress('opinionParseProgress', ff.name+' 추출 중...', j+1, totalFiles);
      var fileText = await Opinion.extractFileText(ff);
      allText += '=== [' + ff.name + '] ===\n' + fileText + '\n\n';
    }

    if(allText.replace(/===\s*\[.*?\]\s*===/g,'').trim().length < 50){
      throw new Error('파일에서 추출된 텍스트가 너무 적습니다. PDF가 이미지 스캔본일 수 있습니다.');
    }

    // 3. LLM 파싱
    showProgress('opinionParseProgress', 'AI 분석 중...', totalFiles, totalFiles);
    var r=await App.callClaude(Opinion.SYS_PROMPT+'\n\n다음 의견제출통지서 및 관련 문서의 텍스트를 분석하여 구조화해 주세요.\n\n추출할 항목 (반드시 JSON으로):\n1. application_no: 출원번호\n2. applicant: 출원인\n3. invention_title: 발명의 명칭\n4. rejection_reasons: [{claim_nos:[N], article:"§29②", reason:"진보성 위반", cited_refs:["인용문헌1"]}]\n5. cited_references: [{ref_no:N, title:"...", publication_no:"..."}]\n6. claims: [{no:N, text:"..."}]\n7. comparison_table: [{element_no:N, applicant_feature:"...", cited_feature:"..."}] (있는 경우)\n\n---\n'+allText.slice(0,30000));

    var parsed = Opinion.parseJSON(r.text);
    await sb.from('opinion_parsed_documents').insert({project_id:p.id, raw_text:allText.slice(0,100000), parsed_data:parsed});
    clearProgress('opinionParseProgress');
    await Opinion.setStatus(p.id,'parsed');
    showToast('파싱 완료'); Opinion.renderDetail();
  }catch(e){
    console.error('[Opinion] parse:',e);
    clearProgress('opinionParseProgress');
    await Opinion.setStatus(p.id,'parse_failed');
    showToast('파싱 실패: '+e.message,'error');
    Opinion.renderDetail();
  }
  finally{setButtonLoading('btnOpinionParse',false);}
};

// ═══════════════════════════════════════════
// 7. 유형 판별 (Phase 2)
// ═══════════════════════════════════════════
Opinion.renderParsed = function(L,R){
  L.innerHTML=Opinion.renderNavBar('parse')+'<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">✅</span> 파싱 완료</div></div><p style="font-size:13px;color:var(--color-text-secondary);line-height:1.6">문서 파싱이 완료되었습니다.<br>결과를 확인한 후 유형을 판별합니다.</p><button class="btn btn-primary btn-full" id="btnOpinionType" onclick="Opinion.determineType()" style="margin-top:12px"><span class="tossface">🔍</span> 유형 판별 시작</button></div>';
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">📋</span> 파싱 결과</div></div><div id="opinionParsedContent" style="font-size:13px;color:var(--color-text-secondary);padding:4px 0">로딩 중...</div></div>';
  Opinion.loadParsed();
};
Opinion.loadParsed = async function(){
  var p=Opinion.state.current,el=document.getElementById('opinionParsedContent');if(!p||!el)return;
  try{var{data}=await sb.from('opinion_parsed_documents').select('parsed_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).single();
    if(data&&data.parsed_data){ Opinion.renderParsedUI(el, data.parsed_data); }
    else { el.textContent='파싱 데이터가 없습니다.'; }
  }catch(e){el.textContent='데이터를 불러올 수 없습니다.';}
};

// 파싱 결과 구조화 렌더링
Opinion.renderParsedUI = function(el, pd) {
  if(pd.raw_text && !pd.application_no) {
    // LLM이 구조화 실패 → raw_text만 있는 경우
    el.innerHTML='<div style="padding:12px;background:var(--color-warning-light);border-radius:8px;border-left:3px solid var(--color-warning);margin-bottom:12px"><div style="font-weight:600;font-size:12px;color:#92400e;margin-bottom:4px">⚠️ 자동 구조화에 실패했습니다</div><div style="font-size:12px;color:#92400e">PDF 내용이 이미지 스캔본이거나 형식이 비표준일 수 있습니다. 유형 판별은 원문 기준으로 진행됩니다.</div></div>'
      +'<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--color-text-secondary)">원문 텍스트 보기</summary>'
      +'<pre style="white-space:pre-wrap;font-size:11px;background:var(--color-bg-tertiary);padding:12px;border-radius:8px;max-height:300px;overflow-y:auto;margin-top:8px">'+escapeHtml(pd.raw_text.slice(0,3000))+'</pre></details>';
    return;
  }

  var h='';

  // 기본 정보
  if(pd.application_no||pd.invention_title||pd.applicant) {
    h+='<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;padding:14px;background:var(--color-bg-tertiary);border-radius:8px;margin-bottom:14px;font-size:13px">';
    if(pd.application_no) h+='<span style="font-weight:600;color:var(--color-text-secondary)">출원번호</span><span>'+escapeHtml(pd.application_no)+'</span>';
    if(pd.invention_title) h+='<span style="font-weight:600;color:var(--color-text-secondary)">발명의 명칭</span><span>'+escapeHtml(pd.invention_title)+'</span>';
    if(pd.applicant) h+='<span style="font-weight:600;color:var(--color-text-secondary)">출원인</span><span>'+escapeHtml(pd.applicant)+'</span>';
    h+='</div>';
  }

  // 거절이유
  if(pd.rejection_reasons&&pd.rejection_reasons.length) {
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="tossface">⚠️</span> 거절이유</div>';
    pd.rejection_reasons.forEach(function(rr) {
      h+='<div style="padding:10px 14px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:6px;background:#fff">'
        +'<div style="font-size:13px;font-weight:600;color:var(--color-error)">'+escapeHtml(rr.article||'')+'<span style="font-weight:400;color:var(--color-text-secondary);margin-left:8px">'+escapeHtml(rr.reason||'')+'</span></div>'
        +(rr.claim_nos?'<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:4px">대상 청구항: '+rr.claim_nos.join(', ')+'</div>':'')
        +(rr.cited_refs?'<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">인용문헌: '+rr.cited_refs.join(', ')+'</div>':'')
        +'</div>';
    });
    h+='</div>';
  }

  // 인용문헌
  if(pd.cited_references&&pd.cited_references.length) {
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="tossface">📄</span> 인용문헌</div>';
    pd.cited_references.forEach(function(ref) {
      h+='<div style="padding:8px 12px;background:var(--color-bg-tertiary);border-radius:6px;margin-bottom:4px;font-size:12px">'
        +'<span style="font-weight:600">'+escapeHtml('인용문헌 '+(ref.ref_no||''))+'</span> '
        +escapeHtml(ref.title||ref.publication_no||'')
        +'</div>';
    });
    h+='</div>';
  }

  // 청구항
  if(pd.claims&&pd.claims.length) {
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="tossface">📑</span> 청구항 ('+pd.claims.length+'개)</div>';
    h+='<details><summary style="cursor:pointer;font-size:12px;color:var(--color-primary);font-weight:500">청구항 펼치기</summary><div style="margin-top:8px">';
    pd.claims.forEach(function(c) {
      h+='<div style="padding:8px 12px;border-left:3px solid var(--color-primary-light);margin-bottom:6px;font-size:12px;line-height:1.6;background:var(--color-bg-tertiary);border-radius:0 6px 6px 0">'
        +'<span style="font-weight:600;color:var(--color-primary)">【청구항 '+c.no+'】</span> '
        +escapeHtml((c.text||'').slice(0,200))+(c.text&&c.text.length>200?'...':'')
        +'</div>';
    });
    h+='</div></details></div>';
  }

  // 대비표
  if(pd.comparison_table&&pd.comparison_table.length) {
    h+='<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span class="tossface">⚖️</span> 구성요소 대비표</div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--color-bg-tertiary)"><th style="padding:8px;text-align:left;border-bottom:1px solid var(--color-border)">구성요소</th><th style="padding:8px;text-align:left;border-bottom:1px solid var(--color-border)">본원</th><th style="padding:8px;text-align:left;border-bottom:1px solid var(--color-border)">인용발명</th></tr></thead><tbody>';
    pd.comparison_table.forEach(function(row) {
      h+='<tr><td style="padding:6px 8px;border-bottom:1px solid var(--color-divider);font-weight:600">❶ '+(row.element_no||'')+'</td>'
        +'<td style="padding:6px 8px;border-bottom:1px solid var(--color-divider)">'+escapeHtml(row.applicant_feature||'-')+'</td>'
        +'<td style="padding:6px 8px;border-bottom:1px solid var(--color-divider)">'+escapeHtml(row.cited_feature||'-')+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }

  el.innerHTML = h || '<p style="color:var(--color-text-tertiary)">파싱 데이터가 비어 있습니다.</p>';
};

Opinion.determineType = async function(){
  var p=Opinion.state.current;if(!p)return;
  setButtonLoading('btnOpinionType',true);
  try{
    var{data:pd}=await sb.from('opinion_parsed_documents').select('parsed_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).single();
    var ctx=pd?JSON.stringify(pd.parsed_data||{}).slice(0,8000):'';
    var r=await App.callClaude(Opinion.SYS_PROMPT+'\n\n유형 판별:\nA. inventive_step(§29①②)\nB. description_deficiency(§42③④)\nC. partial_rejection(등록가능 청구항 존재)\n\nJSON만: {"primary_type":"...","confidence":0.0~1.0,"reasoning":"...","secondary_type":null,"claim_summary":{"total_claims":N,"rejected_claims":[...],"no_rejection_claims":[...]}}\n\n---\n'+ctx);
    var tr=Opinion.parseJSON(r.text);
    await sb.from('opinion_type_determinations').insert({project_id:p.id,determined_type:tr.primary_type||'inventive_step',confidence:tr.confidence||0.5,reasoning:tr.reasoning||'',user_confirmed:false});
    await sb.from('opinion_projects').update({rejection_type:tr.primary_type||'inventive_step',secondary_rejection_type:tr.secondary_type||null,status:'type_determined'}).eq('id',p.id);
    p.rejection_type=tr.primary_type||'inventive_step'; p.status='type_determined';
    Opinion.state.typeResult=tr; Opinion.renderDetail(); showToast('유형 판별 완료');
  }catch(e){showToast('유형 판별 실패: '+e.message,'error');}
  finally{setButtonLoading('btnOpinionType',false);}
};

Opinion.renderTypeView = function(L,R){
  var p=Opinion.state.current, t=Opinion.TYPES[p.rejection_type]||Opinion.TYPES.inventive_step, tr=Opinion.state.typeResult||{}, conf=Math.round((tr.confidence||0.5)*100);
  L.innerHTML=Opinion.renderNavBar('type')+'<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">🔍</span> 유형 판별 결과</div></div>'
    +'<div class="opinion-type-result"><div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px">AI 분석 결과</div>'
    +'<div class="opinion-type-determined '+t.css+'">'+t.icon+' '+t.code+'. '+t.label+'</div>'
    +'<div style="font-size:12px;color:var(--color-text-tertiary)">신뢰도: '+conf+'% <div class="opinion-confidence-bar"><div class="opinion-confidence-fill" style="width:'+conf+'%"></div></div></div>'
    +(tr.reasoning?'<p style="font-size:12px;color:var(--color-text-secondary);text-align:left;line-height:1.6;margin-top:12px;padding:10px;background:var(--color-bg-tertiary);border-radius:8px">'+escapeHtml(tr.reasoning)+'</p>':'')
    +'</div><div style="margin-top:16px"><div style="font-size:13px;font-weight:600;margin-bottom:8px">이 판별이 맞습니까?</div>'
    +'<div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="Opinion.confirmType()"><span class="tossface">✅</span> 맞습니다</button><button class="btn btn-outline" style="flex:1" onclick="document.getElementById(\'opinionTypeOverride\').style.display=\'block\'"><span class="tossface">✏️</span> 유형 변경</button></div>'
    +'<div id="opinionTypeOverride" style="display:none;margin-top:12px"><div class="opinion-type-selector">'
    +'<div class="opinion-type-option'+(p.rejection_type==='inventive_step'?' selected':'')+'" onclick="Opinion.selectType(this,\'inventive_step\')">⚖️ A. 진보성</div>'
    +'<div class="opinion-type-option'+(p.rejection_type==='description_deficiency'?' selected':'')+'" onclick="Opinion.selectType(this,\'description_deficiency\')">📝 B. 기재불비</div>'
    +'<div class="opinion-type-option'+(p.rejection_type==='partial_rejection'?' selected':'')+'" onclick="Opinion.selectType(this,\'partial_rejection\')">📋 C. 일부거절</div>'
    +'</div><button class="btn btn-primary btn-full" style="margin-top:10px" onclick="Opinion.confirmType()">변경 후 진행</button></div></div></div>';
  var cs=tr.claim_summary||{}, tot=cs.total_claims||0, rej=cs.rejected_claims||[], alw=cs.no_rejection_claims||[];
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">📊</span> 청구항별 현황</div></div>'
    +(tot>0?Array.from({length:tot},function(_,i){var n=i+1,isR=rej.indexOf(n)>=0,isA=alw.indexOf(n)>=0;return '<div class="opinion-claim-row '+(isA?'allowable':isR?'rejected':'')+'"><span class="claim-no">청구항 '+n+'</span><span>'+(isA?'✅':isR?'❌':'⬜')+'</span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+(isA?'등록가능 후보':isR?'거절':'미확인')+'</span></div>';}).join(''):'<p style="padding:20px;text-align:center;color:var(--color-text-tertiary)">청구항 정보 없음</p>')+'</div>';
};
Opinion.selectType=function(el,type){document.querySelectorAll('.opinion-type-option').forEach(function(o){o.classList.remove('selected');});el.classList.add('selected');Opinion.state.current.rejection_type=type;};
Opinion.confirmType=async function(){
  var p=Opinion.state.current;if(!p)return;
  try{await sb.from('opinion_type_determinations').update({user_confirmed:true,user_override:p.rejection_type}).eq('project_id',p.id);await Opinion.startAnalysis();}catch(e){showToast('유형 확정 실패','error');}
};

// ═══════════════════════════════════════════
// 8. 분석 → Gate1 → 초안 → 검증 → Gate2 → 의견서 → Gate3 → 출력
// ═══════════════════════════════════════════
Opinion.startAnalysis = async function(){
  var p=Opinion.state.current;if(!p)return;
  var type=p.rejection_type, next=type==='description_deficiency'?'deficiency_analyzed':type==='partial_rejection'?'allowable_identified':'analyzed';
  await Opinion.setStatus(p.id,'analyzing'); Opinion.renderDetail();
  try{
    var{data:pd}=await sb.from('opinion_parsed_documents').select('parsed_data,raw_text').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).single();
    var ctx='';
    if(pd) {
      if(pd.parsed_data && pd.parsed_data.application_no) ctx+='[파싱 결과]\n'+JSON.stringify(pd.parsed_data,null,1).slice(0,5000)+'\n\n';
      if(pd.raw_text) ctx+='[원문]\n'+pd.raw_text.slice(0,20000)+'\n\n';
    }
    var prompts={
      inventive_step:'위 의견제출통지서와 명세서를 분석하여 구성요소별 차이점과 보정 전략을 도출해 주세요.\n\n'
        +'구성요소별 분석: 심사관이 대비한 각 구성요소에 대해, 본원 명세서의 실제 내용과 인용발명의 실제 내용을 비교하여 구체적 차이점을 서술하세요. 추상적 placeholder([차이점] 등)는 절대 사용하지 마세요.\n\n'
        +'보정 전략: 각 전략에 대해 구체적으로 어떤 종속항을 병합하고 어떤 구성요소를 구체화할지, 그 근거와 위험도를 서술하세요.\n\n'
        +'JSON:\n{"elements":[\n  {"element_id":"E1","claim_element":"실제 청구항 구성요소 문언","cited_ref":"인용문헌 N","cited_disclosure":"인용발명에 개시된 실제 내용","difference":"본원과의 구체적 차이점","strength":"strong|medium|weak","non_obviousness_argument":"진보성 주장 근거"}\n],\n"strategies":[\n  {"id":"S1","name":"전략명 (예: 종속항3 병합 + 감정엔진 구체화)","rationale":"이 전략의 근거와 기대 효과를 2~3문장으로","target_elements":["E3","E5"],"merge_claims":[3],"scope_impact":"narrow|moderate|broad","risk":"low|medium|high"}\n],\n"cited_references":[\n  {"ref_no":1,"title":"인용문헌 제목","key_features":"핵심 기술 요약"}\n]}',
      description_deficiency:'위 의견제출통지서의 기재불비 지적사항을 분석하세요. 각 지적에 대해 실제 심사관 지적 내용과 명세서에서 대응 기재를 찾아 구체적 수정 방향을 제시하세요.\n\nJSON:\n[{"claim_no":N,"deficiency_type":"unclear|inconsistent|unsupported","examiner_comment":"심사관 지적 원문","spec_reference":"【0001】등 관련 단락","suggested_correction":"구체적 수정 문언 제안"}]',
      partial_rejection:'위 의견제출통지서에서 청구항별 거절 상태를 분석하고 등록가능 청구항을 식별하세요.\n\nJSON:\n{"rejected_claims":[{"claim_no":N,"reason":"진보성 위반 등 구체적 이유"}],"allowable_claims":[{"claim_no":N,"basis":"거절이유 미지적 등 근거"}],"merge_suggestion":{"target":1,"source":N,"rationale":"병합 이유와 기대 효과"}}'
    };
    var r=await App.callClaude(Opinion.SYS_PROMPT+'\n\n'+ctx+'\n'+prompts[type]);
    var ar=Opinion.parseJSON(r.text);
    await sb.from('opinion_issue_analyses').insert({project_id:p.id,analysis_type:type,result_data:ar});
    Opinion.state.analysis=ar; await Opinion.setStatus(p.id,next); Opinion.renderDetail(); showToast('분석 완료');
  }catch(e){showToast('분석 실패: '+e.message,'error');await Opinion.setStatus(p.id,'type_determined');Opinion.renderDetail();}
};

Opinion.renderAnalysis = function(L,R,status){
  var p=Opinion.state.current, type=p.rejection_type, done=['analyzed','deficiency_analyzed','allowable_identified'].indexOf(status)>=0;
  if(!done){Opinion.renderLoading(L,R,'분석 중...','AI가 거절이유를 분석하고 있습니다');return;}
  var a=Opinion.state.analysis||{};
  var gLabel=type==='inventive_step'?'전략 결정':type==='description_deficiency'?'수정 방향 확인':'병합 대상 확정';
  L.innerHTML=Opinion.renderNavBar('gate1')+'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="tossface">🚦</span> Gate 1: '+gLabel+'</div><p style="font-size:13px;color:var(--color-text-secondary)">분석 결과를 검토하고 확정해 주세요.</p>'
    +(type==='inventive_step'&&a.strategies&&a.strategies.length?'<div style="margin-top:12px">'+a.strategies.map(function(s,i){
      var riskColor=s.risk==='low'?'var(--color-success)':s.risk==='high'?'var(--color-error)':'var(--color-warning)';
      return '<label style="display:flex;align-items:flex-start;gap:10px;padding:14px;border:2px solid var(--color-border);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.borderColor=\'var(--color-primary)\'" onmouseout="this.style.borderColor=\'var(--color-border)\'">'
        +'<input type="radio" name="opinionStrategy" value="'+i+'" '+(i===0?'checked':'')+' style="margin-top:4px" />'
        +'<div style="flex:1">'
        +'<div style="font-size:14px;font-weight:600;color:var(--color-primary)">'+escapeHtml(s.name||('전략 '+(i+1)))+'</div>'
        +(s.rationale?'<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;line-height:1.6">'+escapeHtml(s.rationale)+'</div>':'')
        +'<div style="display:flex;gap:10px;margin-top:8px;font-size:11px;flex-wrap:wrap">'
        +(s.scope_impact?'<span style="padding:2px 8px;border-radius:10px;background:var(--color-bg-tertiary)">📐 범위: <b>'+escapeHtml(s.scope_impact)+'</b></span>':'')
        +(s.risk?'<span style="padding:2px 8px;border-radius:10px;background:'+riskColor+'15;color:'+riskColor+'">⚠️ 위험: <b>'+escapeHtml(s.risk)+'</b></span>':'')
        +(s.target_elements?'<span style="padding:2px 8px;border-radius:10px;background:var(--color-bg-tertiary)">🎯 대상: '+s.target_elements.join(', ')+'</span>':'')
        +(s.merge_claims?'<span style="padding:2px 8px;border-radius:10px;background:var(--color-bg-tertiary)">🔗 병합: 청구항 '+s.merge_claims.join(', ')+'</span>':'')
        +'</div></div></label>';
    }).join('')+'</div>':'<p style="margin-top:12px;font-size:13px;color:var(--color-text-secondary)">오른쪽 분석 결과를 검토 후 확정해 주세요.</p>')
    +'<div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.backToList()">나중에</button><button class="btn btn-primary" id="btnGate1Approve" onclick="Opinion.approveGate(1)"><span class="tossface">✅</span> 확정</button></div></div>';
  R.innerHTML = Opinion.renderAnalysisUI(type, a);
};

// 분석 결과 구조화 렌더링
Opinion.renderAnalysisUI = function(type, a) {
  var h = '<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">📊</span> 분석 결과</div></div>';

  if (type === 'inventive_step') {
    // 구성요소별 분석
    var elements = a.elements || [];
    if (elements.length) {
      h += '<div style="margin-bottom:16px"><div style="font-weight:600;font-size:13px;margin-bottom:10px">구성요소별 대비</div>';
      elements.forEach(function(el) {
        var strengthColor = el.strength === 'strong' ? 'var(--color-success)' : el.strength === 'weak' ? 'var(--color-error)' : 'var(--color-warning)';
        var strengthLabel = el.strength === 'strong' ? '강함' : el.strength === 'weak' ? '약함' : '보통';
        h += '<div style="padding:12px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:8px">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
          + '<span style="font-weight:600;font-size:13px">' + escapeHtml(el.element_id || ('구성요소 ' + el.no)) + '</span>'
          + '<span style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:12px;background:' + strengthColor + '20;color:' + strengthColor + '">차이 ' + strengthLabel + '</span>'
          + '</div>'
          + '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.6">' + escapeHtml(el.claim_element || el.description || '') + '</div>'
          + (el.difference ? '<div style="font-size:12px;margin-top:6px;padding:8px 10px;background:var(--color-bg-tertiary);border-radius:6px;color:var(--color-text-primary)"><b>차이점:</b> ' + escapeHtml(el.difference) + '</div>' : '')
          + (el.non_obviousness_argument ? '<div style="font-size:11px;margin-top:4px;color:var(--color-primary)">💡 ' + escapeHtml(el.non_obviousness_argument).slice(0, 120) + '</div>' : '')
          + '</div>';
      });
      h += '</div>';
    }

    // 전략 대안 (간략 표시)
    var strategies = a.strategies || [];
    if (strategies.length) {
      h += '<div style="margin-bottom:12px"><div style="font-weight:600;font-size:13px;margin-bottom:10px">보정 전략 대안 (' + strategies.length + '개)</div>';
      strategies.forEach(function(s, i) {
        h += '<div style="padding:10px 14px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:6px">'
          + '<div style="font-weight:600;font-size:13px;color:var(--color-primary)">' + escapeHtml(s.name || ('전략 ' + (i + 1))) + '</div>'
          + '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;line-height:1.6">' + escapeHtml(s.rationale || '') + '</div>'
          + '<div style="display:flex;gap:12px;margin-top:6px;font-size:11px">'
          + (s.scope_impact ? '<span>📐 범위: <b>' + escapeHtml(s.scope_impact) + '</b></span>' : '')
          + (s.risk ? '<span>⚠️ 위험: <b>' + escapeHtml(s.risk) + '</b></span>' : '')
          + '</div></div>';
      });
      h += '</div>';
    }

    // 인용문헌
    var refs = a.cited_references || [];
    if (refs.length) {
      h += '<div><div style="font-weight:600;font-size:13px;margin-bottom:8px">인용문헌 (' + refs.length + '건)</div>';
      refs.forEach(function(r) {
        h += '<div style="padding:6px 12px;background:var(--color-bg-tertiary);border-radius:6px;margin-bottom:4px;font-size:12px">'
          + '<b>인용문헌 ' + (r.ref_no || '') + '</b> ' + escapeHtml(r.title || r.key_features || '') + '</div>';
      });
      h += '</div>';
    }
  } else if (type === 'description_deficiency') {
    // 기재불비 지적사항 목록
    var items = Array.isArray(a) ? a : (a.deficiency_items || a.items || []);
    if (items.length) {
      h += '<div style="font-weight:600;font-size:13px;margin-bottom:10px">지적사항 (' + items.length + '건)</div>';
      items.forEach(function(item, i) {
        h += '<div style="padding:12px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:8px">'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
          + '<span style="font-weight:600;font-size:13px">청구항 ' + (item.claim_no || (i + 1)) + '</span>'
          + '<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:var(--color-warning-light);color:#92400e">' + escapeHtml(item.deficiency_type || '불명확') + '</span>'
          + '</div>'
          + '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.6">' + escapeHtml(item.examiner_comment || '') + '</div>'
          + (item.suggested_correction ? '<div style="margin-top:8px;padding:8px 10px;background:var(--color-primary-light);border-radius:6px;border-left:3px solid var(--color-primary);font-size:12px"><b>수정 방향:</b> ' + escapeHtml(item.suggested_correction) + '</div>' : '')
          + '</div>';
      });
    }
  } else if (type === 'partial_rejection') {
    // 등록가능 청구항 식별
    var rej = a.rejected_claims || [];
    var alw = a.allowable_claims || [];
    var mg = a.merge_suggestion || {};
    if (rej.length || alw.length) {
      h += '<div style="margin-bottom:14px"><div style="font-weight:600;font-size:13px;margin-bottom:10px">청구항별 거절 현황</div>';
      rej.forEach(function(r) {
        h += '<div class="opinion-claim-row rejected"><span class="claim-no">청구항 ' + r.claim_no + '</span><span>❌</span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">' + escapeHtml(r.reason || '거절') + '</span></div>';
      });
      alw.forEach(function(a) {
        h += '<div class="opinion-claim-row allowable"><span class="claim-no">청구항 ' + a.claim_no + '</span><span>✅</span><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">' + escapeHtml(a.basis || '등록가능 후보') + '</span></div>';
      });
      h += '</div>';
    }
    if (mg.target || mg.source) {
      h += '<div style="padding:14px;background:var(--color-primary-light);border-radius:8px;border-left:3px solid var(--color-primary)">'
        + '<div style="font-weight:600;font-size:13px;color:var(--color-primary);margin-bottom:6px">💡 병합 제안</div>'
        + '<div style="font-size:12px;line-height:1.6">청구항 ' + (mg.source || '?') + ' → 청구항 ' + (mg.target || '?') + '에 병합</div>'
        + (mg.rationale ? '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px">' + escapeHtml(mg.rationale) + '</div>' : '')
        + '</div>';
    }
  }

  // 그래도 뭔가 없으면 fallback
  if (h === '<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">📊</span> 분석 결과</div></div>') {
    h += '<details><summary style="cursor:pointer;font-size:12px;font-weight:500;color:var(--color-text-secondary)">원본 데이터 보기</summary>'
      + '<pre style="white-space:pre-wrap;font-size:11px;background:var(--color-bg-tertiary);padding:12px;border-radius:8px;max-height:400px;overflow-y:auto;margin-top:8px">' + escapeHtml(JSON.stringify(a, null, 2)) + '</pre></details>';
  }

  h += '</div>';
  return h;
};

Opinion.approveGate = async function(gn){
  var p=Opinion.state.current;if(!p)return;var type=p.rejection_type,next;
  if(gn===1){next=type==='description_deficiency'?'correction_confirmed':type==='partial_rejection'?'merge_confirmed':'strategy_confirmed';}
  else if(gn===2){next='claims_confirmed';}
  else if(gn===3){next='approved';}
  setButtonLoading('btnGate'+gn+'Approve',true);
  try{
    await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:gn,decision:'approve',decided_by:currentUser.id});
    await Opinion.setStatus(p.id,next);
    if(gn===1)await Opinion.startDraft();else if(gn===2)await Opinion.startOpinionDraft();else if(gn===3)await Opinion.startOutput();
    Opinion.renderDetail();showToast('Gate '+gn+' 승인');
  }catch(e){showToast('Gate 실패: '+e.message,'error');}
  finally{setButtonLoading('btnGate'+gn+'Approve',false);}
};

Opinion.reviseGate = async function(gn){
  var p=Opinion.state.current;if(!p)return;
  var note=prompt('수정 지시 사항:');if(!note)return;
  var type=p.rejection_type,rb=gn===2?(type==='description_deficiency'?'drafting_corrections':type==='partial_rejection'?'drafting_merge':'drafting_claims'):'drafting_opinion';
  try{await sb.from('opinion_gate_decisions').insert({project_id:p.id,gate_no:gn,decision:'revise',revision_note:note,decided_by:currentUser.id});await Opinion.setStatus(p.id,rb);Opinion.renderDetail();showToast('수정 요청 접수');}catch(e){showToast('실패','error');}
};

// ═══ Context Builder — 이전 단계 데이터를 LLM에 전달 ═══
Opinion.getContext = async function(sections) {
  var p=Opinion.state.current; if(!p) return '';
  var ctx='';
  try {
    if(sections.indexOf('parsed')>=0) {
      var{data:pd}=await sb.from('opinion_parsed_documents').select('raw_text,parsed_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(pd) {
        if(pd.parsed_data && pd.parsed_data.application_no) ctx+='[파싱 결과]\n'+JSON.stringify(pd.parsed_data,null,1).slice(0,6000)+'\n\n';
        if(pd.raw_text) ctx+='[원문 (발췌)]\n'+pd.raw_text.slice(0,8000)+'\n\n';
      }
    }
    if(sections.indexOf('analysis')>=0 && Opinion.state.analysis) {
      ctx+='[분석 결과]\n'+JSON.stringify(Opinion.state.analysis,null,1).slice(0,4000)+'\n\n';
    }
    if(sections.indexOf('draft')>=0) {
      var{data:dr}=await sb.from('opinion_draft_claims').select('draft_data').eq('project_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(dr) ctx+='[보정 청구항 초안]\n'+JSON.stringify(dr.draft_data,null,1).slice(0,4000)+'\n\n';
    }
    if(sections.indexOf('validation')>=0 && Opinion.state.validation) {
      ctx+='[검증 결과]\n'+JSON.stringify(Opinion.state.validation,null,1).slice(0,3000)+'\n\n';
    }
    if(sections.indexOf('ref')>=0 && Opinion.state.refText) {
      ctx+='[참고 의견서 양식]\n'+Opinion.state.refText.slice(0,5000)+'\n\n';
    }
  } catch(e) { console.warn('[Opinion] getContext:', e); }
  return ctx;
};

// ═══ Draft (이전 분석 결과 + 파싱 컨텍스트 전달) ═══
Opinion.startDraft=async function(){
  var p=Opinion.state.current;if(!p)return;
  var t=p.rejection_type;
  var ds=t==='description_deficiency'?'drafting_corrections':t==='partial_rejection'?'drafting_merge':'drafting_claims';
  var dd=t==='description_deficiency'?'corrections_drafted':t==='partial_rejection'?'merge_drafted':'claims_drafted';
  await Opinion.setStatus(p.id,ds);
  try{
    var ctx = await Opinion.getContext(['parsed','analysis']);
    var prompts = {
      inventive_step: '위 분석 결과를 기반으로 보정 청구항 대안 2~3개를 생성해 주세요.\n각 대안별로 name(이름), claims_text(보정 청구항 전문), amendments(보정 사항 요약), scope(권리범위: broad/moderate/narrow), risk(위험도: low/medium/high)를 포함.\nJSON: {"alternatives":[{"id":"alt1","name":"...","claims_text":"...","amendments":"...","scope":"...","risk":"..."}]}',
      description_deficiency: '위 분석 결과의 각 지적사항을 반영한 수정 청구항을 생성해 주세요.\nJSON: {"corrected_claims":[{"claim_no":N,"original":"원문","corrected":"수정문","changes":[{"type":"...","detail":"..."}]}]}',
      partial_rejection: '위 분석 결과를 기반으로 등록가능 종속항을 독립항에 병합한 청구항을 생성해 주세요.\nJSON: {"merged_claim":{"claim_no":1,"text":"병합된 청구항 전문"},"remaining_claims":[{"old_no":N,"new_no":N,"text":"...","changed":bool}],"deleted_claims":[N]}'
    };
    var r=await App.callClaude(Opinion.SYS_PROMPT+'\n\n'+ctx+prompts[t]);
    var dr=Opinion.parseJSON(r.text);
    await sb.from('opinion_draft_claims').insert({project_id:p.id,draft_type:t,draft_data:dr,status:'draft'});
    Opinion.state.draftResult=dr;
    await Opinion.setStatus(p.id,dd);
    await Opinion.startValidation();
  }catch(e){showToast('초안 실패: '+e.message,'error');}
};

// ═══ Validate (파싱 원문 + 분석 + 초안 컨텍스트 전달) ═══
Opinion.startValidation=async function(){
  var p=Opinion.state.current;if(!p)return;
  var t=p.rejection_type;
  var vs=t==='description_deficiency'?'correction_validated':t==='partial_rejection'?'merge_validated':'validated';
  await Opinion.setStatus(p.id,'validating');
  try{
    var ctx = await Opinion.getContext(['parsed','analysis','draft']);
    var prompts = {
      inventive_step: '위 보정 청구항 초안을 명세서 원문과 대조하여 4중 뒷받침 검증을 수행해 주세요.\n\n각 보정된 구성요소에 대해:\n1. term_existence: 보정 문언의 용어가 명세서에 존재하는지\n2. context_match: 해당 맥락에서 사용되는지\n3. combination_check: 조합이 명세서 단일 단락에 기재되는지\n4. cited_ref_origin: 인용발명 유래 용어가 아닌지\n\nJSON: {"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"보정된 문언","checks":[{"check_type":"term_existence","result":"pass|warn|fail","detail":"구체적 근거"}],"overall_result":"pass|warn|fail"}]}',
      description_deficiency: '위 수정 청구항이 보정 범위(최초 명세서 범위) 내에 있는지 검증해 주세요.\n\nJSON: {"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"수정 사항","checks":[{"check_type":"within_scope|resolved","result":"pass|warn|fail","detail":"..."}],"overall_result":"pass|warn|fail"}]}',
      partial_rejection: '위 병합 청구항의 적법성을 검증해 주세요.\n\nJSON: {"summary":{"total":N,"pass":N,"warn":N,"fail":N},"elements":[{"element_no":N,"element_text":"검증 항목","checks":[{"check_type":"merge_accuracy|dependency|new_matter|scope","result":"pass|warn|fail","detail":"..."}],"overall_result":"pass|warn|fail"}]}'
    };
    var r=await App.callClaude(Opinion.SYS_PROMPT+'\n\n'+ctx+prompts[t]);
    var vr=Opinion.parseJSON(r.text);
    await sb.from('opinion_validation_results').insert({project_id:p.id,validation_type:t,result_data:vr,summary:vr.summary||{}});
    Opinion.state.validation=vr;
    await Opinion.setStatus(p.id,vs);
    Opinion.renderDetail();
    showToast('검증 완료');
  }catch(e){showToast('검증 실패: '+e.message,'error');}
};

Opinion.renderValidation=function(L,R,status){
  var p=Opinion.state.current,v=Opinion.state.validation||{},sm=v.summary||{},ready=['validated','correction_validated','merge_validated'].indexOf(status)>=0;
  var nav=Opinion.renderNavBar('gate2');
  L.innerHTML=nav+(ready?'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="tossface">🚦</span> Gate 2: 청구항 확정</div><p style="font-size:13px;color:var(--color-text-secondary)">검증 보고서를 검토하고 확정해 주세요.</p><div style="margin-top:12px"><div class="opinion-val-summary"><div class="opinion-val-stat pass">✅ PASS '+(sm.pass||0)+'</div><div class="opinion-val-stat warn">⚠️ WARN '+(sm.warn||0)+'</div><div class="opinion-val-stat fail">❌ FAIL '+(sm.fail||0)+'</div></div></div><div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.reviseGate(2)"><span class="tossface">✏️</span> 수정</button><button class="btn btn-primary" id="btnGate2Approve" onclick="Opinion.approveGate(2)"><span class="tossface">✅</span> 확정</button></div></div>':'<div class="card" style="text-align:center;padding:40px"><div class="progress-dot" style="width:32px;height:32px;margin:0 auto 12px;animation:pulse 1.5s infinite"></div><div style="font-size:14px;font-weight:600">검증 중...</div></div>');
  var items=v.elements||v.results||[];
  R.innerHTML='<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">🔬</span> 검증 보고서</div></div>'
    +(items.length?items.map(function(e,i){
      var r=e.overall_result||e.result||'pass';
      var checks=e.checks||[];
      return '<div class="opinion-val-item '+r+'" onclick="this.classList.toggle(\'expanded\')">'
        +'<div class="opinion-val-item-header">'
        +'<div class="el-no">'+(e.element_no||(i+1))+'</div>'
        +'<div class="el-label">'+escapeHtml((e.element_text||e.detail||'항목 '+(i+1)).slice(0,80))+'</div>'
        +'<div class="el-result">'+(r==='pass'?'✅':r==='warn'?'⚠️':'❌')+' '+r.toUpperCase()+'</div>'
        +'</div>'
        +'<div class="opinion-val-item-body">'
        +(checks.length?checks.map(function(c){
          var ci=c.result==='pass'?'✅':c.result==='warn'?'⚠️':'❌';
          return '<div style="display:flex;gap:8px;padding:6px 0;align-items:flex-start">'
            +'<span>'+ci+'</span>'
            +'<div><b>'+escapeHtml(c.check_type||'')+'</b>: '+escapeHtml(c.detail||'')+'</div>'
            +'</div>';
        }).join(''):'<div>'+escapeHtml(e.detail||JSON.stringify(e,null,2))+'</div>')
        +'</div></div>';
    }).join(''):'<p style="padding:20px;text-align:center;color:var(--color-text-tertiary)">검증 결과 없음</p>')
    +'</div>';
};

// ═══ Opinion Draft (전체 컨텍스트 + 참고 양식 전달) ═══
Opinion.startOpinionDraft=async function(){
  var p=Opinion.state.current;if(!p)return;
  await Opinion.setStatus(p.id,'drafting_opinion');
  try{
    var t=p.rejection_type;
    var ctx = await Opinion.getContext(['parsed','analysis','draft','validation','ref']);
    var tpl={
      inventive_step:'위 자료를 기반으로 진보성 위반 의견서를 작성해 주세요.\n구조: 서두(통지서 수령 확인) → 1.보정내용(보정 청구항 전문 포함) → 2.보정의 적법성(명세서 단락 근거) → 3.구체적 의견내용((1)본원 기술적 요지, (2)인용발명 기술적 요지, (3)구성요소별 차이점 상세 논증, (4)결합 용이성 반박(결합동기 부재/기술적 격차/현저한 효과), (5)소결) → 4.결론\n\n각 섹션을 구체적이고 상세하게 작성. 명세서 단락번호(【0001】형식)를 인용.\nJSON: {"title":"의견서","sections":[{"heading":"서두","content":"..."},{"heading":"1. 보정내용","content":"..."},...]}',
      description_deficiency:'위 자료를 기반으로 기재불비 의견서를 작성해 주세요.\n구조: 서두 → 1.보정내용(수정 전·후 대비) → 2.보정의 적법성 → 3.구체적 의견내용(지적사항별 수정 내용 + 거절이유 해소 설명) → 4.결론\nJSON: {"title":"의견서","sections":[{"heading":"...","content":"..."},...]}',
      partial_rejection:'위 자료를 기반으로 일부거절 의견서를 작성해 주세요.\n구조: 서두 → 1.보정내용(병합 사실 + 삭제) → 2.보정의 적법성(종속항 병합=신규사항 아님) → 3.구체적 의견내용(병합된 구성의 차이점 논증) → 4.결론\nJSON: {"title":"의견서","sections":[{"heading":"...","content":"..."},...]}',
    };
    var r=await App.callClaude(Opinion.SYS_PROMPT+'\n\n'+ctx+tpl[t]);
    var od=Opinion.parseJSON(r.text);
    await sb.from('opinion_opinion_drafts').insert({project_id:p.id,opinion_type:t,content:od,status:'draft'});
    Opinion.state.opinionDraft=od;
    await Opinion.setStatus(p.id,'opinion_drafted');
    Opinion.renderDetail();
    showToast('의견서 초안 생성 완료');
  }catch(e){showToast('의견서 생성 실패: '+e.message,'error');}
};

Opinion.renderOpinion=function(L,R,status){
  var ready=status==='opinion_drafted';
  var nav=Opinion.renderNavBar('gate3');
  L.innerHTML=nav+(ready?'<div class="opinion-gate-card"><div class="opinion-gate-title"><span class="tossface">🚦</span> Gate 3: 최종 승인</div><p style="font-size:13px;color:var(--color-text-secondary)">의견서를 검토하고 승인하면 보정서+의견서가 생성됩니다.</p><div class="opinion-gate-actions"><button class="btn btn-outline" onclick="Opinion.reviseGate(3)"><span class="tossface">✏️</span> 수정</button><button class="btn btn-primary" id="btnGate3Approve" onclick="Opinion.approveGate(3)"><span class="tossface">✅</span> 승인</button></div></div>':'<div class="card" style="text-align:center;padding:40px"><div class="progress-dot" style="width:32px;height:32px;margin:0 auto 12px;animation:pulse 1.5s infinite"></div><div style="font-size:14px;font-weight:600">의견서 작성 중...</div></div>');
  var o=Opinion.state.opinionDraft||{}, secs=o.sections||[];
  R.innerHTML='<div class="opinion-preview"><div class="opinion-preview-header"><span style="font-weight:600"><span class="tossface">📝</span> '+escapeHtml(o.title||'의견서')+'</span></div><div class="opinion-preview-body">'+(secs.length?secs.map(function(s){return '<div class="opinion-section"><div style="font-weight:600;margin-bottom:6px">'+escapeHtml(s.heading||'')+'</div><div style="white-space:pre-wrap;line-height:1.8">'+escapeHtml(s.content||'')+'</div></div>';}).join(''):'<p style="color:var(--color-text-tertiary);text-align:center;padding:40px">의견서 미생성</p>')+'</div></div>';
};

// ═══ Output + DOCX Download ═══
Opinion.startOutput=async function(){var p=Opinion.state.current;if(!p)return;await Opinion.setStatus(p.id,'generating_docs');await Opinion.setStatus(p.id,'completed');Opinion.renderDetail();showToast('출력물 생성 완료');};

Opinion.renderOutput=function(L,R,status){
  var done=status==='completed';
  var nav=Opinion.renderNavBar('output');
  L.innerHTML=nav+'<div class="card"><div class="card-header"><div class="card-title"><span class="tossface">📥</span> 출력물</div></div><div style="display:flex;flex-direction:column;gap:8px">'
    +'<button class="btn btn-primary btn-full" onclick="Opinion.downloadDocx(\'opinion\')"'+(done?'':' disabled')+'><span class="tossface">📝</span> 의견서 (Word)</button>'
    +'<button class="btn btn-outline btn-full" onclick="Opinion.downloadDocx(\'all\')"'+(done?'':' disabled')+'><span class="tossface">📋</span> 전체 (의견서+검증보고서)</button>'
    +'<button class="btn btn-ghost btn-full" onclick="Opinion.copyOpinionText()"'+(done?'':' disabled')+'><span class="tossface">📋</span> 텍스트 복사</button>'
    +'</div></div>';
  R.innerHTML='<div class="card" style="text-align:center;padding:40px">'+(done?'<div style="font-size:48px;margin-bottom:12px"><span class="tossface">🎉</span></div><h3 style="font-size:18px;font-weight:700;color:var(--color-success);margin-bottom:8px">의견서 대응 완료!</h3><p style="font-size:13px;color:var(--color-text-secondary)">다운로드 후 특허로에 제출하세요.</p>':'<div class="progress-dot" style="width:32px;height:32px;margin:0 auto 12px;animation:pulse 1.5s infinite"></div><div style="font-size:14px;font-weight:600">출력물 생성 중...</div>')+'</div>';
};

// 의견서 텍스트 조합
Opinion.getOpinionFullText = function() {
  var o=Opinion.state.opinionDraft||{};
  var secs=o.sections||[];
  if(!secs.length) return '';
  return secs.map(function(s){ return (s.heading?s.heading+'\n\n':'')+s.content; }).join('\n\n');
};

// 클립보드 복사
Opinion.copyOpinionText = function() {
  var text = Opinion.getOpinionFullText();
  if(!text){showToast('복사할 의견서가 없습니다','error');return;}
  navigator.clipboard.writeText(text).then(function(){showToast('의견서 텍스트가 복사되었습니다');}).catch(function(){
    var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showToast('복사됨');
  });
};

// Word 다운로드 (HTML→Word 방식)
Opinion.downloadDocx = function(type) {
  var p=Opinion.state.current; if(!p) return;
  var content='';
  var fileName='';

  if(type==='opinion'||type==='all') {
    var o=Opinion.state.opinionDraft||{};
    var secs=o.sections||[];
    content+='<h1 style="text-align:center;font-size:18pt">의 견 서</h1>\n';
    content+='<p style="text-align:right">출원번호: '+escapeHtml(p.application_no||'')+'</p>\n';
    content+='<p style="text-align:right">사건명: '+escapeHtml(p.title||'')+'</p>\n<hr>\n';
    secs.forEach(function(s){
      content+='<h2 style="font-size:14pt;margin-top:20pt">'+escapeHtml(s.heading||'')+'</h2>\n';
      content+='<p style="font-size:11pt;line-height:1.8;text-align:justify">'+escapeHtml(s.content||'').replace(/\n/g,'<br>')+'</p>\n';
    });
    fileName='의견서_'+escapeHtml(p.application_no||p.title||'output');
  }

  if(type==='all') {
    var v=Opinion.state.validation||{};
    var items=v.elements||v.results||[];
    if(items.length) {
      content+='<div style="page-break-before:always"></div>\n';
      content+='<h1 style="text-align:center;font-size:18pt">검증 보고서</h1>\n';
      var sm=v.summary||{};
      content+='<p>PASS: '+(sm.pass||0)+' / WARN: '+(sm.warn||0)+' / FAIL: '+(sm.fail||0)+'</p>\n';
      items.forEach(function(e,i){
        var r=e.overall_result||e.result||'pass';
        var icon=r==='pass'?'✅':r==='warn'?'⚠️':'❌';
        content+='<h3>'+icon+' '+(e.element_no||(i+1))+'. '+escapeHtml(e.element_text||e.detail||'')+'</h3>\n';
        (e.checks||[]).forEach(function(c){
          var ci=c.result==='pass'?'✅':c.result==='warn'?'⚠️':'❌';
          content+='<p>'+ci+' <b>'+escapeHtml(c.check_type||'')+'</b>: '+escapeHtml(c.detail||'')+'</p>\n';
        });
      });
      fileName='의견서+검증보고서_'+escapeHtml(p.application_no||p.title||'output');
    }
  }

  if(!content){showToast('다운로드할 내용이 없습니다','error');return;}

  // HTML → Word blob
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
    +'<head><meta charset="utf-8"><style>body{font-family:"맑은 고딕",sans-serif;font-size:11pt;line-height:1.6}h1{font-size:18pt}h2{font-size:14pt;margin-top:16pt}h3{font-size:12pt}p{margin:4pt 0;text-align:justify}</style></head>'
    +'<body>'+content+'</body></html>';

  var blob=new Blob(['\ufeff'+html],{type:'application/msword'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download=fileName+'.doc';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('다운로드 완료');
};

// ═══ 참고 의견서 양식 업로드 ═══
Opinion.state.refText = '';

Opinion.handleRefUpload = async function(event) {
  var file = event.target.files[0];
  if(!file) return;
  try {
    var text = await extractTextFromFile(file);
    Opinion.state.refText = text;
    var el=document.getElementById('opinionRefStatus');
    if(el) el.innerHTML='<span style="color:var(--color-success)">✅ '+escapeHtml(file.name)+' ('+Math.round(text.length/1000)+'K자)</span>';
    showToast('참고 양식이 등록되었습니다. 의견서 생성 시 참고됩니다.');
  }catch(e){showToast('파일 읽기 실패','error');}
  event.target.value='';
};

Opinion.renderFailed=function(L,R){L.innerHTML='<div class="card" style="text-align:center;padding:40px"><div style="font-size:48px;margin-bottom:12px"><span class="tossface">⚠️</span></div><h3 style="font-size:16px;font-weight:600;color:var(--color-error);margin-bottom:8px">파싱 실패</h3><p style="font-size:13px;color:var(--color-text-secondary)">다른 파일을 업로드하세요.</p><button class="btn btn-primary" style="margin-top:16px" onclick="Opinion.resetUpload()"><span class="tossface">📁</span> 다시 업로드</button></div>';R.innerHTML='';};
Opinion.resetUpload=async function(){var p=Opinion.state.current;if(p){await Opinion.setStatus(p.id,'created');Opinion.state.files=[];Opinion.renderDetail();}};

// ═══ Utilities ═══
Opinion.setStatus=async function(id,s){try{await sb.from('opinion_projects').update({status:s,updated_at:new Date().toISOString()}).eq('id',id);var p=Opinion.state.current;if(p&&p.id===id)p.status=s;Opinion.state.projects.forEach(function(x){if(x.id===id)x.status=s;});}catch(e){console.error('[Opinion] status:',e);}};
Opinion.loadData=async function(id){try{
  var{data:a}=await sb.from('opinion_issue_analyses').select('result_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(a)Opinion.state.analysis=a.result_data;
  var{data:d}=await sb.from('opinion_draft_claims').select('draft_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(d)Opinion.state.draftResult=d.draft_data;
  var{data:v}=await sb.from('opinion_validation_results').select('result_data').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(v)Opinion.state.validation=v.result_data;
  var{data:o}=await sb.from('opinion_opinion_drafts').select('content').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(o)Opinion.state.opinionDraft=o.content;
  var{data:t}=await sb.from('opinion_type_determinations').select('*').eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(t)Opinion.state.typeResult=t;
}catch(e){console.warn('[Opinion] load:',e);}Opinion.renderDetail();};
Opinion.parseJSON=function(text){if(!text)return{};try{var m=text.match(/```(?:json)?\s*([\s\S]*?)```/);var s=m?m[1].trim():text.trim();var a=s.search(/[\[{]/),b=Math.max(s.lastIndexOf('}'),s.lastIndexOf(']'));if(a>=0&&b>a)s=s.slice(a,b+1);return JSON.parse(s);}catch(e){return{raw_text:text};}};

console.log('[Opinion] Module loaded (v2.0)');
