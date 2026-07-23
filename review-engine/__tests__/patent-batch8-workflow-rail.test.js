/**
 * review-engine/__tests__/patent-batch8-workflow-rail.test.js
 *
 * ★ 배치 8 — 5단계 워크플로우 레일(D2 주동선·기본값 진행·고급 접기 / D4 단계 단위 재생성).
 *   로직 무변경 원칙: 기존 함수(runStep·runDiagramStep·runUnifiedCohesionGen·검증·게이트) 호출 재배치 +
 *   표시 계층(레일 배지·상태 모델·상주 검증바·아코디언)만. 화면 검증(레일 진행·배지 전파·재생성·바·접힘)은 재일 위임.
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

let sandbox; let toasts = [];
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast: (m, t) => toasts.push({ m, t }), escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
beforeEach(() => { run('clearAllState(); _wfDesignAt=0; _wfStage5Warned=false;'); toasts = []; });

// ─────────── 상태 모델(미생성/생성됨/재생성 필요) ───────────

test('★ 상태 — ③: 미생성 → 생성됨 → (명칭 재확정) 재생성 필요', () => {
  assert.equal(run('wfStageStatus(3)'), 'none', '★ 미생성');
  run('outputs.step_06="c"; outputs.step_07="d"; outputTimestamps.step_06=1000; outputTimestamps.step_07=1000;');
  assert.equal(run('wfStageStatus(3)'), 'done', '★ 생성됨');
  run('outputs.step_02="x"; termSnapshot.updatedAt=2000;');   // 명칭 재확정(세대 스냅샷 갱신)
  assert.equal(run('wfStageStatus(3)'), 'stale', '★ 상류(명칭) 변경 → 재생성 필요(docA형 UI 차단막)');
});
test('★ 상태 — ④: ③ 재생성(산출 시각 갱신) → ④만 재생성 필요', () => {
  run('outputs.step_06="c";outputs.step_07="d";outputs.step_08="b";outputs.step_18="s";outputTimestamps.step_06=1000;outputTimestamps.step_07=1000;outputTimestamps.step_08=1500;outputTimestamps.step_18=1500;');
  assert.equal(run('wfStageStatus(4)'), 'done', '★ 생성됨');
  run('outputTimestamps.step_06=3000; outputTimestamps.step_07=3000;');   // ③ 재생성
  assert.equal(run('wfStageStatus(3)'), 'done', '★ ③은 최신');
  assert.equal(run('wfStageStatus(4)'), 'stale', '★ ③ 재생성 → ④ 배지');
  assert.equal(run('wfStageStatus(5)'), 'stale', '★ ⑤도 혼합 경고 대상');
});
test('★ 상태 — ② 설정 변경(_wfMarkDesign) → ③④ 재생성 필요', () => {
  run('outputs.step_06="c";outputs.step_07="d";outputs.step_08="b";outputs.step_18="s";outputTimestamps.step_06=1000;outputTimestamps.step_07=1000;outputTimestamps.step_08=1000;outputTimestamps.step_18=1000;');
  run('_wfMarkDesign()');
  assert.equal(run('wfStageStatus(3)'), 'stale', '★ ③ 배지');
  assert.equal(run('wfStageStatus(4)'), 'stale', '★ ④ 배지');
});
test('★ ⑤ 진입 경고 — 혼합 상태에서 1회만, 해소 시 리셋', () => {
  run('outputs.step_06="c";outputs.step_07="d";outputTimestamps.step_06=1000;outputTimestamps.step_07=1000;outputs.step_02="x";termSnapshot.updatedAt=2000;');
  run('_wfWarnStage5()'); run('_wfWarnStage5()');
  assert.equal(toasts.filter(t => /세대 혼합 가능/.test(t.m)).length, 1, '★ 경고 1회');
  run('outputTimestamps.step_06=3000;outputTimestamps.step_07=3000; renderWorkflowRail(); _wfWarnStage5();');
  assert.equal(toasts.filter(t => /세대 혼합 가능/.test(t.m)).length, 1, '★ 해소 후 미발화(리셋은 재혼합 대비)');
});

// ─────────── D4 — ③ 단계 재생성 초기화 ───────────

test('★ D4 — _wfResetStage3Outputs: 골격 계열 6키(관문 14·15 포함)+타임스탬프 초기화, ④ 산출 보존', () => {
  const keys = ['step_06', 'step_10', 'step_14', 'step_15', 'step_07', 'step_11'];
  run(keys.map(k => `outputs[${JSON.stringify(k)}]="x";outputTimestamps[${JSON.stringify(k)}]=1;`).join('') + 'outputs.step_08="본문";');
  run('_wfResetStage3Outputs()');
  keys.forEach(k => assert.equal(run(`outputs[${JSON.stringify(k)}]===undefined && outputTimestamps[${JSON.stringify(k)}]===undefined`), true, '★ ' + k));
  assert.equal(run('outputs.step_08'), '본문', '★ ④ 산출 보존(배지로 재생성 유도)');
});
test('★ D4 소스 — ③ 순차 재실행(기존 함수 재배치)·④ cohesion 호출', () => {
  assert.match(PATENT_SRC, /async function wfRunStage3\(\)[\s\S]{0,800}await runStep\('step_06'\)[\s\S]{0,600}await runDiagramStep\('step_07'\)/, '★ ③: runStep/runDiagramStep 순차');   // ★ [배치19-1] 재작성 락 가드 추가로 창 확장
  assert.match(PATENT_SRC, /if\(had\)_wfResetStage3Outputs\(\);/, '★ ③ 재생성 시 초기화 선행');
  assert.match(PATENT_SRC, /async function wfRunStage4\(\)\{ try\{ await runUnifiedCohesionGen\(\); \}/, '★ ④: 현행 cohesion 호출(무가드·이력 보존)');
});

// ─────────── 레일·검증바·아코디언(HTML) + 훅 배선 ───────────

test('★ HTML — 5단계 레일(배지)·상주 검증바·스테이지 메인카드·고급 아코디언(기본 접힘)', () => {
  ['① 발명 파악', '② 설계 결정', '③ 골격(청구항·도면)', '④ 본문 통합·검토', '⑤ 검증·출원'].forEach(l => assert.ok(HTML_SRC.includes(l), '★ 레일 라벨 ' + l));
  for (let i = 0; i < 5; i++) assert.ok(HTML_SRC.includes('id="wfBadge' + i + '"'), '★ 배지 ' + i);
  assert.match(HTML_SRC, /id="wfValidationBar" onclick="wfOpenValidation\(\)"/, '★ 상주 검증바');
  assert.match(HTML_SRC, /id="wfStage2Main"[\s\S]{0,700}id="dbTypeCards"[\s\S]{0,5200}id="dbApplyBadges"/, '★ ② 설계 보드(유형·적용 배지 — 배치12 B/15B/15C 확장, 15H-3 예시도 유형)');
  assert.match(HTML_SRC, /id="btnWfRegenClaims" onclick="wfRegenClaims\(\)"/, '★ ③ 섹션 재생성(배치15D-2: 큰 CTA 제거)');
  assert.match(HTML_SRC, /id="btnWfRewriteFixes" onclick="wfDiagnoseAndRewrite\(\)"/, '★ ④ 주동선 버튼(배치18-5 진단+반영 단일)');
  assert.match(HTML_SRC, /<details class="wf-adv" id="wfAdv1">/, '★ ② 고급 아코디언');
  assert.match(HTML_SRC, /<details class="wf-adv" id="wfAdv2">/, '★ ③ 고급 아코디언');
  assert.ok(!/<details class="wf-adv"[^>]*open/.test(HTML_SRC), '★ 기본 접힘(open 속성 없음)');
  assert.match(HTML_SRC, /id="chkUnifiedMath"/, '★ 수학식 토글은 ② 카드로 이동(마크업 보존)');
});
test('★ 소스 — switchTab·markOutputTimestamp·openProject에 레일/바 갱신 훅', () => {
  assert.match(PATENT_SRC, /if\(i===4&&typeof _wfWarnStage5==='function'\)_wfWarnStage5\(\)/, '★ ⑤ 진입 경고 훅');
  assert.match(PATENT_SRC, /markOutputTimestamp[\s\S]{0,200}renderWorkflowRail==='function'\)renderWorkflowRail\(\)/, '★ 산출 갱신 → 배지 반영');
  assert.match(PATENT_SRC, /\[배치12 A\/B\] 전체 상태 복원 후 1회 렌더/, '★ openProject 말미 렌더 훅(배치12: 전체 복원 후 1회)');
});
