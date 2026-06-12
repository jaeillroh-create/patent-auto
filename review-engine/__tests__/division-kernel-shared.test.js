/**
 * review-engine/__tests__/division-kernel-shared.test.js
 * T7 — I-6 최종 증명: 동일 kernel(orchestrator/scorer/convergence)이 DivisionProfile 로
 * **변경 없이** 구동된다. opinion과 같은 kernel 함수를 division도 그대로 사용.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run as orchestrate } from '../kernel/orchestrator.js';
import { score } from '../kernel/scorer.js';
import { evaluate, VERDICT } from '../kernel/convergence.js';
import DivisionProfile from '../profiles/division/DivisionProfile.js';
import { adaptSnapshot } from '../profiles/division/adapter.js';
import { consistencyRules } from '../profiles/division/consistency.js';

function divState() {
  return adaptSnapshot({
    caseId: 'C', divisionType: 'merge',
    originalClaims: [{ claim_number: 1, original_text: '셀과 냉각 유로.' }],
    specParagraphs: [{ paragraph_number: '0021', content: '냉각 유로 기재. 충분한 길이의 명세서 본문 단락.' }],
    divisionClaims: [{ claim_number: 1, claim_type: 'independent', claim_text: '셀과 냉각 유로와 예측 모듈.', basis_preserved: true, added_components: [{ content: '예측 모듈', spec_source_text: '' }] }],
  }, null, { terminationPolicy: DivisionProfile.terminationPolicy });
}

test('동일 scorer/convergence 가 division state 에 동작(모듈 분기 없음)', () => {
  const st = divState();
  // division consistency → issues 주입(엔진은 profile.consistencyRules 호출만)
  for (const r of consistencyRules) for (const v of r.check(st)) st.issues.push({ ...v, status: 'open', occurrences: 1 });
  const s = score(st, DivisionProfile.scoreWeights);
  assert.ok(s.breakdown.highOpen >= 1, '§47 신규사항 high 가 scorer에 반영');
  const conv = evaluate(st, DivisionProfile.terminationPolicy);
  assert.equal(conv.verdict, VERDICT.CONTINUE, 'high open → 미수렴(동일 convergence)');
});

test('동일 orchestrator 가 DivisionProfile 로 R1→종료(kernel 불변)', async () => {
  const st = divState();
  // R1 discover: division consistency 위반을 issue 로 반환하는 mock runAgent.
  const runAgent = async ({ mode }) => {
    if (mode !== 'discover') return { verdicts: [], cost: 0, provider: 'mock', latencyMs: 1 };
    const issues = [];
    for (const r of consistencyRules) for (const v of r.check(st)) issues.push({ ...v, id: v.coreElement, raisedBy: 'examiner_A' });
    return { issues, consensus: {}, cost: 0.01, provider: 'mock', latencyMs: 1 };
  };
  // maxRounds=1 → R1 후 즉시 종료(writer 미호출). 동일 kernel.
  const profile = { ...DivisionProfile, terminationPolicy: { ...DivisionProfile.terminationPolicy, maxRounds: 1 } };
  const res = await orchestrate(profile, st, { runAgent });
  assert.equal(res.phase, 'escalated', 'high 잔존 → escalate(E-17 자동통과 금지)');
  assert.ok(res.issues.some((i) => i.legalBasis === '§47'), '§47 신규사항 issue 발굴');
  assert.ok(res.rounds.length >= 1 && typeof res.rounds[0].cost === 'number', '라운드 비용 기록');
});
