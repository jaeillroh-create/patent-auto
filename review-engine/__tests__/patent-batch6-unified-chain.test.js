/**
 * review-engine/__tests__/patent-batch6-unified-chain.test.js
 *
 * ★ 배치 6 — 통합작성 체인 3건(docC 실측 근거).
 *   N1) 플레이스홀더 유출: (a) CHK-0 placeholder_residue(CRITICAL) 신설 (b) 파서 위생 — 추출 내용 내부
 *       잔존 마커 결정론 제거 (c) cohesion 프롬프트 마커 경계-전용 가드.
 *   N2) 신규 구성 번호 충돌 방지 — REFTABLE에 없는 새 구성 도입 시 미사용 새 번호 + REFTABLE 추가(프롬프트).
 *   N3) 수학식 토글(기본 off) + 기존 step_09 파이프라인 재사용(새 삽입 경로 금지) + dlCfg 분량 연동(#235 하한).
 *   ⚠ 실제 수식 품질·분량 달성은 LLM 산출 — 화면 검증 위임(테스트는 배선·계약·검사만 고정).
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readPatentBundle } from './helpers/patentBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const PATENT_SRC = readPatentBundle(REPO);
const HTML_SRC = readFileSync(path.join(REPO, 'index.html'), 'utf8');

let sandbox;
before(() => {
  const sbChain = { insert: () => sbChain, select: () => sbChain, eq: () => sbChain, update: () => sbChain, single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }), order: () => sbChain, limit: () => sbChain, then: (f) => Promise.resolve({}).then(f) };
  const sb = { from: () => sbChain, functions: { invoke: async () => ({ data: null }) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} } };
  const App = { sb, callClaude: async () => ({ text: '' }), callClaudeSonnet: async () => ({ text: '' }), callClaudeWithContinuation: async () => '', escapeHtml: (s) => String(s == null ? '' : s), showToast() {}, showScreen() {}, showProgress() {}, clearProgress() {}, updateModelToggle() {}, updateProviderLabel() {}, ensureApiKey() { return true; }, getModelConfig: () => ({ label: 'Opus' }), currentUser: { id: 'u1' }, setButtonLoading() {} };
  const elStub = () => ({ value: '4', style: {}, dataset: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, innerHTML: '' });
  sandbox = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, Map, Set, Promise, Boolean, Symbol, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
    mermaid: { initialize() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: elStub, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {} }), addEventListener() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    App, showToast() {}, escapeHtml: (s) => String(s == null ? '' : s), setButtonLoading() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    currentProjectId: '',
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.window.ReviewUI = { isEnabled: () => false };
  vm.createContext(sandbox);
  vm.runInContext(PATENT_SRC, sandbox, { filename: 'patent.js' });
});

const run = (expr) => vm.runInContext(expr, sandbox, { filename: 't.js' });
const checks = (spec, name) => JSON.parse(run('JSON.stringify(validateSpecification(' + JSON.stringify(spec) + ').filter(function(i){return i.check===' + JSON.stringify(name) + ';}))'));

// ─────────── N1a — CHK-0 placeholder_residue (CRITICAL) ───────────

test('★ N1a — 본문 중간 센티넬 마커 에코(docC형) → CRITICAL 검출', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n서버는 정책 가드부(1242) 및 <<<DEVICE_DESC>>> 동적 후보 갱신부(1243)를 포함한다.';
  const iss = checks(spec, 'placeholder_residue');
  assert.equal(iss.length, 1, '★ 1건');
  assert.equal(iss[0].severity, 'CRITICAL', '★ CRITICAL(다운로드 게이트 자동 포함)');
  assert.ok(/<<<DEVICE_DESC>>>/.test(iss[0].detail), '★ 잔존 토큰 지목');
});
test('★ N1a — {{템플릿}}·맨 END_ 토큰도 검출', () => {
  assert.equal(checks('【발명을 실시하기 위한 구체적인 내용】\n장치는 {{component_name}}을 포함한다.', 'placeholder_residue').length, 1, '★ {{...}}');
  assert.equal(checks('【발명을 실시하기 위한 구체적인 내용】\n처리부는 동작한다. END_DEVICE_DESC 저장부는 저장한다.', 'placeholder_residue').length, 1, '★ 맨 END_ 계열');
});
test('★ N1a 회귀 — 클린 본문·수학식 중괄호는 오탐 0', () => {
  assert.equal(checks('【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 처리하고 통신부(110)는 전송한다.', 'placeholder_residue').length, 0, '★ 클린 0');
  assert.equal(checks('【발명을 실시하기 위한 구체적인 내용】\n제어부(100)는 처리한다.\n\n【수학식 1】\nW = x_{{k}} + 1\n여기서 x는 입력이다.', 'placeholder_residue').length, 0, '★ 수학식 블록 제외 소스(중괄호 수식 엣지)');
});
test('★ N1a — 다운로드 게이트 결합: placeholder_residue CRITICAL → confirm 취소 시 차단', () => {
  const spec = '【발명을 실시하기 위한 구체적인 내용】\n서버는 <<<METHOD_DESC>>> 처리부(100)를 포함한다.';
  run('confirm=function(){return false;}');
  assert.equal(run('_downloadGate(' + JSON.stringify(spec) + ')'), false, '★ 게이트 차단(§6-2 CRITICAL 대상 자동 포함)');
  run('confirm=function(){return true;}');
});

// ─────────── N1b — 파서 위생(추출 내용 내부 마커 제거) ───────────

const BUNDLE_ECHO = '<<<REFTABLE>>>\n[장치부호]\n(100) 제어부\n(110) 통신부\n<<<END_REFTABLE>>>\n<<<DEVICE_DESC>>>\n도 1을 참조하면, 제어부(100)는 정책을 관리하고 <<<DEVICE_DESC>>> 통신부(110)는 데이터를 전송한다.\n<<<END_DEVICE_DESC>>>\n<<<METHOD_DESC>>>\n이하 방법을 설명한다. 데이터를 수신하는 단계(S410)를 포함한다.\n<<<END_METHOD_DESC>>>';

test('★ N1b — 추출된 DEVICE_DESC 내부의 에코 마커 결정론 제거(잔존 0)', () => {
  const r = JSON.parse(run('JSON.stringify((function(){var r=parseCohesiveBundle(' + JSON.stringify(BUNDLE_ECHO) + ');return {device:r.device,method:r.method,refCount:r.refMap.size};})())'));
  assert.ok(!/<<</.test(r.device) && !/>>>/.test(r.device), '★ device 내 마커 0');
  assert.ok(/제어부\(100\)는 정책을 관리하고 통신부\(110\)/.test(r.device), '★ 토큰만 제거·내용 보존(공백 정돈)');
  assert.equal(r.refCount, 2, '★ REFTABLE 파싱 회귀 무변');
  assert.ok(/수신하는 단계\(S410\)/.test(r.method), '★ method 회귀 무변');
});
test('★ N1b 회귀 — 에코 없는 정상 응답은 내용 불변', () => {
  const clean = BUNDLE_ECHO.replace(' <<<DEVICE_DESC>>>', '');
  const r = JSON.parse(run('JSON.stringify(parseCohesiveBundle(' + JSON.stringify(clean) + ').device)'));
  assert.ok(/제어부\(100\)는 정책을 관리하고 통신부\(110\)는 데이터를 전송한다\./.test(r), '★ 정상 경로 무변');
});
test('★ N1b — 맨 END_ 토큰은 파서가 제거하지 않음(정당 영문 보호 — CHK-0이 리포트)', () => {
  const b = BUNDLE_ECHO.replace(' <<<DEVICE_DESC>>>', ' END_TO_END');
  const r = JSON.parse(run('JSON.stringify(parseCohesiveBundle(' + JSON.stringify(b) + ').device)'));
  assert.ok(/END_TO_END/.test(r), '★ 자동 제거는 완전형 <<<…>>> 마커만(보수 원칙)');
});

// ─────────── N1c·N2·N3c — cohesion 프롬프트 계약 ───────────

test('★ N1c 소스 — 마커 경계-전용 가드(본문 문장 내 포함 금지·1회 등장)', () => {
  assert.match(PATENT_SRC, /구획 경계로만 쓰고, 본문 문장 안에 절대 포함하지 마라/, '★ 경계-전용 문구');
  assert.match(PATENT_SRC, /정확히 1회씩만 등장한다/, '★ 재등장 금지');
});
test('★ N2 소스 — 신규 구성 번호 규칙(기존 번호 재사용 금지 + REFTABLE 추가)', () => {
  assert.match(PATENT_SRC, /\[신규 구성 번호 규칙\]/, '★ 규칙 표제');
  assert.match(PATENT_SRC, /기존 번호를 절대 재사용하지 말고 어느 곳에도 쓰이지 않은 미사용 새 번호를 부여/, '★ 미사용 새 번호');
  assert.match(PATENT_SRC, /REFTABLE에도 반드시 추가하라/, '★ 표 추가 의무');
});
test('★ N3c 소스 — cohesion이 dlCfg를 단계별과 동일 소비(도면당 하한 + 총 하한 + extra)', () => {
  assert.match(PATENT_SRC, /\[배치6 N3c\] 분량을 단계별\(step_08\)과 동일한 dlCfg로 소비/, '★ dlCfg 미러 주석');
  assert.match(PATENT_SRC, /도면 1개당 \$\{dlCfg\.charPerFig\}\(공백 포함\) 이상을 최소 목표로 한다\(상한이 아니라 하한\)[\s\S]{0,400}총 분량 \$\{dlCfg\.total\}\(공백 포함\) 이상을 목표로[\s\S]{0,300}\$\{dlCfg\.extra\}[\s\S]{0,200}\$\{methodLengthPreset\}/, '★ unified C11이 하한 프레이밍(#235)으로 dlCfg 소비');
  assert.match(PATENT_SRC, /【수학식 금지】/, '★ C9 수식 금지 유지(통합 내 동시 생성 금지 — 새 삽입 경로 없음)');
});

// ─────────── N3a·N3b — 토글 UI + 체인 배선 ───────────

test('★ N3a — index.html 토글(기본 off)·분량 프리셋 노출 + 복원 동기화', () => {
  assert.match(HTML_SRC, /<input type="checkbox" id="chkUnifiedMath">/, '★ 수학식 토글(checked 속성 없음 = 기본 off)');
  assert.match(HTML_SRC, /id="selUnifiedDetail" onchange="detailLevel=this\.value"/, '★ 분량 프리셋 select(전역 연동)');
  assert.match(PATENT_SRC, /\[배치6 N3a\] 통합 카드 분량 표시 동기화/, '★ openProject 복원 시 select 동기화');
});
test('★ N3b 소스 — 토글 on 시에만 기존 step_09 파이프라인 호출(새 삽입 경로 없음)', () => {
  assert.match(PATENT_SRC, /const wantMath=!!\(typeof document!=='undefined'&&document\.getElementById\('chkUnifiedMath'\)\?\.checked\)/, '★ 토글 읽기');
  assert.match(PATENT_SRC, /const TOTAL=wantMath\?5:4;/, '★ 진행 단계 5/4 분기');
  assert.match(PATENT_SRC, /if\(wantMath\)\{\s*\n?\s*P\('\[5\/5\] 수학식 생성\(Step 9 파이프라인\)\.\.\.',4\);\s*\n?\s*try\{ await runStep\('step_09'\); \}/, '★ 가드된 runStep(step_09) — off면 미호출');
});
