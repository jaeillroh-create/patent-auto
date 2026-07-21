/**
 * review-engine/__tests__/patent-math-duplicate.test.js
 *
 * ★ 수학식 삽입 시 예시도 설명 중복 방지 — 조립 dedup 견고화.
 *   진단(DIAG-math-duplicate): buildImplementationBody 의 conceptIn=device.indexOf(concept.slice(0,40)) 이
 *   수학식(step_09)이 예시도 시작부에 【수학식】을 끼우면 40자 연속성 붕괴 → conceptIn=false → 예시도 중복.
 *   합본(#220) 후 step_09 = 장치+예시도+수학식 이라 드러남.
 *   FIX: stripMathBlocks(device)로 수학식 제거 + 공백 전부 제거 후 첫 N자 containment → 수학식 위치 무관 dedup.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const App = { sb: { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } }, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setCtx = (s) => vm.runInContext(s, sandbox);

// 합본 + 수학식 시뮬: device→concept→merge(step_08)→math(step_09=장치+예시도+수학식). math 앵커 위치 가변.
function setup(conceptText, mathAnchor) {
  setCtx(`
    selectedTitle='검색'; diagramData={step_07:[{},{},{},{}]}; outputTimestamps={}; requiredFigures=[]; includeMethodClaims=true; inventionScope=null;
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',refMap:[{signNumber:'51',label:'검색창'}]}];
    outputs={step_06:'【청구항 1】 통신부(110)', step_07:'[도면] 통신부(110)', step08_device:'도 1을 참조하면, 통신부(110)가 데이터를 수신한다. 프로세서(120)가 데이터를 처리한다.', step_08c:${JSON.stringify(conceptText)}, step_12:'도 7을 참조하면, S710 단계에서 수신한다.'};
  `);
  call('_mergeConceptIntoStep08()');                 // step_08 = device + 예시도
  setCtx('outputTimestamps.step_08=100;');
  const math = `---MATH_BLOCK_1---\nANCHOR: ${mathAnchor}\nFORMULA:\n【수학식 1】\nY = aX + b\n`;
  setCtx(`outputs.step_09=insertMathBlocks(getLatestDescription(), ${JSON.stringify(math)}); outputTimestamps.step_09=200;`);   // step_09 = 장치+예시도+수학식
}
const conceptCnt = (fn) => (call(fn).match(/검색창\(51\)/g) || []).length;

// ─────────── 핵심: 수학식 위치 무관 예시도 1회 ───────────

test('★ 케이스 A — 수학식 앵커=장치 문장 → 예시도 1회(정상)', () => {
  setup('도 5를 참조하면, 검색창(51)은 프로세서(120)가 실행하는 소프트웨어 모듈에 의해 표시 영역에 렌더링된다.', '프로세서(120)가 데이터를 처리한다');
  assert.ok(call('outputs.step_09').includes('검색창(51)'), 'step_09에 예시도 합본 포함');
  assert.equal(conceptCnt('buildImplementationBody()'), 1, '★ 예시도 1회');
});

test('★ 케이스 B(핵심) — 수학식 앵커=예시도 첫 문장(짧음) → 첫 40자 안 삽입돼도 예시도 1회(중복 0)', () => {
  setup('도 5는 화면이다. 검색창(51)은 프로세서(120)에 의해 표시된다.', '도 5는 화면이다');
  assert.ok(call('outputs.step_09').includes('검색창(51)'), 'step_09에 예시도 포함');
  assert.ok(call('outputs.step_09').includes('【수학식 1】'), '수학식 삽입됨');
  assert.equal(conceptCnt('buildImplementationBody()'), 1, '★ 견고화 dedup: 수학식이 예시도 시작부에 끼어도 중복 0');
});

test('★ 케이스 C — 예시도 앞 줄바꿈 → 1회', () => {
  setup('\n도 5를 참조하면, 검색창(51)은 프로세서(120)에 의해 표시된다.', '통신부(110)가 데이터를 수신한다');
  assert.equal(conceptCnt('buildImplementationBody()'), 1, '★ 예시도 1회');
});

test('★ 미합본 구사건 — step_09=장치-only+수학식(예시도 미포함) → 예시도 1회 보강(누락·중복 0)', () => {
  setCtx(`
    selectedTitle='검색'; diagramData={step_07:[{},{},{},{}]}; requiredFigures=[]; includeMethodClaims=true; inventionScope=null;
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',refMap:[{signNumber:'51',label:'검색창'}]}];
    outputs={step_06:'【청구항 1】', step_08:'도 1을 참조하면, 통신부(110)가 동작한다.', step_08c:'도 5를 참조하면, 검색창(51)이 표시된다.', step_12:'도 7 S710 단계.'};
    outputTimestamps={step_08:100};
  `);
  setCtx(`outputs.step_09=insertMathBlocks(getLatestDescription(), '---MATH_BLOCK_1---\\nANCHOR: 통신부(110)가 동작한다\\nFORMULA:\\n【수학식 1】\\nY=aX\\n'); outputTimestamps.step_09=200;`);
  assert.ok(call('outputs.step_09').indexOf('검색창(51)') < 0, '미합본: step_09엔 예시도 없음(장치-only+수학식)');
  assert.equal(conceptCnt('buildImplementationBody()'), 1, '★ 미합본도 예시도 1회 보강(누락 0·중복 0)');
});

test('★ buildSpecification 도 동일(buildImplementationBody 공용) — 케이스 B 1회', () => {
  setup('도 5는 화면이다. 검색창(51)은 프로세서(120)에 의해 표시된다.', '도 5는 화면이다');
  setCtx('diagramData={};');   // extractBriefDescriptions 텍스트 폴백(노드 스텁 .nodes 부재 회피) — 합본은 setup 에서 이미 완료
  assert.equal(conceptCnt('buildSpecification()'), 1, '★ buildSpecification 예시도 1회');
});

// ─────────── 소스 / 회귀 ───────────

test('소스 ★ dedup 견고화 — stripMathBlocks + 공백 무시 containment', () => {
  assert.match(PATENT_SRC, /stripMathBlocks\(String\(s\|\|''\)\)\.replace\(\/\\s\+\/g,''\)/, '★ 수학식 제거+공백 무시 정규화');
  assert.match(PATENT_SRC, /conceptIn\s*=\s*_conN\.length>0\s*&&\s*_devN\.indexOf\(_conN\.slice\(0,30\)\)>=0/, '★ 정규화 후 첫 N자 containment');
});

test('회귀 ★ 장치·수학식 본문 보존(케이스 B) + ?v= 20260721-b29', () => {
  setup('도 5는 화면이다. 검색창(51)은 프로세서(120)에 의해 표시된다.', '도 5는 화면이다');
  const spec = call('buildImplementationBody()');
  assert.match(spec, /통신부\(110\)가 데이터를 수신한다/, '장치 본문 보존');
  assert.match(spec, /【수학식 1】/, '수학식 보존');
  assert.match(spec, /S710 단계/, '방법 본문 보존');
  assert.match(HTML_SRC, /patent\/patent\.js\?v=20260721-b29/, '★ ?v= 갱신');
});
