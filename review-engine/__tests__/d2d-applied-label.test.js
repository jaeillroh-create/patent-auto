/**
 * review-engine/__tests__/d2d-applied-label.test.js
 * D2d — 보정서 "다. 보정 사유" D1 권고 블록에 D2 확정분 "(반영됨)" 공존 표시.
 *  - confirmRewrite(D2c)가 review_amendments[].applied=true 로 마킹한 것을 read 하여 라벨링.
 *  - ★ read만(write 0), D1(텍스트 권고)·D2(문언 반영) 공존 — D2가 D1 대체 아님.
 *
 * _buildAmendmentDocxHtml 을 vm 샌드박스에서 직접 호출(d1 패턴).
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion;

before(() => {
  const src = readModuleBundle(REPO, 'opinion');
  const sb = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }), functions: { invoke: async () => ({ data: null }) } };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App: { sb, currentUser: { id: 'u1' } },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
});

const PROJECT = { rejection_type: 'inventive_step' };
const PARSED = { claims: [{ no: 1, text: 'O1' }, { no: 5, text: 'O5' }] };
const LABEL = ' <b style="color:#1B5E20;font-size:9pt;">(반영됨)</b>';

function draft() {
  return { amended_claims: [
    { claim_no: 1, original: 'O1', amended: 'A1', amendments_summary: '요약1',
      review_amendments: [{ op: 'add_limitation', direction: '청구항 1에 X 부가', applied: false }] },        // 미반영(D1 권고만)
    { claim_no: 5, original: 'O5', amended: 'A5', amendments_summary: '요약5',
      review_amendments: [{ op: 'add_limitation', direction: '청구항 5에 냉각 유로 부가', applied: true }] },  // 반영됨(D2)
  ] };
}

test('★ applied=true → "(반영됨)" 라벨, applied=false → 라벨 없음', () => {
  Opinion.state = {};
  const html = Opinion._buildAmendmentDocxHtml(PROJECT, draft(), PARSED);
  assert.ok(html.includes('· 청구항 5에 냉각 유로 부가' + LABEL), '★ 반영분에 (반영됨) 라벨');
  assert.ok(html.includes('· 청구항 1에 X 부가</div>'), '★ 미반영분은 라벨 없음(direction 뒤 바로 </div>)');
  assert.ok(!html.includes('· 청구항 1에 X 부가' + LABEL), '미반영분에 (반영됨) 안 붙음');
});

test('★ D1↔D2 공존 — 두 청구항 모두 [AI 검증 보정 권고] 블록 렌더(D2가 D1 대체 아님)', () => {
  Opinion.state = {};
  const html = Opinion._buildAmendmentDocxHtml(PROJECT, draft(), PARSED);
  const blocks = html.split('[AI 검증 보정 권고]').length - 1;
  assert.equal(blocks, 2, '청구항 1·5 권고 블록 둘 다 렌더');
  // 미반영 방향(D1)도 여전히 텍스트 권고로 노출
  assert.ok(html.includes('청구항 1에 X 부가'), '미반영 방향도 권고로 공존');
  assert.ok(html.includes('청구항 5에 냉각 유로 부가'), '반영 방향도 표시');
});

test('한 청구항 내 혼재 — 반영/미반영 방향이 각각 라벨/무라벨', () => {
  Opinion.state = {};
  const dr = { amended_claims: [
    { claim_no: 3, original: 'O3', amended: 'A3', amendments_summary: '요약3',
      review_amendments: [
        { direction: '방향 A 반영', applied: true },
        { direction: '방향 B 미반영', applied: false },
      ] },
  ] };
  const html = Opinion._buildAmendmentDocxHtml(PROJECT, dr, { claims: [{ no: 3, text: 'O3' }] });
  assert.ok(html.includes('· 방향 A 반영' + LABEL), '반영 방향 라벨');
  assert.ok(html.includes('· 방향 B 미반영</div>'), '미반영 방향 무라벨');
});

test('review_amendments 없으면 권고 블록 0 (기존 동작 불변)', () => {
  Opinion.state = {};
  const dr = { amended_claims: [{ claim_no: 1, original: 'O1', amended: 'A1', amendments_summary: '요약1' }] };
  const html = Opinion._buildAmendmentDocxHtml(PROJECT, dr, PARSED);
  assert.ok(!html.includes('[AI 검증 보정 권고]'), '권고 블록 미생성');
  assert.ok(html.includes('다. 보정 사유'), '기존 보정 사유 섹션 유지');
});

test('★ read-only — 빌더가 draftResult/review_amendments 를 변형하지 않음', () => {
  Opinion.state = {};
  const dr = draft();
  const before = JSON.stringify(dr);
  Opinion._buildAmendmentDocxHtml(PROJECT, dr, PARSED);
  assert.equal(JSON.stringify(dr), before, '빌더 호출 후 draftResult 불변(applied 플래그·문언 그대로)');
});

test('안내문 — 반영분 있으면 "(반영됨)…반영 완료" 안내', () => {
  Opinion.state = {};
  const html = Opinion._buildAmendmentDocxHtml(PROJECT, draft(), PARSED);
  assert.ok(html.includes('반영 완료'), '반영분 청구항 안내에 반영 완료 문구');
});
