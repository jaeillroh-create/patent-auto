// ═══════════ STATE MANAGEMENT ═══════════
function clearAllState(){
  currentProjectId=null;outputs={};outputHistory={};scopeCheckResults={};selectedTitle='';selectedTitleEn='';selectedTitleType='';includeMethodClaims=true;
  usage={calls:0,inputTokens:0,outputTokens:0,cost:0};loadingState={};uploadedFiles=[];diagramData={};inventionScope=null;
  _judgmentCache.clear();_costTracking={judgment_calls:0,total_input_tokens:0,total_output_tokens:0,estimated_cost_usd:0,warned_50:false,stopped_100:false};
  projectRefStyleText='';requiredFigures=[];outputTimestamps={};stepUserCommands={};chatHistory={};
  conceptDiagramEnabled=false;conceptDiagramCount=0;conceptDiagramTypes=[];
  termSnapshot=_termSnapshotDefault();   // [§6-1] 용어 세대 스냅샷 초기화
  // Claim defaults
  deviceCategory='server';deviceGeneralDep=5;deviceAnchorDep=4;deviceAnchorStart=7;
  deviceIndepCount=1;mathBlockCount=3;conceptTargetCount=2;   // [배치15B-1] 신규 설계 파라미터 초기화
  anchorThemeMode='auto';selectedAnchorThemes=[];
  methodCategory='method';methodGeneralDep=3;methodAnchorDep=2;methodAnchorStart=0;
  methodAnchorThemeMode='auto';selectedMethodAnchorThemes=[];
  // globalRefStyleText persists across projects
  const ids=['projectInput','titleInput'];ids.forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['titleConfirmArea','titleConfirmMsg','batchArea'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  for(let i=1;i<=19;i++){const e=document.getElementById(`resultStep${String(i).padStart(2,'0')}`);if(e)e.innerHTML='';}
  // v5.5: Clear step user command inputs
  document.querySelectorAll('[id^="userCmd_"]').forEach(el=>{el.value='';});
  ['resultsBatch25','resultsBatchFinish','validationResults','previewArea','diagramsStep07','diagramsStep11','conceptDiagramsArea','fileList','requiredFiguresList','resultStep20','invention-scope-panel','scope-verification-summary','scope-verification-details'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='';});
  ['btnApplyReview','diagramDownload07','diagramDownload11','reviewApplyResult'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.querySelectorAll('.tab-item').forEach((t,i)=>{t.classList.toggle('active',i===0);t.setAttribute('aria-selected',i===0);});
  document.querySelectorAll('.page').forEach((p,i)=>p.classList.toggle('active',i===0));
  const mt=document.getElementById('methodToggle');if(mt){mt.checked=true;toggleMethod();}
  document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));
  const b01=document.getElementById('btnStep01');if(b01)b01.disabled=true;
  genParams=null;   // [배치12 C] 적용값 스냅샷 초기화
  try{ if(typeof _wfHardReset==='function')_wfHardReset(); }catch(_e){}   // [배치12 A] 워크플로우 플래그·레일 배지·검증바·수동 오버라이드 완전 초기화(상태 누출 차단)
  updateStats();
}

// ═══════════ DASHBOARD ═══════════
async function loadDashboardProjects(){
  const{data}=await App.sb.from('projects').select('id,title,project_number,invention_content,current_state_json,created_at,updated_at').eq('owner_user_id',currentUser.id).order('updated_at',{ascending:false}).limit(100);
  const el=document.getElementById('dashProjectList'),cnt=document.getElementById('dashProjectCount');
  const provEl=document.getElementById('dashProvisionalList');
  const _setStat=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  if(!data?.length){
    el.innerHTML='<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-tertiary)"><div style="font-size:28px;margin-bottom:6px"><span class="ico" data-icon="mail"></span></div><p style="font-size:13px">아직 생성된 사건이 없어요.</p></td></tr>';
    cnt.textContent='총 0건';
    _setStat('dashStatTotal',0);_setStat('dashStatWriting',0);_setStat('dashStatWait',0);_setStat('dashStatDone',0);_setStat('dashProvCount','0건');
    if(provEl)provEl.innerHTML='<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--color-text-tertiary);font-size:12px">가출원 내역이 없어요.</td></tr>';
    return;
  }
  const regular=data.filter(p=>!p.current_state_json?.type||p.current_state_json.type!=='provisional');
  const provisional=data.filter(p=>p.current_state_json?.type==='provisional');
  cnt.textContent=`총 ${regular.length}건`;
  // [STEP3] 통계 4카드 — 기존 목록 배열 재사용, 완성도 pct로 대기/작성 중/완료 산출 (신규 API 호출 없음)
  let _nDone=0,_nWriting=0,_nWait=0;
  regular.forEach(p=>{const _o=(p.current_state_json||{}).outputs||{};const _c=Object.keys(_o).filter(k=>_o[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;const _pct=Math.round(_c/19*100);if(_pct===100)_nDone++;else if(_pct>0)_nWriting++;else _nWait++;});
  _setStat('dashStatTotal',regular.length);_setStat('dashStatWriting',_nWriting);_setStat('dashStatWait',_nWait);_setStat('dashStatDone',_nDone);
  _setStat('dashProvCount',provisional.length+'건');

  if(!regular.length){
    el.innerHTML='<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-tertiary)"><div style="font-size:28px;margin-bottom:6px"><span class="ico" data-icon="mail"></span></div><p style="font-size:13px">아직 생성된 사건이 없어요.</p></td></tr>';
  } else {
    el.innerHTML=regular.map(p=>{
      const s=p.current_state_json||{},o=s.outputs||{};
      const c=Object.keys(o).filter(k=>o[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;
      const pct=Math.round(c/19*100);
      const caseNum=p.project_number||'-';
      const badgeCls=pct===100?'is-done':pct>0?'is-writing':'is-wait';
      const statusText=pct===100?'완료':pct>0?'작성 중':'대기';
      return `<tr class="pt-case-row" onclick="openProject('${p.id}')">
        <td><span class="pt-case-no">${App.escapeHtml(caseNum)}</span></td>
        <td><div class="pt-case-name">${App.escapeHtml(p.title)}</div></td>
        <td class="pt-c"><span class="pt-badge ${badgeCls}"><span class="dot"></span>${statusText}</span></td>
        <td class="pt-c"><span class="pt-case-date">${new Date(p.updated_at).toLocaleDateString('ko-KR')}</span></td>
        <td class="pt-c" onclick="event.stopPropagation()"><div class="pt-row-actions">
          <button class="btn btn-outline btn-sm" onclick="openProject('${p.id}')">열기</button>
          <button class="btn btn-outline btn-sm" onclick="renameProject('${p.id}','${App.escapeHtml(p.title).replace(/'/g,"\\'")}')">편집</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--color-error)" onclick="confirmDeleteProject('${p.id}','${App.escapeHtml(p.title).replace(/'/g,"\\'")}')">삭제</button>
        </div></td>
      </tr>`;
    }).join('');
  }
  
  if(provEl){
    if(!provisional.length){
      provEl.innerHTML='<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--color-text-tertiary);font-size:12px">가출원 내역이 없어요.</td></tr>';
    } else {
      provEl.innerHTML=provisional.map(p=>{
        const pd=p.current_state_json?.provisionalData||{};
        const caseNum=p.project_number||'-';
        return `<tr class="pt-case-row" onclick="openProvisionalViewer('${p.id}')">
          <td><span class="pt-case-no">${App.escapeHtml(caseNum)}</span></td>
          <td><div class="pt-case-name">${App.escapeHtml(pd.title||p.title)}</div></td>
          <td class="pt-c"><span class="pt-case-date">${new Date(p.created_at).toLocaleDateString('ko-KR')}</span></td>
          <td class="pt-c" onclick="event.stopPropagation()"><div class="pt-row-actions">
            <button class="btn btn-outline btn-sm" onclick="openProvisionalViewer('${p.id}')">보기</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-error)" onclick="confirmDeleteProject('${p.id}','${App.escapeHtml(p.title).replace(/'/g,"\\'")}')">삭제</button>
          </div></td>
        </tr>`;
      }).join('');
    }
  }
}

// ═══ Global Reference Document (Dashboard level) ═══
function loadGlobalRefFromStorage(){
  try{globalRefStyleText=App._lsGet('patent_global_ref')||'';}catch(e){globalRefStyleText='';}
  const st=document.getElementById('globalRefStatus');
  if(st){
    if(globalRefStyleText)st.innerHTML=`<span class="ico" data-icon="check-circle"></span> 등록됨 (${globalRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearGlobalRef()" style="margin-left:4px"><span class="ico" data-icon="x"></span></button>`;
    else st.textContent='업로드된 문서 없음';
  }
}
async function handleGlobalRefUpload(event){
  const file=event.target.files[0];if(!file)return;
  const st=document.getElementById('globalRefStatus');
  st.textContent='추출 중...';st.style.color='var(--color-primary)';
  try{
    const text=await App.extractTextFromFile(file);
    if(text&&text.trim()&&!text.startsWith('[')){
      globalRefStyleText=text.trim().slice(0,5000);
      try{App._lsSet('patent_global_ref',globalRefStyleText);}catch(e){}
      st.innerHTML=`<span class="ico" data-icon="check-circle"></span> ${App.escapeHtml(file.name)} (${globalRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearGlobalRef()" style="margin-left:4px"><span class="ico" data-icon="x"></span></button>`;
      st.style.color='var(--color-success)';
      App.showToast('공통 참고 문서 등록 완료 — 모든 프로젝트에 적용');
    }else{st.textContent='텍스트 추출 불가';st.style.color='var(--color-error)';}
  }catch(e){st.textContent='오류 발생';st.style.color='var(--color-error)';App.showToast(e.message,'error');}
  event.target.value='';
}
function clearGlobalRef(){globalRefStyleText='';try{App._lsRemove('patent_global_ref');}catch(e){}const st=document.getElementById('globalRefStatus');if(st){st.textContent='업로드된 문서 없음';st.style.color='var(--color-text-tertiary)';}App.showToast('공통 참고 문서 제거됨');}

// ═══ Provisional Viewer ═══
async function openProvisionalViewer(pid){
  const{data}=await App.sb.from('projects').select('*').eq('id',pid).single();
  if(!data||!data.current_state_json?.provisionalData){App.showToast('데이터를 찾을 수 없어요','error');return;}
  currentProvisionalId=pid;
  const pd=data.current_state_json.provisionalData;
  document.getElementById('provisionalViewerTitle').textContent=pd.title||'가출원 명세서';
  const titleLine=pd.titleEn?`${pd.title}{${pd.titleEn}}`:(pd.title||'');
  document.getElementById('provisionalViewerMeta').textContent=`생성: ${new Date(data.created_at).toLocaleDateString('ko-KR')} · 발명 내용: ${(data.invention_content||'').length.toLocaleString()}자`;
  const content=[
    `【발명의 명칭】\n${titleLine}`,
    `【기술분야】\n${_stripDupHeader(pd.techField||'','기술분야')}`,
    `【해결하고자 하는 과제】\n${_stripDupHeader(pd.problem||'','해결하고자 하는 과제')}`,
    `【과제의 해결 수단】\n${_stripDupHeader(pd.solution||'','과제의 해결 수단')}`,
    `【발명의 효과】\n${_stripDupHeader(pd.effect||'','발명의 효과')}`,
    `【도면의 간단한 설명】\n도 1은 ${pd.title||''}의 구성을 나타내는 블록도이다.`,
    `【발명을 실시하기 위한 구체적인 내용】\n${pd.desc||''}`,
    `【청구범위】\n${pd.claim||''}`,
    `【요약서】\n${pd.abstract||''}`
  ].join('\n\n');
  document.getElementById('provisionalViewerContent').textContent=content;
  document.getElementById('provisionalViewerModal').style.display='flex';
}
function closeProvisionalViewer(){document.getElementById('provisionalViewerModal').style.display='none';currentProvisionalId=null;}
async function redownloadProvisionalWord(){
  if(!currentProvisionalId)return;
  const{data}=await App.sb.from('projects').select('current_state_json').eq('id',currentProvisionalId).single();
  if(!data?.current_state_json?.provisionalData){App.showToast('데이터 없음','error');return;}
  const pd=data.current_state_json.provisionalData;
  const titleLine=pd.titleEn?`${pd.title}{${pd.titleEn}}`:(pd.title||'');
  const secs=[
    {h:'발명의 설명'},{h:'발명의 명칭',b:titleLine},{h:'기술분야',b:pd.techField},
    {h:'발명의 내용'},{h:'해결하고자 하는 과제',b:pd.problem},
    {h:'과제의 해결 수단',b:pd.solution},{h:'발명의 효과',b:pd.effect},
    {h:'도면의 간단한 설명',b:`도 1은 ${pd.title||''}의 구성을 나타내는 블록도이다.`},
    {h:'발명을 실시하기 위한 구체적인 내용',b:pd.desc},
    {h:'청구범위',b:pd.claim},
    {h:'요약서',b:pd.abstract?`【요약】\n${pd.abstract}\n\n【대표도】\n도 1`:''},
  ];
  const html=secs.map(s=>{
    const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${App.escapeHtml(s.h)}】</h2>`;
    const body=_stripDupHeader(s.b,s.h);
    if(!body)return hd;
    return hd+body.split('\n').filter(l=>l.trim()).map(l=>`<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify">${App.escapeHtml(l.trim())}</p>`).join('');
  }).join('');
  const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}</body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));
  a.download=`가출원_${pd.title||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();
  App.showToast('Word 재다운로드 완료');
}
function copyProvisionalToClipboard(){
  const t=document.getElementById('provisionalViewerContent')?.textContent;
  if(!t){App.showToast('내용 없음','error');return;}
  navigator.clipboard.writeText(t).then(()=>App.showToast('복사 완료')).catch(()=>App.showToast('클립보드 접근 불가','error'));
}
async function confirmDeleteProvisional(){
  if(!currentProvisionalId)return;
  if(!confirm('이 가출원 명세서를 삭제하시겠어요?'))return;
  await App.sb.from('projects').delete().eq('id',currentProvisionalId);
  closeProvisionalViewer();App.showToast('삭제됨');loadDashboardProjects();
}

async function openNewProjectModal(){
  document.getElementById('newProjectTitle').value='';
  // 다음 사건번호 자동 생성
  const numInput=document.getElementById('newProjectNumber');
  if(numInput){
    try{
      const{data}=await App.sb.from('projects').select('project_number').eq('owner_user_id',currentUser.id).not('project_number','is',null).order('created_at',{ascending:false}).limit(50);
      let nextNum=1;
      if(data?.length){
        const nums=data.map(p=>{
          const pn=p.project_number||'';
          const match=pn.match(/^26P(\d{4})$/);
          return match?parseInt(match[1],10):0;
        }).filter(n=>n>0);
        if(nums.length)nextNum=Math.max(...nums)+1;
      }
      numInput.value=String(nextNum).padStart(4,'0');
    }catch(e){numInput.value='0001';}
  }
  document.getElementById('newProjectModal').style.display='flex';
  document.getElementById('newProjectTitle').focus();
}
function closeNewProjectModal(){document.getElementById('newProjectModal').style.display='none';}
async function createAndOpenProject(){
  const t=document.getElementById('newProjectTitle').value.trim();
  const numInput=document.getElementById('newProjectNumber');
  const numVal=numInput?numInput.value.trim():'';
  
  if(!t){App.showToast('사건명을 입력해 주세요','error');return;}
  if(numInput && (!numVal||!/^\d{4}$/.test(numVal))){App.showToast('사건번호 4자리를 입력해 주세요','error');return;}
  
  const projectNumber=numVal?'26P'+numVal:null;
  
  // 중복 체크
  if(projectNumber){
    const{data:existing}=await App.sb.from('projects').select('id').eq('project_number',projectNumber).eq('owner_user_id',currentUser.id).maybeSingle();
    if(existing){App.showToast('이미 사용중인 사건번호입니다','error');return;}
  }
  
  const{data,error}=await App.sb.from('projects').insert({
    owner_user_id:currentUser.id,
    title:t,
    project_number:projectNumber,
    invention_content:'',
    current_state_json:{outputs:{},selectedTitle:'',selectedTitleType:'',includeMethodClaims:true,usage:{calls:0,inputTokens:0,outputTokens:0,cost:0}}
  }).select('id').single();
  
  if(error){App.showToast('생성 실패: '+error.message,'error');return;}
  closeNewProjectModal();
  await openProject(data.id);
}

async function openProject(pid){
  clearAllState();const{data}=await App.sb.from('projects').select('*').eq('id',pid).single();if(!data){App.showToast('불러올 수 없어요','error');return;}
  currentProjectId=data.id;document.getElementById('projectInput').value=data.invention_content||'';
  const s=data.current_state_json||{};outputs=s.outputs||{};selectedTitle=s.selectedTitle||'';selectedTitleEn=s.selectedTitleEn||'';selectedTitleType=s.selectedTitleType||'';includeMethodClaims=s.includeMethodClaims!==false;usage=s.usage||{calls:0,inputTokens:0,outputTokens:0,cost:0};
  termSnapshot=(s.termSnapshot&&typeof s.termSnapshot==='object')?s.termSnapshot:_termSnapshotDefault();   // [§6-1] 용어 세대 스냅샷 복원
  // Fix: ensure cost field exists even from old saves
  if(typeof usage.cost==='undefined')usage.cost=0;
  // Restore v4.7 claim config
  deviceCategory=s.deviceCategory||'server';deviceGeneralDep=typeof s.deviceGeneralDep==='number'?s.deviceGeneralDep:5;deviceAnchorDep=typeof s.deviceAnchorDep==='number'?s.deviceAnchorDep:4;deviceAnchorStart=typeof s.deviceAnchorStart==='number'?s.deviceAnchorStart:7;
  deviceIndepCount=typeof s.deviceIndepCount==='number'?s.deviceIndepCount:1;mathBlockCount=typeof s.mathBlockCount==='number'?s.mathBlockCount:3;conceptTargetCount=typeof s.conceptTargetCount==='number'?s.conceptTargetCount:2;   // [배치15B-1] 신규 설계 파라미터 복원
  anchorThemeMode=s.anchorThemeMode||'auto';selectedAnchorThemes=s.selectedAnchorThemes||[];
  methodCategory=s.methodCategory||'method';methodGeneralDep=typeof s.methodGeneralDep==='number'?s.methodGeneralDep:3;methodAnchorDep=typeof s.methodAnchorDep==='number'?s.methodAnchorDep:2;methodAnchorStart=typeof s.methodAnchorStart==='number'?s.methodAnchorStart:0;
  methodAnchorThemeMode=s.methodAnchorThemeMode||'auto';selectedMethodAnchorThemes=s.selectedMethodAnchorThemes||[];
  projectRefStyleText=s.projectRefStyleText||'';requiredFigures=s.requiredFigures||[];
  // Restore detail level
  detailLevel=s.detailLevel||'standard';customDetailChars=s.customDetailChars||2000;
  { const _ud=document.getElementById('selUnifiedDetail'); if(_ud&&['compact','standard','detailed','maximal'].includes(detailLevel))_ud.value=detailLevel; }   // [배치6 N3a] 통합 카드 분량 표시 동기화
  genParams=(s.genParams&&typeof s.genParams==='object')?s.genParams:null;   // [배치12 C] 적용값 스냅샷 복원(레일·이 배치8 훅은 openProject 말미로 이동 — 전체 상태 복원 후 1회 렌더)
  diagramData=s.diagramData||{};
  outputTimestamps=s.outputTimestamps||{};
  stepUserCommands=s.stepUserCommands||{};
  chatHistory=s.chatHistory||{};
  outputHistory=s.outputHistory||{};
  inventionScope=s.inventionScope||null;
  scopeCheckResults=s.scopeCheckResults||{};
  _costTracking=s.costTracking||{judgment_calls:0,total_input_tokens:0,total_output_tokens:0,estimated_cost_usd:0,warned_50:false,stopped_100:false};
  _judgmentCache.clear();
  conceptDiagramEnabled=s.conceptDiagramEnabled||false;
  conceptDiagramCount=s.conceptDiagramCount||0;
  conceptDiagramTypes=s.conceptDiagramTypes||[];
  // FIX: Ensure API_KEY is loaded (use ensureApiKey instead of raw assignment)
  if(!API_KEY){App.ensureApiKey();}
  // Restore UI
  document.getElementById('methodToggle').checked=includeMethodClaims;toggleMethod();
  try{_methodUserSet=false;}catch(_e){}   // [배치12 A] 복원은 저장값 반영일 뿐 — 이후 유형 변경 시 자동 동기 재개(toggleMethod의 user-set 부작용 취소)
  restoreClaimUI();
  // Restore custom title type
  if(selectedTitleType){const ci=document.getElementById('customTitleType');if(ci)ci.value=selectedTitleType;document.getElementById('btnStep01').disabled=false;}
  if(selectedTitle){document.getElementById('titleInput').value=selectedTitle;const enInp=document.getElementById('titleInputEn');if(enInp)enInp.value=selectedTitleEn||'';document.getElementById('titleConfirmArea').style.display='block';document.getElementById('titleConfirmMsg').style.display='block';document.getElementById('batchArea').style.display='block';}
  Object.keys(outputs).forEach(k=>{if(outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied'))_cascadeRender(k,outputs[k]);});
  // v5.5: 스텝별 사용자 명령어 UI 주입
  injectAllUserCommandUIs();
  // [P-C1] 발명 범위 패널 복원
  renderInventionScopePanel();
  // Restore diagrams and show download buttons
  if(outputs.step_07_mermaid){renderDiagrams('step_07',outputs.step_07_mermaid);const dl07=document.getElementById('diagramDownload07');if(dl07)dl07.style.display='block';}
  if(outputs.step_11_mermaid){renderDiagrams('step_11',outputs.step_11_mermaid);const dl11=document.getElementById('diagramDownload11');if(dl11)dl11.style.display='block';}
  // v11.0: 예시도/개념도 복원
  if(conceptDiagramTypes.length>0)renderConceptDiagramCards();
  // ★ [A1] 예시도 lifecycle 배선 — 열기 직후 예시도 설명/부호를 발명의 설명(step_08 계층)·부호의 설명(step_18)에 자동 반영.
  //   #210 reflect 는 "생성 시점"만 호출 → 기존 사건(예시도 이미 생성된 사건)은 누락 그대로였음. 열 때도 반영해 기존 사건 자동 해소.
  //   ★ reflect 안전장치 재사용: 멱등(figNum 기준 중복 0)·본문 보존(APPEND) → 열 때마다 호출해도 안전. 예시도 없으면 no-op.
  try{
    const _openRefl=reflectConceptsToSpec();   // ★ [B2] 이제 부호의 설명(step_18)만 보강(발명의 설명 APPEND 은퇴) — desc 항상 0
    if(_openRefl.ref){
      if(outputs.step_18)_cascadeRender('step_18',outputs.step_18);
      saveProject(true);   // 신규 부호 반영분 1회 영속 → 이후 열기는 멱등 no-op
    }
  }catch(_e){}
  // v15: 단계별 채팅 수정 패널 복원
  if(window.PatentChat)PatentChat.mountAll();
  document.getElementById('headerProjectName').textContent=data.title;document.getElementById('headerUserName').textContent=currentProfile?.display_name||currentUser?.email||'';
  if(currentProfile?.role==='admin')document.getElementById('btnAdmin').style.display='inline-flex';
  updateStats();
  // ★ 검증 결과 재수화 (review_runs 최신 done) — 새로고침/재오픈 시 메모리 reviewState 복원(재검증 $15·2분 방지).
  //   _persistReviewDecision 가 result=reviewState(patchPlans[].accepted 포함) 저장 → issues+보정안+승인상태 동시 복원.
  //   ★ clearAllState 는 __patentReviewState 를 안 지우므로 항상 명시 설정(result 또는 null) → 이전 사건 stale 차단.
  //   null 이면 renderPreview 훅(page4)이 카드 미표시 → 기존 "출원 전 검증 시작" 버튼. RLS·인덱스 기존(20260616).
  try {
    var _rr = await App.sb.from('review_runs').select('result')
      .eq('project_id', String(currentProjectId)).eq('module', 'patent').eq('status', 'done')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    window.__patentReviewState = (_rr && _rr.data && _rr.data.result) || null;
  } catch (_e) { window.__patentReviewState = null; }
  App.showScreen('main');App.updateModelToggle();App.updateProviderLabel();App.showToast(`"${data.title}" 열림`);
  // [배치12 A/B] 전체 상태 복원 후 1회 렌더 — 레일 배지·상주 검증바·② 설계 보드(적용값 대조). 이전 프로젝트 DOM 잔상 제거.
  try{ if(typeof renderWorkflowRail==='function')renderWorkflowRail(); if(typeof renderWfValidationBar==='function')renderWfValidationBar(); if(typeof renderDesignBoard==='function')renderDesignBoard(); }catch(_e){}
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
  // Restore required figures — v10.0: 사용자 도면 UI 초기화
  initUserFiguresUI();
  // Restore detail level UI
  const dlCards=document.querySelectorAll('#detailLevelCards .selection-card');
  const dlLevels=['compact','standard','detailed','maximal','custom'];   // ★ [Item4] 카드 DOM 순서와 정합(compact/standard/detailed/maximal/custom)
  dlCards.forEach((c,i)=>c.classList.toggle('selected',dlLevels[i]===detailLevel));
  const ci=document.getElementById('customDetailInput');
  if(ci)ci.style.display=detailLevel==='custom'?'block':'none';
  if(detailLevel==='custom'){const inp=document.getElementById('customDetailChars');if(inp)inp.value=customDetailChars;}
  // Restore project ref
  const prs=document.getElementById('projectRefStatus');
  if(prs&&projectRefStyleText)prs.innerHTML=`<span class="ico" data-icon="check-circle"></span> 등록됨 (${projectRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearProjectRef()" style="margin-left:4px"><span class="ico" data-icon="x"></span></button>`;
}

async function backToDashboard(){if(currentProjectId)await saveProject(true);clearAllState();App.showScreen('dashboard');}
async function confirmDeleteProject(id,t){if(!confirm(`"${t}" 사건을 삭제하시겠어요?`))return;await App.sb.from('projects').delete().eq('id',id);App.showToast('삭제됨');loadDashboardProjects();}
async function saveProject(silent=false){if(!currentProjectId)return;const t=selectedTitle||document.getElementById('projectInput').value.slice(0,30)||'새 사건';const _payload={outputs,outputHistory,inventionScope,scopeCheckResults,costTracking:_costTracking,selectedTitle,selectedTitleEn,selectedTitleType,includeMethodClaims,usage,deviceCategory,deviceGeneralDep,deviceAnchorDep,deviceAnchorStart,deviceIndepCount,mathBlockCount,conceptTargetCount,anchorThemeMode,selectedAnchorThemes,methodCategory,methodGeneralDep,methodAnchorDep,methodAnchorStart,methodAnchorThemeMode,selectedMethodAnchorThemes,projectRefStyleText,requiredFigures,detailLevel,customDetailChars,diagramData,outputTimestamps,stepUserCommands,chatHistory,conceptDiagramEnabled,conceptDiagramCount,conceptDiagramTypes,termSnapshot,genParams};console.log('[diag] saveProject payload size:',JSON.stringify(_payload).length,'chars');await App.sb.from('projects').update({title:t,invention_content:document.getElementById('projectInput').value,current_state_json:_payload}).eq('id',currentProjectId);if(!silent)App.showToast('저장됨');}

