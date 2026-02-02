/* ═══════════════════════════════════════════════════════════
   특허명세서 자동 생성 v4.7 — Claim System Redesign + Provisional
   ═══════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://uvrzwhfjtzqujawmscca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cnp3aGZqdHpxdWphd21zY2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTEwNDgsImV4cCI6MjA4NTUyNzA0OH0.JSSPMPIHsXfbNm6pgRzCTGH7aNQATl-okIkcXHl7Mkk';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══ Model Selection ═══
const MODELS = {
  sonnet: { id: 'claude-sonnet-4-5-20250929', label: 'Sonnet', inputCost: 3, outputCost: 15 },
  opus:   { id: 'claude-opus-4-5-20251101',   label: 'Opus',   inputCost: 15, outputCost: 75 }
};
let selectedModel = 'sonnet';
function getModel() { return MODELS[selectedModel].id; }
function selectModel(m) {
  selectedModel = m;
  document.getElementById('btnModelSonnet').style.background = m==='sonnet' ? 'var(--color-primary)' : 'transparent';
  document.getElementById('btnModelSonnet').style.color = m==='sonnet' ? '#fff' : 'var(--color-text-secondary)';
  document.getElementById('btnModelOpus').style.background = m==='opus' ? 'var(--color-primary)' : 'transparent';
  document.getElementById('btnModelOpus').style.color = m==='opus' ? '#fff' : 'var(--color-text-secondary)';
  showToast(`모델: ${MODELS[m].label} (${m==='opus'?'고품질·고비용':'표준·저비용'})`);
}

const SYSTEM_PROMPT = '너는 대한민국 특허청(KIPO) 심사 실무와 등록 가능성(신규성/진보성/명확성/지원요건)을 완벽히 이해한 15년 차 수석 변리사이다. 원칙: 1.표준문체(~한다) 2.글머리/마크다운 절대금지 3.SW명 대신 알고리즘 4.구성요소명(참조번호) 형태 5.명세서에 바로 붙여넣을 순수텍스트 6.제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지';

// ═══ Anchor Themes (v4.7) ═══
const ANCHOR_THEMES = [
  {key:'reliability_weighting', label:'신뢰도 가중치', desc:'입력 신뢰도/품질에 따라 가중치·기준값 조정'},
  {key:'threshold_adaptation', label:'임계값 적응', desc:'기준값/임계값의 동적 조정, 조건부 분기'},
  {key:'cross_validation', label:'교차검증', desc:'다중 출처/다중 모델 교차검증 및 불일치 보정'},
  {key:'fallback_retry', label:'장애복구/재시도', desc:'외부연동 실패/오류 시 재시도·큐잉·대체경로'},
  {key:'explainability_trace', label:'설명가능성 추적', desc:'결과와 함께 근거/기여도/추적정보 생성·저장'},
  {key:'bias_normalization', label:'편향 정규화', desc:'정규화+편향 보정+클리핑 등 다단계 전처리'},
  {key:'feedback_reweighting', label:'피드백 재가중치', desc:'피드백 누적 후 가중치 재추정'},
  {key:'privacy_audit', label:'프라이버시 감사', desc:'권한/마스킹/감사로그 기반 제어'}
];
const CATEGORY_ENDINGS = {
  server:'~을 포함하는 서버.', system:'~을 포함하는 시스템.',
  apparatus:'~을 포함하는 장치.', electronic_device:'~을 포함하는 전자단말.',
  method:'~하는 방법.',
  recording_medium:'컴퓨터가 …을 수행하도록 하는 프로그램을 기록한 컴퓨터 판독가능 기록매체.',
  computer_program:'컴퓨터가 …을 수행하도록 하는 프로그램.'
};

let API_KEY='',currentUser=null,currentProfile=null,currentProjectId=null;
let outputs={},selectedTitle='',selectedTitleType='',includeMethodClaims=true;
let usage={calls:0,inputTokens:0,outputTokens:0,cost:0},loadingState={};
let detailLevel='standard';
let customDetailChars=2000;

// ═══ Claim System v4.7 ═══
let deviceCategory='server', deviceGeneralDep=5, deviceAnchorDep=4, deviceAnchorStart=7;
let anchorThemeMode='auto', selectedAnchorThemes=[];
let methodCategory='method', methodGeneralDep=3, methodAnchorDep=2, methodAnchorStart=0;
let methodAnchorThemeMode='auto', selectedMethodAnchorThemes=[];

// ═══ Required Figures ═══
let requiredFigures=[]; // [{num, description}]

// ═══ Reference Documents (Global + Project) ═══
let globalRefStyleText='';   // Dashboard level — all projects
let projectRefStyleText='';  // Project level — this project only

let beforeReviewText = '';
let uploadedFiles = [];
let diagramData = {};

// ═══ Step 8 정형문 ═══
const STEP8_PREFIX = `이하, 본 발명의 실시예를 첨부된 도면을 참조하여 상세하게 설명한다.
실시예를 설명함에 있어서 본 발명이 속하는 기술 분야에 익히 알려져 있고 본 발명과 직접적으로 관련이 없는 기술 내용에 대해서는 설명을 생략한다. 이는 불필요한 설명을 생략함으로써 본 발명의 요지를 흐리지 않고 더욱 명확히 전달하기 위함이다.
마찬가지 이유로 첨부 도면에 있어서 일부 구성요소는 과장되거나 생략되거나 개략적으로 도시되었다. 또한, 각 구성요소의 크기는 실제 크기를 전적으로 반영하는 것이 아니다. 각 도면에서 동일한 또는 대응하는 구성요소에는 동일한 참조 번호를 부여하였다.
본 발명의 이점 및 특징, 그리고 그것들을 달성하는 방법은 첨부되는 도면과 함께 상세하게 후술되어 있는 실시 예들을 참조하면 명확해질 것이다. 그러나 본 발명은 이하에서 개시되는 실시 예들에 한정되는 것이 아니라 서로 다른 다양한 형태로 구현될 수 있으며, 단지 본 실시 예들은 본 발명의 개시가 완전하도록 하고, 본 발명이 속하는 기술분야에서 통상의 지식을 가진 자에게 발명의 범주를 완전하게 알려주기 위해 제공되는 것이며, 본 발명은 청구항의 범주에 의해 정의될 뿐이다. 명세서 전체에 걸쳐 동일 참조 부호는 동일 구성 요소를 지칭한다.
이때, 처리 흐름도 도면들의 각 블록과 흐름도 도면들의 조합들은 컴퓨터 프로그램 인스트럭션들에 의해 수행될 수 있음을 이해할 수 있을 것이다. 이들 컴퓨터 프로그램 인스트럭션들은 범용 컴퓨터, 특수용 컴퓨터 또는 기타 프로그램 가능한 데이터 프로세싱 장비의 프로세서에 탑재될 수 있으므로, 컴퓨터 또는 기타 프로그램 가능한 데이터 프로세싱 장비의 프로세서를 통해 수행되는 그 인스트럭션들이 흐름도 블록(들)에서 설명된 기능들을 수행하는 수단을 생성하게 된다. 이들 컴퓨터 프로그램 인스트럭션들은 특정 방식으로 기능을 구현하기 위해 컴퓨터 또는 기타 프로그램 가능한 데이터 프로세싱 장비를 지향할 수 있는 컴퓨터 이용 가능 또는 컴퓨터 판독 가능 메모리에 저장되는 것도 가능하므로, 그 컴퓨터 이용가능 또는 컴퓨터 판독 가능 메모리에 저장된 인스트럭션들은 흐름도 블록(들)에서 설명된 기능을 수행하는 인스트럭션 수단을 내포하는 제조 품목을 생산하는 것도 가능하다. 컴퓨터 프로그램 인스트럭션들은 컴퓨터 또는 기타 프로그램 가능한 데이터 프로세싱 장비 상에 탑재되는 것도 가능하므로, 컴퓨터 또는 기타 프로그램 가능한 데이터 프로세싱 장비 상에서 일련의 동작 단계들이 수행되어 컴퓨터로 실행되는 프로세스를 생성해서 컴퓨터 또는 기타 프로그램 가능한 데이터 프로세싱 장비를 수행하는 인스트럭션들은 흐름도 블록(들)에서 설명된 기능들을 실행하기 위한 단계들을 제공하는 것도 가능하다.
또한, 각 블록은 특정된 논리적 기능(들)을 실행하기 위한 하나 이상의 실행 가능한 인스트럭션들을 포함하는 모듈, 세그먼트 또는 코드의 일부를 나타낼 수 있다. 또, 몇 가지 대체 실행 예들에서는 블록들에서 언급된 기능들이 순서를 벗어나서 발생하는 것도 가능함을 주목해야 한다. 예컨대, 잇달아 도시되어 있는 두 개의 블록들은 사실 실질적으로 동시에 수행되는 것도 가능하고 또는 그 블록들이 때때로 해당하는 기능에 따라 역순으로 수행되는 것도 가능하다.
이 때, 본 실시 예에서 사용되는 '~부'라는 용어는 소프트웨어 또는 FPGA(field-Programmable Gate Array) 또는 ASIC(Application Specific Integrated Circuit)과 같은 하드웨어 구성요소를 의미하며, '~부'는 어떤 역할들을 수행한다. 그렇지만 '~부'는 소프트웨어 또는 하드웨어에 한정되는 의미는 아니다. '~부'는 어드레싱할 수 있는 저장 매체에 있도록 구성될 수도 있고 하나 또는 그 이상의 프로세서들을 재생시키도록 구성될 수도 있다. 따라서, 일 예로서 '~부'는 소프트웨어 구성요소들, 객체지향 소프트웨어 구성요소들, 클래스 구성요소들 및 태스크 구성요소들과 같은 구성요소들과, 프로세스들, 함수들, 속성들, 프로시저들, 서브루틴들, 프로그램 코드의 세그먼트들, 드라이버들, 펌웨어, 마이크로코드, 회로, 데이터, 데이터베이스, 데이터 구조들, 테이블들, 어레이들, 및 변수들을 포함한다. 구성요소들과 '~부'들 안에서 제공되는 기능은 더 작은 수의 구성요소들 및 '~부'들로 결합되거나 추가적인 구성요소들과 '~부'들로 더 분리될 수 있다. 뿐만 아니라, 구성요소들 및 '~부'들은 디바이스 또는 보안 멀티미디어카드 내의 하나 또는 그 이상의 CPU들을 재생시키도록 구현될 수도 있다.
본 발명의 실시예들을 구체적으로 설명함에 있어서, 특정 시스템의 예를 주된 대상으로 할 것이지만, 본 명세서에서 청구하고자 하는 주요한 요지는 유사한 기술적 배경을 가지는 여타의 통신 시스템 및 서비스에도 본 명세서에 개시된 범위를 크게 벗어나지 아니하는 범위에서 적용 가능하며, 이는 당해 기술분야에서 숙련된 기술적 지식을 가진 자의 판단으로 가능할 것이다.`;

const STEP8_SUFFIX = `본 발명에 따른 방법들은 다양한 컴퓨터 수단을 통해 수행될 수 있는 프로그램 명령 형태로 구현되어 컴퓨터 판독 가능 매체에 기록될 수 있다. 컴퓨터 판독 가능 매체는 프로그램 명령, 데이터 파일, 데이터 구조 등을 단독으로 또는 조합하여 포함할 수 있다. 컴퓨터 판독 가능 매체에 기록되는 프로그램 명령은 본 발명을 위해 특별히 설계되고 구성된 것들이거나 컴퓨터 소프트웨어 당업자에게 공지되어 사용 가능한 것일 수도 있다.
컴퓨터 판독 가능 매체의 예에는 롬(ROM), 램(RAM), 플래시 메모리(flash memory) 등과 같이 프로그램 명령을 저장하고 수행하도록 특별히 구성된 하드웨어 장치가 포함될 수 있다. 프로그램 명령의 예에는 컴파일러(compiler)에 의해 만들어지는 것과 같은 기계어 코드뿐만 아니라 인터프리터(interpreter) 등을 사용해서 컴퓨터에 의해 실행될 수 있는 고급 언어 코드를 포함할 수 있다. 상술한 하드웨어 장치는 본 발명의 동작을 수행하기 위해 적어도 하나의 소프트웨어 모듈로 작동하도록 구성될 수 있으며, 그 역도 마찬가지이다.
또한, 상술한 방법 또는 장치는 그 구성이나 기능의 전부 또는 일부가 결합되어 구현되거나, 분리되어 구현될 수 있다.
상기에서는 본 발명의 바람직한 실시예를 참조하여 설명하였지만, 해당 기술 분야의 숙련된 당업자는 하기의 특허 청구의 범위에 기재된 본 발명의 사상 및 필드로부터 벗어나지 않는 범위 내에서 본 발명을 다양하게 수정 및 변경시킬 수 있음을 이해할 수 있을 것이다.`;

const STEP_NAMES={step_01:'발명의 명칭',step_02:'기술분야',step_03:'배경기술',step_04:'선행기술문헌',step_05:'해결하고자 하는 과제',step_06:'장치 청구항',step_07:'도면 설계',step_08:'장치 상세설명',step_09:'수학식',step_10:'방법 청구항',step_11:'방법 도면',step_12:'방법 상세설명',step_13:'검토',step_14:'대안 청구항',step_15:'기재불비',step_16:'발명의 효과',step_17:'과제의 해결 수단',step_18:'부호의 설명',step_19:'요약서'};

// ═══════════ UTILITIES ═══════════
function escapeHtml(t){if(!t)return '';return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');}
function showToast(m,type='success'){const c=document.getElementById('toastContainer'),icon=type==='success'?'✅':type==='error'?'❌':'ℹ️',t=document.createElement('div');t.className='toast';t.innerHTML=`<span class="tossface">${icon}</span> ${escapeHtml(m)}`;c.appendChild(t);setTimeout(()=>t.remove(),3000);}
function showProgress(cid,label,cur,tot){const el=document.getElementById(cid);if(!el)return;const p=Math.round(cur/tot*100);el.innerHTML=`<div class="progress-container"><div class="progress-label"><div class="progress-dot"></div>${escapeHtml(label)}</div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${p}%"></div></div><div class="progress-info"><span>${cur}/${tot}</span><span>${p}%</span></div></div>`;}
function clearProgress(id){const el=document.getElementById(id);if(el)el.innerHTML='';}
function setButtonLoading(bid,on){const b=document.getElementById(bid);if(!b)return;if(on){b.classList.add('btn-loading');b.disabled=true;}else{b.classList.remove('btn-loading');b.disabled=false;}}

// ═══════════ SCREEN ═══════════
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.display='';});
  ['adminPanel','screenMain','screenDashboard'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  switch(name){
    case 'auth':document.getElementById('screenAuth').classList.add('active');break;
    case 'tos':document.getElementById('screenTos').classList.add('active');break;
    case 'pending':document.getElementById('screenPending').classList.add('active');break;
    case 'dashboard':document.getElementById('screenDashboard').style.display='block';document.getElementById('screenDashboard').classList.add('active');loadDashboardProjects();loadGlobalRefFromStorage();break;
    case 'main':document.getElementById('screenMain').style.display='block';document.getElementById('screenMain').classList.add('active');break;
    case 'admin':document.getElementById('adminPanel').style.display='block';document.getElementById('adminPanel').classList.add('active');loadAdminUsers();break;
  }
}

// ═══════════ STATE MANAGEMENT ═══════════
function clearAllState(){
  currentProjectId=null;outputs={};selectedTitle='';selectedTitleType='';includeMethodClaims=true;
  usage={calls:0,inputTokens:0,outputTokens:0,cost:0};loadingState={};beforeReviewText='';uploadedFiles=[];diagramData={};
  projectRefStyleText='';requiredFigures=[];
  // Claim defaults
  deviceCategory='server';deviceGeneralDep=5;deviceAnchorDep=4;deviceAnchorStart=7;
  anchorThemeMode='auto';selectedAnchorThemes=[];
  methodCategory='method';methodGeneralDep=3;methodAnchorDep=2;methodAnchorStart=0;
  methodAnchorThemeMode='auto';selectedMethodAnchorThemes=[];
  // globalRefStyleText persists across projects
  const ids=['projectInput','titleInput'];ids.forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['titleConfirmArea','titleConfirmMsg','batchArea'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  for(let i=1;i<=19;i++){const e=document.getElementById(`resultStep${String(i).padStart(2,'0')}`);if(e)e.innerHTML='';}
  ['resultsBatch25','resultsBatchFinish','validationResults','previewArea','diagramsStep07','diagramsStep11','fileList','requiredFiguresList'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='';});
  ['btnApplyReview','btnPptx07','reviewApplyResult'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.querySelectorAll('.tab-item').forEach((t,i)=>{t.classList.toggle('active',i===0);t.setAttribute('aria-selected',i===0);});
  document.querySelectorAll('.page').forEach((p,i)=>p.classList.toggle('active',i===0));
  const mt=document.getElementById('methodToggle');if(mt){mt.checked=true;toggleMethod();}
  document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));
  const b01=document.getElementById('btnStep01');if(b01)b01.disabled=true;
  updateStats();
}

// ═══════════ AUTH (API Key Bug Fix) ═══════════
function switchAuthTab(tab){document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));if(tab==='login'){document.querySelector('.auth-tab:first-child').classList.add('active');document.getElementById('authLogin').style.display='block';document.getElementById('authSignup').style.display='none';}else{document.querySelector('.auth-tab:last-child').classList.add('active');document.getElementById('authLogin').style.display='none';document.getElementById('authSignup').style.display='block';}}
async function handleLogin(){const e=document.getElementById('loginEmail').value.trim(),p=document.getElementById('loginPassword').value;if(!e||!p){showToast('이메일과 비밀번호를 입력해 주세요','error');return;}setButtonLoading('btnLogin',true);const{data,error}=await sb.auth.signInWithPassword({email:e,password:p});setButtonLoading('btnLogin',false);if(error){showToast(error.message,'error');return;}await onAuthSuccess(data.user);}
async function handleSignup(){const e=document.getElementById('signupEmail').value.trim(),p=document.getElementById('signupPassword').value,n=document.getElementById('signupName').value.trim();if(!e||!p){showToast('이메일과 비밀번호를 입력해 주세요','error');return;}if(p.length<6){showToast('비밀번호는 6자 이상','error');return;}setButtonLoading('btnSignup',true);const{data,error}=await sb.auth.signUp({email:e,password:p,options:{data:{display_name:n||e}}});setButtonLoading('btnSignup',false);if(error){showToast(error.message,'error');return;}showToast('회원가입 완료!');if(data.user)await onAuthSuccess(data.user);}
async function handleLogout(){clearAllState();API_KEY='';await sb.auth.signOut();currentUser=null;currentProfile=null;showScreen('auth');}

async function onAuthSuccess(user){
  currentUser=user;let{data:profile}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(!profile){const{data:np,error}=await sb.from('profiles').insert({id:user.id,display_name:user.user_metadata?.display_name||user.email,role:'user',status:'pending',tos_accepted:false}).select('*').single();if(error){showToast('프로필 생성 실패','error');return;}profile=np;}
  currentProfile=profile;
  if(!profile.tos_accepted){showScreen('tos');return;}if(profile.status==='pending'){showScreen('pending');return;}if(profile.status==='suspended'){showToast('계정 정지됨','error');return;}
  const dn=document.getElementById('dashUserName');if(dn)dn.textContent=profile.display_name||user.email;
  if(profile.role==='admin'){const ab=document.getElementById('btnDashAdmin');if(ab)ab.style.display='inline-flex';}
  // FIX: API Key — profile DB → localStorage fallback
  API_KEY=profile.api_key_encrypted||'';
  if(!API_KEY){try{API_KEY=localStorage.getItem('patent_api_key')||'';}catch(e){}}
  clearAllState();showScreen('dashboard');
}
async function handleTosAccept(){if(!document.getElementById('tosCheck1').checked||!document.getElementById('tosCheck2').checked){showToast('모든 항목에 동의해 주세요','error');return;}await sb.from('profiles').update({tos_accepted:true,tos_accepted_at:new Date().toISOString()}).eq('id',currentUser.id);currentProfile.tos_accepted=true;if(currentProfile.status==='pending')showScreen('pending');else await onAuthSuccess(currentUser);}
async function checkApprovalStatus(){const{data}=await sb.from('profiles').select('status').eq('id',currentUser.id).single();if(data?.status==='approved')await onAuthSuccess(currentUser);else showToast('아직 승인 대기 중','info');}

// FIX: saveApiKey — update currentProfile + localStorage
async function saveApiKey(){
  const k=document.getElementById('apiKeyInput').value.trim();
  if(!k){showToast('API Key를 입력해 주세요','error');return;}
  API_KEY=k;
  if(currentProfile)currentProfile.api_key_encrypted=k;
  try{localStorage.setItem('patent_api_key',k);}catch(e){}
  if(currentUser){await sb.from('profiles').update({api_key_encrypted:k}).eq('id',currentUser.id);}
  document.getElementById('apiKeyModal').style.display='none';
  showToast('API Key 저장 완료');
}
function showApiKeyModal(){const inp=document.getElementById('apiKeyInput');if(inp&&API_KEY)inp.value=API_KEY;document.getElementById('apiKeyModal').style.display='flex';}

// ═══════════ ADMIN ═══════════
async function loadAdminUsers(){const{data:u}=await sb.from('profiles').select('*').order('created_at',{ascending:false});const el=document.getElementById('adminUserList');if(!u?.length){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px">사용자 없음</p>';return;}el.innerHTML=u.map(x=>`<div class="admin-user-item"><div class="admin-user-info"><div class="admin-user-name">${escapeHtml(x.display_name||x.id)}</div><div class="admin-user-status"><span class="badge ${x.status==='approved'?'badge-success':x.status==='pending'?'badge-warning':'badge-error'}">${x.status}</span> <span class="badge badge-neutral">${x.role}</span></div></div><div style="display:flex;gap:4px">${x.status==='pending'?`<button class="btn btn-primary btn-sm" onclick="adminApprove('${x.id}')">승인</button>`:''} ${x.status==='approved'?`<button class="btn btn-outline btn-sm" onclick="adminSuspend('${x.id}')">정지</button>`:''} ${x.status==='suspended'?`<button class="btn btn-outline btn-sm" onclick="adminApprove('${x.id}')">해제</button>`:''}</div></div>`).join('');}
async function adminApprove(id){await sb.from('profiles').update({status:'approved'}).eq('id',id);showToast('승인됨');loadAdminUsers();}
async function adminSuspend(id){await sb.from('profiles').update({status:'suspended'}).eq('id',id);showToast('정지됨');loadAdminUsers();}

// ═══════════ DASHBOARD ═══════════
async function loadDashboardProjects(){
  const{data}=await sb.from('projects').select('id,title,invention_content,current_state_json,created_at,updated_at').eq('owner_user_id',currentUser.id).order('updated_at',{ascending:false});
  const el=document.getElementById('dashProjectList'),cnt=document.getElementById('dashProjectCount');
  if(!data?.length){el.innerHTML='<div style="text-align:center;padding:32px;color:var(--color-text-tertiary)"><div style="font-size:40px;margin-bottom:8px"><span class="tossface">📭</span></div><p>아직 생성된 사건이 없어요.</p></div>';cnt.textContent='0건';return;}
  cnt.textContent=`${data.length}건`;
  el.innerHTML=data.map(p=>{const s=p.current_state_json||{},o=s.outputs||{},c=Object.keys(o).filter(k=>o[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length,pct=Math.round(c/19*100);
    return `<div class="card" style="margin-bottom:12px;cursor:pointer;transition:box-shadow 0.15s" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='var(--shadow-sm)'" onclick="openProject('${p.id}')"><div style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.title)}</div><div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">생성 ${new Date(p.created_at).toLocaleDateString('ko-KR')} · 수정 ${new Date(p.updated_at).toLocaleDateString('ko-KR')}</div></div><div style="display:flex;gap:6px;margin-left:12px;flex-shrink:0"><span class="badge ${pct===100?'badge-success':pct>0?'badge-primary':'badge-neutral'}">${c}/19 (${pct}%)</span><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();confirmDeleteProject('${p.id}','${escapeHtml(p.title).replace(/'/g,"\\\\'")}')">🗑️</button></div></div><div class="progress-bar-bg" style="margin-top:10px;height:4px"><div class="progress-bar-fill" style="width:${pct}%;height:4px"></div></div></div></div>`;
  }).join('');
}

// ═══ Global Reference Document (Dashboard level) ═══
function loadGlobalRefFromStorage(){
  try{globalRefStyleText=localStorage.getItem('patent_global_ref')||'';}catch(e){globalRefStyleText='';}
  const st=document.getElementById('globalRefStatus');
  if(st){
    if(globalRefStyleText)st.innerHTML=`<span class="tossface">✅</span> 등록됨 (${globalRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearGlobalRef()" style="margin-left:4px">✕</button>`;
    else st.textContent='업로드된 문서 없음';
  }
}
async function handleGlobalRefUpload(event){
  const file=event.target.files[0];if(!file)return;
  const st=document.getElementById('globalRefStatus');
  st.textContent='추출 중...';st.style.color='var(--color-primary)';
  try{
    const text=await extractTextFromFile(file);
    if(text&&text.trim()&&!text.startsWith('[')){
      globalRefStyleText=text.trim().slice(0,5000);
      try{localStorage.setItem('patent_global_ref',globalRefStyleText);}catch(e){}
      st.innerHTML=`<span class="tossface">✅</span> ${escapeHtml(file.name)} (${globalRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearGlobalRef()" style="margin-left:4px">✕</button>`;
      st.style.color='var(--color-success)';
      showToast('공통 참고 문서 등록 완료 — 모든 프로젝트에 적용');
    }else{st.textContent='텍스트 추출 불가';st.style.color='var(--color-error)';}
  }catch(e){st.textContent='오류 발생';st.style.color='var(--color-error)';showToast(e.message,'error');}
  event.target.value='';
}
function clearGlobalRef(){globalRefStyleText='';try{localStorage.removeItem('patent_global_ref');}catch(e){}const st=document.getElementById('globalRefStatus');if(st){st.textContent='업로드된 문서 없음';st.style.color='var(--color-text-tertiary)';}showToast('공통 참고 문서 제거됨');}

function openNewProjectModal(){document.getElementById('newProjectTitle').value='';document.getElementById('newProjectModal').style.display='flex';document.getElementById('newProjectTitle').focus();}
function closeNewProjectModal(){document.getElementById('newProjectModal').style.display='none';}
async function createAndOpenProject(){const t=document.getElementById('newProjectTitle').value.trim();if(!t){showToast('사건명을 입력해 주세요','error');return;}const{data,error}=await sb.from('projects').insert({owner_user_id:currentUser.id,title:t,invention_content:'',current_state_json:{outputs:{},selectedTitle:'',selectedTitleType:'',includeMethodClaims:true,usage:{calls:0,inputTokens:0,outputTokens:0}}}).select('id').single();if(error){showToast('생성 실패','error');return;}closeNewProjectModal();await openProject(data.id);}

async function openProject(pid){
  clearAllState();const{data}=await sb.from('projects').select('*').eq('id',pid).single();if(!data){showToast('불러올 수 없어요','error');return;}
  currentProjectId=data.id;document.getElementById('projectInput').value=data.invention_content||'';
  const s=data.current_state_json||{};outputs=s.outputs||{};selectedTitle=s.selectedTitle||'';selectedTitleType=s.selectedTitleType||'';includeMethodClaims=s.includeMethodClaims!==false;usage=s.usage||{calls:0,inputTokens:0,outputTokens:0};
  // Restore v4.7 claim config
  deviceCategory=s.deviceCategory||'server';deviceGeneralDep=s.deviceGeneralDep||5;deviceAnchorDep=s.deviceAnchorDep||4;deviceAnchorStart=s.deviceAnchorStart||7;
  anchorThemeMode=s.anchorThemeMode||'auto';selectedAnchorThemes=s.selectedAnchorThemes||[];
  methodCategory=s.methodCategory||'method';methodGeneralDep=s.methodGeneralDep||3;methodAnchorDep=s.methodAnchorDep||2;methodAnchorStart=s.methodAnchorStart||0;
  methodAnchorThemeMode=s.methodAnchorThemeMode||'auto';selectedMethodAnchorThemes=s.selectedMethodAnchorThemes||[];
  projectRefStyleText=s.projectRefStyleText||'';requiredFigures=s.requiredFigures||[];
  // Restore UI
  document.getElementById('methodToggle').checked=includeMethodClaims;toggleMethod();
  restoreClaimUI();
  if(selectedTitle){document.getElementById('titleInput').value=selectedTitle;document.getElementById('titleConfirmArea').style.display='block';document.getElementById('titleConfirmMsg').style.display='block';document.getElementById('batchArea').style.display='block';}
  Object.keys(outputs).forEach(k=>{if(outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied'))renderOutput(k,outputs[k]);});
  document.getElementById('headerProjectName').textContent=data.title;document.getElementById('headerUserName').textContent=currentProfile?.display_name||currentUser?.email||'';
  if(currentProfile?.role==='admin')document.getElementById('btnAdmin').style.display='inline-flex';
  updateStats();
  showScreen('main');showToast(`"${data.title}" 열림`);
}
function restoreClaimUI(){
  const dc=document.getElementById('selDeviceCategory');if(dc)dc.value=deviceCategory;
  const dgd=document.getElementById('inpDeviceGeneralDep');if(dgd)dgd.value=deviceGeneralDep;
  const dad=document.getElementById('inpDeviceAnchorDep');if(dad)dad.value=deviceAnchorDep;
  const das=document.getElementById('inpDeviceAnchorStart');if(das)das.value=deviceAnchorStart;
  const mc=document.getElementById('selMethodCategory');if(mc)mc.value=methodCategory;
  const mgd=document.getElementById('inpMethodGeneralDep');if(mgd)mgd.value=methodGeneralDep;
  const mad=document.getElementById('inpMethodAnchorDep');if(mad)mad.value=methodAnchorDep;
  updateDeviceClaimTotal();updateMethodClaimTotal();
  // Restore required figures
  renderRequiredFiguresList();
  // Restore project ref
  const prs=document.getElementById('projectRefStatus');
  if(prs&&projectRefStyleText)prs.innerHTML=`<span class="tossface">✅</span> 등록됨 (${projectRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearProjectRef()" style="margin-left:4px">✕</button>`;
}

async function backToDashboard(){if(currentProjectId)await saveProject(true);clearAllState();showScreen('dashboard');}
async function confirmDeleteProject(id,t){if(!confirm(`"${t}" 사건을 삭제하시겠어요?`))return;await sb.from('projects').delete().eq('id',id);showToast('삭제됨');loadDashboardProjects();}
async function saveProject(silent=false){if(!currentProjectId)return;const t=selectedTitle||document.getElementById('projectInput').value.slice(0,30)||'새 사건';await sb.from('projects').update({title:t,invention_content:document.getElementById('projectInput').value,current_state_json:{outputs,selectedTitle,selectedTitleType,includeMethodClaims,usage,deviceCategory,deviceGeneralDep,deviceAnchorDep,deviceAnchorStart,anchorThemeMode,selectedAnchorThemes,methodCategory,methodGeneralDep,methodAnchorDep,methodAnchorStart,methodAnchorThemeMode,selectedMethodAnchorThemes,projectRefStyleText,requiredFigures}}).eq('id',currentProjectId);if(!silent)showToast('저장됨');}

// ═══════════ TAB & TOGGLES & CLAIM UI (v4.7) ═══════════
function switchTab(i){document.querySelectorAll('.tab-item').forEach((t,j)=>{t.classList.toggle('active',j===i);t.setAttribute('aria-selected',j===i);});document.querySelectorAll('.page').forEach((p,j)=>p.classList.toggle('active',j===i));if(i===4)renderPreview();}
function toggleMethod(){includeMethodClaims=document.getElementById('methodToggle').checked;['methodClaimsCard','methodDiagramCard','methodDescCard'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.toggle('card-disabled',!includeMethodClaims);});}
function selectDetailLevel(el,level){
  document.querySelectorAll('#detailLevelCards .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');detailLevel=level;
  const ci=document.getElementById('customDetailInput');
  if(ci) ci.style.display = level==='custom' ? 'block' : 'none';
}

// Claim config update handlers
function updateDeviceCategory(v){deviceCategory=v;}
function updateDeviceGeneralDep(v){deviceGeneralDep=parseInt(v)||5;autoCalcDeviceAnchorStart();updateDeviceClaimTotal();}
function updateDeviceAnchorDep(v){deviceAnchorDep=parseInt(v)||4;updateDeviceClaimTotal();}
function updateDeviceAnchorStart(v){deviceAnchorStart=parseInt(v)||7;updateDeviceClaimTotal();}
function autoCalcDeviceAnchorStart(){deviceAnchorStart=deviceGeneralDep+2;const el=document.getElementById('inpDeviceAnchorStart');if(el)el.value=deviceAnchorStart;}
function updateDeviceClaimTotal(){
  const total=1+deviceGeneralDep+deviceAnchorDep;
  const el=document.getElementById('deviceClaimTotal');
  if(el)el.textContent=`독립항 1 + 일반 ${deviceGeneralDep} + 앵커 ${deviceAnchorDep} = ${total}개`;
}
function toggleDeviceAnchorThemes(mode){
  anchorThemeMode=mode;
  const el=document.getElementById('deviceThemeCheckboxes');
  if(el)el.style.display=mode==='fixed'?'flex':'none';
}
function toggleDeviceTheme(key,checked){
  if(checked&&!selectedAnchorThemes.includes(key))selectedAnchorThemes.push(key);
  else selectedAnchorThemes=selectedAnchorThemes.filter(k=>k!==key);
}

function updateMethodCategory(v){methodCategory=v;}
function updateMethodGeneralDep(v){methodGeneralDep=parseInt(v)||3;autoCalcMethodAnchorStart();updateMethodClaimTotal();}
function updateMethodAnchorDep(v){methodAnchorDep=parseInt(v)||2;updateMethodClaimTotal();}
function autoCalcMethodAnchorStart(){
  const devTotal=1+deviceGeneralDep+deviceAnchorDep;
  methodAnchorStart=devTotal+1+methodGeneralDep;
}
function updateMethodClaimTotal(){
  const total=1+methodGeneralDep+methodAnchorDep;
  const el=document.getElementById('methodClaimTotal');
  if(el)el.textContent=`독립항 1 + 일반 ${methodGeneralDep} + 앵커 ${methodAnchorDep} = ${total}개`;
}
function toggleMethodAnchorThemes(mode){
  methodAnchorThemeMode=mode;
  const el=document.getElementById('methodThemeCheckboxes');
  if(el)el.style.display=mode==='fixed'?'flex':'none';
}
function toggleMethodTheme(key,checked){
  if(checked&&!selectedMethodAnchorThemes.includes(key))selectedMethodAnchorThemes.push(key);
  else selectedMethodAnchorThemes=selectedMethodAnchorThemes.filter(k=>k!==key);
}

// ═══ Required Figures ═══
function addRequiredFigure(){
  const numEl=document.getElementById('reqFigNum'),descEl=document.getElementById('reqFigDesc');
  const num=parseInt(numEl?.value);const desc=descEl?.value?.trim();
  if(!num||num<1){showToast('도면 번호를 입력하세요','error');return;}
  if(!desc){showToast('도면 설명을 입력하세요','error');return;}
  if(requiredFigures.find(f=>f.num===num)){showToast(`도 ${num}은 이미 등록됨`,'error');return;}
  requiredFigures.push({num,description:desc});
  requiredFigures.sort((a,b)=>a.num-b.num);
  if(numEl)numEl.value='';if(descEl)descEl.value='';
  renderRequiredFiguresList();
  showToast(`도 ${num} 필수 도면 등록`);
}
function removeRequiredFigure(num){
  requiredFigures=requiredFigures.filter(f=>f.num!==num);
  renderRequiredFiguresList();
}
function renderRequiredFiguresList(){
  const el=document.getElementById('requiredFiguresList');if(!el)return;
  if(!requiredFigures.length){el.innerHTML='';return;}
  el.innerHTML=requiredFigures.map(f=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:4px;font-size:13px"><span class="badge badge-primary">도 ${f.num}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.description)}</span><button class="btn btn-ghost btn-sm" onclick="removeRequiredFigure(${f.num})">✕</button></div>`).join('');
}

// ═══ Project Reference Document ═══
async function handleProjectRefUpload(event){
  const file=event.target.files[0];if(!file)return;
  const st=document.getElementById('projectRefStatus');
  st.textContent='추출 중...';st.style.color='var(--color-primary)';
  try{
    const text=await extractTextFromFile(file);
    if(text&&text.trim()&&!text.startsWith('[')){
      projectRefStyleText=text.trim().slice(0,5000);
      st.innerHTML=`<span class="tossface">✅</span> ${escapeHtml(file.name)} (${projectRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearProjectRef()" style="margin-left:4px">✕</button>`;
      st.style.color='var(--color-success)';
      showToast('이 프로젝트 전용 참고 문서 등록 (공통 참고 문서 대신 사용)');
    }else{st.textContent='추출 불가';st.style.color='var(--color-error)';}
  }catch(e){st.textContent='오류';st.style.color='var(--color-error)';}
  event.target.value='';
}
function clearProjectRef(){projectRefStyleText='';const st=document.getElementById('projectRefStatus');if(st){st.textContent='없음 (공통 참고 문서 사용)';st.style.color='var(--color-text-tertiary)';}showToast('프로젝트 참고 문서 제거됨');}

function selectTitleType(el,type){document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selectedTitleType=type;document.getElementById('btnStep01').disabled=false;}
function selectTitle(el,kr,en){document.querySelectorAll('#resultStep01 .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selectedTitle=kr;document.getElementById('titleInput').value=kr;document.getElementById('titleConfirmArea').style.display='block';document.getElementById('titleConfirmMsg').style.display='block';document.getElementById('batchArea').style.display='block';}
function onTitleInput(){const v=document.getElementById('titleInput').value.trim();document.querySelectorAll('#resultStep01 .selection-card').forEach(c=>c.classList.remove('selected'));selectedTitle=v;document.getElementById('titleConfirmMsg').style.display=v?'block':'none';document.getElementById('batchArea').style.display=v?'block':'none';}

// ═══════════ API ═══════════
async function callClaude(prompt,maxTokens=8192){
  if(!API_KEY){document.getElementById('apiKeyModal').style.display='flex';throw new Error('API Key 필요');}
  const model=getModel(), mc=MODELS[selectedModel];
  const ctrl=new AbortController(),tout=setTimeout(()=>ctrl.abort(),120000);
  try{const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ctrl.signal,headers:{'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:maxTokens,system:SYSTEM_PROMPT,messages:[{role:'user',content:prompt}]})});clearTimeout(tout);
    if(res.status===401){API_KEY='';if(currentProfile)currentProfile.api_key_encrypted='';try{localStorage.removeItem('patent_api_key');}catch(e){}document.getElementById('apiKeyModal').style.display='flex';throw new Error('API Key 유효하지 않음');}
    if(res.status===429)throw new Error('요청 과다. 30초 후 재시도');if(res.status>=500)throw new Error('서버 오류');
    const d=await res.json();if(d.error)throw new Error(d.error.message);
    const it=d.usage?.input_tokens||0,ot=d.usage?.output_tokens||0;
    usage.calls++;usage.inputTokens+=it;usage.outputTokens+=ot;
    usage.cost+=(it*mc.inputCost/1e6)+(ot*mc.outputCost/1e6);
    updateStats();
    return{text:d.content[0].text,stopReason:d.stop_reason};
  }catch(e){clearTimeout(tout);if(e.name==='AbortError')throw new Error('타임아웃');throw e;}
}
// Force Sonnet for provisional
async function callClaudeSonnet(prompt,maxTokens=8192){
  if(!API_KEY){document.getElementById('apiKeyModal').style.display='flex';throw new Error('API Key 필요');}
  const mc=MODELS.sonnet;
  const ctrl=new AbortController(),tout=setTimeout(()=>ctrl.abort(),120000);
  try{const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ctrl.signal,headers:{'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:mc.id,max_tokens:maxTokens,system:SYSTEM_PROMPT,messages:[{role:'user',content:prompt}]})});clearTimeout(tout);
    if(res.status===401)throw new Error('API Key 유효하지 않음');
    if(res.status===429)throw new Error('요청 과다');if(res.status>=500)throw new Error('서버 오류');
    const d=await res.json();if(d.error)throw new Error(d.error.message);
    return{text:d.content[0].text,stopReason:d.stop_reason};
  }catch(e){clearTimeout(tout);if(e.name==='AbortError')throw new Error('타임아웃');throw e;}
}
async function callClaudeWithContinuation(prompt,pid){let full='',r=await callClaude(prompt),a=0;full=r.text;while(a<4&&r.stopReason==='max_tokens'){a++;showProgress(pid,`이어서 작성 중... (${a}/4)`,a,4);r=await callClaude(`아래 특허명세서 뒷부분을 이어서 작성. 앞부분 반복 금지. 동일 문체.\n\n[마지막]\n${full.slice(-2000)}`);full+='\n'+r.text;}clearProgress(pid);return full;}

// ═══════════ HELPERS ═══════════
function getLatestDescription(){return outputs.step_13_applied||outputs.step_09||outputs.step_08||'';}
function getFullDescription(){
  const body=getLatestDescription();
  if(!body)return '';
  return STEP8_PREFIX+'\n'+body+'\n'+STEP8_SUFFIX;
}
function getLastClaimNumber(t){const m=t.match(/【청구항\s*(\d+)】/g);if(!m)return 0;return Math.max(...m.map(x=>parseInt(x.match(/(\d+)/)[1])));}
function getLastFigureNumber(t){const m=t.match(/도\s*(\d+)/g);if(!m)return 0;return Math.max(...m.map(x=>parseInt(x.match(/(\d+)/)[1])));}
function extractBriefDescriptions(s07,s11){const d=[];[s07,s11].forEach(t=>{if(!t)return;const i=t.indexOf('---BRIEF_DESCRIPTIONS---');if(i>=0)t.slice(i+24).trim().split('\n').filter(l=>l.trim().startsWith('도 ')).forEach(l=>d.push(l.trim()));else t.split('\n').filter(l=>/^도\s*\d+은?\s/.test(l.trim())).forEach(l=>d.push(l.trim()));});return d.join('\n');}
function stripKoreanParticles(w){if(!w||w.length<2)return w;const ps=['에서는','으로써','에서','으로','에게','부터','까지','에는','하는','되는','된','하여','있는','없는','같은','통하여','위한','대한','의한','를','을','이','가','은','는','에','의','와','과','로','도','든','인','적','로서'];for(const p of ps){if(w.endsWith(p)&&w.length>p.length+1)return w.slice(0,-p.length);}return w;}

// ═══════════ FILE UPLOAD ═══════════
async function handleFileUpload(event) {
  const files = Array.from(event.target.files);if (!files.length) return;
  const listEl = document.getElementById('fileList');
  for (const file of files) {
    if (uploadedFiles.find(f => f.name === file.name)) {showToast(`"${file.name}" 이미 추가됨`, 'info');continue;}
    const item = document.createElement('div');item.className = 'file-upload-item';item.id = `file_${uploadedFiles.length}`;
    item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:6px;font-size:13px';
    item.innerHTML = `<span class="tossface">📄</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(file.name)}</span><span class="badge badge-neutral">${formatFileSize(file.size)}</span><span style="color:var(--color-primary)">추출 중...</span>`;
    listEl.appendChild(item);
    try {
      const text = await extractTextFromFile(file);
      if (text && text.trim()) {
        uploadedFiles.push({ name: file.name, text: text.trim(), size: file.size });
        const ta = document.getElementById('projectInput');const separator = ta.value.trim() ? '\n\n' : '';
        ta.value += `${separator}[첨부: ${file.name}]\n${text.trim()}`;
        item.innerHTML = `<span class="tossface">✅</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(file.name)}</span><span class="badge badge-success">${formatFileSize(file.size)} · ${text.trim().length.toLocaleString()}자</span><button class="btn btn-ghost btn-sm" onclick="removeUploadedFile(${uploadedFiles.length - 1},'${escapeHtml(file.name).replace(/'/g, "\\'")}')">✕</button>`;
        showToast(`"${file.name}" 추출 완료`);
      } else {
        item.innerHTML = `<span class="tossface">⚠️</span><span style="flex:1">${escapeHtml(file.name)}</span><span class="badge badge-warning">추출 불가</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>`;
      }
    } catch (e) {
      item.innerHTML = `<span class="tossface">❌</span><span style="flex:1">${escapeHtml(file.name)}</span><span class="badge badge-error">오류</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>`;
    }
  }
  event.target.value = '';
}
function removeUploadedFile(idx, name) {
  const f = uploadedFiles[idx];if (!f) return;
  const ta = document.getElementById('projectInput');const marker = `[첨부: ${f.name}]`;const mIdx = ta.value.indexOf(marker);
  if (mIdx >= 0) {const nextMarker = ta.value.indexOf('\n\n[첨부:', mIdx + marker.length);const endIdx = nextMarker >= 0 ? nextMarker : ta.value.length;ta.value = (ta.value.slice(0, mIdx) + ta.value.slice(endIdx)).trim();}
  uploadedFiles.splice(idx, 1);const el = document.getElementById(`file_${idx}`);if (el) el.remove();showToast(`"${name}" 제거됨`);
}
async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();const buf = await file.arrayBuffer();
  switch (ext) {
    case 'txt':case 'md':case 'csv':case 'json':case 'rtf':return new TextDecoder('utf-8').decode(buf);
    case 'pdf':return await extractPdfText(buf);
    case 'docx':case 'doc':return await extractDocxText(buf);
    case 'xlsx':case 'xls':return extractXlsxText(buf);
    case 'pptx':case 'ppt':return '[PPTX 텍스트 추출 제한적. 주요 내용을 직접 붙여넣어 주세요.]';
    case 'hwp':case 'hwpx':return '[HWP 파일은 한글에서 텍스트를 복사하여 직접 붙여넣어 주세요.]';
    default:try { return new TextDecoder('utf-8').decode(buf); } catch { return ''; }
  }
}
async function extractPdfText(buf) {if (!window.pdfjsLib) return '[PDF.js 미로드]';const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;let text = '';for (let i = 1; i <= pdf.numPages; i++) {const page = await pdf.getPage(i);const content = await page.getTextContent();text += content.items.map(item => item.str).join(' ') + '\n';}return text;}
async function extractDocxText(buf) {if (!window.mammoth) return '[mammoth.js 미로드]';const result = await mammoth.extractRawText({ arrayBuffer: buf });return result.value;}
function extractXlsxText(buf) {if (!window.XLSX) return '[XLSX.js 미로드]';const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });let text = '';wb.SheetNames.forEach(name => {text += `[시트: ${name}]\n`;text += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n\n';});return text;}
function formatFileSize(bytes) {if (bytes < 1024) return bytes + 'B';if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';return (bytes / (1024 * 1024)).toFixed(1) + 'MB';}

// ═══════════ PROMPTS (v4.7 — Claim System Redesign) ═══════════
// Style reference: project-level overrides global-level
function getStyleRef(){
  const ref=projectRefStyleText||globalRefStyleText;
  if(!ref)return '';
  return '\n\n[참고 문체 — 아래 문서의 문장 형태, 단락 구조, 작성 방식만 참고하라. 내용은 절대 참조하지 마라. 발명의 내용과 무관하다.]\n'+ref.slice(0,3000);
}
function getFullInvention(){
  const inv=document.getElementById('projectInput').value;
  return '\n\n★★★ [발명 내용 — 아래 내용을 단 하나도 누락 없이 모두 반영하라. 누락 시 특허 거절 사유가 된다.] ★★★\n'+inv;
}
function getRequiredFiguresInstruction(){
  if(!requiredFigures.length)return '';
  const list=requiredFigures.map(f=>`- 도 ${f.num}: ${f.description}`).join('\n');
  return `\n\n[필수 도면 — 아래 도면은 사용자가 이미 보유하고 있다. 이 번호들은 건너뛰고 나머지 도면만 새로 생성하라. 단, 도면의 간단한 설명에는 필수 도면도 모두 포함하라.]\n${list}`;
}
function buildAnchorThemeInstruction(mode,themes,count){
  if(mode==='fixed'&&themes.length){
    const labels=themes.map(k=>{const t=ANCHOR_THEMES.find(a=>a.key===k);return t?`${t.label}(${t.key})`:k;});
    return `지정된 앵커 테마: ${labels.join(', ')} 순서대로 배정하라.`;
  }
  return `발명 내용에서 키워드를 추출하고 아래 매핑에 따라 ${count}개 테마를 선택하라 (중복 최소화):
- OCR/문서추출/파싱/데이터 품질 → reliability_weighting 또는 cross_validation
- 임계값/스코어/등급/랭킹/추천 → threshold_adaptation 또는 explainability_trace
- 외부 API/연동/실패/오류/재시도 → fallback_retry
- 근거/설명/기여도/추적/로그 → explainability_trace
- 정규화/전처리/스케일/편향 → bias_normalization
- 피드백/재학습/가중치 재조정 → feedback_reweighting
- 권한/마스킹/암호화/감사 → privacy_audit`;
}
function getCategoryEnding(cat){return CATEGORY_ENDINGS[cat]||CATEGORY_ENDINGS.server;}

function buildPrompt(stepId){
  const inv=document.getElementById('projectInput').value,T=selectedTitle;
  const styleRef=getStyleRef();
  switch(stepId){
    case 'step_01':return `프로젝트를 분석하여 특허 발명의 명칭 후보를 5가지 생성하라.\n형태: \"~${selectedTitleType}\"\n각 후보에 국문+영문.\n\n출력형식:\n[1] 국문: (명칭) / 영문: (명칭)\n[2] 국문: (명칭) / 영문: (명칭)\n[3] 국문: (명칭) / 영문: (명칭)\n[4] 국문: (명칭) / 영문: (명칭)\n[5] 국문: (명칭) / 영문: (명칭)\n\n[프로젝트]\n${inv}`;
    case 'step_02':return `【기술분야】를 작성. \"본 발명은 ~에 관한 것이다.\" 한 문장만. 20단어. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}${styleRef}`;
    case 'step_03':return `【발명의 배경이 되는 기술】을 작성. 3문단(기존문제/최근동향/필요성), 각 150단어. 번호 없이. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}\n[프로젝트] ${inv}${styleRef}`;
    case 'step_04':return `【선행기술문헌】작성.\n규칙: 다른 항목 포함 금지. 헤더 금지. 관련 한국 특허 딱 1건만 기재.\n출력:\n【특허문헌】\n(특허문헌 1) 한국등록특허 제__________호\n\n발명의 명칭: ${T}\n[프로젝트] ${inv}`;
    case 'step_05':return `【해결하고자 하는 과제】작성. \"본 발명은 ~을 제공하는 것을 목적으로 한다.\" 50단어 이하. 마지막: \"본 발명의 기술적 과제는 이상에서 언급한 기술적 과제로 제한되지 않으며, 언급되지 않은 또 다른 기술적 과제들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다.\" 헤더 금지.\n\n발명의 명칭: ${T}\n[배경기술] ${outputs.step_03||''}${styleRef}`;

    // ═══ Step 6: 장치 청구항 (v4.7 완전 재작성) ═══
    case 'step_06':{
      const catLabel=deviceCategory==='auto'?'발명에 가장 적합한 카테고리를 선택하라':deviceCategory;
      const totalDep=deviceGeneralDep+deviceAnchorDep;
      const anchorEnd=deviceAnchorStart+deviceAnchorDep-1;
      const themeInst=buildAnchorThemeInstruction(anchorThemeMode,selectedAnchorThemes,deviceAnchorDep);
      return `장치 청구범위를 작성하라.

[청구항 구성]
- 독립항 카테고리: ${catLabel}
- 독립항: 1개 (청구항 1)
- 일반 종속항: ${deviceGeneralDep}개 (청구항 2~${deviceGeneralDep+1})
- 등록 앵커 종속항: ${deviceAnchorDep}개 (청구항 ${deviceAnchorStart}~${anchorEnd})
- 종결어: ${getCategoryEnding(deviceCategory==='auto'?'server':deviceCategory)}

[필수 작성 규칙]
(R1) 독립항 최소화 + 상위개념화
- 발명 성립에 필요한 최소 필수 구성요소만 포함
- UI/특정 솔루션명/구체 수치/구체 수식은 독립항에서 배제
- 구성요소 간 입력→처리→출력 흐름의 유기적 결합 반드시 포함 (단순 나열 금지)

(R2) 용어 일관성: 동일 개체는 동일 명칭 반복. \"상기\"는 혼동 방지에 필요한 범위에서만.

(R3) Killer Words 금지: \"반드시/무조건/오직/필수적으로/만\" 절대 금지. \"~하도록 구성되는\", \"~하는\", \"~을 포함하는\" 사용.

(R4) 일반 종속항: 상위항 인용하여 구체화·확장. 수치/수식 과도하게 고정하지 않고, 후속 Step 8/9/13에서 상세화 가능하도록 문장 구성.

(R5) 등록 앵커 종속항 (청구항 ${deviceAnchorStart}부터):
- 신규성/진보성 방어용 \"창의적·구체적 기술수단\" 포함
- 수치·수식·기호 과다 기재 금지 (후속 단계에서 정량화)
- 아래 A~C 중 최소 2개 포함:
  A) 다단계 처리(2단계 이상): 전처리→산출→보정 등
  B) 조정 가능한 기준값/가중치/신뢰도/품질지표 사용
  C) 검증/보정/피드백/폴백/재시도 중 하나 이상의 루프 또는 조건부 분기
- 발명 내용에 근거가 있는 요소/처리/효과만으로 구성

[앵커 테마 배정 — 내부 지침, 출력 금지]
${themeInst}

[출력 형식]
【청구항 1】형식. 청구항만 출력. 테마/키워드/점검 내용 출력 금지.
\"청구항 N에 있어서,\" 시작. SW명 금지. 제한성 표현 금지.

★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}${getFullInvention()}${styleRef}`;}

    // ═══ Step 7: 도면 설계 (필수 도면 반영) ═══
    case 'step_07':{
      const f=document.getElementById('optDeviceFigures').value;
      const reqInst=getRequiredFiguresInstruction();
      const skipNums=requiredFigures.map(rf=>rf.num);
      const genCount=parseInt(f)-(requiredFigures.length);
      return `청구범위 도면을 설계하라. 총 도면 수: ${f}개.
${reqInst?`\n사용자가 보유한 필수 도면: ${requiredFigures.length}개 (${skipNums.map(n=>'도 '+n).join(', ')}).\n새로 생성할 도면: ${genCount>0?genCount:0}개.\n필수 도면 번호는 건너뛰고 나머지 번호로 생성하라.`:''}

[파트1: 도면 설계]
각 도면: 제목/유형, 구성요소+참조번호, 연결관계. 참조번호: 서버100번대, 단말200번대, 외부300번대.

[파트2: 도면의 간단한 설명]
---BRIEF_DESCRIPTIONS---
${requiredFigures.map(rf=>`도 ${rf.num}은 ${rf.description}을 나타내는 도면이다.`).join('\n')}
도 N은 (명칭)(참조번호)의 (내용)을 나타내는 (블록도/구성도)이다.

파트2에서는 필수 도면 포함 모든 도면의 간단한 설명을 기재하라.

★★★ 발명 내용을 단 하나도 누락 없이 모두 도면에 반영하라. ★★★

${T}\n[청구범위] ${outputs.step_06||''}${getFullInvention()}`;}

    case 'step_08':{
      const dlCfg={
        compact:{charPerFig:'약 1,000자',total:'약 3,000~4,000자',extra:'핵심 구성요소 중심으로 간결하게 기술하라. 변형 실시예는 1개만.'},
        standard:{charPerFig:'약 1,500자',total:'약 5,000~7,000자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 설명하라. 주요 구성요소에 변형 실시예 포함.'},
        detailed:{charPerFig:'약 2,000자 이상',total:'8,000~10,000자',extra:'각 도면마다 구성요소의 기능, 동작 원리, 데이터 흐름, 상호 연동 관계를 상세히 설명하라. 변형 실시예를 통해 다양한 구현 방식을 기술하라. 절대 축약하지 마라.'},
        custom:{charPerFig:'약 '+customDetailChars+'자',total:'약 '+(customDetailChars*parseInt(document.getElementById('optDeviceFigures')?.value||4))+'자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 설명하라. 변형 실시예를 포함하라.'}
      }[detailLevel];
      return `아래 발명에 대한 【발명을 실시하기 위한 구체적인 내용】의 본문만 작성하라.

규칙:
- 이 항목만 작성. 기술분야, 배경기술, 과제, 효과 등 다른 항목 포함 금지.
- 서버(100)를 주어로 사용. \"구성요소(참조번호)\" 형태.
- 도면별 \"도 N을 참조하면,\" 형태로 시작.
- 특허문체(~한다). 글머리 기호/마크다운 절대 금지.
- 청구항의 모든 구성요소를 빠짐없이 포함하여 설명하라. 절대 생략 금지.
- 등록 앵커 종속항(창의적·구체적 기술수단 포함)의 다단계 처리, 기준값/가중치 동작 원리, 검증/보정 루프를 구체적으로 설명하라.
- 각 핵심 구성요소에 대해 변형 실시예를 포함하라.
- 제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.

★ 분량 규칙:
- 도면 1개당 ${dlCfg.charPerFig}(공백 포함)
- 총 분량 ${dlCfg.total}(공백 포함). 본문 전후 정형문 글자수 제외.
- ${dlCfg.extra}

★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}\n[청구범위] ${outputs.step_06||''}\n[도면] ${outputs.step_07||''}${getFullInvention()}${styleRef}`;}

    case 'step_09':return `상세설명의 핵심 알고리즘에 수학식 5개 내외.\n규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.\n출력:\n---MATH_BLOCK_1---\nANCHOR: (삽입위치 문장 20자 이상)\nFORMULA:\n【수학식 1】\n(수식)\n여기서, (파라미터)\n예시 대입: (수치)\n\n${T}\n[현재 상세설명] ${outputs.step_08||''}`;

    // ═══ Step 10: 방법 청구항 (v4.7 — 장치 핵심 선별·병합) ═══
    case 'step_10':{
      const s=getLastClaimNumber(outputs.step_06||'')+1;
      const totalDep=methodGeneralDep+methodAnchorDep;
      const mAnchorStart=s+1+methodGeneralDep;
      const catLabel=methodCategory==='auto'?'발명에 가장 적합한 카테고리를 선택하라':methodCategory;
      const themeInst=buildAnchorThemeInstruction(methodAnchorThemeMode,selectedMethodAnchorThemes,methodAnchorDep);
      return `방법 청구항을 작성하라.

[핵심 규칙]
- 장치 청구항(제1 독립항 그룹)에서 가장 중요한 구성을 선별하여 방법 청구항으로 작성하라.
- 장치 청구항의 여러 종속항을 하나의 방법 단계로 병합할 수 있다.
- 방법 청구항의 개수는 장치 청구항과 다를 수 있다.

[청구항 구성]
- 독립항 카테고리: ${catLabel}
- 독립항: 1개 (【청구항 ${s}】)
- 일반 종속항: ${methodGeneralDep}개
- 등록 앵커 종속항: ${methodAnchorDep}개 (청구항 ${mAnchorStart}부터)
- 종결어: ${getCategoryEnding(methodCategory==='auto'?'method':methodCategory)}
- \"~하는 단계\"를 포함하는 방법 형식

[필수 작성 규칙] R1~R5 장치 청구항과 동일하게 적용.
앵커 종속항은 (R5) 규칙 동일 적용: A~C 중 최소 2개 포함.

[앵커 테마 배정 — 내부 지침, 출력 금지]
${themeInst}

[출력 형식] 【청구항 ${s}】부터. 청구항만 출력. 제한성 표현 금지.

★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}\n[장치 청구항] ${outputs.step_06||''}\n[상세설명] ${(outputs.step_08||'').slice(0,3000)}${getFullInvention()}${styleRef}`;}

    // ═══ Step 11: 방법 도면 (장치 1:1 대응 제거) ═══
    case 'step_11':{const f=document.getElementById('optMethodFigures').value,lf=getLastFigureNumber(outputs.step_07||'');return `방법 흐름도 ${f}개를 설계하라. 도 ${lf+1}부터.

규칙:
- 방법 도면은 장치 도면과 1:1 대응될 필요가 없다.
- 사용자가 지정한 ${f}개의 도면에 맞추어 방법 청구항의 핵심 동작 흐름을 설계하라.
- 장치 도면의 구성요소를 참조하되, 방법의 단계적 흐름에 적합하게 재구성하라.
- S100,S200 단계번호.

[파트1: 도면 설계]
단계: 번호, 내용, 연결.

[파트2: 도면의 간단한 설명]
---BRIEF_DESCRIPTIONS---
도 ${lf+1}은 (방법 이름)의 (설명)을 나타내는 순서도이다.

★★★ 발명 내용을 단 하나도 누락 없이 모두 흐름도에 반영하라. ★★★

${T}\n[방법 청구항] ${outputs.step_10||''}${getFullInvention()}`;}

    case 'step_12':return `방법 상세설명. 단계순서에 따라 장치 동작을 참조하여 설명하라. 특허문체. 글머리 금지. 시작: \"이하에서는 앞서 설명한 서버의 구성 및 동작을 참조하여 방법을 설명한다.\" 생략 금지. 제한성 표현 금지.\n\n★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★\n\n${T}\n[방법 청구항] ${outputs.step_10||''}\n[방법 도면] ${outputs.step_11||''}\n[장치 상세설명] ${(outputs.step_08||'').slice(0,3000)}${getFullInvention()}${styleRef}`;
    case 'step_13':return `청구범위와 상세설명 검토:\n1.청구항뒷받침 2.기술적비약 3.수학식정합성 4.반복실시가능성 5.보완/수정 구체적 문장\n${T}\n[청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}\n[상세설명] ${(getLatestDescription()||'').slice(0,6000)}`;
    case 'step_14':return `대안 청구항. 핵심유지 표현달리. 【청구항 N】.\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}`;
    case 'step_15':return `기재불비: (a)상기선행기재 (b)용어통일 (c)대응 (d)누락 (e)용어뒷받침. 수정안.\n${T}\n[전체] ${outputs.step_06||''}\n${outputs.step_10||''}\n${outputs.step_14||''}`;
    case 'step_16':return `발명의 효과. \"본 발명에 따르면,\"시작. 50단어 이내. 마지막: \"본 발명의 효과는 이상에서 언급한 효과로 제한되지 않으며, 언급되지 않은 또 다른 효과들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다.\"\n${T}\n[과제] ${outputs.step_05||''}\n[상세설명] ${(outputs.step_08||'').slice(0,2000)}${styleRef}`;
    case 'step_17':return `과제의 해결 수단. \"본 발명의 일 실시예에 따른\"시작. 마지막: \"본 발명의 기타 구체적인 사항들은 상세한 설명 및 도면들에 포함되어 있다.\"\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}${styleRef}`;
    case 'step_18':return `【부호의 설명】작성. \"구성요소 : 참조번호\". 참조번호 오름차순.\n${T}\n[도면] ${outputs.step_07||''}\n[방법도면] ${outputs.step_11||''}`;
    case 'step_19':return `요약서. 청구항1 기준 150단어. \"본 발명은\"시작.\n출력:\n【요약】\n(본문)\n\n【대표도】\n도 1\n\n위 형식만.\n${T}\n[청구항1] ${(outputs.step_06||'').slice(0,1500)}${styleRef}`;
    default:return '';
  }
}

// ═══════════ STEP EXECUTION ═══════════
function checkDependency(s){const inv=document.getElementById('projectInput').value.trim();const d={step_01:()=>inv?null:'발명 내용을 먼저 입력',step_06:()=>selectedTitle?null:'명칭을 먼저 확정',step_07:()=>outputs.step_06?null:'장치 청구항 먼저',step_08:()=>(outputs.step_06&&outputs.step_07)?null:'도면 설계 먼저',step_09:()=>outputs.step_08?null:'상세설명 먼저',step_10:()=>outputs.step_06?null:'장치 청구항 먼저',step_11:()=>outputs.step_10?null:'방법 청구항 먼저',step_12:()=>(outputs.step_10&&outputs.step_11)?null:'방법 도면 먼저',step_13:()=>(outputs.step_06&&outputs.step_08)?null:'청구항+상세설명 먼저',step_14:()=>outputs.step_06?null:'장치 청구항 먼저',step_15:()=>outputs.step_06?null:'장치 청구항 먼저'};return d[s]?d[s]():null;}
async function runStep(sid){if(loadingState[sid])return;const dep=checkDependency(sid);if(dep){showToast(dep,'error');return;}const bm={step_01:'btnStep01',step_06:'btnStep06',step_10:'btnStep10',step_13:'btnStep13'},bid=bm[sid];loadingState[sid]=true;if(bid)setButtonLoading(bid,true);
  try{
    const r=await callClaude(buildPrompt(sid));outputs[sid]=r.text;renderOutput(sid,r.text);
    if(sid==='step_06'){
      showProgress('progressStep06','기재불비 자동 검증 중...',1,3);
      const issues=validateClaims(r.text);
      if(issues.length>0){
        showProgress('progressStep06','기재불비 수정 중...',2,3);
        const issueText=issues.map(i=>i.message).join('\n');
        const fixPrompt=`아래 청구범위에서 기재불비가 발견되었다. 모든 지적사항을 수정하여 완전한 청구범위 전체를 다시 출력하라.\n\n수정 규칙:\n- 【청구항 N】형식 유지\n- \"상기\" 선행기재 누락: 참조하는 독립항에 해당 구성요소를 추가하거나, 종속항의 표현을 수정\n- 제한적 표현: 삭제 또는 비제한적 표현으로 교체\n- 청구항 참조 오류: 올바른 청구항 번호로 수정\n\n[지적사항]\n${issueText}\n\n[원본 청구범위]\n${r.text}`;
        const fixR=await callClaude(fixPrompt);outputs[sid]=fixR.text;renderOutput(sid,fixR.text);
        showProgress('progressStep06','수정 완료',3,3);setTimeout(()=>clearProgress('progressStep06'),2000);
        showToast('장치 청구항 생성 + 기재불비 자동 수정 완료');
      }else{clearProgress('progressStep06');showToast('장치 청구항 완료 (기재불비 없음)');}
    }else{
      if(sid==='step_13')document.getElementById('btnApplyReview').style.display='block';
      showToast(`${STEP_NAMES[sid]} 완료`);
    }
  }catch(e){showToast(e.message,'error');}finally{loadingState[sid]=false;if(bid)setButtonLoading(bid,false);}}
async function runLongStep(sid){if(loadingState[sid])return;const dep=checkDependency(sid);if(dep){showToast(dep,'error');return;}const bid=sid==='step_08'?'btnStep08':'btnStep12',pid=sid==='step_08'?'progressStep08':'progressStep12';loadingState[sid]=true;setButtonLoading(bid,true);showProgress(pid,`${STEP_NAMES[sid]} 생성 중...`,0,1);try{const t=await callClaudeWithContinuation(buildPrompt(sid),pid);outputs[sid]=t;renderOutput(sid,t);showToast(`${STEP_NAMES[sid]} 완료`);}catch(e){showToast(e.message,'error');}finally{loadingState[sid]=false;setButtonLoading(bid,false);clearProgress(pid);}}
async function runMathInsertion(){if(loadingState.step_09)return;const dep=checkDependency('step_09');if(dep){showToast(dep,'error');return;}loadingState.step_09=true;setButtonLoading('btnStep09',true);try{const r=await callClaude(buildPrompt('step_09'));outputs.step_09=insertMathBlocks(outputs.step_08,r.text);renderOutput('step_09',outputs.step_09);showToast('수학식 삽입 완료');}catch(e){showToast(e.message,'error');}finally{loadingState.step_09=false;setButtonLoading('btnStep09',false);}}

async function applyReview(){
  if(loadingState.applyReview)return;if(!outputs.step_13){showToast('검토 결과 없음','error');return;}
  const cur=getLatestDescription();if(!cur){showToast('상세설명 없음','error');return;}
  beforeReviewText=cur;loadingState.applyReview=true;setButtonLoading('btnApplyReview',true);
  try{
    showProgress('progressApplyReview','[1/3] 검토 반영 보완 중...',1,3);
    const dlCfg={compact:{c:'약 1,000자',t:'약 3,000~4,000자'},standard:{c:'약 1,500자',t:'약 5,000~7,000자'},detailed:{c:'약 2,000자 이상',t:'8,000~10,000자'},custom:{c:'약 '+customDetailChars+'자',t:'약 '+(customDetailChars*parseInt(document.getElementById('optDeviceFigures')?.value||4))+'자'}}[detailLevel];
    const improvedDesc=await callClaudeWithContinuation(`[검토 결과]를 반영하여 【발명을 실시하기 위한 구체적인 내용】의 본문만 완전히 새로 작성하라.\n\n규칙:\n- 기존 상세설명을 기반으로 검토 지적사항을 모두 보완하라.\n- 이 항목만 작성. 다른 항목 포함 금지.\n- 서버(100)를 주어. \"구성요소(참조번호)\" 형태.\n- 도면별 \"도 N을 참조하면,\" 형태.\n- 특허문체(~한다). 글머리 금지. 생략 금지.\n- 도면 1개당 ${dlCfg.c}, 총 ${dlCfg.t}. (정형문 제외)\n- 등록 앵커 종속항의 다단계 처리, 기준값/가중치 동작, 검증/보정 루프를 구체적으로 설명하라.\n- 제한성 표현 금지.\n\n★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★\n\n[발명의 명칭] ${selectedTitle}\n[검토 결과] ${outputs.step_13}\n[청구범위] ${outputs.step_06||''}\n[도면] ${outputs.step_07||''}\n[현재 상세설명] ${cur}${getFullInvention()}${getStyleRef()}`,'progressApplyReview');
    outputs.step_08=improvedDesc;
    showProgress('progressApplyReview','[2/3] 수학식 삽입 중...',2,3);
    const mathR=await callClaude(`상세설명의 핵심 알고리즘에 수학식 5개 내외.\n규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.\n출력:\n---MATH_BLOCK_1---\nANCHOR: (삽입위치 문장 20자 이상)\nFORMULA:\n【수학식 1】\n(수식)\n여기서, (파라미터)\n예시 대입: (수치)\n\n${selectedTitle}\n[현재 상세설명] ${improvedDesc}`);
    const finalDesc=insertMathBlocks(improvedDesc,mathR.text);
    outputs.step_09=finalDesc;outputs.step_13_applied=finalDesc;
    showProgress('progressApplyReview','[3/3] 완료',3,3);
    renderOutput('step_08',improvedDesc);renderOutput('step_09',finalDesc);
    const resultArea=document.getElementById('reviewApplyResult');
    if(resultArea){resultArea.style.display='block';showReviewDiff('after');}
    setTimeout(()=>clearProgress('progressApplyReview'),2000);
    showToast('검토 반영 완료');
  }catch(e){showToast(e.message,'error');}finally{loadingState.applyReview=false;setButtonLoading('btnApplyReview',false);}
}
function showReviewDiff(mode){
  const area=document.getElementById('reviewDiffArea'),bb=document.getElementById('btnDiffBefore'),ba=document.getElementById('btnDiffAfter');if(!area)return;
  if(mode==='before'){area.value=beforeReviewText||'(없음)';if(bb)bb.className='btn btn-primary btn-sm';if(ba)ba.className='btn btn-outline btn-sm';}
  else{area.value=outputs.step_13_applied||'(없음)';if(bb)bb.className='btn btn-outline btn-sm';if(ba)ba.className='btn btn-primary btn-sm';}
}
async function runDiagramStep(sid){if(loadingState[sid])return;const dep=checkDependency(sid);if(dep){showToast(dep,'error');return;}const bid=sid==='step_07'?'btnStep07':'btnStep11';loadingState[sid]=true;setButtonLoading(bid,true);try{const r=await callClaude(buildPrompt(sid));outputs[sid]=r.text;renderOutput(sid,r.text);const mr=await callClaude(buildMermaidPrompt(sid),4096);outputs[sid+'_mermaid']=mr.text;renderDiagrams(sid,mr.text);if(sid==='step_07')document.getElementById('btnPptx07').style.display='block';showToast(`${STEP_NAMES[sid]} 완료`);}catch(e){showToast(e.message,'error');}finally{loadingState[sid]=false;setButtonLoading(bid,false);}}
async function runBatch25(){if(loadingState.batch25)return;if(!selectedTitle){showToast('명칭 먼저 확정','error');return;}loadingState.batch25=true;setButtonLoading('btnBatch25',true);document.getElementById('resultsBatch25').innerHTML='';const steps=['step_02','step_03','step_04','step_05'];try{for(let i=0;i<steps.length;i++){showProgress('progressBatch',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;renderBatchResult('resultsBatch25',steps[i],r.text);}clearProgress('progressBatch');showToast('기본 항목 완료');}catch(e){clearProgress('progressBatch');showToast(e.message,'error');}finally{loadingState.batch25=false;setButtonLoading('btnBatch25',false);}}
async function runBatchFinish(){if(loadingState.batchFinish)return;if(!outputs.step_06||!outputs.step_08){showToast('청구항+상세설명 먼저','error');return;}loadingState.batchFinish=true;setButtonLoading('btnBatchFinish',true);document.getElementById('resultsBatchFinish').innerHTML='';const steps=['step_16','step_17','step_18','step_19'];try{for(let i=0;i<steps.length;i++){showProgress('progressBatchFinish',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;renderBatchResult('resultsBatchFinish',steps[i],r.text);}clearProgress('progressBatchFinish');showToast('마무리 완료');}catch(e){clearProgress('progressBatchFinish');showToast(e.message,'error');}finally{loadingState.batchFinish=false;setButtonLoading('btnBatchFinish',false);}}

// ═══════════ PROVISIONAL APPLICATION (가출원) ═══════════
function openProvisionalModal(){document.getElementById('provisionalInput').value='';document.getElementById('provisionalModal').style.display='flex';}
function closeProvisionalModal(){document.getElementById('provisionalModal').style.display='none';}
async function runProvisionalApplication(){
  const inv=document.getElementById('provisionalInput').value.trim();
  if(!inv){showToast('발명 내용을 입력해 주세요','error');return;}
  if(!API_KEY){showApiKeyModal();return;}
  setButtonLoading('btnProvisionalGen',true);
  try{
    showProgress('progressProvisional','가출원 명세서 생성 중... (1/2)',1,2);
    // Phase 1: 명칭 + 청구항 + 기술분야 + 과제 + 효과
    const r1=await callClaudeSonnet(`가출원 명세서를 작성하라. 전체 문서가 4000단어를 넘지 않도록 간결하게 작성하라.

[구성]
1. 발명의 명칭: 1개 (\"~서버\" 또는 \"~방법\" 또는 \"~시스템\" 형태)
2. 기술분야: 1문장
3. 해결하고자 하는 과제: 2~3문장
4. 과제의 해결 수단: 3~5문장
5. 독립항 1개: 핵심 구성요소만 포함한 장치/서버 청구항
6. 도면 1개: 시스템 블록도 (구성요소+참조번호+연결관계)
7. 상세설명: 도면 참조하여 각 구성요소 기능 설명 (2000자 이내)
8. 발명의 효과: 2~3문장
9. 요약서: 100단어

[규칙]
- 표준문체(~한다), 글머리/마크다운 금지
- 구성요소(참조번호) 형태
- SW명 대신 알고리즘
- 제한성 표현 금지
- 총 4000단어 이내로 간결하게

[출력 형식]
===명칭===
(명칭)
===기술분야===
(내용)
===과제===
(내용)
===해결수단===
(내용)
===청구항===
【청구항 1】
(내용)
===도면설계===
(도면 설명)
===상세설명===
(내용)
===효과===
(내용)
===요약===
(내용)

[발명 내용]
${inv}`,8192);

    showProgress('progressProvisional','Word 생성 중... (2/2)',2,2);
    const text=r1.text;
    // Parse sections
    const getSection=(key)=>{const re=new RegExp('==='+key+'===\\s*\\n([\\s\\S]*?)(?====|$)');const m=text.match(re);return m?m[1].trim():'';};
    const title=getSection('명칭');
    const techField=getSection('기술분야');
    const problem=getSection('과제');
    const solution=getSection('해결수단');
    const claim=getSection('청구항');
    const diagram=getSection('도면설계');
    const desc=getSection('상세설명');
    const effect=getSection('효과');
    const abstract=getSection('요약');

    // Generate Word
    const secs=[
      {h:'발명의 설명'},{h:'발명의 명칭',b:title},{h:'기술분야',b:techField},
      {h:'발명의 내용'},{h:'해결하고자 하는 과제',b:problem},
      {h:'과제의 해결 수단',b:solution},{h:'발명의 효과',b:effect},
      {h:'도면의 간단한 설명',b:diagram?`도 1은 ${title}의 구성을 나타내는 블록도이다.`:''},
      {h:'발명을 실시하기 위한 구체적인 내용',b:desc},
      {h:'청구범위',b:claim},
      {h:'요약서',b:abstract?`【요약】\n${abstract}\n\n【대표도】\n도 1`:''},
    ];
    const html=secs.map(s=>{
      const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${escapeHtml(s.h)}】</h2>`;
      if(!s.b)return hd;
      return hd+s.b.split('\n').filter(l=>l.trim()).map(l=>`<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify">${escapeHtml(l.trim())}</p>`).join('');
    }).join('');
    const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}</body></html>`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));
    a.download=`가출원_${title||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();

    clearProgress('progressProvisional');
    closeProvisionalModal();
    showToast(`가출원 명세서 다운로드 완료: ${title}`);
  }catch(e){clearProgress('progressProvisional');showToast(e.message,'error');}
  finally{setButtonLoading('btnProvisionalGen',false);}
}

// ═══════════ PARSERS ═══════════
function parseTitleCandidates(t){const c=[];let m;const re=/\[(\d+)\]\s*국문:\s*(.+?)\s*[/／]\s*영문:\s*(.+)/g;while((m=re.exec(t))!==null)c.push({num:m[1],korean:m[2].trim(),english:m[3].trim()});return c;}
function parseClaimStats(t){const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,c={};let m;while((m=cp.exec(t))!==null)c[parseInt(m[1])]=m[2].trim();const tot=Object.keys(c).length;let dep=0;Object.values(c).forEach(x=>{if(/있어서|따른/.test(x))dep++;});return{total:tot,independent:tot-dep,dependent:dep,claims:c};}
function extractMermaidBlocks(t){return(t.match(/```mermaid\n([\s\S]*?)```/g)||[]).map(b=>b.replace(/```mermaid\n/,'').replace(/```/,'').trim());}
function parseMathBlocks(t){const b=[];let m;const re=/---MATH_BLOCK_\d+---\s*\nANCHOR:\s*(.+)\s*\nFORMULA:\s*\n([\s\S]*?)(?=---MATH_BLOCK_|\s*$)/g;while((m=re.exec(t))!==null)b.push({anchor:m[1].trim(),formula:m[2].trim()});return b;}
function insertMathBlocks(s08,s09){let r=s08;const b=parseMathBlocks(s09);for(const x of b.reverse()){const i=r.indexOf(x.anchor);if(i>=0){const s=i+x.anchor.length,p=r.indexOf('.',s);const ip=(p>=0&&p-s<100)?p+1:s;r=r.slice(0,ip)+'\n\n'+x.formula+'\n\n'+r.slice(ip);}}return r;}

function buildMermaidPrompt(sid){
  const src=outputs[sid]||'';
  return `아래 도면 설계를 Mermaid flowchart 코드로 변환하라. 각 도면당 \`\`\`mermaid 블록 1개.
규칙: graph TD, 한글 라벨, 노드ID 영문. 서브그래프 사용 가능. style/linkStyle 금지.
\n\n${src}`;
}

// ═══════════ UNIFIED DIAGRAM ENGINE ═══════════
function parseMermaidGraph(code){
  const nodes={},edges=[];
  code.split('\n').forEach(line=>{
    const l=line.trim();
    if(!l||l.startsWith('graph')||l.startsWith('flowchart')||l==='end'||l.startsWith('style')||l.startsWith('linkStyle')||l.startsWith('classDef')||l.startsWith('subgraph'))return;
    const em=l.match(/^(\w+)(?:\[["']?(.+?)["']?\])?\s*(-->|---)\s*(?:\|["']?(.+?)["']?\|\s*)?(\w+)(?:\[["']?(.+?)["']?\])?/);
    if(em){const[,fid,fl,,el,tid,tl]=em;if(fl&&!nodes[fid])nodes[fid]={id:fid,label:fl};if(tl&&!nodes[tid])nodes[tid]={id:tid,label:tl};if(!nodes[fid])nodes[fid]={id:fid,label:fid};if(!nodes[tid])nodes[tid]={id:tid,label:tid};edges.push({from:fid,to:tid,label:el||''});return;}
    const nm=l.match(/^(\w+)\[["']?(.+?)["']?\]/);if(nm&&!nodes[nm[1]])nodes[nm[1]]={id:nm[1],label:nm[2]};
  });
  return{nodes:Object.values(nodes),edges};
}
function layoutGraph(nodes,edges){
  const adj={};edges.forEach(e=>{if(!adj[e.from])adj[e.from]=[];adj[e.from].push(e.to);});
  const targets=new Set(edges.map(e=>e.to));const roots=nodes.filter(n=>!targets.has(n.id));
  if(!roots.length&&nodes.length)roots.push(nodes[0]);
  const levels={},visited=new Set();const queue=roots.map(r=>({id:r.id,level:0}));
  while(queue.length){const{id,level}=queue.shift();if(visited.has(id))continue;visited.add(id);levels[id]=level;(adj[id]||[]).forEach(tid=>{if(!visited.has(tid))queue.push({id:tid,level:level+1});});}
  nodes.forEach(n=>{if(!(n.id in levels))levels[n.id]=0;});
  const groups={};nodes.forEach(n=>{const lv=levels[n.id];if(!groups[lv])groups[lv]=[];groups[lv].push(n);});
  const NW=2.5,NH=0.65,HG=0.8,VG=1.2,SW=13.33,startY=0.7;const positions={};
  Object.entries(groups).forEach(([lv,grp])=>{const totalW=grp.length*NW+(grp.length-1)*HG;const sx=(SW-totalW)/2;grp.forEach((node,i)=>{const x=sx+i*(NW+HG),y=startY+parseInt(lv)*(NH+VG);positions[node.id]={x,y,w:NW,h:NH,cx:x+NW/2,cy:y+NH/2};});});
  return positions;
}
function computeEdgeRoutes(edges,positions){
  return edges.map((e,ei)=>{const fp=positions[e.from],tp=positions[e.to];if(!fp||!tp)return null;const sx=fp.cx,sy=fp.y+fp.h,tx=tp.cx,ty=tp.y;const segments=[];let labelPos=null;
    if(Math.abs(sx-tx)<0.05){segments.push({type:'line',x1:sx,y1:sy,x2:tx,y2:ty,arrow:true});if(e.label)labelPos={x:sx+0.15,y:(sy+ty)/2-0.12};}
    else{const baseM=(sy+ty)/2,offset=(ei%3-1)*0.12,midY=baseM+offset;segments.push({type:'line',x1:sx,y1:sy,x2:sx,y2:midY,arrow:false});segments.push({type:'line',x1:sx,y1:midY,x2:tx,y2:midY,arrow:false});segments.push({type:'line',x1:tx,y1:midY,x2:tx,y2:ty,arrow:true});if(e.label)labelPos={x:Math.max(sx,tx)+0.15,y:midY-0.12};}
    return{segments,label:e.label,labelPos};
  }).filter(Boolean);
}
function renderDiagramSvg(containerId,nodes,edges,positions,figNum){
  let maxX=0,maxY=0;Object.values(positions).forEach(p=>{maxX=Math.max(maxX,p.x+p.w);maxY=Math.max(maxY,p.y+p.h);});
  const PX=72,PAD=0.3,svgW=(maxX+PAD*2)*PX,svgH=(maxY+PAD*2)*PX,ox=PAD*PX,mkId=`ah_${containerId}`;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${Math.min(svgW,960)}px;background:white;border-radius:8px">`;
  svg+=`<defs><marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#000"/></marker></defs>`;
  const routes=computeEdgeRoutes(edges,positions);
  routes.forEach(route=>{route.segments.forEach(seg=>{const x1=seg.x1*PX+ox,y1=seg.y1*PX+ox,x2=seg.x2*PX+ox,y2=seg.y2*PX+ox;const me=seg.arrow?` marker-end="url(#${mkId})"`:' ';svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="1.5"${me}/>`;});if(route.label&&route.labelPos){const lx=route.labelPos.x*PX+ox,ly=route.labelPos.y*PX+ox;svg+=`<text x="${lx}" y="${ly+10}" font-size="10" font-family="맑은 고딕,sans-serif" fill="#333">${escapeHtml(route.label)}</text>`;}});
  nodes.forEach(n=>{const p=positions[n.id];if(!p)return;const xP=p.x*PX+ox,yP=p.y*PX+ox,wP=p.w*PX,hP=p.h*PX;svg+=`<rect x="${xP}" y="${yP}" width="${wP}" height="${hP}" fill="#fff" stroke="#000" stroke-width="1.5" rx="3"/>`;const label=n.label.length>20?n.label.slice(0,18)+'…':n.label;svg+=`<text x="${xP+wP/2}" y="${yP+hP/2+4}" text-anchor="middle" font-size="11" font-family="맑은 고딕,sans-serif" fill="#000">${escapeHtml(label)}</text>`;});
  svg+='</svg>';const c=document.getElementById(containerId);if(c)c.innerHTML=svg;
}
function renderDiagrams(sid,mt){
  const cid=sid==='step_07'?'diagramsStep07':'diagramsStep11';const el=document.getElementById(cid);const blocks=extractMermaidBlocks(mt);
  if(!blocks.length){el.innerHTML=`<div class="diagram-container"><pre style="font-size:12px;white-space:pre-wrap">${escapeHtml(mt)}</pre></div>`;return;}
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;diagramData[sid]=[];
  el.innerHTML=blocks.map((code,i)=>{const figNum=figOffset+i+1;return `<div class="diagram-container"><div class="diagram-label">도 ${figNum}</div><div id="diagram_${sid}_${i}" style="background:#fff;border:1px solid #eee;border-radius:8px;padding:12px;overflow-x:auto"></div><details style="margin-top:8px"><summary style="font-size:11px;color:var(--color-text-tertiary);cursor:pointer">Mermaid 코드 보기</summary><pre style="font-size:11px;margin-top:4px;padding:8px;background:var(--color-bg-tertiary);border-radius:8px;overflow-x:auto">${escapeHtml(code)}</pre></details></div>`;}).join('');
  blocks.forEach((code,i)=>{const{nodes,edges}=parseMermaidGraph(code);const positions=layoutGraph(nodes,edges);diagramData[sid].push({nodes,edges,positions});renderDiagramSvg(`diagram_${sid}_${i}`,nodes,edges,positions,figOffset+i+1);});
}
function downloadPptx(sid){
  const data=diagramData[sid];
  if(!data||!data.length){const mt=outputs[sid+'_mermaid'];if(!mt){showToast('도면 없음','error');return;}const blocks=extractMermaidBlocks(mt);if(!blocks.length){showToast('Mermaid 코드 없음','error');return;}diagramData[sid]=blocks.map(code=>{const{nodes,edges}=parseMermaidGraph(code);return{nodes,edges,positions:layoutGraph(nodes,edges)};});return downloadPptx(sid);}
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  data.forEach(({nodes,edges,positions},idx)=>{const slide=pptx.addSlide({bkgd:'FFFFFF'});const figNum=figOffset+idx+1;slide.addText(`도 ${figNum}`,{x:0.3,y:0.05,w:3,h:0.4,fontSize:16,bold:true,fontFace:'맑은 고딕',color:'000000'});if(!nodes.length)return;
    const routes=computeEdgeRoutes(edges,positions);
    routes.forEach(route=>{route.segments.forEach(seg=>{const lineOpts={color:'000000',width:1.5};if(seg.arrow)lineOpts.endArrowType='triangle';if(Math.abs(seg.x2-seg.x1)<0.01)slide.addShape(pptx.shapes.LINE,{x:seg.x1,y:Math.min(seg.y1,seg.y2),w:0,h:Math.abs(seg.y2-seg.y1),line:lineOpts});else slide.addShape(pptx.shapes.LINE,{x:Math.min(seg.x1,seg.x2),y:seg.y1,w:Math.abs(seg.x2-seg.x1),h:0,line:lineOpts});});if(route.label&&route.labelPos)slide.addText(route.label,{x:route.labelPos.x,y:route.labelPos.y,w:1.2,h:0.24,fontSize:7,fontFace:'맑은 고딕',color:'333333',align:'left',valign:'middle'});});
    nodes.forEach(n=>{const p=positions[n.id];if(!p)return;slide.addShape(pptx.shapes.RECTANGLE,{x:p.x,y:p.y,w:p.w,h:p.h,fill:{color:'FFFFFF'},line:{color:'000000',width:1.5},rectRadius:0.03});slide.addText(n.label,{x:p.x+0.05,y:p.y,w:p.w-0.1,h:p.h,fontSize:9,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle',bold:false});});
  });
  pptx.writeFile({fileName:`도면_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.pptx`});showToast('PPTX 다운로드 완료');
}
function downloadPptxAll(){if(diagramData.step_07||outputs.step_07_mermaid)downloadPptx('step_07');else showToast('도면 없음','error');}

// ═══════════ RENDERERS ═══════════
function renderOutput(sid,text){const cid=`result${sid.charAt(0).toUpperCase()+sid.slice(1).replace('_','')}`;const el=document.getElementById(cid);if(!el)return;if(sid==='step_01')renderTitleCards(el,text);else if(sid==='step_06'||sid==='step_10')renderClaimResult(el,sid,text);else renderEditableResult(el,sid,text);}
function renderTitleCards(c,text){const cs=parseTitleCandidates(text);if(!cs.length){c.innerHTML=`<div style="margin-top:12px;padding:12px;background:var(--color-bg-tertiary);border-radius:8px;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</div>`;document.getElementById('titleConfirmArea').style.display='block';return;}c.innerHTML='<div class="selection-cards" style="margin-top:12px">'+cs.map(x=>`<div class="selection-card" onclick="selectTitle(this,\`${x.korean.replace(/`/g,'')}\`,\`${x.english.replace(/`/g,'')}\`)"><div class="selection-card-category">${x.num}</div><div class="selection-card-title">${escapeHtml(x.korean)}</div><div class="selection-card-subtitle">${escapeHtml(x.english)}</div></div>`).join('')+'</div>';document.getElementById('titleConfirmArea').style.display='block';}
function renderClaimResult(c,sid,text){const st=parseClaimStats(text),iss=validateClaims(text);let h=`<div class="stat-row" style="margin-top:12px"><div class="stat-card stat-card-steps"><div class="stat-card-value">${st.total}</div><div class="stat-card-label">총 청구항</div></div><div class="stat-card stat-card-api"><div class="stat-card-value">${st.independent}</div><div class="stat-card-label">독립항</div></div><div class="stat-card stat-card-cost"><div class="stat-card-value">${st.dependent}</div><div class="stat-card-label">종속항</div></div></div>`;if(iss.length)h+=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="tossface">${i.severity==='CRITICAL'?'🔴':'🟠'}</span>${escapeHtml(i.message)}</div>`).join('');else h+='<div class="issue-item issue-pass"><span class="tossface">✅</span>모든 검증 통과</div>';h+=`<textarea class="result-textarea" rows="14" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea>`;c.innerHTML=h;}
function renderEditableResult(c,sid,text){c.innerHTML=`<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="badge badge-primary">${STEP_NAMES[sid]||sid}</span><span class="badge badge-neutral">${text.length.toLocaleString()}자</span></div><textarea class="result-textarea" rows="10" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea></div>`;}
function renderBatchResult(cid,sid,text){document.getElementById(cid).innerHTML+=`<div class="accordion-header" onclick="toggleAccordion(this)"><span><span class="tossface">✅</span> ${STEP_NAMES[sid]} <span class="badge badge-neutral">${text.length.toLocaleString()}자</span></span><span class="arrow">▶</span></div><div class="accordion-body"><textarea class="result-textarea" style="min-height:120px" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea></div>`;}
function toggleAccordion(h){h.classList.toggle('open');const b=h.nextElementSibling;if(b)b.classList.toggle('open');}

// ═══════════ VALIDATION (v4.7 — expanded) ═══════════
const KILLER_WORDS=[{pattern:/반드시/,msg:'"반드시" — 제한적 표현'},{pattern:/에 한하여/,msg:'"~에 한하여" — 제한적 표현'},{pattern:/에 한정/,msg:'"~에 한정" — 제한적 표현'},{pattern:/에 제한/,msg:'"~에 제한" — 제한적 표현'},{pattern:/필수적으로/,msg:'"필수적으로" — 제한적 표현'},{pattern:/무조건/,msg:'"무조건" — 제한적 표현'},{pattern:/오직/,msg:'"오직" — 제한적 표현'}];
function validateClaims(text){
  const iss=[];if(!text)return iss;const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,claims={};let m;
  while((m=cp.exec(text))!==null)claims[parseInt(m[1])]=m[2].trim();
  if(!Object.keys(claims).length){iss.push({severity:'HIGH',message:'청구항 파싱 실패'});return iss;}
  if(!claims[1])iss.push({severity:'CRITICAL',message:'독립항(청구항 1) 없음'});
  Object.entries(claims).forEach(([num,ct])=>{const n=parseInt(num);
    if(n>1){const rm=ct.match(/청구항\s*(\d+)에\s*있어서/),rn=rm?parseInt(rm[1]):1;
      if(rm){if(!claims[rn])iss.push({severity:'HIGH',message:`청구항 ${num}: 참조 청구항 ${rn} 없음`});if(rn>=n)iss.push({severity:'HIGH',message:`청구항 ${num}: 자기/후행 청구항 참조`});}
      const refs=ct.match(/상기\s+([가-힣]+(?:\s[가-힣]+){0,3})/g)||[],refText=claims[rn]||claims[1]||'';
      refs.forEach(ref=>{const raw=ref.replace(/^상기\s+/,''),cw=raw.split(/\s+/).slice(0,2).map(stripKoreanParticles).filter(w=>w.length>=2);if(!cw.length)return;if(!cw.every(w=>refText.includes(w)))iss.push({severity:'CRITICAL',message:`청구항 ${num}: "상기 ${raw}" — 청구항 ${rn}에 "${cw.join(', ')}" 선행기재 없음`});});}
    KILLER_WORDS.forEach(kw=>{if(kw.pattern.test(ct))iss.push({severity:'HIGH',message:`청구항 ${num}: ${kw.msg}`});});
  });return iss;
}
function runValidation(){const all=[outputs.step_06,outputs.step_10].filter(Boolean).join('\n');if(!all){showToast('검증할 청구항이 없어요','error');return;}const iss=validateClaims(all),el=document.getElementById('validationResults');if(!iss.length){el.innerHTML='<div class="issue-item issue-pass"><span class="tossface">🎉</span>모든 검증 통과</div>';return;}el.innerHTML=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="tossface">${i.severity==='CRITICAL'?'🔴':'🟠'}</span>${escapeHtml(i.message)}</div>`).join('');}

// ═══════════ OUTPUT ═══════════
function updateStats(){const c=Object.keys(outputs).filter(k=>outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;document.getElementById('statCompleted').textContent=`${c}/19`;document.getElementById('statApiCalls').textContent=usage.calls;document.getElementById('statCost').textContent=`$${(usage.cost||0).toFixed(2)}`;}
function renderPreview(){const el=document.getElementById('previewArea'),spec=buildSpecification();if(!spec.trim()){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px;text-align:center;padding:20px">생성된 항목이 없어요</p>';return;}el.innerHTML=spec.split(/(?=【)/).map(s=>{const h=s.match(/【(.+?)】/);if(!h)return '';return `<div class="accordion-header" onclick="toggleAccordion(this)"><span>【${escapeHtml(h[1])}】</span><span class="arrow">▶</span></div><div class="accordion-body">${escapeHtml(s)}</div>`;}).join('');}
function buildSpecification(){const desc=getFullDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');return['【발명의 설명】',`【발명의 명칭】\n${selectedTitle}`,`【기술분야】\n${outputs.step_02||''}`,`【발명의 배경이 되는 기술】\n${outputs.step_03||''}`,`【선행기술문헌】\n${outputs.step_04||''}`,'【발명의 내용】',`【해결하고자 하는 과제】\n${outputs.step_05||''}`,`【과제의 해결 수단】\n${outputs.step_17||''}`,`【발명의 효과】\n${outputs.step_16||''}`,`【도면의 간단한 설명】\n${brief||''}`,`【발명을 실시하기 위한 구체적인 내용】\n${desc}${outputs.step_12?'\n\n'+outputs.step_12:''}`,`【부호의 설명】\n${outputs.step_18||''}`,`【청구범위】\n${outputs.step_06||''}${outputs.step_10?'\n\n'+outputs.step_10:''}`,`【요약서】\n${outputs.step_19||''}`].filter(Boolean).join('\n\n');}
function copyToClipboard(){const t=buildSpecification();if(!t.trim()){showToast('내용 없음','error');return;}navigator.clipboard.writeText(t).then(()=>showToast('복사 완료')).catch(()=>showToast('클립보드 접근 불가','error'));}
function downloadAsTxt(){const t=buildSpecification();if(!t.trim()){showToast('내용 없음','error');return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.txt`;a.click();}

function downloadAsWord(){
  const desc=getFullDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  const secs=[{h:'발명의 설명'},{h:'발명의 명칭',b:selectedTitle},{h:'기술분야',b:outputs.step_02},{h:'발명의 배경이 되는 기술',b:outputs.step_03},{h:'선행기술문헌',b:outputs.step_04},{h:'발명의 내용'},{h:'해결하고자 하는 과제',b:outputs.step_05},{h:'과제의 해결 수단',b:outputs.step_17},{h:'발명의 효과',b:outputs.step_16},{h:'도면의 간단한 설명',b:brief},{h:'발명을 실시하기 위한 구체적인 내용',b:[desc,outputs.step_12].filter(Boolean).join('\n\n')},{h:'부호의 설명',b:outputs.step_18},{h:'청구범위',b:[outputs.step_06,outputs.step_10].filter(Boolean).join('\n\n')},{h:'요약서',b:outputs.step_19}];
  const html=secs.map(s=>{const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${escapeHtml(s.h)}】</h2>`;if(!s.b)return hd;return hd+s.b.split('\n').filter(l=>l.trim()).map(l=>{const hl=/【수학식\s*\d+】/.test(l)||/__+/.test(l)?'background-color:#FFFF00;':'';return `<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify;${hl}">${escapeHtml(l.trim())}</p>`;}).join('');}).join('');
  const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}</body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();showToast('Word 다운로드 완료');
}

// ═══════════ INIT ═══════════
async function init(){
  mermaid.initialize({startOnLoad:false,theme:'neutral',securityLevel:'loose',fontFamily:'Pretendard Variable, Malgun Gothic, sans-serif',flowchart:{useMaxWidth:true,htmlLabels:true,curve:'linear'},themeVariables:{fontSize:'14px'}});
  const{data:{session}}=await sb.auth.getSession();
  if(session?.user)await onAuthSuccess(session.user);else showScreen('auth');
  sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')showScreen('auth');});
}
init();
