/**
 * review-engine/__tests__/domain-expert-provider-routing.test.js
 *
 * ★ 잠복 버그: Claude 단독(1키)인데 검증이 "no API key for gemini" 로 실패.
 *   원인 — domain_expert 의 기본 provider 가 gemini 인데, 클라가 보낸 assignments 가 (구버전/캐시 등)
 *   domain_expert 를 누락하면 핸들러 override 가 그 에이전트를 건너뛰어 gemini 로 남고, 가용 키(claude)만
 *   있을 때 실행 시점에 "no API key for gemini" 누수. examiner/attorney 5역할은 배정돼 claude 로 가는데
 *   domain_expert(6번째)만 누수되는 정확한 증상.
 *
 * 수정 — resolveAgentProviders(키-가용성 백스톱): 배정 후에도 키 없는 provider 로 남은 에이전트를
 *   가용 키로 라우팅. 1키 → 6역할 전부 그 provider(domain_expert 포함). 멀티키 → 배정 보존(불변).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { resolveAgentProviders } from '../edge/review-orchestrate.ts';
import { OPINION_AGENTS } from '../profiles/opinion/agents/index.js';
import { PATENT_AGENTS } from '../profiles/patent/agents/index.js';

const ALL6 = ['examiner_A', 'examiner_B', 'examiner_C', 'attorney_author', 'attorney_reviewer', 'domain_expert'];
const hasKeyFrom = (set) => (p) => set.indexOf(p) >= 0;
const provOf = (agents) => agents.reduce((m, a) => { m[a.id] = a.provider; return m; }, {});

test('가드 — domain_expert 기본 provider 는 gemini (opinion·patent 모두) → 누수 위험 대상', () => {
  assert.equal(OPINION_AGENTS.find((a) => a.id === 'domain_expert').provider, 'gemini');
  assert.equal(PATENT_AGENTS.find((a) => a.id === 'domain_expert').provider, 'gemini');
});

test('★ 1키(claude) + assignments=null → 6역할 전부 claude (domain_expert 포함)', () => {
  const out = resolveAgentProviders(OPINION_AGENTS, null, hasKeyFrom(['claude']));
  const p = provOf(out);
  ALL6.forEach((id) => assert.equal(p[id], 'claude', id + ' → claude'));
  assert.equal(p.domain_expert, 'claude', '★ domain_expert 누수 0');
});

test('★ 1키(claude) + assignments 6역할 전부 claude → 전부 claude (정상 경로 회귀)', () => {
  const assign = {}; ALL6.forEach((r) => { assign[r] = 'claude'; });
  const p = provOf(resolveAgentProviders(OPINION_AGENTS, assign, hasKeyFrom(['claude'])));
  ALL6.forEach((id) => assert.equal(p[id], 'claude', id + ' → claude'));
});

test('★★ 잠복 버그 재현·차단 — 1키(claude) + assignments 가 domain_expert 누락(5역할) → 백스톱이 claude 로 교정', () => {
  // 구버전/캐시 클라가 domain_expert 를 빠뜨린 assignments(5역할만 claude) 를 보낸 상황.
  const stale = { examiner_A: 'claude', examiner_B: 'claude', examiner_C: 'claude', attorney_author: 'claude', attorney_reviewer: 'claude' };
  const p = provOf(resolveAgentProviders(OPINION_AGENTS, stale, hasKeyFrom(['claude'])));
  // 누락 전: domain_expert 는 기본 gemini 로 남아 "no API key for gemini" 누수.
  assert.equal(p.domain_expert, 'claude', '★ 백스톱 — domain_expert gemini→claude (누수 차단)');
  ALL6.forEach((id) => assert.equal(p[id], 'claude', id + ' → claude'));
});

test('★ 6역할 전수 — 입력 에이전트가 하나도 누락/추가되지 않음(회귀 차단)', () => {
  const out = resolveAgentProviders(OPINION_AGENTS, null, hasKeyFrom(['claude']));
  assert.equal(out.length, OPINION_AGENTS.length, '에이전트 수 보존');
  const ids = out.map((a) => a.id).sort();
  assert.deepEqual(ids, ALL6.slice().sort(), '6역할 id 전수 보존');
  // 다른 필드(role/outputSchemaByMode/fallbackProvider)도 보존
  const de = out.find((a) => a.id === 'domain_expert');
  assert.equal(de.role, 'domain_expert');
  assert.deepEqual(de.outputSchemaByMode, { discover: 'IssueList', recheck: 'Verdict' }, '스키마 보존');
});

test('★ 멀티키(claude/gpt/gemini) → 역할배정/원본 provider 유지 (안 건드림)', () => {
  // assignments 가 examiner 만 claude 로 지정, domain_expert 미지정 → 원본 gemini 유지(키 보유).
  const assign = { examiner_A: 'claude', examiner_B: 'claude' };
  const p = provOf(resolveAgentProviders(OPINION_AGENTS, assign, hasKeyFrom(['claude', 'gpt', 'gemini'])));
  assert.equal(p.examiner_A, 'claude', '배정 반영');
  assert.equal(p.examiner_B, 'claude', '배정 반영');
  assert.equal(p.examiner_C, 'gpt', '미지정 → 원본 gpt 유지');
  assert.equal(p.domain_expert, 'gemini', '★ 멀티키 — domain_expert 원본 gemini 유지(키 보유 → 백스톱 미발동)');
  assert.equal(p.attorney_author, 'claude', '원본 claude 유지');
});

test('멀티키지만 한 에이전트 배정 provider 키 없음 → 그 에이전트만 가용 키로 백스톱(crash 방지)', () => {
  // gpt 키 없음. examiner_A(원본 gpt) 는 백스톱, gemini/claude 보유 에이전트는 유지.
  const p = provOf(resolveAgentProviders(OPINION_AGENTS, null, hasKeyFrom(['claude', 'gemini'])));
  assert.ok(['claude', 'gemini'].indexOf(p.examiner_A) >= 0, 'examiner_A gpt(무키)→가용 키로 백스톱');
  assert.equal(p.examiner_B, 'gemini', 'examiner_B gemini(키 보유) 유지');
  assert.equal(p.domain_expert, 'gemini', 'domain_expert gemini(키 보유) 유지');
});

test('★ patent 모듈도 동일 — 1키(claude) → domain_expert 포함 6역할 claude', () => {
  const p = provOf(resolveAgentProviders(PATENT_AGENTS, null, hasKeyFrom(['claude'])));
  ALL6.forEach((id) => assert.equal(p[id], 'claude', 'patent ' + id + ' → claude'));
  assert.equal(p.domain_expert, 'claude', '★ patent domain_expert 누수 0');
});

test('가용 키 0개 → 원 provider 유지(상위에서 차단; 백스톱이 임의 변경 안 함)', () => {
  const p = provOf(resolveAgentProviders(OPINION_AGENTS, null, hasKeyFrom([])));
  assert.equal(p.domain_expert, 'gemini', '키 0 → 원본 유지');
  assert.equal(p.examiner_A, 'gpt', '키 0 → 원본 유지');
});
