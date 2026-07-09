/* ═══════════════════════════════════════════════════════════
   분할출원 청구항 자동 작성 v1.0 — division.js
   유형: 병합형 / 카테고리변경형(준비중) / 전략형(준비중)
   namespace: window.Division  |  DB: division_*  |  CSS: division-
   의존: common.js (App, sb, callClaude, showToast, escapeHtml 등)
   ═══════════════════════════════════════════════════════════ */
window.Division = window.Division || {};

// ═══ Constants ═══
Division.TYPES = {
  merge:           { code:'M', label:'청구항 병합형',     icon: '<span class="ico" data-icon="split"></span>', css:'dtype-merge',    desc:'등록항 + 미활용 구성 부가' },
  category_change: { code:'C', label:'카테고리 변경형',   icon: '<span class="ico" data-icon="refresh"></span>', css:'dtype-category', desc:'방법↔장치 전환' },
  strategic:       { code:'S', label:'전략적 분할',       icon: '<span class="ico" data-icon="flag"></span>', css:'dtype-strategic', desc:'새 독립항 구성' }
};

Division.STATUS = {
  created:   { label:'생성됨',     css:'dstatus-created',   step:0 },
  uploaded:  { label:'업로드완료', css:'dstatus-uploaded',  step:1 },
  parsed:    { label:'파싱완료',   css:'dstatus-parsed',    step:2 },
  analyzed:  { label:'분석완료',   css:'dstatus-analyzed',  step:3 },
  assembled: { label:'조립완료',   css:'dstatus-assembled', step:4 },
  verified:      { label:'검증완료',   css:'dstatus-verified',      step:5 },
  re_verifying:  { label:'재검증중',   css:'dstatus-verified',      step:5 },
  confirmed: { label:'확정',       css:'dstatus-confirmed', step:6 },
  error:     { label:'오류',       css:'dstatus-error',     step:-1 }
};

Division.PIPELINE = [
  { key:'upload',   label:'파일 업로드',  icon: '<span class="ico" data-icon="folder"></span>' },
  { key:'parse',    label:'파싱',         icon: '<span class="ico" data-icon="search"></span>' },
  { key:'analyze',  label:'분석',         icon: '<span class="ico" data-icon="chart"></span>' },
  { key:'assemble', label:'조립',         icon: '<span class="ico" data-icon="settings"></span>' },
  { key:'verify',   label:'검증',         icon: '<span class="ico" data-icon="check-circle"></span>' },
  { key:'confirm',  label:'확정',         icon: '<span class="ico" data-icon="flag"></span>' }
];

Division.STEP_TO_STATUS = { upload:'uploaded', parse:'parsed', analyze:'analyzed', assemble:'assembled', verify:'verified', confirm:'confirmed' };

// ═══ 분할출원 공통 절대 원칙 (T3: 3유형 공통, 프롬프트 주입용 상수) ═══
Division.DIVISION_PRINCIPLES = '\n' +
'★★★ 분할출원 절대 원칙 (3유형 공통) ★★★\n\n' +
'[원칙 1] 신규사항 추가 금지 (특허법 제52조 + 제47조)\n' +
'- 분할출원 청구항의 모든 구성은 원출원의 최초 명세서(발명의 상세한 설명)에\n' +
'  직접적으로 기재된 사항이어야 한다.\n' +
'- 원출원 명세서에 없는 구성, 용어, 개념을 포함하면 신규사항 추가로 거절된다.\n' +
'- AI는 "당업자의 자명한 도출"을 사용하지 말 것. 직접 기재 사항만 사용하라.\n\n' +
'[원칙 2] 등록결정 구성(basis) 절대 보존\n' +
'- 등록결정된 청구항의 구성(A+B+C)은 한 글자도 수정·삭제하지 않는다.\n' +
'- 이 구성은 이미 심사관이 등록을 인정한 것이므로, 변경하면 등록 전례의\n' +
'  이점을 잃고 새로운 거절이유가 발생할 수 있다.\n\n' +
'[원칙 3] 추가 구성(D)의 출처 제한\n' +
'- D는 반드시 원출원 "발명의 상세한 설명"에 기재되어 있으면서,\n' +
'  원출원의 어떤 등록 청구항에도 포함되지 않았던 구성이어야 한다.\n' +
'- D가 기존 종속항에 이미 있으면 이중 특허(double patenting) 위험이 있다.\n\n' +
'[원칙 4] 바로 등록결정 전략\n' +
'- A+B+C(등록 전례) + D(명세서 뒷받침, 추가 한정) = 거절이유 없음 → 바로 등록\n' +
'- D 선택 시 "심사관이 거절하기 어려운" 구체적·구조적 한정을 우선 추천하라.\n';

// ═══ 신규사항 키워드 검증용 불용어 목록 (T3: 특허 문체 상용어 포함) ═══
Division.STOPWORDS = [
  // 조사·접속
  '상기','있어서','에서','으로','위한','의한','대한','따른','통해','대해',
  '의해','관한','위해','것을','것인','것으로','또는','및','상기한','따르면',
  // 청구항 문체
  '포함하는','특징으로','하는','이상','이하','적어도','하나의','복수의','소정의',
  // 동사형 서술어 (특허 문체 상용어)
  '구성되는','수행하는','이루어지는','형성되는','제공하는','생성하는','출력하는',
  '수신하는','전송하는','저장하는','처리하는','판단하는','설정하는','제어하는',
  '표시하는','입력하는','산출하는','변환하는','검출하는','측정하는',
  '연산하는','추출하는','분류하는','매칭하는','비교하는','결합하는',
  '배치되는','연결되는','장착되는','구비하는','탑재하는','내장하는',
  '인가하는','인접하는','대응하는','작동하는','구동하는','실행하는',
  '획득하는','산정하는','갱신하는','등록하는','할당하는','선택하는',
  // 명사형 일반 표현
  '실시예','본 발명','일 실시예','상기에서','따라서','그리고','경우에',
  '이때','또한','나아가','한편','이에','이하에서','상세하게','구체적으로',
  '바람직하게','선택적으로','예를들어','예컨대','다만','단지'
];

// ═══ 한국어 조사/어미 접미사 (긴 것부터 — 최장 일치) ═══
Division.KO_SUFFIXES = [
  // 복합 조사
  '이라고','라고','로부터','으로부터','에서는','에서도','에서의','에서부터',
  '으로서','으로써','로서','로써','에게서','에게는','에게도',
  // 어미 (긴 것)
  '하였다','되었다','하였으며','되었으며','하였고','되었고','하였던','되었던',
  '하였을','되었을','하였는지','되었는지','하였기','되었기','하였음','되었음',
  '하며','하고','하여','해서','하되','하면','하기','하지','하는','하였','한다','하다',
  '되며','되고','되어','되되','되면','되기','되지','되는','되었','된다','되다',
  '시키','시키는','시키며','시키고','시켜서','시킨다','시킨','시킬',
  '이다','이고','이며','이면','이되','이나','이란','인지','인가',
  // 접사 + 조사
  '들을','들이','들의','들에','들과','들은','들도','들만','들로','들로부터',
  // 단일 조사
  '에서','에게','에는','에도','에만','으로','이나','이라',
  '부터','까지','마저','조차','한테','께서',
  '을','를','이','가','은','는','의','도','만','와','과','로','에','께'
];

/**
 * 한국어 키워드에서 조사/어미를 제거해 어근 추출.
 * 예: "분류하되" → "분류", "명령어들을" → "명령어", "거부율을" → "거부율"
 * 어근이 2자 미만이면 원본 반환 (과도한 삭제 방지).
 */
Division._stripKoreanSuffix = function(kw){
  if(!kw || kw.length < 3) return kw;
  for(var i = 0; i < Division.KO_SUFFIXES.length; i++){
    var suf = Division.KO_SUFFIXES[i];
    if(kw.length > suf.length + 1 && kw.substring(kw.length - suf.length) === suf){
      var stem = kw.substring(0, kw.length - suf.length);
      if(stem.length >= 2) return stem;
    }
  }
  return kw;
};

/**
 * 키워드가 명세서에 존재하는지 확인 (조사/어미 무시).
 * 1) 완전 일치 → pass
 * 2) 어근 일치 → pass
 */
Division._isKeywordInSpec = function(kw, specText){
  if(!kw || !specText) return false;
  if(specText.indexOf(kw) >= 0) return true;
  var stem = Division._stripKoreanSuffix(kw);
  if(stem !== kw && stem.length >= 2 && specText.indexOf(stem) >= 0) return true;
  return false;
};

Division.STATUS_TO_STEP = { created:0, uploaded:0, parsed:1, analyzed:2, assembled:3, verified:4, re_verifying:4, confirmed:5, error:-1 };

// ═══ 검증 임계값 상수 ═══
Division.THRESHOLDS = {
  COMPONENT_MISSING_KW: 2,   // 개별 구성 키워드 미발견 임계값 (validateUnusedComponents)
  COMPONENT_DANGER_KW: 5,    // 개별 구성 danger 에스컬레이션 임계값
  CLAIM_MISSING_KW: 3,       // 전체 청구항 키워드 미발견 임계값 (runAutoVerify)
  OVERLAP_WARNING: 0.7,      // 기존 청구항 유사도 overlap 경고 임계값
  DOUBLE_PATENTING: 0.95,    // 이중 특허 경고 임계값
  BASIS_PRESERVATION: 0.8,   // basis 보존율 CRITICAL 임계값
  BASIS_WARN: 0.95,          // basis 보존율 MEDIUM 경고 임계값
  CATEGORY_PRESERVATION: 0.6,// 카테고리변경 기술적 내용 보존율 임계값
  COMPONENT_OVERLAP: 0.7     // 추가 구성 D 중복 경고 임계값
};

Division.FILE_TYPES = {
  application:  { label:'특허출원서',       icon: '<span class="ico" data-icon="doc"></span>', required:true },
  notification: { label:'의견제출통지서',   icon:'📨', required:true },
  opinion:      { label:'의견서',           icon: '<span class="ico" data-icon="edit"></span>', required:true },
  amendment:    { label:'보정서',           icon: '<span class="ico" data-icon="edit"></span>', required:true },
  prior_art:    { label:'인용발명',         icon:'📚', required:false },
  decision:     { label:'등록결정서',       icon:'🏆', required:false }
};

Division.RISK_LABELS = {
  safe:    { label:'안전',   icon: '<span class="status-dot positive"></span>', css:'risk-safe' },
  caution: { label:'주의',   icon: '<span class="status-dot cautionary"></span>', css:'risk-caution' },
  danger:  { label:'위험',   icon: '<span class="status-dot negative"></span>', css:'risk-danger' }
};

Division.SYS_PROMPT = '너는 대한민국 특허청(KIPO) 분할출원 실무에 정통한 15년 차 수석 변리사이다.\n원칙:\n1. 한국 특허법 제52조(분할출원)에 근거\n2. 원출원 명세서 범위 내에서만 청구항 구성\n3. 기재불비(§42③④) 회피를 최우선\n4. 특허청 표준 서식과 문체\n5. 구조화된 JSON 반환';

// ═══ Debug ═══
Division.DEBUG = false;
Division._log = function(){ if(Division.DEBUG) console.log.apply(console, arguments); };

// ═══ State ═══
Division.state = {
  projects: [],
  current: null,
  view: 'list',
  files: [],
  claims: [],
  unusedComponents: [],
  divisionClaims: [],
  validationResults: [],
  specParagraphs: [],
  _runningProjectId: null  // AI 호출 중인 프로젝트 ID (레이스 컨디션 방지)
};

// ═══════════════════════════════════════════════════════════════════
// [T7] WriterModule 연동 — 통합 리뷰 엔진(review-engine)과의 계약 2함수 (opinion T6와 동형).
//   기존 작성·검증 로직은 일절 변경하지 않는다(추가만). simulate/rollback은 division.js에 안 넣음(옵션 B).
// ═══════════════════════════════════════════════════════════════════

// exportSnapshot — 원본(Division.state) 변형 없이 깊은 복사본 반환(I-1, 읽기전용).
//   반환 형상은 profiles/division/adapter.js: adaptSnapshot 입력과 정합.
Division.exportSnapshot = function() {
  var s = Division.state || {};
  var cur = s.current || {};
  var projection = {
    caseId: cur.application_number || cur.reference_number || '',
    reviewId: cur.id ? ('rev_div_' + cur.id) : undefined,
    divisionType: cur.division_type || null,
    originalClaims: s.claims || [],
    unusedComponents: s.unusedComponents || [],
    divisionClaims: s.divisionClaims || [],
    specParagraphs: s.specParagraphs || [],
    selfReview: s.validationResults || null
  };
  try { return structuredClone(projection); }
  catch (e) { return JSON.parse(JSON.stringify(projection)); }
};

// applyAmendments — 사람 승인 PatchPlan만 실(實)반영(구조적) + 정합성 재검증(§47/이중특허).
//   ★ I-2/E-19: accepted !== true 가 하나라도 있으면 throw(미승인 미반영).
//   ★ 산문 청구항 텍스트는 재작성하지 않는다(op.content=보정 "방향"). 승인 방향을 구조적으로 기록.
//   ★ 원자성(E-27): 작업 사본에 적용→재검증→커밋(commit-at-end). 예외 시 Division.state 불변.
//   ★ 재검증은 기존 Division.runAutoVerify(Pass 1 코드검증) 재사용(동작 불변).
Division.applyAmendments = function(acceptedPlans) {
  if (!Array.isArray(acceptedPlans)) throw new Error('applyAmendments: plans 배열 필요');
  acceptedPlans.forEach(function(pl) {
    if (!pl || pl.accepted !== true) {
      throw new Error('applyAmendments: 미승인 plan 반영 불가 (I-2/E-19) — ' + (pl && pl.id));
    }
  });

  var s = Division.state || {};
  var working;
  try { working = structuredClone(s.divisionClaims || []); }
  catch (e) { working = JSON.parse(JSON.stringify(s.divisionClaims || [])); }
  var byNo = {};
  working.forEach(function(dc) { if (dc && dc.claim_number != null) byNo[String(dc.claim_number)] = dc; });

  var applied = [];
  acceptedPlans.forEach(function(pl) {
    (pl.ops || []).forEach(function(op) {
      var no = String(op.target || '').replace(/^claim_/, '');
      var dc = byNo[no];
      if (!dc) return;
      dc.review_amendments = dc.review_amendments || [];
      dc.review_amendments.push({
        op: op.op, direction: op.content || '',
        reason: op.reason || (pl.addressesIssues || [])[0] || '', planId: pl.id,
        approvedBy: (typeof App !== 'undefined' && App.currentUser && App.currentUser.email) || 'human'
      });
      applied.push({ planId: pl.id, claim_number: no, op: op.op });
    });
  });

  // 정합성 재검증(§47/이중특허/basis) — 기존 runAutoVerify 재사용.
  var cur = s.current || {};
  var basisClaim = (s.claims || []).filter(function(c) { return c.division_role === 'basis'; })[0] || null;
  var specText = (s.specParagraphs || []).map(function(p) { return p.content || ''; }).join('\n');
  var autoIssues = [];
  try { autoIssues = Division.runAutoVerify(working, basisClaim, s.claims || [], specText, cur.division_type) || []; } catch (e) {}

  // 커밋-앳-엔드(원자성).
  Division.state.divisionClaims = working;
  Division.state._review_applied = applied;
  Division.state._review_auto_issues = autoIssues;

  return { applied: applied, autoIssues: autoIssues, count: applied.length };
};

// ═══ Init ═══
Division.init = function(){
  Division._log('[Division] init');
  Division.loadProjects();
};

// ═══ AI 호출 (Division 전용 시스템 프롬프트 사용) ═══
Division.callAI = async function(prompt, maxTokens){
  maxTokens = maxTokens || 16384;
  if(!App.ensureApiKey()){ App.openProfileSettings(); throw new Error('API Key를 먼저 입력해 주세요'); }
  var prov = selectedProvider, mc = App.getModelConfig();
  var req = App.buildAPIRequest(prov, selectedModel, Division.SYS_PROMPT, prompt, maxTokens);
  var ctrl = new AbortController(), tout = setTimeout(function(){ ctrl.abort(); }, 300000); // 5분
  try {
    var res = await fetch(req.url, { method:'POST', signal:ctrl.signal, headers:req.headers, body:JSON.stringify(req.body) });
    clearTimeout(tout);
    if(res.status === 401 || res.status === 403){ showToast('API Key가 유효하지 않습니다','error'); throw new Error('API Key 유효하지 않음'); }
    if(res.status === 429) throw new Error('요청 과다. 30초 후 재시도');
    if(res.status >= 500) throw new Error('서버 오류 (' + res.status + ')');
    var d = await res.json(), parsed = App.parseAPIResponse(prov, d);
    if(window.usage){ window.usage.calls++; window.usage.inputTokens += parsed.it; window.usage.outputTokens += parsed.ot;
      window.usage.cost += (parsed.it * mc.inputCost / 1e6) + (parsed.ot * mc.outputCost / 1e6); }
    if(typeof window.updateStats === 'function') window.updateStats();
    return { text: parsed.text, stopReason: parsed.stopReason };
  } catch(e) { clearTimeout(tout); if(e.name === 'AbortError') throw new Error('타임아웃(5분)'); throw e; }
};

// ═══ JSONB에서 조회된 값을 안전하게 배열로 변환 ═══
Division._toArray = function(val){
  if(!val) return [];
  if(Array.isArray(val)) return val;
  if(typeof val === 'string'){
    try { var parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : [String(val)]; }
    catch(e){ return val.trim() ? [val] : []; }
  }
  return [String(val)];
};

// ═══ AI 호출 중 프로젝트 전환 감지 (레이스 컨디션 방지) ═══
Division._checkProjectStale = function(capturedId){
  var current = Division.state.current;
  return !current || current.id !== capturedId;
};

// ═══ enum 값 정제 (DB 저장 전 유효한 값으로 변환) ═══
Division._sanitizeEnum = function(val, validList, fallback){
  if(!val) return fallback;
  val = String(val).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return validList.indexOf(val) >= 0 ? val : fallback;
};

// ═══ 청구항 텍스트를 구성요소별 줄바꿈 처리 ═══
Division._formatClaimText = function(text){
  if(!text) return '';
  // 세미콜론(;) 뒤에 줄바꿈, "를 포함하는" 앞에 줄바꿈
  var formatted = text
    .replace(/;\s*/g, ';\n')
    .replace(/(를\s*포함하는)/g, '\n$1')
    .replace(/(을\s*포함하는)/g, '\n$1')
    .replace(/(를\s*포함하며)/g, '\n$1')
    .replace(/(단계;)/g, '$1\n');
  return formatted;
};

// ═══ 단어 단위 Diff — 등록 청구항 vs 제안 청구항 비교 ═══
Division._wordDiff = function(oldText, newText){
  if(!oldText || !newText) return { html: escapeHtml(newText || ''), addedCount:0, removedCount:0 };

  // 구성요소 구분자(;) 기준으로 분할하여 비교
  var oldParts = oldText.split(/([;,.]|\s+)/).filter(function(s){return s.trim();});
  var newParts = newText.split(/([;,.]|\s+)/).filter(function(s){return s.trim();});

  // LCS (Longest Common Subsequence) 기반 diff — O(n) 메모리 최적화
  var m = oldParts.length, n = newParts.length;
  // dp 테이블: 2행만 유지 (이전 행 + 현재 행)
  var prev = new Array(n + 1).fill(0);
  var curr = new Array(n + 1).fill(0);
  for(var di = 1; di <= m; di++){
    for(var dj = 1; dj <= n; dj++){
      if(oldParts[di-1] === newParts[dj-1]) curr[dj] = prev[dj-1] + 1;
      else curr[dj] = Math.max(prev[dj], curr[dj-1]);
    }
    var tmp = prev; prev = curr; curr = tmp;
    curr.fill(0);
  }
  // Hirschberg 역추적을 위해 전체 dp 재구성 (backtrack 필요)
  var dp = [];
  for(var di2 = 0; di2 <= m; di2++){ dp[di2] = new Array(n + 1).fill(0); }
  for(var di3 = 1; di3 <= m; di3++){
    for(var dj2 = 1; dj2 <= n; dj2++){
      if(oldParts[di3-1] === newParts[dj2-1]) dp[di3][dj2] = dp[di3-1][dj2-1] + 1;
      else dp[di3][dj2] = Math.max(dp[di3-1][dj2], dp[di3][dj2-1]);
    }
  }

  // Backtrack으로 diff 결과 생성
  var result = [];
  var bi = m, bj = n;
  while(bi > 0 || bj > 0){
    if(bi > 0 && bj > 0 && oldParts[bi-1] === newParts[bj-1]){
      result.unshift({ type:'same', text:oldParts[bi-1] });
      bi--; bj--;
    } else if(bj > 0 && (bi === 0 || dp[bi][bj-1] >= dp[bi-1][bj])){
      result.unshift({ type:'added', text:newParts[bj-1] });
      bj--;
    } else {
      result.unshift({ type:'removed', text:oldParts[bi-1] });
      bi--;
    }
  }

  // HTML 생성
  var html = '', addedCount = 0, removedCount = 0;
  result.forEach(function(r){
    if(r.type === 'same') html += escapeHtml(r.text) + ' ';
    else if(r.type === 'added'){ html += '<span class="division-diff-added">' + escapeHtml(r.text) + '</span> '; addedCount++; }
    else { html += '<span class="division-diff-removed">' + escapeHtml(r.text) + '</span> '; removedCount++; }
  });

  // 줄바꿈 처리
  html = html.replace(/;\s*/g, ';\n');

  return { html:html, addedCount:addedCount, removedCount:removedCount };
};

// ═══ 견고한 JSON 추출 (마크다운 fence, 전후 텍스트, 트레일링 콤마, 잘림 복구) ═══
Division._extractJSON = function(text){
  if(!text) throw new Error('빈 응답');
  // 디버그: 원본 응답 앞 500자 콘솔 출력
  Division._log('[Division] API 응답 (앞 500자):', text.substring(0, 500));
  Division._log('[Division] API 응답 길이:', text.length, '글자');

  // 1차: ```json ... ``` 블록 추출
  var fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if(fenceMatch) text = fenceMatch[1].trim();

  // 2차: 첫 번째 { ~ 마지막 } 추출
  var firstBrace = text.indexOf('{');
  var lastBrace = text.lastIndexOf('}');
  if(firstBrace === -1) throw new Error('JSON 시작({)을 찾을 수 없음. 응답 시작: ' + text.substring(0, 200));
  if(lastBrace === -1 || lastBrace <= firstBrace) throw new Error('JSON 종료(})를 찾을 수 없음 — 응답이 잘린 것 같습니다');

  var jsonStr = text.substring(firstBrace, lastBrace + 1);

  // 3차: 흔한 JSON 오류 보정
  // 트레일링 콤마 제거: ,] → ] , ,} → }
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
  // 제어문자 제거 (탭/줄바꿈 제외)
  jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  try {
    return JSON.parse(jsonStr);
  } catch(e) {
    console.error('[Division] JSON 파싱 실패. 정제된 문자열 (앞 1000자):', jsonStr.substring(0, 1000));
    // 4차: 잘린 JSON 복구 시도 — 열린 괄호 수 세서 닫기
    var opens = 0, closes = 0;
    for(var i = 0; i < jsonStr.length; i++){
      if(jsonStr[i] === '{') opens++;
      if(jsonStr[i] === '}') closes++;
    }
    if(opens > closes){
      var repaired = jsonStr;
      // 마지막 완전한 항목 뒤에서 자르고 닫기
      var lastComplete = repaired.lastIndexOf('},');
      if(lastComplete === -1) lastComplete = repaired.lastIndexOf('}');
      if(lastComplete > 0){
        repaired = repaired.substring(0, lastComplete + 1);
        // 열린 배열([) 먼저 닫기
        var openBrackets = (repaired.match(/\[/g)||[]).length - (repaired.match(/\]/g)||[]).length;
        for(var bl = 0; bl < openBrackets; bl++) repaired += ']';
        // 남은 열린 중괄호({) 닫기
        var remaining = 0;
        for(var j = 0; j < repaired.length; j++){
          if(repaired[j] === '{') remaining++;
          if(repaired[j] === '}') remaining--;
        }
        for(var k = 0; k < remaining; k++) repaired += '}';
        repaired = repaired.replace(/,\s*([}\]])/g, '$1');
        try {
          Division._log('[Division] 잘린 JSON 복구 시도...');
          return JSON.parse(repaired);
        } catch(e2) { /* 복구 실패 — 원본 에러 throw */ }
      }
    }
    throw new Error('JSON 파싱 실패: ' + e.message + '\n앞 300자: ' + jsonStr.substring(0, 300));
  }
};

// ═══════════════════════════════════════════
