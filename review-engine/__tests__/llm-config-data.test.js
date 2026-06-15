/**
 * review-engine/__tests__/llm-config-data.test.js
 * L-T1 데이터 계층 — 사용자 LLM 키·역할배정 헬퍼(shared/common.js).
 *
 * 검증: getProviderKeys(입력 키만)·getRoleAssignments("1키 전역적용" 규칙)·setRoleAssignment(검증)·
 *   KIPRIS 키 공존(회귀 0). 순수 함수라 인자로 상태를 주입해 모듈 전역 없이 테스트.
 */
import { test, before } from 'node:test';
import assert from 'node:assert'; // 비-strict: vm 컨텍스트(다른 realm) 객체/배열의 구조 비교 위해(프로토타입 동일성 무시)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let App;

before(() => {
  const src = readFileSync(path.join(REPO_ROOT, 'shared/common.js'), 'utf8');
  const stubSb = { from: () => ({ update: () => ({ eq: async () => ({}) }), select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }), auth: { signOut: async () => ({}) } };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN,
    setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {} }) },
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window.sb = stubSb; // common.js: `window.sb || supabase.createClient(...)` → 스텁 사용(supabase 미참조)
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'common.js' });
  App = sandbox.window.App;
});

test('6역할 id 정확 + provider 목록', () => {
  assert.deepEqual(App.REVIEW_ROLES, ['examiner_A','examiner_B','examiner_C','attorney_author','attorney_reviewer','domain_expert']);
  assert.deepEqual(App.REVIEW_PROVIDERS, ['claude','gpt','gemini']);
});

test('getProviderKeys: 입력된 LLM 키만 반환(trim) + kipris 제외(공존)', () => {
  const out = App.getProviderKeys({ claude:'k1', gpt:'', gemini:'  k3  ', kipris:'kx', provider:'claude' });
  assert.deepEqual(out, { claude:'k1', gemini:'k3' }, '빈 gpt 제외, gemini trim, kipris/provider 미포함');
  assert.equal('kipris' in out, false, 'KIPRIS 키는 LLM provider 키에 섞이지 않음(회귀 0)');
});

test('getEnteredProviders: 입력 키 개수', () => {
  assert.deepEqual(App.getEnteredProviders({}), []);
  assert.deepEqual(App.getEnteredProviders({ gpt:'k' }), ['gpt']);
  assert.deepEqual(App.getEnteredProviders({ claude:'a', gpt:'b', gemini:'c' }), ['claude','gpt','gemini']);
});

test('★ 키 0개 → 빈 배정(검증 불가, UI 차단)', () => {
  assert.deepEqual(App.getRoleAssignments({}), {});
  assert.deepEqual(App.getRoleAssignments({ claude:'', gpt:'' }), {});
});

test('★ 키 1개 → 6역할 전부 그 provider (전역적용, 저장 배정 무시)', () => {
  const m = App.getRoleAssignments({ gpt:'k' }, { examiner_A:'claude', domain_expert:'gemini' }); // 저장값 있어도 무시
  assert.equal(Object.keys(m).length, 6, '6역할 모두 배정');
  App.REVIEW_ROLES.forEach(r => assert.equal(m[r], 'gpt', r + ' → gpt(전역)'));
});

test('★ 키 2개+ → 저장 배정 반환(키 없는 provider 는 첫 입력키로 교정)', () => {
  const keys = { claude:'a', gpt:'b' }; // entered=[claude,gpt], 첫 입력키=claude
  const stored = { examiner_A:'gpt', examiner_B:'gemini', attorney_author:'claude' }; // gemini 는 키 없음 → 교정
  const m = App.getRoleAssignments(keys, stored);
  assert.equal(m.examiner_A, 'gpt', '유효 저장값 유지');
  assert.equal(m.examiner_B, 'claude', '키 없는 gemini → 첫 입력키(claude)로 교정');
  assert.equal(m.attorney_author, 'claude', '유효 저장값 유지');
  assert.equal(m.examiner_C, 'claude', '미지정 역할 → 첫 입력키 기본');
  App.REVIEW_ROLES.forEach(r => assert.ok(['claude','gpt'].includes(m[r]), r + ' 는 입력된 키 provider 만(키 없는 provider 배정 0)'));
});

test('★ 키 2개+ & 저장 배정 없음 → 전 역할 첫 입력키 기본(전부 유효)', () => {
  const m = App.getRoleAssignments({ gpt:'b', gemini:'c' }); // entered=[gpt,gemini], 첫=gpt
  assert.equal(Object.keys(m).length, 6);
  App.REVIEW_ROLES.forEach(r => assert.equal(m[r], 'gpt'));
});

test('setRoleAssignment: roleId·provider 검증', () => {
  assert.equal(App.setRoleAssignment('examiner_A', 'claude'), true, '유효');
  assert.equal(App.setRoleAssignment('attorney_reviewer', 'gemini'), true, '유효');
  assert.equal(App.setRoleAssignment('nonexistent_role', 'claude'), false, '잘못된 역할 거부');
  assert.equal(App.setRoleAssignment('examiner_A', 'mistral'), false, '미지원 provider 거부');
  assert.equal(App.setRoleAssignment('examiner_A', 'kipris'), false, 'kipris 는 LLM provider 아님 → 거부');
});

test('헬퍼는 KIPRIS 저장/조회 로직과 무관(공존) — getProviderKeys 가 kipris 를 건드리지 않음', () => {
  // KIPRIS 키가 섞인 입력에서도 LLM 키만 추출되고, kipris 값은 보존 대상(별도 게터 소관)
  const profileJson = { claude:'a', kipris:'KIPRIS-KEY', roleAssignments:{ examiner_A:'claude' } };
  const llm = App.getProviderKeys(profileJson);
  assert.deepEqual(llm, { claude:'a' });
  assert.equal(profileJson.kipris, 'KIPRIS-KEY', 'kipris 원본 불변');
});
