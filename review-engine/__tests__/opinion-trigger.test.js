/**
 * review-engine/__tests__/opinion-trigger.test.js
 * opinion 검증 "트리거 버튼" E2E — 진단 사각지대(프로그램 직접 호출만 테스트되어 버튼 부재가 가려짐) 해소.
 * 증명:
 *   - renderOutput("최종 확인") 화면에 검증 버튼(btnOpinionReview, onclick=Opinion.runReviewEngine) 렌더
 *   - ★ 버튼 경유 발화: Opinion.runReviewEngine() (인자 없음, onclick 과 동일) → 게이트 → 비용확인
 *     → _defaultReviewRunner(stub orchestrator) → reviewState 설정 → 같은 화면 마운트
 *   - 게이트(보정안 없음) → 미발화 / 비용 confirm=false → 미발화(오발화 방지)
 *   - 결과 마운트가 버튼과 같은 화면(opinionReviewMount)
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';
import { run as orchestrate } from '../kernel/orchestrator.js';
import { makeEngineWriter } from '../profiles/opinion/writerAdapter.js';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, win, els, renderCalls;

function mkEl(id) { return { id, style: {}, disabled: false, textContent: '', innerHTML: '', appendChild() {} }; }

before(() => {
  const src = readModuleBundle(REPO_ROOT, 'opinion');
  renderCalls = [];
  els = { btnOpinionReview: mkEl('btnOpinionReview'), opinionReviewGateMsg: mkEl('opinionReviewGateMsg'), opinionReviewMount: mkEl('opinionReviewMount'), reviewModalMount: mkEl('reviewModalMount'), reviewResultModal: mkEl('reviewResultModal') };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN,
    setTimeout: () => 0, clearTimeout: () => {},
    setButtonLoading() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => mkEl('tmp'), getElementById: (id) => els[id] || null },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    confirm: () => true, // 기본 진행 동의(테스트별 override)
    App: { currentUser: { id: 'u1', email: 'jaeill.roh@gmail.com' }, sb: { functions: { invoke: async () => ({ data: null }) } } },
    ReviewUI: {
      isEnabled: () => true,
      policy: () => ({ K: 1, maxRounds: 12, capUsd: 5, perIssueAttemptCap: 2 }),
      render: (state, el, opts) => { renderCalls.push({ elId: el && el.id, hasState: !!state, opts }); },
      openModal: (state, opts) => { renderCalls.push({ elId: 'reviewModalMount', via: 'openModal', hasState: !!state, opts }); },
      closeModal: () => {},
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  win = sandbox;
  Opinion = sandbox.window.Opinion;

  // 보정안 작성 완료 상태(게이트 통과) — output(최종 확인) 단계.
  Opinion.state = Object.assign(Opinion.state || {}, {
    current: { id: 'p1', status: 'completed', rejection_type: 'inventive_step', title: '열관리 장치', application_no: '10-2024-0999' },
    parsed: {
      application_no: '10-2024-0999', invention_title: '열관리 장치',
      claims: [{ no: 1, text: '복수의 셀과 제어부를 포함하는 장치.' }],
      rejection_reasons: [{ article: '§29②', claim_nos: [1], cited_refs: ['인용문헌1'] }],
    },
    typeResult: { primary_type: '진보성', claim_summary: { rejected_claims: [1] } },
    draftResult: { amended_claims: [{ claim_no: 1, amended: '복수의 셀과 제어부와 냉각 유로를 포함하는 장치.', spec_basis: ['0021'] }] },
    refText: '【0021】 냉각 유로는 셀 사이를 사행 형상으로 통과한다. 충분한 길이의 명세서 본문.',
    opinionDraft: { title: '의견서', sections: [{ heading: '대비', content: '본원은 냉각 유로를 구비한다.' }] },
  });
});

/** stub orchestrator runner — 버튼 경유(_defaultReviewRunner 자리)로 주입. */
function makeStubRunner(tracker) {
  return async (snapshot) => {
    if (tracker) tracker.called = true;
    // 엔진 다라운드(discover+recheck+patchPlan) 검증 — 프로덕션 임시 throttle(opinion maxRounds=1)과 분리해 full policy 주입.
    const FULL_POLICY = { K: 1, maxRounds: 12, capUsd: 5, perIssueAttemptCap: 2 };
    const state = OpinionProfile.adaptSnapshot(snapshot, null, { terminationPolicy: FULL_POLICY });
    const CONS = { examiner: true, attorney: true, expert: true };
    const runAgent = async ({ mode, state: st }) => {
      if (mode === 'discover') return { issues: [{ id: 'exA-1', type: '거절미해소', severity: 'high', target: ['claim_1'], raisedBy: 'examiner_A', legalBasis: '§29②', description: '인용문헌1 대비 진보성 미해소', suggestedOp: 'add_limitation', amendmentDirection: '청구항1에 【0021】 냉각 유로 한정' }], consensus: CONS, cost: 0.01, provider: 'stub', latencyMs: 1 };
      return { verdicts: (st.issues || []).map((i) => ({ issueId: i.id, result: 'resolved' })), consensus: CONS, cost: 0, provider: 'stub', latencyMs: 1 };
    };
    const profile = { ...OpinionProfile, writer: makeEngineWriter(() => state), terminationPolicy: FULL_POLICY };
    const res = await orchestrate(profile, state, { runAgent });
    return { issues: res.issues, patchPlans: res.patchPlans, phase: res.phase, rounds: res.rounds, budget: res.budget, consensus: res.consensus };
  };
}

test('renderOutput("최종 확인")에 검증 버튼 렌더 (onclick=Opinion.runReviewEngine)', () => {
  const L = mkEl('L'), R = mkEl('R');
  Opinion.renderOutput(L, R, 'completed');
  assert.match(L.innerHTML, /btnOpinionReview/, '검증 버튼 존재');
  assert.match(L.innerHTML, /Opinion\.runReviewEngine\(\)/, 'onclick 트리거 연결');
  assert.match(L.innerHTML, /opinionReviewMount/, '결과 마운트 컨테이너 같은 화면');
});

test('★ 버튼 경유 발화: runReviewEngine() 인자 없이 → _defaultReviewRunner → reviewState 설정', async () => {
  const tracker = { called: false };
  Opinion._reviewRunner = null;
  Opinion._defaultReviewRunner = makeStubRunner(tracker); // 버튼 첫 클릭 경로(no-arg → _defaultReviewRunner)
  Opinion.state.reviewState = null;
  const result = await Opinion.runReviewEngine(); // ★ onclick 과 동일: 인자 없음
  assert.ok(result, '버튼 경유 발화 성공');
  assert.equal(tracker.called, true, 'runner 호출됨(프로그램 직접 호출 아닌 버튼 경로)');
  assert.equal(Opinion.state.reviewState, result, 'reviewState 설정');
  assert.ok(result.issues.length >= 1 && result.patchPlans.length >= 1, 'discover issue+patchPlan');
});

test('최종확인 화면: 카드에 재오픈 버튼 + 재오픈 시 넓은 공유 모달(openModal)에 마운트(2a)', () => {
  renderCalls.length = 0;
  // 직전 테스트에서 reviewState 설정됨
  const L = mkEl('L'), R = mkEl('R');
  Opinion.renderOutput(L, R, 'completed');
  assert.match(els.opinionReviewMount.innerHTML, /검증 결과 보기/, '카드엔 재오픈 버튼(결과는 모달)');
  Opinion.openReviewModal();
  const modal = renderCalls.find((c) => c.via === 'openModal');
  assert.ok(modal && modal.hasState, '재오픈 → 공유 모달에 결과 마운트(좁은 컬럼 탈출)');
});

test('게이트: 보정안 없으면 미발화 + 안내', async () => {
  const tracker = { called: false };
  Opinion._defaultReviewRunner = makeStubRunner(tracker);
  const savedDraft = Opinion.state.draftResult;
  Opinion.state.draftResult = null; // 보정안 미작성
  const r = await Opinion.runReviewEngine();
  assert.equal(r, null, '게이트 미충족 → 미발화');
  assert.equal(tracker.called, false, 'runner 미호출');
  Opinion.state.draftResult = savedDraft; // 복원
});

test('비용확인 false → 미발화(오발화 방지)', async () => {
  const tracker = { called: false };
  Opinion._defaultReviewRunner = makeStubRunner(tracker);
  win.confirm = () => false; // 사용자 취소
  const r = await Opinion.runReviewEngine();
  assert.equal(r, null, 'confirm 거부 → 미발화');
  assert.equal(tracker.called, false, 'runner 미호출(부작용 0)');
  win.confirm = () => true; // 복원
});

test('E-21: isEnabled(opinion) OFF → 무동작', async () => {
  const tracker = { called: false };
  Opinion._defaultReviewRunner = makeStubRunner(tracker);
  win.ReviewUI.isEnabled = () => false;
  const r = await Opinion.runReviewEngine();
  assert.equal(r, null, '토글 OFF → 무동작');
  assert.equal(tracker.called, false, 'runner 미호출');
  win.ReviewUI.isEnabled = () => true; // 복원
});
