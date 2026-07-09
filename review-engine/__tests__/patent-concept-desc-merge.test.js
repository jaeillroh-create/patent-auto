/**
 * review-engine/__tests__/patent-concept-desc-merge.test.js
 *
 * ★ 예시도 상세설명 step_08 합본 — "생성 분리 + 저장 합본"(후속 단계 자동 공유).
 *   진단(DIAG-concept-desc-merge-into-step08): step_08c 별도 출력 → 후속(수학식·특허성·대안·검토반영)이 device-only만 읽어 누락.
 *   T1: concept 생성 직후 step_08 본문에 합본(device-only 스냅샷 step08_device 에서 재구성 → 멱등). 생성은 분리 유지(LLM 재호출 0).
 *   T2: concept-gen 입력 [장치 상세설명] = device-only 스냅샷(자기참조 방지).
 *   T3: 중복 제거 — buildImplementationBody 합본 시 concept 슬롯 생략 + resultStep08c display:none.
 *   T4: getLatestDescription(합본)이 예시도 포함 → 수학식·검토 등 자동 공유.
 *   T5: sanitizer(device) 가 합본 step_08 의 예시도(도 5·부호 31) 보존(#213 재발 X).
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
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const App = {
    sb: { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } },
    callClaude: async (prompt) => {
      const isConcept = /예시도\(개념도\)" 전용 상세설명/.test(String(prompt));
      const text = isConcept
        ? '도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.'
        : '도 1을 참조하면, 통신부(110)가 데이터를 수신한다.';
      return { text, stopReason: 'end_turn', it: 0, ot: 0 };
    },
    escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {},
  };
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
const out = (k) => call('outputs.' + k);

function baseCtx() {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:[{},{},{},{}]}; outputTimestamps={}; requiredFigures=[]; detailLevel='standard';
    includeMethodClaims=true; inventionScope=null;
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 5는 화면이다.',refMap:[{signNumber:'31',label:'검색창'}]}];
    outputs={step_06:'【청구항 1】 통신부(110); 프로세서(120)', step_07:'[장치도면설계] 통신부(110), 프로세서(120)', step_07c:'[도 5] UI 화면 예시도\\n참조번호: 검색창(31)\\n도 5는 화면이다.'};
  `);
}
beforeEach(() => { baseCtx(); });

// ─────────── T1: 합본 저장 (생성 분리 + step_08 합본) ───────────

test('T1 ★ runImplementationDesc — step_08 = 장치+예시도(합본) + step08_device 스냅샷', async () => {
  await call('runImplementationDesc()');
  assert.match(out('step_08'), /통신부\(110\)가 데이터를 수신한다/, '★ 장치 본문');
  assert.match(out('step_08'), /검색창\(31\)은 프로세서\(120\)/, '★ 예시도 합본(step_08 본문에 포함)');
  assert.match(call('outputs.step08_device'), /통신부\(110\)/, '★ device-only 스냅샷');
  assert.ok(call('outputs.step08_device').indexOf('검색창(31)') < 0, '★ 스냅샷은 device-only(예시도 미포함)');
  assert.equal(out('step_08c'), '도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.', '★ step_08c source 유지');
});

test('T1 ★ 멱등 — 보조 재생성(runConceptDescStep) 반복해도 step_08 예시도 1회(중복 0)', async () => {
  await call('runImplementationDesc()');         // step_08=장치+예시, step08_device=장치
  await call('runConceptDescStep()');             // 보조 재생성
  await call('runConceptDescStep()');             // 또 재생성
  assert.equal((out('step_08').match(/검색창\(31\)/g) || []).length, 1, '★ 예시도 정확히 1회(스냅샷서 재구성 — 중복 append 0)');
  assert.equal((out('step_08').match(/통신부\(110\)가 데이터를 수신한다/g) || []).length, 1, '★ 장치 1회');
});

test('T1 ★ _mergeConceptIntoStep08 직접 — 멱등(반복 호출 변화 없음)', () => {
  setCtx(`outputs={step08_device:'도 1을 참조하면, 통신부(110)가 동작한다.', step_08c:'도 5를 참조하면, 검색창(31)이 표시된다.'}; outputTimestamps={};`);
  call('_mergeConceptIntoStep08()');
  const a = out('step_08');
  call('_mergeConceptIntoStep08()');
  assert.equal(out('step_08'), a, '★ 2회차 변화 없음(멱등)');
  assert.match(a, /통신부\(110\)가 동작한다\.\n\n도 5를 참조하면, 검색창\(31\)/, '★ 장치 → 예시도 순 합본');
});

// ─────────── T2: concept-gen 입력 device-only ───────────

test('T2 ★ step_08c 프롬프트 [장치 상세설명] = device-only 스냅샷(자기참조 방지)', () => {
  // step_08 은 이미 합본(장치+예시), 스냅샷은 device-only — 프롬프트는 스냅샷을 써야 함
  setCtx(`outputs.step08_device='도 1 장치설명 DEVICEONLY'; outputs.step_08='도 1 장치설명 DEVICEONLY\\n\\n도 5 예시도 MERGEDCONCEPT'; outputTimestamps={step_08:200};`);
  const p = call("_buildPromptCore('step_08c','원본','검색 시스템','')");
  assert.match(p, /\[장치 상세설명[^\n]*\] 도 1 장치설명 DEVICEONLY/, '★ device-only 스냅샷 주입');
  assert.ok(p.indexOf('MERGEDCONCEPT') < 0, '★ 합본본(예시도 포함) 미주입(자기참조 방지)');
});

// ─────────── T3: 중복 제거 (조립·표시) ───────────

test('T3 ★ buildImplementationBody — 합본(예시도 step_08 내재) 시 중복 없음(예시도 1회)', () => {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={}; outputTimestamps={step_08:300}; conceptDiagramTypes=[]; requiredFigures=[];
    outputs={ step_06:'【청구항 1】 통신부(110)',
      step_08:'도 1을 참조하면, 통신부(110)가 동작한다.\\n\\n도 5를 참조하면, 검색창(31)이 표시된다.',
      step_08c:'도 5를 참조하면, 검색창(31)이 표시된다.',
      step_12:'도 7을 참조하면, S710 단계.' };
  `);
  const spec = call('buildSpecification()');
  assert.equal((spec.match(/검색창\(31\)이 표시된다/g) || []).length, 1, '★ 예시도 1회(step_08 내재분만, 중복 제거)');
  const iDev = spec.indexOf('통신부(110)가 동작한다'), iConc = spec.indexOf('검색창(31)이 표시된다'), iMeth = spec.indexOf('S710 단계');
  assert.ok(iDev >= 0 && iConc >= 0 && iMeth >= 0 && iDev < iConc && iConc < iMeth, '★ 장치 → 예시 → 방법 순');
});

test('T3 ★ buildImplementationBody — 미합본(구 사건: step_08 device-only)이면 예시도 보강', () => {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={}; outputTimestamps={step_08:300}; conceptDiagramTypes=[]; requiredFigures=[];
    outputs={ step_06:'【청구항 1】 통신부(110)',
      step_08:'도 1을 참조하면, 통신부(110)가 동작한다.',
      step_08c:'도 5를 참조하면, 검색창(31)이 표시된다.' };
  `);
  const spec = call('buildSpecification()');
  assert.equal((spec.match(/검색창\(31\)이 표시된다/g) || []).length, 1, '★ 미합본 구사건도 예시도 1회(누락 방지·중복 방지)');
});

test('T3 ★ resultStep08c display:none (합본본을 resultStep08 에 표시)', () => {
  assert.match(HTML_SRC, /id="resultStep08c" style="display:none"/, '★ 좌/우 별도 예시도 표시 숨김');
});

// ─────────── T4: 후속 자동 공유 ───────────

test('T4 ★ getLatestDescription(합본) 예시도 포함 → 수학식 base 자동 공유', () => {
  setCtx(`outputs={step08_device:'도 1 장치.', step_08:'도 1 장치.\\n\\n도 5를 참조하면, 검색창(31)이 표시된다.', step_06:'【청구항 1】'}; outputTimestamps={step_08:400};`);
  assert.match(call('getLatestDescription()'), /검색창\(31\)/, '★ getLatestDescription 이 예시도 포함');
  const mathPrompt = call("_buildPromptCore('step_09','원본','검색 시스템','')");
  assert.match(mathPrompt, /검색창\(31\)/, '★ 수학식 base(getLatestDescription)에 예시도 포함(후속 자동 공유)');
});

// ─────────── T5: sanitizer 회귀 (합본 예시도 보존) ───────────

test('T5 ★ sanitizeDescFigureRefs(device)·sanitizeMethodFromDevice — 합본 예시도(도 5·부호 31) 보존', () => {
  const merged = '도 1을 참조하면, 통신부(110)가 동작한다.\n\n도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.';
  const a = call(`sanitizeDescFigureRefs(${JSON.stringify(merged)}, 'device')`);
  assert.match(a, /도 5를 참조하면/, '★ sanitizeDescFigureRefs: 예시도 도 5 보존(maxAllowed=devMax+concCount)');
  assert.match(a, /검색창\(31\)/, '★ 부호 31 보존');
  const b = call(`sanitizeMethodFromDevice(${JSON.stringify(merged)})`);
  assert.match(b, /도 5를 참조하면/, '★ sanitizeMethodFromDevice: 예시도 보존(conceptFigNums 제외)');
});

// ─────────── 회귀 ───────────

test('회귀 ★ 생성 분리 유지(코어 분리) + 장치 회귀 0', () => {
  // 생성은 여전히 분리(_longStepCore device / _conceptDescCore concept) — 합본은 텍스트 병합
  assert.match(PATENT_SRC, /async function _longStepCore\(sid\)\{/, '★ 장치 코어 분리 유지');
  assert.match(PATENT_SRC, /async function _conceptDescCore\(\)\{/, '★ 예시도 코어 분리 유지');
  assert.match(PATENT_SRC, /function _mergeConceptIntoStep08\(\)\{/, '★ 합본 함수(텍스트 병합)');
  // 합본은 LLM 재호출이 아니라 텍스트 병합(step08_device + step_08c)
  assert.match(PATENT_SRC, /outputs\.step_08=merged;/, '★ 텍스트 병합(LLM 재호출 아님)');
});

test('회귀 ★ step08_device 는 진행도/렌더 step 루프에서 제외(언더스코어 불일치)', () => {
  assert.equal('step08_device'.startsWith('step_'), false, '★ step08_device 는 step_ 루프 비대상(진행도 오집계 방지)');
});
