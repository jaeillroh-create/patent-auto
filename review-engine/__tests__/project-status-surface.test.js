/**
 * review-engine/__tests__/project-status-surface.test.js
 *
 * 의견서 "작성 중" 무증상 멈춤 수정 — opinion_projects.status 2차 관문.
 *   ① DB 마이그레이션(20260617_opinion_projects_status.sql): status varchar→text + CHECK 전수 재정의.
 *      ★ 코드(Opinion.STATUS 맵)가 쓰는 status 전부를 CHECK 가 수용해야 함(빠지면 setStatus 거부 → 또 멈춤).
 *      → 소스에서 STATUS 키를 추출해 SQL 과 대조하는 drift 가드 포함.
 *   ② setStatus 실패 표면화: startOpinionDraft 최종 전환에서 setStatus('opinion_drafted')가
 *      {ok:false}(조용한 거부)면 db 에러로 승격 → state.draftError(kind:'db') 설정 + 로딩 해제(에러 카드).
 *      정상({ok:true})이면 draftError 없이 status 가 'opinion_drafted' 로 진행.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const SRC = readModuleBundle(REPO, 'opinion');
const SQL = readFileSync(path.join(REPO, 'supabase/migrations/20260617_opinion_projects_status.sql'), 'utf8');

// 권위 목록: opinion.js Opinion.STATUS 맵(코드가 setStatus 로 쓰는 status 전부의 출처).
const EXPECTED_STATUSES = [
  'created', 'parsing', 'parsed', 'parse_failed', 'type_determined',
  'analyzing', 'analyzed', 'strategy_confirmed', 'deficiency_analyzed',
  'correction_confirmed', 'allowable_identified', 'merge_confirmed',
  'drafting_claims', 'claims_drafted', 'drafting_corrections', 'corrections_drafted',
  'drafting_merge', 'merge_drafted', 'validating', 'validated',
  'correction_validated', 'merge_validated',
  'claims_confirmed', 'drafting_opinion', 'opinion_drafted',
  'approved', 'generating_docs', 'completed'
];

// opinion.js 소스의 Opinion.STATUS 블록에서 실제 status 키를 추출(코드↔SQL drift 가드용).
function extractStatusKeysFromSource(src) {
  var m = src.match(/Opinion\.STATUS\s*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(m, 'Opinion.STATUS 블록 추출');
  var keys = [];
  var re = /([a-z_]+)\s*:\s*\{\s*label:/g, mm;
  while ((mm = re.exec(m[1])) !== null) keys.push(mm[1]);
  return keys;
}

// ───────────────────────────── ① 마이그레이션 내용 검증 ─────────────────────────────

test('① 마이그레이션 — status varchar→text 확장(idempotent 가드)', () => {
  assert.match(SQL, /ALTER TABLE public\.opinion_projects ALTER COLUMN status TYPE text/, 'status → text');
  assert.match(SQL, /column_name='status' AND data_type='character varying'/, '★ idempotent 가드(현재 varchar 일 때만 ALTER)');
});

test('① 마이그레이션 — 기존 CHECK 동적 조회 후 drop + 재생성', () => {
  assert.match(SQL, /FROM pg_constraint/, '제약명 동적 조회');
  assert.match(SQL, /DROP CONSTRAINT/, '기존 CHECK drop');
  assert.match(SQL, /ADD CONSTRAINT opinion_projects_status_check\s*\n?\s*CHECK \(status IN/, 'status CHECK 재생성');
});

test('★① 마이그레이션 CHECK — 코드가 쓰는 status 28개 전수 포함(빠지면 또 멈춤)', () => {
  // CHECK (status IN (...)) 안의 따옴표 리터럴만 추출
  var checkBlock = SQL.match(/CHECK \(status IN \(([\s\S]*?)\)\s*\);/);
  assert.ok(checkBlock, 'CHECK IN 블록 추출');
  var inList = checkBlock[1];
  EXPECTED_STATUSES.forEach(function (s) {
    assert.ok(new RegExp("'" + s + "'").test(inList), 'CHECK 에 status 포함: ' + s);
  });
});

test('★① drift 가드 — 소스 Opinion.STATUS 의 모든 키가 SQL CHECK 에 존재(코드 추가 시 누락 차단)', () => {
  var srcKeys = extractStatusKeysFromSource(SRC);
  assert.ok(srcKeys.length >= 28, '소스에서 28개 이상 status 추출(실제: ' + srcKeys.length + ')');
  var checkBlock = SQL.match(/CHECK \(status IN \(([\s\S]*?)\)\s*\);/)[1];
  srcKeys.forEach(function (k) {
    assert.ok(new RegExp("'" + k + "'").test(checkBlock), '소스 status "' + k + '" 가 SQL CHECK 에 누락됨(추가 시 마이그레이션 갱신 필요)');
  });
  // 역방향: 하드코딩 기대목록과 소스가 일치(목록 노후화 방지)
  EXPECTED_STATUSES.forEach(function (s) {
    assert.ok(srcKeys.indexOf(s) >= 0, '기대 status "' + s + '" 가 소스 Opinion.STATUS 에 존재');
  });
});

// ───────────────────────────── ② setStatus 실패 표면화 동작 검증 ─────────────────────────────

function loadOpinion() {
  // insert().select() 가 {error:null} 로 resolve 되는 sb 스텁 + 기존 select 체인 유지
  const selectChain = { eq: () => selectChain, order: () => selectChain, limit: () => selectChain, maybeSingle: async () => ({ data: null }), then: undefined };
  const sb = {
    from: () => ({
      select: () => selectChain,
      insert: () => ({ select: async () => ({ data: [{}], error: null }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    functions: { invoke: async () => ({ data: null }) },
  };
  const App = { sb, currentUser: { id: 'u1' }, callClaude: null };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0; }, clearTimeout: () => {},
    requestAnimationFrame: (fn) => { fn(); return 0; },
    setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'opinion.js' });
  return { Opinion: sandbox.window.Opinion, App };
}

// callClaude 가 돌려줄 섹션형 마크다운(parseOpinionSections 가 sections 를 만들도록)
const SECTIONED = '## 서두\n상기 출원에 대한 의견제출통지서를 수령하였기에 의견을 제출합니다.\n\n'
  + '## 1. 보정내용\n청구항을 명세서 【0012】에 기재된 범위 내에서 보정하였습니다.\n\n'
  + '## 4. 결론\n이상과 같이 본원발명은 특허등록되어야 합니다.';

function setupDraft(Opinion, App, statusReturns) {
  Opinion.state = Opinion.state || {};
  Opinion.state.current = { id: 'proj-1', rejection_type: 'inventive_step', title: 'T', application_no: '10-2026-1' };
  Opinion.state.templates = null;
  Opinion._currentRun = null;
  Opinion.usage = { calls: 0 };
  Opinion.renderDetail = function () {};
  Opinion.updateUsageDisplay = function () {};
  Opinion.getContext = async function () { return '[컨텍스트]'; };
  App.callClaude = async function () { return { text: SECTIONED }; };
  // setStatus 스텁 — 호출 status 기록 + 지정한 반환값. p.status 도 동기화(정상 경로 검증용).
  Opinion._setStatusCalls = [];
  Opinion.setStatus = async function (id, s) {
    Opinion._setStatusCalls.push(s);
    var ret = statusReturns(s);
    if (ret.ok) { var p = Opinion.state.current; if (p && p.id === id) p.status = s; }
    return ret;
  };
}

test('★② setStatus 가 opinion_drafted 를 거부({ok:false}) → draftError(kind:db) 승격 + 로딩 해제', async () => {
  const { Opinion, App } = loadOpinion();
  // 'opinion_drafted' 만 거부, 나머지(drafting_opinion 등)는 통과
  setupDraft(Opinion, App, (s) => s === 'opinion_drafted' ? { ok: false, error: 'opinion_projects.status 거부' } : { ok: true });

  await Opinion.startOpinionDraft({ ignoreContaminationCheck: true });

  assert.ok(Opinion.state.draftError, '★ 무증상 멈춤 대신 draftError 설정됨');
  assert.strictEqual(Opinion.state.draftError.kind, 'db', '★ db 에러로 승격(에러 카드 표시 경로)');
  assert.match(Opinion.state.draftError.message, /opinion_drafted/, '메시지에 거부된 status 명시');
  assert.strictEqual(Opinion.state.drafting, false, '★ finally 가 로딩(스피너) 해제');
  assert.ok(Opinion._setStatusCalls.indexOf('opinion_drafted') >= 0, 'opinion_drafted 전환 시도함');
  // 롤백 setStatus('claims_confirmed') 도 호출되어 상태가 작성중에 묶이지 않음
  assert.ok(Opinion._setStatusCalls.indexOf('claims_confirmed') >= 0, '실패 시 claims_confirmed 로 롤백');
});

test('★② 정상({ok:true}) → draftError 없이 opinion_drafted 로 진행(7단계 열림)', async () => {
  const { Opinion, App } = loadOpinion();
  setupDraft(Opinion, App, () => ({ ok: true }));

  await Opinion.startOpinionDraft({ ignoreContaminationCheck: true });

  assert.strictEqual(Opinion.state.draftError, null, '★ 정상 경로 — 에러 없음');
  assert.strictEqual(Opinion.state.drafting, false, '로딩 해제');
  assert.strictEqual(Opinion.state.current.status, 'opinion_drafted', '★ status 가 opinion_drafted 로 진행(멈춤 해소)');
  assert.ok(Opinion.state.opinionDraft && Opinion.state.opinionDraft.sections.length >= 1, '본문(섹션) 저장됨');
});

test('② setStatus 자체는 불변 — {ok:true}/{ok:false} 반환 계약 유지(다른 호출처 영향 없음)', () => {
  // setStatus 는 try/catch 로 {ok:false} 를 반환(throw 안 함) — 본 수정이 setStatus 시그니처를 안 바꿨음을 소스로 확인
  assert.match(SRC, /Opinion\.setStatus\s*=\s*async function\(id,s\)\{/, 'setStatus 시그니처 유지');
  assert.match(SRC, /return \{ok:false, error:e\.message\|\|String\(e\)\};/, 'setStatus 는 여전히 {ok:false} 반환(표면화는 호출처에서)');
  assert.match(SRC, /var stRes = await Opinion\.setStatus\(p\.id,'opinion_drafted'\);/, '★ startOpinionDraft 에서만 결과 검사');
  assert.match(SRC, /if \(stRes && stRes\.ok === false\)/, '결과 {ok:false} 검사 분기');
});
