/**
 * review-engine/__tests__/d2b-rewrite-gates.test.js
 * D2b — 재작성 보류본(_pendingRewrite)에 검증 게이트 재실행(부수효과 방어).
 *  - ★ 비대상 불변(splice 무결성) 게이트(신규, CRITICAL) → 위반 시 확정 차단
 *  - 기존 게이트 재사용: _validateSpecBasis / _validateClaimPreservation / _validateClaimReferences (경고)
 *  - 게이트 결과 _pendingRewrite.gates 첨부, draftResult 불변
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
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
  const App = {
    sb, currentUser: { id: 'u1', email: 'u@x.com' },
    callClaude: async (prompt) => {
      cap.claudeCalls++;
      const m = String(prompt).match(/대상 청구항 (\d+) —/);
      const no = m ? Number(m[1]) : 0;
      return { text: JSON.stringify({ claim_no: no, amended: 'REWRITTEN-' + no, spec_basis: ['【0035】'], amendments_summary: 's' }) };
    },
  };
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
  Opinion.usage = Opinion.usage || { calls: 0 };
  Opinion.updateUsageDisplay = function () {};
}

beforeEach(() => { load(); });

const SPEC = '명세서 본문 【0001】 도입 【0002】 구성 【0035】 냉각 유로가 배치된다. '.repeat(4); // 0001/0002/0035 포함, >50자
const baseline = () => ({ amended_claims: [
  { claim_no: 1, amended: 'A1', spec_basis: ['【0001】'] },
  { claim_no: 2, amended: 'A2', spec_basis: ['【0002】'] },
  { claim_no: 5, amended: 'A5', spec_basis: ['【0035】'] },
] });

// ═══ 비대상 불변 게이트(신규, CRITICAL) ═══
test('★ 비대상 불변 통과 — 대상(5)만 변경 → canConfirm true', () => {
  const pending = baseline(); pending.amended_claims[2].amended = 'NEW5';
  const g = Opinion._gatePendingRewrite(pending, baseline(), { targetClaimNos: [5], specText: SPEC, parsedClaims: [], rejectedNos: [] });
  assert.equal(g.invariance.ok, true, '비대상 1·2 불변');
  assert.deepEqual(g.blockers, [], '차단 없음');
  assert.equal(g.canConfirm, true);
});

test('★ 비대상 변경 감지 → CRITICAL 차단(canConfirm false)', () => {
  const pending = baseline();
  pending.amended_claims[0].amended = 'A1-DRIFT'; // 비대상 claim 1 변경(있어선 안 됨)
  pending.amended_claims[2].amended = 'NEW5';
  const g = Opinion._gatePendingRewrite(pending, baseline(), { targetClaimNos: [5], specText: SPEC, parsedClaims: [], rejectedNos: [] });
  assert.equal(g.invariance.ok, false, '비대상 drift 감지');
  assert.equal(g.invariance.drift[0].claim_no, 1, 'claim 1 drift');
  assert.deepEqual(g.blockers, ['non_target_invariance'], '★ CRITICAL 차단 사유');
  assert.equal(g.canConfirm, false, '★ 확정 차단');
});

test('★ 비대상 누락 감지 → 차단', () => {
  const pending = { amended_claims: [{ claim_no: 5, amended: 'NEW5', spec_basis: ['【0035】'] }] }; // 1·2 누락
  const g = Opinion._gatePendingRewrite(pending, baseline(), { targetClaimNos: [5], specText: SPEC, parsedClaims: [], rejectedNos: [] });
  assert.equal(g.invariance.ok, false, '비대상 누락 감지');
  assert.equal(g.canConfirm, false);
});

// ═══ 기존 게이트 재사용(경고 — 차단 안 함, 변리사 판단) ═══
test('spec_basis 위반은 경고(차단 X) — 변리사 판단 여지', () => {
  const pending = baseline(); pending.amended_claims[2].amended = 'NEW5'; pending.amended_claims[2].spec_basis = ['【9999】']; // 명세서에 없음
  const g = Opinion._gatePendingRewrite(pending, baseline(), { targetClaimNos: [5], specText: SPEC, parsedClaims: [], rejectedNos: [] });
  assert.equal(g.specBasis.ok, false, '【9999】 명세서에 없음 → fail');
  assert.ok(g.warnings.indexOf('spec_basis') >= 0, '경고에 spec_basis');
  assert.equal(g.canConfirm, true, '★ 경고는 차단 안 함(invariance OK라 확정 가능)');
});

test('references 위반은 경고(차단 X)', () => {
  const pending = baseline();
  pending.amended_claims[2].amended = '제99항에 있어서, 추가 구성을 포함하는 장치.'; // 없는 청구항 99 인용
  const g = Opinion._gatePendingRewrite(pending, baseline(), { targetClaimNos: [5], specText: SPEC, parsedClaims: [], rejectedNos: [] });
  assert.equal(g.references.ok, false, '청구항 99 미존재 → 참조 오류');
  assert.ok(g.warnings.indexOf('references') >= 0, '경고에 references');
  assert.equal(g.canConfirm, true, '경고는 차단 안 함');
});

// ═══ 통합 — applyDirectionRewrite 후 게이트 첨부 + draftResult 불변 ═══
test('★ 통합: 재작성 후 게이트 _pendingRewrite 첨부 + canConfirm + draftResult 불변', async () => {
  Opinion.extractSpecificationText = async () => SPEC;
  Opinion.state = Object.assign(Opinion.state, {
    current: { id: 'proj-1' },
    draftResult: { amended_claims: [
      { claim_no: 1, original: 'O1', amended: 'A1', spec_basis: ['【0001】'] },
      { claim_no: 2, original: 'O2', amended: 'A2', spec_basis: ['【0002】'] },
      { claim_no: 5, original: 'O5', amended: 'A5', spec_basis: ['【0035】'],
        review_amendments: [{ op: 'add_limitation', direction: '청구항 5에 냉각 유로 부가', planId: 'p1' }] },
    ] },
    _pendingRewrite: null,
  });
  const before = JSON.stringify(Opinion.state.draftResult);
  const pend = await Opinion.applyDirectionRewrite();
  assert.ok(pend && pend.gates, '★ gates 첨부');
  assert.equal(pend.gates.invariance.ok, true, '★ splice 무결성 통과(비대상 1·2 불변)');
  assert.equal(pend.gates.canConfirm, true, '확정 가능');
  assert.deepEqual(pend.gates.warnings, [], 'spec_basis(0001/0002/0035 존재)·references 정상 → 경고 0');
  assert.equal(JSON.stringify(Opinion.state.draftResult), before, '★ 게이트는 read-only — draftResult 불변');
});
