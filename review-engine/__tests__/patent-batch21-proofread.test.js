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
  assert.ok(p.includes("소속·구성 계층 오류"), "★ B 소속·계층 오류(배치21-2 확장 제목)");
  assert.ok(p.includes('유령 명칭'), '★ C 명칭·부호 정합');
  assert.ok(p.includes('의미 역전'), '★ D 의미 역전·내부 모순');
  assert.ok(p.includes('수식·파라미터 정합'), '★ E 수식·파라미터(배치21-2 확장 제목)');
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

// ═══ [배치21-2] 6차 외부 검토 반영 — 신규 결함의 자체 원인 3건 확정·수정 + 점검표 일반화 ═══
// 재현으로 확정한 자체 원인: ① "(100) 장치 본체/시스템" 플레이스홀더가 확정 부호표로 주입돼 LLM 이 산문에
// 복사("장치 본체/시스템(100)"). ② 후방 워크가 명사 충돌 어미(경로·결과·상한의 로/과/한)에서 정당 명칭을
// 절단("이중 경로 순위 산출부"→"순위 산출부" — 부호의 설명 명칭 불일치의 근원). ③ 배치20-9 [대상] 규칙의
// "또는 그 직계 상위 구성부" 모호성 + 도면 허브 지시("가장 많은 연결")가 포함 관계 모순·허브 3중 선언 유발.

test('★21-2a — 워크 명사 충돌 어미 비절단(경로·결과·상한 보존) + 기존 정지 유지', () => {
  assert.strictEqual(run(`_normComponentName(${JSON.stringify('이중 경로 순위 산출부')})`), '이중 경로 순위 산출부', '★ 경로(로$) 비절단 — 부호의 설명 "순위 산출부 : 170" 불일치의 근원 종결');
  assert.strictEqual(run(`_normComponentName(${JSON.stringify('판정 결과 결속부')})`), '판정 결과 결속부', '★ 결과(과$) 비절단');
  assert.strictEqual(run(`_normComponentName(${JSON.stringify('상한 설정부')})`), '상한 설정부', '★ 상한(한$) 비절단');
  assert.strictEqual(run(`_normComponentName(${JSON.stringify('가 생성한 요청 스냅샷은 세그먼트 색인부')})`), '세그먼트 색인부', '★ 조사-끝 어절(은$) 정지는 유지');
  assert.strictEqual(run(`_normComponentName(${JSON.stringify('경우에도 표본 충분성 판정부')})`), '표본 충분성 판정부', '★ 보조사(에도$) 정지는 유지');
});

test('★21-2b — 확정 부호표: 플레이스홀더 소멸 + 실제 장치 주어 + 계층(하위) 표기', () => {
  run(`selectedTitle='정책사업 분석·매칭 서버'; selectedTitleType='서버';`);
  const blk = run(`_buildRefPlanBlock([{num:110,name:'요청 조립부',level:1,parent:100},{num:121,name:'승격 게이트부',level:2,parent:120}])`);
  assert.ok(!blk.includes('장치 본체/시스템'), '★ 플레이스홀더 소멸(LLM 이 산문에 복사하던 "장치 본체/시스템(100)" 유출 차단)');
  assert.ok(/\(100\) .*최상위/.test(blk), '★ (100) 실제 주어 + 최상위 명시');
  assert.ok(blk.includes('(121) 승격 게이트부 — (120)의 하위 구성'), '★ 계층 표기 — 포함 관계의 단일 진실원천');
});

test('★21-2c — 생성 프롬프트: 포함 관계 규칙·[대상] 항상 서버(100)·허브 도면-한정', () => {
  assert.match(PATENT_SRC, /하위 구성부를 다른 구성부의 포함 주체로 서술하지 마라/, '★ cohesion 포함 관계 규칙(같은 부호 두 부모 금지)');
  assert.match(PATENT_SRC, /\[대상\] 규칙: 도 2 이후 세부 구성 도면의 \[대상\]은 항상/, '★ [대상]=서버(100) 고정("직계 상위 구성부" 허용 문구 제거 — 포함 관계 모순의 근원)');
  assert.ok(!PATENT_SRC.includes('또는 그 직계 상위 구성부로 하라'), '★ 모호 문구 소멸');
  assert.match(PATENT_SRC, /이 도면 안에서 가장 많은 연결을 가진 노드/, '★ 허브 정의 도면-한정(전역 최상급 3중 선언 차단)');
  assert.match(PATENT_SRC, /전역 최상급의 허브 서술을 본문에 쓰지 마라/, '★ cohesion 본문 최상급 금지');
});

test('★21-2d — 교열 점검표 일반화 보강: 계층 트리·최상급 중복·독립변수 결합·파라미터 전수·숫자 검산·이중 용어', () => {
  run(`outputs.step_06='【청구항 1】 요청 조립부(110)를 포함하는 서버.'; outputs.step_08='본문.'; refPlan=[{num:110,name:'요청 조립부',level:1,parent:100}];`);
  const p = run(`buildProofreadPrompt(_proofreadSections())`);
  assert.ok(p.includes('하나의 트리를 이루는지'), '★ B: 포함 관계 단일 트리(같은 부호 두 부모 모순)');
  assert.ok(p.includes('전역 최상급'), '★ D: 최상급 중복 선언(허브 3중)');
  assert.ok(p.includes('서로 독립인 변수를 일대일로 묶어'), '★ D: 독립 변수 결합(등급-완화류)');
  assert.ok(p.includes('미정의 파라미터'), '★ E: 파라미터 전수 정의(하한 미정의류)');
  assert.ok(p.includes('계산 가능한 값'), '★ R: 숫자 검산 리포트(8,550만·884,694류 — 수정 금지·보고 전용)');
  assert.ok(p.includes('서로 다른 층위 이중 사용'), '★ C: 용어 이중 사용(판단 불가류)');
  assert.ok(p.includes('[구성 계층 — 코드가 청구항에서 확정'), '★ 계층 기준 블록 주입(교열의 검증 기준)');
});

// ═══ [배치21-3] 충실성 최적화(야간 통합) — 접미 목록 동기 + 구시대 절단 한도 현행화 ═══
// 조사 결론: 발명 입력 채널 자체(청구항 getFullInvention·cohesion [발명 내용 전문])는 무절단 설계로 충실하나,
// ① 구성 접미 목록이 '샘플러'류를 미포섭해 청구항 구성요소가 refPlan·부호표·커버리지 체계에서 제외
//    (외부 검토 7판본 연속 '음성 샘플러' 뒷받침 잔존의 구조 원인 — 검증기 _sufAlt ⊋ 배정기 접미 비대칭 포함),
// ② 2차 경로의 절단 한도가 8k 시절 값: 기저 주입 16000 < maximal 프리셋 25000(재작성 시 본문 후반 통째
//    소실 — 클램핑 문구·파라미터 정의 소실 실증과 부합), REVIEW_NOTES 8000 < 진단 실측 12,198자(부분 반영),
//    진단 입력 6000 < 본문 20k(후반부 결함 미발견), 교열 청구범위 6000(대조 기준 절단).

test('★21-3a — 접미 확장: 청구항 "음성 샘플러"가 배정·정합 체계에 포섭된다(7판본 잔존 원인 종결)', () => {
  const plan = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify('【청구항 1】 학습 표본 구성부(210)를 포함하는 서버.\n【청구항 2】 제 1 항에 있어서, 상기 학습 표본 구성부(210)에 연계되는 음성 샘플러를 더 포함하는 서버.')}))`));
  assert.ok(plan.some(p => p.name === '음성 샘플러'), '★ 음성 샘플러 배정(종전: 접미 미포섭 → refPlan·부호표·본문 커버리지에서 투명)');
  const cls = JSON.parse(run(`JSON.stringify(_assignRefNumbers(${JSON.stringify('【청구항 1】 특징 분류기(220)를 포함하는 장치.')}))`));
  assert.ok(cls.some(p => p.name === '특징 분류기' && String(p.num) === '220'), '★ ~기류 명시 어휘(분류기) 포섭');
  assert.match(PATENT_SRC, /메모리\|매핑\|레지스트리\|샘플러\|스케줄러/, '★ 검증기 _sufAlt 동기(검증⊋배정 비대칭 해소)');
});

test('★21-3b — 기저 주입 한도 현행화: maximal 프리셋(25k)에서 본문 후반 소실 불가', () => {
  assert.match(PATENT_SRC, /slice\(0,32000\);\s+\/\/ ★ \[배치21-3\] 16000→32000/, '★ 장치 기저 32000(종전 16000 — 재작성이 후반 6~9천자를 기저 없이 재생성/누락하던 구조 원인)');
  assert.match(PATENT_SRC, /slice\(0,12000\):'';\s+\/\/ ★ \[배치21-3\] 6000→12000/, '★ 방법 기저 12000');
  assert.match(PATENT_SRC, /slice\(0,6000\)\):'';\s+\/\/ ★ \[배치21-3\] 2500→6000/, '★ 마무리 블록 기저 6000');
});

test('★21-3c — 반영·진단·교열 입력 한도 현행화(실측 정합)', () => {
  assert.match(PATENT_SRC, /_pendingReviewNotes\)\.slice\(0,16000\)/, '★ REVIEW_NOTES 16000(진단 실측 12,198자 > 종전 8000 절단 → AI 지적 부분 반영 문제)');
  assert.match(PATENT_SRC, /_pendingFixTargets\)\.slice\(0,14000\)/, '★ FIX_TARGETS 14000');
  assert.match(PATENT_SRC, /slice\(0,_c\?2500:16000\)/, '★ 진단 상세설명 입력 16000(종전 6000 — 20k 본문의 후반부 결함 미발견 원인. 축약 모드 2500은 타임아웃 대비 유지)');
  assert.match(PATENT_SRC, /slice\(0,_c\?1200:8000\)/, '★ 진단 방법 상세설명 8000');
  assert.match(PATENT_SRC, /\.slice\(0,12000\);\s+\/\/ ★ \[배치21-3\] 6000→12000 — 명칭·계층 대조 기준/, '★ 교열 청구범위 기준 12000');
});

test('★21-3d — 충실 채널 불변 확인(회귀 방지): 청구항·본문 발명 입력은 무절단 유지', () => {
  const i6 = PATENT_SRC.indexOf("case 'step_06'");
  const s6 = PATENT_SRC.slice(i6, i6 + 8000);
  assert.ok(s6.includes('getFullInvention()'), '★ 청구항 생성은 발명 전문(업로드 파일 포함) 무절단');
  assert.match(PATENT_SRC, /\[발명 내용 전문\]\n\$\{inv\}/, '★ cohesion 본문 생성도 발명 전문 무절단');
  assert.match(PATENT_SRC, /발명 내용 반영 완전성/, '★ cohesion 자기점검 [7] 유지(내용 누락 자기검증 계약)');
});
