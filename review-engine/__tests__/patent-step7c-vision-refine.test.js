/**
 * review-engine/__tests__/patent-step7c-vision-refine.test.js
 *
 * ★ P5 예시도 비전 정련 루프 — 생성 SVG → PNG → callVision 비평 → 배치/선 개선 SVG(선 겹침 해소).
 *   ★ 내용(청구 구성·부호 이름·번호) 불변, 배치만 개선. 내용 보존 가드(원본 번호 전부 유지돼야 채택).
 *   callVision(T1) 미탑재/실패/번호누락 시 원본 유지(생성만). 정련 1~2회(루프·비용 가드).
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

let Patent, sandbox, App, visionCalls, visionResp;

before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  App = {
    sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' },
    callVision: async (p, images, maxTok) => { visionCalls.push({ p, images, maxTok }); return visionResp; },
  };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/png;base64,X' }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
  Patent = sandbox.window.Patent;
});

const ORIG_SVG = '<svg viewBox="0 0 680 500"><text>검색창(31)</text><text>결과(99)</text></svg>';
const FIXED_SVG = '<svg viewBox="0 0 680 500"><text x="60" y="80">검색창(31)</text><text x="400" y="300">결과(99)</text></svg>';
const mkCt = () => ({ type: 'ui_screen', svgContent: ORIG_SVG, refMap: [{ signNumber: '31', label: '검색창' }, { signNumber: '99', label: '결과' }], briefDesc: '도 5은 검색 화면이다.', figNum: 5 });

beforeEach(() => {
  visionCalls = []; visionResp = { text: '개선했습니다.\n' + FIXED_SVG };
  // ★ _conceptSvgToPng 는 브라우저 전용(Image/canvas) → 테스트는 스텁(가짜 PNG)
  Patent._conceptSvgToPng = async () => 'data:image/png;base64,PNG';
});

test('★ 정련 루프 — SVG→PNG→callVision→수정 SVG 로 교체(이미지 전달)', async () => {
  const ct = mkCt();
  const res = await Patent.refineConceptDiagram(ct);
  assert.equal(res.refined, true, '정련 적용');
  assert.equal(ct.svgContent, FIXED_SVG, '★ svgContent = 개선본');
  assert.equal(visionCalls.length, 1, 'callVision 1회');
  assert.deepEqual(visionCalls[0].images, ['data:image/png;base64,PNG'], '★ PNG 이미지 전달');
  assert.match(visionCalls[0].p, /리더선/, '비평 프롬프트(선 겹침)');
});

test('★ 내용 보존 — refMap·briefDesc 불변(배치만 개선)', async () => {
  const ct = mkCt();
  const beforeRefMap = JSON.stringify(ct.refMap), beforeBrief = ct.briefDesc;
  await Patent.refineConceptDiagram(ct);
  assert.equal(JSON.stringify(ct.refMap), beforeRefMap, '★ refMap(부호 이름·번호) 불변');
  assert.equal(ct.briefDesc, beforeBrief, '★ briefDesc 불변');
});

test('★ 번호 보존 가드 — 개선본이 원본 번호 누락하면 거부(원본 유지)', async () => {
  const ct = mkCt();
  visionResp = { text: '<svg viewBox="0 0 680 500"><text>검색창(31)</text></svg>' }; // 99 누락
  const res = await Patent.refineConceptDiagram(ct);
  assert.equal(res.refined, false, '★ 거부');
  assert.equal(res.reason, 'num_lost', '번호 누락 사유');
  assert.equal(ct.svgContent, ORIG_SVG, '★ 원본 유지(내용 보호)');
});

test('★ callVision 미탑재 → 가드(원본 유지, 생성만)', async () => {
  const ct = mkCt();
  const orig = App.callVision; App.callVision = undefined;
  try { const res = await Patent.refineConceptDiagram(ct); assert.equal(res.refined, false); assert.equal(res.reason, 'no_vision'); assert.equal(ct.svgContent, ORIG_SVG, '원본 유지'); }
  finally { App.callVision = orig; }
});

test('★ PNG 변환 실패 → 원본 유지(png_fail)', async () => {
  const ct = mkCt();
  Patent._conceptSvgToPng = async () => null;
  const res = await Patent.refineConceptDiagram(ct);
  assert.equal(res.refined, false); assert.equal(res.reason, 'png_fail'); assert.equal(ct.svgContent, ORIG_SVG);
});

test('★ 비전 응답에 SVG 없음 → 원본 유지(vision_fail)', async () => {
  const ct = mkCt();
  visionResp = { text: '겹침이 없어 보입니다(설명만, SVG 미출력)' };
  const res = await Patent.refineConceptDiagram(ct);
  assert.equal(res.refined, false); assert.equal(res.reason, 'vision_fail'); assert.equal(ct.svgContent, ORIG_SVG);
});

test('★ 정련 횟수 제한 — maxRounds 5 요청해도 최대 2회(루프·비용 가드)', async () => {
  const ct = mkCt();
  await Patent.refineConceptDiagram(ct, { maxRounds: 5 });
  assert.equal(visionCalls.length, 2, '★ 최대 2회로 캡');
});

test('★ svgContent 없는 ct → no_svg(정련 대상 아님)', async () => {
  const res = await Patent.refineConceptDiagram({ type: 'ui_screen' });
  assert.equal(res.refined, false); assert.equal(res.reason, 'no_svg');
});

// ── 소스/노출 ──

test('★ 소스 — 카드 [정련] 버튼 + callVision 사용 + 번호보존 가드 + 1~2회 캡', () => {
  assert.match(PATENT_SRC, /onclick="Patent\.refineConceptDiagramByNum\(\$\{figNum\}\)"/, '★ 카드 정련 버튼 배선');
  assert.match(PATENT_SRC, /await App\.callVision\(Patent\._buildConceptRefinePrompt\(current\),\[png\],8192\)/, '★ callVision(T1) 사용');
  assert.match(PATENT_SRC, /origNums\.every\(function\(n\)\{return fixedNums\.indexOf\(n\)>=0;\}\)/, '★ 원본 번호 보존 가드');
  assert.match(PATENT_SRC, /Math\.min\(Math\.max\(parseInt\(opts\.maxRounds\|\|1\)\|\|1,1\),2\)/, '★ 1~2회 캡');
});

test('★ 노출 — Patent.refineConceptDiagram/ByNum/All', () => {
  assert.equal(typeof Patent.refineConceptDiagram, 'function', 'refineConceptDiagram');
  assert.equal(typeof Patent.refineConceptDiagramByNum, 'function', 'refineConceptDiagramByNum');
  assert.equal(typeof Patent.refineAllConceptDiagrams, 'function', 'refineAllConceptDiagrams');
});
