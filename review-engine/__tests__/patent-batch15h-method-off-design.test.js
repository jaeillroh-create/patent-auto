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
    API_KEY: 'stub',   // common.js 미로드 번들에서 openProject(01:272 if(!API_KEY)) ReferenceError 방지(하네스 보정)
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
  // clearAllState 레거시 토글 동기 — checked=false(종전 checked=true 누락 반전지점)
  assert.match(PATENT_SRC, /const mt=document\.getElementById\('methodToggle'\);if\(mt\)\{mt\.checked=false;toggleMethod\(\);\}/, '★ clearAllState methodToggle OFF');
});

test('15H-1 소스 ★ — HTML methodToggle 정적 기본값도 OFF(하드코딩 checked 제거)', () => {
  assert.match(HTML_SRC, /<input type="checkbox" id="methodToggle" onchange="toggleMethod\(\)"/, '★ 정적 기본 unchecked(방법 OFF 정책과 정합)');
  assert.ok(!/id="methodToggle"[^>]*\schecked/.test(HTML_SRC), '★ methodToggle 에 하드코딩 checked 없음');
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
  assert.match(PATENT_SRC, /if\(!_hasRP&&_wantMethod&&rp\.methodNotInTable&&rp\.methodNotInTable\.length\)g\.push/, '★ S부호 미정의 게이트 wantMethod 가드(refPlan 없을 때만 — 배치17)');
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

// ─────────── 적대검증 반영: #1/#2 렌더 계층 방법 게이트(방법 OFF 누출 차단) ───────────

// 방법 산출물이 모두 커밋된 상태(과거 방법 ON 생성) 설정 헬퍼.
function methodFullState() {
  run(`clearAllState(); selectedTitle="검색 시스템";
    outputs={
      step_06:"【청구항 1】 제어부(100)를 포함하는 장치.",
      step_08:"도 1을 참조하면, 제어부(100)가 처리한다.",
      step_10:"【청구항 5】 METHOD_CLAIM_MARK 하는 단계를 포함하는 방법.",
      step_11:"도 3은 방법 흐름도로서 METHOD_FIG_MARK 를 도시한다.",
      step_12:"도 3을 참조하면, S710 단계에서 METHOD_DESC_MARK 수신한다.",
      step_18:"제어부 : 100\\n\\n[방법 단계]\\n수신하는 단계 : S710",
      step_20:"【청구항 9】 MEDIA_CLAIM_MARK 프로그램을 기록한 기록매체."
    };`);
}

test('#1/#2 동작 ★ — 방법 OFF: buildSpecification 이 방법 청구항·상세설명·도면약설·기록매체·S부호 제외', () => {
  methodFullState();
  run('includeMethodClaims=false;');
  const spec = run('buildSpecification()') || '';
  assert.ok(/제어부\(100\)/.test(spec), '★ 장치 내용은 유지');
  assert.ok(!/METHOD_CLAIM_MARK/.test(spec), '★ 방법 청구항 제외');
  assert.ok(!/METHOD_DESC_MARK/.test(spec), '★ 방법 상세설명 제외');
  assert.ok(!/METHOD_FIG_MARK/.test(spec), '★ 방법 도면 약설 제외');
  assert.ok(!/MEDIA_CLAIM_MARK/.test(spec), '★ 기록매체(방법 세트) 청구항 제외');
  assert.ok(!/S710/.test(spec), '★ 부호의 설명에서 방법 S부호 제외');
  assert.ok(!/\[방법\s*단계\]/.test(spec), '★ [방법 단계] 헤더 제외');
});

test('#1/#2 동작 ★ — 방법 ON: buildSpecification 이 방법 산출물을 모두 포함(비파괴·가역)', () => {
  methodFullState();
  run('includeMethodClaims=true;');
  const spec = run('buildSpecification()') || '';
  assert.ok(/METHOD_CLAIM_MARK/.test(spec), '★ 방법 청구항 포함');
  assert.ok(/METHOD_DESC_MARK/.test(spec), '★ 방법 상세설명 포함');
  assert.ok(/S710/.test(spec), '★ 방법 S부호 포함');
  assert.ok(/MEDIA_CLAIM_MARK/.test(spec), '★ 기록매체 청구항 포함');
});

test('#1/#2 동작 ★ — 재토글 가역성: OFF→ON 시 방법 산출물이 outputs 에 보존되어 복원', () => {
  methodFullState();
  run('includeMethodClaims=false;'); run('buildSpecification();');
  assert.ok(/METHOD_CLAIM_MARK/.test(run('outputs.step_10') || ''), '★ OFF 렌더가 outputs.step_10 을 파괴하지 않음');
  run('includeMethodClaims=true;');
  assert.ok(/METHOD_CLAIM_MARK/.test(run('buildSpecification()') || ''), '★ ON 재토글 시 방법 복원(가역)');
});

test('#1/#2 동작 ★ — _step18ForRender: 방법 OFF 시 명칭:S### 줄·[방법 단계] 헤더만 제거(장치부호 유지)', () => {
  methodFullState();
  run('includeMethodClaims=false;');
  const s18 = run('_step18ForRender()') || '';
  assert.ok(/제어부 : 100/.test(s18), '★ 장치부호 유지');
  assert.ok(!/S710/.test(s18) && !/\[방법\s*단계\]/.test(s18), '★ 방법 S부호·헤더 제거');
  run('includeMethodClaims=true;');
  assert.ok(/S710/.test(run('_step18ForRender()') || ''), '★ 방법 ON 시 그대로');
});

test('#1/#2 동작 ★ — buildImplementationBody: 방법 OFF 시 방법 상세설명 제외', () => {
  methodFullState();
  run('includeMethodClaims=false;');
  assert.ok(!/METHOD_DESC_MARK/.test(run('buildImplementationBody()') || ''), '★ 방법 OFF → 본문에서 방법 상세설명 제외');
  run('includeMethodClaims=true;');
  assert.ok(/METHOD_DESC_MARK/.test(run('buildImplementationBody()') || ''), '★ 방법 ON → 방법 상세설명 포함');
});

test('#1/#2 소스 ★ — _renderMethodOn 게이트가 3개 렌더 진입점에 배선', () => {
  assert.match(PATENT_SRC, /function _renderMethodOn\(\)\{/, '★ 렌더 게이트 정의');
  assert.match(PATENT_SRC, /const methodClaims=_renderMethodOn\(\)\?\(outputs\.step_10\|\|''\):'';/, '★ buildSpecification 방법 청구항 게이트');
  assert.match(PATENT_SRC, /const method=_renderMethodOn\(\)\?\(getLatestMethodDescription\(\)\|\|''\):'';/, '★ buildImplementationBody 방법 상세설명 게이트');
  assert.match(PATENT_SRC, /_renderMethodOn\(\)\?outputs\.step_10:''/, '★ downloadAsWord allClaims 게이트');
});

// ─────────── 적대검증 반영: #5 예시도 수 하향 시 명시 유형 절단 방지 ───────────

test('#5 동작 ★ — 명시 유형 3종 후 예시도 수 1 입력 → 목표가 3 미만으로 내려가지 않음(절단 방지)', () => {
  run('clearAllState(); conceptTargetCount=2; conceptDiagramTypes=[]; conceptDiagramEnabled=true;');
  run('_dbToggleConceptType("ui_screen",true); _dbToggleConceptType("user_scenario",true); _dbToggleConceptType("data_structure",true);'); // →3, 목표 3
  run('_dbSet("conceptCount","1");'); // 1로 낮춤 시도
  assert.strictEqual(run('conceptTargetCount'), 3, '★ 선택 3종 하한으로 클램프(침묵 절단 방지)');
  assert.strictEqual(run('conceptDiagramTypes.length'), 3, '★ 선택 유형 보존');
});

test('#5 동작 ★ — 선택 유형이 없으면 예시도 수 하향 자유', () => {
  run('clearAllState(); conceptTargetCount=5; conceptDiagramTypes=[]; conceptDiagramEnabled=true;');
  run('_dbSet("conceptCount","2");');
  assert.strictEqual(run('conceptTargetCount'), 2, '★ 미선택 시 자유 하향');
});

// ─────────── 적대검증 반영: #3 resume 방법 본문 스킵 방지 ───────────

test('#3 소스 ★ — resume 재사용 가드에 방법 완성도(step_12) 조건 추가', () => {
  assert.match(PATENT_SRC, /if\(resume&&outputs\.step_08&&outputs\.step_18&&\(!wantMethod\|\|outputs\.step_12\)\)\{/, '★ 방법 ON인데 step_12 없으면 재사용 안 함');
  assert.match(PATENT_SRC, /const _methodGained=wantMethod&&!_beforeMethod&&!!outputs\.step_12;/, '★ 방법 획득 시 step_08 무변경도 성공 판정');
});

// ─────────── 적대검증 반영: #6 복원 방법-ON opt-in 보호 ───────────

test('#6 동작 ★ — openProject 복원: 저장 방법-ON(true)이나 방법 산출물 없어도 _methodUserSet 보호', async () => {
  const origFrom = sandbox.App.sb.from;
  try {
    mockRow({ outputs: { step_06: '【청구항 1】 장치.' }, includeMethodClaims: true }); // step_10/11 없음
    await run('openProject("x").catch(function(){});');
    assert.strictEqual(run('includeMethodClaims'), true, '★ 방법-ON 복원');
    assert.strictEqual(run('_methodUserSet'), true, '★ 방법 산출물 없어도 opt-in 보호(유형 편집 시 침묵 OFF 방지)');
  } finally { sandbox.App.sb.from = origFrom; }
});

// ─────────────────────── 회귀: 캐시버스트 토큰 ───────────────────────

test('15H 회귀 ★ — ?v= 릴리스 토큰 b50 갱신', () => {
  assert.match(HTML_SRC, /patent\/patent\.js\?v=20260814d/, '★ index.html patent.js 토큰 b50');
  assert.match(readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8'), /version = '20260814d'/, '★ patent.js 로더 version b50');
});
