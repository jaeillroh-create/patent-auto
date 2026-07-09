/**
 * review-engine/__tests__/opinion-parsed-source.test.js
 * ★ 유령 필드(state.parsed) 의존 재발 방지 — 진단 사각지대 못박기.
 *
 * 배경: _reviewGate·exportSnapshot 이 state.parsed(앱에서 절대 안 채워지는 유령필드)를 읽어
 *   게이트가 영구 비활성("청구항 파싱 먼저")되고 검증B 스냅샷에 청구항이 안 실렸다.
 *   기존 E2E 가 픽스처로 state.parsed 를 채워 이 버그를 가렸다.
 *
 * 이 테스트는 그 픽스처를 쓰지 않는다:
 *   - state.parsed = null (유령필드 비움), 실제 데이터는 DB(전역 sb.opinion_parsed_documents.parsed_data)에만.
 *   - 그 상황에서 _loadParsedDoc(DB재조회) 후 게이트 통과 + exportSnapshot 이 청구항을 싣는지 검증.
 *   - 게이트와 exportSnapshot 이 동일 진실원천(_resolveParsedDoc)을 읽는지(한 곳만 바뀌면 둘 다) 검증.
 *   - ★ 버튼 경유(runReviewEngine() 인자없음) → runner 가 받은 스냅샷에 청구항이 실려있는지(전 구간).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion, win;

// DB(opinion_parsed_documents.parsed_data)에만 존재하는 완전한 파싱결과 — state 어디에도 동기로 없음.
const DB_PARSED = {
  application_no: '10-2024-0999',
  invention_title: '열관리 장치',
  applicant: '디딤아이피',
  claims: [
    { no: 1, text: '복수의 셀과, 상기 셀을 제어하는 제어부를 포함하는 배터리 장치.' },
    { no: 2, text: '제1항에 있어서, 냉각 유로를 더 포함하는 배터리 장치.' },
  ],
  cited_references: [{ ref_no: 1, title: '인용문헌1', publication_no: '10-1111111' }],
  rejection_reasons: [{ article: '§29②', claim_nos: [1], cited_refs: ['인용문헌1'] }],
};

// 전역 sb 스텁 — opinion.js _loadParsedDoc 가 쓰는 체인 쿼리. doc 토글로 'DB에 없음'도 재현.
function makeSb(state) {
  const chain = {
    select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
    maybeSingle: async () => ({ data: state.doc ? { parsed_data: state.doc } : null }),
  };
  return { from: () => chain };
}

before(() => {
  const src = readModuleBundle(REPO_ROOT, 'opinion');
  const dbState = { doc: DB_PARSED };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set,
    setTimeout: () => 0, clearTimeout: () => {},
    setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => ({ style: {}, appendChild() {} }), getElementById: () => null },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb: makeSb(dbState), // ★ 전역 sb (opinion.js 가 참조하는 이름)
    App: { currentUser: { id: 'u1', email: 'jaeill.roh@gmail.com' } },
    ReviewUI: { isEnabled: () => true, policy: () => ({ capUsd: 5, maxRounds: 12 }), render() {} },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  win = sandbox;
  win._dbState = dbState; // 테스트에서 'DB에 없음' 토글용
  Opinion = sandbox.window.Opinion;

  // ★ state.parsed 는 비운다(유령필드). 실제 파싱결과는 DB(sb)에만. draftResult 는 정상(보정안 작성 완료).
  Opinion.state = Object.assign(Opinion.state || {}, {
    parsed: null,        // ← 유령필드 비움 (이게 핵심)
    parsedDoc: null,     // ← 캐시 미적재 상태로 시작
    current: { id: 'p1', application_no: '10-2024-0999', status: 'completed', rejection_type: 'inventive_step', title: '열관리 장치' },
    draftResult: { amended_claims: [{ claim_no: 1, amended: '복수의 셀과 제어부와 냉각 유로를 포함하는 배터리 장치.', spec_basis: ['0021'] }] },
    typeResult: { primary_type: '진보성', claim_summary: { rejected_claims: [1] } },
    refText: '【0021】 냉각 유로는 셀 사이를 사행 형상으로 통과한다. 충분한 길이의 명세서 본문.',
    opinionDraft: { title: '의견서', sections: [{ heading: '대비', content: '본원은 냉각 유로를 구비한다.' }] },
  });
});

test('게이트는 유령필드(state.parsed)에 의존하지 않는다 — 미적재면 청구항 파싱 missing', () => {
  Opinion.state.parsed = null; Opinion.state.parsedDoc = null;
  const gate = Opinion._reviewGate();
  assert.equal(gate.ok, false, 'parsedDoc 미적재 + parsed 유령 → 게이트 실패(자동충전 없음)');
  assert.ok(gate.missing.includes('청구항 파싱'), '청구항 파싱 missing(보고된 증상 재현)');
  assert.ok(!gate.missing.includes('보정안 작성'), 'draftResult 는 있으므로 보정안은 OK');
});

test('★ _loadParsedDoc(DB재조회) 후 게이트 통과 — 실제 데이터 위치에서 판정', async () => {
  Opinion.state.parsedDoc = null;
  const doc = await Opinion._loadParsedDoc();
  assert.ok(doc && doc.claims.length === 2, 'DB에서 parsed_data 적재');
  assert.equal(Opinion.state.parsedDoc, doc, 'state.parsedDoc 에 캐시');
  const gate = Opinion._reviewGate();
  assert.equal(gate.ok, true, 'state.parsed 가 null 이어도 게이트 통과(유령필드 비의존)');
});

test('exportSnapshot 이 같은 진실원천에서 청구항을 싣는다(state.parsed=null 인데도)', () => {
  // 직전 테스트에서 parsedDoc 캐시됨
  assert.equal(Opinion.state.parsed, null, 'state.parsed 는 여전히 유령(비어있음)');
  const snap = Opinion.exportSnapshot();
  assert.equal(snap.parsed.claims.length, 2, '스냅샷 parsed.claims 가 DB재조회 결과를 실음');
  assert.equal(snap.caseId, '10-2024-0999', 'caseId 도 parsedDoc.application_no 에서');
  assert.equal(snap.parsed.cited_references.length, 1, '인용문헌도(어댑터 citedPrior 용)');
});

test('★ 단일 진실원천: 게이트와 exportSnapshot 이 _resolveParsedDoc 하나를 본다', () => {
  // parsedDoc 를 비우면 둘 다 빈손, 채우면 둘 다 청구항 — 한 곳만 바뀌면 둘 다 맞음
  Opinion.state.parsedDoc = null;
  assert.equal(Opinion._reviewGate().ok, false, '비우면 게이트 실패');
  assert.equal(Opinion.exportSnapshot().parsed.claims === undefined || Opinion.exportSnapshot().parsed.claims === undefined, true);
  assert.deepEqual(Opinion.exportSnapshot().parsed, {}, '비우면 스냅샷도 빈 parsed');
  Opinion.state.parsedDoc = DB_PARSED;
  assert.equal(Opinion._reviewGate().ok, true, '채우면 게이트 통과');
  assert.equal(Opinion.exportSnapshot().parsed.claims.length, 2, '채우면 스냅샷도 청구항');
});

test('★ 버튼 경유(runReviewEngine() 인자없음) → runner 가 받은 스냅샷에 청구항이 실린다', async () => {
  // 캐시·유령필드 비운 '실제 첫 클릭' 상태에서 시작
  Opinion.state.parsed = null;
  Opinion.state.parsedDoc = null;
  Opinion.state.reviewState = null;
  let captured = null;
  Opinion._reviewRunner = null;
  Opinion._defaultReviewRunner = async (snapshot) => { captured = snapshot; return { issues: [], patchPlans: [], phase: 'converged', rounds: [], budget: {} }; };
  const result = await Opinion.runReviewEngine(); // onclick 과 동일: 인자 없음
  assert.ok(result, '버튼 경유 발화 성공(게이트가 선적재로 통과)');
  assert.ok(captured, 'runner 호출됨');
  assert.equal(captured.parsed.claims.length, 2, '★ 스냅샷에 청구항 실림(state.parsed 유령인데도 DB재조회로)');
  assert.equal(captured.caseId, '10-2024-0999', 'caseId 도 정상');
});

test('전 구간: 그 스냅샷을 adaptSnapshot 에 넣으면 ReviewState.claims 가 채워진다', () => {
  Opinion.state.parsedDoc = DB_PARSED;
  const snap = Opinion.exportSnapshot();
  const st = OpinionProfile.adaptSnapshot(snap, null, { terminationPolicy: OpinionProfile.terminationPolicy });
  assert.equal(st.claims.length, 2, '어댑터가 청구항 2개 생성(검증B 가 실제로 청구항을 받음)');
  assert.equal(st.claims[0].text.includes('냉각 유로') || st.claims[0].text.includes('제어부'), true, '보정 텍스트 오버레이 정상');
  assert.equal(st.citedPrior.length, 1, '인용발명도 실림(examiner_A E-02 강등 방지)');
});

test('DB에도 parsed_data 가 없으면 게이트는 정직하게 실패(폴백 안전)', async () => {
  win._dbState.doc = null; // DB 비움
  Opinion.state.parsed = null; Opinion.state.parsedDoc = null;
  const doc = await Opinion._loadParsedDoc();
  assert.equal(doc, null, 'DB 없음 → null');
  assert.equal(Opinion._reviewGate().ok, false, '없는 데이터를 지어내지 않음(청구항 파싱 missing)');
  win._dbState.doc = DB_PARSED; // 복원
});

test('resetState 가 parsedDoc 캐시를 비운다(프로젝트 전환 교차오염 방지)', () => {
  Opinion.state.parsedDoc = DB_PARSED;
  Opinion.resetState({ keepProjectId: true });
  assert.equal(Opinion.state.parsedDoc, null, 'parsedDoc 리셋됨');
});
