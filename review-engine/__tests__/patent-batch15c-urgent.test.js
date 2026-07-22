/**
 * review-engine/__tests__/patent-batch15c-urgent.test.js
 * ★ 배치 15C — 긴급 3건.
 *   C1 수학식 인라인 자기검증 게이트(누락 시 상세설명만 1회 재요청→재실패 시 ④ 안내) /
 *   C2 방법 기본 OFF 정책 반전 + 명칭↔세트 불일치 안내 / C3 도면·예시도 수 UI(datalist)·기본값.
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
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); run('clearAllState(); _methodUserSet=false;'); });

// ═══ C1) 수학식 인라인 자기검증 게이트 ═══
const REF = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>';
const DESC_NOMATH = '<<<DEVICE_DESC>>>\n제어부(100)는 데이터를 처리하도록 구성된다.\n<<<END_DEVICE_DESC>>>';
const DESC_MATH2 = '<<<DEVICE_DESC>>>\n제어부(100)는 데이터를 처리하도록 구성된다.\n【수학식 1】\ny = a x + b\n여기서, a는 기울기, b는 절편, x는 입력, y는 출력.\n【수학식 2】\nz = y 의 제곱\n여기서, z는 제곱값, y는 출력.\n<<<END_DEVICE_DESC>>>';

test('★ C1 소스 — 수학식 게이트: _mathInline & 본문 【수학식】 < _mathN → 재요청 + 재실패 시 "수학식 누락 — ④"', () => {
  assert.match(PATENT_SRC, /if\(_mathInline\)\{[\s\S]{0,200}const _mathN=Math\.max\(1,Math\.min\(5,parseInt\(mathBlockCount\)\|\|3\)\)/, '★ 목표 개수 계약');
  assert.match(PATENT_SRC, /_buildMathInlineRetryPrompt\(r\.device\|\|'', r\.method\|\|'', _mathN\)/, '★ 상세설명만 재요청(부호표 보존)');
  assert.match(PATENT_SRC, /_lastGenError='수학식 누락 — ④ 재생성 필요/, '★ 재실패 완료 요약');
  assert.match(PATENT_SRC, /function _buildMathInlineRetryPrompt\(deviceText, methodText, mathN\)/, '★ 재요청 프롬프트 헬퍼');
});
test('★ C1 동작 — 수식 0개 생성→상세설명만 1회 재요청 합성 성공(부호표 보존)', async () => {
  run('outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="서버"; includeMethodClaims=false; mathBlockCount=2;');
  els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true;
  const orig = sandbox.App.callClaudeWithContinuation; let call = 0;
  sandbox.App.callClaudeWithContinuation = async () => { call++; return call === 1 ? (REF + '\n' + DESC_NOMATH) : DESC_MATH2; };
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.equal(call, 2, '★ 정확히 1회 재요청');
  const s08 = run('outputs.step_08') || '';
  assert.ok(/【수학식 1】/.test(s08) && /【수학식 2】/.test(s08), '★ 재요청으로 수식 2개 인라인 포함');
  assert.ok(/제어부\(100\)/.test(s08), '★ 본문·부호 보존');
  // ★ 커밋 시 sanitizeDescFigureRefs가 수식을 stripMathBlocks로 지우지 않는지(keepMath) — 최종 명세서까지 생존
  const spec = run('buildSpecification()') || '';
  assert.ok(/【수학식 1】/.test(spec) && /【수학식 2】/.test(spec), '★ 인라인 수식이 최종 명세서(buildSpecification)까지 보존');
});
test('★ C1 동작 — 재요청도 수식 미포함 → 커밋 차단 + "수학식 누락" 사유', async () => {
  run('outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="서버"; includeMethodClaims=false; mathBlockCount=2; _lastGenError="";');
  els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true;
  const before = run('outputs.step_08') || '';
  const orig = sandbox.App.callClaudeWithContinuation;
  sandbox.App.callClaudeWithContinuation = async () => (REF + '\n' + DESC_NOMATH);   // 두 번 다 수식 없음
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.equal(run('outputs.step_08') || '', before, '★ 커밋 차단(본문 미대체)');
  assert.ok(/수학식 누락/.test(run('_lastGenError') || ''), '★ 완료 요약용 사유 세팅');
});
test('★ C1 — 수학식 미체크(off)면 게이트 미적용(정상 통과)', async () => {
  run('outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="서버"; includeMethodClaims=false;');
  els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = false;   // math off
  const orig = sandbox.App.callClaudeWithContinuation; let call = 0;
  sandbox.App.callClaudeWithContinuation = async () => { call++; return REF + '\n' + DESC_NOMATH; };
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.equal(call, 1, '★ 재요청 없음(수학식 게이트 미적용)');
  assert.ok(/제어부\(100\)/.test(run('outputs.step_08') || ''), '★ 정상 커밋');
});

// ═══ C2) 방법 기본 OFF + 명칭 불일치 안내 ═══
test('★ C2 — _syncMethodFromType 항상 off(정책 반전) + _dbSetMethod 수동 opt-in', () => {
  run('_methodUserSet=false; includeMethodClaims=true; _syncMethodFromType("서버 및 방법")');
  assert.equal(run('includeMethodClaims'), false, '★ 「및 방법」 유형도 자동 off');
  run('_dbSetMethod(true)');
  assert.equal(run('includeMethodClaims'), true, '★ ② 방법 체크 → on');
  assert.equal(run('_methodUserSet'), true, '★ 사용자 설정 플래그');
  assert.match(PATENT_SRC, /const want=false;\s*\/\/ 유형 무관/, '★ want=false 반전');
});
test('★ C2 — ② 보드: 명칭에 「및 방법」인데 방법 off → dbMethodNote 안내 + 방법 체크박스', () => {
  run('selectedTitleType="서버 및 방법"; selectedTitle="콘텐츠 라우팅 서버 및 방법"; includeMethodClaims=false; _methodUserSet=false;');
  els.dbMethodNote = mkEl(); els.chkDbMethod = mkEl();
  run('renderDesignBoard()');
  assert.ok(/방법 세트를 생성하려면.*방법 청구항 포함.*체크/.test(els.dbMethodNote.innerHTML), '★ 명칭↔세트 불일치 안내');
  assert.equal(els.chkDbMethod.checked, false, '★ 방법 체크 off 동기');
  assert.match(HTML_SRC, /id="chkDbMethod" onchange="_dbSetMethod\(this\.checked\)"/, '★ ② 방법 opt-in 체크박스');
});

// ═══ C3) 도면·예시도 수 UI ═══
test('★ C3 — 도면 수·예시도 수: datalist(select+직접입력) + 0/1~9 범위', () => {
  assert.match(HTML_SRC, /id="dbFigures" list="dbFigCountOpts" min="0"/, '★ 도면 수 datalist + 0 허용');
  assert.match(HTML_SRC, /<datalist id="dbFigCountOpts">[\s\S]*?value="0"[\s\S]*?value="9"[\s\S]*?<\/datalist>/, '★ 0~9 옵션');
  assert.match(HTML_SRC, /id="optDeviceFigures" list="dbFigCountOpts" min="0"/, '★ optDeviceFigures 0 허용·datalist 공유');
  assert.match(HTML_SRC, /id="dbConceptCount" list="dbConceptCountOpts"/, '★ 예시도 수 datalist');
  assert.equal(run('conceptTargetCount'), 2, '★ 예시도 기본 개수 2');
  run('_dbSet("conceptCount","9")');
  assert.equal(run('conceptTargetCount'), 9, '★ 예시도 수 1~9 조절(상한 확장)');
});
