/**
 * review-engine/__tests__/patent-e2e.test.js
 * P-T2 — patent 검증 배선 E2E(토글 ON 전 관문). opinion-e2e 미러링 + patent 특수.
 * 증명:
 *   G1 트리거: Patent.exportSnapshot → adaptSnapshot → orchestrate(R1, stub LLM)
 *              → issues + patchPlans → Human Gate → 승인 → applyAmendments(3경로 renderCheck) → recheck
 *   G3 비용확인: _confirmReviewCost=false → runner 미발화(오발화 방지)
 *   G4 게이트: 필수4종 미충족 → 미발화 + 안내 / 충족 → 발화
 *   G5 마운트: __patentReviewState 설정 + renderPreview 가 ReviewUI.render(page4) 호출
 *   G7 citedPrior: step_04 특허번호 정규식 매핑
 *   G9 edge: PROFILES[module] 데이터 선택(분기 0)
 *   E-21: isEnabled('patent') OFF → 무동작
 * LLM은 결정적 stub. 흐름 연결 자체가 검증 대상.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import PatentProfile from '../profiles/patent/PatentProfile.js';
import patentAdapter from '../profiles/patent/adapter.js';
import { run as orchestrate } from '../kernel/orchestrator.js';
import { makeEngineWriter } from '../profiles/patent/writerAdapter.js';
import { approvePlan, gateView } from '../kernel/humanGate.js';
import { PROFILES } from '../profiles/registry.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Patent, win, renderCalls, els;

/** id별 stub DOM 엘리먼트(렌더 호출·게이트 상태 캡처용). */
function mkEl(id) { return { id, style: {}, disabled: false, textContent: '', innerHTML: '', appendChild() {}, querySelectorAll: () => [] }; }

before(() => {
  let src = readFileSync(path.join(REPO_ROOT, 'patent/patent.js'), 'utf8');
  src = src.replace(/\ninit\(\);\s*$/, '\n');
  src += '\n;window.__pw={setGlobals:function(g){' +
    'if("outputs" in g)outputs=g.outputs;' +
    'if("scopeCheckResults" in g)scopeCheckResults=g.scopeCheckResults;' +
    'if("inventionScope" in g)inventionScope=g.inventionScope;' +
    'if("deviceAnchorStart" in g)deviceAnchorStart=g.deviceAnchorStart;' +
    'if("methodAnchorStart" in g)methodAnchorStart=g.methodAnchorStart;' +
    '},getOutputs:function(){return outputs;}};\n';

  renderCalls = [];
  els = { btnPatentReview: mkEl('btnPatentReview'), patentReviewGateMsg: mkEl('patentReviewGateMsg'),
    resultCardPatentReview: mkEl('resultCardPatentReview'), 'patent-review-mount': mkEl('patent-review-mount'),
    previewArea: mkEl('previewArea') };

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Set, Map,
    setTimeout: () => 0, clearTimeout: () => {},
    setButtonLoading() {}, // common.js 전역 stub
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => mkEl('tmp'), getElementById: (id) => els[id] || null, querySelector: () => null, querySelectorAll: () => [] },
    mermaid: { initialize() {} },
    App: { currentUser: { id: 'u1', email: 'jaeill.roh@gmail.com' }, sb: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} }, functions: { invoke: async () => ({ data: null }) } }, showScreen() {}, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s) },
    sb: { from: () => ({ select: () => ({ eq: () => ({}) }), update: () => ({ eq: () => ({}) }) }) },
    fetch: async () => ({ json: async () => ({}) }),
    confirm: () => true, // G3: 기본 진행 동의(테스트별 override)
    // 토글 ON 스텁(P-T2 한정 — 실 토글 index.js FEATURE_FLAGS.modules.patent=false 유지)
    ReviewUI: {
      isEnabled: () => true,
      policy: () => ({ capUsd: 15, maxRounds: 12 }),
      render: (state, el, opts) => { renderCalls.push({ elId: el && el.id, hasState: !!state, opts }); },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'patent.js' });
  win = sandbox;
  Patent = sandbox.window.Patent;
  sandbox.currentProjectId = 'p1';
  // 필수4종(G4) 충족 + 3경로 정합(E-11) + step_04 선행기술 픽스처
  sandbox.__pw.setGlobals({
    deviceAnchorStart: 7, methodAnchorStart: 0,
    inventionScope: { locked_at: 't', baseline: { components: [] } },
    scopeCheckResults: {},
    outputs: {
      step_06: '【청구항 1】 센서와 처리부를 포함하는 장치.',
      step_08: '상세설명: 처리부(100)는 신뢰도 기반 동적 가중을 수행한다.',
      step_18: '100: 처리부',
      step_07_mermaid: 'graph TD\nA[처리부(100)]',
      step_04: '선행기술 검색결과: 제10-2020-0012345호, 제10-1234567호 및 제10-2020-0012345호(중복).',
    },
  });
});

/** patent ESM 파이프라인 runner — 결정적 stub LLM(prod edge invoke 자리). */
function makeStubRunner(tracker) {
  return async (snapshot) => {
    if (tracker) tracker.called = true;
    const state = PatentProfile.adaptSnapshot(snapshot, null, { terminationPolicy: PatentProfile.terminationPolicy });
    const CONS = { examiner: true, attorney: true, expert: true };
    const runAgent = async ({ mode, state: st }) => {
      if (mode === 'discover') {
        return {
          issues: [{ id: 'exA-1', type: '진보성', severity: 'high', target: ['claim_1'], raisedBy: 'examiner_A', legalBasis: '§29②', description: '인용발명 제10-1234567호 대비 진보성 미흡', suggestedOp: 'add_limitation', amendmentDirection: '청구항1에 상세설명 step_08의 신뢰도 기반 동적 가중을 한정하는 방향' }],
          consensus: CONS, cost: 0.01, provider: 'stub', latencyMs: 1,
        };
      }
      return { verdicts: (st.issues || []).map((i) => ({ issueId: i.id, result: 'resolved' })), consensus: CONS, cost: 0, provider: 'stub', latencyMs: 1 };
    };
    const profile = { ...PatentProfile, writer: makeEngineWriter(() => state) };
    const res = await orchestrate(profile, state, { runAgent });
    return { issues: res.issues, patchPlans: res.patchPlans, phase: res.phase, rounds: res.rounds, budget: res.budget, consensus: res.consensus };
  };
}

test('G4 게이트: 필수4종 충족/미충족 판정', () => {
  assert.equal(Patent._reviewGate().ok, true, '4종 충족 → ok');
  const o = win.__pw.getOutputs();
  const savedSign = o.step_18; o.step_18 = ''; // 부호의 설명 제거
  const gate = Patent._reviewGate();
  assert.equal(gate.ok, false, '부호 누락 → 미충족');
  assert.ok(gate.missing.some((m) => m.includes('부호')), '누락 항목 안내');
  o.step_18 = savedSign; // 복원
});

test('G3 비용확인: confirm=false → runner 미발화(오발화 방지)', async () => {
  const tracker = { called: false };
  win.confirm = () => false; // 사용자가 진행 취소
  const r = await Patent.runReviewEngine(makeStubRunner(tracker));
  assert.equal(r, null, 'confirm 거부 → 미발화');
  assert.equal(tracker.called, false, 'runner 호출 안 됨(부작용 0)');
  win.confirm = () => true; // 복원
});

test('G1/G5 E2E: 트리거→토론→Human Gate→승인→3경로 renderCheck→recheck + page4 마운트', async () => {
  renderCalls.length = 0;
  const tracker = { called: false };
  const runner = makeStubRunner(tracker);

  // 1) 트리거(토글 ON + 게이트 OK + confirm OK) → exportSnapshot → runner
  const result = await Patent.runReviewEngine(runner);
  assert.ok(result, '검증 트리거 발화');
  assert.equal(tracker.called, true, 'runner 발화');
  assert.equal(win.__patentReviewState, result, 'G5: __patentReviewState 설정(page4 마운트 조건)');

  // 2) R1 discover: issues + patchPlans
  assert.ok(result.issues.length >= 1, 'R1 issue 발굴');
  assert.ok(result.patchPlans.length >= 1, '보정안(patchPlan) 생성');
  const plan = result.patchPlans[0];
  assert.equal(plan.accepted, null, '승인 전 accepted=null');

  // 3) G5: renderPreview 가 ReviewUI.render 를 page4 마운트(patent-review-mount)로 호출
  const mountCall = renderCalls.find((c) => c.elId === 'patent-review-mount');
  assert.ok(mountCall && mountCall.hasState, 'ReviewUI.render(page4 patent-review-mount) 호출됨');

  // 4) 사람 승인(Human Gate)
  approvePlan(result, plan.id, 'jaeill.roh@gmail.com');
  assert.equal(gateView(result).filter((g) => g.decision === 'approved').length, 1, '승인 1건');
  const approvedPlans = result.patchPlans.filter((p) => p.accepted === true);

  // 5) applyAmendments(승인분만) + 3경로 renderCheck 통과(E-11)
  const applyRes = Patent.applyAmendments(approvedPlans);
  assert.equal(applyRes.rolledBack, false, '3경로 정합 → 롤백 없음');
  assert.equal(applyRes.renderCheck.svg && applyRes.renderCheck.pptx && applyRes.renderCheck.canvas, true, '3경로 OK');
  assert.ok(applyRes.count >= 1, '승인분 구조반영');

  // 6) recheck 재트리거(비용 재확인 없이) — _reviewRunner 보존
  assert.equal(typeof Patent._reviewRunner, 'function', 'recheck용 runner 보존');
  const recheck = await Patent.runReviewEngine(Patent._reviewRunner, { recheck: true });
  assert.ok(recheck, 'recheck 재트리거 발화');
  assert.ok(Array.isArray(recheck.issues), 'recheck 결과 수신');
});

test('E-21: isEnabled(patent) OFF → 무동작(트리거·마운트 없음)', async () => {
  const tracker = { called: false };
  win.ReviewUI.isEnabled = () => false;
  win.__patentReviewState = null;
  const r = await Patent.runReviewEngine(makeStubRunner(tracker));
  assert.equal(r, null, '토글 OFF → 무동작');
  assert.equal(tracker.called, false, 'runner 미발화');
  assert.equal(win.__patentReviewState, null, '__patentReviewState 미설정');
  win.ReviewUI.isEnabled = () => true; // 복원
});

test('G4 게이트: 필수 미충족이면 OFF 아니어도 미발화 + 안내', async () => {
  const tracker = { called: false };
  const o = win.__pw.getOutputs();
  const saved = o.step_06; o.step_06 = ''; o.step_10 = ''; // 청구항 제거(장치·방법 둘 다)
  const r = await Patent.runReviewEngine(makeStubRunner(tracker));
  assert.equal(r, null, '게이트 미충족 → 미발화');
  assert.equal(tracker.called, false, 'runner 미발화');
  o.step_06 = saved; // 복원
});

test('G7 citedPrior: step_04 특허번호 정규식 매핑(번호만, 중복제거)', () => {
  const cp = patentAdapter.parseCitedPrior('선행기술: 제10-2020-0012345호, 제10-1234567호 및 제10-2020-0012345호(중복).');
  assert.ok(cp.length === 2, '중복 제거 후 2건');
  assert.ok(cp.every((c) => c.summary === ''), 'summary 빈값(번호만 매핑)');
  assert.ok(cp[0].label.includes('10-2020-0012345'), '번호 라벨 보존');
  assert.equal(patentAdapter.parseCitedPrior('').length, 0, '빈 입력 → 빈 배열');
  // adapter 통합: raw.citedPrior 없으면 step_04 파싱
  const st = patentAdapter.adaptSnapshot({ outputs: { step_06: '【청구항 1】 장치.', step_04: '제10-1234567호' } }, null, {});
  assert.ok(st.citedPrior.length >= 1, 'adaptSnapshot 이 step_04 파싱');
});

test('G9 edge: PROFILES[module] 데이터 선택(opinion/patent/division 전부)', () => {
  assert.equal(PROFILES.patent.profile.module, 'patent');
  assert.equal(PROFILES.opinion.profile.module, 'opinion');
  assert.equal(PROFILES.division.profile.module, 'division');
  assert.equal(typeof PROFILES.patent.makeEngineWriter, 'function');
  assert.ok(Array.isArray(PROFILES.patent.agents) && PROFILES.patent.agents.length >= 1);
  assert.equal(PROFILES.unknown, undefined, '미등록 모듈 → undefined(edge 400)');
});
