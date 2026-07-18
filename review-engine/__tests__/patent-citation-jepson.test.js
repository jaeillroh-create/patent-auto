/**
 * review-engine/__tests__/patent-citation-jepson.test.js
 *
 * ★ Item 5 — 인용표기 통일 + 젭슨/앵커 기계검증.
 *   ① 생성 지시 통일: 종속항 "제N항에 있어서,"(04:711) — validateClaims 파싱은 양쪽 수용 유지(구 데이터 호환).
 *   ② 젭슨 기계검증(validateClaims): 독립항 전환부"~에 있어서," + 종결부"~특징으로 하는" 존재·순서, 위반 MEDIUM. 미채택은 미검출.
 *   ③ 앵커/종속항 최소 검증: 인용은 있으나 실질 부가 한정 없는 빈 종속항 MEDIUM.
 *   MEDIUM만 추가하므로 Item3 게이트(CRITICAL/HIGH 기준)에 무영향.
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
const vClaims = (txt) => JSON.parse(call('JSON.stringify(validateClaims(' + JSON.stringify(txt) + '))'));
const hasCheck = (iss, c) => iss.some(i => i.check === c);
const critCount = (iss) => iss.filter(i => i.severity === 'CRITICAL').length;

// ─────────── ① 생성 지시 통일 ───────────

test('통일 ★ 04 생성 지시 — "청구항 N에 있어서" 부재, "제N항에 있어서" 존재', () => {
  // 생성 지시(종속항은 "...에 있어서," 시작)만 대상 — 08 파서 설명 주석의 "청구항 N에 있어서"는 양쪽 수용 문서화라 허용.
  assert.ok(!/종속항은\s*\\?"청구항 N에 있어서/.test(PATENT_SRC), '★ "청구항 N에 있어서" 생성 지시 제거됨');
  assert.match(PATENT_SRC, /종속항은\s*\\?"제N항에 있어서/, '★ 종속항 지시 "제N항에 있어서"로 통일(04:711)');
});

// ─────────── ② 파싱 회귀(양쪽 형식 수용 유지) ───────────

test('파싱 ★ "청구항 N에 있어서" 종속항 형식 여전히 종속으로 판별', () => {
  const iss = vClaims('【청구항 2】 청구항 1에 있어서, A를 포함하는 시스템.'); // 독립항 없음(전부 종속)
  assert.ok(critCount(iss) > 0, '★ 종속 판별 → 독립항 없음 CRITICAL(구 형식 파싱 유지)');
});

test('파싱 ★ "제N항에 있어서" 종속항 형식도 종속으로 판별', () => {
  const iss = vClaims('【청구항 2】 제1항에 있어서, A를 포함하는 시스템.');
  assert.ok(critCount(iss) > 0, '★ 종속 판별 → 독립항 없음 CRITICAL(신 형식 파싱 유지)');
});

test('파싱 ★ 두 형식 혼용해도 정상 독립+종속 구조는 무결', () => {
  assert.deepEqual(vClaims('【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 청구항 1에 있어서, B를 더 포함하는 시스템.'), [], '★ 구 형식 종속항 정상');
  assert.deepEqual(vClaims('【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 제1항에 있어서, B를 더 포함하는 시스템.'), [], '★ 신 형식 종속항 정상');
});

// ─────────── ② 젭슨 기계검증 ───────────

test('젭슨 ★ 양성 — 전환부만 있고 종결부 없음 → MEDIUM jepson_form', () => {
  const iss = vClaims('【청구항 1】 검색 시스템에 있어서, 통신부를 포함하는 시스템.');
  assert.ok(hasCheck(iss, 'jepson_form'), '★ 불완전 젭슨(종결부 누락) 검출');
  assert.ok(iss.filter(i => i.check === 'jepson_form').every(i => i.severity === 'MEDIUM'), '★ MEDIUM severity');
});

test('젭슨 ★ 음성 — 완전한 젭슨(전환부+종결부 순서 정상) 미검출', () => {
  const iss = vClaims('【청구항 1】 검색 시스템에 있어서, 통신부를 포함하는 것을 특징으로 하는 검색 시스템.');
  assert.ok(!hasCheck(iss, 'jepson_form'), '★ 완전 젭슨 미검출');
});

test('젭슨 ★ 음성2 — 젭슨 미채택(전환부·종결부 모두 없음) 미검출', () => {
  const iss = vClaims('【청구항 1】 통신부를 포함하는 검색 시스템.');
  assert.ok(!hasCheck(iss, 'jepson_form'), '★ 비젭슨 독립항은 불완전 아님(미검출)');
});

// ─────────── ③ 앵커/종속항 최소 검증 ───────────

test('앵커 ★ 양성 — 인용만 있고 실질 부가 없는 빈 종속항 → MEDIUM anchor_no_limitation', () => {
  const iss = vClaims('【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 제1항에 있어서, 시스템.');
  assert.ok(hasCheck(iss, 'anchor_no_limitation'), '★ 빈 종속항 검출');
});

test('앵커 ★ 음성 — 정상 부가 한정 종속항 미검출', () => {
  const iss = vClaims('【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 제1항에 있어서, 프로세서를 더 포함하는 시스템.');
  assert.ok(!hasCheck(iss, 'anchor_no_limitation'), '★ 정상 부가 종속항 미검출');
});

// ─────────── 교차검증: Item2 CHK-5·Item3 게이트 무영향 ───────────

test('교차 ★ MEDIUM(젭슨)만 있는 청구항 — Item3 게이트 CRITICAL/HIGH 0(무영향)', () => {
  call('outputs={step_06:"【청구항 1】 검색 시스템에 있어서, 통신부를 포함하는 시스템."}');
  const g = JSON.parse(call('JSON.stringify((function(){var s=_claimGateStatus("step_08");return {critical:s.critical,high:s.high};})())'));
  assert.deepEqual(g, { critical: 0, high: 0 }, '★ 젭슨 MEDIUM은 게이트에 영향 없음');
});

test('교차 ★ CHK-5(다중인용 "및")와 공존·비충돌', () => {
  const iss = vClaims('【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 B를 포함하는 시스템.\n【청구항 3】 제1항 및 제2항에 있어서, C를 더 포함하는 시스템.');
  assert.ok(iss.some(i => /다중인용.*및|및.*택일/.test(i.message)), '★ CHK-5 여전히 작동(젭슨/앵커 추가와 무충돌)');
});

// ─────────── 회귀 ───────────

test('회귀 ★ validateClaims 기존 동작 불변 — 독립항 부재 CRITICAL·정상 무결', () => {
  assert.ok(critCount(vClaims('【청구항 1】 제1항에 있어서, A를 포함하는 시스템.')) > 0, '★ 독립항 없음 CRITICAL 유지');
  assert.deepEqual(vClaims('【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 청구항 1에 있어서, B를 더 포함하는 시스템.'), [], '★ 정상 무결 유지');
});
