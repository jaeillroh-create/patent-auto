/**
 * review-engine/__tests__/patent-batch11-wizard.test.js
 * ★ 배치 11 — A 재실행 판정 수정(산출물 계열만·명칭 보존) + B 통합 생성 위저드(양방향 미러·confirm 폐기) + C ① 문구.
 *   화면 검증(오버레이 흐름·진행 표시·⑤ 이동)은 재일 위임 — 테스트는 판정·미러·배선만 고정.
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
const mkEl = () => ({ value: '', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {} },
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
beforeEach(() => { run('clearAllState(); _methodUserSet=false;'); Object.keys(els).forEach(k => delete els[k]); });

// A) 재실행 판정
test('★ A — 판정: 명칭만(step_01) → 화면3 숨김 / step_06 존재 → 표시', () => {
  run('outputs.step_01="명칭후보"; selectedTitle="테스트 서버";');
  assert.equal(run('_wizHasPrev()'), false, '★ 명칭·범위는 입력 — 산출물 아님');
  run('openUnifiedWizard()');
  assert.equal(els.wizScreen3.style.display, 'none', '★ 화면3 스킵');
  run('outputs.step_06="청구항";');
  run('openUnifiedWizard()');
  assert.equal(els.wizScreen3.style.display, 'block', '★ 산출물 존재 → 화면3 표시');
});

// B) 양방향 미러
test('★ B — 위저드→전역·② 카드 반영: 유형(방법 자동 on)·종속항·도면수·수학식·분량', () => {
  run('_wizSetType("서버 및 방법")');
  assert.equal(run('selectedTitleType'), '서버 및 방법', '★ 유형 전역 반영');
  assert.equal(run('includeMethodClaims'), true, '★ _syncMethodFromType 연동(방법 자동 on)');
  assert.ok(/포함/.test(els.wizMethodNote.innerHTML), '★ 방법 포함 여부 표시');
  run('_wizSetGeneralDep(7)');
  assert.equal(run('deviceGeneralDep'), 7, '★ 전역');
  assert.equal(els.inpDeviceGeneralDep.value, 7, '★ ② 카드 미러');
  run('_wizSetFigures(6)');
  assert.equal(els.optDeviceFigures.value, 6, '★ 도면 수 미러(프롬프트 소스 동일 요소)');
  run('_wizSetMath(true)');
  assert.equal(els.chkUnifiedMath.checked, true, '★ 수학식 미러(인라인 파라미터 소스)');
  run('_wizSetDetail("maximal")');
  assert.equal(run('detailLevel'), 'maximal', '★ 분량 전역');
  assert.equal(els.selUnifiedDetail.value, 'maximal', '★ ② 카드 미러');
});
test('★ B — 역방향: 전역/② 값 → 위저드 열 때 반영', () => {
  run('selectedTitleType="시스템"; deviceGeneralDep=9; deviceAnchorDep=2; detailLevel="detailed";');
  els.optDeviceFigures = mkEl(); els.optDeviceFigures.value = '5';
  els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true;
  run('openUnifiedWizard()');
  assert.equal(els.wizGeneralDep.value, 9, '★ 종속항 반영');
  assert.equal(els.wizFigures.value, '5', '★ 도면 수 반영');
  assert.equal(els.wizMath.checked, true, '★ 수학식 반영');
  assert.equal(els.wizDetail.value, 'detailed', '★ 분량 반영');
  assert.ok(/장치 총 12항/.test(els.wizClaimTotal.textContent), '★ 총 N항 실시간(1+9+2)');
});

// 체인 파라미터 배선
test('★ 배선 — 직접 클릭→위저드 경유, 위저드 start→runUnifiedFullChain({mode}) 호출', () => {
  assert.match(PATENT_SRC, /if\(!_wizOpts&&typeof openUnifiedWizard==='function'/, '★ 체인 진입 시 위저드 분기');
  assert.match(PATENT_SRC, /await runUnifiedFullChain\(\{mode:mode\}\)/, '★ 위저드가 모드와 함께 재호출');
  assert.match(PATENT_SRC, /wizProgressText/, '★ 체인 P() 위저드 진행 미러');
  assert.match(HTML_SRC, /id="wfWizard"/, '★ 오버레이 존재');
  assert.match(HTML_SRC, /name="wizRerun" value="full" checked/, '★ 화면3 라디오(전체 기본)');
  assert.match(HTML_SRC, /⑤ 검증으로 이동/, '★ 완료 요약 CTA');
});
// C) ① 문구
test('★ C — ① 풀체인 카드 문구: 위저드 안내로 교체', () => {
  assert.match(HTML_SRC, /클릭하면 유형·설계를 확인한 뒤 생성합니다\./, '★ 신규 문구');
  assert.ok(!/설계값은 <b>② 설계 결정<\/b> 단계에서 조정합니다/.test(HTML_SRC), '★ 구 문구 제거');
});
