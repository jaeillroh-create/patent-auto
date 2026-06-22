/**
 * review-engine/__tests__/rounds-quick.test.js
 * opinion maxRounds 정책 — ② wall-clock 대응으로 3→2 축소(Claude 단독 6역할 1키).
 *
 * 실제 orchestrator.run + 스텁 runAgent/writer 로 검증: maxRounds=2 이면 R1 discover + recheck 1라운드 발화
 * (자동보정 루프 활성 → patchPlan 생성), 유한 종료(≤ maxRounds). ★ 값 변경은 Edge 재배포 후 엔진 반영.
 * ⚠️ 깊이 트레이드오프(convergence L3 우선): recheck 1회를 쓴 케이스는 수렴 인식용 여유 라운드가 없어
 *    resolved 여도 phase=ESCALATED(자동통과 금지 E-17 → 사람 게이트). 수렴 로직은 불변, maxRounds 값만 변경.
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
    rejection_reasons: [{ article: '§29②', claim_nos: [1] }],
  },
  typeResult: { primary_type: '진보성' },
  draftResult: { amended_claims: [{ claim_no: 1, amended: '복수의 셀과 제어부와 냉각 유로를 포함하는 배터리 장치.', spec_basis: ['0021'] }] },
  refText: '【0021】 냉각 유로 설명.', analysis: null, validation: null,
};

const mockWriter = {
  applyAmendments: async (_c, plans) => ({ applied: plans.map((p) => p.id), rejected: [], consistency: { claimSpecOk: true, refSignOk: true, abstractOk: true }, renderCheck: { svg: true, pptx: true, canvas: true }, txnId: 'tx' }),
  rollback: async () => ({ ok: true }),
};
function mkProfile() { return { ...OpinionProfile, writer: mockWriter }; }
function mkState(profile) { return OpinionProfile.adaptSnapshot(SNAP, null, { terminationPolicy: profile.terminationPolicy }); }

test('opinion maxRounds = 2 (② wall-clock 대응), patent 12 미변경 — ★ Edge 재배포 후 엔진 반영', async () => {
  assert.equal(OpinionProfile.terminationPolicy.maxRounds, 2, 'opinion maxRounds 2');
  const Patent = (await import('../profiles/patent/PatentProfile.js')).default;
  assert.equal(Patent.terminationPolicy.maxRounds, 12, 'patent 미변경(12 — 동기경로 평가는 본 PR 범위 밖, 별도)');
});

test('★ maxRounds=2 → R1 discover + recheck 정확히 1라운드 발화(patchPlan 생성)', async () => {
  const modes = [];
  const ALL = { examiner: true, attorney: true, expert: true };
  const runAgent = async ({ mode }) => {
    modes.push(mode);
    if (mode === 'discover') return { issues: [{ id: 'i1', type: '거절미해소', severity: 'high', target: ['claim_1'], legalBasis: '§29②', description: 'd', coreElement: 'i1', suggestedOp: 'add_limitation', status: 'open', occurrences: 1, raisedBy: 'examiner_A' }], consensus: ALL, cost: 0.01, provider: 'x', latencyMs: 1, perAgent: [], warnings: [] };
    return { verdicts: [{ issueId: 'i1', result: 'resolved' }], consensus: ALL, cost: 0.01, provider: 'x', latencyMs: 1, perAgent: [], warnings: [] };
  };
  const profile = mkProfile();
  const result = await orchestrate(profile, mkState(profile), { runAgent });
  assert.ok(modes.includes('rebut'), '★ attorney_author rebut 여전히 1회 발화(D1 보정권고 입력원 — maxRounds 축소와 무관, 유지)');
  assert.equal(modes.filter((m) => m === 'recheck').length, 1, '★ recheck 정확히 1라운드(3→2: recheck 1회 축소)');
  assert.ok(result.patchPlans.length >= 1, '★ patchPlan 생성(C 액션플랜 + D1 보정권고 토대)');
  assert.ok((result.budget.roundsUsed || 0) <= 2, '유한 종료 ≤ maxRounds(2)');
  // ⚠️ 깊이 트레이드오프: i1 은 recheck 에서 resolved 되나, 다음 평가 패스가 곧장 L3(rounds=2=cap)에 걸려
  //   phase 는 ESCALATED(수렴 인식용 여유 라운드 없음). 자동통과 금지(E-17) → 사람 게이트. (수렴 로직 불변)
  assert.equal(result.phase, 'escalated', 'maxRounds=2: 1 recheck 사용 시 수렴 인식 전 cap → ESCALATED');
});

test('유한 종료 — roundsUsed ≤ maxRounds(2)', async () => {
  const runAgent = async ({ mode }) => (mode === 'discover'
    ? { issues: [{ id: 'i2', type: '거절미해소', severity: 'high', target: ['claim_1'], legalBasis: '§29②', description: 'd', coreElement: 'i2', suggestedOp: 'add_limitation', status: 'open', occurrences: 1, raisedBy: 'examiner_A' }], consensus: {}, cost: 0, provider: 'x', latencyMs: 1, perAgent: [], warnings: [] }
    : { verdicts: [{ issueId: 'i2', result: 'remaining' }], consensus: {}, cost: 0, provider: 'x', latencyMs: 1, perAgent: [], warnings: [] }); // 미해소 반복 → 하드캡까지
  const profile = mkProfile();
  const result = await orchestrate(profile, mkState(profile), { runAgent });
  assert.ok((result.budget.roundsUsed || 0) <= 2, '★ 최대 maxRounds(2) 내 유한 종료');
});

test('zero-issue → 유한 종료(빈 스핀 ≤ maxRounds)', async () => {
  const runAgent = async ({ mode }) => (mode === 'discover'
    ? { issues: [], consensus: { examiner: true }, provider: 'x', cost: 0, latencyMs: 1, perAgent: [], warnings: [] }
    : { verdicts: [], provider: '', cost: 0, latencyMs: 0, perAgent: [], warnings: [] });
  const profile = mkProfile();
  const result = await orchestrate(profile, mkState(profile), { runAgent });
  assert.ok((result.budget.roundsUsed || 0) <= 2, '빈 스핀 ≤ 2라운드');
  assert.ok(Array.isArray(result.issues), '결과 정상');
});
