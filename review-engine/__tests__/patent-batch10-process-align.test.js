/**
 * review-engine/__tests__/patent-batch10-process-align.test.js
 * ★ 배치 10 — 프로세스 정합 6건(화면 실측 기반): A 유형→방법 배선 / B 문단 종결 절단 보강 /
 *   C refnum 대량 미정의 액션 힌트 / D 진입점 단일화 / E 결과 재배치. 화면 검증은 재일 위임.
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
  const elStub = () => ({ value: '4', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '' });
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
const checks = (spec, name) => JSON.parse(run('JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check===' + JSON.stringify(name) + ';}))'));
beforeEach(() => { run('clearAllState(); _methodUserSet=false; _methodMismatchAck=false;'); toasts = []; });

// A) 유형→방법 배선
test('★ A — "서버 및 방법" → 방법 on / "서버" → off / 수동 off 후 재선택 → off 유지', () => {
  run('includeMethodClaims=false; _syncMethodFromType("서버 및 방법")');
  assert.equal(run('includeMethodClaims'), true, '★ 방법 포함 유형 → on');
  run('_syncMethodFromType("서버")');
  assert.equal(run('includeMethodClaims'), false, '★ 장치 전용 유형 → off');
  run('_methodUserSet=true; includeMethodClaims=false; _syncMethodFromType("서버 및 방법")');
  assert.equal(run('includeMethodClaims'), false, '★ 수동 오버라이드 우선');
});
test('★ A — 배선: autoSetDeviceCategoryFromType→_syncMethodFromType, toggleMethod→오버라이드 셋', () => {
  assert.match(PATENT_SRC, /try\{_syncMethodFromType\(type\);\}catch\(_e\)\{\}/, '★ 유형 확정/자동감지 훅');
  assert.match(PATENT_SRC, /function toggleMethod\(\)\{\s*\n?\s*_methodUserSet=true;/, '★ 수동 변경 → 플래그');
  assert.match(PATENT_SRC, /명칭에 "방법"이 포함되는데 방법 청구항이 제외/, '★ ② 요약 모순 경고');
});
test('★ A — ⑤ 게이트: 명칭-방법 모순 시 확인 1회(취소=차단, 승인 후 재진입 무확인)', () => {
  run('selectedTitle="콘텐츠 라우팅 서버 및 방법"; includeMethodClaims=false;');
  run('confirm=function(){return false;}');
  assert.equal(run('_downloadGate("【발명을 실시하기 위한 구체적인 내용】\\n제어부(100)는 처리한다.")'), false, '★ 취소 → 차단');
  run('confirm=function(){return true;}');
  assert.equal(run('_downloadGate("【발명을 실시하기 위한 구체적인 내용】\\n제어부(100)는 처리한다.")'), true, '★ 승인 → 진행');
  run('confirm=function(){throw new Error("should not ask again");}');
  assert.equal(run('_downloadGate("【발명을 실시하기 위한 구체적인 내용】\\n제어부(100)는 처리한다.")'), true, '★ 1회 확인 후 재확인 없음');
});

// B) 문단 종결 절단
test('★ B — 종결어미 없는 문단("…원문 발화 수대") → sentence_truncation HIGH / 정상 종결 미발화', () => {
  const bad = '【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 수신된 대본 데이터를 파싱하여 장면 단위로 분할하고 각 장면의 원문 발화 수대';
  const iss = checks(bad, 'sentence_truncation');
  assert.ok(iss.some(i => /종결 미완/.test(i.message) && /원문 발화 수대/.test(i.detail)), '★ 실증 절단 검출');
  const good = bad + '로 재구성한 결과를 저장부(110)에 저장한다.';
  assert.equal(checks(good, 'sentence_truncation').filter(i => /종결 미완/.test(i.message)).length, 0, '★ 정상 종결 미발화');
});
test('★ B — 제외 규칙: 표제·부호표 행·목록 행·수학식·단문·콜론/괄호 종결 미발화', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 아래 각 항목의 기준값을 적용하여 데이터를 정렬·검증·저장하는 동작을 다음과 같이 수행한다:\n\n- 목록 기호 행은 제외 대상\n\n【수학식 1】\nY = a x + b\n여기서 a는 기울기\n\n통신부 : 110';
  assert.equal(checks(spec, 'sentence_truncation').filter(i => /종결 미완/.test(i.message)).length, 0, '★ 제외 규칙 전부 침묵');
});

// C) refnum 대량 미정의 액션 힌트
test('★ C — 미정의 ≥10 → "④ 본문 통합 생성이 부호표를 재생성합니다" 힌트', () => {
  const body = Array.from({ length: 12 }, (_, i) => `구성부(${100 + i})는 동작한다.`).join(' ');
  const spec = `【발명을 실시하기 위한 구체적인 내용】\n${body}\n\n【부호의 설명】\n(없음)`;
  const iss = checks(spec, 'refnum_consistency');
  assert.ok(iss.some(i => /④ 본문 통합 생성이 부호표를 재생성합니다/.test(i.message)), '★ 액션 힌트 부착');
});

// D/E) 진입점 단일화·결과 재배치(HTML)
test('★ D — 구 통합 카드 제거·마무리 고급 강등·① 문구 정정·progressUnifiedGen ④ 이식', () => {
  assert.ok(!/id="unifiedGenCard"/.test(HTML_SRC), '★ 구 카드 제거');
  assert.match(HTML_SRC, /<details class="wf-adv" id="wfAdv4">[\s\S]{0,1200}btnBatchFinish/, '★ 마무리 고급 접기');
  assert.match(HTML_SRC, /④ 본문 통합<\/b>이 효과·해결수단·요약을 함께 생성합니다/, '★ 흡수 안내');
  assert.match(HTML_SRC, /핵심 명세서 통합 생성<\/b>은 <b>② 설계 결정<\/b> 단계에서/, '★ ① 문구(배치14: 생성은 ②에서 안내)');
  assert.match(HTML_SRC, /id="wfStage4Main"[\s\S]{0,600}id="progressUnifiedGen"/, '★ progress ④ 이식(cohesion 진행 표시 유지)');
});
test('★ E — 청구항·대안·특허성 결과 카드가 ③(page2)로 이동, ②는 안내만', () => {
  const p2 = HTML_SRC.slice(HTML_SRC.indexOf('id="page2"'), HTML_SRC.indexOf('id="page3"'));
  ['resultCard06', 'resultCard10', 'resultCardExtra'].forEach(id => assert.ok(p2.includes('id="' + id + '"'), '★ ③에 ' + id));
  const p1 = HTML_SRC.slice(HTML_SRC.indexOf('id="page1"'), HTML_SRC.indexOf('id="page2"'));
  assert.ok(!p1.includes('id="resultCard06"'), '★ ②에서 제거');
  assert.ok(/③ 골격<\/b> 탭에서 확인/.test(p1), '★ ② 안내 문구');
});
