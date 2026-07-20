/**
 * review-engine/__tests__/patent-unified-cohesion.test.js
 *
 * ★ 단일 풀컨텍스트 생성(상세설명↔부호↔도면 응집) — 20단계 분할이 유발하던 도면부호 불일치·용어 드리프트를
 *   "한 번의 컨텍스트"로 구조적으로 제거하는 프로토타입.
 *   - buildPrompt('unified_cohesion'): 센티넬 3블록 + REFTABLE(SSOT) 출력계약.
 *   - parseCohesiveBundle: 블록 파싱 + 결정론 커밋 게이트(notInTable/극성/중복).
 *   - _deriveSignDescription: 부호의 설명(step_18)을 완성 본문 사용부호로 결정적 직렬화(refnum_consistency 구조적 0).
 *   - runUnifiedCohesionGen: 게이트 통과 시에만 원자 커밋(비파괴 A/B).
 */
import { test, before } from 'node:test';
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
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
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

const run = (expr) => vm.runInContext(expr, sandbox, { filename: 'e.js' });
const pcb = (s) => JSON.parse(run('JSON.stringify((function(){var r=parseCohesiveBundle(' + JSON.stringify(s) + ');return {device:r.device,method:r.method,refCount:r.refMap.size,ok:r.ok,report:r.report};})())'));

const bundle = (ref, dev, meth) =>
  '<<<REFTABLE>>>\n' + ref + '\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n' + dev + '\n<<<END_DEVICE_DESC>>>' +
  (meth == null ? '' : '\n<<<METHOD_DESC>>>\n' + meth + '\n<<<END_METHOD_DESC>>>');

const REF = '[장치부호]\n(100) 제어부\n(110) 통신부\n[방법단계]\n(S410) 데이터 수신 단계';
const DEV = '도 1을 참조하면, 제어부(100)는 통신부(110)로부터 데이터를 수신하여 처리한다.';
const METH = '이하에서는 제어부(100)에 의해 수행되는 방법을 설명한다. 데이터를 수신하는 단계를 포함한다.';

// ─────────── parseCohesiveBundle: 정상 ───────────

test('★ 정상 번들 — 3블록 추출 + 게이트 클린', () => {
  const r = pcb(bundle(REF, DEV, METH));
  assert.equal(r.ok.hasRef, true); assert.equal(r.ok.hasDevice, true); assert.equal(r.ok.hasMethod, true);
  assert.equal(r.refCount, 3, '★ REFTABLE 3개(장치2+방법1)');
  assert.deepEqual(r.report.notInTable, [], '★ 본문 부호 모두 표에 정의');
  assert.deepEqual(r.report.dupNums, [], '★ 번호 중복 없음');
  assert.equal(r.report.deviceLeak, false, '★ 장치 방법표현 누출 없음');
  assert.equal(r.report.methodOk, true, '★ 방법 극성 충족');
});

// ─────────── parseCohesiveBundle: 게이트 위반 ───────────

test('★ 게이트 — 본문 미정의 부호(notInTable) 검출', () => {
  const r = pcb(bundle(REF, DEV + ' 표시부(999)가 결과를 출력한다.', METH));
  assert.ok(r.report.notInTable.includes('999'), '★ 표에 없는 (999) 검출');
});

test('★ 게이트 — 장치 상세설명에 방법표현 누출(deviceLeak)', () => {
  const r = pcb(bundle(REF, DEV + ' 데이터를 저장하는 단계를 수행한다.', METH));
  assert.equal(r.report.deviceLeak, true, '★ "~하는 단계" 누출 검출');
});

test('★ 게이트 — 방법 상세설명 극성 미충족(methodOk=false)', () => {
  const r = pcb(bundle(REF, DEV, '이하에서는 제어부(100)에 의해 데이터를 수신하여 처리한다.'));
  assert.equal(r.report.methodOk, false, '★ "~하는 단계" 없으면 극성 미충족');
});

test('★ 게이트 — REFTABLE 번호 중복(dupNums)', () => {
  const r = pcb(bundle('[장치부호]\n(100) 제어부\n(100) 관리부\n(110) 통신부', DEV, METH));
  assert.ok(r.report.dupNums.includes('100'), '★ (100) 중복 검출');
});

test('★ 소프트 — 도면 정의됐으나 본문 미사용(unusedRef)은 경고만', () => {
  const r = pcb(bundle(REF + '\n(120) 저장부', DEV, METH));   // (120) 본문 미사용
  assert.ok(r.report.unusedRef.includes('120'), '★ 미사용 부호 검출(소프트)');
  assert.deepEqual(r.report.notInTable, [], '★ 하드 게이트는 여전히 클린');
});

test('★ 방법 블록 없음(방법 청구항 부재) — hasMethod=false, methodOk=true', () => {
  const r = pcb(bundle(REF, DEV, null));
  assert.equal(r.ok.hasMethod, false, '★ METHOD 블록 없음 정상');
  assert.equal(r.report.methodOk, true, '★ 방법 없으면 극성 통과');
  assert.equal(r.ok.hasDevice, true);
});

test('★ 마커 누락 — REFTABLE/DEVICE 없으면 hasRef/hasDevice=false(비파괴 신호)', () => {
  const r = pcb('설명만 있고 마커가 없는 잘못된 출력이다.');
  assert.equal(r.ok.hasRef, false); assert.equal(r.ok.hasDevice, false);
});

// ─────────── _deriveSignDescription: 부호의 설명 결정적 직렬화 ───────────

test('★ _deriveSignDescription — 본문 사용 부호를 refMap 명칭으로 직렬화', () => {
  run('outputs.step_08 = ' + JSON.stringify('제어부(100)는 통신부(110)와 연결되어 동작한다.') + '; outputs.step_12=""; outputs.step_16=""; outputs.step_18="";');
  const s = run('_deriveSignDescription(new Map([["100","제어부"],["110","통신부"]]))');
  assert.match(s, /제어부 : 100/, '★ 100 직렬화');
  assert.match(s, /통신부 : 110/, '★ 110 직렬화');
});

test('★ _deriveSignDescription — 완성 본문 전 구간 커버(기존 섹션 효과부(120)도 포함)', () => {
  // refMap 에 120 이 없어도, 본문(효과 섹션)에서 쓰인 (120)을 본문 명칭으로 정의 → refnum_consistency 붕괴 방지
  run('outputs.step_08 = ' + JSON.stringify('제어부(100)는 동작한다.') + '; outputs.step_16 = ' + JSON.stringify('효과부(120)에 의해 효율이 향상된다.') + '; outputs.step_12=""; outputs.step_18="";');
  const s = run('_deriveSignDescription(new Map([["100","제어부"]]))');
  assert.match(s, /제어부 : 100/, '★ refMap 명칭 우선');
  assert.match(s, /120/, '★ 기존 섹션 부호(120)도 전수 정의(부분 재생성 정합)');
});

// ─────────── 프롬프트 계약 + 배선(소스) ───────────

test('★ 소스 — unified_cohesion 프롬프트: 센티넬 계약 + SSOT + 부호의설명 위임', () => {
  assert.match(PATENT_SRC, /case 'unified_cohesion':/, '★ 프롬프트 케이스 존재');
  assert.match(PATENT_SRC, /<<<REFTABLE>>>[\s\S]*?<<<END_REFTABLE>>>/, '★ REFTABLE 센티넬');
  assert.match(PATENT_SRC, /<<<DEVICE_DESC>>>/, '★ DEVICE 센티넬');
  assert.match(PATENT_SRC, /<<<METHOD_DESC>>>/, '★ METHOD 센티넬');
  assert.match(PATENT_SRC, /단일 진실원천\(SSOT\)/, '★ SSOT 계약');
  assert.match(PATENT_SRC, /【부호의 설명】은 네가 쓰지 않는다/, '★ 부호의설명은 코드가 직렬화');
});

test('★ 소스 — 프롬프트가 기존 하드계약 보존(방법표현 금지·수식 금지·도면 범위·앵커)', () => {
  assert.match(PATENT_SRC, /문체 극성 분리/, '★ 장치=~한다 / 방법=~하는 단계');
  assert.match(PATENT_SRC, /수학식 N】 블록·수식/, '★ 수식 금지');
  assert.match(PATENT_SRC, /도면 범위 제한/, '★ 도면 범위');
  assert.match(PATENT_SRC, /앵커 종속항 대응 구성/, '★ 앵커 뒷받침');
});

test('★ 소스 — runUnifiedCohesionGen 비파괴 커밋 게이트 + 원자 커밋 + A/B 지표', () => {
  assert.match(PATENT_SRC, /async function runUnifiedCohesionGen\(\)/, '★ 진입점');
  assert.match(PATENT_SRC, /게이트 미통과\(기존 내용 보존\)/, '★ 게이트 미통과 시 비파괴');
  assert.match(PATENT_SRC, /pushOutputHistory\('step_08','unified'/, '★ 이력 보존');
  assert.match(PATENT_SRC, /outputs\.step_18=_deriveSignDescription\(r\.refMap\)/, '★ 부호의설명 결정적 직렬화');
  assert.match(PATENT_SRC, /부호불일치 '\+before\.refnum\+'→'\+after\.refnum/, '★ A/B 검증기 지표 대조');
});
