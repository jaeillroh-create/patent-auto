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
  assert.match(PATENT_SRC, /async function runUnifiedCohesionGen\(opts\)/, '★ 진입점(opts — 체인 silent 지원)');
  assert.match(PATENT_SRC, /게이트 미통과\(기존 내용 보존\)/, '★ 게이트 미통과 시 비파괴');
  assert.match(PATENT_SRC, /pushOutputHistory\('step_08','unified'/, '★ 이력 보존');
  assert.match(PATENT_SRC, /outputs\.step_18=_deriveSignDescription\(r\.refMap\)/, '★ 부호의설명 결정적 직렬화');
  assert.match(PATENT_SRC, /부호불일치 '\+before\.refnum\+'→'\+after\.refnum/, '★ A/B 검증기 지표 대조');
});

// ═══════════ 적대 리뷰 반영: 9개 확인 결함 수정 ═══════════

// (A) CHK-4 서수 명칭 오탐 — "구조적 0" 파탄 수정
test('★ CHK-4 — 서수 명칭("제1 통신부 : 110")이 refnum_consistency 오탐 없음', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n도 1을 참조하면, 제1 통신부(110)는 데이터를 수신한다.\n\n【부호의 설명】\n제1 통신부 : 110';
  const iss = JSON.parse(run('JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check==="refnum_consistency";}))'));
  assert.equal(iss.length, 0, '★ 명칭 내 숫자(제1) 오탐 제거 → refnum_consistency 0');
});
test('★ CHK-4 — 실제 미정의 부호는 여전히 검출(회귀 방지)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n표시부(200)가 출력한다.\n\n【부호의 설명】\n제어부 : 100';
  const iss = JSON.parse(run('JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check==="refnum_consistency";}))'));
  assert.ok(iss.length >= 1, '★ 본문 (200) 미정의 검출 유지(오탐 수정이 검출력을 죽이지 않음)');
});

// (B/D) deviceLeak 정규식 견고화
test('★ deviceLeak — 정당한 장치 서술(단계적/단계별/단계에서/단계 없이) 오탐 없음', () => {
  ['초기화하는 단계적 부팅을 수행한다', '저감하는 단계 없이 처리한다', '조절하는 단계별 제어를 수행한다', '판단하는 단계에서 동작한다'].forEach(function (d) {
    assert.equal(pcb(bundle(REF, d + ' 제어부(100)는 통신부(110)와 동작한다.', METH)).report.deviceLeak, false, '★ "' + d + '" 오탐 아님');
  });
});
test('★ deviceLeak — 실제 방법누출(하는 단계를 / S1 / S1000)은 검출', () => {
  assert.equal(pcb(bundle(REF, DEV + ' 데이터를 저장하는 단계를 수행한다.', METH)).report.deviceLeak, true, '★ "하는 단계를"');
  assert.equal(pcb(bundle(REF, DEV + ' S5 로 진행한다.', METH)).report.deviceLeak, true, '★ S5(1자리)');
  assert.equal(pcb(bundle(REF, DEV + ' S1000 을 수행한다.', METH)).report.deviceLeak, true, '★ S1000(4자리)');
});

// (C) methodOk 완화
test('★ methodOk — 과정/스텝 어휘 또는 S### 로도 방법 극성 인정', () => {
  assert.equal(pcb(bundle(REF, DEV, '수신하는 과정을 포함한다.')).report.methodOk, true, '★ "하는 과정"');
  assert.equal(pcb(bundle(REF, DEV, 'S410 에서 데이터를 비교한다.')).report.methodOk, true, '★ S### 단계식별자');
});

// (E) 센티넬 마커 공백 tolerance
test('★ grab — 마커 줄 후행 공백/들여쓰기 tolerance(유효 생성 폐기 방지)', () => {
  const withWs = '<<<REFTABLE>>>  \n' + REF + '\n  <<<END_REFTABLE>>> \n<<<DEVICE_DESC>>>\n' + DEV + '\n<<<END_DEVICE_DESC>>>';
  const r = pcb(withWs);
  assert.equal(r.ok.hasRef, true, '★ 후행 공백 있어도 REFTABLE 파싱');
  assert.equal(r.ok.hasDevice, true, '★ DEVICE 파싱');
});

// (F/G) 커밋 후처리 배선(소스)
test('★ 소스 — 함께 재생성한 step_12 false-stale 배지 제거 + 수학식 재삽입 경고', () => {
  assert.match(PATENT_SRC, /stale-warning\[data-step="step_12"\]/, '★ (F) step_12 false-stale 배지 제거');
  assert.match(PATENT_SRC, /hadMath=!!outputs\.step_09/, '★ (G) 수학식 존재 캡처');
  assert.match(PATENT_SRC, /기존 수학식\(Step 9\)은 새 상세설명에 재삽입이 필요/, '★ (G) 수학식 소실 경고');
});

// ═══════════ [B] 발명자료 → 핵심 명세서 통합 체인(원클릭) ═══════════

test('★ 소스 — runUnifiedFullChain 4단계 오케스트레이션(명칭→청구항→도면→통합)', () => {
  assert.match(PATENT_SRC, /async function runUnifiedFullChain\(_wizOpts\)/, '★ 체인 진입점([배치11] 위저드 opts)');
  assert.match(PATENT_SRC, /await runStep\('step_01'\)/, '★ [1] 명칭');
  assert.match(PATENT_SRC, /parseTitleCandidates\(outputs\.step_01/, '★ [1] 명칭 자동 선택(첫 후보)');
  assert.match(PATENT_SRC, /await runStep\('step_06'\)/, '★ [2] 장치 청구항');
  assert.match(PATENT_SRC, /wantMethod\)\{ await runStep\('step_10'\)/, '★ [2] 방법 청구항(옵션)');
  assert.match(PATENT_SRC, /await runDiagramStep\('step_07'\)/, '★ [3] 장치 도면');
  assert.match(PATENT_SRC, /await runUnifiedCohesionGen\(\{chained:true\}\)/, '★ [4] 상세설명+부호 통합(chained)');
});

test('★ 소스 — 체인 비파괴/그레이스풀 + 재진입 차단 + 전제조건 + 락 미보유', () => {
  assert.match(PATENT_SRC, /_unifiedChainRunning/, '★ 재진입 차단 플래그');
  assert.match(PATENT_SRC, /먼저 발명 유형을 선택하세요/, '★ 유형 전제조건');
  assert.match(PATENT_SRC, /여기서 중단\(청구항까지 보존\)/, '★ 도면 실패 시 그레이스풀 중단(보존)');
  assert.match(PATENT_SRC, /globalProcessing 을 직접 잡지 않는다/, '★ 락 미보유 설계(하위 early-return 방지)');
  assert.match(PATENT_SRC, /if\(!\(opts&&opts\.chained\)&&!confirm/, '★ chained면 확인창 스킵');
});

test('★ 소스 — 통합 체인 버튼 배선(배치14: ② 설계 보드로 이동)', () => {
  const html = readFileSync(path.join(REPO, 'index.html'), 'utf8');
  // [배치14-1] 버튼은 ② 설계 보드(wfStage2Main) 안으로 이동 — ①에는 안내만.
  assert.match(html, /id="wfStage2Main"[\s\S]*?id="btnUnifiedFullChain"[\s\S]{0,120}onclick="runUnifiedFullChain\(\)"/, '★ ② 보드 내 버튼→함수');
  assert.ok(!/id="cardUnifiedFullChain"/.test(html), '★ 구 ① 카드 제거');
  assert.match(html, /발명자료 → 핵심 명세서/, '★ 레이블');
  assert.match(html, /id="progressUnifiedFullChain"/, '★ 진행률 컨테이너');
});
