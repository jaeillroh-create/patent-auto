/**
 * review-engine/__tests__/patent-edit-dedup-global.test.js
 *
 * ★ 오염 생산측 예방 FIX-A/B/C (진단 §3-B). Item2 validateSpecification 안전망 위에서 생산 자체를 봉쇄.
 *   FIX-A(05): applyEditInstructions 중복 삽입 방지 전역화 — 국소창(±500·첫50자) → 정규화 전역 검색 + 장문 문장 과반 중복 skip.
 *   FIX-B(06): fuzzyFindAnchor 4·5차 부분매칭 사후 검증(bigram Dice) — 오매칭·오프셋 어긋남 무효화, 정상 부분편집은 통과.
 *   FIX-C(03): sanitizeDescFigureRefs crude 수학식 정규식 → stripMathBlocks 통일(일반 문단 보존, 중복 구현 제거).
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
const applyEdits = (orig, edits) => call('applyEditInstructions(' + JSON.stringify(orig) + ',' + JSON.stringify(edits) + ')');
const fuzzy = (text, anchor) => call('fuzzyFindAnchor(' + JSON.stringify(text) + ',' + JSON.stringify(anchor) + ')');
const sanitize = (text, type) => call('sanitizeDescFigureRefs(' + JSON.stringify(text) + ',' + JSON.stringify(type) + ')');
const vSpec = (txt) => JSON.parse(call('JSON.stringify(validateSpecification(' + JSON.stringify(txt) + '))'));
const occ = (hay, needle) => hay.split(needle).length - 1;

// ─────────── FIX-A: 중복 삽입 방지 전역화 ───────────

const ANCHOR = '통신부(110)가 외부로부터 데이터를 수신한다';
const FILLER = [
  '한편, 상기 통신부는 유선 통신 모듈 또는 무선 통신 모듈 중 적어도 하나를 포함할 수 있고, 상기 무선 통신 모듈은 근거리 무선 통신 규격 및 이동 통신 규격을 지원하도록 구성될 수 있다.',
  '이러한 구성에 의하여 다양한 네트워크 환경에서 안정적인 데이터 송수신이 가능해지고 전체 시스템의 상호운용성이 향상되는 효과가 있으며 이는 종래 기술 대비 현저한 개선점에 해당한다.',
  '또한 상기 통신부는 수신 감도를 자동으로 조절하는 이득 제어 회로를 더 포함할 수 있고, 상기 이득 제어 회로는 주변 잡음 수준을 주기적으로 측정하여 측정된 잡음 수준에 따라 증폭 이득을 동적으로 변경한다.',
  '이에 따라 저전력 환경에서도 신뢰성 있는 통신 링크가 확보되고 배터리 소모가 감소하는 부가적인 이점이 제공되며 사용자 편의성이 크게 개선된다.',
  '아울러 상기 통신부는 복수의 안테나를 통해 수신되는 신호를 결합하는 다이버시티 결합기를 포함할 수 있으며 이를 통해 페이딩 환경에서의 수신 성능이 현저히 개선되고 통신 두절 확률이 낮아진다.',
].join(' '); // >500자 — BLOCK_X 가 앵커 ±500 창 밖에 위치하도록
const BLOCK_X = '프로세서(120)는 수신된 데이터를 분석하여 신뢰도 점수를 산출하고, 산출된 신뢰도 점수를 미리 설정된 임계값과 비교하여 최종 결과를 출력부로 전달한다.';
const ORIG = '도 1을 참조하면, ' + ANCHOR + '.\n\n' + FILLER + '\n\n' + BLOCK_X;

test('FIX-A ★ 창 밖 원본 블록 재서술(26P1036형) — 앵커 뒤 중복 삽입 차단', () => {
  assert.ok(ORIG.indexOf(BLOCK_X) - ORIG.indexOf(ANCHOR) > 500, '전제: 원본 블록이 앵커에서 ±500자 밖');
  const out = applyEdits(ORIG, [{ anchor: ANCHOR, action: 'ADD_AFTER', content: BLOCK_X, reason: 'x' }]);
  assert.equal(occ(out, '신뢰도 점수를 산출하고'), 1, '★ 전역 정규화 dedup — 블록 1회만(사본 삽입 안 됨)');
  // 안전망 교차: 결과에 문단 중복 CRITICAL 없음
  assert.ok(!vSpec(out).some(i => i.check === 'paragraph_duplicate'), '★ validateSpecification 문단중복 0');
});

test('FIX-A ★ 장문 CONTENT 문장 과반 중복 — 블록 재서술 차단(경로2)', () => {
  const s1 = '상기 프로세서는 입력된 신뢰도 값을 기반으로 최종 점수를 순차적으로 산출한다.';
  const s2 = '산출된 최종 점수는 미리 설정된 임계값과 대비되어 판정에 활용된다.';
  const s3 = '판정 결과는 출력부를 통해 외부 장치로 실시간으로 전달된다.';
  const orig2 = '도 2를 참조하면, ' + ANCHOR + '.\n\n' + FILLER + '\n\n' + s1 + ' ' + s2 + ' ' + s3;
  const content = '한편 부가적으로 다음을 더 설명한다. ' + s1 + ' ' + s2 + ' ' + s3; // 첫60자 다르나 3문장 기존재
  const out = applyEdits(orig2, [{ anchor: ANCHOR, action: 'ADD_AFTER', content, reason: 'x' }]);
  assert.equal(occ(out, '최종 점수를 순차적으로 산출한다'), 1, '★ 과반 중복 문장 재삽입 안 됨');
  assert.ok(out.indexOf('한편 부가적으로 다음을 더 설명한다') < 0, '★ 블록 재서술 전체 skip');
});

test('FIX-A ★ 음성 — 신규 문장 ADD_AFTER 는 정상 삽입(과도 차단 아님)', () => {
  const fresh = '상기 통신부(110)는 수신된 데이터를 버퍼에 임시 저장하는 저장 모듈을 더 포함한다.';
  const out = applyEdits(ORIG, [{ anchor: ANCHOR, action: 'ADD_AFTER', content: fresh, reason: 'x' }]);
  assert.match(out, /버퍼에 임시 저장하는 저장 모듈을 더 포함한다/, '★ 신규 문장 정상 삽입');
});

// ─────────── FIX-B: fuzzyFindAnchor 4·5차 사후 검증 ───────────

test('FIX-B ★ 꼬리 20자만 우연 일치·오프셋 어긋남(5차) → 무효(-1)', () => {
  // 앞부분 전혀 다름(1~4차 실패) + 꼬리 20자가 무관한 위치에 우연 등장(5차 오매칭 유발).
  const anchor = '제1 모듈은 신뢰도 값을 산출하고 제2 모듈은 이를 검증하여 결과를 출력부로 전달한다';
  const text = '완전히 무관한 서두 문장이 여기에 길게 이어지고 별개의 기능을 수행하는 장치가 동작하며 마지막으로 오류 결과를 출력부로 전달한다.';
  assert.equal(fuzzy(text, anchor), -1, '★ 5차 후보창 Dice 임계 미달 → 오매칭 무효화(오프셋 어긋남 차단)');
});

test('FIX-B ★ 음성 — 정확 매칭(1차)은 정위치 반환(게이트 무영향)', () => {
  const anchor = '프로세서(120)는 데이터를 분석한다';
  const text = '도 1을 참조하면, ' + anchor + '. 이후 결과를 출력한다.';
  assert.equal(fuzzy(text, anchor), text.indexOf(anchor), '★ 1차 정확 매칭 그대로');
});

test('FIX-B ★ 음성 — 앞부분만 편집된 정상 부분매칭(5차)은 통과(과도 거부 아님)', () => {
  const anchor = '초기 신뢰도 값에 기반하여 시계열 변화에 따라 가중치를 실시간으로 재산출한다';
  const text = '앞 문장이다. 갱신된 신뢰도 값에 기반하여 시계열 변화에 따라 가중치를 실시간으로 재산출한다. 뒤 문장이다.'; // 앞부분(초기→갱신된)만 변경
  assert.ok(fuzzy(text, anchor) >= 0, '★ 대부분 일치(Dice≥0.5) → 5차 위치 반환(부분편집 허용)');
});

// ─────────── FIX-C: sanitizeDescFigureRefs 수학식 제거 통일 ───────────

test('FIX-C ★ 수학식 뒤 일반 문단 보존(crude 정규식은 삼키던 "…부(133)는…")', () => {
  // 일반 문단은 수학식 블록과 빈 줄(\n\n)로 분리 — crude 정규식은 이후 비키워드 줄을 계속 삼켜 소실시키나
  // stripMathBlocks 는 빈 줄에서 종결하여 보존.
  const text = '도 1을 참조하면, 통신부(110)가 동작한다.\n\n【수학식 1】\nF=ma\n여기서 F는 힘이다.\n\n그래프 캐시 저장부(133)는 데이터를 저장한다.';
  const out = sanitize(text, 'device');
  assert.ok(out.indexOf('【수학식 1】') < 0, '★ 수학식 블록 제거');
  assert.match(out, /그래프 캐시 저장부\(133\)는 데이터를 저장한다/, '★ 뒤따르는 일반 문단 보존(FIX-C 핵심)');
  assert.match(out, /통신부\(110\)가 동작한다/, '★ 앞 본문 보존');
});

test('FIX-C ★ 회귀 — 도면 소개문 보존 + 수학식만 제거', () => {
  const text = '도 3은 방법 흐름도이다.\n\n【수학식 2】\nE=mc²\n여기서 E는 에너지이다.\n\n프로세서(120)는 연산을 수행한다.';
  const out = sanitize(text, 'device');
  assert.match(out, /도 3은 방법 흐름도이다/, '★ 도면 소개문 유지');
  assert.ok(out.indexOf('E=mc²') < 0, '★ 수식 제거');
  assert.match(out, /프로세서\(120\)는 연산을 수행한다/, '★ 일반 문단 유지');
});

// ─────────── 소스 어서션 ───────────

test('소스 ★ FIX-A/B/C 마커 + stripMathBlocks 통일 + 랜드마인 회피', () => {
  assert.match(PATENT_SRC, /FIX-A: 중복 삽입 방지 전역화/, '★ FIX-A');
  assert.match(PATENT_SRC, /FIX-B[\s\S]*?bigram Dice/, '★ FIX-B');
  assert.match(PATENT_SRC, /function _anchorBigramDice\(a,b\)\{/, '★ Dice 헬퍼');
  assert.match(PATENT_SRC, /FIX-C[\s\S]*?stripMathBlocks\(text\)\.trim\(\)/, '★ FIX-C stripMathBlocks 통일');
  assert.ok(!/segmentsIntersect|선분 교차 검사/.test(PATENT_SRC), '★ 랜드마인 문자열 없음');
});
