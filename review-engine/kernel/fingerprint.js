/**
 * review-engine/kernel/fingerprint.js
 * ─────────────────────────────────────────────────────────────
 * issue 동일성 지문 + 반복(occurrences) 추적 — spec §6.3.
 * fingerprint = hash(type, target, coreElement). occurrences≥2 → deadlock(orchestrator 판정).
 * 결정적·순수. 모듈명 분기 없음(I-6).
 * @module review-engine/kernel/fingerprint
 */

/** 결정적 문자열 해시(djb2, 16진) — 외부 의존 없이 재현 가능. */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/**
 * issue 지문 계산. coreElement는 type+정렬된 target+법조 근거로 구성(표현 변형에 둔감).
 * @param {import('../contracts/stateSchema.js').Issue} issue
 * @returns {string} fingerprint
 */
export function computeFingerprint(issue) {
  const type = String(issue.type || '');
  const target = Array.isArray(issue.target) ? [...issue.target].sort().join(',') : String(issue.target || '');
  const core = String(issue.coreElement || issue.legalBasis || '');
  return hashStr(`${type}|${target}|${core}`);
}

/**
 * 새 issue를 state.issues에 병합. 동일 지문 존재 시 기존 issue의 occurrences를 증가시키고
 * 새 issue는 추가하지 않는다(진동/골대이동 탐지, §6.3). 새 지문이면 occurrences=1로 추가.
 * @param {import('../contracts/stateSchema.js').ReviewState} state
 * @param {import('../contracts/stateSchema.js').Issue} issue
 * @returns {{merged:boolean, issue:import('../contracts/stateSchema.js').Issue}}
 *   merged=true면 기존 issue occurrences++; false면 신규 추가.
 */
export function mergeIssue(state, issue) {
  const fp = issue.fingerprint || computeFingerprint(issue);
  const existing = state.issues.find((it) => it.fingerprint === fp);
  if (existing) {
    existing.occurrences = (existing.occurrences || 1) + 1;
    return { merged: true, issue: existing };
  }
  const added = { ...issue, fingerprint: fp, occurrences: issue.occurrences || 1 };
  state.issues.push(added);
  return { merged: false, issue: added };
}

export default { computeFingerprint, mergeIssue };
