/**
 * review-engine/__tests__/template-style-injection.test.js
 * 의견서 템플릿 문체 전달 수정 — ★1 마스킹 전문 + ★4 기술명사 마스킹 + ★2 styleGuide + B-1.
 * 오염(내용 누출) 방어 우선: 기술용어·수치·식별자·구성명사 마스킹, 문체(어투·종결어미)는 보존.
 * ★ 마스킹 충분성은 코드로 완전 검증 불가 — 실 생성물은 변리사 확인 필요(PR 명시).
 */
import { test, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
let Opinion;

before(() => {
  const src = readModuleBundle(REPO, 'opinion');
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

// 마커(제N항·인용발명N 등)가 없는 문장 — ②(마커 문장 제거) 후에도 마스킹이 적용되는 케이스.
const SAMPLE = '본원발명의 제어부는 120℃에서 TF-IDF 방식으로 동작하는 구성으로서 명백히 구별되는 것으로 사료됩니다.';

test('★1 sanitizeTemplate — 조각이 아니라 마스킹 전문 반환(헤더+본문)', () => {
  const r = Opinion.sanitizeTemplate(SAMPLE, 'inventive_step');
  assert.ok(r && typeof r.sanitized === 'string', '{sanitized} 반환');
  assert.ok(r.sanitized.includes('마스킹됨'), '마스킹 전문 헤더');
  assert.ok(r.sanitized.includes('명백히 구별되는 것으로 사료됩니다'), '★ 양식 전문(문장)이 들어감 — 조각 아님');
  assert.ok(Array.isArray(r.forbiddenSpans), 'forbiddenSpans 배열 유지');
});

test('★4 기술명사·수치·영문·식별자 마스킹 (오염 차단)', () => {
  const s = Opinion.sanitizeTemplate(SAMPLE, 'inventive_step').sanitized;
  assert.ok(s.includes('[구성*]'), '제어부 → [구성*]');
  assert.ok(s.includes('[수치*]'), '120℃ → [수치*]');
  assert.ok(s.includes('[기술*]'), 'TF-IDF → [기술*]');
  // ★ 실제 기술내용은 사라져야 함 (마커 없는 문장의 기술명사 마스킹)
  assert.ok(!s.includes('제어부'), '제어부 누출 0');
  assert.ok(!s.includes('120'), '수치 120 누출 0');
  assert.ok(!s.includes('TF-IDF'), '영문 약어 누출 0');
});

test('★ 문체(어투·종결어미·연결어·강조)는 보존', () => {
  const s = Opinion.sanitizeTemplate('본원발명은 명백히 구별되는바, 따라서 진보성이 인정되어야 할 것으로 사료됩니다.', 'inventive_step').sanitized;
  assert.ok(s.includes('사료됩니다'), '종결어미 보존');
  assert.ok(s.includes('따라서'), '연결어 보존');
  assert.ok(s.includes('명백히'), '강조어구 보존');
  assert.ok(s.includes('본원발명'), '본원 명칭(문체) 보존');
});

test('forbiddenSpans — 사건 특유 문구 추출 유지(오염검사 토대)', () => {
  const tpl = '의견서.\n제5항의 무선 모듈은 인용발명 1에 전혀 개시되어 있지 아니한 신규 사항입니다.\n이상.';
  const r = Opinion.sanitizeTemplate(tpl, 'inventive_step');
  assert.ok(r.forbiddenSpans.length >= 1, '제N항+인용 포함 사건특유 span 추출');
  assert.ok(r.forbiddenSpans.some(function (x) { return x.indexOf('제5항') >= 0 || x.indexOf('무선') >= 0; }), 'span 내용 확인');
});

test('★ getActiveTemplate — 마스킹 전문 반환(state.templates 경유)', () => {
  Opinion.state = Object.assign(Opinion.state || {}, { templates: { inventive_step: { text: SAMPLE } }, _templateForbiddenSpans: [] });
  const out = Opinion.getActiveTemplate('inventive_step');
  assert.ok(out.includes('마스킹됨') && out.includes('[구성*]') && out.includes('[수치*]'), '마스킹 전문');
  assert.ok(out.includes('사료됩니다'), '문체 보존');
  assert.ok(!out.includes('제어부') && !out.includes('TF-IDF'), '기술내용 누출 0');
});

test('★2 styleGuide 강화 — 마스킹 인지 + 내용·구조 차용 금지 (source)', () => {
  const src = readModuleBundle(REPO, 'opinion');
  assert.match(src, /\[\*\] 마스킹 부분·기술내용·논증은 절대 차용하지 마라/, '마스킹 차용 금지');
  assert.match(src, /내용·구조 차용 절대 금지/, '내용·구조 차용 금지 강화');
  assert.match(src, /섹션 구조\(순서·제목\)는 양식이 아니라 아래 본문 지시의 ## 섹션/, '구조는 tpl 섹션');
});

test('★ tpl[t] 구조 강제 유지 — 엔진 섹션 불변 (source, 사용자 의도 구조는 엔진)', () => {
  const src = readModuleBundle(REPO, 'opinion');
  assert.match(src, /## 서두/, 'tpl 섹션 ## 서두 유지');
  assert.match(src, /## 1\. 보정내용/, 'tpl 섹션 ## 1. 보정내용 유지');
  assert.match(src, /아래 섹션 구분자\(## 제목\)를 반드시 사용/, 'tpl 구조 강제 문구 유지');
});

test('B-1 유형 불일치 플래그 — 사건 유형에 양식 없으면 _templateTypeMismatch (source)', () => {
  const src = readModuleBundle(REPO, 'opinion');
  assert.match(src, /_templateTypeMismatch/, '유형 불일치 플래그');
  assert.match(src, /양식 미적용 — 사건 유형/, '경고 메시지');
});
