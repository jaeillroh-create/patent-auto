/**
 * review-engine/__tests__/d2c-confirm-ui.test.js
 * D2c — 비교 확정 UI(사람 방어선). 화면 배선의 핵심 로직(확정/취소/diff)을 vm 샌드박스로 검증.
 *  - ★ 확정 전 draftResult 불변(보류 유지) → 확정 시에만 커밋
 *  - ★ CRITICAL(canConfirm=false) 확정 차단, 경고는 override 가능
 *  - 취소 → 폐기·draftResult 불변, review_amendments "반영됨" 마킹, 보정서 자동 반영(ac.amended)
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, cap;

function load() {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
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
  Opinion.renderDetail = function () {};
}
beforeEach(() => { load(); });

// OLD(라이브) + PENDING(보류본: claim 5 재작성) 픽스처. canConfirm/warnings 주입.
function setup(canConfirm, warnings) {
  const OLD = { amended_claims: [
    { claim_no: 1, original: 'O1', amended: 'A1', spec_basis: ['【0001】'] },
    { claim_no: 2, original: 'O2', amended: 'A2', spec_basis: ['【0002】'] },
    { claim_no: 5, original: 'O5', amended: 'A5', spec_basis: ['【0005】'], review_amendments: [{ op: 'add_limitation', direction: '청구항 5에 냉각 유로 부가', planId: 'p1' }] },
  ] };
  const PENDING = structuredClone(OLD);
  PENDING.amended_claims[2].amended = 'NEW5'; PENDING.amended_claims[2]._d2_rewritten = true;
  Opinion.state = Object.assign(Opinion.state, {
    current: { id: 'proj-1', rejection_type: 'inventive_step' },
    draftResult: OLD,
    _pendingRewrite: {
      draftResult: PENDING, targetClaimNos: [5], before: { '5': 'A5' }, after: { '5': 'NEW5' },
      gates: { canConfirm: canConfirm, blockers: canConfirm ? [] : ['non_target_invariance'], warnings: warnings || [] }, createdAt: 'now',
    },
  });
  return { OLD, PENDING };
}

test('★ confirmRewrite 커밋 — 보류본 → draftResult, review_amendments 반영됨 마킹, 보류 해제', async () => {
  const { OLD, PENDING } = setup(true, []);
  const ok = await Opinion.confirmRewrite();
  assert.equal(ok, true, '확정 성공');
  assert.strictEqual(Opinion.state.draftResult, PENDING, '★ draftResult = 보류본 커밋');
  assert.equal(Opinion.state.draftResult.amended_claims[2].amended, 'NEW5', '보정 후 문언 반영(보정서 자동반영 토대)');
  assert.equal(Opinion.state.draftResult.amended_claims[2].review_amendments[0].applied, true, '★ 반영됨 마킹');
  assert.equal(Opinion.state._pendingRewrite, null, '보류 해제');
  assert.equal(OLD.amended_claims[2].amended, 'A5', 'OLD(직전) 객체 불변');
});

test('★ CRITICAL(canConfirm=false) → 확정 차단, draftResult·보류 불변', async () => {
  setup(false, []);
  const oldRef = Opinion.state.draftResult, oldPend = Opinion.state._pendingRewrite;
  const ok = await Opinion.confirmRewrite();
  assert.equal(ok, false, '★ CRITICAL → 확정 거부');
  assert.strictEqual(Opinion.state.draftResult, oldRef, '★ draftResult 불변(커밋 안 함)');
  assert.strictEqual(Opinion.state._pendingRewrite, oldPend, '보류 유지(폐기 안 함)');
});

test('★ 경고(warnings)는 override — canConfirm true 면 확정 가능', async () => {
  setup(true, ['spec_basis']);
  const ok = await Opinion.confirmRewrite();
  assert.equal(ok, true, '경고 있어도 canConfirm true 면 확정(변리사 override)');
  assert.equal(Opinion.state._pendingRewrite, null, '커밋됨');
});

test('★ cancelRewrite — 폐기, draftResult 불변', () => {
  const { OLD } = setup(true, []);
  const oldRef = Opinion.state.draftResult;
  Opinion.cancelRewrite();
  assert.equal(Opinion.state._pendingRewrite, null, '★ 보류 폐기');
  assert.strictEqual(Opinion.state.draftResult, oldRef, '★ draftResult 불변(기존 보정안 유지)');
  assert.equal(OLD.amended_claims[2].amended, 'A5', '문언 불변');
});

test('_buildRewriteDiffHtml — 전/후 diff + 비대상 변경없음 + 게이트 배너', () => {
  setup(true, []);
  const html = Opinion._buildRewriteDiffHtml(Opinion.state._pendingRewrite);
  assert.ok(html.includes('보정 전') && html.includes('보정 후'), '전/후 라벨');
  assert.ok(html.includes('A5') && html.includes('NEW5'), '전후 문언');
  assert.ok(html.includes('변경 없음'), '★ 비대상 변경없음(splice 가시화)');
  assert.ok(html.includes('게이트 통과'), '게이트 배너(통과)');
  // CRITICAL 배너
  setup(false, []);
  const blocked = Opinion._buildRewriteDiffHtml(Opinion.state._pendingRewrite);
  assert.ok(blocked.includes('무결성 위반') && blocked.includes('확정 불가'), 'CRITICAL 차단 배너');
  // 경고 배너
  setup(true, ['spec_basis', 'references']);
  const warn = Opinion._buildRewriteDiffHtml(Opinion.state._pendingRewrite);
  assert.ok(warn.includes('경고 2건'), '경고 배너');
});

test('★ 통합: applyDirectionRewrite(보류 유지) → confirmRewrite(커밋) → 보정 후 반영 + 비대상 불변', async () => {
  Opinion.extractSpecificationText = async () => '명세서 【0001】 【0035】 냉각 유로가 배치된다. '.repeat(5);
  Opinion.state = Object.assign(Opinion.state, {
    current: { id: 'proj-1', rejection_type: 'inventive_step' },
    draftResult: { amended_claims: [
      { claim_no: 1, original: 'O1', amended: 'A1', spec_basis: ['【0001】'] },
      { claim_no: 5, original: 'O5', amended: 'A5', spec_basis: ['【0035】'], review_amendments: [{ op: 'add_limitation', direction: '청구항 5 냉각유로', planId: 'p1' }] },
    ] },
    _pendingRewrite: null,
  });
  const liveBefore = JSON.stringify(Opinion.state.draftResult);
  const pend = await Opinion.applyDirectionRewrite();
  assert.ok(pend, '_pendingRewrite 생성');
  assert.equal(JSON.stringify(Opinion.state.draftResult), liveBefore, '★ 확정 전 draftResult 불변(보류)');
  assert.equal(pend.gates.canConfirm, true, 'splice → canConfirm');
  // 확정
  const ok = await Opinion.confirmRewrite();
  assert.equal(ok, true, '확정');
  assert.equal(Opinion.state.draftResult.amended_claims[1].amended, 'REWRITTEN-5', '★ 확정 후 보정 후 문언 반영(보정서 자동반영)');
  assert.equal(Opinion.state.draftResult.amended_claims[0].amended, 'A1', '★ 비대상 1 불변');
  assert.equal(Opinion.state.draftResult.amended_claims[1].review_amendments[0].applied, true, '반영됨 마킹');
  assert.equal(Opinion.state._pendingRewrite, null, '보류 해제');
});

test('버튼 노출 조건 — 승인 방향 있으면 renderOutput 에 btnDirectionRewrite', () => {
  // 소스 레벨: renderOutput 이 _collectApprovedDirections 길이로 버튼을 조건 렌더하는지
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  assert.match(src, /btnDirectionRewrite[\s\S]*?Opinion\.startDirectionRewrite\(\)/, 'startDirectionRewrite 버튼 배선');
  assert.match(src, /_collectApprovedDirections\(Opinion\.state\.draftResult\|\|\{\}\)\.length[\s\S]*?btnDirectionRewrite/, '승인 방향 있을 때만 노출');
});
