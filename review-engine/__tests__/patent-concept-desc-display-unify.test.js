/**
 * review-engine/__tests__/patent-concept-desc-display-unify.test.js
 *
 * ★ 통합 표시 — 예시도 상세설명(C1c, step_08c)을 우측 "Step 8 결과"(resultCard08)에 장치(C1) 아래로 통합.
 *   진단(DIAG-unified-btn-notrunning): 실행은 정상이나 renderOutput cid 로 C1c 가 좌측 Step 7c(resultStep08c)에 흩어져 표시.
 *   T1: resultStep08c 를 좌측 Step 7c → 우측 resultCard08(resultStep08 아래)로 ★이동★. renderOutput(cid 규칙) 무변경 → 자동으로 우측 렌더.
 *       비면 안 보이게 CSS #resultStep08c:not(:empty). 장치 → 예시도 순.
 *   T2: 좌측 C1c 제거(이동) + btnStep08c 는 보조("예시도 상세설명만 재생성")로 유지(결과는 우측).
 *   ★ 실행 로직 미접촉 — 렌더/마크업/CSS 만.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');
const CSS_SRC = readFileSync(path.join(REPO, 'patent/patent.css'), 'utf8');

// ─────────── T1: 우측 "Step 8 결과"에 C1c 통합(장치→예시도) ───────────

test('T1 ★ resultStep08c — 우측 resultCard08 안, resultStep08(장치) 아래에 위치', () => {
  const iCard08 = HTML_SRC.indexOf('id="resultCard08"');
  const iRes08 = HTML_SRC.indexOf('id="resultStep08"');
  const iRes08c = HTML_SRC.indexOf('id="resultStep08c"');
  const iCard09 = HTML_SRC.indexOf('id="resultCard09"');
  assert.ok(iCard08 > 0 && iRes08 > 0 && iRes08c > 0 && iCard09 > 0, '모든 앵커 존재');
  assert.ok(iRes08c > iCard08 && iRes08c < iCard09, '★ resultStep08c 가 resultCard08(우측 Step 8 결과) 안');
  assert.ok(iRes08 < iRes08c, '★ 장치(resultStep08) → 예시도(resultStep08c) 순서');
});

test('T1 ★ resultStep08c 단일 — 중복 없음(좌측 잔존 X)', () => {
  assert.equal(HTML_SRC.split('id="resultStep08c"').length - 1, 1, '★ resultStep08c 정확히 1개');
});

test('T1 ★ 좌측 Step 7c 카드에 C1c 결과 컨테이너 없음(이동됨)', () => {
  const iBtn08c = HTML_SRC.indexOf('id="btnStep08c"');
  const iRes08 = HTML_SRC.indexOf('id="resultStep08"');
  assert.ok(iBtn08c > 0 && iBtn08c < iRes08, 'btnStep08c(좌측)는 resultStep08(우측)보다 앞');
  // 좌측 영역(btnStep08c ~ resultStep08 직전)에 resultStep08c 없음
  assert.ok(HTML_SRC.slice(iBtn08c, iRes08).indexOf('id="resultStep08c"') < 0, '★ 좌측 Step 7c 영역에 resultStep08c 없음');
});

test('T1 ★ CSS — #resultStep08c:not(:empty) 구분선(비면 숨김)', () => {
  assert.match(CSS_SRC, /#resultStep08c:not\(:empty\)\s*\{/, '★ :not(:empty) 규칙(비면 빈 박스 X)');
  assert.match(CSS_SRC, /#resultStep08c:not\(:empty\)\s*\{[\s\S]*?border-top:/, '★ 내용 있을 때 구분선');
});

test('T1 ★ renderOutput cid 규칙 무변경 — step_08c → resultStep08c 자동 타깃(우측 이동분)', () => {
  assert.match(PATENT_SRC, /const cid=`result\$\{sid\.charAt\(0\)\.toUpperCase\(\)\+sid\.slice\(1\)\.replace\('_',''\)\}`/, '★ cid 규칙 유지');
  // step_08c → 'resultStep08c' 산출 확인(규칙 적용)
  const sid = 'step_08c';
  const cid = `result${sid.charAt(0).toUpperCase() + sid.slice(1).replace('_', '')}`;
  assert.equal(cid, 'resultStep08c', '★ step_08c cid = resultStep08c');
});

// ─────────── 기능: renderOutput('step_08c') 이 resultStep08c 를 타깃 ───────────

test('기능 ★ renderOutput(step_08c) — getElementById("resultStep08c") 요청 + 렌더', () => {
  const requested = [];
  const elStub = (id) => { if (id != null) requested.push(id); return { value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' }; };
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const App = { sb: { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } }, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), setButtonLoading() {}, currentUser: { id: 'u1' } };
  const sandbox = {
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
  requested.length = 0;
  vm.runInContext("renderOutput('step_08c','도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.')", sandbox, { filename: 'c.js' });
  assert.ok(requested.includes('resultStep08c'), '★ renderOutput(step_08c) 이 resultStep08c 컨테이너를 타깃');
});

// ─────────── T2: 보조 버튼 유지(결과는 우측) ───────────

test('T2 ★ btnStep08c 보조 유지 — 라벨 "재생성", 결과는 우측(좌측 컨테이너 없음)', () => {
  assert.match(HTML_SRC, /id="btnStep08c" onclick="runConceptDescStep\(\)"/, '★ 보조 버튼 유지(runConceptDescStep)');
  assert.match(HTML_SRC, /예시도 상세설명만 재생성/, '★ 보조 라벨(재생성)');
  assert.match(HTML_SRC, /id="progressStep08c"/, '★ 진행 컨테이너 유지(좌측 버튼 옆)');
});

// ─────────── 회귀: 실행 로직·장치 표시 무변경 ───────────

test('회귀 ★ 실행 로직 미접촉 — runImplementationDesc device→concept + _conceptDescCore renderOutput(step_08c)', () => {
  assert.match(PATENT_SRC, /async function runImplementationDesc\(\)\{[\s\S]*?await _longStepCore\('step_08'\);[\s\S]*?await _conceptDescCore\(\)/, '★ 통합 순차 실행 유지');
  // ★ merge-into-step08: _conceptDescCore 는 별도 renderOutput('step_08c') 대신 _mergeConceptIntoStep08 으로 합본본을 Step 8 결과에 표시
  assert.match(PATENT_SRC, /async function _conceptDescCore\(\)\{[\s\S]*?_mergeConceptIntoStep08\(\);/, '★ _conceptDescCore 가 합본(merge) 호출');
});

test('회귀 ★ 장치(C1) 표시 — resultStep08 우측 Step 8 결과 유지', () => {
  assert.match(HTML_SRC, /id="resultCard08"[\s\S]*?Step 8 결과: 상세설명[\s\S]*?id="resultStep08" class="result-area"/, '★ 장치 결과(resultStep08) 우측 카드 유지');
  // buildImplementationBody(최종 산출물) 통합 유지(이미 device→concept→method)
  assert.match(PATENT_SRC, /function buildImplementationBody\(\)\{/, '★ 산출물 조립 유지');
});

test('회귀 ★ ?v= 갱신(patent.js 20260714-citation-length · patent.css 20260659)', () => {
  assert.match(HTML_SRC, /patent\/patent\.js\?v=20260714-citation-length/, '★ patent.js ?v=20260714-citation-length(split-loader)');
  assert.match(HTML_SRC, /patent\/patent\.css\?v=20260659/, '★ patent.css ?v=20260659(이번 PR 미변경)');
});
