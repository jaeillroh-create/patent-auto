/**
 * review-engine/__tests__/patent-validator-falsepos-fix.test.js
 *
 * ★ 실전 A/B 평가(2026-07-21)에서 발견된 검증기 오탐 2건 수정(§6-4).
 *   §6-4a CHK-8: 그룹 정의("wc, wa, wg는 …가중치")·아래첨자(wᵢ) 미인식 → math_var_undefined 오탐.
 *   §6-4b CHK-6: 도면의 간단한 설명 "도 N은 ~이다"가 상세설명 도입부에 정당 반복 → sentence_duplicate 오탐.
 *   두 수정 모두 "진성 결함 검출력은 유지"(회귀 테스트 동반).
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

const checks = (spec, name) => JSON.parse(vm.runInContext(
  'JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check===' + JSON.stringify(name) + ';}))',
  sandbox, { filename: 'e.js' }));

// ─────────── §6-4a CHK-8 그룹정의·아래첨자 오탐 수정 ───────────

test('★ §6-4a — 그룹 정의("wc, wa, wr, wg는 …가중치")는 전부 정의로 인정(오탐 0)', () => {
  const spec = '【수학식 1】\nS = wc + wa + wr + wg\n여기서, wc, wa, wr, wg는 각 신호에 대응하는 가중치로서 0 이상 1 이하의 값이고, S는 종합 점수이다.';
  assert.equal(checks(spec, 'math_var_undefined').length, 0, '★ 나열 앞 변수(wc/wa/wr)도 정의 인정');
});

test('★ §6-4a — 아래첨자 변수(wᵢ)도 온전히 추출·정의 인정', () => {
  const spec = '【수학식 1】\nY = wᵢ + b\n여기서, wᵢ는 i번째 가중치이고, b는 바이어스이며, Y는 출력값이다.';
  assert.equal(checks(spec, 'math_var_undefined').length, 0, '★ wᵢ 토큰화·정의 매칭(오탐 0)');
});

test('★ §6-4a 회귀 — 진짜 미정의 변수는 여전히 검출', () => {
  const spec = '【수학식 1】\nY = a + b + Z\n여기서, a, b는 계수이다.';
  const iss = checks(spec, 'math_var_undefined');
  assert.ok(iss.length >= 1, '★ 정의 없는 Y·Z 검출 유지');
  assert.match(iss[0].detail, /Z/, '★ Z가 미정의로 지목');
});

// ─────────── §6-4b CHK-6 도면설명 정당반복 오탐 수정 ───────────

const DRAW_SENT = '도 1은 서사 구조화 및 제작 메모리 기반 적응형 모델 라우팅 시스템의 전체 구성을 나타내는 블록도이다.';

test('★ §6-4b — 도면의 간단한 설명 ↔ 상세설명 도입부 동일 문장은 중복 아님(오탐 0)', () => {
  const spec = '【도면의 간단한 설명】\n' + DRAW_SENT + '\n\n【발명을 실시하기 위한 구체적인 내용】\n' + DRAW_SENT + ' 도 1을 참조하면, 제어부(100)는 입력을 처리한다.';
  assert.equal(checks(spec, 'sentence_duplicate').length, 0, '★ 도면설명 정당 반복은 sentence_duplicate 미검출');
  assert.equal(checks(spec, 'paragraph_duplicate').length, 0, '★ 문단 중복도 미검출');
});

test('★ §6-4b 회귀 — 상세설명 내부의 진짜 문단 중복은 여전히 CRITICAL', () => {
  const dup = '제어부(100)는 입력 데이터를 수신하여 소정의 처리를 수행하고 그 결과를 출력부로 전달하도록 구성되며 상태를 관리한다.';
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n' + dup + '\n\n통신부(110)는 외부와 통신한다.\n\n' + dup;
  assert.ok(checks(spec, 'paragraph_duplicate').length >= 1, '★ 진성 문단 중복 검출 유지');
});

// ─────────── §1.5 CHK-8 함수 화이트리스트/정의 + §6-5 을/를 헬퍼 ───────────

test('★ §1.5 CHK-8 — clip 화이트리스트 + "X 함수는" 정의 인정(gelu 등 비화이트 함수)', () => {
  const spec = '【수학식 1】\nY = clip(gelu(x))\n여기서, gelu 함수는 활성화 함수이고, x는 입력이며, Y는 출력이다.';
  assert.equal(checks(spec, 'math_var_undefined').length, 0, '★ clip(화이트)·gelu("함수는" 정의)·x·Y 모두 미오탐');
});

test('★ §6-5 josaEulReul — 라벨 받침 유무로 을/를 정확 선택', () => {
  const j = (w) => vm.runInContext('josaEulReul(' + JSON.stringify(w) + ')', sandbox, { filename: 'j.js' });
  assert.equal(j('사용자 시나리오'), '를', '★ 모음 종성(오) → 를 (기존 "시나리오을" 오류 해소)');
  assert.equal(j('UI 화면'), '을', '★ 받침(ㄴ) → 을');
  assert.equal(j('데이터 구조'), '를', '★ 모음(조) → 를');
  assert.equal(j('하드웨어 블록'), '을', '★ 받침(ㄱ) → 을');
});

// ═══════════ 배치 2 — 신규 검사 3종(§6-3) ═══════════

// (b) CHK-10 부호 이중배정
test('★ §6-3b — 동일 부호(125)에 상이 명칭 2개(자가보완부/재정렬부) 검출(A2)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 데이터를 처리한다. 자가보완부(125)는 오류를 보완한다. 통신부(110)는 통신한다. 재정렬부(125)는 순서를 재정렬한다.';
  const iss = checks(spec, 'refnum_dupassign');
  assert.ok(iss.some(i => /125/.test(i.message)), '★ 부호 125 이중배정 검출');
});
test('★ §6-3b — 동일 명칭에 상이 부호 2개(125/127) 검출(A3)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n자가보완부(125)는 보완한다. 통신부(110)는 통신한다. 자가보완부(127)는 또한 보완한다.';
  assert.ok(checks(spec, 'refnum_dupassign').some(i => /자가보완부/.test(i.message)), '★ 동일 명칭 이중 부호 검출');
});
test('★ §6-3b 회귀 — 정상(상기 접두 포함) 부호는 오탐 0', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 처리하고, 상기 제어부(100)는 다시 통신부(110)로 전달하며, 저장부(120)는 저장한다.';
  assert.equal(checks(spec, 'refnum_dupassign').length, 0, '★ 상기 접두 정규화 후 단일 명칭 → 오탐 없음');
});

// (b) §2.1 정밀화 — 오탐 홍수 소거(외부 실증 반영)
test('★ §2.1 refnum — 선행 절 캡처 방지("다른 실시예에서 통신부(110)"→통신부, 오탐 0)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n다른 실시예에서 통신부(110)를 통해 전송하고, 제어에 따라 통신부(110)가 동작하며, 상기 통신부(110)는 데이터를 수신한다.';
  assert.equal(checks(spec, 'refnum_dupassign').length, 0, '★ 무공백 run만 캡처 → (110) 단일 명칭, 오탐 없음');
});
test('★ §2.1 refnum — 접미 포함관계("품질계약검증및자가보완부"⊃"자가보완부")는 동일 구성(오탐 0)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n품질계약검증및자가보완부(125)는 보완하고, 이후 자가보완부(125)가 재실행된다.';
  assert.equal(checks(spec, 'refnum_dupassign').length, 0, '★ 접미 포함 → 같은 구성으로 1개 취급');
});
test('★ §2.1 claim — 수식어 절/조사 절단 방지("저장하는 저장부"→저장부, "로부터" 제외, 오탐 0)', () => {
  const spec = '【청구범위】\n【청구항 1】 원본 대본을 저장하는 저장부와, 레지스트리로부터 데이터를 수신하는 수신부를 포함하는 서버.\n\n【발명을 실시하기 위한 구체적인 내용】\n저장부(100)는 대본을 저장하고 수신부(110)는 데이터를 수신한다.';
  assert.equal(checks(spec, 'claim_support_missing').length, 0, '★ 저장부·수신부 정확 head 추출 → 뒷받침 확인, 오탐 없음');
});

// (a) CHK-11 수학식 참조 정합
test('★ §6-3a — "다음의 수학식 N"이나 실제로는 앞에 위치(방향 불일치 B2)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n【수학식 2】\nP = a + b\n여기서, a, b는 값이다.\n\n장치는 다음의 수학식 2에 의해 값을 산출한다.';
  assert.ok(checks(spec, 'math_ref_mismatch').some(i => /수학식 2/.test(i.message)), '★ 방향 불일치 검출');
});
test('★ §6-3a — 참조한 수학식이 부재하면 검출', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n장치는 수학식 5에 의해 처리한다.';
  assert.ok(checks(spec, 'math_ref_mismatch').some(i => /부재/.test(i.message)), '★ 수학식 5 부재 검출');
});
test('★ §6-3a 회귀 — 올바른 "상기 수학식 1"(앞에 정의됨)은 오탐 0', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n【수학식 1】\nY = x\n여기서 x는 입력이다.\n\n장치는 상기 수학식 1에 의해 산출한다.';
  assert.equal(checks(spec, 'math_ref_mismatch').length, 0, '★ 정상 참조 오탐 없음');
});

// (c) CHK-12 청구항 구성요소 뒷받침
test('★ §6-3c — 청구항 "재정렬부"가 상세설명 문언 부재(B5)', () => {
  const spec = '【청구범위】\n【청구항 3】 벤치마크 증거 기반 재정렬부를 포함하는 서버.\n\n【발명을 실시하기 위한 구체적인 내용】\n정렬부(1241)는 순서를 정렬한다.';
  assert.ok(checks(spec, 'claim_support_missing').some(i => /재정렬부/.test(i.detail)), '★ 재정렬부 뒷받침 부재 검출');
});
test('★ §6-3c 회귀 — 청구항 구성요소가 상세설명에 모두 존재하면 0', () => {
  const spec = '【청구범위】\n【청구항 1】 제어부와 통신부를 포함하는 서버.\n\n【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 처리하고 통신부(110)는 통신한다.';
  assert.equal(checks(spec, 'claim_support_missing').length, 0, '★ 전부 뒷받침 → 오탐 없음');
});

// ═══════════ 배치 2.2 — 부호의 설명 canonical 기준축 + claim_support 문언 검사 ═══════════
// ★ 실증 코퍼스 구조를 모사한 합성 픽스처(문서A=2 / 문서B=1 / 26P1036=0). FP 유발조건(비-부 명칭 '메모리',
//   공백 절단 '데이터 저장부', 동일접미 상이구성 '결과 산출부'/'신뢰도 산출부')을 심어 R1·R2 회귀를 가드한다.
//   실제 코퍼스 카운트는 사용자 확인 필요.

// 문서A: 부호 125 canonical=자가보완부인데 body가 재정렬부(125) 배정(b) + 자가보완부가 125·127 이중부호(c) = 2건
test('★ §2.2 문서A 모사 — dupassign 정확히 2(재정렬부/125 불일치 + 자가보완부 125·127)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n통신부(110)는 통신하고, 무선통신부(110)는 무선으로 통신한다. 메모리(130)는 저장하며, 데이터를 저장하는 데이터 저장부(140)는 결과를 저장한다. 자가보완부(125)는 보완하고, 재정렬부(125)는 순서를 재정렬한다. 자가보완부(127)는 추가로 보완한다. 실행 결과를 산출하는 결과 산출부(150)와, 신뢰도를 산출하는 신뢰도 산출부(160)를 더 포함한다.\n\n【부호의 설명】\n통신부 : 110\n메모리 : 130\n데이터저장부 : 140\n자가보완부 : 125\n자가보완부 : 127\n결과산출부 : 150\n신뢰도산출부 : 160';
  const iss = checks(spec, 'refnum_dupassign');
  assert.equal(iss.length, 2, '★ [b] 125 불일치 + [c] 자가보완부 이중부호 = 2 (FP 유발조건 전부 미발화)');
  assert.ok(iss.some(i => /\(125\)/.test(i.message) && /자가보완부/.test(i.message) && /재정렬부/.test(i.detail)), '★ [b] canonical=자가보완부 ↔ body=재정렬부');
  assert.ok(iss.some(i => /동일 명칭 "자가보완부"/.test(i.message)), '★ [c] 자가보완부 125·127');
});

// 문서B: 부호 125 canonical=자가보완부인데 body가 품질검증부(125) 배정(b)만 = 1건
test('★ §2.2 문서B 모사 — dupassign 정확히 1(품질검증부/125 불일치만)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n통신부(110)는 통신한다. 메모리(130)는 저장하며, 데이터를 저장하는 데이터 저장부(140)는 저장한다. 자가보완부(125)는 보완하고, 품질검증부(125)는 품질을 검증한다. 실행 결과를 산출하는 결과 산출부(150)와, 신뢰도를 산출하는 신뢰도 산출부(160)를 포함한다.\n\n【부호의 설명】\n통신부 : 110\n메모리 : 130\n데이터저장부 : 140\n자가보완부 : 125\n결과산출부 : 150\n신뢰도산출부 : 160';
  const iss = checks(spec, 'refnum_dupassign');
  assert.equal(iss.length, 1, '★ [b] 품질검증부/125 1건만 (메모리·공백절단·동일접미 미발화)');
  assert.ok(/\(125\)/.test(iss[0].message) && /품질검증부/.test(iss[0].detail), '★ 125 canonical↔품질검증부');
});

// 26P1036(클린 + FP 유발조건 전부): 메모리(비-부)·데이터 저장부(공백절단)·결과/신뢰도 산출부(동일접미) → 0
test('★ §2.2 26P1036 모사 — 메모리·공백절단·동일접미 상이구성 전부 오탐 0', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n제어부(110)는 처리하고, 메모리(130)는 저장하며, 데이터를 저장하는 데이터 저장부(140)는 저장한다. 실행 결과를 산출하는 결과 산출부(150)와, 신뢰도를 산출하는 신뢰도 산출부(160)를 포함하고, 프로세서(170)는 연산한다.\n\n【부호의 설명】\n제어부 : 110\n메모리 : 130\n데이터저장부 : 140\n결과산출부 : 150\n신뢰도산출부 : 160\n프로세서 : 170';
  assert.equal(checks(spec, 'refnum_dupassign').length, 0, '★ 저장부 raw↔canonical 데이터저장부 접미관계 / 결과·신뢰도 산출부 전체명칭 상이 → 오탐 0');
});

// R1 회귀: 비-부 명칭(메모리)이 canonical과 일치하면 [b] 미발화(교차결합 캡처 제거 확인)
test('★ §2.2 R1 — 비-부 명칭 "메모리(130)"는 인접 캡처되어 canonical과 일치(오탐 0)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n라우팅부(120)를 통해 데이터를 메모리(130)에 저장한다.\n\n【부호의 설명】\n라우팅부 : 120\n메모리 : 130';
  assert.equal(checks(spec, 'refnum_dupassign').length, 0, '★ (130) 직전 인접 "메모리" 캡처 → 앞 라우팅부로 오결합 안 함');
});

// R2 회귀(canonical 없음): 공백절단 "결과 산출부"/"신뢰도 산출부"는 확장 전체명칭이 상이 → c-경로 미발화
test('★ §2.2 R2 — canonical 없이 공백절단 동일접미(산출부 3자)는 확장명칭 상이로 오탐 0', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n실행 결과를 산출하는 결과 산출부(150)와, 신뢰도를 산출하는 신뢰도 산출부(160)를 포함한다.';
  assert.equal(checks(spec, 'refnum_dupassign').length, 0, '★ 결과산출부≠신뢰도산출부(확장 전체명칭) → 미병합');
});

// R2 회귀(진성): canonical 없이 공백 포함 동일 전체명칭(자가보완부 5자)이 상이부호 → c-경로 발화 복원
test('★ §2.2 R2 — canonical 없이 동일 전체명칭 "실시간 자가보완부" 상이부호는 발화', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n실시간 자가보완부(125)는 보완하고, 실시간 자가보완부(127)가 재실행된다.';
  assert.ok(checks(spec, 'refnum_dupassign').some(i => /실시간자가보완부/.test(i.message)), '★ 확장 전체명칭 {125,127} 동일 → 발화');
});

// claim_support: 재정렬부가 종속항(제2항)에만 등장 + 상세설명 부재 → 검출(종속항 추출 확인)
test('★ §2.2 claim_support 종속항 — 종속항의 "…하는 재정렬부"도 추출·뒷받침 검사', () => {
  const spec = '【청구범위】\n【청구항 1】 제어부와 통신부를 포함하는 서버.\n【청구항 2】 제1항에 있어서, 데이터를 재정렬하는 재정렬부를 더 포함하는 서버.\n\n【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 처리하고 통신부(110)는 통신한다.';
  assert.ok(checks(spec, 'claim_support_missing').some(i => /재정렬부/.test(i.detail)), '★ 종속항 재정렬부 뒷받침 부재 검출');
});

// ─────────── 소스 배선 ───────────

test('★ 소스 — CHK-8 그룹정의 인정 + CHK-6 도면설명 제외', () => {
  assert.match(PATENT_SRC, /그룹 정의 인정/, '★ §6-4a 그룹정의 주석');
  assert.match(PATENT_SRC, /const _dcl=/, '★ §6-4a 정의문자클래스 상수');
  assert.match(PATENT_SRC, /_bodyForDup/, '★ §6-4b 도면설명 제외 소스');
  assert.match(PATENT_SRC, /도면의 간단한 설명 섹션도 중복 소스에서 제외/, '★ §6-4b 주석');
});

test('★ 소스 — 배치2 신규검사 3종 + §6-7 파일명 스탬프', () => {
  assert.match(PATENT_SRC, /check:'refnum_dupassign'/, '★ CHK-10 부호 이중배정');
  assert.match(PATENT_SRC, /check:'math_ref_mismatch'/, '★ CHK-11 수식 참조 정합');
  assert.match(PATENT_SRC, /check:'claim_support_missing'/, '★ CHK-12 청구항 뒷받침');
  assert.match(PATENT_SRC, /부호의 설명 canonical\(부호→전체명칭\)을 기준축으로/, '★ §2.2 CHK-10 canonical 기준축');
  assert.match(PATENT_SRC, /const _canonMap=new Map\(\)/, '★ §2.2 canonical 맵');
  assert.match(PATENT_SRC, /교차결합 캡처 제거: b-경로 캡처를/, '★ §2.2 R1 인접 raw 캡처');
  assert.match(PATENT_SRC, /뒷받침 판정은 "정규화 부분문자열 그대로 존재"만 인정/, '★ §2.2 claim_support 문언 검사');
  assert.match(PATENT_SRC, /function _specStamp\(\)/, '★ §6-7 파일명 스탬프(생성시각+지문)');
  assert.match(PATENT_SRC, /_specStamp\(\)\}\.txt/, '★ txt 파일명에 스탬프');
  assert.match(PATENT_SRC, /_specStamp\(\)\}\.doc/, '★ doc 파일명에 스탬프');
});
