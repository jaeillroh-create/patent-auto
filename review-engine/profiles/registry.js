/**
 * review-engine/profiles/registry.js
 * ─────────────────────────────────────────────────────────────
 * 모듈명 → 프로필 묶음 레지스트리 (edge 프로필 선택 G9 · UI policy 브리지 G3 공용).
 * ★ I-6: 소비자는 `PROFILES[module]` 데이터 조회만 한다(문자열 분기 if(module==='...') 금지).
 *   isModuleEnabled 의 `FEATURE_FLAGS.modules[module]` 와 동일한 데이터-키 패턴.
 * 각 엔트리는 { profile, agents, makeEngineWriter } — orchestrator 주입에 필요한 3종.
 * @module review-engine/profiles/registry
 */
import OpinionProfile from './opinion/OpinionProfile.js';
import { OPINION_AGENTS } from './opinion/agents/index.js';
import { makeEngineWriter as opinionWriter } from './opinion/writerAdapter.js';
import PatentProfile from './patent/PatentProfile.js';
import { PATENT_AGENTS } from './patent/agents/index.js';
import { makeEngineWriter as patentWriter } from './patent/writerAdapter.js';
import DivisionProfile from './division/DivisionProfile.js';
import { DIVISION_AGENTS } from './division/agents/index.js';
import { makeEngineWriter as divisionWriter } from './division/writerAdapter.js';

/**
 * @type {Record<string, { profile: Object, agents: Object[], makeEngineWriter: (getState:()=>Object)=>Object }>}
 */
export const PROFILES = Object.freeze({
  opinion:  { profile: OpinionProfile,  agents: OPINION_AGENTS,  makeEngineWriter: opinionWriter },
  patent:   { profile: PatentProfile,   agents: PATENT_AGENTS,   makeEngineWriter: patentWriter },
  division: { profile: DivisionProfile, agents: DIVISION_AGENTS, makeEngineWriter: divisionWriter },
});

/** module 엔트리 조회(없으면 null). 데이터-키 조회 — 분기 아님(I-6). */
export function getProfileEntry(module) {
  return (module != null && Object.prototype.hasOwnProperty.call(PROFILES, module)) ? PROFILES[module] : null;
}

export default PROFILES;
