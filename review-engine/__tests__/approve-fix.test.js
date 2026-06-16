/**
 * review-engine/__tests__/approve-fix.test.js
 * AC-T1 승인 타임아웃 버그 — onChange 가 자동 풀 재검증(runReviewEngine recheck)을 부르지 않고
 * 빠른 결정 영속(review_runs.result UPDATE)만 하는지 검증.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, cap;

before(() => {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  cap = { update: null, runReviewEngineCalls: 0, applyCalls: [] };
  const sb = {
    from: () => ({ update: (patch) => { cap.update = patch; return { eq: (col, val) => { cap.updateEq = { col, val }; return Promise.resolve({}); } }; } }),
    functions: { invoke: async () => ({ data: null }) },
  };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App: { sb, currentUser: { id: 'u1', email: 'u@x.com' } },
    ReviewUI: { isEnabled: () => true },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
  // 스파이: 승인이 재검증을 부르면 카운트(부르면 안 됨), applyAmendments 캡처.
  Opinion.runReviewEngine = async function() { cap.runReviewEngineCalls++; return null; };
  Opinion.applyAmendments = function(plans) { cap.applyCalls.push(plans); };
});

beforeEach(() => {
  cap.update = null; cap.updateEq = null; cap.runReviewEngineCalls = 0; cap.applyCalls = [];
  Opinion.state = Object.assign(Opinion.state || {}, { reviewRunId: 'run-1', reviewState: null });
  Opinion._reviewRunner = async () => ({});
});

test('★ 승인 → applyAmendments(승인분) 호출, runReviewEngine 미호출(풀 재검증 0)', () => {
  const rs = { patchPlans: [{ id: 'plan_1', accepted: true, ops: [] }] };
  Opinion._reviewModalOpts().onChange(rs);
  assert.equal(cap.runReviewEngineCalls, 0, '★ 자동 재검증 안 부름(타임아웃 버그 제거)');
  assert.equal(cap.applyCalls.length, 1, 'applyAmendments 호출');
  assert.deepEqual(cap.applyCalls[0], [{ id: 'plan_1', accepted: true, ops: [] }], '승인분만');
});

test('★ 거부 → applyAmendments 미호출(승인분 없음), runReviewEngine 미호출', () => {
  const rs = { patchPlans: [{ id: 'plan_1', accepted: false, ops: [] }] };
  Opinion._reviewModalOpts().onChange(rs);
  assert.equal(cap.runReviewEngineCalls, 0, '재검증 안 부름');
  assert.equal(cap.applyCalls.length, 0, '거부는 applyAmendments 안 함');
});

test('★ 결정 빠른 영속 — review_runs.result UPDATE (풀 재검증 아님)', () => {
  const rs = { patchPlans: [{ id: 'plan_1', accepted: true, ops: [] }], issues: [{ id: 'x' }] };
  Opinion._reviewModalOpts().onChange(rs);
  assert.ok(cap.update && cap.update.result, 'review_runs.result UPDATE');
  assert.deepEqual(cap.update.result, rs, 'result = 결정 반영된 reviewState');
  assert.ok(cap.update.updated_at, 'updated_at 갱신');
  assert.deepEqual(cap.updateEq, { col: 'id', val: 'run-1' }, 'id 기준 UPDATE');
});

test('reviewRunId 없으면(동기 폴백) 영속 생략 — 로컬 상태만, throw 0', () => {
  Opinion.state.reviewRunId = null;
  const rs = { patchPlans: [{ id: 'plan_1', accepted: true, ops: [] }] };
  Opinion._reviewModalOpts().onChange(rs);
  assert.equal(cap.update, null, 'run id 없으면 UPDATE 안 함');
  assert.equal(cap.runReviewEngineCalls, 0, '재검증도 안 부름');
});

test('재검증은 명시적 — runReviewEngine 자체는 그대로 존재(버튼 경유 호출 가능)', () => {
  assert.equal(typeof Opinion.runReviewEngine, 'function', 'runReviewEngine 불변(명시적 재검증 경로 유지)');
});
