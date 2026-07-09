/**
 * review-engine/__tests__/opinion-writer.test.js
 * T6 — opinion.js 의 WriterModule 2함수(exportSnapshot/applyAmendments) + 기존 함수 회귀.
 * opinion.js 는 브라우저 classic script 이므로 vm 샌드박스에 최소 전역을 주입해 로드한다.
 * 증명: I-1(원본 무변형 deepClone), I-2/E-19(승인분만), §7⑤(정합성 재검증),
 *      E-27(원자성: 예외 시 원본 불변), 기존 _validate* 시그니처·동작 불변(회귀).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, win;

before(() => {
  const src = readModuleBundle(REPO_ROOT, 'opinion');
  // 최소 브라우저 전역 스텁. sandbox.window = sandbox(자기참조) → bare `Opinion` 해석.
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat,
    setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => ({ style: {}, appendChild() {} }), getElementById: () => null },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    App: { currentUser: { id: 'u1', email: 'jaeill.roh@gmail.com' } },
    sb: { from: () => ({ select: () => ({ eq: () => ({}) }), insert: () => ({}), upsert: () => ({}) }) },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  win = sandbox;
  Opinion = sandbox.window.Opinion;
  // 테스트 픽스처: 보정 청구항(부가=anchor) + 명세서 + 거절
  Opinion.state = Object.assign(Opinion.state || {}, {
    parsed: {
      application_no: '10-2024-0123456',
      claims: [{ no: 1, text: '원 청구항1' }, { no: 2, text: '제1항에 있어서 ...' }],
      rejection_reasons: [{ article: '§29②', claim_nos: [1], cited_refs: ['인용문헌1'] }],
    },
    typeResult: { primary_type: '진보성' },
    draftResult: { amended_claims: [{ claim_no: 1, amended: '보정 청구항1', spec_basis: ['0021'], amendment_methods: [{ method: '부가', element: '냉각 유로' }] }] },
    refText: '【0021】 냉각 유로는 ... 를 포함한다.',
    analysis: null, validation: null, current: { id: 'p1' },
  });
});

test('exportSnapshot: 원본 무변형 deepClone(I-1) + adapter 입력 형상 정합', () => {
  const snap = Opinion.exportSnapshot();
  assert.equal(snap.caseId, '10-2024-0123456');
  assert.ok(snap.parsed && snap.draftResult && typeof snap.refText === 'string');
  // 깊은 복사 — 사본 변형이 원본에 영향 없음
  snap.parsed.claims[0].text = 'MUTATED';
  assert.equal(Opinion.state.parsed.claims[0].text, '원 청구항1', '원본 불변(I-1)');
  assert.notEqual(snap.parsed, Opinion.state.parsed, '동일 참조 아님');
});

test('applyAmendments: 미승인 plan 이면 throw(I-2/E-19), 원본 불변(E-27)', () => {
  const before = JSON.stringify(Opinion.state.draftResult);
  assert.throws(() => Opinion.applyAmendments([{ id: 'plan_x', accepted: false, ops: [] }]), /미승인/);
  assert.throws(() => Opinion.applyAmendments([{ id: 'plan_y', ops: [] }]), /미승인/); // accepted 미설정
  assert.equal(JSON.stringify(Opinion.state.draftResult), before, '예외 시 원본 불변(E-27)');
});

test('applyAmendments: 승인분만 구조적 반영 + 정합성 재검증(§7⑤)', () => {
  const plan = { id: 'plan_1', accepted: true, addressesIssues: ['exA-1'], ops: [{ op: 'add_limitation', target: 'claim_1', content: '명세서 【0021】 냉각 유로 한정 방향', reason: 'exA-1' }] };
  const res = Opinion.applyAmendments([plan]);
  assert.equal(res.count, 1);
  assert.equal(res.applied[0].claim_no, '1');
  // 구조적 기록(review_amendments) — 산문 텍스트는 재작성 안 함
  const ac = Opinion.state.draftResult.amended_claims[0];
  assert.equal(ac.amended, '보정 청구항1', '산문 청구항 텍스트 불변(날조 금지)');
  assert.equal(ac.review_amendments.length, 1);
  assert.equal(ac.review_amendments[0].op, 'add_limitation');
  assert.equal(ac.review_amendments[0].approvedBy, 'jaeill.roh@gmail.com');
  // 정합성 재검증 결과 회신
  assert.ok(res.consistency.specBasis && res.consistency.preservation && res.consistency.references);
});

test('applyAmendments: 대상 보정 청구항 없으면 skip(문언 날조 금지)', () => {
  const plan = { id: 'plan_2', accepted: true, ops: [{ op: 'add_limitation', target: 'claim_99', content: 'x' }] };
  const res = Opinion.applyAmendments([plan]);
  assert.equal(res.count, 0, '없는 청구항엔 반영 안 함');
});

test('호출 훅: 카드에 재오픈 버튼 + openReviewModal 이 공유 모달 발화(2a)', () => {
  // 결과는 넓은 공유 모달(2a)에 표시 — renderOutput 은 카드에 재오픈 버튼만, 실제 마운트는 openModal.
  let fired = null;
  win.ReviewUI = { isEnabled: () => true, policy: () => ({ capUsd: 5, maxRounds: 12 }), render: () => {}, openModal: (state, opts) => { fired = { state, hasActor: !!(opts && opts.actor) }; }, closeModal: () => {} };
  const mountEl = { id: 'opinionReviewMount', innerHTML: '', appendChild() {} };
  const origGet = win.document.getElementById;
  win.document.getElementById = (id) => (id === 'opinionReviewMount' ? mountEl : null);
  Opinion.state.reviewState = { patchPlans: [{ id: 'plan_1', accepted: true, ops: [] }], issues: [], rounds: [], budget: {} };
  const mk = () => ({ innerHTML: '', appendChild() {} });
  Opinion.renderOutput(mk(), mk(), 'completed');
  assert.match(mountEl.innerHTML, /검증 결과 보기/, '카드에 재오픈 버튼(결과는 모달)');
  Opinion.openReviewModal();
  assert.ok(fired, 'openReviewModal → 공유 모달 발화');
  assert.equal(fired.state, Opinion.state.reviewState);
  assert.equal(fired.hasActor, true, 'actor(로그인 사용자) 전달');
  // 가드형 — reviewState 없으면 버튼/발화 없음
  fired = null; Opinion.state.reviewState = null; mountEl.innerHTML = '';
  Opinion.renderOutput(mk(), mk(), 'completed');
  Opinion.openReviewModal();
  assert.equal(fired, null, 'reviewState 없으면 발화 안 함(기존 동작 불변)');
  win.document.getElementById = origGet; // 복원
});

test('회귀: 기존 _validate* 시그니처·동작 불변', () => {
  // _validateSpecBasis (명세서 원문 ≥50자 — 기존 함수의 specification_missing 임계 회피)
  const specText = '【0021】 냉각 유로는 셀 사이를 사행 형상으로 통과하며 냉각 유체를 순환시켜 셀 간 온도 편차를 저감한다. 충분한 길이.';
  const sb = Opinion._validateSpecBasis([{ claim_no: 1, spec_basis: ['0021'] }], specText);
  assert.equal(sb.ok, true);
  const sbMiss = Opinion._validateSpecBasis([{ claim_no: 1, spec_basis: ['9999'] }], specText);
  assert.equal(sbMiss.ok, false);
  // _validateClaimPreservation
  const pres = Opinion._validateClaimPreservation([{ no: 1 }, { no: 2 }], { amended_claims: [{ claim_no: 1 }], unchanged_claims: [2] }, [1]);
  assert.equal(pres.ok, true);
  // _validateClaimReferences
  const refs = Opinion._validateClaimReferences([{ no: 1, text: '독립항' }, { no: 2, text: '제1항에 있어서' }]);
  assert.equal(refs.ok, true);
  const refBad = Opinion._validateClaimReferences([{ no: 2, text: '제5항에 있어서' }]);
  assert.equal(refBad.ok, false, '없는 청구항 인용 검출(동작 불변)');
});
