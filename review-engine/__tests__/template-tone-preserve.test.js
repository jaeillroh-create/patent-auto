/**
 * review-engine/__tests__/template-tone-preserve.test.js
 *
 * 템플릿 톤앤매너(문체) 보존 수정 — _redactMarkerSentences 를 #190 헬퍼와 정합.
 *   ⓐ 정형 서두·결어·조문(특허법 제N조·귀청께서는·의견제출통지서)은 redact 말고 마스킹만 → 서두/결어 문체 보존.
 *   ⓑ '~부' 마스킹이 연결어('…로부터')를 갉던 것 차단.
 *   ★ 진짜 오염(고유 마커+기술/도메인: 가중 보정부·소셜미디어 콘텐츠·인용번호·【단락】)은 여전히 제거(#190 보존).
 * ★ 톤 충분성은 코드로 완전검증 불가 — 실 생성물은 변리사 확인 필요(PR 명시).
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const SRC = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
let Opinion;

before(() => {
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
  vm.createContext(sandbox); vm.runInContext(SRC, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
});

const SEODU = '귀청께서는 2026.04.10.자로 본 출원에 대하여 특허법 제42조 제3항 제1호의 의견제출통지서를 발송하였는바, 이에 다음과 같이 의견을 제출합니다.';
const JOMUN = '특허법 제29조 제2항의 규정에 의하면 진보성은 통상의 기술자를 기준으로 판단합니다.';
const GYEOLEO = '이상과 같이 본원발명은 진보성이 인정되어야 함이 명백하다 할 것이며, 부디 귀청의 현명하신 판단을 앙망하는 바입니다.';
const CONNECT = '본원발명은 인용발명으로부터 용이하게 도출될 수 없습니다.';
const LEAK_CLAIM = '청구항 제3항의 가중 보정부는 120℃에서 동작하는 제어회로를 포함합니다.';
const LEAK_CITED = '인용문헌 1의 【0023】에는 소셜미디어 콘텐츠 추천 모듈이 개시되어 있습니다.';

function sanitize(tpl) { return Opinion.sanitizeTemplate(tpl, 'inventive_step').sanitized; }

// ─── ⓐ 서두/결어/조문 문체 보존 ───

test('★ⓐ 정형 서두 문체 보존 — redact 아닌 마스킹(어투 생존)', () => {
  const s = sanitize(SEODU);
  assert.ok(!s.includes('[사건특유 문장 생략]'), '서두는 redact 되지 않음');
  ['귀청께서는', '의견제출통지서', '발송하였는바', '의견을 제출'].forEach((p) =>
    assert.ok(s.includes(p), '서두 어투 보존: ' + p));
  assert.ok(s.includes('[청구항*]'), '제3항 식별자는 마스킹됨(내용 차단)');
});

test('★ⓐ 정형 결어 문체 보존', () => {
  const s = sanitize(GYEOLEO);
  assert.ok(!s.includes('[사건특유 문장 생략]'), '결어 보존');
  ['이상과 같이', '명백하다', '앙망하는 바'].forEach((p) => assert.ok(s.includes(p), '결어 어투: ' + p));
});

test('★ⓐ 정형 조문 어투 보존(제N항만 마스킹)', () => {
  const s = sanitize(JOMUN);
  assert.ok(!s.includes('[사건특유 문장 생략]'), '조문 문장 보존');
  ['규정에 의하면', '통상의 기술자'].forEach((p) => assert.ok(s.includes(p), '조문 어투: ' + p));
});

// ─── ⓑ 연결어 보호 ───

test('★ⓑ 연결어 보호 — "인용발명으로부터" 의 부 가 마스킹되지 않음', () => {
  const s = sanitize(CONNECT);
  assert.ok(s.includes('으로부터'), '으로부터 보존');
  assert.ok(!s.includes('[구성*]터'), '[구성*]터 훼손 없음');
});

test('★ⓑ 진짜 구성명사(~부)는 여전히 마스킹', () => {
  // 단독 구성명사 문장(고유 마커 없음 → redact 아님, 마스킹 적용 확인)
  const s = sanitize('상기 보정부와 검출부는 신호를 처리합니다.');
  assert.ok(s.includes('[구성*]'), '보정부/검출부 → [구성*] 마스킹 유지');
  assert.ok(!s.includes('보정부') && !s.includes('검출부'), '구성명사 누출 0');
});

// ─── ★ 진짜 오염 차단 유지 (#190 보존) ───

test('★ 내용 누수 0 — 고유 마커+기술/도메인 문장은 여전히 redact', () => {
  const s = sanitize(LEAK_CLAIM + '\n' + LEAK_CITED);
  ['가중 보정부', '소셜미디어 콘텐츠', '제어회로', '120℃'].forEach((p) =>
    assert.ok(!s.includes(p), '누수 0: ' + p));
  assert.equal((s.match(/\[사건특유 문장 생략\]/g) || []).length, 2, '고유 문장 2개 redact');
});

test('★ 서두 보존 ↔ 오염 차단 양립 — 혼합 양식', () => {
  const s = sanitize([SEODU, JOMUN, GYEOLEO, CONNECT, LEAK_CLAIM, LEAK_CITED].join('\n'));
  // 서두·결어·조문·연결어 문체 생존
  ['귀청께서는', '앙망하는 바', '규정에 의하면', '으로부터'].forEach((p) =>
    assert.ok(s.includes(p), '문체 생존: ' + p));
  // 고유 기술/도메인 차단
  ['가중 보정부', '소셜미디어 콘텐츠'].forEach((p) => assert.ok(!s.includes(p), '오염 차단: ' + p));
});

// ─── #190 회귀 0 (forbiddenSpans/validate 불변) ───

test('#190 회귀 0 — forbiddenSpans 추출: 정형 제외·고유 포함 유지', () => {
  const r = Opinion.sanitizeTemplate([SEODU, JOMUN, LEAK_CLAIM, LEAK_CITED].join('\n'), 'inventive_step');
  const joined = r.forbiddenSpans.join(' || ');
  assert.ok(!/특허법 제42조|의견제출통지서|규정에 의하면/.test(joined), '정형(서두·조문)은 forbiddenSpan 아님');
  assert.ok(r.forbiddenSpans.some((x) => x.indexOf('가중 보정부') >= 0 || x.indexOf('소셜미디어') >= 0), '고유는 forbiddenSpan 유지');
});

test('#190 회귀 0 — validate: 정형 서두/조문은 clean, 고유 누수는 high', () => {
  // 정형만
  Opinion.state._templateForbiddenSpans = Opinion.sanitizeTemplate(SEODU + '\n' + JOMUN, 'inventive_step').forbiddenSpans;
  assert.equal(Opinion.validateNoTemplateContamination('귀청께서는 2026.05.01.자로 특허법 제42조 제4항의 의견제출통지서를 발송하였습니다.', 'inventive_step').clean, true, '정형 = clean');
  // 고유 누수
  Opinion.state._templateForbiddenSpans = Opinion.sanitizeTemplate(LEAK_CITED, 'inventive_step').forbiddenSpans;
  assert.equal(Opinion.validateNoTemplateContamination('본원, ' + LEAK_CITED, 'inventive_step').severity, 'high', '고유 누수 = high');
});

// ─── 소스 정합(공유 헬퍼·styleGuide 보강) ───

test('★ _redactMarkerSentences 가 #190 헬퍼(_caseSpecificMarkers) 공유 — 소스', () => {
  assert.match(SRC, /function _redactMarkerSentences[\s\S]*?Opinion\._caseSpecificMarkers\(parts\[i\]\)\.length > 0/, '헬퍼 재사용');
  assert.doesNotMatch(SRC, /var HIGH_SENT =/, '구 HIGH_SENT 제거(정합)');
});

test('ⓒ styleGuide 서두·결어 예시 보강 — 소스', () => {
  assert.match(SRC, /서두·결어 문체 우선 학습/, '서두/결어 학습 지시 추가');
});
