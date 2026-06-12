/**
 * review-engine/__tests__/division-profile.test.js
 * T7 — DivisionProfile 계약 + §47 신규사항/이중특허/범위이탈 구조 검출 + adapter 매핑.
 * 증명: ReviewProfile 8멤버 적합 / consistency 가 §47 등 검출(image 19 매핑) / 차등검증(부가=anchor).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import DivisionProfile from '../profiles/division/DivisionProfile.js';
import { adaptSnapshot } from '../profiles/division/adapter.js';
import { checkNewMatterStructural, checkDoublePatentingStructural, checkBasisScopeStructural, lcsRatio } from '../profiles/division/consistency.js';
import { REVIEW_PROFILE_REQUIRED_KEYS } from '../contracts/ReviewProfile.js';

/** 분할 스냅샷 픽스처(Division.exportSnapshot 형상). */
function snapshot(over = {}) {
  return Object.assign({
    caseId: '10-2024-0555',
    divisionType: 'merge',
    originalClaims: [{ claim_number: 1, original_text: '복수의 셀과 냉각 유로를 포함하는 장치.' }],
    specParagraphs: [{ paragraph_number: '0021', content: '냉각 유로는 사행 형상으로 통과한다. 충분히 긴 명세서 본문 내용.' }],
    divisionClaims: [
      { claim_number: 1, claim_type: 'independent', claim_text: '복수의 셀과 냉각 유로와 머신러닝 예측 모듈을 포함하는 장치.',
        basis_preserved: true,
        added_components: [{ content: '머신러닝 예측 모듈', spec_source_text: '' }] }, // ← 근거 부재(§47)
    ],
  }, over);
}

test('계약: DivisionProfile 8멤버 적합 + module discriminator', () => {
  assert.equal(DivisionProfile.module, 'division');
  for (const k of REVIEW_PROFILE_REQUIRED_KEYS) {
    assert.ok(k in DivisionProfile, `멤버 ${k} 존재`);
  }
  for (const m of ['exportSnapshot', 'applyAmendments', 'rollback']) {
    assert.equal(typeof DivisionProfile.writer[m], 'function', `writer.${m} 함수`);
  }
  assert.ok(Array.isArray(DivisionProfile.agents) && DivisionProfile.agents.length === 6);
});

test('adapter: 분할항 차등검증(추가구성=anchor 부가) + 매핑', () => {
  const st = adaptSnapshot(snapshot(), null, { caseId: 'C' });
  assert.equal(st.module, 'division');
  assert.equal(st.claims.length, 1);
  assert.equal(st.claims[0].kind, 'anchor');
  assert.equal(st.claims[0].anchorType, '부가', '추가구성 보유 → 부가(§47 위험)');
  assert.equal(st.spec.sections.length, 1);
  assert.equal(st.citedPrior.length, 1, '원출원 청구항이 이중특허 비교 기준');
  assert.equal(st.moduleContext.divisionType, 'merge');
  // not-applicable 표시(거짓 issue 방지)
  assert.equal(st.invention.notApplicable.reason, 'division-not-applicable');
});

test('§47 신규사항추가: 추가구성의 명세서 근거(spec_source_text) 부재 → high', () => {
  const st = adaptSnapshot(snapshot(), null, {});
  const v = checkNewMatterStructural(st);
  assert.equal(v.length, 1);
  assert.equal(v[0].type, '신규사항추가');
  assert.equal(v[0].severity, 'high');
  assert.equal(v[0].legalBasis, '§47');
  assert.equal(v[0].target[0], 'claim_1');
});

test('§47 신규사항추가: 근거(spec_source_text) 있으면 통과(정당한 구체화)', () => {
  const ok = snapshot({ divisionClaims: [{ claim_number: 1, claim_type: 'independent', claim_text: 'X', basis_preserved: true, added_components: [{ content: '머신러닝 예측 모듈', spec_source_text: '명세서 【0021】 예측 모듈 기재' }] }] });
  const st = adaptSnapshot(ok, null, {});
  assert.equal(checkNewMatterStructural(st).length, 0, '근거 존재 → 신규사항 아님');
});

test('이중특허: 분할항 ↔ 원출원 청구항 95%+ 동일 → high (image 19 이중특허)', () => {
  const dup = snapshot({ divisionClaims: [{ claim_number: 1, claim_type: 'independent', claim_text: '복수의 셀과 냉각 유로를 포함하는 장치.', basis_preserved: true, added_components: [] }] });
  const st = adaptSnapshot(dup, null, {});
  const v = checkDoublePatentingStructural(st);
  assert.equal(v.length, 1);
  assert.equal(v[0].type, '이중특허');
});

test('원출원범위이탈: basis_preserved=false → §47 high (image 19 basis보존)', () => {
  const bad = snapshot({ divisionClaims: [{ claim_number: 1, claim_type: 'independent', claim_text: 'Z', basis_preserved: false, added_components: [] }] });
  const st = adaptSnapshot(bad, null, {});
  const v = checkBasisScopeStructural(st);
  assert.equal(v.length, 1);
  assert.equal(v[0].type, '원출원범위이탈');
  assert.equal(v[0].legalBasis, '§47');
});

test('issueCatalog: 신규사항추가 severityRule — 부가=high, 그 외=medium', () => {
  const rule = DivisionProfile.issueCatalog.find((c) => c.type === '신규사항추가').severityRule;
  assert.equal(rule({ claim: { anchorType: '부가' } }), 'high');
  assert.equal(rule({ claim: { anchorType: null } }), 'medium');
});

test('lcsRatio: 순수 유사도(division.js _lcsRatio 동형)', () => {
  assert.equal(lcsRatio('', 'x'), 0);
  assert.ok(lcsRatio('복수의 셀과 냉각 유로', '복수의 셀과 냉각 유로') > 0.99);
});
