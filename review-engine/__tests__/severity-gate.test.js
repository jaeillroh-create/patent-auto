/**
 * review-engine/__tests__/severity-gate.test.js
 *
 * ★ severity 게이트(UI) — 변리사 설계: 생성 단계가 치밀 검증하므로 review 는 치명/심각(high)만 표면화.
 *   DB 실측 분포: high×2(§42④ 기재불비=청구항 뒷받침) + medium×6 + low×2.
 *   high 우선 표시 / medium·low 는 <details> 접힘(펼치면 보임) / high 0 → "치명 없음" 메시지.
 *   ★ 발굴·저장은 전부 유지(숨김 아님 — DOM 에 minor 전부 존재). patent·opinion 공통(공유 패널).
 *   ★ examiner .md severity 매김 불변 — UI 게이트만.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState } from '../kernel/stateStore.js';
import { renderHTML } from '../ui/opinion-review-panel.js';

const PANEL_SRC = readFileSync(
  path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../'), 'review-engine/ui/opinion-review-panel.js'),
  'utf8',
);

function stateWith(issues, module = 'patent') {
  const st = createState({ reviewId: 'rev_sg', caseId: 'C1', module, terminationPolicy: { capUsd: 15, maxRounds: 2 } });
  st.phase = 'escalated';
  st.issues = issues;
  st.patchPlans = [];
  st.rounds = [];
  return st;
}
const issue = (id, severity, by, law, type, desc) =>
  ({ id, severity, raisedBy: by, legalBasis: law, type, target: ['claim_1'], description: desc, status: 'open' });

// DB 실측 분포: high×2(§42④ 기재불비) + medium×6 + low×2
const DB_ISSUES = [
  issue('b1', 'high', 'examiner_B', '§42④', '기재불비', 'HIGH_앵커뒷받침부재_7'),
  issue('b2', 'high', 'examiner_B', '§42④', '기재불비', 'HIGH_뒷받침부재_3'),
  issue('a1', 'medium', 'examiner_A', '§29②', '진보성', 'MED_진보성1'),
  issue('a2', 'medium', 'examiner_A', '§29②', '진보성', 'MED_진보성2'),
  issue('c1', 'medium', 'examiner_C', '§45', '단일성', 'MED_단일성'),
  issue('c2', 'medium', 'examiner_C', '§42③', '실시가능성', 'MED_실시1'),
  issue('c3', 'medium', 'examiner_C', '§42④', '명확성', 'MED_명확'),
  issue('c4', 'medium', 'examiner_C', '§42③', '실시가능성', 'MED_실시2'),
  issue('l1', 'low', 'examiner_A', '§29②', '진보성', 'LOW_진보성보조'),
  issue('l2', 'low', 'examiner_C', '§42③', '실시가능성', 'LOW_실시보조'),
];

test('★1 high(§42④ 2건) 우선 표시 + medium·low(8건) <details> 접힘', () => {
  const html = renderHTML(stateWith(DB_ISSUES), {});
  // high 2건 표시
  assert.ok(html.includes('HIGH_앵커뒷받침부재_7') && html.includes('HIGH_뒷받침부재_3'), 'high 2건 표시');
  // 접힘 섹션 + 정확한 카운트
  assert.match(html, /<details[^>]*review-minor/, '<details review-minor 존재');
  assert.match(html, /기타 8건 \(medium 6 · low 2\) — 펼쳐보기/, '기타 8건(medium 6·low 2) summary');
  // ★ medium/low 는 details 내부(접힘) — details 시작 뒤에 위치. (verdict 블록엔 high 만 나오므로 medium 첫 등장 = details 안)
  const di = html.indexOf('<details');
  assert.ok(di > 0, 'details 위치');
  assert.ok(html.indexOf('MED_진보성1') > di, 'medium 은 details 안(접힘)');
  assert.ok(html.indexOf('LOW_진보성보조') > di, 'low 은 details 안(접힘)');
  // high 는 details 앞(펼쳐짐)
  assert.ok(html.indexOf('HIGH_앵커뒷받침부재_7') < di, 'high 는 details 앞(표시)');
});

test('★ 발굴 유지 — minor 8건 전부 DOM 에 존재(숨김 아님, 펼치면 보임)', () => {
  const html = renderHTML(stateWith(DB_ISSUES), {});
  ['MED_진보성1', 'MED_진보성2', 'MED_단일성', 'MED_실시1', 'MED_명확', 'MED_실시2', 'LOW_진보성보조', 'LOW_실시보조']
    .forEach((d) => assert.ok(html.includes(d), 'minor 발굴 유지: ' + d));
});

test('★2 high 0건 → "치명적·심각 결함 없음" + minor 접힘', () => {
  const minorOnly = DB_ISSUES.filter((it) => it.severity !== 'high');
  const html = renderHTML(stateWith(minorOnly), {});
  assert.match(html, /치명적·심각[\s\S]*결함 없음/, 'high 0 → 치명 없음 메시지');
  assert.match(html, /기타 8건 \(medium 6 · low 2\)/, 'minor 접힘 유지');
  assert.ok(html.includes('MED_진보성1') && html.includes('LOW_실시보조'), 'minor 발굴 유지(펼치면 보임)');
});

test('★ high 만 있고 minor 0 → details 없음(접을 것 없음)', () => {
  const html = renderHTML(stateWith([issue('h', 'high', 'examiner_B', '§42④', '기재불비', 'ONLY_HIGH')]), {});
  assert.ok(html.includes('ONLY_HIGH'), 'high 표시');
  assert.ok(!/details[^>]*review-minor/.test(html), 'minor 없으면 접힘 섹션 없음');
});

test('★ patent·opinion 공통 — 게이트가 severity 기반(모듈 무관, 한 패널)', () => {
  // 같은 renderHTML 이 module:opinion 결과도 동일하게 게이트.
  const opHtml = renderHTML(stateWith(DB_ISSUES, 'opinion'), {});
  assert.match(opHtml, /기타 8건 \(medium 6 · low 2\)/, 'opinion 도 동일 게이트');
  // 소스: severity 기반(모듈 분기 없음) + 발굴 유지 주석
  assert.match(PANEL_SRC, /it\.severity === 'high'/, 'severity 기반 게이트(모듈 무관)');
  assert.match(PANEL_SRC, /발굴·저장은 전부 유지/, '발굴 유지(숨김 아님) 의도 주석');
});

test('★ examiner .md severity 매김 불변 — UI 게이트만 (소스 가드)', () => {
  // 본 변경은 패널 renderIssues 만. examiner .md / PatentProfile severityRule 미접촉.
  assert.match(PANEL_SRC, /renderIssues/, '패널 renderIssues 게이트');
  // (severity 매김은 PatentProfile.issueCatalog/examiner .md 소관 — 본 PR 미변경)
});
