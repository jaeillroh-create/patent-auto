/**
 * review-engine/__tests__/patent-concept-desc-quality.test.js
 *
 * ★ ① 명세서 본문 "청구항 N" 언급 금지(A1) + 가드 갭(A2) + ② 예시도=장치 구성에 의한 동작·구현(B1).
 *   A1: step_08 생성 + applyReview edit-gen 프롬프트에 "본문 청구항 번호(청구항 N/제N항) 직접 언급 금지 → 구성요소(참조번호)로 기술".
 *   A2: applyEditInstructions 가드(5269)에 제\s*\d+\s*항 추가 → "제3항" 형태 편집도 드롭.
 *   B1: step_08 예시도 블록에 "예시도 요소(31~99)가 장치 구성(100~)에 의해 어떻게 동작·구현되는지(SW→HW)·실질 시나리오" 지시.
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

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false } });
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
const step08 = () => call("_buildPromptCore('step_08','원본 발명 내용','검색 시스템','')");
const applyEdits = (orig, edits) => call('applyEditInstructions(' + JSON.stringify(orig) + ',' + JSON.stringify(edits) + ')');

beforeEach(() => {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:[{},{},{}]}; outputTimestamps={}; requiredFigures=[]; detailLevel='standard';
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 4는 검색 화면을 나타내는 예시도이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]}];
    outputs={step_06:'【청구항 1】 통신부(110); 프로세서(120)', step_07:'[장치도면설계] 통신부(110), 프로세서(120)', step_07c:'[도 4] UI 화면 예시도\\n참조번호: 검색창(31), 결과목록(32)\\n도 4는 검색 화면을 나타내는 예시도이다.'};
  `);
});

// ─────────── A1: 청구항 번호 본문 언급 금지 ───────────

test('A1 ★ step_08 생성 프롬프트 — 본문 청구항 번호(청구항 N/제N항) 직접 언급 금지 + 구성요소로 기술', () => {
  const p = step08();
  assert.match(p, /청구항 번호를 직접 언급하지 마라/, '★ 청구항 번호 언급 금지');
  assert.match(p, /"청구항 N", "제N항"/, '★ 청구항 N·제N항 둘 다 명시');
  assert.match(p, /구성요소\(참조번호\) 형태[^]*?통신부\(110\)/, '★ 구성요소(참조번호)로 기술 안내');
});

test('A1 소스 ★ step_08 + applyReview edit-gen 둘 다 청구항-번호 본문 금지(일관)', () => {
  // step_08 생성
  assert.match(PATENT_SRC, /발명의 설명 본문에 "청구항 N", "제N항"[^]*?청구항 번호를 직접 언급하지 마라/, '★ step_08 금지');
  // applyReview edit-gen
  assert.match(PATENT_SRC, /CONTENT에 "청구항 N"·"제N항"[^]*?청구항 번호 직접 언급 금지/, '★ applyReview CONTENT 금지');
});

// ─────────── A2: 가드 갭(제N항) 차단 ───────────

test('A2 ★ applyEditInstructions 가드 — "제3항" CONTENT 편집 드롭(본문 누수 차단)', () => {
  const orig = '도 1을 참조하면, 통신부(110)가 데이터를 수신한다.';
  const out = applyEdits(orig, [{ anchor: '통신부(110)가 데이터를 수신한다', action: 'ADD_AFTER', content: '제3항에 관련하여, 상기 통신부(110)는 무선으로 동작한다.', reason: 'x' }]);
  assert.ok(out.indexOf('제3항') < 0, '★ "제3항" 편집 드롭(미적용)');
});

test('A2 ★ "청구항 5" CONTENT 편집도 드롭(기존 가드 유지)', () => {
  const orig = '도 1을 참조하면, 통신부(110)가 데이터를 수신한다.';
  const out = applyEdits(orig, [{ anchor: '통신부(110)가 데이터를 수신한다', action: 'ADD_AFTER', content: '청구항 5에 기재된 프로세서(120)는 분석한다.', reason: 'x' }]);
  assert.ok(out.indexOf('청구항 5') < 0, '★ "청구항 5" 편집 드롭');
});

test('A2 ★ 청구항 번호 없는 정상 편집은 적용(과도 차단 아님)', () => {
  const orig = '도 1을 참조하면, 통신부(110)가 데이터를 수신한다.';
  const out = applyEdits(orig, [{ anchor: '통신부(110)가 데이터를 수신한다', action: 'ADD_AFTER', content: '상기 통신부(110)는 무선 통신 모듈을 포함하여 동작한다.', reason: 'x' }]);
  assert.match(out, /무선 통신 모듈을 포함하여 동작한다/, '★ 정상 편집 적용');
});

test('A2 소스 ★ 가드 정규식에 제\\s*\\d+\\s*항 추가', () => {
  assert.match(PATENT_SRC, /if\(\/【청구항\|청구항\\s\*\\d\+\|제\\s\*\\d\+\\s\*항\|【발명/, '★ 가드에 제N항 패턴');
});

// ─────────── B1: 예시도 장치 구성에 의한 동작·구현 ───────────

test('B1(retire) ★ 예시도 동작·구현 지시 — step_08 에서 제거, step_08c 로 이전(SW→HW·시나리오)', () => {
  const p = step08();
  assert.ok(p.indexOf('어느 구성(100~') < 0, '★ step_08(장치)에 예시도 동작·구현 지시 없음(device-only)');
  // 동작·구현(SW→HW)·시나리오 지시는 step_08c 에 존재(소스)
  assert.match(PATENT_SRC, /case 'step_08c':\{[\s\S]*?어느 구성\(100~[\s\S]*?어떻게 동작·구현되는지/, '★ step_08c 동작·구현 지시');
  assert.match(PATENT_SRC, /case 'step_08c':\{[\s\S]*?소프트웨어적 구성이 하드웨어\(장치 구성\)에 의해 구체적으로 동작·구현됨/, '★ step_08c SW→HW(§42)');
  assert.match(PATENT_SRC, /case 'step_08c':\{[\s\S]*?실질적·예시적 시나리오/, '★ step_08c 실질 시나리오');
});

test('B1 ★ 예시도 없으면 동작·구현 지시도 없음(graceful)', () => {
  setCtx(`conceptDiagramTypes=[]; outputs={step_06:'청구항', step_07:'[장치도면설계] 통신부(110)'};`);
  const p = step08();
  assert.ok(p.indexOf('어느 구성(100~') < 0, '★ 예시도 없으면 예시도 동작·구현 지시 없음');
});

test('B1 소스 ★ 예시도 블록 동작·구현·시나리오 지시', () => {
  assert.match(PATENT_SRC, /예시도의 각 요소\(예시도 부호[\s\S]*?어느 구성\(100~[\s\S]*?동작·구현되는지/, '★ 소스 동작·구현 지시(도 번호 기반 부호)');
  assert.match(PATENT_SRC, /실질적·예시적 시나리오\(동작 흐름\)/, '★ 소스 실질 시나리오');
});

// ─────────── 회귀 ───────────

test('회귀 ★ step_08 device-only(예시도 블록 은퇴) + 청구항 금지·장치 프레이밍 유지', () => {
  const p = step08();
  assert.ok(p.indexOf('예시도(도 N)도 장치 도면과 ★동일한 수준으로★') < 0, '★ step_08 예시도 강제구 제거(은퇴)');
  assert.ok(p.indexOf('[예시도 설계 — 참조번호 31~99') < 0, '★ step_08 예시도 설계 주입 제거(은퇴)');
  assert.match(p, /청구항 번호를 직접 언급하지 마라/, '#214 청구항 금지 유지');
  assert.match(p, /이것은 "장치" 상세설명이다/, '장치 프레이밍 유지');
});
