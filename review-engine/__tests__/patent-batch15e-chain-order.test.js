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

// ═══════════ 적대 검증 반영 FIX (6건) ═══════════
// FIX1(HIGH): 수식 재요청이 마무리 블록(TASK=과제 등)을 소실시키지 않음(원본 이월)
test('★ FIX1 소스 — 수식 재요청 수용 시 task/solution/effects/abstract 원본 이월', () => {
  assert.match(PATENT_SRC, /\['task','solution','effects','abstract'\]\.forEach\(function\(k\)\{ if\(!r3\[k\]&&r\[k\]\)r3\[k\]=r\[k\]; \}\)/, '★ 마무리 블록 이월(math 재요청 소실 방지)');
});
test('★ FIX1 동작 — TASK 있는 raw + 수식 부족 → 재요청(device-only) 후 과제(step_05) 보존', async () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="서버"; includeMethodClaims=false; mathBlockCount=2;');
  els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true;
  const raw1 = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n제어부(100)는 처리하도록 구성된다.\n<<<END_DEVICE_DESC>>>\n<<<TASK>>>\n본 발명은 종래 처리가 비효율적이던 문제를 해결하는 것을 목적으로 한다.\n<<<END_TASK>>>';
  const retry = '<<<DEVICE_DESC>>>\n제어부(100)는 처리하도록 구성된다.\n【수학식 1】\ny = a x\n여기서 a.\n【수학식 2】\nz = y\n여기서 z.\n<<<END_DEVICE_DESC>>>';   // 수식 O, TASK 없음
  const orig = sandbox.App.callClaudeWithContinuation; let call = 0;
  sandbox.App.callClaudeWithContinuation = async () => { call++; return call === 1 ? raw1 : retry; };
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.equal(call, 2, '★ 수식 재요청 1회');
  assert.ok(/【수학식 1】/.test(run('outputs.step_08') || ''), '★ 수식 반영');
  assert.ok(/종래 처리가 비효율적/.test(run('outputs.step_05') || ''), '★ 과제(TASK)가 재요청에도 보존(step_05 이월)');
});
// FIX2/5(HIGH/MED): _resetUnifiedChainOutputs에 step_05/16/17/19 추가(세대 혼합 방지)
test('★ FIX2/5 — full 재생성 리셋 목록에 step_05·16·17·19 포함(구세대 잔존→가시 공백)', () => {
  run('clearAllState(); outputs.step_05="구세대 과제"; outputs.step_16="구효과"; outputs.step_17="구해결"; outputs.step_19="구요약"; outputs.step_06="c";');
  run('_resetUnifiedChainOutputs();');
  ['step_05','step_16','step_17','step_19','step_06'].forEach(k => assert.equal(run('outputs.' + k), undefined, '★ ' + k + ' 리셋'));
  assert.match(PATENT_SRC, /'step_13_applied_method','step_05','step_16','step_17','step_19'/, '★ 리셋 목록에 마무리 계열 추가');
});
// FIX6(MED): runBatch25 레거시 경로 step_05 checkDependency 가드
test('★ FIX6 — runBatch25가 step_05(과제) 전에 checkDependency 가드(청구항 부재 시 스킵)', () => {
  assert.match(PATENT_SRC, /const _dep05=\(typeof checkDependency==='function'\)\?checkDependency\('step_05'\):null;/, '★ 레거시 일괄도 가드 공유');
  assert.match(PATENT_SRC, /if\(_dep05\)\{ App\.showToast\('과제\(step 5\) 건너뜀/, '★ 청구항 부재 시 과제 스킵+경고(메타응답 재유입 차단)');
});
// FIX4(LOW): C12 자기검증 라벨 연속(g)(h)(i)
test('★ FIX4 — C12 자기검증 라벨 연속화((g)(h)(i), 결번·트레일링 제거)', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버"; mathBlockCount=3;');
  els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true;
  const p = run("buildPrompt('unified_cohesion')");
  assert.ok(/\(f\)[\s\S]{0,200}\(g\) ★ 동일한 구성 명칭[\s\S]{0,300}\(g2\) ★ \[배치15K\][\s\S]{0,300}\(h\) ★ 모든 문단[\s\S]{0,300}\(i\) ★★ \[배치15K-6\] 각 수학식마다/.test(p), '★ f→g→g2→h→i 순차(배치15K g2 하드웨어·i 수식 1:1 추가)');
});
