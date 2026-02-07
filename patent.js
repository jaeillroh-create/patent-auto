/* ═══════════════════════════════════════════════════════════
   특허명세서 자동 생성 v5.4 — Patent Pipeline (19-Step)
   패치: 방법 도면 중앙선 직선화살표 + 도 1 L1 화살표 항상표시
   ═══════════════════════════════════════════════════════════ */

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
  computer_program:'컴퓨터가 …을 수행하도록 하는 프로그램.',
  computer_program_product:'컴퓨터가 …을 수행하도록 하는 프로그램.'
};

// ═══ Patent State ═══
let outputs={},selectedTitle='',selectedTitleEn='',selectedTitleType='',includeMethodClaims=true;
let usage={calls:0,inputTokens:0,outputTokens:0,cost:0},loadingState={};
let detailLevel='standard';
let customDetailChars=2000;
let currentProvisionalId=null;
let deviceCategory='server', deviceGeneralDep=5, deviceAnchorDep=4, deviceAnchorStart=7;
let anchorThemeMode='auto', selectedAnchorThemes=[];
let methodCategory='method', methodGeneralDep=3, methodAnchorDep=2, methodAnchorStart=0;
let methodAnchorThemeMode='auto', selectedMethodAnchorThemes=[];
let requiredFigures=[];
let globalRefStyleText='';
let projectRefStyleText='';
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
const STEP_NAMES={step_01:'발명의 명칭',step_02:'기술분야',step_03:'배경기술',step_04:'선행기술문헌',step_05:'해결하고자 하는 과제',step_06:'장치 청구항',step_07:'도면 설계',step_08:'장치 상세설명',step_09:'수학식',step_10:'방법 청구항',step_11:'방법 도면',step_12:'방법 상세설명',step_13:'검토',step_14:'대안 청구항',step_15:'특허성 검토',step_16:'발명의 효과',step_17:'과제의 해결 수단',step_18:'부호의 설명',step_19:'요약서'};


// ═══════════ STATE MANAGEMENT ═══════════
function clearAllState(){
  currentProjectId=null;outputs={};selectedTitle='';selectedTitleEn='';selectedTitleType='';includeMethodClaims=true;
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
  ['btnApplyReview','diagramDownload07','diagramDownload11','reviewApplyResult'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.querySelectorAll('.tab-item').forEach((t,i)=>{t.classList.toggle('active',i===0);t.setAttribute('aria-selected',i===0);});
  document.querySelectorAll('.page').forEach((p,i)=>p.classList.toggle('active',i===0));
  const mt=document.getElementById('methodToggle');if(mt){mt.checked=true;toggleMethod();}
  document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));
  const b01=document.getElementById('btnStep01');if(b01)b01.disabled=true;
  updateStats();
}

// ═══════════ DASHBOARD ═══════════
async function loadDashboardProjects(){
  const{data}=await App.sb.from('projects').select('id,title,project_number,invention_content,current_state_json,created_at,updated_at').eq('owner_user_id',currentUser.id).order('updated_at',{ascending:false});
  const el=document.getElementById('dashProjectList'),cnt=document.getElementById('dashProjectCount');
  const provEl=document.getElementById('dashProvisionalList');
  if(!data?.length){
    el.innerHTML='<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-tertiary)"><div style="font-size:28px;margin-bottom:6px"><span class="tossface">📭</span></div><p style="font-size:13px">아직 생성된 사건이 없어요.</p></td></tr>';
    cnt.textContent='총 0건';
    if(provEl)provEl.innerHTML='<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--color-text-tertiary);font-size:12px">가출원 내역이 없어요.</td></tr>';
    return;
  }
  const regular=data.filter(p=>!p.current_state_json?.type||p.current_state_json.type!=='provisional');
  const provisional=data.filter(p=>p.current_state_json?.type==='provisional');
  cnt.textContent=`총 ${regular.length}건`;
  
  if(!regular.length){
    el.innerHTML='<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-tertiary)"><div style="font-size:28px;margin-bottom:6px"><span class="tossface">📭</span></div><p style="font-size:13px">아직 생성된 사건이 없어요.</p></td></tr>';
  } else {
    el.innerHTML=regular.map(p=>{
      const s=p.current_state_json||{},o=s.outputs||{};
      const c=Object.keys(o).filter(k=>o[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;
      const pct=Math.round(c/19*100);
      const caseNum=p.project_number||'-';
      const statusBadge=pct===100?'badge-success':pct>0?'badge-warning':'badge-neutral';
      const statusText=pct===100?'완료':pct>0?'작성 중':'대기';
      return `<tr style="border-bottom:1px solid var(--color-border);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='var(--color-bg-tertiary)'" onmouseout="this.style.background=''" onclick="openProject('${p.id}')">
        <td style="padding:10px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><div style="display:flex;align-items:center;gap:6px"><span class="tossface">📁</span><span style="color:var(--color-primary);font-weight:600;font-size:12px">${App.escapeHtml(caseNum)}</span></div></td>
        <td style="padding:10px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="font-weight:500">${App.escapeHtml(p.title)}</span></td>
        <td style="padding:10px 12px;text-align:center"><span class="badge ${statusBadge}" style="font-size:11px">${statusText}</span></td>
        <td style="padding:10px 12px;text-align:center;color:var(--color-text-tertiary);font-size:11px;white-space:nowrap">${new Date(p.updated_at).toLocaleDateString('ko-KR')}</td>
        <td style="padding:6px 8px;text-align:center;white-space:nowrap" onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-sm" onclick="openProject('${p.id}')" style="padding:4px 10px;font-size:11px">열기</button>
          <button class="btn btn-outline btn-sm" onclick="renameProject('${p.id}','${App.escapeHtml(p.title).replace(/'/g,"\\'")}')" style="padding:4px 8px;font-size:11px">편집</button>
          <span style="color:var(--color-error);cursor:pointer;font-size:11px;margin-left:4px" onclick="confirmDeleteProject('${p.id}','${App.escapeHtml(p.title).replace(/'/g,"\\'")}')">삭제</span>
        </td>
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
        return `<tr style="border-bottom:1px solid var(--color-border);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='var(--color-warning-light)'" onmouseout="this.style.background=''" onclick="openProvisionalViewer('${p.id}')">
          <td style="padding:8px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><div style="display:flex;align-items:center;gap:6px"><span class="tossface">⚡</span><span style="color:var(--color-warning);font-weight:600;font-size:12px">${App.escapeHtml(caseNum)}</span></div></td>
          <td style="padding:8px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="font-weight:500">${App.escapeHtml(pd.title||p.title)}</span></td>
          <td style="padding:8px 12px;text-align:center;color:var(--color-text-tertiary);font-size:11px;white-space:nowrap">${new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
          <td style="padding:6px 8px;text-align:center;white-space:nowrap" onclick="event.stopPropagation()">
            <button class="btn btn-outline btn-sm" onclick="openProvisionalViewer('${p.id}')" style="padding:4px 10px;font-size:11px">보기</button>
            <span style="color:var(--color-error);cursor:pointer;font-size:11px;margin-left:4px" onclick="confirmDeleteProject('${p.id}','${App.escapeHtml(p.title).replace(/'/g,"\\'")}')">삭제</span>
          </td>
        </tr>`;
      }).join('');
    }
  }
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
    const text=await App.extractTextFromFile(file);
    if(text&&text.trim()&&!text.startsWith('[')){
      globalRefStyleText=text.trim().slice(0,5000);
      try{localStorage.setItem('patent_global_ref',globalRefStyleText);}catch(e){}
      st.innerHTML=`<span class="tossface">✅</span> ${App.escapeHtml(file.name)} (${globalRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearGlobalRef()" style="margin-left:4px">✕</button>`;
      st.style.color='var(--color-success)';
      App.showToast('공통 참고 문서 등록 완료 — 모든 프로젝트에 적용');
    }else{st.textContent='텍스트 추출 불가';st.style.color='var(--color-error)';}
  }catch(e){st.textContent='오류 발생';st.style.color='var(--color-error)';App.showToast(e.message,'error');}
  event.target.value='';
}
function clearGlobalRef(){globalRefStyleText='';try{localStorage.removeItem('patent_global_ref');}catch(e){}const st=document.getElementById('globalRefStatus');if(st){st.textContent='업로드된 문서 없음';st.style.color='var(--color-text-tertiary)';}App.showToast('공통 참고 문서 제거됨');}

// ═══ Provisional Viewer ═══
async function openProvisionalViewer(pid){
  const{data}=await App.sb.from('projects').select('*').eq('id',pid).single();
  if(!data||!data.current_state_json?.provisionalData){App.showToast('데이터를 찾을 수 없어요','error');return;}
  currentProvisionalId=pid;
  const pd=data.current_state_json.provisionalData;
  document.getElementById('provisionalViewerTitle').textContent=pd.title||'가출원 명세서';
  const titleLine=pd.titleEn?`${pd.title}\n{${pd.titleEn}}`:(pd.title||'');
  document.getElementById('provisionalViewerMeta').textContent=`생성: ${new Date(data.created_at).toLocaleDateString('ko-KR')} · 발명 내용: ${(data.invention_content||'').length.toLocaleString()}자`;
  const content=[
    `【발명의 명칭】\n${titleLine}`,
    `【기술분야】\n${pd.techField||''}`,
    `【해결하고자 하는 과제】\n${pd.problem||''}`,
    `【과제의 해결 수단】\n${pd.solution||''}`,
    `【발명의 효과】\n${pd.effect||''}`,
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
  const titleLine=pd.titleEn?`${pd.title}\n{${pd.titleEn}}`:(pd.title||'');
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
    if(!s.b)return hd;
    return hd+s.b.split('\n').filter(l=>l.trim()).map(l=>`<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify">${App.escapeHtml(l.trim())}</p>`).join('');
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
  // Fix: ensure cost field exists even from old saves
  if(typeof usage.cost==='undefined')usage.cost=0;
  // Restore v4.7 claim config
  deviceCategory=s.deviceCategory||'server';deviceGeneralDep=s.deviceGeneralDep||5;deviceAnchorDep=s.deviceAnchorDep||4;deviceAnchorStart=s.deviceAnchorStart||7;
  anchorThemeMode=s.anchorThemeMode||'auto';selectedAnchorThemes=s.selectedAnchorThemes||[];
  methodCategory=s.methodCategory||'method';methodGeneralDep=s.methodGeneralDep||3;methodAnchorDep=s.methodAnchorDep||2;methodAnchorStart=s.methodAnchorStart||0;
  methodAnchorThemeMode=s.methodAnchorThemeMode||'auto';selectedMethodAnchorThemes=s.selectedMethodAnchorThemes||[];
  projectRefStyleText=s.projectRefStyleText||'';requiredFigures=s.requiredFigures||[];
  // Restore detail level
  detailLevel=s.detailLevel||'standard';customDetailChars=s.customDetailChars||2000;
  diagramData=s.diagramData||{};
  // FIX: Ensure API_KEY is loaded (triple fallback)
  if(!API_KEY){
    if(currentProfile?.api_key_encrypted)API_KEY=currentProfile.api_key_encrypted;
    if(!API_KEY){try{API_KEY=localStorage.getItem('patent_api_key')||'';}catch(e){}}
  }
  // Restore UI
  document.getElementById('methodToggle').checked=includeMethodClaims;toggleMethod();
  restoreClaimUI();
  // Restore custom title type
  if(selectedTitleType){const ci=document.getElementById('customTitleType');if(ci)ci.value=selectedTitleType;document.getElementById('btnStep01').disabled=false;}
  if(selectedTitle){document.getElementById('titleInput').value=selectedTitle;const enInp=document.getElementById('titleInputEn');if(enInp)enInp.value=selectedTitleEn||'';document.getElementById('titleConfirmArea').style.display='block';document.getElementById('titleConfirmMsg').style.display='block';document.getElementById('batchArea').style.display='block';}
  Object.keys(outputs).forEach(k=>{if(outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied'))renderOutput(k,outputs[k]);});
  // Restore diagrams and show download buttons
  if(outputs.step_07_mermaid){renderDiagrams('step_07',outputs.step_07_mermaid);const dl07=document.getElementById('diagramDownload07');if(dl07)dl07.style.display='block';}
  if(outputs.step_11_mermaid){renderDiagrams('step_11',outputs.step_11_mermaid);const dl11=document.getElementById('diagramDownload11');if(dl11)dl11.style.display='block';}
  document.getElementById('headerProjectName').textContent=data.title;document.getElementById('headerUserName').textContent=currentProfile?.display_name||currentUser?.email||'';
  if(currentProfile?.role==='admin')document.getElementById('btnAdmin').style.display='inline-flex';
  updateStats();
  App.showScreen('main');App.updateModelToggle();App.updateProviderLabel();App.showToast(`"${data.title}" 열림`);
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
  // Restore detail level UI
  const dlCards=document.querySelectorAll('#detailLevelCards .selection-card');
  const dlLevels=['compact','standard','detailed','custom'];
  dlCards.forEach((c,i)=>c.classList.toggle('selected',dlLevels[i]===detailLevel));
  const ci=document.getElementById('customDetailInput');
  if(ci)ci.style.display=detailLevel==='custom'?'block':'none';
  if(detailLevel==='custom'){const inp=document.getElementById('customDetailChars');if(inp)inp.value=customDetailChars;}
  // Restore project ref
  const prs=document.getElementById('projectRefStatus');
  if(prs&&projectRefStyleText)prs.innerHTML=`<span class="tossface">✅</span> 등록됨 (${projectRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearProjectRef()" style="margin-left:4px">✕</button>`;
}

async function backToDashboard(){if(currentProjectId)await saveProject(true);clearAllState();App.showScreen('dashboard');}
async function confirmDeleteProject(id,t){if(!confirm(`"${t}" 사건을 삭제하시겠어요?`))return;await App.sb.from('projects').delete().eq('id',id);App.showToast('삭제됨');loadDashboardProjects();}
async function saveProject(silent=false){if(!currentProjectId)return;const t=selectedTitle||document.getElementById('projectInput').value.slice(0,30)||'새 사건';await App.sb.from('projects').update({title:t,invention_content:document.getElementById('projectInput').value,current_state_json:{outputs,selectedTitle,selectedTitleEn,selectedTitleType,includeMethodClaims,usage,deviceCategory,deviceGeneralDep,deviceAnchorDep,deviceAnchorStart,anchorThemeMode,selectedAnchorThemes,methodCategory,methodGeneralDep,methodAnchorDep,methodAnchorStart,methodAnchorThemeMode,selectedMethodAnchorThemes,projectRefStyleText,requiredFigures,detailLevel,customDetailChars,diagramData}}).eq('id',currentProjectId);if(!silent)App.showToast('저장됨');}

// ═══════════ TAB & TOGGLES & CLAIM UI (v4.7) ═══════════
function switchTab(i){document.querySelectorAll('.tab-item').forEach((t,j)=>{t.classList.toggle('active',j===i);t.setAttribute('aria-selected',j===i);});document.querySelectorAll('.page').forEach((p,j)=>p.classList.toggle('active',j===i));if(i===4)renderPreview();}
function toggleMethod(){
  includeMethodClaims=document.getElementById('methodToggle').checked;
  ['methodClaimsCard','methodDiagramCard','methodDescCard'].forEach(id=>{
    const e=document.getElementById(id);
    if(e){
      e.classList.toggle('card-disabled',!includeMethodClaims);
      e.style.opacity=includeMethodClaims?'1':'0.4';
      e.style.pointerEvents=includeMethodClaims?'':'none';
    }
  });
}
function selectDetailLevel(el,level){
  document.querySelectorAll('#detailLevelCards .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');detailLevel=level;
  const ci=document.getElementById('customDetailInput');
  if(ci) ci.style.display = level==='custom' ? 'block' : 'none';
  // 사용자 지정 모드일 때 입력값 동기화
  if(level==='custom'){
    const inp=document.getElementById('customDetailChars');
    if(inp) inp.onchange=function(){customDetailChars=parseInt(this.value)||2000;};
  }
}

// Claim config update handlers
function updateDeviceCategory(v){deviceCategory=v;}
function updateDeviceGeneralDep(v){deviceGeneralDep=parseInt(v)||0;autoCalcDeviceAnchorStart();updateDeviceClaimTotal();updateMethodClaimTotal();}
function updateDeviceAnchorDep(v){deviceAnchorDep=parseInt(v)||0;autoCalcDeviceAnchorStart();updateDeviceClaimTotal();updateMethodClaimTotal();}
function updateDeviceAnchorStart(v){deviceAnchorStart=parseInt(v)||2;updateDeviceClaimTotal();}
function autoCalcDeviceAnchorStart(){
  // Anchor claims start right after general claims
  deviceAnchorStart=1+deviceGeneralDep+1; // independent(1) + general deps + 1
  const el=document.getElementById('inpDeviceAnchorStart');if(el)el.value=deviceAnchorStart;
}
function updateDeviceClaimTotal(){
  const total=1+deviceGeneralDep+deviceAnchorDep;
  const genStart=2, genEnd=1+deviceGeneralDep;
  const anchorEnd=deviceAnchorStart+deviceAnchorDep-1;
  const el=document.getElementById('deviceClaimTotal');
  // Validate: anchor start should be genEnd+1
  const expectedAnchorStart=genEnd+1;
  let warn='';
  if(deviceAnchorDep>0 && deviceAnchorStart!==expectedAnchorStart){
    warn=` ⚠️ 앵커 시작번호 보정: ${deviceAnchorStart}→${expectedAnchorStart}`;
    deviceAnchorStart=expectedAnchorStart;
    const das=document.getElementById('inpDeviceAnchorStart');if(das)das.value=deviceAnchorStart;
  }
  if(el){
    let txt=`독립항 1 (청구항 1)`;
    if(deviceGeneralDep>0) txt+=` + 일반 ${deviceGeneralDep} (청구항 ${genStart}~${genEnd})`;
    if(deviceAnchorDep>0) txt+=` + 앵커 ${deviceAnchorDep} (청구항 ${deviceAnchorStart}~${deviceAnchorStart+deviceAnchorDep-1})`;
    txt+=` = 총 ${total}개${warn}`;
    el.textContent=txt;
  }
}
function toggleDeviceAnchorThemes(mode){
  anchorThemeMode=mode;
  const el=document.getElementById('deviceThemeList');
  if(el)el.style.display=mode==='fixed'?'flex':'none';
}
function toggleDeviceTheme(key,checked){
  if(checked&&!selectedAnchorThemes.includes(key))selectedAnchorThemes.push(key);
  else selectedAnchorThemes=selectedAnchorThemes.filter(k=>k!==key);
}

function updateMethodCategory(v){methodCategory=v;}
function updateMethodGeneralDep(v){methodGeneralDep=parseInt(v)||0;updateMethodClaimTotal();}
function updateMethodAnchorDep(v){methodAnchorDep=parseInt(v)||0;updateMethodClaimTotal();}
function autoCalcMethodAnchorStart(){
  const devTotal=1+deviceGeneralDep+deviceAnchorDep;
  const methodIndep=devTotal+1;
  // Anchor starts right after method general deps
  methodAnchorStart=methodIndep+methodGeneralDep+1;
}
function updateMethodClaimTotal(){
  const devTotal=1+deviceGeneralDep+deviceAnchorDep;
  const methodIndep=devTotal+1;
  const genStart=methodIndep+1;
  const genEnd=methodIndep+methodGeneralDep;
  autoCalcMethodAnchorStart();
  const anchorEnd=methodAnchorStart+methodAnchorDep-1;
  const total=1+methodGeneralDep+methodAnchorDep;
  const el=document.getElementById('methodClaimTotal');
  if(el){
    let txt=`독립항 1 (청구항 ${methodIndep})`;
    if(methodGeneralDep>0) txt+=` + 일반 ${methodGeneralDep} (청구항 ${genStart}~${genEnd})`;
    if(methodAnchorDep>0) txt+=` + 앵커 ${methodAnchorDep} (청구항 ${methodAnchorStart}~${anchorEnd})`;
    txt+=` = 총 ${total}개`;
    el.textContent=txt;
  }
}
function toggleMethodAnchorThemes(mode){
  methodAnchorThemeMode=mode;
  const el=document.getElementById('methodThemeList');
  if(el)el.style.display=mode==='fixed'?'flex':'none';
}
function toggleMethodTheme(key,checked){
  if(checked&&!selectedMethodAnchorThemes.includes(key))selectedMethodAnchorThemes.push(key);
  else selectedMethodAnchorThemes=selectedMethodAnchorThemes.filter(k=>k!==key);
}

// ═══ Required Figures ═══
function addRequiredFigure(){
  const numEl=document.getElementById('inpRequiredFigNum'),descEl=document.getElementById('inpRequiredFigDesc');
  const fileEl=document.getElementById('inpRequiredFigFile');
  const num=parseInt(numEl?.value);const desc=descEl?.value?.trim();
  if(!num||num<1){App.showToast('도면 번호를 입력하세요','error');return;}
  if(!desc){App.showToast('도면 설명을 입력하세요','error');return;}
  if(requiredFigures.find(f=>f.num===num)){App.showToast(`도 ${num}은 이미 등록됨`,'error');return;}
  const figData={num,description:desc};
  // Handle file upload if present
  if(fileEl&&fileEl.files&&fileEl.files[0]){
    const file=fileEl.files[0];
    figData.fileName=file.name;
    figData.fileSize=file.size;
    // Store as data URL for preview (optional)
    const reader=new FileReader();
    reader.onload=function(e){figData.fileDataUrl=e.target.result;renderRequiredFiguresList();};
    reader.readAsDataURL(file);
  }
  requiredFigures.push(figData);
  requiredFigures.sort((a,b)=>a.num-b.num);
  if(numEl)numEl.value='';if(descEl)descEl.value='';if(fileEl)fileEl.value='';
  renderRequiredFiguresList();
  App.showToast(`도 ${num} 필수 도면 등록${figData.fileName?' (파일: '+figData.fileName+')':''}`);
}
function removeRequiredFigure(num){
  requiredFigures=requiredFigures.filter(f=>f.num!==num);
  renderRequiredFiguresList();
}
function renderRequiredFiguresList(){
  const el=document.getElementById('requiredFiguresList');if(!el)return;
  if(!requiredFigures.length){el.innerHTML='';return;}
  el.innerHTML=requiredFigures.map(f=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:4px;font-size:13px"><span class="badge badge-primary">도 ${f.num}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(f.description)}</span>${f.fileName?`<span class="badge badge-success" title="${App.escapeHtml(f.fileName)}">📎 파일</span>`:''}<button class="btn btn-ghost btn-sm" onclick="removeRequiredFigure(${f.num})">✕</button></div>`).join('');
}

// ═══ Project Reference Document ═══
async function handleProjectRefUpload(event){
  const file=event.target.files[0];if(!file)return;
  const st=document.getElementById('projectRefStatus');
  st.textContent='추출 중...';st.style.color='var(--color-primary)';
  try{
    const text=await App.extractTextFromFile(file);
    if(text&&text.trim()&&!text.startsWith('[')){
      projectRefStyleText=text.trim().slice(0,5000);
      st.innerHTML=`<span class="tossface">✅</span> ${App.escapeHtml(file.name)} (${projectRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearProjectRef()" style="margin-left:4px">✕</button>`;
      st.style.color='var(--color-success)';
      App.showToast('이 프로젝트 전용 참고 문서 등록 (공통 참고 문서 대신 사용)');
    }else{st.textContent='추출 불가';st.style.color='var(--color-error)';}
  }catch(e){st.textContent='오류';st.style.color='var(--color-error)';}
  event.target.value='';
}
function clearProjectRef(){projectRefStyleText='';const st=document.getElementById('projectRefStatus');if(st){st.textContent='없음 (공통 참고 문서 사용)';st.style.color='var(--color-text-tertiary)';}App.showToast('프로젝트 참고 문서 제거됨');}

function selectTitleType(el,type){document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selectedTitleType=type;const ci=document.getElementById('customTitleType');if(ci)ci.value=type;document.getElementById('btnStep01').disabled=false;autoSetDeviceCategoryFromType(type);App.showToast(`발명 유형: ~${type}`);}
function onCustomTitleType(val){const v=val.trim();if(v){selectedTitleType=v;document.querySelectorAll('#titleTypeCards .selection-card').forEach(c=>c.classList.remove('selected'));document.getElementById('btnStep01').disabled=false;autoSetDeviceCategoryFromType(v);}else{selectedTitleType='';document.getElementById('btnStep01').disabled=true;}}
function selectTitle(el,kr,en){
  // 모든 후보의 선택 해제
  document.querySelectorAll('#resultStep01 .title-candidate-row').forEach(c=>{
    c.classList.remove('selected');
    c.style.borderColor='var(--color-border)';
    c.style.background='#fff';
  });
  // 선택된 항목 강조
  el.classList.add('selected');
  el.style.borderColor='var(--color-primary)';
  el.style.background='var(--color-primary-light)';
  
  selectedTitle=kr;
  selectedTitleEn=en||'';
  document.getElementById('titleInput').value=kr;
  const enInp=document.getElementById('titleInputEn');
  if(enInp)enInp.value=en||'';
  document.getElementById('titleConfirmArea').style.display='block';
  document.getElementById('titleConfirmMsg').style.display='block';
  document.getElementById('batchArea').style.display='block';
  autoSetDeviceCategoryFromTitle(kr);
}
function onTitleInput(){const v=document.getElementById('titleInput').value.trim();document.querySelectorAll('#resultStep01 .selection-card').forEach(c=>c.classList.remove('selected'));selectedTitle=v;document.getElementById('titleConfirmMsg').style.display=v?'block':'none';document.getElementById('batchArea').style.display=v?'block':'none';if(v)autoSetDeviceCategoryFromTitle(v);}
function onTitleEnInput(){selectedTitleEn=document.getElementById('titleInputEn')?.value?.trim()||'';}

// ═══ Auto Device Category from Title/Type (v5.2) ═══
function autoSetDeviceCategoryFromType(type){
  if(!type)return;
  let devCat='server';
  if(/서버/.test(type))devCat='server';
  else if(/시스템/.test(type))devCat='system';
  else if(/장치/.test(type))devCat='apparatus';
  else if(/단말|전자/.test(type))devCat='electronic_device';
  deviceCategory=devCat;
  const sel=document.getElementById('selDeviceCategory');if(sel)sel.value=devCat;
  // Also set method category
  if(/방법/.test(type)){methodCategory='method';const mc=document.getElementById('selMethodCategory');if(mc)mc.value='method';}
  if(/기록매체/.test(type)){methodCategory='recording_medium';const mc=document.getElementById('selMethodCategory');if(mc)mc.value='recording_medium';}
  if(/컴퓨터\s*프로그램/.test(type)){methodCategory='computer_program_product';const mc=document.getElementById('selMethodCategory');if(mc)mc.value='computer_program_product';}
}
function autoSetDeviceCategoryFromTitle(title){
  if(!title)return;
  // Extract category from title ending
  if(/서버\s*$/.test(title))autoSetDeviceCategoryFromType('서버');
  else if(/시스템\s*$/.test(title))autoSetDeviceCategoryFromType('시스템');
  else if(/장치\s*$/.test(title))autoSetDeviceCategoryFromType('장치');
  else if(/(단말|단말기)\s*$/.test(title))autoSetDeviceCategoryFromType('전자단말');
  else if(/방법\s*$/.test(title))autoSetDeviceCategoryFromType('방법');
  // Compound: "서버 및 방법"
  if(/서버\s*(및|와|,)\s*방법/.test(title)){autoSetDeviceCategoryFromType('서버 및 방법');}
}

// ═══════════ HELPERS ═══════════
function getLatestDescription(){return outputs.step_13_applied||outputs.step_09||outputs.step_08||'';}
// 정형문 수동 삽입: 현재 Step 8 결과에 정형문을 전후에 삽입
function insertBoilerplate(){
  const cur=outputs.step_08||'';
  if(!cur){App.showToast('상세설명이 없습니다. 먼저 Step 8을 생성하세요.','error');return;}
  // Check if already has boilerplate
  if(hasBoilerplate(cur)){App.showToast('이미 정형문이 삽입되어 있습니다.','info');return;}
  outputs.step_08=STEP8_PREFIX+'\n\n'+cur+'\n\n'+STEP8_SUFFIX;
  renderOutput('step_08',outputs.step_08);
  // Also update step_09 and step_13_applied if they exist
  if(outputs.step_09&&!hasBoilerplate(outputs.step_09)){outputs.step_09=STEP8_PREFIX+'\n\n'+outputs.step_09+'\n\n'+STEP8_SUFFIX;}
  if(outputs.step_13_applied&&!hasBoilerplate(outputs.step_13_applied)){outputs.step_13_applied=STEP8_PREFIX+'\n\n'+outputs.step_13_applied+'\n\n'+STEP8_SUFFIX;}
  App.showToast('정형문 삽입 완료 (본문 전후에 자동 삽입됨)');
}
function hasBoilerplate(text){
  return text&&text.includes('이하, 본 발명의 실시예를 첨부된 도면을');
}
function getFullDescription(){
  const body=getLatestDescription();
  if(!body)return '';
  // If boilerplate already inserted manually, don't double-insert
  if(hasBoilerplate(body))return body;
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
    if (uploadedFiles.find(f => f.name === file.name)) {App.showToast(`"${file.name}" 이미 추가됨`, 'info');continue;}
    const item = document.createElement('div');item.className = 'file-upload-item';item.id = `file_${uploadedFiles.length}`;
    item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:6px;font-size:13px';
    item.innerHTML = `<span class="tossface">📄</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(file.name)}</span><span class="badge badge-neutral">${App.formatFileSize(file.size)}</span><span style="color:var(--color-primary)">추출 중...</span>`;
    listEl.appendChild(item);
    try {
      const text = await App.extractTextFromFile(file);
      if (text && text.trim()) {
        uploadedFiles.push({ name: file.name, text: text.trim(), size: file.size });
        const ta = document.getElementById('projectInput');const separator = ta.value.trim() ? '\n\n' : '';
        ta.value += `${separator}[첨부: ${file.name}]\n${text.trim()}`;
        item.innerHTML = `<span class="tossface">✅</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(file.name)}</span><span class="badge badge-success">${App.formatFileSize(file.size)} · ${text.trim().length.toLocaleString()}자</span><button class="btn btn-ghost btn-sm" onclick="removeUploadedFile(${uploadedFiles.length - 1},'${App.escapeHtml(file.name).replace(/'/g, "\\'")}')">✕</button>`;
        App.showToast(`"${file.name}" 추출 완료`);
      } else {
        item.innerHTML = `<span class="tossface">⚠️</span><span style="flex:1">${App.escapeHtml(file.name)}</span><span class="badge badge-warning">추출 불가</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>`;
      }
    } catch (e) {
      item.innerHTML = `<span class="tossface">❌</span><span style="flex:1">${App.escapeHtml(file.name)}</span><span class="badge badge-error">오류</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>`;
    }
  }
  event.target.value = '';
}
function removeUploadedFile(idx, name) {
  const f = uploadedFiles[idx];if (!f) return;
  const ta = document.getElementById('projectInput');const marker = `[첨부: ${f.name}]`;const mIdx = ta.value.indexOf(marker);
  if (mIdx >= 0) {const nextMarker = ta.value.indexOf('\n\n[첨부:', mIdx + marker.length);const endIdx = nextMarker >= 0 ? nextMarker : ta.value.length;ta.value = (ta.value.slice(0, mIdx) + ta.value.slice(endIdx)).trim();}
  uploadedFiles.splice(idx, 1);const el = document.getElementById(`file_${idx}`);if (el) el.remove();App.showToast(`"${name}" 제거됨`);
}
// (File extraction functions are in common.js — App.extractTextFromFile, App.formatFileSize)

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
function autoDetectCategoryFromTitle(){
  const t=selectedTitle||'';const ty=selectedTitleType||'';
  if(/서버/.test(ty)||/서버/.test(t))return 'server';
  if(/시스템/.test(ty)||/시스템/.test(t))return 'system';
  if(/장치/.test(ty)||/장치/.test(t))return 'apparatus';
  if(/단말|전자/.test(ty)||/단말|전자/.test(t))return 'electronic_device';
  return 'server';
}

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
      // v4.9: Auto-select category from title type if set to 'auto'
      const effectiveCat=(deviceCategory==='auto')?autoDetectCategoryFromTitle():deviceCategory;
      const catLabel=effectiveCat;
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

★★ 종속항 작성 규칙 (대통령령 — 위반 시 기재불비) ★★
① 종속항은 독립항 또는 다른 종속항 중 1 또는 2 이상의 항을 인용하되, 인용 항의 번호를 기재
② 2 이상의 항을 인용하는 종속항(다중인용)은 인용 항 번호를 택일적으로 기재 ("제N항 또는 제M항에 있어서")
③ 다중인용 종속항은 다른 다중인용 종속항을 인용 불가 (다중인용의 다중인용 금지)
④ 종속항은 인용하는 독립항 또는 종속항보다 뒤에 기재 (번호 역전 금지)

(R5) 등록 앵커 종속항 (청구항 ${deviceAnchorStart}부터):
- 신규성/진보성 방어용 \"창의적·구체적 기술수단\" 포함
- 수치·수식·기호 과다 기재 금지 (후속 단계에서 정량화)
- 아래 A~C 중 최소 2개 포함:
  A) 다단계 처리(2단계 이상): 전처리→산출→보정 등
  B) 조정 가능한 기준값/가중치/신뢰도/품질지표 사용
  C) 검증/보정/피드백/폴백/재시도 중 하나 이상의 루프 또는 조건부 분기
- 발명 내용에 근거가 있는 요소/처리/효과만으로 구성

⛔ (R6) 장치/방법 구분 — 절대 준수
- 이것은 "장치" 청구항이다. "방법"이 아니다.
- "~하는 단계", "S100", "S200" 등 방법 표현 절대 금지
- "~부", "~모듈", "~유닛" 등 장치 구성요소 명칭 사용
- 동작은 "~하도록 구성되는", "~을 수행하는" 형태로 표현

[앵커 테마 배정 — 내부 지침, 출력 금지]
${themeInst}

[출력 형식]
【청구항 1】형식. 청구항만 출력. 테마/키워드/점검 내용 출력 금지.
\"청구항 N에 있어서,\" 시작. SW명 금지. 제한성 표현 금지.

★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}${getFullInvention()}${styleRef}`;}

    // ═══ Step 7: 도면 설계 (도면 규칙 v4.0) ═══
    case 'step_07':{
      const f=document.getElementById('optDeviceFigures').value;
      const reqInst=getRequiredFiguresInstruction();
      const skipNums=requiredFigures.map(rf=>rf.num);
      const genCount=parseInt(f)-(requiredFigures.length);
      return `【장치 청구범위】에 대한 도면을 설계하라. 총 도면 수: ${f}개.
${reqInst?`\n사용자가 보유한 필수 도면: ${requiredFigures.length}개 (${skipNums.map(n=>'도 '+n).join(', ')}).\n새로 생성할 도면: ${genCount>0?genCount:0}개.\n필수 도면 번호는 건너뛰고 나머지 번호로 생성하라.`:''}

════════════════════════════════════════════════════════════════
★★★ 특허 도면 생성 규칙 v4.0 ★★★
════════════════════════════════════════════════════════════════

⛔⛔⛔ 절대 금지 사항 ⛔⛔⛔
- "~단계", "S100", "S200" 등 방법 표현 금지
- "~모듈" 표현 금지 → 반드시 "~부"로 통일 (예: 송신부, 수신부, 제어부)
- 이 도면은 오직 "장치의 구성요소"만 표현

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R1] 도면부호 계층 체계 (레벨별 번호 단위 고정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ L1 (최상위 장치): X00 형식 — 100 단위
  서버(100), 사용자 단말(200), 외부 시스템(300), 데이터베이스(400), 네트워크(500)

■ L2 (L1 하위 구성): XY0 형식 — 10 단위
  서버(100) 하위: 통신부(110), 프로세서(120), 메모리(130), 저장부(140)
  사용자 단말(200) 하위: 입력부(210), 출력부(220), 제어부(230)

■ L3 (L2 하위 요소): XYZ 형식 — 1 단위
  통신부(110) 하위: 송신부(111), 수신부(112), 암호화부(113)
  프로세서(120) 하위: 연산부(121), 캐시부(122)

■ 핵심 원칙
  - 부모 접두(prefix) 유지: 130의 하위는 131, 132...
  - 동일 도면세트 내 번호 중복 금지
  - 레벨 혼합 금지: L2에 111 같은 번호 사용 금지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R2] 박스 소속(Ownership) 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 박스 = 해당 장치의 "구비/보유" 범위
  "A가 X를 구비한다" → X는 반드시 A 박스 내부에 배치

■ 소속 위반 금지
  서버(100)가 프로세서(110)를 구비 → 110은 100 박스 내부에만 존재
  110이 200 박스 안에 들어가면 오류

■ 공통 구성 표현
  서버와 단말 모두 프로세서 보유 시:
  - 서버 프로세서: 프로세서(110)
  - 단말 프로세서: 프로세서(210)
  각자 자기 박스 내부에 배치 (번호 분리)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R3] 도면별 표현 레벨 ★핵심★
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 도 1: 전체 시스템 구성도 (System Overview)
  ✅ 허용: L1 장치 박스만 — 100, 200, 300, 400...
  ✅ 허용: L1 장치 박스들 간의 연결선만
  ⛔ 금지: L2/L3 하위 구성요소(110, 120, 111...) 표시 금지
  ⛔ 금지: 하위 요소 간 연결선 금지
  ⛔ 금지: 최외곽 박스 생성 금지 (L1만 있으므로 외곽 불필요)
  
  도 1 예시:
  [서버(100)] ←→ [사용자 단말(200)] ←→ [데이터베이스(400)]

■ 도 2 이후: 세부 블록도 (Detailed Block Diagram)
  ⛔⛔ 핵심: 한 도면에는 반드시 "한 레벨"만 표시 ⛔⛔
  최외곽 박스 = 상위 장치
  내부 박스 = 그 상위 장치의 직계 자식 레벨만
  
  ✅ 올바른 예 (도 2: 서버 상세):
  최외곽=서버(100), 내부=L2만: 통신부(110), 프로세서(120), 메모리(130)
  
  ✅ 올바른 예 (도 3: 프로세서 상세):
  최외곽=프로세서(120), 내부=L3만: 연산부(121), 캐시부(122)
  
  ⛔ 잘못된 예 (L2+L3 혼합):
  최외곽=서버(100), 내부=프로세서(110)+연산부(111)+캐시부(112)+메모리(120)
  → 110은 L2, 111/112는 L3 → 레벨 혼합 오류!
  → 올바른 방법: 도 2에 L2만, 도 3에 L3만 분리
  
  도 2 예시 (서버(100) 상세):
  ┌─────────────────────────────────┐
  │        서버(100)                 │ ← 최외곽
  │  ┌───────┐  ┌───────┐  ┌───────┐│
  │  │통신부 │  │프로세서│  │메모리 ││
  │  │ (110) │  │ (120) │  │ (130) ││
  │  └───────┘  └───────┘  └───────┘│
  └─────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R4] 연결(연동) 표현 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 도 1: L1 박스 ↔ L1 박스 연결만
  서버(100) ↔ 사용자 단말(200) 연결선 허용
  하위 요소(110, 210) 간 연결선 금지

■ 도 2+: 내부 구성요소 간 연결 가능
  통신부(110) ↔ 프로세서(120) 연결선 허용

■ 연결선 의미
  실선: 통신/데이터 링크
  양방향 화살표: 상호 데이터 교환

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R5] 직계 부모 일치 규칙 (세대 점프 금지) ★★★핵심★★★
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 최외곽 박스 = 내부 구성요소들의 "직계 부모(Immediate Parent)"
  ⛔ 조부모(Grandparent)로 건너뛰기 금지

■ 예시 (계층 구조)
  서버(100)
    └─ 프로세서(110)
         └─ 정보수신부(111), 알림산출부(112), 전송부(113)

■ 올바른 표기
  도 3 내부: 정보수신부(111), 알림산출부(112), 전송부(113)
  도 3 최외곽 박스: 프로세서(110) ✅ (직계 부모)

■ 잘못된 표기
  도 3 내부: 정보수신부(111), 알림산출부(112), 전송부(113)
  도 3 최외곽 박스: 서버(100) ❌ (세대 점프 - 조부모)

■ 직계 부모 계산법
  - L3 구성요소(111,112,113) → 직계 부모 = L2(110)
  - L2 구성요소(110,120,130) → 직계 부모 = L1(100)
  - 공식: 마지막 자리를 0으로 변환

════════════════════════════════════════════════════════════════

[파트1: 도면 설계 출력 형식]

도 1: 전체 시스템 구성도
유형: 블록도 (최외곽 박스 없음)
구성요소: L1 장치만 나열
- 서버(100)
- 사용자 단말(200)
- 데이터베이스(400)
연결관계: 서버(100) ↔ 사용자 단말(200) ↔ 데이터베이스(400)

도 2: 서버(100) 상세 블록도
유형: 블록도 (최외곽 = 서버(100))
구성요소: 서버(100) 내부 L2 구성
- 통신부(110)
- 프로세서(120)
- 메모리(130)
- 저장부(140)
연결관계: 통신부(110) ↔ 프로세서(120) ↔ 메모리(130)

도 3: 프로세서(120) 상세 블록도 (L3 상세화 예시)
유형: 블록도 (최외곽 = 프로세서(120), 서버(100)가 아님!)
구성요소: 프로세서(120) 내부 L3 구성
- 연산부(121)
- 캐시부(122)
- 제어부(123)

(도면 수에 맞게 도 4, 도 5... 추가)

[파트2: 도면의 간단한 설명]
---BRIEF_DESCRIPTIONS---
${requiredFigures.map(rf=>`도 ${rf.num}은 ${rf.description}을 나타내는 도면이다.`).join('\n')}
도 1은 본 발명의 전체 시스템 구성을 나타내는 블록도이다.
도 2는 서버(100)의 내부 구성을 나타내는 블록도이다.

★★★ "~모듈" 절대 금지 → "~부"로 통일 ★★★
★★★ 도 1은 L1(100,200,300,400) 장치만, 최외곽 박스 없음 ★★★
★★★ 도 2+: 최외곽 = 직계 부모 (세대 점프 금지!) ★★★

${T}\n[장치 청구범위] ${outputs.step_06||''}\n[발명 요약] ${document.getElementById('projectInput').value.slice(0,1500)}`;}

    case 'step_08':{
      const dlCfg={
        compact:{charPerFig:'약 1,000자',total:'약 3,000~4,000자',extra:'핵심 구성요소 중심으로 간결하게 기술하라. 변형 실시예는 1개만.'},
        standard:{charPerFig:'약 1,500자',total:'약 5,000~7,000자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 설명하라. 주요 구성요소에 변형 실시예 포함.'},
        detailed:{charPerFig:'약 2,000자 이상',total:'8,000~10,000자',extra:'각 도면마다 구성요소의 기능, 동작 원리, 데이터 흐름, 상호 연동 관계를 상세히 설명하라. 변형 실시예를 통해 다양한 구현 방식을 기술하라. 절대 축약하지 마라.'},
        custom:{charPerFig:'약 '+customDetailChars+'자',total:'약 '+(customDetailChars*parseInt(document.getElementById('optDeviceFigures')?.value||4))+'자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 설명하라. 변형 실시예를 포함하라.'}
      }[detailLevel];
      return `아래 발명에 대한 【발명을 실시하기 위한 구체적인 내용】의 본문만 작성하라.

⛔ 이것은 "장치" 상세설명이다. 방법(~하는 단계, S100 등)은 포함하지 마라.

규칙:
- 이 항목만 작성. 기술분야, 배경기술, 과제, 효과 등 다른 항목 포함 금지.
- 서버(100)를 주어로 사용. \"구성요소(참조번호)\" 형태 — 예: 통신부(110), 프로세서(120).
- 도면별 \"도 N을 참조하면,\" 형태로 시작.
- 특허문체(~한다). 글머리 기호/마크다운 절대 금지.
- 청구항의 모든 구성요소를 빠짐없이 포함하여 설명하라. 절대 생략 금지.
- 등록 앵커 종속항(창의적·구체적 기술수단 포함)의 다단계 처리, 기준값/가중치 동작 원리, 검증/보정 루프를 구체적으로 설명하라.
- 각 핵심 구성요소에 대해 변형 실시예를 포함하라.
- 제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.

⛔ 금지 사항:
- "~하는 단계", "S100", "S200" 등 방법 표현 금지
- 방법 상세설명은 Step 12에서 별도 작성됨

★ 분량 규칙:
- 도면 1개당 ${dlCfg.charPerFig}(공백 포함)
- 총 분량 ${dlCfg.total}(공백 포함). 본문 전후 정형문 글자수 제외.
- ${dlCfg.extra}

★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}\n[장치 청구범위] ${outputs.step_06||''}\n[장치 도면] ${outputs.step_07||''}${getFullInvention()}${styleRef}`;}

    case 'step_09':return `상세설명의 핵심 알고리즘에 수학식 5개 내외.\n규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.\n출력:\n---MATH_BLOCK_1---\nANCHOR: (삽입위치 문장 20자 이상)\nFORMULA:\n【수학식 1】\n(수식)\n여기서, (파라미터)\n예시 대입: (수치)\n\n${T}\n[현재 상세설명] ${outputs.step_08||''}`;

    // ═══ Step 10: 방법 청구항 (장치와 완전 분리) ═══
    case 'step_10':{
      const s=getLastClaimNumber(outputs.step_06||'')+1;
      const totalDep=methodGeneralDep+methodAnchorDep;
      const mAnchorStart=s+methodGeneralDep+1;
      const catLabel=methodCategory==='auto'?'발명에 가장 적합한 카테고리를 선택하라':methodCategory;
      const themeInst=buildAnchorThemeInstruction(methodAnchorThemeMode,selectedMethodAnchorThemes,methodAnchorDep);
      return `방법 청구항을 작성하라.

⛔ 이것은 "방법" 청구항이다. "장치"가 아니다.
- 모든 단계는 "~하는 단계"로 표현
- 장치 구성요소(통신부, 프로세서 등)가 아닌 "동작/처리 단계"로 기술

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

★★ 청구항 번호 규칙 (필수) ★★
- 장치 청구항의 마지막 번호가 ${s-1}이므로, 방법 독립항은 반드시 【청구항 ${s}】부터 시작
- 방법 종속항은 반드시 방법 독립항(청구항 ${s}) 또는 방법 종속항만 인용
- 장치 청구항(청구항 1~${s-1})을 인용해서는 안 됨

★★ 종속항 작성 규칙 (대통령령 — 위반 시 기재불비) ★★
① 종속항은 독립항 또는 다른 종속항 중 1 또는 2 이상의 항을 인용하되, 인용 항의 번호를 기재
② 2 이상의 항을 인용하는 종속항(다중인용)은 인용 항 번호를 택일적으로 기재 (\"제N항 또는 제M항에 있어서\")
③ 다중인용 종속항은 다른 다중인용 종속항을 인용 불가 (다중인용의 다중인용 금지)
④ 종속항은 인용하는 독립항 또는 종속항보다 뒤에 기재 (번호 역전 금지)

[필수 작성 규칙] R1~R5 장치 청구항과 동일하게 적용.
앵커 종속항은 (R5) 규칙 동일 적용: A~C 중 최소 2개 포함.

[앵커 테마 배정 — 내부 지침, 출력 금지]
${themeInst}

[출력 형식] 【청구항 ${s}】부터. 청구항만 출력. 제한성 표현 금지.

★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}\n[장치 청구항 — 참고용] ${outputs.step_06||''}\n[장치 상세설명 — 참고용] ${(outputs.step_08||'').slice(0,3000)}${getFullInvention()}${styleRef}`;}

    // ═══ Step 11: 방법 도면 (S+숫자 단계번호 체계) ═══
    case 'step_11':{
      const f=document.getElementById('optMethodFigures').value;
      const lf=getLastFigureNumber(outputs.step_07||'');
      return `【방법 청구범위】에 대한 흐름도를 설계하라. 총 ${f}개, 도 ${lf+1}부터.

⛔⛔⛔ 절대 금지 사항 (위반 시 도면 전체 무효) ⛔⛔⛔
- 장치 구성요소(통신부, 프로세서, ~부, ~모듈 등) 포함 금지
- 숫자만 있는 참조번호(100, 110, 200 등) 사용 금지
- 이 도면은 오직 "방법의 단계"만 표현한다

★★★ 흐름도 필수 규칙 ★★★
① 최외곽 박스 없음 — 흐름도는 장치가 아니므로 감싸는 프레임 박스 불필요
② 단방향 화살표(→)만 사용 — 순서의 흐름을 나타내므로 양방향(↔) 금지
③ "시작"과 "종료" 노드 필수 포함 — 첫 단계 전에 "시작", 마지막 단계 후에 "종료"
④ 조건 분기가 있으면 다이아몬드(마름모) 노드 사용

[방법 단계번호 체계 — 필수 준수]

■ 단계번호 형식: S + 숫자
- 도면 번호 기반: S${lf+1}01, S${lf+1}02, S${lf+1}03...
- 예시 (도 ${lf+1}): S${lf+1}01(첫 번째 단계), S${lf+1}02(두 번째 단계)...

■ 단계명 형식
- 반드시 "~단계" 또는 "~하는 단계"로 끝나야 함
- 예: "데이터 수신 단계(S${lf+1}01)", "패턴 분석 단계(S${lf+1}02)"

■ 핵심 규칙
- 각 단계명에 단계번호를 반드시 포함: "사용자 인증 단계(S${lf+1}01)"
- 장치 도면(Step 7)의 구성요소는 참조하되, 도면에 직접 포함하지 마라
- 방법 청구항의 모든 단계를 빠짐없이 반영

[파트1: 도면 설계]
각 도면별로 아래 형식 출력:
---
도 ${lf+1}: (방법 이름) 흐름도
유형: 순서도 (최외곽 박스 없음)
단계 목록:
- 시작
- (단계명)(S${lf+1}01)
- (단계명)(S${lf+1}02)
- ...
- 종료
흐름: 시작 → S${lf+1}01 → S${lf+1}02 → ... → 종료 (단방향)
---

[파트2: 도면의 간단한 설명]
---BRIEF_DESCRIPTIONS---
도 ${lf+1}은 (방법 이름)의 (설명)을 나타내는 순서도이다.

★★★ 방법 청구항의 모든 단계를 빠짐없이 흐름도에 반영하라 ★★★
★★★ 최외곽 프레임 박스 절대 금지 — 흐름도는 프레임 없이 단계만 나열 ★★★
★★★ 장치 구성요소(100, 110 등)는 절대 포함 금지 — S로 시작하는 단계번호만 사용 ★★★

${T}\n[방법 청구범위] ${outputs.step_10||''}\n[발명 요약] ${document.getElementById('projectInput').value.slice(0,1500)}`;}

    case 'step_12':return `방법 상세설명. 단계순서에 따라 장치 동작을 참조하여 설명하라. 특허문체. 글머리 금지. 시작: \"이하에서는 앞서 설명한 서버의 구성 및 동작을 참조하여 방법을 설명한다.\" 생략 금지. 제한성 표현 금지.\n\n★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★\n\n${T}\n[방법 청구항] ${outputs.step_10||''}\n[방법 도면] ${outputs.step_11||''}\n[장치 상세설명] ${(outputs.step_08||'').slice(0,3000)}${getFullInvention()}${styleRef}`;
    case 'step_13':return `청구범위와 상세설명 검토:\n1.청구항뒷받침 2.기술적비약 3.수학식정합성 4.반복실시가능성 5.보완/수정 구체적 문장\n${T}\n[청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}\n[상세설명] ${(getLatestDescription()||'').slice(0,6000)}`;
    case 'step_14':return `대안 청구항. 핵심유지 표현달리. 【청구항 N】.\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}`;
    case 'step_15':return `특허성 검토: 아래 청구범위와 상세설명에 대해 다음 항목을 검토하라.

(1) 신규성: 청구항의 구성요소 조합이 선행기술과 구별되는지
(2) 진보성: 기술적 특징이 당업자에게 자명하지 않은 수준인지, 특히 앵커 종속항의 창의성
(3) 명확성: 청구항 표현이 명확하고 뒷받침되는지
(4) 산업상 이용가능성: 실제 구현 가능한 기술인지
(5) 보호범위 최적화: 독립항이 과도하게 좁거나 넓지 않은지, 개선 제안

각 항목별로 평가 결과와 개선 제안을 작성하라.

${T}\n[전체 청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}\n[상세설명 요약] ${(getLatestDescription()||'').slice(0,3000)}\n[발명 내용] ${inv.slice(0,2000)}`;
    case 'step_16':return `발명의 효과. \"본 발명에 따르면,\"시작. 50단어 이내. 마지막: \"본 발명의 효과는 이상에서 언급한 효과로 제한되지 않으며, 언급되지 않은 또 다른 효과들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다.\"\n${T}\n[과제] ${outputs.step_05||''}\n[상세설명] ${(outputs.step_08||'').slice(0,2000)}${styleRef}`;
    case 'step_17':return `과제의 해결 수단. \"본 발명의 일 실시예에 따른\"시작. 마지막: \"본 발명의 기타 구체적인 사항들은 상세한 설명 및 도면들에 포함되어 있다.\"\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}${styleRef}`;
    case 'step_18':{
      const hasMethod=includeMethodClaims&&outputs.step_11;
      return `【부호의 설명】을 작성하라.

형식: "구성요소 : 참조번호" (콜론 사용)
정렬: 참조번호 오름차순

[장치 구성요소 — 숫자만 사용]
- 형식: 100, 110, 111, 200, 210...
- 계층적 체계: L1(X00) → L2(XY0) → L3(XYZ)
- 예시:
  서버 : 100
  통신부 : 110
  수신모듈 : 111
  송신모듈 : 112
  프로세서 : 120
  사용자 단말 : 200

${hasMethod?`[방법 단계 — S+숫자 사용]
- 형식: S401, S402, S403...
- 예시:
  데이터 수신 단계 : S401
  패턴 분석 단계 : S402
  결과 전송 단계 : S403

⚠️ 장치 구성요소(숫자)와 방법 단계(S숫자)를 반드시 구분하여 별도 섹션으로 작성하라.`:`⚠️ 장치 구성요소만 작성하라. 방법 단계(S100 등)는 포함하지 마라.`}

${T}\n[장치 도면] ${outputs.step_07||''}${hasMethod?`\n[방법 도면] ${outputs.step_11||''}`:''}`}
    case 'step_19':return `요약서. 청구항1 기준 150단어. \"본 발명은\"시작.\n출력:\n【요약】\n(본문)\n\n【대표도】\n도 1\n\n위 형식만.\n${T}\n[청구항1] ${(outputs.step_06||'').slice(0,1500)}${styleRef}`;
    default:return '';
  }
}

// ═══════════ STEP EXECUTION ═══════════
let globalProcessing = false;
function setGlobalProcessing(on){
  globalProcessing=on;
  // Disable/enable ALL generation buttons when any task is running
  const allBtns=['btnStep01','btnBatch25','btnStep06','btnStep10','btnStep14','btnStep15','btnStep07','btnStep08','btnStep09','btnStep11','btnStep12','btnStep13','btnApplyReview','btnBatchFinish','btnProvisionalGen','btnInsertBoilerplate'];
  allBtns.forEach(bid=>{const b=document.getElementById(bid);if(b){if(on){b.dataset.prevDisabled=b.disabled;b.disabled=true;b.style.opacity='0.5';}else{b.disabled=b.dataset.prevDisabled==='true';b.style.opacity='';delete b.dataset.prevDisabled;}}});
  // Also disable validation button and tab switches during processing
  document.querySelectorAll('.tab-item').forEach(t=>{if(on){t.style.pointerEvents='none';t.style.opacity='0.7';}else{t.style.pointerEvents='';t.style.opacity='';}});
}
function checkDependency(s){const inv=document.getElementById('projectInput').value.trim();const d={step_01:()=>inv?null:'발명 내용을 먼저 입력',step_06:()=>selectedTitle?null:'명칭을 먼저 확정',step_07:()=>outputs.step_06?null:'장치 청구항 먼저',step_08:()=>(outputs.step_06&&outputs.step_07)?null:'도면 설계 먼저',step_09:()=>outputs.step_08?null:'상세설명 먼저',step_10:()=>outputs.step_06?null:'장치 청구항 먼저',step_11:()=>outputs.step_10?null:'방법 청구항 먼저',step_12:()=>(outputs.step_10&&outputs.step_11)?null:'방법 도면 먼저',step_13:()=>(outputs.step_06&&outputs.step_08)?null:'청구항+상세설명 먼저',step_14:()=>outputs.step_06?null:'장치 청구항 먼저',step_15:()=>outputs.step_06?null:'장치 청구항 먼저'};return d[s]?d[s]():null;}
async function runStep(sid){if(globalProcessing)return;const dep=checkDependency(sid);if(dep){App.showToast(dep,'error');return;}const bm={step_01:'btnStep01',step_06:'btnStep06',step_10:'btnStep10',step_13:'btnStep13',step_14:'btnStep14',step_15:'btnStep15'},bid=bm[sid];setGlobalProcessing(true);loadingState[sid]=true;if(bid)App.setButtonLoading(bid,true);
  try{
    // Step 13: use continuation for long review
    let r;
    if(sid==='step_13'){
      App.showProgress('progressStep13','AI 검토 생성 중...',0,1);
      const text=await App.callClaudeWithContinuation(buildPrompt(sid),'progressStep13');
      r={text};outputs[sid]=text;
    } else {
      r=await App.callClaude(buildPrompt(sid));outputs[sid]=r.text;
    }
    renderOutput(sid,r.text||outputs[sid]);
    // Step 6: auto-validation + multi-round correction (v5.2)
    if(sid==='step_06'){
      let corrected=outputs[sid];
      let correctionRound=0;const maxRounds=3;
      for(correctionRound=0;correctionRound<maxRounds;correctionRound++){
        App.showProgress('progressStep06',`기재불비 검증 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+1,maxRounds*2+1);
        const issues=validateClaims(corrected);
        if(issues.length===0)break;
        App.showProgress('progressStep06',`기재불비 수정 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+2,maxRounds*2+1);
        const issueText=issues.map(i=>i.message).join('\n');
        const fixPrompt=`아래 청구범위에서 기재불비가 발견되었다. 모든 지적사항을 수정하여 완전한 청구범위 전체를 다시 출력하라.\n\n수정 규칙:\n- 【청구항 N】형식 유지\n- \"상기\" 선행기재 누락: 참조하는 상위항(독립항 포함)에 해당 구성요소를 추가하거나, 종속항의 표현을 수정\n- 종속항에서 새로운 용어를 \"상기\"로 참조하려면, 반드시 해당 용어가 상위항에 먼저 기재되어야 한다\n- 상위항에 추가할 때는 독립항의 범위가 과도하게 좁아지지 않도록 주의\n- 제한적 표현: 삭제 또는 비제한적 표현으로 교체\n- 청구항 참조 오류: 올바른 청구항 번호로 수정\n- 종속항 대통령령: ①인용항 번호 기재 ②다중인용시 택일적 기재 ③다중인용의 다중인용 금지 ④번호 역전 금지\n\n[지적사항]\n${issueText}\n\n[원본 청구범위]\n${corrected}`;
        const fixR=await App.callClaude(fixPrompt);corrected=fixR.text;
      }
      outputs[sid]=corrected;renderOutput(sid,corrected);
      const finalIssues=validateClaims(corrected);
      App.showProgress('progressStep06',`완료 (수정 ${correctionRound}회)`,maxRounds*2+1,maxRounds*2+1);
      setTimeout(()=>App.clearProgress('progressStep06'),2000);
      if(finalIssues.length===0)App.showToast(`장치 청구항 완료 (기재불비 없음, ${correctionRound}회 수정)`);
      else App.showToast(`장치 청구항 완료 (${correctionRound}회 수정, ${finalIssues.length}건 잔여 — 경미한 사항)`, 'info');
    }
    // Step 10: auto-validation + multi-round correction (v5.2)
    else if(sid==='step_10'){
      let corrected=outputs[sid];
      let correctionRound=0;const maxRounds=3;
      // ★ 방법 청구항 검증 시 장치 청구항도 참조 컨텍스트로 제공 ★
      const deviceClaimsCtx=outputs.step_06||'';
      for(correctionRound=0;correctionRound<maxRounds;correctionRound++){
        App.showProgress('progressStep10',`기재불비 검증 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+1,maxRounds*2+1);
        // 방법 청구항만 검증 (독립항 자동 감지)
        const issues=validateClaims(corrected);
        if(issues.length===0)break;
        App.showProgress('progressStep10',`기재불비 수정 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+2,maxRounds*2+1);
        const issueText=issues.map(i=>i.message).join('\n');
        const firstClaimNum=corrected.match(/【청구항\s*(\d+)】/)?.[1]||'?';
        const fixPrompt=`아래 방법 청구범위에서 기재불비가 발견되었다. 모든 지적사항을 수정하여 완전한 청구범위 전체를 다시 출력하라.\n\n⛔⛔ 절대 금지: 청구항 번호를 변경하지 마라! 방법 독립항은 반드시 【청구항 ${firstClaimNum}】을 유지해야 한다. 절대로 【청구항 1】로 변경 금지! ⛔⛔\n\n수정 규칙:\n- 【청구항 N】형식 유지 — 번호 변경 금지\n- \"상기\" 선행기재 누락: 방법 독립항(청구항 ${firstClaimNum}) 내에 해당 구성요소를 추가하거나, 종속항의 표현을 수정\n- 종속항에서 새로운 용어를 \"상기\"로 참조하려면, 반드시 해당 용어가 상위항에 먼저 기재되어야 한다\n- 제한적 표현: 삭제 또는 비제한적 표현으로 교체\n- 청구항 참조 오류: 올바른 청구항 번호로 수정\n- 종속항 대통령령: ①인용항 번호 기재 ②다중인용시 택일적 기재 ③다중인용의 다중인용 금지 ④번호 역전 금지\n\n[지적사항]\n${issueText}\n\n[원본 청구범위 — 번호 유지!]\n${corrected}`;
        const fixR=await App.callClaude(fixPrompt);corrected=fixR.text;
      }
      outputs[sid]=corrected;renderOutput(sid,corrected);
      const finalIssues=validateClaims(corrected);
      App.showProgress('progressStep10',`완료 (수정 ${correctionRound}회)`,maxRounds*2+1,maxRounds*2+1);
      setTimeout(()=>App.clearProgress('progressStep10'),2000);
      if(finalIssues.length===0)App.showToast(`방법 청구항 완료 (기재불비 없음, ${correctionRound}회 수정)`);
      else App.showToast(`방법 청구항 완료 (${correctionRound}회 수정, ${finalIssues.length}건 잔여 — 경미한 사항)`, 'info');
    }
    else{
      if(sid==='step_13')document.getElementById('btnApplyReview').style.display='block';
      App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);
    }
    saveProject(true);
  }catch(e){App.showToast(e.message,'error');}finally{loadingState[sid]=false;if(bid)App.setButtonLoading(bid,false);setGlobalProcessing(false);}}
async function runLongStep(sid){if(globalProcessing)return;const dep=checkDependency(sid);if(dep){App.showToast(dep,'error');return;}const bid=sid==='step_08'?'btnStep08':'btnStep12',pid=sid==='step_08'?'progressStep08':'progressStep12';setGlobalProcessing(true);loadingState[sid]=true;App.setButtonLoading(bid,true);App.showProgress(pid,`${STEP_NAMES[sid]} 생성 중...`,0,1);try{const t=await App.callClaudeWithContinuation(buildPrompt(sid),pid);outputs[sid]=t;renderOutput(sid,t);saveProject(true);App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);}catch(e){App.showToast(e.message,'error');}finally{loadingState[sid]=false;App.setButtonLoading(bid,false);App.clearProgress(pid);setGlobalProcessing(false);}}
async function runMathInsertion(){if(globalProcessing)return;const dep=checkDependency('step_09');if(dep){App.showToast(dep,'error');return;}setGlobalProcessing(true);loadingState.step_09=true;App.setButtonLoading('btnStep09',true);try{const r=await App.callClaude(buildPrompt('step_09'));const baseDesc=outputs.step_08||'';outputs.step_09=insertMathBlocks(baseDesc,r.text);renderOutput('step_09',outputs.step_09);saveProject(true);App.showToast('수학식 삽입 완료');}catch(e){App.showToast(e.message,'error');}finally{loadingState.step_09=false;App.setButtonLoading('btnStep09',false);setGlobalProcessing(false);}}

async function applyReview(){
  if(globalProcessing)return;if(!outputs.step_13){App.showToast('검토 결과 없음','error');return;}
  const cur=getLatestDescription();if(!cur){App.showToast('상세설명 없음','error');return;}
  beforeReviewText=cur;setGlobalProcessing(true);loadingState.applyReview=true;App.setButtonLoading('btnApplyReview',true);
  try{
    App.showProgress('progressApplyReview','[1/3] 검토 반영 보완 중...',1,3);
    const dlCfg={compact:{c:'약 1,000자',t:'약 3,000~4,000자'},standard:{c:'약 1,500자',t:'약 5,000~7,000자'},detailed:{c:'약 2,000자 이상',t:'8,000~10,000자'},custom:{c:'약 '+customDetailChars+'자',t:'약 '+(customDetailChars*parseInt(document.getElementById('optDeviceFigures')?.value||4))+'자'}}[detailLevel];
    const improvedDesc=await App.callClaudeWithContinuation(`[검토 결과]를 반영하여 【발명을 실시하기 위한 구체적인 내용】의 본문만 완전히 새로 작성하라.\n\n규칙:\n- 기존 상세설명을 기반으로 검토 지적사항을 모두 보완하라.\n- 이 항목만 작성. 다른 항목 포함 금지.\n- 서버(100)를 주어. \"구성요소(참조번호)\" 형태.\n- 도면별 \"도 N을 참조하면,\" 형태.\n- 특허문체(~한다). 글머리 금지. 생략 금지.\n- 도면 1개당 ${dlCfg.c}, 총 ${dlCfg.t}. (정형문 제외)\n- 등록 앵커 종속항의 다단계 처리, 기준값/가중치 동작, 검증/보정 루프를 구체적으로 설명하라.\n- 제한성 표현 금지.\n- 수학식은 포함하지 마라 (별도 삽입 예정).\n\n★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★\n\n[발명의 명칭] ${selectedTitle}\n[검토 결과] ${outputs.step_13}\n[청구범위] ${outputs.step_06||''}\n[도면] ${outputs.step_07||''}\n[현재 상세설명] ${stripMathBlocks(cur)}${getFullInvention()}${getStyleRef()}`,'progressApplyReview');
    outputs.step_08=improvedDesc;
    App.showProgress('progressApplyReview','[2/3] 수학식 삽입 중...',2,3);
    const mathR=await App.callClaude(`상세설명의 핵심 알고리즘에 수학식 5개 내외.\n규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.\n출력:\n---MATH_BLOCK_1---\nANCHOR: (삽입위치 문장 20자 이상)\nFORMULA:\n【수학식 1】\n(수식)\n여기서, (파라미터)\n예시 대입: (수치)\n\n${selectedTitle}\n[현재 상세설명] ${improvedDesc}`);
    const finalDesc=insertMathBlocks(improvedDesc,mathR.text);
    outputs.step_09=finalDesc;outputs.step_13_applied=finalDesc;
    App.showProgress('progressApplyReview','[3/3] 완료',3,3);
    renderOutput('step_08',improvedDesc);renderOutput('step_09',finalDesc);
    const resultArea=document.getElementById('reviewApplyResult');
    if(resultArea){resultArea.style.display='block';showReviewDiff('after');}
    setTimeout(()=>App.clearProgress('progressApplyReview'),2000);
    saveProject(true);
    App.showToast('검토 반영 완료');
  }catch(e){App.showToast(e.message,'error');}finally{loadingState.applyReview=false;App.setButtonLoading('btnApplyReview',false);setGlobalProcessing(false);}
}
function showReviewDiff(mode){
  const area=document.getElementById('reviewDiffArea'),bb=document.getElementById('btnDiffBefore'),ba=document.getElementById('btnDiffAfter');if(!area)return;
  if(mode==='before'){area.value=beforeReviewText||'(없음)';if(bb)bb.className='btn btn-primary btn-sm';if(ba)ba.className='btn btn-outline btn-sm';}
  else{area.value=outputs.step_13_applied||'(없음)';if(bb)bb.className='btn btn-outline btn-sm';if(ba)ba.className='btn btn-primary btn-sm';}
}
async function runDiagramStep(sid){
  if(globalProcessing)return;
  const dep=checkDependency(sid);
  if(dep){App.showToast(dep,'error');return;}
  
  const bid=sid==='step_07'?'btnStep07':'btnStep11';
  setGlobalProcessing(true);
  loadingState[sid]=true;
  App.setButtonLoading(bid,true);
  
  try{
    // 1. 도면 설계 생성
    let r=await App.callClaude(buildPrompt(sid));
    let designText=r.text;
    
    // 2. 도면 설계 텍스트 사전 검증 (장치 도면만)
    if(sid==='step_07'){
      const preIssues=validateDiagramDesignText(designText);
      const hasPreErrors=preIssues.some(iss=>iss.severity==='ERROR');
      
      // 에러 발견 시 자동 재생성 시도 (최대 2회)
      if(hasPreErrors){
        console.log('도면 설계 규칙 위반 발견, 재생성 시도...',preIssues);
        
        const feedbackPrompt=`이전 도면 설계에 규칙 위반이 있습니다. 아래 오류를 수정하여 다시 생성하세요.

═══ 발견된 오류 ═══
${preIssues.map(i=>i.message).join('\n')}

═══ 핵심 규칙 ═══
[R3] 도 1: L1 장치만 허용 (100, 200, 300...). L2/L3(110, 111...) 절대 금지!
     도 1의 구성요소에는 100, 200, 300, 400... 만 포함해야 합니다.
[R5] 도 2+: 내부가 L2(110,120)면 최외곽=L1(100), 내부가 L3(111,112)면 최외곽=L2(110)

원래 요청: ${buildPrompt(sid).slice(0,1500)}

위 오류를 수정하여 도면 설계를 다시 출력하세요.`;

        r=await App.callClaude(feedbackPrompt);
        designText=r.text;
        App.showToast('도면 규칙 위반 감지, 자동 재생성됨','warning');
      }
    }
    
    outputs[sid]=designText;
    renderOutput(sid,designText);
    
    // 3. Mermaid 변환
    const mr=await App.callClaude(buildMermaidPrompt(sid),4096);
    outputs[sid+'_mermaid']=mr.text;
    
    // 4. 렌더링 + 최종 검증
    renderDiagrams(sid,mr.text);
    
    const dlId=sid==='step_07'?'diagramDownload07':'diagramDownload11';
    const dlEl=document.getElementById(dlId);
    if(dlEl)dlEl.style.display='block';
    
    saveProject(true);
    App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);
  }catch(e){
    App.showToast(e.message,'error');
  }finally{
    loadingState[sid]=false;
    App.setButtonLoading(bid,false);
    setGlobalProcessing(false);
  }
}
async function runBatch25(){if(globalProcessing)return;if(!selectedTitle){App.showToast('명칭 먼저 확정','error');return;}setGlobalProcessing(true);loadingState.batch25=true;App.setButtonLoading('btnBatch25',true);document.getElementById('resultsBatch25').innerHTML='';const steps=['step_02','step_03','step_04','step_05'];try{for(let i=0;i<steps.length;i++){App.showProgress('progressBatch',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await App.callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;renderBatchResult('resultsBatch25',steps[i],r.text);}App.clearProgress('progressBatch');saveProject(true);App.showToast('기본 항목 완료');}catch(e){App.clearProgress('progressBatch');App.showToast(e.message,'error');}finally{loadingState.batch25=false;App.setButtonLoading('btnBatch25',false);setGlobalProcessing(false);}}
async function runBatchFinish(){if(globalProcessing)return;if(!outputs.step_06||!outputs.step_08){App.showToast('청구항+상세설명 먼저','error');return;}setGlobalProcessing(true);loadingState.batchFinish=true;App.setButtonLoading('btnBatchFinish',true);document.getElementById('resultsBatchFinish').innerHTML='';const steps=['step_16','step_17','step_18','step_19'];try{for(let i=0;i<steps.length;i++){App.showProgress('progressBatchFinish',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await App.callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;renderBatchResult('resultsBatchFinish',steps[i],r.text);}App.clearProgress('progressBatchFinish');saveProject(true);App.showToast('마무리 완료');}catch(e){App.clearProgress('progressBatchFinish');App.showToast(e.message,'error');}finally{loadingState.batchFinish=false;App.setButtonLoading('btnBatchFinish',false);setGlobalProcessing(false);}}

// ═══════════ PROVISIONAL APPLICATION (가출원) ═══════════
async function openProvisionalModal(){
  document.getElementById('provisionalInput').value='';
  // 다음 사건번호 자동 생성 (가출원)
  const numInput=document.getElementById('provisionalProjectNumber');
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
  document.getElementById('provisionalModal').style.display='flex';
}
function closeProvisionalModal(){document.getElementById('provisionalModal').style.display='none';}
async function runProvisionalApplication(){
  const inv=document.getElementById('provisionalInput').value.trim();
  if(!inv){App.showToast('발명 내용을 입력해 주세요','error');return;}
  if(!App.ensureApiKey()){App.openProfileSettings();return;}
  if(globalProcessing)return;
  setGlobalProcessing(true);App.setButtonLoading('btnProvisionalGen',true);
  try{
    App.showProgress('progressProvisional','가출원 명세서 생성 중... (1/3)',1,3);
    const r1=await App.callClaudeSonnet(`가출원 명세서를 작성하라. 전체 문서가 4000단어를 넘지 않도록 간결하게 작성하라.

[구성]
1. 발명의 명칭: 국문 1개 + 영문 1개 ("~서버" 또는 "~방법" 또는 "~시스템" 형태)
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

[도면 참조번호 규칙 — 필수 준수]
- L1 (최상위): X00 형식 — 서버(100), 사용자 단말(200), 외부 시스템(300), 데이터베이스(400)
- L2 (하위 모듈): XY0 형식 — 통신부(110), 프로세서(120), 메모리(130)...
- L3 (하위 부품): XYZ 형식 — 수신모듈(111), 송신모듈(112)...
- 부모 접두(prefix) 유지: 자식은 부모의 앞자리를 반드시 유지
- "~단계", "S숫자" 등 방법 표현은 도면에 포함 금지 (이것은 장치 도면)

[출력 형식]
===명칭===
(국문 명칭)
===영문명칭===
(영문 명칭)
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
(도면 설명: 구성요소, 참조번호, 연결 관계 포함)
===상세설명===
(내용)
===효과===
(내용)
===요약===
(내용)

[발명 내용]
${inv}`,8192);

    App.showProgress('progressProvisional','도면 Mermaid 변환 중... (2/3)',2,3);
    const text=r1.text;
    const getSection=(key)=>{const re=new RegExp('==='+key+'===\\s*\\n([\\s\\S]*?)(?====|$)');const m=text.match(re);return m?m[1].trim():'';};
    const title=getSection('명칭');const titleEn=getSection('영문명칭');
    const techField=getSection('기술분야');
    const problem=getSection('과제');const solution=getSection('해결수단');
    const claim=getSection('청구항');const diagram=getSection('도면설계');
    const desc=getSection('상세설명');const effect=getSection('효과');
    const abstract=getSection('요약');

    // Generate Mermaid code for PPTX diagram
    let provisionalDiagramData=null;
    try{
      const mermaidR=await App.callClaudeSonnet(`아래 도면 설계를 Mermaid flowchart 코드로 변환하라. \`\`\`mermaid 블록 1개.
규칙: graph TD, 한글 라벨, 노드ID 영문. 서브그래프 사용 가능. style/linkStyle 금지.

⛔ 장치 도면 규칙:
- 노드 라벨에 반드시 참조번호 포함: "통신부(110)", "프로세서(120)"
- 참조번호는 숫자만 사용 (100, 110, 120...)
- "~단계", "S숫자" 표현 절대 금지
- 구성요소명은 "~부", "~모듈", "~유닛" 형태

${diagram}`,4096);
      const blocks=extractMermaidBlocks(mermaidR.text);
      if(blocks.length){
        provisionalDiagramData=blocks.map(code=>{const{nodes,edges}=parseMermaidGraph(code);return{nodes,edges,positions:layoutGraph(nodes,edges)};});
      }
    }catch(e){/* PPTX generation is optional */}

    App.showProgress('progressProvisional','Word + PPTX 생성 및 저장 중... (3/3)',3,3);

    // v4.9: Save provisional to DB with project_number
    const numInput=document.getElementById('provisionalProjectNumber');
    const numVal=numInput?numInput.value.trim():'';
    const projectNumber=numVal&&/^\d{4}$/.test(numVal)?'26P'+numVal:null;
    
    const provisionalData={title,titleEn,techField,problem,solution,claim,diagram,desc,effect,abstract};
    try{
      await App.sb.from('projects').insert({
        owner_user_id:currentUser.id,
        title:`[가출원] ${title||'초안'}`,
        project_number:projectNumber,
        invention_content:inv,
        current_state_json:{type:'provisional',provisionalData,usage:{calls:usage.calls,inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,cost:usage.cost}}
      });
    }catch(e){console.error('Provisional save error:',e);}

    // Generate Word with English title
    const titleLine=titleEn?`${title}\n{${titleEn}}`:(title||'');
    const secs=[
      {h:'발명의 설명'},{h:'발명의 명칭',b:titleLine},{h:'기술분야',b:techField},
      {h:'발명의 내용'},{h:'해결하고자 하는 과제',b:problem},
      {h:'과제의 해결 수단',b:solution},{h:'발명의 효과',b:effect},
      {h:'도면의 간단한 설명',b:diagram?`도 1은 ${title}의 구성을 나타내는 블록도이다.`:''},
      {h:'발명을 실시하기 위한 구체적인 내용',b:desc},
      {h:'청구범위',b:claim},
      {h:'요약서',b:abstract?`【요약】\n${abstract}\n\n【대표도】\n도 1`:''},
    ];
    const html=secs.map(s=>{
      const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${App.escapeHtml(s.h)}】</h2>`;
      if(!s.b)return hd;
      return hd+s.b.split('\n').filter(l=>l.trim()).map(l=>`<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify">${App.escapeHtml(l.trim())}</p>`).join('');
    }).join('');
    const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}</body></html>`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));
    a.download=`가출원_${title||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();

    // Generate PPTX diagram — KIPO 규칙 v2.1 - 페이지 내 맞춤
    let pptxGenerated=false;
    if(provisionalDiagramData&&provisionalDiagramData.length){
      try{
        const pptx=new PptxGenJS();
        pptx.defineLayout({name:'A4_PORTRAIT',width:8.27,height:11.69});
        pptx.layout='A4_PORTRAIT';
        
        // 선 굵기 상수 (KIPO 기준)
        const LINE_FRAME=2.0, LINE_BOX=1.5, LINE_ARROW=1.0, SHADOW_OFFSET=0.04;
        const PAGE_MARGIN=0.6;
        const PAGE_W=8.27-PAGE_MARGIN*2;
        const PAGE_H=11.69-PAGE_MARGIN*2;
        const TITLE_H=0.5;
        const AVAILABLE_H=PAGE_H-TITLE_H-0.3;
        
        provisionalDiagramData.forEach(({nodes,edges,positions},idx)=>{
          const slide=pptx.addSlide({bkgd:'FFFFFF'});
          const figNum=idx+1;
          
          // 도면 번호
          slide.addText(`도 ${figNum}`,{x:PAGE_MARGIN,y:PAGE_MARGIN,w:2,h:TITLE_H,fontSize:14,bold:true,fontFace:'맑은 고딕',color:'000000'});
          if(!nodes.length)return;
          
          // 노드 수에 따라 동적 스케일링
          const nodeCount=nodes.length;
          const frameX=PAGE_MARGIN;
          const frameY=PAGE_MARGIN+TITLE_H;
          const frameW=PAGE_W-0.8;
          const maxFrameH=Math.min(AVAILABLE_H, nodeCount*1.0+0.6);
          const frameH=maxFrameH;
          
          // 참조번호 추출 함수
          function extractRefNum(label,fallback){
            const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
            return match?match[1]:fallback;
          }
          
          // 외곽 프레임 참조번호 추출
          let frameRefNum=figNum*100;
          if(nodes.length>0){
            const firstRef=extractRefNum(nodes[0].label,'');
            if(firstRef&&!firstRef.startsWith('S')){
              const num=parseInt(firstRef);
              if(num>=100) frameRefNum=Math.floor(num/100)*100;
            }
          }
          
          // 박스 크기 동적 계산
          const framePadY=0.3;
          const innerH=frameH-framePadY*2;
          const boxH=Math.min(0.55, (innerH-0.15*(nodeCount-1))/nodeCount);
          const boxGap=(innerH-boxH*nodeCount)/(nodeCount>1?nodeCount-1:1);
          const boxW=frameW-1.0;
          const boxStartX=frameX+0.5;
          const boxStartY=frameY+framePadY;
          const refLabelX=frameX+frameW+0.1;
          
          // 그림자
          slide.addShape(pptx.shapes.RECTANGLE,{x:frameX+SHADOW_OFFSET,y:frameY+SHADOW_OFFSET,w:frameW,h:frameH,fill:{color:'000000'},line:{width:0}});
          // 외곽 본체
          slide.addShape(pptx.shapes.RECTANGLE,{x:frameX,y:frameY,w:frameW,h:frameH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_FRAME}});
          // 외곽 부호
          slide.addShape(pptx.shapes.LINE,{x:frameX+frameW,y:frameY+frameH/2,w:0.25,h:0,line:{color:'000000',width:LINE_ARROW}});
          slide.addText(String(frameRefNum),{x:refLabelX+0.25,y:frameY+frameH/2-0.12,w:0.5,h:0.24,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          
          // 내부 구성요소 박스들
          nodes.forEach((n,i)=>{
            const bx=boxStartX, by=boxStartY+i*(boxH+boxGap);
            // 참조번호 추출
            const fallbackRef=frameRefNum+10*(i+1);
            const refNum=extractRefNum(n.label,String(fallbackRef));
            const cleanLabel=n.label.replace(/[(\s]?S?\d+[)\s]?$/i,'').trim();
            // 그림자
            slide.addShape(pptx.shapes.RECTANGLE,{x:bx+SHADOW_OFFSET,y:by+SHADOW_OFFSET,w:boxW,h:boxH,fill:{color:'000000'},line:{width:0}});
            // 박스 본체
            slide.addShape(pptx.shapes.RECTANGLE,{x:bx,y:by,w:boxW,h:boxH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
            // 박스 텍스트 (참조번호 제외)
            slide.addText(cleanLabel,{x:bx+0.08,y:by,w:boxW-0.16,h:boxH,fontSize:Math.min(11,Math.max(8,12-nodeCount*0.3)),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
            // 리더라인
            slide.addShape(pptx.shapes.LINE,{x:bx+boxW,y:by+boxH/2,w:frameX+frameW-bx-boxW+0.25,h:0,line:{color:'000000',width:LINE_ARROW}});
            // 부호 라벨 (추출된 참조번호)
            slide.addText(String(refNum),{x:refLabelX+0.25,y:by+boxH/2-0.12,w:0.5,h:0.24,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
            // 양방향 화살표
            if(i<nodes.length-1){
              const arrowY1=by+boxH;
              const arrowY2=boxStartY+(i+1)*(boxH+boxGap);
              const arrowX=bx+boxW/2;
              if(arrowY2>arrowY1+0.05){
                slide.addShape(pptx.shapes.LINE,{x:arrowX,y:arrowY1,w:0,h:arrowY2-arrowY1,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
              }
            }
          });
        });
        const caseNum=selectedTitle||title||'가출원';
        await pptx.writeFile({fileName:`${caseNum}_도면_${new Date().toISOString().slice(0,10)}.pptx`});
        pptxGenerated=true;
      }catch(e){console.error('PPTX generation error:',e);}
    }

    App.clearProgress('progressProvisional');
    closeProvisionalModal();
    App.showToast(`가출원 명세서 저장 + Word 다운로드 완료${pptxGenerated?' + 도면 PPTX':''}: ${title}`);
    loadDashboardProjects(); // Refresh list to show new provisional
  }catch(e){App.clearProgress('progressProvisional');App.showToast(e.message,'error');}
  finally{App.setButtonLoading('btnProvisionalGen',false);setGlobalProcessing(false);}
}

// ═══════════ PARSERS ═══════════
function parseTitleCandidates(t){const c=[];let m;const re=/\[(\d+)\]\s*국문:\s*(.+?)\s*[/／]\s*영문:\s*(.+)/g;while((m=re.exec(t))!==null)c.push({num:m[1],korean:m[2].trim(),english:m[3].trim()});return c;}
function parseClaimStats(t){const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,c={};let m;while((m=cp.exec(t))!==null)c[parseInt(m[1])]=m[2].trim();const tot=Object.keys(c).length;let dep=0;Object.values(c).forEach(x=>{if(/있어서|따른/.test(x))dep++;});return{total:tot,independent:tot-dep,dependent:dep,claims:c};}
function extractMermaidBlocks(t){return(t.match(/```mermaid\n([\s\S]*?)```/g)||[]).map(b=>b.replace(/```mermaid\n/,'').replace(/```/,'').trim());}
function parseMathBlocks(t){const b=[];let m;const re=/---MATH_BLOCK_\d+---\s*\nANCHOR:\s*(.+)\s*\nFORMULA:\s*\n([\s\S]*?)(?=---MATH_BLOCK_|\s*$)/g;while((m=re.exec(t))!==null)b.push({anchor:m[1].trim(),formula:m[2].trim()});return b;}
function stripMathBlocks(text){
  if(!text)return '';
  // Remove existing math blocks (【수학식 N】 blocks) more thoroughly to prevent duplication
  // Pattern 1: Full math blocks with parameters
  let r=text.replace(/\n*【수학식\s*\d+】[\s\S]*?(?=\n(?:도\s|이때|또한|한편|다음|여기서|구체적|상기|본 발명|이상|따라서|결과|이를|아울|이와|상술|전술|[가-힣]{2,}부[(\s]|[가-힣]{2,}서버|\n|$))/g,'');
  // Pattern 2: Standalone math block headers that might remain
  r=r.replace(/\n*【수학식\s*\d+】[^\n]*\n/g,'\n');
  // Pattern 3: Remove "여기서," blocks that follow math formulas
  r=r.replace(/\n여기서,[\s\S]*?(?=\n\n)/g,'');
  // Pattern 4: Remove "예시 대입:" blocks
  r=r.replace(/\n예시 대입:[\s\S]*?(?=\n\n)/g,'');
  // Clean up multiple newlines
  r=r.replace(/\n{3,}/g,'\n\n');
  return r.trim();
}
function insertMathBlocks(s08,s09){
  // First strip any existing math blocks from base text to prevent duplication
  let r=stripMathBlocks(s08);
  const b=parseMathBlocks(s09);
  // Track inserted positions to avoid double-insertion
  const inserted=new Set();
  for(const x of b.reverse()){
    const i=r.indexOf(x.anchor);
    if(i>=0 && !inserted.has(x.anchor)){
      inserted.add(x.anchor);
      const s=i+x.anchor.length,p=r.indexOf('.',s);
      const ip=(p>=0&&p-s<100)?p+1:s;
      r=r.slice(0,ip)+'\n\n'+x.formula+'\n\n'+r.slice(ip);
    }
  }
  return r;
}

function buildMermaidPrompt(sid){
  const src=outputs[sid]||'';
  const isDevice=sid==='step_07';
  const isMethod=sid==='step_11';
  
  let rules=`
═══ Mermaid 문법 규칙 (필수!) ═══
graph TD 사용
노드ID는 영문 (A, B, C 또는 server, client 등)
노드 라벨은 대괄호 안에: A["서버(100)"]

★★★ 올바른 Mermaid 문법 예시 ★★★
\`\`\`mermaid
graph TD
    A["서버(100)"]
    B["사용자 단말(200)"]
    C["네트워크(300)"]
    D["데이터베이스(400)"]
    A --> B
    B --> C
    A --> D
\`\`\`

⛔ 잘못된 문법 (절대 금지):
- A["서버(100)"] <--> B["사용자 단말(200)"]  ← <--> 사용 금지!
- 한 줄에 노드 정의와 연결을 함께 쓰지 말 것

✅ 올바른 문법:
- 노드 정의를 먼저, 연결은 나중에
- 연결은 --> 만 사용 (양방향은 A --> B와 B --> A 두 줄로)
`;
  
  if(isDevice){
    rules+=`
═══ 장치 도면 규칙 ═══
- 노드 라벨에 반드시 참조번호 포함: A["통신부(110)"]
- 참조번호는 숫자만 (100, 110, 120...)
- "~단계", "S숫자" 표현 금지
- "~모듈" 금지 → "~부"로 통일

★★ 도면별 계층 규칙 ★★
- 도 1: L1(100, 200, 300...) 장치만
- 도 2 (L1 상세화): L1(100)과 그 L2 하위(110,120,130) 포함
  → 렌더링: 최외곽 프레임=100, 내부 박스=110,120,130 (100은 프레임으로만)
- 도 3+ (L2 상세화): L2(110)와 그 L3 하위(111,112,113) 포함
  → 렌더링: 최외곽 프레임=110, 내부 박스=111,112,113 (110은 프레임으로만)
- L4 (L3 상세화): L3(121)과 그 L4 하위(1211,1212) 포함
  → 렌더링: 최외곽 프레임=121, 내부 박스=1211,1212 (121은 프레임으로만)

★★ 연결관계 규칙 ★★
- 데이터/정보 도면(~정보, ~데이터): 정보 항목은 서버 입력 데이터 → 상호 화살표 연결 부적절 → 연결선 없이 병렬 배치 (노드 정의만, A --> B 금지)
- 장치 블록도: 데이터 흐름이 있는 구성요소만 --> 연결
- 상위 구성(110)과 하위 구성(111,112,113)을 같은 레벨에 표현 금지

★ 모든 구성요소를 빠짐없이 노드로 포함! ★`;
  } else if(isMethod){
    rules+=`
═══ 방법 도면 규칙 (흐름도) ═══
★★ 핵심 규칙 ★★
① 최외곽 프레임 박스 절대 없음 — 흐름도는 단계 나열이므로 감싸는 박스 불필요
② 단방향 화살표(-->)만 사용 — 양방향(<-->) 절대 금지
③ "시작"과 "종료" 노드 필수 — 첫 단계 앞에 START, 마지막 단계 뒤에 END
④ 숫자만 있는 참조번호(100, 110) 절대 사용 금지

★★ 노드 형식 ★★
- 시작/종료: START(["시작"]), END(["종료"]) — 둥근 사각형
- 단계 노드: A["단계명(S번호)"] — 예: A["데이터 수신 단계(S901)"]
- 조건 분기: D{"조건?"} — 다이아몬드

★★ 연결 형식 ★★
- START --> A (시작에서 첫 단계)
- A --> B --> C (단계 순서)
- Z --> END (마지막 단계에서 종료)
- 모든 화살표는 --> (단방향만)`;
  }
  
  return `아래 도면 설계를 Mermaid flowchart 코드로 변환하라. 각 도면당 \`\`\`mermaid 블록 1개.

${rules}

═══ 출력 형식 ═══
각 도면마다:
\`\`\`mermaid
graph TD
    노드정의들...
    연결들...
\`\`\`

${src}`;
}

// ═══ 전역 도면 헬퍼 함수 ═══
function _extractRefNum(label,fallback){
  const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
  return match?match[1]:(fallback||'');
}

// ═══ 도면 규칙 위반 시 자동 재생성 ═══
async function regenerateDiagramWithFeedback(sid){
  if(globalProcessing){App.showToast('다른 작업 진행 중...','error');return;}
  const stepId=sid==='step_07'?'step_07':'step_11';
  const btnId=sid==='step_07'?'btnStep07':'btnStep11';
  
  // 기존 도면 설계 가져오기
  const prevDesign=outputs[stepId]||'';
  if(!prevDesign){
    App.showToast('재생성할 도면 설계가 없습니다.','error');
    return;
  }
  
  // 에러 정보 (있으면 사용, 없으면 일반 재생성)
  const errors=window._diagramErrors&&window._diagramErrors.sid===sid?window._diagramErrors.errors:'사용자 요청에 의한 재생성';
  const aiReview=window._aiDiagramReview&&window._aiDiagramReview.sid===sid?window._aiDiagramReview.review:'';
  
  // 방법/장치 분기
  const isMethod=stepId==='step_11';
  
  // 피드백 프롬프트 생성
  const feedbackPrompt=`이전에 생성한 ${isMethod?'방법':'장치'} 도면 설계에 규칙 위반이 발견되었습니다. 아래 오류를 수정하여 다시 생성하세요.

═══ 발견된 오류 ═══
${errors}
${aiReview?`\n═══ AI 연결관계 검증 결과 ═══\n${aiReview}\n`:''}
═══ 핵심 규칙 리마인더 ═══
${isMethod?`[방법 도면 규칙]
- 흐름도 형식: 시작 → 단계들 → 종료
- 참조번호: S301, S302... (S+숫자)
- 단방향 화살표만 사용
- 최외곽 박스 없음
- 시작/종료 노드 필수`:`[장치 도면 규칙]
[R1] 도면부호 계층: L1(X00), L2(XY0), L3(XYZ), L4(XYZW)
[R5] 도 1: L1 장치만 허용 (100, 200, 300...). L2/L3(110, 111...) 절대 금지
[R6] 도 2+: 하나의 상위 장치만 상세화
     - 내부가 L2(110,120,130)이면 최외곽은 L1(100)
     - 내부가 L3(111,112,113)이면 최외곽은 L2(110)
     - 내부가 L4(1211,1212)이면 최외곽은 L3(121)`}
     
★★ 연결관계 규칙 ★★
- 데이터/정보 도면: 정보 항목은 서버 입력용이므로 상호 간 화살표 연결 부적절 → 병렬 배치
- 장치 블록도: 기술적 데이터 흐름이 있으면 화살표 연결
- 상위+하위 구성이 같은 레벨에 표현 금지 → 하위는 상위 내부에 포함

═══ 이전 도면 설계 (오류 포함) ═══
${prevDesign.slice(0,2000)}

위 오류를 모두 수정하여 도면 설계를 다시 출력하세요.
${isMethod?'방법 흐름도는 시작/종료 노드를 반드시 포함!':'도 1에는 반드시 L1 장치만 포함해야 합니다!'}`;

  setGlobalProcessing(true);
  const btnEl=document.getElementById(btnId);
  if(btnEl)App.setButtonLoading(btnId,true);
  
  try{
    const r1=await App.callClaude(feedbackPrompt);
    outputs[stepId]=r1.text;
    const resEl=document.getElementById(stepId==='step_07'?'resStep07':'resStep11');
    if(resEl)resEl.value=r1.text;
    saveProject(true);
    
    // Mermaid 변환
    const mermaidPrompt=buildMermaidPrompt(stepId,r1.text);
    const r2=await App.callClaude(mermaidPrompt);
    outputs[stepId+'_mermaid']=r2.text;
    renderDiagrams(stepId,r2.text);
    
    App.showToast('도면이 규칙에 맞게 재생성되었습니다.');
  }catch(e){
    App.showToast('재생성 실패: '+e.message,'error');
  }finally{
    if(btnEl)App.setButtonLoading(btnId,false);
    setGlobalProcessing(false);
  }
}

// ═══ 도면 설계 텍스트 사전 검증 ═══
function validateDiagramDesignText(text){
  const issues=[];
  
  // 도면별로 분리
  const figPattern=/도\s*(\d+)[:\s]*(.*?)(?=도\s*\d+[:\s]|---BRIEF|$)/gs;
  let match;
  
  while((match=figPattern.exec(text))!==null){
    const figNum=parseInt(match[1]);
    const content=match[2];
    
    // 참조번호 추출
    const refs=(content.match(/\((\d+)\)/g)||[]).map(r=>parseInt(r.replace(/[()]/g,'')));
    
    if(figNum===1){
      // 도 1 검증: L1만 허용
      const nonL1=refs.filter(r=>r%100!==0);
      if(nonL1.length>0){
        issues.push({
          severity:'ERROR',
          message:`도 1 설계에 L2/L3 참조번호 포함: ${nonL1.join(', ')}. 도 1은 L1(X00)만 허용.`
        });
      }
    }
    
    // ~모듈 사용 검증
    if(content.includes('모듈')){
      issues.push({
        severity:'WARNING',
        message:`도 ${figNum} 설계에 "~모듈" 사용. "~부"로 변경 필요.`
      });
    }
  }
  
  return issues;
}

// ═══════════ UNIFIED DIAGRAM ENGINE ═══════════
function parseMermaidGraph(code){
  const nodes={},edges=[];
  
  // ★ 다양한 Mermaid 노드 형태 지원 ★
  // 1. A["label"] - 사각형
  // 2. A(["label"]) - 스타디움 (시작/종료)
  // 3. A("label") - 둥근 사각형
  // 4. A{"label"} - 다이아몬드 (조건 분기)
  // 5. A[/"label"/] - 평행사변형
  // 6. A(("label")) - 원형
  
  // 먼저 줄 단위로 노드 정의 추출
  code.split('\n').forEach(line=>{
    const l=line.trim();
    if(!l||l.startsWith('graph')||l.startsWith('flowchart')||l==='end'||l.startsWith('style')||l.startsWith('linkStyle')||l.startsWith('classDef'))return;
    
    // 노드 정의 패턴들 (순서 중요: 더 복잡한 패턴 먼저)
    const patterns=[
      /(\w+)\s*\(\[\s*["']?([^\]"']+?)["']?\s*\]\)/g,   // A(["label"]) stadium
      /(\w+)\s*\(\(\s*["']?([^)"']+?)["']?\s*\)\)/g,     // A(("label")) circle
      /(\w+)\s*\{\s*["']?([^}"']+?)["']?\s*\}/g,          // A{"label"} diamond
      /(\w+)\s*\(\s*["']?([^)"']+?)["']?\s*\)/g,          // A("label") round
      /(\w+)\s*\[\s*["']?([^\]"']+?)["']?\s*\]/g,         // A["label"] rect
    ];
    
    patterns.forEach(pat=>{
      pat.lastIndex=0;
      let nm;
      while((nm=pat.exec(l))!==null){
        const[,id,label]=nm;
        if(label.includes('-->')||label.includes('<--')||label.includes('---'))continue;
        if(!nodes[id])nodes[id]={id,label:label.trim()};
      }
    });
  });
  
  // 연결선 추출
  code.split('\n').forEach(line=>{
    const l=line.trim();
    if(!l||l.startsWith('graph')||l.startsWith('flowchart')||l==='end'||l.startsWith('style')||l.startsWith('linkStyle')||l.startsWith('classDef')||l.startsWith('subgraph'))return;
    
    // 연결 패턴: A --> B, A <--> B, A --- B, A -->|text| B
    const connections=l.match(/(\w+)\s*(?:-->|<-->|---)\s*(?:\|[^|]*\|\s*)?(\w+)/g);
    if(connections){
      connections.forEach(conn=>{
        const cm=conn.match(/(\w+)\s*(-->|<-->|---)\s*(?:\|([^|]*)\|\s*)?(\w+)/);
        if(cm){
          const[,from,arrow,edgeLabel,to]=cm;
          if(!nodes[from])nodes[from]={id:from,label:from};
          if(!nodes[to])nodes[to]={id:to,label:to};
          edges.push({from,to,label:edgeLabel||'',bidirectional:arrow==='<-->'});
        }
      });
    }
  });
  
  const result={nodes:Object.values(nodes),edges};
  console.log('Parsed Mermaid:',result);
  return result;
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
  // ═══ KIPO 특허 도면 규칙 v4.1 (직계 부모 일치) ═══
  const PX=72;
  const SHADOW_OFFSET=4;
  
  // 노드 라벨에서 참조번호 추출 함수
  function extractRefNum(label,fallback){
    const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
    return match?match[1]:fallback;
  }
  
  // L1 여부 판별 (X00 형식인지)
  function isL1RefNum(ref){
    if(!ref||String(ref).startsWith('S'))return false;
    const s=String(ref);
    // D접두사: D2→최상위, D21→하위
    if(s.startsWith('D')){const n=parseInt(s.slice(1));return !isNaN(n)&&n<10;}
    const num=parseInt(s);
    if(isNaN(num))return false;
    // 소수(1~9): 최상위
    if(num<10)return true;
    // 2자리(10~99): 하위
    if(num<100)return false;
    // 3자리: L1=X00
    if(num<1000)return num%100===0;
    // 4자리: L4이므로 아님
    return false;
  }
  
  // ★ 직계 부모 찾기 함수 v6.0 (L4 + 소수 지원) ★
  function findImmediateParent(refNums){
    const nums=refNums.filter(r=>r&&!String(r).startsWith('S')).map(r=>{const s=String(r);return s.startsWith('D')?parseInt(s.slice(1)):parseInt(s);}).filter(n=>!isNaN(n)&&n>0);
    if(!nums.length)return null;
    
    const l1s=nums.filter(n=>n>=100&&n<1000&&n%100===0);
    const l2s=nums.filter(n=>n>=100&&n<1000&&n%10===0&&n%100!==0);
    const l3s=nums.filter(n=>n>=100&&n<1000&&n%10!==0);
    const l4s=nums.filter(n=>n>=1000&&n<10000);
    const smalls=nums.filter(n=>n<100);
    
    console.log('findImmediateParent v6:', {nums,l1s,l2s,l3s,l4s,smalls});
    
    // ── L4 포함 ──
    if(l4s.length>0){
      if(l3s.length===1&&l2s.length===0&&l1s.length===0){
        const theL3=l3s[0];
        if(l4s.every(n=>Math.floor(n/10)===theL3))return theL3;
      }
      if(l3s.length===0&&l2s.length===0&&l1s.length===0&&smalls.length===0){
        const parents=[...new Set(l4s.map(n=>Math.floor(n/10)))];
        if(parents.length===1)return parents[0];
      }
      return null;
    }
    // ── L1 포함 ──
    if(l1s.length>0){
      if(l1s.length===1&&(l2s.length>0||l3s.length>0)){
        const t=l1s[0];
        if(l2s.every(n=>Math.floor(n/100)*100===t)&&l3s.every(n=>Math.floor(n/100)*100===t))return t;
      }
      return null;
    }
    // ── L2만 ──
    if(l2s.length>0&&l3s.length===0){
      const p=[...new Set(l2s.map(n=>Math.floor(n/100)*100))];
      return p.length===1?p[0]:null;
    }
    // ── L2+L3 ──
    if(l2s.length>0&&l3s.length>0){
      if(l2s.length===1&&l3s.every(n=>Math.floor(n/10)*10===l2s[0]))return l2s[0];
      const p=[...new Set([...l2s,...l3s].map(n=>Math.floor(n/100)*100))];
      return p.length===1?p[0]:null;
    }
    // ── L3만 ──
    if(l3s.length>0){
      const l2p=[...new Set(l3s.map(n=>Math.floor(n/10)*10))];
      if(l2p.length===1)return l2p[0];
      const l1p=[...new Set(l2p.map(p=>Math.floor(p/100)*100))];
      return l1p.length===1?l1p[0]:null;
    }
    // ── 소수 (<100): 데이터/정보 참조번호 ──
    if(smalls.length>0){
      const singles=smalls.filter(n=>n<10);
      const doubles=smalls.filter(n=>n>=10);
      if(singles.length===1&&doubles.length>0){
        if(doubles.every(n=>Math.floor(n/10)===singles[0]))return singles[0];
      }
      if(singles.length===0&&doubles.length>0){
        const p=[...new Set(doubles.map(n=>Math.floor(n/10)))];
        if(p.length===1)return p[0];
      }
    }
    return null;
  }
  
  // 화살표 표시 여부 (edges가 없으면 병렬 배치)
  const hasEdges=edges&&edges.length>0;
  
  // ★ 방법 도면 판별: S접두사 참조번호 또는 "시작"/"종료" 노드 존재 ★
  const allRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
  const isMethodDiagram=allRefs.some(r=>String(r).startsWith('S'))||
    nodes.some(n=>/시작|종료|START|END/i.test(n.label));
  
  if(isMethodDiagram){
    // ═══ 방법 도면: 흐름도 v5.4 ═══
    // - 시작/종료: 폭 축소 + 완전 흑백 + stadium shape
    // - 모든 박스를 동일 중앙선에 배치 (화살표 직선 유지)
    const boxH=0.7*PX, boxGap=0.8*PX;
    const normalBoxW=5.0*PX;
    const startEndBoxW=2.0*PX;
    const boxStartY=0.5*PX;
    const centerX=0.5*PX+normalBoxW/2;  // 모든 박스의 중앙 x좌표
    const svgW=normalBoxW+2.5*PX;
    const svgH=nodes.length*(boxH+boxGap)+1*PX;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:550px;background:white;border-radius:8px">`;
    
    const mkId=`ah_${containerId}`;
    svg+=`<defs>
      <marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#000"/>
      </marker>
    </defs>`;
    
    nodes.forEach((n,i)=>{
      const refNum=extractRefNum(n.label,'');
      const displayLabel=n.label.replace(/[(\s]?(?:S|D)?\d+[)\s]?$/i,'').trim();
      const isStartEnd=/시작|종료|START|END/i.test(n.label);
      const SHADOW_OFFSET=3;
      
      // 박스 폭 결정 (시작/종료는 축소)
      const boxW=isStartEnd?startEndBoxW:normalBoxW;
      // ★ 모든 박스를 동일 중앙선에 배치 ★
      const bx=centerX-boxW/2;
      const by=boxStartY+i*(boxH+boxGap);
      const rx=isStartEnd?boxH/2:0;
      
      // 그림자
      svg+=`<rect x="${bx+SHADOW_OFFSET}" y="${by+SHADOW_OFFSET}" width="${boxW}" height="${boxH}" rx="${rx}" fill="#000"/>`;
      // 박스 본체 (완전 흑백)
      svg+=`<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="${rx}" fill="#fff" stroke="#000" stroke-width="${isStartEnd?2:1.5}"/>`;
      svg+=`<text x="${centerX}" y="${by+boxH/2+4}" text-anchor="middle" font-size="13" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
      
      // 리더라인 + 부호 (시작/종료 제외)
      if(refNum&&!isStartEnd){
        const leaderEndX=0.5*PX+normalBoxW+0.3*PX;
        const leaderY=by+boxH/2;
        svg+=`<line x1="${bx+boxW}" y1="${leaderY}" x2="${leaderEndX}" y2="${leaderY}" stroke="#000" stroke-width="1"/>`;
        svg+=`<text x="${leaderEndX+8}" y="${leaderY+4}" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      }
      
      // ★ 화살표: 항상 중앙선 직선 ★
      if(i<nodes.length-1){
        const arrowY1=by+boxH+2;
        const arrowY2=boxStartY+(i+1)*(boxH+boxGap)-2;
        svg+=`<line x1="${centerX}" y1="${arrowY1}" x2="${centerX}" y2="${arrowY2}" stroke="#000" stroke-width="1" marker-end="url(#${mkId})"/>`;
      }
    });
    
    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
    return;
  }
  
  // 모든 노드가 L1인지 확인 (도 1 판별)
  const allL1=nodes.every(n=>{
    const ref=extractRefNum(n.label,'');
    return isL1RefNum(ref);
  });
  
  // 도 1인 경우 (figNum===1 또는 모든 노드가 L1)
  const isFig1=figNum===1||allL1;
  
  // ★ 최외곽 박스 참조번호 = 직계 부모 ★
  const allRefsForFrame=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
  let frameRefNum=findImmediateParent(allRefsForFrame);
  if(!frameRefNum&&allRefsForFrame.length>0){
    // 폴백 개선: 첫 번째 참조번호의 L1 부모 사용
    const firstRef=parseInt(allRefs[0])||100;
    frameRefNum=Math.floor(firstRef/100)*100;
  }
  if(!frameRefNum)frameRefNum=100; // 최종 폴백
  
  const boxW=5.0*PX, boxH=0.7*PX, boxGap=0.8*PX;
  
  if(isFig1){
    // ═══ 도 1: 수직 블록도 v8.0 (도 2/3과 동일 스타일, 최외곽 프레임 없음) ═══
    const nn=nodes.length;
    const boxStartX=0.5*PX, boxStartY=0.5*PX;
    const frameW=6.2*PX;
    const svgH=nn*(boxH+boxGap)+0.8*PX;
    const svgW=frameW+2.5*PX;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:600px;background:white;border-radius:8px">`;
    
    const mkId=`ah_${containerId}`;
    svg+=`<defs>
      <marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#000"/>
      </marker>
    </defs>`;
    
    nodes.forEach((nd,i)=>{
      const bx=boxStartX+0.6*PX;
      const by=boxStartY+i*(boxH+boxGap);
      const refNum=extractRefNum(nd.label,String((i+1)*100));
      const cleanLabel=nd.label.replace(/[(\s]?S?\d+[)\s]?$/i,'').trim();
      const displayLabel=cleanLabel.length>18?cleanLabel.slice(0,16)+'…':cleanLabel;
      
      // 그림자
      svg+=`<rect x="${bx+SHADOW_OFFSET}" y="${by+SHADOW_OFFSET}" width="${boxW}" height="${boxH}" fill="#000"/>`;
      // 박스 본체
      svg+=`<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" fill="#fff" stroke="#000" stroke-width="2"/>`;
      // 박스 텍스트
      svg+=`<text x="${bx+boxW/2}" y="${by+boxH/2+4}" text-anchor="middle" font-size="13" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
      
      // 리더라인 + 부호
      const leaderEndX=bx+boxW+0.3*PX;
      const leaderY=by+boxH/2;
      svg+=`<line x1="${bx+boxW}" y1="${leaderY}" x2="${leaderEndX}" y2="${leaderY}" stroke="#000" stroke-width="1"/>`;
      svg+=`<text x="${leaderEndX+8}" y="${leaderY+4}" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      
      // 양방향 화살표
      if(i<nn-1){
        const arrowX=bx+boxW/2;
        const arrowY1=by+boxH+2;
        const arrowY2=boxStartY+(i+1)*(boxH+boxGap)-2;
        svg+=`<line x1="${arrowX}" y1="${arrowY1}" x2="${arrowX}" y2="${arrowY2}" stroke="#000" stroke-width="1" marker-start="url(#${mkId})" marker-end="url(#${mkId})"/>`;
      }
    });
    
    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
  } else {
    // ═══ 도 2+: 하위 구성 있는 경우 - 최외곽 박스 있음 ═══
    
    // ★ 핵심 수정: 최외곽 프레임과 동일한 참조번호를 가진 노드 제외 ★
    const innerNodes=nodes.filter(n=>{
      const ref=extractRefNum(n.label,'');
      if(!ref)return true; // 참조번호 없으면 포함
      const refNum=parseInt(ref);
      return refNum!==frameRefNum; // 최외곽과 동일하면 제외
    });
    
    // 최외곽 프레임 라벨 (제외된 노드에서 가져오기)
    const frameNode=nodes.find(n=>{
      const ref=extractRefNum(n.label,'');
      return ref&&parseInt(ref)===frameRefNum;
    });
    const frameLabel=frameNode?frameNode.label.replace(/[(\s]?S?\d+[)\s]?$/i,'').trim():'';
    
    const displayNodes=innerNodes.length>0?innerNodes:nodes; // 안전장치
    
    const frameX=0.5*PX, frameY=0.5*PX;
    const boxStartX=frameX+0.6*PX, boxStartY=frameY+0.4*PX;
    const frameW=6.2*PX, frameH=(displayNodes.length*(boxH+boxGap)+0.3*PX);
    const svgW=frameW+2.5*PX, svgH=frameH+1.5*PX;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:600px;background:white;border-radius:8px">`;
    
    // 화살표 마커
    const mkId=`ah_${containerId}`;
    svg+=`<defs>
      <marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#000"/>
      </marker>
    </defs>`;
    
    // 1. 최외곽 프레임 (그림자 + 본체)
    svg+=`<rect x="${frameX+SHADOW_OFFSET}" y="${frameY+SHADOW_OFFSET}" width="${frameW}" height="${frameH}" fill="#000"/>`;
    svg+=`<rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="#fff" stroke="#000" stroke-width="2.25"/>`;
    
    // 최외곽 부호 (L1 번호)
    const frameRefX=frameX+frameW+0.3*PX;
    const frameRefY=frameY+frameH/2;
    svg+=`<line x1="${frameX+frameW}" y1="${frameRefY}" x2="${frameRefX}" y2="${frameRefY}" stroke="#000" stroke-width="1"/>`;
    svg+=`<text x="${frameRefX+8}" y="${frameRefY+4}" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${frameRefNum}</text>`;
    
    // 2. 내부 구성요소 박스들 (최외곽 노드 제외됨)
    displayNodes.forEach((n,i)=>{
      const bx=boxStartX;
      const by=boxStartY+i*(boxH+boxGap);
      const fallbackRef=frameRefNum+10*(i+1);
      const refNum=extractRefNum(n.label,String(fallbackRef));
      
      // 그림자
      svg+=`<rect x="${bx+SHADOW_OFFSET}" y="${by+SHADOW_OFFSET}" width="${boxW}" height="${boxH}" fill="#000"/>`;
      // 박스 본체
      svg+=`<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" fill="#fff" stroke="#000" stroke-width="1.5"/>`;
      // 박스 텍스트
      const cleanLabel=n.label.replace(/[(\s]?S?\d+[)\s]?$/i,'').trim();
      const displayLabel=cleanLabel.length>18?cleanLabel.slice(0,16)+'…':cleanLabel;
      svg+=`<text x="${bx+boxW/2}" y="${by+boxH/2+4}" text-anchor="middle" font-size="12" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
      
      // 리더라인 + 부호
      const leaderEndX=frameX+frameW+0.3*PX;
      const leaderY=by+boxH/2;
      svg+=`<line x1="${bx+boxW}" y1="${leaderY}" x2="${leaderEndX}" y2="${leaderY}" stroke="#000" stroke-width="1"/>`;
      svg+=`<text x="${leaderEndX+8}" y="${leaderY+4}" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      
      // 양방향 화살표 - edges가 있을 때만
      if(hasEdges&&i<displayNodes.length-1){
        const arrowX=bx+boxW/2;
        const arrowY1=by+boxH+2;
        const arrowY2=boxStartY+(i+1)*(boxH+boxGap)-2;
        svg+=`<line x1="${arrowX}" y1="${arrowY1}" x2="${arrowX}" y2="${arrowY2}" stroke="#000" stroke-width="1" marker-start="url(#${mkId})" marker-end="url(#${mkId})"/>`;
      }
    });
    
    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
  }
}

// ═══ 도면 규칙 검증 함수 (v5.0 - 통합 검증) ═══
function validateDiagramRules(nodes,figNum,designText){
  const issues=[];
  
  function extractRef(label){
    const m=(label||'').match(/[(\s]?(S?\d+)[)\s]?$/i);
    return m?m[1]:null;
  }
  function isL1(ref){return ref&&!ref.startsWith('S')&&parseInt(ref)>=100&&parseInt(ref)%100===0;}
  function isL2(ref){return ref&&!ref.startsWith('S')&&parseInt(ref)>=100&&parseInt(ref)%100!==0&&parseInt(ref)%10===0;}
  function isL3(ref){return ref&&!ref.startsWith('S')&&parseInt(ref)>=100&&parseInt(ref)%10!==0;}
  
  // ═══ R0. 파싱 실패 ═══
  if(!nodes||nodes.length===0){
    issues.push({severity:'ERROR',rule:'R0',message:`도 ${figNum}: Mermaid 파싱 실패 - 노드 없음`});
    return issues;
  }
  
  // ═══ R1. 라벨 오류 (Mermaid 코드 잔재) ═══
  const isFlowchartNode=lb=>/^(시작|종료|START|END|S|E)$/i.test(lb.trim());
  nodes.forEach(n=>{
    const lb=n.label||'';
    if(lb.includes('"]')||lb.includes('<-->')||lb.includes('-->')){
      issues.push({severity:'ERROR',rule:'R1',message:`도 ${figNum}: 파싱 오류 - "${lb.slice(0,30)}..."`});
    }
    if(lb===n.id&&!/^\d+$/.test(lb)&&!isFlowchartNode(lb)){
      issues.push({severity:'WARNING',rule:'R1',message:`도 ${figNum}: 노드 "${n.id}" 라벨 추출 실패`});
    }
  });
  
  // ═══ R2. ~모듈 금지 ═══
  nodes.forEach(n=>{
    if(n.label.includes('모듈')){
      issues.push({severity:'WARNING',rule:'R2',message:`"${n.label}" → "~부"로 변경 필요`});
    }
  });
  
  // ═══ R3. 참조번호 존재 여부 (시작/종료 노드 제외) ═══
  nodes.forEach(n=>{
    if(isFlowchartNode(n.label))return; // 시작/종료 노드는 참조번호 불필요
    if(!extractRef(n.label)){
      issues.push({severity:'WARNING',rule:'R3',message:`"${n.label}" - 참조번호 없음`});
    }
  });
  
  // ═══ R4. 참조번호 중복 ═══
  const allRefs=nodes.map(n=>extractRef(n.label)).filter(Boolean);
  const dupRefs=allRefs.filter((r,i)=>allRefs.indexOf(r)!==i);
  if(dupRefs.length){
    issues.push({severity:'ERROR',rule:'R4',message:`참조번호 중복: ${[...new Set(dupRefs)].join(', ')}`});
  }
  
  const numRefs=allRefs.filter(r=>!r.startsWith('S')&&!r.startsWith('D')).map(r=>parseInt(r)).filter(n=>!isNaN(n));
  const dRefs=allRefs.filter(r=>r.startsWith('D')).map(r=>({full:r,num:parseInt(r.slice(1))}));
  const l1Refs=numRefs.filter(n=>n>=100&&n<1000&&n%100===0);
  const l2Refs=numRefs.filter(n=>n>=100&&n<1000&&n%10===0&&n%100!==0);
  const l3Refs=numRefs.filter(n=>n>=100&&n<1000&&n%10!==0);
  const l4Refs=numRefs.filter(n=>n>=1000&&n<10000);
  const smallRefs=numRefs.filter(n=>n<100);
  
  // ★ 방법 도면 판별: S참조번호 또는 시작/종료 노드 ★
  const sRefCount=allRefs.filter(r=>String(r).startsWith('S')).length;
  const hasFlowchartNodes=nodes.some(n=>/^(시작|종료|START|END)$/i.test(n.label.trim()));
  const isMethodFig=sRefCount>0||hasFlowchartNodes;
  
  // ═══ R5~R7: 장치 도면 전용 규칙 (방법 도면은 건너뜀) ═══
  if(!isMethodFig){
  
  // ═══ R5. 도 1 규칙: L1만 허용 ═══
  if(figNum===1){
    nodes.forEach(n=>{
      const ref=extractRef(n.label);
      if(ref&&!isL1(ref)&&!ref.startsWith('S')){
        issues.push({severity:'ERROR',rule:'R5',message:`도 1에 하위 "${n.label}" 불가. L1(X00)만 허용.`});
      }
    });
  }
  
  // ═══ R6. 도 2+ 계층 규칙 ═══
  if(figNum>1){
    // R6a. 여러 L1 혼합 금지
    if(l1Refs.length>1){
      issues.push({severity:'ERROR',rule:'R6a',message:`도 ${figNum}: 여러 L1(${l1Refs.join(',')}) 혼합 불가`});
    }
    
    // R6b. L1+하위 혼합 시 계층 검증
    if(l1Refs.length===1){
      const theL1=l1Refs[0];
      const badL2=l2Refs.filter(n=>Math.floor(n/100)*100!==theL1);
      const badL3=l3Refs.filter(n=>Math.floor(n/100)*100!==theL1);
      if(badL2.length) issues.push({severity:'ERROR',rule:'R6b',message:`도 ${figNum}: L2(${badL2.join(',')})가 L1(${theL1})의 하위 아님`});
      if(badL3.length) issues.push({severity:'ERROR',rule:'R6b',message:`도 ${figNum}: L3(${badL3.join(',')})가 L1(${theL1})의 하위 아님`});
      
      // ★ 레벨 혼합 검출: L1 프레임 안에 L2+L3 동시 존재 ★
      if(l2Refs.length>0&&l3Refs.length>0){
        issues.push({severity:'ERROR',rule:'R6b',message:`도 ${figNum}: L2(${l2Refs.join(',')})와 L3(${l3Refs.join(',')})가 한 도면에 혼합됨. 한 도면에는 한 레벨만! L2 도면과 L3 도면을 분리해야 함.`});
      }else if(!badL2.length&&!badL3.length&&(l2Refs.length>0||l3Refs.length>0)){
        issues.push({severity:'INFO',rule:'R6b',message:`도 ${figNum} 최외곽: ${theL1} (L1 자체가 프레임)`});
      }
    }
    
    // R6c. L2만 있는 경우 직계 부모 INFO
    if(l1Refs.length===0&&l2Refs.length>0&&l3Refs.length===0){
      const parents=[...new Set(l2Refs.map(n=>Math.floor(n/100)*100))];
      if(parents.length===1){
        issues.push({severity:'INFO',rule:'R6c',message:`도 ${figNum} 최외곽: ${parents[0]} (직계 부모)`});
      }
    }
    
    // R6d. L3만 있는 경우 직계 부모 INFO
    if(l1Refs.length===0&&l2Refs.length===0&&l3Refs.length>0){
      const l2Parents=[...new Set(l3Refs.map(n=>Math.floor(n/10)*10))];
      if(l2Parents.length===1){
        issues.push({severity:'INFO',rule:'R6d',message:`도 ${figNum} 최외곽: ${l2Parents[0]} (직계 부모)`});
      }
    }
    
    // R6e. L2+L3 혼합: L2가 L3의 직계 부모인지 검증 ★신규★
    if(l1Refs.length===0&&l2Refs.length>0&&l3Refs.length>0){
      if(l2Refs.length===1){
        const theL2=l2Refs[0];
        const allL3BelongToL2=l3Refs.every(n=>Math.floor(n/10)*10===theL2);
        if(allL3BelongToL2){
          issues.push({severity:'INFO',rule:'R6e',message:`도 ${figNum} 최외곽: ${theL2} (L2 자체가 프레임, 내부 L3: ${l3Refs.join(',')})`});
        }else{
          const badL3=l3Refs.filter(n=>Math.floor(n/10)*10!==theL2);
          issues.push({severity:'ERROR',rule:'R6e',message:`도 ${figNum}: L3(${badL3.join(',')})가 L2(${theL2})의 하위가 아님`});
        }
      }else{
        // 여러 L2가 있으면 경고
        issues.push({severity:'WARNING',rule:'R6e',message:`도 ${figNum}: L2(${l2Refs.join(',')})와 L3(${l3Refs.join(',')}) 혼합 - 계층 확인 필요`});
      }
    }
    
    // R6f. L4 포함 시: L3가 직계 부모인지 검증
    if(l4Refs.length>0){
      if(l3Refs.length===1){
        const theL3=l3Refs[0];
        const allL4Belong=l4Refs.every(n=>Math.floor(n/10)===theL3);
        if(allL4Belong){
          issues.push({severity:'INFO',rule:'R6f',message:`도 ${figNum} 최외곽: ${theL3} (L3 프레임, 내부 L4: ${l4Refs.join(',')})`});
        }else{
          const bad=l4Refs.filter(n=>Math.floor(n/10)!==theL3);
          issues.push({severity:'ERROR',rule:'R6f',message:`도 ${figNum}: L4(${bad.join(',')})가 L3(${theL3})의 하위가 아님`});
        }
      }else if(l3Refs.length===0){
        const parents=[...new Set(l4Refs.map(n=>Math.floor(n/10)))];
        if(parents.length===1){
          issues.push({severity:'INFO',rule:'R6f',message:`도 ${figNum} 최외곽: ${parents[0]} (L4 직계부모)`});
        }
      }
    }
    
    // R6g. 데이터 참조번호 (D접두사 또는 소수)
    if(dRefs.length>0||smallRefs.length>0){
      const topD=dRefs.filter(d=>d.num<10);
      const subD=dRefs.filter(d=>d.num>=10);
      if(topD.length===1&&subD.length>0){
        issues.push({severity:'INFO',rule:'R6g',message:`도 ${figNum} 최외곽: ${topD[0].full} (데이터 프레임)`});
      }
    }
  }
  
  // ═══ R7. 도면 설계 텍스트와 노드 수 비교 ═══
  if(designText){
    // 도면 설계에서 해당 도면의 구성요소 개수 추출
    const figPattern=new RegExp(`도\\s*${figNum}[^]*?구성요소[^:：]*[：:]\\s*([^\\n]+)`,'i');
    const figMatch=designText.match(figPattern);
    if(figMatch){
      const designRefs=(figMatch[1].match(/\((\d+)\)/g)||[]).map(r=>r.replace(/[()]/g,''));
      // L1 포함 케이스: 설계에 L1이 있으면 렌더링에서 제외되므로 보정
      const hasDesignL1=designRefs.some(r=>parseInt(r)%100===0);
      const expectedCount=hasDesignL1?designRefs.length-1:designRefs.length;
      const actualInnerCount=l1Refs.length>0?nodes.length-l1Refs.length:nodes.length;
      
      if(expectedCount>0&&actualInnerCount<expectedCount){
        issues.push({severity:'WARNING',rule:'R7',message:`도 ${figNum}: 설계상 내부 구성요소 ${expectedCount}개인데 ${actualInnerCount}개만 파싱됨 (노드 누락 가능)`});
      }
    }
  }
  
  } // end if(!isMethodFig) — 장치 도면 전용 규칙 끝
  
  // ═══ R8. 방법 도면 검증 ═══
  const sRefs=allRefs.filter(r=>String(r).startsWith('S'));
  if(sRefs.length>0){
    // R8a. 방법 도면에 숫자 참조번호 혼입
    const numericInMethod=allRefs.filter(r=>!String(r).startsWith('S')&&!String(r).startsWith('D'));
    if(numericInMethod.length>0){
      issues.push({severity:'ERROR',rule:'R8a',message:`도 ${figNum}: 방법 도면에 장치 참조번호(${numericInMethod.join(',')}) 혼입`});
    }
    // R8b. 시작/종료 노드 확인
    const hasStart=nodes.some(n=>/시작|START/i.test(n.label));
    const hasEnd=nodes.some(n=>/종료|END/i.test(n.label));
    if(!hasStart)issues.push({severity:'WARNING',rule:'R8b',message:`도 ${figNum}: 흐름도에 "시작" 노드 없음`});
    if(!hasEnd)issues.push({severity:'WARNING',rule:'R8b',message:`도 ${figNum}: 흐름도에 "종료" 노드 없음`});
  }
  
  return issues;
}

// ═══ 렌더링 후 시각 검증 (새 기능) ═══
function postRenderValidation(sid){
  const data=diagramData[sid];
  if(!data||!data.length)return[];
  
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  const allIssues=[];
  
  data.forEach(({nodes},idx)=>{
    const figNum=figOffset+idx+1;
    const numRefs=nodes.map(n=>{
      const m=(n.label||'').match(/[(\s]?(S?\d+)[)\s]?$/i);
      return m?parseInt(m[1]):null;
    }).filter(n=>n!==null&&!isNaN(n));
    
    const l1s=numRefs.filter(n=>n%100===0);
    const nonL1=numRefs.filter(n=>n%100!==0);
    
    // 검증 V1: L1이 최외곽이 되는 경우, 내부에 L1이 중복 표시되면 안 됨
    if(figNum>1&&l1s.length===1&&nonL1.length>0){
      // 렌더러가 L1을 제외하는지 확인 (코드 레벨 검증)
      allIssues.push({
        figNum,severity:'CHECK',
        message:`도 ${figNum}: 최외곽=${l1s[0]}, 내부 박스=${nonL1.length}개 (L1 제외 확인)`
      });
    }
    
    // 검증 V2: 도 1에 L2/L3가 있으면 안 됨
    if(figNum===1&&nonL1.length>0){
      allIssues.push({
        figNum,severity:'ERROR',
        message:`도 1에 L2/L3 참조번호(${nonL1.join(',')}) 포함`
      });
    }
  });
  
  return allIssues;
}

function renderDiagrams(sid,mt){
  const cid=sid==='step_07'?'diagramsStep07':'diagramsStep11';
  const el=document.getElementById(cid);
  const blocks=extractMermaidBlocks(mt);
  if(!blocks.length){
    el.innerHTML=`<div class="diagram-container"><pre style="font-size:12px;white-space:pre-wrap">${App.escapeHtml(mt)}</pre></div>`;
    return;
  }
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  diagramData[sid]=[];
  
  // 도면 설계 텍스트 (R7 검증용)
  const designText=outputs[sid]||'';
  
  let html='';
  let allIssues=[];
  let hasErrors=false;
  
  blocks.forEach((code,i)=>{
    const figNum=figOffset+i+1;
    const{nodes,edges}=parseMermaidGraph(code);
    const positions=layoutGraph(nodes,edges);
    diagramData[sid].push({nodes,edges,positions});
    
    // 검증 실행 (설계 텍스트 포함)
    const issues=validateDiagramRules(nodes,figNum,designText);
    allIssues.push({figNum,issues});
    if(issues.some(iss=>iss.severity==='ERROR'))hasErrors=true;
    
    // 검증 결과 HTML
    let issuesHtml='';
    const visibleIssues=issues.filter(iss=>iss.severity!=='CHECK');
    if(visibleIssues.length){
      issuesHtml='<div style="margin-bottom:8px">';
      visibleIssues.forEach(iss=>{
        const bg=iss.severity==='ERROR'?'#fee':iss.severity==='WARNING'?'#fff8e1':'#e3f2fd';
        const fg=iss.severity==='ERROR'?'#c62828':iss.severity==='WARNING'?'#f57c00':'#1565c0';
        issuesHtml+=`<div style="font-size:11px;padding:4px 8px;margin:2px 0;border-radius:4px;background:${bg};color:${fg}"><b>${iss.severity}</b> [${iss.rule}]: ${App.escapeHtml(iss.message)}</div>`;
      });
      issuesHtml+='</div>';
    }
    
    html+=`<div class="diagram-container">
      <div class="diagram-label">도 ${figNum}</div>
      ${issuesHtml}
      <div id="diagram_${sid}_${i}" style="background:#fff;border:1px solid #eee;border-radius:8px;padding:12px;overflow-x:auto"></div>
      <details style="margin-top:8px"><summary style="font-size:11px;color:var(--color-text-tertiary);cursor:pointer">Mermaid 코드 보기</summary><pre style="font-size:11px;margin-top:4px;padding:8px;background:var(--color-bg-tertiary);border-radius:8px;overflow-x:auto">${App.escapeHtml(code)}</pre></details>
    </div>`;
  });
  
  // 에러 발견 시 재생성 버튼
  if(hasErrors){
    const errorSummary=allIssues.filter(ai=>ai.issues.some(iss=>iss.severity==='ERROR'))
      .map(ai=>`도 ${ai.figNum}: ${ai.issues.filter(iss=>iss.severity==='ERROR').map(iss=>`[${iss.rule}] ${iss.message}`).join('; ')}`)
      .join('\n');
    window._diagramErrors={sid,errors:errorSummary};
    html=`<div style="background:#ffebee;border:1px solid #ef5350;border-radius:8px;padding:12px;margin-bottom:16px">
      <div style="color:#c62828;font-weight:600;margin-bottom:8px">⚠️ 도면 규칙 위반 발견</div>
      <div style="font-size:12px;color:#b71c1c;margin-bottom:12px;white-space:pre-line">${App.escapeHtml(errorSummary)}</div>
      <button onclick="regenerateDiagramWithFeedback('${sid}')" style="background:#1976d2;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px">🔄 규칙에 맞게 재생성</button>
    </div>`+html;
  }
  
  // 도면 검증 버튼 항상 추가
  html+=`<div style="margin-top:12px;padding:12px;background:var(--color-bg-secondary);border-radius:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <button onclick="runDiagramValidation('${sid}')" style="background:#43a047;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px">✅ 도면 검증</button>
    <button onclick="runAIDiagramReview('${sid}')" style="background:#7b1fa2;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px">🤖 AI 연결관계 검증</button>
    <button onclick="regenerateDiagramWithFeedback('${sid}')" style="background:#1565c0;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px">🔄 재생성</button>
    <span id="validationResult_${sid}" style="font-size:12px;color:var(--color-text-secondary)"></span>
  </div>
  <div id="aiReviewResult_${sid}" style="margin-top:8px"></div>`;
  
  el.innerHTML=html;
  
  // SVG 렌더링
  blocks.forEach((code,i)=>{
    const{nodes,edges,positions}=diagramData[sid][i];
    renderDiagramSvg(`diagram_${sid}_${i}`,nodes,edges,positions,figOffset+i+1);
  });
}

// ═══ 도면 검증 실행 함수 ═══
function runDiagramValidation(sid){
  const data=diagramData[sid];
  if(!data||!data.length){
    App.showToast('검증할 도면이 없습니다.','error');
    return;
  }
  
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  const designText=outputs[sid]||'';
  let totalErrors=0,totalWarnings=0;
  let reportHtml='';
  
  data.forEach(({nodes},idx)=>{
    const figNum=figOffset+idx+1;
    const issues=validateDiagramRules(nodes,figNum,designText);
    const errors=issues.filter(i=>i.severity==='ERROR');
    const warnings=issues.filter(i=>i.severity==='WARNING');
    const infos=issues.filter(i=>i.severity==='INFO');
    totalErrors+=errors.length;
    totalWarnings+=warnings.length;
    
    if(errors.length||warnings.length){
      reportHtml+=`<div style="margin:4px 0"><b>도 ${figNum}:</b> `;
      errors.forEach(e=>reportHtml+=`<span style="color:#c62828;font-size:11px">❌ [${e.rule}] ${e.message} </span>`);
      warnings.forEach(w=>reportHtml+=`<span style="color:#f57c00;font-size:11px">⚠️ [${w.rule}] ${w.message} </span>`);
      reportHtml+='</div>';
    }else{
      reportHtml+=`<div style="margin:4px 0;color:#2e7d32"><b>도 ${figNum}:</b> ✅ 통과 ${infos.map(i=>`(${i.message})`).join(' ')}</div>`;
    }
  });
  
  const resultEl=document.getElementById(`validationResult_${sid}`);
  if(resultEl){
    if(totalErrors===0&&totalWarnings===0){
      resultEl.innerHTML=`<span style="color:#2e7d32;font-weight:600">✅ 전체 검증 통과 (${data.length}개 도면)</span>`;
    }else{
      resultEl.innerHTML=`<div>
        <span style="color:#c62828;font-weight:600">❌ 오류 ${totalErrors}건</span>, 
        <span style="color:#f57c00">⚠️ 경고 ${totalWarnings}건</span>
        <div style="margin-top:6px;font-size:11px">${reportHtml}</div>
      </div>`;
    }
  }
  
  if(totalErrors>0){
    App.showToast(`도면 검증: 오류 ${totalErrors}건 발견. 재생성 권장.`,'error');
  }else if(totalWarnings>0){
    App.showToast(`도면 검증: 경고 ${totalWarnings}건 (수정 권장)`);
  }else{
    App.showToast(`도면 검증 통과 ✅ (${data.length}개 도면)`);
  }
}

// ═══ AI 정성적 도면 검증 (연결관계 적절성 평가) ═══
async function runAIDiagramReview(sid){
  const data=diagramData[sid];
  if(!data||!data.length){
    App.showToast('검증할 도면이 없습니다.','error');
    return;
  }
  
  const resultEl=document.getElementById(`aiReviewResult_${sid}`);
  if(resultEl)resultEl.innerHTML='<div style="padding:12px;background:#f3e5f5;border-radius:8px;font-size:12px;color:#6a1b9a">🤖 AI 연결관계 검증 중...</div>';
  
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  const designText=outputs[sid]||'';
  
  // 각 도면의 구조 정보 수집
  let diagramSummary='';
  data.forEach(({nodes,edges},idx)=>{
    const figNum=figOffset+idx+1;
    const nodeList=nodes.map(n=>{
      const ref=_extractRefNum(n.label,'?');
      const clean=n.label.replace(/[(\s]?(?:S|D)?\d+[)\s]?$/i,'').trim();
      return `${clean}(${ref})`;
    }).join(', ');
    const edgeList=(edges||[]).map(e=>{
      const fromLabel=nodes.find(n=>n.id===e.from)?.label||e.from;
      const toLabel=nodes.find(n=>n.id===e.to)?.label||e.to;
      return `${fromLabel} → ${toLabel}`;
    }).join(', ');
    diagramSummary+=`\n도 ${figNum}:\n  구성요소: ${nodeList}\n  연결관계: ${edgeList||'없음 (병렬 배치)'}\n`;
  });
  
  const prompt=`당신은 특허 도면 전문가입니다. 아래 도면의 연결관계가 기술적으로 적절한지 정성적으로 평가하세요.

═══ 평가 기준 ═══
1. **데이터/정보 도면**: 정보 항목(~정보, ~데이터)은 서버로 입력되는 것이므로 상호 간 화살표 연결이 부적절함. 병렬 배치가 적절.
2. **장치 블록도**: 하드웨어 구성요소 간 데이터 흐름이 있으면 화살표 연결 적절. 단, 메모리/저장부처럼 수동적 구성은 다른 구성에서 접근하는 방향만 적절.
3. **계층 일관성**: 상위 구성과 하위 구성이 같은 레벨에 표현되면 안 됨. 하위는 상위 내부에 포함되어야 함.
4. **방법 흐름도**: 단계 간 순서가 논리적이어야 함.

═══ 도면 설계 ═══
${designText.slice(0,2000)}

═══ 실제 도면 구조 ═══
${diagramSummary}

═══ 출력 형식 ═══
각 도면에 대해:
도 N: ✅ 적절 / ⚠️ 부적절
- (이유 한 줄)

마지막에 전체 요약 한 줄.`;

  try{
    const r=await App.callClaude(prompt);
    const reviewText=r.text||'';
    
    if(resultEl){
      resultEl.innerHTML=`<div style="padding:12px;background:#f3e5f5;border:1px solid #ce93d8;border-radius:8px;margin-top:8px">
        <div style="font-weight:600;color:#6a1b9a;margin-bottom:8px">🤖 AI 연결관계 검증 결과</div>
        <pre style="font-size:12px;white-space:pre-wrap;margin:0;color:#4a148c;line-height:1.6">${App.escapeHtml(reviewText)}</pre>
      </div>`;
    }
    
    // 부적절 항목이 있으면 window._diagramErrors에 추가
    if(reviewText.includes('부적절')||reviewText.includes('⚠️')){
      window._aiDiagramReview={sid,review:reviewText};
      App.showToast('AI 검증: 일부 도면 연결관계 수정 권장','warning');
    }else{
      App.showToast('AI 검증: 모든 도면 연결관계 적절 ✅');
    }
  }catch(e){
    if(resultEl)resultEl.innerHTML=`<div style="padding:8px;background:#ffebee;border-radius:8px;font-size:12px;color:#c62828">AI 검증 실패: ${e.message}</div>`;
    App.showToast('AI 검증 실패: '+e.message,'error');
  }
}

function downloadPptx(sid){
  // 라이브러리 체크
  if(typeof PptxGenJS==='undefined'){
    App.showToast('PPTX 라이브러리 로드 안됨. 페이지 새로고침 후 다시 시도해주세요.','error');
    console.error('PptxGenJS not loaded');
    return;
  }
  
  const data=diagramData[sid];
  if(!data||!data.length){
    const mt=outputs[sid+'_mermaid'];
    if(!mt){App.showToast('도면 없음','error');return;}
    const blocks=extractMermaidBlocks(mt);
    if(!blocks.length){App.showToast('Mermaid 코드 없음','error');return;}
    diagramData[sid]=blocks.map(code=>{
      const{nodes,edges}=parseMermaidGraph(code);
      return{nodes,edges,positions:layoutGraph(nodes,edges)};
    });
    return downloadPptx(sid);
  }
  
  App.showToast('PPTX 생성 중...');
  
  try{
    // ═══ KIPO 특허 도면 규칙 v4.1 ═══
    const pptx=new PptxGenJS();
    pptx.defineLayout({name:'A4_PORTRAIT',width:8.27,height:11.69});
    pptx.layout='A4_PORTRAIT';
    
    const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
    
    const LINE_FRAME=2.0,LINE_BOX=1.5,LINE_ARROW=1.0,SHADOW_OFFSET=0.04;
    const PAGE_MARGIN=0.6,PAGE_W=8.27-PAGE_MARGIN*2,PAGE_H=11.69-PAGE_MARGIN*2;
    const TITLE_H=0.5,AVAILABLE_H=PAGE_H-TITLE_H-0.3;
    
    function extractRefNum(label,fallback){
      const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
      return match?match[1]:fallback;
    }
    
    function isL1RefNum(ref){
      if(!ref||String(ref).startsWith('S'))return false;
      const s=String(ref);
      if(s.startsWith('D')){const n=parseInt(s.slice(1));return !isNaN(n)&&n<10;}
      const num=parseInt(s);
      if(isNaN(num))return false;
      if(num<10)return true;
      if(num<100)return false;
      if(num<1000)return num%100===0;
      return false;
    }
    
    function findImmediateParent(refNums){
      const nums=refNums.filter(r=>r&&!String(r).startsWith('S')).map(r=>{const s=String(r);return s.startsWith('D')?parseInt(s.slice(1)):parseInt(s);}).filter(n=>!isNaN(n)&&n>0);
      if(!nums.length)return null;
      const l1s=nums.filter(n=>n>=100&&n<1000&&n%100===0);
      const l2s=nums.filter(n=>n>=100&&n<1000&&n%10===0&&n%100!==0);
      const l3s=nums.filter(n=>n>=100&&n<1000&&n%10!==0);
      const l4s=nums.filter(n=>n>=1000&&n<10000);
      const smalls=nums.filter(n=>n<100);
      if(l4s.length>0){
        if(l3s.length===1&&l2s.length===0&&l1s.length===0){if(l4s.every(n=>Math.floor(n/10)===l3s[0]))return l3s[0];}
        if(l3s.length===0&&l2s.length===0&&l1s.length===0&&smalls.length===0){const p=[...new Set(l4s.map(n=>Math.floor(n/10)))];if(p.length===1)return p[0];}
        return null;
      }
      if(l1s.length>0){
        if(l1s.length===1&&(l2s.length>0||l3s.length>0)){const t=l1s[0];if(l2s.every(n=>Math.floor(n/100)*100===t)&&l3s.every(n=>Math.floor(n/100)*100===t))return t;}
        return null;
      }
      if(l2s.length>0&&l3s.length===0){const p=[...new Set(l2s.map(n=>Math.floor(n/100)*100))];return p.length===1?p[0]:null;}
      if(l2s.length>0&&l3s.length>0){
        if(l2s.length===1&&l3s.every(n=>Math.floor(n/10)*10===l2s[0]))return l2s[0];
        const p=[...new Set([...l2s,...l3s].map(n=>Math.floor(n/100)*100))];return p.length===1?p[0]:null;
      }
      if(l3s.length>0){const l2p=[...new Set(l3s.map(n=>Math.floor(n/10)*10))];if(l2p.length===1)return l2p[0];const l1p=[...new Set(l2p.map(p=>Math.floor(p/100)*100))];return l1p.length===1?l1p[0]:null;}
      if(smalls.length>0){
        const singles=smalls.filter(n=>n<10),doubles=smalls.filter(n=>n>=10);
        if(singles.length===1&&doubles.length>0&&doubles.every(n=>Math.floor(n/10)===singles[0]))return singles[0];
        if(singles.length===0&&doubles.length>0){const p=[...new Set(doubles.map(n=>Math.floor(n/10)))];if(p.length===1)return p[0];}
      }
      return null;
    }
    
    data.forEach(({nodes,edges},idx)=>{
      const slide=pptx.addSlide({bkgd:'FFFFFF'});
      const figNum=figOffset+idx+1;
      const hasEdges=edges&&edges.length>0;
      
      slide.addText(`도 ${figNum}`,{
        x:PAGE_MARGIN,y:PAGE_MARGIN,w:2,h:TITLE_H,
        fontSize:14,bold:true,fontFace:'맑은 고딕',color:'000000'
      });
      
      if(!nodes.length)return;
      
      const allRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
      const isMethodDiagram=allRefs.some(r=>String(r).startsWith('S'))||
        nodes.some(n=>/시작|종료|START|END/i.test(n.label));
      
      if(isMethodDiagram){
        // ═══ 방법 도면 PPTX v5.4: 중앙선 정렬 + 직선 화살표 ═══
        const boxStartY=PAGE_MARGIN+TITLE_H+0.2;
        const normalBoxW=PAGE_W-1.2;
        const startEndBoxW=normalBoxW*0.35;
        const centerX=PAGE_MARGIN+0.3+normalBoxW/2;  // 중앙선
        const nodeCount=nodes.length;
        const boxH=Math.min(0.55,AVAILABLE_H/nodeCount-0.15);
        const boxGap=Math.min(0.4,(AVAILABLE_H-boxH*nodeCount)/(nodeCount>1?nodeCount-1:1));
        
        nodes.forEach((n,i)=>{
          const refNum=extractRefNum(n.label,'');
          const cleanLabel=n.label.replace(/[(\s]?(?:S|D)?\d+[)\s]?$/i,'').trim();
          const isStartEnd=/시작|종료|START|END/i.test(n.label);
          
          const boxW=isStartEnd?startEndBoxW:normalBoxW;
          const bx=centerX-boxW/2;  // 중앙선 기준 배치
          const by=boxStartY+i*(boxH+boxGap);
          
          // 그림자
          slide.addShape(pptx.shapes.RECTANGLE,{x:bx+SHADOW_OFFSET,y:by+SHADOW_OFFSET,w:boxW,h:boxH,fill:{color:'000000'},line:{width:0}});
          
          // 박스 (완전 흑백)
          const opts={x:bx,y:by,w:boxW,h:boxH,fill:{color:'FFFFFF'},line:{color:'000000',width:isStartEnd?LINE_FRAME:LINE_BOX}};
          if(isStartEnd)opts.rectRadius=boxH*0.5*72;
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE||pptx.shapes.RECTANGLE,opts);
          slide.addText(cleanLabel,{x:bx+0.08,y:by,w:boxW-0.16,h:boxH,fontSize:isStartEnd?10:Math.min(12,Math.max(9,13-nodeCount*0.3)),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          
          // 리더라인 (시작/종료 제외)
          if(refNum&&!isStartEnd){
            const leaderEndX=PAGE_MARGIN+0.3+normalBoxW;
            slide.addShape(pptx.shapes.LINE,{x:bx+boxW,y:by+boxH/2,w:leaderEndX-(bx+boxW)+0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(refNum),{x:leaderEndX+0.35,y:by+boxH/2-0.12,w:0.5,h:0.24,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          }
          
          // ★ 화살표: 중앙선 직선 ★
          if(i<nodes.length-1){
            const arrowY1=by+boxH;
            const arrowY2=boxStartY+(i+1)*(boxH+boxGap);
            if(arrowY2>arrowY1+0.05){
              slide.addShape(pptx.shapes.LINE,{x:centerX,y:arrowY1,w:0,h:arrowY2-arrowY1,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle'}});
            }
          }
        });
        return;
      }
      
      const allL1=nodes.every(n=>isL1RefNum(extractRefNum(n.label,'')));
      const isFig1=figNum===1||allL1;
      let frameRefNum=findImmediateParent(allRefs);
      if(!frameRefNum&&allRefs.length>0){
        const firstRef=parseInt(allRefs[0])||100;
        frameRefNum=firstRef<100?Math.floor(firstRef/10):Math.floor(firstRef/100)*100;
      }
      if(!frameRefNum)frameRefNum=100;
      const nodeCount=nodes.length;
      
      if(isFig1){
        // ═══ 도 1: 블록도 v8.0 (최외곽 프레임 없이 박스 나열) ═══
        const boxStartX=PAGE_MARGIN+0.5,boxStartY=PAGE_MARGIN+TITLE_H+0.2;
        const boxW=PAGE_W-1.6;
        const boxH=Math.min(0.55,(AVAILABLE_H-0.15*(nodeCount-1))/nodeCount);
        const boxGap=(AVAILABLE_H-boxH*nodeCount)/(nodeCount>1?nodeCount-1:1);
        const refLabelX=boxStartX+boxW+0.1;
        
        nodes.forEach((n,i)=>{
          const bx=boxStartX,by=boxStartY+i*(boxH+boxGap);
          const refNum=extractRefNum(n.label,String((i+1)*100));
          const cleanLabel=n.label.replace(/[(\s]?S?\d+[)\s]?$/i,'').trim();
          
          slide.addShape(pptx.shapes.RECTANGLE,{x:bx+SHADOW_OFFSET,y:by+SHADOW_OFFSET,w:boxW,h:boxH,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x:bx,y:by,w:boxW,h:boxH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_FRAME}});
          slide.addText(cleanLabel,{x:bx+0.08,y:by,w:boxW-0.16,h:boxH,fontSize:Math.min(12,Math.max(9,13-nodeCount*0.3)),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          slide.addShape(pptx.shapes.LINE,{x:bx+boxW,y:by+boxH/2,w:0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
          slide.addText(String(refNum),{x:refLabelX+0.3,y:by+boxH/2-0.12,w:0.5,h:0.24,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          
          if(i<nodes.length-1){
            const arrowY1=by+boxH+0.04;
            const arrowY2=boxStartY+(i+1)*(boxH+boxGap)-0.04;
            const arrowX=bx+boxW/2;
            if(arrowY2>arrowY1+0.05){
              slide.addShape(pptx.shapes.LINE,{x:arrowX,y:arrowY1,w:0,h:arrowY2-arrowY1,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
            }
          }
        });
      }else{
        // 도 2+: 최외곽 박스 있음
        
        // ★ 최외곽 프레임과 동일한 참조번호 노드 제외 ★
        const innerNodes=nodes.filter(n=>{
          const ref=extractRefNum(n.label,'');
          if(!ref)return true;
          return parseInt(ref)!==frameRefNum;
        });
        const displayNodes=innerNodes.length>0?innerNodes:nodes;
        const dCount=displayNodes.length;
        
        const frameX=PAGE_MARGIN,frameY=PAGE_MARGIN+TITLE_H;
        const frameW=PAGE_W-0.8,frameH=Math.min(AVAILABLE_H,dCount*1.0+0.6);
        const framePadY=0.3,innerH=frameH-framePadY*2;
        const boxH=Math.min(0.55,(innerH-0.15*(dCount-1))/dCount);
        const boxGap=(innerH-boxH*dCount)/(dCount>1?dCount-1:1);
        const boxW=frameW-1.0,boxStartX=frameX+0.5,boxStartY=frameY+framePadY;
        const refLabelX=frameX+frameW+0.1;
        
        slide.addShape(pptx.shapes.RECTANGLE,{x:frameX+SHADOW_OFFSET,y:frameY+SHADOW_OFFSET,w:frameW,h:frameH,fill:{color:'000000'},line:{width:0}});
        slide.addShape(pptx.shapes.RECTANGLE,{x:frameX,y:frameY,w:frameW,h:frameH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_FRAME}});
        slide.addShape(pptx.shapes.LINE,{x:frameX+frameW,y:frameY+frameH/2,w:0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
        slide.addText(String(frameRefNum),{x:refLabelX+0.3,y:frameY+frameH/2-0.12,w:0.5,h:0.24,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
        
        displayNodes.forEach((n,i)=>{
          const bx=boxStartX,by=boxStartY+i*(boxH+boxGap);
          const fallbackRef=frameRefNum+10*(i+1);
          const refNum=extractRefNum(n.label,String(fallbackRef));
          const cleanLabel=n.label.replace(/[(\s]?S?\d+[)\s]?$/i,'').trim();
          
          slide.addShape(pptx.shapes.RECTANGLE,{x:bx+SHADOW_OFFSET,y:by+SHADOW_OFFSET,w:boxW,h:boxH,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x:bx,y:by,w:boxW,h:boxH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
          slide.addText(cleanLabel,{x:bx+0.08,y:by,w:boxW-0.16,h:boxH,fontSize:Math.min(11,Math.max(8,12-dCount*0.3)),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          slide.addShape(pptx.shapes.LINE,{x:bx+boxW,y:by+boxH/2,w:frameX+frameW-bx-boxW+0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
          slide.addText(String(refNum),{x:refLabelX+0.3,y:by+boxH/2-0.12,w:0.5,h:0.24,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          
          if(hasEdges&&i<displayNodes.length-1){
            const arrowY1=by+boxH,arrowY2=boxStartY+(i+1)*(boxH+boxGap),arrowX=bx+boxW/2;
            if(arrowY2>arrowY1+0.05){
              slide.addShape(pptx.shapes.LINE,{x:arrowX,y:arrowY1,w:0,h:arrowY2-arrowY1,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
            }
          }
        });
      }
    });
    
    const fileName=selectedTitle||selectedTitle||'도면';
    pptx.writeFile({fileName:`${fileName}_도면_${new Date().toISOString().slice(0,10)}.pptx`})
      .then(()=>App.showToast('PPTX 다운로드 완료'))
      .catch(err=>{
        console.error('PPTX 저장 실패:',err);
        App.showToast('PPTX 저장 실패: '+err.message,'error');
      });
  }catch(e){
    console.error('PPTX 생성 실패:',e);
    App.showToast('PPTX 생성 실패: '+e.message,'error');
  }
}

// ═══ 이미지 다운로드 (KIPO 규격 JPEG/TIF) ═══
function downloadDiagramImages(sid, format='jpeg'){
  console.log('downloadDiagramImages called:', sid, format);
  
  let data=diagramData[sid];
  if(!data||!data.length){
    const mt=outputs[sid+'_mermaid'];
    if(!mt){App.showToast('도면 없음','error');return;}
    const blocks=extractMermaidBlocks(mt);
    if(!blocks.length){App.showToast('Mermaid 코드 없음','error');return;}
    diagramData[sid]=blocks.map(code=>{
      const{nodes,edges}=parseMermaidGraph(code);
      return{nodes,edges,positions:layoutGraph(nodes,edges)};
    });
    data=diagramData[sid];
  }
  
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  const caseNum=selectedTitle||'도면';
  
  function extractRefNum(label,fallback){
    const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
    return match?match[1]:fallback;
  }
  
  function isL1RefNum(ref){
    if(!ref||String(ref).startsWith('S'))return false;
    const s=String(ref);
    // D접두사: D2→최상위, D21→하위
    if(s.startsWith('D')){const n=parseInt(s.slice(1));return !isNaN(n)&&n<10;}
    const num=parseInt(s);
    if(isNaN(num))return false;
    // 소수(1~9): 최상위
    if(num<10)return true;
    // 2자리(10~99): 하위
    if(num<100)return false;
    // 3자리: L1=X00
    if(num<1000)return num%100===0;
    // 4자리: L4이므로 아님
    return false;
  }
  
  function findImmediateParent(refNums){
    const nums=refNums.filter(r=>r&&!String(r).startsWith('S')).map(r=>{const s=String(r);return s.startsWith('D')?parseInt(s.slice(1)):parseInt(s);}).filter(n=>!isNaN(n)&&n>0);
    if(!nums.length)return null;
    const l1s=nums.filter(n=>n>=100&&n<1000&&n%100===0);
    const l2s=nums.filter(n=>n>=100&&n<1000&&n%10===0&&n%100!==0);
    const l3s=nums.filter(n=>n>=100&&n<1000&&n%10!==0);
    const l4s=nums.filter(n=>n>=1000&&n<10000);
    const smalls=nums.filter(n=>n<100);
    if(l4s.length>0){
      if(l3s.length===1&&l2s.length===0&&l1s.length===0){if(l4s.every(n=>Math.floor(n/10)===l3s[0]))return l3s[0];}
      if(l3s.length===0&&l2s.length===0&&l1s.length===0&&smalls.length===0){const p=[...new Set(l4s.map(n=>Math.floor(n/10)))];if(p.length===1)return p[0];}
      return null;
    }
    if(l1s.length>0){
      if(l1s.length===1&&(l2s.length>0||l3s.length>0)){const t=l1s[0];if(l2s.every(n=>Math.floor(n/100)*100===t)&&l3s.every(n=>Math.floor(n/100)*100===t))return t;}
      return null;
    }
    if(l2s.length>0&&l3s.length===0){const p=[...new Set(l2s.map(n=>Math.floor(n/100)*100))];return p.length===1?p[0]:null;}
    if(l2s.length>0&&l3s.length>0){
      if(l2s.length===1&&l3s.every(n=>Math.floor(n/10)*10===l2s[0]))return l2s[0];
      const p=[...new Set([...l2s,...l3s].map(n=>Math.floor(n/100)*100))];return p.length===1?p[0]:null;
    }
    if(l3s.length>0){const l2p=[...new Set(l3s.map(n=>Math.floor(n/10)*10))];if(l2p.length===1)return l2p[0];const l1p=[...new Set(l2p.map(p=>Math.floor(p/100)*100))];return l1p.length===1?l1p[0]:null;}
    if(smalls.length>0){
      const singles=smalls.filter(n=>n<10),doubles=smalls.filter(n=>n>=10);
      if(singles.length===1&&doubles.length>0&&doubles.every(n=>Math.floor(n/10)===singles[0]))return singles[0];
      if(singles.length===0&&doubles.length>0){const p=[...new Set(doubles.map(n=>Math.floor(n/10)))];if(p.length===1)return p[0];}
    }
    return null;
  }
  
  App.showToast(`도면 이미지 생성 중... (${data.length}개)`);
  
  // ★ ZIP 일괄 다운로드 ★
  const zip=typeof JSZip!=='undefined'?new JSZip():null;
  const imageFiles=[];
  let currentIdx=0;
  
  function processNext(){
    if(currentIdx>=data.length){
      // 모든 이미지 생성 완료 → ZIP 다운로드
      if(zip&&imageFiles.length>0){
        imageFiles.forEach(f=>zip.file(f.name,f.blob));
        zip.generateAsync({type:'blob'}).then(blob=>{
          const link=document.createElement('a');
          link.download=`${caseNum}_도면_${format==='tif'?'png':format}.zip`;
          link.href=URL.createObjectURL(blob);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          App.showToast(`도면 ${imageFiles.length}개 ZIP 다운로드 완료`);
        }).catch(e=>{
          App.showToast('ZIP 생성 실패: '+e.message,'error');
          // 폴백: 개별 다운로드
          fallbackIndividualDownload();
        });
      }else{
        // JSZip 없으면 개별 다운로드
        fallbackIndividualDownload();
      }
      return;
    }
    
    const{nodes,edges}=data[currentIdx];
    const figNum=figOffset+currentIdx+1;
    const hasEdges=edges&&edges.length>0;
    
    // 캔버스 생성 (스케일 없이 직접 크기 설정)
    const canvas=document.createElement('canvas');
    const W=800,H=1000;
    canvas.width=W;
    canvas.height=H;
    const ctx=canvas.getContext('2d');
    
    // 배경 흰색
    ctx.fillStyle='#FFFFFF';
    ctx.fillRect(0,0,W,H);
    
    // 도면 번호
    ctx.fillStyle='#000000';
    ctx.font='bold 16px "맑은 고딕", sans-serif';
    ctx.fillText(`도 ${figNum}`,30,35);
    
    if(nodes.length){
      const allRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
      const isMethodDiagram=allRefs.some(r=>String(r).startsWith('S'))||
        nodes.some(n=>/시작|종료|START|END/i.test(n.label));
      
      if(isMethodDiagram){
        // ═══ 방법 도면: 흐름도 (최외곽 없음, 단방향) ═══
        const nodeCount=nodes.length;
        const boxStartX=30,boxStartY=50;
        const boxW=620;
        const boxH=Math.min(55,(850-10*(nodeCount-1))/nodeCount);
        const boxGap=Math.min(40,(900-boxH*nodeCount)/(nodeCount>1?nodeCount-1:1));
        const SHADOW=3;
        
        nodes.forEach((n,i)=>{
          const bx=boxStartX,by=boxStartY+i*(boxH+boxGap);
          const refNum=extractRefNum(n.label,'');
          const cleanLabel=n.label.replace(/[(\s]?(?:S|D)?\d+[)\s]?$/i,'').trim();
          const isStartEnd=/시작|종료|START|END/i.test(n.label);
          
          // 그림자 (시작/종료는 둥근 그림자)
          ctx.fillStyle='#000000';
          if(isStartEnd){
            const r=boxH/2;
            ctx.beginPath();
            ctx.moveTo(bx+SHADOW+r,by+SHADOW);ctx.lineTo(bx+SHADOW+boxW-r,by+SHADOW);ctx.quadraticCurveTo(bx+SHADOW+boxW,by+SHADOW,bx+SHADOW+boxW,by+SHADOW+r);
            ctx.lineTo(bx+SHADOW+boxW,by+SHADOW+boxH-r);ctx.quadraticCurveTo(bx+SHADOW+boxW,by+SHADOW+boxH,bx+SHADOW+boxW-r,by+SHADOW+boxH);
            ctx.lineTo(bx+SHADOW+r,by+SHADOW+boxH);ctx.quadraticCurveTo(bx+SHADOW,by+SHADOW+boxH,bx+SHADOW,by+SHADOW+boxH-r);
            ctx.lineTo(bx+SHADOW,by+SHADOW+r);ctx.quadraticCurveTo(bx+SHADOW,by+SHADOW,bx+SHADOW+r,by+SHADOW);
            ctx.closePath();ctx.fill();
          }else{
            ctx.fillRect(bx+SHADOW,by+SHADOW,boxW,boxH);
          }
          
          // 시작/종료는 둥근 모서리 + 다른 배경
          ctx.fillStyle=isStartEnd?'#F5F5F5':'#FFFFFF';
          if(isStartEnd){
            const r=boxH/2;
            ctx.beginPath();
            ctx.moveTo(bx+r,by);ctx.lineTo(bx+boxW-r,by);ctx.quadraticCurveTo(bx+boxW,by,bx+boxW,by+r);
            ctx.lineTo(bx+boxW,by+boxH-r);ctx.quadraticCurveTo(bx+boxW,by+boxH,bx+boxW-r,by+boxH);
            ctx.lineTo(bx+r,by+boxH);ctx.quadraticCurveTo(bx,by+boxH,bx,by+boxH-r);
            ctx.lineTo(bx,by+r);ctx.quadraticCurveTo(bx,by,bx+r,by);
            ctx.closePath();ctx.fill();ctx.strokeStyle='#000000';ctx.lineWidth=2;ctx.stroke();
          }else{
            ctx.fillRect(bx,by,boxW,boxH);
            ctx.strokeStyle='#000000';ctx.lineWidth=2;ctx.strokeRect(bx,by,boxW,boxH);
          }
          
          ctx.fillStyle='#000000';
          ctx.font='13px "맑은 고딕", sans-serif';
          ctx.textAlign='center';
          ctx.fillText(cleanLabel,bx+boxW/2,by+boxH/2+4);
          
          // 리더라인 + 부호 (시작/종료 제외)
          if(refNum&&!isStartEnd){
            ctx.textAlign='left';
            ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(bx+boxW,by+boxH/2);ctx.lineTo(bx+boxW+20,by+boxH/2);ctx.stroke();
            ctx.font='11px "맑은 고딕", sans-serif';
            ctx.fillText(String(refNum),bx+boxW+30,by+boxH/2+4);
          }
          
          // 단방향 화살표
          if(i<nodes.length-1){
            const arrowX=bx+boxW/2,arrowY1=by+boxH+2,arrowY2=boxStartY+(i+1)*(boxH+boxGap)-2;
            if(arrowY2>arrowY1){
              ctx.beginPath();ctx.moveTo(arrowX,arrowY1);ctx.lineTo(arrowX,arrowY2);ctx.lineWidth=1;ctx.stroke();
              // 아래쪽 화살촉만 (단방향)
              ctx.beginPath();ctx.moveTo(arrowX-4,arrowY2-8);ctx.lineTo(arrowX,arrowY2);ctx.lineTo(arrowX+4,arrowY2-8);ctx.stroke();
            }
          }
        });
      }else{
      // 기존 장치 도면 로직
      const allL1=nodes.every(n=>isL1RefNum(extractRefNum(n.label,'')));
      const isFig1=figNum===1||allL1;
      let frameRefNum=findImmediateParent(allRefs);
      if(!frameRefNum&&allRefs.length>0){
        const firstRef=parseInt(allRefs[0])||100;
        frameRefNum=firstRef<100?Math.floor(firstRef/10):Math.floor(firstRef/100)*100;
      }
      if(!frameRefNum)frameRefNum=100;
      const nodeCount=nodes.length;
      const SHADOW=3;
      
      if(isFig1){
        // 도 1: 최외곽 박스 없음
        const boxStartX=30,boxStartY=50;
        const boxW=620;
        const boxH=Math.min(55,(850-10*(nodeCount-1))/nodeCount);
        const boxGap=Math.min(40,(900-boxH*nodeCount)/(nodeCount>1?nodeCount-1:1));
        
        nodes.forEach((n,i)=>{
          const bx=boxStartX,by=boxStartY+i*(boxH+boxGap);
          const refNum=extractRefNum(n.label,String((i+1)*100));
          const cleanLabel=n.label.replace(/[(\s]?S?\d+[)\s]?$/i,'').trim();
          
          ctx.fillStyle='#000000';
          ctx.fillRect(bx+SHADOW,by+SHADOW,boxW,boxH);
          ctx.fillStyle='#FFFFFF';
          ctx.fillRect(bx,by,boxW,boxH);
          ctx.strokeStyle='#000000';
          ctx.lineWidth=2;
          ctx.strokeRect(bx,by,boxW,boxH);
          
          ctx.fillStyle='#000000';
          ctx.font=`${Math.min(14,15-nodeCount*0.4)}px "맑은 고딕", sans-serif`;
          ctx.textAlign='center';
          ctx.textBaseline='middle';
          ctx.fillText(cleanLabel.slice(0,25),bx+boxW/2,by+boxH/2);
          ctx.textAlign='left';
          
          ctx.beginPath();
          ctx.moveTo(bx+boxW,by+boxH/2);
          ctx.lineTo(bx+boxW+25,by+boxH/2);
          ctx.lineWidth=1;
          ctx.stroke();
          
          ctx.font='11px "맑은 고딕", sans-serif';
          ctx.fillText(String(refNum),bx+boxW+30,by+boxH/2+4);
          
          if(hasEdges&&i<nodes.length-1){
            const arrowX=bx+boxW/2,arrowY1=by+boxH+2,arrowY2=boxStartY+(i+1)*(boxH+boxGap)-2;
            if(arrowY2>arrowY1){
              ctx.beginPath();
              ctx.moveTo(arrowX,arrowY1);
              ctx.lineTo(arrowX,arrowY2);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(arrowX-4,arrowY1+8);
              ctx.lineTo(arrowX,arrowY1);
              ctx.lineTo(arrowX+4,arrowY1+8);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(arrowX-4,arrowY2-8);
              ctx.lineTo(arrowX,arrowY2);
              ctx.lineTo(arrowX+4,arrowY2-8);
              ctx.stroke();
            }
          }
        });
      }else{
        // 도 2+: 최외곽 박스 있음
        
        // ★ 최외곽 프레임과 동일한 참조번호 노드 제외 ★
        const innerNodes=nodes.filter(n=>{
          const ref=extractRefNum(n.label,'');
          if(!ref)return true;
          return parseInt(ref)!==frameRefNum;
        });
        const displayNodes=innerNodes.length>0?innerNodes:nodes;
        const dCount=displayNodes.length;
        
        const frameX=30,frameY=50;
        const frameW=680,frameH=Math.min(900,dCount*80+50);
        
        ctx.fillStyle='#000000';
        ctx.fillRect(frameX+SHADOW,frameY+SHADOW,frameW,frameH);
        ctx.fillStyle='#FFFFFF';
        ctx.fillRect(frameX,frameY,frameW,frameH);
        ctx.strokeStyle='#000000';
        ctx.lineWidth=2;
        ctx.strokeRect(frameX,frameY,frameW,frameH);
        
        ctx.beginPath();
        ctx.moveTo(frameX+frameW,frameY+frameH/2);
        ctx.lineTo(frameX+frameW+25,frameY+frameH/2);
        ctx.lineWidth=1;
        ctx.stroke();
        
        ctx.font='11px "맑은 고딕", sans-serif';
        ctx.fillStyle='#000000';
        ctx.fillText(String(frameRefNum),frameX+frameW+30,frameY+frameH/2+4);
        
        const padY=20,innerH=frameH-padY*2;
        const boxH=Math.min(45,(innerH-10*(dCount-1))/dCount);
        const boxGap=(innerH-boxH*dCount)/(dCount>1?dCount-1:1);
        const boxW=frameW-100,boxStartX=frameX+35,boxStartY=frameY+padY;
        
        displayNodes.forEach((n,i)=>{
          const bx=boxStartX,by=boxStartY+i*(boxH+boxGap);
          const fallbackRef=frameRefNum+10*(i+1);
          const refNum=extractRefNum(n.label,String(fallbackRef));
          const cleanLabel=n.label.replace(/[(\s]?S?\d+[)\s]?$/i,'').trim();
          
          ctx.fillStyle='#000000';
          ctx.fillRect(bx+SHADOW,by+SHADOW,boxW,boxH);
          ctx.fillStyle='#FFFFFF';
          ctx.fillRect(bx,by,boxW,boxH);
          ctx.lineWidth=1.5;
          ctx.strokeRect(bx,by,boxW,boxH);
          
          ctx.fillStyle='#000000';
          ctx.font=`${Math.min(13,14-dCount*0.5)}px "맑은 고딕", sans-serif`;
          ctx.textAlign='center';
          ctx.textBaseline='middle';
          ctx.fillText(cleanLabel.slice(0,25),bx+boxW/2,by+boxH/2);
          ctx.textAlign='left';
          
          ctx.beginPath();
          ctx.moveTo(bx+boxW,by+boxH/2);
          ctx.lineTo(frameX+frameW+25,by+boxH/2);
          ctx.lineWidth=1;
          ctx.stroke();
          
          ctx.font='11px "맑은 고딕", sans-serif';
          ctx.fillText(String(refNum),frameX+frameW+30,by+boxH/2+4);
          
          if(hasEdges&&i<displayNodes.length-1){
            const arrowX=bx+boxW/2,arrowY1=by+boxH+2,arrowY2=boxStartY+(i+1)*(boxH+boxGap)-2;
            if(arrowY2>arrowY1){
              ctx.beginPath();
              ctx.moveTo(arrowX,arrowY1);
              ctx.lineTo(arrowX,arrowY2);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(arrowX-4,arrowY1+8);
              ctx.lineTo(arrowX,arrowY1);
              ctx.lineTo(arrowX+4,arrowY1+8);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(arrowX-4,arrowY2-8);
              ctx.lineTo(arrowX,arrowY2);
              ctx.lineTo(arrowX+4,arrowY2-8);
              ctx.stroke();
            }
          }
        });
      }
    } // end else (장치 도면)
    } // end if(nodes.length)
    
    // 이미지를 ZIP에 추가
    try{
      const ext=(format==='tif'||format==='tiff')?'png':(format==='jpeg'?'jpg':format);
      const mimeType=(format==='tif'||format==='tiff')?'image/png':`image/${format==='jpeg'?'jpeg':'png'}`;
      const quality=format==='jpeg'?0.95:undefined;
      const fileName=`${caseNum}_도${figNum}.${ext}`;
      
      canvas.toBlob(blob=>{
        if(blob){
          imageFiles.push({name:fileName,blob:blob});
        }
        currentIdx++;
        setTimeout(processNext,50);
      },mimeType,quality);
    }catch(e){
      console.error('이미지 생성 실패:',e);
      currentIdx++;
      setTimeout(processNext,50);
    }
  }
  
  // 폴백: JSZip 없을 때 개별 다운로드
  function fallbackIndividualDownload(){
    imageFiles.forEach((f,i)=>{
      setTimeout(()=>{
        const link=document.createElement('a');
        link.download=f.name;
        link.href=URL.createObjectURL(f.blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      },i*500);
    });
    App.showToast(`도면 ${imageFiles.length}개 개별 다운로드`);
  }
  
  processNext();
}

// 특허 도면용 레이아웃 계산 (A4 세로)
function layoutGraphForPatent(nodes,edges){
  const positions={};
  const boxW=5.0, boxH=0.7, boxGap=1.0;
  const startX=1.25, startY=1.3;
  
  nodes.forEach((n,i)=>{
    positions[n.id]={
      x:startX,
      y:startY+i*(boxH+boxGap),
      w:boxW,
      h:boxH,
      cx:startX+boxW/2,
      cy:startY+i*(boxH+boxGap)+boxH/2
    };
  });
  return positions;
}
function downloadPptxAll(){if(diagramData.step_07||outputs.step_07_mermaid)downloadPptx('step_07');else App.showToast('도면 없음','error');}

// ═══════════ RENDERERS ═══════════
function renderOutput(sid,text){const cid=`result${sid.charAt(0).toUpperCase()+sid.slice(1).replace('_','')}`;const el=document.getElementById(cid);if(!el)return;if(sid==='step_01')renderTitleCards(el,text);else if(sid==='step_06'||sid==='step_10')renderClaimResult(el,sid,text);else renderEditableResult(el,sid,text);
}
function renderTitleCards(c,text){
  const cs=parseTitleCandidates(text);
  if(!cs.length){
    c.innerHTML=`<div style="margin-top:12px;padding:12px;background:var(--color-bg-tertiary);border-radius:8px;font-size:13px;white-space:pre-wrap">${App.escapeHtml(text)}</div>`;
    document.getElementById('titleConfirmArea').style.display='block';
    return;
  }
  // 세로 리스트 형태로 표시
  c.innerHTML='<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">'+cs.map(x=>`<div class="title-candidate-row" onclick="selectTitle(this,\`${x.korean.replace(/\`/g,'')}\`,\`${x.english.replace(/\`/g,'')}\`)" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:2px solid var(--color-border);border-radius:10px;cursor:pointer;transition:all 0.15s;background:#fff" onmouseover="this.style.borderColor='var(--color-primary)';this.style.background='var(--color-primary-light)'" onmouseout="if(!this.classList.contains('selected')){this.style.borderColor='var(--color-border)';this.style.background='#fff'}"><div style="width:28px;height:28px;border-radius:50%;background:var(--color-primary-light);color:var(--color-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${x.num}</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:var(--color-text-primary)">${App.escapeHtml(x.korean)}</div><div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">${App.escapeHtml(x.english)}</div></div></div>`).join('')+'</div>';
  document.getElementById('titleConfirmArea').style.display='block';
}
function renderClaimResult(c,sid,text){const st=parseClaimStats(text),iss=validateClaims(text);let h=`<div class="stat-row" style="margin-top:12px"><div class="stat-card stat-card-steps"><div class="stat-card-value">${st.total}</div><div class="stat-card-label">총 청구항</div></div><div class="stat-card stat-card-api"><div class="stat-card-value">${st.independent}</div><div class="stat-card-label">독립항</div></div><div class="stat-card stat-card-cost"><div class="stat-card-value">${st.dependent}</div><div class="stat-card-label">종속항</div></div></div>`;if(iss.length)h+=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="tossface">${i.severity==='CRITICAL'?'🔴':'🟠'}</span>${App.escapeHtml(i.message)}</div>`).join('');else h+='<div class="issue-item issue-pass"><span class="tossface">✅</span>모든 검증 통과</div>';h+=`<textarea class="result-textarea" rows="14" onchange="outputs['${sid}']=this.value">${App.escapeHtml(text)}</textarea>`;c.innerHTML=h;}
function renderEditableResult(c,sid,text){c.innerHTML=`<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="badge badge-primary">${STEP_NAMES[sid]||sid}</span><span class="badge badge-neutral">${text.length.toLocaleString()}자</span></div><textarea class="result-textarea" rows="10" onchange="outputs['${sid}']=this.value">${App.escapeHtml(text)}</textarea></div>`;}
function renderBatchResult(cid,sid,text){document.getElementById(cid).innerHTML+=`<div class="accordion-header" onclick="toggleAccordion(this)"><span><span class="tossface">✅</span> ${STEP_NAMES[sid]} <span class="badge badge-neutral">${text.length.toLocaleString()}자</span></span><span class="arrow">▶</span></div><div class="accordion-body"><textarea class="result-textarea" style="min-height:120px" onchange="outputs['${sid}']=this.value">${App.escapeHtml(text)}</textarea></div>`;}
function toggleAccordion(h){h.classList.toggle('open');const b=h.nextElementSibling;if(b)b.classList.toggle('open');}

// ═══════════ VALIDATION (v4.9 — full claim chain + relaxed matching) ═══════════
const KILLER_WORDS=[{pattern:/반드시/,msg:'"반드시" — 제한적 표현'},{pattern:/에 한하여/,msg:'"~에 한하여" — 제한적 표현'},{pattern:/에 한정/,msg:'"~에 한정" — 제한적 표현'},{pattern:/에 제한/,msg:'"~에 제한" — 제한적 표현'},{pattern:/필수적으로/,msg:'"필수적으로" — 제한적 표현'},{pattern:/무조건/,msg:'"무조건" — 제한적 표현'},{pattern:/오직/,msg:'"오직" — 제한적 표현'}];
// v4.9: Get full text of claim chain (claim N → references → parent → ... → independent)
// v5.1: Get ONLY cited claim chain text (follows "청구항 N에 있어서" references upward)
// Does NOT include unrelated claims — only the direct citation path
function getCitedChainText(claimNum, claims){
  const rm=claims[claimNum]?.match(/청구항\s*(\d+)에\s*있어서/);
  if(!rm)return '';
  let text='',current=parseInt(rm[1]);const visited=new Set();
  while(current&&!visited.has(current)){
    visited.add(current);
    if(claims[current])text+=' '+claims[current];
    const rm2=claims[current]?.match(/청구항\s*(\d+)에\s*있어서/);
    current=rm2?parseInt(rm2[1]):null;
  }
  return text;
}
function validateClaims(text){
  const iss=[];if(!text)return iss;const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,claims={};let m;
  while((m=cp.exec(text))!==null)claims[parseInt(m[1])]=m[2].trim();
  if(!Object.keys(claims).length){iss.push({severity:'HIGH',message:'청구항 파싱 실패'});return iss;}
  
  // ★ 동적 독립항 감지: 가장 작은 번호가 독립항 ★
  const claimNums=Object.keys(claims).map(Number).sort((a,b)=>a-b);
  const firstClaimNum=claimNums[0];
  
  // 독립항 판별: "N항에 있어서"가 없는 청구항 = 독립항
  const independentClaims=claimNums.filter(n=>{
    const ct=claims[n];
    return !/청구항\s*\d+에\s*있어서/.test(ct)&&!/제\s*\d+\s*항에\s*있어서/.test(ct);
  });
  
  if(independentClaims.length===0){
    iss.push({severity:'CRITICAL',message:'독립항 없음 (모든 청구항이 종속항)'});
  }
  
  // 각 청구항의 인용 정보 수집 (다중인용 검증용)
  const claimRefs={};
  Object.entries(claims).forEach(([num,ct])=>{
    const n=parseInt(num);
    const allCites=[];
    // "청구항 N에 있어서" 또는 "제N항 또는 제M항에 있어서" 등
    const citeMatches=ct.match(/(?:청구항|제)\s*(\d+)\s*(?:항)?/g)||[];
    citeMatches.forEach(cm=>{const nm=cm.match(/(\d+)/);if(nm)allCites.push(parseInt(nm[1]));});
    claimRefs[n]={cites:[...new Set(allCites)].filter(c=>c!==n),isMultiCite:false};
    // 다중인용 감지: "제N항 또는 제M항" 또는 "청구항 N 또는 청구항 M"
    if(/(?:제\s*\d+\s*항|청구항\s*\d+)\s*(?:또는|내지)\s*(?:제\s*\d+\s*항|청구항\s*\d+)/.test(ct)){
      claimRefs[n].isMultiCite=true;
    }
  });
  
  Object.entries(claims).forEach(([num,ct])=>{const n=parseInt(num);
    // 종속항 판별: "N항에 있어서" 존재 여부
    const isDependent=/청구항\s*\d+에\s*있어서/.test(ct)||/제\s*\d+\s*항에\s*있어서/.test(ct);
    if(isDependent){const rm=ct.match(/청구항\s*(\d+)에\s*있어서/)||ct.match(/제\s*(\d+)\s*항에\s*있어서/),rn=rm?parseInt(rm[1]):firstClaimNum;
      if(rm){if(!claims[rn])iss.push({severity:'HIGH',message:`청구항 ${num}: 참조 청구항 ${rn} 없음`});if(rn>=n)iss.push({severity:'HIGH',message:`청구항 ${num}: 자기/후행 청구항 참조`});}
      
      // ★ 대통령령 종속항 규칙 검증 ★
      const refs=claimRefs[n];
      if(refs){
        // ④ 번호 역전 금지: 인용 항은 자신보다 앞번호여야 함
        refs.cites.forEach(c=>{
          if(c>=n)iss.push({severity:'HIGH',message:`청구항 ${num}: 청구항 ${c}를 인용하나 뒤에 위치 (번호 역전 금지)`});
        });
        // ③ 다중인용의 다중인용 금지
        if(refs.isMultiCite){
          refs.cites.forEach(c=>{
            if(claimRefs[c]&&claimRefs[c].isMultiCite){
              iss.push({severity:'HIGH',message:`청구항 ${num}: 다중인용 종속항(청구항 ${c})을 다시 다중인용 — 대통령령 위반`});
            }
          });
        }
      }
      
      // v5.1: 2-step validation — "인용하는 청구항만 검토"
      const citedText=getCitedChainText(n, claims);
      // selfClean: 현재 청구항에서 "상기 ..." 구문을 통째로 제거 → 독립 정의 용어만 남김
      const selfClean=ct.replace(/상기\s+[가-힣]+(?:\s[가-힣]+){0,3}/g,' ');
      const srefs=ct.match(/상기\s+([가-힣]+(?:\s[가-힣]+){0,3})/g)||[];
      srefs.forEach(ref=>{const raw=ref.replace(/^상기\s+/,''),cw=raw.split(/\s+/).slice(0,2).map(stripKoreanParticles).filter(w=>w.length>=2&&w!=='상기');if(!cw.length)return;
        // Step 1: 인용 청구항 체인에서 키워드 검색
        const inCited=cw.filter(w=>citedText.includes(w)).length;
        if(inCited>0)return;
        // Step 2: 현재 청구항 내 독립 정의 확인 (상기 구문 제거 후)
        const inSelf=cw.filter(w=>selfClean.includes(w)).length;
        if(inSelf>0)return;
        // 양쪽 모두 없음 → 기재불비
        iss.push({severity:'HIGH',message:`청구항 ${num}: "상기 ${raw}" — 인용 청구항 체인에 "${cw.join(', ')}" 선행기재 없음`});
      });}
    KILLER_WORDS.forEach(kw=>{if(kw.pattern.test(ct))iss.push({severity:'HIGH',message:`청구항 ${num}: ${kw.msg}`});});
  });return iss;
}
function runValidation(){const all=[outputs.step_06,outputs.step_10].filter(Boolean).join('\n');if(!all){App.showToast('검증할 청구항이 없어요','error');return;}const iss=validateClaims(all),el=document.getElementById('validationResults');if(!iss.length){el.innerHTML='<div class="issue-item issue-pass"><span class="tossface">🎉</span>모든 검증 통과</div>';return;}el.innerHTML=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="tossface">${i.severity==='CRITICAL'?'🔴':'🟠'}</span>${App.escapeHtml(i.message)}</div>`).join('');}

// ═══════════ OUTPUT ═══════════
function updateStats(){const c=Object.keys(outputs).filter(k=>outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;document.getElementById('statCompleted').textContent=`${c}/19`;document.getElementById('statApiCalls').textContent=usage.calls;document.getElementById('statCost').textContent=`$${(usage.cost||0).toFixed(2)}`;}
function renderPreview(){const el=document.getElementById('previewArea'),spec=buildSpecification();if(!spec.trim()){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px;text-align:center;padding:20px">생성된 항목이 없어요</p>';return;}el.innerHTML=spec.split(/(?=【)/).map(s=>{const h=s.match(/【(.+?)】/);if(!h)return '';return `<div class="accordion-header" onclick="toggleAccordion(this)"><span>【${App.escapeHtml(h[1])}】</span><span class="arrow">▶</span></div><div class="accordion-body">${App.escapeHtml(s)}</div>`;}).join('');}
function buildSpecification(){
  const desc=getFullDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  // v4.9: Include English title
  const titleLine=selectedTitleEn?`${selectedTitle}\n{${selectedTitleEn}}`:selectedTitle;
  // Claims: use the latest version (after auto-correction from validation)
  const deviceClaims=outputs.step_06||'';
  const methodClaims=outputs.step_10||'';
  const allClaims=[deviceClaims,methodClaims].filter(Boolean).join('\n\n');
  // Include step_14 (alternative claims) if available
  let extras='';
  if(outputs.step_14)extras+='\n\n[참고: 대안 청구항]\n'+outputs.step_14;
  if(outputs.step_15)extras+='\n\n[참고: 특허성 검토]\n'+outputs.step_15;
  return['【발명의 설명】',`【발명의 명칭】\n${titleLine}`,`【기술분야】\n${outputs.step_02||''}`,`【발명의 배경이 되는 기술】\n${outputs.step_03||''}`,`【선행기술문헌】\n${outputs.step_04||''}`,'【발명의 내용】',`【해결하고자 하는 과제】\n${outputs.step_05||''}`,`【과제의 해결 수단】\n${outputs.step_17||''}`,`【발명의 효과】\n${outputs.step_16||''}`,`【도면의 간단한 설명】\n${brief||''}`,`【발명을 실시하기 위한 구체적인 내용】\n${desc}${outputs.step_12?'\n\n'+outputs.step_12:''}`,`【부호의 설명】\n${outputs.step_18||''}`,`【청구범위】\n${allClaims}`,`【요약서】\n${outputs.step_19||''}`].filter(Boolean).join('\n\n')+extras;
}
function copyToClipboard(){const t=buildSpecification();if(!t.trim()){App.showToast('내용 없음','error');return;}navigator.clipboard.writeText(t).then(()=>App.showToast('복사 완료')).catch(()=>App.showToast('클립보드 접근 불가','error'));}
function downloadAsTxt(){const t=buildSpecification();if(!t.trim()){App.showToast('내용 없음','error');return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.txt`;a.click();}

function downloadAsWord(){
  const desc=getFullDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  // v4.9: Include English title
  const titleLine=selectedTitleEn?`${selectedTitle}\n{${selectedTitleEn}}`:selectedTitle;
  const allClaims=[outputs.step_06,outputs.step_10].filter(Boolean).join('\n\n');
  const secs=[{h:'발명의 설명'},{h:'발명의 명칭',b:titleLine},{h:'기술분야',b:outputs.step_02},{h:'발명의 배경이 되는 기술',b:outputs.step_03},{h:'선행기술문헌',b:outputs.step_04},{h:'발명의 내용'},{h:'해결하고자 하는 과제',b:outputs.step_05},{h:'과제의 해결 수단',b:outputs.step_17},{h:'발명의 효과',b:outputs.step_16},{h:'도면의 간단한 설명',b:brief},{h:'발명을 실시하기 위한 구체적인 내용',b:[desc,outputs.step_12].filter(Boolean).join('\n\n')},{h:'부호의 설명',b:outputs.step_18},{h:'청구범위',b:allClaims},{h:'요약서',b:outputs.step_19}];
  const html=secs.map(s=>{const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${App.escapeHtml(s.h)}】</h2>`;if(!s.b)return hd;return hd+s.b.split('\n').filter(l=>l.trim()).map(l=>{const hl=/【수학식\s*\d+】/.test(l)||/__+/.test(l)?'background-color:#FFFF00;':'';return `<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify;${hl}">${App.escapeHtml(l.trim())}</p>`;}).join('');}).join('');
  const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}</body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();App.showToast('Word 다운로드 완료');
}


// ═══════════ DASHBOARD HOOK + INIT ═══════════
App._onDashboard = function(){ loadDashboardProjects(); loadGlobalRefFromStorage(); };

async function init(){
  mermaid.initialize({startOnLoad:false,theme:'neutral',securityLevel:'loose',fontFamily:'Pretendard Variable, Malgun Gothic, sans-serif',flowchart:{useMaxWidth:true,htmlLabels:true,curve:'linear'},themeVariables:{fontSize:'14px'}});
  const{data:{session}}=await App.sb.auth.getSession();
  if(session?.user)await onAuthSuccess(session.user);else App.showScreen('auth');
  App.sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')App.showScreen('auth');});
}
init();
