/**
 * review-engine/__tests__/patent-batch15j-refname-parse.test.js
 * ★ 배치 15J — 부호표 명칭 앞글자 유실(단일 근본 버그) 파싱 수정.
 *   실증(docI): 분량 표준/상세에서 절단은 해소됐으나 부호표 명칭이 앞 1글자 유실(잘린 명칭이 정상 명칭과
 *   충돌 → dupassign HIGH 10 + term_mismatch 파생). 원인: _collectBodyRefPairs 의 [가-힣\s]{0,12}? char cap
 *   → 14자↑ 장문 명칭에서 캡처 시작이 뒤로 밀려 앞글자 유실. 부수적으로 조사·"내지" junk 포섭.
 *   수정: char cap 제거(단어 그룹) + 선행 비명칭 토큰 제거(_cleanRefName) + 앞글자 유실 사후교정(_reconcileRefName).
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);

let sandbox; const els = {};
const mkEl = () => ({ value: '', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {}, updateStats() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, updateStats() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true, API_KEY: 'stub',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); run('clearAllState();'); });

// docI 재현 본문 — 14자↑ 장문 명칭 4종 + 조사/도면참조/"내지" junk 선행 + 예시도 요소(범위표기).
const DOCI_BODY = '도 1을 참조하면, 상기 대사 보존형 서사 구조화부(111)는 추가 후보 레지스트리부(113)와 '
  + '멀티모달 제작자원 라우팅부(114) 및 품질 검증부(115)를 포함한다. '
  + '도 5의 UI 화면 요소(57) 내지 사용자 시나리오 요소(66)가 표시되고, 제어부(100)가 이를 제어한다.';
const WANT = { 111: '대사 보존형 서사 구조화부', 113: '추가 후보 레지스트리부', 114: '멀티모달 제작자원 라우팅부', 115: '품질 검증부', 57: 'UI 화면 요소', 66: '사용자 시나리오 요소', 100: '제어부' };

function setBody() {
  run(`clearAllState(); selectedTitle='서사 생성 시스템'; outputs={ step_06:'【청구항 1】 장치.', step_08:${JSON.stringify(DOCI_BODY)} };`);
}

// ─────────────── 1) _collectBodyRefPairs 전체형 명칭 추출 ───────────────

test('15J ★ — _collectBodyRefPairs: 14자↑ 장문 명칭 앞글자 유실 없이 전체형 추출', () => {
  setBody();
  const pairs = JSON.parse(run('JSON.stringify(_collectBodyRefPairs())'));
  const got = {}; pairs.forEach(p => { got[p.ref] = p.name; });
  for (const ref of Object.keys(WANT)) {
    assert.strictEqual(got[ref], WANT[ref], `★ (${ref}) 전체형 명칭 — 앞글자 유실 없음`);
  }
});

test('15J ★ — 추출 명칭 중복 없음(dupassign 0: 잘린 명칭 충돌 소멸)', () => {
  setBody();
  const pairs = JSON.parse(run('JSON.stringify(_collectBodyRefPairs())'));
  const names = pairs.map(p => p.name);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.strictEqual(dup.length, 0, '★ 명칭 중복 0(앞글자 유실로 인한 충돌 없음): ' + dup.join(', '));
});

test('15J ★ — 선행 junk 제거: 도면참조·조사·"내지"·지시어가 명칭에 혼입되지 않음', () => {
  setBody();
  const pairs = JSON.parse(run('JSON.stringify(_collectBodyRefPairs())'));
  pairs.forEach(p => {
    assert.ok(!/^(?:도\s*\d|내지|상기|그리고|이때|이는)\b/.test(p.name), `★ (${p.ref}) junk 미혼입: "${p.name}"`);
    assert.ok(!/^[는은을를와과의에로도만]\s/.test(p.name), `★ (${p.ref}) 선행 조사 미혼입: "${p.name}"`);
  });
});

// ─────────────── 2) _cleanRefName 단위 ───────────────

test('15J ★ — _cleanRefName: 선행 비명칭 토큰 반복 제거', () => {
  assert.strictEqual(run(`_cleanRefName('상기 대사 보존형 서사 구조화부')`), '대사 보존형 서사 구조화부', '★ 상기 제거');
  assert.strictEqual(run(`_cleanRefName('도 5의 UI 화면 요소')`), 'UI 화면 요소', '★ 도면참조 제거');
  assert.strictEqual(run(`_cleanRefName('내지 사용자 시나리오 요소')`), '사용자 시나리오 요소', '★ 범위어 제거');
  assert.strictEqual(run(`_cleanRefName('는 품질 검증부')`), '품질 검증부', '★ 선행 조사 제거');
  assert.strictEqual(run(`_cleanRefName('제어부')`), '제어부', '★ 클린 명칭 보존');
});

// ─────────────── 3) _reconcileRefName 사후 안전망(앞글자 유실 교정) ───────────────

test('15J-4 ★ — _reconcileRefName: refMap 앞글자 유실 시 본문 전체형 채택', () => {
  // 잘린 refMap 명칭(앞 1자 유실) vs 본문 전체형 → 전체형 채택
  assert.strictEqual(run(`_reconcileRefName('사 보존형 서사 구조화부','대사 보존형 서사 구조화부')`), '대사 보존형 서사 구조화부', '★ 앞 1자 복원');
  // 동일하면 그대로
  assert.strictEqual(run(`_reconcileRefName('제어부','제어부')`), '제어부', '★ 동일 유지');
  // 단어 단위 over-capture(공백 포함 접두)는 채택하지 않음(refMap 우선)
  assert.strictEqual(run(`_reconcileRefName('신뢰도 가중부','이는 신뢰도 가중부')`), '신뢰도 가중부', '★ 단어 over-capture 거부(공백 접두)');
  // refMap 비면 body
  assert.strictEqual(run(`_reconcileRefName('','제어부')`), '제어부', '★ refMap 공백 → body');
});

// ─────────────── 4) _deriveSignDescription 통합(refMap 잘림 → 최종 부호표 전체형) ───────────────

test('15J ★ — _deriveSignDescription: refMap 앞글자 유실을 본문 기준으로 교정한 최종 부호표', () => {
  setBody();
  // refMap 이 앞글자 유실된 채로 넘어와도(잘린 명칭) 최종 부호표는 본문 전체형으로 교정
  const s18 = run(`_deriveSignDescription(new Map([['111','사 보존형 서사 구조화부'],['113','가 후보 레지스트리부'],['114','티모달 제작자원 라우팅부'],['115','품질 검증부'],['100','제어부'],['57','UI 화면 요소'],['66','사용자 시나리오 요소']]))`) || '';
  assert.ok(/대사 보존형 서사 구조화부 : 111/.test(s18), '★ 111 전체형 복원');
  assert.ok(/추가 후보 레지스트리부 : 113/.test(s18), '★ 113 전체형 복원');
  assert.ok(/멀티모달 제작자원 라우팅부 : 114/.test(s18), '★ 114 전체형 복원');
  // 잘린 형태가 남지 않음
  assert.ok(!/(?:^|\n)사 보존형/.test(s18) && !/(?:^|\n)가 후보/.test(s18) && !/(?:^|\n)티모달/.test(s18), '★ 잘린 명칭 잔존 없음');
  // 부호표 명칭 중복 없음
  const names = s18.split('\n').filter(Boolean).map(l => l.split(' : ')[0]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.strictEqual(dup.length, 0, '★ 최종 부호표 명칭 중복 0');
});

// ─────────────── 소스 정합 ───────────────

test('15J 소스 ★ — 명칭 캡처 정규식에서 char cap 제거(단어 그룹) + _cleanRefName 배선', () => {
  assert.match(PATENT_SRC, /function _cleanRefName\(n\)\{/, '★ _cleanRefName 정의');
  assert.match(PATENT_SRC, /function _reconcileRefName\(refName, ?bodyName\)\{/, '★ _reconcileRefName 정의');
  // _collectBodyRefPairs·term_mismatch 검출 두 곳 모두 char cap 제거 → 단어 그룹 정규식 사용(앞글자 유실 차단)
  assert.ok((PATENT_SRC.match(/\(\?:\\s\+\[가-힣[^\]]*\]\+\)\{0,7\}/g) || []).length >= 2, '★ 단어 그룹 정규식 2곳 이상(부호표 추출·명칭 불일치 검출)');
  // 실제 코드(주석 제외)에 {0,12}? char cap 명칭 캡처가 남지 않음 — 정규식 리터럴 형태로 확인
  assert.ok(!/\/\([가-힣A-Za-z]\[가-힣A-Za-z\\s\]\{0,12\}\?\)/.test(PATENT_SRC), '★ {0,12} char cap 명칭 캡처 정규식 리터럴 제거(주석 설명 문자열 제외)');
});
