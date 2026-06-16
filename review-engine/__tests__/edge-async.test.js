/**
 * review-engine/__tests__/edge-async.test.js
 * B-T2 dual-mode 엣지 핸들러 — reviewRunId 있으면 비동기(202+waitUntil+persist), 없으면 동기(후방호환).
 *
 * 실제 핸들러(review-orchestrate.ts) 타입스트리핑 import + fetch/Deno/EdgeRuntime 스텁.
 * persist 는 PostgREST PATCH(/rest/v1/review_runs) — fetch 스텁이 캡처.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import handler from '../edge/review-orchestrate.ts';
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';

const SNAP = {
  caseId: 'C1',
  parsed: { application_no: '10-1', claims: [{ no: 1, text: '복수의 셀과 제어부.' }], cited_references: [], rejection_reasons: [{ article: '§42④', claim_nos: [1] }] },
  draftResult: { amended_claims: [] }, refText: '명세서',
};
const ISSUE = '{"issues":[{"id":"x1","type":"기재불비","severity":"medium","target":["claim_1"],"legalBasis":"§42④","description":"제어부 뒷받침 미흡"}]}';

function providerBody(provider, text) {
  if (provider === 'claude') return { content: [{ text }], usage: { input_tokens: 1, output_tokens: 1 } };
  if (provider === 'gpt') return { choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
  return { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } };
}

// 핸들러 1회 실행. opts: { reviewRunId?, keys, assignments, providerStatus(=200|401), noEdgeRuntime, env }
async function run(opts = {}) {
  const patches = [];           // review_runs PATCH 캡처
  const providerCalls = [];
  let bgPromise = null;
  const stubFetch = async (url, o) => {
    const u = String(url);
    if (u.includes('/rest/v1/review_runs')) { patches.push({ url: u, method: o && o.method, body: o && o.body ? JSON.parse(o.body) : null }); return { ok: true, status: 204, json: async () => ({}), text: async () => '' }; }
    if (u.includes('.md')) return { ok: true, status: 200, text: async () => 'PROMPT ' + u, json: async () => ({}) };
    // provider 호출
    const provider = u.includes('anthropic') ? 'claude' : u.includes('openai') ? 'gpt' : 'gemini';
    providerCalls.push({ provider });
    if (opts.providerStatus === 401) return { ok: false, status: 401, json: async () => ({}), text: async () => '' };
    return { ok: true, status: 200, json: async () => providerBody(provider, ISSUE), text: async () => ISSUE };
  };
  const env = Object.assign({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc-key' }, opts.env || {});
  const origFetch = globalThis.fetch, origDeno = globalThis.Deno, origER = globalThis.EdgeRuntime, origLog = console.log, origErr = console.error;
  const logs = [];
  globalThis.fetch = stubFetch;
  globalThis.Deno = { env: { get: (n) => env[n] } };
  globalThis.EdgeRuntime = opts.noEdgeRuntime ? undefined : { waitUntil: (p) => { bgPromise = p; } };
  console.log = (...a) => logs.push(a.join(' ')); console.error = (...a) => logs.push(a.join(' '));
  let res;
  try {
    const body = { snapshot: SNAP, caseId: 'C1' };
    if (opts.reviewRunId) body.reviewRunId = opts.reviewRunId;
    if (opts.keys) body.keys = opts.keys;
    if (opts.assignments) body.assignments = opts.assignments;
    const req = { method: 'POST', headers: { get: (h) => /authorization/i.test(h) ? 'Bearer t' : null }, json: async () => body };
    res = await handler(req);
    if (bgPromise) await bgPromise;                          // 백그라운드 완주 대기
    else if (opts.reviewRunId) await new Promise((r) => setTimeout(r, 0)); // fire-and-forget tick
  } finally {
    globalThis.fetch = origFetch; globalThis.Deno = origDeno; globalThis.EdgeRuntime = origER; console.log = origLog; console.error = origErr;
  }
  const json = await res.json();
  return { res, json, patches, providerCalls, logs };
}

const ALL_CLAUDE = { examiner_A: 'claude', examiner_B: 'claude', examiner_C: 'claude', attorney_author: 'claude', attorney_reviewer: 'claude', domain_expert: 'claude' };

test('★ reviewRunId 있으면 202 {running} + EdgeRuntime.waitUntil + persist UPDATE {done, result}', async () => {
  const { res, json, patches } = await run({ reviewRunId: 'run-1', keys: { claude: 'CK' }, assignments: ALL_CLAUDE });
  assert.equal(res.status, 202, '즉시 202');
  assert.deepEqual(json, { reviewRunId: 'run-1', status: 'running' }, '202 본문');
  assert.equal(patches.length, 1, 'persist 1회');
  assert.ok(patches[0].url.includes('id=eq.run-1'), 'id 기준 PATCH');
  assert.equal(patches[0].method, 'PATCH');
  assert.equal(patches[0].body.status, 'done', 'status=done');
  assert.ok(patches[0].body.result && patches[0].body.result.issues.length >= 1, 'result.issues 영속');
  assert.ok(patches[0].body.updated_at, 'updated_at 갱신');
});

test('★ reviewRunId 없으면 동기 200 + 결과 인라인 (후방호환, persist 안 함)', async () => {
  const { res, json, patches } = await run({ keys: { claude: 'CK' }, assignments: ALL_CLAUDE });
  assert.equal(res.status, 200, '동기 200');
  assert.ok(json.issues && json.issues.length >= 1, '결과 인라인(issues)');
  assert.ok('phase' in json, 'phase 포함');
  assert.equal(patches.length, 0, '★ persist 안 함(reviewRunId 없음)');
});

test('★ 실패 → persist {failed, error}', async () => {
  const { res, json, patches } = await run({ reviewRunId: 'run-2', keys: { claude: 'CK' }, assignments: ALL_CLAUDE, providerStatus: 401 });
  assert.equal(res.status, 202, '비동기는 즉시 202(실패는 백그라운드)');
  assert.equal(patches.length, 1, 'persist 1회');
  assert.equal(patches[0].body.status, 'failed', 'status=failed');
  assert.ok(patches[0].body.error, 'error 기록');
  assert.ok(!('result' in patches[0].body) || patches[0].body.result == null, 'failed 엔 result 없음');
});

test('★ EdgeRuntime 미정의 환경에서도 안전 (가드) — 202 반환 + fire-and-forget persist', async () => {
  const { res, patches } = await run({ reviewRunId: 'run-3', keys: { claude: 'CK' }, assignments: ALL_CLAUDE, noEdgeRuntime: true });
  assert.equal(res.status, 202, 'EdgeRuntime 없어도 202(throw 0)');
  assert.equal(patches.length, 1, 'fire-and-forget 로 persist 수행');
});

test('★ persist PATCH 본문에 LLM 키 미포함(보안)', async () => {
  const { patches, logs } = await run({ reviewRunId: 'run-4', keys: { claude: 'SECRET-CK-XYZ' }, assignments: ALL_CLAUDE });
  const bodyStr = JSON.stringify(patches[0].body);
  assert.ok(!bodyStr.includes('SECRET-CK-XYZ'), 'persist 본문에 키 없음');
  assert.ok(!logs.join('\n').includes('SECRET-CK-XYZ'), '로그에도 키 없음');
});

test('SUPABASE_URL/SERVICE_ROLE 미주입 시 persist 스킵(throw 0)', async () => {
  const { res, patches } = await run({ reviewRunId: 'run-5', keys: { claude: 'CK' }, assignments: ALL_CLAUDE, env: { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined } });
  assert.equal(res.status, 202, '202 정상');
  assert.equal(patches.length, 0, '키 미주입 → PATCH 안 함(스킵)');
});

test('maxRounds 미변경(1 유지) — B-T2 는 비동기 구조만, maxRounds 1→3 은 B-T3', () => {
  assert.equal(OpinionProfile.terminationPolicy.maxRounds, 1, 'maxRounds 그대로 1');
});
