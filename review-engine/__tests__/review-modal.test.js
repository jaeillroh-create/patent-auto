/**
 * review-engine/__tests__/review-modal.test.js
 * (2a) 검증 결과 공유 모달 — opinion·patent 공유 컴포넌트(opinion-review-panel.js).
 *
 * openModal/closeModal 의 DOM 동작 + 모달 스코프 CSS(.review-modal-body .review-panel max-height:none) +
 * index.html 공유 모달(.modal-overlay/.modal-content 재사용) + 양 모듈 배선(소스) 검증.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openModal, closeModal, renderHTML } from '../ui/opinion-review-panel.js';
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';
import { readPatentBundle } from './helpers/patentBundle.js';
import { readModuleBundle } from './helpers/sourceBundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

// 유효 ReviewState(adaptSnapshot) — renderHTML/buildViewModel 가 처리 가능.
const STATE = OpinionProfile.adaptSnapshot(
  { caseId: 'C1', parsed: { application_no: '10-1', claims: [{ no: 1, text: '복수의 셀과 제어부.' }], cited_references: [], rejection_reasons: [{ article: '§42④', claim_nos: [1] }] }, draftResult: { amended_claims: [] }, refText: '명세서' },
  null, { terminationPolicy: OpinionProfile.terminationPolicy }
);

// 최소 DOM 스텁 — openModal 이 쓰는 reviewResultModal/reviewModalMount + render() 의존 요소.
function stubDom() {
  const overlay = { id: 'reviewResultModal', style: {} };
  const mount = { id: 'reviewModalMount', innerHTML: '', className: 'review-modal-body', querySelectorAll: () => [] };
  const reg = { reviewResultModal: overlay, reviewModalMount: mount };
  const doc = {
    getElementById: (id) => reg[id] || null,    // STYLE_ID 등 미등록 → null(스타일 주입 진행)
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild: () => {} },
  };
  mount.ownerDocument = doc;
  overlay.ownerDocument = doc;
  return { doc, overlay, mount };
}

test('★ openModal: 모달 바디에 렌더 + 오버레이 display:flex (좁은 컬럼 탈출)', () => {
  const { doc, overlay, mount } = stubDom();
  const orig = globalThis.document; globalThis.document = doc;
  try {
    openModal(STATE, { actor: 'u@x.com' });
  } finally { globalThis.document = orig; }
  assert.equal(overlay.style.display, 'flex', '오버레이 열림');
  assert.ok(mount.innerHTML.includes('review-panel'), '모달 바디에 패널 렌더(단일 스크롤 영역)');
});

test('★ closeModal: 오버레이 display:none (세션 내 상태는 유지 — 재오픈 가능)', () => {
  const { doc, overlay } = stubDom();
  overlay.style.display = 'flex';
  const orig = globalThis.document; globalThis.document = doc;
  try { closeModal(); } finally { globalThis.document = orig; }
  assert.equal(overlay.style.display, 'none', '오버레이 닫힘');
});

test('openModal 폴백: 모달 DOM 없으면 fallbackMount 로 인라인 렌더(후방호환)', () => {
  const fb = { innerHTML: '', querySelectorAll: () => [], ownerDocument: null };
  const doc = { getElementById: () => null, createElement: () => ({ id: '', textContent: '' }), head: { appendChild: () => {} } };
  fb.ownerDocument = doc;
  const orig = globalThis.document; globalThis.document = doc;
  try { openModal(STATE, { fallbackMount: fb }); } finally { globalThis.document = orig; }
  assert.ok(fb.innerHTML.includes('review-panel'), '모달 없으면 폴백 마운트에 렌더');
});

test('★ 모달 스코프 CSS: .review-modal-body .review-panel max-height:none (중첩 이중스크롤 제거)', () => {
  // injectStylesOnce 가 주입하는 CSS 캡처
  let css = '';
  const doc = { getElementById: () => null, createElement: () => ({ id: '', set textContent(v){ css = v; }, get textContent(){ return css; } }), head: { appendChild: () => {} } };
  const el = { ownerDocument: doc, innerHTML: '', querySelectorAll: () => [] };
  const orig = globalThis.document; globalThis.document = doc;
  try { openModal(STATE, { fallbackMount: el }); } finally { globalThis.document = orig; }
  assert.ok(/\.review-modal-body\s+\.review-panel\{[^}]*max-height:\s*none/.test(css), '모달 맥락서 패널 캡 해제');
});

test('index.html 공유 모달 — .modal-overlay/.modal-content 재사용 + 마운트 id', () => {
  const html = readFileSync(path.join(REPO, 'index.html'), 'utf8');
  assert.ok(/id="reviewResultModal"[^>]*class="modal-overlay"/.test(html), '#reviewResultModal = .modal-overlay 재사용');
  assert.ok(html.includes('class="modal-content"') && html.includes('id="reviewModalMount"'), '.modal-content + #reviewModalMount');
  assert.ok(/id="reviewModalMount"[^>]*class="review-modal-body"/.test(html), '바디가 단일 스크롤(review-modal-body, overflow-y:auto)');
  assert.ok(html.includes('ReviewUI.closeModal()'), '닫기 버튼 배선');
});

test('★ opinion·patent 동시 — 둘 다 openModal 로 배선(공유 모달 한 곳)', () => {
  const op = readModuleBundle(REPO, 'opinion');
  const pt = readPatentBundle(REPO);
  assert.ok(op.includes('ReviewUI.openModal') && op.includes('Opinion.openReviewModal'), 'opinion 자동오픈+재오픈');
  assert.ok(pt.includes('ReviewUI.openModal') && pt.includes('Patent.openReviewModal'), 'patent 자동오픈+재오픈');
  // 좌측 카드는 재오픈 버튼만(인라인 패널 마운트 제거)
  assert.ok(op.includes('검증 결과 보기'), 'opinion 카드 재오픈 버튼');
  assert.ok(pt.includes('검증 결과 보기'), 'patent 카드 재오픈 버튼');
});

test('다른 모듈 불변 — division/trademark CSS 에 review-modal 미참조', () => {
  const dv = readFileSync(path.join(REPO, 'division/division.css'), 'utf8');
  const tm = readFileSync(path.join(REPO, 'trademark/trademark.css'), 'utf8');
  assert.ok(!dv.includes('review-modal') && !tm.includes('review-modal'), '타 모듈 CSS 무관');
});
