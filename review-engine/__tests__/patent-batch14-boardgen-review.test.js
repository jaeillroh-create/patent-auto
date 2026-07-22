/**
 * review-engine/__tests__/patent-batch14-boardgen-review.test.js
 * ★ 배치 14 — 생성 진입점 ② 보드로 + 위저드 축소 + 검토 일원화(자동검증 제거·특허성 13통합·대안 ③고급).
 *   화면(오버레이 흐름)은 재일 위임 — 테스트는 배선·프롬프트·DOM 배치·자동경로 유지.
 */
import { test, before } from 'node:test';
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

// 1) 생성 CTA ② 이동 — 파라미터 소스 무변경
test('★ 1 — 통합 생성 버튼 ② 보드로, 파라미터 소스(도면수·수학식·분량)는 동일 요소 유지', () => {
  assert.match(HTML_SRC, /id="wfStage2Main"[\s\S]*?id="btnUnifiedFullChain"[\s\S]{0,140}onclick="runUnifiedFullChain\(\)"/, '★ ② 보드 내 버튼');
  assert.match(HTML_SRC, /id="wfStage2Main"[\s\S]*?id="progressUnifiedFullChain"/, '★ 진행바도 ② 이식');
  // 프롬프트/체인이 읽는 소스 요소가 ② 보드에 그대로 존재(chkUnifiedMath·selUnifiedDetail·optDeviceFigures는 ②/③)
  assert.match(HTML_SRC, /id="chkUnifiedMath"/, '★ 수학식 소스');
  assert.match(HTML_SRC, /id="selUnifiedDetail"/, '★ 분량 소스');
});

// 2) 위저드 축소
test('★ 2 — 위저드에서 유형·설계 화면 제거, 설계 요약 에코+재실행만', () => {
  assert.ok(!/id="wizTypeCards"/.test(HTML_SRC) && !/id="wizGeneralDep"/.test(HTML_SRC) && !/id="wizDetail"/.test(HTML_SRC), '★ 화면1·2 제거');
  assert.match(HTML_SRC, /id="wizDesignEcho"/, '★ 설계 요약 에코');
  assert.match(HTML_SRC, /id="wizScreen3"/, '★ 재실행 화면 유지');
  assert.ok(!/function _wizSetGeneralDep/.test(PATENT_SRC) && !/function _wizSetDetail/.test(PATENT_SRC), '★ 죽은 설계 setter 제거');
});

// 3) ③ 재생성 전용화
test('★ 3 — ③ 주 CTA 보조 스타일 + "골격만 재생성" + "기본 생성 경로는 ② 통합 생성"', () => {
  assert.match(HTML_SRC, /class="btn btn-outline btn-full" id="btnWfStage3" onclick="wfRunStage3\(\)"[\s\S]{0,120}골격만 재생성/, '★ 보조 스타일 + 라벨');
  assert.match(HTML_SRC, /<b>기본 생성 경로는 ② 통합 생성<\/b>/, '★ 문구');
  assert.ok(!/id="btnWfStage3"[^>]*btn-primary/.test(HTML_SRC), '★ 주 스타일(primary) 아님');
});

// 4a) 자동검증 버튼 제거 + 자동 경로/함수 유지
test('★ 4a — 자동검증 버튼 제거, runValidation 함수·생성후 자동검증(runScopeCheck) 경로는 유지', () => {
  assert.ok(!/onclick="runValidation\(\)"/.test(HTML_SRC), '★ 버튼 제거');
  assert.equal(run('typeof runValidation'), 'function', '★ 함수 존치(레거시)');
  assert.match(PATENT_SRC, /\[C1 자동 연쇄\] SCOPE_GUARDED 스텝 생성 후 자동 검증/, '★ 생성 직후 자동 검증 경로 유지');
  // 완성본 자동 검증 표면(검증바·기계검증)도 유지
  assert.equal(run('typeof renderWfValidationBar'), 'function', '★ 상주 검증바');
  assert.equal(run('typeof machineFindingsForReview'), 'function', '★ 기계검증 주입');
});

// 4b) Step 15 특허성 → Step 13 통합
test('★ 4b — step_13 프롬프트에 특허성(신규성·진보성) 축 + [특허성] 섹션 + 선행기술 입력', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부를 포함하는 서버."; outputs.step_08="제어부(100)는 처리한다."; outputs.step_04="[선행기술] 인용발명 제10-0001호"; selectedTitle="테스트";');
  const p = run("buildPrompt('step_13')");
  assert.ok(/특허성 검토 \(신규성·진보성/.test(p), '★ 특허성 검토 항목');
  assert.ok(/차별 구성/.test(p) && /자명성 리스크/.test(p) && /보완 방향/.test(p), '★ 검토 축');
  assert.ok(/"\[특허성\]" 소제목으로 구분/.test(p), '★ 결과 [특허성] 섹션 지시');
  assert.ok(/\[선행기술 — 특허성 검토용\] \[선행기술\] 인용발명 제10-0001호/.test(p), '★ 선행기술 입력 주입');
  assert.ok(/완성 문언 수술 금지/.test(p) || /완성 문언 수술 금지|완성 문언/.test(p), '★ 방향만(문언 수술 금지)');
});
test('★ 4b — Step 15 단독 버튼·카드 제거, runStep(step_15) 함수는 존치(레거시)', () => {
  assert.ok(!/id="btnStep15"/.test(HTML_SRC) && !/Step 15: 특허성 검토/.test(HTML_SRC), '★ 버튼·카드 제거');
  assert.match(PATENT_SRC, /case 'step_15'/, '★ step_15 프롬프트 케이스 존치');
});

// 4c) Step 14 → ③ 고급
test('★ 4c — Step 14 대안 청구항이 ③ 고급(wfAdv2) 안', () => {
  const p2 = HTML_SRC.slice(HTML_SRC.indexOf('id="page2"'), HTML_SRC.indexOf('id="page3"'));
  const adv2Start = p2.indexOf('id="wfAdv2"');
  assert.ok(adv2Start >= 0 && p2.indexOf('id="btnStep14"') > adv2Start, '★ btnStep14가 wfAdv2 이후(고급 내부)');
});

// 5) ④ 문구
test('★ 5 — ④ AI 검토 카드에 특허성 포함 명시', () => {
  assert.match(HTML_SRC, /Step 13: AI 검토 \(특허성 포함\)/, '★ 카드 타이틀');
  assert.match(HTML_SRC, /특허성\(신규성·진보성\)<\/b>을 통합 검토/, '★ 설명 + [특허성] 섹션 안내');
});
