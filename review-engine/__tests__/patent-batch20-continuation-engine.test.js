/**
 * review-engine/__tests__/patent-batch20-continuation-engine.test.js
 * ★ 배치 20-1 — v20 이어쓰기 엔진 수정(통합 생성 25분+ 지연의 1차 원인).
 *   실측 근거(운영 콘솔): cohesion 목표 22천자+인데 전 호출이 8192 토큰으로 나가 절단→이어쓰기 6회가
 *   구조적으로 발동했고("[v20 이어쓰기] 도 1 재시작 차단 — 987/334/198/68자까지만 사용" 반복),
 *   진단 로그는 항상 "이어쓰기=0회, finish_reason=?"(lastMeta 미기록)로 실명 상태였다.
 *   원인: 00-state-and-concepts.js 의 오버라이드가 (prompt, pid) 2인자라
 *     ① 05가 넘기는 safeMaxTokensLarge()=16000 유실(전 호출 기본 8192) — 15I-1c 사문화
 *     ② lastMeta 미기록 — 15I-1a 절단 진단 실명
 *     ③ 이어쓰기 규칙 컨텍스트가 원본 프롬프트 앞 800자뿐 — 끝에 붙는 분할 범위 제한·센티넬 계약 유실
 *        → 모델이 문서를 도 1부터 재시작 → 산출물 대부분 폐기하며 6회 완주(낭비 루프)
 *   수정: 3인자 시그니처 + maxTokens 전달, lastMeta 기록, 규칙 컨텍스트에 프롬프트 끝 700자 포함,
 *     재시작·무진전 연속 2회 시 조기 종료.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);

let sandbox; let calls = [];
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '' });
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
beforeEach(() => { calls = []; });

// callClaude 스텁 — 큐에서 응답을 꺼내며 (prompt, maxTokens)를 기록
function stubClaude(queue) {
  sandbox.App.callClaude = async (prompt, maxTokens) => {
    calls.push({ prompt, maxTokens });
    return queue.length > 1 ? queue.shift() : queue[0];
  };
}
const invoke = (prompt, pid, maxTok) => sandbox.App.callClaudeWithContinuation(prompt, pid, maxTok);

// ═══ ① maxTokens 전달 ═══

test('★20-1a — 3번째 인자 maxTokens가 최초 호출과 이어쓰기 호출 모두에 전달된다', async () => {
  stubClaude([
    { text: '본문 첫 부분이다. 이어서 계속 작성될 예정이다.', stopReason: 'max_tokens' },
    { text: '이어진 나머지 본문이다. 충분히 긴 텍스트로 마무리한다. '.repeat(5), stopReason: 'end_turn' },
  ]);
  await invoke('규칙 앞부분 '.repeat(300), 'pid_x', 16000);
  assert.strictEqual(calls.length, 2, '최초 1 + 이어쓰기 1');
  assert.strictEqual(calls[0].maxTokens, 16000, '★ 최초 호출에 16000 전달(종전: 인자 유실 → 기본 8192)');
  assert.strictEqual(calls[1].maxTokens, 16000, '★ 이어쓰기 호출에도 16000 전달');
});

// ═══ ② lastMeta 기록 (15I-1a 계약 복원) ═══

test('★20-1b — lastMeta{stopReason·attempts·truncated·length} 기록으로 절단 진단 복원', async () => {
  stubClaude([
    { text: '앞부분 텍스트. 계속 이어질 내용이 뒤에 남아 있는 상태다.', stopReason: 'max_tokens' },
    { text: '마무리 텍스트다. 정상 종결로 끝난다. '.repeat(5), stopReason: 'end_turn' },
  ]);
  const full = await invoke('P'.repeat(2000), 'pid_x', 16000);
  const meta = sandbox.App.callClaudeWithContinuation.lastMeta;
  assert.ok(meta, '★ lastMeta 존재(종전: 미기록 → 진단 "0회, finish_reason=?")');
  assert.strictEqual(meta.attempts, 1, '★ 이어쓰기 횟수 기록');
  assert.strictEqual(meta.stopReason, 'end_turn', '★ 마지막 finish_reason 기록');
  assert.strictEqual(meta.truncated, false, '★ 절단 아님');
  assert.strictEqual(meta.length, full.length, '★ 최종 길이 기록');
});

// ═══ ③ 규칙 컨텍스트에 프롬프트 끝부분(범위 제한·센티넬 계약) 포함 ═══

test('★20-1c — 이어쓰기 프롬프트에 원본 규칙 앞 800자 + 끝 700자(분할 범위 지시)가 함께 실린다', async () => {
  const head = 'HEAD_RULE_MARKER 원본 규칙의 앞부분. ';
  const tail = ' 분할 범위 제한: 이번 응답은 DEVICE_DESC 블록까지만 출력하라. TAIL_RULE_MARKER';
  const prompt = head + '중간 내용 '.repeat(500) + tail;   // > 1500자
  stubClaude([
    { text: '도 1을 참조하면, 시스템(100)의 구성이 도시되어 있다. 이하 상세히 설명한다.', stopReason: 'max_tokens' },
    { text: '이어지는 설명이다. 추가 구성요소를 상세히 서술하며 정상적으로 마무리한다. '.repeat(4), stopReason: 'end_turn' },
  ]);
  await invoke(prompt, 'pid_x', 16000);
  const contPrompt = calls[1].prompt;
  assert.ok(contPrompt.includes('HEAD_RULE_MARKER'), '★ 규칙 앞부분 포함(기존 유지)');
  assert.ok(contPrompt.includes('TAIL_RULE_MARKER'), '★ 규칙 끝부분 포함(종전: 앞 800자만 → 범위 지시 유실로 도 1 재시작 유발)');
  assert.ok(/처음부터 다시 시작하지 마라/.test(contPrompt), '★ 재시작 금지 명시');
  assert.ok(/센티넬/.test(contPrompt), '★ 센티넬 블록 재출력 금지 명시');
});

// ═══ ④ 재시작 연속 2회 → 조기 종료 (낭비 루프 차단) ═══

test('★20-1d — "도 N 재시작"이 연속 2회면 6회 완주 대신 조기 종료한다', async () => {
  const restartText = '추가 설명 문장이 백여 자 이상 이어진 뒤에 문제가 발생한다. '.repeat(3) + '도 1을 참조하면, 다시 처음부터 설명한다. '.repeat(10);
  stubClaude([
    { text: '도 1을 참조하면, 시스템(100)이 도시되어 있다. 본 발명의 구성을 설명한다.', stopReason: 'max_tokens' },
    { text: restartText, stopReason: 'max_tokens' },   // 재시작 1 (차단·채택 후 계속)
    { text: restartText, stopReason: 'max_tokens' },   // 재시작 2 → 조기 종료
    { text: restartText, stopReason: 'max_tokens' },   // 도달하면 안 됨
  ]);
  await invoke('규칙 '.repeat(600), 'pid_x', 16000);
  assert.strictEqual(calls.length, 3, '★ 최초 1 + 이어쓰기 2에서 종료(종전: 6회 완주하며 산출물 폐기 반복)');
});

// ═══ ⑤ 무진전(채택 <80자) 연속 2회 → 조기 종료 ═══

test('★20-1e — 채택분이 80자 미만으로 연속 2회면 조기 종료한다', async () => {
  stubClaude([
    { text: '첫 응답 본문이다. 시스템의 구성요소를 설명하기 시작한다.', stopReason: 'max_tokens' },
    { text: '짧은 조각.', stopReason: 'max_tokens' },     // 무진전 1
    { text: '또 짧은 조각.', stopReason: 'max_tokens' },  // 무진전 2 → 조기 종료
    { text: '도달하면 안 되는 응답. '.repeat(20), stopReason: 'max_tokens' },
  ]);
  const full = await invoke('규칙 '.repeat(600), 'pid_x', 16000);
  assert.strictEqual(calls.length, 3, '★ 최초 1 + 이어쓰기 2에서 종료');
  assert.ok(full.includes('짧은 조각'), '★ 조기 종료 직전 채택분은 보존');
});

// ═══ ⑥ 정상 완결 경로 회귀 — 겹침 제거·단어 이어붙임 유지 ═══

test('회귀 — 겹침(overlap) 제거와 정상 이어붙임은 기존대로 동작한다', async () => {
  const first = '시스템(100)은 데이터 수집부(110)를 포함하며, 수집된 데이터는 전처리';
  stubClaude([
    { text: first, stopReason: 'max_tokens' },
    { text: '수집된 데이터는 전처리 모듈로 전달되어 정규화 과정을 거친 후 저장부에 기록된다. 이로써 처리가 완결된다.', stopReason: 'end_turn' },
  ]);
  const full = await invoke('P'.repeat(2000), 'pid_x', 16000);
  const dup = (full.match(/수집된 데이터는 전처리/g) || []).length;
  assert.strictEqual(dup, 1, '★ 겹침 문구가 1회만 남는다(중복 제거 회귀)');
  assert.ok(full.endsWith('완결된다.'), '★ 정상 종결');
});

// ═══ ⑦ 소스 계약 — 05 호출부와의 배선 ═══

test('★ 소스 — 05가 safeMaxTokensLarge를 cohesion 호출에 넘기고, 진단 로그가 lastMeta를 읽는다', () => {
  assert.match(PATENT_SRC, /callClaudeWithContinuation\s*=\s*async function\(prompt,\s*pid,\s*maxTokens\)/, '★ 오버라이드 3인자 시그니처');
  assert.match(PATENT_SRC, /safeMaxTokensLarge/, '★ 05 호출부의 대용량 상한 사용 유지');
  assert.match(PATENT_SRC, /callClaudeWithContinuation\.lastMeta\s*=/, '★ lastMeta 기록 존재');
});
