/**
 * review-engine/__tests__/patent-batch12-isolation-board.test.js
 * ★ 배치 12 — A 프로젝트 상태 격리(_wfHardReset·clearAllState) / B ② 설계 보드 미러 / C 적용값 대조(genParams) / D 레일 정합.
 *   화면(오버레이·왕복 UI)은 재일 위임 — 테스트는 상태·판정·미러·스냅샷 배선을 고정.
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
const mkEl = () => ({ value: '', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { _s: new Set(), toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); }, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
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

// A) 상태 격리
test('★ A — clearAllState: outputs/타임스탬프/termSnapshot/genParams/플래그/배지 전부 초기화', () => {
  run('outputs={step_06:"c",step_08:"b"}; outputTimestamps={step_08:5}; termSnapshot.staleTerms=["x"]; termSnapshot.updatedAt=9; genParams={stage3:{}}; _wfStage5Warned=true; _wfDesignAt=123; _methodUserSet=true; selectedTitle="대사 보존형";');
  const b = els.wfBadge0; b.textContent = '✓';   // 이전 프로젝트 잔상
  run('clearAllState();');
  assert.equal(run('Object.keys(outputs).length'), 0, '★ outputs 빈 객체');
  assert.equal(run('Object.keys(outputTimestamps).length'), 0, '★ 타임스탬프 초기화');
  assert.equal(run('_activeStaleTerms().length'), 0, '★ termSnapshot 초기화');
  assert.equal(run('genParams'), null, '★ genParams 초기화');
  assert.equal(run('_wfStage5Warned'), false, '★ ⑤ 경고 플래그');
  assert.equal(run('_wfDesignAt'), 0, '★ 설계 변경 시각');
  assert.equal(run('_methodUserSet'), false, '★ 방법 오버라이드(신규 자동동기 재개)');
  assert.equal(run('selectedTitle'), '', '★ 명칭');
  assert.equal(els.wfBadge0.textContent, '', '★ 레일 배지 DOM blank(잔상 제거)');
});
test('★ A — 격리 후 레일 전부 none·검증바 숨김(빈 프로젝트 = 이전 프로필 미표시)', () => {
  run('outputs={step_06:"c",step_07:"d",step_08:"b"}; outputTimestamps={step_06:1,step_07:1,step_08:1};');
  assert.equal(run('wfStageStatus(3)'), 'done', '★ 전제: 이전 프로젝트 done');
  run('clearAllState();');
  for (let i = 1; i <= 5; i++) assert.equal(run('wfStageStatus(' + i + ')'), 'none', '★ 단계 ' + i + ' none');
  run('renderWfValidationBar()');
  assert.equal(els.wfValidationBar.style.display, 'none', '★ 검증바 숨김(빈 스펙)');
});
test('★ D — 레일 done 조건은 실질 산출물 기준(빈 프로젝트 all-none)', () => {
  run('clearAllState();');
  assert.equal(run('[1,2,3,4,5].map(wfStageStatus).join(",")'), 'none,none,none,none,none', '★ 산출물 없으면 전부 none');
});
test('★ A 소스 — clearAllState가 _wfHardReset 호출 + openProject 말미 1회 렌더', () => {
  assert.match(PATENT_SRC, /genParams=null;\s*\/\/ \[배치12 C\]/, '★ genParams 초기화');
  assert.match(PATENT_SRC, /if\(typeof _wfHardReset==='function'\)_wfHardReset\(\);/, '★ 하드리셋 호출');
  assert.match(PATENT_SRC, /function _wfHardReset\(\)\{[\s\S]{0,1100}wfBadge/, '★ 하드리셋이 배지 blank');   // ★ [배치17-5] refPlanPanel 정리 라인 추가로 창 확장
  assert.match(PATENT_SRC, /try\{_methodUserSet=\(includeMethodClaims===true\)\|\|!!\(outputs\.step_10\|\|outputs\.step_11\);\}catch\(_e\)\{\}/, '★ [검증반영·배치15H] openProject: 복원된 방법-ON opt-in 또는 방법 산출물 있으면 보호(true)');
});

// B) 설계 보드 미러
test('★ B — _dbSet: 보드 → 전역·canonical 요소 미러(종속항·도면)', () => {
  run('_dbSet("generalDep",8)');
  assert.equal(run('deviceGeneralDep'), 8, '★ 전역 반영');
  assert.equal(els.inpDeviceGeneralDep.value, 8, '★ ③ 카드 canonical 미러');
  run('_dbSet("anchorDep",3)');
  assert.equal(run('deviceAnchorDep'), 3, '★ 앵커 전역');
  run('_dbSet("figures",6)');
  assert.equal(els.optDeviceFigures.value, 6, '★ 도면 수 canonical(프롬프트 소스) 미러');
});
test('★ B — 유형 버튼 → _designSetType(위저드 미러)로 유형·방법 동기', () => {
  run('_methodUserSet=false; _designSetType("서버 및 방법")');
  assert.equal(run('selectedTitleType'), '서버 및 방법', '★ 유형');
  assert.equal(run('includeMethodClaims'), false, '★ [배치15C-2] 방법 기본 OFF(유형 「및 방법」도 자동 on 금지)');
});
test('★ B — renderDesignBoard: 현재 상태를 컨트롤·총항수에 반영(요약 아님)', () => {
  run('selectedTitleType="시스템"; deviceGeneralDep=6; deviceAnchorDep=3; detailLevel="detailed"; includeMethodClaims=false;');
  els.optDeviceFigures = mkEl(); els.optDeviceFigures.value = '5';
  run('renderDesignBoard()');
  assert.equal(els.dbGeneralDep.value, 6, '★ 일반 종속항');
  assert.equal(els.dbAnchorDep.value, 3, '★ 앵커 종속항');
  assert.equal(els.dbFigures.value, '5', '★ 도면 수');
  assert.ok(/장치 총 10항/.test(els.dbClaimTotal.textContent), '★ 총항 실시간(1+6+3)');
  assert.equal(els.selUnifiedDetail.value, 'detailed', '★ 분량 canonical select 반영');
});

// C) 적용값 대조
test('★ C — 스냅샷 후 값 변경 → 배지에 "변경됨 — 재생성 필요", 일치는 "적용됨 ✓"', () => {
  run('selectedTitleType="서버"; deviceGeneralDep=5; deviceAnchorDep=4; detailLevel="standard"; includeMethodClaims=false;');
  els.optDeviceFigures = mkEl(); els.optDeviceFigures.value = '4';
  run('_snapshotGenParams("stage3"); _snapshotGenParams("stage4");');
  assert.equal(run('genParams.stage3.generalDep'), 5, '★ 스냅샷 저장');
  run('renderDesignBoard()');
  assert.ok(/일반종속항 적용됨 ✓\(③ 생성 시\)/.test(els.dbApplyBadges.innerHTML), '★ 일치 → 적용됨');
  run('deviceGeneralDep=9; renderDesignBoard();');
  assert.ok(/일반종속항 변경됨 — ③ 재생성 필요\(5→9\)/.test(els.dbApplyBadges.innerHTML), '★ 불일치 → 변경됨(값 대비)');
  assert.ok(/유형 적용됨 ✓/.test(els.dbApplyBadges.innerHTML), '★ 안 바뀐 필드는 적용됨 유지');
});
test('★ C — 스냅샷 없으면 "미생성"', () => {
  run('genParams=null; selectedTitleType="서버"; renderDesignBoard();');
  assert.ok(/유형: 미생성/.test(els.dbApplyBadges.innerHTML), '★ 미생성 표기');
});
test('★ C 소스 — 스냅샷 배선(wfRunStage3 stage3 / cohesion stage4 / 체인 stage3) + 영속', () => {
  assert.match(PATENT_SRC, /_snapshotGenParams\('stage3'\);   \/\/ \[배치12 C\] 골격 생성 시점/, '★ ③ 스냅샷');
  assert.match(PATENT_SRC, /_snapshotGenParams\('stage4'\); \}catch\(_e\)\{\}   \/\/ \[배치12 C\] 본문 생성 시점/, '★ ④ 스냅샷(cohesion)');
  assert.match(PATENT_SRC, /_snapshotGenParams\('stage3'\); \}catch\(_e\)\{\}   \/\/ \[배치12 C\] 체인 골격/, '★ 체인 스냅샷');
  assert.match(PATENT_SRC, /termSnapshot,genParams,refPlan\}/, '★ saveProject 영속');   // ★ [배치17-1] refPlan(확정 부호표) 영속 추가
  assert.match(PATENT_SRC, /genParams=\(s\.genParams&&typeof s\.genParams==='object'\)\?s\.genParams:null/, '★ openProject 복원');
});
