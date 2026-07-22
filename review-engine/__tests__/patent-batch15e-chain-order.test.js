/**
 * review-engine/__tests__/patent-batch15e-chain-order.test.js
 * ★ 배치 15E — 체인 순서 근본 버그.
 *   1 [기초] phase = 명칭 종속만(step_02·03·04), 과제(step_05)는 cohesion TASK 블록으로 이동(청구항 확정 후 역설계 →
 *     meta_response 원천 소멸) / 2 체인 phase 입력 가드(checkDependency 공유).
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
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');

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
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); run('clearAllState();'); });

// 1) 순서 — 과제(step_05)는 청구항 전에 실행되지 않음
test('★ 1 — 체인에서 step_05(과제)는 개별 runStep으로 실행 안 함(청구항 부재 시점 메타응답 원천 제거)', () => {
  assert.ok(!/await runStep\('step_05'\)/.test(PATENT_SRC), '★ 체인·어디서도 runStep(step_05) 호출 없음');
  // 기초 phase 순서: 명칭(title) → 기초(basis) → 청구항(claims), 기초는 step_02·03·04만
  const iTitle = PATENT_SRC.indexOf("_phase('title','done'");
  const iBasis = PATENT_SRC.indexOf("_phase('basis','running')");
  const iClaims = PATENT_SRC.indexOf("_phase('claims','running')");
  assert.ok(iTitle > 0 && iBasis > iTitle && iClaims > iBasis, '★ 명칭 → 기초 → 청구항 순서');
  assert.match(PATENT_SRC, /if\(_guard\('step_04'\)&&!\(resume&&outputs\.step_04\)\)/, '★ 기초에 선행기술(step_04) 포함');
});
test('★ 1 — 과제(step_05)는 cohesion TASK 블록으로 이동(청구항 확정 후 커밋)', () => {
  assert.match(PATENT_SRC, /const task=grab\('TASK'\)/, '★ parseCohesiveBundle TASK 수확');
  assert.match(PATENT_SRC, /if\(r\.task\)\{ pushOutputHistory\('step_05','unified'[\s\S]{0,80}outputs\.step_05=r\.task/, '★ TASK → step_05 커밋');
});

// 1a) cohesion 프롬프트 TASK 계약
test('★ 1a — cohesion 프롬프트: <<<TASK>>> 블록 + [C13] 역설계·메타표현 금지 계약', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버";');
  const p = run("buildPrompt('unified_cohesion')");
  assert.ok(/<<<TASK>>>/.test(p) && /<<<END_TASK>>>/.test(p), '★ TASK 블록 마커');
  assert.ok(/TASK\(해결하고자 하는 과제\)/.test(p) && /역설계/.test(p), '★ 역설계 계약');
  assert.ok(/정보가 필요\/부족/.test(p) && /제공해 주시/.test(p) && /추가 정보 요청 금지/.test(p), '★ 메타 표현 금지 명시');
  assert.ok(/네 블록/.test(p), '★ C13 네 블록(TASK 추가)');
});

// 1b) 동작 — TASK 블록 파싱→step_05 커밋→최종 명세서 과제 섹션
test('★ 1b 동작 — cohesion TASK 블록 → step_05 커밋 + 최종 명세서 과제 섹션', async () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부를 포함하는 서버."; outputs.step_07="도 1"; selectedTitle="테스트 서버"; selectedTitleType="서버"; includeMethodClaims=false;');
  els.chkUnifiedMath = mkEl();
  const raw = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n제어부(100)는 데이터를 처리하도록 구성된다.\n<<<END_DEVICE_DESC>>>\n<<<TASK>>>\n본 발명은 종래 데이터 처리가 비효율적이었던 문제를 해결하는 것을 목적으로 한다.\n<<<END_TASK>>>\n<<<SOLUTION>>>\n본 발명의 일 실시예에 따른 서버는 제어부를 포함한다.\n<<<END_SOLUTION>>>';
  const orig = sandbox.App.callClaudeWithContinuation;
  sandbox.App.callClaudeWithContinuation = async () => raw;
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.ok(/종래 데이터 처리가 비효율적/.test(run('outputs.step_05') || ''), '★ TASK → step_05(과제) 커밋');
  const spec = run('buildSpecification()') || '';
  assert.ok(/【해결하고자 하는 과제】/.test(spec) && /종래 데이터 처리가 비효율적/.test(spec), '★ 최종 명세서 과제 섹션 반영');
  // ★ 메타응답 검사 미발화(정상 역설계 과제)
  assert.equal(run('validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check==="meta_response_residue";}).length'), 0, '★ 정상 과제 → 메타응답 미발화');
});

// 2) 체인 phase 입력 가드
test('★ 2 — 체인 _guard(checkDependency) 공유 + 기초 스텝 가드 적용', () => {
  assert.match(PATENT_SRC, /const _guard=function\(sid\)\{ try\{ const d=\(typeof checkDependency==='function'\)\?checkDependency\(sid\):null; if\(d\)\{ App\.showToast/, '★ _guard = checkDependency 공유');
  assert.match(PATENT_SRC, /if\(_guard\('step_02'\)&&/, '★ 기초 step_02 가드');
  assert.match(PATENT_SRC, /if\(!\(resume&&outputs\.step_06\)&&_guard\('step_06'\)\)/, '★ 청구항 step_06 가드');
});

// docG류 재발 방지 — 과제 섹션 메타응답 픽스처(A8 회귀)
test('★ 회귀 — 과제 섹션 메타응답("청구항을 알려/제공하겠")은 여전히 CRITICAL(A8)', () => {
  const metaSpec = '【해결하고자 하는 과제】\n정확한 과제 작성을 위해 청구항 정보를 제공해 주시면 작성하여 제공하겠습니다.';
  assert.ok(run('validateSpecification(' + JSON.stringify(metaSpec) + ').filter(function(i){return i.check==="meta_response_residue"&&i.severity==="CRITICAL";}).length') >= 1, '★ 과제 메타응답 CRITICAL 검출');
});
