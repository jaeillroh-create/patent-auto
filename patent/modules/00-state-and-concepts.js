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
let outputs={},outputHistory={},selectedTitle='',selectedTitleEn='',selectedTitleType='',includeMethodClaims=false;   // ★ [배치15H-1] 방법 청구항 기본 OFF(명시적 opt-in 시만 ON) — 재일 원칙: 기본 장치/시스템만
let scopeCheckResults = {};
let _pendingReviewNotes='';   // ★ [배치15L-2] AI 진단(step_13) 지적 → cohesion 재작성 주입 대기값(REVIEW_NOTES). 소비 후 클리어.
let _pendingFixTargets='';    // ★ [배치16-1] 기계검증 결함 → cohesion 재작성 주입 대기값(FIX_TARGETS, 구조화 지시문). 소비 후 클리어.
let usage={calls:0,inputTokens:0,outputTokens:0,cost:0},loadingState={};
let detailLevel='standard';
let customDetailChars=2000;
let currentProvisionalId=null;
let deviceCategory='server', deviceGeneralDep=5, deviceAnchorDep=4, deviceAnchorStart=7;
let deviceIndepCount=1;   // [배치15B-1] 장치 독립항 수(기본 1) — N>1이면 상이한 권리 관점의 다중 독립항. canonical.
let mathBlockCount=3;     // [배치15B-1] 수학식 개수(수학식 포함 시 1~5) — cohesion 인라인 "정확히 N개 【수학식】" 계약. canonical.
let conceptTargetCount=2; // [배치15B-1] 예시도 목표 개수 — 체인 도면 phase에서 step_07c 생성 시 conceptDiagramTypes를 이 수로 정렬. canonical.
let anchorThemeMode='auto', selectedAnchorThemes=[];
let methodCategory='method', methodGeneralDep=3, methodAnchorDep=2, methodAnchorStart=0;
let methodAnchorThemeMode='auto', selectedMethodAnchorThemes=[];
let requiredFigures=[];
let globalRefStyleText='';
let projectRefStyleText='';
let uploadedFiles = [];
let diagramData = {};
let stepUserCommands = {}; // v5.5: 각 스텝별 사용자 명령어
let chatHistory = {}; // 단계별 독립 채팅 수정 이력 (chat.js)
let outputTimestamps = {};
// [P-C1] invention_scope: 발명 범위 기준선
let inventionScope = null;

// ═══ [§6-1] 용어·부호 세대 스냅샷 (term generation) ═══
// 명칭/구성 확정 시, 구세대 명칭의 diff청크(신명칭에 없는 제거 어절, 공백제거 ≥5자)를 staleTerms에 누적한다.
// CHK-13(term_generation_mismatch)이 완성본에 이 staleTerm이 잔존하는지(=재생성 안 된 구세대 산출물 혼입)를 검출.
// ⚠ 자동 치환 금지 — 검출·경고·재생성 유도만. 결정: (a) diff청크+≥5자, (b) CHK-13=HIGH, (c) 스텝저장 경고만.
let termSnapshot = { titleKo:'', titleEn:'', components:[], staleTerms:[], updatedAt:null };
// [배치12 C] 적용값 스냅샷 — ③ 골격/④ 본문 생성 시점의 설계 파라미터. "선택한 값 vs 적용된 값" 대조 근거(프로젝트 영속).
let genParams = null;   // { stage3:{type,method,generalDep,anchorDep,figures,at}, stage4:{...,math,detail,at} }
function _termSnapshotDefault(){ return { titleKo:'', titleEn:'', components:[], staleTerms:[], updatedAt:null }; }
function _activeStaleTerms(){ return (termSnapshot && Array.isArray(termSnapshot.staleTerms)) ? termSnapshot.staleTerms : []; }
// 현재 명칭 코퍼스(공백 제거) — 복귀 프루닝 기준(현재 명칭에 다시 등장하면 stale 아님)
function _currentTermNorm(){
  const parts=[ (termSnapshot&&termSnapshot.titleKo) || (typeof selectedTitle!=='undefined'?selectedTitle:'') || '' ];
  ((termSnapshot&&termSnapshot.components)||[]).forEach(c=>parts.push((c&&c.name)||''));
  return parts.join('␟').replace(/\s+/g,'');
}
// [3.1a] 커넥터 어절 — old-only run을 여기서 분할(병합 금지)해 "…기반…" 통짜 구절 취약화를 막는다.
const _TERM_CONN = new Set(['및','기반','위한','이용한','통한','의','과','와','또는','위해','통해','기초한','따른']);
// 구명칭→신명칭 diff — 신명칭 어절집합에 없는 "제거된 연속 어절 run"을 커넥터에서 분할, 공백제거 후 ≥5자만 청크로.
function _termDiffChunks(oldT, newT){
  // [3.2] 어절 말미 단음절 조사(을/를/이/가/은/는/의) 제거(스템 ≥2 유지) — "비용을↔비용" 류 어절 불일치 예방.
  const tok=s=>String(s||'').split(/\s+/).filter(Boolean).map(w=>(w.length>=3?w.replace(/(을|를|이|가|은|는|의)$/,''):w));
  const N=new Set(tok(newT)); const out=[]; let cur=[];
  const flush=()=>{ if(cur.length){ out.push(cur.join('')); cur=[]; } };
  tok(oldT).forEach(w=>{ if(N.has(w))flush(); else if(_TERM_CONN.has(w))flush(); else cur.push(w); });   // [3.1a] 공유어절·커넥터에서 분할
  flush();
  return [...new Set(out.map(c=>c.replace(/\s+/g,'')).filter(c=>c.length>=5))];   // [결정 a] ≥5자
}
// [3.1b] 섹션 텍스트에서 "…서버/시스템/장치/방법/…"로 끝나는 명칭구(공백유지, 공백제거 ≥8자) 추출 — 리드인 조사 어절 제거.
function _extractTitlePhrases(sectionText){
  const out=[]; const re=/([가-힣]+(?:\s+[가-힣]+){0,6})\s*(서버|시스템|장치|방법|단말|엔진|플랫폼|모듈)/g; let m;
  while((m=re.exec(String(sectionText||'')))!==null){
    const words=(m[1]+' '+m[2]).replace(/\s+/g,' ').trim().split(' ');
    let start=0;
    for(let i=words.length-2;i>=0;i--){ if(/(는|은|이|가|를|을|의|에|로|와|과|및|도|만)$/.test(words[i])){ start=i+1; break; } }
    const phrase=words.slice(start).join(' ');
    if(phrase.replace(/\s+/g,'').length>=8)out.push(phrase);
  }
  return [...new Set(out)];
}
// [보강1] 복귀 프루닝 — 현재 명칭에 재등장하는 항목 제거
function _pruneStaleTerms(){
  if(!termSnapshot||!Array.isArray(termSnapshot.staleTerms)||!termSnapshot.staleTerms.length)return;
  const cur=_currentTermNorm();
  termSnapshot.staleTerms=termSnapshot.staleTerms.filter(t=>t && cur.indexOf(t)<0);
}
// staleTerms 갱신 — dedupe + 복귀 프루닝 + [보강3] 상한 20(최신 우선)
function _recordStaleTerms(chunks){
  if(!termSnapshot)termSnapshot=_termSnapshotDefault();
  if(!Array.isArray(termSnapshot.staleTerms))termSnapshot.staleTerms=[];
  (chunks||[]).forEach(c=>{ if(c && c.length>=5 && termSnapshot.staleTerms.indexOf(c)<0)termSnapshot.staleTerms.push(c); });
  _pruneStaleTerms();
  if(termSnapshot.staleTerms.length>20)termSnapshot.staleTerms=termSnapshot.staleTerms.slice(-20);
  termSnapshot.updatedAt=Date.now();
}
// 명칭 변경 훅 — [보강2] outputs 존재 시에만 구세대 diff 적재(첫 확정엔 잔존 위험 없음)
function _onTitleChanged(oldT, newT){
  if(!termSnapshot)termSnapshot=_termSnapshotDefault();
  termSnapshot.titleKo=newT||'';
  if(oldT && oldT!==newT){
    const hasOutputs = (typeof outputs==='object') && outputs && Object.keys(outputs).some(k=>k.indexOf('step_')===0 && outputs[k]);
    if(hasOutputs)_recordStaleTerms(_termDiffChunks(oldT, newT));
  }
  _pruneStaleTerms();   // 신명칭이 과거 stale를 되살렸으면 제거
}
// 구성 명칭 변경 훅 — 각 구명칭이 신구성 집합에 없으면 diff청크 적재
function _onComponentsChanged(oldNames, newNames){
  if(!termSnapshot)termSnapshot=_termSnapshotDefault();
  const _new=(newNames||[]).filter(Boolean);
  termSnapshot.components=_new.map(n=>({name:n}));
  const hasOutputs = (typeof outputs==='object') && outputs && Object.keys(outputs).some(k=>k.indexOf('step_')===0 && outputs[k]);
  if(hasOutputs){ const _joined=_new.join(' '); (oldNames||[]).forEach(o=>{ if(o && _new.indexOf(o)<0)_recordStaleTerms(_termDiffChunks(o, _joined)); }); }
  _pruneStaleTerms();
}
// [C1-6a] baseline 편집 UI 상태
let _editingComponentId = null;
let _modalAliases = [];
// [C1-5] Layer 3 Sonnet 판정 상태
let _judgmentCache = new Map();
let _costTracking = {
  judgment_calls: 0, total_input_tokens: 0, total_output_tokens: 0,
  estimated_cost_usd: 0, warned_50: false, stopped_100: false
};
// ═══ v11.0: 예시도/개념도 ═══
let conceptDiagramEnabled = false;
let conceptDiagramCount = 0;
let conceptDiagramTypes = []; // [{type:'ui_screen',title:'...',figNum:N,svgContent:'',refNums:[]}]

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
// ═══ v11.0: 예시도/개념도 유형 ═══
const CONCEPT_DIAGRAM_TYPES={
  ui_screen:{label:'UI 화면',desc:'사용자 인터페이스 스크린 예시',refRange:[31,50]},
  user_scenario:{label:'사용자 시나리오',desc:'사용자 이용 시나리오 흐름',refRange:[51,60]},
  data_structure:{label:'데이터 구조',desc:'테이블/데이터 구조 예시',refRange:[61,70]},
  device_appearance:{label:'장치 외관',desc:'기기 외관 개략도',refRange:[71,80]},
  process_scene:{label:'프로세스 장면',desc:'처리 과정 시각화',refRange:[81,99]}
};
// ★ [P1] 예시도 목적·청구항 결속 규칙 — 메인·캐스케이드 공유(무관한 그림 방지). const 이므로 첫 사용(2714 캐스케이드) 전에 정의.
const CONCEPT_PURPOSE_RULES=`★★★ 이 예시도의 목적 (반드시 준수) ★★★
- 예시도는 장식이 아니라 ★청구항에 기재된 구성을 시각적으로 뒷받침·예시★ 하는 도면이다.
- ★ 먼저 이 예시도가 시각화할 "청구항 구성"을 1개 이상 특정하고, 그 구성을 도면에 반드시 담아라.
  발명 핵심과 무관한 일반적 화면/장면을 그리지 마라(청구된 구성이 도면에서 드러나야 한다).
- 도면의 각 핵심 요소에 한국어 라벨과 참조번호(31~99)를 붙이고, 그 요소가 청구항/상세설명의 어느 구성에 대응하는지 알 수 있게 하라.
★ 유형별 목적:
- UI 화면: 청구항이 규정한 화면 구성·조작(버튼·입력·표시 영역)을 실제 화면처럼 시각화.
- 사용자 시나리오: 청구항이 규정한 사용자-장치 상호작용 단계(요청·응답·동작)를 한 장면으로.
- 데이터 구조: 청구항이 규정한 자료구조(필드·레코드·관계)를 행/열 테이블로 구체화.
- 장치 외관: 청구된 물리 구성요소가 드러나는 기기 외형.
- 프로세스 장면: 청구된 처리 과정을 물리 메타포로 시각화.`;
// ★ [A] 배치/선 겹침 방지 규칙 — step_07 "배치 품질 규칙(렌더링 겹침 방지)" 이식. 메인·캐스케이드 공유(P4 일관).
const CONCEPT_OVERLAP_RULES=`★★★ 배치/선 겹침 방지 규칙 (렌더링 가독성 — 필수) ★★★
- ★ 부호 리더선(번호를 가리키는 얇은 선)은 ★다른 박스·텍스트·연결선과 겹치거나 가로지르지 않게★ 짧고 곧게 그어라.
- ★ 부호 숫자는 가리키는 요소 ★근처의 빈 공간★에 배치하고, 리더선이 다른 요소를 관통하지 않도록 경로를 잡아라.
- 요소(박스·아이콘·텍스트) 사이에 충분한 간격을 두어 서로 겹치지 않게 하라(텍스트끼리 겹침 금지).
- 연결선(점선/실선/화살표)의 교차를 최소화하라 — 한 영역에 선이 몰려 엉키면 요소를 재배열하라.
- 요소가 많아 겹칠 것 같으면 개수를 줄이거나 영역을 나눠 배치하라(겹쳐 그리지 마라).
- 모든 요소·선·번호는 viewBox(680×500) 안에 들어오게 하라.`;
// ★ [P2/P3] 예시도 응답 파싱(메인·캐스케이드 공유) — 마커별 SVG/BRIEF/REF_MAP 추출.
//   refMap(번호↔이름) 캡처(G3 해소), 참조번호 범위 31~99 통일(G4 — 프로세스 장면 81~99 누락 수정).
function _parseConceptRefMap(segment, svgText){
  const out=[],seen=new Set();
  const rmIdx=segment.indexOf('---REF_MAP---');
  if(rmIdx>=0){
    const block=segment.slice(rmIdx+'---REF_MAP---'.length);
    const re=/(?:^|\n)\s*(\d{2,3})\s*[:：]\s*([^\n]+)/g;let m;
    while((m=re.exec(block))!==null){const n=parseInt(m[1]);if(n>=31&&n<=99&&!seen.has(n)){seen.add(n);out.push({signNumber:String(n),label:m[2].trim().replace(/\s+/g,' ').slice(0,40)});}}
  }
  // REF_MAP 누락분은 SVG의 (번호)로 보강(라벨 없이). ★ 31~99 통일(이전 ≤79 버그 수정).
  [...String(svgText||'').matchAll(/\((\d{2,3})\)/g)].forEach(mm=>{const n=parseInt(mm[1]);if(n>=31&&n<=99&&!seen.has(n)){seen.add(n);out.push({signNumber:String(n),label:''});}});
  // ★ [T4] 맨숫자(리더라인+숫자, 생성 규칙 5981) 폴백 — 괄호 없이 그려진 부호도 수집(SVG 텍스트노드 >NN<).
  [...String(svgText||'').matchAll(/>\s*(\d{2,3})\s*</g)].forEach(mm=>{const n=parseInt(mm[1]);if(n>=31&&n<=99&&!seen.has(n)){seen.add(n);out.push({signNumber:String(n),label:''});}});
  return out.sort((a,b)=>parseInt(a.signNumber)-parseInt(b.signNumber));
}
function _parseConceptResult(fullText, conceptTypes, figNums){
  const count=conceptTypes.length;
  for(let i=0;i<count;i++){
    const ct=conceptTypes[i];
    const figNum=figNums[i]||'?';
    const typeDef=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
    const marker=`---CONCEPT_FIG_${figNum}---`;
    const nextMarker=i<count-1?`---CONCEPT_FIG_${figNums[i+1]}---`:null;
    let segment='';
    const mIdx=fullText.indexOf(marker);
    if(mIdx>=0){const after=fullText.slice(mIdx+marker.length);segment=nextMarker?after.slice(0,after.indexOf(nextMarker)):after;}
    else{const allSvgs=[...fullText.matchAll(/<svg[\s\S]*?<\/svg>/gi)];if(allSvgs[i])segment=allSvgs[i][0];}
    const svgMatch=segment.match(/<svg[\s\S]*?<\/svg>/i);
    const svgText=svgMatch?svgMatch[0]:`<svg viewBox="0 0 680 500" xmlns="http://www.w3.org/2000/svg"><rect width="680" height="500" fill="#fff" stroke="#ccc"/><text x="340" y="250" text-anchor="middle" font-size="18" fill="#999">SVG 생성 실패 — 재시도하세요</text></svg>`;
    const briefMatch=segment.match(/---BRIEF_DESC---\s*\n?(도\s*\d+[은는]\s+.+)/);
    ct.briefDesc=briefMatch?briefMatch[1].trim():`도 ${figNum}은 ${selectedTitle}의 ${typeDef.label}${josaEulReul(typeDef.label)} 나타내는 예시도이다.`;
    ct.refMap=_parseConceptRefMap(segment, svgText);   // ★ P2: [{signNumber,label}]
    ct.refNums=ct.refMap.map(r=>parseInt(r.signNumber)); // 하위호환(숫자 배열)
    ct.svgContent=svgText;ct.figNum=figNum;
  }
}
// outputs.step_07c 텍스트(공유) — refMap 의 "이름(번호)" 포함 → 부호의 설명(step_18)·상세설명(step_08)이 정밀 참조.
// ★ [B] 라벨 폴백: refMap 라벨이 비면 유형 기반 기본 이름(예: "UI 화면 요소")을 부여 → "(31)" 대신 "이름(31)" 보장
//   → step_18 부호 정규식(이름+괄호 요구, 4622)이 예시도 부호를 누락 없이 수집(부호의 설명 누락 차단).
function _conceptRefFallbackName(ct){
  const td=CONCEPT_DIAGRAM_TYPES[ct&&ct.type]||{label:(ct&&ct.type)||'예시'};
  return (td.label||'예시')+' 요소';
}
// 예시도 1종의 참조 "이름/번호" 쌍 배열(B 폴백 적용). 라벨 공백 → 유형 기반 기본 이름.
function _conceptRefPairs(ct){
  const fb=_conceptRefFallbackName(ct);
  return ((ct&&ct.refMap)||[]).map(r=>({num:String(r.signNumber),name:(r.label&&String(r.label).trim())||fb}));
}
// ★ [배치15F-4] 폴백 없는 원본 라벨 쌍 — 부호의 설명(step_18) 반영 시 "실명(REF_MAP label)만" 등재하기 위해 사용.
//   §6-6은 실명 특정 불가 시 라벨을 비우게 하는데(빈 라벨), 그 빈 라벨을 유형 기반 generic("~요소")으로 채워
//   부호표에 넣으면 부호↔명칭 대응이 상실된다(generic_series·title_suspect 오염). 빈 라벨은 부호표에서 제외.
function _conceptRefPairsRaw(ct){
  return ((ct&&ct.refMap)||[]).map(r=>({num:String(r.signNumber),name:(r.label&&String(r.label).trim())||''}));
}
function _buildConceptOutputText(conceptTypes, figNums){
  return conceptTypes.map((ct,i)=>{
    const fn=figNums[i]||'?';const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
    const refs=_conceptRefPairs(ct).map(p=>`${p.name}(${p.num})`).join(', ');  // ★ B: 라벨 공백도 "이름(번호)" 보장
    return `[도 ${fn}] ${td.label} 예시도\n참조번호: ${refs}\n${ct.briefDesc||''}`;
  }).join('\n\n');
}
// ★ [식별번호 figN 연동] 도 N 예시도의 i번째 식별번호 — 기본 5x(N*10+i), 요소>9 또는 2자리 도번호면 5xx(N*100+i).
//   5x(51~59)는 100 미만→장치 부호(100~)와 충돌 없음. 5xx(501~)는 요소多/도10~ 용(장치 100번대 회피). 본인 스킴.
function _conceptRefNumFor(figNum, idx, total){
  const N=parseInt(figNum)||0;
  const base=(N>=10 || (total||0)>9) ? N*100 : N*10;   // 5xx vs 5x
  return String(base+(idx+1));
}
// ★ [render 복구] SVG 참조번호(맨숫자 텍스트노드 >NN< + 괄호 (NN))를 도 번호 기반으로 (재)표기 — render/다운로드 시점 적용(제목 _conceptSvgApplyTitle 패턴 미러).
//   ★ 위치(rank) 기반: 현재 SVG 값과 무관하게 정렬 순위 i → _conceptRefNumFor(figNum,i,total) → 기존 사건(31 박힘)도 무재생성 복구·③ 추종·멱등.
//   ★ 좌표·속성(x=,y=,d=,viewBox,font-size,stroke-width)·제목【도 N】 미접촉 — 텍스트노드 내용(>NN<)·괄호만 치환(="..." 좌표는 미일치).
function _conceptSvgApplyRefNums(svgStr, figNum, total){
  var s=String(svgStr||'');
  if(!/<svg\b/i.test(s)) return s;
  var vals=new Set();
  s.replace(/>\s*(\d{2,4})\s*</g,function(m,num){ vals.add(parseInt(num)); return m; });   // 텍스트노드 숫자(생성 규칙: 리더라인+숫자=맨숫자). 좌표/속성은 ="..." 라 >NN< 미일치
  s.replace(/\((\d{2,4})\)/g,function(m,num){ vals.add(parseInt(num)); return m; });        // 괄호형 혼용 대비
  if(!vals.size) return s;
  var sorted=[...vals].sort(function(a,b){ return a-b; });   // refMap 도 signNumber 정렬(파서) → rank 정합
  var n=total||sorted.length;
  var map={};
  sorted.forEach(function(v,i){ map[String(v)]=_conceptRefNumFor(figNum,i,n); });
  s=s.replace(/>(\s*)(\d{2,4})(\s*)</g,function(m,a,num,b){ return map[num]?'>'+a+map[num]+b+'<':m; });   // 콜백=원본 매치 기준 → 사이클 안전·멱등
  s=s.replace(/\((\d{2,4})\)/g,function(m,num){ return map[num]?'('+map[num]+')':m; });
  return s;
}
// ★ 렌더/다운로드용 예시도 SVG — 식별번호(도 번호 기반, render 복구) + 제목(SoT) 동시 적용. svgContent 원본 불변(표시 시 파생 — 제목 패턴).
function _conceptSvgForDisplay(ct, figNum){
  var total=((ct&&ct.refMap)||[]).length;
  return _conceptSvgApplyTitle(_conceptSvgApplyRefNums((ct&&ct.svgContent)||'', figNum, total), figNum);
}
// ★ [SoT] 생성된 예시도 각각의 식별번호(refMap)를 도 번호(getAutoFigNums) 기반으로 (재)배정 — refMap·refNums·step_07c(텍스트) 일관.
//   생성 직후·③ override 시 호출. 멱등. step_08c/step_18 은 refMap 을 읽으므로 자동 정합. ★ SVG 그림은 render 시 _conceptSvgApplyRefNums 로 복구(맨숫자·기존 사건 포함) — 물리치환 의존 제거.
function _syncConceptRefNums(){
  const figs=getAutoFigNums('step_07c');
  const placed=conceptDiagramTypes.filter(ct=>ct.svgContent);
  let changed=false;
  placed.forEach((ct,i)=>{
    const figNum=figs[i]; if(figNum==null) return;
    const rm=ct.refMap||[]; if(!rm.length) return;
    const oldToNew={};
    rm.forEach((r,j)=>{oldToNew[String(r.signNumber)]=_conceptRefNumFor(figNum,j,rm.length);});
    if(!rm.some(r=>oldToNew[String(r.signNumber)]!==String(r.signNumber))) return;   // 멱등: 이미 figN 기반이면 skip
    changed=true;
    rm.forEach(r=>{r.signNumber=oldToNew[String(r.signNumber)]||r.signNumber;});   // refMap(텍스트 소비처)만 재배정 — SVG 는 render 복구
    ct.refNums=rm.map(r=>parseInt(r.signNumber));
  });
  if(changed && placed.length) outputs.step_07c=_buildConceptOutputText(placed, figs);   // 공유 텍스트(step_18·step_13 입력) 재구성
  return changed;
}
// ═══ [A] 예시도 자동 반영 — 예시도 생성 = 명세서 반영 의사. 발명의 설명(step_08 계층)·부호의 설명(step_18)에
//   예시도 설명/부호를 ★APPEND★(기존 본문 byte 보존·멱등, D2 add_spec_support 패턴). 덮어쓰기·재생성 없음. ═══
//   ★ [C] getAutoFigNums('step_07c')(생성된 예시도 compact 번호배열)를 filter 순서와 동일 인덱스로 매핑(full 인덱스 접근 버그 제거).
function _conceptBrief(ct, figNum){
  const td=CONCEPT_DIAGRAM_TYPES[ct&&ct.type]||{label:(ct&&ct.type)||'예시'};
  const n=parseInt(figNum)||0;
  return (ct&&ct.briefDesc&&String(ct.briefDesc).trim())||`도 ${figNum}${figParticle(n)} ${selectedTitle||'본 발명'}의 ${td.label}${josaEulReul(td.label)} 나타내는 예시도이다.`;
}
// 생성된(svgContent) 예시도 → {ct, figNum} (★ C: filter 순서 = getAutoFigNums('step_07c') 순서로 정합)
function _generatedConceptsWithNums(){
  const figs=getAutoFigNums('step_07c');
  return conceptDiagramTypes.filter(ct=>ct.svgContent).map((ct,fi)=>({ct,figNum:figs[fi]||ct.figNum||'?'}));
}
// 멱등 판정: 해당 예시도(도 N) 단락이 이미 상세설명에 반영됐나.
//   ★ figNum 기준 → 재생성으로 brief 문구가 바뀌어도 같은 도 N 단락이 중복 누적되지 않음(본문 보호).
//   ★ B3 네이티브 인식: Step 8(B1)이 직접 쓴 예시도 설명(다른 문구)도 인식 → 네이티브+reflect 동시 시 중복 APPEND 방지.
function _conceptAlreadyInDesc(text, ct, figNum){
  if(!text) return false;
  const s=String(text);
  if(s.indexOf(_conceptBrief(ct, figNum))>=0) return true;                         // (1) reflect 작성 brief 일치
  const fn=String(figNum).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(new RegExp('도\\s*'+fn+'[을를]\\s*참조하면[^\\n]*등이 도시되어 있다').test(s)) return true;   // (2) reflect 마커
  // (3) ★ 네이티브 인식: "도 N{을|를} 참조하면" + 그 예시도 부호(31~99) 중 하나가 본문에 존재 → 이미 기술됨(Step 8 네이티브 포함)
  if(new RegExp('도\\s*'+fn+'[을를]\\s*참조하면').test(s)){
    const nums=_conceptRefPairs(ct).map(p=>p.num);
    if(nums.length && nums.some(n=>s.indexOf('('+n+')')>=0)) return true;
  }
  return false;
}
// 예시도 설명을 발명의 설명(step_08/09/13_applied 계층)·부호의 설명(step_18)에 자동 반영(APPEND·멱등·본문 보존).
//   반환 {desc,ref}=신규 반영 수. step_08/step_18 부재 시 무손상 no-op(추후 생성 시 4293·4619 경로로 포함).
// ★ [B2] reflect 은퇴 — 발명의 설명(step_08) APPEND(끼워넣기 땜질)은 제거. 예시도 상세설명은 step_08c(분리, #215)가 담당.
//   ★ 단, 부호의 설명(step_18)에 예시도 부호(31~)를 보강하는 경로는 ★유지★(은퇴해도 부호 누락 금지 — B3). desc 는 항상 0.
function reflectConceptsToSpec(){
  const gen=_generatedConceptsWithNums();
  if(!gen.length) return {desc:0, ref:0};
  // ── 부호의 설명(step_18) — 예시도 부호 "이름 : 번호" 누락분만 APPEND(기존 보존·멱등). step_08c·step_18 직접 생성 경로의 폴백. ──
  let refAdded=0;
  if(outputs.step_18){
    let s18=String(outputs.step_18);
    const have=new Set((s18.match(/\d{2,4}/g)||[]));                   // 기존 기재 번호
    const add=[];
    gen.forEach(g=>_conceptRefPairsRaw(g.ct).forEach(p=>{
      if(!p.name) return;                              // ★ [배치15F-4] 실명 없는 예시도 부호는 부호표에 generic으로 넣지 않음(총칭 오염 방지)
      if(have.has(p.num)) return; have.add(p.num); add.push(`${p.name} : ${p.num}`);
    }));
    if(add.length){ outputs.step_18=s18.replace(/\s*$/,'')+'\n'+add.join('\n'); markOutputTimestamp('step_18'); refAdded=add.length; }
  }
  return {desc:0, ref:refAdded};
}
// ★ [① SVG 제목 동기화] 예시도 SVG 제목을 ★코드가 computeFigNums(SoT) 값으로 강제★ — mermaid(svg+='【도 figNum】' 8082) 방식 이식.
//   렌더/다운로드 시점마다 적용 → SoT(getAutoFigNums) 가 바뀌면(③ 순서지정·장치수 변동) 제목이 자동 추종. LLM이 쓴 【도 N】은 제거 후 교체.
function _conceptSvgApplyTitle(svgStr, figNum){
  var s=String(svgStr||'');
  if(!/<svg\b/i.test(s)) return s;
  // 1) LLM 이 써넣은 제목(【도 N】 텍스트) 제거 — 도면 안 어디든
  s=s.replace(/<text\b[^>]*>[^<]*【\s*도\s*\d+\s*】[^<]*<\/text>/gi,'');
  // 2) 코드 제목(SoT figNum) 을 여는 <svg> 태그 직후 상단 중앙에 오버레이
  var title='<text x="340" y="28" text-anchor="middle" font-size="14" font-weight="bold" font-family="Malgun Gothic,sans-serif" fill="#000">【도 '+(figNum==null?'?':figNum)+'】</text>';
  s=s.replace(/(<svg\b[^>]*>)/i,'$1'+title);
  return s;
}
const STEP_NAMES={step_01:'A1. 발명의 명칭',step_02:'D5. 기술분야',step_03:'D4. 배경기술',step_04:'E2. 선행기술 검색',step_05:'D2. 해결하고자 하는 과제',step_06:'A2. 장치 청구항',step_07:'B1. 장치 도면',step_07c:'B1c. 예시도/개념도',step_08:'C1. 장치 상세설명',step_08c:'C1c. 예시도 상세설명',step_09:'C2. 수학식',step_10:'A3. 방법 청구항',step_11:'B2. 방법 도면',step_12:'C3. 방법 상세설명',step_13:'E1. AI 검토',step_14:'E4. 대안 청구항',step_15:'E3. 특허성 검토',step_16:'D3. 발명의 효과',step_17:'D1. 과제의 해결 수단',step_18:'F1. 부호의 설명',step_19:'F2. 요약서',step_20:'A4. 기록매체/프로그램 청구항'};
// Phase 없는 순수 이름 (프롬프트 내부용)
const STEP_NAMES_CLEAN={step_01:'발명의 명칭',step_02:'기술분야',step_03:'배경기술',step_04:'선행기술 검색',step_05:'해결하고자 하는 과제',step_06:'장치 청구항',step_07:'장치 도면',step_07c:'예시도/개념도',step_08:'장치 상세설명',step_08c:'예시도 상세설명',step_09:'수학식',step_10:'방법 청구항',step_11:'방법 도면',step_12:'방법 상세설명',step_13:'AI 검토',step_14:'대안 청구항',step_15:'특허성 검토',step_16:'발명의 효과',step_17:'과제의 해결 수단',step_18:'부호의 설명',step_19:'요약서',step_20:'기록매체/프로그램 청구항'};

// ═══ v9.0/v20: callClaudeWithContinuation 오버라이드 ═══
(function(){
  // 두 문자열 간 겹침(overlap) 길이 계산: a의 끝부분과 b의 시작부분이 동일한 최장 길이
  function _findOverlap(a, b, maxCheck){
    maxCheck=maxCheck||300;
    const aEnd=a.slice(-maxCheck);
    let best=0;
    for(let len=10;len<=aEnd.length;len++){
      if(b.startsWith(aEnd.slice(-len)))best=len;
    }
    return best;
  }
  App.callClaudeWithContinuation = async function(prompt, pid){
    let full = '', r = await App.callClaude(prompt), a = 0;
    full = r.text;

    while(a < 6 && r.stopReason === 'max_tokens'){
      a++;
      App.showProgress(pid, `이어서 작성 중... (${a}/6)`, a, 6);

      const rulesCtx = prompt.slice(0, 800);

      const figRefs = [...full.matchAll(/도\s+(\d+)[을를]\s*참조하면/g)];
      const stepRefs = [...full.matchAll(/단계\s*\(?(S\d+)\)?/g)];
      let progressInfo = '';
      if(figRefs.length > 0){
        progressInfo = `\n※ 현재까지 작성 완료: ${figRefs.map(m=>'도 '+m[1]).join(', ')} 설명`;
      }
      if(stepRefs.length > 0){
        progressInfo += `\n※ 마지막 단계: ${stepRefs[stepRefs.length-1][1]}`;
      }

      // v20: 마지막 부분 컨텍스트 준비 — 불완전 문장도 포함하여 정확한 이어쓰기 유도
      const tail = full.slice(-2000);

      // step_13(검토)은 검토 항목 이어쓰기, 그 외(상세설명)는 기존 로직
      const _isReview = pid && /step.?13/i.test(pid);
      const contPrompt = _isReview
        ? `아래 [마지막 부분]의 검토 텍스트가 중간에 잘려 있다. 잘린 지점의 바로 다음부터 이어서 작성하라.
- 마지막 문장이 불완전하면 해당 문장의 나머지부터 시작하라.
- [마지막 부분]의 내용을 절대 반복하지 마라. 오직 잘린 다음부터만 작성하라.
- 검토 항목 번호([1]~[11])와 출력 형식(✅/⚠️)을 이어서 유지하라.
- 보완/수정 제안에서 "기재 누락"인 경우에도 반드시 수정 문장(추가할 문장)을 함께 제시하라.

[마지막 부분]
${tail}`
        : `[원본 작성 규칙 — 이어쓰기에서도 동일하게 적용]
${rulesCtx}

[이어쓰기 지시]
아래 [마지막 부분]의 텍스트가 중간에 잘려 있다. 잘린 지점의 바로 다음부터 이어서 작성하라.
- 마지막 단어가 불완전하면 해당 단어의 나머지 글자부터 시작하라.
- 마지막 문장이 불완전하면 해당 문장의 나머지부터 시작하라.
- [마지막 부분]의 내용을 절대 반복하지 마라. 오직 잘린 다음부터만 작성하라.
${progressInfo}

⛔ 이어쓰기 금지사항:
- 이미 작성된 도면/단계를 다시 설명하지 마라
- "도면의 간단한 설명" (도 N은 ~블록도이다) 절대 포함 금지
- 새로운 섹션/항목(기술분야, 배경기술, 요약 등) 추가 금지
- 현재 작성 중인 항목의 나머지만 이어서 작성하라

[마지막 부분]
${tail}`;

      r = await App.callClaude(contPrompt);
      let newText = r.text;

      // ★ v20: 겹침(overlap) 감지 — full 끝부분과 newText 시작부분이 동일한 문자열이면 제거 ★
      const overlap = _findOverlap(full, newText, 500);
      if(overlap > 10){
        newText = newText.slice(overlap);
        console.log(`[v20 이어쓰기] 겹침 ${overlap}자 제거`);
      }

      // ★ v20: "도 N을 참조하면" 재시작 감지 — 상세설명에서만 적용 (검토는 제외) ★
      if(!_isReview && figRefs.length > 0){
        const writtenFigs = new Set(figRefs.map(m => m[1]));
        const newFigStart = newText.match(/도\s+(\d+)[을를]\s*참조하면/);
        if(newFigStart && writtenFigs.has(newFigStart[1])){
          const cutAt = newFigStart.index;
          if(cutAt > 20){
            newText = newText.substring(0, cutAt).trim();
            console.warn(`[v20 이어쓰기] 도 ${newFigStart[1]} 재시작 차단 — ${cutAt}자까지만 사용`);
          } else {
            console.warn(`[v20 이어쓰기] 도 ${newFigStart[1]} 재시작 감지 — 이어쓰기 중단`);
            break;
          }
        }
      }

      if(!newText.trim()){
        console.warn('[v20 이어쓰기] 유효 텍스트 없음 — 중단');
        break;
      }

      // v20: 이어붙이기 — 마지막 문자가 한글/영문이고 newText 첫 문자도 한글/영문이면 공백 없이 직접 연결 (단어 이어쓰기)
      const lastChar = full.slice(-1);
      const firstChar = newText[0] || '';
      const isKorOrAlpha = c => /[가-힯ㄱ-ㆎa-zA-Z0-9]/.test(c);

      if(isKorOrAlpha(lastChar) && isKorOrAlpha(firstChar)){
        // 단어가 잘려서 이어지는 경우 — 공백/줄바꿈 없이 직접 연결
        full += newText;
      } else {
        full += '\n' + newText;
      }
    }
    App.clearProgress(pid);
    return full;
  };
})();


// ═══════════ [P-C1] OUTPUT HISTORY ═══════════
// origin 스펙: 'llm' | 'user_edit' | 'pre_review' | 'cascade'
const OUTPUT_HISTORY_MAX = 10;
const OUTPUT_HISTORY_VALUE_MAX = 50000;
function pushOutputHistory(sid, origin, triggeredBy) {
  if (!outputs[sid]) return;
  if (!outputHistory[sid]) outputHistory[sid] = [];
  outputHistory[sid].push({
    value: outputs[sid].length > OUTPUT_HISTORY_VALUE_MAX ? outputs[sid].slice(0, OUTPUT_HISTORY_VALUE_MAX) : outputs[sid],
    timestamp: new Date().toISOString(),
    origin,
    triggered_by: triggeredBy
  });
  if (outputHistory[sid].length > OUTPUT_HISTORY_MAX) {
    outputHistory[sid] = outputHistory[sid].slice(-OUTPUT_HISTORY_MAX);
  }
}
function getLastHistoryByOrigin(sid, origin) {
  if (!outputHistory[sid]) return null;
  const matches = outputHistory[sid].filter(h => h.origin === origin);
  return matches.length ? matches[matches.length - 1] : null;
}

// ═══════════ [P-C1] INVENTION SCOPE CONSTANTS ═══════════
const INVENTION_SCOPE_SYSTEM_PROMPT = `당신은 15년 경력의 변리사 출신 발명 분석가이다.
입력된 발명 설명에서 본질적 구성요소와 기능을 추출한다.
원칙: 텍스트에 명시된 내용만 추출. 추론·추측·상식 추가 금지.
애매한 경우 제외.`;

const INVENTION_SCOPE_SCHEMA_INSTRUCTION = `아래 JSON 스키마로만 응답하라. 설명·prefix·markdown 금지. 순수 JSON만 출력.
{
  "core_components": [{"id":"c1","name":"구성요소명","role":"역할 설명","aliases":["별칭1","별칭2"]}],
  "core_functions":  [{"id":"f1","desc":"기능 설명","component_refs":["c1"]}],
  "problem_space": "해결과제 요약 200자 이내",
  "solution_space": "해결수단 요약 200자 이내",
  "explicit_nonscope": ["명시적으로 제외된 요소 (있는 경우만)"]
}

aliases 생성 기준:
- 동일 구성요소를 지칭하는 한국어/영어/축약 표현을 모두 나열
- 예: "제어부" → aliases: ["컨트롤러", "controller", "제어 모듈", "제어 유닛"]
- 예: "딥러닝 모델" → aliases: ["인공지능 모델", "AI 모델", "신경망 모델", "deep learning model"]
- 하위개념(CNN, RNN 등)은 aliases에 포함하지 않음 (별도 확장으로 관리)
- 최소 1개, 최대 5개까지 권장`;

// [C1-3] Layer 1 가드: invention_scope 주입 대상 sid
const SCOPE_GUARDED_TEXT_STEPS = [
  'step_06', 'step_10', 'step_20',
  'step_08', 'step_12',
  'step_13_applied', 'step_13_applied_method'
];
const SCOPE_GUARDED_MERMAID_STEPS = [
  'step_07_mermaid', 'step_11_mermaid'
];

