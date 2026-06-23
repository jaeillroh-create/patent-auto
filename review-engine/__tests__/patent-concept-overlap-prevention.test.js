/**
 * review-engine/__tests__/patent-concept-overlap-prevention.test.js
 *
 * ★ 예시도 부호선 겹침 — 생성 단계 예방(A 프롬프트 규칙 + B 자기검증) + C 생성 직후 P5 자동 1회.
 *   step_07 "배치 품질 규칙(렌더링 겹침 방지)" 이식. 공유 상수로 main·cascade 일관(P4). D(좌표검사) 제외.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');

let Patent, sandbox, App, visionCalls, visionResp;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  App = {
    sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {},
    callVision: async (p, images, maxTok) => { visionCalls.push({ p, images, maxTok }); return visionResp; },
  };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', // common.js 전역(patent.js 단독 로드 시 부재) — saveProject 조기반환용(refineAll 내부 saveProject 무해화)
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
  Patent = sandbox.window.Patent;
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setConcept = (arr) => vm.runInContext('conceptDiagramTypes=' + JSON.stringify(arr) + ';', sandbox);
const readConcept = () => JSON.parse(vm.runInContext('JSON.stringify(conceptDiagramTypes)', sandbox));
const refineAll = async (opts) => await vm.runInContext('Patent.refineAllConceptDiagrams(' + JSON.stringify(opts || {}) + ')', sandbox);

const ORIG = '<svg viewBox="0 0 680 500"><text>검색창(31)</text><text>결과(99)</text></svg>';
const FIXED = '<svg viewBox="0 0 680 500"><text x="60" y="80">검색창(31)</text><text x="400" y="300">결과(99)</text></svg>';
const mkConcept = () => [{ type: 'ui_screen', svgContent: ORIG, refMap: [{ signNumber: '31', label: '검색창' }, { signNumber: '99', label: '결과' }], briefDesc: '도 5는 화면이다.', figNum: 5 }];

beforeEach(() => { visionCalls = []; visionResp = { text: FIXED }; Patent._conceptSvgToPng = async () => 'data:image/png;base64,PNG'; });

// ── A: 프롬프트 겹침 규칙(공유 상수, main·cascade 일관) ──

test('★ A — CONCEPT_OVERLAP_RULES 겹침 방지 규칙(리더선·간격·교차·viewBox)', () => {
  const r = call('CONCEPT_OVERLAP_RULES');
  assert.match(r, /리더선.*겹치거나 가로지르지 않게/, '★ 리더선 겹침/교차 금지');
  assert.match(r, /가까운|근처의 빈 공간/, '부호는 요소 근처 빈 공간');
  assert.match(r, /충분한 간격/, '요소 간 간격');
  assert.match(r, /교차를 최소화/, '연결선 교차 최소화');
  assert.match(r, /viewBox\(680×500\) 안에/, 'viewBox 안');
});

test('★ A — main·cascade 프롬프트 둘 다 CONCEPT_OVERLAP_RULES 주입(공유·일관 P4)', () => {
  // 정의 1 + main 주입 1 + cascade 주입 1 = 3
  assert.equal((PATENT_SRC.match(/CONCEPT_OVERLAP_RULES/g) || []).length, 3, '★ 정의+main+cascade');
});

// ── B: 자기검증 겹침 항목 ──

test('★ B — 자기검증에 겹침 점검 항목(5번) 추가', () => {
  assert.match(PATENT_SRC, /5\. ★ 부호 리더선\/연결선이 다른 박스·텍스트·선과 겹치거나 가로지르는가\?/, '★ 자기검증 겹침 항목');
});

// ── C: 생성 직후 자동 정련(P5 자동 1회) ──

test('★ C — runConceptDiagramStep·cascade 둘 다 생성 직후 refineAll(maxRounds:1) + callVision 가드', () => {
  // main·cascade 양쪽에서 자동 정련 호출
  assert.equal((PATENT_SRC.match(/await Patent\.refineAllConceptDiagrams\(\{maxRounds:1\}\)/g) || []).length, 2, '★ main·cascade 자동 1회');
  // callVision 가드(없으면 skip)
  assert.match(PATENT_SRC, /if\(App&&typeof App\.callVision==='function'\)\{[^}]*refineAllConceptDiagrams\(\{maxRounds:1\}\)/, '★ callVision 가드');
});

test('★ C 동작 — callVision 있으면 자동 정련 적용(겹침 개선, 번호 유지)', async () => {
  setConcept(mkConcept());
  const done = await refineAll({ maxRounds: 1 });
  assert.equal(done, 1, '1건 정련');
  const c = readConcept();
  assert.equal(c[0].svgContent, FIXED, '★ svgContent 개선본');
  assert.deepEqual(c[0].refMap, [{ signNumber: '31', label: '검색창' }, { signNumber: '99', label: '결과' }], '★ 부호(이름·번호) 유지');
  assert.equal(c[0].briefDesc, '도 5는 화면이다.', '청구설명(brief) 유지');
});

test('★ C 가드 — callVision 없으면 정련 skip(원본 유지, 생성만)', async () => {
  setConcept(mkConcept());
  const orig = App.callVision; App.callVision = undefined;
  try {
    const done = await refineAll({ maxRounds: 1 });
    assert.equal(done, 0, '★ 정련 0(가드)');
    assert.equal(readConcept()[0].svgContent, ORIG, '원본 유지');
  } finally { App.callVision = orig; }
});

test('★ C 번호보존 — 정련본이 번호 누락하면 거부(원본 유지)', async () => {
  setConcept(mkConcept());
  visionResp = { text: '<svg viewBox="0 0 680 500"><text>검색창(31)</text></svg>' }; // 99 누락
  const done = await refineAll({ maxRounds: 1 });
  assert.equal(done, 0, '거부');
  assert.equal(readConcept()[0].svgContent, ORIG, '★ 원본 유지(내용 보호)');
});

test('★ 회귀 0 — SVG-direct 유지(D 좌표검사 미도입), P5 함수 존재', () => {
  assert.equal(typeof Patent.refineAllConceptDiagrams, 'function', 'refineAll 존재');
  assert.equal(typeof Patent.refineConceptDiagram, 'function', 'refine 존재');
  // 생성은 여전히 SVG-direct(LLM SVG) — 좌표 선분교차 검사(D) 미도입
  assert.ok(!/segmentsIntersect|선분 교차 검사/.test(PATENT_SRC), 'D(좌표검사) 미도입');
  assert.match(PATENT_SRC, /SVG 코드로 직접 생성하라/, 'SVG-direct 생성 유지');
});
