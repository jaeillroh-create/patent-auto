/**
 * review-engine/__tests__/patent-claim-quality-gate.test.js
 *
 * ★ Item 3 — FIX 품질 게이팅: B/C군(도면·상세설명·수학식)은 선행 청구항이 validateClaims 를 통과해야 진행.
 *   _claimGateStatus(sid): 장치계(07/08/09/08c)=step_06, 방법계(11/12)=step_06 컨텍스트 합산+step_10.
 *   _claimGatePass(sid): CRITICAL→차단(false), HIGH→확인 모달, 0→통과. bulk=true면 모달 생략.
 *   케스케이드·인터랙티브 진입점 게이트 배선 소스 검증 + 회귀.
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
const setOutputs = (obj) => call('Object.assign(outputs, ' + JSON.stringify(obj) + ')');
const resetOutputs = () => call('outputs = {}');
const gateStatus = (sid) => JSON.parse(call('JSON.stringify((function(){var g=_claimGateStatus(' + JSON.stringify(sid) + ');return {critical:g.critical,high:g.high};})())'));
const gatePass = async (sid, bulk) => await call('_claimGatePass(' + JSON.stringify(sid) + ',' + (bulk ? 'true' : 'false') + ')');
const setConfirm = (v) => call('window.confirm = function(){return ' + (v ? 'true' : 'false') + ';}');
const clearConfirm = () => call('delete window.confirm');

const CRIT_CLAIMS = '【청구항 1】 제1항에 있어서, 통신부를 포함하는 시스템.'; // 전부 종속 → 독립항 없음(CRITICAL)
const OK_CLAIMS = '【청구항 1】 통신부를 포함하는 시스템.\n【청구항 2】 청구항 1에 있어서, 프로세서를 더 포함하는 시스템.';
const HIGH_CLAIMS = '【청구항 1】 통신부를 반드시 포함하는 시스템.'; // KILLER_WORDS "반드시" → HIGH, 독립항 존재 → CRITICAL 0

// ─────────── _claimGateStatus ───────────

test('status ★ 장치계(step_08) — 청구항 CRITICAL 감지', () => {
  resetOutputs(); setOutputs({ step_06: CRIT_CLAIMS });
  assert.ok(gateStatus('step_08').critical > 0, '★ 독립항 없음 CRITICAL 게이트 신호');
});

test('status ★ 장치계(step_08) — 정상 청구항은 통과(0)', () => {
  resetOutputs(); setOutputs({ step_06: OK_CLAIMS });
  assert.deepEqual(gateStatus('step_08'), { critical: 0, high: 0 }, '★ 정상 청구항 통과');
});

test('status ★ 장치계 — HIGH만 있는 청구항(반드시)', () => {
  resetOutputs(); setOutputs({ step_06: HIGH_CLAIMS });
  const g = gateStatus('step_09');
  assert.equal(g.critical, 0, '★ CRITICAL 0'); assert.ok(g.high > 0, '★ HIGH>0(제한적 표현)');
});

test('status ★ 방법계(step_12) — step_06 컨텍스트 합산 검사(05:81 패턴)', () => {
  // 방법 종속항이 장치 청구항(step_06)을 인용 — step_10 단독이면 "독립항 없음/참조 없음"이나 합산 시 해소
  resetOutputs(); setOutputs({ step_06: '【청구항 1】 통신부를 포함하는 시스템.', step_10: '【청구항 2】 청구항 1에 있어서, 데이터를 수신하는 단계를 포함하는 방법.' });
  assert.equal(gateStatus('step_12').critical, 0, '★ 합산 검사 시 CRITICAL 0(장치 독립항이 컨텍스트 제공)');
  // 대조: step_10 단독 검증은 CRITICAL(독립항 없음 + 참조 청구항 1 없음)
  const solo = JSON.parse(call('JSON.stringify(validateClaims(outputs.step_10).filter(function(i){return i.severity==="CRITICAL";}))'));
  assert.ok(solo.length > 0, '★ 대조: step_10 단독은 CRITICAL(합산의 효과 실증)');
});

test('status ★ 방법계(step_11) — step_10 HIGH 감지', () => {
  resetOutputs(); setOutputs({ step_06: OK_CLAIMS, step_10: '【청구항 3】 데이터를 반드시 처리하는 단계를 포함하는 방법.' });
  assert.ok(gateStatus('step_11').high > 0, '★ 방법 청구항 HIGH 감지');
});

test('status ★ 비-B/C 스텝(step_02·step_06)은 게이트 대상 아님(통과)', () => {
  resetOutputs(); setOutputs({ step_06: CRIT_CLAIMS });
  assert.deepEqual(gateStatus('step_02'), { critical: 0, high: 0 }, '★ D군 통과');
  assert.deepEqual(gateStatus('step_06'), { critical: 0, high: 0 }, '★ 청구항 자체는 게이트 대상 아님');
});

// ─────────── _claimGatePass (async) ───────────

test('pass ★ CRITICAL → 차단(false), 모달 호출 안 함', async () => {
  resetOutputs(); setOutputs({ step_06: CRIT_CLAIMS });
  call('globalThis.__confirmCalled=false; window.confirm=function(){__confirmCalled=true;return true;};');
  assert.equal(await gatePass('step_08', false), false, '★ CRITICAL 하드 차단');
  assert.equal(call('__confirmCalled'), false, '★ CRITICAL 시 모달 미호출');
  clearConfirm();
});

test('pass ★ HIGH + 사용자 진행(confirm=true) → true', async () => {
  resetOutputs(); setOutputs({ step_06: HIGH_CLAIMS });
  setConfirm(true);
  assert.equal(await gatePass('step_08', false), true, '★ HIGH 모달 진행');
  clearConfirm();
});

test('pass ★ HIGH + 사용자 취소(confirm=false) → false', async () => {
  resetOutputs(); setOutputs({ step_06: HIGH_CLAIMS });
  setConfirm(false);
  assert.equal(await gatePass('step_08', false), false, '★ HIGH 모달 취소 → 중단');
  clearConfirm();
});

test('pass ★ HIGH + bulk=true → 모달 생략하고 진행(true)', async () => {
  resetOutputs(); setOutputs({ step_06: HIGH_CLAIMS });
  call('globalThis.__c2=false; window.confirm=function(){__c2=true;return false;};');
  assert.equal(await gatePass('step_08', true), true, '★ 일괄 모드는 HIGH 모달 생략');
  assert.equal(call('__c2'), false, '★ bulk 시 모달 미호출');
  clearConfirm();
});

test('pass ★ 정상 청구항 → 통과(true)', async () => {
  resetOutputs(); setOutputs({ step_06: OK_CLAIMS });
  assert.equal(await gatePass('step_08', false), true, '★ 정상 플로우 무차단');
});

// ─────────── 소스 어서션 (배선) ───────────

test('소스 ★ 인터랙티브 진입점 게이트 배선', () => {
  assert.match(PATENT_SRC, /_claimGatePass\(sid\)\)\)return;setGlobalProcessing\(true\);try\{await _longStepCore/, '★ runLongStep');
  assert.match(PATENT_SRC, /_claimGatePass\('step_09'\)\)\)return;setGlobalProcessing\(true\);loadingState\.step_09/, '★ runMathInsertion');
  assert.match(PATENT_SRC, /_claimGatePass\(sid\)\)\)return;\s*\/\/ \[Item 3\] 품질 게이트/, '★ runDiagramStep');
  assert.match(PATENT_SRC, /_claimGatePass\('step_08c'\)\)\)return;/, '★ runConceptDescStep');
});

test('소스 ★ 케스케이드 CRITICAL 중단 배선', () => {
  assert.match(PATENT_SRC, /_claimGateStatus==='function'\)\?_claimGateStatus\(sid\)/, '★ 케스케이드 게이트 호출(방어적)');
  assert.match(PATENT_SRC, /청구항 CRITICAL[\s\S]*?재생성 중단/, '★ 중단 메시지');
});

// ─────────── 회귀 ───────────

test('회귀 ★ validateClaims 동작 불변(게이트가 청구항 자체 검증에 영향 없음)', () => {
  const iss = JSON.parse(call('JSON.stringify(validateClaims(' + JSON.stringify(OK_CLAIMS) + '))'));
  assert.deepEqual(iss, [], '★ 정상 청구항 무결 유지');
});
