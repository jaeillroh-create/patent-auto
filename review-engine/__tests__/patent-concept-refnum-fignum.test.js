/**
 * review-engine/__tests__/patent-concept-refnum-fignum.test.js
 *
 * ★ 예시도 식별번호 ↔ 도면번호 연동 — 도 N → N0번대(5x: N*10+i) 기본, 요소>9·도10~ 는 5xx(N*100+i).
 *   진단(DIAG-concept-refnum-organic): 식별번호 31~99 전역(도 번호 무관). 제목은 _conceptSvgApplyTitle SoT 추종하나 식별번호 미연동.
 *   T1: 생성 직후 _syncConceptRefNums() — refMap·svgContent·refNums·step_07c 를 figN 기반으로 (재)배정(생성 프롬프트·파서 무변경, 사후 동기).
 *   T2: ③ override(_afterConceptFigOverrideChange)에서 재호출 → 새 도 번호 추종(멱등). _conceptSvgApplyRefNums 가 SVG (old)→(new) 치환.
 *   T3: 5소비처 정합 — SVG·refMap·step_07c·step_08c(_cList)·step_18(_conceptRefPairs) 모두 figN 기반.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const App = { sb: { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } }, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setCtx = (s) => vm.runInContext(s, sandbox);

// 장치 4도(도1~4) → 예시도는 도 5부터. refMap 은 LLM 산출분(31,32) 시뮬레이션.
function ctx(devFigs = 4, elems = 2) {
  const rm = Array.from({ length: elems }, (_, j) => `{signNumber:'${31 + j}',label:'요소${j + 1}'}`).join(',');
  const svgTexts = Array.from({ length: elems }, (_, j) => `<text>(${31 + j}) 요소${j + 1}</text>`).join('');
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:Array(${devFigs}).fill({})}; outputTimestamps={}; requiredFigures=[];
    conceptDiagramTypes=[{type:'ui_screen', svgContent:'<svg>${svgTexts}</svg>', refMap:[${rm}], refNums:[${Array.from({length:elems},(_,j)=>31+j).join(',')}], figNumOverride:0}];
    outputs={step_06:'【청구항 1】 통신부(110)'};
  `);
}
beforeEach(() => { ctx(); });

// ─────────── T1: figN 기반 번호 배정 ───────────

test('T1 ★ _conceptRefNumFor — 5x 기본 / 요소>9·도10~ 는 5xx', () => {
  assert.equal(call('_conceptRefNumFor(5,0,2)'), '51', '도5 1번째 → 51(5x)');
  assert.equal(call('_conceptRefNumFor(5,1,2)'), '52', '도5 2번째 → 52');
  assert.equal(call('_conceptRefNumFor(6,0,2)'), '61', '도6 1번째 → 61');
  assert.equal(call('_conceptRefNumFor(5,0,10)'), '501', '★ 요소 10개 → 5xx(501)');
  assert.equal(call('_conceptRefNumFor(10,0,2)'), '1001', '★ 2자리 도번호(도10) → 5xx(1001, 장치 100~ 회피)');
});

test('T1 ★ _syncConceptRefNums — 도 5 예시도 refMap·SVG 가 51,52 로(31,32 아님)', () => {
  call('_syncConceptRefNums()');
  const rm = JSON.parse(call('JSON.stringify(conceptDiagramTypes[0].refMap)'));
  assert.deepEqual(rm.map(r => r.signNumber), ['51', '52'], '★ refMap 51,52 (도5→5x)');
  assert.match(call('conceptDiagramTypes[0].svgContent'), /\(51\)[\s\S]*\(52\)/, '★ SVG (51)(52)');
  assert.ok(call('conceptDiagramTypes[0].svgContent').indexOf('(31)') < 0, '★ 옛 (31) 제거');
  assert.deepEqual(JSON.parse(call('JSON.stringify(conceptDiagramTypes[0].refNums)')), [51, 52], '★ refNums 동기');
});

test('T1 ★ 장치 100~ 충돌 없음 — 5x(51,52)는 100 미만', () => {
  call('_syncConceptRefNums()');
  const nums = JSON.parse(call('JSON.stringify(conceptDiagramTypes[0].refNums)'));
  assert.ok(nums.every(n => n < 100), '★ 5x 식별번호 < 100 (장치 100~ 와 구분)');
});

test('T1 ★ 요소>9 → 5xx (도5 → 501~)', () => {
  ctx(4, 11);   // 도 5, 요소 11개
  call('_syncConceptRefNums()');
  const rm = JSON.parse(call('JSON.stringify(conceptDiagramTypes[0].refMap)'));
  assert.equal(rm[0].signNumber, '501', '★ 요소 11개 → 5xx(501)');
  assert.equal(rm[10].signNumber, '511', '★ 11번째 → 511');
});

// ─────────── T2: ③ override 추종 + 멱등 ───────────

test('T2 ★ 도 번호 변경(③) 추종 — 도5(51,52) → 장치 5도면이면 도6(61,62)', () => {
  call('_syncConceptRefNums()');   // 도5 → 51,52
  assert.deepEqual(JSON.parse(call('JSON.stringify(conceptDiagramTypes[0].refMap.map(r=>r.signNumber))')), ['51', '52']);
  setCtx(`diagramData={step_07:Array(5).fill({})};`);   // 장치 5도면 → 예시도 도 6
  call('_syncConceptRefNums()');
  assert.deepEqual(JSON.parse(call('JSON.stringify(conceptDiagramTypes[0].refMap.map(r=>r.signNumber))')), ['61', '62'], '★ 도6 → 61,62 추종');
  assert.match(call('conceptDiagramTypes[0].svgContent'), /\(61\)[\s\S]*\(62\)/, '★ SVG 도 추종 (61)(62)');
  assert.ok(call('conceptDiagramTypes[0].svgContent').indexOf('(51)') < 0, '★ 옛 (51) 제거');
});

test('T2 ★ 멱등 — 같은 도 번호로 재호출 시 변화 없음', () => {
  call('_syncConceptRefNums()');
  const a = call('conceptDiagramTypes[0].svgContent');
  const changed = call('_syncConceptRefNums()');
  assert.equal(changed, false, '★ 2회차 변화 없음(false)');
  assert.equal(call('conceptDiagramTypes[0].svgContent'), a, '★ SVG 불변(멱등)');
});

test('T2 ★ _conceptSvgApplyRefNums — (old)→(new) 단일패스(사이클 안전)', () => {
  // 시프트(52→51, 53→52): 콜백이 원본 매치 기준 → 사이클 없음
  const r = call(`_conceptSvgApplyRefNums('<svg>(52)(53)</svg>', {'52':'51','53':'52'})`);
  assert.equal(r, '<svg>(51)(52)</svg>', '★ (52)→(51),(53)→(52) 정확');
});

// ─────────── T3: 5소비처 정합 ───────────

test('T3 ★ step_08c(_cList)·step_07c·step_18(_conceptRefPairs) 모두 figN 기반', () => {
  call('_syncConceptRefNums()');
  // step_07c 공유 텍스트
  assert.match(call('outputs.step_07c'), /요소1\(51\)/, '★ step_07c 51');
  // step_18 소비 경로(_conceptRefPairs)
  const pairs = JSON.parse(call('JSON.stringify(_conceptRefPairs(conceptDiagramTypes[0]))'));
  assert.equal(pairs[0].num, '51', '★ _conceptRefPairs(step_18 부호) 51');
  // step_08c 프롬프트 _cList
  const p = call("_buildPromptCore('step_08c','원본','검색 시스템','')");
  assert.match(p, /요소1\(51\)/, '★ step_08c _cList 51');
  assert.ok(p.indexOf('(31)') < 0, '★ step_08c 에 옛 31 없음');
});

// ─────────── 소스 정합 / 회귀 ───────────

test('소스 ★ 생성·③ override 에 _syncConceptRefNums 배선 + 제목 SoT 유지', () => {
  // 생성 2경로(cascade·primary) + ③ override 후처리
  assert.equal((PATENT_SRC.match(/_syncConceptRefNums\(\);/g) || []).length >= 3, true, '★ 호출부 ≥3(cascade·primary·override)');
  assert.match(PATENT_SRC, /_afterConceptFigOverrideChange\(\)\{[\s\S]*?_syncConceptRefNums\(\);/, '★ ③ override 후처리에 재번호');
  assert.match(PATENT_SRC, /function _conceptSvgApplyTitle\(svgStr, figNum\)\{/, '★ 제목 SoT(_conceptSvgApplyTitle) 유지');
});

test('회귀 ★ 생성 프롬프트·파서는 31~99 유지(사후 동기 방식 — 파서 미변경)', () => {
  // 파서는 31~99 캡처(LLM 산출), sync 가 사후 figN 기반으로 재번호
  assert.match(PATENT_SRC, /if\(n>=31&&n<=99&&!seen\.has\(n\)\)/, '★ 파서 31~99 필터 유지(생성 캡처용)');
  assert.match(PATENT_SRC, /참조번호 31~99/, '★ SVG 생성 프롬프트 31~99 유지(사후 sync)');
});

test('회귀 ★ ?v= patent.js 20260661', () => {
  assert.match(HTML_SRC, /patent\/patent\.js\?v=20260661/, '★ ?v= 갱신');
});
