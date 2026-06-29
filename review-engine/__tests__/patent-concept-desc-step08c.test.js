/**
 * review-engine/__tests__/patent-concept-desc-step08c.test.js
 *
 * ★ 예시도 상세설명 분리(step_08c) — A1(전용 생성) + A2(조립) + A3(UI). 방법 상세설명(step_12) 분리 패턴 미러.
 *   원인: step_08 단일 호출 과부하(장치 메가룰 지배)로 예시도 떨굼 → 예시도 상세설명을 전용 단계(step_08c)로 분리해 구조 차단.
 *   A1: case 'step_08c' focused 프롬프트(예시도 + 장치 구성 동작·구현, 장치 메가룰 없음) + runConceptDescStep + outputs.step_08c.
 *   A2: buildSpecification 조립 — 장치(step_08)→예시(step_08c)→방법(step_12) 도 번호순. getLatestConceptDescription.
 *   A3: "예시도 상세설명 생성" 버튼.
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

let sandbox, claudeText;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: claudeText, stopReason: 'end_turn', it: 0, ot: 0 }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
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
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setCtx = (s) => vm.runInContext(s, sandbox);
const step08c = () => call("_buildPromptCore('step_08c','원본 발명 내용','검색 시스템','')");

function withConcepts() {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:[{},{},{},{}]}; outputTimestamps={};
    conceptDiagramTypes=[
      {type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 5는 검색 화면을 나타내는 예시도이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]},
      {type:'data_structure',svgContent:'<svg></svg>',briefDesc:'도 6은 데이터 구조를 나타내는 예시도이다.',refMap:[{signNumber:'41',label:'레코드'}]}
    ];
    outputs={step_06:'【청구항 1】 통신부(110); 프로세서(120)', step_07:'[장치도면설계] 통신부(110), 프로세서(120)', step_08:'도 1을 참조하면, 통신부(110)가 동작한다.', step_07c:'[도 5] UI 화면 예시도\\n참조번호: 검색창(31), 결과목록(32)\\n도 5는 검색 화면을 나타내는 예시도이다.'};
  `);
}
beforeEach(() => { withConcepts(); claudeText = ''; });

// ─────────── A1: step_08c 전용 프롬프트 ───────────

test('A1 ★ step_08c 프롬프트 — 예시도 전용(장치 메가룰 없음) + 장치 구성 동작·구현 + 실질 시나리오', () => {
  const p = step08c();
  assert.match(p, /이것은 "예시도\(개념도\)" 전용 상세설명이다/, '★ 예시도 전용 선언');
  assert.ok(p.indexOf('이것은 "장치" 상세설명이다') < 0, '★ 장치 메가룰 프레이밍 없음(과부하 제거)');
  assert.match(p, /\[장치 도면 설계\]의 어느 구성\(100~[^]*?어떻게 동작·구현되는지/, '★ 장치 구성에 의한 동작·구현');
  assert.match(p, /소프트웨어적 구성이 하드웨어\(장치 구성\)에 의해 구체적으로 동작·구현됨/, '★ SW→HW(§42)');
  assert.match(p, /실질적·예시적 시나리오\(동작 흐름\)/, '★ 실질 시나리오');
  assert.match(p, /검색창\(31\)은 프로세서\(120\)가 실행하는 소프트웨어/, '예시(31↔120)');
});

test('A1 ★ step_08c 프롬프트 — 예시도 목록(도 5·6)·[장치 상세설명] 참고 주입', () => {
  const p = step08c();
  assert.match(p, /도 5: UI 화면 \(참조번호: 31\(검색창\), 32\(결과목록\)\)/, '★ 예시도 목록(도5)');
  assert.match(p, /도 6: 데이터 구조/, '예시도 목록(도6)');
  assert.match(p, /\[장치 상세설명 — 참고[\s\S]*?도 1을 참조하면, 통신부\(110\)/, '★ 장치 상세설명 참고(동일 명칭)');
  assert.match(p, /청구항 번호를 직접 언급하지 마라/, '청구항 번호 금지(#214 일관)');
});

test('A1 ★ runConceptDescStep 생성 — outputs.step_08c 저장 + getLatestConceptDescription', async () => {
  claudeText = '도 5를 참조하면, 검색창(31)은 프로세서(120)가 실행하는 소프트웨어에 의해 표시된다.';
  await call('runConceptDescStep()');
  assert.equal(call('outputs.step_08c'), claudeText, '★ outputs.step_08c 저장');
  assert.equal(call('getLatestConceptDescription()'), claudeText, '★ accessor 반환');
});

test('A1 ★ 예시도 없으면 생성 거부(가드)', async () => {
  setCtx(`conceptDiagramTypes=[]; outputs={step_06:'청구항'};`);
  await call('runConceptDescStep()');
  assert.ok(!call('outputs.step_08c'), '★ 예시도 없으면 step_08c 미생성');
});

// ─────────── A2: 조립 (장치→예시→방법) ───────────

test('A2 ★ buildSpecification — 발명을 실시하기 위한 구체적인 내용에 장치→예시→방법 순', () => {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={}; outputTimestamps={};
    conceptDiagramTypes=[]; requiredFigures=[];
    outputs={
      step_06:'【청구항 1】 통신부(110)',
      step_08:'도 1을 참조하면, 통신부(110)가 데이터를 수신한다.',
      step_08c:'도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.',
      step_12:'도 7을 참조하면, S710 단계에서 수신한다.'
    };
  `);
  const spec = call('buildSpecification()');
  const iDev = spec.indexOf('통신부(110)가 데이터를 수신한다');
  const iConc = spec.indexOf('검색창(31)은 프로세서(120)에 의해 표시된다');
  const iMeth = spec.indexOf('S710 단계에서 수신한다');
  assert.ok(iDev >= 0 && iConc >= 0 && iMeth >= 0, '셋 다 포함');
  assert.ok(iDev < iConc && iConc < iMeth, '★ 장치 < 예시 < 방법 순서');
});

test('A2 ★ step_08c 없으면 — 종전과 동일(장치+방법, no-op)', () => {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={}; conceptDiagramTypes=[]; requiredFigures=[]; outputTimestamps={};
    outputs={step_06:'【청구항 1】 통신부(110)', step_08:'도 1을 참조하면, 통신부(110)가 동작한다.', step_12:'도 5를 참조하면, S510 단계.'};
  `);
  const spec = call('buildSpecification()');
  assert.match(spec, /통신부\(110\)가 동작한다/, '장치 유지');
  assert.match(spec, /S510 단계/, '방법 유지');
});

// ─────────── reflect 공존(중복 방지) ───────────

test('★ reflect 공존 — step_08c가 예시도를 담으면 reflect가 step_08에 중복 APPEND 안 함', () => {
  setCtx(`
    diagramData={step_07:[{},{},{},{}]}; outputTimestamps={step_08:100}; selectedTitle='검색 시스템';
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 5는 검색 화면을 나타내는 예시도이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]}];
    outputs={
      step_08:'도 1을 참조하면, 통신부(110)가 동작한다.',
      step_08c:'도 5를 참조하면, 검색창(31), 결과목록(32)은 프로세서(120)에 의해 표시된다.'
    };
  `);
  const r = JSON.parse(call('JSON.stringify(reflectConceptsToSpec())'));
  assert.equal(r.desc, 0, '★ step_08c가 도5 담음 → reflect desc 0(중복 방지)');
  assert.ok(call('outputs.step_08').indexOf('도 5를 참조하면') < 0, '★ step_08엔 reflect 예시도 단락 안 들어감');
});

// ─────────── A3 / 등록 / 소스 ───────────

test('A3 소스 ★ 예시도 상세설명 보조 버튼 + 결과/진행 컨테이너(index.html)', () => {
  assert.match(HTML_SRC, /id="btnStep08c" onclick="runConceptDescStep\(\)"/, '★ 버튼 배선');
  assert.match(HTML_SRC, /예시도 상세설명만 재생성/, '★ 버튼 라벨(보조 재생성 — display-unify 에서 변경)');
  assert.match(HTML_SRC, /id="resultStep08c"/, '★ 결과 컨테이너(renderOutput cid — resultCard08 로 이동)');
  assert.match(HTML_SRC, /id="progressStep08c"/, '★ 진행 컨테이너');
});

test('소스 ★ 등록 — STEP_NAMES·STEP_RUNNERS·STEP_DEPENDENCIES·accessor', () => {
  assert.match(PATENT_SRC, /step_08c:'C1c\. 예시도 상세설명'/, 'STEP_NAMES');
  assert.match(PATENT_SRC, /step_08c:'runConceptDescStep'/, 'STEP_RUNNERS');
  assert.match(PATENT_SRC, /step_07c:\{MUST:\['step_08','step_08c','step_18'\]/, '★ step_07c → step_08c 의존(무효화)');
  assert.match(PATENT_SRC, /step_08c:\{MUST:\[\],SHOULD:\['step_18'\]\}/, 'step_08c → 부호');
  assert.match(PATENT_SRC, /function getLatestConceptDescription\(\)\{\s*return outputs\.step_08c/, 'accessor');
  assert.match(PATENT_SRC, /async function runConceptDescStep\(\)\{/, 'runner');
});

test('소스 ★ runConceptDescStep — 장치/방법 sanitizer 미호출(예시도 도번호 삭제 방지)', () => {
  // runConceptDescStep 본문에 sanitizeMethodFromDevice/sanitizeDescFigureRefs 없음(예시도 도번호가 deviceMax 초과라 삭제됨 — #213)
  const body = PATENT_SRC.slice(PATENT_SRC.indexOf('async function runConceptDescStep'), PATENT_SRC.indexOf('async function runMathInsertion'));
  assert.ok(body.indexOf('sanitizeMethodFromDevice') < 0 && body.indexOf('sanitizeDescFigureRefs') < 0, '★ 장치/방법 sanitizer 미호출');
  assert.match(body, /outputs\.step_08c=t/, 'step_08c 저장');
});

// ─────────── 회귀 ───────────

test('회귀 ★ step_08 프롬프트(장치)·#212·#214 무손상(B 미수행 — 이번 분리만)', () => {
  // step_08 은 이번에 안 건드림(B 단계): 장치 프레이밍·예시도 블록(#212)·청구항 금지(#214) 유지
  const p = call("_buildPromptCore('step_08','원본','검색 시스템','')");
  assert.match(p, /이것은 "장치" 상세설명이다/, 'step_08 장치 프레이밍 유지');
  assert.match(p, /청구항 번호를 직접 언급하지 마라/, '#214 청구항 금지 유지');
});
