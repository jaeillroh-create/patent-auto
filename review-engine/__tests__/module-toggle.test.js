/**
 * review-engine/__tests__/module-toggle.test.js
 * B2 — 모듈별 토글 진리표. 마스터 × 모듈 조합이 구조적으로 격리되는지 증명.
 * (마스터 OFF → 전부 무동작 / 마스터 ON + 모듈 선택 → 해당 모듈만 발화 / 후방호환 폴백)
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_FLAGS, isModuleEnabled, engine } from '../index.js';

/** 매 테스트 후 토글 원복(기본 전부 false). */
afterEach(() => {
  FEATURE_FLAGS.reviewEngine = false;
  FEATURE_FLAGS.modules.opinion = false;
  FEATURE_FLAGS.modules.division = false;
  FEATURE_FLAGS.modules.patent = false;
});

test('기본값: 모든 토글 false (이 작업에서 아무것도 안 켬)', () => {
  assert.equal(FEATURE_FLAGS.reviewEngine, false);
  assert.deepEqual(FEATURE_FLAGS.modules, { opinion: false, division: false, patent: false });
});

test('진리표 ①: 마스터 OFF → 모듈 토글 무관하게 전부 무동작', () => {
  FEATURE_FLAGS.reviewEngine = false;
  FEATURE_FLAGS.modules.opinion = true; // 모듈을 켜도
  FEATURE_FLAGS.modules.division = true;
  FEATURE_FLAGS.modules.patent = true;
  assert.equal(isModuleEnabled('opinion'), false);
  assert.equal(isModuleEnabled('division'), false);
  assert.equal(isModuleEnabled('patent'), false);
  assert.equal(isModuleEnabled(), false, '인자 없음(마스터)도 OFF');
});

test('진리표 ②: 마스터 ON + opinion만 ON → opinion 발화, division/patent OFF', () => {
  FEATURE_FLAGS.reviewEngine = true;
  FEATURE_FLAGS.modules.opinion = true;
  assert.equal(isModuleEnabled('opinion'), true, 'opinion 활성');
  assert.equal(isModuleEnabled('division'), false, 'division 격리(미검증)');
  assert.equal(isModuleEnabled('patent'), false, 'patent 격리(미검증)');
});

test('진리표 ③: 마스터 ON + 모듈 전부 OFF → 무동작', () => {
  FEATURE_FLAGS.reviewEngine = true;
  assert.equal(isModuleEnabled('opinion'), false);
  assert.equal(isModuleEnabled('division'), false);
  assert.equal(isModuleEnabled('patent'), false);
});

test('후방호환: isModuleEnabled() 인자 없으면 마스터만 검사', () => {
  FEATURE_FLAGS.reviewEngine = false;
  assert.equal(isModuleEnabled(), false, '마스터 OFF → false');
  FEATURE_FLAGS.reviewEngine = true;
  assert.equal(isModuleEnabled(), true, '마스터 ON → true(모듈 무관, 후방호환)');
});

test('engine.run 게이트: 마스터 ON + 해당 모듈 OFF → skipped(무동작)', () => {
  FEATURE_FLAGS.reviewEngine = true;
  FEATURE_FLAGS.modules.opinion = false;
  const res = engine.run({ module: 'opinion' }, {});
  assert.equal(res.skipped, true, 'opinion OFF → skip');
  assert.equal(res.phase, 'idle');
});

test('engine.run 게이트: division/patent 는 OFF라 항상 skip(미검증 격리)', () => {
  FEATURE_FLAGS.reviewEngine = true;
  FEATURE_FLAGS.modules.opinion = true; // opinion만 켜도
  assert.equal(engine.run({ module: 'division' }, {}).skipped, true, 'division skip');
  assert.equal(engine.run({ module: 'patent' }, {}).skipped, true, 'patent skip');
  // opinion 은 ON이라 게이트 통과 → 커널 미구현 throw(게이트는 통과했다는 증거)
  assert.throws(() => engine.run({ module: 'opinion' }, {}), /kernel not implemented/);
});
