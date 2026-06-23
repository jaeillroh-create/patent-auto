/**
 * review-engine/__tests__/patent-user-figure-output.test.js
 *
 * ★ [T4] 사용자 도면 출력 반영 — 기존 base64(fileDataUrl) 이미지를 미리보기·Word·PPTX 에 삽입(비전 불필요).
 *   buildUserFiguresHtml(opts) 단일 헬퍼(미리보기/Word 공유) + _appendUserFigureSlides(pptx)(PPTX).
 *   ★ 텍스트 명세(buildSpecification)는 불변 — .txt/clipboard 보존, 자동 도면 회귀 0.
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
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), currentUser: { id: 'u1', email: 'v@x.com' } };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const setFigs = (arr) => vm.runInContext('requiredFigures=' + JSON.stringify(arr) + ';', sandbox, { filename: 'set.js' });
const buildHtml = (opts) => vm.runInContext('buildUserFiguresHtml(' + JSON.stringify(opts || {}) + ')', sandbox, { filename: 'call.js' });

const FIGS = [
  { num: 3, description: '실험 결과 그래프', fileName: 'g3.png', fileDataUrl: 'data:image/png;base64,IMG3' },
  { num: 1, description: '장치 사진 <b>강조</b>', fileName: 'p1.png', fileDataUrl: 'data:image/png;base64,IMG1' },
  { num: 2, description: '회로도(파일 없음)' },   // ★ fileDataUrl 없음 → 이미지 블록 제외
];

beforeEach(() => setFigs([]));

test('★ 미리보기 HTML — fileDataUrl 있는 도면만 <img> + 도 N + 설명, 도 번호 순', () => {
  setFigs(FIGS);
  const h = buildHtml({});
  assert.ok(h.indexOf('data:image/png;base64,IMG1') >= 0, '도1 이미지 포함');
  assert.ok(h.indexOf('data:image/png;base64,IMG3') >= 0, '도3 이미지 포함');
  assert.ok(h.indexOf('회로도') < 0, '★ fileDataUrl 없는 도2 제외(이미지 블록 아님)');
  assert.ok(h.indexOf('도 1') >= 0 && h.indexOf('도 3') >= 0, '캡션 도 N');
  assert.ok(h.indexOf('도 1') < h.indexOf('도 3'), '★ 도 번호 순(1 → 3)');
  assert.match(h, /사용자 도면 2건/, '이미지 있는 2건 카운트');
});

test('★ Word HTML — 【도면】 헤더 + <img> + 바탕체 캡션', () => {
  setFigs(FIGS);
  const h = buildHtml({ word: true });
  assert.match(h, /【도면】/, '【도면】 섹션');
  assert.ok(h.indexOf('data:image/png;base64,IMG1') >= 0, 'base64 이미지 삽입');
  assert.match(h, /바탕체/, 'Word 폰트(바탕체)');
  assert.match(h, /max-width:15cm/, 'Word 이미지 폭 제한');
});

test('★ 설명 escapeHtml — 사용자 설명의 <b> 이스케이프', () => {
  setFigs(FIGS);
  const h = buildHtml({});
  assert.ok(h.indexOf('&lt;b&gt;강조') >= 0, '★ 설명 HTML 이스케이프(XSS/깨짐 방지)');
  assert.ok(h.indexOf('<b>강조') < 0, '원시 <b> 미주입');
});

test('★ 사용자 도면 없음/이미지 없음 → 빈 문자열(출력 무영향)', () => {
  setFigs([]);
  assert.equal(buildHtml({}), '', '도면 0건 → ""');
  setFigs([{ num: 1, description: '파일 없는 도면' }]);
  assert.equal(buildHtml({}), '', '★ fileDataUrl 없으면 "" (이미지 없으면 출력 안 함)');
  assert.equal(buildHtml({ word: true }), '', 'Word 도 동일');
});

// ── 소스 정합: 3개 출력 경로 연결 ──

test('★ renderPreview — 미리보기에 buildUserFiguresHtml 추가(빈/정상 경로 모두)', () => {
  const i = PATENT_SRC.indexOf('function renderPreview()');
  const seg = PATENT_SRC.slice(i, i + 2600);
  assert.match(seg, /const _userFigs=buildUserFiguresHtml\(\{\}\)/, '미리보기용 사용자 도면 HTML 생성');
  assert.match(seg, /생성된 항목이 없어요<\/p>'\+_userFigs/, '빈 명세 경로에도 도면 표시');
  assert.match(seg, /\.join\(''\)\+_userFigs/, '정상 경로 끝에 도면 추가');
});

test('★ downloadAsWord — body 에 userFigHtml(사용자 도면) 삽입', () => {
  const i = PATENT_SRC.indexOf('function downloadAsWord()');
  const seg = PATENT_SRC.slice(i, i + 2600);
  assert.match(seg, /const userFigHtml=buildUserFiguresHtml\(\{word:true\}\)/, 'Word용 사용자 도면 HTML');
  assert.match(seg, /<body>\$\{html\}\$\{userFigHtml\}<\/body>/, '★ body 에 명세 뒤 사용자 도면 삽입');
});

test('★ downloadPptx — step_07 PPTX 에 _appendUserFigureSlides(중복 방지)', () => {
  assert.match(PATENT_SRC, /function _appendUserFigureSlides\(pptx\)/, 'PPTX 슬라이드 헬퍼 정의');
  assert.match(PATENT_SRC, /sl\.addImage\(\{data:f\.fileDataUrl/, '★ base64 이미지 → addImage');
  assert.match(PATENT_SRC, /if\(sid==='step_07'\)\{try\{_appendUserFigureSlides\(pptx\)/, '★ step_07 에만 호출(중복 방지)');
});

test('★ 회귀 0 — buildSpecification(텍스트 명세)은 사용자 이미지 미포함(.txt/clipboard 보존)', () => {
  const i = PATENT_SRC.indexOf('function buildSpecification()');
  const seg = PATENT_SRC.slice(i, i + 1500);
  assert.ok(!/buildUserFiguresHtml/.test(seg), '★ 텍스트 명세에 이미지 HTML 미주입');
  assert.ok(!/fileDataUrl/.test(seg), '텍스트 명세에 base64 미포함(.txt 순수 텍스트 유지)');
});
