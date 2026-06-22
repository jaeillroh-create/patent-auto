/**
 * review-engine/__tests__/patent-d2-confirm.test.js
 *
 * ★ patent D2 T2 — 비교 모달 + 확정. T1 보류본(_pendingPatentRewrite)을 변리사가 전/후 비교 후
 *   [확정]하면 outputs.step_08 에 커밋 → renderPreview(화면) + saveProject(current_state_json 영속).
 *   outputs 단일소스라 Word 다운로드(downloadAsWord)가 자동 반영. opinion D2c(confirmRewrite) 패턴.
 *
 *   ★ 절대 제약(이 테스트가 지키는 것):
 *     1) ★ [확정] 전 outputs 불변(보류 유지) — applyDirectionRewrite 후에도 outputs.step_08 baseline.
 *     2) 확정 시에만 커밋(appended 섹션만) + saveProject 영속.
 *     3) 취소 → 보류 폐기, outputs 불변.
 *     4) E-11 gate canConfirm=false 면 확정 차단(outputs 불변, 보류 유지).
 *     5) ★ 확정 버튼 배선 — 인라인 onclick(opinion 무반응 교훈, addEventListener 의존 제거).
 *     6) opinion 회귀 0.
 *
 *   ★ vm 주의: patent.js 의 `outputs`·`currentProjectId` 는 module-top `let`. 동일 context 의 별도
 *     runInContext 가 같은 global-lexical 바인딩 공유 → 그 경로로 set/read(보류·커밋 검증).
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

let Patent, sandbox, genCalls, updateCaptures, lastAppendedModal;

before(() => {
  updateCaptures = [];
  const sbChain = {
    insert: () => sbChain, select: () => sbChain, eq: () => sbChain,
    update: (p) => { updateCaptures.push(p); return sbChain; },   // ★ saveProject 영속 payload 캡처
    single: async () => ({ data: { id: 'x' } }), maybeSingle: async () => ({ data: null }),
    order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f),
  };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, currentUser: { id: 'u1', email: 'v@x.com' }, showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, escapeHtml: (s) => String(s == null ? '' : s), callClaude: async () => ({ text: 'X' }) };
  const stubEl = () => ({ value: '', innerHTML: '', style: {}, className: '', id: '', remove() {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {} } });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error, structuredClone: globalThis.structuredClone,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      getElementById: () => stubEl(), createElement: () => stubEl(),
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
      body: { appendChild: (el) => { lastAppendedModal = el; } },
    },
    navigator: { clipboard: { writeText: async () => {} } },
    App, sb, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => true, openModal() {}, openModalMessage() {}, subscribePolling: () => ({ stop() {} }), policy: () => ({ capUsd: 15, maxRounds: 2 }) };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
  Patent = sandbox.window.Patent;
});

// ── 헬퍼: module-lexical outputs/currentProjectId 를 별도 runInContext 로 set/read ──
const setOutputs = (obj) => vm.runInContext(
  'Object.keys(outputs).forEach(function(k){delete outputs[k];}); Object.assign(outputs,' + JSON.stringify(obj) + ');',
  sandbox, { filename: 'set.js' });
const readOutputs = () => JSON.parse(vm.runInContext(
  'JSON.stringify({step_06:outputs.step_06||null, step_08:outputs.step_08||null, step_12:outputs.step_12||null, step_18:outputs.step_18||null, applied:outputs._review_applied||null})',
  sandbox, { filename: 'read.js' }));
const setProjectId = (id) => vm.runInContext('currentProjectId=' + JSON.stringify(id) + ';', sandbox, { filename: 'pid.js' });

const DEV_BASE = '도 1을 참조하면, 장치(100)는 신뢰도 산출부(110)를 포함한다. 신뢰도 산출부(110)는 입력을 수신한다.';
const CLAIM_BASE = '【청구항 7】 제1항에 있어서, 상기 동적 가중부를 더 포함하는 장치.';
const SIGN_BASE = '100: 장치\n110: 신뢰도 산출부';

beforeEach(() => {
  Patent._pendingPatentRewrite = null;
  genCalls = []; updateCaptures.length = 0; lastAppendedModal = null;
  Patent._genSpecSupportParagraph = async (dir) => {
    genCalls.push(dir && dir.target);
    return '본 실시예에서 ' + (dir && dir.target) + ' 의 동작원리와 기준값 산출을 구체적으로 기술한다.';
  };
});

// 보류본 생성 헬퍼(T1 엔진 경유). extra 로 mermaid 등 주입.
async function makePending(extra) {
  setOutputs(Object.assign({
    step_06: CLAIM_BASE, step_08: DEV_BASE, step_18: SIGN_BASE,
    _review_applied: [{ op: 'add_spec_support', target: 'claim_7', direction: '가중부 보강', planId: 'p1' }],
  }, extra || {}));
  return await Patent.applyDirectionRewrite();
}

test('★ 확정 전 outputs 불변 — applyDirectionRewrite 후에도 outputs.step_08 은 baseline(보류)', async () => {
  const pend = await makePending();
  assert.ok(pend && Patent._pendingPatentRewrite, '보류본 생성');
  assert.equal(readOutputs().step_08, DEV_BASE, '★ 확정 전 outputs 미커밋(보류 유지)');
  assert.ok(pend.after.step_08.length > DEV_BASE.length, '보류본 after 에는 단락이 붙어 있음');
});

test('★ 확정 → outputs.step_08 커밋(APPEND 반영) + saveProject 영속 + 보류 해제', async () => {
  const pend = await makePending();
  setProjectId('P1');
  const ok = await Patent.confirmPatentRewrite();

  assert.equal(ok, true, '확정 성공');
  const o = readOutputs();
  assert.equal(o.step_08, pend.after.step_08, '★ outputs.step_08 = after(APPEND 커밋)');
  assert.ok(o.step_08.startsWith(DEV_BASE), '기존 상세설명 접두 보존');
  assert.equal(Patent._pendingPatentRewrite, null, '★ 보류 해제(확정됨)');
  // ★ saveProject 영속 — projects.update(current_state_json.outputs.step_08 = after)
  const upd = updateCaptures.find((u) => u && u.current_state_json && u.current_state_json.outputs);
  assert.ok(upd, '★ saveProject 호출(projects.update)');
  assert.equal(upd.current_state_json.outputs.step_08, pend.after.step_08, '★ 영속 payload 에 APPEND 반영(Word 다운로드 단일소스)');
});

test('★ 확정 시 비대상 섹션 불변 — 청구항(step_06)·부호(step_18) 미커밋', async () => {
  await makePending();
  setProjectId('P1');
  await Patent.confirmPatentRewrite();
  const o = readOutputs();
  assert.equal(o.step_06, CLAIM_BASE, '★ 청구항 byte-identical');
  assert.equal(o.step_18, SIGN_BASE, '★ 부호의 설명 byte-identical');
});

test('★ 취소 → 보류 폐기 + outputs 불변(기존 명세서 유지)', async () => {
  await makePending();
  Patent.cancelPatentRewrite();
  assert.equal(Patent._pendingPatentRewrite, null, '보류 폐기');
  assert.equal(readOutputs().step_08, DEV_BASE, '★ outputs 불변');
});

test('★ E-11 gate 차단 — canConfirm=false 면 확정 거부(outputs 불변, 보류 유지, 미영속)', async () => {
  const pend = await makePending({ step_07_mermaid: 'graph TD; A[장치(100)] --> Z[미정의(99)]' });
  assert.equal(pend.canConfirm, false, '부호 불일치(99) → canConfirm=false');
  setProjectId('P1');
  const ok = await Patent.confirmPatentRewrite();
  assert.equal(ok, false, '★ 확정 거부');
  assert.equal(readOutputs().step_08, DEV_BASE, '★ outputs 불변');
  assert.ok(Patent._pendingPatentRewrite, '보류 유지(취소 가능)');
  assert.equal(updateCaptures.length, 0, 'saveProject 미호출');
});

test('★ 비교 모달 HTML — 추가 단락(하이라이트) + 대상 청구항 라벨 + 게이트 통과 배너', async () => {
  const pend = await makePending();
  const html = Patent._buildPatentRewriteDiffHtml(pend);
  assert.match(html, /추가되는 뒷받침 단락/, '추가 단락 섹션 헤더');
  assert.match(html, /청구항 7 뒷받침/, '★ 대상 claim_N 라벨');
  assert.ok(html.indexOf(pend.appended[0].paragraph) >= 0, '★ 추가 단락 본문(하이라이트 박스) 포함');
  assert.match(html, /정합 통과/, '게이트 통과 배너');
  assert.match(html, /장치 상세설명/, '섹션 한글 라벨');
});

test('★ 비교 모달 HTML — canConfirm=false 면 확정 불가 배너', async () => {
  const pend = await makePending({ step_07_mermaid: 'graph TD; A[장치(100)] --> Z[미정의(99)]' });
  const html = Patent._buildPatentRewriteDiffHtml(pend);
  assert.match(html, /확정 불가|위반/, '★ 차단 배너');
});

test('★ 모달 배선 — [확정]/[취소] 인라인 onclick(addEventListener 의존 없음)', async () => {
  await makePending();
  Patent.showPatentRewriteModal();
  const html = String(lastAppendedModal && lastAppendedModal.innerHTML || '');
  assert.match(html, /onclick="Patent\._confirmPatentRewriteClick\(\)"/, '★ [확정] 인라인 onclick');
  assert.match(html, /onclick="Patent\.cancelPatentRewrite\(\)"/, '★ [취소] 인라인 onclick');
  assert.ok(html.indexOf('disabled') < 0, '게이트 통과 시 [확정] 활성');
});

test('★ 모달 — canConfirm=false 면 [확정] disabled', async () => {
  await makePending({ step_07_mermaid: 'graph TD; A[장치(100)] --> Z[미정의(99)]' });
  Patent.showPatentRewriteModal();
  const html = String(lastAppendedModal && lastAppendedModal.innerHTML || '');
  assert.match(html, /id="btnPatentRewriteConfirm"[^>]*disabled/, '★ 차단 시 [확정] 비활성');
});

test('★ _confirmPatentRewriteClick — 확정 성공 시 모달 닫힘(인라인 onclick 경로)', async () => {
  await makePending();
  setProjectId('P1');
  let removed = false;
  const origGet = sandbox.document.getElementById;
  sandbox.document.getElementById = (id) => (id === 'patentRewriteModal') ? { remove() { removed = true; } } : origGet(id);
  try { await Patent._confirmPatentRewriteClick(); } finally { sandbox.document.getElementById = origGet; }
  assert.equal(removed, true, '★ 확정 후 모달 제거');
  assert.equal(Patent._pendingPatentRewrite, null, '보류 해제');
});

// ── 소스 정합 가드 ──

test('★ 소스 — 확정/취소/모달 함수 + 인라인 onclick + 확정 시 커밋·영속 경로', () => {
  assert.match(PATENT_SRC, /Patent\.confirmPatentRewrite\s*=\s*async function/, 'confirmPatentRewrite 정의');
  assert.match(PATENT_SRC, /Patent\.cancelPatentRewrite\s*=\s*function/, 'cancelPatentRewrite 정의');
  assert.match(PATENT_SRC, /Patent\.showPatentRewriteModal\s*=\s*function/, 'showPatentRewriteModal 정의');
  // ★ 인라인 onclick 배선(opinion 무반응 교훈)
  assert.match(PATENT_SRC, /onclick="Patent\._confirmPatentRewriteClick\(\)"/, '★ [확정] 인라인 onclick');
  assert.match(PATENT_SRC, /onclick="Patent\.cancelPatentRewrite\(\)"/, '★ [취소] 인라인 onclick');
  assert.match(PATENT_SRC, /onclick="Patent\.startDirectionRewrite\(\)"/, '★ [반영하기] 버튼 배선(renderPreview)');
  // ★ 확정 시에만 커밋 + 영속 + 화면
  assert.match(PATENT_SRC, /outputs\[sec\]\s*=\s*pend\.after\[sec\]/, '★ 확정 시 outputs 커밋');
  assert.match(PATENT_SRC, /saveProject\(true\)/, '★ saveProject 영속');
  assert.match(PATENT_SRC, /renderPreview\(\)/, '★ renderPreview 화면 반영');
});

test('opinion 회귀 0 — opinion D2(confirmRewrite/cancelRewrite) 불변(이 PR 은 patent 만 수정)', () => {
  assert.match(OPINION_SRC, /Opinion\.confirmRewrite\s*=/, 'opinion confirmRewrite 유지');
  assert.match(OPINION_SRC, /Opinion\.cancelRewrite\s*=/, 'opinion cancelRewrite 유지');
});
