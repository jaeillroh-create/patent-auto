/**
 * review-engine/__tests__/patent-batch15h-method-off-design.test.js
 * ★ 배치 15H — 방법 청구항 기본 OFF 완결 + 설계 컨트롤 ② 집결.
 *   1 방법 기본 OFF 초기값 전수 반전(global/clearAllState/신규 payload/openProject 복원 === true) /
 *   2 방법 OFF 연쇄 차단(cohesion METHOD_DESC 제외 · S부호 게이트 비활성) /
 *   3 설계 컨트롤 ② 집결(예시도 유형 선택 canonical 미러 _dbToggleConceptType + ② 보드 마크업).
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
const mkEl = () => ({ value: '', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
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

// openProject DB 행 모의 — current_state_json 을 주입하여 복원 의미(=== true) 검증.
function mockRow(cfg) {
  const row = { id: 'x', invention_content: '', current_state_json: cfg };
  const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: row }), maybeSingle: async () => ({ data: row }), update: () => chain, insert: () => chain, order: () => chain, limit: () => chain, then: (f) => Promise.resolve({}).then(f) };
  sandbox.App.sb.from = () => chain;
}

// ─────────────────────── 15H-1 방법 기본 OFF 초기값 전수 반전 ───────────────────────

test('15H-1 소스 ★ — 초기값 4곳 전수 OFF(global·clearAllState·신규 payload·openProject 복원)', () => {
  // global 기본값(00-state) — includeMethodClaims=false 로 선언
  assert.match(PATENT_SRC, /selectedTitleType='',includeMethodClaims=false/, '★ global 기본 OFF');
  // clearAllState 리셋 — includeMethodClaims=false
  assert.match(PATENT_SRC, /selectedTitleType='';includeMethodClaims=false;/, '★ clearAllState OFF');
  // 신규 프로젝트 payload — includeMethodClaims:false
  assert.match(PATENT_SRC, /selectedTitleType:'',includeMethodClaims:false,/, '★ 신규 프로젝트 payload OFF');
  // openProject 복원 — 명시적 저장 true 만 ON(undefined/false→OFF)
  assert.match(PATENT_SRC, /includeMethodClaims=s\.includeMethodClaims===true;/, '★ openProject 복원: === true 만 ON');
});

test('15H-1 동작 ★ — clearAllState 후 includeMethodClaims === false', () => {
  run('includeMethodClaims=true; clearAllState();');
  assert.strictEqual(run('includeMethodClaims'), false, '★ clearAllState 는 방법 OFF 로 초기화');
});

test('15H-1 동작 ★ — openProject 복원: 저장 true→ON / undefined→OFF / false→OFF', async () => {
  const origFrom = sandbox.App.sb.from;
  try {
    // 저장 true → 방법 세트 쓰던 프로젝트는 복원(harmless)
    mockRow({ outputs: {}, includeMethodClaims: true });
    await run('openProject("x").catch(function(){});');
    assert.strictEqual(run('includeMethodClaims'), true, '★ 저장 true → ON 복원');
    // 저장 undefined(구 프로젝트/신규 기본) → OFF
    mockRow({ outputs: {} });
    await run('openProject("x").catch(function(){});');
    assert.strictEqual(run('includeMethodClaims'), false, '★ 저장 undefined → OFF');
    // 저장 false → OFF
    mockRow({ outputs: {}, includeMethodClaims: false });
    await run('openProject("x").catch(function(){});');
    assert.strictEqual(run('includeMethodClaims'), false, '★ 저장 false → OFF');
  } finally { sandbox.App.sb.from = origFrom; }
});

// ─────────────────────── 15H-2 방법 OFF 연쇄 차단 ───────────────────────

test('15H-2 소스 ★ — checkDependency 가 방법 스텝(step_10/11/12/20) 차단', () => {
  assert.match(PATENT_SRC, /const methodSteps=\['step_10','step_11','step_12','step_20'\];/, '★ 방법 스텝 목록');
  assert.match(PATENT_SRC, /if\(!includeMethodClaims&&methodSteps\.includes\(s\)\)\{return/, '★ 방법 OFF 시 방법 스텝 차단');
});

test('15H-2 소스 ★ — 체인이 step_10/step_11 을 wantMethod 로 게이트', () => {
  assert.match(PATENT_SRC, /const wantMethod=!!includeMethodClaims;/, '★ wantMethod 계산');
  assert.match(PATENT_SRC, /if\(wantMethod&&!\(resume&&outputs\.step_10\)&&_guard\('step_10'\)\)/, '★ step_10 wantMethod 게이트');
  assert.match(PATENT_SRC, /if\(wantMethod&&outputs\.step_10&&!\(resume&&outputs\.step_11\)&&_guard\('step_11'\)\)/, '★ step_11 wantMethod 게이트');
});

test('15H-2 소스 ★ — cohesion 프롬프트가 _wantMethod 로 METHOD_DESC 제외', () => {
  assert.match(PATENT_SRC, /const _wantMethod=\(typeof includeMethodClaims==='undefined'\)\?false:!!includeMethodClaims;/, '★ _wantMethod 계산(cohesion)');
  assert.match(PATENT_SRC, /const methodClaims=\(_wantMethod&&outputs\.step_10\)\?outputs\.step_10:'\(방법 청구항 없음/, '★ 방법 OFF → METHOD_DESC 블록 생략 지시');
  assert.match(PATENT_SRC, /const methodFigDesign=\(_wantMethod&&outputs\.step_11\)\?outputs\.step_11:'\(방법 도면 없음\)'/, '★ 방법 OFF → 방법 도면 참조 제외');
});

test('15H-2 소스 ★ — S부호 게이트(methodNotInTable·methodOk)가 방법 OFF 시 비활성', () => {
  assert.match(PATENT_SRC, /if\(_wantMethod&&rp\.methodNotInTable&&rp\.methodNotInTable\.length\)g\.push/, '★ S부호 미정의 게이트 wantMethod 가드');
  assert.match(PATENT_SRC, /if\(_wantMethod&&!rp\.methodOk\)g\.push/, '★ 방법 극성 게이트 wantMethod 가드');
});

test('15H-2 동작 ★ — 방법 OFF: cohesion 프롬프트에 stale step_10 미포함·"방법 청구항 없음"', () => {
  run('clearAllState(); includeMethodClaims=false; selectedTitle="테스트 시스템"; selectedTitleType="시스템";'
    + 'outputs.step_06="【청구항 1】 제어부를 포함하는 장치.";'
    + 'outputs.step_10="STALE_METHOD_CLAIM_MARKER_XYZ 하는 단계를 포함하는 방법.";');
  els.projectInput = mkEl(); els.projectInput.value = '발명 내용';
  const p = run('buildPrompt("unified_cohesion")') || '';
  assert.ok(!/STALE_METHOD_CLAIM_MARKER_XYZ/.test(p), '★ 방법 OFF → stale step_10 이 프롬프트에 유입되지 않음');
  assert.ok(/방법 청구항 없음/.test(p), '★ 방법 OFF → "방법 청구항 없음" 지시 포함');
});

test('15H-2 동작 ★ — 방법 ON: cohesion 프롬프트에 step_10 방법 청구항 포함(현행 보존)', () => {
  run('clearAllState(); includeMethodClaims=true; selectedTitle="테스트 방법"; selectedTitleType="방법";'
    + 'outputs.step_06="【청구항 1】 제어부를 포함하는 장치.";'
    + 'outputs.step_10="LIVE_METHOD_CLAIM_MARKER_ABC 하는 단계를 포함하는 방법.";');
  els.projectInput = mkEl(); els.projectInput.value = '발명 내용';
  const p = run('buildPrompt("unified_cohesion")') || '';
  assert.ok(/LIVE_METHOD_CLAIM_MARKER_ABC/.test(p), '★ 방법 ON → step_10 방법 청구항이 프롬프트에 포함');
});

test('15H-2 동작 ★ — _computeGate 는 방법 OFF 시 S부호 미정의를 게이트하지 않음(간접: 소스 가드)', () => {
  // _computeGate 은 runUnifiedCohesionGen 내부 클로저라 직접 호출 불가 → 소스 가드로 확인(위 소스 테스트) +
  // 파서가 method 없음이면 methodOk=true·methodNotInTable=[] 을 반환하는지 결정론 확인.
  const r = run('parseCohesiveBundle("<<<REFTABLE>>>\\n[장치부호]\\n(100) 제어부\\n<<<END_REFTABLE>>>\\n<<<DEVICE_DESC>>>\\n제어부(100)는 동작한다.\\n<<<END_DEVICE_DESC>>>")');
  assert.strictEqual(r.report.methodOk, true, '★ method 블록 없음 → methodOk=true(게이트 무발동)');
  assert.strictEqual((r.report.methodNotInTable || []).length, 0, '★ method 블록 없음 → S부호 미정의 0');
});

// ─────────────────────── 15H-3 설계 컨트롤 ② 집결(예시도 유형) ───────────────────────

test('15H-3 소스 ★ — ② 보드 예시도 유형 마크업(dbConceptTypesWrap/dbConceptTypes)', () => {
  assert.match(HTML_SRC, /id="dbConceptTypesWrap"/, '★ ② 예시도 유형 래퍼');
  assert.match(HTML_SRC, /id="dbConceptTypes"/, '★ ② 예시도 유형 체크박스 컨테이너');
  // ② 보드(wfStage2Main) 안에 위치 — dbTypeCards 이후, dbApplyBadges 이전 슬라이스에 존재
  assert.match(HTML_SRC, /id="wfStage2Main"[\s\S]{0,5200}id="dbConceptTypesWrap"[\s\S]{0,2000}id="dbApplyBadges"/, '★ dbConceptTypesWrap 이 ② 보드 내 위치');
});

test('15H-3 소스 ★ — _dbToggleConceptType canonical 미러 + renderDesignBoard 체크박스 렌더', () => {
  assert.match(PATENT_SRC, /function _dbToggleConceptType\(typeKey, ?on\)\{/, '★ 토글 함수 정의');
  assert.match(PATENT_SRC, /onchange="_dbToggleConceptType\(/, '★ renderDesignBoard 가 유형별 체크박스에 onchange 배선');
  assert.match(PATENT_SRC, /_dbToggleConceptType\([^)]{0,6}\+k\+/, '★ onchange 핸들러에 유형키(k) 인터폴레이션');
  assert.match(PATENT_SRC, /const ctw=document\.getElementById\('dbConceptTypesWrap'\); if\(ctw\)ctw\.style\.display=conceptDiagramEnabled/, '★ 예시도 포함 시에만 유형 컨트롤 표시');
});

test('15H-3 동작 ★ — _dbToggleConceptType 선택 → conceptDiagramTypes 반영·예시도 자동 ON', () => {
  run('clearAllState(); conceptDiagramEnabled=false; conceptDiagramTypes=[];');
  run('_dbToggleConceptType("ui_screen", true);');
  const types = run('JSON.stringify((conceptDiagramTypes||[]).map(function(t){return t.type;}))');
  assert.ok(/ui_screen/.test(types), '★ 선택 유형이 conceptDiagramTypes 에 추가');
  assert.strictEqual(run('conceptDiagramEnabled'), true, '★ 유형 선택 = 예시도 포함 의도 → 자동 ON');
});

test('15H-3 동작 ★ — 명시 선택 유형이 목표 개수를 넘으면 conceptTargetCount 상향(체인 trim 방어)', () => {
  run('clearAllState(); conceptTargetCount=2; conceptDiagramTypes=[]; conceptDiagramEnabled=true;');
  run('_dbToggleConceptType("ui_screen", true); _dbToggleConceptType("user_scenario", true); _dbToggleConceptType("data_structure", true);');
  assert.strictEqual(run('conceptDiagramTypes.length'), 3, '★ 3종 선택');
  assert.strictEqual(run('conceptTargetCount'), 3, '★ 목표 개수가 3 으로 상향(_trimConceptTypesToTarget 이 명시 선택을 잘라내지 않도록)');
});

test('15H-3 동작 ★ — 해제는 conceptTargetCount 를 낮추지 않음(자동추천 여지 보존)', () => {
  run('clearAllState(); conceptTargetCount=2; conceptDiagramTypes=[]; conceptDiagramEnabled=true;');
  run('_dbToggleConceptType("ui_screen", true); _dbToggleConceptType("user_scenario", true); _dbToggleConceptType("data_structure", true);'); // →3
  run('_dbToggleConceptType("data_structure", false);'); // 해제 →2종
  assert.strictEqual(run('conceptDiagramTypes.length'), 2, '★ 2종 잔존');
  assert.strictEqual(run('conceptTargetCount'), 3, '★ 목표 개수는 3 유지(해제로 축소 안 함)');
});

// ─────────────────────── 회귀: 캐시버스트 토큰 ───────────────────────

test('15H 회귀 ★ — ?v= 릴리스 토큰 b50 갱신', () => {
  assert.match(HTML_SRC, /patent\/patent\.js\?v=20260722-b50/, '★ index.html patent.js 토큰 b50');
  assert.match(readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8'), /version = '20260722-b50'/, '★ patent.js 로더 version b50');
});
