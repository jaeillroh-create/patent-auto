/**
 * review-engine/__tests__/rounds-quick.test.js
 * (d) 임시 완화 — opinion maxRounds=1(discover-only)로 wall-clock 회피.
 *
 * 실제 orchestrator.run + 스텁 runAgent 로 검증: discover 1회만 발화하고 recheck 미발화,
 * discover 가 낸 쟁점이 결과에 실려 ESCALATED(200 경로)로 완주 — "전체 흐름 완주" 확인.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { run as orchestrate } from '../kernel/orchestrator.js';
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';

const SNAP = {
  caseId: 'C1',
  parsed: {
    application_no: '10-2024-1', invention_title: '열관리 장치',
    claims: [{ no: 1, text: '복수의 셀과 상기 셀을 제어하는 제어부를 포함하는 배터리 장치.' }],
    cited_references: [{ ref_no: 1, title: '인용문헌1' }],
    rejection_reasons: [{ article: '§42④', claim_nos: [1] }],
  },
  typeResult: { primary_type: '기재불비' },
  draftResult: { amended_claims: [{ claim_no: 1, amended: '복수의 셀과 제어부와 냉각 유로를 포함하는 배터리 장치.' }] },
  refText: '【0021】 냉각 유로 설명.', analysis: null, validation: null,
};

function mkState() {
  return OpinionProfile.adaptSnapshot(SNAP, null, { terminationPolicy: OpinionProfile.terminationPolicy });
}

test('opinion maxRounds = 1 (임시 discover-only), patent 은 미변경(12)', async () => {
  assert.equal(OpinionProfile.terminationPolicy.maxRounds, 1, 'opinion maxRounds 1');
  const Patent = (await import('../profiles/patent/PatentProfile.js')).default;
  assert.equal(Patent.terminationPolicy.maxRounds, 12, 'patent 은 이번 미변경(12)');
});

test('★ maxRounds=1 → discover 1회만 발화, recheck 미발화(자동보정 루프 제거)', async () => {
  const modes = [];
  const runAgent = async ({ mode }) => {
    modes.push(mode);
    if (mode === 'discover') {
      return {
        issues: [{ raisedBy: 'examiner_B', id: 'exB-1', type: '기재불비', severity: 'medium', target: ['claim_1'], legalBasis: '§42④', description: '청구항 1의 제어부 뒷받침 미흡.' }],
        consensus: {}, provider: 'examiner_B:claude', cost: 0.02, latencyMs: 100, perAgent: [], warnings: [],
      };
    }
    return { verdicts: [], provider: '', cost: 0, latencyMs: 0, perAgent: [], warnings: [] };
  };
  const result = await orchestrate(OpinionProfile, mkState(), { runAgent });
  assert.deepEqual(modes, ['discover'], '★ discover 1회만(recheck 호출 0)');
  assert.ok(result.issues.length >= 1, '쟁점이 결과에 실림(쟁점 발굴 표시 가능)');
  assert.equal(result.issues[0].raisedBy, 'examiner_B');
});

test('★ 완주 — maxRounds 하드캡으로 ESCALATED(200 경로)로 즉시 종료(무한 라운드 아님)', async () => {
  const runAgent = async ({ mode }) => (mode === 'discover'
    ? { issues: [{ raisedBy: 'examiner_A', id: 'exA-1', type: '거절미해소', severity: 'high', target: ['claim_1'], legalBasis: '§29②', description: '진보성 미흡.' }], consensus: {}, provider: 'x', cost: 0, latencyMs: 1, perAgent: [], warnings: [] }
    : { verdicts: [], provider: '', cost: 0, latencyMs: 0, perAgent: [], warnings: [] });
  const result = await orchestrate(OpinionProfile, mkState(), { runAgent });
  assert.equal(result.phase, 'escalated', 'maxRounds 하드캡 → ESCALATED(자동수렴 아님, 정상)');
  assert.ok((result.budget.roundsUsed || 0) <= 1, '라운드 1 이내 종료(wall-clock 회피)');
});

test('zero-issue 도 maxRounds=1 로 즉시 종료(빈 스핀 없음)', async () => {
  const runAgent = async ({ mode }) => (mode === 'discover'
    ? { issues: [], consensus: { examiner: true }, provider: 'x', cost: 0, latencyMs: 1, perAgent: [], warnings: [] }
    : { verdicts: [], provider: '', cost: 0, latencyMs: 0, perAgent: [], warnings: [] });
  const result = await orchestrate(OpinionProfile, mkState(), { runAgent });
  assert.ok((result.budget.roundsUsed || 0) <= 1, '빈 스핀 없이 1라운드 종료');
  assert.ok(Array.isArray(result.issues), '결과 정상');
});
