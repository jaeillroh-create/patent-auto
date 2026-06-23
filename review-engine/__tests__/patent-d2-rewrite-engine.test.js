/**
 * review-engine/__tests__/patent-d2-rewrite-engine.test.js
 *
 * ★ patent D2 T1 반영 엔진 — Patent.applyDirectionRewrite (add_spec_support 우선).
 *   승인된 보정 방향(outputs._review_applied) 중 op==='add_spec_support' 를
 *   상세설명(step_08 기본 / 장치 없으면 step_12)에 "뒷받침 단락" APPEND 한다.
 *   DB high×2 가 §42④ 뒷받침(기재불비)이라 이 op 가 주력. opinion D2a(splice) 패턴 + APPEND.
 *
 *   ★ 절대 제약(이 테스트가 지키는 것):
 *     1) add_spec_support = APPEND — 기존 상세설명 byte-identical(접두), 뒤에 단락만 추가.
 *     2) 비대상 섹션(청구항 step_06 / 부호 step_18 …) byte-identical — pending 에 미포함, outputs 불변.
 *     3) 보류(hold) — outputs 미커밋. 변리사 [확정](T2)에서만 반영. _pendingPatentRewrite 만 설정.
 *     4) E-11 도면 정합 게이트(_reviewRenderCheck) — 부호 불일치면 canConfirm=false.
 *     5) opinion 회귀 0 — opinion D2(applyDirectionRewrite/confirmRewrite) 불변.
 *
 *   ★ vm 주의: patent.js 의 `outputs` 는 module-top `let`(전역객체 속성 아님). 동일 context 의
 *     별도 runInContext 가 같은 global-lexical 바인딩을 공유하므로, runInContext 로 set/read 한다.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readFileSync(path.join(REPO, 'patent/patent.js'), 'utf8');
const OPINION_SRC = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');

let Patent, sandbox, genCalls;

before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: { id: 'x' } }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  // ★ callClaude 는 호출되면 안 됨(_genSpecSupportParagraph 를 stub 하므로). 호출 시 표식 남기는 트랩.
  const App = { sb, currentUser: { id: 'u1', email: 'v@x.com' }, showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, callClaude: async () => { App.__llmHit = true; return { text: 'LLM-SHOULD-NOT-BE-CALLED' }; } };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error, structuredClone: globalThis.structuredClone,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, classList: { add() {}, remove() {} } }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, sb, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => true, openModal() {}, openModalMessage() {}, subscribePolling: () => ({ stop() {} }), policy: () => ({ capUsd: 15, maxRounds: 2 }) };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
  Patent = sandbox.window.Patent;
});

// ── 헬퍼: module-lexical outputs 를 별도 runInContext 로 set/read(같은 context 의 global-lexical 공유) ──
const setOutputs = (obj) => vm.runInContext(
  'Object.keys(outputs).forEach(function(k){delete outputs[k];}); Object.assign(outputs,' + JSON.stringify(obj) + ');',
  sandbox, { filename: 'set.js' });
const readOutputs = () => JSON.parse(vm.runInContext(
  'JSON.stringify({step_06:outputs.step_06||null, step_08:outputs.step_08||null, step_12:outputs.step_12||null, step_18:outputs.step_18||null, applied:outputs._review_applied||null})',
  sandbox, { filename: 'read.js' }));

beforeEach(() => {
  Patent._pendingPatentRewrite = null;
  sandbox.App.__llmHit = false;
  genCalls = [];
  // 기본 stub: 결정적 단락(LLM 미호출). target 별로 구분되는 텍스트 반환.
  Patent._genSpecSupportParagraph = async (dir, basis) => {
    genCalls.push({ target: dir && dir.target, direction: dir && dir.direction, basisLen: String(basis || '').length });
    return '본 실시예에서 ' + (dir && dir.target) + ' 의 동작원리와 기준값 산출을 구체적으로 기술한다.';
  };
});

const DEV_BASE = '도 1을 참조하면, 장치(100)는 신뢰도 산출부(110)를 포함한다. 신뢰도 산출부(110)는 입력을 수신한다.';
const CLAIM_BASE = '【청구항 7】 제1항에 있어서, 상기 동적 가중부를 더 포함하는 장치.';
const SIGN_BASE = '100: 장치\n110: 신뢰도 산출부';

test('★ add_spec_support → step_08 상세설명에 APPEND (기존 byte-identical 접두 + 단락 추가)', async () => {
  setOutputs({
    step_06: CLAIM_BASE, step_08: DEV_BASE, step_18: SIGN_BASE,
    _review_applied: [{ op: 'add_spec_support', target: 'claim_7', direction: '동적 가중부의 갱신주기 산출을 보강', reason: '§42④ 뒷받침 부재', planId: 'p1' }],
  });
  const rw = await Patent.applyDirectionRewrite();

  assert.ok(rw, '반영본 반환');
  assert.equal(sandbox.App.__llmHit, false, '★ 단락 생성은 _genSpecSupportParagraph stub 경유(직접 callClaude 미호출)');
  assert.equal(genCalls.length, 1, 'add_spec_support 1건 → 생성 1회');
  // ★ APPEND: 기존 상세설명이 접두로 그대로 보존 + 구분(개행) + 새 단락
  assert.ok(rw.after.step_08.startsWith(DEV_BASE), '★ 기존 상세설명 byte-identical 접두 보존');
  assert.ok(rw.after.step_08.length > DEV_BASE.length, '★ 뒤에 단락이 추가됨(APPEND)');
  assert.ok(rw.after.step_08.endsWith('구체적으로 기술한다.'), '추가 단락이 말미에 위치');
  assert.equal(rw.appended.length, 1, 'appended 1건');
  assert.equal(rw.appended[0].section, 'step_08', '장치 상세설명(step_08)에 추가');
  assert.equal(rw.appended[0].planId, 'p1', 'planId 추적');
});

test('★ 비대상 섹션 byte-identical — pending 은 step_08/step_12 만, 청구항·부호 미접촉', async () => {
  setOutputs({
    step_06: CLAIM_BASE, step_08: DEV_BASE, step_12: '', step_18: SIGN_BASE,
    _review_applied: [{ op: 'add_spec_support', target: 'claim_7', direction: '보강 방향', planId: 'p1' }],
  });
  const rw = await Patent.applyDirectionRewrite();

  assert.deepEqual(Object.keys(rw.pending).sort(), ['step_08', 'step_12'], '★ pending 은 상세설명 2섹션만(청구항/부호 미클론)');
  // outputs 자체도 보류라 불변 — 비대상 섹션은 구조적으로 손댈 수 없음
  const o = readOutputs();
  assert.equal(o.step_06, CLAIM_BASE, '★ 청구항(step_06) byte-identical');
  assert.equal(o.step_18, SIGN_BASE, '★ 부호의 설명(step_18) byte-identical');
});

test('★ 보류(hold) — outputs 미커밋(확정 전), _pendingPatentRewrite 만 설정', async () => {
  setOutputs({
    step_06: CLAIM_BASE, step_08: DEV_BASE, step_18: SIGN_BASE,
    _review_applied: [{ op: 'add_spec_support', target: 'claim_7', direction: '보강 방향', planId: 'p1' }],
  });
  const rw = await Patent.applyDirectionRewrite();

  // ★ 핵심 안전: 반영본(after)에는 단락이 붙었지만, 실제 outputs.step_08 은 baseline 그대로(미커밋).
  const o = readOutputs();
  assert.equal(o.step_08, DEV_BASE, '★ outputs.step_08 은 baseline 그대로(보류 — T2 확정에서만 커밋)');
  assert.notEqual(rw.after.step_08, o.step_08, '★ 반영본(after) ≠ 현재 outputs(보류 격차 존재)');
  assert.equal(Patent._pendingPatentRewrite, rw, '_pendingPatentRewrite 에 보류본 보관');
  assert.equal(rw.before.step_08, DEV_BASE, 'before 에 원본 보존(비교모달용)');
});

test('★ E-11 도면 정합 게이트 — 부호 일치면 canConfirm=true', async () => {
  setOutputs({
    step_06: CLAIM_BASE, step_08: DEV_BASE, step_18: SIGN_BASE,
    step_07_mermaid: 'graph TD; A[장치(100)] --> B[신뢰도 산출부(110)]',  // 100,110 모두 부호에 존재
    _review_applied: [{ op: 'add_spec_support', target: 'claim_7', direction: '보강', planId: 'p1' }],
  });
  const rw = await Patent.applyDirectionRewrite();
  assert.equal(rw.canConfirm, true, '★ 도면 부호 ⊆ 부호의설명 → 확정 가능');
  assert.deepEqual(rw.renderCheck.missing, [], 'missing 없음');
});

test('★ E-11 도면 정합 게이트 — 도면에 부호의설명 없는 번호(99) 있으면 canConfirm=false', async () => {
  setOutputs({
    step_06: CLAIM_BASE, step_08: DEV_BASE, step_18: SIGN_BASE,
    step_07_mermaid: 'graph TD; A[장치(100)] --> Z[미정의부(99)]',  // 99 는 step_18 에 없음
    _review_applied: [{ op: 'add_spec_support', target: 'claim_7', direction: '보강', planId: 'p1' }],
  });
  const rw = await Patent.applyDirectionRewrite();
  assert.equal(rw.canConfirm, false, '★ 부호 불일치(99) → 확정 차단(E-11)');
  assert.ok(rw.renderCheck.missing.indexOf('99') >= 0, 'missing 에 99 포함');
});

test('★ 다중 add_spec_support → 순서대로 모두 APPEND(기존 보존)', async () => {
  setOutputs({
    step_08: DEV_BASE, step_18: SIGN_BASE,
    _review_applied: [
      { op: 'add_spec_support', target: 'claim_7', direction: '가중부 보강', planId: 'p1' },
      { op: 'narrow_scope', target: 'claim_1', direction: '범위 한정', planId: 'p2' },     // ★ 비대상 op — 무시
      { op: 'add_spec_support', target: 'claim_9', direction: '검증루프 보강', planId: 'p3' },
    ],
  });
  const rw = await Patent.applyDirectionRewrite();
  assert.equal(rw.appended.length, 2, '★ add_spec_support 2건만 반영(narrow_scope 는 이번 범위 외)');
  assert.equal(genCalls.length, 2, '생성 2회');
  assert.ok(rw.after.step_08.startsWith(DEV_BASE), '기존 상세설명 보존');
  assert.deepEqual(rw.appended.map((a) => a.planId), ['p1', 'p3'], '승인 순서 보존');
});

test('★ add_spec_support 없음 → null 반환(보정 없음, 산문 미수정)', async () => {
  setOutputs({ step_08: DEV_BASE, _review_applied: [{ op: 'narrow_scope', target: 'claim_1', direction: 'x', planId: 'p1' }] });
  const rw = await Patent.applyDirectionRewrite();
  assert.equal(rw, null, '★ 처리할 add_spec_support 없으면 null');
  assert.equal(Patent._pendingPatentRewrite, null, '보류본 미설정');
  assert.equal(readOutputs().step_08, DEV_BASE, 'outputs 불변');
});

test('★ _review_applied 비어있음 → null(승인 보정 자체가 없음)', async () => {
  setOutputs({ step_08: DEV_BASE, _review_applied: [] });
  const rw = await Patent.applyDirectionRewrite();
  assert.equal(rw, null, '빈 로그 → null');
});

test('★ 단락 생성 전부 실패 → null + outputs 불변(부분 실패는 failed 로 기록)', async () => {
  Patent._genSpecSupportParagraph = async () => null;   // 생성 실패 시뮬레이션
  setOutputs({ step_08: DEV_BASE, _review_applied: [{ op: 'add_spec_support', target: 'claim_7', direction: '보강', planId: 'p1' }] });
  const rw = await Patent.applyDirectionRewrite();
  assert.equal(rw, null, '★ 전건 실패 → null(반영 안 함)');
  assert.equal(readOutputs().step_08, DEV_BASE, 'outputs 불변');
});

// ── 소스 정합 가드 ──

test('★ 소스 — applyDirectionRewrite 가 APPEND 형태(기존 + 단락) + 보류(_pendingPatentRewrite)', () => {
  const i = PATENT_SRC.indexOf('Patent.applyDirectionRewrite = ');
  assert.ok(i > 0, 'applyDirectionRewrite 정의 존재');
  const seg = PATENT_SRC.slice(i, i + 2400);
  // ★ add_spec_support 필터는 소스 통일 헬퍼(_collectApprovedSpecOps)로 이전됨 — applyDirectionRewrite 는 헬퍼를 호출.
  assert.match(seg, /var specOps = Patent\._collectApprovedSpecOps\(\)/, '승인 보정 소스 통일 헬퍼 사용');
  assert.match(PATENT_SRC, /Patent\._collectApprovedSpecOps[\s\S]{0,1400}op !== 'add_spec_support'/, 'add_spec_support 필터는 헬퍼에 존재');
  assert.match(seg, /pending\[sec\]\s*=\s*pending\[sec\]\s*\+[\s\S]*?\+\s*para/, '★ APPEND(기존 pending + 단락 para)');
  assert.match(seg, /Patent\._pendingPatentRewrite =/, '★ 보류본 _pendingPatentRewrite 설정');
  assert.match(seg, /_reviewRenderCheck\(checkO\)/, 'E-11 게이트 호출');
  // ★ outputs 직접 커밋(=outputs.step_08 = ...) 이 없어야 보류(자동 반영 금지)
  assert.ok(!/outputs\.step_08\s*=/.test(seg), '★ applyDirectionRewrite 가 outputs 를 직접 커밋하지 않음(보류)');
});

test('opinion 회귀 0 — opinion D2(applyDirectionRewrite/confirmRewrite) 불변(이 PR 은 patent 만 수정)', () => {
  assert.match(OPINION_SRC, /Opinion\.applyDirectionRewrite\s*=/, 'opinion D2a 유지');
  assert.match(OPINION_SRC, /Opinion\.confirmRewrite\s*=/, 'opinion D2c 확정 유지');
});
