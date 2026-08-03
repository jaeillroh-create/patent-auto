/**
 * review-engine/__tests__/patent-batch19-guard-progress.test.js
 * ★ 배치 19 — 중복 실행 차단 + 진행 표시 + 재생성 악화 방지 + 결정론 정리 + 안내 명확화.
 *   docM: [진단 후 결함 반영해 다시 쓰기] 처리 중 표시가 없어 3회 클릭 → 동시 재작성 중첩 → 분량 2배·근접중복·미완 마커 유출,
 *   HIGH 4→67·CRITICAL 0→1 악화. 원인: wfRewriteWithFixes 무가드 + cohesion chained 우회.
 *   19-1 단일 실행 락(_rewriteLock, 재진입 방지·최외곽 소유). 19-2 진행 오버레이. 19-3 악화 시 이전 유지.
 *   19-4 미완 마커·근접 중복 결정론 정리. 19-5 이동 버튼 목적 명명.
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

let sandbox; const els = {}; let toasts = []; let confirmReturn = true;
const mkEl = () => ({ value: '', checked: false, disabled: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '', getAttribute: () => '' });
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = {
    sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }),
    callClaudeWithContinuation: async (pr) => { await new Promise(r => queueMicrotask(r));
      if (/REFTABLE|DEVICE_DESC|출력 계약/.test(String(pr))) return '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n제어부(100)가 동작한다.\n<<<END_DEVICE_DESC>>>\n<<<TASK>>>\n과제.\n<<<END_TASK>>>\n<<<SOLUTION>>>\n해결.\n<<<END_SOLUTION>>>\n<<<EFFECTS>>>\n효과.\n<<<END_EFFECTS>>>\n<<<ABSTRACT>>>\n요약.\n<<<END_ABSTRACT>>>';
      return '[특허성] 진보성 미흡'; },
    escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {}, updateStats() {}, safeMaxTokensLarge: () => 16000,
  };
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error, queueMicrotask,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, updateStats() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => confirmReturn, API_KEY: 'stub',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
const runP = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
beforeEach(() => { Object.keys(els).forEach(k => delete els[k]); toasts = []; confirmReturn = true; run('clearAllState(); _rewriteLock=false;'); });

// ═══════════════ 19-1) 중복 실행 락 ═══════════════

test('19-1 ★ — _acquireRewriteLock: 최외곽 획득(true) / 내부(_locked)=통과(false) / 재진입=차단(null)', () => {
  run('_rewriteLock=false;');
  assert.strictEqual(run('_acquireRewriteLock({})'), true, '★ 최외곽 획득');
  assert.strictEqual(run('_acquireRewriteLock({})'), null, '★ 이미 보유 → 차단(null)');
  assert.strictEqual(run('_acquireRewriteLock({_locked:true})'), false, '★ 내부 호출 → 통과(false, 비소유)');
  run('_releaseRewriteLock();');
  assert.strictEqual(run('_rewriteLock'), false, '★ 해제');
});

test('19-1 ★ 동작 — 실행 중 중복 클릭 물리 차단(첫 클릭만 실행, 나머지 "이미 처리 중")', async () => {
  run(`clearAllState(); selectedTitle="t"; selectedTitleType="서버"; outputs={ step_06:"【청구항 1】 제어부(100)를 포함하는 장치.", step_07:"도 1", step_08:"제어부(100)가 동작한다." };`);
  els.chkUnifiedMath = mkEl();
  const p1 = run('wfDiagnoseAndRewrite()');
  assert.strictEqual(run('_rewriteLock'), true, '★ 첫 클릭이 락 획득');
  assert.strictEqual(els.btnWfRewriteFixes.disabled, true, '★ 실행 중 버튼 비활성');
  const p2 = run('wfDiagnoseAndRewrite()');   // 중복
  const p3 = run('wfDiagnoseAndRewrite()');   // 중복
  await Promise.all([p1, p2, p3]);
  assert.ok(toasts.filter(t => /이미 처리 중/.test(t.m)).length >= 2, '★ 중복 클릭 2회 차단 토스트');
  assert.strictEqual(run('_rewriteLock'), false, '★ 완료 후 락 해제');
});

test('19-1 ★ 동작 — 완료 후 재호출은 정상 실행(락 재획득)', async () => {
  run(`clearAllState(); selectedTitle="t"; selectedTitleType="서버"; outputs={ step_06:"【청구항 1】 제어부(100)를 포함하는 장치.", step_07:"도 1", step_08:"제어부(100)가 동작한다." };`);
  els.chkUnifiedMath = mkEl();
  await run('wfDiagnoseAndRewrite()');
  assert.strictEqual(run('_rewriteLock'), false, '★ 1회차 후 해제');
  toasts = [];
  const ok = run('_acquireRewriteLock({})');
  assert.strictEqual(ok, true, '★ 완료 후 재획득 가능');
  run('_releaseRewriteLock();');
});

test('19-1 ★ — _updateRewriteBtn: 락 보유 중엔 버튼 재활성 금지(docM 재현 지점)', () => {
  run(`clearAllState(); outputs={ step_06:"【청구항 1】 제어부." };`);
  els.btnWfRewriteFixes = mkEl();
  run('_rewriteLock=true; _updateRewriteBtn();');
  assert.strictEqual(els.btnWfRewriteFixes.disabled, true, '★ 락 중 disabled 유지(재활성 안 함)');
  run('_rewriteLock=false; _updateRewriteBtn();');
  assert.strictEqual(els.btnWfRewriteFixes.disabled, false, '★ 락 해제 후 정상 활성');
});

test('19-1 ★ — _setRewriteBusy: 재작성·진단·통합생성·재생성 버튼 일괄 비활성', () => {
  ['btnWfRewriteFixes','btnStep13','btnUnifiedGen','btnWfRegenClaims','btnWfRegenFigures'].forEach(id => els[id] = mkEl());
  run('_setRewriteBusy(true);');
  ['btnWfRewriteFixes','btnStep13','btnUnifiedGen','btnWfRegenClaims','btnWfRegenFigures'].forEach(id => assert.strictEqual(els[id].disabled, true, '★ '+id+' 비활성'));
  run('_setRewriteBusy(false);');
  assert.strictEqual(els.btnStep13.disabled, false, '★ 해제 후 재활성');
});

test('19-1 ★ 소스 — 전 경로 락 배선(4함수 + 우회 경로)', () => {
  assert.match(PATENT_SRC, /let _rewriteLock=false;/, '★ 락 상태');
  assert.match(PATENT_SRC, /function _acquireRewriteLock\(opts\)\{/, '★ 획득 헬퍼');
  assert.match(PATENT_SRC, /if\(opts\._locked\)return false;/, '★ 내부 통과');
  assert.match(PATENT_SRC, /async function runUnifiedCohesionGen\(opts\)\{[\s\S]{0,300}_acquireRewriteLock\(\{_locked:\(opts\._locked\|\|opts\.chained\)\}\)/, '★ cohesion: chained/_locked 통과');
  assert.match(PATENT_SRC, /async function runDiagnosis\(opts\)\{[\s\S]{0,200}_acquireRewriteLock\(opts\)/, '★ runDiagnosis 락');
});

// ═══════════════ 19-3) 재생성 악화 방지 ═══════════════

test('19-3 ★ — _sevCounts: HIGH/CRITICAL 집계', () => {
  const c = JSON.parse(run(`JSON.stringify(_sevCounts([{severity:'HIGH'},{severity:'HIGH'},{severity:'CRITICAL'},{severity:'MEDIUM'}]))`));
  assert.strictEqual(c.high, 2, '★ HIGH 2'); assert.strictEqual(c.crit, 1, '★ CRITICAL 1');
});

test('19-3 ★ — 스냅샷/복구: 본문 계열만 스냅샷 후 복구', () => {
  run(`clearAllState(); outputs={ step_06:"청구항", step_08:"본문 원본", step_16:"효과 원본" };`);
  run('globalThis.__snap=_snapshotBodyOutputs();');
  run(`outputs.step_08="재작성 악화본"; outputs.step_16="악화 효과";`);
  run('_restoreBodyOutputs(globalThis.__snap);');
  assert.strictEqual(run('outputs.step_08'), '본문 원본', '★ step_08 복구');
  assert.strictEqual(run('outputs.step_16'), '효과 원본', '★ step_16 복구');
  assert.strictEqual(run('outputs.step_06'), '청구항', '★ 청구항(비스냅샷)은 불변');
});

test('19-3 ★ 소스 — 악화 판정 + confirm 취소 시 이전 유지(권장)', () => {
  assert.match(PATENT_SRC, /const _snap=\(typeof _snapshotBodyOutputs==='function'\)\?_snapshotBodyOutputs\(\):null;/, '★ 재작성 전 스냅샷');
  assert.match(PATENT_SRC, /const _worse=\(_afterSev\.crit>_beforeSev\.crit\)\|\|\(_afterSev\.crit===_beforeSev\.crit&&_afterSev\.high>_beforeSev\.high\);/, '★ 악화 판정(CRITICAL 우선, HIGH)');
  assert.match(PATENT_SRC, /if\(_worse && _snap\)\{[\s\S]{0,400}_restoreBodyOutputs\(_snap\)/, '★ 악화 + 취소 → 복구');
  assert.match(PATENT_SRC, /이전 본문 유지\(권장\)/, '★ 기본 권장: 이전 유지');
});

// ═══════════════ 19-4) 결정론 정리 ═══════════════

test('19-4b ★ — _stripStrayMarkers: 완전형·미완(닫힘 없음)·바 END_ 토큰 제거', () => {
  const r = JSON.parse(run(`JSON.stringify(_stripStrayMarkers('제어부(100)가 동작한다. <<<END_DEVICE_DESC 저장부(110). <<<REFTABLE>>> 처리부는 END_METHOD_DESC 실행.'))`));
  assert.ok(r.removed >= 3, '★ 3종 이상 제거');
  assert.ok(!/<<<|>>>|END_(DEVICE|METHOD|REFTABLE)/.test(r.text), '★ 마커 잔존 0(미완 <<<END_DEVICE_DESC 포함)');
});

test('19-4a ★ — _dedupAdjacentParas: 인접 ±5 근접 중복만 제거(원거리 정당 반복 보존)', () => {
  const P = '상기 구조화부는 입력 시나리오로부터 캐릭터 대사를 보존하는 구조화를 수행하도록 구성된 것이다.';
  const paras = [P, '가 나 다 라 마 바 사 아 자 차 카 타 파 하 별개문단 하나.', P, 'A문단 충분히 길게 작성된 별개 내용.', 'B문단 충분히 길게 작성된 별개 내용.', 'C문단 충분히 길게 작성된 별개 내용.', 'D문단 충분히 길게 작성된 별개 내용.', P];
  const r = JSON.parse(run(`JSON.stringify(_dedupAdjacentParas(${JSON.stringify(paras.join('\n\n'))}, 5))`));
  assert.strictEqual(r.removed, 1, '★ 인접(1↔3) 1개만 제거');
  assert.strictEqual(r.text.split(/\n{2,}/).length, 7, '★ 8→7(원거리 8번째 P 보존)');
});

test('19-4c ★ 소스 — 분량 폭주(목표 1.5배 초과) 경고 + 정리 건수 배너', () => {
  assert.match(PATENT_SRC, /const _overVol=\(_tgt>0 && _descLen > Math\.floor\(_tgt\*1\.5\)\);/, '★ 1.5배 폭주 감지');
  assert.match(PATENT_SRC, /커밋 전 정리\(미완 마커/, '★ 정리 건수 토스트');
  assert.match(PATENT_SRC, /_stripStrayMarkers\(outputs\[k\]\)/, '★ 커밋 전 마커 정리 배선');
  assert.match(PATENT_SRC, /_dedupAdjacentParas\(outputs\[k\],5\)/, '★ 커밋 전 인접 dedup 배선');
});

// ═══════════════ 19-2) 진행 표시 ═══════════════

test('19-2 ★ — 진행 오버레이: 시작·단계·완료 렌더', () => {
  els.wfRewriteOverlay = mkEl(); els.wfRewriteSteps = mkEl(); els.wfRewriteElapsed = mkEl(); els.wfRewriteOverlayNote = mkEl();
  run('_wfProgressStart();');
  assert.strictEqual(els.wfRewriteOverlay.style.display, 'flex', '★ 오버레이 표시');
  assert.ok(/기계검증 수집/.test(els.wfRewriteSteps.innerHTML) && /AI 진단/.test(els.wfRewriteSteps.innerHTML) && /재검증/.test(els.wfRewriteSteps.innerHTML), '★ 4단계 체크리스트');
  run(`_wfProgressStep('diagnose','done');`);
  assert.ok(/✓/.test(els.wfRewriteSteps.innerHTML), '★ 완료 ✓ 표시');
  run('_wfProgressDone(true);');
  assert.ok(/완료/.test(els.wfRewriteOverlayNote.innerHTML), '★ 완료 안내');
});

test('19-2 ★ — HTML 오버레이 컨테이너 + 배선', () => {
  assert.match(HTML_SRC, /id="wfRewriteOverlay"/, '★ 오버레이 컨테이너');
  assert.match(HTML_SRC, /id="wfRewriteSteps"/, '★ 단계 체크리스트');
  assert.match(HTML_SRC, /id="wfRewriteElapsed"/, '★ 경과시간');
  assert.match(HTML_SRC, /onclick="_wfProgressClose\(\)"/, '★ 닫기(백그라운드 진행)');
  assert.match(PATENT_SRC, /if\(typeof _wfProgressStart==='function'\)_wfProgressStart\(\);/, '★ wfDiagnoseAndRewrite 진행 시작 배선');
});

// ═══════════════ 19-5) 이동 버튼 명명 ═══════════════

test('19-5 ★ — ⑤→④ / ④→⑤ 이동 버튼 목적 명명 + 부제', () => {
  // ⑤ 검증 패널 → ④ 재작성
  assert.match(PATENT_SRC, /④에서 결함 반영해 다시 쓰기/, '★ ⑤→④: 목적 명명');
  assert.match(PATENT_SRC, /여기 표시된 결함을 프롬프트에 넣어 본문을 재작성합니다/, '★ ⑤→④ 부제');
  // ④ 배너 → ⑤ 검증
  assert.match(PATENT_SRC, /⑤ 검증 결과 상세 보기/, '★ ④→⑤: 목적 명명');
  assert.match(PATENT_SRC, /재작성 결과의 잔존 결함 목록과 다운로드 게이트를 확인/, '★ ④→⑤ 부제(문서 불변)');
});
