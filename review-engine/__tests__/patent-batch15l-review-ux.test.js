/**
 * review-engine/__tests__/patent-batch15l-review-ux.test.js
 * ★ 배치 15L — 검토 UX 재구성(오해 구조 제거).
 *   1 진단/재작성 물리 분리(명세서 진단 AI / 본문만 재생성) · 2 진단→재작성 연결(REVIEW_NOTES 주입) ·
 *   3 진단 결과 없을 때 비활성 · 4 ⑤ 패널 결함 성격별 분기 안내.
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

let sandbox; const els = {}; let toasts = [];
const mkEl = () => ({ value: '', checked: false, disabled: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', title: '', getAttribute: () => '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', safeMaxTokensLarge: () => 16000, escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {}, updateStats() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast: (m, t) => toasts.push({ m, t }), escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, updateStats() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true, API_KEY: 'stub',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); toasts = []; run('clearAllState();'); });

// ─────────────── 1) 진단/재작성 물리 분리 ───────────────

test('15L-1 ★ HTML — ④ 진단 카드 개명(명세서 진단 AI) + 문서 불변 + 중복 재생성 버튼 제거', () => {
  assert.match(HTML_SRC, /명세서 진단 \(AI\)/, '★ 카드 제목 개명');
  assert.match(HTML_SRC, /명세서 진단\(AI\)만 실행/, '★ 진단만 보조 버튼(배치18-5)');
  assert.match(HTML_SRC, /id="wfDiagnoseCard"[\s\S]{0,600}문서는 변경되지 않습니다/, '★ 문서 불변 명시');
  // 진단 카드에서 "검토 반영 = ④ 본문 통합 재생성" 중복 재생성 버튼 제거(재작성 진입점 1개)
  assert.ok(!/검토 반영 = ④ 본문 통합 재생성/.test(HTML_SRC), '★ 중복 재생성 버튼 제거');
});

test('15L-1/16-3 ★ HTML — 재작성 진입점은 통합 버튼 1개(btnWfRewriteFixes), 구 버튼 제거', () => {
  const p3 = HTML_SRC.slice(HTML_SRC.indexOf('id="page3"'), HTML_SRC.indexOf('id="page4"'));
  assert.equal((p3.match(/onclick="wfDiagnoseAndRewrite\(\)"/g) || []).length, 1, '★ 통합 재작성 진입점 1개(배치18-5: 진단+반영 단일 버튼)');
  assert.ok(!/id="btnWfStage4"/.test(p3) && !/id="btnRewriteWithReview"/.test(p3), '★ 구 버튼(본문만 재생성·반영해 다시쓰기) 제거');
});

// ─────────────── 2,3) 진단 결과 → 통합 버튼 자동 반영 ───────────────

test('16-3 ★ HTML — 진단 결과는 왼쪽 통합 버튼이 자동 반영(별도 재작성 버튼 없음)', () => {
  assert.ok(!/id="btnRewriteWithReview"/.test(HTML_SRC), '★ 진단 결과 카드의 별도 재작성 버튼 제거');
  assert.match(HTML_SRC, /진단 후 결함 반영해 다시 쓰기/, '★ 통합 버튼 라벨(배치18-5)');
  assert.match(HTML_SRC, /버튼이 기계검증 결함과 함께 자동 반영/, '★ 안내: 통합 버튼이 진단+기계검증 반영');
});

test('16-3 ★ 동작 — _updateRewriteBtn: 골격(step_06) 있으면 활성 + 반영 대상 카운트', () => {
  els.btnWfRewriteFixes = mkEl(); els.wfRewriteTargetLabel = mkEl();
  run('clearAllState(); delete outputs.step_06;');
  run('_updateRewriteBtn()');
  assert.strictEqual(els.btnWfRewriteFixes.disabled, true, '★ 골격 없으면 비활성');
  run('outputs.step_06="【청구항 1】 제어부.";');
  run('_updateRewriteBtn()');
  assert.strictEqual(els.btnWfRewriteFixes.disabled, false, '★ 골격 있으면 활성');
  // ★ [배치20-6 갱신] 라벨 문구 교체 — "직전 진단 1건" 오독 제거, 반영 대상 풀어쓰기.
  assert.match(els.wfRewriteTargetLabel.textContent, /반영 대상: 기계검증 결함 \d+건/, '★ 반영 대상 라벨(진단은 버튼이 실행 — 배치18-5/20-6)');
});

test('15L-2 ★ 동작 — _pendingReviewNotes 있으면 cohesion 프롬프트에 REVIEW_NOTES 주입', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버";');
  run('_pendingReviewNotes="[특허성] 진보성 미흡 — REVIEW_MARK_XYZ 구성을 보강하라";');
  const p = run("buildPrompt('unified_cohesion')") || '';
  assert.match(p, /<<<REVIEW_NOTES>>>/, '★ REVIEW_NOTES 블록');
  assert.match(p, /REVIEW_MARK_XYZ/, '★ 진단 지적 주입');
  assert.match(p, /지적사항을 이번 재작성에서 반드시 해소/, '★ 해소 지시');
  assert.match(p, /지적과 무관한 나머지 구조·용어·참조번호는 그대로 유지/, '★ 나머지 유지 지시');
});

test('15L-2 ★ 동작 — _pendingReviewNotes 없으면 REVIEW_NOTES 미주입', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버"; _pendingReviewNotes="";');
  const p = run("buildPrompt('unified_cohesion')") || '';
  assert.ok(!/<<<REVIEW_NOTES>>>/.test(p), '★ 미주입(주입 대기값 없음)');
});

test('16-3 ★ 소스 — wfRewriteWithReview 는 wfRewriteWithFixes 별칭(하위호환)', () => {
  assert.match(PATENT_SRC, /async function wfRewriteWithReview\(\)\{ return wfRewriteWithFixes\(\); \}/, '★ 별칭');
  assert.match(PATENT_SRC, /function _updateRewriteWithReviewBtn\(\)\{ return _updateRewriteBtn\(\); \}/, '★ 갱신 함수 별칭');
});

// ─────────────── 4) ⑤ 패널 결함 성격별 분기 ───────────────

test('15L-4 ★ 동작 — ⑤ 검증 패널: 구조 결함 → 본문만 재생성 / 내용 결함 → 진단→반영 분기 안내', () => {
  els.specValidateResult = mkEl();
  // 내용 결함(claim_support_missing) 포함 상태 모사 — buildSpecification 이 청구항 뒷받침 부재를 유발
  run(`clearAllState(); selectedTitle="t"; outputs={ step_06:"【청구항 1】 신규구성부를 포함하는 장치.", step_08:"도 1을 참조하면, 제어부(100)가 동작한다.", step_18:"제어부 : 100" };`);
  run('renderSpecValidation()');
  const h = els.specValidateResult.innerHTML || '';
  assert.match(h, /결함 성격에 따라 재작성 경로가 다릅니다/, '★ 분기 안내 헤더');
  assert.match(h, /id="btnGoStage4FromValidate" onclick="switchTab\(3\)"/, '★ ④ 이동 버튼');
});

test('15L-4/16-5 ★ 소스 — 구조/내용 결함 분기 카운트·문구(통합 버튼)', () => {
  assert.match(PATENT_SRC, /const _contentN=iss\.filter\(i=>i\.check==='claim_support_missing'\)\.length;/, '★ 내용 결함 카운트');
  assert.match(PATENT_SRC, /const _structN=iss\.length-_contentN;/, '★ 구조 결함 카운트');
  assert.match(PATENT_SRC, /구조 결함[\s\S]{0,120}결함 반영해 본문 다시 쓰기/, '★ 구조→결함 반영 재작성');
  assert.match(PATENT_SRC, /내용 결함[\s\S]{0,160}명세서 진단\(AI\)/, '★ 내용→진단→반영');
});

// ─────────────── 소스 배선 ───────────────

test('15L/16 소스 ★ — REVIEW_NOTES 주입·switchTab·진단 완료 훅(별칭 유지)', () => {
  assert.match(PATENT_SRC, /const _reviewInject=_reviewNotes\?/, '★ cohesion REVIEW_NOTES 주입 계산');
  assert.match(PATENT_SRC, /if\(i===3&&typeof _updateRewriteWithReviewBtn==='function'\)_updateRewriteWithReviewBtn\(\);/, '★ switchTab(④) 훅(별칭)');
  assert.match(PATENT_SRC, /if\(sid==='step_13'\)\{ try\{ if\(typeof _updateRewriteWithReviewBtn/, '★ 진단 완료 훅(별칭)');
  assert.match(PATENT_SRC, /async function wfRewriteWithReview\(\)\{ return wfRewriteWithFixes\(\); \}/, '★ wfRewriteWithReview 별칭');
});
