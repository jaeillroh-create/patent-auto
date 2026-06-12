/**
 * review-engine/contracts/schemas/index.js
 * 에이전트 출력 스키마 배럴 (spec §4.3). T0: 재노출만.
 * @module review-engine/contracts/schemas
 */
export { IssueListSchema } from './IssueList.js';
export { PatchPlanSchema } from './PatchPlan.js';
export { VerdictSchema } from './Verdict.js';
export { RebuttalSetSchema } from './RebuttalSet.js';

import { IssueListSchema } from './IssueList.js';
import { PatchPlanSchema } from './PatchPlan.js';
import { VerdictSchema } from './Verdict.js';
import { RebuttalSetSchema } from './RebuttalSet.js';

/** schemaId → schema 매핑(검증기 주입용, T2+). */
export const SCHEMAS = Object.freeze({
  IssueList: IssueListSchema,
  PatchPlan: PatchPlanSchema,
  Verdict: VerdictSchema,
  RebuttalSet: RebuttalSetSchema,
});
