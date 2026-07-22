/**
 * review-engine/__tests__/patent-batch15f-body-quality.test.js
 * ★ 배치 15F — cohesion 본문 품질 게이트.
 *   1 부호 명칭 정합(동일 명칭 단일 부호) / 2 절단 방지 / 3 수학식 변수 완전정의 / 4 예시도 실명 배선.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);

let sandbox; const els = {};
const mkEl = () => ({ value: '4', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {}, updateStats() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, updateStats() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
const checks = (spec, name) => JSON.parse(run('JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check===' + JSON.stringify(name) + ';}))'));
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); run('clearAllState();'); });

const cohesionPrompt = () => { run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버";'); return run("buildPrompt('unified_cohesion')"); };

// 1) 동일 명칭 단일 부호
test('★ 1 — cohesion C5/C12: 동일 명칭 단일 부호 원칙 + 자기검증 (h)', () => {
  const p = cohesionPrompt();
  assert.ok(/하나의 명칭=하나의 참조번호/.test(p) && /서로 다른 부호를 두 개 이상 배정하지 마라/.test(p), '★ C5 양방향 1:1');
  assert.ok(/\(h\) ★ 동일한 구성 명칭에 서로 다른 부호가 두 개 이상 배정되지 않았는가/.test(p), '★ C12 (h) 동일명칭 다중부호 금지');
});
test('★ 1 — 검증: 동일 명칭 다중 부호(docG류) → refnum_dupassign HIGH', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n대사보존형서사구조화부(100)는 처리하고, 대사보존형서사구조화부(200)는 저장한다.\n【부호의 설명】\n100 : 대사보존형서사구조화부\n200 : 대사보존형서사구조화부';
  const iss = checks(spec, 'refnum_dupassign');
  assert.ok(iss.some(i => /대사보존형서사구조화부/.test(i.message)), '★ 동일 명칭 이중 배정 검출(HIGH)');
});

// 2) 절단 방지
test('★ 2 — cohesion C12 (i): 모든 문단 종결어미 종료 자기검증', () => {
  const p = cohesionPrompt();
  assert.ok(/\(i\) ★ 모든 문단이 종결어미\("~다\."\)로 끝나는가/.test(p), '★ C12 (i) 절단 문단 없음');
});

// 3) 수학식 변수 완전정의
test('★ 3 — cohesion C9(인라인)·C12(g): 좌·우변 전 기호(그리스문자·Σ·rank·아래첨자) 정의', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버"; mathBlockCount=3;');
  els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true;
  const p = run("buildPrompt('unified_cohesion')");
  assert.ok(/좌변·우변에 등장하는 모든 기호/.test(p), '★ 좌·우변 전 기호');
  assert.ok(/그리스문자.*Σ/.test(p) && /합·곱 기호.*Σ, ∏.*인덱스/.test(p) && /rank/.test(p), '★ 그리스문자·합기호 인덱스·함수형 인자');
  assert.ok(/모든 수학식의 좌·우변 기호가 "여기서" 절에 정의되었고/.test(p), '★ C12 (g) 좌·우변');
});

// 4) 예시도 실명 배선 — 빈 라벨 generic 오염 방지
test('★ 4 — reflectConceptsToSpec: 실명 라벨만 부호표 등재, 빈 라벨은 generic으로 넣지 않음', () => {
  run(`
    diagramData={step_07:[{}]}; outputTimestamps={};
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 2.',refMap:[{signNumber:'31',label:''},{signNumber:'32',label:'라우팅 결과 카드'}]}];
    outputs={ step_18:'통신부 : 110' };
  `);
  run('reflectConceptsToSpec();');
  const s18 = run('outputs.step_18') || '';
  assert.ok(/라우팅 결과 카드 : 32/.test(s18), '★ 실명 라벨(32) 등재');
  assert.ok(!/ : 31/.test(s18) && !/요소 : 31/.test(s18), '★ 빈 라벨(31)은 generic으로 부호표 미등재(총칭 오염 방지)');
  assert.match(PATENT_SRC, /function _conceptRefPairsRaw\(ct\)/, '★ 폴백 없는 원본 라벨 헬퍼');
});
