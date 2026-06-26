/**
 * review-engine/__tests__/patent-concept-reflect-retire.test.js
 *
 * ★ 끼워넣기 땜질 은퇴 — step_08c(분리, #215) 검증됨 → reflect(#210/A1) step_08 APPEND + B1(#214) step_08 예시도 블록 은퇴.
 *   B1: step_08 프롬프트 예시도 블록·[예시도 설계] 제거 → step_08 = 장치 전용(과부하 해소).
 *   B2: reflectConceptsToSpec 의 발명의 설명(step_08) APPEND 제거 — 부호의 설명(step_18) 보강만 유지(desc 항상 0).
 *   B3: 부호의 설명(step_18)에 예시도 부호(31~) 유지 — _refSources(step_07c·step_08c) + reflect 폴백.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');

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
const out = (k) => call('outputs.' + k);
const reflect = () => JSON.parse(call('JSON.stringify(reflectConceptsToSpec())'));
const step08 = () => call("_buildPromptCore('step_08','원본','검색 시스템','')");

function withConcepts() {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:[{},{},{},{}]}; outputTimestamps={}; requiredFigures=[]; detailLevel='standard';
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 5는 화면이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]}];
    outputs={step_06:'【청구항 1】 통신부(110)', step_07:'[장치도면설계] 통신부(110)', step_07c:'[도 5] UI 화면 예시도\\n참조번호: 검색창(31), 결과목록(32)\\n도 5는 화면이다.'};
  `);
}
beforeEach(() => { withConcepts(); });

// ─────────── B1: step_08 장치 전용 ───────────

test('B1 ★ step_08 프롬프트 device-only — 예시도 블록·[예시도 설계] 제거', () => {
  const p = step08();
  assert.ok(p.indexOf('★★★ 예시도/개념도 (참조번호 31~99)') < 0, '★ 예시도 블록 제거');
  assert.ok(p.indexOf('[예시도 설계') < 0, '★ [예시도 설계] 데이터 제거');
  assert.match(p, /예시도\(참조번호 31~99\)는 이 단계에서 다루지 않는다/, '★ 예시도는 별도 단계(step_08c) 명시');
});

test('B1 ★ 장치 설명 회귀 0 — 장치 프레이밍·구성요소(100~) 유지', () => {
  const p = step08();
  assert.match(p, /이것은 "장치" 상세설명이다/, '장치 프레이밍 유지');
  assert.match(p, /\[장치 도면 설계\]/, '장치 도면 입력 유지');
  assert.match(p, /구성요소\(참조번호 100~\)를 빠짐없이 설명하라/, '장치 구성요소(100~) 설명 유지');
});

test('B1 소스 ★ step_08 도면목록에서 예시도 번호 제외(device+사용자만)', () => {
  assert.ok(!/allFigNumsRaw=\[\.\.\.new Set\(\[\.\.\.actualFigNums,\.\.\.requiredFigures\.map\(f=>f\.num\),\.\.\._genConceptFigNums\]\)\]/.test(PATENT_SRC), '★ 도면목록 예시도 제외');
  assert.match(PATENT_SRC, /\[B1\] 장치 상세설명은 장치\+사용자 도면만/, '★ device-only 명문화');
});

// ─────────── B2: reflect 은퇴(step_18만) ───────────

test('B2 ★ reflect — 발명의 설명(step_08) APPEND 안 함(desc 0), 부호의 설명(step_18)만 보강', () => {
  setCtx(`outputs={step_08:'도 1을 참조하면, 통신부(110)가 동작한다.', step_18:'통신부 : 110'};`);
  const r = reflect();
  assert.equal(r.desc, 0, '★ desc 0(step_08 APPEND 은퇴)');
  assert.equal(out('step_08'), '도 1을 참조하면, 통신부(110)가 동작한다.', '★ step_08 불변(device-only)');
  assert.match(out('step_18'), /검색창 : 31/, '★ step_18 예시도 부호 보강');
  assert.match(out('step_18'), /결과목록 : 32/, '★ 부호 32');
});

test('B2 ★ step_18 없으면 — 완전 no-op(reflect 가 새 출력 안 만듦)', () => {
  setCtx(`outputs={step_08:'장치설명'};`);
  const r = reflect();
  assert.equal(r.desc, 0); assert.equal(r.ref, 0, '★ no-op');
  assert.equal(out('step_08'), '장치설명', '본문 불변');
});

test('B2 ★ 멱등 — reflect 반복해도 step_18 부호 중복 없음', () => {
  setCtx(`outputs={step_18:'통신부 : 110'};`);
  reflect(); const s18a = out('step_18');
  const r2 = reflect();
  assert.equal(r2.ref, 0, '★ 2회차 0');
  assert.equal(out('step_18'), s18a, '★ step_18 불변');
});

// ─────────── B3: 부호의 설명(step_18) 예시도 부호 경로 유지 ───────────

test('B3 ★ step_18 _refSources 에 step_07c·step_08c 포함(생성 경로로 부호 수집)', () => {
  assert.match(PATENT_SRC, /_refSources=\[outputs\.step_06,outputs\.step_08,outputs\.step_08c,[^\]]*outputs\.step_07c\]/, '★ step_07c·step_08c 둘 다 부호 수집 소스');
});

test('B3 ★ reflect 폴백 — 기존 step_18 에 예시도 부호 보강(생성-전-예시도 케이스)', () => {
  setCtx(`outputs={step_18:'통신부 : 110\\n프로세서 : 120'};`);
  reflect();
  assert.match(out('step_18'), /검색창 : 31/, '★ 예시도 부호 31 보강');
  assert.ok(out('step_18').indexOf('통신부 : 110') === 0, '★ 기존 부호 보존(맨 앞)');
});

// ─────────── 통합: 일원화(중복 없음) ───────────

test('통합 ★ 명세서 = step_08(장치) + step_08c(예시) — reflect 중복 없이 일원화', () => {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={}; outputTimestamps={}; requiredFigures=[];
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',refMap:[{signNumber:'31',label:'검색창'}]}];
    outputs={
      step_06:'【청구항 1】 통신부(110)',
      step_08:'도 1을 참조하면, 통신부(110)가 동작한다.',
      step_08c:'도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.',
      step_18:'통신부 : 110'
    };
  `);
  reflect();   // openProject/생성 시 호출되는 reflect — step_18 부호만
  const spec = call('buildSpecification()');
  // 예시도 설명은 step_08c 로만(중복 0)
  assert.equal((spec.match(/검색창\(31\)은 프로세서\(120\)에 의해 표시된다/g) || []).length, 1, '★ 예시도 설명 1회(step_08c, 중복 없음)');
  const iDev = spec.indexOf('통신부(110)가 동작한다'), iConc = spec.indexOf('검색창(31)은 프로세서(120)');
  assert.ok(iDev >= 0 && iConc >= 0 && iDev < iConc, '★ 장치 → 예시 순서');
  assert.match(spec, /검색창 : 31/, '★ 부호의 설명에 예시도 부호(reflect 보강)');
});

// ─────────── 회귀: step_08c 분리 유지 ───────────

test('회귀 ★ step_08c(예시도 상세설명) 분리·조립 유지', () => {
  assert.match(PATENT_SRC, /case 'step_08c':\{/, 'step_08c 프롬프트 유지');
  assert.match(PATENT_SRC, /async function runConceptDescStep\(\)\{/, 'step_08c 러너 유지');
  assert.match(PATENT_SRC, /buildImplementationBody\(\)/, '조립(장치→예시→방법) 유지');
});
