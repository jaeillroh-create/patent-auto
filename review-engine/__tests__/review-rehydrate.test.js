/**
 * review-engine/__tests__/review-rehydrate.test.js
 *
 * ★ 검증 결과 재수화 — review_runs.result 가 저장되는데 사건 로드 시 안 읽어 새로고침마다 초기화되던 문제.
 *   사건 로드(opinion loadData / patent openProject)가 review_runs 최신 done 1건을 조회해 메모리 reviewState 복원.
 *   ★ result 하나로 issues+보정안+승인상태(patchPlans[].accepted) 동시 복원(_persistReviewDecision 가 통째 저장).
 *   patent·opinion 공통. 기존 렌더 훅(renderPreview / _mountReviewResult) 재사용(신규 0).
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);
const OPINION_SRC = readModuleBundle(REPO, 'opinion');

// ── opinion loadData 행위검증: review_runs.result → Opinion.state.reviewState (accepted 포함) ──
let Opinion, tableData;

before(() => {
  tableData = {
    opinion_issue_analyses: { data: null }, opinion_draft_claims: { data: null },
    opinion_validation_results: { data: null }, opinion_opinion_drafts: { data: null },
    opinion_type_determinations: { data: null },
    review_runs: { data: null }, // 테스트별로 교체
  };
  const makeChain = (t) => {
    const c = { select: () => c, eq: () => c, order: () => c, limit: () => c, update: () => c, insert: () => c,
      maybeSingle: async () => tableData[t] || { data: null }, single: async () => tableData[t] || { data: null },
      then: (f) => Promise.resolve({}).then(f) };
    return c;
  };
  const sb = { from: (t) => makeChain(t), functions: { invoke: async () => ({ data: null }) } };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), sb, App: { sb, currentUser: { id: 'u1' } },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(OPINION_SRC, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
});

test('★ opinion loadData — review_runs.result 있으면 Opinion.state.reviewState 복원(issues+승인상태 accepted)', async () => {
  tableData.review_runs = { data: { result: {
    issues: [{ id: 'i1', severity: 'high' }, { id: 'i2', severity: 'medium' }],
    patchPlans: [{ id: 'p1', accepted: true }, { id: 'p2', accepted: true }],
    phase: 'escalated',
  } } };
  Opinion.state.current = null;            // renderDetail no-op(끝의 렌더가 DOM 안 건드리게)
  Opinion.state.reviewState = null;
  try { await Opinion.loadData('op1'); } catch (_e) { /* 끝의 renderDetail 이 throw 해도 reviewState 는 그 전에 설정됨 */ }

  const rs = Opinion.state.reviewState;
  assert.ok(rs, '★ reviewState 복원됨');
  assert.equal(rs.issues.length, 2, 'issues 복원');
  assert.equal(rs.patchPlans.filter((p) => p.accepted).length, 2, '★ 승인상태(accepted) 함께 복원');
});

test('★ opinion loadData — review_runs 없으면(null) reviewState 미설정 → 기존 "검증 시작" 버튼', async () => {
  tableData.review_runs = { data: null };
  Opinion.state.current = null;
  Opinion.state.reviewState = null;
  try { await Opinion.loadData('op2'); } catch (_e) {}
  assert.ok(!Opinion.state.reviewState, 'result 없으면 reviewState 미복원(null)');
});

// ── 소스 정합: 두 로드 함수 모두 review_runs 재수화(동일 쿼리·할당) — patent·opinion 공통 ──

test('★ opinion 소스 — loadData 에 review_runs(module=opinion·done) 6번째 쿼리 + reviewState 복원', () => {
  assert.match(OPINION_SRC, /from\('review_runs'\)\.select\('result'\)[\s\S]{0,160}\.eq\('module','opinion'\)[\s\S]{0,80}\.eq\('status','done'\)/, 'review_runs 쿼리(module=opinion, done)');
  assert.match(OPINION_SRC, /order\('created_at',\{ascending:false\}\)\.limit\(1\)\.maybeSingle\(\)\s*\n\s*\]\);/, '최신 1건 maybeSingle (Promise.all 6번째)');
  assert.match(OPINION_SRC, /if \(rr && rr\.result\) Opinion\.state\.reviewState = rr\.result;/, 'reviewState 복원 할당');
});

test('★ patent 소스 — openProject 에 review_runs(module=patent·done) 조회 + __patentReviewState 복원(stale 차단 null)', () => {
  assert.match(PATENT_SRC, /from\('review_runs'\)\.select\('result'\)[\s\S]{0,160}\.eq\('module', 'patent'\)[\s\S]{0,80}\.eq\('status', 'done'\)/, 'review_runs 쿼리(module=patent, done)');
  assert.match(PATENT_SRC, /window\.__patentReviewState = \(_rr && _rr\.data && _rr\.data\.result\) \|\| null;/, '★ result 복원 또는 null(stale 차단)');
  // 비용 회피: 새로고침 후 재검증 방지 의도 명문화
  assert.match(PATENT_SRC, /재수화|재검증.*방지|재검증/, '재수화/재검증 방지 주석');
});

test('★ 공통 — 두 모듈 모두 같은 재수화 패턴(검증결과 영속 vs 로드 격차 해소)', () => {
  // patent·opinion 둘 다 review_runs.select(result).eq(status,done) 로 재수화
  const patHas = /from\('review_runs'\)\.select\('result'\)/.test(PATENT_SRC);
  const opHas = /from\('review_runs'\)\.select\('result'\)/.test(OPINION_SRC);
  assert.ok(patHas && opHas, 'patent·opinion 둘 다 review_runs 재수화');
  // 승인상태는 result 안 — review_amendments 별도 재수화 불필요(개념 가드: opinion 은 draft_data 로 이미 영속)
  assert.match(OPINION_SRC, /opinion_draft_claims/, 'review_amendments(보정방향)는 draft_data 로 이미 재로드');
});
