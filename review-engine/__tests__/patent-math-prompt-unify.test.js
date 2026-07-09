/**
 * review-engine/__tests__/patent-math-prompt-unify.test.js
 *
 * ★ 수학식 생성 프롬프트 단일화 — 곱셈 기호(×/·) 갈림 근본 해결.
 *   이전: 같은 수식 프롬프트가 3곳(case step_09 / applyReview 보존실패 재생성 / applyReview 신규생성)에 흩어져
 *         곱셈 기호 규칙이 갈렸다(step_09 는 "× 또는 ·" 허용, 나머지 2곳은 기호 규칙 누락).
 *   수정: buildMathPrompt() 단일 소스로 통일. 곱셈은 "×" 하나로 명시. 내적(·)·소수점(.)은 구분 보존.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);
const OPINION_SRC = readModuleBundle(REPO, 'opinion');

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), currentUser: { id: 'u1', email: 'v@x.com' } };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

// buildMathPrompt 는 top-level function — runInContext 로 호출(전역-lexical 공유).
const callBuild = (count, desc, extra) => vm.runInContext(
  'buildMathPrompt(' + JSON.stringify(count) + ',' + JSON.stringify(desc) + ',' + JSON.stringify(extra || '') + ')',
  sandbox, { filename: 'call.js' });

// ── 단일 소스(분산 제거) ──

test('★ 단일 소스 — buildMathPrompt 1개 정의 + 출력 스켈레톤(---MATH_BLOCK_1---) builder 1곳에만', () => {
  assert.equal((PATENT_SRC.match(/function buildMathPrompt\(/g) || []).length, 1, 'buildMathPrompt 정의 1개');
  assert.equal((PATENT_SRC.match(/---MATH_BLOCK_1---/g) || []).length, 1, '★ 수식 출력 스켈레톤이 단일 소스에만(분산 제거)');
});

test('★ 곱셈 규칙 단일화 — "곱셈은 × 로 통일" 1곳, 옛 "× 또는 ·" 혼용 규칙 제거', () => {
  assert.equal((PATENT_SRC.match(/곱셈은 × 로 통일/g) || []).length, 1, '단일 곱셈 규칙 1곳');
  assert.ok(!/U\+00D7\) 또는 "·"/.test(PATENT_SRC), '★ 옛 "× 또는 ·" 허용 규칙 제거');
  assert.ok(!/두 글자 이상이면 "·" 권장/.test(PATENT_SRC), '★ 옛 "· 권장" 혼용 유도 제거');
});

test('★ 3개 생성 사이트 모두 buildMathPrompt 사용(분산 → 단일)', () => {
  assert.match(PATENT_SRC, /case 'step_09':return buildMathPrompt\('5개 내외'/, 'step_09 작성 경로');
  assert.match(PATENT_SRC, /buildMathPrompt\(`\$\{existingMath\.length-successCount\}개`, finalDesc\)/, 'applyReview 보존실패 재생성');
  assert.match(PATENT_SRC, /buildMathPrompt\('5개 내외', finalDesc\)/, 'applyReview 신규생성');
  // 옛 인라인(곱셈 규칙 없던) 프롬프트 제거 — finalDesc 직박이 ---MATH_BLOCK 인라인 callClaude 없음
  assert.ok(!/callClaude\(`상세설명의 핵심 알고리즘에 수학식 \$\{existingMath/.test(PATENT_SRC), '★ 인라인 재생성 프롬프트 제거');
  assert.ok(!/callClaude\(`상세설명의 핵심 알고리즘에 수학식 5개 내외\.\\n규칙/.test(PATENT_SRC), '★ 인라인 신규생성 프롬프트 제거');
});

test('★ _cascadeRunMath·runMathInsertion 은 buildPrompt(step_09)→builder 경유(간접 통일)', () => {
  assert.match(PATENT_SRC, /_cascadeRunMath[\s\S]{0,120}buildPrompt\('step_09'\)/, 'cascade → step_09(builder)');
  assert.match(PATENT_SRC, /runMathInsertion[\s\S]{0,400}buildPrompt\('step_09'\)/, 'runMathInsertion → step_09(builder)');
});

// ── 곱셈 × 명시 + 내적·소수점 구분(behavioral) ──

test('★ 곱셈은 × 로 명시 (×/ASCII x/*/· 모두 곱셈 금지)', () => {
  const out = callBuild('5개 내외', '상세설명 본문 ABC', '');
  assert.match(out, /곱셈[^]*?반드시 "×" \(U\+00D7\) 하나로 통일/, '★ 곱셈 = × 하나로 통일');
  assert.match(out, /가운데점 "·"를 곱셈 기호로 사용/, '★ · 를 곱셈으로 사용 금지');
  assert.match(out, /ASCII 알파벳 "x" 또는 "X"를 곱셈 기호로 사용/, 'ASCII x 곱셈 금지');
  assert.match(out, /ASCII 별표 "\*"를 곱셈 기호로 사용/, 'ASCII * 곱셈 금지');
});

test('★ 내적·소수점 구분 보존 — · 는 내적, . 는 소수점', () => {
  const out = callBuild('5개 내외', 'D', '');
  assert.match(out, /가운데점 "·" \(U\+00B7\)은 ★벡터 내적\(dot product\)에만★ 사용/, '★ · 는 내적에만(보존)');
  assert.match(out, /소수점은 마침표 "\." 를 사용하라/, '★ 소수점은 . (구분)');
});

test('★ 개수 파라미터화 + desc 주입', () => {
  assert.match(callBuild('3개', 'D', ''), /수학식 3개\./, 'countText 반영(3개)');
  assert.match(callBuild('5개 내외', 'D', ''), /수학식 5개 내외\./, 'countText 반영(5개 내외)');
  assert.ok(callBuild('5개 내외', '상세설명XYZ', '').indexOf('상세설명XYZ') >= 0, 'desc 주입');
  assert.ok(callBuild('5개 내외', 'D', '\n[특허성]보완').indexOf('[특허성]보완') >= 0, 'extraTail 주입');
});

test('opinion 회귀 0 — 수식 통일은 patent 전용(opinion 미접촉)', () => {
  assert.ok(!/buildMathPrompt/.test(OPINION_SRC), 'opinion 에 수식 빌더 없음(patent 전용 변경)');
});
