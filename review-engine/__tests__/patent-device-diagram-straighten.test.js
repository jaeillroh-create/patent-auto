/**
 * review-engine/__tests__/patent-device-diagram-straighten.test.js
 *
 * ★ S3 (skill §8.2 이식) — 장치/방법 도면 연결선 정규화: "직선 우선 + 겹침밴드 중앙 접속"
 *   두 직사각형 박스가 마주보는 변의 좌표 범위가 겹치면, 연결선을 겹침밴드 중앙에 직선으로 접속한다.
 *   공유 헬퍼 `_snapRouteToShapeAnchors`(module 07)에 구현 → SVG/PPTX/이미지 렌더 전 경로에 전파.
 *   가드: (a) 양쪽 다 box 형(곡면 shape 제외) (b) 겹침밴드 존재 (c) 비퇴화(직선 길이>tol)
 *         (d) 다른 박스 관통 안 함(_segmentIntersectsBox 장애물 가드).
 *   ★ 예시도(step_07c, LLM 드로잉)는 대상 아님 — 장치/방법의 결정적 기하만 정규화.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
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
const setV = (s) => vm.runInContext(s, sandbox);
const band = (a, b) => JSON.parse(call(`JSON.stringify(_facingOverlapBand(${a},${b}))`));
const snap = (rt, from, to, boxes, tol) => JSON.parse(call(`JSON.stringify(_snapRouteToShapeAnchors(${rt},${from},${to},0,0,${boxes},${tol}))`));

// ─────────── _facingOverlapBand 단위 ───────────

test('band ★ 좌우 배치 + 세로 범위 겹침 → 수평 밴드(중앙 접속)', () => {
  setV('globalThis.A={x:0,y:0,w:100,h:60,_shapeType:"box"}; globalThis.B={x:200,y:20,w:100,h:60,_shapeType:"box"};');
  const r = band('A', 'B');
  assert.equal(r.axis, 'h', '★ 수평 축');
  assert.equal(r.fromDir, 'right'); assert.equal(r.toDir, 'left');
  assert.equal(r.center, 40, '★ 겹침밴드 중앙 = (20~60) 중앙 = 40');
});

test('band ★ 방향 반전(B→A) → 수평 밴드 좌우 대칭', () => {
  setV('globalThis.A={x:0,y:0,w:100,h:60,_shapeType:"box"}; globalThis.B={x:200,y:20,w:100,h:60,_shapeType:"box"};');
  const r = band('B', 'A');
  assert.equal(r.axis, 'h'); assert.equal(r.fromDir, 'left'); assert.equal(r.toDir, 'right');
  assert.equal(r.center, 40);
});

test('band ★ 상하 배치 + 가로 범위 겹침 → 수직 밴드', () => {
  setV('globalThis.C={x:0,y:0,w:100,h:60,_shapeType:"box"}; globalThis.D={x:20,y:200,w:100,h:60,_shapeType:"box"};');
  const r = band('C', 'D');
  assert.equal(r.axis, 'v'); assert.equal(r.fromDir, 'bottom'); assert.equal(r.toDir, 'top');
  assert.equal(r.center, 60, '★ 가로 겹침(20~100) 중앙 = 60');
});

test('band ★ 대각 배치(마주보는 변 겹침 없음) → null', () => {
  setV('globalThis.E={x:0,y:0,w:100,h:60,_shapeType:"box"}; globalThis.F={x:200,y:200,w:100,h:60,_shapeType:"box"};');
  assert.equal(band('E', 'F'), null, '★ 겹침밴드 없음 → null(직선 강제 안 함)');
});

// ─────────── 겹침밴드 중앙 직선 접속(collapse) ───────────

test('collapse ★ y 오프셋 겹침 L-경로 → 밴드 중앙 수평 직선(2점)', () => {
  setV('globalThis.A={x:0,y:0,w:100,h:60,_shapeType:"box"}; globalThis.B={x:200,y:20,w:100,h:60,_shapeType:"box"};');
  const out = snap('[{x:100,y:30},{x:150,y:30},{x:150,y:50},{x:200,y:50}]', 'A', 'B', '[{...A,id:"a"},{...B,id:"b"}]', 1);
  assert.equal(out.length, 2, '★ 직선(2점)으로 축약');
  assert.deepEqual(out, [{ x: 100, y: 40 }, { x: 200, y: 40 }], '★ 밴드 중앙(y=40) 수평 직선');
});

test('collapse ★ 장애물이 밴드를 가로막으면 → 직선 축약 안 함(다점 경로 유지)', () => {
  setV('globalThis.A={x:0,y:0,w:100,h:60,_shapeType:"box"}; globalThis.B={x:200,y:20,w:100,h:60,_shapeType:"box"}; globalThis.OBST={x:130,y:0,w:20,h:100,_shapeType:"box",id:"o"};');
  const out = snap('[{x:100,y:30},{x:150,y:30},{x:150,y:50},{x:200,y:50}]', 'A', 'B', '[{...A,id:"a"},{...B,id:"b"},OBST]', 1);
  assert.ok(out.length > 2, '★ 장애물 관통 회피 — 직선 축약 미적용');
});

test('collapse ★ 곡면 shape(비-box)는 직선 축약 안 함', () => {
  setV('globalThis.G={x:0,y:0,w:100,h:60,_shapeType:"cloud",_sx:0,_sy:0,_sw:100,_sh:60}; globalThis.B={x:200,y:20,w:100,h:60,_shapeType:"box"};');
  const out = snap('[{x:100,y:30},{x:150,y:30},{x:150,y:50},{x:200,y:50}]', 'G', 'B', '[{...G,id:"g"},{...B,id:"b"}]', 1);
  assert.ok(out.length > 2, '★ box 아닌 shape 는 겹침밴드 축약 제외(곡면 앵커 보존)');
});

test('collapse ★ 대각 배치(밴드 없음) → 직선 축약 안 함(기존 직교 라우팅)', () => {
  setV('globalThis.E={x:0,y:0,w:100,h:60,_shapeType:"box"}; globalThis.F={x:200,y:200,w:100,h:60,_shapeType:"box"};');
  const out = snap('[{x:100,y:30},{x:150,y:30},{x:150,y:230},{x:200,y:230}]', 'E', 'F', '[{...E,id:"e"},{...F,id:"f"}]', 1);
  assert.ok(out.length > 2, '★ 겹침밴드 없으면 축약 안 함(L/직교 유지)');
});

// ─────────── 소스 어서션 ───────────

test('소스 ★ _facingOverlapBand 헬퍼 + S3 축약 블록 존재(공유 헬퍼 경로)', () => {
  assert.match(PATENT_SRC, /function _facingOverlapBand\(fromBox,toBox\)\{/, '★ 밴드 헬퍼 정의');
  assert.match(PATENT_SRC, /S3\(skill §8\.2\)[\s\S]*?겹침밴드 중앙에 직선/, '★ S3 축약 주석/의도');
  assert.match(PATENT_SRC, /function _snapRouteToShapeAnchors\([\s\S]*?_facingOverlapBand\(fromBox,toBox\)/, '★ 공유 스냅 헬퍼 내부에서 밴드 사용(SVG/PPTX/이미지 전파)');
});

test('소스 ★ 장애물 가드 — _segmentIntersectsBox 로 관통 검사(직선이 다른 박스 안 뚫음)', () => {
  assert.match(PATENT_SRC, /_others\.every\(b=>!_segmentIntersectsBox\(\{x:sfx,y:sfy\},\{x:stx,y:sty\},b,_ct\)\)/, '★ 장애물 every 가드');
});

test('소스 ★ 금지 문자열 회피 — segmentsIntersect / 선분 교차 검사 미사용(overlap-prevention 랜드마인)', () => {
  assert.ok(!/segmentsIntersect|선분 교차 검사/.test(PATENT_SRC), '★ 금지 토큰 없음(min/max 범위 비교만 사용)');
});
