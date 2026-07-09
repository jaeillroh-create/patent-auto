/**
 * review-engine/__tests__/patent-step8-concept-native.test.js
 *
 * ★ Step 8 예시도 1급화(B1) + applyReview 예시도 입력(B2) + reflect 멱등 네이티브 인식(B3).
 *   원인: 순서(7c→8)는 맞으나 Step 8이 예시도 2급 취급 + 프롬프트 모순(4475 "장치도면 것만, 없는 번호 추가금지"
 *   → 예시도 31~99 누락 오인). applyReview 입력에 step_07c 0건 → 검토 반영도 못 고침.
 *   B1: 4475 모순 해소(31~99 예외 허용) + 데이터 라인 step_07c 전문 + 예시도 설명 강제 → Step 8 네이티브.
 *   B2: applyReview 편집지시 입력에 [예시도 설계](step_07c) → 검토 반영이 예시도 단락 materialize.
 *   B3: reflect 멱등이 Step 8 네이티브 단락("도 N 참조하면"+부호)도 인식 → 네이티브+reflect 중복 APPEND 차단.
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
  // ★ step_08 프롬프트 빌더는 optDeviceFigures 등의 .value 를 읽음 → value 보유 stub
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

function withConcepts() {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:[{},{},{}]}; outputTimestamps={};
    requiredFigures=[]; detailLevel='standard';
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 4는 검색 화면을 나타내는 예시도이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]}];
    outputs={step_06:'【청구항 1】 통신부(110); 프로세서(120)', step_07:'[장치도면설계] 통신부(110), 프로세서(120)', step_07c:'[도 4] UI 화면 예시도\\n참조번호: 검색창(31), 결과목록(32)\\n도 4는 검색 화면을 나타내는 예시도이다.'};
  `);
}
beforeEach(() => { withConcepts(); });

// ─────────── B1 은퇴(retire): step_08 = 장치 전용 환원(예시도는 step_08c 가 담당) ───────────

test('retire ★ step_08 프롬프트 — [예시도 설계]·예시도 블록 제거(device-only)', () => {
  const p = step08();   // 예시도 있어도
  assert.ok(p.indexOf('[예시도 설계') < 0, '★ step_08 입력에 [예시도 설계] 없음(예시도는 step_08c)');
  assert.ok(p.indexOf('★★★ 예시도/개념도 (참조번호 31~99)') < 0, '★ 예시도 블록 제거');
});

test('retire ★ 4475 device-only — 예시도 예외구·모순 제거', () => {
  const p = step08();
  assert.ok(p.indexOf('예시도 부호(31~99)는 아래 [예시도 설계]에 정의된') < 0, '★ 예시도 예외구 제거');
  assert.match(p, /예시도\(별도 부호 — 도 번호 기반\)는 이 단계에서 다루지 않는다/, '★ 예시도는 별도 단계(step_08c) 명시(도 번호 기반 부호)');
  assert.match(p, /구성요소\(참조번호 100~\)를 빠짐없이 설명하라/, '장치(100~) 설명 지시 유지');
});

test('retire ★ 예시도 설명 강제구 제거(step_08 에서)', () => {
  const p = step08();
  assert.ok(p.indexOf('예시도(도 N)도 장치 도면과 ★동일한 수준으로★') < 0, '★ 예시도 설명 강제구 제거(step_08c 로 이전)');
});

test('retire ★ 장치 설명 회귀 0 — 장치 프레이밍·구성요소(100~) 유지', () => {
  const p = step08();
  assert.match(p, /이것은 "장치" 상세설명이다/, '장치 프레이밍 유지');
  assert.match(p, /\[장치 도면 설계\]/, '장치 도면 설계 입력 유지');
  assert.match(p, /구성요소\(참조번호 100~\)를 빠짐없이 설명하라/, '장치 구성요소(100~) 설명 유지');
});

test('retire 소스 ★ step_08 데이터 라인에 step_07c 미주입(device-only)', () => {
  // step_08 의 [장치 도면 설계] 뒤 바로 특허성 검토/발명 — step_07c 주입 없음
  assert.match(PATENT_SRC, /\[장치 도면 설계\] \$\{outputs\.step_07\|\|''\}\$\{\(outputs\.step_15/, '★ step_08 데이터 라인 step_07c 제거(특허성 검토로 바로 이어짐)');
});

// ─────────── B2 은퇴(T3): applyReview 예시도 짧은 stub 주입 제거 ───────────
// ★ #212 때 추가했던 applyReview 예시도 ADD_AFTER 주입이 "짧은 stub"(④)의 원인 → T3에서 은퇴.
//   예시도 설명은 step_08c(분리)가 담당하고, 검토 반영은 장치 본문에 예시도를 끼워넣지 않는다.

test('B2(T3 은퇴) 소스 ★ applyReview — step_07c 예시도 ADD_AFTER 주입 제거 + 장치 끼워넣기 금지', () => {
  assert.ok(!/검토가 예시도\(도 N\) 설명\/부호 누락을 지적하면[\s\S]*?ADD_AFTER 로 추가하라/.test(PATENT_SRC), '★ 예시도 ADD_AFTER 주입 제거(짧은 stub 은퇴)');
  assert.ok(!/\[예시도 설계 — 참조번호 31~99, 장치\(100~\)와 별개\] '\+outputs\.step_07c\.slice\(0,1200\)/.test(PATENT_SRC), '★ applyReview step_07c brief 주입 제거');
  assert.match(PATENT_SRC, /이것은 ★장치★ 상세설명 편집이다\. 예시도\(도 N[\s\S]*?장치 상세설명에 추가하지 마라/, '★ 장치 본문 예시도 끼워넣기 금지(T3)');
});

// ─────────── B3: reflect 멱등 네이티브 인식 ───────────

test('B3 ★ _conceptAlreadyInDesc — Step 8 네이티브 단락(다른 문구)도 인식', () => {
  // 네이티브 문구: "등이 도시되어 있다" 마커 없음, brief 와도 다름 — 하지만 "도 4 참조하면" + 부호(31)
  const native = '도 4를 참조하면, 검색창(31)이 화면 상단에 배치되고 결과목록(32)이 하단에 표시된다.';
  const ct = `{type:'ui_screen',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}],briefDesc:'도 4는 검색 화면을 나타내는 예시도이다.'}`;
  assert.equal(call(`_conceptAlreadyInDesc(${JSON.stringify(native)}, ${ct}, 4)`), true, '★ 네이티브 단락 인식(중복 방지)');
  // 무관한 본문(도 4 설명 없음) → false
  assert.equal(call(`_conceptAlreadyInDesc('도 1을 참조하면, 통신부(110)가 동작한다.', ${ct}, 4)`), false, '도4 미기술 → 미인식');
});

test('B3(B2 은퇴) ★ reflect 가 step_08 에 APPEND 안 함 — 네이티브 유지, 도5 도 reflect 미추가(step_08c 담당)', () => {
  setCtx(`
    diagramData={step_07:[{},{},{}]}; outputTimestamps={step_08:100}; selectedTitle='검색 시스템';
    conceptDiagramTypes=[
      {type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 4는 검색 화면을 나타내는 예시도이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]},
      {type:'data_structure',svgContent:'<svg></svg>',briefDesc:'도 5는 데이터 구조를 나타내는 예시도이다.',refMap:[{signNumber:'41',label:'레코드'}]}
    ];
    outputs={ step_08:'도 1을 참조하면, 통신부(110)가 수신한다. 도 4를 참조하면, 검색창(31)이 상단에 배치되고 결과목록(32)이 표시된다.' };
  `);
  const r = JSON.parse(call('JSON.stringify(reflectConceptsToSpec())'));
  assert.equal(r.desc, 0, '★ desc 0(step_08 APPEND 은퇴)');
  const s8 = call('outputs.step_08');
  assert.equal((s8.match(/도 4를 참조하면/g) || []).length, 1, '★ 도4 네이티브 그대로(중복 없음)');
  assert.ok(s8.indexOf('도 5를 참조하면') < 0, '★ 도5 reflect 미추가(step_08 device 영역 미접촉 — 예시도 설명은 step_08c)');
});

test('B3 소스 ★ 네이티브 인식 분기((도 N 참조하면)+부호 존재)', () => {
  assert.match(PATENT_SRC, /\(3\) ★ 네이티브 인식/, '★ B3 네이티브 인식 주석');
  assert.match(PATENT_SRC, /nums\.length && nums\.some\(n=>s\.indexOf\('\('\+n\+'\)'\)>=0\)/, '★ 부호 존재 기반 인식');
});

// ─────────── 회귀 ───────────

test('회귀 ★ reflect(step_18 부호)·A1·① 유지 + step_08 예시도 블록(4484) 은퇴', () => {
  assert.match(PATENT_SRC, /function reflectConceptsToSpec\(\)\{/, 'reflect 함수 유지(step_18 부호)');
  assert.match(PATENT_SRC, /const _openRefl=reflectConceptsToSpec\(\);/, 'A1 openProject reflect 유지');
  assert.match(PATENT_SRC, /_conceptSvgApplyTitle\(_conceptSvgApplyRefNums\(/, '① 제목 동기화 유지(통합 헬퍼 _conceptSvgForDisplay)');
  assert.ok(!/★★★ 예시도\/개념도 \(참조번호 31~99\) ★★★/.test(PATENT_SRC), '★ step_08 예시도 요약 블록(4484) 은퇴(제거)');
});
