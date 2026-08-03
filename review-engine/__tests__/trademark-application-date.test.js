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

// ═══════════ 5) ★ 실증 재현 2차 — PDF 꼬리말 제거가 본문 출원일자를 삭제하던 버그 ═══════════
//   증상: 우선심사 화면 출원일 칸이 빈 값이라, 입력칸 placeholder("2024.03.15")가 값처럼 보였다.
//     사용자 신고 = "문서에 2024-03-15가 아예 없는데 출원일을 잘못 읽어온다".
//   원인: TM.extractFromPDF 의 꼬리말 제거가 /\s+\d{4}\.\d{2}\.\d{2}\s*/ 로 날짜를 무맥락 전면 삭제 →
//     출원번호통지서 본문의 「출 원 일 자  2026.08.03」까지 파싱 전에 사라짐.
//   수정: 꼬리말은 "쪽번호+날짜"가 연속인 덩어리일 때만 제거(TM.stripKipoFooter).
//   ※ 아래 두 fixture 는 실제 업로드 PDF(26T01171)에서 pdf.js 3.11.174 로 추출한 원문이다.

const REAL_NOTICE_PAGE = '관 인 생 략  출 원 번 호 통 지 서  출   원   일   자   2026.08.03  특   기   사   항   참조번호(26T01171)  출   원   번   호   40-2026-0158117 (접수번호 1-1-2026-0943974-42)  출 원 인   성 명   김현규(4-2026-060400-5)  대 리 인   성 명   노재일(9-2018-000107-3)  지   식   재   산   처   장';
const REAL_APPFORM_PAGE = '【서지사항】  【서류명】   상표등록출원서  【출원구분】   상표등록출원  【출원인】  【성명】   김현규  【특허고객번호】   4-2026-060400-5  【참조번호】   26T01171  【상품류】   제30류  【수수료】  【출원료】   1   개류   52,000   원  3-1  2026-08-03';

const strip = (t) => run(`TM.stripKipoFooter(${JSON.stringify(t)})`);

test('★ 실증 2-A — 실제 통지서: 꼬리말 제거 후에도 본문 출원일자가 살아남는다', () => {
  const cleaned = strip(REAL_NOTICE_PAGE);
  assert.ok(cleaned.includes('2026.08.03'), '★ 본문 출원일자 보존(종전엔 전면 삭제되어 사라짐)');
  assert.strictEqual(dateOf(cleaned), '2026.08.03', '★ 전 경로(꼬리말 제거→추출)에서 정확한 출원일');
});

test('★ 실증 2-B — 실제 출원서: 꼬리말(쪽번호+날짜)은 제거되어 출원일로 오채택되지 않는다', () => {
  const cleaned = strip(REAL_APPFORM_PAGE);
  assert.ok(!cleaned.includes('2026-08-03'), '★ 꼬리말 날짜 제거');
  assert.ok(!/\s3-1(\s|$)/.test(cleaned), '★ 쪽번호 제거');
  assert.strictEqual(dateOf(cleaned), '', '★ 출원일 없는 문서 → 빈 값(꼬리말 날짜 오채택 금지)');
  assert.ok(cleaned.includes('제30류'), '★ 상품류 등 본문은 보존');
});

test('★ 회귀 — 꼬리말 제거가 출원번호·접수번호 등 번호열을 훼손하지 않음', () => {
  const cleaned = strip(REAL_NOTICE_PAGE);
  assert.ok(cleaned.includes('40-2026-0158117'), '★ 출원번호 보존');
  assert.ok(cleaned.includes('1-1-2026-0943974-42'), '★ 접수번호 보존');
  assert.ok(cleaned.includes('4-2026-060400-5'), '★ 특허고객번호 보존');
  const r = JSON.parse(run(`JSON.stringify(TM.parseApplicationTextRegex(${JSON.stringify(cleaned)}))`));
  assert.strictEqual(r.applicationNumber, '40-2026-0158117', '★ 출원번호 파싱 정상');
  assert.strictEqual(r.applicationDate, '2026.08.03', '★ 출원일 파싱 정상');
});

test('★ 소스 — extractFromPDF 가 무맥락 날짜 전면 삭제를 더 이상 하지 않는다', () => {
  assert.ok(!/\\s\+\\d\{4\}\\\.\\d\{2\}\\\.\\d\{2\}\\s\*\/g, ' '\)/.test(TM_SRC), '★ 무맥락 YYYY.MM.DD 삭제 제거됨');
  assert.match(TM_SRC, /TM\.stripKipoFooter = function/, '★ 꼬리말 제거가 테스트 가능한 함수로 분리');
  assert.match(TM_SRC, /const cleanedPageText = TM\.stripKipoFooter\(pageText\);/, '★ extractFromPDF 가 해당 함수 사용');
});
