/**
 * review-engine/__tests__/patent-batch19b-postfix.test.js
 * ★ 배치 19(2차) — 수정후 산출물 전수 확인 반영: 방법 도면 잔여·검증기 오탐·미사용 부호·무한 재생성 안내·실행 로그.
 *   1 방법 OFF 시 도면 설명에 방법 도면(순서도) 0 · 2 명칭 과다흡수 오탐(라우팅부 114) 소멸(실코퍼스 불변) ·
 *   3 미사용 예시도 부호 부호표 제외 · 4 무한 재생성 안내→ⓐ재생성/ⓑ수동수정(+2회 후 승격) · 5 실행 로그(runLog).
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

let sandbox; const els = {}; let toasts = [];
const mkEl = () => ({ value: '', checked: false, disabled: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
const checks = (spec, ck) => JSON.parse(run(`JSON.stringify(validateSpecification(${JSON.stringify(spec)}).filter(function(i){return i.check===${JSON.stringify(ck)};}).map(function(i){return {message:i.message,detail:i.detail,severity:i.severity};}))`));
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {}, updateStats() {}, safeMaxTokensLarge: () => 16000 };
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

// ═══════════════ 1) 방법 OFF 시 도면 설명 방법 도면 제외 ═══════════════

test('19b-1 ★ — extractBriefDescriptions: 방법 OFF면 방법 도면(순서도) 설명 제외', () => {
  run(`clearAllState(); includeMethodClaims=false; outputs={ step_08:"도 1은 장치의 블록도이다. 도 7은 데이터를 처리하는 방법을 나타내는 순서도이다." };`);
  const brief = run('extractBriefDescriptions(outputs.step_08||"", "")');
  assert.ok(/도 1/.test(brief) && /블록도/.test(brief), '★ 장치 도면 설명 유지');
  assert.ok(!/순서도/.test(brief) && !/도 7/.test(brief), '★ 방법 도면(순서도) 설명 제외');
});

test('19b-1 ★ — _isMethodFigBrief: 방법 도면(순서도·흐름도·방법 나타내는)만 감지, 장치 도면은 미감지', () => {
  assert.ok(run(`_isMethodFigBrief("도 7은 데이터를 처리하는 방법을 나타내는 순서도이다.")`), '★ 순서도 감지');
  assert.ok(run(`_isMethodFigBrief("도 8은 처리 흐름을 나타내는 흐름도이다.")`), '★ 흐름도 감지');
  assert.ok(!run(`_isMethodFigBrief("도 1은 장치의 전체 구성을 나타내는 블록도이다.")`), '★ 블록도(장치) 미감지');
  assert.ok(!run(`_isMethodFigBrief("도 2는 제어부의 내부 구성을 나타내는 예시도이다.")`), '★ 예시도(장치) 미감지');
});

test('19b-1 ★ 소스 — extractBriefDescriptions 방법 OFF 필터 배선(_mOff && _isMethodFigBrief)', () => {
  assert.match(PATENT_SRC, /const _mOff=\(typeof _renderMethodOn==='function'\)\?!_renderMethodOn\(\)/, '★ 방법 OFF 판정');
  assert.match(PATENT_SRC, /if\(_mOff&&_isMethodFigBrief\(m\[1\]\)\)return;/, '★ 방법 OFF → 방법 도면 소개문 제외');
});

test('19b-1 ★ — _stripMethodFigParas: 방법 도면 전용 문단 결정론 제거', () => {
  const body = '도 1을 참조하면 제어부(100)가 동작한다.\n\n도 7은 데이터를 처리하는 방법을 나타내는 순서도이다. 각 단계를 수행한다.\n\n도 2를 참조하면 저장부(110)가 저장한다.';
  const r = JSON.parse(run(`JSON.stringify(_stripMethodFigParas(${JSON.stringify(body)}))`));
  assert.strictEqual(r.removed, 1, '★ 방법 도면 문단 1개 제거');
  assert.ok(!/순서도/.test(r.text) && /제어부\(100\)/.test(r.text) && /저장부\(110\)/.test(r.text), '★ 장치 문단 보존');
});

// ═══════════════ 2) 검증기 오탐 — 명칭 과다흡수 ═══════════════

test('19b-2 ★ — dupassign 명칭이 "명사가" 앞어절 과다흡수 없이 깨끗(라우팅제어부)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n제1 파라미터가 라우팅제어부(114)는 처리하고, 제2 파라미터가 라우팅제어부(120)는 재처리한다.';
  const iss = checks(spec, 'refnum_dupassign');
  assert.ok(iss.some(i => /라우팅제어부/.test(i.message)), '★ 진성 이중부호 발화(라우팅제어부)');
  assert.ok(!iss.some(i => /파라미터가/.test(i.message)), '★ "파라미터가…" 오염 명칭 미생성');
});

test('19b-2 ★ — 2자 내용어(추가·자가·차이)는 보존(과절삭 방지 회귀)', () => {
  // "자가 보완부" 확장이 유지되어야 함(자가=2자 → 조사 아님)
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n품질 계약 검증 및 자가 보완부(125)는 보완하고, 이후 품질 계약 검증 및 자가 보완부(127)가 재실행된다.\n\n【부호의 설명】\n품질계약검증및자가보완부 : 125';
  assert.ok(checks(spec, 'refnum_dupassign').some(i => /125.*127|127.*125/.test(i.detail || '')), '★ 자가보완부 {125,127} 발화(2자 자가 보존)');
});

test('19b-2 ★ — 실코퍼스 메커니즘 픽스처 불변([b]+[c] 정확히 2건)', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n통신부(110)는 통신하고, 무선통신부(110)는 무선으로 통신한다. 메모리(130)는 저장하며, 데이터를 저장하는 데이터 저장부(140)는 결과를 저장한다. 자가보완부(125)는 보완하고, 재정렬부(125)는 순서를 재정렬한다. 자가보완부(127)는 추가로 보완한다. 실행 결과를 산출하는 결과 산출부(150)와, 신뢰도를 산출하는 신뢰도 산출부(160)를 더 포함한다.\n\n【부호의 설명】\n통신부 : 110\n메모리 : 130\n데이터저장부 : 140\n자가보완부 : 125\n자가보완부 : 127\n결과산출부 : 150\n신뢰도산출부 : 160';
  assert.strictEqual(checks(spec, 'refnum_dupassign').length, 2, '★ [b]+[c] = 2건(실코퍼스 메커니즘 불변)');
});

// ═══════════════ 3) 미사용 예시도 부호 제외 ═══════════════

test('19b-3 ★ 소스 — reflectConceptsToSpec: 예시도 설명(step_08c) 있으면 미사용 부호 제외', () => {
  assert.match(PATENT_SRC, /const _checkUse=!!\(outputs\.step_08c&&String\(outputs\.step_08c\)\.trim\(\)\);/, '★ 예시도 설명 존재 시에만 사용 판정');
  assert.match(PATENT_SRC, /if\(_checkUse\)\{ let _used=true;[\s\S]{0,120}if\(!_used\) return; \}/, '★ 미사용 부호 제외');
});

// ═══════════════ 4) 무한 재생성 안내 제거 + 승격 ═══════════════

test('19b-4 ★ — term_generation_mismatch: 기본은 ⓐ재생성/ⓑ수동수정 병기', () => {
  run('clearAllState(); runLog=[]; termSnapshot={ confirmedAt:1, staleTerms:["구세대명칭부"] };');
  const spec = '【부호의 설명】\n구세대명칭부 : 110\n【발명을 실시하기 위한 구체적인 내용】\n구세대명칭부(110)는 처리한다.';
  const iss = checks(spec, 'term_generation_mismatch');
  assert.ok(iss.length >= 1, '★ 구세대 용어 검출');
  assert.ok(iss.some(i => /ⓐ/.test(i.message) && /ⓑ|수동 수정/.test(i.message)), '★ ⓐ재생성/ⓑ수동수정 병기(무한 재생성 안내 제거)');
});

test('19b-4 ★ — 2회 이상 재작성 후 잔존 시 "수동 수정 권장"으로 승격', () => {
  run(`clearAllState(); termSnapshot={ confirmedAt:1, staleTerms:["구세대명칭부"] }; runLog=[{t:"1",action:"결함 반영 재작성",ok:true},{t:"2",action:"본문 통합 생성",ok:true}];`);
  const spec = '【부호의 설명】\n구세대명칭부 : 110\n【발명을 실시하기 위한 구체적인 내용】\n구세대명칭부(110)는 처리한다.';
  const iss = checks(spec, 'term_generation_mismatch');
  assert.ok(iss.some(i => /수동 수정 권장/.test(i.message)), '★ 2회+ 재생성 후 잔존 → 수동 수정 권장 승격');
});

// ═══════════════ 5) 실행 로그(runLog) ═══════════════

test('19b-5 ★ — _pushRunLog 누적 + _renderRunLog 렌더 + _rewriteRunCount', () => {
  run('clearAllState(); runLog=[];');
  run(`_pushRunLog('본문 통합 생성', true, '부호정합 3건');`);
  run(`_pushRunLog('결함 반영 재작성', false, '타임아웃');`);
  assert.strictEqual(run('runLog.length'), 2, '★ 2건 누적');
  assert.strictEqual(run('_rewriteRunCount()'), 1, '★ 재작성 성공 카운트(성공 1)');
  els.runLogPanel4 = mkEl();
  run('_renderRunLog();');
  assert.ok(/실행 로그 \(2건\)/.test(els.runLogPanel4.innerHTML), '★ 접이식 패널 렌더');
  assert.ok(/✓/.test(els.runLogPanel4.innerHTML) && /✗/.test(els.runLogPanel4.innerHTML), '★ 성공/실패 표기');
  assert.ok(/타임아웃/.test(els.runLogPanel4.innerHTML), '★ 실패 사유 상세');
});

test('19b-5 ★ — HTML 로그 패널(④⑤) + 영속 배선', () => {
  assert.match(HTML_SRC, /id="runLogPanel4"/, '★ ④ 로그 패널');
  assert.match(HTML_SRC, /id="runLogPanel5"/, '★ ⑤ 로그 패널');
  assert.match(PATENT_SRC, /let runLog=\[\];/, '★ runLog 상태');
  assert.match(PATENT_SRC, /termSnapshot,genParams,refPlan,runLog\}/, '★ saveProject 영속');
  assert.match(PATENT_SRC, /runLog=Array\.isArray\(s\.runLog\)\?s\.runLog:\[\];/, '★ openProject 복원');
});
