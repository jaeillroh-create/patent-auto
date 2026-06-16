/**
 * review-engine/__tests__/truncation-graceful.test.js
 * (d) truncation 해소 + (c) graceful degradation — runAgent 어댑터(kernel 0).
 *
 * - 잘림(stop_reason=max_tokens)+불균형 JSON → truncated 구분 → 재시도 maxTokens 16000 상향.
 * - schema_retry 이벤트에 stopReason·ot·textLen 진단 로깅.
 * - allSettled 격리: 3인 중 1인 실패 → 나머지로 완주(throw 안 함). 전원 실패 → escalate(rethrow).
 * - examiner maxTokens 8192 (opinion/patent).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { makeRunAgent, SchemaEscalateError } from '../adapters/runAgent.js';
import opinionExaminerB from '../profiles/opinion/agents/examiner_B.js';
import opinionAttorneyAuthor from '../profiles/opinion/agents/attorney_author.js';
import opinionDomainExpert from '../profiles/opinion/agents/domain_expert.js';
import { examiner_B as patentExaminerB, attorney_author as patentAttorneyAuthor, domain_expert as patentDomainExpert } from '../profiles/patent/agents/index.js';

// 응답 헬퍼(deps.transport 가 직접 반환하는 형상: text/stopReason/it/ot/latencyMs/provider/model).
const VALID = { text: '{"issues":[]}', stopReason: 'end_turn', it: 10, ot: 5, latencyMs: 1, provider: 'claude', model: 'm' };
const TRUNC = { text: '{"issues":[{"id":"x","type":"기재불비","description":"여기서 잘림', stopReason: 'max_tokens', it: 10, ot: 8192, latencyMs: 1, provider: 'claude', model: 'm' };
const EMPTY = { text: '', stopReason: 'end_turn', it: 10, ot: 0, latencyMs: 1, provider: 'claude', model: 'm' };

function mkAgent(id) {
  return {
    id, role: 'examiner', provider: 'claude', model: 'sonnet', maxTokens: 8192,
    reads: ['claims'], writes: ['issues'], systemPromptRef: `.claude/rules/agents/opinion/${id}.md`,
    outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
  };
}
const STATE = { claims: [{ id: 'c1', no: 1, type: 'independent', kind: 'general', anchorType: null, status: 'open', text: 't' }], spec: { sections: [] }, issues: [], citedPrior: [], invention: {}, moduleContext: {}, patchPlans: [] };

// behaviors: { agentId: [resp1, resp2, ...] } — 그 에이전트의 호출 순서별 응답.
function harness(agents, behaviors) {
  const calls = []; const events = [];
  const transport = async (call) => {
    const agentId = agents.map(a => a.id).find(id => String(call.system).includes(id)) || '?';
    const n = calls.filter(c => c.agentId === agentId).length;
    calls.push({ agentId, provider: call.provider, maxTokens: call.maxTokens });
    const seq = behaviors[agentId] || [VALID];
    return seq[Math.min(n, seq.length - 1)];
  };
  const runAgent = makeRunAgent({ transport, loadPrompt: async (ref) => 'PROMPT ' + ref, agents, onEvent: (e) => events.push(e) });
  return { runAgent, calls, events };
}

test('examiner maxTokens 8192 (opinion·patent)', () => {
  assert.equal(opinionExaminerB.maxTokens, 8192, 'opinion examiner_B');
  assert.equal(patentExaminerB.maxTokens, 8192, 'patent examiner_B');
});

// ★ 장문 산출자(IssueList/RebuttalSet) 일관 cap — attorney_author 잘림 해소 + domain_expert(IssueList 산출자) 정합.
//   첫콜 8192면 #161 잘림감지→16000 재시도가 불필요(불필요 왕복 제거). recheck 전용 Verdict(attorney_reviewer)는 단문 → 4096 유지.
test('★ attorney_author·domain_expert maxTokens 8192 (opinion·patent) — 장문 산출자 일관 cap', () => {
  assert.equal(opinionAttorneyAuthor.maxTokens, 8192, 'opinion attorney_author');
  assert.equal(patentAttorneyAuthor.maxTokens, 8192, 'patent attorney_author');
  assert.equal(opinionDomainExpert.maxTokens, 8192, 'opinion domain_expert');
  assert.equal(patentDomainExpert.maxTokens, 8192, 'patent domain_expert');
});

test('★ 잘림 감지 → 재시도 maxTokens 16000 상향 + 잘림 메시지', async () => {
  const agents = [mkAgent('examiner_B')];
  const { runAgent, calls, events } = harness(agents, { examiner_B: [TRUNC, VALID] }); // 1차 잘림, 재시도 성공
  const out = await runAgent({ mode: 'discover', state: STATE });
  assert.equal(calls.length, 2, '1차 + 재시도');
  assert.equal(calls[0].maxTokens, 8192, '1차 = agent.maxTokens(8192)');
  assert.equal(calls[1].maxTokens, 16000, '★ 재시도 = 16000 상향');
  const retry = events.find(e => e.kind === 'schema_retry');
  assert.ok(retry, 'schema_retry 이벤트');
  assert.equal(retry.truncated, true, 'truncated=true');
  assert.ok(retry.errors[0].includes('잘림'), '잘림 메시지');
  assert.ok(out && Array.isArray(out.issues), '재시도 성공 후 완주');
});

test('★ 진단 로깅: schema_retry 에 stopReason·ot·textLen', async () => {
  const agents = [mkAgent('examiner_B')];
  const { runAgent, events } = harness(agents, { examiner_B: [TRUNC, VALID] });
  await runAgent({ mode: 'discover', state: STATE });
  const retry = events.find(e => e.kind === 'schema_retry');
  assert.equal(retry.stopReason, 'max_tokens', 'stopReason 기록');
  assert.equal(retry.ot, 8192, 'ot(출력토큰) 기록');
  assert.ok(retry.textLen > 0, 'textLen 기록');
});

test('★ 빈응답은 잘림과 구분(truncated=false, "빈/비정형" 메시지)', async () => {
  const agents = [mkAgent('examiner_A')];
  const { runAgent, events, calls } = harness(agents, { examiner_A: [EMPTY, EMPTY] }); // 둘 다 빈응답 → escalate
  await assert.rejects(() => runAgent({ mode: 'discover', state: STATE }), SchemaEscalateError, '전원(1인) 실패 → escalate');
  const retry = events.find(e => e.kind === 'schema_retry');
  assert.equal(retry.truncated, false, 'truncated=false');
  assert.ok(retry.errors[0].includes('빈/비정형'), '빈/비정형 메시지');
  assert.equal(calls[1].maxTokens, 8192, '빈응답 재시도는 상향 안 함(원 maxTokens)');
});

test('★ graceful: 3인 중 1인 실패 → 나머지 2인으로 완주(throw 안 함)', async () => {
  const agents = [mkAgent('examiner_A'), mkAgent('examiner_B'), mkAgent('examiner_C')];
  const { runAgent, events } = harness(agents, {
    examiner_A: [VALID], examiner_C: [VALID],
    examiner_B: [TRUNC, TRUNC], // B 는 재시도도 잘림 → SchemaEscalateError → 격리
  });
  const out = await runAgent({ mode: 'discover', state: STATE });
  assert.ok(out, '★ 완주(전체 throw 안 함)');
  assert.equal(out.perAgent.length, 2, '살아남은 2인만 집계');
  const fail = events.find(e => e.kind === 'agent_failed');
  assert.ok(fail && fail.agent === 'examiner_B', 'examiner_B agent_failed 이벤트로 격리');
  assert.ok(out.warnings.some(w => w.includes('examiner_B') && w.includes('실패 격리')), '실패 격리 warning 노출');
});

test('★ 전원 실패 → escalate 유지(빈 리뷰 묵인 방지)', async () => {
  const agents = [mkAgent('examiner_A'), mkAgent('examiner_B'), mkAgent('examiner_C')];
  const { runAgent } = harness(agents, {
    examiner_A: [TRUNC, TRUNC], examiner_B: [TRUNC, TRUNC], examiner_C: [EMPTY, EMPTY],
  });
  await assert.rejects(() => runAgent({ mode: 'discover', state: STATE }), SchemaEscalateError, '★ 전원 실패 → SchemaEscalateError rethrow');
});

test('정상 경로 회귀 0: 전원 1차 성공 → 재시도/격리 없음', async () => {
  const agents = [mkAgent('examiner_A'), mkAgent('examiner_B'), mkAgent('examiner_C')];
  const { runAgent, calls, events } = harness(agents, { examiner_A: [VALID], examiner_B: [VALID], examiner_C: [VALID] });
  const out = await runAgent({ mode: 'discover', state: STATE });
  assert.equal(calls.length, 3, '각 1회 호출(재시도 없음)');
  assert.equal(out.perAgent.length, 3, '3인 집계');
  assert.ok(!events.some(e => e.kind === 'schema_retry' || e.kind === 'agent_failed'), '재시도/격리 이벤트 없음');
});
