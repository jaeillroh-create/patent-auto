/**
 * review-engine/__tests__/korean-verdict.test.js
 * AC-T2 한국어 종합 결론 + 명확한 최종 판정 — renderHTML(presentation)만, 엔진 로직 불변.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { renderHTML } from '../ui/opinion-review-panel.js';

// 미해소 high 1건 + escalated + 보정안 1건(문안 공란)인 상태(현실 케이스).
const STATE = {
  phase: 'escalated',
  issues: [
    { id: 'exA-1', raisedBy: 'examiner_A', severity: 'high', status: 'open', legalBasis: '§29②', type: '거절미해소', target: ['claim_1'], description: '인용발명 대비 진보성 미흡' },
    { id: 'exB-1', raisedBy: 'examiner_B', severity: 'medium', status: 'open', legalBasis: '§42④', type: '기재불비', target: ['claim_2'], description: '제어부 뒷받침 추상적' },
  ],
  patchPlans: [{ id: 'plan_1', addressesIssues: ['exA-1'], ops: [{ op: 'add_limitation', target: 'claim_1', content: '', reason: 'r' }], accepted: null, scoreBefore: 1, scoreAfter: 0 }],
  budget: { spentUsd: 0.1, capUsd: 5, roundsUsed: 3, maxRounds: 3 },
  rounds: [], consensus: {},
};

const html = renderHTML(STATE, {});

test('★ 최상단 한국어 종합 결론 섹션 (판정+핵심거절+권장보정)', () => {
  assert.ok(html.includes('review-verdict-box'), '종합 결론 박스');
  // 종합 결론이 banner/쟁점보다 위(최상단)
  const iVerdict = html.indexOf('review-verdict-box');
  const iBanner = html.indexOf('review-banner');
  const iIssues = html.indexOf('거절이유 · 쟁점');
  assert.ok(iVerdict >= 0 && iVerdict < iBanner && iVerdict < iIssues, '★ 종합 결론이 최상단');
  assert.ok(html.includes('검증 판정'), '판정 헤드라인');
  assert.ok(html.includes('거절이유 2건 발굴'), '거절이유 건수');
  assert.ok(html.includes('핵심 거절이유'), '핵심 거절이유 요약');
  assert.ok(html.includes('최종 판정:'), '최종 판정 문장');
});

test('★ escalate → "보정 필요" 명확한 최종 판정 (합의불가/떠넘김 아님)', () => {
  assert.ok(html.includes('보정 필요(미해소 거절위험 잔존)'), 'phase 한국어=보정 필요');
  assert.ok(html.includes('보정 없이 등록 통과가 불가') || html.includes('보정 없이는 등록 통과 불가'), 'high 미해소 = 통과 불가(특허상 정당)');
  assert.ok(html.includes('특허상 정당한 판정'), 'E-17 의미를 변리사 한국어로');
});

test('★ "비결정적/합의불가/사람 결정 떠넘김" 부정 표현 제거', () => {
  assert.ok(!html.includes('비결정적'), '비결정적 제거');
  assert.ok(!html.includes('합의불가'), '합의불가 제거');
  assert.ok(!html.includes('사람 판단 필요'), '사람 판단 떠넘김 제거');
  assert.ok(!html.includes('사람 결정 필요'), '사람 결정 떠넘김 제거');
  // 대체: 변리사 확정 프레이밍
  assert.ok(html.includes('변리사'), '변리사 최종 확정 프레이밍');
});

test('★ op/phase/severity/status 한국어 라벨', () => {
  assert.ok(html.includes('한정 추가'), 'op add_limitation→한정 추가');
  assert.ok(!html.includes('add_limitation'), '영문 op명 제거');
  assert.ok(html.includes('높음') && html.includes('주의'), 'severity 한국어(높음/주의)');
  assert.ok(html.includes('[미해소]'), 'status open→미해소');
});

test('보정 문안 없으면 "생성 중/미생성" 안내(AC-T3 전 상태)', () => {
  assert.ok(html.includes('생성 중') || html.includes('생성되지 않'), '문안 공란 안내');
});

test('zero-issue → "거절위험 낮음" 긍정 결론 (부정 표현 0)', () => {
  const z = renderHTML({ phase: 'converged', issues: [], patchPlans: [], budget: { capUsd: 5, maxRounds: 3 }, rounds: [], consensus: {} }, {});
  assert.ok(z.includes('거절이유가 없습니다') || z.includes('거절위험이 낮'), '긍정 결론');
  assert.ok(z.includes('수렴 완료'), 'converged 한국어');
  assert.ok(!z.includes('비결정적') && !z.includes('실패'), '부정 표현 0');
});
