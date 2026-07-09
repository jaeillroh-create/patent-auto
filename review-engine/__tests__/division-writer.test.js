/**
 * review-engine/__tests__/division-writer.test.js
 * T7 — division.js WriterModule 2함수(exportSnapshot/applyAmendments) + 기존 로직 불변.
 * division.js 는 브라우저 classic script → vm 샌드박스로 로드(opinion-writer.test.js 동형).
 * 증명: I-1(원본 무변형) / I-2·E-19(승인분만) / E-27(원자성) / runAutoVerify 재사용.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Division;

before(() => {
  const src = readModuleBundle(REPO_ROOT, 'division');
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN,
    setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => ({ style: {}, appendChild() {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    App: { currentUser: { id: 'u1', email: 'jaeill.roh@gmail.com' }, ensureApiKey: () => true, getModelConfig: () => ({ inputCost: 1, outputCost: 1 }), buildAPIRequest: () => ({}), parseAPIResponse: () => ({}) },
    selectedProvider: 'claude', selectedModel: 'sonnet',
    sb: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({}) }) }), insert: () => ({}), upsert: () => ({}), delete: () => ({}) }) },
    fetch: async () => ({ json: async () => ({}) }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'division.js' });
  Division = sandbox.window.Division;
  Division.state = Object.assign(Division.state || {}, {
    current: { id: 'p1', application_number: '10-2024-0555', division_type: 'merge' },
    claims: [{ claim_number: 1, division_role: 'basis', original_text: '셀과 냉각 유로.' }],
    specParagraphs: [{ paragraph_number: '0021', content: '냉각 유로 기재. 충분한 길이의 명세서 본문.' }],
    divisionClaims: [{ claim_number: 1, claim_type: 'independent', claim_text: '셀과 냉각 유로와 예측 모듈.', basis_preserved: true, added_components: [{ content: '예측 모듈' }] }],
    unusedComponents: [], validationResults: [],
  });
});

test('exportSnapshot: 원본 무변형 deepClone(I-1) + adapter 입력 형상 정합', () => {
  const snap = Division.exportSnapshot();
  assert.equal(snap.caseId, '10-2024-0555');
  assert.equal(snap.divisionType, 'merge');
  assert.ok(Array.isArray(snap.divisionClaims) && Array.isArray(snap.originalClaims));
  snap.divisionClaims[0].claim_text = 'MUTATED';
  assert.equal(Division.state.divisionClaims[0].claim_text, '셀과 냉각 유로와 예측 모듈.', '원본 불변(I-1)');
});

test('applyAmendments: 미승인 plan throw(I-2/E-19), 원본 불변(E-27)', () => {
  const before = JSON.stringify(Division.state.divisionClaims);
  assert.throws(() => Division.applyAmendments([{ id: 'p_x', accepted: false, ops: [] }]), /미승인/);
  assert.throws(() => Division.applyAmendments([{ id: 'p_y', ops: [] }]), /미승인/);
  assert.equal(JSON.stringify(Division.state.divisionClaims), before, '예외 시 원본 불변(E-27)');
});

test('applyAmendments: 승인분만 구조적 반영 + runAutoVerify 재검증', () => {
  const plan = { id: 'plan_1', accepted: true, addressesIssues: ['nm-1'], ops: [{ op: 'add_spec_support', target: 'claim_1', content: '명세서 【0021】 근거 보강 방향', reason: 'nm-1' }] };
  const res = Division.applyAmendments([plan]);
  assert.equal(res.count, 1);
  const dc = Division.state.divisionClaims[0];
  assert.equal(dc.claim_text, '셀과 냉각 유로와 예측 모듈.', '산문 청구항 텍스트 불변(날조 금지)');
  assert.equal(dc.review_amendments.length, 1);
  assert.equal(dc.review_amendments[0].op, 'add_spec_support');
  assert.ok(Array.isArray(res.autoIssues), 'runAutoVerify 재검증 결과 회신');
});

test('회귀: 기존 runAutoVerify/_lcsRatio 동작 불변', () => {
  assert.equal(typeof Division.runAutoVerify, 'function');
  assert.equal(typeof Division._lcsRatio, 'function');
  assert.ok(Division._lcsRatio('셀과 냉각 유로', '셀과 냉각 유로') > 0.99);
});
