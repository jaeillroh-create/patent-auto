/**
 * review-engine/__tests__/patent-validator-falsepos-fix.test.js
 *
 * ★ 실전 A/B 평가(2026-07-21)에서 발견된 검증기 오탐 2건 수정(§6-4).
 *   §6-4a CHK-8: 그룹 정의("wc, wa, wg는 …가중치")·아래첨자(wᵢ) 미인식 → math_var_undefined 오탐.
 *   §6-4b CHK-6: 도면의 간단한 설명 "도 N은 ~이다"가 상세설명 도입부에 정당 반복 → sentence_duplicate 오탐.
 *   두 수정 모두 "진성 결함 검출력은 유지"(회귀 테스트 동반).
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

const checks = (spec, name) => JSON.parse(vm.runInContext(
  'JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check===' + JSON.stringify(name) + ';}))',
  sandbox, { filename: 'e.js' }));

// ─────────── §6-4a CHK-8 그룹정의·아래첨자 오탐 수정 ───────────

test('★ §6-4a — 그룹 정의("wc, wa, wr, wg는 …가중치")는 전부 정의로 인정(오탐 0)', () => {
  const spec = '【수학식 1】\nS = wc + wa + wr + wg\n여기서, wc, wa, wr, wg는 각 신호에 대응하는 가중치로서 0 이상 1 이하의 값이고, S는 종합 점수이다.';
  assert.equal(checks(spec, 'math_var_undefined').length, 0, '★ 나열 앞 변수(wc/wa/wr)도 정의 인정');
});

test('★ §6-4a — 아래첨자 변수(wᵢ)도 온전히 추출·정의 인정', () => {
  const spec = '【수학식 1】\nY = wᵢ + b\n여기서, wᵢ는 i번째 가중치이고, b는 바이어스이며, Y는 출력값이다.';
  assert.equal(checks(spec, 'math_var_undefined').length, 0, '★ wᵢ 토큰화·정의 매칭(오탐 0)');
});

test('★ §6-4a 회귀 — 진짜 미정의 변수는 여전히 검출', () => {
  const spec = '【수학식 1】\nY = a + b + Z\n여기서, a, b는 계수이다.';
  const iss = checks(spec, 'math_var_undefined');
  assert.ok(iss.length >= 1, '★ 정의 없는 Y·Z 검출 유지');
  assert.match(iss[0].detail, /Z/, '★ Z가 미정의로 지목');
});

// ─────────── §6-4b CHK-6 도면설명 정당반복 오탐 수정 ───────────

const DRAW_SENT = '도 1은 서사 구조화 및 제작 메모리 기반 적응형 모델 라우팅 시스템의 전체 구성을 나타내는 블록도이다.';

test('★ §6-4b — 도면의 간단한 설명 ↔ 상세설명 도입부 동일 문장은 중복 아님(오탐 0)', () => {
  const spec = '【도면의 간단한 설명】\n' + DRAW_SENT + '\n\n【발명을 실시하기 위한 구체적인 내용】\n' + DRAW_SENT + ' 도 1을 참조하면, 제어부(100)는 입력을 처리한다.';
  assert.equal(checks(spec, 'sentence_duplicate').length, 0, '★ 도면설명 정당 반복은 sentence_duplicate 미검출');
  assert.equal(checks(spec, 'paragraph_duplicate').length, 0, '★ 문단 중복도 미검출');
});

test('★ §6-4b 회귀 — 상세설명 내부의 진짜 문단 중복은 여전히 CRITICAL', () => {
  const dup = '제어부(100)는 입력 데이터를 수신하여 소정의 처리를 수행하고 그 결과를 출력부로 전달하도록 구성되며 상태를 관리한다.';
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n' + dup + '\n\n통신부(110)는 외부와 통신한다.\n\n' + dup;
  assert.ok(checks(spec, 'paragraph_duplicate').length >= 1, '★ 진성 문단 중복 검출 유지');
});

// ─────────── 소스 배선 ───────────

test('★ 소스 — CHK-8 그룹정의 인정 + CHK-6 도면설명 제외', () => {
  assert.match(PATENT_SRC, /그룹 정의 인정/, '★ §6-4a 그룹정의 주석');
  assert.match(PATENT_SRC, /const _dcl=/, '★ §6-4a 정의문자클래스 상수');
  assert.match(PATENT_SRC, /_bodyForDup/, '★ §6-4b 도면설명 제외 소스');
  assert.match(PATENT_SRC, /도면의 간단한 설명 섹션도 중복 소스에서 제외/, '★ §6-4b 주석');
});
