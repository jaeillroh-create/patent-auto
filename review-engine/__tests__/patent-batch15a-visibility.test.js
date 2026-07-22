/**
 * review-engine/__tests__/patent-batch15a-visibility.test.js
 * ★ 배치 15A — 가시성·침묵실패·스냅샷(긴급 버그).
 *   1 실패 표면화(phase ✗+사유·toast·요약 중단·재개) / 2 진행 체크리스트+레일 running /
 *   3 완료 배너+생성 시각 / 4 영속·대조(D3 "미생성" 수정: 체인 종료 renderDesignBoard) / 5 UI 통일 1차.
 *   화면(오버레이 흐름)은 재일 위임 — 테스트는 배선·상태·DOM·D3 재현.
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

// ═══ 4) 영속·대조 — D3 "미생성" 수정(핵심) ═══
test('★ 4(D3) — 골격 완료 시뮬(청구항·도면+stage3 스냅샷) → genParams.stage3 존재 + 대조 "적용됨" 표시(미생성 아님)', () => {
  run('selectedTitleType="서버"; deviceGeneralDep=5; deviceAnchorDep=4; detailLevel="standard"; includeMethodClaims=false; genParams=null;');
  run('outputs.step_06="【청구항 1】 제어부를 포함하는 서버."; outputs.step_07="도 1 ...";');
  run('markOutputTimestamp("step_06"); markOutputTimestamp("step_07");');
  // 체인이 도면 성공 후 수행하는 스냅샷을 그대로 재현
  run('_snapshotGenParams("stage3");');
  const gp = JSON.parse(run('JSON.stringify(genParams)'));
  assert.ok(gp && gp.stage3 && gp.stage3.type === '서버', '★ stage3 스냅샷 존재(type 반영)');
  // ② 보드 재렌더(체인 종료 훅이 하는 일) → dbApplyBadges에 stage3 필드가 "적용됨"으로 뜬다(전부 "미생성" 아님)
  run('renderDesignBoard();');
  const badges = els.dbApplyBadges.innerHTML;
  assert.ok(/적용됨/.test(badges), '★ 대조 배지에 "적용됨"(stage3 필드) — D3 "전부 미생성" 회귀 방지');
  assert.ok(/유형[\s\S]{0,40}적용됨/.test(badges), '★ 유형 필드가 적용됨(미생성 아님)');
  assert.equal(run('wfStageStatus(2)'), 'done', '★ 스냅샷 존재 → ② done');
});
test('★ 4 — 체인 종료(완료·중단 공통) finally: saveProject + _wizFinishSummary(보드/레일/검증바 재렌더)', () => {
  assert.match(PATENT_SRC, /\[배치15A-4\] 종료\(완료·중단 공통\)/, '★ 종료 훅 주석');
  assert.match(PATENT_SRC, /if\(typeof saveProject==='function'\)saveProject\(true\);/, '★ 영속 자동');
  assert.match(PATENT_SRC, /if\(typeof _wizFinishSummary==='function'\)_wizFinishSummary\(info\)/, '★ 종료 요약 훅 호출');
  assert.match(PATENT_SRC, /function _wizFinishSummary\(info\)\{[\s\S]{0,2200}renderDesignBoard\(\)/, '★ _wizFinishSummary가 renderDesignBoard 재렌더(D3 수정)');
});

// ═══ 1) 실패 표면화 + 재개 ═══
test('★ 1 — 각 phase 실패: stopInfo + _phase(id,fail,사유) + "통합 생성 중단 —" 토스트(명칭·청구항·도면·본문)', () => {
  ['명칭','청구항','도면','본문'].forEach(function(lbl){
    assert.ok(PATENT_SRC.includes('통합 생성 중단 — '+lbl+':'), '★ '+lbl+' 실패 토스트');
  });
  assert.match(PATENT_SRC, /_phase\('title','fail',stopInfo\.cause\)/, '★ 명칭 phase ✗');
  assert.match(PATENT_SRC, /_phase\('body','fail',stopInfo\.cause\)/, '★ 본문 phase ✗');
  assert.match(PATENT_SRC, /let stopInfo=null;/, '★ 중단 사유 캐리어');
});
test('★ 1 — 침묵 catch 제거: 생성기 3종 catch가 _lastGenError로 사유 표면화', () => {
  // runStep / runDiagramStep / cohesion catch에서 _lastGenError 셋(체인이 phase·배너에 노출)
  assert.ok((PATENT_SRC.match(/try\{_lastGenError=\(e&&e\.message\)\|\|String\(e\);\}catch\(_e\)\{\}/g) || []).length >= 2, '★ runStep·runDiagramStep catch 사유 캡처');
  assert.match(PATENT_SRC, /catch\(e\)\{ try\{_lastGenError=\(e&&e\.message\)\|\|String\(e\);\}catch\(_e\)\{\} App\.clearProgress\('progressUnifiedGen'\)/, '★ cohesion catch 사유 캡처');
  assert.match(PATENT_SRC, /_lastGenError='게이트 미통과 — '\+gate\.join/, '★ cohesion 게이트 사유 캡처');
  assert.equal(run('typeof _lastGenError'), 'string', '★ 전역 존재');
});
test('★ 1 — [4/4] 실패 시 "여기부터 재개(빈 단계만)" 버튼(_wizResumeChain) + continue 모드 빈 단계만', () => {
  assert.match(HTML_SRC.length ? PATENT_SRC : PATENT_SRC, /onclick="_wizResumeChain\(\)"/, '★ 재개 버튼 배선');
  assert.match(PATENT_SRC, /async function _wizResumeChain\(\)\{[\s\S]{0,400}runUnifiedFullChain\(\{mode:'continue'\}\)/, '★ 재개 = 이어하기(continue)');
  // continue(resume) 모드: 산출물 있는 단계는 건너뛴다
  assert.match(PATENT_SRC, /if\(!\(resume&&outputs\.step_06\)\)\{ _lastGenError=''; await runStep\('step_06'\)/, '★ 청구항 빈 단계만');
  assert.match(PATENT_SRC, /if\(!\(resume&&outputs\.step_07\)\)\{ _lastGenError=''; await runDiagramStep\('step_07'\)/, '★ 도면 빈 단계만');
});

// ═══ 2) 진행 가시성 — 체크리스트 + 레일 running ═══
test('★ 2 — 체크리스트: 명칭→기초(예정)→청구항→도면→본문 렌더 + 상태 전이(running/done/fail)', () => {
  run('_wizPhaseReset();');
  let h = els.wizPhaseList.innerHTML;
  ['명칭','기초','청구항','도면','본문'].forEach(function(l){ assert.ok(h.includes(l), '★ '+l+' 행'); });
  run('_wizPhaseSet("title","running");');
  assert.ok(/◐/.test(els.wizPhaseList.innerHTML), '★ 진행 스피너 문자');
  run('_wizPhaseSet("title","done","확정: 테스트");');
  assert.ok(/✓/.test(els.wizPhaseList.innerHTML) && /확정: 테스트/.test(els.wizPhaseList.innerHTML), '★ 완료 ✓ + 상세');
  run('_wizPhaseSet("body","fail","게이트 미통과");');
  assert.ok(/✗/.test(els.wizPhaseList.innerHTML) && /게이트 미통과/.test(els.wizPhaseList.innerHTML), '★ 실패 ✗ + 사유');
});
test('★ 2 — 레일 배지 running 스피너: _wfRunning=3 → wfBadge2 "◐"', () => {
  run('_wfRunning=3; renderWorkflowRail();');
  assert.equal(els.wfBadge2.textContent, '◐', '★ 3단계 생성 중 스피너');
  run('_wfRunning=0; renderWorkflowRail();');
  assert.notEqual(els.wfBadge2.textContent, '◐', '★ 종료 후 스피너 해제');
  assert.match(PATENT_SRC, /const _rail=function\(n\)\{ try\{_wfRunning=n;/, '★ 체인이 _rail로 running 전이');
});

// ═══ 3) 완료 배너 + 생성 시각 ═══
test('★ 3 — 완료 배너: 성공 "통합 생성 완료 — 시각" / 중단 "통합 생성 중단: N 단계" + 재개 버튼', () => {
  run('outputs.step_06="c"; markOutputTimestamp("step_06");');
  run('_renderCompletionBanner({stopped:false, at:new Date(2026,6,22,14,33).getTime(), gen:5, warn:2});');
  let b = els.dbCompletionBanner.innerHTML;
  assert.ok(/통합 생성 완료 — 7\.22 14:33/.test(b), '★ 완료 + 시각(월.일 시:분)');
  assert.ok(/생성 5단계 · 완성본 경고 2건/.test(b), '★ N단계·M경고');
  run('_renderCompletionBanner({stopped:true, stopLabel:"본문", cause:"게이트 미통과", at:0, gen:4, warn:1});');
  b = els.dbCompletionBanner.innerHTML;
  assert.ok(/통합 생성 중단: 본문 단계/.test(b), '★ 중단 배너');
  assert.ok(/onclick="_wizResumeChain\(\)"/.test(b), '★ 중단 배너에 재개 버튼');
});
test('★ 3 — 생성 시각: _fmtGenTs "M.D HH:MM" + _resultMetaRow(결과 카드 헤더 메타) + renderEditableResult 배선', () => {
  assert.equal(run('_fmtGenTs(new Date(2026,6,22,14,33).getTime())'), '7.22 14:33', '★ 포맷');
  assert.equal(run('_fmtGenTs(0)'), '', '★ 시각 없으면 빈 문자열');
  run('outputTimestamps.step_08=new Date(2026,6,22,9,5).getTime();');
  const meta = run('_resultMetaRow("step_08")');
  assert.ok(/생성 7\.22 09:05/.test(meta), '★ 메타행 시각(0패딩 분)');
  assert.match(PATENT_SRC, /typeof _resultMetaRow==='function'\?_resultMetaRow\(sid\)/, '★ renderEditableResult가 메타행 주입');
});

// ═══ 5) UI 통일성 1차 — HTML/CSS 하부구조 ═══
test('★ 5 — HTML: 체크리스트(wizPhaseList)·완료 배너(dbCompletionBanner)·스피너 CSS 존재', () => {
  assert.match(HTML_SRC, /id="wizPhaseList"/, '★ 오버레이 체크리스트 호스트');
  assert.match(HTML_SRC, /id="dbCompletionBanner"/, '★ ② 보드 완료 배너 호스트');
  assert.match(HTML_SRC, /\.wiz-spin,\.wf-spin\{[^}]*animation:wizspin/, '★ 스피너 애니메이션');
  assert.match(HTML_SRC, /@keyframes wizspin/, '★ keyframes');
});
