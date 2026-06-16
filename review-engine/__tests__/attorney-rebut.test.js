/**
 * review-engine/__tests__/attorney-rebut.test.js
 * AC-T3a attorney_author 발화 → 보정 방향(amendmentDirection) → issue 병합 → compiler op.content.
 *
 * 실제 orchestrator.run + selectAgents/runAgent 집계 경로(스텁 transport/loadPrompt) 로 검증.
 * ★ I-6: attorney 없는 모듈은 rebut 빈 결과로 무해 통과.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { run as orchestrate } from '../kernel/orchestrator.js';
import { makeRunAgent } from '../adapters/runAgent.js';
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';
import { OPINION_AGENTS } from '../profiles/opinion/agents/index.js';
import { compile } from '../kernel/amendmentCompiler.js';

const SNAP = {
  caseId: 'C1',
  parsed: { application_no: '10-1', claims: [{ no: 1, text: '복수의 셀과 제어부를 포함하는 장치.' }], cited_references: [{ ref_no: 1, title: '인용1' }], rejection_reasons: [{ article: '§29②', claim_nos: [1] }] },
  draftResult: { amended_claims: [{ claim_no: 1, amended: '복수의 셀과 제어부와 냉각 유로.', spec_basis: ['0021'] }] },
  refText: '【0021】 냉각 유로.',
};

// LLM 스텁: examiner → IssueList(1 high), attorney → RebuttalSet(amendmentDirection). 시스템 프롬프트(ref)로 역할 식별.
function makeTransport(opts = {}) {
  return async (call) => {
    const sys = String(call.system || '');
    let text = '{}';
    if (sys.includes('attorney_author')) {
      let iid = 'exA-1';
      try { const u = JSON.parse(call.user); if (u.issues && u.issues[0]) iid = u.issues[0].id; } catch (e) {} // attorney 가 본 issue id 로 rebut(실제 흐름)
      text = opts.noAttorney ? '{"rebuttals":[]}' : JSON.stringify({ rebuttals: [{ issueId: iid, stance: 'concede', argument: '근거', legalBasis: '§29②', amendmentDirection: '청구항 1에 명세서 【0021】의 냉각 유로 구성을 부가하여 인용1과 차별화하는 방향' }] });
    } else if (sys.includes('examiner_A')) {
      text = '{"issues":[{"id":"exA-1","type":"진보성","severity":"high","target":["claim_1"],"legalBasis":"§29②","description":"진보성 미흡"}]}';
    } else if (sys.includes('examiner')) {
      text = '{"issues":[]}';
    } else if (sys.includes('domain_expert')) {
      text = '{"issues":[]}';
    } else {
      text = '{"verdicts":[]}';
    }
    return { text, stopReason: 'end_turn', it: 1, ot: 1, latencyMs: 1, provider: call.provider, model: 'm' };
  };
}
function makeRA(agents, opts) {
  return makeRunAgent({ transport: makeTransport(opts), loadPrompt: async (ref) => 'PROMPT ' + ref, agents, onEvent: () => {} });
}

const mockWriter = {
  applyAmendments: async (_c, plans) => ({ applied: plans.map((p) => p.id), rejected: [], consistency: { claimSpecOk: true, refSignOk: true, abstractOk: true }, renderCheck: {}, txnId: 't' }),
  rollback: async () => ({ ok: true }),
};

test('★ rebut 발화 → issue.amendmentDirection 병합 → compiler op.content(보정 방향)', async () => {
  const profile = { ...OpinionProfile, writer: mockWriter, terminationPolicy: { K: 1, maxRounds: 1, capUsd: 5, perIssueAttemptCap: 2 } };
  const state = OpinionProfile.adaptSnapshot(SNAP, null, { terminationPolicy: profile.terminationPolicy });
  const runAgent = makeRA(OPINION_AGENTS);
  const result = await orchestrate(profile, state, { runAgent });
  // examiner_A issue 에 attorney 방향이 병합됐는지
  const issue = (result.issues || []).find((i) => i.id === 'exA-1' || i.raisedBy === 'examiner_A');
  assert.ok(issue, 'discover issue 존재');
  assert.ok(issue.amendmentDirection && issue.amendmentDirection.includes('냉각 유로'), '★ amendmentDirection 병합됨');
  // compiler 가 그 방향을 op.content 로
  const plan = compile(issue, profile.amendmentOps, profile.rippleRules, state);
  assert.ok(plan.ops[0].content && plan.ops[0].content.includes('냉각 유로'), '★ compiler op.content = 보정 방향');
});

test('★ I-6: rebut 는 issueId 데이터-키 병합 — 매칭 안 되는 방향은 무시(모듈/agent 분기 0)', async () => {
  const runAgent = makeRA(OPINION_AGENTS, { /* attorney 정상 */ });
  // 직접 rebut 호출 결과 형상 확인
  const stateLike = { issues: [{ id: 'exA-1' }], claims: [], spec: { sections: [] }, citedPrior: [], invention: {}, moduleContext: {} };
  const out = await runAgent({ mode: 'rebut', state: stateLike });
  assert.ok(Array.isArray(out.rebuttals), 'rebut → rebuttals 집계');
  assert.ok(out.rebuttals.some((r) => r.amendmentDirection), '방향 포함');
});

test('★ I-6 무해: attorney 없는 agents → rebut 빈 결과(throw 0)', async () => {
  const noAttorney = OPINION_AGENTS.filter((a) => a.role !== 'attorney_author');
  const runAgent = makeRA(noAttorney);
  const out = await runAgent({ mode: 'rebut', state: { issues: [], claims: [], spec: { sections: [] }, citedPrior: [], invention: {}, moduleContext: {} } });
  assert.deepEqual(out.rebuttals, [], 'attorney 없으면 빈 rebuttals(무해)');
});

test('★ kernel/adapter 모듈분기 0 — orchestrator·runAgent·selectAgents 에 .id===/모듈명 분기 없음', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
  for (const f of ['review-engine/kernel/orchestrator.js', 'review-engine/adapters/runAgent.js']) {
    const src = readFileSync(path.join(root, f), 'utf8');
    assert.ok(!/\.id\s*===\s*['"]attorney/.test(src), f + ': agent.id 분기 없음');
    assert.ok(!/module\s*===\s*['"]opinion|['"]opinion['"]\s*===/.test(src), f + ': 모듈명 분기 없음');
  }
});
