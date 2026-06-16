-- ─────────────────────────────────────────────────────────────────────
-- review_runs stale 'running' 자동 회수 — wall-clock 사망분 위생 (③ 고착 정리)
-- ─────────────────────────────────────────────────────────────────────
-- 배경:
--   Edge worker 가 wall-clock(~150s) 초과로 강제 종료되면 review-orchestrate 의
--   백그라운드(EdgeRuntime.waitUntil)가 persistRun 을 실행하지 못해, 행이
--   status='running' 으로 영구 박제된다(created=updated 고착, DB 확정).
--   새 검증은 매번 새 INSERT 라 고착이 신규 검증을 "막지는" 않지만(위생 문제),
--   누적·오표시(최신 run 조회 시 stale running)를 방지한다.
--
-- 해결 (앱 코드 0):
--   [1] cleanup_stale_review_runs() 함수 — running 이며 일정시간 무갱신인 행을 failed 로.
--   [2] 즉시 1회 실행 — 기존 고착 행(예: 현재 2건) 즉시 회수.
--   [3] pg_cron 으로 주기 실행(매 5분) — 이후 사망분 자동 회수.
--
-- 안전 (★ 진행 중 정상 run 을 죽이지 않음):
--   - 기준 5분(> worker wall-clock ~150s) → 진행 중 정상 run(<5분)은 절대 회수 대상 아님.
--   - owner(postgres)/SECURITY DEFINER 로 실행 → RLS 우회(전 사용자 회수). 시크릿 0.
--   - kernel 0. review_runs 스키마(20260616_review_runs.sql) 불변(컬럼 추가 없음).
--
-- 적용 방법:
--   ★ 권장: Supabase 대시보드 → SQL Editor 에 본 파일 전체를 붙여넣고 Run.
--     (대시보드 세션은 postgres 권한 → CREATE EXTENSION / cron.schedule 가능)
--   또는 CLI: supabase db push (프로젝트 link 필요). idempotent 라 재실행 안전.
--
--   pg_cron 미설치 시:
--     - [1] 함수 + [2] 즉시 회수는 그대로 적용되고, [3] 주기 잡만 스킵된다(하드 실패 없음).
--     - 대시보드 → Database → Extensions 에서 "pg_cron" 토글 ON → 본 파일 재실행하면 [3] 등록.
-- ─────────────────────────────────────────────────────────────────────

-- [1] 회수 함수 (idempotent: CREATE OR REPLACE). 기본 임계 5분.
--     running 이며 updated_at 이 임계를 초과(무갱신)한 행만 failed 로. 반환=회수 건수.
CREATE OR REPLACE FUNCTION public.cleanup_stale_review_runs(p_timeout interval DEFAULT interval '5 minutes')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.review_runs
     SET status     = 'failed',
         error      = 'wall-clock timeout (worker 사망 추정 — 자동정리)',
         updated_at = now()
   WHERE status = 'running'
     AND updated_at < now() - p_timeout;   -- ★ 5분 미만(진행 중)은 제외
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMENT ON FUNCTION public.cleanup_stale_review_runs(interval) IS
  'review_runs 의 running 고착(wall-clock 사망분, updated_at 이 임계 초과)을 failed 로 회수. pg_cron 주기 실행 + 수동 호출용.';

-- [2] 즉시 1회 실행 — 기존 고착 행 회수(5분 기준이라 진행 중 run 은 제외).
DO $$
DECLARE
  recovered integer;
BEGIN
  recovered := public.cleanup_stale_review_runs();
  RAISE NOTICE '기존 고착 review_runs 회수: % 건', recovered;
END $$;

-- [3] pg_cron 주기 등록 (설치돼 있을 때만; 없으면 안내만 — 하드 실패 금지).
DO $$
BEGIN
  -- 3a) pg_cron 자동 활성화 시도(권한 있으면 성공, 없으면 NOTICE 후 진행 — [1][2]는 이미 적용됨).
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'pg_cron 자동 활성화 실패(%) — 대시보드 Database>Extensions 에서 수동 활성화 후 본 파일 재실행', SQLERRM;
  END;

  -- 3b) 설치돼 있으면 잡 (재)등록(idempotent: 동명 잡 있으면 unschedule 후 schedule).
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_stale_review_runs') THEN
      PERFORM cron.unschedule('cleanup_stale_review_runs');
    END IF;
    PERFORM cron.schedule(
      'cleanup_stale_review_runs',
      '*/5 * * * *',                                   -- 매 5분(임계 5분과 정합 — 사망분 최대 ~10분 내 회수)
      $cron$ SELECT public.cleanup_stale_review_runs(); $cron$
    );
    RAISE NOTICE 'pg_cron 잡 등록 완료: cleanup_stale_review_runs (매 5분)';
  ELSE
    RAISE NOTICE 'pg_cron 미설치 — 주기 잡 미등록([1] 함수 + [2] 즉시회수만 적용). 활성화 후 본 파일 재실행 요망.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- [확인 쿼리] 적용 후 아래로 검증
--   -- 함수 존재:
--   SELECT proname FROM pg_proc WHERE proname='cleanup_stale_review_runs';
--   -- 수동 1회 실행(회수 건수 반환):
--   SELECT public.cleanup_stale_review_runs();
--   -- 남은 running(고착 없어야 정상; 있으면 진행 중=5분 이내):
--   SELECT id, status, created_at, updated_at, now()-updated_at AS age
--     FROM public.review_runs WHERE status='running' ORDER BY updated_at;
--   -- pg_cron 잡 등록 확인:
--   SELECT jobname, schedule, command, active FROM cron.job WHERE jobname='cleanup_stale_review_runs';
--   -- 잡 실행 이력(최근 5):
--   SELECT status, return_message, start_time, end_time FROM cron.job_run_details
--     WHERE jobid=(SELECT jobid FROM cron.job WHERE jobname='cleanup_stale_review_runs')
--     ORDER BY start_time DESC LIMIT 5;
-- ─────────────────────────────────────────────────────────────────────
