/**
 * review-engine/__tests__/patent-maximal-method-length.test.js
 *
 * ★ P1(DIAG-splice-dup-audit) — maximal 방법 상세설명 분량 갭 수정.
 *   PR #229가 maximal(25,000자급)을 장치 경로(04 dlCfg 등 4곳)엔 넣었으나 방법 상세설명(step_12) 분량
 *   가이드(04:1336)엔 누락 → maximal 선택 시 방법이 '약 1,200자'(standard) fallback. 04:1336에 maximal 갈래 추가.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);

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
  // step_08/step_12 프롬프트 빌드에 필요한 최소 상태
  vm.runInContext(`
    selectedTitle='검색 시스템'; selectedTitleEn=''; customDetailChars=2000; requiredFigures=[]; diagramData={}; outputTimestamps={}; conceptDiagramTypes=[];
    outputs={ step_06:'【청구항 1】 통신부(110)를 포함하는 시스템.', step_07:'[장치도면설계] 도 1: 통신부(110)', step_10:'【청구항 5】 데이터를 수신하는 단계를 포함하는 방법.', step_11:'[방법도면설계] 도 3: 순서도' };
  `, sandbox);
});

const setLevel = (lv) => vm.runInContext(`detailLevel='${lv}'`, sandbox);
const methodPrompt = () => vm.runInContext("_buildPromptCore('step_12','원본 발명','검색 시스템','')", sandbox, { filename: 'c.js' });
const devicePrompt = () => vm.runInContext("_buildPromptCore('step_08','원본 발명','검색 시스템','')", sandbox, { filename: 'c.js' });

// ─────────── maximal 갭 수정 ───────────

test('maximal ★ 방법 상세설명(step_12) — maximal 분량 지침 반영(standard fallback 아님)', () => {
  setLevel('maximal');
  const p = methodPrompt();
  assert.match(p, /분량 지침: 약 8,000자/, '★ maximal 방법 분량 지침(8,000자 이상)');
  assert.ok(!/분량 지침: 약 1,200자/.test(p), '★ standard(1,200자) fallback 아님');
  assert.match(p, /절대 축약하지 말고|최대한 상세히/, '★ maximal 취지(절대 축약 금지) 반영');
});

test('정합 ★ 장치·방법 모두 maximal에서 대용량 지침(불일치 해소)', () => {
  setLevel('maximal');
  assert.match(devicePrompt(), /22,000~25,000/, '★ 장치 maximal 대용량(dlCfg)');
  assert.match(methodPrompt(), /8,000자\(공백 포함\) 이상/, '★ 방법 maximal 대용량(신규 갈래) — 둘 다 최대급');
});

// ─────────── 회귀: 기존 4개 레벨 불변 ───────────

test('회귀 ★ 방법 분량 지침 — compact/standard/detailed/custom 불변', () => {
  setLevel('compact');  assert.match(methodPrompt(), /분량 지침: 약 800자/, '★ compact 800자');
  setLevel('standard'); assert.match(methodPrompt(), /분량 지침: 약 1,200자/, '★ standard 1,200자');
  setLevel('detailed'); assert.match(methodPrompt(), /분량 지침: 약 2,000자/, '★ detailed 2,000자');
  vm.runInContext("detailLevel='custom'; customDetailChars=3000;", sandbox);
  assert.match(methodPrompt(), /분량 지침: 약 2100자|분량 지침: 약 2,100자/, '★ custom = round(3000*0.7)=2100자');
});

test('회귀 ★ 미지정(비정상 값)은 여전히 1,200자 fallback', () => {
  vm.runInContext("detailLevel='unknown_xyz'", sandbox);
  assert.match(methodPrompt(), /분량 지침: 약 1,200자/, '★ 알 수 없는 값 → 최종 fallback 유지');
});

// ─────────── 소스 어서션 ───────────

test('소스 ★ 04:1336 methodDetailGuide 삼항에 maximal 갈래 추가(문법·순서)', () => {
  assert.match(PATENT_SRC, /dl==='detailed'\?'약 2,000자[^']*'\s*:dl==='maximal'\?'약 8,000자[^']*'\s*:dl==='custom'\?/, '★ detailed → maximal → custom 순서로 갈래 삽입');
});
