-- ─────────────────────────────────────────────────────────────────────
-- opinion_opinion_drafts — status/opinion_type 컬럼 varchar → text 확장
-- ─────────────────────────────────────────────────────────────────────
-- 배경 (콘솔 확정):
--   [Opinion.DB] block-insert error: value too long for varchar(20), code 22001
--   startOpinionDraft() 의 INSERT 페이로드(opinion.js):
--     { project_id, opinion_type, content, status }
--   값 길이:
--     status='contamination_blocked' = 21자  > varchar(20) → 22001
--     opinion_type='description_deficiency' = 22자
--
-- 실측 스키마(사용자 SQL):
--     status        character varying(20)   ← 21자 'contamination_blocked' 초과 (직접 원인)
--     opinion_type  character varying(30)   ← 현재 22자 수용하나 미래 안전을 위해 text 로
--
-- 의도 스키마(20260428_opinion_drafts_status_fix.sql line 9-10/74-76)는 둘 다 text 였으나,
-- 그 마이그레이션은 status CHECK 제약만 'contamination_blocked' 허용으로 고치고(line 41)
-- 컬럼 폭(varchar→text)은 안 건드려, 값은 CHECK 통과하되 타입 폭을 초과해 22001 발생.
--
-- 본 마이그레이션: status·opinion_type 을 text 로 확장(enum 값 단축이 아니라 컬럼 확장이 정답 —
--   'description_deficiency' 등은 rejection_type 으로 코드 전반에서 쓰여 단축 불가).
--
-- 적용: 대시보드 SQL Editor 붙여넣기 Run(권장) / supabase db push. idempotent(현재 varchar 일 때만 ALTER).
--   ※ 사용자가 대시보드에서 이미 ALTER 실행함 — 본 파일은 저장소 기록(재현/감사)용.
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- status: varchar(20) → text (21자 'contamination_blocked' 초과 보완 — 직접 원인)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='opinion_opinion_drafts'
       AND column_name='status' AND data_type='character varying'
  ) THEN
    ALTER TABLE public.opinion_opinion_drafts ALTER COLUMN status TYPE text;
    RAISE NOTICE 'opinion_opinion_drafts.status → text 변환';
  ELSE
    RAISE NOTICE 'opinion_opinion_drafts.status 이미 text(또는 컬럼 없음) — 스킵';
  END IF;

  -- opinion_type: varchar(30) → text (현재 수용하나 미래 안전)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='opinion_opinion_drafts'
       AND column_name='opinion_type' AND data_type='character varying'
  ) THEN
    ALTER TABLE public.opinion_opinion_drafts ALTER COLUMN opinion_type TYPE text;
    RAISE NOTICE 'opinion_opinion_drafts.opinion_type → text 변환';
  ELSE
    RAISE NOTICE 'opinion_opinion_drafts.opinion_type 이미 text(또는 컬럼 없음) — 스킵';
  END IF;
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'opinion_opinion_drafts 테이블 미존재 — 본 마이그레이션 스킵';
  WHEN others THEN RAISE NOTICE 'opinion_opinion_drafts 컬럼 확장 실패: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- [확인 쿼리]
--   SELECT column_name, data_type, character_maximum_length
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='opinion_opinion_drafts'
--      AND column_name IN ('status','opinion_type');
--   -- 기대: data_type='text', character_maximum_length=NULL
-- ─────────────────────────────────────────────────────────────────────
