/**
 * review-engine/__tests__/llm-config-wire.test.js
 * L-T3 클라→Edge 배선 — review-orchestrate invoke body 에 keys+assignments 동봉.
 *
 * - 실제 common.js getReviewAuth(L-T1 "1키 전역" 규칙)로 keys/assignments 산출.
 * - opinion 러너를 vm 로드 → App.sb.functions.invoke 스텁이 body 를 캡처 → 검증.
 * - ★ 키값이 console 어디에도 안 찍히는지(노출 0) 스파이로 확인.
 * - patent 러너는 동일 배선임을 소스 수준으로 확인(550KB 미로드).
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let commonApp, Opinion, captured, consoleSink;

// common.js 로드 → 실제 getReviewAuth/onLlmKeyInput 확보(별 sandbox).
function loadCommon() {
  const src = readFileSync(path.join(REPO_ROOT, 'shared/common.js'), 'utf8');
  const stubSb = { from: () => ({ update: () => ({ eq: async () => ({}) }) }), auth: { signOut: async () => ({}) } };
  const sb = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN,
    setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {} }) },
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb; sb.window.sb = stubSb;
  vm.createContext(sb); vm.runInContext(src, sb, { filename: 'common.js' });
  return sb.window.App;
}

// opinion.js 로드 → _defaultReviewRunner 확보. App.getReviewAuth 는 실제 common 것, sb.functions.invoke 는 캡처.
function loadOpinion(appGetReviewAuth) {
  const src = readFileSync(path.join(REPO_ROOT, 'opinion/opinion.js'), 'utf8');
  consoleSink = [];
  const spy = (...a) => { consoleSink.push(a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (_e) { return String(x); } }).join(' ')); };
  const captureSb = {
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }), update: () => ({ eq: async () => ({}) }) }),
    functions: { invoke: async (name, opts) => { captured = { name, body: opts && opts.body }; return { data: { phase: 'converged', issues: [], patchPlans: [] } }; } },
    auth: { signOut: async () => ({}) },
  };
  const sb = {
    console: { log: spy, warn: spy, error: spy }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb: captureSb,
    App: { sb: captureSb, getReviewAuth: appGetReviewAuth, currentUser: { id: 'u1' } },
    ReviewUI: { isEnabled: () => true },
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb); vm.runInContext(src, sb, { filename: 'opinion.js' });
  return sb.window.Opinion;
}

before(() => {
  commonApp = loadCommon();
  Opinion = loadOpinion(() => commonApp.getReviewAuth());
});

test('opinion 러너 body 에 keys+assignments 동봉 + snapshot/caseId 보존, module 없음', async () => {
  commonApp.onLlmKeyInput('claude', ''); commonApp.onLlmKeyInput('gpt', ''); commonApp.onLlmKeyInput('gemini', '');
  commonApp.onLlmKeyInput('gpt', 'sk-gpt-OPINION'); // 1키
  captured = null;
  await Opinion._defaultReviewRunner({ caseId: 'OP-1', parsed: { claims: [{ no: 1, text: 'x' }] } });
  assert.ok(captured, 'invoke 호출됨');
  assert.equal(captured.name, 'review-orchestrate');
  assert.equal(captured.body.caseId, 'OP-1', 'caseId 보존');
  assert.ok(captured.body.snapshot && captured.body.snapshot.parsed, 'snapshot 보존');
  assert.equal('module' in captured.body, false, 'opinion 은 module 미전송(후방호환)');
  assert.deepEqual(captured.body.keys, { gpt: 'sk-gpt-OPINION' }, '입력된 키만 동봉');
});

test('★ 1키 입력 → assignments 6역할 전역(그 provider)', async () => {
  commonApp.onLlmKeyInput('claude', ''); commonApp.onLlmKeyInput('gpt', ''); commonApp.onLlmKeyInput('gemini', '');
  commonApp.onLlmKeyInput('claude', 'sk-only');
  captured = null;
  await Opinion._defaultReviewRunner({ caseId: 'OP-2' });
  const a = captured.body.assignments;
  assert.equal(Object.keys(a).length, 6, '6역할');
  commonApp.REVIEW_ROLES.forEach(r => assert.equal(a[r], 'claude', r + ' → claude(전역)'));
});

test('★ 2키 → 저장 배정이 body 에(키없는 provider 교정 포함)', async () => {
  commonApp.onLlmKeyInput('claude', ''); commonApp.onLlmKeyInput('gpt', ''); commonApp.onLlmKeyInput('gemini', '');
  commonApp.onLlmKeyInput('claude', 'sk-c'); commonApp.onLlmKeyInput('gpt', 'sk-g'); // entered=[claude,gpt]
  commonApp.setRoleAssignment('examiner_A', 'gpt');
  commonApp.setRoleAssignment('examiner_B', 'gemini'); // 키 없음 → 교정 대상
  captured = null;
  await Opinion._defaultReviewRunner({ caseId: 'OP-3' });
  const a = captured.body.assignments;
  assert.equal(a.examiner_A, 'gpt', '유효 배정 유지');
  assert.equal(a.examiner_B, 'claude', '키없는 gemini → 첫 입력키(claude) 교정');
  assert.deepEqual(captured.body.keys, { claude: 'sk-c', gpt: 'sk-g' }, '2키 동봉');
});

test('★ 키값이 console 어디에도 안 찍힘(노출 0)', async () => {
  commonApp.onLlmKeyInput('claude', ''); commonApp.onLlmKeyInput('gpt', ''); commonApp.onLlmKeyInput('gemini', '');
  commonApp.onLlmKeyInput('gemini', 'AIza-SECRET-XYZ');
  consoleSink = [];
  await Opinion._defaultReviewRunner({ caseId: 'OP-4' });
  const all = consoleSink.join('\n');
  assert.ok(!all.includes('AIza-SECRET-XYZ'), '키값이 console 출력에 없음');
});

test('getReviewAuth 자체가 keys+assignments 형상(L-T1 헬퍼 래핑)', () => {
  commonApp.onLlmKeyInput('claude', ''); commonApp.onLlmKeyInput('gpt', ''); commonApp.onLlmKeyInput('gemini', '');
  commonApp.onLlmKeyInput('gpt', 'k');
  const auth = commonApp.getReviewAuth();
  assert.deepEqual(auth.keys, { gpt: 'k' });
  assert.equal(Object.keys(auth.assignments).length, 6);
});

test('patent 러너도 동일 배선(소스 확인) — keys/assignments/module + getReviewAuth 가드', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'patent/patent.js'), 'utf8');
  const i = src.indexOf('Patent._defaultReviewRunner = async'); // 정의 지점(앞선 폴백 참조 회피)
  const seg = src.slice(i, i + 600);
  assert.ok(seg.includes('App.getReviewAuth'), 'getReviewAuth 사용');
  assert.ok(seg.includes('keys: auth.keys'), 'keys 동봉');
  assert.ok(seg.includes('assignments: auth.assignments'), 'assignments 동봉');
  assert.ok(seg.includes("module: 'patent'"), 'patent module 유지');
  // 러너 본문에 키값 로깅 없음
  assert.ok(!/console\.(log|error|warn)/.test(seg.split('invoke')[0]), '러너 auth~invoke 구간 로깅 없음');
});
