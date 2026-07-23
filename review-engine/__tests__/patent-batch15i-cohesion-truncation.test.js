/**
 * review-engine/__tests__/patent-batch15i-cohesion-truncation.test.js
 * ★ 배치 15I — cohesion 응답 절단 대응.
 *   1a 진단 로깅(길이·블록·finish_reason) / 1c max_tokens 상향 / 2 경고 커밋 품질 하한 /
 *   1b 고분량 프리셋 2회 분할(본문 → 부호표·마무리) / 3 REFTABLE 공백 코드 폴백.
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
const COMMON_SRC = readFileSync(path.join(REPO, 'shared/common.js'), 'utf8');

let sandbox; const els = {}; let toasts = [];
const mkEl = () => ({ value: '', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', safeMaxTokensLarge: () => 16000, escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {}, updateStats() {} };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast: (m, t) => toasts.push({ m, t }), escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, updateStats() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true, API_KEY: 'stub',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); toasts = []; run('clearAllState();'); });

const setupCohesion = () => run('clearAllState(); outputs.step_06="【청구항 1】 제어부를 포함하는 장치."; outputs.step_07="도 1"; selectedTitle="테스트 장치"; selectedTitleType="장치"; includeMethodClaims=false;');

// ─────────────── 3) REFTABLE 공백 코드 폴백 (_refPairsFromText / _buildRefMapFromText) ───────────────

test('15I-3 ★ — _refPairsFromText: 임의 본문에서 명칭(번호) 결정론 추출(15J 클린 규칙 공유)', () => {
  const pairs = JSON.parse(run(`JSON.stringify(_refPairsFromText('상기 대사 보존형 서사 구조화부(111)는 제어부(100)와 저장부(110)를 포함한다.'))`));
  const got = {}; pairs.forEach(p => got[p.ref] = p.name);
  assert.strictEqual(got[111], '대사 보존형 서사 구조화부', '★ 장문 명칭 전체형');
  assert.strictEqual(got[100], '제어부', '★ 제어부');
  assert.strictEqual(got[110], '저장부', '★ 저장부');
});

test('15I-3 ★ — _buildRefMapFromText: 본문에서 refMap(번호→명칭) Map 생성', () => {
  const size = run(`_buildRefMapFromText('제어부(100)가 저장부(110)를 제어한다.').size`);
  assert.strictEqual(size, 2, '★ 2개 부호 Map');
  assert.strictEqual(run(`_buildRefMapFromText('제어부(100)가 동작한다.').get('100')`), '제어부', '★ 명칭 매핑');
});

test('15I-3 ★ 동작 — REFTABLE 누락(재요청도 실패) → 본문 코드 폴백으로 커밋(차단 안 함)', async () => {
  setupCohesion();
  els.chkUnifiedMath = mkEl();
  // 모든 LLM 호출이 REFTABLE 없는 본문만 반환(재요청도 REFTABLE 못 만듦) → 코드 폴백 발동
  const DEVONLY = '<<<DEVICE_DESC>>>\n도 1을 참조하면, 제어부(100)는 저장부(110)로부터 데이터를 읽어 처리하도록 구성된다.\n<<<END_DEVICE_DESC>>>';
  sandbox.App.callClaudeWithContinuation = async () => DEVONLY;
  await run('runUnifiedCohesionGen({chained:true})');
  const s18 = run('outputs.step_18') || '';
  assert.ok(/제어부 : 100/.test(s18), '★ 코드 폴백으로 부호표 생성(제어부:100)');
  assert.ok(/저장부 : 110/.test(s18), '★ 저장부:110');
  assert.ok(toasts.some(t => /부호표 자동 생성/.test(t.m)), '★ 코드 폴백 경고 토스트');
});

// ─────────────── 1b) 고분량 프리셋 분할 ───────────────

test('15I-2 ★ — _cohesionUseSplit: 상세/최대 프리셋만 분할', () => {
  run(`detailLevel='maximal'`); assert.strictEqual(run('_cohesionUseSplit()'), true, '★ maximal 분할');
  run(`detailLevel='detailed'`); assert.strictEqual(run('_cohesionUseSplit()'), true, '★ detailed 분할');
  run(`detailLevel='standard'`); assert.strictEqual(run('_cohesionUseSplit()'), false, '★ standard 단일');
  run(`detailLevel='compact'`); assert.strictEqual(run('_cohesionUseSplit()'), false, '★ compact 단일');
});

test('15I-2 ★ — _runCohesionSplit: 1차 본문 + 2차 부호표·마무리 병합(중복 블록 제거)', async () => {
  setupCohesion();
  els.chkUnifiedMath = mkEl();
  // 1차(본문) 프롬프트엔 "1/2단계", 2차엔 "2/2단계" 마커 → 호출 구분
  const BODY = '<<<DEVICE_DESC>>>\n도 1을 참조하면, 제어부(100)는 저장부(110)를 제어한다.\n<<<END_DEVICE_DESC>>>';
  const FINISH = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n(110) 저장부\n<<<END_REFTABLE>>>\n<<<TASK>>>\n본 발명은 제어 효율을 높이는 것을 목적으로 한다.\n<<<END_TASK>>>\n<<<SOLUTION>>>\n제어부를 포함한다.\n<<<END_SOLUTION>>>\n<<<EFFECTS>>>\n제어 효율이 향상된다.\n<<<END_EFFECTS>>>\n<<<ABSTRACT>>>\n제어부(100)를 포함하는 장치.\n<<<END_ABSTRACT>>>';
  let calls = 0;
  sandbox.App.callClaudeWithContinuation = async (prompt) => { calls++; return /2\/2단계/.test(prompt) ? FINISH : BODY; };
  const res = await run(`(async()=>{ const r=await _runCohesionSplit('progressUnifiedGen',16000); return r?{hasRef:r.rm.ok.hasRef,hasDevice:r.rm.ok.hasDevice,task:!!r.rm.task,effects:!!r.rm.effects,refSize:r.rm.refMap.size,mergedHasDev:/제어부\\(100\\)는 저장부/.test(r.merged)}:null; })()`);
  assert.ok(res, '★ 분할 결과 non-null');
  assert.strictEqual(res.hasDevice, true, '★ 본문(1차) 병합');
  assert.strictEqual(res.hasRef, true, '★ 부호표(2차) 병합');
  assert.strictEqual(res.task, true, '★ TASK(2차) 병합');
  assert.strictEqual(res.effects, true, '★ EFFECTS(2차) 병합');
  assert.strictEqual(res.refSize, 2, '★ refMap 2개');
  assert.strictEqual(res.mergedHasDev, true, '★ merged 원문에 본문 보존(하류 참조용)');
  assert.strictEqual(calls, 2, '★ 정확히 2회 호출(본문+마무리)');
});

test('15I-2 ★ — _runCohesionSplit: 1차 본문 실패(DEVICE 없음) → null(단일 호출 폴백 신호)', async () => {
  setupCohesion();
  sandbox.App.callClaudeWithContinuation = async () => '설명만 있고 블록 없음';
  const isNull = await run(`(async()=>{ const r=await _runCohesionSplit('progressUnifiedGen',16000); return r===null; })()`);
  assert.strictEqual(isNull, true, '★ 본문 실패 시 null 반환(폴백 유도)');
});

// ─────────────── 2) 품질 하한 경고 ───────────────

test('15I-2 ★ 동작 — 상세설명이 목표 50% 미만이면 "본문 불완전" 강조 토스트', async () => {
  run('clearAllState(); outputs.step_06="【청구항 1】 제어부."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="장치"; includeMethodClaims=false; detailLevel="maximal";');   // 목표 22000자
  els.chkUnifiedMath = mkEl();
  // 짧은 본문(목표 22000의 50% 미만) + REFTABLE 정상
  const SHORT = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n도 1을 참조하면, 제어부(100)가 동작한다.\n<<<END_DEVICE_DESC>>>';
  sandbox.App.callClaudeWithContinuation = async () => SHORT;
  await run('runUnifiedCohesionGen({chained:true})');
  assert.ok(toasts.some(t => t.t === 'warning' && /본문이 불완전/.test(t.m)), '★ 불완전 강조 토스트(분량 미달)');
});

// ─────────────── 소스 정합 ───────────────

test('15I 소스 ★ — 진단 로깅·max_tokens·분할·폴백·품질하한 배선', () => {
  assert.match(PATENT_SRC, /finish_reason='\+\(_m\.stopReason/, '★ 1a finish_reason 진단 로깅');
  assert.match(PATENT_SRC, /App\.safeMaxTokensLarge&&App\.safeMaxTokensLarge\(\)/, '★ 1c max_tokens 상향 배선');
  assert.match(PATENT_SRC, /function _runCohesionSplit\(pid, ?maxTok\)\{/, '★ 1b 분할 함수');
  assert.match(PATENT_SRC, /function _buildRefMapFromText\(text\)\{/, '★ 3 코드 폴백 함수');
  assert.match(PATENT_SRC, /_incomplete=_lowVol\|\|_reftableFallback/, '★ 2 품질 하한 판정');
});

test('15I 소스 ★ — common.js: safeMaxTokensLarge(gemini 8192·그 외 16000) + callClaudeWithContinuation maxTokens·lastMeta', () => {
  assert.match(COMMON_SRC, /function safeMaxTokensLarge\(\)\{[\s\S]*?selectedProvider==='gemini'\?8192:16000/, '★ 프로바이더 안전 상한');
  assert.match(COMMON_SRC, /async function callClaudeWithContinuation\(prompt,pid,maxTokens\)\{/, '★ maxTokens 선택 인자');
  assert.match(COMMON_SRC, /callClaudeWithContinuation\.lastMeta=\{stopReason:/, '★ 절단 진단 lastMeta 노출');
  assert.match(COMMON_SRC, /callClaude\(prompt,maxTokens\)/, '★ maxTokens 를 callClaude 로 전달');
});
