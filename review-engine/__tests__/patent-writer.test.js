/**
 * review-engine/__tests__/patent-writer.test.js
 * T8 — patent.js WriterModule 2함수 + E-11 3경로 롤백. vm 샌드박스 로드(말미 init() 제거).
 * 증명: I-1(원본 무변형) / I-2·E-19(승인분만) / E-11(3경로 불일치 → 롤백+렌더회귀) / 기존 함수 불변.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Patent, win;

before(() => {
  let src = readPatentBundle(REPO_ROOT);
  // 테스트: 말미 자동 실행 init() 제거(정의만 로드). 기존 함수 정의에는 영향 없음.
  src = src.replace(/\ninit\(\);\s*$/, '\n');
  // 테스트 하니스 전용: patent.js의 let 바인딩(outputs 등)을 같은 스코프에서 설정하는 setter 주입.
  src += '\n;window.__pw={setGlobals:function(g){' +
    'if("outputs" in g)outputs=g.outputs;' +
    'if("scopeCheckResults" in g)scopeCheckResults=g.scopeCheckResults;' +
    'if("inventionScope" in g)inventionScope=g.inventionScope;' +
    'if("deviceAnchorStart" in g)deviceAnchorStart=g.deviceAnchorStart;' +
    'if("methodAnchorStart" in g)methodAnchorStart=g.methodAnchorStart;' +
    '},getOutputs:function(){return outputs;}};\n';
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Set, Map,
    setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => ({ style: {}, appendChild() {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    mermaid: { initialize() {} },
    App: { currentUser: { email: 'jaeill.roh@gmail.com' }, sb: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } }, showScreen() {}, escapeHtml: (s) => String(s == null ? '' : s) },
    sb: { from: () => ({ select: () => ({ eq: () => ({}) }), update: () => ({ eq: () => ({}) }) }) },
    fetch: async () => ({ json: async () => ({}) }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'patent.js' });
  win = sandbox;
  Patent = sandbox.window.Patent;
  // 픽스처: patent.js let 바인딩 설정(__pw setter — 같은 스코프). currentProjectId 는 암묵 전역.
  sandbox.currentProjectId = 'p1';
  sandbox.__pw.setGlobals({
    deviceAnchorStart: 7, methodAnchorStart: 0,
    inventionScope: { locked_at: 't', baseline: { components: [] } },
    scopeCheckResults: {},
    outputs: { step_06: '청구항 1\n장치.', step_08: '상세설명(100).', step_07_mermaid: 'graph TD\nA[프로세서(100)]', step_18: '100: 프로세서' },
  });
});

test('exportSnapshot: 원본 무변형 deepClone(I-1) + 형상 정합', () => {
  const snap = Patent.exportSnapshot();
  assert.equal(snap.caseId, 'p1');
  assert.equal(snap.deviceAnchorStart, 7);
  assert.ok(snap.outputs && snap.scopeCheckResults);
  snap.outputs.step_06 = 'MUT';
  assert.equal(win.__pw.getOutputs().step_06, '청구항 1\n장치.', '원본 불변(I-1)');
});

test('applyAmendments: 미승인 plan throw(I-2/E-19)', () => {
  assert.throws(() => Patent.applyAmendments([{ id: 'x', accepted: false, ops: [] }]), /미승인/);
  assert.throws(() => Patent.applyAmendments([{ id: 'y', ops: [] }]), /미승인/);
});

test('applyAmendments: 3경로 정합 통과 시 반영(렌더 OK)', () => {
  const o = win.__pw.getOutputs();
  o.step_07_mermaid = 'graph TD\nA[프로세서(100)]'; o.step_18 = '100: 프로세서'; // (100) ⊆ 부호의 설명
  const res = Patent.applyAmendments([{ id: 'plan_1', accepted: true, addressesIssues: ['a-1'], ops: [{ op: 'add_spec_support', target: 'claim_1', content: '뒷받침 보강 방향' }] }]);
  assert.equal(res.rolledBack, false);
  assert.equal(res.renderCheck.svg, true);
  assert.equal(res.renderCheck.pptx, true);
  assert.equal(res.renderCheck.canvas, true);
  assert.equal(res.count, 1);
});

test('★ E-11: 3경로 불일치 시 롤백 + 렌더회귀(커밋 안 함)', () => {
  const o = win.__pw.getOutputs();
  o.step_07_mermaid = 'graph TD\nA[프로세서(100)]\nB[누락부호(999)]'; // 999 부호의 설명에 없음
  o.step_18 = '100: 프로세서';
  delete o._review_applied;
  const res = Patent.applyAmendments([{ id: 'plan_2', accepted: true, ops: [{ op: 'fix_ref_sign', target: 'figures', content: 'x' }] }]);
  assert.equal(res.rolledBack, true, '불일치 → 롤백');
  assert.equal(res.renderCheck.svg, false);
  assert.ok(res.renderRegression && res.renderRegression.missing.includes('999'));
  assert.equal(win.__pw.getOutputs()._review_applied, undefined, '롤백 → 커밋 안 됨(원본 불변)');
});

test('회귀: 기존 함수(extractMermaidNodes/_sharedExtractRefNum) 존재·동작', () => {
  assert.equal(typeof win.extractMermaidNodes, 'function');
  assert.equal(typeof win._sharedExtractRefNum, 'function');
  const nodes = win.extractMermaidNodes('graph TD\nA[프로세서(100)]');
  assert.ok(Array.isArray(nodes));
});
