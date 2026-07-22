/**
 * review-engine/__tests__/patent-batch15b-structure.test.js
 * ★ 배치 15B — 구조 개편(3인 합의) + docE A6~A9.
 *   1 ② 보드 확장(독립항수·예시도·수학식개수) canonical+배선 / 2 체인 [기초] phase / 3 ③ 순차화 /
 *   A6 cohesion 블록 재요청 / A7 스텝 입력 가드 / A8 meta_response_residue / A9 antecedent 자기 항 범위.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');

let sandbox; const els = {};
const mkEl = () => ({ value: '4', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {}, updateStats() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, updateStats() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); run('clearAllState();'); });

// ═══ 1) ② 보드 확장 ═══
test('★ 1 — 신규 canonical 상태(deviceIndepCount·mathBlockCount·conceptTargetCount) 기본값', () => {
  assert.equal(run('deviceIndepCount'), 1, '★ 독립항 수 기본 1');
  assert.equal(run('mathBlockCount'), 3, '★ 수학식 개수 기본 3');
  assert.equal(run('conceptTargetCount'), 2, '★ 예시도 수 기본 2');
});
test('★ 1 — _dbSet 미러: indepDep·conceptToggle·conceptCount·mathCount → 전역 canonical', () => {
  els.dbIndepDep = mkEl();
  run('_dbSet("indepDep","3")');
  assert.equal(run('deviceIndepCount'), 3, '★ 독립항 수 미러');
  els.chkConceptDiagram = mkEl(); els.chkConceptDiagram.checked = true;
  run('_dbSet("conceptToggle")');
  assert.equal(run('conceptDiagramEnabled'), true, '★ 예시도 포함 canonical');
  run('_dbSet("conceptCount","4")');
  assert.equal(run('conceptTargetCount'), 4, '★ 예시도 수');
  run('_dbSet("mathCount","5")');
  assert.equal(run('mathBlockCount'), 5, '★ 수학식 개수(1~5 클램프)');
  run('_dbSet("mathCount","9")');
  assert.equal(run('mathBlockCount'), 5, '★ 상한 5 클램프');
});
test('★ 1 — renderDesignBoard: 총 항수 = 독립+일반+앵커(독립 N 반영) + 카운트 입력 표시 토글', () => {
  run('selectedTitleType="서버"; deviceIndepCount=2; deviceGeneralDep=6; deviceAnchorDep=3; includeMethodClaims=false;');
  els.dbClaimTotal = mkEl(); els.dbConceptCountWrap = mkEl(); els.dbMathCountWrap = mkEl(); els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true; els.chkConceptDiagram = mkEl();
  run('conceptDiagramEnabled=true;');
  run('renderDesignBoard();');
  assert.ok(/장치 총 11항/.test(els.dbClaimTotal.textContent), '★ 2+6+3=11(독립 2 반영)');
  assert.equal(els.dbConceptCountWrap.style.display, 'inline', '★ 예시도 포함 → 수 입력 표시');
  assert.equal(els.dbMathCountWrap.style.display, 'inline', '★ 수학식 포함 → 수 입력 표시');
});
test('★ 1 — genParams 대조: indep·concept(stage3)·mathCount(stage4) drift 반영', () => {
  run('selectedTitleType="서버"; deviceIndepCount=1; deviceGeneralDep=5; deviceAnchorDep=4; detailLevel="standard"; genParams=null;');
  run('_snapshotGenParams("stage3"); _snapshotGenParams("stage4");');
  assert.equal(run('_genParamsDrift()'), false, '★ 스냅샷 직후 drift 없음');
  run('deviceIndepCount=3;');
  assert.equal(run('_genParamsDrift()'), true, '★ 독립항 수 변경 → stage3 drift');
  run('deviceIndepCount=1; mathBlockCount=5;');
  assert.equal(run('_genParamsDrift()'), true, '★ 수학식 개수 변경 → stage4 drift');
});
test('★ 1a — step_06 다중 독립항 프롬프트(N>1: 상이한 권리 관점·번호 자동 시프트)', () => {
  run('selectedTitle="테스트 서버"; selectedTitleType="서버"; deviceIndepCount=3; deviceGeneralDep=4; deviceAnchorDep=2;');
  const p = run("buildPrompt('step_06')");
  assert.ok(/독립항: 3개 \(청구항 1~3\)/.test(p), '★ 독립항 N개 명시');
  assert.ok(/상이한 권리 관점\(장치 구성 축 분리\)/.test(p), '★ 권리 관점 분리 지시');
  assert.ok(/일반 종속항: 4개 \(청구항 4~7\)/.test(p), '★ 일반 종속항 번호 자동 시프트(4~7)');
  assert.ok(/등록 앵커 종속항: 2개 \(청구항 8~9\)/.test(p), '★ 앵커 번호 자동 시프트(8~9)');
  // N=1이면 단일 독립항 표기 유지
  run('deviceIndepCount=1;');
  const p1 = run("buildPrompt('step_06')");
  assert.ok(/독립항: 1개 \(청구항 1\)/.test(p1) && !/상이한 권리 관점/.test(p1), '★ N=1은 단일 독립항(기존)');
});
test('★ 1b — cohesion 수학식 개수 계약("정확히 N개") + 변수 자기검증(R3)', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버"; mathBlockCount=4;');
  els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true;
  const p = run("buildPrompt('unified_cohesion')");
  assert.ok(/정확히 4개의 【수학식】 블록/.test(p), '★ 개수 계약(N=4)');
  assert.ok(/변수 자기검증\(R3\)/.test(p) && /정의 없는 변수 절대 금지/.test(p), '★ 변수 전수 정의 자기검증');
});
test('★ 1c — 체인 도면 phase 예시도(step_07c) 포함/제외·개수 배선(소스)', () => {
  assert.match(PATENT_SRC, /if\(typeof conceptDiagramEnabled!=='undefined'&&conceptDiagramEnabled\)\{/, '★ 예시도 포함 게이트');
  assert.match(PATENT_SRC, /if\(typeof _trimConceptTypesToTarget==='function'\)_trimConceptTypesToTarget\(\)/, '★ 목표 개수 정렬');
  assert.match(PATENT_SRC, /await _cascadeRunConceptDiagram\(\)/, '★ 예시도 생성 호출(체인)');
});

// ═══ 영속 ═══
test('★ 1 — 영속: saveProject 페이로드 + openProject 복원 필드', () => {
  assert.match(PATENT_SRC, /deviceIndepCount,mathBlockCount,conceptTargetCount,/, '★ saveProject 페이로드');
  assert.match(PATENT_SRC, /deviceIndepCount=typeof s\.deviceIndepCount==='number'\?s\.deviceIndepCount:1/, '★ openProject 복원');
});

// ═══ 2) 체인 [기초] phase + ① Step2~5 강등·결과 ④ 이동 ═══
test('★ 2 — 체인 [기초] phase: 명칭 직후·청구항 이전 step_02·03 생성(비블로킹) + resultsBatch25 렌더', () => {
  assert.match(PATENT_SRC, /_phase\('basis','running'\); _rail\(1\); P\('\[기초\] 기술분야·배경기술 생성/, '★ 기초 phase 진입(명칭 직후)');
  assert.match(PATENT_SRC, /if\(!\(resume&&outputs\.step_02\)\)\{ _lastGenError=''; try\{ await runStep\('step_02'\); \}catch/, '★ 기술분야 생성(비블로킹 try)');
  assert.match(PATENT_SRC, /if\(!\(resume&&outputs\.step_03\)\)\{ _lastGenError=''; try\{ await runStep\('step_03'\); \}catch/, '★ 배경기술 생성(비블로킹 try)');
  assert.match(PATENT_SRC, /renderBatchResult\('resultsBatch25','step_02',outputs\.step_02\)/, '★ 기초 결과 ④ 카드 렌더');
  // 순서: 기초(basis)가 청구항(claims running) 이전
  const iBasis = PATENT_SRC.indexOf("_phase('basis','running')");
  const iClaims = PATENT_SRC.indexOf("_phase('claims','running')");
  assert.ok(iBasis > 0 && iClaims > iBasis, '★ 기초 → 청구항 순서');
});
test('★ 2 — phase 목록: 기초는 실제 phase(plan 제거)', () => {
  assert.match(PATENT_SRC, /\{id:'basis',label:'기초\(기술분야·배경기술\)'\}/, '★ 기초 실 phase(예정 표기 제거)');
  assert.ok(!/id:'basis'[^}]*plan:true/.test(PATENT_SRC), '★ plan:true 제거');
});
test('★ 2 — DOM: resultCard25 ①→④(page3) 이동 + Step2~5 카드 고급(wfAdvBasis) 강등', () => {
  const p0 = HTML_SRC.slice(HTML_SRC.indexOf('id="page0"'), HTML_SRC.indexOf('id="page1"'));
  const p3 = HTML_SRC.slice(HTML_SRC.indexOf('id="page3"'), HTML_SRC.indexOf('id="page4"'));
  assert.ok(!p0.includes('id="resultCard25"'), '★ ①에서 결과 카드 제거');
  assert.ok(p3.includes('id="resultCard25"') && p3.includes('id="resultsBatch25"'), '★ ④에 기초 결과 카드');
  assert.match(HTML_SRC, /<details class="wf-adv" id="wfAdvBasis">/, '★ Step2~5 고급 아코디언 강등');
  assert.match(HTML_SRC, /id="btnBatch25" onclick="runBatch25\(\)"/, '★ 일괄 생성 버튼 존치(고급)');
});

// ═══ 3) ③ 내부 순차화 + 섹션별 재생성 ═══
test('★ 3 — ③ 우측: 청구항 섹션 → 도면 섹션 세로 배치 + 섹션별 재생성 버튼', () => {
  const p2 = HTML_SRC.slice(HTML_SRC.indexOf('id="page2"'), HTML_SRC.indexOf('id="page3"'));
  const iClaims = p2.indexOf('id="wfSecClaims"'), iFigures = p2.indexOf('id="wfSecFigures"');
  assert.ok(iClaims > 0 && iFigures > iClaims, '★ 청구항 섹션이 도면 섹션 앞(세로 순차)');
  // 청구항 섹션 헤더 안에 청구항만 재생성, 도면 섹션 헤더 안에 도면만 재생성
  const secC = p2.slice(iClaims, p2.indexOf('</div>', p2.indexOf('btnWfRegenClaims')) + 6);
  assert.match(secC, /id="btnWfRegenClaims" onclick="wfRegenClaims\(\)"[\s\S]{0,80}청구항만 재생성/, '★ 청구항만 재생성 버튼');
  const secF = p2.slice(iFigures, p2.indexOf('</div>', p2.indexOf('btnWfRegenFigures')) + 6);
  assert.match(secF, /id="btnWfRegenFigures" onclick="wfRegenFigures\(\)"[\s\S]{0,80}도면만 재생성/, '★ 도면만 재생성 버튼');
  // 결과 카드 소속: 청구항(06,10) 섹션 뒤, 도면(07) 섹션 뒤
  assert.ok(p2.indexOf('id="resultCard06"') > iClaims && p2.indexOf('id="resultCard06"') < iFigures, '★ 06 청구항 섹션');
  assert.ok(p2.indexOf('id="resultCard07"') > iFigures, '★ 07 도면 섹션');
});
test('★ 3 — 섹션 재생성 함수: 청구항만=step_06(+10, 하류 stale), 도면만=step_07(+11)+invalidateDownstream', () => {
  assert.equal(run('typeof wfRegenClaims'), 'function', '★ wfRegenClaims 존재');
  assert.equal(run('typeof wfRegenFigures'), 'function', '★ wfRegenFigures 존재');
  assert.match(PATENT_SRC, /async function wfRegenClaims\(\)\{[\s\S]{0,400}await runStep\('step_06'\)/, '★ 청구항만 재생성=step_06');
  assert.match(PATENT_SRC, /async function wfRegenFigures\(\)\{[\s\S]{0,400}await runDiagramStep\('step_07'\)[\s\S]{0,300}invalidateDownstream\('step_07'\)/, '★ 도면만 재생성=step_07+하류 stale');
});

// ═══ A7) 스텝 필수 입력 가드 ═══
test('★ A7 — 필수 입력 빈 스텝 차단(과제·효과·해결수단·기술분야·배경·부호) + ①/③/④ 안내', () => {
  els.projectInput = mkEl(); els.projectInput.value = '충분히 긴 발명 자료 텍스트가 여기에 입력되어 있다고 가정한다.';
  run('clearAllState(); selectedTitle=""; outputs={};');
  // 명칭 미확정 → 기술분야/배경/선행기술/청구항 차단(①안내)
  assert.match(run('checkDependency("step_02")'), /①에서 발명의 명칭을 확정/, '★ 기술분야 명칭 가드');
  assert.match(run('checkDependency("step_03")'), /①에서 발명의 명칭을 확정/, '★ 배경 명칭 가드');
  assert.match(run('checkDependency("step_06")'), /①에서 발명의 명칭을 확정/, '★ 청구항 명칭 가드');
  // 청구항 부재 → 과제/효과/해결수단/요약 차단(③안내)
  run('selectedTitle="테스트 서버";');
  assert.match(run('checkDependency("step_05")'), /③에서 청구항을 생성/, '★ 과제 청구항 가드(docE 메타응답 차단)');
  assert.match(run('checkDependency("step_17")'), /③에서 청구항을 생성/, '★ 해결수단 청구항 가드');
  assert.match(run('checkDependency("step_16")'), /③에서 청구항을 생성/, '★ 효과 청구항 가드');
  assert.match(run('checkDependency("step_18")'), /④에서 상세설명을 생성/, '★ 부호 상세설명 가드');
  // 선행 산출물 갖추면 통과(null)
  run('outputs.step_06="【청구항 1】 장치."; outputs.step_08="상세설명";');
  assert.equal(run('checkDependency("step_05")'), null, '★ 청구항 존재 → 과제 허용');
  assert.equal(run('checkDependency("step_18")'), null, '★ 상세설명 존재 → 부호 허용');
});

// ═══ A8) meta_response_residue (CRITICAL) ═══
test('★ A8 — 메타 응답 잔존 검출(CRITICAL) + 정상 명세 미발화 + KIPRIS 폴백 제외', () => {
  const meta = '【해결하고자 하는 과제】\n현재 발명의 구체적인 내용이 입력되지 않은 상태이다. 정확한 과제를 작성하려면 추가 정보가 필요하다. 정보를 제공해 주시면 작성하여 제공하겠습니다.';
  const iss = JSON.parse(run('JSON.stringify(validateSpecification(' + JSON.stringify(meta) + ').filter(function(i){return i.check==="meta_response_residue";}))'));
  assert.ok(iss.length && iss[0].severity === 'CRITICAL', '★ 메타 응답 → CRITICAL');
  const normal = '【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 수신된 데이터를 처리하여 결과를 저장부(110)에 제공한다. 판단부(120)는 임계값과 비교한다.';
  assert.equal(run('validateSpecification(' + JSON.stringify(normal) + ').filter(function(i){return i.check==="meta_response_residue";}).length'), 0, '★ 정상 명세 미발화');
  const kipris = '【선행기술문헌】\n(관련 선행특허를 검색하지 못하였습니다)';
  assert.equal(run('validateSpecification(' + JSON.stringify(kipris) + ').filter(function(i){return i.check==="meta_response_residue";}).length'), 0, '★ KIPRIS 무결과 폴백은 제외(오탐 방지)');
});

// ═══ A6) cohesion 필수 블록 누락 → 부호표만 1회 재요청 ═══
test('★ A6 소스 — REFTABLE만 누락 시 부호표 지정 재요청 분기 + 재실패 시 "④ 재생성 필요"', () => {
  assert.match(PATENT_SRC, /if\(!r\.ok\.hasRef&&r\.ok\.hasDevice\)\{/, '★ REFTABLE 단독 누락 분기');
  assert.match(PATENT_SRC, /_buildRefTableRetryPrompt\(r\.device\|\|'', r\.method\|\|''\)/, '★ 부호표만 재요청(본문 보존)');
  assert.match(PATENT_SRC, /_lastGenError=_refMiss\?'부호표 누락 — ④ 재생성 필요'/, '★ 재실패 사유(완료 요약 노출)');
  assert.match(PATENT_SRC, /function _buildRefTableRetryPrompt\(deviceText, methodText\)/, '★ 재요청 프롬프트 헬퍼');
  assert.match(PATENT_SRC, /<<<REFTABLE>>>[\s\S]{0,200}<<<END_REFTABLE>>>/, '★ 부호표 블록 형식만 요청');
});
test('★ A6 동작 — REFTABLE 누락→부호표 재요청 합성 성공(본문 보존·1회 재요청)', async () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부를 포함하는 장치."; outputs.step_07="도 1"; selectedTitle="테스트"; selectedTitleType="서버"; includeMethodClaims=false;');
  els.chkUnifiedMath = mkEl();
  const raw1 = '<<<DEVICE_DESC>>>\n제어부(100)는 수신부(110)로부터 데이터를 받아 처리하도록 구성된다.\n<<<END_DEVICE_DESC>>>';
  const raw2 = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n(110) 수신부\n<<<END_REFTABLE>>>';
  const orig = sandbox.App.callClaudeWithContinuation; let call = 0;
  sandbox.App.callClaudeWithContinuation = async () => { call++; return call === 1 ? raw1 : raw2; };
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.equal(call, 2, '★ 정확히 1회 재요청(전체 재생성 아님)');
  assert.ok(/제어부\(100\)/.test(run('outputs.step_08')||''), '★ 본문 보존(재요청이 본문 안 건드림)');
  assert.ok(/제어부/.test(run('outputs.step_18')||''), '★ 합성된 부호표로 부호의 설명 생성');
});

// ═══ A9) antecedent 자기 항 범위 오탐 수정 ═══
test('★ A9 — "상기 X": 자기 항 선행 도입 미발화 + 진성(체인·자기항 모두 부재) 발화', () => {
  const claims = '【청구항 1】 데이터를 수신하는 수신부를 포함하는 장치.\n【청구항 2】 제1항에 있어서, 입력 신호의 편차를 산출하는 산출부; 및 상기 산출된 편차를 보정하는 보정부를 더 포함하는 장치.\n【청구항 3】 제1항에 있어서, 상기 양자난수 생성기를 통해 키를 생성하는 장치.';
  const iss = JSON.parse(run('JSON.stringify(validateClaims(' + JSON.stringify(claims) + ').filter(function(i){return /선행기재 없음/.test(i.message);}))'));
  assert.ok(!iss.some(i => /상기 산출된 편차/.test(i.message)), '★ 자기 항 선행 도입("편차를 산출") → 오탐 미발화');
  assert.ok(iss.some(i => /양자난수/.test(i.message)), '★ 진성 미정의("양자난수 생성기") → HIGH 발화');
});
