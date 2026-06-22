/**
 * review-engine/__tests__/client-polling.test.js
 * B-T3 클라 폴링 — _defaultReviewRunner: review_runs INSERT → invoke(reviewRunId) → subscribePolling → 결과.
 *
 * opinion.js 를 vm 로드. App.sb(INSERT/invoke/poll)·window.ReviewUI(subscribePolling/openModalMessage)·
 * setTimeout(killer 캡처) 스텁으로 done/failed/180s-고착/동기폴백 검증.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const SNAP = { caseId: '10-1', parsed: { claims: [{ no: 1, text: 't' }] } };
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

// opinion.js 를 vm 로드 + 주입형 스텁 반환.
function load(cfg) {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  const cap = { insert: null, invokeBody: null, pollCount: 0, msgs: [], subOpts: null, timers: [] };
  let tid = 0;
  // App.sb: review_runs insert/select + functions.invoke
  const sb = {
    from: () => ({
      insert: (payload) => { cap.insert = payload; return { select: () => ({ single: async () => cfg.insertResult }) }; },
      select: () => ({ eq: () => ({ single: async () => { cap.pollCount++; return cfg.pollResult ? cfg.pollResult(cap.pollCount) : { data: {} }; } }) }),
      update: (patch) => { cap.update = patch; const ch = { eq: (c, v) => { (cap.updateEq = cap.updateEq || []).push([c, v]); return ch; } }; return ch; },
    }),
    functions: { invoke: async (_n, o) => { cap.invokeBody = o && o.body; return cfg.invokeResult || { data: { status: 'running' } }; } },
  };
  const ReviewUI = {
    isEnabled: () => true,
    openModalMessage: (m) => { cap.msgs.push(m); },
    subscribePolling: (o) => {
      cap.subOpts = o;
      if (cfg.drive) { (async () => { const s = await o.fetchState(); o.onTick(s); })(); }  // done/failed 자동 구동
      return { stop: () => { cap.stopped = true; } };
    },
  };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise, queueMicrotask,
    setTimeout: (fn, ms) => { const id = ++tid; cap.timers.push({ id, fn, ms }); return id; },
    clearTimeout: (id) => { cap.timers = cap.timers.filter((t) => t.id !== id); },
    setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb,
    App: { sb, currentUser: { id: 'u1', email: 'u@x.com' }, getReviewAuth: () => ({ keys: { claude: 'CK' }, assignments: {} }) },
    ReviewUI,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  const Opinion = sandbox.window.Opinion;
  Opinion.state = Object.assign(Opinion.state || {}, { current: { id: 'proj-9' } });
  return { Opinion, cap };
}

test('★ done: INSERT(run row) → invoke(reviewRunId 동봉) → 폴링 → result 반환', async () => {
  const RESULT = { issues: [{ id: 'x' }], patchPlans: [], phase: 'escalated', budget: {} };
  const { Opinion, cap } = load({
    insertResult: { data: { id: 'run-1' } },
    invokeResult: { data: { reviewRunId: 'run-1', status: 'running' } },
    pollResult: () => ({ data: { status: 'done', phase: 'escalated', result: RESULT } }),
    drive: true,
  });
  const out = await Opinion._defaultReviewRunner(SNAP);
  assert.deepEqual(cap.insert, { user_id: 'u1', project_id: 'proj-9', module: 'opinion', status: 'running' }, 'INSERT 페이로드');
  assert.equal(cap.invokeBody.reviewRunId, 'run-1', '★ invoke body 에 reviewRunId 동봉');
  assert.ok(cap.subOpts && typeof cap.subOpts.fetchState === 'function', 'subscribePolling 재사용');
  assert.equal(cap.subOpts.intervalMs, 2000, 'intervalMs 2000');
  assert.deepEqual(out, RESULT, '★ done → result 반환');
  assert.ok(cap.msgs.some((m) => m.includes('검증 중')), '진행 표시');
});

test('★ failed: 폴링 status=failed → null + 에러 메시지', async () => {
  const { Opinion, cap } = load({
    insertResult: { data: { id: 'run-2' } },
    invokeResult: { data: { reviewRunId: 'run-2', status: 'running' } },
    pollResult: () => ({ data: { status: 'failed', error: 'boom' } }),
    drive: true,
  });
  const out = await Opinion._defaultReviewRunner(SNAP);
  assert.equal(out, null, 'failed → null');
  assert.ok(cap.msgs.some((m) => m.includes('검증 실패') && m.includes('boom')), '에러 메시지');
});

test('★ 180s 고착 → killer 강제 종료(null + 타임아웃) — worker 사망 방어', async () => {
  const { Opinion, cap } = load({
    insertResult: { data: { id: 'run-3' } },
    invokeResult: { data: { reviewRunId: 'run-3', status: 'running' } },
    pollResult: () => ({ data: { status: 'running' } }),
    drive: false, // onTick 미구동(고착)
  });
  const p = Opinion._defaultReviewRunner(SNAP);
  await flush(); // INSERT/invoke/subscribePolling/killer 설정까지 진행
  const killer = cap.timers.find((t) => t.ms === 180000);
  assert.ok(killer, '180s killer 설정됨');
  killer.fn(); // 고착 시 강제 종료
  const out = await p;
  assert.equal(out, null, '타임아웃 → null');
  assert.ok(cap.msgs.some((m) => m.includes('시간 초과')), '타임아웃 메시지');
  // ③ 고착 정리(보조): killer 가 DB run 도 failed 로 정리(즉시성). pg_cron 백업과 별개로 사용자 즉시 인지.
  assert.deepEqual(cap.update, { status: 'failed', error: 'wall-clock timeout (client killer — worker 사망 추정)' }, '★ killer 가 review_runs 를 failed 로 UPDATE');
  assert.deepEqual(cap.updateEq, [['id', 'run-3'], ['status', 'running']], '★ 본인 run(id) + running 인 행만(막 done 된 행 덮어쓰기 방지)');
});

test('★ done/failed 정상 종료 시 killer 의 DB update 안 함(정상 run 보호)', async () => {
  const RESULT = { issues: [], phase: 'converged', budget: {} };
  const { cap } = await (async () => {
    const r = load({
      insertResult: { data: { id: 'run-ok' } },
      invokeResult: { data: { reviewRunId: 'run-ok', status: 'running' } },
      pollResult: () => ({ data: { status: 'done', phase: 'converged', result: RESULT } }),
      drive: true,
    });
    await r.Opinion._defaultReviewRunner(SNAP);
    return r;
  })();
  assert.equal(cap.update, null, 'done 으로 끝나면 killer 미발화 → DB update 0(정상 run 안 죽임)');
});

test('★ 동기 폴백: INSERT 실패(reviewRunId 없음) → invoke 동기 결과 반환(후방호환)', async () => {
  const SYNC = { issues: [{ id: 'y' }], phase: 'escalated' };
  const { Opinion, cap } = load({
    insertResult: { data: null },                 // INSERT 결과 없음 → reviewRunId null
    invokeResult: { data: SYNC },                  // 동기 결과
  });
  const out = await Opinion._defaultReviewRunner(SNAP);
  assert.equal(cap.invokeBody.reviewRunId, undefined, 'reviewRunId 미동봉(동기)');
  assert.deepEqual(out, SYNC, '동기 결과 그대로 반환');
  assert.equal(cap.subOpts, null, '폴링 안 함');
});

test('progressClient 재사용 + 브리지 노출 (소스 확인)', () => {
  const panel = readFileSync(path.join(REPO, 'review-engine/ui/opinion-review-panel.js'), 'utf8');
  assert.ok(panel.includes("from './progressClient.js'") && panel.includes('subscribePolling'), 'progressClient import');
  const bridge = (panel.match(/export const ReviewUI\s*=\s*\{[^}]*\}/) || [''])[0];
  assert.ok(bridge.includes('subscribePolling') && bridge.includes('openModalMessage'), 'ReviewUI 브리지에 노출(재구현 0)');
});

test('maxRounds=2 (② wall-clock 대응) — ★ 재배포 후 엔진 반영', () => {
  assert.equal(OpinionProfile.terminationPolicy.maxRounds, 2, 'maxRounds=2');
});
