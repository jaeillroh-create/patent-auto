/**
 * review-engine/__tests__/toggle.test.js
 * T0 DoD 증명용 단위테스트 (ESM). 실행: node review-engine/__tests__/toggle.test.js
 *  - 토글 OFF → engine.run 무동작 return (E-21).
 *  - 토글 ON  → 커널 미구현 명시적 차단(가짜 통과 금지).
 *  - 계약 멤버 선언 확인(ReviewProfile 8멤버, WriterModule 3메서드).
 * (이 파일은 spec §18 런타임 트리가 아닌 T0 검증 아티팩트.)
 */
import assert from 'node:assert/strict';
import { engine, FEATURE_FLAGS } from '../index.js';
import { REVIEW_PROFILE_MEMBERS, REVIEW_PROFILE_REQUIRED_KEYS } from '../contracts/ReviewProfile.js';
import { WRITER_MODULE_METHODS } from '../contracts/WriterModule.js';
import { REVIEW_STATE_SCHEMA_VERSION, PHASE } from '../contracts/stateSchema.js';
import { SCHEMAS } from '../contracts/schemas/index.js';

let pass = 0, fail = 0; const fails = [];
function ok(c, n) { if (c) pass++; else { fail++; fails.push('✗ ' + n); } }

// ── 1) 토글 OFF → 무동작 return ──
FEATURE_FLAGS.reviewEngine = false;
const r = engine.run({ module: 'opinion' }, { reviewId: 'x' });
ok(r && r.skipped === true, '토글 OFF → skipped:true 반환');
ok(r.phase === PHASE.IDLE, '토글 OFF → phase=idle');
ok(typeof r.reason === 'string' && r.reason.includes('OFF'), '토글 OFF → reason 명시');

// 무동작 보장: profile/snapshot이 비어도(undefined) OFF면 안전 return
const r2 = engine.run(undefined, undefined);
ok(r2 && r2.skipped === true, '토글 OFF → 입력 없이도 무동작 안전 return');

// ── 2) 토글 ON → 커널 미구현 차단(가짜 통과 금지) ──
FEATURE_FLAGS.reviewEngine = true;
let threw = false;
try { engine.run({ module: 'opinion' }, {}); } catch (e) { threw = e.message.includes('kernel not implemented'); }
ok(threw, '토글 ON → 커널 미구현 명시적 throw');
FEATURE_FLAGS.reviewEngine = false; // 원복

// ── 3) ReviewProfile 8멤버 계약 선언 확인 ──
const numbered = REVIEW_PROFILE_MEMBERS.filter((m) => m.n !== null).map((m) => m.n);
ok(JSON.stringify(numbered) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), 'ReviewProfile (1)~(8) 8멤버 선언');
ok(REVIEW_PROFILE_MEMBERS.some((m) => m.key === 'module'), 'ReviewProfile module discriminator 선언');
['adaptSnapshot', 'agents', 'issueCatalog', 'consistencyRules', 'scoreWeights', 'amendmentOps', 'rippleRules', 'terminationPolicy', 'writer']
  .forEach((k) => ok(REVIEW_PROFILE_REQUIRED_KEYS.includes(k), `ReviewProfile 필수키 포함: ${k}`));

// ── 4) WriterModule 3메서드 계약 ──
ok(JSON.stringify(WRITER_MODULE_METHODS) === JSON.stringify(['exportSnapshot', 'applyAmendments', 'rollback']), 'WriterModule 3메서드 선언');

// ── 5) 스키마/버전 노출 ──
ok(REVIEW_STATE_SCHEMA_VERSION === '0.3.0', 'stateSchema schemaVersion 노출');
['IssueList', 'PatchPlan', 'Verdict', 'RebuttalSet'].forEach((s) => ok(SCHEMAS[s] && SCHEMAS[s].title === s, `스키마 노출: ${s}`));

console.log('='.repeat(50));
console.log(`review-engine T0 단위테스트: ${pass} 통과 / ${fail} 실패 (총 ${pass + fail})`);
console.log('='.repeat(50));
if (fails.length) { console.log('\n[실패]'); fails.forEach((f) => console.log(f)); }
process.exit(fail ? 1 : 0);
