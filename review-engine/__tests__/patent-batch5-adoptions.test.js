/**
 * review-engine/__tests__/patent-batch5-adoptions.test.js
 *
 * ★ 배치 5 — 전수 감사(DIAG-develop-batch-cross-audit.md) 결정 ①~⑤ 채택 구현.
 *   ① 부호계 3종(dupassign·generic_series·claim_support) → _FINAL_ONLY_CHECKS(Step13 주입 제외, 8종).
 *   ② CHK-14 선점 억제 — CHK-13이 같은 (정규화 용어,섹션)을 지목하면 CHK-14 해당 건 억제.
 *   ③ CHK-14 공유어절 게이트 — 명칭구가 확정 명칭과 어절(≥2자) ≥1개 공유할 때만 diff(접미군 게이트는
 *     docA 도1 시스템-접미 진성 소실로 기각 — 실측 근거).
 *   ④ 통합생성 auto-pick(05) _onTitleChanged 경유 — prune 미실행 오탐 경로 차단.
 *   ⑤ D-1 청구항 경고 toast 스로틀 — 다운로드 1클릭(빌드 3회)당 1회.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);

let sandbox; let toasts = [];
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast: (m, t) => toasts.push({ m, t }), escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
const runJSON = (expr) => JSON.parse(run('JSON.stringify(' + expr + ')'));
beforeEach(() => { run('clearAllState()'); toasts = []; });
const checks = (spec, name) => runJSON('validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check===' + JSON.stringify(name) + ';})');

// docA-형 픽스처 — 도1이 "시스템"-접미 구세대 명칭구(진성), 부호표가 구세대 서버 명칭.
const TITLE_NEW = '대사 보존형 서사 구조화 및 콘텐츠 생성 자원 라우팅 서버 및 방법';
const TITLE_OLD = '제작 메모리 기반 적응형 모델 라우팅 서버 및 방법';
const DOC_A = '【발명의 명칭】\n' + TITLE_NEW + '\n\n【도면의 간단한 설명】\n도 1은 제작 메모리 기반 적응형 모델 라우팅 시스템의 전체 구성도이다.\n\n【부호의 설명】\n적응형 모델 라우팅 서버 : 100';

// ─────────── ① Step13 주입에서 부호계 3종 제외(8종) ───────────

test('★ ① machineFindingsForReview — dupassign·series·claim_support 미주입 / CHK-6·8·11 잔존', () => {
  const DUP = '동일한 실시예 문단이 여기 그대로 반복되어 나타납니다. 이 문단은 정규화 후에도 오십 자 이상의 길이를 확실히 가지도록 작성된 중복 검증용 문단입니다.';
  run('outputs.step_08 = ' + JSON.stringify(
    '자가보완부(125)는 오류를 보완한다. 재정렬부(125)는 순서를 재정렬한다. 상기 재정렬부는 다음의 수학식 9에 따라 동작한다.\n\n' + DUP + '\n\n' + DUP + '\n\n【수학식 1】\nY = gelu(x) + q\n여기서 x는 입력이다.'
  ) + '; outputs.step_09=""; outputs.step_13_applied="";');
  const out = run('machineFindingsForReview()');
  assert.ok(!/refnum_dupassign/.test(out), '★ dupassign 미주입(본문-단독 치환 리스크 차단)');
  assert.ok(!/refnum_generic_series/.test(out), '★ generic_series 미주입');
  assert.ok(!/claim_support_missing/.test(out), '★ claim_support 미주입(죽은 필터 정리)');
  assert.ok(/paragraph_duplicate|sentence_duplicate/.test(out), '★ CHK-6 중복 주입 유지(자기완결 수정)');
  assert.ok(/math_var_undefined/.test(out), '★ CHK-8 수식변수 주입 유지');
  assert.ok(/math_ref_mismatch/.test(out), '★ CHK-11 math_ref 주입 유지(본문-측 참조문장 수정)');
});
test('★ ① 완성본 검증 자체는 전 종 표출 유지(validateSpecification 무필터)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n자가보완부(125)는 보완하고, 재정렬부(125)는 재정렬한다.';
  assert.equal(checks(spec, 'refnum_dupassign').length, 1, '★ 패널(validateSpecification)에는 dupassign 그대로');
});
test('★ ① _FINAL_ONLY_CHECKS 멤버십 8종', () => {
  ['heading_missing', 'heading_order', 'refnum_consistency', 'term_generation_mismatch', 'title_generation_suspect', 'refnum_dupassign', 'refnum_generic_series', 'claim_support_missing'].forEach(c => {
    assert.equal(run(`_FINAL_ONLY_CHECKS.has(${JSON.stringify(c)})`), true, '★ ' + c);
  });
  assert.equal(run("_FINAL_ONLY_CHECKS.size"), 8, '★ 정확히 8종');
  assert.equal(run("FIXABLE_CHECKS.has('refnum_dupassign')"), false, '★ 자동수정 대상 아님 유지');
});

// ─────────── ② CHK-14 선점 억제 (CHK-13이 같은 (용어,섹션) 지목 시) ───────────

test('★ ② staleTerms 세팅 + docA형 → CHK-13 발화·CHK-14 전부 억제(0)', () => {
  run('outputs.step_02="x"; _onTitleChanged(' + JSON.stringify(TITLE_OLD) + ',' + JSON.stringify(TITLE_NEW) + ')');
  assert.deepEqual(runJSON('_activeStaleTerms()'), ['제작메모리', '적응형모델'], '★ 전제: diff청크 2종 적재');
  const c13 = checks(DOC_A, 'term_generation_mismatch');
  const c14 = checks(DOC_A, 'title_generation_suspect');
  assert.equal(c13.length, 3, '★ CHK-13: 제작메모리@도면설명 + 적응형모델@도면설명·부호표 = 3건(HIGH)');
  assert.equal(c14.length, 0, '★ CHK-14: 동일 (용어,섹션) 전부 선점 억제 → 0건(이중 표출 제거)');
});
test('★ ② stale 비움 → CHK-14 소급 단독 경로 불변(docA형 3건)', () => {
  const c14 = checks(DOC_A, 'title_generation_suspect');
  assert.equal(c14.length, 3, '★ 소급 단독: 제작메모리·적응형모델@도면설명 + 적응형모델@부호표 = 3건');
  assert.ok(c14.some(i => /제작메모리/.test(i.message)), '★ 시스템-접미 진성(제작메모리) 포함 — 접미군 게이트였다면 소실');
  assert.equal(checks(DOC_A, 'term_generation_mismatch').length, 0, '★ CHK-13은 이력 없어 0');
});

// ─────────── ③ CHK-14 공유어절 게이트 ───────────

test('★ ③ 비제목 명칭구("클라우드 저장 시스템", 공유어절 0) → 0 (E-1 오탐면 차단)', () => {
  const spec = '【발명의 명칭】\n대사 보존형 콘텐츠 생성 자원 라우팅 서버 및 방법\n\n【도면의 간단한 설명】\n도 3은 클라우드 저장 시스템과 연동되는 구조를 나타낸 도면이다.';
  assert.equal(checks(spec, 'title_generation_suspect').length, 0, '★ 공유어절 0 → diff 대상 제외');
});
test('★ ③ 세대 변형 명칭구("…적응형 모델 라우팅 시스템", 라우팅 공유) → 통과·발화 유지', () => {
  const spec = '【발명의 명칭】\n' + TITLE_NEW + '\n\n【도면의 간단한 설명】\n도 1은 제작 메모리 기반 적응형 모델 라우팅 시스템의 전체 구성도이다.';
  const iss = checks(spec, 'title_generation_suspect');
  assert.equal(iss.length, 2, '★ 제작메모리 + 적응형모델(시스템 3자<5 제외) — 게이트 통과 확인');
});

// ─────────── ④ 통합생성 auto-pick 명칭 훅 ───────────

test('★ ④ 소스 — auto-pick 대입 직전 _onTitleChanged 경유', () => {
  assert.match(PATENT_SRC, /_onTitleChanged\(selectedTitle, cands\[0\]\.korean\|\|''\)/, '★ 05 auto-pick 훅 배선');
});
test('★ ④ 기능 — 제목 비움→재선택 시나리오에서 prune 정상(staleTerms 오염 0)', () => {
  run('outputs.step_02="x"');
  run('_onTitleChanged("적응형 모델 라우팅 서버","")');   // 제목 비움 — 구제목 청크 적재
  assert.ok(runJSON('_activeStaleTerms()').length >= 1, '★ 전제: 비움 시 구제목 청크 적재');
  run('_onTitleChanged("","적응형 모델 라우팅 서버")');   // auto-pick이 동세대 제목 재선택(훅 경유)
  assert.equal(runJSON('_activeStaleTerms()').length, 0, '★ prune 실행 → 재등장 용어 소거(CHK-13 오탐 경로 차단)');
});

// ─────────── ⑤ D-1 청구항 경고 스로틀 ───────────

test('★ ⑤ 청구항 불연속 문서 build 3회(다운로드 1클릭 등가) → 경고 toast 정확히 1회', () => {
  run('outputs.step_06="【청구항 1】 제어부를 포함하는 서버.\\n【청구항 3】 제1항에 있어서 통신부를 더 포함하는 서버."; selectedTitle="테스트 서버"');
  toasts = [];
  run('buildSpecification();buildSpecification();buildSpecification()');
  assert.equal(toasts.filter(t => /불연속/.test(t.m)).length, 1, '★ 3중 호출 → 1회(1.5초 윈도우 스로틀)');
});
test('★ ⑤ 소스 — 스로틀 배선(_claimWarnAt) + 판정 로직 유지', () => {
  assert.match(PATENT_SRC, /let _claimWarnAt=0;/, '★ 스로틀 타임스탬프');
  assert.match(PATENT_SRC, /_cwShow=\(_cwNow-_claimWarnAt\)>1500/, '★ 1.5초 윈도우');
  assert.match(PATENT_SRC, /청구항 번호 불연속/, '★ 경고 메시지 유지(로직 무변경, 표시만 억제)');
});
