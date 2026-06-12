'use strict';
// ════════════════════════════════════════════════════════════════
// 단계별 독립 채팅 수정 — 적용 가능성 시뮬레이션 + 오류 탐지
// 실행: node tests/chat.sim.js
//
// 검증 목표:
//  1) 각 단계 채팅이 완전 독립 (다른 단계 요청/이력이 절대 섞이지 않음)
//  2) 단계 유형별 라우팅 정확성
//  3) 가드(처리중 락 / 미생성 / 비-LLM 검색) 동작
//  4) 실제 결과 적용 흐름(applyStepChat)을 mock LLM + 실제 validateClaims로 검증
//  5) 발생 가능한 오류 경로 시뮬레이션
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const C = require(path.join(__dirname, '..', 'patent', 'chat.js'));

// ── 실제 patent.js의 validateClaims 추출(이름 기반, 라인변경에 견고) ──
const src = fs.readFileSync(path.join(__dirname, '..', 'patent', 'patent.js'), 'utf8').split('\n');
function extractFn(name) {
  const startRe = new RegExp('^function\\s+' + name + '\\s*\\(');
  for (let i = 0; i < src.length; i++) {
    if (startRe.test(src[i])) {
      if (/\}\s*$/.test(src[i]) && (src[i].match(/\{/g) || []).length === (src[i].match(/\}/g) || []).length) return src[i];
      for (let j = i + 1; j < src.length; j++) if (/^\}/.test(src[j])) return src.slice(i, j + 1).join('\n');
    }
  }
  throw new Error('추출 실패: ' + name);
}
function extractConst(name) {
  const re = new RegExp('^const\\s+' + name + '\\s*=');
  for (let i = 0; i < src.length; i++) if (re.test(src[i])) return src[i];
  throw new Error('상수 추출 실패: ' + name);
}
// validateClaims는 KILLER_WORDS 상수 + getCitedChainText 함수에 의존 → 함께 주입
const bundle = [extractConst('KILLER_WORDS'), extractFn('getCitedChainText'), extractFn('validateClaims'),
  ';({validateClaims})'].join('\n');
const validateClaims = eval(bundle).validateClaims;
// 도면 재검증용 실제 파서(_extractRefNum 의존)
const pmBundle = [extractFn('_extractRefNum'), extractFn('parseMermaidGraph'), ';({parseMermaidGraph})'].join('\n');
const parseMermaidGraph = eval(pmBundle).parseMermaidGraph;

// ── 러너 ──
let pass = 0, fail = 0; const fails = [];
function ok(cond, name) { if (cond) pass++; else { fail++; fails.push('✗ ' + name); } }
function eq(a, e, name) { const A = JSON.stringify(a), E = JSON.stringify(e); if (A === E) pass++; else { fail++; fails.push(`✗ ${name}\n    기대:${E}\n    실제:${A}`); } }

// ════════════════════════════════════════════════
// 1. 단계 유형 라우팅 정확성
// ════════════════════════════════════════════════
const expectClass = {
  step_01: 'title', step_02: 'text', step_03: 'text', step_04: 'search', step_05: 'text',
  step_06: 'claims', step_07: 'diagram', step_07c: 'diagram', step_08: 'long', step_09: 'math',
  step_10: 'claims', step_11: 'diagram', step_12: 'long', step_13: 'review', step_14: 'text',
  step_15: 'review', step_16: 'text', step_17: 'text', step_18: 'text', step_19: 'text', step_20: 'claims',
};
Object.entries(expectClass).forEach(([sid, cls]) => eq(C.classify(sid), cls, `분류 ${sid}→${cls}`));

// 라우팅 부가정보
ok(C.route('step_06').postProcess === 'validateAndCorrect', 'route: 청구항→validateAndCorrect');
ok(C.route('step_07').postProcess === 'reparseAndRender', 'route: 도면→reparseAndRender');
ok(C.route('step_08').postProcess === 'continuationAware', 'route: 장문→continuationAware');
ok(C.route('step_09').postProcess === 'runMathInsertion', 'route: 수학→runMathInsertion');
ok(C.route('step_04').usesLLM === false, 'route: 선행기술→비-LLM');
ok(C.route('step_03').batchContainer === 'resultsBatch25', 'route: step_03 배치 컨테이너');
ok(C.route('step_17').batchContainer === 'resultsBatchFinish', 'route: step_17 배치 컨테이너');
ok(C.route('step_06').scopeGuarded === true && C.route('step_03').scopeGuarded === false, 'route: scope 가드 플래그');

// ════════════════════════════════════════════════
// 2. ★ 핵심: 단계별 채팅 독립성 ★
// ════════════════════════════════════════════════
let state = { outputs: { step_06: '【청구항 1】 장치', step_08: '도 1을 참조하면 통신부(110)가 동작한다.' }, chatHistory: {}, globalProcessing: false };

C.recordTurn(state, 'step_06', 'user', '독립항을 더 넓게');
C.recordTurn(state, 'step_06', 'user', '앵커에 캐싱 추가');
C.recordTurn(state, 'step_08', 'user', '통신부 설명 늘려줘');

// (a) 이력 격리
eq(C.getHistory(state, 'step_06').length, 2, '독립성: step_06 이력 2턴');
eq(C.getHistory(state, 'step_08').length, 1, '독립성: step_08 이력 1턴');

// (b) step_08 프롬프트에 step_06의 요청 문구가 절대 없어야 함
const p08 = C.buildPrompt('step_08', '도 2 추가 설명', state);
ok(!p08.includes('독립항을 더 넓게') && !p08.includes('앵커에 캐싱'), '독립성: step_08 프롬프트에 step_06 요청 미포함');
ok(p08.includes('통신부 설명 늘려줘'), '독립성: step_08 프롬프트는 자기 이력만 포함');

// (c) step_06 프롬프트에 step_08의 내용/요청이 없어야 함
const p06 = C.buildPrompt('step_06', '종속항 1개 추가', state);
ok(!p06.includes('통신부 설명 늘려줘') && !p06.includes('도 1을 참조하면'), '독립성: step_06 프롬프트에 step_08 미포함');

// (d) 전수 누수 스캔: 모든 단계쌍에 대해 교차 누수 0 확인
const sids = ['step_06', 'step_08', 'step_03', 'step_12'];
state.chatHistory = {};
state.outputs = { step_06: 'C6', step_08: 'D8', step_03: 'T3', step_12: 'L12' };
const marker = {};
sids.forEach((s, i) => { marker[s] = `SECRET_${s}_${i}`; C.recordTurn(state, s, 'user', marker[s]); });
let leak = 0;
sids.forEach(s => {
  const pr = C.buildPrompt(s, '수정', state);
  sids.forEach(o => { if (o !== s && pr.includes(marker[o])) { leak++; fails.push(`✗ 누수: ${s} 프롬프트에 ${o} 요청 포함`); } });
});
ok(leak === 0, `독립성 전수 스캔: 교차 누수 0건 (검출 ${leak})`);

// (e) 리셋 독립성
C.resetStep(state, 'step_06');
eq(C.getHistory(state, 'step_06').length, 0, '독립성: step_06 리셋');
ok(C.getHistory(state, 'step_08').length === 1, '독립성: step_06 리셋이 step_08에 영향 없음');

// ════════════════════════════════════════════════
// 3. 가드(전송 가능 여부)
// ════════════════════════════════════════════════
let g = C.canChat('step_06', { outputs: { step_06: 'x' }, globalProcessing: true });
ok(!g.ok, '가드: 처리중 차단');
g = C.canChat('step_06', { outputs: {}, globalProcessing: false });
ok(!g.ok, '가드: 미생성 단계 차단');
g = C.canChat('step_04', { outputs: {}, globalProcessing: false });
ok(g.ok && g.mode === 'search', '가드: step_04는 미생성이라도 검색 허용');
g = C.canChat('step_08', { outputs: { step_08: 'x' }, globalProcessing: false });
ok(g.ok && g.mode === 'edit', '가드: 생성됨 → 편집 허용');

// ════════════════════════════════════════════════
// 4. 컨텍스트 슬라이싱 / 턴 제한
// ════════════════════════════════════════════════
const bigState = { outputs: { step_08: 'x'.repeat(20000), step_02: 'y'.repeat(20000) }, chatHistory: {} };
ok(C.buildPrompt('step_08', 'm', bigState).includes('이하 생략'), '컨텍스트: 장문(9000) 슬라이스');
ok(C.buildPrompt('step_02', 'm', bigState).length < C.buildPrompt('step_08', 'm', bigState).length, '컨텍스트: 텍스트(4000) < 장문(9000)');
const trimState = { outputs: { step_06: 'x' }, chatHistory: {} };
for (let i = 0; i < 30; i++) C.recordTurn(trimState, 'step_06', 'user', 'turn' + i);
ok(C.getHistory(trimState, 'step_06').length === C.HISTORY_MAX, `턴 제한: ${C.HISTORY_MAX}턴 유지`);
ok(C.getHistory(trimState, 'step_06')[0].content === 'turn10', '턴 제한: 오래된 턴 폐기(최근 유지)');

// ════════════════════════════════════════════════
// 5. applyStepChat 실제 적용 흐름 (mock LLM + 실제 validateClaims)
// ════════════════════════════════════════════════
(async function () {
  // 5-1) 텍스트 단계: 단순 반영 + 하류 무효화 호출 + 독립 이력
  let invalidated = [];
  let st = { outputs: { step_03: '배경기술 원문' }, chatHistory: {}, globalProcessing: false };
  let res = await C.applyStepChat('step_03', '최근 동향 문단 추가', st, {
    callLLM: async () => '배경기술 원문\n최근 동향: ...',
    invalidateDownstream: sid => invalidated.push(sid),
    onApplied: () => {},
  });
  ok(res.ok && st.outputs.step_03.includes('최근 동향'), 'apply: 텍스트 수정 반영');
  ok(invalidated.includes('step_03'), 'apply: invalidateDownstream 호출됨');
  eq(C.getHistory(st, 'step_03').length, 2, 'apply: user+assistant 2턴 기록');

  // 5-2) 청구항: mock이 기재불비(존재하지 않는 청구항 인용) 생성 → 검증 후 교정 호출
  let llmCalls = 0;
  st = { outputs: { step_06: '【청구항 1】 A를 포함하는 장치.' }, chatHistory: {}, globalProcessing: false };
  res = await C.applyStepChat('step_06', '종속항 추가', st, {
    callLLM: async () => {
      llmCalls++;
      if (llmCalls === 1) return '【청구항 1】 A를 포함하는 장치.\n【청구항 2】 청구항 5에 있어서, B를 더 포함하는 장치.'; // 존재 안하는 5 인용 + 번호역전
      return '【청구항 1】 A를 포함하는 장치.\n【청구항 2】 청구항 1에 있어서, B를 더 포함하는 장치.'; // 교정본
    },
    validateClaims: validateClaims,
    invalidateDownstream: () => {},
  });
  ok(llmCalls === 2, 'apply: 청구항 기재불비 → 교정 1회 재호출');
  ok(res.issues.length === 0, 'apply: 교정 후 기재불비 0건 (실제 validateClaims 통과)');
  ok(st.outputs.step_06.includes('청구항 1에 있어서'), 'apply: 교정본 반영');

  // 5-3) 도면: needsReparse 플래그 (caller가 재파싱해야 함을 알림)
  st = { outputs: { step_07: 'graph TD\nA["통신부(110)"] --> B["프로세서(120)"]' }, chatHistory: {}, globalProcessing: false };
  res = await C.applyStepChat('step_07', '메모리(130) 노드 추가', st, {
    callLLM: async () => 'graph TD\nA["통신부(110)"] --> B["프로세서(120)"]\nB --> M["메모리(130)"]',
    invalidateDownstream: () => {},
  });
  ok(res.needsReparse === true, 'apply: 도면 수정은 needsReparse 플래그');
  ok(res.scopeGuarded === true, 'apply: 도면(step_07) scope 가드');
  // ★ 수정된 도면을 실제 파서로 재검증(깨진 Mermaid 조기 검출) — caller 재파싱 시뮬레이션
  const reparsed = parseMermaidGraph(res.output);
  ok(reparsed.nodes.length === 3 && reparsed.edges.length === 2, 'apply: 수정 도면 재파싱 정상(노드3/엣지2)');
  ok(reparsed.nodes.some(n => /130/.test(n.label)), 'apply: 추가된 메모리(130) 노드 반영 확인');

  // 5-3b) 오류 경로: LLM이 깨진 도면 반환 → 재파싱으로 검출 가능해야
  st = { outputs: { step_07: 'graph TD\nA["통신부(110)"] --> B["프로세서(120)"]' }, chatHistory: {}, globalProcessing: false };
  res = await C.applyStepChat('step_07', '아무거나', st, { callLLM: async () => '깨진 출력: 노드도 화살표도 없음', invalidateDownstream: () => {} });
  const broken = parseMermaidGraph(res.output);
  ok(broken.nodes.length === 0 && broken.edges.length === 0, 'apply: 깨진 도면은 재파싱 시 빈 그래프로 검출(롤백 신호)');

  // 5-4) 장문: needsContinuationAware 플래그
  st = { outputs: { step_08: '도 1을 참조하면 ...' }, chatHistory: {}, globalProcessing: false };
  res = await C.applyStepChat('step_08', '변형 실시예 추가', st, { callLLM: async () => '도 1을 참조하면 ... 변형 실시예 ...', invalidateDownstream: () => {} });
  ok(res.needsContinuationAware === true, 'apply: 장문은 continuation-aware 플래그');

  // 5-5) 선행기술(비-LLM): 검색 핸들러로 라우팅, callLLM 미호출
  let llmTouched = false, searched = '';
  st = { outputs: {}, chatHistory: {}, globalProcessing: false };
  res = await C.applyStepChat('step_04', '다른 키워드로 재검색: 음성 인식', st, {
    callLLM: async () => { llmTouched = true; return 'X'; },
    search: async q => { searched = q; return '【특허문헌】 재검색 결과'; },
    invalidateDownstream: () => {},
  });
  ok(res.mode === 'search' && !llmTouched, 'apply: step_04는 LLM 미호출, 검색 라우팅');
  ok(st.outputs.step_04.includes('재검색 결과'), 'apply: 검색 결과 반영');

  // 5-6) 처리중 락: 차단
  st = { outputs: { step_06: 'x' }, chatHistory: {}, globalProcessing: true };
  res = await C.applyStepChat('step_06', '수정', st, { callLLM: async () => 'Y', invalidateDownstream: () => {} });
  ok(!res.ok, 'apply: 처리중이면 차단(LLM 미호출)');

  // 5-7) 검색 핸들러 없음(오류 경로): 안전 실패
  st = { outputs: {}, chatHistory: {}, globalProcessing: false };
  res = await C.applyStepChat('step_04', '재검색', st, { callLLM: async () => 'Y' });
  ok(!res.ok && res.mode === 'search', 'apply: 검색 핸들러 없으면 안전 실패');

  // 5-9) ★ 전용 핸들러 필요 단계 — 일반 경로로 상태 깨지지 않도록 안전 차단/플래그 ★
  // math(09): runMath 미주입 시 안전 차단 (출력 미변경)
  st = { outputs: { step_09: '【수학식 1】 ...' }, chatHistory: {}, globalProcessing: false };
  let llmHit = false;
  res = await C.applyStepChat('step_09', '수식 바꿔줘', st, { callLLM: async () => { llmHit = true; return '오염'; }, invalidateDownstream: () => {} });
  ok(!res.ok && res.needsDedicated === 'math', 'apply: 수학(09) runMath 없으면 안전 차단');
  ok(!llmHit && st.outputs.step_09 === '【수학식 1】 ...', 'apply: 수학 차단 시 LLM 미호출+출력 불변');
  // math: runMath 주입 시 전용 경로로 진행
  let mathRan = false;
  res = await C.applyStepChat('step_09', '수식 추가', st, { runMath: async () => { mathRan = true; return '【수학식 1】...\n【수학식 2】...'; } });
  ok(res.ok && mathRan && res.mode === 'math', 'apply: 수학 runMath 주입 시 전용 경로 진행');

  // review(13): 의도 확인 플래그
  st = { outputs: { step_13: 'AI 검토 리포트...' }, chatHistory: {}, globalProcessing: false };
  res = await C.applyStepChat('step_13', '뒷받침 검토 더 자세히', st, { callLLM: async () => '갱신된 리포트', invalidateDownstream: () => {} });
  ok(res.ok && res.needsIntentConfirm === true, 'apply: 검토(13)는 의도 확인 플래그');
  ok(C.route('step_09').needsDedicatedHandler === true, 'route: 수학은 전용 핸들러 필요 표시');

  // title(01): 재선택 플래그 (selectedTitle 자동 확정 금지 신호)
  st = { outputs: { step_01: '[1] 국문: A / 영문: A' }, chatHistory: {}, globalProcessing: false };
  res = await C.applyStepChat('step_01', '다른 명칭 5개 더', st, { callLLM: async () => '[1] 국문: B / 영문: B', invalidateDownstream: () => {} });
  ok(res.ok && res.needsTitleReselect === true, 'apply: 명칭(01)은 재선택 플래그');

  // 5-8) ★ 적용 후에도 단계 독립 유지: step_06 수정이 step_08 이력/출력 불변 ★
  st = { outputs: { step_06: 'C6', step_08: 'D8' }, chatHistory: {}, globalProcessing: false };
  C.recordTurn(st, 'step_08', 'user', '기존 step_08 요청');
  await C.applyStepChat('step_06', '청구항 수정', st, { callLLM: async () => 'C6-수정', invalidateDownstream: () => {} });
  ok(st.outputs.step_08 === 'D8', 'apply 후 독립: step_06 수정이 step_08 출력 불변');
  eq(C.getHistory(st, 'step_08').length, 1, 'apply 후 독립: step_08 이력 불변');
  ok(C.getHistory(st, 'step_08')[0].content === '기존 step_08 요청', 'apply 후 독립: step_08 이력 내용 보존');

  // ── 결과 ──
  console.log('='.repeat(54));
  console.log(`챗봇 단계별 독립 수정 시뮬레이션: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail})`);
  console.log('='.repeat(54));
  if (fails.length) { console.log('\n[실패/오류 상세]'); fails.forEach(f => console.log(f)); }
  process.exit(fail ? 1 : 0);
})();
