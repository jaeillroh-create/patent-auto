/**
 * review-engine/__tests__/llm-config-ui.test.js
 * L-T2 설정 UI — 키개수 토글·역할 드롭다운(shared/common.js, renderLlmRoleArea 등).
 *
 * 규칙(1키 전역/2키 배정)은 L-T1 헬퍼가 진실원천. 여기서는 UI 가 그 헬퍼를 타고
 * 키개수 변동(0→1, 1→2, 2→1)에 실시간으로 노출/숨김 전환하는지 + 옵션=입력 provider만 검증.
 * apiKeys 단일소스: onLlmKeyInput 이 apiKeys 를 갱신 → getEnteredProviders 가 라이브로 반영.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert'; // 비-strict: vm realm 객체 구조 비교
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let App, sandbox, dom;

// 최소 DOM 스텁 — getElementById 레지스트리(value/innerHTML 가변).
function makeDom() {
  const reg = {};
  const mk = () => ({ value: '', innerHTML: '', style: {}, placeholder: '' });
  ['llmRoleArea','llmKeyClaude','llmKeyGpt','llmKeyGemini','profileApiKeyInput',
   'profileSettingsModal','providerCards','profileApiKeyHint','profileCurrentStatus'].forEach(id => { reg[id] = mk(); });
  return { reg, getElementById: (id) => reg[id] || null };
}

before(() => {
  const src = readFileSync(path.join(REPO_ROOT, 'shared/common.js'), 'utf8');
  dom = makeDom();
  const stubSb = { from: () => ({ update: () => ({ eq: async () => ({}) }) }), auth: { signOut: async () => ({}) } };
  sandbox = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN,
    setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => dom.getElementById(id), createElement: () => ({ style: {} }) },
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.sb = stubSb;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'common.js' });
  App = sandbox.window.App;
});

// 각 테스트 전: 3키 비우고 역할영역 초기화(독립성).
beforeEach(() => {
  App.onLlmKeyInput('claude', '');
  App.onLlmKeyInput('gpt', '');
  App.onLlmKeyInput('gemini', '');
});

const area = () => dom.reg.llmRoleArea.innerHTML;
const selectCount = (html) => (html.match(/<select/g) || []).length;

test('키 0개 → "입력하세요" 안내, 드롭다운 없음', () => {
  App.renderLlmRoleArea();
  assert.ok(area().includes('1개 이상 입력'), '0키 안내');
  assert.equal(selectCount(area()), 0, '드롭다운 없음');
});

test('★ 0→1 (키 추가): 안내가 전역적용으로, 드롭다운 숨김', () => {
  App.onLlmKeyInput('gpt', 'sk-gpt'); // 0→1, oninput 이 renderLlmRoleArea 자동 호출
  assert.ok(area().includes('단독') && area().includes('자동 적용'), 'GPT 단독 전역 안내');
  assert.ok(area().includes('GPT'), 'provider 라벨');
  assert.equal(selectCount(area()), 0, '★ 1키: 드롭다운 완전 숨김(자동 전역)');
  assert.deepEqual(App.getEnteredProviders(), ['gpt'], 'apiKeys 단일소스에 반영');
});

test('★ 1→2 (키 추가): 드롭다운 6개 노출, 옵션=입력된 2 provider만', () => {
  App.onLlmKeyInput('gpt', 'sk-gpt');     // 1키
  App.onLlmKeyInput('claude', 'sk-ant');  // 1→2
  assert.equal(selectCount(area()), 6, '6역할 드롭다운 노출');
  assert.ok(area().includes('value="claude"'), 'claude 옵션');
  assert.ok(area().includes('value="gpt"'), 'gpt 옵션');
  assert.ok(!area().includes('value="gemini"'), '★ 키 없는 gemini 는 옵션에서 제외');
});

test('★ 2→1 (키 삭제): 드롭다운 깨끗이 사라지고 1키 전역모드', () => {
  App.onLlmKeyInput('gpt', 'sk-gpt');
  App.onLlmKeyInput('claude', 'sk-ant'); // 2키 → 드롭다운
  assert.equal(selectCount(area()), 6, '사전: 2키 드롭다운');
  App.onLlmKeyInput('claude', '');       // 2→1 (claude 삭제)
  assert.equal(selectCount(area()), 0, '★ 2→1: 드롭다운 완전 제거');
  assert.ok(area().includes('단독') && area().includes('GPT'), '남은 GPT 단독 전역');
  assert.deepEqual(App.getEnteredProviders(), ['gpt'], '삭제 반영');
});

test('6역할 라벨 한글 표시 + 역할 id 6개', () => {
  App.onLlmKeyInput('claude', 'sk-ant');
  App.onLlmKeyInput('gpt', 'sk-gpt'); // 2키
  const h = area();
  assert.ok(h.includes('심사관 A') && h.includes('진보성'), 'examiner_A 한글');
  assert.ok(h.includes('출원인측 변리사'), 'attorney_author 한글');
  assert.ok(h.includes('기술분야 전문가'), 'domain_expert 한글');
  assert.equal(selectCount(h), 6, '6역할 전부');
});

test('역할 드롭다운 변경 → setRoleAssignment 반영(2키, 선택값이 다음 렌더에 유지)', () => {
  App.onLlmKeyInput('claude', 'sk-ant');
  App.onLlmKeyInput('gpt', 'sk-gpt'); // entered=[claude,gpt], 기본 전부 claude
  assert.equal(App.getRoleAssignments().examiner_A, 'claude', '기본=첫 입력키');
  App.onLlmRoleChange('examiner_A', 'gpt'); // 사용자 변경
  assert.equal(App.getRoleAssignments().examiner_A, 'gpt', 'setRoleAssignment 반영');
  App.renderLlmRoleArea(); // 재렌더 시 선택값 유지
  assert.ok(area().includes('value="gpt" selected'), '변경된 배정이 selected 로 렌더');
});

test('apiKeys 단일소스: 기존 단일입력 미러(onProfileApiKeyMirror)도 같은 소스로 funnel', () => {
  // profileTempProvider 기본은 selectedProvider(claude). 단일입력에 입력 → apiKeys.claude 반영 + 슬롯 미러.
  App.onProfileApiKeyMirror('sk-mirror');
  assert.equal(App.getProviderKeys().claude, 'sk-mirror', '단일입력→apiKeys.claude');
  assert.equal(dom.reg.llmKeyClaude.value, 'sk-mirror', '3슬롯에 미러(이중소스 충돌 차단)');
});

test('getProviderKeys 가 입력 슬롯만 반환(빈 키 제외) — kipris 무관', () => {
  App.onLlmKeyInput('claude', '  sk-ant  '); // trim
  App.onLlmKeyInput('gemini', 'AIza');
  assert.deepEqual(App.getProviderKeys(), { claude: 'sk-ant', gemini: 'AIza' }, 'gpt 빈값 제외, trim');
});
