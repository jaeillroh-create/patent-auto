/* ═══════════════════════════════════════════════════════════
   특허명세서 자동 생성 v5.4 — Common (Supabase, Auth, API, UI)
   ═══════════════════════════════════════════════════════════ */
window.App = window.App || {};

// ═══ Supabase (전역 변수로 중복 방지) ═══
var SUPABASE_URL = window.SUPABASE_URL || 'https://uvrzwhfjtzqujawmscca.supabase.co';
var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cnp3aGZqdHpxdWphd21zY2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTEwNDgsImV4cCI6MjA4NTUyNzA0OH0.JSSPMPIHsXfbNm6pgRzCTGH7aNQATl-okIkcXHl7Mkk';
var sb = window.sb || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.sb = sb;

// ═══ API Provider Configuration (v5.2) ═══
const API_PROVIDERS = {
  claude: {
    label:'Claude (Anthropic)', short:'Claude',
    endpoint:'https://api.anthropic.com/v1/messages',
    keyPlaceholder:'sk-ant-api03-...', keyUrl:'https://console.anthropic.com/settings/keys',
    models:{
      sonnet:{id:'claude-sonnet-4-5-20250929',label:'Sonnet 4.5',inputCost:3,outputCost:15},
      opus:{id:'claude-opus-4-6',label:'Opus 4.6',inputCost:15,outputCost:75}
    }, defaultModel:'opus', cheapModel:'sonnet'
  },
  gpt: {
    label:'GPT (OpenAI)', short:'GPT',
    endpoint:'https://api.openai.com/v1/chat/completions',
    keyPlaceholder:'sk-proj-...', keyUrl:'https://platform.openai.com/api-keys',
    models:{
      gpt4o_mini:{id:'gpt-4o-mini',label:'GPT-4o mini',inputCost:0.15,outputCost:0.6},
      gpt4o:{id:'gpt-4o',label:'GPT-4o',inputCost:2.5,outputCost:10}
    }, defaultModel:'gpt4o_mini', cheapModel:'gpt4o_mini'
  },
  gemini: {
    label:'Gemini (Google)', short:'Gemini',
    endpoint:'https://generativelanguage.googleapis.com/v1beta/models/',
    keyPlaceholder:'AIza...', keyUrl:'https://aistudio.google.com/apikey',
    models:{
      gemini_flash:{id:'gemini-2.0-flash',label:'Gemini 2.0 Flash',inputCost:0.1,outputCost:0.4},
      gemini_pro:{id:'gemini-2.5-pro-preview-06-05',label:'Gemini 2.5 Pro',inputCost:1.25,outputCost:10}
    }, defaultModel:'gemini_flash', cheapModel:'gemini_flash'
  }
};
let selectedProvider='claude', selectedModel='opus';
let apiKeys={claude:'',gpt:'',gemini:''};
let profileTempProvider='claude';
let API_KEY='',currentUser=null,currentProfile=null,currentProjectId=null;

// ═══ KIPRIS API Key (특허·상표 공통) ═══
const DEFAULT_KIPRIS_KEY='zDPwGhIGXYhevC9hTQrPTXyNGdxECXt0UGAa37v15wY=';
let kiprisKey='';

function getKiprisKey(){return kiprisKey||DEFAULT_KIPRIS_KEY;}

function loadKiprisKey(){
  var userId=currentUser?.id;
  // 1순위: 프로필 JSON
  try{
    var raw=currentProfile?.api_key_encrypted||'';
    var pk=JSON.parse(raw);
    if(pk.kipris){
      kiprisKey=pk.kipris;
      console.log('[KIPRIS] API 키: 프로필에서 로드됨');
      if(userId){try{localStorage.setItem('kipris_api_key_'+userId,pk.kipris);}catch(e){}}
      return;
    }
  }catch(e){}
  // 2순위: userId별 localStorage (통합 키)
  if(userId){
    try{
      var cached=localStorage.getItem('kipris_api_key_'+userId);
      if(cached){kiprisKey=cached;console.log('[KIPRIS] API 키: localStorage 캐시에서 로드됨');return;}
    }catch(e){}
    // 2-1: 레거시 tm_ 접두사 localStorage (상표 모듈 기존 키 마이그레이션)
    try{
      var tmCached=localStorage.getItem('tm_kipris_api_key_'+userId);
      if(tmCached){
        kiprisKey=tmCached;
        console.log('[KIPRIS] API 키: 레거시 tm_캐시에서 마이그레이션');
        try{localStorage.setItem('kipris_api_key_'+userId,tmCached);}catch(e){}
        return;
      }
    }catch(e){}
  }
  // 3순위: 레거시 localStorage (계정 구분 없던 키)
  try{
    var legacy=localStorage.getItem('tm_kipris_api_key');
    if(legacy&&legacy!==DEFAULT_KIPRIS_KEY){
      kiprisKey=legacy;
      console.log('[KIPRIS] API 키: 레거시 키에서 마이그레이션');
      saveKiprisKey(legacy);
      try{localStorage.removeItem('tm_kipris_api_key');}catch(e){}
      return;
    }
  }catch(e){}
  // 4순위: 기본값
  kiprisKey=DEFAULT_KIPRIS_KEY;
  console.log('[KIPRIS] API 키: 기본값 사용');
}

async function saveKiprisKey(newKey){
  var userId=currentUser?.id;
  kiprisKey=newKey||DEFAULT_KIPRIS_KEY;
  if(!userId)return;
  try{
    var existing={};
    try{existing=JSON.parse(currentProfile?.api_key_encrypted||'{}');}catch(e){}
    existing.kipris=newKey||'';
    await sb.from('profiles').update({api_key_encrypted:JSON.stringify(existing)}).eq('id',userId);
    if(currentProfile)currentProfile.api_key_encrypted=JSON.stringify(existing);
    // userId-scoped localStorage 캐시
    if(newKey){
      try{localStorage.setItem('kipris_api_key_'+userId,newKey);}catch(e){}
      try{localStorage.setItem('tm_kipris_api_key_'+userId,newKey);}catch(e){} // TM 호환
    }else{
      try{localStorage.removeItem('kipris_api_key_'+userId);}catch(e){}
      try{localStorage.removeItem('tm_kipris_api_key_'+userId);}catch(e){}
    }
    console.log('[KIPRIS] API 키: 프로필에 저장 완료');
  }catch(error){
    console.error('[KIPRIS] API 키 저장 실패:',error);
  }
}

const SYSTEM_PROMPT = '너는 대한민국 특허청(KIPO) 심사 실무와 등록 가능성(신규성/진보성/명확성/지원요건)을 완벽히 이해한 15년 차 수석 변리사이다. 원칙: 1.표준문체(~한다) 2.글머리/마크다운 절대금지 3.SW명 대신 알고리즘 4.구성요소명(참조번호) 형태 5.명세서에 바로 붙여넣을 순수텍스트 6.제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지';

// ═══ Provider functions ═══
function getProvider(){return API_PROVIDERS[selectedProvider];}
function getModelConfig(){return getProvider().models[selectedModel];}
function getModel(){return getModelConfig().id;}

function selectModel(m){
  const prov=getProvider();if(!prov.models[m])return;
  selectedModel=m;updateModelToggle();
  showToast(`모델: ${prov.models[m].label} (${prov.models[m].id})`);
}
function selectProvider(p){
  if(!API_PROVIDERS[p])return;
  selectedProvider=p;selectedModel=API_PROVIDERS[p].defaultModel;
  API_KEY=apiKeys[p]||'';
  updateModelToggle();updateProviderLabel();
  try{localStorage.setItem('patent_api_provider',p);}catch(e){}
}
function updateModelToggle(){
  const prov=getProvider(),keys=Object.keys(prov.models);
  const c=document.getElementById('modelToggleContainer');if(!c)return;
  c.innerHTML=keys.map(k=>{const m=prov.models[k],a=k===selectedModel;
    return `<button onclick="selectModel('${k}')" style="border:none;font-size:11px;padding:4px 10px;cursor:pointer;background:${a?'var(--color-primary)':'transparent'};color:${a?'#fff':'var(--color-text-secondary)'};font-family:inherit">${a?'✓ ':''}${m.label}</button>`;
  }).join('');
}
function updateProviderLabel(){
  const el=document.getElementById('providerLabel');
  if(el)el.textContent=getProvider().short;
}

// ═══ Provider-agnostic API request/response ═══
function buildAPIRequest(prov,modelKey,sys,user,maxTok){
  const pr=API_PROVIDERS[prov],mid=pr.models[modelKey].id,key=apiKeys[prov];
  if(prov==='claude')return{url:pr.endpoint,headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:{model:mid,max_tokens:maxTok,system:sys,messages:[{role:'user',content:user}]}};
  if(prov==='gpt')return{url:pr.endpoint,headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:{model:mid,max_tokens:maxTok,messages:[{role:'system',content:sys},{role:'user',content:user}]}};
  if(prov==='gemini')return{url:`${pr.endpoint}${mid}:generateContent?key=${key}`,headers:{'Content-Type':'application/json'},body:{systemInstruction:{parts:[{text:sys}]},contents:[{parts:[{text:user}]}],generationConfig:{maxOutputTokens:maxTok}}};
}
function parseAPIResponse(prov,d){
  if(prov==='claude'){if(d.error)throw new Error(d.error.message);return{text:d.content[0].text,stopReason:d.stop_reason,it:d.usage?.input_tokens||0,ot:d.usage?.output_tokens||0};}
  if(prov==='gpt'){if(d.error)throw new Error(d.error.message);return{text:d.choices[0].message.content,stopReason:d.choices[0].finish_reason==='length'?'max_tokens':d.choices[0].finish_reason,it:d.usage?.prompt_tokens||0,ot:d.usage?.completion_tokens||0};}
  if(prov==='gemini'){if(d.error)throw new Error(d.error.message||d.error.status);const c=d.candidates?.[0];if(!c)throw new Error('빈 응답');return{text:c.content?.parts?.[0]?.text||'',stopReason:c.finishReason==='MAX_TOKENS'?'max_tokens':c.finishReason,it:d.usageMetadata?.promptTokenCount||0,ot:d.usageMetadata?.candidatesTokenCount||0};}
}

// ═══ UTILITIES ═══
function escapeHtml(t){if(!t)return '';return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');}
function showToast(m,type='success'){const c=document.getElementById('toastContainer'),icon=type==='success'?'✅':type==='error'?'❌':'ℹ️',t=document.createElement('div');t.className='toast';t.innerHTML=`<span class="tossface">${icon}</span> ${escapeHtml(m)}`;c.appendChild(t);setTimeout(()=>t.remove(),3000);}
function showProgress(cid,label,cur,tot){const el=document.getElementById(cid);if(!el)return;const p=Math.round(cur/tot*100);el.innerHTML=`<div class="progress-container"><div class="progress-label"><div class="progress-dot"></div>${escapeHtml(label)}</div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${p}%"></div></div><div class="progress-info"><span>${cur}/${tot}</span><span>${p}%</span></div></div>`;}
function clearProgress(id){const el=document.getElementById(id);if(el)el.innerHTML='';}
function setButtonLoading(bid,on){const b=document.getElementById(bid);if(!b)return;if(on){b.classList.add('btn-loading');b.disabled=true;}else{b.classList.remove('btn-loading');b.disabled=false;}}

// ═══ SCREEN ═══
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.display='';});
  ['adminPanel','screenMain','screenDashboard'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  switch(name){
    case 'auth':document.getElementById('screenAuth').classList.add('active');break;
    case 'tos':document.getElementById('screenTos').classList.add('active');break;
    case 'pending':document.getElementById('screenPending').classList.add('active');break;
    case 'dashboard':document.getElementById('screenDashboard').style.display='block';document.getElementById('screenDashboard').classList.add('active');App.initServiceTabs();if(App._onDashboard)App._onDashboard();break;
    case 'main':document.getElementById('screenMain').style.display='block';document.getElementById('screenMain').classList.add('active');break;
    case 'admin':document.getElementById('adminPanel').style.display='block';document.getElementById('adminPanel').classList.add('active');loadAdminUsers();break;
  }
}

// ═══ AUTH ═══
function switchAuthTab(tab){document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));if(tab==='login'){document.querySelector('.auth-tab:first-child').classList.add('active');document.getElementById('authLogin').style.display='block';document.getElementById('authSignup').style.display='none';}else{document.querySelector('.auth-tab:last-child').classList.add('active');document.getElementById('authLogin').style.display='none';document.getElementById('authSignup').style.display='block';}}
async function handleLogin(){const e=document.getElementById('loginEmail').value.trim(),p=document.getElementById('loginPassword').value;if(!e||!p){showToast('이메일과 비밀번호를 입력해 주세요','error');return;}setButtonLoading('btnLogin',true);const{data,error}=await sb.auth.signInWithPassword({email:e,password:p});setButtonLoading('btnLogin',false);if(error){showToast(error.message,'error');return;}await onAuthSuccess(data.user);}
async function handleSignup(){const e=document.getElementById('signupEmail').value.trim(),p=document.getElementById('signupPassword').value,n=document.getElementById('signupName').value.trim();if(!e||!p){showToast('이메일과 비밀번호를 입력해 주세요','error');return;}if(p.length<6){showToast('비밀번호는 6자 이상','error');return;}setButtonLoading('btnSignup',true);const{data,error}=await sb.auth.signUp({email:e,password:p,options:{data:{display_name:n||e}}});setButtonLoading('btnSignup',false);if(error){showToast(error.message,'error');return;}showToast('회원가입 완료!');if(data.user)await onAuthSuccess(data.user);}
async function handleLogout(){if(typeof clearAllState==='function')clearAllState();API_KEY='';await sb.auth.signOut();currentUser=null;currentProfile=null;showScreen('auth');}

async function onAuthSuccess(user){
  currentUser=user;let{data:profile}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(!profile){const{data:np,error}=await sb.from('profiles').insert({id:user.id,display_name:user.user_metadata?.display_name||user.email,role:'user',status:'pending',tos_accepted:false}).select('*').single();if(error){showToast('프로필 생성 실패','error');return;}profile=np;}
  currentProfile=profile;
  if(!profile.tos_accepted){showScreen('tos');return;}if(profile.status==='pending'){showScreen('pending');return;}if(profile.status==='suspended'){showToast('계정 정지됨','error');return;}
  const dn=document.getElementById('dashUserName');if(dn)dn.textContent=profile.display_name||user.email;
  if(profile.role==='admin'){const ab=document.getElementById('btnDashAdmin');if(ab)ab.style.display='inline-flex';}
  if(!API_KEY){
    const rawKey=profile.api_key_encrypted||'';
    try{const pk=JSON.parse(rawKey);apiKeys={claude:pk.claude||'',gpt:pk.gpt||'',gemini:pk.gemini||''};if(pk.provider&&API_PROVIDERS[pk.provider])selectedProvider=pk.provider;
    }catch(e){apiKeys={claude:rawKey,gpt:'',gemini:''};}
    try{const sp=localStorage.getItem('patent_api_provider');if(sp&&API_PROVIDERS[sp])selectedProvider=sp;}catch(e){}
    selectedModel=API_PROVIDERS[selectedProvider].defaultModel;API_KEY=apiKeys[selectedProvider]||'';
    if(!API_KEY){try{API_KEY=localStorage.getItem('patent_api_key')||'';}catch(e){}}
  }
  // ★ KIPRIS API 키 로드 (특허·상표 공통)
  loadKiprisKey();
  if(typeof clearAllState==='function')clearAllState();showScreen('dashboard');
}
async function handleTosAccept(){if(!document.getElementById('tosCheck1').checked||!document.getElementById('tosCheck2').checked){showToast('모든 항목에 동의해 주세요','error');return;}await sb.from('profiles').update({tos_accepted:true,tos_accepted_at:new Date().toISOString()}).eq('id',currentUser.id);currentProfile.tos_accepted=true;if(currentProfile.status==='pending')showScreen('pending');else await onAuthSuccess(currentUser);}
async function checkApprovalStatus(){const{data}=await sb.from('profiles').select('status').eq('id',currentUser.id).single();if(data?.status==='approved')await onAuthSuccess(currentUser);else showToast('아직 승인 대기 중','info');}

// ═══ API Key (legacy modal) ═══
async function saveApiKey(){
  const k=document.getElementById('apiKeyInput')?.value?.trim();
  if(!k){showToast('API Key를 입력해 주세요','error');return;}
  apiKeys[selectedProvider]=k;API_KEY=k;
  // 기존 프로필의 추가 필드(kipris 등) 보존
  let existing={};
  try{existing=JSON.parse(currentProfile?.api_key_encrypted||'{}');}catch(e){}
  const data={...existing,...apiKeys,provider:selectedProvider};
  try{localStorage.setItem('patent_api_key_'+selectedProvider,k);localStorage.setItem('patent_api_provider',selectedProvider);}catch(e){}
  if(currentUser){await sb.from('profiles').update({api_key_encrypted:JSON.stringify(data)}).eq('id',currentUser.id);currentProfile.api_key_encrypted=JSON.stringify(data);}
  document.getElementById('apiKeyModal').style.display='none';
  showToast('API Key 저장됨');
}
function showApiKeyModal(){openProfileSettings();}

// ═══ Profile Settings (v5.2) ═══
function openProfileSettings(){
  profileTempProvider=selectedProvider;
  renderProfileModal();
  document.getElementById('profileSettingsModal').style.display='flex';
}
function closeProfileSettings(){document.getElementById('profileSettingsModal').style.display='none';}
function renderProfileModal(){
  const p=profileTempProvider,prov=API_PROVIDERS[p];
  document.getElementById('providerCards').innerHTML=Object.entries(API_PROVIDERS).map(([k,pr])=>{
    const a=k===p,hk=!!apiKeys[k];
    return `<div onclick="profileSelectProvider('${k}')" style="flex:1;padding:12px;border:2px solid ${a?'var(--color-primary)':'var(--color-border)'};border-radius:10px;cursor:pointer;text-align:center;background:${a?'var(--color-primary-bg)':'transparent'};transition:all 0.15s"><div style="font-size:15px;font-weight:700;color:${a?'var(--color-primary)':'var(--color-text-primary)'}">${pr.short}</div><div style="font-size:11px;color:var(--color-text-tertiary);margin-top:2px">${pr.label.split('(')[1]?.replace(')','')??''}</div>${hk?'<div style="font-size:10px;color:var(--color-success);margin-top:4px">✓ Key 설정됨</div>':'<div style="font-size:10px;color:var(--color-text-tertiary);margin-top:4px">Key 미설정</div>'}</div>`;
  }).join('');
  const inp=document.getElementById('profileApiKeyInput');
  inp.value=apiKeys[p]||'';inp.placeholder=prov.keyPlaceholder;
  document.getElementById('profileApiKeyHint').innerHTML='발급: <a href="'+prov.keyUrl+'" target="_blank">'+prov.keyUrl.replace('https://','')+'</a>';
  const curProv=API_PROVIDERS[selectedProvider];
  document.getElementById('profileCurrentStatus').innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:center"><span>서비스</span><strong>'+curProv.label+'</strong></div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>모델</span><strong>'+getModelConfig().label+'</strong></div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>API Key</span><strong style="color:'+(apiKeys[selectedProvider]?'var(--color-success)':'var(--color-error)')+'">'+(apiKeys[selectedProvider]?'설정됨 ✅':'미설정 ❌')+'</strong></div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>KIPRIS Key</span><strong style="color:'+((kiprisKey&&kiprisKey!==DEFAULT_KIPRIS_KEY)?'var(--color-success)':'var(--color-text-tertiary)')+'">'+((kiprisKey&&kiprisKey!==DEFAULT_KIPRIS_KEY)?'설정됨 ✅':'기본키 사용')+'</strong></div>';
  // ★ KIPRIS API 키 입력란 채우기
  var kiprisInput=document.getElementById('kiprisApiKeyInput');
  if(kiprisInput){
    var curKipris=getKiprisKey();
    kiprisInput.value=(curKipris&&curKipris!==DEFAULT_KIPRIS_KEY)?curKipris:'';
  }
}
function profileSelectProvider(p){
  const curKey=document.getElementById('profileApiKeyInput').value.trim();
  if(curKey)apiKeys[profileTempProvider]=curKey;
  profileTempProvider=p;renderProfileModal();
}
async function saveProfileSettings(){
  const key=document.getElementById('profileApiKeyInput').value.trim();
  if(key)apiKeys[profileTempProvider]=key;
  selectProvider(profileTempProvider);
  // ★ KIPRIS API 키 저장
  var kiprisInput=document.getElementById('kiprisApiKeyInput');
  var newKiprisKey=kiprisInput?kiprisInput.value.trim():'';
  // 기존 프로필의 추가 필드(kipris 등) 보존
  let existing={};
  try{existing=JSON.parse(currentProfile?.api_key_encrypted||'{}');}catch(e){}
  // KIPRIS 키 업데이트
  if(newKiprisKey){
    existing.kipris=newKiprisKey;
    kiprisKey=newKiprisKey;
  }else if(kiprisInput){
    // 입력란이 비어있으면 기본값으로 복원 (기존 kipris 필드 제거)
    delete existing.kipris;
    kiprisKey=DEFAULT_KIPRIS_KEY;
  }
  const data={...existing,...apiKeys,provider:selectedProvider};
  // kipris는 apiKeys에 없으므로 existing에서 가져온 것이 유지됨
  if(newKiprisKey)data.kipris=newKiprisKey;
  try{Object.entries(apiKeys).forEach(([p,k])=>{if(k)localStorage.setItem('patent_api_key_'+p,k);});localStorage.setItem('patent_api_provider',selectedProvider);}catch(e){}
  // KIPRIS localStorage 캐시
  if(currentUser?.id){
    if(newKiprisKey){
      try{localStorage.setItem('kipris_api_key_'+currentUser.id,newKiprisKey);}catch(e){}
      try{localStorage.setItem('tm_kipris_api_key_'+currentUser.id,newKiprisKey);}catch(e){} // TM 호환
    }else if(kiprisInput){
      try{localStorage.removeItem('kipris_api_key_'+currentUser.id);}catch(e){}
      try{localStorage.removeItem('tm_kipris_api_key_'+currentUser.id);}catch(e){}
    }
  }
  if(currentUser){await sb.from('profiles').update({api_key_encrypted:JSON.stringify(data)}).eq('id',currentUser.id);currentProfile.api_key_encrypted=JSON.stringify(data);}
  closeProfileSettings();updateModelToggle();updateProviderLabel();
  // ★ 저장 내용에 따라 적절한 토스트 표시
  var toastParts=[];
  if(key)toastParts.push(API_PROVIDERS[selectedProvider].short+' API Key 저장됨');
  if(newKiprisKey)toastParts.push('KIPRIS API 키 저장됨');
  if(toastParts.length===0)toastParts.push(API_PROVIDERS[selectedProvider].short+' 적용됨 · '+getModelConfig().label);
  showToast(toastParts.join(' · '));
}

// ═══ Project Rename (v5.2) ═══
async function renameProject(id,currentTitle){
  const t=prompt('새 사건명을 입력하세요:',currentTitle);
  if(!t||!t.trim()||t.trim()===currentTitle)return;
  await sb.from('projects').update({title:t.trim()}).eq('id',id);
  showToast('사건명 변경됨');
  if(currentProjectId===id){const el=document.getElementById('headerProjectName');if(el)el.textContent=t.trim();}
  if(typeof loadDashboardProjects==='function')loadDashboardProjects();
}
function renameCurrentProject(){if(!currentProjectId)return;const el=document.getElementById('headerProjectName');renameProject(currentProjectId,el?.textContent||'');}

// ═══ ADMIN ═══
async function loadAdminUsers(){const{data:u}=await sb.from('profiles').select('*').order('created_at',{ascending:false});const el=document.getElementById('adminUserList');if(!u?.length){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px">사용자 없음</p>';return;}el.innerHTML=u.map(x=>`<div class="admin-user-item"><div class="admin-user-info"><div class="admin-user-name">${escapeHtml(x.display_name||x.id)}</div><div class="admin-user-status"><span class="badge ${x.status==='approved'?'badge-success':x.status==='pending'?'badge-warning':'badge-error'}">${x.status}</span> <span class="badge badge-neutral">${x.role}</span></div></div><div style="display:flex;gap:4px">${x.status==='pending'?`<button class="btn btn-primary btn-sm" onclick="adminApprove('${x.id}')">승인</button>`:''} ${x.status==='approved'?`<button class="btn btn-outline btn-sm" onclick="adminSuspend('${x.id}')">정지</button>`:''} ${x.status==='suspended'?`<button class="btn btn-outline btn-sm" onclick="adminApprove('${x.id}')">해제</button>`:''}</div></div>`).join('');}
async function adminApprove(id){await sb.from('profiles').update({status:'approved'}).eq('id',id);showToast('승인됨');loadAdminUsers();}
async function adminSuspend(id){await sb.from('profiles').update({status:'suspended'}).eq('id',id);showToast('정지됨');loadAdminUsers();}

// ═══ API Call Wrappers ═══
function ensureApiKey(){
  const p=selectedProvider;
  if(apiKeys[p]){API_KEY=apiKeys[p];return true;}
  if(currentProfile?.api_key_encrypted){
    try{const parsed=JSON.parse(currentProfile.api_key_encrypted);if(parsed[p]){apiKeys[p]=parsed[p];API_KEY=parsed[p];return true;}}catch(e){
      if(p==='claude'&&currentProfile.api_key_encrypted){apiKeys.claude=currentProfile.api_key_encrypted;API_KEY=currentProfile.api_key_encrypted;return true;}
    }
  }
  try{const k=localStorage.getItem('patent_api_key_'+p);if(k){apiKeys[p]=k;API_KEY=k;return true;}
    if(p==='claude'){const k2=localStorage.getItem('patent_api_key');if(k2){apiKeys.claude=k2;API_KEY=k2;return true;}}
  }catch(e){}
  return false;
}

// ═══ API Circuit Breaker ═══
const apiCircuit = { failures: 0, lastFailTime: 0, THRESHOLD: 3, COOLDOWN: 30000 };
function isCircuitOpen() {
  if (apiCircuit.failures >= apiCircuit.THRESHOLD) {
    if (Date.now() - apiCircuit.lastFailTime < apiCircuit.COOLDOWN) return true;
    apiCircuit.failures = 0; // cooldown 지남 → 리셋
  }
  return false;
}
function recordApiSuccess() { apiCircuit.failures = 0; }
function recordApiFailure() { apiCircuit.failures++; apiCircuit.lastFailTime = Date.now(); }

// ═══ Opus → Sonnet Auto-Fallback ═══
async function callClaudeWithFallback(prompt, maxTokens=8192) {
  try {
    return await callClaude(prompt, maxTokens);
  } catch (e) {
    if (/과부하|529|서버 오류|overload|API 과부하 감지/i.test(e.message)) {
      console.warn('[API] Opus 실패 → Sonnet 자동 전환:', e.message);
      return await callClaudeSonnet(prompt, maxTokens);
    }
    throw e; // 인증 오류 등은 그대로 throw
  }
}

async function callClaude(prompt,maxTokens=8192){
  if(!ensureApiKey()){openProfileSettings();throw new Error('API Key를 먼저 입력해 주세요');}
  if(isCircuitOpen()){throw new Error('API 과부하 감지 — '+Math.ceil((apiCircuit.COOLDOWN-(Date.now()-apiCircuit.lastFailTime))/1000)+'초 후 재시도');}
  const prov=selectedProvider,mc=getModelConfig();
  const MAX_RETRIES=2;
  for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
    const req=buildAPIRequest(prov,selectedModel,SYSTEM_PROMPT,prompt,maxTokens);
    const ctrl=new AbortController(),tout=setTimeout(()=>ctrl.abort(),180000);
    try{const res=await fetch(req.url,{method:'POST',signal:ctrl.signal,headers:req.headers,body:JSON.stringify(req.body)});clearTimeout(tout);
      if(res.status===401||res.status===403){apiKeys[prov]='';API_KEY='';showToast('API Key가 유효하지 않습니다. ⚙️ 계정설정을 확인하세요.','error');throw new Error('API Key 유효하지 않음');}
      if(res.status===429){if(attempt<MAX_RETRIES){await new Promise(r=>setTimeout(r,3000*(attempt+1)));continue;}throw new Error('요청 과다. 30초 후 재시도');}
      if(res.status===529){recordApiFailure();if(attempt<MAX_RETRIES){const d=5000*(attempt+1);console.warn('[API] 529 과부하, '+(attempt+1)+'회 재시도 ('+d/1000+'초 후)...');await new Promise(r=>setTimeout(r,d));continue;}throw new Error('서버 과부하(529). 잠시 후 재시도');}
      if(res.status>=500){if(attempt<MAX_RETRIES){await new Promise(r=>setTimeout(r,2000*(attempt+1)));continue;}throw new Error('서버 오류');}
      const d=await res.json(),parsed=parseAPIResponse(prov,d);
      if(typeof usage!=='undefined'){usage.calls++;usage.inputTokens+=parsed.it;usage.outputTokens+=parsed.ot;
      usage.cost+=(parsed.it*mc.inputCost/1e6)+(parsed.ot*mc.outputCost/1e6);}
      if(typeof updateStats==='function')updateStats();
      recordApiSuccess();return{text:parsed.text,stopReason:parsed.stopReason};
    }catch(e){clearTimeout(tout);if(e.name==='AbortError')throw new Error('타임아웃(3분)');if(attempt>=MAX_RETRIES)throw e;if(/과부하|529|서버 오류/.test(e.message)){await new Promise(r=>setTimeout(r,3000*(attempt+1)));continue;}throw e;}
  }
}
async function callClaudeSonnet(prompt,maxTokens=8192){
  if(!ensureApiKey()){openProfileSettings();throw new Error('API Key를 먼저 입력해 주세요');}
  if(isCircuitOpen()){throw new Error('API 과부하 감지 — '+Math.ceil((apiCircuit.COOLDOWN-(Date.now()-apiCircuit.lastFailTime))/1000)+'초 후 재시도');}
  const prov=selectedProvider,cheapKey=API_PROVIDERS[prov].cheapModel,mc=API_PROVIDERS[prov].models[cheapKey];
  const MAX_RETRIES=2;
  for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
    const req=buildAPIRequest(prov,cheapKey,SYSTEM_PROMPT,prompt,maxTokens);
    const ctrl=new AbortController(),tout=setTimeout(()=>ctrl.abort(),180000);
    try{const res=await fetch(req.url,{method:'POST',signal:ctrl.signal,headers:req.headers,body:JSON.stringify(req.body)});clearTimeout(tout);
      if(res.status===401||res.status===403)throw new Error('API Key 유효하지 않음');
      if(res.status===429||res.status===529||res.status>=500){recordApiFailure();if(attempt<MAX_RETRIES){const d=5000*(attempt+1);console.warn('[API-S] '+res.status+' 재시도 '+(attempt+1)+' ('+d/1000+'초 후)');await new Promise(r=>setTimeout(r,d));continue;}throw new Error(res.status===529?'서버 과부하(529)':res.status===429?'요청 과다':'서버 오류');}
      const d=await res.json(),parsed=parseAPIResponse(prov,d);
      if(typeof usage!=='undefined'){usage.calls++;usage.inputTokens+=parsed.it;usage.outputTokens+=parsed.ot;
      usage.cost+=(parsed.it*mc.inputCost/1e6)+(parsed.ot*mc.outputCost/1e6);}
      recordApiSuccess();return{text:parsed.text,stopReason:parsed.stopReason};
    }catch(e){clearTimeout(tout);if(e.name==='AbortError')throw new Error('타임아웃');if(attempt>=MAX_RETRIES)throw e;if(/과부하|529|서버/.test(e.message)){await new Promise(r=>setTimeout(r,3000*(attempt+1)));continue;}throw e;}
  }
}
async function callClaudeWithContinuation(prompt,pid){let full='',r=await callClaude(prompt),a=0;full=r.text;while(a<6&&r.stopReason==='max_tokens'){a++;showProgress(pid,`이어서 작성 중... (${a}/6)`,a,6);r=await callClaude(`아래 특허명세서 뒷부분을 이어서 작성. 앞부분 반복 금지. 동일 문체.\n\n[마지막]\n${full.slice(-2000)}`);full+='\n'+r.text;}clearProgress(pid);return full;}

// ═══ FILE EXTRACTION ═══
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

// ═══ Expose to App namespace ═══
Object.assign(App, {
  sb, SUPABASE_URL, SUPABASE_ANON_KEY, API_PROVIDERS, SYSTEM_PROMPT,
  DEFAULT_KIPRIS_KEY,
  getProvider, getModelConfig, getModel, selectModel, selectProvider,
  updateModelToggle, updateProviderLabel, buildAPIRequest, parseAPIResponse,
  escapeHtml, showToast, showProgress, clearProgress, setButtonLoading,
  showScreen, ensureApiKey, callClaude, callClaudeSonnet, callClaudeWithFallback, callClaudeWithContinuation, isCircuitOpen, apiCircuit,
  extractTextFromFile, extractPdfText, extractDocxText, extractXlsxText, formatFileSize,
  openProfileSettings, closeProfileSettings,
  getKiprisKey, loadKiprisKey, saveKiprisKey,
  currentService: 'patent',
  _onDashboard: null  // Hook for patent.js to register dashboard load callback
});

// currentUser를 App에서 접근 가능하게 (trademark.js 등에서 사용)
Object.defineProperty(App, 'currentUser', {
  get: function() { return currentUser; },
  set: function(v) { currentUser = v; }
});
Object.defineProperty(App, 'currentProfile', {
  get: function() { return currentProfile; },
  set: function(v) { currentProfile = v; }
});

// ═══ Service Tab Switching (특허 / 상표) ═══
App.switchService = function(service) {
  // 탭 버튼 활성화
  document.querySelectorAll('.service-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.service === service);
  });

  // 대시보드 패널 전환
  document.querySelectorAll('.service-panel').forEach(function(panel) {
    panel.classList.remove('active');
  });
  var targetPanel = document.getElementById(service + '-dashboard-panel');
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // 현재 서비스 저장
  App.currentService = service;

  // 상표 모듈 초기화 (trademark.js 로드 시)
  if (service === 'trademark' && window.TM && typeof TM.init === 'function') {
    TM.init();
  }

  // URL 해시 업데이트
  history.replaceState(null, '', '#' + service);
};

App.initServiceTabs = function() {
  var hash = window.location.hash.replace('#', '');
  if (hash === 'trademark') {
    App.switchService('trademark');
  } else {
    App.switchService('patent');
  }
};
