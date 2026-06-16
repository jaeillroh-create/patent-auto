-- ─────────────────────────────────────────────────────────────────────
-- review_runs — 통합 리뷰 엔진 결과 영속 + 비동기 폴링 테이블 (묶음 B-T1)
-- ─────────────────────────────────────────────────────────────────────
-- 목적:
--   ① 검증 결과(issues/patchPlans/consensus/rounds/budget)를 영속 → 새로고침 후 유지, 재검증 비용 0.
--   ② 비동기(202 + EdgeRuntime.waitUntil) 전환의 토대 — status 컬럼을 클라가 폴링(B-T2/B-T3).
--
-- 설계(승인):
--   - opinion·patent 공유 1개 테이블 (module 컬럼으로 구분).
--   - user_id 직접 보유(DEFAULT auth.uid()) → RLS 단순화. 모듈별 소유 컬럼 상이
--     (opinion_projects.created_by / projects.owner_user_id)와 무관하게 user_id=auth.uid() 한 줄.
--   - project_id 는 TEXT (모듈별 uuid 형식 차이 흡수).
--   - 흐름: 클라가 status='running' 행 INSERT(RLS own) → 엣지가 service_role 로 id 기준 UPDATE
--     (status='done'+result | 'failed'+error). 클라는 progressClient.subscribePolling 으로 폴.
--
-- 적용: Supabase 대시보드 SQL 에디터에 본 파일 전체를 붙여넣고 실행(권장, 안전).
--   또는 CLI: supabase db push (프로젝트 link 필요). idempotent(IF NOT EXISTS / DROP POLICY IF EXISTS)라 재실행 안전.
-- 확인: 파일 하단 [확인 쿼리] 참조.
-- 이 마이그레이션은 테이블 생성만 — 비동기 핸들러는 B-T2, 클라 폴링은 B-T3.
-- ─────────────────────────────────────────────────────────────────────

-- [1] 테이블 생성 (idempotent)
CREATE TABLE IF NOT EXISTS public.review_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL DEFAULT auth.uid(),                 -- 소유(RLS 기준)
  project_id  text        NOT NULL,                                    -- 모듈 무관(text)
  module      text        NOT NULL DEFAULT 'opinion',                  -- 'opinion' | 'patent'
  status      text        NOT NULL DEFAULT 'queued'                    -- queued|running|done|failed (폴링이 읽음)
              CHECK (status IN ('queued', 'running', 'done', 'failed')),
  phase       text,                                                    -- converged|escalated… (isDone 보조)
  result      jsonb,                                                   -- 완료 시 {issues,patchPlans,consensus,rounds,budget}
  error       text,                                                    -- 실패 사유(status='failed')
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- [2] 조회/폴링 인덱스 (사용자별 최신 run)
CREATE INDEX IF NOT EXISTS review_runs_user_proj_idx
  ON public.review_runs (user_id, project_id, module, created_at DESC);

-- [3] status CHECK 보강 — 테이블이 (구버전으로) 이미 존재해 제약이 없을 경우만 추가 (opinion_drafts_status_fix 패턴)
DO $$
DECLARE
  has_check BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.review_runs'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  ) INTO has_check;
  IF NOT has_check THEN
    ALTER TABLE public.review_runs
      ADD CONSTRAINT review_runs_status_check
      CHECK (status IN ('queued', 'running', 'done', 'failed'));
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'review_runs 테이블 미존재 — status check 스킵';
  WHEN others THEN
    RAISE NOTICE 'review_runs status check 보강 실패: %', SQLERRM;
END $$;

-- [4] RLS — 사용자는 자기 행(user_id=auth.uid())만 (엣지 백그라운드는 service_role 로 RLS 우회)
ALTER TABLE public.review_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS review_runs_own ON public.review_runs;  -- idempotent(CREATE POLICY 는 IF NOT EXISTS 미지원)
CREATE POLICY review_runs_own ON public.review_runs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- [확인 쿼리] 적용 후 아래로 검증
--   -- 테이블 존재:
--   SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='review_runs';
--   -- 컬럼:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name='review_runs' ORDER BY ordinal_position;
--   -- RLS 켜짐 + 정책:
--   SELECT relrowsecurity FROM pg_class WHERE relname='review_runs';
--   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='review_runs';
--   -- status CHECK:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='public.review_runs'::regclass AND contype='c';
-- ─────────────────────────────────────────────────────────────────────
