/**
 * review-engine/__tests__/d2a-splice-rewrite.test.js
 * D2a — 승인 보정방향 splice 재작성 엔진(opinion.js). 옵션 B: 대상 청구항만 LLM 재작성, 나머지 byte-identical.
 *
 * 절대 제약 검증:
 *  - ★ 대상 청구항만 재작성, 비대상 byte-identical(drift 0) — splice 구조보장
 *  - _pendingRewrite 보류(확정 전 draftResult 미변경)
 *  - review_amendments 보존(D1 입력)
 *  - 승인(applyAmendments)이 재작성 자동 트리거 안 함(AC-T1)
 *
 * opinion.js 를 vm 샌드박스로 로드(approve-fix/client-polling 패턴). App.callClaude 스텁으로 재작성 응답 주입.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, cap, sandbox;

function load() {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  cap = { claudeCalls: 0, prompts: [], badFor: [] };
  const sb = {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x' } }) }) }),
      update: () => ({ eq: () => Promise.resolve({}) }),
    }),
    functions: { invoke: async () => ({ data: null }) },
  };
  const App = {
    sb, currentUser: { id: 'u1', email: 'u@x.com' },
    // 재작성 LLM 스텁: 프롬프트의 "대상 청구항 N" 으로 어느 청구항인지 식별 → 재작성 JSON 반환.
    callClaude: async (prompt) => {
      cap.claudeCalls++; cap.prompts.push(prompt);
      const m = String(prompt).match(/대상 청구항 (\d+) —/);
      const no = m ? Number(m[1]) : 0;
      if (cap.badFor.indexOf(no) >= 0) return { text: JSON.stringify({ claim_no: no, note: 'amended 없음(실패 유도)' }) };
      return { text: JSON.stringify({ claim_no: no, amended: 'REWRITTEN-' + no, spec_basis: ['【0035】'], amendments_summary: 'sum-' + no, amendment_methods: [{ method: '부가', target: 't', spec_paragraph: '【0035】', description: 'd' }] }) };
    },
  };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
  Opinion.usage = Opinion.usage || { calls: 0 };
  Opinion.updateUsageDisplay = function () {};
  Opinion.extractSpecificationText = async function () { return '【0035】 냉각 유로가 배치된다. '.repeat(10); };
}

// claims 1,2,5 — claim 5 만 승인 방향 보유.
function draftFixture() {
  return {
    amended_claims: [
      { claim_no: 1, original: 'O1', amended: 'A1', spec_basis: ['【0001】'] },
      { claim_no: 2, original: 'O2', amended: 'A2', spec_basis: ['【0002】'] },
      { claim_no: 5, original: 'O5', amended: 'A5', spec_basis: ['【0005】'],
        review_amendments: [{ op: 'add_limitation', direction: "청구항 5에 명세서 【0035】 '냉각 유로' 부가", planId: 'p1', approvedBy: 'u@x.com' }] },
    ],
  };
}

beforeEach(() => { load(); Opinion.state = Object.assign(Opinion.state || {}, { current: { id: 'proj-1' }, draftResult: draftFixture(), _pendingRewrite: null }); });

test('★ splice: 대상(claim 5)만 재작성, 비대상(1·2) byte-identical (drift 0)', async () => {
  const before = JSON.stringify(Opinion.state.draftResult);
  const pend = await Opinion.applyDirectionRewrite();
  assert.ok(pend, '_pendingRewrite 반환');
  assert.deepEqual(pend.targetClaimNos, [5], 'claim 5 만 재작성');
  const pArr = pend.draftResult.amended_claims;
  // 비대상 1·2 는 직전과 완전히 동일(byte-identical)
  assert.equal(JSON.stringify(pArr[0]), JSON.stringify(draftFixture().amended_claims[0]), '★ claim 1 불변(drift 0)');
  assert.equal(JSON.stringify(pArr[1]), JSON.stringify(draftFixture().amended_claims[1]), '★ claim 2 불변(drift 0)');
  // 대상 5 는 재작성 반영
  assert.equal(pArr[2].amended, 'REWRITTEN-5', '대상 5 문언 재작성');
  assert.equal(pArr[2]._d2_rewritten, true, 'D2 반영 표시');
  assert.equal(pArr[2].claim_no, 5, 'claim_no 보존');
  assert.equal(pArr[2].original, 'O5', 'original 보존');
  // ★ LLM 은 대상 1건만 호출(비대상 미호출)
  assert.equal(cap.claudeCalls, 1, '대상 1건만 LLM 호출');
  assert.ok(!cap.prompts.some((p) => /대상 청구항 1 —|대상 청구항 2 —/.test(p)), '비대상은 LLM 에 안 보냄');
  // ★ 라이브 draftResult 는 불변(보류)
  assert.equal(JSON.stringify(Opinion.state.draftResult), before, '★ draftResult 미변경(보류)');
});

test('★ _pendingRewrite 보류 — 확정 전 draftResult 안 덮어씀 + review_amendments 보존', async () => {
  await Opinion.applyDirectionRewrite();
  // 라이브 draftResult 의 claim 5 문언 그대로(A5)
  assert.equal(Opinion.state.draftResult.amended_claims[2].amended, 'A5', '라이브 문언 불변(A5)');
  // review_amendments 는 라이브·보류본 양쪽에 보존
  assert.equal(Opinion.state.draftResult.amended_claims[2].review_amendments.length, 1, '라이브 review_amendments 보존');
  assert.equal(Opinion.state._pendingRewrite.draftResult.amended_claims[2].review_amendments[0].direction.includes('냉각 유로'), true, '보류본 review_amendments 보존');
  // before/after 기록(D2c diff용)
  assert.equal(Opinion.state._pendingRewrite.before['5'], 'A5', 'before 기록');
  assert.equal(Opinion.state._pendingRewrite.after['5'], 'REWRITTEN-5', 'after 기록');
});

test('★ 승인(applyAmendments)이 재작성 자동 트리거 안 함 (AC-T1 보존)', () => {
  Opinion.state = Object.assign(Opinion.state, {
    draftResult: { amended_claims: [{ claim_no: 1, original: 'o', amended: 'a1' }] },
    parsed: { claims: [{ no: 1, text: 'a1' }], rejection_reasons: [{ claim_nos: [1] }] }, refText: '',
  });
  const plan = { id: 'plan_1', accepted: true, addressesIssues: ['exA-1'], ops: [{ op: 'add_limitation', target: 'claim_1', content: '방향', reason: 'exA-1' }] };
  Opinion.applyAmendments([plan]);
  assert.equal(cap.claudeCalls, 0, '★ 승인은 LLM 재작성 호출 0(자동 트리거 금지)');
  assert.equal(Opinion.state._pendingRewrite, null, '★ 승인은 _pendingRewrite 안 만듦');
});

test('opts.claimNos 필터 — 지정 대상만 재작성(승인분 교집합)', async () => {
  // claim 2 에도 승인 방향 추가 → 둘 다 승인분이지만 claimNos:[5] 만 재작성
  Opinion.state.draftResult.amended_claims[1].review_amendments = [{ op: 'add_limitation', direction: '청구항 2 방향', planId: 'p2' }];
  const pend = await Opinion.applyDirectionRewrite({ claimNos: [5] });
  assert.deepEqual(pend.targetClaimNos, [5], '지정한 5 만');
  assert.equal(cap.claudeCalls, 1, '1건만 호출');
});

test('실패 격리 — 한 대상 응답이 amended 없으면 그 대상만 failed, 나머지 성공', async () => {
  Opinion.state.draftResult.amended_claims[1].review_amendments = [{ op: 'add_limitation', direction: '청구항 2 방향', planId: 'p2' }];
  cap.badFor = [2]; // claim 2 응답엔 amended 없음
  const pend = await Opinion.applyDirectionRewrite();
  assert.deepEqual(pend.targetClaimNos, [5], '성공한 5 만 반영');
  assert.equal(pend.failed.length, 1, '실패 1건 기록');
  assert.equal(pend.failed[0].claim_no, 2, 'claim 2 실패');
  // claim 2 는 보류본에서도 원문 유지(부분 실패가 비대상/실패대상을 망치지 않음)
  assert.equal(pend.draftResult.amended_claims[1].amended, 'A2', 'claim 2 원문 유지');
});

test('승인 방향 없으면 no-op (재작성 0, 보류 없음)', async () => {
  Opinion.state.draftResult.amended_claims[2].review_amendments = []; // 승인 방향 제거
  const pend = await Opinion.applyDirectionRewrite();
  assert.equal(pend, null, '방향 없으면 null');
  assert.equal(cap.claudeCalls, 0, 'LLM 호출 0');
  assert.equal(Opinion.state._pendingRewrite, null, '보류 없음');
});
