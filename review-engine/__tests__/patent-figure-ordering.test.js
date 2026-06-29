/**
 * review-engine/__tests__/patent-figure-ordering.test.js
 *
 * ★ ③ 도면 순서 사용자 지정(옵션 A) — requiredFigures 삽입 밀림 패턴을 예시도(figNumOverride)로 확장.
 *   ③-1 computeFigNums 가 예시도 지정 번호를 예약 → 자동 도면(장치/방법) 밀림(삽입 밀림).
 *   ③-2 conceptDiagramTypes.figNumOverride 필드 + 도 번호 지정 UI(setConceptFigOverride).
 *   ③-4 순서 변경 시 invalidateDownstream(step_07c·step_11) → 발명의 설명/부호의 설명이 새 번호 추종(④).
 *        + 사용자 도면 add/remove 무효화 누락(gap) 메움.
 *   ③-5 충돌 검증 — 범위·사용자 도면·다른 예시도 지정 번호 중복 차단.
 *   ① 회귀 — override 없으면 종래 번호 체계(장치→예시→방법) 불변.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');

let sandbox, toasts;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', // common.js 전역(patent 단독 로드 시 부재) — saveProject 조기반환용
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const setCtx = (stmt) => vm.runInContext(stmt, sandbox);
const figNums = (dev, meth, conc, ov) => JSON.parse(call(`JSON.stringify(computeFigNums(${dev},${meth},${conc},${JSON.stringify(ov || [])}))`));
const autoNums = (sid) => JSON.parse(call(`JSON.stringify(getAutoFigNums(${JSON.stringify(sid)}))`));
const readOverride = (type) => call(`(conceptDiagramTypes.find(c=>c.type===${JSON.stringify(type)})||{}).figNumOverride`);

beforeEach(() => {
  toasts = [];
  setCtx('requiredFigures=[];diagramData={};conceptDiagramTypes=[];outputs={};includeMethodClaims=true;');
});

// ─────────── ③-1 computeFigNums 삽입 밀림(예시도 지정 번호 예약) ───────────

test('③-1 ★ 예시도 도 3 지정 → 자동 장치 도면 밀림([1,2,4,5]), 예시도 [3]', () => {
  const r = figNums(4, 0, 1, [3]);
  assert.deepEqual(r.device, [1, 2, 4, 5], '★ 장치 도면이 도3 건너뛰고 밀림(삽입 밀림)');
  assert.deepEqual(r.concept, [3], '★ 예시도 = 지정 번호 도3');
  assert.equal(r.lastFig, 5, '최종 도 번호 5');
});

test('③-1 ★ 예시도 지정이 자동 범위 밖(도10)이어도 정확 — 방법 도면 당겨짐', () => {
  // dev2 + concept(override10) + meth1 → device[1,2], concept[10], method[3]
  const r = figNums(2, 1, 1, [10]);
  assert.deepEqual(r.device, [1, 2], '장치 [1,2]');
  assert.deepEqual(r.concept, [10], '예시도 지정 도10');
  assert.deepEqual(r.method, [3], '★ 방법 도면은 빈 자리(도3) 차지');
  assert.equal(r.lastFig, 10, '★ lastFig=10(override 반영)');
});

test('③-1 ★ 사용자 도면 + 예시도 지정 번호 동시 예약(둘 다 skip)', () => {
  setCtx('requiredFigures=[{num:2,description:"u"}];');
  const r = figNums(2, 0, 1, [5]); // 예약 {2(user),5(concept)}
  assert.deepEqual(r.device, [1, 3], '★ 장치가 도2(사용자)·도5(예시) 모두 건너뜀');
  assert.deepEqual(r.concept, [5], '예시도 도5');
});

test('③-1 ★ 다중 예시도 — 일부만 지정(도3), 나머지 자동', () => {
  // dev3 + concept[override3, auto] → reserved{3}; device[1,2,4]; concept: c0=3(지정), c1=auto(5) → [3,5]
  const r = figNums(3, 0, 2, [3, 0]);
  assert.deepEqual(r.device, [1, 2, 4], '장치 도3 skip');
  assert.deepEqual(r.concept, [3, 5], '★ 지정[3] + 자동[5]');
});

// ─────────── ① 회귀 — override 없으면 종래 체계 불변 ───────────

test('① 회귀 ★ override 없음 → 종래 번호(장치→예시→방법) 불변', () => {
  const r = figNums(4, 2, 1, [0]); // 0=자동
  assert.deepEqual(r.device, [1, 2, 3, 4], '장치 1~4');
  assert.deepEqual(r.concept, [5], '예시도 5(장치 뒤)');
  assert.deepEqual(r.method, [6, 7], '방법 6~7');
  assert.equal(r.lastFig, 7);
});

test('① 회귀 ★ override 배열 미전달(3-arg 호출) → 기존 호출부 무손상', () => {
  const r = JSON.parse(call('JSON.stringify(computeFigNums(2,1,1))')); // 4번째 인자 없음
  assert.deepEqual(r.device, [1, 2], '장치');
  assert.deepEqual(r.concept, [3], '예시도');
  assert.deepEqual(r.method, [4], '방법');
});

// ─────────── ③-1/③-2 getAutoFigNums 가 figNumOverride 반영 ───────────

test('③-1 ★ getAutoFigNums — conceptDiagramTypes.figNumOverride 가 SoT에 반영', () => {
  setCtx('diagramData={step_07:[{},{},{},{}]};conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:3}];');
  assert.deepEqual(autoNums('step_07'), [1, 2, 4, 5], '★ 장치 도면 밀림');
  assert.deepEqual(autoNums('step_07c'), [3], '★ 예시도 = 지정 도3');
});

test('③-2 ★ figNumOverride 0/미설정 → 자동(svgContent 있는 예시도만 카운트)', () => {
  setCtx('diagramData={step_07:[{},{}]};conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>"}];');
  assert.deepEqual(autoNums('step_07'), [1, 2], '장치');
  assert.deepEqual(autoNums('step_07c'), [3], '예시도 자동(장치 뒤)');
});

// ─────────── ③-5 충돌 검증 + ③-2 설정 ───────────

test('③-2/③-5 ★ 정상 지정 — ct.figNumOverride 설정 + 성공 토스트', () => {
  setCtx('diagramData={step_07:[{},{},{},{}]};conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:0}];');
  call('setConceptFigOverride("ui_screen","3")');
  assert.equal(readOverride('ui_screen'), 3, '★ figNumOverride=3 설정');
  assert.ok(toasts.some(t => t.t !== 'error' && /도 3/.test(t.m)), '성공 토스트(에러 아님)');
});

test('③-5 ★ 범위 초과(>max) 차단 — override 미변경 + 에러 토스트', () => {
  setCtx('conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:0}];');
  call('setConceptFigOverride("ui_screen","999")');
  assert.equal(readOverride('ui_screen'), 0, '★ 미변경(0 유지)');
  assert.ok(toasts.some(t => t.t === 'error'), '에러 토스트');
});

test('③-5 ★ 사용자 도면 번호와 중복 차단', () => {
  setCtx('requiredFigures=[{num:3,description:"u"}];conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:0}];');
  call('setConceptFigOverride("ui_screen","3")');
  assert.equal(readOverride('ui_screen'), 0, '★ 미변경');
  assert.ok(toasts.some(t => t.t === 'error' && /사용자 도면/.test(t.m)), '사용자 도면 충돌 토스트');
});

test('③-5 ★ 다른 예시도 지정 번호와 중복 차단', () => {
  setCtx('conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:5},{type:"data_structure",svgContent:"<svg></svg>",figNumOverride:0}];');
  call('setConceptFigOverride("data_structure","5")');
  assert.equal(readOverride('data_structure'), 0, '★ 미변경');
  assert.ok(toasts.some(t => t.t === 'error' && /다른 예시도/.test(t.m)), '예시도 충돌 토스트');
});

test('③-2 ★ 빈값 → 자동 복귀(figNumOverride=0)', () => {
  setCtx('conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:7}];');
  call('setConceptFigOverride("ui_screen","")');
  assert.equal(readOverride('ui_screen'), 0, '★ 자동 복귀(0)');
});

// ─────────── ③-4 무효화(④ 추종) — invalidateDownstream 스파이 ───────────

function spyInval() {
  setCtx('globalThis.__inval=[];invalidateDownstream=function(s){globalThis.__inval.push(s);};');
}
const readInval = () => JSON.parse(call('JSON.stringify(globalThis.__inval||[])'));

test('③-4 ★ 예시도 번호 지정 → invalidateDownstream(step_07c·step_11) 호출(발명설명·부호 추종)', () => {
  setCtx('diagramData={step_07:[{},{},{},{}]};conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:0}];');
  spyInval();
  call('setConceptFigOverride("ui_screen","3")');
  const inv = readInval();
  assert.ok(inv.includes('step_07c'), '★ step_07c 무효화(→step_08,step_18)');
  assert.ok(inv.includes('step_11'), '★ step_11 무효화(→step_12,step_18) — 방법 번호도 밀림');
});

test('③-4 gap ★ 사용자 도면 삭제 → invalidateFigureDependents 호출(종전 누락 메움)', () => {
  setCtx('requiredFigures=[{num:3,description:"u"}];');
  spyInval();
  call('removeRequiredFigure(3)');
  const inv = readInval();
  assert.ok(inv.includes('step_07c') && inv.includes('step_11'), '★ 사용자 도면 변경도 무효화');
  assert.equal(call('requiredFigures.length'), 0, '삭제 반영');
});

test('③-4 ★ 예시도 삭제 → 무효화(자동 번호 당겨짐)', () => {
  setCtx('conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:0}];');
  spyInval();
  call('removeConceptDiagramType("ui_screen")');
  const inv = readInval();
  assert.ok(inv.includes('step_07c') && inv.includes('step_11'), '★ 예시도 삭제 무효화');
});

test('③-4 ★ 검증 실패(중복) 시에는 무효화하지 않음(상태 불변)', () => {
  setCtx('requiredFigures=[{num:3,description:"u"}];conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:0}];');
  spyInval();
  call('setConceptFigOverride("ui_screen","3")'); // 사용자 도면과 충돌 → 거부
  assert.deepEqual(readInval(), [], '★ 거부 시 무효화 없음(불필요 재생성 방지)');
});

// ─────────── ③-3 통합 순서 뷰(_plannedFigureLayout) — SoT 단일 ───────────

test('③-3 ★ _plannedFigureLayout — 장치/예시도/방법 도 번호순 통합(밀림 반영)', () => {
  setCtx('diagramData={};requiredFigures=[];includeMethodClaims=true;conceptDiagramTypes=[{type:"ui_screen",svgContent:"<svg></svg>",figNumOverride:3}];');
  const out = JSON.parse(call('JSON.stringify(_plannedFigureLayout())'));
  const nums = out.rows.map(r => r.num);
  assert.deepEqual(nums, [...nums].sort((a, b) => a - b), '★ 도 번호 오름차순 정렬');
  const c3 = out.rows.find(r => r.num === 3);
  assert.equal(c3.tag, '예시도', '★ 도3 = 예시도(지정)');
  assert.ok(c3.ov, '지정 표시');
  assert.ok(out.rows.some(r => r.num === 4 && r.tag === '장치'), '★ 도4 = 장치(도3에 밀림)');
});

test('③-3 ★ 미생성 예시도는 pending(대기)로 분리', () => {
  setCtx('diagramData={};requiredFigures=[];conceptDiagramTypes=[{type:"ui_screen",figNumOverride:0}];'); // svgContent 없음
  const out = JSON.parse(call('JSON.stringify(_plannedFigureLayout())'));
  assert.equal(out.pending.length, 1, '★ 대기 1건');
  assert.ok(!out.rows.some(r => r.tag === '예시도'), '미생성 예시도는 확정 행에 없음');
});

// ─────────── 소스 정합 ───────────

test('소스 ★ ③-2 — push 2곳 모두 figNumOverride:0 필드 포함', () => {
  assert.equal((PATENT_SRC.match(/figNum:0,figNumOverride:0,svgContent:''/g) || []).length, 2, '★ 수동추가+자동감지 push 둘 다');
});

test('소스 ★ ③-2 — 도 번호 지정 input(onchange=setConceptFigOverride)', () => {
  assert.match(PATENT_SRC, /onchange="setConceptFigOverride\('\$\{ct\.type\}',this\.value\)"/, '★ 카드 지정 input 배선');
  assert.match(PATENT_SRC, /function setConceptFigOverride\(typeKey,val\)\{/, 'setConceptFigOverride 정의');
});

test('소스 ★ ③-4 — invalidateFigureDependents 가 step_07c·step_11 둘 다 무효화', () => {
  assert.match(PATENT_SRC, /function invalidateFigureDependents\(\)\{[\s\S]*invalidateDownstream\('step_07c'\)[\s\S]*invalidateDownstream\('step_11'\)[\s\S]*\}/, '★ 양 도면 체인 무효화');
  // add/remove 사용자도면 + 예시도 override/삭제 + _afterConceptFigOverrideChange 에서 호출
  assert.ok((PATENT_SRC.match(/invalidateFigureDependents\(\)/g) || []).length >= 5, '★ 호출부 ≥5(def 제외)');
});

test('소스 ★ ③-3 — 통합 순서 뷰 컨테이너(unifiedFigureOrder) 렌더 + index.html DOM', () => {
  assert.match(PATENT_SRC, /function renderUnifiedFigureOrder\(\)\{/, 'renderUnifiedFigureOrder 정의');
  assert.match(PATENT_SRC, /getElementById\('unifiedFigureOrder'\)/, '컨테이너 참조');
  const HTML = readFileSync(path.join(REPO, 'index.html'), 'utf8');
  assert.match(HTML, /id="unifiedFigureOrder"/, '★ index.html 컨테이너');
});

test('소스 ★ ③-3 — _plannedFigureLayout 가 step_08 설명빌더와 동일 카운트·override 사용(divergence 0)', () => {
  // 설명빌더(generateFigureDescriptions): _uiConcOverrides 를 computeFigNums 4번째 인자로 전달
  assert.match(PATENT_SRC, /const _uiConcOverrides=_uiConcepts\.map\(ct=>ct\.figNumOverride\|\|0\);/, '★ 설명빌더 override 반영');
  assert.match(PATENT_SRC, /computeFigNums\(_uiDevCount,_uiMethCount,_uiConcCount,_uiConcOverrides\)/, '★ 4-arg 호출');
});

test('소스 ★ ① 유지 — 제목 SoT 동기화(_conceptSvgApplyTitle) 무손상', () => {
  assert.match(PATENT_SRC, /_conceptSvgApplyTitle\(_conceptSvgApplyRefNums\(/, '① 제목 동기화 유지(통합 헬퍼 _conceptSvgForDisplay)');
});

test('소스 ★ ③ 일관 — 예시도 카운트 쓰는 computeFigNums 전부 figNumOverride 주입(생성/방법/미리보기)', () => {
  // svgContent 예시도를 세는 computeFigNums 호출은 모두 _placedConceptOverrides() 4번째 인자 동반
  assert.match(PATENT_SRC, /function _placedConceptOverrides\(\)\{[\s\S]*?conceptDiagramTypes\.filter\(ct=>ct\.svgContent\)\.map\(ct=>ct\.figNumOverride\|\|0\)/, '_placedConceptOverrides 정의');
  const withConcept = (PATENT_SRC.match(/computeFigNums\([^)]*conceptDiagramTypes\.filter\(ct=>ct\.svgContent\)\.length/g) || []).length;
  const withOverride = (PATENT_SRC.match(/conceptDiagramTypes\.filter\(ct=>ct\.svgContent\)\.length,_placedConceptOverrides\(\)\)/g) || []).length;
  assert.equal(withConcept, withOverride, '★ 예시도-카운트 computeFigNums 전부 override 동반(divergence 0)');
  assert.ok(withOverride >= 6, '★ 생성·방법·미리보기 ≥6곳');
});

test('소스 ★ 경계 — 장치 모델(computeFigNums 골격) 미대수술: device→concept→method 순서 유지', () => {
  // override 는 예약(reserved) 방식으로만 개입 — 루프 골격(장치→예시→방법)은 그대로
  assert.match(PATENT_SRC, /for\(let i=0;i<devCount;i\+\+\)\{while\(reserved\.has\(c\)\)c\+\+;devNums\.push\(c\);c\+\+;\}/, '★ 장치 루프 골격 유지');
  assert.match(PATENT_SRC, /for\(let i=0;i<methCount;i\+\+\)\{while\(reserved\.has\(c\)\)c\+\+;methNums\.push\(c\);c\+\+;\}/, '★ 방법 루프 골격 유지');
});
