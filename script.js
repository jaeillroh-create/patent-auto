/* ═══════════════════════════════════════════════════════════
   특허명세서 자동 생성 v4.3 — All Fixes
   ═══════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://uvrzwhfjtzqujawmscca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2cnp3aGZqdHpxdWphd21zY2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTEwNDgsImV4cCI6MjA4NTUyNzA0OH0.JSSPMPIHsXfbNm6pgRzCTGH7aNQATl-okIkcXHl7Mkk';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MODEL = 'claude-opus-4-5-20251101';
const SYSTEM_PROMPT = '너는 20년 경력의 한국 변리사이다. 원칙: 1.표준문체(~한다) 2.글머리/마크다운 절대금지 3.SW명 대신 알고리즘 4.구성요소명(참조번호) 형태 5.명세서에 바로 붙여넣을 순수텍스트 6.제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지';

let API_KEY='',currentUser=null,currentProfile=null,currentProjectId=null;
let outputs={},selectedTitle='',selectedTitleType='',includeMethodClaims=true;
let usage={calls:0,inputTokens:0,outputTokens:0},loadingState={};
// 검토 반영 전 상태 저장용
let beforeReviewText = '';

const STEP_NAMES={step_01:'발명의 명칭',step_02:'기술분야',step_03:'배경기술',step_04:'선행기술문헌',step_05:'해결하고자 하는 과제',step_06:'장치 청구항',step_07:'도면 설계',step_08:'장치 상세설명',step_09:'수학식',step_10:'방법 청구항',step_11:'방법 도면',step_12:'방법 상세설명',step_13:'검토',step_14:'대안 청구항',step_15:'기재불비',step_16:'발명의 효과',step_17:'과제의 해결 수단',step_18:'부호의 설명',step_19:'요약서'};

// ═══════════ UTILITIES ═══════════
function escapeHtml(t){if(!t)return '';return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
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
    case 'dashboard':document.getElementById('screenDashboard').style.display='block';document.getElementById('screenDashboard').classList.add('active');loadDashboardProjects();break;
    case 'main':document.getElementById('screenMain').style.display='block';document.getElementById('screenMain').classList.add('active');break;
    case 'admin':document.getElementById('adminPanel').style.display='block';document.getElementById('adminPanel').classList.add('active');loadAdminUsers();break;
  }
}

// ═══════════ STATE MANAGEMENT ═══════════
function clearAllState(){
  currentProjectId=null;outputs={};selectedTitle='';selectedTitleType='';includeMethodClaims=true;
  usage={calls:0,inputTokens:0,outputTokens:0};loadingState={};beforeReviewText='';uploadedFiles=[];
  const ids=['projectInput','titleInput'];ids.forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['titleConfirmArea','titleConfirmMsg','batchArea'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  for(let i=1;i<=19;i++){const e=document.getElementById(`resultStep${String(i).padStart(2,'0')}`);if(e)e.innerHTML='';}
  ['resultsBatch25','resultsBatchFinish','validationResults','previewArea','diagramsStep07','diagramsStep11','fileList'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='';});
  ['btnApplyReview','btnPptx07','reviewApplyResult'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.querySelectorAll('.tab-item').forEach((t,i)=>{t.classList.toggle('active',i===0);t.setAttribute('aria-selected',i===0);});
  document.querySelectorAll('.page').forEach((p,i)=>p.classList.toggle('active',i===0));
  const mt=document.getElementById('methodToggle');if(mt){mt.checked=true;toggleMethod();}
  document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));
  const b01=document.getElementById('btnStep01');if(b01)b01.disabled=true;
  updateStats();
}

// ═══════════ AUTH ═══════════
function switchAuthTab(tab){document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));if(tab==='login'){document.querySelector('.auth-tab:first-child').classList.add('active');document.getElementById('authLogin').style.display='block';document.getElementById('authSignup').style.display='none';}else{document.querySelector('.auth-tab:last-child').classList.add('active');document.getElementById('authLogin').style.display='none';document.getElementById('authSignup').style.display='block';}}
async function handleLogin(){const e=document.getElementById('loginEmail').value.trim(),p=document.getElementById('loginPassword').value;if(!e||!p){showToast('이메일과 비밀번호를 입력해 주세요','error');return;}setButtonLoading('btnLogin',true);const{data,error}=await sb.auth.signInWithPassword({email:e,password:p});setButtonLoading('btnLogin',false);if(error){showToast(error.message,'error');return;}await onAuthSuccess(data.user);}
async function handleSignup(){const e=document.getElementById('signupEmail').value.trim(),p=document.getElementById('signupPassword').value,n=document.getElementById('signupName').value.trim();if(!e||!p){showToast('이메일과 비밀번호를 입력해 주세요','error');return;}if(p.length<6){showToast('비밀번호는 6자 이상','error');return;}setButtonLoading('btnSignup',true);const{data,error}=await sb.auth.signUp({email:e,password:p,options:{data:{display_name:n||e}}});setButtonLoading('btnSignup',false);if(error){showToast(error.message,'error');return;}showToast('회원가입 완료!');if(data.user)await onAuthSuccess(data.user);}
async function handleLogout(){clearAllState();sessionStorage.removeItem('pk');API_KEY='';await sb.auth.signOut();currentUser=null;currentProfile=null;showScreen('auth');}
async function onAuthSuccess(user){
  currentUser=user;let{data:profile}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(!profile){const{data:np,error}=await sb.from('profiles').insert({id:user.id,display_name:user.user_metadata?.display_name||user.email,role:'user',status:'pending',tos_accepted:false}).select('*').single();if(error){showToast('프로필 생성 실패','error');return;}profile=np;}
  currentProfile=profile;
  if(!profile.tos_accepted){showScreen('tos');return;}if(profile.status==='pending'){showScreen('pending');return;}if(profile.status==='suspended'){showToast('계정 정지됨','error');return;}
  const dn=document.getElementById('dashUserName');if(dn)dn.textContent=profile.display_name||user.email;
  if(profile.role==='admin'){const ab=document.getElementById('btnDashAdmin');if(ab)ab.style.display='inline-flex';}
  API_KEY=sessionStorage.getItem('pk')||'';clearAllState();showScreen('dashboard');
}
async function handleTosAccept(){if(!document.getElementById('tosCheck1').checked||!document.getElementById('tosCheck2').checked){showToast('모든 항목에 동의해 주세요','error');return;}await sb.from('profiles').update({tos_accepted:true,tos_accepted_at:new Date().toISOString()}).eq('id',currentUser.id);currentProfile.tos_accepted=true;if(currentProfile.status==='pending')showScreen('pending');else await onAuthSuccess(currentUser);}
async function checkApprovalStatus(){const{data}=await sb.from('profiles').select('status').eq('id',currentUser.id).single();if(data?.status==='approved')await onAuthSuccess(currentUser);else showToast('아직 승인 대기 중','info');}
function saveApiKey(){const k=document.getElementById('apiKeyInput').value.trim();if(!k){showToast('API Key를 입력해 주세요','error');return;}API_KEY=k;sessionStorage.setItem('pk',k);document.getElementById('apiKeyModal').style.display='none';showToast('API Key 설정 완료');}

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
    return `<div class="card" style="margin-bottom:12px;cursor:pointer;transition:box-shadow 0.15s" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='var(--shadow-sm)'" onclick="openProject('${p.id}')"><div style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.title)}</div><div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">생성 ${new Date(p.created_at).toLocaleDateString('ko-KR')} · 수정 ${new Date(p.updated_at).toLocaleDateString('ko-KR')}</div></div><div style="display:flex;gap:6px;margin-left:12px;flex-shrink:0"><span class="badge ${pct===100?'badge-success':pct>0?'badge-primary':'badge-neutral'}">${c}/19 (${pct}%)</span><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();confirmDeleteProject('${p.id}','${escapeHtml(p.title).replace(/'/g,"\\'")}')">🗑️</button></div></div><div class="progress-bar-bg" style="margin-top:10px;height:4px"><div class="progress-bar-fill" style="width:${pct}%;height:4px"></div></div></div></div>`;
  }).join('');
}
function openNewProjectModal(){document.getElementById('newProjectTitle').value='';document.getElementById('newProjectModal').style.display='flex';document.getElementById('newProjectTitle').focus();}
function closeNewProjectModal(){document.getElementById('newProjectModal').style.display='none';}
async function createAndOpenProject(){const t=document.getElementById('newProjectTitle').value.trim();if(!t){showToast('사건명을 입력해 주세요','error');return;}const{data,error}=await sb.from('projects').insert({owner_user_id:currentUser.id,title:t,invention_content:'',current_state_json:{outputs:{},selectedTitle:'',selectedTitleType:'',includeMethodClaims:true,usage:{calls:0,inputTokens:0,outputTokens:0}}}).select('id').single();if(error){showToast('생성 실패','error');return;}closeNewProjectModal();await openProject(data.id);}
async function openProject(pid){
  clearAllState();const{data}=await sb.from('projects').select('*').eq('id',pid).single();if(!data){showToast('불러올 수 없어요','error');return;}
  currentProjectId=data.id;document.getElementById('projectInput').value=data.invention_content||'';
  const s=data.current_state_json||{};outputs=s.outputs||{};selectedTitle=s.selectedTitle||'';selectedTitleType=s.selectedTitleType||'';includeMethodClaims=s.includeMethodClaims!==false;usage=s.usage||{calls:0,inputTokens:0,outputTokens:0};
  document.getElementById('methodToggle').checked=includeMethodClaims;toggleMethod();
  if(selectedTitle){document.getElementById('titleInput').value=selectedTitle;document.getElementById('titleConfirmArea').style.display='block';document.getElementById('titleConfirmMsg').style.display='block';document.getElementById('batchArea').style.display='block';}
  Object.keys(outputs).forEach(k=>{if(outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied'))renderOutput(k,outputs[k]);});
  document.getElementById('headerProjectName').textContent=data.title;document.getElementById('headerUserName').textContent=currentProfile?.display_name||currentUser?.email||'';
  if(currentProfile?.role==='admin')document.getElementById('btnAdmin').style.display='inline-flex';
  updateStats();if(!API_KEY)document.getElementById('apiKeyModal').style.display='flex';
  showScreen('main');showToast(`"${data.title}" 열림`);
}
async function backToDashboard(){if(currentProjectId)await saveProject(true);clearAllState();showScreen('dashboard');}
async function confirmDeleteProject(id,t){if(!confirm(`"${t}" 사건을 삭제하시겠어요?`))return;await sb.from('projects').delete().eq('id',id);showToast('삭제됨');loadDashboardProjects();}
async function saveProject(silent=false){if(!currentProjectId)return;const t=selectedTitle||document.getElementById('projectInput').value.slice(0,30)||'새 사건';await sb.from('projects').update({title:t,invention_content:document.getElementById('projectInput').value,current_state_json:{outputs,selectedTitle,selectedTitleType,includeMethodClaims,usage}}).eq('id',currentProjectId);if(!silent)showToast('저장됨');}

// ═══════════ TAB & TOGGLES ═══════════
function switchTab(i){document.querySelectorAll('.tab-item').forEach((t,j)=>{t.classList.toggle('active',j===i);t.setAttribute('aria-selected',j===i);});document.querySelectorAll('.page').forEach((p,j)=>p.classList.toggle('active',j===i));if(i===4)renderPreview();}
function toggleMethod(){includeMethodClaims=document.getElementById('methodToggle').checked;['methodClaimsCard','methodDiagramCard','methodDescCard'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.toggle('card-disabled',!includeMethodClaims);});}
function selectTitleType(el,type){document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selectedTitleType=type;document.getElementById('btnStep01').disabled=false;}
function selectTitle(el,kr,en){document.querySelectorAll('#resultStep01 .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selectedTitle=kr;document.getElementById('titleInput').value=kr;document.getElementById('titleConfirmArea').style.display='block';document.getElementById('titleConfirmMsg').style.display='block';document.getElementById('batchArea').style.display='block';}
function onTitleInput(){const v=document.getElementById('titleInput').value.trim();document.querySelectorAll('#resultStep01 .selection-card').forEach(c=>c.classList.remove('selected'));selectedTitle=v;document.getElementById('titleConfirmMsg').style.display=v?'block':'none';document.getElementById('batchArea').style.display=v?'block':'none';}

// ═══════════ API ═══════════
async function callClaude(prompt,maxTokens=8192){
  if(!API_KEY){document.getElementById('apiKeyModal').style.display='flex';throw new Error('API Key 필요');}
  const ctrl=new AbortController(),tout=setTimeout(()=>ctrl.abort(),120000);
  try{const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ctrl.signal,headers:{'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:MODEL,max_tokens:maxTokens,system:SYSTEM_PROMPT,messages:[{role:'user',content:prompt}]})});clearTimeout(tout);
    if(res.status===401){sessionStorage.removeItem('pk');API_KEY='';document.getElementById('apiKeyModal').style.display='flex';throw new Error('API Key 유효하지 않음');}
    if(res.status===429)throw new Error('요청 과다. 30초 후 재시도');if(res.status>=500)throw new Error('서버 오류');
    const d=await res.json();if(d.error)throw new Error(d.error.message);usage.calls++;usage.inputTokens+=(d.usage?.input_tokens||0);usage.outputTokens+=(d.usage?.output_tokens||0);updateStats();
    return{text:d.content[0].text,stopReason:d.stop_reason};
  }catch(e){clearTimeout(tout);if(e.name==='AbortError')throw new Error('타임아웃');throw e;}
}
async function callClaudeWithContinuation(prompt,pid){let full='',r=await callClaude(prompt),a=0;full=r.text;while(a<4&&r.stopReason==='max_tokens'){a++;showProgress(pid,`이어서 작성 중... (${a}/4)`,a,4);r=await callClaude(`아래 특허명세서 뒷부분을 이어서 작성. 앞부분 반복 금지. 동일 문체.\n\n[마지막]\n${full.slice(-2000)}`);full+='\n'+r.text;}clearProgress(pid);return full;}

// ═══════════ HELPERS ═══════════
function getLatestDescription(){return outputs.step_13_applied||outputs.step_09||outputs.step_08||'';}
function getLastClaimNumber(t){const m=t.match(/【청구항\s*(\d+)】/g);if(!m)return 0;return Math.max(...m.map(x=>parseInt(x.match(/(\d+)/)[1])));}
function getLastFigureNumber(t){const m=t.match(/도\s*(\d+)/g);if(!m)return 0;return Math.max(...m.map(x=>parseInt(x.match(/(\d+)/)[1])));}
function extractBriefDescriptions(s07,s11){const d=[];[s07,s11].forEach(t=>{if(!t)return;const i=t.indexOf('---BRIEF_DESCRIPTIONS---');if(i>=0)t.slice(i+24).trim().split('\n').filter(l=>l.trim().startsWith('도 ')).forEach(l=>d.push(l.trim()));else t.split('\n').filter(l=>/^도\s*\d+은?\s/.test(l.trim())).forEach(l=>d.push(l.trim()));});return d.join('\n');}
function stripKoreanParticles(w){if(!w||w.length<2)return w;const ps=['에서는','으로써','에서','으로','에게','부터','까지','에는','하는','되는','된','하여','있는','없는','같은','통하여','위한','대한','의한','를','을','이','가','은','는','에','의','와','과','로','도','든','인','적','로서'];for(const p of ps){if(w.endsWith(p)&&w.length>p.length+1)return w.slice(0,-p.length);}return w;}

// ═══════════ FILE UPLOAD ═══════════
let uploadedFiles = []; // {name, text, size}

async function handleFileUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const listEl = document.getElementById('fileList');

  for (const file of files) {
    // 중복 체크
    if (uploadedFiles.find(f => f.name === file.name)) {
      showToast(`"${file.name}" 이미 추가됨`, 'info');
      continue;
    }

    const item = document.createElement('div');
    item.className = 'file-upload-item';
    item.id = `file_${uploadedFiles.length}`;
    item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:6px;font-size:13px';
    item.innerHTML = `<span class="tossface">📄</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(file.name)}</span><span class="badge badge-neutral">${formatFileSize(file.size)}</span><span style="color:var(--color-primary)">추출 중...</span>`;
    listEl.appendChild(item);

    try {
      const text = await extractTextFromFile(file);
      if (text && text.trim()) {
        uploadedFiles.push({ name: file.name, text: text.trim(), size: file.size });

        // 텍스트 영역에 추가
        const ta = document.getElementById('projectInput');
        const separator = ta.value.trim() ? '\n\n' : '';
        ta.value += `${separator}[첨부: ${file.name}]\n${text.trim()}`;

        item.innerHTML = `<span class="tossface">✅</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(file.name)}</span><span class="badge badge-success">${formatFileSize(file.size)} · ${text.trim().length.toLocaleString()}자</span><button class="btn btn-ghost btn-sm" onclick="removeUploadedFile(${uploadedFiles.length - 1},'${escapeHtml(file.name).replace(/'/g, "\\'")}')">✕</button>`;
        showToast(`"${file.name}" 텍스트 추출 완료 (${text.trim().length.toLocaleString()}자)`);
      } else {
        item.innerHTML = `<span class="tossface">⚠️</span><span style="flex:1">${escapeHtml(file.name)}</span><span class="badge badge-warning">텍스트 추출 불가</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>`;
        showToast(`"${file.name}" 텍스트를 추출할 수 없어요`, 'error');
      }
    } catch (e) {
      item.innerHTML = `<span class="tossface">❌</span><span style="flex:1">${escapeHtml(file.name)}</span><span class="badge badge-error">오류</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>`;
      showToast(`"${file.name}" 처리 실패: ${e.message}`, 'error');
    }
  }
  // 입력 초기화 (같은 파일 재선택 가능)
  event.target.value = '';
}

function removeUploadedFile(idx, name) {
  const f = uploadedFiles[idx];
  if (!f) return;
  // textarea에서 해당 파일 텍스트 제거
  const ta = document.getElementById('projectInput');
  const marker = `[첨부: ${f.name}]`;
  const mIdx = ta.value.indexOf(marker);
  if (mIdx >= 0) {
    // 마커부터 다음 마커 또는 끝까지 제거
    const nextMarker = ta.value.indexOf('\n\n[첨부:', mIdx + marker.length);
    const endIdx = nextMarker >= 0 ? nextMarker : ta.value.length;
    ta.value = (ta.value.slice(0, mIdx) + ta.value.slice(endIdx)).trim();
  }
  uploadedFiles.splice(idx, 1);
  const el = document.getElementById(`file_${idx}`);
  if (el) el.remove();
  showToast(`"${name}" 제거됨`);
}

async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const buf = await file.arrayBuffer();

  switch (ext) {
    case 'txt':
    case 'md':
    case 'csv':
    case 'json':
    case 'rtf':
      return new TextDecoder('utf-8').decode(buf);

    case 'pdf':
      return await extractPdfText(buf);

    case 'docx':
    case 'doc':
      return await extractDocxText(buf);

    case 'xlsx':
    case 'xls':
      return extractXlsxText(buf);

    case 'pptx':
    case 'ppt':
      return await extractPptxText(buf);

    case 'hwp':
    case 'hwpx':
      // HWP는 브라우저에서 직접 파싱 어려움 — 안내
      return '[HWP 파일은 자동 추출이 지원되지 않습니다. 한글에서 텍스트를 복사하여 직접 붙여넣어 주세요.]';

    default:
      // 일단 텍스트로 시도
      try { return new TextDecoder('utf-8').decode(buf); } catch { return ''; }
  }
}

async function extractPdfText(buf) {
  if (!window.pdfjsLib) return '[PDF.js 미로드]';
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

async function extractDocxText(buf) {
  if (!window.mammoth) return '[mammoth.js 미로드]';
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

function extractXlsxText(buf) {
  if (!window.XLSX) return '[XLSX.js 미로드]';
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  let text = '';
  wb.SheetNames.forEach(name => {
    text += `[시트: ${name}]\n`;
    const ws = wb.Sheets[name];
    text += XLSX.utils.sheet_to_csv(ws) + '\n\n';
  });
  return text;
}

async function extractPptxText(buf) {
  // PPTX = ZIP containing XML slides
  // Simple approach: use JSZip-like approach via XLSX's zip reader
  try {
    if (!window.XLSX) return '[XLSX.js 미로드]';
    const zip = XLSX.read(new Uint8Array(buf), { type: 'array', bookSheets: true });
    // Fallback: 텍스트로 반환
    return '[PPTX 파일의 텍스트 자동 추출은 제한적입니다. 주요 내용을 직접 붙여넣어 주세요.]';
  } catch {
    return '[PPTX 텍스트 추출 실패]';
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

// ═══════════ PROMPTS (v4.4) ═══════════
function buildPrompt(stepId){
  const inv=document.getElementById('projectInput').value,T=selectedTitle;
  switch(stepId){
    case 'step_01':return `프로젝트를 분석하여 특허 발명의 명칭 후보를 5가지 생성하라.\n형태: "~${selectedTitleType}"\n각 후보에 국문+영문.\n\n출력형식:\n[1] 국문: (명칭) / 영문: (명칭)\n[2] 국문: (명칭) / 영문: (명칭)\n[3] 국문: (명칭) / 영문: (명칭)\n[4] 국문: (명칭) / 영문: (명칭)\n[5] 국문: (명칭) / 영문: (명칭)\n\n[프로젝트]\n${inv}`;
    case 'step_02':return `【기술분야】를 작성. "본 발명은 ~에 관한 것이다." 한 문장만. 20단어. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}`;
    case 'step_03':return `【발명의 배경이 되는 기술】을 작성. 3문단(기존문제/최근동향/필요성), 각 150단어. 번호 없이. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}\n[프로젝트] ${inv}`;
    // FIX: 선행기술문헌 딱 1건만
    case 'step_04':return `【선행기술문헌】작성.\n규칙: 다른 항목 포함 금지. 헤더 금지. 관련 한국 특허 딱 1건만 기재.\n출력:\n【특허문헌】\n(특허문헌 1) 한국등록특허 제__________호\n\n발명의 명칭: ${T}\n[프로젝트] ${inv}`;
    case 'step_05':return `【해결하고자 하는 과제】작성. "본 발명은 ~을 제공하는 것을 목적으로 한다." 50단어 이하. 마지막: "본 발명의 기술적 과제는 이상에서 언급한 기술적 과제로 제한되지 않으며, 언급되지 않은 또 다른 기술적 과제들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다." 헤더 금지.\n\n발명의 명칭: ${T}\n[배경기술] ${outputs.step_03||''}`;
    case 'step_06':{const i=document.getElementById('optDeviceIndep').value,d=document.getElementById('optDeviceDep').value;return `장치 청구범위. 독립항 ${i}개+종속항 ${d}개. "청구항 N에 있어서," 시작. 【청구항 1】형식. SW명 금지. 제한성 표현 금지.\n${T}\n[프로젝트] ${inv}`;}
    case 'step_07':{const f=document.getElementById('optDeviceFigures').value;return `청구범위 도면 ${f}개 설계.\n\n[파트1: 도면 설계]\n각 도면: 제목/유형, 구성요소+참조번호, 연결관계. 참조번호: 서버100번대, 단말200번대, 외부300번대.\n\n[파트2: 도면의 간단한 설명]\n---BRIEF_DESCRIPTIONS---\n도 1은 (명칭)(참조번호)의 (내용)을 나타내는 (블록도/구성도)이다.\n도 2는 ...\n\n파트2는 마커 이후 위 형식으로만. 명령문 포함 금지.\n\n${T}\n[청구범위] ${outputs.step_06||''}`;}
    // FIX: step_08 — 발명을 실시하기 위한 구체적인 내용만
    case 'step_08':return `아래 발명에 대한 【발명을 실시하기 위한 구체적인 내용】을 작성하라.

규칙:
- 이 항목만 작성. 기술분야, 배경기술, 과제, 효과 등 다른 항목 포함 금지.
- 서버(100)를 주어로 사용. "구성요소(참조번호)" 형태.
- 도면별 "도 N을 참조하면," 형태로 시작.
- 특허문체(~한다). 글머리 기호/마크다운 절대 금지.
- 청구항의 모든 구성요소를 빠짐없이 포함하여 설명하라. 절대 생략 금지.
- 각 핵심 구성요소에 대해 최소 1개의 변형 실시예를 포함하라.
- 제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.

★ 분량 규칙 (매우 중요):
- 도면 1개당 약 2,000자(공백 포함) 이상으로 설명하라.
- 총 분량은 8,000~10,000자(공백 포함)가 되어야 한다.
- 각 도면마다 구성요소의 기능, 동작 원리, 데이터 흐름, 상호 연동 관계를 상세히 설명하라.
- 구성요소 간 통신 프로토콜, 데이터 포맷, 처리 절차를 구체적으로 기술하라.
- 변형 실시예를 통해 다양한 구현 방식을 기술하라.
- 절대 축약하거나 요약하지 마라. 각 구성요소에 대해 충분하고 상세한 설명을 작성하라.

${T}\n[청구범위] ${outputs.step_06||''}\n[도면] ${outputs.step_07||''}\n[프로젝트] ${(inv||'').slice(0,3000)}`;
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
// FIX: Mermaid — 각진 화살표, 흑백, 겹침 방지
function buildMermaidPrompt(sid){
  const src=sid==='step_07'?outputs.step_07:outputs.step_11;
  return `도면을 Mermaid.js로 변환하라.

필수 규칙:
1. 각 도면별 \`\`\`mermaid 코드블록으로 출력
2. 블록도는 graph TD, 흐름도는 flowchart TD 사용
3. 한글 노드는 반드시 큰따옴표: A["서버(100)"]
4. 노드 ID는 영문/숫자만 사용 (한글 금지)
5. subgraph으로 그룹핑
6. 화살표: --> 사용 (직선/각진 형태)
7. 화살표 텍스트: A -->|"텍스트"| B
8. 스타일: 모든 노드에 흰색 배경 + 검은색 테두리 적용
   style 노드ID fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000
9. 노드 간 충분한 간격을 두어 텍스트가 겹치지 않도록 할 것
10. linkStyle로 화살표도 검은색으로 지정

[도면]
${src}`;
}

// ═══════════ STEP EXECUTION ═══════════
function checkDependency(s){const inv=document.getElementById('projectInput').value.trim();const d={step_01:()=>inv?null:'발명 내용을 먼저 입력',step_06:()=>selectedTitle?null:'명칭을 먼저 확정',step_07:()=>outputs.step_06?null:'장치 청구항 먼저',step_08:()=>(outputs.step_06&&outputs.step_07)?null:'도면 설계 먼저',step_09:()=>outputs.step_08?null:'상세설명 먼저',step_10:()=>outputs.step_06?null:'장치 청구항 먼저',step_11:()=>outputs.step_10?null:'방법 청구항 먼저',step_12:()=>(outputs.step_10&&outputs.step_11)?null:'방법 도면 먼저',step_13:()=>(outputs.step_06&&outputs.step_08)?null:'청구항+상세설명 먼저',step_14:()=>outputs.step_06?null:'장치 청구항 먼저',step_15:()=>outputs.step_06?null:'장치 청구항 먼저'};return d[s]?d[s]():null;}
async function runStep(sid){if(loadingState[sid])return;const dep=checkDependency(sid);if(dep){showToast(dep,'error');return;}const bm={step_01:'btnStep01',step_06:'btnStep06',step_10:'btnStep10',step_13:'btnStep13'},bid=bm[sid];loadingState[sid]=true;if(bid)setButtonLoading(bid,true);
  try{
    const r=await callClaude(buildPrompt(sid));outputs[sid]=r.text;renderOutput(sid,r.text);
    // Step 6: 자동 기재불비 검토 후 수정본 출력
    if(sid==='step_06'){
      showProgress('progressStep06','기재불비 자동 검증 중...',1,3);
      const issues=validateClaims(r.text);
      if(issues.length>0){
        showProgress('progressStep06','기재불비 수정 중...',2,3);
        const issueText=issues.map(i=>i.message).join('\n');
        const fixPrompt=`아래 청구범위에서 기재불비가 발견되었다. 모든 지적사항을 수정하여 완전한 청구범위 전체를 다시 출력하라.

수정 규칙:
- 【청구항 N】형식 유지
- "상기" 선행기재 누락: 참조하는 독립항에 해당 구성요소를 추가하거나, 종속항의 표현을 수정
- 제한적 표현("반드시", "~에 한하여" 등): 삭제 또는 비제한적 표현으로 교체
- 청구항 참조 오류: 올바른 청구항 번호로 수정
- 수정한 부분만 바꾸고 나머지는 원문 그대로 유지

[지적사항]
${issueText}

[원본 청구범위]
${r.text}`;
        const fixR=await callClaude(fixPrompt);
        outputs[sid]=fixR.text;
        renderOutput(sid,fixR.text);
        showProgress('progressStep06','기재불비 수정 완료',3,3);
        setTimeout(()=>clearProgress('progressStep06'),2000);
        showToast('장치 청구항 생성 + 기재불비 자동 수정 완료');
      }else{
        clearProgress('progressStep06');
        showToast('장치 청구항 완료 (기재불비 없음)');
      }
    }else{
      if(sid==='step_13')document.getElementById('btnApplyReview').style.display='block';
      showToast(`${STEP_NAMES[sid]} 완료`);
    }
  }catch(e){showToast(e.message,'error');}finally{loadingState[sid]=false;if(bid)setButtonLoading(bid,false);}}
async function runLongStep(sid){if(loadingState[sid])return;const dep=checkDependency(sid);if(dep){showToast(dep,'error');return;}const bid=sid==='step_08'?'btnStep08':'btnStep12',pid=sid==='step_08'?'progressStep08':'progressStep12';loadingState[sid]=true;setButtonLoading(bid,true);showProgress(pid,`${STEP_NAMES[sid]} 생성 중...`,0,1);try{const t=await callClaudeWithContinuation(buildPrompt(sid),pid);outputs[sid]=t;renderOutput(sid,t);showToast(`${STEP_NAMES[sid]} 완료`);}catch(e){showToast(e.message,'error');}finally{loadingState[sid]=false;setButtonLoading(bid,false);clearProgress(pid);}}
async function runMathInsertion(){if(loadingState.step_09)return;const dep=checkDependency('step_09');if(dep){showToast(dep,'error');return;}loadingState.step_09=true;setButtonLoading('btnStep09',true);try{const r=await callClaude(buildPrompt('step_09'));outputs.step_09=insertMathBlocks(outputs.step_08,r.text);renderOutput('step_09',outputs.step_09);showToast('수학식 삽입 완료');}catch(e){showToast(e.message,'error');}finally{loadingState.step_09=false;setButtonLoading('btnStep09',false);}}

// FIX: applyReview — Step 8 보완 → Step 9 수학식 삽입 → 완전 수정본
async function applyReview(){
  if(loadingState.applyReview)return;if(!outputs.step_13){showToast('검토 결과 없음','error');return;}
  const cur=getLatestDescription();if(!cur){showToast('상세설명 없음','error');return;}
  beforeReviewText=cur;
  loadingState.applyReview=true;setButtonLoading('btnApplyReview',true);

  try{
    // Phase 1: 검토 내용 반영하여 Step 8 상세설명 보완
    showProgress('progressApplyReview','[1/3] 검토 반영 상세설명 보완 중...',1,3);
    const inv=document.getElementById('projectInput').value;
    const improvedDesc=await callClaudeWithContinuation(`[검토 결과]를 반영하여 【발명을 실시하기 위한 구체적인 내용】을 완전히 새로 작성하라.

규칙:
- 기존 상세설명을 기반으로 검토 지적사항을 모두 보완하라.
- 이 항목만 작성. 다른 항목(기술분야, 배경기술 등) 포함 금지.
- 서버(100)를 주어. "구성요소(참조번호)" 형태.
- 도면별 "도 N을 참조하면," 형태.
- 특허문체(~한다). 글머리 금지. 생략 금지.
- 도면 1개당 약 2,000자, 총 8,000~10,000자.
- 청구항의 모든 구성요소를 빠짐없이 설명. 변형 실시예 포함.
- 제한성 표현 금지.

[발명의 명칭] ${selectedTitle}
[검토 결과] ${outputs.step_13}
[청구범위] ${outputs.step_06||''}
[도면] ${outputs.step_07||''}
[현재 상세설명] ${cur}
[프로젝트] ${(inv||'').slice(0,2000)}`,'progressApplyReview');

    outputs.step_08=improvedDesc; // Step 8 갱신

    // Phase 2: 보완된 상세설명에 수학식 삽입 (Step 9)
    showProgress('progressApplyReview','[2/3] 수학식 삽입 중...',2,3);
    const mathR=await callClaude(`상세설명의 핵심 알고리즘에 수학식 5개 내외.\n규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.\n출력:\n---MATH_BLOCK_1---\nANCHOR: (삽입위치 문장 20자 이상)\nFORMULA:\n【수학식 1】\n(수식)\n여기서, (파라미터)\n예시 대입: (수치)\n\n${selectedTitle}\n[현재 상세설명] ${improvedDesc}`);
    const finalDesc=insertMathBlocks(improvedDesc,mathR.text);
    outputs.step_09=finalDesc; // Step 9 갱신
    outputs.step_13_applied=finalDesc;

    // Phase 3: UI 업데이트
    showProgress('progressApplyReview','[3/3] 완료',3,3);
    renderOutput('step_08',improvedDesc);
    renderOutput('step_09',finalDesc);

    const resultArea=document.getElementById('reviewApplyResult');
    if(resultArea){resultArea.style.display='block';showReviewDiff('after');}
    setTimeout(()=>clearProgress('progressApplyReview'),2000);
    showToast('검토 반영 완료 — Step 8 보완 → Step 9 수학식 삽입 순차 적용');
  }catch(e){showToast(e.message,'error');}finally{loadingState.applyReview=false;setButtonLoading('btnApplyReview',false);}
}
function showReviewDiff(mode){
  const area=document.getElementById('reviewDiffArea');
  const btnBefore=document.getElementById('btnDiffBefore');
  const btnAfter=document.getElementById('btnDiffAfter');
  if(!area)return;
  if(mode==='before'){
    area.value=beforeReviewText||'(반영 전 데이터 없음)';
    if(btnBefore){btnBefore.className='btn btn-primary btn-sm';}
    if(btnAfter){btnAfter.className='btn btn-outline btn-sm';}
  }else{
    area.value=outputs.step_13_applied||'(반영 후 데이터 없음)';
    if(btnBefore){btnBefore.className='btn btn-outline btn-sm';}
    if(btnAfter){btnAfter.className='btn btn-primary btn-sm';}
  }
}

async function runDiagramStep(sid){if(loadingState[sid])return;const dep=checkDependency(sid);if(dep){showToast(dep,'error');return;}const bid=sid==='step_07'?'btnStep07':'btnStep11';loadingState[sid]=true;setButtonLoading(bid,true);try{const r=await callClaude(buildPrompt(sid));outputs[sid]=r.text;renderOutput(sid,r.text);const mr=await callClaude(buildMermaidPrompt(sid),4096);outputs[sid+'_mermaid']=mr.text;renderDiagrams(sid,mr.text);if(sid==='step_07')document.getElementById('btnPptx07').style.display='block';showToast(`${STEP_NAMES[sid]} 완료`);}catch(e){showToast(e.message,'error');}finally{loadingState[sid]=false;setButtonLoading(bid,false);}}
async function runBatch25(){if(loadingState.batch25)return;if(!selectedTitle){showToast('명칭 먼저 확정','error');return;}loadingState.batch25=true;setButtonLoading('btnBatch25',true);document.getElementById('resultsBatch25').innerHTML='';const steps=['step_02','step_03','step_04','step_05'];try{for(let i=0;i<steps.length;i++){showProgress('progressBatch',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;renderBatchResult('resultsBatch25',steps[i],r.text);}clearProgress('progressBatch');showToast('기본 항목 완료');}catch(e){clearProgress('progressBatch');showToast(e.message,'error');}finally{loadingState.batch25=false;setButtonLoading('btnBatch25',false);}}
async function runBatchFinish(){if(loadingState.batchFinish)return;if(!outputs.step_06||!outputs.step_08){showToast('청구항+상세설명 먼저','error');return;}loadingState.batchFinish=true;setButtonLoading('btnBatchFinish',true);document.getElementById('resultsBatchFinish').innerHTML='';const steps=['step_16','step_17','step_18','step_19'];try{for(let i=0;i<steps.length;i++){showProgress('progressBatchFinish',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;renderBatchResult('resultsBatchFinish',steps[i],r.text);}clearProgress('progressBatchFinish');showToast('마무리 완료');}catch(e){clearProgress('progressBatchFinish');showToast(e.message,'error');}finally{loadingState.batchFinish=false;setButtonLoading('btnBatchFinish',false);}}

// ═══════════ PARSERS ═══════════
function parseTitleCandidates(t){const c=[];let m;const re=/\[(\d+)\]\s*국문:\s*(.+?)\s*[/／]\s*영문:\s*(.+)/g;while((m=re.exec(t))!==null)c.push({num:m[1],korean:m[2].trim(),english:m[3].trim()});return c;}
function parseClaimStats(t){const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,c={};let m;while((m=cp.exec(t))!==null)c[parseInt(m[1])]=m[2].trim();const tot=Object.keys(c).length;let dep=0;Object.values(c).forEach(x=>{if(/있어서|따른/.test(x))dep++;});return{total:tot,independent:tot-dep,dependent:dep,claims:c};}
function extractMermaidBlocks(t){return(t.match(/```mermaid\n([\s\S]*?)```/g)||[]).map(b=>b.replace(/```mermaid\n/,'').replace(/```/,'').trim());}
function parseMathBlocks(t){const b=[];let m;const re=/---MATH_BLOCK_\d+---\s*\nANCHOR:\s*(.+)\s*\nFORMULA:\s*\n([\s\S]*?)(?=---MATH_BLOCK_|\s*$)/g;while((m=re.exec(t))!==null)b.push({anchor:m[1].trim(),formula:m[2].trim()});return b;}
function insertMathBlocks(s08,s09){let r=s08;const b=parseMathBlocks(s09);for(const x of b.reverse()){const i=r.indexOf(x.anchor);if(i>=0){const s=i+x.anchor.length,p=r.indexOf('.',s);const ip=(p>=0&&p-s<100)?p+1:s;r=r.slice(0,ip)+'\n\n'+x.formula+'\n\n'+r.slice(ip);}}return r;}

// ═══════════ MERMAID → EDITABLE PPTX (v4.4) ═══════════
function parseMermaidGraph(code){
  const nodes={},edges=[];
  code.split('\n').forEach(line=>{
    const l=line.trim();
    if(!l||l.startsWith('graph')||l.startsWith('flowchart')||l==='end'||l.startsWith('style')||l.startsWith('linkStyle')||l.startsWith('classDef')||l.startsWith('subgraph'))return;
    // edge patterns: A["lbl"] --> B["lbl"], A -->|"txt"| B, A --> B
    const em=l.match(/^(\w+)(?:\[["']?(.+?)["']?\])?\s*(-->|---)\s*(?:\|["']?(.+?)["']?\|\s*)?(\w+)(?:\[["']?(.+?)["']?\])?/);
    if(em){
      const[,fid,fl,,el,tid,tl]=em;
      if(fl&&!nodes[fid])nodes[fid]={id:fid,label:fl};
      if(tl&&!nodes[tid])nodes[tid]={id:tid,label:tl};
      if(!nodes[fid])nodes[fid]={id:fid,label:fid};
      if(!nodes[tid])nodes[tid]={id:tid,label:tid};
      edges.push({from:fid,to:tid,label:el||''});
      return;
    }
    const nm=l.match(/^(\w+)\[["']?(.+?)["']?\]/);
    if(nm&&!nodes[nm[1]])nodes[nm[1]]={id:nm[1],label:nm[2]};
  });
  return{nodes:Object.values(nodes),edges};
}

function layoutGraph(nodes,edges){
  // BFS hierarchical layout with wide spacing
  const adj={};edges.forEach(e=>{if(!adj[e.from])adj[e.from]=[];adj[e.from].push(e.to);});
  const targets=new Set(edges.map(e=>e.to));
  const roots=nodes.filter(n=>!targets.has(n.id));
  if(!roots.length&&nodes.length)roots.push(nodes[0]);

  const levels={},visited=new Set();
  const queue=roots.map(r=>({id:r.id,level:0}));
  while(queue.length){
    const{id,level}=queue.shift();
    if(visited.has(id))continue;visited.add(id);levels[id]=level;
    (adj[id]||[]).forEach(tid=>{if(!visited.has(tid))queue.push({id:tid,level:level+1});});
  }
  nodes.forEach(n=>{if(!(n.id in levels))levels[n.id]=0;});

  const groups={};nodes.forEach(n=>{const lv=levels[n.id];if(!groups[lv])groups[lv]=[];groups[lv].push(n);});

  const NW=2.5,NH=0.65,HG=0.8,VG=1.2;
  const SW=13.33,startY=0.7;
  const positions={};

  Object.entries(groups).forEach(([lv,grp])=>{
    const totalW=grp.length*NW+(grp.length-1)*HG;
    const sx=(SW-totalW)/2;
    grp.forEach((node,i)=>{
      const x=sx+i*(NW+HG),y=startY+parseInt(lv)*(NH+VG);
      positions[node.id]={x,y,w:NW,h:NH,cx:x+NW/2,cy:y+NH/2};
    });
  });
  return positions;
}

function downloadPptx(sid){
  const mt=outputs[sid+'_mermaid'];if(!mt){showToast('도면 없음','error');return;}
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';
  const blocks=extractMermaidBlocks(mt);if(!blocks.length){showToast('Mermaid 코드 없음','error');return;}

  // figure numbering offset
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;

  blocks.forEach((code,idx)=>{
    const slide=pptx.addSlide({bkgd:'FFFFFF'});
    const figNum=figOffset+idx+1;
    slide.addText(`도 ${figNum}`,{x:0.3,y:0.05,w:3,h:0.4,fontSize:16,bold:true,fontFace:'맑은 고딕',color:'000000'});

    const{nodes,edges}=parseMermaidGraph(code);
    if(!nodes.length){slide.addText(code,{x:0.5,y:0.6,w:12,h:6.4,fontSize:9,fontFace:'Consolas',color:'000000'});return;}
    const pos=layoutGraph(nodes,edges);

    // Draw edges (orthogonal routing, continuous arrows)
    edges.forEach((e,ei)=>{
      const fp=pos[e.from],tp=pos[e.to];
      if(!fp||!tp)return;

      const sx=fp.cx,sy=fp.y+fp.h; // source: bottom center
      const tx=tp.cx,ty=tp.y;       // target: top center

      if(Math.abs(sx-tx)<0.05){
        // Straight vertical line with arrow
        const h=ty-sy;
        if(h>0){
          slide.addShape(pptx.shapes.LINE,{x:sx,y:sy,w:0,h:h,
            line:{color:'000000',width:1.5,endArrowType:'triangle'}});
        }
      }else{
        // Orthogonal routing: down → horizontal → down
        // Use offset midY per edge to avoid overlapping horizontal segments
        const baseM=(sy+ty)/2;
        const offset=(ei%3-1)*0.15; // slight offset to prevent overlap
        const midY=baseM+offset;

        const seg1H=midY-sy;
        const seg3H=ty-midY;

        // Segment 1: vertical down from source
        if(seg1H>0){
          slide.addShape(pptx.shapes.LINE,{x:sx,y:sy,w:0,h:seg1H,
            line:{color:'000000',width:1.5}});
        }
        // Segment 2: horizontal
        const lx=Math.min(sx,tx),rw=Math.abs(tx-sx);
        slide.addShape(pptx.shapes.LINE,{x:lx,y:midY,w:rw,h:0,
          line:{color:'000000',width:1.5}});
        // Segment 3: vertical down to target with arrow
        if(seg3H>0){
          slide.addShape(pptx.shapes.LINE,{x:tx,y:midY,w:0,h:seg3H,
            line:{color:'000000',width:1.5,endArrowType:'triangle'}});
        }
      }

      // Edge label: place BESIDE the arrow (offset to right), not on the arrow
      if(e.label){
        const midX=Math.max(sx,tx)+0.15; // right side of rightmost node
        const midY2=(sy+ty)/2-0.12;
        slide.addText(e.label,{x:midX,y:midY2,w:1.2,h:0.24,
          fontSize:7,fontFace:'맑은 고딕',color:'333333',align:'left',valign:'middle'});
      }
    });

    // Draw nodes (rectangles) AFTER edges so they appear on top
    nodes.forEach(n=>{
      const p=pos[n.id];if(!p)return;
      slide.addShape(pptx.shapes.RECTANGLE,{
        x:p.x,y:p.y,w:p.w,h:p.h,
        fill:{color:'FFFFFF'},line:{color:'000000',width:1.5},rectRadius:0.03
      });
      slide.addText(n.label,{
        x:p.x+0.05,y:p.y,w:p.w-0.1,h:p.h,
        fontSize:9,fontFace:'맑은 고딕',color:'000000',
        align:'center',valign:'middle',bold:false
      });
    });
  });

  pptx.writeFile({fileName:`도면_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.pptx`});
  showToast('편집 가능한 PPTX 다운로드 완료');
}
function downloadPptxAll(){if(outputs.step_07_mermaid)downloadPptx('step_07');else showToast('도면 없음','error');}

// ═══════════ RENDERERS ═══════════
function renderOutput(sid,text){const cid=`result${sid.charAt(0).toUpperCase()+sid.slice(1).replace('_','')}`;const el=document.getElementById(cid);if(!el)return;if(sid==='step_01')renderTitleCards(el,text);else if(sid==='step_06'||sid==='step_10')renderClaimResult(el,sid,text);else renderEditableResult(el,sid,text);}
function renderTitleCards(c,text){const cs=parseTitleCandidates(text);if(!cs.length){c.innerHTML=`<div style="margin-top:12px;padding:12px;background:var(--color-bg-tertiary);border-radius:8px;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</div>`;document.getElementById('titleConfirmArea').style.display='block';return;}c.innerHTML='<div class="selection-cards" style="margin-top:12px">'+cs.map(x=>`<div class="selection-card" onclick="selectTitle(this,\`${x.korean.replace(/`/g,'')}\`,\`${x.english.replace(/`/g,'')}\`)"><div class="selection-card-category">${x.num}</div><div class="selection-card-title">${escapeHtml(x.korean)}</div><div class="selection-card-subtitle">${escapeHtml(x.english)}</div></div>`).join('')+'</div>';document.getElementById('titleConfirmArea').style.display='block';}
function renderClaimResult(c,sid,text){const st=parseClaimStats(text),iss=validateClaims(text);let h=`<div class="stat-row" style="margin-top:12px"><div class="stat-card stat-card-steps"><div class="stat-card-value">${st.total}</div><div class="stat-card-label">총 청구항</div></div><div class="stat-card stat-card-api"><div class="stat-card-value">${st.independent}</div><div class="stat-card-label">독립항</div></div><div class="stat-card stat-card-cost"><div class="stat-card-value">${st.dependent}</div><div class="stat-card-label">종속항</div></div></div>`;if(iss.length)h+=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="tossface">${i.severity==='CRITICAL'?'🔴':'🟠'}</span>${escapeHtml(i.message)}</div>`).join('');else h+='<div class="issue-item issue-pass"><span class="tossface">✅</span>모든 검증 통과</div>';h+=`<textarea class="result-textarea" rows="14" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea>`;c.innerHTML=h;}
function renderEditableResult(c,sid,text){c.innerHTML=`<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="badge badge-primary">${STEP_NAMES[sid]||sid}</span><span class="badge badge-neutral">${text.length.toLocaleString()}자</span></div><textarea class="result-textarea" rows="10" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea></div>`;}
function renderBatchResult(cid,sid,text){document.getElementById(cid).innerHTML+=`<div class="accordion-header" onclick="toggleAccordion(this)"><span><span class="tossface">✅</span> ${STEP_NAMES[sid]} <span class="badge badge-neutral">${text.length.toLocaleString()}자</span></span><span class="arrow">▶</span></div><div class="accordion-body"><textarea class="result-textarea" style="min-height:120px" onchange="outputs['${sid}']=this.value">${escapeHtml(text)}</textarea></div>`;}
function toggleAccordion(h){h.classList.toggle('open');const b=h.nextElementSibling;if(b)b.classList.toggle('open');}
function renderDiagrams(sid,mt){
  const cid=sid==='step_07'?'diagramsStep07':'diagramsStep11',el=document.getElementById(cid),blocks=extractMermaidBlocks(mt);
  if(!blocks.length){el.innerHTML=`<div class="diagram-container"><pre style="font-size:12px;white-space:pre-wrap">${escapeHtml(mt)}</pre></div>`;return;}
  el.innerHTML=blocks.map((code,i)=>`<div class="diagram-container"><div class="diagram-label">도 ${i+1}</div><div id="mermaid_${sid}_${i}"></div><details style="margin-top:8px"><summary style="font-size:11px;color:var(--color-text-tertiary);cursor:pointer">코드 보기</summary><pre style="font-size:11px;margin-top:4px;padding:8px;background:var(--color-bg-tertiary);border-radius:8px;overflow-x:auto">${escapeHtml(code)}</pre></details></div>`).join('');
  blocks.forEach((code,i)=>{const eid=`mermaid_${sid}_${i}`,svid=`svg_${sid}_${i}_${Date.now()}`;try{mermaid.render(svid,code).then(r=>{const t=document.getElementById(eid);if(t)t.innerHTML=r.svg;}).catch(()=>{const t=document.getElementById(eid);if(t)t.innerHTML='<div class="issue-item issue-high">렌더링 실패</div>';});}catch(e){const t=document.getElementById(eid);if(t)t.innerHTML='<div class="issue-item issue-high">렌더링 오류</div>';}});
}

// ═══════════ VALIDATION ═══════════
const KILLER_WORDS=[{pattern:/반드시/,msg:'"반드시" — 제한적 표현 (권리범위 축소 우려)'},{pattern:/에 한하여/,msg:'"~에 한하여" — 제한적 표현'},{pattern:/에 한정/,msg:'"~에 한정" — 제한적 표현'},{pattern:/에 제한/,msg:'"~에 제한" — 제한적 표현'},{pattern:/필수적으로/,msg:'"필수적으로" — 제한적 표현'}];
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
function updateStats(){const c=Object.keys(outputs).filter(k=>outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;document.getElementById('statCompleted').textContent=`${c}/19`;document.getElementById('statApiCalls').textContent=usage.calls;document.getElementById('statCost').textContent=`$${((usage.inputTokens*15/1e6)+(usage.outputTokens*75/1e6)).toFixed(2)}`;}
function renderPreview(){const el=document.getElementById('previewArea'),spec=buildSpecification();if(!spec.trim()){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px;text-align:center;padding:20px">생성된 항목이 없어요</p>';return;}el.innerHTML=spec.split(/(?=【)/).map(s=>{const h=s.match(/【(.+?)】/);if(!h)return '';return `<div class="accordion-header" onclick="toggleAccordion(this)"><span>【${escapeHtml(h[1])}】</span><span class="arrow">▶</span></div><div class="accordion-body">${escapeHtml(s)}</div>`;}).join('');}
function buildSpecification(){const desc=getLatestDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');return['【발명의 설명】',`【발명의 명칭】\n${selectedTitle}`,`【기술분야】\n${outputs.step_02||''}`,`【발명의 배경이 되는 기술】\n${outputs.step_03||''}`,`【선행기술문헌】\n${outputs.step_04||''}`,'【발명의 내용】',`【해결하고자 하는 과제】\n${outputs.step_05||''}`,`【과제의 해결 수단】\n${outputs.step_17||''}`,`【발명의 효과】\n${outputs.step_16||''}`,`【도면의 간단한 설명】\n${brief||''}`,`【발명을 실시하기 위한 구체적인 내용】\n${desc}${outputs.step_12?'\n\n'+outputs.step_12:''}`,`【부호의 설명】\n${outputs.step_18||''}`,`【청구범위】\n${outputs.step_06||''}${outputs.step_10?'\n\n'+outputs.step_10:''}`,`【요약서】\n${outputs.step_19||''}`].filter(Boolean).join('\n\n');}
function copyToClipboard(){const t=buildSpecification();if(!t.trim()){showToast('내용 없음','error');return;}navigator.clipboard.writeText(t).then(()=>showToast('복사 완료')).catch(()=>showToast('클립보드 접근 불가','error'));}
function downloadAsTxt(){const t=buildSpecification();if(!t.trim()){showToast('내용 없음','error');return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.txt`;a.click();}

// FIX: Word — 바탕체(BatangChe), 12pt, 줄간격200%, 들여쓰기1.41cm(40pt), 양쪽맞춤
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
  const html=secs.map(s=>{
    const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${escapeHtml(s.h)}】</h2>`;
    if(!s.b)return hd;
    return hd+s.b.split('\n').filter(l=>l.trim()).map(l=>{
      const hl=/【수학식\s*\d+】/.test(l)||/__+/.test(l)?'background-color:#FFFF00;':'';
      return `<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify;${hl}">${escapeHtml(l.trim())}</p>`;
    }).join('');
  }).join('');
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
