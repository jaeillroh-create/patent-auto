/**
 * review-engine/__tests__/patent-batch17-refplan.test.js
 * ★ 배치 17 — 부호 배정 주체 이전: LLM → 코드(구조 변경).
 *   실증(docJ/docK): HIGH 결함 대부분이 단일 부호 결함군(canonical↔body 불일치 110↔프로세서 + 동일명칭 다중부호)에서 파생.
 *   종전 대응(15K 금지어·16 FIX_TARGETS)은 "LLM 이 잘 쓰도록 지시"라 확률적으로 실패. 배치17은 청구항 확정 시점에 코드가
 *   부호를 결정론적으로 배정(refPlan)하고, LLM 은 그 부호표를 고정 입력([확정 부호표])으로 받아 본문만 쓴다. 커밋 직전
 *   _enforceRefPlan 이 본문을 refPlan 에 결정론 정합 → 부호 결함군이 발생 자체 불가능.
 *   합격 기준: 1-shot 생성에서 refnum_dupassign 0 + refnum_consistency 0 / 기존 청구항 번호 채택 / 게이트·회귀 green.
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

// ═══════════════ 1) _assignRefNumbers — 결정론 부호 배정 ═══════════════

const CLAIMS_NEW = '【청구항 1】 데이터를 수신하는 수신부; 상기 데이터를 정합성 검증하는 정합성 검증부; 상기 데이터를 저장하는 저장부를 포함하는 장치.\n'
  + '【청구항 2】 제1항에 있어서, 상기 정합성 검증부는 해시 대조부와 무결성 판단부를 포함하는 장치.';

test('17-1 ★ — _assignRefNumbers: 신규 순차 배정(구성부 110·120·130, 종속 하위 121·122)', () => {
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify(CLAIMS_NEW)},{}))`));
  const byName = {}; plan.forEach(p => byName[p.name] = p.num);
  assert.strictEqual(byName['수신부'], 110, '★ 수신부 110');
  assert.strictEqual(byName['정합성 검증부'], 120, '★ 정합성 검증부 120');
  assert.strictEqual(byName['저장부'], 130, '★ 저장부 130');
  assert.strictEqual(byName['해시 대조부'], 121, '★ 종속항 신규 구성 → 부모(120) 하위 121');
  assert.strictEqual(byName['무결성 판단부'], 122, '★ 하위 122');
});

test('17-1 ★ — 관형절 수식어 제거: "데이터를 수신하는 수신부" → "수신부"(동일구성 이중배정 차단)', () => {
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify(CLAIMS_NEW)},{}))`));
  const names = plan.map(p => p.name);
  assert.ok(names.includes('수신부') && !names.some(n => /하는 수신부$/.test(n)), '★ 관형절 벗긴 구성명사만');
  // 정합성 검증부가 하나의 부호로만(관형절 유무로 갈리지 않음)
  assert.strictEqual(names.filter(n => n === '정합성 검증부').length, 1, '★ 정합성 검증부 단일 부호');
});

test('17-1 ★ — 명칭↔번호 1:1(중복 0): dupassign 구조적 불가', () => {
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify(CLAIMS_NEW)},{}))`));
  const names = plan.map(p => p.name), nums = plan.map(p => String(p.num));
  assert.strictEqual(names.length - new Set(names).size, 0, '★ 명칭 중복 0');
  assert.strictEqual(nums.length - new Set(nums).size, 0, '★ 번호 중복 0');
});

test('17-1 ★ — 기존 청구항 번호 채택(변리사 확정값 우선) + 신규는 이후 순차', () => {
  const CLAIMS_NUM = '【청구항 1】 제어부(100)와 저장부(110)와 통신부(120)를 포함하는 장치.\n【청구항 2】 제1항에 있어서, 상기 저장부는 판단부와 실행부를 더 포함하는 장치.';
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify(CLAIMS_NUM)},{}))`));
  const byName = {}; plan.forEach(p => byName[p.name] = p.num);
  assert.strictEqual(byName['제어부'], 100, '★ 확정 100 채택');
  assert.strictEqual(byName['저장부'], 110, '★ 확정 110 채택');
  assert.strictEqual(byName['통신부'], 120, '★ 확정 120 채택');
  assert.ok(byName['판단부'] >= 100 && byName['실행부'] >= 100 && byName['판단부'] !== byName['실행부'], '★ 신규 구성은 미사용 번호로 유일 배정');
});

test('17-1 ★ — 방법 ON: "~하는 단계" → S110·S120 단계부호(명칭 전체 보존)', () => {
  const M = '【청구항 3】 데이터를 수신하는 단계; 상기 데이터를 검증하는 단계를 포함하는 방법.';
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify(CLAIMS_NEW)},{method:true,methodText:${JSON.stringify(M)}}))`));
  const s = plan.filter(p => String(p.num)[0] === 'S');
  assert.ok(s.some(p => p.num === 'S110' && /수신하는 단계$/.test(p.name)), '★ S110 수신 단계(관형절 보존)');
  assert.ok(s.some(p => p.num === 'S120'), '★ S120 검증 단계');
});

// ═══════════════ 2) _enforceRefPlan — 본문 사후 정합(결정론) ═══════════════

const RP = `[{num:100,name:'제어부'},{num:110,name:'저장부'},{num:120,name:'정합성 검증부'}]`;

test('17-3 ★ — (a) 하드웨어 상용어 치환 교정: "프로세서(100)" → "제어부(100)"(canonical↔body)', () => {
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan('상기 프로세서(100)는 연산한다.', ${RP}))`));
  assert.ok(/제어부\(100\)/.test(r.text) && !/프로세서\(100\)/.test(r.text), '★ 번호(100) 기준 canonical 명칭으로');
  assert.ok(r.fixes >= 1, '★ 교정 카운트');
});

test('17-3 ★ — (b) 명칭 기준 번호 교정: "저장부(999)" → "저장부(110)"', () => {
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan('상기 저장부(999)에 기록한다.', ${RP}))`));
  assert.ok(/저장부\(110\)/.test(r.text), '★ 명칭(저장부) 확정 번호(110)로');
});

test('17-3 ★ — (a) 번호 기준 명칭 교정: "메모리(110)" → "저장부(110)"', () => {
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan('상기 메모리(110)를 참조한다.', ${RP}))`));
  assert.ok(/저장부\(110\)/.test(r.text) && !/메모리\(110\)/.test(r.text), '★ 확정 번호(110)의 canonical 명칭으로');
});

test('17-3 ★ — 다단어 명칭·"상기" 선행 문맥 보존', () => {
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan('상기 정합성 검증부(120)가 검증한다.', ${RP}))`));
  assert.strictEqual(r.fixes, 0, '★ 이미 정합 → 무변경');
  assert.ok(/상기 정합성 검증부\(120\)/.test(r.text), '★ 다단어·상기 보존');
});

test('17-3 ★ — (c) refPlan 미정의 번호는 경고만(자동 삭제 금지)', () => {
  const r = JSON.parse(run(`JSON.stringify(_enforceRefPlan('상기 예비부(700)는 대기한다.', ${RP}))`));
  assert.ok(/예비부\(700\)/.test(r.text), '★ 미정의 번호 본문 보존(사람 판단)');
  assert.ok(r.unknown.includes('700'), '★ unknown 로 경고 수집');
});

// ═══════════════ 3) _ensureRefPlan / _refPlanFromStep18 — 확보·레거시 역산 ═══════════════

test('17-1 ★ — _ensureRefPlan: 청구항(step_06)에서 확정, force 로 재배정', () => {
  run(`clearAllState(); outputs.step_06=${JSON.stringify(CLAIMS_NEW)};`);
  const plan = JSON.parse(run('JSON.stringify(_ensureRefPlan(true)||[])'));
  assert.ok(plan.length >= 5 && plan.some(p => p.name === '수신부'), '★ 청구항 기준 확정');
  assert.ok(run('Array.isArray(refPlan)&&refPlan.length>0'), '★ 전역 refPlan 세팅');
});

test('17-1 ★ — _refPlanFromStep18: 레거시 부호의 설명("명칭 : 번호"/[방법 단계])에서 역산', () => {
  const S18 = '제어부 : 100\n저장부 : 110\n\n[방법 단계]\n수신하는 단계 : S110';
  const plan = JSON.parse(run(`JSON.stringify(_refPlanFromStep18(${JSON.stringify(S18)}))`));
  const byName = {}; plan.forEach(p => byName[p.name] = p.num);
  assert.strictEqual(byName['제어부'], 100, '★ 장치 100');
  assert.strictEqual(byName['저장부'], 110, '★ 장치 110');
  assert.strictEqual(byName['수신하는 단계'], 'S110', '★ 방법 S110(표제 줄 스킵)');
});

test('17-1 ★ — 레거시: 청구항 없고 step_18 만 있는 프로젝트 → 역산으로 refPlan 확보', () => {
  run(`clearAllState(); outputs={step_18:'제어부 : 100\\n저장부 : 110'};`);
  const plan = JSON.parse(run('JSON.stringify(_ensureRefPlan(false)||[])'));
  assert.ok(plan.some(p => p.num === 100 && p.name === '제어부'), '★ step_18 역산');
});

test('17-2 ★ — _buildRefPlanBlock: [장치부호]/[방법단계] 직렬화(프롬프트 입력용)', () => {
  const blk = run(`_buildRefPlanBlock([{num:110,name:'수신부'},{num:'S110',name:'수신하는 단계'}])`);
  assert.ok(/\[장치부호\][\s\S]*\(110\) 수신부/.test(blk), '★ 장치부호 구획');
  assert.ok(/\[방법단계\][\s\S]*\(S110\) 수신하는 단계/.test(blk), '★ 방법단계 구획');
});

// ═══════════════ 4) 통합 흐름 — refPlan 권위화 + 본문 정합(합격 기준: refnum 0) ═══════════════

test('17-2/3 ★ 동작 — LLM 이 확정표 이탈(프로세서(100)+저장부(999)) → 코드가 정합 → refnum 결함 0', async () => {
  run(`clearAllState(); outputs.step_06="【청구항 1】 제어부(100)와 저장부(110)를 포함하는 장치."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="서버"; includeMethodClaims=false;`);
  els.chkUnifiedMath = mkEl();
  const DEVIANT = '<<<REFTABLE>>>\n[장치부호]\n(100) 프로세서\n(999) 저장부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n도 1을 참조하면, 상기 프로세서(100)는 저장부(999)로부터 데이터를 읽어 처리하도록 구성된다. 상기 프로세서(100)는 연산을 수행한다.\n<<<END_DEVICE_DESC>>>';
  const orig = sandbox.App.callClaudeWithContinuation;
  sandbox.App.callClaudeWithContinuation = async () => DEVIANT;
  try { await run('runUnifiedCohesionGen({chained:true})'); }
  finally { sandbox.App.callClaudeWithContinuation = orig; }
  const s08 = run('outputs.step_08') || '', s18 = run('outputs.step_18') || '';
  assert.ok(/제어부\(100\)/.test(s08) && !/프로세서\(100\)/.test(s08), '★ 하드웨어 치환 → canonical 정합');
  assert.ok(/저장부\(110\)/.test(s08) && !/저장부\(999\)/.test(s08), '★ 잘못된 번호 → 확정 번호');
  assert.ok(/제어부 : 100/.test(s18) && /저장부 : 110/.test(s18), '★ 부호의 설명 = 확정 부호표');
  const spec = run('buildSpecification()') || '';
  const bad = JSON.parse(run(`JSON.stringify(validateSpecification(${JSON.stringify(spec)}).filter(function(i){return i.check==='refnum_dupassign'||i.check==='refnum_consistency';}))`));
  assert.strictEqual(bad.length, 0, '★ 합격 기준: refnum_dupassign + refnum_consistency = 0(1-shot)');
  assert.ok(toasts.some(t => /부호 자동 정합/.test(t.m)), '★ "부호 자동 정합 N건" 노출');
});

test('17-2 ★ 동작 — 프롬프트에 [확정 부호표] 주입(REFTABLE 출력→입력 전환)', () => {
  run(`clearAllState(); outputs.step_06="【청구항 1】 제어부(100)와 저장부(110)를 포함하는 장치."; outputs.step_07="도 1"; selectedTitle="t"; selectedTitleType="서버";`);
  run('_ensureRefPlan(true)');   // 실제 플로우가 buildPrompt 이전에 수행하는 순서
  const p = run("buildPrompt('unified_cohesion')");
  assert.ok(/\[확정 부호표\]/.test(p), '★ [확정 부호표] 블록 주입');
  assert.ok(/\(100\)\s*제어부/.test(p) && /\(110\)\s*저장부/.test(p), '★ 확정 명칭·번호 쌍');
  assert.ok(/위 \[확정 부호표\]가 유일한 부호 사전이다/.test(p), '★ C3 확정표 반영 문구');
});

// ═══════════════ 5) 영속(saveProject/openProject) ═══════════════

test('17-1 ★ 소스 — refPlan 상태·영속·초기화 배선', () => {
  assert.match(PATENT_SRC, /let refPlan=null;\s*\/\/ ★ \[배치17\]/, '★ 전역 상태');
  assert.match(PATENT_SRC, /termSnapshot,genParams,refPlan,runLog\}/, '★ saveProject 영속');
  assert.match(PATENT_SRC, /refPlan=\(Array\.isArray\(s\.refPlan\)&&s\.refPlan\.length\)\?s\.refPlan:null;/, '★ openProject 복원');
  assert.match(PATENT_SRC, /refPlan=null;\s*\/\/ ★ \[배치17-1\] 확정 부호표 초기화/, '★ clearAllState 초기화');
});

// ═══════════════ 6) UI — 확정 부호표 읽기전용 패널 ═══════════════

test('17-5 ★ — refPlanPanel: HTML 컨테이너 + switchTab(③) 렌더 훅 + _wfHardReset 정리', () => {
  assert.match(HTML_SRC, /id="refPlanPanel"/, '★ ③ 골격 카드 패널 컨테이너');
  assert.match(PATENT_SRC, /if\(i===2&&typeof _renderRefPlanPanel==='function'\)_renderRefPlanPanel\(\)/, '★ switchTab(page2) 렌더 훅');
  assert.match(PATENT_SRC, /const rp2=document\.getElementById\('refPlanPanel'\); if\(rp2\)\{rp2\.style\.display='none';rp2\.innerHTML='';\}/, '★ _wfHardReset 잔상 제거');
});

test('17-5 ★ 동작 — _renderRefPlanPanel: 확정 부호표 칩 렌더(읽기전용)', () => {
  run(`clearAllState(); outputs.step_06="【청구항 1】 제어부(100)와 저장부(110)를 포함하는 장치."; _ensureRefPlan(true);`);
  els.refPlanPanel = mkEl();
  run('_renderRefPlanPanel();');
  const html = els.refPlanPanel.innerHTML;
  assert.ok(/확정 부호표/.test(html) && /읽기전용/.test(html), '★ 제목·읽기전용 표기');
  assert.ok(/제어부/.test(html) && /저장부/.test(html), '★ 확정 명칭 칩');
  assert.strictEqual(els.refPlanPanel.style.display, 'block', '★ 표시');
});

test('17-5 ★ 동작 — refPlan 없으면 패널 숨김(no-op)', () => {
  run('clearAllState(); outputs={};');
  els.refPlanPanel = mkEl();
  run('_renderRefPlanPanel();');
  assert.strictEqual(els.refPlanPanel.style.display, 'none', '★ 부호표 없으면 숨김');
});

// ═══════════════ 7) 소스 — 플로우 배선(순서·게이트 가드·커밋 정합) ═══════════════

test('17-2/3 ★ 소스 — buildPrompt 이전 refPlan 확정 + 게이트 가드 + 커밋 직전 enforce', () => {
  // refPlan 을 buildPrompt 이전(함수 상단)에 확정
  assert.match(PATENT_SRC, /const _refPlan=\(typeof _ensureRefPlan==='function'\)\?\(_ensureRefPlan\(true\)\|\|\[\]\):\[\];/, '★ 상단 refPlan 확정');
  assert.match(PATENT_SRC, /const _hasRP=!!\(_refPlan&&_refPlan\.length\)&&typeof _refPlanToMap==='function';/, '★ _hasRP 판정');
  // refMap 권위화(hasRef=true → A6/폴백 비활성)
  assert.match(PATENT_SRC, /if\(_hasRP\)\{ r\.refMap=_refPlanToMap\(_refPlan\); r\.ok\.hasRef=true;/, '★ refMap=refPlan 권위화');
  // 부호-구조 게이트가 refPlan 있을 때 비활성
  assert.match(PATENT_SRC, /if\(!_hasRP&&rp\.notInTable\.length\)/, '★ 미정의 부호 게이트 refPlan 가드');
  assert.match(PATENT_SRC, /if\(!_hasRP&&rp\.dupNums\.length\)/, '★ 번호중복 게이트 refPlan 가드');
  // 커밋 직전 전영역 정합(배치18-2: 예시도 합본 후 _enforceAllOutputs 로 상세설명·도면·마무리 일괄 정합)
  assert.match(PATENT_SRC, /if\(_hasRP && typeof _enforceAllOutputs==='function'\)\{ const _ea=_enforceAllOutputs\(_refPlan\);/, '★ 커밋 직전 전영역 enforce(배치18)');
});
