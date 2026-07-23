/**
 * review-engine/__tests__/patent-batch15g-gate-loop.test.js
 * ★ 배치 15G — 게이트 무한루프 해소: 차단 → 자동교정 → 경고 커밋.
 *   1 부호 미정의 자동 교정(REFTABLE 보강, 최대 2회) / 2 잔여 시 경고 커밋(진전 보장, CRITICAL은 차단 유지) /
 *   3 재생성 배너 / 4 term_mismatch 출처 안내.
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

const REF1 = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>';
// 본문이 (100)과 (200)을 쓰는데 REFTABLE엔 (100)만 → notInTable=[200]
const DESC_MISS = '<<<DEVICE_DESC>>>\n제어부(100)는 수신부(200)로부터 데이터를 받아 처리하도록 구성된다.\n<<<END_DEVICE_DESC>>>';
const AUG_OK = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n(200) 수신부\n<<<END_REFTABLE>>>';   // 200 추가됨

// ★ [배치17] 청구항을 구성부 없는 형태("장치.")로 둬 refPlan 이 비게 한다 → REFTABLE 자동교정·경고커밋(레거시 폴백)이 활성.
//   (구성부가 있는 청구항이면 배치17 refPlan 이 부호를 확정해 이 REFTABLE 보강 루프 자체가 비활성 — 그 신 동작은 batch17 테스트가 검증.)
const setupCohesion = () => run('clearAllState(); outputs.step_06="【청구항 1】 장치."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="서버"; includeMethodClaims=false;');

// 1) 자동 교정 성공
test('★ 1 소스 — 게이트 자동 교정 루프(_computeGate·최대 2회·부호표 보강 재요청)', () => {
  assert.match(PATENT_SRC, /const _computeGate=function\(rp\)\{/, '★ 게이트 계산 분리');
  assert.match(PATENT_SRC, /while\(!_hasRP && gate\.length && _corr<2\)\{/, '★ 최대 2회 자동 교정 루프(refPlan 없을 때만 — 배치17)');
  assert.match(PATENT_SRC, /_buildRefTableAugmentPrompt\(_serializeRefTable\(r\.refMap\), miss, missM/, '★ 미정의 부호 부호표 보강 재요청');
  assert.match(PATENT_SRC, /본문은 절대 출력·수정하지 마라 — 부호표만 보강한다/, '★ 본문 불변 보장');
});
test('★ 1 동작 — 미정의 부호(200) → 부호표 자동 보강 1회 → 게이트 통과·커밋', async () => {
  setupCohesion();
  els.chkUnifiedMath = mkEl();
  const orig = sandbox.App.callClaudeWithContinuation; let call = 0;
  sandbox.App.callClaudeWithContinuation = async () => { call++; return call === 1 ? (REF1 + '\n' + DESC_MISS) : AUG_OK; };
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.equal(call, 2, '★ 초기 + 부호표 보강 1회');
  assert.ok(/제어부\(100\)/.test(run('outputs.step_08') || ''), '★ 본문 커밋(불변 보존)');
  assert.ok(/수신부/.test(run('outputs.step_18') || ''), '★ 보강된 (200) 수신부가 부호의 설명에 정의');
});

// 2) 경고 커밋 — 무한루프 해소(핵심)
test('★ 2 동작 — 2회 보강 후에도 미정의 잔여 → 차단 아닌 경고 커밋(새 본문 진전 보장)', async () => {
  setupCohesion();
  els.chkUnifiedMath = mkEl();
  const before08 = run('outputs.step_08') || '';
  const orig = sandbox.App.callClaudeWithContinuation; let call = 0;
  // 초기 + 보강 2회 모두 200을 못 추가(REFTABLE에 100만) → notInTable 잔여
  sandbox.App.callClaudeWithContinuation = async () => { call++; return call === 1 ? (REF1 + '\n' + DESC_MISS) : REF1; };
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.equal(call, 3, '★ 초기 + 보강 2회 시도');
  const s08 = run('outputs.step_08') || '';
  assert.notEqual(s08, before08, '★ 게이트 잔여에도 새 본문 커밋(무한루프 해소 — "눌러도 안 바뀜" 제거)');
  assert.ok(/제어부\(100\)/.test(s08), '★ 생성 본문으로 진전');
});
test('★ 2 소스 — 경고 커밋(차단 아님) + CRITICAL은 다운로드 게이트가 그대로 차단', () => {
  assert.match(PATENT_SRC, /if\(gate\.length\)\{ _gateWarn=gate\.slice\(\);[\s\S]{0,200}새 본문으로 커밋/, '★ 잔여 게이트 → 경고 커밋(return 없음)');
  // 리포트 게이트(부호·중복·극성)는 §42 — 경고 커밋. CRITICAL(메타·마커)은 _downloadGate가 계속 차단.
  assert.match(PATENT_SRC, /meta_response_residue/, '★ CRITICAL 검사 존치');
  assert.equal(run('typeof _downloadGate'), 'function', '★ 다운로드 CRITICAL 게이트 존치');
});
test('★ 2 회귀 — CRITICAL(메타응답)은 여전히 다운로드 차단(경고 커밋이 출원불가급 통과 안 함)', () => {
  // 리포트 게이트를 경고 커밋으로 바꿔도 CRITICAL 차단 경로(_downloadGate)는 불변
  run('confirm=function(){return false;}');   // CRITICAL 확인 모달에서 취소
  const metaBody = '【해결하고자 하는 과제】\n정확한 과제를 위해 청구항 정보를 제공해 주시면 작성하여 제공하겠습니다.\n【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 처리한다.';
  assert.equal(run('_downloadGate(' + JSON.stringify(metaBody) + ')'), false, '★ 메타응답(CRITICAL) → 다운로드 차단(취소)');
  run('confirm=function(){return true;}');
});

// 3) 재생성 배너
test('★ 3 — ④ 재생성 배너: 성공/실패 렌더 함수 + HTML 컨테이너', () => {
  assert.match(HTML_SRC, /id="cohesionBanner"/, '★ ④ 배너 컨테이너');
  assert.equal(run('typeof _renderCohesionBanner'), 'function', '★ 배너 렌더 함수');
  els.cohesionBanner = mkEl();
  run('_renderCohesionBanner({ok:true, refnum:0, gateWarn:["본문 미정의 부호 2개"], autoCorr:2});');
  assert.ok(/본문 통합 재생성 완료/.test(els.cohesionBanner.innerHTML) && /부호표 자동 보강 2회/.test(els.cohesionBanner.innerHTML) && /게이트 미통과/.test(els.cohesionBanner.innerHTML), '★ 성공+경고 배너');
  run('_renderCohesionBanner({ok:false, cause:"REFTABLE 누락"});');
  assert.ok(/재생성 실패 — 이전 본문 유지/.test(els.cohesionBanner.innerHTML) && /REFTABLE 누락/.test(els.cohesionBanner.innerHTML), '★ 실패 배너(사유)');
});

// 4) term_mismatch 출처 안내
test('★ 4 — term_generation_mismatch: 출처 섹션 → 재생성 진입점 명시', () => {
  run('clearAllState(); termSnapshot={ confirmedAt: 1, staleTerms:["구세대명칭부"] };');
  const spec = '【부호의 설명】\n구세대명칭부 : 110\n【발명을 실시하기 위한 구체적인 내용】\n구세대명칭부(110)는 처리한다.';
  const iss = JSON.parse(run('JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check==="term_generation_mismatch";}))'));
  assert.ok(iss.length >= 1, '★ 구세대 용어 검출');
  assert.ok(iss.some(i => /④ 본문 통합 재생성/.test(i.message) && /ⓐ|수동 수정/.test(i.message)), '★ 출처 → ④ 재생성 진입점 명시 + ⓐ재생성/ⓑ수동수정(배치19b-4)');
});

// 검증 반영 FIX — 배너 프로젝트 전환 잔상 제거
test('★ FIX — _wfHardReset이 cohesionBanner 잔상 제거(프로젝트 전환 크로스 오염 방지)', () => {
  els.cohesionBanner = mkEl();
  run('_renderCohesionBanner({ok:true, refnum:0, gateWarn:[], autoCorr:1});');
  assert.equal(els.cohesionBanner.style.display, 'block', '★ 배너 표시됨(프로젝트 A)');
  run('_wfHardReset();');
  assert.equal(els.cohesionBanner.style.display, 'none', '★ 프로젝트 전환 시 숨김');
  assert.equal(els.cohesionBanner.innerHTML, '', '★ 내용 제거(구프로젝트 카운트 잔상 없음)');
  assert.match(PATENT_SRC, /const cb2=document\.getElementById\('cohesionBanner'\); if\(cb2\)\{cb2\.style\.display='none';cb2\.innerHTML='';\}/, '★ _wfHardReset 배너 정리');
});
