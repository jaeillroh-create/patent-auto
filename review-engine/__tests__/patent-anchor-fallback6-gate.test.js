/**
 * review-engine/__tests__/patent-anchor-fallback6-gate.test.js
 *
 * ★ FIX-B 확장 — fuzzyFindAnchor 6차(핵심 키워드 후방 3~4단어 매칭) 사후검증 게이트.
 *   PR #226은 4·5차에만 bigram Dice≥0.5 게이트를 걸었고 6차는 무검증으로 km2.index 반환 → 오매칭 전파 위험.
 *   6차도 매칭된 꼬리 위치에서 앵커 시작을 역추정한 창을 Dice 검증(4·5차 동형). 미달 시 -1(오염보다 삽입 실패가 안전).
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

const fuzzy = (text, anchor) => vm.runInContext('fuzzyFindAnchor(' + JSON.stringify(text) + ',' + JSON.stringify(anchor) + ')', sandbox, { filename: 'c.js' });

// 공통 앵커 — 후방 단어열이 명확한 장문(1~5차 회피 유도용)
const ANCHOR = '제1 처리부는 입력 신호를 변환하여 출력부로 최종 결과를 전달한다';

// ─────────── 6차 게이트 ───────────

test('6차 ★ 오매칭 봉쇄 — 후방 단어만 우연 일치(주변 무관) → -1', () => {
  // 앞부분·본문 전혀 다르고, 앵커 후방 단어열("출력부로 최종 결과를 전달한다")만 무관한 위치에 우연 존재.
  // 1차(정확)·2차(정규화)·3차(앞5단어)·4차(앞20자)·5차(뒤20자 정확) 모두 실패 → 6차 진입 → 게이트가 오매칭 차단.
  const text = '무관한 서두가 길게 이어지며 별개의 장치가 동작하고 마지막에 데이터를 출력부로 최종 결과를 전달한다.';
  assert.equal(fuzzy(text, ANCHOR), -1, '★ 6차 후보창 Dice 미달 → 무효(-1). 게이트 전이면 오매칭 위치 반환했을 것');
});

test('6차 ★ 음성(정상 부분매칭) — 앞부분만 편집·꼬리 구두점 변형 → 6차가 정상 위치 반환', () => {
  // "제1 처리부는" → "본 장치의 처리부는"(앞 편집) + 꼬리에 쉼표 삽입("변환하여, 출력부로").
  // 1차~5차 실패(앞 변경 + 꼬리 20자 정확 슬라이스 깨짐)하나 6차 후방 단어열은 매칭, 전체 유사도 높음 → 통과.
  const text = '본 장치의 처리부는 입력 신호를 변환하여, 출력부로 최종 결과를 전달한다.';
  assert.ok(fuzzy(text, ANCHOR) >= 0, '★ Dice≥0.5 → 정상 부분매칭 위치 반환(6차 과도 거부 아님)');
});

// ─────────── 회귀: 상위 폴백 무관 ───────────

test('회귀 ★ 1차 정확 매칭은 6차 게이트 무관하게 정위치', () => {
  const text = '도 1을 참조하면, ' + ANCHOR + '. 이후 다른 서술이 이어진다.';
  assert.equal(fuzzy(text, ANCHOR), text.indexOf(ANCHOR), '★ 1차 정확 매칭 그대로');
});

test('회귀 ★ 4·5차 기존 게이트 동작 불변 — 앞20자 정상 매칭 통과', () => {
  // 꼬리만 살짝 바뀌어 1~3차 실패하나 앞20자 정확 → 4차 통과(전체 유사도 높음).
  const anchor2 = '신뢰도 기반 동적 가중부는 입력 신뢰도의 시계열 변화에 따라 가중치를 갱신';
  const text = '앞 문장. ' + anchor2 + '하고 결과를 저장한다.'; // 앵커 뒤에 "하고..." 부가(앞20자 동일)
  assert.ok(fuzzy(text, anchor2) >= 0, '★ 4차 정상 부분매칭 유지(FIX-B 회귀)');
});

// ─────────── 소스 어서션 ───────────

test('소스 ★ 6차 폴백에 _anchorBigramDice 게이트 적용', () => {
  assert.match(PATENT_SRC, /6차[\s\S]*?km2\.index-\(anchor\.length-km2\[0\]\.length\)[\s\S]*?_anchorBigramDice\(_aNorm/, '★ 6차 역추정 창 + Dice 게이트');
  // _anchorBigramDice 사용처 = 정의(1) + 4차 + 5차 + 6차 = 최소 4회 등장(6차 추가 확인)
  assert.ok((PATENT_SRC.match(/_anchorBigramDice\(/g) || []).length >= 4, '★ 4·5·6차 모두 Dice 게이트(호출 4회↑)');
});
