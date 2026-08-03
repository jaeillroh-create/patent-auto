/**
 * review-engine/__tests__/patent-length-example.test.js
 *
 * ★ Item 4 — 분량·예시 규율.
 *   ① 25,000자급 프리셋 'maximal' 추가 — 04 dlCfg 테이블 · 01 dlLevels 배열 · index.html 카드 · 05 임계맵 4곳 정합.
 *   ② 예시 없는 문단 스캔(CHK-9, validateSpecification): 실시내용 섹션의 구성요소(참조번호) 문단에 예시 마커 부재 시
 *      MEDIUM 'example_missing' 리포트(자동 보충 안 함). 표제·수학식·짧은 문단·청구범위/요약서 제외.
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
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setCtx = (s) => vm.runInContext(s, sandbox);
const vSpec = (txt) => JSON.parse(call('JSON.stringify(validateSpecification(' + JSON.stringify(txt) + '))'));
const hasCheck = (iss, c) => iss.some(i => i.check === c);

// ─────────── ① maximal 프리셋 4곳 정합 ───────────

test('프리셋 ★ 04 dlCfg 테이블에 maximal 존재', () => {
  assert.match(PATENT_SRC, /maximal:\{charPerFig:'약 3,000자 이상',total:'약 22,000~25,000자'/, '★ maximal 프리셋 정의');
});

test('프리셋 ★ 01 dlLevels 배열에 maximal(카드 순서 정합)', () => {
  assert.match(PATENT_SRC, /dlLevels=\['compact','standard','detailed','maximal','custom'\]/, '★ dlLevels 5종');
});

test('프리셋 ★ 05 글자수 임계맵에 maximal:3000', () => {
  assert.match(PATENT_SRC, /compact:1000,standard:1500,detailed:2000,maximal:3000,custom/, '★ 임계맵 maximal');
});

test('프리셋 ★ index.html 카드 — maximal 카드 + grid 5열', () => {
  assert.match(HTML_SRC, /grid-template-columns:repeat\(5,1fr\)[^]*?id="detailLevelCards"|id="detailLevelCards"[^]*?repeat\(5,1fr\)/, '★ 5열 그리드');
  assert.match(HTML_SRC, /selectDetailLevel\(this,'maximal'\)/, '★ maximal 카드');
});

test('프리셋 ★ 카드 수(5) = dlLevels 길이(5) 정합', () => {
  const iCards = HTML_SRC.indexOf('id="detailLevelCards"');
  const seg = HTML_SRC.slice(iCards, HTML_SRC.indexOf('</div>', HTML_SRC.indexOf('custom', iCards)) + 200);
  const cardCount = (seg.match(/selectDetailLevel\(this,'/g) || []).length;
  assert.equal(cardCount, 5, '★ 카드 5장(compact/standard/detailed/maximal/custom)');
});

test('프리셋 ★ detailLevel=maximal 실제 프롬프트 경로 — 테이블 조회 성립(undefined 아님)', () => {
  setCtx(`
    selectedTitle='검색 시스템'; detailLevel='maximal'; customDetailChars=2000; requiredFigures=[]; diagramData={}; outputTimestamps={}; conceptDiagramTypes=[];
    outputs={step_06:'【청구항 1】 통신부(110)를 포함하는 시스템.', step_07:'[장치도면설계] 도 1: 통신부(110)'};
  `);
  const p = call("_buildPromptCore('step_08','원본 발명','검색 시스템','')");
  assert.match(p, /22,000~25,000/, '★ maximal 총 분량 지시가 프롬프트에 반영(테이블 조회 정상)');
});

// ─────────── ② 예시 스캔(CHK-9) ───────────

const IMPL_HDR = '【발명을 실시하기 위한 구체적인 내용】\n';

test('예시 ★ 양성 — 구성요소 문단에 예시 마커 없음 → MEDIUM example_missing', () => {
  const spec = IMPL_HDR + '도 1을 참조하면, 통신부(110)는 외부로부터 데이터를 수신하고 프로세서(120)는 수신된 데이터를 분석하여 결과를 생성한다.';
  const iss = vSpec(spec);
  assert.ok(hasCheck(iss, 'example_missing'), '★ 예시 없는 구성요소 문단 검출');
  assert.ok(iss.filter(i => i.check === 'example_missing').every(i => i.severity === 'MEDIUM'), '★ MEDIUM(리포트)');
});

test('예시 ★ 음성 — 예시 마커("예를 들어") 있는 문단 미검출', () => {
  const spec = IMPL_HDR + '도 1을 참조하면, 통신부(110)는 데이터를 수신한다. 예를 들어, 프로세서(120)는 딥러닝 모델을 사용하여 분석한다.';
  assert.ok(!hasCheck(vSpec(spec), 'example_missing'), '★ 예시 포함 문단 미검출');
});

test('예시 ★ 음성 — 표제·수학식·짧은·참조번호 없는 문단은 제외', () => {
  const spec = IMPL_HDR + '【수학식 1】\nF=ma\n\n짧은 문단.\n\n구성요소 참조번호가 없는 서술 문단이 여기에 길게 이어지지만 참조번호가 없어 예시 스캔 대상이 아니다.';
  assert.ok(!hasCheck(vSpec(spec), 'example_missing'), '★ 수학식/짧은/무참조번호 문단 제외');
});

test('예시 ★ 음성 — 청구범위·요약서(실시내용 밖) 구성요소 문단은 스캔 안 함', () => {
  const spec = IMPL_HDR + '도 1을 참조하면, 통신부(110)는 데이터를 수신한다. 예를 들어 버퍼링을 수행한다.\n\n【청구범위】\n【청구항 1】 통신부(110)를 포함하는 시스템.\n\n【요약서】\n통신부(110)를 포함하는 시스템을 제공한다.';
  assert.ok(!hasCheck(vSpec(spec), 'example_missing'), '★ 청구범위/요약서 문단은 실시내용 밖 → 미스캔(실시내용은 예시 포함)');
});

// ─────────── 교차/회귀 ───────────

test('회귀 ★ CHK-1~8 불변 — 문단 중복 CRITICAL·수학식 변수 검출 유지', () => {
  const dup = '도 1을 참조하면, 통신부(110)는 외부 장치로부터 데이터를 수신하여 내부 버퍼에 순차적으로 저장하고 프로세서로 전달한다.';
  assert.ok(vSpec(dup + '\n\n' + dup).some(i => i.check === 'paragraph_duplicate' && i.severity === 'CRITICAL'), '★ CHK-6 유지');
  assert.ok(hasCheck(vSpec('【수학식 1】\nG = f(λ)\n여기서 G는 이득이다.'), 'math_var_undefined'), '★ CHK-8 유지(λ 미정의)');
});

test('교차 ★ example_missing 은 MEDIUM — Item3 게이트(validateClaims) 무관', () => {
  // _claimGateStatus 는 validateClaims 만 호출 → validateSpecification CHK-9 와 독립
  assert.match(PATENT_SRC, /function _claimGateStatus\(sid\)\{[\s\S]*?validateClaims/, '★ 게이트는 청구항 검증만(완성본 스캔과 독립)');
});
