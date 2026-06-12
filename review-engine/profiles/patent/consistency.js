/**
 * review-engine/profiles/patent/consistency.js
 * ─────────────────────────────────────────────────────────────
 * PatentProfile 정합성 규칙 — spec §8.3, §5.2, §8.4, E-11. Profile이 소유(Core는 호출만, I-6).
 *
 * 규칙 3종(구조):
 *  (1) checkAnchorSupportStructural — §5.2 앵커 1차 관문: anchor 청구항 구성요소가
 *      상세설명(step_08/12)에 뒷받침 부재 → high 기재불비. ground='spec_support'(새 거절관점).
 *  (2) checkRenderConsistencyStructural — E-11: 도면(mermaid) 부호 ↔ 부호의 설명(step_18) 불일치
 *      → 렌더회귀. ground='render'. (SVG/PPTX/Canvas 공유 소스 정합의 구조 대리검증)
 *  (3) checkScopeCoverageStructural — 범위 커버리지. ground='scope_coverage'.
 *      ★ 자기검토 2단방어(§8.4): 자기검토가 이미 판정한(통과) 구성요소는 dedupe 로 제외
 *        → 중복판정 0(통과항목은 새 거절관점에서만 재지적).
 * @module review-engine/profiles/patent/consistency
 */

/** 텍스트에서 도면부호(숫자) 집합 추출. (N) 또는 "N:" 패턴. */
export function extractRefNums(text) {
  const set = new Set();
  const s = String(text || '');
  let m;
  const p1 = /\((\d{2,4})\)/g;        // 도면/상세설명: (100)
  const p2 = /(?:^|\n)\s*(\d{2,4})\s*[:：]/g; // 부호의 설명: 100: 장치
  while ((m = p1.exec(s)) !== null) set.add(m[1]);
  while ((m = p2.exec(s)) !== null) set.add(m[1]);
  return set;
}

/** 청구항 텍스트에서 구성요소명 추출(~부/모듈/수단/유닛/엔진/장치/회로/센서). */
export function extractClaimElements(text) {
  const s = String(text || '');
  const re = /([가-힣A-Za-z0-9]{2,}(?:부|모듈|수단|유닛|엔진|회로|센서|프로세서))/g;
  const out = new Set();
  let m;
  while ((m = re.exec(s)) !== null) out.add(m[1]);
  return [...out];
}

/** §8.4 중복판정 방지: (name, ground)가 자기검토에서 이미 판정(통과)됐는가. */
export function isSelfReviewAdjudicated(name, ground, state) {
  const passed = (state.moduleContext && state.moduleContext.selfReviewPassed) || [];
  return passed.some((p) => p.ground === ground && p.name && name && (p.name === name || String(name).includes(p.name) || String(p.name).includes(name)));
}

/** [규칙 1] §5.2 앵커 1차 관문 — anchor 청구항 구성요소의 상세설명 뒷받침 부재. */
export function checkAnchorSupportStructural(state) {
  const out = [];
  const mc = state.moduleContext || {};
  const detail = String((mc.outputs && (mc.outputs.step_08 + '\n' + mc.outputs.step_12)) || '');
  for (const claim of state.claims) {
    if (claim.kind !== 'anchor') continue;
    for (const el of extractClaimElements(claim.text)) {
      if (detail.indexOf(el) < 0) {
        out.push({
          ruleId: 'patent.anchor_support_structural', selfReviewGround: 'spec_support',
          type: '기재불비', severity: 'high', target: [claim.id],
          legalBasis: '§42④', coreElement: `anchor_support:${claim.no}:${el}`,
          description: `앵커 청구항 ${claim.no}의 구성요소 "${el}"이 상세설명(발명의 설명)에 뒷받침되지 않습니다(§5.2 앵커 1차 관문, §42④ 기재불비).`,
        });
      }
    }
  }
  return out;
}

/** [규칙 2] E-11 렌더 정합(구조) — 도면 부호 ⊄ 부호의 설명. */
export function checkRenderConsistencyStructural(state) {
  const out = [];
  const mc = state.moduleContext || {};
  const o = mc.outputs || {};
  const diagramRefs = new Set([...extractRefNums(o.step_07_mermaid), ...extractRefNums(o.step_11_mermaid)]);
  const signRefs = extractRefNums(o.step_18);
  const missing = [...diagramRefs].filter((r) => !signRefs.has(r));
  if (missing.length) {
    out.push({
      ruleId: 'patent.render_consistency_structural', selfReviewGround: 'render',
      type: '명확성', severity: 'high', target: ['figures'],
      legalBasis: '§42(도면정합)', coreElement: `render:${missing.slice(0, 5).join(',')}`,
      description: `도면에 표시된 부호 ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' 외' : ''}가 부호의 설명(step_18)에 없습니다(3경로 렌더 정합 위반, E-11).`,
    });
  }
  return out;
}

/** [규칙 3] 범위 커버리지(구조) + ★ 자기검토 dedupe(중복판정 금지, §8.4). */
export function checkScopeCoverageStructural(state) {
  const out = [];
  const mc = state.moduleContext || {};
  const scope = mc.inventionScope || null;
  if (!scope || !scope.baseline) return out; // scope 미잠금 → 검사 skip(E-13 류)
  const o = mc.outputs || {};
  const diagramRefsText = String(o.step_07_mermaid || '');
  // 도면 노드명 중 scope baseline 에 없는 것(novel) 후보 → 단, 자기검토가 통과시킨 것은 제외(dedupe)
  const baselineNames = (scope.baseline.components || []).map((c) => c.name || c);
  const nodeNames = [...diagramRefsText.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].replace(/\(\d+\)/g, '').trim());
  for (const name of new Set(nodeNames)) {
    if (baselineNames.some((b) => name.includes(b) || b.includes(name))) continue; // baseline 내
    if (isSelfReviewAdjudicated(name, 'scope_coverage', state)) continue; // ★ 자기검토 통과 → 중복판정 금지
    out.push({
      ruleId: 'patent.scope_coverage_structural', selfReviewGround: 'scope_coverage',
      type: '신규성', severity: 'medium', target: ['figures'],
      legalBasis: '범위', coreElement: `scope:${name}`,
      description: `도면 구성 "${name}"이 발명 범위(baseline)에 없고 자기검토에서도 판정되지 않았습니다(범위 외 신규 구성).`,
    });
  }
  return out;
}

/**
 * PatentProfile.consistencyRules — ReviewProfile (4).
 * @type {Array<{id:string, scope:string, check:(state:Object)=>Array<Object>}>}
 */
export const consistencyRules = [
  { id: 'patent.anchor_support_structural', scope: 'claims↔detail', check: checkAnchorSupportStructural },
  { id: 'patent.render_consistency_structural', scope: 'figures↔refSigns', check: checkRenderConsistencyStructural },
  { id: 'patent.scope_coverage_structural', scope: 'figures↔scope', check: checkScopeCoverageStructural },
];

export default {
  consistencyRules, checkAnchorSupportStructural, checkRenderConsistencyStructural, checkScopeCoverageStructural,
  extractRefNums, extractClaimElements, isSelfReviewAdjudicated,
};
