/**
 * review-engine/__tests__/patent-batch15k-quality.test.js
 * ★ 배치 15K — docJ 실증 반영.
 *   1,2 하드웨어 상용구 혼입 → dupassign 차단(프롬프트 C5b·C12 g2 + step_08c 예시 정리 + dupassign 힌트) /
 *   4 분량 총량 미달(C11 총량 우선 + 80% 보강 재요청) / 5 수학식 게이트 병합후·1차 포함 명시 / 6 수식 좌·우변 1:1 자기검증.
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

let sandbox; const els = {}; let toasts = [];
const mkEl = () => ({ value: '', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
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

const cohPromptEnv = () => { run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도1"; selectedTitle="s"; selectedTitleType="서버"; mathBlockCount=3;'); els.chkUnifiedMath = mkEl(); els.chkUnifiedMath.checked = true; };

// ─────────────── 15K-1,2 하드웨어 상용구 ───────────────

test('15K-1,2 ★ — cohesion C5b: 일반 하드웨어 상용구 참조번호 금지 규칙', () => {
  cohPromptEnv();
  const p = run("buildPrompt('unified_cohesion')") || '';
  assert.match(p, /일반 하드웨어 상용구.*참조번호.*금지/, '★ C5b 총칭어+번호 금지');
  assert.match(p, /프로세서·메모리·통신부·저장부·제어부·관리부/, '★ 총칭어 목록');
  assert.match(p, /참조번호 없이.*서술/, '★ 번호 없이 서술 지침');
});

test('15K-1,2 ★ — C12 (g2): 하드웨어 상용구 번호 자기검증', () => {
  cohPromptEnv();
  const p = run("buildPrompt('unified_cohesion')") || '';
  assert.match(p, /\(g2\) ★ \[배치15K\] 일반 하드웨어 상용구.*참조번호를 붙이지 않았는가/, '★ C12 g2 자기검증');
});

test('15K-1,2 ★ 동작 — 하드웨어 상용구가 여러 번호에 배정되면 dupassign detail에 원인 힌트', () => {
  // "프로세서"가 100·200 두 번호에 → refnum_dupassign + 하드웨어 힌트
  run(`clearAllState(); selectedTitle="t"; outputs={ step_06:"【청구항 1】 프로세서(100)와 프로세서(200)를 포함한다.", step_08:"제어부(110)가 프로세서(100)로 데이터를 보내고, 프로세서(200)가 처리한다. 프로세서(100)는 저장하고 프로세서(200)는 연산한다. 프로세서(100)와 프로세서(200)가 협력한다.", step_18:"프로세서 : 100\\n프로세서 : 200\\n제어부 : 110" };`);
  const iss = JSON.parse(run('JSON.stringify(validateSpecification(buildSpecification()))'));
  const dup = iss.find(i => i.check === 'refnum_dupassign' && /프로세서/.test(i.message));
  assert.ok(dup, '★ 프로세서 dupassign 검출');
  assert.match(dup.detail, /일반 하드웨어 상용구/, '★ 하드웨어 상용구 원인 힌트');
});

test('15K-1,2 ★ 보정 — b-경로(canonical↔body 불일치)에서도 하드웨어 상용구 힌트 부착(docJ 실경로)', () => {
  // docJ: 부호표 canonical="대사 보존형 서사 구조화부"(100)인데 본문이 "프로세서(100)"로 지칭 → b-경로 dupassign.
  run(`clearAllState(); selectedTitle="t"; outputs={ step_06:"【청구항 1】 대사 보존형 서사 구조화부(100)를 포함하는 장치.", step_08:"도 1을 참조하면, 프로세서(100)가 데이터를 처리한다. 프로세서(100)는 저장하고, 프로세서(100)가 연산한다.", step_18:"대사 보존형 서사 구조화부 : 100" };`);
  const iss = JSON.parse(run('JSON.stringify(validateSpecification(buildSpecification()))'));
  const b = iss.find(i => i.check === 'refnum_dupassign' && /canonical=/.test(i.detail || ''));
  assert.ok(b, '★ b-경로(canonical↔body) dupassign 발화');
  assert.match(b.detail, /하드웨어 상용구가 구성부 번호를 점유/, '★ b-경로 하드웨어 상용구 힌트(c-경로 아닌 실경로)');
  assert.match(b.detail, /본문 명칭을 부호표 명칭으로 통일 필요/, '★ 해소 방향 안내');
});

test('15K-1,2 ★ 보정 — b·c 경로가 공유 _HW_BOILER_RE 사용', () => {
  assert.match(PATENT_SRC, /const _HW_BOILER_RE=\/\^\(프로세서\|메모리\|서버/, '★ 공유 상수 정의');
  assert.match(PATENT_SRC, /const _bHw=cl\.some\(t=>_HW_BOILER_RE\.test/, '★ b-경로 사용');
  assert.match(PATENT_SRC, /const _hwBoiler=_HW_BOILER_RE\.test/, '★ c-경로 사용');
});

test('15K-1,2 ★ — step_08c 예시가 총칭어+번호 대신 장치 구성요소 참조', () => {
  const p = run(`(function(){ var _ct={type:'ui_screen',figNum:5,refMap:[{signNumber:'51',label:'검색창'}]}; try{return _buildConceptDescPrompt?_buildConceptDescPrompt([_ct]):''}catch(e){return String(e)} })()`);
  // 프롬프트 빌더 이름이 다를 수 있어 소스로도 확인
  assert.ok(!/프로세서\(120\)가 실행하는 소프트웨어/.test(PATENT_SRC), '★ 프로세서(120) 예시 제거(총칭어+번호 금지)');
  assert.match(PATENT_SRC, /\[장치 도면 설계에 정의된 상위 구성요소\(NN\)\]/, '★ 장치 구성요소 참조 예시로 대체');
});

// ─────────────── 15K-4 분량 총량 ───────────────

test('15K-4 ★ — C11 총량 우선(1차 제약)', () => {
  cohPromptEnv();
  const p = run("buildPrompt('unified_cohesion')") || '';
  assert.match(p, /\[1차 제약 — 총량 우선\(배치15K\)\]/, '★ 총량 1차 제약');
  assert.match(p, /총량 미달 = 출력 미완성/, '★ 총량 미달=미완성');
  assert.match(p, /\(보조 하한\).*도면 1개당/, '★ 도면당 하한은 보조');
});

test('15K-4 ★ — _cohesionTargetChars: 프리셋별 목표 총량', () => {
  run(`detailLevel='maximal'`); assert.strictEqual(run('_cohesionTargetChars()'), 22000, '★ maximal 22000');
  run(`detailLevel='detailed'`); assert.strictEqual(run('_cohesionTargetChars()'), 8000, '★ detailed 8000');
  run(`detailLevel='standard'`); assert.strictEqual(run('_cohesionTargetChars()'), 5000, '★ standard 5000');
  run(`detailLevel='custom'; customDetailChars=2000; outputs.step_07='도 1: A\\n도 2: B\\n도 3: C';`);
  assert.strictEqual(run('_cohesionTargetChars()'), 6000, '★ custom = 2000 × 도면수(3)');
});

test('15K-4 ★ — _buildVolumeAugmentPrompt: 기존 유지·확장 지시', () => {
  const p = run(`_buildVolumeAugmentPrompt('제어부(100)가 동작한다.', '', 22000, true)`) || '';
  assert.match(p, /22000자 이상/, '★ 목표 분량 명시');
  assert.match(p, /기존 내용·용어·참조번호·구조를 그대로 유지/, '★ 기존 유지');
  assert.match(p, /확장만 하라/, '★ 확장(삭제·요약 금지)');
  assert.match(p, /수학식 N】 블록과 "여기서" 정의절을 그대로 보존/, '★ 수식 보존(math on)');
});

test('15K-4 ★ 동작 — 분량 미달 시 확장 보강 재요청 후 더 긴 본문 채택', async () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="장치"; includeMethodClaims=false; detailLevel="maximal";');
  els.chkUnifiedMath = mkEl(); // math off
  const SHORT_BODY = '<<<DEVICE_DESC>>>\n제어부(100)가 동작한다.\n<<<END_DEVICE_DESC>>>';
  const REFT = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>';
  const LONG_DEV = '<<<DEVICE_DESC>>>\n' + ('제어부(100)가 상세히 동작하며 데이터를 처리하고 저장한다. '.repeat(600)) + '\n<<<END_DEVICE_DESC>>>';  // >22000*0.8
  let call = 0;
  sandbox.App.callClaudeWithContinuation = async (prompt) => {
    call++;
    if (/1\/2단계/.test(prompt)) return SHORT_BODY;                 // split 본문(짧음)
    if (/2\/2단계/.test(prompt)) return REFT;                       // split 마무리
    if (/분량 미달|확장/.test(prompt) || /목표 분량/.test(prompt)) return LONG_DEV; // 분량 보강
    return REFT + '\n' + SHORT_BODY;
  };
  await run('runUnifiedCohesionGen({chained:true})');
  assert.ok((run('outputs.step_08') || '').length > 17600, '★ 보강 후 본문이 목표 80%(17600) 초과로 확장됨');
  assert.ok(toasts.some(t => /분량 미달/.test(t.m)), '★ 분량 미달 보강 토스트');
});

// ─────────────── 15K-5,6 수학식 ───────────────

test('15K-5 ★ — 분할 1차 bodyPrompt에 수학식 포함 명시(병합후 게이트 오탐 방지)', () => {
  assert.match(PATENT_SRC, /수학식.*DEVICE_DESC 본문에 포함되므로 이번 1단계에 반드시 모두 포함하라/, '★ 1차 수학식 포함 명시');
  assert.match(PATENT_SRC, /\[배치15K-5\] 분할 1차에 수학식 포함 명시/, '★ 15K-5 주석');
});

test('15K-6 ★ — C12 (i) 좌·우변 전 기호 여기서절 1:1 대조', () => {
  cohPromptEnv();
  const p = run("buildPrompt('unified_cohesion')") || '';
  assert.match(p, /각 수학식마다 좌변·우변에 등장하는 모든 기호.*하나씩 열거/, '★ 전 기호 열거');
  assert.match(p, /여기서" 절의 정의 목록과 1:1로 대조/, '★ 1:1 대조');
  assert.match(p, /정의 목록에 없는 기호가 좌·우변에 하나라도 있으면.*추가한 뒤 출력/, '★ 누락 시 추가 후 출력');
});
