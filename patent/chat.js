/* ═══════════════════════════════════════════════════════════
   patent/chat.js — 단계별 독립 채팅 수정 코어 (v0.1, 시뮬레이션 단계)
   ───────────────────────────────────────────────────────────
   설계 원칙:
   ① 각 단계(sid)의 채팅은 완전 격리 — 다른 단계의 수정 요청/이력이
      절대 프롬프트에 섞이지 않는다. chatHistory[sid]만 참조.
   ② DOM/전역 의존 없음 — 상태(state)를 인자로 받는 순수 로직.
      (브라우저 통합 시 outputs/globalProcessing/callClaude를 주입)
   ③ 단계 유형별 라우팅 — 청구항/도면/장문/수학/검토/검색/명칭 분기.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  // 단계 → 유형 분류
  const STEP_CLASS = {
    step_01: 'title',
    step_02: 'text', step_03: 'text', step_05: 'text', step_14: 'text',
    step_16: 'text', step_17: 'text', step_18: 'text', step_19: 'text',
    step_06: 'claims', step_10: 'claims', step_20: 'claims',
    step_07: 'diagram', step_11: 'diagram', step_07c: 'diagram',
    step_08: 'long', step_12: 'long',
    step_09: 'math',
    step_13: 'review', step_15: 'review',
    step_04: 'search',
  };
  // 배치(공유 아코디언) 단계 → 단독 재렌더 시 대상 컨테이너
  const BATCH_STEPS = {
    step_02: 'resultsBatch25', step_03: 'resultsBatch25', step_04: 'resultsBatch25', step_05: 'resultsBatch25',
    step_16: 'resultsBatchFinish', step_17: 'resultsBatchFinish', step_18: 'resultsBatchFinish', step_19: 'resultsBatchFinish',
  };
  // 스코프 가드 단계 (수정 후 runScopeCheck 재실행 필요)
  const SCOPE_GUARDED = ['step_06', 'step_10', 'step_20', 'step_08', 'step_12', 'step_07', 'step_11'];

  const HISTORY_MAX = 20;   // 단계당 채팅 턴 보관 한도 (영속성 비대 방지)
  const HISTORY_CTX = 6;    // 프롬프트에 포함할 직전 대화 턴 수 (슬라이딩 윈도우)

  function classify(sid) { return STEP_CLASS[sid] || 'text'; }

  // ── 단계별 독립 채팅 이력 ──
  // ★ 핵심 격리 지점: 모든 접근은 sid 키로만. 교차 참조 불가능한 구조.
  function getHistory(state, sid) {
    return (state.chatHistory && state.chatHistory[sid]) ? state.chatHistory[sid] : [];
  }
  function recordTurn(state, sid, role, content) {
    if (!state.chatHistory) state.chatHistory = {};
    if (!state.chatHistory[sid]) state.chatHistory[sid] = [];
    state.chatHistory[sid].push({ role: role, content: content, ts: new Date().toISOString() });
    if (state.chatHistory[sid].length > HISTORY_MAX) {
      state.chatHistory[sid] = state.chatHistory[sid].slice(-HISTORY_MAX);
    }
  }
  function resetStep(state, sid) { if (state.chatHistory) state.chatHistory[sid] = []; }

  // ── 전송 가능 여부(가드) ──
  function canChat(sid, state) {
    if (state.globalProcessing) return { ok: false, reason: '처리 중입니다. 완료 후 다시 시도하세요.' };
    if (classify(sid) === 'search') return { ok: true, reason: '', mode: 'search' };
    if (!state.outputs || !state.outputs[sid]) {
      return { ok: false, reason: '먼저 이 단계를 생성한 후 수정 요청이 가능합니다.' };
    }
    return { ok: true, reason: '', mode: 'edit' };
  }

  // ── 수정 프롬프트 빌드 (단계별 완전 독립) ──
  // 오직 sid의 출력 + sid의 채팅 이력만 사용. 다른 단계는 절대 참조 안 함.
  function buildPrompt(sid, message, state) {
    const cls = classify(sid);
    const output = (state.outputs && state.outputs[sid]) || '';
    const recent = getHistory(state, sid).slice(-HISTORY_CTX); // 이 단계의 직전 대화만
    const histText = recent.length
      ? '\n\n[이 단계의 이전 수정 대화 — 이 단계에만 한정, 다른 단계와 무관]\n' +
        recent.map(h => (h.role === 'user' ? '요청' : '반영') + ': ' + h.content).join('\n')
      : '';
    const outCap = cls === 'long' ? 9000 : (cls === 'claims' || cls === 'diagram') ? 6000 : 4000;
    const outSlice = output.length > outCap ? output.slice(0, outCap) + '\n…(이하 생략)' : output;

    const head = '아래 [현재 결과]를 [수정 요청]에 따라 수정하여, 수정된 전체 결과만 출력하라.\n' +
      '수정 요청과 무관한 부분은 원문 그대로 유지하라. 전체 재작성 금지. 메타설명·머리말 금지.';
    let guard = '';
    if (cls === 'claims') guard = '\n⛔ 청구항 번호 체계와 인용관계를 보존하라. 기재불비(상기 선행기재 누락, 다중인용 규칙)를 위반하지 마라.';
    else if (cls === 'diagram') guard = '\n⛔ 도면 수와 참조번호 체계를 보존하라. 청구항에 없는 구성요소를 임의 추가하지 마라.';
    else if (cls === 'long') guard = '\n⛔ 특허문체(~한다), 도면 범위·분량 한도를 유지하라. 수학식은 포함하지 마라.';
    else if (cls === 'review') guard = '\n⛔ 이 단계는 검토 리포트이다. 요청이 "명세서에 반영"이면 반영 대상 단계를 명시하고, "리포트 수정"이면 리포트만 갱신하라.';
    else if (cls === 'title') guard = '\n명칭 후보 5개를 [1]~[5] 형식으로 다시 제시하라.';

    return head + guard + '\n\n[수정 요청]\n' + message + '\n\n[현재 결과]\n' + outSlice + histText;
  }

  // ── 라우팅: 수정 결과 적용 방식 ──
  function route(sid) {
    const cls = classify(sid);
    const post = cls === 'claims' ? 'validateAndCorrect'
      : cls === 'diagram' ? 'reparseAndRender'
      : cls === 'long' ? 'continuationAware'
      : cls === 'math' ? 'runMathInsertion'
      : cls === 'review' ? 'intentSplit'
      : cls === 'search' ? 'searchPriorArt'
      : cls === 'title' ? 'regenerateAndSelect'
      : 'editableRender';
    return {
      class: cls,
      postProcess: post,
      batchContainer: BATCH_STEPS[sid] || null,
      scopeGuarded: SCOPE_GUARDED.indexOf(sid) >= 0,
      usesLLM: cls !== 'search',
      // 일반 채팅 글루로 안전 처리 불가 → 전용 핸들러 필요
      needsDedicatedHandler: cls === 'math',
    };
  }

  const API = { classify, canChat, buildPrompt, route, getHistory, recordTurn, resetStep,
    STEP_CLASS, BATCH_STEPS, SCOPE_GUARDED, HISTORY_MAX, HISTORY_CTX };

  // ── 수정 적용 글루 (실제 통합 시 그대로 사용) ──
  // deps 주입: { callLLM(prompt)->Promise<string>, validateClaims(text)->[issue],
  //            search(query)->Promise<string>, invalidateDownstream(sid), onApplied(sid,text) }
  // 단계별 독립: state.chatHistory[sid]만 읽고 쓴다. 다른 단계 미참조.
  async function applyStepChat(sid, message, state, deps) {
    deps = deps || {};
    const gate = canChat(sid, state);
    if (!gate.ok) return { ok: false, reason: gate.reason };

    recordTurn(state, sid, 'user', message); // 이 단계 이력에만 기록

    // 비-LLM(선행기술 검색) 라우팅
    if (gate.mode === 'search') {
      if (typeof deps.search !== 'function') return { ok: false, reason: '검색 핸들러 없음', mode: 'search' };
      const result = await deps.search(message);
      if (state.outputs) state.outputs[sid] = result;
      recordTurn(state, sid, 'assistant', '선행기술 재검색 완료');
      if (deps.onApplied) deps.onApplied(sid, result);
      return { ok: true, mode: 'search', class: 'search', output: result };
    }

    const cls = classify(sid);

    // 전용 처리가 필요한 단계 — 일반 덮어쓰기 경로로 처리하면 상태가 깨진다.
    //  · math(09): 출력이 독립 텍스트가 아니라 상세설명에 ANCHOR 삽입됨 → runMathInsertion 필요
    //  · math는 dedicated 핸들러가 있을 때만 진행, 없으면 안전 차단
    if (cls === 'math') {
      if (typeof deps.runMath === 'function') {
        const out = await deps.runMath(message, state);
        recordTurn(state, sid, 'assistant', '수학식 재삽입');
        if (deps.onApplied) deps.onApplied(sid, out);
        return { ok: true, class: 'math', mode: 'math', output: out };
      }
      return { ok: false, class: 'math', needsDedicated: 'math',
        reason: '수학식 단계는 ANCHOR 기반 전용 삽입 처리가 필요합니다(일반 채팅 수정 불가).' };
    }

    if (typeof deps.callLLM !== 'function') return { ok: false, reason: 'LLM 핸들러 없음' };
    const prompt = buildPrompt(sid, message, state);
    let text = await deps.callLLM(prompt);

    let issues = [];
    // 청구항: 자동 검증 + 1회 교정(실제 runStep의 다회 루프 축약)
    if (cls === 'claims' && typeof deps.validateClaims === 'function') {
      issues = deps.validateClaims(text) || [];
      if (issues.length) {
        const fixPrompt = '아래 청구범위의 기재불비를 모두 수정하여 전체를 다시 출력하라. 청구항 번호는 보존하라.\n' +
          '[지적사항]\n' + issues.map(i => i.message).join('\n') + '\n\n[원본]\n' + text;
        text = await deps.callLLM(fixPrompt);
        issues = deps.validateClaims(text) || [];
      }
    }

    if (state.outputs) state.outputs[sid] = text;
    recordTurn(state, sid, 'assistant', '수정 반영(' + cls + ')');
    if (typeof deps.invalidateDownstream === 'function') deps.invalidateDownstream(sid);
    if (deps.onApplied) deps.onApplied(sid, text);

    return {
      ok: true, class: cls, output: text, issues: issues,
      needsReparse: cls === 'diagram',           // caller가 parseMermaid/parseDesignJSON 재실행
      needsContinuationAware: cls === 'long',     // 응답 잘림 시 이어쓰기 처리
      needsTitleReselect: cls === 'title',        // 후보 카드 재렌더 + selectedTitle 재확정 필요
      needsIntentConfirm: cls === 'review',       // "리포트 수정" vs "명세서 반영" 의도 확인 필요
      scopeGuarded: SCOPE_GUARDED.indexOf(sid) >= 0,
    };
  }
  API.applyStepChat = applyStepChat;

  // ════════════════════════════════════════════════════════════════
  // 브라우저 통합 레이어 (DOM 필요) — 기존 단계 실행기/렌더러 재사용
  // ★ 각 단계는 global chatHistory[sid]만 사용 → 완전 독립
  // ════════════════════════════════════════════════════════════════
  if (typeof document !== 'undefined') {
    // 채팅 가능 단계 제외:
    //  · 수학식(09): ANCHOR 삽입 특수 — 별도 재생성 버튼 사용
    //  · 예시도(07c): 실행기가 자유지시(userCmd)를 받지 않음 → 지시 무시 방지
    function _enabled(sid) { return classify(sid) !== 'math' && sid !== 'step_07c'; }

    function _camelResultId(sid) { return 'result' + sid.charAt(0).toUpperCase() + sid.slice(1).replace('_', ''); }

    // 단계별 마운트 앵커(결과 컨테이너 옆/배치 아코디언 안/도면 컨테이너 옆)
    function _anchorFor(sid) {
      const cls = classify(sid);
      if (cls === 'diagram') {
        const m = { step_07: 'diagramsStep07', step_11: 'diagramsStep11', step_07c: 'conceptDiagramsArea' };
        return { el: document.getElementById(m[sid]), mode: 'after' };
      }
      if (BATCH_STEPS[sid]) return { el: document.getElementById('chatMount_' + sid), mode: 'inside' };
      return { el: document.getElementById(_camelResultId(sid)), mode: 'after' };
    }

    function _esc(s) { return (window.App && App.escapeHtml) ? App.escapeHtml(s) : String(s || ''); }

    function _hist(sid) { return (typeof chatHistory !== 'undefined' && chatHistory[sid]) ? chatHistory[sid] : []; }
    function _push(sid, role, content) {
      if (typeof chatHistory === 'undefined') return;
      if (!chatHistory[sid]) chatHistory[sid] = [];
      chatHistory[sid].push({ role: role, content: content, ts: new Date().toISOString() });
      if (chatHistory[sid].length > HISTORY_MAX) chatHistory[sid] = chatHistory[sid].slice(-HISTORY_MAX);
    }

    function _panelHtml(sid) {
      const ph = classify(sid) === 'search' ? '예: 다른 키워드로 재검색' : '예: 독립항을 더 넓게 / 변형 실시예 추가';
      return '<details class="pchat-d"><summary class="pchat-sum"><span class="ico" data-icon="message-circle"></span> 이 단계 수정 요청 (AI)</summary>' +
        '<div class="pchat-log" id="chatLog_' + sid + '"></div>' +
        '<div class="pchat-in"><textarea id="chatInput_' + sid + '" rows="2" placeholder="' + ph + '" ' +
        'onkeydown="if(event.ctrlKey&&event.key===\'Enter\')PatentChat.send(\'' + sid + '\')"></textarea>' +
        '<button id="chatSend_' + sid + '" class="pchat-send" onclick="PatentChat.send(\'' + sid + '\')">전송</button></div>' +
        '<div class="pchat-foot"><span class="pchat-hint">Ctrl+Enter 전송 · 이 단계에만 적용</span>' +
        '<button class="pchat-reset" onclick="PatentChat.clearHistory(\'' + sid + '\')">이력 비우기</button></div></details>';
    }

    function _renderHistory(sid) {
      const log = document.getElementById('chatLog_' + sid);
      if (!log) return;
      const h = _hist(sid);
      log.innerHTML = h.map(function (t) {
        return '<div class="pchat-msg pchat-' + (t.role === 'user' ? 'u' : 'a') + '">' + _esc(t.content) + '</div>';
      }).join('');
      log.scrollTop = log.scrollHeight;
    }

    function mount(sid) {
      if (!_enabled(sid)) return;
      const a = _anchorFor(sid);
      if (!a || !a.el) return;
      let panel = document.getElementById('chatPanel_' + sid);
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'chatPanel_' + sid;
        panel.className = 'pchat';
        panel.innerHTML = _panelHtml(sid);
        if (a.mode === 'inside') a.el.appendChild(panel);
        else a.el.insertAdjacentElement('afterend', panel);
        if (window.Icons && Icons.renderAll) Icons.renderAll(panel);
      }
      _renderHistory(sid);
    }

    function mountAll() {
      Object.keys(STEP_CLASS).forEach(function (sid) {
        if (!_enabled(sid)) return;
        // 출력이 있어야 수정 가능(검색 단계는 예외)
        const hasOut = typeof outputs !== 'undefined' && outputs[sid];
        if (hasOut || classify(sid) === 'search') mount(sid);
      });
    }

    function clearHistory(sid) {
      if (typeof chatHistory !== 'undefined') chatHistory[sid] = [];
      _renderHistory(sid);
      if (typeof saveProject === 'function') saveProject(true);
    }

    // 단계 실행기 디스패치 (연쇄 재생성과 동일 — 기존 검증/렌더/도면 파이프라인 재사용)
    async function _dispatch(sid) {
      const runner = (typeof STEP_RUNNERS !== 'undefined' && STEP_RUNNERS[sid]) || 'runStep';
      if (runner === 'runLongStep') await _cascadeRunLong(sid);
      else if (runner === 'runDiagramStep') await _cascadeRunDiagram(sid);
      else if (runner === 'runConceptDiagramStep') { if (typeof conceptDiagramTypes !== 'undefined' && conceptDiagramTypes.length) await _cascadeRunConceptDiagram(); }
      else await _cascadeRunShort(sid);
    }

    async function send(sid) {
      const cls = classify(sid);
      if (!_enabled(sid)) { if (window.App) App.showToast('이 단계는 채팅 수정을 지원하지 않습니다', 'error'); return; }
      const ta = document.getElementById('chatInput_' + sid);
      const msg = ta ? ta.value.trim() : '';
      if (!msg) return;
      // 가드: 처리중 락
      if (typeof globalProcessing !== 'undefined' && globalProcessing) { if (window.App) App.showToast('처리 중입니다. 완료 후 다시 시도하세요', 'error'); return; }
      // 가드: 출력 존재(검색 제외)
      if (cls !== 'search' && !(typeof outputs !== 'undefined' && outputs[sid])) { if (window.App) App.showToast('먼저 이 단계를 생성하세요', 'error'); return; }

      _push(sid, 'user', msg);     // 이 단계 이력에만 기록(독립)
      _renderHistory(sid);
      if (ta) { ta.value = ''; ta.disabled = true; }
      const sb = document.getElementById('chatSend_' + sid); if (sb) sb.disabled = true;

      try {
        if (typeof setGlobalProcessing === 'function') setGlobalProcessing(true);
        if (cls === 'search') {
          const sr = await searchPriorArt(typeof selectedTitle !== 'undefined' ? selectedTitle : '');
          outputs.step_04 = sr ? sr.formatted : '【특허문헌】\n(재검색 결과 없음)';
          if (typeof markOutputTimestamp === 'function') markOutputTimestamp('step_04');
          if (typeof _cascadeRender === 'function') _cascadeRender('step_04', outputs.step_04);
          _push(sid, 'assistant', '선행기술 재검색 완료');
        } else {
          // 기존 부분수정 파이프라인: userCmd 주입 → 단계 러너 실행(검증/렌더/도면/장문 자동 처리)
          if (typeof setStepUserCommand === 'function') setStepUserCommand(sid, msg);
          await _dispatch(sid);
          if (typeof setStepUserCommand === 'function') setStepUserCommand(sid, ''); // 누수 방지: 다음 일반 생성에 안 섞이도록
          _push(sid, 'assistant', '수정 반영됨');
        }
        // 후처리: 하류 무효화 + 완료 + 스코프 검증 + 저장
        if (typeof invalidateDownstream === 'function') invalidateDownstream(sid);
        if (typeof inventionScope !== 'undefined' && inventionScope && inventionScope.locked_at && typeof runScopeCheck === 'function' &&
          ((typeof SCOPE_GUARDED_TEXT_STEPS !== 'undefined' && SCOPE_GUARDED_TEXT_STEPS.indexOf(sid) >= 0) ||
           (typeof SCOPE_GUARDED_MERMAID_STEPS !== 'undefined' && SCOPE_GUARDED_MERMAID_STEPS.indexOf(sid) >= 0))) {
          try { await runScopeCheck(sid); } catch (e) { /* 스코프 검증 실패는 무시 */ }
        }
        if (typeof onStepCompleted === 'function') onStepCompleted(sid); // mountAll 트리거(패널 복원)
        if (typeof saveProject === 'function') saveProject(true);
        if (window.App) App.showToast('수정 반영됨');
      } catch (e) {
        _push(sid, 'assistant', '오류: ' + (e && e.message ? e.message : e));
        if (window.App) App.showToast('수정 실패: ' + (e && e.message ? e.message : e), 'error');
      } finally {
        if (typeof setGlobalProcessing === 'function') setGlobalProcessing(false);
        const ta2 = document.getElementById('chatInput_' + sid); if (ta2) ta2.disabled = false;
        const sb2 = document.getElementById('chatSend_' + sid); if (sb2) sb2.disabled = false;
        mount(sid); _renderHistory(sid); // 재렌더로 패널이 사라졌으면 복원
      }
    }

    // CSS 1회 주입
    (function () {
      if (document.getElementById('pchat-css')) return;
      const st = document.createElement('style');
      st.id = 'pchat-css';
      st.textContent =
        '.pchat{margin:8px 0}' +
        '.pchat-d{border:1px solid var(--color-border,#e0e0e0);border-radius:8px;background:var(--color-bg-tertiary,#fafafa);padding:6px 10px}' +
        '.pchat-sum{font-size:12px;font-weight:600;color:var(--color-text-secondary,#666);cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:6px}' +
        '.pchat-log{max-height:180px;overflow-y:auto;margin:8px 0;display:flex;flex-direction:column;gap:6px}' +
        '.pchat-log:empty{display:none}' +
        '.pchat-msg{font-size:12px;padding:6px 10px;border-radius:10px;max-width:90%;white-space:pre-wrap;word-break:break-word}' +
        '.pchat-u{align-self:flex-end;background:var(--color-primary,#3b82f6);color:#fff}' +
        '.pchat-a{align-self:flex-start;background:#eceff1;color:#333}' +
        '.pchat-in{display:flex;gap:6px;align-items:flex-end}' +
        '.pchat-in textarea{flex:1;font-size:12px;min-height:40px;resize:vertical;border:1px solid var(--color-border,#ddd);border-radius:6px;padding:6px;font-family:inherit}' +
        '.pchat-send{flex-shrink:0;background:var(--color-primary,#3b82f6);color:#fff;border:none;border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;font-family:inherit}' +
        '.pchat-send:disabled{opacity:.5;cursor:default}' +
        '.pchat-foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px}' +
        '.pchat-hint{font-size:10px;color:var(--color-text-tertiary,#999)}' +
        '.pchat-reset{font-size:10px;color:var(--color-text-tertiary,#999);background:none;border:none;cursor:pointer;text-decoration:underline}';
      document.head.appendChild(st);
    })();

    API.mount = mount;
    API.mountAll = mountAll;
    API.send = send;
    API.clearHistory = clearHistory;
  }

  global.PatentChat = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
