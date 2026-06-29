/**
 * review-engine/__tests__/patent-desc-order-unify.test.js
 *
 * ★ 상세설명 순서 모순 + UI 분리 해소 — T2(순서)·T1(한 버튼 순차)·T3(짧은 stub 은퇴)·T4(cascade 갭).
 *   진단(DIAG-desc-order-unify): step_08c가 step_08보다 먼저 실행 가능(간선 없음)·버튼 2개 분리·검토가 짧은 stub을 device에 주입.
 *   T2: step_08c가 step_08(장치 상세설명) 선행 요구 — checkDependency + STEP_DEPENDENCIES 간선(step_08→step_08c).
 *   T1: "상세설명 생성"(btnStep08)→runImplementationDesc 한 버튼 = _longStepCore(device)→_conceptDescCore(concept) 순차.
 *       코어는 globalProcessing 미점유(중첩 early-return 방지) — 핸들러가 1회만 점유.
 *   T3: applyReview 예시도 ADD_AFTER 짧은 stub 주입 제거 + Step 13 입력에 step_08c(전체 예시도 설명) 추가.
 *   T4: cascade 디스패치에 runConceptDescStep 케이스(_conceptDescCore) — 종전 _cascadeRunShort 폴백 갭 해소.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');

let sandbox, claudeText;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  // ★ device/concept 구분: 프롬프트로 step_08c(예시도 전용 선언) 여부 판별 → 서로 다른 본문 반환(순차 검증용)
  const App = {
    sb,
    callClaude: async (prompt) => {
      const isConcept = /예시도\(개념도\)" 전용 상세설명/.test(String(prompt));
      const text = isConcept
        ? '도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.'
        : '도 1을 참조하면, 통신부(110)가 동작한다.';
      return { text, stopReason: 'end_turn', it: 0, ot: 0 };
    },
    escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {},
  };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const callA = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setCtx = (s) => vm.runInContext(s, sandbox);
const out = (k) => call('outputs.' + k);
const step13 = () => call("_buildPromptCore('step_13','원본 발명 내용','검색 시스템','')");

// 장치 청구·도면·예시도 보유 컨텍스트(장치 상세설명은 비움 → 순서 검증용)
function baseCtx() {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:[{},{},{},{}]}; outputTimestamps={}; requiredFigures=[]; detailLevel='standard';
    includeMethodClaims=true; inventionScope=null;
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 5는 화면이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]}];
    outputs={step_06:'【청구항 1】 통신부(110); 프로세서(120)', step_07:'[장치도면설계] 통신부(110), 프로세서(120)', step_07c:'[도 5] UI 화면 예시도\\n참조번호: 검색창(31), 결과목록(32)\\n도 5는 화면이다.'};
  `);
}
beforeEach(() => { baseCtx(); claudeText = ''; });

// ─────────── T2: 순서 강제 (장치 → 예시도) ───────────

test('T2 ★ checkDependency(step_08c) — 장치 상세설명(step_08) 없으면 차단, 있으면 통과', () => {
  assert.match(call("checkDependency('step_08c')||''"), /장치 상세설명/, '★ step_08 없으면 차단 메시지');
  setCtx(`outputs.step_08='도 1을 참조하면, 통신부(110)가 동작한다.';`);
  assert.equal(call("checkDependency('step_08c')"), null, '★ step_08 있으면 통과');
});

test('T2 ★ STEP_DEPENDENCIES — step_08 → step_08c 간선(전제 순서)', () => {
  assert.ok(call("STEP_DEPENDENCIES.step_08.MUST.includes('step_08c')"), '★ step_08.MUST 에 step_08c');
});

test('T2 ★ topologicalSort — step_08 이 step_08c 보다 먼저', () => {
  const sorted = call("JSON.stringify(topologicalSort(['step_08c','step_08'],'step_07c'))");
  const arr = JSON.parse(sorted);
  assert.ok(arr.indexOf('step_08') < arr.indexOf('step_08c'), '★ 장치(step_08) → 예시도(step_08c) 순');
});

test('T2 ★ runConceptDescStep — 장치 상세설명(step_08) 없으면 생성 거부(미생성)', async () => {
  await callA('runConceptDescStep()');   // outputs.step_08 비어있음
  assert.ok(!out('step_08c'), '★ step_08 없으면 step_08c 미생성(순서 강제)');
});

// ─────────── T1: 한 버튼 순차 (device → concept) ───────────

test('T1 ★ runImplementationDesc — 장치(step_08)+예시도(step_08c) 둘 다 생성(순차)', async () => {
  await callA('runImplementationDesc()');
  assert.match(out('step_08'), /통신부\(110\)가 동작한다/, '★ ① 장치 상세설명 생성');
  assert.match(out('step_08c'), /검색창\(31\)은 프로세서\(120\)/, '★ ② 예시도 상세설명 생성(장치 직후)');
});

test('T1 ★ globalProcessing 중첩 안 막힘 — 코어 미점유(둘 다 생성됨이 증거) + 완료 후 해제', async () => {
  await callA('runImplementationDesc()');
  assert.ok(out('step_08') && out('step_08c'), '★ device·concept 둘 다(가드 충돌 시 concept 비었을 것)');
  assert.equal(call('globalProcessing'), false, '★ 완료 후 globalProcessing 해제');
});

test('T1 ★ 예시도(step_07c svgContent) 없으면 — device(step_08)만', async () => {
  setCtx(`conceptDiagramTypes=[];`);
  await callA('runImplementationDesc()');
  assert.match(out('step_08'), /통신부\(110\)/, '★ 장치 상세설명 생성');
  assert.ok(!out('step_08c'), '★ 예시도 없으면 step_08c 미생성(조건부)');
});

test('T1 소스 ★ btnStep08→runImplementationDesc + 코어 가드프리 + globalProcessing 1회 점유', () => {
  assert.match(HTML_SRC, /id="btnStep08" onclick="runImplementationDesc\(\)"/, '★ 통합 버튼 배선');
  // 통합 핸들러: globalProcessing 1회 점유 + 코어 순차
  assert.match(PATENT_SRC, /async function runImplementationDesc\(\)\{[\s\S]*?setGlobalProcessing\(true\);[\s\S]*?await _longStepCore\('step_08'\);[\s\S]*?await _conceptDescCore\(\)[\s\S]*?finally\{setGlobalProcessing\(false\);\}/, '★ device→concept 순차 + globalProcessing 1회');
  // 코어는 가드/globalProcessing 미점유
  assert.match(PATENT_SRC, /async function _longStepCore\(sid\)\{/, '★ _longStepCore 분리');
  assert.match(PATENT_SRC, /async function _conceptDescCore\(\)\{/, '★ _conceptDescCore 분리');
  assert.ok(!/async function _conceptDescCore\(\)\{[\s\S]*?if\(globalProcessing\)return;[\s\S]*?\}/.test(PATENT_SRC.slice(PATENT_SRC.indexOf('async function _conceptDescCore()'), PATENT_SRC.indexOf('async function _conceptDescCore()') + 600)), '★ 코어에 globalProcessing 가드 없음(중첩 안 막힘)');
});

test('T1 소스 ★ btnStep08c 보조 유지(runConceptDescStep) — 강등(제거 아님)', () => {
  assert.match(HTML_SRC, /id="btnStep08c" onclick="runConceptDescStep\(\)"/, '★ 보조 버튼 유지');
  assert.match(HTML_SRC, /예시도 설명만 따로 재생성하는 보조 버튼/, '★ 보조 안내 문구');
});

// ─────────── T3: 검토 짧은 stub 은퇴 ───────────

test('T3 ★ Step 13 입력 — step_08c(전체 예시도 설명) 포함', () => {
  setCtx(`outputs.step_08='도 1을 참조하면, 통신부(110)가 동작한다.'; outputs.step_08c='도 5를 참조하면, 검색창(31)은 프로세서(120)에 의해 표시된다.';`);
  const p = step13();
  assert.match(p, /\[예시도 상세설명 — 도 N별 본문/, '★ 예시도 상세설명 입력 블록');
  assert.match(p, /검색창\(31\)은 프로세서\(120\)/, '★ step_08c 전체가 검토 입력에 보임(누락 오판 차단)');
});

test('T3 ★ Step 13 입력 — step_08c 없으면 블록 생략(무해)', () => {
  setCtx(`outputs.step_08='장치설명'; delete outputs.step_08c;`);
  const p = step13();
  assert.ok(p.indexOf('[예시도 상세설명 — 도 N별 본문') < 0, '★ step_08c 없으면 입력 블록 없음');
});

test('T3 소스 ★ applyReview — 예시도 ADD_AFTER 짧은 stub 주입 제거 + 장치 끼워넣기 금지', () => {
  assert.ok(!/검토가 예시도\(도 N\) 설명\/부호 누락을 지적하면[\s\S]*?ADD_AFTER 로 추가하라/.test(PATENT_SRC), '★ 예시도 ADD_AFTER 주입 제거');
  assert.ok(!/\[예시도 설계 — 참조번호 31~99, 장치\(100~\)와 별개\] '\+outputs\.step_07c\.slice\(0,1200\)/.test(PATENT_SRC), '★ step_07c brief 주입 제거');
  assert.match(PATENT_SRC, /이것은 ★장치★ 상세설명 편집이다[\s\S]*?장치 상세설명에 추가하지 마라/, '★ 장치 본문 예시도 끼워넣기 금지');
});

test('T3 소스 ★ Step 13 [12] — [예시도 상세설명] 라우팅 + 장치 끼워넣기 제안 금지', () => {
  assert.match(PATENT_SRC, /★\[예시도 상세설명\]★에 "도 N을 참조하면/, '★ 예시도 상세설명으로 라우팅');
  assert.match(PATENT_SRC, /예시도 단락을 \[상세설명\]\(장치\)에 추가하라고 제안하지 마라/, '★ 장치 끼워넣기 제안 금지');
});

// ─────────── T4: cascade 디스패치 갭 ───────────

test('T4 소스 ★ cascade 디스패치 — runConceptDescStep 케이스 → _conceptDescCore', () => {
  assert.match(PATENT_SRC, /else if\(runner==='runConceptDescStep'\)\{if\(conceptDiagramTypes\.some\(ct=>ct\.svgContent\)&&outputs\.step_08\)await _conceptDescCore\(\);\}/, '★ cascade step_08c 전용 경로(장치 전제)');
});

// ─────────── 회귀 ───────────

test('회귀 ★ step_08c 분리·조립 유지 + 장치(step_08) 회귀 0', () => {
  // 분리 유지
  assert.match(PATENT_SRC, /case 'step_08c':\{/, 'step_08c 프롬프트 유지');
  assert.match(PATENT_SRC, /async function runConceptDescStep\(\)\{/, 'step_08c 보조 러너 유지');
  assert.match(PATENT_SRC, /buildImplementationBody\(\)/, '조립(장치→예시→방법) 유지');
  // 장치 상세설명 회귀 0: _longStepCore 가 step_08/step_12 공용(방법 상세설명 유지)
  assert.match(PATENT_SRC, /const bid=sid==='step_08'\?'btnStep08':'btnStep12'/, '★ 장치/방법 공용 코어(step_12 유지)');
  assert.match(HTML_SRC, /id="btnStep12" onclick="runLongStep\('step_12'\)"/, '★ 방법 상세설명 버튼(runLongStep) 유지');
});

test('회귀→merge ★ runImplementationDesc — 장치 본문 보존 + 예시도 합본(step_08=장치+예시)', async () => {
  await callA('runImplementationDesc()');
  assert.match(out('step_08'), /통신부\(110\)가 동작한다/, '★ 장치 상세설명 본문 보존(회귀 0)');
  assert.match(out('step_08'), /검색창\(31\)/, '★ merge-into-step08: 예시도가 step_08 본문에 합본(후속 자동 공유)');
  assert.match(call('outputs.step08_device'), /통신부\(110\)/, '★ device-only 스냅샷 보존');
  assert.ok(call('outputs.step08_device').indexOf('검색창(31)') < 0, '★ 스냅샷은 device-only(예시도 미포함 — 멱등 재구성 원천)');
});
