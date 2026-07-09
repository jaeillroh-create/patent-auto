/**
 * review-engine/__tests__/patent-review-apply-concept-preserve.test.js
 *
 * ★ 검토 반영(applyReview) 예시도 삭제 회귀 수정 — sanitizeMethodFromDevice 예시도 인지.
 *   원인: sanitizeMethodFromDevice(5124)가 deviceMax 초과 도면을 전부 "방법 도면"으로 간주 → 예시도(도 4·5 > deviceMax 3)
 *         를 방법으로 오분류·삭제(5151). 예시도(step_07c) 인지 없음. applyReview 전용이라 검토 반영에서만 발현.
 *   Task1: getAutoFigNums('step_07c')(SoT) 도 번호를 methodFigNums 에서 제외 → 예시도 단락 보존. 진짜 방법 도면은 여전히 제거.
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
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
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
const sanitize = (text) => call('sanitizeMethodFromDevice(' + JSON.stringify(text) + ')');

// 진단 vm 재현: 장치 도면 도1-3(diagramData 3 + step_07 텍스트 "도 3"로 deviceMax=3), 예시도 2개 → 도 4·5
// 장치 설명 + 예시도 설명이 섞인 step_08 (B1 네이티브)
const DESC_DEV_CONCEPT =
  '도 1을 참조하면, 통신부(110)가 데이터를 수신한다.\n\n' +
  '도 2를 참조하면, 프로세서(120)가 처리한다.\n\n' +
  '도 3을 참조하면, 저장부(130)가 저장한다.\n\n' +
  '도 4를 참조하면, 검색창(31), 결과목록(32)이 화면에 표시된다.\n\n' +
  '도 5를 참조하면, 레코드(41)가 저장된다.';

beforeEach(() => {
  setCtx(`
    diagramData={step_07:[{},{},{}]};
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>'},{type:'data_structure',svgContent:'<svg></svg>'}];
    requiredFigures=[];
    outputs={step_07:'도 1: 전체 구성도\\n도 2: 통신부 상세\\n도 3: 프로세서 상세'};
  `);
});

// ─────────── Task 1: 예시도 보존 ───────────

test('Task1 ★ 진단 재현 — 검토 반영 sanitizer 가 예시도(도 4·5) 단락을 보존(삭제 안 함)', () => {
  // getAutoFigNums('step_07c') = [4,5] (device 3 + concept 2)
  assert.deepEqual(JSON.parse(call("JSON.stringify(getAutoFigNums('step_07c'))")), [4, 5], 'SoT 예시도 번호=[4,5]');
  const out = sanitize(DESC_DEV_CONCEPT);
  assert.match(out, /도 4를 참조하면, 검색창\(31\), 결과목록\(32\)/, '★ 도 4 예시도 단락 보존');
  assert.match(out, /도 5를 참조하면, 레코드\(41\)/, '★ 도 5 예시도 단락 보존');
  assert.match(out, /도 1을 참조하면, 통신부\(110\)/, '장치 설명 보존');
});

test('Task1 ★ 예시도 brief 에 "방법" 단어 있어도 보존(intro 정규식 오분류 차단)', () => {
  // "도 4는 검색 방법을 ... 예시도이다" 형태 — introRe(방법+이다) 매칭 위험 → conceptFigNums delete 로 차단
  const desc = '도 1을 참조하면, 통신부(110)가 동작한다.\n\n도 4는 검색 방법을 나타내는 예시도이다. 도 4를 참조하면, 검색창(31)이 표시된다.';
  const out = sanitize(desc);
  assert.match(out, /도 4는 검색 방법을 나타내는 예시도이다/, '★ "방법" 포함 예시도 소개문 보존');
  assert.match(out, /검색창\(31\)/, '★ 예시도 부호 보존');
});

// ─────────── 진짜 방법 도면은 여전히 제거 (의도 유지) ───────────

test('★ 진짜 방법 도면(순서도, 예시도 범위 밖)은 여전히 제거 — sanitizer 의도 유지', () => {
  // device 3 + concept 2 + method 1 → device[1,2,3] concept[4,5] method[6]
  setCtx(`diagramData={step_07:[{},{},{}],step_11:[{}]};`);
  assert.deepEqual(JSON.parse(call("JSON.stringify(getAutoFigNums('step_07c'))")), [4, 5], '예시도=[4,5]');
  const desc = DESC_DEV_CONCEPT + '\n\n도 6은 방법을 나타내는 순서도이다. 도 6을 참조하면, 단계가 수행된다.';
  const out = sanitize(desc);
  assert.match(out, /도 4를 참조하면, 검색창\(31\)/, '예시도(도4) 보존');
  assert.match(out, /도 5를 참조하면, 레코드\(41\)/, '예시도(도5) 보존');
  assert.ok(out.indexOf('도 6은 방법을 나타내는 순서도이다') < 0, '★ 진짜 방법 도면(도 6 순서도) 제거(의도 유지)');
});

test('★ S단계 문장은 여전히 제거(방법 혼입 방지 유지)', () => {
  const desc = '도 1을 참조하면, 통신부(110)가 동작한다.\nS410 단계에서 데이터를 수신하는 단계를 수행한다.\n도 4를 참조하면, 검색창(31)이 표시된다.';
  const out = sanitize(desc);
  assert.ok(out.indexOf('S410') < 0, '★ S단계 문장 제거(유지)');
  assert.match(out, /검색창\(31\)/, '예시도 보존');
});

// ─────────── 예시도 없으면 no-op(회귀 0) ───────────

test('★ 예시도 없으면 — 기존 동작 유지(deviceMax 초과 도면은 종전대로 제거)', () => {
  setCtx(`diagramData={step_07:[{},{},{}]}; conceptDiagramTypes=[];`);
  assert.deepEqual(JSON.parse(call("JSON.stringify(getAutoFigNums('step_07c'))")), [], '예시도 없음');
  // 예시도 없으니 도 4·5 는 보호 대상 아님 → deviceMax(3) 초과로 제거(기존 동작)
  const out = sanitize(DESC_DEV_CONCEPT);
  assert.ok(out.indexOf('도 4를 참조하면') < 0, '★ 예시도 없으면 도4 제거(기존 동작 — 회귀 0)');
  assert.match(out, /도 1을 참조하면, 통신부\(110\)/, '장치 설명은 보존');
});

// ─────────── 소스 정합 ───────────

test('소스 ★ Task1 — conceptFigNums(getAutoFigNums) 를 methodFigNums 에서 제외', () => {
  assert.match(PATENT_SRC, /const conceptFigNums=new Set\(getAutoFigNums\('step_07c'\)\);/, '★ 예시도 도 번호 집합(SoT)');
  assert.match(PATENT_SRC, /conceptFigNums\.forEach\(n=>methodFigNums\.delete\(n\)\);/, '★ 방법 분류에서 예시도 제외(intro·범위 양쪽 차단)');
});

test('소스 ★ 호출부 — sanitizeMethodFromDevice 는 applyReview 후처리 전용(생성 경로 무관)', () => {
  assert.equal((PATENT_SRC.match(/sanitizeMethodFromDevice\(/g) || []).length, 2, '정의 1 + 호출 1(applyReview)');
  // 생성(runLongStep/케스케이드)은 sanitizeDescFigureRefs(예시도 인지) 사용 — 회귀 0
  assert.match(PATENT_SRC, /finalDesc=sanitizeMethodFromDevice\(finalDesc\);/, 'applyReview 후처리 위치 유지');
});
