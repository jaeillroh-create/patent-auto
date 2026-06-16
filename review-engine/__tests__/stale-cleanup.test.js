/**
 * review-engine/__tests__/stale-cleanup.test.js
 * ③ running 고착 정리 — pg_cron 마이그레이션의 SQL 의도 잠금(텍스트 검증, 레포의 "소스 확인" 패턴).
 *
 * Postgres 실행 환경이 없으므로(노드 테스트), 마이그레이션 SQL 의 핵심 의미를 정규식으로 고정한다:
 *  - running + 임계(5분) 초과 → failed (진행 중 run 보호)
 *  - 즉시 1회 회수(기존 고착) + idempotent 함수
 *  - pg_cron 주기 등록은 "설치 시에만"(하드 실패 금지)
 *  - review_runs 스키마 불변(컬럼 추가 0 — 위생만)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const SQL = readFileSync(path.join(REPO, 'supabase/migrations/20260616_review_runs_stale_cleanup.sql'), 'utf8');

test('회수 함수: running + 임계초과(무갱신) → failed, 진행 중(<5분)은 보호', () => {
  assert.match(SQL, /status\s*=\s*'failed'/, 'failed 로 전환');
  assert.match(SQL, /WHERE\s+status\s*=\s*'running'/, 'running 행만 대상');
  assert.match(SQL, /updated_at\s*<\s*now\(\)\s*-\s*p_timeout/, '★ updated_at 임계 비교 — 진행 중(최근 갱신) 제외');
  assert.match(SQL, /interval\s*'5 minutes'/, '★ 기본 임계 5분(> worker wall-clock ~150s)');
});

test('즉시 1회 회수(기존 고착 2건) + 함수 idempotent', () => {
  assert.match(SQL, /CREATE OR REPLACE FUNCTION public\.cleanup_stale_review_runs/, 'CREATE OR REPLACE(idempotent)');
  assert.match(SQL, /recovered\s*:=\s*public\.cleanup_stale_review_runs\(\)/, '★ 즉시 1회 실행(기존 고착 회수)');
  assert.match(SQL, /GET DIAGNOSTICS\s+n\s*=\s*ROW_COUNT/, '회수 건수 반환');
  assert.match(SQL, /SECURITY DEFINER/, 'RLS 우회(전 사용자 회수) — 시크릿 0');
});

test('pg_cron 주기 등록은 설치 시에만(하드 실패 금지) + idempotent 재등록', () => {
  assert.match(SQL, /CREATE EXTENSION IF NOT EXISTS pg_cron/, '자동 활성화 시도(권한 없으면 EXCEPTION 흡수)');
  assert.match(SQL, /EXCEPTION\s+WHEN\s+others\s+THEN/, '활성화 실패해도 [1][2] 적용되도록 가드');
  assert.match(SQL, /IF EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'\)/, '★ 설치 가드(미설치 시 잡 스킵)');
  assert.match(SQL, /cron\.schedule\(/, '주기 등록');
  assert.match(SQL, /'\*\/5 \* \* \* \*'/, '매 5분');
  assert.match(SQL, /cron\.unschedule\('cleanup_stale_review_runs'\)/, '동명 잡 unschedule 후 재등록(idempotent)');
});

test('kernel/스키마 불변 — review_runs 컬럼 추가 없음(위생만), 시크릿 0', () => {
  assert.ok(!/ADD COLUMN/i.test(SQL), 'review_runs 컬럼 추가 없음');
  assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC|OPENAI|GEMINI|secret/i.test(SQL), '시크릿 참조 0');
});

test('적용 방법 문서화(대시보드 SQL Editor / db push / Extensions 토글)', () => {
  assert.match(SQL, /SQL Editor/, '대시보드 SQL Editor 안내');
  assert.match(SQL, /supabase db push/, 'CLI db push 안내');
  assert.match(SQL, /Database\s*→\s*Extensions/, 'pg_cron 수동 활성화 경로 안내');
});
