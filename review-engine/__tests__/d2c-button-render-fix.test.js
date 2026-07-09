/**
 * review-engine/__tests__/d2c-button-render-fix.test.js
 * D2c 버튼 화면 미표시 수정 — ★1 승인 후 재렌더(onChange→renderDetail) + ★2 버튼 상시 렌더 +
 * ★2차 op.content(방향) 유입 확인. AC-T1(풀 재검증 0) 보존.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { compile, _resetSeq } from '../kernel/amendmentCompiler.js';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, cap;

function load() {
  const src = readModuleBundle(REPO, 'opinion');
  cap = { claudeCalls: 0 };
  const sb = {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x' } }) }) }),
      update: () => ({ eq: () => Promise.resolve({}) }),
    }),
    functions: { invoke: async () => ({ data: null }) },
  };
  const App = { sb, currentUser: { id: 'u1', email: 'u@x.com' }, callClaude: async () => { cap.claudeCalls++; return { text: '{}' }; } };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
  Opinion.usage = Opinion.usage || { calls: 0 }; Opinion.updateUsageDisplay = function () {};
}
beforeEach(() => { load(); });

// ═══ ★1 승인 후 재렌더 + AC-T1 ═══
test('★1 승인(onChange) → renderDetail 재렌더 1회 + AC-T1(runReviewEngine 0) + 방향 기록', () => {
  let renderCalls = 0, reviewCalls = 0;
  Opinion.renderDetail = function () { renderCalls++; };
  Opinion.runReviewEngine = async function () { reviewCalls++; };
  Opinion.state = Object.assign(Opinion.state, {
    current: { id: 'p1' },
    draftResult: { amended_claims: [{ claim_no: 1, original: 'o', amended: 'a1' }] },
    parsed: { claims: [{ no: 1, text: 'a1' }], rejection_reasons: [{ claim_nos: [1] }] }, refText: '',
  });
  const opts = Opinion._reviewModalOpts();
  const plan = { id: 'plan_1', accepted: true, addressesIssues: ['exA-1'], ops: [{ op: 'add_limitation', target: 'claim_1', content: '청구항 1에 냉각 유로 부가', reason: 'exA-1' }] };
  opts.onChange({ patchPlans: [plan] });
  assert.equal(renderCalls, 1, '★ 승인 후 renderDetail 1회(끊겼던 재렌더 트리거 연결)');
  assert.equal(reviewCalls, 0, '★ AC-T1 보존: runReviewEngine(풀 재검증) 0');
  assert.equal(Opinion.state.draftResult.amended_claims[0].review_amendments[0].direction, '청구항 1에 냉각 유로 부가', 'op.content → review_amendments.direction 기록');
});

test('★1 거부만(승인 0) 이어도 재렌더는 수행(상태 갱신)', () => {
  let renderCalls = 0;
  Opinion.renderDetail = function () { renderCalls++; };
  Opinion.state = Object.assign(Opinion.state, { current: { id: 'p1' }, draftResult: { amended_claims: [] }, parsed: { claims: [] } });
  Opinion._reviewModalOpts().onChange({ patchPlans: [{ id: 'p1', accepted: false, ops: [] }] });
  assert.equal(renderCalls, 1, '승인 0이어도 onChange 끝에 renderDetail(조건부 UI 갱신)');
});

// ═══ ★2 버튼 상시 렌더 (source) ═══
test('★2 버튼 상시 렌더 — btnDirectionRewrite 무조건 concat, 구 조건부 제거', () => {
  const src = readModuleBundle(REPO, 'opinion');
  assert.match(src, /\+'<button class="btn btn-outline btn-full" id="btnDirectionRewrite"[^\n]*?Opinion\.startDirectionRewrite\(\)/, '버튼 무조건 렌더(상시)');
  assert.ok(!src.includes('_collectApprovedDirections(Opinion.state.draftResult||{}).length'), '★ 구 조건부(_collectApprovedDirections().length ?) 제거 — 렌더 타이밍 의존 제거');
});

// ═══ ★2차 op.content(방향) 유입 — 컴파일러 ═══
test('★2차 op.content = issue.amendmentDirection (방향 유입 정상)', () => {
  _resetSeq();
  const allowed = [{ op: 'add_limitation' }];
  const p1 = compile({ id: 'exA-1', target: ['claim_1'], suggestedOp: 'add_limitation', amendmentDirection: '명세서 【0098】 냉각 유로 부가 방향' }, allowed, [], {});
  assert.equal(p1.ops[0].content, '명세서 【0098】 냉각 유로 부가 방향', '★ amendmentDirection → op.content(클라 applyAmendments 가 review_amendments.direction 으로 기록)');
  const p2 = compile({ id: 'exA-2', target: ['claim_1'], suggestedOp: 'add_limitation' }, allowed, [], {});
  assert.equal(p2.ops[0].content, '', '방향 없으면(순수 rebut) content 빈 문자열 — 정상(반영할 방향 없음)');
});

// ═══ 빈 방향 가드 (상시 버튼 안전성) ═══
test('빈 방향 가드 — 승인 방향 없으면 applyDirectionRewrite null(버튼 눌러도 안전)', async () => {
  Opinion.state = Object.assign(Opinion.state, { current: { id: 'p1' }, draftResult: { amended_claims: [{ claim_no: 1, amended: 'a1' }] }, _pendingRewrite: null });
  const r = await Opinion.applyDirectionRewrite();
  assert.equal(r, null, '승인 방향 없음 → null(가드)');
  assert.equal(Opinion.state._pendingRewrite, null, '보류 안 만듦');
  assert.equal(cap.claudeCalls, 0, 'LLM 호출 0(가드에서 조기 반환)');
});
