/**
 * review-engine/__tests__/patent-figure-title-sync.test.js
 *
 * ★ ① 예시도 SVG 제목 동기화 — 제목 【도 N】을 ★코드가 computeFigNums(SoT) 값으로 강제★(mermaid 8082 방식).
 *   LLM 이 쓴 잘못된 제목은 제거 후 교체. 렌더/다운로드 시점 적용 → SoT 바뀌면(③ 순서지정) 제목 자동 추종.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getReviewAuth: () => ({ keys: {}, assignments: {} }), getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' } };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const applyTitle = (svg, fn) => vm.runInContext('_conceptSvgApplyTitle(' + JSON.stringify(svg) + ',' + JSON.stringify(fn) + ')', sandbox, { filename: 'c.js' });

const SVG_NO_TITLE = '<svg viewBox="0 0 680 500"><rect width="680" height="500" fill="#fff"/><text>검색창(31)</text></svg>';
const SVG_WRONG_TITLE = '<svg viewBox="0 0 680 500"><text x="340" y="20" font-size="14">【도 4】</text><rect/><text>검색창(31)</text></svg>';

test('★ 코드가 제목 삽입 — figNum으로 【도 N】 오버레이(여는 <svg> 직후 상단)', () => {
  const out = applyTitle(SVG_NO_TITLE, 5);
  assert.match(out, /【도 5】/, '【도 5】 삽입');
  assert.match(out, /<svg\b[^>]*><text\b[^>]*>【도 5】<\/text>/, '★ 여는 <svg> 직후 제목 오버레이');
  assert.ok(out.indexOf('검색창(31)') >= 0, '본문(부호) 보존');
});

test('★ LLM 잘못된 제목 제거 후 교체 — 도4 → 도5(라벨과 일치)', () => {
  const out = applyTitle(SVG_WRONG_TITLE, 5);
  assert.match(out, /【도 5】/, '코드 제목 도5');
  assert.ok(out.indexOf('【도 4】') < 0, '★ LLM 제목 【도 4】 제거됨(불일치 해소)');
});

test('★ SoT 추종 — figNum 바뀌면 제목 자동 변경(③ 순서지정 대비)', () => {
  assert.match(applyTitle(SVG_NO_TITLE, 3), /【도 3】/, 'figNum 3');
  assert.match(applyTitle(SVG_NO_TITLE, 7), /【도 7】/, 'figNum 7');
  // 같은 SVG 라도 figNum 따라 제목이 달라짐(SoT 단일 추종)
  assert.ok(applyTitle(SVG_NO_TITLE, 3).indexOf('【도 7】') < 0, '도3 결과에 도7 없음');
});

test('★ 이중 제목 방지(멱등) — 코드 제목 있는 것 재적용해도 1개', () => {
  const once = applyTitle(SVG_NO_TITLE, 5);
  const twice = applyTitle(once, 5);
  assert.equal((twice.match(/【도 5】/g) || []).length, 1, '★ 제목 1개(멱등)');
});

test('★ 비-SVG 입력 → 그대로(무해)', () => {
  assert.equal(applyTitle('그냥 텍스트', 5), '그냥 텍스트', '비-SVG 불변');
  assert.equal(applyTitle('', 5), '', '빈 문자열');
});

// ── 소스 정합 ──

test('★ 소스 — 프롬프트 "제목 넣지 마라"(코드 삽입) + 렌더·다운로드 _conceptSvgApplyTitle 사용', () => {
  // 프롬프트: LLM 제목 작성 금지(코드가 삽입)
  assert.match(PATENT_SRC, /제목\(【도 N】\)은 코드가 자동으로 삽입하므로 ★SVG에 도면 제목 텍스트를 넣지 마라/, '★ 프롬프트 제목 작성 금지');
  // 렌더: ct.svgContent 직삽입 대신 _conceptSvgForDisplay(제목+식별번호) 경유 — refnum-svg 에서 통합 헬퍼로
  assert.match(PATENT_SRC, /\$\{_conceptSvgForDisplay\(ct, figNum\)\}/, '★ 렌더 통합 표시(제목+식별번호)');
  // 통합 헬퍼가 제목 SoT 적용(식별번호 위에)
  assert.match(PATENT_SRC, /_conceptSvgApplyTitle\(_conceptSvgApplyRefNums\(/, '★ 제목 SoT 유지(식별번호 render 위에)');
  // 렌더1+다운로드2 = 3곳 _conceptSvgForDisplay (정의 제외 — function 키워드 lookbehind)
  assert.equal((PATENT_SRC.match(/(?<!function )_conceptSvgForDisplay\(ct, figNum\)/g) || []).length, 3, '★ 렌더1+다운로드2 = 3곳 동기화');
  // SoT 추종 명문화(주석)
  assert.match(PATENT_SRC, /computeFigNums\(SoT\)|SoT\(getAutoFigNums\)/, 'SoT 추종 주석');
});

test('★ 회귀 0 — svgContent 자체는 미변형(렌더 시점 변환), 부호·정련 유지', () => {
  // _conceptSvgApplyTitle 은 입력 문자열을 변형해 반환할 뿐, ct.svgContent 를 직접 mutate 하지 않음
  assert.ok(!/_conceptSvgApplyTitle[^;]*ct\.svgContent\s*=/.test(PATENT_SRC), 'ct.svgContent 직접 대입 없음(렌더 변환만)');
  // refMap·refine(P5)·생성(SVG-direct) 유지
  assert.match(PATENT_SRC, /Patent\.refineConceptDiagram\s*=/, 'P5 정련 유지');
  assert.match(PATENT_SRC, /SVG 코드로 직접 생성하라/, 'SVG-direct 생성 유지');
});
