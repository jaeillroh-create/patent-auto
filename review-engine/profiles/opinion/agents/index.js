/**
 * review-engine/profiles/opinion/agents/index.js
 * 의견서 도메인 에이전트 정의 배럴 (spec §4.2). 6역할(§4.1).
 * OpinionProfile.agents(T2, 선언형 요약)와 정합하며, 본 모듈은 T4 실행에 필요한
 * 필드(model/maxTokens/fallbackProvider/outputSchemaByMode)를 갖춘 캐노니컬 정의다.
 * @module review-engine/profiles/opinion/agents
 */
import examiner_A from './examiner_A.js';
import examiner_B from './examiner_B.js';
import examiner_C from './examiner_C.js';
import attorney_author from './attorney_author.js';
import attorney_reviewer from './attorney_reviewer.js';
import domain_expert from './domain_expert.js';

/** 정의 순서 = spec §4.1 6역할 순. */
export const OPINION_AGENTS = Object.freeze([
  examiner_A, examiner_B, examiner_C, attorney_author, attorney_reviewer, domain_expert,
]);

/** id → 정의 맵. */
export const AGENT_BY_ID = Object.freeze(
  OPINION_AGENTS.reduce((m, a) => { m[a.id] = a; return m; }, {})
);

export { examiner_A, examiner_B, examiner_C, attorney_author, attorney_reviewer, domain_expert };
export default OPINION_AGENTS;
