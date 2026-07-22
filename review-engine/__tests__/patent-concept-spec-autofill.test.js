/**
 * review-engine/__tests__/patent-concept-spec-autofill.test.js
 *
 * ★ 예시도 설명 자동 반영(A) + 라벨 폴백(B) + 번호 매핑 정합(C).
 *   원인: 발명의 설명(step_08)·부호의 설명(step_18)이 생성 스냅샷 → 나중 추가 예시도 누락(③ 무관, 선존재 버그).
 *   A: 예시도 생성 = 반영 의사 → step_08·step_18 에 예시도 설명/부호 ★APPEND★(기존 본문 byte 보존·멱등). 덮어쓰기 X.
 *   B: refMap 라벨 공백 시 유형 기반 기본 이름 → "(31)" 대신 "이름(31)"(부호의 설명 정규식 매칭 보장).
 *   C: getAutoFigNums('step_07c')(compact)를 filter 순서 인덱스로 매핑(full 인덱스 접근 버그 제거 — 미생성 혼재 시 '?'/오정렬).
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

// 기본 상태: 장치 3개(도1~3), 예시도 2개(생성됨 → 도4·5), step_08/18 device-only 스냅샷
function baseState() {
  setCtx(`
    selectedTitle='검색 시스템'; diagramData={step_07:[{},{},{}]}; outputTimestamps={};
    conceptDiagramTypes=[
      {type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 4는 검색 화면을 나타내는 예시도이다.',refMap:[{signNumber:'31',label:'검색창'},{signNumber:'32',label:'결과목록'}]},
      {type:'data_structure',svgContent:'<svg></svg>',briefDesc:'도 5는 데이터 구조를 나타내는 예시도이다.',refMap:[{signNumber:'41',label:'레코드'}]}
    ];
    outputs={
      step_08:'도 1을 참조하면, 통신부(110)가 데이터를 수신한다. 도 2를 참조하면, 프로세서(120)가 처리한다.',
      step_18:'통신부 : 110\\n프로세서 : 120'
    };
  `);
}
beforeEach(() => { baseState(); });

// ─────────── A: 자동 반영 ───────────

test('A(B2 은퇴) ★ reflect 는 발명의 설명(step_08)에 APPEND 안 함 — 예시도 설명은 step_08c 담당', () => {
  const r = reflect();
  assert.equal(r.desc, 0, '★ desc 0(step_08 APPEND 은퇴)');
  const s8 = out('step_08');
  assert.ok(s8.indexOf('도 4를 참조하면') < 0 && s8.indexOf('도 5를 참조하면') < 0, '★ step_08 에 예시도 단락 없음(device-only 유지)');
  assert.equal(s8, '도 1을 참조하면, 통신부(110)가 데이터를 수신한다. 도 2를 참조하면, 프로세서(120)가 처리한다.', '★ step_08 불변');
});

test('A ★ 예시도 부호 → 부호의 설명(step_18)에 "이름 : 번호" 자동 APPEND', () => {
  const r = reflect();
  assert.equal(r.ref, 3, '예시도 부호 3건(31·32·41) 반영');
  const s18 = out('step_18');
  assert.match(s18, /검색창 : 31/, '★ 31');
  assert.match(s18, /결과목록 : 32/, '★ 32');
  assert.match(s18, /레코드 : 41/, '★ 41');
});

test('A ★ 손댄 본문 보호 — 기존 장치 설명/부호 byte 보존(APPEND, 덮어쓰기 X)', () => {
  reflect();
  assert.ok(out('step_08').indexOf('도 1을 참조하면, 통신부(110)가 데이터를 수신한다. 도 2를 참조하면, 프로세서(120)가 처리한다.') === 0, '★ 기존 장치 설명 원문 보존(맨 앞)');
  assert.ok(out('step_18').indexOf('통신부 : 110\n프로세서 : 120') === 0, '★ 기존 부호 원문 보존(맨 앞)');
});

test('A ★ 멱등 — 두 번 반영해도 중복 없음(desc/ref 0, 본문 불변)', () => {
  reflect();
  const s8a = out('step_08'), s18a = out('step_18');
  const r2 = reflect();
  assert.equal(r2.desc, 0, '★ 2회차 desc 0');
  assert.equal(r2.ref, 0, '★ 2회차 ref 0');
  assert.equal(out('step_08'), s8a, '★ step_08 불변(중복 단락 없음)');
  assert.equal(out('step_18'), s18a, '★ step_18 불변(중복 부호 없음)');
});

test('A(B2 은퇴) ★ reflect 반복 — step_18 부호 중복 누적 없음(멱등) + step_08 영원히 미변경', () => {
  reflect();
  const s18a = out('step_18'), s8a = out('step_08');
  const r2 = reflect();
  assert.equal(r2.ref, 0, '★ 2회차 step_18 부호 0(멱등)');
  assert.equal(out('step_18'), s18a, '★ step_18 불변(중복 부호 없음)');
  assert.equal(out('step_08'), s8a, '★ step_08 불변(reflect 미접촉)');
});

test('A ★ step_08 부재 → no-op(추후 생성 시 4359 경로로 포함). step_18 만 있으면 부호만 반영', () => {
  setCtx(`outputs={ step_18:'통신부 : 110' };`);
  const r = reflect();
  assert.equal(r.desc, 0, '★ 발명의 설명 없음 → desc 0(무손상)');
  assert.equal(r.ref, 3, '부호의 설명엔 반영');
  assert.ok(!out('step_08'), '★ step_08 미생성 유지(생성 안 함)');
});

test('A ★ 예시도 0개(생성 전) → 완전 no-op', () => {
  setCtx(`conceptDiagramTypes=[]; outputs={step_08:'장치설명',step_18:'통신부 : 110'};`);
  const r = reflect();
  assert.deepEqual(r, { desc: 0, ref: 0 }, '★ no-op');
  assert.equal(out('step_08'), '장치설명', '본문 불변');
});

test('A(B2 은퇴) ★ reflect 는 상세설명 계층(step_08·step_09·step_13_applied) 미변경', () => {
  setCtx(`
    outputs={ step_08:'장치 상세설명 본문', step_13_applied:'검토반영 상세설명 본문', step_18:'통신부 : 110' };
    outputTimestamps={ step_08:100, step_13_applied:200 };
  `);
  const r = reflect();
  assert.equal(r.desc, 0, '★ desc 0(상세설명 계층 미접촉)');
  assert.equal(out('step_08'), '장치 상세설명 본문', '★ step_08 불변');
  assert.equal(out('step_13_applied'), '검토반영 상세설명 본문', '★ step_13_applied 불변');
});

// ─────────── B: 라벨 폴백 ───────────

test('B ★ [배치15F-4] refMap 라벨 공백 → 부호의 설명(step_18)에 generic으로 넣지 않음(총칭 오염 방지), 실명만 등재', () => {
  setCtx(`
    diagramData={step_07:[{}]}; outputTimestamps={};
    conceptDiagramTypes=[{type:'ui_screen',svgContent:'<svg></svg>',briefDesc:'도 2는 화면이다.',refMap:[{signNumber:'31',label:''},{signNumber:'32',label:'결과'}]}];
    outputs={ step_18:'통신부 : 110' };
  `);
  reflect();
  const s18 = out('step_18');
  assert.ok(!/UI 화면 요소 : 31/.test(s18) && !/ : 31/.test(s18), '★ 라벨 공백 부호(31)는 generic으로 부호표에 등재 안 함(§6-6 빈 라벨 처리)');
  assert.match(s18, /결과 : 32/, '★ 실명(REF_MAP label) 있는 부호만 등재');
});

test('B ★ _buildConceptOutputText — 라벨 공백도 "이름(번호)" 보장(부호 정규식 매칭)', () => {
  const txt = call(`_buildConceptOutputText([{type:'data_structure',briefDesc:'도 3은 구조이다.',refMap:[{signNumber:'61',label:''}]}],[3])`);
  assert.match(txt, /데이터 구조 요소\(61\)/, '★ 라벨 공백 → "데이터 구조 요소(61)"(과거 "(61)" 누락 차단)');
  assert.ok(txt.indexOf(': (61)') < 0, '★ 이름 없는 "(61)" 출력 안 됨');
});

test('B ★ 라벨 있으면 종전대로 "이름(번호)" (회귀 0)', () => {
  const txt = call(`_buildConceptOutputText([{type:'ui_screen',briefDesc:'도 5은 화면이다.',refMap:[{signNumber:'31',label:'검색창'}]}],[5])`);
  assert.match(txt, /검색창\(31\)/, '★ 라벨 보존(회귀 0)');
});

// ─────────── C: 번호 매핑 정합 ───────────

test('C ★ 미생성 예시도 혼재 — 생성분만 getAutoFigNums 순서로 정합(\'?\'·오정렬 제거)', () => {
  setCtx(`
    diagramData={step_07:[{},{},{}]}; outputTimestamps={};
    conceptDiagramTypes=[
      {type:'ui_screen'},  /* 미생성(svgContent 없음) */
      {type:'data_structure',svgContent:'<svg></svg>',briefDesc:'도 4는 구조이다.',refMap:[{signNumber:'41',label:'레코드'}]},
      {type:'user_scenario',svgContent:'<svg></svg>',briefDesc:'도 5는 시나리오이다.',refMap:[{signNumber:'51',label:'사용자'}]}
    ];
  `);
  const gen = JSON.parse(call('JSON.stringify(_generatedConceptsWithNums())'));
  assert.equal(gen.length, 2, '생성된 2개만');
  assert.equal(gen[0].ct.type, 'data_structure', '첫 생성=data_structure');
  assert.equal(gen[0].figNum, 4, '★ data_structure=도4(과거 버그: indexOf=1→도5)');
  assert.equal(gen[1].ct.type, 'user_scenario', '둘째 생성=user_scenario');
  assert.equal(gen[1].figNum, 5, "★ user_scenario=도5(과거 버그: indexOf=2→'?')");
});

test('C(B2) ★ 미생성 혼재 — reflect step_18 부호가 정합 번호의 생성 예시도만 반영', () => {
  setCtx(`
    diagramData={step_07:[{},{}]}; outputTimestamps={};
    conceptDiagramTypes=[
      {type:'ui_screen'},
      {type:'data_structure',svgContent:'<svg></svg>',briefDesc:'도 3은 구조이다.',refMap:[{signNumber:'61',label:'레코드'}]}
    ];
    outputs={ step_18:'통신부 : 110' };
  `);
  reflect();
  assert.match(out('step_18'), /레코드 : 61/, '★ 생성된 예시도 부호만 정합 반영(부호의 설명)');
});

// ─────────── 소스 정합 ───────────

test('소스 ★ A — runConceptDiagramStep·cascade 둘 다 reflectConceptsToSpec 호출', () => {
  assert.ok((PATENT_SRC.match(/reflectConceptsToSpec\(\)/g) || []).length >= 3, '★ 정의 호출부 ≥3(정의1+main1+cascade1)');
  assert.match(PATENT_SRC, /const _refl=reflectConceptsToSpec\(\);/, '★ main(runConceptDiagramStep) 자동 반영');
  // 종전 runConceptDiagramStep 의 수동 stale 옵트인(invalidateDownstream 직후 onStepCompleted) → 자동 반영으로 대체
  assert.ok(!/invalidateDownstream\('step_07c'\);\s*\n\s*onStepCompleted\('step_07c'\)/.test(PATENT_SRC), "★ runConceptDiagramStep 수동 stale 옵트인 제거(자동 반영 대체)");
  // invalidateDownstream('step_07c') 는 ③ 도번호 재배치 경로(invalidateFigureDependents)에만 잔존 가능(별개 트리거) — 생성 경로엔 없음
  assert.ok((PATENT_SRC.match(/invalidateDownstream\('step_07c'\)/g) || []).length <= 1, '★ step_07c 무효화는 ③ 도번호 재배치(invalidateFigureDependents)에만');
});

test('소스 ★ B2 은퇴 — reflect step_08 APPEND 제거, step_18 부호만(desc 항상 0)', () => {
  // step_08 description APPEND(_buildConceptSpecParagraph)가 reflect 본문에서 제거됨
  assert.ok(!/body=body\.replace\(\/\\s\*\$\/,''\)\+'\\n\\n'\+_buildConceptSpecParagraph/.test(PATENT_SRC), '★ step_08 APPEND 제거(은퇴)');
  assert.match(PATENT_SRC, /\[B2\] reflect 은퇴/, '★ 은퇴 명문화');
  assert.match(PATENT_SRC, /function reflectConceptsToSpec\(\)\{[\s\S]*?outputs\.step_18=s18[\s\S]*?return \{desc:0, ref:refAdded\}/, '★ reflect=step_18 부호만, desc 0');
});

test('소스 ★ B — 라벨 폴백 헬퍼 + _buildConceptOutputText 적용', () => {
  assert.match(PATENT_SRC, /function _conceptRefFallbackName\(ct\)\{/, '폴백 이름 헬퍼');
  assert.match(PATENT_SRC, /function _conceptRefPairs\(ct\)\{/, '쌍 헬퍼(폴백 적용)');
  assert.match(PATENT_SRC, /const refs=_conceptRefPairs\(ct\)\.map\(p=>`\$\{p\.name\}\(\$\{p\.num\}\)`\)/, '★ _buildConceptOutputText 폴백 적용');
});

test('소스 ★ C — full 인덱스 접근(버그) 제거 유지 + _generatedConceptsWithNums 정합', () => {
  assert.ok(!/_conceptFigNums\[conceptDiagramTypes\.indexOf\(ct\)\]/.test(PATENT_SRC), '★ full indexOf 접근(버그) 없음');
  assert.ok(!/_conceptFigNums\.filter\(\(_,i\)=>conceptDiagramTypes\[i\]\?\.svgContent\)/.test(PATENT_SRC), '★ full 인덱스 필터(버그) 없음');
  assert.match(PATENT_SRC, /function _generatedConceptsWithNums\(\)\{[\s\S]*?\.filter\(ct=>ct\.svgContent\)\.map\(\(ct,fi\)=>/, '★ 생성분 filter 순서 인덱스(fi) 정합(step_08c·reflect 공용)');
});

test('소스 ★ 회귀 0 — step_18 _refSources step_07c 유지, ① 제목 동기화 유지', () => {
  assert.match(PATENT_SRC, /_refSources=\[outputs\.step_06,[^\]]*outputs\.step_07c\]/, 'step_18 부호수집 step_07c 포함 유지');
  assert.match(PATENT_SRC, /_conceptSvgApplyTitle\(_conceptSvgApplyRefNums\(/, '① 제목 동기화 유지(통합 헬퍼 _conceptSvgForDisplay)');
});
