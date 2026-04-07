/* ═══════════════════════════════════════════════════════════
   분할출원 청구항 자동 작성 v1.0 — division.js
   유형: 병합형 / 카테고리변경형(준비중) / 전략형(준비중)
   namespace: window.Division  |  DB: division_*  |  CSS: division-
   의존: common.js (App, sb, callClaude, showToast, escapeHtml 등)
   ═══════════════════════════════════════════════════════════ */
window.Division = window.Division || {};

// ═══ Constants ═══
Division.TYPES = {
  merge:           { code:'M', label:'청구항 병합형',     icon:'🔀', css:'dtype-merge',    desc:'등록항 + 미활용 구성 부가' },
  category_change: { code:'C', label:'카테고리 변경형',   icon:'🔄', css:'dtype-category', desc:'방법↔장치 전환' },
  strategic:       { code:'S', label:'전략적 분할',       icon:'🎯', css:'dtype-strategic', desc:'새 독립항 구성' }
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
  { key:'upload',   label:'파일 업로드',  icon:'📁' },
  { key:'parse',    label:'파싱',         icon:'🔍' },
  { key:'analyze',  label:'분석',         icon:'📊' },
  { key:'assemble', label:'조립',         icon:'🔧' },
  { key:'verify',   label:'검증',         icon:'✅' },
  { key:'confirm',  label:'확정',         icon:'🏁' }
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
  '상기','있어서','포함하는','특징으로','하는','에서','으로','위한','의한','대한',
  '구성되는','수행하는','이루어지는','형성되는','제공하는','생성하는','출력하는',
  '수신하는','전송하는','저장하는','처리하는','판단하는','설정하는','제어하는',
  '표시하는','입력하는','산출하는','변환하는','검출하는','측정하는',
  '따른','통해','대해','의해','관한','위해','것을','것인','것으로',
  '또는','및','이상','이하','적어도','하나의','복수의','소정의',
  '상기한','따르면','실시예','본 발명','일 실시예'
];
Division.STATUS_TO_STEP = { created:0, uploaded:0, parsed:1, analyzed:2, assembled:3, verified:4, confirmed:5 };

Division.FILE_TYPES = {
  application:  { label:'특허출원서',       icon:'📄', required:true },
  notification: { label:'의견제출통지서',   icon:'📨', required:true },
  opinion:      { label:'의견서',           icon:'📝', required:true },
  amendment:    { label:'보정서',           icon:'✏️', required:true },
  prior_art:    { label:'인용발명',         icon:'📚', required:false },
  decision:     { label:'등록결정서',       icon:'🏆', required:false }
};

Division.RISK_LABELS = {
  safe:    { label:'안전',   icon:'🟢', css:'risk-safe' },
  caution: { label:'주의',   icon:'🟡', css:'risk-caution' },
  danger:  { label:'위험',   icon:'🔴', css:'risk-danger' }
};

Division.SYS_PROMPT = '너는 대한민국 특허청(KIPO) 분할출원 실무에 정통한 15년 차 수석 변리사이다.\n원칙:\n1. 한국 특허법 제52조(분할출원)에 근거\n2. 원출원 명세서 범위 내에서만 청구항 구성\n3. 기재불비(§42③④) 회피를 최우선\n4. 특허청 표준 서식과 문체\n5. 구조화된 JSON 반환';

// ═══ State ═══
Division.state = {
  projects: [],
  current: null,
  view: 'list',
  files: [],
  claims: [],
  claimComponents: [],
  unusedComponents: [],
  divisionClaims: [],
  validationResults: [],
  specParagraphs: [],
  _runningProjectId: null  // AI 호출 중인 프로젝트 ID (레이스 컨디션 방지)
};

// ═══ Init ═══
Division.init = function(){
  console.log('[Division] init');
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
  console.log('[Division] API 응답 (앞 500자):', text.substring(0, 500));
  console.log('[Division] API 응답 길이:', text.length, '글자');

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
          console.log('[Division] 잘린 JSON 복구 시도...');
          return JSON.parse(repaired);
        } catch(e2) { /* 복구 실패 — 원본 에러 throw */ }
      }
    }
    throw new Error('JSON 파싱 실패: ' + e.message + '\n앞 300자: ' + jsonStr.substring(0, 300));
  }
};

// ═══════════════════════════════════════════
// 1. 프로젝트 목록
// ═══════════════════════════════════════════
Division.loadProjects = async function(){
  var el = document.getElementById('divisionProjectList');
  if(!el) return;
  try {
    // T15: spec_full_text만 제외하고 전체 조회 (목록+상세 진입 시 필요한 컬럼이 많아 명시적 나열 대신 제외 방식 사용)
    var {data, error} = await sb.from('division_projects')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('updated_at', {ascending:false});
    if(error) throw error;
    Division.state.projects = data || [];
  } catch(e) {
    console.error('[Division] load:', e);
    Division.state.projects = [];
  }
  Division.renderList();
};

Division.renderList = function(){
  var el = document.getElementById('divisionProjectList');
  var cnt = document.getElementById('divisionProjectCount');
  if(!el) return;
  var ps = Division.state.projects;
  if(cnt) cnt.textContent = '총 ' + ps.length + '건';

  if(!ps.length){
    el.innerHTML = '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--color-text-tertiary);font-size:13px">'
      + '<div style="font-size:32px;margin-bottom:8px"><span class="tf">📭</span></div>'
      + '분할출원 프로젝트가 없습니다.<br><span style="font-size:12px">새 프로젝트를 만들어 분할출원 청구항을 작성하세요.</span></td></tr>';
    return;
  }

  el.innerHTML = ps.map(function(p){
    var t = Division.TYPES[p.division_type] || { code:'?', label:'미정', css:'dtype-merge', icon:'❓' };
    var s = Division.STATUS[p.status] || { label:p.status, css:'dstatus-created' };
    var d = p.updated_at ? new Date(p.updated_at).toLocaleDateString('ko-KR', {month:'short', day:'numeric'}) : '-';
    return '<tr style="border-bottom:1px solid var(--color-divider);cursor:pointer" onclick="Division.open(\'' + p.id + '\')">'
      + '<td style="padding:10px 12px;font-weight:600;font-size:12px;color:var(--color-primary)">' + escapeHtml(p.reference_number || '-') + '</td>'
      + '<td style="padding:10px 12px"><div style="font-size:13px;font-weight:500">' + escapeHtml(p.name || '무제') + '</div>'
      + '<div style="margin-top:3px"><span class="division-type-badge ' + t.css + '">' + t.icon + ' ' + t.label + '</span></div></td>'
      + '<td style="padding:10px 12px;text-align:center"><span class="division-status-badge ' + s.css + '">' + s.label + '</span></td>'
      + '<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--color-text-tertiary)">' + d + '</td>'
      + '<td style="padding:10px 12px;text-align:center"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Division.del(\'' + p.id + '\')" style="font-size:11px;color:var(--color-error)">삭제</button></td>'
      + '</tr>';
  }).join('');
};

// ═══════════════════════════════════════════
// 2. 생성 / 삭제
// ═══════════════════════════════════════════
Division.openCreateModal = function(){
  document.getElementById('divisionCreateModal').style.display = 'flex';
};
Division.closeCreateModal = function(){
  document.getElementById('divisionCreateModal').style.display = 'none';
};

Division.create = async function(){
  var name = (document.getElementById('divisionNewName').value || '').trim();
  var refNum = (document.getElementById('divisionNewRefNum').value || '').trim();
  var appNum = (document.getElementById('divisionNewAppNum').value || '').trim();
  var divType = document.querySelector('input[name="divisionType"]:checked');

  if(!name){ showToast('프로젝트명을 입력해 주세요', 'error'); return; }
  if(!divType){ showToast('분할출원 유형을 선택해 주세요', 'error'); return; }

  var typeVal = divType.value;

  var inclPriorArt = document.getElementById('divisionInclPriorArt')?.checked || false;
  var origTitleKo = (document.getElementById('divisionOrigTitleKo')?.value || '').trim();
  var origTitleEn = (document.getElementById('divisionOrigTitleEn')?.value || '').trim();

  try {
    var {data, error} = await sb.from('division_projects').insert({
      name: name,
      reference_number: refNum || '',
      application_number: appNum || '',
      division_type: typeVal,
      include_prior_art: inclPriorArt,
      original_title_ko: origTitleKo || null,
      original_title_en: origTitleEn || null,
      status: 'created',
      user_id: currentUser.id
    }).select().single();
    if(error) throw error;

    showToast('프로젝트가 생성되었습니다');
    Division.closeCreateModal();
    Division.state.projects.unshift(data);
    Division.renderList();
    Division.open(data.id);
  } catch(e) {
    showToast('생성 실패: ' + e.message, 'error');
  }
};

Division.del = async function(id){
  if(!confirm('이 프로젝트를 삭제하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
  try {
    await sb.from('division_projects').delete().eq('id', id);
    Division.state.projects = Division.state.projects.filter(function(p){ return p.id !== id; });
    Division.renderList(); showToast('삭제됨');
  } catch(e) { showToast('삭제 실패', 'error'); }
};

// ═══════════════════════════════════════════
// 3. 프로젝트 상세 (Work View)
// ═══════════════════════════════════════════
Division.open = async function(id){
  var p = Division.state.projects.find(function(x){ return x.id === id; });
  if(!p){ showToast('프로젝트를 찾을 수 없습니다', 'error'); return; }
  Division.state.current = p;
  Division.state.view = 'detail';
  Division.state.currentStepKey = null; // 새 프로젝트 진입 시 DB 상태 기준
  document.getElementById('divisionListView').style.display = 'none';
  document.getElementById('divisionDetailView').style.display = 'block';
  Division.renderDetail();
  await Division.loadData(id);
};

Division.backToList = function(){
  Division.state.current = null;
  Division.state.view = 'list';
  Division.state.currentStepKey = null;
  document.getElementById('divisionDetailView').style.display = 'none';
  document.getElementById('divisionListView').style.display = 'block';
  Division.loadProjects();
};

Division.loadData = async function(id){
  try {
    var {data:files} = await sb.from('division_files').select('*').eq('project_id', id).order('created_at');
    Division.state.files = files || [];
    var {data:claims} = await sb.from('division_claims_parsed').select('*').eq('project_id', id).order('claim_number');
    Division.state.claims = claims || [];
    var {data:unused} = await sb.from('division_unused_components').select('*').eq('project_id', id);
    Division.state.unusedComponents = unused || [];
    var {data:divClaims} = await sb.from('division_claims_output').select('*').eq('project_id', id).order('claim_number');
    Division.state.divisionClaims = divClaims || [];
    var {data:valResults} = await sb.from('division_validation_results').select('*').eq('project_id', id);
    Division.state.validationResults = valResults || [];
  } catch(e) { console.error('[Division] loadData:', e); }
  // 저장된 청구항 개수 설정 복원
  var p = Division.state.current;
  if(p && p.analysis_meta){
    if(p.analysis_meta.indep_count) Division.state.indepCount = p.analysis_meta.indep_count;
    if(p.analysis_meta.dep_count) Division.state.depCount = p.analysis_meta.dep_count;
  }
  Division.renderDetail();
};

Division.renderDetail = function(){
  var p = Division.state.current; if(!p) return;
  var t = Division.TYPES[p.division_type] || { code:'?', label:'미정', css:'dtype-merge', icon:'❓' };
  var s = Division.STATUS[p.status] || { label:p.status, css:'dstatus-created' };
  document.getElementById('divisionDetailTitle').textContent = p.name || '무제';
  document.getElementById('divisionDetailRef').textContent = p.reference_number || '-';
  document.getElementById('divisionDetailType').innerHTML = '<span class="division-type-badge ' + t.css + '">' + t.icon + ' ' + t.label + '</span>';
  document.getElementById('divisionDetailStatus').innerHTML = '<span class="division-status-badge ' + s.css + '">' + s.label + '</span>';
  Division.renderPipeline(p);
  Division.renderMain(p);
};

// 현재 화면을 유지하면서 내용만 갱신 (유형 전환, 체크박스, 개수 변경 등)
Division.renderStay = function(){
  var p = Division.state.current; if(!p) return;
  var t = Division.TYPES[p.division_type] || { code:'?', label:'미정', css:'dtype-merge', icon:'❓' };
  var s = Division.STATUS[p.status] || { label:p.status, css:'dstatus-created' };
  document.getElementById('divisionDetailType').innerHTML = '<span class="division-type-badge ' + t.css + '">' + t.icon + ' ' + t.label + '</span>';
  document.getElementById('divisionDetailStatus').innerHTML = '<span class="division-status-badge ' + s.css + '">' + s.label + '</span>';
  Division.renderPipeline(p);
  // currentStepKey가 있으면 해당 화면 유지, 없으면 DB 상태 기준
  if(Division.state.currentStepKey){
    Division.renderMainForStep(p, Division.state.currentStepKey);
  } else {
    Division.renderMain(p);
  }
};

// ═══ 분할유형 전환 (파싱/분석 단계에서 변경 가능) ═══
Division._renderTypeSwitch = function(currentType){
  var h = '<div class="division-type-switch">';
  h += '<span style="font-size:12px;font-weight:600;color:var(--color-text-secondary);margin-right:8px">분할 유형:</span>';
  ['merge','category_change','strategic'].forEach(function(type){
    var info = Division.TYPES[type];
    var active = currentType === type;
    h += '<button class="division-type-switch-btn' + (active?' active':'') + '" onclick="Division.switchType(\'' + type + '\')">';
    h += info.icon + ' ' + info.label + '</button>';
  });
  h += '</div>';
  return h;
};

Division.switchType = async function(newType){
  var p = Division.state.current; if(!p) return;
  if(p.division_type === newType) return;
  var oldType = p.division_type;
  try {
    await sb.from('division_projects').update({ division_type:newType, updated_at:new Date().toISOString() }).eq('id', p.id);
    p.division_type = newType;
    showToast(Division.TYPES[newType].label + '로 변경됨');

    // 분석 단계 이후면 재분석 필요 안내
    var step = Division.STATUS_TO_STEP[p.status] || 0;
    if(step >= 2){ // analyzed 이상
      showToast('유형 변경 후 재분석을 권장합니다', 'info');
    }
    Division.renderStay(); // 현재 단계 유지
  } catch(e){ showToast('유형 변경 실패: ' + e.message, 'error'); p.division_type = oldType; }
};

// ═══════════════════════════════════════════
// 4. 파이프라인 스테퍼
// ═══════════════════════════════════════════
Division.renderPipeline = function(p){
  var el = document.getElementById('divisionPipeline'); if(!el) return;
  var currentStep = Division.STATUS_TO_STEP[p.status] || 0;
  var h = '';
  Division.PIPELINE.forEach(function(step, i){
    var st = i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending';
    var clickable = st === 'done' || st === 'active';
    if(i > 0) h += '<div class="division-step-connector ' + (i <= currentStep ? 'done' : '') + '"></div>';
    h += '<div class="division-step ' + st + '"'
      + (clickable ? ' onclick="Division.goToStep(\'' + step.key + '\')" style="cursor:pointer"' : '') + '>'
      + '<div class="division-step-dot">' + (st === 'done' ? '✓' : step.icon) + '</div>'
      + '<span class="division-step-label">' + step.label + '</span></div>';
  });
  el.innerHTML = h;
};

Division.goToStep = function(stepKey){
  var p = Division.state.current; if(!p) return;
  Division.state.currentStepKey = stepKey; // 현재 보고 있는 단계 추적
  Division.renderMainForStep(p, stepKey);
};

// ═══════════════════════════════════════════
// 5. 메인 콘텐츠 분기
// ═══════════════════════════════════════════
Division.renderMain = function(p){
  var step = Division.STATUS_TO_STEP[p.status] || 0;
  var keys = ['upload','parse','analyze','assemble','verify','confirm'];
  var targetKey = Division.state.currentStepKey || keys[step] || 'upload';
  Division.state.currentStepKey = targetKey; // 추적
  Division.renderMainForStep(p, targetKey);
};

Division.renderMainForStep = function(p, stepKey){
  var left = document.getElementById('divisionDetailLeft');
  var right = document.getElementById('divisionDetailRight');
  if(!left || !right) return;
  switch(stepKey){
    case 'upload':  Division.renderUpload(left, right, p); break;
    case 'parse':   Division.renderParse(left, right, p); break;
    case 'analyze': Division.renderAnalyze(left, right, p); break;
    case 'assemble':Division.renderAssemble(left, right, p); break;
    case 'verify':  Division.renderVerify(left, right, p); break;
    case 'confirm': Division.renderConfirm(left, right, p); break;
    default:        Division.renderUpload(left, right, p); break;
  }
};

// ═══════════════════════════════════════════
// 6. 화면: 파일 업로드 (드래그앤드롭 + 이중 모드)
// ═══════════════════════════════════════════
Division.renderUpload = function(left, right, p){
  var files = Division.state.files;
  var inputMode = p.input_mode || 'full';

  var h = '';

  // 모드 토글
  h += '<div class="division-mode-toggle">';
  h += '<button class="division-mode-btn' + (inputMode==='full'?' active':'') + '" onclick="Division.switchInputMode(\'full\')"><span class="tf">📋</span> 문서 업로드</button>';
  h += '<button class="division-mode-btn' + (inputMode==='direct'?' active':'') + '" onclick="Division.switchInputMode(\'direct\')"><span class="tf">✏️</span> 청구항 직접 입력</button>';
  h += '</div>';

  if(inputMode === 'full'){
    // ── 모드 A: 통합 드롭존 + 자동 분류 ──

    // 통합 드롭존 (여러 파일 한 번에)
    var allRequiredDone = ['application','notification','opinion','amendment'].every(function(ft){ return files.some(function(f){ return f.file_type===ft; }); });
    if(!allRequiredDone){
      h += '<div class="division-bulk-drop" id="divisionBulkDrop">';
      h += '<div class="division-bulk-drop-inner">';
      h += '<div style="font-size:32px;margin-bottom:8px"><span class="tf">📂</span></div>';
      h += '<div style="font-size:14px;font-weight:600;margin-bottom:4px">PDF 파일을 여기에 드래그하세요</div>';
      h += '<div style="font-size:12px;color:var(--color-text-tertiary)">출원서 · 통지서 · 의견서 · 보정서를 한번에 넣으면 자동 분류합니다</div>';
      h += '<div style="margin-top:12px"><label class="btn btn-outline btn-sm" style="cursor:pointer"><span class="tf">📄</span> 또는 파일 선택';
      h += '<input type="file" accept=".pdf" multiple style="display:none" onchange="Division.handleBulkFiles(event)" />';
      h += '</label></div>';
      h += '</div></div>';
    }

    // 분류된 파일 목록
    h += '<div class="card" style="padding:16px;' + (allRequiredDone ? '' : 'margin-top:12px') + '">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">📁</span> 파일 분류 결과</div>';

    ['application','notification','opinion','amendment','prior_art','decision'].forEach(function(ft){
      var info = Division.FILE_TYPES[ft];
      var uploaded = files.find(function(f){ return f.file_type === ft; });
      var isRequired = info.required;

      if(uploaded){
        h += '<div class="division-file-row-uploaded">';
        h += '<span class="division-file-icon">' + info.icon + '</span>';
        h += '<div class="division-file-info"><div class="division-file-label">' + info.label + (isRequired?' <span style="color:var(--color-error);font-size:10px">필수</span>':'') + '</div>';
        h += '<div class="division-file-name">' + escapeHtml(uploaded.file_name || '') + '</div></div>';
        // 유형 변경 드롭다운
        h += '<select class="division-role-select" onchange="Division.reclassifyFile(\'' + uploaded.id + '\',this.value)" style="font-size:11px">';
        ['application','notification','opinion','amendment','prior_art','decision'].forEach(function(opt){
          h += '<option value="' + opt + '"' + (opt===ft?' selected':'') + '>' + Division.FILE_TYPES[opt].label + '</option>';
        });
        h += '</select>';
        h += '<button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + uploaded.id + '\')" style="font-size:10px;color:var(--color-error);padding:4px 8px">✕</button>';
        h += '</div>';
      } else if(isRequired) {
        h += '<div class="division-file-row-missing">';
        h += '<span class="division-file-icon" style="opacity:0.4">' + info.icon + '</span>';
        h += '<span class="division-file-label" style="color:var(--color-text-tertiary)">' + info.label + ' <span style="color:var(--color-error);font-size:10px">필수</span></span>';
        h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px"><span class="tf">📄</span> 선택';
        h += '<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'' + ft + '\')" /></label>';
        h += '</div>';
      }
    });
    h += '</div>';

    // 분류 중 상태
    h += '<div id="divisionClassifyStatus" style="margin-top:8px"></div>';

  } else {
    // ── 모드 B: 출원서 + 직접 입력 ──
    h += '<div class="card" style="padding:16px">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:4px"><span class="tf">📄</span> 특허출원서</div>';
    h += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:12px">명세서 원문이 포함된 출원서 PDF</div>';
    var appFile = files.find(function(f){ return f.file_type === 'application'; });
    if(appFile){
      h += '<div class="division-file-row-uploaded"><span class="division-file-icon">📄</span>';
      h += '<div class="division-file-info"><div class="division-file-label">특허출원서</div><div class="division-file-name">' + escapeHtml(appFile.file_name||'') + '</div></div>';
      h += '<span class="division-file-check">✅</span>';
      h += '<button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + appFile.id + '\')" style="font-size:10px;color:var(--color-error);padding:4px 8px">✕</button></div>';
    } else {
      h += '<div class="division-bulk-drop" id="divisionBulkDrop" style="padding:20px">';
      h += '<div class="division-bulk-drop-inner"><span class="tf" style="font-size:24px">📄</span> <span style="font-size:13px">출원서 PDF 드래그 또는 </span>';
      h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px;margin-left:8px">선택<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'application\')" /></label>';
      h += '</div></div>';
    }
    h += '</div>';

    h += '<div class="card" style="padding:16px;margin-top:12px">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:4px"><span class="tf">✏️</span> 최종 등록 청구항</div>';
    h += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:12px">등록결정 시 확정된 청구항 전문을 붙여넣으세요.</div>';
    h += '<textarea class="textarea-field" id="divisionDirectClaims" rows="12" placeholder="【청구항 1】\n생두의 수분 함량을...\n\n【청구항 2】\n제1항에 있어서,\n..." style="font-size:13px;line-height:1.7">' + escapeHtml(p.direct_claims_text || '') + '</textarea>';
    h += '<button class="btn btn-outline btn-sm" onclick="Division.saveDirectClaims()" style="margin-top:8px"><span class="tf">💾</span> 저장</button>';
    h += '</div>';
  }

  // 선택 파일 (공통)
  h += '<div class="card" style="padding:16px;margin-top:12px">';
  h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">📎</span> 선택 파일</div>';
  h += '<label class="checkbox-label" style="margin-bottom:8px"><input type="checkbox" ' + (p.include_prior_art?'checked':'') + ' onchange="Division.togglePriorArt(this.checked)" /><span>인용발명 대비 분석 포함</span></label>';
  if(p.include_prior_art){
    var priorFile = files.find(function(f){ return f.file_type==='prior_art'; });
    h += '<div class="division-file-row" style="margin-left:20px"><span class="division-file-icon">📚</span><span class="division-file-label">인용발명 PDF</span>';
    if(priorFile){ h += '<span class="division-file-status uploaded">✅</span><button class="btn btn-ghost btn-sm" onclick="Division.removeFile(\'' + priorFile.id + '\')" style="font-size:10px;color:var(--color-error)">삭제</button>'; }
    else { h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;font-size:11px"><span class="tf">📄</span> 선택<input type="file" accept=".pdf" style="display:none" onchange="Division.uploadFile(event,\'prior_art\')" /></label>'; }
    h += '</div>';
  }
  h += '</div>';
  left.innerHTML = h;

  // 통합 드롭존 이벤트 바인딩
  setTimeout(function(){
    var bulkZone = document.getElementById('divisionBulkDrop');
    if(bulkZone){
      bulkZone.addEventListener('dragover', function(e){ e.preventDefault(); e.stopPropagation(); bulkZone.classList.add('dragover'); });
      bulkZone.addEventListener('dragleave', function(e){ e.preventDefault(); e.stopPropagation(); bulkZone.classList.remove('dragover'); });
      bulkZone.addEventListener('drop', function(e){ e.preventDefault(); e.stopPropagation(); bulkZone.classList.remove('dragover'); Division.handleBulkDrop(e); });
    }
  }, 0);

  // === 오른쪽: 안내 + 파싱 ===
  var canParse = false;
  if(inputMode==='full'){
    canParse = ['application','notification','opinion','amendment'].every(function(ft){ return files.some(function(f){ return f.file_type===ft; }); });
  } else {
    canParse = files.some(function(f){ return f.file_type==='application'; }) && !!(p.direct_claims_text && p.direct_claims_text.trim());
  }

  var rh = '<div class="card" style="padding:20px">';
  rh += '<div style="font-size:16px;font-weight:700;margin-bottom:12px"><span class="tf">🔀</span> 분할출원 청구항 자동 작성</div>';
  rh += '<div style="font-size:13px;line-height:1.7;color:var(--color-text-secondary);margin-bottom:16px">';
  rh += inputMode==='full' ? '원출원 문서를 업로드하면, AI가 자동 분류·파싱·분석하고<br>분할출원에 적합한 새 청구항을 조립합니다.'
    : '출원서와 최종 등록 청구항을 입력하면,<br>AI가 분할출원 청구항을 구성합니다.';
  rh += '</div>';
  rh += '<div class="division-info-box"><div style="font-weight:600;margin-bottom:8px">📋 처리 단계</div>';
  rh += '<div style="font-size:12px;line-height:1.8;color:var(--color-text-secondary)">① 파싱 — 출원서·청구항 구조화<br>② 분석 — 미활용 구성 탐색 + 리스크 스크리닝<br>③ 조립 — 독립항/종속항 자동 구성<br>④ 검증 — 기재불비 + 형식 검증<br>⑤ 확정 — 발명 명칭 + 최종 출력</div></div>';
  rh += '<div id="divisionProgress" style="margin-top:12px"></div>';
  if(canParse){
    rh += '<button class="btn btn-primary btn-full" id="btnDivisionParse" onclick="Division.runParse()" style="margin-top:16px;padding:14px;font-size:14px"><span class="tf">🔍</span> 파싱 시작</button>';
  } else {
    var uploadedTypes = files.map(function(f){ return f.file_type; });
    var missing = ['application','notification','opinion','amendment'].filter(function(ft){ return uploadedTypes.indexOf(ft)<0; });
    var missingLabels = missing.map(function(ft){ return Division.FILE_TYPES[ft].label; }).join(', ');
    var msg = inputMode==='full' ? '⚠️ 미업로드: ' + (missingLabels||'없음') : '⚠️ 출원서 업로드 + 청구항 입력 필요';
    rh += '<div style="margin-top:16px;padding:12px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);text-align:center;font-size:13px;color:var(--color-text-tertiary)">' + msg + '</div>';
  }
  rh += '</div>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 6-1. 입력 모드 전환 + 직접 입력 저장
// ═══════════════════════════════════════════
Division.switchInputMode = async function(mode){
  var p = Division.state.current; if(!p) return;
  p.input_mode = mode;
  await sb.from('division_projects').update({input_mode: mode}).eq('id', p.id);
  Division.renderStay();
};

Division.saveDirectClaims = async function(){
  var p = Division.state.current; if(!p) return;
  var text = (document.getElementById('divisionDirectClaims')?.value || '').trim();
  if(!text){ showToast('청구항 텍스트를 입력해 주세요', 'error'); return; }
  await sb.from('division_projects').update({direct_claims_text: text, updated_at: new Date().toISOString()}).eq('id', p.id);
  p.direct_claims_text = text;
  showToast('저장되었습니다');
  Division.renderStay();
};

// ═══════════════════════════════════════════
// 7. 자동 분류 + 파일 업로드
// ═══════════════════════════════════════════

// PDF 텍스트 패턴 기반 자동 분류
Division.CLASSIFY_RULES = [
  { type:'application',  patterns:[/【발명의\s*명칭】/, /【특허청구범위】/, /【발명의\s*상세한\s*설명】/, /【요약서】/, /【도면의\s*간단한\s*설명】/], minMatch:2 },
  { type:'notification', patterns:[/의견제출통지서/, /거절이유통지서/, /특허법\s*제63조/, /거절이유를?\s*아래와?\s*같이/, /진보성이?\s*부정/], minMatch:1 },
  { type:'amendment',    patterns:[/【보정대상항목】/, /보정서/, /【보정방법】/, /【보정내용】/], minMatch:1 },
  { type:'opinion',      patterns:[/【의견내용】/, /의견서\s*$/, /위\s*거절이유에?\s*대하여/, /아래와?\s*같이\s*의견/], minMatch:1 },
  { type:'decision',     patterns:[/등록결정/, /특허결정/, /설정등록/, /등록사정/], minMatch:1 },
  { type:'prior_art',    patterns:[/인용발명/, /선행기술/, /비교대상발명/], minMatch:1 }
];

Division._classifyPdf = function(text){
  if(!text || text.length < 50) return 'unknown';
  var snippet = text.substring(0, 5000); // 첫 5000자로 판별
  var scores = {};
  Division.CLASSIFY_RULES.forEach(function(rule){
    var matchCount = 0;
    rule.patterns.forEach(function(pat){ if(pat.test(snippet)) matchCount++; });
    if(matchCount >= rule.minMatch) scores[rule.type] = matchCount;
  });
  // 가장 높은 매치 반환
  var best = null, bestScore = 0;
  for(var k in scores){ if(scores[k] > bestScore){ bestScore = scores[k]; best = k; } }
  return best || 'unknown';
};

// 여러 파일 한번에 드롭
Division.handleBulkDrop = function(e){
  var fileList = e.dataTransfer ? e.dataTransfer.files : [];
  if(!fileList || !fileList.length) return;
  var pdfFiles = [];
  for(var i = 0; i < fileList.length; i++){
    if(fileList[i].name.toLowerCase().endsWith('.pdf')) pdfFiles.push(fileList[i]);
  }
  if(!pdfFiles.length){ showToast('PDF 파일만 업로드 가능합니다','error'); return; }
  Division._classifyAndUpload(pdfFiles);
};

// input[multiple]에서 선택
Division.handleBulkFiles = function(e){
  var fileList = e.target.files;
  if(!fileList || !fileList.length) return;
  var pdfFiles = [];
  for(var i = 0; i < fileList.length; i++){
    if(fileList[i].name.toLowerCase().endsWith('.pdf')) pdfFiles.push(fileList[i]);
  }
  if(!pdfFiles.length){ showToast('PDF 파일만 업로드 가능합니다','error'); return; }
  Division._classifyAndUpload(pdfFiles);
};

// 핵심: 분류 → 업로드 → 화면 갱신
Division._classifyAndUpload = async function(pdfFiles){
  var p = Division.state.current; if(!p) return;
  var statusEl = document.getElementById('divisionClassifyStatus');
  if(statusEl) statusEl.innerHTML = '<div style="padding:10px;text-align:center;font-size:13px;color:var(--color-primary)"><span class="tf">🔍</span> ' + pdfFiles.length + '개 파일 분류 중...</div>';

  var results = []; // {file, type, confidence}

  for(var i = 0; i < pdfFiles.length; i++){
    var file = pdfFiles[i];
    if(statusEl) statusEl.innerHTML = '<div style="padding:10px;text-align:center;font-size:13px;color:var(--color-primary)"><span class="tf">🔍</span> ' + (i+1) + '/' + pdfFiles.length + ' 분류 중: ' + escapeHtml(file.name) + '</div>';

    try {
      // PDF 텍스트 추출 (첫 몇 페이지)
      var buf = await file.arrayBuffer();
      var text = await App.extractPdfText(buf);
      var classified = Division._classifyPdf(text);

      // 이미 해당 유형이 있으면 다른 유형으로 대체 시도
      var existingTypes = Division.state.files.map(function(f){ return f.file_type; });
      var alreadyQueued = results.map(function(r){ return r.type; });
      var taken = existingTypes.concat(alreadyQueued);

      if(classified !== 'unknown' && taken.indexOf(classified) >= 0){
        // 해당 유형이 이미 점유 → 다른 빈 유형 찾기
        var fallbackOrder = ['application','notification','opinion','amendment','prior_art','decision'];
        var found = false;
        for(var j = 0; j < fallbackOrder.length; j++){
          if(taken.indexOf(fallbackOrder[j]) < 0){ classified = fallbackOrder[j]; found = true; break; }
        }
        if(!found) classified = 'prior_art'; // 모두 차면 인용발명으로
      }

      if(classified === 'unknown'){
        // 미분류 → 빈 필수 슬롯 중 첫 번째
        var emptyRequired = ['application','notification','opinion','amendment'].filter(function(ft){ return taken.indexOf(ft) < 0; });
        classified = emptyRequired[0] || 'prior_art';
      }

      results.push({ file:file, type:classified });
      console.log('[Division] 자동 분류:', file.name, '→', classified);
    } catch(e){
      console.warn('[Division] 분류 실패:', file.name, e);
      results.push({ file:file, type:'prior_art' }); // 실패하면 인용발명으로
    }
  }

  // 분류 결과 요약 토스트
  var summary = results.map(function(r){ return Division.FILE_TYPES[r.type].label; }).join(', ');
  showToast('분류 완료: ' + summary);

  // 순차 업로드
  for(var k = 0; k < results.length; k++){
    var r = results[k];
    if(statusEl) statusEl.innerHTML = '<div style="padding:10px;text-align:center;font-size:13px;color:var(--color-primary)"><span class="tf">📤</span> ' + (k+1) + '/' + results.length + ' 업로드 중: ' + escapeHtml(r.file.name) + '</div>';
    await Division._doUpload(r.file, r.type);
  }

  if(statusEl) statusEl.innerHTML = '';
  Division.renderStay();
};

// 파일 유형 재분류 (드롭다운 변경 시)
Division.reclassifyFile = async function(fileId, newType){
  try {
    await sb.from('division_files').update({file_type: newType}).eq('id', fileId);
    var file = Division.state.files.find(function(f){ return f.id === fileId; });
    if(file) file.file_type = newType;
    showToast(Division.FILE_TYPES[newType].label + '로 변경됨');
    Division.renderStay();
  } catch(e){ showToast('변경 실패','error'); }
};

// 개별 파일 업로드 (기존 호환)
Division.handleDragOver = function(e){ e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('dragover'); };
Division.handleDragLeave = function(e){ e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('dragover'); };
Division.handleDrop = function(e, fileType){ e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('dragover');
  var file = e.dataTransfer.files[0]; if(!file) return;
  if(!file.name.toLowerCase().endsWith('.pdf')){ showToast('PDF 파일만','error'); return; }
  Division._doUpload(file, fileType);
};
Division.uploadFile = async function(event, fileType){
  var file = event.target.files[0]; if(!file) return;
  if(!file.name.toLowerCase().endsWith('.pdf')){ showToast('PDF 파일만','error'); return; }
  Division._doUpload(file, fileType);
};

Division._doUpload = async function(file, fileType){
  var p = Division.state.current; if(!p) return;
  try {
    showToast('업로드 중...');
    var storagePath = 'division/' + p.id + '/' + fileType + '_' + Date.now() + '.pdf';
    var {error:uploadErr} = await sb.storage.from('division-files').upload(storagePath, file);
    if(uploadErr) throw uploadErr;
    var {data, error} = await sb.from('division_files').insert({ project_id:p.id, file_type:fileType, storage_path:storagePath, file_name:file.name, file_size:file.size }).select().single();
    if(error) throw error;
    Division.state.files.push(data);
    // 상태 전이: 입력 모드에 따라 필수 조건 다름
    var ready = false;
    if(p.input_mode === 'direct'){
      ready = Division.state.files.some(function(f){ return f.file_type==='application'; }) && !!(p.direct_claims_text && p.direct_claims_text.trim());
    } else {
      var requiredTypes = ['application','notification','opinion','amendment'];
      ready = requiredTypes.every(function(ft){ return Division.state.files.some(function(f){ return f.file_type === ft; }); });
    }
    if(ready && p.status === 'created'){
      await sb.from('division_projects').update({status:'uploaded', updated_at: new Date().toISOString()}).eq('id', p.id);
      p.status = 'uploaded';
    }
    showToast(Division.FILE_TYPES[fileType].label + ' 업로드 완료');
    Division.renderStay();
  } catch(e) { showToast('업로드 실패: ' + e.message, 'error'); }
};

Division.removeFile = async function(fileId){
  if(!confirm('파일을 삭제하시겠습니까?')) return;
  try {
    var file = Division.state.files.find(function(f){ return f.id === fileId; });
    if(file) await sb.storage.from('division-files').remove([file.storage_path]);
    await sb.from('division_files').delete().eq('id', fileId);
    Division.state.files = Division.state.files.filter(function(f){ return f.id !== fileId; });
    // 파싱 이후 상태에서 파일 삭제 시 상태 역전이 — uploaded로 리셋
    var p = Division.state.current;
    if(p && p.status !== 'created' && p.status !== 'uploaded'){
      await sb.from('division_projects').update({ status:'uploaded' }).eq('id', p.id);
      p.status = 'uploaded';
      // 파싱 결과도 초기화
      await sb.from('division_claims_parsed').delete().eq('project_id', p.id);
      await sb.from('division_spec_paragraphs').delete().eq('project_id', p.id);
      Division.state.claims = [];
      Division.state.specParagraphs = [];
    }
    showToast('파일 삭제됨'); Division.renderStay();
  } catch(e) { showToast('삭제 실패', 'error'); }
};

Division.togglePriorArt = async function(checked){
  var p = Division.state.current; if(!p) return;
  await sb.from('division_projects').update({include_prior_art: checked}).eq('id', p.id);
  p.include_prior_art = checked; Division.renderStay();
};

// ═══════════════════════════════════════════
// 8. Checkpoint 1: 파싱
// ═══════════════════════════════════════════
Division.runParse = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;
  try {
    App.setButtonLoading('btnDivisionParse', true);
    App.showProgress('divisionProgress', '파일 텍스트 추출 중...', 1, 5);
    var fileTexts = {};
    var files = Division.state.files;
    for(var i = 0; i < files.length; i++){
      var f = files[i];
      App.showProgress('divisionProgress', f.file_type + ' 텍스트 추출...', i+1, files.length + 3);
      try {
        var {data:blob, error:dlErr} = await sb.storage.from('division-files').download(f.storage_path);
        if(dlErr) throw dlErr;
        var buf = await blob.arrayBuffer();
        var text = await App.extractPdfText(buf);
        fileTexts[f.file_type] = text;
      } catch(e) { console.warn('[Division] 파일 추출 실패:', f.file_type, e); fileTexts[f.file_type] = ''; }
    }
    // 직접 입력 모드: direct_claims_text를 fileTexts에 주입
    if(p.input_mode === 'direct' && p.direct_claims_text){
      fileTexts._direct_claims = p.direct_claims_text;
    }
    App.showProgress('divisionProgress', 'AI 파싱 분석 중...', files.length + 1, files.length + 3);
    var parsePrompt = Division._buildParsePrompt(fileTexts, p);
    var result = await Division.callAI(parsePrompt);

    // 프로젝트 전환 감지
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 파싱 중 프로젝트 전환됨 — 결과 폐기'); App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return; }

    // 응답 잘림 감지
    if(result.stopReason === 'max_tokens'){
      console.warn('[Division] 파싱 응답이 max_tokens로 잘림. 응답 길이:', result.text.length);
      showToast('응답이 길어 잘렸습니다. 재시도 중...', 'info');
      // 잘린 경우: 텍스트 입력 축소 후 재시도
      var shorterPrompt = Division._buildParsePrompt(fileTexts, p, true); // shortened=true
      result = await Division.callAI(shorterPrompt);
    }

    App.showProgress('divisionProgress', '결과 저장 중...', files.length + 2, files.length + 3);
    var parsed;
    try { parsed = Division._extractJSON(result.text); }
    catch(e) {
      console.error('[Division] JSON 추출 실패:', e.message);
      showToast('파싱 결과 해석 실패: ' + e.message.substring(0, 80), 'error');
      App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return;
    }
    // ── 데이터 정제(sanitize) + DB 저장 ──
    var VALID_CLAIM_TYPE = ['independent','dependent'];
    var VALID_REJ = ['rejected','not_rejected'];
    var VALID_AMD = ['amended','deleted','maintained'];
    var VALID_ROLE = ['basis','merge_candidate','dep_candidate','excluded','included_in_basis','product_claim'];
    var sanitize = Division._sanitizeEnum;

    var claimsSaved = false;
    if(parsed.claims && parsed.claims.length > 0){
      // 1) 행 데이터 정제
      var claimRows = [];
      parsed.claims.forEach(function(c, idx){
        if(!c || !c.claim_number) return; // 빈 항목 무시
        claimRows.push({
          project_id: p.id,
          claim_number: parseInt(c.claim_number) || (idx+1),
          claim_type: sanitize(c.claim_type, VALID_CLAIM_TYPE, 'independent'),
          parent_claim_number: c.parent_claim_number ? parseInt(c.parent_claim_number) : null,
          original_text: String(c.original_text || c.text || '(파싱 실패)').substring(0, 50000),
          amended_text: c.amended_text ? String(c.amended_text).substring(0, 50000) : null,
          rejection_status: sanitize(c.rejection_status, VALID_REJ, 'not_rejected'),
          amendment_status: sanitize(c.amendment_status, VALID_AMD, 'maintained'),
          division_role: sanitize(c.division_role, VALID_ROLE, 'dep_candidate')
        });
      });

      // 2) 중복 claim_number 제거
      var seen = {};
      claimRows = claimRows.filter(function(r){ if(seen[r.claim_number]) return false; seen[r.claim_number]=true; return true; });

      // 3) 기초(basis) 자동 지정: 등록 청구항 = 독립항 중 가장 먼저 나오는 항
      //    보정서가 있으면 amended_text가 최종본, 없으면 original_text가 최종본
      var hasBasis = claimRows.some(function(r){ return r.division_role === 'basis'; });
      if(!hasBasis){
        // 독립항 중 첫 번째를 basis로 자동 지정
        for(var bi = 0; bi < claimRows.length; bi++){
          if(claimRows[bi].claim_type === 'independent'){
            claimRows[bi].division_role = 'basis';
            console.log('[Division] 기초 청구항 자동 지정: 제' + claimRows[bi].claim_number + '항');
            break;
          }
        }
      }

      console.log('[Division] 저장할 청구항:', claimRows.length, '건');
      console.log('[Division] 첫 행 샘플:', JSON.stringify(claimRows[0]).substring(0, 300));

      // 4) DB 저장 (배치 → 실패 시 행별 폴백)
      await sb.from('division_claims_parsed').delete().eq('project_id', p.id);
      var {error:batchErr} = await sb.from('division_claims_parsed').insert(claimRows);

      if(batchErr){
        console.warn('[Division] 배치 INSERT 실패, 행별 삽입 시도:', batchErr.message || batchErr.details);
        // 행별로 삽입 시도 — 실패한 행은 스킵
        var savedCount = 0;
        for(var ri = 0; ri < claimRows.length; ri++){
          var {error:rowErr} = await sb.from('division_claims_parsed').insert(claimRows[ri]);
          if(rowErr){
            console.error('[Division] 행 ' + ri + ' 실패:', rowErr.message || rowErr.details, '데이터:', JSON.stringify(claimRows[ri]).substring(0, 200));
          } else { savedCount++; }
        }
        if(savedCount === 0){
          showToast('청구항 DB 저장 전체 실패. 콘솔을 확인해 주세요.', 'error');
          App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return;
        }
        showToast(savedCount + '/' + claimRows.length + '건 저장 (일부 실패)', 'info');
        claimsSaved = true;
      } else {
        claimsSaved = true;
      }
    }

    // 단락 저장
    if(parsed.paragraphs && parsed.paragraphs.length > 0){
      await sb.from('division_spec_paragraphs').delete().eq('project_id', p.id);
      var paraRows = [];
      var seenPara = {};
      parsed.paragraphs.forEach(function(para){
        var num = String(para.number || para.paragraph_number || '0000').replace(/[^0-9]/g, '').substring(0, 10);
        if(!num || seenPara[num]) return;
        seenPara[num] = true;
        paraRows.push({ project_id: p.id, paragraph_number: num, content: String(para.content || '').substring(0, 50000) });
      });
      if(paraRows.length > 0){
        var {error:paraErr} = await sb.from('division_spec_paragraphs').insert(paraRows);
        if(paraErr) console.warn('[Division] 단락 저장 실패 (무시):', paraErr.message);
      }
    }

    if(!claimsSaved){
      showToast('파싱된 청구항이 없습니다. 문서를 확인해 주세요.', 'error');
      App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); return;
    }

    // T2: 명세서 전문(spec_full_text) 1회 저장 — 이후 분석·조립·검증에서 재사용
    var specFullText = fileTexts['application'] || fileTexts['specification'] || '';
    if(!specFullText){
      // 출원서 파일이 없으면 모든 파일 텍스트를 합산
      Object.keys(fileTexts).forEach(function(k){ if(k !== '_direct_claims' && fileTexts[k]) specFullText += fileTexts[k] + '\n'; });
    }
    if(specFullText){
      var {error:specErr} = await sb.from('division_projects').update({spec_full_text: specFullText}).eq('id', p.id);
      if(specErr) console.warn('[Division] spec_full_text 저장 실패 (무시):', specErr.message);
      else console.log('[Division] spec_full_text 저장 완료:', specFullText.length, '글자');
      p.spec_full_text = specFullText;
    }

    await sb.from('division_projects').update({status:'parsed', updated_at: new Date().toISOString()}).eq('id', p.id);
    p.status = 'parsed';
    App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false);
    showToast('파싱 완료! 결과를 확인해 주세요.');
    Division.state.currentStepKey = 'parse'; // 파싱 결과 화면으로 이동
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionProgress'); App.setButtonLoading('btnDivisionParse', false); showToast('파싱 실패: ' + e.message, 'error'); }
};

Division._buildParsePrompt = function(fileTexts, p, shortened){
  var appLimit = shortened ? 15000 : 30000;
  var notiLimit = shortened ? 5000 : 10000;
  var opnLimit = shortened ? 5000 : 10000;
  var amdLimit = shortened ? 8000 : 15000;
  var paraInstruction = shortened
    ? '6. 명세서 단락은 생략하라 (paragraphs: []). 청구항만 파싱.\n'
    : '6. 명세서 단락은 【NNNN】 패턴으로 분리. 단, content는 각 단락의 첫 200자만 포함.\n';

  // 직접 입력 모드
  if(p.input_mode === 'direct' && fileTexts._direct_claims){
    return '아래 한국 특허 출원서와 최종 등록 청구항을 분석하여 구조화된 JSON으로 파싱하라.\n\n[특허출원서 (명세서 포함)]\n' + (fileTexts.application || '(없음)').substring(0, appLimit) + '\n\n[최종 등록 청구항 (사용자 직접 입력)]\n' + fileTexts._direct_claims.substring(0, 15000) + '\n\n※ 이 건은 의견제출통지서 없이 등록결정된 건입니다. 모든 청구항은 거절 이력이 없습니다.\n\n★★★ 반드시 JSON만 출력하라. 설명·인사·마크다운 없이 { 로 시작하고 } 로 끝나는 순수 JSON만. ★★★\n\n출력 JSON 형식:\n{"claims":[{"claim_number":1,"claim_type":"independent|dependent","parent_claim_number":null,"original_text":"등록 청구항 원문","amended_text":null,"rejection_status":"not_rejected","amendment_status":"maintained","division_role":"basis|dep_candidate|product_claim"}],"paragraphs":[{"number":"0001","content":"단락 첫200자"}],"reference_symbols":[{"name":"장치하우징","number":"100"}],"warnings":[]}\n\n파싱 규칙:\n1. 【청구항 N】 패턴으로 청구항 분리\n2. "제N항에 있어서" → dependent, parent=N\n3. 거절 이력 없음 → 모든 rejection_status="not_rejected", amendment_status="maintained"\n4. 독립항 중 가장 넓은 범위를 가진 항 → basis\n5. 나머지 독립항 → product_claim 또는 dep_candidate\n6. 종속항 → dep_candidate\n' + paraInstruction;
  }

  // 전체 문서 업로드 모드
  return '아래 한국 특허 문서들을 분석하여 구조화된 JSON으로 파싱하라.\n\n[특허출원서]\n' + (fileTexts.application || '(없음)').substring(0, appLimit) + '\n\n[의견제출통지서]\n' + (fileTexts.notification || '(없음)').substring(0, notiLimit) + '\n\n[의견서]\n' + (fileTexts.opinion || '(없음)').substring(0, opnLimit) + '\n\n[보정서]\n' + (fileTexts.amendment || '(없음)').substring(0, amdLimit) + '\n\n★★★ 반드시 JSON만 출력하라. 설명·인사·마크다운 없이 { 로 시작하고 } 로 끝나는 순수 JSON만. ★★★\n\n출력 JSON 형식:\n{"claims":[{"claim_number":1,"claim_type":"independent|dependent","parent_claim_number":null,"original_text":"원문","amended_text":"보정후(정정된경우)","rejection_status":"rejected|not_rejected","amendment_status":"amended|deleted|maintained","division_role":"basis|merge_candidate|dep_candidate|excluded|included_in_basis|product_claim"}],"paragraphs":[{"number":"0001","content":"단락 첫200자"}],"reference_symbols":[{"name":"장치하우징","number":"100"}],"warnings":[]}\n\n파싱 규칙:\n1. 【청구항 N】 패턴으로 청구항 분리\n2. "제N항에 있어서" → dependent, parent=N\n3. 통지서에서 거절 대상 청구항 추출 → rejection_status\n4. 보정서에서 정정/삭제/유지 상태 추출 → amendment_status\n5. division_role 자동 분류: 거절+정정(병합포함)→basis, 미지적+유지→merge_candidate, 거절+유지→dep_candidate, 삭제(다른항병합)→included_in_basis\n' + paraInstruction + '7. 구성요소명(참조번호) 패턴 추출';
};

// ═══════════════════════════════════════════
// 9. Checkpoint 1 화면: 파싱 결과
// ═══════════════════════════════════════════
Division.renderParse = function(left, right, p){
  var claims = Division.state.claims;

  // === 왼쪽: 청구항 분류 매트릭스 + 등록 청구항 전문 ===
  var h = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">📊</span> 청구항 분류 매트릭스</div>';
  if(claims.length === 0){ h += '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">파싱된 청구항이 없습니다.</div>'; }
  else {
    h += '<table class="division-matrix-table"><thead><tr><th>청구항</th><th>거절</th><th>보정</th><th>분할 역할</th></tr></thead><tbody>';
    claims.forEach(function(c){
      var rejLabel = c.rejection_status==='rejected'?'거절':'미지적';
      var rejCss = c.rejection_status==='rejected'?'rej-yes':'rej-no';
      var amdLabel = c.amendment_status==='amended'?'정정':c.amendment_status==='deleted'?'삭제':'유지';
      var amdCss = c.amendment_status==='amended'?'amd-amended':c.amendment_status==='deleted'?'amd-deleted':'amd-maintained';
      var roleLabels = {basis:'기초',merge_candidate:'병합 후보',dep_candidate:'종속항 후보',excluded:'제외',included_in_basis:'기초에 포함됨',product_claim:'물건항 후보'};
      h += '<tr' + (c.amendment_status==='deleted'?' style="opacity:0.5"':'') + '><td style="font-weight:600">제' + c.claim_number + '항</td>';
      h += '<td><span class="division-rej-badge ' + rejCss + '">' + rejLabel + '</span></td>';
      h += '<td><span class="division-amd-badge ' + amdCss + '">' + amdLabel + '</span></td>';
      h += '<td><select class="division-role-select" data-claim-id="' + c.id + '" onchange="Division.updateClaimRole(this)">';
      ['basis','merge_candidate','dep_candidate','excluded','included_in_basis','product_claim'].forEach(function(role){
        h += '<option value="' + role + '"' + (c.division_role===role?' selected':'') + '>' + (roleLabels[role]||role) + '</option>';
      });
      h += '</select></td></tr>';
    });
    h += '</tbody></table>';
  }
  h += '</div>';

  // 등록 청구항 전문 (삭제 제외, 전체 표시)
  var activeClaims = claims.filter(function(c){ return c.amendment_status !== 'deleted'; });
  if(activeClaims.length > 0){
    h += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">📜</span> 최종 등록 청구항 전문 <span style="font-size:11px;font-weight:400;color:var(--color-text-tertiary)">(삭제항 제외 ' + activeClaims.length + '항)</span></div>';
    activeClaims.forEach(function(c, idx){
      var registeredText = c.amended_text || c.original_text || '';
      var isBasis = c.division_role === 'basis';
      var source = c.amended_text ? '보정' : '원문';
      var roleLabels = {basis:'기초',merge_candidate:'병합후보',dep_candidate:'종속후보',excluded:'제외',included_in_basis:'기초포함',product_claim:'물건항'};

      h += '<div class="division-registered-claim' + (isBasis ? ' expanded' : '') + '" id="regClaim_' + idx + '">';
      h += '<div class="claim-header" onclick="document.getElementById(\'regClaim_'+idx+'\').classList.toggle(\'expanded\')">';
      h += '<span style="font-weight:700;color:' + (isBasis?'var(--color-primary)':'var(--color-text-primary)') + '">【청구항 ' + c.claim_number + '】</span>';
      h += '<span class="division-amd-badge amd-' + (c.amendment_status||'maintained') + '">' + source + '</span>';
      if(isBasis) h += '<span style="font-size:10px;padding:1px 6px;border-radius:var(--radius-full);background:var(--color-primary-light);color:var(--color-primary);font-weight:600">★ 기초</span>';
      else h += '<span style="font-size:10px;color:var(--color-text-tertiary)">' + (roleLabels[c.division_role]||'') + '</span>';
      h += '<span style="margin-left:auto;font-size:11px;color:var(--color-text-tertiary)">▼</span>';
      h += '</div>';
      h += '<div class="claim-text">' + escapeHtml(Division._formatClaimText(registeredText)) + '</div>';
      if(registeredText.length > 100) h += '<span class="claim-toggle" onclick="document.getElementById(\'regClaim_'+idx+'\').classList.toggle(\'expanded\')">▼ 전문 보기 / 접기</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  left.innerHTML = h;

  // === 오른쪽: 기초 청구항 요약 + 승인 버튼 ===
  var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
  if(!basisClaim) basisClaim = claims.find(function(c){ return c.claim_type==='independent'; });

  var rh = Division._renderTypeSwitch(p.division_type);
  rh += '<div class="card" style="padding:16px">';
  rh += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">⭐</span> 분할출원 기초 청구항</div>';
  if(basisClaim){
    var regText = basisClaim.amended_text || basisClaim.original_text || '';
    rh += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:8px">제' + basisClaim.claim_number + '항 | ' + (basisClaim.amended_text ? '보정 후 확정본' : '원출원 그대로') + '</div>';
    rh += '<div style="background:var(--color-bg-tertiary);padding:12px;border-radius:var(--radius-sm);font-size:13px;line-height:1.8;white-space:pre-wrap;max-height:250px;overflow-y:auto">' + escapeHtml(Division._formatClaimText(regText)) + '</div>';
  } else {
    rh += '<div style="text-align:center;padding:16px;color:var(--color-text-tertiary)">독립항이 파싱되지 않았습니다.</div>';
  }
  rh += '</div>';

  // 파싱 요약 통계
  var statCounts = { total:claims.length, deleted:claims.filter(function(c){return c.amendment_status==='deleted';}).length, amended:claims.filter(function(c){return c.amendment_status==='amended';}).length, basis:claims.filter(function(c){return c.division_role==='basis';}).length };
  rh += '<div class="card" style="padding:14px;margin-top:12px"><div style="font-size:13px;line-height:1.8;color:var(--color-text-secondary)">';
  rh += '전체 청구항: <strong>' + statCounts.total + '</strong>항<br>';
  rh += '정정(보정): <strong>' + statCounts.amended + '</strong>항 | 삭제: <strong>' + statCounts.deleted + '</strong>항<br>';
  rh += '기초 청구항: <strong>' + statCounts.basis + '</strong>항';
  rh += '</div></div>';

  rh += '<div style="display:flex;gap:8px;margin-top:12px">';
  rh += '<button class="btn btn-ghost" onclick="Division.rerunParse()" style="flex:1;padding:12px"><span class="tf">🔄</span> 재파싱</button>';
  rh += '<button class="btn btn-primary" onclick="Division.confirmParse()" style="flex:1;padding:12px"><span class="tf">✅</span> 파싱 승인 → 분석</button></div>';
  rh += '<div style="margin-top:8px;padding:10px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);font-size:12px;color:var(--color-text-tertiary)">⚠️ 파싱 결과가 정확한지 확인 후 승인을 눌러주세요. 역할은 드롭다운으로 수정 가능합니다.</div>';
  right.innerHTML = rh;
};

Division.updateClaimRole = async function(sel){
  var id = sel.dataset.claimId, role = sel.value;
  try { await sb.from('division_claims_parsed').update({division_role:role}).eq('id',id);
    var c = Division.state.claims.find(function(x){return x.id===id;}); if(c) c.division_role=role;
    Division.renderStay();
  } catch(e) { showToast('역할 변경 실패','error'); }
};
Division.confirmParse = async function(){
  var p = Division.state.current; if(!p) return;
  var claims = Division.state.claims;
  if(!claims || claims.length === 0){
    showToast('파싱된 청구항이 없습니다. 먼저 파싱을 실행해 주세요.', 'error'); return;
  }
  // 기초(basis) 미지정 시 자동 지정
  var hasBasis = claims.some(function(c){ return c.division_role === 'basis'; });
  if(!hasBasis){
    var firstIndep = claims.find(function(c){ return c.claim_type === 'independent'; });
    if(firstIndep){
      await sb.from('division_claims_parsed').update({division_role:'basis'}).eq('id', firstIndep.id);
      firstIndep.division_role = 'basis';
      showToast('제' + firstIndep.claim_number + '항을 기초 청구항으로 자동 지정했습니다.', 'info');
    }
  }
  showToast('파싱 승인 완료. 분석을 시작합니다.');
  Division.runAnalyze();
};
Division.rerunParse = function(){
  Division.state.currentStepKey = 'upload';
  Division.renderStay();
};

// ═══════════════════════════════════════════
// 10. Checkpoint 2: 분석
// ═══════════════════════════════════════════
Division.runAnalyze = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;
  var right = document.getElementById('divisionDetailRight');
  right.innerHTML = '<div class="card" style="padding:20px;text-align:center"><div style="font-size:32px;margin-bottom:12px"><span class="tf">🔍</span></div><div style="font-size:14px;font-weight:600;margin-bottom:8px">분석 진행 중...</div><div id="divisionAnalyzeProgress"></div></div>';
  try {
    App.showProgress('divisionAnalyzeProgress','구성요소 분해 중...',1,4);
    var {data:paragraphs} = await sb.from('division_spec_paragraphs').select('*').eq('project_id',p.id).order('paragraph_number');
    Division.state.specParagraphs = paragraphs || [];
    var claims = Division.state.claims;
    var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
    if(!basisClaim){
      // 폴백: 독립항 중 첫 번째를 basis로 사용
      basisClaim = claims.find(function(c){ return c.claim_type==='independent'; });
    }
    if(!basisClaim){
      showToast('독립항을 찾을 수 없습니다. 청구항을 확인해 주세요.','error'); return;
    }
    App.showProgress('divisionAnalyzeProgress','미활용 구성 탐색 중...',2,4);
    // T2: spec_full_text 우선 사용, 없으면 DB 단락 폴백
    var specText = p.spec_full_text || '';
    if(!specText || specText.length < 500){
      try {
        var {data:projSpec} = await sb.from('division_projects').select('spec_full_text').eq('id', p.id).single();
        specText = (projSpec && projSpec.spec_full_text) || '';
        if(specText) p.spec_full_text = specText;
      } catch(e){ console.warn('[Division] spec_full_text 조회 실패 (컬럼 미존재?):', e.message); }
    }
    if(!specText || specText.length < 500){
      specText = (paragraphs||[]).map(function(para){ return '【'+para.paragraph_number+'】 '+para.content; }).join('\n');
    }
    var excludedClaims = claims.filter(function(c){ return c.division_role==='excluded'; });
    var excludedText = excludedClaims.map(function(c){ return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text); }).join('\n');
    var analyzePrompt = Division._buildAnalyzePrompt(basisClaim, specText, excludedText, claims);

    // 디버그: 분석 입력 상태 로깅
    console.log('[Division] ── 분석 프롬프트 디버그 ──');
    console.log('[Division] specText 출처:', p.spec_full_text ? 'spec_full_text (DB)' : (paragraphs && paragraphs.length ? 'DB 단락 폴백' : '없음'));
    console.log('[Division] specText 길이:', specText.length, '글자');
    console.log('[Division] specText 앞 300자:', specText.substring(0, 300));
    console.log('[Division] basisClaim:', basisClaim.claim_number, '— 길이:', (basisClaim.amended_text||basisClaim.original_text||'').length);
    console.log('[Division] 전체 청구항:', claims.length, '건, 제외:', excludedClaims.length, '건');
    console.log('[Division] 분석 프롬프트 전체 길이:', analyzePrompt.length, '글자');
    console.log('[Division] 프롬프트 앞 500자:', analyzePrompt.substring(0, 500));

    var result = await Division.callAI(analyzePrompt);
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 분석 중 프로젝트 전환됨 — 결과 폐기'); App.clearProgress('divisionAnalyzeProgress'); return; }

    // 디버그: LLM 응답 로깅
    console.log('[Division] ── LLM 응답 디버그 ──');
    console.log('[Division] 응답 전체 길이:', result.text ? result.text.length : 0, '글자');
    console.log('[Division] stopReason:', result.stopReason);
    console.log('[Division] 응답 앞 1000자:', (result.text||'').substring(0, 1000));

    App.showProgress('divisionAnalyzeProgress','결과 저장 중...',3,4);
    var analyzed;
    try { analyzed = Division._extractJSON(result.text); }
    catch(e) { showToast('분석 결과 해석 실패: ' + e.message.substring(0,80),'error'); return; }

    // 디버그: 파싱된 JSON 구조 로깅
    console.log('[Division] ── 파싱 결과 디버그 ──');
    console.log('[Division] 파싱된 키:', Object.keys(analyzed));
    console.log('[Division] unused_components 수:', analyzed.unused_components ? analyzed.unused_components.length : '키 없음');
    if(analyzed.unused_components && analyzed.unused_components.length > 0){
      console.log('[Division] 첫 번째 구성 샘플:', JSON.stringify(analyzed.unused_components[0]).substring(0, 500));
    } else {
      console.log('[Division] ⚠️ unused_components가 비어 있음! 전체 파싱 결과:', JSON.stringify(analyzed).substring(0, 2000));
    }
    if(analyzed.themes) console.log('[Division] themes 수:', analyzed.themes.length);

    // unused_components 저장 (enum 정제)
    var VALID_LIM = ['structural','material','shape','arrangement','functional'];
    var VALID_RISK = ['safe','caution','danger'];
    var sEnum = Division._sanitizeEnum;

    // T8: 코드 레벨 교차 검증 자동 실행 — LLM 결과를 기존 청구항·명세서와 대조
    if(analyzed.unused_components && analyzed.unused_components.length > 0){
      var crossVerifySpec = p.spec_full_text || specText || '';
      analyzed.unused_components = Division.validateUnusedComponents(analyzed.unused_components, claims, crossVerifySpec);
      console.log('[Division] T8 교차검증 완료:', analyzed.unused_components.length, '건');
    }

    await sb.from('division_unused_components').delete().eq('project_id',p.id);
    if(analyzed.unused_components && analyzed.unused_components.length > 0){
      var compRows = analyzed.unused_components.map(function(uc){
        // risk_flags: 배열이 아니면 빈 배열로
        var flags = uc.risk_flags;
        if(!Array.isArray(flags)) flags = flags ? [String(flags)] : [];
        var row = {
          project_id: p.id,
          paragraph_number: String(uc.paragraph_number||'0000').substring(0,20),
          content: String(uc.content||'').substring(0,50000),
          related_element: String(uc.related_element||'').substring(0,200),
          limitation_type: sEnum(uc.limitation_type, VALID_LIM, 'functional'),
          risk_level: sEnum(uc.risk_level, VALID_RISK, 'safe'),
          risk_flags: flags, // JSONB — 배열 직접 전달 (stringify 금지)
          insertion_point: String(uc.insertion_point||'').substring(0,5000),
          suggestion: String(uc.suggestion||'').substring(0,5000),
          user_selection: 'pending'
        };
        // T4/T8 메타데이터는 메모리에만 보관 (UI 렌더링용)
        row._meta = {
          spec_source_text: String(uc.spec_source_text||'').substring(0,5000),
          overlap_warning: !!uc.overlap_warning,
          overlap_detail: String(uc.overlap_detail||'').substring(0,500),
          registration_strategy: String(uc.registration_strategy||'').substring(0,2000)
        };
        return row;
      });
      // _meta → DB component_data 저장 시도, 실패 시 메모리 폴백
      var metaMap = {};
      compRows.forEach(function(r){ metaMap[r.paragraph_number + ':' + (r.content||'').substring(0,50)] = r._meta; });

      // 1차: component_data 포함 INSERT 시도
      var dbRows = compRows.map(function(r){
        var copy = {}; Object.keys(r).forEach(function(k){ if(k !== '_meta') copy[k] = r[k]; });
        copy.component_data = r._meta || {};
        return copy;
      });
      var {error:compErr} = await sb.from('division_unused_components').insert(dbRows);
      if(compErr && compErr.message && compErr.message.indexOf('component_data') >= 0){
        // component_data 컬럼 미존재 → 제거 후 재시도
        console.warn('[Division] component_data 컬럼 없음, 제거 후 재시도');
        var fallbackRows = dbRows.map(function(r){ var c={}; Object.keys(r).forEach(function(k){if(k!=='component_data')c[k]=r[k];}); return c; });
        var {error:compErr2} = await sb.from('division_unused_components').insert(fallbackRows);
        if(compErr2){
          console.error('[Division] 미활용 구성 저장 실패:', compErr2.message||compErr2.details);
          var saved=0;
          for(var ci=0;ci<fallbackRows.length;ci++){
            var {error:re}=await sb.from('division_unused_components').insert(fallbackRows[ci]);
            if(re) console.warn('[Division] 구성 행 '+ci+' 실패:', re.message);
            else saved++;
          }
          if(saved>0) console.log('[Division] 미활용 구성 '+saved+'/'+fallbackRows.length+'건 저장');
        }
      } else if(compErr){
        console.error('[Division] 미활용 구성 저장 실패:', compErr.message||compErr.details);
        var saved=0;
        for(var ci=0;ci<dbRows.length;ci++){
          var {error:re}=await sb.from('division_unused_components').insert(dbRows[ci]);
          if(re) console.warn('[Division] 구성 행 '+ci+' 실패:', re.message);
          else saved++;
        }
        if(saved>0) console.log('[Division] 미활용 구성 '+saved+'/'+dbRows.length+'건 저장');
      }
      // 메모리에도 보관 (UI 렌더링 폴백)
      Division.state._componentMeta = metaMap;
    }

    // 프로젝트 상태 + analysis_meta 저장
    var projUpdate = { status:'analyzed', updated_at:new Date().toISOString() };
    // analysis_meta는 컬럼이 없을 수 있으므로 별도 시도
    var metaData = analyzed.themes ? {themes:analyzed.themes} : analyzed.original_category ? {original_category:analyzed.original_category, target_category:analyzed.target_category} : null;

    var {error:projErr} = await sb.from('division_projects').update(projUpdate).eq('id',p.id);
    if(projErr){ console.error('[Division] 프로젝트 상태 업데이트 실패:', projErr.message); }

    if(metaData){
      var {error:metaErr} = await sb.from('division_projects').update({analysis_meta:metaData}).eq('id',p.id);
      if(metaErr){
        console.warn('[Division] analysis_meta 저장 실패 (컬럼 미존재?):', metaErr.message);
        // 메모리에는 유지
      }
      p.analysis_meta = metaData;
    }
    p.status = 'analyzed';
    App.clearProgress('divisionAnalyzeProgress');
    var toastMsg = p.division_type==='strategic' ? '분석 완료! 테마를 선택해 주세요.' : p.division_type==='category_change' ? '분석 완료! 변환 구성을 확인해 주세요.' : '분석 완료! 부가 구성을 선택해 주세요.';
    showToast(toastMsg);
    Division.state.currentStepKey = 'analyze'; // 분석 결과 화면으로 이동
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionAnalyzeProgress'); showToast('분석 실패: '+e.message,'error'); }
};

// ═══ T7: 코드 레벨 교차 검증 — LCS 유사도 + 키워드 기반 ═══
Division._lcsTokens = function(a, b){
  // LCS (Longest Common Subsequence) of token arrays
  var m = a.length, n = b.length;
  if(m === 0 || n === 0) return [];
  // 메모리 최적화: 2행만 유지
  var prev = new Array(n+1).fill(0), curr = new Array(n+1).fill(0);
  for(var i = 1; i <= m; i++){
    for(var j = 1; j <= n; j++){
      if(a[i-1] === b[j-1]) curr[j] = prev[j-1] + 1;
      else curr[j] = Math.max(prev[j], curr[j-1]);
    }
    var tmp = prev; prev = curr; curr = tmp;
    curr.fill(0);
  }
  // backtrack 생략 — 길이만 반환
  return { length: prev[n] };
};

Division._lcsRatio = function(a, b){
  if(!a || !b) return 0;
  var tokA = a.replace(/[^가-힣a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean);
  var tokB = b.replace(/[^가-힣a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean);
  if(!tokA.length || !tokB.length) return 0;
  var lcsLen = Division._lcsTokens(tokA, tokB).length;
  return lcsLen / Math.max(tokA.length, tokB.length);
};

/**
 * T7: 분석 결과 교차 검증 — LLM 출력의 unused_components를 기존 청구항과 대조
 * @param {Array} components - LLM이 추출한 unused_components
 * @param {Array} allClaims - 원출원 전체 청구항
 * @param {string} specFullText - 명세서 전문
 * @returns {Array} 검증된 components (overlap_warning, risk_level 보정 적용)
 */
Division.validateUnusedComponents = function(components, allClaims, specFullText){
  if(!components || !components.length) return components;
  var stopwords = Division.STOPWORDS;

  components.forEach(function(comp){
    // [검증 1] 기존 청구항과 유사도 검사 → overlap_warning
    var maxSim = 0, overlapClaim = null;
    allClaims.forEach(function(c){
      var cText = c.amended_text || c.original_text || '';
      var sim = Division._lcsRatio(comp.content || '', cText);
      if(sim > maxSim){ maxSim = sim; overlapClaim = c.claim_number; }
    });
    if(maxSim > 0.7){
      comp.overlap_warning = true;
      comp.overlap_detail = '기존 청구항 ' + overlapClaim + '에 ' + Math.round(maxSim*100) + '% 유사 구성';
      if(!Array.isArray(comp.risk_flags)) comp.risk_flags = [];
      if(comp.risk_flags.indexOf('이중특허 위험') < 0) comp.risk_flags.push('이중특허 위험');
    } else {
      if(comp.overlap_warning === undefined) comp.overlap_warning = false;
    }

    // [검증 2] 명세서 키워드 존재 검사 → 신규사항 위험 감지
    if(specFullText && comp.content){
      var keywords = (comp.content.match(/[가-힣]{2,}/g) || []);
      var meaningful = keywords.filter(function(kw){ return stopwords.indexOf(kw) < 0 && kw.length >= 3; });
      var missing = meaningful.filter(function(kw){ return specFullText.indexOf(kw) < 0; });
      if(missing.length > 2){
        // 명세서 미발견 키워드 다수 → risk_level 상향
        if(comp.risk_level === 'safe') comp.risk_level = 'caution';
        if(!Array.isArray(comp.risk_flags)) comp.risk_flags = [];
        if(comp.risk_flags.indexOf('신규사항 위험') < 0) comp.risk_flags.push('신규사항 위험');
        console.log('[Division] 교차검증 — 미발견 키워드:', missing.join(', '), '→ risk 상향');
      }
    }

    // [검증 3] spec_source_text 존재 확인 — 없으면 risk 상향
    if(!comp.spec_source_text || comp.spec_source_text.length < 5){
      if(comp.risk_level === 'safe') comp.risk_level = 'caution';
      if(!Array.isArray(comp.risk_flags)) comp.risk_flags = [];
      if(comp.risk_flags.indexOf('명세서 원문 인용 없음') < 0) comp.risk_flags.push('명세서 원문 인용 없음');
    }
  });

  return components;
};

Division._buildAnalyzePrompt = function(basisClaim, specText, excludedText, allClaims){
  var basisText = basisClaim ? (basisClaim.amended_text||basisClaim.original_text||'') : '(기초 청구항 없음)';
  var allClaimsText = allClaims.map(function(c){ return '제'+c.claim_number+'항: '+((c.amended_text||c.original_text||'').substring(0,500)); }).join('\n');
  var p = Division.state.current;
  var divType = p ? p.division_type : 'merge';

  // T3: 공통 원칙 주입 + 공통 입력 데이터 블록
  var principles = Division.DIVISION_PRINCIPLES;
  var inputBlock = '\n\n[등록 청구항 (basis)]\n'+basisText+'\n\n[전체 청구항]\n'+allClaimsText+'\n\n[명세서 전문]\n'+specText.substring(0,40000);

  // T3: 공통 출력 스키마 — spec_source_text, overlap_warning 필드 추가
  var commonOutputFields = '"paragraph_number":"0098","content":"구성 내용","related_element":"원 구성요소명",' +
    '"limitation_type":"structural|material|shape|arrangement|functional",' +
    '"risk_level":"safe|caution|danger","risk_flags":[],' +
    '"insertion_point":"삽입 위치 설명","suggestion":"예상 기재 형태",' +
    '"spec_source_text":"명세서 원문 인용 (해당 단락에서 직접 발췌한 문장)",' +
    '"overlap_warning":false,"overlap_detail":"","registration_strategy":"바로 등록 전략 근거"';

  // T5: 카테고리변경형
  if(divType === 'category_change'){
    return principles +
      '\n\n이것은 "카테고리 변경형" 분할출원이다.\n' +
      '목적: 등록 청구항의 기술적 내용(A+B+C)을 보존하면서, 방법↔장치 카테고리를\n' +
      '전환하고, 명세서 기재 사항 내에서 변환에 필요한 구성을 추출한다.\n' +
      '방향: 변환 시 명세서에 없는 구성요소명(~부, ~수단 등)을 임의 생성하지 마라.\n' +
      '      명세서에 명시적으로 기재된 구성요소명만 사용하라.\n' +
      inputBlock +
      '\n\n분석 규칙:\n' +
      '1. 등록 청구항이 "방법" 청구항인지 "장치" 청구항인지 판별\n' +
      '2. 방법 청구항이면 → 장치 청구항으로 변환할 구성요소 매핑 도출\n' +
      '   - 각 방법 단계를 수행하는 구성요소를 명세서에서 찾아라\n' +
      '   - ★ 명세서에 "~부","~모듈","~수단"이 없으면 임의로 생성하지 마라\n' +
      '   - 명세서에서 해당 구성요소의 구조적 뒷받침 단락 매핑\n' +
      '3. 장치 청구항이면 → 방법 청구항으로 변환할 단계 매핑 도출\n' +
      '   - 각 구성요소가 수행하는 동작/기능을 "~하는 단계" 형태로 변환\n' +
      '4. 변환 시 명세서 뒷받침 존재 여부 확인\n' +
      '5. 리스크 평가: 변환이 자연스러운지, 추상적 표현이 발생하는지\n' +
      '6. ★★★ 각 구성에 spec_source_text(명세서 원문 직접 인용)를 반드시 포함하라\n' +
      '7. ★★★ 변환된 구성요소명이 명세서에 실제 기재되어 있는지 확인하라\n' +
      '\n출력 JSON:\n{"original_category":"method|apparatus","target_category":"apparatus|method",' +
      '"unused_components":[{' + commonOutputFields + '}]}\n\nJSON만 출력하라.';
  }

  // T6: 전략형
  if(divType === 'strategic'){
    return principles +
      '\n\n이것은 "전략형" 분할출원이다.\n' +
      '목적: 등록 청구항과 다른 관점의 새로운 독립항을 명세서 범위 내에서 작성한다.\n' +
      '방향: 신규사항 추가 위험이 가장 높은 유형이다.\n' +
      '      각 테마의 핵심 구성은 반드시 명세서 단락번호와 1:1 대응이 있어야 한다.\n' +
      '      명세서에 단 한 문장도 근거가 없는 테마는 제안하지 마라.\n' +
      '      출력의 모든 구성에 spec_source_text(명세서 원문 인용)를 반드시 포함하라.\n' +
      inputBlock +
      '\n\n[제외 대상 청구항]\n'+(excludedText||'(없음)') +
      '\n\n분석 규칙:\n' +
      '1. 명세서에서 기존 청구항과 다른 관점/테마의 발명 개념을 식별\n' +
      '2. 각 테마에 대해:\n' +
      '   - 독립항을 구성할 수 있는 핵심 구성요소 나열\n' +
      '   - 명세서 뒷받침 단락 매핑 (★ 1개 이상 필수)\n' +
      '   - 기존 등록 청구항과의 차별점\n' +
      '   - 등록 가능성 평가 (safe/caution/danger)\n' +
      '3. ★★★ spec_paragraphs가 빈 테마는 절대 제안하지 마라\n' +
      '4. 각 테마의 구성요소가 명세서에 충분히 뒷받침되는지 확인\n' +
      '\n출력 JSON:\n{"themes":[{"theme_id":"T1","theme_name":"테마명","description":"테마 설명",' +
      '"key_elements":["구성요소1","구성요소2"],"spec_paragraphs":["0098","0102"],' +
      '"differentiation":"기존 청구항과의 차별점","risk_level":"safe|caution|danger","risk_flags":[]}],' +
      '"unused_components":[{' + commonOutputFields + '}]}\n\nJSON만 출력하라.';
  }

  // T4: 병합형 (기본) — 기존 등록 청구항을 구체화/한정/부가하는 구성만 탐색
  return principles +
    '\n\n이것은 "병합형" 분할출원이다.\n' +
    '목적: 등록 청구항(A+B+C)을 그대로 유지하면서, 명세서에만 있고 기존 어떤\n' +
    '청구항에도 없었던 구성(D)을 추가하여 A+B+C+D로 출원한다.\n' +
    '방향: 구체화·한정·부가만 허용. 카테고리 변경 제안 절대 금지.\n' +
    inputBlock +
    '\n\n[제외 대상 (삭제된 청구항)]\n'+(excludedText||'(없음)') +
    '\n\n추출 규칙:\n' +
    '1. 등록 청구항의 각 구성요소에 대해, 명세서에서 해당 구성요소를 더 구체적으로 설명하는 내용을 찾아라\n' +
    '   예: "장치 하우징" → 명세서에 "원통 형상의 장치 하우징"이라 기재 → content:"원통 형상의", insertion_point:"장치 하우징 앞에 형용구 삽입"\n' +
    '2. 명세서에 기재되어 있지만 어떤 청구항에도 포함되지 않은 구조적 구성을 추출\n' +
    '3. 기존 종속항(미지적 항)의 내용 중 독립항에 병합 가능한 한정 사항\n' +
    '4. limitation_type 분류:\n' +
    '   - structural: 형상·구조 한정 (가장 안전, 우선 추출)\n' +
    '   - material: 재질·소재 한정\n' +
    '   - shape: 형태·치수 한정\n' +
    '   - arrangement: 배치·위치 관계 한정\n' +
    '   - functional: 기능·동작 한정 (기능적 기재 위험 주의)\n' +
    '5. risk_level 판단:\n' +
    '   - safe: 명세서에 명확히 기재, 구조적 한정, 추상적 표현 없음\n' +
    '   - caution: 명세서 뒷받침이 간접적, 또는 기능적 표현 포함\n' +
    '   - danger: 명세서에 뒷받침 부족, 추상적 표현, 신규사항 추가 위험\n' +
    '6. risk_flags: ["추상적 표현","기능적 기재","뒷받침 부족","신규사항"] 등 해당 항목\n' +
    '7. ★ 카테고리 변경 제안 금지: "방법→장치", "장치→방법" 등의 전환 제안을 하지 마라\n' +
    '8. ★ 원 청구항의 구성요소 명칭을 그대로 사용하여 insertion_point를 기재\n' +
    '9. ★★★ 각 구성에 spec_source_text(명세서 해당 단락 원문 직접 인용)를 반드시 포함하라\n' +
    '10. ★★★ 기존 청구항과 70% 이상 유사한 구성은 overlap_warning:true로 표시하라\n' +
    '\n출력 JSON:\n{"unused_components":[{' + commonOutputFields + '}]}\n\n★★★ JSON만 출력. ★★★';
};

// ═══════════════════════════════════════════
// 11. Checkpoint 2 화면: 구성 선택
// ═══════════════════════════════════════════
Division.renderAnalyze = function(left, right, p){
  var unused = Division.state.unusedComponents;
  var claims = Division.state.claims;
  var divType = p.division_type;
  var groups = { safe:[], caution:[], danger:[] };
  unused.forEach(function(uc){ (groups[uc.risk_level]||groups.safe).push(uc); });

  var h = '';

  // === 공통: 원출원 등록 청구항 + 구체화 포인트 ===
  var basisClaim = claims.find(function(c){ return c.division_role==='basis'; }) || claims.find(function(c){ return c.claim_type==='independent'; });
  if(basisClaim){
    var basisText = basisClaim.amended_text || basisClaim.original_text || '';
    var sectionTitle = divType==='merge' ? '원출원 등록 청구항 → 구체화·한정·부가 포인트'
      : divType==='category_change' ? '원출원 등록 청구항 → 카테고리 변환 대상'
      : '원출원 등록 청구항 → 전략 분할 기준';
    h += '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:10px"><span class="tf">📜</span> ' + sectionTitle + '</div>';

    // 구체화 포인트 매핑: 미활용 구성의 insertion_point → 원 청구항의 어떤 구성요소에 삽입되는지
    var insertionMap = [];
    unused.forEach(function(uc){
      if(!uc.insertion_point) return;
      var isSelected = uc.user_selection==='selected'||(uc.user_selection==='pending'&&uc.risk_level==='safe');
      insertionMap.push({ target:uc.related_element, content:uc.content, paragraph:'【'+uc.paragraph_number+'】', type:uc.limitation_type, selected:isSelected, riskLevel:uc.risk_level });
    });

    // 청구항 텍스트에서 구성요소명을 하이라이트 (플레이스홀더 치환으로 이중 치환 방지)
    var annotatedHtml = escapeHtml(Division._formatClaimText(basisText));
    var placeholders = [];
    insertionMap.forEach(function(im, imIdx){
      if(!im.target) return;
      var escaped = escapeHtml(im.target);
      var color = im.selected ? (im.riskLevel==='safe'?'#059669':'#d97706') : '#9ca3af';
      var marker = '<span style="background:' + (im.selected?'#ecfdf5':'#f9fafb') + ';border-bottom:2px solid ' + color + ';padding:0 2px" title="' + escapeHtml(im.content) + '">' + escaped + ' <sup style="font-size:9px;color:' + color + '">+</sup></span>';
      var placeholder = '\x00PH' + imIdx + '\x00';
      placeholders.push({ placeholder:placeholder, marker:marker });
      // 첫 번째 매치만 치환하여 중복 방지
      annotatedHtml = annotatedHtml.replace(new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), placeholder);
    });
    // 플레이스홀더를 실제 마커로 복원
    placeholders.forEach(function(ph){
      annotatedHtml = annotatedHtml.replace(ph.placeholder, ph.marker);
    });

    h += '<div style="font-size:13px;line-height:2;white-space:pre-wrap;max-height:200px;overflow-y:auto;padding:10px;background:#fafbfc;border:1px solid var(--color-border);border-radius:var(--radius-sm)">' + annotatedHtml + '</div>';

    // 삽입 포인트 범례
    if(insertionMap.length > 0){
      h += '<div style="margin-top:10px;font-size:11px;color:var(--color-text-tertiary)">';
      var pointTitle = divType==='merge' ? '📌 구체화·한정·부가 포인트' : divType==='category_change' ? '📌 변환 대상 구성요소' : '📌 활용 구성 포인트';
      h += '<div style="font-weight:600;margin-bottom:4px">' + pointTitle + ' (' + insertionMap.filter(function(im){return im.selected;}).length + '/' + insertionMap.length + '건 선택)</div>';
      insertionMap.forEach(function(im){
        var icon = im.selected ? (im.riskLevel==='safe'?'🟢':'🟡') : '⚪';
        var typeLabel = {structural:'구조한정',material:'재질한정',shape:'형상한정',arrangement:'배치한정',functional:'기능한정'}[im.type] || im.type;
        h += '<div style="padding:3px 0">' + icon + ' <strong>' + escapeHtml(im.target) + '</strong>';
        h += ' <span style="color:var(--color-primary);font-size:10px">['+typeLabel+']</span>';
        h += ' ← ' + escapeHtml(im.content.substring(0,80)) + (im.content.length>80?'...':'');
        h += ' <span style="color:var(--color-text-disabled)">' + im.paragraph + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
  }

  // === 카테고리 변경형: 변환 방향 표시 ===
  if(divType === 'category_change'){
    var meta = p.analysis_meta || {};
    h += '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">🔄</span> 카테고리 변환</div>';
    h += '<div class="division-info-box" style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;text-align:center">';
    h += '<span style="color:var(--color-primary)">' + (meta.original_category==='method'?'방법 청구항':'장치 청구항') + '</span>';
    h += ' <span style="font-size:18px;margin:0 12px">→</span> ';
    h += '<span style="color:var(--color-success)">' + (meta.target_category==='apparatus'?'장치 청구항':'방법 청구항') + '</span>';
    h += '</div></div></div>';
  }

  // === 전략적 분할: 테마 목록 + 등록 청구항 대비 diff ===
  if(divType === 'strategic'){
    var themes = (p.analysis_meta && p.analysis_meta.themes) || [];
    // basisClaim, basisText는 상위 스코프에서 이미 선언됨 — 재사용
    var strategicBasisText = basisClaim ? (basisClaim.amended_text || basisClaim.original_text || '') : '';

    h += '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">🎯</span> 독립항 테마 후보</div>';
    if(!themes.length){ h += '<div style="font-size:13px;color:var(--color-text-tertiary);padding:8px">테마 후보가 없습니다.</div>'; }
    else { themes.forEach(function(t, tidx){
      var riskInfo = Division.RISK_LABELS[t.risk_level] || Division.RISK_LABELS.safe;
      h += '<div class="division-theme-card ' + riskInfo.css + '">';
      h += '<label class="checkbox-label" style="flex:1;align-items:flex-start"><input type="checkbox" checked data-theme-id="' + t.theme_id + '" style="margin-top:4px" /><div style="flex:1">';

      // 제목
      h += '<div style="font-weight:700;font-size:14px;margin-bottom:6px">' + riskInfo.icon + ' ' + escapeHtml(t.theme_name) + '</div>';

      // 설명 (줄바꿈 포함)
      h += '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:8px">' + escapeHtml(t.description||'').replace(/\n/g,'<br>') + '</div>';

      // 핵심 구성요소 태그
      if(t.key_elements && t.key_elements.length){
        h += '<div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px">';
        t.key_elements.forEach(function(el){ h += '<span class="division-element-tag">' + escapeHtml(el) + '</span>'; });
        h += '</div>';
      }

      // 예상 청구항 미리보기 (스크롤 가능)
      h += '<div class="division-claim-preview-scroll">';
      h += '<div style="font-size:11px;font-weight:600;color:var(--color-primary);margin-bottom:4px">📝 예상 독립항 (청구항 ' + (tidx+1) + ')</div>';
      if(t.key_elements && t.key_elements.length){
        var previewText = t.key_elements.map(function(el, i){
          return (i === 0 ? '' : '상기 ') + escapeHtml(el) + ';';
        }).join('\n');
        previewText += '\n을 포함하는 ' + escapeHtml(t.theme_name) + '.';
        h += '<div style="white-space:pre-wrap;font-size:12px;line-height:1.8">' + previewText + '</div>';
      } else {
        h += '<div style="font-size:12px;color:var(--color-text-tertiary)">(핵심 구성 기반 독립항이 조립됩니다)</div>';
      }
      h += '</div>';

      // 등록 청구항과 비교 diff (토글)
      if(strategicBasisText && t.key_elements && t.key_elements.length){
        var proposedText = t.key_elements.map(function(el,elIdx){ return (elIdx===0?'':'상기 ') + el + ';'; }).join(' ') + ' 을 포함하는 ' + t.theme_name + '.';
        var diffResult = Division._wordDiff(strategicBasisText, proposedText);

        h += '<details class="division-diff-details">';
        h += '<summary style="font-size:11px;color:var(--color-primary);cursor:pointer;margin-top:6px;font-weight:600">';
        h += '⚖️ 등록 청구항과 비교 (추가 ' + diffResult.addedCount + ' / 삭제 ' + diffResult.removedCount + ')';
        h += '</summary>';
        h += '<div class="division-diff-box">';
        h += '<div style="font-size:10px;margin-bottom:6px;color:var(--color-text-tertiary)"><span class="division-diff-added" style="padding:0 4px">추가</span> <span class="division-diff-removed" style="padding:0 4px">삭제</span> 동일</div>';
        h += '<div style="font-size:12px;line-height:1.8;white-space:pre-wrap">' + diffResult.html + '</div>';
        h += '</div></details>';
      }

      // 근거/차별점
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--color-divider)">';
      h += '<div style="font-size:11px;color:var(--color-text-tertiary)">근거: ' + (t.spec_paragraphs||[]).map(function(s){return '【'+s+'】';}).join(' ') + '</div>';
      if(t.differentiation) h += '<div style="font-size:11px;color:var(--color-primary);margin-top:2px">💡 ' + escapeHtml(t.differentiation) + '</div>';
      var tFlags = Division._toArray(t.risk_flags);
      if(tFlags.length) h += '<div style="font-size:11px;color:var(--color-warning);margin-top:2px">⚠️ ' + escapeHtml(tFlags.join(', ')) + '</div>';
      h += '</div>';

      h += '</div></label></div>';
    }); }
    h += '</div>';
  }

  // 공통: 미활용/변환 구성 목록 (모든 유형)
  var compTitle = divType==='category_change' ? '변환 구성 후보' : divType==='strategic' ? '활용 가능 구성' : '구체화·한정·부가 구성 후보';

  // 일괄 선택 버튼
  var totalComps = unused.length;
  if(totalComps > 0){
    h += '<div class="card" style="padding:12px;margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    h += '<span style="font-size:13px;font-weight:600;margin-right:auto">' + compTitle + ' (' + totalComps + '건)</span>';
    h += '<button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="Division.bulkSelect(\'all\')">전체 선택</button>';
    h += '<button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="Division.bulkSelect(\'none\')">전체 해제</button>';
    h += '<button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;color:var(--color-success)" onclick="Division.bulkSelect(\'safe\')">✅ safe만 선택</button>';
    h += '</div>';
  }

  ['safe','caution','danger'].forEach(function(level){
    var items = groups[level]; var info = Division.RISK_LABELS[level]; if(!items.length) return;
    h += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:4px">'+info.icon+' '+info.label+' ('+items.length+'건)</div>';
    items.forEach(function(uc){
      var isChecked = uc.user_selection==='selected';
      h += '<div class="division-component-card '+info.css+'">';
      h += '<div class="division-component-card-header">';
      h += '<input type="checkbox" class="division-comp-checkbox" '+(isChecked?'checked':'')+' data-component-id="'+uc.id+'" data-risk-level="'+level+'" onchange="Division.toggleComponent(this)" />';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-weight:600;font-size:13px">'+escapeHtml(uc.content)+'</div>';
      h += '<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">';
      h += '<span class="division-element-tag">【'+uc.paragraph_number+'】</span>';
      h += '<span class="division-element-tag">→ '+escapeHtml(uc.related_element)+'</span>';
      var limLabels = {structural:'구조한정',material:'재질한정',shape:'형상한정',arrangement:'배치한정',functional:'기능한정'};
      h += '<span class="division-element-tag">'+(limLabels[uc.limitation_type]||uc.limitation_type)+'</span>';
      h += '</div></div></div>';
      // T16: 명세서 근거 원문 인용 표시 (component_data DB 컬럼 또는 메모리 _meta)
      var cd = uc.component_data || {};
      if(!cd.spec_source_text && Division.state._componentMeta){
        var metaKey = uc.paragraph_number + ':' + (uc.content||'').substring(0,50);
        cd = Division.state._componentMeta[metaKey] || cd;
      }
      if(cd.spec_source_text){
        h += '<div class="division-source-citation">';
        h += '📄 근거 단락: 【'+uc.paragraph_number+'】';
        h += '<div class="citation-text">"' + escapeHtml(cd.spec_source_text.substring(0,200)) + (cd.spec_source_text.length>200?'...':'') + '"</div>';
        h += '</div>';
      }
      // 삽입 위치 미리보기
      if(uc.insertion_point){
        h += '<div style="margin-top:6px;padding:6px 10px;background:#f0f7ff;border-radius:4px;font-size:11px;color:var(--color-primary)">';
        h += '📌 삽입: ' + escapeHtml(uc.insertion_point);
        h += '</div>';
      }
      // T16: overlap 경고 표시
      if(cd.overlap_warning){
        h += '<div class="division-overlap-warning">';
        h += '🔴 중복 경고: ' + escapeHtml(cd.overlap_detail || '기존 청구항과 유사 구성') + ' — 이중특허 위험 검토 필요';
        h += '</div>';
      } else if(cd.spec_source_text) {
        h += '<div class="division-no-overlap">✅ 기존 청구항 미포함 확인</div>';
      }
      // T16: 등록 전략 근거 표시
      if(cd.registration_strategy){
        h += '<div class="division-reg-strategy">💡 ' + escapeHtml(cd.registration_strategy.substring(0,150)) + '</div>';
      }
      var ucFlags = Division._toArray(uc.risk_flags);
      if(ucFlags.length) h += '<div style="font-size:11px;color:var(--color-warning);margin-top:4px">⚠️ '+escapeHtml(ucFlags.join(', '))+'</div>';
      if(uc.suggestion) h += '<div style="font-size:11px;color:var(--color-success);margin-top:2px">💡 예상 기재: '+escapeHtml(uc.suggestion)+'</div>';
      h += '</div>';
    });
    h += '</div>';
  });
  left.innerHTML = h;

  // 오른쪽: 유형 전환 + 요약
  var selectedCount = unused.filter(function(uc){ return uc.user_selection==='selected'; }).length;
  var rh = Division._renderTypeSwitch(p.division_type);
  rh += '<div class="card" style="padding:20px"><div style="font-size:16px;font-weight:700;margin-bottom:16px"><span class="tf">📋</span> 구성 요약</div>';
  rh += '<div class="division-summary-grid">';
  if(divType === 'strategic'){
    var summaryThemes = (p.analysis_meta && p.analysis_meta.themes) || [];
    rh += '<div class="division-summary-item"><div class="division-summary-num">'+summaryThemes.length+'</div><div class="division-summary-label">테마 후보</div></div>';
  }
  rh += '<div class="division-summary-item"><div class="division-summary-num" id="divisionSelectedCount">'+selectedCount+'</div><div class="division-summary-label">선택된 구성</div></div>';
  rh += '</div></div>';

  // 청구항 구성 설정
  rh += '<div class="card" style="padding:16px;margin-top:12px">';
  rh += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">⚙️</span> 청구항 구성</div>';

  // 독립항 수
  rh += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">';
  rh += '<span style="font-size:13px;font-weight:500;min-width:80px">독립항 수</span>';
  rh += '<div class="division-claim-count-group" id="divisionIndepCount">';
  [1,2,3].forEach(function(n){
    var active = (Division.state.indepCount||1) === n;
    rh += '<button class="division-count-btn' + (active?' active':'') + '" onclick="Division.setIndepCount('+n+')">' + n + '</button>';
  });
  rh += '</div>';
  rh += '<span style="font-size:11px;color:var(--color-text-tertiary)">기본 1개</span>';
  rh += '</div>';

  // 종속항 수 (독립항당)
  rh += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">';
  rh += '<span style="font-size:13px;font-weight:500;min-width:80px">종속항 수</span>';
  rh += '<div class="division-claim-count-group" id="divisionDepCount">';
  [0,2,4,6,'자동'].forEach(function(n){
    var val = n === '자동' ? -1 : n;
    var active = (Division.state.depCount === undefined ? -1 : Division.state.depCount) === val;
    rh += '<button class="division-count-btn' + (active?' active':'') + '" onclick="Division.setDepCount('+val+')">' + (n === '자동' ? '자동' : n+'개') + '</button>';
  });
  rh += '</div>';
  rh += '</div>';

  // 예상 청구항 구성 요약
  var ic = Division.state.indepCount || 1;
  var dc = Division.state.depCount === undefined ? -1 : Division.state.depCount;
  var totalEst = dc === -1 ? ic + '+ (AI 자동)' : (ic + ic*dc) + '항';
  rh += '<div style="padding:10px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm);font-size:12px;color:var(--color-text-secondary);text-align:center">';
  rh += '예상: 독립항 ' + ic + '개';
  if(dc === -1) rh += ' + 종속항 자동 구성';
  else if(dc > 0) rh += ' × 종속항 ' + dc + '개 = 총 ' + totalEst;
  else rh += ' (종속항 없음)';
  rh += '</div>';
  rh += '</div>';

  rh += '<div id="divisionAssembleProgress" style="margin-top:12px"></div>';
  rh += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-ghost" onclick="Division.rerunAnalyze()" style="flex:1;padding:12px"><span class="tf">🔄</span> 재분석</button>';
  rh += '<button class="btn btn-primary" id="btnDivisionAssemble" onclick="Division.runAssemble()" style="flex:1;padding:12px"><span class="tf">🔧</span> 조립 실행</button></div>';
  right.innerHTML = rh;
};

Division.toggleComponent = async function(cb){
  var id=cb.dataset.componentId, val=cb.checked?'selected':'excluded';
  try { await sb.from('division_unused_components').update({user_selection:val}).eq('id',id);
    var c=Division.state.unusedComponents.find(function(x){return x.id===id;}); if(c) c.user_selection=val;
    Division._updateSelectedCount();
  } catch(e) { showToast('변경 실패','error'); }
};

// 선택 카운트 실시간 갱신
Division._updateSelectedCount = function(){
  var checked = document.querySelectorAll('.division-comp-checkbox:checked').length;
  var el = document.getElementById('divisionSelectedCount');
  if(el) el.textContent = checked;
};

// 일괄 선택: 'all' | 'none' | 'safe'
Division.bulkSelect = async function(mode){
  var checkboxes = document.querySelectorAll('.division-comp-checkbox');
  var updates = [];
  checkboxes.forEach(function(cb){
    var shouldCheck = mode==='all' || (mode==='safe' && cb.dataset.riskLevel==='safe');
    cb.checked = shouldCheck;
    var id = cb.dataset.componentId;
    var val = shouldCheck ? 'selected' : 'excluded';
    var c = Division.state.unusedComponents.find(function(x){return x.id===id;});
    if(c) c.user_selection = val;
    updates.push({ id:id, val:val });
  });
  Division._updateSelectedCount();
  // DB 일괄 반영 (순차)
  for(var i=0;i<updates.length;i++){
    try { await sb.from('division_unused_components').update({user_selection:updates[i].val}).eq('id',updates[i].id); }
    catch(e){ console.warn('[Division] 일괄 선택 DB 반영 실패:', updates[i].id); }
  }
  showToast(mode==='all'?'전체 선택됨':mode==='none'?'전체 해제됨':'safe 구성만 선택됨','info');
};

Division.rerunAnalyze = function(){ Division.runAnalyze(); };

// 청구항 개수 설정 + DB 영속화
Division.setIndepCount = async function(n){
  Division.state.indepCount = n;
  var p = Division.state.current;
  if(p){
    var meta = p.analysis_meta || {};
    meta.indep_count = n;
    await sb.from('division_projects').update({ analysis_meta: meta }).eq('id', p.id);
    p.analysis_meta = meta;
  }
  Division.renderStay();
};
Division.setDepCount = async function(n){
  Division.state.depCount = n;
  var p = Division.state.current;
  if(p){
    var meta = p.analysis_meta || {};
    meta.dep_count = n;
    await sb.from('division_projects').update({ analysis_meta: meta }).eq('id', p.id);
    p.analysis_meta = meta;
  }
  Division.renderStay();
};

// ═══════════════════════════════════════════
// 12. Checkpoint 3: 조립
// ═══════════════════════════════════════════
Division.runAssemble = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;
  try {
    App.setButtonLoading('btnDivisionAssemble',true);
    App.showProgress('divisionAssembleProgress','청구항 조립 중...',1,3);
    var selected = Division.state.unusedComponents.filter(function(uc){ return uc.user_selection==='selected'||(uc.user_selection==='pending'&&uc.risk_level==='safe'); });
    var claims = Division.state.claims;
    var basisClaim = claims.find(function(c){ return c.division_role==='basis'; });
    if(!basisClaim) basisClaim = claims.find(function(c){ return c.claim_type==='independent'; });
    if(!basisClaim){ showToast('기초 청구항을 찾을 수 없습니다','error'); App.setButtonLoading('btnDivisionAssemble',false); return; }
    var depCandidates = claims.filter(function(c){ return c.division_role==='dep_candidate'; });
    var assemblePrompt = Division._buildAssemblePrompt(basisClaim, selected, depCandidates, Division.state.indepCount||1, Division.state.depCount);
    var result = await Division.callAI(assemblePrompt);
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 조립 중 프로젝트 전환됨'); App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false); return; }
    App.showProgress('divisionAssembleProgress','결과 저장 중...',2,3);
    var assembled;
    try { assembled = Division._extractJSON(result.text); }
    catch(e) { showToast('조립 결과 해석 실패: ' + e.message.substring(0,80),'error'); App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false); return; }
    await sb.from('division_claims_output').delete().eq('project_id',p.id);
    if(assembled.division_claims && assembled.division_claims.length > 0){
      var rows = assembled.division_claims.map(function(dc){
        // ** 마크다운 마커 제거 — claim_text는 순수 텍스트만
        var cleanText = (dc.claim_text||'').replace(/\*{2,3}/g,'');
        return { project_id:p.id, claim_number:dc.claim_number, claim_type:dc.claim_type||'independent', parent_claim_number:dc.parent_claim_number||null, claim_text:cleanText, claim_text_highlighted:dc.claim_text_highlighted||dc.claim_text||'', version:1 };
      });
      // T9 메타데이터를 메모리에 보관 (UI용)
      Division.state._assembledMeta = {
        claims: assembled.division_claims.map(function(dc){
          return { claim_number:dc.claim_number, basis_preserved:dc.basis_preserved, added_components:dc.added_components||[] };
        }),
        new_matter_check: assembled.new_matter_check || ''
      };

      // DB INSERT — 실제 테이블 컬럼만 사용
      console.log('[Division] ── claims_output INSERT 디버그 ──');
      console.log('[Division] INSERT 행 수:', rows.length);
      console.log('[Division] INSERT 컬럼:', Object.keys(rows[0]));
      console.log('[Division] 첫 행 샘플:', JSON.stringify(rows[0]).substring(0, 500));
      rows.forEach(function(r,i){ console.log('[Division] 행'+i+' claim_number:'+r.claim_number+' type:'+r.claim_type+' text길이:'+(r.claim_text||'').length); });

      var {error:claimErr} = await sb.from('division_claims_output').insert(rows);
      if(claimErr){
        console.error('[Division] claims_output INSERT 실패:', claimErr.message, claimErr.details, claimErr.code);
        // 행별 폴백
        var saved = 0;
        for(var ci=0; ci<rows.length; ci++){
          console.log('[Division] 행별 시도 '+ci+':', JSON.stringify(rows[ci]).substring(0, 300));
          var {error:rowErr} = await sb.from('division_claims_output').insert(rows[ci]);
          if(rowErr){ console.error('[Division] 행 '+ci+' 실패:', rowErr.message, rowErr.details); }
          else { saved++; }
        }
        console.log('[Division] 행별 결과:', saved+'/'+rows.length+'건 성공');
      } else {
        console.log('[Division] claims_output INSERT 성공:', rows.length, '건');
      }
    }
    var updateData = { status:'assembled', updated_at:new Date().toISOString() };
    // title_candidates는 JSONB 컬럼이 있으면 저장, 없으면 무시
    if(assembled.title_candidates){
      try {
        await sb.from('division_projects').update({ title_candidates:assembled.title_candidates }).eq('id',p.id);
        p.title_candidates = assembled.title_candidates;
      } catch(e){ console.warn('[Division] title_candidates 저장 실패 (컬럼 미존재?):', e.message); p.title_candidates = assembled.title_candidates; }
    }
    await sb.from('division_projects').update(updateData).eq('id',p.id);
    p.status = 'assembled'; if(assembled.title_candidates) p.title_candidates = assembled.title_candidates;
    App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false);
    showToast('조립 완료! 초안을 검토해 주세요.');
    Division.state.currentStepKey = 'assemble'; // 조립 결과 화면으로 이동
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionAssembleProgress'); App.setButtonLoading('btnDivisionAssemble',false); showToast('조립 실패: '+e.message,'error'); }
};

Division._buildAssemblePrompt = function(basisClaim, selectedComponents, depCandidates, indepCount, depCount){
  var basisText = basisClaim ? (basisClaim.amended_text||basisClaim.original_text||'') : '(기초 청구항 없음)';
  var compList = selectedComponents.map(function(uc){
    var cd = uc.component_data || {};
    return '- 내용: '+uc.content+'\n  삽입위치: '+uc.insertion_point+'\n  유형: '+uc.limitation_type +
      '\n  근거단락: 【'+uc.paragraph_number+'】' +
      (cd.spec_source_text ? '\n  명세서원문: "'+cd.spec_source_text.substring(0,200)+'"' : '');
  }).join('\n');
  var depList = depCandidates.map(function(c){ return '제'+c.claim_number+'항: '+((c.amended_text||c.original_text||'').substring(0,1000)); }).join('\n\n');
  var p = Division.state.current;
  var divType = p ? p.division_type : 'merge';
  indepCount = indepCount || 1;
  var depInstr = depCount === 0 ? '종속항 없이 독립항만 작성' : depCount > 0 ? '각 독립항에 종속항 '+depCount+'개씩 작성' : '각 독립항에 적절한 수의 종속항을 자동 구성 (원출원 종속항 후보 활용)';

  // T3: 공통 원칙 주입
  var principles = Division.DIVISION_PRINCIPLES;

  var claimCountRule = '\n\n★★★ 청구항 구성 지시 ★★★\n- 독립항: 정확히 ' + indepCount + '개 작성\n- 종속항: ' + depInstr + '\n- 청구항 번호는 1부터 연번\n';

  // T9/T10/T11: 3유형 공통 품질 규칙 (명세서 기반 검증 강화)
  var qualityRules = '\n\n[품질 규칙 — 3유형 공통]\n' +
    '1. 추상적 표현 금지: "신속하게","효과적으로","최적의" → 구체적 수치/구조로 대체\n' +
    '2. 기능적 기재 최소화: "~하기 위한 수단" → 구조적 표현\n' +
    '3. "상기" 일관 사용, 세미콜론(;), 말미 마침표(.)\n' +
    '4. claim_text에는 마크다운 없이 순수 텍스트만\n' +
    '5. claim_text_highlighted에만 표시 (**부가**, **변환**)\n' +
    '6. 최종 점검: 조립된 청구항의 모든 구성이 원출원 명세서에 있는지 재확인\n' +
    '\n★★★ 원출원 명세서에 기재되지 않은 내용은 절대 포함하지 마라 ★★★\n';

  // T9/T10/T11: 공통 출력 스키마 — basis_preserved, added_components, new_matter_check 추가
  var outputSchema = '{"division_claims":[{"claim_number":1,"claim_type":"independent|dependent",' +
    '"parent_claim_number":null,"claim_text":"순수텍스트","claim_text_highlighted":"변경표시",' +
    '"basis_preserved":true,"added_components":[{"content":"추가된 D 내용","paragraph_number":"0098","limitation_type":"structural"}]}],' +
    '"new_matter_check":"신규사항 확인 결과 요약 (모든 구성의 명세서 뒷받침 여부)",' +
    '"title_candidates":[{"ko":"","en":""}]}';

  // T10: 카테고리변경형
  if(divType === 'category_change'){
    var meta = p.analysis_meta || {};
    return principles +
      '\n\n이것은 "카테고리 변경형" 분할출원 조립이다.\n' +
      '목적: 등록 청구항의 기술적 내용(A+B+C)을 보존하면서, 방법↔장치 카테고리를 전환한다.\n' +
      '★ 변환 시 명세서에 없는 구성요소명(~부, ~수단)을 임의로 생성하지 마라.\n' +
      '★ 변환된 각 구성요소명이 명세서에 실제 기재되어 있어야 한다.\n' +
      '★ A+B+C의 기술적 내용을 보존하라 (형태만 방법↔장치 전환).\n' +
      '\n[등록 청구항 (basis) — '+(meta.original_category==='method'?'방법':'장치')+']\n'+basisText+
      '\n\n[변환 방향]\n'+(meta.original_category==='method'?'방법 → 장치':'장치 → 방법')+
      '\n\n[변환에 활용할 구성]\n'+(compList||'(없음)')+
      '\n\n[종속항 후보]\n'+(depList||'(없음)')+
      claimCountRule+
      '\n조립 규칙:\n' +
      '1. 방법→장치: "~하는 단계"→"~하는 ~부/수단" (명세서 기재 구성요소명만 사용), 말미 "~을 포함하는 [장치명]."\n' +
      '2. 장치→방법: "~부/수단"→"~하는 단계", 말미 "~을 포함하는 방법."\n' +
      '3. ★ 변환 시 추가되는 구성요소명은 반드시 명세서에 기재된 것만 사용\n' +
      '4. 명칭: 국문/영문 각 2개\n' +
      '5. basis_preserved: 기술적 내용 보존 여부 (true/false)\n' +
      '6. added_components: 변환 과정에서 추가된 구성 (각각 명세서 단락번호 포함)\n' +
      qualityRules+
      '\n★★★ JSON만 출력. ★★★\n\n출력: ' + outputSchema;
  }

  // T11: 전략형
  if(divType === 'strategic'){
    var themes = (p.analysis_meta && p.analysis_meta.themes) || [];
    var selectedThemes = [];
    try { var themeCheckboxes = document.querySelectorAll('[data-theme-id]:checked');
      themeCheckboxes.forEach(function(cb){ var tid=cb.dataset.themeId; var t=themes.find(function(x){return x.theme_id===tid;}); if(t) selectedThemes.push(t); });
    } catch(e){}
    if(!selectedThemes.length && themes.length > 0) selectedThemes = themes.slice(0, indepCount);
    var themesDesc = selectedThemes.map(function(t){
      return '테마: '+t.theme_name+'\n설명: '+t.description+
        '\n핵심: '+(t.key_elements||[]).join(', ')+
        '\n근거단락: '+(t.spec_paragraphs||[]).map(function(s){return '【'+s+'】';}).join(' ');
    }).join('\n\n');

    return principles +
      '\n\n이것은 "전략형" 분할출원 조립이다.\n' +
      '목적: 등록 청구항과 다른 관점의 새로운 독립항을 명세서 범위 내에서 작성한다.\n' +
      '★ 신규사항 추가 위험이 가장 높은 유형이다.\n' +
      '★ 새 독립항의 모든 구성요소에 명세서 단락번호 1:1 대응이 필수이다.\n' +
      '★ 명세서에 기재되지 않은 구성은 절대 포함하지 마라.\n' +
      '\n[등록 청구항 (basis — 참고용)]\n'+basisText+
      '\n\n[선택된 테마]\n'+(themesDesc||'(없음)')+
      '\n\n[활용 구성]\n'+(compList||'(없음)')+
      '\n\n[종속항 후보]\n'+(depList||'(없음)')+
      claimCountRule+
      '\n조립 규칙:\n' +
      '1. 테마별 새 독립항 — 기존 등록 청구항과 다른 관점으로 작성\n' +
      '2. ★ 모든 구성요소에 명세서 단락번호 대응 필수 (added_components에 paragraph_number 기재)\n' +
      '3. ★ basis를 참고하되 직접 복사하지 않음 — "원출원 범위 내" 확인\n' +
      '4. 명칭: 국문/영문 각 2개\n' +
      '5. basis_preserved: 전략형은 false (새 독립항이므로)\n' +
      '6. added_components: 독립항의 모든 구성요소를 나열 (각각 명세서 단락번호 포함)\n' +
      '7. new_matter_check: 각 구성의 명세서 뒷받침 여부를 요약\n' +
      qualityRules+
      '\n★★★ JSON만 출력. ★★★\n\n출력: ' + outputSchema;
  }

  // 병합형 (merge) — D의 출처는 오직 unused_components(명세서 기재 + 청구항 미기재)만
  return principles +
    '\n\n이것은 "병합형" 분할출원 조립이다.\n' +
    '목적: 등록 청구항(A+B+C)을 그대로 유지하면서, 명세서에만 기재되어 있고\n' +
    '기존 어떤 청구항(종속항 포함)에도 없었던 구성(D)을 추가하여 A+B+C+D로 출원한다.\n' +
    '★★★ 등록결정 구성(A+B+C)은 한 글자도 수정·삭제하지 마라. ★★★\n' +
    '★★★ D는 오직 아래 [선택된 부가 구성]에서만 가져온다. 기존 종속항의 내용을 독립항에 병합하지 마라. ★★★\n' +
    '\n[등록 청구항 (basis) — 이 구성을 한 글자도 변경하지 말 것]\n'+basisText+
    '\n\n[선택된 부가 구성 (D) — 명세서에만 기재, 기존 청구항 미포함]\n'+(compList||'(없음)')+
    '\n\n[종속항 후보]\n'+(depList||'(없음)')+
    claimCountRule+
    '\n조립 규칙:\n' +
    '1. ★★★ basis 원문 보존: 등록 청구항(A+B+C)을 독립항 앞부분에 원문 그대로 기재. 절대 수정 금지.\n' +
    '2. D 삽입: structural→명칭앞 형용구, material→재질병기, shape→형상추가, functional→뒤에부가\n' +
    '3. 종속항: dep_candidate→"제1항에 있어서," 변환, 번호재매핑\n' +
    '4. 명칭: 국문/영문 각 2개\n' +
    '5. basis_preserved: basis 원문이 독립항에 그대로 포함되었는지 (true/false)\n' +
    '6. added_components: 추가된 D 목록 (각각 content, paragraph_number, limitation_type 포함)\n' +
    '7. new_matter_check: 모든 D의 명세서 뒷받침 확인 요약\n' +
    qualityRules+
    '\n★★★ JSON만 출력. {로 시작 }로 끝. ★★★\n\n출력: ' + outputSchema;
};

// ═══════════════════════════════════════════
// 13. Checkpoint 3 화면: 초안 검토
// ═══════════════════════════════════════════
Division.renderAssemble = function(left, right, p){
  var divClaims = Division.state.divisionClaims;
  var origClaims = Division.state.claims;
  var basisClaim = origClaims.find(function(c){ return c.division_role==='basis'; }) || origClaims.find(function(c){ return c.claim_type==='independent'; });

  // === 왼쪽: 등록 청구항 vs 분할출원 청구항 비교 ===
  var h = '';

  if(!divClaims.length){
    h += '<div class="card" style="padding:20px;text-align:center;color:var(--color-text-tertiary)">조립된 청구항이 없습니다.</div>';
  } else {
    // 독립항 비교
    var divIndeps = divClaims.filter(function(c){ return c.claim_type==='independent'; });
    divIndeps.forEach(function(dc){
      var registeredText = basisClaim ? (basisClaim.amended_text || basisClaim.original_text || '') : '';
      var divText = (dc.claim_text || '').replace(/\*{2,3}/g, ''); // ** 마커 제거

      // 단어 단위 diff 생성
      var diffResult = Division._wordDiff(registeredText, divText);

      h += '<div class="division-compare">';
      h += '<div class="division-compare-header"><span class="tf">⚖️</span> 청구항 ' + dc.claim_number + ' 비교 (독립항)';
      h += '<span style="margin-left:auto;font-size:11px;font-weight:400;color:var(--color-text-tertiary)">추가 ' + diffResult.addedCount + ' / 삭제 ' + diffResult.removedCount + '</span>';
      h += '</div>';
      h += '<div class="division-compare-titles">';
      h += '<div class="division-compare-col-title original">📜 등록 청구항 (원본)</div>';
      h += '<div class="division-compare-col-title division">🔀 분할출원 청구항 (신규)</div>';
      h += '</div>';
      h += '<div class="division-compare-body">';
      h += '<div class="division-compare-col">' + escapeHtml(Division._formatClaimText(registeredText)) + '</div>';
      h += '<div class="division-compare-col">' + diffResult.html + '</div>';
      h += '</div></div>';
    });

    // 종속항 목록
    var divDeps = divClaims.filter(function(c){ return c.claim_type==='dependent'; });
    if(divDeps.length > 0){
      h += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">📎</span> 종속항 (' + divDeps.length + '항)</div>';
      divDeps.forEach(function(dc){
        var divCleanText = (dc.claim_text || '').replace(/\*{2,3}/g, '');

        // 원본 종속항 찾기: 텍스트 유사도 기반 매칭 (번호 불일치 가능)
        var origDep = Division._findBestOrigMatch(dc, origClaims);

        h += '<div class="division-claim-block">';
        h += '<div class="division-claim-header">';
        h += '<span style="font-weight:700;color:var(--color-primary)">【청구항 ' + dc.claim_number + '】</span>';
        h += '<span class="division-claim-type-tag">종속항 → 제' + (dc.parent_claim_number||1) + '항</span>';
        h += '</div>';
        h += '<div class="division-claim-body" style="white-space:pre-wrap">' + escapeHtml(Division._formatClaimText(divCleanText)) + '</div>';
        if(origDep){
          h += '<details style="margin-top:8px"><summary style="font-size:11px;color:var(--color-text-tertiary);cursor:pointer">원본 제' + origDep.claim_number + '항 보기</summary>';
          h += '<div style="font-size:12px;line-height:1.7;padding:8px;background:#f8fafc;border-radius:4px;margin-top:4px">' + escapeHtml(origDep.amended_text || origDep.original_text || '') + '</div>';
          h += '</details>';
        }
        h += '</div>';
      });
      h += '</div>';
    }
  }

  left.innerHTML = h;

  // === 오른쪽: 변경사항 요약 + 범례 + 버튼 ===
  var indepCnt = divClaims.filter(function(c){ return c.claim_type==='independent'; }).length;
  var depCnt = divClaims.filter(function(c){ return c.claim_type==='dependent'; }).length;

  var rh = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">📊</span> 변경사항 요약</div>';
  rh += '<div class="division-summary-grid">';
  rh += '<div class="division-summary-item"><div class="division-summary-num">' + indepCnt + '</div><div class="division-summary-label">독립항</div></div>';
  rh += '<div class="division-summary-item"><div class="division-summary-num">' + depCnt + '</div><div class="division-summary-label">종속항</div></div>';
  rh += '<div class="division-summary-item"><div class="division-summary-num">' + divClaims.length + '</div><div class="division-summary-label">총 청구항</div></div>';
  rh += '</div></div>';

  // 범례
  rh += '<div class="card" style="padding:14px;margin-top:12px"><div style="font-size:12px;font-weight:600;margin-bottom:8px">🖍️ 색상 범례</div>';
  rh += '<div style="font-size:12px;line-height:2">';
  rh += '<span class="division-diff-added" style="padding:2px 8px">초록 배경</span> 부가/병합/변환된 구성 (원본에 없던 내용)<br>';
  rh += '<span style="padding:2px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:2px">회색 배경</span> 원본 유지 부분';
  rh += '</div></div>';

  rh += '<div id="divisionVerifyProgress" style="margin-top:12px"></div>';
  rh += '<div style="display:flex;gap:8px;margin-top:12px">';
  rh += '<button class="btn btn-ghost" onclick="Division.goToStep(\'analyze\')" style="flex:1;padding:12px"><span class="tf">🔄</span> 재조립 (구성 선택)</button>';
  rh += '<button class="btn btn-primary" id="btnDivisionVerify" onclick="Division.runVerify()" style="flex:1;padding:12px"><span class="tf">✅</span> 검증 실행</button></div>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 14. Checkpoint 4: 검증
// ═══════════════════════════════════════════
Division.runVerify = async function(){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;
  try {
    App.setButtonLoading('btnDivisionVerify',true);
    App.showProgress('divisionVerifyProgress','명세서 전문 추출 중...',1,4);

    // 1) 분할출원 청구항 텍스트
    var divClaims = Division.state.divisionClaims;
    var claimsText = divClaims.map(function(dc){ return '【청구항 '+dc.claim_number+'】\n'+dc.claim_text; }).join('\n\n');

    // 2) 명세서 전문: spec_full_text(T2에서 파싱 시 저장)에서 우선 조회
    var specText = p.spec_full_text || '';
    if(!specText || specText.length < 500){
      // spec_full_text가 없으면 DB에서 조회 시도
      var {data:projData} = await sb.from('division_projects').select('spec_full_text').eq('id', p.id).single();
      specText = (projData && projData.spec_full_text) || '';
      if(specText) { p.spec_full_text = specText; console.log('[Division] 검증용 spec_full_text DB 조회:', specText.length, '글자'); }
    }
    if(!specText || specText.length < 500){
      // 폴백 1: PDF 재추출
      var appFile = Division.state.files.find(function(f){ return f.file_type === 'application'; });
      if(appFile){
        try {
          var {data:blob, error:dlErr} = await sb.storage.from('division-files').download(appFile.storage_path);
          if(!dlErr && blob){
            var buf = await blob.arrayBuffer();
            specText = await App.extractPdfText(buf);
            console.log('[Division] 검증용 PDF 추출 폴백:', specText.length, '글자');
          }
        } catch(e){ console.warn('[Division] 명세서 PDF 추출 실패:', e); }
      }
    }
    if(!specText || specText.length < 500){
      // 폴백 2: DB 단락 사용
      var {data:paragraphs} = await sb.from('division_spec_paragraphs').select('*').eq('project_id',p.id);
      specText = (paragraphs||[]).map(function(para){ return '【'+para.paragraph_number+'】 '+para.content; }).join('\n');
      console.log('[Division] 검증용 DB 단락 폴백:', specText.length, '글자');
    }

    // 3) 등록 청구항 (원본 대비 중복 체크용)
    var origClaimsText = Division.state.claims.map(function(c){
      return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text||'').substring(0,1000);
    }).join('\n');

    // T14: Pass 1 — 코드 레벨 자동 검증
    App.showProgress('divisionVerifyProgress','자동 검증 (Pass 1) 실행 중...',2,5);
    var basisClaim = Division.state.claims.find(function(c){ return c.division_role==='basis'; }) ||
      Division.state.claims.find(function(c){ return c.claim_type==='independent'; });
    var autoIssues = Division.runAutoVerify(divClaims, basisClaim, Division.state.claims, specText, p.division_type);
    console.log('[Division] Pass 1 완료:', autoIssues.length, '건');

    // T14: Pass 2 — LLM 의미 검증 (Pass 1 결과와 무관하게 항상 실행)
    App.showProgress('divisionVerifyProgress','AI 검증 (Pass 2) 분석 중...',3,5);
    var verifyPrompt = Division._buildVerifyPrompt(claimsText, specText, origClaimsText);
    var result = await Division.callAI(verifyPrompt);
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 검증 중 프로젝트 전환됨'); App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false); return; }
    App.showProgress('divisionVerifyProgress','결과 저장 중...',4,5);
    var verified;
    try { verified = Division._extractJSON(result.text); }
    catch(e) { showToast('검증 결과 해석 실패: ' + e.message.substring(0,80),'error'); App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false); return; }

    // T14: DB 저장 — Pass 1 (auto_verify_issues) + Pass 2 (result_data) 통합
    var VALID_CHECK = ['new_matter','basis_scope','double_patenting','spec_support','support','format','abstract_expression','functional_limitation','overlap'];
    var VALID_RESULT = ['pass','warning','fail'];
    var sEnum = Division._sanitizeEnum;

    // Pass 1 결과를 메모리에 보관 (UI 렌더링용)
    Division.state._autoVerifyIssues = autoIssues;

    await sb.from('division_validation_results').delete().eq('project_id',p.id);
    if(verified.results && verified.results.length > 0){
      var rows = verified.results.map(function(vr){
        return {
          project_id:p.id,
          check_type:sEnum(vr.check_type,VALID_CHECK,'format'),
          target_text:(vr.target_text||'').substring(0,5000),
          result:sEnum(vr.result,VALID_RESULT,'pass'),
          detail:(vr.detail||'').substring(0,5000),
          suggestion:(vr.suggestion||'').substring(0,5000),
          spec_paragraph_number:vr.spec_paragraph_number ? String(vr.spec_paragraph_number).substring(0,20) : null
        };
      });
      var {error:valErr} = await sb.from('division_validation_results').insert(rows);
      if(valErr){
        console.error('[Division] 검증 결과 저장 실패:', valErr.message);
        for(var vi=0;vi<rows.length;vi++){
          var {error:re}=await sb.from('division_validation_results').insert(rows[vi]);
          if(re) console.warn('[Division] 검증 행 '+vi+' 실패:', re.message);
        }
      }
    } else {
      // Pass 2 결과가 없을 때 빈 결과 저장
      if(autoIssues.length > 0){
        await sb.from('division_validation_results').insert({
          project_id:p.id, check_type:'format', result:'pass', detail:'LLM 검증 결과 없음'
        });
      }
    }
    await sb.from('division_projects').update({status:'verified', updated_at:new Date().toISOString()}).eq('id',p.id);
    p.status = 'verified';
    App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false);
    showToast('검증 완료!');
    Division.state.currentStepKey = 'verify';
    await Division.loadData(p.id);
  } catch(e) { App.clearProgress('divisionVerifyProgress'); App.setButtonLoading('btnDivisionVerify',false); showToast('검증 실패: '+e.message,'error'); }
};

// ═══ T12: Pass 1 — 코드 레벨 자동 검증 (LLM 호출 전) ═══
/**
 * 3유형 공통으로 사용. divisionType에 따라 일부 검증 항목 분기.
 * @returns {Array} issues [{severity, check, message, detail}]
 */
Division.runAutoVerify = function(divisionClaims, basisClaim, allOriginalClaims, specFullText, divisionType){
  var issues = [];
  var basisText = basisClaim ? (basisClaim.amended_text || basisClaim.original_text || '') : '';

  // ─── [검증 1] basis 보존 확인 (병합형·카테고리변경형) ───
  if(divisionType === 'merge'){
    divisionClaims.filter(function(c){ return c.claim_type === 'independent'; }).forEach(function(c){
      if(basisText && basisText.length > 20){
        // basis 원문의 앞 100자가 분할 독립항에 포함되어 있는지
        var checkLen = Math.min(100, basisText.length);
        if(!c.claim_text.includes(basisText.substring(0, checkLen))){
          issues.push({
            severity: 'CRITICAL', check: 'basis_preservation',
            message: '독립항 ' + c.claim_number + '에서 등록결정 구성(basis)이 변경된 것으로 보입니다',
            detail: 'basis 앞 ' + checkLen + '자가 독립항에서 발견되지 않음: "' + basisText.substring(0, 50) + '..."'
          });
        }
      }
    });
  }

  if(divisionType === 'category_change'){
    // 카테고리변경형: 기술적 내용 보존 확인 — basis 키워드의 80% 이상이 분할항에 존재해야 함
    divisionClaims.filter(function(c){ return c.claim_type === 'independent'; }).forEach(function(c){
      if(basisText){
        var basisKw = (basisText.match(/[가-힣]{3,}/g) || []).filter(function(kw){
          return Division.STOPWORDS.indexOf(kw) < 0;
        });
        if(basisKw.length > 0){
          var preserved = basisKw.filter(function(kw){ return c.claim_text.indexOf(kw) >= 0; });
          var ratio = preserved.length / basisKw.length;
          if(ratio < 0.6){
            issues.push({
              severity: 'HIGH', check: 'basis_preservation',
              message: '독립항 ' + c.claim_number + '의 기술적 내용 보존율이 ' + Math.round(ratio*100) + '%로 낮음',
              detail: '카테고리 변환 시 기술적 내용의 60% 이상이 보존되어야 합니다'
            });
          }
        }
      }
    });
  }

  // ─── [검증 2] 이중 특허 방지 (3유형 공통) ───
  divisionClaims.forEach(function(dc){
    allOriginalClaims.forEach(function(oc){
      var ocText = oc.amended_text || oc.original_text || '';
      var sim = Division._lcsRatio(dc.claim_text, ocText);
      if(sim > 0.95){
        issues.push({
          severity: 'HIGH', check: 'double_patenting',
          message: '분할 청구항 ' + dc.claim_number + '이 원출원 청구항 ' + oc.claim_number + '과 ' + Math.round(sim*100) + '% 동일',
          detail: '이중 특허 위험 — 추가 구성(D)이 충분히 차별화되지 않았습니다'
        });
      }
    });
  });

  // ─── [검증 3] 신규사항 위험 — 키워드 기반 (3유형 공통) ───
  if(specFullText && specFullText.length > 100){
    divisionClaims.forEach(function(dc){
      var keywords = (dc.claim_text.match(/[가-힣]{2,}/g) || []);
      var meaningful = keywords.filter(function(kw){ return Division.STOPWORDS.indexOf(kw) < 0 && kw.length >= 3; });
      var missing = meaningful.filter(function(kw){ return specFullText.indexOf(kw) < 0; });
      if(missing.length > 3){
        issues.push({
          severity: 'HIGH', check: 'new_matter_risk',
          message: '청구항 ' + dc.claim_number + '에 명세서 미발견 용어 ' + missing.length + '개',
          detail: '미발견: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ' 외 ' + (missing.length-5) + '개' : '')
        });
      }
    });
  } else {
    issues.push({
      severity: 'MEDIUM', check: 'spec_missing',
      message: '명세서 전문이 없거나 너무 짧아 신규사항 키워드 검사를 수행할 수 없습니다',
      detail: 'spec_full_text 길이: ' + (specFullText ? specFullText.length : 0) + '자'
    });
  }

  // ─── [검증 4] 추가 구성(D) 교차 확인 (draft_data.added_components 있을 때) ───
  divisionClaims.forEach(function(dc){
    var dd = dc.draft_data || {};
    if(dd.added_components && dd.added_components.length){
      dd.added_components.forEach(function(comp){
        allOriginalClaims.forEach(function(oc){
          var ocText = oc.amended_text || oc.original_text || '';
          var sim = Division._lcsRatio(comp.content || '', ocText);
          if(sim > 0.7){
            issues.push({
              severity: 'MEDIUM', check: 'component_overlap',
              message: '추가 구성 "' + (comp.content||'').slice(0,20) + '..."이 기존 청구항 ' + oc.claim_number + '과 ' + Math.round(sim*100) + '% 유사',
              detail: '이중 특허 위험 검토 필요'
            });
          }
        });
      });
    }
  });

  // ─── [검증 5] 종속항 인용 관계 검사 (3유형 공통) ───
  var claimNums = divisionClaims.map(function(c){ return c.claim_number; });
  divisionClaims.forEach(function(dc){
    if(dc.claim_type === 'dependent'){
      if(!dc.parent_claim_number){
        issues.push({
          severity: 'MEDIUM', check: 'dependency_format',
          message: '종속항 ' + dc.claim_number + '의 인용 청구항 번호가 없습니다',
          detail: 'parent_claim_number가 null'
        });
      } else if(claimNums.indexOf(dc.parent_claim_number) < 0){
        issues.push({
          severity: 'HIGH', check: 'dependency_format',
          message: '종속항 ' + dc.claim_number + '이 존재하지 않는 청구항 ' + dc.parent_claim_number + '을 인용',
          detail: '유효한 청구항 번호: ' + claimNums.join(', ')
        });
      }
    }
  });

  console.log('[Division] Pass 1 자동 검증 완료:', issues.length, '건 이슈');
  return issues;
};

// ═══ T13: Pass 2 — LLM 검증 프롬프트 강화 ═══
Division._buildVerifyPrompt = function(claimsText, specText, origClaimsText){
  var principles = Division.DIVISION_PRINCIPLES;
  var p = Division.state.current;
  var divType = p ? p.division_type : 'merge';

  // 유형별 추가 검증 지시
  var typeSpecific = '';
  if(divType === 'merge'){
    typeSpecific = '\n[유형별 검증 — 병합형]\n' +
      '- basis 보존: 등록결정 청구항(A+B+C)이 독립항에 원문 그대로 포함되었는지 확인\n' +
      '- 추가 구성(D)만 명세서 뒷받침 여부 중점 확인\n';
  } else if(divType === 'category_change'){
    typeSpecific = '\n[유형별 검증 — 카테고리변경형]\n' +
      '- 변환 구성요소명(~부, ~수단)이 명세서에 실제 기재되어 있는지 확인\n' +
      '- A+B+C의 기술적 내용이 변환 후에도 보존되었는지 확인\n';
  } else if(divType === 'strategic'){
    typeSpecific = '\n[유형별 검증 — 전략형]\n' +
      '- 새 독립항의 모든 구성요소에 명세서 단락번호 1:1 대응이 있는지 확인\n' +
      '- 원출원 범위를 초과하는 신규사항이 없는지 특히 엄격하게 확인\n';
  }

  // V9: 실질적 뒷받침 판단 기준
  var supportGuidelines =
    '\n[뒷받침 판단 기준 — 실무 수준]\n\n' +
    '"뒷받침된다"는 것은 동일한 단어가 명세서에 있다는 것이 아니다.\n' +
    '명세서의 기술적 내용이 해당 청구항 구성을 실질적으로 설명하고 있으면 뒷받침이 인정된다.\n\n' +
    '판단 절차:\n' +
    '1. 청구항의 각 구성요소를 분리한다\n' +
    '2. 각 구성요소에 대해 명세서에서 대응하는 기술적 설명을 찾는다\n' +
    '3. 대응 관계를 판단한다:\n' +
    '   - "direct" (직접 기재): 명세서에 동일/거의 동일한 표현 있음 → pass\n' +
    '   - "substantial" (실질적 뒷받침): 표현은 다르지만 동일 기술적 개념 → pass\n' +
    '     (근거 단락번호 + 대응 설명 기재)\n' +
    '   - "derivable" (자명한 도출): 명세서 내용에서 당업자가 도출 가능 → warning\n' +
    '     (근거 단락번호 + 도출 논리 기재)\n' +
    '   - "none" (근거 없음): 명세서에 대응하는 기술적 내용 없음 → fail\n\n' +
    '예시:\n' +
    '- 청구항 "정합성 검증부" vs 명세서 "무결성 확인 모듈"\n' +
    '  → pass (substantial, 동일 기술적 개념)\n' +
    '- 청구항 "딥러닝 기반 분석부" vs 명세서 "기계학습 모델을 활용한 분석"\n' +
    '  → warning (derivable, 딥러닝⊂기계학습이지만 명세서가 딥러닝을 특정하지 않음)\n' +
    '- 청구항 "블록체인 인증 모듈" vs 명세서에 블록체인 언급 없음\n' +
    '  → fail (none, 신규사항)\n\n' +
    '★ 단순 키워드 매칭으로 "용어가 다르다"고 바로 fail 처리하면 안 됨\n' +
    '★ 명세서에서 동일한 기술적 개념을 다른 표현으로 설명하는 경우를 반드시 인식하라\n';

  return principles +
    typeSpecific +
    supportGuidelines +
    '\n아래 분할출원 청구항에 대해 검증을 수행하라.\n' +
    '\n[분할출원 청구항]\n'+claimsText+
    '\n\n[원출원 등록 청구항 (중복 체크 대상)]\n'+(origClaimsText||'(없음)')+
    '\n\n[명세서 전문]\n'+(specText||'(없음)').substring(0,40000)+
    '\n\n검증 항목 — 우선순위순 (3유형 공통):\n' +
    '1순위 [CRITICAL] new_matter (신규사항 검증):\n' +
    '  - 분할 청구항의 모든 구성이 원출원 명세서에 직접 기재된 사항인지 확인\n' +
    '  - 명세서에 없는 용어/개념이 포함되어 있으면 fail\n' +
    '  - 각 구성에 대해 해당 명세서 단락번호를 특정하라\n' +
    '2순위 [CRITICAL] basis_scope (basis 보존 / 원출원 범위 내 검증):\n' +
    '  - 병합형: basis 원문이 독립항에 그대로 보존되었는지\n' +
    '  - 카테고리변경형: 기술적 내용이 보존되었는지\n' +
    '  - 전략형: 모든 구성이 원출원 명세서 범위 내인지\n' +
    '3순위 [HIGH] double_patenting (이중 특허 방지):\n' +
    '  - 분할 독립항이 원출원 등록 청구항과 실질적으로 동일하면 안 됨\n' +
    '  - 추가/변환/신규 부분이 실질적 차이를 만드는지 확인\n' +
    '4순위 [HIGH] spec_support (뒷받침 검증):\n' +
    '  - 위의 [뒷받침 판단 기준]을 적용하여 각 구성요소를 검증\n' +
    '  - support_type을 반드시 기재 (direct/substantial/derivable/none)\n' +
    '  - spec_quote로 명세서 원문 30자 이내 발췌\n' +
    '5순위 [MEDIUM] format (형식 검증):\n' +
    '  - 마침표(.) 누락, "상기" 일관성, 종속항 인용 정확성\n' +
    '  - 추상적 표현, 기능적 기재 존재 여부\n' +
    '\n★ 검증은 반드시 구체적 target_text(해당 구절)를 포함하여 어디가 문제인지 특정하라.\n' +
    '★ 각 결과에 명세서 근거 단락번호(spec_paragraph_number)를 반드시 포함하라.\n' +
    '\n★★★ JSON만 출력. ★★★\n\n출력 JSON:\n' +
    '{"overall":"pass|warning|fail","results":[{' +
    '"check_type":"new_matter|basis_scope|double_patenting|spec_support|format",' +
    '"target_text":"검증 대상 청구항 구절",' +
    '"result":"pass|warning|fail",' +
    '"detail":"구체적 분석 (명세서 단락 인용 포함)",' +
    '"suggestion":"수정 제안",' +
    '"spec_paragraph_number":"근거 명세서 단락번호",' +
    '"spec_quote":"명세서 근거 원문 30자 이내 발췌",' +
    '"support_type":"direct|substantial|derivable|none"}]}';
};

// ═══════════════════════════════════════════
// 15. Checkpoint 4 화면: 검증 결과
// ═══════════════════════════════════════════
Division.renderVerify = function(left, right, p){
  var results = Division.state.validationResults;
  var h = '';

  // T14: Pass 1 (코드 자동 검증) 결과 — 메모리 또는 DB에서 추출
  var autoIssues = Division.state._autoVerifyIssues || [];
  if(!autoIssues.length){
    results.forEach(function(r){ if(r.auto_verify_issues && r.auto_verify_issues.length) autoIssues = autoIssues.concat(r.auto_verify_issues); });
  }

  // ─── T17: Pass 1 — 자동 검증 (코드) ───
  var severityIcons = {CRITICAL:'🔴',HIGH:'🟠',MEDIUM:'🟡'};
  h += '<div class="card division-autocheck-section">';
  h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">🔍</span> 자동 검증 (코드)</div>';
  if(!autoIssues.length){
    h += '<div class="division-autocheck-pass">✅ 코드 레벨 검증 통과 — 자동 감지된 이슈 없음</div>';
  } else {
    autoIssues.forEach(function(issue){
      var icon = severityIcons[issue.severity] || '🟡';
      h += '<div class="division-autocheck-item severity-'+issue.severity+'">';
      h += '<div class="division-autocheck-header">';
      h += '<span>'+icon+'</span><span class="division-severity-badge severity-'+issue.severity+'">'+issue.severity+'</span>';
      h += '<span class="division-check-tag">'+escapeHtml(issue.check)+'</span>';
      h += '</div>';
      h += '<div style="font-size:13px;font-weight:500">'+escapeHtml(issue.message)+'</div>';
      if(issue.detail) h += '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px">'+escapeHtml(issue.detail)+'</div>';
      h += '</div>';
    });
  }
  h += '</div>';

  // ─── Pass 2: AI 검증 (LLM) ───
  var passCount = results.filter(function(r){ return r.result==='pass'; }).length;
  var warnCount = results.filter(function(r){ return r.result==='warning'; }).length;
  var failCount = results.filter(function(r){ return r.result==='fail'; }).length;
  h += '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">🤖</span> AI 검증 (LLM)</div>';
  h += '<div class="division-val-summary"><div class="division-val-stat pass">✅ 통과 '+passCount+'</div><div class="division-val-stat warn">⚠️ 주의 '+warnCount+'</div><div class="division-val-stat fail">❌ 실패 '+failCount+'</div></div>';
  var typeLabels = {new_matter:'신규사항',basis_scope:'basis 보존/원출원 범위',double_patenting:'이중 특허',spec_support:'명세서 뒷받침',support:'명세서 뒷받침',format:'형식',abstract_expression:'추상적 표현',functional_limitation:'기능적 기재',overlap:'구성 중복'};
  if(!results.length){ h += '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">검증 결과가 없습니다.</div>'; }
  else { results.forEach(function(vr, vrIdx){
    var resultCss = vr.result==='pass'?'vr-pass':vr.result==='warning'?'vr-warn':'vr-fail';
    var resultIcon = vr.result==='pass'?'✅':vr.result==='warning'?'⚠️':'❌';
    var typeLabel = typeLabels[vr.check_type]||vr.check_type;
    h += '<div class="division-val-row '+resultCss+'" id="divValRow'+vrIdx+'" onclick="this.classList.toggle(\'expanded\')">';
    h += '<div class="division-val-row-header"><span>'+resultIcon+'</span><span style="font-weight:500;flex:1">'+typeLabel+'</span><span class="division-val-result-badge '+resultCss+'">'+vr.result+'</span></div>';
    h += '<div class="division-val-row-body">';
    if(vr.target_text) h += '<div style="margin-bottom:6px"><strong>대상:</strong> '+escapeHtml(vr.target_text)+'</div>';
    if(vr.detail) h += '<div style="margin-bottom:6px">'+escapeHtml(vr.detail)+'</div>';
    if(vr.suggestion) h += '<div style="padding:8px;background:var(--color-primary-light);border-radius:var(--radius-sm);border-left:3px solid var(--color-primary)">💡 '+escapeHtml(vr.suggestion)+'</div>';
    if(vr.spec_paragraph_number) h += '<div style="margin-top:4px;font-size:11px;color:var(--color-text-tertiary)">근거: 【'+vr.spec_paragraph_number+'】'+(vr.spec_quote?' — "'+escapeHtml(vr.spec_quote)+'"':'')+'</div>';
    if(vr.support_type){ var stLabels={direct:'직접 기재',substantial:'실질적 뒷받침',derivable:'자명한 도출',none:'근거 없음'}; var stColors={direct:'var(--color-success)',substantial:'var(--color-success)',derivable:'var(--color-warning)',none:'var(--color-error)'}; h+='<div style="margin-top:2px;font-size:11px;color:'+stColors[vr.support_type]+'">뒷받침: '+(stLabels[vr.support_type]||vr.support_type)+'</div>'; }
    // V2: 액션 버튼 (warning/fail 항목에만)
    if(vr.result === 'warning' || vr.result === 'fail'){
      h += '<div class="division-val-actions" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--color-divider);display:flex;gap:6px;flex-wrap:wrap">';
      if(vr.result === 'warning'){
        h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();Division.acceptWarning('+vrIdx+')" title="실질적 뒷받침 인정">✅ 수용</button>';
      }
      if(vr.result === 'fail'){
        h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px;color:var(--color-error)" onclick="event.stopPropagation();Division.removeFailedComponent('+vrIdx+')" title="해당 구성 제거 후 분석 화면으로 이동">🗑️ 구성 제거</button>';
      }
      h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();Division.editClaimText('+vrIdx+')" title="청구항 문언 직접 수정">✏️ 수정</button>';
      h += '<button class="btn btn-ghost division-val-action-btn" style="font-size:11px;padding:4px 10px" onclick="event.stopPropagation();Division.specifyBasis('+vrIdx+')" title="뒷받침 근거 단락 지정">📄 근거 지정</button>';
      h += '</div>';
    }
    h += '</div></div>';
  }); }
  h += '</div>';
  left.innerHTML = h;

  var rh = '<div class="card" style="padding:16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">🏷️</span> 발명의 명칭</div>';

  // 원출원 명칭 표시
  if(p.original_title_ko){
    rh += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:10px;padding:8px 10px;background:var(--color-bg-tertiary);border-radius:var(--radius-sm)">';
    rh += '<div><strong>원출원:</strong> ' + escapeHtml(p.original_title_ko) + '</div>';
    if(p.original_title_en) rh += '<div style="margin-top:2px;font-size:11px">' + escapeHtml(p.original_title_en) + '</div>';
    rh += '</div>';
  }

  // 명칭 선택: 원출원 동일 / AI 제안 / 직접 입력
  rh += '<div style="font-size:12px;font-weight:600;color:var(--color-text-secondary);margin-bottom:8px">분할출원 명칭 선택</div>';

  // 옵션 0: 원출원과 동일
  if(p.original_title_ko){
    rh += '<label class="division-title-option"><input type="radio" name="divisionTitle" value="original" checked /><div>';
    rh += '<div style="font-size:13px;font-weight:500">원출원과 동일</div>';
    rh += '<div style="font-size:11px;color:var(--color-text-tertiary)">' + escapeHtml(p.original_title_ko) + '</div>';
    rh += '</div></label>';
  }

  // 옵션 1~N: AI 제안
  var candidates = p.title_candidates || [];
  if(candidates.length > 0){
    candidates.forEach(function(tc,i){
      rh += '<label class="division-title-option"><input type="radio" name="divisionTitle" value="'+i+'"' + (!p.original_title_ko && i===0 ? ' checked' : '') + ' /><div>';
      rh += '<div style="font-size:13px;font-weight:500">'+escapeHtml(tc.ko)+'</div>';
      rh += '<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">'+escapeHtml(tc.en)+'</div></div></label>';
    });
  }

  // 옵션: 직접 입력
  rh += '<label class="division-title-option"><input type="radio" name="divisionTitle" value="custom" onchange="Division.onTitleRadioChange()" /><div style="flex:1">';
  rh += '<div style="font-size:13px;font-weight:500;margin-bottom:6px">직접 입력</div>';
  rh += '<input type="text" class="input-field" id="divisionCustomTitle" placeholder="국문 명칭" style="font-size:13px;padding:6px 10px;margin-bottom:4px" />';
  rh += '<input type="text" class="input-field" id="divisionCustomTitleEn" placeholder="영문 명칭" style="font-size:13px;padding:6px 10px" />';
  rh += '</div></label>';

  // ⚠️ 명칭 변경 시 경고
  rh += '<div id="divisionTitleWarning" class="division-title-warning" style="display:none">';
  rh += '<div style="font-weight:600;margin-bottom:4px">⚠️ 발명의 명칭 변경 시 유의사항</div>';
  rh += '<div style="font-size:12px;line-height:1.7">';
  rh += '분할출원의 명칭을 원출원과 다르게 하는 경우, 명세서의 다음 부분도 함께 변경해야 합니다:';
  rh += '<ul style="margin:6px 0 0 16px;padding:0"><li>【발명의 명칭】 항목</li><li>【요약서】의 발명 제목</li><li>【국제특허분류】가 달라지는 경우 IPC 코드</li><li>출원서 표지의 발명의 명칭란</li></ul>';
  rh += '명칭 변경은 분할출원의 권리범위 해석에 영향을 줄 수 있으므로 신중히 결정하세요.';
  rh += '</div></div>';
  rh += '</div>';
  // V2: 검증 상태별 안내 메시지 + 버튼 활성화 제어
  if(failCount > 0){
    rh += '<div style="margin-top:12px;padding:12px;background:var(--color-error-light);border-radius:var(--radius-sm);font-size:13px;color:var(--color-error)">❌ 검증 실패 항목 '+failCount+'건 — 해당 구성을 제거하거나 문언을 수정한 후 재검증하세요.</div>';
  } else if(warnCount > 0){
    rh += '<div style="margin-top:12px;padding:12px;background:var(--color-warning-light);border-radius:var(--radius-sm);font-size:13px;color:#92400e">⚠️ 주의 항목 '+warnCount+'건 — 각 항목을 검토하여 "수용" 또는 "수정"을 선택하세요. 모든 항목을 처리하면 최종 확정할 수 있습니다.</div>';
  } else {
    rh += '<div style="margin-top:12px;padding:12px;background:#d1fae5;border-radius:var(--radius-sm);font-size:13px;color:#065f46">✅ 모든 검증 통과 — 최종 확정할 수 있습니다.</div>';
  }
  rh += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-ghost" onclick="Division.runVerify()" style="flex:1;padding:12px"><span class="tf">🔄</span> 재검증</button>';
  var canConfirm = failCount === 0;
  rh += '<button class="btn btn-primary" onclick="Division.confirmFinal()" style="flex:1;padding:12px'+(canConfirm?'':';opacity:0.5')+'"'+(canConfirm?'':' title="fail 항목을 먼저 해결하세요"')+'><span class="tf">🏁</span> 최종 확정</button></div>';
  right.innerHTML = rh;
  Division._bindTitleRadios();
};

// ═══════════════════════════════════════════
// 15-1. 검증 결과 액션 (V3/V4 + V5/V6 스텁)
// ═══════════════════════════════════════════

// V3: warning 수용 — pass로 전환 + 사유 기록
Division.acceptWarning = async function(vrIdx){
  var results = Division.state.validationResults;
  var vr = results[vrIdx];
  if(!vr || vr.result !== 'warning'){ showToast('수용할 수 없는 항목입니다','error'); return; }

  var reason = prompt('수용 사유를 입력하세요 (예: 실질적 뒷받침 인정, 동일 기술적 개념)');
  if(!reason) return;

  // DB 업데이트: result → pass
  try {
    await sb.from('division_validation_results').update({ result:'pass' }).eq('id', vr.id);
    vr.result = 'pass';
    console.log('[Division] V3 수용: 항목', vrIdx, '→ pass, 사유:', reason);

    // user_accepted_warnings 기록 시도 (컬럼 있을 때만)
    try {
      var accepted = vr.user_accepted_warnings || [];
      accepted.push({ check_index:vrIdx, reason:reason, timestamp:new Date().toISOString() });
      await sb.from('division_validation_results').update({ user_accepted_warnings:accepted }).eq('id', vr.id);
    } catch(e){ console.warn('[Division] user_accepted_warnings 저장 실패 (컬럼 미존재?):', e.message); }

    showToast('항목을 수용했습니다 (pass로 전환)', 'success');
    Division.renderStay();
  } catch(e){ showToast('수용 처리 실패: '+e.message, 'error'); }
};

// V4: 구성 제거 — 해당 구성 선택 해제 + 분석 화면으로 복귀
Division.removeFailedComponent = async function(vrIdx){
  var results = Division.state.validationResults;
  var vr = results[vrIdx];
  if(!vr){ showToast('항목을 찾을 수 없습니다','error'); return; }

  var targetText = vr.target_text || vr.detail || '';
  if(!confirm('이 구성을 제거하고 분석 화면으로 돌아가시겠습니까?\n\n대상: ' + targetText.substring(0,100))) return;

  // target_text와 매칭되는 unused_component 찾아서 선택 해제
  var unused = Division.state.unusedComponents;
  var matched = null;
  if(targetText){
    for(var i=0; i<unused.length; i++){
      if(unused[i].content && targetText.indexOf(unused[i].content.substring(0,30)) >= 0){
        matched = unused[i]; break;
      }
      if(unused[i].insertion_point && targetText.indexOf(unused[i].insertion_point.substring(0,30)) >= 0){
        matched = unused[i]; break;
      }
    }
  }

  if(matched){
    try {
      await sb.from('division_unused_components').update({user_selection:'excluded'}).eq('id', matched.id);
      matched.user_selection = 'excluded';
      console.log('[Division] V4 구성 제거:', matched.content.substring(0,50));
    } catch(e){ console.warn('[Division] 구성 해제 실패:', e.message); }
  }

  // 분석 화면으로 복귀 — 사용자가 다른 D를 선택할 수 있도록
  var p = Division.state.current;
  if(p){
    await sb.from('division_projects').update({status:'analyzed', updated_at:new Date().toISOString()}).eq('id', p.id);
    p.status = 'analyzed';
  }
  Division.state.currentStepKey = 'analyze';
  showToast('구성이 제거되었습니다. 다른 구성을 선택하고 재조립하세요.', 'info');
  Division.renderStay();
};

// ═══ V5: 청구항 문언 직접 수정 ═══
Division.editClaimText = function(vrIdx){
  var results = Division.state.validationResults;
  var vr = results[vrIdx];
  if(!vr){ showToast('항목을 찾을 수 없습니다','error'); return; }

  // 문제가 된 청구항 찾기 — target_text로 매칭
  var divClaims = Division.state.divisionClaims;
  var targetClaim = null;
  if(vr.target_text){
    for(var i=0; i<divClaims.length; i++){
      if(divClaims[i].claim_text && divClaims[i].claim_text.indexOf(vr.target_text.substring(0,30)) >= 0){
        targetClaim = divClaims[i]; break;
      }
    }
  }
  if(!targetClaim && divClaims.length > 0) targetClaim = divClaims[0]; // 폴백: 첫 번째 청구항

  var rowEl = document.getElementById('divValRow'+vrIdx);
  if(!rowEl) return;
  // 이미 편집 중이면 무시
  if(rowEl.querySelector('.division-edit-area')) return;
  rowEl.classList.add('expanded');

  var bodyEl = rowEl.querySelector('.division-val-row-body');
  if(!bodyEl) return;

  var claimText = targetClaim ? targetClaim.claim_text : '';
  var editHtml = '<div class="division-edit-area" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--color-divider)">';
  editHtml += '<div style="font-size:12px;font-weight:600;margin-bottom:6px">✏️ 청구항 '+((targetClaim&&targetClaim.claim_number)||'?')+' 문언 수정</div>';
  editHtml += '<textarea id="divEditClaim'+vrIdx+'" style="width:100%;min-height:120px;font-size:12px;line-height:1.7;padding:10px;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-family:var(--font-family);resize:vertical">'+escapeHtml(claimText)+'</textarea>';
  editHtml += '<div style="display:flex;gap:6px;margin-top:8px">';
  editHtml += '<button class="btn btn-primary" style="font-size:11px;padding:6px 14px" onclick="Division._submitClaimEdit('+vrIdx+',\''+((targetClaim&&targetClaim.id)||'')+'\')">재검증 실행</button>';
  editHtml += '<button class="btn btn-ghost" style="font-size:11px;padding:6px 14px" onclick="this.closest(\'.division-edit-area\').remove()">취소</button>';
  editHtml += '</div></div>';
  bodyEl.insertAdjacentHTML('beforeend', editHtml);
};

Division._submitClaimEdit = async function(vrIdx, claimId){
  var textarea = document.getElementById('divEditClaim'+vrIdx);
  if(!textarea){ showToast('편집 영역을 찾을 수 없습니다','error'); return; }
  var newText = textarea.value.trim();
  if(!newText){ showToast('청구항 내용을 입력하세요','error'); return; }

  // 수정 전 텍스트 저장
  var dc = Division.state.divisionClaims.find(function(c){ return c.id === claimId; });
  var beforeText = dc ? dc.claim_text : '';

  // DB 업데이트
  if(claimId){
    try {
      await sb.from('division_claims_output').update({ claim_text:newText, claim_text_highlighted:newText }).eq('id', claimId);
      if(dc) dc.claim_text = newText;
    } catch(e){ showToast('청구항 저장 실패: '+e.message,'error'); return; }
  }

  // 수정 이력을 메모리에 보관
  if(!Division.state._revisionHistory) Division.state._revisionHistory = [];
  Division.state._revisionHistory.push({
    round: Division.state._revisionHistory.length + 1,
    action: 'edit_claim',
    before: beforeText.substring(0,500),
    after: newText.substring(0,500),
    reason: '문언 직접 수정 (검증 항목 '+vrIdx+')',
    timestamp: new Date().toISOString()
  });

  showToast('청구항이 수정되었습니다. 재검증을 실행합니다...', 'info');
  // V8: 재검증 실행
  Division.runReVerify({ beforeText:beforeText, afterText:newText, reason:'문언 직접 수정' });
};

// ═══ V6: 뒷받침 근거 단락 지정 ═══
Division.specifyBasis = function(vrIdx){
  var results = Division.state.validationResults;
  var vr = results[vrIdx];
  if(!vr){ showToast('항목을 찾을 수 없습니다','error'); return; }

  var rowEl = document.getElementById('divValRow'+vrIdx);
  if(!rowEl) return;
  if(rowEl.querySelector('.division-basis-area')) return;
  rowEl.classList.add('expanded');

  var bodyEl = rowEl.querySelector('.division-val-row-body');
  if(!bodyEl) return;

  // 명세서 단락 목록
  var paragraphs = Division.state.specParagraphs || [];
  var basisHtml = '<div class="division-basis-area" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--color-divider)">';
  basisHtml += '<div style="font-size:12px;font-weight:600;margin-bottom:6px">📄 근거 단락 지정</div>';
  basisHtml += '<input type="text" id="divBasisSearch'+vrIdx+'" placeholder="단락번호 또는 내용으로 검색..." style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:8px;font-family:var(--font-family)" oninput="Division._filterBasisList('+vrIdx+')" />';
  basisHtml += '<div id="divBasisList'+vrIdx+'" style="max-height:200px;overflow-y:auto;border:1px solid var(--color-border);border-radius:var(--radius-sm)">';
  if(!paragraphs.length){
    basisHtml += '<div style="padding:12px;font-size:12px;color:var(--color-text-tertiary)">명세서 단락이 없습니다. 파싱을 먼저 실행해 주세요.</div>';
  } else {
    paragraphs.forEach(function(para){
      basisHtml += '<label class="division-basis-item" style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-bottom:1px solid var(--color-divider);cursor:pointer;font-size:12px" data-para-num="'+para.paragraph_number+'" data-para-content="'+escapeHtml((para.content||'').substring(0,100)).toLowerCase()+'">';
      basisHtml += '<input type="checkbox" data-basis-para="'+para.paragraph_number+'" style="margin-top:2px;flex-shrink:0" />';
      basisHtml += '<div><strong>【'+para.paragraph_number+'】</strong> '+escapeHtml((para.content||'').substring(0,150))+(para.content&&para.content.length>150?'...':'')+'</div>';
      basisHtml += '</label>';
    });
  }
  basisHtml += '</div>';
  basisHtml += '<div style="display:flex;gap:6px;margin-top:8px">';
  basisHtml += '<button class="btn btn-primary" style="font-size:11px;padding:6px 14px" onclick="Division._submitBasisSpec('+vrIdx+')">이 단락으로 재검증</button>';
  basisHtml += '<button class="btn btn-ghost" style="font-size:11px;padding:6px 14px" onclick="this.closest(\'.division-basis-area\').remove()">취소</button>';
  basisHtml += '</div></div>';
  bodyEl.insertAdjacentHTML('beforeend', basisHtml);
};

Division._filterBasisList = function(vrIdx){
  var input = document.getElementById('divBasisSearch'+vrIdx);
  var query = (input ? input.value : '').toLowerCase();
  var items = document.querySelectorAll('#divBasisList'+vrIdx+' .division-basis-item');
  items.forEach(function(item){
    var num = item.dataset.paraNum || '';
    var content = item.dataset.paraContent || '';
    item.style.display = (num.indexOf(query) >= 0 || content.indexOf(query) >= 0) ? '' : 'none';
  });
};

Division._submitBasisSpec = async function(vrIdx){
  var checked = document.querySelectorAll('#divBasisList'+vrIdx+' input[data-basis-para]:checked');
  if(!checked.length){ showToast('근거 단락을 1개 이상 선택하세요','error'); return; }

  var selectedParas = [];
  var paragraphs = Division.state.specParagraphs || [];
  checked.forEach(function(cb){
    var num = cb.dataset.basisPara;
    var para = paragraphs.find(function(p){ return p.paragraph_number === num; });
    selectedParas.push({ number:num, content: para ? para.content : '' });
  });

  // 수정 이력
  if(!Division.state._revisionHistory) Division.state._revisionHistory = [];
  Division.state._revisionHistory.push({
    round: Division.state._revisionHistory.length + 1,
    action: 'add_basis',
    before: '',
    after: selectedParas.map(function(p){ return '【'+p.number+'】'; }).join(', '),
    reason: '근거 단락 지정 (검증 항목 '+vrIdx+')',
    timestamp: new Date().toISOString()
  });

  showToast('근거 단락이 지정되었습니다. 재검증을 실행합니다...', 'info');
  Division.runReVerify({
    userSpecifiedParagraphs: selectedParas,
    reason: '사용자가 근거 단락을 지정함: ' + selectedParas.map(function(p){ return '【'+p.number+'】'; }).join(', ')
  });
};

// ═══ V7: 재검증 프롬프트 ═══
Division._buildReVerifyPrompt = function(claimsText, specText, origClaimsText, editContext){
  var principles = Division.DIVISION_PRINCIPLES;

  var contextBlock = '';
  if(editContext.beforeText && editContext.afterText){
    contextBlock += '\n[수정 전 청구항]\n' + editContext.beforeText +
      '\n\n[수정 후 청구항]\n' + editContext.afterText +
      '\n\n[수정 사유]\n' + (editContext.reason||'문언 수정');
  }
  if(editContext.userSpecifiedParagraphs && editContext.userSpecifiedParagraphs.length > 0){
    contextBlock += '\n\n[사용자 지정 근거 단락]\n';
    editContext.userSpecifiedParagraphs.forEach(function(p){
      contextBlock += '【'+p.number+'】 '+p.content+'\n';
    });
    contextBlock += '\n→ 위 단락이 해당 구성을 실질적으로 뒷받침하는지 집중 검토하라.';
  }

  return principles +
    '\n\n아래 분할출원 청구항이 수정되었다. 수정 전후를 비교하고,\n' +
    '수정 후 청구항이 원출원 명세서에 의해 뒷받침되는지 재검증하라.\n' +
    contextBlock +
    '\n\n[현재 분할출원 청구항]\n' + claimsText +
    '\n\n[원출원 등록 청구항]\n' + (origClaimsText||'(없음)') +
    '\n\n[명세서 전문]\n' + (specText||'(없음)').substring(0,40000) +
    '\n\n[뒷받침 판단 기준]\n' +
    '"뒷받침된다"는 것은 동일한 단어가 명세서에 있다는 것이 아니다.\n' +
    '명세서의 기술적 내용이 해당 청구항 구성을 실질적으로 설명하고 있으면 뒷받침이 인정된다.\n' +
    '- "direct": 동일 표현 → pass\n' +
    '- "substantial": 다른 표현이나 동일 기술적 개념 → pass\n' +
    '- "derivable": 당업자 도출 가능 → warning\n' +
    '- "none": 근거 없음 → fail\n' +
    '\n검증 항목: 신규사항 → basis 보존 → 이중특허 → 뒷받침 → 형식\n' +
    '\n★★★ JSON만 출력. ★★★\n\n출력 JSON:\n' +
    '{"overall":"pass|warning|fail","results":[{' +
    '"check_type":"new_matter|basis_scope|double_patenting|spec_support|format",' +
    '"target_text":"구절","result":"pass|warning|fail",' +
    '"detail":"분석","suggestion":"제안",' +
    '"spec_paragraph_number":"단락번호",' +
    '"spec_quote":"원문 30자","support_type":"direct|substantial|derivable|none"}]}';
};

// ═══ V8: 재검증 실행 흐름 ═══
Division.runReVerify = async function(editContext){
  var p = Division.state.current; if(!p) return;
  if(!App.ensureApiKey()){ App.openProfileSettings(); return; }
  var capturedId = p.id;
  Division.state._runningProjectId = capturedId;

  try {
    // 상태 전이: re_verifying
    await sb.from('division_projects').update({status:'re_verifying', updated_at:new Date().toISOString()}).eq('id', p.id);
    p.status = 're_verifying';

    var right = document.getElementById('divisionDetailRight');
    if(right) right.innerHTML = '<div class="card" style="padding:20px;text-align:center"><div style="font-size:32px;margin-bottom:12px"><span class="tf">🔄</span></div><div style="font-size:14px;font-weight:600;margin-bottom:8px">재검증 진행 중...</div><div id="divisionReVerifyProgress"></div></div>';

    // 1) 청구항 텍스트
    App.showProgress('divisionReVerifyProgress','재검증 준비 중...',1,5);
    var divClaims = Division.state.divisionClaims;
    var claimsText = divClaims.map(function(dc){ return '【청구항 '+dc.claim_number+'】\n'+dc.claim_text; }).join('\n\n');

    // 2) 명세서 전문
    App.showProgress('divisionReVerifyProgress','명세서 로드 중...',2,5);
    var specText = p.spec_full_text || '';
    if(!specText || specText.length < 500){
      try {
        var {data:projSpec} = await sb.from('division_projects').select('spec_full_text').eq('id', p.id).single();
        specText = (projSpec && projSpec.spec_full_text) || '';
        if(specText) p.spec_full_text = specText;
      } catch(e){ console.warn('[Division] spec_full_text 조회 실패:', e.message); }
    }
    if(!specText || specText.length < 500){
      var paras = Division.state.specParagraphs || [];
      specText = paras.map(function(para){ return '【'+para.paragraph_number+'】 '+para.content; }).join('\n');
    }

    // 3) 원출원 청구항
    var origClaimsText = Division.state.claims.map(function(c){
      return '제'+c.claim_number+'항: '+(c.amended_text||c.original_text||'').substring(0,1000);
    }).join('\n');

    // 4) Pass 1: 코드 레벨 자동 검증
    App.showProgress('divisionReVerifyProgress','자동 검증 (Pass 1)...',3,5);
    var basisClaim = Division.state.claims.find(function(c){ return c.division_role==='basis'; }) ||
      Division.state.claims.find(function(c){ return c.claim_type==='independent'; });
    var autoIssues = Division.runAutoVerify(divClaims, basisClaim, Division.state.claims, specText, p.division_type);
    Division.state._autoVerifyIssues = autoIssues;

    // 5) Pass 2: LLM 재검증
    App.showProgress('divisionReVerifyProgress','AI 재검증 (Pass 2)...',4,5);
    var reVerifyPrompt = Division._buildReVerifyPrompt(claimsText, specText, origClaimsText, editContext || {});
    var result = await Division.callAI(reVerifyPrompt);
    if(Division._checkProjectStale(capturedId)){ console.warn('[Division] 재검증 중 프로젝트 전환됨'); App.clearProgress('divisionReVerifyProgress'); return; }

    App.showProgress('divisionReVerifyProgress','결과 저장 중...',5,5);
    var verified;
    try { verified = Division._extractJSON(result.text); }
    catch(e) { showToast('재검증 결과 해석 실패: '+e.message.substring(0,80),'error'); App.clearProgress('divisionReVerifyProgress'); return; }

    // DB 저장
    var VALID_CHECK = ['new_matter','basis_scope','double_patenting','spec_support','support','format','abstract_expression','functional_limitation','overlap'];
    var VALID_RESULT = ['pass','warning','fail'];
    var sEnum = Division._sanitizeEnum;

    await sb.from('division_validation_results').delete().eq('project_id',p.id);
    if(verified.results && verified.results.length > 0){
      var rows = verified.results.map(function(vr){
        return {
          project_id:p.id,
          check_type:sEnum(vr.check_type,VALID_CHECK,'format'),
          target_text:(vr.target_text||'').substring(0,5000),
          result:sEnum(vr.result,VALID_RESULT,'pass'),
          detail:(vr.detail||'').substring(0,5000),
          suggestion:(vr.suggestion||'').substring(0,5000),
          spec_paragraph_number:vr.spec_paragraph_number ? String(vr.spec_paragraph_number).substring(0,20) : null
        };
      });
      await sb.from('division_validation_results').insert(rows);
    }

    // 상태: verified로 복귀
    await sb.from('division_projects').update({status:'verified', updated_at:new Date().toISOString()}).eq('id', p.id);
    p.status = 'verified';
    App.clearProgress('divisionReVerifyProgress');
    showToast('재검증 완료!');
    Division.state.currentStepKey = 'verify';
    await Division.loadData(p.id);
  } catch(e) {
    App.clearProgress('divisionReVerifyProgress');
    // 에러 시 verified 상태로 복귀
    try { await sb.from('division_projects').update({status:'verified'}).eq('id', p.id); p.status='verified'; } catch(e2){}
    showToast('재검증 실패: '+e.message,'error');
  }
};

// ═══════════════════════════════════════════
// 16. 최종 확정
// ═══════════════════════════════════════════
Division.onTitleRadioChange = function(){
  var sel = document.querySelector('input[name="divisionTitle"]:checked');
  var warn = document.getElementById('divisionTitleWarning');
  if(!warn) return;
  // 원출원과 동일이 아닌 옵션 선택 시 경고 표시
  warn.style.display = (sel && sel.value !== 'original') ? 'block' : 'none';
};

// 타이틀 라디오 변경 이벤트 바인딩 (renderVerify 후)
Division._bindTitleRadios = function(){
  setTimeout(function(){
    document.querySelectorAll('input[name="divisionTitle"]').forEach(function(r){
      r.addEventListener('change', Division.onTitleRadioChange);
    });
  }, 0);
};

Division.confirmFinal = async function(){
  var p = Division.state.current; if(!p) return;
  var sel = document.querySelector('input[name="divisionTitle"]:checked');
  var titleKo = '', titleEn = '', candidates = p.title_candidates || [];
  if(sel){
    if(sel.value === 'original'){
      titleKo = p.original_title_ko || '';
      titleEn = p.original_title_en || '';
    } else if(sel.value === 'custom'){
      titleKo = (document.getElementById('divisionCustomTitle')?.value || '').trim();
      titleEn = (document.getElementById('divisionCustomTitleEn')?.value || '').trim();
    } else {
      var idx = parseInt(sel.value);
      if(candidates[idx]){ titleKo = candidates[idx].ko; titleEn = candidates[idx].en; }
    }
  } else {
    titleKo = (document.getElementById('divisionCustomTitle')?.value || '').trim();
    titleEn = (document.getElementById('divisionCustomTitleEn')?.value || '').trim();
  }
  if(!titleKo){ showToast('발명의 명칭을 선택하거나 입력해 주세요','error'); return; }

  // 명칭 변경 여부 확인
  var titleChanged = p.original_title_ko && titleKo !== p.original_title_ko;
  if(titleChanged){
    if(!confirm('발명의 명칭이 원출원과 다릅니다.\n명세서의 【발명의 명칭】, 【요약서】 등도 함께 수정해야 합니다.\n계속하시겠습니까?')) return;
  }

  try {
    await sb.from('division_projects').update({ status:'confirmed', title_ko:titleKo, title_en:titleEn, title_changed:titleChanged||false, updated_at:new Date().toISOString() }).eq('id',p.id);
    p.status='confirmed'; p.title_ko=titleKo; p.title_en=titleEn; p.title_changed=titleChanged||false;
    showToast('최종 확정 완료!');
    Division.state.currentStepKey = 'confirm';
    Division.renderDetail();
  } catch(e) { showToast('확정 실패: '+e.message,'error'); }
};

// ═══════════════════════════════════════════
// 17. 최종 출력 화면
// ═══════════════════════════════════════════
Division.renderConfirm = function(left, right, p){
  var divClaims = Division.state.divisionClaims;
  var plainText = divClaims.map(function(dc){ return '【청구항 '+dc.claim_number+'】\n'+(dc.claim_text||'').replace(/;\s*/g,';\n'); }).join('\n\n');
  var h = '<div class="card" style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<div style="font-size:14px;font-weight:700"><span class="tf">📋</span> 청구항 전문</div>';
  h += '<button class="btn btn-outline btn-sm" onclick="Division.copyText(\'divisionOutputText\')"><span class="tf">📋</span> 전체 복사</button></div>';
  h += '<div id="divisionOutputText" style="white-space:pre-wrap;font-size:13px;line-height:1.8;background:var(--color-bg-tertiary);padding:16px;border-radius:var(--radius-sm);max-height:60vh;overflow-y:auto">'+escapeHtml(plainText)+'</div></div>';
  left.innerHTML = h;

  var rh = '<div class="card" style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  rh += '<div style="font-size:14px;font-weight:700"><span class="tf">🏷️</span> 발명의 명칭</div>';
  rh += '<button class="btn btn-outline btn-sm" onclick="Division.copyText(\'divisionOutputTitle\')"><span class="tf">📋</span> 복사</button></div>';
  rh += '<div id="divisionOutputTitle" style="font-size:13px;line-height:1.7"><div><strong>【국문】</strong>'+escapeHtml(p.title_ko||'')+'</div>';
  rh += '<div style="margin-top:4px"><strong>【영문】</strong>'+escapeHtml(p.title_en||'')+'</div></div>';
  if(p.title_changed){
    rh += '<div style="margin-top:10px;padding:10px 12px;background:var(--color-warning-light);border-radius:var(--radius-sm);border-left:3px solid var(--color-warning);font-size:12px;line-height:1.6">';
    rh += '<strong>⚠️ 명칭 변경됨</strong> — 원출원과 발명의 명칭이 다릅니다.<br>';
    rh += '명세서의 【발명의 명칭】, 【요약서】, 출원서 표지도 함께 수정하세요.';
    if(p.original_title_ko) rh += '<div style="margin-top:6px;color:var(--color-text-tertiary)">원출원: ' + escapeHtml(p.original_title_ko) + '</div>';
    rh += '</div>';
  }
  rh += '</div>';
  rh += '<div class="card" style="padding:16px;margin-top:12px"><div style="font-size:14px;font-weight:700;margin-bottom:12px"><span class="tf">🖍️</span> 하이라이트 버전</div>';
  rh += '<div style="font-size:13px;line-height:1.8">';
  divClaims.forEach(function(dc){
    var d = escapeHtml(dc.claim_text_highlighted||dc.claim_text);
    d = d.replace(/\*\*\*(.*?)\*\*\*/g,'<span class="division-hl-merge">$1</span>').replace(/\*\*(.*?)\*\*/g,'<span class="division-hl-added">$1</span>');
    d = d.replace(/;\s*/g,';<br>');
    rh += '<div style="margin-bottom:12px"><span style="font-weight:700;color:var(--color-primary)">【청구항 '+dc.claim_number+'】</span><br>'+d+'</div>';
  });
  rh += '</div></div>';
  rh += '<button class="btn btn-ghost btn-full" onclick="Division.backToList()" style="margin-top:12px;padding:12px"><span class="tf">←</span> 목록으로</button>';
  right.innerHTML = rh;
};

// ═══════════════════════════════════════════
// 18. 유틸리티
// ═══════════════════════════════════════════

// 분할출원 종속항에 대응하는 원출원 종속항 찾기 (텍스트 유사도 기반)
Division._findBestOrigMatch = function(divClaim, origClaims){
  if(!divClaim || !origClaims || !origClaims.length) return null;
  var divText = (divClaim.claim_text || '').replace(/\*{2,3}/g, '').substring(0, 300);
  if(!divText) return null;
  var best = null, bestScore = 0;
  origClaims.forEach(function(oc){
    var origText = (oc.amended_text || oc.original_text || '').substring(0, 300);
    if(!origText) return;
    // 단어 집합 겹침 비율로 유사도 측정
    var divWords = divText.split(/\s+/).filter(function(w){ return w.length > 1; });
    var origWords = origText.split(/\s+/).filter(function(w){ return w.length > 1; });
    if(!divWords.length || !origWords.length) return;
    var origSet = {};
    origWords.forEach(function(w){ origSet[w] = true; });
    var overlap = 0;
    divWords.forEach(function(w){ if(origSet[w]) overlap++; });
    var score = overlap / Math.max(divWords.length, origWords.length);
    if(score > bestScore){ bestScore = score; best = oc; }
  });
  // 최소 30% 이상 겹쳐야 매칭으로 인정
  return bestScore >= 0.3 ? best : null;
};

Division.copyText = function(elementId){
  var el = document.getElementById(elementId); if(!el) return;
  navigator.clipboard.writeText(el.innerText||el.textContent).then(function(){ showToast('복사되었습니다'); }).catch(function(){ showToast('복사 실패','error'); });
};
