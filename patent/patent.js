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
let outputs={},outputHistory={},selectedTitle='',selectedTitleEn='',selectedTitleType='',includeMethodClaims=true;
let scopeCheckResults = {};
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
let uploadedFiles = [];
let diagramData = {};
let stepUserCommands = {}; // v5.5: 각 스텝별 사용자 명령어
let chatHistory = {}; // 단계별 독립 채팅 수정 이력 (chat.js)
let outputTimestamps = {};
// [P-C1] invention_scope: 발명 범위 기준선
let inventionScope = null;
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
    ct.briefDesc=briefMatch?briefMatch[1].trim():`도 ${figNum}은 ${selectedTitle}의 ${typeDef.label}을 나타내는 예시도이다.`;
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
function _buildConceptOutputText(conceptTypes, figNums){
  return conceptTypes.map((ct,i)=>{
    const fn=figNums[i]||'?';const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
    const refs=_conceptRefPairs(ct).map(p=>`${p.name}(${p.num})`).join(', ');  // ★ B: 라벨 공백도 "이름(번호)" 보장
    return `[도 ${fn}] ${td.label} 예시도\n참조번호: ${refs}\n${ct.briefDesc||''}`;
  }).join('\n\n');
}
// ═══ [A] 예시도 자동 반영 — 예시도 생성 = 명세서 반영 의사. 발명의 설명(step_08 계층)·부호의 설명(step_18)에
//   예시도 설명/부호를 ★APPEND★(기존 본문 byte 보존·멱등, D2 add_spec_support 패턴). 덮어쓰기·재생성 없음. ═══
//   ★ [C] getAutoFigNums('step_07c')(생성된 예시도 compact 번호배열)를 filter 순서와 동일 인덱스로 매핑(full 인덱스 접근 버그 제거).
function _conceptBrief(ct, figNum){
  const td=CONCEPT_DIAGRAM_TYPES[ct&&ct.type]||{label:(ct&&ct.type)||'예시'};
  const n=parseInt(figNum)||0;
  return (ct&&ct.briefDesc&&String(ct.briefDesc).trim())||`도 ${figNum}${figParticle(n)} ${selectedTitle||'본 발명'}의 ${td.label}을 나타내는 예시도이다.`;
}
// 예시도 1종의 발명의 설명 단락(평문) — briefDesc + 참조 "이름(번호)" 나열(B 폴백). 결정적(본문보호 APPEND용).
function _buildConceptSpecParagraph(ct, figNum){
  const n=parseInt(figNum)||0;
  const brief=_conceptBrief(ct, figNum);
  const pairs=_conceptRefPairs(ct);
  if(!pairs.length) return brief;
  const obj=figParticle(n)==='은'?'을':'를';                       // 도 N을/를 (받침 규칙=figParticle)
  return brief.replace(/\s*$/,'')+` 도 ${figNum}${obj} 참조하면, ${pairs.map(p=>`${p.name}(${p.num})`).join(', ')} 등이 도시되어 있다.`;
}
// 생성된(svgContent) 예시도 → {ct, figNum} (★ C: filter 순서 = getAutoFigNums('step_07c') 순서로 정합)
function _generatedConceptsWithNums(){
  const figs=getAutoFigNums('step_07c');
  return conceptDiagramTypes.filter(ct=>ct.svgContent).map((ct,fi)=>({ct,figNum:figs[fi]||ct.figNum||'?'}));
}
// 멱등 판정: 해당 예시도(도 N) 단락이 이미 상세설명에 반영됐나 — brief 일치 또는 "도 N{을|를} 참조하면 … 등이 도시되어 있다" 마커.
//   ★ figNum 기준 → 재생성으로 brief 문구가 바뀌어도 같은 도 N 단락이 중복 누적되지 않음(본문 보호).
function _conceptAlreadyInDesc(text, ct, figNum){
  if(!text) return false;
  if(String(text).indexOf(_conceptBrief(ct, figNum))>=0) return true;
  const fn=String(figNum).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('도\\s*'+fn+'[을를]\\s*참조하면[^\\n]*등이 도시되어 있다').test(text);
}
// 예시도 설명을 발명의 설명(step_08/09/13_applied 계층)·부호의 설명(step_18)에 자동 반영(APPEND·멱등·본문 보존).
//   반환 {desc,ref}=신규 반영 수. step_08/step_18 부재 시 무손상 no-op(추후 생성 시 4293·4619 경로로 포함).
function reflectConceptsToSpec(){
  const gen=_generatedConceptsWithNums();
  if(!gen.length) return {desc:0, ref:0};
  // ── 발명의 설명 — 존재하는 모든 상세설명 계층에 예시도 단락 APPEND(멱등). insertBoilerplate 패턴(우선순위 보존). ──
  const hasDescLayer=!!(outputs.step_08||outputs.step_09||outputs.step_13_applied);   // 반영 대상 계층 존재 여부
  const latest=getLatestDescription()||'';
  const newOnes=hasDescLayer?gen.filter(g=>!_conceptAlreadyInDesc(latest,g.ct,g.figNum)):[];   // 계층 없으면 0(추후 생성 시 4359로 포함)
  ['step_08','step_09','step_13_applied'].forEach(L=>{
    if(!outputs[L]) return;
    let body=String(outputs[L]), changed=false;
    gen.forEach(g=>{
      if(_conceptAlreadyInDesc(body, g.ct, g.figNum)) return;         // 멱등(figNum 기준): 이미 반영됨 → skip
      body=body.replace(/\s*$/,'')+'\n\n'+_buildConceptSpecParagraph(g.ct, g.figNum);  // ★ APPEND(기존 byte 보존)
      changed=true;
    });
    if(changed){ outputs[L]=body; if(L!=='step_08')markOutputTimestamp(L); }   // step_08 timestamp 미변경(계층 우선순위 보존)
  });
  // ── 부호의 설명(step_18) — 예시도 부호 "이름 : 번호" 누락분만 APPEND(기존 보존·멱등). ──
  let refAdded=0;
  if(outputs.step_18){
    let s18=String(outputs.step_18);
    const have=new Set((s18.match(/\d{2,4}/g)||[]));                   // 기존 기재 번호
    const add=[];
    gen.forEach(g=>_conceptRefPairs(g.ct).forEach(p=>{
      if(have.has(p.num)) return; have.add(p.num); add.push(`${p.name} : ${p.num}`);
    }));
    if(add.length){ outputs.step_18=s18.replace(/\s*$/,'')+'\n'+add.join('\n'); markOutputTimestamp('step_18'); refAdded=add.length; }
  }
  return {desc:newOnes.length, ref:refAdded};
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
const STEP_NAMES={step_01:'A1. 발명의 명칭',step_02:'D5. 기술분야',step_03:'D4. 배경기술',step_04:'E2. 선행기술 검색',step_05:'D2. 해결하고자 하는 과제',step_06:'A2. 장치 청구항',step_07:'B1. 장치 도면',step_07c:'B1c. 예시도/개념도',step_08:'C1. 장치 상세설명',step_09:'C2. 수학식',step_10:'A3. 방법 청구항',step_11:'B2. 방법 도면',step_12:'C3. 방법 상세설명',step_13:'E1. AI 검토',step_14:'E4. 대안 청구항',step_15:'E3. 특허성 검토',step_16:'D3. 발명의 효과',step_17:'D1. 과제의 해결 수단',step_18:'F1. 부호의 설명',step_19:'F2. 요약서',step_20:'A4. 기록매체/프로그램 청구항'};
// Phase 없는 순수 이름 (프롬프트 내부용)
const STEP_NAMES_CLEAN={step_01:'발명의 명칭',step_02:'기술분야',step_03:'배경기술',step_04:'선행기술 검색',step_05:'해결하고자 하는 과제',step_06:'장치 청구항',step_07:'장치 도면',step_07c:'예시도/개념도',step_08:'장치 상세설명',step_09:'수학식',step_10:'방법 청구항',step_11:'방법 도면',step_12:'방법 상세설명',step_13:'AI 검토',step_14:'대안 청구항',step_15:'특허성 검토',step_16:'발명의 효과',step_17:'과제의 해결 수단',step_18:'부호의 설명',step_19:'요약서',step_20:'기록매체/프로그램 청구항'};

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

// ═══════════ STATE MANAGEMENT ═══════════
function clearAllState(){
  currentProjectId=null;outputs={};outputHistory={};scopeCheckResults={};selectedTitle='';selectedTitleEn='';selectedTitleType='';includeMethodClaims=true;
  usage={calls:0,inputTokens:0,outputTokens:0,cost:0};loadingState={};uploadedFiles=[];diagramData={};inventionScope=null;
  _judgmentCache.clear();_costTracking={judgment_calls:0,total_input_tokens:0,total_output_tokens:0,estimated_cost_usd:0,warned_50:false,stopped_100:false};
  projectRefStyleText='';requiredFigures=[];outputTimestamps={};stepUserCommands={};chatHistory={};
  conceptDiagramEnabled=false;conceptDiagramCount=0;conceptDiagramTypes=[];
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
  ['resultsBatch25','resultsBatchFinish','validationResults','previewArea','diagramsStep07','diagramsStep11','conceptDiagramsArea','fileList','requiredFiguresList','resultStep20','invention-scope-panel','scope-verification-summary','scope-verification-details'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='';});
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
    const _openRefl=reflectConceptsToSpec();
    if(_openRefl.desc||_openRefl.ref){
      if(outputs.step_08)_cascadeRender('step_08',outputs.step_08);
      if(outputs.step_18)_cascadeRender('step_18',outputs.step_18);
      saveProject(true);   // 신규 반영분 1회 영속 → 이후 열기는 멱등 no-op
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
  const dlLevels=['compact','standard','detailed','custom'];
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
async function saveProject(silent=false){if(!currentProjectId)return;const t=selectedTitle||document.getElementById('projectInput').value.slice(0,30)||'새 사건';const _payload={outputs,outputHistory,inventionScope,scopeCheckResults,costTracking:_costTracking,selectedTitle,selectedTitleEn,selectedTitleType,includeMethodClaims,usage,deviceCategory,deviceGeneralDep,deviceAnchorDep,deviceAnchorStart,anchorThemeMode,selectedAnchorThemes,methodCategory,methodGeneralDep,methodAnchorDep,methodAnchorStart,methodAnchorThemeMode,selectedMethodAnchorThemes,projectRefStyleText,requiredFigures,detailLevel,customDetailChars,diagramData,outputTimestamps,stepUserCommands,chatHistory,conceptDiagramEnabled,conceptDiagramCount,conceptDiagramTypes};console.log('[diag] saveProject payload size:',JSON.stringify(_payload).length,'chars');await App.sb.from('projects').update({title:t,invention_content:document.getElementById('projectInput').value,current_state_json:_payload}).eq('id',currentProjectId);if(!silent)App.showToast('저장됨');}

// ═══════════ [P-C1] INVENTION SCOPE ═══════════
function _parseJSONSafe(text) {
  try { return JSON.parse(text); } catch(e) {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) try { return JSON.parse(fenced[1].trim()); } catch(e) {}
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) try { return JSON.parse(braceMatch[0]); } catch(e) {}
  return null;
}

// [C1-3] Layer 1 가드: invention_scope 주입 블록 생성
function buildScopeGuardBlock(sid, variant) {
  if (!inventionScope || !inventionScope.locked_at) return '';
  const bl = inventionScope.baseline;
  if (!bl || !Array.isArray(bl.core_components)) return '';
  const exp = inventionScope.approved_expansions || [];
  const themes = (anchorThemeMode === 'manual' ? selectedAnchorThemes : [])
    .map(k => ANCHOR_THEMES.find(t => t.key === k))
    .filter(Boolean);

  if (variant === 'text') {
    return [
      '',
      '[발명 범위 준수 지침]',
      '아래 invention_scope는 이 발명의 확정된 기준선이다.',
      '이 범위를 벗어나는 신규 기술요소를 임의로 추가하지 말라.',
      '',
      '<baseline_components>',
      bl.core_components.map(c =>
        `- ${c.name}${c.aliases && c.aliases.length ? ' (별칭: '+c.aliases.join(', ')+')' : ''}`
      ).join('\n'),
      '</baseline_components>',
      '',
      '<baseline_functions>',
      (bl.core_functions || []).map(f => `- ${f.desc}`).join('\n'),
      '</baseline_functions>',
      '',
      exp.length ? '<approved_expansions>\n' +
        exp.map(e => `- ${e.component} (${e.type})`).join('\n') +
        '\n</approved_expansions>\n' : '',
      themes.length ? '<active_anchor_themes>\n' +
        themes.map(t => `- ${t.label}: ${t.desc}`).join('\n') +
        '\n</active_anchor_themes>\n' : '',
      '허용 규칙:',
      '1. 위 baseline/approved_expansions에 포함된 요소 자유 사용',
      '2. 자명한 하위개념 구체화 허용 (예: "딥러닝"→"CNN")',
      '3. 활성 앵커 테마에 따른 전략적 확장 허용',
      '4. 위 3가지에 해당하지 않는 신규 기술요소 추가 시, 해당 부분을',
      '   [[NOVEL: 요소명]] 마크업으로 명시적 표시',
      '5. 사용자 명시적 확장 지시가 있는 경우 [[NOVEL:]] 마크업 후 생성',
      '',
      // [C1-7] negative_constraints 제외 지시
      ..._buildNegativeConstraintsBlock()
    ].join('\n');
  }

  if (variant === 'mermaid') {
    return [
      '',
      '[도면 구성요소 제한]',
      '아래 허용 구성요소 목록을 참고하여 Mermaid 도면을 구성하라.',
      '각 노드의 레이블은 목록의 정확한 명칭을 사용하라.',
      '',
      '<allowed_components>',
      bl.core_components.map(c => `- ${c.name}`).join('\n'),
      exp.length ? exp.map(e => `- ${e.component} (확장)`).join('\n') : '',
      '</allowed_components>',
      '',
      themes.length ? '<active_anchor_themes>\n' +
        themes.map(t => `- ${t.label}`).join('\n') +
        '\n</active_anchor_themes>\n' : '',
      '허용 규칙:',
      '1. 위 목록의 구성요소를 자유롭게 배치',
      '2. 앵커 테마에 따른 새 노드 추가 시 실제 기술명 사용 (태깅 불필요)',
      '3. Mermaid 문법 유지 (주석/마크업으로 문법을 깨지 말 것)',
      '',
      // [C1-7] negative_constraints 제외 지시
      ..._buildNegativeConstraintsBlock()
    ].join('\n');
  }

  return '';
}
// [C1-7] negative_constraints → 제외 지시 블록 생성
function _buildNegativeConstraintsBlock() {
  const negList = (inventionScope && inventionScope.negative_constraints) || [];
  if (negList.length === 0) return [];
  return [
    '',
    '<rejected_components>',
    '다음 구성요소들은 이전 검증에서 범위 이탈로 판정되어',
    '변리사가 명시적으로 제외 지시한 요소들이다.',
    '이번 응답에서 사용하지 말 것:',
    ...negList.map(n => `- ${n.component}${n.reason ? ' (사유: ' + n.reason + ')' : ''}`),
    '</rejected_components>',
    ''
  ];
}
function _maybeScopeGuard(sid, variant) {
  if (variant === 'text' && !SCOPE_GUARDED_TEXT_STEPS.includes(sid)) return '';
  if (variant === 'mermaid' && !SCOPE_GUARDED_MERMAID_STEPS.includes(sid)) return '';
  return buildScopeGuardBlock(sid, variant);
}

// ═══════════ [C1-4] LAYER 2: EXTRACTOR + DIFF ═══════════

function extractNovelMarkers(text) {
  const pattern = /\[\[NOVEL:\s*([^\]]+?)\s*\]\]/g;
  const results = [];
  let m;
  while ((m = pattern.exec(text)) !== null) results.push(m[1].trim());
  return results;
}

function extractMermaidNodes(mermaidText) {
  const results = [];
  // ID["이름(참조번호)"] — 장치 도면
  const p1 = /\w+\["([^"]+?)\((\d+)\)"\]/g;
  // ID["단계명(S번호)"] — 방법 도면
  const p2 = /\w+\["([^"]+?)\((S\d+)\)"\]/g;
  // ID{"조건"} — 조건 분기
  const p3 = /\w+\{"([^}]+)"\}/g;
  // ID(["라벨"]) — 시작/종료
  const p4 = /\w+\(\["([^"]+)"\]\)/g;
  // ID["라벨"] — 참조번호 없는 일반 노드
  const p5 = /\w+\["([^"]+)"\]/g;
  let mm;
  while ((mm = p1.exec(mermaidText)) !== null) results.push({ name: mm[1].trim(), ref: mm[2], source: 'device_node' });
  while ((mm = p2.exec(mermaidText)) !== null) results.push({ name: mm[1].trim(), ref: mm[2], source: 'method_node' });
  while ((mm = p3.exec(mermaidText)) !== null) results.push({ name: mm[1].trim(), ref: null, source: 'decision' });
  while ((mm = p4.exec(mermaidText)) !== null) results.push({ name: mm[1].trim(), ref: null, source: 'terminal' });
  // p5 fallback: 참조번호 없는 라벨 (p1/p2에서 이미 캡처된 것과 중복 가능)
  const captured = new Set(results.map(r => r.name));
  while ((mm = p5.exec(mermaidText)) !== null) {
    const name = mm[1].trim();
    if (!captured.has(name) && !/\(\d+\)/.test(name) && !/\(S\d+\)/.test(name)) {
      results.push({ name, ref: null, source: 'label_only' });
      captured.add(name);
    }
  }
  // 중복 제거 (name+ref 기준, 첫 등장 유지)
  const seen = new Set();
  return results.filter(n => {
    const key = `${n.ref||''}:${n.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SCOPE_EXTRACT_SYSTEM_PROMPT = `당신은 특허 명세서 분석 전문가이다.
입력된 특허 문서에서 등장하는 기술적 구성요소를 추출한다.
원칙: 텍스트에 명시된 구성요소만 추출. 추론·추측·상식 추가 금지.
같은 개념의 다른 표현도 별도 요소로 기록. 일반 접속사·동사 제외.`;

const SCOPE_EXTRACT_SCHEMA = `응답은 순수 JSON. 설명·prefix·코드블록 금지.
{"components":[{"name":"구성요소명","context":"등장 문맥 50자 이내"}]}`;

async function extractComponentsFromText(sid, text) {
  if (!text || text.trim().length < 30) return { status: 'skipped_empty', components: [] };
  const prompt = `${SCOPE_EXTRACT_SCHEMA}\n\n<patent_text>\n${text.slice(0, 20000)}\n</patent_text>`;
  try {
    const resp = await App.callClaudeSonnet(prompt, 4096);
    const parsed = _parseJSONSafe(resp.text);
    if (!parsed || !Array.isArray(parsed.components)) return { status: 'llm_failed_partial', components: [] };
    return {
      status: 'ok',
      components: parsed.components.map(c => ({ name: c.name, context: c.context || '', source: 'llm' }))
    };
  } catch (e) {
    console.warn('[C1-4] extractComponentsFromText failed:', e.message);
    return { status: 'llm_failed_partial', components: [] };
  }
}

function matchComponentToScope(componentName) {
  if (!inventionScope || !inventionScope.baseline) return null;
  const normalize = s => s.toLowerCase().replace(/\s+/g, '').trim();
  const target = normalize(componentName);
  if (!target) return null;
  for (const c of inventionScope.baseline.core_components || []) {
    if (normalize(c.name) === target) return { via: 'baseline:' + (c.id || c.name) };
    for (const alias of (c.aliases || [])) {
      if (normalize(alias) === target) return { via: 'alias:' + alias };
    }
  }
  for (const e of inventionScope.approved_expansions || []) {
    if (normalize(e.component) === target) return { via: 'expansion:' + e.component };
  }
  return null;
}

async function runScopeCheck_text(sid) {
  if (!inventionScope?.locked_at) return;
  if (!outputs[sid]) return;
  const text = outputs[sid];
  const novelMarkers = extractNovelMarkers(text);
  const llmResult = await extractComponentsFromText(sid, text);
  const allComponents = [];
  const seen = new Set();
  const addComp = (name, context, source) => {
    const key = name.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); allComponents.push({ name, context, source }); }
  };
  novelMarkers.forEach(n => addComp(n, '', 'novel_marker'));
  llmResult.components.forEach(c => addComp(c.name, c.context, c.source));
  const matched = [], novel = [];
  for (const comp of allComponents) {
    const m = matchComponentToScope(comp.name);
    if (m) matched.push({ name: comp.name, matched_via: m.via });
    else {
      const idx = text.indexOf(comp.name);
      novel.push({
        name: comp.name,
        context_snippet: comp.context || (idx >= 0 ? text.slice(Math.max(0, idx - 80), idx + 80) : ''),
        discovered_via: comp.source === 'novel_marker' ? 'novel_marker' : 'llm_extraction'
      });
    }
  }
  scopeCheckResults[sid] = {
    sid,
    extracted_at: new Date().toISOString(),
    source_type: 'text',
    extraction_method: llmResult.status === 'ok' ? 'hybrid' : 'partial',
    extraction_status: llmResult.status,
    all_components: allComponents,
    matched_to_scope: matched,
    novel_components: novel,
    conflicts: []
  };
  saveProject(true);
  return scopeCheckResults[sid];
}

async function runScopeCheck_mermaid(sid) {
  if (!inventionScope?.locked_at) return;
  if (!outputs[sid]) return;
  const nodes = extractMermaidNodes(outputs[sid]);
  const matched = [], novel = [];
  for (const node of nodes) {
    const m = matchComponentToScope(node.name);
    if (m) matched.push({ name: node.name, ref: node.ref, matched_via: m.via });
    else novel.push({ name: node.name, ref: node.ref, context_snippet: 'Mermaid node ' + (node.ref || node.name), discovered_via: 'mermaid_extraction' });
  }
  scopeCheckResults[sid] = {
    sid,
    extracted_at: new Date().toISOString(),
    source_type: 'mermaid',
    extraction_method: 'regex',
    extraction_status: 'ok',
    all_components: nodes.map(n => ({ name: n.name, ref: n.ref, source: n.source })),
    matched_to_scope: matched,
    novel_components: novel,
    conflicts: []
  };
  saveProject(true);
  return scopeCheckResults[sid];
}

function detectMermaidRefConflicts() {
  const mermaidSids = SCOPE_GUARDED_MERMAID_STEPS.filter(sid => outputs[sid]);
  if (mermaidSids.length < 2) return;
  const refMap = {};
  for (const sid of mermaidSids) {
    const nodes = extractMermaidNodes(outputs[sid]);
    for (const n of nodes) {
      if (!n.ref) continue;
      if (!refMap[n.ref]) refMap[n.ref] = [];
      refMap[n.ref].push({ sid, name: n.name });
    }
  }
  const conflicts = {};
  for (const [ref, occurrences] of Object.entries(refMap)) {
    const uniqueNames = new Set(occurrences.map(o => o.name));
    if (uniqueNames.size > 1) {
      for (const occ of occurrences) {
        if (!conflicts[occ.sid]) conflicts[occ.sid] = [];
        conflicts[occ.sid].push({ ref, names: [...uniqueNames], occurrences });
      }
    }
  }
  for (const sid of mermaidSids) {
    if (scopeCheckResults[sid]) scopeCheckResults[sid].conflicts = conflicts[sid] || [];
  }
}

// [C1-4] Layer 2 공개 API
async function runScopeCheck(sid) {
  if (!inventionScope?.locked_at) { App.showToast('발명 범위가 확정되지 않았습니다', 'info'); return null; }
  let result = null;
  if (SCOPE_GUARDED_TEXT_STEPS.includes(sid)) {
    result = await runScopeCheck_text(sid);
  } else if (SCOPE_GUARDED_MERMAID_STEPS.includes(sid)) {
    result = await runScopeCheck_mermaid(sid);
    detectMermaidRefConflicts();
  }
  // [C1-5] 자동 판정 연쇄
  if (result && result.novel_components && result.novel_components.length > 0) {
    try { await runScopeJudgment(sid); } catch (e) {
      console.warn('[C1-5] runScopeJudgment failed for', sid, e.message);
    }
  }
  return result;
}
async function runScopeCheckAll() {
  const allSids = [...SCOPE_GUARDED_TEXT_STEPS, ...SCOPE_GUARDED_MERMAID_STEPS];
  const results = {};
  for (const sid of allSids) { if (outputs[sid]) results[sid] = await runScopeCheck(sid); }
  return results;
}

// ═══════════ [C1-5] LAYER 3: SONNET 판정 시스템 ═══════════

const SONNET_INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const SONNET_OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

const JUDGMENT_SYSTEM_PROMPT = `당신은 특허 명세서 심사 변리사이다.
발명의 기준선(invention_scope) 대비 새로 등장한 기술 요소를 3종으로 분류한다.

판정 기준:

1. strategic_anchor: 선택된 앵커 테마(예: 신뢰도 가중치, 임계값 적응 등)에 따른 전략적 확장. 출원인의 의도적 확장 가능성 높음.

2. elaboration: baseline 구성요소의 자명한 하위개념 또는 기술상식상 자명한 부속구성. 원 발명의 범위 내 구체화. 예: "딥러닝 모델" → "CNN 분류기", "무선 통신" → "BLE 모듈".

3. drift: baseline에도 없고 앵커 테마와도 무관하며 자명한 하위개념도 아닌 신규 기술 요소. 원 발명 범위 이탈 가능성. 예: 센서 기반 발명에 갑자기 "블록체인 검증" 등장.

confidence는 0.0~1.0 사이 소수. 0.85 이상이면 확신.

응답은 순수 JSON. 설명/prefix/코드블록 금지.
{"verdict":"strategic_anchor|elaboration|drift","confidence":0.0~1.0,"reason":"판정 근거 50자 이내","matched_anchor":"해당 anchor key 또는 null"}`;

function _contextHash(text) {
  const snippet = (text || '').substring(0, 150);
  let h = 2166136261;
  for (let i = 0; i < snippet.length; i++) {
    h ^= snippet.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function _buildJudgmentPrompt_direct(component, contextSnippet) {
  if (!inventionScope?.baseline) return null;
  const bl = inventionScope.baseline;
  const exp = inventionScope.approved_expansions || [];
  const themes = (anchorThemeMode === 'manual' ? selectedAnchorThemes : [])
    .map(k => ANCHOR_THEMES.find(t => t.key === k))
    .filter(Boolean);

  return `<baseline>
핵심 구성: ${(bl.core_components||[]).map(c => c.name).join(', ')}
핵심 기능: ${(bl.core_functions || []).map(f => f.desc).join('; ')}
문제: ${bl.problem_space || ''}
해결: ${bl.solution_space || ''}
</baseline>

<approved_expansions>
${exp.length ? exp.map(e => `- ${e.component} (${e.type})`).join('\n') : '(없음)'}
</approved_expansions>

<anchor_themes>
${themes.length ? themes.map(t => `- ${t.key}: ${t.label} - ${t.desc}`).join('\n') : '(없음)'}
</anchor_themes>

<novel_component>
이름: ${component.name}
맥락: ${contextSnippet || ''}
</novel_component>

위 novel_component를 strategic_anchor / elaboration / drift 중 어느 것인지 판정하라.`;
}

function _buildJudgmentPrompt_postReview(component, contextSnippet, originalText) {
  const direct = _buildJudgmentPrompt_direct(component, contextSnippet);
  if (!direct) return null;

  return `${direct}

<review_context>
이 novel_component는 AI 검토(step_13) 과정에서 원본 상세설명에 추가되었다.

검토 지시 의도: 명확성 개선, 실시예 보강, 기재불비 방지 등
검토 전 원본: ${(originalText || '').substring(0, 1500)}
</review_context>

참고: 검토 과정에서 추가된 요소가 검토 지시 의도(명확성 개선 등)에 부합하면 elaboration 가능성 높음. 의도와 무관하게 추가된 신규 기술은 drift.`;
}

function _checkCostThresholds() {
  if (!_costTracking.warned_50 && _costTracking.judgment_calls >= 50) {
    _costTracking.warned_50 = true;
    App.showToast(
      `검증 판정 ${_costTracking.judgment_calls}회, 누적 비용 약 $${_costTracking.estimated_cost_usd.toFixed(2)}`,
      'warning'
    );
  }
  if (!_costTracking.stopped_100 && _costTracking.judgment_calls >= 100) {
    _costTracking.stopped_100 = true;
    const proceed = confirm(
      `판정 호출이 ${_costTracking.judgment_calls}회에 도달했습니다. ` +
      `누적 비용 약 $${_costTracking.estimated_cost_usd.toFixed(2)}.\n\n` +
      `계속 진행하시겠습니까? 취소하면 이후 판정은 중단되고 undetermined로 표시됩니다.`
    );
    if (proceed) {
      _costTracking.stopped_100 = false;
    }
  }
}

async function classifyNovelComponent(component, contextSnippet) {
  const ctxHash = _contextHash(contextSnippet);
  const cacheKey = `${component.name}||${ctxHash}`;

  if (_judgmentCache.has(cacheKey)) {
    return { ..._judgmentCache.get(cacheKey), from_cache: true };
  }

  if (_costTracking.stopped_100) {
    return { verdict: 'undetermined', confidence: 0, reason: '비용 상한 도달로 판정 중단', from_cache: false, judged_at: new Date().toISOString() };
  }

  const prompt = _buildJudgmentPrompt_direct(component, contextSnippet);
  if (!prompt) {
    return { verdict: 'undetermined', confidence: 0, reason: 'invention_scope 없음', from_cache: false, judged_at: new Date().toISOString() };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const beforeIt = usage.inputTokens, beforeOt = usage.outputTokens;
      const resp = await App.callClaudeSonnet(`${JUDGMENT_SYSTEM_PROMPT}\n\n${prompt}`, 512);
      const deltaIt = usage.inputTokens - beforeIt;
      const deltaOt = usage.outputTokens - beforeOt;

      _costTracking.judgment_calls++;
      _costTracking.total_input_tokens += deltaIt;
      _costTracking.total_output_tokens += deltaOt;
      _costTracking.estimated_cost_usd =
        _costTracking.total_input_tokens * SONNET_INPUT_COST_PER_TOKEN +
        _costTracking.total_output_tokens * SONNET_OUTPUT_COST_PER_TOKEN;
      _checkCostThresholds();

      const parsed = _parseJSONSafe(resp.text);
      if (!parsed || !parsed.verdict) throw new Error('JSON 파싱 실패 또는 verdict 누락');

      const result = {
        verdict: parsed.verdict,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reason: parsed.reason || '',
        matched_anchor: parsed.matched_anchor || null,
        from_cache: false,
        judged_at: new Date().toISOString()
      };
      _judgmentCache.set(cacheKey, result);
      return result;

    } catch (e) {
      lastError = e;
      console.warn(`[C1-5] classifyNovelComponent attempt ${attempt} failed:`, e.message);
      if (attempt === 1) await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { verdict: 'undetermined', confidence: 0, reason: `Sonnet 판정 실패: ${lastError?.message || 'unknown'}`, from_cache: false, judged_at: new Date().toISOString() };
}

async function classifyNovelComponent_postReview(component, contextSnippet, originalText) {
  const ctxHash = _contextHash(contextSnippet);
  const cacheKey = `${component.name}||${ctxHash}||postReview`;

  if (_judgmentCache.has(cacheKey)) {
    return { ..._judgmentCache.get(cacheKey), from_cache: true };
  }

  if (_costTracking.stopped_100) {
    return { verdict: 'undetermined', confidence: 0, reason: '비용 상한 도달', is_post_review: true, from_cache: false, judged_at: new Date().toISOString() };
  }

  const prompt = _buildJudgmentPrompt_postReview(component, contextSnippet, originalText);
  if (!prompt) {
    return { verdict: 'undetermined', confidence: 0, reason: 'invention_scope 없음', is_post_review: true, from_cache: false, judged_at: new Date().toISOString() };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const beforeIt = usage.inputTokens, beforeOt = usage.outputTokens;
      const resp = await App.callClaudeSonnet(`${JUDGMENT_SYSTEM_PROMPT}\n\n${prompt}`, 512);
      const deltaIt = usage.inputTokens - beforeIt;
      const deltaOt = usage.outputTokens - beforeOt;

      _costTracking.judgment_calls++;
      _costTracking.total_input_tokens += deltaIt;
      _costTracking.total_output_tokens += deltaOt;
      _costTracking.estimated_cost_usd =
        _costTracking.total_input_tokens * SONNET_INPUT_COST_PER_TOKEN +
        _costTracking.total_output_tokens * SONNET_OUTPUT_COST_PER_TOKEN;
      _checkCostThresholds();

      const parsed = _parseJSONSafe(resp.text);
      if (!parsed || !parsed.verdict) throw new Error('JSON 파싱 실패');

      const result = {
        verdict: parsed.verdict,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reason: parsed.reason || '',
        matched_anchor: parsed.matched_anchor || null,
        is_post_review: true,
        from_cache: false,
        judged_at: new Date().toISOString()
      };
      _judgmentCache.set(cacheKey, result);
      return result;

    } catch (e) {
      lastError = e;
      console.warn(`[C1-5] classifyPostReview attempt ${attempt} failed:`, e.message);
      if (attempt === 1) await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { verdict: 'undetermined', confidence: 0, reason: `Sonnet 판정 실패: ${lastError?.message || 'unknown'}`, is_post_review: true, from_cache: false, judged_at: new Date().toISOString() };
}

function _autoApproveIfEligible(component, verdict, sid) {
  if (verdict.verdict !== 'elaboration') return false;
  if (verdict.confidence < 0.85) return false;
  const exists = (inventionScope.approved_expansions || []).some(e => e.component === component.name);
  if (exists) return false;
  if (!inventionScope.approved_expansions) inventionScope.approved_expansions = [];
  const expansion = {
    type: 'elaboration', component: component.name, anchor_theme: null,
    approved_at: new Date().toISOString(), approved_by: 'auto',
    approval_reason: verdict.reason, originating_step: sid, confidence: verdict.confidence
  };
  inventionScope.approved_expansions.push(expansion);
  _appendAuditLog('expansion_auto_approved', expansion);
  return true;
}

async function runScopeJudgment(sid) {
  const result = scopeCheckResults[sid];
  if (!result) return null;
  if (!result.novel_components || result.novel_components.length === 0) {
    result.verdicts = [];
    result.judgment_status = 'no_novel';
    return result;
  }

  const verdicts = [];
  const isPostReview = sid === 'step_13_applied' || sid === 'step_13_applied_method';
  const originalText = isPostReview
    ? (sid === 'step_13_applied' ? outputs.step_08 : outputs.step_12)
    : null;

  for (const comp of result.novel_components) {
    let v;
    if (isPostReview) {
      v = await classifyNovelComponent_postReview(comp, comp.context_snippet, originalText);
    } else {
      v = await classifyNovelComponent(comp, comp.context_snippet);
    }
    v.component = comp.name;
    verdicts.push(v);
    const approved = _autoApproveIfEligible(comp, v, sid);
    v.auto_approved = approved;
  }

  result.verdicts = verdicts;
  result.judgment_status = 'ok';
  result.judgment_at = new Date().toISOString();
  result.cost_tracking_snapshot = { ..._costTracking };
  saveProject(true);
  return result;
}

async function runAllJudgments() {
  if (!inventionScope?.locked_at) {
    App.showToast('발명 범위가 확정되지 않았습니다', 'warning');
    return;
  }
  const sids = Object.keys(scopeCheckResults);
  const totalBefore = _costTracking.judgment_calls;
  for (const sid of sids) {
    if (_costTracking.stopped_100) break;
    await runScopeJudgment(sid);
  }
  const delta = _costTracking.judgment_calls - totalBefore;
  App.showToast(
    `판정 완료: ${delta}회 추가 호출 (누적 $${_costTracking.estimated_cost_usd.toFixed(3)})`,
    'success'
  );
}

async function extractInventionScope() {
  const input = document.getElementById('projectInput')?.value || '';
  const trimmed = input.trim();
  if (trimmed.length < 10) {
    App.showToast('발명 설명을 입력해주세요 (최소 10자)', 'error');
    return;
  }
  if (trimmed.length < 50) {
    App.showToast('발명 설명이 짧습니다 (권장 50자 이상). 추출 결과가 부실할 수 있습니다.', 'warning');
  }
  if (globalProcessing) return;
  setGlobalProcessing(true);
  try {
    const prompt = `${INVENTION_SCOPE_SCHEMA_INSTRUCTION}\n\n<invention_description>\n${input}\n</invention_description>`;
    const resp = await App.callClaudeSonnet(prompt, 4096);
    const parsed = _parseJSONSafe(resp.text);
    if (!parsed || !parsed.core_components) {
      App.showToast('발명 범위 추출 실패: JSON 파싱 불가', 'error');
      return;
    }
    inventionScope = {
      locked_at: new Date().toISOString(),
      locked_by: App.currentUser?.id || 'unknown',
      source_text_hash: input.length + '_' + input.slice(0, 20),
      baseline: parsed,
      approved_expansions: [],
      audit_log: [],
      _previous_versions: inventionScope?._previous_versions || []
    };
    saveProject(true);
    renderInventionScopePanel();
    App.showToast('발명 범위가 확정되었습니다', 'success');
  } catch (e) {
    App.showToast('발명 범위 추출 실패: ' + e.message, 'error');
  } finally {
    setGlobalProcessing(false);
  }
}

function unlockInventionScope() {
  if (!inventionScope) return;
  if (!confirm('발명 범위를 재확정하시겠습니까? 이전 범위 이력은 보관됩니다.')) return;
  inventionScope._previous_versions = inventionScope._previous_versions || [];
  const archived = Object.assign({}, inventionScope, { archived_at: new Date().toISOString() });
  delete archived._previous_versions;
  inventionScope._previous_versions.push(archived);
  inventionScope.locked_at = null;
  inventionScope.baseline = null;
  saveProject(true);
  renderInventionScopePanel();
}

function renderInventionScopePanel() {
  const panel = document.getElementById('invention-scope-panel');
  if (!panel) return;
  if (!inventionScope || !inventionScope.locked_at) {
    panel.className = 'scope-panel';
    panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between">
      <div><span class="ico" data-icon="search"></span> <strong style="font-size:13px">발명 범위</strong>
      <span style="font-size:11px;color:var(--dt-g500);margin-left:6px">범위를 확정하면 이후 스텝에서 범위 초과 여부를 검증합니다.</span></div>
      <button class="btn btn-outline btn-sm" onclick="extractInventionScope()">범위 확정</button>
    </div>`;
    return;
  }
  const b = inventionScope.baseline;
  const lockedDate = new Date(inventionScope.locked_at).toLocaleDateString('ko-KR');
  const prevCount = (inventionScope._previous_versions || []).length;
  const prevBadge = prevCount ? `<span class="badge badge-neutral" style="margin-left:6px;font-size:10px">이전 ${prevCount}건</span>` : '';

  // [C1-6a] 구성요소 칩 (편집 가능)
  const comps = (b.core_components || []).map(c => {
    const cid = App.escapeHtml(c.id || c.name);
    return `<span class="scope-chip" onclick="editComponent('${cid.replace(/'/g,"\\'")}')">${App.escapeHtml(c.name)}<span style="color:var(--dt-g500);margin-left:4px;font-size:10px">${App.escapeHtml(c.role||'')}</span><span class="chip-edit-icon">✎</span></span>`;
  }).join('');

  // 핵심 기능
  const funcs = (b.core_functions || []).map(f =>
    `<li style="font-size:12px;margin-bottom:2px">${App.escapeHtml(f.desc)} <span style="color:var(--dt-g500)">[${(f.component_refs||[]).join(',')}]</span></li>`
  ).join('');
  const nonscope = (b.explicit_nonscope || []).length
    ? `<div style="margin-top:6px;font-size:11px;color:var(--dt-g500)">제외: ${b.explicit_nonscope.map(n => App.escapeHtml(n)).join(', ')}</div>` : '';

  // [C1-6a] 승인된 확장
  const expansions = inventionScope.approved_expansions || [];
  const expansionHtml = expansions.length === 0
    ? `<p class="scope-empty">청구항 생성 후 검증이 실행되면 여기에 승인된 확장 요소가 표시됩니다.</p>`
    : expansions.map(e =>
        `<span class="scope-chip" style="background:var(--dt-brand-light)">${App.escapeHtml(e.component)} <small style="color:var(--dt-g500)">(${App.escapeHtml(e.type||'')})</small> <button onclick="removeExpansion('${App.escapeHtml(e.component).replace(/'/g,"\\'")}')" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--dt-g500);padding:0;margin-left:2px">×</button></span>`
      ).join('');

  panel.className = 'scope-panel locked';
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div><span class="ico" data-icon="lock"></span> <strong style="font-size:13px">발명 범위 확정됨</strong>
    <span style="font-size:11px;color:var(--dt-g500);margin-left:6px">${lockedDate}</span>${prevBadge}</div>
    <button class="btn btn-ghost btn-sm" onclick="unlockInventionScope()">재확정</button>
  </div>
  <div class="scope-section">
    <div class="scope-section-title clickable" onclick="editProblemSpace()">과제 <span class="edit-icon">✎</span></div>
    <div class="scope-section-content">${App.escapeHtml(b.problem_space || '')}</div>
  </div>
  <div class="scope-section">
    <div class="scope-section-title clickable" onclick="editSolutionSpace()">해결 <span class="edit-icon">✎</span></div>
    <div class="scope-section-content">${App.escapeHtml(b.solution_space || '')}</div>
  </div>
  <div class="scope-section">
    <div class="scope-section-title">핵심 구성 (${(b.core_components||[]).length}) <button class="scope-add-btn" onclick="addComponent()">+ 추가</button></div>
    <div class="scope-components">${comps}</div>
  </div>
  <details class="scope-section">
    <summary class="scope-section-title" style="cursor:pointer">핵심 기능 (${(b.core_functions||[]).length}건)</summary>
    <ul style="margin:4px 0 0 16px;padding:0">${funcs}</ul>
    ${nonscope}
  </details>
  <details class="scope-section">
    <summary class="scope-section-title" style="cursor:pointer">승인된 확장 (${expansions.length})</summary>
    <div class="scope-components" style="margin-top:4px">${expansionHtml}</div>
  </details>`;
}

// ═══════════ [C1-6a] BASELINE 편집 UI ═══════════

function _appendAuditLog(action, data) {
  if (!inventionScope) return;
  if (!inventionScope.audit_log) inventionScope.audit_log = [];
  inventionScope.audit_log.push({
    action,
    data,
    timestamp: new Date().toISOString(),
    user: App.currentUser?.id || 'unknown'
  });
}

function editComponent(componentId) {
  if (!inventionScope?.baseline) return;
  const comp = inventionScope.baseline.core_components.find(c =>
    (c.id || c.name) === componentId);
  if (!comp) return;
  _editingComponentId = componentId;
  document.getElementById('scopeComponentModalTitle').textContent = '구성요소 편집';
  document.getElementById('scope-comp-name').value = comp.name || '';
  document.getElementById('scope-comp-role').value = comp.role || '';
  document.getElementById('scope-comp-delete-btn').style.display = '';
  renderAliasesInModal(comp.aliases || []);
  setupAliasInputHandler();
  document.getElementById('scopeComponentModal').style.display = 'flex';
  document.getElementById('scope-comp-name').focus();
}

function addComponent() {
  if (!inventionScope?.baseline) return;
  _editingComponentId = null;
  document.getElementById('scopeComponentModalTitle').textContent = '구성요소 추가';
  document.getElementById('scope-comp-name').value = '';
  document.getElementById('scope-comp-role').value = '';
  document.getElementById('scope-comp-delete-btn').style.display = 'none';
  renderAliasesInModal([]);
  setupAliasInputHandler();
  document.getElementById('scopeComponentModal').style.display = 'flex';
  document.getElementById('scope-comp-name').focus();
}

function closeScopeComponentModal() {
  document.getElementById('scopeComponentModal').style.display = 'none';
  _editingComponentId = null;
}

function renderAliasesInModal(aliases) {
  _modalAliases = [...aliases];
  const container = document.getElementById('scope-aliases-container');
  if (!container) return;
  container.innerHTML = _modalAliases.map((a, i) =>
    `<span class="alias-tag">${App.escapeHtml(a)}<button onclick="removeAliasAt(${i})">×</button></span>`
  ).join('');
}

function removeAliasAt(index) {
  _modalAliases.splice(index, 1);
  renderAliasesInModal(_modalAliases);
}

function setupAliasInputHandler() {
  const input = document.getElementById('scope-alias-input');
  if (!input || input._bound) return;
  input._bound = true;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val && !_modalAliases.includes(val)) {
        _modalAliases.push(val);
        renderAliasesInModal(_modalAliases);
      }
      input.value = '';
    }
  });
}

function saveComponent() {
  const name = document.getElementById('scope-comp-name').value.trim();
  const role = document.getElementById('scope-comp-role').value.trim();
  if (!name) { App.showToast('이름은 필수입니다', 'error'); return; }
  if (!inventionScope?.baseline) return;
  if (!Array.isArray(inventionScope.baseline.core_components)) {
    inventionScope.baseline.core_components = [];
  }
  const components = inventionScope.baseline.core_components;

  if (_editingComponentId === null) {
    const newId = 'c' + Date.now();
    components.push({ id: newId, name, role: role || undefined, aliases: [..._modalAliases] });
    _appendAuditLog('component_added', { id: newId, name });
  } else {
    const idx = components.findIndex(c => (c.id || c.name) === _editingComponentId);
    if (idx === -1) { App.showToast('구성요소를 찾을 수 없습니다', 'error'); closeScopeComponentModal(); return; }
    const prev = Object.assign({}, components[idx]);
    components[idx].name = name;
    components[idx].role = role || undefined;
    components[idx].aliases = [..._modalAliases];
    _appendAuditLog('component_edited', { id: _editingComponentId, before: prev, after: components[idx] });
  }
  saveProject(true);
  renderInventionScopePanel();
  closeScopeComponentModal();
  App.showToast(_editingComponentId ? '구성요소가 수정되었습니다' : '구성요소가 추가되었습니다', 'success');
}

function deleteComponent() {
  if (_editingComponentId === null) return;
  if (!inventionScope?.baseline) return;
  const components = inventionScope.baseline.core_components;
  const idx = components.findIndex(c => (c.id || c.name) === _editingComponentId);
  if (idx === -1) return;
  const comp = components[idx];
  if (!confirm(`"${comp.name}" 구성요소를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
  const removed = components.splice(idx, 1)[0];
  _appendAuditLog('component_deleted', { id: _editingComponentId, data: removed });
  saveProject(true);
  renderInventionScopePanel();
  closeScopeComponentModal();
  App.showToast('구성요소가 삭제되었습니다', 'success');
}

function editProblemSpace() {
  if (!inventionScope?.baseline) return;
  const current = inventionScope.baseline.problem_space || '';
  const newVal = prompt('과제 설명을 입력하세요:', current);
  if (newVal === null) return;
  const trimmed = newVal.slice(0, 300);
  _appendAuditLog('problem_space_edited', { before: current, after: trimmed });
  inventionScope.baseline.problem_space = trimmed;
  saveProject(true);
  renderInventionScopePanel();
  App.showToast('과제가 수정되었습니다', 'success');
}

function editSolutionSpace() {
  if (!inventionScope?.baseline) return;
  const current = inventionScope.baseline.solution_space || '';
  const newVal = prompt('해결 방법을 입력하세요:', current);
  if (newVal === null) return;
  const trimmed = newVal.slice(0, 300);
  _appendAuditLog('solution_space_edited', { before: current, after: trimmed });
  inventionScope.baseline.solution_space = trimmed;
  saveProject(true);
  renderInventionScopePanel();
  App.showToast('해결 방법이 수정되었습니다', 'success');
}

function removeExpansion(componentName) {
  if (!inventionScope?.approved_expansions) return;
  if (!confirm(`"${componentName}" 승인을 해제하시겠습니까?`)) return;
  const idx = inventionScope.approved_expansions.findIndex(e => e.component === componentName);
  if (idx === -1) return;
  const removed = inventionScope.approved_expansions.splice(idx, 1)[0];
  _appendAuditLog('expansion_removed', removed);
  saveProject(true);
  renderInventionScopePanel();
  App.showToast('확장 승인이 해제되었습니다', 'success');
}

// ═══════════ [C1-6b] 판정 결과 UI ═══════════

function _verdictLabel(verdict) {
  return { elaboration: '범위 내 구체화', strategic_anchor: '전략적 확장', drift: '범위 이탈', undetermined: '판정 보류' }[verdict] || verdict;
}
function _verdictBadgeClass(verdict) {
  return { elaboration: 'verdict-elaboration', strategic_anchor: 'verdict-anchor', drift: 'verdict-drift', undetermined: 'verdict-undetermined' }[verdict] || '';
}
function _verdictIcon(verdict) {
  return { elaboration: '✓', strategic_anchor: '↗', drift: '!', undetermined: '?' }[verdict] || '·';
}

function renderScopeBadgeSummary(sid) {
  const result = scopeCheckResults[sid];
  if (!result || !result.verdicts || result.verdicts.length === 0) return '';
  const verdicts = result.verdicts;
  const driftCount = verdicts.filter(v => v.verdict === 'drift').length;
  const undetCount = verdicts.filter(v => v.verdict === 'undetermined').length;
  const total = verdicts.length;
  let summary;
  if (driftCount > 0) {
    summary = `<span class="scope-badge verdict-drift" onclick="openScopeDetailPanel('${sid}')">! 범위 이탈 ${driftCount}건 / 전체 ${total}건</span>`;
  } else if (undetCount > 0) {
    summary = `<span class="scope-badge verdict-undetermined" onclick="openScopeDetailPanel('${sid}')">? 판정 보류 ${undetCount}건</span>`;
  } else {
    summary = `<span class="scope-badge verdict-elaboration" onclick="openScopeDetailPanel('${sid}')">✓ 범위 내 ${total}건 전부 확인됨</span>`;
  }
  return `<div class="scope-badge-wrapper">${summary}</div>`;
}

function renderScopeVerificationSection() {
  const summaryEl = document.getElementById('scope-verification-summary');
  const detailsEl = document.getElementById('scope-verification-details');
  if (!summaryEl || !detailsEl) return;
  // ── [G5] 통합 리뷰 엔진 마운트는 page4(renderPreview)로 이전됨(트리거·결과 동일 위치).
  if (!inventionScope?.locked_at) {
    summaryEl.innerHTML = `<div class="scope-notice">발명 범위가 확정되지 않았습니다. A. 기본 탭에서 "범위 확정"을 먼저 진행하세요.</div>`;
    detailsEl.innerHTML = '';
    return;
  }
  const allSids = [...SCOPE_GUARDED_TEXT_STEPS, ...SCOPE_GUARDED_MERMAID_STEPS];
  const checkedSids = allSids.filter(sid => scopeCheckResults[sid]);
  if (checkedSids.length === 0) {
    summaryEl.innerHTML = `<div class="scope-notice">아직 검증된 스텝이 없습니다. 청구항·상세설명을 생성하면 자동으로 검증됩니다.</div>`;
    detailsEl.innerHTML = '';
    return;
  }
  let totalVerdicts = 0, totalDrift = 0, totalUndet = 0, totalElabor = 0, totalAnchor = 0, allConflicts = 0, totalCost = 0;
  for (const sid of checkedSids) {
    const r = scopeCheckResults[sid];
    if (r.verdicts) {
      totalVerdicts += r.verdicts.length;
      totalDrift += r.verdicts.filter(v => v.verdict === 'drift').length;
      totalUndet += r.verdicts.filter(v => v.verdict === 'undetermined').length;
      totalElabor += r.verdicts.filter(v => v.verdict === 'elaboration').length;
      totalAnchor += r.verdicts.filter(v => v.verdict === 'strategic_anchor').length;
    }
    if (r.conflicts) allConflicts += r.conflicts.length;
    if (r.cost_tracking_snapshot) totalCost = Math.max(totalCost, r.cost_tracking_snapshot.estimated_cost_usd || 0);
  }
  summaryEl.innerHTML = `
    <div class="scope-summary-cards">
      <div class="summary-card"><div class="summary-num">${totalVerdicts}</div><div class="summary-label">전체 판정</div></div>
      <div class="summary-card verdict-elaboration"><div class="summary-num">${totalElabor}</div><div class="summary-label">범위 내 구체화</div></div>
      <div class="summary-card verdict-anchor"><div class="summary-num">${totalAnchor}</div><div class="summary-label">전략적 확장</div></div>
      <div class="summary-card verdict-drift"><div class="summary-num">${totalDrift}</div><div class="summary-label">범위 이탈</div></div>
      <div class="summary-card verdict-undetermined"><div class="summary-num">${totalUndet}</div><div class="summary-label">판정 보류</div></div>
      ${allConflicts > 0 ? `<div class="summary-card verdict-drift"><div class="summary-num">${allConflicts}</div><div class="summary-label">도면 부호 충돌</div></div>` : ''}
    </div>
    <div class="scope-cost-info">
      누적 판정 비용: 약 $${totalCost.toFixed(3)}
      <button class="btn-small" onclick="runAllJudgments().then(renderScopeVerificationSection)">전체 재판정</button>
    </div>`;
  detailsEl.innerHTML = checkedSids.map(sid => renderSidVerificationCard(sid)).join('');
}

function renderSidVerificationCard(sid) {
  const r = scopeCheckResults[sid];
  if (!r) return '';
  const stepLabel = STEP_NAMES[sid] || sid;
  const verdicts = r.verdicts || [];
  const conflicts = r.conflicts || [];
  if (verdicts.length === 0 && conflicts.length === 0) {
    return `<div class="sid-verification-card"><div class="sid-card-header"><span class="sid-name">${App.escapeHtml(stepLabel)}</span><span class="sid-status">확인됨 · 신규 요소 없음</span></div></div>`;
  }
  const driftCount = verdicts.filter(v => v.verdict === 'drift').length;
  const undetCount = verdicts.filter(v => v.verdict === 'undetermined').length;
  let cardClass = 'sid-verification-card';
  if (driftCount > 0 || conflicts.length > 0) cardClass += ' has-drift';
  else if (undetCount > 0) cardClass += ' has-undetermined';
  return `<div class="${cardClass}">
    <div class="sid-card-header" onclick="toggleSidCard('${sid}')">
      <span class="sid-name">${App.escapeHtml(stepLabel)}</span>
      <span class="sid-counts">${verdicts.length > 0 ? `판정 ${verdicts.length}건` : ''}${conflicts.length > 0 ? ` · 도면 충돌 ${conflicts.length}건` : ''}</span>
      <span class="sid-toggle">▼</span>
    </div>
    <div class="sid-card-body" id="sid-card-body-${sid}" style="display:none">
      ${verdicts.map((v, i) => renderVerdictRow(sid, v, i)).join('')}
      ${conflicts.length > 0 ? renderConflictsSection(conflicts) : ''}
    </div>
  </div>`;
}

function toggleSidCard(sid) {
  const body = document.getElementById('sid-card-body-' + sid);
  if (!body) return;
  body.style.display = body.style.display !== 'none' ? 'none' : 'block';
}

function renderVerdictRow(sid, verdict, index) {
  const v = verdict.verdict;
  const badgeClass = _verdictBadgeClass(v);
  const label = _verdictLabel(v);
  const icon = _verdictIcon(v);
  const confidence = Math.round((verdict.confidence || 0) * 100);
  let statusText = '';
  if (verdict.auto_approved) statusText = '<span class="status-approved">자동 승인됨</span>';
  else if (verdict.manual_verdict === 'approved') statusText = '<span class="status-approved">수동 승인됨</span>';
  else if (verdict.manual_verdict === 'rejected') statusText = '<span class="status-rejected">거부됨</span>';
  else if (verdict.manual_verdict === 'regenerate_requested') statusText = '<span class="status-regenerating">재생성 요청됨</span>';
  let actions = '';
  if (v === 'drift' && !verdict.manual_verdict) {
    actions = `<div class="verdict-actions">
      <button class="btn-small btn-approve" onclick="approveDriftComponent('${sid}',${index})">승인 (범위 확장)</button>
      <button class="btn-small btn-reject" onclick="rejectDriftComponent('${sid}',${index})">거부 (사유 기록)</button>
      <button class="btn-small btn-regenerate" onclick="proposeRegeneration('${sid}',${index})">재생성 제안</button>
    </div>`;
  }
  return `<div class="verdict-row">
    <div class="verdict-main">
      <span class="scope-badge ${badgeClass}">${icon} ${label}</span>
      <span class="verdict-component">${App.escapeHtml(verdict.component || '')}</span>
      <span class="verdict-confidence">신뢰도 ${confidence}%</span>
      ${statusText}
    </div>
    ${verdict.reason ? `<div class="verdict-reason">${App.escapeHtml(verdict.reason)}</div>` : ''}
    ${actions}
  </div>`;
}

function renderConflictsSection(conflicts) {
  return `<div class="conflicts-section">
    <div class="conflicts-header">도면 간 참조부호 충돌</div>
    ${conflicts.map(c => `<div class="conflict-row">
      <span class="conflict-ref">부호 ${App.escapeHtml(String(c.ref || ''))}</span>
      <span>${(c.occurrences || []).map(o => `${o.sid}에서 "${App.escapeHtml(o.name)}"`).join(' ↔ ')}</span>
    </div>`).join('')}
  </div>`;
}

function approveDriftComponent(sid, verdictIndex) {
  const result = scopeCheckResults[sid];
  if (!result?.verdicts?.[verdictIndex]) return;
  const verdict = result.verdicts[verdictIndex];
  if (verdict.verdict !== 'drift' || verdict.manual_verdict) return;
  if (!inventionScope.approved_expansions) inventionScope.approved_expansions = [];
  const exists = inventionScope.approved_expansions.some(e => e.component === verdict.component);
  if (!exists) {
    inventionScope.approved_expansions.push({
      type: 'manual_drift_approved', component: verdict.component, anchor_theme: null,
      approved_at: new Date().toISOString(), approved_by: App.currentUser?.id || 'manual',
      approval_reason: '변리사 수동 승인 (drift → 확장으로 편입)',
      originating_step: sid, confidence: verdict.confidence, original_verdict: 'drift'
    });
  }
  verdict.manual_verdict = 'approved';
  verdict.manual_verdict_at = new Date().toISOString();
  _appendAuditLog('drift_manual_approved', { sid, component: verdict.component, confidence: verdict.confidence, reason: verdict.reason });
  saveProject(true);
  renderScopeVerificationSection();
  renderInventionScopePanel();
  App.showToast(`"${verdict.component}"을(를) 범위 확장으로 승인했습니다`, 'success');
}

function rejectDriftComponent(sid, verdictIndex) {
  const result = scopeCheckResults[sid];
  if (!result?.verdicts?.[verdictIndex]) return;
  const verdict = result.verdicts[verdictIndex];
  if (verdict.verdict !== 'drift' || verdict.manual_verdict) return;
  const reason = prompt(`"${verdict.component}"을(를) 범위 이탈로 거부합니다.\n거부 사유를 입력하세요:`, '');
  if (reason === null) return;
  verdict.manual_verdict = 'rejected';
  verdict.manual_verdict_at = new Date().toISOString();
  verdict.manual_verdict_reason = reason || '(사유 미기재)';
  _appendAuditLog('drift_manual_rejected', { sid, component: verdict.component, confidence: verdict.confidence, verdict_reason: verdict.reason, rejection_reason: reason || '(사유 미기재)' });
  saveProject(true);
  renderScopeVerificationSection();
  App.showToast(`"${verdict.component}" 거부 기록됨`, 'info');
}

function openScopeDetailPanel(sid) {
  switchTab(3);
  renderScopeVerificationSection();
  setTimeout(() => {
    const body = document.getElementById('sid-card-body-' + sid);
    if (body) { body.style.display = 'block'; body.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, 100);
}

// ═══════════ [C1-7] DRIFT 재생성 제안 ═══════════
let _regenerationContext = null;

function proposeRegeneration(sid, verdictIndex) {
  const result = scopeCheckResults[sid];
  if (!result || !result.verdicts || !result.verdicts[verdictIndex]) return;
  const targetVerdict = result.verdicts[verdictIndex];
  if (targetVerdict.verdict !== 'drift') return;
  if (targetVerdict.manual_verdict) {
    App.showToast('이미 처리된 항목입니다', 'info');
    return;
  }
  const allDrifts = result.verdicts
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.verdict === 'drift' && !v.manual_verdict);
  _regenerationContext = {
    sid,
    primaryVerdictIndex: verdictIndex,
    driftOptions: allDrifts.map(({ v, i }) => ({
      index: i,
      component: v.component,
      reason: v.reason,
      confidence: v.confidence,
      selected: true
    }))
  };
  renderRegenerationModal();
  document.getElementById('regenerationProposalModal').style.display = 'flex';
}

function renderRegenerationModal() {
  if (!_regenerationContext) return;
  const ctx = _regenerationContext;
  const stepLabel = STEP_NAMES[ctx.sid] || ctx.sid;
  const targetHtml = `
    <div class="regeneration-target">
      <div class="target-label">재생성 대상 스텝</div>
      <div class="target-name">${App.escapeHtml(ctx.sid)} · ${App.escapeHtml(stepLabel)}</div>
    </div>
    <div class="regeneration-drift-list">
      <div class="drift-list-label">제외할 범위 이탈 요소 (체크하여 선택)</div>
      ${ctx.driftOptions.map(opt => `
        <label class="drift-option">
          <input type="checkbox" ${opt.selected ? 'checked' : ''} onchange="toggleDriftOption(${opt.index})" />
          <span class="drift-option-name">${App.escapeHtml(opt.component)}</span>
          <span class="drift-option-confidence">신뢰도 ${Math.round(opt.confidence * 100)}%</span>
          <div class="drift-option-reason">${App.escapeHtml(opt.reason || '')}</div>
        </label>
      `).join('')}
    </div>`;
  document.getElementById('regeneration-target-info').innerHTML = targetHtml;
  const downstreamSids = _getDownstreamSids(ctx.sid);
  const downstreamHtml = downstreamSids.length === 0
    ? '<p class="no-downstream">영향받는 이후 단계가 없습니다.</p>'
    : `<div class="downstream-label">무효화될 이후 단계 (${downstreamSids.length}개)</div>
      <ul class="downstream-list">
        ${downstreamSids.map(s => {
          const label = STEP_NAMES[s] || s;
          const hasOutput = outputs[s] ? '✓ 작성됨' : '(미작성)';
          return `<li>${App.escapeHtml(s)} · ${App.escapeHtml(label)} <span class="downstream-status">${hasOutput}</span></li>`;
        }).join('')}
      </ul>`;
  document.getElementById('regeneration-downstream-list').innerHTML = downstreamHtml;
}

function toggleDriftOption(index) {
  if (!_regenerationContext) return;
  const opt = _regenerationContext.driftOptions.find(o => o.index === index);
  if (opt) opt.selected = !opt.selected;
  const btn = document.getElementById('regenerationExecuteBtn');
  const anySelected = _regenerationContext.driftOptions.some(o => o.selected);
  if (btn) {
    btn.disabled = !anySelected;
    btn.style.opacity = anySelected ? '1' : '0.5';
  }
}

function closeRegenerationModal() {
  document.getElementById('regenerationProposalModal').style.display = 'none';
  _regenerationContext = null;
}

function _getDownstreamSids(sid) {
  const visited = new Set();
  const queue = [sid];
  visited.add(sid);
  while (queue.length > 0) {
    const current = queue.shift();
    const deps = STEP_DEPENDENCIES[current];
    if (!deps) continue;
    const children = [...(deps.MUST || []), ...(deps.SHOULD || [])];
    for (const child of children) {
      if (!visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }
  visited.delete(sid);
  return [...visited];
}

async function executeRegeneration() {
  if (!_regenerationContext) return;
  const ctx = _regenerationContext;
  const selectedDrifts = ctx.driftOptions.filter(o => o.selected);
  if (selectedDrifts.length === 0) {
    App.showToast('제외할 요소를 하나 이상 선택하세요', 'info');
    return;
  }
  if (!inventionScope.negative_constraints) {
    inventionScope.negative_constraints = [];
  }
  const now = new Date().toISOString();
  for (const opt of selectedDrifts) {
    const existingIdx = inventionScope.negative_constraints.findIndex(
      n => n.component === opt.component
    );
    const entry = {
      component: opt.component,
      rejected_at: now,
      rejected_from_sid: ctx.sid,
      reason: 'drift 판정 재생성 - ' + (opt.reason || '변리사 명시적 제외'),
      regenerated_at: null
    };
    if (existingIdx === -1) {
      inventionScope.negative_constraints.push(entry);
    } else {
      inventionScope.negative_constraints[existingIdx] = entry;
    }
    const verdict = scopeCheckResults[ctx.sid].verdicts[opt.index];
    verdict.manual_verdict = 'regenerate_requested';
    verdict.manual_verdict_at = now;
  }
  _appendAuditLog('regeneration_proposed', {
    sid: ctx.sid,
    rejected_components: selectedDrifts.map(o => o.component)
  });
  const downstreamSids = _getDownstreamSids(ctx.sid);
  for (const dsid of downstreamSids) {
    if (outputs[dsid]) {
      delete outputs[dsid];
      delete outputTimestamps[dsid];
    }
    delete scopeCheckResults[dsid];
  }
  delete outputs[ctx.sid];
  delete outputTimestamps[ctx.sid];
  delete scopeCheckResults[ctx.sid];
  saveProject(true);
  closeRegenerationModal();
  const targetTab = _getTabForSid(ctx.sid);
  if (typeof switchTab === 'function' && targetTab !== null) {
    switchTab(targetTab);
  }
  renderScopeVerificationSection();
  renderInventionScopePanel();
  App.showToast('재생성 준비 완료. 해당 스텝을 다시 실행하세요.', 'success');
}

function _getTabForSid(sid) {
  const map = {
    step_06: 1, step_10: 1, step_20: 1,
    step_07_mermaid: 2, step_11_mermaid: 2,
    step_08: 2, step_12: 2, step_09: 2,
    step_13_applied: 3, step_13_applied_method: 3
  };
  return typeof map[sid] !== 'undefined' ? map[sid] : null;
}

// ═══════════ TAB & TOGGLES & CLAIM UI (v4.7) ═══════════
function switchTab(i){document.querySelectorAll('.tab-item').forEach((t,j)=>{t.classList.toggle('active',j===i);t.setAttribute('aria-selected',j===i);});document.querySelectorAll('.page').forEach((p,j)=>p.classList.toggle('active',j===i));if(i===3)renderScopeVerificationSection();if(i===4)renderPreview();}
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

// ═══ 사용자 도면 (v10.0) ═══
function initUserFiguresUI(){
  // 카드 제목 업데이트
  const card=document.getElementById('requiredFiguresList')?.closest('.card');
  if(!card)return;
  const hdr=card.querySelector('.card-title');
  if(hdr)hdr.innerHTML='<span class="ico" data-icon="image"></span> 사용자 도면 추가';
  // 기존 입력폼 교체 (파일 업로드 추가)
  const formArea=card.querySelector('div[style*="display:flex"]');
  if(formArea){
    formArea.outerHTML=`<div id="userFigFormArea">
      <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px">
        <div><label style="font-size:11px;color:var(--color-text-tertiary)">도면 번호</label>
          <input type="number" class="input-field" id="inpRequiredFigNum" min="1" max="30" placeholder="3" style="width:60px;margin-top:2px" /></div>
        <div style="flex:1"><label style="font-size:11px;color:var(--color-text-tertiary)">도면 설명 <span style="color:var(--dt-danger)">*필수</span></label>
          <input type="text" class="input-field" id="inpRequiredFigDesc" placeholder="예: 본 발명의 실험 결과를 나타내는 그래프" style="margin-top:2px" /></div>
        <button class="btn btn-primary btn-sm" onclick="addRequiredFigure()" title="도면 추가">＋ 추가</button>
      </div>
      <div style="margin-bottom:8px">
        <label style="font-size:11px;color:var(--color-text-tertiary)">도면 파일 (선택)</label>
        <input type="file" id="inpRequiredFigFile" accept="image/*,.pdf" style="font-size:12px;margin-top:2px" />
      </div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:8px;padding:6px 8px;background:var(--color-bg-secondary);border-radius:6px">
        <span class="ico" data-icon="lightbulb"></span> 사용자 도면의 번호는 자동 생성 도면과 충돌하지 않도록 번호가 밀립니다. 예: 도 3을 추가하면, 자동 도면은 도 1, 2, 4, 5... 순으로 생성됩니다.
      </div>
    </div>`;
  }
  // 기존 등록 도면 복원
  renderRequiredFiguresList();
}
function addRequiredFigure(){
  const numEl=document.getElementById('inpRequiredFigNum'),descEl=document.getElementById('inpRequiredFigDesc');
  const fileEl=document.getElementById('inpRequiredFigFile');
  const num=parseInt(numEl?.value);const desc=descEl?.value?.trim();
  if(!num||num<1){App.showToast('도면 번호를 입력하세요','error');return;}
  if(!desc){App.showToast('도면 설명을 입력하세요 (필수)','error');descEl?.focus();return;}
  if(requiredFigures.find(f=>f.num===num)){App.showToast(`도 ${num}은 이미 등록됨`,'error');return;}
  const figData={num,description:desc};
  // Handle file upload if present
  const addAndRender=()=>{
    requiredFigures.push(figData);
    requiredFigures.sort((a,b)=>a.num-b.num);
    if(numEl){numEl.value='';}if(descEl)descEl.value='';if(fileEl)fileEl.value='';
    renderRequiredFiguresList();
    if(typeof renderConceptDiagramTypesList==='function')renderConceptDiagramTypesList();  // ③ 사용자 도면이 예시도 번호도 밀림 + ③-3 통합 뷰
    if(typeof renderConceptDiagramCards==='function')renderConceptDiagramCards();
    invalidateFigureDependents();  // ④ 사용자 도면 추가 → 자동 도 번호 밀림 → 발명의 설명·부호 무효화
    saveProject(true);
    App.showToast(`도 ${num} 사용자 도면 등록${figData.fileName?' (📎 '+figData.fileName+')':''}`);
    // 다음 빈 번호 자동 제안
    suggestNextFigNum();
  };
  if(fileEl?.files?.[0]){
    const file=fileEl.files[0];
    figData.fileName=file.name;
    figData.fileSize=file.size;
    if(file.type.startsWith('image/')){
      const reader=new FileReader();
      reader.onload=e=>{figData.fileDataUrl=e.target.result;addAndRender();};
      reader.readAsDataURL(file);
      return;
    }
  }
  addAndRender();
}
function suggestNextFigNum(){
  const numEl=document.getElementById('inpRequiredFigNum');
  if(!numEl)return;
  const used=new Set(requiredFigures.map(f=>f.num));
  for(let i=1;i<=30;i++){if(!used.has(i)){numEl.value=i;break;}}
}
function removeRequiredFigure(num){
  requiredFigures=requiredFigures.filter(f=>f.num!==num);
  renderRequiredFiguresList();
  if(typeof renderConceptDiagramTypesList==='function')renderConceptDiagramTypesList();  // ③ 자동 번호 재배치 반영 + ③-3 통합 뷰
  if(typeof renderConceptDiagramCards==='function')renderConceptDiagramCards();
  invalidateFigureDependents();  // ④ 사용자 도면 삭제 → 자동 도 번호 당겨짐 → 발명의 설명·부호 무효화
  saveProject(true);
}
function renderRequiredFiguresList(){
  const el=document.getElementById('requiredFiguresList');if(!el)return;
  if(!requiredFigures.length){el.innerHTML='<div style="font-size:12px;color:var(--color-text-tertiary);text-align:center;padding:12px">등록된 사용자 도면이 없습니다</div>';return;}
  el.innerHTML=requiredFigures.map(f=>{
    const preview=f.fileDataUrl?`<img src="${f.fileDataUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--color-border)" title="${App.escapeHtml(f.fileName||'')}" />`:'';
    const analyzed=!!(f.analysis&&(f.analysis.elements||[]).length);
    const statusBadge=analyzed?`<span class="badge badge-primary" style="font-size:10px" title="비전 분석됨 — T3 정합 입력">분석 ${(f.analysis.elements||[]).length}요소</span>`:'';
    const analyzeBtn=f.fileDataUrl?`<button class="btn btn-ghost btn-sm" onclick="Patent.analyzeUserFigureByNum(${f.num}${analyzed?',true':''})" title="${analyzed?'AI 재분석':'AI 도면 분석(구성요소·부호 추출)'}"><span class="ico" data-icon="${analyzed?'refresh':'search'}" data-size="12"></span></button>`:'';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:4px;font-size:13px">
      ${preview}
      <span class="badge badge-primary" style="min-width:40px;text-align:center">도 ${f.num}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${App.escapeHtml(f.description)}">${App.escapeHtml(f.description)}</span>
      ${statusBadge}
      ${f.fileName?`<span class="badge badge-success" title="${App.escapeHtml(f.fileName)}"><span class="ico" data-icon="link" data-size="12"></span></span>`:''}
      ${analyzeBtn}
      <button class="btn btn-ghost btn-sm" onclick="removeRequiredFigure(${f.num})" title="삭제"><span class="ico" data-icon="x"></span></button>
    </div>`;
  }).join('');
}

// ═══ v11.0: 예시도/개념도 UI 관리 ═══
function addConceptDiagramType(){
  const sel=document.getElementById('selConceptType');
  const typeKey=sel?.value;
  if(!typeKey){App.showToast('유형을 선택하세요','error');return;}
  if(conceptDiagramTypes.find(t=>t.type===typeKey)){App.showToast('이미 추가된 유형입니다','error');return;}
  const typeDef=CONCEPT_DIAGRAM_TYPES[typeKey];
  if(!typeDef)return;
  conceptDiagramTypes.push({type:typeKey,title:typeDef.label,figNum:0,figNumOverride:0,svgContent:'',refNums:[]});  // ③ figNumOverride:0=자동(순서 지정 시 도 번호)
  conceptDiagramCount=conceptDiagramTypes.length;
  sel.value='';
  renderConceptDiagramTypesList();  // ③-3 통합 순서 뷰 동기화 포함
  saveProject(true);
  App.showToast(`${typeDef.label} 예시도 추가됨`);
}
function removeConceptDiagramType(typeKey){
  conceptDiagramTypes=conceptDiagramTypes.filter(t=>t.type!==typeKey);
  conceptDiagramCount=conceptDiagramTypes.length;
  renderConceptDiagramTypesList();  // ③-3 통합 순서 뷰 동기화 포함
  invalidateFigureDependents();  // ④ 예시도 삭제 → 자동 번호 당겨짐 → 발명의 설명·부호 무효화
  saveProject(true);
}
function renderConceptDiagramTypesList(){
  const el=document.getElementById('conceptDiagramTypesList');
  if(!el){renderUnifiedFigureOrder();return;}  // ③-3 통합 뷰는 자체 DOM 가드 보유
  if(!conceptDiagramTypes.length){
    el.innerHTML='<div style="font-size:12px;color:var(--color-text-tertiary);text-align:center;padding:8px">추가된 예시도가 없습니다</div>';
    renderUnifiedFigureOrder();  // ③-3 예시도 없어도 장치/방법/사용자 도면 순서 표시
    return;
  }
  const cFigNums=getAutoFigNums('step_07c');
  el.innerHTML=conceptDiagramTypes.map((ct,i)=>{
    const typeDef=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type,desc:''};
    const figNum=cFigNums[i]||'?';
    const ov=parseInt(ct.figNumOverride)||0;   // ③ 지정 도 번호(0=자동)
    const statusBadge=ct.svgContent?'<span class="badge badge-success">생성됨</span>':'<span class="badge" style="background:var(--color-bg-tertiary)">대기</span>';
    // ③ 도 번호 지정 입력: 비우면 자동(순서 밀림), 값 지정 시 해당 위치에 삽입(자동 도면 밀림)
    const ovInput=`<input type="number" class="input-field" min="1" max="30" value="${ov>0?ov:''}" placeholder="${figNum}" onchange="setConceptFigOverride('${ct.type}',this.value)" title="도 번호 지정(비우면 자동). 지정 시 자동 도면이 밀립니다" style="width:52px;font-size:12px;padding:3px 5px;text-align:center" />`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:4px;font-size:13px">
      <span class="badge badge-primary" style="min-width:40px;text-align:center" title="${ov>0?'지정 도 번호':'자동 도 번호'}">도 ${figNum}</span>
      <span style="flex:1">${App.escapeHtml(typeDef.label)} <span style="color:var(--color-text-tertiary);font-size:11px">${App.escapeHtml(typeDef.desc)}</span></span>
      ${ovInput}
      ${statusBadge}
      <button class="btn btn-ghost btn-sm" onclick="removeConceptDiagramType('${ct.type}')" title="삭제"><span class="ico" data-icon="x"></span></button>
    </div>`;
  }).join('');
  renderUnifiedFigureOrder();  // ③-3 통합 순서 뷰 동기화(SoT 단일 추종)
}
// ═══ ③: 예시도 도 번호 지정(figNumOverride) — 충돌 검증(③-5) + 무효화(③-4) ═══
//   비우거나 0 → 자동(순서 밀림). 값 지정 → 해당 도 번호에 예시도 삽입, 자동 도면(장치/방법) 밀림.
//   ★ 변경 시 step_08·step_18 무효화 → 발명의 설명/부호의 설명이 새 번호 추종(④).
function setConceptFigOverride(typeKey,val){
  const ct=conceptDiagramTypes.find(t=>t.type===typeKey);
  if(!ct)return;
  const raw=String(val==null?'':val).trim();
  const prev=parseInt(ct.figNumOverride)||0;
  // 빈값/0 → 자동 복귀
  if(raw===''){ if(prev!==0){ct.figNumOverride=0;_afterConceptFigOverrideChange();} return; }
  const num=parseInt(raw);
  // ③-5 충돌 검증 — 범위, 사용자 도면 번호, 다른 예시도 지정 번호와 중복 금지
  const total=(diagramData.step_07?.length||0)+conceptDiagramTypes.filter(c=>c.svgContent).length+(diagramData.step_11?.length||0)+requiredFigures.length;
  const maxFig=Math.max(total,30);
  if(!num||num<1||num>maxFig){App.showToast(`도 번호는 1~${maxFig} 범위로 입력하세요`,'error');renderConceptDiagramTypesList();return;}
  if(requiredFigures.find(f=>f.num===num)){App.showToast(`도 ${num}은 사용자 도면이 사용 중입니다`,'error');renderConceptDiagramTypesList();return;}
  const dupConcept=conceptDiagramTypes.find(c=>c.type!==typeKey&&(parseInt(c.figNumOverride)||0)===num);
  if(dupConcept){App.showToast(`도 ${num}은 다른 예시도가 지정했습니다`,'error');renderConceptDiagramTypesList();return;}
  if(num===prev){return;}
  ct.figNumOverride=num;
  _afterConceptFigOverrideChange();
  App.showToast(`예시도를 도 ${num}에 지정 — 자동 도면이 밀립니다`);
}
// ④ 도 번호 재배치 → 발명의 설명·부호의 설명이 새 번호 추종(무효화). 장치/방법/예시도 번호가 모두 밀릴 수 있으므로 양 도면 체인 무효화.
function invalidateFigureDependents(){
  invalidateDownstream('step_07c');           // → step_08(장치 상세설명), step_18(부호의 설명)
  invalidateDownstream('step_11');            // → step_12(방법 상세설명), step_18 (방법 도면 번호도 밀림)
}
// 예시도 순서(번호) 변경 후처리: 무효화(④) + 재렌더 + 저장
function _afterConceptFigOverrideChange(){
  invalidateFigureDependents();                // ④ step_08·step_12·step_18 무효화 → 새 번호 추종
  renderConceptDiagramTypesList();             // 입력 카드 갱신(밀린 자동 번호 반영) + ③-3 통합 뷰
  renderConceptDiagramCards();                 // ① 제목·라벨 즉시 갱신(SoT 추종)
  if(typeof renderRequiredFiguresList==='function')renderRequiredFiguresList();
  saveProject(true);                           // figNumOverride 영속(payload 포함)
}
// ③-3: 통합 도면 순서 계획 — 장치/예시도/방법/사용자 도면을 도 번호순으로.
//   ★ step_08 설명 빌더와 동일한 카운트·override 로 computeFigNums 호출 → 번호 불일치(divergence) 0.
function _plannedFigureLayout(){
  const devGen=diagramData.step_07?.length||0;
  const devCount=devGen||Math.max(parseInt(document.getElementById('optDeviceFigures')?.value||4)-requiredFigures.length,0);
  const hasMeth=!!(diagramData.step_11?.length||outputs.step_11||includeMethodClaims);
  const methGen=diagramData.step_11?.length||0;
  const methCount=methGen||(hasMeth?parseInt(document.getElementById('optMethodFigures')?.value||2):0);
  const placed=conceptDiagramTypes.filter(ct=>ct.svgContent);   // 생성된(=번호 확정) 예시도
  const cOverrides=placed.map(ct=>ct.figNumOverride||0);
  const r=computeFigNums(devCount,methCount,placed.length,cOverrides);
  const rows=[];
  r.device.forEach(n=>rows.push({num:n,tag:'장치',cls:'badge-primary'}));
  placed.forEach((ct,i)=>{const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};rows.push({num:r.concept[i],tag:'예시도',sub:td.label,cls:'badge-success',ov:(parseInt(ct.figNumOverride)||0)>0});});
  r.method.forEach(n=>rows.push({num:n,tag:'방법',cls:'badge-warning'}));
  requiredFigures.forEach(rf=>rows.push({num:rf.num,tag:'사용자',sub:rf.description,cls:'badge-neutral'}));
  rows.sort((a,b)=>(a.num||0)-(b.num||0));
  const pending=conceptDiagramTypes.filter(ct=>!ct.svgContent);  // 미생성 예시도(대기)
  return{rows,pending};
}
function renderUnifiedFigureOrder(){
  const el=document.getElementById('unifiedFigureOrder');if(!el)return;
  const {rows,pending}=_plannedFigureLayout();
  if(!rows.length&&!pending.length){el.innerHTML='';el.style.display='none';return;}
  el.style.display='';
  const rowHtml=rows.map(r=>{
    const sub=r.sub?` <span style="color:var(--color-text-tertiary);font-size:11px">${App.escapeHtml(String(r.sub).slice(0,40))}</span>`:'';
    const ovMark=r.ov?' <span class="badge badge-primary" style="font-size:9px">지정</span>':'';
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:12px;border-bottom:1px solid var(--color-border)">
      <span class="badge ${r.cls}" style="min-width:38px;text-align:center">도 ${r.num||'?'}</span>
      <span style="flex:1">${r.tag}${sub}${ovMark}</span>
    </div>`;
  }).join('');
  const pendHtml=pending.length?`<div style="font-size:11px;color:var(--color-text-tertiary);padding:6px 8px">대기(미생성): ${pending.map(ct=>{const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};const ov=parseInt(ct.figNumOverride)||0;return App.escapeHtml(td.label)+(ov>0?` → 도 ${ov} 예정`:'');}).join(', ')}</div>`:'';
  el.innerHTML=`<div style="border:1px solid var(--color-border);border-radius:8px;overflow:hidden">
    <div style="font-size:11px;font-weight:600;padding:6px 8px;background:var(--color-bg-secondary);color:var(--color-text-secondary)"><span class="ico" data-icon="list" data-size="12"></span> 통합 도면 순서</div>
    ${rowHtml}${pendHtml}
  </div>`;
}
function renderConceptDiagramCards(){
  const area=document.getElementById('conceptDiagramsArea');if(!area)return;
  const card=document.getElementById('resultCard07c');
  if(!conceptDiagramTypes.length||!conceptDiagramTypes.some(ct=>ct.svgContent)){
    if(card)card.style.display='none';
    area.innerHTML='';
    return;
  }
  if(card)card.style.display='';
  const cFigNums=getAutoFigNums('step_07c');
  area.innerHTML=conceptDiagramTypes.map((ct,i)=>{
    if(!ct.svgContent)return '';
    const figNum=cFigNums[i]||'?';
    const typeDef=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
    return `<div style="margin-bottom:16px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
        <span>도 ${figNum} — ${App.escapeHtml(typeDef.label)}</span>
        <button class="btn btn-ghost btn-sm" onclick="Patent.refineConceptDiagramByNum(${figNum})" title="비전 정련 — 선 겹침/배치 개선(청구 구성·부호 내용 유지)"><span class="ico" data-icon="wand" data-size="12"></span> 정련</button>
      </div>
      <div style="border:1px solid var(--color-border);border-radius:8px;padding:12px;background:#fff;overflow:auto;max-height:500px">${_conceptSvgApplyTitle(ct.svgContent, figNum)}</div>
    </div>`;
  }).filter(Boolean).join('');
  const dl=document.getElementById('conceptDiagramDownload');
  if(dl)dl.style.display=conceptDiagramTypes.some(ct=>ct.svgContent)?'':'none';
  renderConceptDiagramTypesList();
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
      st.innerHTML=`<span class="ico" data-icon="check-circle"></span> ${App.escapeHtml(file.name)} (${projectRefStyleText.length.toLocaleString()}자) <button class="btn btn-ghost btn-sm" onclick="clearProjectRef()" style="margin-left:4px"><span class="ico" data-icon="x"></span></button>`;
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
function onTitleInput(){
  const v=document.getElementById('titleInput').value.trim();
  // 후보 행 선택 해제 — selectTitle()과 동일하게 inline style까지 초기화
  document.querySelectorAll('#resultStep01 .title-candidate-row').forEach(c=>{
    c.classList.remove('selected');
    c.style.borderColor='var(--color-border)';
    c.style.background='#fff';
  });
  const prev=selectedTitle;
  selectedTitle=v;
  document.getElementById('titleConfirmMsg').style.display=v?'block':'none';
  document.getElementById('batchArea').style.display=v?'block':'none';
  if(v)autoSetDeviceCategoryFromTitle(v);
  // prev 유무와 무관하게 변경 시 하류 무효화 (selectTitle과 동일 동작)
  if(prev!==v)invalidateDownstream('step_01');
  // 직접 입력한 명칭이 저장되도록 디바운스 저장 (1.5초 후)
  if(currentProjectId)_debouncedSaveTitle();
}
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
  area.innerHTML=`<details style="margin:0"><summary style="font-size:11px;color:var(--color-text-secondary);cursor:pointer;user-select:none;padding:4px 0"><span class="ico" data-icon="edit"></span> 추가 지시사항 (선택)</summary><textarea id="userCmd_${sid}" class="result-textarea" rows="2" placeholder="예: 독립항을 더 넓게 작성해 주세요 / 앵커에 캐싱 로직을 반드시 포함해 주세요" style="margin-top:6px;font-size:12px;min-height:48px;resize:vertical" oninput="stepUserCommands['${sid}']=this.value.trim()">${App.escapeHtml(stepUserCommands[sid]||'')}</textarea></details>`;
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
  // ═══ v14: 역설계 체인 반영 ═══
  step_01:{MUST:['step_06'],SHOULD:['step_02','step_03','step_04','step_05']}, // 명칭 → 청구항 + 하위 스텝
  step_06:{MUST:['step_10','step_07','step_07c','step_17'],SHOULD:['step_08','step_11','step_14','step_15','step_19','step_20']}, // 장치청구 → 방법,도면,개념도,해결수단
  step_10:{MUST:['step_11','step_12','step_17','step_20'],SHOULD:['step_14','step_15','step_18']}, // 방법청구 → 방법도면,상세,해결수단,기록매체
  step_07:{MUST:['step_08','step_18'],SHOULD:['step_09','step_13']},     // 장치도면 → 상세설명, 부호
  step_07c:{MUST:['step_08','step_18'],SHOULD:[]},                       // 예시도 → 상세설명, 부호
  step_08:{MUST:['step_09','step_13'],SHOULD:['step_12','step_14','step_15']}, // 상세설명 → 수학식, 검토
  step_09:{MUST:[],SHOULD:['step_13']},                    // 수학식 → 검토
  step_11:{MUST:['step_12','step_18'],SHOULD:['step_13']},  // 방법도면 → 방법상세, 부호
  step_12:{MUST:['step_13'],SHOULD:[]},                    // 방법상세 → 검토
  step_17:{MUST:['step_05'],SHOULD:[]},                    // ★ 역설계: 해결수단 → 과제
  step_05:{MUST:['step_16','step_03'],SHOULD:[]},           // ★ 역설계: 과제 → 효과, 배경기술
  step_16:{MUST:[],SHOULD:[]},                             // 효과 (종단)
  step_03:{MUST:[],SHOULD:['step_02']},                    // 배경기술 → 기술분야
  step_02:{MUST:[],SHOULD:[]},                             // 기술분야 (종단)
  step_13:{MUST:[],SHOULD:['step_15','step_04']},           // 검토 → 특허성, 선행기술
  step_04:{MUST:[],SHOULD:['step_15']},                    // 선행기술 → 특허성
  step_15:{MUST:[],SHOULD:['step_14','step_08','step_09','step_12']}, // 특허성 → 대안, 보완
  step_20:{MUST:['step_17'],SHOULD:[]},                    // 기록매체 → 해결수단
  step_14:{MUST:[],SHOULD:[]},                             // 대안청구 (종단)
  step_18:{MUST:[],SHOULD:[]},                             // 부호 (종단)
  step_19:{MUST:[],SHOULD:[]},                             // 요약서 (종단)
};

// 각 step의 실행 함수 매핑 (연쇄 재생성용)
const STEP_RUNNERS={
  step_01:'runStep',step_02:'runStep',step_03:'runStep',step_04:'runStep',step_05:'runStep',
  step_06:'runStep',step_07:'runDiagramStep',step_07c:'runConceptDiagramStep',step_08:'runLongStep',step_09:'runMathInsertion',
  step_10:'runStep',step_11:'runDiagramStep',step_12:'runLongStep',step_13:'runStep',
  step_14:'runStep',step_15:'runStep',step_16:'runStep',step_17:'runStep',
  step_18:'runStep',step_19:'runStep',step_20:'runStep',
};

function invalidateDownstream(changedStep){
  const depObj=STEP_DEPENDENCIES[changedStep];
  if(!depObj)return;
  const mustDeps=(depObj.MUST||[]).filter(d=>d!=='step_13_applied'&&d!=='step_13_applied_method'&&outputs[d]);
  const shouldDeps=(depObj.SHOULD||[]).filter(d=>d!=='step_13_applied'&&d!=='step_13_applied_method'&&outputs[d]);
  
  // ★ v9.1: 원본 step 재생성 시 검토 반영본 무효화 ★
  // step_08, step_09, step_13 변경 → 장치 검토 반영본 무효화
  if(changedStep==='step_08'||changedStep==='step_09'||changedStep==='step_13'){
    if(outputs.step_13_applied){
      delete outputs.step_13_applied;
      delete outputTimestamps.step_13_applied;
      console.log(`[v9.1] ${changedStep} 재생성 → step_13_applied 무효화`);
    }
    if(changedStep==='step_13'&&outputs.step_13_applied_method){
      delete outputs.step_13_applied_method;
      delete outputTimestamps.step_13_applied_method;
      console.log(`[v9.1] step_13 재생성 → step_13_applied_method 무효화`);
    }
  }
  // step_12 변경 → 방법 검토 반영본 무효화
  if(changedStep==='step_12'){
    if(outputs.step_13_applied_method){
      delete outputs.step_13_applied_method;
      delete outputTimestamps.step_13_applied_method;
      console.log(`[v9.1] step_12 재생성 → step_13_applied_method 무효화`);
    }
  }
  
  if(!mustDeps.length&&!shouldDeps.length)return;

  // ★ v10.0 fix: changedStep의 하류 배지만 제거 (다른 step의 배지 보존) ★
  [...mustDeps,...shouldDeps].forEach(d=>{
    document.querySelectorAll(`.stale-warning[data-step="${d}"]`).forEach(w=>w.remove());
  });

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
      w.innerHTML=`<span class="status-dot ${isMust?'negative':'cautionary'}"></span> ${STEP_NAMES[d]} — ${STEP_NAMES[changedStep]} 변경으로 ${isMust?'재생성 필수':'재생성 권장'}`;
      el.prepend(w);
    }
  });

  // ★ 연쇄 수정 패널 표시 ★
  showCascadePanel(changedStep,mustDeps,shouldDeps);
}

// ═══ 산출물 미리보기 디바운스 (cascade 재생성 시 과도 호출 방지) ═══
let _previewDebounceTimer=null;
function _debouncedRenderPreview(){if(_previewDebounceTimer)clearTimeout(_previewDebounceTimer);_previewDebounceTimer=setTimeout(()=>{_previewDebounceTimer=null;renderPreview();},500);}
// ═══ 확정명칭 직접 입력 시 저장 디바운스 ═══
let _titleSaveTimer=null;
function _debouncedSaveTitle(){if(_titleSaveTimer)clearTimeout(_titleSaveTimer);_titleSaveTimer=setTimeout(()=>{_titleSaveTimer=null;saveProject(true);},1500);}

// ═══ v10.1: Step 완료 시 stale 배지 + cascade 패널 갱신 ═══
function onStepCompleted(sid){
  // 1. 해당 step의 stale-warning 배지 제거
  document.querySelectorAll(`.stale-warning[data-step="${sid}"]`).forEach(w=>w.remove());
  // 2. cascade 패널 업데이트
  _updateCascadePanelItem(sid,'done');
  // 3. v10.2: 산출물 미리보기 자동 갱신 (디바운스 적용)
  const previewTab=document.querySelector('.tab-item:nth-child(5)');
  if(previewTab&&previewTab.classList.contains('active'))_debouncedRenderPreview();
  // v15: 단계별 채팅 수정 패널 마운트(모든 생성/재생성 완료의 공통 훅)
  if(window.PatentChat)PatentChat.mountAll();
}
function _updateCascadePanelItem(sid,status){
  const panel=document.getElementById('cascadePanel');
  if(!panel)return;
  const cb=panel.querySelector(`.cascade-cb[data-step="${sid}"]`);
  if(!cb)return;
  cb.checked=false;cb.disabled=true;
  const label=cb.closest('label');
  if(label){
    if(status==='done'){
      label.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;opacity:0.5;text-decoration:line-through;pointer-events:none';
      const span=label.querySelector('span');
      if(span){span.innerHTML=`<span class="ico" data-icon="check-circle" data-size="12"></span> ${App.escapeHtml(STEP_NAMES[sid]||sid)}`;if(window.Icons&&Icons.renderAll)Icons.renderAll(span);}
    }else if(status==='fail'){
      label.style.opacity='0.7';
      const span=label.querySelector('span');
      if(span){span.innerHTML=`<span class="ico" data-icon="x-circle" data-size="12"></span> ${App.escapeHtml(STEP_NAMES[sid]||sid)}`;if(window.Icons&&Icons.renderAll)Icons.renderAll(span);}
    }
  }
  // 모든 항목 완료 시 패널 자동 닫기
  const remaining=panel.querySelectorAll('.cascade-cb:not(:disabled)');
  if(remaining.length===0){
    const btn=panel.querySelector('#btnCascadeRun');
    if(btn){btn.textContent='<span class="ico" data-icon="check-circle"></span> 모두 완료';btn.style.background='#4caf50';btn.disabled=true;}
    setTimeout(()=>{const p=document.getElementById('cascadePanel');if(p)p.remove();},3000);
  }
}

// ═══ 연쇄 수정 패널 UI (v10.1: merge 지원) ═══
function showCascadePanel(changedStep,mustDeps,shouldDeps){
  const existing=document.getElementById('cascadePanel');
  
  // 기존 패널이 있으면 새 항목만 병합
  if(existing){
    _mergeCascadeItems(existing,changedStep,mustDeps,shouldDeps);
    return;
  }

  // 새 패널 생성
  const panel=document.createElement('div');
  panel.id='cascadePanel';
  panel.style.cssText='position:fixed;bottom:20px;right:20px;width:380px;max-height:70vh;overflow-y:auto;background:#fff;border:2px solid #1976d2;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9999;font-family:"맑은 고딕",sans-serif';

  let html=`<div style="background:var(--dt-brand-hover);color:#fff;padding:12px 16px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:13px;font-weight:600"><span class="ico" data-icon="refresh"></span> ${STEP_NAMES[changedStep]} 변경 — 연쇄 수정</span>
    <button onclick="document.getElementById('cascadePanel').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px"><span class="ico" data-icon="x"></span></button>
  </div>
  <div style="padding:12px 16px">`;

  // MUST 항목
  if(mustDeps.length){
    html+=`<div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--dt-danger);margin-bottom:6px"><span class="status-dot negative"></span> 필수 재생성 (${mustDeps.length}건)</div>`;
    mustDeps.forEach(d=>{
      html+=`<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer">
        <input type="checkbox" class="cascade-cb" data-step="${d}" data-level="must" checked style="accent-color:var(--dt-danger)">
        <span>${STEP_NAMES[d]||d}</span>
      </label>`;
    });
    html+=`</div>`;
  }

  // SHOULD 항목
  if(shouldDeps.length){
    html+=`<details style="margin-bottom:10px"${mustDeps.length?'':' open'}>
      <summary style="font-size:11px;font-weight:700;color:#e65100;cursor:pointer;padding:4px 0"><span class="status-dot cautionary"></span> 권장 재생성 (${shouldDeps.length}건)</summary>`;
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
    <button onclick="document.querySelectorAll('.cascade-cb').forEach(c=>c.checked=true)" style="flex:1;padding:6px;font-size:11px;border:1px solid #ccc;border-radius:6px;background:var(--dt-g100);cursor:pointer">전체 선택</button>
    <button onclick="document.querySelectorAll('.cascade-cb').forEach(c=>c.checked=false)" style="flex:1;padding:6px;font-size:11px;border:1px solid #ccc;border-radius:6px;background:var(--dt-g100);cursor:pointer">전체 해제</button>
  </div>
  <button id="btnCascadeRun" onclick="runCascadeRegeneration('${changedStep}')" style="width:100%;margin-top:10px;padding:10px;font-size:13px;font-weight:600;color:#fff;background:var(--dt-brand-hover);border:none;border-radius:8px;cursor:pointer">
    ✨ 선택 항목 자동 재생성
  </button>
  <div id="cascadeProgress" style="margin-top:8px;font-size:11px;color:#666"></div>
  </div>`;

  panel.innerHTML=html;
  document.body.appendChild(panel);
}
// ═══ v10.1: 기존 패널에 새 항목 병합 ═══
function _mergeCascadeItems(panel,changedStep,mustDeps,shouldDeps){
  const existingSteps=new Set([...panel.querySelectorAll('.cascade-cb')].map(cb=>cb.dataset.step));
  let added=0;
  // 필수 항목 영역 찾기/생성
  const mustContainer=panel.querySelector('[data-cascade-must]');
  const shouldContainer=panel.querySelector('[data-cascade-should]');
  
  mustDeps.forEach(d=>{
    if(existingSteps.has(d))return;
    // 기존 MUST 영역에 추가하거나, 없으면 새로 만들기
    const target=mustContainer||panel.querySelector('.cascade-cb[data-level="must"]')?.closest('div');
    if(target){
      const lbl=document.createElement('label');
      lbl.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer';
      lbl.innerHTML=`<input type="checkbox" class="cascade-cb" data-step="${d}" data-level="must" checked style="accent-color:var(--dt-danger)"><span>${STEP_NAMES[d]||d}</span>`;
      target.appendChild(lbl);
      added++;
    }
  });
  shouldDeps.forEach(d=>{
    if(existingSteps.has(d))return;
    const target=shouldContainer||panel.querySelector('.cascade-cb[data-level="should"]')?.closest('details');
    if(target){
      const lbl=document.createElement('label');
      lbl.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer;margin-left:4px';
      lbl.innerHTML=`<input type="checkbox" class="cascade-cb" data-step="${d}" data-level="should" style="accent-color:#ff9800"><span>${STEP_NAMES[d]||d}</span>`;
      target.appendChild(lbl);
      added++;
    }
  });
  // 헤더 텍스트에 변경 원인 추가
  if(added>0){
    const hdr=panel.querySelector('span[style*="font-weight:600"]');
    if(hdr&&!hdr.textContent.includes(STEP_NAMES[changedStep])){
      hdr.textContent+=` + ${STEP_NAMES[changedStep]}`;
    }
  }
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
  // step_13_applied, step_13_applied_method는 건너뛰기 (applyReview 전용)
  const validSteps=steps.filter(s=>s!=='step_13_applied'&&s!=='step_13_applied_method'&&STEP_NAMES[s]);

  // ★ v7.0: 위상정렬 (step_20→step_17 등 역방향 의존 해결)
  const sorted=topologicalSort(validSteps,sourceStep);
  if(!sorted.length){App.showToast('정렬 실패','error');return;}

  // BUG-3 fix: globalProcessing 설정
  setGlobalProcessing(true);

  const btn=document.getElementById('btnCascadeRun');
  const prog=document.getElementById('cascadeProgress');
  if(btn){btn.disabled=true;btn.textContent='<span class="ico" data-icon="history"></span> 재생성 진행 중...';}

  let completed=0;
  const total=sorted.length;

  for(const sid of sorted){
    if(prog)prog.innerHTML=`<div style="margin-bottom:4px">진행: ${completed+1}/${total} — <b>${STEP_NAMES[sid]}</b> 재생성 중...</div>
      <div style="background:#e0e0e0;border-radius:4px;height:6px"><div style="background:var(--dt-brand-hover);border-radius:4px;height:6px;width:${Math.round(completed/total*100)}%;transition:width .3s"></div></div>`;

    try{
      // step별 적절한 runner 호출
      const runner=STEP_RUNNERS[sid];
      if(runner==='runLongStep')await _cascadeRunLong(sid);
      else if(runner==='runDiagramStep')await _cascadeRunDiagram(sid);
      else if(runner==='runMathInsertion')await _cascadeRunMath();
      else if(runner==='runConceptDiagramStep'){if(conceptDiagramTypes.length)await _cascadeRunConceptDiagram();}
      else await _cascadeRunShort(sid);

      completed++;
      // v10.1: 통합 완료 처리 (배지 + 패널 갱신)
      onStepCompleted(sid);
    }catch(e){
      console.error(`Cascade ${sid} 실패:`,e);
      if(prog)prog.innerHTML+=`<div style="color:var(--dt-danger);font-size:11px"><span class="ico" data-icon="x"></span> ${STEP_NAMES[sid]} 실패: ${e.message}</div>`;
    }
  }

  if(prog)prog.innerHTML=`<div style="color:var(--dt-success);font-weight:600"><span class="ico" data-icon="check-circle"></span> ${completed}/${total} 완료</div>
    <div style="background:#e0e0e0;border-radius:4px;height:6px"><div style="background:var(--dt-success);border-radius:4px;height:6px;width:100%"></div></div>`;
  if(btn){btn.textContent='<span class="ico" data-icon="check-circle"></span> 완료';btn.style.background='#4caf50';}
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
    pushOutputHistory('step_04','cascade','_cascadeRunShort');
    outputs.step_04=sr?sr.formatted:'【특허문헌】\n(관련 선행특허��� 검색하지 못하였습니다)';
    markOutputTimestamp('step_04');_cascadeRender('step_04',outputs.step_04);
    return;
  }
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  pushOutputHistory(sid,'cascade','_cascadeRunShort');
  if(sid==='step_13'){
    const text=await App.callClaudeWithContinuation(prompt,'progressStep13');
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
    pushOutputHistory(sid,'cascade','_cascadeRunShort.correction');
    outputs[sid]=corrected;markOutputTimestamp(sid);_cascadeRender(sid,corrected);
  }
}
async function _cascadeRunLong(sid){
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  let t=await App.callClaudeWithContinuation(prompt);
  // v8.1: 도면 범위 초과 자동 교정
  if(sid==='step_08')t=sanitizeDescFigureRefs(t,'device');
  if(sid==='step_12')t=sanitizeDescFigureRefs(t,'method');
  pushOutputHistory(sid,'cascade','_cascadeRunLong');
  outputs[sid]=t;markOutputTimestamp(sid);_cascadeRender(sid,t);
}
async function _cascadeRunDiagram(sid){
  const prompt=buildPrompt(sid);
  if(!prompt)return;
  let r=await App.callClaude(prompt);
  let designText=r.text;
  
  // v10.3: 도면 설계 검증 — 도면 수, 도면 번호, 청구항 정합성
  if(sid==='step_07'){
    const totalFig=parseInt(document.getElementById('optDeviceFigures')?.value||4);
    const genCount=totalFig-requiredFigures.length;
    const figNums=computeFigNums(Math.max(genCount,0),0);
    const expectedNums=figNums.device;
    
    const preIssues=validateDiagramDesignText(designText,genCount,expectedNums);
    const hasError=preIssues.some(i=>i.severity==='ERROR');
    
    if(hasError){
      console.warn('[_cascadeRunDiagram] 도면 설계 검증 실패:',preIssues.map(i=>i.message).join('; '));
      // 오류 메시지를 포함하여 재생성 요청
      const fb=`이전 도면 설계에 규칙 위반이 있습니다. 아래 오류를 모두 수정하여 다시 생성하세요.

[오류 목록]
${preIssues.filter(i=>i.severity==='ERROR').map(i=>'⛔ '+i.message).join('\n')}
${preIssues.filter(i=>i.severity==='WARNING').map(i=>'⚠ '+i.message).join('\n')}

★★★ 핵심 수정사항 ★★★
- 도면을 정확히 ${genCount}개만 생성하라: ${expectedNums.map(n=>'도 '+n).join(', ')}
- 구성요소 명칭과 참조번호는 【장치 청구범위】에서 가져와 사용하라

원래 요청:
${prompt.slice(0,2000)}`;
      r=await App.callClaude(fb);
      designText=r.text;
      
      // 재생성 후 2차 검증 — 도면 수만 확인
      const postIssues=validateDiagramDesignText(designText,genCount,expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치'))){
        console.warn('[_cascadeRunDiagram] 2차 검증도 도면 수 불일치 — 초과분 수동 제거 시도');
        // 설계 텍스트에서 초과 도면 제거
        designText=_trimDesignTextToExpectedFigures(designText,expectedNums);
      }
    }
  }
  
  if(sid==='step_11'){
    const methFigCount=parseInt(document.getElementById('optMethodFigures')?.value||2);
    const devCount=diagramData.step_07?.length||0;
    const figNums=computeFigNums(devCount,methFigCount,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides());
    const expectedNums=figNums.method;
    
    const preIssues=validateDiagramDesignText(designText,methFigCount,expectedNums);
    if(preIssues.some(i=>i.severity==='ERROR')){
      const fb=`도면 설계 오류:\n${preIssues.map(i=>i.message).join('\n')}\n도면을 정확히 ${methFigCount}개만 생성하라: ${expectedNums.map(n=>'도 '+n).join(', ')}\n원래 요청: ${prompt.slice(0,1500)}`;
      r=await App.callClaude(fb);designText=r.text;
    }
    // ★ 2차 검증: 도면 수 강제 트림 ★
    const postIssues=validateDiagramDesignText(designText,methFigCount,expectedNums);
    if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치'))){
      designText=_trimDesignTextToExpectedFigures(designText,expectedNums);
    }
  }
  
  pushOutputHistory(sid,'cascade','_cascadeRunDiagram');
  outputs[sid]=designText;markOutputTimestamp(sid);_cascadeRender(sid,designText);
  const mr=await App.callClaude(buildMermaidPrompt(sid),4096);
  pushOutputHistory(sid+'_mermaid','cascade','_cascadeRunDiagram.mermaid');
  outputs[sid+'_mermaid']=mr.text;
  renderDiagramsV14(sid,mr.text);
}

// v11.0: 연쇄 재생성용 예시도 실행
async function _cascadeRunConceptDiagram(){
  const cFigNums=getAutoFigNums('step_07c');
  const count=conceptDiagramTypes.length;
  const figNums=cFigNums.slice(0,count);
  const typeDescs=conceptDiagramTypes.map((ct,i)=>{const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};return `도 ${figNums[i]||'?'}: ${td.label}`;}).join(', ');

  const prompt=`특허 도면 전문가로서, 아래 발명의 예시도/개념도를 SVG 코드로 직접 생성하라.

${CONCEPT_PURPOSE_RULES}

⛔ 블록도/플로우차트 형태 절대 금지. "~부" 박스 라벨 금지. 흑색 선만 사용.
✅ 시각적 장면: 스틱 피겨, UI 화면, 테이블, 디바이스 외관 등
SVG 규칙: viewBox="0 0 680 500", stroke="#000", fill="none"(필요시 "#fff"), font-family="Malgun Gothic,sans-serif", 참조번호 31~99.
${CONCEPT_OVERLAP_RULES}
★ 출력 전: 부호 리더선/연결선이 다른 요소와 겹치거나 교차하는지, 요소·텍스트가 겹치는지 점검하고, 겹치면 경로·좌표를 수정해 제거하라.
발명의 명칭: ${selectedTitle}
도면: ${count}개 (${figNums.map(n=>'도 '+n).join(', ')}), 유형: ${typeDescs}
청구범위(★ 이 예시도가 시각화할 구성을 특정해 도면에 반드시 담아라 — 블록도 복제만 금지): ${outputs.step_06?.slice(0,1500)||''}
출력 형식(각 도면마다 SVG·간단설명·요소맵): ${figNums.map(n=>'---CONCEPT_FIG_'+n+'---\\n<svg>...</svg>\\n---BRIEF_DESC---\\n도 '+n+'은 ...를 나타내는 예시도이다.\\n---REF_MAP---\\n31: 요소이름\\n32: 요소이름').join('\\n')}
★ REF_MAP: 도면의 각 참조번호(31~99)가 무슨 요소인지 "번호: 한국어 이름"으로 빠짐없이 적어라.`;

  const r=await App.callClaude(prompt,16384);
  const fullText=r.text||'';

  // ★ P2/P3 공유 파서 — SVG/BRIEF/REF_MAP(번호↔이름) 추출, 참조번호 31~99 통일.
  _parseConceptResult(fullText, conceptDiagramTypes, figNums);
  pushOutputHistory('step_07c','cascade','_cascadeRunConceptDiagram');
  outputs.step_07c=_buildConceptOutputText(conceptDiagramTypes, figNums);
  markOutputTimestamp('step_07c');
  reflectConceptsToSpec();   // ★ [A] 예시도 → 발명의 설명·부호의 설명 자동 반영(APPEND, 본문 보존). step_08/18 미선택 시에도 누락 방지.
  renderConceptDiagramCards();
  // ★ [C] 연쇄 재생성 직후에도 비전 자동 정련 1회(겹침 안전망) — callVision 있을 때만(가드), 1회만.
  try{ if(App&&typeof App.callVision==='function'){ await Patent.refineAllConceptDiagrams({maxRounds:1}); } }catch(_e){}
}

// v10.3: 설계 텍스트에서 초과 도면 제거
function _trimDesignTextToExpectedFigures(text,expectedNums){
  if(!expectedNums||!expectedNums.length)return text;
  const expectedSet=new Set(expectedNums);
  
  // BRIEF_DESCRIPTIONS 섹션 분리
  const briefIdx=text.indexOf('---BRIEF_DESCRIPTIONS---');
  let designPart=briefIdx>=0?text.slice(0,briefIdx):text;
  let briefPart=briefIdx>=0?text.slice(briefIdx):'';
  
  // 도면별 분리
  const figSections=[];
  const figRe=/(?:^|\n)(도\s*(\d+)\s*[:：])/g;
  let m;
  const starts=[];
  while((m=figRe.exec(designPart))!==null){
    starts.push({pos:m.index,num:parseInt(m[2])});
  }
  
  let result='';
  for(let i=0;i<starts.length;i++){
    const end=i+1<starts.length?starts[i+1].pos:designPart.length;
    if(expectedSet.has(starts[i].num)){
      result+=designPart.slice(starts[i].pos,end);
    }else{
      console.log(`[_trimDesignText] 초과 도면 제거: 도 ${starts[i].num}`);
    }
  }
  
  // BRIEF_DESCRIPTIONS에서도 초과 도면 라인 제거
  if(briefPart){
    const lines=briefPart.split('\n');
    briefPart=lines.filter(l=>{
      const fm=l.match(/도\s*(\d+)/);
      if(!fm)return true;
      const fnum=parseInt(fm[1]);
      // 사용자 도면이나 예상 도면이면 유지
      return expectedSet.has(fnum)||requiredFigures.some(rf=>rf.num===fnum);
    }).join('\n');
  }
  
  return (result+'\n\n'+briefPart).replace(/\n{3,}/g,'\n\n').trim();
}
async function _cascadeRunMath(){
  const r=await App.callClaude(buildPrompt('step_09'));
  const baseDesc=getLatestDescription()||'';
  pushOutputHistory('step_09','cascade','_cascadeRunMath');
  outputs.step_09=insertMathBlocks(baseDesc,r.text);
  markOutputTimestamp('step_09');_cascadeRender('step_09',outputs.step_09);
}

// ═══ A1 fix: getLatestDescription — 타임스탬프 기반 최신본 (v5.5) ═══
function markOutputTimestamp(sid){outputTimestamps[sid]=Date.now();}
function getLatestDescription(){
  // v9.1: 장치 상세설명 우선순위: step_13_applied > step_09 > step_08
  // 단, 하위 step이 더 최신이면(사용자가 재생성) 하위 step 우선
  const ts08=outputTimestamps.step_08||0;
  const ts09=outputTimestamps.step_09||0;
  const ts13a=outputTimestamps.step_13_applied||0;
  // step_08이 step_09/step_13_applied보다 나중이면 step_08이 최신본 (사용자가 Step 8 재생성)
  if(outputs.step_08&&ts08>ts09&&ts08>ts13a)return outputs.step_08;
  // step_09가 step_13_applied보다 나중이면 step_09 우선 (사용자가 Step 9 재생성)
  if(outputs.step_09&&ts09>ts13a)return outputs.step_09;
  // 기존 우선순위
  return outputs.step_13_applied||outputs.step_09||outputs.step_08||'';
}
// v9.1: 방법 상세설명 최신본 반환
function getLatestMethodDescription(){
  // 우선순위: step_13_applied_method > step_12
  // 단, step_12가 더 최신이면(사용자가 Step 12 재생성) step_12 우선
  const ts12=outputTimestamps.step_12||0;
  const ts13m=outputTimestamps.step_13_applied_method||0;
  if(outputs.step_12&&ts12>ts13m)return outputs.step_12;
  return outputs.step_13_applied_method||outputs.step_12||'';
}
// 정형문 수동 삽입: 현재 Step 8 결과에 정형문을 전후에 삽입
function insertBoilerplate(){
  const cur=outputs.step_08||'';
  if(!cur){App.showToast('상세설명이 없습니다. 먼저 Step 8을 생성하세요.','error');return;}
  // Check if already has boilerplate
  if(hasBoilerplate(cur)){App.showToast('이미 정형문이 삽입되어 있습니다.','info');return;}
  pushOutputHistory('step_08','llm','insertBoilerplate');
  outputs.step_08=STEP8_PREFIX+'\n\n'+cur+'\n\n'+STEP8_SUFFIX;
  renderOutput('step_08',outputs.step_08);
  // Also update step_09 and step_13_applied if they exist
  if(outputs.step_09&&!hasBoilerplate(outputs.step_09)){outputs.step_09=STEP8_PREFIX+'\n\n'+outputs.step_09+'\n\n'+STEP8_SUFFIX;markOutputTimestamp('step_09');}
  if(outputs.step_13_applied&&!hasBoilerplate(outputs.step_13_applied)){outputs.step_13_applied=STEP8_PREFIX+'\n\n'+outputs.step_13_applied+'\n\n'+STEP8_SUFFIX;markOutputTimestamp('step_13_applied');}
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

// v10.3: 도면 설계 텍스트에서 정확한 도면 번호 목록 추출 (헤더 기반)
function _extractFigureNumbersFromDesign(text){
  if(!text)return [];
  const nums=[];
  const re=/^\s*도\s*(\d+)\s*[:：]/gm;
  let m;
  while((m=re.exec(text))!==null)nums.push(parseInt(m[1]));
  return[...new Set(nums)].sort((a,b)=>a-b);
}

// ═══ v9.0: 상세설명 후처리 (safety net — 근본 수정은 callClaudeWithContinuation 오버라이드) ═══
// type: 'device' → step_08 (장치), 'method' → step_12 (방법)
function sanitizeDescFigureRefs(text,type){
  if(!text)return text;
  
  // ★ v10.2: Step 8 수학식 제거 (수학식은 Step 9에서만 삽입) ★
  if(type==='device'){
    // 【수학식 N】 블록 및 관련 수식/변수 설명 전체 제거
    // "여기서," "예를 들어," 등은 수학식 직후에 나오는 설명이므로 함께 제거
    text=text.replace(/【수학식\s*\d+】[^\n]*(?:\n(?!도\s+\d|이러한|한편|또한|구체적|상기)[^\n]*)*/g,'').trim();
    // v10.5: "수학식 N" 참조 제거 — 【수학식 N】 헤더 잔여만 제거 (본문 참조 문장은 보존)
    // 기존: [^\n]*수학식\s*\d+[^\n]* → 본문의 "수학식 1에 따르면..." 설명 문장까지 삭제
    text=text.replace(/^\s*【?수학식\s*\d+】?\s*$/gm,'').trim();
    text=text.replace(/\n{3,}/g,'\n\n');
  }
  
  // ★ Safety net A: v10.2 — 도면 소개문은 유지 (Step 8에서 의도적으로 포함) ★
  // "도 N은 ~블록도이다" 형태는 이제 Step 8 필수 출력이므로 제거하지 않음
  if(type==='device'||type==='method'){
    
    // ★ Safety net B: 중복 출력 감지 & 제거 ★
    // 근본 원인(이어쓰기)이 수정되어도, 예외적으로 발생할 수 있는 중복 대비
    const fig1Refs=[...text.matchAll(/도\s+1[을를]\s*참조하면/g)];
    if(fig1Refs.length>=2){
      // v10.2: "도 1을 참조하면"의 마지막 출현 위치 → 그 앞의 도면 소개문도 보존
      const lastIdx=fig1Refs[fig1Refs.length-1].index;
      // 도면 소개문("도 1은 ~이다") 탐색: lastIdx 앞 300자 이내에서 "도 1은" 패턴 찾기
      const searchStart=Math.max(0,lastIdx-300);
      const introMatch=text.substring(searchStart,lastIdx).match(/도\s+1[은는]\s+[^\n]*(?:블록도|예시도|구성도|개념도)[^\n]*\.\s*/);
      const cutIdx=introMatch?searchStart+introMatch.index:lastIdx;
      const removed=text.substring(0,cutIdx).trim();
      text=text.substring(cutIdx).trim();
      console.warn(`[v9.0] ${type} 상세설명: 중복 출력 감지 — "도 1을 참조하면" ${fig1Refs.length}회 발견, 마지막 본 사용 (${removed.length}자 제거)`);
    } else {
      // v10.2: 도면 소개문("도 1은 ~이다")이 "도 1을 참조하면" 앞에 올 수 있으므로
      // 프리앰블 제거 로직을 비활성화 (의도된 콘텐츠 보호)
    }
  }
  // 허용 도면 범위 결정
  // v10.5 fix: getLastFigureNumber 대신 _extractFigureNumbersFromDesign 사용
  // (getLastFigureNumber는 "도 N" 패턴을 텍스트 전체에서 매칭하여, 교차참조/비도면 숫자도 잡아 maxAllowed를 과대 산정)
  let maxAllowed;
  if(type==='device'){
    const deviceFigCount=parseInt(document.getElementById('optDeviceFigures')?.value||4);
    const _headerFigs=_extractFigureNumbersFromDesign(outputs.step_07||'');
    const _userFigMax=requiredFigures.length>0?Math.max(...requiredFigures.map(f=>f.num)):0;
    const _devMax=_headerFigs.length>0?Math.max(Math.max(..._headerFigs),_userFigMax):(getLastFigureNumber(outputs.step_07||'')||deviceFigCount);
    const _concCount=conceptDiagramTypes.filter(ct=>ct.svgContent).length;
    maxAllowed=_devMax+_concCount;
  }else{
    // 방법: 장치 마지막 도면 + 방법 도면
    const _devHeaders=_extractFigureNumbersFromDesign(outputs.step_07||'');
    const _devUserMax=requiredFigures.length>0?Math.max(...requiredFigures.map(f=>f.num)):0;
    const deviceMax=_devHeaders.length>0?Math.max(Math.max(..._devHeaders),_devUserMax):(getLastFigureNumber(outputs.step_07||'')||parseInt(document.getElementById('optDeviceFigures')?.value||4));
    const _methHeaders=_extractFigureNumbersFromDesign(outputs.step_11||'');
    const methodMax=_methHeaders.length>0?Math.max(..._methHeaders):getLastFigureNumber(outputs.step_11||'');
    const _concCount=conceptDiagramTypes.filter(ct=>ct.svgContent).length;
    maxAllowed=methodMax||(deviceMax+_concCount+parseInt(document.getElementById('optMethodFigures')?.value||2));
  }
  
  // 모든 "도 N" 참조 추출
  const figRefs=[...text.matchAll(/도\s+(\d+)/g)].map(m=>parseInt(m[1]));
  const outOfRange=figRefs.filter(n=>n>maxAllowed);
  if(!outOfRange.length)return text;
  
  // 초과 도면 번호 (중복 제거)
  const badNums=[...new Set(outOfRange)].sort((a,b)=>a-b);
  console.warn(`[v8.1] ${type} 상세설명: 범위 초과 도면 발견 — 도 ${badNums.join(', ')} (허용: ~도 ${maxAllowed})`);
  
  // 자동 교정: 초과 도면 참조 문단 제거
  let cleaned=text;
  const lines=cleaned.split('\n');
  const filteredLines=[];
  let skipSection=false;
  
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    // "도 N을 참조하면," or "도 N은 ~" 로 시작하는 줄이 초과 도면이면 해당 섹션 스킵
    const figStartMatch=line.match(/^\s*도\s+(\d+)\s*[을를은는]/);
    if(figStartMatch){
      const figN=parseInt(figStartMatch[1]);
      if(figN>maxAllowed){
        skipSection=true;
        continue;
      }else{
        skipSection=false;
      }
    }
    // 새로운 "도 N을 참조하면" 패턴이 나오면 스킵 해제 판단
    if(skipSection){
      const newFigStart=line.match(/^\s*도\s+(\d+)\s*[을를은는]/);
      if(newFigStart){
        const n=parseInt(newFigStart[1]);
        if(n<=maxAllowed){skipSection=false;}
        else continue;
      }else{
        // 빈 줄 2개 연속이면 섹션 끝으로 간주
        if(line.trim()===''&&i+1<lines.length&&lines[i+1].trim()===''){
          skipSection=false;
        }
        if(skipSection)continue;
      }
    }
    
    // 개별 문장 내 초과 도면 참조 제거 (문단 중간에 삽입된 경우)
    let safeLine=line;
    badNums.forEach(n=>{
      // "도 N에서는 ~." 형태의 완전한 문장 제거
      safeLine=safeLine.replace(new RegExp(`도\\s*${n}[을를은는에]서?[^.。]*[.。]\\s*`,'g'),'');
      // "도 N을 참조하면, ~." 형태
      safeLine=safeLine.replace(new RegExp(`도\\s*${n}[을를]\\s*참조하면[^.。]*[.。]\\s*`,'g'),'');
    });
    filteredLines.push(safeLine);
  }
  
  cleaned=filteredLines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  
  // 토스트 알림
  if(cleaned!==text){
    const removed=text.length-cleaned.length;
    App.showToast(`⚠️ 범위 초과 도면(도 ${badNums.join(',')}) 참조 자동 제거 (${removed}자)`,'error');
  }
  
  return cleaned;
}
// v10.2: 한국어 "은/는" 조사 선택 — 도면 번호 기준
function figParticle(n){
  // 받침 있는 숫자: 1(일),3(삼),6(육),7(칠),8(팔)
  // 받침 없는 숫자: 2(이),4(사),5(오),9(구),0(영)
  // 10의 배수: 십→받침→은
  const lastDigit=n%10;
  if(lastDigit===0)return n>=10?'은':'는'; // 10,20,30...→십(받침), 0→영(무받침)
  if([1,3,6,7,8].includes(lastDigit))return '은';
  return '는'; // 2,4,5,9
}
function extractBriefDescriptions(s07,s11){
  const d=[],seen=new Set();
  // v10.2: 0. Step 8 상세설명에서 도면 소개문 우선 추출
  const latestDesc=getLatestDescription();
  if(latestDesc){
    latestDesc.split('\n').forEach(l=>{
      // "도 N은 ~블록도이다." 또는 "도 N은 ~예시도이다. 도 N을 참조하면,~" (같은 줄)
      const m=l.trim().match(/^(도\s*(\d+)\s*[은는]\s+.+?(?:블록도|예시도|구성도|개념도|순서도|흐름도|도면)[^.]*이다\.)/);
      if(m&&!seen.has(m[2])){seen.add(m[2]);d.push(m[1]);}
    });
  }
  // 1. AI 출력에서 간단한 설명 추출 (Step 8에서 이미 추출된 것은 건너뜀)
  [s07,s11].forEach(t=>{if(!t)return;const i=t.indexOf('---BRIEF_DESCRIPTIONS---');
    if(i>=0){
      // 마커 이후: 도 N으로 시작하는 줄 추출
      t.slice(i+24).trim().split('\n').filter(l=>/^도\s*\d+\s*[은는]\s/.test(l.trim())).forEach(l=>{const m=l.trim().match(/^도\s*(\d+)/);if(m&&!seen.has(m[1])){seen.add(m[1]);d.push(l.trim());}});
    }else{
      // 마커 없을 때: "도 N은/는 ~이다." 형식만 추출 (파트1 디자인 줄 제외)
      t.split('\n').filter(l=>/^도\s*\d+\s*[은는]\s/.test(l.trim())&&/이다\.\s*$/.test(l.trim())).forEach(l=>{const m=l.trim().match(/^도\s*(\d+)/);if(m&&!seen.has(m[1])){seen.add(m[1]);d.push(l.trim());}});
    }
  });
  // 1b. v10.0: 사용자 도면 간단한 설명 추가
  requiredFigures.forEach(rf=>{
    const fn=String(rf.num);const n=parseInt(fn);
    if(!seen.has(fn)){
      d.push(`도 ${fn}${figParticle(n)} ${rf.description}을 나타내는 도면이다.`);
      seen.add(fn);
    }
  });
  // 2. 누락 도면 보완: diagramData 기반 폴백 생성 (v10.0: getAutoFigNums 사용)
  const title=selectedTitle||'본 발명';
  const devSubject=getDeviceSubject();
  const devData=diagramData.step_07||[];
  const methodData=diagramData.step_11||[];
  const devAutoNums=getAutoFigNums('step_07');
  const methAutoNums=getAutoFigNums('step_11');
  // 2a. 장치 도면 폴백
  devData.forEach((dd,i)=>{const fn=String(devAutoNums[i]||(i+1));if(seen.has(fn))return;
    const n=parseInt(fn);const pp=figParticle(n);
    function exRef(lab){const m=lab.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);return m?m[1]:'';}
    const allL1=dd.nodes.every(n=>{const r=exRef(n.label);if(!r)return false;const num=parseInt(r);return(num>0&&num<10)||(num>=100&&num<1000&&num%100===0);});
    if(i===0||allL1){d.push(`도 ${fn}${pp} ${title}의 전체 구성을 나타내는 블록도이다.`);}
    else{const refs=dd.nodes.map(n=>exRef(n.label)).filter(Boolean).map(Number).filter(n=>n>=100&&n<1000&&n%100===0);
      const pRef=refs.length?refs[0]:100;const pNode=dd.nodes.find(n=>{const r=exRef(n.label);return r&&parseInt(r)===pRef;});
      const pName=pNode?pNode.label.replace(/[\s(](?:S|D)?\d+[)\s]*$/i,'').trim():devSubject;
      d.push(`도 ${fn}${pp} ${pName}(${pRef})의 내부 구성을 나타내는 블록도이다.`);}
    seen.add(fn);});
  // 2b. 방법 도면 폴백
  methodData.forEach((md,i)=>{const fn=String(methAutoNums[i]||(devData.length+i+1));if(seen.has(fn))return;
    const n=parseInt(fn);d.push(`도 ${fn}${figParticle(n)} ${title}에 의해 수행되는 방법을 나타내는 순서도이다.`);seen.add(fn);});
  // 2b-2. v11.0: 예시도/개념도 간단한 설명 추가 (실제 생성된 것만)
  const conceptAutoNums=getAutoFigNums('step_07c');
  conceptDiagramTypes.forEach((ct,i)=>{
    if(!ct.svgContent)return;
    const fn=String(conceptAutoNums[i]||'?');if(seen.has(fn))return;
    const n=parseInt(fn);const typeDef=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
    d.push(`도 ${fn}${figParticle(n)} ${title}의 ${typeDef.label}을 나타내는 예시도이다.`);
    seen.add(fn);
  });
  // 2c. diagramData 없을 때 텍스트 기반 폴백
  if(!devData.length&&s07){const figs=s07.match(/도\s*(\d+)\s*:/g)||[];figs.forEach(f=>{const m=f.match(/(\d+)/);if(!m||seen.has(m[1]))return;const fn=m[1];const n=parseInt(fn);
    if(fn==='1'){d.push(`도 1${figParticle(1)} ${title}의 전체 구성을 나타내는 블록도이다.`);}
    else{d.push(`도 ${fn}${figParticle(n)} ${title}의 세부 구성을 나타내는 블록도이다.`);}seen.add(fn);});}
  if(!methodData.length&&s11){const figs=s11.match(/도\s*(\d+)\s*:/g)||[];figs.forEach(f=>{const m=f.match(/(\d+)/);if(!m||seen.has(m[1]))return;const fn=m[1];const n=parseInt(fn);
    d.push(`도 ${fn}${figParticle(n)} ${title}에 의해 수행되는 방법을 나타내는 순서도이다.`);seen.add(fn);});}
  // 2d. 실제 도면 번호 기준 필터 — UI 설정값 + 생성 여부 기반
  const _uiDevCount=Math.max(parseInt(document.getElementById('optDeviceFigures')?.value||4)-requiredFigures.length,0);
  const _hasMeth=!!(methodData.length||outputs.step_11);
  const _uiMethCount=_hasMeth?parseInt(document.getElementById('optMethodFigures')?.value||2):0;
  const _uiConcepts=conceptDiagramTypes.filter(ct=>ct.svgContent);
  const _uiConcCount=_uiConcepts.length;
  const _uiConcOverrides=_uiConcepts.map(ct=>ct.figNumOverride||0);  // ③ 예시도 지정 번호 반영
  const _uiFigNums=computeFigNums(_uiDevCount,_uiMethCount,_uiConcCount,_uiConcOverrides);
  const validFigNums=new Set();
  _uiFigNums.device.forEach(n=>validFigNums.add(String(n)));
  _uiFigNums.method.forEach(n=>validFigNums.add(String(n)));
  _uiFigNums.concept.forEach(n=>validFigNums.add(String(n)));
  requiredFigures.forEach(rf=>validFigNums.add(String(rf.num)));
  if(validFigNums.size>0){for(let i=d.length-1;i>=0;i--){const fm=d[i].match(/도\s*(\d+)/);if(fm&&!validFigNums.has(fm[1]))d.splice(i,1);}}
  // 3. 정렬
  d.sort((a,b)=>{const na=parseInt(a.match(/도\s*(\d+)/)?.[1]||0),nb=parseInt(b.match(/도\s*(\d+)/)?.[1]||0);return na-nb;});
  return d.join('\n');
}
function stripKoreanParticles(w){if(!w||w.length<2)return w;const ps=['에서는','으로써','에서','으로','에게','부터','까지','에는','하는','되는','된','하여','있는','없는','같은','통하여','위한','대한','의한','를','을','이','가','은','는','에','의','와','과','로','도','든','인','적','로서'];for(const p of ps){if(w.endsWith(p)&&w.length>p.length+1)return w.slice(0,-p.length);}return w;}

// ═══════════ FILE UPLOAD ═══════════
// 공유 파일 처리 함수
async function _processUploadedFiles(files){
  const listEl=document.getElementById('fileList');
  for(const file of files){
    if(uploadedFiles.find(f=>f.name===file.name)){App.showToast(`"${file.name}" 이미 추가됨`,'info');continue;}
    const item=document.createElement('div');item.className='file-upload-item';item.id=`file_${uploadedFiles.length}`;
    item.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:6px;font-size:13px';
    item.innerHTML=`<span class="ico" data-icon="doc"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(file.name)}</span><span class="badge badge-neutral">${App.formatFileSize(file.size)}</span><span style="color:var(--color-primary)">추출 중...</span>`;
    if(listEl)listEl.appendChild(item);
    try{
      const text=await App.extractTextFromFile(file);
      if(text&&text.trim()){
        uploadedFiles.push({name:file.name,text:text.trim(),size:file.size});
        const ta=document.getElementById('projectInput');const separator=ta.value.trim()?'\n\n':'';
        ta.value+=`${separator}[첨부: ${file.name}]\n${text.trim()}`;
        item.innerHTML=`<span class="ico" data-icon="check-circle"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(file.name)}</span><span class="badge badge-success">${App.formatFileSize(file.size)} · ${text.trim().length.toLocaleString()}자</span><button class="btn btn-ghost btn-sm" onclick="removeUploadedFile(${uploadedFiles.length-1},'${App.escapeHtml(file.name).replace(/'/g, "\\'")}')">\u2715</button>`;
        App.showToast(`"${file.name}" 추출 완료`);
      }else{
        item.innerHTML=`<span class="ico" data-icon="warning"></span><span style="flex:1">${App.escapeHtml(file.name)}</span><span class="badge badge-warning">추출 불가</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">\u2715</button>`;
      }
    }catch(e){
      item.innerHTML=`<span class="ico" data-icon="x"></span><span style="flex:1">${App.escapeHtml(file.name)}</span><span class="badge badge-error">오류</span><button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">\u2715</button>`;
    }
  }
  if(uploadedFiles.length>0)debouncedGenerateInventionSummary();
}
async function handleFileUpload(event) {
  const files = Array.from(event.target.files);if (!files.length) return;
  await _processUploadedFiles(files);
  event.target.value = '';
}
function removeUploadedFile(idx, name) {
  const f = uploadedFiles.find(f=>f.name===name) || uploadedFiles[idx];if (!f) return;
  const ta = document.getElementById('projectInput');const marker = `[첨부: ${f.name}]`;const mIdx = ta.value.indexOf(marker);
  if (mIdx >= 0) {const nextMarker = ta.value.indexOf('\n\n[첨부:', mIdx + marker.length);const endIdx = nextMarker >= 0 ? nextMarker : ta.value.length;ta.value = (ta.value.slice(0, mIdx) + ta.value.slice(endIdx)).trim();}
  const realIdx = uploadedFiles.indexOf(f);
  if (realIdx >= 0) uploadedFiles.splice(realIdx, 1);
  const el = document.getElementById(`file_${idx}`);if (el) el.remove();App.showToast(`"${name}" 제거됨`);
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
  overlay.innerHTML='<div style="text-align:center;color:var(--color-primary);font-weight:600"><span class="ico" data-icon="link" data-size="32"></span><br>파일을 여기에 놓으세요<br><span style="font-size:12px;font-weight:normal;color:var(--color-text-secondary)">Word, PDF, PPT, 이미지 등</span></div>';
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
  await _processUploadedFiles(files);
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
    summaryEl.innerHTML='<span style="font-weight:600;color:var(--color-text-primary)"><span class="ico" data-icon="clipboard"></span> 발명 내용 요약</span><br><span style="color:var(--color-primary)">요약 생성 중...</span>';
    ta.parentElement.insertBefore(summaryEl,ta.nextSibling);
  }else{
    summaryEl.innerHTML='<span style="font-weight:600;color:var(--color-text-primary)"><span class="ico" data-icon="clipboard"></span> 발명 내용 요약</span><br><span style="color:var(--color-primary)">요약 생성 중...</span>';
  }
  try{
    const r=await App.callClaude(`아래 발명 내용을 300자 이내로 핵심만 요약하라. 기술분야, 핵심 구성요소, 주요 기능을 포함. 마크다운/글머리 없이 자연스러운 문장으로.\n\n${inv.slice(0,5000)}`);
    summaryEl.innerHTML=`<span style="font-weight:600;color:var(--color-text-primary)"><span class="ico" data-icon="clipboard"></span> 발명 내용 요약</span><br>${App.escapeHtml(r.text)}`;
  }catch(e){
    summaryEl.innerHTML=`<span style="font-weight:600;color:var(--color-text-primary)"><span class="ico" data-icon="clipboard"></span> 발명 내용 요약</span><br><span style="color:var(--color-text-tertiary)">요약 생성 실패</span>`;
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
  // opts.deviceOnly: 장치 상세설명 전용 — 방법 관련 문장 제거
  if(opts&&opts.deviceOnly){
    text=text.split('\n').filter(line=>{
      const l=line.trim();
      if(!l)return true; // 빈 줄 유지
      // 방법 단계 정의 줄 제거 (S100, S200, S110 등으로 시작)
      if(/^S\d{2,4}/i.test(l))return false;
      // "단계 S110" 또는 "S110 단계" 패턴 포함 줄
      if(/단계\s*S\d|S\d{2,4}\s*단계/i.test(l))return false;
      // "S110:" 등으로 시작하는 줄
      if(/^S\d{2,4}\s*[:：]/i.test(l))return false;
      // "S110 내지 S150" 등 방법 범위 표현
      if(/S\d{2,4}\s*내지\s*S\d/i.test(l))return false;
      // "~하는 단계" + S참조 혼합
      if(/하는\s*단계.*S\d|S\d.*하는\s*단계/i.test(l))return false;
      return true;
    }).join('\n');
    return '\n\n★★★ [발명 내용 — 아래 내용에서 장치 구성(~부)에 관련된 기술적 요소만 참고하라. 방법/단계(S+숫자)는 무시하라] ★★★\n'+text;
  }
  // opts.methodOnly: 방법 상세설명 전용
  if(opts&&opts.methodOnly){
    return '\n\n★★★ [발명 내용 — 아래 내용에서 방법/절차/단계에 관련된 기술적 요소만 참고하라] ★★★\n'+text;
  }
  return '\n\n★★★ [발명 내용 — 아래 내용의 기술적 요소를 빠짐없이 반영하라] ★★★\n'+text;
}
function getRequiredFiguresInstruction(){
  if(!requiredFigures.length)return '';
  const list=requiredFigures.map(f=>`- 도 ${f.num}: ${f.description}`).join('\n');
  return `\n\n[사용자 도면 — 아래 도면은 사용자가 이미 보유하고 있다. 이 번호들은 건너뛰고 나머지 도면만 새로 생성하라. 단, 도면의 간단한 설명에는 사용자 도면도 모두 포함하라.]\n${list}`;
}
// ═══ v10.0/v11.0/③: 사용자 도면·예시도 지정 번호 스킵 — 자동 도면 번호 산출 ═══
// devCount/methCount/conceptCount: 자동 생성할 장치/방법/개념도 도면 수. conceptOverrides: 예시도별 지정 도 번호(figNumOverride, 0=자동).
//   ★ ③: requiredFigures.num(사용자 업로드)에 더해 예시도 figNumOverride 도 예약 → 지정 위치에 예시도, 자동 도면은 밀림(삽입 밀림).
function computeFigNums(devCount,methCount,conceptCount,conceptOverrides){
  conceptCount=conceptCount||0;
  conceptOverrides=Array.isArray(conceptOverrides)?conceptOverrides:[];
  // 예약 집합 = 사용자 업로드 번호 ∪ 예시도 지정 번호(figNumOverride)
  const reserved=new Set(requiredFigures.map(f=>f.num));
  conceptOverrides.forEach(n=>{const v=parseInt(n);if(v>0)reserved.add(v);});
  const devNums=[],conceptNums=[],methNums=[];
  let c=1;
  for(let i=0;i<devCount;i++){while(reserved.has(c))c++;devNums.push(c);c++;}
  for(let i=0;i<conceptCount;i++){
    const ov=parseInt(conceptOverrides[i]);
    if(ov>0){conceptNums.push(ov);}                                  // ★ 지정 번호(이미 예약)
    else{while(reserved.has(c))c++;conceptNums.push(c);c++;}          // 자동(예약 skip)
  }
  for(let i=0;i<methCount;i++){while(reserved.has(c))c++;methNums.push(c);c++;}
  const _max=arr=>arr.length?Math.max.apply(null,arr):0;
  const lastDeviceFig=conceptNums.length?_max(conceptNums):_max(devNums);  // 방법 앞 최고 번호(override 대비 max)
  const lastFig=Math.max(_max(devNums),_max(conceptNums),_max(methNums));  // override 가 자동 범위 밖이어도 정확
  return{device:devNums,concept:conceptNums,method:methNums,lastDeviceFig,lastFig};
}
// 렌더링용: diagramData 기반 자동 도면 번호 (★ ③ 예시도 figNumOverride 반영)
function getAutoFigNums(sid){
  const devCount=diagramData.step_07?.length||0;
  const methCount=diagramData.step_11?.length||0;
  const concepts=conceptDiagramTypes.filter(ct=>ct.svgContent);
  const cOverrides=concepts.map(ct=>ct.figNumOverride||0);
  const r=computeFigNums(devCount,methCount,concepts.length,cOverrides);
  return sid==='step_07'?r.device:sid==='step_07c'?r.concept:r.method;
}
// ③ 생성된(svgContent) 예시도들의 지정 도 번호 배열 — computeFigNums 4번째 인자용(figNumOverride 일관 주입)
function _placedConceptOverrides(){
  return conceptDiagramTypes.filter(ct=>ct.svgContent).map(ct=>ct.figNumOverride||0);
}
function _getConceptCount(){
  return (typeof conceptDiagramEnabled!=='undefined'&&conceptDiagramEnabled)
    ?(diagramData.step_07c?.length||conceptDiagramCount||0)
    :0;
}
// 사용자 도면 설명을 Step 8/12 프롬프트에 삽입하는 헬퍼
function getUserFiguresPromptBlock(){
  if(!requiredFigures.length)return '';
  return '\n\n[사용자 도면 — 아래 도면은 사용자가 제공한 것이며, 상세설명에서 해당 도면 번호를 참조하여 설명을 포함하라. 발명 내용과 정합되도록 기술하라.]\n'+
    requiredFigures.map(f=>`도 ${f.num}: ${f.description}`).join('\n');
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

// ═══ 통일된 폰트 크기 계산 (v14) ═══
// 모든 도면 렌더링(SVG/PPTX/Canvas)에서 동일한 폰트 크기 반환
function _computeDiagramFontSize(boxW,boxH,labelLength){
  const safeWidth=boxW*0.85;
  const charWidthFactor=0.58;
  const maxByWidth=Math.floor(safeWidth/(Math.max(labelLength,2)*charWidthFactor));
  const maxByHeight=Math.floor(boxH*0.35);
  return Math.max(10,Math.min(13,maxByWidth,maxByHeight));
}
const REF_NUM_FONT_SIZE=11;

// ═══ 공유 도면 유틸리티 함수 (downloadPptx / downloadDiagramImages 공용) ═══
function _sharedExtractRefNum(label,fallback){
  const match=label.match(/[(\s]?((?:S|D)?\d+)[)\s]?$/i);
  return match?match[1]:fallback;
}
function _sharedIsL1RefNum(ref){
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
function _sharedFindImmediateParent(refNums){
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

// 등록번호 포맷: 1020XXXXXXX → 10-20XXXXX
function formatRegNumber(regNum){
  if(!regNum)return '';
  const cleaned=String(regNum).replace(/[^0-9]/g,'');
  if(!cleaned)return regNum;
  if(cleaned.length>=10){
    let core=cleaned;
    if(core.length===13)core=core.slice(0,-4);
    if(core.startsWith('10'))return'10-'+core.substring(2);
    if(core.startsWith('20'))return'20-'+core.substring(2);
  }
  return regNum;
}

// 한국어 조사 제거 → 핵심 키워드 추출
function extractPatentKeywords(title){
  return title
    .replace(/[및과와]/g,' ')
    .replace(/\s+/g,' ').trim()
    .split(' ')
    .map(w=>stripKoreanParticles(w))
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
  // v10.2: 특허번호만 표시 — 발명의 명칭 및 AI 추천 문구 제거
  return{
    formatted:`【특허문헌】\n(특허문헌 1) ${docType} 제${fmtNum||'미확인'}호`,
    patent:{
      publicationNumber:best._regNum||best._appNum,
      title:best._title,
      assignee:best._applicant,
      applicationNumber:best._appNum,
      registerDate:best.registerDate||best.registrationDate||'',
      ipcNumber:best.ipcNumber||'',
      source:best.source||'kipris'
    },
    sourceNote:'',
    src:best.source==='claude'?'AI':'KIPRIS'
  };
}

// ★ 수학식 생성 프롬프트 — 단일 소스(분산 제거). step_09 작성·_cascadeRunMath·runMathInsertion·applyReview 재삽입이 전부 이걸 사용.
//   [배경] 이전엔 같은 수학식 프롬프트가 3곳(case step_09 / applyReview 보존실패 재생성 / applyReview 신규생성)에 흩어져
//          곱셈 기호 규칙이 갈렸다 — step_09 는 "× 또는 ·" 허용(혼용), 나머지 2곳은 기호 규칙 자체가 누락. → 단일화로 근본 해결.
//   ★ 곱셈은 "×"(U+00D7) 하나로 통일. 내적은 "·"(U+00B7), 소수점은 "."로 ★구분 보존★(곱셈만 ×).
//   @param {string} countText 생성 개수 문구("5개 내외" 또는 "3개")  @param {string} descText 현재 상세설명  @param {string} [extraTail] 추가 컨텍스트(옵션)
function buildMathPrompt(countText, descText, extraTail){
  return `상세설명의 핵심 알고리즘에 수학식 ${countText}.

★★★ 수학식 변수 정의 완전성 규칙 (기재불비 방지 — 핵심) ★★★
- 모든 수학식의 모든 변수는 반드시 아래 항목을 포함하여 정의하라:
  (1) 변수명과 물리적 의미 (예: "S는 생체 리듬 상태 지표이다")
  (2) 값 유형 (스칼라/벡터/분류값)
  (3) 값 범위 또는 예시적 범위 (예: "0 이상 1 이하의 정규화값이다")
  (4) 단위가 있으면 단위 명시
- 같은 변수가 복수 수학식에 등장하면, 정의가 모순되지 않게 하라.
  → 수학식 1의 출력이 수학식 2의 입력이면, 변수명·정의·범위가 완전 일치해야 한다.

★★★ 수학식 간 정합성 규칙 (핵심) ★★★
- 동일 목적의 수학식이 2개 이상 있으면(예: 보정 공식이 2가지 방식), 반드시:
  (1) 두 식의 관계를 명시하라 ("수학식 3은 수학식 4의 단순화 형태이다" 또는 "수학식 3과 수학식 4는 각각 초기 보정과 장기 보정에 적용된다")
  (2) 변수 간 대응관계를 정리하라 (예: "C = S_post - S_target에서 C는 (Sd - Sa)와 부호가 반대이다")
  (3) 부호/방향이 일관되는지 검증하라
- 수치 예시 계산 시, 부호와 방향이 본문 설명과 일치하는지 반드시 검산하라:
  → "음량 감소 폭이 증가한다"고 서술했으면, 계산 결과도 절대값이 더 커야 한다
  → "각성 수준이 하강한다"고 서술했으면, 수치도 더 작아야 한다

★★★ 보정/학습 변수 규칙 ★★★
- alpha, beta 등 학습률/보정 계수에는 반드시:
  (1) 부호 의미: 양수일 때 어느 방향으로 보정되는가
  (2) 값 범위: 예시적 범위 (예: 0.01~0.5)
  (3) 과도 누적 방지: 보정 횟수 상한, 누적 보정량 상한, 또는 점감 조건
  (4) 초기값과 갱신 여부
규칙: 수학식+삽입위치만. 상세설명 재출력 금지. 첨자 금지.
★ 수치 예시는 "예를 들어,", "일 예로,", "구체적 예시로," 등 자연스러운 표현 사용 ("예시 대입:" 금지)

★★★ 수학 기호 규칙 (필수 — 곱셈은 × 로 통일) ★★★
- ★ 곱셈(스칼라·일반 곱) 연산자는 반드시 "×" (U+00D7) 하나로 통일하라.
- ❌ 금지: ASCII 알파벳 "x" 또는 "X"를 곱셈 기호로 사용 (변수명 x와 혼동)
- ❌ 금지: ASCII 별표 "*"를 곱셈 기호로 사용 (코드 표기, 특허 명세서 부적합)
- ❌ 금지: 가운데점 "·"를 곱셈 기호로 사용 (내적과 혼동 — 곱셈은 반드시 ×)
- ✅ 곱셈 올바른 예: "a × b", "2 × π × r", "α × β", "3 × 10⁻⁶"
- ❌ 곱셈 잘못된 예: "a x b", "a * b", "a · b", "alpha*beta"
- ★ 가운데점 "·" (U+00B7)은 ★벡터 내적(dot product)에만★ 사용하라 (예: "u · v" 는 벡터 u와 v의 내적). 곱셈과 구분한다.
- ★ 소수점은 마침표 "." 를 사용하라 (예: "0.5", "1.2 × 10³"). 소수점에 가운데점(·)을 쓰지 마라.
- 변수 인접 곱셈은 기호 생략 가능 (예: "ab", "2πr").
- 나눗셈은 "÷" 또는 분수 표기, 부등호는 "≤", "≥", "≠" 사용
- 그리스 문자는 유니코드 사용 (α, β, γ, π, σ, μ, λ — "alpha", "beta" 등 영어 표기 금지)
- "여기서," 변수 설명, "예를 들어," 수치 예시에서도 동일 규칙 적용

⛔⛔⛔ 수학식 간 교차참조 금지 (핵심!) ⛔⛔⛔
- 수학식의 "여기서," 설명에서 다른 수학식을 번호로 참조하지 마라.
- ❌ 금지: "수학식 1에 의해 산출된 Lw", "수학식 2의 결과를 이용하여"
- ✅ 허용: "상기 산출된 가중 소음 수준 Lw", "상기 개별 소음 수준 Li를 이용하여"
- 각 수학식의 변수 설명은 해당 수학식 내에서 자체 완결적으로 작성하라.
- 변수가 다른 수학식에서도 사용되는 경우, 변수의 의미만 재서술하라 (번호 참조 금지).

⛔⛔ ANCHOR 규칙 ⛔⛔
- ANCHOR는 반드시 마침표(다.)로 끝나는 완전한 문장의 끝부분을 사용하라.
- ❌ 금지: 쉼표(,) 또는 접속어(~하고, ~하며)로 끝나는 절 중간을 ANCHOR로 사용
- ❌ 금지: "예를 들어" 블록 내부를 ANCHOR로 사용
- ✅ 올바른 ANCHOR 예: "~을 산출한다." "~을 포함한다." "~으로 구성된다."

⛔⛔ FORMULA 규칙 ⛔⛔
- FORMULA에는 【수학식 N】 + 수식 + "여기서," + "예를 들어," 만 포함.
- ⛔ FORMULA 안에 상세설명 원문 텍스트를 절대 포함하지 마라.
- FORMULA는 "예를 들어," 예시 문장의 마침표(다.)로 종료하라.
- FORMULA 종료 후 추가 텍스트 금지.

출력:
---MATH_BLOCK_1---
ANCHOR: (이 수식이 산출·정의하는 값을 직접 서술하며 상세설명에 정확히 1회만 등장하는 고유 문장의 끝부분 20자 이상, 반드시 "다."로 종료 — 수식과 무관한 문장·중복 문장 금지)
FORMULA:
【수학식 1】
(수식)
여기서, (각 변수는 상세설명에 이미 등장한 파라미터·구성을 구체화하는 것이어야 함 — 본문에 없는 새 개념 도입 금지, 다른 수학식 번호 참조 금지, 변수명으로만 설명)
예를 들어, (수치 대입 설명)

${selectedTitle}
[현재 상세설명] ${descText}${extraTail||''}`;
}

function buildPrompt(stepId){
  const inv=document.getElementById('projectInput').value,T=selectedTitle;
  const styleRef=getStyleRef();
  const prompt=_buildPromptCore(stepId,inv,T,styleRef);
  if(!prompt)return prompt;
  
  // v6.0: 기존 내용 존재 시 부분 수정 모드
  const userCmd=getStepUserCommand(stepId);
  if(userCmd&&outputs[stepId]){
    // v10.5 fix: step_08/step_12 부분 수정 시 도면 범위 제약 명시 (재실행 시 없는 도면 참조 방지)
    let _pmFigConstraint='';
    if(stepId==='step_08'){
      const _pmDesign=outputs.step_07||'';
      const _pmActual=_extractFigureNumbersFromDesign(_pmDesign);
      const _pmCFN=getAutoFigNums('step_07c').filter((_,i)=>conceptDiagramTypes[i]?.svgContent);
      const _pmAll=[...new Set([..._pmActual,...requiredFigures.map(f=>f.num),..._pmCFN])].sort((a,b)=>a-b);
      if(_pmAll.length>0){
        const _pmMax=Math.max(..._pmAll);
        _pmFigConstraint=`\n⛔⛔⛔ 도면 범위 제한 (위반 시 전체 무효) ⛔⛔⛔\n- 이 발명의 장치 도면: ${_pmAll.map(n=>'도 '+n).join(', ')} (총 ${_pmAll.length}개)\n- 위 목록에 없는 도면 번호를 절대 참조하지 마라.\n- 도 ${_pmMax+1} 이후 도면 참조/설명 금지.\n`;
      }
    }else if(stepId==='step_12'){
      const _pmMeth=_extractFigureNumbersFromDesign(outputs.step_11||'');
      if(_pmMeth.length>0){
        const _pmMax=Math.max(..._pmMeth);
        _pmFigConstraint=`\n⛔⛔⛔ 도면 범위 제한 (위반 시 전체 무효) ⛔⛔⛔\n- 이 발명의 방법 도면: ${_pmMeth.map(n=>'도 '+n).join(', ')} (총 ${_pmMeth.length}개)\n- 위 목록에 없는 방법 도면 번호를 절대 참조하지 마라.\n- 도 ${_pmMax+1} 이후 도면 참조/설명 금지.\n`;
      }
    }
    // 기존 내용 + 추가 지시 → 부분 수정 프롬프트
    // [C1-3] Layer 1 가드: invention_scope 주입
    return `아래 [기존 작성 내용]을 바탕으로, [수정 지시사항]에 해당하는 부분만 수정하고 나머지는 그대로 유지하여 전체 내용을 출력하라.
수정 지시와 무관한 부분은 원문 그대로 유지해야 한다. 전체 재작성 금지.
${_pmFigConstraint}
[수정 지시사항]
${userCmd}

[기존 작성 내용]
${outputs[stepId]}

[참고: 원래 작성 기준]
${prompt}${_maybeScopeGuard(stepId,'text')}`;
  }

  // 기존 내용 없음 → 전체 신규 작성 + 추가 지시사항
  // [C1-3] Layer 1 가드: invention_scope 주입
  return prompt+buildUserCommandSuffix(stepId)+_maybeScopeGuard(stepId,'text');
}
function _buildPromptCore(stepId,inv,T,styleRef){
  switch(stepId){
    case 'step_01':return `프로젝트를 분석하여 특허 발명의 명칭 후보를 5가지 생성하라.\n형태: \"~${selectedTitleType}\"\n각 후보에 국문+영문.\n\n출력형식:\n[1] 국문: (명칭) / 영문: (명칭)\n[2] 국문: (명칭) / 영문: (명칭)\n[3] 국문: (명칭) / 영문: (명칭)\n[4] 국문: (명칭) / 영문: (명칭)\n[5] 국문: (명칭) / 영문: (명칭)\n\n[프로젝트]\n${inv}`;
    case 'step_02':return `【기술분야】를 작성. "본 발명은 ${T}에 관한 것이다." 이 한 문장만 출력하라. 발명의 명칭을 축약하거나 변경하지 마라. 다른 항목 포함 금지. 헤더 금지.${styleRef}`;
    case 'step_03':return `【발명의 배경이 되는 기술】을 작성.\n\n★ 역설계 작성 원칙 ★\n아래 [과제]에서 제기한 문제가 왜 존재하는지, 종래 기술의 한계를 설명하라.\n과제에서 "A가 문제다"라고 했으면, 배경기술에서는 "종래 기술은 A를 해결하지 못했다"를 논거로 전개.\n\n3문단(기존문제/최근동향/필요성), 각 450자. 번호 없이. 다른 항목 포함 금지. 헤더 금지.\n\n발명의 명칭: ${T}\n[과제] ${outputs.step_05||''}\n[장치 청구항 요약] ${(outputs.step_06||'').slice(0,1500)}\n[프로젝트] ${inv}${styleRef}`;
    case 'step_04':return null; // KIPRIS API 실시간 검색으로 대체
    case 'step_05':return `【해결하고자 하는 과제】를 역설계 방식으로 작성하라.\n\n★ 역설계 원칙 ★\n아래 [과제의 해결 수단]은 이미 확정된 청구항의 요약이다.\n이 해결 수단이 "해결하는 문제가 무엇인지"를 역으로 추론하여 과제를 작성하라.\n\n패턴: 해결수단이 "A를 제공한다" → 과제는 "종래에는 A가 없어서 B 문제가 있었다"\n패턴: 해결수단이 "X부를 포함하는 장치" → 과제는 "종래 X 처리가 비효율적이었다"\n\n"본 발명은 ~을 제공하는 것을 목적으로 한다." 150자 이내.\n마지막: "본 발명의 기술적 과제는 이상에서 언급한 기술적 과제로 제한되지 않으며, 언급되지 않은 또 다른 기술적 과제들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다." 헤더 금지.\n\n발명의 명칭: ${T}\n[과제의 해결 수단] ${outputs.step_17||''}\n[장치 청구항 요약] ${(outputs.step_06||'').slice(0,2000)}${styleRef}`;

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

(R4) 일반 종속항: 상위항 인용하여 구체화·확장. ★ 발명의 본질(핵심 구성요소·핵심 기능)을 각 일반 종속항이 분담하여 빠짐없이 한정하라 — 발명의 본질적 기능 중 어느 하나라도 종속항 어디에도 구체화되지 않고 누락되는 일이 없도록 하라(일반 종속항은 발명충실항으로서 발명의 본질을 충실히 반영해야 한다). 수치/수식은 과도하게 고정하지 않고, 후속 Step 8/9/13에서 상세화 가능하도록 문장 구성.

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
      console.log('[buildPrompt step_07] outputs.step_06 length=',(outputs.step_06||'').length);
      const f=document.getElementById('optDeviceFigures')?.value||'4';
      const totalFig=parseInt(f)||4;
      const reqInst=getRequiredFiguresInstruction();
      const genCount=totalFig-requiredFigures.length;
      const figNums=computeFigNums(Math.max(genCount,0),0);
      const autoNums=figNums.device;
      return `【장치 청구범위】에 대한 도면을 설계하라.

⛔⛔⛔ 도면 수 규칙 (절대 준수) ⛔⛔⛔
- 자동 생성할 도면: 정확히 ${genCount}개 (${autoNums.map(n=>'도 '+n).join(', ')})
- ★★★ 도면을 ${genCount}개보다 많이 생성하지 마라. ${genCount}개보다 적게 생성하지 마라. ★★★
${requiredFigures.length?`- 사용자 도면: ${requiredFigures.map(rf=>'도 '+rf.num+' ('+rf.description+')').join(', ')} — 이미 보유. 생성 금지.\n- 총 도면 수: ${totalFig}개 (자동 ${genCount}개 + 사용자 ${requiredFigures.length}개)`:`- 총 도면 수: ${totalFig}개`}

★★★ 청구항 구성요소 정합 규칙 (핵심) ★★★
- 도면에 사용하는 구성요소 명칭과 참조번호는 반드시 【장치 청구범위】와 일치해야 한다.
- 청구항에 "통신부(110)"가 있으면 도면에서도 "통신부(110)"으로 표기하라.
- 청구항에 없는 구성요소를 도면에 임의로 추가하지 마라.
- 단, 도 1의 L1 외부 장치(사용자 단말, 네트워크 등)는 청구항에 명시적으로 없더라도 시스템 구성상 필요하면 추가 가능.
- 도 2 이후의 내부 구성요소는 반드시 청구항에 기재된 것만 사용하라.

${_buildClaimComponentHierarchy(outputs.step_06||'')}

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

⛔⛔⛔ 명칭 고유성 규칙 (기재불비 — 절대 위반 금지) ⛔⛔⛔
- 서로 다른 참조번호에는 반드시 서로 다른 명칭을 사용하라.
  <span class="ico" data-icon="x"></span> 금지: 서버(100)와 서버(300) — 같은 이름에 다른 번호
  <span class="ico" data-icon="check-circle"></span> 올바른: 통합 서버(100)와 벤더 서버(300) — 구별 가능한 이름
- 서로 같은 참조번호에는 반드시 동일한 명칭을 사용하라.
  <span class="ico" data-icon="x"></span> 금지: 도 1에서 "처리부(110)", 도 2에서 "분석부(110)"
  <span class="ico" data-icon="check-circle"></span> 올바른: 모든 도면에서 "처리부(110)"으로 통일
- L1 장치명은 발명 명칭에서 유래하거나, 역할이 명확히 구분되는 명칭을 사용하라.
  예: "기업용 인공지능 통합 서버(100)", "사용자 단말(200)", "벤더 서버(300)"

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
  <span class="ico" data-icon="check-circle"></span> 허용: L1 장치 박스만 — 100, 200, 300, 400...
  <span class="ico" data-icon="check-circle"></span> 허용: L1 장치 박스들 간의 연결선만
  ⛔ 금지: L2/L3 하위 구성요소(110, 120, 111...) 표시 금지
  ⛔ 금지: 최외곽 박스 생성 금지 (L1만 있으므로 외곽 불필요)
  ★ 최소 L1 구성요소: 2개 이상 (1개만 있으면 도 1 불필요)

■ 도 2 이후: 세부 블록도 (Detailed Block Diagram)
  ⛔⛔ 핵심: 한 도면에는 반드시 "한 레벨"만 표시 ⛔⛔
  최외곽 박스 = 상위 장치
  내부 박스 = 그 상위 장치의 직계 자식 레벨만
  단, 서브 프레임을 사용한 중첩은 허용:
  <span class="ico" data-icon="check-circle"></span> 허용: 100 프레임 → L2(110 서브프레임[111,112,113 내부] + 120 독립블록)
     → 110이 서브 프레임(점선)으로 그려지고 내부에 L3이 포함된 구조
  ⛔ 금지: 100 프레임 → 110 + 120 + 111 + 112 (서브 프레임 없이 L2·L3 혼합 나열)
  
  ⛔⛔⛔ 내부 구성요소 수량 규칙 (절대 준수) ⛔⛔⛔
  ★★ 최소: 3개 이상 (2개만으로는 도면이 빈약) ★★
  ★★ 최대: 5개 이하 (6개 이상이면 반드시 도면을 분할하라) ★★
  <span class="ico" data-icon="arrow-right"></span> 청구항에 하위 구성요소가 6개 이상이면, 핵심 3~5개만 골라 이 도면에 넣고 나머지는 다음 도면에서 다루라.
  <span class="ico" data-icon="arrow-right"></span> 청구항에 하위 구성요소가 2개뿐이면, 기능적으로 분리하여 3~4개로 확장하라.
  <span class="ico" data-icon="arrow-right"></span> 구성요소를 억지로 세분화하여 수를 늘리지 마라. 청구항에 명시된 핵심 구성만 사용하라.
  ⛔ 절대 금지: 하나의 도면에 6개 이상의 내부 블록을 배치하는 것

  ★★★ 동일 프레임 반복 최소화 규칙 ★★★
  - 동일 참조번호의 프레임이 2개 이상 도면에 반복되는 것은 최소화하라.
  - 하위 구성요소가 5개를 초과하여 분할하는 경우에만 허용한다.
  - 분할 시, 첫 도면에 5개(상한), 다음 도면에 나머지를 넣어라.
    <span class="ico" data-icon="x"></span> 잘못된 분할: 도 2에 4개 + 도 3에 3개 + 도 4에 1개 (3개 도면)
    <span class="ico" data-icon="check-circle"></span> 올바른 분할: 도 2에 5개 + 도 3에 3개 (2개 도면으로 충분)
  - 한 도면에 1~2개만 남으면, 이전 도면에 병합하여 도면 수를 줄여라.
    ⛔ 내부 구성요소 1개인 도면 = 절대 금지 (R12 위반)
  - 도면 수를 줄이는 것이 빈약한 도면을 만드는 것보다 낫다.

  <span class="ico" data-icon="check-circle"></span> 올바른 예 (도 2: ${getDeviceSubject()} 상세):
  최외곽=${getDeviceSubject()}(100), 내부=L2 4개: 통신부(110), 프로세서(120), 메모리(130), 저장부(140)
  → 4개 구성요소가 프레임 안에 2행 배치, 참조번호가 겹치지 않음
  
  ⛔ 잘못된 예 (내부 구성 2개만):
  최외곽=${getDeviceSubject()}(100), 내부=프로세서(110), 메모리(120)
  → 2개만으로 도면이 빈약하고, 참조번호 100과 120이 겹칠 위험
  
  ⛔ 잘못된 예 (내부 구성 7개 — 과잉):
  최외곽=${getDeviceSubject()}(100), 내부=프로세서(110)+메모리(120)+통신부(130)+저장부(140)+제어부(150)+분석부(160)+검증부(170)
  → 7개는 과잉! 연결선 교차, 도면 가독성 저하 → 핵심 4~5개만 선택하고 나머지는 다음 도면에서 다루라
  
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
  <span class="ico" data-icon="arrow-right"></span> 프로세서(120)가 허브 (3개 연결)

★★★ 배치 품질 규칙 (렌더링 겹침 방지) ★★★
  ⛔ 한 행에 3개 초과 금지 → 한 행에는 최대 3개까지 배치
  <span class="ico" data-icon="check-circle"></span> 도 2 이후 내부 블록도: 데이터 흐름 방향에 따라 입력측→처리→출력측 순서로 배치
  <span class="ico" data-icon="check-circle"></span> 흐름 방향이 명확하지 않으면 참조번호 오름차순으로 배치

⛔⛔⛔ 점진적 구체화 원칙 (한 단계씩만 깊어진다 — 절대 규칙) ⛔⛔⛔

  ■ 레벨 정의
    L1 = 100,200,300… (100의 자리, 끝 2자리가 00)
    L2 = 110,120,130… (10의 자리, 끝 1자리가 0)
    L3 = 111,112,121… (1의 자리)
    L4 = 1111,1112…   (4자리)

  ■ 도 1 → L1만 사용 (장치 간 관계)
  ■ 도 2 → 가장 핵심인 L1 장치를 선택 → 그 내부를 L2로만 상세화
    ⛔ 도 2에서 L3(111,112…)를 쓰면 "레벨 건너뛰기" 위반
  ■ 도 3 → 도 2에서 가장 중요한 L2를 선택 → 그 내부를 L3으로만 상세화
    ⛔ 도 3에서 L4(1111,1112…)를 쓰면 위반
  ■ 도 4+ → 다른 L1 장치의 L2 상세화 또는, 도 3에서 남은 L2 상세화

  ■ 위반 패턴 예시
    <span class="ico" data-icon="x"></span> 도 2 내부에 프로세서(120) + 정보수신부(121) + 알림산출부(122)
       → 120은 L2, 121/122는 L3 → 같은 도면에 L2+L3 혼재 → NG
    <span class="ico" data-icon="check-circle"></span> 도 2 내부에 프로세서(120) + 메모리(130) + 통신부(110)
       <span class="ico" data-icon="arrow-right"></span> 모두 L2 → OK
    <span class="ico" data-icon="check-circle"></span> 도 3 최외곽 프로세서(120) 내부에 정보수신부(121) + 알림산출부(122)
       <span class="ico" data-icon="arrow-right"></span> 모두 L3 → OK

  ■ 검증 공식: 한 도면 내부 참조번호의 "레벨"이 모두 동일해야 한다
    level(ref) = ref < 100 ? 'small' : ref%100===0 ? 'L1' : ref%10===0 ? 'L2' : ref<1000 ? 'L3' : 'L4'
    ⛔ 내부 노드 중 level이 2종류 이상이면 레벨 건너뛰기 위반

⛔⛔⛔ 참조번호 고유성 규칙 (절대 위반 금지) ⛔⛔⛔
  - 모든 참조번호는 전체 도면세트 내에서 고유해야 한다. 동일 번호 재사용 불가.
  - "외부", "외부 서버", "외부 장치", "네트워크" 등은 도 2 이후의 내부 블록도에 포함하지 마라.
  - 도 2 이후의 세부 블록도에는 해당 장치의 하위 구성요소(~부)만 배치한다.
  - 외부 연결 대상이 필요하면 도 1에서만 L1 레벨(200, 300)로 표현한다.

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
★★★ 도면을 정확히 ${genCount}개만 설계하라: ${autoNums.map(n=>'도 '+n).join(', ')} ★★★
★★★ 구성요소 명칭과 참조번호는 【장치 청구범위】에서 그대로 가져와 사용하라 ★★★

각 도면의 출력 형식 (모든 도면에 동일 적용):

도 N: [도면 제목]
유형: 블록도 (도 1은 최외곽 박스 없음 / 도 2+는 최외곽 = 직계 부모)
구성요소: [해당 레벨 구성요소 나열 — 청구항에서 추출]
- [구성요소명(참조번호)]
- [구성요소명(참조번호)]
- ...
연결관계: [구성요소 간 데이터 흐름 분석]
공간배치:
  데이터흐름: [입력측 구성요소 → 처리 구성요소 → 출력측 구성요소]
  도 1은 허브중심배치, 도 2+는 흐름방향배치
  행1: [노드들]
  행2: [노드들]

★ 도면 설계 흐름 ★
① 도 ${autoNums[0]||1}: 전체 시스템 구성도 — L1 장치(X00)만 표시, 최외곽 박스 없음
${genCount>=2?`② 도 ${autoNums[1]||2}: ${getDeviceSubject()}(100) 상세 블록도 — 최외곽=${getDeviceSubject()}(100), 내부=청구항의 L2 구성요소(XY0)`:''}
${genCount>=3?`③ 도 ${autoNums[2]||3}: 핵심 L2 구성요소의 상세 블록도 — 최외곽=해당 L2, 내부=청구항의 L3 구성요소(XYZ)`:''}
${genCount>=4?`④ 도 ${autoNums[3]||4}: 추가 상세화 대상의 블록도 (다른 L2 상세 또는 L3 상세)`:''}
${genCount>=5?autoNums.slice(4).map((n,i)=>`⑤ 도 ${n}: 추가 상세화 블록도`).join('\n'):''}

★★★ 공간배치 규칙 ★★★
1. "허브" = 가장 많은 연결을 가진 노드 (반드시 1개 지정)
2. "행N" = 위에서 아래로 배치할 행 (같은 행에 2~3개까지 가능)
3. 허브는 연결 대상들 사이 행에 위치해야 함
4. 같은 행의 노드들은 서로 직접 연결이 없어야 함 (있으면 다른 행으로)
5. 연결된 노드는 인접 행에 배치 (2행 이상 떨어지지 않게)

★★★ 참조번호 순서 규칙 (도면 설계 + 상세설명 연계) ★★★
- 구성요소 나열 시 참조번호 오름차순으로 정렬하라: 110→120→130→140
- 도면 내 행 배치도 가능한 한 번호 순서를 존중하라 (작은 번호가 위쪽/왼쪽)
- 이 순서는 상세설명(Step 8)에서 "도 N을 참조하면" 설명 순서의 기준이 된다

[파트2: 도면의 간단한 설명]
★★★ 생성한 도면(${autoNums.map(n=>'도 '+n).join(', ')})과 사용자 도면 모두에 대해 빠짐없이 간단한 설명을 작성하라 ★★★
---BRIEF_DESCRIPTIONS---
${requiredFigures.map(rf=>`도 ${rf.num}은 ${rf.description}을 나타내는 도면이다.`).join('\n')}
(각 도면에 대해 "도 N은 [대상]의 [내용]을 나타내는 블록도이다." 형식으로 작성)

⛔⛔⛔ 최종 점검 ⛔⛔⛔
- 도면 수가 정확히 ${genCount}개인가? (${autoNums.map(n=>'도 '+n).join(', ')})
- 모든 구성요소 명칭과 참조번호가 【장치 청구범위】와 일치하는가?
- 도 1은 L1(X00) 장치만 포함하는가?
- 도 2+의 내부 구성요소는 청구항에 있는 것만 사용했는가?
- ★★ 도 2+의 내부 구성요소가 5개를 초과하지 않는가? (6개 이상이면 분할!) ★★
- "~모듈" 대신 "~부"를 사용했는가?
- 최외곽 박스가 직계 부모인가? (세대 점프 없는가?)

★★★ "~모듈" 절대 금지 → "~부"로 통일 ★★★
★★★ 도 1은 L1(100,200,300,400) 장치만, 최외곽 박스 없음 ★★★
★★★ 도 2+: 최외곽 = 직계 부모 (세대 점프 금지!) ★★★

${T}\n[장치 청구범위] ${outputs.step_06||''}\n[발명 요약] ${inv.slice(0,1500)}`;}

    case 'step_08':{
      const deviceFigCount=parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const dlCfg={
        compact:{charPerFig:'약 1,000자',total:'약 3,000~4,000자',extra:'핵심 구성요소 중심으로 간결하게 기술하라. 변형 실시예는 1개만.'},
        standard:{charPerFig:'약 1,500자',total:'약 5,000~7,000자',extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 설명하라. 주요 구성요소에 변형 실시예 포함.'},
        detailed:{charPerFig:'약 2,000자 이상',total:'8,000~10,000자',extra:'각 도면마다 구성요소의 기능, 동작 원리, 데이터 흐름, 상호 연동 관계를 상세히 설명하라. 변형 실시예를 통해 다양한 구현 방식을 기술하라. 절대 축약하지 마라.'},
        custom:{charPerFig:'약 '+customDetailChars+'자',total:null,extra:'각 구성요소의 기능, 동작 원리, 데이터 흐름을 설명하라. 변형 실시예를 포함하라.'}
      }[detailLevel];
      
      // v10.3: 실제 도면 설계 텍스트에서 도면 번호 목록 추출
      const designText=outputs.step_07||'';
      const actualFigNums=_extractFigureNumbersFromDesign(designText);
      // 사용자 도면 + 예시도 번호도 포함
      const _conceptFigNums=getAutoFigNums('step_07c');   // ★ 이미 생성된(svgContent) 예시도 compact 번호배열(길이=생성수)
      const _genConceptFigNums=_conceptFigNums;            // ★ C: full 인덱스 필터(버그) 제거 — getAutoFigNums 가 이미 생성분만 산출
      const allFigNumsRaw=[...new Set([...actualFigNums,...requiredFigures.map(f=>f.num),..._genConceptFigNums])].sort((a,b)=>a-b);
      // ★ v10.5 fix: 실제 도면 데이터가 있으면 그대로 사용 (UI 값 변경으로 인한 도면 누락/초과 방지) ★
      // step_07 미생성 시에만 computeFigNums 폴백 사용
      const expectedTotalFig=deviceFigCount+_genConceptFigNums.length;
      const allFigNums=allFigNumsRaw.length>0?allFigNumsRaw:computeFigNums(Math.max(deviceFigCount-requiredFigures.length,0),0).device.concat(requiredFigures.map(f=>f.num)).sort((a,b)=>a-b).slice(0,expectedTotalFig);
      // v10.5: custom 모드 총 분량을 실제 도면 수 기준으로 산출
      if(!dlCfg.total)dlCfg.total='약 '+(customDetailChars*allFigNums.length)+'자';
      const lastDeviceFig=allFigNums.length>0?Math.max(...allFigNums):1;
      const figListStr=allFigNums.map(n=>'도 '+n).join(', ');
      
      // ★ 도면 설계에서 구성요소 목록 추출 (Step 8에 도면과 동일한 구성요소 사용 강제) ★
      const _designComponents=_extractStructuredComponents(designText);
      const _designCompStr=_designComponents.length>0?
        `\n★★★ 도면 구성요소 목록 (이 명칭과 참조번호만 사용하라) ★★★\n${_designComponents.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`:'';
      
      
      const hasMethodClaims=!!outputs.step_10;
      const _userFigBlock=getUserFiguresPromptBlock();
      return `아래 발명에 대한 【발명을 실시하기 위한 구체적인 내용】의 본문만 작성하라.

⛔ 이것은 "장치" 상세설명이다. 방법(~하는 단계, S100 등)은 포함하지 마라.

규칙:
- 이 항목만 작성. 기술분야, 배경기술, 과제, 효과 등 다른 항목 포함 금지.

★★★ 용어 통일 규칙 (기재불비 방지 — 핵심) ★★★
- 명세서 전체에서 동일 개념을 가리키는 용어는 반드시 하나의 기준 용어로 통일하라.
- 청구항에서 사용한 용어가 기준이다. 상세설명에서 다른 표현으로 바꾸지 마라.
  예: 청구항이 "사용자 단말"이면 본문에서 "단말", "디바이스", "장치"로 바꾸지 말고 "사용자 단말(200)" 유지.
- 유사 개념의 위계를 명확히 정리하라:
  → "~값", "~수준", "~지표", "~계수", "~파라미터"가 서로 다른 것인지, 같은 것의 다른 표현인지 명시하라.
  <span class="ico" data-icon="arrow-right"></span> 상위 개념과 하위 개념이 있으면 "A는 B를 포함하며" 또는 "B는 A의 일 유형으로서" 형태로 관계를 서술하라.
- ⛔ 같은 것을 다른 이름으로 부르는 것을 절대 금지: "음량 조절 값" = "목표 음량 수준" = "최종 음량"처럼 혼용하면 기재불비.

★★★ 파라미터/변수 명세 규칙 (실시 가능성 보강) ★★★
- 핵심 알고리즘에 사용되는 모든 파라미터에 대해 다음을 서술하라:
  (1) 정의: 무엇을 나타내는 값인가
  (2) 값 유형: 스칼라값인지, 벡터인지, 복수 특징값의 조합 결과인지
  (3) 값 범위: 예시적 범위 (예: 0~1 정규화값, 0~100 퍼센트 등)
  (4) 초기값: 시스템 최초 실행 시의 기본값 (예: 초기값 1.0)
  (5) 갱신 방식: 어떤 조건에서 어떻게 갱신되는가
  (6) 제한 조건: 상한/하한, 클램핑, 과도 변화 방지 조건
- 보정/학습 계수(alpha, beta 등)에는 반드시 부호 의미, 값 범위, 과도 누적 방지 조건을 포함하라.
- "기정의된"이라고만 쓰지 말고, 예시적 값 또는 값 범위를 반드시 한 번은 제시하라.

★★★ 서버-단말 인터페이스 규칙 (데이터 흐름 명시) ★★★
- 서버와 단말 간 데이터 교환이 있는 구성에서는, 다음 3단계 흐름을 명시적으로 기술하라:
  (1) 단말 → 서버: 어떤 데이터를 어떤 주기로 전송하는가
  (2) 서버 내부: 수신한 데이터를 어떻게 처리/산출하는가
  (3) 서버 → 단말: 산출 결과를 어떤 형태로 단말에 전달하고, 단말이 어떻게 적용하는가
- 통신 프로토콜, 데이터 포맷, 전송 주기 등을 1회 이상 구체적으로 서술하라.
- ${getDeviceSubject()}(100)를 주어로 사용. \"구성요소(참조번호)\" 형태 — 예: 통신부(110), 프로세서(120).
- 도면별 \"도 N을 참조하면,\" 형태로 시작.
- 특허문체(~한다). 글머리 기호/마크다운 절대 금지.
- 청구항의 모든 구성요소를 빠짐없이 포함하여 설명하라. 절대 생략 금지.
- 등록 앵커 종속항(창의적·구체적 기술수단 포함)의 다단계 처리, 기준값/가중치 동작 원리, 검증/보정 루프를 구체적으로 설명하라.
- 각 핵심 구성요소에 대해 변형 실시예를 포함하라.
- 제한성 표현(만, 반드시, ~에 한하여 등) 사용 금지.

⛔⛔⛔ 도면 범위 제한 (위반 시 전체 무효) ⛔⛔⛔
- 이 발명의 장치 도면: ${figListStr} (총 ${allFigNums.length}개)
- 위 도면만 "도 N을 참조하면," 형태로 설명하라. 위 목록에 없는 도면 번호를 절대 참조하지 마라.
- 도 ${lastDeviceFig+1} 이후의 도면을 참조하거나 "도 ${lastDeviceFig+1}을 참조하면" 등의 표현을 절대 사용하지 마라.
- [장치 도면]에 기재된 구성요소 명칭과 참조번호를 그대로 사용하라. 임의 변경/추가 금지.
${!hasMethodClaims?`- 방법 청구항이 생성되지 않았으므로, 방법 도면(흐름도) 및 방법 설명이 존재하지 않는다.
- 방법 관련 내용(S+숫자, ~하는 단계, 흐름도 참조)을 절대 포함하지 마라.`:''}

★★★ 설명 순서 규칙 ★★★
- 도 1 → 도 2 → 도 3 → ... 순서로 진행하라 (도면 간 순서는 반드시 번호순).
- 각 도면 내에서는 데이터/정보 흐름 순서에 따라 설명하라:
  <span class="ico" data-icon="arrow-right"></span> 입력측 구성요소부터 시작하여 처리→출력 순서로 기술
  <span class="ico" data-icon="arrow-right"></span> 예) 통신부(110)에서 데이터를 수신하면, 프로세서(120)가 분석하고, 저장부(140)에 저장한다
- 흐름 방향이 불분명하면 참조번호 오름차순: 예) 110→120→130→140.
- 같은 L2 구성요소 내의 L3 하위 요소도 흐름순 또는 오름차순: 예) 121→122→123.

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

⛔⛔⛔ 수학식 포함 절대 금지 ⛔⛔⛔
- 【수학식 1】, 【수학식 2】 등 수학식 블록을 절대 포함하지 마라.
- 수식, 수학 공식, 변수 정의 등을 본문에 삽입하지 마라.
- 수학식은 별도 단계(Step 9)에서 선택적으로 삽입되므로, 이 단계에서는 알고리즘의 동작 원리를 자연어로만 설명하라.
- "수학식 N에 따르면", "상기 수식에 의해" 등 수학식을 참조하는 표현도 금지.

★★★ 도면 소개 규칙 (필수) ★★★
- 각 도면을 설명하기 전에, 먼저 해당 도면의 명칭을 한 문장으로 소개한 후, 바로 이어서 "도 N을 참조하면," 으로 시작하여 설명하라.
- 형식 예시:
  도 1은 [발명의 명칭]의 전체 구성을 나타내는 예시적 블록도이다. 도 1을 참조하면, ...
  도 2는 [구성요소]의 내부 구조를 나타내는 예시도이다. 도 2를 참조하면, ...
  도 3은 [구성요소]의 하드웨어 구조를 나타내는 예시도이다. 도 3을 참조하면, ...
- 이 도면 소개문은 이후 【도면의 간단한 설명】에서도 동일하게 사용되므로, 정확하고 일관되게 작성하라.
- "도 N" 뒤의 조사 "은/는"은 한국어 문법에 맞게 선택하라:
  받침 있는 숫자 뒤 → "은" (예: 도 1은, 도 3은, 도 6은, 도 7은, 도 8은, 도 10은)
  받침 없는 숫자 뒤 → "는" (예: 도 2는, 도 4는, 도 5는, 도 9는)

⛔⛔⛔ 분량 규칙 (앵커 뒷받침 우선) ⛔⛔⛔
- 도면 1개당 ${dlCfg.charPerFig}(공백 포함)를 기준으로 한다. 단, 앵커 종속항 뒷받침·정량적 근거 기술을 위해 필요한 경우 이 기준을 적정 범위(약 20~30%) 초과해도 무방하다.
- 총 분량 ${dlCfg.total}(공백 포함)을 기준으로 하되, 앵커 뒷받침을 위해서는 적정 초과를 허용한다. 본문 전후 정형문 글자수 제외.
- ${dlCfg.extra}
- ⛔ 단, 불필요한 반복/나열·동어반복으로 분량을 늘리지 마라. 기준을 넘는 분량은 오직 앵커 종속항 뒷받침·정량적 근거·기술적 효과 설명에만 사용하라(일반 설명은 기준 준수).

${deviceAnchorDep>0?`★★ 앵커 종속항 뒷받침 규칙 (등록 핵심 — 42조 4항) ★★
- 앵커 종속항(청구항 ${deviceAnchorStart}~${deviceAnchorStart+deviceAnchorDep-1})은 진보성 방어의 핵심이다. ★ 심사관이 별도 보정 없이 곧바로 등록을 인정할 수 있는 수준으로, 일반 종속항보다 2배 이상 상세하고 정량적 근거가 명확하게 기술하라.
- 각 앵커 종속항의 기술적 구성에 대해:
  (1) 동작 원리를 단계별(입력→처리→출력)로 설명하라
  (2) "이러한 구성에 의하면, ~한 기술적 효과를 얻을 수 있다" 문장을 반드시 포함하라
  (3) ★ 기준값/임계값/가중치/계수는 구체적 수치 예시 또는 수치 범위와 함께, 그 값을 어떻게 도출·설정하는지의 산출 근거(계산 과정·결정 원리)와 값 조정 시 거동 변화를 정량적으로 설명하라 (예: "일 예로 상기 가중치는 0.7로 설정되며, 이는 ~의 비율로부터 산출된다")
  (4) 다단계 처리가 있으면, 각 단계의 입력·처리·출력과 단계 간 정량적 관계(비율·임계·조건)를 명시하라
  (5) 조건 분기가 있으면, 각 분기의 판단 기준(구체적 조건식·임계값)과 분기 후 처리를 설명하라
  (6) ★ 위 정량적 근거는 발명 내용에 기재된 사실에 부합해야 한다. 명세서에 없는 수치를 임의로 창작하지 마라(신규사항·허위기재 금지). 발명 내용에 수치 근거가 없으면 "일 예로/대략" 등 예시임이 드러나는 표현으로 기술하라.
`:''}★ 변형 실시예 규칙:
- 독립항의 상위 개념 용어마다: "한편, 다른 실시예에서 상기 [용어]는 [구체적 대안]일 수 있다" 형태로 기술
- 앵커 종속항의 핵심 처리에 대해 1개 이상의 대안적 구현을 기술
- 변형 실시예는 독립항의 보호범위를 뒷받침하는 방향이어야 한다

★★★ 장치 도면(${figListStr})에 포함된 구성요소만 설명하라. 도면에 없는 참조번호를 임의로 추가하지 마라. ★★★
★★★ 참조번호 명칭 통일 규칙 (기재불비 방지 — 핵심) ★★★
- 하나의 참조번호에는 반드시 하나의 명칭만 사용하라. 동의어/약칭을 혼용하지 마라.
  <span class="ico" data-icon="arrow-right"></span> 예: "추천부(114)"와 "추천 생성부(114)"를 혼용하면 기재불비. 하나로 통일하라.
  <span class="ico" data-icon="arrow-right"></span> 예: "메모리(120)"와 "데이터베이스(120)"를 혼용하면 기재불비. 다른 구성요소이면 별도 참조번호를 부여하라.
- 도면 설계에서 정의된 명칭을 우선으로 사용하라.
- 청구항에서 사용한 명칭과 상세설명의 명칭이 일치해야 한다.
${_designCompStr}
${_userFigBlock?`\n${_userFigBlock}\n★ 사용자 도면도 "도 N을 참조하면," 형태로 도면 번호 순서에 맞게 설명을 포함하라.\n★ 사용자 도면의 설명은 발명 내용 및 청구범위와 정합되도록, 위 도면 설명을 기초로 기술적 의미를 보완하여 작성하라.`:''}
${conceptDiagramTypes.some(ct=>ct.svgContent)?`\n★★★ 예시도/개념도 (참조번호 31~99) ★★★\n${conceptDiagramTypes.filter(ct=>ct.svgContent).map((ct,fi)=>{const fn=_conceptFigNums[fi]||'?';const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};return `도 ${fn}: ${td.label} (참조번호: ${(ct.refMap||[]).map(r=>r.label?`${r.signNumber}(${r.label})`:`${r.signNumber}(${_conceptRefFallbackName(ct)})`).join(', ')||(ct.refNums||[]).join(', ')||'미정'})`;}).join('\n')}\n- 예시도도 도면 번호 순서에 맞게 "도 N을 참조하면," 형태로 설명하되, ★ 위 "번호(이름)"의 이름을 그대로 사용해 "이름(번호)" 형태로 기재하라(부호의 설명과 일치).\n- 예시도의 참조번호(31~99)는 장치 참조번호(100~999)와 구분된다.\n`:''}

${T}\n[장치 청구범위] ${outputs.step_06||''}\n[장치 도면 설계] ${outputs.step_07||''}${(outputs.step_15&&(outputTimestamps.step_15||0)>(outputTimestamps.step_08||0))?'\\n\\n[특허성 검토 결과 — 아래 지적사항을 상세설명에 반영하여 보완하라]\\n'+outputs.step_15.slice(0,2000):''}${getFullInvention({stripMeta:true,deviceOnly:true})}${styleRef}`;}

    case 'step_09':return buildMathPrompt('5개 내외', stripMathBlocks(getLatestDescription()||outputs.step_08||''), (outputs.step_15&&(outputTimestamps.step_15||0)>(outputTimestamps.step_09||0))?'\\n\\n[특허성 검토 결과 — 수학식으로 보완 가능한 지적사항을 반영하라]\\n'+outputs.step_15.slice(0,1500):'');

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
      const methCount=parseInt(f);
      // v10.0: 사용자 도면 스킵 반영한 방법 도면 번호 계산
      const devAutoCount=Math.max((parseInt(document.getElementById('optDeviceFigures')?.value||4))-requiredFigures.length,0);
      const _mfn=computeFigNums(devAutoCount,methCount,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides());
      const lf=_mfn.lastDeviceFig||getLastFigureNumber(outputs.step_07||'');
      const methAutoNums=_mfn.method;
      const firstMeth=methAutoNums[0]||(lf+1);
      return `【방법 청구범위】에 대한 흐름도를 설계하라.

⛔⛔⛔ 도면 수 규칙 (절대 준수) ⛔⛔⛔
- 생성할 흐름도: 정확히 ${f}개 (${methAutoNums.map(n=>'도 '+n).join(', ')})
- ★★★ 흐름도를 ${f}개보다 많이 생성하지 마라. ${f}개보다 적게 생성하지 마라. ★★★
${requiredFigures.length?`- 사용자 도면(${requiredFigures.map(rf=>'도 '+rf.num).join(', ')})은 이미 사용 중. 건너뛰라.`:''}

★★★ 방법 청구항 정합 규칙 ★★★
- 흐름도의 단계명과 S번호는 반드시 【방법 청구범위】와 일치해야 한다.
- 청구항에 없는 단계를 임의로 추가하지 마라.

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
- 도면 번호 기반: S${firstMeth}01, S${firstMeth}02, S${firstMeth}03...
- 예시 (도 ${firstMeth}): S${firstMeth}01(첫 번째 단계), S${firstMeth}02(두 번째 단계)...

■ 단계명 형식
- 반드시 "~단계" 또는 "~하는 단계"로 끝나야 함
- 예: "데이터 수신 단계(S${firstMeth}01)", "패턴 분석 단계(S${firstMeth}02)"

■ 핵심 규칙
- 각 단계명에 단계번호를 반드시 포함: "사용자 인증 단계(S${firstMeth}01)"
- 장치 도면(Step 7)의 구성요소는 참조하되, 도면에 직접 포함하지 마라
- 방법 청구항의 모든 단계를 빠짐없이 반영

[파트1: 도면 설계]
각 도면별로 아래 형식 출력:
---
도 ${firstMeth}: (방법 이름) 흐름도
유형: 순서도 (최외곽 박스 없음)
단계 목록:
- 시작
- (단계명)(S${firstMeth}01)
- (단계명)(S${firstMeth}02)
- [판단] (조건 질문?)(S${firstMeth}03) → 예: (다음 단계), 아니오: (대안 단계)
- ...
- 종료
흐름: 시작 → S${firstMeth}01 → S${firstMeth}02 → S${firstMeth}03{판단} →(예) S${firstMeth}04, (아니오) S${firstMeth}05 → ... → 종료 (단방향)
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
도 ${firstMeth}은 ${selectedTitle||'본 발명'}의 (방법 이름)을 나타내는 순서도이다.
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

★ 분량 지침: ${methodDetailGuide} 작성하라. (단, 앵커 종속항 뒷받침·정량적 근거 기술을 위해서는 위 분량 기준을 적정 범위 초과해도 무방하다. 초과분은 앵커 뒷받침에만 사용하고, 일반 설명은 기준을 준수하라.)
★ 방법의 수행 주체: "${getDeviceSubject()}"로 일관되게 서술하라.

${methodAnchorDep>0?`★★ 방법 앵커 종속항 뒷받침 규칙 (등록 핵심) ★★
- 방법 앵커 종속항은 등록 핵심이다. ★ 심사관이 별도 보정 없이 곧바로 등록을 인정할 수 있는 수준으로, 일반 종속항보다 2배 이상 상세하고 정량적 근거가 명확하게 기술하라.
- 방법 앵커 종속항의 각 기술적 구성(다단계 처리, 조건 분기, 기준값 등)을:
  (1) 단계별 처리 흐름으로 설명하라
  (2) "이러한 단계에 의하면, ~한 기술적 효과를 얻을 수 있다" 문장을 반드시 포함하라
  (3) 조건 분기의 판단 기준(구체적 조건식·임계값)과 각 분기의 후속 처리를 명시하라
  (4) ★ 기준값/임계값/가중치/계수는 구체적 수치 예시 또는 범위와 그 산출·설정 근거를 정량적으로 설명하라. 단, 발명 내용에 없는 수치를 임의로 창작하지 마라(신규사항 금지) — 근거가 없으면 "일 예로" 등 예시임이 드러나게 기술하라.
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
- ★ 수학식 간 교차참조 정확성: 본문에서 "수학식 N에 의해 산출된 X"라고 기재된 경우, 실제로 수학식 N이 X를 산출하는 수식인지 확인. 번호 오기(誤記)가 있으면 반드시 지적하라.
- ★ 수학식 번호 순서: 상세설명에서 수학식이 처음 등장하는 순서가 【수학식 1】→【수학식 2】→... 순차적인지 확인
- 수학식이 없는 경우 이 항목은 "해당 없음"으로 표기

[4] 반복실시 가능성 (특허법 제42조 제3항 제1호)
- 당업자가 상세설명만으로 발명을 실시할 수 있을 만큼 구체적인지 확인
- 핵심 알고리즘/처리 로직의 단계별 설명이 충분한지 확인
- 입력/출력 데이터의 구조와 형식이 명확한지 확인

[5] 보완/수정 제안
- 위 1~4 및 8~12에서 발견된 문제에 대한 구체적 수정 문장을 제시하라
- 형식: [위치] 현재 문장 → 수정 문장
- ★ 기재 누락(해당 구성요소 설명이 없는 경우)에도 반드시 추가할 문장을 제시하라. "해당 없음"만 쓰고 수정 문장을 생략하지 마라.
  형식: [추가 위치] 기재 누락 → (추가할 문장: 해당 구성요소의 동작 원리, 입출력, 기술적 효과 포함)

[5-A] ★ 용어 통일 검토 (v14 신규) ★
- 명세서 전체에서 동일 개념에 다른 용어를 사용한 곳을 모두 찾아 지적하라
- 예: "단말"/"사용자 단말" 혼용, "음량 조절 값"/"목표 음량"/"최종 음량" 혼용
- 각 발견에 대해: [혼용 용어들] → [채택 기준 용어] / [통일 사유] 형식으로 제시

[5-B] ★ 수학식-변수 정합성 심화 검토 (v14 신규) ★
- 동일 목적의 수학식이 복수 존재하면, 변수 대응관계와 부호 방향이 일치하는지 확인
- 보정/학습 계수(alpha 등)의 값 범위, 초기값, 과도 누적 방지 조건이 명시되어 있는지 확인
- 핵심 파라미터에 대해 정의/값범위/초기값/갱신방식/제한조건이 모두 기술되어 있는지 확인
- "기정의된"만 쓰고 구체적 값이나 범위를 전혀 제시하지 않은 곳을 지적
- 수치 예시 계산 결과가 본문 서술 방향(증가/감소)과 모순되지 않는지 검산

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

[8] 청구항 명확성 검토 (특허법 제42조 제4항 제2호)
- 각 청구항이 발명의 구성을 명확하게 기재하고 있는지 확인
- 불명확한 표현 검출: "적절한", "필요에 따라", "바람직하게는", "소정의", "대략" 등 불확정 용어
- 청구항의 기술적 범위가 모호하거나 과도하게 광범위하지 않은지 확인
- 독립항에 불필요한 방법적 표현(장치 청구항에 "~하는 단계")이 혼입되지 않았는지 확인
- 미흡한 경우: 해당 청구항 번호와 불명확 표현을 지적하고 수정안을 제시하라

[9] 용어 일관성 검토
- 청구항에 사용된 구성요소 명칭과 상세설명의 구성요소 명칭이 동일한지 확인
- 예: 청구항에서 "분석부"라고 기재했으나 상세설명에서 "분석 모듈"로 기재된 경우 불일치
- 참조번호 대응 확인: 동일 구성요소에 서로 다른 참조번호가 부여되지 않았는지 확인
- 약어·전문용어가 상세설명에서 정의 없이 사용되지 않았는지 확인
- 불일치가 있으면 구체적으로 지적하라 (청구항 표현 vs 상세설명 표현)

[10] 도면 부호 정합성 검토
- 상세설명에 언급된 참조번호(예: 100, 110, 120)가 도면 설계에 실제로 존재하는지 확인
- 도면에 존재하는 구성요소가 상세설명에서 설명 없이 누락되지 않았는지 확인
- 참조번호 계층 일관성: L1(X00) → L2(XY0) → L3(XYZ) 체계가 혼란 없이 사용되는지 확인
- 불일치가 있으면 "상세설명의 참조번호 OOO(OOO)은 도면에 존재하지 않음" 형식으로 지적하라
- ★ 참조번호 명칭 혼용 검토: 하나의 참조번호에 2개 이상의 명칭이 사용되고 있으면 반드시 지적하라
  <span class="ico" data-icon="arrow-right"></span> 예: "추천부(114)" vs "추천 생성부(114)" 혼용, "메모리(120)" vs "데이터베이스(120)" 혼용
  <span class="ico" data-icon="arrow-right"></span> 가장 빈도 높은 명칭으로 통일할 것을 제안하라
- ★ 도면 미정의 참조번호 사용 검토: 도면에 정의되지 않은(존재하지 않는) 참조번호가 상세설명에서 사용되면 지적하라
- ★ 예시도 부호 구분: 참조번호 31~99는 [예시도/개념도 설계]에 정의된 별개 부호다. 장치 도면(100~)에 없다고 "도면 미정의"로 오인하지 마라. 31~99의 정합은 [예시도/개념도 설계]를 기준으로 판단하라.

[11] 청구항 형식 검토
- 독립항이 젭슨(Jepson) 형식("~에 있어서," 전환부 + "~을 특징으로 하는" 종결부)을 올바르게 따르는지 확인
- 종속항의 인용관계가 올바른지 확인: 인용된 청구항 번호가 실제로 존재하는지, 순환 인용이 없는지
- 다중종속항이 다른 다중종속항을 인용하지 않는지 확인 (특허법 시행령 제5조 제6항)
- 종속항이 독립항의 구성요소를 실질적으로 한정·추가하고 있는지 확인 (형식적 종속항 검출)
- 형식 오류가 있으면 해당 청구항 번호와 구체적 문제점을 지적하라

[12] ★ 예시도/개념도 정합 검토 (v15 — 예시도 lifecycle)
- [예시도/개념도 설계]가 제공된 경우에만 검토하라(없으면 "해당 없음"으로 표기).
- 각 예시도(도 N, 참조번호 31~99)가 상세설명에 "도 N을 참조하면, …" 형태로 기술되어 있는지 확인하라. 기재 누락 시 지적하고, 추가할 문장(도 N 소개 + 예시도 부호 설명)을 제시하라.
- 예시도 참조번호(31~99)가 부호의 설명에 "명칭 : 번호"로 빠짐없이 기재되어 있는지 확인하라. 누락 시 지적하라.
- 예시도 부호의 명칭이 상세설명·부호의 설명에서 동일하게 일관되는지 확인하라(혼용 지적).

═══ 출력 형식 ═══
각 항목별로:
✅ 적합 또는 ⚠️ 보완 필요
- (구체적 지적사항 및 수정 제안)

마지막에 전체 요약 (보완 우선순위 포함)

${T}\n[청구범위] ${outputs.step_06||''}\n${outputs.step_10||''}\n[상세설명] ${(getLatestDescription()||'').slice(0,6000)}${getLatestMethodDescription()?'\n[방법 상세설명] '+getLatestMethodDescription().slice(0,3000):''}\n[도면 설계] ${(outputs.step_07||'').slice(0,2000)}${outputs.step_07c?'\n[예시도/개념도 설계 — 참조번호 31~99, 장치(100~)와 별개] '+outputs.step_07c.slice(0,1500):''}\n[원본 발명 내용] ${inv.slice(0,3000)}`;}

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
    case 'step_16':{
      const hasTask=!!outputs.step_05;
      return `발명의 효과를 작성하라. "본 발명에 따르면,"으로 시작. 각 효과를 문단 단위로 기술하되, 총 3~5개 효과 항목을 서술하라.

${hasTask?`★ 과제-효과 1:1 대응 원칙 ★
아래 [과제]에서 제기한 각 문제에 대해 1:1로 대응하는 효과를 기술하라.
과제에서 "A가 문제"라고 했으면, 효과에서는 "A를 해결하여 B 이점이 있다"로 대응.`:`★ 청구항 기반 효과 도출 원칙 ★
아래 [독립항]의 핵심 구성요소가 해결하는 기술적 과제를 파악하고, 각 구성요소가 제공하는 기술적 효과를 3~5개 기술하라.
각 효과는 "본 발명에 따르면," 또는 "또한, 본 발명에 따르면,"으로 시작하라.`}

마지막: "본 발명의 효과는 이상에서 언급한 효과로 제한되지 않으며, 언급되지 않은 또 다른 효과들은 아래의 기재로부터 당업자에게 명확하게 이해될 수 있을 것이다."
${T}
${hasTask?`[과제] ${outputs.step_05}`:''}
[독립항] ${(outputs.step_06||'').match(/【청구항 1】[\s\S]*?(?=【청구항 2】|$)/)?.[0]||''}
[상세설명] ${(getLatestDescription()||'').slice(0,2000)}${styleRef}`;
    }
    case 'step_17':return `아래 [장치]/[방법] 청구항을 요약하여 【과제의 해결 수단】 항목의 본문을 작성하라. 각 독립항 카테고리별로 요약한다.
⛔ "과제의 해결 수단"이라는 제목/머리말을 출력하지 마라. 본문 문장만 출력하라.

★ 용어 규칙: 청구항에서 사용한 구성요소 명칭, 참조번호, 기술 용어를 그대로 사용하라. 동의어로 바꾸지 마라.
형식:
"본 발명의 일 실시예에 따른 ${getDeviceSubject()}는, ..." (장치 독립항 요약)
${includeMethodClaims?'"본 발명의 일 실시예에 따른 방법은, ..." (방법 독립항 요약)':''}
${outputs.step_20?'"본 발명의 일 실시예에 따른 컴퓨터 판독 가능 기록매체는, ..." (기록매체 독립항 요약)\n"본 발명의 일 실시예에 따른 컴퓨터 프로그램은, ..." (프로그램 독립항 요약)':''}
마지막: "본 발명의 기타 구체적인 사항들은 상세한 설명 및 도면들에 포함되어 있다."
\n${T}\n[장치] ${outputs.step_06||''}\n[방법] ${outputs.step_10||'(없음)'}${outputs.step_20?'\n[기록매체/프로그램] '+outputs.step_20:''}${styleRef}`;
    case 'step_18':{
      const hasMethod=includeMethodClaims&&outputs.step_11;
      // 본문·청구항·도면에서 참조번호(명칭) 전수 수집
      const _refSources=[outputs.step_06,outputs.step_08,outputs.step_09,outputs.step_10,outputs.step_12,outputs.step_07,outputs.step_11,outputs.step_07c].filter(Boolean).join('\n');
      const _refMap=new Map();
      // "명칭(참조번호)" 또는 "명칭 (참조번호)" 패턴 수집
      const _refRe=/([가-힣a-zA-Z][가-힣a-zA-Z\s]{0,15}?)\s*\((\d{2,4}|S\d{2,4})\)/g;
      let _rm;while((_rm=_refRe.exec(_refSources))!==null){
        const name=_rm[1].replace(/^상기\s*/,'').trim();const num=_rm[2];
        if(name.length>=2&&!_refMap.has(num))_refMap.set(num,name);
      }
      const _collectedRefs=[..._refMap.entries()].sort((a,b)=>{
        const na=a[0].startsWith('S')?parseInt(a[0].slice(1))+10000:parseInt(a[0]);
        const nb=b[0].startsWith('S')?parseInt(b[0].slice(1))+10000:parseInt(b[0]);
        return na-nb;
      }).map(([num,name])=>`${name} : ${num}`).join('\n');
      return `【부호의 설명】을 작성하라.

형식: "구성요소 : 참조번호" (콜론 사용)
정렬: 참조번호 오름차순

★★★ 핵심 규칙: 본문에서 사용된 모든 참조번호를 빠짐없이 포함하라 ★★★
- 본문(상세설명, 청구항, 도면설명)에서 "구성요소(XXX)" 형태로 사용된 모든 참조번호를 누락 없이 기재하라.
- 하나의 참조번호에는 반드시 하나의 명칭만 사용하라 (동의어/약칭 혼용 금지).
- 본문에서 가장 많이 사용된 명칭을 채택하라.

[장치 구성요소 — 숫자만 사용]
- 형식: 100, 110, 111, 200, 210...
- 계층적 체계: L1(X00) → L2(XY0) → L3(XYZ)

${hasMethod?`[방법 단계 — S+숫자 사용]
- 형식: S401, S402, S403...

⚠️ 장치 구성요소(숫자)와 방법 단계(S숫자)를 반드시 구분하여 별도 섹션으로 작성하라.`:`⚠️ 장치 구성요소만 작성하라. 방법 단계(S100 등)는 포함하지 마라.`}

[본문에서 수집된 참조번호 목록 — 아래 목록의 모든 항목을 반드시 포함하라]
${_collectedRefs||'(수집된 참조번호 없음 — 도면 및 청구항에서 직접 추출하라)'}

${T}\n[장치 도면] ${outputs.step_07||''}${hasMethod?`\n[방법 도면] ${outputs.step_11||''}`:''}\n[장치 상세설명 발췌] ${(getLatestDescription()||'').slice(0,3000)}\n[장치 청구항] ${(outputs.step_06||'').slice(0,2000)}`}
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
function checkDependency(s){
  const inv=document.getElementById('projectInput').value.trim();
  // v5.6: 방법 청구항 비활성 시 관련 스텝 차단
  const methodSteps=['step_10','step_11','step_12','step_20'];
  if(!includeMethodClaims&&methodSteps.includes(s)){return '방법 청구항이 비활성화되어 있습니다';}
  const d={step_01:()=>inv?null:'발명 내용을 먼저 입력',step_06:()=>selectedTitle?null:'명칭을 먼저 확정',step_07:()=>outputs.step_06?null:'장치 청구항 먼저',step_08:()=>(outputs.step_06&&outputs.step_07)?null:'도면 설계 먼저',step_09:()=>outputs.step_08?null:'상세설명 먼저',step_10:()=>outputs.step_06?null:'장치 청구항 먼저',step_11:()=>outputs.step_10?null:'방법 청구항 먼저',step_12:()=>(outputs.step_10&&outputs.step_11)?null:'방법 도면 먼저',step_13:()=>(outputs.step_06&&outputs.step_08)?null:'청구항+상세설명 먼저',step_14:()=>outputs.step_06?null:'장치 청구항 먼저',step_15:()=>outputs.step_06?null:'장치 청구항 먼저',step_20:()=>outputs.step_10?null:'방법 청구항 먼저'};return d[s]?d[s]():null;
}
async function runStep(sid){if(globalProcessing)return;const dep=checkDependency(sid);if(dep){App.showToast(dep,'error');return;}const bm={step_01:'btnStep01',step_06:'btnStep06',step_10:'btnStep10',step_13:'btnStep13',step_14:'btnStep14',step_15:'btnStep15',step_20:'btnStep20'},bid=bm[sid];setGlobalProcessing(true);loadingState[sid]=true;if(bid)App.setButtonLoading(bid,true);
  try{
    // v6.0: 부분 수정 모드 표시
    const _hasCmd=!!getStepUserCommand(sid);
    const _hasOut=!!outputs[sid];
    if(_hasCmd&&_hasOut)App.showToast('<span class="ico" data-icon="edit"></span> 기존 내용 부분 수정 모드','info');
    
    // Step 04: KIPRIS API 실시간 검색
    if(sid==='step_04'){
      const sr=await searchPriorArt(selectedTitle);
      pushOutputHistory('step_04','llm','runStep');
      if(sr){outputs.step_04=sr.formatted;renderOutput('step_04',sr.formatted);}
      else{outputs.step_04='【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';renderOutput('step_04',outputs.step_04);}
      markOutputTimestamp('step_04');
      onStepCompleted('step_04');saveProject(true);App.showToast('선행기술문헌 검색 완료');
      return;
    }
    // Step 13: use continuation for long review
    let r;
    pushOutputHistory(sid,'llm','runStep');
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
      pushOutputHistory(sid,'llm','runStep.step_06_correction');
      outputs[sid]=corrected;markOutputTimestamp(sid);invalidateDownstream(sid);renderOutput(sid,corrected);
      const finalIssues=validateClaims(corrected);
      App.showProgress('progressStep06',`완료 (수정 ${correctionRound}회)`,maxRounds*2+1,maxRounds*2+1);
      setTimeout(()=>App.clearProgress('progressStep06'),2000);
      if(finalIssues.length===0)App.showToast(`장치 청구항 완료 (기재불비 없음, ${correctionRound}회 수정)`);
      else App.showToast(`장치 청구항 완료 (${correctionRound}회 수정, ${finalIssues.length}건 잔여 — 경미한 사항)`, 'info');
      // v11.0: 예시도 자동 감지
      if(!conceptDiagramTypes.length)autoDetectConceptDiagrams();
    }
    // Step 10: auto-validation + multi-round correction (v5.2)
    else if(sid==='step_10'){
      let corrected=outputs[sid];
      let correctionRound=0;const maxRounds=3;
      // ★ 방법 청구항 검증 시 장치 청구항도 참조 컨텍스트로 제공 ★
      const deviceClaimsCtx=outputs.step_06||'';
      for(correctionRound=0;correctionRound<maxRounds;correctionRound++){
        App.showProgress('progressStep10',`기재불비 검증 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+1,maxRounds*2+1);
        // 방법 청구항 검증 시 장치 청구항 컨텍스트도 참조
        const issues=validateClaims(deviceClaimsCtx+'\n'+corrected);
        if(issues.length===0)break;
        App.showProgress('progressStep10',`기재불비 수정 중... (${correctionRound+1}/${maxRounds})`,correctionRound*2+2,maxRounds*2+1);
        const issueText=issues.map(i=>i.message).join('\n');
        const firstClaimNum=corrected.match(/【청구항\s*(\d+)】/)?.[1]||'?';
        const fixPrompt=`아래 방법 청구범위에서 기재불비가 발견되었다. 모든 지적사항을 수정하여 완전한 청구범위 전체를 다시 출력하라.\n\n⛔⛔ 절대 금지: 청구항 번호를 변경하지 마라! 방법 독립항은 반드시 【청구항 ${firstClaimNum}】을 유지해야 한다. 절대로 【청구항 1】로 변경 금지! ⛔⛔\n\n수정 규칙:\n- 【청구항 N】형식 유지 — 번호 변경 금지\n- \"상기\" 선행기재 누락: 방법 독립항(청구항 ${firstClaimNum}) 내에 해당 구성요소를 추가하거나, 종속항의 표현을 수정\n- 종속항에서 새로운 용어를 \"상기\"로 참조하려면, 반드시 해당 용어가 상위항에 먼저 기재되어야 한다\n- 제한적 표현: 삭제 또는 비제한적 표현으로 교체\n- 청구항 참조 오류: 올바른 청구항 번호로 수정\n- 종속항 대통령령: ①인용항 번호 기재 ②다중인용시 택일적 기재 ③다중인용의 다중인용 금지 ④번호 역전 금지\n\n[지적사항]\n${issueText}\n\n[원본 청구범위 — 번호 유지!]\n${corrected}`;
        const fixR=await App.callClaude(fixPrompt);corrected=fixR.text;
      }
      pushOutputHistory(sid,'llm','runStep.step_10_correction');
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
    onStepCompleted(sid);saveProject(true);
    // [C1 자동 연쇄] SCOPE_GUARDED 스텝 생성 후 자동 검증
    if(inventionScope?.locked_at&&(SCOPE_GUARDED_TEXT_STEPS.includes(sid)||SCOPE_GUARDED_MERMAID_STEPS.includes(sid))){try{await runScopeCheck(sid);}catch(e2){console.warn('[C1] runScopeCheck 자동 실행 실패:',sid,e2.message);}}
  }catch(e){App.showToast(e.message,'error');}finally{loadingState[sid]=false;if(bid)App.setButtonLoading(bid,false);setGlobalProcessing(false);}}
async function runLongStep(sid){if(globalProcessing)return;const dep=checkDependency(sid);if(dep){App.showToast(dep,'error');return;}const bid=sid==='step_08'?'btnStep08':'btnStep12',pid=sid==='step_08'?'progressStep08':'progressStep12';setGlobalProcessing(true);loadingState[sid]=true;App.setButtonLoading(bid,true);
  // v6.0: 부분 수정 모드 표시
  const _hasCmd=!!getStepUserCommand(sid),_hasOut=!!outputs[sid];
  const _modeLabel=(_hasCmd&&_hasOut)?'부분 수정':'생성';
  App.showProgress(pid,`${STEP_NAMES[sid]} ${_modeLabel} 중...`,0,1);
  try{let t=await App.callClaudeWithContinuation(buildPrompt(sid),pid);
    // v8.1: step_08 도면 범위 초과 자동 교정
    if(sid==='step_08')t=sanitizeDescFigureRefs(t,'device');
    if(sid==='step_12')t=sanitizeDescFigureRefs(t,'method');
    // v5.6: step_08 글자수 초과 검증 — 사용자 설정 대비 실제 분량 경고
    if(sid==='step_08'){
      const _bodyText=t.replace(/^[\s\S]*?(?=도 1)/,'').replace(/\n{2,}/g,'\n');
      const _charCount=_bodyText.length;
      // v10.5: 실제 도면 수 기준 (UI 값 변경 시에도 정확한 경고)
      const _actualFigCount=_extractFigureNumbersFromDesign(outputs.step_07||'').length||parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const _dlCfg={compact:1000,standard:1500,detailed:2000,custom:customDetailChars||2000}[detailLevel]||1500;
      const _targetTotal=_dlCfg*_actualFigCount;
      const _ratio=_charCount/_targetTotal;
      if(_ratio>1.5){
        App.showToast(`⚠️ 상세설명 ${_charCount.toLocaleString()}자 (목표 ${_targetTotal.toLocaleString()}자의 ${Math.round(_ratio*100)}%) — 과다 생성됨`,'warning');
        console.warn(`[step_08] 글자수 초과: ${_charCount}자 / 목표 ${_targetTotal}자 (${Math.round(_ratio*100)}%)`);
      }else if(_ratio<0.5){
        App.showToast(`⚠️ 상세설명 ${_charCount.toLocaleString()}자 (목표 ${_targetTotal.toLocaleString()}자의 ${Math.round(_ratio*100)}%) — 과소 생성됨`,'warning');
      }
    }
    pushOutputHistory(sid,'llm','runLongStep');
    outputs[sid]=t;markOutputTimestamp(sid);invalidateDownstream(sid);onStepCompleted(sid);renderOutput(sid,t);saveProject(true);App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);
    // [C1 자동 연쇄] SCOPE_GUARDED 스텝 생성 후 자동 검증
    if(inventionScope?.locked_at&&(SCOPE_GUARDED_TEXT_STEPS.includes(sid)||SCOPE_GUARDED_MERMAID_STEPS.includes(sid))){try{await runScopeCheck(sid);}catch(e2){console.warn('[C1] runScopeCheck 자동 실행 실패:',sid,e2.message);}}
  }catch(e){App.showToast(e.message,'error');}finally{loadingState[sid]=false;App.setButtonLoading(bid,false);App.clearProgress(pid);setGlobalProcessing(false);}}
async function runMathInsertion(){if(globalProcessing)return;const dep=checkDependency('step_09');if(dep){App.showToast(dep,'error');return;}setGlobalProcessing(true);loadingState.step_09=true;App.setButtonLoading('btnStep09',true);try{
  const TARGET_MATH_COUNT=5;
  let r=await App.callClaude(buildPrompt('step_09'));
  // 수학식 블록 개수 검증
  const mathBlocks=parseMathBlocks(r.text);
  if(mathBlocks.length<TARGET_MATH_COUNT){
    // 부족하면 추가 생성 요청
    const missing=TARGET_MATH_COUNT-mathBlocks.length;
    console.warn(`[step_09] 수학식 ${mathBlocks.length}개 생성됨 (목표 ${TARGET_MATH_COUNT}개) → ${missing}개 추가 생성`);
    const addPrompt=`상세설명에 수학식 ${missing}개를 추가로 생성하라. 기존 수학식 번호(1~${mathBlocks.length})와 겹치지 않게 수학식 ${mathBlocks.length+1}번부터 시작하라.\n기존에 삽입된 수학식의 ANCHOR는 사용하지 마라.\n동일한 규칙을 따르되, 기존 수학식과 다른 알고리즘/계산 로직에 대해 작성하라.\n\n${buildPrompt('step_09')}`;
    const r2=await App.callClaude(addPrompt);
    r={text:r.text+'\n'+r2.text};
    App.showToast(`수학식 ${mathBlocks.length}개→추가 생성 시도`,'info');
  }
  const baseDesc=getLatestDescription()||'';
  pushOutputHistory('step_09','llm','runMathInsertion');
  outputs.step_09=insertMathBlocks(baseDesc,r.text);
  // 삽입 후 실제 수학식 개수 검증
  const insertedCount=(outputs.step_09.match(/【수학식\s*\d+】/g)||[]).length;
  markOutputTimestamp('step_09');invalidateDownstream('step_09');renderOutput('step_09',outputs.step_09);onStepCompleted('step_09');saveProject(true);
  if(insertedCount<TARGET_MATH_COUNT){
    App.showToast(`⚠️ 수학식 ${insertedCount}/${TARGET_MATH_COUNT}개 삽입됨 (${TARGET_MATH_COUNT-insertedCount}개 ANCHOR 매칭 실패)`,'warning');
  }else{
    App.showToast(`수학식 ${insertedCount}개 삽입 완료`);
  }
}catch(e){App.showToast(e.message,'error');}finally{loadingState.step_09=false;App.setButtonLoading('btnStep09',false);setGlobalProcessing(false);}}

// v10.2: 검토 결과를 장치/방법 범위로 필터링
function filterReviewForScope(reviewText,scope){
  if(!reviewText)return '';
  if(scope==='all')return reviewText;
  
  const lines=reviewText.split('\n');
  const filtered=[];
  
  // 방법 관련 키워드 (장치 범위에서 제외할 대상)
  const methodKeywords=/방법\s*청구항|방법\s*상세설명|방법\s*도면|방법\s*앵커|순서도|흐름도|~하는\s*단계|S\d{3}|단계\s*[:(]S|방법\s*독립항|방법\s*종속항/;
  // 장치 관련 키워드 (방법 범위에서 제외할 대상)
  const deviceKeywords=/장치\s*청구항|장치\s*상세설명|장치\s*도면|장치\s*앵커|블록도|구성도|장치\s*독립항|장치\s*종속항/;
  
  const excludeRe=scope==='device'?methodKeywords:deviceKeywords;
  
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    
    // 검토 항목 헤더 ([1]~[11]) → 항상 포함
    if(/^\[(\d{1,2})\]\s/.test(line)){filtered.push(line);continue;}
    
    // ✅/⚠️ 판정 라인 → 항상 포함
    if(/^[✅⚠️]/.test(line.trim())){filtered.push(line);continue;}
    
    // 전체 요약/우선순위 → 항상 포함
    if(/전체\s*요약|보완\s*우선순위/.test(line)){filtered.push(line);continue;}
    
    // 빈 줄 → 항상 포함
    if(line.trim()===''){filtered.push(line);continue;}
    
    // 해당 scope와 반대되는 키워드가 포함된 라인 검사
    if(excludeRe.test(line)){
      // "장치 및 방법" 같이 양쪽 다 언급하면 포함
      const bothScopes=/장치\s*및\s*방법|장치와\s*방법|장치,\s*방법/.test(line);
      if(!bothScopes)continue;  // 이 라인만 skip (다음 라인은 독립 판단)
    }
    
    filtered.push(line);
  }
  
  // 연속 빈줄 정리
  return filtered.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

// v10.2: 장치 도면 목록 요약 (LLM에 명시적으로 어떤 도면만 존재하는지 전달)
function extractDeviceFigSummary(){
  const design=outputs.step_07||'';
  if(!design)return '';
  const figs=[...design.matchAll(/도\s+(\d+)[은는]\s*([^\n]+)/g)].map(m=>`도 ${m[1]}: ${m[2].replace(/이다\.\s*$/,'').trim()}`);
  if(!figs.length)return '';
  const deviceMax=getLastFigureNumber(design)||parseInt(document.getElementById('optDeviceFigures')?.value||4);
  return `\n\n★★★ 현재 존재하는 장치 도면 (이 도면만 참조 가능) ★★★\n${figs.join('\n')}\n총 ${figs.length}개 도면 (도 1 ~ 도 ${deviceMax})\n⛔ 위 목록에 없는 도면은 존재하지 않는다. 순서도, 흐름도, 방법도면은 장치 도면에 포함되지 않는다.\n⛔ 새로운 도면(도 ${deviceMax+1} 이상)을 추가하거나 참조하지 마라.`;
}

// v10.2: 장치 상세설명에서 방법/순서도/흐름도 관련 내용 제거 (후처리 안전망)
function sanitizeMethodFromDevice(text){
  if(!text)return text;
  
  // 1단계: 장치 도면 최대 번호 확인
  const deviceMax=getLastFigureNumber(outputs.step_07||'')||parseInt(document.getElementById('optDeviceFigures')?.value||4);
  
  // 2단계: 순서도/흐름도 도면 번호 수집 (소개문에서 추출)
  const methodFigNums=new Set();
  const introRe=/도\s+(\d+)[은는]\s*[^\n]*(?:순서도|흐름도|방법|절차)[^\n]*(?:이다|나타낸다|도시한다)/g;
  let m;
  while((m=introRe.exec(text))!==null)methodFigNums.add(parseInt(m[1]));
  // 장치 도면 범위 밖의 도면도 방법으로 간주
  const allFigRefs=[...text.matchAll(/도\s+(\d+)/g)].map(x=>parseInt(x[1]));
  allFigRefs.forEach(n=>{if(n>deviceMax)methodFigNums.add(n);});
  
  if(!methodFigNums.size){
    // 방법 도면이 없으면 단독 S단계 문장만 제거
    return text.replace(/^[^\n]*S\d{3}[^\n]*$/gm,'').replace(/\n{3,}/g,'\n\n').trim();
  }
  
  console.log(`[sanitizeMethodFromDevice] 방법 도면 번호 감지: 도 ${[...methodFigNums].sort((a,b)=>a-b).join(', ')} (장치 도면: ~도 ${deviceMax})`);
  
  // 3단계: 방법 도면 관련 단락 제거
  const lines=text.split('\n');
  const cleaned=[];
  let skipParagraph=false;
  
  // 방법 도면 번호 패턴 생성
  const methodFigPattern=new RegExp(`도\\s+(${[...methodFigNums].join('|')})[^0-9]`);
  
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const trimmed=line.trim();
    
    // 빈 줄 → 단락 리셋
    if(!trimmed){skipParagraph=false;cleaned.push(line);continue;}
    
    if(skipParagraph)continue;
    
    // 방법 도면 소개문: "도 N은 ~순서도/흐름도이다"
    if(methodFigPattern.test(trimmed)&&/도\s+\d+[은는을를]\s*/.test(trimmed)){
      skipParagraph=true;
      console.warn(`[sanitizeMethodFromDevice] 방법 도면 단락 제거: "${trimmed.slice(0,80)}..."`);
      continue;
    }
    
    // 단독 S단계 문장
    if(/S\d{3}/.test(trimmed)&&/단계|수행|실행/.test(trimmed)){
      console.warn(`[sanitizeMethodFromDevice] S단계 문장 제거: "${trimmed.slice(0,80)}..."`);
      continue;
    }
    
    cleaned.push(line);
  }
  
  return cleaned.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

// v10.3: 편집 지시 파서 — LLM이 출력한 EDIT 블록을 구조화
function parseEditInstructions(text){
  if(!text)return[];
  const edits=[];
  const re=/---EDIT_\d+---\s*\nANCHOR:\s*(.+)\s*\nACTION:\s*(ADD_AFTER|ADD_BEFORE|MODIFY)\s*\nCONTENT:\s*([\s\S]*?)(?:\nREASON:\s*([\s\S]*?))?(?=---EDIT_\d+---|$)/g;
  let m;
  while((m=re.exec(text))!==null){
    const anchor=m[1].trim();
    const action=m[2].trim();
    let content=m[3].trim();
    const reason=(m[4]||'').trim();
    // CONTENT에서 다음 EDIT 또는 끝까지의 불필요한 텍스트 제거
    content=content.replace(/\n---EDIT_\d+---[\s\S]*/,'').trim();
    // v10.4: CONTENT에서 검토 형식 텍스트 제거 (LLM이 검토 메타데이터를 혼입하는 문제 방지)
    content=_sanitizeEditContent(content);
    if(anchor.length>=10&&content.length>=5){
      edits.push({anchor,action,content,reason});
    }
  }
  return edits;
}

// v10.4: CONTENT에서 검토 형식 메타데이터 제거
function _sanitizeEditContent(content){
  if(!content)return content;
  let c=content;
  // 패턴 1: "현재: ... 수정: ..." 형태 → 수정 부분만 추출
  const curModMatch=c.match(/현재\s*:\s*[\s\S]*?수정\s*:\s*["']?([\s\S]+?)["']?\s*$/);
  if(curModMatch){
    c=curModMatch[1].trim();
    console.log(`[_sanitizeEditContent] 현재/수정 형식 감지 → 수정 부분만 추출`);
  }else{
    // 패턴 2: "현재: ..." 단독 (수정 없이 현재 문장만 있는 경우 → 검토 설명이므로 제거)
    if(/^현재\s*:/.test(c)){
      c=c.replace(/^현재\s*:\s*/,'').trim();
      console.log(`[_sanitizeEditContent] "현재:" 접두사 제거`);
    }
    // 패턴 3: "수정: ..." 단독 → 접두사만 제거
    if(/^수정\s*:/.test(c)){
      c=c.replace(/^수정\s*:\s*["']?/,'').replace(/["']\s*$/,'').trim();
      console.log(`[_sanitizeEditContent] "수정:" 접두사 제거`);
    }
  }
  // 패턴 4: "[위치: ...]" 접두사 제거
  c=c.replace(/^\[위치\s*:\s*[^\]]*\]\s*/,'').trim();
  // 패턴 5: "기재 누락 →" 또는 "해당 없음 →" 접두사 제거
  c=c.replace(/^(?:기재\s*누락|해당\s*없음)\s*→?\s*/,'').trim();
  // 패턴 6: 인라인 "현재 문장 → 수정 문장" 형태 (화살표 기준 분리)
  const arrowMatch=c.match(/^(.+?)\s*→\s*(.+)$/s);
  if(arrowMatch){
    const before=arrowMatch[1].trim();
    const after=arrowMatch[2].trim();
    // 화살표 앞이 검토 설명이고 뒤가 실제 특허 문장인 경우
    if(/부재|누락|불일치|미흡|부족|모호/.test(before)&&after.length>before.length*0.5){
      c=after.replace(/^["']|["']$/g,'').trim();
      console.log(`[_sanitizeEditContent] 검토→수정 화살표 형식 감지 → 수정 부분만 추출`);
    }
  }
  // 패턴 7: 감싸는 큰따옴표/작은따옴표 제거 (전체를 감싸는 경우만)
  if((c.startsWith('"')&&c.endsWith('"'))||(c.startsWith("'")&&c.endsWith("'"))){
    c=c.slice(1,-1).trim();
  }
  return c;
}

// v10.3: 편집 지시를 원문에 적용 — 원본 구조 100% 보존
function applyEditInstructions(originalText,edits){
  if(!edits||!edits.length)return originalText;
  let result=originalText;
  let appliedCount=0;
  
  // 역순으로 적용 (뒤→앞) — 인덱스 변위 방지
  // 먼저 각 편집의 위치를 찾아서 정렬
  const located=[];
  for(const edit of edits){
    const idx=fuzzyFindAnchor(result,edit.anchor);
    if(idx>=0){
      located.push({...edit,index:idx});
    }else{
      console.warn(`[applyEditInstructions] 앵커 매칭 실패: "${edit.anchor.slice(0,40)}..." → 건너뜀`);
    }
  }
  
  // 위치 내림차순 정렬 (뒤→앞)
  located.sort((a,b)=>b.index-a.index);
  
  for(const edit of located){
    // v10.3: 앵커 위치에서 정확한 문장 끝 찾기
    const anchorStart=edit.index;
    const sentenceEnd=findSentenceEndAfterAnchor(result,anchorStart,edit.anchor);
    
    // 정확 매칭 시 앵커 텍스트 위치 확인 (MODIFY용)
    const exactIdx=result.indexOf(edit.anchor,Math.max(0,anchorStart-50));
    
    // 청구항 헤더가 CONTENT에 혼입되지 않았는지 확인
    if(/【청구항|청구항\s*\d+|【발명|【기술분야|【배경기술/.test(edit.content)){
      console.warn(`[applyEditInstructions] 청구항/섹션 헤더 감지 → 건너뜀: "${edit.content.slice(0,40)}..."`);
      continue;
    }

    // v10.4: 검토 형식 텍스트가 CONTENT에 잔존하는지 최종 검증
    if(/(?:^|\n)\s*(?:현재\s*:|수정\s*:|→\s*["']|\[위치\s*:)/.test(edit.content)){
      console.warn(`[applyEditInstructions] 검토 형식 잔존 감지 → 재정제: "${edit.content.slice(0,50)}..."`);
      edit.content=_sanitizeEditContent(edit.content);
      if(edit.content.length<5){console.warn(`[applyEditInstructions] 재정제 후 내용 부족 → 건너뜀`);continue;}
    }
    
    // v10.3: 중복 삽입 방지 — 이미 동일 내용이 근처에 있으면 건너뜀
    const nearbyRegion=result.slice(Math.max(0,anchorStart-200),Math.min(result.length,anchorStart+edit.anchor.length+500));
    if(edit.action!=='MODIFY'&&nearbyRegion.includes(edit.content.slice(0,50))){
      console.warn(`[applyEditInstructions] 중복 감지 → 건너뜀: "${edit.content.slice(0,30)}..."`);
      continue;
    }

    switch(edit.action){
      case 'ADD_AFTER':{
        const _afterChar=result[sentenceEnd]||'';
        const _trailSep=/[\s\n]/.test(_afterChar)?'':' ';
        result=result.slice(0,sentenceEnd)+' '+edit.content+_trailSep+result.slice(sentenceEnd);
        appliedCount++;
        console.log(`[applyEditInstructions] ADD_AFTER 적용 (${edit.reason||''}): "${edit.anchor.slice(0,30)}..." 뒤에 ${edit.content.length}자 추가`);
        break;}
      case 'ADD_BEFORE':{
        const _beforeChar=anchorStart>0?result[anchorStart-1]:'';
        const _leadSep=/[\s\n]/.test(_beforeChar)?'':' ';
        result=result.slice(0,anchorStart)+_leadSep+edit.content+' '+result.slice(anchorStart);
        appliedCount++;
        console.log(`[applyEditInstructions] ADD_BEFORE 적용 (${edit.reason||''}): "${edit.anchor.slice(0,30)}..." 앞에 ${edit.content.length}자 추가`);
        break;}
      case 'MODIFY':
        if(exactIdx>=0){
          // v10.5: MODIFY 후 결합 부위 검증 — 마침표/공백 보정
          let _finalContent=edit.content;
          let _afterMod=result.slice(exactIdx+edit.anchor.length);
          // (1) 콘텐츠 끝에 마침표가 없는데 앵커는 마침표로 끝났다면 → 마침표 복원
          if(/[.。]$/.test(edit.anchor.trim())&&!/[.。]$/.test(_finalContent.trim())){
            _finalContent=_finalContent.trimEnd()+'.';
          }
          // (2) 콘텐츠가 마침표로 끝나고, 뒤에도 마침표로 시작하면 → 이중 마침표 방지
          if(/[.。]$/.test(_finalContent.trim())&&/^\s*[.。]/.test(_afterMod)){
            _afterMod=_afterMod.replace(/^\s*[.。]\s*/,' ');
          }
          // (3) 콘텐츠가 마침표로 끝나고 뒤에 한글이 바로 오면 공백 보장
          const _nxt=_afterMod[0]||'';
          if(/[.。]$/.test(_finalContent.trimEnd())&&/[가-힣(]/.test(_nxt)){
            _finalContent=_finalContent.trimEnd()+' ';
            _afterMod=_afterMod.replace(/^\s+/,'');
          }
          // (4) 콘텐츠가 마침표 없이 끝나고 뒤에 한글이 바로 오면 (마침표도 없고 공백도 없음) → 공백 보장
          if(!/[.。\s]$/.test(_finalContent)&&/^[가-힣(]/.test(_afterMod)){
            _finalContent=_finalContent+' ';
          }
          result=result.slice(0,exactIdx)+_finalContent+_afterMod;
          appliedCount++;
          console.log(`[applyEditInstructions] MODIFY 적용 (${edit.reason||''}): "${edit.anchor.slice(0,30)}..." → "${_finalContent.slice(0,30)}..."`);
        }
        break;
    }
  }

  // v10.4: 전체 편집 완료 후 — 마침표 뒤 띄어쓰기 누락 교정
  // "한다.이러한" → "한다. 이러한" (한글.한글 패턴, 소수점 제외)
  result=result.replace(/([가-힣)\]])\.[ \t]*([가-힣(【])/g,(m,p,n)=>{
    return p+'. '+n;
  });

  console.log(`[applyEditInstructions] 총 ${edits.length}개 중 ${appliedCount}개 적용 완료`);
  return result;
}

// v10.3: 청구범위에서 구성요소 목록만 추출 (청구항 전문 대신 핵심 정보만)
function extractClaimComponents(claimText){
  if(!claimText)return '';
  // 구성요소(참조번호) 패턴 추출
  const components=new Set();
  const re=/([가-힣]*(?:부|모듈|유닛|서버|장치|단말|센서|프로세서|메모리|인터페이스|엔진|매니저))\s*\((\d+[a-z]?)\)/g;
  let m;
  while((m=re.exec(claimText))!==null){
    components.add(`${m[1]}(${m[2]})`);
  }
  if(!components.size){
    // 참조번호 없는 경우 구성요소명만 추출
    const nameRe=/([가-힣]{2,}(?:부|모듈|유닛))/g;
    while((m=nameRe.exec(claimText))!==null)components.add(m[1]);
  }
  return components.size?`구성요소 목록: ${[...components].join(', ')}`:'(구성요소 목록 없음)';
}

// ★ 청구항에서 구성요소 계층 구조를 추출하여 도면 설계 프롬프트에 포함할 텍스트 생성 ★
function _buildClaimComponentHierarchy(claimText){
  if(!claimText)return '';
  const comps=_extractStructuredComponents(claimText);
  if(!comps.length)return '';
  
  // 레벨 분류
  const l1=[],l2=[],l3=[],l4=[];
  for(const c of comps){
    const n=c.refNum;
    if(n>=1000)l4.push(c);
    else if(n>=100&&n%100===0)l1.push(c);
    else if(n>=100&&n%10===0)l2.push(c);
    else if(n>=100)l3.push(c);
  }
  
  // 계층 구조 문자열 생성
  let result=`⛔⛔⛔ 청구항 구성요소 목록 (이 명칭과 참조번호를 그대로 사용하라) ⛔⛔⛔\n`;
  
  if(l1.length){
    result+=`■ L1 (최상위 장치, X00): ${l1.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`;
    for(const parent of l1){
      const children=l2.filter(c=>Math.floor(c.refNum/100)*100===parent.refNum);
      if(children.length){
        result+=`  └ ${parent.name}(${parent.refNum}) 하위 L2: ${children.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`;
        for(const child of children){
          const grandchildren=l3.filter(c=>Math.floor(c.refNum/10)*10===child.refNum);
          if(grandchildren.length){
            result+=`    └ ${child.name}(${child.refNum}) 하위 L3: ${grandchildren.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`;
          }
        }
      }
    }
  }
  
  if(l2.length){
    const orphanL2=l2.filter(c=>!l1.some(p=>Math.floor(c.refNum/100)*100===p.refNum));
    if(orphanL2.length)result+=`■ L2 (추가): ${orphanL2.map(c=>c.name+'('+c.refNum+')').join(', ')}\n`;
  }
  
  result+=`\n★ 위 목록의 구성요소 명칭과 참조번호를 반드시 그대로 사용하라. 임의 변경/추가 금지.\n`;
  result+=`★ 도 2 이후의 내부 구성요소는 위 목록에서만 선택하라.\n`;
  return result;
}

async function applyReview(){
  if(globalProcessing)return;if(!outputs.step_13){App.showToast('검토 결과 없음','error');return;}
  const cur=getLatestDescription();if(!cur){App.showToast('상세설명 없음','error');return;}
  const hasMethodDesc=!!(outputs.step_12&&includeMethodClaims);
  const totalSteps=hasMethodDesc?3:2;
  pushOutputHistory('step_08','pre_review','applyReview');
  if(outputs.step_12)pushOutputHistory('step_12','pre_review','applyReview');
  setGlobalProcessing(true);loadingState.applyReview=true;App.setButtonLoading('btnApplyReview',true);
  try{
    // ═══════════════════════════════════════════════════════════════
    // v10.3: 편집 지시 기반 아키텍처 (전문 재작성 → 편집 지시 + 코드 적용)
    // ═══════════════════════════════════════════════════════════════
    // [기존 문제] LLM에게 전문 재작성 요청 → 청구항 구조로 변질
    // [해결] LLM은 "어디에 무엇을 추가/수정할지"만 출력 → 코드가 원문에 적용
    // ═══════════════════════════════════════════════════════════════

    // ═══ [1] 장치 상세설명 — 편집 지시 생성 + 적용 ═══
    App.showProgress('progressApplyReview',`[1/${totalSteps}] 장치 상세설명 편집 지시 생성 중...`,1,totalSteps);
    const baseDesc=stripMathBlocks(cur);
    const editInstructions=await App.callClaude(`아래 [검토 결과]의 지적사항을 반영하기 위한 편집 지시를 생성하라.

★★★ 중요: 상세설명 전체를 다시 작성하지 마라. 편집 지시만 출력하라. ★★★

[편집 지시 형식]
각 편집은 아래 형식으로 출력한다:

---EDIT_1---
ANCHOR: (수정할 위치의 기존 문장을 정확히 복사. 20자 이상)
ACTION: ADD_AFTER 또는 MODIFY 또는 ADD_BEFORE
CONTENT: (추가하거나 수정할 문장. 특허문체(~한다). 구성요소(참조번호) 형태.)
REASON: (어떤 검토 항목의 지적을 반영하는지)

---EDIT_2---
ANCHOR: ...
ACTION: ...
CONTENT: ...
REASON: ...

[ACTION 설명]
- ADD_AFTER: ANCHOR 문장 바로 뒤에 CONTENT를 삽입
- ADD_BEFORE: ANCHOR 문장 바로 앞에 CONTENT를 삽입
- MODIFY: ANCHOR 문장을 CONTENT로 교체 (용어 수정 등)

[규칙]
- ANCHOR는 [현재 상세설명]에 실제로 존재하는 문장을 정확히 복사하라 (부분 문장 가능, 20자 이상).
- CONTENT에는 특허문체로 작성. 구성요소(참조번호) 형태 사용.
- ⛔ 【청구항 N】, 청구항 1 등 청구항 헤더/번호/구조 절대 금지.
- ⛔ 【수학식 N】 블록, 수학식 번호 참조 금지 (수학식은 별도 처리).
- ⛔ "~하는 단계", "S100" 등 방법 표현 금지. 장치 구성요소(~부)의 동작만.
- ⛔ 기존 문장을 삭제하는 편집 금지. 추가(ADD)와 수정(MODIFY)만 가능.
- ⛔⛔⛔ CONTENT에 검토 형식 텍스트를 절대 포함하지 마라:
  "현재:", "수정:", "[위치:", "→", "✅", "⚠️", "기재 누락", "해당 없음" 등 검토 메타데이터 금지.
  CONTENT에는 오직 상세설명에 실제로 삽입/교체될 순수 특허 문장만 작성하라.
  검토의 "수정:" 뒤에 제안된 문장만 참고하여 CONTENT를 작성하되, "수정:" 접두사 자체는 제외하라.
- "뒷받침 부족" → 해당 구성요소 설명 뒤에 동작 원리를 ADD_AFTER
- "앵커 종속항 보완" → 해당 구성요소 뒤에 (1) 동작 상세 (2) 기술적 효과 ADD_AFTER
- "용어 불일치" → 해당 문장을 올바른 용어로 MODIFY
- "기재 누락" → 가장 가까운 관련 문장을 ANCHOR로 사용하고 ADD_AFTER로 새 문장 추가
- 검토에서 지적되지 않은 부분은 편집하지 마라.
- 최대 15개 이내로 핵심 지적만 반영하라.

[발명의 명칭] ${selectedTitle}
[검토 결과] ${filterReviewForScope(outputs.step_13,'device')}
[청구항 구성요소 참조] ${extractClaimComponents(outputs.step_06||'')}
[현재 상세설명]
${baseDesc}${_maybeScopeGuard('step_13_applied','text')}`);

    // 편집 지시 파싱
    const edits=parseEditInstructions(editInstructions.text);
    console.log(`[applyReview] 편집 지시 ${edits.length}개 파싱 완료`);

    // 편집 적용 (원문 기반)
    let finalDesc=applyEditInstructions(baseDesc,edits);
    console.log(`[applyReview] 편집 적용 완료: ${baseDesc.length}자 → ${finalDesc.length}자`);

    // 후처리: 방법 혼입 제거 + 도면 범위 교정
    finalDesc=sanitizeMethodFromDevice(finalDesc);
    finalDesc=sanitizeDescFigureRefs(finalDesc,'device');

    // 분량 감소 경고 (편집 지시 방식에선 거의 발생하지 않음)
    if(finalDesc.length<baseDesc.length*0.95){
      console.warn(`[applyReview] ⚠️ 분량 감소: ${baseDesc.length}자 → ${finalDesc.length}자`);
      App.showToast(`⚠️ 검토 반영 후 분량 감소 감지 — 확인 필요`,'warning');
    }

    // ═══ [2] 수학식 재삽입 ═══
    if(outputs.step_09){
      App.showProgress('progressApplyReview',`[2/${totalSteps}] 수학식 재삽입 중...`,2,totalSteps);
      const existingMath=extractExistingMathBlocks(cur);
      if(existingMath.length>0){
        console.log(`[applyReview] 기존 수학식 ${existingMath.length}개 보존 재삽입`);
        const inserted=new Set();
        let successCount=0;
        for(const x of [...existingMath].reverse()){
          const i=fuzzyFindAnchor(finalDesc,x.anchor);
          if(i>=0&&!inserted.has(x.anchor)){
            inserted.add(x.anchor);
            const ip=findSentenceEndAfterAnchor(finalDesc,i,x.anchor);
            // v10.5: 삽입 지점 검증 — 단어 중간이면 가장 가까운 문장 경계로 보정
            const validIp=_validateInsertionPoint(finalDesc,ip);
            finalDesc=finalDesc.slice(0,validIp)+'\n\n'+x.formula+'\n\n'+finalDesc.slice(validIp);
            successCount++;
          }
        }
        if(successCount<existingMath.length){
          console.log(`[applyReview] 보존 실패 ${existingMath.length-successCount}개 → 새로 생성`);
          const mathR=await App.callClaude(buildMathPrompt(`${existingMath.length-successCount}개`, finalDesc));
          finalDesc=insertMathBlocks(finalDesc,mathR.text);
        }
        finalDesc=_deduplicateSentences(finalDesc); // v10.3: 수학식 재삽입 후 중복 제거
        finalDesc=renumberMathBlocks(finalDesc);
      }else{
        const mathR=await App.callClaude(buildMathPrompt('5개 내외', finalDesc));
        finalDesc=insertMathBlocks(finalDesc,mathR.text);
      }
    }
    // v10.5: 최종 띄어쓰기 보정 — 수학식 재삽입/중복제거 후 "한다.이러한" 패턴 교정
    // 줄바꿈은 보존 (수학식 블록 구조 보호), 같은 줄의 띄어쓰기만 교정
    finalDesc=finalDesc.replace(/([가-힣)\]])\.[ \t]*([가-힣(])/g,(m,p,n)=>{
      return p+'. '+n;
    });
    pushOutputHistory('step_13_applied','llm','applyReview');
    outputs.step_13_applied=finalDesc;
    markOutputTimestamp('step_13_applied');

    // ═══ [3] 방법 상세설명 — 편집 지시 생성 + 적용 ═══
    if(hasMethodDesc){
      App.showProgress('progressApplyReview',`[3/${totalSteps}] 방법 상세설명 편집 지시 생성 중...`,3,totalSteps);
      const baseMethod=getLatestMethodDescription()||'';
      const methodEditInstructions=await App.callClaude(`아래 [검토 결과]의 방법 관련 지적사항을 반영하기 위한 편집 지시를 생성하라.

★★★ 중요: 상세설명 전체를 다시 작성하지 마라. 편집 지시만 출력하라. ★★★

[편집 지시 형식]
---EDIT_1---
ANCHOR: (수정할 위치의 기존 문장 정확히 복사. 20자 이상)
ACTION: ADD_AFTER 또는 MODIFY 또는 ADD_BEFORE
CONTENT: (추가/수정할 문장. 특허문체.)
REASON: (검토 항목)

[규칙]
- ANCHOR는 [현재 방법 상세설명]에 실제 존재하는 문장.
- ⛔ 【청구항 N】, 청구항 번호/구조 절대 금지.
- ⛔⛔⛔ CONTENT에 검토 형식 텍스트 절대 금지: "현재:", "수정:", "[위치:", "→", "✅", "⚠️", "기재 누락" 등.
  CONTENT에는 오직 삽입/교체될 순수 특허 문장만 작성하라.
- 방법 상세설명만 편집. 장치 블록도 내용 금지.
- 수행 주체: "${getDeviceSubject()}". 최대 10개 편집.

[발명의 명칭] ${selectedTitle}
[검토 결과] ${filterReviewForScope(outputs.step_13,'method')}
[현재 방법 상세설명]
${baseMethod}${_maybeScopeGuard('step_13_applied_method','text')}`);

      const methodEdits=parseEditInstructions(methodEditInstructions.text);
      console.log(`[applyReview] 방법 편집 지시 ${methodEdits.length}개 파싱`);
      const improvedMethod=applyEditInstructions(baseMethod,methodEdits);
      pushOutputHistory('step_13_applied_method','llm','applyReview');
      outputs.step_13_applied_method=improvedMethod;
      markOutputTimestamp('step_13_applied_method');
    }

    // ═══ 완료 ═══
    App.showProgress('progressApplyReview',`[${totalSteps}/${totalSteps}] 완료`,totalSteps,totalSteps);
    const resultArea=document.getElementById('reviewApplyResult');
    if(resultArea){resultArea.style.display='block';showReviewDiff('after');}
    setTimeout(()=>App.clearProgress('progressApplyReview'),2000);
    saveProject(true);
    App.showToast(`검토 반영 완료${hasMethodDesc?' (장치+방법)':''} — 최종 명세서에 자동 반영됩니다`);
  }catch(e){App.showToast(e.message,'error');}finally{loadingState.applyReview=false;App.setButtonLoading('btnApplyReview',false);setGlobalProcessing(false);}
}
function showReviewDiff(mode){
  const area=document.getElementById('reviewDiffArea'),bb=document.getElementById('btnDiffBefore'),ba=document.getElementById('btnDiffAfter');if(!area)return;
  const _preReview08=getLastHistoryByOrigin('step_08','pre_review');
  const _preReviewText=_preReview08?_preReview08.value:'(없음)';
  if(mode==='before'){
    const text=_preReviewText;
    area.value=text;
    if(bb)bb.className='btn btn-primary btn-sm';if(ba)ba.className='btn btn-outline btn-sm';
    if(bb)bb.innerHTML=`반영 전 <span class="badge badge-neutral" style="margin-left:4px;font-size:10px">${text.length.toLocaleString()}자</span>`;
    if(ba){
      let afterText=outputs.step_13_applied||'(없음)';
      if(outputs.step_13_applied_method)afterText+='\n\n'+outputs.step_13_applied_method;
      ba.innerHTML=`반영 후 <span class="badge badge-neutral" style="margin-left:4px;font-size:10px">${afterText.length.toLocaleString()}자</span>`;
    }
  }
  else{
    let afterText=outputs.step_13_applied||'(없음)';
    if(outputs.step_13_applied_method){
      afterText+='\n\n═══ [방법 상세설명 검토 반영본] ═══\n\n'+outputs.step_13_applied_method;
    }
    area.value=afterText;
    if(bb)bb.className='btn btn-outline btn-sm';if(ba)ba.className='btn btn-primary btn-sm';
    const beforeText=_preReviewText;
    if(bb)bb.innerHTML=`반영 전 <span class="badge badge-neutral" style="margin-left:4px;font-size:10px">${beforeText.length.toLocaleString()}자</span>`;
    if(ba)ba.innerHTML=`반영 후 <span class="badge badge-neutral" style="margin-left:4px;font-size:10px">${afterText.length.toLocaleString()}자</span>`;
    // v10.2: 분량 변화 안내
    const diff=afterText.length-beforeText.length;
    const diffLabel=diff>=0?`+${diff.toLocaleString()}`:`${diff.toLocaleString()}`;
    const diffColor=diff>=0?'#2e7d32':'#c62828';
    const countEl=document.getElementById('reviewDiffCount');
    if(countEl)countEl.innerHTML=`<span style="color:${diffColor};font-size:12px;font-weight:600">${diffLabel}자 (${diff>=0?'증가':'감소'})</span>`;
    else{
      const newEl=document.createElement('span');newEl.id='reviewDiffCount';
      newEl.innerHTML=`<span style="color:${diffColor};font-size:12px;font-weight:600">${diffLabel}자 (${diff>=0?'증가':'감소'})</span>`;
      ba.parentElement?.appendChild(newEl);
    }
  }
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
    console.log('[runDiagramStep] sid=',sid,'starting...');
    // 1. 도면 설계 생성
    let prompt;
    try{
      prompt=buildPrompt(sid);
      console.log('[runDiagramStep] prompt built OK, length=',prompt.length);
    }catch(promptErr){
      console.error('[runDiagramStep] buildPrompt ERROR:',promptErr);
      App.showToast('프롬프트 생성 오류: '+promptErr.message,'error');
      return;
    }
    let r=await App.callClaude(prompt);
    let designText=r.text;

    // ★ 방어: 빈 응답 감지 ★
    if(!designText||designText.trim().length<50){
      console.error('[runDiagramStep] AI returned empty/short response:',designText);
      App.showToast('도면 설계 생성 실패 — AI 응답이 비었습니다. 다시 시도해 주세요.','error');
      throw new Error('도면 설계 AI 응답 비어있음 ('+(designText?designText.length:0)+'자)');
    }
    
    // 2. 도면 설계 텍스트 사전 검증 (도면 수 + 규칙 검증)
    if(sid==='step_07'){
      const totalFig=parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const _genCount=totalFig-requiredFigures.length;
      const _figNums=computeFigNums(Math.max(_genCount,0),0);
      const _expectedNums=_figNums.device;
      
      const preIssues=validateDiagramDesignText(designText,_genCount,_expectedNums);
      const hasPreErrors=preIssues.some(iss=>iss.severity==='ERROR');
      
      if(hasPreErrors){
        console.log('[runDiagramStep] 도면 설계 규칙 위반 발견:',preIssues.map(i=>i.message).join('; '));
        
        const feedbackPrompt=`이전 도면 설계에 규칙 위반이 있습니다. 아래 오류를 모두 수정하여 다시 생성하세요.

═══ 발견된 오류 ═══
${preIssues.filter(i=>i.severity==='ERROR').map(i=>'⛔ '+i.message).join('\n')}
${preIssues.filter(i=>i.severity==='WARNING').map(i=>'⚠ '+i.message).join('\n')}

═══ 핵심 수정사항 ═══
- 도면을 정확히 ${_genCount}개만 생성하라: ${_expectedNums.map(n=>'도 '+n).join(', ')}
- 구성요소 명칭과 참조번호는 【장치 청구범위】에서 가져와 사용하라
[R3] 도 1: L1 장치만 허용 (100, 200, 300...). L2/L3(110, 111...) 절대 금지!
[R5] 도 2+: 내부가 L2(110,120)면 최외곽=L1(100), 내부가 L3(111,112)면 최외곽=L2(110)

원래 요청: ${buildPrompt(sid).slice(0,1500)}

위 오류를 수정하여 도면 설계를 다시 출력하세요.`;

        r=await App.callClaude(feedbackPrompt);
        designText=r.text;
        App.showToast('도면 규칙 위반 감지, 자동 재생성됨','warning');
      }
      
      // ★ 2차 검증 — 재생성 후에도 도면 수 불일치이면 강제 트림 ★
      const postIssues=validateDiagramDesignText(designText,_genCount,_expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치'))){
        console.warn('[runDiagramStep] 재생성 후에도 도면 수 불일치 — 초과분 수동 제거');
        designText=_trimDesignTextToExpectedFigures(designText,_expectedNums);
        App.showToast(`도면 수 강제 조정: ${_genCount}개로 트림`,'warning');
      }
    }
    
    if(sid==='step_11'){
      const _methFigCount=parseInt(document.getElementById('optMethodFigures')?.value||2);
      const _devCount=diagramData.step_07?.length||0;
      const _figNums=computeFigNums(_devCount,_methFigCount,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides());
      const _expectedNums=_figNums.method;

      const preIssues=validateDiagramDesignText(designText,_methFigCount,_expectedNums);
      if(preIssues.some(i=>i.severity==='ERROR')){
        const fb=`도면 설계 오류:\n${preIssues.map(i=>i.message).join('\n')}\n도면을 정확히 ${_methFigCount}개만 생성하라: ${_expectedNums.map(n=>'도 '+n).join(', ')}\n원래 요청: ${buildPrompt(sid).slice(0,1500)}`;
        r=await App.callClaude(fb);
        designText=r.text;
      }
      
      const postIssues=validateDiagramDesignText(designText,_methFigCount,_expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치'))){
        designText=_trimDesignTextToExpectedFigures(designText,_expectedNums);
      }
    }
    
    pushOutputHistory(sid,'llm','runDiagramStep');
    outputs[sid]=designText;markOutputTimestamp(sid);invalidateDownstream(sid);onStepCompleted(sid);
    renderOutput(sid,designText);
    
    // 3. Mermaid 변환
    const mermaidPrompt=buildMermaidPrompt(sid);
    console.log('[runDiagramStep] mermaid prompt length=',mermaidPrompt.length);
    const mr=await App.callClaude(mermaidPrompt,4096);
    if(!mr.text||mr.text.trim().length<10){
      console.error('[runDiagramStep] Mermaid 변환 실패 — 빈 응답');
      App.showToast('Mermaid 변환 실패 — 다시 시도해 주세요.','error');
      throw new Error('Mermaid 변환 AI 응답 비어있음');
    }
    pushOutputHistory(sid+'_mermaid','llm','runDiagramStep.mermaid');
    outputs[sid+'_mermaid']=mr.text;
    
    // 4. 렌더링 + 최종 검증
    renderDiagrams(sid,mr.text);

    // ★ v18: R6b/R6e/R12/R13a/R13b/R14 오류 시 자동 재생성 1회 시도 ★
    if(window._diagramErrors&&window._diagramErrors.sid===sid
       &&/\[R(?:6[be]|1[234][ab]?)\]/.test(window._diagramErrors.errors)
       &&!window._r13AutoRetried){
      window._r13AutoRetried=true;
      App.showToast('도면 규칙 위반 감지 — 자동 재생성','warning');
      try{
        await regenerateDiagramWithFeedback(sid);
      }catch(e2){
        console.warn('[runDiagramStep] 도면 규칙 위반 자동 재생성 실패:',e2);
      }
    }else if(!window._diagramErrors||window._diagramErrors.sid!==sid){
      window._r13AutoRetried=false; // 오류 없으면 플래그 리셋
    }

    const dlId=sid==='step_07'?'diagramDownload07':'diagramDownload11';
    const dlEl=document.getElementById(dlId);
    if(dlEl)dlEl.style.display='block';

    saveProject(true);
    App.showToast(`${STEP_NAMES[sid]} 완료 [${App.getModelConfig().label}]`);
    // [C1 자동 연쇄] SCOPE_GUARDED_MERMAID 스텝 생성 후 자동 검증
    const mermaidSid=sid+'_mermaid';
    if(inventionScope?.locked_at&&SCOPE_GUARDED_MERMAID_STEPS.includes(mermaidSid)){try{await runScopeCheck(mermaidSid);}catch(e2){console.warn('[C1] runDiagramStep 후 runScopeCheck 자동 실행 실패:',mermaidSid,e2.message);}}
  }catch(e){
    App.showToast(e.message,'error');
  }finally{
    loadingState[sid]=false;
    App.setButtonLoading(bid,false);
    setGlobalProcessing(false);
  }
}
// ═══ v11.0: 예시도/개념도 자동 감지 ═══
function autoDetectConceptDiagrams(){
  const claims=outputs.step_06||'';
  if(!claims)return;
  const detected=[];
  // UI/화면 관련 키워드
  if(/디스플레이|표시부|화면|인터페이스|터치\s*스크린|GUI|사용자\s*인터페이스/i.test(claims)&&!conceptDiagramTypes.find(t=>t.type==='ui_screen'))
    detected.push('ui_screen');
  // 시나리오 키워드
  if(/사용자|단말|클라이언트|요청|응답|전송|수신/i.test(claims)&&!conceptDiagramTypes.find(t=>t.type==='user_scenario'))
    detected.push('user_scenario');
  // 데이터 구조 키워드
  if(/데이터베이스|테이블|스키마|레코드|필드|저장부|DB|메모리/i.test(claims)&&!conceptDiagramTypes.find(t=>t.type==='data_structure'))
    detected.push('data_structure');
  if(detected.length>0){
    detected.forEach(typeKey=>{
      const typeDef=CONCEPT_DIAGRAM_TYPES[typeKey];
      conceptDiagramTypes.push({type:typeKey,title:typeDef.label,figNum:0,figNumOverride:0,svgContent:'',refNums:[]});  // ③ figNumOverride:0=자동(순서 지정 시 도 번호)
    });
    conceptDiagramCount=conceptDiagramTypes.length;
    renderConceptDiagramTypesList();
    App.showToast(`예시도 ${detected.length}종 자동 추천: ${detected.map(k=>CONCEPT_DIAGRAM_TYPES[k].label).join(', ')}`,'info');
  }
}

// ═══ v11.0: 예시도/개념도 AI 생성 ═══
async function runConceptDiagramStep(){
  if(!conceptDiagramTypes.length){App.showToast('예시도 유형을 추가하세요','error');return;}
  if(!outputs.step_06){App.showToast('장치 청구항(Step 6)을 먼저 생성하세요','error');return;}
  if(globalProcessing)return;
  setGlobalProcessing(true);
  const bid='btnStep07c';
  loadingState.step_07c=true;App.setButtonLoading(bid,true);

  try{
    const cFigNums=getAutoFigNums('step_07c');
    const count=conceptDiagramTypes.length;
    const figNums=cFigNums.slice(0,count);
    const typeDescs=conceptDiagramTypes.map((ct,i)=>{
      const td=CONCEPT_DIAGRAM_TYPES[ct.type]||{label:ct.type};
      return `도 ${figNums[i]||'?'}: ${td.label}`;
    }).join(', ');

    App.showProgress('progressStep07c','예시도 생성 중...',1,2);

    const prompt=`특허 도면 전문가로서, 아래 발명의 예시도/개념도를 SVG 코드로 직접 생성하라.

${CONCEPT_PURPOSE_RULES}

⛔⛔⛔ 절대 금지 사항 (위반 시 도면 전체 거부) ⛔⛔⛔
1. 박스(사각형) + 화살표로 구성된 블록도/플로우차트 형태 절대 금지
2. "~부", "~모듈", "~엔진" 같은 기능 구성요소명을 박스 라벨로 사용 금지
3. 색상 사용 금지 — 오직 흑색 선(stroke="#000" 또는 "#333")만 허용
4. 영문자 접미사가 붙은 참조번호(83a, 92b 등) 금지
5. 장치 블록도(도 1~N)와 동일한 구성을 반복 금지

✅ 예시도가 반드시 가져야 할 요소 (유형별)
- 화면 구성도: 실제 모바일/PC 화면 모양(둥근 모서리 사각형에 UI 요소들)
- 사용 시나리오도: 스틱 피겨(사람), 말풍선, 손 제스처, 물리적 장면
- 장치 외관도: 디바이스의 물리적 외형(스마트폰, 웨어러블, 센서 등)
- 동작 설명도: 물리적 메타포(깔때기, 저울, 바구니, 타임라인 등)
- 데이터 구조도: 테이블 형식(행/열), 필드명과 예시값

═══ 시각적 어휘 (반드시 이 중에서 선택) ═══
□ 사람: 원(머리) + 선(몸/팔/다리)으로 스틱 피겨
□ 화면: 둥근 사각형(rx=8) + 내부 UI 요소(버튼, 리스트, 입력창)
□ 말풍선: 둥근 사각형 + 삼각형 꼬리
□ 디바이스: 스마트폰(세로 둥근 사각형), 스피커(원통), 센서(작은 원)
□ 데이터 테이블: 격자(행+열), 헤더 강조
□ 화살표: 동작의 방향이나 데이터 이동 (최소 사용)
□ 아이콘: 원 안의 간단한 기호 (♪, ♡, ⚙, 📷 등의 기하학적 표현)

═══ SVG 기술 규칙 ═══
1. viewBox="0 0 680 500" (너비 680 고정)
2. 배경 투명, stroke="#000" fill="none" (필요시 fill="#fff" 허용)
3. stroke-width: 본체 0.8~1.5, 리더라인 0.5
4. 폰트: font-family="Malgun Gothic,sans-serif"
5. 텍스트: 제목 14px, 라벨 12px, 참조번호 11px
6. 참조번호 표기: 리더라인(얇은 선) + 숫자 (예시도 전용: 31~99 범위)
7. ★ 제목(【도 N】)은 코드가 자동으로 삽입하므로 ★SVG에 도면 제목 텍스트를 넣지 마라★ (넣어도 코드가 올바른 번호로 교체한다). 상단은 도면 내용을 위해 비워 둬라.
8. 마커(화살표)는 최소한만 사용 — 시각적 장면이 핵심

${CONCEPT_OVERLAP_RULES}

═══ 유형별 구체 지시 ═══

[화면 구성도 선택 시]
- 스마트폰 외곽(세로 둥근 사각형 320×500 등) 그리고 내부에 화면 구성
- 상단바, 앱 타이틀, 메인 콘텐츠 영역, 하단 탭바 등
- 버튼/입력창/리스트는 실제 UI처럼 그려라
- 블록도처럼 "기능 박스"를 나열하지 마라

[사용 시나리오도 선택 시]
- 스틱 피겨 사용자 1~2명
- 디바이스(스마트폰/스피커 등)
- 말풍선이나 동작 표현(점선 화살표, 파동선)
- 장면이 하나의 "순간"을 보여줘야 함

[데이터 구조도 선택 시]
- 격자 형태의 테이블
- 헤더: "필드명" / 바디: "예시값"
- 여러 레코드 예시 표시

═══ 발명 정보 ═══
발명의 명칭: ${selectedTitle}

═══ 도면 요청 ═══
도면 수: ${count}개 (${figNums.map(n=>'도 '+n).join(', ')})
유형: ${typeDescs}

═══ 청구범위 (★ 이 예시도가 시각화할 구성을 특정해 도면에 반드시 담아라 — 블록도 복제만 금지) ═══
${outputs.step_06?.slice(0,2000)||''}

═══ 출력 형식 (정확히 따르라 — 각 도면: SVG + 간단설명 + 요소맵) ═══
---CONCEPT_FIG_${figNums[0]}---
<svg viewBox="0 0 680 500" xmlns="http://www.w3.org/2000/svg">
  <!-- 절대 블록+화살표 구조 금지, 시각적 장면 그려라 -->
</svg>
---BRIEF_DESC---
도 ${figNums[0]}은 ...를 나타내는 예시도이다.
---REF_MAP---
31: 요소이름
32: 요소이름
${figNums.length>1?figNums.slice(1).map(n=>'\n---CONCEPT_FIG_'+n+'---\n<svg>...</svg>\n---BRIEF_DESC---\n도 '+n+'은 ...를 나타내는 예시도이다.\n---REF_MAP---\n31: 요소이름\n32: 요소이름').join(''):''}
★ REF_MAP: 도면의 각 참조번호(31~99)가 무슨 요소인지 "번호: 한국어 이름"으로 빠짐없이 적어라(부호의 설명·상세설명이 이 이름을 사용한다).

⛔ 자체 검증 — SVG 출력 전 아래를 확인하라:
1. stroke에 "#" 뒤에 0, 3 이외의 숫자가 있는가? → 있으면 흑백으로 수정
2. <rect>가 5개 이상이고 텍스트가 "~부"로 끝나는가? → 블록도임, 다시 그려라
3. 참조번호에 a, b, c, d, e가 포함되는가? → 제거하고 순수 숫자만 사용
4. 이 도면이 step_07 블록도와 차별화되는가? → 아니면 다시 그려라
5. ★ 부호 리더선/연결선이 다른 박스·텍스트·선과 겹치거나 가로지르는가? 요소·텍스트가 서로 겹치는가? → 있으면 경로·좌표를 수정해 겹침을 제거하고 다시 그려라`;

    const r=await App.callClaude(prompt,16384);
    const fullText=r.text||'';

    App.showProgress('progressStep07c','예시도 파싱 중...',2,2);

    // ★ P2/P3 공유 파서 — 마커별 SVG/BRIEF/REF_MAP(번호↔이름) 추출, 참조번호 31~99 통일(메인·캐스케이드 일관).
    _parseConceptResult(fullText, conceptDiagramTypes, figNums);

    // 결과 저장 — refMap 의 "이름(번호)" 포함(부호의 설명·상세설명 정밀 참조).
    pushOutputHistory('step_07c','llm','runConceptDiagramStep');
    outputs.step_07c=_buildConceptOutputText(conceptDiagramTypes, figNums);
    markOutputTimestamp('step_07c');
    // ★ [A] 예시도 생성 = 명세서 반영 의사 → 발명의 설명·부호의 설명에 자동 반영(APPEND, 기존 본문 보존).
    //   (종전: invalidateDownstream 으로 stale 배지만 띄움 → 수동 옵트인이라 도4·5 누락. 이제 생성 즉시 자동 반영.)
    const _refl=reflectConceptsToSpec();
    if(outputs.step_08)renderOutput('step_08',outputs.step_08);
    if(outputs.step_18)renderOutput('step_18',outputs.step_18);
    onStepCompleted('step_07c');
    if(_refl.desc||_refl.ref)App.showToast(`예시도 설명 자동 반영 — 발명의 설명 ${_refl.desc}건·부호의 설명 ${_refl.ref}건`,'info');

    renderConceptDiagramCards();
    saveProject(true);
    // ★ [C] 생성 직후 비전 자동 정련 1회(겹침 안전망) — App.callVision 있을 때만(가드), 1회만(비용·루프 제한).
    try{ if(App&&typeof App.callVision==='function'){ App.showProgress('progressStep07c','겹침 자동 정련 중...',2,2); await Patent.refineAllConceptDiagrams({maxRounds:1}); } }catch(_e){}
    App.clearProgress('progressStep07c');
    App.showToast(`예시도 ${conceptDiagramTypes.length}종 생성 완료`);
  }catch(e){
    App.showToast(e.message,'error');
  }finally{
    loadingState.step_07c=false;
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
    
    pushOutputHistory('step_02','llm','runBatch25');
    outputs.step_02=r02.text;markOutputTimestamp('step_02');
    renderBatchResult('resultsBatch25','step_02',r02.text);

    pushOutputHistory('step_03','llm','runBatch25');
    outputs.step_03=r03.text;markOutputTimestamp('step_03');
    renderBatchResult('resultsBatch25','step_03',r03.text);

    pushOutputHistory('step_04','llm','runBatch25');
    if(r04){outputs.step_04=r04.formatted;renderBatchResult('resultsBatch25','step_04',r04.formatted);}
    else{outputs.step_04='【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';renderBatchResult('resultsBatch25','step_04',outputs.step_04);}
    markOutputTimestamp('step_04');

    // step_05는 step_03에 의존하므로 순차 실행
    App.showProgress('progressBatch','해결하고자 하는 과제 (2/2)',2,2);
    const r05=await App.callClaude(buildPrompt('step_05'));
    pushOutputHistory('step_05','llm','runBatch25');
    outputs.step_05=r05.text;markOutputTimestamp('step_05');
    renderBatchResult('resultsBatch25','step_05',r05.text);
    
    App.clearProgress('progressBatch');
    saveProject(true);App.showToast('기본 항목 완료 (병렬 처리)');
  }catch(e){App.clearProgress('progressBatch');App.showToast(e.message,'error');}
  finally{loadingState.batch25=false;App.setButtonLoading('btnBatch25',false);setGlobalProcessing(false);}
}
// ★ Bug1 수정: "마무리 일괄생성"이 후반부 전체를 역설계 의존 순서로 생성.
//   기존: [16,17,18,19]만 생성 → 02/03/04/05 누락 + 효과(16)가 해결수단(17)보다 먼저 생성되어 맥락 부실.
//   수정: 해결수단(17)→과제(05)→효과(16)/배경(03)→기술분야(02)→부호(18)→요약(19) + 선행기술(04) 검색.
//   각 단계는 _cascadeRender로 올바른 컨테이너(resultsBatch25/resultsBatchFinish)에 자동 라우팅.
async function runBatchFinish(){
  if(globalProcessing)return;
  if(!outputs.step_06||!outputs.step_08){App.showToast('청구항+상세설명 먼저','error');return;}
  setGlobalProcessing(true);loadingState.batchFinish=true;App.setButtonLoading('btnBatchFinish',true);
  // 의존 순서: 해결수단→과제→효과→배경→기술분야→부호→요약
  const steps=['step_17','step_05','step_16','step_03','step_02','step_18','step_19'];
  const total=steps.length+1; // +선행기술 검색
  try{
    // 선행기술(04)이 비어 있으면 KIPRIS 검색으로 보충
    if(!outputs.step_04&&selectedTitle){
      App.showProgress('progressBatchFinish','선행기술 검색 중 (1/'+total+')',1,total);
      try{const sr=await searchPriorArt(selectedTitle);outputs.step_04=sr?sr.formatted:'【특허문헌】\n(관련 선행특허를 검색하지 못하였습니다)';pushOutputHistory('step_04','llm','runBatchFinish');markOutputTimestamp('step_04');_cascadeRender('step_04',outputs.step_04);}catch(e){console.warn('[runBatchFinish] 선행기술 검색 실패',e);}
    }
    for(let i=0;i<steps.length;i++){
      const sid=steps[i];
      App.showProgress('progressBatchFinish',`${STEP_NAMES[sid]} (${i+2}/${total})`,i+2,total);
      const prompt=buildPrompt(sid);
      if(!prompt)continue;
      const r=await App.callClaude(prompt);
      pushOutputHistory(sid,'llm','runBatchFinish');
      outputs[sid]=r.text;markOutputTimestamp(sid);
      _cascadeRender(sid,r.text);
    }
    App.clearProgress('progressBatchFinish');saveProject(true);
    App.showToast('마무리 완료 (해결수단→과제→효과→배경→기술분야→부호→요약)');
  }catch(e){App.clearProgress('progressBatchFinish');App.showToast(e.message,'error');}
  finally{loadingState.batchFinish=false;App.setButtonLoading('btnBatchFinish',false);setGlobalProcessing(false);}
}

// ═══ v14: Phase 기반 배치 실행 (역설계 체인) ═══

// Phase D: 역설계 체인 (해결수단→과제→효과→배경기술→기술분야)
async function runPhaseD(){
  if(globalProcessing)return;
  if(!outputs.step_06){App.showToast('장치 청구항(A2)을 먼저 작성하세요','error');return;}
  setGlobalProcessing(true);
  const btn=document.getElementById('btnPhaseD');
  if(btn){btn.disabled=true;btn.textContent='<span class="ico" data-icon="history"></span> 역설계 진행 중...';}
  const container=document.getElementById('resultsPhaseDChain');
  if(container)container.innerHTML='';
  
  // ★ Bug1 수정: 역설계 의존 순서 — 해결수단(17)이 과제(05)·효과(16)보다 먼저 생성돼야 맥락이 맞음
  const steps=['step_17','step_05','step_16','step_03','step_02'];
  const stepLabels={step_17:'D1. 해결 수단',step_05:'D2. 과제',step_16:'D3. 효과',step_03:'D4. 배경기술',step_02:'D5. 기술분야'};
  
  try{
    for(let i=0;i<steps.length;i++){
      const sid=steps[i];
      App.showProgress('progressPhaseD',`${stepLabels[sid]} (${i+1}/${steps.length})`,i+1,steps.length);
      const r=await App.callClaude(buildPrompt(sid));
      pushOutputHistory(sid,'llm','runPhaseD');
      outputs[sid]=r.text;
      markOutputTimestamp(sid);
      if(container)renderBatchResult('resultsPhaseDChain',sid,r.text);
    }
    App.clearProgress('progressPhaseD');
    saveProject(true);
    App.showToast('<span class="ico" data-icon="check-circle"></span> 역설계 체인 완료 (효과→과제→해결수단→배경→기술분야)');
  }catch(e){
    App.clearProgress('progressPhaseD');
    App.showToast(e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='<span class="ico" data-icon="refresh"></span> 역설계 체인 일괄 생성';}
    setGlobalProcessing(false);
  }
}

// Phase F: 마무리 (부호+요약서)
async function runPhaseF(){
  if(globalProcessing)return;
  if(!outputs.step_06||!outputs.step_08){App.showToast('청구항+상세설명 먼저','error');return;}
  setGlobalProcessing(true);loadingState.batchFinish=true;App.setButtonLoading('btnBatchFinish',true);
  document.getElementById('resultsBatchFinish').innerHTML='';
  const steps=['step_18','step_19'];
  try{
    for(let i=0;i<steps.length;i++){
      App.showProgress('progressBatchFinish',`${STEP_NAMES[steps[i]]} (${i+1}/${steps.length})`,i+1,steps.length);
      const r=await App.callClaude(buildPrompt(steps[i]));
      pushOutputHistory(steps[i],'llm','runPhaseF');
      outputs[steps[i]]=r.text;markOutputTimestamp(steps[i]);
      renderBatchResult('resultsBatchFinish',steps[i],r.text);
    }
    App.clearProgress('progressBatchFinish');
    saveProject(true);App.showToast('<span class="ico" data-icon="check-circle"></span> 마무리 완료 (F1→F2)');
  }catch(e){App.clearProgress('progressBatchFinish');App.showToast(e.message,'error');}
  finally{loadingState.batchFinish=false;App.setButtonLoading('btnBatchFinish',false);setGlobalProcessing(false);}
}


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
      const body=_stripDupHeader(s.b,s.h);
      if(!body)return hd;
      return hd+body.split('\n').filter(l=>l.trim()).map(l=>`<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify">${App.escapeHtml(l.trim())}</p>`).join('');
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
          const batchLayout=computeDeviceLayout2D(batchDisplayNodes,edges,figNum);
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
          // v8.0: tight-fit frame height (선언 후 계산)
          const frameH=batchNumRows*boxH+(batchNumRows>1?(batchNumRows-1)*PPTX_BOX_GAP_Y:0)+PPTX_FRAME_PAD_Y*2;
          const boxStartX=frameX+PPTX_FRAME_PAD_X;
          const boxStartY=frameY+PPTX_FRAME_PAD_Y;
          const batchColGap=PPTX_BOX_GAP_X;
          const refLabelX=frameX+frameW+0.1;
          
          // 외곽 프레임 (테두리만)
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
            // v10.3: 텍스트 너비 기반 최소 shape 너비 (PPTX batch - 인치)
            const _bfs=Math.min(11,Math.max(8,13-nodes.length*0.35));
            const _btw=cleanLabel.length*(_bfs/72)*0.65;
            const _bmsw=_btw+0.25;
            if(sm.sw<_bmsw&&shapeType!=='box'){
              sm.sw=Math.min(_bmsw,batchBoxW*0.85);
              sm.dx=(batchBoxW-sm.sw)/2;
            }
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
          slide.addText(String(frameRefNum),{x:refLabelX+0.25,y:batchFrameLeaderY-0.12,w:0.5,h:0.24,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          
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
function parseClaimStats(t){const cp=/【청구항\s*(\d+)】\s*([\s\S]*?)(?=【청구항\s*\d+】|$)/g,c={};let m;while((m=cp.exec(t))!==null)c[parseInt(m[1])]=m[2].trim();const tot=Object.keys(c).length;let dep=0;Object.values(c).forEach(x=>{if(/(?:청구항|제)\s*\d+\s*(?:항\s*)?에\s*(?:있어서|따른|의한)/.test(x))dep++;});return{total:tot,independent:tot-dep,dependent:dep,claims:c};}
function extractMermaidBlocks(t){return(t.match(/```mermaid\n([\s\S]*?)```/g)||[]).map(b=>b.replace(/```mermaid\n/,'').replace(/```/,'').trim());}
function parseMathBlocks(t){const b=[];let m;const re=/---MATH_BLOCK_\d+---\s*\nANCHOR:\s*(.+)\s*\nFORMULA:\s*\n([\s\S]*?)(?=---MATH_BLOCK_|\s*$)/g;while((m=re.exec(t))!==null)b.push({anchor:m[1].trim(),formula:_sanitizeMathFormula(m[2].trim())});return b;}

// v10.3: 수학식 FORMULA 오염 제거 — LLM이 원문 텍스트를 FORMULA에 포함시키는 문제
// 【수학식 N】 + 수식 + "여기서," 설명 + "예를 들어," 예시까지만 보존
function _sanitizeMathFormula(formula){
  if(!formula)return formula;
  const lines=formula.split('\n');
  const cleanLines=[];
  let foundExample=false; // "예를 들어" 라인 도달 여부
  let exampleDone=false;  // 예시 문장 종료 여부
  
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const trimmed=line.trim();
    
    // 수학식 종료 후 원문 오염 감지
    if(exampleDone){
      // 빈 줄은 허용 (수학식 블록 종료 마커)
      if(!trimmed){cleanLines.push(line);continue;}
      // 원문 텍스트 패턴 감지 — 수학식이 아닌 일반 서술문
      // 쉼표로 시작하는 문장 잔해 (", 경고 상태로 판정된 경우...")
      if(trimmed.startsWith(',')||trimmed.startsWith('.')){
        console.warn(`[_sanitizeMathFormula] 원문 오염 제거: "${trimmed.slice(0,50)}..."`);
        break; // 이후 모든 라인 폐기
      }
      // 한국어 서술문 패턴 (구성요소, 동작 설명)
      if(/^[가-힣]/.test(trimmed)&&!trimmed.startsWith('【수학식')&&
         !trimmed.startsWith('여기서')&&!trimmed.startsWith('예를 들어')&&
         !trimmed.startsWith('일 예로')&&!trimmed.startsWith('구체적')&&
         !/^[A-Z_a-z(]/.test(trimmed)&&
         (trimmed.includes('하고,')||trimmed.includes('하며,')||trimmed.includes('한다.')||
          trimmed.includes('된다.')||trimmed.includes('있다.')||trimmed.includes('이다.'))){
        console.warn(`[_sanitizeMathFormula] 원문 서술문 감지, 이후 폐기: "${trimmed.slice(0,50)}..."`);
        break;
      }
      cleanLines.push(line);
      continue;
    }
    
    // 예를 들어 라인 감지
    if(!foundExample&&(trimmed.startsWith('예를 들어')||trimmed.startsWith('일 예로')||trimmed.startsWith('구체적 예시'))){
      foundExample=true;
    }
    
    // 예를 들어 라인 이후 마침표로 끝나면 예시 완료
    if(foundExample&&trimmed.length>5&&/[.다]$/.test(trimmed)){
      exampleDone=true;
    }
    
    cleanLines.push(line);
  }
  
  // 끝부분 빈 줄 정리
  while(cleanLines.length>0&&!cleanLines[cleanLines.length-1].trim())cleanLines.pop();
  return cleanLines.join('\n');
}
function stripMathBlocks(text){
  if(!text)return '';
  // 회귀 방지 케이스 (반드시 PASS):
  // [IN]  "【수학식 1】\nF=ma\n여기서 F는 힘이다.\n\n예를 들어 자동차는 가속한다."
  // [OUT] "예를 들어 자동차는 가속한다."   ← 수학식+여기서절은 제거, 일반서술 보존
  // [IN]  "본 발명은, 예를 들어 다음과 같다."
  // [OUT] "본 발명은, 예를 들어 다음과 같다."   ← 수학식 없으면 무손실
  // [IN]  "【수학식 1】\nE=mc²\n\n【수학식 2】\nF=ma"
  // [OUT] ""   ← 연속 수학식 모두 제거 (빈 줄로 잘리지 않음)
  // [IN]  "【수학식 1】\nA=B\n여기서 A는 면적,\nB는 폭이다."
  // [OUT] ""   ← "여기서" 절이 줄바꿈 포함해도 끝까지 따라감
  //
  // 호출처: insertMathBlocks(line ~6471, step_09 수학식 삽입 시 기존 블록 제거)
  //
  // 원리: 【수학식 N】 블록 전체를 단일 패턴으로 제거 (4개 독립 패턴 → 1개 통합)
  // 수학식 블록 = 【수학식 N】 + 수식 + 여기서 + 예를 들어 (하나의 단위)
  // 종결 조건: (1) \n + 서술 키워드, (2) \n\n + 비수학 시작, (3) 문자열 끝
  // 수학 연속(MC) 패턴: "여기서", "예를 들어"는 단독 키워드만으로는 부족 —
  // 일반 서술도 흔히 쓰는 표현이므로 "예를 들어"는 같은 줄에 수식기호(=,×,÷,∑,±) 동반시만 인식
  const MC='여기서|예를 들어[^\\n]*?[=×÷∑±]|예시 대입|일 예로[^\\n]*?[=×÷∑±]|구체적\\s*예시|예컨대[^\\n]*?[=×÷∑±]|다음은[^\\n]*?[=×÷∑±]|예:[^\\n]*?[=×÷∑±]|[A-Z_][A-Za-z_\\d]*\\s*[=:]';
  const DK='도\\s|이때|또한|한편|다음(?!은)|구체적으로|상기|본 발명|이상|따라서|결과|이를|아울|이와|상술|전술|[가-힣]{2,}부[(\\s]|[가-힣]{2,}(?:서버|시스템|장치|단말)';
  const term=`\\n(?:${DK}|\\n(?!\\s*(?:${MC})))|$`;
  let r=text.replace(new RegExp(`\\n*【수학식\\s*\\d+】[\\s\\S]*?(?=${term})`,'g'),'');
  // 잔여 독립 헤더 정리
  r=r.replace(/\n*【수학식\s*\d+】[^\n]*\n/g,'\n');
  // 다중 줄바꿈 정리
  r=r.replace(/\n{3,}/g,'\n\n');
  return r.trim();
}
// v10.2: 수학식 번호 순차 재정렬 (헤더 + 본문 교차참조 모두 갱신)
function renumberMathBlocks(text){
  if(!text)return text;
  
  // 1단계: 모든 【수학식 N】 헤더 수집 → 위→아래 출현 순서대로 매핑 구축
  const headerRe=/【수학식\s*(\d+)】/g;
  const oldToNew={};  // {oldNum: newNum}
  let m,newNum=0;
  while((m=headerRe.exec(text))!==null){
    const oldN=m[1];
    if(!(oldN in oldToNew)){newNum++;oldToNew[oldN]=String(newNum);}
  }
  if(!newNum)return text;
  
  // 이미 순차적이면 변경 불필요
  const needsRename=Object.entries(oldToNew).some(([o,n])=>o!==n);
  if(!needsRename)return text;
  
  // 2단계: 2-pass 치환 (충돌 방지: old→임시→최종)
  let r=text;
  // 큰 번호부터 치환 (수학식 10 → 수학식 1 부분매칭 방지)
  const sortedOld=Object.keys(oldToNew).sort((a,b)=>parseInt(b)-parseInt(a));
  for(const oldN of sortedOld){
    // 【수학식 N】 헤더 + 본문 "수학식 N" 참조 모두 매칭
    // 후행 문자: 】, 한국어 조사(에,을,의,은,는,이,과,와), 공백, 구두점
    const re=new RegExp(`수학식\\s*${oldN}(?=】|에|을|를|의|은|는|이|과|와|로|\\s|,|\\.|;|:|$)`,'g');
    r=r.replace(re,`수학식__RENUM_${oldToNew[oldN]}__`);
  }
  // 임시 → 최종
  r=r.replace(/수학식__RENUM_(\d+)__/g,'수학식 $1');
  return r;
}
// v10.2: 기존 수학식 블록 추출 (원문에서 수학식+설명 전체를 보존)
function extractExistingMathBlocks(text){
  if(!text)return[];
  const blocks=[];
  const re=/\n*(【수학식\s*\d+】[\s\S]*?)(?=\n\n(?:도\s|이때|또한|한편|다음|구체적|상기|본 발명|이상|따라서|결과|이를|아울|이와|상술|전술|[가-힣]{2,}부[(\s]|[가-힣]{2,}(?:서버|시스템|장치|단말))|\n\n\n|$)/g;
  let m;
  while((m=re.exec(text))!==null){
    const formula=m[1].trim();
    const before=text.substring(Math.max(0,m.index-200),m.index);
    // 소수점(3.14 등)을 보호한 후 문장 분리 — 소수점에서 잘리는 앵커 방지
    const _safeBefore=before.replace(/(\d)\.(\d)/g,'$1�$2');
    const sentences=_safeBefore.split(/[.。]\s*/);
    // 마지막 비어있지 않은 완전한 문장을 앵커로 사용 (마지막 요소는 불완전 조각일 수 있음)
    let anchor='';
    for(let si=sentences.length-1;si>=0;si--){
      const s=sentences[si].replace(/�/g,'.').trim();
      if(s.length>=10){anchor=s;break;}
    }
    if(anchor.length>=10)blocks.push({anchor,formula});
  }
  return blocks;
}
// ═══ A3 fix: 유사도 기반 앵커 매칭 (v5.5, v10.2: 독립 함수 추출) ═══
function fuzzyFindAnchor(text,anchor){
  if(!text||!anchor||anchor.length<5)return -1;
  // 1차: 정확 매칭
  const exact=text.indexOf(anchor);
  if(exact>=0)return exact;
  // 2차: 정규화 + 정확한 위치 역매핑 (ratio 방식 폐기 — v10.3)
  const isPunct=c=>'.,;:!?·…'.includes(c);
  const normAnchor=_normForAnchor(anchor);
  if(normAnchor.length<5)return -1;
  
  // 원문의 각 문자 → 정규화 문자열에서의 인덱스 매핑 구축
  const normChars=[];
  const normToOrig=[]; // normToOrig[i] = 정규화 i번째 문자의 원문 위치
  let prevSp=true;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(isPunct(c))continue;
    if(/\s/.test(c)){
      if(!prevSp&&normChars.length>0){normChars.push(' ');normToOrig.push(i);prevSp=true;}
    }else{normChars.push(c);normToOrig.push(i);prevSp=false;}
  }
  const normText=normChars.join('');
  const normIdx=normText.indexOf(normAnchor);
  if(normIdx>=0&&normIdx<normToOrig.length){
    return normToOrig[normIdx]; // ★ 정확한 원문 위치 반환 ★
  }
  // 3차: 앵커의 핵심 키워드(3단어 이상) 연속 매칭
  const words=anchor.replace(/[.,;:!?·…]/g,'').split(/\s+/).filter(w=>w.length>=2);
  if(words.length>=3){
    const escaped=words.slice(0,Math.min(5,words.length)).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const keyPhrase=escaped.join('\\s*[.,;:!?·…]*\\s*'); // v10.3: 구두점 허용
    try{
      const re=new RegExp(keyPhrase);
      const km=text.match(re);
      if(km&&km.index!=null)return km.index;
    }catch(e){/* regex 실패 시 4차로 */}
  }
  // 4차: 앵커 앞 20자로 부분 매칭
  if(anchor.length>=20){
    const partial=anchor.slice(0,20);
    const pi=text.indexOf(partial);
    if(pi>=0)return pi;
  }
  // 5차: 앵커 뒤 20자로 부분 매칭 (AI 검토로 앞부분이 변경된 경우)
  if(anchor.length>=20){
    const tail=anchor.slice(-20);
    const ti=text.indexOf(tail);
    if(ti>=0)return Math.max(0,ti-(anchor.length-20));
  }
  // 6차: 핵심 키워드 후방 3단어 연속 매칭
  if(words&&words.length>=3){
    const tailWords=words.slice(-Math.min(4,words.length));
    const escaped2=tailWords.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const tailPhrase=escaped2.join('\\s*[.,;:!?·…]*\\s*');
    try{
      const re2=new RegExp(tailPhrase);
      const km2=text.match(re2);
      if(km2&&km2.index!=null)return km2.index;
    }catch(e){/* 무시 */}
  }
  return -1;
}

// 앵커 정규화 헬퍼 (공백 정리 + 구두점 제거)
function _normForAnchor(s){
  const isPunct=c=>'.,;:!?·…'.includes(c);
  let r='',prev=true;
  for(const c of s){
    if(isPunct(c))continue;
    if(/\s/.test(c)){if(!prev&&r.length){r+=' ';prev=true;}}
    else{r+=c;prev=false;}
  }
  return r.trim();
}

// v10.3: 앵커 위치에서 문장 끝(마침표) 찾기
// 핵심: 한국어 문장 종결어미(~다.) 뒤의 마침표만 문장 끝으로 인정
// "생성하고," 같은 쉼표 절은 건너뛰고 "생성할 수 있다." 같은 종결어미 뒤 마침표까지 이동
function findSentenceEndAfterAnchor(text,anchorStart,anchor){
  // Step 1: 앵커의 실제 끝 위치를 원문에서 정확히 추적
  const normEnd=_normForAnchor(anchor).slice(-15);
  let actualEnd=Math.min(anchorStart+anchor.length,text.length);
  
  if(normEnd&&normEnd.length>=5){
    const searchEnd=Math.min(anchorStart+anchor.length*2+100,text.length);
    const region=text.slice(anchorStart,searchEnd);
    const normRegion=_normForAnchor(region);
    const tailIdx=normRegion.indexOf(normEnd);
    if(tailIdx>=0){
      const isPunct=c=>'.,;:!?·…'.includes(c);
      let normPos=0,origPos=0,prevSp=true;
      const target=tailIdx+normEnd.length;
      for(origPos=0;origPos<region.length&&normPos<target;origPos++){
        const c=region[origPos];
        if(isPunct(c))continue;
        if(/\s/.test(c)){if(!prevSp){normPos++;prevSp=true;}}
        else{normPos++;prevSp=false;}
      }
      actualEnd=anchorStart+origPos;
    }
  }

  // v10.5: actualEnd가 단어 중간이면 보정 — 앞쪽 단어 경계(공백/마침표)로 이동
  if(actualEnd>0&&actualEnd<text.length&&
     /[가-힣]/.test(text[actualEnd-1]||'')&&/[가-힣]/.test(text[actualEnd]||'')){
    // 앵커 끝이 단어 중간 → 뒤쪽으로 단어 끝까지 진행
    let wordEnd=actualEnd;
    while(wordEnd<text.length&&/[가-힣]/.test(text[wordEnd])&&text[wordEnd]!=='.')wordEnd++;
    actualEnd=wordEnd;
  }

  // Step 1.5: actualEnd 직전(~6자)에 문장 종결 마침표가 있으면 그것을 사용
  // (정규화 오차로 actualEnd가 마침표 직후를 넘어간 경우 보정)
  for(let pos=Math.min(actualEnd,text.length-1);pos>=Math.max(0,actualEnd-6);pos--){
    if(text[pos]==='.'){
      const _b4=text.slice(Math.max(0,pos-4),pos);
      const _pc=pos>0?text[pos-1]:'';
      const _nx=pos+1<text.length?text[pos+1]:'';
      if(/\d/.test(_pc)&&/\d/.test(_nx))continue;
      if(/(?:한다|된다|있다|이다|같다|높다|낮다|않다|크다|작다|많다|적다|좋다|짧다|보다|온다|간다|준다|난다|진다|낸다|넓다|깊다|길다|는다)$/.test(_b4))return pos+1;
      if((!_nx||_nx===' '||_nx==='\n'||_nx==='\r')&&/[가-힣)]/.test(_pc))return pos+1;
      // v10.4: 한글.한글 — 띄어쓰기 누락된 문장 경계 (소수점은 위에서 이미 제외됨)
      if(/[가-힣)]/.test(_pc)&&/[가-힣(]/.test(_nx))return pos+1;
    }
  }

  // Step 2: actualEnd부터 한국어 문장 종결 패턴(~다.) 찾기
  for(let pos=actualEnd;pos<text.length;pos++){
    if(text[pos]==='.'){
      const before=text.slice(Math.max(0,pos-4),pos);
      const next=pos+1<text.length?text[pos+1]:'';

      // "0.5" 같은 소수점은 건너뜀
      const prevChar=pos>0?text[pos-1]:'';
      if(/\d/.test(prevChar)&&/\d/.test(next))continue;

      // 한국어 문장 종결 패턴
      const isKoreanSentEnd=/(?:한다|된다|있다|이다|같다|높다|낮다|않다|크다|작다|많다|적다|좋다|짧다|보다|온다|간다|준다|난다|진다|낸다|넓다|깊다|길다|는다)$/.test(before);
      // "~수 있다." "~할 수 있다." 패턴
      const isCanPattern=/있다$/.test(before)&&/수\s*있다/.test(text.slice(Math.max(0,pos-10),pos));

      if(isKoreanSentEnd||isCanPattern){
        return pos+1;
      }

      // 마침표 다음이 공백/줄바꿈/EOF이고, 앞 글자가 한글이면 문장 끝 가능
      if((!next||next===' '||next==='\n'||next==='\r')&&/[가-힣)]/.test(prevChar)){
        return pos+1;
      }

      // v10.4: 한글.한글 — 띄어쓰기 누락된 문장 경계 (소수점은 위에서 이미 제외됨)
      if(/[가-힣)]/.test(prevChar)&&/[가-힣(]/.test(next)){
        return pos+1;
      }
    }
  }
  
  // 마침표 없으면 줄바꿈 찾기
  const nlIdx=text.indexOf('\n',actualEnd);
  if(nlIdx>=0)return nlIdx;
  
  return text.length;
}

// v10.5: 삽입 지점이 단어/문장 중간이 아닌지 검증 + 보정
function _validateInsertionPoint(text,ip){
  if(ip<=0||ip>=text.length)return ip;
  const before=text[ip-1]||'';
  const after=text[ip]||'';
  // 이미 마침표 뒤이거나 줄바꿈이면 OK
  if(before==='.'||before==='\n'||after==='\n'||after===' ')return ip;
  // 한글+한글 연속 = 단어 중간 → 가장 가까운 마침표+공백 또는 줄바꿈을 찾아 보정
  if(/[가-힣]/.test(before)&&/[가-힣]/.test(after)){
    // 뒤쪽으로 마침표 찾기 (최대 80자)
    for(let p=ip;p<Math.min(ip+80,text.length);p++){
      if(text[p]==='.'){
        const pc=p>0?text[p-1]:'';
        const nc=p+1<text.length?text[p+1]:'';
        if(/\d/.test(pc)&&/\d/.test(nc))continue;
        if(/[가-힣)]/.test(pc))return p+1;
      }
      if(text[p]==='\n')return p;
    }
    // 앞쪽으로 마침표 찾기 (최대 40자)
    for(let p=ip-1;p>=Math.max(0,ip-40);p--){
      if(text[p]==='.'){
        const pc=p>0?text[p-1]:'';
        const nc=p+1<text.length?text[p+1]:'';
        if(/\d/.test(pc)&&/\d/.test(nc))continue;
        if(/[가-힣)]/.test(pc))return p+1;
      }
    }
  }
  return ip;
}

// v10.3: 수학식 삽입 후 문장/절 중복 감지/제거
// 패턴 1: 마침표 문장 중복 (수학식 블록 사이에 같은 문장)
// 패턴 2: 쉼표 절 중복 (긴 문장의 일부 절이 수학식 앞/뒤에 중복)
function _deduplicateSentences(text){
  if(!text)return text;
  let result=text;
  let removedCount=0;
  
  // ═══ 패턴 1: 50자 이상 동일 텍스트 조각이 2회 이상 등장 ═══
  // 수학식 블록 앞/뒤에서만 제거 (다른 도면의 정상 반복은 보존)
  const mathBlockPositions=[];
  const mathRe=/【수학식\s*\d+】/g;
  let mm;
  while((mm=mathRe.exec(result))!==null)mathBlockPositions.push(mm.index);
  
  if(mathBlockPositions.length>0){
    // 50자 이상 연속 텍스트 조각으로 중복 검사
    // 쉼표 절(, ~하고) 또는 마침표 문장 단위로 분리
    const clauseRe=/([^,.\n]{20,}(?:하고|하며|한다|된다|있다|이다|같다|높다|낮다|크다|작다|많다|적다)[,.])/g;
    let cm;
    const clauses=[];
    while((cm=clauseRe.exec(result))!==null){
      clauses.push({text:cm[1].trim(),start:cm.index,end:cm.index+cm[0].length});
    }
    
    // 동일 절 그룹화
    const clauseMap=new Map();
    for(const c of clauses){
      const key=c.text.replace(/\s+/g,' ');
      if(key.length<25)continue;
      if(!clauseMap.has(key))clauseMap.set(key,[]);
      clauseMap.get(key).push(c);
    }
    
    const toRemove=[];
    for(const [key,occurrences] of clauseMap){
      if(occurrences.length<2)continue;
      // 수학식이 두 등장 사이에 있는 경우만 제거
      const hasMathBetween=occurrences.some((o,i)=>{
        if(i===0)return false;
        const between=result.slice(occurrences[i-1].end,o.start);
        return between.includes('【수학식');
      });
      if(hasMathBetween){
        for(let i=1;i<occurrences.length;i++){
          toRemove.push(occurrences[i]);
        }
      }
    }
    
    // ═══ 패턴 2: 마침표 기준 긴 문장 중복 ═══
    const sentRe=/([^.\n]{40,}\.)/g;
    let sm2;
    const sentences=[];
    while((sm2=sentRe.exec(result))!==null){
      sentences.push({text:sm2[1].trim(),start:sm2.index,end:sm2.index+sm2[0].length});
    }
    
    const sentMap=new Map();
    for(const s of sentences){
      const key=s.text.replace(/\s+/g,' ');
      if(key.length<40)continue;
      if(!sentMap.has(key))sentMap.set(key,[]);
      sentMap.get(key).push(s);
    }
    
    for(const [key,occurrences] of sentMap){
      if(occurrences.length<2)continue;
      const hasMathBetween=occurrences.some((o,i)=>{
        if(i===0)return false;
        const between=result.slice(occurrences[i-1].end,o.start);
        return between.includes('【수학식');
      });
      if(hasMathBetween){
        for(let i=1;i<occurrences.length;i++){
          // 이미 제거 대상이 아닌 경우만 추가
          if(!toRemove.some(r=>r.start===occurrences[i].start))
            toRemove.push(occurrences[i]);
        }
      }
    }
    
    // 역순 제거 (겹치는 범위만 병합)
    // ★ 수정: 내림차순 정렬 기준 겹침은 (앞범위 시작 < 뒷범위 끝). 기존 조건은
    //   겹치지 않는 범위도 항상 병합하여 중복 사이의 수학식·본문을 통째로 삭제했음.
    toRemove.sort((a,b)=>b.start-a.start);
    for(let i=toRemove.length-1;i>0;i--){
      if(toRemove[i-1].start<toRemove[i].end){
        toRemove[i-1]={start:Math.min(toRemove[i-1].start,toRemove[i].start),end:Math.max(toRemove[i-1].end,toRemove[i].end),text:toRemove[i-1].text};
        toRemove.splice(i,1);
      }
    }
    for(const rm of toRemove){
      let start=rm.start;
      let end=rm.end;
      // v10.5: 단어 중간 절단 방지 — 제거 범위가 한글 단어를 자르는지 확인
      if(start>0&&/[가-힣]/.test(result[start-1])&&/[가-힣]/.test(result[start])){
        // 제거 범위 시작이 단어 중간 → 앞쪽 마침표/공백까지 확장
        while(start>0&&/[가-힣]/.test(result[start-1])&&result[start-1]!=='.')start--;
      }
      // 앞뒤 공백 정리 (쉼표는 문장 구조이므로 보존)
      while(start>0&&' \n'.includes(result[start-1]))start--;
      while(end<result.length&&' \n'.includes(result[end]))end++;
      // 제거 후 앞뒤 글자가 한글+한글이면 공백 삽입
      const bChar=start>0?result[start-1]:'';
      const aChar=end<result.length?result[end]:'';
      const needSpace=/[가-힣)]/.test(bChar)&&/[가-힣(]/.test(aChar);
      result=result.slice(0,start)+(needSpace?' ':'')+result.slice(end);
      removedCount++;
      console.log(`[_deduplicateSentences] 중복 제거: "${rm.text.slice(0,50)}..."`);
    }
  }
  
  if(removedCount>0){
    result=result.replace(/\n{3,}/g,'\n\n');
    console.log(`[_deduplicateSentences] 총 ${removedCount}개 중복 제거`);
  }
  return result;
}

function insertMathBlocks(s08,s09){
  // First strip any existing math blocks from base text to prevent duplication
  let r=stripMathBlocks(s08);
  const b=parseMathBlocks(s09);
  if(!b.length)return r;
  // Track inserted positions to avoid double-insertion
  const inserted=new Set();
  let successCount=0,failCount=0;
  const failed=[];

  for(const x of b.reverse()){
    const i=fuzzyFindAnchor(r,x.anchor);
    if(i>=0 && !inserted.has(x.anchor)){
      inserted.add(x.anchor);
      const ip=findSentenceEndAfterAnchor(r,i,x.anchor);
      const validIp=_validateInsertionPoint(r,ip);
      r=r.slice(0,validIp)+'\n\n'+x.formula+'\n\n'+r.slice(validIp);
      successCount++;
    }else{
      failCount++;
      failed.push(x);
      console.warn(`수학식 삽입 실패 — ANCHOR 매칭 불가: "${x.anchor.slice(0,50)}..."`);
    }
  }
  // 폴백 1단계: 실패한 수학식을 키워드 기반으로 관련 문단 뒤에 삽입
  let stillFailed=[];
  if(failed.length>0){
    for(const x of failed){
      const kws=(x.formula.match(/[가-힣]{3,}/g)||[]).filter(w=>!['수학식','여기서','예를','들어','이상','이하','경우','하한','상한','값이다','범위'].includes(w));
      let bestIdx=-1,bestScore=0;
      if(kws.length){
        const paras=r.split(/\n\n+/);
        for(let pi=0;pi<paras.length;pi++){
          if(/^【수학식/.test(paras[pi].trim()))continue;
          let score=0;
          for(const kw of kws)if(paras[pi].includes(kw))score++;
          if(score>bestScore){bestScore=score;bestIdx=pi;}
        }
      }
      if(bestIdx>=0&&bestScore>=2){
        const paras=r.split(/\n\n+/);
        r=paras.slice(0,bestIdx+1).join('\n\n')+'\n\n'+x.formula+'\n\n'+paras.slice(bestIdx+1).join('\n\n');
        successCount++;failCount--;
        console.log(`수학식 폴백 삽입: 키워드 ${bestScore}개 매칭 (문단 ${bestIdx})`);
      }else{
        stillFailed.push(x);
      }
    }
  }
  // ★ Bug3 수정: 폴백 2단계(보장 배치) — ANCHOR/키워드 모두 실패해도 드롭하지 않고
  //   수식이 없는 가장 긴 문단들에 분산 삽입하여 생성된 수학식을 모두 반영한다.
  if(stillFailed.length>0){
    const usedIdx=new Set();
    for(const x of stillFailed){
      const paras=r.split(/\n\n+/);
      let bestIdx=-1,bestLen=-1;
      for(let pi=0;pi<paras.length;pi++){
        const p=paras[pi].trim();
        if(/^【수학식/.test(p))continue;        // 수식 문단 제외
        if(p.length<40)continue;                  // 너무 짧은 문단 제외
        if(usedIdx.has(pi))continue;              // 이미 사용한 문단 제외(분산)
        if(p.length>bestLen){bestLen=p.length;bestIdx=pi;}
      }
      // 미사용 적합 문단이 없으면(전부 사용) 가장 긴 비수식 문단 재사용
      if(bestIdx<0){
        for(let pi=0;pi<paras.length;pi++){
          const p=paras[pi].trim();
          if(/^【수학식/.test(p)||p.length<40)continue;
          if(p.length>bestLen){bestLen=p.length;bestIdx=pi;}
        }
      }
      if(bestIdx>=0){
        usedIdx.add(bestIdx);
        r=paras.slice(0,bestIdx+1).join('\n\n')+'\n\n'+x.formula+'\n\n'+paras.slice(bestIdx+1).join('\n\n');
        successCount++;failCount--;
        console.log(`수학식 보장 배치: 문단 ${bestIdx}(${bestLen}자) 뒤 삽입`);
      }else{
        console.warn(`수학식 보장 배치 실패 — 적합 문단 없음: "${x.anchor.slice(0,30)}..."`);
      }
    }
  }
  if(failCount>0){
    App.showToast(`수학식 삽입: ${successCount}개 성공, ${failCount}개 미삽입(적합 위치 없음)`,'warning');
  }else if(successCount>0){
    App.showToast(`수학식 ${successCount}개 삽입 완료`);
  }
  // v10.3: 삽입 후 문장 중복 감지 및 제거
  r=_deduplicateSentences(r);
  // v10.2: 수학식 번호 순차 재정렬 (삽입 순서와 무관하게 위→아래 순서 보장)
  r=renumberMathBlocks(r);
  return r;
}

function buildMermaidPrompt(sid){
  const src=outputs[sid]||'';
  if(!src||src.trim().length<20){
    console.error('[buildMermaidPrompt] 도면 설계 텍스트가 비었음, sid=',sid,'length=',src.length);
    return '도면 설계 텍스트가 비어있어 Mermaid 변환 불가. "장치 도면 설계" 버튼을 다시 눌러주세요.';
  }
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
- 같은 처리 단계의 노드는 연속 정의하라
- 연결 방향: 데이터/정보 흐름 방향과 일치시키라
  수집부→분석부→결정부→전송부 순이면 A-->B-->C-->D
- 순환 연결(A→B→C→A) 금지 — 단방향 데이터 흐름만 표현
`;
  
  if(isDevice){
    rules+=`
═══ 장치 도면 규칙 ═══
- 노드 라벨에 반드시 참조번호 포함: A["통신부(110)"]
- 참조번호는 숫자만 (100, 110, 120...)
- "~단계", "S숫자" 표현 금지
- "~모듈" 금지 → "~부"로 통일

⛔⛔ 참조번호 중복 절대 금지 ⛔⛔
- 서로 다른 노드가 동일한 참조번호를 가지면 안 된다
- 예: 통신부(110)와 외부(110) → 110 중복! → 오류
- "외부", "외부 서버", "외부 장치" 등 외부 엔티티는 도면 내부에 포함하지 마라
- 도 2 이후의 내부 블록도에서는 해당 장치의 하위 구성요소만 표현
- 외부 연결 대상은 노드로 생성하지 말고, 연결선의 끝점으로만 표현하라

★★ 도면별 계층 규칙 ★★
- 도 1: L1(100, 200, 300...) 장치만
- 도 2 (L1 상세화): L1(100)과 그 L2 하위(110,120,130) 포함
  <span class="ico" data-icon="arrow-right"></span> 렌더링: 최외곽 프레임=100, 내부 박스=110,120,130 (100은 프레임으로만)
- 도 3+ (L2 상세화): L2(110)와 그 L3 하위(111,112,113) 포함
  <span class="ico" data-icon="arrow-right"></span> 렌더링: 최외곽 프레임=110, 내부 박스=111,112,113 (110은 프레임으로만)
- L4 (L3 상세화): L3(121)과 그 L4 하위(1211,1212) 포함
  <span class="ico" data-icon="arrow-right"></span> 렌더링: 최외곽 프레임=121, 내부 박스=1211,1212 (121은 프레임으로만)

★★ 연결관계 규칙 ★★
- 데이터/정보 도면(~정보, ~데이터): 정보 항목은 ${getDeviceSubject()} 입력 데이터 → 상호 화살표 연결 부적절 → 연결선 없이 병렬 배치 (노드 정의만, A --> B 금지)
- 장치 블록도: 데이터 흐름이 있는 구성요소만 --> 연결
- 상위 구성(110)과 하위 구성(111,112,113)을 같은 레벨에 표현 금지
- ★ 순환 연결(A-->B-->C-->A) 절대 금지 — 단방향 흐름만

★★★ 공간배치 → Mermaid 변환 규칙 ★★★
도면 설계에 "데이터흐름" 또는 "공간배치" 섹션이 있으면:
1. 도 1: "허브"로 지정된 노드의 ID를 가장 먼저 정의하라
2. 도 2+: 입력측(데이터 흐름의 시작점) 노드를 가장 먼저 정의하라
3. 데이터 흐름 순서대로 노드를 정의하라 (입력→처리→출력)
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
  
  // v10.3: 설계 텍스트에서 실제 도면 번호 추출
  const designFigNums=[];
  const dfRe=/^도\s*(\d+)\s*[:：]/gm;
  let dfm;
  while((dfm=dfRe.exec(src))!==null)designFigNums.push(parseInt(dfm[1]));
  const uniqueDesignFigs=[...new Set(designFigNums)].sort((a,b)=>a-b);
  
  // [C1-3] Layer 1 가드: invention_scope 주입 (Mermaid)
  return `아래 도면 설계를 Mermaid flowchart 코드로 변환하라. 각 도면당 \`\`\`mermaid 블록 1개.

⛔⛔⛔ 도면 수 규칙 (절대 준수) ⛔⛔⛔
- 도면 설계에 기재된 도면: ${uniqueDesignFigs.length}개 (${uniqueDesignFigs.map(n=>'도 '+n).join(', ')})
- mermaid 블록을 정확히 ${uniqueDesignFigs.length}개만 생성하라.
- 도면 설계에 없는 도면의 mermaid 코드를 절대 생성하지 마라.
- 도면 설계에 있는 모든 도면을 빠짐없이 변환하라.

★★★ 구성요소 정합: 도면 설계의 구성요소 명칭과 참조번호를 그대로 사용하라. 임의 변경 금지. ★★★

${rules}

═══ 출력 형식 ═══
각 도면마다 (${uniqueDesignFigs.map(n=>'도 '+n).join(' → ')} 순서):
\`\`\`mermaid
graph TD
    노드정의들...
    연결들...
\`\`\`

${src}${_maybeScopeGuard(sid+'_mermaid','mermaid')}`;
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

function _shortenFig1Label(label){
  if(!label)return '';
  const clean=_safeCleanLabel(label);
  if(clean.length<=6)return clean;

  const typeSuffixes=[
    '서버 장치','센서 장치','조명 장치','촬영 장치','통신 장치','제어 장치','단말 장치',
    '사용자 단말','클라이언트 단말','모바일 단말','휴대 단말','관리 서버','인증 서버',
    '데이터베이스','네트워크','클라우드','스토리지','게이트웨이','라우터',
    '서버','단말','장치','모듈','시스템','센서','카메라','스피커','안테나','모니터','디스플레이'
  ];

  for(const sfx of typeSuffixes){
    if(clean.endsWith(sfx)){
      const words=clean.split(/\s+/);
      const sfxWords=sfx.split(/\s+/);
      if(sfxWords.length>=2)return sfx;
      if(words.length>=2){
        const last2=words.slice(-2).join(' ');
        if(last2.length<=10)return last2;
      }
      return sfx;
    }
  }

  const words=clean.split(/\s+/);
  if(words.length>=3){
    const last2=words.slice(-2).join(' ');
    if(last2.length<=10)return last2;
    return words[words.length-1];
  }
  if(words.length===2&&clean.length>10){
    return words[words.length-1];
  }
  return clean;
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
      // ★ v10.4: 서버 shape — 텍스트 영역(중앙)에 흰색 배경, 점은 우측에만 ★
      let s=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
      s+=`<line x1="${x}" y1="${y+h3}" x2="${x+w}" y2="${y+h3}" stroke="#000" stroke-width="${sw*0.55}"/>`;
      s+=`<line x1="${x}" y1="${y+2*h3}" x2="${x+w}" y2="${y+2*h3}" stroke="#000" stroke-width="${sw*0.55}"/>`;
      // 점을 오른쪽 상단 모서리에 배치 (텍스트와 겹치지 않도록)
      [0.5,1.5,2.5].forEach(m=>{
        s+=`<circle cx="${x+w-dotR*3}" cy="${y+h3*m}" r="${dotR}" fill="#000"/>`;
      });
      return s;
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
    // [C2-3] container shape: 점선 프레임 (subgraph 부모 노드용)
    case 'container':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#666" stroke-width="${sw}" stroke-dasharray="6,3" rx="4"/>`;
    default:return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#000" stroke-width="${sw}"/>`;
  }
}

function _shapeTextCy(type,y,h){
  // ★ v10.4: 아이콘 shape는 텍스트를 아이콘 아래에 배치 ★
  // 아이콘 shape: 시각적 형상이 전체 영역을 차지 → 텍스트가 겹침
  switch(type){
    case 'sensor':return y+h+12;   // 아이콘 하단 아래
    case 'antenna':return y+h+12;
    case 'camera':return y+h+12;
    case 'speaker':return y+h+12;
    case 'cloud':return y+h*0.50;  // 내부 중앙 (cloud는 내부 공간 충분)
    case 'database':return y+h*0.55;
    case 'monitor':return y+h*0.72*0.45;
    case 'document':return y+h*0.62;
    case 'server':return y+h/2;    // 서버 3분할 중앙
    default:return y+h/2;
  }
}

// ★ v10.4: 아이콘 shape 여부 판별 — 텍스트를 아이콘 아래에 배치해야 하는 shape ★
function _isIconShape(type){
  return type==='sensor'||type==='antenna'||type==='camera'||type==='speaker';
}

// [C2-8a] 박스형 노드의 부호 위치 결정 — 연결선 없는 면 찾기
// 우선순위: top > bottom > right > left (모두 점유되면 bottom 폴백)
function _findEmptySide(nodeId, edges, grid){
  const myPos = grid[nodeId];
  if(!myPos) return 'bottom';
  const sides = { top: true, bottom: true, left: true, right: true };
  edges.forEach(e => {
    if(e.from !== nodeId && e.to !== nodeId) return;
    const otherId = e.from === nodeId ? e.to : e.from;
    const otherPos = grid[otherId];
    if(!otherPos) return;
    // 상대 노드의 상대적 위치로 연결선이 향하는 면 판단
    const dr = otherPos.row - myPos.row;
    const dc = otherPos.col - myPos.col;
    if(Math.abs(dr) >= Math.abs(dc)){
      if(dr < 0) sides.top = false;
      else if(dr > 0) sides.bottom = false;
    } else {
      if(dc < 0) sides.left = false;
      else if(dc > 0) sides.right = false;
    }
  });
  if(sides.top) return 'top';
  if(sides.bottom) return 'bottom';
  if(sides.right) return 'right';
  if(sides.left) return 'left';
  return 'bottom';
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

// ── v9.1: Shape 시각적 경계 (bounding box ≠ visual bounds) ──
// 연결선 앵커, leader line 시작점에 사용
// [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP=12)
const _ICON_ARROW_GAP=12;
function _shapeVisualBounds(type,x,y,w,h){
  // ★ v10.4: cx/cy는 항상 기하학적 중심점 (라우팅 대칭성 보장) ★
  // 아이콘 shape는 하단에 라벨 영역(~20px) 포함
  const iconTextH=_isIconShape(type)?22:0;
  switch(type){
    case 'cloud':
      return{top:y+h*0.10, bottom:y+h*0.82, left:x+w*0.08, right:x+w*0.92, cx:x+w/2, cy:y+h*0.45};
    case 'database':
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
    case 'monitor':{
      // [C2-9-fix] monitor visual cy 보정 (server와 일치)
      // bottom을 y+h로 확장하여 _vCy=h/2가 server/box 등 다른 박스형과 동일
      // → 같은 row에서 monitor↔server/box 화살표 직선화 (꺾임 0)
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
    }
    case 'server':
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
    case 'sensor':{
      // [C2-8a-fix-3] 파형 호 실제 렌더 범위 반영 — 호 각도 ±0.35π, R_max=cr*2.65
      // [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP)
      const cr=Math.min(w*0.28,h*0.38);
      const waveCx=x+w*0.32, waveCy=y+h*0.50;
      const Rmax=cr*2.65;
      const sinA=Math.sin(Math.PI*0.35);
      return{top:waveCy-Rmax*sinA-_ICON_ARROW_GAP, bottom:waveCy+Rmax*sinA,
        left:waveCx-cr, right:waveCx+Rmax,
        cx:x+w/2, cy:y+h/2};
    }
    case 'antenna':{
      // [C2-8a-fix-3] 호 apex at -π/2, bottom에서 라벨 패딩 제거
      // [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP)
      const aTopY=y+h*0.18;
      const outerArc=h*0.36;
      const waveTop=aTopY-outerArc;
      const waveRight=x+w*0.38+outerArc*Math.cos(-Math.PI*0.05);
      return{top:Math.min(y+h*0.18,waveTop)-_ICON_ARROW_GAP, bottom:y+h*0.92, left:x+w*0.16, right:Math.max(x+w*0.62,waveRight),
        cx:x+w*0.43, cy:y+h/2};
    }
    case 'document':
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
    case 'camera':
      // [C2-8a-fix-3] bottom에서 라벨 패딩 제거
      // [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP)
      return{top:y+h*0.08-_ICON_ARROW_GAP, bottom:y+h*0.83, left:x+w*0.05, right:x+w*0.85,
        cx:x+w*0.45, cy:y+h/2};
    case 'speaker':{
      // [C2-8a-fix-3] bottom에서 라벨 패딩 제거, right를 호 최대값(angle 0)으로
      // [C2-9-fix] shapeicon 화살표 여백 (_ICON_ARROW_GAP)
      const spWaveRight=x+w*0.55+h*0.46;
      return{top:y+h*0.08-_ICON_ARROW_GAP, bottom:y+h*0.92, left:x+w*0.10, right:Math.max(x+w*0.55,spWaveRight),
        cx:x+w*0.35, cy:y+h/2};
    }
    default:
      return{top:y, bottom:y+h, left:x, right:x+w, cx:x+w/2, cy:y+h/2};
  }
}

// ═══ v10.1: Shape precise anchor points ═══
// Returns exact {px, py} where a leader line or arrow should touch the shape.
// Unlike _shapeVisualBounds (axis-aligned bounding box), this accounts for
// the actual shape curve at the specific connection direction.
function _shapeAnchor(type,x,y,w,h,dir){
  // ★ v10.4: 모든 shape 앵커를 각 변의 정확한 중앙으로 통일 ★
  // 사용자 요구: "화살표 등 연결 선은 구성의 중앙(가로든 세로든)에 접점을 형성"
  // 원칙: left/right → py = y+h/2 (수직 중앙), top/bottom → px = x+w/2 (수평 중앙)
  // edge 좌표는 shape의 실제 시각적 경계
  
  switch(type){
    case 'cloud':{
      const cy=y+h*0.45; // cloud 수직 중앙은 약간 위
      switch(dir){
        case 'bottom':return{px:x+w/2,   py:y+h*0.82};
        case 'top':   return{px:x+w/2,   py:y+h*0.08};
        case 'left':  return{px:x+w*0.10, py:cy};
        case 'right': return{px:x+w*0.90, py:cy};
      }
      break;
    }
    case 'sensor':{
      // ★ v10.4: 센서 하단 앵커 = 텍스트+참조번호 아래 (겹침 방지) ★
      const cy=y+h/2;
      const cr=Math.min(w*0.28,h*0.38);
      const waveCx=x+w*0.32;
      const waveRight=waveCx+cr*2.65; // 파동호 최외곽
      const leftEdge=waveCx-cr;       // 원 좌측
      const sensorFullBottom=y+h*0.88+42; // 아이콘+라벨+참조번호 전체 하단
      switch(dir){
        case 'bottom':return{px:x+w/2, py:sensorFullBottom};
        case 'top':   return{px:x+w/2, py:y+h*0.12};
        case 'left':  return{px:leftEdge, py:cy};
        case 'right': return{px:Math.min(waveRight, x+w*0.92), py:cy};
      }
      break;
    }
    case 'antenna':{
      const cy=y+h/2;
      switch(dir){
        case 'bottom':return{px:x+w/2, py:y+h*0.92};
        case 'top':   return{px:x+w/2, py:y+h*0.10};
        case 'left':  return{px:x+w*0.16, py:cy};
        case 'right': return{px:x+w*0.70, py:cy};
      }
      break;
    }
    case 'camera':{
      const cy=y+h/2;
      switch(dir){
        case 'bottom':return{px:x+w/2, py:y+h*0.83};
        case 'top':   return{px:x+w/2, py:y+h*0.08};
        case 'left':  return{px:x+w*0.05, py:cy};
        case 'right': return{px:x+w*0.85, py:cy};
      }
      break;
    }
    case 'speaker':{
      const cy=y+h/2;
      switch(dir){
        case 'bottom':return{px:x+w/2, py:y+h*0.92};
        case 'top':   return{px:x+w/2, py:y+h*0.08};
        case 'left':  return{px:x+w*0.10, py:cy};
        case 'right': return{px:x+w*0.55, py:cy};
      }
      break;
    }
    // 사각형 계열: 정확한 변 중앙
    case 'database':
    case 'server':
    case 'document':
    case 'monitor':
    default:{
      switch(dir){
        case 'bottom':return{px:x+w/2, py:y+h};
        case 'top':   return{px:x+w/2, py:y};
        case 'left':  return{px:x,     py:y+h/2};
        case 'right': return{px:x+w,   py:y+h/2};
      }
    }
  }
  return{px:x+w/2,py:y+h}; // fallback
}

// ── Shape natural proportion metrics ──
// ★ v13: 모든 shape를 균일 크기로 정규화 — 아이콘은 장식, 크기는 동일 ★
// 원칙: 어떤 shape도 boxH의 115%를 초과하지 않는다
// 기존: server=boxW*0.85(너비)×sw*0.80(높이) → boxH의 5배 가능 → 심각한 비율 불균형
// v13: 모든 shape의 높이를 boxH 기준 1.0~1.15배로 통일
function _shapeMetrics(type,boxW,boxH){
  const SHAPE_W=boxW*0.80;   // v19: 셀 너비의 80% (기존 65% → Fig 1/Fig 2+ 크기 통일)
  const MAX_SH=boxH*1.15;    // 셀 높이의 최대 115%
  switch(type){
    case 'database':{
      const sw=SHAPE_W*0.80;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.90));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'cloud':{
      const sw=SHAPE_W;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.50));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'server':{
      // v13: 서버 높이를 boxH 기준으로 제한 (기존: sw*0.80 → boxH의 5배 가능)
      const sw=SHAPE_W;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.45));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'monitor':{
      // v13: 모니터 높이를 boxH 기준으로 제한 (기존: sw*0.70 → boxH의 4배 가능)
      const sw=SHAPE_W;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.48));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'sensor':{
      // v13: 센서 크기 정규화 (기존: boxH*1.35×1.70 → 과도한 크기)
      const sw=SHAPE_W*0.85;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.85));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'antenna':{
      const sw=SHAPE_W*0.70;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*1.10));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'document':{
      const sw=SHAPE_W*0.75;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.85));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'camera':{
      const sw=SHAPE_W*0.85;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.75));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    case 'speaker':{
      const sw=SHAPE_W*0.85;
      const sh=Math.min(MAX_SH, Math.max(boxH,sw*0.75));
      return{sw,sh,dx:(boxW-sw)/2};
    }
    default:return{sw:boxW,sh:boxH,dx:0};
  }
}

// v10.3: 텍스트 너비 추정 (한글=폰트크기, 영문=폰트크기*0.6, 공백=폰트크기*0.3)
function _estimateTextWidth(text,fontSize){
  if(!text)return 0;
  let w=0;
  for(let i=0;i<text.length;i++){
    const c=text.charCodeAt(i);
    if(c>=0xAC00&&c<=0xD7AF||c>=0x4E00&&c<=0x9FFF)w+=fontSize; // 한글/한자
    else if(c===32)w+=fontSize*0.3; // 공백
    else w+=fontSize*0.65; // 영문/숫자
  }
  return w;
}

// ★ v10.4: SVG/Canvas 멀티라인 라벨 렌더링 헬퍼 (잘림 완전 제거) ★
function _fitLabelLines(label, maxWidth, baseFontSize, minFontSize){
  // 전체 라벨을 maxWidth 안에 맞추기 위해 폰트 축소 → 줄바꿈 순으로 시도
  // Returns: {lines: string[], fontSize: number}
  if(!label) return {lines:[''],fontSize:baseFontSize};
  const minFS=minFontSize||7;
  
  // 1단계: 폰트 축소만으로 1줄에 맞는지 시도
  let fs=baseFontSize;
  let tw=_estimateTextWidth(label,fs);
  if(tw<=maxWidth) return {lines:[label],fontSize:fs};
  
  // 폰트를 minFS까지 축소해봄
  while(fs>minFS&&tw>maxWidth){fs--;tw=_estimateTextWidth(label,fs);}
  if(tw<=maxWidth) return {lines:[label],fontSize:fs};
  
  // 2단계: 2줄로 분할
  fs=Math.max(baseFontSize-1,minFS);
  const words=label.split(/\s+/);
  
  // 최적 2줄 분할 (양쪽 길이 균형)
  let bestSplit2=_findBestSplit(words,2,fs,maxWidth);
  if(bestSplit2.fits) return {lines:bestSplit2.lines, fontSize:bestSplit2.fontSize};
  
  // 2줄에서 폰트 축소 시도
  for(let tryFs=fs-1;tryFs>=minFS;tryFs--){
    bestSplit2=_findBestSplit(words,2,tryFs,maxWidth);
    if(bestSplit2.fits) return {lines:bestSplit2.lines, fontSize:bestSplit2.fontSize};
  }
  
  // 3단계: 3줄로 분할 (매우 긴 서버명 등)
  fs=Math.max(baseFontSize-1,minFS);
  let bestSplit3=_findBestSplit(words,3,fs,maxWidth);
  if(bestSplit3.fits) return {lines:bestSplit3.lines, fontSize:bestSplit3.fontSize};
  
  // 3줄에서 폰트 축소 시도
  for(let tryFs=fs-1;tryFs>=minFS;tryFs--){
    bestSplit3=_findBestSplit(words,3,tryFs,maxWidth);
    if(bestSplit3.fits) return {lines:bestSplit3.lines, fontSize:bestSplit3.fontSize};
  }
  
  // 4단계: 최소 폰트에서 강제 2줄 분할 (중간점)
  fs=minFS;
  const mid=Math.ceil(label.length/2);
  let splitIdx=label.lastIndexOf(' ',mid);
  if(splitIdx<=0||splitIdx>=label.length-1)splitIdx=mid;
  return {lines:[label.slice(0,splitIdx).trim(),label.slice(splitIdx).trim()],fontSize:fs};
}

// ★ v10.4: 단어 단위 최적 분할 ★
function _findBestSplit(words,numLines,fontSize,maxWidth){
  if(words.length<numLines){
    // 단어 수 < 줄 수 → 글자 단위 분할
    const label=words.join(' ');
    const charsPerLine=Math.ceil(label.length/numLines);
    const lines=[];
    for(let i=0;i<numLines;i++){
      const start=i*charsPerLine;
      const end=Math.min(start+charsPerLine,label.length);
      if(start<label.length)lines.push(label.slice(start,end).trim());
    }
    const maxW=Math.max(...lines.map(l=>_estimateTextWidth(l,fontSize)));
    return{lines:lines.filter(l=>l.length>0), fontSize, fits:maxW<=maxWidth};
  }
  
  // 단어 단위로 줄 수 맞춰 분할 — 각 줄 길이 균형
  if(numLines===2){
    let bestLines=null, bestDiff=Infinity;
    for(let i=1;i<words.length;i++){
      const l1=words.slice(0,i).join(' ');
      const l2=words.slice(i).join(' ');
      const w1=_estimateTextWidth(l1,fontSize);
      const w2=_estimateTextWidth(l2,fontSize);
      const maxW=Math.max(w1,w2);
      const diff=Math.abs(w1-w2);
      if(maxW<=maxWidth&&diff<bestDiff){bestDiff=diff;bestLines=[l1,l2];}
    }
    if(bestLines)return{lines:bestLines, fontSize, fits:true};
    // 못 맞추면 최소 maxW 분할 반환
    let minMaxW=Infinity, fallbackLines=null;
    for(let i=1;i<words.length;i++){
      const l1=words.slice(0,i).join(' ');
      const l2=words.slice(i).join(' ');
      const maxW=Math.max(_estimateTextWidth(l1,fontSize),_estimateTextWidth(l2,fontSize));
      if(maxW<minMaxW){minMaxW=maxW;fallbackLines=[l1,l2];}
    }
    return{lines:fallbackLines||[words.join(' ')], fontSize, fits:false};
  }
  
  if(numLines===3){
    let bestLines=null, bestMaxW=Infinity;
    for(let i=1;i<words.length-1;i++){
      for(let j=i+1;j<words.length;j++){
        const l1=words.slice(0,i).join(' ');
        const l2=words.slice(i,j).join(' ');
        const l3=words.slice(j).join(' ');
        const maxW=Math.max(_estimateTextWidth(l1,fontSize),_estimateTextWidth(l2,fontSize),_estimateTextWidth(l3,fontSize));
        if(maxW<bestMaxW){bestMaxW=maxW;bestLines=[l1,l2,l3];}
      }
    }
    if(bestLines)return{lines:bestLines, fontSize, fits:bestMaxW<=maxWidth};
    return{lines:[words.join(' ')], fontSize, fits:false};
  }
  
  return{lines:[words.join(' ')], fontSize, fits:false};
}

function _svgMultiLineLabel(cx, baseY, label, maxWidth, baseFontSize, options){
  // SVG <text> 요소들 반환 (중앙정렬)
  const opt=options||{};
  const fill=opt.fill||'#000';
  const ff=opt.fontFamily||'맑은 고딕,Arial,sans-serif';
  const minFS=opt.minFontSize||7;
  const {lines,fontSize}=_fitLabelLines(label,maxWidth,baseFontSize,minFS);
  
  let svg='';
  const lineH=fontSize+2;
  // 전체 텍스트 블록의 수직 중앙 맞춤
  const totalH=lines.length*lineH;
  const startY=baseY-(totalH/2)+lineH*0.75; // baseline 보정
  lines.forEach((line,i)=>{
    svg+=`<text x="${cx}" y="${startY+i*lineH}" text-anchor="middle" font-size="${fontSize}" font-family="${ff}" fill="${fill}">${App.escapeHtml(line)}</text>`;
  });
  return {svg,fontSize,lineCount:lines.length};
}

function _canvasMultiLineLabel(ctx, cx, cy, label, maxWidth, baseFontSize, options){
  // Canvas에 멀티라인 텍스트 그리기 (중앙정렬)
  const opt=options||{};
  const fill=opt.fill||'#000000';
  const ff=opt.fontFamily||'"맑은 고딕", sans-serif';
  const minFS=opt.minFontSize||7;
  const {lines,fontSize}=_fitLabelLines(label,maxWidth,baseFontSize,minFS);
  
  ctx.fillStyle=fill;
  ctx.font=`${fontSize}px ${ff}`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  
  if(lines.length===1){
    ctx.fillText(lines[0],cx,cy);
  }else{
    const lineH=fontSize+2;
    const totalH=lines.length*lineH;
    const startY=cy-(totalH/2)+lineH/2;
    lines.forEach((line,i)=>{
      ctx.fillText(line,cx,startY+i*lineH);
    });
  }
  return {fontSize,lineCount:lines.length};
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
  
  // ★ v18: 검증이 안 됐으면 자동 실행 후 에러 수집 ★
  if(!window._diagramErrors||window._diagramErrors.sid!==sid){
    const data=diagramData[sid];
    if(data&&data.length){
      const autoFigNums=getAutoFigNums(sid);
      const designText=outputs[sid]||'';
      const autoErrors=[];
      data.forEach(({nodes,edges},idx)=>{
        const figNum=autoFigNums[idx]||(idx+1);
        const issues=validateDiagramRules(nodes,figNum,designText,edges);
        issues.filter(i=>i.severity==='ERROR'||i.severity==='WARNING').forEach(i=>{
          autoErrors.push(`도 ${figNum}: [${i.rule}] ${i.message}`);
        });
      });
      if(autoErrors.length){
        window._diagramErrors={sid, errors:autoErrors.join('\n')};
      }
    }
  }
  const errors=window._diagramErrors&&window._diagramErrors.sid===sid?window._diagramErrors.errors:'사용자 요청에 의한 재생성';
  const aiReview=window._aiDiagramReview&&window._aiDiagramReview.sid===sid?window._aiDiagramReview.review:'';
  
  // 방법/장치 분기
  const isMethod=stepId==='step_11';
  
  // ★ v15: 에러 유형별 타겟 피드백 생성 ★
  const errStr=typeof errors==='string'?errors:JSON.stringify(errors);
  const hasRefNumErr=/부호|참조번호|계층|L[1-4]|R[1-6]/.test(errStr);
  const hasConnectionErr=/연결|화살표|순환|방향|교차/.test(errStr);
  const hasLayoutErr=/배치|레이아웃|겹침|위치|overlap/i.test(errStr);
  const hasFigCountErr=/도면\s*수|불일치|count/.test(errStr);

  // ★ Bug2 수정: 재생성 시 도면 수가 줄어드는 문제 — 명시적 개수/번호 지시 + 이전 설계 충분히 제공
  let _figCountBlock='';
  if(stepId==='step_07'){
    const _tf=parseInt(document.getElementById('optDeviceFigures')?.value||4);
    const _gc=Math.max(_tf-requiredFigures.length,0);
    const _en=computeFigNums(_gc,0).device;
    _figCountBlock=`\n═══ 도면 수 (절대 준수 — 누락/추가 금지) ═══\n- 정확히 ${_gc}개의 도면을 생성하라: ${_en.map(n=>'도 '+n).join(', ')}\n- 위 번호의 도면을 하나도 빠뜨리지 말고 모두 생성하라. ${_gc}개보다 적게 생성하지 마라.\n`;
  }else if(stepId==='step_11'){
    const _mc=parseInt(document.getElementById('optMethodFigures')?.value||2);
    const _dc=diagramData.step_07?.length||0;
    const _en=computeFigNums(_dc,_mc,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides()).method;
    _figCountBlock=`\n═══ 도면 수 (절대 준수 — 누락/추가 금지) ═══\n- 정확히 ${_mc}개의 방법 도면을 생성하라: ${_en.map(n=>'도 '+n).join(', ')}\n- 위 번호의 도면을 하나도 빠뜨리지 말고 모두 생성하라. ${_mc}개보다 적게 생성하지 마라.\n`;
  }

  // 피드백 프롬프트 생성
  const feedbackPrompt=`이전에 생성한 ${isMethod?'방법':'장치'} 도면 설계에 규칙 위반이 발견되었습니다. 아래 오류를 수정하여 다시 생성하세요.
${_figCountBlock}
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
- ★ 순환 연결(A→B→C→A) 금지 — 데이터 흐름은 단방향이어야 함
- ★ 도 2+: 데이터 흐름의 입력측→처리→출력측 순서로 구성요소를 배치하라
${hasConnectionErr?`
★★ [연결관계 오류 집중 수정 지침] ★★
- 각 구성요소 간 데이터 흐름 방향을 재검토하라
- 양방향 화살표가 있으면 주(主) 데이터 흐름 방향만 남겨라
- 허브 노드(가장 많은 연결)는 중앙에 배치하여 교차를 줄여라
- 구성요소 간 관계가 없으면 화살표를 제거하라 (병렬 배치)`:''}
${hasRefNumErr?`
★★ [참조번호/계층 오류 집중 수정 지침] ★★
- 각 도면의 구성요소 참조번호가 올바른 계층에 있는지 재확인하라
- 도 1은 반드시 L1(100,200,300...) 장치만 포함
- 도 2+는 하나의 상위 장치를 상세화: 상위 L1 → 내부 L2(110,120,...)`:''}
${hasLayoutErr?`
★★ [배치 최적화 지침] ★★
- 연결이 많은 구성요소를 중앙에 배치하라
- 연결된 구성요소끼리 인접하게 배치하라
- 데이터 흐름: 왼쪽→오른쪽 또는 위→아래 방향으로 자연스럽게 배치`:''}

═══ 이전 도면 설계 (오류 포함 — 도면 수는 유지하고 오류만 수정) ═══
${prevDesign.slice(0,8000)}

위 오류를 모두 수정하여 도면 설계를 다시 출력하세요. ★ 도면 개수는 위 "도면 수" 지시를 절대 준수하라.
${isMethod?'방법 흐름도는 시작/종료 노드를 반드시 포함!':'도 1에는 반드시 L1 장치만 포함해야 합니다!'}
${!isMethod?_buildClaimComponentHierarchy(outputs.step_06||''):''}
[장치 청구범위] ${(outputs.step_06||'').slice(0,2000)}`;

  setGlobalProcessing(true);
  const btnEl=document.getElementById(btnId);
  if(btnEl)App.setButtonLoading(btnId,true);
  
  try{
    const r1=await App.callClaude(feedbackPrompt);
    let regenDesign=r1.text;
    
    // ★ Bug2 수정: 재생성 후 도면 수 검증 — 부족 시 1회 재요청(누락 명시), 초과 시 트림 ★
    if(stepId==='step_07'){
      const totalFig=parseInt(document.getElementById('optDeviceFigures')?.value||4);
      const _genCount=Math.max(totalFig-requiredFigures.length,0);
      const _expectedNums=computeFigNums(_genCount,0).device;
      let _actual=_extractFigureNumbersFromDesign(regenDesign);
      if(_actual.length<_genCount){
        const missing=_expectedNums.filter(n=>!_actual.includes(n));
        const reReq=`방금 생성한 도면 설계에 도면이 누락되었습니다(${_actual.length}/${_genCount}개). 반드시 ${_genCount}개 도면(${_expectedNums.map(n=>'도 '+n).join(', ')})을 모두 포함하여 전체 도면 설계를 다시 출력하세요. 누락된 ${missing.map(n=>'도 '+n).join(', ')}을 빠뜨리지 마세요.\n\n[기존 설계]\n${regenDesign.slice(0,8000)}`;
        try{const rr=await App.callClaude(reReq);if(_extractFigureNumbersFromDesign(rr.text).length>_actual.length){regenDesign=rr.text;_actual=_extractFigureNumbersFromDesign(regenDesign);}}catch(e){console.warn('[regenDiagram] 도면 보충 재요청 실패',e);}
      }
      const postIssues=validateDiagramDesignText(regenDesign,_genCount,_expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치')))regenDesign=_trimDesignTextToExpectedFigures(regenDesign,_expectedNums);
      if(_extractFigureNumbersFromDesign(regenDesign).length<_genCount)App.showToast(`⚠ 도면이 ${_genCount}개보다 적게 생성됨 — 다시 시도해 주세요`,'warning');
    }else if(stepId==='step_11'){
      const _methFigCount=parseInt(document.getElementById('optMethodFigures')?.value||2);
      const _devCount=diagramData.step_07?.length||0;
      const _expectedNums=computeFigNums(_devCount,_methFigCount,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides()).method;
      let _actual=_extractFigureNumbersFromDesign(regenDesign);
      if(_actual.length<_methFigCount){
        const missing=_expectedNums.filter(n=>!_actual.includes(n));
        const reReq=`방금 생성한 방법 도면 설계에 도면이 누락되었습니다(${_actual.length}/${_methFigCount}개). 반드시 ${_methFigCount}개 도면(${_expectedNums.map(n=>'도 '+n).join(', ')})을 모두 포함하여 다시 출력하세요. 누락된 ${missing.map(n=>'도 '+n).join(', ')}을 빠뜨리지 마세요.\n\n[기존 설계]\n${regenDesign.slice(0,8000)}`;
        try{const rr=await App.callClaude(reReq);if(_extractFigureNumbersFromDesign(rr.text).length>_actual.length){regenDesign=rr.text;_actual=_extractFigureNumbersFromDesign(regenDesign);}}catch(e){console.warn('[regenDiagram] 방법도면 보충 재요청 실패',e);}
      }
      const postIssues=validateDiagramDesignText(regenDesign,_methFigCount,_expectedNums);
      if(postIssues.some(i=>i.severity==='ERROR'&&i.message.includes('도면 수 불일치')))regenDesign=_trimDesignTextToExpectedFigures(regenDesign,_expectedNums);
    }
    
    pushOutputHistory(stepId,'llm','regenerateDiagramWithFeedback');
    outputs[stepId]=regenDesign;
    const resEl=document.getElementById(stepId==='step_07'?'resStep07':'resStep11');
    if(resEl)resEl.value=regenDesign;
    saveProject(true);
    
    // Mermaid 변환
    const mermaidPrompt=buildMermaidPrompt(stepId);
    const r2=await App.callClaude(mermaidPrompt);
    pushOutputHistory(stepId+'_mermaid','llm','regenerateDiagramWithFeedback.mermaid');
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
function validateDiagramDesignText(text,expectedCount,expectedNums){
  const issues=[];
  
  // 1. 도면 수 검증 — 설계 텍스트에서 실제 도면 수 추출
  const figHeaders=(text.match(/^도\s*(\d+)\s*[:：]/gm)||[]);
  const actualFigNums=figHeaders.map(h=>parseInt(h.match(/\d+/)[0]));
  const uniqueFigNums=[...new Set(actualFigNums)].sort((a,b)=>a-b);
  
  if(expectedCount&&uniqueFigNums.length!==expectedCount){
    issues.push({
      severity:'ERROR',
      message:`도면 수 불일치: 설계 ${uniqueFigNums.length}개 (${uniqueFigNums.map(n=>'도 '+n).join(', ')}) ≠ 예상 ${expectedCount}개${expectedNums?' ('+expectedNums.map(n=>'도 '+n).join(', ')+')':''}`
    });
  }
  
  // 2. 도면 번호 검증 — 예상 번호와 일치하는지
  if(expectedNums&&expectedNums.length>0){
    const missing=expectedNums.filter(n=>!uniqueFigNums.includes(n));
    const extra=uniqueFigNums.filter(n=>!expectedNums.includes(n));
    if(missing.length>0){
      issues.push({
        severity:'ERROR',
        message:`누락된 도면: ${missing.map(n=>'도 '+n).join(', ')}. 이 도면 번호를 반드시 포함하라.`
      });
    }
    if(extra.length>0){
      issues.push({
        severity:'ERROR',
        message:`초과 생성된 도면: ${extra.map(n=>'도 '+n).join(', ')}. 예상 도면(${expectedNums.map(n=>'도 '+n).join(', ')})만 생성하라.`
      });
    }
  }
  
  // 3. 도면별 검증
  const figPattern=/도\s*(\d+)\s*[:：]\s*(.*?)(?=\n도\s*\d+\s*[:：]|---BRIEF|$)/gs;
  let match;
  
  while((match=figPattern.exec(text))!==null){
    const figNum=parseInt(match[1]);
    const content=match[2];
    
    // 참조번호 추출
    const refs=(content.match(/\((\d+)\)/g)||[]).map(r=>parseInt(r.replace(/[()]/g,'')));
    
    if(figNum===1||(expectedNums&&expectedNums[0]===figNum)){
      // 도 1 (또는 첫 번째 도면) 검증: L1만 허용
      const nonL1=refs.filter(r=>r%100!==0);
      if(nonL1.length>0){
        issues.push({
          severity:'ERROR',
          message:`도 ${figNum} (시스템 구성도)에 L2/L3 참조번호 포함: ${nonL1.join(', ')}. 도 ${figNum}은 L1(X00)만 허용.`
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
    
    // 도 2+ 내부 구성요소 최소 3개 검증
    if(figNum>1||(!expectedNums||expectedNums[0]!==figNum)){
      const innerRefs=refs.filter(r=>r%100!==0);
      if(innerRefs.length>0&&innerRefs.length<3){
        issues.push({
          severity:'WARNING',
          message:`도 ${figNum} 내부 구성요소 ${innerRefs.length}개(최소 3개 권장). 청구항에서 추가 구성요소를 포함하거나 기능 분리를 고려하라.`
        });
      }
    }
  }
  
  // 4. BRIEF_DESCRIPTIONS 존재 검증
  if(!text.includes('---BRIEF_DESCRIPTIONS---')){
    issues.push({
      severity:'WARNING',
      message:'도면의 간단한 설명(---BRIEF_DESCRIPTIONS---) 섹션이 누락됨.'
    });
  }
  
  // 5. ★ 청구항 ↔ 도면 구성요소 교차검증 ★
  const claimText=outputs.step_06||'';
  if(claimText){
    const claimComps=_extractStructuredComponents(claimText);
    const designComps=_extractStructuredComponents(text);
    
    if(claimComps.length>0&&designComps.length>0){
      // 5a. 청구항에 있는데 도면에 없는 구성요소 (참조번호 기준)
      const designRefNums=new Set(designComps.map(c=>c.refNum));
      const missingInDesign=claimComps.filter(c=>!designRefNums.has(c.refNum)&&c.refNum%100!==0);
      // L1(X00)은 도 1에 이미 있으므로 제외, L2/L3만 체크
      if(missingInDesign.length>0){
        issues.push({
          severity:'WARNING',
          message:`청구항 구성요소 중 도면에 누락: ${missingInDesign.map(c=>c.name+'('+c.refNum+')').join(', ')}. 도면에 반영 필요.`
        });
      }
      
      // 5b. 도면에 있는데 청구항에 없는 구성요소 (L2/L3, 도 1 외부장치 제외)
      const claimRefNums=new Set(claimComps.map(c=>c.refNum));
      const extraInDesign=designComps.filter(c=>!claimRefNums.has(c.refNum)&&c.refNum%100!==0);
      if(extraInDesign.length>0){
        // L1 외부장치(200,300,400)는 도 1에서 허용되므로 제외
        const trueExtras=extraInDesign.filter(c=>!(c.refNum>=200&&c.refNum%100===0));
        if(trueExtras.length>0){
          issues.push({
            severity:'WARNING',
            message:`도면에 청구항에 없는 구성요소: ${trueExtras.map(c=>c.name+'('+c.refNum+')').join(', ')}. 청구항과 일치시킬 것.`
          });
        }
      }
      
      // 5c. 참조번호는 같은데 이름이 다른 구성요소
      const claimMap=new Map(claimComps.map(c=>[c.refNum,c.name]));
      const nameMismatches=[];
      for(const dc of designComps){
        const claimName=claimMap.get(dc.refNum);
        if(claimName&&claimName!==dc.name){
          // 이름이 완전히 다른 경우만 (부분 포함 제외)
          if(!claimName.includes(dc.name)&&!dc.name.includes(claimName)){
            nameMismatches.push({refNum:dc.refNum,claim:claimName,design:dc.name});
          }
        }
      }
      if(nameMismatches.length>0){
        issues.push({
          severity:'ERROR',
          message:`구성요소 명칭 불일치: ${nameMismatches.map(m=>`(${m.refNum}) 청구항="${m.claim}" ≠ 도면="${m.design}"`).join(', ')}. 청구항 명칭을 사용하라.`
        });
      }
    }
  }
  
  return issues;
}

// ★ 구조적 구성요소 추출 (청구항/도면 텍스트 공용) ★
function _extractStructuredComponents(text){
  if(!text)return [];
  const comps=[];
  const seen=new Set();
  const re=/([가-힣A-Za-z]*(?:부|모듈|유닛|서버|장치|단말|센서|프로세서|메모리|인터페이스|엔진|매니저|시스템|플랫폼|컨트롤러|네트워크|데이터베이스|스토리지|게이트웨이))\s*\((\d{2,4})\)/g;
  let m;
  while((m=re.exec(text))!==null){
    const name=m[1].trim();
    const refNum=parseInt(m[2]);
    const key=`${name}_${refNum}`;
    if(!seen.has(key)){
      seen.add(key);
      comps.push({name,refNum});
    }
  }
  return comps;
}

// ═══════════ UNIFIED DIAGRAM ENGINE ═══════════

// ═══════════════════════════════════════════════════════════════
// ★★★ v14: 도면 JSON 아키텍처 (Option B) ★★★
// LLM이 JSON 좌표 직접 출력 → 경량 렌더러가 SVG+PPTX 생성
// 파싱 실패 시 기존 Mermaid 파이프라인으로 자동 폴백
// ═══════════════════════════════════════════════════════════════

function parseDesignJSON(responseText){
  const jsonMatch=responseText.match(/```json\n([\s\S]*?)```/);
  if(!jsonMatch)return{success:false,fallback:'mermaid',error:'JSON block not found'};
  try{
    const parsed=JSON.parse(jsonMatch[1]);
    const figures=parsed.figures||[parsed];
    if(!figures.length)return{success:false,fallback:'mermaid',error:'empty figures'};
    const PW=8.27,PH=11.69,M=0.6;
    for(const fig of figures){
      if(!fig.blocks||!Array.isArray(fig.blocks))return{success:false,fallback:'mermaid',error:'no blocks'};
      for(const b of fig.blocks){
        if(typeof b.x!=='number')b.x=M; if(typeof b.y!=='number')b.y=M;
        if(typeof b.w!=='number')b.w=1.8; if(typeof b.h!=='number')b.h=0.7;
        b.x=Math.max(M,Math.min(b.x,PW-b.w-M));
        b.y=Math.max(M,Math.min(b.y,PH-b.h-M));
      }
      fig.blocks=_autoCorrectOverlaps(fig.blocks);
      if(!fig.connections)fig.connections=[];
      fig.connections.forEach(c=>{
        if(!c.route||!c.route.length){
          const fb=fig.blocks.find(bl=>bl.id===c.from),tb=fig.blocks.find(bl=>bl.id===c.to);
          if(fb&&tb)c.route=_autoRouteJSON(fb,tb);
        }
        if(!c.arrow)c.arrow='end';
      });
    }
    return{success:true,data:{figures}};
  }catch(e){return{success:false,fallback:'mermaid',error:e.message};}
}

function _autoCorrectOverlaps(blocks){
  const PAD=0.15;
  for(let iter=0;iter<10;iter++){
    let any=false;
    for(let i=0;i<blocks.length;i++){
      for(let j=i+1;j<blocks.length;j++){
        const a=blocks[i],b=blocks[j];
        if(a.x<b.x+b.w+PAD&&a.x+a.w+PAD>b.x&&a.y<b.y+b.h+PAD&&a.y+a.h+PAD>b.y){
          const dx=(a.x+a.w+PAD)-b.x,dy=(a.y+a.h+PAD)-b.y;
          if(Math.abs(dx)<Math.abs(dy))b.x+=dx+0.1; else b.y+=dy+0.1;
          any=true;
        }
      }
    }
    if(!any)break;
  }
  return blocks;
}

function _autoRouteJSON(fb,tb){
  const fcx=fb.x+fb.w/2,fcy=fb.y+fb.h/2,tcx=tb.x+tb.w/2,tcy=tb.y+tb.h/2;
  const dx=tcx-fcx,dy=tcy-fcy,isH=Math.abs(dx)>=Math.abs(dy);
  let s,e;
  if(isH){s={x:dx>0?fb.x+fb.w:fb.x,y:fcy};e={x:dx>0?tb.x:tb.x+tb.w,y:tcy};}
  else{s={x:fcx,y:dy>0?fb.y+fb.h:fb.y};e={x:tcx,y:dy>0?tb.y:tb.y+tb.h};}
  if(Math.abs(s.x-e.x)<0.05||Math.abs(s.y-e.y)<0.05)return[s,e];
  if(isH){const m=(s.x+e.x)/2;return[s,{x:m,y:s.y},{x:m,y:e.y},e];}
  else{const m=(s.y+e.y)/2;return[s,{x:s.x,y:m},{x:e.x,y:m},e];}
}

function renderDiagramFromJSON(containerId,figData,figNum){
  const PX=72,PW=(figData.pageSize?.w||8.27)*PX,PH=(figData.pageSize?.h||11.69)*PX;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" style="background:#fff;border:1px solid #ddd;max-width:100%;height:auto">`;
  svg+=`<text x="${PW/2}" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">【도 ${figNum}】</text>`;
  if(figData.frame){const f=figData.frame;svg+=`<rect x="${f.x*PX}" y="${f.y*PX}" width="${f.w*PX}" height="${f.h*PX}" fill="none" stroke="#000" stroke-width="2" rx="4"/>`;svg+=`<text x="${(f.x+f.w/2)*PX}" y="${(f.y-0.08)*PX}" text-anchor="middle" font-size="12" fill="#000">${f.label||''}</text>`;}
  (figData.connections||[]).forEach(conn=>{if(!conn.route||conn.route.length<2)return;const pts=conn.route.map(p=>`${p.x*PX},${p.y*PX}`).join(' ');const mid=`arr_${figNum}_${conn.from}_${conn.to}`;svg+=`<defs><marker id="${mid}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#000"/></marker></defs>`;let ma='';if(conn.arrow==='end'||conn.arrow==='both')ma+=` marker-end="url(#${mid})"`;if(conn.arrow==='start'||conn.arrow==='both')ma+=` marker-start="url(#${mid})"`;svg+=`<polyline points="${pts}" fill="none" stroke="#000" stroke-width="1.2"${ma}/>`; });
  (figData.blocks||[]).forEach(block=>{const bx=block.x*PX,by=block.y*PX,bw=block.w*PX,bh=block.h*PX;if(block.shape==='diamond'){const cx=bx+bw/2,cy=by+bh/2;svg+=`<polygon points="${cx},${by} ${bx+bw},${cy} ${cx},${by+bh} ${bx},${cy}" fill="#fff" stroke="#000" stroke-width="1.5"/>`;}else if(block.shape==='stadium'){svg+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh/2}" fill="#fff" stroke="#000" stroke-width="1.5"/>`;}else{svg+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#fff" stroke="#000" stroke-width="1.5" rx="3"/>`;}const label=block.label||'';const fs=Math.min(12,Math.max(8,(bw-10)/Math.max(label.length,1)*1.5));svg+=`<text x="${bx+bw/2}" y="${by+bh/2+4}" text-anchor="middle" font-size="${fs}" fill="#000">${label}</text>`;if(block.refNum){let rl=block.refLeader;const pos=block.refNumPos||'right';if(!rl){if(pos==='right')rl={startX:block.x+block.w,startY:block.y+block.h/2,endX:block.x+block.w+0.4,endY:block.y+block.h/2};else if(pos==='left')rl={startX:block.x,startY:block.y+block.h/2,endX:block.x-0.4,endY:block.y+block.h/2};else if(pos==='top')rl={startX:block.x+block.w/2,startY:block.y,endX:block.x+block.w/2,endY:block.y-0.3};else rl={startX:block.x+block.w/2,startY:block.y+block.h,endX:block.x+block.w/2,endY:block.y+block.h+0.3};}svg+=`<line x1="${rl.startX*PX}" y1="${rl.startY*PX}" x2="${rl.endX*PX}" y2="${rl.endY*PX}" stroke="#000" stroke-width="0.8"/>`;const anc=pos==='left'?'end':'start';const rdx=pos==='left'?-4:4;svg+=`<text x="${rl.endX*PX+rdx}" y="${rl.endY*PX+4}" text-anchor="${anc}" font-size="${REF_NUM_FONT_SIZE}" fill="#000">${block.refNum}</text>`;}});
  svg+=`</svg>`;
  const el=document.getElementById(containerId);if(el)el.innerHTML+=`<div style="margin:12px 0">${svg}</div>`;
  return svg;
}

function generatePptxFromJSON(figDataArray,fileName){
  if(typeof PptxGenJS==='undefined'){App.showToast('PPTX 라이브러리 로드 안됨','error');return;}
  const pptx=new PptxGenJS();pptx.defineLayout({name:'A4P',width:8.27,height:11.69});pptx.layout='A4P';
  figDataArray.forEach((fig,idx)=>{
    const slide=pptx.addSlide();const fn=fig.figNum||(idx+1);
    slide.addText('【도 '+fn+'】',{x:0.5,y:0.2,w:7.27,h:0.4,fontSize:14,bold:true,align:'center',fontFace:'맑은 고딕'});
    if(fig.frame){const f=fig.frame;slide.addShape(pptx.shapes.ROUNDED_RECTANGLE,{x:f.x,y:f.y,w:f.w,h:f.h,fill:{color:'FFFFFF'},line:{color:'000000',width:2},rectRadius:0.05});slide.addText(f.label||'',{x:f.x,y:f.y-0.25,w:f.w,h:0.25,fontSize:11,align:'center',fontFace:'맑은 고딕'});}
    (fig.connections||[]).forEach(conn=>{if(!conn.route||conn.route.length<2)return;for(let ri=0;ri<conn.route.length-1;ri++){const p1=conn.route[ri],p2=conn.route[ri+1];const lo={color:'000000',width:1.0};if(ri===conn.route.length-2&&(conn.arrow==='end'||conn.arrow==='both'))lo.endArrowType='triangle';if(ri===0&&(conn.arrow==='start'||conn.arrow==='both'))lo.beginArrowType='triangle';slide.addShape(pptx.shapes.LINE,{x:Math.min(p1.x,p2.x),y:Math.min(p1.y,p2.y),w:Math.max(0.001,Math.abs(p2.x-p1.x)||0.001),h:Math.max(0.001,Math.abs(p2.y-p1.y)||0.001),line:lo});}});
    (fig.blocks||[]).forEach(block=>{const st=block.shape==='diamond'?pptx.shapes.DIAMOND:block.shape==='circle'?pptx.shapes.OVAL:pptx.shapes.ROUNDED_RECTANGLE;slide.addShape(st,{x:block.x,y:block.y,w:block.w,h:block.h,fill:{color:'FFFFFF'},line:{color:'000000',width:1.5},rectRadius:block.shape==='stadium'?0.35:0.05});slide.addText(block.label||'',{x:block.x+0.04,y:block.y,w:block.w-0.08,h:block.h,fontSize:Math.min(11,Math.max(7,block.w*5)),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});if(block.refNum){let rl=block.refLeader;const pos=block.refNumPos||'right';if(!rl){if(pos==='right')rl={startX:block.x+block.w,startY:block.y+block.h/2,endX:block.x+block.w+0.35,endY:block.y+block.h/2};else if(pos==='left')rl={startX:block.x,startY:block.y+block.h/2,endX:block.x-0.35,endY:block.y+block.h/2};else if(pos==='top')rl={startX:block.x+block.w/2,startY:block.y,endX:block.x+block.w/2,endY:block.y-0.25};else rl={startX:block.x+block.w/2,startY:block.y+block.h,endX:block.x+block.w/2,endY:block.y+block.h+0.25};}slide.addShape(pptx.shapes.LINE,{x:Math.min(rl.startX,rl.endX),y:Math.min(rl.startY,rl.endY),w:Math.max(0.001,Math.abs(rl.endX-rl.startX)||0.001),h:Math.max(0.001,Math.abs(rl.endY-rl.startY)||0.001),line:{color:'000000',width:0.75}});slide.addText(block.refNum,{x:pos==='left'?rl.endX-0.4:rl.endX,y:rl.endY-0.12,w:0.5,h:0.24,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:pos==='left'?'right':'left'});}});
  });
  pptx.writeFile({fileName:fileName||'patent_diagram_v14.pptx'});App.showToast('PPTX 다운로드 완료');
}

function renderDiagramsV14(sid,responseText){
  const cid=sid==='step_07'?'diagramsStep07':'diagramsStep11';
  const el=document.getElementById(cid);if(el)el.innerHTML='';
  const jr=parseDesignJSON(responseText);
  if(jr.success){
    console.log('[v14] JSON 도면 렌더링');
    const figs=jr.data.figures;
    diagramData[sid]=figs.map(f=>({_version:2,json:f}));
    const autoNums=getAutoFigNums(sid);
    figs.forEach((fig,i)=>renderDiagramFromJSON(cid,fig,fig.figNum||autoNums[i]||(i+1)));
    const dl=document.getElementById(sid==='step_07'?'diagramDownload07':'diagramDownload11');if(dl)dl.style.display='block';
    return true;
  }
  console.warn('[v14] JSON 실패:',jr.error,'<span class="ico" data-icon="arrow-right"></span> Mermaid 폴백');
  renderDiagrams(sid,responseText);
  return false;
}

function downloadPptxV14(sid){
  const data=diagramData[sid];
  if(data&&data.length&&data[0]._version===2){
    generatePptxFromJSON(data.map(d=>d.json),sid==='step_07'?'장치도면.pptx':'방법도면.pptx');
    return;
  }
  downloadPptx(sid);
}

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
    // [C2-1] subgraph 부모 컨테이너 노드 생성
    if(l.startsWith('subgraph')){
      const sgm=l.match(/^subgraph\s+(\w+)(?:\s*\[["']?(.+?)["']?\])?/);
      if(sgm){const[,id,label]=sgm;if(!nodes[id])nodes[id]={id,label:(label||id).trim(),shape:'container',isContainer:true};}
      return;
    }
    
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
  
  // 연결선 추출 (v15: 인라인 라벨/체인 대응 토큰 파서)
  // 기존 정규식은 화살표 왼쪽이 \w로 끝나야 매칭되어, A["라벨"] --> B["라벨"] 처럼
  // 노드가 인라인 라벨을 가지면 엣지를 통째로 누락했다. 또한 A --> B --> C 체인도
  // 첫 엣지만 잡혔다. → 인라인 라벨/클래스지정을 제거한 골격에서 토큰 단위로 파싱.
  code.split('\n').forEach(line=>{
    const l=line.trim();
    if(!l||l.startsWith('graph')||l.startsWith('flowchart')||l==='end'||l.startsWith('style')||l.startsWith('linkStyle')||l.startsWith('classDef')||l.startsWith('subgraph'))return;
    // 노드 인라인 라벨(([..]),((..)),[/../],[..],{..},(..)) 및 클래스지정(:::) 제거 → "id 화살표 id" 골격만 남김
    const skel=l.replace(/\(\[[\s\S]*?\]\)|\(\([\s\S]*?\)\)|\[\/[\s\S]*?\/\]|\[[\s\S]*?\]|\{[\s\S]*?\}|\([\s\S]*?\)/g,' ').replace(/:::\w+/g,' ');
    // 토큰: 화살표(<--> 우선) | 엣지라벨(|..|) | 노드ID
    const toks=skel.match(/<-->|-->|---|\|[^|]*\||\w+/g);
    if(!toks)return;
    let prevId=null,arrow=null,elabel='';
    for(const t of toks){
      if(t==='-->'||t==='<-->'||t==='---'){arrow=t;elabel='';}
      else if(t[0]==='|'){elabel=t.slice(1,-1).trim();}
      else{ // 노드 ID
        if(prevId&&arrow){
          if(!nodes[prevId])nodes[prevId]={id:prevId,label:prevId};
          if(!nodes[t])nodes[t]={id:t,label:t};
          edges.push({from:prevId,to:t,label:elabel||'',bidirectional:arrow==='<-->'});
        }
        prevId=t;arrow=null;elabel='';
      }
    }
  });
  
  // ═══ v9.0: 참조번호 중복 노드 정리 (외부/중복 노드 제거) ═══
  const refMap={}; // refNum → [nodeId, ...]
  Object.values(nodes).forEach(nd=>{
    const ref=_extractRefNum(nd.label,'');
    if(ref&&!/^S/i.test(ref)){
      if(!refMap[ref])refMap[ref]=[];
      refMap[ref].push(nd.id);
    }
  });
  
  // 중복 참조번호가 있는 경우 처리
  Object.entries(refMap).forEach(([ref,ids])=>{
    if(ids.length<=1)return;
    // "외부" 또는 연결 대상이 아닌 노드를 제거 대상으로
    const toRemove=[];
    ids.forEach(id=>{
      const nd=nodes[id];
      const label=nd.label.replace(/[\s(]\d+[)\s]*$/,'').trim();
      // "외부", "외부 서버", "외부 시스템", "외부 장치" 등
      if(/^외부/.test(label)){
        toRemove.push(id);
      }
    });
    // 모두 제거 대상이면 첫 번째만 남김
    if(toRemove.length===ids.length)toRemove.shift();
    toRemove.forEach(id=>{
      // 이 노드에 연결된 엣지를 원본 노드로 리다이렉트
      const origId=ids.find(i=>!toRemove.includes(i));
      if(origId){
        edges.forEach(e=>{
          if(e.from===id)e.from=origId;
          if(e.to===id)e.to=origId;
        });
      }
      const removedLabel=nodes[id]?.label||id;
      delete nodes[id];
      console.warn(`[v9.0] 중복 참조번호(${ref}) 노드 제거: "${removedLabel}" → 원본 "${nodes[origId]?.label||origId}"로 리다이렉트`);
    });
  });
  
  // 자기 자신을 참조하는 엣지 제거 (리다이렉트 후 발생 가능)
  const cleanEdges=edges.filter(e=>e.from!==e.to);
  // 중복 엣지 제거
  const edgeSet=new Set();
  const uniqueEdges=cleanEdges.filter(e=>{
    const key=e.from+'→'+e.to;
    const keyRev=e.to+'→'+e.from;
    if(edgeSet.has(key)||edgeSet.has(keyRev))return false;
    edgeSet.add(key);
    return true;
  });
  
  const result={nodes:Object.values(nodes),edges:uniqueEdges};
  return result;
}
function layoutGraph(nodes,edges){
  // [C2-2] container 노드 분리 — 일반 레이아웃에서 제외 후 bounding box로 확장
  const containers=nodes.filter(n=>n.isContainer);
  const regular=nodes.filter(n=>!n.isContainer);
  const layoutNodes=regular.length>0?regular:nodes;

  const adj={};edges.forEach(e=>{if(!adj[e.from])adj[e.from]=[];adj[e.from].push(e.to);});
  const targets=new Set(edges.map(e=>e.to));const roots=layoutNodes.filter(n=>!targets.has(n.id));
  if(!roots.length&&layoutNodes.length)roots.push(layoutNodes[0]);
  const levels={},visited=new Set();const queue=roots.map(r=>({id:r.id,level:0}));
  while(queue.length){const{id,level}=queue.shift();if(visited.has(id))continue;visited.add(id);levels[id]=level;(adj[id]||[]).forEach(tid=>{if(!visited.has(tid))queue.push({id:tid,level:level+1});});}
  layoutNodes.forEach(n=>{if(!(n.id in levels))levels[n.id]=0;});
  const groups={};layoutNodes.forEach(n=>{const lv=levels[n.id];if(!groups[lv])groups[lv]=[];groups[lv].push(n);});
  const NW=2.5,NH=0.65,HG=0.8,VG=1.2,SW=13.33,startY=0.7;const positions={};
  Object.entries(groups).forEach(([lv,grp])=>{const totalW=grp.length*NW+(grp.length-1)*HG;const sx=(SW-totalW)/2;grp.forEach((node,i)=>{const x=sx+i*(NW+HG),y=startY+parseInt(lv)*(NH+VG);positions[node.id]={x,y,w:NW,h:NH,cx:x+NW/2,cy:y+NH/2};});});

  // [C2-2] container → 자식 노드의 bounding box + padding
  const CPD=0.4,CLH=0.3;
  containers.forEach(cn=>{
    const cRef=parseInt((_extractRefNum(cn.label,'')||'').replace(/\D/g,''));
    const children=regular.filter(n=>{
      const nRef=parseInt((_extractRefNum(n.label,'')||'').replace(/\D/g,''));
      if(isNaN(cRef)||isNaN(nRef))return true;
      return Math.floor(nRef/100)===Math.floor(cRef/100)&&nRef!==cRef;
    });
    const childPos=children.map(c=>positions[c.id]).filter(Boolean);
    if(childPos.length===0){
      positions[cn.id]={x:0,y:startY,w:NW,h:NH,cx:NW/2,cy:startY+NH/2};
      return;
    }
    let minX=Infinity,minY=Infinity,maxR=-Infinity,maxB=-Infinity;
    childPos.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxR=Math.max(maxR,p.x+p.w);maxB=Math.max(maxB,p.y+p.h);});
    const w=(maxR-minX)+CPD*2,h=(maxB-minY)+CPD*2+CLH;
    const x=minX-CPD,y=minY-CPD-CLH;
    positions[cn.id]={x,y,w,h,cx:x+w/2,cy:y+h/2};
  });
  return positions;
}
function computeEdgeRoutes(edges,positions){
  return edges.map((e,ei)=>{const fp=positions[e.from],tp=positions[e.to];if(!fp||!tp)return null;const sx=fp.cx,sy=fp.y+fp.h,tx=tp.cx,ty=tp.y;const segments=[];let labelPos=null;
    if(Math.abs(sx-tx)<0.05){segments.push({type:'line',x1:sx,y1:sy,x2:tx,y2:ty,arrow:true});if(e.label)labelPos={x:sx+0.15,y:(sy+ty)/2-0.12};}
    else{const baseM=(sy+ty)/2,offset=(ei%3-1)*0.12,midY=baseM+offset;segments.push({type:'line',x1:sx,y1:sy,x2:sx,y2:midY,arrow:false});segments.push({type:'line',x1:sx,y1:midY,x2:tx,y2:midY,arrow:false});segments.push({type:'line',x1:tx,y1:midY,x2:tx,y2:ty,arrow:true});if(e.label)labelPos={x:Math.max(sx,tx)+0.15,y:midY-0.12};}
    return{segments,label:e.label,labelPos};
  }).filter(Boolean);
}

// ═══ 2D Layout Engine v4.0: Hub-Centered + 제약 기반 배치 ═══
// 원칙 1: 허브는 반드시 중앙 열
// 원칙 2: 허브 이웃은 허브와 같은 행 또는 같은 열
// 원칙 3: 고립 노드는 별도 행 (다른 노드 자리 침범 금지)
// 원칙 4: 행 너비 통일 (null 슬롯으로 균형)

// [C2-9] shapeicon 판별 (layout 단계에서 사용)
// 파형/전파 등 수직 공간을 추가로 점유하는 shape을 박스형과 분리 배치하기 위함
function _isShapeiconLabel(label){
  const t=matchIconShape(label||'');
  return t==='sensor'||t==='antenna'||t==='camera'||t==='speaker';
}

// [C2-9] Fig 1 전용 shapeicon 인식 배치
// 허브+자식 토폴로지에서 shapeicon을 박스와 다른 행에 분리하여
// 꺾임 최소화 + 화살표-shape 겹침 방지. figNum===1에서만 동작.
// 반환: null(폴백) 또는 {grid, maxCols, numRows, uniqueEdges, layers, biDirPairs}
function _tryC29ShapeAwareLayout(nodes, adj, uniqueEdges, biDirPairs, n){
  // 허브 판별: maxDeg >= 2
  const degs={};
  nodes.forEach(nd=>{degs[nd.id]=(adj[nd.id]||new Set()).size;});
  const degVals=Object.values(degs);
  const maxDeg=degVals.length>0?Math.max(...degVals):0;
  if(maxDeg<2)return null;

  const refNum=id=>{
    const nd=nodes.find(x=>x.id===id);
    return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;
  };
  const hubCands=nodes.filter(nd=>degs[nd.id]===maxDeg);
  const hub=hubCands.slice().sort((a,b)=>refNum(a.id)-refNum(b.id))[0];
  const childIds=[...(adj[hub.id]||new Set())];

  // 완전 허브형(고립 노드 없음, 자식 2~4개)만 처리
  if(childIds.length!==n-1)return null;
  if(childIds.length<2||childIds.length>4)return null;

  const childNodes=childIds.map(id=>nodes.find(x=>x.id===id)).filter(Boolean);
  const boxChildren=childNodes.filter(nd=>!_isShapeiconLabel(nd.label))
    .sort((a,b)=>refNum(a.id)-refNum(b.id));
  const iconChildren=childNodes.filter(nd=>_isShapeiconLabel(nd.label))
    .sort((a,b)=>refNum(a.id)-refNum(b.id));

  let layers;
  let strategy;

  if(iconChildren.length===0){
    // HUB_HORIZONTAL: 박스만, 허브 중앙, 1행
    strategy='HUB_HORIZONTAL';
    const total=1+boxChildren.length;
    const hubCol=Math.floor(total/2);
    const row=[];
    let bi=0;
    for(let i=0;i<total;i++){
      if(i===hubCol)row.push(hub.id);
      else row.push(boxChildren[bi++].id);
    }
    layers=[row];
  }else if(boxChildren.length===0){
    // ICON_VERTICAL: 아이콘만, 수직 1열
    strategy='ICON_VERTICAL';
    layers=[[hub.id], ...iconChildren.map(ic=>[ic.id])];
  }else{
    // HYBRID: 상단 [박스들 + 허브], 하단 [아이콘들 수직, 허브 col 정렬]
    strategy='HYBRID';
    const topWidth=1+boxChildren.length;
    const hubCol=Math.floor(topWidth/2);
    const topRow=[];
    let bi=0;
    for(let i=0;i<topWidth;i++){
      if(i===hubCol)topRow.push(hub.id);
      else topRow.push(boxChildren[bi++].id);
    }
    const iconLayers=iconChildren.map(ic=>{
      const r=new Array(topWidth).fill(null);
      r[hubCol]=ic.id;
      return r;
    });
    layers=[topRow, ...iconLayers];
  }

  // layers → grid 생성 (null 슬롯은 col 인덱스 유지하며 스킵)
  const grid={};
  let maxCols=1;
  layers.forEach((layer,ri)=>{
    maxCols=Math.max(maxCols,layer.length);
    layer.forEach((id,ci)=>{
      if(id===null)return;
      grid[id]={row:ri,col:ci,layerSize:layer.length};
    });
  });

  console.log(`[Layout C2-9] figNum=1 n=${n} strategy=${strategy} hub=${hub.id} boxes=${boxChildren.length} icons=${iconChildren.length} rows=${layers.length} maxCols=${maxCols}`);

  return{grid, maxCols, numRows:layers.length, uniqueEdges, layers, biDirPairs};
}

function computeDeviceLayout2D(nodes,edges,figNum){
  const n=nodes.length;
  console.log(`[Layout] input: n=${n}, edges=${edges.length}, figNum=${figNum}`);
  console.log(`[Layout] nodes:`,nodes.map(nd=>nd.id+':'+nd.label.slice(0,20)));
  console.log(`[Layout] edges:`,edges.map(e=>e.from+'→'+e.to));
  if(n===0)return{grid:{},maxCols:1,numRows:0,uniqueEdges:[],biDirPairs:[]};
  if(n===1)return{grid:{[nodes[0].id]:{row:0,col:0,layerSize:1}},maxCols:1,numRows:1,uniqueEdges:[],biDirPairs:[]};
  const MAX_COLS=3;
  figNum=figNum||1;
  // ★ P2-FIX: self-loop 제거 (동일 노드 연결은 도면에 표현 불가) ★
  edges=edges.filter(e=>e.from!==e.to);
  
  // ═══ v15 FIX-B: 양방향 edge 단방향화 전처리 ═══
  // A-->B와 B-->A가 동시에 있으면 참조번호 작은 쪽→큰 쪽으로 정규화
  // → 가짜 순환 제거 → TOPOLOGICAL 전략 정상 적용
  const _nodeRefNum=id=>{
    const nd=nodes.find(n=>n.id===id);
    return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;
  };
  const edgePairSet=new Set();
  const deduplicatedEdges=[];
  const biDirPairs=[]; // ★ FIX-3: 양방향 엣지 쌍 추적 ★
  edges.forEach(e=>{
    const k1=e.from+'|'+e.to, k2=e.to+'|'+e.from;
    if(edgePairSet.has(k2)){
      // 역방향이 이미 등록됨 → 중복 양방향 제거
      // ★ FIX-3: 양방향 쌍 기록 (참조번호 작은 쪽 → 큰 쪽) ★
      const[k2f,k2t]=k2.split('|');
      biDirPairs.push(_nodeRefNum(k2f)<=_nodeRefNum(k2t)?{a:k2f,b:k2t}:{a:k2t,b:k2f});
      return;
    }
    edgePairSet.add(k1);
    // 참조번호 기준으로 방향 정규화 (작은 → 큰)
    if(_nodeRefNum(e.from)>_nodeRefNum(e.to)){
      deduplicatedEdges.push({from:e.to,to:e.from,label:e.label});
    }else{
      deduplicatedEdges.push(e);
    }
  });

  // ═══ 공통: 인접 리스트 + 방향 그래프 구축 ═══
  const adj={};        // 양방향 (탐색용)
  const dirAdj={};     // 단방향 (위상 정렬용)
  const dirAdjRev={};  // 역방향
  nodes.forEach(nd=>{adj[nd.id]=new Set();dirAdj[nd.id]=new Set();dirAdjRev[nd.id]=new Set();});
  const edgeSet=new Set();
  // ★ 단방향화된 deduplicatedEdges로 그래프 구축 ★
  deduplicatedEdges.forEach(e=>{
    const k1=e.from+'|'+e.to, k2=e.to+'|'+e.from;
    if(!edgeSet.has(k1)&&!edgeSet.has(k2))edgeSet.add(k1);
    if(adj[e.from])adj[e.from].add(e.to);
    if(adj[e.to])adj[e.to].add(e.from);
    if(dirAdj[e.from])dirAdj[e.from].add(e.to);
    if(dirAdjRev[e.to])dirAdjRev[e.to].add(e.from);
  });
  // ★ uniqueEdges는 원본 edges 기반 — 렌더링 시 모든 연결 표시 ★
  // ★ v16 FIX-E: _wasBidirectional 플래그로 양방향 화살표 정보 보존 ★
  const biDirPairSet=new Set(biDirPairs.map(p=>[p.a,p.b].sort().join('|')));
  const origEdgeSet=new Set();
  edges.forEach(e=>{
    const k1=e.from+'|'+e.to, k2=e.to+'|'+e.from;
    if(!origEdgeSet.has(k1)&&!origEdgeSet.has(k2))origEdgeSet.add(k1);
  });
  const uniqueEdges=[...origEdgeSet].map(k=>{
    const[f,t]=k.split('|');
    const sortedKey=[f,t].sort().join('|');
    return{from:f,to:t,_wasBidirectional:biDirPairSet.has(sortedKey)};
  });
  const allIds=nodes.map(nd=>nd.id);
  
  // ═══ edge 없음 → 참조번호 오름차순 그리드 ═══
  if(edges.length===0){
    const sorted=[...nodes].sort((a,b)=>{
      const ra=parseInt((a.label.match(/\((\d+)\)/)||[])[1])||9999;
      const rb=parseInt((b.label.match(/\((\d+)\)/)||[])[1])||9999;
      return ra-rb;
    });
    const grid={};const rows=[];
    for(let i=0;i<n;i+=MAX_COLS){rows.push(sorted.slice(i,Math.min(i+MAX_COLS,n)).map(nd=>nd.id));}
    rows.forEach((row,ri)=>{row.forEach((id,ci)=>{grid[id]={row:ri,col:ci,layerSize:row.length};});});
    return{grid,maxCols:Math.min(n,MAX_COLS),numRows:rows.length,uniqueEdges:[],layers:rows,biDirPairs:[]};
  }

  // [C2-9] Fig 1 전용 shapeicon 인식 배치 (P4-FIX 및 전략 선택 이전)
  // 허브 + 자식 2~4개 토폴로지에서 박스/shapeicon 분리 배치로 꺾임·겹침 최소화
  if(figNum===1&&n>=3&&n<=5){
    const _c29=_tryC29ShapeAwareLayout(nodes,adj,uniqueEdges,biDirPairs,n);
    if(_c29)return _c29;
  }

  // ★ P4-FIX: 3개 이하 노드는 무조건 1행 가로 배치 ★
  if(n<=MAX_COLS&&n>=2){
    const sorted=[...nodes].sort((a,b)=>{
      const ra=parseInt((a.label.match(/\((\d+)\)/)||[])[1])||9999;
      const rb=parseInt((b.label.match(/\((\d+)\)/)||[])[1])||9999;
      return ra-rb;
    });
    // 허브가 있으면 중앙에 배치 (CK-8)
    const _adjLocal={};
    nodes.forEach(nd=>{_adjLocal[nd.id]=new Set();});
    deduplicatedEdges.forEach(e=>{
      if(_adjLocal[e.from])_adjLocal[e.from].add(e.to);
      if(_adjLocal[e.to])_adjLocal[e.to].add(e.from);
    });
    const _degLocal={};
    sorted.forEach(nd=>{_degLocal[nd.id]=(_adjLocal[nd.id]||new Set()).size;});
    const _maxDegLocal=Math.max(...Object.values(_degLocal),0);
    if(_maxDegLocal>=2){
      const hubIdx=sorted.findIndex(nd=>_degLocal[nd.id]===_maxDegLocal);
      if(hubIdx>=0){
        const hub=sorted.splice(hubIdx,1)[0];
        const center=Math.floor(sorted.length/2);
        sorted.splice(center,0,hub);
      }
    }
    const grid={};
    sorted.forEach((nd,ci)=>{grid[nd.id]={row:0,col:ci,layerSize:n};});
    return{grid,maxCols:n,numRows:1,uniqueEdges,layers:[sorted.map(nd=>nd.id)],biDirPairs};
  }

  // ═══ 순환 검출 (Kahn's algorithm) ═══
  function _detectCycle(){
    const inDeg={};
    allIds.forEach(id=>{inDeg[id]=0;});
    allIds.forEach(id=>{(dirAdj[id]||new Set()).forEach(to=>{inDeg[to]=(inDeg[to]||0)+1;});});
    const q=allIds.filter(id=>inDeg[id]===0);
    let visited=0;
    while(q.length>0){
      const cur=q.shift();visited++;
      (dirAdj[cur]||new Set()).forEach(next=>{inDeg[next]--;if(inDeg[next]===0)q.push(next);});
    }
    return visited<n; // true = 순환 있음
  }
  const hasCycle=_detectCycle();
  
  // ═══ 그래프 유형 분류 (v17 — 허브 중심 통합) ═══
  const degrees={};
  allIds.forEach(id=>{degrees[id]=(adj[id]||new Set()).size;});
  const degreeValues=Object.values(degrees);
  const maxDeg=Math.max(...degreeValues, 0);
  const isolatedNodes=allIds.filter(id=>degrees[id]===0);
  const connectedNodes=allIds.filter(id=>degrees[id]>0);

  // 허브: 연결된 노드 중 가장 많이 연결된 노드
  const hubCandidates=connectedNodes.filter(id=>degrees[id]===maxDeg);
  // 허브 판정: max degree ≥ 2 AND (전체 edge의 40% 이상 차지 OR degree ≥ 3)
  const hubEdgeRatio=maxDeg/Math.max(deduplicatedEdges.length,1);
  const hasStrongHub=maxDeg>=2&&(hubEdgeRatio>=0.4||maxDeg>=3);

  let strategy;
  if(hasStrongHub){
    strategy='HUB_CENTERED';     // 허브 강함 → 도 번호 무관 허브 중심
  }else if(deduplicatedEdges.length===0||connectedNodes.length<=1){
    strategy='SIMPLE_GRID';      // edge 없음/연결 1개 → 단순 격자
  }else if(!hasCycle){
    strategy='TOPOLOGICAL';      // DAG → 위상 정렬
  }else{
    strategy='CHAIN_FIRST';      // 순환 → 체인 기반 폴백
  }

  console.log(`[Layout v17] figNum=${figNum}, n=${n}, strategy=${strategy}, maxDeg=${maxDeg}, hubRatio=${hubEdgeRatio.toFixed(2)}, isolated=${isolatedNodes.length}`);
  
  // ═══ 전략별 레이어 생성 ═══
  let layers=[];
  const alignCol={};
  let _hubId=null; // ★ v16: 허브 ID — 전략 블록 밖에서 접근 가능 ★

  if(strategy==='TOPOLOGICAL'){
    // ── 위상 정렬: 입력→출력 방향 배치 ──
    // ★ v17: 고립 노드를 먼저 분리 → 끝에 별도 행 ★
    const connectedForTopo=allIds.filter(id=>degrees[id]>0);
    const isolatedForTopo=allIds.filter(id=>degrees[id]===0);

    const nodeMap=new Map(nodes.map(nd=>[nd.id,nd]));
    const _refNum=id=>{return parseInt((nodeMap.get(id)?.label.match(/\((\d+)\)/)||[])[1])||9999;};
    const inDeg={};
    connectedForTopo.forEach(id=>{inDeg[id]=0;});
    connectedForTopo.forEach(id=>{(dirAdj[id]||new Set()).forEach(to=>{if(inDeg[to]!==undefined)inDeg[to]=(inDeg[to]||0)+1;});});

    const q=connectedForTopo.filter(id=>inDeg[id]===0);
    q.sort((a,b)=>_refNum(a)-_refNum(b));

    const topoOrder=[];
    const visited=new Set();
    while(q.length>0){
      const cur=q.shift();
      if(visited.has(cur))continue;
      visited.add(cur);
      topoOrder.push(cur);
      const nexts=[...(dirAdj[cur]||new Set())].filter(id=>inDeg[id]!==undefined).sort((a,b)=>_refNum(a)-_refNum(b));
      nexts.forEach(next=>{
        inDeg[next]--;
        if(inDeg[next]===0)q.push(next);
      });
    }
    // 위상 정렬에서 빠진 연결 노드 추가
    connectedForTopo.forEach(id=>{if(!visited.has(id))topoOrder.push(id);});

    // 위상 순서를 MAX_COLS씩 스네이크 배치
    for(let i=0;i<topoOrder.length;i+=MAX_COLS){
      const chunk=topoOrder.slice(i,Math.min(i+MAX_COLS,topoOrder.length));
      const rowIdx=Math.floor(i/MAX_COLS);
      if(rowIdx%2===1)chunk.reverse();
      layers.push(chunk);
    }

    // 고립 노드를 별도 행으로 추가 (마지막)
    if(isolatedForTopo.length>0){
      isolatedForTopo.sort((a,b)=>_refNum(a)-_refNum(b));
      for(let ii=0;ii<isolatedForTopo.length;ii+=MAX_COLS){
        layers.push(isolatedForTopo.slice(ii,ii+MAX_COLS));
      }
    }

  }else if(strategy==='HUB_CENTERED'){
    // ── ★ v17: 허브 중심 제약 기반 배치 ★ ──
    // 원칙 1: 허브는 반드시 중앙 열
    // 원칙 2: 허브 이웃은 허브와 같은 행 또는 같은 열
    // 원칙 3: 고립 노드는 별도 행 (다른 노드 자리 침범 금지)
    // 원칙 4: 행 너비는 통일 (null 슬롯으로 균형)
    const _refNum=id=>{
      const nd=nodes.find(n=>n.id===id);
      return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;
    };
    // 허브 선택: maxDeg 중 참조번호 최소
    const hubId=hubCandidates.sort((a,b)=>_refNum(a)-_refNum(b))[0];
    _hubId=hubId;
    const hubNbrs=[...(adj[hubId]||new Set())].sort((a,b)=>_refNum(a)-_refNum(b));
    const hubRef=_refNum(hubId);

    // ━━━ 이웃을 upstream(위)/downstream(아래)로 분류 ━━━
    // 우선순위: edge 방향 > 참조번호
    const upstream=[];    // 허브 위쪽 (입력)
    const downstream=[];  // 허브 아래쪽 (출력)
    hubNbrs.forEach(nid=>{
      const ref=_refNum(nid);
      const hasIncoming=(dirAdj[nid]||new Set()).has(hubId); // nid→hub
      const hasOutgoing=(dirAdj[hubId]||new Set()).has(nid); // hub→nid
      if(hasIncoming&&!hasOutgoing)upstream.push(nid);
      else if(hasOutgoing&&!hasIncoming)downstream.push(nid);
      else if(ref<hubRef)upstream.push(nid);
      else downstream.push(nid);
    });

    // ━━━ 균형 조정: 한쪽이 너무 많으면 반대쪽으로 ━━━
    while(upstream.length>3&&downstream.length<upstream.length-1){
      downstream.unshift(upstream.pop());
    }
    while(downstream.length>3&&upstream.length<downstream.length-1){
      upstream.push(downstream.shift());
    }

    // ━━━ 헬퍼: 행을 지정 너비로 중앙 정렬 (null 패딩) ━━━
    function _padRowCentered(items, targetWidth){
      if(items.length>=targetWidth)return items.slice(0, targetWidth);
      const padding=targetWidth-items.length;
      const leftPad=Math.floor(padding/2);
      const row=[];
      for(let i=0;i<leftPad;i++)row.push(null);
      items.forEach(it=>row.push(it));
      while(row.length<targetWidth)row.push(null);
      return row;
    }

    // ━━━ 특수 케이스: upstream ≤ 1 AND downstream ≥ 2 ━━━
    // → 허브와 downstream을 같은 행에 수평 배치 (꺾임 최소화)
    if(upstream.length<=1&&downstream.length>=2&&downstream.length<=MAX_COLS-1){
      const hubRowWidth=1+downstream.length; // 허브 + downstream
      // upstream 행 (있으면)
      if(upstream.length===1){
        const upRow=new Array(hubRowWidth).fill(null);
        // upstream을 허브 예정 위치와 같은 열에 배치
        const hubColIdx=Math.floor(hubRowWidth/2);
        upRow[hubColIdx]=upstream[0];
        layers.push(upRow);
      }
      // 허브 + downstream 같은 행
      // 허브를 중앙에 배치, downstream을 좌우에
      const hubDsRow=[];
      const hubPos=Math.floor(hubRowWidth/2);
      for(let ci=0;ci<hubRowWidth;ci++){
        if(ci===hubPos)hubDsRow.push(hubId);
        else hubDsRow.push(null);
      }
      // downstream을 빈 슬롯에 채움
      let dsIdx=0;
      for(let ci=0;ci<hubDsRow.length;ci++){
        if(hubDsRow[ci]===null&&dsIdx<downstream.length){
          hubDsRow[ci]=downstream[dsIdx++];
        }
      }
      layers.push(hubDsRow);
    }else{
      // ━━━ 일반 케이스: upstream / hub / downstream 3행 구조 ━━━
      const rowWidth=Math.max(upstream.length, downstream.length, 1);

      if(upstream.length>0){
        layers.push(_padRowCentered(upstream, rowWidth));
      }
      // 허브 행: 중앙에 허브, 나머지 null
      const hubRow=new Array(rowWidth).fill(null);
      hubRow[Math.floor(rowWidth/2)]=hubId;
      layers.push(hubRow);

      if(downstream.length>0){
        layers.push(_padRowCentered(downstream, rowWidth));
      }
    }

    // ━━━ 2차 이웃 + 고립 노드 배치 ━━━
    const placed=new Set([hubId, ...hubNbrs]);
    const remaining=allIds.filter(id=>!placed.has(id));
    const secondary=[];
    const isolatedRemaining=[];
    remaining.forEach(id=>{
      const nbrs=[...(adj[id]||new Set())];
      if(nbrs.some(nb=>placed.has(nb)))secondary.push(id);
      else isolatedRemaining.push(id);
    });

    // 2차 이웃: 연결된 허브 이웃의 행 기준으로 새 행 추가
    const hubRowIdx=layers.findIndex(r=>r.indexOf(hubId)>=0);
    secondary.sort((a,b)=>_refNum(a)-_refNum(b));
    secondary.forEach(id=>{
      const nbrs=[...(adj[id]||new Set())];
      const parentNbr=nbrs.find(nb=>placed.has(nb)&&nb!==hubId)||nbrs.find(nb=>placed.has(nb));
      if(!parentNbr){isolatedRemaining.push(id);return;}
      let parentRow=-1;
      for(let ri=0;ri<layers.length;ri++){
        if(layers[ri].indexOf(parentNbr)>=0){parentRow=ri;break;}
      }
      if(parentRow<0){isolatedRemaining.push(id);return;}
      const isAbove=parentRow<hubRowIdx;
      const targetRow=isAbove?0:layers.length;
      if(targetRow>=layers.length)layers.push([]);
      else if(targetRow===0)layers.unshift([]);
      const tRow=targetRow===0?0:layers.length-1;
      const nullIdx=layers[tRow].indexOf(null);
      if(nullIdx>=0)layers[tRow][nullIdx]=id;
      else layers[tRow].push(id);
      placed.add(id);
    });

    // 고립 노드는 마지막에 별도 행 (원칙 3)
    if(isolatedRemaining.length>0){
      isolatedRemaining.sort((a,b)=>_refNum(a)-_refNum(b));
      for(let ii=0;ii<isolatedRemaining.length;ii+=MAX_COLS){
        layers.push(isolatedRemaining.slice(ii, ii+MAX_COLS));
      }
    }

  }else if(strategy==='SIMPLE_GRID'){
    // ── ★ v17: 단순 격자 (edge 없음/연결 1개) ★ ──
    const _refNum=id=>{
      const nd=nodes.find(n=>n.id===id);
      return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;
    };
    const sorted=allIds.slice().sort((a,b)=>_refNum(a)-_refNum(b));
    for(let i=0;i<sorted.length;i+=MAX_COLS){
      layers.push(sorted.slice(i, i+MAX_COLS));
    }

  }else{
    // ── 체인 기반 (기존 v10.6 알고리즘) ──
    // ★ v17: 고립 노드를 먼저 분리 → 끝에 별도 행 ★
    const connectedForChain=allIds.filter(id=>degrees[id]>0);
    const isolatedForChain=allIds.filter(id=>degrees[id]===0);

    let longestPath=[];
    const leaves=connectedForChain.filter(id=>(adj[id]||new Set()).size<=1);
    const startNodes=leaves.length>0?leaves:connectedForChain;

    // BFS 기반 최장경로 (O(V+E) — 지수시간 탐색 방지)
    for(const startId of startNodes){
      const dist={};const prev={};
      dist[startId]=0;prev[startId]=null;
      const bfsQ=[startId];const bfsVisited=new Set([startId]);
      while(bfsQ.length>0){
        const cur=bfsQ.shift();
        (adj[cur]||new Set()).forEach(next=>{
          if(!bfsVisited.has(next)){
            bfsVisited.add(next);
            dist[next]=(dist[cur]||0)+1;
            prev[next]=cur;
            bfsQ.push(next);
          }
        });
      }
      let farthest=startId,maxDist2=0;
      for(const[nid,d]of Object.entries(dist)){if(d>maxDist2){maxDist2=d;farthest=nid;}}
      if(maxDist2+1>longestPath.length){
        const p=[];let c=farthest;while(c!==null){p.unshift(c);c=prev[c];}
        longestPath=p;
      }
    }

    for(let i=0;i<longestPath.length;i+=MAX_COLS){
      const chunk=longestPath.slice(i,Math.min(i+MAX_COLS,longestPath.length));
      const rowIdx=Math.floor(i/MAX_COLS);
      if(rowIdx%2===1)chunk.reverse();
      layers.push(chunk);
    }

    // 나머지 연결 노드 배치
    const placed=new Set(longestPath);
    const remaining=connectedForChain.filter(id=>!placed.has(id));
    const remQueue=[...remaining];
    let remIter=0;
    while(remQueue.length>0&&remIter<remaining.length*3){
      remIter++;
      const id=remQueue.shift();
      const nbrs=[...(adj[id]||new Set())];
      let bestPlaced=false;
      for(const nbr of nbrs){
        if(!placed.has(nbr))continue;
        let nbrRow=-1;
        for(let ri=0;ri<layers.length;ri++){if(layers[ri].indexOf(nbr)>=0){nbrRow=ri;break;}}
        if(nbrRow<0)continue;
        if(layers[nbrRow].length<MAX_COLS){layers[nbrRow].push(id);placed.add(id);bestPlaced=true;break;}
        const targetRow=nbrRow+1;
        while(layers.length<=targetRow)layers.push([]);
        if(layers[targetRow].length<MAX_COLS){layers[targetRow].push(id);placed.add(id);bestPlaced=true;break;}
      }
      if(!bestPlaced){
        if(nbrs.some(nb=>!placed.has(nb))&&remIter<remaining.length*2){remQueue.push(id);continue;}
        let added=false;
        for(let li=0;li<layers.length;li++){if(layers[li].length<MAX_COLS){layers[li].push(id);placed.add(id);added=true;break;}}
        if(!added){layers.push([id]);placed.add(id);}
      }
    }

    // 고립 노드를 별도 행으로 추가 (마지막)
    if(isolatedForChain.length>0){
      const _refNumC=id=>{const nd=nodes.find(n=>n.id===id);return parseInt((nd?.label.match(/\((\d+)\)/)||[])[1])||9999;};
      isolatedForChain.sort((a,b)=>_refNumC(a)-_refNumC(b));
      for(let ii=0;ii<isolatedForChain.length;ii+=MAX_COLS){
        layers.push(isolatedForChain.slice(ii,ii+MAX_COLS));
      }
    }
  }
  
  // ═══ 공통 후처리: 빈 행 제거 + 꺾임·교차 최소화 ═══
  console.log(`[Layout] layers before optimize:`,layers.map((r,i)=>'행'+i+':'+JSON.stringify(r)));
  layers=layers.filter(r=>r.length>0);

  // ★ v15: 엣지 교차 카운트 함수 ★
  function countCrossings(lyrs){
    // 인접 행 쌍 간 엣지 교차 수 계산 (Sugiyama 스타일)
    let crossings=0;
    for(let ri=0;ri<lyrs.length-1;ri++){
      const upper=lyrs[ri], lower=lyrs[ri+1];
      // 이 두 행을 연결하는 엣지 수집
      const interEdges=[];
      uniqueEdges.forEach(e=>{
        const ui=upper.indexOf(e.from), li=lower.indexOf(e.to);
        if(ui>=0&&li>=0){interEdges.push({u:ui,l:li});return;}
        const ui2=upper.indexOf(e.to), li2=lower.indexOf(e.from);
        if(ui2>=0&&li2>=0){interEdges.push({u:ui2,l:li2});}
      });
      // 교차 카운트: 두 엣지 (u1,l1), (u2,l2)가 교차 ⟺ (u1-u2)*(l1-l2)<0
      for(let i=0;i<interEdges.length;i++){
        for(let j=i+1;j<interEdges.length;j++){
          if((interEdges[i].u-interEdges[j].u)*(interEdges[i].l-interEdges[j].l)<0)crossings++;
        }
      }
    }
    return crossings;
  }

  // ★ v15: Barycenter 순서 + 인접 스왑으로 교차 최소화 ★
  function barycenterOrder(lyrs,ri,fixedRi){
    // fixedRi 행을 기준으로 ri 행 노드를 barycenter 순으로 정렬
    const fixed=lyrs[fixedRi];
    const movable=[...lyrs[ri]];
    const bary={};
    movable.forEach(nid=>{
      const nbrs=[...(adj[nid]||new Set())];
      const positions=nbrs.map(nb=>fixed.indexOf(nb)).filter(i=>i>=0);
      bary[nid]=positions.length>0?(positions.reduce((s,v)=>s+v,0)/positions.length):fixed.length/2;
    });
    movable.sort((a,b)=>bary[a]-bary[b]);
    return movable;
  }

  // ★ v17: HUB_CENTERED는 이미 제약 기반 배치 → 최적화 스킵 ★
  if(strategy!=='HUB_CENTERED'){
  // Phase 1: Barycenter ordering (2-pass sweep)
  for(let pass=0;pass<2;pass++){
    // 하향 스윕
    for(let ri=1;ri<layers.length;ri++){
      if(layers[ri].length<=1)continue;
      layers[ri]=barycenterOrder(layers,ri,ri-1);
    }
    // 상향 스윕
    for(let ri=layers.length-2;ri>=0;ri--){
      if(layers[ri].length<=1)continue;
      layers[ri]=barycenterOrder(layers,ri,ri+1);
    }
  }

  // Phase 2: Adjacent swap (교차 수 감소할 때까지 반복)
  let improved=true;
  let swapRounds=0;
  while(improved&&swapRounds<5){
    improved=false;
    swapRounds++;
    for(let ri=0;ri<layers.length;ri++){
      if(layers[ri].length<=2)continue;
      const row=layers[ri];
      for(let ci=0;ci<row.length-1;ci++){
        const before=countCrossings(layers);
        [row[ci],row[ci+1]]=[row[ci+1],row[ci]];
        const after=countCrossings(layers);
        if(after<before){improved=true;}
        else{[row[ci],row[ci+1]]=[row[ci+1],row[ci]];}
      }
    }
  }
  } // end HUB_CENTERED guard
  
  // 꺾임 수 계산 함수 (v17: null 슬롯 안전)
  function countBends(lyrs,ac){
    let bends=0;
    uniqueEdges.forEach(e=>{
      let fr=-1,fc=-1,tr=-1,tc=-1;
      for(let ri=0;ri<lyrs.length;ri++){
        const fi=lyrs[ri].indexOf(e.from);
        if(fi>=0){fr=ri;fc=ac[e.from]?ac[e.from].col:fi;}
        const ti=lyrs[ri].indexOf(e.to);
        if(ti>=0){tr=ri;tc=ac[e.to]?ac[e.to].col:ti;}
      }
      if(fr<0||tr<0)return;
      // 같은 행이거나 같은 열이면 꺾임 없음 (직선)
      if(fr===tr||fc===tc)return;
      bends++;
    });
    return bends;
  }
  
  // 수직 연결 열 정렬 재계산
  function _recalcAlignCol(){
    Object.keys(alignCol).forEach(k=>delete alignCol[k]);
    for(let ri=0;ri<layers.length-1;ri++){
      const curRow=layers[ri];
      const nextRow=layers[ri+1];
      nextRow.forEach(nid=>{
        if(nid===null)return; // ★ v17: null 슬롯 건너뛰기 ★
        const nbrs=[...(adj[nid]||new Set())];
        for(const nbr of nbrs){
          const nbrCI=curRow.indexOf(nbr);
          if(nbrCI>=0){alignCol[nid]={col:nbrCI,layerSize:Math.max(curRow.length,nextRow.length)};break;}
        }
      });
    }
  }

  // ★ v17: HUB_CENTERED는 순열 탐색·수직 정렬 최적화 스킵 ★
  if(strategy!=='HUB_CENTERED'){
  // 행 내 순서 최적화 — 순열 탐색 + 교차·꺾임 통합 비용
  for(let ri=0;ri<layers.length;ri++){
    if(layers[ri].length<=1)continue;
    if(layers[ri].indexOf(null)>=0)continue; // null 행 스킵
    const row=layers[ri];
    let perms;
    if(row.length===2)perms=[row,[row[1],row[0]]];
    else if(row.length===3)perms=[[row[0],row[1],row[2]],[row[0],row[2],row[1]],[row[1],row[0],row[2]],[row[1],row[2],row[0]],[row[2],row[0],row[1]],[row[2],row[1],row[0]]];
    else if(row.length===4){
      perms=[];
      for(let a=0;a<4;a++)for(let b=0;b<4;b++){if(b===a)continue;
        for(let c=0;c<4;c++){if(c===a||c===b)continue;
          const d=6-a-b-c; perms.push([row[a],row[b],row[c],row[d]]);
        }
      }
    }else{perms=[row];}
    let bestPerm=[...row];
    let bestCost=countCrossings(layers)*3+countBends(layers,alignCol);
    for(const perm of perms){
      layers[ri]=perm;
      const cost=countCrossings(layers)*3+countBends(layers,{...alignCol});
      if(cost<bestCost){bestCost=cost;bestPerm=[...perm];}
    }
    layers[ri]=bestPerm;
  }

  _recalcAlignCol();

  // 수직 정렬 최적화 — countBends 검증 기반 행 내 스왑
  let vAlignImproved=true;
  let vAlignRounds=0;
  while(vAlignImproved&&vAlignRounds<3){
    vAlignImproved=false;
    vAlignRounds++;
    for(let ri=0;ri<layers.length;ri++){
      const row=layers[ri];
      if(row.length<=1)continue;
      if(row.indexOf(null)>=0)continue; // null 행 스킵
      for(let ci=0;ci<row.length;ci++){
        for(let cj=ci+1;cj<row.length;cj++){
          const beforeBends=countBends(layers,alignCol);
          const beforeCross=countCrossings(layers);
          const beforeCost=beforeCross*3+beforeBends;
          [row[ci],row[cj]]=[row[cj],row[ci]];
          _recalcAlignCol();
          const afterBends=countBends(layers,alignCol);
          const afterCross=countCrossings(layers);
          const afterCost=afterCross*3+afterBends;
          if(afterCost<beforeCost){
            vAlignImproved=true;
          }else{
            [row[ci],row[cj]]=[row[cj],row[ci]];
            _recalcAlignCol();
          }
        }
      }
    }
  }
  } // end HUB_CENTERED guard for permutation/vertical alignment

  _recalcAlignCol();

  const finalBends=countBends(layers,alignCol);
  const finalCrossings=countCrossings(layers);

  console.log(`[Layout v17] ${n}nodes → ${layers.length}rows, strategy=${strategy}, bends=${finalBends}, crossings=${finalCrossings}${_hubId?', hub='+_hubId:''}`);

  // Grid 생성
  const grid={};let maxCols=1;
  layers.forEach((layer,rowIdx)=>{
    maxCols=Math.max(maxCols,layer.length);
    layer.forEach((id,colIdx)=>{
      if(id===null)return; // ★ FIX-D: null 슬롯 건너뛰기 (열 인덱스 유지) ★
      if(alignCol[id]){
        grid[id]={row:rowIdx,col:alignCol[id].col,layerSize:alignCol[id].layerSize};
        maxCols=Math.max(maxCols,alignCol[id].layerSize);
      }else{
        grid[id]={row:rowIdx,col:colIdx,layerSize:layer.length};
      }
    });
  });
  
  return{grid,maxCols:Math.min(maxCols,MAX_COLS),numRows:layers.length,uniqueEdges,layers,biDirPairs};
}

// ── Strict Orthogonal Router v4.0 ──
// 모든 세그먼트가 수평(H) 또는 수직(V)만 허용. 사선 절대 불가.
// ★ 핵심 변경: 모든 경로(직선 포함)에 충돌 검사 적용 + Z-shape 우회 ★
const ROUTE_PAD=15; // 연결선↔박스 최소 간격 (px)

function getOrthogonalRoute(fromBox,toBox,allBoxes,routePad){
  const pad=(routePad!==undefined)?routePad:ROUTE_PAD;
  const dx=toBox.cx-fromBox.cx, dy=toBox.cy-fromBox.cy;
  if(Math.abs(dx)<(pad*0.05)&&Math.abs(dy)<(pad*0.05))return null;
  
  const excludeIds=new Set([fromBox.id,toBox.id].filter(Boolean));
  const obstacles=(allBoxes||[]).filter(b=>!excludeIds.has(b.id));
  
  // ── 후보 경로 생성 ──
  const candidates=[];
  
  // 1) 같은 열 (수직 정렬) → 수직 직선
  if(Math.abs(dx)<Math.max(fromBox.w,toBox.w)*0.4){
    const midX=(fromBox.cx+toBox.cx)/2;
    if(dy>0)candidates.push({route:[{x:midX,y:fromBox.y+fromBox.h},{x:midX,y:toBox.y}],type:'straight-v'});
    else candidates.push({route:[{x:midX,y:fromBox.y},{x:midX,y:toBox.y+toBox.h}],type:'straight-v'});
  }
  
  // 2) 같은 행 (수평 정렬) → 수평 직선
  if(Math.abs(dy)<Math.max(fromBox.h,toBox.h)*0.4){
    const midY=(fromBox.cy+toBox.cy)/2;
    if(dx>0)candidates.push({route:[{x:fromBox.x+fromBox.w,y:midY},{x:toBox.x,y:midY}],type:'straight-h'});
    else candidates.push({route:[{x:fromBox.x,y:midY},{x:toBox.x+toBox.w,y:midY}],type:'straight-h'});
  }
  
  // 3) L-shape 후보 2개
  candidates.push({route:_buildLRoute_VH(fromBox,toBox,dy,dx),type:'L-vh'});
  candidates.push({route:_buildLRoute_HV(fromBox,toBox,dy,dx),type:'L-hv'});
  
  // ── 충돌 검사 & 최적 경로 선택 ──
  if(!obstacles.length){
    return candidates[0].route; // 장애물 없으면 첫 번째 후보
  }
  
  let bestRoute=null, bestHits=Infinity;
  candidates.forEach(c=>{
    const hits=_countRouteCollisions(c.route,obstacles,excludeIds,pad);
    if(hits<bestHits){bestHits=hits;bestRoute=c.route;}
  });
  
  // 충돌 0이면 바로 반환
  if(bestHits===0)return bestRoute;
  
  // ── Z-shape 우회 경로 시도 ──
  // 충돌하는 박스를 피해 바깥으로 우회
  const zRoutes=_buildZRoutes(fromBox,toBox,obstacles,dx,dy,pad);
  zRoutes.forEach(zr=>{
    const hits=_countRouteCollisions(zr,obstacles,excludeIds,pad);
    if(hits<bestHits){bestHits=hits;bestRoute=zr;}
  });
  
  return bestRoute;
}

// L-shape: 수직(V) 먼저 → 수평(H)
function _buildLRoute_VH(from,to,dy,dx){
  const exitX=from.cx;
  const exitY=dy>0?from.y+from.h:from.y;
  const entryY=to.cy;
  const entryX=dx>0?to.x:to.x+to.w;
  return[{x:exitX,y:exitY},{x:exitX,y:entryY},{x:entryX,y:entryY}];
}

// L-shape: 수평(H) 먼저 → 수직(V)
function _buildLRoute_HV(from,to,dy,dx){
  const exitY=from.cy;
  const exitX=dx>0?from.x+from.w:from.x;
  const entryX=to.cx;
  const entryY=dy>0?to.y:to.y+to.h;
  return[{x:exitX,y:exitY},{x:entryX,y:exitY},{x:entryX,y:entryY}];
}

// ★ Z-shape 우회 경로 생성 (장애물 회피의 핵심) ★
// 4방향으로 우회하는 5점 경로를 생성
function _buildZRoutes(from,to,obstacles,dx,dy,routePad){
  const routes=[];
  const PAD=(routePad!==undefined?routePad:ROUTE_PAD)+8*(routePad!==undefined?routePad/ROUTE_PAD:1);
  
  // 모든 장애물의 바운딩 박스 경계 수집
  let globalMinX=Infinity,globalMinY=Infinity,globalMaxX=-Infinity,globalMaxY=-Infinity;
  [from,to,...obstacles].forEach(b=>{
    globalMinX=Math.min(globalMinX,b.x);
    globalMinY=Math.min(globalMinY,b.y);
    globalMaxX=Math.max(globalMaxX,b.x+b.w);
    globalMaxY=Math.max(globalMaxY,b.y+b.h);
  });
  
  // Z-route 1: 위쪽 우회 (from 위→수평→to 위)
  const topY=globalMinY-PAD;
  routes.push([
    {x:from.cx, y:from.y},
    {x:from.cx, y:topY},
    {x:to.cx, y:topY},
    {x:to.cx, y:to.y}
  ]);
  
  // Z-route 2: 아래쪽 우회
  const bottomY=globalMaxY+PAD;
  routes.push([
    {x:from.cx, y:from.y+from.h},
    {x:from.cx, y:bottomY},
    {x:to.cx, y:bottomY},
    {x:to.cx, y:to.y+to.h}
  ]);
  
  // Z-route 3: 왼쪽 우회
  const leftX=globalMinX-PAD;
  routes.push([
    {x:from.x, y:from.cy},
    {x:leftX, y:from.cy},
    {x:leftX, y:to.cy},
    {x:to.x, y:to.cy}
  ]);
  
  // Z-route 4: 오른쪽 우회
  const rightX=globalMaxX+PAD;
  routes.push([
    {x:from.x+from.w, y:from.cy},
    {x:rightX, y:from.cy},
    {x:rightX, y:to.cy},
    {x:to.x+to.w, y:to.cy}
  ]);
  
  return routes;
}

// 경로가 박스를 관통하는지 검사
// ★ v11.1: pad 파라미터 추가 — PPTX(inch) vs SVG(px) 단위 대응 ★
function _countRouteCollisions(route,allBoxes,excludeIds,pad){
  let hits=0;
  const usePad=(pad!==undefined)?pad:ROUTE_PAD;
  for(let i=0;i<route.length-1;i++){
    const p1=route[i],p2=route[i+1];
    allBoxes.forEach(box=>{
      if(excludeIds&&excludeIds.has(box.id))return;
      if(_segmentIntersectsBox(p1,p2,box,usePad))hits++;
    });
  }
  return hits;
}

// H/V 세그먼트가 박스와 교차하는지
// ★ v12 FIX: 좌표계 독립 — px(SVG) / inch(PPTX) 모두 정확 ★
function _segmentIntersectsBox(p1,p2,box,pad){
  if(pad===undefined)pad=ROUTE_PAD;
  const bx1=box.x-pad,by1=box.y-pad,bx2=box.x+box.w+pad,by2=box.y+box.h+pad;
  // ★ v12: 절대 임계값(1) 대신 상대 비교 — PPTX(inch)에서 수직선 오판 방지 ★
  if(Math.abs(p1.y-p2.y)<=Math.abs(p1.x-p2.x)){
    // 수평 세그먼트 (또는 점)
    const y=(p1.y+p2.y)/2;
    if(y<by1||y>by2)return false;
    const minX=Math.min(p1.x,p2.x),maxX=Math.max(p1.x,p2.x);
    return maxX>bx1&&minX<bx2;
  }else{
    // 수직 세그먼트
    const x=(p1.x+p2.x)/2;
    if(x<bx1||x>bx2)return false;
    const minY=Math.min(p1.y,p2.y),maxY=Math.max(p1.y,p2.y);
    return maxY>by1&&minY<by2;
  }
}

// SVG orthogonal path renderer (H/V 세그먼트만 허용)
// ★ v16 FIX-E: bidir 파라미터 — true이면 양방향 화살표, false이면 단방향 ★
function svgOrthogonalEdge(route,mkId,bidir){
  if(!route||route.length<2)return'';
  const startMarker=bidir?` marker-start="url(#${mkId})"`:''  ;
  // ★ 안전 검증: 2점 경로에서 X,Y 모두 다르면 L-shape로 변환 ★
  if(route.length===2){
    const p0=route[0],p1=route[1];
    if(Math.abs(p0.x-p1.x)>1&&Math.abs(p0.y-p1.y)>1){
      // 사선 방지: L-shape로 변환 (수평→수직)
      route=[p0,{x:p1.x,y:p0.y},p1];
    }
  }
  if(route.length===2){
    return`<line x1="${route[0].x}" y1="${route[0].y}" x2="${route[1].x}" y2="${route[1].y}" stroke="#000" stroke-width="1"${startMarker} marker-end="url(#${mkId})"/>`;
  }
  let d=`M${route[0].x},${route[0].y}`;
  for(let i=1;i<route.length;i++)d+=` L${route[i].x},${route[i].y}`;
  return`<path d="${d}" fill="none" stroke="#000" stroke-width="1"${startMarker} marker-end="url(#${mkId})"/>`;
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
    for(const gy of Object.keys(yGroups)){
      if(Math.abs(parseFloat(gy)-roundedY)<minGap*0.8){
        yGroups[gy].push(le);
        matched=true;
        break; // 첫 매칭 그룹에만 추가
      }
    }
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
  // ★ v12 CRITICAL FIX: 하드코딩 <1 → 박스 크기의 5% 상대 임계값 ★
  // 기존: PPTX(inch)에서 0.5인치 거리 노드도 "동일점" 판정 → edge 누락
  const minDim=Math.min(fromBox.w||1,fromBox.h||1,toBox.w||1,toBox.h||1);
  const threshold=Math.max(minDim*0.05, 0.01); // 최소 0.01 (inch/px 모두 안전)
  if(Math.abs(dx)<threshold&&Math.abs(dy)<threshold)return null;
  // ★ v10.2: _shapeAnchor 기반 연결점 (shape 경계 정확 반영) ★
  let fromDir,toDir;
  if(Math.abs(dy)>=Math.abs(dx)){
    fromDir=dy>0?'bottom':'top'; toDir=dy>0?'top':'bottom';
  }else{
    fromDir=dx>0?'right':'left'; toDir=dx>0?'left':'right';
  }
  const fSt=fromBox._shapeType||'box', tSt=toBox._shapeType||'box';
  const fSx=fromBox._sx!=null?fromBox._sx:fromBox.x, fSy=fromBox._sy!=null?fromBox._sy:fromBox.y;
  const fSw=fromBox._sw||fromBox.w, fSh=fromBox._sh||fromBox.h;
  const tSx=toBox._sx!=null?toBox._sx:toBox.x, tSy=toBox._sy!=null?toBox._sy:toBox.y;
  const tSw=toBox._sw||toBox.w, tSh=toBox._sh||toBox.h;
  const fAnc=_shapeAnchor(fSt,fSx,fSy,fSw,fSh,fromDir);
  const tAnc=_shapeAnchor(tSt,tSx,tSy,tSw,tSh,toDir);
  return{x1:fAnc.px,y1:fAnc.py,x2:tAnc.px,y2:tAnc.py};
}

// ═══ v8.0: 객체 기반 충돌 방지 레이아웃 엔진 (공통) ═══
// 모든 렌더러(SVG, Canvas, PPTX)가 공유하는 레이아웃 계산기
function computeFig2Layout(displayNodes, edges, innerGrid, innerMaxCols, innerNumRows, innerUniqueEdges, frameRefNum, opts){
  const{boxBaseW, boxBaseH, colGap, rowGap, framePad, shadowSize, scale}=opts;
  // scale: SVG=72(PX), Canvas=1(px), PPTX=1(inch)

  // ★ v19: 전체 열 영역 너비 사전 계산 — 프레임 너비 통일 기준 ★
  const totalAreaW=innerMaxCols*boxBaseW+(innerMaxCols-1)*colGap;

  // Phase 1: 각 노드를 객체(Rect)로 변환
  const objects=[];
  displayNodes.forEach(nd=>{
    const gp=innerGrid[nd.id];
    if(!gp)return;
    // 행 내 노드 수에 따른 중앙 정렬
    const rowNodeAreaW=gp.layerSize*boxBaseW+(gp.layerSize-1)*colGap;
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
  
  // ★ v20: Phase 1.5 — 행별 중앙 정렬 (gp.layerSize 보정) ★
  // computeDeviceLayout2D가 alignCol에서 layerSize를 인접 행 최대치로 설정하므로
  // 노드 수가 적은 행이 좌측에 치우침 → 실제 노드 수 기준으로 재중앙 정렬
  const _rowGroups={};
  objects.forEach(o=>{
    const gp=innerGrid[o.id];
    if(!gp)return;
    if(!_rowGroups[gp.row])_rowGroups[gp.row]=[];
    _rowGroups[gp.row].push(o);
  });
  Object.values(_rowGroups).forEach(rowObjs=>{
    if(rowObjs.length>0&&rowObjs.length<innerMaxCols){
      const minRX=Math.min(...rowObjs.map(o=>o.x));
      const maxRX=Math.max(...rowObjs.map(o=>o.x+o.w));
      const rowW=maxRX-minRX;
      const shift=(totalAreaW-rowW)/2-minRX;
      rowObjs.forEach(o=>{o.x+=shift;});
    }
  });

  // Phase 2: 충돌 감지 & 자동 보정 (최대 20라운드)
  // v9.0: 연결선 라우팅 공간을 확보하기 위해 MIN_SEP 대폭 증가
  // ★ v12 CRITICAL FIX: ROUTE_PAD(15px) → opts.routePad로 좌표계 독립화 ★
  // 기존: PPTX(inch)에서 MIN_SEP=15.16인치 → 객체 15인치씩 밀림 → 슬라이드 이탈
  const _rpad=(opts&&opts.routePad!==undefined)?opts.routePad:ROUTE_PAD;
  const MIN_SEP=Math.max(colGap*0.5, rowGap*0.4, shadowSize*4+_rpad);
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
  const actualContentW=maxX-minX;
  const contentH=maxY-minY;
  // ★ v19: 프레임 너비를 전체 열 영역 기준으로 통일 — 1열도 3열과 동일 폭 ★
  const minContentW=totalAreaW+shadowSize+2;
  const contentW=Math.max(actualContentW, minContentW);

  // Phase 4: 프레임 좌표 (content + padding)
  const frameW=contentW+framePad*2;
  const frameH=contentH+framePad*2;

  // Phase 5: 객체 좌표를 프레임 내부 좌표로 재배치 (원점 보정 + 중앙 정렬)
  const extraW=contentW-actualContentW;
  const offsetX=framePad-minX+extraW/2;
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

// ═══ v10.2: 연결선 끝점을 Shape 곡면 경계에 정확히 스냅 ═══
// getOrthogonalRoute는 직사각형 nodeBox 기반이라 cloud/database/monitor 등
// 곡면 shape에서 연결선이 shape 밖에서 시작/끝하는 문제를 수정
// 핵심: 직교(orthogonal) 속성 유지 + 경계 좌표만 조정
function _snapRouteToShapeAnchors(route,fromBox,toBox,offF,offT,allBoxes,coordTol){
  if(!route||route.length<2)return route;
  const r=[...route.map(p=>({...p}))]; // deep copy
  const _ct=(coordTol!==undefined&&coordTol>0)?coordTol:1; // ★ v12: 좌표계 독립 임계값 (SVG:1=px, PPTX:≈0.005=inch) ★
  
  // ★ v10.4: 각 shape의 정확한 변 중앙에서 연결 (직교 유지) ★
  // 원칙: 화살표는 반드시 구성의 중앙(가로든 세로든)에 접점을 형성
  
  // 1) 시작점(from) exit 방향 결정
  const seg0dx=r[1].x-r[0].x, seg0dy=r[1].y-r[0].y;
  let fromDir;
  if(Math.abs(seg0dy)>Math.abs(seg0dx)){fromDir=seg0dy>0?'bottom':'top';}
  else{fromDir=seg0dx>0?'right':'left';}
  
  // 2) 끝점(to) entry 방향 결정 — ★ 진입 방향은 세그먼트 반대 ★
  const last=r.length-1;
  const segLdx=r[last].x-r[last-1].x, segLdy=r[last].y-r[last-1].y;
  let toDir;
  // 화살표가 오른쪽으로 이동하며 도착 → 왼쪽에서 진입(left)
  // 화살표가 아래로 이동하며 도착 → 위에서 진입(top)
  if(Math.abs(segLdy)>Math.abs(segLdx)){toDir=segLdy>0?'top':'bottom';}
  else{toDir=segLdx>0?'left':'right';}
  
  // 3) 시작점 shape anchor 계산
  const fromST=fromBox._shapeType||'box';
  const fromAnc=_shapeAnchor(fromST,fromBox._sx||fromBox.x,fromBox._sy||fromBox.y,
    fromBox._sw||fromBox.w,fromBox._sh||fromBox.h,fromDir);
  const fromAncX=fromAnc.px, fromAncY=fromAnc.py;
  
  // 4) 끝점 shape anchor 계산
  const toST=toBox._shapeType||'box';
  const toAnc=_shapeAnchor(toST,toBox._sx||toBox.x,toBox._sy||toBox.y,
    toBox._sw||toBox.w,toBox._sh||toBox.h,toDir);
  const toAncX=toAnc.px, toAncY=toAnc.py;
  
  // 5) 시작점 스냅
  r[0].x=fromAncX;
  r[0].y=fromAncY;
  
  // 6) 끝점 스냅
  r[r.length-1].x=toAncX;
  r[r.length-1].y=toAncY;
  
  // 7) 직교성 복원 — 중간점들을 조정하여 모든 세그먼트가 수평/수직이 되도록
  if(r.length===2){
    // 직선 경로 — 시작/끝 Y가 다르면 L-shape로 변환
    if(Math.abs(fromAncY-toAncY)>2*_ct){
      if(fromDir==='right'||fromDir==='left'){
        // 수평 출발 → 중간에서 꺾임
        const midX=(fromAncX+toAncX)/2;
        r.splice(1,0,{x:midX,y:fromAncY},{x:midX,y:toAncY});
      }else{
        // 수직 출발 → 중간에서 꺾임
        const midY=(fromAncY+toAncY)/2;
        r.splice(1,0,{x:fromAncX,y:midY},{x:toAncX,y:midY});
      }
    }else if(Math.abs(fromAncX-toAncX)>2*_ct&&(fromDir==='top'||fromDir==='bottom')){
      const midY=(fromAncY+toAncY)/2;
      r.splice(1,0,{x:fromAncX,y:midY},{x:toAncX,y:midY});
    }
  }else if(r.length>=3){
    // 다점 경로 — 첫 번째/마지막 세그먼트만 정렬
    // 첫 번째 세그먼트: r[0] → r[1]
    if(fromDir==='right'||fromDir==='left'){
      r[1].y=fromAncY; // 수평 출발이면 r[1]의 Y를 맞춤
    }else{
      r[1].x=fromAncX; // 수직 출발이면 r[1]의 X를 맞춤
    }
    // 마지막 세그먼트: r[last-1] → r[last]
    const lastIdx=r.length-1;
    if(toDir==='right'||toDir==='left'){
      r[lastIdx-1].y=toAncY;
    }else{
      r[lastIdx-1].x=toAncX;
    }
  }
  
  // 8) ★ v10.4: 경로 단순화 — 불필요한 꺾임 제거 (장애물 인식) ★
  return _simplifyRoute(r, allBoxes||[], fromBox, toBox, _ct);
}

// ★ v10.4: 직교 경로 단순화 — 불필요한 웨이포인트 제거 (장애물 인식) ★
// ★ v12: coordTol 파라미터 추가 — SVG(px)와 PPTX(inch) 좌표계 모두 정확 ★
function _simplifyRoute(route, obstacles, fromBox, toBox, coordTol){
  if(!route||route.length<3)return route;
  let r=[...route.map(p=>({...p}))];
  const _ct=(coordTol!==undefined&&coordTol>0)?coordTol:1; // SVG:1(px), PPTX:≈0.005(inch)
  const excludeIds=new Set();
  if(fromBox&&fromBox.id)excludeIds.add(fromBox.id);
  if(toBox&&toBox.id)excludeIds.add(toBox.id);
  const obs=(obstacles||[]).filter(b=>!excludeIds.has(b.id));
  
  // Pass 1: 동일선상(collinear) 중간점 제거
  // 3개 연속 점이 모두 같은 X 또는 같은 Y이면 중간점 불필요
  let changed=true;
  while(changed){
    changed=false;
    for(let i=1;i<r.length-1;i++){
      const prev=r[i-1], cur=r[i], next=r[i+1];
      const sameX=Math.abs(prev.x-cur.x)<_ct&&Math.abs(cur.x-next.x)<_ct;
      const sameY=Math.abs(prev.y-cur.y)<_ct&&Math.abs(cur.y-next.y)<_ct;
      if(sameX||sameY){
        r.splice(i,1);
        changed=true;
        break;
      }
    }
  }
  
  // Pass 2: 제로 길이 세그먼트 제거 (두 점이 거의 같은 위치)
  changed=true;
  while(changed&&r.length>2){
    changed=false;
    for(let i=0;i<r.length-1;i++){
      if(Math.abs(r[i].x-r[i+1].x)<_ct&&Math.abs(r[i].y-r[i+1].y)<_ct){
        r.splice(i+1,1);
        changed=true;
        break;
      }
    }
  }
  
  // Pass 3: U-turn 제거 — 연속 3개 세그먼트가 같은 축을 따라 왔다가 돌아가면 직선으로 대체
  // 예: →↑→를 →로 단순화 (시작/끝 Y가 같으면)
  if(r.length>=4){
    const simplified=[];
    simplified.push(r[0]);
    for(let i=1;i<r.length-1;i++){
      const prev=simplified[simplified.length-1];
      const cur=r[i];
      const next=r[i+1];
      // prev→cur→next가 되돌아가는 패턴인지 확인
      // 수평으로 가다가 수직으로 가다가 다시 수평: prev.y==cur.y, cur.x==next.x는 정상 L-turn
      // 하지만 prev.y==next.y이고 중간에 불필요한 detour면 건너뜀
      const skipable=
        (Math.abs(prev.y-next.y)<2*_ct&&Math.abs(prev.y-cur.y)<2*_ct) || // 3점 모두 같은 Y → 중간점 불필요 (already handled)
        (Math.abs(prev.x-next.x)<2*_ct&&Math.abs(prev.x-cur.x)<2*_ct);  // 3점 모두 같은 X
      if(!skipable){
        simplified.push(cur);
      }
    }
    simplified.push(r[r.length-1]);
    r=simplified;
  }
  
  // Pass 4: 시작/끝이 직선 가능하고 중간에 장애물이 없는 경우만 직선화
  // ★ 장애물이 직선 경로에 있으면 우회점 보존 ★
  // ★ v12: _ct 적용 + _countRouteCollisions에 pad 전달 ★
  if(r.length>2){
    const first=r[0], last=r[r.length-1];
    const tolerance=8*_ct;
    let canStraighten=false;
    // ★ v12: _ct 기반 pad를 역산하여 충돌 검사에 전달 ★
    const _pad=(_ct<0.1)?(_ct*15):undefined; // PPTX면 인치 pad, SVG면 기본값
    
    if(Math.abs(first.x-last.x)<3*_ct){
      const allNearX=r.slice(1,-1).every(p=>Math.abs(p.x-first.x)<tolerance);
      if(allNearX){
        // 직선 경로가 장애물을 관통하는지 확인
        const straightHits=_countRouteCollisions([first, last], obs, excludeIds, _pad);
        if(straightHits===0) canStraighten=true;
      }
    }else if(Math.abs(first.y-last.y)<3*_ct){
      const allNearY=r.slice(1,-1).every(p=>Math.abs(p.y-first.y)<tolerance);
      if(allNearY){
        const straightHits=_countRouteCollisions([first, last], obs, excludeIds, _pad);
        if(straightHits===0) canStraighten=true;
      }
    }
    
    if(canStraighten) r=[r[0], r[r.length-1]];
  }
  
  return r;
}

function renderDiagramSvg(containerId,nodes,edges,positions,figNum,adjustments,globalMaxInnerCols){
  // ═══ KIPO 특허 도면 규칙 v4.1 (직계 부모 일치) ═══
  // ★ v10.4: adjustments 파라미터 — 포스트 렌더 검증 실패 시 재렌더링용 ★
  // adjustments: {spacingMult:1.0, fontOffset:0, boxWidthMult:1.0, boxHeightMult:1.0}
  const adj=adjustments||{};
  const _sm=adj.spacingMult||1.0;  // 간격 배율 (1.0=기본, 1.2=20% 확대)
  const _fo=adj.fontOffset||0;     // 폰트 크기 오프셋 (-1=1px 축소)
  const _bwm=adj.boxWidthMult||1.0;  // 박스 너비 배율
  const _bhm=adj.boxHeightMult||1.0; // 박스 높이 배율
  
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
    const boxH=0.7*PX*_bhm, boxGap=0.8*PX*_sm, diamondH=1.0*PX*_bhm;
    const normalBoxW=5.0*PX*_bwm;
    const startEndBoxW=2.0*PX*_bwm;
    const diamondW=5.5*PX*_bwm;
    const boxStartY=0.5*PX;
    // 분기 여부 판단
    const hasBranching=edges.some(e=>e.label);
    const branchOffset=hasBranching?2.8*PX*_sm:0;
    const centerX=0.5*PX+normalBoxW/2+branchOffset/2;
    const svgW=normalBoxW+2.5*PX+branchOffset;
    
    // 노드 위치 계산 (토폴로지 기반)
    const nodeMap={};nodes.forEach(n=>nodeMap[n.id]=n);
    const adjList={};edges.forEach(e=>{if(!adjList[e.from])adjList[e.from]=[];adjList[e.from].push(e);});
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
        // 텍스트 (v10.6 FIX: 마름모 가용폭 기반 동적 줄바꿈 — 고정 maxChars 제거)
        const _diamUsableW=diamondW*0.70; // 마름모 중앙부 가용 너비 (~70%)
        const _dtw=_estimateTextWidth(displayLabel,11);
        if(_dtw>_diamUsableW){
          const _dfs=_dtw>_diamUsableW*2?9:11; // 2줄로도 넘치면 폰트 축소
          const mid=Math.ceil(displayLabel.length/2);
          const sp=displayLabel.lastIndexOf(' ',mid);
          const bp=sp>0?sp:mid;
          svg+=`<text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="${_dfs}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel.slice(0,bp))}</text>`;
          svg+=`<text x="${cx}" y="${cy+_dfs-1}" text-anchor="middle" font-size="${_dfs}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel.slice(bp).trim())}</text>`;
        }else{
          svg+=`<text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="11" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${App.escapeHtml(displayLabel)}</text>`;
        }
        // 리더라인 + 부호
        if(refNum){
          const leaderEndX=centerX+normalBoxW/2+0.3*PX+branchOffset/2;
          svg+=`<line x1="${cx+dw}" y1="${cy}" x2="${leaderEndX}" y2="${cy}" stroke="#000" stroke-width="1"/>`;
          svg+=`<text x="${leaderEndX+8}" y="${cy+4}" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
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
          svg+=`<text x="${leaderEndX+8}" y="${leaderY+4}" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
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
        const isNoLabel=e.label&&/^(아니오|아니요|No|N)$/i.test(e.label.trim());
        const isYesLabel=e.label&&/^(예|Yes|Y)$/i.test(e.label.trim());
        
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
    // [C2-4] all-L1 평면 구조 감지
    const _isAllL1Flat=allL1&&nodes.length>0&&nodes.every(n=>!n.isContainer);
    if(_isAllL1Flat)console.log(`[C2-4] Fig ${figNum}: all-L1 평면 구조 (${nodes.length}개 노드)`);
    // [C2-2] container 노드 분리 — 일반 레이아웃에서 제외
    const _fig1Containers=nodes.filter(n=>n.isContainer);
    const _fig1LayoutNodes=_fig1Containers.length>0?nodes.filter(n=>!n.isContainer):nodes;
    const layout=computeDeviceLayout2D(_fig1LayoutNodes,edges,figNum);
    const{grid:_rawGrid,maxCols,numRows,uniqueEdges,biDirPairs}=layout;
    // [C2-5] layers 기반 grid col 재구축 — alignCol 오염 보정
    const _layers=layout.layers;
    const grid={};
    if(_layers&&_layers.length>0){
      _layers.forEach((layer,ri)=>{
        layer.forEach((id,ci)=>{
          if(id===null)return;
          grid[id]={row:ri,col:ci,layerSize:layer.length};
        });
      });
    }else{
      Object.assign(grid,_rawGrid);
    }
    
    // 열 수에 따른 박스 크기 조정
    // ★ v20: 간격 축소 — svgW 감소 → 컨테이너 내 1:1 표시 비율 확보 ★
    const colGap=0.65*PX*_sm;
    const boxW2D=(maxCols<=1?5.0*PX:maxCols===2?3.5*PX:3.0*PX)*_bwm;
    const maxNodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
    const marginX=0.5*PX*_sm;
    const marginY=0.6*PX*_sm;
    const refNumH=30*_sm;
    const rowGapBase=0.7*PX*_sm;

    // [C2-8a-fix] visual bounds 기반 bbox 크기 — shape의 실제 시각 영역 (파형/전파 등 돌출 포함)
    //   기존 metrics.sh는 shape 내부 기본 영역 → sensor/antenna 파형이 bbox 외부로 돌출
    //   _shapeVisualBounds는 실제 렌더되는 전체 영역 반환
    let _maxVisualW=0, _maxVisualH=0;
    _fig1LayoutNodes.forEach(nd=>{
      const st=matchIconShape(nd.label);
      const sm=_shapeMetrics(st,boxW2D,boxH);
      const vb=_shapeVisualBounds(st,0,0,sm.sw,sm.sh);
      const visualW=vb.right-vb.left;
      const visualH=vb.bottom-vb.top;
      if(visualW>_maxVisualW)_maxVisualW=visualW;
      if(visualH>_maxVisualH)_maxVisualH=visualH;
    });
    const _bboxPad=8;
    const _bboxW=Math.round(_maxVisualW+_bboxPad);
    const _bboxH=Math.round(_maxVisualH+_bboxPad);
    // shapeicon 하단 외부 라벨+부호 영역 (박스형은 내부)
    const _bboxExtLabelGap=12;  // bbox 하단 → 라벨 간격
    const _bboxExtRefGap=26;    // bbox 하단 → 부호 간격 (라벨 아래 14)
    const _bboxExtH=_bboxExtRefGap+12; // shapeicon: 외부 라벨+부호 총 높이
    // 박스형 전용: 부호를 상/좌/우 면에 배치할 때 여유 공간
    const _bboxRefMargin=16; // bbox 외곽 → 부호까지 거리

    // ═══ v17: 전역 행 높이 통일 — bbox + 외부 라벨/부호 포함 (shapeicon 기준) ═══
    let globalRowH=_bboxH+_bboxExtH;
    let globalShapeH=_bboxH-_bboxPad;

    // 행별 Y시작 좌표 — 모든 행 동일 높이
    const rowY={};
    let accY=marginY;
    for(let r=0;r<numRows;r++){
      rowY[r]=accY;
      accY+=globalRowH+rowGapBase;
    }
    // [C2-7] bbox + 외부 라벨 하단 기반 viewBox 높이
    let maxNodeBottom=0;
    nodes.forEach(nd=>{
      const gp=grid[nd.id];if(!gp)return;
      const by=rowY[gp.row];
      const bottom=by+_bboxH+_bboxExtH+10;
      if(bottom>maxNodeBottom)maxNodeBottom=bottom;
    });
    const totalH=maxNodeBottom+marginY*0.5;

    const leaderMargin=0.3*PX;
    const svgW=marginX+maxNodeAreaW+leaderMargin;
    const svgH=totalH;
    // ★ v20: maxW=svgW — 인위적 축소 제거, 컨테이너가 자연스럽게 제약 ★
    const maxW=svgW;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${maxW}px;background:white;border-radius:8px">`;
    const mkId=`ah_${containerId}`;
    svg+=`<defs><marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#000"/></marker></defs>`;
    
    // ══════════════════════════════════════════════════════════════
    // ★★★ v10.5: Phase 1~2 전면 재설계 — 균일 box + 실제 앵커 라우팅 ★★★
    // ══════════════════════════════════════════════════════════════
    
    // ── Phase 1: 위치 계산 — [C2-6 bbox] 통일 바운딩박스 시스템 ──
    // 모든 노드: 동일 크기 bbox (_bboxW × _bboxH) 내부에 배치
    // 라우팅(nodeBoxes): bbox 경계 기반 → 동일 cy → 직선 연결
    // 렌더링(nodeData): bbox 상부에 shape, 하부에 label + refnum
    const nodeBoxes={};   // bbox 기반 — 라우팅용
    const nodeData=[];    // shape 기반 — 렌더링용
    // [C2-8a-fix-2] anchor 영역 재계산 헬퍼 — sy 변경 후 _sx/_sy/_sw/_sh 갱신
    const _refreshAnchor=(ndId,shapeType,sx,sy,sw,sh)=>{
      if(_isIconShape(shapeType)){
        const vbAbs=_shapeVisualBounds(shapeType,sx,sy,sw,sh);
        nodeBoxes[ndId]._sx=vbAbs.left;
        nodeBoxes[ndId]._sy=vbAbs.top;
        nodeBoxes[ndId]._sw=vbAbs.right-vbAbs.left;
        nodeBoxes[ndId]._sh=vbAbs.bottom-vbAbs.top;
      } else {
        nodeBoxes[ndId]._sx=sx;
        nodeBoxes[ndId]._sy=sy;
        nodeBoxes[ndId]._sw=sw;
        nodeBoxes[ndId]._sh=sh;
      }
    };
    nodes.forEach(nd=>{
      const gp=grid[nd.id];
      if(!gp)return;
      const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
      const rowStartX=marginX+(maxNodeAreaW-rowW)/2;
      const bx=rowStartX+gp.col*(boxW2D+colGap);
      const by=rowY[gp.row];
      const refNum=extractRefNum(nd.label,String((parseInt(nd.id.replace(/\D/g,''))||1)*100));
      const displayLabel=_shortenFig1Label(nd.label);

      const shapeType=matchIconShape(nd.label);
      const sm=_shapeMetrics(shapeType,boxW2D,boxH);
      const fontSize=_computeDiagramFontSize(boxW2D,boxH,displayLabel.length);
      const textW=_estimateTextWidth(displayLabel,fontSize);
      const minShapeW=textW+20;
      if(sm.sw<minShapeW){
        sm.sw=Math.min(minShapeW,boxW2D*0.90);
        sm.dx=(boxW2D-sm.sw)/2;
      }
      // [C2-8a-fix] shape visual 중심을 bbox 중앙에 정렬
      //   sensor/antenna 등은 sm 기준점과 visual 중심이 다름 (파형이 한쪽에 치우침)
      //   visual 중심을 bbox 중앙에 맞추면 돌출 방향 없이 균형 배치
      const _bbxCenter=bx+(boxW2D)/2;  // bbox 수평 중심 (x)
      const _byCenter=by+_bboxH/2;     // bbox 수직 중심 (y)
      const _vb=_shapeVisualBounds(shapeType,0,0,sm.sw,sm.sh);
      const _vCx=(_vb.left+_vb.right)/2;  // shape 로컬 좌표 visual 중심 x
      const _vCy=(_vb.top+_vb.bottom)/2;  // shape 로컬 좌표 visual 중심 y
      const cappedSw=sm.sw;
      const cappedSh=sm.sh;
      const sx=_bbxCenter-_vCx;
      const sy=_byCenter-_vCy;

      // [C2-8a-fix-2] 라우팅용 nodeBox — 노드 유형별 anchor 영역 정밀화
      //   박스형: shape 실제 경계(sx,sy,sw,sh)를 anchor로 → 화살표가 박스에 정확히 닿음
      //              + _shapeType=actual → monitor/server 등 정밀 anchor 사용
      //   shapeicon: visual bounds(파형 포함 영역)를 anchor로 → 연결선이 파형과 겹침 없음
      //              + _shapeType='box' → visual rect 변 중앙 anchor (단순/안정)
      //   cx/cy/x/y/w/h(layout용)는 모든 노드 공통 (_bboxH 기준) — 행 정렬 일관성 유지
      const _bbx=bx+(boxW2D-_bboxW)/2;
      const _isIcon=_isIconShape(shapeType);
      let _ax, _ay, _aw, _ah, _anchorType;
      if(_isIcon){
        // shapeicon: visual bounds (파형/전파까지 포함, 하단 라벨 패딩 포함)
        const vbAbs=_shapeVisualBounds(shapeType,sx,sy,cappedSw,cappedSh);
        _ax=vbAbs.left; _ay=vbAbs.top;
        _aw=vbAbs.right-vbAbs.left; _ah=vbAbs.bottom-vbAbs.top;
        _anchorType='box';
      } else {
        // 박스형: shape 실제 경계 + 정밀 anchor
        _ax=sx; _ay=sy; _aw=cappedSw; _ah=cappedSh;
        _anchorType=shapeType;
      }
      nodeBoxes[nd.id]={
        x:_bbx, y:by, w:_bboxW, h:_bboxH,
        cx:bx+boxW2D/2, cy:by+_bboxH/2,
        _shapeType:_anchorType, _sx:_ax, _sy:_ay, _sw:_aw, _sh:_ah,
        _isIcon
      };
      nodeData.push({id:nd.id, sx, sy, sw:cappedSw, sh:cappedSh,
        shapeType, displayLabel, refNum, bx, boxW2D,
        row:gp.row, col:gp.col});
    });
    
    // ── Phase 1.5: 겹침 검증 (bbox 높이 기반) ──
    const REF_PADDING=6;
    const MIN_GAP=12;
    let correctionApplied=true;
    let correctionRounds=0;
    while(correctionApplied&&correctionRounds<10){
      correctionApplied=false;
      correctionRounds++;
      for(let i=0;i<nodeData.length;i++){
        const a=nodeData[i];
        const aBottom=nodeBoxes[a.id].y+_bboxH+_bboxExtH;
        for(let j=0;j<nodeData.length;j++){
          if(i===j)continue;
          const b=nodeData[j];
          if(a.row===b.row)continue;
          const hOverlap=!(a.sx+a.sw+8<b.sx||b.sx+b.sw+8<a.sx);
          if(hOverlap&&nodeBoxes[b.id].y<aBottom+MIN_GAP&&nodeBoxes[b.id].y>=nodeBoxes[a.id].y){
            const push=aBottom+MIN_GAP-nodeBoxes[b.id].y;
            if(push>0){
              b.sy+=push;
              nodeBoxes[b.id].y+=push;
              nodeBoxes[b.id].cy=nodeBoxes[b.id].y+_bboxH/2;
              _refreshAnchor(b.id,b.shapeType,b.sx,b.sy,b.sw,b.sh);
              correctionApplied=true;
            }
          }
        }
      }
    }
    
    // ── Phase 1.7: 양방향 엣지 동일행 강제 ── ★ FIX-3 ★
    // 양방향으로 연결된 노드 쌍이 다른 행에 있으면 한쪽을 이동하여 같은 행으로 맞춤
    if(biDirPairs&&biDirPairs.length>0){
      biDirPairs.forEach(pair=>{
        const nbA=nodeBoxes[pair.a], nbB=nodeBoxes[pair.b];
        if(!nbA||!nbB)return;
        const ndA=nodeData.find(d=>d.id===pair.a);
        const ndB=nodeData.find(d=>d.id===pair.b);
        if(!ndA||!ndB||ndA.row===ndB.row)return; // 이미 같은 행
        // 연결 수가 적은 쪽을 이동 대상으로 선택
        const degA=uniqueEdges.filter(e=>e.from===pair.a||e.to===pair.a).length;
        const degB=uniqueEdges.filter(e=>e.from===pair.b||e.to===pair.b).length;
        const[mover,target]=degA<=degB?[ndA,ndB]:[ndB,ndA];
        const moverBox=nodeBoxes[mover.id], targetBox=nodeBoxes[target.id];
        // mover를 target의 Y 위치로 이동
        const dy=targetBox.y-moverBox.y;
        moverBox.y+=dy; moverBox.cy+=dy;
        mover.sy+=dy;
        _refreshAnchor(mover.id,mover.shapeType,mover.sx,mover.sy,mover.sw,mover.sh);
        mover.row=target.row;
        console.log(`[FIX-3] 양방향 엣지: ${mover.id}→${target.id} 동일행 강제 (dy=${dy.toFixed(1)})`);
      });
      // 겹침 재검증
      let biOverlapFix=true;
      let biOverlapRounds=0;
      while(biOverlapFix&&biOverlapRounds<5){
        biOverlapFix=false;
        biOverlapRounds++;
        for(let i=0;i<nodeData.length;i++){
          const a=nodeData[i];
          for(let j=i+1;j<nodeData.length;j++){
            const b=nodeData[j];
            const hOverlap=!(a.sx+a.sw+8<b.sx||b.sx+b.sw+8<a.sx);
            const vOverlap=!(a.sy+a.sh+REF_PADDING+MIN_GAP<b.sy||b.sy+b.sh+REF_PADDING+MIN_GAP<a.sy);
            if(hOverlap&&vOverlap){
              // 수직으로 분리: 위쪽 노드는 유지, 아래쪽을 밀어냄
              const upper=a.sy<=b.sy?a:b;
              const lower=a.sy<=b.sy?b:a;
              const push=upper.sy+upper.sh+REF_PADDING+MIN_GAP-lower.sy;
              if(push>0){
                lower.sy+=push;
                nodeBoxes[lower.id].y+=push;
                nodeBoxes[lower.id].cy=nodeBoxes[lower.id].y+nodeBoxes[lower.id].h/2;
                _refreshAnchor(lower.id,lower.shapeType,lower.sx,lower.sy,lower.sw,lower.sh);
                biOverlapFix=true;
              }
            }
          }
        }
      }
    }

    // ═══ FIX-2: 겹침 보정 후 행 간격 균등화 재적용 (bbox 기반) ═══
    //   [C2-8a-fix] sy는 visual 중심 기준 재계산 (shape마다 visual 중심 오프셋 다름)
    nodeData.forEach(nd=>{
      const expectedY=rowY[nd.row];
      if(Math.abs(nodeBoxes[nd.id].y-expectedY)>2){
        const vb2=_shapeVisualBounds(nd.shapeType,0,0,nd.sw,nd.sh);
        const vCy2=(vb2.top+vb2.bottom)/2;
        nodeBoxes[nd.id].y=expectedY;
        nodeBoxes[nd.id].cy=expectedY+_bboxH/2;
        nd.sy=expectedY+_bboxH/2-vCy2;
        _refreshAnchor(nd.id,nd.shapeType,nd.sx,nd.sy,nd.sw,nd.sh);
      }
    });
    let reEqRounds=0;
    while(reEqRounds<3){
      let hasOverlap=false;
      for(let i=0;i<nodeData.length&&!hasOverlap;i++){
        const a=nodeData[i];
        for(let j=i+1;j<nodeData.length;j++){
          const b=nodeData[j];
          if(a.row===b.row)continue;
          const hOvl=!(a.sx+a.sw+8<b.sx||b.sx+b.sw+8<a.sx);
          const aBot=nodeBoxes[a.id].y+_bboxH+_bboxExtH+MIN_GAP;
          const bBot=nodeBoxes[b.id].y+_bboxH+_bboxExtH+MIN_GAP;
          if(hOvl&&((nodeBoxes[b.id].y<aBot&&nodeBoxes[b.id].y>=nodeBoxes[a.id].y)||(nodeBoxes[a.id].y<bBot&&nodeBoxes[a.id].y>=nodeBoxes[b.id].y))){
            hasOverlap=true;break;
          }
        }
      }
      if(!hasOverlap)break;
      globalRowH+=20;
      let reAccY=marginY;
      for(let r=0;r<numRows;r++){
        rowY[r]=reAccY;
        reAccY+=globalRowH+rowGapBase;
      }
      nodeData.forEach(nd=>{
        const ey=rowY[nd.row];
        // [C2-8a-fix] visual 중심 기반 sy 재계산
        const vb3=_shapeVisualBounds(nd.shapeType,0,0,nd.sw,nd.sh);
        const vCy3=(vb3.top+vb3.bottom)/2;
        nd.sy=ey+_bboxH/2-vCy3;
        nodeBoxes[nd.id].y=ey;
        nodeBoxes[nd.id].cy=ey+_bboxH/2;
        _refreshAnchor(nd.id,nd.shapeType,nd.sx,nd.sy,nd.sw,nd.sh);
      });
      reEqRounds++;
    }

    // ═══ FIX-3: 최종 bbox + 외부 라벨 기반 정확한 viewBox ═══
    let maxBottom=0;
    nodeData.forEach(nd=>{
      const bottom=nodeBoxes[nd.id].y+_bboxH+_bboxExtH+10;
      if(bottom>maxBottom)maxBottom=bottom;
    });
    const correctedSvgH=Math.max(svgH,maxBottom+marginY);
    svg=svg.replace(/viewBox="0 0 [^"]*"/,`viewBox="0 0 ${svgW} ${correctedSvgH}"`);

    // ── Phase 2: 연결선 — ★ 실제 shape anchor 기반 라우팅 ★ ──
    // 원칙: 모든 연결은 각 shape의 실제 변 중앙(edge center)에서 시작/끝
    // box shape → 균일 높이 → 같은 행 = 같은 cy → 자연스러운 직선 연결
    const svgEdgesToDraw=(uniqueEdges.length>0?uniqueEdges:
      (nodes.length>1?nodes.slice(0,-1).map((nd,i)=>({from:nd.id,to:nodes[i+1].id})):[]))
      .filter(e=>e.from!==e.to); // ★ P2-FIX: self-loop 제거 ★

    // ★ v13.0 FIX: allBoxArr 루프 밖 호이스트 (SVG Fig1) ★
    const allBoxArr=Object.entries(nodeBoxes).map(([k,v])=>({...v,id:k}));
    // ★ v10.6 FIX: 허브 노드 다중 엣지 앵커 offset (같은 면 출구 분산) ★
    const _exitCounts={};
    svgEdgesToDraw.forEach(e=>{
      const _fb=nodeBoxes[e.from],_tb=nodeBoxes[e.to];
      if(!_fb||!_tb)return;
      const _dx=_tb.cx-_fb.cx,_dy=_tb.cy-_fb.cy;
      const _isH=Math.abs(_dx)>=Math.abs(_dy);
      const _fDir=_isH?(_dx>0?'R':'L'):(_dy>0?'B':'T');
      const _tDir=_isH?(_dx>0?'L':'R'):(_dy>0?'T':'B');
      const _fk=e.from+'_'+_fDir,_tk=e.to+'_'+_tDir;
      if(!_exitCounts[_fk])_exitCounts[_fk]={total:0,idx:0};
      if(!_exitCounts[_tk])_exitCounts[_tk]={total:0,idx:0};
      _exitCounts[_fk].total++;
      _exitCounts[_tk].total++;
    });
    svgEdgesToDraw.forEach(e=>{
      const fb=nodeBoxes[e.from], tb=nodeBoxes[e.to];
      if(!fb||!tb)return;
      
      // 두 shape의 상대 위치로 연결 방향 결정
      const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
      const isHorizontal=Math.abs(dx)>=Math.abs(dy);
      
      let route;
      
      if(isHorizontal){
        // 수평 연결: from의 right/left → to의 left/right
        const goRight=dx>0;
        const _hfk=e.from+'_'+(goRight?'R':'L');
        const _htk=e.to+'_'+(goRight?'L':'R');
        const _hfOff=_exitCounts[_hfk]&&_exitCounts[_hfk].total>1?(_exitCounts[_hfk].idx++-(_exitCounts[_hfk].total-1)/2)*8:0;
        const _htOff=_exitCounts[_htk]&&_exitCounts[_htk].total>1?(_exitCounts[_htk].idx++-(_exitCounts[_htk].total-1)/2)*8:0;
        const fromAnc={
          x: goRight ? fb.x+fb.w : fb.x,
          y: fb.cy+_hfOff
        };
        const toAnc={
          x: goRight ? tb.x : tb.x+tb.w,
          y: tb.cy+_htOff
        };
        
        if(Math.abs(fromAnc.y-toAnc.y)<3){
          // 같은 Y → 완벽한 수평 직선
          route=[fromAnc, toAnc];
        }else{
          // Y 다름 → L-shape 라우팅
          const midX=(fromAnc.x+toAnc.x)/2;
          route=[fromAnc, {x:midX, y:fromAnc.y}, {x:midX, y:toAnc.y}, toAnc];
        }
      }else{
        // 수직 연결: from의 bottom/top → to의 top/bottom
        const goDown=dy>0;
        const _vfk=e.from+'_'+(goDown?'B':'T');
        const _vtk=e.to+'_'+(goDown?'T':'B');
        const _vfOff=_exitCounts[_vfk]&&_exitCounts[_vfk].total>1?(_exitCounts[_vfk].idx++-(_exitCounts[_vfk].total-1)/2)*8:0;
        const _vtOff=_exitCounts[_vtk]&&_exitCounts[_vtk].total>1?(_exitCounts[_vtk].idx++-(_exitCounts[_vtk].total-1)/2)*8:0;
        const fromAnc={
          x: fb.cx+_vfOff,
          y: goDown ? fb.y+fb.h : fb.y
        };
        const toAnc={
          x: tb.cx+_vtOff,
          y: goDown ? tb.y : tb.y+tb.h
        };
        
        if(Math.abs(fromAnc.x-toAnc.x)<3){
          // 같은 X → 완벽한 수직 직선
          route=[fromAnc, toAnc];
        }else{
          // X 다름 → L-shape 라우팅
          const midY=(fromAnc.y+toAnc.y)/2;
          route=[fromAnc, {x:fromAnc.x, y:midY}, {x:toAnc.x, y:midY}, toAnc];
        }
      }
      
      // ★ 충돌 검사: route가 다른 shape을 관통하면 우회 ★
      const excludeIds=new Set([e.from, e.to]);
      const collisions=_countRouteCollisions(route, allBoxArr, excludeIds);

      if(collisions>0){
        const fbA={...fb, id:e.from};
        const tbA={...tb, id:e.to};
        const altRoute=getOrthogonalRoute(fbA, tbA, allBoxArr);
        if(altRoute){
          const snapped=_snapRouteToShapeAnchors(altRoute, fb, tb, 0, 0, allBoxArr);
          if(_countRouteCollisions(snapped, allBoxArr, excludeIds)===0){
            route=snapped;
          }else{
            // ★ v18: 직교 라우터도 관통 → 외곽 우회 ★
            const allLeft=Math.min(...allBoxArr.map(b=>b.x))-25;
            const allRight=Math.max(...allBoxArr.map(b=>b.x+b.w))+25;
            const fromAnc2=route[0], toAnc2=route[route.length-1];
            const detourX=Math.abs(fromAnc2.x-allLeft)<Math.abs(fromAnc2.x-allRight)?allLeft:allRight;
            const extRoute=[
              fromAnc2,
              {x:fromAnc2.x,y:fromAnc2.y+10},
              {x:detourX,y:fromAnc2.y+10},
              {x:detourX,y:toAnc2.y-10},
              {x:toAnc2.x,y:toAnc2.y-10},
              toAnc2
            ];
            if(_countRouteCollisions(extRoute,allBoxArr,excludeIds)<_countRouteCollisions(snapped,allBoxArr,excludeIds)){
              route=extRoute;
            }else{
              route=snapped;
            }
          }
        }
      }else{
        // ★ v20: 충돌 없어도 shape 앵커에 스냅 — 라우팅 박스가 아닌 실제 shape 경계에 연결 ★
        route=_snapRouteToShapeAnchors(route, fb, tb, 0, 0, allBoxArr);
      }
      
      if(route)svg+=svgOrthogonalEdge(route,mkId,!!e._wasBidirectional);
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
    // ★ v10.4: 도면 내 균일 폰트 크기 — 전체 shape 중 최소 높이 기준 ★
    const baseFontSize=Math.max(7,(maxCols>2?10:maxCols>1?11:12)+_fo);
    // 비-아이콘 shape 중 최소 높이를 기준으로 폰트 크기 결정
    const nonIconHeights=nodeData.filter(nd=>!_isIconShape(nd.shapeType)).map(nd=>nd.sh);
    const minShapeH=nonIconHeights.length>0?Math.min(...nonIconHeights):boxH;
    const uniformHeightFont=Math.floor(minShapeH*0.22);
    const figFontSize=Math.max(baseFontSize, Math.min(uniformHeightFont, 14)); // 14px cap — 도면 내 통일

    // [C2-8a] 노드 유형별 렌더 — 박스형(명칭 내부+부호 empty side) / shapeicon(명칭+부호 하단 외부)
    nodeData.forEach(nd=>{
      const{id,sx,sy,sw,sh,shapeType,displayLabel,refNum}=nd;
      const _bx=nodeBoxes[id].x; // bbox 좌측 x
      const _by=nodeBoxes[id].y; // bbox 상단 y
      const _bcx=_bx+_bboxW/2;   // bbox 중앙 x
      const _bcy=_by+_bboxH/2;   // bbox 중앙 y
      const isIcon=_isIconShape(shapeType);

      // shape 렌더 (박스형/shapeicon 공통)
      svg+=_drawShapeShadow(shapeType,sx+SHADOW_OFFSET,sy+SHADOW_OFFSET,sw,sh);
      svg+=_drawShapeBody(shapeType,sx,sy,sw,sh,2);
      const fontSize=figFontSize;

      if(isIcon){
        // [C2-8a] shapeicon: 명칭 bbox 외부 하단, 부호 명칭 바로 아래 (연속 배치)
        const labelMaxW=_bboxW*0.95;
        const _labelY=_by+_bboxH+_bboxExtLabelGap;
        const {svg:lSvg}=_svgMultiLineLabel(_bcx, _labelY, displayLabel, labelMaxW, fontSize, {minFontSize:7});
        svg+=lSvg;
        const _refY=_by+_bboxH+_bboxExtRefGap;
        svg+=`<text x="${_bcx}" y="${_refY}" text-anchor="middle" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      } else {
        // [C2-8a] 박스형: 명칭 shape 내부 중앙, 부호 연결선 없는 면
        const labelMaxW=sw*0.85;
        const _textCy=_shapeTextCy(shapeType,sy,sh);
        const {svg:lSvg}=_svgMultiLineLabel(sx+sw/2, _textCy, displayLabel, labelMaxW, fontSize, {minFontSize:7});
        svg+=lSvg;

        // [C2-8a] 부호 위치 — 연결선 없는 면
        const emptySide=_findEmptySide(id, svgEdgesToDraw, grid);
        let refX, refY, refAnchor='middle';
        switch(emptySide){
          case 'top':    refX=_bcx;             refY=_by-_bboxRefMargin/2-4;  refAnchor='middle'; break;
          case 'bottom': refX=_bcx;             refY=_by+_bboxH+_bboxRefMargin; refAnchor='middle'; break;
          case 'left':   refX=_bx-4;            refY=_bcy+4;                  refAnchor='end'; break;
          case 'right':  refX=_bx+_bboxW+4;     refY=_bcy+4;                  refAnchor='start'; break;
          default:       refX=_bcx;             refY=_by+_bboxH+_bboxRefMargin; refAnchor='middle';
        }
        svg+=`<text x="${refX}" y="${refY}" text-anchor="${refAnchor}" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
      }
    });

    // [C2-4] all-L1 렌더 검증 — grid 누락 노드 강제 복구
    if(_isAllL1Flat&&nodeData.length<_fig1LayoutNodes.length){
      console.warn(`[C2-4] 렌더 누락 감지: ${nodeData.length}/${_fig1LayoutNodes.length}개 렌더됨 — 누락 노드 복구`);
      let _recovY=marginY;
      if(nodeData.length>0)_recovY=Math.max(...nodeData.map(nd=>nd.sy+nd.sh))+rowGapBase+refNumH;
      let _recovIdx=0;
      _fig1LayoutNodes.forEach(nd=>{
        if(nodeBoxes[nd.id])return;
        const rx=marginX+_recovIdx*(boxW2D+colGap);
        const ry=_recovY;
        const refNum=extractRefNum(nd.label,'');
        const displayLabel=_shortenFig1Label(nd.label);
        svg+=_drawShapeShadow('box',rx+SHADOW_OFFSET,ry+SHADOW_OFFSET,boxW2D,boxH,1);
        svg+=_drawShapeBody('box',rx,ry,boxW2D,boxH,2);
        const{svg:lSvg}=_svgMultiLineLabel(rx+boxW2D/2,ry+boxH/2,displayLabel,boxW2D*0.9,11,{minFontSize:7});
        svg+=lSvg;
        if(refNum)svg+=`<text x="${rx+boxW2D/2}" y="${ry+boxH+16}" text-anchor="middle" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${refNum}</text>`;
        nodeBoxes[nd.id]={x:rx,y:ry,w:_bboxW,h:_bboxH,cx:rx+boxW2D/2,cy:ry+_bboxH/2,_sx:rx,_sy:ry,_sw:Math.min(boxW2D,_bboxW),_sh:Math.min(boxH,_bboxH-8),_shapeType:'box'};
        _recovIdx++;
      });
      // [C2-4] viewBox 재확장 — 복구 노드 포함
      let _recovMaxBottom=0;
      Object.values(nodeBoxes).forEach(b=>{
        const bot=(b._sy||b.y)+(b._sh||b.h)+_bboxExtH+10;
        if(bot>_recovMaxBottom)_recovMaxBottom=bot;
      });
      const _recovSvgH=Math.max(correctedSvgH,_recovMaxBottom+marginY);
      if(_recovSvgH>correctedSvgH){
        svg=svg.replace(/viewBox="0 0 [^"]*"/,`viewBox="0 0 ${svgW} ${_recovSvgH}"`);
      }
    }

    // [C2-2] container 프레임 렌더 — 일반 노드 위에 점선 프레임 오버레이
    _fig1Containers.forEach(cn=>{
      const cRef=parseInt((extractRefNum(cn.label,'')||'').replace(/\D/g,''));
      const childBoxArr=Object.entries(nodeBoxes).filter(([id])=>{
        if(isNaN(cRef))return true;
        const nd=_fig1LayoutNodes.find(n=>n.id===id);
        if(!nd)return false;
        const nRef=parseInt((extractRefNum(nd.label,'')||'').replace(/\D/g,''));
        return !isNaN(nRef)&&Math.floor(nRef/100)===Math.floor(cRef/100);
      }).map(([,b])=>b);
      if(childBoxArr.length===0)return;
      let cMinX=Infinity,cMinY=Infinity,cMaxX=-Infinity,cMaxY=-Infinity;
      childBoxArr.forEach(b=>{
        cMinX=Math.min(cMinX,b._sx);cMinY=Math.min(cMinY,b._sy);
        cMaxX=Math.max(cMaxX,b._sx+b._sw);cMaxY=Math.max(cMaxY,b._sy+b._sh+30);
      });
      const cPad=10,cLblH=16;
      const cfx=cMinX-cPad,cfy=cMinY-cPad-cLblH;
      const cfw=(cMaxX-cMinX)+cPad*2,cfh=(cMaxY-cMinY)+cPad*2+cLblH;
      svg+=`<rect x="${cfx}" y="${cfy}" width="${cfw}" height="${cfh}" fill="none" stroke="#666" stroke-width="1.5" stroke-dasharray="6,3" rx="4"/>`;
      const cLabel=_safeCleanLabel(cn.label);
      svg+=`<text x="${cfx+6}" y="${cfy+12}" font-size="10" font-weight="bold" font-family="맑은 고딕,Arial,sans-serif" fill="#555">${App.escapeHtml(cLabel)}</text>`;
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
    
    // ★ v10.4: L2/L3 계층 감지 — L2 부모를 서브 프레임으로 변환 ★
    // L2 부모 노드가 L3 자식을 가지면, L2는 표시 노드에서 제거하고 서브 프레임으로 렌더링
    const l2Parents={}; // {l2RefNum: {node, children:[L3 nodes]}}
    innerNodes.forEach(n=>{
      const ref=extractRefNum(n.label,'');
      if(!ref)return;
      const num=parseInt(ref);
      if(isNaN(num))return;
      // L2 판별: x10 단위 (110, 120 등)
      if(num>=100&&num<1000&&num%10===0&&num%100!==0){
        if(!l2Parents[num])l2Parents[num]={node:n, children:[]};
        else l2Parents[num].node=n;
      }
      // L3 판별: x1 단위 (111, 112 등) → 부모 L2 계산
      if(num>=100&&num<1000&&num%10!==0){
        const parentL2=Math.floor(num/10)*10;
        if(!l2Parents[parentL2])l2Parents[parentL2]={node:null, children:[]};
        l2Parents[parentL2].children.push(n);
      }
    });
    
    // L3 자식이 있는 L2 부모는 서브 프레임으로 전환 (표시 노드에서 제거)
    const l2SubFrames={}; // L2 부모 중 자식이 있는 것만
    const l2ParentIdsToRemove=new Set();
    Object.entries(l2Parents).forEach(([ref,info])=>{
      if(info.node&&info.children.length>0){
        l2SubFrames[ref]=info;
        l2ParentIdsToRemove.add(info.node.id);
      }
    });
    
    // L2 부모를 제거한 표시 노드 목록
    const displayNodesFiltered=innerNodes.filter(n=>!l2ParentIdsToRemove.has(n.id));
    const displayNodes=displayNodesFiltered.length>0?displayNodesFiltered:(innerNodes.length>0?innerNodes:nodes);
    
    // 내부 노드 2D 레이아웃 계산
    const innerLayout=computeDeviceLayout2D(displayNodes,edges,figNum);
    const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;

    // ═══ v19: 전체 도면 세트 기준 블록 크기 통일 (정규화) ═══
    const _effectiveCols=Math.max(innerMaxCols, globalMaxInnerCols||innerMaxCols);
    const _rawInnerBoxW=(_effectiveCols===2?3.2:2.4)*PX*_bwm;
    const innerBoxW=Math.min(_rawInnerBoxW, 3.5*PX*_bwm);
    console.log(`[v19] 도 ${figNum}: effCols=${_effectiveCols} inner=${innerMaxCols} global=${globalMaxInnerCols} boxW=${innerBoxW.toFixed(0)}`);
    const boxH2=(_effectiveCols===2?0.95:1.05)*PX*_bhm;
    // ★ v20: 간격 축소 — svgW 감소 → 도면 간 표시 크기 통일 ★
    const _fig2ColGap=0.8*PX*_sm;
    const _fig2RowGap=1.0*PX*_sm;
    const _fig2FramePad=0.7*PX*_sm;
    const fig2Layout=computeFig2Layout(displayNodes,edges,innerGrid,_effectiveCols,innerNumRows,innerUniqueEdges,frameRefNum,{
      boxBaseW:innerBoxW, boxBaseH:boxH2,
      colGap:_fig2ColGap,
      rowGap:_fig2RowGap,
      framePad:_fig2FramePad,
      shadowSize:SHADOW_OFFSET,
      scale:PX
    });

    const frameX=0.5*PX, frameY=0.5*PX;
    const frameW=fig2Layout.frameW;
    const frameH=fig2Layout.frameH;
    const leaderMargin=0.6*PX;
    const svgW=frameX+frameW+leaderMargin;
    const svgH=frameY+frameH+0.5*PX;
    // ★ v20: maxW=svgW — 인위적 축소 제거, 도면 간 블록 크기 통일 ★
    const maxW=svgW;
    
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${maxW}px;background:white;border-radius:8px">`;
    const mkId=`ah_${containerId}`;
    svg+=`<defs><marker id="${mkId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#000"/></marker></defs>`;
    
    // 1. 최외곽 프레임 (그림자 + 본체)
    svg+=`<rect x="${frameX+SHADOW_OFFSET}" y="${frameY+SHADOW_OFFSET}" width="${frameW}" height="${frameH}" fill="#000" opacity="0.15"/>`;
    svg+=`<rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="#fff" stroke="#000" stroke-width="2.25"/>`;
    
    // 2. 내부 노드 렌더링 — 레이아웃 엔진에서 계산된 좌표 사용
    // ★ v10.4: 도면 내 균일 폰트 크기 — 전체 shape 중 최소 높이 기준 ★
    const fig2BaseFontSize=Math.max(7,(_effectiveCols>2?9:_effectiveCols>1?10:11)+_fo);
    const fig2ShapeHeights=fig2Layout.objects.map(obj=>{
      const nd=displayNodes.find(n=>n.id===obj.id);
      if(!nd)return obj.h;
      const st=matchIconShape(nd.label);
      const sm=_shapeMetrics(st,obj.w,obj.h);
      return sm.sh;
    });
    const fig2MinH=fig2ShapeHeights.length>0?Math.min(...fig2ShapeHeights):boxH2;
    const fig2HeightFont=Math.floor(fig2MinH*0.22);
    const fig2FontSize=Math.max(fig2BaseFontSize, Math.min(fig2HeightFont, 13)); // 13px cap — 도 2+ 통일
    
    const innerNodeBoxes={};
    fig2Layout.objects.forEach(obj=>{
      const bx=frameX+obj.x;
      const by=frameY+obj.y;
      const nd=displayNodes.find(n=>n.id===obj.id);
      if(!nd)return;
      const refNum=extractRefNum(nd.label,String(obj.fallbackRef));
      const shapeType=matchIconShape(nd.label);
      const sm=_shapeMetrics(shapeType,obj.w,obj.h);
      // v10.3: 텍스트 너비 기반 최소 shape 너비 (도 2+ SVG)
      const cleanLabel=_safeCleanLabel(nd.label);
      // ★ v10.4: 잘림("…") 완전 제거 — 전체 라벨 표시 ★
      const displayLabel=cleanLabel;
      const fontSize2=_effectiveCols>2?9:_effectiveCols>1?10:11;
      const textW2=_estimateTextWidth(displayLabel,fontSize2);
      const minSw2=textW2+16;
      if(sm.sw<minSw2&&shapeType!=='box'){
        sm.sw=Math.min(minSw2,obj.w*0.90);
        sm.dx=(obj.w-sm.sw)/2;
      }
      const sx=bx+(obj.w-sm.sw)/2, sy=by;
      
      svg+=_drawShapeShadow(shapeType,sx+SHADOW_OFFSET,sy+SHADOW_OFFSET,sm.sw,sm.sh);
      svg+=_drawShapeBody(shapeType,sx,sy,sm.sw,sm.sh,1.5);
      const textCy=_shapeTextCy(shapeType,sy,sm.sh);
      const fontSize2Final=fig2FontSize; // ★ v10.4: 도면 내 균일 폰트 ★
      
      // 박스 내부 2줄: 라벨 + (참조번호) — v10.4: 멀티라인 지원 + 비례 폰트
      const labelMaxW=sm.sw*0.90;
      const labelFit=_fitLabelLines(displayLabel,labelMaxW,fontSize2Final,7);
      const labelYOffset=labelFit.lines.length>1?-4:0;
      const {svg:lSvg}=_svgMultiLineLabel(
        sx+sm.sw/2, textCy+labelYOffset-2, displayLabel, labelMaxW, fontSize2Final, {minFontSize:7}
      );
      svg+=lSvg;
      const refFontSize=Math.max(fontSize2Final-1,8);
      const refY=labelFit.lines.length>1?textCy+labelFit.fontSize+6:textCy+fontSize2Final+2;
      svg+=`<text x="${sx+sm.sw/2}" y="${refY}" text-anchor="middle" font-size="${refFontSize}" font-family="맑은 고딕,Arial,sans-serif" fill="#444">(${refNum})</text>`;
      
      innerNodeBoxes[nd.id]={x:sx,y:sy,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:sy+sm.sh/2,
        _shapeType:shapeType,_sx:sx,_sy:sy,_sw:sm.sw,_sh:sm.sh};
    });
    
    // ★ v10.4: L2 서브 프레임 렌더링 — L2 부모의 L3 자식들을 시각적으로 그룹화 ★
    Object.entries(l2SubFrames).forEach(([l2Ref,info])=>{
      if(!info.node||info.children.length===0)return;
      // L3 자식 노드들의 경계 계산
      const childBoxes=info.children.map(c=>{
        const box=innerNodeBoxes[c.id];
        return box;
      }).filter(Boolean);
      if(childBoxes.length===0)return;
      
      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      childBoxes.forEach(b=>{
        minX=Math.min(minX, b.x);
        minY=Math.min(minY, b.y);
        maxX=Math.max(maxX, b.x+b.w);
        maxY=Math.max(maxY, b.y+b.h);
      });
      
      // 패딩 추가
      const sfPad=12;
      let sfX=minX-sfPad;
      let sfY=minY-sfPad-16; // 상단에 라벨 공간
      let sfW=(maxX-minX)+sfPad*2;
      let sfH=(maxY-minY)+sfPad*2+16;

      // ★ v20: 서브 프레임이 외곽 프레임과 겹치지 않도록 최소 간격 확보 ★
      const sfMinGap=6;
      const sfFrameL=frameX+sfMinGap, sfFrameT=frameY+sfMinGap;
      const sfFrameR=frameX+frameW-sfMinGap, sfFrameB=frameY+frameH-sfMinGap;
      if(sfX<sfFrameL){sfW-=(sfFrameL-sfX);sfX=sfFrameL;}
      if(sfY<sfFrameT){sfH-=(sfFrameT-sfY);sfY=sfFrameT;}
      if(sfX+sfW>sfFrameR){sfW=sfFrameR-sfX;}
      if(sfY+sfH>sfFrameB){sfH=sfFrameB-sfY;}

      // 서브 프레임 그리기 (점선)
      svg+=`<rect x="${sfX}" y="${sfY}" width="${sfW}" height="${sfH}" fill="none" stroke="#666" stroke-width="1" stroke-dasharray="6,3" rx="3"/>`;
      
      // L2 부모 라벨 + 참조번호
      const l2Label=_safeCleanLabel(info.node.label);
      svg+=`<text x="${sfX+6}" y="${sfY+11}" font-size="9" font-family="맑은 고딕,Arial,sans-serif" fill="#666">${App.escapeHtml(l2Label)} (${l2Ref})</text>`;
    });
    
    // 3. 프레임 참조번호 외부 리더라인
    const frameLeaderEndX=frameX+frameW+0.3*PX;
    const frameLeaderY=frameY+frameH/2;
    svg+=`<line x1="${frameX+frameW}" y1="${frameLeaderY}" x2="${frameLeaderEndX}" y2="${frameLeaderY}" stroke="#000" stroke-width="1"/>`;
    svg+=`<text x="${frameLeaderEndX+8}" y="${frameLeaderY+4}" font-size="${REF_NUM_FONT_SIZE}" font-family="맑은 고딕,Arial,sans-serif" fill="#000">${frameRefNum}</text>`;
    
    // 4. ★★ v10.5: 실제 앵커 기반 연결선 + 충돌 검사 (Fig 2+) ★★
    const innerEdgesToDraw2=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
    
    // ★ v13.0 FIX: allBoxArr 루프 밖 호이스트 (PPTX A6과 동일 수정) ★
    const allBoxArr=Object.entries(innerNodeBoxes).map(([k,v])=>({...v,id:k}));
    innerEdgesToDraw2.forEach(e=>{
      const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
      if(!fb||!tb)return;
      
      const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
      const isH=Math.abs(dx)>=Math.abs(dy);
      
      let route;
      if(isH){
        const goR=dx>0;
        const fromAnc={x:goR?fb.x+fb.w:fb.x, y:fb.cy};
        const toAnc={x:goR?tb.x:tb.x+tb.w, y:tb.cy};
        if(Math.abs(fromAnc.y-toAnc.y)<3){
          route=[fromAnc, toAnc];
        }else{
          const midX=(fromAnc.x+toAnc.x)/2;
          route=[fromAnc, {x:midX,y:fromAnc.y}, {x:midX,y:toAnc.y}, toAnc];
        }
      }else{
        const goD=dy>0;
        const fromAnc={x:fb.cx, y:goD?fb.y+fb.h:fb.y};
        const toAnc={x:tb.cx, y:goD?tb.y:tb.y+tb.h};
        if(Math.abs(fromAnc.x-toAnc.x)<3){
          route=[fromAnc, toAnc];
        }else{
          const midY=(fromAnc.y+toAnc.y)/2;
          route=[fromAnc, {x:fromAnc.x,y:midY}, {x:toAnc.x,y:midY}, toAnc];
        }
      }
      
      // ★ 충돌 검사: 다른 shape을 관통하면 우회 ★
      // ★ v13.0: allBoxArr는 루프 밖에서 1회 생성 ★
      const excludeIds=new Set([e.from, e.to]);
      if(_countRouteCollisions(route, allBoxArr, excludeIds)>0){
        // 관통 시 직교 라우터로 폴백
        const fbA={...fb, id:e.from};
        const tbA={...tb, id:e.to};
        const altRoute=getOrthogonalRoute(fbA, tbA, allBoxArr);
        if(altRoute){
          route=_snapRouteToShapeAnchors(altRoute, fb, tb, 0, 0, allBoxArr);
          // 2차 충돌 검사 — 직교 라우터도 관통하면 직접 우회 경로 생성
          if(_countRouteCollisions(route, allBoxArr, excludeIds)>0){
            // 장애물을 돌아가는 경로 강제 생성
            const fromAnc2=isH?{x:dx>0?fb.x+fb.w:fb.x, y:fb.cy}:{x:fb.cx, y:dy>0?fb.y+fb.h:fb.y};
            const toAnc2=isH?{x:dx>0?tb.x:tb.x+tb.w, y:tb.cy}:{x:tb.cx, y:dy>0?tb.y:tb.y+tb.h};
            // 장애물 위/아래로 우회
            let bestDetour=null, bestHits=Infinity;
            const obstacles=allBoxArr.filter(b=>!excludeIds.has(b.id));
            for(const obs of obstacles){
              // 위 우회
              const topY=obs.y-12;
              const detourTop=[fromAnc2,{x:fromAnc2.x,y:topY},{x:toAnc2.x,y:topY},toAnc2];
              const hitsTop=_countRouteCollisions(detourTop,allBoxArr,excludeIds);
              if(hitsTop<bestHits){bestHits=hitsTop;bestDetour=detourTop;}
              // 아래 우회
              const botY=obs.y+obs.h+12;
              const detourBot=[fromAnc2,{x:fromAnc2.x,y:botY},{x:toAnc2.x,y:botY},toAnc2];
              const hitsBot=_countRouteCollisions(detourBot,allBoxArr,excludeIds);
              if(hitsBot<bestHits){bestHits=hitsBot;bestDetour=detourBot;}
              // 왼쪽 우회
              const leftX=obs.x-12;
              const detourL=[fromAnc2,{x:leftX,y:fromAnc2.y},{x:leftX,y:toAnc2.y},toAnc2];
              const hitsL=_countRouteCollisions(detourL,allBoxArr,excludeIds);
              if(hitsL<bestHits){bestHits=hitsL;bestDetour=detourL;}
              // 오른쪽 우회
              const rightX=obs.x+obs.w+12;
              const detourR=[fromAnc2,{x:rightX,y:fromAnc2.y},{x:rightX,y:toAnc2.y},toAnc2];
              const hitsR=_countRouteCollisions(detourR,allBoxArr,excludeIds);
              if(hitsR<bestHits){bestHits=hitsR;bestDetour=detourR;}
            }
            if(bestDetour){
              route=bestDetour;
              // ★ v18: 3차 — 개별 장애물 우회도 관통하면 전체 외곽 우회 ★
              if(bestHits>0){
                const allLeft=Math.min(...allBoxArr.map(b=>b.x))-25;
                const allRight=Math.max(...allBoxArr.map(b=>b.x+b.w))+25;
                const detourX=Math.abs(fromAnc2.x-allLeft)<Math.abs(fromAnc2.x-allRight)?allLeft:allRight;
                const extRoute=[
                  fromAnc2,
                  {x:fromAnc2.x,y:fromAnc2.y+(dy>0?10:-10)},
                  {x:detourX,y:fromAnc2.y+(dy>0?10:-10)},
                  {x:detourX,y:toAnc2.y+(dy>0?-10:10)},
                  {x:toAnc2.x,y:toAnc2.y+(dy>0?-10:10)},
                  toAnc2
                ];
                if(_countRouteCollisions(extRoute,allBoxArr,excludeIds)<bestHits){
                  route=extRoute;
                }
              }
            }
          }
        }
      }
      if(route)svg+=svgOrthogonalEdge(route,mkId,!!e._wasBidirectional);
    });
    
    svg+='</svg>';
    const c=document.getElementById(containerId);
    if(c)c.innerHTML=svg;
  }
}

// ═══ v10.4: 포스트 렌더 검증 시스템 — SVG DOM 기반 겹침/잘림/연결 검증 ═══
// 렌더링된 SVG를 실제 DOM에서 분석하여 시각적 문제를 자동 감지 + 보정

function _postRenderValidateSvg(containerId, figNum){
  // ★ v10.4 Enhanced: 철저한 SVG DOM 기반 시각적 검증 ★
  const container=document.getElementById(containerId);
  if(!container)return{issues:[],pass:true};
  const svgEl=container.querySelector('svg');
  if(!svgEl)return{issues:[],pass:true};
  
  const issues=[];
  
  // viewBox 파싱
  const vb=(svgEl.getAttribute('viewBox')||'').split(/\s+/).map(Number);
  const svgW=vb[2]||800, svgH=vb[3]||600;
  
  // ── 1단계: 모든 요소 수집 ──
  
  // 1a. 텍스트 요소
  const textEls=svgEl.querySelectorAll('text');
  const textBoxes=[];
  textEls.forEach(t=>{
    try{
      const bbox=t.getBBox();
      if(bbox.width>0&&bbox.height>0){
        textBoxes.push({
          el:t, x:bbox.x, y:bbox.y, w:bbox.width, h:bbox.height,
          text:t.textContent||'', 
          fontSize:parseFloat(t.getAttribute('font-size'))||11
        });
      }
    }catch(e){}
  });
  
  // 1b. Shape 요소 (그림자/배경 제외)
  const shapeBoxes=[];
  const shadowFills=['#000','black'];
  svgEl.querySelectorAll('rect,circle,ellipse,polygon,path').forEach(el=>{
    try{
      const fill=el.getAttribute('fill')||'';
      const stroke=el.getAttribute('stroke')||'';
      const opacity=parseFloat(el.getAttribute('opacity')||'1');
      // 그림자 제외 (fill="#000" + opacity<1, 또는 stroke 없이 fill="#000")
      if(shadowFills.includes(fill)&&(opacity<1||!stroke))return;
      // 흰색 배경 rect 제외 (텍스트 배경용)
      if(fill==='#fff'&&!stroke&&el.tagName==='rect')return;
      // 마커(arrowhead) 내부 요소 제외
      if(el.closest('marker'))return;
      
      const bbox=el.getBBox();
      if(bbox.width<5||bbox.height<5)return; // 너무 작은 장식 요소 제외
      
      shapeBoxes.push({el, x:bbox.x,y:bbox.y,w:bbox.width,h:bbox.height, 
        type:el.tagName, fill, stroke});
    }catch(e){}
  });
  
  // 1c. 연결선 요소 (polyline with marker)
  const connectionLines=[];
  svgEl.querySelectorAll('polyline[marker-end],line[marker-end],path[marker-end]').forEach(el=>{
    try{
      const bbox=el.getBBox();
      // 연결선의 시작/끝점 추출
      if(el.tagName==='polyline'){
        const pts=(el.getAttribute('points')||'').trim().split(/\s+/).map(p=>{
          const [x,y]=p.split(',').map(Number);
          return{x,y};
        }).filter(p=>!isNaN(p.x)&&!isNaN(p.y));
        if(pts.length>=2){
          connectionLines.push({el, start:pts[0], end:pts[pts.length-1], points:pts});
        }
      }else if(el.tagName==='path'){
        // path 요소의 d 속성에서 좌표 추출
        const d=el.getAttribute('d')||'';
        const coords=[];
        const re=/[ML]\s*([\d.e+-]+)[,\s]+([\d.e+-]+)/gi;
        let m;while((m=re.exec(d))!==null)coords.push({x:parseFloat(m[1]),y:parseFloat(m[2])});
        if(coords.length>=2){
          connectionLines.push({el, start:coords[0], end:coords[coords.length-1], points:coords});
        }
      }
    }catch(e){}
  });
  
  // ── 검사 A: 텍스트-텍스트 겹침 (감도 향상) ──
  for(let i=0;i<textBoxes.length;i++){
    for(let j=i+1;j<textBoxes.length;j++){
      const a=textBoxes[i], b=textBoxes[j];
      const overlapX=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
      const overlapY=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      const overlapArea=overlapX*overlapY;
      const minArea=Math.min(a.w*a.h,b.w*b.h);
      // ★ 10% 이상 겹침이면 감지 (기존 15% → 10%) ★
      if(overlapArea>minArea*0.10&&overlapArea>20){
        issues.push({
          type:'TEXT_OVERLAP', severity:'ERROR',
          msg:`텍스트 겹침: "${a.text.slice(0,15)}" ↔ "${b.text.slice(0,15)}" (${Math.round(overlapArea)}px²)`,
          elements:[a,b], overlapArea
        });
      }
    }
  }
  
  // ── 검사 B: 텍스트가 SVG 경계 밖으로 잘림 ──
  textBoxes.forEach(tb=>{
    const margin=svgW*0.02; // 2% 마진 허용
    const clipRight=tb.x+tb.w-(svgW-margin);
    const clipBottom=tb.y+tb.h-(svgH-margin);
    const clipLeft=margin-tb.x;
    const clipTop=margin-tb.y;
    if(clipRight>2||clipBottom>2||clipLeft>2||clipTop>2){
      issues.push({
        type:'TEXT_CLIPPED', severity:'WARNING',
        msg:`텍스트 잘림: "${tb.text.slice(0,12)}" (R:${Math.round(clipRight)} B:${Math.round(clipBottom)})`,
        element:tb, clip:{right:clipRight,bottom:clipBottom,left:clipLeft,top:clipTop}
      });
    }
  });
  
  // ── 검사 C: 텍스트-Shape 겹침 (라벨이 다른 shape 위에 올라감) ──
  textBoxes.forEach(tb=>{
    if(/^\(?\d+\)?$/.test(tb.text.trim()))return; // 참조번호 제외
    if(tb.text.trim().length<=1)return;
    
    const tcx=tb.x+tb.w/2, tcy=tb.y+tb.h/2;
    
    shapeBoxes.forEach(sb=>{
      // 프레임(가장 큰 shape) 제외
      if(sb.w>svgW*0.5)return;
      
      const scx=sb.x+sb.w/2, scy=sb.y+sb.h/2;
      // 텍스트가 이 shape의 내부 라벨인지 확인 (중앙 간 거리로 판정)
      const isOwnLabel=Math.abs(tcx-scx)<sb.w*0.6&&Math.abs(tcy-scy)<sb.h*0.8;
      if(isOwnLabel)return; // 자기 shape 라벨은 정상
      
      // 다른 shape의 영역에 텍스트가 겹침?
      const overlapX=Math.max(0,Math.min(tb.x+tb.w,sb.x+sb.w)-Math.max(tb.x,sb.x));
      const overlapY=Math.max(0,Math.min(tb.y+tb.h,sb.y+sb.h)-Math.max(tb.y,sb.y));
      if(overlapX>5&&overlapY>5){
        issues.push({
          type:'TEXT_SHAPE_CROSS', severity:'ERROR',
          msg:`텍스트 "${tb.text.slice(0,12)}" 다른 shape 영역 침범 (${Math.round(overlapX)}×${Math.round(overlapY)}px)`,
          element:tb, shape:sb
        });
      }
    });
  });
  
  // ── 검사 D: shape-shape 겹침 ──
  for(let i=0;i<shapeBoxes.length;i++){
    for(let j=i+1;j<shapeBoxes.length;j++){
      const a=shapeBoxes[i], b=shapeBoxes[j];
      if(a.w>svgW*0.5||b.w>svgW*0.5)continue; // 프레임 제외
      // 같은 shape 내부 요소 (ex: circle inside rect) 제외
      if(a.el.contains(b.el)||b.el.contains(a.el))continue;
      // circle/ellipse(아이콘 장식) vs rect 겹침은 완화
      if(a.type!==b.type)continue;
      
      const overlapX=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
      const overlapY=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      const overlapArea=overlapX*overlapY;
      const minArea=Math.min(a.w*a.h,b.w*b.h);
      if(overlapArea>minArea*0.08&&overlapArea>100){
        issues.push({
          type:'SHAPE_OVERLAP', severity:'ERROR',
          msg:`Shape 겹침: ${Math.round(overlapArea)}px² (${Math.round(overlapArea/minArea*100)}%)`,
          elements:[a,b]
        });
      }
    }
  }
  
  // ── 검사 E: 연결선 접점 중앙 정렬 검증 ──
  connectionLines.forEach(cl=>{
    // 시작점/끝점이 가장 가까운 shape의 변 중앙에 있는지 확인
    [cl.start,cl.end].forEach((pt,ptIdx)=>{
      let closestShape=null, minDist=Infinity;
      shapeBoxes.forEach(sb=>{
        if(sb.w>svgW*0.5)return; // 프레임 제외
        // shape 경계까지의 최소 거리
        const cx=sb.x+sb.w/2, cy=sb.y+sb.h/2;
        const d=Math.hypot(pt.x-cx,pt.y-cy);
        if(d<minDist){minDist=d;closestShape=sb;}
      });
      
      if(closestShape){
        const sb=closestShape;
        const cx=sb.x+sb.w/2, cy=sb.y+sb.h/2;
        // 접점이 shape의 어느 변에 가장 가까운지 판정
        const distLeft=Math.abs(pt.x-sb.x);
        const distRight=Math.abs(pt.x-(sb.x+sb.w));
        const distTop=Math.abs(pt.y-sb.y);
        const distBottom=Math.abs(pt.y-(sb.y+sb.h));
        const minEdgeDist=Math.min(distLeft,distRight,distTop,distBottom);
        
        // 변에 닿는 점이면 → 해당 변의 중앙에 있는지 확인
        if(minEdgeDist<8){ // 8px 이내가 "변에 닿음"
          const tolerance=Math.max(8, Math.min(sb.w,sb.h)*0.15); // 15% 또는 8px
          let offCenter=0;
          if(distLeft<=minEdgeDist+2||distRight<=minEdgeDist+2){
            // 좌/우 변에 닿음 → py가 수직 중앙(cy)인지 확인
            offCenter=Math.abs(pt.y-cy);
          }else{
            // 상/하 변에 닿음 → px가 수평 중앙(cx)인지 확인
            offCenter=Math.abs(pt.x-cx);
          }
          
          if(offCenter>tolerance){
            issues.push({
              type:'CONN_OFF_CENTER', severity:'WARNING',
              msg:`연결선 접점 중앙 미정렬: ${ptIdx===0?'시작':'끝'}점 (오차 ${Math.round(offCenter)}px, 허용 ${Math.round(tolerance)}px)`,
              point:pt, shape:closestShape
            });
          }
        }
      }
    });
  });
  
  // ── 검사 F: 빈 라벨 shape (텍스트 없는 박스) ──
  shapeBoxes.filter(sb=>sb.w>30&&sb.h>20&&sb.w<svgW*0.5&&sb.stroke).forEach(sb=>{
    const hasLabel=textBoxes.some(tb=>{
      const tcx=tb.x+tb.w/2, tcy=tb.y+tb.h/2;
      return tcx>sb.x&&tcx<sb.x+sb.w&&tcy>sb.y-sb.h*0.5&&tcy<sb.y+sb.h*1.5;
    });
    if(!hasLabel&&sb.type==='rect'){
      // rect에 라벨이 없으면 경고 (서버 내부 섹션선 등은 제외)
      // 너비가 50px 이상이고 높이가 20px 이상인 의미있는 shape만
      if(sb.w>80&&sb.h>40){
        issues.push({
          type:'EMPTY_SHAPE', severity:'INFO',
          msg:`Shape에 라벨 없음 (${Math.round(sb.w)}×${Math.round(sb.h)}px @ ${Math.round(sb.x)},${Math.round(sb.y)})`,
          shape:sb
        });
      }
    }
  });
  
  // ── 검사 G: 글자 크기 대비 박스 크기 비율 검증 ──
  // 라벨 텍스트가 shape 면적의 합리적 비율을 차지하는지 확인
  textBoxes.forEach(tb=>{
    if(/^\(?\d+\)?$/.test(tb.text.trim()))return; // 참조번호 제외
    if(/^[SD]\d+$/i.test(tb.text.trim()))return;
    if(tb.text.trim().length<=1)return;
    
    // 가장 가까운 shape 찾기
    const tcx=tb.x+tb.w/2, tcy=tb.y+tb.h/2;
    let closest=null, closestDist=Infinity;
    shapeBoxes.forEach(sb=>{
      if(sb.w>svgW*0.5)return; // 프레임 제외
      const scx=sb.x+sb.w/2, scy=sb.y+sb.h/2;
      const d=Math.hypot(tcx-scx,tcy-scy);
      if(d<closestDist){closestDist=d;closest=sb;}
    });
    
    if(closest){
      // 텍스트 높이 대비 shape 높이 비율
      const textRatioH=tb.h/closest.h;
      // 텍스트 너비 대비 shape 너비 비율
      const textRatioW=tb.w/closest.w;
      
      // 텍스트가 shape 높이의 12% 미만이면 글자가 너무 작음
      if(textRatioH<0.12&&closest.h>40){
        issues.push({
          type:'FONT_TOO_SMALL', severity:'WARNING',
          msg:`글자 크기 부족: "${tb.text.slice(0,12)}" 높이비 ${Math.round(textRatioH*100)}% (shape ${Math.round(closest.w)}×${Math.round(closest.h)}px, font ${tb.fontSize}px)`,
          element:tb, shape:closest, ratio:textRatioH
        });
      }
      // 텍스트가 shape 너비의 15% 미만이면 글자가 너무 작음
      if(textRatioW<0.15&&closest.w>60&&tb.text.length>2){
        issues.push({
          type:'FONT_TOO_SMALL', severity:'WARNING',
          msg:`글자 너비 부족: "${tb.text.slice(0,12)}" 너비비 ${Math.round(textRatioW*100)}% (shape ${Math.round(closest.w)}px, font ${tb.fontSize}px)`,
          element:tb, shape:closest, ratio:textRatioW
        });
      }
    }
  });
  
  // ── 검사 H: 연결선 불필요한 꺾임 검증 ──
  connectionLines.forEach(cl=>{
    if(cl.points.length<=2)return; // 직선은 OK
    
    const start=cl.points[0], end=cl.points[cl.points.length-1];
    const totalBends=cl.points.length-2; // 중간 웨이포인트 수 = 꺾임 수
    
    // 시작/끝이 같은 X(수직) 또는 같은 Y(수평)인데 중간에 꺾임이 있으면 불필요
    const couldBeStraightV=Math.abs(start.x-end.x)<5;
    const couldBeStraightH=Math.abs(start.y-end.y)<5;
    
    if((couldBeStraightV||couldBeStraightH)&&totalBends>0){
      issues.push({
        type:'UNNECESSARY_BEND', severity:'WARNING',
        msg:`불필요한 꺾임: 직선 가능한데 ${totalBends}번 꺾임 (${Math.round(start.x)},${Math.round(start.y)} → ${Math.round(end.x)},${Math.round(end.y)})`,
        line:cl, bendCount:totalBends
      });
    }
    
    // L-shape (1 꺾임)이면 OK, 2+꺾임이면 최적화 필요 경고
    if(totalBends>=3){
      issues.push({
        type:'EXCESSIVE_BENDS', severity:'WARNING',
        msg:`과도한 꺾임: ${totalBends}번 꺾임 (시작 ${Math.round(start.x)},${Math.round(start.y)} → 끝 ${Math.round(end.x)},${Math.round(end.y)})`,
        line:cl, bendCount:totalBends
      });
    }
  });
  
  // ── 검사 I: 연결선이 shape 관통 (ROUTE_PIERCE) ──
  connectionLines.forEach(cl=>{
    if(!cl.points||cl.points.length<2)return;
    for(let i=0;i<cl.points.length-1;i++){
      const p1=cl.points[i], p2=cl.points[i+1];
      shapeBoxes.forEach(sb=>{
        if(sb.w>svgW*0.5)return; // 프레임 제외
        // 세그먼트가 shape 내부를 관통하는지 확인
        const pad=3;
        const bx1=sb.x+pad, by1=sb.y+pad, bx2=sb.x+sb.w-pad, by2=sb.y+sb.h-pad;
        let intersects=false;
        if(Math.abs(p1.y-p2.y)<2){
          // 수평 세그먼트
          if(p1.y>by1&&p1.y<by2){
            const minX=Math.min(p1.x,p2.x), maxX=Math.max(p1.x,p2.x);
            if(maxX>bx1&&minX<bx2)intersects=true;
          }
        }else if(Math.abs(p1.x-p2.x)<2){
          // 수직 세그먼트
          if(p1.x>bx1&&p1.x<bx2){
            const minY=Math.min(p1.y,p2.y), maxY=Math.max(p1.y,p2.y);
            if(maxY>by1&&minY<by2)intersects=true;
          }
        }
        // 세그먼트 끝점이 shape 가장자리에 있는 건 정상 (연결)
        if(intersects){
          const startAtEdge=(i===0&&Math.hypot(p1.x-sb.x-sb.w/2,p1.y-sb.y-sb.h/2)<Math.max(sb.w,sb.h)*0.6);
          const endAtEdge=(i===cl.points.length-2&&Math.hypot(p2.x-sb.x-sb.w/2,p2.y-sb.y-sb.h/2)<Math.max(sb.w,sb.h)*0.6);
          if(!startAtEdge&&!endAtEdge){
            issues.push({
              type:'ROUTE_PIERCE', severity:'ERROR',
              msg:`연결선 shape 관통: seg${i} (${Math.round(p1.x)},${Math.round(p1.y)}→${Math.round(p2.x)},${Math.round(p2.y)}) through shape at (${Math.round(sb.x)},${Math.round(sb.y)})`,
              line:cl, shape:sb, segIndex:i
            });
          }
        }
      });
    }
  });
  
  // ── 검사 J: 동일 도면 내 글자 크기 불일치 ──
  // 라벨 텍스트(참조번호 제외)의 폰트 크기가 2px 이상 차이나면 경고
  const labelFontSizes=textBoxes
    .filter(tb=>!/^\(?\d+\)?$/.test(tb.text.trim())&&tb.text.trim().length>1)
    .map(tb=>tb.fontSize)
    .filter(fs=>fs>0);
  if(labelFontSizes.length>1){
    const maxFs=Math.max(...labelFontSizes);
    const minFs=Math.min(...labelFontSizes);
    if(maxFs-minFs>=3){
      issues.push({
        type:'FONT_INCONSISTENT', severity:'WARNING',
        msg:`글자 크기 불일치: ${minFs}px ~ ${maxFs}px (차이 ${maxFs-minFs}px)`,
        minFontSize:minFs, maxFontSize:maxFs
      });
    }
  }
  
  const errorCount=issues.filter(i=>i.severity==='ERROR').length;
  const pass=errorCount===0;
  
  // 콘솔 리포트
  if(issues.length>0){
    console.log(`[PostRender] 도 ${figNum}: ${errorCount} ERR, ${issues.filter(i=>i.severity==='WARNING').length} WARN, ${issues.filter(i=>i.severity==='INFO').length} INFO`);
    issues.forEach(i=>console.log(`  [${i.severity}] ${i.type}: ${i.msg}`));
  }
  
  return{issues, pass, textBoxes, shapeBoxes, connectionLines};
}

function _autoFixRenderedSvg(containerId, issues, attempt){
  // ★ v10.4 Enhanced: 렌더링된 SVG DOM 직접 수정으로 문제 해결 ★
  const container=document.getElementById(containerId);
  if(!container)return 0;
  const svgEl=container.querySelector('svg');
  if(!svgEl)return 0;
  
  let fixCount=0;
  
  issues.forEach(issue=>{
    switch(issue.type){
      case 'TEXT_OVERLAP':{
        const [a,b]=issue.elements;
        const lowerEl=a.y>b.y?a:b;
        const upperEl=a.y>b.y?b:a;
        const gapNeeded=(upperEl.y+upperEl.h+2)-lowerEl.y;
        if(gapNeeded>0){
          const curY=parseFloat(lowerEl.el.getAttribute('y'))||0;
          lowerEl.el.setAttribute('y',String(curY+gapNeeded+4));
          fixCount++;
        }
        if(attempt>=1){
          [a,b].forEach(tb=>{
            const fs=parseFloat(tb.el.getAttribute('font-size'))||11;
            if(fs>7){tb.el.setAttribute('font-size',String(Math.max(7,fs-1)));fixCount++;}
          });
        }
        break;
      }
      
      case 'TEXT_SHAPE_CROSS':{
        // 다른 shape에 겹친 텍스트 → 폰트 축소 + 위치 이동
        const tb=issue.element;
        const fs=parseFloat(tb.el.getAttribute('font-size'))||11;
        if(fs>7){tb.el.setAttribute('font-size',String(Math.max(7,fs-1)));fixCount++;}
        break;
      }
      
      case 'TEXT_CLIPPED':{
        const clip=issue.clip;
        const vbArr=(svgEl.getAttribute('viewBox')||'').split(/\s+/).map(Number);
        let changed=false;
        if(clip.right>2){vbArr[2]+=clip.right+15;changed=true;}
        if(clip.bottom>2){vbArr[3]+=clip.bottom+15;changed=true;}
        if(clip.left>2){vbArr[0]-=(clip.left+15);vbArr[2]+=(clip.left+15);changed=true;}
        if(clip.top>2){vbArr[1]-=(clip.top+15);vbArr[3]+=(clip.top+15);changed=true;}
        if(changed){svgEl.setAttribute('viewBox',vbArr.join(' '));fixCount++;}
        break;
      }
      
      case 'SHAPE_OVERLAP':{
        // ★ v14 FIX: 겹침 방향으로 viewBox 확장 + 재렌더링 간격 배율 산출 ★
        const [ovA,ovB]=issue.elements;
        if(!ovA||!ovB)break;
        const overlapX=Math.max(0,Math.min(ovA.x+ovA.w,ovB.x+ovB.w)-Math.max(ovA.x,ovB.x));
        const overlapY=Math.max(0,Math.min(ovA.y+ovA.h,ovB.y+ovB.h)-Math.max(ovA.y,ovB.y));
        // viewBox 확장: 겹침 방향에 여유 공간 추가
        const ovVb=(svgEl.getAttribute('viewBox')||'').split(/\s+/).map(Number);
        if(ovVb.length===4){
          if(overlapY>=overlapX){ovVb[3]+=overlapY+20;}
          else{ovVb[2]+=overlapX+20;}
          svgEl.setAttribute('viewBox',ovVb.join(' '));
        }
        // 재렌더링 시 필요한 간격 배율 저장 (최대 겹침 기준)
        const curOvMult=parseFloat(svgEl.dataset.overlapSpacingMult||'1');
        const maxOvDim=Math.max(overlapX,overlapY);
        const newOvMult=1+maxOvDim/(Math.max(ovVb[2]||600,ovVb[3]||400))*2;
        svgEl.dataset.overlapSpacingMult=String(Math.max(curOvMult,newOvMult).toFixed(2));
        fixCount++;
        break;
      }

      case 'CONN_OFF_CENTER':{
        // ★ v14 FIX: 연결선 접점을 shape 변 중앙으로 스냅 시도 ★
        const cPt=issue.point, cSb=issue.shape;
        if(!cPt||!cSb)break;
        const sCx=cSb.x+cSb.w/2, sCy=cSb.y+cSb.h/2;
        // 접점이 어느 변에 가까운지 판정
        const dL=Math.abs(cPt.x-cSb.x), dR=Math.abs(cPt.x-(cSb.x+cSb.w));
        const dT=Math.abs(cPt.y-cSb.y), dB=Math.abs(cPt.y-(cSb.y+cSb.h));
        const minD=Math.min(dL,dR,dT,dB);
        // 가장 가까운 변의 중앙 좌표 계산
        let snapX=cPt.x, snapY=cPt.y;
        if(dL<=minD+1||dR<=minD+1){snapY=sCy;} // 좌/우 변 → Y를 중앙으로
        else{snapX=sCx;} // 상/하 변 → X를 중앙으로
        // SVG 내 모든 polyline/line 요소에서 해당 점 찾아서 스냅
        const tolerance=3;
        svgEl.querySelectorAll('polyline').forEach(pl=>{
          const pts=pl.getAttribute('points');if(!pts)return;
          const parsed=pts.split(/\s+/).map(p=>{const[x,y]=p.split(',').map(Number);return{x,y};});
          let changed=false;
          [0,parsed.length-1].forEach(idx=>{
            if(Math.abs(parsed[idx].x-cPt.x)<tolerance&&Math.abs(parsed[idx].y-cPt.y)<tolerance){
              parsed[idx].x=snapX;parsed[idx].y=snapY;changed=true;
            }
          });
          if(changed){pl.setAttribute('points',parsed.map(p=>`${p.x},${p.y}`).join(' '));fixCount++;}
        });
        break;
      }
      
      case 'FONT_TOO_SMALL':{
        // 박스 대비 글자가 너무 작음 → 폰트 크기 증가
        const tb=issue.element;
        const fs=parseFloat(tb.el.getAttribute('font-size'))||11;
        const targetFs=Math.min(fs+2, 16); // 최대 16px까지 증가
        if(targetFs>fs){
          tb.el.setAttribute('font-size',String(targetFs));
          fixCount++;
        }
        break;
      }
      
      case 'UNNECESSARY_BEND':
      case 'EXCESSIVE_BENDS':{
        // 불필요한 꺾임 — DOM에서 polyline points 수정
        const cl=issue.line;
        if(!cl||!cl.el)break;
        const pts=cl.points;
        const start=pts[0], end=pts[pts.length-1];
        // 직선 가능하면 직선화
        if(Math.abs(start.x-end.x)<5){
          cl.el.setAttribute('points',`${start.x},${start.y} ${start.x},${end.y}`);
          fixCount++;
        }else if(Math.abs(start.y-end.y)<5){
          cl.el.setAttribute('points',`${start.x},${start.y} ${end.x},${start.y}`);
          fixCount++;
        }else if(pts.length>3){
          // L-shape로 단순화
          const midPt=Math.abs(start.x-end.x)>Math.abs(start.y-end.y)?
            `${start.x},${start.y} ${end.x},${start.y} ${end.x},${end.y}`:
            `${start.x},${start.y} ${start.x},${end.y} ${end.x},${end.y}`;
          cl.el.setAttribute('points',midPt);
          fixCount++;
        }
        break;
      }
      
      case 'ROUTE_PIERCE':{
        // 연결선이 shape를 관통 — DOM에서 경로 수정 (우회)
        const cl=issue.line;
        const sb=issue.shape;
        if(!cl||!cl.el||!sb)break;
        const pts=cl.points;
        const start=pts[0], end=pts[pts.length-1];
        // 관통 shape를 피해 L-shape 또는 Z-shape로 우회
        const shapeRight=sb.x+sb.w+15;
        const shapeLeft=sb.x-15;
        const shapeBottom=sb.y+sb.h+15;
        const shapeTop=sb.y-15;
        // 가장 짧은 우회 경로 선택
        let newPoints;
        if(Math.abs(start.y-end.y)<Math.abs(start.x-end.x)){
          // 주로 수평 이동 → 위/아래로 우회
          const detourY=Math.abs(start.y-shapeTop)<Math.abs(start.y-shapeBottom)?shapeTop:shapeBottom;
          newPoints=`${start.x},${start.y} ${start.x},${detourY} ${end.x},${detourY} ${end.x},${end.y}`;
        }else{
          // 주로 수직 이동 → 좌/우로 우회
          const detourX=Math.abs(start.x-shapeLeft)<Math.abs(start.x-shapeRight)?shapeLeft:shapeRight;
          newPoints=`${start.x},${start.y} ${detourX},${start.y} ${detourX},${end.y} ${end.x},${end.y}`;
        }
        cl.el.setAttribute('points',newPoints);
        fixCount++;
        break;
      }
      
      case 'FONT_INCONSISTENT':{
        // 폰트 크기 불일치 → 모든 라벨 텍스트를 최소 크기+1로 통일
        const targetFs=Math.max(issue.minFontSize, Math.min(issue.minFontSize+1, 12));
        const allTexts=svgEl.querySelectorAll('text');
        allTexts.forEach(t=>{
          const txt=t.textContent.trim();
          if(/^\(?\d+\)?$/.test(txt))return; // 참조번호 제외
          if(txt.length<=1)return;
          const curFs=parseFloat(t.getAttribute('font-size'))||11;
          if(Math.abs(curFs-targetFs)>=2){
            t.setAttribute('font-size', String(targetFs));
            fixCount++;
          }
        });
        break;
      }
    }
  });
  
  return fixCount;
}

function _postRenderValidationLoop(containerId, figNum, maxAttempts, renderInfo){
  // ★ v10.4: 2단계 보정 루프 ★
  // 1단계: DOM 수정 (폰트 축소, 위치 조정, viewBox 확장)
  // 2단계: 파라미터 조정 후 재렌더링 (간격 확대, 박스 축소)
  const MAX=maxAttempts||3;
  let lastResult=null;
  
  // ── 1단계: DOM 기반 보정 (2회) ──
  for(let attempt=0;attempt<Math.min(MAX,2);attempt++){
    const result=_postRenderValidateSvg(containerId, figNum);
    lastResult=result;
    
    if(result.pass){
      if(attempt>0)console.log(`[PostRender] 도 ${figNum}: DOM 보정 ${attempt}회 후 통과 <span class="ico" data-icon="check-circle"></span>`);
      return result;
    }
    
    const errors=result.issues.filter(i=>i.severity==='ERROR');
    const warnings=result.issues.filter(i=>i.severity==='WARNING');
    console.warn(`[PostRender] 도 ${figNum}: DOM 보정 ${attempt+1} — ERROR ${errors.length}, WARNING ${warnings.length}`);
    
    const fixCount=_autoFixRenderedSvg(containerId, result.issues, attempt);
    if(fixCount===0)break;
  }
  
  // ── 2단계: 재렌더링 보정 (ERROR 또는 심각한 WARNING이 남아있을 때) ──
  if(lastResult&&renderInfo){
    const hasErrors=!lastResult.pass;
    const hasBends=lastResult.issues.filter(i=>i.type==='UNNECESSARY_BEND'||i.type==='EXCESSIVE_BENDS').length;
    const hasPierce=lastResult.issues.filter(i=>i.type==='ROUTE_PIERCE').length;
    const hasFontIssue=lastResult.issues.filter(i=>i.type==='FONT_INCONSISTENT'||i.type==='FONT_TOO_SMALL').length;
    // ★ v14 FIX: SHAPE_OVERLAP, CONN_OFF_CENTER도 재렌더링 트리거에 포함 ★
    const hasOverlap=lastResult.issues.filter(i=>i.type==='SHAPE_OVERLAP').length;
    const hasOffCenter=lastResult.issues.filter(i=>i.type==='CONN_OFF_CENTER').length;
    const needsRerender=hasErrors||hasPierce>0||hasBends>1||hasFontIssue>0||hasOverlap>0||hasOffCenter>1;

    if(needsRerender){
      console.warn(`[PostRender] 도 ${figNum}: DOM 보정 불충분 → 재렌더링 시도 (ERR:${hasErrors?'Y':'N'} BEND:${hasBends} PIERCE:${hasPierce} FONT:${hasFontIssue} OVERLAP:${hasOverlap} OFFCENTER:${hasOffCenter})`);

      // ★ v14 FIX: 1단계 DOM 보정에서 산출한 overlapSpacingMult 반영 ★
      const container=document.getElementById(containerId);
      const svgEl=container?.querySelector('svg');
      const overlapMult=parseFloat(svgEl?.dataset?.overlapSpacingMult||'1');

      // 간격 확대 + 폰트 조정으로 재렌더링
      const baseSpacing=hasPierce>0?1.25:hasOverlap>0?1.20:1.15;
      const adjustments={
        spacingMult: Math.max(baseSpacing, overlapMult),
        fontOffset: hasFontIssue>0?1:-1,
        boxWidthMult: hasOverlap>0?1.08:1.05,
        boxHeightMult: hasOverlap>0?1.10:1.05
      };

      try{
        renderDiagramSvg(containerId, renderInfo.nodes, renderInfo.edges,
          renderInfo.positions, figNum, adjustments);

        // 재렌더링 후 검증
        const result2=_postRenderValidateSvg(containerId, figNum);
        lastResult=result2;

        if(result2.pass){
          console.log(`[PostRender] 도 ${figNum}: 재렌더링 후 통과 <span class="ico" data-icon="check-circle"></span>`);
        }else{
          // 한 번 더 시도 — 더 큰 조정
          console.warn(`[PostRender] 도 ${figNum}: 재렌더링 후에도 ${result2.issues.length}개 문제 → 2차 재렌더링`);
          const adj2={spacingMult:Math.max(1.30,overlapMult*1.15), fontOffset:-2, boxWidthMult:1.10, boxHeightMult:1.12};
          renderDiagramSvg(containerId, renderInfo.nodes, renderInfo.edges,
            renderInfo.positions, figNum, adj2);
          lastResult=_postRenderValidateSvg(containerId, figNum);

          if(lastResult.pass){
            console.log(`[PostRender] 도 ${figNum}: 2차 재렌더링 후 통과 <span class="ico" data-icon="check-circle"></span>`);
          }else{
            // DOM 보정 마지막 시도
            _autoFixRenderedSvg(containerId, lastResult.issues, 2);
            lastResult=_postRenderValidateSvg(containerId, figNum);
          }
        }
      }catch(e){
        console.error(`[PostRender] 도 ${figNum}: 재렌더링 오류:`,e);
      }
    }
  }
  
  return lastResult;
}

// ═══ 전체 도면 렌더링 후 일괄 포스트 검증 ═══
function _runPostRenderValidation(sid, figNums){
  const data=diagramData[sid];
  if(!data||!data.length)return;
  
  let totalIssues=0;
  const reports=[];
  
  data.forEach((d,i)=>{
    const containerId=`diagram_${sid}_${i}`;
    const figNum=figNums[i]||(i+1);
    // ★ v10.4: renderInfo 전달 — 재렌더링 지원 ★
    const renderInfo={nodes:d.nodes, edges:d.edges, positions:d.positions};
    const result=_postRenderValidationLoop(containerId, figNum, 3, renderInfo);
    if(result&&result.issues.length>0){
      totalIssues+=result.issues.length;
      reports.push({figNum, issues:result.issues});
    }
  });
  
  // 검증 결과 표시
  const resultEl=document.getElementById(`validationResult_${sid}`);
  if(resultEl){
    if(totalIssues===0){
      resultEl.innerHTML='<span style="color:var(--dt-success)"><span class="ico" data-icon="check-circle"></span> 포스트 렌더 검증 통과</span>';
    }else{
      const errCount=reports.reduce((sum,r)=>sum+r.issues.filter(i=>i.severity==='ERROR').length,0);
      const warnCount=reports.reduce((sum,r)=>sum+r.issues.filter(i=>i.severity==='WARNING').length,0);
      let msg=`⚠️ 포스트 렌더: `;
      if(errCount>0)msg+=`ERROR ${errCount}개 `;
      if(warnCount>0)msg+=`WARNING ${warnCount}개`;
      resultEl.innerHTML=`<span style="color:${errCount>0?'var(--dt-danger)':'var(--dt-warning)'}">${msg}</span>`;
      
      // 상세 리포트 (콘솔)
      reports.forEach(r=>{
        console.log(`[PostRender Report] 도 ${r.figNum}:`);
        r.issues.forEach(i=>console.log(`  [${i.severity}] ${i.type}: ${i.msg}`));
      });
    }
  }
  
  return{totalIssues, reports};
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

  // ═══ R13a. 명칭 중복 — 같은 이름에 다른 참조번호 (기재불비) ═══
  const labelToRefs={};
  nodes.forEach(n=>{
    const ref=extractRef(n.label);
    if(!ref)return;
    const clean=(_safeCleanLabel(n.label)||'').trim();
    if(!clean||clean.length<2)return;
    if(!labelToRefs[clean])labelToRefs[clean]=[];
    labelToRefs[clean].push(ref);
  });
  Object.entries(labelToRefs).forEach(([label,refs])=>{
    if(refs.length>1){
      const uniqueRefs=[...new Set(refs)];
      if(uniqueRefs.length>1){
        issues.push({
          severity:'ERROR',
          rule:'R13a',
          message:`명칭 "${label}"이 서로 다른 참조번호(${uniqueRefs.join(', ')})로 중복 사용 — 기재불비(特42조④)`
        });
      }
    }
  });

  // ═══ R13b. 참조번호 중복 — 같은 번호에 다른 명칭 (기재불비) ═══
  const refToLabels={};
  nodes.forEach(n=>{
    const ref=extractRef(n.label);
    if(!ref)return;
    const clean=(_safeCleanLabel(n.label)||'').trim();
    if(!clean||clean.length<2)return;
    if(!refToLabels[ref])refToLabels[ref]=[];
    if(!refToLabels[ref].includes(clean))refToLabels[ref].push(clean);
  });
  Object.entries(refToLabels).forEach(([ref,labels])=>{
    if(labels.length>1){
      issues.push({
        severity:'ERROR',
        rule:'R13b',
        message:`참조번호 ${ref}에 서로 다른 명칭("${labels.join('", "')}") — 기재불비(特42조④)`
      });
    }
  });


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
      
      // ★ v18.2: L2+L3 혼합 — 서브 프레임 중첩 허용 ★
      if(l2Refs.length>0&&l3Refs.length>0){
        const l3ParentL2s=[...new Set(l3Refs.map(n=>Math.floor(n/10)*10))];
        const allParentsPresent=l3ParentL2s.every(p=>l2Refs.includes(p));
        const singleParent=l3ParentL2s.length===1;

        if(allParentsPresent&&singleParent){
          const parentL2=l3ParentL2s[0];
          const otherL2=l2Refs.filter(r=>r!==parentL2);
          issues.push({severity:'INFO',rule:'R6b',
            message:`도 ${figNum}: 중첩 블록도 — ${parentL2}이 서브 프레임(내부 L3: ${l3Refs.join(',')}), 독립 L2: ${otherL2.join(',')||'없음'}`});
        }else if(allParentsPresent&&!singleParent){
          issues.push({severity:'WARNING',rule:'R6b',
            message:`도 ${figNum}: 복수 L2(${l3ParentL2s.join(',')}) 서브 프레임 — 도면 분할 권장`});
        }else{
          const orphanL3=l3Refs.filter(n=>!l2Refs.includes(Math.floor(n/10)*10));
          issues.push({severity:'ERROR',rule:'R6b',
            message:`도 ${figNum}: L3(${orphanL3.join(',')})의 부모 L2가 이 도면에 없음 — 레벨 혼합 오류`});
        }
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
    // R10a는 R12와 중복되어 제거 (R12가 더 정확한 extractRef/isL1 사용)

    // R10b. 같은 행에 4개 이상 노드 검증
    if(edgeList.length>0){
      const layout=computeDeviceLayout2D(nodes,edgeList,figNum);
      if(layout.layers){
        layout.layers.forEach((layer,rowIdx)=>{
          const _realLen=layer.filter(x=>x!==null).length; // null 슬롯 제외
          if(_realLen>3){
            issues.push({severity:'WARNING',rule:'R10b',message:`도 ${figNum}: 행${rowIdx+1}에 ${_realLen}개 노드 — 최대 3개 권장 (겹침 위험)`});
          }
        });
      }
    }
  }
  
  // ═══ R11. 순환 참조 검출 (위상 정렬 전제 조건) ═══
  // ★ v12 FIX: edgeList 스코프 버그 — edges 파라미터 직접 사용 ★
  const _r11Edges=edges||[];
  if(_r11Edges.length>0&&figNum>1){
    const _adj2={};
    nodes.forEach(nd=>{_adj2[nd.id]=new Set();});
    _r11Edges.forEach(e=>{if(_adj2[e.from])_adj2[e.from].add(e.to);});
    const _inDeg={};
    nodes.forEach(nd=>{_inDeg[nd.id]=0;});
    _r11Edges.forEach(e=>{_inDeg[e.to]=(_inDeg[e.to]||0)+1;});
    const _q=nodes.map(nd=>nd.id).filter(id=>_inDeg[id]===0);
    let _visited=0;
    const _q2=[..._q];
    while(_q2.length>0){
      const cur=_q2.shift();_visited++;
      (_adj2[cur]||new Set()).forEach(next=>{_inDeg[next]--;if(_inDeg[next]===0)_q2.push(next);});
    }
    if(_visited<nodes.length){
      issues.push({severity:'WARNING',rule:'R11',message:`도 ${figNum}: 순환 참조 감지 — 데이터 흐름이 단방향이 되도록 연결 방향을 수정하라`});
    }
  }
  
  // ═══ R12. 도 2+ 내부 구성요소 수량 제한 (3~5개) ═══ [v13.0]
  // 프롬프트 규칙(L2123-2128)의 코드 측 강제 검증
  if(figNum>1&&!isMethodFig){
    const _innerNodes=nodes.filter(n=>{
      const ref=extractRef(n.label);
      if(!ref)return true;
      return !isL1(ref); // L1(프레임) 제외
    });
    const _innerCount=_innerNodes.length;
    if(_innerCount>5){
      issues.push({severity:'ERROR',rule:'R12',
        message:`도 ${figNum}: 내부 구성요소 ${_innerCount}개 (최대 5개 초과). 핵심 3~5개만 남기고 나머지는 다음 도면으로 분리 필요.`});
    }else if(_innerCount===1){
      issues.push({severity:'ERROR',rule:'R12',
        message:`도 ${figNum}: 내부 구성요소 1개 — 최소 3개 필요. 다른 도면과 병합하라.`});
    }else if(_innerCount===2){
      issues.push({severity:'WARNING',rule:'R12',
        message:`도 ${figNum}: 내부 구성요소 2개 (최소 3개 권장). 기능 분리하여 확장 권장.`});
    }
  }
  
  return issues;
}

// ═══ 렌더링 후 시각 검증 (새 기능) ═══
function postRenderValidation(sid){
  const data=diagramData[sid];
  if(!data||!data.length)return[];
  
  const autoFigNums=getAutoFigNums(sid);
  const allIssues=[];
  
  data.forEach(({nodes,edges},idx)=>{
    const figNum=autoFigNums[idx]||(idx+1);
    const numRefs=nodes.map(n=>{
      const m=(n.label||'').match(/[(\s]?(S?\d+)[)\s]?$/i);
      if(!m)return null;
      const val=m[1];
      if(val.startsWith('S')||val.startsWith('s'))return null; // S-접두사 방법 참조는 별도 처리
      return parseInt(val);
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
  if(!el){console.warn(`[renderDiagrams] DOM element not found: ${cid}`);return;}
  let blocks=extractMermaidBlocks(mt);
  if(!blocks.length){
    el.innerHTML=`<div class="diagram-container"><pre style="font-size:12px;white-space:pre-wrap">${App.escapeHtml(mt)}</pre></div>`;
    return;
  }
  
  // v10.3: 도면 수 강제 제한 — 설계 텍스트 또는 UI 설정값 기준
  let expectedCount;
  if(sid==='step_07'){
    const totalFig=parseInt(document.getElementById('optDeviceFigures')?.value||4);
    const fromUI=totalFig-requiredFigures.length;
    // 설계 텍스트에서 실제 도면 수도 확인
    const fromDesign=_extractFigureNumbersFromDesign(outputs[sid]||'').length;
    expectedCount=fromDesign>0?Math.min(fromUI,fromDesign):fromUI;
  }else{
    expectedCount=parseInt(document.getElementById('optMethodFigures')?.value||2);
  }
  if(blocks.length>expectedCount&&expectedCount>0){
    console.warn(`[renderDiagrams] ${sid}: mermaid 블록 ${blocks.length}개 > 예상 ${expectedCount}개 → 초과분 제거`);
    App.showToast(`도면 ${blocks.length}개 생성됨 → ${expectedCount}개로 조정`,'warning');
    blocks=blocks.slice(0,expectedCount);
  }
  
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  diagramData[sid]=[];
  
  // v10.0: 사용자 도면 스킵 반영 — 블록 수 기반 도면 번호 미리 계산
  const _devC=sid==='step_07'?blocks.length:(diagramData.step_07?.length||0);
  const _methC=sid==='step_11'?blocks.length:0;
  const _cfn=computeFigNums(_devC,_methC,conceptDiagramTypes.filter(ct=>ct.svgContent).length,_placedConceptOverrides());
  const autoFigNums=sid==='step_07'?_cfn.device:_cfn.method;
  
  // 도면 설계 텍스트 (R7 검증용)
  const designText=outputs[sid]||'';
  
  let html='';
  let allIssues=[];
  let hasErrors=false;
  
  blocks.forEach((code,i)=>{
    const figNum=autoFigNums[i]||(figOffset+i+1);
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
    html=`<div style="background:#FEECEC;border:1px solid #FF6363;border-radius:8px;padding:12px;margin-bottom:16px">
      <div style="color:var(--dt-danger);font-weight:600;margin-bottom:8px"><span class="ico" data-icon="warning"></span> 도면 규칙 위반 발견</div>
      <div style="font-size:12px;color:#b71c1c;margin-bottom:12px;white-space:pre-line">${App.escapeHtml(errorSummary)}</div>
      <button onclick="regenerateDiagramWithFeedback('${sid}')" style="background:var(--dt-brand-hover);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px"><span class="ico" data-icon="refresh"></span> 규칙에 맞게 재생성</button>
    </div>`+html;
  }
  
  html+=`<div style="margin-top:12px;padding:12px;background:var(--color-bg-secondary);border-radius:8px">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button onclick="runDiagramValidation('${sid}')" style="background:var(--dt-success);color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px" title="R0~R14 규칙 검증 + 시각적 겹침/잘림 검사"><span class="ico" data-icon="check-circle"></span> 검증</button>
      <span style="color:var(--color-text-tertiary);font-size:11px">\u2192</span>
      <button onclick="runAIDiagramReview('${sid}')" style="background:#7b1fa2;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px" title="AI가 연결관계의 기술적 적절성을 평가"><span class="ico" data-icon="robot"></span> AI 검증</button>
      <span style="color:var(--color-text-tertiary);font-size:11px">\u2192</span>
      <button onclick="regenerateDiagramWithFeedback('${sid}')" style="background:var(--dt-brand-hover);color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px" title="검증 결과를 반영하여 도면 재생성 (검증 미실행 시 자동 실행)"><span class="ico" data-icon="refresh"></span> 재생성</button>
      <span id="validationResult_${sid}" style="font-size:12px;color:var(--color-text-secondary);margin-left:4px"></span>
    </div>
    <div id="aiReviewResult_${sid}" style="margin-top:8px"></div>
  </div>`;
  
  el.innerHTML=html;

  // ★ v18.2: 전체 도면 세트에서 최대 열 수 사전 계산 — 블록 크기 통일 ★
  let globalMaxInnerCols=1;
  blocks.forEach((code,i)=>{
    const figNum=autoFigNums[i]||(figOffset+i+1);
    const{nodes,edges}=diagramData[sid][i];
    const allL1=nodes.every(n=>_sharedIsL1RefNum(_sharedExtractRefNum(n.label,'')));
    const isFig1=figNum===1||allL1;
    if(isFig1)return;
    const allRefsPC=nodes.map(n=>_sharedExtractRefNum(n.label,'')).filter(Boolean);
    let pcFrameRef=_sharedFindImmediateParent(allRefsPC);
    if(!pcFrameRef&&allRefsPC.length>0){const fr=parseInt(allRefsPC[0])||100;pcFrameRef=Math.floor(fr/100)*100;}
    if(!pcFrameRef)pcFrameRef=100;
    const innerNodes=nodes.filter(n=>{
      const ref=_sharedExtractRefNum(n.label,'');
      if(!ref)return true;
      const num=parseInt(ref);
      if(isNaN(num))return true;
      if(num===pcFrameRef)return false;
      if(_sharedIsL1RefNum(ref))return false;
      return true;
    });
    if(innerNodes.length===0)return;
    const layout=computeDeviceLayout2D(innerNodes,edges,figNum);
    if(layout.maxCols>globalMaxInnerCols)globalMaxInnerCols=layout.maxCols;
  });
  console.log(`[v18.2] globalMaxInnerCols=${globalMaxInnerCols}`);

  // SVG 렌더링
  blocks.forEach((code,i)=>{
    const{nodes,edges,positions}=diagramData[sid][i];
    renderDiagramSvg(`diagram_${sid}_${i}`,nodes,edges,positions,autoFigNums[i]||(figOffset+i+1),null,globalMaxInnerCols);
  });
  
  // ★ v10.4: 포스트 렌더 검증 — SVG DOM 기반 겹침/잘림/연결 자동 검증+보정 ★
  // requestAnimationFrame으로 DOM paint 완료 후 실행
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      try{
        _runPostRenderValidation(sid, autoFigNums);
      }catch(e){
        console.error('[PostRender] 검증 오류:',e);
      }
    },50); // 브라우저 레이아웃 안정 대기
  });
}

// ═══ 도면 검증 실행 함수 ═══
function runDiagramValidation(sid){
  const data=diagramData[sid];
  if(!data||!data.length){
    App.showToast('검증할 도면이 없습니다.','error');
    return;
  }
  
  const autoFigNums=getAutoFigNums(sid);
  const designText=outputs[sid]||'';
  let totalErrors=0,totalWarnings=0;
  let reportHtml='';
  
  data.forEach(({nodes,edges},idx)=>{
    const figNum=autoFigNums[idx]||(idx+1);
    const issues=validateDiagramRules(nodes,figNum,designText,edges);
    const errors=issues.filter(i=>i.severity==='ERROR');
    const warnings=issues.filter(i=>i.severity==='WARNING');
    const infos=issues.filter(i=>i.severity==='INFO');
    totalErrors+=errors.length;
    totalWarnings+=warnings.length;
    
    if(errors.length||warnings.length){
      reportHtml+=`<div style="margin:4px 0"><b>도 ${figNum}:</b> `;
      errors.forEach(e=>reportHtml+=`<span style="color:var(--dt-danger);font-size:11px"><span class="ico" data-icon="x"></span> [${e.rule}] ${e.message} </span>`);
      warnings.forEach(w=>reportHtml+=`<span style="color:var(--dt-warning);font-size:11px"><span class="ico" data-icon="warning"></span> [${w.rule}] ${w.message} </span>`);
      reportHtml+='</div>';
    }else{
      reportHtml+=`<div style="margin:4px 0;color:var(--dt-success)"><b>도 ${figNum}:</b> <span class="ico" data-icon="check-circle"></span>  통과 ${infos.map(i=>`(${i.message})`).join(' ')}</div>`;
    }
  });

  // ═══ R14. 레벨 건너뛰기(L2-skip) — 전체 도면 세트 교차 검증 ═══
  {
    const _extractRef=label=>{
      const m=(label||'').match(/[(\s]?(S?\d+)[)\s]?$/i);
      return m?m[1]:null;
    };
    const _refLevel=r=>{
      if(!r||String(r).startsWith('S'))return null;
      const s=String(r);
      const n=s.startsWith('D')?parseInt(s.slice(1)):parseInt(s);
      if(isNaN(n))return null;
      if(n<100)return 'small';
      if(n%100===0)return 'L1';
      if(n%10===0)return 'L2';
      if(n<1000)return 'L3';
      return 'L4';
    };
    data.forEach(({nodes},idx)=>{
      const figNum=autoFigNums[idx]||(idx+1);
      if(figNum===1)return;
      const innerNodes=nodes.filter(n=>{
        const ref=_extractRef(n.label);
        if(!ref)return false;
        if(String(ref).startsWith('S'))return false;
        return !_isL1RefNum(ref);
      });
      const levels=new Set();
      innerNodes.forEach(n=>{
        const ref=_extractRef(n.label);
        const lv=_refLevel(ref);
        if(lv&&lv!=='small')levels.add(lv);
      });
      if(levels.size>1){
        const mixed=[...levels].sort().join('+');
        totalErrors++;
        reportHtml+=`<div style="margin:4px 0"><b>도 ${figNum}:</b> <span style="color:var(--dt-danger);font-size:11px"><span class="ico" data-icon="x"></span> [R14] 레벨 혼재(${mixed}) — 한 도면 내부는 동일 레벨이어야 함</span></div>`;
      }
    });
  }

  const resultEl=document.getElementById(`validationResult_${sid}`);
  if(resultEl){
    if(totalErrors===0&&totalWarnings===0){
      resultEl.innerHTML=`<span style="color:var(--dt-success);font-weight:600"><span class="ico" data-icon="check-circle"></span> 전체 검증 통과 (${data.length}개 도면)</span>`;
    }else{
      resultEl.innerHTML=`<div>
        <span style="color:var(--dt-danger);font-weight:600"><span class="ico" data-icon="x"></span> 오류 ${totalErrors}건</span>,
        <span style="color:var(--dt-warning)"><span class="ico" data-icon="warning"></span> 경고 ${totalWarnings}건</span>
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
  
  // ★ v10.4: 포스트 렌더 검증도 실행 (시각적 겹침/잘림 검사) ★
  try{
    const prResult=_runPostRenderValidation(sid, autoFigNums);
    if(prResult&&prResult.totalIssues>0){
      const prErrors=prResult.reports.reduce((s,r)=>s+r.issues.filter(i=>i.severity==='ERROR').length,0);
      const prWarns=prResult.reports.reduce((s,r)=>s+r.issues.filter(i=>i.severity==='WARNING').length,0);
      if(prErrors>0||prWarns>0){
        reportHtml+=`<div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee"><b><span class="ico" data-icon="search"></span> 시각적 검증:</b> `;
        if(prErrors>0)reportHtml+=`<span style="color:var(--dt-danger)">겹침 ${prErrors}건 </span>`;
        if(prWarns>0)reportHtml+=`<span style="color:var(--dt-warning)">잘림/넘침 ${prWarns}건 </span>`;
        prResult.reports.forEach(r=>{
          r.issues.forEach(i=>{
            const c=i.severity==='ERROR'?'#c62828':'#f57c00';
            reportHtml+=`<div style="font-size:10px;color:${c};margin-left:12px">[${i.type}] ${i.msg}</div>`;
          });
        });
        reportHtml+='</div>';
        if(resultEl)resultEl.innerHTML=resultEl.innerHTML.replace('</div>',reportHtml+'</div>');
      }
    }
  }catch(e){console.error('[PostRender validation error]',e);}

  // ★ v18: 검증 결과를 window._diagramErrors에 저장 — 재생성 시 참조 ★
  if(totalErrors>0||totalWarnings>0){
    const allErrorSummary=[];
    data.forEach(({nodes,edges},idx)=>{
      const figNum=autoFigNums[idx]||(idx+1);
      const issues=validateDiagramRules(nodes,figNum,designText,edges);
      issues.filter(i=>i.severity==='ERROR'||i.severity==='WARNING').forEach(i=>{
        allErrorSummary.push(`도 ${figNum}: [${i.rule}] ${i.message}`);
      });
    });
    try{
      const prResult=_runPostRenderValidation(sid, autoFigNums);
      if(prResult){
        prResult.reports.forEach(r=>{
          r.issues.filter(i=>i.severity==='ERROR').forEach(i=>{
            allErrorSummary.push(`도 ${r.figNum}: [시각적] ${i.msg}`);
          });
        });
      }
    }catch(e){}
    window._diagramErrors={sid, errors:allErrorSummary.join('\n')};
  }else{
    if(window._diagramErrors&&window._diagramErrors.sid===sid){
      window._diagramErrors=null;
    }
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
  if(resultEl)resultEl.innerHTML='<div style="padding:12px;background:#f3e5f5;border-radius:8px;font-size:12px;color:#6a1b9a"><span class="ico" data-icon="robot"></span> AI 연결관계 검증 중...</div>';

  const autoFigNums=getAutoFigNums(sid);
  const designText=outputs[sid]||'';

  // ★ v15: 각 도면의 구조 정보 + 레이아웃 통계 수집 ★
  let diagramSummary='';
  const figStats=[];
  data.forEach(({nodes,edges},idx)=>{
    const figNum=autoFigNums[idx]||(idx+1);
    const nodeList=nodes.map(n=>{
      const ref=_extractRefNum(n.label,'?');
      const clean=_safeCleanLabel(n.label);
      return `${clean}(${ref})`;
    }).join(', ');
    const edgeList=(edges||[]).map(e=>{
      const fromLabel=nodes.find(n=>n.id===e.from)?.label||e.from;
      const toLabel=nodes.find(n=>n.id===e.to)?.label||e.to;
      return `${_safeCleanLabel(fromLabel)} → ${_safeCleanLabel(toLabel)}`;
    }).join(', ');
    // 연결 통계
    const degreeMap={};
    nodes.forEach(n=>{degreeMap[n.id]=0;});
    (edges||[]).forEach(e=>{degreeMap[e.from]=(degreeMap[e.from]||0)+1;degreeMap[e.to]=(degreeMap[e.to]||0)+1;});
    const maxDeg=Math.max(0,...Object.values(degreeMap));
    const hubNode=nodes.find(n=>degreeMap[n.id]===maxDeg);
    const isolatedNodes=nodes.filter(n=>degreeMap[n.id]===0);
    // 순환 감지
    const hasCycle=(()=>{
      const visited=new Set(),inStack=new Set();
      const adjMap={};
      (edges||[]).forEach(e=>{if(!adjMap[e.from])adjMap[e.from]=[];adjMap[e.from].push(e.to);});
      function dfs(nid){
        if(inStack.has(nid))return true;
        if(visited.has(nid))return false;
        visited.add(nid);inStack.add(nid);
        for(const next of(adjMap[nid]||[])){if(dfs(next))return true;}
        inStack.delete(nid);return false;
      }
      return nodes.some(n=>dfs(n.id));
    })();
    figStats.push({figNum,nodeCount:nodes.length,edgeCount:(edges||[]).length,maxDeg,hubNode:hubNode?_safeCleanLabel(hubNode.label):'',isolatedCount:isolatedNodes.length,hasCycle});
    diagramSummary+=`\n도 ${figNum}: (노드 ${nodes.length}개, 엣지 ${(edges||[]).length}개${hasCycle?', ⚠️순환감지':''}${isolatedNodes.length>0?`, 고립노드 ${isolatedNodes.length}개`:''})\n  구성요소: ${nodeList}\n  연결관계: ${edgeList||'없음 (병렬 배치)'}\n  허브: ${hubNode?_safeCleanLabel(hubNode.label)+'(연결 '+maxDeg+')':'-'}\n`;
  });

  const prompt=`당신은 15년 경력의 한국 특허 도면 전문가입니다. 아래 도면의 연결관계가 기술적으로 적절한지 평가하고 구체적 개선안을 제시하세요.

═══ 평가 기준 ═══
1. **데이터/정보 도면**: 정보 항목(~정보, ~데이터)은 ${getDeviceSubject()}로 입력되는 것이므로 상호 간 화살표 연결 부적절 → 병렬 배치 적절
2. **장치 블록도**: 하드웨어 구성요소 간 데이터 흐름이 있으면 화살표 연결 적절. 메모리/저장부 같은 수동적 구성은 다른 구성에서 접근하는 방향만 적절
3. **계층 일관성**: 상위+하위 구성이 같은 레벨에 표현 금지 → 하위는 상위 내부에 포함
4. **방법 흐름도**: 단계 간 순서가 논리적이어야 함
5. **연결 효율성**: 불필요한 연결이 많으면 교차가 증가하여 가독성 저하. 핵심 데이터 흐름만 연결
6. **순환 금지**: A→B→C→A 같은 순환 연결은 데이터 흐름이 아님
7. **고립 노드**: 연결 없는 구성요소가 있으면 연결 누락인지 병렬 배치가 맞는지 판단

═══ 도면 설계 ═══
${designText.slice(0,3000)}

═══ 실제 도면 구조 ═══
${diagramSummary}

═══ 출력 형식 (반드시 준수) ═══
각 도면에 대해 아래 형식으로:

[도 N]
판정: ✅ 적절 / ⚠️ 부적절
사유: (구체적 이유)
${'{'}개선안${'}'}:
- (수정할 연결: "A → B 연결 제거" 또는 "A → B 연결 추가" 형식)
- (배치 변경: "A를 중앙 허브로 배치" 형식)

[전체 요약]
(전체 도면의 연결관계 적절성 한 줄 요약)`;

  try{
    const r=await App.callClaude(prompt);
    const reviewText=r.text||'';

    // ★ v15: 구조화된 결과 파싱 ★
    const figResults=[];
    const figBlocks=reviewText.split(/\[도\s*(\d+)\]/g);
    for(let i=1;i<figBlocks.length;i+=2){
      const figNum=parseInt(figBlocks[i]);
      const block=figBlocks[i+1]||'';
      const isOk=/적절/.test(block)&&!/부적절/.test(block);
      const reason=(block.match(/사유[:：]\s*(.+)/)||[])[1]||'';
      // 개선안 추출
      const suggestions=[];
      const sugMatch=block.match(/개선안[\s\S]*?(?=\[도|\[전체|$)/);
      if(sugMatch){
        sugMatch[0].split('\n').forEach(line=>{
          const trimmed=line.replace(/^[-•*]\s*/,'').trim();
          if(trimmed&&!/개선안/.test(trimmed))suggestions.push(trimmed);
        });
      }
      figResults.push({figNum,pass:isOk,reason,suggestions});
    }

    // 결과 표시
    if(resultEl){
      let html='<div style="padding:12px;background:#f3e5f5;border:1px solid #ce93d8;border-radius:8px;margin-top:8px">';
      html+='<div style="font-weight:600;color:#6a1b9a;margin-bottom:8px"><span class="ico" data-icon="robot"></span> AI 연결관계 검증 결과</div>';
      if(figResults.length>0){
        figResults.forEach(fr=>{
          const icon=fr.pass?'✅':'⚠️';
          html+=`<div style="margin-bottom:8px;padding:8px;background:${fr.pass?'#e8f5e9':'#FEF4E6'};border-radius:6px">`;
          html+=`<div style="font-weight:600;font-size:13px">${icon} 도 ${fr.figNum}</div>`;
          if(fr.reason)html+=`<div style="font-size:12px;color:#555;margin-top:2px">${App.escapeHtml(fr.reason)}</div>`;
          if(fr.suggestions.length>0){
            html+='<div style="font-size:11px;color:#6a1b9a;margin-top:4px">';
            fr.suggestions.forEach(s=>{html+=`<div><span class="ico" data-icon="arrow-right"></span> ${App.escapeHtml(s)}</div>`;});
            html+='</div>';
          }
          html+='</div>';
        });
      }else{
        html+=`<pre style="font-size:12px;white-space:pre-wrap;margin:0;color:#4a148c;line-height:1.6">${App.escapeHtml(reviewText)}</pre>`;
      }
      html+='</div>';
      resultEl.innerHTML=html;
    }

    // ★ v15: 부적절 항목 감지 — 구조화된 파싱 우선, 폴백으로 키워드 매칭 ★
    const hasIssues=figResults.length>0?figResults.some(fr=>!fr.pass):(reviewText.includes('부적절')||reviewText.includes('⚠️'));
    if(hasIssues){
      // 개선안을 포함한 상세 리뷰 저장
      const issueDetails=figResults.filter(fr=>!fr.pass).map(fr=>`도 ${fr.figNum}: ${fr.reason}${fr.suggestions.length>0?'\n  '+fr.suggestions.join('\n  '):''}`).join('\n');
      window._aiDiagramReview={sid,review:issueDetails||reviewText,figResults};
      App.showToast('AI 검증: 일부 도면 연결관계 수정 권장','warning');
    }else{
      window._aiDiagramReview=null;
      App.showToast('AI 검증: 모든 도면 연결관계 적절 <span class="ico" data-icon="check-circle"></span>');
    }
  }catch(e){
    if(resultEl)resultEl.innerHTML=`<div style="padding:8px;background:#FEECEC;border-radius:8px;font-size:12px;color:var(--dt-danger)">AI 검증 실패: ${e.message}</div>`;
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
    
    const autoFigNums=getAutoFigNums(sid);
    const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
    
    const LINE_FRAME=2.0,LINE_BOX=1.5,LINE_ARROW=1.0,SHADOW_OFFSET=0.04;
    const PAGE_MARGIN=0.6,PAGE_W=8.27-PAGE_MARGIN*2,PAGE_H=11.69-PAGE_MARGIN*2;
    const TITLE_H=0.5,AVAILABLE_H=PAGE_H-TITLE_H-0.3;
    
    const extractRefNum=_sharedExtractRefNum;
    const isL1RefNum=_sharedIsL1RefNum;
    const findImmediateParent=_sharedFindImmediateParent;

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
    
    // ★ v18.2: 전체 도면 세트에서 최대 열 수 사전 계산 (PPTX) ★
    let _pptxGlobalMaxCols=1;
    data.forEach(({nodes,edges},idx)=>{
      const figNum=autoFigNums[idx]||(figOffset+idx+1);
      const allL1=nodes.every(n=>isL1RefNum(extractRefNum(n.label,'')));
      if(figNum===1||allL1)return;
      const pRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
      let pFrameRef=findImmediateParent(pRefs);
      if(!pFrameRef&&pRefs.length>0){const fr=parseInt(pRefs[0])||100;pFrameRef=Math.floor(fr/100)*100;}
      if(!pFrameRef)pFrameRef=100;
      const innerNodes=nodes.filter(n=>{const ref=extractRefNum(n.label,'');if(!ref)return true;const num=parseInt(ref);if(num===pFrameRef)return false;if(isL1RefNum(ref))return false;return true;});
      if(!innerNodes.length)return;
      const layout=computeDeviceLayout2D(innerNodes,edges,figNum);
      if(layout.maxCols>_pptxGlobalMaxCols)_pptxGlobalMaxCols=layout.maxCols;
    });

    data.forEach(({nodes,edges},idx)=>{
      const slide=pptx.addSlide({bkgd:'FFFFFF'});
      const figNum=autoFigNums[idx]||(figOffset+idx+1);
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
          slide.addText(cleanLabel,{x:bx+0.08,y:by,w:boxW-0.16,h:boxH,fontSize:isStartEnd?10:_computeDiagramFontSize(boxW*72,boxH*72,cleanLabel.length),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          
          // 리더라인 (시작/종료 제외)
          if(refNum&&!isStartEnd){
            const leaderEndX=PAGE_MARGIN+0.3+normalBoxW;
            slide.addShape(pptx.shapes.LINE,{x:bx+boxW,y:by+boxH/2,w:leaderEndX-(bx+boxW)+0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(refNum),{x:leaderEndX+0.35,y:by+boxH/2-0.12,w:0.5,h:0.24,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
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
        const layout=computeDeviceLayout2D(nodes,edges,figNum);
        const{grid,maxCols,numRows,uniqueEdges}=layout;
        const colGap=0.35;
        const boxW2D=maxCols<=1?PAGE_W-2.0:maxCols===2?(PAGE_W-2.0-colGap)/2:(PAGE_W-2.0-colGap*2)/3;
        const nodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
        const marginX=PAGE_MARGIN+0.3;
        const boxStartY=PAGE_MARGIN+TITLE_H+0.2;
        const boxH=Math.min(0.55,(AVAILABLE_H-0.15*(numRows-1))/numRows);
        const refNumH=0.25;
        const rowGapBase=0.25;
        
        // ═══ v17: 전역 행 높이 통일 (PPTX) ═══
        let globalRowH=boxH+refNumH;
        const rowMaxShapeH={};
        nodes.forEach(n=>{const gp=grid[n.id];if(!gp)return;const st=matchIconShape(n.label);const sm=_shapeMetrics(st,boxW2D,boxH);const vb=_shapeVisualBounds(st,0,0,sm.sw,sm.sh);const h=Math.max(vb.bottom,boxH)+refNumH;if(h>globalRowH)globalRowH=h;const shapeH=Math.max(sm.sh,boxH);if(!rowMaxShapeH[gp.row]||shapeH>rowMaxShapeH[gp.row])rowMaxShapeH[gp.row]=shapeH;});
        globalRowH=Math.min(globalRowH,(boxH+refNumH)*1.3);
        let globalShapeH=boxH;
        Object.values(rowMaxShapeH).forEach(h=>{if(h>globalShapeH)globalShapeH=h;});
        globalShapeH=Math.min(globalShapeH,boxH*1.3);
        const rowY={};let accY=boxStartY;
        for(let r=0;r<numRows;r++){rowY[r]=accY;accY+=globalRowH+rowGapBase;}

        // ★ v10.5: 이중 좌표 — 셀 기반 라우팅 + 실제 shape 렌더링 (PPTX) ★
        const nodeBoxes={};
        nodes.forEach(n=>{
          const gp=grid[n.id];
          if(!gp)return;
          const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
          const rowStartX=marginX+(nodeAreaW-rowW)/2;
          const bx=rowStartX+gp.col*(boxW2D+colGap);
          const by=rowY[gp.row];
          const refNum=extractRefNum(n.label,String((parseInt(n.id.replace(/\D/g,''))||1)*100));
          const pptxDisplayLabel=isFig1?_shortenFig1Label(n.label):_safeCleanLabel(n.label);
          // 실제 shape 복원
          const shapeType=matchIconShape(n.label);
          const sm=_shapeMetrics(shapeType,boxW2D,boxH);
          // ★ v17: 전역 통일 shape 높이 (PPTX) ★
          const _rowCellH=globalShapeH;
          const sx=bx+sm.dx;
          const sy=by+Math.max(0,(_rowCellH-sm.sh)/2);

          addPptxIconShape(slide,shapeType,sx,sy,sm.sw,sm.sh,LINE_FRAME);
          const fontSize=_computeDiagramFontSize(sm.sw*72,sm.sh*72,pptxDisplayLabel.length);
          // ★ v13.0 FIX: 아이콘 shape 텍스트를 아이콘 하단 아래에 배치 (SVG와 동일 로직) ★
          if(_isIconShape(shapeType)){
            // sensor/antenna/camera/speaker: 아이콘이 전체 영역 차지 → 텍스트를 아이콘 아래에
            const iconBottomY=sy+sm.sh;
            slide.addText(pptxDisplayLabel,{x:sx,y:iconBottomY+0.03,w:sm.sw,h:0.25,fontSize:Math.max(fontSize-1,8),fontFace:'맑은 고딕',color:'000000',align:'center',valign:'top'});
          }else{
            const textH=shapeType==='monitor'?sm.sh*0.72:sm.sh;
            slide.addText(pptxDisplayLabel,{x:sx+0.04,y:sy,w:sm.sw-0.08,h:textH,fontSize,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          }

          // ★ v14 FIX: 라우팅 nodeBox — 행별 실제 shape 높이 반영 (PPTX) ★
          nodeBoxes[n.id]={x:bx, y:by, w:boxW2D, h:_rowCellH, cx:bx+boxW2D/2, cy:by+_rowCellH/2,
            _sx:sx, _sy:sy, _sw:sm.sw, _sh:sm.sh, _shapeType:shapeType};
        });
        
        // refNum 데이터 수집 — ★ v14 FIX: 실제 shape 위치 기반 ★
        const pptxRefData=[];
        nodes.forEach(n=>{
          const gp=grid[n.id];if(!gp)return;
          const refNum=extractRefNum(n.label,String((parseInt(n.id.replace(/\D/g,''))||1)*100));
          const nb=nodeBoxes[n.id];if(!nb)return;
          pptxRefData.push({id:n.id,refNum,sx:nb._sx,by:nb._sy,sw:nb._sw,sh:nb._sh});
        });
        
        // ★ v10.5: Phase 2 — 실제 앵커 기반 edge 라우팅 (PPTX) ★
        // ★ v11.1: PPTX는 인치 좌표 → px용 ROUTE_PAD(15) 대신 인치용 패딩 사용 ★
        const PPTX_PAD=0.08; // 인치: 연결선↔박스 최소 간격
        const edgesToDraw=uniqueEdges.length>0?uniqueEdges:nodes.slice(0,-1).map((n,i)=>({from:n.id,to:nodes[i+1].id}));
        // ★ v12 FIX: allBoxArr 루프 밖 호이스트 ★
        const pAllBoxArr=Object.entries(nodeBoxes).map(([k,v])=>({...v,id:k}));
        
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];
          if(!fb||!tb)return;
          const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
          const isH=Math.abs(dx)>=Math.abs(dy);
          
          // ★ v11: route 계산 → 충돌 검사 → 우회 ★
          let route;
          if(isH){
            const goR=dx>0;
            const fromAnc={x:goR?fb.x+fb.w:fb.x, y:fb.cy};
            const toAnc={x:goR?tb.x:tb.x+tb.w, y:tb.cy};
            if(Math.abs(fromAnc.y-toAnc.y)<0.02){
              route=[fromAnc, toAnc];
            }else{
              const midX=(fromAnc.x+toAnc.x)/2;
              route=[fromAnc,{x:midX,y:fromAnc.y},{x:midX,y:toAnc.y},toAnc];
            }
          }else{
            const goD=dy>0;
            const fromAnc={x:fb.cx, y:goD?fb.y+fb.h:fb.y};
            const toAnc={x:tb.cx, y:goD?tb.y:tb.y+tb.h};
            if(Math.abs(fromAnc.x-toAnc.x)<0.02){
              route=[fromAnc, toAnc];
            }else{
              const midY=(fromAnc.y+toAnc.y)/2;
              route=[fromAnc,{x:fromAnc.x,y:midY},{x:toAnc.x,y:midY},toAnc];
            }
          }
          
          // 충돌 검사 (PPTX — 인치 좌표)
          const pExclude=new Set([e.from, e.to]);
          if(_countRouteCollisions(route,pAllBoxArr,pExclude,PPTX_PAD)>0){
            const fbA={...fb,id:e.from}, tbA={...tb,id:e.to};
            const altRoute=getOrthogonalRoute(fbA,tbA,pAllBoxArr,PPTX_PAD);
            if(altRoute){
              route=_snapRouteToShapeAnchors(altRoute,fb,tb,0,0,pAllBoxArr,PPTX_PAD/ROUTE_PAD);
              // ★ v12 FIX: 4방향 우회 (상/하/좌/우) — SVG와 동일 ★
              if(_countRouteCollisions(route,pAllBoxArr,pExclude,PPTX_PAD)>0){
                const obstacles=pAllBoxArr.filter(b=>!pExclude.has(b.id));
                let bestDetour=null, bestHits=Infinity;
                for(const obs of obstacles){
                  const topY=obs.y-0.15;
                  const botY=obs.y+obs.h+0.15;
                  const leftX=obs.x-0.15;
                  const rightX=obs.x+obs.w+0.15;
                  const fa2=route[0], ta2=route[route.length-1];
                  [
                    [fa2,{x:fa2.x,y:topY},{x:ta2.x,y:topY},ta2],
                    [fa2,{x:fa2.x,y:botY},{x:ta2.x,y:botY},ta2],
                    [fa2,{x:leftX,y:fa2.y},{x:leftX,y:ta2.y},ta2],
                    [fa2,{x:rightX,y:fa2.y},{x:rightX,y:ta2.y},ta2]
                  ].forEach(dt=>{
                    const h=_countRouteCollisions(dt,pAllBoxArr,pExclude,PPTX_PAD);
                    if(h<bestHits){bestHits=h;bestDetour=dt;}
                  });
                }
                if(bestDetour&&bestHits<_countRouteCollisions(route,pAllBoxArr,pExclude,PPTX_PAD))route=bestDetour;
              }
            }
          }
          
          // PPTX 라인 그리기 (route 세그먼트별)
          // ★ v12: 화살표 방향 수정 + 바운딩 박스 클램핑 ★
          for(let ri=0;ri<route.length-1;ri++){
            const p1=route[ri], p2=route[ri+1];
            const isLast=ri===route.length-2;
            const isFirst=ri===0;
            const dx12=p2.x-p1.x, dy12=p2.y-p1.y;
            const isHoriz=Math.abs(dx12)>Math.abs(dy12);
            const goPositive=isHoriz?(dx12>=0):(dy12>=0);
            
            const lineOpts={color:'000000',width:LINE_ARROW};
            // 화살표는 route의 양 끝단에만 배치 — 방향 보정
            // PptxGenJS: beginArrow at (x,y), endArrow at (x+w,y+h)
            // Math.min 정규화: (x,y)=작은값 쪽, (x+w,y+h)=큰값 쪽
            if(isFirst){
              if(goPositive)lineOpts.beginArrowType='triangle'; // p1이 작은값 쪽
              else lineOpts.endArrowType='triangle';            // p1이 큰값 쪽
            }
            if(isLast){
              if(goPositive)lineOpts.endArrowType='triangle';   // p2가 큰값 쪽
              else lineOpts.beginArrowType='triangle';           // p2가 작은값 쪽
            }
            // 바운딩 클램핑 (슬라이드 영역 내)
            const cx1=Math.max(0.1,Math.min(p1.x,p2.x));
            const cy1=Math.max(0.1,Math.min(p1.y,p2.y));
            const cw=Math.max(0.001, Math.min(Math.abs(dx12)||0.001, PAGE_W+PAGE_MARGIN*2-cx1-0.1));
            const ch=Math.max(0.001, Math.min(Math.abs(dy12)||0.001, PAGE_H+PAGE_MARGIN*2-cy1-0.1));
            slide.addShape(pptx.shapes.LINE,{x:cx1,y:cy1,w:cw,h:ch,line:lineOpts});
          }
        });
        
        // Phase 3: 지능형 참조번호 배치 (연결 방향 회피)
        const pNodeConnDir={};
        (pptxRefData||[]).forEach(r=>{pNodeConnDir[r.id]={top:false,bottom:false,left:false,right:false};});
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];if(!fb||!tb)return;
          if(!pNodeConnDir[e.from]||!pNodeConnDir[e.to])return;
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
          const nb=nodeBoxes[r.id];
          // ★ v10.2: _shapeAnchor 기반 정확한 leader line 시작점 ★
          const st=nb?nb._shapeType:'box';
          const _sx=nb?nb._sx:r.sx, _sy=nb?nb._sy:r.by, _sw=nb?nb._sw:r.sw, _sh=nb?nb._sh:r.sh;
          if(!dir.bottom){
            const anc=_shapeAnchor(st,_sx,_sy,_sw,_sh,'bottom');
            slide.addShape(pptx.shapes.LINE,{x:anc.px,y:anc.py,w:0,h:0.12,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:anc.px-0.3,y:anc.py+0.12,w:0.6,h:0.2,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'top'});
          }else if(!dir.right){
            const anc=_shapeAnchor(st,_sx,_sy,_sw,_sh,'right');
            slide.addShape(pptx.shapes.LINE,{x:anc.px,y:anc.py,w:0.15,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:anc.px+0.15,y:anc.py-0.1,w:0.5,h:0.2,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
          }else if(!dir.left){
            const anc=_shapeAnchor(st,_sx,_sy,_sw,_sh,'left');
            slide.addShape(pptx.shapes.LINE,{x:anc.px-0.15,y:anc.py,w:0.15,h:0,line:{color:'000000',width:LINE_ARROW}});
            slide.addText(String(r.refNum),{x:anc.px-0.65,y:anc.py-0.1,w:0.5,h:0.2,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'right',valign:'middle'});
          }else{
            // 모든 방향 사용 중 → 내부 표시는 slide.addText로 2줄
            slide.addText('('+r.refNum+')',{x:_sx,y:_sy+_sh*0.55,w:_sw,h:0.2,fontSize:9,fontFace:'맑은 고딕',color:'444444',align:'center',valign:'top'});
          }
        });
      }else{
        // 도 2+: 공통 레이아웃 엔진 사용 (v8.0)
        const PPTX_PAD=0.08; // 인치: 연결선↔박스 최소 간격 (v11)
        
        const innerNodes=nodes.filter(n=>{
          const ref=extractRefNum(n.label,'');
          if(!ref)return true;
          if(parseInt(ref)===frameRefNum)return false;
          if(isL1RefNum(ref))return false;
          return true;
        });
        const displayNodes=innerNodes.length>0?innerNodes:nodes;
        const dCount=displayNodes.length;
        
        const innerLayout=computeDeviceLayout2D(displayNodes,edges,figNum);
        const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;
        // ★ v19: 전체 도면 세트 기준 블록 크기 통일 (PPTX, 정규화) ★
        const _pEffCols=Math.max(innerMaxCols, _pptxGlobalMaxCols);
        const _rawPptxInnerBoxW=_pEffCols===2?(PAGE_W-1.6-0.35)/2:(PAGE_W-1.6-0.35*2)/3;
        const innerBoxW=Math.min(_rawPptxInnerBoxW, 2.8);
        const pBoxH=Math.min(0.65,(AVAILABLE_H-0.7-0.30*(innerNumRows-1))/innerNumRows);

        const fig2L=computeFig2Layout(displayNodes,edges,innerGrid,_pEffCols,innerNumRows,innerUniqueEdges,frameRefNum,{
          boxBaseW:innerBoxW, boxBaseH:pBoxH,
          colGap:0.55, rowGap:0.50, framePad:0.55,
          shadowSize:SHADOW_OFFSET, scale:1,
          routePad:PPTX_PAD
        });
        
        const frameX=PAGE_MARGIN,frameY=PAGE_MARGIN+TITLE_H;
        const frameW=fig2L.frameW;
        const frameH=fig2L.frameH;
        const refLabelX=frameX+frameW+0.1;
        
        // 외곽 프레임 (테두리만)
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
          const fontSize=_computeDiagramFontSize(sm.sw*72,sm.sh*72,cleanLabel.length);
          slide.addText([{text:cleanLabel,options:{fontSize,breakType:'none'}},{text:'\n('+refNum+')',options:{fontSize:Math.max(fontSize-1,7),color:'444444'}}],{x:sx+0.04,y:by,w:sm.sw-0.08,h:textH,fontFace:'맑은 고딕',color:'000000',align:'center',valign:'middle'});
          
          innerNodeBoxes[nd.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2,
            _shapeType:shapeType,_sx:sx,_sy:by,_sw:sm.sw,_sh:sm.sh};
        });
        
        const frameLeaderY=frameY+frameH/2;
        slide.addShape(pptx.shapes.LINE,{x:frameX+frameW,y:frameLeaderY,w:0.3,h:0,line:{color:'000000',width:LINE_ARROW}});
        slide.addText(String(frameRefNum),{x:refLabelX+0.3,y:frameLeaderY-0.12,w:0.5,h:0.24,fontSize:REF_NUM_FONT_SIZE,fontFace:'맑은 고딕',color:'000000',align:'left',valign:'middle'});
        
        // ★ Edge 기반 연결선 (fan 오프셋 겹침 방지) ★
        const innerEdgesToDraw=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
        const pInnerFan={};const pInnerOff={};
        innerEdgesToDraw.forEach(e=>{['from','to'].forEach(k=>{const nid=e[k];if(!pInnerFan[nid])pInnerFan[nid]=0;const key=e.from+'_'+e.to;if(!pInnerOff[key])pInnerOff[key]={};pInnerOff[key][k+'Idx']=pInnerFan[nid];pInnerFan[nid]++;});});
        // ★ v12 FIX HIGH-3: allBoxArr를 루프 밖으로 호이스트 ★
        const pAllInnerBoxArr=Object.entries(innerNodeBoxes).map(([k,v])=>({...v,id:k}));
        innerEdgesToDraw.forEach(e=>{
          const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
          if(!fb||!tb)return;
          const key=e.from+'_'+e.to;
          const fanF=pInnerFan[e.from]||1,fanT=pInnerFan[e.to]||1;
          const iF=pInnerOff[key]?.fromIdx||0,iT=pInnerOff[key]?.toIdx||0;
          const offF=fanF>1?(iF-((fanF-1)/2))*0.08:0;
          const offT=fanT>1?(iT-((fanT-1)/2))*0.08:0;
          // ★ v11: 충돌 검사 기반 라우팅 ★
          const fbA={...fb};const tbA={...tb};
          const pts=getConnectionPoints(fbA,tbA);
          if(!pts)return;
          
          let route;
          const dx2=pts.x2-pts.x1,dy2=pts.y2-pts.y1;
          if(Math.abs(dx2)<0.01){
            route=[{x:pts.x1,y:pts.y1},{x:pts.x2,y:pts.y2}];
          }else if(Math.abs(dy2)<0.01){
            route=[{x:pts.x1,y:pts.y1},{x:pts.x2,y:pts.y2}];
          }else{
            const midY=(pts.y1+pts.y2)/2;
            route=[{x:pts.x1,y:pts.y1},{x:pts.x1,y:midY},{x:pts.x2,y:midY},{x:pts.x2,y:pts.y2}];
          }
          
          // 충돌 검사
          const pExclude2=new Set([e.from,e.to]);
          if(_countRouteCollisions(route,pAllInnerBoxArr,pExclude2,PPTX_PAD)>0){
            const alt=getOrthogonalRoute({...fb,id:e.from},{...tb,id:e.to},pAllInnerBoxArr,PPTX_PAD);
            if(alt){
              // ★ v12 FIX HIGH-2: fan offset 실제 적용 ★
              route=_snapRouteToShapeAnchors(alt,fb,tb,offF,offT,pAllInnerBoxArr,PPTX_PAD/ROUTE_PAD);
              if(_countRouteCollisions(route,pAllInnerBoxArr,pExclude2,PPTX_PAD)>0){
                const obstacles=pAllInnerBoxArr.filter(b=>!pExclude2.has(b.id));
                let bestDet=null,bestH=Infinity;
                // ★ v12 FIX HIGH-1: 4방향 우회 (상/하/좌/우) — SVG와 동일 ★
                for(const obs of obstacles){
                  const tY=obs.y-0.15,bY=obs.y+obs.h+0.15;
                  const lX=obs.x-0.15,rX=obs.x+obs.w+0.15;
                  const fa=route[0],ta=route[route.length-1];
                  [
                    [fa,{x:fa.x,y:tY},{x:ta.x,y:tY},ta],       // 위 우회
                    [fa,{x:fa.x,y:bY},{x:ta.x,y:bY},ta],       // 아래 우회
                    [fa,{x:lX,y:fa.y},{x:lX,y:ta.y},ta],        // 왼쪽 우회
                    [fa,{x:rX,y:fa.y},{x:rX,y:ta.y},ta]         // 오른쪽 우회
                  ].forEach(dt=>{
                    const h2=_countRouteCollisions(dt,pAllInnerBoxArr,pExclude2,PPTX_PAD);
                    if(h2<bestH){bestH=h2;bestDet=dt;}
                  });
                }
                if(bestDet&&bestH<_countRouteCollisions(route,pAllInnerBoxArr,pExclude2,PPTX_PAD))route=bestDet;
              }
            }
          }
          
          // PPTX 라인 그리기
          // ★ v12: 화살표 방향 수정 + 바운딩 박스 클램핑 ★
          for(let ri=0;ri<route.length-1;ri++){
            const p1=route[ri],p2=route[ri+1];
            const isLast=ri===route.length-2, isFirst=ri===0;
            const dx12=p2.x-p1.x, dy12=p2.y-p1.y;
            const isHoriz=Math.abs(dx12)>Math.abs(dy12);
            const goPositive=isHoriz?(dx12>=0):(dy12>=0);
            
            const lineOpts={color:'000000',width:LINE_ARROW};
            if(isFirst){
              if(goPositive)lineOpts.beginArrowType='triangle';
              else lineOpts.endArrowType='triangle';
            }
            if(isLast){
              if(goPositive)lineOpts.endArrowType='triangle';
              else lineOpts.beginArrowType='triangle';
            }
            const cx1=Math.max(0.1,Math.min(p1.x,p2.x));
            const cy1=Math.max(0.1,Math.min(p1.y,p2.y));
            const cw=Math.max(0.001, Math.min(Math.abs(dx12)||0.001, PAGE_W+PAGE_MARGIN*2-cx1-0.1));
            const ch=Math.max(0.001, Math.min(Math.abs(dy12)||0.001, PAGE_H+PAGE_MARGIN*2-cy1-0.1));
            slide.addShape(pptx.shapes.LINE,{x:cx1,y:cy1,w:cw,h:ch,line:lineOpts});
          }
        });
      }
    });
    
    // ★ T4: 사용자 도면(이미지) 슬라이드 추가 — 장치 도면(step_07) PPTX 에만(중복 방지). base64 fileDataUrl 재사용(비전 불필요).
    if(sid==='step_07'){try{_appendUserFigureSlides(pptx);}catch(_uf){console.warn('user figure slides skip:',_uf);}}
    const fileName=selectedTitle||selectedTitleEn||'도면';
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
// [고해상도] 800×1000 / 1360×1000 → 3배 확대 (2400×3000 / 4080×3000)
//   ctx.scale(SCALE,SCALE)로 좌표계 보존 → 기존 그리기 코드 무수정
const _IMG_DL_SCALE=3;

// Canvas → 진짜 TIFF Blob 변환 (UTIF v3.1.0)
//   기존: TIF 요청 시 PNG로 저장 (확장자만 .png) — 가짜 TIFF
//   수정: UTIF.encodeImage로 진짜 TIFF (image/tiff)
function _canvasToTiffBlob(canvas){
  if(typeof UTIF==='undefined'){console.warn('[TIFF] UTIF 라이브러리 없음 — 출력 생략');return null;}
  try{
    const ctx=canvas.getContext('2d');
    const w=canvas.width, h=canvas.height;
    const imgData=ctx.getImageData(0,0,w,h);
    const tiffArr=UTIF.encodeImage(imgData.data.buffer,w,h);
    return new Blob([tiffArr],{type:'image/tiff'});
  }catch(e){console.error('[TIFF] 인코딩 실패:',e);return null;}
}

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
  
  const autoFigNums=getAutoFigNums(sid);
  const figOffset=sid==='step_11'?getLastFigureNumber(outputs.step_07||''):0;
  const caseNum=selectedTitle||'도면';
  
  const extractRefNum=_sharedExtractRefNum;
  const isL1RefNum=_sharedIsL1RefNum;
  const findImmediateParent=_sharedFindImmediateParent;

  App.showToast(`도면 이미지 생성 중... (${data.length}개)`);

  // ★ v18.2: 전체 도면 세트에서 최대 열 수 사전 계산 (Canvas) ★
  let _canvasGlobalMaxCols=1;
  data.forEach(({nodes,edges},idx)=>{
    const figNum=autoFigNums[idx]||(figOffset+idx+1);
    const allL1=nodes.every(n=>isL1RefNum(extractRefNum(n.label,'')));
    if(figNum===1||allL1)return;
    const cRefs=nodes.map(n=>extractRefNum(n.label,'')).filter(Boolean);
    let cFrameRef=findImmediateParent(cRefs);
    if(!cFrameRef&&cRefs.length>0){const fr=parseInt(cRefs[0])||100;cFrameRef=Math.floor(fr/100)*100;}
    if(!cFrameRef)cFrameRef=100;
    const innerNodes=nodes.filter(n=>{const ref=extractRefNum(n.label,'');if(!ref)return true;const num=parseInt(ref);if(num===cFrameRef)return false;if(isL1RefNum(ref))return false;return true;});
    if(!innerNodes.length)return;
    const layout=computeDeviceLayout2D(innerNodes,edges,figNum);
    if(layout.maxCols>_canvasGlobalMaxCols)_canvasGlobalMaxCols=layout.maxCols;
  });

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
    const figNum=autoFigNums[currentIdx]||(figOffset+currentIdx+1);
    const hasEdges=edges&&edges.length>0;
    
    // 캔버스 생성 — [고해상도] 3배 확대, ctx.scale로 좌표계는 800×1000 유지
    const canvas=document.createElement('canvas');
    const W=800,H=1000;
    canvas.width=W*_IMG_DL_SCALE;
    canvas.height=H*_IMG_DL_SCALE;
    const ctx=canvas.getContext('2d');
    ctx.scale(_IMG_DL_SCALE,_IMG_DL_SCALE);
    
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
            function cloudPath(ox,oy){
              ctx.beginPath();
              ctx.moveTo(ox+w*0.2,oy+h*0.82);
              ctx.bezierCurveTo(ox+w*0.02,oy+h*0.84,ox,oy+h*0.44,ox+w*0.18,oy+h*0.36);
              ctx.bezierCurveTo(ox+w*0.1,oy+h*0.08,ox+w*0.35,oy,ox+w*0.48,oy+h*0.16);
              ctx.bezierCurveTo(ox+w*0.58,oy-h*0.01,ox+w*0.82,oy+h*0.06,ox+w*0.8,oy+h*0.34);
              ctx.bezierCurveTo(ox+w*0.98,oy+h*0.32,ox+w,oy+h*0.82,ox+w*0.8,oy+h*0.82);
              ctx.closePath();
            }
            // Shadow
            cloudPath(x+shadowOff,y+shadowOff);
            ctx.fillStyle='#000000';ctx.fill();
            // Body
            cloudPath(x,y);
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
        const layout=computeDeviceLayout2D(nodes,edges,figNum);
        const{grid,maxCols,numRows,uniqueEdges}=layout;
        const colGap=25;
        // v10.3: 셀 너비 확대 (한글 텍스트 수용)
        const boxW2D=maxCols<=1?520:maxCols===2?340:230;
        const nodeAreaW=maxCols*boxW2D+(maxCols-1)*colGap;
        const marginX=30;
        const boxStartY=50;
        const boxH=Math.min(55,(850-10*(numRows-1))/numRows);
        const refNumH=22;
        const rowGapBase=25;
        
        // ═══ v17: 전역 행 높이 통일 (Canvas) ═══
        let globalRowH=boxH+refNumH;
        const rowMaxShapeH={};
        nodes.forEach(nd=>{const gp=grid[nd.id];if(!gp)return;const st=matchIconShape(nd.label);const sm=_shapeMetrics(st,boxW2D,boxH);const vb=_shapeVisualBounds(st,0,0,sm.sw,sm.sh);const h=Math.max(vb.bottom,boxH)+refNumH;if(h>globalRowH)globalRowH=h;const shapeH=Math.max(sm.sh,boxH);if(!rowMaxShapeH[gp.row]||shapeH>rowMaxShapeH[gp.row])rowMaxShapeH[gp.row]=shapeH;});
        globalRowH=Math.min(globalRowH,(boxH+refNumH)*1.3);
        let globalShapeH=boxH;
        Object.values(rowMaxShapeH).forEach(h=>{if(h>globalShapeH)globalShapeH=h;});
        globalShapeH=Math.min(globalShapeH,boxH*1.3);
        const rowY={};let accY=boxStartY;
        for(let r=0;r<numRows;r++){rowY[r]=accY;accY+=globalRowH+rowGapBase;}

        // ★ v10.5: Phase 1 — 이중 좌표: 셀 기반 라우팅 + 실제 shape 렌더링 ★
        const nodeBoxes={};
        const nodeData=[];
        nodes.forEach(nd=>{
          const gp=grid[nd.id];if(!gp)return;
          const rowW=gp.layerSize*boxW2D+(gp.layerSize-1)*colGap;
          const rowStartX=marginX+(nodeAreaW-rowW)/2;
          const bx=rowStartX+gp.col*(boxW2D+colGap);
          const by=rowY[gp.row];
          const refNum=extractRefNum(nd.label,String((parseInt(nd.id.replace(/\D/g,''))||1)*100));
          const cleanLabel=_safeCleanLabel(nd.label);
          const cDisplayLabel=isFig1?_shortenFig1Label(nd.label):cleanLabel;
          const shapeType=matchIconShape(nd.label);
          const sm=_shapeMetrics(shapeType,boxW2D,boxH);
          // ★ v17: 전역 통일 shape 높이 (Canvas) ★
          const _rowCellH=globalShapeH;
          const sx=bx+sm.dx;
          const sy=by+Math.max(0,(_rowCellH-sm.sh)/2);
          // 라우팅 nodeBox — 행별 실제 shape 높이 반영
          nodeBoxes[nd.id]={x:bx, y:by, w:boxW2D, h:_rowCellH,
            cx:bx+boxW2D/2, cy:by+_rowCellH/2,
            _shapeType:shapeType, _sx:sx, _sy:sy, _sw:sm.sw, _sh:sm.sh};
          nodeData.push({id:nd.id, sx, sy, sw:sm.sw, sh:sm.sh,
            shapeType, cleanLabel:cDisplayLabel, refNum, row:gp.row, col:gp.col});
        });
        
        // Phase 1.5: 겹침 검증 (실제 shape 높이 기반)
        const REF_PAD=refNumH+4, MIN_GAP=6;
        let fixApplied=true, fixRounds=0;
        while(fixApplied&&fixRounds<10){fixApplied=false;fixRounds++;
          for(let i=0;i<nodeData.length;i++){const a=nodeData[i];const aBot=a.sy+a.sh+REF_PAD;
            for(let j=0;j<nodeData.length;j++){if(i===j)continue;const b=nodeData[j];
              if(a.row===b.row)continue;
              const hOvl=!(a.sx+a.sw+6<b.sx||b.sx+b.sw+6<a.sx);
              if(hOvl&&b.sy<aBot+MIN_GAP&&b.sy>=a.sy){const push=aBot+MIN_GAP-b.sy;
                // ★ v14 FIX: 셀 y도 동일 push 이동 (centering offset 유지) ★
                if(push>0){b.sy+=push;nodeBoxes[b.id].y+=push;nodeBoxes[b.id].cy=nodeBoxes[b.id].y+nodeBoxes[b.id].h/2;nodeBoxes[b.id]._sy=b.sy;fixApplied=true;}}
        }}}
        
        // Phase 2: 연결선 — 실제 shape anchor 기반 라우팅
        function drawCanvasOrthogonalEdge(ctx,route,aLen){
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
        // ★ v13.0 FIX: allBoxArr 루프 밖 호이스트 (Canvas Fig1) ★
        const allBoxArr=Object.entries(nodeBoxes).map(([k,v])=>({...v,id:k}));
        edgesToDraw.forEach(e=>{
          const fb=nodeBoxes[e.from],tb=nodeBoxes[e.to];if(!fb||!tb)return;
          const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
          const isH=Math.abs(dx)>=Math.abs(dy);
          let route;
          if(isH){
            const goR=dx>0;
            const fromAnc={x:goR?fb.x+fb.w:fb.x, y:fb.cy};
            const toAnc={x:goR?tb.x:tb.x+tb.w, y:tb.cy};
            if(Math.abs(fromAnc.y-toAnc.y)<3)route=[fromAnc,toAnc];
            else{const midX=(fromAnc.x+toAnc.x)/2;route=[fromAnc,{x:midX,y:fromAnc.y},{x:midX,y:toAnc.y},toAnc];}
          }else{
            const goD=dy>0;
            const fromAnc={x:fb.cx, y:goD?fb.y+fb.h:fb.y};
            const toAnc={x:tb.cx, y:goD?tb.y:tb.y+tb.h};
            if(Math.abs(fromAnc.x-toAnc.x)<3)route=[fromAnc,toAnc];
            else{const midY=(fromAnc.y+toAnc.y)/2;route=[fromAnc,{x:fromAnc.x,y:midY},{x:toAnc.x,y:midY},toAnc];}
          }
          // 충돌 검사
          const excludeIds=new Set([e.from,e.to]);
          if(_countRouteCollisions(route,allBoxArr,excludeIds)>0){
            const fbA={...fb,id:e.from};const tbA={...tb,id:e.to};
            const alt=getOrthogonalRoute(fbA,tbA,allBoxArr);
            if(alt)route=_snapRouteToShapeAnchors(alt,fb,tb,0,0,allBoxArr);
          }
          if(route)drawCanvasOrthogonalEdge(ctx,route,6);
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
          // ★ v10.4: 도 1은 축약 라벨 사용 ★
          const displayLabel=isFig1?_shortenFig1Label(nd.label||cleanLabel):cleanLabel;
          let fontSize=_computeDiagramFontSize(sw,sh,displayLabel.length);
          const cDir=nodeConnDir[id]||{};
          const cRefInside=cDir.top&&cDir.bottom&&cDir.left&&cDir.right;
          const cLabelMaxW=sw*0.90;
          const cLabelCy=cRefInside?_shapeTextCy(shapeType,sy,sh)-4:_shapeTextCy(shapeType,sy,sh);
          const cResult=_canvasMultiLineLabel(ctx,sx+sw/2,cLabelCy,displayLabel,cLabelMaxW,fontSize,{minFontSize:7});
          fontSize=cResult.fontSize;
          // ★ 참조번호: 연결 없는 쪽에 배치 (v10.2: _shapeAnchor 기반) ★
          const dir=nodeConnDir[id]||{};
          ctx.strokeStyle='#000000';ctx.lineWidth=1;ctx.font='11px "맑은 고딕", sans-serif';
          if(!dir.bottom){
            const anc=_shapeAnchor(shapeType,sx,sy,sw,sh,'bottom');
            ctx.beginPath();ctx.moveTo(anc.px,anc.py);ctx.lineTo(anc.px,anc.py+12);ctx.stroke();
            ctx.fillText(String(refNum),anc.px,anc.py+24);
          }else if(!dir.right){
            const anc=_shapeAnchor(shapeType,sx,sy,sw,sh,'right');
            ctx.beginPath();ctx.moveTo(anc.px,anc.py);ctx.lineTo(anc.px+15,anc.py);ctx.stroke();
            ctx.textAlign='left';ctx.fillText(String(refNum),anc.px+17,anc.py+1);
          }else if(!dir.left){
            const anc=_shapeAnchor(shapeType,sx,sy,sw,sh,'left');
            ctx.beginPath();ctx.moveTo(anc.px,anc.py);ctx.lineTo(anc.px-15,anc.py);ctx.stroke();
            ctx.textAlign='right';ctx.fillText(String(refNum),anc.px-17,anc.py+1);
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
        
        const innerLayout=computeDeviceLayout2D(displayNodes,edges,figNum);
        const{grid:innerGrid,maxCols:innerMaxCols,numRows:innerNumRows,uniqueEdges:innerUniqueEdges}=innerLayout;

        const SHADOW_PX=2;
        const LEADER_W=35, REF_LABEL_W=50;
        // ★ v19: 전체 도면 세트 기준 블록 크기 통일 (Canvas, 정규화) ★
        const _cEffCols=Math.max(innerMaxCols, _canvasGlobalMaxCols);
        const _rawCInnerBoxW=_cEffCols===2?210:155;
        const cInnerBoxW=Math.min(_rawCInnerBoxW, 250);
        const cBoxH=Math.min(55,Math.max(40,(750-60)/Math.max(innerNumRows,1)));

        const fig2L=computeFig2Layout(displayNodes,edges,innerGrid,_cEffCols,innerNumRows,innerUniqueEdges,frameRefNum,{
          boxBaseW:cInnerBoxW, boxBaseH:cBoxH,
          colGap:60, rowGap:60, framePad:60,
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
          innerNodeBoxes[nd.id]={x:sx,y:by,w:sm.sw,h:sm.sh,cx:sx+sm.sw/2,cy:by+sm.sh/2,
            _shapeType:shapeType,_sx:sx,_sy:by,_sw:sm.sw,_sh:sm.sh};
        });
        
        const innerEdges=innerUniqueEdges.length>0?innerUniqueEdges:(hasEdges&&displayNodes.length>1?displayNodes.slice(0,-1).map((n,i)=>({from:n.id,to:displayNodes[i+1].id})):[]);
        // ★ v13.0 FIX: allBoxArr 루프 밖 호이스트 (Canvas Fig2) ★
        const allBoxArr=Object.entries(innerNodeBoxes).map(([k,v])=>({...v,id:k}));
        innerEdges.forEach(e=>{
          const fb=innerNodeBoxes[e.from],tb=innerNodeBoxes[e.to];
          if(!fb||!tb)return;
          const dx=tb.cx-fb.cx, dy=tb.cy-fb.cy;
          const isH=Math.abs(dx)>=Math.abs(dy);
          let route;
          if(isH){
            const goR=dx>0;
            const fa={x:goR?fb.x+fb.w:fb.x, y:fb.cy};
            const ta={x:goR?tb.x:tb.x+tb.w, y:tb.cy};
            route=Math.abs(fa.y-ta.y)<3?[fa,ta]:[fa,{x:(fa.x+ta.x)/2,y:fa.y},{x:(fa.x+ta.x)/2,y:ta.y},ta];
          }else{
            const goD=dy>0;
            const fa={x:fb.cx, y:goD?fb.y+fb.h:fb.y};
            const ta={x:tb.cx, y:goD?tb.y:tb.y+tb.h};
            route=Math.abs(fa.x-ta.x)<3?[fa,ta]:[fa,{x:fa.x,y:(fa.y+ta.y)/2},{x:ta.x,y:(fa.y+ta.y)/2},ta];
          }
          // 충돌 검사 — ★ v13.0: allBoxArr는 루프 밖에서 1회 생성 ★
          const excludeIds=new Set([e.from,e.to]);
          if(_countRouteCollisions(route,allBoxArr,excludeIds)>0){
            const fbA={...fb,id:e.from};const tbA={...tb,id:e.to};
            const alt=getOrthogonalRoute(fbA,tbA,allBoxArr);
            if(alt)route=_snapRouteToShapeAnchors(alt,fb,tb,0,0,allBoxArr);
          }
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
          // ★ v10.4: 잘림("…") 완전 제거 — 전체 라벨 멀티라인 표시 ★
          const displayLabel=cleanLabel;
          const fontSize=innerMaxCols>2?9:innerMaxCols>1?10:11;
          const textCy=_shapeTextCy(shapeType,by,sm.sh);
          const cLabelMaxW2=sm.sw*0.90;
          const cFit2=_fitLabelLines(displayLabel,cLabelMaxW2,fontSize,7);
          const cLabelYOff2=cFit2.lines.length>1?-6:0;
          _canvasMultiLineLabel(ctx,sx+sm.sw/2,textCy+cLabelYOff2,displayLabel,cLabelMaxW2,fontSize,{minFontSize:7});
          ctx.fillStyle='#444444';ctx.font=`${Math.max(fontSize-1,8)}px "맑은 고딕", sans-serif`;
          ctx.textAlign='center';ctx.textBaseline='middle';
          const cRefY2=cFit2.lines.length>1?textCy+cFit2.fontSize+4:textCy+8;
          ctx.fillText('('+refNum+')',sx+sm.sw/2,cRefY2);
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
    
    // 이미지를 ZIP에 추가 — [진짜 TIFF] tif/tiff 시 UTIF로 인코딩, .tif 확장자
    try{
      const isTiff=(format==='tif'||format==='tiff');
      const ext=isTiff?'tif':(format==='jpeg'?'jpg':format);
      const fileName=`${caseNum}_도${figNum}.${ext}`;

      if(isTiff){
        const blob=_canvasToTiffBlob(canvas);
        if(blob)imageFiles.push({name:fileName,blob:blob});
        currentIdx++;
        setTimeout(processNext,50);
      } else {
        const mimeType=`image/${format==='jpeg'?'jpeg':'png'}`;
        const quality=format==='jpeg'?0.95:undefined;
        canvas.toBlob(blob=>{
          if(blob){
            imageFiles.push({name:fileName,blob:blob});
          }
          currentIdx++;
          setTimeout(processNext,50);
        },mimeType,quality);
      }
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

// ═══ v11.0: 예시도/개념도 PPTX 다운로드 ═══
function downloadConceptPptx(){
  const generated=conceptDiagramTypes.filter(ct=>ct.svgContent);
  if(!generated.length){App.showToast('예시도 없음','error');return;}
  if(typeof PptxGenJS==='undefined'){App.showToast('PptxGenJS 미로드','error');return;}
  const cFigNums=getAutoFigNums('step_07c');
  const caseNum=selectedTitle||'도면';
  const pptx=new PptxGenJS();
  pptx.layout='LAYOUT_WIDE';

  let completed=0;
  const total=generated.length;

  function processSlide(idx){
    if(idx>=total){
      pptx.writeFile({fileName:`${caseNum}_예시도.pptx`}).then(()=>{
        App.showToast(`예시도 PPTX 다운로드 완료 (${total}슬라이드)`);
      }).catch(e=>App.showToast('PPTX 생성 실패: '+e.message,'error'));
      return;
    }
    const ct=generated[idx];
    const figNum=cFigNums[conceptDiagramTypes.indexOf(ct)]||idx+1;
    const svgStr=_conceptSvgApplyTitle(ct.svgContent, figNum); // ★ ① 다운로드 제목도 SoT(figNum) 동기화

    // SVG→Canvas→PNG base64→PPTX slide
    const blob=new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=1360;canvas.height=1000;
      const ctx2=canvas.getContext('2d');
      ctx2.fillStyle='#FFFFFF';ctx2.fillRect(0,0,1360,1000);
      ctx2.drawImage(img,0,0,1360,1000);
      const dataUrl=canvas.toDataURL('image/png');
      const slide=pptx.addSlide();
      slide.addText(`도 ${figNum}`,{x:0.3,y:0.15,fontSize:18,fontFace:'맑은 고딕',bold:true});
      slide.addImage({data:dataUrl,x:0.5,y:0.6,w:12.33,h:6.5});
      URL.revokeObjectURL(url);
      processSlide(idx+1);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);processSlide(idx+1);};
    img.src=url;
  }
  processSlide(0);
}

// ═══ v11.0: 예시도/개념도 이미지 다운로드 ═══
function downloadConceptImages(format='jpeg'){
  const generated=conceptDiagramTypes.filter(ct=>ct.svgContent);
  if(!generated.length){App.showToast('예시도 없음','error');return;}
  const cFigNums=getAutoFigNums('step_07c');
  const caseNum=selectedTitle||'도면';
  const zip=typeof JSZip!=='undefined'?new JSZip():null;
  const images=[];
  let idx=0;

  function processNext(){
    if(idx>=generated.length){
      if(zip&&images.length){
        images.forEach(f=>zip.file(f.name,f.blob));
        zip.generateAsync({type:'blob'}).then(blob=>{
          const a=document.createElement('a');
          a.download=`${caseNum}_예시도_${format}.zip`;
          a.href=URL.createObjectURL(blob);
          a.click();
          URL.revokeObjectURL(a.href);
          App.showToast(`예시도 ${images.length}개 ZIP 다운로드 완료`);
        });
      }
      return;
    }
    const ct=generated[idx];
    const figNum=cFigNums[conceptDiagramTypes.indexOf(ct)]||idx+1;
    // SVG→Canvas→Image
    const svgStr=_conceptSvgApplyTitle(ct.svgContent, figNum); // ★ ① 다운로드 제목도 SoT(figNum) 동기화
    const blob=new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      // [고해상도] 1360×1000 → 4080×3000, ctx.scale로 SVG 재래스터화 시 고해상도 출력
      const canvas=document.createElement('canvas');
      canvas.width=1360*_IMG_DL_SCALE;canvas.height=1000*_IMG_DL_SCALE;
      const ctx2=canvas.getContext('2d');
      ctx2.scale(_IMG_DL_SCALE,_IMG_DL_SCALE);
      ctx2.fillStyle='#FFFFFF';ctx2.fillRect(0,0,1360,1000);
      ctx2.drawImage(img,0,0,1360,1000);

      // [진짜 TIFF] tif 시 UTIF 사용, 확장자도 .tif
      const isTiff=(format==='tif'||format==='tiff');
      const ext=isTiff?'tif':format;
      const handleBlob=(b)=>{
        if(b){
          const fname=`도${figNum}_예시도.${ext}`;
          if(zip)images.push({name:fname,blob:b});
          else{const a=document.createElement('a');a.download=fname;a.href=URL.createObjectURL(b);a.click();URL.revokeObjectURL(a.href);}
        }
        URL.revokeObjectURL(url);
        idx++;
        processNext();
      };

      if(isTiff){
        handleBlob(_canvasToTiffBlob(canvas));
      } else {
        canvas.toBlob(handleBlob,`image/${format}`,0.95);
      }
    };
    img.onerror=()=>{URL.revokeObjectURL(url);idx++;processNext();};
    img.src=url;
  }
  processNext();
}

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
function renderClaimResult(c,sid,text){const st=parseClaimStats(text),iss=validateClaims(text);let h=renderScopeBadgeSummary(sid);h+=`<div class="stat-row" style="margin-top:12px"><div class="stat-card stat-card-steps"><div class="stat-card-value">${st.total}</div><div class="stat-card-label">총 청구항</div></div><div class="stat-card stat-card-api"><div class="stat-card-value">${st.independent}</div><div class="stat-card-label">독립항</div></div><div class="stat-card stat-card-cost"><div class="stat-card-value">${st.dependent}</div><div class="stat-card-label">종속항</div></div></div>`;if(iss.length)h+=iss.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':'issue-high'}"><span class="status-dot ${i.severity==='CRITICAL'?'negative':'cautionary'}"></span>${App.escapeHtml(i.message)}</div>`).join('');else h+='<div class="issue-item issue-pass"><span class="ico" data-icon="check-circle"></span>모든 검증 통과</div>';h+=`<textarea class="result-textarea" rows="14" onchange="pushOutputHistory('${sid}','user_edit','renderClaimResult');outputs['${sid}']=this.value">${App.escapeHtml(text)}</textarea>`;c.innerHTML=h;}
function renderEditableResult(c,sid,text){c.innerHTML=renderScopeBadgeSummary(sid)+`<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="badge badge-primary">${STEP_NAMES[sid]||sid}</span><span class="badge badge-neutral" id="charCount_${sid}">${text.length.toLocaleString()}자</span></div><textarea class="result-textarea" rows="10" onchange="pushOutputHistory('${sid}','user_edit','renderEditableResult');outputs['${sid}']=this.value;markOutputTimestamp('${sid}');saveProject(true);document.getElementById('charCount_${sid}').textContent=this.value.length.toLocaleString()+'자'" oninput="outputs['${sid}']=this.value;document.getElementById('charCount_${sid}').textContent=this.value.length.toLocaleString()+'자'">${App.escapeHtml(text)}</textarea></div>`;}
function renderBatchResult(cid,sid,text){
  const container=document.getElementById(cid);if(!container)return;
  // v15: 멱등 렌더 — 동일 단계 항목이 있으면 교체(채팅 단독 수정 시 중복 방지)
  const html=`<div class="batch-item" data-batch-step="${sid}"><div class="accordion-header" onclick="toggleAccordion(this)"><span><span class="ico" data-icon="check-circle"></span> ${STEP_NAMES[sid]} <span class="badge badge-neutral">${text.length.toLocaleString()}자</span></span><span class="arrow"><span class="ico" data-icon="chevron-down" data-size="12"></span></span></div><div class="accordion-body"><textarea class="result-textarea" style="min-height:120px" onchange="pushOutputHistory('${sid}','user_edit','renderBatchResult');outputs['${sid}']=this.value">${App.escapeHtml(text)}</textarea><div class="chat-mount" id="chatMount_${sid}"></div></div></div>`;
  const existing=container.querySelector(`[data-batch-step="${sid}"]`);
  if(existing){const tmp=document.createElement('div');tmp.innerHTML=html;existing.replaceWith(tmp.firstElementChild);}
  else container.insertAdjacentHTML('beforeend',html);
  if(window.PatentChat)PatentChat.mount(sid);
}
function toggleAccordion(h){h.classList.toggle('open');const b=h.nextElementSibling;if(b)b.classList.toggle('open');}

// ═══════════ VALIDATION (v4.9 — full claim chain + relaxed matching) ═══════════
const KILLER_WORDS=[{pattern:/반드시/,msg:'"반드시" — 제한적 표현'},{pattern:/에 한하여/,msg:'"~에 한하여" — 제한적 표현'},{pattern:/에 한정/,msg:'"~에 한정" — 제한적 표현'},{pattern:/에 제한/,msg:'"~에 제한" — 제한적 표현'},{pattern:/필수적으로/,msg:'"필수적으로" — 제한적 표현'},{pattern:/무조건/,msg:'"무조건" — 제한적 표현'},{pattern:/오직/,msg:'"오직" — 제한적 표현'}];
// v4.9: Get full text of claim chain (claim N → references → parent → ... → independent)
// v5.1: Get ONLY cited claim chain text (follows "청구항 N에 있어서" references upward)
// Does NOT include unrelated claims — only the direct citation path
function getCitedChainText(claimNum, claims){
  const ct=claims[claimNum];
  if(!ct)return '';
  const rm=ct.match(/(?:청구항|제)\s*(\d+)\s*(?:항\s*)?에\s*있어서/);
  if(!rm)return '';
  let text='',current=parseInt(rm[1]);const visited=new Set();
  while(current&&!visited.has(current)){
    visited.add(current);
    if(claims[current])text+=' '+claims[current];
    const rm2=claims[current]?.match(/(?:청구항|제)\s*(\d+)\s*(?:항\s*)?에\s*있어서/);
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
    return !/청구항\s*\d+\s*에\s*있어서/.test(ct)&&!/제\s*\d+\s*항에\s*있어서/.test(ct);
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
function runValidation(){
  const all=[outputs.step_06,outputs.step_10].filter(Boolean).join('\n');
  if(!all){App.showToast('검증할 청구항이 없어요','error');return;}
  const iss=validateClaims(all);
  // v5.6: 참조번호 일관성 검증 추가
  const refIssues=validateRefNumberConsistency();
  const allIssues=[...iss,...refIssues];
  const el=document.getElementById('validationResults');
  if(!allIssues.length){el.innerHTML='<div class="issue-item issue-pass"><span class="ico" data-icon="check-circle"></span>모든 검증 통과</div>';return;}
  el.innerHTML=allIssues.map(i=>`<div class="issue-item ${i.severity==='CRITICAL'?'issue-critical':i.severity==='HIGH'?'issue-high':'issue-warning'}"><span class="status-dot ${i.severity==='CRITICAL'?'negative':i.severity==='HIGH'?'cautionary':'cautionary'}"></span> ${App.escapeHtml(i.message)}</div>`).join('');
}

// ═══ v5.6: 참조번호 일관성 검증 (명칭 불일치, 도면 미정의, 혼용) ═══
function validateRefNumberConsistency(){
  const issues=[];
  const desc=getLatestDescription()||'';
  const methodDesc=getLatestMethodDescription()||'';
  const claims=[outputs.step_06,outputs.step_10].filter(Boolean).join('\n');
  const allText=desc+'\n'+methodDesc+'\n'+claims;
  const signTable=outputs.step_18||'';

  // 1. 본문에서 "명칭(참조번호)" 수집 → 참조번호별 명칭 빈도
  const refNameMap=new Map(); // ref → Map<name, count>
  const refRe=/([가-힣a-zA-Z][가-힣a-zA-Z\s]{0,12}?)\s*\((\d{2,4}|S\d{2,4})\)/g;
  let m;while((m=refRe.exec(allText))!==null){
    const name=m[1].replace(/^상기\s*/,'').trim();
    const ref=m[2];
    if(name.length<2)continue;
    if(!refNameMap.has(ref))refNameMap.set(ref,new Map());
    const nmap=refNameMap.get(ref);
    nmap.set(name,(nmap.get(name)||0)+1);
  }

  // 2. 명칭 불일치 검출 (하나의 참조번호에 여러 명칭)
  refNameMap.forEach((nmap,ref)=>{
    if(nmap.size<=1)return;
    const entries=[...nmap.entries()].sort((a,b)=>b[1]-a[1]);
    const primary=entries[0];
    const others=entries.slice(1).filter(e=>e[1]>=3); // 3회 이상 사용된 이름만
    if(others.length>0){
      issues.push({severity:'HIGH',message:`참조번호 ${ref} 명칭 불일치: "${primary[0]}"(${primary[1]}회) vs ${others.map(e=>`"${e[0]}"(${e[1]}회)`).join(', ')} — 명칭 통일 필요`});
    }
  });

  // 3. 부호의 설명 대비 본문 참조번호 누락 검출
  const signRefs=new Set();
  const signRe=/:\s*(\d{2,4}|S\d{2,4})\s*$/gm;
  let sm;while((sm=signRe.exec(signTable))!==null)signRefs.add(sm[1]);
  const bodyRefs=new Set();
  refNameMap.forEach((_,ref)=>bodyRefs.add(ref));
  // 본문에서 사용되지만 부호의 설명에 없는 참조번호
  bodyRefs.forEach(ref=>{
    if(!signRefs.has(ref)){
      const names=refNameMap.get(ref);
      const primary=names?[...names.entries()].sort((a,b)=>b[1]-a[1])[0][0]:'?';
      issues.push({severity:'MEDIUM',message:`부호의 설명 누락: ${primary}(${ref}) — 본문에서 사용되지만 부호의 설명에 미기재`});
    }
  });

  // 4. 도면에 정의되지 않은 참조번호가 본문에 사용되는지 검출
  const diagramRefs=new Set();
  const diagramTexts=[outputs.step_07,outputs.step_11].filter(Boolean).join('\n');
  const dRefRe=/\((\d{2,4}|S\d{2,4})\)/g;
  let dm;while((dm=dRefRe.exec(diagramTexts))!==null)diagramRefs.add(dm[1]);
  if(diagramRefs.size>0){
    bodyRefs.forEach(ref=>{
      if(!diagramRefs.has(ref)&&!ref.startsWith('S')){
        const names=refNameMap.get(ref);
        const primary=names?[...names.entries()].sort((a,b)=>b[1]-a[1])[0][0]:'?';
        const count=[...names.values()].reduce((a,b)=>a+b,0);
        if(count>=3){
          issues.push({severity:'HIGH',message:`도면 미정의 참조번호: ${primary}(${ref}) — 본문에서 ${count}회 사용되지만 도면에 없음`});
        }
      }
    });
  }

  return issues;
}

// ═══════════ OUTPUT ═══════════
function updateStats(){const c=Object.keys(outputs).filter(k=>outputs[k]&&k.startsWith('step_')&&!k.includes('mermaid')&&!k.includes('applied')).length;const totalSteps=conceptDiagramTypes.length>0?21:20;document.getElementById('statCompleted').textContent=`${c}/${totalSteps}`;document.getElementById('statApiCalls').textContent=usage.calls;document.getElementById('statCost').textContent=`$${(usage.cost||0).toFixed(2)}`;}
// ═══ [T4] 사용자 도면 출력 반영 — 기존 base64(fileDataUrl) 이미지를 미리보기·Word·PPTX 에 삽입(비전 불필요) ═══
// buildUserFiguresHtml — 사용자 도면 이미지 블록 HTML(미리보기·Word 공유). fileDataUrl 있는 도면만, 도 번호 순.
//   ★ 자동 도면(mermaid)과 별개로 사용자가 올린 실제 이미지를 출력에 삽입. 텍스트 명세(buildSpecification)는 불변(.txt/clipboard 보존).
function buildUserFiguresHtml(opts){
  opts=opts||{};
  var figs=((typeof requiredFigures!=='undefined'&&requiredFigures)||[]).filter(function(f){return f&&f.fileDataUrl;}).sort(function(a,b){return a.num-b.num;});
  if(!figs.length)return '';
  var esc=(typeof App!=='undefined'&&App.escapeHtml)?App.escapeHtml:function(s){return String(s==null?'':s);};
  var blocks=figs.map(function(f){
    var cap='도 '+f.num+(f.description?' — '+esc(f.description):'');
    if(opts.word){
      return '<div style="margin:18pt 0;text-align:center;page-break-inside:avoid">'
        +'<img src="'+f.fileDataUrl+'" style="max-width:15cm;height:auto" />'
        +'<p style="font-size:11pt;margin:6pt 0 0;text-align:center;font-family:\'바탕체\',BatangChe,serif">'+cap+'</p></div>';
    }
    return '<div style="margin:14px 0;text-align:center">'
      +'<img src="'+f.fileDataUrl+'" style="max-width:100%;height:auto;border:1px solid var(--color-border,#ddd);border-radius:6px" />'
      +'<div style="font-size:12px;color:var(--color-text-secondary);margin-top:6px">'+cap+'</div></div>';
  }).join('');
  if(opts.word){
    return '<h2 style="font-size:12pt;font-weight:normal;font-family:\'바탕체\',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【도면】</h2>'+blocks;
  }
  return '<div style="margin-top:12px;border-top:1px solid var(--color-border,#eee);padding-top:12px">'
    +'<div style="font-weight:600;font-size:13px;margin-bottom:8px"><span class="ico" data-icon="image"></span> 【도면】 사용자 도면 '+figs.length+'건</div>'
    +blocks+'</div>';
}
// _appendUserFigureSlides — 사용자 도면(이미지)을 PPTX 슬라이드로 추가(addImage, base64 재사용). 도 번호 순.
function _appendUserFigureSlides(pptx){
  var figs=((typeof requiredFigures!=='undefined'&&requiredFigures)||[]).filter(function(f){return f&&f.fileDataUrl;}).sort(function(a,b){return a.num-b.num;});
  figs.forEach(function(f){
    var sl=pptx.addSlide({bkgd:'FFFFFF'});
    sl.addText('도 '+f.num,{x:0.6,y:0.4,w:7.07,h:0.4,fontSize:14,bold:true,fontFace:'바탕체',align:'center'});
    sl.addImage({data:f.fileDataUrl,x:0.6,y:1.0,w:7.07,h:8.5,sizing:{type:'contain',w:7.07,h:8.5}});
    if(f.description)sl.addText(f.description,{x:0.6,y:9.7,w:7.07,h:0.6,fontSize:10,fontFace:'바탕체',align:'center'});
  });
}

function renderPreview(){
  // ── [G4/G5] page4 진입 시 검증 게이트 갱신 + 리뷰 결과 마운트(트리거·결과 동일 위치).
  try { if (Patent._updateReviewGate) Patent._updateReviewGate(); } catch (_e) {}
  // [T8 훅 이전] 통합 리뷰 엔진 결과 표시(window.ReviewUI). __patentReviewState 없으면 no-op(기존 동작 불변).
  //   승인(Human Gate) → onChange → Patent.applyAmendments(승인분만, 3경로 정합 재검증) → recheck 재트리거.
  try {
    if (window.ReviewUI && window.__patentReviewState) {
      var _card = document.getElementById('resultCardPatentReview'); if (_card) _card.style.display = '';
      var _pm = document.getElementById('patent-review-mount');
      if (_pm) {
        // 결과는 넓은 공유 모달(2a)에 표시 — 카드에는 재오픈 버튼만(닫아도 세션 내 __patentReviewState 유지).
        var _n = ((window.__patentReviewState.issues) || []).length;
        // 검증 결과 보기 + [반영하기](승인 방향 → 상세설명 뒷받침 추가, 변리사 확정). 반영 버튼은 상시 렌더 —
        //   승인 add_spec_support 가 없으면 클릭 시 가드 토스트(applyDirectionRewrite)로 안전 처리(렌더 타이밍 의존 제거).
        _pm.innerHTML = '<button class="btn btn-outline btn-full" onclick="Patent.openReviewModal()"><span class="ico" data-icon="shield"></span> 검증 결과 보기' + (_n ? ' (' + _n + '건)' : '') + '</button>'
          + '<button class="btn btn-primary btn-full" id="btnPatentDirectionRewrite" style="margin-top:8px" onclick="Patent.startDirectionRewrite()"><span class="ico" data-icon="edit"></span> 승인 방향 반영 — 상세설명 뒷받침 추가(변리사 확정)</button>';
      }
    }
  } catch (_e) {}
  const el=document.getElementById('previewArea'),spec=buildSpecification();const _userFigs=buildUserFiguresHtml({});if(!spec.trim()){el.innerHTML='<p style="color:var(--color-text-tertiary);font-size:13px;text-align:center;padding:20px">생성된 항목이 없어요</p>'+_userFigs;return;}el.innerHTML=spec.split(/(?=【)/).map(s=>{const h=s.match(/【(.+?)】/);if(!h)return '';return `<div class="accordion-header" onclick="toggleAccordion(this)"><span>【${App.escapeHtml(h[1])}】</span><span class="arrow"><span class="ico" data-icon="chevron-down" data-size="12"></span></span></div><div class="accordion-body">${App.escapeHtml(s)}</div>`;}).join('')+_userFigs;}
// 출력 시 항목 헤더 중복 방지: 본문 첫 줄이 해당 항목 헤더(【h】, 공백 변형 포함)면 제거.
// 항목명이 정확히 일치할 때만 제거하므로 청구범위의 "【청구항 1】" 등은 보존됨.
function _stripDupHeader(body,h){
  if(!body||!h)return body;
  const esc=h.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*');
  return body.replace(new RegExp('^\\s*【\\s*'+esc+'\\s*】[ \\t]*\\r?\\n?'),'');
}
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
  return['【발명의 설명】',`【발명의 명칭】\n${titleLine}`,`【기술분야】\n${_stripDupHeader(outputs.step_02||'','기술분야')}`,`【발명의 배경이 되는 기술】\n${_stripDupHeader(outputs.step_03||'','발명의 배경이 되는 기술')}`,`【선행기술문헌】\n${_stripDupHeader(outputs.step_04||'','선행기술문헌')}`,'【발명의 내용】',`【해결하고자 하는 과제】\n${_stripDupHeader(outputs.step_05||'','해결하고자 하는 과제')}`,`【과제의 해결 수단】\n${_stripDupHeader(outputs.step_17||'','과제의 해결 수단')}`,`【발명의 효과】\n${_stripDupHeader(outputs.step_16||'','발명의 효과')}`,`【도면의 간단한 설명】\n${brief||''}`,`【발명을 실시하기 위한 구체적인 내용】\n${desc}${getLatestMethodDescription()?'\n\n'+getLatestMethodDescription():''}`,`【부호의 설명】\n${_stripDupHeader(outputs.step_18||'','부호의 설명')}`,`【청구범위】\n${allClaims}`,`【요약서】\n${_stripDupHeader(outputs.step_19||'','요약서')}`].filter(Boolean).join('\n\n')+extras;
}
function copyToClipboard(){const t=buildSpecification();if(!t.trim()){App.showToast('내용 없음','error');return;}navigator.clipboard.writeText(t).then(()=>App.showToast('복사 완료')).catch(()=>App.showToast('클립보드 접근 불가','error'));}
function downloadAsTxt(){const t=buildSpecification();if(!t.trim()){App.showToast('내용 없음','error');return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

function downloadAsWord(){
  const desc=getFullDescription(),brief=extractBriefDescriptions(outputs.step_07||'',outputs.step_11||'');
  // v4.9: Include English title
  const titleLine=selectedTitleEn?`${selectedTitle}{${selectedTitleEn}}`:selectedTitle;
  const allClaims=[outputs.step_06,outputs.step_10,outputs.step_20].filter(Boolean).join('\n\n');
  const secs=[{h:'발명의 설명'},{h:'발명의 명칭',b:titleLine},{h:'기술분야',b:outputs.step_02},{h:'발명의 배경이 되는 기술',b:outputs.step_03},{h:'선행기술문헌',b:outputs.step_04},{h:'발명의 내용'},{h:'해결하고자 하는 과제',b:outputs.step_05},{h:'과제의 해결 수단',b:outputs.step_17},{h:'발명의 효과',b:outputs.step_16},{h:'도면의 간단한 설명',b:brief},{h:'발명을 실시하기 위한 구체적인 내용',b:[desc,getLatestMethodDescription()].filter(Boolean).join('\n\n')},{h:'부호의 설명',b:outputs.step_18},{h:'청구범위',b:allClaims},{h:'요약서',b:outputs.step_19}];
  const html=secs.map(s=>{const hd=`<h2 style="font-size:12pt;font-weight:normal;font-family:'바탕체',BatangChe,serif;margin-top:18pt;margin-bottom:6pt;text-align:justify">【${App.escapeHtml(s.h)}】</h2>`;const body=_stripDupHeader(s.b,s.h);if(!body)return hd;return hd+body.split('\n').filter(l=>l.trim()).map(l=>{const hl=/【수학식\s*\d+】/.test(l)||/__+/.test(l)?'background-color:#FFFF00;':'';return `<p style="text-indent:40pt;margin:0;line-height:200%;font-size:12pt;font-family:'바탕체',BatangChe,serif;text-align:justify;${hl}">${App.escapeHtml(l.trim())}</p>`;}).join('');}).join('');
  const userFigHtml=buildUserFiguresHtml({word:true}); // ★ T4: 사용자 도면 이미지(base64) 삽입 — 도 번호 순
  const full=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.5cm}body{font-family:'바탕체',BatangChe,serif;font-size:12pt;line-height:200%;text-align:justify}</style></head><body>${html}${userFigHtml}</body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+full],{type:'application/msword'}));a.download=`특허명세서_${selectedTitle||'초안'}_${new Date().toISOString().slice(0,10)}.doc`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);App.showToast('Word 다운로드 완료');
}


// ★ KIPRIS 키 설정은 common.js saveProfileSettings()에서 통합 관리 (v5.4)


// ═══════════════════════════════════════════════════════════════════
// [T8] WriterModule 연동 — 통합 리뷰 엔진(review-engine)과의 계약 2함수 (opinion T6와 동형).
//   기존 작성·자기검토 로직은 일절 변경하지 않는다(추가만). simulate/rollback은 patent.js에 안 넣음(옵션 B).
//   ★ patent 특수: applyAmendments 반영 후 3경로(SVG/PPTX/Canvas) 렌더 정합 재검증(E-11) — 공유 소스인
//     도면(mermaid) 부호 ↔ 부호의 설명(step_18) 교차 정합. 불일치 시 커밋하지 않고 롤백 + 렌더회귀 반환.
// ═══════════════════════════════════════════════════════════════════
window.Patent = window.Patent || {};

// ═══ [P5] 예시도 비전 정련 루프 — 생성 SVG → PNG → callVision 비평 → 배치/선 개선 SVG(선 겹침 해소) ═══
//   ★ 내용(청구 구성 P1·부호 이름 P2·번호 P3) 불변, "배치/선"만 개선. SVG-direct 유지(포맷 불변).
//   ⚠️ App.callVision(T1) 의존 — 미탑재/실패/번호누락 시 원본 유지(생성만, 정련 skip).
// _conceptSvgToPng — SVG 문자열 → PNG dataURL(브라우저 Image+canvas). 비전 입력용(downloadConceptPptx 변환 재사용·신규 비용 0).
Patent._conceptSvgToPng = function(svgStr){
  return new Promise(function(resolve,reject){
    try{
      var blob=new Blob([String(svgStr||'')],{type:'image/svg+xml;charset=utf-8'});
      var url=URL.createObjectURL(blob);
      var img=new Image();
      img.onload=function(){
        try{
          var canvas=document.createElement('canvas');canvas.width=1360;canvas.height=1000;
          var cx=canvas.getContext('2d');cx.fillStyle='#FFFFFF';cx.fillRect(0,0,1360,1000);cx.drawImage(img,0,0,1360,1000);
          var dataUrl=canvas.toDataURL('image/png');URL.revokeObjectURL(url);resolve(dataUrl);
        }catch(e){URL.revokeObjectURL(url);reject(e);}
      };
      img.onerror=function(e){URL.revokeObjectURL(url);reject(e||new Error('svg img load fail'));};
      img.src=url;
    }catch(e){reject(e);}
  });
};
// _buildConceptRefinePrompt — 선 겹침·교차 집중 비평 + 배치 개선 지시(★ 내용 불변).
Patent._buildConceptRefinePrompt = function(svgStr){
  return '아래 이미지는 특허 예시도(SVG를 렌더한 것)이고, 그 SVG 코드도 함께 준다. ★ 내용은 그대로 두고 "배치/선"만 개선한 SVG를 출력하라.\n\n'
    + '[집중 점검 — 시각 결함]\n'
    + '1. ★ 부호 리더선(숫자를 가리키는 얇은 선)이 다른 박스·텍스트·요소와 겹치거나 교차하는가? → 리더선 경로를 우회시켜 겹침/교차를 제거하라.\n'
    + '2. 연결선(점선/실선/화살표)이 다른 요소를 관통하거나 겹치는가? → 경로를 조정하라.\n'
    + '3. 요소·텍스트가 서로 겹치거나 간격이 너무 좁은가? → 간격을 확보하고 정렬하라.\n'
    + '4. 비율 왜곡·viewBox 밖 이탈이 있는가? → 안으로 들여라.\n\n'
    + '[★ 불변 — 반드시 유지]\n'
    + '- 모든 참조번호(숫자)와 그것이 가리키는 요소를 그대로 유지하라(번호·요소 삭제/변경/추가 금지).\n'
    + '- 도면이 담은 청구 구성·요소 구성을 그대로 유지하라(내용 변경 금지 — 배치/선만 개선).\n'
    + '- viewBox·흑백(stroke #000)·폰트 등 기존 SVG 기술 규칙을 유지하라.\n\n'
    + '[현재 SVG]\n'+String(svgStr||'')+'\n\n'
    + '출력: 개선된 SVG 코드만(<svg ...>...</svg>). 설명·코드펜스 없이 SVG 하나만.';
};
// refineConceptDiagram — 단일 예시도 정련(1~2회). ★ 내용 보존 가드: 원본 참조번호 전부 유지돼야 채택.
Patent.refineConceptDiagram = async function(ct, opts){
  opts=opts||{};
  if(!ct||!ct.svgContent) return {refined:false, reason:'no_svg'};
  if(!(typeof App!=='undefined'&&App&&typeof App.callVision==='function')) return {refined:false, reason:'no_vision'};  // ★ 가드: 생성만(정련 skip)
  var origNums=(Array.isArray(ct.refMap)&&ct.refMap.length)?ct.refMap.map(function(r){return String(r.signNumber);}):[...String(ct.svgContent).matchAll(/\((\d{2,3})\)/g)].map(function(x){return x[1];});
  var maxRounds=Math.min(Math.max(parseInt(opts.maxRounds||1)||1,1),2);  // ★ 1~2회(루프·비용 가드)
  var current=ct.svgContent, changed=false, lastReason='no_change';
  for(var round=0; round<maxRounds; round++){
    var png=null;
    try{ png=await Patent._conceptSvgToPng(current); }catch(_e){ png=null; }
    if(!png){ lastReason='png_fail'; break; }                  // PNG 변환 실패 → 원본 유지
    var r=null;
    try{ r=await App.callVision(Patent._buildConceptRefinePrompt(current),[png],8192); }catch(_e){ r=null; }
    var m=r&&r.text&&String(r.text).match(/<svg[\s\S]*?<\/svg>/i);
    if(!m){ lastReason='vision_fail'; break; }                 // 비전 실패 → 원본 유지
    var fixed=m[0];
    var fixedNums=[...String(fixed).matchAll(/\((\d{2,3})\)/g)].map(function(x){return x[1];});
    if(!origNums.every(function(n){return fixedNums.indexOf(n)>=0;})){ lastReason='num_lost'; break; }  // ★ 번호 누락 → 거부, 원본 유지
    current=fixed; changed=true;
  }
  if(changed){ ct.svgContent=current; ct.refinedAt=new Date().toISOString(); }
  return {refined:changed, reason: changed?'ok':lastReason};
};
// refineConceptDiagramByNum — 카드 [정련] 버튼 핸들러. 정련 후 재렌더 + 영속.
Patent.refineConceptDiagramByNum = async function(figNum){
  var cFigNums=(typeof getAutoFigNums==='function')?getAutoFigNums('step_07c'):[];
  var idx=cFigNums.indexOf(parseInt(figNum));
  var ct=(idx>=0)?conceptDiagramTypes[idx]:(conceptDiagramTypes||[]).find(function(c){return String(c.figNum)===String(figNum);});
  if(!ct||!ct.svgContent){ try{App.showToast('정련할 예시도를 찾을 수 없습니다','error');}catch(_e){} return; }
  if(!(App&&typeof App.callVision==='function')){ try{App.showToast('비전 정련 기능이 로드되지 않았습니다(생성본 유지)','info');}catch(_e){} return; }
  try{App.showToast('도 '+figNum+' 비전 정련 중...','info');}catch(_e){}
  try{
    var res=await Patent.refineConceptDiagram(ct,{maxRounds:1});
    if(res.refined){ try{renderConceptDiagramCards();}catch(_e){} try{saveProject(true);}catch(_e){} try{App.showToast('도 '+figNum+' 정련 완료(선 겹침/배치 개선)','success');}catch(_e){} }
    else { try{App.showToast('도 '+figNum+' 정련 미적용('+(res.reason==='num_lost'?'번호 보존 실패':res.reason==='vision_fail'?'비전 응답 없음':res.reason)+') — 원본 유지','info');}catch(_e){} }
  }catch(e){ try{App.showToast('정련 실패: '+((e&&e.message)||e),'error');}catch(_e){} }
};
// refineAllConceptDiagrams — 생성된 예시도 일괄 정련(순차).
Patent.refineAllConceptDiagrams = async function(opts){
  opts=opts||{};
  var list=((typeof conceptDiagramTypes!=='undefined'&&conceptDiagramTypes)||[]).filter(function(c){return c&&c.svgContent;});
  var done=0;
  for(var i=0;i<list.length;i++){ try{ var res=await Patent.refineConceptDiagram(list[i],{maxRounds:opts.maxRounds||1}); if(res.refined)done++; }catch(_e){} }
  if(done){ try{renderConceptDiagramCards();}catch(_e){} try{saveProject(true);}catch(_e){} }
  return done;
};

// ═══ [T2] 사용자 도면 비전 분석 — callVision(T1)으로 도면의 구성요소·부호·구조·텍스트 추출 ═══
//   ★ 정합 방향(변리사 확정): 사용자 도면이 ★기준(필수)★. 도면의 라벨·부호를 그대로 보존 추출(우리 명세서 용어로 바꾸지 않음).
//     T3 정합이 이 추출물을 우리 명세서(부호의 설명 step_18·상세설명 step_08)와 비교해 "우리 설명을 도면에 맞춘다".
//   ⚠️ App.callVision(공통 T1)에 의존 — 미탑재 시 안내 토스트로 안전 처리.
// _buildFigureAnalysisPrompt — 추출 프롬프트(사용자 도면 기준, 할루시네이션 금지, 순수 JSON).
Patent._buildFigureAnalysisPrompt = function(figData){
  var d=(figData&&figData.description)||'';
  return '당신은 특허 도면 분석 전문가입니다. 아래 [사용자 도면]은 출원인이 확정한 ★기준 도면★입니다. '
    + '도면에 그려진 그대로(라벨·부호를 변형하지 말고 도면 표기 그대로) 추출하세요.\n'
    + (d?('[출원인이 적은 도면 설명(참고)] '+d+'\n'):'')
    + '\n추출 항목(JSON):\n'
    + '1. elements: 도면에 그려진 각 구성요소 배열 — { "label": 도면 표기 명칭 그대로, "signNumber": 도면에 표기된 부호/번호(없으면 null), "description": 역할 추정(간결) }\n'
    + '2. structure: 요소 간 관계 배열 — { "from": 출발 요소(label 또는 signNumber), "to": 도착 요소, "relation": 연결/포함/입력/출력 등 }\n'
    + '3. rawText: 도면 안에 적힌 모든 텍스트(원문 그대로, 문자열)\n'
    + '4. summary: 도면 한 줄 개요(문자열)\n'
    + '\n★ 규칙:\n'
    + '- ★ 도면에 보이는 라벨·부호를 그대로 보존하라. 우리 명세서 용어로 바꾸지 마라(사용자 도면이 기준).\n'
    + '- ★ 도면에 없는 요소를 추측해 만들지 마라(할루시네이션 금지). 부호가 안 보이면 signNumber 는 null.\n'
    + '- 순수 JSON 객체만 출력(설명·인사·코드펜스 금지). { "elements":[...], "structure":[...], "rawText":"...", "summary":"..." }';
};
// analyzeUserFigure — 단일 도면 분석(callVision). 결과를 figData.analysis 에 저장. 재분석 회피(opts.force 로 강제).
Patent.analyzeUserFigure = async function(figData, opts){
  opts=opts||{};
  if(!figData||!figData.fileDataUrl){ try{App.showToast('이미지 파일이 있는 도면만 분석할 수 있습니다','info');}catch(_e){} return null; }
  if(figData.analysis && !opts.force) return figData.analysis;          // ★ 재분석 회피(저장된 결과 재사용)
  if(!(typeof App!=='undefined'&&App&&typeof App.callVision==='function')){ try{App.showToast('비전 분석 기능이 로드되지 않았습니다(새로고침 후 재시도)','error');}catch(_e){} return null; }
  var prompt=Patent._buildFigureAnalysisPrompt(figData);
  var r=await App.callVision(prompt,[figData.fileDataUrl],4096);
  var j=(typeof _parseJSONSafe==='function')?_parseJSONSafe((r&&r.text)||''):null;
  if(!j){ try{App.showToast('도 '+figData.num+' 분석 결과 파싱 실패 — 재시도하세요','error');}catch(_e){} return null; }
  // 정규화(★ 사용자 도면 라벨·부호 보존) — T3 정합 입력 형식.
  figData.analysis={
    elements: Array.isArray(j.elements)?j.elements.map(function(e){return {label:String((e&&e.label)||''),signNumber:(e&&e.signNumber!=null&&e.signNumber!=='')?String(e.signNumber):null,description:String((e&&e.description)||'')};}).filter(function(e){return e.label||e.signNumber;}):[],
    structure: Array.isArray(j.structure)?j.structure.map(function(s){return {from:String((s&&s.from)||''),to:String((s&&s.to)||''),relation:String((s&&s.relation)||'')};}):[],
    rawText: String(j.rawText||''),
    summary: String(j.summary||''),
    analyzedAt: new Date().toISOString()
  };
  return figData.analysis;
};
// analyzeUserFigureByNum — 카드 [분석] 버튼 핸들러. 분석 후 재렌더 + 영속.
Patent.analyzeUserFigureByNum = async function(num, force){
  var f=((typeof requiredFigures!=='undefined'&&requiredFigures)||[]).find(function(x){return x.num===num;});
  if(!f){ try{App.showToast('도 '+num+' 도면을 찾을 수 없습니다','error');}catch(_e){} return; }
  try{App.showToast('도 '+num+' 분석 중...','info');}catch(_e){}
  try{
    var a=await Patent.analyzeUserFigure(f,{force:!!force});
    if(a){ try{if(typeof renderRequiredFiguresList==='function')renderRequiredFiguresList();}catch(_e){} try{if(typeof saveProject==='function')saveProject(true);}catch(_e){} try{App.showToast('도 '+num+' 분석 완료('+(a.elements||[]).length+'요소)','success');}catch(_e){} }
  }catch(e){ try{App.showToast('분석 실패: '+((e&&e.message)||e),'error');}catch(_e){} }
};
// analyzeAllUserFigures — 미분석 도면 일괄 분석(명세서 생성 전 등 일괄 트리거용). 순차 실행(레이트리밋 회피).
Patent.analyzeAllUserFigures = async function(opts){
  opts=opts||{};
  var figs=((typeof requiredFigures!=='undefined'&&requiredFigures)||[]).filter(function(f){return f&&f.fileDataUrl&&(opts.force||!f.analysis);});
  var done=0;
  for(var i=0;i<figs.length;i++){ try{ var a=await Patent.analyzeUserFigure(figs[i],{force:!!opts.force}); if(a)done++; }catch(_e){} }
  if(done){ try{if(typeof renderRequiredFiguresList==='function')renderRequiredFiguresList();}catch(_e){} try{if(typeof saveProject==='function')saveProject(true);}catch(_e){} }
  return done;
};

// exportSnapshot — 원본(전역 상태) 변형 없이 깊은 복사본 반환(I-1, 읽기전용).
//   반환 형상은 profiles/patent/adapter.js: adaptSnapshot 입력과 정합.
Patent.exportSnapshot = function() {
  var projection = {
    caseId: (typeof currentProjectId !== 'undefined' && currentProjectId) || '',
    reviewId: (typeof currentProjectId !== 'undefined' && currentProjectId) ? ('rev_pat_' + currentProjectId) : undefined,
    outputs: (typeof outputs !== 'undefined' && outputs) || {},
    scopeCheckResults: (typeof scopeCheckResults !== 'undefined' && scopeCheckResults) || {},
    inventionScope: (typeof inventionScope !== 'undefined' && inventionScope) || null,
    deviceAnchorStart: (typeof deviceAnchorStart !== 'undefined') ? deviceAnchorStart : 0,
    methodAnchorStart: (typeof methodAnchorStart !== 'undefined') ? methodAnchorStart : 0
  };
  try { return structuredClone(projection); }
  catch (e) { return JSON.parse(JSON.stringify(projection)); }
};

// ═══════════ [P-T2] 출원 전 검증 트리거(클라) — G1·G3·G4 ═══════════
// 작성·자기검토 로직은 불변. 아래는 "검증 배선"만 추가한다.

// _reviewGate — 검증 발화 가능 게이트(G4). 필수 4종(청구항·상세설명·부호·도면)이 갖춰졌는가.
//   각 범주는 장치(device) 또는 방법(method) 변형 중 하나만 있어도 충족. 자기검토/범위는 선택.
//   반환 { ok, missing:[라벨...] }. outputs 키 판정은 updateStats 와 동일 규약.
Patent._reviewGate = function() {
  var o = (typeof outputs !== 'undefined' && outputs) || {};
  var has = function(k){ return !!(o[k] && String(o[k]).trim()); };
  var checks = [
    { ok: has('step_06') || has('step_10'), label: '청구항(장치 또는 방법)' },
    { ok: has('step_08') || has('step_12'), label: '상세설명(장치 또는 방법)' },
    { ok: has('step_18'), label: '부호의 설명' },
    { ok: has('step_07_mermaid') || has('step_11_mermaid'), label: '도면' },
  ];
  var missing = checks.filter(function(c){ return !c.ok; }).map(function(c){ return c.label; });
  return { ok: missing.length === 0, missing: missing };
};

// _reviewCostEstimate — 예상 비용·시간(G3). capUsd/maxRounds 는 프로필에서 읽음(하드코딩 0).
//   ReviewUI.policy('patent') 미가용(토글 OFF·브리지 미로드) 시 보수적 폴백.
Patent._reviewCostEstimate = function() {
  var pol = null;
  try { if (window.ReviewUI && typeof window.ReviewUI.policy === 'function') pol = window.ReviewUI.policy('patent'); } catch (_e) {}
  var cap = (pol && pol.capUsd) || 15;
  var rounds = (pol && pol.maxRounds) || 12;
  var minutes = Math.max(1, Math.ceil(rounds * 0.7)); // 라운드당 ~0.7분 추정
  var spent = 0; try { spent = (typeof usage !== 'undefined' && usage && usage.cost) || 0; } catch (_e) {}
  return { capUsd: cap, maxRounds: rounds, minutes: minutes, spent: spent };
};

// _confirmReviewCost — 비용·시간 사전고지 + 명시적 진행 동의(G3, 오발화 방지).
//   ★ 함수로 분리 → 테스트에서 override 가능(confirm=false 시 runner 미발화 검증).
Patent._confirmReviewCost = function(est) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
  var msg = '출원 전 AI 검증을 시작합니다.\n\n'
    + '· 예상 최대 비용: 약 $' + est.capUsd + (est.spent ? ' (현재 누적 $' + est.spent.toFixed(2) + ')' : '') + '\n'
    + '· 예상 소요: 최대 약 ' + est.minutes + '분 (최대 ' + est.maxRounds + '라운드)\n\n'
    + '진행하시겠습니까?';
  return window.confirm(msg);
};

// _updateReviewGate — page4 검증 버튼 활성/비활성 + 안내(G4). renderPreview 에서 호출.
Patent._updateReviewGate = function() {
  var btn = document.getElementById('btnPatentReview');
  var msgEl = document.getElementById('patentReviewGateMsg');
  if (!btn) return;
  var enabledModule = false;
  try { enabledModule = !!(window.ReviewUI && window.ReviewUI.isEnabled && window.ReviewUI.isEnabled('patent')); } catch (_e) {}
  var gate = Patent._reviewGate();
  // 토글 OFF: 버튼은 두되 눌러도 무동작(E-21). 게이트 미충족: 비활성 + 안내.
  if (!gate.ok) {
    btn.disabled = true;
    if (msgEl) msgEl.textContent = '먼저 ' + gate.missing.join(', ') + '을(를) 완료하세요.';
  } else {
    btn.disabled = false;
    if (msgEl) msgEl.textContent = enabledModule ? '' : '';
  }
};

// runReviewEngine — [G1] 검증 트리거. 토글 게이트(E-21) → 필수4종 게이트(G4) →
//   비용확인(G3, 명시 동의) → exportSnapshot → runner(edge/test) → __patentReviewState → renderPreview 마운트.
//   흐름 어느 단계든 실패/거부 시 runner 미발화(부작용 0).
Patent.runReviewEngine = async function(runner, opts) {
  opts = opts || {};
  // (1) 토글 OFF(마스터 또는 patent 모듈) → 무동작(E-21).
  if (!(typeof window !== 'undefined' && window.ReviewUI && typeof window.ReviewUI.isEnabled === 'function' && window.ReviewUI.isEnabled('patent'))) {
    return null;
  }
  // (2) 필수 4종 게이트(G4).
  var gate = Patent._reviewGate();
  if (!gate.ok) {
    try { App.showToast('먼저 ' + gate.missing.join(', ') + '을(를) 완료하세요', 'info'); } catch (_e) {}
    return null;
  }
  // (3) 비용·시간 확인 — 사용자가 명시적으로 진행을 눌러야만 발화(G3, 오발화 방지).
  //   ★ recheck 재트리거(opts.recheck)는 이미 동의한 세션의 후속이므로 재확인 생략.
  if (!opts.recheck && !Patent._confirmReviewCost(Patent._reviewCostEstimate())) return null;

  var run = runner || Patent._reviewRunner || Patent._defaultReviewRunner;
  if (typeof run !== 'function') return null;
  Patent._reviewRunner = run; // recheck 재트리거용 보존
  var snapshot = Patent.exportSnapshot();
  try { setButtonLoading && setButtonLoading('btnPatentReview', true); } catch (_e) {}
  var result = null;
  try { result = await run(snapshot); }
  finally { try { setButtonLoading && setButtonLoading('btnPatentReview', false); } catch (_e) {} }
  if (!result) return null;
  window.__patentReviewState = result; // page4 마운트 발화 조건
  Patent._reflectHintShown = false;    // ★ 새 검증마다 승인→반영 흐름 안내 1회 재발화(onChange)
  try { if (typeof renderPreview === 'function') renderPreview(); } catch (_e) {} // best-effort 렌더
  try { Patent.openReviewModal(); } catch (_e) {} // 검증 완료 → 넓은 공유 모달 자동 오픈(2a)
  return result;
};

// 결과 모달 옵션·오픈(actor + 승인→applyAmendments+영속, 재검증은 명시적 버튼). 자동오픈·재오픈 공유.
Patent._reviewModalOpts = function() {
  return {
    actor: (App.currentUser && App.currentUser.email) || '',
    // ★ AC-T1(opinion.js:884 동일): 승인 시 자동 runReviewEngine(recheck) 제거 — 승인 1건마다 재검증(running) 트리거하던 버그.
    //   승인은 누적 반영(applyAmendments, 인메모리 방향 기록)+결정 영속만. 재검증은 '출원 전 검증 시작' 버튼으로 변리사가 명시적 1회.
    //   → 5건 승인 누적 → 버튼 1회 → 누적분 일괄 재검증. 신규 UI 0. ⛔ onChange 에서 풀 재검증 트리거 금지.
    onChange: function(rs){
      var acc = (rs.patchPlans || []).filter(function(pp){ return pp.accepted === true; });
      if (acc.length) { try { Patent.applyAmendments(acc); } catch (_e) {} }   // 승인분(누적) 인메모리 방향 기록(유지)
      try { Patent._persistReviewDecision(rs); } catch (_e) {}                  // 결정 빠른 영속(유지)
      try { if (typeof renderPreview === 'function') renderPreview(); } catch (_e) {} // 승인 반영 클라 재렌더(edge 재검증 아님)
      // ★ 승인→반영 흐름 안내(1회) — 승인 모달과 [반영하기]가 다른 위치(모달 vs 산출물 탭)라 길잃음 방지.
      try {
        if (!Patent._reflectHintShown && Patent._collectApprovedSpecOps().length) {
          Patent._reflectHintShown = true;
          App.showToast('승인 완료 — 이 창을 닫고 [산출물] 탭의 [승인 방향 반영]을 눌러 명세서에 반영하세요', 'info');
        }
      } catch (_e) {}
    }
  };
};
Patent.openReviewModal = function() {
  try { if (window.ReviewUI && window.ReviewUI.openModal && window.__patentReviewState) window.ReviewUI.openModal(window.__patentReviewState, Patent._reviewModalOpts()); } catch (_e) {}
};

// _defaultReviewRunner — prod 기본 runner: Supabase Edge(review-orchestrate) 호출.
//   module:'patent' 전송(G9 edge 가 PROFILES['patent'] 선택). 클라는 트리거·구독만(spec §14).
//   ★ T1(504 해소): opinion.js:917-937 비동기 패턴 이식 — review_runs INSERT → reviewRunId 동봉 →
//     Edge dual-mode(202 비동기) → 폴링. reviewRunId 없으면(테이블/RLS 불가) 기존 동기 폴백(후방호환).
//     동기 12라운드로 게이트웨이(~150s) 504 나던 것을 비동기+폴링으로 해소(+PatentProfile maxRounds 2 로 완주).
Patent._defaultReviewRunner = async function(snapshot) {
  // 사용자 LLM 키·역할배정 동봉(L-T3) — getReviewAuth 가 "1키 전역" 규칙 적용한 keys/assignments 산출.
  //   ★ keys 는 HTTPS body 로 자기 Edge 에만 전달, 절대 로깅 금지(키 노출 방지).
  var auth = (App.getReviewAuth && App.getReviewAuth()) || { keys: {}, assignments: {} };
  // 1) review_runs INSERT(RLS own) → reviewRunId. 실패 시 null → 동기 폴백.
  var reviewRunId = null;
  try {
    var pid = (typeof currentProjectId !== 'undefined' && currentProjectId) || (snapshot && snapshot.caseId) || '';
    var uid = (App.currentUser && App.currentUser.id) || null;
    var ins = await App.sb.from('review_runs').insert({ user_id: uid, project_id: String(pid), module: 'patent', status: 'running' }).select('id').single();
    reviewRunId = ins && ins.data && ins.data.id;
    Patent._reviewRunId = reviewRunId; // 승인/거부 결정 빠른 영속용(_persistReviewDecision)
  } catch (_e) {}
  // 2) invoke — reviewRunId 동봉 시 Edge 가 202(비동기) 반환. 미동봉/구 Edge 면 동기 결과.
  var res = await App.sb.functions.invoke('review-orchestrate', { body: { snapshot: snapshot, caseId: snapshot && snapshot.caseId, module: 'patent', keys: auth.keys, assignments: auth.assignments, reviewRunId: reviewRunId || undefined } });
  var d = res && res.data;
  if (!reviewRunId) return d || null;                 // 동기 폴백(테이블 없음 등)
  if (d && d.status !== 'running') return d;          // 구 Edge 가 동기로 결과를 준 경우
  // 3) 폴링 — 모달에 "검증 중…" 표시 → done이면 result, failed/타임아웃이면 null.
  try { if (window.ReviewUI && window.ReviewUI.openModalMessage) window.ReviewUI.openModalMessage('검증 중… 잠시만 기다려 주세요'); } catch (_e) {}
  return await Patent._pollReviewRun(reviewRunId);
};

// _pollReviewRun — review_runs 폴링(opinion.js:942 이식, 모듈 무관). done→result, failed→null,
//   ★ 180s 'running' 고착 → 강제 종료(failed) — worker(백그라운드) 사망 방어.
Patent._pollReviewRun = function(reviewRunId) {
  return new Promise(function(resolve) {
    if (!(window.ReviewUI && window.ReviewUI.subscribePolling)) { resolve(null); return; }
    var done = false, sub = null;
    function finish(result, msg) {
      if (done) return; done = true;
      try { if (sub && sub.stop) sub.stop(); } catch (_e) {}
      if (msg) { try { window.ReviewUI.openModalMessage(msg); } catch (_e) {} }
      resolve(result);
    }
    var killer = setTimeout(function(){
      // worker 사망 추정 → 이 run 을 DB 에서도 failed 로 즉시 정리(본인 행·running 만, RLS). 실패해도 무해(pg_cron 백업).
      try {
        App.sb.from('review_runs')
          .update({ status: 'failed', error: 'wall-clock timeout (client killer — worker 사망 추정)' })
          .eq('id', reviewRunId).eq('status', 'running');
      } catch (_e) {}
      finish(null, '검증 시간 초과 — 다시 시도해 주세요');
    }, 300000); // worker 사망 방어 — patent 명세서 입력이 커 완주가 길 수 있어 180→300s (Pro 백그라운드 여유)
    // ★ 완료 인식: status==='done' 외에 "결과(result) 존재" 또는 "종결 phase(converged/escalated/finalized)" 도 완주로 본다.
    //   escalated 는 정상 완료(자동통과 금지지 실패 아님) — opinion 처럼 완주 처리. 일부 Edge 빌드가 status 대신
    //   phase/result 만 갱신해도 결과를 놓치지 않게 한다("결과 왔는데 시간 초과" 오표시 차단).
    var TERMINAL = { converged: 1, escalated: 1, finalized: 1 };
    function _isComplete(s) { return !!(s && (s.status === 'done' || s.result || (s.phase && TERMINAL[s.phase]))); }
    sub = window.ReviewUI.subscribePolling({
      intervalMs: 2000,
      fetchState: async function() {
        var r = await App.sb.from('review_runs').select('status,phase,result,error').eq('id', reviewRunId).single();
        return (r && r.data) || {};
      },
      isDone: function(s) { return _isComplete(s) || !!(s && s.status === 'failed'); },
      onTick: function(s) {
        if (done) return;
        if (_isComplete(s)) { clearTimeout(killer); finish(s.result || null); return; }   // ★ 결과/종결 phase(escalated 포함) → 완주
        if (s && s.status === 'failed') { clearTimeout(killer); finish(null, '검증 실패: ' + ((s && s.error) || '알 수 없는 오류')); return; }
        try { if (window.ReviewUI.openModalMessage) window.ReviewUI.openModalMessage('검증 중… (' + ((s && s.status) || 'running') + ')'); } catch (_e) {}
      },
    });
  });
};

// _persistReviewDecision — 승인/거부 결정 빠른 영속(opinion.js:895 이식): review_runs.result 의 patchPlans 상태만 UPDATE.
//   reviewRunId 없으면(동기 폴백 등) 영속 생략. best-effort(블로킹 0).
Patent._persistReviewDecision = function(reviewState) {
  var runId = Patent._reviewRunId;
  if (!runId || !reviewState) return;
  try { App.sb.from('review_runs').update({ result: reviewState, updated_at: new Date().toISOString() }).eq('id', runId); } catch (_e) {}
};

// _reviewRenderCheck — 3경로(SVG/PPTX/Canvas) 정합 구조검사(E-11).
//   3경로는 공유 소스(mermaid)에서 _sharedExtractRefNum 로 파생되므로, 도면 부호 ⊆ 부호의 설명(step_18)을
//   검사하면 3경로 정합의 구조 대리검증이 된다. 반환 {svg,pptx,canvas, missing}.
Patent._reviewRenderCheck = function(o) {
  o = o || ((typeof outputs !== 'undefined' && outputs) || {});
  function refsOf(text) {
    var set = {}; var s = String(text || ''); var m;
    var p1 = /\((\d{2,4})\)/g, p2 = /(?:^|\n)\s*(\d{2,4})\s*[:：]/g;
    while ((m = p1.exec(s)) !== null) set[m[1]] = true;
    while ((m = p2.exec(s)) !== null) set[m[1]] = true;
    return set;
  }
  var diagram = Object.assign({}, refsOf(o.step_07_mermaid), refsOf(o.step_11_mermaid));
  var signs = refsOf(o.step_18);
  var missing = Object.keys(diagram).filter(function(r){ return !signs[r]; });
  var ok = missing.length === 0;
  return { svg: ok, pptx: ok, canvas: ok, missing: missing };
};

// _reviewDeltaGate — ★ delta E-11 게이트(절대 상태 아님). 보정 전(beforeO)·후(afterO)의 도면↔부호 정합을 비교해
//   "이 보정이 새로 유발한 부호 불일치(newMissing)"만 차단 사유로 본다. 기존 불일치(preexistingMissing)는 비차단(경고).
//   ★ add_spec_support 는 상세설명(step_08)에만 APPEND → 도면(step_07/11_mermaid)·부호의 설명(step_18) 불변
//     → before==after → newMissing 0 → canConfirm=true. 명세서에 원래 있던 무관한 불일치에 무해한 보정이 볼모로 잡히지 않음.
//   ★ 미래에 도면/청구항을 바꾸는 op 가 정합을 깨면 newMissing 발생 → canConfirm=false(regression 차단 의미 보존).
Patent._reviewDeltaGate = function(beforeO, afterO) {
  var before = (Patent._reviewRenderCheck(beforeO || {}).missing) || [];
  var after = (Patent._reviewRenderCheck(afterO || {}).missing) || [];
  var newMissing = after.filter(function(r){ return before.indexOf(r) < 0; });   // 보정이 "새로" 만든 누락만
  return { canConfirm: newMissing.length === 0, newMissing: newMissing, preexistingMissing: before };
};

// applyAmendments — 사람 승인 PatchPlan만 실(實)반영(구조적) + 3경로 렌더 정합 재검증(E-11).
//   ★ I-2/E-19: accepted !== true 가 하나라도 있으면 throw(미승인 미반영).
//   ★ 산문(청구항/상세설명) 텍스트는 재작성하지 않는다(op.content=보정 "방향"). 승인 방향을 구조적으로 기록.
//   ★ E-11: 3경로 정합 불일치 시 커밋하지 않고 롤백 + 렌더회귀 issue 반환.
//   ★ 원자성: 커밋-앳-엔드. 예외/롤백 시 전역 상태 불변.
Patent.applyAmendments = function(acceptedPlans) {
  if (!Array.isArray(acceptedPlans)) throw new Error('applyAmendments: plans 배열 필요');
  acceptedPlans.forEach(function(pl) {
    if (!pl || pl.accepted !== true) {
      throw new Error('applyAmendments: 미승인 plan 반영 불가 (I-2/E-19) — ' + (pl && pl.id));
    }
  });

  // 승인 방향을 구조적으로 기록(작업 로그 — 산문 미수정).
  var log = [];
  acceptedPlans.forEach(function(pl) {
    (pl.ops || []).forEach(function(op) {
      log.push({ op: op.op, target: op.target, direction: op.content || '', reason: op.reason || (pl.addressesIssues || [])[0] || '', planId: pl.id,
        approvedBy: (typeof App !== 'undefined' && App.currentUser && App.currentUser.email) || 'human' });
    });
  });

  // ★ E-11: 3경로 렌더 정합 재검증. 불일치 → 롤백(커밋 안 함) + 렌더회귀.
  var rc = Patent._reviewRenderCheck();
  if (!(rc.svg && rc.pptx && rc.canvas)) {
    return {
      rolledBack: true, renderCheck: { svg: rc.svg, pptx: rc.pptx, canvas: rc.canvas },
      renderRegression: { type: '명확성', legalBasis: '§42(도면정합)', missing: rc.missing,
        description: '반영 후 3경로 렌더 정합 위반(도면 부호 ' + rc.missing.slice(0, 5).join(', ') + ' 이 부호의 설명에 없음) — 롤백(E-11).' },
      applied: [], count: 0
    };
  }

  // 커밋-앳-엔드(정합 통과 시에만 반영 로그 기록 — 산문 원본 불변).
  if (typeof outputs !== 'undefined' && outputs) {
    outputs._review_applied = log;
    outputs._review_render_check = rc;
  }
  return { applied: log, renderCheck: { svg: true, pptx: true, canvas: true }, count: log.length, rolledBack: false };
};

// ═══════════ [D2 T1] 반영 엔진 — 승인 보정 방향을 실제 명세서에 반영(add_spec_support 우선) ═══════════
// opinion D2a(applyDirectionRewrite) 패턴 이식. patent 주력 op = add_spec_support(§42④ 상세설명 뒷받침 — DB high 주력).
//   ★ 안전(opinion 교훈): 대상 섹션만 수정, 비대상 byte-identical, APPEND(기존 상세설명 불변), 보류(자동 커밋 금지).
//   ★ §47 비적용(출원 전 — 최초 명세서 작성 중). E-11 도면 정합(_reviewRenderCheck) 게이트.

// _genSpecSupportParagraph — add_spec_support 방향 → 상세설명 뒷받침 "단락 1개" 생성(LLM, 평문).
//   ★ 기존 상세설명을 재출력하지 않고 "추가할 단락"만 생성(APPEND 용). 기존 문체·용어·도면부호와 정합.
//   ★ 별도 함수로 분리 → 테스트가 LLM 없이 stub 가능(반영 로직 단위검증).
Patent._genSpecSupportParagraph = async function(dir, basisText) {
  var target = (dir && dir.target) || '해당 구성';
  var direction = (dir && dir.direction) || '';
  var reason = (dir && dir.reason) || '';
  var basis = String(basisText || '');
  var ctx = basis.length > 12000 ? (basis.slice(0, 8000) + '\n...[중략]...\n' + basis.slice(-4000)) : basis;
  var prompt = '당신은 15년차 한국 특허 변리사입니다. 아래 [기존 상세설명]에 ' + target + ' 구성의 뒷받침(§42④)을 보강하는 상세설명 단락 1개를 작성하세요.\n\n'
    + '[보강 방향(AI 검증·변리사 승인)]\n' + direction + (reason ? '\n[근거 지적]\n' + reason : '') + '\n\n'
    + '[기존 상세설명]\n' + ctx + '\n\n'
    + '★ 규칙:\n'
    + '1. ★ 추가할 "단락 하나"만 출력한다. 기존 상세설명을 재출력하지 마라(뒤에 APPEND 된다).\n'
    + '2. 기존 상세설명의 문체·용어·도면부호와 정합되게 작성한다(★ 새 도면부호 도입 금지 — 부호의 설명 정합 유지).\n'
    + '3. ' + target + ' 구성의 동작원리·기준값 산출·구현을 통상의 기술자가 실시 가능하게 구체적으로 기술한다(출원 전 작성 — 신규사항 §47 제약 없음).\n'
    + '4. 마크다운·머리표·번호 없이 특허 명세서 본문 문장으로만 작성한다. 본문 단락만 출력(머리말·인사·설명 금지).';
  var r = await App.callClaude(prompt, 2048);
  var t = (r && r.text ? String(r.text) : '').trim();
  return t || null;
};

// _collectApprovedSpecOps — 승인된 add_spec_support 보정을 ★화면과 동일한 소스★에서 수집(새로고침 내성).
//   ★ 1순위: window.__patentReviewState.patchPlans (검증결과·승인상태 — openProject 재수화로 review_runs.result 에서 복원).
//     화면("검증 결과 보기"·"승인됨")이 읽는 바로 그 변수 → 화면·반영 데이터 일치(검증 직후/새로고침 후 동일).
//   ★ 2순위(fallback): outputs._review_applied (라이브 승인 직후 applyAmendments 가 채운 인메모리 로그).
//     ⚠️ outputs._review_applied 는 projects.current_state_json 에 미영속 → 새로고침 후엔 휘발(0건의 원인).
//   direction(op.content) 이 비면 대응 issue 본문(description)으로 basis 보강(rebut·재수화 시 direction 부재 방어).
Patent._collectApprovedSpecOps = function() {
  var out = [];
  var rs = (typeof window !== 'undefined' && window.__patentReviewState) || null;
  var plans = (rs && Array.isArray(rs.patchPlans)) ? rs.patchPlans : null;
  if (plans && plans.length) {
    var issuesById = {};
    (rs.issues || []).forEach(function(it){ if (it && it.id) issuesById[it.id] = it; });
    plans.forEach(function(pl){
      if (!pl || pl.accepted !== true) return;                      // 승인된 plan 만(화면 "승인됨"과 동일 기준)
      (pl.ops || []).forEach(function(op){
        if (!op || op.op !== 'add_spec_support') return;
        var dir = String(op.content || '').trim();
        if (!dir) {                                                  // direction 부재 → 승인된 §42④ 지적 본문으로 보강
          var iss = issuesById[op.reason] || issuesById[(pl.addressesIssues || [])[0]];
          dir = (iss && String(iss.description || '').trim()) || '';
        }
        out.push({ op: 'add_spec_support', target: op.target || (pl.addressesIssues || [])[0] || '',
          direction: dir, reason: op.reason || (pl.addressesIssues || [])[0] || '', planId: pl.id });
      });
    });
  }
  if (!out.length) {                                                 // fallback: 인메모리 로그(라이브, __patentReviewState 미설정 시)
    var log = (typeof outputs !== 'undefined' && outputs && Array.isArray(outputs._review_applied)) ? outputs._review_applied : [];
    log.forEach(function(e){ if (e && e.op === 'add_spec_support') out.push(e); });
  }
  return out;
};

// applyDirectionRewrite — T1: 승인된 add_spec_support 방향을 상세설명(step_08/12)에 뒷받침 단락으로 APPEND.
//   ★ 입력 소스 통일(_collectApprovedSpecOps): __patentReviewState.patchPlans(화면·반영 동일·재수화 내성), fallback outputs._review_applied.
//   ★ outputs 미커밋 — 변리사 [확정](T2)에서만 outputs 에 반영. 청구항 op(add_limitation/narrow_scope)·fix_* 는 다음 단계.
Patent.applyDirectionRewrite = async function(opts) {
  opts = opts || {};
  var specOps = Patent._collectApprovedSpecOps();   // ★ 화면과 동일 소스(승인 plan) — 새로고침 후에도 0건 방지
  if (!specOps.length) { try { App.showToast('반영할 승인 보정(상세설명 뒷받침)이 없습니다', 'info'); } catch (_e) {} return null; }

  // ★ 대상 섹션(상세설명)만 클론 — 청구항(step_06/10)·도면·부호(step_18)는 미접촉(비대상 byte-identical).
  var baseDev = String((typeof outputs !== 'undefined' && outputs.step_08) || '');
  var baseMet = String((typeof outputs !== 'undefined' && outputs.step_12) || '');
  var pending = { step_08: baseDev, step_12: baseMet };
  var before = { step_08: baseDev, step_12: baseMet };

  // ★ APPEND: target 의 뒷받침 단락을 LLM 생성 → 상세설명(장치 step_08 기본 / 장치 없으면 방법 step_12)에 추가만(기존 불변).
  var sec = (baseDev || !baseMet) ? 'step_08' : 'step_12';
  var appended = [], failed = [];
  for (var i = 0; i < specOps.length; i++) {
    var e = specOps[i], para = null;
    try { para = await Patent._genSpecSupportParagraph(e, pending[sec]); } catch (_x) { para = null; }
    if (!para) { failed.push({ planId: e.planId, target: e.target, reason: '뒷받침 단락 생성 실패' }); continue; }
    pending[sec] = pending[sec] + (pending[sec] ? '\n\n' : '') + para;   // ★ APPEND(기존 텍스트 byte-identical + 뒤에 추가)
    appended.push({ planId: e.planId, target: e.target, section: sec, paragraph: para });
  }
  if (!appended.length) { try { App.showToast('뒷받침 단락 생성 실패 — 재시도하세요', 'error'); } catch (_e) {} return null; }

  // ★ E-11 도면 정합 게이트 — ★delta 판정(절대 상태 아님). 보정 전/후 missing 을 비교해 "이 보정이 새로 유발한 불일치"만 차단.
  //   add_spec_support 는 도면·부호 불변(step_08 만 APPEND) → before==after → 통과(기존 불일치에 볼모 안 잡힘).
  var checkO = Object.assign({}, (typeof outputs !== 'undefined' && outputs) || {}, pending);
  var gate = Patent._reviewDeltaGate((typeof outputs !== 'undefined' && outputs) || {}, checkO);

  // ★ 보류(outputs 미커밋) — T2 [확정]에서만 outputs 반영. 비대상 섹션은 pending 에 없으므로 구조적으로 불변.
  Patent._pendingPatentRewrite = {
    pending: pending, before: before, after: { step_08: pending.step_08, step_12: pending.step_12 },
    appended: appended, failed: failed,
    // ★ renderCheck: delta 기준. svg/pptx/canvas=이 보정이 렌더를 깼는가(canConfirm). missing=이 보정이 새로 만든 누락(차단 사유).
    //   preexistingMissing=보정과 무관한 기존 도면↔부호 불일치(비차단 경고용).
    renderCheck: { svg: gate.canConfirm, pptx: gate.canConfirm, canvas: gate.canConfirm, missing: gate.newMissing, preexistingMissing: gate.preexistingMissing },
    canConfirm: gate.canConfirm,
  };
  try { App.showToast(appended.length + '건 뒷받침 단락 생성(보류) — 비교 후 확정하세요', 'success'); } catch (_e) {}
  return Patent._pendingPatentRewrite;
};

// ─────────── [D2 T2] 비교 모달 + 확정 — 보류본(_pendingPatentRewrite)을 변리사가 전/후 비교 후 outputs 커밋 ───────────
// opinion D2c(showRewriteConfirmModal/confirmRewrite/_confirmRewriteClick/cancelRewrite) 패턴 이식.
//   ★ 확정 전까지 outputs 불변(보류). [확정]에서만 outputs.step_08/12 커밋 → renderPreview(화면) + saveProject(영속).
//   ★ outputs 단일소스 → Word 다운로드(downloadAsWord)가 자동 반영(별도 작업 0).
//   ★ 배선: [확정]/[취소] 모두 인라인 onclick(opinion 무반응 교훈 — addEventListener 의존 제거).

// _secLabelKo — 상세설명 섹션 키 → 한글 라벨(비교 모달 표시용).
Patent._secLabelKo = function(sec){ return sec === 'step_12' ? '방법 상세설명' : '장치 상세설명'; };

// startDirectionRewrite — [반영하기] 버튼 핸들러(★명시 액션). applyDirectionRewrite(보류본 생성) → 비교 모달.
//   ★ 승인(onChange)이 자동 호출하지 않는다 — 변리사가 명시적으로 누른다(자동적용 금지).
Patent.startDirectionRewrite = async function() {
  try { if (typeof setButtonLoading === 'function') setButtonLoading('btnPatentDirectionRewrite', true); } catch (_e) {}
  try {
    var pend = await Patent.applyDirectionRewrite();   // _pendingPatentRewrite 생성(보류 — outputs 불변)
    if (pend) Patent.showPatentRewriteModal();
  } catch (e) { try { App.showToast('반영 실패: ' + ((e && e.message) || e), 'error'); } catch (_x) {} }
  finally { try { if (typeof setButtonLoading === 'function') setButtonLoading('btnPatentDirectionRewrite', false); } catch (_e) {} }
};

// _buildPatentRewriteDiffHtml — 보류본 보정 전/후. 추가되는 뒷받침 단락(하이라이트 + 대상 claim_N) + 기존 상세설명(불변).
//   ★ APPEND 라 "추가된 단락"만 초록 하이라이트(어디가 추가됐나 가시화). 순수(HTML 문자열).
Patent._buildPatentRewriteDiffHtml = function(pend) {
  if (!pend) return '<p style="font-size:13px;color:var(--color-text-secondary)">반영 보류본이 없습니다.</p>';
  var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s){ return String(s == null ? '' : s); };
  var h = '';
  // 게이트 배너(E-11 ★delta) — 3상태: ①이 보정이 새 불일치 유발(차단) ②기존 불일치 있으나 확정 가능(비차단 경고) ③정합 통과.
  var newMissing = (pend.renderCheck && pend.renderCheck.missing) || [];               // 이 보정이 새로 만든 누락(차단 사유)
  var preMissing = (pend.renderCheck && pend.renderCheck.preexistingMissing) || [];    // 보정과 무관한 기존 불일치(경고)
  if (pend.canConfirm === false) {
    h += '<div style="padding:10px 12px;border-radius:8px;background:#FDECEC;border-left:3px solid var(--color-error,#D32F2F);color:#9A1C1C;font-size:12px;margin-bottom:12px">⛔ 이 보정이 새 도면 부호 불일치(' + esc(newMissing.slice(0, 5).join(', ')) + ')를 유발 — 확정 불가(E-11). [취소] 후 도면·부호를 점검하세요.</div>';
  } else if (preMissing.length) {
    h += '<div style="padding:10px 12px;border-radius:8px;background:#FEF4E6;border-left:3px solid var(--color-warning,#ED6C02);color:#7A4100;font-size:12px;margin-bottom:12px">✅ 확정 가능 — 이 보정(상세설명 보강)은 도면·부호 정합을 바꾸지 않습니다.<br>※ 참고: <b>이 보정과 무관한 기존</b> 도면↔부호의 설명 불일치(' + esc(preMissing.slice(0, 5).join(', ')) + ')가 명세서에 원래 있습니다 — 부호의 설명에서 별도 보강을 권장합니다(확정은 가능).</div>';
  } else {
    h += '<div style="padding:10px 12px;border-radius:8px;background:#EAF7EE;border-left:3px solid var(--color-success,#2E7D32);color:#1B5E20;font-size:12px;margin-bottom:12px">✅ 도면 부호 정합 통과 — 청구항·부호의 설명은 변경되지 않습니다(상세설명에만 단락 추가).</div>';
  }
  var arr = pend.appended || [];
  if (!arr.length) {
    h += '<p style="font-size:12px;color:var(--color-text-tertiary)">추가되는 단락이 없습니다.</p>';
  } else {
    h += '<div style="font-weight:600;font-size:13px;margin:4px 0 8px">추가되는 뒷받침 단락 ' + arr.length + '건 (기존 상세설명 뒤에 APPEND)</div>';
    arr.forEach(function(a){
      var claimNo = String(a.target || '').replace(/^claim_/, '청구항 ');
      h += '<div style="border:1px solid var(--color-border,#E0E0E0);border-radius:8px;padding:12px;margin-bottom:10px">'
        + '<div style="font-weight:600;font-size:12px;margin-bottom:6px">' + esc(Patent._secLabelKo(a.section)) + ' · <span style="color:var(--color-primary)">' + esc(claimNo) + ' 뒷받침</span> <span style="color:var(--color-success);font-size:11px">[추가]</span></div>'
        + '<div style="font-size:12px;color:#1B5E20;background:#EAF7EE;border-radius:6px;padding:8px">' + esc(a.paragraph || '').replace(/\n/g, '<br>') + '</div>'
        + '</div>';
    });
  }
  if (pend.failed && pend.failed.length) {
    h += '<div style="font-size:12px;color:#7A4100;background:#FEF4E6;border-radius:6px;padding:8px;margin-bottom:6px">⚠️ 단락 생성 실패 ' + pend.failed.length + '건 — 확정 시 제외됩니다.</div>';
  }
  // 기존 상세설명(불변) 미리보기 — 접두 보존 확인용(접어둠).
  var sec = (arr[0] && arr[0].section) || 'step_08';
  var baseTxt = String((pend.before && pend.before[sec]) || '');
  h += '<details style="margin-top:6px"><summary style="font-size:12px;color:var(--color-text-secondary);cursor:pointer">기존 ' + esc(Patent._secLabelKo(sec)) + ' (변경 없음 · 접두 보존)</summary>'
    + '<div style="font-size:12px;color:var(--color-text-tertiary);background:var(--color-bg-subtle,#FAFAFA);border-radius:6px;padding:8px;margin-top:6px;max-height:200px;overflow:auto">' + esc(baseTxt).replace(/\n/g, '<br>') + '</div></details>';
  return h;
};

// showPatentRewriteModal — 비교 확정 모달. canConfirm=false 면 [확정] 비활성(E-11 차단).
Patent.showPatentRewriteModal = function() {
  var pend = Patent._pendingPatentRewrite;
  if (!pend) { try { App.showToast('반영 보류본이 없습니다', 'error'); } catch (_e) {} return; }
  try { var existing = document.getElementById('patentRewriteModal'); if (existing) existing.remove(); } catch (_e) {}
  var blocked = pend.canConfirm === false;
  var modal = document.createElement('div');
  modal.id = 'patentRewriteModal'; modal.className = 'modal-overlay'; modal.style.display = 'flex';
  modal.innerHTML = '<div class="modal-content" style="max-width:760px;padding:24px;max-height:82vh;overflow:auto">'
    + '<div class="modal-title" style="font-size:16px;margin-bottom:4px"><span class="ico" data-icon="edit"></span> 승인 방향 반영 — 상세설명 뒷받침 추가(전/후 비교)</div>'
    + '<p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:14px">상세설명에만 뒷받침 단락이 추가됩니다. 청구항·부호의 설명은 변경되지 않습니다(코드 보장). 확정 전에는 명세서가 변경되지 않습니다.</p>'
    + Patent._buildPatentRewriteDiffHtml(pend)
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    + '<button class="btn btn-ghost" style="flex:1;padding:10px" onclick="Patent.cancelPatentRewrite()">취소 (폐기)</button>'
    + '<button class="btn btn-primary" style="flex:1;padding:10px" id="btnPatentRewriteConfirm" onclick="Patent._confirmPatentRewriteClick()"' + (blocked ? ' disabled title="이 보정이 도면 정합을 깸 — 확정 불가"' : '') + '><span class="ico" data-icon="check"></span> 확정 (명세서 반영)</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  try { modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); }); } catch (_e) {} // 외부 클릭 닫기
  // ★ A-1: [확정]/[취소] 모두 인라인 onclick — addEventListener 의존 제거(클릭 무반응 방지, opinion 교훈).
};

// confirmPatentRewrite — ★ 확정: 보류본 after → outputs 커밋(이전까지 불변). E-11 차단 시 거부.
//   커밋 후 renderPreview(화면) + saveProject(영속). outputs 단일소스라 Word 다운로드 자동 반영.
Patent.confirmPatentRewrite = async function() {
  var pend = Patent._pendingPatentRewrite;
  if (!pend) { try { App.showToast('확정할 반영 보류본이 없습니다', 'error'); } catch (_e) {} return false; }
  if (pend.canConfirm === false) {
    try { App.showToast('⚠️ 이 보정이 도면 부호 정합을 깨서(E-11) 확정할 수 없습니다 — 취소 후 도면·부호를 점검하세요', 'error'); } catch (_e) {}
    return false;
  }
  // ★ 확정 시에만 커밋 — appended 된 섹션만 outputs 에 반영(비대상 섹션 미기록 → 불변).
  var stamp = new Date().toISOString();
  var doneIds = {}, sections = {};
  (pend.appended || []).forEach(function(a){ doneIds[a.planId] = true; sections[a.section] = true; });
  if (typeof outputs !== 'undefined' && outputs) {
    Object.keys(sections).forEach(function(sec){ outputs[sec] = pend.after[sec]; });   // ★ outputs 커밋(보류 해제)
    if (Array.isArray(outputs._review_applied)) {
      outputs._review_applied.forEach(function(e){ if (e && doneIds[e.planId]) { e.applied = true; e.appliedAt = stamp; } });
    }
  }
  Patent._pendingPatentRewrite = null;   // 보류 해제
  try { if (typeof renderPreview === 'function') renderPreview(); } catch (_e) {}        // 화면 반영(미리보기/다운로드 동일 소스)
  try { if (typeof saveProject === 'function') await saveProject(true); } catch (_e) {}  // current_state_json 영속(Word 자동 반영)
  try { App.showToast('반영 확정 — 상세설명에 뒷받침 단락 ' + (pend.appended || []).length + '건 추가(다운로드 반영)', 'success'); } catch (_e) {}
  return true;
};

// _confirmPatentRewriteClick — [확정] 인라인 onclick 핸들러([취소]와 배선 통일). 성공 시 모달 닫음.
//   ★ addEventListener 의존 제거 → "클릭 무반응" 차단. 반환=Promise(테스트 await용; onclick 은 무시).
Patent._confirmPatentRewriteClick = function() {
  return Patent.confirmPatentRewrite().then(function(ok){
    if (ok) { try { var m = document.getElementById('patentRewriteModal'); if (m) m.remove(); } catch (_e) {} }
  });
};

// cancelPatentRewrite — 보류 폐기. outputs 불변(기존 명세서 유지).
Patent.cancelPatentRewrite = function() {
  Patent._pendingPatentRewrite = null;
  try { var m = document.getElementById('patentRewriteModal'); if (m) m.remove(); } catch (_e) {}
  try { App.showToast('반영 취소됨 — 기존 명세서 유지', 'info'); } catch (_e) {}
};

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
