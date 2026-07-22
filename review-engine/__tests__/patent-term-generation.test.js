/**
 * review-engine/__tests__/patent-term-generation.test.js
 *
 * ★ 배치 3 — §6-1 스텝 간 용어·부호 "세대 일치".
 *   명칭/구성 확정 시 구세대 명칭의 diff청크(신명칭에 없는 제거 어절, 공백제거 ≥5자)를 termSnapshot.staleTerms에 누적하고,
 *   CHK-13(term_generation_mismatch)이 완성본에 그 구세대 용어가 잔존하는지(재생성 안 된 구세대 산출물 혼입)를 검출한다.
 *   결정: (a) diff청크+≥5자, (b) CHK-13=HIGH, (c) 스텝저장 경고만. 보강: 복귀 프루닝·상한 20·스텝 귀속·outputs 가드.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
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
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
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

const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
const runJSON = (expr) => JSON.parse(run('JSON.stringify(' + expr + ')'));
beforeEach(() => { run('clearAllState()'); });   // termSnapshot 초기화(§6-1 clearAllState 리셋)

const chk13 = (spec) => runJSON('validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check==="term_generation_mismatch";})');

// ─────────── diff청크 추출 (결정 a) ───────────

test('★ §6-1 diff청크 — 신명칭에 없는 제거 어절 run만, 공백제거 ≥5자', () => {
  const c = runJSON('_termDiffChunks("적응형 모델 라우팅 서버","콘텐츠 생성 자원 라우팅 서버")');
  assert.deepEqual(c, ['적응형모델'], '★ 제거된 "적응형 모델" → "적응형모델"(5자), 공유 "라우팅/서버" 제외');
});
test('★ §6-1 [3.1a] diff청크 — 커넥터(및·기반)에서 분할, run 병합 금지', () => {
  const c = runJSON('_termDiffChunks("서사 구조화 및 제작 메모리 기반 적응형 모델 라우팅 서버 및 방법","대사 보존형 서사 구조화 및 콘텐츠 생성 자원 라우팅 서버 및 방법")');
  assert.deepEqual(c, ['제작메모리', '적응형모델'], '★ "기반"에서 분할 → 통짜 "제작메모리기반적응형모델" 방지');
});
test('★ §6-1 diff청크 — <5자 제거분은 버림(오탐 억제)', () => {
  assert.deepEqual(runJSON('_termDiffChunks("제작 메모리","프로덕션 메모리")'), [], '★ "제작"(2자) → 미기록');
});
test('★ §6-1 diff청크 — 변경 없으면 빈 배열', () => {
  assert.deepEqual(runJSON('_termDiffChunks("동일 명칭 시스템","동일 명칭 시스템")'), []);
});

// ─────────── staleTerms 적재·프루닝·상한 ───────────

test('★ §6-1 record — dedupe + ≥5자', () => {
  run('_recordStaleTerms(["적응형모델라우팅","적응형모델라우팅","짧음"])');
  assert.deepEqual(runJSON('_activeStaleTerms()'), ['적응형모델라우팅'], '★ 중복 제거 + 4자 "짧음" 제외');
});
test('★ §6-1 [보강1] 복귀 프루닝 — 신명칭에 재등장하면 stale에서 제거', () => {
  run('_recordStaleTerms(["적응형모델라우팅"])');
  run('_onTitleChanged("옛제목","콘텐츠 적응형 모델 라우팅 시스템")');   // 신명칭이 구용어를 다시 포함
  assert.deepEqual(runJSON('_activeStaleTerms()'), [], '★ 현재 명칭에 재등장 → 프루닝');
});
test('★ §6-1 [보강3] 상한 20 — 최신 우선 절단', () => {
  const many = Array.from({ length: 25 }, (_, i) => '구세대용어' + String.fromCharCode(0xAC00 + i) + '항목');
  run('_recordStaleTerms(' + JSON.stringify(many) + ')');
  const st = runJSON('_activeStaleTerms()');
  assert.equal(st.length, 20, '★ 20개로 제한');
  assert.equal(st[st.length - 1], many[24], '★ 최신 유지');
});

// ─────────── outputs 존재 가드 (보강2) ───────────

test('★ §6-1 [보강2] outputs 없으면 첫 명칭 확정은 stale 미적재(잔존 위험 없음)', () => {
  run('_onTitleChanged("적응형 모델 라우팅 서버","콘텐츠 생성 자원 라우팅 서버")');   // outputs 빈 상태
  assert.deepEqual(runJSON('_activeStaleTerms()'), [], '★ outputs 비어있음 → diff 미적재');
  assert.equal(run('termSnapshot.titleKo'), '콘텐츠 생성 자원 라우팅 서버', '★ 신명칭은 세팅됨');
});

// ─────────── CHK-13 검출 (결정 b: HIGH, 보강4: 스텝 귀속) ───────────

test('★ §6-1 CHK-13 — 문서A형: 도면설명에 구세대 명칭 잔존 → HIGH + 섹션 귀속', () => {
  run('_recordStaleTerms(["적응형모델라우팅"])');
  const spec = '【도면의 간단한 설명】\n도 2는 적응형 모델 라우팅 서버(100)의 블록도이다.\n\n【발명을 실시하기 위한 구체적인 내용】\n콘텐츠 생성 자원 라우팅 서버(100)는 처리한다.';
  const iss = chk13(spec);
  assert.equal(iss.length, 1, '★ 1건 검출');
  assert.equal(iss[0].severity, 'HIGH', '★ HIGH');
  assert.ok(/적응형모델라우팅/.test(iss[0].message), '★ 구세대 용어 지목');
  assert.ok(/도면의 간단한 설명/.test(iss[0].message), '★ 섹션 귀속(스텝 귀속)');
});
test('★ §6-1 CHK-13 회귀 — 구세대 용어가 완성본에 없으면 0', () => {
  run('_recordStaleTerms(["적응형모델라우팅"])');
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n콘텐츠 생성 자원 라우팅 서버(100)는 처리한다.';
  assert.equal(chk13(spec).length, 0, '★ 잔존 없음 → 오탐 0');
});
test('★ §6-1 CHK-13 회귀 — staleTerms 비면 항상 0(신규 프로젝트)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n적응형 모델 라우팅 서버(100)는 처리한다.';
  assert.equal(chk13(spec).length, 0, '★ 스냅샷 없으면 미발화');
});
test('★ §6-1 [3.1a] CHK-13 — 용어가 여러 섹션에 잔존하면 섹션별 발화(같은 섹션 중복은 1건)', () => {
  run('_recordStaleTerms(["적응형모델라우팅"])');
  const spec = '【도면의 간단한 설명】\n도 1은 적응형 모델 라우팅 시스템이다. 상기 적응형 모델 라우팅 시스템은 동작한다.\n\n【발명의 배경이 되는 기술】\n종래의 적응형 모델 라우팅 방식은 한계가 있다.';
  const iss = chk13(spec);
  assert.equal(iss.length, 2, '★ 2개 섹션 → 2건(도면설명 내 2회는 1건으로 병합)');
  assert.ok(iss.some(i => /도면의 간단한 설명/.test(i.message)) && iss.some(i => /배경/.test(i.message)), '★ 각 섹션 귀속');
});

// ─────────── [3.1b] 소급 휴리스틱 title_generation_suspect (MEDIUM) ───────────

const tsuspect = (spec) => runJSON('validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check==="title_generation_suspect";})');

test('★ §6-1 [3.1b] 소급 — 확정명칭과 다른 세대의 명칭구가 도면설명·부호표에 잔존 → MEDIUM 발화(섹션 귀속)', () => {
  const spec = '【발명의 명칭】\n대사 보존형 서사 구조화 및 콘텐츠 생성 자원 라우팅 서버 및 방법\n\n【도면의 간단한 설명】\n도 2는 적응형 모델 라우팅 서버(100)의 블록도이다.\n\n【부호의 설명】\n적응형 모델 라우팅 서버 : 100\n제어부 : 110';
  const iss = tsuspect(spec);
  assert.equal(iss.length, 2, '★ 도면설명 + 부호의 설명 2건');
  assert.ok(iss.every(i => i.severity === 'MEDIUM'), '★ MEDIUM(휴리스틱)');
  assert.ok(iss.some(i => /도면의 간단한 설명/.test(i.message)) && iss.some(i => /부호의 설명/.test(i.message)), '★ 섹션 귀속');
  assert.ok(iss.some(i => /적응형모델/.test(i.message)), '★ 구세대 조각 "적응형모델" 지목');
});
test('★ §6-1 [3.1b] 회귀 — 명칭구가 확정명칭과 동세대면 0(docB형)', () => {
  const spec = '【발명의 명칭】\n콘텐츠 생성 자원 라우팅 서버 및 방법\n\n【도면의 간단한 설명】\n도 2는 콘텐츠 생성 자원 라우팅 서버(100)의 블록도이다.\n\n【부호의 설명】\n콘텐츠 생성 자원 라우팅 서버 : 100';
  assert.equal(tsuspect(spec).length, 0, '★ 동세대 → 오탐 0');
});
test('★ §6-1 [3.1b] 회귀 — 단순 명칭(26P1036형)은 0', () => {
  const spec = '【발명의 명칭】\n데이터 처리 장치\n\n【도면의 간단한 설명】\n도 1은 데이터 처리 장치(10)의 구성도이다.\n\n【부호의 설명】\n데이터 처리 장치 : 10';
  assert.equal(tsuspect(spec).length, 0, '★ 일치 → 0');
});
test('★ §6-1 [3.1b] 회귀 — 【발명의 명칭】 없으면 미발화', () => {
  const spec = '【도면의 간단한 설명】\n도 1은 적응형 모델 라우팅 서버(100)이다.';
  assert.equal(tsuspect(spec).length, 0, '★ 확정명칭 부재 → 미발화');
});
test('★ §6-1 [3.2] 명칭 다행+{영문} 병기 정규화 — 구형 내보내기 오탐 0(26P1036형)', () => {
  const spec = '【발명의 명칭】\n\nCAD\n도면 기반 스마트 전시 동선 안내 서버 및 방법{Server and Method for Exhibition}\n\n【도면의 간단한 설명】\n도 1은 스마트 전시 동선 안내 시스템(10)의 구성도이다.\n\n【부호의 설명】\n스마트 전시 동선 안내 서버 : 100';
  assert.equal(tsuspect(spec).length, 0, '★ 다행 명칭 온전 추출 → "시스템"(3자<5) 침묵, 오탐 0(단일행 캡처였다면 title="CAD"로 4건 오탐)');
});
test('★ §6-1 [3.2] 다행 명칭이라도 진성 세대 혼입은 검출', () => {
  const spec = '【발명의 명칭】\n\nCAD\n콘텐츠 생성 자원 라우팅 서버 및 방법{Server}\n\n【도면의 간단한 설명】\n도 2는 적응형 모델 라우팅 서버(100)의 블록도이다.';
  assert.ok(tsuspect(spec).some(i => /적응형모델/.test(i.message)), '★ 정규화 후에도 진성 diff(적응형모델) 검출 유지');
});

// ─────────── 소스 배선 ───────────

test('★ 소스 — termSnapshot 상태·훅·영속 배선', () => {
  assert.match(PATENT_SRC, /let termSnapshot = \{/, '★ termSnapshot 상태');
  assert.match(PATENT_SRC, /function _termDiffChunks\(/, '★ diff청크 헬퍼');
  assert.match(PATENT_SRC, /function _onTitleChanged\(/, '★ 명칭 변경 훅');
  assert.match(PATENT_SRC, /function _onComponentsChanged\(/, '★ 구성 변경 훅');
  assert.match(PATENT_SRC, /check:'term_generation_mismatch'/, '★ CHK-13');
  assert.match(PATENT_SRC, /chatHistory,conceptDiagramEnabled,conceptDiagramCount,conceptDiagramTypes,termSnapshot,genParams\}/, '★ saveProject 영속');
  assert.match(PATENT_SRC, /termSnapshot=\(s\.termSnapshot/, '★ openProject 복원');
  assert.match(PATENT_SRC, /_onTitleChanged\(selectedTitle, kr\)/, '★ selectTitle 훅(03:385)');
  assert.match(PATENT_SRC, /_onTitleChanged\(prev, v\)/, '★ onTitleInput 훅(03:406)');
  assert.match(PATENT_SRC, /function _warnIfStaleInStep\(/, '★ 스텝저장 경고(결정 c)');
  assert.match(PATENT_SRC, /_FINAL_ONLY_CHECKS = new Set\(\[[^\]]*'term_generation_mismatch'/, '★ CHK-13 완성전용(Step13 주입 제외)');
  assert.ok(!/FIXABLE_CHECKS = new Set\(\[[^\]]*term_generation_mismatch/.test(PATENT_SRC), '★ CHK-13 자동수정 대상 아님(치환 금지)');
  assert.match(PATENT_SRC, /const _TERM_CONN = new Set/, '★ [3.1a] 커넥터 분할 상수');
  assert.match(PATENT_SRC, /function _extractTitlePhrases\(/, '★ [3.1b] 명칭구 추출');
  assert.match(PATENT_SRC, /check:'title_generation_suspect'/, '★ [3.1b] 소급 휴리스틱 검사');
  assert.match(PATENT_SRC, /_FINAL_ONLY_CHECKS = new Set\(\[[^\]]*'title_generation_suspect'/, '★ [3.1b] 완성전용');
  assert.match(PATENT_SRC, /【\\s\*발명의 명칭\\s\*】\\s\*\(\[\\s\\S\]\*\?\)/, '★ [3.2] 명칭 다행 캡처');
  assert.match(PATENT_SRC, /\.replace\(\/\\\{\[\^\}\]\*\\\}\/g/, '★ [3.2] {영문} 병기 제거');
  assert.match(PATENT_SRC, /말미 단음절 조사/, '★ [3.2] 조사 strip');
});
