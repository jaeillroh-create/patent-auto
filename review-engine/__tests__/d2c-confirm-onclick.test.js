/**
 * review-engine/__tests__/d2c-confirm-onclick.test.js
 * A-1 수정 — [확정] 버튼을 [취소]처럼 인라인 onclick(_confirmRewriteClick)으로 일원화(클릭 무반응 차단).
 * + B-1 파일명 시각, B-2 insert 실패 경고. confirmRewrite 로직/게이트 불변(배선만).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, cap, sandbox;

function load() {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  cap = { insertError: null, toasts: [], modalRemoved: false };
  const sb = {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
      insert: async () => ({ data: { id: 'x' }, error: cap.insertError }),  // confirmRewrite 는 await insert 직접
      update: () => ({ eq: () => Promise.resolve({}) }),
    }),
    functions: { invoke: async () => ({ data: null }) },
  };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast: (m) => { cap.toasts.push(String(m)); }, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App: { sb, currentUser: { id: 'u1', email: 'u@x.com' } },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
  Opinion.usage = Opinion.usage || { calls: 0 }; Opinion.updateUsageDisplay = function () {};
  Opinion.renderDetail = function () {};
}

// 모달 제거 감지용 document.getElementById 스텁.
function trackModal() {
  sandbox.document.getElementById = function (id) { return id === 'opinionRewriteModal' ? { remove: function () { cap.modalRemoved = true; } } : null; };
}
// OLD(라이브) + PENDING(claim5 재작성) 픽스처.
function setup(canConfirm) {
  const OLD = { amended_claims: [
    { claim_no: 2, original: 'O2', amended: 'A2' },
    { claim_no: 5, original: 'O5', amended: 'A5', review_amendments: [{ op: 'add_limitation', direction: '청구항5 냉각유로', planId: 'p1' }] },
    { claim_no: 6, original: 'O6', amended: 'A6' },
  ] };
  const PENDING = structuredClone(OLD);
  PENDING.amended_claims[1].amended = 'NEW5'; PENDING.amended_claims[1]._d2_rewritten = true;
  Opinion.state = Object.assign(Opinion.state, {
    current: { id: 'p1', rejection_type: 'inventive_step' }, draftResult: OLD,
    _pendingRewrite: { draftResult: PENDING, targetClaimNos: [5], before: { '5': 'A5' }, after: { '5': 'NEW5' },
      gates: { canConfirm: canConfirm, blockers: canConfirm ? [] : ['non_target_invariance'], warnings: [] } },
  });
  return { OLD, PENDING };
}

test('★ A-1 _confirmRewriteClick — confirmRewrite 커밋 + 성공 시 모달 제거', async () => {
  load(); trackModal();
  const { PENDING } = setup(true);
  await Opinion._confirmRewriteClick();
  assert.strictEqual(Opinion.state.draftResult, PENDING, '★ 보류본 → draftResult 커밋');
  assert.equal(Opinion.state.draftResult.amended_claims[1].amended, 'NEW5', '재작성문 반영');
  assert.equal(Opinion.state._pendingRewrite, null, '보류 해제');
  assert.equal(cap.modalRemoved, true, '★ 성공 시 모달 제거');
});

test('★ CRITICAL 차단 유지 — _confirmRewriteClick 해도 커밋 0, 모달 유지', async () => {
  load(); trackModal();
  const { OLD } = setup(false);
  await Opinion._confirmRewriteClick();
  assert.strictEqual(Opinion.state.draftResult, OLD, '★ 커밋 안 함(draftResult 불변)');
  assert.ok(Opinion.state._pendingRewrite, '보류 유지');
  assert.notEqual(cap.modalRemoved, true, '모달 유지(confirmRewrite false → 닫지 않음)');
});

test('★ 커밋 후 보정서 "보정 후"에 재작성문 — 구조 검증(read=commit 위치)', async () => {
  load(); trackModal();
  setup(true);
  await Opinion._confirmRewriteClick();
  const html = Opinion._buildAmendmentDocxHtml({ rejection_type: 'inventive_step' }, Opinion.state.draftResult, { claims: [{ no: 2, text: 'O2' }, { no: 5, text: 'O5' }, { no: 6, text: 'O6' }] });
  assert.ok(html.includes('나. 보정 후'), '보정 후 섹션');
  assert.ok(html.includes('NEW5'), '★ 재작성문이 보정 후에 반영');
  assert.ok(html.includes('A2') && html.includes('A6'), '비대상 2·6 그대로');
});

test('B-2 insert 실패 → 경고 토스트(커밋 in-memory 는 유지)', async () => {
  load(); cap.insertError = { message: 'boom' };
  setup(true);
  await Opinion._confirmRewriteClick();
  assert.ok(cap.toasts.some(function (m) { return m.includes('저장 실패'); }), '★ insert 실패 경고');
  assert.equal(Opinion.state.draftResult.amended_claims[1].amended, 'NEW5', 'in-memory 커밋은 유지');
});

test('★ [확정] 인라인 onclick + addEventListener 제거, [취소]와 통일 (source)', () => {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  assert.match(src, /id="btnRewriteConfirm" onclick="Opinion\._confirmRewriteClick\(\)"/, '[확정] 인라인 onclick');
  assert.ok(!src.includes("getElementById('btnRewriteConfirm')"), '★ btn addEventListener 배선 제거(클릭 무반응 원인 제거)');
  assert.match(src, /onclick="Opinion\.cancelRewrite\(\)"/, '[취소] 인라인 onclick(배선 통일)');
});

test('B-1 파일명 시각(HHMMSS) — 구버전 혼동 방지 (source)', () => {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  assert.match(src, /toTimeString\(\)\.slice\(0,8\)\.replace\(\/:\/g,''\)/, '파일명에 시각(HHMMSS)');
});
