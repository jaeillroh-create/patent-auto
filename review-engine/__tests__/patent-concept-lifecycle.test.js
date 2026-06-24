/**
 * review-engine/__tests__/patent-concept-lifecycle.test.js
 *
 * ★ 예시도 lifecycle 배선 — A1(openProject reflect) + B1(Step13 입력 step_07c) + B2(Step13 예시도 검토 항목).
 *   원인: #210 reflect 가 "생성 시점"만 호출 → 기존 사건(예시도 기존재) 열면 누락 그대로. Step13 입력에 step_07c 부재 → 검토 사각.
 *   A1: openProject 복원 직후 reflectConceptsToSpec() 1회(멱등·본문 보존) → 열기만 해도 기존 예시도 반영.
 *   B1: Step13 입력에 [예시도/개념도 설계](step_07c) 추가 → 예시도가 검토에 보임.
 *   B2: Step13 [10] 예시도 부호(31~99) 구분 + [12] 예시도 설명/부호 정합 항목.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
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
const setCtx = (s) => vm.runInContext(s, sandbox);
const reflect = () => JSON.parse(call('JSON.stringify(reflectConceptsToSpec())'));
const out = (k) => call('outputs.' + k);
const step13 = () => call("_buildPromptCore('step_13','원본 발명 내용','검색 시스템','')");

// "기존 사건" 시뮬레이션: 장치 3개·예시도 2개(생성됨, 도4·5), step_08/18 은 예시도 빠진 스냅샷
function openedLegacyProject() {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:[{},{},{}]}; outputTimestamps={step_08:100};
    conceptDiagramTypes=[
      {type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 4는 검색 화면을 나타내는 예시도이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]},
      {type:'data_structure',svgContent:'<svg></svg>',briefDesc:'도 5는 데이터 구조를 나타내는 예시도이다.',refMap:[{signNumber:'41',label:'레코드'}]}
    ];
    outputs={
      step_08:'도 1을 참조하면, 통신부(110)가 데이터를 수신한다. 도 2를 참조하면, 프로세서(120)가 처리한다.',
      step_18:'통신부 : 110\\n프로세서 : 120',
      step_07c:'[도 4] UI 화면 예시도\\n참조번호: 검색창(31), 결과목록(32)\\n도 4는 검색 화면을 나타내는 예시도이다.'
    };
  `);
}
beforeEach(() => { openedLegacyProject(); });

// ─────────── A1: openProject reflect (기존 사건 자동 해소) ───────────

test('A1 ★ 기존 사건 열기(=reflect 호출) → 발명의 설명·부호의 설명에 예시도 자동 반영', () => {
  // openProject 가 복원 직후 호출하는 그 reflect (생성 없이도 반영)
  const r = reflect();
  assert.equal(r.desc, 2, '예시도 2건 발명의 설명 반영');
  assert.equal(r.ref, 3, '예시도 부호 3건(31·32·41) 반영');
  assert.match(out('step_08'), /도 4를 참조하면, 검색창\(31\), 결과목록\(32\) 등이 도시되어 있다\./, '★ 도4 예시도 단락');
  assert.match(out('step_08'), /도 5를 참조하면, 레코드\(41\) 등이 도시되어 있다\./, '★ 도5 예시도 단락');
  assert.match(out('step_18'), /검색창 : 31/, '★ 부호 31');
  assert.match(out('step_18'), /레코드 : 41/, '★ 부호 41');
});

test('A1 ★ 멱등 — 같은 사건 반복 열기(reflect 반복)해도 중복 0', () => {
  reflect();
  const s8a = out('step_08'), s18a = out('step_18');
  const r2 = reflect();   // 재오픈
  assert.equal(r2.desc, 0, '★ 재오픈 desc 0');
  assert.equal(r2.ref, 0, '★ 재오픈 ref 0');
  assert.equal(out('step_08'), s8a, '★ step_08 불변(중복 단락 없음)');
  assert.equal(out('step_18'), s18a, '★ step_18 불변');
});

test('A1 ★ 본문 보존 — 기존 장치 설명/부호 byte 보존(APPEND)', () => {
  reflect();
  assert.ok(out('step_08').indexOf('도 1을 참조하면, 통신부(110)가 데이터를 수신한다. 도 2를 참조하면, 프로세서(120)가 처리한다.') === 0, '★ 장치 설명 원문 보존(맨 앞)');
  assert.ok(out('step_18').indexOf('통신부 : 110\n프로세서 : 120') === 0, '★ 장치 부호 원문 보존(맨 앞)');
});

test('A1 ★ 예시도 없는 사건 → no-op(가드)', () => {
  setCtx(`conceptDiagramTypes=[]; outputs={step_08:'장치설명', step_18:'통신부 : 110'};`);
  const r = reflect();
  assert.deepEqual(r, { desc: 0, ref: 0 }, '★ no-op');
  assert.equal(out('step_08'), '장치설명', '본문 불변');
});

test('A1 소스 ★ openProject 복원 직후 reflect + 가드 재렌더 + 1회 영속', () => {
  assert.match(PATENT_SRC, /if\(conceptDiagramTypes\.length>0\)renderConceptDiagramCards\(\);\s*\n[\s\S]{0,400}?const _openRefl=reflectConceptsToSpec\(\);/, '★ openProject 예시도 복원 직후 reflect');
  assert.match(PATENT_SRC, /if\(_openRefl\.desc\|\|_openRefl\.ref\)\{[\s\S]*?_cascadeRender\('step_08'[\s\S]*?_cascadeRender\('step_18'[\s\S]*?saveProject\(true\)/, '★ 반영 시 재렌더 + 1회 영속');
});

// ─────────── B1: Step 13 입력에 step_07c ───────────

test('B1 ★ Step 13 입력 — outputs.step_07c 있으면 [예시도/개념도 설계] 블록 포함', () => {
  const p = step13();
  assert.match(p, /\[예시도\/개념도 설계 — 참조번호 31~99/, '★ 예시도 입력 블록');
  assert.match(p, /검색창\(31\)/, '★ 예시도 부호가 검토 입력에 보임');
});

test('B1 ★ Step 13 입력 — step_07c 없으면 입력 블록 생략(무해)', () => {
  setCtx(`outputs={step_06:'청구항', step_08:'설명'};`);
  const p = step13();
  // 입력 헤더 "[예시도/개념도 설계 — " 는 입력 전용(검토 항목은 "[예시도/개념도 설계]" 로 닫음) → 입력 블록만 부재 확인
  assert.ok(p.indexOf('[예시도/개념도 설계 — ') < 0, '★ 예시도 없으면 입력 블록 없음');
  assert.match(p, /\[도면 설계\]/, '장치 도면 입력은 유지');
});

test('B1 소스 ★ step_13 입력에 step_07c 조건부 주입', () => {
  assert.match(PATENT_SRC, /outputs\.step_07c\?'\\n\[예시도\/개념도 설계[\s\S]*?'\+outputs\.step_07c\.slice\(0,1500\):''/, '★ step_07c 조건부 입력');
});

// ─────────── B2: Step 13 예시도 검토 항목 ───────────

test('B2 ★ Step 13 — [12] 예시도 정합 검토 항목 + [10] 31~99 구분 bullet', () => {
  const p = step13();
  assert.match(p, /\[12\] ★ 예시도\/개념도 정합 검토/, '★ [12] 예시도 정합 항목');
  assert.match(p, /"도 N을 참조하면, …" 형태로 기술되어 있는지/, '★ 예시도 상세설명 기술 여부 검토');
  assert.match(p, /참조번호 31~99는 \[예시도\/개념도 설계\]에 정의된 별개 부호/, '★ [10] 예시도 부호 미정의 오인 방지');
});

test('B2 소스 ★ [12] 항목 + [5] 범위 8~12 갱신', () => {
  assert.match(PATENT_SRC, /\[12\] ★ 예시도\/개념도 정합 검토 \(v15/, '★ [12] 정의');
  assert.match(PATENT_SRC, /위 1~4 및 8~12에서 발견된 문제/, '★ [5] 범위 8~12로 확장(항목 12 포함)');
  assert.ok(!/위 1~4 및 8~11에서/.test(PATENT_SRC), '옛 8~11 잔존 0');
});

// ─────────── 회귀 ───────────

test('회귀 ★ #210 reflect 안전장치·③·① 유지', () => {
  assert.match(PATENT_SRC, /function reflectConceptsToSpec\(\)\{/, '#210 reflect 유지');
  assert.match(PATENT_SRC, /function _conceptAlreadyInDesc\(text, ct, figNum\)\{/, 'figNum 멱등 가드 유지');
  assert.match(PATENT_SRC, /function _generatedConceptsWithNums\(\)/, 'C 번호 매핑 유지');
  assert.match(PATENT_SRC, /function invalidateFigureDependents\(\)\{/, '③ 무효화 유지');
  assert.match(PATENT_SRC, /\$\{_conceptSvgApplyTitle\(ct\.svgContent, figNum\)\}/, '① 제목 동기화 유지');
  // 생성 시점 reflect 도 유지(2곳) + openProject(1곳) = 호출부 ≥3 + 정의 1
  assert.ok((PATENT_SRC.match(/reflectConceptsToSpec\(\)/g) || []).length >= 4, '★ reflect 호출부 ≥4(정의+생성2+openProject1)');
});
