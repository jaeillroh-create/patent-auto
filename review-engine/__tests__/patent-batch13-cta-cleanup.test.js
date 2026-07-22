/**
 * review-engine/__tests__/patent-batch13-cta-cleanup.test.js
 * ★ 배치 13 — CTA 통합·배선 정리. 1 역설계 강등 / 2 관문 ③ 이동 / 3 검토반영 일원화 / 4 downstream 순방향 /
 *   5 ② ✓ 기준(genParams) / 6 구 탭명 스윕. 화면(탭 흐름)은 재일 위임 — 테스트는 맵·판정·DOM 배치·문구.
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
const dep = (k) => JSON.parse(run('JSON.stringify(STEP_DEPENDENCIES[' + JSON.stringify(k) + '])'));
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); run('clearAllState();'); });

// 4) downstream 순방향
test('★ 4 — 역방향 잔재 제거: step_17·step_05 종단(하류 없음)', () => {
  assert.deepEqual(dep('step_17'), { MUST: [], SHOULD: [] }, '★ 해결수단 → 과제 제거');
  assert.deepEqual(dep('step_05'), { MUST: [], SHOULD: [] }, '★ 과제 → 효과·배경 제거');
});
test('★ 4 — 순방향 보강: step_06 하류에 step_16(효과)·step_17(해결수단) 직접 등록', () => {
  const d = dep('step_06'); const all = d.MUST.concat(d.SHOULD);
  assert.ok(all.includes('step_16'), '★ 청구항 → 효과 직접(과거 step_05 경유 제거)');
  assert.ok(all.includes('step_17'), '★ 청구항 → 해결수단 직접');
});
test('★ 4 — step_07 하류에 step_18(부호) 유지(확인)', () => {
  assert.ok(dep('step_07').MUST.includes('step_18'), '★ 장치도면 → 부호');
});

// 5) ② ✓ 기준 = genParams
test('★ 5 — wfStageStatus(2): 기본값만으론 none, 스냅샷 있으면 done, drift면 stale', () => {
  run('selectedTitleType="서버"; deviceGeneralDep=5; deviceAnchorDep=4; detailLevel="standard"; includeMethodClaims=false; genParams=null;');
  assert.equal(run('wfStageStatus(2)'), 'none', '★ 유형만 선택 → 무표시(none)');
  run('_snapshotGenParams("stage3");');
  assert.equal(run('wfStageStatus(2)'), 'done', '★ 골격 스냅샷 → done');
  run('deviceGeneralDep=9;');
  assert.equal(run('wfStageStatus(2)'), 'stale', '★ 설계값 변경 → stale');
});
test('★ 5 — _genParamsDrift: stage4 필드(분량)도 반영', () => {
  run('selectedTitleType="서버"; detailLevel="standard"; _snapshotGenParams("stage4");');
  assert.equal(run('_genParamsDrift()'), false, '★ 일치 → drift 없음');
  run('detailLevel="maximal";');
  assert.equal(run('_genParamsDrift()'), true, '★ 분량 변경 → drift');
});

// 6) 구 탭명 스윕
test('★ 6 — 구 탭명 문자열 제거·신 단계명 반영(02·05·index)', () => {
  assert.match(PATENT_SRC, /① 발명 파악 단계에서 "범위 확정"/, '★ 02 범위확정 안내');
  assert.match(PATENT_SRC, /청구항\(③ 골격 탭\)을 먼저 보정/, '★ 05 청구항 게이트');
  assert.match(PATENT_SRC, /⑤ 검증·출원 탭에서 확인/, '★ 05 완성본 경고');
  assert.match(HTML_SRC, /var LABELS = \['① 발명 파악','② 설계','③ 골격','④ 본문·검토','⑤ 검증·출원'\]/, '★ index 스텝 라벨');
  assert.ok(!/'A\. 기본','A\. 청구항'/.test(HTML_SRC) && !/A\. 기본 탭/.test(PATENT_SRC), '★ 구 탭명 잔존 0');
});

// 1/2/3) DOM 배치·문구
test('★ 2(배치14) — 관문 카드 소멸: Step14는 ③ 고급, Step15·자동검증 버튼 제거', () => {
  const p1 = HTML_SRC.slice(HTML_SRC.indexOf('id="page1"'), HTML_SRC.indexOf('id="page2"'));
  const p2 = HTML_SRC.slice(HTML_SRC.indexOf('id="page2"'), HTML_SRC.indexOf('id="page3"'));
  assert.ok(!p1.includes('id="btnStep14"'), '★ ②에서 제거');
  assert.ok(!/id="wfGateCard"/.test(HTML_SRC), '★ 관문 카드 소멸(배치14-4)');
  assert.ok(!/id="btnStep15"/.test(HTML_SRC), '★ Step 15 버튼 제거(→ Step 13 통합)');
  assert.ok(!/onclick="runValidation\(\)"/.test(HTML_SRC), '★ 자동 검증 버튼 제거(자동 경로 유지)');
  // Step 14는 ③ 고급(wfAdv2) 안으로 — details 경계(</details>)로 containment 검증(순서만이 아님)
  const adv2open = p2.indexOf('id="wfAdv2"');
  const adv2 = p2.slice(adv2open, p2.indexOf('</details>', adv2open));
  assert.ok(adv2open >= 0 && adv2.includes('id="btnStep14"'), '★ Step14 wfAdv2 details 안(containment)');
});
test('★ 1/3 — Phase D·검토반영이 ④ 고급(wfAdv3)으로, 주 흐름은 통합생성+AI검토', () => {
  const p3 = HTML_SRC.slice(HTML_SRC.indexOf('id="page3"'), HTML_SRC.indexOf('id="page4"'));
  assert.match(p3, /<details class="wf-adv" id="wfAdv3">[\s\S]*?id="btnPhaseD"[\s\S]*?id="btnApplyReview"[\s\S]*?<\/details>/, '★ Phase D·검토반영 고급 내부');
  // 주 흐름(고급 이전)에 btnPhaseD·btnApplyReview 없음
  const mainFlow = p3.slice(0, p3.indexOf('id="wfAdv3"'));
  assert.ok(!mainFlow.includes('id="btnPhaseD"') && !mainFlow.includes('id="btnApplyReview"'), '★ 주 흐름에서 제거');
  assert.match(mainFlow, /id="btnWfStage4"[\s\S]*id="btnStep13"/, '★ 주 흐름 = 통합생성 + AI검토');
  assert.match(mainFlow, /검토 반영 = ④ 본문 통합 재생성/, '★ AI검토 하단 재생성 안내 버튼');
  assert.match(p3, /①\(Step 2~5\)·④\(통합 생성\)와 동일 항목[\s\S]{0,80}중복 실행 시 마지막 결과가 덮어씁니다/, '★ 역설계 중복 경고');
});
