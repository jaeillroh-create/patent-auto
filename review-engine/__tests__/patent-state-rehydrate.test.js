/**
 * review-engine/__tests__/patent-state-rehydrate.test.js
 *
 * ★ patent [반영하기] "승인 보정 없음" — 화면·반영 데이터 소스 불일치(새로고침 내성).
 *   증상: 검증→새로고침→[반영하기] → "반영할 승인 보정 없음"(0건). 그러나 화면엔 검증 N건 + plan "승인됨".
 *   원인: 화면("검증 결과 보기"·"승인됨")은 window.__patentReviewState(review_runs.result 재수화·durable)를 읽고,
 *         반영 엔진(applyDirectionRewrite)은 outputs._review_applied(인메모리·projects 미영속)를 읽음 →
 *         새로고침 후 outputs._review_applied 휘발 → 0건. __patentReviewState 는 살아있는데 반영이 다른 변수를 봄.
 *   수정: Patent._collectApprovedSpecOps() 로 소스 통일 — __patentReviewState.patchPlans(accepted) 1순위(화면과 동일),
 *         outputs._review_applied 2순위(fallback). direction 비면 issue.description 으로 보강.
 *
 *   ★ vm 주의: outputs 는 module-top `let`(별도 runInContext 로 set/read). window===sandbox 라
 *     sandbox.window.__patentReviewState 가 patent.js 의 window.__patentReviewState.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');
const OPINION_SRC = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');

let Patent, sandbox, genCalls;

before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: { id: 'x' } }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, currentUser: { id: 'u1', email: 'v@x.com' }, showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, escapeHtml: (s) => String(s == null ? '' : s), callClaude: async () => ({ text: 'X' }) };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error, structuredClone: globalThis.structuredClone,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, classList: { add() {}, remove() {} } }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, sb, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => true, openModal() {}, openModalMessage() {}, subscribePolling: () => ({ stop() {} }), policy: () => ({ capUsd: 15, maxRounds: 2 }) };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
  Patent = sandbox.window.Patent;
});

const setOutputs = (obj) => vm.runInContext(
  'Object.keys(outputs).forEach(function(k){delete outputs[k];}); Object.assign(outputs,' + JSON.stringify(obj) + ');',
  sandbox, { filename: 'set.js' });
const readOutputs = () => JSON.parse(vm.runInContext(
  'JSON.stringify({step_08:outputs.step_08||null, applied:outputs._review_applied||null})', sandbox, { filename: 'read.js' }));

const DEV_BASE = '도 1을 참조하면, 장치(100)는 신뢰도 산출부(110)를 포함한다.';
const SIGN_BASE = '100: 장치\n110: 신뢰도 산출부';

// 새로고침 후 재수화된 검증결과(review_runs.result → __patentReviewState). 승인 plan 포함.
function rehydratedState(extra) {
  return Object.assign({
    phase: 'escalated',
    issues: [{ id: 'exB-1', severity: 'high', legalBasis: '§42④', target: ['claim_2'], description: '청구항 2 동적 가중부의 상세설명 뒷받침 부재(§42④)' }],
    patchPlans: [{ id: 'plan_1', accepted: true, addressesIssues: ['exB-1'],
      ops: [{ op: 'add_spec_support', target: 'claim_2', content: '동적 가중부의 갱신주기 산출을 상세설명에 보강' }] }],
  }, extra || {});
}

beforeEach(() => {
  Patent._pendingPatentRewrite = null;
  sandbox.window.__patentReviewState = null;   // 각 테스트가 명시 설정
  setOutputs({});                              // ★ 테스트 간 outputs._review_applied 누수 차단(fallback 오염 방지)
  genCalls = [];
  Patent._genSpecSupportParagraph = async (dir) => { genCalls.push(dir && dir.target); return '본 실시예에서 ' + (dir && dir.target) + ' 의 동작원리를 구체적으로 기술한다.'; };
});

test('★ 새로고침 시나리오 — __patentReviewState 에 승인 plan 있고 outputs._review_applied 없음 → [반영하기] 0건 아님', async () => {
  sandbox.window.__patentReviewState = rehydratedState();
  setOutputs({ step_08: DEV_BASE, step_18: SIGN_BASE });   // ★ _review_applied 없음(새로고침 후 휘발 재현)
  assert.equal(readOutputs().applied, null, '전제: outputs._review_applied 휘발(없음)');

  const rw = await Patent.applyDirectionRewrite();
  assert.ok(rw, '★ 0건 아님 — 승인 plan 을 읽어 반영본 생성');
  assert.equal(rw.appended.length, 1, 'plan_1 의 add_spec_support 1건 반영');
  assert.equal(rw.appended[0].target, 'claim_2', '대상 claim_2');
  assert.equal(rw.appended[0].planId, 'plan_1', 'planId 추적');
  assert.ok(rw.after.step_08.startsWith(DEV_BASE), 'APPEND(기존 보존)');
});

test('★ 화면·반영 같은 데이터 — _collectApprovedSpecOps 가 __patentReviewState.patchPlans(accepted) 를 읽음', () => {
  sandbox.window.__patentReviewState = rehydratedState();
  const ops = Patent._collectApprovedSpecOps();
  assert.equal(ops.length, 1, '승인 plan 1건 수집');
  assert.equal(ops[0].op, 'add_spec_support', 'op');
  assert.equal(ops[0].target, 'claim_2', 'target');
  assert.equal(ops[0].direction, '동적 가중부의 갱신주기 산출을 상세설명에 보강', '★ op.content(direction) 그대로');
  assert.equal(ops[0].planId, 'plan_1', 'planId');
});

test('★ direction(op.content) 비어도 issue.description 으로 보강 → 0건 아님', async () => {
  sandbox.window.__patentReviewState = rehydratedState({
    patchPlans: [{ id: 'plan_1', accepted: true, addressesIssues: ['exB-1'],
      ops: [{ op: 'add_spec_support', target: 'claim_2', content: '' }] }],   // ★ content 빈값
  });
  const ops = Patent._collectApprovedSpecOps();
  assert.equal(ops.length, 1, '빈 direction 이어도 수집(탈락 안 함)');
  assert.match(ops[0].direction, /상세설명 뒷받침 부재/, '★ issue.description 으로 basis 보강');
});

test('★ accepted=false plan 은 제외(화면 "승인됨" 기준과 동일)', () => {
  sandbox.window.__patentReviewState = rehydratedState({
    patchPlans: [
      { id: 'plan_1', accepted: false, addressesIssues: ['exB-1'], ops: [{ op: 'add_spec_support', target: 'claim_2', content: 'x' }] },
      { id: 'plan_2', accepted: null, addressesIssues: ['exB-1'], ops: [{ op: 'add_spec_support', target: 'claim_3', content: 'y' }] },
    ],
  });
  assert.equal(Patent._collectApprovedSpecOps().length, 0, '미승인(대기·거부) plan 제외');
});

test('★ fallback — __patentReviewState 없으면 outputs._review_applied(라이브 경로) 사용(T1 회귀 보호)', async () => {
  sandbox.window.__patentReviewState = null;
  setOutputs({ step_08: DEV_BASE, step_18: SIGN_BASE,
    _review_applied: [{ op: 'add_spec_support', target: 'claim_7', direction: '가중부 보강', planId: 'p1' }] });
  const ops = Patent._collectApprovedSpecOps();
  assert.equal(ops.length, 1, '★ __patentReviewState 없을 때 인메모리 로그 fallback');
  assert.equal(ops[0].planId, 'p1', 'fallback 엔트리 그대로');
  const rw = await Patent.applyDirectionRewrite();
  assert.ok(rw && rw.appended.length === 1, '라이브 경로도 정상(회귀 0)');
});

test('★ add_spec_support 없음(다른 op만 승인) → 빈 배열 → applyDirectionRewrite null', async () => {
  sandbox.window.__patentReviewState = rehydratedState({
    patchPlans: [{ id: 'plan_1', accepted: true, addressesIssues: ['exA-1'], ops: [{ op: 'narrow_scope', target: 'claim_1', content: '범위 한정' }] }],
  });
  assert.equal(Patent._collectApprovedSpecOps().length, 0, 'add_spec_support 아닌 op 제외');
  assert.equal(await Patent.applyDirectionRewrite(), null, '0건 → null');
});

// ── 소스 정합 ──

test('★ 소스 — applyDirectionRewrite 가 _collectApprovedSpecOps(통일 소스) 사용 + 재수화는 __patentReviewState 복원', () => {
  // 반영 엔진이 통일 헬퍼를 통해 소스를 읽는다(인라인 outputs._review_applied 필터 제거).
  const i = PATENT_SRC.indexOf('Patent.applyDirectionRewrite = ');
  const seg = PATENT_SRC.slice(i, i + 600);
  assert.match(seg, /var specOps = Patent\._collectApprovedSpecOps\(\)/, '★ applyDirectionRewrite 가 통일 헬퍼 사용');
  // 헬퍼가 __patentReviewState.patchPlans(화면 소스) 1순위, outputs._review_applied fallback.
  const j = PATENT_SRC.indexOf('Patent._collectApprovedSpecOps = ');
  const hseg = PATENT_SRC.slice(j, j + 1400);
  assert.match(hseg, /window\.__patentReviewState/, '★ 1순위: __patentReviewState(화면과 동일 소스)');
  assert.match(hseg, /pl\.accepted !== true/, '승인된 plan 만');
  assert.match(hseg, /outputs\._review_applied/, '2순위 fallback');
  assert.match(hseg, /issuesById|description/, 'direction 부재 시 issue 본문 보강');
  // openProject 재수화가 __patentReviewState 를 review_runs.result 에서 복원(#196 — 화면 소스 durable).
  assert.match(PATENT_SRC, /window\.__patentReviewState = \(_rr && _rr\.data && _rr\.data\.result\) \|\| null;/, '재수화: __patentReviewState 복원');
});

test('opinion 회귀 0 — opinion D2(applyDirectionRewrite/confirmRewrite) 불변', () => {
  assert.match(OPINION_SRC, /Opinion\.applyDirectionRewrite\s*=/, 'opinion D2a 유지');
  assert.match(OPINION_SRC, /Opinion\.confirmRewrite\s*=/, 'opinion D2c 유지');
});
