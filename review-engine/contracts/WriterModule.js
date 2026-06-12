/**
 * review-engine/contracts/WriterModule.js
 * ─────────────────────────────────────────────────────────────
 * 작성 모듈 연동 계약 (WriterModule) — spec §10.
 * T0 범위: JSDoc 인터페이스(계약)만. **구현 없음. 작성 모듈(opinion/division/patent.js) 미수정.**
 *
 * 불변식:
 *  - I-1: exportSnapshot은 작성 모듈 원본을 변형하지 않는 "읽기전용 복사본"을 반환한다.
 *  - I-2: applyAmendments는 사람 승인(Human Gate) 또는 simulate(롤백 보장) 경로로만 호출된다.
 *  - 실제 텍스트 수술·정합성·3경로 렌더 재검증 책임은 작성 모듈에 있다(spec §7.2).
 *
 * @module review-engine/contracts/WriterModule
 */

/**
 * @typedef {Object} WriterSnapshot
 * @property {*} snapshot           작성모듈 산출물(읽기전용 복사본)
 * @property {*} selfReviewLog      작성모듈 자기검토 로그(없으면 null → E-03 폴백)
 * @property {Array<{id:string, kind:'general'|'anchor'|'unknown'}>} claimsWithKind  차등검증 키
 *
 * @typedef {Object} ConsistencyResult
 * @property {boolean} claimSpecOk   청구항↔상세설명 정합
 * @property {boolean} refSignOk     도면부호 정합
 * @property {boolean} abstractOk    요약서 정합
 *
 * @typedef {Object} RenderCheck      3경로 하드제약 (E-11)
 * @property {boolean} svg
 * @property {boolean} pptx
 * @property {boolean} canvas
 *
 * @typedef {Object} ApplyResult
 * @property {Array<string>} applied      반영된 patchPlan id
 * @property {Array<string>} rejected     거부된 patchPlan id
 * @property {ConsistencyResult} consistency
 * @property {RenderCheck} renderCheck
 * @property {string} [txnId]             simulate/실패 복구용 트랜잭션 id
 *
 * @typedef {Object} WriterModule
 * @property {(caseId:string)=>WriterSnapshot} exportSnapshot
 *   작성모듈 현재 상태를 읽기전용 복사본으로 노출 (I-1). 원본 변형 금지.
 * @property {(caseId:string, plans:Array<import('./stateSchema.js').PatchPlan>, opts:{simulate:boolean})=>ApplyResult} applyAmendments
 *   승인분 보정 반영 또는 simulate. 작성모듈이 정합성·3경로 재검증 결과를 회신(spec §7.1⑤).
 *   사람 승인 없는 자동 반영 금지 (I-2).
 * @property {(caseId:string, txnId:string)=>{ok:boolean}} rollback
 *   simulate 또는 반영 실패 복구. 실패 시 전체 ESCALATE+상태 동결 (E-27).
 */

/**
 * WriterModule 계약 메서드 목록 (계약 적합성 검증·DoD 증명용).
 * @type {ReadonlyArray<string>}
 */
export const WRITER_MODULE_METHODS = Object.freeze(['exportSnapshot', 'applyAmendments', 'rollback']);

export const __contractOnly = true;
