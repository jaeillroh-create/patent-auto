/**
 * review-engine/__tests__/trademark-application-date.test.js
 * ★ 상표 우선심사 — 출원번호통지서 출원일 오추출 수정(실증 재현 고정).
 *   증상: 우선심사 신청 시 출원일이 잘못 추출됨.
 *   원인: TM.parseApplicationTextRegex 의 날짜 정규식 /(\d{4})[.\s-]*(\d{2})[.\s-]*(\d{2})/ 가 무맥락 첫 매칭이라
 *     - 출원번호 "40-2025-0097799" → "2025.00.97" (월 00·일 97, 불가능한 날짜)
 *     - 접수번호 "1-1-2025-0612345-01" → "2025.06.12" (그럴듯하지만 틀림 — 더 위험)
 *     KIPO 출원번호통지서는 출원번호가 출원일자보다 먼저 나오므로 사실상 항상 오추출.
 *   악화 요인: parseApplicationText 가 출원번호+상품류만 보고 조기 반환 → AI 보완 기회 없음.
 *     merge 시에도 정규식 값 우선이라 "비어있지 않은 틀린 날짜"는 AI 가 교정하지 못함.
 *   수정: 번호류 마스킹 → 「출원일(자)」 라벨 앵커 → 유효성 검증(연/월/일 + 실재 날짜) 3중.
 *     출원일도 핵심 필드에 포함해 실패 시 AI 폴백 활성화 + AI 날짜도 검증 후 채택.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readTrademarkBundle } from './helpers/trademarkBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const TM_SRC = readTrademarkBundle(REPO);

let sandbox;
const mkEl = () => ({ value: '', checked: false, disabled: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const App = {
    sb: { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} }, storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } },
    callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '',
    escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, ensureApiKey() { return true; }, setButtonLoading() {}, currentUser: { id: 'u1' },
  };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error, encodeURIComponent, decodeURIComponent,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => mkEl(), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {}, body: mkEl() },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    alert() {}, confirm: () => true, prompt: () => null,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(TM_SRC, sandbox, { filename: 'trademark.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
const dateOf = (text) => run(`TM.extractApplicationDate(${JSON.stringify(text)})`);

const EXPECT = '2025.06.09';

// ═══════════ 1) 실증 재현 — 출원번호/접수번호에서 날짜 오추출 소멸 ═══════════

test('★ 실증 A — 표준 통지서(출원번호가 출원일자보다 먼저): 출원번호에서 오추출 안 함', () => {
  const ocr = '특허청 출원번호통지서\n【출원번호】 40-2025-0097799\n【출원일자】 2025.06.09\n【출원인】 삼인시스템 주식회사\n【상품류】 제09류';
  const got = dateOf(ocr);
  assert.strictEqual(got, EXPECT, '★ 출원일자 라벨의 날짜를 채택(종전 "2025.00.97" 오추출)');
  assert.ok(!/00|97/.test(got.slice(5)), '★ 출원번호 조각(00·97) 미혼입');
});

test('★ 실증 B — OCR 공백 붕괴형("출 원 일 자")도 라벨 인식', () => {
  const ocr = '출원번호통지서 출원번호 40-2025-0097799 출 원 일 자 2025. 06. 09 출원인 삼인시스템 주식회사 제 09 류';
  assert.strictEqual(dateOf(ocr), EXPECT, '★ 공백 붕괴 라벨 앵커 동작');
});

test('★ 실증 C — 접수번호 병기형: "1-1-2025-0612345-01"에서 그럴듯한 오날짜(2025.06.12) 미채택', () => {
  const ocr = '【접수번호】 1-1-2025-0612345-01\n【출원번호】 40-2025-0097799\n【출원일자】 2025.06.09';
  const got = dateOf(ocr);
  assert.strictEqual(got, EXPECT, '★ 접수번호가 아닌 출원일자 채택(종전 "2025.06.12" 오추출)');
});

test('★ 회귀 D — 출원일자가 먼저 나오는 배치도 정상', () => {
  assert.strictEqual(dateOf('【출원일자】 2025.06.09\n【출원번호】 40-2025-0097799'), EXPECT, '★ 정상 케이스 유지');
});

// ═══════════ 2) 날짜 표기 변형 ═══════════

test('★ 표기 — 하이픈 날짜(2025-06-09)는 보존(번호 마스킹에 삼켜지지 않음)', () => {
  assert.strictEqual(dateOf('【출원번호】 40-2025-0097799 【출원일】 2025-06-09'), EXPECT, '★ 하이픈 날짜 유지');
});

test('★ 표기 — 한글 년월일(2025년 6월 9일) / 한자리 월일(2025.6.9) 정규화', () => {
  assert.strictEqual(dateOf('【출원번호】 40-2025-0097799 【출원일자】 2025년 6월 9일'), EXPECT, '★ 년월일 표기');
  assert.strictEqual(dateOf('【출원번호】 40-2025-0097799 【출원일자】 2025.6.9'), EXPECT, '★ 한자리 → 0 패딩');
});

test('★ 표기 — 라벨이 없으면 유효 날짜 폴백(번호 마스킹 후)', () => {
  assert.strictEqual(dateOf('40-2025-0097799 접수 2025.06.09 삼인시스템'), EXPECT, '★ 폴백도 번호 오추출 안 함');
});

// ═══════════ 3) 유효성 검증 ═══════════

test('★ 유효성 — 불가능한 날짜(월 00·일 97·2월 30일)는 채택하지 않음', () => {
  assert.strictEqual(run(`TM.normalizeDateParts('2025','00','97')`), '', '★ 월 00·일 97 배제');
  assert.strictEqual(run(`TM.normalizeDateParts('2025','02','30')`), '', '★ 2월 30일(실재 안 함) 배제');
  assert.strictEqual(run(`TM.normalizeDateParts('1800','06','09')`), '', '★ 연도 범위 밖 배제');
  assert.strictEqual(run(`TM.normalizeDateParts('2025','6','9')`), EXPECT, '★ 유효 날짜는 0 패딩 정규화');
});

test('★ 유효성 — 날짜가 아예 없으면 빈 문자열(허위 날짜 생성 금지)', () => {
  assert.strictEqual(dateOf('【출원번호】 40-2025-0097799 【출원인】 삼인시스템 주식회사'), '', '★ 없으면 빈 값(AI 보완·수동 입력 유도)');
});

// ═══════════ 4) 파서 통합 + AI 폴백 배선 ═══════════

test('★ 통합 — parseApplicationTextRegex 가 올바른 출원일 반환', () => {
  const ocr = '【출원번호】 40-2025-0097799\n【출원일자】 2025.06.09\n【출원인】 삼인시스템 주식회사\n【상품류】 제09류';
  const r = JSON.parse(run(`JSON.stringify(TM.parseApplicationTextRegex(${JSON.stringify(ocr)}))`));
  assert.strictEqual(r.applicationDate, EXPECT, '★ 출원일 정상');
  assert.strictEqual(r.applicationNumber, '40-2025-0097799', '★ 출원번호 회귀 정상');
  assert.strictEqual(r.classCode, '09', '★ 상품류 회귀 정상');
});

test('★ 소스 — 출원일도 핵심 필드(실패 시 AI 폴백) + AI 날짜 유효성 검증', () => {
  assert.match(TM_SRC, /const hasEssentials = regexResult\.applicationNumber && regexResult\.classCode && regexResult\.applicationDate;/, '★ 출원일 포함 → 실패 시 AI 보완');
  assert.match(TM_SRC, /if \(_norm\) merged\.applicationDate = _norm;/, '★ AI 출원일도 정규화 후 채택');
  assert.match(TM_SRC, /console\.warn\('\[TM\] AI 출원일 무효 — 폐기:'/, '★ 무효 AI 날짜 폐기');
});
