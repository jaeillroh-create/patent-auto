/**
 * review-engine/ui/opinion-review-panel.js
 * ─────────────────────────────────────────────────────────────
 * 리뷰 엔진 결과 → 의견서 UI 렌더 (spec §9). classic-script SPA(index.html)와
 * ESM 엔진을 잇는 **유일한 module 진입점**: window.ReviewUI 전역 브리지로 노출.
 *
 * ★ 읽고 지적만: 보정 diff·쟁점·전략을 **표시만** 한다. writer.applyAmendments 미호출(T6).
 * ★ I-2: 승인/거부 버튼은 humanGate.approve/rejectPlan 만 호출(사람 actor 필수). accepted 자동설정 없음.
 *
 * @module review-engine/ui/opinion-review-panel
 */
import { buildViewModel } from './reviewViewModel.js';
import { approvePlan, rejectPlan, GATE_DECISION } from '../kernel/humanGate.js';

const STYLE_ID = 'review-panel-style';
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/** 스코프 스타일 1회 주입(review- 접두사 — 기존 클래스 충돌 회피). 기존 CSS 변수 재사용. */
function injectStylesOnce(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
  .review-panel{font-size:13px;line-height:1.5;color:var(--color-text-primary,#222)}
  .review-banner{padding:8px 10px;border-radius:8px;margin-bottom:10px;font-size:12px}
  .review-banner.warn{background:#fff7e6;color:#a15c00}
  .review-verdict{display:inline-flex;align-items:center;gap:6px;font-weight:700;padding:4px 10px;border-radius:999px}
  .review-verdict.pass{background:#e9f8ef;color:#1a7f43}
  .review-verdict.warn{background:#fff4e0;color:#a15c00}
  .review-verdict.fail{background:#fdeaea;color:var(--color-error,#c0392b)}
  .review-count{display:flex;gap:14px;margin:8px 0;font-size:12px}
  .review-count b{font-size:15px}
  .review-need{border:1px solid #f0c36d;background:#fffaf0;border-radius:8px;padding:8px 10px;margin:10px 0}
  .review-need .rn-badge{display:inline-block;background:#a15c00;color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;margin-right:6px}
  .review-sec{margin:12px 0}
  .review-sec h4{margin:0 0 6px;font-size:12px;color:var(--color-text-secondary,#666);text-transform:uppercase;letter-spacing:.03em}
  .review-issue{border-left:3px solid #ddd;padding:6px 10px;margin:6px 0;background:#fafafa;border-radius:0 6px 6px 0}
  .review-issue.fail{border-left-color:var(--color-error,#c0392b)}
  .review-issue.warn{border-left-color:#e6a23c}
  .review-issue.pass{border-left-color:#2ecc71}
  .review-issue .ri-meta{font-size:11px;color:#888;margin-bottom:2px}
  .review-plan{border:1px solid var(--color-border,#e5e5e5);border-radius:8px;padding:10px;margin:8px 0}
  .review-plan.approved{border-color:#2ecc71;background:#f4fcf7}
  .review-plan.rejected{border-color:#c0392b;background:#fdf4f4;opacity:.7}
  .review-op{font-family:var(--dt-mono,monospace);font-size:12px;padding:2px 6px;border-radius:4px;margin:2px 0;display:block}
  .review-op.add{background:#e9f8ef;color:#1a7f43}
  .review-op.narrow{background:#fdeaea;color:#c0392b}
  .review-op.fix{background:#fff4e0;color:#a15c00}
  .review-op.context{background:#f2f2f2;color:#666}
  .review-gate-btns{margin-top:8px;display:flex;gap:8px}
  .review-gate-btns button{padding:5px 12px;border-radius:6px;border:1px solid var(--color-border,#ccc);cursor:pointer;font-size:12px;background:#fff}
  .review-gate-btns button.appr{border-color:#2ecc71;color:#1a7f43}
  .review-gate-btns button.rej{border-color:#c0392b;color:#c0392b}
  .review-gate-btns button:disabled{opacity:.4;cursor:not-allowed}
  .review-decision{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
  .review-decision.approved{background:#e9f8ef;color:#1a7f43}
  .review-decision.rejected{background:#fdeaea;color:#c0392b}
  .review-decision.pending{background:#eef;color:#3355aa}
  .review-cost{border-top:1px dashed var(--color-border,#e5e5e5);margin-top:12px;padding-top:8px;font-size:11px;color:#777}
  .review-cost table{width:100%;border-collapse:collapse}
  .review-cost td{padding:2px 4px}
  `;
  doc.head.appendChild(st);
}

function renderNeed(hn) {
  if (!hn.required) return '';
  const rows = [];
  if (hn.deadlocks.length) rows.push(`<span class="rn-badge">교착 ${hn.deadlocks.length}</span>진동/합의불가 — 사람 판단 필요`);
  if (hn.tradeoffs.length) rows.push(`<span class="rn-badge">권리 trade-off ${hn.tradeoffs.length}</span>일반항 축소는 사업 판단`);
  if (hn.residualHigh.length) rows.push(`<span class="rn-badge">잔여 high ${hn.residualHigh.length}</span>자동통과 금지(E-17)`);
  if (hn.unknownKind.length) rows.push(`<span class="rn-badge">유형 미상 ${hn.unknownKind.length}</span>청구항 kind 지정 필요(E-12)`);
  return `<div class="review-need"><b>⚠️ 사람 결정 필요</b><div style="margin-top:6px">${rows.map((r) => `<div style="margin:3px 0">${r}</div>`).join('')}</div></div>`;
}

function renderIssues(issuesByAgent) {
  if (!issuesByAgent.length) return '<div class="review-issue pass">발굴된 쟁점 없음 — 통과(참고: 검증 비결정적)</div>';
  return issuesByAgent.map((g) => `
    <div style="margin-bottom:8px">
      <div style="font-weight:700;font-size:12px;margin-bottom:2px">${esc(g.agent)}</div>
      ${g.items.map((it) => `
        <div class="review-issue ${esc(it.verdict)}">
          <div class="ri-meta">${esc(it.severity)} · ${esc(it.legalBasis)} · ${esc(it.type)} → ${esc((it.target || []).join(', '))} · [${esc(it.status)}]</div>
          <div>${esc(it.description)}</div>
        </div>`).join('')}
    </div>`).join('');
}

function renderDiffs(diffs, opts) {
  if (!diffs.length) return '<div style="font-size:12px;color:#888">표시할 보정안 없음</div>';
  const canAct = !!opts.actor;
  return diffs.map((d) => `
    <div class="review-plan ${esc(d.decision)}" data-plan="${esc(d.planId)}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b style="font-size:12px">${esc(d.planId)} <span style="color:#999;font-weight:400">→ ${esc((d.addressesIssues || []).join(', '))}</span></b>
        <span class="review-decision ${esc(d.decision)}">${esc(d.decision)}</span>
      </div>
      <div style="margin:6px 0">${d.ops.map((o) => `<span class="review-op ${esc(o.diffClass)}">${esc(o.op)} @ ${esc(o.target)}${o.content ? ' — ' + esc(o.content) : ''}</span>`).join('')}</div>
      <div style="font-size:11px;color:#999">score ${d.scoreBefore} → ${d.scoreAfter} · <i>표시만 — 작성모듈 미반영(T6)</i></div>
      <div class="review-gate-btns">
        <button class="appr" data-act="approve" data-plan="${esc(d.planId)}" ${canAct ? '' : 'disabled'}>승인</button>
        <button class="rej" data-act="reject" data-plan="${esc(d.planId)}" ${canAct ? '' : 'disabled'}>거부</button>
        ${canAct ? '' : '<span style="font-size:11px;color:#c0392b">로그인 후 결정 가능(actor 필요)</span>'}
      </div>
    </div>`).join('');
}

function renderCost(cost) {
  const pct = cost.capUsd ? Math.min(100, Math.round((cost.spentUsd / cost.capUsd) * 100)) : 0;
  return `<div class="review-cost">
    <div>비용 $${cost.spentUsd.toFixed(4)} / 상한 $${cost.capUsd} (${pct}%) · 라운드 ${cost.roundsUsed}/${cost.maxRounds}</div>
    <table>${cost.rounds.map((r) => `<tr><td>R${r.n} ${esc(r.mode)}</td><td>${esc(r.provider || '')}</td><td>$${(r.cost || 0).toFixed(4)}</td><td>${r.latencyMs}ms</td><td>${r.issueCount != null ? r.issueCount + '건' : ''}</td></tr>`).join('')}</table>
  </div>`;
}

/** 뷰모델 → HTML 문자열. */
export function renderHTML(state, opts = {}) {
  const vm = buildViewModel(state);
  return `<div class="review-panel">
    <div class="review-banner warn">${esc(vm.nondeterministicNotice)}</div>
    <div><span class="review-verdict ${esc(vm.overall)}">${vm.overall === 'pass' ? '✅ 통과' : vm.overall === 'warn' ? '⚠️ 주의' : '🔴 실패'}</span></div>
    <div class="review-count"><span>해소 <b>${vm.passCount.resolved}</b>/${vm.passCount.total}</span><span>high 잔존 <b>${vm.passCount.highOpen}</b></span><span>주의 <b>${vm.passCount.medOpen}</b></span></div>
    ${renderNeed(vm.humanNeeded)}
    <div class="review-sec"><h4>쟁점 · 전략 (심사관별)</h4>${renderIssues(vm.issuesByAgent)}</div>
    <div class="review-sec"><h4>보정 diff (표시만)</h4>${renderDiffs(vm.diffs, opts)}</div>
    ${renderCost(vm.cost)}
  </div>`;
}

/**
 * 마운트 + 이벤트 와이어링. classic opinion.js 가 window.ReviewUI.render(state, el, {actor, onChange}) 로 호출.
 * @param {Object} state ReviewState
 * @param {HTMLElement|string} mount  엘리먼트 또는 id
 * @param {{ actor?:string, onChange?:(state:Object)=>void }} [opts]
 */
export function render(state, mount, opts = {}) {
  const doc = (mount && mount.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw new Error('ReviewUI.render: document 없음');
  injectStylesOnce(doc);
  const el = typeof mount === 'string' ? doc.getElementById(mount) : mount;
  if (!el) throw new Error('ReviewUI.render: mount 엘리먼트 없음');
  el.innerHTML = renderHTML(state, opts);

  // 승인/거부 — 사람 actor 경유만(I-2). 자동 accepted 설정 없음.
  el.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const planId = btn.getAttribute('data-plan');
      const act = btn.getAttribute('data-act');
      if (!opts.actor) { console.warn('ReviewUI: actor 없음 — 승인/거부 차단'); return; }
      try {
        if (act === 'approve') approvePlan(state, planId, opts.actor);
        else rejectPlan(state, planId, opts.actor);
        render(state, el, opts);            // 재렌더(상태 반영)
        if (opts.onChange) opts.onChange(state); // 호출측이 DB 영속 등 처리(T5는 미반영)
      } catch (e) { console.error('ReviewUI gate error:', e); }
    });
  });
  return el;
}

/** classic-script SPA 브리지: window.ReviewUI 노출. */
export const ReviewUI = { render, renderHTML, buildViewModel, GATE_DECISION };
if (typeof window !== 'undefined') window.ReviewUI = ReviewUI;

export default ReviewUI;
