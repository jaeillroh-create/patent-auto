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
