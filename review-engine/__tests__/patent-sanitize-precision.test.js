/**
 * review-engine/__tests__/patent-sanitize-precision.test.js
 *
 * ★ P3 — sanitizeMethodFromDevice S단계 문장 제거 정밀화(과삭제 방지).
 *   기존: /S\d{3}/ + (단계|수행|실행) → "S123 파라미터를 수행" 같은 비단계 S### 줄까지 삭제.
 *   수정: 단계 문맥(단계 S### / S###…단계 / S###에서)일 때만 삭제. 비단계 S###(수치·식별자) 보존.
 *   ★ 방법 도면 단락 제거(330)는 device desc의 method-fig 누수 제거 = 의도된 동작(기존 테스트 인코딩)이라 유지.
 */
import { test, before, beforeEach } from 'node:test';
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
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setCtx = (s) => vm.runInContext(s, sandbox);
const sanitize = (text) => call('sanitizeMethodFromDevice(' + JSON.stringify(text) + ')');

beforeEach(() => {
  // 장치 도면 1~3(deviceMax=3), 예시도 없음(conceptFigNums=[])
  setCtx(`diagramData={step_07:[{},{},{}]}; conceptDiagramTypes=[]; requiredFigures=[]; outputs={step_07:'도 1: 전체 구성도\\n도 2: 통신부 상세\\n도 3: 프로세서 상세'};`);
});

// ─────────── 과삭제 방지(정상 보존) ───────────

test('P3 ★ 비단계 S###("S123 파라미터")는 보존 — no-method 분기', () => {
  // 도면 참조 없음 → methodFigNums 비어 no-method 분기(단독 S단계만 제거)
  const out = sanitize('통신부(110)가 S123 파라미터를 기준값으로 설정한다.\n단계 S310에서 데이터를 수신한다.\n프로세서(120)가 동작한다.');
  assert.match(out, /S123 파라미터를 기준값으로 설정한다/, '★ 비단계 S123(수치/식별자) 보존');
  assert.ok(out.indexOf('S310') < 0, '★ 진짜 단계(단계 S310에서) 제거(양성 유지)');
  assert.match(out, /프로세서\(120\)가 동작한다/, '★ 일반 본문 보존');
});

test('P3 ★ 비단계 S###는 보존 — method-fig 분기(도 4 방법 도면 존재)', () => {
  // 도 4(>deviceMax, 예시도 아님) → methodFigNums={4} → 3단계 루프(방법 도면 단락 + S단계 제거)
  const out = sanitize('도 4는 방법을 나타내는 순서도이다. 도 4를 참조하면 단계가 진행된다.\n\n통신부(110)가 S123 파라미터를 기준값으로 설정한다.\n\n단계 S310에서 데이터를 수신한다.');
  assert.ok(out.indexOf('도 4는 방법을 나타내는 순서도이다') < 0, '★ 방법 도면 단락 제거(330 의도 유지)');
  assert.match(out, /S123 파라미터를 기준값으로 설정한다/, '★ 비단계 S123 보존(337 정밀화)');
  assert.ok(out.indexOf('단계 S310에서 데이터를 수신한다') < 0, '★ 진짜 단계(단계 S310에서) 제거(양성 유지)');
});

test('P3 ★ 장치 도면 참조("도 2를 참조하면")는 보존(방법 도면 아님)', () => {
  const out = sanitize('도 2를 참조하면 상기 장치의 프로세서(120)가 신호를 처리한다.');
  assert.match(out, /도 2를 참조하면 상기 장치의 프로세서\(120\)/, '★ deviceMax 이내 도면 참조 보존');
});

// ─────────── 양성 유지(진짜 혼입 제거) ───────────

test('P3 ★ 양성 — 다양한 단계 표기(S###…단계 / S###에서) 제거', () => {
  const a = sanitize('통신부가 동작한다.\nS410 데이터를 수신하는 단계를 수행한다.');
  assert.ok(a.indexOf('S410') < 0, '★ "S410 …수신하는 단계" 제거');
  const b = sanitize('프로세서가 처리한다.\nS420에서 결과를 출력한다.');
  assert.ok(b.indexOf('S420') < 0, '★ "S420에서 …" 제거');
});

// ─────────── 회귀 ───────────

test('P3 회귀 ★ 진짜 방법 순서도 소개문은 여전히 제거(도 6 > deviceMax)', () => {
  setCtx(`diagramData={step_07:[{},{},{}],step_11:[{}]}; conceptDiagramTypes=[];`);
  const out = sanitize('도 1을 참조하면, 통신부(110)가 동작한다.\n\n도 6은 방법을 나타내는 순서도이다. 도 6을 참조하면, 처리가 수행된다.');
  assert.match(out, /도 1을 참조하면, 통신부\(110\)/, '장치 설명 보존');
  assert.ok(out.indexOf('도 6은 방법을 나타내는 순서도이다') < 0, '★ 방법 순서도(도 6) 제거 유지');
});

test('P3 소스 ★ S단계 제거가 단계 문맥 요구(비단계 S### 보존)', () => {
  assert.match(PATENT_SRC, /단계\\s\*S\\d\{3\}\|S\\d\{3\}\[\^\\n\]\{0,15\}단계\|S\\d\{3\}\\s\*에서/, '★ 단계 문맥 정규식(307·337)');
  assert.ok(!/\/S\\d\{3\}\/\.test\(trimmed\)&&\/단계\|수행\|실행\//.test(PATENT_SRC), '★ 구 느슨한 조건(수행|실행 단독) 제거');
});
