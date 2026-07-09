/**
 * review-engine/__tests__/patent-vision-analysis.test.js
 *
 * ★ T2 사용자 도면 비전 분석 — Patent.analyzeUserFigure(callVision) 로 구성요소·부호·구조·텍스트 추출.
 *   ★ 정합 방향(변리사 확정): 사용자 도면이 기준 → 도면의 라벨·부호를 그대로 보존 추출(우리 명세서 용어로 안 바꿈).
 *   결과 figData.analysis(JSON) 저장 + 재분석 회피. App.callVision(T1) 의존 — 미탑재 시 안전.
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
    sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus 4.8' }), currentUser: { id: 'u1', email: 'v@x.com' },
    // ★ T1 callVision 스텁 — 호출 캡처 + 응답 주입
    callVision: async (prompt, images, maxTok) => { visionCalls.push({ prompt, images, maxTok }); return visionResp; },
  };
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
  Patent = sandbox.window.Patent;
});

// 비전 응답(★ 도면의 라벨·부호 그대로) — 부호 없는 요소는 signNumber=null
const VISION_JSON = {
  elements: [
    { label: '제어 모듈', signNumber: '210', description: '전체 제어' },
    { label: '센서부', signNumber: null, description: '입력 감지' },
  ],
  structure: [{ from: '210', to: '센서부', relation: '제어' }],
  rawText: '제어 모듈 210 센서부',
  summary: '제어 시스템 블록도',
};
const mkFig = () => ({ num: 5, description: '제어 시스템', fileName: 'c.png', fileDataUrl: 'data:image/png;base64,IMG' });

beforeEach(() => { visionCalls = []; visionResp = { text: JSON.stringify(VISION_JSON) }; });

test('★ analyzeUserFigure — callVision 으로 분석 + figData.analysis 저장(이미지 전달)', async () => {
  const f = mkFig();
  const a = await Patent.analyzeUserFigure(f);
  assert.equal(visionCalls.length, 1, 'callVision 1회 호출');
  assert.deepEqual(visionCalls[0].images, ['data:image/png;base64,IMG'], '★ fileDataUrl 이미지 전달');
  assert.ok(f.analysis, 'figData.analysis 저장');
  assert.equal(a, f.analysis, '반환=저장본');
  assert.equal(f.analysis.elements.length, 2, '구성요소 2');
  assert.equal(f.analysis.structure.length, 1, '구조 1');
  assert.match(f.analysis.rawText, /센서부/, 'rawText');
  assert.ok(f.analysis.analyzedAt, 'analyzedAt 기록');
});

test('★ 사용자 도면 라벨·부호 보존 — 도면 표기 그대로(우리 용어로 안 바꿈)', async () => {
  const f = mkFig();
  await Patent.analyzeUserFigure(f);
  assert.deepEqual(f.analysis.elements[0], { label: '제어 모듈', signNumber: '210', description: '전체 제어' }, '★ 라벨·부호 보존');
  assert.equal(f.analysis.elements[1].signNumber, null, '★ 부호 없으면 null 보존(추측 금지)');
});

test('★ 재분석 회피 — analysis 있으면 callVision 재호출 안 함(저장본 재사용)', async () => {
  const f = mkFig();
  await Patent.analyzeUserFigure(f);
  assert.equal(visionCalls.length, 1);
  const a2 = await Patent.analyzeUserFigure(f);          // 두번째(force 없음)
  assert.equal(visionCalls.length, 1, '★ 재호출 없음(비용 절감)');
  assert.equal(a2, f.analysis, '저장본 반환');
});

test('★ force 재분석 — opts.force 면 다시 호출', async () => {
  const f = mkFig();
  await Patent.analyzeUserFigure(f);
  await Patent.analyzeUserFigure(f, { force: true });
  assert.equal(visionCalls.length, 2, '★ force → 재호출');
});

test('★ fileDataUrl 없으면 분석 안 함(이미지 없는 도면) → null', async () => {
  const f = { num: 2, description: '파일 없는 도면' };
  const a = await Patent.analyzeUserFigure(f);
  assert.equal(a, null, 'null');
  assert.equal(visionCalls.length, 0, 'callVision 미호출');
});

test('★ callVision 미탑재(T1 미배포) → 안전 null', async () => {
  const f = mkFig();
  const orig = App.callVision; App.callVision = undefined;
  try { const a = await Patent.analyzeUserFigure(f); assert.equal(a, null, '★ 비전 미탑재 시 크래시 없이 null'); }
  finally { App.callVision = orig; }
});

test('★ JSON 파싱 실패 → null(analysis 미설정)', async () => {
  const f = mkFig();
  visionResp = { text: '분석 불가 — 일반 텍스트 응답' };
  const a = await Patent.analyzeUserFigure(f);
  assert.equal(a, null, 'null');
  assert.ok(!f.analysis, 'analysis 미설정');
});

test('★ 코드펜스로 감싼 JSON 도 파싱(_parseJSONSafe 재사용)', async () => {
  const f = mkFig();
  visionResp = { text: '```json\n' + JSON.stringify(VISION_JSON) + '\n```' };
  const a = await Patent.analyzeUserFigure(f);
  assert.ok(a && a.elements.length === 2, '코드펜스 JSON 파싱 성공');
});

test('★ 추출 프롬프트 — 사용자 도면 기준·라벨 보존·할루시네이션 금지·순수 JSON', () => {
  const p = Patent._buildFigureAnalysisPrompt({ num: 3, description: '실험 그래프' });
  assert.match(p, /기준 도면/, '사용자 도면이 기준');
  assert.match(p, /라벨·부호를 그대로 보존/, '★ 라벨·부호 보존 지시');
  assert.match(p, /추측해 만들지 마라|할루시네이션 금지/, '할루시네이션 금지');
  assert.match(p, /순수 JSON/, '순수 JSON 출력');
  assert.match(p, /실험 그래프/, '사용자 설명 참고 주입');
});

// ── 소스/노출 ──

test('★ 카드 — 분석 버튼(Patent.analyzeUserFigureByNum) + 분석 상태 배지', () => {
  const i = PATENT_SRC.indexOf('function renderRequiredFiguresList()');
  const seg = PATENT_SRC.slice(i, i + 1400);
  assert.match(seg, /Patent\.analyzeUserFigureByNum\(\$\{f\.num\}/, '★ 카드에 분석 버튼 배선');
  assert.match(seg, /분석 \$\{\(f\.analysis\.elements\|\|\[\]\)\.length\}요소/, '분석 상태 배지');
});

test('★ 노출 — Patent.analyzeUserFigure/ByNum/All + callVision 사용', () => {
  assert.equal(typeof Patent.analyzeUserFigure, 'function', 'analyzeUserFigure');
  assert.equal(typeof Patent.analyzeUserFigureByNum, 'function', 'analyzeUserFigureByNum');
  assert.equal(typeof Patent.analyzeAllUserFigures, 'function', 'analyzeAllUserFigures(일괄)');
  assert.match(PATENT_SRC, /await App\.callVision\(prompt,\[figData\.fileDataUrl\],4096\)/, '★ callVision(T1) 사용');
});
