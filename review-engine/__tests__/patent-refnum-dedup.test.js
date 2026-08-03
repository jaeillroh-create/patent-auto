/**
 * review-engine/__tests__/patent-refnum-dedup.test.js
 *
 * ★ P2 — "본문 사용 부호 ↔ 부호의 설명 미정의" 이중 검출 일원화.
 *   validateRefNumberConsistency(청구항 탭)에서 "부호의 설명 누락" 방출 제거 → CHK-4(완성본, validateSpecification)로 단일화.
 *   validateRefNumberConsistency 고유 검사(명칭 불일치·도면 미정의)는 보존.
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
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const refCheck = () => JSON.parse(call('JSON.stringify(validateRefNumberConsistency())'));
const vSpec = (t) => JSON.parse(call('JSON.stringify(validateSpecification(' + JSON.stringify(t) + '))'));

// ─────────── P2: 부호 미정의 일원화 ───────────

test('P2 ★ validateRefNumberConsistency — "부호의 설명 누락" 미방출(CHK-4로 일원화)', () => {
  // 본문에 통신부(110) 사용, step_18(부호의 설명) 비어있음 → 구 코드면 "부호의 설명 누락: 통신부(110)" 방출
  call(`outputTimestamps={step_08:1}; outputs={step_08:'통신부(110)가 데이터를 수신한다. 통신부(110)는 무선이다. 통신부(110)가 동작한다.', step_06:'【청구항 1】 통신부(110)를 포함.', step_07:'[도면] 통신부(110)', step_18:''};`);
  assert.ok(!refCheck().some(i => /부호의 설명 누락/.test(i.message)), '★ 부호 미정의는 청구항 탭에서 미방출');
});

test('P2 ★ 고유 검사 보존 — 명칭 불일치(동일 번호 복수 명칭)', () => {
  call(`outputTimestamps={step_08:1}; outputs={step_08:'통신부(110)가 수신한다. 통신부(110)는 무선이다. 통신부(110)가 동작한다. 송신부(110)가 전송한다. 송신부(110)는 유선이다. 송신부(110)가 작동한다.', step_06:'', step_07:'[도면] 통신부(110)', step_18:'통신부 : 110'};`);
  assert.ok(refCheck().some(i => /명칭 불일치/.test(i.message)), '★ 명칭 불일치(통신부 vs 송신부) 검출 유지');
});

test('P2 ★ 고유 검사 보존 — 도면 미정의 참조번호', () => {
  // 999가 본문 3회 사용되나 도면(step_07/11)에 없음 → 도면 미정의 HIGH
  call(`outputTimestamps={step_08:1}; outputs={step_08:'저장부(999)가 저장한다. 저장부(999)는 대용량이다. 저장부(999)가 동작한다.', step_06:'', step_07:'[도면] 통신부(110)', step_18:'저장부 : 999'};`);
  assert.ok(refCheck().some(i => /도면 미정의/.test(i.message)), '★ 도면 미정의 검출 유지');
});

test('P2 ★ CHK-4(완성본)가 부호 미정의 단일 소스 — 유지', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n예를 들어, 통신부(110)가 데이터를 수신한다.\n\n【부호의 설명】\n프로세서 : 120';
  const iss = vSpec(spec);
  assert.ok(iss.some(i => i.check === 'refnum_consistency' && /미정의/.test(i.message)), '★ CHK-4 usedNotDef(110 미정의) 방출(단일 소스)');
});

test('P2 ★ 회귀 — CHK-4 defNotUsed(부호의 설명 정의됐으나 본문 미사용) 불변', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n예를 들어, 통신부(110)가 동작한다.\n\n【부호의 설명】\n통신부 : 110\n미사용부 : 777';
  assert.ok(vSpec(spec).some(i => i.check === 'refnum_consistency' && /미사용/.test(i.message)), '★ defNotUsed(777) 유지');
});

test('P2 소스 ★ validateRefNumberConsistency 부호 미정의 방출 제거 + 일원화 주석', () => {
  assert.ok(!/부호의 설명 누락: \$\{primary\}/.test(PATENT_SRC), '★ "부호의 설명 누락" 방출 제거');
  assert.match(PATENT_SRC, /P2 일원화[\s\S]*?CHK-4/, '★ 일원화 주석');
  assert.match(PATENT_SRC, /명칭 불일치/, '★ 명칭 불일치(고유) 유지');
  assert.match(PATENT_SRC, /도면 미정의 참조번호/, '★ 도면 미정의(고유) 유지');
});
