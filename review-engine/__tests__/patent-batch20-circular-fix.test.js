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

test('★20-2l — 재작성 완료 집계가 신규 유입을 구분하고, 요약은 전→후 단일 축(_fixSummaryText)', () => {
  // ★ [배치20-6 갱신] 종전 "N건 중 R건 해소 · M건 잔존"은 해소(전 항목 단위)·잔존(후 항목 단위) 단위 혼합으로
  //   12−6≠2 처럼 읽혔다(_issueKey 숫자 마스킹으로 전 항목 여러 개가 한 계열로 접힘). 전→후 단일 축 서식으로 교체.
  assert.match(PATENT_SRC, /const _remainNew=_remainFixArr\.length-_remainOld;/, '★ 신규 유입 계산 유지(배치20-7: 재작성 레인 기준)');
  assert.match(PATENT_SRC, /function _fixSummaryText\(fs\)\{/, '★ 토스트·배너 공용 서식 함수');
  assert.ok(!PATENT_SRC.includes("건 중 '+_resolved+'건 해소"), '★ 단위 혼합 표기("중 N건 해소") 제거');
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

// ═══ [배치20-4/20-5] 본문 생성 타임아웃 해소 — SSE 스트리밍 + 적응 폴백 ═══
// 실측: 통합 생성 [4/4] 본문에서 분할·폴백 모두 "타임아웃(3분)" — 20-1이 16k 토큰을 실제 적용하기
// 시작하자 고정 180초 하드컷에 전멸. 수정: claude 는 SSE 스트리밍(총시간 제한 폐지, 유휴 90초만 감시),
// gpt/gemini 는 max_tokens 비례 타임아웃, 분할 타임아웃 시 폴백은 8192 로 강등(이어쓰기가 이어붙임).

const COMMON_SRC = readFileSync(path.join(REPO, 'shared/common.js'), 'utf8');
const _fnSlice = (src, name, nextName) => {
  const s = src.indexOf(name); const e = src.indexOf(nextName, s);
  assert.ok(s > 0 && e > s, `함수 경계 탐지 실패: ${name} → ${nextName}`);
  return src.slice(s, e);
};

test('★20-4a — callClaude: 비스트리밍 프로바이더는 max_tokens 비례 타임아웃(8192 이하 3분 불변, 상한 10분)', () => {
  const cc = _fnSlice(COMMON_SRC, 'async function callClaude(', 'async function callClaudeSonnet(');
  assert.match(cc, /maxTokens&&maxTokens>8192\)\?Math\.min\(600000,Math\.round\(180000\*maxTokens\/8192\)\):180000/, '★ 비례 스케일(16000→약 6분, 상한 10분)');
  assert.ok(!cc.includes("throw new Error('타임아웃(3분)')"), '★ callClaude 본체에 3분 하드코딩 메시지 없음(실제 분 표기)');
  // callClaudeSonnet/callVision(경량 8192 이하 고정)은 고정 3분 유지가 정상 — 회귀로 오인 금지
  const cs = _fnSlice(COMMON_SRC, 'async function callClaudeSonnet(', 'async function callVision(');
  assert.ok(cs.includes('ctrl.abort(),180000'), '★ 경량 호출(callClaudeSonnet)은 고정 180초 유지');
});

test('★20-4b — 적응 폴백: 분할 타임아웃 → 폴백은 8192 강등 + 사용자 중단은 폴백으로 삼키지 않음', () => {
  assert.match(PATENT_SRC, /_splitTimedOut=\/타임아웃\/\.test\(String\(\(e&&e\.message\)\|\|''\)\)/, '★ 분할 실패가 타임아웃인지 식별');
  assert.match(PATENT_SRC, /const _fbTok=_splitTimedOut\?undefined:_cohMaxTok/, '★ 타임아웃 폴백은 기본 8192(재타임아웃 방지) — 절단분은 v20 이어쓰기가 결합');
  assert.match(PATENT_SRC, /if\(e&&\/사용자 중단\/\.test\(String\(e\.message\|\|''\)\)\)throw e;/, '★ 분할 내부 중단이 catch 에 삼켜져 폴백이 계속 돌던 버그 수정(즉시 전파)');
});

test('★20-5a — callClaude: claude 는 SSE 스트리밍 + 유휴(90초) 감시로 총시간 제한 폐지', () => {
  const cc = _fnSlice(COMMON_SRC, 'async function callClaude(', 'async function callClaudeSonnet(');
  assert.match(cc, /const _isStream=\(prov==='claude'\)/, '★ claude 만 스트리밍(타 프로바이더 동작 불변)');
  assert.match(cc, /if\(_isStream\)req\.body\.stream=true/, '★ 요청에 stream:true');
  assert.match(cc, /const _idleMs=90000/, '★ 유휴 타임아웃 90초(청크 간 간격만 감시 — 총 생성 시간은 무제한)');
  assert.match(cc, /const _resetIdle=\(\)=>\{ if\(!_isStream\)return; clearTimeout\(tout\); tout=setTimeout/, '★ 청크 수신마다 유휴 타이머 리셋');
  assert.match(cc, /스트림 유휴 타임아웃\(90초\)/, '★ 유휴 초과 시 원인 구분 가능한 메시지');
});

test('★20-5b — callClaude: SSE 이벤트 파싱(텍스트 누적·usage·stop_reason·에러)', () => {
  const cc = _fnSlice(COMMON_SRC, 'async function callClaude(', 'async function callClaudeSonnet(');
  assert.match(cc, /ev\.type==='content_block_delta'&&ev\.delta&&typeof ev\.delta\.text==='string'/, '★ text_delta 누적');
  assert.match(cc, /ev\.type==='message_start'&&ev\.message&&ev\.message\.usage/, '★ input_tokens 수집');
  assert.match(cc, /ev\.type==='message_delta'/, '★ stop_reason·output_tokens 수집(이어쓰기 판단에 필수)');
  assert.match(cc, /ev\.type==='error'/, '★ 스트림 내 error 이벤트를 예외로 승격');
  assert.match(cc, /return\{text:text,stopReason:stopReason\}/, '★ 반환 계약 {text,stopReason} 유지(호출부 불변)');
});

test('★20-5c — 스트리밍 중 실시간 수신량·중단: _genStreamChars 갱신 + 오버레이 표시 + 취소 즉시 반영', () => {
  const cc = _fnSlice(COMMON_SRC, 'async function callClaude(', 'async function callClaudeSonnet(');
  assert.match(cc, /window\._genStreamChars=0/, '★ 스트림 시작 시 카운터 리셋');
  assert.match(cc, /window\._genStreamChars=text\.length/, '★ 청크마다 수신 자수 갱신');
  assert.match(cc, /window\._wfCancelRequested\)\{try\{ctrl\.abort\(\)/, '★ 중단 요청 시 스트림 즉시 abort(종전: HTTP 1건 완주 대기)');
  assert.match(PATENT_SRC, /_genStreamChars\)\|0/, '★ 오버레이 서브 진행이 수신 자수를 읽음');
  assert.match(PATENT_SRC, /'· 수신 '\+live\.toLocaleString\(\)\+'자'/, '★ "수신 N자" 라이브 표시(멈춤/진행 즉시 구분)');
});

test('★20-5d — Opus 5 전환: 모델 ID·카탈로그 미러·대용량 상한 32000', () => {
  assert.match(COMMON_SRC, /sonnet:\{id:'claude-sonnet-5',label:'Sonnet 5'/, '★ Sonnet 5');
  assert.match(COMMON_SRC, /opus:\{id:'claude-opus-5',label:'Opus 5',inputCost:5,outputCost:25\}/, '★ Opus 5(비용 5/25 동일)');
  const cat = readFileSync(path.join(REPO, 'review-engine/adapters/providerCatalog.js'), 'utf8');
  assert.match(cat, /id: 'claude-sonnet-5'/, '★ 카탈로그 미러 동기화(sonnet)');
  assert.match(cat, /id: 'claude-opus-5'/, '★ 카탈로그 미러 동기화(opus)');
  assert.match(COMMON_SRC, /selectedProvider==='claude'\?32000:\(selectedProvider==='gemini'\?8192:16000\)/, '★ claude 32000(스트리밍이라 시간 무관 + Opus 5 thinking 이 max_tokens 에 포함되므로 16k 는 절단 위험)');
});

// ═══ [배치20-6] ④탭 결과 보고 배선 — 수치 정합·AI 반영 표시·행동 안내(사용자 신고 기반) ═══
// 신고: "12건 중 6건 해소 · 2건 잔존" 산술 불일치 / AI 진단 12,198자 반영 여부 불명 / 잔존 시 "또 써야 하나?" 안내 부재.

test('★20-6a — _fixSummaryText: 전→후 단일 축(산술 항상 정합) + 신규 유입 주석 + reverted 상태', () => {
  const full = run(`_fixSummaryText({before:12, remain:0, remainOld:0, remainNew:0, rounds:1})`);
  assert.match(full, /기계검증 12건 → 전부 해소 \(재작성 1회\)/, '★ 전부 해소');
  const part = run(`_fixSummaryText({before:12, remain:2, remainOld:1, remainNew:1, rounds:2})`);
  assert.match(part, /기계검증 12건 → 잔존 2건\(신규 유입 1건 포함\) · 재작성 2회/, '★ 전→후 표기(종전 "중 6건 해소·2건 잔존" 단위 혼합 제거)');
  assert.ok(!/해소/.test(part), '★ 잔존 케이스에 항목 단위가 다른 "해소 N건" 병기 없음');
  const rvt = run(`_fixSummaryText({before:12, remain:12, reverted:true})`);
  assert.match(rvt, /이전 본문 유지\(반영 안 됨\)/, '★ 악화 롤백이 "재작성 완료"로 위장하지 않음');
});

test('★20-6b — 재작성 완료 배너: AI 반영 상태 라인 + CRITICAL 유무별 행동 안내(또 써야 하나 직답)', () => {
  assert.match(PATENT_SRC, /function _reviewStatusText\(mode\)\{/, '★ AI 반영 상태 문구 함수');
  assert.match(PATENT_SRC, /이번 진단 지적이 재작성에 반영됨/, '★ fresh 문구');
  assert.match(PATENT_SRC, /진단 실패 — 기계검증 결함만 반영됨/, '★ failed 문구(침묵 미반영 금지)');
  assert.match(PATENT_SRC, /다시 쓸 필요는 없습니다 — 잔존 /, '★ CRITICAL 0 → 게이트 통과 가능·재실행 불필요 안내');
  assert.match(PATENT_SRC, /CRITICAL '\+_fs\.crit\+'건 잔존 — 다운로드 게이트가 차단됩니다/, '★ CRITICAL 잔존 → 차단 안내');
  assert.match(PATENT_SRC, /2회 반영 후에도 남은 결함은 재실행으로 해소되지 않을 수 있습니다/, '★ 반복 재실행 무익 경고');
  // _fs 경로에서 "잔존 경고(HIGH+)"를 별도 병기하지 않음(이중 잔존 혼동 제거) — 게이트 상태로 대체
  assert.match(PATENT_SRC, /\(_fs\?\('게이트: '\+\(hi\? '경고 '\+hi\+'건\(HIGH\+\)':'통과 가능'\)\):\('잔존 경고\(HIGH\+\) '\+hi\+'건'\)\)/, '★ 이중 잔존 표기 정리');
});

test('★20-6c — 진단 신선도 배선: 실패한 진단(낡은 step_13)을 침묵 주입하지 않는다', () => {
  assert.match(PATENT_SRC, /_diagFresh=!!\(_nowTxt\.trim\(\)&&\(_nowTs!==_diagPrevTs\|\|_nowTxt!==_diagPrevTxt\)\)/, '★ 갱신 판정(타임스탬프·본문 비교)');
  assert.match(PATENT_SRC, /wfRewriteWithFixes\(\{_locked:true, reviewFresh:_diagFresh\}\)/, '★ 신선도 전달');
  assert.match(PATENT_SRC, /AI 진단이 갱신되지 않았습니다 — 기계검증 결함만 반영합니다/, '★ 실패 시 사용자 고지');
  assert.match(PATENT_SRC, /\(opts&&opts\.reviewFresh===false\)\?'failed'/, '★ failed 모드 → 주입 생략');
  assert.match(PATENT_SRC, /_pendingReviewNotes=\(_injectReview&&round===1\)/, '★ 주입 게이트가 신선도 모드를 따름');
});

test('★20-6d — 진단 결과 카드 소비 상태: 재작성 주입 시 표시, 새 진단 완료 시 리셋', () => {
  assert.match(HTML_SRC, /id="step13ConsumedNote"/, '★ 카드 내 상태 슬롯');
  assert.match(PATENT_SRC, /function _setStep13ConsumedNote\(on\)\{/, '★ 상태 헬퍼');
  assert.match(PATENT_SRC, /이 진단 지적은 방금 재작성에 반영되었습니다/, '★ 반영됨 문구(12,198자 반영 여부 불명 해소)');
  assert.match(PATENT_SRC, /재작성 <b>이전<\/b> 본문 기준 진단입니다/, '★ 신선도 캐비앳(반영 후에도 카드에 남는 이유 설명)');
  assert.match(PATENT_SRC, /if\(_injectReview\)\{ try\{ _setStep13ConsumedNote\(true\); \}catch\(_e\)\{\} \}/, '★ 주입 성공 시 표시');
  assert.match(PATENT_SRC, /if\(sid==='step_13'\)\{[^\n]*_setStep13ConsumedNote\(false\)/, '★ 새 진단 완료 → 리셋(새 지적은 아직 미반영)');
});

test('★20-6e — 동작: 잔존 케이스 토스트가 전→후 단일 축으로 나온다(단위 혼합 소멸)', async () => {
  run(`clearAllState(); selectedTitle="t"; selectedTitleType="장치"; includeMethodClaims=false;
    outputs={ step_06:"【청구항 1】 메모리를 포함하는 장치.", step_07:"도 1", step_08:"메모리(120)가 저장하고 메모리(130)가 캐시한다. 메모리(120)가 읽고 메모리(130)가 쓴다.", step_18:"메모리 : 120\\n메모리 : 130" };`);
  sandbox.App.callClaudeWithContinuation = async () => '<<<REFTABLE>>>\n[장치부호]\n(120) 메모리\n(130) 메모리\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n메모리(120)가 저장하고 메모리(130)가 캐시한다. 메모리(120)가 읽고 메모리(130)가 쓴다.\n<<<END_DEVICE_DESC>>>';
  await run('wfRewriteWithFixes()');
  const done = toasts.map(t => t.m).filter(m => /결함 반영 재작성 완료/.test(m));
  assert.ok(done.length, '★ 완료 토스트 존재');
  assert.match(done[0], /기계검증 \d+건 → 잔존 \d+건/, '★ 전→후 표기');
  assert.ok(!/건 중 \d+건 해소/.test(done[0]), '★ 단위 혼합 표기 소멸');
});

// ═══ [배치20-7] 잔존 결함의 논리적 해소 — 3-레인 분류(결정론/재작성/참고) + 정합기 판정 기준 통일 ═══
// 신고: 2회 재작성 후에도 같은 3건 잔존(단말(200) 점유·모델레지스트리 부호 2개·예시 부재).
// 규명: ① 정합기(_enforceRefPlan)가 구성부 접미 명칭만 수정 — 검증기는 전 명칭을 스캔(토큰 레벨 스캔⊋수정 비대칭).
//   ② 검증기는 공백 무시·공통접미로 중복 판정하는데 배정·정합기는 exact 비교(판정 기준 비대칭).
//   ③ 참고(리포트 전용) 항목이 잔존 집계에 동급으로 섞여 "재작성이 못 고침"으로 오독 + 참고만 남으면
//      FIX_TARGETS 가 비어 지시 없는 백지 재생성이 돌던 낭비.

test('★20-7a — 정합기 (d): 비구성 명칭의 청구 부호 점유를 박탈(문장 불변·번호만 제거)', () => {
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify('단말(200)이 데이터를 전송한다. 응답결속부(200)는 이를 검증한다. 수집부(501)는 그대로 둔다.')}, [{num:200,name:'응답결속부'}]))`));
  assert.ok(r.text.includes('단말이 데이터를 전송한다'), '★ 단말(200) → 단말 (점유 박탈 — 종전: 접미 비대칭으로 영구 잔존)');
  assert.ok(r.text.includes('응답결속부(200)는'), '★ canonical 표기는 불변');
  assert.ok(r.text.includes('수집부(501)'), '★ refPlan 밖 번호는 자동 삭제 금지(경고만) — 기존 (c) 유지');
  assert.ok((r.unknown||[]).includes('501'), '★ 미정의 번호 경고 수집');
  assert.strictEqual((r.stripped||[]).length, 1, '★ 박탈 이력 1건 기록');
});

test('★20-7b — 정합기 (b\'): 명칭 조회 퍼지화(공백 무시·공통접미 ≥5자 — 검증기와 동일 기준)', () => {
  const r1 = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify('모델레지스트리(250)를 갱신한다.')}, [{num:150,name:'모델 레지스트리'}]))`));
  assert.ok(r1.text.includes('모델레지스트리(150)'), '★ 공백 변형 명칭 → refPlan 번호로 재번호(종전: exact 미스 → (c) 방치 → dupassign 영구 잔존)');
  const r2 = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify('통합모델레지스트리(250)를 조회한다.')}, [{num:150,name:'모델레지스트리'}]))`));
  assert.ok(r2.text.includes('(150)'), '★ 공통접미(≥5자) 변형도 재번호');
});

test('★20-7c — 배정기: 공백-무시 dedupe(같은 구성의 표기 변형에 부호 2개 배정 원천 차단)', () => {
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify('【청구항 1】 모델 레지스트리(150)를 포함하는 장치.\n【청구항 2】 제 1 항에 있어서, 상기 모델레지스트리는 버전을 저장하는 장치.')}))`));
  const regEntries = plan.filter(p => String(p.name).replace(/\s+/g,'').includes('모델레지스트리'));
  assert.strictEqual(regEntries.length, 1, `★ 공백 변형 1건만 배정(실제 ${regEntries.length} — 종전: 2개 배정 → dupassign 구조 발생)`);
});

test('★20-7d — 3-레인 집계: 참고(리포트 전용) 분리 + 참고만 남으면 재라운드 중단', () => {
  const only = run(`_fixSummaryText({before:10, remain:1, remainFix:0, remainReport:1, rounds:2})`);
  assert.match(only, /기계검증 10건 → 재작성 대상 전부 해소 · 참고\(리포트 전용\) 1건/, '★ 재작성 몫은 다 했음을 명시(종전: "잔존 1건"으로 실패처럼 읽힘)');
  const mix = run(`_fixSummaryText({before:10, remain:3, remainFix:2, remainReport:1, remainOld:1, remainNew:1, rounds:2})`);
  assert.match(mix, /잔존 2건\(신규 유입 1건 포함\) · 참고 1건 · 재작성 2회/, '★ 레인 분리 표기');
  assert.match(PATENT_SRC, /if\(round>0&&!remain\.some/, '★ 참고만 남으면 재라운드 중단(빈 FIX_TARGETS 백지 재생성 방지)');
  assert.match(PATENT_SRC, /const _remainRep=remain\.length-_remainFixArr\.length;/, '★ 레인 분리 집계');
  assert.match(PATENT_SRC, /남은 '\+_rrp\+'건은 참고\(리포트 전용\) 권장 항목/, '★ 배너 행동 안내가 참고 레인을 직답');
  assert.match(PATENT_SRC, /const _REPORT_ONLY_CHECKS = new Set\(\['title_generation_suspect','example_missing'\]\)/, '★ 단일 출처 집합');
  assert.match(PATENT_SRC, /const _UNFIXABLE_BY_REWRITE=\(typeof _REPORT_ONLY_CHECKS!=='undefined'\)\?_REPORT_ONLY_CHECKS/, '★ FIX_TARGETS 제외 집합과 동일 출처');
});

test('★20-7e — ⑤ 완성본 패널: 참고 배지·안내 분리(재작성 대상과 동급 표기 해소)', () => {
  assert.match(PATENT_SRC, /const _rep=\(typeof _REPORT_ONLY_CHECKS!=='undefined'\)&&_REPORT_ONLY_CHECKS\.has\(i\.check\)/, '★ 항목별 참고 판별');
  assert.match(PATENT_SRC, /④ 재작성 대상이 아닌 권장 확인 항목입니다/, '★ 항목 하단 설명');
  assert.match(PATENT_SRC, /참고 항목<\/b>\(예시 보충 권장 등/, '★ 경로 안내에 참고 레인 별도 문단');
});
