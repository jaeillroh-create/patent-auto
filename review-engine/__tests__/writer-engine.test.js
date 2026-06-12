/**
 * review-engine/__tests__/writer-engine.test.js
 * T6 — 엔진-side WriterModule(makeEngineWriter) 단위테스트.
 * 증명: simulate 근사 정합성(구조), txnId=null(rollback 미유발), state 무오염(격리), opinion.js 무관.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../kernel/stateStore.js';
import { makeEngineWriter, structuralConsistency } from '../profiles/opinion/writerAdapter.js';

function stateWith(opts) {
  const st = createState({ reviewId: 'r', caseId: 'C', module: 'opinion', terminationPolicy: {} });
  st.claims = [{ id: 'claim_1', no: 1, kind: 'anchor', anchorType: '부가', text: 'X' }];
  st.moduleContext = {
    notice: { rejectionReasons: [{ article: '§29②', claim_nos: [1], cited_refs: ['인용문헌1'] }] },
    amendments: { amended_claims: opts.amended || [] },
  };
  return st;
}

test('structuralConsistency: state 없으면 중립(true)', () => {
  assert.deepEqual(structuralConsistency(null), { claimSpecOk: true, refSignOk: true, abstractOk: true });
});

test('structuralConsistency: anchor spec_basis 부재 → claimSpecOk=false', () => {
  const st = stateWith({ amended: [{ claim_no: 1, per_cited_ref_diff: [{ ref_no: 1, difference: '차별점' }] }] }); // spec_basis 없음
  const c = structuralConsistency(st);
  assert.equal(c.claimSpecOk, false, 'anchor 뒷받침 구조 위반');
  assert.equal(c.abstractOk, true, '거절은 차별점 있어 해소(구조)');
});

test('structuralConsistency: 거절 차별점 부재 → abstractOk=false', () => {
  const st = stateWith({ amended: [{ claim_no: 1, spec_basis: ['0021'], per_cited_ref_diff: [] }] }); // 차별점 공백
  const c = structuralConsistency(st);
  assert.equal(c.abstractOk, false, '거절 미해소 구조');
});

test('makeEngineWriter: simulate → txnId=null(rollback 미유발) + 구조 정합성', async () => {
  const st = stateWith({ amended: [{ claim_no: 1, spec_basis: ['0021'], per_cited_ref_diff: [{ ref_no: 1, difference: 'D' }] }] });
  const w = makeEngineWriter(() => st);
  const res = await w.applyAmendments('C', [{ id: 'plan_1', addressesIssues: ['exA-1'] }], { simulate: true });
  assert.equal(res.txnId, null, 'simulate → txnId null → orchestrator rollback 미호출');
  assert.deepEqual(res.applied, ['plan_1']);
  assert.equal(res.consistency.claimSpecOk, true);
  assert.equal(res.consistency.abstractOk, true);
});

test('makeEngineWriter: applyAmendments 가 state 를 변형하지 않음(격리)', async () => {
  const st = stateWith({ amended: [{ claim_no: 1, spec_basis: ['0021'] }] });
  const before = JSON.stringify(st);
  const w = makeEngineWriter(() => st);
  await w.applyAmendments('C', [{ id: 'plan_1' }], { simulate: true });
  assert.equal(JSON.stringify(st), before, 'simulate 는 state 무오염(opinion.js 무관)');
});

test('makeEngineWriter: rollback no-op(ok), exportSnapshot 은 state 미주입 시 throw', async () => {
  const w0 = makeEngineWriter(() => null);
  assert.deepEqual(await w0.rollback('C', null), { ok: true });
  assert.throws(() => w0.exportSnapshot('C'), /state 미주입/);
});
