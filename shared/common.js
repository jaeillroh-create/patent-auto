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
      sonnet:{id:'claude-sonnet-4-6',label:'Sonnet 4.6',inputCost:3,outputCost:15},
      opus:{id:'claude-opus-4-8',label:'Opus 4.8',inputCost:5,outputCost:25}
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
// 검증 엔진 6역할 LLM 배정(L-T1) — api_key_encrypted JSON 의 roleAssignments 에 얹어 사용자별 저장(DB 마이그레이션 0).
let roleAssignments={};
let profileTempProvider='claude';
let API_KEY='',currentUser=null,currentProfile=null,currentProjectId=null;

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

// ═══ Claude 최신 모델 자동 감지 (Anthropic Models API) ═══
// GET /v1/models 로 사용 가능한 모델 목록을 받아, 가장 최신 Opus/Sonnet을
// 자동으로 골라 적용한다. → 새 버전(4.9, 5 등)이 출시되면 코드 수정 없이 자동 선택.
// 네트워크/CORS 실패 시 위의 하드코딩 기본값(폴백)을 그대로 사용한다.
const CLAUDE_MODELS_CACHE_KEY='patent_claude_models_v1';
const CLAUDE_MODELS_TTL=12*60*60*1000; // 12시간

// opus/sonnet: {id,label} 형태. 비용(inputCost/outputCost)은 기존 값 유지.
function _applyClaudeModels(opus,sonnet){
  const m=API_PROVIDERS.claude.models;
  if(opus&&opus.id){m.opus.id=opus.id;if(opus.label)m.opus.label=opus.label;}
  if(sonnet&&sonnet.id){m.sonnet.id=sonnet.id;if(sonnet.label)m.sonnet.label=sonnet.label;}
  if(selectedProvider==='claude')updateModelToggle();
}

// 캐시된 최신 모델 정보를 즉시 적용(라벨이 깜빡이지 않도록 로드 시 1회 호출)
function restoreCachedClaudeModels(){
  try{
    const c=JSON.parse(localStorage.getItem(CLAUDE_MODELS_CACHE_KEY)||'null');
    if(c&&(c.opus||c.sonnet))_applyClaudeModels(c.opus,c.sonnet);
  }catch(e){}
}

// Models API 호출 → 최신 Opus/Sonnet 갱신. force=true면 TTL 무시하고 즉시 갱신.
async function refreshClaudeModels(force){
  const key=apiKeys.claude;if(!key)return;
  try{
    const c=JSON.parse(localStorage.getItem(CLAUDE_MODELS_CACHE_KEY)||'null');
    if(!force&&c&&c.ts&&(Date.now()-c.ts)<CLAUDE_MODELS_TTL)return; // 캐시 신선
  }catch(e){}
  try{
    const res=await fetch('https://api.anthropic.com/v1/models?limit=100',{
      headers:{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}
    });
    if(!res.ok)return;
    const data=await res.json(),list=(data&&data.data)||[];
    // 접두사로 후보를 거른 뒤 created_at 최신순으로 1위 선택
    const pickLatest=(prefix)=>{
      const cands=list.filter(x=>x&&typeof x.id==='string'&&x.id.indexOf(prefix)===0);
      if(!cands.length)return null;
      cands.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
      return {id:cands[0].id,label:(cands[0].display_name||cands[0].id).replace(/^Claude\s+/,'')};
    };
    const opus=pickLatest('claude-opus-'),sonnet=pickLatest('claude-sonnet-');
    if(!opus&&!sonnet)return;
    _applyClaudeModels(opus,sonnet);
    try{localStorage.setItem(CLAUDE_MODELS_CACHE_KEY,JSON.stringify({ts:Date.now(),opus,sonnet}));}catch(e){}
  }catch(e){/* CORS/네트워크 실패 → 하드코딩 폴백 유지 */}
}

// 로드 시 캐시 즉시 적용
restoreCachedClaudeModels();

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
function showToast(m,type='success'){if(typeof DT!=='undefined'&&DT.toast){DT.toast(m,type);return;}const c=document.getElementById('toastContainer'),iconName=type==='success'?'check-circle':type==='error'?'x-circle':type==='warning'?'warning':'info',t=document.createElement('div');t.className='toast toast-'+type;t.innerHTML=`<span class="ico" data-icon="${iconName}" data-size="16"></span> ${escapeHtml(m)}`;c.appendChild(t);if(window.Icons&&Icons.renderAll)Icons.renderAll(t);setTimeout(()=>t.remove(),3000);}
function showProgress(cid,label,cur,tot){const el=document.getElementById(cid);if(!el)return;const p=Math.round(cur/tot*100);el.innerHTML=`<div class="progress-container"><div class="progress-label"><div class="progress-dot"></div>${escapeHtml(label)}</div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${p}%"></div></div><div class="progress-info"><span class="ico" data-icon="chart" data-size="12"></span><span>${cur}/${tot}</span><span>${p}%</span></div></div>`;if(window.Icons&&Icons.renderAll)Icons.renderAll(el);}

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
      roleAssignments=(pk.roleAssignments&&typeof pk.roleAssignments==='object')?pk.roleAssignments:{}; // 역할배정 복원(L-T1)
      // KIPRIS 키를 계정별 localStorage에 캐시
      if(pk.kipris){try{localStorage.setItem('tm_kipris_api_key_'+user.id,pk.kipris);}catch(e){}}
    }catch(e){apiKeys={claude:rawKey,gpt:'',gemini:''};roleAssignments={};}
    try{const sp=localStorage.getItem('patent_api_provider');if(sp&&API_PROVIDERS[sp])selectedProvider=sp;}catch(e){}
    selectedModel=API_PROVIDERS[selectedProvider].defaultModel;API_KEY=apiKeys[selectedProvider]||'';
    if(!API_KEY){try{API_KEY=localStorage.getItem('patent_api_key')||'';}catch(e){}}
  }
  refreshClaudeModels(); // 최신 Claude 모델 자동 감지(비차단)
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
  fillLlmKeySlots();         // 검증 엔진 LLM 3슬롯 pre-fill(apiKeys 단일소스) — L-T2
  renderLlmRoleArea();       // 키개수 토글 초기 렌더
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
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>API Key</span><strong style="color:'+(apiKeys[selectedProvider]?'var(--color-success)':'var(--color-error)')+'">'+(apiKeys[selectedProvider]?'설정됨 ✅':'미설정 ❌')+'</strong></div>';
}
function profileSelectProvider(p){
  const curKey=document.getElementById('profileApiKeyInput').value.trim();
  if(curKey)apiKeys[profileTempProvider]=curKey;
  profileTempProvider=p;renderProfileModal();
}
async function saveProfileSettings(){
  const key=document.getElementById('profileApiKeyInput').value.trim();
  if(key)apiKeys[profileTempProvider]=key;
  // 검증 엔진 LLM 3슬롯을 apiKeys 로 최종 확정(양방향 미러로 이미 동기지만 방어적 재확인) — L-T2
  REVIEW_PROVIDERS.forEach(p=>{const el=document.getElementById(LLM_SLOT_IDS[p]);if(el)apiKeys[p]=(el.value||'').trim();});
  selectProvider(profileTempProvider);
  // 기존 프로필의 추가 필드(kipris 등) 보존
  let existing={};
  try{existing=JSON.parse(currentProfile?.api_key_encrypted||'{}');}catch(e){}
  const data={...existing,...apiKeys,provider:selectedProvider,roleAssignments}; // 역할배정 보존(L-T1, KIPRIS 등 기존 필드는 ...existing 로 유지)
  try{Object.entries(apiKeys).forEach(([p,k])=>{if(k)localStorage.setItem('patent_api_key_'+p,k);});localStorage.setItem('patent_api_provider',selectedProvider);}catch(e){}
  if(currentUser){await sb.from('profiles').update({api_key_encrypted:JSON.stringify(data)}).eq('id',currentUser.id);currentProfile.api_key_encrypted=JSON.stringify(data);}
  closeProfileSettings();updateModelToggle();updateProviderLabel();
  refreshClaudeModels(true); // 새 키로 최신 모델 즉시 갱신
  showToast(API_PROVIDERS[selectedProvider].short+' 적용됨 · '+getModelConfig().label);
}

// ═══ 검증 엔진 LLM 역할배정 데이터 계층 (L-T1) ═══════════════════════════
//   api_key_encrypted JSON 에 roleAssignments 만 얹는다(DB 마이그레이션 0, KIPRIS/키 로직 불변).
//   순수 함수: 인자 미지정 시 모듈 라이브 상태(apiKeys/roleAssignments)를 읽고, 인자 주면 그것으로 계산(테스트·재사용).
const REVIEW_ROLES=['examiner_A','examiner_B','examiner_C','attorney_author','attorney_reviewer','domain_expert'];
const REVIEW_PROVIDERS=['claude','gpt','gemini'];

// 입력된(비어있지 않은) LLM provider 키만 {provider:key} 로 — Edge body(L-T3) 전송용. kipris 등은 제외.
function getProviderKeys(keys){
  const src=keys||apiKeys||{};const out={};
  REVIEW_PROVIDERS.forEach(p=>{const k=((src[p]!=null?src[p]:'')+'').trim();if(k)out[p]=k;});
  return out;
}
// 키가 입력된 provider 목록(개수 세기·토글용).
function getEnteredProviders(keys){return Object.keys(getProviderKeys(keys));}

// ★ 역할배정 — "1키 전역적용" 규칙 내장(UI·Edge 어디서 부르든 일관).
//   0개 → {} (검증 불가; UI 가 차단) / 1개 → 6역할 전부 그 provider / 2개+ → 저장 배정(키 없는 provider 는 첫 입력키로 교정).
function getRoleAssignments(keys,assignments){
  const entered=getEnteredProviders(keys);
  if(entered.length===0)return {};
  const m={};
  if(entered.length===1){const only=entered[0];REVIEW_ROLES.forEach(r=>{m[r]=only;});return m;}
  const stored=(assignments||roleAssignments||{});
  REVIEW_ROLES.forEach(r=>{const a=stored[r];m[r]=(a&&entered.indexOf(a)>=0)?a:entered[0];}); // 유효(키 보유)하면 사용, 아니면 첫 입력키
  return m;
}
// 역할 1건 배정(메모리). roleId·provider 검증 후 반영.
function setRoleAssignment(roleId,provider){
  if(REVIEW_ROLES.indexOf(roleId)<0||REVIEW_PROVIDERS.indexOf(provider)<0)return false;
  roleAssignments[roleId]=provider;return true;
}
// 역할배정 영속 — 기존 KIPRIS/키 JSON 보존(saveProfileSettings 와 동일 머지 패턴).
async function saveRoleAssignments(map){
  if(map&&typeof map==='object')Object.keys(map).forEach(r=>setRoleAssignment(r,map[r]));
  let existing={};try{existing=JSON.parse(currentProfile?.api_key_encrypted||'{}');}catch(e){}
  const data={...existing,roleAssignments};
  if(currentUser){await sb.from('profiles').update({api_key_encrypted:JSON.stringify(data)}).eq('id',currentUser.id);currentProfile.api_key_encrypted=JSON.stringify(data);}
  return getRoleAssignments();
}

// 검증 엔진 Edge 전송용 인증 묶음(L-T3) — getProviderKeys(입력 키만)+getRoleAssignments("1키 전역" 규칙 자동 적용).
//   ★ 보안: 반환값(keys)은 HTTPS body 로 자기 Edge(review-orchestrate)에만 전달한다.
//     절대 console.log/localStorage/에러메시지에 남기지 말 것(키 노출 사고 방지). 호출측도 keys 를 로깅 금지.
function getReviewAuth(){ return { keys: getProviderKeys(), assignments: getRoleAssignments() }; }

// ═══ 검증 엔진 LLM 설정 UI (L-T2) — 규칙은 L-T1 헬퍼가 진실원천(UI 재구현 0) ═══════════
const REVIEW_ROLE_LABELS={
  examiner_A:'심사관 A — 진보성·신규성 (§29)',
  examiner_B:'심사관 B — 기재불비·뒷받침 (§42)',
  examiner_C:'심사관 C — 청구범위·단일성 (§45)',
  attorney_author:'출원인측 변리사 — 방어·보정방향',
  attorney_reviewer:'독립검토 변리사 — 교차검증',
  domain_expert:'기술분야 전문가 — 실시가능성'
};
const LLM_SLOT_IDS={claude:'llmKeyClaude',gpt:'llmKeyGpt',gemini:'llmKeyGemini'};

// 3슬롯 입력 → apiKeys 단일 라이브 소스 갱신 + (선택 provider면) 기존 단일입력에 미러 + 실시간 토글 갱신.
function onLlmKeyInput(provider,value){
  if(REVIEW_PROVIDERS.indexOf(provider)<0)return;
  apiKeys[provider]=(value||'').trim();
  if(provider===profileTempProvider){const oi=document.getElementById('profileApiKeyInput');if(oi&&oi.value!==value)oi.value=value;}
  renderLlmRoleArea();
}
// 기존 단일입력 → apiKeys + (일치 provider) 3슬롯 미러 (양방향 동기로 이중소스 충돌 차단).
function onProfileApiKeyMirror(value){
  apiKeys[profileTempProvider]=(value||'').trim();
  const el=document.getElementById(LLM_SLOT_IDS[profileTempProvider]);if(el&&el.value!==value)el.value=value;
  renderLlmRoleArea();
}
// 역할 드롭다운 변경 → L-T1 setRoleAssignment(검증·메모리 반영). 영속은 저장 시.
function onLlmRoleChange(roleId,provider){setRoleAssignment(roleId,provider);}

// 3슬롯 pre-fill(apiKeys 기준) — 모달 열 때 호출.
function fillLlmKeySlots(){
  REVIEW_PROVIDERS.forEach(p=>{const el=document.getElementById(LLM_SLOT_IDS[p]);if(el)el.value=apiKeys[p]||'';});
}
// ★ 키개수 토글 — getEnteredProviders/getRoleAssignments(L-T1) 가 규칙의 진실원천.
function renderLlmRoleArea(){
  const el=document.getElementById('llmRoleArea');if(!el)return;
  const entered=getEnteredProviders(); // 라이브 apiKeys 기준
  if(entered.length===0){
    el.innerHTML='<div style="font-size:12px;color:var(--color-text-tertiary);padding:10px;background:var(--color-bg-secondary);border-radius:8px">검증 LLM 키를 1개 이상 입력하세요. (미입력 시 출원 전 검증 사용 불가)</div>';
    return;
  }
  if(entered.length===1){
    const only=entered[0];const label=(API_PROVIDERS[only]&&API_PROVIDERS[only].short)||only;
    el.innerHTML='<div style="font-size:12px;color:var(--color-success);padding:10px;background:var(--color-bg-secondary);border-radius:8px">✓ <strong>'+escapeHtml(label)+'</strong> 단독 — 6역할 전체 자동 적용됨 (편향상쇄 없음)</div>';
    return; // ★ 1키: 드롭다운 완전 숨김 → 사용자가 안 골라도 전역 적용
  }
  // 2개+ : 6역할 드롭다운 (옵션 = 입력된 provider 만)
  const assign=getRoleAssignments();
  const optHtml=function(sel){return entered.map(function(p){const lab=(API_PROVIDERS[p]&&API_PROVIDERS[p].short)||p;return '<option value="'+p+'"'+(p===sel?' selected':'')+'>'+escapeHtml(lab)+'</option>';}).join('');};
  el.innerHTML='<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:8px">역할별 LLM 배정 ('+entered.length+'개 provider · 편향상쇄)</div>'+
    REVIEW_ROLES.map(function(r){
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="flex:1;font-size:12px;color:var(--color-text-secondary)">'+escapeHtml(REVIEW_ROLE_LABELS[r]||r)+'</span>'+
        '<select class="input-field" style="width:128px;flex-shrink:0;padding:6px" onchange="onLlmRoleChange(\''+r+'\',this.value)">'+optHtml(assign[r])+'</select></div>';
    }).join('');
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
async function callClaude(prompt,maxTokens=8192){
  if(!ensureApiKey()){openProfileSettings();throw new Error('API Key를 먼저 입력해 주세요');}
  const prov=selectedProvider,mc=getModelConfig();
  const req=buildAPIRequest(prov,selectedModel,SYSTEM_PROMPT,prompt,maxTokens);
  const ctrl=new AbortController(),tout=setTimeout(()=>ctrl.abort(),180000);
  try{const res=await fetch(req.url,{method:'POST',signal:ctrl.signal,headers:req.headers,body:JSON.stringify(req.body)});clearTimeout(tout);
    if(res.status===401||res.status===403){apiKeys[prov]='';API_KEY='';showToast('API Key가 유효하지 않습니다. ⚙️ 계정설정을 확인하세요.','error');throw new Error('API Key 유효하지 않음');}
    if(res.status===429)throw new Error('요청 과다. 30초 후 재시도');if(res.status>=500)throw new Error('서버 오류');
    const d=await res.json(),parsed=parseAPIResponse(prov,d);
    if(typeof usage!=='undefined'){usage.calls++;usage.inputTokens+=parsed.it;usage.outputTokens+=parsed.ot;
    usage.cost+=(parsed.it*mc.inputCost/1e6)+(parsed.ot*mc.outputCost/1e6);}
    if(typeof updateStats==='function')updateStats();
    return{text:parsed.text,stopReason:parsed.stopReason};
  }catch(e){clearTimeout(tout);if(e.name==='AbortError')throw new Error('타임아웃(3분)');throw e;}
}
async function callClaudeSonnet(prompt,maxTokens=8192){
  if(!ensureApiKey()){openProfileSettings();throw new Error('API Key를 먼저 입력해 주세요');}
  const prov=selectedProvider,cheapKey=API_PROVIDERS[prov].cheapModel,mc=API_PROVIDERS[prov].models[cheapKey];
  const req=buildAPIRequest(prov,cheapKey,SYSTEM_PROMPT,prompt,maxTokens);
  const ctrl=new AbortController(),tout=setTimeout(()=>ctrl.abort(),180000);
  try{const res=await fetch(req.url,{method:'POST',signal:ctrl.signal,headers:req.headers,body:JSON.stringify(req.body)});clearTimeout(tout);
    if(res.status===401||res.status===403)throw new Error('API Key 유효하지 않음');
    if(res.status===429)throw new Error('요청 과다');if(res.status>=500)throw new Error('서버 오류');
    const d=await res.json(),parsed=parseAPIResponse(prov,d);
    if(typeof usage!=='undefined'){usage.calls++;usage.inputTokens+=parsed.it;usage.outputTokens+=parsed.ot;
    usage.cost+=(parsed.it*mc.inputCost/1e6)+(parsed.ot*mc.outputCost/1e6);}
    return{text:parsed.text,stopReason:parsed.stopReason};
  }catch(e){clearTimeout(tout);if(e.name==='AbortError')throw new Error('타임아웃');throw e;}
}
async function callClaudeWithContinuation(prompt,pid){let full='',r=await callClaude(prompt),a=0;full=r.text;while(a<6&&r.stopReason==='max_tokens'){a++;showProgress(pid,`이어서 작성 중... (${a}/6)`,a,6);r=await callClaude(`아래 [마지막 부분]의 텍스트가 중간에 잘려 있다. 잘린 지점의 바로 다음부터 이어서 작성하라.\n- 마지막 단어가 불완전하면 해당 단어의 나머지 글자부터 시작하라.\n- [마지막 부분]의 내용을 반복하지 마라. 동일 문체.\n\n[마지막 부분]\n${full.slice(-2000)}`);const lc=full.slice(-1),fc=r.text[0]||'';if(/[가-힯a-zA-Z0-9]/.test(lc)&&/[가-힯a-zA-Z0-9]/.test(fc))full+=r.text;else full+='\n'+r.text;}clearProgress(pid);return full;}

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
  apiKeys,
  getProvider, getModelConfig, getModel, selectModel, selectProvider,
  updateModelToggle, updateProviderLabel, refreshClaudeModels, buildAPIRequest, parseAPIResponse,
  escapeHtml, showToast, showProgress, clearProgress, setButtonLoading,
  showScreen, ensureApiKey, callClaude, callClaudeSonnet, callClaudeWithContinuation,
  extractTextFromFile, extractPdfText, extractDocxText, extractXlsxText, formatFileSize,
  openProfileSettings, closeProfileSettings,
  REVIEW_ROLES, REVIEW_PROVIDERS, getProviderKeys, getEnteredProviders, getRoleAssignments, setRoleAssignment, saveRoleAssignments, getReviewAuth,
  REVIEW_ROLE_LABELS, onLlmKeyInput, onProfileApiKeyMirror, onLlmRoleChange, fillLlmKeySlots, renderLlmRoleArea,
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

  // 사건등록 모듈 초기화
  if (service === 'docket' && window.Docket && typeof Docket.init === 'function') {
    Docket.init();
  }

  // URL 해시 업데이트
  history.replaceState(null, '', '#' + service);
};

// ═══ Trademark Sub-Tab Switching (상표 출원 / 우선심사) ═══
App.switchTrademarkSubTab = function(sub) {
  document.querySelectorAll('.trademark-sub-tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.subtab === sub);
  });
  document.querySelectorAll('.trademark-sub-panel').forEach(function(p) {
    p.classList.remove('active');
  });
  var el = document.getElementById('trademark-sub-' + sub);
  if (el) el.classList.add('active');

  // 우선심사 탭 초기화
  if (sub === 'priority' && window.TM && typeof TM.initPriorityTab === 'function') {
    TM.initPriorityTab();
  }
  // 상표 출원 탭 복귀 시 대시보드 갱신
  if (sub === 'application' && window.TM && typeof TM.renderDashboard === 'function') {
    TM.renderDashboard(true);
  }

  history.replaceState(null, '', '#trademark-' + sub);
};

App.initServiceTabs = function() {
  var hash = window.location.hash.replace('#', '');
  if (hash === 'docket') {
    App.switchService('docket');
  } else if (hash === 'trademark' || hash.startsWith('trademark-')) {
    App.switchService('trademark');
    if (hash.startsWith('trademark-')) {
      var tmSub = hash.replace('trademark-', '');
      if (tmSub && typeof App.switchTrademarkSubTab === 'function') {
        App.switchTrademarkSubTab(tmSub);
      }
    }
  } else if (hash.startsWith('patent-')) {
    App.switchService('patent');
    var subTab = hash.replace('patent-', '');
    if (subTab && typeof App.switchPatentSubTab === 'function') {
      App.switchPatentSubTab(subTab);
    }
  } else {
    App.switchService('patent');
  }
};
