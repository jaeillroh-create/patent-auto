/**
 * review-engine/profiles/division/adapter.js
 * ─────────────────────────────────────────────────────────────
 * division.js 산출물 → 공통 ReviewState 매핑 — spec §3, §8.2.
 * 읽기전용(I-1). division.js 를 import 하지 않는다(디커플링). kernel/stateStore.createState 사용(공유 Core).
 *
 * 차등검증(§8.2 변형): 분할 청구항의 추가 구성(D, added_components) = anchor '부가'(§47 신규사항 위험).
 *   basis(등록항)에서 그대로 온 구성 = general. → "원출원범위내구체화 vs 전략적확장 vs 범위이탈".
 * field/problem/solution: division 미보유 → 빈 문자열 + 'division-not-applicable' 표시(거짓 issue 방지).
 * @module review-engine/profiles/division/adapter
 */
import { createState } from '../../kernel/stateStore.js';
import { CLAIM_KIND, CLAIM_TYPE } from '../../contracts/stateSchema.js';

/** 이 모듈에서 미보유(결손 아님)임을 표시하는 마커. */
export const NOT_APPLICABLE = 'division-not-applicable';

/** claim_type 정규화. */
function claimType(t) {
  return t === 'dependent' ? CLAIM_TYPE.DEPENDENT : CLAIM_TYPE.INDEPENDENT;
}

/**
 * 분할 청구항 kind/anchorType 판정 (§8.2 차등검증 — adapter 소유).
 *  - added_components 존재(추가 구성 D) → anchor, anchorType='부가' (§47 위험↑)
 *  - 그 외(basis 보존만) → general
 * @param {?Object} dc divisionClaim
 * @returns {{kind:string, anchorType:?string}}
 */
export function classifyKind(dc) {
  if (dc && Array.isArray(dc.added_components) && dc.added_components.length > 0) {
    return { kind: CLAIM_KIND.ANCHOR, anchorType: '부가' };
  }
  return { kind: CLAIM_KIND.GENERAL, anchorType: null };
}

/**
 * adaptSnapshot — ReviewProfile (1).
 * @param {Object} raw         Division.exportSnapshot() 산출물(읽기전용 사본)
 * @param {Object} selfReview  division 자기검토 로그(runAutoVerify 결과 등, 없으면 null)
 * @param {{terminationPolicy?:Object, reviewId?:string, caseId?:string}} [opts]
 * @returns {import('../../contracts/stateSchema.js').ReviewState}
 */
export function adaptSnapshot(raw, selfReview, opts = {}) {
  raw = raw || {};
  const caseId = opts.caseId || raw.caseId || '';
  const st = createState({
    reviewId: opts.reviewId || raw.reviewId || ('rev_' + (caseId || 'division')),
    caseId,
    module: 'division',
    terminationPolicy: opts.terminationPolicy,
  });

  // source (I-1: raw 참조만)
  st.source.snapshot = raw;
  st.source.selfReviewLog = selfReview || raw.selfReview || null;

  // invention — division 미보유 표시(결손 아님)
  st.invention.title = raw.inventionTitle || '';
  st.invention.field = '';
  st.invention.problem = '';
  st.invention.solution = '';
  st.invention.notApplicable = { reason: NOT_APPLICABLE, fields: ['field', 'problem', 'solution'] };
  st.invention.keyComponents = [];

  // claims: 분할 청구항(divisionClaims)이 검증 대상. added_components/basis_preserved 보존.
  const divClaims = raw.divisionClaims || [];
  st.claims = divClaims.map((dc) => {
    const { kind, anchorType } = classifyKind(dc);
    return {
      id: 'claim_' + dc.claim_number,
      no: dc.claim_number,
      type: claimType(dc.claim_type),
      kind,
      anchorType,
      text: dc.claim_text || '',
      status: 'draft',
      attempts: 0,
      history: [],
      // division 특수(Core 불투명, consistency 가 읽음):
      addedComponents: dc.added_components || [],
      basisPreserved: dc.basis_preserved !== false, // 명시적 false 만 미보존
      parentClaim: dc.parent_claim_number != null ? ('claim_' + dc.parent_claim_number) : null,
    };
  });

  // spec — 원출원 명세서 단락
  const paras = raw.specParagraphs || [];
  st.spec.sections = raw.specFullText
    ? [{ key: 'spec', text: raw.specFullText }]
    : paras.map((p) => ({ key: String(p.paragraph_number || p.number || ''), text: String(p.content || '') }));

  // citedPrior — division 은 인용발명 대신 "원출원 청구항"이 이중특허 비교 기준
  st.citedPrior = (raw.originalClaims || []).map((c) => ({
    id: 'orig_' + c.claim_number,
    label: '원출원 청구항' + c.claim_number,
    summary: String(c.amended_text || c.original_text || '').slice(0, 200),
  }));

  // figures — division 부호정합 skip
  st.figures = [];

  // moduleContext — division 특수 슬롯(Core 불투명)
  st.moduleContext = {
    divisionType: raw.divisionType || null,
    originalClaims: raw.originalClaims || [],
    unusedComponents: raw.unusedComponents || [],
    divisionMatrix: raw.divisionMatrix || null,
    selfReview: selfReview || raw.selfReview || null,
  };

  return st;
}

export default { adaptSnapshot, classifyKind, NOT_APPLICABLE };
