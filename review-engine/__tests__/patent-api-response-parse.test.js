/**
 * review-engine/__tests__/patent-api-response-parse.test.js
 *
 * ★ 발명 범위 추출 크래시 수정 — "발명 범위 추출 실패: Cannot read properties of undefined (reading 'match')".
 *   근본원인: parseAPIResponse(claude) 가 d.content[0].text 를 맹목적으로 읽어, 선두 블록이
 *   text 블록이 아니면(예: thinking 블록) text=undefined 를 반환 → _parseJSONSafe(undefined).match 크래시.
 *   수정 A(근본): content 배열에서 텍스트 블록만 수집(join). 비-텍스트/빈 content 는 '' 로 graceful.
 *   수정 B(방어): _parseJSONSafe 가 비문자열 입력을 null 로 가드(크래시 대신 "JSON 파싱 불가").
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const COMMON_SRC = readFileSync(path.join(REPO, 'shared/common.js'), 'utf8');
const PATENT_SRC = readPatentBundle(REPO);

// ─────────── (A) parseAPIResponse — shared/common.js ───────────
let App;
before(() => {
  const authStub = { onAuthStateChange() {}, getSession: async () => ({ data: { session: null } }) };
  const sbStub = { auth: authStub, from: () => ({ select: () => ({}) }) };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error, AbortController,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    supabase: { createClient: () => sbStub },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, classList: { add() {}, remove() {} } }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    fetch: async () => ({ status: 200, json: async () => ({}) }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(COMMON_SRC, sandbox, { filename: 'common.js' });
  App = sandbox.window.App;
});

const parse = (d) => App.parseAPIResponse('claude', d);

test('★ 크래시 재현 — thinking 블록 선두 + text 블록 → text 정상 추출(undefined 아님)', () => {
  const d = { content: [{ type: 'thinking', thinking: '음...' }, { type: 'text', text: '{"core_components":[]}' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 4 } };
  const r = parse(d);
  assert.equal(r.text, '{"core_components":[]}', '★ 텍스트 블록에서 추출');
  assert.equal(typeof r.text, 'string', '★ string(더 이상 undefined 아님 — 크래시 차단)');
  assert.equal(r.it, 3); assert.equal(r.ot, 4);
});

test('★ 회귀 — 단일 텍스트 블록{type,text} 정상 추출', () => {
  assert.equal(parse({ content: [{ type: 'text', text: 'HELLO' }], stop_reason: 'end_turn' }).text, 'HELLO');
});

test('★ 회귀 — type 필드 없는 {text}(테스트 목 셰이프)도 수집', () => {
  assert.equal(parse({ content: [{ text: 'MOCK' }], usage: {} }).text, 'MOCK', '★ type 없어도 text 있으면 수집(기존 목 호환)');
});

test('★ 빈 content[] → text="" (throw 없음)', () => {
  assert.equal(parse({ content: [], stop_reason: 'end_turn' }).text, '');
});

test('★ thinking 블록만(텍스트 블록 없음) → text="" (throw 없음)', () => {
  assert.equal(parse({ content: [{ type: 'thinking', thinking: 'x' }], stop_reason: 'end_turn' }).text, '');
});

test('★ content 필드 누락 → text="" (throw 없음)', () => {
  assert.equal(parse({ stop_reason: 'end_turn' }).text, '');
});

test('★ 다중 텍스트 블록 → 이어붙임(join)', () => {
  assert.equal(parse({ content: [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }] }).text, 'AB');
});

test('★ d.error → throw(API 에러 메시지 전파) 유지', () => {
  assert.throws(() => parse({ error: { message: 'model not found' } }), /model not found/);
});

// ─────────── (B) _parseJSONSafe 비문자열 가드 — patent 번들 ───────────
let pbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const AppStub = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  pbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App: AppStub, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '',
  };
  pbox.window = pbox; pbox.globalThis = pbox; pbox.self = pbox;
  pbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(pbox);
  vm.runInContext(PATENT_SRC, pbox, { filename: 'patent.js' });
});

const psafe = (expr) => vm.runInContext('JSON.stringify(_parseJSONSafe(' + expr + '))', pbox, { filename: 'p.js' });

test('★ _parseJSONSafe(undefined) → null (더 이상 .match 크래시 없음)', () => {
  assert.equal(psafe('undefined'), 'null', '★ undefined 가드');
});

test('★ _parseJSONSafe(null) → null', () => {
  assert.equal(psafe('null'), 'null', '★ null 가드');
});

test('★ _parseJSONSafe 회귀 — 정상 JSON 문자열 파싱', () => {
  assert.equal(psafe('\'{"a":1}\''), '{"a":1}', '★ 정상 파싱 불변');
});

test('★ _parseJSONSafe 회귀 — 코드펜스 감싼 JSON 파싱', () => {
  assert.equal(psafe('\'```json\\n{"b":2}\\n```\''), '{"b":2}', '★ 펜스 파싱 불변');
});

// ─────────── 캐시버스트 토큰 동기화 ───────────

test('회귀 ★ ?v= 릴리스 토큰(20260720-api-parse) + common.js(20260720a) 동기화', () => {
  const html = readFileSync(path.join(REPO, 'index.html'), 'utf8');
  assert.match(html, /patent\/patent\.js\?v=20260720-api-parse/, '★ patent.js 릴리스 토큰 갱신');
  assert.match(html, /shared\/common\.js\?v=20260720a/, '★ common.js 토큰 갱신(수정 반영)');
  assert.match(PATENT_SRC.length ? readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8') : '', /version = '20260720-api-parse'/, '★ patent 로더 version 갱신');
});
