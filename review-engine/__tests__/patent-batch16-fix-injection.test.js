/**
 * review-engine/__tests__/patent-batch16-fix-injection.test.js
 * ★ 배치 16 — 재생성이 결함을 반영하지 않던 근본 결함 수정.
 *   1 FIX_TARGETS 생성·주입(기계검증 결함→지시) · 2 REVIEW_NOTES 동시주입 · 3 버튼 통폐합 ·
 *   4 해소 검증 루프(재검증·해소/잔존 카운트·최대 2회) · 5 ⑤ 안내문.
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

let sandbox; const els = {}; let toasts = [];
const mkEl = () => ({ value: '', checked: false, disabled: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', title: '', getAttribute: () => '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', safeMaxTokensLarge: () => 16000, escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {}, updateStats() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast: (m, t) => toasts.push({ m, t }), escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, updateStats() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true, API_KEY: 'stub',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); toasts = []; run('clearAllState();'); });

// ─────────────── 1) _buildFixTargets: 결함 → 지시 변환 ───────────────

test('16-1 ★ — _buildFixTargets: 부호 불일치(b-경로) → canonical 명칭 통일 지시', () => {
  const out = run(`_buildFixTargets([{check:'refnum_dupassign', message:'부호 (110)에 부호의 설명 정의("대사보존형서사구조화부")와 다른 구성요소 명칭 배정', detail:'canonical="대사보존형서사구조화부" ↔ body="프로세서"'}])`);
  assert.match(out, /부호 \(110\)/, '★ 부호 번호');
  assert.match(out, /'프로세서'으로 지칭된 것을 부호의 설명 명칭 '대사보존형서사구조화부'으로 통일/, '★ body→canonical 지시');
});

test('16-1 ★ — _buildFixTargets: 동일명칭 다중부호(c-경로) → 개별 명명 지시', () => {
  const out = run(`_buildFixTargets([{check:'refnum_dupassign', message:'동일 명칭 "메모리"에 부호 2개 배정', detail:'120, 130'}])`);
  assert.match(out, /명칭 '메모리'이 여러 부호\(120, 130\)에 중복 배정/, '★ 중복 배정 명시');
  assert.match(out, /각기 다른 명칭|하나의 부호로 통일/, '★ 해소 방향');
});

test('16-1 ★ — _buildFixTargets: 수식 변수·표제·절단·메타응답 변환', () => {
  const out = run(`_buildFixTargets([
    {check:'math_var_undefined', message:'수학식 2의 기호 θ 미정의'},
    {check:'heading_order', message:'표제 순서 오류'},
    {check:'sentence_truncation', message:'문장 절단 의심', detail:'…무차원량이다.2'},
    {check:'meta_response_residue', severity:'CRITICAL', detail:'청구항을 알려주세요'}
  ])`);
  assert.match(out, /수식 변수 미정의:.*여기서" 절에 정의하라/, '★ 수식 변수');
  assert.match(out, /표제 순서:.*바로잡으라/, '★ 표제');
  assert.match(out, /문장 절단:.*완결된 문장으로 복원/, '★ 절단');
  assert.match(out, /메타응답 잔류\(CRITICAL\):.*순수 명세서 서술문/, '★ 메타응답');
});

test('16-1 ★ — 빈 issues → 빈 문자열(주입 없음)', () => {
  assert.strictEqual(run('_buildFixTargets([])'), '', '★ 결함 없으면 빈 지시');
});

// ─────────────── 1) FIX_TARGETS 주입 ───────────────

test('16-1 ★ 동작 — _pendingFixTargets 있으면 cohesion 프롬프트에 FIX_TARGETS 주입', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버";');
  run(`_pendingFixTargets="· 부호 (110): '프로세서'를 'FIXMARK구조화부'로 통일하라.";`);
  const p = run("buildPrompt('unified_cohesion')") || '';
  assert.match(p, /<<<FIX_TARGETS>>>/, '★ FIX_TARGETS 블록');
  assert.match(p, /FIXMARK구조화부/, '★ 지시 주입');
  assert.match(p, /각 항목을 이번 재작성에서 반드시 모두 해소/, '★ 해소 지시');
  assert.match(p, /나머지 내용·구조·용어·참조번호는 그대로 유지/, '★ 나머지 유지');
});

test('16-2 ★ 동작 — FIX_TARGETS + REVIEW_NOTES 동시 주입', () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버";');
  run(`_pendingFixTargets="· 부호 정합: FIXMARK"; _pendingReviewNotes="[특허성] REVIEWMARK 보강";`);
  const p = run("buildPrompt('unified_cohesion')") || '';
  assert.match(p, /<<<FIX_TARGETS>>>[\s\S]*FIXMARK/, '★ FIX_TARGETS');
  assert.match(p, /<<<REVIEW_NOTES>>>[\s\S]*REVIEWMARK/, '★ REVIEW_NOTES');
});

// ─────────────── 3) 버튼 통폐합 ───────────────

test('16-3 ★ HTML — ④ 통합 버튼 1개(btnWfRewriteFixes) + 반영 대상 라벨 + 진단 카드 별도', () => {
  assert.match(HTML_SRC, /id="btnWfRewriteFixes" onclick="wfRewriteWithFixes\(\)"/, '★ 통합 재작성 버튼');
  assert.match(HTML_SRC, /id="wfRewriteTargetLabel"/, '★ 반영 대상 라벨');
  assert.match(HTML_SRC, /명세서 진단 \(AI\) 실행/, '★ 진단은 별도 유지');
  assert.ok(!/id="btnWfStage4"/.test(HTML_SRC) && !/id="btnRewriteWithReview"/.test(HTML_SRC), '★ 구 버튼 제거');
});

test('16-3 ★ 동작 — _updateRewriteBtn 라벨: 기계검증 N건 + AI 진단 M건', () => {
  els.btnWfRewriteFixes = mkEl(); els.wfRewriteTargetLabel = mkEl();
  // 부호 정합 결함 유발 상태(본문 (200) 미정의) + 진단(step_13)
  run(`clearAllState(); selectedTitle="t"; outputs={ step_06:"【청구항 1】 제어부.", step_08:"제어부(100)가 수신부(200)로 보낸다. 제어부(100)가 처리한다.", step_18:"제어부 : 100", step_13:"[특허성] 진보성 미흡" };`);
  run('_updateRewriteBtn()');
  assert.strictEqual(els.btnWfRewriteFixes.disabled, false, '★ 골격 있으면 활성');
  assert.match(els.wfRewriteTargetLabel.textContent, /기계검증 \d+건 \+ AI 진단 1건/, '★ 기계검증+AI 카운트');
});

// ─────────────── 4) 해소 검증 루프 ───────────────

test('16-4 ★ 동작 — 결함 → 재작성(클린 본문) → 전부 해소 배너', async () => {
  els.chkUnifiedMath = mkEl(); els.cohesionBanner = mkEl();
  // 재생성 전: 본문이 (200)을 쓰는데 부호표 미정의 → refnum 결함
  run(`clearAllState(); selectedTitle="테스트 장치"; selectedTitleType="장치"; includeMethodClaims=false;
    outputs={ step_06:"【청구항 1】 제어부를 포함하는 장치.", step_07:"도 1", step_08:"제어부(100)가 수신부(200)로 데이터를 보낸다. 제어부(100)가 처리하고 제어부(100)가 저장한다.", step_18:"제어부 : 100" };`);
  const before = run('validateSpecification(buildSpecification()).length');
  assert.ok(before > 0, '★ 재작성 전 결함 존재');
  // 재작성 LLM은 클린 본문 반환(200도 정의) → 재검증 0
  const CLEAN = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n(200) 수신부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n도 1을 참조하면, 제어부(100)가 수신부(200)로 데이터를 보내고 제어부(100)가 처리한다.\n<<<END_DEVICE_DESC>>>';
  sandbox.App.callClaudeWithContinuation = async () => CLEAN;
  await run('wfRewriteWithFixes()');
  assert.ok(toasts.some(t => /결함 반영 재작성 완료.*해소/.test(t.m)), '★ 해소 요약 토스트');
  assert.ok(toasts.some(t => /전부 해소|건 해소/.test(t.m)), '★ 해소 카운트');
});

test('16-4 ★ 동작 — FIX_TARGETS가 재작성 프롬프트에 실제 주입됨(루프 내)', async () => {
  els.chkUnifiedMath = mkEl();
  run(`clearAllState(); selectedTitle="t"; selectedTitleType="장치"; includeMethodClaims=false;
    outputs={ step_06:"【청구항 1】 제어부.", step_07:"도 1", step_08:"제어부(100)가 수신부(200)로 보낸다. 제어부(100)가 처리한다.", step_18:"제어부 : 100" };`);
  let sawFix = false;
  sandbox.App.callClaudeWithContinuation = async (prompt) => {
    if (/<<<FIX_TARGETS>>>/.test(prompt)) sawFix = true;
    return '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n(200) 수신부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n제어부(100)가 수신부(200)로 보낸다.\n<<<END_DEVICE_DESC>>>';
  };
  await run('wfRewriteWithFixes()');
  assert.ok(sawFix, '★ 재작성 프롬프트에 FIX_TARGETS 주입 확인(재생성=해소가 사실)');
});

test('16-4 ★ 동작 — 잔존 시 최대 2회(무한 반복 아님)', async () => {
  els.chkUnifiedMath = mkEl();
  // 재생성 후에도 지속되는 결함: 하드웨어 상용구 '메모리'가 120·130에 중복(dupassign) — _deriveSignDescription 재직렬화로도 안 사라짐.
  run(`clearAllState(); selectedTitle="t"; selectedTitleType="장치"; includeMethodClaims=false;
    outputs={ step_06:"【청구항 1】 메모리를 포함하는 장치.", step_07:"도 1", step_08:"메모리(120)가 저장하고 메모리(130)가 캐시한다. 메모리(120)가 읽고 메모리(130)가 쓴다.", step_18:"메모리 : 120\\n메모리 : 130" };`);
  let calls = 0;
  sandbox.App.callClaudeWithContinuation = async () => { calls++; return '<<<REFTABLE>>>\n[장치부호]\n(120) 메모리\n(130) 메모리\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n메모리(120)가 저장하고 메모리(130)가 캐시한다. 메모리(120)가 읽고 메모리(130)가 쓴다.\n<<<END_DEVICE_DESC>>>'; };
  await run('wfRewriteWithFixes()');
  assert.ok(calls >= 2, '★ 잔존 시 재요청(≥2 cohesion 호출)');
  assert.ok(toasts.some(t => /잔존/.test(t.m)), '★ 잔존 건수 표시(무한 반복 대신 종료)');
});

// ─────────────── 소스 배선 ───────────────

test('16 소스 ★ — FIX_TARGETS 계산·주입·루프·별칭 배선', () => {
  assert.match(PATENT_SRC, /function _buildFixTargets\(issues\)\{/, '★ 변환 함수');
  assert.match(PATENT_SRC, /const _fixInject=_fixTargets\?/, '★ cohesion FIX_TARGETS 주입 계산');
  assert.match(PATENT_SRC, /\$\{designComponents\}\$\{_fixInject\}\$\{_reviewInject\}/, '★ FIX+REVIEW 동시 주입 위치');
  assert.match(PATENT_SRC, /async function wfRewriteWithFixes\(\)\{/, '★ 통합 재작성 루프');
  assert.match(PATENT_SRC, /while\(round<2\)\{/, '★ 최대 2회 루프');
  assert.match(PATENT_SRC, /_pendingFixTargets=\(typeof _buildFixTargets==='function'\)\?_buildFixTargets\(remain\)/, '★ 잔존만 재주입');
  assert.match(PATENT_SRC, /if\(!remain\.length\)break;/, '★ 전부 해소 시 조기 종료');
});
