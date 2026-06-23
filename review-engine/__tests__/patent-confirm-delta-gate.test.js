/**
 * review-engine/__tests__/patent-confirm-delta-gate.test.js
 *
 * ★ patent [확정] 비활성 — E-11 게이트 절대→delta 전환.
 *   원인: _reviewRenderCheck 가 상세설명을 안 읽고 도면(step_07/11_mermaid)↔부호의설명(step_18)만 절대 비교 →
 *         명세서에 원래 있던 도면↔부호 불일치가 무해한 add_spec_support APPEND(도면·부호 불변)까지 차단(과차단).
 *   수정: Patent._reviewDeltaGate(before, after) — 보정 전/후 missing 을 비교해 "이 보정이 새로 유발한 불일치(newMissing)"
 *         만 차단. 기존 불일치(preexistingMissing)는 비차단(경고). APPEND 는 before==after → canConfirm=true.
 *         도면/청구항을 바꾸는 미래 op 가 정합을 깨면 newMissing 발생 → canConfirm=false(regression 차단 유지).
 *   + 메시징 교정(기존 불일치 = 비차단 경고) + 승인→반영 흐름 안내(onChange 1회 토스트).
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');
const OPINION_SRC = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');

let Patent, sandbox, toasts;

before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: { id: 'x' } }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  toasts = [];
  const App = { sb, currentUser: { id: 'u1', email: 'v@x.com' }, showToast: (m, t) => { toasts.push({ m: String(m), t }); }, showScreen() {}, showProgress() {}, clearProgress() {}, escapeHtml: (s) => String(s == null ? '' : s), callClaude: async () => ({ text: 'X' }) };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error, structuredClone: globalThis.structuredClone,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, classList: { add() {}, remove() {} } }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, sb, showToast: (m, t) => { toasts.push({ m: String(m), t }); }, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => true, openModal() {}, openModalMessage() {}, subscribePolling: () => ({ stop() {} }), policy: () => ({ capUsd: 15, maxRounds: 2 }) };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
  Patent = sandbox.window.Patent;
});

const setOutputs = (obj) => vm.runInContext('Object.keys(outputs).forEach(function(k){delete outputs[k];}); Object.assign(outputs,' + JSON.stringify(obj) + ');', sandbox, { filename: 'set.js' });

beforeEach(() => {
  Patent._pendingPatentRewrite = null;
  Patent._reflectHintShown = false;
  sandbox.window.__patentReviewState = null;
  setOutputs({});
  toasts.length = 0;
  Patent._genSpecSupportParagraph = async (dir) => '본 실시예에서 ' + (dir && dir.target) + ' 의 동작원리를 구체적으로 기술한다.';
});

// ── _reviewDeltaGate 단위 — 두 분기(delta 0 통과 / 신규 누락 차단) ──

test('★ _reviewDeltaGate — before==after(변화 없음) → canConfirm=true', () => {
  const g = Patent._reviewDeltaGate({ step_18: '100: 장치' }, { step_18: '100: 장치' });
  assert.equal(g.canConfirm, true);
  assert.deepEqual(g.newMissing, []);
});

test('★ _reviewDeltaGate — 기존 불일치(99) before/after 동일 → delta 0 → canConfirm=true(기존은 preexisting)', () => {
  const ba = { step_07_mermaid: 'A(99)', step_18: '100: 장치' };   // 99 도면에 있으나 부호의설명에 없음
  const g = Patent._reviewDeltaGate(ba, ba);
  assert.equal(g.canConfirm, true, '★ 기존 불일치는 차단하지 않음(볼모 방지)');
  assert.deepEqual(g.newMissing, [], '새 누락 없음');
  assert.ok(g.preexistingMissing.indexOf('99') >= 0, '기존 불일치는 preexistingMissing 으로');
});

test('★ _reviewDeltaGate — 보정이 새 부호(88) 유발(before엔 없음) → canConfirm=false(regression)', () => {
  const beforeO = { step_18: '100: 장치' };                       // 도면 없음 → missing 없음
  const afterO = { step_07_mermaid: 'A(88)', step_18: '100: 장치' }; // 88 새 도면부호, 부호의설명에 없음
  const g = Patent._reviewDeltaGate(beforeO, afterO);
  assert.equal(g.canConfirm, false, '★ 새 불일치 → 차단(regression 유지)');
  assert.ok(g.newMissing.indexOf('88') >= 0, 'newMissing 에 88');
});

// ── 통합: applyDirectionRewrite(add_spec_support) 는 기존 불일치와 무관하게 항상 통과 ──

test('★ 통합 — 기존 도면↔부호 불일치(99) 있어도 add_spec_support APPEND → canConfirm=true', async () => {
  setOutputs({
    step_08: '도 1을 참조하면 장치(100)를 포함한다.', step_18: '100: 장치',
    step_07_mermaid: 'graph TD; A[장치(100)] --> Z[미정의(99)]',
    _review_applied: [{ op: 'add_spec_support', target: 'claim_2', direction: '가중부 보강', planId: 'p1' }],
  });
  const rw = await Patent.applyDirectionRewrite();
  assert.equal(rw.canConfirm, true, '★ [확정] 활성(기존 불일치 99로 차단 안 됨)');
  assert.deepEqual(rw.renderCheck.missing, [], '이 보정이 만든 새 누락 0');
  assert.ok(rw.renderCheck.preexistingMissing.indexOf('99') >= 0, '99 는 기존(경고)으로 분리');
});

// ── 배너 메시징(★2) ──

test('★ 배너 — 기존 불일치는 "무관한 기존" 비차단 경고(확정 가능)', () => {
  const pend = { canConfirm: true, appended: [{ planId: 'p1', target: 'claim_2', section: 'step_08', paragraph: 'P' }],
    before: { step_08: 'base' }, renderCheck: { missing: [], preexistingMissing: ['99'] } };
  const html = Patent._buildPatentRewriteDiffHtml(pend);
  assert.match(html, /무관한 기존/, '★ 기존 불일치 = "무관한 기존" 명시(추가 단락 부호로 오해 방지)');
  assert.match(html, /확정 가능/, '비차단(확정 가능)');
  assert.match(html, /99/, '기존 불일치 부호');
});

test('★ 배너 — regression(새 불일치) 은 차단 배너', () => {
  const pend = { canConfirm: false, appended: [{ planId: 'p1', target: 'claim_2', section: 'step_08', paragraph: 'P' }],
    before: { step_08: 'base' }, renderCheck: { missing: ['88'], preexistingMissing: [] } };
  const html = Patent._buildPatentRewriteDiffHtml(pend);
  assert.match(html, /확정 불가/, '차단');
  assert.match(html, /88/, '새 불일치 부호');
});

// ── 승인→반영 흐름 안내(★3) ──

test('★ 흐름 안내 — 승인된 add_spec_support 있으면 onChange 가 [반영하기] 안내 토스트(1회)', () => {
  sandbox.window.__patentReviewState = {
    issues: [{ id: 'exB-1', description: '뒷받침 부재' }],
    patchPlans: [{ id: 'plan_1', accepted: true, addressesIssues: ['exB-1'], ops: [{ op: 'add_spec_support', target: 'claim_2', content: '보강' }] }],
  };
  const rs = sandbox.window.__patentReviewState;
  const onChange = Patent._reviewModalOpts().onChange;
  onChange(rs);
  const hints = toasts.filter((t) => /산출물|반영하기/.test(t.m));
  assert.equal(hints.length, 1, '★ 안내 토스트 1회');
  onChange(rs);   // 두 번째 승인 클릭
  const hints2 = toasts.filter((t) => /산출물|반영하기/.test(t.m));
  assert.equal(hints2.length, 1, '★ 중복 안내 없음(1회만)');
});

test('★ 흐름 안내 — 승인 add_spec_support 없으면 안내 토스트 없음', () => {
  sandbox.window.__patentReviewState = { issues: [], patchPlans: [{ id: 'plan_1', accepted: false, ops: [{ op: 'add_spec_support', target: 'claim_2', content: 'x' }] }] };
  Patent._reviewModalOpts().onChange(sandbox.window.__patentReviewState);
  assert.equal(toasts.filter((t) => /산출물|반영하기/.test(t.m)).length, 0, '미승인 → 안내 없음');
});

// ── 소스 정합 ──

test('★ 소스 — delta 게이트 정의 + applyDirectionRewrite 사용 + 새검증 시 안내 리셋', () => {
  assert.match(PATENT_SRC, /Patent\._reviewDeltaGate = function\(beforeO, afterO\)/, '_reviewDeltaGate 정의');
  assert.match(PATENT_SRC, /newMissing = after\.filter\(function\(r\)\{ return before\.indexOf\(r\) < 0/, '★ newMissing = after − before(delta)');
  assert.match(PATENT_SRC, /var gate = Patent\._reviewDeltaGate\(/, 'applyDirectionRewrite 가 delta 게이트 사용');
  assert.match(PATENT_SRC, /preexistingMissing: gate\.preexistingMissing/, '기존 불일치 분리 보관');
  assert.match(PATENT_SRC, /Patent\._reflectHintShown = false;/, '새 검증 시 안내 1회 리셋');
});

test('opinion 회귀 0 — opinion D2(applyDirectionRewrite/confirmRewrite) 불변', () => {
  assert.match(OPINION_SRC, /Opinion\.applyDirectionRewrite\s*=/, 'opinion D2a 유지');
  assert.match(OPINION_SRC, /Opinion\.confirmRewrite\s*=/, 'opinion D2c 유지');
});
