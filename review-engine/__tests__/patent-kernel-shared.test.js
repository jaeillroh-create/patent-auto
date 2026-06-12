/**
 * review-engine/__tests__/patent-kernel-shared.test.js
 * T8 — I-6: 동일 kernel이 PatentProfile 로 변경 없이 구동 + 3모듈(opinion/division/patent) 동일 kernel 사용.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run as orchestrate } from '../kernel/orchestrator.js';
import PatentProfile from '../profiles/patent/PatentProfile.js';
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';
import DivisionProfile from '../profiles/division/DivisionProfile.js';
import { adaptSnapshot } from '../profiles/patent/adapter.js';
import { consistencyRules } from '../profiles/patent/consistency.js';

function patState() {
  return adaptSnapshot({
    caseId: 'P', deviceAnchorStart: 7, methodAnchorStart: 0,
    inventionScope: null,
    outputs: {
      step_06: '청구항 1\n장치.\n청구항 7\n제1항에 있어서, 예측모듈을 더 포함하는 장치.',
      step_08: '상세설명(100). 예측 기능 없음.',
      step_07_mermaid: 'graph TD\nA[프로세서(100)]\nB[누락(999)]', step_18: '100: 프로세서',
    },
  }, null, { terminationPolicy: PatentProfile.terminationPolicy });
}

test('3모듈이 동일 ReviewProfile 8멤버 형상을 만족(kernel 호출 호환)', () => {
  for (const P of [OpinionProfile, DivisionProfile, PatentProfile]) {
    assert.ok(typeof P.adaptSnapshot === 'function' && Array.isArray(P.agents) && Array.isArray(P.issueCatalog));
    assert.ok(Array.isArray(P.consistencyRules) && P.scoreWeights && P.terminationPolicy && P.writer);
  }
});

test('동일 orchestrator 가 PatentProfile 로 R1→종료(kernel 불변, §5.2/E-11 발굴)', async () => {
  const st = patState();
  const runAgent = async ({ mode }) => {
    if (mode !== 'discover') return { verdicts: [], cost: 0, provider: 'mock', latencyMs: 1 };
    const issues = [];
    for (const r of consistencyRules) for (const v of r.check(st)) issues.push({ ...v, id: v.coreElement, raisedBy: 'examiner_B' });
    return { issues, consensus: {}, cost: 0.02, provider: 'mock', latencyMs: 1 };
  };
  const profile = { ...PatentProfile, terminationPolicy: { ...PatentProfile.terminationPolicy, maxRounds: 1 } };
  const res = await orchestrate(profile, st, { runAgent });
  assert.equal(res.phase, 'escalated', 'high 잔존 → escalate');
  assert.ok(res.issues.some((i) => i.ruleId === 'patent.anchor_support_structural'), '§5.2 앵커 뒷받침 발굴');
  assert.ok(res.issues.some((i) => i.ruleId === 'patent.render_consistency_structural'), 'E-11 렌더 정합 발굴');
});
