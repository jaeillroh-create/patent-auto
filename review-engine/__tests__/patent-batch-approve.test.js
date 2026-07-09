/**
 * review-engine/__tests__/patent-batch-approve.test.js
 *
 * ★ patent 승인 일괄화 — opinion AC-T1(opinion.js:884) 동일 적용.
 *   증상: 보정 5건 "승인"을 하나 누를 때마다 onChange 가 runReviewEngine(recheck) 즉시 호출 → 매번 "running".
 *   수정: onChange 에서 runReviewEngine(recheck) 제거. 승인=applyAmendments(누적 인메모리)+_persistReviewDecision 만.
 *         재검증은 '출원 전 검증 시작' 버튼(Patent.runReviewEngine)이 명시적 1회 트리거(경로 불변).
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);
const OPINION_SRC = readModuleBundle(REPO, 'opinion');

let Patent, sandbox, realRunReviewEngine;

before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: { id: 'x' } }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: { status: 'running' } }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, currentUser: { id: 'u1', email: 'v@x.com' }, getReviewAuth: () => ({ keys: { claude: 'CK' }, assignments: {} }), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, callClaude: async () => ({ text: '' }) };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, classList: { add() {}, remove() {} } }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, sb, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => true, openModal() {}, openModalMessage() {}, subscribePolling: () => ({ stop() {} }), policy: () => ({ capUsd: 15, maxRounds: 2 }) };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
  Patent = sandbox.window.Patent;
  realRunReviewEngine = Patent.runReviewEngine; // 원본 보존(테스트가 spy 로 덮으므로)
});

test('★1 승인 N회 → runReviewEngine(recheck) 0회 (running 안 뜸) — applyAmendments/persist 는 유지', () => {
  let amend = 0, recheck = 0, persist = 0;
  Patent.applyAmendments = function () { amend++; return { applied: [] }; };
  Patent.runReviewEngine = async function () { recheck++; };   // ★ 호출되면 버그(자동 재검증)
  Patent._persistReviewDecision = function () { persist++; };
  Patent._reviewRunner = function () {};                        // 옛 코드면 이게 있어 recheck 트리거됐음

  const onChange = Patent._reviewModalOpts().onChange;
  for (let n = 1; n <= 5; n++) {                                // 5건 누적 승인
    onChange({ patchPlans: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, accepted: true })) });
  }

  assert.equal(recheck, 0, '★ 승인 5회 → runReviewEngine 0회(자동 재검증 차단)');
  assert.equal(amend, 5, 'applyAmendments 5회(승인마다 누적 인메모리 반영 유지)');
  assert.equal(persist, 5, '_persistReviewDecision 5회(결정 영속 유지)');
});

test('★1 승인 0건(거부만) → applyAmendments 미호출, recheck 0, persist 는 호출', () => {
  let amend = 0, recheck = 0, persist = 0;
  Patent.applyAmendments = function () { amend++; };
  Patent.runReviewEngine = async function () { recheck++; };
  Patent._persistReviewDecision = function () { persist++; };
  Patent._reviewModalOpts().onChange({ patchPlans: [{ id: 'p0', accepted: false }] });
  assert.equal(amend, 0, '승인분 없음 → applyAmendments 0');
  assert.equal(recheck, 0, 'recheck 0');
  assert.equal(persist, 1, '결정 영속은 호출(거부도 결정)');
});

test('★2 명시적 버튼 경로(Patent.runReviewEngine) → 재검증 runner 정확히 1회', async () => {
  // '출원 전 검증 시작' 버튼이 부르는 경로. 게이트 통과 stub 후 runner 1회 발화 확인(경로 불변).
  let runnerCalls = 0;
  const stubRunner = async () => { runnerCalls++; return { issues: [], phase: 'converged' }; };
  Patent.runReviewEngine = realRunReviewEngine; // ★1 테스트가 덮은 spy 복원(실제 트리거 경로 검증)
  Patent._reviewGate = () => ({ ok: true, missing: [] });
  Patent._confirmReviewCost = () => true;
  Patent.exportSnapshot = () => ({ caseId: 'C-PAT' });
  Patent.applyAmendments = function () {};

  await Patent.runReviewEngine(stubRunner, { recheck: true });
  assert.equal(runnerCalls, 1, '★ 명시적 버튼 → 재검증 1회(누적분 일괄)');
});

test('★ 소스 — onChange 에 runReviewEngine 없음 + applyAmendments/persist 유지(opinion AC-T1 형태)', () => {
  const i = PATENT_SRC.indexOf('Patent._reviewModalOpts = function');
  const seg = PATENT_SRC.slice(i, i + 1100);
  assert.ok(/onChange: function\(rs\)/.test(seg), 'onChange 존재');
  // 실제 호출형(runner, { recheck: true })만 매칭 — 주석의 "runReviewEngine(recheck) 제거" 문구는 제외.
  assert.ok(!/runReviewEngine\([^)]*,\s*\{\s*recheck/.test(seg), '★ onChange 에 runReviewEngine(...,{recheck}) 호출 제거됨');
  assert.ok(/Patent\.applyAmendments\(acc\)/.test(seg), 'applyAmendments 유지');
  assert.ok(/Patent\._persistReviewDecision\(rs\)/.test(seg), '_persistReviewDecision 유지');
  assert.ok(/renderPreview\(\)/.test(seg), '승인 후 재렌더(renderPreview) 추가');
  assert.ok(/AC-T1/.test(seg), 'opinion AC-T1 정합 주석');
});

test('★ runReviewEngine(버튼 재검증 경로) 자체는 불변 — 정의 유지', () => {
  assert.match(PATENT_SRC, /Patent\.runReviewEngine\s*=\s*async function/, 'runReviewEngine 정의 유지(명시적 재검증 경로)');
});

test('opinion 회귀 가드 — opinion onChange 는 AC-T1 그대로(자동 recheck 0)', () => {
  // patent 수정이 opinion 패턴과 동일함을 교차확인(둘 다 onChange 에서 자동 재검증 없음).
  const oi = OPINION_SRC.indexOf('Opinion._reviewModalOpts = function');
  const oseg = OPINION_SRC.slice(oi, oi + 900);
  assert.ok(!/runReviewEngine\([^)]*,\s*\{\s*recheck/.test(oseg), 'opinion onChange 도 자동 recheck 호출 없음(AC-T1 불변)');
  assert.ok(/AC-T1/.test(oseg), 'opinion AC-T1 주석 유지');
});
