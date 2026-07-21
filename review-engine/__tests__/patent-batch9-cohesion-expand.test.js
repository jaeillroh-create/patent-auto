/**
 * review-engine/__tests__/patent-batch9-cohesion-expand.test.js
 *
 * ★ 배치 9 — ④ 본문 통합 생성 확장. D1(수학식 인라인+토글 의미 전환) / D3(효과·해결수단·요약 흡수).
 *   - D1: 토글 on → cohesion C9가 "인라인 수식 계약"(여기서 절·그룹 정의·상기/다음의 참조 규칙 — CHK-8·math_ref
 *         선반영)으로 전환, off → 현행 금지 유지. 체인 [5/5] 배선 제거(별도 파일에서 검증), 커밋 시 구 step_09
 *         섀도잉 제거. Step 9 수동 경로 존치.
 *   - D3: SOLUTION/EFFECTS/ABSTRACT 3블록 흡수 — 파서 수확(동일 위생 경로) + step_17/16/19 원자 커밋(없으면 비파괴).
 *   ⚠ 실제 수식 품질·분량·효과/요약 품질은 LLM 산출 — 화면(실측) 검증 위임. 테스트는 계약·배선·위생만 고정.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);

let sandbox; const els = {};   // id→element 오버라이드(토글 제어)
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (id in els ? els[id] : elStub()), querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });

// ─────────── D1 — 수학식 인라인 계약(프롬프트 기능 테스트) ───────────

const setupPromptEnv = () => {
  run('clearAllState()');
  run('outputs.step_06="【청구항 1】 제어부를 포함하는 서버."; outputs.step_07="A[\\"제어부(100)\\"]"; selectedTitle="테스트 서버"; selectedTitleType="서버";');
};
test('★ D1 — 토글 on: C9가 인라인 수식 계약으로 전환(여기서 절·그룹 정의·상기/다음의 규칙)', () => {
  setupPromptEnv(); els.chkUnifiedMath = { checked: true };
  const p = run("buildPrompt('unified_cohesion')");
  assert.ok(/수학식 인라인 — CHK-8·참조 규칙 선반영/.test(p), '★ 인라인 계약 진입');
  assert.ok(/"여기서, …" 정의 절/.test(p) && /개별 또는 그룹\("a, b, c는 …"\)/.test(p), '★ 변수 전수 정의(그룹·아래첨자)');
  assert.ok(/"상기 수학식 N"/.test(p) && /"다음의 수학식 N"/.test(p), '★ 참조 방향 규칙(math_ref 선반영)');
  assert.ok(!/【수학식 금지】/.test(p), '★ 금지문 미출력');
  assert.ok(/모든 수학식 변수가 "여기서" 절에 정의되었고/.test(p), '★ C12 자기검증 (g) 추가');
  delete els.chkUnifiedMath;
});
test('★ D1 — 토글 off: 현행 수학식 금지 유지(회귀)', () => {
  setupPromptEnv(); els.chkUnifiedMath = { checked: false };
  const p = run("buildPrompt('unified_cohesion')");
  assert.ok(/【수학식 금지】/.test(p), '★ 금지문 유지');
  assert.ok(!/수학식 인라인 — CHK-8/.test(p), '★ 인라인 계약 미출력');
  delete els.chkUnifiedMath;
});

// ─────────── D3 — 마무리 3블록 파서 수확 + 위생 ───────────

const BUNDLE_FULL = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n도 1을 참조하면, 제어부(100)는 처리한다.\n<<<END_DEVICE_DESC>>>\n<<<SOLUTION>>>\n본 발명의 일 실시예에 따른 서버는 제어부(100)를 포함한다.\n<<<END_SOLUTION>>>\n<<<EFFECTS>>>\n이러한 구성에 의하면 처리 효율이 향상되는 기술적 효과를 얻을 수 있다. <<<EFFECTS>>> 에코 검증용.\n<<<END_EFFECTS>>>\n<<<ABSTRACT>>>\n본 발명은 제어부(100)를 포함하는 서버에 관한 것이다.\n<<<END_ABSTRACT>>>';

test('★ D3 — SOLUTION/EFFECTS/ABSTRACT 3블록 수확 + 에코 마커 동일 위생 경로', () => {
  const r = JSON.parse(run('JSON.stringify((function(){var r=parseCohesiveBundle(' + JSON.stringify(BUNDLE_FULL) + ');return {solution:r.solution,effects:r.effects,abstract:r.abstract,device:r.device};})())'));
  assert.ok(/제어부\(100\)를 포함한다/.test(r.solution), '★ SOLUTION 수확');
  assert.ok(/기술적 효과를 얻을 수 있다/.test(r.effects), '★ EFFECTS 수확');
  assert.ok(!/<<</.test(r.effects), '★ EFFECTS 내부 에코 마커 제거(N1b 위생 공유)');
  assert.ok(/서버에 관한 것이다/.test(r.abstract), '★ ABSTRACT 수확');
});
test('★ D3 — 3블록 부재 시 null(게이트 무관·비파괴)', () => {
  const b = '<<<REFTABLE>>>\n(100) 제어부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n제어부(100)는 처리한다.\n<<<END_DEVICE_DESC>>>';
  const r = JSON.parse(run('JSON.stringify((function(){var r=parseCohesiveBundle(' + JSON.stringify(b) + ');return {s:r.solution,e:r.effects,a:r.abstract,ok:r.ok};})())'));
  assert.equal(r.s, null); assert.equal(r.e, null); assert.equal(r.a, null);
  assert.equal(r.ok.hasRef && r.ok.hasDevice, true, '★ 기존 게이트 판정 불변');
});
test('★ D3 — 신규 마커 유출도 CHK-0(placeholder_residue) 안전망에 걸림', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 처리한다. <<<EFFECTS>>> 효율이 향상된다.';
  const iss = JSON.parse(run('JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check==="placeholder_residue";}))'));
  assert.equal(iss.length, 1, '★ 신규 마커도 [A-Z_]+ 패턴에 포섭');
});

// ─────────── 커밋 배선 + 프롬프트 골격(소스) ───────────

test('★ 소스 — 마무리 커밋(17/16/19)·인라인 시 구 step_09 섀도잉 제거·경고 게이트', () => {
  assert.match(PATENT_SRC, /if\(r\.solution\)\{ pushOutputHistory\('step_17','unified'/, '★ step_17 원자 커밋');
  assert.match(PATENT_SRC, /if\(r\.effects\)\{ pushOutputHistory\('step_16','unified'/, '★ step_16 원자 커밋');
  assert.match(PATENT_SRC, /if\(r\.abstract\)\{ pushOutputHistory\('step_19','unified'/, '★ step_19 원자 커밋');
  assert.match(PATENT_SRC, /if\(_mathInline&&outputs\.step_09\)\{ pushOutputHistory\('step_09','unified'/, '★ 인라인 시 구 step_09 이력 보존 후 제거');
  assert.match(PATENT_SRC, /if\(hadMath&&!_mathInline\)App\.showToast/, '★ 재삽입 경고는 비인라인 모드에만');
});
test('★ 소스 — C1 골격에 3블록 + C13 계약 + C1~C13 마감', () => {
  assert.match(PATENT_SRC, /<<<SOLUTION>>>[\s\S]{0,80}<<<END_SOLUTION>>>[\s\S]{0,40}<<<EFFECTS>>>[\s\S]{0,80}<<<END_EFFECTS>>>[\s\S]{0,40}<<<ABSTRACT>>>[\s\S]{0,80}<<<END_ABSTRACT>>>/, '★ 골격 3블록');
  assert.match(PATENT_SRC, /\[C13\] 【마무리 산출 — 동일 컨텍스트 흡수】/, '★ C13 계약');
  assert.match(PATENT_SRC, /출력 계약\(C1~C13\)을 지켜/, '★ 마감줄 갱신');
});
