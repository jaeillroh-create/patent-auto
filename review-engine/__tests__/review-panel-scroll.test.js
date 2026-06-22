/**
 * review-engine/__tests__/review-panel-scroll.test.js
 * (A) 검증 패널 자체 스크롤 — opinion/patent 공유 컴포넌트(opinion-review-panel.js).
 *
 * render() 초입의 injectStylesOnce 가 주입하는 CSS 를 스텁 doc 으로 캡처해 검증:
 * .review-panel 이 max-height+overflow-y(자체 스크롤) + overscroll-behavior(부모 경합 차단)를 갖는지,
 * 추가 셀렉터가 전부 review- 접두(충돌 0)인지.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { render } from '../ui/opinion-review-panel.js';

// render() 는 injectStylesOnce(doc) 를 el.innerHTML 전에 호출 → 스텁으로 주입 CSS 캡처.
function captureInjectedCss() {
  const injected = [];
  const doc = {
    getElementById: () => null,            // 미주입 상태 → 주입 진행
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild: (node) => injected.push(node) },
  };
  const el = { ownerDocument: doc, set innerHTML(_v) {}, get innerHTML() { return ''; }, querySelectorAll: () => [] };
  try { render({}, el, {}); } catch (_e) { /* buildViewModel 은 실패해도 무방 — 주입은 그 전에 끝남 */ }
  return (injected[0] && injected[0].textContent) || '';
}

const css = captureInjectedCss();
// .review-panel 규칙만 추출
const panelRule = (css.match(/\.review-panel\{[^}]*\}/) || [''])[0];

test('주입 CSS 캡처됨 + .review-panel 규칙 존재', () => {
  assert.ok(css.length > 0, '스타일 주입됨');
  assert.ok(panelRule.length > 0, '.review-panel 규칙 존재');
});

test('★ .review-panel 자체 스크롤: max-height + overflow-y:auto', () => {
  assert.ok(/max-height:\s*70vh/.test(panelRule), 'max-height:70vh');
  assert.ok(/overflow-y:\s*auto/.test(panelRule), 'overflow-y:auto (짧은 결과면 스크롤바 미생성)');
  assert.ok(!/overflow-y:\s*scroll/.test(panelRule), 'scroll 강제 아님(auto)');
});

test('★ overscroll-behavior:contain — sticky 부모와 스크롤 경합 차단', () => {
  assert.ok(/overscroll-behavior:\s*contain/.test(panelRule), 'overscroll-behavior:contain');
});

test('★ 추가 셀렉터 전부 review- 접두(충돌 0)', () => {
  // 이번에 추가한 스크롤바 셀렉터
  assert.ok(css.includes('.review-panel::-webkit-scrollbar'), '스크롤바 셀렉터 review- 접두');
  // max-height:70vh 는 .review-panel 규칙 안에서만 등장(다른 전역 셀렉터에 안 샘)
  const idx = css.indexOf('max-height:70vh');
  const before = css.slice(Math.max(0, idx - 200), idx);
  assert.ok(before.lastIndexOf('.review-panel') > before.lastIndexOf('}') , 'max-height 가 .review-panel 규칙 내부');
});

test('공유 컴포넌트 — opinion·patent 동시 적용(둘 다 window.ReviewUI.render 사용)', async () => {
  // 동일 render 가 양 모듈 마운트에 쓰임을 소스로 확인(별도 패널 없음).
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
  const op = readFileSync(path.join(root, 'opinion/opinion.js'), 'utf8');
  const pt = readFileSync(path.join(root, 'patent/patent.js'), 'utf8');
  assert.ok(op.includes('ReviewUI.openModal'), 'opinion 이 공유 모달 사용');
  assert.ok(pt.includes('ReviewUI.openModal'), 'patent 이 공유 모달 사용 → 한 곳 수정으로 동시 해결');
});
