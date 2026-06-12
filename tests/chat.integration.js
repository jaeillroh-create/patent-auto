'use strict';
// ════════════════════════════════════════════════════════════════
// chat.js 브라우저 통합 글루 실행 검증 (DOM 스텁 + patent.js 전역 스텁)
// 실행: node tests/chat.integration.js
// send()가 단계별로 올바른 실행기로 라우팅되고, userCmd 주입/정리·후처리·
// 단계 독립을 지키는지 실제 코드를 호출하여 검증한다.
// ════════════════════════════════════════════════════════════════

// ── 최소 DOM 스텁 ──
const els = {};
function fakeEl(id) {
  if (els[id]) return els[id];
  return (els[id] = {
    id, value: '', disabled: false, innerHTML: '', scrollTop: 0, scrollHeight: 0, className: '',
    appendChild(c) { (this.children = this.children || []).push(c); return c; },
    insertAdjacentElement(_p, c) { this._sib = c; return c; },
    insertAdjacentHTML() {}, querySelector() { return null; }, replaceWith() {},
  });
}
global.window = global;
global.document = {
  getElementById: id => (id === 'pchat-css' ? (els['pchat-css'] || null) : fakeEl(id)),
  createElement: () => fakeEl('__n' + Math.random()),
  head: { appendChild() { els['pchat-css'] = fakeEl('pchat-css'); } },
};
global.App = { showToast() {}, escapeHtml: s => String(s || '') };

// ── patent.js 전역 스텁 ──
const calls = [];
function rec(name, arg) { calls.push({ name, arg }); }
global.outputs = { step_06: '【청구항 1】 A.', step_08: '도 1 ...', step_07: 'graph TD\nA-->B', step_04: '【특허문헌】 기존', step_03: '배경기술' };
global.globalProcessing = false;
global.chatHistory = {};
global.selectedTitle = '테스트 발명';
global.STEP_RUNNERS = {
  step_01: 'runStep', step_02: 'runStep', step_03: 'runStep', step_04: 'runStep', step_05: 'runStep',
  step_06: 'runStep', step_07: 'runDiagramStep', step_07c: 'runConceptDiagramStep', step_08: 'runLongStep', step_09: 'runMathInsertion',
  step_10: 'runStep', step_11: 'runDiagramStep', step_12: 'runLongStep', step_13: 'runStep',
  step_14: 'runStep', step_15: 'runStep', step_16: 'runStep', step_17: 'runStep', step_18: 'runStep', step_19: 'runStep', step_20: 'runStep',
};
global.SCOPE_GUARDED_TEXT_STEPS = ['step_06', 'step_10', 'step_20', 'step_08', 'step_12'];
global.SCOPE_GUARDED_MERMAID_STEPS = ['step_07_mermaid', 'step_11_mermaid'];
global.inventionScope = null; // scope 미잠금 → runScopeCheck 미호출
global.conceptDiagramTypes = [];

global._cascadeRunShort = async sid => rec('_cascadeRunShort', sid);
global._cascadeRunLong = async sid => rec('_cascadeRunLong', sid);
global._cascadeRunDiagram = async sid => rec('_cascadeRunDiagram', sid);
global._cascadeRunConceptDiagram = async () => rec('_cascadeRunConceptDiagram');
global._cascadeRender = (sid, t) => rec('_cascadeRender', sid);
global.setStepUserCommand = (sid, v) => rec('setStepUserCommand', sid + '=' + JSON.stringify(v));
global.invalidateDownstream = sid => rec('invalidateDownstream', sid);
global.onStepCompleted = sid => rec('onStepCompleted', sid);
global.saveProject = () => rec('saveProject');
global.markOutputTimestamp = sid => rec('markOutputTimestamp', sid);
global.setGlobalProcessing = on => { rec('setGlobalProcessing', on); global.globalProcessing = on; };
global.runScopeCheck = async sid => rec('runScopeCheck', sid);
global.searchPriorArt = async q => { rec('searchPriorArt', q); return { formatted: '【특허문헌】 재검색: ' + q }; };

const C = require('../patent/chat.js');

// ── 러너 ──
let pass = 0, fail = 0; const fails = [];
function ok(c, n) { if (c) pass++; else { fail++; fails.push('✗ ' + n); } }
function called(name, arg) { return calls.some(c => c.name === name && (arg === undefined || c.arg === arg)); }

(async function () {
  // 0) 브라우저 레이어 부착 확인
  ok(typeof C.send === 'function' && typeof C.mount === 'function' && typeof C.mountAll === 'function', '브라우저 레이어 부착');

  // 1) 청구항(06) → _cascadeRunShort + userCmd 주입/정리 + 후처리
  calls.length = 0; els['chatInput_step_06'] = null; fakeEl('chatInput_step_06').value = '독립항 넓게';
  await C.send('step_06');
  ok(called('setStepUserCommand', 'step_06="독립항 넓게"'), '06: userCmd 주입');
  ok(called('_cascadeRunShort', 'step_06'), '06: runShort 라우팅');
  ok(called('setStepUserCommand', 'step_06=""'), '06: userCmd 정리(누수 방지)');
  ok(called('invalidateDownstream', 'step_06'), '06: 하류 무효화');
  ok(called('onStepCompleted', 'step_06') && called('saveProject'), '06: 완료훅+저장');
  ok(C.getHistory({ chatHistory }, 'step_06').length === 2, '06: user+assistant 2턴 기록');

  // 2) 장문(08) → _cascadeRunLong + scope 가드(잠금 시) — 여기선 미잠금이라 runScopeCheck 미호출
  calls.length = 0; fakeEl('chatInput_step_08').value = '변형 실시예 추가';
  await C.send('step_08');
  ok(called('_cascadeRunLong', 'step_08'), '08: runLong 라우팅');
  ok(!called('runScopeCheck'), '08: scope 미잠금 → 검증 생략');

  // 3) 도면(07) → _cascadeRunDiagram
  calls.length = 0; fakeEl('chatInput_step_07').value = '메모리 노드 추가';
  await C.send('step_07');
  ok(called('_cascadeRunDiagram', 'step_07'), '07: runDiagram 라우팅');

  // 4) 선행기술(04) → searchPriorArt, LLM 실행기 미호출
  calls.length = 0; fakeEl('chatInput_step_04').value = '음성인식 키워드로 재검색';
  await C.send('step_04');
  ok(called('searchPriorArt'), '04: searchPriorArt 호출');
  ok(!called('_cascadeRunShort') && !called('_cascadeRunLong'), '04: LLM 실행기 미호출');
  ok(global.outputs.step_04.includes('재검색'), '04: 검색 결과 반영');

  // 5) 처리중 락 → 차단(실행기 미호출)
  calls.length = 0; global.globalProcessing = true; fakeEl('chatInput_step_06').value = '수정';
  await C.send('step_06');
  ok(!called('_cascadeRunShort'), '락: 처리중이면 실행기 미호출');
  global.globalProcessing = false;

  // 6) 빈 메시지 → 무시
  calls.length = 0; fakeEl('chatInput_step_06').value = '   ';
  await C.send('step_06');
  ok(calls.length === 0, '빈 메시지: 무시');

  // 7) 미생성 단계 → 차단
  calls.length = 0; fakeEl('chatInput_step_10').value = '수정'; // outputs.step_10 없음
  await C.send('step_10');
  ok(!called('_cascadeRunShort'), '미생성: 실행기 미호출');

  // 8) 수학(09)/예시도(07c) → 채팅 비대상(실행기 미호출)
  calls.length = 0; fakeEl('chatInput_step_09').value = '수식 변경';
  await C.send('step_09');
  fakeEl('chatInput_step_07c').value = '예시도 수정';
  await C.send('step_07c');
  ok(!called('_cascadeRunShort') && !called('_cascadeRunDiagram') && !called('_cascadeRunConceptDiagram'), '09/07c: 채팅 비대상(실행기 미호출)');

  // 9) ★ 단계 독립: 06 수정이 08 이력 불변 ★
  chatHistory = global.chatHistory = {};
  fakeEl('chatInput_step_08').value = '08 고유 요청'; await C.send('step_08');
  const h08before = C.getHistory({ chatHistory }, 'step_08').length;
  fakeEl('chatInput_step_06').value = '06 수정'; await C.send('step_06');
  ok(C.getHistory({ chatHistory }, 'step_08').length === h08before, '독립: 06 수정이 08 이력 불변');
  const p06 = C.buildPrompt('step_06', 'x', { chatHistory, outputs }); // 06 프롬프트에 08 요청 없음
  ok(!p06.includes('08 고유 요청'), '독립: 06 프롬프트에 08 요청 미포함');

  // 10) clearHistory 격리 (send 1회 = user+assistant 2턴)
  const h08 = C.getHistory({ chatHistory }, 'step_08').length; // 08은 send 1회 → 2턴
  C.clearHistory('step_06');
  ok(C.getHistory({ chatHistory }, 'step_06').length === 0 && C.getHistory({ chatHistory }, 'step_08').length === h08, 'clearHistory: 06만 비움, 08 보존');

  console.log('='.repeat(54));
  console.log(`chat.js 브라우저 통합 검증: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail})`);
  console.log('='.repeat(54));
  if (fails.length) { console.log('\n[실패 상세]'); fails.forEach(f => console.log(f)); }
  process.exit(fail ? 1 : 0);
})();
