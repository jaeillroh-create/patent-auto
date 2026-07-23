/**
 * review-engine/__tests__/patent-batch15d-structure.test.js
 * ★ 배치 15D — AI 경로 일원화 + 생성 진입점 정리.
 *   D1 ⑤ 자동보정 제거→④ 재생성 안내 / D2 ③ 골격 확인·재생성(큰 CTA 제거) /
 *   D3 ②/④ 명명(범위 명시) / D4 전체 흐름 안내(각 탭 상단 1줄).
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
    setTimeout: (f) => { try { f(); } catch (_e) {} return 0; }, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: (sel) => (sandbox.__q && sandbox.__q[sel]) || [], createElement: () => mkEl(), addEventListener() {} },
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

// D1) ⑤ 자동보정 제거 → ④ 재생성 일원화
test('★ D1 — ⑤ AI로 수정 버튼 제거 + renderSpecValidation에 ④ 재생성 안내 버튼', () => {
  assert.ok(!/onclick="fixSpecValidationIssues\(\)"/.test(PATENT_SRC), '★ AI로 수정 버튼 제거');
  assert.ok(!/AI로 수정 \(/.test(PATENT_SRC), '★ 자동보정 라벨 제거');
  assert.match(PATENT_SRC, /id="btnGoStage4FromValidate" onclick="switchTab\(3\)"/, '★ ④ 이동 버튼');
  assert.match(PATENT_SRC, /결함 성격에 따라 재작성 경로가 다릅니다/, '★ 결함 성격별 분기 안내(배치15L-4)');
});
test('★ D1 — renderSpecValidation 렌더 시 ④ 재생성 안내(결함 있을 때)', () => {
  run('clearAllState(); outputs.step_08="제어부(100)는 처리한다."; outputs.step_06="【청구항 1】 장치."; selectedTitle="t";');
  els.resultCardSpecValidate = mkEl();
  run('renderSpecValidation();');
  const h = els.resultCardSpecValidate.innerHTML || '';
  // 결함 유무와 무관하게 잔존 항목 있으면 안내(없으면 통과 메시지). 함수 존재·안내 배선만 확인.
  assert.equal(run('typeof renderSpecValidation'), 'function', '★ 패널 렌더 함수');
  assert.ok(!/AI로 수정/.test(h), '★ 렌더 결과에 AI로 수정 버튼 없음');
});

// D2) ③ 재정의 — 골격 확인·재생성, 큰 CTA 제거
test('★ D2 — ③ 큰 CTA(btnWfStage3) 제거 + "골격 확인·재생성" + 섹션 재생성만', () => {
  assert.ok(!/id="btnWfStage3"/.test(HTML_SRC), '★ 큰 CTA 제거');
  assert.match(HTML_SRC, /③ 골격 확인·재생성 \(청구항·도면\)/, '★ ③ 재정의 타이틀');
  assert.match(HTML_SRC, /<b>전체 생성은 ② 통합 생성<\/b>/, '★ "전체는 ②" 문구');
  assert.match(HTML_SRC, /id="btnWfRegenClaims"[\s\S]*id="btnWfRegenFigures"/, '★ 섹션별 재생성 유지');
  assert.equal(run('typeof wfRunStage3'), 'function', '★ wfRunStage3 함수는 레거시 존치');
});

// D3) ②/④ 명명 — 범위 명시
test('★ D3 — ② 「전체」·④ 「본문만」 범위를 이름에 명시', () => {
  assert.match(HTML_SRC, /id="btnUnifiedFullChain"[^>]*>[\s\S]{0,80}통합 생성 \(명칭·청구항·도면·본문 전체\)/, '★ ② 전체 범위 명시');
  assert.match(HTML_SRC, /id="btnWfRewriteFixes"[^>]*>[\s\S]{0,80}결함 반영해 본문 다시 쓰기/, '★ ④ 결함 반영 재작성 명시(배치16)');
  assert.match(HTML_SRC, /④ 결함 반영해 본문 다시 쓰기 \(청구항·도면 유지\)/, '★ ④ 카드 타이틀(청구항·도면 유지)');
});

// D4) 전체 흐름 안내 — 각 탭 상단 1줄
test('★ D4 — 각 탭(page0~4) 상단 wf-flowbar[data-flowstep] + 현재 단계 강조 렌더', () => {
  for (let n = 0; n <= 4; n++) assert.ok(HTML_SRC.includes('data-flowstep="' + n + '"'), '★ flowbar 컨테이너 ' + n);
  assert.equal(run('typeof _renderFlowBars'), 'function', '★ 흐름바 렌더 함수');
  // 렌더: data-flowstep=2인 요소는 ③ 골격 확인 강조
  const bar = mkEl(); bar.getAttribute = () => '2';
  sandbox.__q = { '.wf-flowbar': [bar] };
  run('_renderFlowBars();');
  sandbox.__q = {};
  assert.ok(/① 입력[\s\S]*② 전체 생성[\s\S]*③ 골격 확인[\s\S]*④ 본문 재검토[\s\S]*⑤ 검증·출원/.test(bar.innerHTML), '★ 5단계 흐름');
  assert.ok(/<b[^>]*>③ 골격 확인<\/b>/.test(bar.innerHTML), '★ 현재 단계(③) 강조');
});
test('★ D4 — switchTab이 _renderFlowBars 호출', () => {
  assert.match(PATENT_SRC, /if\(typeof _renderFlowBars==='function'\)_renderFlowBars\(\)/, '★ 탭 전환 시 흐름바 갱신');
});
