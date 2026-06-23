/**
 * review-engine/__tests__/vision-multimodal.test.js
 *
 * ★ T1 멀티모달(비전) 경로 — buildAPIRequest 이미지 content 확장 + callVision 헬퍼.
 *   이미지(base64 data URL) 있으면 프로바이더별 멀티모달 content, 없으면 기존 텍스트(회귀 0).
 *   ★ 텍스트 전용 호출 body 불변(claude/gpt content=문자열, gemini parts=[{text}]) — 기존 callClaude 무영향.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const COMMON_SRC = readFileSync(path.join(REPO, 'shared/common.js'), 'utf8');

let App, sandbox, captured;

before(() => {
  captured = {};
  const authStub = { onAuthStateChange() {}, getSession: async () => ({ data: { session: null } }) };
  const sbStub = { auth: authStub, from: () => ({ select: () => ({}) }) };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error, AbortController,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    supabase: { createClient: () => sbStub },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, classList: { add() {}, remove() {} } }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    // ★ fetch 캡처 — callVision 요청 body 검증용
    fetch: async (url, opts) => { captured.url = url; captured.headers = opts && opts.headers; captured.body = JSON.parse(opts.body); return { status: 200, json: async () => captured.fakeResp }; },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(COMMON_SRC, sandbox, { filename: 'common.js' });
  App = sandbox.window.App;
  // API 키 주입(ensureApiKey 통과용) — let 전역
  vm.runInContext("apiKeys={claude:'CK',gpt:'GK',gemini:'MK'};", sandbox);
});

const PNG = 'data:image/png;base64,IMG1';
const build = (prov, modelKey, images) => App.buildAPIRequest(prov, modelKey, 'SYS', 'PROMPT', 1000, images);

// ── 텍스트 전용 회귀 0 (이미지 없으면 기존 body 그대로) ──

test('★ 회귀 0 — claude 텍스트 전용 content=문자열(기존과 동일)', () => {
  const r = build('claude', 'opus');           // images 미전달
  assert.equal(r.body.messages[0].content, 'PROMPT', '★ content 는 문자열(배열 아님)');
  assert.equal(r.body.system, 'SYS', 'system 유지');
});
test('★ 회귀 0 — gpt 텍스트 전용 content=문자열', () => {
  const r = build('gpt', 'gpt4o');
  assert.equal(r.body.messages[0].content, 'SYS', 'system 메시지');
  assert.equal(r.body.messages[1].content, 'PROMPT', '★ user content 문자열');
});
test('★ 회귀 0 — gemini 텍스트 전용 parts=[{text}]', () => {
  const r = build('gemini', 'gemini_pro');
  assert.equal(r.body.contents[0].parts.length, 1, '★ parts 1개(텍스트만)');
  assert.equal(r.body.contents[0].parts[0].text, 'PROMPT', 'text 유지');
});

// ── 멀티모달(이미지 있을 때) — 프로바이더별 형식 ──

test('★ claude 멀티모달 — content[]에 text + image(base64 source)', () => {
  const r = build('claude', 'opus', [PNG]);
  const c = r.body.messages[0].content;
  assert.ok(Array.isArray(c), '★ content 배열');
  assert.deepEqual(c[0], { type: 'text', text: 'PROMPT' }, 'text 블록');
  assert.deepEqual(c[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'IMG1' } }, '★ image base64 source');
});
test('★ gpt 멀티모달 — content[]에 image_url(data URL)', () => {
  const r = build('gpt', 'gpt4o', [PNG]);
  const c = r.body.messages[1].content;
  assert.ok(Array.isArray(c), 'content 배열');
  assert.equal(c[0].type, 'text', 'text 블록');
  assert.deepEqual(c[1], { type: 'image_url', image_url: { url: 'data:image/png;base64,IMG1' } }, '★ image_url data URL');
});
test('★ gemini 멀티모달 — parts[]에 inlineData', () => {
  const r = build('gemini', 'gemini_pro', [PNG]);
  const p = r.body.contents[0].parts;
  assert.equal(p[0].text, 'PROMPT', 'text part');
  assert.deepEqual(p[1], { inlineData: { mimeType: 'image/png', data: 'IMG1' } }, '★ inlineData base64');
});

test('★ 잘못된 data URL 은 무시 → 텍스트 전용(회귀)', () => {
  const r = build('claude', 'opus', ['not-a-data-url', '']);
  assert.equal(r.body.messages[0].content, 'PROMPT', '★ 비-data URL 제외 → 문자열 content');
});

test('★ 다중 이미지 — 이미지 블록 N개', () => {
  const r = build('claude', 'opus', [PNG, 'data:image/jpeg;base64,IMG2']);
  const c = r.body.messages[0].content;
  assert.equal(c.length, 3, 'text + 이미지 2');
  assert.equal(c[2].source.media_type, 'image/jpeg', '두번째 이미지 media_type');
  assert.equal(c[2].source.data, 'IMG2', '두번째 이미지 data');
});

// ── callVision 동작 ──

test('★ callVision — 이미지가 요청 body 에 들어가고 텍스트 결과 반환', async () => {
  captured.fakeResp = { content: [{ text: '도면 분석 결과' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } };
  const out = await App.callVision('이 도면을 분석하라', [PNG]);
  assert.equal(out.text, '도면 분석 결과', '★ 비전 응답 텍스트 반환');
  // selectedProvider 기본 claude → 캡처된 body 에 image 블록
  const c = captured.body.messages[0].content;
  assert.ok(Array.isArray(c) && c.some((b) => b.type === 'image'), '★ 요청에 image content 포함');
  assert.equal(captured.url, 'https://api.anthropic.com/v1/messages', 'claude 엔드포인트');
});

test('★ callVision — 이미지 없으면 텍스트 전용(멀티모달 미적용)', async () => {
  captured.fakeResp = { content: [{ text: 'ok' }], stop_reason: 'end_turn', usage: {} };
  await App.callVision('텍스트만', []);
  assert.equal(captured.body.messages[0].content, '텍스트만', '★ 이미지 0 → content 문자열(회귀 0)');
});

test('★ App.callVision / buildAPIRequest(images) 노출', () => {
  assert.equal(typeof App.callVision, 'function', 'App.callVision 노출');
  assert.equal(App.buildAPIRequest.length >= 5, true, 'buildAPIRequest images 파라미터 수용');
  assert.match(COMMON_SRC, /showScreen, ensureApiKey, callClaude, callClaudeSonnet, callClaudeWithContinuation, callVision,/, 'App export 에 callVision');
});
