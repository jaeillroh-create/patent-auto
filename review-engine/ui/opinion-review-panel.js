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
import { isModuleEnabled } from '../index.js?v=20260634'; // ?v=: FEATURE_FLAGS(patent ON) ESM 캐시버스트 — 패널 ?v=만으론 캐시된 index.js 재사용됨
import { PROFILES } from '../profiles/registry.js';
import { subscribePolling } from './progressClient.js'; // B-T3: 폴링 재사용(재구현 0)

const STYLE_ID = 'review-panel-style';
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/** 스코프 스타일 1회 주입(review- 접두사 — 기존 클래스 충돌 회피). 기존 CSS 변수 재사용. */
function injectStylesOnce(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
  /* 자체 스크롤 영역(opinion/patent 공유) — 부모 컬럼(opinion.css:47 sticky+캡)에 의존하지 않고 패널 안에서 스크롤.
     overscroll-behavior:contain 으로 sticky 부모와의 스크롤 경합 차단. 짧은 결과는 overflow:auto 라 스크롤바 미생성. */
  .review-panel{font-size:13px;line-height:1.5;color:var(--color-text-primary,#222);max-height:70vh;overflow-y:auto;overscroll-behavior:contain;padding-right:4px}
  .review-panel::-webkit-scrollbar{width:6px}
  .review-panel::-webkit-scrollbar-thumb{background:var(--dt-g200,#d0d0d0);border-radius:3px}
  /* 모달 맥락(2a): 넓은 공유 모달 바디(.review-modal-body)가 단일 스크롤 → 패널 자체 70vh 캡 해제(중첩 이중스크롤 제거). */
  .review-modal-body .review-panel{max-height:none;overflow:visible;padding-right:0}
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
  /* 최상단 한국어 종합 결론(AC-T2) */
  .review-verdict-box{border:1px solid var(--color-border,#e5e5e5);border-left:4px solid var(--color-primary,#2563eb);border-radius:8px;padding:12px 14px;margin-bottom:12px;background:var(--color-bg-secondary,#f7f9fc)}
  .review-verdict-box .rv-headline{font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .review-verdict-box .rv-sub{font-size:12px;color:var(--color-text-secondary,#555);margin-top:6px}
  .review-verdict-box .rv-final{font-size:12px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--color-border,#e5e5e5);font-weight:600}
  .review-verdict-box ul{margin:4px 0 0;padding-left:18px;font-size:12px}
  .review-verdict-box li{margin:2px 0}
  `;
  doc.head.appendChild(st);
}

// ── 영문 라벨 → 한국어 매핑(AC-T2, presentation) ──
const OP_LABEL = { add_limitation: '한정 추가', narrow_scope: '권리 축소', fix_term: '용어 정정', add_antecedent: '선행근거 추가', add_spec_support: '명세서 근거 추가', merge_claim: '청구항 병합', amend_claim: '청구항 보정', delete_claim: '청구항 삭제', add_dependent: '종속항 추가' };
const PHASE_LABEL = { escalated: '보정 필요(미해소 거절위험 잔존)', ESCALATED: '보정 필요(미해소 거절위험 잔존)', converged: '수렴 완료(거절위험 해소)', CONVERGED: '수렴 완료(거절위험 해소)', finalized: '확정', running: '검증 중', RUNNING: '검증 중' };
const STATUS_LABEL = { open: '미해소', regression: '회귀', resolved: '해소', accepted: '수용', deadlock: '판단 요망', escalated: '보정 필요' };
const SEV_LABEL = { high: '높음', medium: '주의', low: '참고', HIGH: '높음', MEDIUM: '주의', LOW: '참고' };
function opLabel(o) { return OP_LABEL[o] || o; }
function phaseLabel(p) { return PHASE_LABEL[p] || (p || ''); }
function statusLabel(s) { return STATUS_LABEL[s] || s; }
function sevLabel(s) { return SEV_LABEL[s] || s; }

function opSummary(d) {
  const who = (d.addressesIssues || []).join(', ');
  const ops = (d.ops || []).map((o) => opLabel(o.op) + (o.target ? ' @ ' + o.target : '')).join(', ');
  return (who ? who + ': ' : '') + ops;
}

/** ★ 최상단 한국어 종합 결론(판정 + 핵심 거절이유 + 권장 보정 + 최종 판정). presentation 만. */
function renderVerdict(vm) {
  const p = vm.passCount;
  const overallTxt = vm.overall === 'pass' ? '✅ 통과' : vm.overall === 'warn' ? '⚠️ 주의' : '🔴 보정 필요';
  const headline = p.total === 0
    ? '발굴된 거절이유가 없습니다 — 현재 청구항 기준 거절위험이 낮습니다(보조 자료).'
    : `거절이유 ${p.total}건 발굴 · 해소 ${p.resolved} · 미해소(높음) ${p.highOpen} · 주의 ${p.medOpen}`;
  const highs = (vm.severity.fail || []).slice(0, 5).map((it) =>
    `<li>${esc(it.legalBasis || '')} ${esc(it.type || '')} — ${esc((it.target || []).join(', '))}: ${esc((it.description || '').slice(0, 90))}</li>`).join('');
  const highBlock = (vm.severity.fail || []).length
    ? `<div style="margin-top:6px"><b>핵심 거절이유 (미해소 · 보정 필요)</b><ul>${highs}</ul></div>` : '';
  const planCount = (vm.diffs || []).length;
  const hasContent = (vm.diffs || []).some((d) => (d.ops || []).some((o) => o.content));
  const planBlock = planCount === 0
    ? `<div style="margin-top:6px;color:var(--color-text-tertiary,#888)">권장 보정안: 아직 생성되지 않았습니다.</div>`
    : `<div style="margin-top:6px"><b>권장 보정 (${planCount}건)</b>: ${hasContent ? esc((vm.diffs || []).map(opSummary).join(' / ')) : '보정 방향 생성 중 — 아래 보정안 참조'}</div>`;
  const finalMsg = (vm.severity.fail || []).length
    ? `미해소 거절이유 ${vm.severity.fail.length}건은 보정 없이 등록 통과가 불가합니다(특허상 정당한 판정). 아래 보정안을 검토·확정하세요.`
    : (p.total === 0 ? '추가 대응 없이 진행 가능합니다(참고용).' : '주의 항목을 검토한 뒤 확정하세요.');
  return `<div class="review-verdict-box">
    <div class="rv-headline"><span class="review-verdict ${esc(vm.overall)}">${overallTxt}</span> <b>검증 판정</b> · ${esc(phaseLabel(vm.phase))}</div>
    <div class="rv-sub">${esc(headline)}</div>
    ${highBlock}
    ${planBlock}
    <div class="rv-final">최종 판정: ${esc(finalMsg)}</div>
  </div>`;
}

function renderNeed(hn) {
  if (!hn.required) return '';
  // ★ AC-T2: "진동/합의불가/사람 판단 떠넘김" 부정 표현 제거 → 명확한 최종 판정·변리사 확정 요망(긍정 프레이밍).
  const rows = [];
  if (hn.residualHigh.length) rows.push(`<span class="rn-badge">미해소 ${hn.residualHigh.length}</span>보정 없이는 등록 통과 불가 — 아래 보정안 확정 요망(특허상 정당한 판정)`);
  if (hn.deadlocks.length) rows.push(`<span class="rn-badge">핵심 쟁점 ${hn.deadlocks.length}</span>보정 방향을 변리사가 확정 요망`);
  if (hn.tradeoffs.length) rows.push(`<span class="rn-badge">권리범위 ${hn.tradeoffs.length}</span>일반항 축소는 사업 판단`);
  if (hn.unknownKind.length) rows.push(`<span class="rn-badge">유형 ${hn.unknownKind.length}</span>청구항 종류 지정 요망`);
  return `<div class="review-need"><b>변리사 확정 필요</b><div style="margin-top:6px">${rows.map((r) => `<div style="margin:3px 0">${r}</div>`).join('')}</div></div>`;
}

// 한 심사관 그룹(에이전트 라벨 + issue 항목들) 렌더 — 마크업 불변(추출만).
function renderIssueGroup(g) {
  return `
    <div style="margin-bottom:8px">
      <div style="font-weight:700;font-size:12px;margin-bottom:2px">${esc(g.agent)}</div>
      ${g.items.map((it) => `
        <div class="review-issue ${esc(it.verdict)}">
          <div class="ri-meta">${esc(sevLabel(it.severity))} · ${esc(it.legalBasis)} · ${esc(it.type)} → ${esc((it.target || []).join(', '))} · [${esc(statusLabel(it.status))}]</div>
          <div>${esc(it.description)}</div>
        </div>`).join('')}
    </div>`;
}

// ★ severity 게이트(UI) — 발굴·저장은 전부 유지(숨김 아님), 표시만 high(치명/심각·거절무효 직결) 우선.
//   medium/low 는 <details> 로 접어둠(클릭 시 펼침) — 생성 단계가 이미 치밀 검증하므로 review 는 치명만 표면화(변리사 설계).
//   patent·opinion 공통(공유 패널). examiner .md severity 매김은 불변(§42④ 뒷받침=high 등 그대로 사용).
function renderIssues(issuesByAgent) {
  if (!issuesByAgent.length) return '<div class="review-issue pass">발굴된 거절이유 없음 — 현재 기준 거절위험이 낮습니다(보조 자료)</div>';
  const isHigh = (it) => it.severity === 'high';
  const highGroups = issuesByAgent.map((g) => ({ agent: g.agent, items: (g.items || []).filter(isHigh) })).filter((g) => g.items.length);
  const minorGroups = issuesByAgent.map((g) => ({ agent: g.agent, items: (g.items || []).filter((it) => !isHigh(it)) })).filter((g) => g.items.length);
  const highCount = highGroups.reduce((n, g) => n + g.items.length, 0);
  const allItems = issuesByAgent.reduce((a, g) => a.concat(g.items || []), []);
  const medCount = allItems.filter((it) => it.severity === 'medium').length;
  const lowCount = allItems.filter((it) => it.severity === 'low').length;
  const minorCount = medCount + lowCount;

  let html = '';
  if (highCount) {
    html += highGroups.map(renderIssueGroup).join('');                                  // ★ high 우선(항상 표시)
  } else {
    html += `<div class="review-issue pass">치명적·심각(거절·무효 직결) 결함 없음`
      + (minorCount ? ` — 참고 ${minorCount}건은 아래에서 펼쳐 확인하세요.` : '.') + '</div>';
  }
  if (minorCount) {                                                                      // ★ medium/low 접어둠(펼치면 보임)
    html += `<details class="review-minor" style="margin-top:6px">`
      + `<summary style="cursor:pointer;font-size:12px;color:var(--color-text-secondary,#667085)">기타 ${minorCount}건 (medium ${medCount} · low ${lowCount}) — 펼쳐보기</summary>`
      + `<div style="margin-top:6px">${minorGroups.map(renderIssueGroup).join('')}</div>`
      + `</details>`;
  }
  return html;
}

const DECISION_LABEL = { approved: '승인됨', rejected: '거부됨', pending: '대기' };
function renderDiffs(diffs, opts) {
  if (!diffs.length) return '<div style="font-size:12px;color:#888">생성된 보정안이 없습니다</div>';
  const canAct = !!opts.actor;
  return diffs.map((d) => `
    <div class="review-plan ${esc(d.decision)}" data-plan="${esc(d.planId)}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b style="font-size:12px">${esc(d.planId)} <span style="color:#999;font-weight:400">→ ${esc((d.addressesIssues || []).join(', '))}</span></b>
        <span class="review-decision ${esc(d.decision)}">${esc(DECISION_LABEL[d.decision] || d.decision)}</span>
      </div>
      <div style="margin:6px 0">${d.ops.map((o) => `<span class="review-op ${esc(o.diffClass)}">${esc(opLabel(o.op))} @ ${esc(o.target)}${o.content ? ' — ' + esc(o.content) : ''}</span>`).join('')}</div>
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
    ${renderVerdict(vm)}
    <div class="review-banner warn">${esc(vm.nondeterministicNotice)}</div>
    ${renderNeed(vm.humanNeeded)}
    <div class="review-sec"><h4>거절이유 · 쟁점 (심사관별)</h4>${renderIssues(vm.issuesByAgent)}</div>
    <div class="review-sec"><h4>권장 보정안</h4>${renderDiffs(vm.diffs, opts)}</div>
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

/**
 * 리뷰 엔진 토글 상태(라이브). classic 트리거(Opinion.runReviewEngine)가 게이트로 사용(E-21).
 *  - module 인자가 있으면 마스터 AND 해당 모듈(B2). 없으면 마스터만(후방호환).
 * @param {string} [module]  'opinion'|'division'|'patent'
 */
export function isEnabled(module) { return isModuleEnabled(module); }

/**
 * 모듈 종료정책 노출(G3 — 비용·시간 사전고지용). classic 트리거가 capUsd/maxRounds 를
 * 프로필에서 읽어 confirm 문구를 구성한다(하드코딩 방지). 미등록 모듈 → null.
 * @param {string} module  'opinion'|'division'|'patent'
 * @returns {{capUsd:number, maxRounds:number, K:number, perIssueAttemptCap:number}|null}
 */
export function policy(module) {
  const entry = PROFILES[module];
  return (entry && entry.profile && entry.profile.terminationPolicy) || null;
}

/** 공유 결과 모달(2a) — 좁은 sticky 컬럼에서 빼서 넓은 단일 스크롤로(opinion/patent 공유). 마운트 타깃만 모달 바디로 이동(render 로직 불변). */
export function openModal(state, opts = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return null;
  const overlay = doc.getElementById('reviewResultModal');
  const mount = doc.getElementById('reviewModalMount');
  if (!overlay || !mount) return render(state, opts.fallbackMount || mount, opts); // 모달 DOM 없으면 폴백(후방호환)
  render(state, mount, opts);          // 모달 바디에 마운트 → .review-modal-body 가 단일 스크롤
  overlay.style.display = 'flex';
  return mount;
}
export function closeModal() {
  const doc = typeof document !== 'undefined' ? document : null;
  const overlay = doc && doc.getElementById('reviewResultModal');
  if (overlay) overlay.style.display = 'none';
}

/** 진행/안내 메시지를 공유 모달에 표시(B-T3 비동기 폴링 "검증 중…"). 결과 렌더(render)와 같은 .review-panel 스타일. */
export function openModalMessage(message) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;
  const overlay = doc.getElementById('reviewResultModal');
  const mount = doc.getElementById('reviewModalMount');
  if (mount) mount.innerHTML = `<div class="review-panel"><div class="review-banner warn">${esc(message)}</div></div>`;
  if (overlay) overlay.style.display = 'flex';
}

/** classic-script SPA 브리지: window.ReviewUI 노출. */
export const ReviewUI = { render, renderHTML, buildViewModel, GATE_DECISION, isEnabled, policy, openModal, closeModal, openModalMessage, subscribePolling };
if (typeof window !== 'undefined') window.ReviewUI = ReviewUI;

export default ReviewUI;
