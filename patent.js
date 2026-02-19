/* ═══════════════════════════════════════════════════════════
   특허명세서 자동 생성 v5.5 — Patent Pipeline (20-Step)
   패치: 등록가능성 강화 + 사용자 명령어 + 앵커 뒷받침
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
  {key:'privacy_audit', label:'프라이버시 감사', desc:'권한/마스킹/감사로그 기반 제어'},
  {key:'temporal_windowing', label:'시계열 윈도우', desc:'시간 구간별 슬라이딩 윈도우·감쇠 계수·시점 가중 집계'},
  {key:'caching_indexing', label:'캐싱/인덱싱', desc:'중간 결과 캐싱·해시 인덱스·유효기간 기반 갱신 판단'},
  {key:'ensemble_arbitration', label:'앙상블 중재', desc:'복수 모델/알고리즘 출력의 투표·가중 평균·신뢰도 기반 선택'}
];
const CATEGORY_ENDINGS = {
  server:'~을 특징으로 하는 …서버.', system:'~을 특징으로 하는 …시스템.',
  apparatus:'~을 특징으로 하는 …장치.', electronic_device:'~을 특징으로 하는 …전자단말.',
  method:'~을 특징으로 하는 …방법.',
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
let stepUserCommands = {}; // v5.5: 각 스텝별 사용자 명령어

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
const STEP_NAMES={step_01:'발명의 명칭',step_02:'기술분야',step_03:'배경기술',step_04:'선행기술문헌',step_05:'해결하고자 하는 과제',step_06:'장치 청구항',step_07:'도면 설계',step_08:'장치 상세설명',step_09:'수학식',step_10:'방법 청구항',step_11:'방법 도면',step_12:'방법 상세설명',step_13:'검토',step_14:'대안 청구항',step_15:'특허성 검토',step_16:'발명의 효과',step_17:'과제의 해결 수단',step_18:'부호의 설명',step_19:'요약서',step_20:'기록매체/프로그램 청구항'};


// ═══════════ STATE MANAGEMENT ═══════════
function clearAllState(){
  currentProjectId=null;outputs={};selectedTitle='';selectedTitleEn='';selectedTitleType='';includeMethodClaims=true;
  usage={calls:0,inputTokens:0,outputTokens:0,cost:0};loadingState={};beforeReviewText='';uploadedFiles=[];diagramData={};
  projectRefStyleText='';requiredFigures=[];outputTimestamps={};stepUserCommands={};
  // Claim defaults
  deviceCategory='server';deviceGeneralDep=5;deviceAnchorDep=4;deviceAnchorStart=7;
  anchorThemeMode='auto';selectedAnchorThemes=[];
  methodCategory='method';methodGeneralDep=3;methodAnchorDep=2;methodAnchorStart=0;
  methodAnchorThemeMode='auto';selectedMethodAnchorThemes=[];
  // globalRefStyleText persists across projects
  const ids=['projectInput','titleInput'];ids.forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['titleConfirmArea','titleConfirmMsg','batchArea'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  for(let i=1;i<=19;i++){const e=document.getElementById(`resultStep${String(i).padStart(2,'0')}`);if(e)e.innerHTML='';}
  // v5.5: Clear step user command inputs
  document.querySelectorAll('[id^="userCmd_"]').forEach(el=>{el.value='';});
  ['resultsBatch25','resultsBatchFinish','validationResults','previewArea','diagramsStep07','diagramsStep11','fileList','requiredFiguresList','resultStep20'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='';});
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
  try{globalRefStyleText=App._lsGet('patent_global_ref')||'';}catch(e){globalRefStyleText='';}
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
      try{App._lsSet('patent_global_ref',globalRefStyleText);}catch(e){}
      st.innerHTML=`<span class="tossface">✅</span> ${App.escapeHtml(file.name)} (${globalRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearGlobalRef()" style="margin-left:4px">✕</button>`;
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
  deviceCategory=s.deviceCategory||'server';deviceGeneralDep=typeof s.deviceGeneralDep==='number'?s.deviceGeneralDep:5;deviceAnchorDep=typeof s.deviceAnchorDep==='number'?s.deviceAnchorDep:4;deviceAnchorStart=typeof s.deviceAnchorStart==='number'?s.deviceAnchorStart:7;
  anchorThemeMode=s.anchorThemeMode||'auto';selectedAnchorThemes=s.selectedAnchorThemes||[];
  methodCategory=s.methodCategory||'method';methodGeneralDep=typeof s.methodGeneralDep==='number'?s.methodGeneralDep:3;methodAnchorDep=typeof s.methodAnchorDep==='number'?s.methodAnchorDep:2;methodAnchorStart=typeof s.methodAnchorStart==='number'?s.methodAnchorStart:0;
  methodAnchorThemeMode=s.methodAnchorThemeMode||'auto';selectedMethodAnchorThemes=s.selectedMethodAnchorThemes||[];
  projectRefStyleText=s.projectRefStyleText||'';requiredFigures=s.requiredFigures||[];
  // Restore detail level
  detailLevel=s.detailLevel||'standard';customDetailChars=s.customDetailChars||2000;
  diagramData=s.diagramData||{};
  outputTimestamps=s.outputTimestamps||{};
  stepUserCommands=s.stepUserCommands||{};
  // FIX: Ensure API_KEY is loaded (use ensureApiKey instead of raw assignment)
  if(!API_KEY){App.ensureApiKey();}
  // Restore UI
  document.getElementById('methodToggle').checked=includeMethodClaims;toggleMethod();
  restoreClaimUI();
  // Restore custom title type
  if(selectedTitleType){const ci=document.getElementById('customTitleType');if(ci)ci.value=selectedTitleType;document.getElementById('btnStep01').disabled=false;}
  if(selectedTitle){document.getElementById('titleInput').value=selectedTitle;const enInp=document.getElementById('titleInputEn');if(enInp)enInp.value=selectedTitleEn||'';document.getElementById('titleConfirmArea').style.display='block';document.getElementById('titleConfirmMsg').style.display='block';document.getElementById('batchArea').style.display='block';}
  Object.keys(outputs).forEach(k=>{if(outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied'))renderOutput(k,outputs[k]);});
  // v5.5: 스텝별 사용자 명령어 UI 주입
  injectAllUserCommandUIs();
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
async function saveProject(silent=false){if(!currentProjectId)return;const t=selectedTitle||document.getElementById('projectInput').value.slice(0,30)||'새 사건';await App.sb.from('projects').update({title:t,invention_content:document.getElementById('projectInput').value,current_state_json:{outputs,selectedTitle,selectedTitleEn,selectedTitleType,includeMethodClaims,usage,deviceCategory,deviceGeneralDep,deviceAnchorDep,deviceAnchorStart,anchorThemeMode,selectedAnchorThemes,methodCategory,methodGeneralDep,methodAnchorDep,methodAnchorStart,methodAnchorThemeMode,selectedMethodAnchorThemes,projectRefStyleText,requiredFigures,detailLevel,customDetailChars,diagramData,outputTimestamps,stepUserCommands}}).eq('id',currentProjectId);if(!silent)App.showToast('저장됨');}

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
  // v7.0: 명칭 변경 시 하류 무효화
  invalidateDownstream('step_01');
}
function onTitleInput(){const v=document.getElementById('titleInput').value.trim();document.querySelectorAll('#resultStep01 .selection-card').forEach(c=>c.classList.remove('selected'));const prev=selectedTitle;selectedTitle=v;document.getElementById('titleConfirmMsg').style.display=v?'block':'none';document.getElementById('batchArea').style.display=v?'block':'none';if(v)autoSetDeviceCategoryFromTitle(v);if(prev&&prev!==v)invalidateDownstream('step_01');}
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

// ═══ v5.5: 스텝별 사용자 명령어 시스템 ═══
function getStepUserCommand(sid){
  // DOM 입력 필드에서 실시간 읽기 (있으면), 없으면 저장된 값
  const el=document.getElementById(`userCmd_${sid}`);
  const cmd=el?el.value.trim():(stepUserCommands[sid]||'');
  if(cmd)stepUserCommands[sid]=cmd;
  return cmd;
}
function setStepUserCommand(sid,val){
  stepUserCommands[sid]=(val||'').trim();
  const el=document.getElementById(`userCmd_${sid}`);
  if(el)el.value=stepUserCommands[sid];
}
function buildUserCommandSuffix(sid){
  const cmd=getStepUserCommand(sid);
  if(!cmd)return '';
  return `\n\n═══ 사용자 추가 지시사항 ═══\n아래 지시사항을 위의 기본 지침 범위 내에서 최우선으로 반영하라. 단, "지침 무시"라는 표현이 포함된 경우에는 기본 지침보다 아래 지시사항을 우선한다.\n${cmd}`;
}
// 스텝별 명령어 입력 UI를 동적으로 삽입하는 함수
function injectUserCommandUI(sid,containerSelector){
  const container=typeof containerSelector==='string'?document.querySelector(containerSelector):containerSelector;
  if(!container)return;
  // BUG-A fix: 이미 존재하면 값만 갱신
  const existing=container.querySelector('.user-cmd-area');
  if(existing){
    const ta=existing.querySelector(`#userCmd_${sid}`);
    if(ta)ta.value=stepUserCommands[sid]||'';
    return;
  }
  const area=document.createElement('div');
  area.className='user-cmd-area';
  area.style.cssText='margin:8px 0';
  area.innerHTML=`<details style="margin:0"><summary style="font-size:11px;color:var(--color-text-secondary);cursor:pointer;user-select:none;padding:4px 0">📝 추가 지시사항 (선택)</summary><textarea id="userCmd_${sid}" class="result-textarea" rows="2" placeholder="예: 독립항을 더 넓게 작성해 주세요 / 앵커에 캐싱 로직을 반드시 포함해 주세요" style="margin-top:6px;font-size:12px;min-height:48px;resize:vertical" oninput="stepUserCommands['${sid}']=this.value.trim()">${App.escapeHtml(stepUserCommands[sid]||'')}</textarea></details>`;
  // 버튼 바로 앞에 삽입
  const btn=container.querySelector('button[id^="btn"]');
  if(btn)container.insertBefore(area,btn);
  else container.appendChild(area);
}
function injectAllUserCommandUIs(){
  // 주요 생성 스텝에 사용자 명령어 UI 삽입
  const stepMap={
    step_06:'btnStep06',step_07:'btnStep07',step_08:'btnStep08',
    step_09:'btnStep09',step_10:'btnStep10',step_11:'btnStep11',
    step_12:'btnStep12',step_13:'btnStep13',step_14:'btnStep14',
    step_15:'btnStep15',step_20:'btnStep20'
  };
  Object.entries(stepMap).forEach(([sid,bid])=>{
    const btn=document.getElementById(bid);
    if(btn&&btn.parentElement)injectUserCommandUI(sid,btn.parentElement);
  });
}

// ═══ A4 fix: Step 의존성 무효화 시스템 (v5.5) ═══
// ═══ v7.0: 완전 의존성 맵 (MUST=필수/SHOULD=권장) ═══
const STEP_DEPENDENCIES={
  step_01:{MUST:['step_02','step_05','step_16','step_17','step_19'],SHOULD:['step_03','step_04']},
  step_03:{MUST:['step_05'],SHOULD:[]},
  step_05:{MUST:['step_16'],SHOULD:[]},
  step_06:{MUST:['step_07','step_08','step_10','step_13','step_14','step_15','step_16','step_17','step_19'],SHOULD:['step_09','step_11','step_12','step_18','step_20']},
  step_07:{MUST:['step_08','step_18'],SHOULD:['step_11','step_09','step_13']},
  step_08:{MUST:['step_09','step_13'],SHOULD:['step_12','step_14','step_15','step_16']},
  step_09:{MUST:[],SHOULD:['step_13']},
  step_10:{MUST:['step_11','step_12','step_13','step_17','step_20'],SHOULD:['step_14','step_15','step_18']},
  step_11:{MUST:['step_12','step_18'],SHOULD:['step_13']},
  step_12:{MUST:['step_13'],SHOULD:[]},
  step_15:{MUST:[],SHOULD:['step_08','step_09','step_12']},
  step_20:{MUST:['step_17'],SHOULD:[]},
};

// 각 step의 실행 함수 매핑 (연쇄 재생성용)
const STEP_RUNNERS={
  step_01:'runStep',step_02:'runStep',step_03:'runStep',step_04:'runStep',step_05:'runStep',
  step_06:'runStep',step_07:'runDiagramStep',step_08:'runLongStep',step_09:'runMathInsertion',
  step_10:'runStep',step_11:'runDiagramStep',step_12:'runLongStep',step_13:'runStep',
  step_14:'runStep',step_15:'runStep',step_16:'runStep',step_17:'runStep',
  step_18:'runStep',step_19:'runStep',step_20:'runStep',
};

function invalidateDownstream(changedStep){
  const depObj=STEP_DEPENDENCIES[changedStep];
  if(!depObj)return;
  const mustDeps=(depObj.MUST||[]).filter(d=>d!=='step_13_applied'&&outputs[d]);
  const shouldDeps=(depObj.SHOULD||[]).filter(d=>d!=='step_13_applied'&&outputs[d]);
  if(!mustDeps.length&&!shouldDeps.length)return;

  // 기존 stale-warning 제거
  document.querySelectorAll('.stale-warning').forEach(w=>w.remove());

  // v7.0: step→실제 element ID 매핑 (배치 렌더링 step 포함)
  const STEP_RESULT_EL={
    step_02:'resultsBatch25',step_03:'resultsBatch25',step_04:'resultsBatch25',step_05:'resultsBatch25',
    step_16:'resultsBatchFinish',step_17:'resultsBatchFinish',step_18:'resultsBatchFinish',step_19:'resultsBatchFinish',
  };

  // 각 영향받는 step에 경고 배지 표시
  [...mustDeps,...shouldDeps].forEach(d=>{
    const isMust=mustDeps.includes(d);
    const elId=STEP_RESULT_EL[d]||`result${d.charAt(0).toUpperCase()+d.slice(1).replace('_','')}`;
    const el=document.getElementById(elId);
    if(el){
      // 같은 step에 대한 기존 경고가 있으면 skip
      if(el.querySelector(`.stale-warning[data-step="${d}"]`))return;
      const w=document.createElement('div');
      w.className='stale-warning';
      w.dataset.step=d;
      w.dataset.staleLevel=isMust?'must':'should';
      w.style.cssText=isMust
        ?'background:#ffebee;border:1px solid #ef5350;border-radius:6px;padding:6px 10px;margin-bottom:6px;font-size:11px;color:#c62828;display:flex;align-items:center;gap:6px'
        :'background:#fff3e0;border:1px solid #ffb74d;border-radius:6px;padding:6px 10px;margin-bottom:6px;font-size:11px;color:#e65100;display:flex;align-items:center;gap:6px';
      w.innerHTML=`<span class="tossface">${isMust?'🔴':'🟡'}</span> ${STEP_NAMES[d]} — ${STEP_NAMES[changedStep]} 변경으로 ${isMust?'재생성 필수':'재생성 권장'}`;
      el.prepend(w);
    }
  });

  // ★ 연쇄 수정 패널 표시 ★
  showCascadePanel(changedStep,mustDeps,shouldDeps);
}

// ═══ 연쇄 수정 패널 UI ═══
function showCascadePanel(changedStep,mustDeps,shouldDeps){
  // 기존 패널 제거
  const old=document.getElementById('cascadePanel');
  if(old)old.remove();

  const panel=document.createElement('div');
  panel.id='cascadePanel';
  panel.style.cssText='position:fixed;bottom:20px;right:20px;width:380px;max-height:70vh;overflow-y:auto;background:#fff;border:2px solid #1976d2;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9999;font-family:"맑은 고딕",sans-serif';

  let html=`<div style="background:#1976d2;color:#fff;padding:12px 16px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:13px;font-weight:600">🔄 ${STEP_NAMES[changedStep]} 변경 — 연쇄 수정</span>
    <button onclick="document.getElementById('cascadePanel').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px">✕</button>
  </div>
  <div style="padding:12px 16px">`;

  // MUST 항목
  if(mustDeps.length){
    html+=`<div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:#c62828;margin-bottom:6px">🔴 필수 재생성 (${mustDeps.length}건)</div>`;
    mustDeps.forEach(d=>{
      html+=`<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer">
        <input type="checkbox" class="cascade-cb" data-step="${d}" data-level="must" checked style="accent-color:#c62828">
        <span>${STEP_NAMES[d]||d}</span>
      </label>`;
    });
    html+=`</div>`;
  }

  // SHOULD 항목
  if(shouldDeps.length){
    html+=`<details style="margin-bottom:10px"${mustDeps.length?'':' open'}>
      <summary style="font-size:11px;font-weight:700;color:#e65100;cursor:pointer;padding:4px 0">🟡 권장 재생성 (${shouldDeps.length}건)</summary>`;
    shouldDeps.forEach(d=>{
      html+=`<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer;margin-left:4px">
        <input type="checkbox" class="cascade-cb" data-step="${d}" data-level="should" style="accent-color:#ff9800">
        <span>${STEP_NAMES[d]||d}</span>
      </label>`;
    });
    html+=`</details>`;
  }

  // 전체선택/해제 + 실행 버튼
  html+=`<div style="display:flex;gap:8px;margin-top:10px">
    <button onclick="document.querySelectorAll('.cascade-cb').forEach(c=>c.checked=true)" style="flex:1;padding:6px;font-size:11px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer">전체 선택</button>
    <button onclick="document.querySelectorAll('.cascade-cb').forEach(c=>c.checked=false)" style="flex:1;padding:6px;font-size:11px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer">전체 해제</button>
  </div>
  <button id="btnCascadeRun" onclick="runCascadeRegeneration('${changedStep}')" style="width:100%;margin-top:10px;padding:10px;font-size:13px;font-weight:600;color:#fff;background:#1976d2;border:none;border-radius:8px;cursor:pointer">
    ✨ 선택 항목 자동 재생성
  </button>
  <div id="cascadeProgress" style="margin-top:8px;font-size:11px;color:#666"></div>
  </div>`;

  panel.innerHTML=html;
  document.body.appendChild(panel);
}

// ═══ 위상정렬: 의존성 순서 보장 (step_20→step_17 등) ═══
function topologicalSort(steps,sourceStep){
  // 선택된 steps 내에서의 의존 그래프 구축
  const stepSet=new Set(steps);
  const inDeg={};const adj={};
  steps.forEach(s=>{inDeg[s]=0;adj[s]=[];});
  // sourceStep의 하류 + 각 step 간 의존 관계 반영
  steps.forEach(s=>{
    const deps=STEP_DEPENDENCIES[s];
    if(!deps)return;
    [...deps.MUST,...deps.SHOULD].forEach(tgt=>{
      if(stepSet.has(tgt)&&tgt!==s){
        // s가 변경되면 tgt 재생성 필요 → s가 tgt보다 먼저
        adj[s]=adj[s]||[];adj[s].push(tgt);
        inDeg[tgt]=(inDeg[tgt]||0)+1;
      }
    });
  });
  // 또한 sourceStep → 모든 직접 하류가 먼저 실행되게
  // (sourceStep 자체는 이미 실행 완료된 상태)
  
  // Kahn's algorithm
  const queue=steps.filter(s=>inDeg[s]===0);
  const result=[];
  while(queue.length){
    // 같은 inDeg=0 중에서는 기본 순서 유지
    queue.sort((a,b)=>{
      const ai=parseInt(a.replace('step_',''));
      const bi=parseInt(b.replace('step_',''));
      return ai-bi;
    });
    const cur=queue.shift();
    result.push(cur);
    (adj[cur]||[]).forEach(nxt=>{
      inDeg[nxt]--;
      if(inDeg[nxt]===0)queue.push(nxt);
    });
  }
  // 순환 감지 — 순환 시 나머지를 번호 순으로 추가
  if(result.length<steps.length){
    const missing=steps.filter(s=>!result.includes(s));
    missing.sort((a,b)=>parseInt(a.replace('step_',''))-parseInt(b.replace('step_','')));
    result.push(...missing);
  }
  return result;
}

// ═══ 연쇄 재생성 실행 ═══
async function runCascadeRegeneration(sourceStep){
  const checkboxes=[...document.querySelectorAll('.cascade-cb:checked')];
  if(!checkboxes.length){App.showToast('재생성할 항목을 선택하세요','error');return;}
  if(globalProcessing){App.showToast('이미 처리 중입니다','error');return;}

  const steps=checkboxes.map(cb=>cb.dataset.step);
  // step_13_applied는 건너뛰기 (applyReview 전용)
  const validSteps=steps.filter(s=>s!=='step_13_applied'&&STEP_NAMES[s]);

  // ★ v7.0: 위상정렬 (step_20→step_17 등 역방향 의존 해결)
  const sorted=topologicalSort(validSteps,sourceStep);
  if(!sorted.length){App.showToast('정렬 실패','error');return;}

  // BUG-3 fix: globalProcessing 설정
  setGlobalProcessing(true);

  const btn=document.getElementById('btnCascadeRun');
  const prog=document.getElementById('cascadeProgress');
  if(btn){btn.disabled=true;btn.textContent='⏳ 재생성 진행 중...';}

  let completed=0;
  const total=sorted.length;

  for(const sid of sorted){
    if(prog)prog.innerHTML=`<div style="margin-bottom:4px">진행: ${completed+1}/${total} — <b>${STEP_NAMES[sid]}</b> 재생성 중...</div>
      <div style="background:#e0e0e0;border-radius:4px;height:6px"><div style="background:#1976d2;border-radius:4px;height:6px;width:${Math.round(completed/total*100)}%;transition:width .3s"></div></div>`;

    try{
      // step별 적절한 runner 호출
      const runner=STEP_RUNNERS[sid];
      if(runner==='runLongStep')await _cascadeRunLong(sid);
      else if(runner==='runDiagramStep')await _cascadeRunDiagram(sid);
      else if(runner==='runMathInsertion')await _cascadeRunMath();
      else await _cascadeRunShort(sid);

      completed++;
      // stale-warning 제거 (해당 step의 배지만 제거)
      document.querySelectorAll(`.stale-warning[data-step="${sid}"]`).forEach(w=>w.remove());
    }catch(e){
      console.error(`Cascade ${sid} 실패:`,e);
      if(prog)prog.innerHTML+=`<div style="color:#c62828;font-size:11px">❌ ${STEP_NAMES[sid]} 실패: ${e.message}</div>`;
    }
  }

  if(prog)prog.innerHTML=`<div style="color:#2e7d32;font-weight:600">✅ ${completed}/${total} 완료</div>
    <div style="background:#e0e0e0;border-radius:4px;height:6px"><div style="background:#4caf50;border-radius:4px;height:6px;width:100%"></div></div>`;
  if(btn){btn.textContent='✅ 완료';btn.style.background='#4caf50';}
  // BUG-3 fix: globalProcessing 해제
  setGlobalProcessing(false);
  setTimeout(()=>{const p=document.getElementById('cascadePanel');if(p)p.remove();},3000);
  saveProject(true);
  App.showToast(`연쇄 재생성 완료: ${completed}/${total}건 성공`);
}

// v7.0: 배치 step 여부 판별 + 적절한 렌더링
const BATCH_STEPS={step_02:'resultsBatch25',step_03:'resultsBatch25',step_04:'resultsBatch25',step_05:'resultsBatch25',step_16:'resultsBatchFinish',step_17:'resultsBatchFinish',step_18:'resultsBatchFinish',step_19:'resultsBatchFinish'};
function _cascadeRender(sid,text){
  if(BATCH_STEPS[sid]){
    renderBatchResult(BATCH_STEPS[sid],sid,text);
  }else{
    renderOutput(sid,text);
  }
}

// ═══ 연쇄용 내부 실행 함수 ═══
async function _cascadeRunShort(sid){
  // step_04는 KIPRIS API 검색 (buildPrompt 없음)
  if(sid==='step_04'){
    const sr=await searchPriorArt(selectedTitle);
    outputs.step_04=sr?sr.formatted:'【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';
    markOutputTimestamp('step_04');_cascadeRender('step_04',outputs.step_04);
    return;
  }
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  if(sid==='step_13'){
    const text=await App.callClaudeWithContinuation(prompt);
    outputs[sid]=text;
  }else{
    const r=await App.callClaude(prompt);
    outputs[sid]=r.text;
  }
  markOutputTimestamp(sid);_cascadeRender(sid,outputs[sid]);
  // step_06, step_10: 기재불비 자동 교정 (최대 2회)
  if(sid==='step_06'||sid==='step_10'){
    let corrected=outputs[sid];
    for(let round=0;round<2;round++){
      const issues=validateClaims(corrected);
      if(!issues.length)break;
      const issueText=issues.map(i=>i.message).join('\n');
      const fixR=await App.callClaude(`청구범위 기재불비를 수정하라.\n[지적사항]\n${issueText}\n[원본]\n${corrected}`);
      corrected=fixR.text;
    }
    outputs[sid]=corrected;markOutputTimestamp(sid);_cascadeRender(sid,corrected);
  }
}
async function _cascadeRunLong(sid){
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  const t=await App.callClaudeWithContinuation(prompt);
  outputs[sid]=t;markOutputTimestamp(sid);_cascadeRender(sid,t);
}
async function _cascadeRunDiagram(sid){
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  let r=await App.callClaude(prompt);
  let designText=r.text;
  // BUG-4 fix: 도면 검증 (장치 도면만, 최대 1회 재생성)
  if(sid==='step_07'&&typeof validateDiagramDesignText==='function'){
    const preIssues=validateDiagramDesignText(designText);
    if(preIssues.some(i=>i.severity==='ERROR')){
      const fb=`이전 도면 설계에 규칙 위반이 있습니다. 수정하여 다시 생성하세요.\n${preIssues.map(i=>i.message).join('\n')}\n원래 요청: ${prompt.slice(0,1500)}`;
      r=await App.callClaude(fb);designText=r.text;
    }
  }
  outputs[sid]=designText;markOutputTimestamp(sid);_cascadeRender(sid,designText);
  const mr=await App.callClaude(buildMermaidPrompt(sid),4096);
  outputs[sid+'_mermaid']=mr.text;
  renderDiagrams(sid,mr.text);
}
async function _cascadeRunMath(){
  const r=await App.callClaude(buildPrompt('step_09'));
  const baseDesc=outputs.step_08||'';
  outputs.step_09=insertMathBlocks(baseDesc,r.text);
  markOutputTimestamp('step_09');_cascadeRender('step_09',outputs.step_09);
}

// ═══ A1 fix: getLatestDescription — 타임스탬프 기반 최신본 (v5.5) ═══
let outputTimestamps={};
function markOutputTimestamp(sid){outputTimestamps[sid]=Date.now();}
function getLatestDescription(){
  // step_13_applied > step_09 > step_08 순이지만, step_08이 더 최신이면 step_08 우선
  const candidates=['step_13_applied','step_09','step_08'];
  const ts08=outputTimestamps.step_08||0;
  const ts09=outputTimestamps.step_09||0;
  const ts13a=outputTimestamps.step_13_applied||0;
  // step_08이 step_09/step_13_applied보다 나중이면 step_08이 최신본
  if(outputs.step_08&&ts08>ts09&&ts08>ts13a)return outputs.step_08;
  // 기존 우선순위
  return outputs.step_13_applied||outputs.step_09||outputs.step_08||'';
}
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
function extractBriefDescriptions(s07,s11){
  const d=[],seen=new Set();
  // 1. AI 출력에서 간단한 설명 추출
  [s07,s11].forEach(t=>{if(!t)return;const i=t.indexOf('---BRIEF_DESCRIPTIONS---');
    if(i>=0){
      // 마커 이후: 도 N으로 시작하는 줄 추출
      t.slice(i+24).trim().split('\n').filter(l=>/^도\s*\d+\s*[은는]\s/.test(l.trim())).forEach(l=>{const m=l.trim().match(/^도\s*(\d+)/);if(m&&!seen.has(m[1])){seen.add(m[1]);d.push(l.trim());}});
    }else{
      // 마커 없을 때: "도 N은/는 ~이다." 형식만 추출 (파트1 디자인 줄 제외)
      t.split('\n').filter(l=>/^도\s*\d+\s*[은는]\s/.test(l.trim())&&/이다\.\s*$/.test(l.trim())).forEach(l=>{const m=l.trim().match(/^도\s*(\d+)/);if(m&&!seen.has(m[1])){seen.add(m[1]);d.push(l.trim());}});
    }
  });
  // 2. 누락 도면 보완: diagramData 기반 폴백 생성
  const title=selectedTitle||'본 발명';
  const devSubject=getDeviceSubject();
  const devData=diagramData.step_07||[];
  const methodData=diagramData.step_11||[];
  const devFigCount=devData.length;
  // 2a. 장치 도면 폴백
  devData.forEach((dd,i)=>{const fn=String(i+1);if(seen.has(fn))return;
    function exRef(lab){const m=lab.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);return m?m[1]:'';}
    const allL1=dd.nodes.every(n=>{const r=exRef(n.label);if(!r)return false;const num=parseInt(r);return(num>0&&num<10)||(num>=100&&num<1000&&num%100===0);});
    if(i===0||allL1){d.push(`도 ${fn}은 ${title}의 전체 구성을 나타내는 블록도이다.`);}
    else{const refs=dd.nodes.map(n=>exRef(n.label)).filter(Boolean).map(Number).filter(n=>n>=100&&n<1000&&n%100===0);
      const pRef=refs.length?refs[0]:100;const pNode=dd.nodes.find(n=>{const r=exRef(n.label);return r&&parseInt(r)===pRef;});
      const pName=pNode?pNode.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim():devSubject;
      d.push(`도 ${fn}은 ${pName}(${pRef})의 내부 구성을 나타내는 블록도이다.`);}
    seen.add(fn);});
  // 2b. 방법 도면 폴백
  methodData.forEach((md,i)=>{const fn=String(devFigCount+i+1);if(seen.has(fn))return;
    d.push(`도 ${fn}은 ${title}에 의해 수행되는 방법을 나타내는 순서도이다.`);seen.add(fn);});
  // 2c. diagramData 없을 때 텍스트 기반 폴백
  if(!devData.length&&s07){const figs=s07.match(/도\s*(\d+)\s*:/g)||[];figs.forEach(f=>{const m=f.match(/(\d+)/);if(!m||seen.has(m[1]))return;const fn=m[1];
    if(fn==='1'){d.push(`도 1은 ${title}의 전체 구성을 나타내는 블록도이다.`);}
    else{d.push(`도 ${fn}은 ${title}의 세부 구성을 나타내는 블록도이다.`);}seen.add(fn);});}
  if(!methodData.length&&s11){const figs=s11.match(/도\s*(\d+)\s*:/g)||[];figs.forEach(f=>{const m=f.match(/(\d+)/);if(!m||seen.has(m[1]))return;const fn=m[1];
    d.push(`도 ${fn}은 ${title}에 의해 수행되는 방법을 나타내는 순서도이다.`);seen.add(fn);});}
  // 3. 정렬
  d.sort((a,b)=>{const na=parseInt(a.match(/도\s*(\d+)/)?.[1]||0),nb=parseInt(b.match(/도\s*(\d+)/)?.[1]||0);return na-nb;});
  return d.join('\n');
}
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
  // ═══ C5 fix: 디바운스 적용 (v5.5) — 연속 업로드 시 마지막만 API 호출 ═══
  if(uploadedFiles.length>0)debouncedGenerateInventionSummary();
}
function removeUploadedFile(idx, name) {
  const f = uploadedFiles[idx];if (!f) return;
  const ta = document.getElementById('projectInput');const marker = `[첨부: ${f.name}]`;const mIdx = ta.value.indexOf(marker);
  if (mIdx >= 0) {const nextMarker = ta.value.indexOf('\n\n[첨부:', mIdx + marker.length);const endIdx = nextMarker >= 0 ? nextMarker : ta.value.length;ta.value = (ta.value.slice(0, mIdx) + ta.value.slice(endIdx)).trim();}
  uploadedFiles.splice(idx, 1);const el = document.getElementById(`file_${idx}`);if (el) el.remove();App.showToast(`"${name}" 제거됨`);
}
// (File extraction functions are in common.js — App.extractTextFromFile, App.formatFileSize)

// ═══ Drag & Drop 파일 업로드 지원 ═══
function setupDragDrop(){
  const projectArea=document.getElementById('projectInput');
  if(!projectArea)return;
  const wrapper=projectArea.closest('.card')||projectArea.parentElement;
  if(!wrapper)return;
  // 드래그인드롭 영역 스타일링
  const overlay=document.createElement('div');
  overlay.id='dragOverlay';
  overlay.style.cssText='display:none;position:absolute;inset:0;background:rgba(79,70,229,0.08);border:2px dashed var(--color-primary);border-radius:12px;z-index:10;pointer-events:none;align-items:center;justify-content:center';
  overlay.innerHTML='<div style="text-align:center;color:var(--color-primary);font-weight:600"><span class="tossface" style="font-size:32px">📎</span><br>파일을 여기에 놓으세요<br><span style="font-size:12px;font-weight:normal;color:var(--color-text-secondary)">Word, PDF, PPT, 이미지 등</span></div>';
  wrapper.style.position='relative';
  wrapper.appendChild(overlay);
  let dragCounter=0;
  wrapper.addEventListener('dragenter',e=>{e.preventDefault();e.stopPropagation();dragCounter++;overlay.style.display='flex';});
  wrapper.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();});
  wrapper.addEventListener('dragleave',e=>{e.preventDefault();e.stopPropagation();dragCounter--;if(dragCounter<=0){dragCounter=0;overlay.style.display='none';}});
  wrapper.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();dragCounter=0;overlay.style.display='none';
    const files=Array.from(e.dataTransfer.files);if(!files.length)return;
    // 파일 입력 핸들러 재사용
    await handleDroppedFiles(files);
  });
  // 파일 input accept 속성 설정
  const fileInput=document.querySelector('input[type="file"][onchange*="handleFileUpload"]')||document.querySelector('#fileUploadInput');
  if(fileInput){
    fileInput.setAttribute('accept','.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.hwp,.hwpx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.csv');
    if(!fileInput.hasAttribute('multiple'))fileInput.setAttribute('multiple','');
  }
}
async function handleDroppedFiles(files){
  const listEl=document.getElementById('fileList');
  for(const file of files){
    if(uploadedFiles.find(f=>f.name===file.name)){App.showToast(`"${file.name}" 이미 추가됨`,'info');continue;}
    const item=document.createElement('div');item.className='file-upload-item';item.id=`file_${uploadedFiles.length}`;
    item.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:6px;font-size:13px';
    item.innerHTML=`<span class="tossface">📄</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(file.name)}</span><span class="badge badge-neutral">${App.formatFileSize(file.size)}</span><span style="color:var(--color-primary)">추출 중...</span>`;
    if(listEl)listEl.appendChild(item);
    try{
      const text=await App.extractTextFromFile(file);
      if(text&&text.trim()){
        uploadedFiles.push({name:file.name,text:text.trim(),size:file.size});
        const ta=document.getElementById('projectInput');const separator=ta.value.trim()?'\n\n':'';
        ta.value+=`${separator}[첨부: ${file.name}]\n${text.trim()}`;
        item.innerHTML=`<span class="tossface">✅</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(file.name)}</span><span class="badge badge-success">${App.formatFileSize(file.size)} · ${text.trim().length.toLocaleString()}자</span><button class="btn btn-ghost btn-sm" onclick="removeUploadedFile(${uploadedFiles.length-1},'${App.escapeHtml(file.name).replace(/'/g,"\\\\'")}')">\u2715</button>`;
        App.showToast(`"${file.name}" 추출 완료`);
      }else{
        item.innerHTML=`<span class="tossface">⚠️</span><span style="flex:1">${App.escapeHtml(file.name)}</span><span class="badge badge-warning">추출 불가</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">\u2715</button>`;
      }
    }catch(e){
      item.innerHTML=`<span class="tossface">❌</span><span style="flex:1">${App.escapeHtml(file.name)}</span><span class="badge badge-error">오류</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">\u2715</button>`;
    }
  }
  // ═══ C5 fix: 디바운스 적용 (v5.5) — 연속 업로드 시 마지막만 API 호출 ═══
  if(uploadedFiles.length>0)debouncedGenerateInventionSummary();
}

// ═══ C5: 파일 업로드 자동 요약 디바운스 (v5.5) ═══
let _summaryDebounceTimer=null;
function debouncedGenerateInventionSummary(){
  if(_summaryDebounceTimer)clearTimeout(_summaryDebounceTimer);
  _summaryDebounceTimer=setTimeout(()=>{generateInventionSummary();},1500);
}

// ═══ Task 2: 업로드 파일 자동 요약 (발명 내용 요약 표시) ═══
async function generateInventionSummary(){
  const inv=document.getElementById('projectInput').value.trim();
  if(!inv||inv.length<100)return;
  let summaryEl=document.getElementById('inventionSummary');
  if(!summaryEl){
    const ta=document.getElementById('projectInput');
    if(!ta)return;
    summaryEl=document.createElement('div');
    summaryEl.id='inventionSummary';
    summaryEl.style.cssText='margin-top:8px;padding:12px 16px;background:var(--color-bg-secondary);border-radius:10px;border-left:3px solid var(--color-primary);font-size:13px;line-height:1.6;color:var(--color-text-secondary)';
    summaryEl.innerHTML='<span style="font-weight:600;color:var(--color-text-primary)">📋 발명 내용 요약</span><br><span style="color:var(--color-primary)">요약 생성 중...</span>';
    ta.parentElement.insertBefore(summaryEl,ta.nextSibling);
  }else{
    summaryEl.innerHTML='<span style="font-weight:600;color:var(--color-text-primary)">📋 발명 내용 요약</span><br><span style="color:var(--color-primary)">요약 생성 중...</span>';
  }
  try{
    const r=await App.callClaude(`아래 발명 내용을 300자 이내로 핵심만 요약하라. 기술분야, 핵심 구성요소, 주요 기능을 포함. 마크다운/글머리 없이 자연스러운 문장으로.\n\n${inv.slice(0,5000)}`);
    summaryEl.innerHTML=`<span style="font-weight:600;color:var(--color-text-primary)">📋 발명 내용 요약</span><br>${App.escapeHtml(r.text)}`;
  }catch(e){
    summaryEl.innerHTML=`<span style="font-weight:600;color:var(--color-text-primary)">📋 발명 내용 요약</span><br><span style="color:var(--color-text-tertiary)">요약 생성 실패</span>`;
  }
}

// ═══════════ PROMPTS (v4.7 — Claim System Redesign) ═══════════
// Style reference: project-level overrides global-level
function getStyleRef(){
  const ref=projectRefStyleText||globalRefStyleText;
  if(!ref)return '';
  return '\n\n[참고 문체 — 아래 문서의 문장 형태, 단락 구조, 작성 방식만 참고하라. 내용은 절대 참조하지 마라. 발명의 내용과 무관하다.]\n'+ref.slice(0,3000);
}
function getFullInvention(opts){
  const inv=document.getElementById('projectInput').value;
  let text=inv;
  // opts.stripMeta: 청구범위/작성요청 등 메타 섹션 제거 (step_08, step_12 등 상세설명용)
  if(opts&&opts.stripMeta){
    text=text.replace(/\[청구범위\][\s\S]*?(?=\[(?!청구범위)|$)/gi,'')
             .replace(/\[작성\s*요청\][\s\S]*?(?=\[(?!작성)|$)/gi,'')
             .replace(/\[청구항\s*구성\][\s\S]*?(?=\[(?!청구항)|$)/gi,'')
             .trim();
  }
  return '\n\n★★★ [발명 내용 — 아래 내용의 기술적 요소를 빠짐없이 반영하라] ★★★\n'+text;
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
- 권한/마스킹/암호화/감사 → privacy_audit
- 시계열/시간/윈도우/감쇠/이력 → temporal_windowing
- 캐싱/인덱싱/중간결과/조회속도 → caching_indexing
- 앙상블/다중모델/투표/합의/비교 → ensemble_arbitration`;
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
// ★ 발명 명칭에서 장치 주체명 추출 (서버/시스템/장치/단말 등) ★
function getDeviceSubject(){
  const ty=selectedTitleType||'';
  if(/서버/.test(ty))return '서버';
  if(/시스템/.test(ty))return '시스템';
  if(/장치/.test(ty))return '장치';
  if(/단말/.test(ty))return '단말';
  const t=selectedTitle||'';
  const m=t.match(/(서버|시스템|장치|단말)\s*$/);
  if(m)return m[1];
  return '서버';
}

// ═══ 젭슨(Jepson) 청구항 지원 (v5.4) ═══
// 발명 명칭 말미를 분석하여 독립항의 Jepson 프리앰블을 생성
function parseJepsonSubjects(){
  const title=selectedTitle||'';
  const ty=selectedTitleType||'';
  // "및" 또는 "과" 로 분리된 복수 카테고리 감지 (예: "Z 서버 및 방법", "X 장치 및 방법")
  const conjMatch=title.match(/^(.+?)\s*(서버|시스템|장치|단말|전자\s*장치)\s*(및|과|,)\s*(방법)\s*$/);
  if(conjMatch){
    const core=conjMatch[1].trim();
    const devWord=conjMatch[2].trim();
    return {
      device:`${core} ${devWord}`,  // "Z 서버"
      method:`${core} 방법`,         // "Z 방법"
      hasDevice:true, hasMethod:true
    };
  }
  // 단일 카테고리
  const devMatch=title.match(/(서버|시스템|장치|단말|전자\s*장치)\s*$/);
  const methMatch=title.match(/방법\s*$/);
  if(devMatch&&!methMatch) return {device:title,method:'',hasDevice:true,hasMethod:false};
  if(methMatch&&!devMatch) return {device:'',method:title,hasDevice:false,hasMethod:true};
  // 타입 정보로 판단
  if(/서버|시스템|장치|단말/.test(ty))return {device:title,method:'',hasDevice:true,hasMethod:false};
  if(/방법/.test(ty))return {device:'',method:title,hasDevice:false,hasMethod:true};
  // 기본: 장치로 간주
  return {device:title,method:'',hasDevice:true,hasMethod:false};
}

function getJepsonInstruction(claimType){
  const subj=parseJepsonSubjects();
  const target=claimType==='method'?subj.method:subj.device;
  if(!target)return '';
  return `
★★★ 젭슨(Jepson) 청구항 형식 — 독립항 필수 적용 ★★★
독립항은 반드시 아래 젭슨(Jepson Claim) 구조를 따르라:

[구조]
(1) 전환부(Transition): "${target}에 있어서," ← 독립항의 첫 줄에 반드시 이 문구가 온다
(2) 전제부(Preamble): 공지 구성요소 또는 종래 기술 요소를 나열 (구성 간 세미콜론(;)으로 구분, 구성마다 줄바꿈)
(3) 특징부(Body): 본 발명의 신규하고 특징적인 구성요소를 기술 (구성 간 세미콜론(;)으로 구분, 구성마다 줄바꿈)
(4) 종결부(Closing): "~을 특징으로 하는 ${target}."

★ 서식 핵심 규칙 ★
- "~에 있어서,"가 독립항의 가장 첫 문장이다. 그 앞에 구성요소를 기재하지 마라.
- 구성요소 또는 단계가 달라질 때마다 세미콜론(;)으로 구분하고 줄바꿈한다.
- 마지막 구성요소 직전에는 "; 및"을 사용하고 줄바꿈한다.
- 마지막 구성요소 뒤에도 세미콜론(;)을 붙이고, 줄바꿈 없이 바로 종결부("를 포함하는 것을 특징으로 하는")를 이어 쓴다.
- 전제부와 특징부 사이는 "를 포함하고," 또는 "를 포함하며,"로 연결한다.

[작성 예시 — ${claimType==='method'?'방법':'장치'} 독립항]
【청구항 N】
${claimType==='method'
?`${target}에 있어서,
상기 방법은,
데이터를 수집하는 단계;
상기 수집된 데이터를 분석하는 단계; 및
상기 매칭 결과를 제공하는 단계;를 포함하는 것을 특징으로 하는 ${target}.`
:`${target}에 있어서,
프로세서; 및
메모리;를 포함하고,
상기 프로세서는,
데이터를 수집하도록 구성되는 수집부;
상기 수집된 데이터를 분석하도록 구성되는 분석부; 및
분석 결과에 기초하여 매칭을 수행하도록 구성되는 매칭부;를 포함하는 것을 특징으로 하는 ${target}.`}

⛔ "프로세서; 및 메모리를 포함하는 ${target}에 있어서," ← 이렇게 쓰면 안 된다! "~에 있어서,"가 먼저 와야 한다.
⛔ 독립항에서 "~에 있어서," 전환부를 빠뜨리면 젭슨 형식 위반이다.
⛔ 종속항은 기존 형식 유지: "제N항에 있어서, ~" (젭슨 적용 안 함)
`;
}

// ═══ KIPRIS 선행기술 검색 ═══
// Edge Function이 KIPRIS Plus API (plus.kipris.or.kr) 호출
// KIPRIS Plus API 키 (localStorage에서 사용자 설정 가능)
function getKiprisKey(){
  if(App.apiKeys?.kipris)return App.apiKeys.kipris;
  try{const p=JSON.parse(App.currentProfile?.api_key_encrypted||'{}');if(p.kipris){if(App.apiKeys)App.apiKeys.kipris=p.kipris;return p.kipris;}}catch(e){}
  return '';// Edge Function이 자체 DEFAULT_API_KEY 사용
}

// 등록번호 포맷: 1020XXXXXXX → 10-20XXXXX
function formatRegNumber(regNum){
  if(!regNum)return '';
  const cleaned=String(regNum).replace(/[^0-9]/g,'');
  if(!cleaned)return regNum;
  if(cleaned.length>=10){
    let core=cleaned;
    if(core.length===13&&core.endsWith('0000'))core=core.slice(0,-4);
    else if(core.length===13)core=core.slice(0,-4);
    if(core.startsWith('10'))return'10-'+core.substring(2);
    if(core.startsWith('20'))return'20-'+core.substring(2);
  }
  return regNum;
}

// 한국어 조사 제거 → 핵심 키워드 추출
function extractPatentKeywords(title){
  return title
    .replace(/[을를이가의에서로부터및과와은는에게으로]/g,' ')
    .replace(/\s+/g,' ').trim()
    .split(' ')
    .filter(w=>w.length>=2)
    .slice(0,4)
    .join(' ');
}

// KIPRIS 검색 (Supabase Edge Function → 공공데이터포털 API)
async function searchKiprisPlus(query,maxResults=5){
  try{
    if(!App.sb?.functions){console.warn('[KIPRIS] Supabase 미연결');return[];}
    console.log(`[KIPRIS] 🔍 특허 검색: "${query}"`);
    const {data,error}=await App.sb.functions.invoke('kipris-proxy',{
      body:{
        type:'patent_word',
        params:{word:query,numOfRows:maxResults,patent:true,utility:true},
        apiKey:getKiprisKey()
      }
    });
    if(error){console.error('[KIPRIS] Edge Function error:',error);return[];}
    if(!data||!data.success){console.warn('[KIPRIS] API 실패:',data?.error);return[];}
    console.log(`[KIPRIS] ✅ ${(data.results||[]).length}건 (총 ${data.totalCount||0}건)`);
    if(data.results?.length){console.log('[KIPRIS] 첫 결과 필드:', Object.keys(data.results[0]).join(', '));}
    return data.results||[];
  }catch(e){console.error('[KIPRIS] 검색 실패:',e);return[];}
}

// Claude AI 폴백 (KIPRIS 실패 시)
async function searchPriorArtViaClaude(title,invention){
  try{
    const invSlice=(invention||'').slice(0,2000);
    const prompt=`너는 한국 특허 데이터베이스 전문가이다. 아래 발명과 기술적으로 가장 관련성이 높은 한국 등록특허 1건을 추천하라.

[발명의 명칭] ${title}
${invSlice?`[발명 요약] ${invSlice}`:''}

[필수 규칙]
1. 실제 존재할 가능성이 높은 한국 등록특허만 제시. 불확실하면 "NONE" 출력.
2. 등록번호(10-XXXXXXX), 발명의 명칭, 출원인을 기재.
3. 기술 분야가 유사한 특허를 우선 선택.
4. 아래 JSON 형식만 출력. 설명/부연 금지.

[출력 형식]
{"regNumber":"10-XXXXXXX","title":"발명의 명칭","assignee":"출원인"}
또는
NONE`;
    const r=await App.callClaude(prompt);
    const text=(r.text||'').trim();
    if(!text||text==='NONE'||text.includes('NONE'))return[];
    const jsonMatch=text.match(/\{[^}]+\}/);
    if(!jsonMatch)return[];
    const parsed=JSON.parse(jsonMatch[0]);
    if(!parsed.regNumber||!parsed.title)return[];
    return[{
      registerNumber:parsed.regNumber.replace(/-/g,''),
      inventionTitle:parsed.title,
      applicantName:parsed.assignee||'',
      applicationNumber:'',applicationDate:'',registerDate:'',
      ipcNumber:'',openNumber:'',publicationNumber:'',astrtCont:'',
      source:'claude'
    }];
  }catch(e){console.error('Claude prior art search failed:',e);return[];}
}

async function searchPriorArt(title){
  const inv=document.getElementById('projectInput')?.value||'';
  let results=[];

  // 1차: 발명의 명칭 그대로 검색
  results=await searchKiprisPlus(title,5);

  // 2차: 키워드 추출하여 재검색
  if(!results.length){
    const kw=extractPatentKeywords(title);
    if(kw&&kw!==title)results=await searchKiprisPlus(kw,5);
  }

  // 3차: Claude AI 폴백
  if(!results.length){
    results=await searchPriorArtViaClaude(title,inv);
  }

  if(!results.length)return null;

  // 필드명 정규화 (KIPRIS API 버전에 따라 필드명이 다를 수 있음)
  results=results.map(r=>({
    ...r,
    _regNum: r.registerNumber || r.registrationNumber || r.registerNum || '',
    _title: r.inventionTitle || r.title || '',
    _appNum: r.applicationNumber || '',
    _applicant: r.applicantName || r.assignee || ''
  }));

  console.log('[KIPRIS] 정규화 결과:', results.map(r=>({reg:r._regNum, title:r._title?.slice(0,30), app:r._appNum})));

  // 등록번호 있는 건 우선 → 출원번호 있는 건 차선
  const sorted=results.sort((a,b)=>{
    const aReg=a._regNum?2:(a._appNum?1:0);
    const bReg=b._regNum?2:(b._appNum?1:0);
    return bReg-aReg;
  });
  const best=sorted[0];

  // 번호 결정: 등록번호 > 출원번호
  const hasRegNum=!!best._regNum;
  const numToUse=best._regNum||best._appNum;
  if(!numToUse&&!best._title){
    console.warn('[KIPRIS] 선별 실패: 유효한 번호/명칭 없음',best);
    return null;
  }

  const fmtNum=hasRegNum?formatRegNumber(best._regNum):formatRegNumber(best._appNum);
  const docType=hasRegNum?'한국등록특허':'한국공개특허';
  const sourceNote=best.source==='claude'?' (AI 추천 — KIPRIS 검증 필요)':'';
  const src=best.source==='claude'?'AI':'KIPRIS';
  return{
    formatted:`【특허문헌】\n(특허문헌 1) ${docType} 제${fmtNum||'미확인'}호${best._title?` (${best._title})`:''}`+sourceNote,
    patent:{
      publicationNumber:best._regNum||best._appNum,
      title:best._title,
      assignee:best._applicant,
      applicationNumber:best._appNum,
      registerDate:best.registerDate||best.registrationDate||'',
      ipcNumber:best.ipcNumber||'',
      source:best.source||'kipris'
    },
    sourceNote,
    src
  };
}

function buildPrompt(stepId){
  const inv=document.getElementById('projectInput').value,T=selectedTitle;
  const styleRef=getStyleRef();
  const prompt=_buildPromptCore(stepId,inv,T,styleRef);
  if(!prompt)return prompt;
  
  // v6.0: 기존 내용 존재 시 부분 수정 모드
  const userCmd=getStepUserCommand(stepId);
  if(userCmd&&outputs[stepId]){
    // 기존 내용 + 추가 지시 → 부분 수정 프롬프트
    return `아래 [기존 작성 내용]을 바탕으로, [수정 지시사항]에 해당하는 부분만 수정하고 나머지는 그대로 유지하여 전체 내용을 출력하라.
수정 지시와 무관한 부분은 원문 그대로 유지해야 한다. 전체 재작성 금지.

[수정 지시사항]
${userCmd}

[기존 작성 내용]
${outputs[stepId]}

[참고: 원래 작성 기준]
${prompt}`;
  }
  
  // 기존 내용 없음 → 전체 신규 작성 + 추가 지시사항
  return prompt+buildUserCommandSuffix(stepId);
}
function _buildPromptCore(stepId,inv,T,styleRef){
  switch(stepId){
    case 'step_01':return `프로젝트를 분석하여 특허 발명의 명칭 후보를 5가지 생성하라.\n형태: \"~${selectedTitleType}\"\n각 후보에 국문+영문.\n\n출력형식:\n[1] 국문: (명칭) / 영문: (명칭)\n[2] 국문: (명칭) / 영문: (명칭)\n[3] 국문: (명칭) / 영문: (명칭)\n[4] 국문: (명칭) / 영문: (명칭)\n[5] 국문: (명칭) / 영문: (명칭)\n\n[프로젝트]\n${inv}`;
    case 'step_02':return `【기술분야】를 작성. \"본 발명은 ~에 관한 것이다.\" 한 문장만. 50자 이내. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}${styleRef}`;
    case 'step_03':return `【발명의 배경이 되는 기술】을 작성. 3문단(기존문제/최근동향/필요성), 각 450자. 번호 없이. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}\n[프로젝트] ${inv}${styleRef}`;
    case 'step_04':return null; // KIPRIS API 실시간 검색으로 대체
    case 'step_05':return `【해결하고자 하는 과제】작성. \"본 발명은 ~을 제공하는 것을 목적으로 한다.\" 150자 이내. 마지막: \"본 발명의 기술적 과제는 이상에서 언급한 기술적 과제로 제한되지 않으며, 언급되지 않은 또 다른 기술적 과제들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다.\" 헤더 금지.\n\n발명의 명칭: ${T}\n[배경기술] ${outputs.step_03||''}${styleRef}`;

    // ═══ Step 6: 장치 청구항 (v4.7 완전 재작성) ═══
    case 'step_06':{
      // v4.9: Auto-select category from title type if set to 'auto'
      const effectiveCat=(deviceCategory==='auto')?autoDetectCategoryFromTitle():deviceCategory;
      const catLabel=effectiveCat;
      const anchorEnd=deviceAnchorStart+deviceAnchorDep-1;
      const themeInst=buildAnchorThemeInstruction(anchorThemeMode,selectedAnchorThemes,deviceAnchorDep);
      return `장치 청구범위를 작성하라.

[청구항 구성]
- 독립항 카테고리: ${catLabel}
- 독립항: 1개 (청구항 1)
- 일반 종속항: ${deviceGeneralDep}개${deviceGeneralDep>0?' (청구항 2~'+(deviceGeneralDep+1)+')':''}
- 등록 앵커 종속항: ${deviceAnchorDep}개${deviceAnchorDep>0?' (청구항 '+deviceAnchorStart+'~'+anchorEnd+')':''}
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

${deviceAnchorDep>0?`(R5) 등록 앵커 종속항 (청구항 ${deviceAnchorStart}부터):
- 신규성/진보성 방어용 "창의적·구체적 기술수단" 포함
- 수치·수식·기호 과다 기재 금지 (후속 단계에서 정량화)
- 아래 A~C 중 최소 2개 포함:
  A) 다단계 처리(2단계 이상): 전처리→산출→보정 등
  B) 조정 가능한 기준값/가중치/신뢰도/품질지표 사용
  C) 검증/보정/피드백/폴백/재시도 중 하나 이상의 루프 또는 조건부 분기
- 발명 내용에 근거가 있는 요소/처리/효과만으로 구성
`:''}
⛔ (R6) 장치/방법 구분 — 절대 준수
- 이것은 "장치" 청구항이다. "방법"이 아니다.
- "~하는 단계", "S100", "S200" 등 방법 표현 절대 금지
- "~부" 형태의 장치 구성요소 명칭만 사용 ("~모듈", "~유닛" 절대 금지)
- 동작은 "~하도록 구성되는", "~을 수행하는" 형태로 표현
- 발명 내용이 "방법" 형태로 기재되어 있더라도, 장치(~부) 관점으로 재구성하여 작성하라

${deviceAnchorDep>0?`[앵커 테마 배정 — 내부 지침, 출력 금지]
${themeInst}
`:''}[출력 형식]
【청구항 1】형식. 청구항만 출력. 테마/키워드/점검 내용 출력 금지.
종속항은 \"청구항 N에 있어서,\" 시작. SW명 금지. 제한성 표현 금지.
${getJepsonInstruction('device')}
★★★ 발명 내용의 모든 기술적 요소를 장치 구성요소(~부)로 변환하여 빠짐없이 반영하라. 방법/단계 표현은 장치 동작으로 재구성. ★★★

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
  ${getDeviceSubject()}(100), 사용자 단말(200), 외부 시스템(300), 데이터베이스(400), 네트워크(500)

■ L2 (L1 하위 구성): XY0 형식 — 10 단위
  ${getDeviceSubject()}(100) 하위: 통신부(110), 프로세서(120), 메모리(130), 저장부(140)
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
  ${getDeviceSubject()}(100)가 프로세서(110)를 구비 → 110은 100 박스 내부에만 존재
  110이 200 박스 안에 들어가면 오류

■ 공통 구성 표현
  ${getDeviceSubject()}와 단말 모두 프로세서 보유 시:
  - ${getDeviceSubject()} 프로세서: 프로세서(110)
  - 단말 프로세서: 프로세서(210)
  각자 자기 박스 내부에 배치 (번호 분리)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R3] 도면별 표현 레벨 ★핵심★
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 도 1: 전체 시스템 구성도 (System Overview)
  ✅ 허용: L1 장치 박스만 — 100, 200, 300, 400...
  ✅ 허용: L1 장치 박스들 간의 연결선만
  ⛔ 금지: L2/L3 하위 구성요소(110, 120, 111...) 표시 금지
  ⛔ 금지: 최외곽 박스 생성 금지 (L1만 있으므로 외곽 불필요)
  ★ 최소 L1 구성요소: 2개 이상 (1개만 있으면 도 1 불필요)

■ 도 2 이후: 세부 블록도 (Detailed Block Diagram)
  ⛔⛔ 핵심: 한 도면에는 반드시 "한 레벨"만 표시 ⛔⛔
  최외곽 박스 = 상위 장치
  내부 박스 = 그 상위 장치의 직계 자식 레벨만
  ★★ 최소 내부 구성요소: 3개 이상 (2개만으로는 도면이 빈약) ★★
  → 청구항에서 하위 구성요소가 2개뿐이라면, 기능적으로 분리하여 3~5개로 확장하라
  → 예: 프로세서(110), 메모리(120)뿐이라면 → 통신부(130), 저장부(140), 제어부(150) 등 추가
  
  ✅ 올바른 예 (도 2: ${getDeviceSubject()} 상세):
  최외곽=${getDeviceSubject()}(100), 내부=L2 4개: 통신부(110), 프로세서(120), 메모리(130), 저장부(140)
  → 4개 구성요소가 프레임 안에 2행 배치, 참조번호가 겹치지 않음
  
  ⛔ 잘못된 예 (내부 구성 2개만):
  최외곽=${getDeviceSubject()}(100), 내부=프로세서(110), 메모리(120)
  → 2개만으로 도면이 빈약하고, 참조번호 100과 120이 겹칠 위험
  
  ⛔ 잘못된 예 (L2+L3 혼합):
  최외곽=${getDeviceSubject()}(100), 내부=프로세서(110)+연산부(111)+캐시부(112)+메모리(120)
  → 110은 L2, 111/112는 L3 → 레벨 혼합 오류!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R4] 연결(연동) 및 배치 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 도 1: L1 박스 ↔ L1 박스 연결만
  ${getDeviceSubject()}(100) ↔ 사용자 단말(200) 연결선 허용
  하위 요소(110, 210) 간 연결선 금지

★★★ 도 1 연결관계 설계 규칙 (논리적 결합) ★★★
  - 단순히 모든 L1 박스를 일렬 연결하지 마라
  - 각 L1 구성요소의 역할과 기능을 분석하여 논리적 결합 관계를 결정하라
  - 예시 1 (중앙 허브형): 서버(100)가 중심이고 단말(200), DB(400)가 각각 서버에 연결 → 100↔200, 100↔400 (200↔400 직접 연결 없음)
  - 예시 2 (순차형): 클라이언트→서버→DB 순서 → 200→100→400
  - 예시 3 (메시형): 모든 구성요소가 상호 통신 → 100↔200, 100↔300, 200↔300
  - 연결의 근거: 청구항에서 어떤 구성요소가 어떤 구성요소와 데이터를 주고받는지 분석
  - 네트워크(300) 같은 매개체가 있으면 중간에 배치

■ 도 2+: 내부 구성요소 간 연결 — 반드시 포함
  ★ 모든 내부 구성요소에 최소 1개 이상 연결이 있어야 함
  ★ "허브" 구성요소(가장 많은 연결)를 반드시 식별
  예: 통신부(110) ↔ 프로세서(120) ↔ 메모리(130), 프로세서(120) ↔ 저장부(140)
  → 프로세서(120)가 허브 (3개 연결)

★★★ 배치 품질 규칙 (렌더링 겹침 방지) ★★★
  ⛔ 한 행에 3개 초과 금지 → 한 행에는 최대 3개까지 배치
  ⛔ 연결된 노드끼리 같은 행 금지 → 연결이 있으면 다른 행에 배치
  ✅ 허브는 중간 행에 배치 (위아래로 연결 대상이 분산)
  ✅ 같은 행 노드는 서로 직접 연결 없는 것만

■ 연결선 의미
  실선: 통신/데이터 링크
  양방향 화살표: 상호 데이터 교환

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[R5] 직계 부모 일치 규칙 (세대 점프 금지) ★★★핵심★★★
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 최외곽 박스 = 내부 구성요소들의 "직계 부모(Immediate Parent)"
  ⛔ 조부모(Grandparent)로 건너뛰기 금지

■ 예시 (계층 구조)
  ${getDeviceSubject()}(100)
    └─ 프로세서(110)
         └─ 정보수신부(111), 알림산출부(112), 전송부(113)

■ 올바른 표기
  도 3 내부: 정보수신부(111), 알림산출부(112), 전송부(113)
  도 3 최외곽 박스: 프로세서(110) ✅ (직계 부모)

■ 잘못된 표기
  도 3 내부: 정보수신부(111), 알림산출부(112), 전송부(113)
  도 3 최외곽 박스: ${getDeviceSubject()}(100) ❌ (세대 점프 - 조부모)

■ 직계 부모 계산법
  - L3 구성요소(111,112,113) → 직계 부모 = L2(110)
  - L2 구성요소(110,120,130) → 직계 부모 = L1(100)
  - 공식: 마지막 자리를 0으로 변환

════════════════════════════════════════════════════════════════

[파트1: 도면 설계 출력 형식]

★★★ 반드시 아래 형식을 정확히 따르라. 공간배치를 반드시 명시하라 ★★★

도 1: 전체 시스템 구성도
유형: 블록도 (최외곽 박스 없음)
구성요소: L1 장치만 나열
- ${getDeviceSubject()}(100)
- 사용자 단말(200)
- 데이터베이스(400)
연결관계 분석: (어떤 구성요소끼리 데이터를 교환하는지 청구항 기반으로 판단)
- ${getDeviceSubject()}(100)는 사용자 단말(200)과 네트워크를 통해 데이터를 교환 → 연결
- ${getDeviceSubject()}(100)는 데이터베이스(400)에 데이터를 저장/조회 → 연결
- 사용자 단말(200)은 데이터베이스(400)와 직접 통신하지 않음 → 연결 없음
연결관계: ${getDeviceSubject()}(100) ↔ 사용자 단말(200), ${getDeviceSubject()}(100) ↔ 데이터베이스(400)
공간배치:
  허브: ${getDeviceSubject()}(100) — 가장 많은 연결을 가진 중심 노드
  행1: ${getDeviceSubject()}(100)
  행2: 사용자 단말(200), 데이터베이스(400)

도 2: ${getDeviceSubject()}(100) 상세 블록도
유형: 블록도 (최외곽 = ${getDeviceSubject()}(100))
구성요소: ${getDeviceSubject()}(100) 내부 L2 구성
- 통신부(110)
- 프로세서(120)
- 메모리(130)
- 저장부(140)
연결관계: 통신부(110) ↔ 프로세서(120) ↔ 메모리(130), 프로세서(120) ↔ 저장부(140)
공간배치:
  허브: 프로세서(120)
  행1: 통신부(110)
  행2: 프로세서(120)
  행3: 메모리(130), 저장부(140)

도 3: 프로세서(120) 상세 블록도 (L3 상세화 예시)
유형: 블록도 (최외곽 = 프로세서(120), ${getDeviceSubject()}(100)가 아님!)
구성요소: 프로세서(120) 내부 L3 구성
- 연산부(121)
- 캐시부(122)
- 제어부(123)
연결관계: 연산부(121) ↔ 제어부(123), 캐시부(122) ↔ 제어부(123)
공간배치:
  허브: 제어부(123)
  행1: 연산부(121), 캐시부(122)
  행2: 제어부(123)

(도면 수에 맞게 도 4, 도 5... 추가)

★★★ 공간배치 규칙 ★★★
1. "허브" = 가장 많은 연결을 가진 노드 (반드시 1개 지정)
2. "행N" = 위에서 아래로 배치할 행 (같은 행에 2~3개까지 가능)
3. 허브는 연결 대상들 사이 행에 위치해야 함
4. 같은 행의 노드들은 서로 직접 연결이 없어야 함 (있으면 다른 행으로)
5. 연결된 노드는 인접 행에 배치 (2행 이상 떨어지지 않게)

★★★ 참조번호 순서 규칙 (도면 설계 + 상세설명 연계) ★★★
- 구성요소 나열 시 참조번호 오름차순으로 정렬하라: 110→120→130→140
- 도면 내 행 배치도 가능한 한 번호 순서를 존중하라 (작은 번호가 위쪽/왼쪽)
- 예: 행1: 통신부(110), 행2: 프로세서(120), 행3: 메모리(130), 저장부(140)
- 하위 구성요소(L3)도 오름차순: 121→122→123
- 이 순서는 상세설명(Step 8)에서 "도 N을 참조하면" 설명 순서의 기준이 된다

[파트2: 도면의 간단한 설명]
★★★ 모든 도면에 대해 빠짐없이 간단한 설명을 작성하라 ★★★
---BRIEF_DESCRIPTIONS---
${requiredFigures.map(rf=>`도 ${rf.num}은 ${rf.description}을 나타내는 도면이다.`).join('\n')}
도 1은 ${selectedTitle||'본 발명'}의 전체 구성을 나타내는 블록도이다.
도 2는 ${getDeviceSubject()}(100)의 내부 구성을 나타내는 블록도이다.
(도 3, 도 4... 모든 도면에 대해 작성)

★★★ "~모듈" 절대 금지 → "~부"로 통일 ★★★
★★★ 도 1은 L1(100,200,300,400) 장치만, 최외곽 박스 없음 ★★★
★★★ 도 2+: 최외곽 = 직계 부모 (세대 점프 금지!) ★★★

${T}\n[장치 청구범위] ${outputs.step_06||''}\n[발명 요약] ${inv.slice(0,1500)}`;}

    case 'step_08':{
      const dlCfg={
        compact:{charPerFig:'약 1,000자',total:'약 3,000~4,000자',extra:'핵심 구성요소 중심으로 간결하게 기술하라. 변형 실시예는 1개만.'},
        standard:{charPerFig:'약 1,500자',total:'약 5,000~7,000자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 설명하라. 주요 구성요소에 변형 실시예 포함.'},
        detailed:{charPerFig:'약 2,000자 이상',total:'8,000~10,000자',extra:'각 도면마다 구성요소의 기능, 동작 원리, 데이터 흐름, 상호 연동 관계를 상세히 설명하라. 변형 실시예를 통해 다양한 구현 방식을 기술하라. 절대 축약하지 마라.'},
        custom:{charPerFig:'약 '+customDetailChars+'자',total:'약 '+(customDetailChars*parseInt(document.getElementById('optDeviceFigures')?.value||4))+'자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 설명하라. 변형 실시예를 포함하라.'}
      }[detailLevel];
      const deviceFigCount=parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const lastDeviceFig=getLastFigureNumber(outputs.step_07||'')||deviceFigCount;
      const hasMethodClaims=!!outputs.step_10;
      return `아래 발명에 대한 【발명을 실시하기 위한 구체적인 내용】의 본문만 작성하라.

⛔ 이것은 "장치" 상세설명이다. 방법(~하는 단계, S100 등)은 포함하지 마라.

규칙:
- 이 항목만 작성. 기술분야, 배경기술, 과제, 효과 등 다른 항목 포함 금지.
- ${getDeviceSubject()}(100)를 주어로 사용. \"구성요소(참조번호)\" 형태 — 예: 통신부(110), 프로세서(120).
- 도면별 \"도 N을 참조하면,\" 형태로 시작.
- 특허문체(~한다). 글머리 기호/마크다운 절대 금지.
- 청구항의 모든 구성요소를 빠짐없이 포함하여 설명하라. 절대 생략 금지.
- 등록 앵커 종속항(창의적·구체적 기술수단 포함)의 다단계 처리, 기준값/가중치 동작 원리, 검증/보정 루프를 구체적으로 설명하라.
- 각 핵심 구성요소에 대해 변형 실시예를 포함하라.
- 제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.

⛔⛔⛔ 도면 범위 제한 (위반 시 전체 무효) ⛔⛔⛔
- 이 발명의 장치 도면은 도 1 ~ 도 ${lastDeviceFig}까지만 존재한다.
- 도 ${lastDeviceFig+1} 이후의 도면을 참조하거나 "도 ${lastDeviceFig+1}을 참조하면" 등의 표현을 절대 사용하지 마라.
- [장치 도면]에 기재된 도면 번호만 참조하라. 기재되지 않은 도면 번호를 임의로 생성하지 마라.
${!hasMethodClaims?`- 방법 청구항이 생성되지 않았으므로, 방법 도면(흐름도) 및 방법 설명이 존재하지 않는다.
- 방법 관련 내용(S+숫자, ~하는 단계, 흐름도 참조)을 절대 포함하지 마라.`:''}

★★★ 설명 순서 규칙 (참조번호 순서 준수) ★★★
- 도면 부호의 번호가 작은 것부터 큰 것 순서로 설명하라.
- 도 1 → 도 2 → 도 3 → ... 순서로 진행하라.
- 각 도면 내에서도 참조번호 오름차순으로 설명하라: 예) 110→120→130→140 순서.
- 같은 L2 구성요소 내의 L3 하위 요소도 오름차순: 예) 121→122→123 순서.

⛔⛔⛔ 방법 표현 절대 금지 (위반 시 전체 무효) ⛔⛔⛔
- \"~하는 단계\", \"~하는 단계이다\" 표현 절대 금지
- \"S100\", \"S200\", \"S401\", \"S810\" 등 S+숫자 형태의 단계번호 절대 금지
- \"단계(S숫자)\" 형태 절대 금지
- 방법/흐름도/순서도/프로세스 설명 포함 금지
- 발명 내용에 방법 관련 기재가 있더라도, 이 상세설명에서는 장치 구성요소(~부)의 기능과 동작만 서술하라
- 방법 상세설명은 Step 12에서 별도 작성됨 — 여기서 선취하지 마라

⛔ 출력 금지 항목:
- [청구범위], [작성 요청], [청구항 구성] 등 메타 섹션을 출력에 포함하지 마라
- 청구항 원문을 그대로 출력하지 마라 — 상세설명 본문만 작성하라
- 발명 내용 원문을 에코하지 마라

★ 분량 규칙:
- 도면 1개당 ${dlCfg.charPerFig}(공백 포함)
- 총 분량 ${dlCfg.total}(공백 포함). 본문 전후 정형문 글자수 제외.
- ${dlCfg.extra}

${deviceAnchorDep>0?`★★ 앵커 종속항 뒷받침 규칙 (등록 핵심 — 42조 4항) ★★
- 앵커 종속항(청구항 ${deviceAnchorStart}~${deviceAnchorStart+deviceAnchorDep-1})은 진보성 방어의 핵심이므로, 일반 종속항보다 2배 이상 상세하게 기술하라.
- 각 앵커 종속항의 기술적 구성에 대해:
  (1) 동작 원리를 단계별(입력→처리→출력)로 설명하라
  (2) "이러한 구성에 의하면, ~한 기술적 효과를 얻을 수 있다" 문장을 반드시 포함하라
  (3) 기준값/임계값/가중치가 있으면, 그 값의 기술적 의의와 조정 시 영향을 설명하라
  (4) 다단계 처리가 있으면, 각 단계의 입력·처리·출력을 명시하라
  (5) 조건 분기가 있으면, 각 분기의 판단 기준과 분기 후 처리를 설명하라
`:''}★ 변형 실시예 규칙:
- 독립항의 상위 개념 용어마다: "한편, 다른 실시예에서 상기 [용어]는 [구체적 대안]일 수 있다" 형태로 기술
- 앵커 종속항의 핵심 처리에 대해 1개 이상의 대안적 구현을 기술
- 변형 실시예는 독립항의 보호범위를 뒷받침하는 방향이어야 한다

★★★ 발명 내용의 모든 기술적 요소를 장치 구성요소(~부)의 동작으로 변환하여 빠짐없이 반영하라. 방법/단계 표현은 제외. ★★★

${T}\n[장치 청구범위] ${outputs.step_06||''}\n[장치 도면] ${outputs.step_07||''}${(outputs.step_15&&(outputTimestamps.step_15||0)>(outputTimestamps.step_08||0))?'\\n\\n[특허성 검토 결과 — 아래 지적사항을 상세설명에 반영하여 보완하라]\\n'+outputs.step_15.slice(0,2000):''}${getFullInvention({stripMeta:true})}${styleRef}`;}

    case 'step_09':return `상세설명의 핵심 알고리즘에 수학식 5개 내외.\n규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.\n★ 수치 예시는 \"예를 들어,\", \"일 예로,\", \"구체적 예시로,\" 등 자연스러운 표현 사용 (\"예시 대입:\" 금지)\n출력:\n---MATH_BLOCK_1---\nANCHOR: (삽입위치 문장 20자 이상)\nFORMULA:\n【수학식 1】\n(수식)\n여기서, (파라미터)\n예를 들어, (수치 대입 설명)\n\n${T}\n[현재 상세설명] ${outputs.step_08||''}${(outputs.step_15&&(outputTimestamps.step_15||0)>(outputTimestamps.step_09||0))?'\\n\\n[특허성 검토 결과 — 수학식으로 보완 가능한 지적사항을 반영하라]\\n'+outputs.step_15.slice(0,1500):''}`;

    // ═══ Step 10: 방법 청구항 (장치와 완전 분리) ═══
    case 'step_10':{
      const s=getLastClaimNumber(outputs.step_06||'')+1;
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

★★ 장치 청구항과의 차별화 규칙 ★★
- 장치 청구항의 "~부"를 단순히 "~하는 단계"로 치환하지 마라.
- 방법 청구항은 시간적 순서와 조건 분기를 명시하라: "~한 후", "~하는 경우", "~에 응답하여"
- 장치에 없는 전처리/후처리/판단 단계를 추가하여 방법만의 기술적 특징을 확보하라.
- 방법 독립항은 장치 독립항과 다른 관점(프로세스 관점)에서 발명을 기술하라.

[청구항 구성]
- 독립항 카테고리: ${catLabel}
- 독립항: 1개 (【청구항 ${s}】)
- 일반 종속항: ${methodGeneralDep}개${methodGeneralDep>0?' (청구항 '+(s+1)+'~'+(s+methodGeneralDep)+')':''}
- 등록 앵커 종속항: ${methodAnchorDep}개${methodAnchorDep>0?' (청구항 '+mAnchorStart+'~'+(mAnchorStart+methodAnchorDep-1)+')':''}
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

[필수 작성 규칙] R1~R4 장치 청구항과 동일하게 적용.
${methodAnchorDep>0?`앵커 종속항은 (R5) 규칙 동일 적용: A~C 중 최소 2개 포함.

[앵커 테마 배정 — 내부 지침, 출력 금지]
${themeInst}
`:''}[출력 형식] 【청구항 ${s}】부터. 청구항만 출력. 제한성 표현 금지.
${getJepsonInstruction('method')}
★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}\n[장치 청구항 — 참고용] ${outputs.step_06||''}\n[장치 상세설명 — 참고용] ${(outputs.step_08||'').slice(0,3000)}${getFullInvention()}${styleRef}`;}

    // ═══ Step 11: 방법 도면 (S+숫자 단계번호 체계) ═══
    case 'step_11':{
      const f=document.getElementById('optMethodFigures').value;
      const lf=getLastFigureNumber(outputs.step_07||'');
      return `【방법 청구범위】에 대한 흐름도를 설계하라. 총 ${f}개, 도 ${lf+1}부터.

⛔⛔⛔ 절대 금지 사항 (위반 시 도면 전체 무효) ⛔⛔⛔
- 장치 구성요소(통신부, 프로세서, ~부 등) 포함 금지
- 숫자만 있는 참조번호(100, 110, 200 등) 사용 금지
- 이 도면은 오직 "방법의 단계"만 표현한다

★★★ 흐름도 필수 규칙 ★★★
① 최외곽 박스 없음 — 흐름도는 장치가 아니므로 감싸는 프레임 박스 불필요
② 단방향 화살표(→)만 사용 — 순서의 흐름을 나타내므로 양방향(↔) 금지
③ "시작"과 "종료" 노드 필수 포함 — 첫 단계 전에 "시작", 마지막 단계 후에 "종료"
④ 조건 분기가 있으면 다이아몬드(마름모) 노드 사용

★★★ 조건 분기(Decision) 규칙 — 핵심 ★★★
⑤ 방법 청구항에서 논리적 판단을 요구하는 단계를 식별하라:
  - 임계값 비교 (예: "스코어가 임계값 이상인 경우")
  - 조건 충족 판단 (예: "유효성 검증 결과가 적합한 경우")
  - 분류/분기 (예: "카테고리가 A인 경우와 B인 경우")
⑥ 조건 분기 단계는 마름모(다이아몬드) 형태로 표시
  - 노드 형식: D{조건 질문?} (예: D{"타겟팅 스코어가 임계값 이상인가?"})
  - "예(Y)" 방향과 "아니오(N)" 방향으로 분기
  - 각 분기 후 적절한 후속 단계로 연결
⑦ 분기 논리 검증 단계:
  - 각 분기가 논리적으로 타당한지 자체 검증하라
  - "예" 경로와 "아니오" 경로가 모두 최종적으로 종료 노드에 도달하는지 확인
  - 무한 루프가 발생하지 않는지 확인
  - 분기 조건이 방법 청구항의 기재와 일치하는지 확인

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
- [판단] (조건 질문?)(S${lf+1}03) → 예: (다음 단계), 아니오: (대안 단계)
- ...
- 종료
흐름: 시작 → S${lf+1}01 → S${lf+1}02 → S${lf+1}03{판단} →(예) S${lf+1}04, (아니오) S${lf+1}05 → ... → 종료 (단방향)
---

[분기 논리 검증]
각 분기에 대해 다음을 확인하고 출력:
- 분기 조건: (조건 설명)
- "예" 경로: (어떤 단계로 진행)
- "아니오" 경로: (어떤 단계로 진행)
- 논리적 타당성: (방법 청구항과 일치하는지, 무한 루프 없는지 확인)

[파트2: 도면의 간단한 설명]
★★★ 모든 방법 도면에 대해 빠짐없이 간단한 설명을 작성하라 ★★★
---BRIEF_DESCRIPTIONS---
도 ${lf+1}은 ${selectedTitle||'본 발명'}의 (방법 이름)을 나타내는 순서도이다.
(방법 도면이 여러 개이면 모두 작성)

★★★ 방법 청구항의 모든 단계를 빠짐없이 흐름도에 반영하라 ★★★
★★★ 최외곽 프레임 박스 절대 금지 — 흐름도는 프레임 없이 단계만 나열 ★★★
★★★ 장치 구성요소(100, 110 등)는 절대 포함 금지 — S로 시작하는 단계번호만 사용 ★★★

${T}\n[방법 청구범위] ${outputs.step_10||''}\n[발명 요약] ${inv.slice(0,1500)}`;}

    case 'step_12':{
      // ═══ B1 fix: 분량 제어 추가 (v5.5) ═══
      const dl=detailLevel;
      const methodDetailGuide=dl==='compact'?'약 800자(공백 포함) 이내로 핵심만 간결하게':dl==='standard'?'약 1,200자(공백 포함) 내외로 균형 있게':dl==='detailed'?'약 2,000자(공백 포함) 이상으로 상세하게':dl==='custom'?`약 ${Math.round((customDetailChars||1200)*0.7)}자(공백 포함) 내외로`:'약 1,200자(공백 포함) 내외로';
      // ═══ B3 fix: step_15 순환참조 — 타임스탬프 비교 (v5.5 BUG-4 수정) ═══
      const step15Ref=(outputs.step_15&&(outputTimestamps.step_15||0)>(outputTimestamps.step_12||0))?`\n\n[특허성 검토 결과 — 아래 지적사항을 방법 상세설명에 반영하여 보완하라]\n${outputs.step_15.slice(0,2000)}`:'';
      return `방법 상세설명. 단계순서에 따라 장치 동작을 참조하여 설명하라. 특허문체. 글머리 금지. 시작: "이하에서는 앞서 설명한 ${getDeviceSubject()}의 구성 및 동작을 참조하여 ${getDeviceSubject()}에 의해 수행되는 방법을 설명한다." 생략 금지. 제한성 표현 금지.

★ 분량 지침: ${methodDetailGuide} 작성하라.
★ 방법의 수행 주체: "${getDeviceSubject()}"로 일관되게 서술하라.

${methodAnchorDep>0?`★★ 방법 앵커 종속항 뒷받침 규칙 (등록 핵심) ★★
- 방법 앵커 종속항의 각 기술적 구성(다단계 처리, 조건 분기, 기준값 등)을:
  (1) 단계별 처리 흐름으로 설명하라
  (2) "이러한 단계에 의하면, ~한 기술적 효과를 얻을 수 있다" 문장을 반드시 포함하라
  (3) 조건 분기의 판단 기준과 각 분기의 후속 처리를 명시하라
- 일반 종속항보다 앵커 종속항 설명을 2배 이상 상세하게 기술하라
`:''}
★★★ 발명 내용을 단 하나도 누락 없이 모두 반영하라. ★★★

${T}\n[방법 청구항] ${outputs.step_10||''}\n[방법 도면] ${outputs.step_11||''}\n[장치 상세설명] ${(outputs.step_08||'').slice(0,3000)}${step15Ref}${getFullInvention({stripMeta:true})}${styleRef}`;}
    case 'step_13':{
      return `아래 청구범위와 상세설명을 전문적으로 검토하라.

═══ 검토 항목 및 기준 ═══

[1] 청구항 뒷받침 검토 (특허법 제42조 제4항 제1호)
- 각 독립항의 모든 구성요소가 상세설명에서 충분히 설명되어 있는지 확인
- 종속항의 추가 한정 사항이 상세설명에 뒷받침되는지 확인
- 미흡한 경우: 보완이 필요한 구체적 문장을 제시하라

[2] 기술적 비약 검토
- 상세설명에서 청구항의 기술적 효과로 직접 연결되지 않는 논리적 비약이 있는지 확인
- "~할 수 있다"로 끝나는 모호한 효과 서술이 없는지 확인
- 미흡한 경우: 구체적 보완 문장을 제시하라

[3] 수학식 정합성 검토
- 수학식의 변수가 상세설명에서 모두 정의되어 있는지 확인
- 수학식이 청구항의 기술적 구성과 대응되는지 확인
- 수학식이 없는 경우 이 항목은 "해당 없음"으로 표기

[4] 반복실시 가능성 (특허법 제42조 제3항 제1호)
- 당업자가 상세설명만으로 발명을 실시할 수 있을 만큼 구체적인지 확인
- 핵심 알고리즘/처리 로직의 단계별 설명이 충분한지 확인
- 입력/출력 데이터의 구조와 형식이 명확한지 확인

[5] 보완/수정 제안
- 위 1~4에서 발견된 문제에 대한 구체적 수정 문장을 제시하라
- 형식: [위치] 현재 문장 → 수정 문장

${(deviceAnchorDep>0||methodAnchorDep>0)?`[6] 앵커 종속항 뒷받침 집중 검토 (등록 핵심)
${deviceAnchorDep>0?`- 장치 앵커 종속항(청구항 ${deviceAnchorStart}~)의 각 기술적 구성이 상세설명에서:
  ① 동작 원리가 단계별(입력→처리→출력)로 설명되어 있는가?
  ② "이러한 구성에 의하면, ~" 형태의 기술적 효과가 명시되어 있는가?
  ③ 기준값/임계값/가중치의 의의가 설명되어 있는가?
  ④ 변형 실시예가 최소 1개 존재하는가?
- 미흡한 앵커가 있으면 해당 청구항 번호와 함께 구체적 보완 문장을 제시하라`:''}
${(includeMethodClaims&&methodAnchorDep>0)?`\n- 방법 앵커 종속항도 동일 기준으로 검토하라. 장치 앵커와 대응되는 방법 앵커의 뒷받침이 방법 상세설명에 충분한지 확인하라.`:''}
`:''}

[7] 발명 내용 반영 완전성
- 원본 발명 내용의 핵심 기술 요소가 청구항과 상세설명에 모두 포함되어 있는지 확인
- 누락된 기술 요소가 있으면 구체적으로 지적하라

═══ 출력 형식 ═══
각 항목별로:
✅ 적합 또는 ⚠️ 보완 필요
- (구체적 지적사항 및 수정 제안)

마지막에 전체 요약 (보완 우선순위 포함)

${T}\n[청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}\n[상세설명] ${(getLatestDescription()||'').slice(0,6000)}${outputs.step_12?'\n[방법 상세설명] '+outputs.step_12.slice(0,3000):''}\n[원본 발명 내용] ${inv.slice(0,3000)}`;}

    case 'step_14':return `대안 청구항을 작성하라. 원본 청구항의 핵심 기술적 구성은 그대로 유지하되, 표현을 달리하라.

★ 작성 규칙:
- 독립항은 반드시 젭슨(Jepson) 형식 유지: "~에 있어서," 전환부 + "~을 특징으로 하는" 종결부
- 표현 변경의 목적: 심사관의 거절 시 대응용 대안 확보
- 구성요소 명칭, 동작 서술 방식, 문장 구조를 변경하되 기술적 의미는 동일하게 유지
- 상세설명과 발명 내용을 참고하여, 표현 변경 시 기술적 정확성을 확보하라
- 【청구항 N】 형식

\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}\n[상세설명 — 참고용] ${(getLatestDescription()||'').slice(0,2000)}${getFullInvention()}${styleRef}`;
    case 'step_15':return `특허성 검토: 아래 청구범위와 상세설명에 대해 다음 항목을 검토하라.

(1) 신규성: 청구항의 구성요소 조합이 선행기술과 구별되는지
(2) 진보성: 기술적 특징이 당업자에게 자명하지 않은 수준인지, 특히 앵커 종속항의 창의성
(3) 명확성: 청구항 표현이 명확하고 뒷받침되는지
(4) 산업상 이용가능성: 실제 구현 가능한 기술인지
(5) 보호범위 최적화: 독립항이 과도하게 좁거나 넓지 않은지, 개선 제안

각 항목별로 평가 결과와 개선 제안을 작성하라.

${T}\n[전체 청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}\n[상세설명 요약] ${(getLatestDescription()||'').slice(0,3000)}\n[발명 내용] ${inv.slice(0,2000)}`;
    case 'step_16':return `발명의 효과. \"본 발명에 따르면,\"시작. 150자 이내. 마지막: \"본 발명의 효과는 이상에서 언급한 효과로 제한되지 않으며, 언급되지 않은 또 다른 효과들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다.\"\n${T}\n[독립항] ${(outputs.step_06||'').match(/【청구항 1】[\s\S]*?(?=【청구항 2】|$)/)?.[0]||''}\n[과제] ${outputs.step_05||''}\n[상세설명] ${(outputs.step_08||'').slice(0,2000)}${styleRef}`;
    case 'step_17':return `과제의 해결 수단. 각 독립항 카테고리별로 요약하라.
형식:
"본 발명의 일 실시예에 따른 ${getDeviceSubject()}는, ..." (장치 독립항 요약)
${includeMethodClaims?'"본 발명의 일 실시예에 따른 방법은, ..." (방법 독립항 요약)':''}
${outputs.step_20?'"본 발명의 일 실시예에 따른 컴퓨터 판독 가능 기록매체는, ..." (기록매체 독립항 요약)\n"본 발명의 일 실시예에 따른 컴퓨터 프로그램은, ..." (프로그램 독립항 요약)':''}
마지막: "본 발명의 기타 구체적인 사항들은 상세한 설명 및 도면들에 포함되어 있다."
\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}${outputs.step_20?'\n[기록매체/프로그램] '+outputs.step_20:''}${styleRef}`;
    case 'step_18':{
      const hasMethod=includeMethodClaims&&outputs.step_11;
      return `【부호의 설명】을 작성하라.

형식: "구성요소 : 참조번호" (콜론 사용)
정렬: 참조번호 오름차순

[장치 구성요소 — 숫자만 사용]
- 형식: 100, 110, 111, 200, 210...
- 계층적 체계: L1(X00) → L2(XY0) → L3(XYZ)
- 예시:
  ${getDeviceSubject()} : 100
  통신부 : 110
  수신부 : 111
  송신부 : 112
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
    case 'step_19':return `요약서. 청구항1 기준 450자. \"본 발명은\"시작.\n출력:\n【요약】\n(본문)\n\n【대표도】\n도 1\n\n위 형식만.\n${T}\n[청구항1] ${(outputs.step_06||'').slice(0,1500)}${styleRef}`;

    // ═══ Step 20: 기록매체 / 컴퓨터 프로그램 독립항 (v5.5 신규) ═══
    case 'step_20':{
      const lastNum=getLastClaimNumber([outputs.step_06||'',outputs.step_10||''].join('\n'));
      const mediaStart=lastNum+1;
      const progStart=lastNum+2;
      return `아래 방법 청구항을 기반으로 기록매체 독립항 1개와 컴퓨터 프로그램 독립항 1개를 작성하라.

═══ 작성 규칙 ═══

[1] 컴퓨터 판독 가능 기록매체 독립항 (【청구항 ${mediaStart}】)
- 형식: "프로세서에 의해 실행되면, ~방법을 수행하는 프로그램이 기록된 컴퓨터 판독 가능 기록매체."
- 방법 독립항의 모든 단계를 빠짐없이 포함
- "~하는 단계;" 형태로 단계를 나열
- 마지막: "을 수행하는 프로그램이 기록된 컴퓨터 판독 가능 기록매체."

[2] 컴퓨터 프로그램 독립항 (【청구항 ${progStart}】)
- 형식: "하드웨어인 컴퓨터와 결합되어, ~방법을 수행시키기 위해 컴퓨터 판독 가능 기록매체에 저장된 컴퓨터 프로그램."
- 방법 독립항의 모든 단계를 빠짐없이 포함
- 마지막: "을 수행시키기 위해 컴퓨터 판독 가능 기록매체에 저장된 컴퓨터 프로그램."

═══ 핵심 주의사항 ═══
- 방법 독립항의 단계를 그대로 인용하되, "프로세서가" 또는 "컴퓨터가" 수행하는 형태로 서술
- 장치 구성요소(~부, 참조번호)는 포함하지 마라 — 방법의 단계만 기술
- 젭슨(Jepson) 형식 불필요 — 기록매체/프로그램은 전체가 신규 구성이므로
- 【청구항 N】 형식 준수, 번호는 ${mediaStart}부터

${T}\n[방법 청구항] ${outputs.step_10||''}\n[장치 독립항 — 참고용] ${(outputs.step_06||'').slice(0,2000)}`;}

    default:return '';
  }
}

// ═══════════ STEP EXECUTION ═══════════
let globalProcessing = false;
function setGlobalProcessing(on){
  globalProcessing=on;
  // Disable/enable ALL generation buttons when any task is running
  const allBtns=['btnStep01','btnBatch25','btnStep06','btnStep10','btnStep14','btnStep15','btnStep07','btnStep08','btnStep09','btnStep11','btnStep12','btnStep13','btnStep20','btnApplyReview','btnBatchFinish','btnProvisionalGen','btnInsertBoilerplate'];
  allBtns.forEach(bid=>{const b=document.getElementById(bid);if(b){if(on){b.dataset.prevDisabled=b.disabled;b.disabled=true;b.style.opacity='0.5';}else{b.disabled=b.dataset.prevDisabled==='true';b.style.opacity='';delete b.dataset.prevDisabled;}}});
  // Also disable validation button and tab switches during processing
  document.querySelectorAll('.tab-item').forEach(t=>{if(on){t.style.pointerEvents='none';t.style.opacity='0.7';}else{t.style.pointerEvents='';t.style.opacity='';}});
}
function checkDependency(s){const inv=document.getElementById('projectInput').value.trim();const d={step_01:()=>inv?null:'발명 내용을 먼저 입력',step_06:()=>selectedTitle?null:'명칭을 먼저 확정',step_07:()=>outputs.step_06?null:'장치 청구항 먼저',step_08:()=>(outputs.step_06&&outputs.step_07)?null:'도면 설계 먼저',step_09:()=>outputs.step_08?null:'상세설명 먼저',step_10:()=>outputs.step_06?null:'장치 청구항 먼저',step_11:()=>outputs.step_10?null:'방법 청구항 먼저',step_12:()=>(outputs.step_10&&outputs.step_11)?null:'방법 도면 먼저',step_13:()=>(outputs.step_06&&outputs.step_08)?null:'청구항+상세설명 먼저',step_14:()=>outputs.step_06?null:'장치 청구항 먼저',step_15:()=>outputs.step_06?null:'장치 청구항 먼저',step_20:()=>outputs.step_10?null:'방법 청구항 먼저'};return d[s]?d[s]():null;}
async function runStep(sid){if(globalProcessing)return;const dep=checkDependency(sid);if(dep){App.showToast(dep,'error');return;}const bm={step_01:'btnStep01',step_06:'btnStep06',step_10:'btnStep10',step_13:'btnStep13',step_14:'btnStep14',step_15:'btnStep15',step_20:'btnStep20'},bid=bm[sid];setGlobalProcessing(true);loadingState[sid]=true;if(bid)App.setButtonLoading(bid,true);
  try{
    // v6.0: 부분 수정 모드 표시
    const _hasCmd=!!getStepUserCommand(sid);
    const _hasOut=!!outputs[sid];
    if(_hasCmd&&_hasOut)App.showToast('📝 기존 내용 부분 수정 모드','info');
    
    // Step 04: KIPRIS API 실시간 검색
    if(sid==='step_04'){
      const sr=await searchPriorArt(selectedTitle);
      if(sr){outputs.step_04=sr.formatted;renderOutput('step_04',sr.formatted);}
      else{outputs.step_04='【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';renderOutput('step_04',outputs.step_04);}
      markOutputTimestamp('step_04');
      saveProject(true);App.showToast('선행기술문헌 검색 완료');
      return;
    }
    // Step 13: use continuation for long review
    let r;
    if(sid==='step_13'){
      App.showProgress('progressStep13','AI 검토 생성 중...',0,1);
      const text=await App.callClaudeWithContinuation(buildPrompt(sid),'progressStep13');
      r={text};outputs[sid]=text;markOutputTimestamp(sid);
    } else {
      r=await App.callClaude(buildPrompt(sid));outputs[sid]=r.text;markOutputTimestamp(sid);
    }
    renderOutput(sid,r.text||outputs[sid]);
    // ★ A4 fix: 후속 스텝 무효화 경고 (v5.5) ★
    // step_06/step_10은 교정 완료 후 자체 호출하므로 여기서 제외
    if(sid !== 'step_06' && sid !== 'step_10') invalidateDownstream(sid);
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
      outputs[sid]=corrected;markOutputTimestamp(sid);invalidateDownstream(sid);renderOutput(sid,corrected);
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
      outputs[sid]=corrected;markOutputTimestamp(sid);invalidateDownstream(sid);renderOutput(sid,corrected);
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
async function runLongStep(sid){if(globalProcessing)return;const dep=checkDependency(sid);if(dep){App.showToast(dep,'error');return;}const bid=sid==='step_08'?'btnStep08':'btnStep12',pid=sid==='step_08'?'progressStep08':'progressStep12';setGlobalProcessing(true);loadingState[sid]=true;App.setButtonLoading(bid,true);
  // v6.0: 부분 수정 모드 표시
  const _hasCmd=!!getStepUserCommand(sid),_hasOut=!!outputs[sid];
  const _modeLabel=(_hasCmd&&_hasOut)?'부분 수정':'생성';
  App.showProgress(pid,`${STEP_NAMES[sid]} ${_modeLabel} 중...`,0,1);
  try{const t=await App.callClaudeWithContinuation(buildPrompt(sid),pid);outputs[sid]=t;markOutputTimestamp(sid);invalidateDownstream(sid);renderOutput(sid,t);saveProject(true);App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);}catch(e){App.showToast(e.message,'error');}finally{loadingState[sid]=false;App.setButtonLoading(bid,false);App.clearProgress(pid);setGlobalProcessing(false);}}
async function runMathInsertion(){if(globalProcessing)return;const dep=checkDependency('step_09');if(dep){App.showToast(dep,'error');return;}setGlobalProcessing(true);loadingState.step_09=true;App.setButtonLoading('btnStep09',true);try{const r=await App.callClaude(buildPrompt('step_09'));const baseDesc=outputs.step_08||'';outputs.step_09=insertMathBlocks(baseDesc,r.text);markOutputTimestamp('step_09');renderOutput('step_09',outputs.step_09);saveProject(true);App.showToast('수학식 삽입 완료');}catch(e){App.showToast(e.message,'error');}finally{loadingState.step_09=false;App.setButtonLoading('btnStep09',false);setGlobalProcessing(false);}}

async function applyReview(){
  if(globalProcessing)return;if(!outputs.step_13){App.showToast('검토 결과 없음','error');return;}
  const cur=getLatestDescription();if(!cur){App.showToast('상세설명 없음','error');return;}
  const hasMethodDesc=!!(outputs.step_12&&includeMethodClaims);
  const totalSteps=hasMethodDesc?4:3;
  beforeReviewText=cur;setGlobalProcessing(true);loadingState.applyReview=true;App.setButtonLoading('btnApplyReview',true);
  try{
    // ═══ [1] 장치 상세설명 보완 (원문 유지 + 지적사항만 보완) ═══
    App.showProgress('progressApplyReview',`[1/${totalSteps}] 장치 상세설명 보완 중...`,1,totalSteps);
    const improvedDesc=await App.callClaudeWithContinuation(`[검토 결과]의 지적사항을 반영하여 아래 [현재 상세설명]을 보완하라.

★★★ 최우선 원칙: 원문 최대 유지 ★★★
- 검토에서 지적된 부분만 수정·보완하라. 지적 없는 부분은 원문을 그대로 유지하라.
- 기존 구성요소 설명의 문체·분량·표현·순서를 임의로 변경하지 마라.
- 새로운 문장을 추가할 때는 기존 문맥에 자연스럽게 삽입하라.

★★ 앵커 종속항 보완 집중 ★★
- 검토 항목 [6]의 앵커 관련 지적사항은 반드시 보완하라.
- 앵커 종속항의 기술적 구성에 대해:
  (1) 동작 원리를 단계별(입력→처리→출력)로 보완
  (2) "이러한 구성에 의하면, ~한 기술적 효과를 얻을 수 있다" 문장 추가
  (3) 기준값/임계값의 의의 설명 추가

규칙:
- 이 항목만 작성. 다른 항목 포함 금지.
- ${getDeviceSubject()}(100)를 주어. "구성요소(참조번호)" 형태.
- 도면별 "도 N을 참조하면," 형태 유지.
- 특허문체(~한다). 글머리 금지. 생략 금지.
- 제한성 표현 금지.
- 수학식은 포함하지 마라 (별도 삽입 예정).
- ⛔ "~하는 단계", "S100", "S401" 등 방법 표현/단계번호 절대 금지. 장치 구성요소(~부)의 동작만 서술.

[발명의 명칭] ${selectedTitle}
[검토 결과] ${outputs.step_13}
[청구범위] ${outputs.step_06||''}
[도면] ${outputs.step_07||''}
[현재 상세설명] ${stripMathBlocks(cur)}${getFullInvention({stripMeta:true})}${getStyleRef()}${buildUserCommandSuffix('step_08')}`,'progressApplyReview');
    outputs.step_08=improvedDesc;markOutputTimestamp('step_08');

    // ═══ [2] 수학식 재삽입 ═══
    App.showProgress('progressApplyReview',`[2/${totalSteps}] 수학식 삽입 중...`,2,totalSteps);
    const mathR=await App.callClaude(`상세설명의 핵심 알고리즘에 수학식 5개 내외.\n규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.\n★ 수치 예시는 \"예를 들어,\", \"일 예로,\", \"구체적 예시로,\" 등 자연스러운 표현 사용 (\"예시 대입:\" 금지)\n출력:\n---MATH_BLOCK_1---\nANCHOR: (삽입위치 문장 20자 이상)\nFORMULA:\n【수학식 1】\n(수식)\n여기서, (파라미터)\n예를 들어, (수치 대입 설명)\n\n${selectedTitle}\n[현재 상세설명] ${improvedDesc}`);
    const finalDesc=insertMathBlocks(improvedDesc,mathR.text);
    outputs.step_09=finalDesc; // BUG-B fix: step_09도 갱신하여 저장/리로드 시 UI 일관성 유지
    outputs.step_13_applied=finalDesc;
    markOutputTimestamp('step_09');markOutputTimestamp('step_13_applied');
    renderOutput('step_08',improvedDesc);renderOutput('step_09',finalDesc);

    // ═══ [3] 방법 상세설명 보완 (있는 경우만) ═══
    if(hasMethodDesc){
      App.showProgress('progressApplyReview',`[3/${totalSteps}] 방법 상세설명 보완 중...`,3,totalSteps);
      const improvedMethod=await App.callClaudeWithContinuation(`[검토 결과]의 방법 관련 지적사항을 반영하여 아래 [현재 방법 상세설명]을 보완하라.

★★★ 최우선 원칙: 원문 최대 유지 ★★★
- 검토에서 지적된 부분만 수정·보완하라. 지적 없는 부분은 원문을 그대로 유지하라.

★★ 방법 앵커 종속항 보완 집중 ★★
- 앵커 종속항의 기술적 구성에 대해 동작 원리와 기술적 효과를 보완하라.

규칙:
- 방법 상세설명만 작성. 장치 상세설명 포함 금지.
- 특허문체(~한다). 글머리 금지. 생략 금지. 제한성 표현 금지.
- 수행 주체: "${getDeviceSubject()}"로 일관되게 서술.

[발명의 명칭] ${selectedTitle}
[검토 결과] ${outputs.step_13}
[방법 청구항] ${outputs.step_10||''}
[현재 방법 상세설명] ${outputs.step_12}${getStyleRef()}${buildUserCommandSuffix('step_12')}`,'progressApplyReview');
      outputs.step_12=improvedMethod;markOutputTimestamp('step_12');
      renderOutput('step_12',improvedMethod);
    }

    // ═══ 완료 ═══
    App.showProgress('progressApplyReview',`[${totalSteps}/${totalSteps}] 완료`,totalSteps,totalSteps);
    const resultArea=document.getElementById('reviewApplyResult');
    if(resultArea){resultArea.style.display='block';showReviewDiff('after');}
    setTimeout(()=>App.clearProgress('progressApplyReview'),2000);
    saveProject(true);
    App.showToast(`검토 반영 완료${hasMethodDesc?' (장치+방법)':''}`);
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
    
    outputs[sid]=designText;markOutputTimestamp(sid);invalidateDownstream(sid);
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
async function runBatch25(){
  if(globalProcessing)return;
  if(!selectedTitle){App.showToast('명칭 먼저 확정','error');return;}
  setGlobalProcessing(true);loadingState.batch25=true;App.setButtonLoading('btnBatch25',true);
  document.getElementById('resultsBatch25').innerHTML='';
  
  try{
    // ═══ API 효율화: step_02/03/04 병렬 실행 (v5.5) ═══
    App.showProgress('progressBatch','기본 항목 병렬 생성 중 (1/2)',1,2);
    
    const [r02,r03,r04]=await Promise.all([
      App.callClaude(buildPrompt('step_02')),
      App.callClaude(buildPrompt('step_03')),
      searchPriorArt(selectedTitle)
    ]);
    
    outputs.step_02=r02.text;markOutputTimestamp('step_02');
    renderBatchResult('resultsBatch25','step_02',r02.text);
    
    outputs.step_03=r03.text;markOutputTimestamp('step_03');
    renderBatchResult('resultsBatch25','step_03',r03.text);
    
    if(r04){outputs.step_04=r04.formatted;renderBatchResult('resultsBatch25','step_04',r04.formatted);}
    else{outputs.step_04='【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';renderBatchResult('resultsBatch25','step_04',outputs.step_04);}
    markOutputTimestamp('step_04');
    
    // step_05는 step_03에 의존하므로 순차 실행
    App.showProgress('progressBatch','해결하고자 하는 과제 (2/2)',2,2);
    const r05=await App.callClaude(buildPrompt('step_05'));
    outputs.step_05=r05.text;markOutputTimestamp('step_05');
    renderBatchResult('resultsBatch25','step_05',r05.text);
    
    App.clearProgress('progressBatch');
    saveProject(true);App.showToast('기본 항목 완료 (병렬 처리)');
  }catch(e){App.clearProgress('progressBatch');App.showToast(e.message,'error');}
  finally{loadingState.batch25=false;App.setButtonLoading('btnBatch25',false);setGlobalProcessing(false);}
}
async function runBatchFinish(){if(globalProcessing)return;if(!outputs.step_06||!outputs.step_08){App.showToast('청구항+상세설명 먼저','error');return;}setGlobalProcessing(true);loadingState.batchFinish=true;App.setButtonLoading('btnBatchFinish',true);document.getElementById('resultsBatchFinish').innerHTML='';const steps=['step_16','step_17','step_18','step_19'];try{for(let i=0;i<steps.length;i++){App.showProgress('progressBatchFinish',`${STEP_NAMES[steps[i]]} (${i+1}/4)`,i+1,4);const r=await App.callClaude(buildPrompt(steps[i]));outputs[steps[i]]=r.text;markOutputTimestamp(steps[i]);renderBatchResult('resultsBatchFinish',steps[i],r.text);}App.clearProgress('progressBatchFinish');saveProject(true);App.showToast('마무리 완료');}catch(e){App.clearProgress('progressBatchFinish');App.showToast(e.message,'error');}finally{loadingState.batchFinish=false;App.setButtonLoading('btnBatchFinish',false);setGlobalProcessing(false);}}

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
1. 발명의 명칭: 국문 1개 + 영문 1개 ("~${getDeviceSubject()}" 형태)
2. 기술분야: 1문장
3. 해결하고자 하는 과제: 2~3문장
4. 과제의 해결 수단: 3~5문장
5. 독립항 1개: 핵심 구성요소만 포함한 ${getDeviceSubject()} 청구항
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
- L1 (최상위): X00 형식 — ${getDeviceSubject()}(100), 사용자 단말(200), 외부 시스템(300), 데이터베이스(400)
- L2 (하위 구성): XY0 형식 — 통신부(110), 프로세서(120), 메모리(130)...
- L3 (하위 요소): XYZ 형식 — 수신부(111), 송신부(112)...
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
- 구성요소명은 반드시 "~부" 형태만 사용 ("~모듈", "~유닛" 절대 금지)

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
    const titleLine=titleEn?`${title}{${titleEn}}`:(title||'');
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
        const LINE_FRAME=2.0, LINE_BOX=1.5, LINE_ARROW=1.0, SHADOW_OFFSET=0.025;
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
          // v8.0: tight-fit frame height
          const frameH=batchNumRows*boxH+(batchNumRows>1?(batchNumRows-1)*PPTX_BOX_GAP_Y:0)+PPTX_FRAME_PAD_Y*2;
          
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
          
          // ★ 2D 레이아웃 적용 (L1 노드 제외) ★
          const batchInnerNodes=nodes.filter(n=>{
            const ref=extractRefNum(n.label,'');
            if(!ref)return true;
            if(parseInt(ref)===frameRefNum)return false;
            if(_isL1RefNum(ref))return false;
            return true;
          });
          const batchDisplayNodes=batchInnerNodes.length>0?batchInnerNodes:nodes;
          const batchLayout=computeDeviceLayout2D(batchDisplayNodes,edges);
          const{grid:batchGrid,maxCols:batchMaxCols,numRows:batchNumRows,uniqueEdges:batchUniqueEdges}=batchLayout;
          
          // ═══ v8.0: 충돌 방지 기반 레이아웃 상수 ═══
          const PPTX_FRAME_PAD_X=0.45; // 인치: 프레임↔박스 여백
          const PPTX_FRAME_PAD_Y=0.35;
          const PPTX_BOX_GAP_X=0.35;   // 박스 간 수평 간격
          const PPTX_BOX_GAP_Y=0.30;   // 박스 간 수직 간격
          const PPTX_LEADER_W=0.35;    // 리더라인 공간
          
          const pptxContentW=frameW-PPTX_FRAME_PAD_X*2;
          const batchBoxW=batchMaxCols<=1?Math.min(pptxContentW,4.0):
            batchMaxCols===2?(pptxContentW-PPTX_BOX_GAP_X)/2:
            (pptxContentW-PPTX_BOX_GAP_X*2)/3;
          const batchNodeAreaW=batchMaxCols*batchBoxW+(batchMaxCols-1)*PPTX_BOX_GAP_X;
          const boxH=Math.min(0.65,(AVAILABLE_H-PPTX_FRAME_PAD_Y*2-PPTX_BOX_GAP_Y*(batchNumRows-1))/batchNumRows);
          const boxStartX=frameX+PPTX_FRAME_PAD_X;
          const boxStartY=frameY+PPTX_FRAME_PAD_Y;
          const batchColGap=PPTX_BOX_GAP_X;
          const refLabelX=frameX+frameW+0.1;
          
          // 그림자 + 외곽 본체
          slide.addShape(pptx.shapes.RECTANGLE,{x:frameX+SHADOW_OFFSET,y:frameY+SHADOW_OFFSET,w:frameW,h:frameH,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x:frameX,y:frameY,w:frameW,h:frameH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_FRAME}});
          // 프레임 리더라인은 내부 노드와 함께 겹침 보정 후 렌더링
          
          // 내부 구성요소 박스들 (2D 배치)
          const batchNodeBoxes={};
          batchDisplayNodes.forEach((n,i)=>{
            const gp=batchGrid[n.id];
            if(!gp)return;
            const rowW=gp.layerSize*batchBoxW+(gp.layerSize-1)*batchColGap;
            const rowStartX=boxStartX+(batchNodeAreaW-rowW)/2;
            const bx=rowStartX+gp.col*(batchBoxW+batchColGap);
            const by=boxStartY+gp.row*(boxH+PPTX_BOX_GAP_Y);
            // 참조번호 추출
            const fallbackRef=frameRefNum+10*(i+1);
            const refNum=extractRefNum(n.label,String(fallbackRef));
            const cleanLabel=n.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim();
            const shapeType=matchIconShape(n.label);
            const sm=_shapeMetrics(shapeType,batchBoxW,boxH);
            const SO=SHADOW_OFFSET;
            const sx=bx+sm.dx;
            // Shape-aware 렌더링 (natural proportions)
            switch(shapeType){
              case 'database':{
                const shp=pptx.shapes.CAN||pptx.shapes.RECTANGLE;
                slide.addShape(shp,{x:sx+SO,y:by+SO,w:sm.sw,h:sm.sh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(shp,{x:sx,y:by,w:sm.sw,h:sm.sh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'cloud':{
                const shp=pptx.shapes.CLOUD||pptx.shapes.OVAL;
                slide.addShape(shp,{x:sx+SO,y:by+SO,w:sm.sw,h:sm.sh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(shp,{x:sx,y:by,w:sm.sw,h:sm.sh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'server':{
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+SO,y:by+SO,w:sm.sw,h:sm.sh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx,y:by,w:sm.sw,h:sm.sh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                const h3=sm.sh/3;
                slide.addShape(pptx.shapes.LINE,{x:sx,y:by+h3,w:sm.sw,h:0,line:{color:'000000',width:LINE_BOX*0.5}});
                slide.addShape(pptx.shapes.LINE,{x:sx,y:by+2*h3,w:sm.sw,h:0,line:{color:'000000',width:LINE_BOX*0.5}});
                break;
              }
              case 'monitor':{
                const msh=sm.sh*0.75;
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+SO,y:by+SO,w:sm.sw,h:msh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx,y:by,w:sm.sw,h:msh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX},rectRadius:2});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+sm.sw/2-sm.sw*0.06,y:by+msh,w:sm.sw*0.12,h:sm.sh*0.15,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX*0.5}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+sm.sw/2-sm.sw*0.13,y:by+msh+sm.sh*0.15,w:sm.sw*0.26,h:sm.sh*0.05,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX*0.5}});
                break;
              }
              case 'sensor':{
                const scr=Math.min(sm.sw*0.28,sm.sh*0.38);
                const scx=sx+sm.sw*0.32-scr, scy=by+sm.sh*0.50-scr;
                slide.addShape(pptx.shapes.OVAL,{x:scx+SO,y:scy+SO,w:scr*2,h:scr*2,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.OVAL,{x:scx,y:scy,w:scr*2,h:scr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                const sdr=scr*0.25;
                slide.addShape(pptx.shapes.OVAL,{x:sx+sm.sw*0.32-sdr,y:by+sm.sh*0.50-sdr,w:sdr*2,h:sdr*2,fill:{color:'000000'},line:{width:0}});
                break;
              }
              case 'antenna':{
                const apoleX=sx+sm.sw*0.38;
                const abw=sm.sw*0.22, abh=sm.sh*0.10;
                slide.addShape(pptx.shapes.RECTANGLE,{x:apoleX-abw/2,y:by+sm.sh*0.82,w:abw,h:abh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                slide.addShape(pptx.shapes.LINE,{x:apoleX,y:by+sm.sh*0.18,w:0,h:sm.sh*0.64,line:{color:'000000',width:LINE_BOX*1.2}});
                const abr=Math.min(sm.sw*0.04,sm.sh*0.04);
                slide.addShape(pptx.shapes.OVAL,{x:apoleX-abr,y:by+sm.sh*0.18-abr,w:abr*2,h:abr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'document':{
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+SO,y:by+SO,w:sm.sw,h:sm.sh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx,y:by,w:sm.sw,h:sm.sh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'camera':{
                const ccbx=sx+sm.sw*0.05,ccby=by+sm.sh*0.18,ccbw=sm.sw*0.80,ccbh=sm.sh*0.65;
                slide.addShape(pptx.shapes.RECTANGLE,{x:ccbx+SO,y:ccby+SO,w:ccbw,h:ccbh,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:ccbx,y:ccby,w:ccbw,h:ccbh,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:ccbx+ccbw*0.30,y:ccby-sm.sh*0.10,w:ccbw*0.25,h:sm.sh*0.12,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX*0.6}});
                const clr=Math.min(ccbw,ccbh)*0.30;
                slide.addShape(pptx.shapes.OVAL,{x:ccbx+ccbw*0.50-clr,y:ccby+ccbh*0.52-clr,w:clr*2,h:clr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              case 'speaker':{
                const bspw=sm.sw*0.18,bsph=sm.sh*0.40;
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+sm.sw*0.10,y:by+sm.sh*0.30,w:bspw,h:bsph,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:sx+sm.sw*0.28,y:by+sm.sh*0.12,w:sm.sw*0.28,h:sm.sh*0.76,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
                break;
              }
              default:
                slide.addShape(pptx.shapes.RECTANGLE,{x:bx+SO,y:by+SO,w:batchBoxW,h:boxH,fill:{color:'000000'},line:{width:0}});
                slide.addShape(pptx.shapes.RECTANGLE,{x:bx,y:by,w:batchBoxW,h:boxH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_BOX}});
            }
            // 박스 텍스트 + 참조번호 (내부 2줄)
            const textH=shapeType==='monitor'?sm.sh*0.72:sm.sh;
            const bFontSize=Math.min(batchMaxCols>1?9:11,Math.max(8,12-nodeCount*0.3));
            slide.addText([{text:cleanLabel,options:{fontSize:bFontSize,breakType:'none'}},{text:'\n('+refNum+')',options:{fontSize:Math.max(bFontSize-1,7),color:'444444'}}],{x:sx+0.04,y:by,w:sm.sw-0.08,h:textH,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
            
            batchNodeBoxes[n.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2};
          });
          
          // ★ 프레임 참조번호만 외부 리더라인으로 표시 ★
          const batchFrameLeaderY=frameY+frameH/2;
          slide.addShape(pptx.shapes.LINE,{x:frameX+frameW,y:batchFrameLeaderY,w:0.25,h:0,line:{color:'000000',width:LINE_ARROW}});
          slide.addText(String(frameRefNum),{x:refLabelX+0.25,y:batchFrameLeaderY-0.12,w:0.5,h:0.24,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          
          // ★ Edge 기반 연결선 ★
          const batchEdges=batchUniqueEdges.length>0?batchUniqueEdges:nodes.slice(0,-1).map((n,i)=>({from:n.id,to:nodes[i+1].id}));
          batchEdges.forEach(e=>{
            const fb=batchNodeBoxes[e.from],tb=batchNodeBoxes[e.to];
            if(!fb||!tb)return;
            const pts=getConnectionPoints(fb,tb);
            if(!pts)return;
            const dx=pts.x2-pts.x1,dy=pts.y2-pts.y1;
            if(Math.abs(dx)<0.01){
              slide.addShape(pptx.shapes.LINE,{x:pts.x1,y:Math.min(pts.y1,pts.y2),w:0,h:Math.abs(dy),line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
            }else if(Math.abs(dy)<0.01){
              slide.addShape(pptx.shapes.LINE,{x:Math.min(pts.x1,pts.x2),y:pts.y1,w:Math.abs(dx),h:0,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
            }else{
              const midY=(pts.y1+pts.y2)/2;
              slide.addShape(pptx.shapes.LINE,{x:pts.x1,y:Math.min(pts.y1,midY),w:0,h:Math.abs(pts.y1-midY),line:{color:'000000',width:LINE_ARROW}});
              slide.addShape(pptx.shapes.LINE,{x:Math.min(pts.x1,pts.x2),y:midY,w:Math.abs(dx),h:0,line:{color:'000000',width:LINE_ARROW}});
              slide.addShape(pptx.shapes.LINE,{x:pts.x2,y:Math.min(midY,pts.y2),w:0,h:Math.abs(pts.y2-midY),line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
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
  let r=text.replace(/\n*【수학식\s*\d+】[\s\S]*?(?=\n(?:도\s|이때|또한|한편|다음|여기서|구체적|상기|본 발명|이상|따라서|결과|이를|아울|이와|상술|전술|[가-힣]{2,}부[(\s]|[가-힣]{2,}(?:서버|시스템|장치|단말)|\n|$))/g,'');
  // Pattern 2: Standalone math block headers that might remain
  r=r.replace(/\n*【수학식\s*\d+】[^\n]*\n/g,'\n');
  // Pattern 3: Remove "여기서," blocks that follow math formulas
  r=r.replace(/\n여기서,[\s\S]*?(?=\n\n)/g,'');
  // Pattern 4: Remove math example blocks (old and new format)
  r=r.replace(/\n(?:예시 대입:|예를 들어,|일 예로,|구체적 예시로,)[\s\S]*?(?=\n\n)/g,'');
  // Clean up multiple newlines
  r=r.replace(/\n{3,}/g,'\n\n');
  return r.trim();
}
function insertMathBlocks(s08,s09){
  // First strip any existing math blocks from base text to prevent duplication
  let r=stripMathBlocks(s08);
  const b=parseMathBlocks(s09);
  if(!b.length)return r;
  // Track inserted positions to avoid double-insertion
  const inserted=new Set();
  let successCount=0,failCount=0;
  
  // ═══ A3 fix: 유사도 기반 매칭 (v5.5) ═══
  function fuzzyFind(text,anchor){
    // 1차: 정확 매칭
    const exact=text.indexOf(anchor);
    if(exact>=0)return exact;
    // 2차: 공백/구두점 정규화 후 매칭
    const normalize=s=>s.replace(/\s+/g,' ').replace(/[.,;:!?·…]/g,'').trim();
    const normText=normalize(text);
    const normAnchor=normalize(anchor);
    const normIdx=normText.indexOf(normAnchor);
    if(normIdx>=0){
      // 원본 텍스트에서 대략적 위치 찾기
      const ratio=normIdx/normText.length;
      return Math.floor(ratio*text.length);
    }
    // 3차: 앵커의 핵심 키워드(3단어 이상) 연속 매칭
    const words=anchor.replace(/[.,;:!?·…]/g,'').split(/\s+/).filter(w=>w.length>=2);
    if(words.length>=3){
      const escaped=words.slice(0,Math.min(5,words.length)).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
      const keyPhrase=escaped.join('\\s*');
      try{
        const re=new RegExp(keyPhrase);
        const km=text.match(re);
        if(km)return text.indexOf(km[0]);
      }catch(e){/* regex 실패 시 4차로 진행 */}
    }
    // 4차: 앵커 앞 15자로 부분 매칭
    if(anchor.length>=15){
      const partial=anchor.slice(0,15);
      const pi=text.indexOf(partial);
      if(pi>=0)return pi;
    }
    return -1;
  }
  
  for(const x of b.reverse()){
    const i=fuzzyFind(r,x.anchor);
    if(i>=0 && !inserted.has(x.anchor)){
      inserted.add(x.anchor);
      const s=i+x.anchor.length,p=r.indexOf('.',s);
      const ip=(p>=0&&p-s<100)?p+1:s;
      r=r.slice(0,ip)+'\n\n'+x.formula+'\n\n'+r.slice(ip);
      successCount++;
    }else{
      failCount++;
      console.warn(`수학식 삽입 실패 — ANCHOR 매칭 불가: "${x.anchor.slice(0,50)}..."`);
    }
  }
  // ★ A3 fix: 삽입 결과 알림 (v5.5) ★
  if(failCount>0){
    App.showToast(`수학식 삽입: ${successCount}개 성공, ${failCount}개 실패 (ANCHOR 매칭 불가)`,'warning');
  }else if(successCount>0){
    App.showToast(`수학식 ${successCount}개 삽입 완료`);
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
노드 라벨은 대괄호 안에: A["${getDeviceSubject()}(100)"]

★★★ 올바른 Mermaid 문법 예시 ★★★
\`\`\`mermaid
graph TD
    A["${getDeviceSubject()}(100)"]
    B["사용자 단말(200)"]
    C["네트워크(300)"]
    D["데이터베이스(400)"]
    A --> B
    A --> C
    A --> D
\`\`\`

⛔ 잘못된 문법 (절대 금지):
- A["${getDeviceSubject()}(100)"] <--> B["사용자 단말(200)"]  ← <--> 사용 금지!
- 한 줄에 노드 정의와 연결을 함께 쓰지 말 것

✅ 올바른 문법:
- 노드 정의를 먼저, 연결은 나중에
- 연결은 --> 만 사용 (양방향은 A --> B와 B --> A 두 줄로)

★★★ 노드 정의 순서 = 렌더링 배치에 직접 영향 ★★★
- 도면 설계의 "공간배치"를 반드시 따르라
- 허브 노드를 가장 먼저 정의하라 (BFS 시작점이 됨)
- 같은 행의 노드는 연속 정의하라
- 연결 방향: 허브 → 자식 방향으로 정의 (A --> B, A --> C)
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
- 데이터/정보 도면(~정보, ~데이터): 정보 항목은 ${getDeviceSubject()} 입력 데이터 → 상호 화살표 연결 부적절 → 연결선 없이 병렬 배치 (노드 정의만, A --> B 금지)
- 장치 블록도: 데이터 흐름이 있는 구성요소만 --> 연결
- 상위 구성(110)과 하위 구성(111,112,113)을 같은 레벨에 표현 금지

★★★ 공간배치 → Mermaid 변환 규칙 ★★★
도면 설계에 "공간배치" 섹션이 있으면:
1. "허브"로 지정된 노드의 ID를 가장 먼저 정의하라
2. "행1" 노드를 먼저, "행2" 노드를 그 다음에 정의하라
3. 허브에서 다른 노드로의 연결을 먼저 작성하라 (허브가 BFS 루트가 됨)
4. 같은 행 노드 간 연결이 있으면 반드시 별도 행으로 분리 (겹침 방지)

예시 (허브=서버(100), 행1=서버, 행2=단말+DB):
\`\`\`mermaid
graph TD
    A["서버(100)"]
    B["단말(200)"]
    C["DB(300)"]
    A --> B
    A --> C
\`\`\`

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
- 조건 분기: D{"조건?"} — 다이아몬드(마름모)

★★ 조건 분기(Decision) 표현 규칙 ★★
- 판단이 필요한 단계는 반드시 다이아몬드 노드로 표현
  예: D{"타겟팅 스코어가 임계값 이상인가?"}
- "예" 분기: D -->|예| E["후속 단계(S번호)"]
- "아니오" 분기: D -->|아니오| F["대안 단계(S번호)"]
- 각 분기는 최종적으로 END에 도달해야 함
- 분기 노드의 ID는 DEC1, DEC2... 사용 권장

★★ 연결 형식 ★★
- START --> A (시작에서 첫 단계)
- A --> B --> C (단계 순서)
- D -->|예| E (조건 분기 — 예)
- D -->|아니오| F (조건 분기 — 아니오)
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

// ═══ 전역 도면 헬퍼 함수 (v5.5 — 3중 복제 제거, 단일 정의) ═══
function _extractRefNum(label,fallback){
  const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
  return match?match[1]:(fallback||'');
}
// ★ 안전한 라벨 정리: 참조번호 제거 후 빈 문자열/1글자 방지 ★
function _safeCleanLabel(label){
  if(!label)return '';
  const cleaned=label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim();
  if(cleaned.length<=1&&label.length>1)return label.replace(/[()]/g,'').trim();
  return cleaned||label;
}
function _isL1RefNum(ref){
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
function _findImmediateParent(refNums){
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

// ═══ Diagram Icon Shape System v3.0 ═══
const DIAGRAM_ICON_REGISTRY=[
  {type:'database',keywords:['데이터베이스','데이터 베이스','db','저장소','스토리지','레포지토리']},
  {type:'cloud',keywords:['네트워크','통신망','인터넷','클라우드','통신 네트워크','네트워크 망']},
  {type:'monitor',keywords:['사용자 단말','단말기','단말 장치','클라이언트 단말','모바일 단말','스마트폰','디바이스','디스플레이 장치','휴대 단말']},
  {type:'server',keywords:['서버','서버 장치','처리 서버','컴퓨팅 장치','컴퓨팅 서버']},
  {type:'sensor',keywords:['센서','감지 장치','센싱','감지 센서','측정 장치','센서 모듈']},
  {type:'antenna',keywords:['안테나','rf 모듈']},
  {type:'document',keywords:[]}, // document는 별도 로직으로 판별 (아래 matchIconShape 참고)
  {type:'camera',keywords:['카메라','촬영 장치','영상 촬영','이미지 센서','촬영 모듈','비전','영상 획득','렌즈']},
  {type:'speaker',keywords:['스피커','음향 출력','오디오 출력','사운드','음성 출력','부저']},
];

// ═══ Shape 매칭 v2.0: 구성요소 vs 정보 분리 ═══
// 핵심 규칙:
// 1. "~부/~장치/~모듈/~유닛" 접미사 → 항상 구성요소 → box (server/sensor 등 예외 있음)
// 2. document shape → "정보 그 자체"일 때만 (수집된 정보, 데이터 항목 등)
//    예: "위치 정보(D1)", "사용자 데이터", "환경 정보" → document
//    반례: "정보수집부(110)", "데이터 처리부", "수집부" → box (구성요소)
const COMPONENT_SUFFIXES=['부','장치','모듈','유닛','기','체','센터','서버','시스템','플랫폼','허브','노드','게이트웨이','컨트롤러','엔진','프로세서','메모리','터미널','스위치'];
const DATA_KEYWORDS=['정보','데이터','로그','리포트','문서','기록','메시지','신호','이력','통계','프로파일','인덱스','맵','테이블','목록','리스트'];

function _shapeKeywordMatch(text,keyword){
  // 2글자 이하 키워드는 단어 경계 체크 (부분 문자열 오매칭 방지)
  // 예: "비전" in "소비전력" → false (경계 체크)
  // 예: "서버" in "GPU 서버" → true
  if(keyword.length<=2){
    const idx=text.indexOf(keyword);
    if(idx<0)return false;
    // 키워드 앞: 시작이거나 공백/특수문자
    const before=idx===0||/[\s\(\)\[\]\/,·]/.test(text[idx-1]);
    // 키워드 뒤: 끝이거나 공백/특수문자/숫자/접미사
    const afterIdx=idx+keyword.length;
    const after=afterIdx>=text.length||/[\s\(\)\[\]\/,·0-9]/.test(text[afterIdx])||COMPONENT_SUFFIXES.some(s=>text.slice(afterIdx).startsWith(s));
    return before&&after;
  }
  return text.includes(keyword);
}

function matchIconShape(label){
  const c=label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim();
  const cl=c.toLowerCase();
  
  // Step 1: 구성요소 접미사 체크 ("~부", "~장치", "~모듈" 등)
  const isComponent=COMPONENT_SUFFIXES.some(sfx=>c.endsWith(sfx));
  
  // Step 2: 구성요소라도 특정 shape이 명확한 것은 허용
  if(isComponent){
    // 서버, 단말, 카메라 등은 접미사가 있어도 shape 적용 (document 제외)
    for(const s of DIAGRAM_ICON_REGISTRY){
      if(s.type==='document')continue;
      for(const k of s.keywords){if(_shapeKeywordMatch(cl,k))return s.type;}
    }
    return 'box'; // 구성요소는 기본 box
  }
  
  // Step 3: 구성요소가 아닌 경우 → 일반 shape 매칭
  for(const s of DIAGRAM_ICON_REGISTRY){
    if(s.type==='document')continue;
    for(const k of s.keywords){if(_shapeKeywordMatch(cl,k))return s.type;}
  }
  
  // Step 4: document shape 판별 — "정보 그 자체"인 경우에만
  // 조건: 데이터/정보 키워드 포함 + 구성요소 접미사 없음
  if(DATA_KEYWORDS.some(dk=>cl.includes(dk))){
    return 'document';
  }
  
  return 'box';
}

// ── Cloud SVG path generator ──
function _cloudPathD(x,y,w,h){
  return `M${x+w*0.2},${y+h*0.82} `+
    `C${x+w*0.02},${y+h*0.84} ${x},${y+h*0.44} ${x+w*0.18},${y+h*0.36} `+
    `C${x+w*0.1},${y+h*0.08} ${x+w*0.35},${y} ${x+w*0.48},${y+h*0.16} `+
    `C${x+w*0.58},${y-h*0.01} ${x+w*0.82},${y+h*0.06} ${x+w*0.8},${y+h*0.34} `+
    `C${x+w*0.98},${y+h*0.32} ${x+w},${y+h*0.82} ${x+w*0.8},${y+h*0.82} Z`;
}

// ── Shape shadow SVG ──
function _drawShapeShadow(type,x,y,w,h){
  switch(type){
    case 'database':{
      const ry=Math.min(h*0.18,w*0.15,22);
      return `<ellipse cx="${x+w/2}" cy="${y+ry}" rx="${w/2}" ry="${ry}" fill="#000"/>`+
        `<rect x="${x}" y="${y+ry}" width="${w}" height="${h-2*ry}" fill="#000"/>`+
        `<ellipse cx="${x+w/2}" cy="${y+h-ry}" rx="${w/2}" ry="${ry}" fill="#000"/>`;
    }
    case 'cloud':return `<path d="${_cloudPathD(x,y,w,h)}" fill="#000"/>`;
    case 'server':return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000"/>`;
    case 'monitor':{
      const sh=h*0.72;
      return `<rect x="${x}" y="${y}" width="${w}" height="${sh}" rx="2" fill="#000"/>`+
        `<rect x="${x+w/2-w*0.06}" y="${y+sh}" width="${w*0.12}" height="${h*0.16}" fill="#000"/>`;
    }
    case 'sensor':{
      const cr=Math.min(w*0.28,h*0.38);
      return `<circle cx="${x+w*0.32}" cy="${y+h*0.50}" r="${cr}" fill="#000"/>`;
    }
    case 'antenna':{
      const bw=w*0.20,bh=h*0.12;
      return `<rect x="${x+w/2-bw/2}" y="${y+h-bh}" width="${bw}" height="${bh}" fill="#000"/>`+
        `<line x1="${x+w*0.50}" y1="${y+h*0.18}" x2="${x+w*0.50}" y2="${y+h-bh}" stroke="#000" stroke-width="4"/>`;
    }
    case 'document':{
      const fold=w*0.22;
      return `<path d="M${x},${y} L${x+w-fold},${y} L${x+w},${y+fold} L${x+w},${y+h} L${x},${y+h} Z" fill="#000"/>`;
    }
    case 'camera':{
      return `<rect x="${x}" y="${y+h*0.15}" width="${w*0.85}" height="${h*0.70}" rx="4" fill="#000"/>`;
    }
    case 'speaker':{
      return `<path d="M${x+w*0.10},${y+h*0.30} L${x+w*0.30},${y+h*0.30} L${x+w*0.60},${y+h*0.08} L${x+w*0.60},${y+h*0.92} L${x+w*0.30},${y+h*0.70} L${x+w*0.10},${y+h*0.70} Z" fill="#000"/>`;
    }
    default:return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000"/>`;
  }
}

// ── Shape body SVG ──
function _drawShapeBody(type,x,y,w,h,sw){
  sw=sw||1.5;
  switch(type){
    case 'database':{
      const ry=Math.min(h*0.18,w*0.15,22);
      return `<ellipse cx="${x+w/2}" cy="${y+h-ry}" rx="${w/2}" ry="${ry}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`+
        `<rect x="${x}" y="${y+ry}" width="${w}" height="${h-2*ry}" fill="#fff" stroke="none"/>`+
        `<line x1="${x}" y1="${y+ry}" x2="${x}" y2="${y+h-ry}" stroke="#000" stroke-width="${sw}"/>`+
        `<line x1="${x+w}" y1="${y+ry}" x2="${x+w}" y2="${y+h-ry}" stroke="#000" stroke-width="${sw}"/>`+
        `<ellipse cx="${x+w/2}" cy="${y+ry}" rx="${w/2}" ry="${ry}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
    }
    case 'cloud':return `<path d="${_cloudPathD(x,y,w,h)}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
    case 'server':{
      const h3=h/3,dotR=Math.min(3,h*0.07);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`+
        `<line x1="${x}" y1="${y+h3}" x2="${x+w}" y2="${y+h3}" stroke="#000" stroke-width="${sw*0.55}"/>`+
        `<line x1="${x}" y1="${y+2*h3}" x2="${x+w}" y2="${y+2*h3}" stroke="#000" stroke-width="${sw*0.55}"/>`+
        [0.5,1.5,2.5].map(m=>`<circle cx="${x+w-dotR*4}" cy="${y+h3*m}" r="${dotR}" fill="#000"/>`).join('');
    }
    case 'monitor':{
      const sh=h*0.72,standW=w*0.12,standH=h*0.14,baseW=w*0.25,baseH=h*0.05;
      const sTop=y+sh+h*0.02,bTop=sTop+standH;
      return `<rect x="${x}" y="${y}" width="${w}" height="${sh}" rx="3" fill="#fff" stroke="#000" stroke-width="${sw}"/>`+
        `<rect x="${x+w/2-standW/2}" y="${sTop}" width="${standW}" height="${standH}" fill="#fff" stroke="#000" stroke-width="${sw*0.6}"/>`+
        `<rect x="${x+w/2-baseW/2}" y="${bTop}" width="${baseW}" height="${baseH}" rx="1" fill="#fff" stroke="#000" stroke-width="${sw*0.6}"/>`;
    }
    case 'sensor':{
      // Circle body (left) + wave arcs (right)
      const cr=Math.min(w*0.28,h*0.38);
      const cx=x+w*0.32, cy=y+h*0.50;
      let s=`<circle cx="${cx}" cy="${cy}" r="${cr}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Inner dot
      s+=`<circle cx="${cx}" cy="${cy}" r="${cr*0.25}" fill="#000"/>`;
      // Wave arcs emanating right
      const arcR=[cr*1.55,cr*2.10,cr*2.65];
      arcR.forEach(r=>{
        const a1=-Math.PI*0.35, a2=Math.PI*0.35;
        const x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
        const x2=cx+r*Math.cos(a2), y2=cy+r*Math.sin(a2);
        s+=`<path d="M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}" fill="none" stroke="#000" stroke-width="${sw*0.7}"/>`;
      });
      return s;
    }
    case 'antenna':{
      // Vertical pole + top ball + wave arcs + base
      const poleX=x+w*0.38, topY=y+h*0.18, baseY=y+h*0.82;
      const bw=w*0.22, bh=h*0.10;
      const ballR=Math.min(w*0.04,h*0.04);
      let s='';
      // Base
      s+=`<rect x="${poleX-bw/2}" y="${baseY}" width="${bw}" height="${bh}" rx="2" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Pole
      s+=`<line x1="${poleX}" y1="${topY+ballR}" x2="${poleX}" y2="${baseY}" stroke="#000" stroke-width="${sw*1.2}"/>`;
      // Top ball
      s+=`<circle cx="${poleX}" cy="${topY}" r="${ballR}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Wave arcs (emanating upper-right)
      const arcR=[h*0.16,h*0.26,h*0.36];
      arcR.forEach(r=>{
        const a1=-Math.PI*0.55, a2=-Math.PI*0.05;
        const x1=poleX+r*Math.cos(a1), y1=topY+r*Math.sin(a1);
        const x2=poleX+r*Math.cos(a2), y2=topY+r*Math.sin(a2);
        s+=`<path d="M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}" fill="none" stroke="#000" stroke-width="${sw*0.7}"/>`;
      });
      return s;
    }
    case 'document':{
      // Page with folded top-right corner
      const fold=w*0.22;
      let s=`<path d="M${x},${y} L${x+w-fold},${y} L${x+w},${y+fold} L${x+w},${y+h} L${x},${y+h} Z" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Fold triangle
      s+=`<path d="M${x+w-fold},${y} L${x+w-fold},${y+fold} L${x+w},${y+fold}" fill="#eee" stroke="#000" stroke-width="${sw*0.6}"/>`;
      // Text lines (decorative)
      const lx1=x+w*0.15, lx2=x+w*0.75, ly0=y+h*0.30, gap=h*0.12;
      for(let i=0;i<3;i++){
        s+=`<line x1="${lx1}" y1="${ly0+gap*i}" x2="${lx2-(i===2?w*0.20:0)}" y2="${ly0+gap*i}" stroke="#bbb" stroke-width="${sw*0.4}"/>`;
      }
      return s;
    }
    case 'camera':{
      // Camera body + lens + viewfinder
      const bx=x+w*0.05, by2=y+h*0.18, bw=w*0.80, bh=h*0.65;
      const lensR=Math.min(bw,bh)*0.32;
      const lcx=bx+bw*0.50, lcy=by2+bh*0.52;
      let s=`<rect x="${bx}" y="${by2}" width="${bw}" height="${bh}" rx="4" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Viewfinder bump
      s+=`<rect x="${bx+bw*0.30}" y="${by2-h*0.10}" width="${bw*0.25}" height="${h*0.12}" rx="2" fill="#fff" stroke="#000" stroke-width="${sw*0.7}"/>`;
      // Lens outer
      s+=`<circle cx="${lcx}" cy="${lcy}" r="${lensR}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      // Lens inner
      s+=`<circle cx="${lcx}" cy="${lcy}" r="${lensR*0.55}" fill="#fff" stroke="#000" stroke-width="${sw*0.6}"/>`;
      // Lens center dot
      s+=`<circle cx="${lcx}" cy="${lcy}" r="${lensR*0.15}" fill="#000"/>`;
      return s;
    }
    case 'speaker':{
      // Speaker cone + sound wave arcs
      const sw2=sw;
      // Speaker body (trapezoid)
      let s=`<path d="M${x+w*0.10},${y+h*0.30} L${x+w*0.28},${y+h*0.30} L${x+w*0.55},${y+h*0.08} L${x+w*0.55},${y+h*0.92} L${x+w*0.28},${y+h*0.70} L${x+w*0.10},${y+h*0.70} Z" fill="#fff" stroke="#000" stroke-width="${sw2}"/>`;
      // Divider between driver and cone
      s+=`<line x1="${x+w*0.28}" y1="${y+h*0.30}" x2="${x+w*0.28}" y2="${y+h*0.70}" stroke="#000" stroke-width="${sw2*0.6}"/>`;
      // Sound wave arcs
      const waveCx=x+w*0.55, waveCy=y+h*0.50;
      [h*0.22,h*0.34,h*0.46].forEach(r=>{
        const a1=-Math.PI*0.30, a2=Math.PI*0.30;
        const x1=waveCx+r*Math.cos(a1), y1=waveCy+r*Math.sin(a1);
        const x2=waveCx+r*Math.cos(a2), y2=waveCy+r*Math.sin(a2);
        s+=`<path d="M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}" fill="none" stroke="#000" stroke-width="${sw2*0.7}"/>`;
      });
      return s;
    }
    default:return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
  }
}

function _shapeTextCy(type,y,h){
  switch(type){
    case 'database':return y+h*0.55;
    case 'cloud':return y+h*0.50;
    case 'monitor':return y+h*0.72*0.45;
    case 'sensor':return y+h*0.50;
    case 'antenna':return y+h*0.65;
    case 'document':return y+h*0.62;
    case 'camera':return y+h*0.52;
    case 'speaker':return y+h*0.50;
    default:return y+h/2;
  }
}

// ── Shape right edge X for leader line ──
function _shapeLeaderX(type,x,w){
  switch(type){
    case 'cloud':return x+w*0.93;
    case 'sensor':return x+w*0.92;
    case 'antenna':return x+w*0.88;
    case 'speaker':return x+w*0.95;
    case 'monitor':return x+w;
    default:return x+w;
  }
}

// ── Shape natural proportion metrics ──
// Computes natural shape dimensions fitted within a box slot.
// Uses absolute aspect ratios so shapes look correct regardless of boxW/boxH.
function _shapeMetrics(type,boxW,boxH){
  // Natural desired pixel aspect ratios (width : height)
  // These produce visually correct shapes at any scale
  switch(type){
    case 'database':{
      // Cylinder: moderately wide, taller than box
      const sh=boxH*1.80, sw=sh*1.40;
      return{sw:Math.min(sw,boxW*0.65),sh,dx:(boxW-Math.min(sw,boxW*0.65))/2};
    }
    case 'cloud':{
      // Cloud: wide and puffy
      const sh=boxH*1.50, sw=sh*2.60;
      return{sw:Math.min(sw,boxW*0.75),sh,dx:(boxW-Math.min(sw,boxW*0.75))/2};
    }
    case 'server':{
      // Server rack: narrow and tall
      const sh=boxH*1.80, sw=sh*1.10;
      return{sw:Math.min(sw,boxW*0.50),sh,dx:(boxW-Math.min(sw,boxW*0.50))/2};
    }
    case 'monitor':{
      // Monitor + stand: moderately wide, taller
      const sh=boxH*1.80, sw=sh*1.50;
      return{sw:Math.min(sw,boxW*0.60),sh,dx:(boxW-Math.min(sw,boxW*0.60))/2};
    }
    case 'sensor':{
      // Sensor: circle body + wave arcs on right side
      const sh=boxH*1.70, sw=sh*1.80;
      return{sw:Math.min(sw,boxW*0.65),sh,dx:(boxW-Math.min(sw,boxW*0.65))/2};
    }
    case 'antenna':{
      // Antenna: pole + signal waves
      const sh=boxH*1.80, sw=sh*1.60;
      return{sw:Math.min(sw,boxW*0.60),sh,dx:(boxW-Math.min(sw,boxW*0.60))/2};
    }
    case 'document':{
      // Document: page with folded corner
      const sh=boxH*1.80, sw=sh*0.78;
      return{sw:Math.min(sw,boxW*0.45),sh,dx:(boxW-Math.min(sw,boxW*0.45))/2};
    }
    case 'camera':{
      // Camera: body + lens circle
      const sh=boxH*1.60, sw=sh*1.50;
      return{sw:Math.min(sw,boxW*0.60),sh,dx:(boxW-Math.min(sw,boxW*0.60))/2};
    }
    case 'speaker':{
      // Speaker: cone shape
      const sh=boxH*1.70, sw=sh*1.50;
      return{sw:Math.min(sw,boxW*0.60),sh,dx:(boxW-Math.min(sw,boxW*0.60))/2};
    }
    default:return{sw:boxW,sh:boxH,dx:0};
  }
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
- 데이터/정보 도면: 정보 항목은 ${getDeviceSubject()} 입력용이므로 상호 간 화살표 연결 부적절 → 병렬 배치
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
  // 1. A["label"] - 사각형 (rect)
  // 2. A(["label"]) - 스타디움 (stadium) - 시작/종료
  // 3. A("label") - 둥근 사각형 (round)
  // 4. A{"label"} - 다이아몬드 (diamond) - 조건 분기
  // 5. A[/"label"/] - 평행사변형
  // 6. A(("label")) - 원형
  
  // 먼저 줄 단위로 노드 정의 추출
  code.split('\n').forEach(line=>{
    const l=line.trim();
    if(!l||l.startsWith('graph')||l.startsWith('flowchart')||l==='end'||l.startsWith('style')||l.startsWith('linkStyle')||l.startsWith('classDef'))return;
    
    // 노드 정의 패턴들 (순서 중요: 더 복잡한 패턴 먼저)
    const patterns=[
      {re:/(\w+)\s*\(\[\s*["']?([^\]"']+?)["']?\s*\]\)/g, shape:'stadium'},
      {re:/(\w+)\s*\(\(\s*["']?([^)"']+?)["']?\s*\)\)/g, shape:'circle'},
      {re:/(\w+)\s*\{\s*["']?([^}"']+?)["']?\s*\}/g, shape:'diamond'},
      {re:/(\w+)\s*\(\s*["']?([^)"']+?)["']?\s*\)/g, shape:'round'},
      {re:/(\w+)\s*\[\s*["']?([^\]"']+?)["']?\s*\]/g, shape:'rect'},
    ];
    
    patterns.forEach(({re,shape})=>{
      re.lastIndex=0;
      let nm;
      while((nm=re.exec(l))!==null){
        const[,id,label]=nm;
        if(label.includes('-->')||label.includes('<--')||label.includes('---'))continue;
        if(!nodes[id])nodes[id]={id,label:label.trim(),shape};
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

// ═══ 2D Layout Engine v3.0: Hub-Spoke (꺾임 최소화) ═══
// 핵심: 허브를 중앙에, 이웃 노드를 상하좌우에 배치 → 직선 연결 극대화
// 같은 행/열의 노드끼리는 직선 연결, 다른 행+열이면 꺾임 발생
function computeDeviceLayout2D(nodes,edges){
  const n=nodes.length;
  if(n===0)return{grid:{},maxCols:1,numRows:0,uniqueEdges:[]};
  const MAX_COLS=3;
  
  // Build bidirectional adjacency
  const adj={};
  nodes.forEach(nd=>{adj[nd.id]=new Set();});
  const edgeSet=new Set();
  edges.forEach(e=>{
    const k1=e.from+'|'+e.to, k2=e.to+'|'+e.from;
    if(!edgeSet.has(k1)&&!edgeSet.has(k2))edgeSet.add(k1);
    if(adj[e.from])adj[e.from].add(e.to);
    if(adj[e.to])adj[e.to].add(e.from);
  });
  const uniqueEdges=[...edgeSet].map(k=>{const[f,t]=k.split('|');return{from:f,to:t};});
  
  // No edges → grid layout
  if(edges.length===0){
    const grid={};const rows=[];
    for(let i=0;i<n;i+=MAX_COLS){rows.push(nodes.slice(i,Math.min(i+MAX_COLS,n)).map(nd=>nd.id));}
    rows.forEach((row,ri)=>{row.forEach((id,ci)=>{grid[id]={row:ri,col:ci,layerSize:row.length};});});
    return{grid,maxCols:Math.min(n,MAX_COLS),numRows:rows.length,uniqueEdges:[],layers:rows};
  }
  
  // Find hub (highest degree)
  let hubId=nodes[0].id, maxDeg=0;
  nodes.forEach(nd=>{const deg=(adj[nd.id]||new Set()).size;if(deg>maxDeg){maxDeg=deg;hubId=nd.id;}});
  
  // Ensure all nodes reachable
  const visited=new Set([hubId]);
  let frontier=[hubId];
  while(frontier.length){
    const next=[];
    frontier.forEach(id=>{(adj[id]||new Set()).forEach(nid=>{if(!visited.has(nid)){visited.add(nid);next.push(nid);}});});
    frontier=next;
  }
  nodes.forEach(nd=>{visited.add(nd.id);});
  
  const hubNbrs=[...(adj[hubId]||new Set())];
  const others=nodes.filter(nd=>nd.id!==hubId&&!hubNbrs.includes(nd.id)).map(nd=>nd.id);
  
  // ★ Hub-Spoke 배치: 허브와 같은 행 또는 같은 열에 이웃 배치 → 직선 연결 ★
  // 같은 행 = 수평 직선, 같은 열 = 수직 직선
  // 허브 위치: 중간 행 중앙 열 (row=R, col=1)
  // 직선 위치 4곳: 위(R-1,1), 왼쪽(R,0), 오른쪽(R,2), 아래(R+1,1)
  let layers=[];
  const nN=hubNbrs.length;
  
  if(nN===0){
    layers=[[hubId]];
  }else if(nN===1){
    layers=[[hubId,hubNbrs[0]]];
  }else if(nN===2){
    // 2이웃: 허브 양옆에 배치 → 모두 수평 직선
    layers=[[hubNbrs[0],hubId,hubNbrs[1]]];
  }else if(nN===3){
    // 3이웃: 연결된 쌍은 같은 열(수직 정렬)에 배치 → 꺾임 최소화
    // 연결된 쌍 찾기
    let connPair=null;
    for(let i=0;i<3;i++){
      for(let j=i+1;j<3;j++){
        if(adj[hubNbrs[i]].has(hubNbrs[j])){connPair=[hubNbrs[i],hubNbrs[j]];break;}
      }
      if(connPair)break;
    }
    if(connPair){
      // 연결된 쌍(pA, pB): pA는 허브와 같은 행, pB는 아래 같은 열 → 수직 직선
      const[pA,pB]=connPair;
      const other=hubNbrs.find(n=>n!==pA&&n!==pB);
      // Row 0: [other, hub, pA] (3cols)
      // Row 1: [pB] at col 2 (layerSize=3으로 정렬)
      layers=[[other,hubId,pA],[pB]];
      // pB를 pA와 같은 열에 정렬 (layerSize 오버라이드)
      layers._alignCol={[pB]:{col:2,layerSize:3}};
    }else{
      // 연결된 쌍 없음: 고립 노드를 위에, 나머지 허브 양옆
      let topChild=null,sideA=null,sideB=null;
      for(let i=0;i<3;i++){
        const ci=hubNbrs[i];
        const otherTwo=hubNbrs.filter((_,j)=>j!==i);
        if(!adj[ci].has(otherTwo[0])&&!adj[ci].has(otherTwo[1])){
          topChild=ci;sideA=otherTwo[0];sideB=otherTwo[1];break;
        }
      }
      if(!topChild){topChild=hubNbrs[0];sideA=hubNbrs[1];sideB=hubNbrs[2];}
      layers=[[topChild],[sideA,hubId,sideB]];
    }
  }else if(nN===4){
    // 4이웃: 완전 십자형 — 위1, 양옆2, 아래1 → 4개 모두 직선!
    let top=null,left=null,right=null,bottom=null;
    // 서로 연결된 쌍을 같은 행에
    const pairs=[];
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){if(adj[hubNbrs[i]].has(hubNbrs[j]))pairs.push([i,j]);}
    if(pairs.length>0){
      const[pi,pj]=pairs[0];
      left=hubNbrs[pi];right=hubNbrs[pj];
      const rest=hubNbrs.filter((_,k)=>k!==pi&&k!==pj);
      top=rest[0];bottom=rest[1];
    }else{
      top=hubNbrs[0];left=hubNbrs[1];right=hubNbrs[2];bottom=hubNbrs[3];
    }
    layers=[[top],[left,hubId,right],[bottom]];
  }else if(nN===5){
    // 5이웃: 위1, 양옆2, 아래2
    layers=[[hubNbrs[0]],[hubNbrs[1],hubId,hubNbrs[2]],[hubNbrs[3],hubNbrs[4]]];
  }else{
    // 6+이웃: 위2, 허브+양옆, 나머지 아래
    layers=[[hubNbrs[0],hubNbrs[1]],[hubNbrs[2],hubId,hubNbrs[3]]];
    const rest=hubNbrs.slice(4);
    for(let i=0;i<rest.length;i+=MAX_COLS){layers.push(rest.slice(i,Math.min(i+MAX_COLS,rest.length)));}
  }
  
  // 비이웃 노드 추가 (빈 자리 또는 새 행)
  others.forEach(id=>{
    let added=false;
    for(let li=0;li<layers.length;li++){if(layers[li].length<MAX_COLS){layers[li].push(id);added=true;break;}}
    if(!added)layers.push([id]);
  });
  
  // Grid 생성 (열 정렬 오버라이드 지원)
  const grid={};let maxCols=1;
  const alignCol=layers._alignCol||{};
  layers.forEach((layer,rowIdx)=>{
    maxCols=Math.max(maxCols,layer.length);
    layer.forEach((id,colIdx)=>{
      if(alignCol[id]){
        grid[id]={row:rowIdx,col:alignCol[id].col,layerSize:alignCol[id].layerSize};
        maxCols=Math.max(maxCols,alignCol[id].layerSize);
      }else{
        grid[id]={row:rowIdx,col:colIdx,layerSize:layer.length};
      }
    });
  });
  
  return{grid,maxCols:Math.min(maxCols,MAX_COLS),numRows:layers.length,uniqueEdges,layers};
}

// ── Strict Orthogonal Router v3.0 ──
// 모든 세그먼트가 수평(H) 또는 수직(V)만 허용. 사선 절대 불가.
// allBoxes 전달 시 다른 박스 관통 회피.
function getOrthogonalRoute(fromBox,toBox,allBoxes){
  const dx=toBox.cx-fromBox.cx, dy=toBox.cy-fromBox.cy;
  if(Math.abs(dx)<1&&Math.abs(dy)<1)return null;
  const GAP=12;
  
  // ★ 핵심: exit/entry 지점을 결정하고 H/V 세그먼트로만 연결 ★
  
  // 1) 같은 열 (수직 정렬) → 수직 직선
  if(Math.abs(dx)<Math.max(fromBox.w,toBox.w)*0.4){
    const midX=(fromBox.cx+toBox.cx)/2; // 정확히 같은 X 보장
    if(dy>0)return[{x:midX,y:fromBox.y+fromBox.h},{x:midX,y:toBox.y}];
    return[{x:midX,y:fromBox.y},{x:midX,y:toBox.y+toBox.h}];
  }
  
  // 2) 같은 행 (수평 정렬) → 수평 직선
  if(Math.abs(dy)<Math.max(fromBox.h,toBox.h)*0.4){
    const midY=(fromBox.cy+toBox.cy)/2; // 정확히 같은 Y 보장
    if(dx>0)return[{x:fromBox.x+fromBox.w,y:midY},{x:toBox.x,y:midY}];
    return[{x:fromBox.x,y:midY},{x:toBox.x+toBox.w,y:midY}];
  }
  
  // 3) 대각선 위치 → L-shape (2 세그먼트) 또는 Z-shape (3 세그먼트)
  // 두 가지 L-shape 후보를 생성, 장애물 적은 쪽 선택
  
  // L-shape 후보 A: 수직 먼저 → 수평
  const routeA=_buildLRoute_VH(fromBox,toBox,dy,dx);
  // L-shape 후보 B: 수평 먼저 → 수직
  const routeB=_buildLRoute_HV(fromBox,toBox,dy,dx);
  
  if(!allBoxes||allBoxes.length===0)return routeA;
  
  // 장애물 충돌 검사
  const excludeIds=new Set([fromBox.id,toBox.id].filter(Boolean));
  const hitsA=_countRouteCollisions(routeA,allBoxes,excludeIds);
  const hitsB=_countRouteCollisions(routeB,allBoxes,excludeIds);
  
  if(hitsA<=hitsB)return routeA;
  return routeB;
}

// L-shape: 수직(V) 먼저 → 수평(H)
function _buildLRoute_VH(from,to,dy,dx){
  const exitX=from.cx;
  const exitY=dy>0?from.y+from.h:from.y;
  const entryY=to.cy;
  const entryX=dx>0?to.x:to.x+to.w;
  // V segment: (exitX, exitY) → (exitX, entryY)
  // H segment: (exitX, entryY) → (entryX, entryY)
  return[{x:exitX,y:exitY},{x:exitX,y:entryY},{x:entryX,y:entryY}];
}

// L-shape: 수평(H) 먼저 → 수직(V)
function _buildLRoute_HV(from,to,dy,dx){
  const exitY=from.cy;
  const exitX=dx>0?from.x+from.w:from.x;
  const entryX=to.cx;
  const entryY=dy>0?to.y:to.y+to.h;
  // H segment: (exitX, exitY) → (entryX, exitY)
  // V segment: (entryX, exitY) → (entryX, entryY)
  return[{x:exitX,y:exitY},{x:entryX,y:exitY},{x:entryX,y:entryY}];
}

// 경로가 박스를 관통하는지 검사
function _countRouteCollisions(route,allBoxes,excludeIds){
  let hits=0;
  for(let i=0;i<route.length-1;i++){
    const p1=route[i],p2=route[i+1];
    allBoxes.forEach(box=>{
      if(excludeIds.has(box.id))return;
      if(_segmentIntersectsBox(p1,p2,box))hits++;
    });
  }
  return hits;
}

// H/V 세그먼트가 박스와 교차하는지
function _segmentIntersectsBox(p1,p2,box){
  const pad=2;
  const bx1=box.x-pad,by1=box.y-pad,bx2=box.x+box.w+pad,by2=box.y+box.h+pad;
  if(Math.abs(p1.y-p2.y)<1){
    // 수평 세그먼트
    const y=p1.y;
    if(y<by1||y>by2)return false;
    const minX=Math.min(p1.x,p2.x),maxX=Math.max(p1.x,p2.x);
    return maxX>bx1&&minX<bx2;
  }else{
    // 수직 세그먼트
    const x=p1.x;
    if(x<bx1||x>bx2)return false;
    const minY=Math.min(p1.y,p2.y),maxY=Math.max(p1.y,p2.y);
    return maxY>by1&&minY<by2;
  }
}

// SVG orthogonal path renderer (H/V 세그먼트만 허용)
function svgOrthogonalEdge(route,mkId){
  if(!route||route.length<2)return'';
  // ★ 안전 검증: 2점 경로에서 X,Y 모두 다르면 L-shape로 변환 ★
  if(route.length===2){
    const p0=route[0],p1=route[1];
    if(Math.abs(p0.x-p1.x)>1&&Math.abs(p0.y-p1.y)>1){
      // 사선 방지: L-shape로 변환 (수평→수직)
      route=[p0,{x:p1.x,y:p0.y},p1];
    }
  }
  if(route.length===2){
    return`<line x1="${route[0].x}" y1="${route[0].y}" x2="${route[1].x}" y2="${route[1].y}" stroke="#000" stroke-width="1" marker-start="url(#${mkId})" marker-end="url(#${mkId})"/>`;
  }
  let d=`M${route[0].x},${route[0].y}`;
  for(let i=1;i<route.length;i++)d+=` L${route[i].x},${route[i].y}`;
  return`<path d="${d}" fill="none" stroke="#000" stroke-width="1" marker-start="url(#${mkId})" marker-end="url(#${mkId})"/>`;
}

// Stagger leader line Y-positions to prevent reference number overlap
// Enhanced v2: same-row aware + bidirectional spread + minimum gap enforcement
function staggerLeaderYPositions(leaderEntries,minGap){
  if(!leaderEntries.length)return;
  minGap=minGap||18;
  
  // Phase 1: 같은 Y 그룹 감지 → 열 기반 사전 오프셋
  const yGroups={};
  leaderEntries.forEach(le=>{
    const roundedY=Math.round(le.y*10)/10; // 소수점 1자리 반올림
    let matched=false;
    Object.keys(yGroups).forEach(gy=>{
      if(Math.abs(parseFloat(gy)-roundedY)<minGap*0.8){
        yGroups[gy].push(le);
        matched=true;
      }
    });
    if(!matched)yGroups[roundedY]=[le];
  });
  
  // 같은 Y 그룹 내에서 중앙 기준 양방향 분산
  Object.values(yGroups).forEach(group=>{
    if(group.length<=1)return;
    const centerY=group.reduce((s,le)=>s+le.y,0)/group.length;
    const spread=minGap*1.2; // 각 항목 간 간격
    const totalSpread=(group.length-1)*spread;
    const startY=centerY-totalSpread/2;
    // 참조번호 순서로 정렬 (작은 번호 위)
    group.sort((a,b)=>{
      const na=parseInt(String(a.refNum).replace(/\D/g,''))||0;
      const nb=parseInt(String(b.refNum).replace(/\D/g,''))||0;
      return na-nb;
    });
    group.forEach((le,i)=>{
      le.y=startY+i*spread;
    });
  });
  
  // Phase 2: 전체 정렬 후 최소 간격 강제
  leaderEntries.sort((a,b)=>a.y-b.y);
  for(let i=1;i<leaderEntries.length;i++){
    if(leaderEntries[i].y-leaderEntries[i-1].y<minGap){
      leaderEntries[i].y=leaderEntries[i-1].y+minGap;
    }
  }
}

// Backward-compat: returns {x1,y1,x2,y2} for PPTX/Canvas L-shape routing
function getConnectionPoints(fromBox,toBox){
  const dx=toBox.cx-fromBox.cx, dy=toBox.cy-fromBox.cy;
  if(Math.abs(dx)<1&&Math.abs(dy)<1)return null;
  if(Math.abs(dy)>=Math.abs(dx)){
    if(dy>0)return{x1:fromBox.cx,y1:fromBox.y+fromBox.h,x2:toBox.cx,y2:toBox.y};
    return{x1:fromBox.cx,y1:fromBox.y,x2:toBox.cx,y2:toBox.y+toBox.h};
  }else{
    if(dx>0)return{x1:fromBox.x+fromBox.w,y1:fromBox.cy,x2:toBox.x,y2:toBox.cy};
    return{x1:fromBox.x,y1:fromBox.cy,x2:toBox.x+toBox.w,y2:toBox.cy};
  }
}

// ═══ v8.0: 객체 기반 충돌 방지 레이아웃 엔진 (공통) ═══
// 모든 렌더러(SVG, Canvas, PPTX)가 공유하는 레이아웃 계산기
function computeFig2Layout(displayNodes, edges, innerGrid, innerMaxCols, innerNumRows, innerUniqueEdges, frameRefNum, opts){
  const{boxBaseW, boxBaseH, colGap, rowGap, framePad, shadowSize, scale}=opts;
  // scale: SVG=72(PX), Canvas=1(px), PPTX=1(inch)
  
  // Phase 1: 각 노드를 객체(Rect)로 변환
  const objects=[];
  displayNodes.forEach(nd=>{
    const gp=innerGrid[nd.id];
    if(!gp)return;
    // 행 내 노드 수에 따른 중앙 정렬
    const rowNodeAreaW=gp.layerSize*boxBaseW+(gp.layerSize-1)*colGap;
    const totalAreaW=innerMaxCols*boxBaseW+(innerMaxCols-1)*colGap;
    const rowOffsetX=(totalAreaW-rowNodeAreaW)/2;
    const localX=rowOffsetX+gp.col*(boxBaseW+colGap);
    const localY=gp.row*(boxBaseH+rowGap);
    const fallbackRef=frameRefNum+10*(parseInt(nd.id.replace(/\D/g,''))||1);
    objects.push({
      id:nd.id, type:'box',
      x:localX, y:localY,
      w:boxBaseW, h:boxBaseH,
      label:nd.label, fallbackRef
    });
  });
  
  // Phase 2: 충돌 감지 & 자동 보정 (최대 20라운드)
  // v8.1: 그림자 크기를 포함한 충돌 영역 (shadow + 여유 패딩)
  const MIN_SEP=Math.max(colGap*0.3, shadowSize*4+4); // 그림자(×4) + 여유
  for(let round=0;round<20;round++){
    let anyFixed=false;
    for(let i=0;i<objects.length;i++){
      for(let j=i+1;j<objects.length;j++){
        const a=objects[i], b=objects[j];
        const gapX=(a.x<b.x)?(b.x-(a.x+a.w)):(a.x-(b.x+b.w));
        const gapY=(a.y<b.y)?(b.y-(a.y+a.h)):(a.y-(b.y+b.h));
        // 둘 다 음수면 겹침
        if(gapX<MIN_SEP && gapY<MIN_SEP){
          const pushX=MIN_SEP-gapX;
          const pushY=MIN_SEP-gapY;
          // 더 적은 이동으로 해결되는 방향 선택
          if(pushX<=pushY && pushX>0){
            if(b.x>=a.x){b.x+=pushX;}else{a.x+=pushX;}
            anyFixed=true;
          }else if(pushY>0){
            if(b.y>=a.y){b.y+=pushY;}else{a.y+=pushY;}
            anyFixed=true;
          }
        }
      }
    }
    if(!anyFixed)break;
  }
  
  // Phase 3: 바운딩 박스 계산 (v8.1: 그림자 공간 포함)
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  objects.forEach(o=>{
    minX=Math.min(minX,o.x);
    minY=Math.min(minY,o.y);
    maxX=Math.max(maxX,o.x+o.w+shadowSize+2);
    maxY=Math.max(maxY,o.y+o.h+shadowSize+2);
  });
  if(!objects.length){minX=0;minY=0;maxX=boxBaseW;maxY=boxBaseH;}
  const contentW=maxX-minX;
  const contentH=maxY-minY;
  
  // Phase 4: 프레임 좌표 (content + padding)
  const frameW=contentW+framePad*2;
  const frameH=contentH+framePad*2;
  
  // Phase 5: 객체 좌표를 프레임 내부 좌표로 재배치 (원점 보정)
  const offsetX=framePad-minX;
  const offsetY=framePad-minY;
  objects.forEach(o=>{o.x+=offsetX;o.y+=offsetY;});
  
  // Phase 6: 프레임 경계 침범 최종 검증 (v8.1: 그림자 공간 확보)
  const shadowPad=shadowSize+2;
  objects.forEach(o=>{
    if(o.x<framePad)o.x=framePad;
    if(o.y<framePad)o.y=framePad;
    if(o.x+o.w+shadowPad>frameW-framePad)o.x=frameW-framePad-o.w-shadowPad;
    if(o.y+o.h+shadowPad>frameH-framePad)o.y=frameH-framePad-o.h-shadowPad;
  });
  
  return{objects, frameW, frameH, contentW, contentH};
}

function renderDiagramSvg(containerId,nodes,edges,positions,figNum){
  // ═══ KIPO 특허 도면 규칙 v4.1 (직계 부모 일치) ═══
  const PX=72;
  const SHADOW_OFFSET=2.5; // v8.0: 축소 (4→2.5)
  
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
    // ═══ 방법 도면: 흐름도 v6.0 (다이아몬드 분기 지원) ═══
    const boxH=0.7*PX, boxGap=0.8*PX, diamondH=1.0*PX;
    const normalBoxW=5.0*PX;
    const startEndBoxW=2.0*PX;
    const diamondW=5.5*PX;
    const boxStartY=0.5*PX;
    // 분기 여부 판단
    const hasBranching=edges.some(e=>e.label);
    const branchOffset=hasBranching?2.8*PX:0;
    const centerX=0.5*PX+normalBoxW/2+branchOffset/2;
    const svgW=normalBoxW+2.5*PX+branchOffset;
    
    // 노드 위치 계산 (토폴로지 기반)
    const nodeMap={};nodes.forEach(n=>nodeMap[n.id]=n);
    const adj={};edges.forEach(e=>{if(!adj[e.from])adj[e.from]=[];adj[e.from].push(e);});
    // 간단한 순서: nodes 배열 순서 사용 (이미 파싱 순서)
    const nodePositions={};
    let curY=boxStartY;
    nodes.forEach((n,i)=>{
      const isDiamond=n.shape==='diamond';
      const isStartEnd=/시작|종료|START|END/i.test(n.label);
      const h=isDiamond?diamondH:boxH;
      nodePositions[n.id]={x:centerX,y:curY,h,idx:i,isDiamond,isStartEnd};
      curY+=h+boxGap;
    });
    const svgH=curY+0.5*PX;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${hasBranching?650:550}px;background:white;border-radius:8px">`;
    
    const mkId=`ah_${containerId}`;
    svg+=`<defs>
      <marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#000"/>
      </marker>
    </defs>`;
    
    // 노드 렌더링
    nodes.forEach((n,i)=>{
      const pos=nodePositions[n.id];
      const refNum=extractRefNum(n.label,'');
      const displayLabel=n.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').replace(/\?$/, '').trim();
      const isDiamond=n.shape==='diamond';
      const isStartEnd=pos.isStartEnd;
      const SO=3;
      
      if(isDiamond){
        // ★ 다이아몬드(마름모) 렌더링 ★
        const cx=centerX, cy=pos.y+diamondH/2;
        const dw=diamondW/2, dh=diamondH/2;
        // 그림자
        svg+=`<polygon points="${cx+SO},${cy-dh+SO} ${cx+dw+SO},${cy+SO} ${cx+SO},${cy+dh+SO} ${cx-dw+SO},${cy+SO}" fill="#000"/>`;
        // 본체
        svg+=`<polygon points="${cx},${cy-dh} ${cx+dw},${cy} ${cx},${cy+dh} ${cx-dw},${cy}" fill="#fff" stroke="#000" stroke-width="1.5"/>`;
        // 텍스트 (여러 줄 지원)
        const maxChars=16;
        if(displayLabel.length>maxChars){
          const mid=Math.ceil(displayLabel.length/2);
          const sp=displayLabel.lastIndexOf(' ',mid);
          const bp=sp>0?sp:mid;
          svg+=`<text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel.slice(0,bp))}</text>`;
          svg+=`<text x="${cx}" y="${cy+10}" text-anchor="middle" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel.slice(bp).trim())}</text>`;
        }else{
          svg+=`<text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
        }
        // 리더라인 + 부호
        if(refNum){
          const leaderEndX=centerX+normalBoxW/2+0.3*PX+branchOffset/2;
          svg+=`<line x1="${cx+dw}" y1="${cy}" x2="${leaderEndX}" y2="${cy}" stroke="#000" stroke-width="1"/>`;
          svg+=`<text x="${leaderEndX+8}" y="${cy+4}" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
        }
      }else{
        // 사각형/스타디움 렌더링 (기존 코드)
        const boxW=isStartEnd?startEndBoxW:normalBoxW;
        const bx=centerX-boxW/2;
        const by=pos.y;
        const rx=isStartEnd?boxH/2:0;
        svg+=`<rect x="${bx+SO}" y="${by+SO}" width="${boxW}" height="${boxH}" rx="${rx}" fill="#000"/>`;
        svg+=`<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="${rx}" fill="#fff" stroke="#000" stroke-width="${isStartEnd?2:1.5}"/>`;
        svg+=`<text x="${centerX}" y="${by+boxH/2+4}" text-anchor="middle" font-size="13" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
        if(refNum&&!isStartEnd){
          const leaderEndX=centerX+normalBoxW/2+0.3*PX+branchOffset/2;
          const leaderY=by+boxH/2;
          svg+=`<line x1="${bx+boxW}" y1="${leaderY}" x2="${leaderEndX}" y2="${leaderY}" stroke="#000" stroke-width="1"/>`;
          svg+=`<text x="${leaderEndX+8}" y="${leaderY+4}" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
        }
      }
    });
    
    // 화살표 렌더링 (에지 기반)
    if(edges.length>0){
      const drawnEdges=new Set();
      edges.forEach(e=>{
        const fp=nodePositions[e.from],tp=nodePositions[e.to];
        if(!fp||!tp)return;
        const key=e.from+'->'+e.to;
        if(drawnEdges.has(key))return;
        drawnEdges.add(key);
        const fromDiamond=nodeMap[e.from]?.shape==='diamond';
        const isNoLabel=e.label&&/아니오|아니오|No|N|아니요/i.test(e.label);
        const isYesLabel=e.label&&/예|Yes|Y/i.test(e.label);
        
        if(fromDiamond&&isNoLabel){
          // "아니오" 분기: 오른쪽으로 꺾어서 연결
          const fromCy=fp.y+fp.h/2;
          const toCy=tp.y+(tp.isDiamond?tp.h/2:boxH/2);
          const branchX=centerX+normalBoxW/2+0.5*PX;
          // 다이아몬드 우측에서 출발
          svg+=`<line x1="${centerX+diamondW/2}" y1="${fromCy}" x2="${branchX}" y2="${fromCy}" stroke="#000" stroke-width="1"/>`;
          svg+=`<line x1="${branchX}" y1="${fromCy}" x2="${branchX}" y2="${tp.y-2}" stroke="#000" stroke-width="1"/>`;
          svg+=`<line x1="${branchX}" y1="${tp.y-2}" x2="${centerX}" y2="${tp.y-2}" stroke="#000" stroke-width="1" marker-end="url(#${mkId})"/>`;
          // 라벨
          svg+=`<text x="${centerX+diamondW/2+8}" y="${fromCy-5}" font-size="10" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(e.label)}</text>`;
        }else{
          // 직선 연결 (예 분기 또는 일반)
          const sy=fp.y+fp.h+2;
          const ty=tp.y-2;
          svg+=`<line x1="${centerX}" y1="${sy}" x2="${centerX}" y2="${ty}" stroke="#000" stroke-width="1" marker-end="url(#${mkId})"/>`;
          if(e.label&&isYesLabel){
            svg+=`<text x="${centerX+8}" y="${(sy+ty)/2+4}" font-size="10" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(e.label)}</text>`;
          }else if(e.label){
            svg+=`<text x="${centerX+8}" y="${(sy+ty)/2+4}" font-size="10" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(e.label)}</text>`;
          }
        }
      });
    }else{
      // 에지 정보 없으면 순차 연결 (폴백)
      nodes.forEach((n,i)=>{
        if(i<nodes.length-1){
          const fp=nodePositions[n.id],tp=nodePositions[nodes[i+1].id];
          const sy=fp.y+fp.h+2;
          const ty=tp.y-2;
          svg+=`<line x1="${centerX}" y1="${sy}" x2="${centerX}" y2="${ty}" stroke="#000" stroke-width="1" marker-end="url(#${mkId})"/>`;
        }
      });
    }
    
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
  const boxH2=0.9*PX; // 도 2+ 내부 박스: 2줄(라벨+참조번호) 수용
  
  if(isFig1){
    // ═══ 도 1: 2D 토폴로지 블록도 v10.0 ═══
    // 렌더 순서: ①연결선 → ②Shape(위에 덮음) → ③참조번호(Shape 아래)
    const layout=computeDeviceLayout2D(nodes,edges);
    const{grid,maxCols,numRows,uniqueEdges}=layout;
    
    // 열 수에 따른 박스 크기 조정
    const colGap=0.55*PX; // v8.1: 증가 (0.4→0.55)
    const boxW2D=maxCols<=1?5.0*PX:maxCols===2?3.2*PX:2.4*PX;
    const maxNodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
    const marginX=0.6*PX; // v8.1: 증가 (0.5→0.6)
    const marginY=0.6*PX; // v8.1: 증가 (0.5→0.6)
    const refNumH=26; // v8.1: 증가 (24→26)
    const rowGapBase=0.55*PX; // v8.1: 증가 (0.4→0.55)
    
    // ★ 행별 실제 최대 Shape 높이 계산 (겹침 방지 핵심) ★
    const rowMaxH={};
    nodes.forEach(nd=>{
      const gp=grid[nd.id]; if(!gp)return;
      const st=matchIconShape(nd.label);
      const sm=_shapeMetrics(st,boxW2D,boxH);
      const h=sm.sh+refNumH; // Shape + 참조번호 공간
      if(!rowMaxH[gp.row]||h>rowMaxH[gp.row])rowMaxH[gp.row]=h;
    });
    
    // 행별 Y시작 좌표 (누적)
    const rowY={};
    let accY=marginY;
    for(let r=0;r<numRows;r++){
      rowY[r]=accY;
      accY+=(rowMaxH[r]||boxH+refNumH)+rowGapBase;
    }
    const totalH=accY-rowGapBase+marginY;
    
    const leaderMargin=0.5*PX;
    const svgW=marginX+maxNodeAreaW+leaderMargin;
    const svgH=totalH;
    const maxW=maxCols<=1?600:maxCols===2?750:900;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${maxW}px;background:white;border-radius:8px">`;
    const mkId=`ah_${containerId}`;
    svg+=`<defs><marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#000"/></marker></defs>`;
    
    // ── Phase 1: 위치 계산 (렌더링 전) ──
    const nodeBoxes={};
    const nodeData=[];
    nodes.forEach(nd=>{
      const gp=grid[nd.id];
      if(!gp)return;
      const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
      const rowStartX=marginX+(maxNodeAreaW-rowW)/2;
      const bx=rowStartX+gp.col*(boxW2D+colGap);
      const by=rowY[gp.row]; // ★ 행별 누적 Y좌표 사용 ★
      const refNum=extractRefNum(nd.label,String((parseInt(nd.id.replace(/\D/g,''))||1)*100));
      const cleanLabel=_safeCleanLabel(nd.label);
      const displayLabel=cleanLabel.length>(maxCols>1?10:16)?cleanLabel.slice(0,maxCols>1?8:14)+'…':cleanLabel;
      const shapeType=matchIconShape(nd.label);
      const sm=_shapeMetrics(shapeType,boxW2D,boxH);
      const sx=bx+sm.dx, sy=by;
      
      nodeBoxes[nd.id]={x:sx,y:sy,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:sy+sm.sh/2};
      nodeData.push({id:nd.id,sx,sy,sw:sm.sw,sh:sm.sh,shapeType,displayLabel,refNum,bx,boxW2D,row:grid[nd.id].row});
    });
    
    // ── Phase 1.5: 겹침 검증 & 자동 보정 ──
    // 모든 노드 쌍을 검사하여 Shape+참조번호 영역이 겹치면 하단 노드를 아래로 이동
    const REF_PADDING=refNumH+4; // Shape 아래 참조번호+여유
    const MIN_GAP=8; // 최소 간격(px)
    let correctionApplied=true;
    let correctionRounds=0;
    while(correctionApplied&&correctionRounds<10){
      correctionApplied=false;
      correctionRounds++;
      for(let i=0;i<nodeData.length;i++){
        const a=nodeData[i];
        const aBottom=a.sy+a.sh+REF_PADDING; // Shape 하단 + 참조번호
        for(let j=0;j<nodeData.length;j++){
          if(i===j)continue;
          const b=nodeData[j];
          // 수직 겹침: a의 하단이 b의 상단을 넘고, 수평으로도 겹침
          const hOverlap=!(a.sx+a.sw<b.sx||b.sx+b.sw<a.sx); // X축 겹침
          if(hOverlap&&b.sy<aBottom+MIN_GAP&&b.sy>=a.sy){
            // b가 a 아래에 있어야 하는데 겹침 → b를 아래로 이동
            const pushDown=aBottom+MIN_GAP-b.sy;
            if(pushDown>0){
              b.sy+=pushDown;
              nodeBoxes[b.id].y=b.sy;
              nodeBoxes[b.id].cy=b.sy+b.sh/2;
              correctionApplied=true;
            }
          }
        }
      }
    }
    
    // 보정 후 SVG 높이 재계산
    let maxBottom=0;
    nodeData.forEach(nd=>{
      const bottom=nd.sy+nd.sh+REF_PADDING+10;
      if(bottom>maxBottom)maxBottom=bottom;
    });
    const correctedSvgH=Math.max(svgH,maxBottom+marginY);
    // viewBox 업데이트
    svg=svg.replace(/viewBox="0 0 [^"]*"/,`viewBox="0 0 ${svgW} ${correctedSvgH}"`);
    
    // ── Phase 2: 연결선 (가장 먼저 렌더 → Shape 아래에 깔림) ──
    const svgEdgesToDraw=uniqueEdges.length>0?uniqueEdges:(nodes.length>1?nodes.slice(0,-1).map((nd,i)=>({from:nd.id,to:nodes[i+1].id})):[]);
    const svgFanCount={};
    const svgEdgeOff={};
    svgEdgesToDraw.forEach(e=>{
      ['from','to'].forEach(k=>{
        const nid=e[k];
        if(!svgFanCount[nid])svgFanCount[nid]=0;
        const key=e.from+'_'+e.to;
        if(!svgEdgeOff[key])svgEdgeOff[key]={};
        svgEdgeOff[key][k+'Idx']=svgFanCount[nid];
        svgFanCount[nid]++;
      });
    });
    svgEdgesToDraw.forEach(e=>{
      const fb=nodeBoxes[e.from], tb=nodeBoxes[e.to];
      if(!fb||!tb)return;
      const key=e.from+'_'+e.to;
      const fanF=svgFanCount[e.from]||1, fanT=svgFanCount[e.to]||1;
      const iF=svgEdgeOff[key]?.fromIdx||0, iT=svgEdgeOff[key]?.toIdx||0;
      const offF=fanF>1?(iF-((fanF-1)/2))*8:0;
      const offT=fanT>1?(iT-((fanT-1)/2))*8:0;
      const fbA={...fb,id:e.from,cx:fb.cx+offF};
      const tbA={...tb,id:e.to,cx:tb.cx+offT};
      const allBoxArr=Object.entries(nodeBoxes).map(([k,v])=>({...v,id:k}));
      const route=getOrthogonalRoute(fbA,tbA,allBoxArr);
      if(route)svg+=svgOrthogonalEdge(route,mkId);
    });
    
    // ── Phase 3: Shape + 지능형 참조번호 배치 (연결 방향 회피) ──
    // 3a. 각 노드의 연결 방향 분석
    const nodeConnDir={};
    nodeData.forEach(nd=>{nodeConnDir[nd.id]={top:false,bottom:false,left:false,right:false};});
    svgEdgesToDraw.forEach(e=>{
      const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];
      if(!fb||!tb)return;
      const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
      if(Math.abs(dy)>=Math.abs(dx)){
        // 수직 연결
        if(dy>0){nodeConnDir[e.from].bottom=true;nodeConnDir[e.to].top=true;}
        else{nodeConnDir[e.from].top=true;nodeConnDir[e.to].bottom=true;}
      }else{
        // 수평 연결
        if(dx>0){nodeConnDir[e.from].right=true;nodeConnDir[e.to].left=true;}
        else{nodeConnDir[e.from].left=true;nodeConnDir[e.to].right=true;}
      }
    });
    
    // 3b. Shape 렌더 + 참조번호를 연결 없는 쪽에 배치
    nodeData.forEach(nd=>{
      const{id,sx,sy,sw,sh,shapeType,displayLabel,refNum}=nd;
      svg+=_drawShapeShadow(shapeType,sx+SHADOW_OFFSET,sy+SHADOW_OFFSET,sw,sh);
      svg+=_drawShapeBody(shapeType,sx,sy,sw,sh,2);
      const textCy=_shapeTextCy(shapeType,sy,sh);
      const fontSize=maxCols>2?10:maxCols>1?11:12;
      const dir=nodeConnDir[id]||{};
      const refInside=dir.top&&dir.bottom&&dir.left&&dir.right;
      // 참조번호 내부 표시 시 라벨을 위로 올림
      const labelY=refInside?textCy-2:textCy+4;
      svg+=`<text x="${sx+sw/2}" y="${labelY}" text-anchor="middle" font-size="${fontSize}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
      
      // ★ 참조번호: 연결이 없는 쪽에 배치 (우선순위: 하단→우측→좌측→내부) ★
      let refSvg='';
      if(!dir.bottom){
        // 하단: 수직선 + 번호
        const ly=sy+sh, ly2=ly+8;
        refSvg=`<line x1="${sx+sw/2}" y1="${ly}" x2="${sx+sw/2}" y2="${ly2}" stroke="#000" stroke-width="1"/>`;
        refSvg+=`<text x="${sx+sw/2}" y="${ly2+11}" text-anchor="middle" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      }else if(!dir.right){
        // 우측: 수평선 + 번호
        const lx=sx+sw, lx2=lx+12;
        const ly=sy+sh/2;
        refSvg=`<line x1="${lx}" y1="${ly}" x2="${lx2}" y2="${ly}" stroke="#000" stroke-width="1"/>`;
        refSvg+=`<text x="${lx2+4}" y="${ly+4}" text-anchor="start" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      }else if(!dir.left){
        // 좌측: 수평선 + 번호
        const lx=sx, lx2=lx-12;
        const ly=sy+sh/2;
        refSvg=`<line x1="${lx}" y1="${ly}" x2="${lx2}" y2="${ly}" stroke="#000" stroke-width="1"/>`;
        refSvg+=`<text x="${lx2-4}" y="${ly+4}" text-anchor="end" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      }else{
        // 모든 방향 사용 중 → Shape 내부에 (참조번호) 표시
        refSvg=`<text x="${sx+sw/2}" y="${textCy+fontSize+4}" text-anchor="middle" font-size="${Math.max(fontSize-1,8)}" font-family="맑은 고딕,Arial,sans-serif" fill="#444">(${refNum})</text>`;
      }
      svg+=refSvg;
    });
    
    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
  } else {
    // ═══ 도 2+: 객체 기반 충돌 방지 레이아웃 v8.0 ═══
    
    // ★ 프레임 자신 + 다른 L1 노드 모두 제외 (L1끼리 프레임 안에 포함 방지) ★
    const innerNodes=nodes.filter(n=>{
      const ref=extractRefNum(n.label,'');
      if(!ref)return true;
      const refNum=parseInt(ref);
      if(refNum===frameRefNum)return false; // 프레임 자신
      if(isL1RefNum(ref))return false; // 다른 L1 노드 (200, 300 등)
      return true;
    });
    const frameNode=nodes.find(n=>{
      const ref=extractRefNum(n.label,'');
      return ref&&parseInt(ref)===frameRefNum;
    });
    const frameLabel=frameNode?frameNode.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim():'';
    const displayNodes=innerNodes.length>0?innerNodes:nodes;
    
    // 내부 노드 2D 레이아웃 계산
    const innerLayout=computeDeviceLayout2D(displayNodes,edges);
    const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;
    
    // ═══ v8.1: 공통 레이아웃 엔진 호출 (여백 확대) ═══
    const innerBoxW=innerMaxCols<=1?4.5*PX:innerMaxCols===2?2.8*PX:2.0*PX;
    const boxH2=0.9*PX;
    const fig2Layout=computeFig2Layout(displayNodes,edges,innerGrid,innerMaxCols,innerNumRows,innerUniqueEdges,frameRefNum,{
      boxBaseW:innerBoxW, boxBaseH:boxH2,
      colGap:0.75*PX,   // v8.1: 증가 (0.55→0.75) — 구성요소 간 수평 간격
      rowGap:0.9*PX,    // v8.1: 증가 (0.7→0.9) — 구성요소 간 수직 간격
      framePad:0.85*PX,  // v8.1: 증가 (0.65→0.85) — 프레임↔구성요소 여백
      shadowSize:SHADOW_OFFSET,
      scale:PX
    });
    
    const frameX=0.5*PX, frameY=0.5*PX;
    const frameW=fig2Layout.frameW;
    const frameH=fig2Layout.frameH;
    const leaderMargin=0.8*PX;
    const svgW=frameX+frameW+leaderMargin;
    const svgH=frameY+frameH+0.5*PX;
    const maxW=innerMaxCols<=1?600:innerMaxCols===2?750:900;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${maxW}px;background:white;border-radius:8px">`;
    const mkId=`ah_${containerId}`;
    svg+=`<defs><marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#000"/></marker></defs>`;
    
    // 1. 최외곽 프레임 (그림자 + 본체)
    svg+=`<rect x="${frameX+SHADOW_OFFSET}" y="${frameY+SHADOW_OFFSET}" width="${frameW}" height="${frameH}" fill="#000" opacity="0.15"/>`;
    svg+=`<rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="#fff" stroke="#000" stroke-width="2.25"/>`;
    
    // 2. 내부 노드 렌더링 — 레이아웃 엔진에서 계산된 좌표 사용
    const innerNodeBoxes={};
    fig2Layout.objects.forEach(obj=>{
      const bx=frameX+obj.x;
      const by=frameY+obj.y;
      const nd=displayNodes.find(n=>n.id===obj.id);
      if(!nd)return;
      const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
      const shapeType=matchIconShape(nd.label);
      const sm=_shapeMetrics(shapeType,obj.w,obj.h);
      const sx=bx+(obj.w-sm.sw)/2, sy=by;
      
      svg+=_drawShapeShadow(shapeType,sx+SHADOW_OFFSET,sy+SHADOW_OFFSET,sm.sw,sm.sh);
      svg+=_drawShapeBody(shapeType,sx,sy,sm.sw,sm.sh,1.5);
      const cleanLabel=_safeCleanLabel(nd.label);
      const displayLabel=cleanLabel.length>(innerMaxCols>1?10:16)?cleanLabel.slice(0,innerMaxCols>1?8:14)+'…':cleanLabel;
      const textCy=_shapeTextCy(shapeType,sy,sm.sh);
      const fontSize=innerMaxCols>2?9:innerMaxCols>1?10:11;
      
      // 박스 내부 2줄: 라벨 + (참조번호)
      svg+=`<text x="${sx+sm.sw/2}" y="${textCy-2}" text-anchor="middle" font-size="${fontSize}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
      svg+=`<text x="${sx+sm.sw/2}" y="${textCy+fontSize+2}" text-anchor="middle" font-size="${Math.max(fontSize-1,8)}" font-family="맑은 고딕,Arial,sans-serif" fill="#444">(${refNum})</text>`;
      
      innerNodeBoxes[nd.id]={x:sx,y:sy,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:sy+sm.sh/2};
    });
    
    // 3. 프레임 참조번호 외부 리더라인
    const frameLeaderEndX=frameX+frameW+0.3*PX;
    const frameLeaderY=frameY+frameH/2;
    svg+=`<line x1="${frameX+frameW}" y1="${frameLeaderY}" x2="${frameLeaderEndX}" y2="${frameLeaderY}" stroke="#000" stroke-width="1"/>`;
    svg+=`<text x="${frameLeaderEndX+8}" y="${frameLeaderY+4}" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${frameRefNum}</text>`;
    
    // 4. 직각 라우팅 edge 기반 연결선
    const innerEdgesToDraw2=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
    const svg2FanCount={};const svg2EdgeOff={};
    innerEdgesToDraw2.forEach(e=>{
      ['from','to'].forEach(k=>{const nid=e[k];if(!svg2FanCount[nid])svg2FanCount[nid]=0;const key=e.from+'_'+e.to;if(!svg2EdgeOff[key])svg2EdgeOff[key]={};svg2EdgeOff[key][k+'Idx']=svg2FanCount[nid];svg2FanCount[nid]++;});
    });
    innerEdgesToDraw2.forEach(e=>{
      const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
      if(!fb||!tb)return;
      const key=e.from+'_'+e.to;
      const fanF=svg2FanCount[e.from]||1,fanT=svg2FanCount[e.to]||1;
      const iF=svg2EdgeOff[key]?.fromIdx||0,iT=svg2EdgeOff[key]?.toIdx||0;
      const offF=fanF>1?(iF-((fanF-1)/2))*8:0;
      const offT=fanT>1?(iT-((fanT-1)/2))*8:0;
      const fbA={...fb,id:e.from,cx:fb.cx+offF};const tbA={...tb,id:e.to,cx:tb.cx+offT};
      const allBoxArr=Object.entries(innerNodeBoxes).map(([k,v])=>({...v,id:k}));
      const route=getOrthogonalRoute(fbA,tbA,allBoxArr);
      if(route)svg+=svgOrthogonalEdge(route,mkId);
    });
    
    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
  }
}

// ═══ 도면 규칙 검증 함수 (v5.0 - 통합 검증) ═══
function validateDiagramRules(nodes,figNum,designText,edges){
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
  
  // ═══ R9. 배치 적절성 검증 (2D 레이아웃 품질) ═══
  if(!isMethodFig&&nodes.length>=3){
    const edgeList=edges||[];
    
    // R9a. 도 1에서 edge 없으면 세로 일렬 폴백 경고
    if(figNum===1&&nodes.length>=4&&edgeList.length===0){
      issues.push({severity:'WARNING',rule:'R9a',message:`도 ${figNum}: 연결관계(edge) 없음 — 구성요소가 세로 일렬 배치됨. Mermaid에서 A --> B 연결 추가 권장`});
    }
    
    // R9b. 허브 노드 감지 (degree ≥ 3) → 2D 배치 적용 안내
    if(edgeList.length>0){
      const adj={};
      nodes.forEach(n=>{adj[n.id]=0;});
      edgeList.forEach(e=>{if(adj[e.from]!==undefined)adj[e.from]++;if(adj[e.to]!==undefined)adj[e.to]++;});
      const hubNodes=Object.entries(adj).filter(([,deg])=>deg>=3);
      if(hubNodes.length>0&&figNum===1){
        const hubLabels=hubNodes.map(([id])=>{const nd=nodes.find(n=>n.id===id);return nd?_safeCleanLabel(nd.label):id;});
        issues.push({severity:'INFO',rule:'R9b',message:`도 ${figNum}: 허브 노드(${hubLabels.join(',')}) 감지 → BFS 기반 2D 배치 적용`});
      }
    }
    
    // R9c. 네트워크/통신 노드 중앙 허브 배치 확인
    const networkNodes=nodes.filter(n=>/네트워크|통신망|인터넷|클라우드/.test(n.label));
    if(networkNodes.length>0&&figNum===1){
      issues.push({severity:'INFO',rule:'R9c',message:`도 ${figNum}: 네트워크 노드(${networkNodes.length}개) 존재 → 허브 중심 배치 활성`});
    }
    
    // R9d. 순차 연결만 있는 경우 (A→B→C→D) 세로 배치 적절
    if(edgeList.length===nodes.length-1&&figNum===1){
      const adj2={};nodes.forEach(n=>{adj2[n.id]=0;});
      edgeList.forEach(e=>{if(adj2[e.from]!==undefined)adj2[e.from]++;if(adj2[e.to]!==undefined)adj2[e.to]++;});
      const maxDeg=Math.max(...Object.values(adj2));
      if(maxDeg<=2){
        issues.push({severity:'INFO',rule:'R9d',message:`도 ${figNum}: 순차 연결 토폴로지 → 세로 배치 적용 (적절)`});
      }
    }
    
    // R10. 도면 품질 검증
    // R10a. 도 2+ 내부 구성요소 수 검증 (최소 3개 권장)
    if(figNum>1){
      const allRefs=nodes.map(n=>{const m=n.label.match(/[(\s]?(\d+)[)\s]?$/);return m?parseInt(m[1]):0;}).filter(r=>r>0);
      const l1Refs=allRefs.filter(r=>r%100===0);
      const innerCount=allRefs.length-l1Refs.length;
      if(innerCount>0&&innerCount<3){
        issues.push({severity:'WARNING',rule:'R10a',message:`도 ${figNum}: 내부 구성요소 ${innerCount}개 — 최소 3개 이상 권장 (도면이 빈약함)`});
      }
    }
    
    // R10b. 같은 행에 4개 이상 노드 검증
    if(edgeList.length>0){
      const layout=computeDeviceLayout2D(nodes,edgeList);
      if(layout.layers){
        layout.layers.forEach((layer,rowIdx)=>{
          if(layer.length>3){
            issues.push({severity:'WARNING',rule:'R10b',message:`도 ${figNum}: 행${rowIdx+1}에 ${layer.length}개 노드 — 최대 3개 권장 (겹침 위험)`});
          }
        });
      }
    }
  }
  
  return issues;
}

// ═══ 렌더링 후 시각 검증 (새 기능) ═══
function postRenderValidation(sid){
  const data=diagramData[sid];
  if(!data||!data.length)return[];
  
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  const allIssues=[];
  
  data.forEach(({nodes,edges},idx)=>{
    const figNum=figOffset+idx+1;
    const numRefs=nodes.map(n=>{
      const m=(n.label||'').match(/[(\s]?(S?\d+)[)\s]?$/i);
      return m?parseInt(m[1]):null;
    }).filter(n=>n!==null&&!isNaN(n));
    
    const l1s=numRefs.filter(n=>n%100===0);
    const nonL1=numRefs.filter(n=>n%100!==0);
    
    // 검증 V1: L1이 최외곽이 되는 경우, 내부에 L1이 중복 표시되면 안 됨
    if(figNum>1&&l1s.length>1){
      allIssues.push({
        figNum,severity:'WARN',
        message:`도 ${figNum}: L1 노드 ${l1s.length}개 감지(${l1s.join(',')}). 프레임 1개만 사용, 나머지 L1은 내부 표시에서 제외됨`
      });
    }
    
    // 검증 V2: 도 1에 L2/L3가 있으면 안 됨
    if(figNum===1&&nonL1.length>0){
      allIssues.push({
        figNum,severity:'ERROR',
        message:`도 1에 L2/L3 참조번호(${nonL1.join(',')}) 포함`
      });
    }
    
    // 검증 V3: 너무 짧은 라벨 (노드 ID일 가능성)
    nodes.forEach(n=>{
      const cleaned=_safeCleanLabel(n.label||'');
      if(cleaned.length<=2&&!/\d/.test(cleaned)){
        allIssues.push({
          figNum,severity:'WARN',
          message:`도 ${figNum}: 노드 "${n.id}" 라벨이 너무 짧음 ("${cleaned}") — 노드 ID가 라벨로 사용되었을 수 있음`
        });
      }
    });
    
    // 검증 V4: 중복 참조번호
    const refCounts={};
    numRefs.forEach(r=>{refCounts[r]=(refCounts[r]||0)+1;});
    Object.entries(refCounts).forEach(([ref,cnt])=>{
      if(cnt>1){
        allIssues.push({
          figNum,severity:'WARN',
          message:`도 ${figNum}: 참조번호 ${ref}이(가) ${cnt}개 노드에 중복 사용됨`
        });
      }
    });
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
    const issues=validateDiagramRules(nodes,figNum,designText,edges);
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
  
  data.forEach(({nodes,edges},idx)=>{
    const figNum=figOffset+idx+1;
    const issues=validateDiagramRules(nodes,figNum,designText,edges);
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
      const clean=_safeCleanLabel(n.label);
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
1. **데이터/정보 도면**: 정보 항목(~정보, ~데이터)은 ${getDeviceSubject()}로 입력되는 것이므로 상호 간 화살표 연결이 부적절함. 병렬 배치가 적절.
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
    
    // ═══ PPTX Icon Shape Helper ═══
    function addPptxIconShape(slide,type,x,y,w,h,lineW){
      const SO=SHADOW_OFFSET;
      switch(type){
        case 'database':{
          const shp=pptx.shapes.CAN||pptx.shapes.RECTANGLE;
          slide.addShape(shp,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(shp,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        case 'cloud':{
          const shp=pptx.shapes.CLOUD||pptx.shapes.OVAL;
          slide.addShape(shp,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(shp,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        case 'server':{
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          const h3=h/3;
          slide.addShape(pptx.shapes.LINE,{x,y:y+h3,w,h:0,line:{color:'000000',width:lineW*0.5}});
          slide.addShape(pptx.shapes.LINE,{x,y:y+2*h3,w,h:0,line:{color:'000000',width:lineW*0.5}});
          [0.5,1.5,2.5].forEach(m=>{
            slide.addShape(pptx.shapes.OVAL,{x:x+w-0.15,y:y+h3*m-0.04,w:0.08,h:0.08,fill:{color:'000000'},line:{width:0}});
          });
          break;
        }
        case 'monitor':{
          const sh=h*0.75;
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+SO,y:y+SO,w,h:sh,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x,y,w,h:sh,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW},rectRadius:2});
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+w/2-w*0.06,y:y+sh,w:w*0.12,h:h*0.15,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW*0.5}});
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+w/2-w*0.13,y:y+sh+h*0.15,w:w*0.26,h:h*0.05,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW*0.5}});
          break;
        }
        case 'sensor':{
          // Circle body + simplified arc representation
          const cr=Math.min(w*0.28,h*0.38);
          const cx=x+w*0.32-cr, cy=y+h*0.50-cr;
          slide.addShape(pptx.shapes.OVAL,{x:cx+SO,y:cy+SO,w:cr*2,h:cr*2,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.OVAL,{x:cx,y:cy,w:cr*2,h:cr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          // Inner dot
          const dr=cr*0.25;
          slide.addShape(pptx.shapes.OVAL,{x:x+w*0.32-dr,y:y+h*0.50-dr,w:dr*2,h:dr*2,fill:{color:'000000'},line:{width:0}});
          // Wave arcs (approximate with thin ovals)
          [1.55,2.10,2.65].forEach(m=>{
            const ar=cr*m;
            slide.addShape(pptx.shapes.ARC||pptx.shapes.OVAL,{x:x+w*0.32-ar,y:y+h*0.50-ar,w:ar*2,h:ar*2,fill:{type:'none'},line:{color:'000000',width:lineW*0.5}});
          });
          break;
        }
        case 'antenna':{
          // Pole + base + top ball (simplified)
          const poleX=x+w*0.38;
          const bw=w*0.22,bh=h*0.10;
          // Base
          slide.addShape(pptx.shapes.RECTANGLE,{x:poleX-bw/2,y:y+h*0.82,w:bw,h:bh,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          // Pole
          slide.addShape(pptx.shapes.LINE,{x:poleX,y:y+h*0.18,w:0,h:h*0.64,line:{color:'000000',width:lineW*1.2}});
          // Top ball
          const br=Math.min(w*0.04,h*0.04);
          slide.addShape(pptx.shapes.OVAL,{x:poleX-br,y:y+h*0.18-br,w:br*2,h:br*2,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        case 'document':{
          // Page with folded corner (simplified as rectangle)
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          // Fold triangle (approximate with small rectangle at corner)
          const fold=w*0.22;
          slide.addShape(pptx.shapes.RIGHT_TRIANGLE||pptx.shapes.RECTANGLE,{x:x+w-fold,y:y,w:fold,h:fold,fill:{color:'EEEEEE'},line:{color:'000000',width:lineW*0.5},rotate:90});
          break;
        }
        case 'camera':{
          // Camera body + lens (simplified)
          const cbx=x+w*0.05,cby=y+h*0.18,cbw=w*0.80,cbh=h*0.65;
          slide.addShape(pptx.shapes.RECTANGLE,{x:cbx+SO,y:cby+SO,w:cbw,h:cbh,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x:cbx,y:cby,w:cbw,h:cbh,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW},rectRadius:3});
          // Viewfinder
          slide.addShape(pptx.shapes.RECTANGLE,{x:cbx+cbw*0.30,y:cby-h*0.10,w:cbw*0.25,h:h*0.12,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW*0.6}});
          // Lens
          const lr=Math.min(cbw,cbh)*0.30;
          slide.addShape(pptx.shapes.OVAL,{x:cbx+cbw*0.50-lr,y:cby+cbh*0.52-lr,w:lr*2,h:lr*2,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        case 'speaker':{
          // Speaker (simplified as rectangles + small driver)
          const sph=h*0.40, spw=w*0.18;
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+w*0.10,y:y+h*0.30,w:spw,h:sph,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          // Cone (larger rect)
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+w*0.28,y:y+h*0.12,w:w*0.28,h:h*0.76,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
          break;
        }
        default:
          slide.addShape(pptx.shapes.RECTANGLE,{x:x+SO,y:y+SO,w,h,fill:{color:'000000'},line:{width:0}});
          slide.addShape(pptx.shapes.RECTANGLE,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'000000',width:lineW}});
      }
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
          const cleanLabel=_safeCleanLabel(n.label);
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
        // ═══ 도 1: 2D 토폴로지 블록도 v13.0 (행별 높이 기반 겹침 방지) ═══
        const layout=computeDeviceLayout2D(nodes,edges);
        const{grid,maxCols,numRows,uniqueEdges}=layout;
        const colGap=0.35;
        const boxW2D=maxCols<=1?PAGE_W-2.0:maxCols===2?(PAGE_W-2.0-colGap)/2:(PAGE_W-2.0-colGap*2)/3;
        const nodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
        const marginX=PAGE_MARGIN+0.3;
        const boxStartY=PAGE_MARGIN+TITLE_H+0.2;
        const boxH=Math.min(0.55,(AVAILABLE_H-0.15*(numRows-1))/numRows);
        const refNumH=0.25;
        const rowGapBase=0.25;
        
        // ★ 행별 최대 Shape 높이 → 누적 Y좌표 ★
        const rowMaxH={};
        nodes.forEach(n=>{const gp=grid[n.id];if(!gp)return;const sm=_shapeMetrics(matchIconShape(n.label),boxW2D,boxH);const h=sm.sh+refNumH;if(!rowMaxH[gp.row]||h>rowMaxH[gp.row])rowMaxH[gp.row]=h;});
        const rowY={};let accY=boxStartY;
        for(let r=0;r<numRows;r++){rowY[r]=accY;accY+=(rowMaxH[r]||boxH+refNumH)+rowGapBase;}
        
        const nodeBoxes={};
        nodes.forEach(n=>{
          const gp=grid[n.id];
          if(!gp)return;
          const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
          const rowStartX=marginX+(nodeAreaW-rowW)/2;
          const bx=rowStartX+gp.col*(boxW2D+colGap);
          const by=rowY[gp.row]; // ★ 행별 누적 Y좌표 ★
          const refNum=extractRefNum(n.label,String((parseInt(n.id.replace(/\D/g,''))||1)*100));
          const cleanLabel=_safeCleanLabel(n.label);
          const shapeType=matchIconShape(n.label);
          const sm=_shapeMetrics(shapeType,boxW2D,boxH);
          const sx=bx+sm.dx;
          
          addPptxIconShape(slide,shapeType,sx,by,sm.sw,sm.sh,LINE_FRAME);
          const textH=shapeType==='monitor'?sm.sh*0.72:sm.sh;
          const fontSize=Math.min(maxCols>1?10:12,Math.max(8,13-nodeCount*0.3));
          slide.addText(cleanLabel,{x:sx+0.04,y:by,w:sm.sw-0.08,h:textH,fontSize,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          
          nodeBoxes[n.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2};
        });
        
        // refNum 데이터 수집 (edge 분석 후 배치)
        const pptxRefData=[];
        nodes.forEach(n=>{
          const gp=grid[n.id];if(!gp)return;
          const refNum=extractRefNum(n.label,String((parseInt(n.id.replace(/\D/g,''))||1)*100));
          const nb=nodeBoxes[n.id];if(!nb)return;
          pptxRefData.push({id:n.id,refNum,sx:nb.x,by:nb.y,sw:nb.w,sh:nb.h});
        });
        
        // Phase 2: Edge 연결선 (직각 라우팅 + fan 오프셋)
        const edgesToDraw=uniqueEdges.length>0?uniqueEdges:nodes.slice(0,-1).map((n,i)=>({from:n.id,to:nodes[i+1].id}));
        const pptxFanCount={};
        const pptxEdgeOffsets={};
        edgesToDraw.forEach(e=>{
          ['from','to'].forEach(k=>{
            const nid=e[k];
            if(!pptxFanCount[nid])pptxFanCount[nid]=0;
            if(!pptxEdgeOffsets[e.from+'_'+e.to])pptxEdgeOffsets[e.from+'_'+e.to]={};
            pptxEdgeOffsets[e.from+'_'+e.to][k+'Idx']=pptxFanCount[nid];
            pptxFanCount[nid]++;
          });
        });
        
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];
          if(!fb||!tb)return;
          const fanFrom=pptxFanCount[e.from]||1;
          const idxFrom=pptxEdgeOffsets[e.from+'_'+e.to]?.fromIdx||0;
          const offsetFrom=fanFrom>1?(idxFrom-((fanFrom-1)/2))*0.08:0;
          const fanTo=pptxFanCount[e.to]||1;
          const idxTo=pptxEdgeOffsets[e.from+'_'+e.to]?.toIdx||0;
          const offsetTo=fanTo>1?(idxTo-((fanTo-1)/2))*0.08:0;
          
          const fbA={...fb,cx:fb.cx+offsetFrom};
          const tbA={...tb,cx:tb.cx+offsetTo};
          const pts=getConnectionPoints(fbA,tbA);
          if(!pts)return;
          const dx=pts.x2-pts.x1,dy=pts.y2-pts.y1;
          if(Math.abs(dx)<0.01){
            slide.addShape(pptx.shapes.LINE,{x:pts.x1,y:Math.min(pts.y1,pts.y2),w:0,h:Math.abs(dy),line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
          }else if(Math.abs(dy)<0.01){
            slide.addShape(pptx.shapes.LINE,{x:Math.min(pts.x1,pts.x2),y:pts.y1,w:Math.abs(dx),h:0,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
          }else{
            const midY=(pts.y1+pts.y2)/2;
            slide.addShape(pptx.shapes.LINE,{x:pts.x1,y:Math.min(pts.y1,midY),w:0,h:Math.abs(pts.y1-midY),line:{color:'000000',width:LINE_ARROW}});
            slide.addShape(pptx.shapes.LINE,{x:Math.min(pts.x1,pts.x2),y:midY,w:Math.abs(dx),h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addShape(pptx.shapes.LINE,{x:pts.x2,y:Math.min(midY,pts.y2),w:0,h:Math.abs(pts.y2-midY),line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
          }
        });
        
        // Phase 3: 지능형 참조번호 배치 (연결 방향 회피)
        const pNodeConnDir={};
        (pptxRefData||[]).forEach(r=>{pNodeConnDir[r.id]={top:false,bottom:false,left:false,right:false};});
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];if(!fb||!tb)return;
          const dx=tb.cx-fb.cx,dy=tb.cy-fb.cy;
          if(Math.abs(dy)>=Math.abs(dx)){
            if(dy>0){pNodeConnDir[e.from].bottom=true;pNodeConnDir[e.to].top=true;}
            else{pNodeConnDir[e.from].top=true;pNodeConnDir[e.to].bottom=true;}
          }else{
            if(dx>0){pNodeConnDir[e.from].right=true;pNodeConnDir[e.to].left=true;}
            else{pNodeConnDir[e.from].left=true;pNodeConnDir[e.to].right=true;}
          }
        });
        (pptxRefData||[]).forEach(r=>{
          const dir=pNodeConnDir[r.id]||{};
          if(!dir.bottom){
            slide.addShape(pptx.shapes.LINE,{x:r.sx+r.sw/2,y:r.by+r.sh,w:0,h:0.1,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:r.sx,y:r.by+r.sh+0.1,w:r.sw,h:0.2,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'top'});
          }else if(!dir.right){
            slide.addShape(pptx.shapes.LINE,{x:r.sx+r.sw,y:r.by+r.sh/2,w:0.12,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:r.sx+r.sw+0.12,y:r.by+r.sh/2-0.1,w:0.5,h:0.2,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          }else if(!dir.left){
            slide.addShape(pptx.shapes.LINE,{x:r.sx-0.12,y:r.by+r.sh/2,w:0.12,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:r.sx-0.62,y:r.by+r.sh/2-0.1,w:0.5,h:0.2,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'right',valign:'middle'});
          }else{
            // 모든 방향 사용 중 → 내부 표시는 slide.addText로 2줄
            slide.addText('('+r.refNum+')',{x:r.sx,y:r.by+r.sh*0.55,w:r.sw,h:0.2,fontSize:9,fontFace:'맑은 고딕',color:'444444',align:'center',valign:'top'});
          }
        });
      }else{
        // 도 2+: 공통 레이아웃 엔진 사용 (v8.0)
        
        const innerNodes=nodes.filter(n=>{
          const ref=extractRefNum(n.label,'');
          if(!ref)return true;
          if(parseInt(ref)===frameRefNum)return false;
          if(isL1RefNum(ref))return false;
          return true;
        });
        const displayNodes=innerNodes.length>0?innerNodes:nodes;
        const dCount=displayNodes.length;
        
        const innerLayout=computeDeviceLayout2D(displayNodes,edges);
        const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;
        const innerBoxW=innerMaxCols<=1?(PAGE_W-1.6):innerMaxCols===2?(PAGE_W-1.6-0.35)/2:(PAGE_W-1.6-0.35*2)/3;
        const pBoxH=Math.min(0.65,(AVAILABLE_H-0.7-0.30*(innerNumRows-1))/innerNumRows);
        
        const fig2L=computeFig2Layout(displayNodes,edges,innerGrid,innerMaxCols,innerNumRows,innerUniqueEdges,frameRefNum,{
          boxBaseW:innerBoxW, boxBaseH:pBoxH,
          colGap:0.45, rowGap:0.40, framePad:0.50,
          shadowSize:SHADOW_OFFSET, scale:1
        });
        
        const frameX=PAGE_MARGIN,frameY=PAGE_MARGIN+TITLE_H;
        const frameW=fig2L.frameW;
        const frameH=fig2L.frameH;
        const refLabelX=frameX+frameW+0.1;
        
        slide.addShape(pptx.shapes.RECTANGLE,{x:frameX+SHADOW_OFFSET,y:frameY+SHADOW_OFFSET,w:frameW,h:frameH,fill:{color:'000000'},line:{width:0}});
        slide.addShape(pptx.shapes.RECTANGLE,{x:frameX,y:frameY,w:frameW,h:frameH,fill:{color:'FFFFFF'},line:{color:'000000',width:LINE_FRAME}});
        
        const innerNodeBoxes={};
        fig2L.objects.forEach(obj=>{
          const bx=frameX+obj.x;
          const by=frameY+obj.y;
          const nd=displayNodes.find(n=>n.id===obj.id);
          if(!nd)return;
          const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
          const cleanLabel=_safeCleanLabel(nd.label);
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,obj.w,obj.h);
          const sx=bx+(obj.w-sm.sw)/2;
          
          addPptxIconShape(slide,shapeType,sx,by,sm.sw,sm.sh,LINE_BOX);
          const textH=shapeType==='monitor'?sm.sh*0.72:sm.sh;
          const fontSize=Math.min(innerMaxCols>1?9:11,Math.max(8,12-dCount*0.3));
          slide.addText([{text:cleanLabel,options:{fontSize,breakType:'none'}},{text:'\n('+refNum+')',options:{fontSize:Math.max(fontSize-1,7),color:'444444'}}],{x:sx+0.04,y:by,w:sm.sw-0.08,h:textH,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          
          innerNodeBoxes[nd.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2};
        });
        
        const frameLeaderY=frameY+frameH/2;
        slide.addShape(pptx.shapes.LINE,{x:frameX+frameW,y:frameLeaderY,w:0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
        slide.addText(String(frameRefNum),{x:refLabelX+0.3,y:frameLeaderY-0.12,w:0.5,h:0.24,fontSize:10,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
        
        // ★ Edge 기반 연결선 (fan 오프셋 겹침 방지) ★
        const innerEdgesToDraw=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
        const pInnerFan={};const pInnerOff={};
        innerEdgesToDraw.forEach(e=>{['from','to'].forEach(k=>{const nid=e[k];if(!pInnerFan[nid])pInnerFan[nid]=0;const key=e.from+'_'+e.to;if(!pInnerOff[key])pInnerOff[key]={};pInnerOff[key][k+'Idx']=pInnerFan[nid];pInnerFan[nid]++;});});
        innerEdgesToDraw.forEach(e=>{
          const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
          if(!fb||!tb)return;
          const key=e.from+'_'+e.to;
          const fanF=pInnerFan[e.from]||1,fanT=pInnerFan[e.to]||1;
          const iF=pInnerOff[key]?.fromIdx||0,iT=pInnerOff[key]?.toIdx||0;
          const offF=fanF>1?(iF-((fanF-1)/2))*0.08:0;
          const offT=fanT>1?(iT-((fanT-1)/2))*0.08:0;
          const fbA={...fb,cx:fb.cx+offF};const tbA={...tb,cx:tb.cx+offT};
          const pts=getConnectionPoints(fbA,tbA);
          if(!pts)return;
          const dx=pts.x2-pts.x1,dy=pts.y2-pts.y1;
          if(Math.abs(dx)<0.01){
            slide.addShape(pptx.shapes.LINE,{x:pts.x1,y:Math.min(pts.y1,pts.y2),w:0,h:Math.abs(dy),line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
          }else if(Math.abs(dy)<0.01){
            slide.addShape(pptx.shapes.LINE,{x:Math.min(pts.x1,pts.x2),y:pts.y1,w:Math.abs(dx),h:0,line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
          }else{
            const midY=(pts.y1+pts.y2)/2;
            slide.addShape(pptx.shapes.LINE,{x:pts.x1,y:Math.min(pts.y1,midY),w:0,h:Math.abs(pts.y1-midY),line:{color:'000000',width:LINE_ARROW}});
            slide.addShape(pptx.shapes.LINE,{x:Math.min(pts.x1,pts.x2),y:midY,w:Math.abs(dx),h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addShape(pptx.shapes.LINE,{x:pts.x2,y:Math.min(midY,pts.y2),w:0,h:Math.abs(pts.y2-midY),line:{color:'000000',width:LINE_ARROW,endArrowType:'triangle',beginArrowType:'triangle'}});
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
        // ═══ 방법 도면: 흐름도 (SVG와 동일 스타일) ═══
        const nodeCount=nodes.length;
        const normalBoxW=620;
        const startEndBoxW=248; // 620*0.4, matching SVG ratio 2.0/5.0
        const boxStartX=30,boxStartY=50;
        const centerX=boxStartX+normalBoxW/2; // 340
        const boxH=Math.min(55,(850-10*(nodeCount-1))/nodeCount);
        const boxGap=Math.min(40,(900-boxH*nodeCount)/(nodeCount>1?nodeCount-1:1));
        const SHADOW=3;
        
        nodes.forEach((n,i)=>{
          const refNum=extractRefNum(n.label,'');
          const cleanLabel=_safeCleanLabel(n.label);
          const isStartEnd=/시작|종료|START|END/i.test(n.label);
          
          // ★ 시작/종료는 축소 폭, 모든 박스 중앙 정렬 ★
          const curBoxW=isStartEnd?startEndBoxW:normalBoxW;
          const bx=centerX-curBoxW/2;
          const by=boxStartY+i*(boxH+boxGap);
          
          // 그림자 (시작/종료는 둥근 그림자)
          ctx.fillStyle='#000000';
          if(isStartEnd){
            const r=boxH/2;
            ctx.beginPath();
            ctx.moveTo(bx+SHADOW+r,by+SHADOW);ctx.lineTo(bx+SHADOW+curBoxW-r,by+SHADOW);ctx.quadraticCurveTo(bx+SHADOW+curBoxW,by+SHADOW,bx+SHADOW+curBoxW,by+SHADOW+r);
            ctx.lineTo(bx+SHADOW+curBoxW,by+SHADOW+boxH-r);ctx.quadraticCurveTo(bx+SHADOW+curBoxW,by+SHADOW+boxH,bx+SHADOW+curBoxW-r,by+SHADOW+boxH);
            ctx.lineTo(bx+SHADOW+r,by+SHADOW+boxH);ctx.quadraticCurveTo(bx+SHADOW,by+SHADOW+boxH,bx+SHADOW,by+SHADOW+boxH-r);
            ctx.lineTo(bx+SHADOW,by+SHADOW+r);ctx.quadraticCurveTo(bx+SHADOW,by+SHADOW,bx+SHADOW+r,by+SHADOW);
            ctx.closePath();ctx.fill();
          }else{
            ctx.fillRect(bx+SHADOW,by+SHADOW,curBoxW,boxH);
          }
          
          // ★ 시작/종료도 흰색 배경 (SVG와 일치) ★
          ctx.fillStyle='#FFFFFF';
          if(isStartEnd){
            const r=boxH/2;
            ctx.beginPath();
            ctx.moveTo(bx+r,by);ctx.lineTo(bx+curBoxW-r,by);ctx.quadraticCurveTo(bx+curBoxW,by,bx+curBoxW,by+r);
            ctx.lineTo(bx+curBoxW,by+boxH-r);ctx.quadraticCurveTo(bx+curBoxW,by+boxH,bx+curBoxW-r,by+boxH);
            ctx.lineTo(bx+r,by+boxH);ctx.quadraticCurveTo(bx,by+boxH,bx,by+boxH-r);
            ctx.lineTo(bx,by+r);ctx.quadraticCurveTo(bx,by,bx+r,by);
            ctx.closePath();ctx.fill();ctx.strokeStyle='#000000';ctx.lineWidth=2;ctx.stroke();
          }else{
            ctx.fillRect(bx,by,curBoxW,boxH);
            ctx.strokeStyle='#000000';ctx.lineWidth=1.5;ctx.strokeRect(bx,by,curBoxW,boxH);
          }
          
          ctx.fillStyle='#000000';
          ctx.font='13px "맑은 고딕", sans-serif';
          ctx.textAlign='center';
          ctx.fillText(cleanLabel,centerX,by+boxH/2+4);
          
          // 리더라인 + 부호 (시작/종료 제외)
          if(refNum&&!isStartEnd){
            const leaderEndX=boxStartX+normalBoxW+20;
            ctx.textAlign='left';
            ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(bx+curBoxW,by+boxH/2);ctx.lineTo(leaderEndX,by+boxH/2);ctx.stroke();
            ctx.font='11px "맑은 고딕", sans-serif';
            ctx.fillText(String(refNum),leaderEndX+10,by+boxH/2+4);
          }
          
          // ★ 단방향 화살표: 항상 중앙선 직선 ★
          if(i<nodes.length-1){
            const arrowY1=by+boxH+2,arrowY2=boxStartY+(i+1)*(boxH+boxGap)-2;
            if(arrowY2>arrowY1){
              ctx.beginPath();ctx.moveTo(centerX,arrowY1);ctx.lineTo(centerX,arrowY2);ctx.lineWidth=1;ctx.stroke();
              // 아래쪽 화살촉만 (단방향)
              ctx.beginPath();ctx.moveTo(centerX-4,arrowY2-8);ctx.lineTo(centerX,arrowY2);ctx.lineTo(centerX+4,arrowY2-8);ctx.stroke();
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
      const SHADOW=4; // SVG와 일치
      
      // ── Canvas Shape Drawing Helper ──
      function drawCanvasShape(ctx,type,x,y,w,h,shadowOff,strokeW){
        ctx.strokeStyle='#000000';
        switch(type){
          case 'database':{
            const ry=Math.min(h*0.18,w*0.15,22);
            // Shadow
            ctx.fillStyle='#000000';
            ctx.beginPath();ctx.ellipse(x+w/2+shadowOff,y+ry+shadowOff,w/2,ry,0,0,Math.PI*2);ctx.fill();
            ctx.fillRect(x+shadowOff,y+ry+shadowOff,w,h-2*ry);
            ctx.beginPath();ctx.ellipse(x+w/2+shadowOff,y+h-ry+shadowOff,w/2,ry,0,0,Math.PI*2);ctx.fill();
            // Body
            ctx.fillStyle='#FFFFFF';
            ctx.beginPath();ctx.ellipse(x+w/2,y+h-ry,w/2,ry,0,0,Math.PI*2);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            ctx.fillRect(x,y+ry,w,h-2*ry);
            ctx.beginPath();ctx.moveTo(x,y+ry);ctx.lineTo(x,y+h-ry);ctx.lineWidth=strokeW;ctx.stroke();
            ctx.beginPath();ctx.moveTo(x+w,y+ry);ctx.lineTo(x+w,y+h-ry);ctx.lineWidth=strokeW;ctx.stroke();
            ctx.beginPath();ctx.ellipse(x+w/2,y+ry,w/2,ry,0,0,Math.PI*2);ctx.fillStyle='#FFFFFF';ctx.fill();ctx.stroke();
            break;
          }
          case 'cloud':{
            function cloudPath(cx,cy,ox,oy){
              ctx.beginPath();
              ctx.moveTo(ox+w*0.2,oy+h*0.82);
              ctx.bezierCurveTo(ox+w*0.02,oy+h*0.84,ox,oy+h*0.44,ox+w*0.18,oy+h*0.36);
              ctx.bezierCurveTo(ox+w*0.1,oy+h*0.08,ox+w*0.35,oy,ox+w*0.48,oy+h*0.16);
              ctx.bezierCurveTo(ox+w*0.58,oy-h*0.01,ox+w*0.82,oy+h*0.06,ox+w*0.8,oy+h*0.34);
              ctx.bezierCurveTo(ox+w*0.98,oy+h*0.32,ox+w,oy+h*0.82,ox+w*0.8,oy+h*0.82);
              ctx.closePath();
            }
            // Shadow
            cloudPath(ctx,null,x+shadowOff,y+shadowOff);
            ctx.fillStyle='#000000';ctx.fill();
            // Body
            cloudPath(ctx,null,x,y);
            ctx.fillStyle='#FFFFFF';ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            break;
          }
          case 'server':{
            const h3=h/3,dotR=Math.min(3,h*0.07);
            // Shadow
            ctx.fillStyle='#000000';ctx.fillRect(x+shadowOff,y+shadowOff,w,h);
            // Body
            ctx.fillStyle='#FFFFFF';ctx.fillRect(x,y,w,h);ctx.lineWidth=strokeW;ctx.strokeRect(x,y,w,h);
            ctx.lineWidth=strokeW*0.55;
            ctx.beginPath();ctx.moveTo(x,y+h3);ctx.lineTo(x+w,y+h3);ctx.stroke();
            ctx.beginPath();ctx.moveTo(x,y+2*h3);ctx.lineTo(x+w,y+2*h3);ctx.stroke();
            [0.5,1.5,2.5].forEach(m=>{
              ctx.beginPath();ctx.arc(x+w-dotR*4,y+h3*m,dotR,0,Math.PI*2);ctx.fillStyle='#000000';ctx.fill();
            });
            break;
          }
          case 'monitor':{
            const sh=h*0.72,standW=w*0.12,standH=h*0.14,baseW=w*0.25,baseH=h*0.05;
            const sTop=y+sh+h*0.02,bTop=sTop+standH;
            // Shadow
            ctx.fillStyle='#000000';ctx.fillRect(x+shadowOff,y+shadowOff,w,sh);
            // Screen
            ctx.fillStyle='#FFFFFF';ctx.fillRect(x,y,w,sh);ctx.lineWidth=strokeW;ctx.strokeRect(x,y,w,sh);
            // Stand
            ctx.fillRect(x+w/2-standW/2,sTop,standW,standH);ctx.lineWidth=strokeW*0.6;ctx.strokeRect(x+w/2-standW/2,sTop,standW,standH);
            ctx.fillRect(x+w/2-baseW/2,bTop,baseW,baseH);ctx.strokeRect(x+w/2-baseW/2,bTop,baseW,baseH);
            break;
          }
          case 'sensor':{
            const cr=Math.min(w*0.28,h*0.38);
            const scx=x+w*0.32, scy=y+h*0.50;
            // Shadow
            ctx.fillStyle='#000000';ctx.beginPath();ctx.arc(scx+shadowOff,scy+shadowOff,cr,0,Math.PI*2);ctx.fill();
            // Circle body
            ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(scx,scy,cr,0,Math.PI*2);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Inner dot
            ctx.fillStyle='#000000';ctx.beginPath();ctx.arc(scx,scy,cr*0.25,0,Math.PI*2);ctx.fill();
            // Wave arcs
            ctx.lineWidth=strokeW*0.7;
            [1.55,2.10,2.65].forEach(m=>{
              const ar=cr*m;
              ctx.beginPath();ctx.arc(scx,scy,ar,-Math.PI*0.35,Math.PI*0.35);ctx.stroke();
            });
            break;
          }
          case 'antenna':{
            const poleX=x+w*0.38, topY=y+h*0.18, baseY=y+h*0.82;
            const baw=w*0.22, bah=h*0.10;
            const ballR=Math.min(w*0.04,h*0.04);
            // Base
            ctx.fillStyle='#FFFFFF';ctx.fillRect(poleX-baw/2,baseY,baw,bah);ctx.lineWidth=strokeW;ctx.strokeRect(poleX-baw/2,baseY,baw,bah);
            // Pole
            ctx.lineWidth=strokeW*1.2;ctx.beginPath();ctx.moveTo(poleX,topY+ballR);ctx.lineTo(poleX,baseY);ctx.stroke();
            // Top ball
            ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(poleX,topY,ballR,0,Math.PI*2);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Wave arcs
            ctx.lineWidth=strokeW*0.7;
            [0.16,0.26,0.36].forEach(m=>{
              const ar=h*m;
              ctx.beginPath();ctx.arc(poleX,topY,ar,-Math.PI*0.55,-Math.PI*0.05);ctx.stroke();
            });
            break;
          }
          case 'document':{
            const fold=w*0.22;
            // Shadow
            ctx.fillStyle='#000000';ctx.beginPath();
            ctx.moveTo(x+shadowOff,y+shadowOff);ctx.lineTo(x+w-fold+shadowOff,y+shadowOff);ctx.lineTo(x+w+shadowOff,y+fold+shadowOff);ctx.lineTo(x+w+shadowOff,y+h+shadowOff);ctx.lineTo(x+shadowOff,y+h+shadowOff);ctx.closePath();ctx.fill();
            // Body
            ctx.fillStyle='#FFFFFF';ctx.beginPath();
            ctx.moveTo(x,y);ctx.lineTo(x+w-fold,y);ctx.lineTo(x+w,y+fold);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Fold triangle
            ctx.fillStyle='#EEEEEE';ctx.beginPath();
            ctx.moveTo(x+w-fold,y);ctx.lineTo(x+w-fold,y+fold);ctx.lineTo(x+w,y+fold);ctx.closePath();ctx.fill();ctx.lineWidth=strokeW*0.6;ctx.stroke();
            // Text lines
            ctx.strokeStyle='#BBBBBB';ctx.lineWidth=strokeW*0.4;
            const lx1=x+w*0.15,lx2=x+w*0.75,ly0=y+h*0.30,gap=h*0.12;
            for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(lx1,ly0+gap*j);ctx.lineTo(lx2-(j===2?w*0.20:0),ly0+gap*j);ctx.stroke();}
            ctx.strokeStyle='#000000';
            break;
          }
          case 'camera':{
            const cbx=x+w*0.05,cby=y+h*0.18,cbw=w*0.80,cbh=h*0.65;
            const lensR=Math.min(cbw,cbh)*0.32;
            const lcx=cbx+cbw*0.50,lcy=cby+cbh*0.52;
            // Shadow
            ctx.fillStyle='#000000';ctx.fillRect(cbx+shadowOff,cby+shadowOff,cbw,cbh);
            // Body
            ctx.fillStyle='#FFFFFF';
            ctx.beginPath();ctx.roundRect(cbx,cby,cbw,cbh,[4]);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Viewfinder
            ctx.fillRect(cbx+cbw*0.30,cby-h*0.10,cbw*0.25,h*0.12);ctx.lineWidth=strokeW*0.7;ctx.strokeRect(cbx+cbw*0.30,cby-h*0.10,cbw*0.25,h*0.12);
            // Lens outer
            ctx.beginPath();ctx.arc(lcx,lcy,lensR,0,Math.PI*2);ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Lens inner
            ctx.beginPath();ctx.arc(lcx,lcy,lensR*0.55,0,Math.PI*2);ctx.lineWidth=strokeW*0.6;ctx.stroke();
            // Center dot
            ctx.fillStyle='#000000';ctx.beginPath();ctx.arc(lcx,lcy,lensR*0.15,0,Math.PI*2);ctx.fill();
            break;
          }
          case 'speaker':{
            // Speaker body
            ctx.fillStyle='#000000';ctx.beginPath();
            ctx.moveTo(x+w*0.10+shadowOff,y+h*0.30+shadowOff);ctx.lineTo(x+w*0.28+shadowOff,y+h*0.30+shadowOff);ctx.lineTo(x+w*0.55+shadowOff,y+h*0.08+shadowOff);ctx.lineTo(x+w*0.55+shadowOff,y+h*0.92+shadowOff);ctx.lineTo(x+w*0.28+shadowOff,y+h*0.70+shadowOff);ctx.lineTo(x+w*0.10+shadowOff,y+h*0.70+shadowOff);ctx.closePath();ctx.fill();
            // Body
            ctx.fillStyle='#FFFFFF';ctx.beginPath();
            ctx.moveTo(x+w*0.10,y+h*0.30);ctx.lineTo(x+w*0.28,y+h*0.30);ctx.lineTo(x+w*0.55,y+h*0.08);ctx.lineTo(x+w*0.55,y+h*0.92);ctx.lineTo(x+w*0.28,y+h*0.70);ctx.lineTo(x+w*0.10,y+h*0.70);ctx.closePath();ctx.fill();ctx.lineWidth=strokeW;ctx.stroke();
            // Divider
            ctx.beginPath();ctx.moveTo(x+w*0.28,y+h*0.30);ctx.lineTo(x+w*0.28,y+h*0.70);ctx.lineWidth=strokeW*0.6;ctx.stroke();
            // Wave arcs
            const wcx=x+w*0.55,wcy=y+h*0.50;
            ctx.lineWidth=strokeW*0.7;
            [0.22,0.34,0.46].forEach(m=>{const ar=h*m;ctx.beginPath();ctx.arc(wcx,wcy,ar,-Math.PI*0.30,Math.PI*0.30);ctx.stroke();});
            break;
          }
          default:
            ctx.fillStyle='#000000';ctx.fillRect(x+shadowOff,y+shadowOff,w,h);
            ctx.fillStyle='#FFFFFF';ctx.fillRect(x,y,w,h);ctx.lineWidth=strokeW;ctx.strokeRect(x,y,w,h);
        }
      }
      
      if(isFig1){
        // ═══ 도 1: 2D 토폴로지 v13.0 (행별 높이 기반 겹침 방지) ═══
        const layout=computeDeviceLayout2D(nodes,edges);
        const{grid,maxCols,numRows,uniqueEdges}=layout;
        const colGap=25;
        const boxW2D=maxCols<=1?520:maxCols===2?260:175;
        const nodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
        const marginX=30;
        const boxStartY=50;
        const boxH=Math.min(55,(850-10*(numRows-1))/numRows);
        const refNumH=22;
        const rowGapBase=25;
        
        // ★ 행별 최대 Shape 높이 → 누적 Y좌표 ★
        const rowMaxH={};
        nodes.forEach(nd=>{const gp=grid[nd.id];if(!gp)return;const sm=_shapeMetrics(matchIconShape(nd.label),boxW2D,boxH);const h=sm.sh+refNumH;if(!rowMaxH[gp.row]||h>rowMaxH[gp.row])rowMaxH[gp.row]=h;});
        const rowY={};let accY=boxStartY;
        for(let r=0;r<numRows;r++){rowY[r]=accY;accY+=(rowMaxH[r]||boxH+refNumH)+rowGapBase;}
        
        // Phase 1: 위치 계산만
        const nodeBoxes={};
        const nodeData=[];
        nodes.forEach(nd=>{
          const gp=grid[nd.id];if(!gp)return;
          const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
          const rowStartX=marginX+(nodeAreaW-rowW)/2;
          const bx=rowStartX+gp.col*(boxW2D+colGap);
          const by=rowY[gp.row]; // ★ 행별 누적 Y좌표 ★
          const refNum=extractRefNum(nd.label,String((parseInt(nd.id.replace(/\D/g,''))||1)*100));
          const cleanLabel=_safeCleanLabel(nd.label);
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,boxW2D,boxH);
          const sx=bx+sm.dx;
          nodeBoxes[nd.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2};
          nodeData.push({id:nd.id,sx,sy:by,sw:sm.sw,sh:sm.sh,shapeType,cleanLabel,refNum});
        });
        
        // ★ Phase 1.5: 겹침 검증 & 자동 보정 ★
        const REF_PAD=refNumH+4,MIN_GAP=6;
        let fixApplied=true,fixRounds=0;
        while(fixApplied&&fixRounds<10){fixApplied=false;fixRounds++;
          for(let i=0;i<nodeData.length;i++){const a=nodeData[i];const aBot=a.sy+a.sh+REF_PAD;
            for(let j=0;j<nodeData.length;j++){if(i===j)continue;const b=nodeData[j];
              const hOvl=!(a.sx+a.sw<b.sx||b.sx+b.sw<a.sx);
              if(hOvl&&b.sy<aBot+MIN_GAP&&b.sy>=a.sy){const push=aBot+MIN_GAP-b.sy;
                if(push>0){b.sy+=push;nodeBoxes[b.id].y=b.sy;nodeBoxes[b.id].cy=b.sy+b.sh/2;fixApplied=true;}}
        }}}
        
        // Phase 2: 연결선 먼저 (Shape 아래에 깔림)
        function drawCanvasOrthogonalEdge(ctx,fb,tb,aLen,allBoxArr){
          const route=getOrthogonalRoute(fb,tb,allBoxArr);
          if(!route||route.length<2)return;
          ctx.lineWidth=1;ctx.strokeStyle='#000000';
          ctx.beginPath();ctx.moveTo(route[0].x,route[0].y);
          for(let i=1;i<route.length;i++)ctx.lineTo(route[i].x,route[i].y);
          ctx.stroke();
          const al=aLen||6;
          [[route[route.length-1],route[route.length-2]],[route[0],route[1]]].forEach(([tip,prev])=>{
            const a=Math.atan2(tip.y-prev.y,tip.x-prev.x);
            ctx.beginPath();ctx.moveTo(tip.x,tip.y);
            ctx.lineTo(tip.x-al*Math.cos(a-0.4),tip.y-al*Math.sin(a-0.4));
            ctx.lineTo(tip.x-al*Math.cos(a+0.4),tip.y-al*Math.sin(a+0.4));
            ctx.closePath();ctx.fillStyle='#000000';ctx.fill();
          });
        }
        
        const edgesToDraw=uniqueEdges.length>0?uniqueEdges:nodes.slice(0,-1).map((n,i)=>({from:n.id,to:nodes[i+1].id}));
        const edgeOffsets={};const nodeFanCount={};
        edgesToDraw.forEach(e=>{['from','to'].forEach(k=>{
          const nid=e[k];if(!nodeFanCount[nid])nodeFanCount[nid]=0;
          if(!edgeOffsets[e.from+'_'+e.to])edgeOffsets[e.from+'_'+e.to]={};
          edgeOffsets[e.from+'_'+e.to][k+'Idx']=nodeFanCount[nid];nodeFanCount[nid]++;
        });});
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];if(!fb||!tb)return;
          const fanFrom=nodeFanCount[e.from]||1,fanTo=nodeFanCount[e.to]||1;
          const idxFrom=edgeOffsets[e.from+'_'+e.to]?.fromIdx||0;
          const idxTo=edgeOffsets[e.from+'_'+e.to]?.toIdx||0;
          const offsetFrom=fanFrom>1?(idxFrom-((fanFrom-1)/2))*8:0;
          const offsetTo=fanTo>1?(idxTo-((fanTo-1)/2))*8:0;
          const fbAdj={...fb,id:e.from,cx:fb.cx+offsetFrom};
          const tbAdj={...tb,id:e.to,cx:tb.cx+offsetTo};
          const allBoxArr=Object.entries(nodeBoxes).map(([k,v])=>({...v,id:k}));
          drawCanvasOrthogonalEdge(ctx,fbAdj,tbAdj,6,allBoxArr);
        });
        
        // Phase 3: Shape + 지능형 참조번호 배치 (연결 방향 회피)
        // 3a. 연결 방향 분석
        const nodeConnDir={};
        nodeData.forEach(nd=>{nodeConnDir[nd.id]={top:false,bottom:false,left:false,right:false};});
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];if(!fb||!tb)return;
          const dx=tb.cx-fb.cx,dy=tb.cy-fb.cy;
          if(Math.abs(dy)>=Math.abs(dx)){
            if(dy>0){nodeConnDir[e.from].bottom=true;nodeConnDir[e.to].top=true;}
            else{nodeConnDir[e.from].top=true;nodeConnDir[e.to].bottom=true;}
          }else{
            if(dx>0){nodeConnDir[e.from].right=true;nodeConnDir[e.to].left=true;}
            else{nodeConnDir[e.from].left=true;nodeConnDir[e.to].right=true;}
          }
        });
        // 3b. Shape + 참조번호
        nodeData.forEach(nd=>{
          const{id,sx,sy,sw,sh,shapeType,cleanLabel,refNum}=nd;
          drawCanvasShape(ctx,shapeType,sx,sy,sw,sh,SHADOW,2);
          const displayLabel=cleanLabel.length>(maxCols>1?10:16)?cleanLabel.slice(0,maxCols>1?8:14)+'…':cleanLabel;
          const fontSize=maxCols>2?10:maxCols>1?11:12;
          ctx.fillStyle='#000000';ctx.font=`${fontSize}px "맑은 고딕", sans-serif`;
          ctx.textAlign='center';ctx.textBaseline='middle';
          const cDir=nodeConnDir[id]||{};
          const cRefInside=cDir.top&&cDir.bottom&&cDir.left&&cDir.right;
          ctx.fillText(displayLabel,sx+sw/2,cRefInside?_shapeTextCy(shapeType,sy,sh)-4:_shapeTextCy(shapeType,sy,sh));
          // ★ 참조번호: 연결 없는 쪽에 배치 ★
          const dir=nodeConnDir[id]||{};
          ctx.strokeStyle='#000000';ctx.lineWidth=1;ctx.font='11px "맑은 고딕", sans-serif';
          if(!dir.bottom){
            ctx.beginPath();ctx.moveTo(sx+sw/2,sy+sh);ctx.lineTo(sx+sw/2,sy+sh+8);ctx.stroke();
            ctx.fillText(String(refNum),sx+sw/2,sy+sh+20);
          }else if(!dir.right){
            ctx.beginPath();ctx.moveTo(sx+sw,sy+sh/2);ctx.lineTo(sx+sw+12,sy+sh/2);ctx.stroke();
            ctx.textAlign='left';ctx.fillText(String(refNum),sx+sw+14,sy+sh/2+1);
          }else if(!dir.left){
            ctx.beginPath();ctx.moveTo(sx,sy+sh/2);ctx.lineTo(sx-12,sy+sh/2);ctx.stroke();
            ctx.textAlign='right';ctx.fillText(String(refNum),sx-14,sy+sh/2+1);
          }else{
            // 모든 방향 사용 중 → Shape 내부에 (참조번호) 표시
            ctx.fillStyle='#444444';ctx.font=`${Math.max(fontSize-1,8)}px "맑은 고딕", sans-serif`;
            ctx.fillText('('+refNum+')',sx+sw/2,_shapeTextCy(shapeType,sy,sh)+fontSize+2);
          }
          ctx.textAlign='left';ctx.textBaseline='alphabetic';
        });
      }else{
        // ═══ 도 2+: 공통 레이아웃 엔진 사용 (v8.0) ═══
        
        const innerNodes=nodes.filter(n=>{
          const ref=extractRefNum(n.label,'');
          if(!ref)return true;
          if(parseInt(ref)===frameRefNum)return false;
          if(isL1RefNum(ref))return false;
          return true;
        });
        const displayNodes=innerNodes.length>0?innerNodes:nodes;
        
        const innerLayout=computeDeviceLayout2D(displayNodes,edges);
        const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;

        const SHADOW_PX=2;
        const LEADER_W=35, REF_LABEL_W=50;
        const cInnerBoxW=innerMaxCols<=1?350:innerMaxCols===2?210:155;
        const cBoxH=Math.min(55,Math.max(40,(750-60)/Math.max(innerNumRows,1)));
        
        const fig2L=computeFig2Layout(displayNodes,edges,innerGrid,innerMaxCols,innerNumRows,innerUniqueEdges,frameRefNum,{
          boxBaseW:cInnerBoxW, boxBaseH:cBoxH,
          colGap:50, rowGap:50, framePad:55,
          shadowSize:SHADOW_PX, scale:1
        });
        
        const frameX=30, frameY=50;
        const frameW=fig2L.frameW;
        const frameH=fig2L.frameH;

        // 프레임 렌더링
        ctx.fillStyle='#000000';ctx.fillRect(frameX+SHADOW_PX,frameY+SHADOW_PX,frameW,frameH);
        ctx.fillStyle='#FFFFFF';ctx.fillRect(frameX,frameY,frameW,frameH);
        ctx.strokeStyle='#000000';ctx.lineWidth=2.25;ctx.strokeRect(frameX,frameY,frameW,frameH);
        
        // 연결선 (박스 아래 레이어)
        const innerNodeBoxes={};
        fig2L.objects.forEach(obj=>{
          const bx=frameX+obj.x;
          const by=frameY+obj.y;
          const nd=displayNodes.find(n=>n.id===obj.id);
          if(!nd)return;
          const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,obj.w,obj.h);
          const sx=bx+(obj.w-sm.sw)/2;
          innerNodeBoxes[nd.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2};
        });
        
        const innerEdges=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
        const cInnerFan={};const cInnerOff={};
        innerEdges.forEach(e=>{['from','to'].forEach(k=>{const nid=e[k];if(!cInnerFan[nid])cInnerFan[nid]=0;const key=e.from+'_'+e.to;if(!cInnerOff[key])cInnerOff[key]={};cInnerOff[key][k+'Idx']=cInnerFan[nid];cInnerFan[nid]++;});});
        innerEdges.forEach(e=>{
          const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
          if(!fb||!tb)return;
          const key=e.from+'_'+e.to;
          const fanF=cInnerFan[e.from]||1,fanT=cInnerFan[e.to]||1;
          const iF=cInnerOff[key]?.fromIdx||0,iT=cInnerOff[key]?.toIdx||0;
          const offF=fanF>1?(iF-((fanF-1)/2))*7:0;
          const offT=fanT>1?(iT-((fanT-1)/2))*7:0;
          const fbA={...fb,id:e.from,cx:fb.cx+offF};const tbA={...tb,id:e.to,cx:tb.cx+offT};
          const allBoxArr=Object.entries(innerNodeBoxes).map(([k,v])=>({...v,id:k}));
          const route=getOrthogonalRoute(fbA,tbA,allBoxArr);
          if(!route||route.length<2)return;
          ctx.lineWidth=1;ctx.strokeStyle='#000000';
          ctx.beginPath();ctx.moveTo(route[0].x,route[0].y);
          for(let ri=1;ri<route.length;ri++)ctx.lineTo(route[ri].x,route[ri].y);
          ctx.stroke();
          [[route[route.length-1],route[route.length-2]],[route[0],route[1]]].forEach(([tip,prev])=>{
            const a=Math.atan2(tip.y-prev.y,tip.x-prev.x);
            ctx.beginPath();ctx.moveTo(tip.x,tip.y);
            ctx.lineTo(tip.x-5*Math.cos(a-0.4),tip.y-5*Math.sin(a-0.4));
            ctx.lineTo(tip.x-5*Math.cos(a+0.4),tip.y-5*Math.sin(a+0.4));
            ctx.closePath();ctx.fillStyle='#000000';ctx.fill();
          });
        });

        // 구성요소 박스 렌더링
        fig2L.objects.forEach(obj=>{
          const bx=frameX+obj.x;
          const by=frameY+obj.y;
          const nd=displayNodes.find(n=>n.id===obj.id);
          if(!nd)return;
          const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
          const cleanLabel=_safeCleanLabel(nd.label);
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,obj.w,obj.h);
          const sx=bx+(obj.w-sm.sw)/2;
          
          drawCanvasShape(ctx,shapeType,sx,by,sm.sw,sm.sh,SHADOW_PX,1.5);
          const displayLabel=cleanLabel.length>(innerMaxCols>1?10:16)?cleanLabel.slice(0,innerMaxCols>1?8:14)+'…':cleanLabel;
          const fontSize=innerMaxCols>2?9:innerMaxCols>1?10:11;
          ctx.fillStyle='#000000';ctx.font=`${fontSize}px "맑은 고딕", sans-serif`;
          ctx.textAlign='center';ctx.textBaseline='middle';
          const textCy=_shapeTextCy(shapeType,by,sm.sh);
          ctx.fillText(displayLabel,sx+sm.sw/2,textCy-6);
          ctx.fillStyle='#444444';ctx.font=`${Math.max(fontSize-1,8)}px "맑은 고딕", sans-serif`;
          ctx.fillText('('+refNum+')',sx+sm.sw/2,textCy+8);
          ctx.textAlign='left';ctx.textBaseline='alphabetic';
        });
        
        // 프레임 참조번호
        const frameLeaderEndX=frameX+frameW+LEADER_W;
        const frameLeaderY=frameY+frameH/2;
        ctx.strokeStyle='#000000';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(frameX+frameW,frameLeaderY);ctx.lineTo(frameLeaderEndX,frameLeaderY);ctx.stroke();
        ctx.fillStyle='#000000';ctx.font='11px "맑은 고딕", sans-serif';ctx.textAlign='left';
        ctx.fillText(String(frameRefNum),frameLeaderEndX+6,frameLeaderY+4);
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
function renderOutput(sid,text){const cid=`result${sid.charAt(0).toUpperCase()+sid.slice(1).replace('_','')}`;const el=document.getElementById(cid);if(!el)return;if(sid==='step_01')renderTitleCards(el,text);else if(sid==='step_06'||sid==='step_10'||sid==='step_20')renderClaimResult(el,sid,text);else renderEditableResult(el,sid,text);
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
function updateStats(){const c=Object.keys(outputs).filter(k=>outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;document.getElementById('statCompleted').textContent=`${c}/20`;document.getElementById('statApiCalls').textContent=usage.calls;document.getElementById('statCost').textContent=`$${(usage.cost||0).toFixed(2)}`;}
function renderPreview(){const el=document.getElementById('previewArea'),spec=buildSpecification();if(!spec.trim()){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px;text-align:center;padding:20px">생성된 항목이 없어요</p>';return;}el.innerHTML=spec.split(/(?=【)/).map(s=>{const h=s.match(/【(.+?)】/);if(!h)return '';return `<div class="accordion-header" onclick="toggleAccordion(this)"><span>【${App.escapeHtml(h[1])}】</span><span class="arrow">▶</span></div><div class="accordion-body">${App.escapeHtml(s)}</div>`;}).join('');}
function buildSpecification(){
  const desc=getFullDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  // v4.9: Include English title
  const titleLine=selectedTitleEn?`${selectedTitle}{${selectedTitleEn}}`:selectedTitle;
  // Claims: use the latest version (after auto-correction from validation)
  const deviceClaims=outputs.step_06||'';
  const methodClaims=outputs.step_10||'';
  const mediaClaims=outputs.step_20||''; // v5.5: 기록매체/프로그램 청구항
  const allClaims=[deviceClaims,methodClaims,mediaClaims].filter(Boolean).join('\n\n');
  // ═══ D-1 fix: 청구항 번호 연속성 최종 검증 (v5.5) ═══
  const claimNums=[...allClaims.matchAll(/【청구항\s*(\d+)】/g)].map(m=>parseInt(m[1]));
  if(claimNums.length>0){
    const sorted=[...claimNums].sort((a,b)=>a-b);
    for(let i=0;i<sorted.length;i++){
      if(sorted[i]!==i+1){App.showToast(`⚠️ 청구항 번호 불연속: 청구항 ${i+1} 누락`,'warning');break;}
    }
    const dupes=claimNums.filter((n,i)=>claimNums.indexOf(n)!==i);
    if(dupes.length>0)App.showToast(`⚠️ 청구항 번호 중복: ${[...new Set(dupes)].join(', ')}`,'warning');
  }
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
  const titleLine=selectedTitleEn?`${selectedTitle}{${selectedTitleEn}}`:selectedTitle;
  const allClaims=[outputs.step_06,outputs.step_10,outputs.step_20].filter(Boolean).join('\n\n');
  const secs=[{h:'발명의 설명'},{h:'발명의 명칭',b:titleLine},{h:'기술분야',b:outputs.step_02},{h:'발명의 배경이 되는 기술',b:outputs.step_03},{h:'선행기술문헌',b:outputs.step_04},{h:'발명의 내용'},{h:'해결하고자 하는 과제',b:outputs.step_05},{h:'과제의 해결 수단',b:outputs.step_17},{h:'발명의 효과',b:outputs.step_16},{h:'도면의 간단한 설명',b:brief},{h:'발명을 실시하기 위한 구체적인 내용',b:[desc,outputs.step_12].filter(Boolean).join('\n\n')},{h:'부호의 설명',b:outputs.step_18},{h:'청구범위',b:allClaims},{h:'요약서',b:outputs.step_19}];
  const html=secs.map(s=>{const hd=`<h2 style="font-size:12pt;font-weight:bold;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${App.escapeHtml(s.h)}】</h2>`;if(!s.b)return hd;return hd+s.b.split('\n').filter(l=>l.trim()).map(l=>{const hl=/【수학식\s*\d+】/.test(l)||/__+/.test(l)?'background-color:#FFFF00;':'';return `<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify;${hl}">${App.escapeHtml(l.trim())}</p>`;}).join('');}).join('');
  const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}</body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();App.showToast('Word 다운로드 완료');
}


// ★ KIPRIS 키 설정은 common.js saveProfileSettings()에서 통합 관리 (v5.4)


// ═══════════ DASHBOARD HOOK + INIT ═══════════
App._onDashboard = function(){ loadDashboardProjects(); loadGlobalRefFromStorage(); };

async function init(){
  mermaid.initialize({startOnLoad:false,theme:'neutral',securityLevel:'loose',fontFamily:'Pretendard Variable, Malgun Gothic, sans-serif',flowchart:{useMaxWidth:true,htmlLabels:true,curve:'linear'},themeVariables:{fontSize:'14px'}});
  const{data:{session}}=await App.sb.auth.getSession();
  if(session?.user)await onAuthSuccess(session.user);else App.showScreen('auth');
  App.sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')App.showScreen('auth');});
  // 드래그인드롭 초기화 (DOM 준비 후)
  setTimeout(setupDragDrop,500);
}
init();
