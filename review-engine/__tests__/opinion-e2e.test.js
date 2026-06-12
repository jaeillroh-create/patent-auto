/**
 * review-engine/__tests__/opinion-e2e.test.js
 * B1 — opinion E2E 스테이징 검증(토글 ON 전 관문).
 * 전 구간 1회 연결 증명:
 *   Opinion.exportSnapshot → OpinionProfile.adaptSnapshot → orchestrate(R1 discover, stub LLM)
 *   → issues + patchPlans → ReviewUI(Human Gate 표시) → humanGate.approvePlan(사람 승인)
 *   → Opinion.applyAmendments(구조반영) → runReviewEngine 재트리거(recheck).
 * LLM은 결정적 stub. 흐름 연결 자체가 검증 대상.
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
import { approvePlan, gateView } from '../kernel/humanGate.js';
import { renderHTML } from '../ui/opinion-review-panel.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, win;

/** opinion.js 를 vm 샌드박스로 로드(토글 ON 스텁 포함). */
before(() => {
  const src = readFileSync(path.join(REPO_ROOT, 'opinion/opinion.js'), 'utf8');
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN,
    setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => ({ style: {}, appendChild() {} }), getElementById: () => null },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    App: { currentUser: { id: 'u1', email: 'jaeill.roh@gmail.com' }, sb: { functions: { invoke: async () => ({ data: null }) } } },
    // 토글 ON 스텁(B1 테스트 한정 — 실 토글은 index.js FEATURE_FLAGS=false 유지)
    ReviewUI: { isEnabled: () => true },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  win = sandbox;
  Opinion = sandbox.window.Opinion;
  // 실 opinion 케이스: 거절 청구항1 + 보정안(부가 냉각유로) + 명세서
  Opinion.state = Object.assign(Opinion.state || {}, {
    current: { id: 'p1' },
    parsed: {
      application_no: '10-2024-0999', invention_title: '열관리 장치',
      claims: [{ no: 1, text: '복수의 셀과 제어부를 포함하는 장치.' }],
      rejection_reasons: [{ article: '§29②', claim_nos: [1], cited_refs: ['인용문헌1'] }],
      cited_references: [{ ref_no: 1, title: '인용문헌1', publication_no: 'KR-1' }],
    },
    typeResult: { primary_type: '진보성', claim_summary: { rejected_claims: [1] } },
    draftResult: { amended_claims: [{ claim_no: 1, amended: '복수의 셀과 제어부와 냉각 유로를 포함하는 장치.', spec_basis: ['0021'], amendment_methods: [{ method: '부가', element: '냉각 유로' }] }] },
    refText: '【0021】 냉각 유로는 셀 사이를 사행 형상으로 통과한다. 충분한 길이의 명세서 본문.',
  });
});

/** ESM 파이프라인 runner — 결정적 stub LLM. (prod 의 edge invoke 자리) */
function makeStubRunner() {
  return async (snapshot) => {
    const state = OpinionProfile.adaptSnapshot(snapshot, null, { terminationPolicy: OpinionProfile.terminationPolicy });
    const ALL_TRUE = { examiner: true, attorney: true, expert: true };
    const runAgent = async ({ mode, state: st }) => {
      if (mode === 'discover') {
        return {
          issues: [{ id: 'exA-1', type: '거절미해소', severity: 'high', target: ['claim_1'], raisedBy: 'examiner_A', legalBasis: '§29②', description: '인용문헌1 대비 진보성 미해소', suggestedOp: 'add_limitation', amendmentDirection: '청구항1에 명세서 【0021】의 사행 냉각 유로를 한정하는 방향' }],
          consensus: ALL_TRUE, cost: 0.01, provider: 'stub', latencyMs: 1,
        };
      }
      return { verdicts: (st.issues || []).map((i) => ({ issueId: i.id, result: 'resolved' })), consensus: ALL_TRUE, cost: 0, provider: 'stub', latencyMs: 1 };
    };
    const profile = { ...OpinionProfile, writer: makeEngineWriter(() => state) };
    const res = await orchestrate(profile, state, { runAgent });
    return { issues: res.issues, patchPlans: res.patchPlans, phase: res.phase, rounds: res.rounds, budget: res.budget, consensus: res.consensus };
  };
}

test('E2E: exportSnapshot→adapt→orchestrate→Human Gate→승인→applyAmendments→recheck 전 구간', async () => {
  const runner = makeStubRunner();

  // ── 1) 트리거: exportSnapshot → runner → reviewState 설정 (GAP1 해소) ──
  const result = await Opinion.runReviewEngine(runner);
  assert.ok(result, '검증 트리거 발화(토글 ON)');
  assert.equal(Opinion.state.reviewState, result, 'reviewState 설정 → T6 훅 발화 조건 충족');

  // ── 2) R1 discover 발굴: issues + patchPlans (GAP3 해소: patchPlans 전달) ──
  assert.ok(result.issues.length >= 1, 'R1 discover issue 발굴');
  assert.ok(result.patchPlans.length >= 1, '보정안(patchPlan) 생성 → Human Gate 승인 대상');
  const plan = result.patchPlans[0];
  assert.equal(plan.accepted, null, '승인 전 — accepted=null(사람 결정 대기)');

  // ── 3) Human Gate 표시: ReviewUI 가 reviewState 를 소비해 게이트 UI 생성 ──
  const html = renderHTML(result, { actor: 'jaeill.roh@gmail.com' });
  assert.match(html, /보정 diff/);
  assert.match(html, new RegExp(plan.id), '게이트 UI에 승인 대상 plan 표시');

  // ── 4) 사람 승인(Human Gate 버튼이 호출하는 것과 동일 경로): humanGate.approvePlan ──
  approvePlan(result, plan.id, 'jaeill.roh@gmail.com');
  const approved = gateView(result).filter((g) => g.decision === 'approved');
  assert.equal(approved.length, 1, '승인 1건');
  const approvedPlans = result.patchPlans.filter((p) => p.accepted === true);

  // ── 5) 구조반영: Opinion.applyAmendments(승인분만) (onChange 가 호출하는 것과 동일) ──
  const applyRes = Opinion.applyAmendments(approvedPlans);
  assert.ok(applyRes.count >= 1, '승인분 구조반영');
  const ac = Opinion.state.draftResult.amended_claims[0];
  assert.ok(ac.review_amendments && ac.review_amendments.length >= 1, 'review_amendments 구조 기록');
  assert.equal(ac.amended, '복수의 셀과 제어부와 냉각 유로를 포함하는 장치.', '산문 청구항 텍스트 불변(날조 금지)');
  assert.ok(applyRes.consistency.specBasis, '정합성 재검증 회신');

  // ── 6) recheck 재트리거: 반영된 스냅샷으로 재검증(GAP2 해소) ──
  assert.equal(typeof Opinion._reviewRunner, 'function', 'recheck용 runner 보존');
  const recheck = await Opinion.runReviewEngine(Opinion._reviewRunner);
  assert.ok(recheck, 'recheck 재트리거 발화');
  assert.ok(Array.isArray(recheck.issues), 'recheck 결과 수신(재검증 완료)');
});

test('토글 OFF면 트리거 무동작(E-21) — reviewState 미설정', async () => {
  win.ReviewUI.isEnabled = () => false; // 토글 OFF 모사
  Opinion.state.reviewState = null;
  const r = await Opinion.runReviewEngine(makeStubRunner());
  assert.equal(r, null, '토글 OFF → 무동작');
  assert.equal(Opinion.state.reviewState, null, 'reviewState 미설정(기존 동작 불변)');
  win.ReviewUI.isEnabled = () => true; // 복원
});
