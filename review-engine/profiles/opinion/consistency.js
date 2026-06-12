/**
 * review-engine/profiles/opinion/consistency.js
 * ─────────────────────────────────────────────────────────────
 * OpinionProfile 정합성 규칙 — spec §8.1. Profile이 소유(Core는 check를 호출만, I-6).
 *
 * ★ 책임 분리(확정): consistency는 **구조적 결함만** 검출한다.
 *   - "거절 미해소(구조)": rejection_reasons의 각 cited_refs에 대응하는 per_cited_ref_diff가
 *     부재/공백 → issue. (차별점이 실질적으로 거절을 해소하는지의 판단은 T4 examiner 영역 — 손대지 않음.)
 *   - "anchor 뒷받침(구조)": 부가/구체화(anchor) 보정 구성의 spec_basis 필드 부재 → issue.
 *     anchorType별 severity 차등(부가=high §47위험 / 구체화=medium).
 * 각 rule.check(state)→Violation[]. Violation은 kernel이 issue로 흡수(§2.1).
 * @module review-engine/profiles/opinion/consistency
 */

/** cited_ref 문자열에서 식별 번호 추출("인용문헌1"→1). 없으면 null. */
function refNo(s) {
  const m = String(s || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** per_cited_ref_diff 배열에서 주어진 cited_ref에 대응하는 항목 찾기(번호 우선, 제목 부분일치 폴백). */
function findDiff(diffs, citedRef) {
  const n = refNo(citedRef);
  for (const d of diffs) {
    if (n != null && String(d.ref_no) === String(n)) return d;
    if (d.ref_title && String(citedRef) && (d.ref_title.includes(String(citedRef)) || String(citedRef).includes(d.ref_title))) return d;
  }
  return null;
}

/**
 * [규칙 1] 거절 미해소(구조): 거절 청구항의 보정 부재, 또는 인용발명별 차별점(per_cited_ref_diff) 부재/공백.
 * @param {import('../../contracts/stateSchema.js').ReviewState} state
 * @returns {Array<Object>} Violation[]
 */
export function checkRejectionResolutionStructural(state) {
  const out = [];
  const mc = state.moduleContext || {};
  const reasons = (mc.notice && mc.notice.rejectionReasons) || [];
  const amendments = (mc.amendments && mc.amendments.amended_claims) || [];
  const amendedByNo = new Map(amendments.map((a) => [String(a.claim_no), a]));

  for (const reason of reasons) {
    const citedRefs = reason.cited_refs || [];
    for (const cno of (reason.claim_nos || [])) {
      const ac = amendedByNo.get(String(cno));
      if (!ac) {
        out.push({
          ruleId: 'opinion.rejection_unresolved_structural',
          type: '거절미해소', severity: 'high', target: ['claim_' + cno],
          legalBasis: reason.article || '', coreElement: `unresolved:${cno}:no_amendment`,
          description: `거절(${reason.article || ''}) 대상 청구항 ${cno}의 보정안이 없습니다(구조).`,
        });
        continue;
      }
      // §42 계열은 cited_refs 빈 배열(가짜 인용 금지) → 인용발명 차별점 검사 생략
      const diffs = ac.per_cited_ref_diff || [];
      for (const ref of citedRefs) {
        const d = findDiff(diffs, ref);
        if (!d || !String(d.difference || '').trim()) {
          out.push({
            ruleId: 'opinion.rejection_unresolved_structural',
            type: '거절미해소', severity: 'high', target: ['claim_' + cno],
            legalBasis: reason.article || '', coreElement: `unresolved:${cno}:${refNo(ref) ?? ref}`,
            description: `청구항 ${cno}의 인용발명 "${ref}" 대비 차별점(per_cited_ref_diff)이 부재/공백입니다(구조).`,
          });
        }
      }
    }
  }
  return out;
}

/**
 * [규칙 2] anchor 뒷받침(구조): 부가/구체화(anchor) 보정 구성의 spec_basis 필드 부재.
 *   anchorType 차등: 부가→high(신규사항§47 위험), 구체화→medium.
 * @param {import('../../contracts/stateSchema.js').ReviewState} state
 * @returns {Array<Object>} Violation[]
 */
export function checkAnchorSpecBasisStructural(state) {
  const out = [];
  const amendments = (state.moduleContext && state.moduleContext.amendments && state.moduleContext.amendments.amended_claims) || [];
  const amendedByNo = new Map(amendments.map((a) => [String(a.claim_no), a]));
  for (const claim of state.claims) {
    if (claim.kind !== 'anchor') continue;
    const ac = amendedByNo.get(String(claim.no));
    const basis = ac && ac.spec_basis;
    if (!basis || basis.length === 0) {
      const sev = claim.anchorType === '부가' ? 'high' : 'medium';
      out.push({
        ruleId: 'opinion.anchor_spec_basis_structural',
        type: '신규사항', severity: sev, target: [claim.id],
        legalBasis: '§47', coreElement: `anchor_basis:${claim.no}:${claim.anchorType || ''}`,
        description: `보정(${claim.anchorType || 'anchor'}) 구성의 명세서 뒷받침 근거(spec_basis)가 없습니다(구조). ${claim.anchorType === '부가' ? '신규사항(§47) 위험.' : ''}`,
      });
    }
  }
  return out;
}

/**
 * OpinionProfile.consistencyRules — ReviewProfile (4). 각 {id, scope, check(state)→Violation[]}.
 * @type {Array<{id:string, scope:string, check:(state:Object)=>Array<Object>}>}
 */
export const consistencyRules = [
  { id: 'opinion.rejection_unresolved_structural', scope: 'amendments↔notice', check: checkRejectionResolutionStructural },
  { id: 'opinion.anchor_spec_basis_structural', scope: 'amendments↔spec', check: checkAnchorSpecBasisStructural },
];

export default { consistencyRules, checkRejectionResolutionStructural, checkAnchorSpecBasisStructural };
