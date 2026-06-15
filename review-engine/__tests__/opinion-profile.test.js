/**
 * review-engine/__tests__/opinion-profile.test.js
 * T2 DoD 테스트 (ESM, 결정적). 실행: node review-engine/__tests__/opinion-profile.test.js
 *  - OpinionProfile 8멤버 계약 적합성
 *  - adapter 무손실 매핑
 *  - consistency "거절 미해소(구조)" 검출
 *  - kernel(unchanged) ↔ OpinionProfile 통합(동일 kernel 사용 — I-6 실증)
 */
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';
import { adaptSnapshot, classifyKind, NOT_APPLICABLE } from '../profiles/opinion/adapter.js';
import { checkRejectionResolutionStructural, checkAnchorSpecBasisStructural } from '../profiles/opinion/consistency.js';
import { REVIEW_PROFILE_REQUIRED_KEYS } from '../contracts/ReviewProfile.js';
import { PHASE } from '../contracts/stateSchema.js';
import * as orchestrator from '../kernel/orchestrator.js';
import * as compiler from '../kernel/amendmentCompiler.js';

let pass = 0, fail = 0; const fails = [];
function ok(c, n) { if (c) pass++; else { fail++; fails.push('✗ ' + n); } }
function eq(a, b, n) { ok(JSON.stringify(a) === JSON.stringify(b), `${n} (a=${JSON.stringify(a)} b=${JSON.stringify(b)})`); }

// ── 샘플 스냅샷 (Opinion.state 형상) ──
const snap = {
  caseId: '10-2024-0001',
  parsed: {
    application_no: '10-2024-0001', applicant: '디딤', invention_title: 'AI 기반 소음 저감 장치',
    rejection_reasons: [
      { claim_nos: [1], article: '§29②', reason: '진보성 위반', cited_refs: ['인용문헌1', '인용문헌2'] },
      { claim_nos: [2], article: '§42④ 2호', reason: '뒷받침 흠결', cited_refs: [] },
    ],
    cited_references: [{ ref_no: 1, title: '소음 저감 종래기술', publication_no: 'KR-A' }, { ref_no: 2, title: '필터링 기법', publication_no: 'US-B' }],
    claims: [{ no: 1, text: 'A를 포함하는 장치.' }, { no: 2, text: '제1항에 있어서, B를 더 포함하는 장치.' }],
  },
  typeResult: { primary_type: 'inventive_step', confidence: 0.85, secondary_type: null, claim_summary: { total_claims: 2, rejected_claims: [1, 2], no_rejection_claims: [] } },
  analysis: { discussion: [], rejected_claims: [{ claim_no: 1, reason: '진보성' }] },
  draftResult: {
    amended_claims: [
      {
        claim_no: 1, original: 'A를 포함하는 장치.', amended: 'A 및 가중 보정부를 포함하는 장치.',
        amendment_methods: [{ method: '부가', target: '가중 보정부', spec_paragraph: '【0035】', description: '가중 보정부 추가' }],
        spec_basis: ['【0035】'],
        per_cited_ref_diff: [
          { ref_no: 1, ref_title: '소음 저감 종래기술', difference: '실시간 가중 보정 부재' },
          { ref_no: 2, ref_title: '필터링 기법', difference: '' }, // 공백 → 거절미해소(구조)
        ],
      },
    ],
    unchanged_claims: [2], strategy_name: '한정보정',
    validation: { summary: { total: 1, pass: 1, warn: 0, fail: 0 }, elements: [] },
  },
  refText: '【0035】 가중 보정부는 입력 소음에 가중치를 적용하여 보정한다.',
  validation: { summary: { total: 1, pass: 1, warn: 0, fail: 0 }, elements: [{ element_no: 1, element_text: '가중 보정부', checks: [{ check_type: 'term_existence', result: 'pass', detail: '명세서 존재' }], overall_result: 'pass' }] },
};

// ════ A. 계약 적합성 (8멤버) ════
const P = OpinionProfile;
for (const k of REVIEW_PROFILE_REQUIRED_KEYS) ok(k in P, `A: 멤버 존재 ${k}`);
ok(P.module === 'opinion', 'A: module="opinion"');
ok(typeof P.adaptSnapshot === 'function', 'A: adaptSnapshot 함수');
['agents', 'issueCatalog', 'consistencyRules', 'amendmentOps', 'rippleRules'].forEach((k) => ok(Array.isArray(P[k]), `A: ${k} 배열`));
['scoreWeights', 'terminationPolicy', 'writer'].forEach((k) => ok(P[k] && typeof P[k] === 'object', `A: ${k} 객체`));
['exportSnapshot', 'applyAmendments', 'rollback'].forEach((m) => ok(typeof P.writer[m] === 'function', `A: writer.${m} 함수(계약)`));
ok(P.issueCatalog.every((d) => typeof d.severityRule === 'function'), 'A: issueCatalog severityRule 전부 함수(Profile 소유)');
ok(P.consistencyRules.every((r) => typeof r.check === 'function'), 'A: consistencyRules check 전부 함수(Profile 소유)');
ok(P.terminationPolicy.capUsd === 5, 'A: capUsd=$5 (opinion §13)');
// severityRule 차등(부가→high)
eq(P.issueCatalog.find((d) => d.type === '신규사항').severityRule({ claim: { anchorType: '부가' } }), 'high', 'A: 신규사항 부가→high');
eq(P.issueCatalog.find((d) => d.type === '신규사항').severityRule({ claim: { anchorType: '구체화' } }), 'medium', 'A: 신규사항 구체화→medium');

// ════ B. adapter 무손실 매핑 ════
const st = adaptSnapshot(snap, snap.validation, { terminationPolicy: P.terminationPolicy });
eq(st.module, 'opinion', 'B: module 매핑');
eq(st.caseId, '10-2024-0001', 'B: caseId 매핑');
eq(st.invention.title, 'AI 기반 소음 저감 장치', 'B: invention.title 매핑');
eq(st.invention.field, '', 'B: field 빈 문자열');
eq(st.invention.notApplicable.reason, NOT_APPLICABLE, 'B: opinion-not-applicable 표시');
eq(st.claims.length, 2, 'B: claims 2건');
const c1 = st.claims.find((c) => c.no === 1), c2 = st.claims.find((c) => c.no === 2);
eq(c1.kind, 'anchor', 'B: claim1 보정(부가) → anchor');
eq(c1.anchorType, '부가', 'B: claim1 anchorType=부가 보존');
eq(c1.text, 'A 및 가중 보정부를 포함하는 장치.', 'B: claim1 보정후 text');
eq(c1.type, 'independent', 'B: claim1 independent');
eq(c1.status, 'rejected', 'B: claim1 rejected');
eq(c2.kind, 'general', 'B: claim2 미보정 → general');
eq(c2.type, 'dependent', 'B: claim2 dependent(인용)');
ok(st.spec.sections[0].text.includes('【0035】'), 'B: spec.sections 명세서 매핑');
eq(st.citedPrior.length, 2, 'B: citedPrior 2건');
eq(st.citedPrior[0].label, '소음 저감 종래기술', 'B: citedPrior label');
eq(st.figures.length, 0, 'B: figures 빈 배열(opinion 미보유)');
eq(st.moduleContext.notice.rejectionReasons.length, 2, 'B: moduleContext.notice 매핑');
eq(st.moduleContext.rejectionType.primary, 'inventive_step', 'B: rejectionType 매핑');
ok(st.moduleContext.amendments && st.moduleContext.validation, 'B: amendments/validation 매핑');
// 원본 불변(I-1)
eq(snap.parsed.claims[0].text, 'A를 포함하는 장치.', 'B: 원본 raw 불변(I-1)');
// classifyKind 단위
eq(classifyKind({ amendment_methods: [{ method: '구체화' }] }), { kind: 'anchor', anchorType: '구체화' }, 'B: classifyKind 구체화→anchor');
eq(classifyKind({ amendment_methods: [{ method: '한정' }] }), { kind: 'general', anchorType: null }, 'B: classifyKind 한정→general');

// ════ C. consistency 구조적 검출 ════
const v1 = checkRejectionResolutionStructural(st);
ok(v1.length >= 2, `C: 거절 미해소(구조) 검출 (${v1.length}건)`);
ok(v1.some((v) => v.coreElement === 'unresolved:1:2' && v.type === '거절미해소'), 'C: claim1 인용문헌2 차별점 공백 → issue');
ok(v1.some((v) => v.coreElement === 'unresolved:2:no_amendment'), 'C: claim2 보정안 부재 → issue');
ok(v1.every((v) => v.severity === 'high'), 'C: 거절미해소 severity=high');
// anchor 뒷받침: 이 샘플은 spec_basis 존재 → 위반 0
eq(checkAnchorSpecBasisStructural(st).length, 0, 'C: anchor spec_basis 존재 → 위반 0');
// anchor 뒷받침 부재 시나리오(부가→high)
const snap2 = JSON.parse(JSON.stringify(snap));
snap2.draftResult.amended_claims[0].spec_basis = [];
const st2 = adaptSnapshot(snap2, snap2.validation);
const v2 = checkAnchorSpecBasisStructural(st2);
ok(v2.length === 1 && v2[0].severity === 'high' && v2[0].legalBasis === '§47', 'C: 부가 anchor spec_basis 부재 → high(§47)');

// ════ D. kernel(unchanged) ↔ OpinionProfile 통합 (I-6 실증) ════
(async function () {
  compiler._resetSeq();
  // writer는 T6 미연동(throw)이므로 통합 테스트용 mock writer 주입(프로파일 클론).
  const mockWriter = {
    applyAmendments: async (_c, plans) => ({ applied: plans.map((p) => p.id), rejected: [], consistency: { claimSpecOk: true, refSignOk: true, abstractOk: true }, renderCheck: { svg: true, pptx: true, canvas: true }, txnId: 'tx' }),
    rollback: async () => ({ ok: true }),
  };
  // 엔진 다라운드 능력 검증(I-6) — 프로덕션 임시 throttle(opinion maxRounds=1, discover-only)과 분리해 full policy 주입.
  const profile = { ...OpinionProfile, writer: mockWriter, terminationPolicy: { K: 1, maxRounds: 12, capUsd: 5, perIssueAttemptCap: 2 } };
  const state = adaptSnapshot(snap, snap.validation, { terminationPolicy: profile.terminationPolicy });
  // mock 에이전트: discover 1개 high issue(청구항1) → recheck resolved, consensus true
  const ALL = { examiner: true, attorney: true, expert: true };
  const runAgent = async ({ mode, issue }) => {
    if (mode === 'discover') return { issues: [{ id: 'i1', type: '거절미해소', severity: 'high', target: ['claim_1'], legalBasis: '§29②', description: 'd', coreElement: 'i1', suggestedOp: 'add_limitation', status: 'open', occurrences: 1 }], consensus: ALL, cost: 0.01 };
    return { verdicts: [{ issueId: issue.id, result: 'resolved' }], consensus: ALL, cost: 0.01 };
  };
  const res = await orchestrator.run(profile, state, { runAgent });
  ok(res.phase === PHASE.CONVERGED, 'D: 동일 kernel + OpinionProfile → CONVERGED (I-6 실증)');
  ok(res.budget.roundsUsed <= profile.terminationPolicy.maxRounds, 'D: 유한 종료');
  ok(res.patchPlans.length >= 1 && res.patchPlans[0].ops.every((o) => OpinionProfile.amendmentOps.some((a) => a.op === o.op)), 'D: compiler가 OpinionProfile.amendmentOps만 사용');

  console.log('='.repeat(54));
  console.log(`review-engine T2 OpinionProfile 테스트: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail})`);
  console.log('='.repeat(54));
  if (fails.length) { console.log('\n[실패]'); fails.forEach((f) => console.log(f)); }
  process.exit(fail ? 1 : 0);
})();
