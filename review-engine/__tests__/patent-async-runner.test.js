/**
 * review-engine/__tests__/patent-async-runner.test.js
 *
 * T1(504 해소) — patent 검증 클라 러너를 opinion 비동기 패턴으로 이식.
 *   A1 비동기: review_runs INSERT → reviewRunId 동봉 invoke(Edge 202) → 폴링.
 *   A1 동기 폴백: reviewRunId 없으면(INSERT 실패) reviewRunId 미동봉 → 동기 결과 직반환.
 *   A2 maxRounds: PatentProfile 12→2 (워커 wall-clock 완주).
 *   A3 폴링/결정영속: _pollReviewRun(done→result)·_persistReviewDecision 이식.
 * ★ 화면 확인(504 없이 완주)은 변리사 실물 — PR 명시.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');
const PROFILE_SRC = readFileSync(path.join(REPO, 'review-engine/profiles/patent/PatentProfile.js'), 'utf8');

let Patent, hooks;

before(() => {
  hooks = {
    insert: async () => ({ data: { id: 'run-pat-1' }, error: null }),
    invoke: async () => ({ data: { status: 'running' } }),
    fetchState: async () => ({ data: {} }),
    pollResult: null,       // subscribePolling 가 auto-tick 으로 흘릴 결과
    lastBody: null,
    pollCalled: false,
  };
  // review_runs 체인: insert().select().single() vs select().eq().single() 구분(insert 플래그).
  const makeFrom = () => {
    let isInsert = false;
    const c = {
      insert: () => { isInsert = true; return c; },
      select: () => c, update: () => c, eq: () => c, order: () => c, limit: () => c,
      single: async () => (isInsert ? hooks.insert() : hooks.fetchState()),
      then: (f, r) => Promise.resolve({}).then(f, r), // 비-await update().eq() 무해 처리
    };
    return c;
  };
  const sb = {
    from: () => makeFrom(),
    functions: { invoke: async (name, opts) => { hooks.lastBody = opts && opts.body; return hooks.invoke(name, opts); } },
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} },
  };
  const App = {
    sb, currentUser: { id: 'u1' },
    getReviewAuth: () => ({ keys: { claude: 'CK' }, assignments: {} }),
    showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, callClaude: async () => ({ text: '' }),
  };
  const ReviewUI = {
    subscribePolling: (cfg) => {
      hooks.pollCalled = true;
      // 다음 마이크로태스크에 설정된 결과를 onTick 으로 흘림(폴링 흉내).
      Promise.resolve().then(() => { if (hooks.pollResult) cfg.onTick(hooks.pollResult); });
      return { stop() {} };
    },
    openModalMessage() {}, openModal() {}, isEnabled: () => true,
  };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, classList: { add() {}, remove() {} } }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, sb, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = ReviewUI;
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
  Patent = sandbox.window.Patent;
});

// ───────────────────────────── A1 비동기 ─────────────────────────────

test('★A1 비동기 — review_runs INSERT → reviewRunId 동봉 invoke(202) → 폴링 done→result', async () => {
  hooks.insert = async () => ({ data: { id: 'run-pat-1' }, error: null });
  hooks.invoke = async () => ({ data: { status: 'running' } });       // Edge 202(비동기)
  hooks.pollResult = { status: 'done', result: { issues: [], ok: true } };
  hooks.pollCalled = false;

  const out = await Patent._defaultReviewRunner({ caseId: 'C-PAT' });

  assert.equal(hooks.lastBody && hooks.lastBody.reviewRunId, 'run-pat-1', '★ invoke body 에 reviewRunId 동봉(비동기 분기)');
  assert.equal(hooks.lastBody.module, 'patent', 'module:patent 유지');
  assert.ok(hooks.pollCalled, '폴링 진입');
  assert.deepEqual(out, { issues: [], ok: true }, '폴링 done → result 반환');
  assert.equal(Patent._reviewRunId, 'run-pat-1', 'reviewRunId 보존(_persistReviewDecision 용)');
});

test('★A1 동기 폴백 — INSERT 실패(reviewRunId 없음) → reviewRunId 미동봉 + 동기 결과 직반환', async () => {
  hooks.insert = async () => ({ data: null, error: { message: 'no table' } }); // reviewRunId=null
  hooks.invoke = async () => ({ data: { issues: [{ id: 'x' }], phase: 'done' } }); // 동기 결과(status!=='running')
  hooks.pollCalled = false;
  hooks.pollResult = null;

  const out = await Patent._defaultReviewRunner({ caseId: 'C-PAT' });

  assert.equal(hooks.lastBody.reviewRunId, undefined, '★ reviewRunId 미동봉(동기 폴백)');
  assert.equal(hooks.lastBody.module, 'patent', 'module:patent');
  assert.equal(hooks.pollCalled, false, '폴링 미진입(동기)');
  assert.deepEqual(out, { issues: [{ id: 'x' }], phase: 'done' }, '동기 결과 직반환');
});

test('★A1 구 Edge 동기 — reviewRunId 있어도 status!==running 이면 결과 직반환(폴링 생략)', async () => {
  hooks.insert = async () => ({ data: { id: 'run-pat-2' }, error: null });
  hooks.invoke = async () => ({ data: { issues: [], status: 'done', phase: 'done' } }); // 구 Edge 가 동기로 결과
  hooks.pollCalled = false;

  const out = await Patent._defaultReviewRunner({ caseId: 'C' });
  assert.equal(hooks.pollCalled, false, '구 Edge 동기 결과 → 폴링 생략');
  assert.equal(out.status, 'done', '결과 직반환');
});

// ───────────────────────────── A3 폴링 ─────────────────────────────

test('★A3 _pollReviewRun — done → result', async () => {
  hooks.pollResult = { status: 'done', result: { issues: [{ id: 'i1' }] } };
  const r = await Patent._pollReviewRun('run-x');
  assert.deepEqual(r, { issues: [{ id: 'i1' }] }, 'done → result');
});

test('★A3 _pollReviewRun — failed → null', async () => {
  hooks.pollResult = { status: 'failed', error: '엔진 오류' };
  const r = await Patent._pollReviewRun('run-y');
  assert.equal(r, null, 'failed → null');
});

test('★A3 _persistReviewDecision — runId 없으면 no-op(블로킹 0)', () => {
  Patent._reviewRunId = null;
  assert.doesNotThrow(() => Patent._persistReviewDecision({ patchPlans: [] }), 'runId 없으면 안전 무동작');
});

// ───────────────────────────── A2 maxRounds + 소스 정합 ─────────────────────────────

test('★A2 PatentProfile maxRounds 12→2 (워커 wall-clock 완주)', () => {
  assert.match(PROFILE_SRC, /maxRounds:\s*2\b/, 'maxRounds 2');
  assert.doesNotMatch(PROFILE_SRC, /maxRounds:\s*12\b/, '구 12 제거');
});

test('소스 정합 — patent 러너가 opinion 패턴(review_runs·reviewRunId·폴링·결정영속) 이식', () => {
  assert.match(PATENT_SRC, /from\('review_runs'\)\.insert/, 'review_runs INSERT');
  assert.match(PATENT_SRC, /reviewRunId:\s*reviewRunId\s*\|\|\s*undefined/, 'invoke body 에 reviewRunId 동봉');
  assert.match(PATENT_SRC, /Patent\._pollReviewRun\s*=\s*function/, '_pollReviewRun 정의');
  assert.match(PATENT_SRC, /Patent\._persistReviewDecision\s*=\s*function/, '_persistReviewDecision 정의');
  assert.match(PATENT_SRC, /Patent\._persistReviewDecision\(rs\)/, 'onChange 에 결정영속 배선');
  // D2 기존 재사용 — applyAmendments + recheck 유지(신규 0)
  assert.match(PATENT_SRC, /Patent\.applyAmendments\(acc\);\s*if\s*\(Patent\._reviewRunner\)\s*Patent\.runReviewEngine/, 'applyAmendments+recheck 유지(D2 재사용)');
});
