/**
 * review-engine/profiles/division/consistency.js
 * ─────────────────────────────────────────────────────────────
 * DivisionProfile 정합성 규칙 — spec §8.2. Profile이 소유(Core는 check 호출만, I-6).
 *
 * ★ division 절대 제약 = §47 신규사항 금지. 구조적(코드) 검출 3종:
 *   (1) 신규사항추가: 분할항 추가구성(D)의 원출원 명세서 근거(spec_source_text) 부재 → §47 high
 *   (2) 이중특허: 분할항 ↔ 원출원 청구항 LCS 유사도 95%+ → 이중특허 high (image 19 이중특허)
 *   (3) 원출원범위이탈: basisPreserved=false → §47 원출원범위이탈 high (image 19 basis보존)
 *
 * ★ opinion B↔C 경계의 division 변형:
 *   opinion B="뒷받침 있느냐(§42④)" + C="범위 넘었느냐(§47)" → division 은 §47 한 축으로 수렴.
 *   "원출원에 뒷받침되는 정당한 구체화(spec_source_text 존재)" vs "금지된 신규사항(부재/범위이탈)".
 *
 * 각 rule.check(state)→Violation[]. Violation은 kernel이 issue로 흡수(§2.1).
 * @module review-engine/profiles/division/consistency
 */

/** 토큰 LCS 길이(division.js _lcsTokens 동형, 순수). */
function lcsLen(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  const dp = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/** 토큰 LCS 유사도(0~1) — division.js _lcsRatio 동형(순수). */
export function lcsRatio(a, b) {
  if (!a || !b) return 0;
  const tokA = String(a).replace(/[^가-힣a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const tokB = String(b).replace(/[^가-힣a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  if (!tokA.length || !tokB.length) return 0;
  return lcsLen(tokA, tokB) / Math.max(tokA.length, tokB.length);
}

/**
 * [규칙 1] 신규사항추가(§47): 분할항 추가구성(D)의 원출원 명세서 근거 부재.
 * anchorType='부가' 구성 중 spec_source_text(또는 paragraph_number) 부재 → 신규사항.
 */
export function checkNewMatterStructural(state) {
  const out = [];
  for (const claim of state.claims) {
    if (claim.kind !== 'anchor') continue;
    for (const comp of (claim.addedComponents || [])) {
      const hasBasis = !!(comp.spec_source_text && String(comp.spec_source_text).trim())
        || !!(comp.paragraph_number && String(comp.paragraph_number).trim());
      if (!hasBasis) {
        out.push({
          ruleId: 'division.new_matter_structural',
          type: '신규사항추가', severity: 'high', target: [claim.id],
          legalBasis: '§47', coreElement: `new_matter:${claim.no}:${(comp.content || '').slice(0, 16)}`,
          description: `분할 청구항 ${claim.no}의 추가 구성 "${(comp.content || '').slice(0, 24)}"이 원출원 명세서 근거(spec_source_text/단락번호) 없이 부가되었습니다(신규사항 §47).`,
        });
      }
    }
  }
  return out;
}

/**
 * [규칙 2] 이중특허: 분할항 ↔ 원출원 청구항 LCS 유사도 ≥ 0.95.
 */
export function checkDoublePatentingStructural(state) {
  const out = [];
  const originals = (state.moduleContext && state.moduleContext.originalClaims) || [];
  for (const claim of state.claims) {
    for (const oc of originals) {
      const ocText = oc.amended_text || oc.original_text || '';
      const sim = lcsRatio(claim.text, ocText);
      if (sim >= 0.95) {
        out.push({
          ruleId: 'division.double_patenting_structural',
          type: '이중특허', severity: 'high', target: [claim.id],
          legalBasis: '이중특허', coreElement: `double:${claim.no}:${oc.claim_number}`,
          description: `분할 청구항 ${claim.no}이 원출원 청구항 ${oc.claim_number}과 ${Math.round(sim * 100)}% 동일(이중특허 위험). 추가 구성(D)의 차별화가 불충분합니다.`,
        });
        break; // claim당 1건
      }
    }
  }
  return out;
}

/**
 * [규칙 3] 원출원범위이탈(§47): basisPreserved=false.
 */
export function checkBasisScopeStructural(state) {
  const out = [];
  for (const claim of state.claims) {
    if (claim.basisPreserved === false) {
      out.push({
        ruleId: 'division.basis_scope_structural',
        type: '원출원범위이탈', severity: 'high', target: [claim.id],
        legalBasis: '§47', coreElement: `basis_scope:${claim.no}`,
        description: `분할 청구항 ${claim.no}이 등록결정 구성(basis)을 보존하지 못해 원출원 범위를 이탈했습니다(§47 보정범위이탈).`,
      });
    }
  }
  return out;
}

/**
 * DivisionProfile.consistencyRules — ReviewProfile (4).
 * @type {Array<{id:string, scope:string, check:(state:Object)=>Array<Object>}>}
 */
export const consistencyRules = [
  { id: 'division.new_matter_structural', scope: 'divisionClaims↔spec', check: checkNewMatterStructural },
  { id: 'division.double_patenting_structural', scope: 'divisionClaims↔original', check: checkDoublePatentingStructural },
  { id: 'division.basis_scope_structural', scope: 'divisionClaims↔original', check: checkBasisScopeStructural },
];

export default { consistencyRules, checkNewMatterStructural, checkDoublePatentingStructural, checkBasisScopeStructural, lcsRatio };
