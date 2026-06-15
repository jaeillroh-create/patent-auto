/**
 * review-engine/profiles/patent/adapter.js
 * ─────────────────────────────────────────────────────────────
 * patent.js 산출물 → 공통 ReviewState 매핑 — spec §3, §8.3, §8.4. 읽기전용(I-1).
 * patent.js 를 import 하지 않는다(디커플링). kernel/stateStore.createState 사용(공유 Core).
 *
 * 차등검증(§5): claim 번호 ≥ anchorStart → anchor(창작 구성), 그 미만 → general.
 * 자기검토 2단방어(§8.4): scopeCheckResults(+step_13/15)를 selfReviewLog 로 싣고,
 *   "자기검토 통과 구성요소(matched_to_scope)"를 moduleContext.selfReviewPassed 로 정규화 →
 *   consistency 가 중복판정을 거른다(통과항목은 새 거절관점에서만 재지적).
 * @module review-engine/profiles/patent/adapter
 */
import { createState } from '../../kernel/stateStore.js';
import { CLAIM_KIND, CLAIM_TYPE } from '../../contracts/stateSchema.js';

export const NOT_APPLICABLE = 'patent-not-applicable';

/** 청구항 텍스트에서 [{no, text}] 파싱(청구항 N / 제N항 패턴, 방어적). */
export function parseClaims(text) {
  if (!text) return [];
  const out = [];
  // 【청구항 N】 또는 "청구항 N" 또는 줄머리 "N." 분리
  const re = /(?:【\s*청구항\s*(\d+)\s*】|청구항\s*(\d+)\b)/g;
  const idxs = [];
  let m;
  while ((m = re.exec(text)) !== null) idxs.push({ no: parseInt(m[1] || m[2], 10), at: m.index });
  for (let i = 0; i < idxs.length; i++) {
    const start = idxs[i].at;
    const end = i + 1 < idxs.length ? idxs[i + 1].at : text.length;
    out.push({ no: idxs[i].no, text: text.slice(start, end).trim() });
  }
  return out;
}

/**
 * 선행기술 텍스트(step_04)에서 특허번호를 추출해 citedPrior[{id,label,summary}] 로 매핑(G7).
 * 번호만 매핑(summary=''): patent 선행기술 산출물은 번호 중심이며 요약이 빈약하다(E-02 변형 전제).
 * 지원 패턴: 제10-1234567호 / 10-2020-0012345 / KR(US) 10-XXXX / 등록·공개번호(하이픈/공백 허용).
 * @param {string} text  outputs.step_04
 * @returns {Array<{id:string,label:string,summary:string}>}  중복 제거, 등장 순서 보존.
 */
export function parseCitedPrior(text) {
  const s = String(text || '');
  if (!s) return [];
  // 제…호 우선, 없으면 10-자리군(출원/등록/공개번호) 패턴. 국가코드(KR/US) 접두 허용.
  const re = /(?:제\s*)?((?:KR|US)?\s*10[-\s]?\d{4}[-\s]?\d{5,7}|(?:제\s*)?10[-\s]?\d{6,7})\s*호?/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const label = m[0].trim().replace(/\s+/g, ' ');
    const norm = label.replace(/[^0-9]/g, ''); // 숫자만으로 동일성 판정(표기 변형 흡수)
    if (norm.length < 7 || seen.has(norm)) continue;
    seen.add(norm);
    out.push({ id: 'cited_' + out.length, label, summary: '' });
  }
  return out;
}

/** 종속항 판별: "제N항에 있어서/청구항 N에 있어서" 인용. */
function claimType(text) {
  return /(?:제\s*\d+\s*항|청구항\s*\d+)\s*에\s*있어서/.test(text || '') ? CLAIM_TYPE.DEPENDENT : CLAIM_TYPE.INDEPENDENT;
}

/** anchorStart 기준 kind 판정(§5). 번호 ≥ anchorStart(>0) → anchor. */
function classifyKind(no, anchorStart) {
  if (anchorStart && anchorStart > 0 && no >= anchorStart) return { kind: CLAIM_KIND.ANCHOR, anchorType: '부가' };
  return { kind: CLAIM_KIND.GENERAL, anchorType: null };
}

/**
 * 자기검토 통과 구성요소 정규화 (§8.4 중복판정 방지용).
 * scopeCheckResults[sid].matched_to_scope = 자기검토가 "scope에 매칭(통과)"으로 본 구성.
 * → { name, ground:'scope_coverage' } 집합. consistency 의 dedupe 기준.
 */
export function normalizeSelfReview(scopeCheckResults) {
  const passed = [];
  for (const sid of Object.keys(scopeCheckResults || {})) {
    const r = scopeCheckResults[sid] || {};
    for (const c of (r.matched_to_scope || [])) {
      passed.push({ name: c.name, ref: c.ref || null, ground: 'scope_coverage', sid });
    }
  }
  return passed;
}

/**
 * adaptSnapshot — ReviewProfile (1).
 * @param {Object} raw         Patent.exportSnapshot() 산출물(읽기전용 사본)
 * @param {Object} selfReview  patent 자기검토 로그(scopeCheckResults 등)
 * @param {{terminationPolicy?:Object, reviewId?:string, caseId?:string}} [opts]
 */
export function adaptSnapshot(raw, selfReview, opts = {}) {
  raw = raw || {};
  const outputs = raw.outputs || {};
  const caseId = opts.caseId || raw.caseId || '';
  const st = createState({
    reviewId: opts.reviewId || raw.reviewId || ('rev_pat_' + (caseId || 'patent')),
    caseId, module: 'patent', terminationPolicy: opts.terminationPolicy,
  });

  st.source.snapshot = raw;
  st.source.selfReviewLog = selfReview || raw.scopeCheckResults || null;

  // invention — patent 는 발명 내용 보유(미보유 아님)
  st.invention.title = outputs.step_01 || raw.inventionTitle || '';
  st.invention.field = outputs.step_02 || '';
  st.invention.problem = outputs.step_05 || '';
  st.invention.solution = outputs.step_17 || '';
  st.invention.keyComponents = [];

  // claims: 장치(step_06)+방법(step_10) 파싱, anchorStart 로 kind 판정(§5)
  const devClaims = parseClaims(outputs.step_06).map((c) => ({ c, anchorStart: raw.deviceAnchorStart }));
  const metClaims = parseClaims(outputs.step_10).map((c) => ({ c, anchorStart: raw.methodAnchorStart }));
  st.claims = devClaims.concat(metClaims).map(({ c, anchorStart }) => {
    const { kind, anchorType } = classifyKind(c.no, anchorStart);
    return {
      id: 'claim_' + c.no, no: c.no, type: claimType(c.text), kind, anchorType,
      text: c.text, status: 'draft', attempts: 0, history: [],
    };
  });

  // spec sections — 상세설명/부호의설명/요약서
  st.spec.sections = [
    { key: 'device_detail', text: String(outputs.step_08 || '') },
    { key: 'method_detail', text: String(outputs.step_12 || '') },
    { key: 'ref_signs', text: String(outputs.step_18 || '') },
    { key: 'abstract', text: String(outputs.step_19 || '') },
  ].filter((s) => s.text);

  // citedPrior — 선행기술. raw.citedPrior 우선(후방호환), 없으면 step_04(선행기술 검색 산출물)
  //   에서 특허번호를 정규식으로 추출해 번호만 매핑(G7). ⚠️ patent 선행기술은 번호 중심이라
  //   summary 는 비움('') — 내용 완전성은 후속(P-T3 실측) 결정(examiner_A 의 E-02 변형이 번호만으론
  //   high 단정을 막는다).
  st.citedPrior = (raw.citedPrior && raw.citedPrior.length) ? raw.citedPrior : parseCitedPrior(outputs.step_04);

  // figures — 도면(mermaid) ref 부호(3경로 정합 검증 소스)
  st.figures = [];

  st.moduleContext = {
    outputs: {
      step_06: outputs.step_06 || '', step_10: outputs.step_10 || '',
      step_07_mermaid: outputs.step_07_mermaid || '', step_11_mermaid: outputs.step_11_mermaid || '',
      step_08: outputs.step_08 || '', step_12: outputs.step_12 || '',
      step_18: outputs.step_18 || '', step_19: outputs.step_19 || '',
      step_13: outputs.step_13 || '', step_15: outputs.step_15 || '',
    },
    anchor: { deviceAnchorStart: raw.deviceAnchorStart, methodAnchorStart: raw.methodAnchorStart },
    selfReviewPassed: normalizeSelfReview(selfReview || raw.scopeCheckResults || {}),
    inventionScope: raw.inventionScope || null,
  };

  return st;
}

export default { adaptSnapshot, parseClaims, parseCitedPrior, classifyKind, normalizeSelfReview, NOT_APPLICABLE };
