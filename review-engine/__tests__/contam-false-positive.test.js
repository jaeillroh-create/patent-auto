/**
 * review-engine/__tests__/contam-false-positive.test.js
 *
 * 오염검출 false-positive 수정 — 정형 서두·조문이 forbiddenSpan→high 로 오검출되던 버그.
 *   ★ `제N항` 이 "청구항 제N항(고유)" 과 "특허법 제N조 제M항(정형 조문)" 을 구분 못 하고,
 *     exact-string 화이트리스트가 변형(무공백·다른 항/호)을 못 걸러 정형 문장이 차단되던 문제.
 *   수정: 공유 헬퍼 _caseSpecificMarkers/_isBoilerplateSentence(법조 문맥 veto)를 추출·검증 양쪽에 적용.
 *   ★ 진짜 오염(다른 사건 인용·단락·출원번호·마커결합 기술내용)은 계속 high 로 보존.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion;

before(() => {
  const src = readModuleBundle(REPO, 'opinion');
  const sb = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }), functions: { invoke: async () => ({ data: null }) } };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App: { sb, currentUser: { id: 'u1' } },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
});

// 진단의 실측 3문장(콘솔 확정).
const STAT = '특허법 제42조제3항제1호 및 동조제4항제2호에 대하여 다음과 같이 의견을 제출합니다';
const RECITAL = '귀청께서는 2026.04.10.자로 본 출원에 대하여 특허법 제42조 제3항 제1호의 의견제출통지서를 발송하였습니다';
const GENUINE = '청구항 제3항의 가중 보정부는 인용문헌 2의 필터와 작용효과가 상이합니다';

// ─── ★ 공유 헬퍼: 정형 vs 고유 구분 ───

test('★ _caseSpecificMarkers — 정형 조문/서두 = [] (법조 제N항을 청구항으로 오인 안 함)', () => {
  assert.deepEqual(Opinion._caseSpecificMarkers(STAT), [], '조문(제42조 제3항)은 고유 마커 0');
  assert.deepEqual(Opinion._caseSpecificMarkers(RECITAL), [], '서두(의견제출통지서)는 고유 마커 0');
});

test('★ _caseSpecificMarkers — 진짜 고유는 claim/cited 검출', () => {
  const m = Opinion._caseSpecificMarkers(GENUINE);
  assert.ok(m.indexOf('claim') >= 0, '청구항 제3항 → claim');
  assert.ok(m.indexOf('cited') >= 0, '인용문헌 2 → cited');
});

test('★ _caseSpecificMarkers — 단락【NNNN】·출원번호도 검출', () => {
  assert.ok(Opinion._caseSpecificMarkers('명세서 【0072】에 기재된 구성').indexOf('para') >= 0, '단락');
  assert.ok(Opinion._caseSpecificMarkers('출원번호 2024-0012345 의 발명').indexOf('appno') >= 0, '출원번호');
});

test('★ _isBoilerplateSentence — 정형(조문·서두) = true, 고유 = false', () => {
  assert.equal(Opinion._isBoilerplateSentence(STAT), true, '조문 = 정형');
  assert.equal(Opinion._isBoilerplateSentence(RECITAL), true, '서두 = 정형');
  assert.equal(Opinion._isBoilerplateSentence(GENUINE), false, '고유 = 정형 아님');
});

test('★ 혼합 문장(조문+청구항) — 고유 우선(정형 아님, 누수 보존)', () => {
  const mixed = '특허법 제42조 제4항에 따라 청구항 제3항의 가중 보정부를 보정합니다';
  assert.ok(Opinion._caseSpecificMarkers(mixed).indexOf('claim') >= 0, '청구항 제3항 고유 마커 검출');
  assert.equal(Opinion._isBoilerplateSentence(mixed), false, '혼합문은 고유 우선');
});

// ─── ★ 추출(sanitizeTemplate.forbiddenSpans) ───

test('★ 정형 통과 — 조문·서두만 있는 양식 → forbiddenSpans 0건', () => {
  const tpl = STAT + '.\n' + RECITAL + '.\n이상과 같이 의견을 제출합니다.';
  const r = Opinion.sanitizeTemplate(tpl, 'inventive_step');
  const joined = r.forbiddenSpans.join(' || ');
  assert.equal(r.forbiddenSpans.length, 0, '정형 문장은 forbiddenSpan 아님 (실측: ' + joined + ')');
});

test('★ 진짜 오염 — 마커+기술/도메인 문장 → forbiddenSpans 포함', () => {
  const tpl = GENUINE + '.\n제5항의 소셜미디어 콘텐츠 추천 모듈은 인용발명 1과 명백히 구별됩니다.';
  const r = Opinion.sanitizeTemplate(tpl, 'inventive_step');
  assert.ok(r.forbiddenSpans.length >= 2, '고유 마커 문장 2건 추출');
  assert.ok(r.forbiddenSpans.some((s) => s.indexOf('가중 보정부') >= 0), '가중 보정부 보존');
  assert.ok(r.forbiddenSpans.some((s) => s.indexOf('소셜미디어 콘텐츠') >= 0), '소셜미디어 콘텐츠 보존');
});

// ─── ★ 검증(validateNoTemplateContamination) — end-to-end ───

test('★★ 정형 서두/조문이 새 의견서에 있어도 clean (오검출 0) — 핵심 회귀', () => {
  // 정형만 있는 양식 → forbiddenSpans 0 → 새 의견서가 같은 정형 서두/조문을 써도 high 아님.
  const tplR = Opinion.sanitizeTemplate(STAT + '.\n' + RECITAL + '.', 'inventive_step');
  Opinion.state._templateForbiddenSpans = tplR.forbiddenSpans;
  const newDraft = '귀청께서는 2026.05.01.자로 특허법 제42조 제4항 제2호의 의견제출통지서를 발송하였습니다. '
    + '특허법 제29조 제2항에 대하여 다음과 같이 의견을 제출합니다.';
  const v = Opinion.validateNoTemplateContamination(newDraft, 'inventive_step');
  assert.equal(v.clean, true, '★ 정형 서두·조문 = 오염 아님 (clean)');
  assert.equal(v.severity, 'low', 'high/medium 경보 없음');
});

test('★★ 진짜 다른 사건 내용이 섞이면 high 차단 — 누수 보존', () => {
  const tplR = Opinion.sanitizeTemplate('제5항의 소셜미디어 콘텐츠 추천 모듈은 인용발명 1과 명백히 구별됩니다.', 'inventive_step');
  Opinion.state._templateForbiddenSpans = tplR.forbiddenSpans;
  // 새 의견서에 그 다른-사건 문장이 그대로 혼입.
  const leaked = '본원발명에 대하여, 제5항의 소셜미디어 콘텐츠 추천 모듈은 인용발명 1과 명백히 구별됩니다.';
  const v = Opinion.validateNoTemplateContamination(leaked, 'inventive_step');
  assert.equal(v.clean, false, '★ 누수 = 차단');
  assert.equal(v.severity, 'high', '★ high 유지(소셜미디어 콘텐츠 등 도메인 누수)');
});

test('★ 마커결합 기술내용(가중 보정부·수치)도 누수면 high', () => {
  const tplR = Opinion.sanitizeTemplate('청구항 제3항의 가중 보정부는 120℃에서 동작하는 제어회로를 포함합니다.', 'inventive_step');
  Opinion.state._templateForbiddenSpans = tplR.forbiddenSpans;
  const leaked = '한편 청구항 제3항의 가중 보정부는 120℃에서 동작하는 제어회로를 포함합니다.';
  const v = Opinion.validateNoTemplateContamination(leaked, 'inventive_step');
  assert.equal(v.severity, 'high', '★ 기술내용 누수 = high 보존');
});

test('forbiddenSpans 없으면 clean(검사 불필요)', () => {
  Opinion.state._templateForbiddenSpans = [];
  const v = Opinion.validateNoTemplateContamination('아무 의견서 본문', 'inventive_step');
  assert.equal(v.clean, true);
});
