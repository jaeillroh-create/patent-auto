/**
 * review-engine/__tests__/d1-amendment-render.test.js
 * D1(옵션 C) — 끊긴 read 경로 연결: applyAmendments 가 기록한 승인 보정 "방향"
 * (amended_claims[].review_amendments[].direction)을 보정서/의견서 컨텍스트에 권고로 렌더.
 *
 * 절대 제약 검증:
 *  - ac.amended(청구항 문언) 변경 0 (D1은 read만 — 문언 자동변경 없음)
 *  - 승인분만 렌더(applyAmendments 는 accepted plan 만 review_amendments 에 기록)
 *  - review_amendments 없으면 기존 동작(빈 권고 블록 없음)
 *  - kernel 0 (opinion.js 빌더/컨텍스트부만)
 *
 * opinion.js 는 브라우저 전역(window.Opinion) 코드 → approve-fix.test.js 와 동일하게 vm 샌드박스 로드.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion;

before(() => {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  const sb = {
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({}) }),
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }),
      insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
    }),
    functions: { invoke: async () => ({ data: null }) },
  };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App: { sb, currentUser: { id: 'u1', email: 'u@x.com' } },
    ReviewUI: { isEnabled: () => true },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
});

const DIR1 = "청구항 1에 명세서 【0098】의 '냉각 유로' 구성을 부가하여 인용문헌1과 차별화";

/** 승인 방향이 claim 1 에만 있는 draftResult(인메모리 형상 — applyAmendments 가 만드는 것과 동일). */
function draftWithDir() {
  return {
    amended_claims: [
      { claim_no: 1, original: '원문1', amended: '보정문1', spec_basis: ['0098'], amendments_summary: '요약1',
        review_amendments: [{ op: 'add_limitation', direction: DIR1, reason: 'exA-1', planId: 'plan_1', approvedBy: 'u@x.com' }] },
      { claim_no: 2, original: '원문2', amended: '보정문2', spec_basis: [], amendments_summary: '요약2' }, // 승인 방향 없음
    ],
  };
}
const PARSED = { claims: [{ no: 1, text: '원문1' }, { no: 2, text: '원문2' }] };

test('_collectApprovedDirections — 승인 방향 수집(비어있지 않은 것만), 없으면 []', () => {
  const got = Opinion._collectApprovedDirections(draftWithDir());
  assert.equal(got.length, 1, 'claim 1 만');
  assert.equal(got[0].claim_no, 1);
  assert.deepEqual(got[0].directions, [DIR1]);
  // review_amendments 전무 → []
  assert.deepEqual(Opinion._collectApprovedDirections({ amended_claims: [{ claim_no: 1, amended: 'x' }] }), []);
  assert.deepEqual(Opinion._collectApprovedDirections({}), []);
  assert.deepEqual(Opinion._collectApprovedDirections(null), []);
  // 빈/공백 direction 은 제외
  assert.deepEqual(Opinion._collectApprovedDirections({ amended_claims: [{ claim_no: 1, review_amendments: [{ direction: '' }, { direction: '   ' }] }] }), []);
});

test('★ 보정서 — 승인 방향이 "다. 보정 사유"에 [AI 검증 보정 권고]로 렌더(승인분만)', () => {
  Opinion.state = {};
  const html = Opinion._buildAmendmentDocxHtml({ rejection_type: 'inventive_step' }, draftWithDir(), PARSED);
  assert.ok(html.includes('[AI 검증 보정 권고]'), '권고 블록 헤더');
  assert.ok(html.includes(DIR1), '승인 방향 원문 렌더');
  // 승인분(claim 1)만 → 권고 블록 1회. claim 2 는 review_amendments 없어 미렌더.
  const occ = html.split('[AI 검증 보정 권고]').length - 1;
  assert.equal(occ, 1, '승인된 claim 1 에만 1회(미승인 claim 2 는 0)');
  assert.ok(html.includes('자동 변경되지 않음'), 'attorney 계약 안내(문언 자동변경 없음)');
});

test('★ review_amendments 없으면 기존 동작 — 권고 블록 0(빈 블록 없음)', () => {
  Opinion.state = {};
  const plain = { amended_claims: [{ claim_no: 1, original: '원문1', amended: '보정문1', amendments_summary: '요약1' }] };
  const html = Opinion._buildAmendmentDocxHtml({ rejection_type: 'inventive_step' }, plain, PARSED);
  assert.ok(!html.includes('[AI 검증 보정 권고]'), '권고 블록 미생성');
  assert.ok(html.includes('다. 보정 사유'), '기존 보정 사유 섹션은 유지');
  assert.ok(html.includes('보정문1'), '기존 보정 후 문언 유지');
});

test('★ ac.amended(청구항 문언) 변경 0 — 빌더는 read-only', () => {
  Opinion.state = {};
  const dr = draftWithDir();
  const before = JSON.stringify(dr);
  const html = Opinion._buildAmendmentDocxHtml({ rejection_type: 'inventive_step' }, dr, PARSED);
  assert.equal(JSON.stringify(dr), before, '빌더 호출이 draftResult 를 변형하지 않음');
  assert.equal(dr.amended_claims[0].amended, '보정문1', 'ac.amended 불변');
  assert.ok(html.includes('보정문1'), '보정 후에는 여전히 원래 ac.amended 문언(권고로 대체되지 않음)');
});

test('★ 승인분만(applyAmendments 실경로) — accepted plan 만 review_amendments 기록 → 렌더; 미승인은 throw', () => {
  Opinion.state = {
    draftResult: { amended_claims: [{ claim_no: 1, original: '원문1', amended: '보정문1' }] },
    parsed: { claims: [{ no: 1, text: '원문1' }], rejection_reasons: [{ claim_nos: [1] }] },
    refText: '',
  };
  const accepted = { id: 'plan_1', accepted: true, addressesIssues: ['exA-1'],
    ops: [{ op: 'add_limitation', target: 'claim_1', content: DIR1, reason: 'exA-1' }] };
  Opinion.applyAmendments([accepted]);
  // op.content(방향) → review_amendments.direction
  const dirs = Opinion._collectApprovedDirections(Opinion.state.draftResult);
  assert.equal(dirs.length, 1);
  assert.equal(dirs[0].directions[0], DIR1, 'op.content 가 방향으로 기록');
  // 보정서에 렌더됨
  const html = Opinion._buildAmendmentDocxHtml({ rejection_type: 'inventive_step' }, Opinion.state.draftResult, { claims: [{ no: 1, text: '원문1' }] });
  assert.ok(html.includes('[AI 검증 보정 권고]') && html.includes(DIR1), '승인분 렌더');
  // ac.amended 는 applyAmendments 후에도 불변(방향은 메타로만 기록)
  assert.equal(Opinion.state.draftResult.amended_claims[0].amended, '보정문1', 'applyAmendments 도 문언 미변경');
  // 미승인 plan 은 반영 불가 → throw(I-2/E-19) ⇒ review_amendments 에 절대 들어가지 않음
  assert.throws(() => Opinion.applyAmendments([{ id: 'p2', accepted: false, ops: [{ op: 'x', target: 'claim_1', content: '몰래' }] }]), /미승인/);
});
