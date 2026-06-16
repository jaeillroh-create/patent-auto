/**
 * review-engine/__tests__/verdict-schema-fix.test.js
 * examiner_B·C recheck JSON 형식 실패 수정 — ★1 Verdict 스키마 완화(계약 정합) + ★2 extractJson 강화/배열폴백
 * + ★4 schema_retry head 로깅. (kernel 0 — 스키마 값 + 어댑터 관용성 + 프롬프트.)
 *
 * #161(max_tokens 잘림)과 다른 층위: end_turn 완전응답인데 형식/스키마 이탈을 흡수한다.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRunAgent, SchemaEscalateError, extractJson } from '../adapters/runAgent.js';
import { validate } from '../adapters/schemaValidate.js';
import VerdictSchema from '../contracts/schemas/Verdict.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

// ─── 하네스(truncation-graceful.test.js 미러) ───
function mkAgent(id) {
  return {
    id, role: 'examiner', provider: 'claude', model: 'sonnet', maxTokens: 8192,
    reads: ['claims'], writes: ['issues'], systemPromptRef: `.claude/rules/agents/opinion/${id}.md`,
    outputSchemaByMode: { discover: 'IssueList', recheck: 'Verdict' },
  };
}
const STATE = { claims: [{ id: 'c1', no: 1, type: 'independent', kind: 'general', anchorType: null, status: 'open', text: 't' }], spec: { sections: [] }, issues: [], citedPrior: [], invention: {}, moduleContext: {}, patchPlans: [] };
const ISSUE = { id: 'i1', type: '단일성', target: ['claim_1'], description: 'd' };
function harness(agents, behaviors) {
  const calls = []; const events = [];
  const transport = async (call) => {
    const agentId = agents.map((a) => a.id).find((id) => String(call.system).includes(id)) || '?';
    const n = calls.filter((c) => c.agentId === agentId).length;
    calls.push({ agentId });
    const seq = behaviors[agentId] || [];
    return seq[Math.min(n, seq.length - 1)];
  };
  const runAgent = makeRunAgent({ transport, loadPrompt: async (ref) => 'PROMPT ' + ref, agents, onEvent: (e) => events.push(e) });
  return { runAgent, calls, events };
}
const resp = (text) => ({ text, stopReason: 'end_turn', it: 5, ot: 50, latencyMs: 1, provider: 'claude', model: 'm' });

// ═══ ★1 Verdict 스키마 완화 — 계약 정합 ═══
test('★1 계약: orchestrator 가 읽는 필드(severity/type/target/legalBasis/coreElement/id) 통과', () => {
  // orchestrator.js:213 이 regression verdict 에서 읽는 필드 전부 포함 → 완화 후 검증 통과해야 함.
  const v = validate(VerdictSchema, { verdicts: [{
    issueId: 'exC-2', result: 'regression', regressionOf: 'plan_4(op:merge_claim,target:claim_3)', note: 'n',
    severity: 'high', type: '단일성', target: ['claim_1'], legalBasis: '§45', coreElement: 'x', id: 'reg_1',
  }] });
  assert.ok(v.ok, '계약 필드 통과해야 함(스키마-소비자 정합): ' + v.errors.join('; '));
});

test('★1 Verdict: top-level wrapper 여분 키(summary/consensus) 허용', () => {
  const v = validate(VerdictSchema, { verdicts: [{ issueId: 'x', result: 'resolved', note: 'n' }], summary: 's', consensus: { examiner: true } });
  assert.ok(v.ok, 'wrapper 여분 키 허용: ' + v.errors.join('; '));
});

test('★1 Verdict: 임의 여분 키(echo 드리프트) 허용 — 더는 검증 실패 안 함', () => {
  const v = validate(VerdictSchema, { verdicts: [{ issueId: 'x', result: 'resolved', note: 'n', confidence: 0.9, foo: 'bar' }] });
  assert.ok(v.ok, '여분 키여도 통과(드리프트 흡수): ' + v.errors.join('; '));
});

test('★1 Verdict: 구조 가드는 유지(required·result enum)', () => {
  assert.ok(!validate(VerdictSchema, { foo: [] }).ok, 'verdicts 필수 누락 → fail');
  assert.ok(!validate(VerdictSchema, { verdicts: [{ issueId: 'x', result: 'bogus' }] }).ok, 'result enum 위반 → fail');
  assert.ok(!validate(VerdictSchema, { verdicts: [{ result: 'resolved' }] }).ok, 'issueId 누락 → fail');
});

// ═══ ★2 extractJson 강화 ═══
test('★2 extractJson: 통째/프로즈래핑/펜스/trailing comma/배열/널', () => {
  assert.deepEqual(extractJson('{"verdicts":[]}'), { verdicts: [] }, '통째 객체');
  assert.deepEqual(extractJson('다음은 결과입니다:\n{"verdicts":[{"issueId":"x","result":"resolved"}]}\n끝.'),
    { verdicts: [{ issueId: 'x', result: 'resolved' }] }, '프로즈 앞뒤 래핑');
  assert.deepEqual(extractJson('```json\n{"verdicts":[]}\n```'), { verdicts: [] }, '코드펜스');
  assert.deepEqual(extractJson('{"verdicts":[{"issueId":"x","result":"resolved"},]}'),
    { verdicts: [{ issueId: 'x', result: 'resolved' }] }, '★ trailing comma 복구');
  assert.deepEqual(extractJson('[{"issueId":"x","result":"resolved"}]'),
    [{ issueId: 'x', result: 'resolved' }], '★ 배열 반환(래핑은 callOnce)');
  assert.equal(extractJson('설명만 있고 JSON 이 전혀 없음'), null, 'JSON 없음 → null');
});

// ═══ ★2 callOnce 배열 폴백 정규화 (통합) ═══
test('★2 배열 폴백: 모델이 [..] 만 내도 recheck verdicts 로 래핑·1차 통과(재시도 0)', async () => {
  const agents = [mkAgent('examiner_C')];
  const { runAgent, events } = harness(agents, { examiner_C: [resp('[{"issueId":"i1","result":"resolved","note":"n"}]')] });
  const out = await runAgent({ mode: 'recheck', state: STATE, issue: ISSUE });
  assert.ok(out && Array.isArray(out.verdicts), '배열 폴백 → verdicts 정상');
  assert.equal(out.verdicts[0].issueId, 'i1');
  assert.ok(!events.some((e) => e.kind === 'schema_retry'), '배열 래핑 성공 → 재시도 없음');
});

// ═══ ★1+★2 통합: 여분 필드 Verdict 도 recheck 1차 통과(재시도/격리 0) ═══
test('★1+★2 통합: 여분 필드(severity/type/target) 포함 Verdict → 1차 통과 + 필드 보존', async () => {
  const agents = [mkAgent('examiner_C')];
  const rich = JSON.stringify({ verdicts: [{ issueId: 'i1', result: 'regression', regressionOf: 'plan_1(op:x,target:claim_1)', note: 'n', severity: 'high', type: '단일성', target: ['claim_1'], legalBasis: '§45' }] });
  const { runAgent, events } = harness(agents, { examiner_C: [resp(rich)] });
  const out = await runAgent({ mode: 'recheck', state: STATE, issue: ISSUE });
  assert.equal(out.verdicts[0].severity, 'high', '★ orchestrator 가 읽는 severity 보존');
  assert.equal(out.verdicts[0].type, '단일성', 'type 보존');
  assert.deepEqual(out.verdicts[0].target, ['claim_1'], 'target 보존');
  assert.ok(!events.some((e) => e.kind === 'schema_retry'), '여분 필드여도 1차 통과(스키마 완화)');
});

// ═══ ★4 schema_retry head 로깅 ═══
test('★4 schema_retry: head 에 실패 응답 앞부분 기록(원인 확정용)', async () => {
  const agents = [mkAgent('examiner_A')];
  const prose = resp('죄송합니다. 다음은 분석입니다 — 설명만 있고 JSON 이 아님.'); // '{' 없음 → extractJson null
  const { runAgent, events } = harness(agents, { examiner_A: [prose, prose] }); // 둘 다 실패 → escalate
  await assert.rejects(() => runAgent({ mode: 'discover', state: STATE }), SchemaEscalateError);
  const retry = events.find((e) => e.kind === 'schema_retry');
  assert.equal(retry.truncated, false, 'truncated=false(형식 문제, 잘림 아님)');
  assert.ok(typeof retry.head === 'string' && retry.head.includes('JSON 이 아님'), '★ head 에 응답 앞부분 기록');
});

// ═══ ★3 프롬프트 강화 (examiner_B/C.md) ═══
test('★3 examiner_B/C.md: recheck 출력 형식 강제 문구 반영', () => {
  for (const f of ['examiner_B', 'examiner_C']) {
    const md = readFileSync(path.join(REPO, `.claude/rules/agents/opinion/${f}.md`), 'utf8');
    assert.match(md, /순수 JSON만/, f + ': 순수 JSON 강제');
    assert.match(md, /코드펜스/, f + ': 코드펜스 금지');
    assert.match(md, /큰따옴표/, f + ': note 큰따옴표 금지');
    assert.match(md, /echo 금지|옮겨 적지/, f + ': targetIssue echo 금지');
    assert.match(md, /top-level 키는 `verdicts` 하나만/, f + ': wrapper 여분 키 금지');
  }
});
