/**
 * review-engine/__tests__/patent-batch21-proofread.test.js
 * ★ 배치21-1 — AI 교열 레인: 검출의 LLM 전면 이관 + 국소 패치 게이트.
 *
 * 정책 전환(두더지잡기 종료): 외부 검토 5회가 찾은 언어 결함(비문·탈락·소속·의미)은 결정론 규칙으로
 * 열거 불가능함이 실증됐다(블랙리스트 갭 재발). → 검출은 일반화 점검표 프롬프트로 LLM 이 전담하고,
 * 결정론 규칙 레이어는 동결(유지·보수만). 단 "수정"은 LLM 전문 재작성이 아니라(재추첨·잘못 고침 실증 —
 * 외부 검토 "검증 중 새로 생긴 파손 3곳"·"1건마저 잘못 고쳐짐") 문장 단위 국소 패치를 코드 게이트
 * (원문 축자 일치·참조부호 집합 보존·길이·마커)로 적용한다: LLM 이 판단하고, 코드가 안전하게 집행한다.
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

let sandbox; let toasts = [];
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast: (m, t) => toasts.push({ m, t }), showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', checked: false, style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '', addEventListener() {}, textContent: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast: (m, t) => toasts.push({ m, t }), escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '', confirm: () => true,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});
const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
beforeEach(() => { run('clearAllState();'); toasts = []; });

test('★21-1a — 프롬프트: 일반화 점검표(A~F)·절대 원칙·JSON 계약·청구항 읽기 전용', () => {
  run(`outputs.step_06='【청구항 1】 데이터 저장부(110)를 포함하는 서버.'; outputs.step_08='도 1을 참조하면, 데이터 저장부(110)는 값을 보관한다.'; outputs.step_16='효과가 있다.';`);
  const p = run(`buildProofreadPrompt(_proofreadSections())`);
  assert.ok(p.includes('문장 성분 탈락 비문'), '★ A 성분 탈락(외부 검토 목적어/시/경우 유형 일반화)');
  assert.ok(p.includes('소속·수식 관계 오류'), '★ B 소속 오류');
  assert.ok(p.includes('유령 명칭'), '★ C 명칭·부호 정합');
  assert.ok(p.includes('의미 역전'), '★ D 의미 역전·내부 모순');
  assert.ok(p.includes('수식 정합'), '★ E 수식');
  assert.ok(p.includes('사상 및 필드'), '★ F 관용구(재발 이력 명시)');
  assert.ok(p.includes('전문 재작성 금지'), '★ 국소 패치 원칙');
  assert.ok(p.includes('참조부호 보존'), '★ 부호 보존 원칙');
  assert.ok(p.includes('reports'), '★ 사람-판단 레인 분리(숫자·청구범위는 수정 금지)');
  assert.ok(p.includes('[SECTION step_08]'), '★ 섹션 id 직렬화(패치 적용 키)');
  assert.ok(p.includes('청구범위·도면은 읽기 전용'), '★ 청구항 불변 원칙');
});

test('★21-1b — 패치 게이트: 원문 불일치·부호 변경·길이 급변·비허용 섹션은 문서 불변으로 보류', () => {
  run(`outputs.step_08='요청 조립부(110)가 생성한 세그먼트 색인부(120)로 전달되고, 나머지는 정상이다.';`);
  const res = JSON.parse(run(`JSON.stringify((()=>{const r=_applyProofreadPatches(${JSON.stringify([
    { section: 'step_08', class: 'A', before: '요청 조립부(110)가 생성한 세그먼트 색인부(120)로 전달되고', after: '요청 조립부(110)가 생성한 요청 스냅샷은 세그먼트 색인부(120)로 전달되고', reason: '목적어 복원' },
    { section: 'step_08', class: 'A', before: '존재하지 않는 원문 문장이다', after: '아무거나', reason: 'x' },
    { section: 'step_08', class: 'C', before: '나머지는 정상이다.', after: '나머지는 정상부(999)이다.', reason: '부호 추가 시도' },
    { section: 'step_08', class: 'A', before: '나머지는 정상이다.', after: '짧', reason: '과절삭 시도' },
    { section: 'step_06', class: 'A', before: '아무 청구항 문장', after: '수정', reason: '청구항 수술 시도' },
  ])}); return {a:r.applied.length, s:r.skipped.map(x=>x.why)};})())`));
  assert.strictEqual(res.a, 1, '★ 정상 패치 1건만 적용');
  assert.ok(res.s.some(w => /원문 불일치/.test(w)), '★ before 미발견 보류(환각 패치 차단)');
  assert.ok(res.s.some(w => /참조부호 변경/.test(w)), '★ 부호 집합 보존 게이트');
  assert.ok(res.s.some(w => /길이 급변/.test(w)), '★ 과절삭/폭주 게이트');
  assert.ok(res.s.some(w => /허용 섹션 아님/.test(w)), '★ 청구항·도면 불변 게이트');
  assert.ok(run('outputs.step_08').includes('요청 스냅샷은'), '★ 적용된 수정 반영');
  assert.ok(run('outputs.step_08').includes('나머지는 정상이다.'), '★ 보류 패치는 문서 불변');
});

test('★21-1c — E2E: 검출(LLM 모의) → 게이트 적용 → 결과·로그 보고', async () => {
  run(`clearAllState(); outputs={ step_06:'【청구항 1】 표본 충분성 판정부(150)를 포함하는 서버.', step_08:'검증 미통과 대체 참조 산출부(170)의 결과로 전환한다. 표본 충분성 판정부(150)가 판정한다.', step_16:'본 발명의 사상 및 필드로부터 벗어나지 않는다.' };`);
  sandbox.App.callClaude = async () => ({ text: JSON.stringify({
    patches: [
      { section: 'step_08', class: 'A', before: '검증 미통과 대체 참조 산출부(170)의 결과로 전환한다.', after: '검증 미통과 시 대체 참조 산출부(170)의 결과로 전환한다.', reason: "의존명사 '시' 복원" },
      { section: 'step_16', class: 'F', before: '본 발명의 사상 및 필드로부터 벗어나지 않는다.', after: '본 발명의 사상 및 범위로부터 벗어나지 않는다.', reason: '관용구 교정' },
    ],
    reports: [ { class: 'R', where: '학습 표본 수치', note: '975,308/906,145 분할 비율 비정상 — 실데이터 확정 필요' } ],
  }) });
  await run('runProofread()');
  assert.ok(run('outputs.step_08').includes('검증 미통과 시 대체'), '★ 패치 적용');
  assert.ok(run('outputs.step_16').includes('사상 및 범위'), '★ 관용구 패치 적용');
  assert.ok(toasts.some(t => /AI 교열 완료 — 수정 2건 적용/.test(t.m)), '★ 결과 토스트(적용·보류·리포트 3분 집계)');
  assert.ok(toasts.some(t => /리포트 1건/.test(t.m)), '★ 사람-판단 리포트 별도 보고');
});

test('★21-1d — UI 배선 + 정책 주석(규칙 레이어 동결)', () => {
  assert.match(HTML_SRC, /id="btnProofread" onclick="runProofread\(\)"/, '★ ⑤ 교열 버튼');
  assert.match(HTML_SRC, /청구항·도면 불변<\/b>, 전문 재작성 없음/, '★ 카드가 불변 원칙을 명시');
  assert.match(PATENT_SRC, /정책\(규칙 레이어 동결\)/, '★ 두더지잡기 종료 정책이 소스에 명문화');
  assert.match(PATENT_SRC, /⑤ 「AI 교열」로 문장·표기 전수 검수/, '★ ④ 완료 안내가 교열로 연결');
});
