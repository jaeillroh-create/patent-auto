-- ─────────────────────────────────────────────────────────────────────
-- opinion_opinion_drafts 테이블 mismatch 추정 수정
-- ─────────────────────────────────────────────────────────────────────
-- 배경: Cycle 7 이후 콘솔에 다음 에러가 보고됨
--   "Failed to load resource: 400 (.../opinion_drafts)"
-- 시점: startOpinionDraft()의 INSERT 호출 직후
--
-- 코드(opinion.js)가 보내는 payload:
--   { project_id: uuid, opinion_type: text, content: jsonb,
--     status: 'draft' | 'contamination_blocked' }
--
-- 추정 원인 (실제 스키마 미열람 — 실제 환경에서 검증 필요):
--   ① status CHECK 제약에 'contamination_blocked' 가 미포함
--      → Cycle 6에서 신규 추가된 status인데 DB constraint 미반영 가능
--   ② RLS 정책이 INSERT를 막을 수 있음 (created_by/expert_id 미설정)
--   ③ NOT NULL 컬럼(예: created_by) 누락
--
-- 본 마이그레이션은 ①에 대한 수정안. ②③은 콘솔의 details/hint/code
-- 로그를 확인 후 별도 패치.
-- ─────────────────────────────────────────────────────────────────────

-- [1] status 값 'contamination_blocked' 허용
--     기존 CHECK 제약에 신규 status가 누락된 경우 → 제약 재생성
DO $$
DECLARE
  cons_name TEXT;
BEGIN
  -- 기존 status check constraint 명 조회 후 삭제
  SELECT conname INTO cons_name
    FROM pg_constraint
   WHERE conrelid = 'public.opinion_opinion_drafts'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF cons_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.opinion_opinion_drafts DROP CONSTRAINT ' || quote_ident(cons_name);
  END IF;

  -- 새 CHECK 제약: 코드가 사용하는 모든 status 포함
  ALTER TABLE public.opinion_opinion_drafts
    ADD CONSTRAINT opinion_opinion_drafts_status_check
    CHECK (status IN ('draft', 'contamination_blocked', 'approved', 'finalized'));
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'opinion_opinion_drafts 테이블 미존재 — 본 마이그레이션 스킵';
  WHEN others THEN
    RAISE NOTICE 'status check 재생성 실패: %', SQLERRM;
END $$;

-- [2] (선택) RLS 정책 점검 — 현재 사용자가 INSERT 가능한지 확인
--     아래 SELECT로 정책 목록 조회 후 필요 시 수정
--
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
--                         pg_get_expr(polwithcheck, polrelid) AS check_expr
--   FROM pg_policy
--  WHERE polrelid = 'public.opinion_opinion_drafts'::regclass;
--
-- 일반적 패턴 (다른 opinion_* 테이블과 동일하게):
-- DROP POLICY IF EXISTS opinion_opinion_drafts_insert_own ON public.opinion_opinion_drafts;
-- CREATE POLICY opinion_opinion_drafts_insert_own ON public.opinion_opinion_drafts
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM public.opinion_projects op
--        WHERE op.id = project_id
--          AND op.created_by = auth.uid()
--     )
--   );

-- [3] (참고) 코드와 테이블 간 컬럼 키 비교 — 콘솔 로그 기반 점검 가이드
--
--   코드가 보내는 키:        DB 컬럼 (예상):
--   ─────────────────────    ────────────────
--   project_id (uuid)        project_id        ← 매치 필수
--   opinion_type (text)      opinion_type      ← 매치 필수
--   content (jsonb)          content           ← 매치 필수
--   status (text)            status            ← 매치 필수, CHECK 제약 일치 필수
--
--   확인 SQL:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='opinion_opinion_drafts'
--    ORDER BY ordinal_position;
