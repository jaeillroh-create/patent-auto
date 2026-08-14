/**
 * review-engine/__tests__/patent-batch20-circular-fix.test.js
 * ★ 배치 20-2/20-3 — 순환 오류 구조 수정(전수 감사·적대 검증 기반).
 *
 * 실증된 순환 2개:
 *   [고리1] 재작성 → 신규 결함 유입: 재작성 프롬프트에 현재 본문이 없어 매 라운드 백지 전문 재생성 →
 *     생성형 검사 재추첨으로 "16건 해소·8건 신규". + 스캔 범위(extras·기초 포함) ⊋ 수정 범위 비대칭.
 *   [고리2] 배지 순환: STEP_DEPENDENCIES 에 step_08→(MUST)step_13→(SHOULD)step_15→(SHOULD)step_08 실순환 +
 *     cohesion 커밋 말미 invalidateDownstream('step_08')이 방금 소비한 진단을 '재생성 필수'로 재점등 +
 *     13→04 허구 엣지("E2 재생성 권장" 거짓 배너).
 *
 * 수정: 검토 노드(13/14/15) 그래프 분리(DAG화), 자기 무효화 제거, 기저 텍스트 최소 수정 재작성,
 *   AI/기계 역할 분리(step_13 실질만·기계 이중주입 제거·결정론 검사 이식), extras 스캔 제외,
 *   enforce 범위 확장, 실패 감지·신규/잔존 구분, 사용자 중단.
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
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');

let sandbox; let toasts = [];
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '' });
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
beforeEach(() => { run('clearAllState();'); toasts = []; run('window._wfCancelRequested=false;'); });

// ═══ [고리2] 그래프 DAG 화 — 검토 노드 분리 ═══

test('★20-2a — STEP_DEPENDENCIES 가 DAG 다(순환 0) — Kahn 정렬로 독립 검증', () => {
  const deps = JSON.parse(run('JSON.stringify(STEP_DEPENDENCIES)'));
  const nodes = Object.keys(deps);
  const indeg = {}; nodes.forEach(n => indeg[n] = 0);
  nodes.forEach(n => [...(deps[n].MUST||[]), ...(deps[n].SHOULD||[])].forEach(d => { if(indeg[d]!==undefined)indeg[d]++; }));
  const q = nodes.filter(n => !indeg[n]); let seen = 0;
  while(q.length){ const n = q.shift(); seen++;
    [...(deps[n].MUST||[]), ...(deps[n].SHOULD||[])].forEach(d => { if(indeg[d]!==undefined && --indeg[d]===0)q.push(d); });
  }
  assert.strictEqual(seen, nodes.length, `★ 순환 잔존 — 위상정렬 불가 노드 ${nodes.length-seen}개(종전: 08→13→15→08 실순환)`);
});

test('★20-2b — 검토·검증 노드(step_13/14/15)는 그래프에서 완전 분리(소스도 타깃도 아님)', () => {
  const deps = JSON.parse(run('JSON.stringify(STEP_DEPENDENCIES)'));
  ['step_13','step_14','step_15'].forEach(rv => {
    assert.deepStrictEqual([...(deps[rv].MUST||[]), ...(deps[rv].SHOULD||[])], [], `★ ${rv} 는 소스 엣지 0(종전 15→08/09/12 역류가 순환 폐쇄점)`);
    Object.keys(deps).forEach(n => {
      assert.ok(!(deps[n].MUST||[]).includes(rv) && !(deps[n].SHOULD||[]).includes(rv), `★ ${n}→${rv} 타깃 엣지 제거(검토는 파생 검사 — stale 배지 대상 아님)`);
    });
  });
});

test('★20-2c — 허구 엣지 13→04 제거(E2 "재생성 권장" 거짓 배너 원인 — 실제 데이터 흐름은 04→13)', () => {
  const deps = JSON.parse(run('JSON.stringify(STEP_DEPENDENCIES)'));
  assert.ok(!(deps.step_13.SHOULD||[]).includes('step_04'), '★ 13→04 제거');
  assert.ok(!(deps.step_04.SHOULD||[]).includes('step_15'), '★ 04→15 제거(step_15 는 선행기술을 읽지 않음)');
});

// ═══ [고리1-α] 재작성 = 기저 텍스트 최소 수정 ═══

test('★20-2d — 재작성 모드(FIX_TARGETS)에서 현재 본문이 기저 텍스트로 프롬프트에 실린다', () => {
  run('outputs.step_06="【청구항 1】 데이터 수집부(110)를 포함하는 서버."; outputs.step_07="도 1: 데이터 수집부(110)";');
  run('outputs.step_08="BASE_MARKER_DEVICE 도 1을 참조하면, 데이터 수집부(110)는 원시 데이터를 수집한다.";');
  run('outputs.step_05="BASE_MARKER_TASK 종래 기술은 수집 정확도가 낮다.";');
  run('_pendingFixTargets="· 중복: 문단 중복 제거";');
  const p = run('buildPrompt("unified_cohesion")');
  run('_pendingFixTargets="";');
  assert.ok(p.includes('기저 텍스트 — 최소 수정 원칙'), '★ 최소 수정 지시 존재');
  assert.ok(p.includes('BASE_MARKER_DEVICE'), '★ 현재 장치 상세설명이 기저로 주입(종전: 백지 전문 재생성 → 라운드마다 결함 재추첨)');
  assert.ok(p.includes('BASE_MARKER_TASK'), '★ 마무리 블록도 기저로 주입');
  assert.ok(/지적과 무관한 문장은 표현을 바꾸지 말고 그대로 옮겨 적어라/.test(p), '★ 무관 문장 재표현 금지');
});

test('★20-2e — 신규 생성(비재작성)은 종전대로 기저 텍스트 없음', () => {
  run('outputs.step_06="【청구항 1】 데이터 수집부(110)를 포함하는 서버."; outputs.step_07="도 1: 데이터 수집부(110)";');
  run('outputs.step_08="BASE_MARKER_DEVICE 기존 본문";');
  const p = run('buildPrompt("unified_cohesion")');
  assert.ok(!p.includes('기저 텍스트 — 최소 수정 원칙'), '★ 신규 생성엔 미주입(백지 생성 유지)');
});

// ═══ [고리1-β] 스캔=수정 범위 정렬 ═══

test('★20-2f — validateSpecification 은 말미 [참고: …] extras(step_14/15)를 스캔하지 않는다', () => {
  const body = '【발명의 설명】\n\n【발명의 명칭】\n테스트 발명\n\n【발명을 실시하기 위한 구체적인 내용】\n도 1을 참조하면, 수집부(110)는 데이터를 수집한다.';
  const extras = '\n\n[참고: 대안 청구항]\n적절한 방식으로 처리해요 <<<BROKEN>>>';   // 경어체+마커 — 스캔되면 결함 발화
  const withEx = JSON.parse(run(`JSON.stringify(validateSpecification(${JSON.stringify(body + extras)}))`));
  const noEx = JSON.parse(run(`JSON.stringify(validateSpecification(${JSON.stringify(body)}))`));
  assert.strictEqual(withEx.length, noEx.length, '★ extras 유무가 결함 수에 영향 없음(종전: extras 결함은 재작성·enforce 불가침 → 불멸 결함)');
});

test('★20-2g — _enforceAllOutputs 범위에 step_05·step_02·step_03 포함(스캔 범위와 정렬)', () => {
  assert.match(PATENT_SRC, /step_05:'마무리'/, '★ step_05(cohesion TASK 슬롯) enforce 포함');
  assert.match(PATENT_SRC, /step_02:'마무리', step_03:'마무리'/, '★ 기초(step_02/03) enforce 포함');
});

// ═══ 역할 분리 — 기계 이식·AI 축소 ═══

test('★20-2h — 불확정 용어·카테고리 혼입이 기계검증(validateClaims)으로 이식됨', () => {
  const iss1 = JSON.parse(run(`JSON.stringify(validateClaims(${JSON.stringify('【청구항 1】 소정의 기준에 따라 데이터를 처리하는 처리부를 포함하는 것을 특징으로 하는 데이터 처리 장치.')}))`));
  assert.ok(iss1.some(i => i.check === 'vague_term'), '★ "소정의" 불확정 용어 검출(종전 AI [8] 전담 → 기계 이식)');
  const iss2 = JSON.parse(run(`JSON.stringify(validateClaims(${JSON.stringify('【청구항 1】 데이터를 수집하는 단계를 수행하는 수집부를 포함하는 것을 특징으로 하는 데이터 처리 장치.')}))`));
  assert.ok(iss2.some(i => i.check === 'category_mixin'), '★ 장치항 "~하는 단계" 혼입 검출');
});

test('★20-2i — FIX_TARGETS 는 재작성으로 해소 불가능한 결함을 지시에서 제외', () => {
  const ft = run(`_buildFixTargets(${JSON.stringify([
    { check: 'title_generation_suspect', severity: 'MEDIUM', message: '명칭 불일치 의심', detail: '' },
    { check: 'example_missing', severity: 'MEDIUM', message: '예시 부재 문단', detail: '' },
    { check: 'paragraph_duplicate', severity: 'HIGH', message: '문단 중복 2회', detail: '' },
  ])})`);
  assert.ok(!ft.includes('명칭 불일치'), '★ title_generation_suspect 제외(소스가 도면·명칭이라 본문 재작성 불가침)');
  assert.ok(!ft.includes('예시 부재'), '★ example_missing 제외(실질 판단 — AI 소관, 리포트 전용)');
  assert.ok(ft.includes('중복'), '★ 결정론 해소 가능 결함은 유지');
});

test('★20-2j — _issueKey 숫자 마스킹(개수 변화가 신규 결함으로 이중 계상되지 않음)', () => {
  const k1 = run(`_issueKey(${JSON.stringify({ check: 'refnum_consistency', message: '부호 3개 미정의' })})`);
  const k2 = run(`_issueKey(${JSON.stringify({ check: 'refnum_consistency', message: '부호 2개 미정의' })})`);
  assert.strictEqual(k1, k2, '★ 같은 결함·다른 개수 = 같은 키(종전: 구키 해소+신키 신규로 왜곡)');
});

// ═══ 실패 감지·중단 ═══

test('★20-2k — 소스: cohesion 상태 반환 + 재작성 루프의 실패 감지(동일 반복 금지)', () => {
  assert.match(PATENT_SRC, /return \{committed:false, reason:'필수 블록 누락\(DEVICE_DESC\)'\}/, '★ 블록 누락 실패 상태');
  assert.match(PATENT_SRC, /return \{committed:false, reason:'수학식 인라인 게이트 실패/, '★ 수학식 게이트 실패 상태');
  assert.match(PATENT_SRC, /return \{committed:true, incomplete:_incomplete\}/, '★ 성공 상태');
  assert.match(PATENT_SRC, /if\(!_res\|\|_res\.committed===false\)\{ _genFail=/, '★ 재작성 루프가 실패를 감지해 즉시 중단(종전: round 2 동일 전체 생성 반복)');
});

test('★20-2l — 재작성 완료 집계가 잔존을 기존/신규로 구분한다', () => {
  assert.match(PATENT_SRC, /잔존 '\+remain\.length\+'건\(기존 '\+_remainOld/, '★ 기존/신규 유입 구분 표기(종전 "10건 잔존"에 신규 8건 은닉)');
});

test('★20-3a — 오버레이: 서브 진행 미러 + 중단 버튼 배선', () => {
  assert.match(HTML_SRC, /id="wfRewriteSubProgress"/, '★ 서브 진행 표시 슬롯(오버레이가 탭 내부 진행바를 가리던 문제)');
  assert.match(HTML_SRC, /id="btnWfCancel"[\s\S]{0,120}_wfRequestCancel\(\)/, '★ 중단 버튼');
  assert.match(PATENT_SRC, /function _wfRequestCancel\(\)/, '★ 중단 요청 함수');
  assert.match(PATENT_SRC, /window\._wfCancelRequested=false;[\s\S]{0,200}_wfProgressStart/, '★ 실행 시작 시 플래그 리셋');
});

test('★20-3b — 중단 게이트가 실행 경로 전반에 배선(라운드·논리 호출·이어쓰기 경계)', () => {
  assert.match(PATENT_SRC, /function _wfCancelGate\(\)\{ if\(typeof window!=='undefined'&&window\._wfCancelRequested\)throw new Error\('사용자 중단'\); \}/, '★ 게이트 함수');
  const gateCount = (PATENT_SRC.match(/_wfCancelGate\(\);/g) || []).length;
  assert.ok(gateCount >= 4, `★ 논리 호출 경계 게이트 ≥4 (실제 ${gateCount})`);
  assert.match(PATENT_SRC, /\[v20 이어쓰기\] 사용자 중단/, '★ 이어쓰기 루프 중단 지점');
  assert.match(PATENT_SRC, /window\._wfCancelRequested\)\{ _genFail='사용자 중단'/, '★ 라운드 경계 중단 지점');
});

// ═══ 자기 무효화 제거·레거시 정리 ═══

test('★20-2m — "진단만" 실행이 진짜 문서 불변·부수효과 0(연쇄 배지·레거시 부활 없음)', () => {
  // step_13 은 그래프 분리로 invalidateDownstream 이 no-op(엣지 0) + applyReview 부활 코드 제거
  const _rs = PATENT_SRC.slice(PATENT_SRC.indexOf('async function runStep('), PATENT_SRC.indexOf('async function runDiagnosis('));
  assert.ok(!_rs.includes("btnApplyReview"), '★ 진단 완료가 레거시 검토 반영 버튼을 되살리지 않음');
  assert.ok(!HTML_SRC.includes('id="btnPhaseD"'), '★ 레거시 역설계 버튼 제거');
  assert.ok(!HTML_SRC.includes('id="wfAdv3"'), '★ 레거시 고급 패널 제거');
});
