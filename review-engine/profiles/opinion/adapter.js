/**
 * review-engine/profiles/opinion/adapter.js
 * ─────────────────────────────────────────────────────────────
 * opinion.js 산출물(WriterSnapshot) → 공통 ReviewState 매핑 — spec §3, §8.1.
 * 읽기전용: 입력 raw를 변형하지 않는다(I-1). opinion.js를 import하지 않는다(디커플링).
 * kernel/stateStore.createState로 골격을 만들고(읽기전용 사용, kernel 미수정) 필드를 채운다.
 *
 * 차등검증(§8.1): 보정으로 "부가/구체화"된 구성 = anchor. 부가/구체화를 anchorType로 구분 보존
 *   (부가=신규사항§47 위험↑, 구체화=상대 안전 → 검증강도 차등은 consistency/scorer가 사용).
 * field/problem/solution: opinion 미보유 → 빈 문자열 + 'opinion-not-applicable' 표시
 *   (T3 에이전트가 "분야 누락" 류 거짓 issue를 만들지 않도록, E-29).
 * @module review-engine/profiles/opinion/adapter
 */
import { createState } from '../../kernel/stateStore.js';
import { CLAIM_KIND, CLAIM_TYPE } from '../../contracts/stateSchema.js';

/** 이 모듈에서 미보유(결손 아님)임을 표시하는 마커. */
export const NOT_APPLICABLE = 'opinion-not-applicable';

/** 종속항 판별(휴리스틱): "제N항에 있어서/청구항 N에 있어서" 인용 → dependent. */
function claimType(text) {
  return /(?:제\s*\d+\s*항|청구항\s*\d+)\s*에\s*있어서/.test(text || '') ? CLAIM_TYPE.DEPENDENT : CLAIM_TYPE.INDEPENDENT;
}

/**
 * 보정 방법으로 kind/anchorType 판정 (§8.1 차등검증 — adapter가 소유).
 *  - 부가(새 구성요소 추가) → anchor, anchorType='부가' (§47 위험↑, 우선 보존)
 *  - 구체화(기존 구성 한정 부가) → anchor, anchorType='구체화'
 *  - 그 외(한정만/미보정) → general
 * @param {?Object} amendedClaim draftResult.amended_claims 항목
 * @returns {{kind:string, anchorType:?string}}
 */
export function classifyKind(amendedClaim) {
  if (!amendedClaim) return { kind: CLAIM_KIND.GENERAL, anchorType: null };
  const methods = (amendedClaim.amendment_methods || []).map((m) => m && m.method);
  if (methods.includes('부가')) return { kind: CLAIM_KIND.ANCHOR, anchorType: '부가' };
  if (methods.includes('구체화')) return { kind: CLAIM_KIND.ANCHOR, anchorType: '구체화' };
  return { kind: CLAIM_KIND.GENERAL, anchorType: null };
}

/**
 * adaptSnapshot — ReviewProfile (1).
 * @param {Object} raw          WriterSnapshot.snapshot (Opinion.state 형상의 읽기전용 사본)
 * @param {Object} selfReview   WriterSnapshot.selfReviewLog (opinion 4중 뒷받침 validation)
 * @param {{terminationPolicy?:Object, reviewId?:string, caseId?:string}} [opts]
 * @returns {import('../../contracts/stateSchema.js').ReviewState}
 */
export function adaptSnapshot(raw, selfReview, opts = {}) {
  raw = raw || {};
  const parsed = raw.parsed || {};
  const typeResult = raw.typeResult || {};
  const draft = raw.draftResult || {};
  const validation = selfReview || raw.validation || null;

  const caseId = opts.caseId || raw.caseId || parsed.application_no || '';
  const st = createState({
    reviewId: opts.reviewId || raw.reviewId || ('rev_' + (caseId || 'unknown')),
    caseId,
    module: 'opinion',
    terminationPolicy: opts.terminationPolicy,
  });

  // source (I-1: raw 참조만, 변형 없음)
  st.source.snapshot = raw;
  st.source.selfReviewLog = validation;

  // invention — opinion 미보유 표시(결손 아님)
  st.invention.title = parsed.invention_title || '';
  st.invention.field = '';
  st.invention.problem = '';
  st.invention.solution = '';
  st.invention.notApplicable = { reason: NOT_APPLICABLE, fields: ['field', 'problem', 'solution'] };
  st.invention.keyComponents = [];

  // claims: parsed.claims(원본) + draft.amended_claims(보정후) 병합
  const amendedByNo = new Map();
  for (const ac of (draft.amended_claims || [])) amendedByNo.set(String(ac.claim_no), ac);
  const rejectedSet = new Set((typeResult.claim_summary && typeResult.claim_summary.rejected_claims || []).map(String));
  st.claims = (parsed.claims || []).map((c) => {
    const ac = amendedByNo.get(String(c.no));
    const { kind, anchorType } = classifyKind(ac);
    const text = ac ? (ac.amended || c.text) : c.text;
    return {
      id: 'claim_' + c.no,
      no: c.no,
      type: claimType(text),
      kind,
      anchorType,                                  // '부가'|'구체화'|null (anchor일 때만)
      text,
      status: rejectedSet.has(String(c.no)) ? 'rejected' : 'allowable',
      attempts: 0,
      history: [],
    };
  });

  // spec sections — 명세서 원문
  st.spec.sections = raw.refText ? [{ key: 'spec', text: raw.refText }] : [];

  // citedPrior — 인용발명
  st.citedPrior = (parsed.cited_references || []).map((r) => ({
    id: 'ref_' + r.ref_no,
    label: r.title || ('인용문헌' + r.ref_no),
    summary: r.publication_no || '',
  }));

  // figures — opinion 미보유(부호정합 skip, E-13)
  st.figures = [];

  // moduleContext — opinion 특수 슬롯(Core 불투명 취급)
  st.moduleContext = {
    notice: {
      application_no: parsed.application_no || '',
      applicant: parsed.applicant || '',
      rejectionReasons: parsed.rejection_reasons || [],
    },
    rejectionType: { primary: typeResult.primary_type || null, secondary: typeResult.secondary_type || null },
    analysis: raw.analysis || null,
    amendments: draft || null,
    validation,
  };

  return st;
}

export default { adaptSnapshot, classifyKind, NOT_APPLICABLE };
