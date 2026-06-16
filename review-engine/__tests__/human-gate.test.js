/**
 * review-engine/__tests__/human-gate.test.js
 * T5 — Human Gate & UI 매핑 단위테스트.
 * 증명: I-2(사람만 accepted), §12(감사로그), §9(사람결정 분류), UI 매핑(image 14/17/19/33/13·15),
 *      그리고 applyAmendments 미호출(읽고 지적만).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../kernel/stateStore.js';
import { approvePlan, rejectPlan, pendingHumanDecisions, gateView, decisionOf, GATE_DECISION } from '../kernel/humanGate.js';
import { buildViewModel, opDiffClass } from '../ui/reviewViewModel.js';
import { renderHTML, render } from '../ui/opinion-review-panel.js';

/** 테스트용 상태: high/medium issue + deadlock + tradeoff + unknown kind + patchPlan + rounds. */
function makeState() {
  const st = createState({ reviewId: 'rev_t5', caseId: 'C1', module: 'opinion', terminationPolicy: { capUsd: 5, maxRounds: 12 } });
  st.phase = 'escalated';
  st.budget.spentUsd = 0.0927; st.budget.roundsUsed = 1; st.budget.maxRounds = 12;
  st.claims = [
    { id: 'claim_1', no: 1, kind: 'anchor', anchorType: '부가', text: 'A+B+D' },
    { id: 'claim_2', no: 2, kind: 'unknown', text: 'C' },
  ];
  st.issues = [
    { id: 'exA-1', type: '거절미해소', severity: 'high', target: ['claim_1'], raisedBy: 'examiner_A', legalBasis: '§29②', description: 'ML 모듈 진보성 미해소', status: 'open' },
    { id: 'exB-1', type: '거절미해소', severity: 'high', target: ['claim_1'], raisedBy: 'examiner_B', legalBasis: '§42④', description: '뒷받침 부재', status: 'open' },
    { id: 'exA-2', type: '거절미해소', severity: 'medium', target: ['claim_1'], raisedBy: 'examiner_A', legalBasis: '§29②', description: '사행 냉각 설계변경', status: 'open' },
    { id: 'dl-1', type: '논리결함', severity: 'medium', target: ['claim_1'], raisedBy: 'examiner_A', legalBasis: '§29②', description: '교착', status: 'deadlock' },
    { id: 'to-1', type: '거절미해소', severity: 'high', target: ['claim_2'], raisedBy: 'examiner_A', legalBasis: '§29②', description: '권리 trade-off', status: 'open', tradeoff: true },
    { id: 'rs-1', type: '거절미해소', severity: 'high', target: ['claim_1'], raisedBy: 'examiner_C', legalBasis: '§47', description: '신규사항', status: 'resolved' },
  ];
  st.patchPlans = [
    { id: 'plan_1', addressesIssues: ['exA-1'], ops: [{ op: 'add_limitation', target: 'claim_1', content: '예측 결과 피드백' }, { op: 'narrow_scope', target: 'claim_1', content: '단일 코어' }], ripple: [], scoreBefore: 23, scoreAfter: 13 },
  ];
  st.rounds = [{ n: 1, mode: 'discover', agent: 'examiners', provider: 'examiner_A:claude', cost: 0.0927, latencyMs: 23504, output: { issueCount: 5 } }];
  return st;
}

test('I-2: approvePlan 은 actor 없으면 throw (자동/익명 승인 차단)', () => {
  const st = makeState();
  assert.throws(() => approvePlan(st, 'plan_1'), /actor/);
  assert.equal(st.patchPlans[0].accepted, undefined, 'actor 없이 accepted 변경 금지');
});

test('I-2: accepted 는 기본 미설정(코드 자동 true 없음) — buildViewModel 후에도 pending', () => {
  const st = makeState();
  buildViewModel(st);
  assert.equal(decisionOf(st.patchPlans[0]), GATE_DECISION.PENDING);
  assert.equal(st.patchPlans[0].accepted, undefined);
});

test('사람 승인 → accepted=true + §12 감사로그(human_gate, actor 기록)', () => {
  const st = makeState();
  approvePlan(st, 'plan_1', 'jaeill.roh@gmail.com', { note: '검토 후 승인' });
  assert.equal(st.patchPlans[0].accepted, true);
  const tr = st.transitions.at(-1);
  assert.equal(tr.kind, 'human_gate');
  assert.equal(tr.ref, 'plan_1');
  assert.equal(tr.to, 'approved');
  assert.equal(tr.actor, 'jaeill.roh@gmail.com');
  assert.ok(tr.ts, '타임스탬프 기록');
});

test('사람 거부 → accepted=false + 로그 보존(미승인)', () => {
  const st = makeState();
  rejectPlan(st, 'plan_1', 'jaeill.roh@gmail.com');
  assert.equal(st.patchPlans[0].accepted, false);
  assert.equal(st.transitions.at(-1).to, 'rejected');
});

test('§9: 사람 결정 필요 — deadlock/tradeoff/잔여high/unknown 분류', () => {
  const st = makeState();
  const hn = pendingHumanDecisions(st);
  assert.equal(hn.deadlocks.length, 1);
  assert.equal(hn.tradeoffs.length, 1);
  assert.ok(hn.residualHigh.length >= 2, 'escalate 잔여 high');
  assert.equal(hn.unknownKind.length, 1, 'claim_2 unknown');
  assert.equal(hn.required, true);
});

test('UI 매핑: image 14(통과/주의/실패) + image 19(pass 카운트)', () => {
  const vm = buildViewModel(makeState());
  assert.equal(vm.overall, 'fail', 'high open → 실패');
  assert.ok(vm.severity.fail.length >= 3);
  assert.equal(vm.passCount.resolved, 1, 'rs-1 resolved');
  assert.equal(vm.passCount.total, 6);
  assert.ok(vm.passCount.highOpen >= 3);
});

test('UI 매핑: image 17 diff 색상(add=초록, narrow=빨강)', () => {
  assert.equal(opDiffClass('add_limitation'), 'add');
  assert.equal(opDiffClass('narrow_scope'), 'narrow');
  assert.equal(opDiffClass('fix_term'), 'fix');
  const vm = buildViewModel(makeState());
  const ops = vm.diffs[0].ops;
  assert.equal(ops[0].diffClass, 'add');
  assert.equal(ops[1].diffClass, 'narrow');
});

test('UI 매핑: image 33(쟁점·전략 심사관별) + image 13/15(비용)', () => {
  const vm = buildViewModel(makeState());
  const agents = vm.issuesByAgent.map((g) => g.agent).sort();
  assert.deepEqual(agents, ['examiner_A', 'examiner_B', 'examiner_C']);
  assert.equal(vm.cost.spentUsd, 0.0927);
  assert.equal(vm.cost.rounds.length, 1);
  assert.equal(vm.cost.rounds[0].latencyMs, 23504);
});

test('renderHTML: 스크린 매핑 문자열 증명(DOM-free) + 비결정성 고지', () => {
  const html = renderHTML(makeState(), { actor: 'jaeill.roh@gmail.com' });
  assert.match(html, /🔴 보정 필요/);       // AC-T2: '실패'→'보정 필요'
  assert.match(html, /변리사 확정 필요/);   // AC-T2: '사람 결정 필요'→'변리사 확정 필요'(긍정 프레이밍)
  assert.match(html, /review-op add/);     // diff 초록
  assert.match(html, /review-op narrow/);  // diff 빨강
  assert.match(html, /보조 자료/);          // §12 고지(AC-T2: '비결정적' 제거)
  assert.match(html, /표시만 — 작성모듈 미반영/); // 읽고 지적만
  assert.match(html, /data-act="approve"/);
});

test('render(): 사람 클릭 시에만 humanGate 경유 accepted 변경(fake DOM)', () => {
  // 최소 fake DOM — querySelectorAll/addEventListener/click 시뮬레이션.
  const handlers = [];
  function fakeEl() {
    return {
      _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
      ownerDocument: fakeDoc,
      querySelectorAll: (sel) => sel.includes('button') ? buttons : [],
      addEventListener() {},
    };
  }
  const buttons = [
    { attrs: { 'data-act': 'approve', 'data-plan': 'plan_1' }, getAttribute(k) { return this.attrs[k]; }, addEventListener(_e, fn) { handlers.push(fn); } },
  ];
  const fakeDoc = {
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild() {} },
  };
  const mountEl = fakeEl();
  const st = makeState();
  let changed = 0;
  render(st, mountEl, { actor: 'jaeill.roh@gmail.com', onChange: () => changed++ });
  assert.equal(st.patchPlans[0].accepted, undefined, '렌더만으로는 accepted 변경 없음');
  handlers[0](); // 사람 클릭 시뮬레이션
  assert.equal(st.patchPlans[0].accepted, true, '클릭(사람 actor) 후에만 승인');
  assert.ok(changed >= 1, 'onChange 호출');
});
