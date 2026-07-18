/**
 * review-engine/__tests__/patent-multi-citation-forbidden.test.js
 *
 * ★ 지시1 — 다중인용 절대 금지 (정책 변경: 택일 허용 → 전면 금지).
 *   종속항은 단일 항만 인용. 2 이상 항 인용(또는/내지/및, "내지 … 중 어느 한 항" 포함) 전면 금지.
 *   생성 프롬프트(04)·검증기(08 validateClaims multi_dependent_forbidden)에서 강제. F-Q5(다중종속 오분류)도 해소.
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

const vClaims = (t) => JSON.parse(vm.runInContext('JSON.stringify(validateClaims(' + JSON.stringify(t) + '))', sandbox, { filename: 'c.js' }));
const has = (iss, c) => iss.some(i => i.check === c);
const cnt = (iss, c) => iss.filter(i => i.check === c).length;
const BASE = '【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 B를 포함하는 시스템.\n';

// ─────────── 생성 프롬프트 정책 ───────────

test('프롬프트 ★ 04 — 다중인용 절대 금지 지시 존재 + "택일적으로 기재" 부재', () => {
  assert.match(PATENT_SRC, /다중인용\(2 이상의 항을 인용\) 절대 금지/, '★ 다중인용 금지 지시');
  assert.match(PATENT_SRC, /종속항은 반드시 \\?"단일 항\\?"만 인용/, '★ 단일 항 인용 지시');
  assert.ok(!PATENT_SRC.includes('택일적으로 기재'), '★ 종전 "택일적으로 기재" 지시 제거');
});

// ─────────── 검증기: 다중인용 전면 금지 ───────────

test('검증 ★ "또는" 다중인용 → multi_dependent_forbidden HIGH', () => {
  const iss = vClaims(BASE + '【청구항 3】 제1항 또는 제2항에 있어서, C를 더 포함하는 시스템.');
  assert.ok(has(iss, 'multi_dependent_forbidden'), '★ 또는 다중인용 금지 검출');
  assert.ok(iss.filter(i => i.check === 'multi_dependent_forbidden').every(i => i.severity === 'HIGH'), '★ HIGH');
});

test('검증 ★ "및" 다중인용 → multi_dependent_forbidden', () => {
  assert.ok(has(vClaims(BASE + '【청구항 3】 제1항 및 제2항에 있어서, C를 더 포함하는 시스템.'), 'multi_dependent_forbidden'), '★ 및 다중인용 금지');
});

test('검증 ★ "제N항 내지 제M항 중 어느 한 항" → multi_dependent_forbidden (F-Q5 해소)', () => {
  const iss = vClaims(BASE + '【청구항 3】 제1항 내지 제2항 중 어느 한 항에 있어서, C를 더 포함하는 시스템.');
  assert.ok(has(iss, 'multi_dependent_forbidden'), '★ 내지-중어느한항 다중인용 검출');
  assert.ok(!has(iss, 'jepson_form'), '★ F-Q5: 더 이상 젭슨 오탐 없음(종속으로 정확 분류)');
});

test('검증 음성 ★ 단일 항 인용("제1항에 있어서")은 허용(미검출)', () => {
  assert.ok(!has(vClaims(BASE + '【청구항 3】 제1항에 있어서, C를 더 포함하는 시스템.'), 'multi_dependent_forbidden'), '★ 단일 인용 통과');
});

test('검증 음성 ★ 일반 "및"(구성 나열)은 다중인용 아님', () => {
  const iss = vClaims('【청구항 1】 프로세서 및 메모리를 포함하는 시스템.\n【청구항 2】 청구항 1에 있어서, X를 더 포함하는 시스템.');
  assert.ok(!has(iss, 'multi_dependent_forbidden'), '★ "프로세서 및 메모리"는 claim-ref 아님 → 미검출');
});

test('이중계상 없음 ★ 다중인용 1건 → multi_dependent_forbidden 정확히 1건(및/다중의다중 중복 없음)', () => {
  const iss = vClaims(BASE + '【청구항 3】 제1항 및 제2항에 있어서, C를 더 포함하는 시스템.');
  assert.equal(cnt(iss, 'multi_dependent_forbidden'), 1, '★ 단일 방출(통합)');
});

// ─────────── 회귀 ───────────

test('회귀 ★ 단일 종속 정상 청구항 무결 + 독립항 부재 CRITICAL 유지', () => {
  assert.deepEqual(vClaims('【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 청구항 1에 있어서, B를 더 포함하는 시스템.'), [], '★ 정상 단일 종속 무결');
  assert.ok(vClaims('【청구항 1】 제1항에 있어서, A.').some(i => i.severity === 'CRITICAL'), '★ 독립항 없음 CRITICAL 유지');
});
