/**
 * review-engine/__tests__/patent-step7c-purpose.test.js
 *
 * ★ Step 7c 목적 결속(P1) + 요소 의미 캡처(P2) + 번호 범위 통일(P3).
 *   P1: 프롬프트에 목적·청구항 결속 명시(무관한 그림 방지) — main·cascade 일관.
 *   P2: REF_MAP(번호↔이름) 캡처 → 부호의 설명(step_18)·상세설명(step_08) 정밀 참조.
 *   P3: 참조번호 추출 31~99 통일(이전 ≤79 → 프로세스 장면 81~99 누락 버그 수정).
 */
import { test, before } from 'node:test';
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
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' } };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const call = (expr) => vm.runInContext(expr, sandbox, { filename: 'call.js' });
const parseRefMap = (seg, svg) => JSON.parse(call('JSON.stringify(_parseConceptRefMap(' + JSON.stringify(seg) + ',' + JSON.stringify(svg) + '))'));
const parseResult = (full, cts, figNums) => JSON.parse(call('(function(){var c=' + JSON.stringify(cts) + ';_parseConceptResult(' + JSON.stringify(full) + ',c,' + JSON.stringify(figNums) + ');return JSON.stringify(c);})()'));
const buildText = (cts, figNums) => call('_buildConceptOutputText(' + JSON.stringify(cts) + ',' + JSON.stringify(figNums) + ')');

// ── P3: 번호 범위 31~99 통일(프로세스 장면 81~99 누락 수정) ──

test('★ P3 — 참조번호 31~99 추출(프로세스 장면 85·99 더 이상 누락 안 됨)', () => {
  const svg = '<svg><text>(31)</text><text>(85)</text><text>(99)</text><text>(120)</text><text>(20)</text></svg>';
  const rm = parseRefMap('', svg);
  const nums = rm.map((r) => r.signNumber);
  assert.ok(nums.includes('31') && nums.includes('85') && nums.includes('99'), '★ 31·85·99 모두 추출(이전 ≤79라 85·99 누락됐음)');
  assert.ok(!nums.includes('120') && !nums.includes('20'), '범위 밖(120 장치·20 미만) 제외');
});

// ── P2: REF_MAP(번호↔이름) 캡처 ──

test('★ P2 — REF_MAP "번호: 이름" 파싱(요소 의미 캡처)', () => {
  const seg = 'x\n---REF_MAP---\n31: 검색창\n85: 처리 단계\n99: 결과 화면';
  const rm = parseRefMap(seg, '');
  assert.deepEqual(rm, [{ signNumber: '31', label: '검색창' }, { signNumber: '85', label: '처리 단계' }, { signNumber: '99', label: '결과 화면' }], '★ 번호↔이름 매핑');
});

test('★ P2 — REF_MAP 누락분은 SVG 번호로 보강(라벨 빈값)', () => {
  const seg = '---REF_MAP---\n31: 검색창';
  const rm = parseRefMap(seg, '<svg><text>(31)</text><text>(40)</text></svg>');
  assert.equal(rm.find((r) => r.signNumber === '31').label, '검색창', 'REF_MAP 이름');
  assert.equal(rm.find((r) => r.signNumber === '40').label, '', '★ SVG에만 있는 40은 라벨 빈값으로 보강');
});

test('★ _parseConceptResult — SVG/brief/refMap/refNums/figNum 세팅(공유 파서)', () => {
  const full = '---CONCEPT_FIG_5---\n<svg viewBox="0 0 680 500"><text>검색창(31)</text></svg>\n---BRIEF_DESC---\n도 5은 검색 화면을 나타내는 예시도이다.\n---REF_MAP---\n31: 검색창\n99: 결과';
  const c = parseResult(full, [{ type: 'ui_screen' }], [5]);
  assert.match(c[0].svgContent, /<svg/, 'svgContent');
  assert.match(c[0].briefDesc, /검색 화면/, 'briefDesc');
  assert.deepEqual(c[0].refMap, [{ signNumber: '31', label: '검색창' }, { signNumber: '99', label: '결과' }], '★ refMap');
  assert.deepEqual(c[0].refNums, [31, 99], '하위호환 refNums(숫자배열)');
  assert.equal(c[0].figNum, 5, 'figNum');
});

test('★ _buildConceptOutputText — "이름(번호)" 포함(부호의 설명·상세설명이 파싱 가능)', () => {
  const cts = [{ type: 'ui_screen', briefDesc: '도 5은 화면이다.', refMap: [{ signNumber: '31', label: '검색창' }, { signNumber: '32', label: '결과 목록' }] }];
  const txt = buildText(cts, [5]);
  assert.match(txt, /검색창\(31\)/, '★ 이름(번호) 형식');
  assert.match(txt, /결과 목록\(32\)/, '두번째 요소');
  assert.match(txt, /\[도 5\] UI 화면 예시도/, '유형 라벨');
});

// ── P1: 목적·청구항 결속 ──

test('★ P1 — CONCEPT_PURPOSE_RULES 목적·청구항 결속·유형별 목적 명시', () => {
  const r = call('CONCEPT_PURPOSE_RULES');
  assert.match(r, /청구항에 기재된 구성을 시각적으로 뒷받침/, '★ 목적: 청구항 구성 뒷받침');
  assert.match(r, /시각화할 "청구항 구성"을 1개 이상 특정/, '★ 청구항 결속(특정해 담아라)');
  assert.match(r, /무관한 일반적 화면\/장면을 그리지 마라/, '★ 무관한 그림 방지');
  assert.match(r, /UI 화면:.*화면 구성·조작/, '유형별 목적(UI)');
  assert.match(r, /데이터 구조:.*자료구조/, '유형별 목적(데이터)');
});

// ── 소스 정합: main·cascade 일관 + step_08/step_18 연결 ──

test('★ 소스 — main·cascade 프롬프트 둘 다 목적규칙·REF_MAP·31~99 일관', () => {
  // 두 프롬프트 모두 CONCEPT_PURPOSE_RULES 주입
  assert.equal((PATENT_SRC.match(/\$\{CONCEPT_PURPOSE_RULES\}/g) || []).length >= 2, true, '★ 목적규칙 main·cascade 양쪽 주입');
  // 두 프롬프트 모두 REF_MAP 출력 형식 요구
  assert.equal((PATENT_SRC.match(/---REF_MAP---/g) || []).length >= 2, true, 'REF_MAP 출력형식(양쪽 + 파서)');
  // ★ 옛 ≤79 범위 잔존 0(P3) — 예시도 추출이 31~99 로 통일
  assert.ok(!/n>=31&&n<=79/.test(PATENT_SRC), '★ 옛 31~79 추출필터 제거(P3)');
  assert.ok(!/예시도 전용: 31~79/.test(PATENT_SRC), '프롬프트 31~79 잔존 0');
});

test('★ 소스 — 추출 단일화(_parseConceptResult) + step_08 refMap 사용 + step_18 step_07c 포함', () => {
  // 공유 파서로 추출 단일화(분산 제거)
  assert.equal((PATENT_SRC.match(/_parseConceptResult\(fullText, conceptDiagramTypes, figNums\)/g) || []).length, 2, '★ main·cascade 모두 공유 파서');
  // step_08 주입이 refMap(이름) 사용
  assert.match(PATENT_SRC, /\(ct\.refMap\|\|\[\]\)\.map\(r=>r\.label\?`\$\{r\.signNumber\}\(\$\{r\.label\}\)`/, '★ step_08 주입 refMap 이름 사용');
  // step_18 _refSources 에 step_07c 추가
  assert.match(PATENT_SRC, /_refSources=\[outputs\.step_06,[^\]]*outputs\.step_07c\]/, '★ step_18 부호수집에 step_07c 포함');
});
