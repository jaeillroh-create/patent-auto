/**
 * review-engine/__tests__/patent-profile.test.js
 * T8 — PatentProfile 계약 + §5.2 앵커 뒷받침 1차관문 + E-11 3경로 정합 + §8.4 중복판정 금지(dedupe).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import PatentProfile from '../profiles/patent/PatentProfile.js';
import { adaptSnapshot, parseClaims } from '../profiles/patent/adapter.js';
import { checkAnchorSupportStructural, checkRenderConsistencyStructural, checkScopeCoverageStructural } from '../profiles/patent/consistency.js';
import { REVIEW_PROFILE_REQUIRED_KEYS } from '../contracts/ReviewProfile.js';

function snapshot(over = {}) {
  return Object.assign({
    caseId: 'P1', deviceAnchorStart: 7, methodAnchorStart: 0,
    inventionScope: { locked_at: 't', baseline: { components: [{ name: '프로세서' }] } },
    scopeCheckResults: { step_07: { matched_to_scope: [{ name: '캐싱모듈', ref: '150' }] } },
    outputs: {
      step_01: '지능형 캐시 장치',
      step_06: '청구항 1\n프로세서를 포함하는 장치.\n청구항 7\n제1항에 있어서, 예측모듈을 더 포함하는 장치.',
      step_08: '본 장치는 프로세서(100)를 포함한다. 충분한 길이의 상세설명.',
      step_07_mermaid: 'graph TD\nA[프로세서(100)]\nB[캐싱모듈(150)]\nC[신규위젯(160)]',
      step_18: '100: 프로세서\n150: 캐싱모듈',
    },
  }, over);
}

test('계약: PatentProfile 8멤버 + module + writer 3메서드 + agents 6', () => {
  assert.equal(PatentProfile.module, 'patent');
  for (const k of REVIEW_PROFILE_REQUIRED_KEYS) assert.ok(k in PatentProfile, `멤버 ${k}`);
  for (const m of ['exportSnapshot', 'applyAmendments', 'rollback']) assert.equal(typeof PatentProfile.writer[m], 'function');
  assert.equal(PatentProfile.agents.length, 6);
  assert.equal(PatentProfile.issueCatalog.length, 6, 'issueCatalog 6종');
});

test('adapter: parseClaims + general/anchor 차등(anchorStart=7)', () => {
  const st = adaptSnapshot(snapshot(), snapshot().scopeCheckResults, {});
  const c1 = st.claims.find((c) => c.no === 1);
  const c7 = st.claims.find((c) => c.no === 7);
  assert.equal(c1.kind, 'general', '청구항1 < anchorStart → general');
  assert.equal(c7.kind, 'anchor', '청구항7 ≥ anchorStart → anchor(§5)');
  assert.equal(c7.anchorType, '부가');
  // 자기검토 통과 구성요소 정규화(§8.4)
  assert.ok(st.moduleContext.selfReviewPassed.some((p) => p.name === '캐싱모듈' && p.ground === 'scope_coverage'));
});

test('§5.2 앵커 1차 관문: anchor 구성요소(예측모듈) 상세설명 뒷받침 부재 → high 기재불비', () => {
  const st = adaptSnapshot(snapshot(), null, {});
  const v = checkAnchorSupportStructural(st);
  assert.ok(v.some((x) => x.coreElement.includes('예측모듈') && x.severity === 'high' && x.type === '기재불비'));
});

test('§5.2: 상세설명에 뒷받침 있으면 통과', () => {
  const ok = snapshot();
  ok.outputs.step_08 += ' 예측모듈(170)은 캐시 적중을 예측한다.';
  const st = adaptSnapshot(ok, null, {});
  assert.equal(checkAnchorSupportStructural(st).length, 0, '뒷받침 존재 → 통과');
});

test('E-11 3경로 정합(구조): 도면 부호 ⊄ 부호의 설명 → 렌더회귀', () => {
  const st = adaptSnapshot(snapshot(), null, {});
  const v = checkRenderConsistencyStructural(st);
  // 도면 (160) 신규위젯이 step_18 부호의 설명에 없음 → 렌더회귀
  assert.equal(v.length, 1);
  assert.equal(v[0].type, '명확성');
  assert.ok(v[0].coreElement.includes('160'));
});

test('★ §8.4 중복판정 금지: 자기검토 통과(캐싱모듈)는 재지적 안 함, 신규위젯만 지적', () => {
  const st = adaptSnapshot(snapshot(), snapshot().scopeCheckResults, {});
  const v = checkScopeCoverageStructural(st);
  const names = v.map((x) => x.coreElement);
  assert.ok(!names.some((n) => n.includes('캐싱모듈')), '자기검토 통과항목 중복판정 0건(dedupe)');
  assert.ok(names.some((n) => n.includes('신규위젯')), '미판정 신규 구성은 지적(새 거절관점)');
});

test('issueCatalog: §5 차등 severityRule (진보성 general=high/anchor=medium, 기재불비 anchor=high)', () => {
  const prog = PatentProfile.issueCatalog.find((c) => c.type === '진보성').severityRule;
  assert.equal(prog({ claim: { kind: 'general' } }), 'high');
  assert.equal(prog({ claim: { kind: 'anchor' } }), 'medium');
  const desc = PatentProfile.issueCatalog.find((c) => c.type === '기재불비').severityRule;
  assert.equal(desc({ claim: { kind: 'anchor' } }), 'high', '앵커 뒷받침 §5.2 high');
});
