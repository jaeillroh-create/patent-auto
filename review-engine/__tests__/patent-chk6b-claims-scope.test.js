/**
 * review-engine/__tests__/patent-chk6b-claims-scope.test.js
 *
 * ★ CHK-6(a)·(b) 중복 검사 소스에서 청구범위·요약서 제외 — 청구항/요약이 상세설명 문구를 반복하는 것은
 *   §42④ 뒷받침상 "정당 반복"이므로 중복으로 오탐하면 안 됨(대화 세션 실증: 26P1036 수정본에서 6b HIGH 4건 오탐).
 *   ★ 실증: 6a(CRITICAL)도 2번째 청구항 본문이 상세설명 문단과 정규화 일치 시 오탐 → 6a·6b 모두 제외(A안).
 *   본문(발명의 설명~부호의 설명) "내부" 중복은 여전히 검출(제외가 본문 검출을 죽이지 않음).
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
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
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

const vSpec = (txt) => JSON.parse(vm.runInContext('JSON.stringify(validateSpecification(' + JSON.stringify(txt) + '))', sandbox, { filename: 'c.js' }));
const cnt = (iss, c) => iss.filter(i => i.check === c).length;
const crit = (iss, c) => iss.filter(i => i.check === c && i.severity === 'CRITICAL').length;

const S = '통신부(110)는 외부 장치로부터 데이터를 수신하고 프로세서(120)는 수신된 데이터를 분석하여 최종 결과를 출력부로 전달한다.';
const P = '통신부(110)는 외부 장치로부터 데이터를 수신하고 프로세서(120)는 수신된 데이터를 분석하여 최종 결과를 출력부로 전달하는 것을 특징으로 하는 검색 시스템.';
const IMPL = '【발명을 실시하기 위한 구체적인 내용】\n';

// ─────────── 오탐 해소 ───────────

test('6b ★ 청구항↔상세설명 정당 반복 → sentence_duplicate 미검출(오탐 해소)', () => {
  const spec = IMPL + '도 1을 참조하면, ' + S + ' 예를 들어 버퍼링을 수행한다.\n\n【청구범위】\n【청구항 1】 ' + S;
  assert.equal(cnt(vSpec(spec), 'sentence_duplicate'), 0, '★ 청구항 반복은 중복 아님');
});

test('6b ★ 상세설명↔요약서 정당 반복 → 중복(6a/6b) 미검출', () => {
  const spec = IMPL + '도 1을 참조하면, ' + S + ' 예를 들어 버퍼링을 수행한다.\n\n【요약서】\n' + S;
  const iss = vSpec(spec);
  assert.equal(cnt(iss, 'sentence_duplicate'), 0, '★ 요약서 반복 sentence 미검출');
  assert.equal(cnt(iss, 'paragraph_duplicate'), 0, '★ 요약서 반복 paragraph 미검출');
});

test('6a ★ [주의] 2번째 청구항 본문↔상세설명 문단 일치 → CRITICAL 미검출(제외 적용)', () => {
  const spec = IMPL + P + '\n\n【청구범위】\n【청구항 1】 통신부(110)를 포함하는 시스템.\n\n【청구항 2】 ' + P;
  assert.equal(crit(vSpec(spec), 'paragraph_duplicate'), 0, '★ 청구항↔상세설명 문단일치 CRITICAL 오탐 해소');
});

// ─────────── 본문 내부 중복은 여전히 검출(회귀) ───────────

test('6a 회귀 ★ 본문 내부 문단 완전중복 → 여전히 CRITICAL', () => {
  const spec = IMPL + P + '\n\n중간 문단이 사이에 위치하여 두 사본을 분리한다.\n\n' + P;
  assert.ok(crit(vSpec(spec), 'paragraph_duplicate') >= 1, '★ 본문 내부 문단중복 CRITICAL 유지');
});

test('6b 회귀 ★ 본문 내부 문장 중복 → 여전히 sentence_duplicate', () => {
  const spec = IMPL + '도 1을 참조하면, ' + S + ' 예를 들어 버퍼링한다.\n\n한편 다른 설명이 이어진다. ' + S + ' 이는 추가 서술이다.';
  assert.ok(cnt(vSpec(spec), 'sentence_duplicate') >= 1, '★ 본문 내부 문장중복 검출 유지');
});

// ─────────── 26P1036 발단 결함(진짜 오염)은 계속 잡힘 ───────────

test('회귀 ★ 26P1036형 본문 5문단 연속 중복 + 문장 절단 → CRITICAL·truncation 유지', () => {
  const P2 = '상기 프로세서(120)는 입력된 신뢰도 값의 시계열 변화에 따라 갱신 주기마다 가중치를 실시간으로 재산출하여 반영하는 것을 특징으로 한다.';
  const blk = [P, P2].join('\n\n');   // 두 문단 모두 norm 50자↑
  const spec = IMPL + blk + '\n\n' + blk + '\n\n여기서, G는 클램핑된 값이며 무차원량이다.2 이상 0.5 이하로 설정된다.';
  const iss = vSpec(spec);
  assert.ok(crit(iss, 'paragraph_duplicate') >= 1, '★ 본문 문단중복 CRITICAL 유지');
  assert.ok(cnt(iss, 'sentence_truncation') >= 1, '★ 절단("다.2") 검출 유지');
});

// ─────────── 소스 어서션 ───────────

test('소스 ★ CHK-6(a)/(b) 청구범위·요약서 제외 소스 사용', () => {
  assert.match(PATENT_SRC, /_bodyBeforeClaims=_cuts\.length\?specText\.slice\(0,Math\.min\(\.\.\._cuts\)\):specText/, '★ 청구범위·요약서 컷 소스');
  assert.match(PATENT_SRC, /parasForDup\.forEach/, '★ CHK-6(a) parasForDup 사용');
  assert.match(PATENT_SRC, /stripMathBlocks\(_bodyForDup\)\.split/, '★ CHK-6(b) 제외 소스 사용(_bodyForDup — 청구범위·요약서 + §6-4b 도면설명 제외)');
  assert.match(PATENT_SRC, /const paras=specText\.split\(\/\\n\{2,\}\/\)[\s\S]*?CHK-7\(b\)용/, '★ CHK-7용 전체 paras 유지(무변경)');
});
