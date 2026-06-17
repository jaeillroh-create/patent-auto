/**
 * review-engine/__tests__/mask-redaction-and-status.test.js
 * ① opinion_drafts status/opinion_type varchar→text 마이그레이션 기록(내용 검증)
 * ② sanitizeTemplate 마커-문장 제거(오염 0) — 도메인 주제어(소셜미디어 콘텐츠 등)를 마커 문장째 차단.
 *    ★ 접미사 마스킹으로 못 잡는 도메인 주제어를 원천 차단. 문체(마커 없는 문장)는 보존.
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion;

before(() => {
  const src = readFileSync(path.join(REPO, 'opinion/opinion.js'), 'utf8');
  const sb = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }), functions: { invoke: async () => ({ data: null }) } };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, structuredClone: globalThis.structuredClone,
    JSON, Math, Date, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, Map, Set, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setButtonLoading() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {} }) },
    showToast() {}, escapeHtml: (s) => String(s == null ? '' : s),
    sb, App: { sb, currentUser: { id: 'u1' } },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'opinion.js' });
  Opinion = sandbox.window.Opinion;
});

// 마커 문장(제5항 + 인용발명 1)에 도메인 주제어("소셜미디어 콘텐츠")가 들어있고,
// 마커 없는 문장(서두·결어)에 문체가 들어있는 실제형 양식.
const TPL = '의견제출통지서를 수령하였기에 검토 의견을 제출합니다.\n'
  + '제5항의 소셜미디어 콘텐츠 추천 모듈은 인용발명 1의 건강 컨셉 식자재 추천과 명백히 구별됩니다.\n'
  + '따라서 진보성이 인정되어야 할 것으로 사료됩니다.';

test('★② 마커 문장 제거 — 도메인 주제어(소셜미디어 콘텐츠/식자재) 원천 차단', () => {
  const s = Opinion.sanitizeTemplate(TPL, 'inventive_step').sanitized;
  assert.ok(s.includes('[사건특유 문장 생략]'), '마커 문장이 생략 표시로 대체');
  assert.ok(!s.includes('소셜미디어 콘텐츠'), '★ 도메인 주제어 누출 0(마커 문장째 제거)');
  assert.ok(!s.includes('식자재'), '★ 식자재 누출 0');
  assert.ok(!s.includes('컨셉'), '★ 컨셉 누출 0');
  assert.ok(!s.includes('제5항'), '마커(제5항) 제거');
});

test('★ 문체(마커 없는 문장)는 보존', () => {
  const s = Opinion.sanitizeTemplate(TPL, 'inventive_step').sanitized;
  assert.ok(s.includes('수령하였기에'), '서두 어투 보존');
  assert.ok(s.includes('사료됩니다'), '종결어미 보존');
  assert.ok(s.includes('따라서'), '연결어 보존');
});

test('forbiddenSpans — 마커 span 추출 유지(생성후 오염검사 토대)', () => {
  const r = Opinion.sanitizeTemplate(TPL, 'inventive_step');
  assert.ok(r.forbiddenSpans.length >= 1, '제N항+인용 포함 span 추출');
});

test('★ getActiveTemplate — 마커 문장 제거 적용(state.templates 경유)', () => {
  Opinion.state = Object.assign(Opinion.state || {}, { templates: { inventive_step: { text: TPL } }, _templateForbiddenSpans: [] });
  const out = Opinion.getActiveTemplate('inventive_step');
  assert.ok(!out.includes('소셜미디어 콘텐츠') && out.includes('[사건특유 문장 생략]'), '도메인 주제어 차단');
  assert.ok(out.includes('사료됩니다'), '문체 보존');
});

test('마커 없는 일반 양식은 그대로(생략 없음)', () => {
  const plain = '의견제출통지서를 수령하였기에 검토 의견을 제출합니다.\n따라서 진보성이 인정되어야 할 것으로 사료됩니다.';
  const s = Opinion.sanitizeTemplate(plain, 'inventive_step').sanitized;
  assert.ok(!s.includes('[사건특유 문장 생략]'), '마커 없으면 생략 0');
  assert.ok(s.includes('수령하였기에') && s.includes('사료됩니다'), '전문 보존');
});

test('① 마이그레이션 — status/opinion_type varchar→text, idempotent (source)', () => {
  const sql = readFileSync(path.join(REPO, 'supabase/migrations/20260617_opinion_drafts_status_text.sql'), 'utf8');
  assert.match(sql, /ALTER COLUMN status TYPE text/, 'status → text');
  assert.match(sql, /ALTER COLUMN opinion_type TYPE text/, 'opinion_type → text');
  assert.match(sql, /data_type='character varying'/, '★ idempotent 가드(현재 varchar 일 때만 ALTER)');
  assert.match(sql, /contamination_blocked|22001/, '배경(21자 초과) 주석');
});
