/**
 * review-engine/__tests__/patent-batch7-rerun-policy.test.js
 *
 * ★ 배치 7 — 통합작성 재실행 정책 + §6-6 서수 우회 봉쇄 (docD 실측 근거).
 *   N1(i) 재실행 모달: 기존 체인 산출물 존재 시 "이어하기/전체 새로 생성" 확인 — 전체 선택 시
 *        체인 계열 outputs 초기화(step_09·step_13_applied 섀도잉 소스 포함), 이어하기는 현행+안내 1회.
 *   N2  서수(제N)+총칭 우회 봉쇄(컨셉 프롬프트 03·05) + 방어망 회귀(확장 캡처의 숫자-어절 정지로
 *        제1~제N 총칭이 동일 base로 병합 → refnum_generic_series 발화 — 명시적 제N 정규화 없이 성립).
 *   N3  1~5 generic 부호 차단: 파서 REF 범위 검증(장치 2~4자리만 수용) + 도면 설계 프롬프트 100번대 명시.
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
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
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

// ─────────── N1 — 재실행 정책(전체 재생성 헬퍼 + 모달 배선) ───────────

test('★ N1(→배치11 A) — _resetUnifiedChainOutputs: 산출 계열 12키 초기화, 명칭후보(step_01)·비체인 보존', () => {
  const keys = ['step_06', 'step_10', 'step_07', 'step_11', 'step_08', 'step08_device', 'step_09', 'step_12', 'step_18', 'step_13', 'step_13_applied', 'step_13_applied_method'];
  run('clearAllState()');
  run(keys.map(k => `outputs[${JSON.stringify(k)}]="x"; outputTimestamps[${JSON.stringify(k)}]=1;`).join('') + 'outputs.step_01="명칭후보"; outputs.step_02="기술분야";');
  run('_resetUnifiedChainOutputs()');
  keys.forEach(k => {
    assert.equal(run(`outputs[${JSON.stringify(k)}]===undefined`), true, '★ ' + k + ' 삭제');
    assert.equal(run(`outputTimestamps[${JSON.stringify(k)}]===undefined`), true, '★ ' + k + ' 타임스탬프 삭제');
  });
  assert.equal(run('outputs.step_01'), '명칭후보', '★ [배치11 A] 명칭후보 보존(입력 — 초기화 대상 아님)');
  assert.equal(run('outputs.step_02'), '기술분야', '★ D-스텝 보존');
});
test('★ N1 — 섀도잉 소스(step_09·step_13_applied) 포함 확인 — getLatestDescription이 새 step_08을 보게 됨', () => {
  run('clearAllState()');
  run('outputs.step_08="구본"; outputs.step_09="구본+수식"; outputs.step_13_applied="구본+검토"; outputTimestamps.step_13_applied=9; outputTimestamps.step_09=8; outputTimestamps.step_08=1;');
  assert.equal(run('getLatestDescription()'), '구본+검토', '★ 전제: 섀도잉 재현(applied 우선)');
  run('_resetUnifiedChainOutputs(); outputs.step_08="신본";');
  assert.equal(run('getLatestDescription()'), '신본', '★ 초기화 후 새 상세설명이 최신본');
});
test('★ N1(→배치11) 소스 — 산출물 계열 판정 + 위저드 opts 기반 전체/이어하기(브라우저 confirm 폐기)', () => {
  assert.match(PATENT_SRC, /const _hasPrev=\['step_06','step_07','step_08','step_10','step_11','step_12'\]\.some/, '★ [배치11 A] 산출물 계열만 판정(step_01 제외)');
  assert.match(PATENT_SRC, /const _full=!!\(_wizOpts&&_wizOpts\.mode==='full'\);/, '★ 위저드 모드로 전체/이어하기 결정');
  assert.match(PATENT_SRC, /if\(_full\)_resetUnifiedChainOutputs\(\);/, '★ 전체 → 초기화');
  assert.match(PATENT_SRC, /이어하기 — 빈 단계만 생성합니다\(기존 산출물 재사용/, '★ 이어하기 안내 토스트(배치15A: 빈 단계만)');
  assert.ok(!/confirm\('기존 생성 산출물이 있습니다/.test(PATENT_SRC), '★ 구 confirm 모달 제거');
});

// ─────────── N2 — 서수 우회 봉쇄(프롬프트) + 방어망 회귀 ───────────

test('★ N2 소스 — 03·05 컨셉 프롬프트 양쪽에 서수+총칭 금지·실명 예시·빈 라벨 지침', () => {
  const ordinalBan = PATENT_SRC.match(/서수\(제1\/제2\/제N\)\+총칭 조합도 금지/g) || [];
  assert.ok(ordinalBan.length >= 2, '★ 금지 문구 2곳(03 메인 + 05 캐스케이드) — 실측 ' + ordinalBan.length);
  assert.ok((PATENT_SRC.match(/대본 입력 패널, 라우팅 결과 카드, 승인 버튼/g) || []).length >= 2, '★ 실명 예시 2곳');
  assert.ok((PATENT_SRC.match(/라벨을 비워 두라\(빈 라벨은 시스템이 처리/g) || []).length >= 2, '★ 빈 라벨 지침 2곳');
});
test('★ N2 방어망 회귀 — docD형 "제1~제7 UI 화면 요소(51~57)" → generic_series 1건·dupassign 0', () => {
  const body = Array.from({ length: 7 }, (_, i) => `제${i + 1} UI 화면 요소(${51 + i})는 화면을 표시한다.`).join(' ');
  const table = Array.from({ length: 7 }, (_, i) => `제${i + 1}UI화면요소 : ${51 + i}`).join('\n');
  const spec = `【발명을 실시하기 위한 구체적인 내용】\n${body}\n\n【부호의 설명】\n${table}`;
  const ser = runJSON(`validateSpecification(${JSON.stringify(spec)}).filter(function(i){return i.check==="refnum_generic_series";})`);
  const dup = runJSON(`validateSpecification(${JSON.stringify(spec)}).filter(function(i){return i.check==="refnum_dupassign";})`);
  assert.equal(ser.length, 1, '★ 시리즈 1건 압축(확장 캡처의 숫자-어절 정지로 제N 접두가 제외 → 동일 base "UI화면요소" 병합)');
  assert.ok(/UI화면요소/.test(ser[0].message) && /51~57|7개/.test(ser[0].message), '★ base·범위 보고');
  assert.equal(dup.length, 0, '★ dupassign 미발화(제N 정당 구성 FP 없음)');
});

// ─────────── N3 — 1~5 generic 부호 차단(파서 범위 + 프롬프트) ───────────

test('★ N3 — 파서 REF 범위: 1자리 장치부호는 refMap 미진입(2~4자리·S### 만 수용)', () => {
  const bundle = '<<<REFTABLE>>>\n[장치부호]\n(1) 시스템\n(2) 입력 데이터\n(3) 처리 모듈\n(4) 출력 데이터\n(5) 저장 영역\n(100) 제어부\n(110) 통신부\n[방법단계]\n(S410) 수신 단계\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n도 1을 참조하면, 제어부(100)는 처리하고 통신부(110)는 전송한다.\n<<<END_DEVICE_DESC>>>';
  const r = JSON.parse(run('JSON.stringify((function(){var r=parseCohesiveBundle(' + JSON.stringify(bundle) + ');return {refCount:r.refMap.size,keys:[...r.refMap.keys()],notInTable:r.report.notInTable};})())'));
  assert.deepEqual(r.keys.sort(), ['100', '110', 'S410'], '★ 1~5 배제, 정상 부호·S단계만 수용');
  assert.equal(r.notInTable.length, 0, '★ 본문 정합 유지');
});
test('★ N3 — 본문이 1자리 부호를 쓰면 notInTable 게이트로 표면화(무단 통과 금지)', () => {
  const bundle = '<<<REFTABLE>>>\n[장치부호]\n(1) 시스템\n(100) 제어부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n도 1을 참조하면, 시스템(1)은 제어부(100)를 포함한다.\n<<<END_DEVICE_DESC>>>';
  const r = JSON.parse(run('JSON.stringify(parseCohesiveBundle(' + JSON.stringify(bundle) + ').report.notInTable)'));
  assert.deepEqual(r, ['1'], '★ (1)이 미정의로 잡혀 커밋 게이트가 차단');
});
test('★ N3 소스 — 도면 설계 프롬프트에 100번대 관례 명시', () => {
  assert.match(PATENT_SRC, /장치 참조번호는 반드시 100 이상의 2~4자리 숫자만 사용하라\(100번대부터\)/, '★ 범위 명시');
  assert.match(PATENT_SRC, /generic 번호\) 절대 금지/, '★ 1~99 generic 금지');
});
