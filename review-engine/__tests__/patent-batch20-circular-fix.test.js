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

// ═══ [배치20-8] 본문 삭제 사고 근본 수정 — 정합기 명칭 캡처의 절 포섭 차단 ═══
// 외부 검토(v1/v2 .doc)에서 발견된 문서 훼손 4종("요청 스냅샷은" 목적어 탈락 15곳·"경우" 탈락·제2 상태
// 조건절 통삭제·"n_min은"→"n_" 수식 주어 훼손·"평가 지표 전부(240)" 개념 부호)을 코드로 전수 재현해
// 범인을 확정: LLM 이 아니라 _enforceRefPlan 규칙 (a). 명칭 캡처(_NAME_ALT/numRe/compRe)의 문자클래스가
// 공백을 포함해 절 전체를 '명칭'으로 오인 → _MOD_STRIP_RE 가 못 끊는 어미(되어·이면서 등)면 정규화가
// 절을 그대로 명칭으로 남김 → canonical 치환이 절(목적어·조건절·수식 주어)을 삭제. 수정: 후방 토큰 워크
// (검증기 §2.4 D2·19b-2 와 동일 규칙)로 명칭을 최종 명사구로 한정 + lead 위치 기반 보존 + 배정·부호표
// 폴백·영속 refPlan 치유까지 같은 정규화로 통일.

test('★20-8a — 정합기가 목적어·"경우"를 더 이상 삭제하지 않는다(검토 문서 실측 문형 불변)', () => {
  const plan = [{num:110,name:'요청 조립부'},{num:120,name:'세그먼트 색인부'},{num:150,name:'순위 산출부'}];
  const body = '요청 조립부(110)가 생성한 요청 스냅샷은 세그먼트 색인부(120)로 전달되고, 모델이 가용한 경우 순위 산출부(150)는 학습 경로를 선택한다.';
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify(body)}, ${JSON.stringify(plan)}))`));
  assert.strictEqual(r.text, body, '★ 불변(종전: "요청 스냅샷은 "·"경우 " 삭제 — fixes:2 로 "교정" 위장)');
  assert.strictEqual(r.fixes, 0, '★ 교정 0건');
});

test('★20-8b — 조건절 통삭제 재발 방지(제2 상태 정의 소실 실측 문형 불변)', () => {
  const plan = [{num:170,name:'조건 완화 처리부'}];
  const body = '임계값 이상인 경우 제1 상태로 결정되어 완화 없이 순위 산출 결과가 확정되고, 임계값 미만이면서 동의를 나타내는 경우 제2 상태로 결정되어 조건 완화 처리부(170)가 호출되며, 임계값 미만이면서 동의를 나타내지 아니하는 경우 제3 상태로 결정된다.';
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify(body)}, ${JSON.stringify(plan)}))`));
  assert.strictEqual(r.text, body, '★ 불변(종전: "…되어" 를 _MOD_STRIP 이 못 끊어 제2 상태 조건절 전체가 canonical 로 치환·소실)');
});

test('★20-8c — 수학식 정의 주어 보존("n_min은"·"제1 경계값과 제2 경계값은" 실측 문형 불변)', () => {
  const plan = [{num:130,name:'데이터 저장부'}];
  const body = '관측 표본 수 하한으로서 n_min은 데이터 저장부(130)에 외부화된 값이다. 제1 경계값과 제2 경계값은 데이터 저장부(130)에 외부화된 정수형 등급 경계값이다.';
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify(body)}, ${JSON.stringify(plan)}))`));
  assert.strictEqual(r.text, body, '★ 불변(종전: "n_min은"→"n_"·경계값 주어 통삭제)');
});

test('★20-8d — 배정기: 절 포섭·비구성 어미 차단(쓰레기 canonical 원천 차단)', () => {
  const claim = '【청구항 1】 승격 판정 결과를 담은 모델 카드를 구성하여 모델 레지스트리(150)에 등재하는 모델 카드 등재부(250); 및 복수의 평가 지표 전부(240)에 대하여 판정하는 승격 게이트부(230)를 포함하는 서버.';
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify(claim)}))`));
  assert.ok(!plan.some(p => /전부/.test(p.name)), '★ "복수의 평가 지표 전부" 미배정(개념에 부호 부여 결함 차단 — LLM 이 [확정 부호표]를 따라 재생산하던 경로)');
  assert.ok(plan.some(p => p.num === 150 && p.name === '모델 레지스트리'), '★ 관형절 미포섭 등재');
  assert.ok(plan.some(p => p.num === 250 && p.name === '모델 카드 등재부'), '★ 정상 구성부 보존');
  assert.ok(plan.every(p => !/(상기 |를 $|은 $|가 $)/.test(p.name + ' ')), '★ 조사·지시어 잔재 0');
});

test('★20-8e — _normComponentName 후방 워크 + 영속 refPlan 치유(_sanitizeRefPlan)', () => {
  assert.strictEqual(run(`_normComponentName(${JSON.stringify('가 생성한 요청 스냅샷은 세그먼트 색인부')})`), '세그먼트 색인부', '★ 조사-끝 어절에서 중단');
  assert.strictEqual(run(`_normComponentName(${JSON.stringify('임계값 미만이면서 동의를 나타내는 경우 제2 상태로 결정되어 조건 완화 처리부')})`), '조건 완화 처리부', '★ "되어" 등 미등재 어미도 워크가 처리');
  assert.strictEqual(run(`_normComponentName(${JSON.stringify('표본 충분성 판정부')})`), '표본 충분성 판정부', '★ 정상 다단어 명칭 불변');
  const dirty = [{num:150,name:'모델 카드를 상기 모델 레지스트리'},{num:250,name:'모델 카드 등재부'},{num:240,name:'복수의 평가 지표 전부'},{num:'S110',name:'수집하는 단계'}];
  const s = JSON.parse(run(`JSON.stringify(_sanitizeRefPlan(${JSON.stringify(dirty)}))`));
  assert.ok(s.some(p => p.num === 150 && p.name === '모델 레지스트리'), '★ 영속 쓰레기 명칭 재정규화(구버전 프로젝트 치유)');
  assert.ok(!s.some(p => /전부/.test(p.name)), '★ 비구성 항목 제거');
  assert.ok(s.some(p => p.num === 'S110' && p.name === '수집하는 단계'), '★ 방법 단계(S)는 원형 보존');
  assert.match(PATENT_SRC, /refPlan=_sanitizeRefPlan\(refPlan\); return refPlan;/, '★ 로드 경로 배선');
});

test('★20-8f — 부호표 폴백(_refPairsFromText)도 동일 정규화(step_18 오염 차단) + 정당 정합 유지', () => {
  const pairs = JSON.parse(run(`JSON.stringify(_refPairsFromText(${JSON.stringify('판정 직후 상기 임계값의 충족 여부 판정부(171)가 동작한다. 임계값의 충족 여부 판정부(171)는 결과를 낸다.')}))`));
  const p171 = pairs.find(p => p.ref === 171);
  assert.ok(p171 && !/직후|상기/.test(p171.name), `★ 절 잔재 없는 명칭(실제 "${p171 && p171.name}" — 종전: "직후 상기 임계값의 충족 여부" 류가 부호의 설명에 등재)`);
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify('수신부(120)는 패킷을 받는다.')}, ${JSON.stringify([{num:120,name:'세그먼트 색인부'}])}))`));
  assert.ok(r.text.includes('세그먼트 색인부(120)'), '★ 정당한 canonical 치환(명칭만 다른 구성부 접미)은 유지 — 정합 기능 자체는 보존');
});

// ═══ [배치20-9] 3차 외부 검토(별개 출원 v3) 반영 — 잔존 근본 원인 3건 종결 ═══
// 검토 확인: "검증 중 신규 파손 3곳"(완화 상태 조건절 소실·허용 표현 집합 목적어 소실·나열 오류)은 전부
// 20-8 이 절단한 메커니즘의 산물(구엔진 산출 문서) — 현행 코드 재현 시험으로 불변 확인. 이번에 추가로 종결:
// ① "사상 및 필드" 오기는 LLM 이 아니라 우리 정형문(STEP8_SUFFIX)에 박힌 원본 오기(3개 문서 공통 재발 원인).
// ② "복수의 평가 지표 전부(250)" — 배정 차단(20-8) 후에도 구문서·재생산으로 본문 잔존 → 번호 박탈로 종결.
// ③ 도면 소개문 "요청 조립부(110)의 순위 산출부(150)" 소속 오류 — 프롬프트에 [대상] 주어 규칙 명문화.

test('★20-9a — 정형문 오기 원본 수정: "사상 및 필드" → "사상 및 범위"(3개 문서 공통 재발의 근원)', () => {
  assert.ok(PATENT_SRC.includes('사상 및 범위로부터 벗어나지 않는'), '★ 표준 관용구로 교정');
  assert.ok(!PATENT_SRC.includes('사상 및 필드'), '★ 오기 잔존 0(정형문 STEP8_SUFFIX 가 원본이었음 — LLM 오기가 아님)');
});

test('★20-9b — 구엔진 신규 파손 3형이 현행 정합기에서 재발하지 않는다(검토 실측 문형 불변)', () => {
  const plan = [{num:120,name:'데이터 저장부'},{num:150,name:'순위 산출부'},{num:170,name:'조건 완화 처리부'},{num:200,name:'서술 게이팅부'}];
  const s1 = '관측 표본 수가 임계값 미만이고 조건 완화 동의 정보가 동의를 나타내면 완화 상태로 결정되어 조건 완화 처리부(170)가 호출된다.';
  const s2 = '신뢰도 등급에 대응하여 미리 정의된 허용 표현 집합을 데이터 저장부(120)로부터 조회하고, 그 집합에 속하는 표현을 이용하여 서술 정보를 생성한다.';
  const s3 = '순위 산출부(150)의 산출 경로 정보 및 서술 게이팅부(200)의 서술 정보를 하나의 응답 객체로 결속하고';
  [s1,s2,s3].forEach((s,i) => {
    const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify(s)}, ${JSON.stringify(plan)}))`));
    assert.strictEqual(r.text, s, `★ 문형 ${i+1} 불변(구엔진: 완화 상태 조건절/허용 표현 집합 목적어/"산출 경로 정보 및" 삭제)`);
  });
});

test('★20-9c — 비구성 어미 번호 박탈은 refPlan 소유 여부와 무관("전부(250)" 종결)', () => {
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan(${JSON.stringify('복수의 평가 지표 전부(250)에 대하여 판정하고, 승격 게이트부(270)가 동작한다.')}, ${JSON.stringify([{num:270,name:'승격 게이트부'}])}))`));
  assert.ok(r.text.includes('복수의 평가 지표 전부에 대하여'), '★ (250) 박탈 — 개념은 도면요소 불가 확정이라 "plan 밖 자동 삭제 금지"의 안전한 예외');
  assert.ok(r.text.includes('승격 게이트부(270)'), '★ 정상 구성부 불변');
  assert.ok((r.stripped||[]).some(s => /전부/.test(s)), '★ 박탈 이력 기록');
});

test('★20-9d — 도면 소개문 프롬프트에 [대상] 소속 규칙 명문화(하위 구성부 소유격 오류 예방)', () => {
  assert.match(PATENT_SRC, /소속을 뒤바꾸는 표현을 금지/, '★ "A부(110)의 B부(150)" 소속 오류 금지 규칙');
  assert.match(PATENT_SRC, /본 발명의 일 실시예에 따른 \$\{getDeviceSubject\(\)\}\(100\)/, '★ 세부 도면 [대상]의 기본 주어 지정');
});
