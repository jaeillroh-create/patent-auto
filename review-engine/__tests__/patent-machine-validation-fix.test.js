/**
 * review-engine/__tests__/patent-machine-validation-fix.test.js
 *
 * ★ 완성본 기계검증 ↔ Step 13(AI 검토) 통합 + '완성본 패널 AI로 수정'.
 *   Part1: Step13 프롬프트에 결정론적 기계검증 결함 주입(machineFindingsForReview) — 완성-단계 전용 검사(표제/부호정합) 제외.
 *   Part2: 완성본 패널 'AI로 수정'(fixSpecValidationIssues) — (A)중복 제거(코드) (B)부호의 설명 재생성 (C)상세설명 의미 보정.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const run = (expr) => vm.runInContext(expr, sandbox, { filename: 'e.js' });

const DUP_PARA =
  '제어부(100)는 입력 데이터를 수신하여 소정의 처리를 수행하고 그 결과를 출력부로 전달하도록 구성된다.\n\n' +
  '통신부(110)는 외부 장치와 데이터를 송수신하도록 구성되며 수신된 데이터를 제어부로 전달한다.\n\n' +
  '제어부(100)는 입력 데이터를 수신하여 소정의 처리를 수행하고 그 결과를 출력부로 전달하도록 구성된다.';

// ─────────── (A) _dedupParagraphs — 코드 결정론적 중복 제거 ───────────

test('★ _dedupParagraphs — 동일 문단 2회 → 1개 제거(첫 사본 보존)', () => {
  const r = JSON.parse(run('JSON.stringify(_dedupParagraphs(' + JSON.stringify(DUP_PARA) + '))'));
  assert.equal(r.removed, 1, '★ 중복 1개 제거');
  assert.equal((r.text.match(/제어부\(100\)는 입력 데이터를 수신/g) || []).length, 1, '★ 중복 사본 1개만 남음');
  assert.match(r.text, /통신부\(110\)/, '★ 비중복 문단 보존');
});

test('★ _dedupParagraphs — 중복 없으면 removed=0, 원문 불변', () => {
  const t = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하12345.\n\n서로 다른 문단으로서 별개의 구성요소를 설명하는 충분히 긴 문장이다 abcdefghij.';
  const r = JSON.parse(run('JSON.stringify(_dedupParagraphs(' + JSON.stringify(t) + '))'));
  assert.equal(r.removed, 0, '★ 제거 0');
});

test('★ _dedupParagraphs — 50자 미만 짧은 문단은 중복이어도 보존(오탐 방지)', () => {
  const t = '짧은 문단.\n\n다른 것.\n\n짧은 문단.';
  const r = JSON.parse(run('JSON.stringify(_dedupParagraphs(' + JSON.stringify(t) + '))'));
  assert.equal(r.removed, 0, '★ 짧은 문단은 제거 안 함');
});

// ─────────── (Part1) machineFindingsForReview — 필터·주입 ───────────

test('★ machineFindingsForReview — 상세설명 결함(문단중복)은 보고', () => {
  run('outputs.step_08 = ' + JSON.stringify(DUP_PARA) + '; outputs.step_09=""; outputs.step_13_applied="";');
  const out = run('machineFindingsForReview()');
  assert.match(out, /duplicate/, '★ 중복 결함(문단/문장) 주입 대상');
});

test('★ machineFindingsForReview — 완성-단계 전용 검사(heading_missing/refnum) 제외', () => {
  run('outputs.step_08 = ' + JSON.stringify(DUP_PARA) + ';');
  const out = run('machineFindingsForReview()');
  assert.ok(!/heading_missing/.test(out), '★ 표제 누락은 제외(상세설명엔 캐논 표제 없음 — 오탐 차단)');
  assert.ok(!/refnum_consistency/.test(out), '★ 부호정합은 제외(부호의 설명 생성 전 — 완성 패널 담당)');
});

test('★ machineFindingsForReview — 상세설명 없으면 빈 문자열', () => {
  run('outputs.step_08=""; outputs.step_09=""; outputs.step_13_applied=""; outputs.step_12=""; outputs.step_13_applied_method="";');
  assert.equal(run('machineFindingsForReview()'), '', '★ 입력 없으면 빈 결과');
});

// ─────────── 필터 집합 정의 ───────────

test('★ FIXABLE_CHECKS / _FINAL_ONLY_CHECKS 멤버십', () => {
  assert.equal(run("FIXABLE_CHECKS.has('refnum_consistency')"), true, '★ refnum 자동수정 대상');
  assert.equal(run("FIXABLE_CHECKS.has('paragraph_duplicate')"), true, '★ 중복 자동수정 대상');
  assert.equal(run("FIXABLE_CHECKS.has('heading_missing')"), false, '★ 표제 누락은 자동수정 제외(스텝 재실행 사안)');
  assert.equal(run("_FINAL_ONLY_CHECKS.has('refnum_consistency')"), true, '★ refnum 은 완성-단계 전용');
  assert.equal(run("_FINAL_ONLY_CHECKS.has('paragraph_duplicate')"), false, '★ 중복은 중간단계에서도 판정 가능');
});

// ─────────── 소스 배선 검증 ───────────

test('★ 소스 — Step13(buildPrompt) 에 machineFindingsForReview 주입', () => {
  assert.match(PATENT_SRC, /case 'step_13':\{[\s\S]*?machineFindingsForReview\(\)/, '★ step_13 케이스가 findings 계산');
  assert.match(PATENT_SRC, /기계검증이 발견한 결정론적 결함/, '★ 주입 배너 존재');
});

test('★ 소스 — 완성본 패널에 AI 수정 버튼 + fixSpecValidationIssues 3경로', () => {
  assert.match(PATENT_SRC, /btnFixSpecValidate[\s\S]*?onclick="fixSpecValidationIssues\(\)"/, '★ AI로 수정 버튼');
  assert.match(PATENT_SRC, /async function fixSpecValidationIssues\(\)/, '★ 수정 진입점 정의');
  assert.match(PATENT_SRC, /_dedupParagraphs\(dev\)/, '★ (A) 중복 제거');
  assert.match(PATENT_SRC, /부호의 설명.*목록을 작성|_collectBodyRefPairs\(\)/, '★ (B) 부호의 설명 재생성');
  assert.match(PATENT_SRC, /semIss[\s\S]*?parseEditInstructions/, '★ (C) 상세설명 의미 보정(편집지시)');
});

test('★ 소스 — 수정 대상 원본 갱신(step_13_applied/step_18) + 이력 보존', () => {
  assert.match(PATENT_SRC, /pushOutputHistory\('step_13_applied','fix','fixSpecValidation'\)/, '★ 상세설명 이력 보존');
  assert.match(PATENT_SRC, /pushOutputHistory\('step_18','fix','fixSpecValidation'\)/, '★ 부호의 설명 이력 보존');
});
