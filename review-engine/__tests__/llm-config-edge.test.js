/**
 * review-engine/__tests__/llm-config-edge.test.js
 * L-T4 Edge 핸들러 — body.keys 우선(env 폴백) + assignments override(I-6 데이터-키).
 *
 * 실제 핸들러(review-orchestrate.ts)를 Node 타입스트리핑으로 import.
 * fetch 를 스텁해 (a) 프롬프트 .md → ref 텍스트(에이전트 식별용), (b) provider 호출 → zero-issue IssueList.
 *   zero-issue 면 R1 discover(examiner_A/B/C) 후 consensus 미충족으로 maxRounds 빈 스핀→ESCALATE(추가 호출 0).
 *   → 기록된 provider 호출 = R1 examiner 들. 각 호출의 provider/key 로 resolveKey·override 검증.
 * provider 호출 body 의 system 텍스트에 에이전트 ref 가 실려(buildRequest) 에이전트를 식별한다.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import handler from '../edge/review-orchestrate.ts';

const ROLE_TOKENS = ['examiner_A','examiner_B','examiner_C','attorney_author','attorney_reviewer','domain_expert'];

// 최소 opinion 스냅샷(adaptSnapshot 입력).
const SNAP = {
  caseId: 'C1',
  parsed: {
    application_no: '10-2024-1', invention_title: '열관리 장치',
    claims: [{ no: 1, text: '복수의 셀과 상기 셀을 제어하는 제어부를 포함하는 배터리 장치.' }],
    cited_references: [{ ref_no: 1, title: '인용문헌1' }],
    rejection_reasons: [{ article: '§29②', claim_nos: [1] }],
  },
  typeResult: { primary_type: '진보성' },
  draftResult: { amended_claims: [{ claim_no: 1, amended: '복수의 셀과 제어부와 냉각 유로를 포함하는 배터리 장치.' }] },
  refText: '【0021】 냉각 유로 설명.', analysis: null, validation: null,
};

function providerOf(url) {
  if (url.includes('anthropic')) return 'claude';
  if (url.includes('openai')) return 'gpt';
  if (url.includes('generativelanguage')) return 'gemini';
  return null;
}
function keyOf(provider, url, headers) {
  if (provider === 'claude') return headers['x-api-key'] || '';
  if (provider === 'gpt') return (headers['Authorization'] || '').replace('Bearer ', '');
  if (provider === 'gemini') { const m = url.match(/[?&]key=([^&]+)/); return m ? m[1] : ''; }
  return '';
}
function providerBody(provider, text) {
  if (provider === 'claude') return { content: [{ text }], usage: { input_tokens: 1, output_tokens: 1 } };
  if (provider === 'gpt') return { choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
  return { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } };
}

// 핸들러 1회 실행 — record(provider 호출들)·consoleSink 반환. globalThis.fetch/Deno 스텁 후 복원.
async function runHandler({ keys, assignments, env }) {
  const record = [];           // { agent, provider, key }
  const consoleSink = [];
  const stubFetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('.md')) { return { ok: true, status: 200, async text() { return 'PROMPT ' + u; }, async json() { return {}; } }; }
    const provider = providerOf(u);
    const headers = (opts && opts.headers) || {};
    const bodyStr = (opts && opts.body) ? String(opts.body) : '';
    const agent = ROLE_TOKENS.find(t => bodyStr.includes(t)) || '?';
    record.push({ agent, provider, key: keyOf(provider, u, headers) });
    return { ok: true, status: 200, async json() { return providerBody(provider, '{"issues":[]}'); }, async text() { return '{"issues":[]}'; } };
  };
  const origFetch = globalThis.fetch, origDeno = globalThis.Deno, origLog = console.log;
  globalThis.fetch = stubFetch;
  globalThis.Deno = { env: { get: (n) => (env || {})[n] } }; // loadPrompt 도 Deno 참조 → 항상 제공
  console.log = (...a) => consoleSink.push(a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (_e) { return String(x); } }).join(' '));
  let res;
  try {
    const body = { snapshot: SNAP, caseId: 'C1' };
    if (keys) body.keys = keys;
    if (assignments) body.assignments = assignments;
    const req = { method: 'POST', headers: { get: (h) => /authorization/i.test(h) ? 'Bearer test' : null }, json: async () => body };
    res = await handler(req);
  } finally {
    globalThis.fetch = origFetch; globalThis.Deno = origDeno; console.log = origLog;
  }
  const byAgent = {}; record.forEach(r => { byAgent[r.agent] = r; });
  return { res, record, byAgent, consoleSink };
}

test('body.keys 사용(사용자 키) — assignments 없으면 원본 provider 유지', async () => {
  const { res, byAgent, record } = await runHandler({ keys: { claude: 'CK', gpt: 'GK', gemini: 'MK' } });
  assert.equal(res.status, 200, '핸들러 200');
  assert.ok(record.length >= 3, 'R1 examiner 3인 호출됨');
  assert.equal(byAgent.examiner_A.provider, 'gpt', 'examiner_A 원본=gpt');
  assert.equal(byAgent.examiner_A.key, 'GK', '★ body.keys.gpt 사용(env 아님)');
  assert.equal(byAgent.examiner_B.provider, 'gemini', 'examiner_B 원본=gemini');
  assert.equal(byAgent.examiner_B.key, 'MK', 'body.keys.gemini 사용');
});

test('★ env 폴백 — body.keys 없으면 Deno.env(ENV_KEYS)', async () => {
  const { byAgent } = await runHandler({ env: { OPENAI_API_KEY: 'ENV-GPT', GEMINI_API_KEY: 'ENV-GEM', ANTHROPIC_API_KEY: 'ENV-CLAUDE' } });
  assert.equal(byAgent.examiner_A.provider, 'gpt');
  assert.equal(byAgent.examiner_A.key, 'ENV-GPT', '★ body 없음 → env 폴백(후방호환)');
  assert.equal(byAgent.examiner_B.key, 'ENV-GEM', 'gemini env 폴백');
});

test('★ assignments override — examiner_A→claude (데이터-키), 미지정은 원본 유지', async () => {
  const { byAgent } = await runHandler({
    keys: { claude: 'CK', gpt: 'GK', gemini: 'MK' },
    assignments: { examiner_A: 'claude', examiner_B: 'claude' },
  });
  assert.equal(byAgent.examiner_A.provider, 'claude', '★ examiner_A gpt→claude override');
  assert.equal(byAgent.examiner_A.key, 'CK', 'claude 키 사용');
  assert.equal(byAgent.examiner_B.provider, 'claude', 'examiner_B gemini→claude override');
  assert.equal(byAgent.examiner_C.provider, 'gpt', '미지정 examiner_C 는 원본 gpt 유지');
});

test('★ 1키 전역 — assignments 6역할 전부 claude → 모든 호출 claude/CK', async () => {
  const assignments = {}; ROLE_TOKENS.forEach(r => { assignments[r] = 'claude'; });
  const { record } = await runHandler({ keys: { claude: 'CK' }, assignments });
  assert.ok(record.length >= 3, '호출됨');
  record.forEach(r => {
    assert.equal(r.provider, 'claude', r.agent + ' → claude(전역)');
    assert.equal(r.key, 'CK', r.agent + ' → CK');
  });
});

test('후방호환 — keys/assignments 둘 다 없으면 env 방식 그대로(원본 provider)', async () => {
  const { byAgent } = await runHandler({ env: { OPENAI_API_KEY: 'E1', GEMINI_API_KEY: 'E2' } });
  assert.equal(byAgent.examiner_A.provider, 'gpt', '원본 provider 유지');
  assert.equal(byAgent.examiner_C.provider, 'gpt');
  assert.equal(byAgent.examiner_B.provider, 'gemini');
});

test('★ 키값이 console(이벤트 로그)에 노출 0', async () => {
  const assignments = {}; ROLE_TOKENS.forEach(r => { assignments[r] = 'claude'; });
  const { consoleSink } = await runHandler({ keys: { claude: 'SECRET-CK-XYZ' }, assignments });
  const all = consoleSink.join('\n');
  assert.ok(all.length > 0, '이벤트 로그는 존재(관측)');
  assert.ok(!all.includes('SECRET-CK-XYZ'), '★ 키값이 로그에 없음(노출 0)');
});
