/* ═══════════════════════════════════════════════════════════
   특허명세서 자동 생성 v4.2 — Project Dashboard + Isolation
   ═══════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://uvrzwhfjtzqujawmscca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cnp3aGZqdHpxdWphd21zY2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTEwNDgsImV4cCI6MjA4NTUyNzA0OH0.JSSPMPIHsXfbNm6pgRzCTGH7aNQATl-okIkcXHl7Mkk';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MODEL = 'claude-opus-4-5-20251101';
const SYSTEM_PROMPT = '너는 20년 경력의 한국 변리사이다. 원칙: 1.표준문체(~한다) 2.글머리/마크다운 절대금지 3.SW명 대신 알고리즘 4.구성요소명(참조번호) 형태 5.명세서에 바로 붙여넣을 순수텍스트 6.제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지';

// ── State ──
let API_KEY = '';
let currentUser = null;
let currentProfile = null;
let currentProjectId = null;
let outputs = {};
let selectedTitle = '';
let selectedTitleType = '';
let includeMethodClaims = true;
let usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
let loadingState = {};

const STEP_NAMES = {
  step_01:'발명의 명칭', step_02:'기술분야', step_03:'배경기술',
  step_04:'선행기술문헌', step_05:'해결하고자 하는 과제',
  step_06:'장치 청구항', step_07:'도면 설계', step_08:'장치 상세설명',
  step_09:'수학식', step_10:'방법 청구항', step_11:'방법 도면',
  step_12:'방법 상세설명', step_13:'검토', step_14:'대안 청구항',
  step_15:'기재불비', step_16:'발명의 효과', step_17:'과제의 해결 수단',
  step_18:'부호의 설명', step_19:'요약서'
};

// ══════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════
function escapeHtml(t){if(!t)return '';return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showToast(msg,type='success'){const c=document.getElementById('toastContainer');const icon=type==='success'?'✅':type==='error'?'❌':'ℹ️';const t=document.createElement('div');t.className='toast';t.innerHTML=`<span class="tossface">${icon}</span> ${escapeHtml(msg)}`;c.appendChild(t);setTimeout(()=>t.remove(),3000);}
function showProgress(cid,label,cur,tot){const el=document.getElementById(cid);if(!el)return;const p=Math.round(cur/tot*100);el.innerHTML=`<div class="progress-container"><div class="progress-label"><div class="progress-dot"></div>${escapeHtml(label)}</div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${p}%"></div></div><div class="progress-info"><span>${cur}/${tot}</span><span>${p}%</span></div></div>`;}
function clearProgress(id){const el=document.getElementById(id);if(el)el.innerHTML='';}
function setButtonLoading(bid,on){const b=document.getElementById(bid);if(!b)return;if(on){b.classList.add('btn-loading');b.disabled=true;}else{b.classList.remove('btn-loading');b.disabled=false;}}

// ══════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ══════════════════════════════════════════════
function showScreen(name) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = ''; });
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('screenMain').style.display = 'none';
  document.getElementById('screenDashboard').style.display = 'none';

  switch(name) {
    case 'auth': document.getElementById('screenAuth').classList.add('active'); break;
    case 'tos': document.getElementById('screenTos').classList.add('active'); break;
    case 'pending': document.getElementById('screenPending').classList.add('active'); break;
    case 'dashboard':
      document.getElementById('screenDashboard').style.display = 'block';
      document.getElementById('screenDashboard').classList.add('active');
      loadDashboardProjects();
      break;
    case 'main':
      document.getElementById('screenMain').style.display = 'block';
      document.getElementById('screenMain').classList.add('active');
      break;
    case 'admin':
      document.getElementById('adminPanel').style.display = 'block';
      document.getElementById('adminPanel').classList.add('active');
      loadAdminUsers();
      break;
  }
}

// ══════════════════════════════════════════════
//  STATE MANAGEMENT — Complete Isolation
// ══════════════════════════════════════════════

/** 모든 작업 상태를 완전 초기화 */
function clearAllState() {
  currentProjectId = null;
  outputs = {};
  selectedTitle = '';
  selectedTitleType = '';
  includeMethodClaims = true;
  usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  loadingState = {};

  // UI 초기화
  const projectInput = document.getElementById('projectInput');
  if (projectInput) projectInput.value = '';
  const titleInput = document.getElementById('titleInput');
  if (titleInput) titleInput.value = '';

  const titleConfirm = document.getElementById('titleConfirmArea');
  if (titleConfirm) titleConfirm.style.display = 'none';
  const titleMsg = document.getElementById('titleConfirmMsg');
  if (titleMsg) titleMsg.style.display = 'none';
  const batchArea = document.getElementById('batchArea');
  if (batchArea) batchArea.style.display = 'none';

  // 모든 결과 영역 초기화
  for (let i = 1; i <= 19; i++) {
    const el = document.getElementById(`resultStep${String(i).padStart(2,'0')}`);
    if (el) el.innerHTML = '';
  }
  ['resultsBatch25','resultsBatchFinish','validationResults','previewArea','diagramsStep07','diagramsStep11'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  const ab = document.getElementById('btnApplyReview');
  if (ab) ab.style.display = 'none';
  const pp = document.getElementById('btnPptx07');
  if (pp) pp.style.display = 'none';

  // 탭 초기화
  document.querySelectorAll('.tab-item').forEach((t,i) => { t.classList.toggle('active',i===0); t.setAttribute('aria-selected',i===0); });
  document.querySelectorAll('.page').forEach((p,i) => p.classList.toggle('active',i===0));

  // 메서드 토글 초기화
  const mt = document.getElementById('methodToggle');
  if (mt) { mt.checked = true; toggleMethod(); }

  // 타이틀 타입 선택 초기화
  document.querySelectorAll('#titleTypeCards .selection-card').forEach(c => c.classList.remove('selected'));
  const b01 = document.getElementById('btnStep01');
  if (b01) b01.disabled = true;

  updateStats();
}

// ══════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
  if(tab==='login'){document.querySelector('.auth-tab:first-child').classList.add('active');document.getElementById('authLogin').style.display='block';document.getElementById('authSignup').style.display='none';}
  else{document.querySelector('.auth-tab:last-child').classList.add('active');document.getElementById('authLogin').style.display='none';document.getElementById('authSignup').style.display='block';}
}
async function handleLogin() {
  const email=document.getElementById('loginEmail').value.trim(),pw=document.getElementById('loginPassword').value;
  if(!email||!pw){showToast('이메일과 비밀번호를 입력해 주세요','error');return;}
  setButtonLoading('btnLogin',true);
  const{data,error}=await sb.auth.signInWithPassword({email,password:pw});
  setButtonLoading('btnLogin',false);
  if(error){showToast(error.message,'error');return;}
  await onAuthSuccess(data.user);
}
async function handleSignup() {
  const email=document.getElementById('signupEmail').value.trim(),pw=document.getElementById('signupPassword').value,name=document.getElementById('signupName').value.trim();
  if(!email||!pw){showToast('이메일과 비밀번호를 입력해 주세요','error');return;}
  if(pw.length<6){showToast('비밀번호는 6자 이상','error');return;}
  setButtonLoading('btnSignup',true);
  const{data,error}=await sb.auth.signUp({email,password:pw,options:{data:{display_name:name||email}}});
  setButtonLoading('btnSignup',false);
  if(error){showToast(error.message,'error');return;}
  showToast('회원가입 완료!');
  if(data.user) await onAuthSuccess(data.user);
}
async function handleLogout() {
  clearAllState();
  sessionStorage.removeItem('pk');
  API_KEY = '';
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showScreen('auth');
}
async function onAuthSuccess(user) {
  currentUser = user;
  let{data:profile}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(!profile){
    const{data:np,error}=await sb.from('profiles').insert({id:user.id,display_name:user.user_metadata?.display_name||user.email,role:'user',status:'pending',tos_accepted:false}).select('*').single();
    if(error){showToast('프로필 생성 실패','error');return;}
    profile=np;
  }
  currentProfile = profile;
  if(!profile.tos_accepted){showScreen('tos');return;}
  if(profile.status==='pending'){showScreen('pending');return;}
  if(profile.status==='suspended'){showToast('계정이 정지됨','error');return;}

  // 대시보드에 사용자 정보 표시
  const dashName = document.getElementById('dashUserName');
  if (dashName) dashName.textContent = profile.display_name || user.email;
  if (profile.role === 'admin') {
    const ab = document.getElementById('btnDashAdmin');
    if (ab) ab.style.display = 'inline-flex';
  }

  API_KEY = sessionStorage.getItem('pk') || '';

  // ★ 로그인 후 대시보드로 이동 (에디터가 아님)
  clearAllState();
  showScreen('dashboard');
}
async function handleTosAccept() {
  if(!document.getElementById('tosCheck1').checked||!document.getElementById('tosCheck2').checked){showToast('모든 항목에 동의해 주세요','error');return;}
  await sb.from('profiles').update({tos_accepted:true,tos_accepted_at:new Date().toISOString()}).eq('id',currentUser.id);
  currentProfile.tos_accepted=true;
  if(currentProfile.status==='pending') showScreen('pending');
  else await onAuthSuccess(currentUser);
}
async function checkApprovalStatus() {
  const{data}=await sb.from('profiles').select('status').eq('id',currentUser.id).single();
  if(data?.status==='approved') await onAuthSuccess(currentUser);
  else showToast('아직 승인 대기 중','info');
}
function saveApiKey(){
  const key=document.getElementById('apiKeyInput').value.trim();
  if(!key){showToast('API Key를 입력해 주세요','error');return;}
  API_KEY=key;sessionStorage.setItem('pk',key);
  document.getElementById('apiKeyModal').style.display='none';
  showToast('API Key 설정 완료');
}

// ══════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════
async function loadAdminUsers(){
  const{data:users}=await sb.from('profiles').select('*').order('created_at',{ascending:false});
  const el=document.getElementById('adminUserList');
  if(!users?.length){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px">사용자 없음</p>';return;}
  el.innerHTML=users.map(u=>`<div class="admin-user-item"><div class="admin-user-info"><div class="admin-user-name">${escapeHtml(u.display_name||u.id)}</div><div class="admin-user-status"><span class="badge ${u.status==='approved'?'badge-success':u.status==='pending'?'badge-warning':'badge-error'}">${u.status}</span> <span class="badge badge-neutral">${u.role}</span></div></div><div style="display:flex;gap:4px">${u.status==='pending'?`<button class="btn btn-primary btn-sm" onclick="adminApprove('${u.id}')">승인</button>`:''} ${u.status==='approved'?`<button class="btn btn-outline btn-sm" onclick="adminSuspend('${u.id}')">정지</button>`:''} ${u.status==='suspended'?`<button class="btn btn-outline btn-sm" onclick="adminApprove('${u.id}')">해제</button>`:''}</div></div>`).join('');
}
async function adminApprove(id){await sb.from('profiles').update({status:'approved'}).eq('id',id);showToast('승인됨');loadAdminUsers();}
async function adminSuspend(id){await sb.from('profiles').update({status:'suspended'}).eq('id',id);showToast('정지됨');loadAdminUsers();}

// ══════════════════════════════════════════════
//  PROJECT DASHBOARD
// ══════════════════════════════════════════════

async function loadDashboardProjects() {
  const { data } = await sb.from('projects')
    .select('id, title, invention_content, current_state_json, created_at, updated_at')
    .eq('owner_user_id', currentUser.id)
    .order('updated_at', { ascending: false });

  const el = document.getElementById('dashProjectList');
  const countEl = document.getElementById('dashProjectCount');

  if (!data || !data.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--color-text-tertiary)"><div style="font-size:40px;margin-bottom:8px"><span class="tossface">📭</span></div><p>아직 생성된 사건이 없어요.<br>위의 "새 사건 만들기"를 눌러 시작하세요.</p></div>';
    countEl.textContent = '0건';
    return;
  }

  countEl.textContent = `${data.length}건`;

  el.innerHTML = data.map(p => {
    const state = p.current_state_json || {};
    const outs = state.outputs || {};
    const completedSteps = Object.keys(outs).filter(k => outs[k] && k.startsWith('step_') && !k.includes('mermaid') && !k.includes('applied')).length;
    const created = new Date(p.created_at).toLocaleDateString('ko-KR');
    const updated = new Date(p.updated_at).toLocaleDateString('ko-KR');
    const pct = Math.round(completedSteps / 19 * 100);

    return `<div class="card" style="margin-bottom:12px;cursor:pointer;transition:box-shadow 0.15s" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='var(--shadow-sm)'" onclick="openProject('${p.id}')">
      <div style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:600;color:var(--color-text-primary);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.title)}</div>
            <div style="font-size:12px;color:var(--color-text-tertiary)">생성 ${created} · 수정 ${updated}</div>
          </div>
          <div style="display:flex;gap:6px;margin-left:12px;flex-shrink:0">
            <span class="badge ${pct===100?'badge-success':pct>0?'badge-primary':'badge-neutral'}">${completedSteps}/19 (${pct}%)</span>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();confirmDeleteProject('${p.id}','${escapeHtml(p.title).replace(/'/g,"\\'")}')">🗑️</button>
          </div>
        </div>
        <div class="progress-bar-bg" style="margin-top:10px;height:4px"><div class="progress-bar-fill" style="width:${pct}%;height:4px"></div></div>
      </div>
    </div>`;
  }).join('');
}

function openNewProjectModal() {
  document.getElementById('newProjectTitle').value = '';
  document.getElementById('newProjectModal').style.display = 'flex';
  document.getElementById('newProjectTitle').focus();
}
function closeNewProjectModal() {
  document.getElementById('newProjectModal').style.display = 'none';
}

async function createAndOpenProject() {
  const title = document.getElementById('newProjectTitle').value.trim();
  if (!title) { showToast('사건명을 입력해 주세요', 'error'); return; }

  const { data, error } = await sb.from('projects').insert({
    owner_user_id: currentUser.id,
    title,
    invention_content: '',
    current_state_json: { outputs: {}, selectedTitle: '', selectedTitleType: '', includeMethodClaims: true, usage: { calls: 0, inputTokens: 0, outputTokens: 0 } }
  }).select('id').single();

  if (error) { showToast('사건 생성 실패: ' + error.message, 'error'); return; }

  closeNewProjectModal();
  await openProject(data.id);
}

/** 프로젝트 열기: 완전 초기화 후 해당 프로젝트 데이터만 로드 */
async function openProject(projectId) {
  // ★ 먼저 모든 상태 초기화
  clearAllState();

  const { data } = await sb.from('projects').select('*').eq('id', projectId).single();
  if (!data) { showToast('사건을 불러올 수 없어요', 'error'); return; }

  // 프로젝트 데이터 로드
  currentProjectId = data.id;
  document.getElementById('projectInput').value = data.invention_content || '';

  const s = data.current_state_json || {};
  outputs = s.outputs || {};
  selectedTitle = s.selectedTitle || '';
  selectedTitleType = s.selectedTitleType || '';
  includeMethodClaims = s.includeMethodClaims !== false;
  usage = s.usage || { calls: 0, inputTokens: 0, outputTokens: 0 };

  // UI 복원
  document.getElementById('methodToggle').checked = includeMethodClaims;
  toggleMethod();

  if (selectedTitle) {
    document.getElementById('titleInput').value = selectedTitle;
    document.getElementById('titleConfirmArea').style.display = 'block';
    document.getElementById('titleConfirmMsg').style.display = 'block';
    document.getElementById('batchArea').style.display = 'block';
  }

  // 결과 복원
  Object.keys(outputs).forEach(k => {
    if (outputs[k] && k.startsWith('step_') && !k.includes('mermaid') && !k.includes('applied')) {
      renderOutput(k, outputs[k]);
    }
  });

  // 헤더에 사건명 표시
  document.getElementById('headerProjectName').textContent = data.title;
  document.getElementById('headerUserName').textContent = currentProfile?.display_name || currentUser?.email || '';
  if (currentProfile?.role === 'admin') document.getElementById('btnAdmin').style.display = 'inline-flex';

  updateStats();

  // API Key 확인
  if (!API_KEY) document.getElementById('apiKeyModal').style.display = 'flex';

  showScreen('main');
  showToast(`"${data.title}" 사건을 열었어요`);
}

/** 대시보드로 돌아가기: 현재 상태 저장 후 초기화 */
async function backToDashboard() {
  // 현재 프로젝트 자동 저장
  if (currentProjectId) {
    await saveProject(true); // silent save
  }
  clearAllState();
  showScreen('dashboard');
}

async function confirmDeleteProject(id, title) {
  if (!confirm(`"${title}" 사건을 삭제하시겠어요?\n이 작업은 되돌릴 수 없습니다.`)) return;
  await sb.from('projects').delete().eq('id', id);
  showToast('사건이 삭제되었어요');
  loadDashboardProjects();
}

// ══════════════════════════════════════════════
//  PROJECT SAVE (from editor)
// ══════════════════════════════════════════════
async function saveProject(silent = false) {
  if (!currentProjectId) return;
  const title = selectedTitle || document.getElementById('projectInput').value.slice(0,30) || '새 사건';
  const state = { outputs, selectedTitle, selectedTitleType, includeMethodClaims, usage };
  await sb.from('projects').update({
    title,
    invention_content: document.getElementById('projectInput').value,
    current_state_json: state
  }).eq('id', currentProjectId);
  if (!silent) showToast('저장되었어요');
}

// ══════════════════════════════════════════════
//  TAB & TOGGLES
// ══════════════════════════════════════════════
function switchTab(idx){
  document.querySelectorAll('.tab-item').forEach((t,i)=>{t.classList.toggle('active',i===idx);t.setAttribute('aria-selected',i===idx);});
  document.querySelectorAll('.page').forEach((p,i)=>p.classList.toggle('active',i===idx));
  if(idx===4)renderPreview();
}
function toggleMethod(){
  includeMethodClaims=document.getElementById('methodToggle').checked;
  ['methodClaimsCard','methodDiagramCard','methodDescCard'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle('card-disabled',!includeMethodClaims);});
}
function selectTitleType(el,type){
  document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');selectedTitleType=type;document.getElementById('btnStep01').disabled=false;
}
function selectTitle(el,kr,en){
  document.querySelectorAll('#resultStep01 .selection-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');selectedTitle=kr;
  document.getElementById('titleInput').value=kr;
  document.getElementById('titleConfirmArea').style.display='block';
  document.getElementById('titleConfirmMsg').style.display='block';
  document.getElementById('batchArea').style.display='block';
}
function onTitleInput(){
  const v=document.getElementById('titleInput').value.trim();
  document.querySelectorAll('#resultStep01 .selection-card').forEach(c=>c.classList.remove('selected'));
  selectedTitle=v;
  document.getElementById('titleConfirmMsg').style.display=v?'block':'none';
  document.getElementById('batchArea').style.display=v?'block':'none';
}

// ══════════════════════════════════════════════
//  API
// ══════════════════════════════════════════════
async function callClaude(prompt,maxTokens=8192){
  if(!API_KEY){document.getElementById('apiKeyModal').style.display='flex';throw new Error('API Key 필요');}
  const ctrl=new AbortController(),tout=setTimeout(()=>ctrl.abort(),120000);
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ctrl.signal,headers:{'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:MODEL,max_tokens:maxTokens,system:SYSTEM_PROMPT,messages:[{role:'user',content:prompt}]})});
    clearTimeout(tout);
    if(res.status===401){sessionStorage.removeItem('pk');API_KEY='';document.getElementById('apiKeyModal').style.display='flex';throw new Error('API Key 유효하지 않음');}
    if(res.status===429)throw new Error('요청 과다. 30초 후 재시도');
    if(res.status>=500)throw new Error('서버 오류');
    const data=await res.json();if(data.error)throw new Error(data.error.message);
    usage.calls++;usage.inputTokens+=(data.usage?.input_tokens||0);usage.outputTokens+=(data.usage?.output_tokens||0);updateStats();
    return{text:data.content[0].text,stopReason:data.stop_reason};
  }catch(e){clearTimeout(tout);if(e.name==='AbortError')throw new Error('타임아웃');throw e;}
}
async function callClaudeWithContinuation(prompt,pid){
  let full='',resp=await callClaude(prompt),att=0;full=resp.text;
  while(att<4&&resp.stopReason==='max_tokens'){att++;showProgress(pid,`이어서 작성 중... (${att}/4)`,att,4);resp=await callClaude(`아래 특허명세서 뒷부분을 이어서 작성. 앞부분 반복 금지. 동일 문체.\n\n[마지막]\n${full.slice(-2000)}`);full+='\n'+resp.text;}
  clearProgress(pid);return full;
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function getLatestDescription(){return outputs.step_13_applied||outputs.step_09||outputs.step_08||'';}
function getLastClaimNumber(t){const m=t.match(/【청구항\s*(\d+)】/g);if(!m)return 0;return Math.max(...m.map(x=>parseInt(x.match(/(\d+)/)[1])));}
function getLastFigureNumber(t){const m=t.match(/도\s*(\d+)/g);if(!m)return 0;return Math.max(...m.map(x=>parseInt(x.match(/(\d+)/)[1])));}
function extractBriefDescriptions(s07,s11){
  const d=[];[s07,s11].forEach(t=>{if(!t)return;const i=t.indexOf('---BRIEF_DESCRIPTIONS---');if(i>=0)t.slice(i+24).trim().split('\n').filter(l=>l.trim().startsWith('도 ')).forEach(l=>d.push(l.trim()));else t.split('\n').filter(l=>/^도\s*\d+은?\s/.test(l.trim())).forEach(l=>d.push(l.trim()));});
  return d.join('\n');
}
function stripKoreanParticles(w){if(!w||w.length<2)return w;const ps=['에서는','으로써','에서','으로','에게','부터','까지','에는','하는','되는','된','하여','있는','없는','같은','통하여','위한','대한','의한','를','을','이','가','은','는','에','의','와','과','로','도','든','인','적','로서'];for(const p of ps){if(w.endsWith(p)&&w.length>p.length+1)return w.slice(0,-p.length);}return w;}

// ══════════════════════════════════════════════
//  PROMPT TEMPLATES
// ══════════════════════════════════════════════
function buildPrompt(stepId){
  const inv=document.getElementById('projectInput').value,T=selectedTitle;
  switch(stepId){
    case 'step_01':return `프로젝트를 분석하여 특허 발명의 명칭 후보를 5가지 생성하라.\n형태: "~${selectedTitleType}"\n각 후보에 국문+영문.\n\n출력형식:\n[1] 국문: (명칭) / 영문: (명칭)\n[2] 국문: (명칭) / 영문: (명칭)\n[3] 국문: (명칭) / 영문: (명칭)\n[4] 국문: (명칭) / 영문: (명칭)\n[5] 국문: (명칭) / 영문: (명칭)\n\n[프로젝트]\n${inv}`;
    case 'step_02':return `【기술분야】를 작성. "본 발명은 ~에 관한 것이다." 한 문장만. 20단어. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}`;
    case 'step_03':return `【발명의 배경이 되는 기술】을 작성. 3문단(기존문제/최근동향/필요성), 각 150단어. 번호 없이. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}\n[프로젝트] ${inv}`;
    case 'step_04':return `【선행기술문헌】작성.\n규칙: 다른 항목 포함 금지. 헤더 금지. 관련 한국 특허 3~5건.\n출력:\n【특허문헌】\n(특허문헌 1) 한국등록특허 제10-NNNNNNN호 "발명의 명칭"\n(특허문헌 2) 한국공개특허 제10-NNNN-NNNNNNN호 "발명의 명칭"\n\n발명의 명칭: ${T}\n[프로젝트] ${inv}`;
    case 'step_05':return `【해결하고자 하는 과제】작성. "본 발명은 ~을 제공하는 것을 목적으로 한다." 50단어 이하. 마지막: "본 발명의 기술적 과제는 이상에서 언급한 기술적 과제로 제한되지 않으며, 언급되지 않은 또 다른 기술적 과제들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다." 헤더 금지.\n\n발명의 명칭: ${T}\n[배경기술] ${outputs.step_03||''}`;
    case 'step_06':{const i=document.getElementById('optDeviceIndep').value,d=document.getElementById('optDeviceDep').value;return `장치 청구범위. 독립항 ${i}개+종속항 ${d}개. "청구항 N에 있어서," 시작. 【청구항 1】형식. SW명 금지. 제한성 표현 금지.\n${T}\n[프로젝트] ${inv}`;}
    case 'step_07':{const f=document.getElementById('optDeviceFigures').value;return `청구범위 도면 ${f}개 설계.\n\n[파트1: 도면 설계]\n각 도면: 제목/유형, 구성요소+참조번호, 연결관계. 참조번호: 서버100번대, 단말200번대, 외부300번대.\n\n[파트2: 도면의 간단한 설명]\n---BRIEF_DESCRIPTIONS---\n도 1은 (명칭)(참조번호)의 (내용)을 나타내는 (블록도/구성도)이다.\n도 2는 ...\n\n파트2는 마커 이후 위 형식으로만. 명령문 포함 금지.\n\n${T}\n[청구범위] ${outputs.step_06||''}`;}
    case 'step_08':return `상세설명을 빠짐없이 완전하게 작성. 서버(100) 주어. "구성요소(참조번호)". 도면별 "도 N을 참조하면,". 특허문체. 글머리 금지. 모든 구성요소 포함. 생략 금지. 변형 실시예. 제한성 표현 금지.\n${T}\n[청구범위] ${outputs.step_06||''}\n[도면] ${outputs.step_07||''}\n[프로젝트] ${(inv||'').slice(0,3000)}`;
    case 'step_09':return `상세설명의 핵심 알고리즘에 수학식 5개 내외.\n규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.\n출력:\n---MATH_BLOCK_1---\nANCHOR: (삽입위치 문장 20자 이상)\nFORMULA:\n【수학식 1】\n(수식)\n여기서, (파라미터)\n예시 대입: (수치)\n\n${T}\n[현재 상세설명] ${outputs.step_08||''}`;
    case 'step_10':{const i=document.getElementById('optMethodIndep').value,d=document.getElementById('optMethodDep').value,s=getLastClaimNumber(outputs.step_06||'')+1;return `방법 청구항. 독립항 ${i}+종속항 ${d}. "~단계". 【청구항 ${s}】부터. 장치 1:1 대응. 제한성 표현 금지.\n${T}\n[장치 청구항] ${outputs.step_06||''}\n[상세설명] ${(outputs.step_08||'').slice(0,3000)}`;}
    case 'step_11':{const f=document.getElementById('optMethodFigures').value,lf=getLastFigureNumber(outputs.step_07||'');return `방법 흐름도 ${f}개. 도 ${lf+1}부터. S100,S200 단계번호.\n\n[파트1: 도면 설계]\n단계: 번호, 내용, 연결.\n\n[파트2: 도면의 간단한 설명]\n---BRIEF_DESCRIPTIONS---\n도 ${lf+1}은 (방법 이름)의 (설명)을 나타내는 순서도이다.\n\n${T}\n[방법 청구항] ${outputs.step_10||''}`;}
    case 'step_12':return `방법 상세설명. 단계순서 장치동작 1:1 대응. 특허문체. 글머리 금지. 시작: "이하에서는 앞서 설명한 서버의 구성 및 동작을 참조하여 방법을 설명한다." 생략 금지. 제한성 표현 금지.\n${T}\n[방법 청구항] ${outputs.step_10||''}\n[방법 도면] ${outputs.step_11||''}\n[장치 상세설명] ${(outputs.step_08||'').slice(0,3000)}`;
    case 'step_13':return `청구범위와 상세설명 검토:\n1.청구항뒷받침 2.기술적비약 3.수학식정합성 4.반복실시가능성 5.보완/수정 구체적 문장\n${T}\n[청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}\n[상세설명] ${(getLatestDescription()||'').slice(0,6000)}`;
    case 'step_14':return `대안 청구항. 핵심유지 표현달리. 【청구항 N】.\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}`;
    case 'step_15':return `기재불비: (a)상기선행기재 (b)용어통일 (c)대응 (d)누락 (e)용어뒷받침. 수정안.\n${T}\n[전체] ${outputs.step_06||''}\n${outputs.step_10||''}\n${outputs.step_14||''}`;
    case 'step_16':return `발명의 효과. "본 발명에 따르면,"시작. 50단어 이내. 마지막: "본 발명의 효과는 이상에서 언급한 효과로 제한되지 않으며, 언급되지 않은 또 다른 효과들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다."\n${T}\n[과제] ${outputs.step_05||''}\n[상세설명] ${(outputs.step_08||'').slice(0,2000)}`;
    case 'step_17':return `과제의 해결 수단. "본 발명의 일 실시예에 따른"시작. 마지막: "본 발명의 기타 구체적인 사항들은 상세한 설명 및 도면들에 포함되어 있다."\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}`;
    case 'step_18':return `【부호의 설명】작성. "구성요소 : 참조번호". 참조번호 오름차순.\n${T}\n[도면] ${outputs.step_07||''}\n[방법도면] ${outputs.step_11||''}`;
    case 'step_19':return `요약서. 청구항1 기준 150단어. "본 발명은"시작.\n출력:\n【요약】\n(본문)\n\n【대표도】\n도 1\n\n위 형식만.\n${T}\n[청구항1] ${(outputs.step_06||'').slice(0,1500)}`;
    default:return '';
  }
}
function buildMermaidPrompt(sid){
  const src=sid==='step_07'?outputs.step_07:outputs.step_11;
  return `도면을 Mermaid.js로 변환.\n규칙: 각 도면별 \`\`\`mermaid 코드블록. 블록도=graph TD/LR. 흐름도=flowchart TD. 한글노드 큰따옴표: A["서버(100)"]. subgraph. 화살표텍스트: A-->|"텍스트"|B. 노드ID 영문/숫자만.\n\n[도면]\n${src}`;
}

// ══════════════════════════════════════════════
//  STEP EXECUTION
// ══════════════════════════════════════════════
function checkDependency(sid){
  const inv=document.getElementById('projectInput').value.trim();
  const d={step_01:()=>inv?null:'발명 내용을 먼저 입력',step_06:()=>selectedTitle?null:'명칭을 먼저 확정',step_07:()=>outputs.step_06?null:'장치 청구항 먼저',step_08:()=>(outputs.step_06&&outputs.step_07)?null:'도면 설계 먼저',step_09:()=>outputs.step_08?null:'상세설명 먼저',step_10:()=>outputs.step_06?null:'장치 청구항 먼저',step_11:()=>outputs.step_10?null:'방법 청구항 먼저',step_12:()=>(outputs.step_10&&outputs.step_11)?null:'방법 도면 먼저',step_13:()=>(outputs.step_06&&outputs.step_08)?null:'청구항+상세설명 먼저',step_14:()=>outputs.step_06?null:'장치 청구항 먼저',step_15:()=>outputs.step_06?null:'장치 청구항 먼저'};
  return d[sid]?d[sid]():null;
}
async function runStep(stepId){
  if(loadingState[stepId])return;const dep=checkDependency(stepId);if(dep){showToast(dep,'error');return;}
  const bm={step_01:'btnStep01',step_06:'btnStep06',step_10:'btnStep10',step_13:'btnStep13'},bid=bm[stepId];
  loadingState[stepId]=true;if(bid)setButtonLoading(bid,true);
  try{const r=await callClaude(buildPrompt(stepId));outputs[stepId]=r.text;renderOutput(stepId,r.text);if(stepId==='step_13')document.getElementById('btnApplyReview').style.display='block';showToast(`${STEP_NAMES[stepId]} 완료`);}
  catch(e){showToast(e.message,'error');}finally{loadingState[stepId]=false;if(bid)setButtonLoading(bid,false);}
}
async function runLongStep(stepId){
  if(loadingState[stepId])return;const dep=checkDependency(stepId);if(dep){showToast(dep,'error');return;}
  const bid=stepId==='step_08'?'btnStep08':'btnStep12',pid=stepId==='step_08'?'progressStep08':'progressStep12';
  loadingState[stepId]=true;setButtonLoading(bid,true);showProgress(pid,`${STEP_NAMES[stepId]} 생성 중...`,0,1);
  try{const t=await callClaudeWithContinuation(buildPrompt(stepId),pid);outputs[stepId]=t;renderOutput(stepId,t);showToast(`${STEP_NAMES[stepId]} 완료`);}
  catch(e){showToast(e.message,'error');}finally{loadingState[stepId]=false;setButtonLoading(bid,false);clearProgress(pid);}
}
async function runMathInsertion(){
  if(loadingState.step_09)return;const dep=checkDependency('step_09');if(dep){showToast(dep,'error');return;}
  loadingState.step_09=true;setButtonLoading('btnStep09',true);
  try{const r=await callClaude(buildPrompt('step_09'));outputs.step_09=insertMathBlocks(outputs.step_08,r.text);renderOutput('step_09',outputs.step_09);showToast('수학식 삽입 완료');}
  catch(e){showToast(e.message,'error');}finally{loadingState.step_09=false;setButtonLoading('btnStep09',false);}
}
async function applyReview(){
  if(loadingState.applyReview)return;if(!outputs.step_13){showToast('검토 결과 없음','error');return;}
  const cur=getLatestDescription();if(!cur){showToast('상세설명 없음','error');return;}
  loadingState.applyReview=true;setButtonLoading('btnApplyReview',true);showProgress('progressApplyReview','반영 중...',0,1);
  try{const t=await callClaudeWithContinuation(`[현재 상세설명]에 [검토 결과] 보완사항 반영하여 개선된 상세설명 전체 출력. 기존 유지+검토 지적사항 보완. 수학식 유지. 특허문체. 글머리 금지. 절대 생략 금지.\n\n[발명의 명칭] ${selectedTitle}\n[검토 결과] ${outputs.step_13}\n[현재 상세설명] ${cur}`,'progressApplyReview');
    outputs.step_13_applied=t;renderOutput('step_09',t);showToast('검토 반영 완료');}
  catch(e){showToast(e.message,'error');}finally{loadingState.applyReview=false;setButtonLoading('btnApplyReview',false);clearProgress('progressApplyReview');}
}
async function runDiagramStep(stepId){
  if(loadingState[stepId])return;const dep=checkDependency(stepId);if(dep){showToast(dep,'error');return;}
  const bid=stepId==='step_07'?'btnStep07':'btnStep11';loadingState[stepId]=true;setButtonLoading(bid,true);
  try{const r=await callClaude(buildPrompt(stepId));outputs[stepId]=r.text;renderOutput(stepId,r.text);const mr=await callClaude(buildMermaidPrompt(stepId),4096);outputs[stepId+'_mermaid']=mr.text;renderDiagrams(stepId,mr.text);if(stepId==='step_07')document.getElementById('btnPptx07').style.display='block';showToast(`${STEP_NAMES[stepId]} 완료`);}
  catch(e){showToast(e.message,'error');}finally{loadingState[stepId]=false;setButtonLoading(bid,false);}
}
async function runBatch25(){
  if(loadingState.batch25)return;if(!selectedTitle){showToast('명칭 먼저 확정','error');return;}
  loadingState.batch25=true;setButtonLoading('btnBatch25',true);document.getElementById('resultsBatch25').innerHTML='';
  const steps=['step_02','step_03','step_04','step_05'];
  try{for(let i=0;i<steps.length;i++){showProgress('progressBatch',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;renderBatchResult('resultsBatch25',steps[i],r.text);}clearProgress('progressBatch');showToast('기본 항목 완료');}
  catch(e){clearProgress('progressBatch');showToast(e.message,'error');}finally{loadingState.batch25=false;setButtonLoading('btnBatch25',false);}
}
async function runBatchFinish(){
  if(loadingState.batchFinish)return;if(!outputs.step_06||!outputs.step_08){showToast('청구항+상세설명 먼저','error');return;}
  loadingState.batchFinish=true;setButtonLoading('btnBatchFinish',true);document.getElementById('resultsBatchFinish').innerHTML='';
  const steps=['step_16','step_17','step_18','step_19'];
  try{for(let i=0;i<steps.length;i++){showProgress('progressBatchFinish',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;renderBatchResult('resultsBatchFinish',steps[i],r.text);}clearProgress('progressBatchFinish');showToast('마무리 완료');}
  catch(e){clearProgress('progressBatchFinish');showToast(e.message,'error');}finally{loadingState.batchFinish=false;setButtonLoading('btnBatchFinish',false);}
}

// ══════════════════════════════════════════════
//  PARSERS
// ══════════════════════════════════════════════
function parseTitleCandidates(t){const c=[];let m;const re=/\[(\d+)\]\s*국문:\s*(.+?)\s*[/／]\s*영문:\s*(.+)/g;while((m=re.exec(t))!==null)c.push({num:m[1],korean:m[2].trim(),english:m[3].trim()});return c;}
function parseClaimStats(t){const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,c={};let m;while((m=cp.exec(t))!==null)c[parseInt(m[1])]=m[2].trim();const tot=Object.keys(c).length;let dep=0;Object.values(c).forEach(x=>{if(/있어서|따른/.test(x))dep++;});return{total:tot,independent:tot-dep,dependent:dep,claims:c};}
function extractMermaidBlocks(t){return(t.match(/```mermaid\n([\s\S]*?)```/g)||[]).map(b=>b.replace(/```mermaid\n/,'').replace(/```/,'').trim());}
function parseMathBlocks(t){const b=[];let m;const re=/---MATH_BLOCK_\d+---\s*\nANCHOR:\s*(.+)\s*\nFORMULA:\s*\n([\s\S]*?)(?=---MATH_BLOCK_|\s*$)/g;while((m=re.exec(t))!==null)b.push({anchor:m[1].trim(),formula:m[2].trim()});return b;}
function insertMathBlocks(s08,s09){let r=s08;const b=parseMathBlocks(s09);for(const x of b.reverse()){const i=r.indexOf(x.anchor);if(i>=0){const s=i+x.anchor.length,p=r.indexOf('.',s);const ip=(p>=0&&p-s<100)?p+1:s;r=r.slice(0,ip)+'\n\n'+x.formula+'\n\n'+r.slice(ip);}}return r;}

// ══════════════════════════════════════════════
//  RENDERERS
// ══════════════════════════════════════════════
function renderOutput(sid,text){const cid=`result${sid.charAt(0).toUpperCase()+sid.slice(1).replace('_','')}`;const el=document.getElementById(cid);if(!el)return;if(sid==='step_01')renderTitleCards(el,text);else if(sid==='step_06'||sid==='step_10')renderClaimResult(el,sid,text);else renderEditableResult(el,sid,text);}
function renderTitleCards(c,text){
  const cs=parseTitleCandidates(text);
  if(!cs.length){c.innerHTML=`<div style="margin-top:12px;padding:12px;background:var(--color-bg-tertiary);border-radius:8px;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</div>`;document.getElementById('titleConfirmArea').style.display='block';return;}
  c.innerHTML='<div class="selection-cards" style="margin-top:12px">'+cs.map(x=>`<div class="selection-card" onclick="selectTitle(this,\`${x.korean.replace(/`/g,'')}\`,\`${x.english.replace(/`/g,'')}\`)"><div class="selection-card-category">${x.num}</div><div class="selection-card-title">${escapeHtml(x.korean)}</div><div class="selection-card-subtitle">${escapeHtml(x.english)}</div></div>`).join('')+'</div>';
  document.getElementById('titleConfirmArea').style.display='block';
}
function renderClaimResult(c,sid,text){
  const st=parseClaimStats(text),iss=validateClaims(text);
  let h=`<div class="stat-row" style="margin-top:12px"><div class="stat-card stat-card-steps"><div class="stat-card-value">${st.total}</div><div class="stat-card-label">총 청구항</div></div><div class="stat-card stat-card-api"><div class="stat-card-value">${st.independent}</div><div class="stat-card-label">독립항</div></div><div class="stat-card stat-card-cost"><div class="stat-card-value">${st.dependent}</div><div class="stat-card-label">종속항</div></div></div>`;
  if(iss.length)h+=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="tossface">${i.severity==='CRITICAL'?'🔴':'🟠'}</span>${escapeHtml(i.message)}</div>`).join('');
  else h+='<div class="issue-item issue-pass"><span class="tossface">✅</span>모든 검증 통과</div>';
  h+=`<textarea class="result-textarea" rows="14" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea>`;c.innerHTML=h;
}
function renderEditableResult(c,sid,text){c.innerHTML=`<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="badge badge-primary">${STEP_NAMES[sid]||sid}</span><span class="badge badge-neutral">${text.length.toLocaleString()}자</span></div><textarea class="result-textarea" rows="10" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea></div>`;}
function renderBatchResult(cid,sid,text){document.getElementById(cid).innerHTML+=`<div class="accordion-header" onclick="toggleAccordion(this)"><span><span class="tossface">✅</span> ${STEP_NAMES[sid]} <span class="badge badge-neutral">${text.length.toLocaleString()}자</span></span><span class="arrow">▶</span></div><div class="accordion-body"><textarea class="result-textarea" style="min-height:120px" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea></div>`;}
function toggleAccordion(h){h.classList.toggle('open');const b=h.nextElementSibling;if(b)b.classList.toggle('open');}
function renderDiagrams(sid,mt){
  const cid=sid==='step_07'?'diagramsStep07':'diagramsStep11',el=document.getElementById(cid),blocks=extractMermaidBlocks(mt);
  if(!blocks.length){el.innerHTML=`<div class="diagram-container"><pre style="font-size:12px;white-space:pre-wrap">${escapeHtml(mt)}</pre></div>`;return;}
  el.innerHTML=blocks.map((code,i)=>`<div class="diagram-container"><div class="diagram-label">도 ${i+1}</div><div id="mermaid_${sid}_${i}"></div><details style="margin-top:8px"><summary style="font-size:11px;color:var(--color-text-tertiary);cursor:pointer">코드 보기</summary><pre style="font-size:11px;margin-top:4px;padding:8px;background:var(--color-bg-tertiary);border-radius:8px;overflow-x:auto">${escapeHtml(code)}</pre></details></div>`).join('');
  blocks.forEach((code,i)=>{const eid=`mermaid_${sid}_${i}`,svid=`svg_${sid}_${i}_${Date.now()}`;try{mermaid.render(svid,code).then(r=>{const t=document.getElementById(eid);if(t)t.innerHTML=r.svg;}).catch(()=>{const t=document.getElementById(eid);if(t)t.innerHTML='<div class="issue-item issue-high">렌더링 실패</div>';});}catch(e){const t=document.getElementById(eid);if(t)t.innerHTML='<div class="issue-item issue-high">렌더링 오류</div>';}});
}

// ══════════════════════════════════════════════
//  VALIDATION
// ══════════════════════════════════════════════
const KILLER_WORDS=[{pattern:/반드시/,msg:'"반드시" — 제한적'},{pattern:/에 한하여/,msg:'"~에 한하여" — 제한적'},{pattern:/에 한정/,msg:'"~에 한정" — 제한적'},{pattern:/에 제한/,msg:'"~에 제한" — 제한적'},{pattern:/필수적으로/,msg:'"필수적으로" — 제한적'}];
function validateClaims(text){
  const iss=[];if(!text)return iss;
  const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,claims={};let m;
  while((m=cp.exec(text))!==null)claims[parseInt(m[1])]=m[2].trim();
  if(!Object.keys(claims).length){iss.push({severity:'HIGH',message:'청구항 파싱 실패'});return iss;}
  if(!claims[1])iss.push({severity:'CRITICAL',message:'독립항(청구항 1) 없음'});
  Object.entries(claims).forEach(([num,ct])=>{
    const n=parseInt(num);
    if(n>1){
      const rm=ct.match(/청구항\s*(\d+)에\s*있어서/),rn=rm?parseInt(rm[1]):1;
      if(rm){if(!claims[rn])iss.push({severity:'HIGH',message:`청구항 ${num}: 참조 청구항 ${rn} 없음`});if(rn>=n)iss.push({severity:'HIGH',message:`청구항 ${num}: 자기/후행 청구항 참조`});}
      const refs=ct.match(/상기\s+([가-힣]+(?:\s[가-힣]+){0,3})/g)||[],refText=claims[rn]||claims[1]||'';
      refs.forEach(ref=>{const raw=ref.replace(/^상기\s+/,''),cw=raw.split(/\s+/).slice(0,2).map(stripKoreanParticles).filter(w=>w.length>=2);if(!cw.length)return;if(!cw.every(w=>refText.includes(w)))iss.push({severity:'CRITICAL',message:`청구항 ${num}: "상기 ${raw}" — 청구항 ${rn}에 "${cw.join(', ')}" 선행기재 없음`});});
    }
    KILLER_WORDS.forEach(kw=>{if(kw.pattern.test(ct))iss.push({severity:'HIGH',message:`청구항 ${num}: ${kw.msg}`});});
  });
  return iss;
}
function runValidation(){
  const all=[outputs.step_06,outputs.step_10].filter(Boolean).join('\n');if(!all){showToast('청구항 없음','error');return;}
  const iss=validateClaims(all),el=document.getElementById('validationResults');
  if(!iss.length){el.innerHTML='<div class="issue-item issue-pass"><span class="tossface">🎉</span>모든 검증 통과</div>';return;}
  el.innerHTML=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="tossface">${i.severity==='CRITICAL'?'🔴':'🟠'}</span>${escapeHtml(i.message)}</div>`).join('');
}

// ══════════════════════════════════════════════
//  OUTPUT — WORD (바탕체 12pt, 줄간격 200%, 들여쓰기 1.41cm)
// ══════════════════════════════════════════════
function updateStats(){
  const c=Object.keys(outputs).filter(k=>outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;
  document.getElementById('statCompleted').textContent=`${c}/19`;
  document.getElementById('statApiCalls').textContent=usage.calls;
  document.getElementById('statCost').textContent=`$${((usage.inputTokens*15/1e6)+(usage.outputTokens*75/1e6)).toFixed(2)}`;
}
function renderPreview(){
  const el=document.getElementById('previewArea'),spec=buildSpecification();
  if(!spec.trim()){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px;text-align:center;padding:20px">생성된 항목이 없어요</p>';return;}
  el.innerHTML=spec.split(/(?=【)/).map(s=>{const h=s.match(/【(.+?)】/);if(!h)return '';return `<div class="accordion-header" onclick="toggleAccordion(this)"><span>【${escapeHtml(h[1])}】</span><span class="arrow">▶</span></div><div class="accordion-body">${escapeHtml(s)}</div>`;}).join('');
}
function buildSpecification(){
  const desc=getLatestDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  return['【발명의 설명】',`【발명의 명칭】\n${selectedTitle}`,`【기술분야】\n${outputs.step_02||''}`,`【발명의 배경이 되는 기술】\n${outputs.step_03||''}`,`【선행기술문헌】\n${outputs.step_04||''}`,'【발명의 내용】',`【해결하고자 하는 과제】\n${outputs.step_05||''}`,`【과제의 해결 수단】\n${outputs.step_17||''}`,`【발명의 효과】\n${outputs.step_16||''}`,`【도면의 간단한 설명】\n${brief||''}`,`【발명을 실시하기 위한 구체적인 내용】\n${desc}${outputs.step_12?'\n\n'+outputs.step_12:''}`,`【부호의 설명】\n${outputs.step_18||''}`,`【청구범위】\n${outputs.step_06||''}${outputs.step_10?'\n\n'+outputs.step_10:''}`,`【요약서】\n${outputs.step_19||''}`].filter(Boolean).join('\n\n');
}
function copyToClipboard(){const t=buildSpecification();if(!t.trim()){showToast('복사할 내용 없음','error');return;}navigator.clipboard.writeText(t).then(()=>showToast('복사 완료')).catch(()=>showToast('클립보드 접근 불가','error'));}
function downloadAsTxt(){const t=buildSpecification();if(!t.trim()){showToast('내용 없음','error');return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.txt`;a.click();}

function downloadAsWord(){
  const desc=getLatestDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  const secs=[
    {h:'발명의 설명'},{h:'발명의 명칭',b:selectedTitle},{h:'기술분야',b:outputs.step_02},
    {h:'발명의 배경이 되는 기술',b:outputs.step_03},{h:'선행기술문헌',b:outputs.step_04},
    {h:'발명의 내용'},{h:'해결하고자 하는 과제',b:outputs.step_05},
    {h:'과제의 해결 수단',b:outputs.step_17},{h:'발명의 효과',b:outputs.step_16},
    {h:'도면의 간단한 설명',b:brief},{h:'발명을 실시하기 위한 구체적인 내용',b:[desc,outputs.step_12].filter(Boolean).join('\n\n')},
    {h:'부호의 설명',b:outputs.step_18},
    {h:'청구범위',b:[outputs.step_06,outputs.step_10].filter(Boolean).join('\n\n')},
    {h:'요약서',b:outputs.step_19},
  ];
  // FIX: 바탕체 12pt, 줄간격 200%, 첫줄 들여쓰기 1.41cm (40pt)
  const html=secs.map(s=>{
    const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕',Batang,serif;margin-top:18pt;margin-bottom:6pt">【${escapeHtml(s.h)}】</h2>`;
    if(!s.b)return hd;
    return hd+s.b.split('\n').filter(l=>l.trim()).map(l=>{
      const hl=/【수학식\s*\d+】/.test(l)||/__+/.test(l)?'background-color:#FFFF00;':'';
      return `<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕',Batang,serif;${hl}">${escapeHtml(l.trim())}</p>`;
    }).join('');
  }).join('');
  const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕',Batang,serif;font-size:12pt;line-height:200%}</style></head><body>${html}</body></html>`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));
  a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();
  showToast('Word 다운로드 완료');
}

function downloadPptx(sid){
  const mt=outputs[sid+'_mermaid'];if(!mt){showToast('도면 없음','error');return;}
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';const blocks=extractMermaidBlocks(mt);
  if(!blocks.length){showToast('Mermaid 코드 없음','error');return;}
  blocks.forEach((code,i)=>{const slide=pptx.addSlide();slide.addText(`도 ${i+1}`,{x:0.5,y:0.2,fontSize:24,bold:true,fontFace:'Malgun Gothic'});const svg=document.querySelector(`#mermaid_${sid}_${i} svg`);if(svg){try{const d='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));slide.addImage({data:d,x:0.5,y:0.8,w:12,h:6});}catch(e){slide.addText(code,{x:0.5,y:0.8,fontSize:9,fontFace:'Consolas',w:12,h:6});}}else slide.addText(code,{x:0.5,y:0.8,fontSize:9,fontFace:'Consolas',w:12,h:6});});
  pptx.writeFile({fileName:`도면_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.pptx`});showToast('PPTX 완료');
}
function downloadPptxAll(){if(outputs.step_07_mermaid)downloadPptx('step_07');else showToast('도면 없음','error');}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
async function init(){
  mermaid.initialize({startOnLoad:false,theme:'neutral',securityLevel:'loose',fontFamily:'Pretendard Variable, Malgun Gothic, sans-serif',flowchart:{useMaxWidth:true,htmlLabels:true,curve:'basis'},themeVariables:{fontSize:'14px'}});
  const{data:{session}}=await sb.auth.getSession();
  if(session?.user) await onAuthSuccess(session.user); else showScreen('auth');
  sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT')showScreen('auth');});
}
init();
