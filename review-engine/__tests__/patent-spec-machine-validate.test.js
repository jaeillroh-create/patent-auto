/**
 * review-engine/__tests__/patent-spec-machine-validate.test.js
 *
 * ★ Item 2 — 완성본 기계검증 validateSpecification (validate_spec.py 등가).
 *   본문·구조 검사 7종: CHK-1 표제, CHK-2 종결어미, CHK-3 단위파손, CHK-4 도면부호 병기,
 *   CHK-6 문단·블록 중복(CRITICAL), CHK-7 문장 절단, CHK-8 수학식 변수 정의.
 *   + validateClaims 확장 CHK-5(다중인용 "및" → 택일 위반).
 *   ★ 26P1036 실증 픽스처 3종(F1 중복 / F2 절단 / F3 변수) 회귀 고정 — 각 음성 케이스 포함.
 *   역할 분담: 청구항 내부 규칙=validateClaims, 본문·구조=validateSpecification (중복 구현 금지).
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
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
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

const call = (e) => vm.runInContext(e, sandbox, { filename: 'c.js' });
const vSpec = (txt) => JSON.parse(call('JSON.stringify(validateSpecification(' + JSON.stringify(txt) + '))'));
const vClaims = (txt) => JSON.parse(call('JSON.stringify(validateClaims(' + JSON.stringify(txt) + '))'));
const has = (iss, check) => iss.some(i => i.check === check);
const cnt = (iss, check) => iss.filter(i => i.check === check).length;

// ─── 완전(clean) 명세서 — 8종 전부 무결(기준선) ───
const CLEAN = [
  '【발명의 설명】',
  '【발명의 명칭】\n검색 시스템',
  '【기술분야】\n본 발명은 검색 시스템에 관한 것이다.',
  '【발명의 배경이 되는 기술】\n종래에는 검색 정확도가 낮은 문제가 있었다.',
  '【선행기술문헌】\n해당 없음.',
  '【발명의 내용】',
  '【해결하고자 하는 과제】\n검색 정확도를 높이는 것이 목적이다.',
  '【과제의 해결 수단】\n통신부(110)와 프로세서(120)를 포함한다.',
  '【발명의 효과】\n정확도가 향상된다.',
  '【도면의 간단한 설명】\n도 1은 시스템 블록도이다.',
  '【발명을 실시하기 위한 구체적인 내용】\n도 1을 참조하면, 통신부(110)는 데이터를 수신한다. 예를 들어, 프로세서(120)는 수신된 데이터를 분석한다.',
  '【부호의 설명】\n통신부 : 110\n프로세서 : 120',
  '【청구범위】\n【청구항 1】 통신부(110); 및 프로세서(120)를 포함하는 검색 시스템.',
  '【요약서】\n검색 시스템을 제공한다.',
].join('\n\n');

test('기준선 ★ CLEAN 명세서 — 어떤 이슈도 없음(오탐 0)', () => {
  const iss = vSpec(CLEAN);
  assert.deepEqual(iss, [], '★ 완전 명세서는 무결(오탐 없음): ' + JSON.stringify(iss));
});

// ─────────── CHK-1 표제 ───────────
test('CHK-1 ★ 표제 누락 검출 / CLEAN은 미검출', () => {
  const missing = CLEAN.replace('【요약서】\n검색 시스템을 제공한다.', '');
  const iss = vSpec(missing);
  assert.ok(has(iss, 'heading_missing'), '★ 요약서 누락 검출');
  assert.ok(iss.some(i => i.check === 'heading_missing' && /요약서/.test(i.message)), '★ 누락 표제명 명시');
  assert.ok(!has(vSpec(CLEAN), 'heading_missing'), '★ CLEAN 미검출');
});

test('CHK-1 ★ 표제 순서 오류 검출', () => {
  // 기술분야 ↔ 발명의 명칭 순서 뒤바꿈
  const reordered = CLEAN.replace('【발명의 명칭】\n검색 시스템\n\n【기술분야】\n본 발명은 검색 시스템에 관한 것이다.',
                                  '【기술분야】\n본 발명은 검색 시스템에 관한 것이다.\n\n【발명의 명칭】\n검색 시스템');
  assert.ok(has(vSpec(reordered), 'heading_order'), '★ 순서 위반 검출');
});

// ─────────── CHK-2 종결어미 ───────────
test('CHK-2 ★ 경어체 혼재 검출 / 평서체 통일은 미검출', () => {
  const mixed = CLEAN.replace('정확도가 향상된다.', '정확도가 향상됩니다. 감사합니다.');
  assert.ok(has(vSpec(mixed), 'sentence_ending'), '★ 경어체 혼재 검출');
  assert.ok(!has(vSpec(CLEAN), 'sentence_ending'), '★ 평서체 통일은 미검출');
});

// ─────────── CHK-3 단위/인코딩 파손 ───────────
test('CHK-3 ★ U+FFFD·그리스문자 모지바케 검출 / 정상 단위 미검출', () => {
  assert.ok(has(vSpec(CLEAN + '\n\n측정값은 5ΜM 로 나타났다.'), 'unit_corruption'), '★ "5ΜM"(㎛ 파손) 검출');
  assert.ok(has(vSpec(CLEAN + '\n\n오류�문자 포함.'), 'unit_corruption'), '★ U+FFFD 검출');
  assert.ok(!has(vSpec(CLEAN + '\n\n값은 5 마이크로미터로 측정된다.'), 'unit_corruption'), '★ 정상 단위 미검출');
});

// ─────────── CHK-4 도면부호 병기 ───────────
test('CHK-4 ★ 본문 사용 부호가 부호의 설명에 미정의 검출 / 일치 시 미검출', () => {
  const badRef = CLEAN.replace('프로세서(120)는 수신된 데이터를 분석한다.', '프로세서(120)는 저장부(999)로 데이터를 전달한다.');
  const iss = vSpec(badRef);
  assert.ok(has(iss, 'refnum_consistency'), '★ 미정의 부호(999) 검출');
  assert.ok(iss.some(i => i.check === 'refnum_consistency' && /999/.test(i.detail || '')), '★ 미정의 번호 명시');
  assert.ok(!has(vSpec(CLEAN), 'refnum_consistency'), '★ 부호 일치 시 미검출');
});

// ─────────── CHK-6 문단·블록 중복 (F1) ───────────
test('CHK-6 ★ F1(26P1036) 동일 문단 2연속 → CRITICAL 1건', () => {
  const para = '도 1을 참조하면, 통신부(110)는 외부 장치로부터 데이터를 수신하고, 프로세서(120)는 수신된 데이터를 분석하여 결과를 생성한다.';
  const F1 = para + '\n\n' + para;
  const iss = vSpec(F1);
  const dup = iss.filter(i => i.check === 'paragraph_duplicate' && i.severity === 'CRITICAL');
  assert.equal(dup.length, 1, '★ 문단 중복 CRITICAL 정확히 1건: ' + JSON.stringify(iss));
});

test('CHK-6 ★ 중복 없는 본문은 미검출', () => {
  assert.ok(!has(vSpec(CLEAN), 'paragraph_duplicate'), '★ CLEAN 문단중복 없음');
  assert.ok(!has(vSpec(CLEAN), 'sentence_duplicate'), '★ CLEAN 문장중복 없음');
});

test('CHK-6b ★ 중간 탈락 복제 문장(26P1036 163자 탈락형) — 서로 다른 문단이어도 검출', () => {
  const orig  = '본 발명의 일 실시예에 따른 신뢰도 기반 동적 가중부는 입력된 신뢰도 값의 시계열 변화에 따라 갱신 주기마다 가중치를 실시간으로 재산출하여 반영한다.';
  const trunc = '본 발명의 일 실시예에 따른 신뢰도 기반 동적 가중부는 입력된 신뢰도 값의 시계열 변화에 따라 반영한다.'; // 중간 "갱신 주기마다…재산출하여" 탈락
  const txt = '서두 문단이다.\n\n' + orig + '\n\n다른 서술 문단이다.\n\n' + trunc;
  assert.ok(has(vSpec(txt), 'sentence_duplicate'), '★ 중간 탈락 복제(접두+접미 커버) 검출');
});

test('CHK-6b ★ 서두만 공유하는 상이 문장은 미검출(오탐 방지)', () => {
  const sA = '본 발명의 일 실시예에 따른 검색 시스템의 신뢰도 기반 동적 가중부는 입력된 신뢰도 값에 따라 실시간으로 가중치를 조정한다.';
  const sB = '본 발명의 일 실시예에 따른 검색 시스템의 신뢰도 기반 동적 가중부는 갱신 주기마다 신뢰도를 재산출하여 성능을 향상시킨다.';
  const txt = sA + '\n\n중간 문단이다.\n\n' + sB;
  assert.ok(!has(vSpec(txt), 'sentence_duplicate'), '★ 공통 서두+상이 본문 → 중복 아님(첫40 그룹핑돼도 접미 짧아 미확정)');
});

// ─────────── 작업1: CHK-6(a) 표제 인접 중복 CRITICAL 승격 ───────────
test('작업1 ★ 표제 인접 중복 — CHK-6(a) CRITICAL 승격(HIGH 강등 아님)', () => {
  const dup = '통신부(110)는 외부 장치로부터 데이터를 수신하고, 프로세서(120)는 수신된 데이터를 분석하여 결과를 생성하고 저장부에 저장한다.'; // norm ≥50
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n' + dup + '\n\n중간 서술 문단이 여기에 위치하여 두 사본을 분리한다.\n\n' + dup;
  const iss = vSpec(spec);
  assert.equal(iss.filter(i => i.check === 'paragraph_duplicate' && i.severity === 'CRITICAL').length, 1, '★ 표제 붙은 첫 사본도 맨 본문과 동일 키 → CRITICAL 1건: ' + JSON.stringify(iss));
});

test('작업1 ★ 음성 — 표제+짧은 본문(50자 미만) 중복은 미검출(스킵 유지)', () => {
  const shortBody = '간단한 요약 설명이다.'; // norm <50
  const spec = '【기술분야】\n' + shortBody + '\n\n중간 문단.\n\n' + shortBody;
  assert.ok(!has(vSpec(spec), 'paragraph_duplicate'), '★ 표제 제거 후 50자 미만 → 스킵');
});

test('작업1 회귀 ★ 표제 없는 본문 중간 중복 — 여전히 CRITICAL(기존 검출 불변)', () => {
  const para = '도 1을 참조하면, 통신부(110)는 외부 장치로부터 데이터를 수신하고, 프로세서(120)는 수신된 데이터를 분석하여 결과를 생성한다.';
  const spec = para + '\n\n' + para;
  assert.equal(vSpec(spec).filter(i => i.check === 'paragraph_duplicate' && i.severity === 'CRITICAL').length, 1, '★ 표제 없는 중복도 CRITICAL 1건 유지');
});

test('작업1 ★ 음성 — 동일 표제 2회여도 본문이 다르면 문단중복 아님(오탐 방지)', () => {
  const body1 = '본 발명은 검색 시스템의 정확도 향상에 관한 것으로서 종래 기술의 한계를 극복하고 사용자 만족도를 크게 높이는 매우 중요한 기술적 의의를 가진다.';
  const body2 = '본 발명은 데이터 처리 속도의 개선에 관한 것으로서 대용량 트래픽 환경에서도 안정적으로 동작하며 상당한 산업적 가치를 지니고 있는 발명이다.';
  const spec = '【기술분야】\n' + body1 + '\n\n【기술분야】\n' + body2;
  assert.ok(!has(vSpec(spec), 'paragraph_duplicate'), '★ 표제 접두 제거해도 본문 상이 → 오탐 없음');
});

// ─────────── CHK-7 문장 절단 (F2) ───────────
test('CHK-7 ★ F2(26P1036) 수학식 "여기서" 절 내부 절단(마침표 직후 숫자) 검출', () => {
  const F2 = '【수학식 3】\nG = f(N)\n여기서, G는 클램핑이 적용된 가중치 항을 나타내는 1 이상의 실수값이며 무차원량이다.2 이상 0.5 이하의 범위에서 설정되고 초기값은 0.3이다.';
  const iss = vSpec(F2);
  assert.ok(has(iss, 'sentence_truncation'), '★ "무차원량이다.2" 절단 검출(수학식 내부)');
});

test('CHK-7 ★ 정상 소수점("0.2 이상")·정상 종결은 미검출(음성)', () => {
  const ok = CLEAN + '\n\n가중치는 0.2 이상 0.5 이하의 범위에서 설정된다.';
  assert.ok(!has(vSpec(ok), 'sentence_truncation'), '★ 정상 소수·정상 종결 미검출');
});

test('CHK-7 ★ 마침표 직후 한글 붙음 검출', () => {
  const glued = CLEAN + '\n\n데이터를 수신한다.프로세서가 이를 처리한다.';
  assert.ok(has(vSpec(glued), 'sentence_truncation'), '★ "수신한다.프로세서" 붙음 검출');
});

// ─────────── CHK-8 수학식 변수 정의 (F3) ───────────
test('CHK-8 ★ F3(26P1036) 수식 변수 λ 미정의 검출', () => {
  const F3 = '【수학식 1】\nG = min(1 + λ × N, G_max)\n여기서, G는 클램핑된 가중치 항이고, N은 입력 개수이며, G_max는 상한값이다.';
  const iss = vSpec(F3);
  assert.ok(has(iss, 'math_var_undefined'), '★ λ 미정의 검출');
  assert.ok(iss.some(i => i.check === 'math_var_undefined' && /λ/.test(i.detail || '')), '★ 미정의 변수 λ 명시');
});

test('CHK-8 ★ 모든 변수 정의 시 미검출(음성) + 함수명(min)은 변수 아님', () => {
  const F3ok = '【수학식 1】\nG = min(1 + λ × N, G_max)\n여기서, G는 가중치 항이고, λ는 학습률이며, N은 입력 개수이고, G_max는 상한값이다.';
  const iss = vSpec(F3ok);
  assert.ok(!has(iss, 'math_var_undefined'), '★ 전 변수 정의 시 미검출(min 함수 오탐 없음): ' + JSON.stringify(iss.filter(i=>i.check==='math_var_undefined')));
});

// ─────────── CHK-5 (validateClaims 확장) 다중인용 "및" ───────────
test('CHK-5 ★ 다중인용 "및"(연결) → 택일 위반 검출', () => {
  const claims = '【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 B를 포함하는 시스템.\n【청구항 3】 제1항 및 제2항에 있어서, C를 더 포함하는 시스템.';
  const iss = vClaims(claims);
  assert.ok(iss.some(i => /다중인용.*및|및.*택일/.test(i.message)), '★ "및" 다중인용 위반 검출: ' + JSON.stringify(iss.map(i=>i.message)));
});

test('CHK-5 ★ 택일("또는")·일반 "및"(구성 나열)은 미검출(음성)', () => {
  const alt = '【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 B를 포함하는 시스템.\n【청구항 3】 제1항 또는 제2항에 있어서, C를 더 포함하는 시스템.';
  assert.ok(!vClaims(alt).some(i => /다중인용.*및|및.*택일/.test(i.message)), '★ "또는" 택일은 미검출');
  const body = '【청구항 1】 프로세서 및 메모리를 포함하는 시스템.';
  assert.ok(!vClaims(body).some(i => /다중인용.*및|및.*택일/.test(i.message)), '★ 구성 나열 "및"은 미검출(claim-ref 아님)');
});

// ─────────── 회귀: validateClaims 기존 동작 불변 ───────────
test('회귀 ★ 정상 청구항쌍은 무결(CHK-5가 오탐 추가 안 함)', () => {
  const good = '【청구항 1】 A를 포함하는 시스템.\n【청구항 2】 청구항 1에 있어서, B를 더 포함하는 시스템.';
  assert.deepEqual(vClaims(good), [], '★ 정상 청구항 무결: ' + JSON.stringify(vClaims(good)));
});

test('회귀 ★ 기존 검사(제한적 표현 KILLER_WORDS) 유지', () => {
  const killer = '【청구항 1】 A를 반드시 포함하는 시스템.';
  assert.ok(vClaims(killer).some(i => /반드시|제한적/.test(i.message)), '★ "반드시" 제한적 표현 여전히 검출');
});

// ─────────── 소스 어서션 ───────────
test('소스 ★ validateSpecification 정의 + 역할분담 주석 + CHK-5 확장', () => {
  assert.match(PATENT_SRC, /function validateSpecification\(specText\)\{/, '★ validateSpecification 정의');
  assert.match(PATENT_SRC, /역할 분담\(중복 구현 금지\)/, '★ 역할분담 주석(중복 구현 금지)');
  assert.match(PATENT_SRC, /\[Item2 CHK-5\][\s\S]*?다중인용[\s\S]*?및/, '★ validateClaims CHK-5 확장');
  assert.match(PATENT_SRC, /function renderSpecValidation\(\)\{/, '★ UI 렌더 함수');
});
