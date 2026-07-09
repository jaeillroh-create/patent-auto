/**
 * review-engine/__tests__/patent-concept-desc-flow-polish.test.js
 *
 * ★ ①~⑤ 흐름 빈틈 정리 — Task1(④ 미생성 경고) + Task2(닫는 정형문 섹션 끝).
 *   Task1: 예시도(step_07c svgContent) 있는데 예시도 상세설명(step_08c) 비면 → 미리보기/복사/txt/Word 경고 + 버튼 강조.
 *   Task2: buildImplementationBody = 여는정형문 + [장치+예시(step_08c)+방법] + ★닫는정형문(SUFFIX)을 섹션 끝★ (방법 선존재 정합도 해소).
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

let sandbox, toasts;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast(m, t) { toasts.push({ m, t }); }, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setCtx = (s) => vm.runInContext(s, sandbox);
const SUFFIX_MARK = '본 발명에 따른 방법들은 다양한 컴퓨터 수단';   // STEP8_SUFFIX 의 고유 시작부(닫는 정형문)
const PREFIX_MARK = '이하, 본 발명의 실시예를';

beforeEach(() => { toasts = []; });

// ─────────── Task 2: 닫는 정형문 섹션 끝 ───────────

function descState() {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={}; outputTimestamps={}; conceptDiagramTypes=[]; requiredFigures=[];
    outputs={
      step_06:'【청구항 1】 통신부(110)',
      step_08:'도 1을 참조하면, 통신부(110)가 데이터를 수신한다.',
      step_08c:'도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.',
      step_12:'도 7을 참조하면, S710 단계에서 수신한다.'
    };
  `);
}

test('Task2 ★ buildImplementationBody — 여는정형문 → 장치 → 예시 → 방법 → ★닫는정형문(섹션 끝)', () => {
  descState();
  const body = call('buildImplementationBody()');
  const iPre = body.indexOf(PREFIX_MARK), iDev = body.indexOf('통신부(110)가 데이터를 수신'), iConc = body.indexOf('검색창(31)은 프로세서(120)'), iMeth = body.indexOf('S710 단계에서 수신'), iSuf = body.indexOf(SUFFIX_MARK);
  assert.ok(iPre >= 0 && iDev >= 0 && iConc >= 0 && iMeth >= 0 && iSuf >= 0, '모든 마커 존재');
  assert.ok(iPre < iDev, '여는정형문 맨 앞');
  assert.ok(iDev < iConc && iConc < iMeth, '장치 < 예시 < 방법');
  assert.ok(iMeth < iSuf, '★ 닫는정형문(컴퓨터 판독 가능 매체)이 방법보다 뒤(섹션 끝)');
});

test('Task2 ★ buildSpecification — 발명을 실시 섹션에 닫는정형문이 예시·방법 뒤', () => {
  descState();
  const spec = call('buildSpecification()');
  const iConc = spec.indexOf('검색창(31)은 프로세서(120)'), iMeth = spec.indexOf('S710 단계에서 수신'), iSuf = spec.indexOf(SUFFIX_MARK);
  assert.ok(iConc >= 0 && iMeth >= 0 && iSuf >= 0, '포함');
  assert.ok(iConc < iSuf && iMeth < iSuf, '★ 닫는정형문이 예시·방법 뒤');
});

test('Task2 ★ 정형문 1회만(이중 삽입 없음)', () => {
  descState();
  const body = call('buildImplementationBody()');
  assert.equal((body.match(/본 발명에 따른 방법들은 다양한 컴퓨터 수단/g) || []).length, 1, '★ 닫는정형문 1회');
  assert.equal((body.match(/이하, 본 발명의 실시예를/g) || []).length, 1, '★ 여는정형문 1회');
});

test('Task2 ★ 예시·방법 없으면 — 장치만 PREFIX/SUFFIX(종전과 동일)', () => {
  setCtx(`selectedTitle='x'; diagramData={}; outputTimestamps={}; conceptDiagramTypes=[]; outputs={step_08:'도 1을 참조하면, 통신부(110).'};`);
  const body = call('buildImplementationBody()');
  assert.match(body, /이하, 본 발명의 실시예를[\s\S]*통신부\(110\)[\s\S]*컴퓨터 판독 가능 매체/, '장치만이어도 PREFIX+장치+SUFFIX');
});

// ─────────── Task 1: ④ 미생성 경고 ───────────

test('Task1 ★ _conceptDescMissing — 예시도 있고 step_08c 비면 true', () => {
  setCtx(`conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>'}]; outputs={step_08:'장치'};`);
  assert.equal(call('_conceptDescMissing()'), true, '★ 예시도 O + step_08c X → 누락');
  setCtx(`outputs.step_08c='도 5 예시도 설명';`);
  assert.equal(call('_conceptDescMissing()'), false, '★ step_08c 있으면 false');
  setCtx(`conceptDiagramTypes=[]; outputs={step_08:'장치'};`);
  assert.equal(call('_conceptDescMissing()'), false, '★ 예시도 없으면 false');
});

test('Task1 ★ 복사 출력 시 ④ 미생성 경고 토스트 + _warnConceptDescMissing 직접', () => {
  setCtx(`selectedTitle='x'; diagramData={}; outputTimestamps={}; conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>'}]; requiredFigures=[]; outputs={step_06:'【청구항 1】 통신부(110)', step_08:'도 1을 참조하면, 통신부(110).'};`);
  call('copyToClipboard()');
  assert.ok(toasts.some(t => t.t === 'warning' && /예시도 상세설명 미생성/.test(t.m)), '★ 복사 시 경고');
  toasts = [];
  call('_warnConceptDescMissing()');   // txt/Word 도 동일 헬퍼 호출(소스 4회로 검증)
  assert.ok(toasts.some(t => t.t === 'warning' && /예시도 상세설명 미생성/.test(t.m)), '★ 헬퍼 경고');
});

test('Task1 ★ step_08c 있으면 경고 없음(과경고 아님)', () => {
  setCtx(`selectedTitle='x'; diagramData={}; outputTimestamps={}; conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>'}]; requiredFigures=[]; outputs={step_06:'【청구항 1】 통신부(110)', step_08:'도 1을 참조하면, 통신부(110).', step_08c:'도 5를 참조하면, 검색창(31).'};`);
  call('copyToClipboard()');
  assert.ok(!toasts.some(t => /예시도 상세설명 미생성/.test(t.m)), '★ step_08c 있으면 경고 없음');
});

test('Task1→T2 ★ _updateConceptDescBtn — 보조 강등(항상 btn-outline·"재생성", btn-primary 강조 없음)', () => {
  // ★ display-unify(T2): 통합 버튼이 예시도까지 자동 생성 → 보조 버튼은 강조 없이 조용한 "재생성"으로 일관.
  let cls = new Set(['btn-primary']); let html = '';   // 시작을 btn-primary 로 둬도 제거되는지 확인
  const btn = { classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); }, add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) }, get innerHTML() { return html; }, set innerHTML(v) { html = v; } };
  sandbox.document.getElementById = (id) => id === 'btnStep08c' ? btn : ({ value: '4', style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, querySelectorAll: () => [], innerHTML: '' });
  setCtx(`conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>'}]; outputs={step_08:'장치'};`);
  call('_updateConceptDescBtn()');   // step_08c 미생성이어도
  assert.ok(!cls.has('btn-primary') && cls.has('btn-outline'), '★ 강조 없음(항상 btn-outline)');
  assert.match(html, /예시도 상세설명만 재생성/, '★ 보조 라벨(재생성)');
  assert.ok(!/필요/.test(html), '★ "(필요)" 강조 라벨 제거');
  setCtx(`outputs.step_08c='도 5 설명';`);
  call('_updateConceptDescBtn()');
  assert.ok(!cls.has('btn-primary') && cls.has('btn-outline'), '★ 생성 후에도 동일(보조)');
  sandbox.document.getElementById = (id) => ({ value: '4', style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, querySelectorAll: () => [], innerHTML: '' });
});

// ─────────── 소스 정합 ───────────

test('소스 ★ Task2 — buildImplementationBody 사용(buildSpec·downloadAsWord), 닫는정형문 끝', () => {
  assert.match(PATENT_SRC, /function buildImplementationBody\(\)\{[\s\S]*?STEP8_PREFIX\+'\\n'\+core\+'\\n'\+STEP8_SUFFIX/, '★ PREFIX+core+SUFFIX(끝)');
  assert.equal((PATENT_SRC.match(/\$\{buildImplementationBody\(\)\}|b:buildImplementationBody\(\)/g) || []).length, 2, '★ buildSpec+downloadAsWord 둘 다 사용');
  assert.ok(!/\[desc,getLatestConceptDescription\(\),getLatestMethodDescription\(\)\]/.test(PATENT_SRC), '★ 옛 조립(desc=PREFIX+장치+SUFFIX 중간) 제거');
});

test('소스 ★ Task1 — 경고/배너/버튼강조 배선', () => {
  assert.match(PATENT_SRC, /function _conceptDescMissing\(\)\{/, '_conceptDescMissing');
  assert.match(PATENT_SRC, /function _warnConceptDescMissing\(\)\{/, '_warnConceptDescMissing');
  assert.equal((PATENT_SRC.match(/_warnConceptDescMissing\(\)/g) || []).length, 4, '★ 정의1 + copy/txt/Word 3 호출');
  assert.match(PATENT_SRC, /_conceptDescMissing\(\)\?'<div[^]*?예시도 상세설명 미생성/, '★ renderPreview 인라인 배너');
  assert.match(PATENT_SRC, /function _updateConceptDescBtn\(\)\{/, '_updateConceptDescBtn');
});

// ─────────── 회귀 ───────────

test('회귀 ★ 장치 설명·#215 순서(장치→예시→방법) 유지', () => {
  descState();
  const spec = call('buildSpecification()');
  const iDev = spec.indexOf('통신부(110)가 데이터를 수신'), iConc = spec.indexOf('검색창(31)은 프로세서(120)'), iMeth = spec.indexOf('S710 단계에서 수신');
  assert.ok(iDev < iConc && iConc < iMeth, '장치 < 예시 < 방법(#215 유지)');
});
