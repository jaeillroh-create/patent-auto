/**
 * review-engine/__tests__/patent-batch4-gate-refname.test.js
 *
 * ★ 배치 4 — §6-2 다운로드 게이트 + §6-6 도면요소 부호 실명화.
 *   §6-2: CRITICAL 결함이 있으면 다운로드 전 명시적 확인(confirm) 요구, 취소 시 차단(HIGH 이하는 경고만).
 *   §6-6: 예시도 REF_MAP 실명(에피소드 노드 등)이 부호의 설명에 그대로 연동됨을 확인 —
 *         라벨이 있으면 실명, 없으면(LLM 미응답) 현행 generic 폴백 유지. 프롬프트는 총칭 반복 금지.
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
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() {}, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
const runJSON = (expr) => JSON.parse(run('JSON.stringify(' + expr + ')'));

// 중복 문단(≥50자 정규화) → CHK-6 paragraph_duplicate CRITICAL
const DUP = '동일한 실시예 문단이 여기 그대로 반복되어 나타납니다. 이 문단은 정규화 후에도 오십 자 이상의 충분한 길이를 확실하게 가지도록 작성된 중복 문단입니다.';
const CRIT_SPEC = '【발명을 실시하기 위한 구체적인 내용】\n' + DUP + '\n\n' + DUP;
const CLEAN_SPEC = '【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 데이터를 처리하고 통신부(110)는 데이터를 외부로 전송한다.';

// ─────────── §6-2 다운로드 게이트 ───────────

test('★ §6-2 전제 — 중복 문단 스펙은 CRITICAL(paragraph_duplicate)을 낳는다', () => {
  const crit = runJSON('validateSpecification(' + JSON.stringify(CRIT_SPEC) + ').filter(function(i){return i.severity==="CRITICAL";})');
  assert.ok(crit.length >= 1 && crit.some(i => i.check === 'paragraph_duplicate'), '★ CRITICAL 존재(게이트 발동 조건)');
});
test('★ §6-2 게이트 — CRITICAL + confirm 취소 → 다운로드 차단(false)', () => {
  run('confirm=function(){return false;}');
  assert.equal(run('_downloadGate(' + JSON.stringify(CRIT_SPEC) + ')'), false, '★ 취소 시 차단');
});
test('★ §6-2 게이트 — CRITICAL + confirm 승인 → 진행(true)', () => {
  run('confirm=function(){return true;}');
  assert.equal(run('_downloadGate(' + JSON.stringify(CRIT_SPEC) + ')'), true, '★ "그래도 다운로드" → 진행');
});
test('★ §6-2 게이트 — CRITICAL 없으면 confirm 없이 통과(HIGH 이하는 게이트 무관)', () => {
  let called = false; sandbox.confirm = () => { called = true; return false; };
  assert.equal(run('_downloadGate(' + JSON.stringify(CLEAN_SPEC) + ')'), true, '★ CRITICAL 0 → 무조건 통과');
  assert.equal(called, false, '★ confirm 미호출');
  sandbox.confirm = () => true;
});
test('★ §6-2 배선 — 다운로드 함수가 게이트를 호출(취소 시 return)', () => {
  assert.match(PATENT_SRC, /function _downloadGate\(_spec\)/, '★ 게이트 함수(테스트 가능 시그니처)');
  assert.match(PATENT_SRC, /function downloadAsTxt\(\)\{[\s\S]*?if\(!_downloadGate\(\)\)return;/, '★ txt 게이트');
  assert.match(PATENT_SRC, /if\(!_downloadGate\(\)\)return;\s*\/\/ \[§6-2\]/, '★ word 게이트');
  assert.ok(!/function downloadAsWord\(\)\{[\s\S]{0,160}_warnSpecValidation\(\)/.test(PATENT_SRC), '★ word 경로의 경고-only는 게이트로 대체');
});

// ─────────── §6-6 도면요소 부호 실명화 ───────────

test('★ §6-6 — REF_MAP 실명은 파싱·연동된다(에피소드 노드/사용자 프로필 카드)', () => {
  const seg = '---REF_MAP---\n51: 에피소드 노드\n52: 사용자 프로필 카드\n53: 추천 랭킹표';
  const svg = '<svg><text>(51)</text><text>(52)</text><text>(53)</text></svg>';
  const rm = runJSON('_parseConceptRefMap(' + JSON.stringify(seg) + ',' + JSON.stringify(svg) + ')');
  assert.deepEqual(rm.map(r => r.label), ['에피소드 노드', '사용자 프로필 카드', '추천 랭킹표'], '★ 실명 라벨 캡처');
  const pairs = runJSON('_conceptRefPairs({type:"data_structure",refMap:' + JSON.stringify(rm) + '})');
  assert.deepEqual(pairs.map(p => p.name), ['에피소드 노드', '사용자 프로필 카드', '추천 랭킹표'], '★ refPairs가 실명 사용(폴백 아님)');
  // 부호의 설명 텍스트(step_07c 공유)에 "실명(번호)"으로 반영
  const txt = run('_buildConceptOutputText([{type:"data_structure",briefDesc:"도 5은 ...",refMap:' + JSON.stringify(rm) + '}],[5])');
  assert.ok(/에피소드 노드\(51\)/.test(txt) && /추천 랭킹표\(53\)/.test(txt), '★ 실명 연동(부호표/본문 서술 소스)');
  assert.ok(!/데이터 구조 요소/.test(txt), '★ 실명 있으면 generic 총칭 미사용');
});
test('★ §6-6 폴백 — 라벨 없으면(LLM 미응답) 현행 generic 폴백 유지', () => {
  const rmEmpty = [{ signNumber: '51', label: '' }, { signNumber: '52', label: '' }];
  const pairs = runJSON('_conceptRefPairs({type:"data_structure",refMap:' + JSON.stringify(rmEmpty) + '})');
  assert.ok(pairs.every(p => p.name === '데이터 구조 요소'), '★ 실명 없으면 유형 총칭 폴백(안전)');
});
test('★ §6-6 배선 — 프롬프트가 실명 요구·총칭 반복 금지', () => {
  assert.match(PATENT_SRC, /REF_MAP 필수\(§6-6\)/, '★ 강화 지시');
  assert.match(PATENT_SRC, /유형 총칭을 번호마다 반복하지 마라/, '★ 총칭 반복 금지');
  assert.match(PATENT_SRC, /31: 에피소드 노드/, '★ 구체 예시(placeholder "요소이름" 교체)');
  assert.ok(!/---REF_MAP---\\n31: 요소이름/.test(PATENT_SRC), '★ generic placeholder 제거');
});
