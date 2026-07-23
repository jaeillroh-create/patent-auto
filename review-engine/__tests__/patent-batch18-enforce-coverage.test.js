/**
 * review-engine/__tests__/patent-batch18-enforce-coverage.test.js
 * ★ 배치 18 — refPlan enforce 커버리지 전면화 + 하드웨어 배정 제외 + 검토 순서 자동화.
 *   규명(docL): 배치17 refPlan/override/enforce 는 정상이나 enforce 가 step_08/12 에만 적용돼, buildSpecification·
 *   validateSpecification(dupassign/consistency)이 스캔하는 나머지 영역(예시도 step_08c·도면 step_07/11·효과 step_16·
 *   해결수단 step_17·요약서 step_19)이 LLM 원부호(프로세서(110)·자기번호 111/112)를 보유 → 혼재 부호표·dupassign 파생.
 *   수정: (18-2) _enforceAllOutputs 로 전영역 일괄 정합 + step_18 을 정합 후 직렬화. (18-3) 하드웨어 상용구 배정 제외.
 *   (18-4) 개별 스텝 재생성도 정합. (18-5) [진단→반영] 단일 버튼.
 *   합격: 1-shot 부호표=refPlan(중복0)·본문 부호 refPlan 100%(총칭어 0)·refnum_dupassign 0·consistency 0 — 단일/분할 양경로.
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
const mkEl = () => ({ value: '', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
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

// docL 유형 청구항: 6개 실구성부 + "프로세서; 및 메모리;"(하드웨어). 콤마 구분(실무 형식).
const DOCL = '【청구항 1】 프로세서; 및 메모리;를 포함하고, 상기 프로세서는, 대사 보존형 서사 구조화부; 캐릭터·연속성 파라미터 생성부; 후보 레지스트리부;를 실행하는 콘텐츠 생성 장치.';

// ═══════════════ 18-3) 하드웨어 상용구 배정 제외 ═══════════════

test('18-3 ★ — _assignRefNumbers: bare 프로세서·메모리 미배정(구성부만 refPlan)', () => {
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify(DOCL)},{}))`));
  const names = plan.map(p => p.name);
  assert.ok(!names.some(n => /^(프로세서|메모리)$/.test(n.replace(/\s+/g, ''))), '★ 하드웨어 상용구는 부호 미부여');
  assert.ok(names.includes('대사 보존형 서사 구조화부'), '★ 실구성부는 배정');
  assert.strictEqual(names.length - new Set(names).size, 0, '★ 명칭 중복 0');
});

test('18-3 ★ — 하드웨어 주어 접두 제거: "프로세서는 X부"(공백 연결) → "X부"(과포섭 차단)', () => {
  const c = '【청구항 1】 상기 프로세서는 대사 보존형 서사 구조화부; 및 후보 레지스트리부를 실행하는 장치.';
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify(c)},{}))`));
  const byNum = {}; plan.forEach(p => byNum[p.num] = p.name);
  assert.strictEqual(byNum[110], '대사 보존형 서사 구조화부', '★ 접두 "프로세서는" 제거');
  assert.ok(!plan.some(p => /^프로세서/.test(p.name)), '★ 프로세서 접두 미잔존');
});

// ═══════════════ 18-2) _enforceAllOutputs — 전영역 정합 ═══════════════

test('18-2 ★ — _enforceAllOutputs: 상세설명·도면·마무리 영역 일괄 정합 + 영역별 카운트', () => {
  run(`clearAllState(); outputs.step_06="【청구항 1】 제어부(100)와 저장부(110)를 포함하는 장치."; _ensureRefPlan(true);`);
  run(`outputs.step_08="상기 프로세서(100)가 동작한다."; outputs.step_07="도 1: 저장부(999) 배치."; outputs.step_16="메모리(110)가 기여."; outputs.step_19="프로세서(100) 포함.";`);
  const res = JSON.parse(run(`JSON.stringify(_enforceAllOutputs(refPlan))`));
  assert.ok(res.total >= 4, '★ 전영역 교정 건수');
  assert.ok(res.byArea.상세설명 >= 1 && res.byArea.도면 >= 1 && res.byArea.마무리 >= 1, '★ 영역별 카운트(상세설명·도면·마무리)');
  assert.ok(/제어부\(100\)/.test(run('outputs.step_08')) && !/프로세서\(100\)/.test(run('outputs.step_08')), '★ step_08 정합');
  assert.ok(/저장부\(110\)/.test(run('outputs.step_07')), '★ step_07(도면) 정합');
  assert.ok(/저장부\(110\)/.test(run('outputs.step_16')) && !/메모리\(110\)/.test(run('outputs.step_16')), '★ step_16(마무리) 정합');
  assert.ok(/제어부\(100\)/.test(run('outputs.step_19')), '★ step_19(요약) 정합');
});

test('18-2 ★ — 청구항(step_06/10)은 refPlan 기준이므로 enforce 대상 아님(불변)', () => {
  run(`clearAllState(); outputs.step_06="【청구항 1】 제어부(100)와 저장부(110)를 포함하는 장치."; _ensureRefPlan(true);`);
  const before = run('outputs.step_06');
  run(`_enforceAllOutputs(refPlan);`);
  assert.strictEqual(run('outputs.step_06'), before, '★ 청구항 불변');
});

// ═══════════════ 통합 흐름 — 합격 기준(단일 경로) ═══════════════

async function runFlow(deviant, detail) {
  run(`clearAllState(); outputs.step_06=${JSON.stringify(DOCL)}; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="서버"; includeMethodClaims=false; detailLevel=${JSON.stringify(detail || 'standard')};`);
  els.chkUnifiedMath = mkEl();
  const orig = sandbox.App.callClaudeWithContinuation;
  sandbox.App.callClaudeWithContinuation = async (pr) => (typeof deviant === 'function' ? deviant(pr) : deviant);
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
}
function refnumDefects() {
  const spec = run('buildSpecification()') || '';
  return JSON.parse(run(`JSON.stringify(validateSpecification(${JSON.stringify(spec)}).filter(function(i){return i.check==='refnum_dupassign'||i.check==='refnum_consistency';}))`));
}

// LLM 이탈: REFTABLE·본문에 자기번호(111/112) + 하드웨어(프로세서(110)) + 마무리·요약에도 이탈 부호
const DEVIANT_SINGLE = '<<<REFTABLE>>>\n[장치부호]\n(110) 대사 보존형 서사 구조화부\n(111) 대사 보존형 서사 구조화부\n<<<END_REFTABLE>>>\n'
  + '<<<DEVICE_DESC>>>\n도 1을 참조하면, 상기 프로세서(110)는 대사 보존형 서사 구조화부(111)를 실행하고, 캐릭터·연속성 파라미터 생성부(112)를 포함한다. 상기 메모리(120)가 저장한다.\n<<<END_DEVICE_DESC>>>\n'
  + '<<<TASK>>>\n과제.\n<<<END_TASK>>>\n<<<SOLUTION>>>\n대사 보존형 서사 구조화부(111)로 해결.\n<<<END_SOLUTION>>>\n'
  + '<<<EFFECTS>>>\n상기 프로세서(110)에 의해 효과.\n<<<END_EFFECTS>>>\n<<<ABSTRACT>>>\n프로세서(110)와 캐릭터·연속성 파라미터 생성부(112)를 포함.\n<<<END_ABSTRACT>>>';

test('18 ★ 합격(단일 경로) — LLM 전영역 이탈 → refnum_dupassign 0 + refnum_consistency 0', async () => {
  await runFlow(DEVIANT_SINGLE, 'standard');
  const bad = refnumDefects();
  assert.strictEqual(bad.length, 0, '★ refnum 결함 0(1-shot 전영역 정합): ' + JSON.stringify(bad.map(b => b.check)));
  const spec = run('buildSpecification()') || '';
  assert.ok(!/프로세서\(1\d\d\)/.test(spec) && !/메모리\(1\d\d\)/.test(spec), '★ 본문 총칭어 부호 0(하드웨어에 구성부 번호 없음)');
  assert.ok(toasts.some(t => /부호 자동 정합 \d+건\(상세설명/.test(t.m)), '★ 영역별 정합 건수 배너');
});

test('18 ★ 합격(분할 경로·maximal) — 동일하게 refnum 0', async () => {
  // 분할: 1차 본문(DEVICE) / 2차 마무리(REFTABLE+TASK…)
  const BODY = '<<<DEVICE_DESC>>>\n도 1을 참조하면, 상기 프로세서(110)는 대사 보존형 서사 구조화부(111)를 실행하고 캐릭터·연속성 파라미터 생성부(112)를 포함한다. 메모리(120)가 저장.\n<<<END_DEVICE_DESC>>>';
  const FINISH = '<<<REFTABLE>>>\n[장치부호]\n(110) 대사 보존형 서사 구조화부\n(111) 대사 보존형 서사 구조화부\n<<<END_REFTABLE>>>\n<<<TASK>>>\n과제.\n<<<END_TASK>>>\n<<<SOLUTION>>>\n해결.\n<<<END_SOLUTION>>>\n<<<EFFECTS>>>\n프로세서(110) 효과.\n<<<END_EFFECTS>>>\n<<<ABSTRACT>>>\n캐릭터·연속성 파라미터 생성부(112) 포함.\n<<<END_ABSTRACT>>>';
  await runFlow((pr) => /2\/2단계/.test(pr) ? FINISH : BODY, 'maximal');
  assert.ok(run('_cohesionUseSplit()') === true, '★ maximal → 분할 경로');
  const bad = refnumDefects();
  assert.strictEqual(bad.length, 0, '★ 분할 경로도 refnum 결함 0: ' + JSON.stringify(bad.map(b => b.check)));
  assert.ok(!/프로세서\(1\d\d\)/.test(run('buildSpecification()') || ''), '★ 분할 경로 총칭어 부호 0');
});

test('18 ★ — step_18(부호표) = refPlan 과 1:1(명칭·번호 중복 0)', async () => {
  await runFlow(DEVIANT_SINGLE, 'standard');
  const s18 = run('outputs.step_18') || '';
  const pairs = s18.split('\n').map(l => l.trim()).filter(l => /:/.test(l));
  const names = pairs.map(l => l.split(':')[0].trim()), nums = pairs.map(l => l.split(':').pop().trim());
  assert.strictEqual(names.length - new Set(names).size, 0, '★ 부호표 명칭 중복 0');
  assert.strictEqual(nums.length - new Set(nums).size, 0, '★ 부호표 번호 중복 0');
  assert.ok(!/프로세서|메모리/.test(s18), '★ 부호표에 하드웨어 상용구 없음');
});

// ═══════════════ 18-4) 개별 스텝 재생성 정합 ═══════════════

test('18-4 ★ — onStepCompleted: 개별 본문 스텝(step_16) 재생성 시 확정 부호표 정합', () => {
  run(`clearAllState(); outputs.step_06="【청구항 1】 제어부(100)와 저장부(110)를 포함하는 장치."; _ensureRefPlan(true);`);
  run(`outputs.step_16="상기 프로세서(100)에 의해 효과. 메모리(110)가 기여.";`);
  run(`onStepCompleted('step_16');`);
  assert.ok(/제어부\(100\)/.test(run('outputs.step_16')) && /저장부\(110\)/.test(run('outputs.step_16')), '★ 개별 스텝도 정합');
  assert.ok(toasts.some(t => /부호 자동 정합/.test(t.m)), '★ 정합 토스트');
});

test('18-4 ★ — onStepCompleted: 청구항(step_06) 재생성 시 refPlan 재배정', () => {
  run(`clearAllState(); outputs.step_06="【청구항 1】 제어부(100)를 포함하는 장치."; _ensureRefPlan(true);`);
  run(`outputs.step_06="【청구항 1】 수신부(100)와 판단부(110)를 포함하는 장치."; onStepCompleted('step_06');`);
  const names = JSON.parse(run('JSON.stringify((refPlan||[]).map(function(p){return p.name;}))'));
  assert.ok(names.includes('수신부') && names.includes('판단부') && !names.includes('제어부'), '★ 새 청구항 기준 refPlan 갱신');
});

test('18-4 ★ 소스 — onStepCompleted 배선(청구항 재배정 / 본문 enforce)', () => {
  assert.match(PATENT_SRC, /if\(\(sid==='step_06'\|\|sid==='step_10'\)&&typeof _ensureRefPlan==='function'\)\{ _ensureRefPlan\(true\)/, '★ 청구항 재생성 → refPlan 재배정');
  assert.match(PATENT_SRC, /else if\(typeof _enforceStepOutput==='function'\)\{ const _n=_enforceStepOutput\(sid\);/, '★ 본문 섹션 → enforce');
});

// ═══════════════ 18-5) 검토 순서 자동화 — 단일 버튼 ═══════════════

test('18-5 ★ HTML — ④ 단일 버튼(진단 후 결함 반영해 다시 쓰기) + 진단만 보조 버튼', () => {
  assert.match(HTML_SRC, /id="btnWfRewriteFixes" onclick="wfDiagnoseAndRewrite\(\)"/, '★ ④ 통합 버튼 = wfDiagnoseAndRewrite');
  assert.match(HTML_SRC, /진단 후 결함 반영해 다시 쓰기/, '★ 통합 버튼 라벨');
  assert.match(HTML_SRC, /id="btnStep13" onclick="runDiagnosis\(\)"/, '★ 진단만 보조 버튼 존치');
  assert.match(HTML_SRC, /명세서 진단\(AI\)만 실행/, '★ 보조 버튼 라벨');
});

test('18-5 ★ 소스 — wfDiagnoseAndRewrite: runDiagnosis 후 wfRewriteWithFixes(순서 자동화)', () => {
  assert.match(PATENT_SRC, /async function wfDiagnoseAndRewrite\(opts\)\{/, '★ 통합 함수 정의(배치19-1 락 opts)');
  assert.match(PATENT_SRC, /if\(typeof runDiagnosis==='function'\)await runDiagnosis\(\{_locked:true\}\);[\s\S]{0,700}await wfRewriteWithFixes\(\{_locked:true\}\);/, '★ 진단 → 재작성 순서(배치19-1 내부 락 전달)');
});

test('18-5 ★ 동작 — wfDiagnoseAndRewrite: 진단(step_13) 실행 후 재작성 호출', async () => {
  run(`clearAllState(); selectedTitle="t"; selectedTitleType="서버"; outputs={ step_06:"【청구항 1】 제어부(100)를 포함하는 장치.", step_07:"도 1", step_08:"제어부(100)가 동작한다." };`);
  els.chkUnifiedMath = mkEl();
  let diagCalls = 0, genCalls = 0;
  const orig = sandbox.App.callClaudeWithContinuation;
  sandbox.App.callClaudeWithContinuation = async (pr) => {
    // cohesion 프롬프트는 출력계약(REFTABLE/DEVICE_DESC 센티넬)을 포함 → 그것으로 구분(진단 프롬프트엔 없음).
    if (/REFTABLE|DEVICE_DESC|출력 계약/.test(pr)) {
      genCalls++;
      return '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n제어부(100)가 동작한다.\n<<<END_DEVICE_DESC>>>\n<<<TASK>>>\n과제.\n<<<END_TASK>>>\n<<<SOLUTION>>>\n해결.\n<<<END_SOLUTION>>>\n<<<EFFECTS>>>\n효과.\n<<<END_EFFECTS>>>\n<<<ABSTRACT>>>\n요약.\n<<<END_ABSTRACT>>>';
    }
    diagCalls++; return '[특허성] 진보성 미흡 — 차별화 필요';
  };
  try { await run('wfDiagnoseAndRewrite()'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  assert.ok(diagCalls >= 1, '★ 진단(step_13) 실행됨');
  assert.ok(genCalls >= 1, '★ 재작성(cohesion) 실행됨');
  assert.ok(!!run('outputs.step_13'), '★ 진단 결과 생성');
});
