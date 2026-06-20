-- ─────────────────────────────────────────────────────────────────────
-- opinion_projects.status — 컬럼 폭 확장(varchar→text) + CHECK 제약 전수 재정의
-- ─────────────────────────────────────────────────────────────────────
-- 배경 (사용자 F12/SQL 확인):
--   의견서 "작성 중" 멈춤 — 본문(opinion_opinion_drafts)은 INSERT 성공했으나
--   startOpinionDraft() 마지막의 setStatus(p.id,'opinion_drafted') 가 조용히 실패.
--   Opinion.setStatus() 는 실패를 throw 하지 않고 {ok:false}+토스트로 삼켜(opinion.js:4127)
--   상태가 'drafting_opinion'(작성 중)에 묶여 7단계(의견서 초안)로 진행되지 않음 → 무증상 멈춤.
--
--   직접 원인: opinion_projects.status 가
--     (a) CHECK 제약에 'opinion_drafted' 등 일부 status 미포함, 또는
--     (b) varchar(N) 으로 폭이 좁아 긴 status('correction_validated'=20자,
--         'allowable_identified'=20자, 'deficiency_analyzed'=19자 등)를 거부
--   → opinion_opinion_drafts(#185, 20260617_opinion_drafts_status_text.sql) 컬럼 수정으로
--     INSERT 가 처음 성공해 비로소 도달한 "2차 관문"이 setStatus 였음.
--
-- 본 마이그레이션: opinion_projects.status 를 text 로 확장 + CHECK 를
--   코드(opinion.js)가 실제로 쓰는 status 전부로 재정의(빠지면 또 멈춤).
--
-- ★ status 전수 — opinion.js Opinion.STATUS 맵(line 18-31) = 권위 목록.
--   setStatus 호출처(grep) 전수 추적 결과(직접 인서트 'created'/'type_determined' 포함,
--   STEP_TO_RESET_STATUS·startDraft·startValidation·gate 분기까지) 모두 아래 28개에 수렴함.
--   init   : created, parsing, parsed, parse_failed, type_determined
--   strategy: analyzing, analyzed, strategy_confirmed, deficiency_analyzed,
--             correction_confirmed, allowable_identified, merge_confirmed
--   draft  : drafting_claims, claims_drafted, drafting_corrections, corrections_drafted,
--             drafting_merge, merge_drafted, validating, validated,
--             correction_validated, merge_validated
--   opinion: claims_confirmed, drafting_opinion, opinion_drafted
--   output : approved, generating_docs, completed
--
-- 적용: 대시보드 SQL Editor 붙여넣기 Run(권장) / supabase db push.
--   idempotent — 폭은 현재 varchar 일 때만 ALTER, CHECK 는 항상 drop→재생성(이름 동적 조회).
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  cons_name TEXT;
BEGIN
  -- [1] status 컬럼 폭 확장: varchar(N) → text
  --     긴 status(20자대)를 거부하는 varchar 폭 한계 제거. 이미 text면 스킵.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='opinion_projects'
       AND column_name='status' AND data_type='character varying'
  ) THEN
    ALTER TABLE public.opinion_projects ALTER COLUMN status TYPE text;
    RAISE NOTICE 'opinion_projects.status → text 변환';
  ELSE
    RAISE NOTICE 'opinion_projects.status 이미 text(또는 컬럼 없음) — 폭 확장 스킵';
  END IF;

  -- [2] 기존 status CHECK 제약(이름 동적 조회) 삭제 — 일부 status 누락분 정리
  SELECT conname INTO cons_name
    FROM pg_constraint
   WHERE conrelid = 'public.opinion_projects'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF cons_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.opinion_projects DROP CONSTRAINT ' || quote_ident(cons_name);
    RAISE NOTICE 'opinion_projects status CHECK(%) 삭제', cons_name;
  END IF;

  -- [3] 새 CHECK 제약: 코드가 쓰는 status 28개 전수(빠지면 setStatus 거부 → 또 멈춤)
  ALTER TABLE public.opinion_projects
    ADD CONSTRAINT opinion_projects_status_check
    CHECK (status IN (
      -- init
      'created', 'parsing', 'parsed', 'parse_failed', 'type_determined',
      -- strategy
      'analyzing', 'analyzed', 'strategy_confirmed', 'deficiency_analyzed',
      'correction_confirmed', 'allowable_identified', 'merge_confirmed',
      -- draft
      'drafting_claims', 'claims_drafted', 'drafting_corrections', 'corrections_drafted',
      'drafting_merge', 'merge_drafted', 'validating', 'validated',
      'correction_validated', 'merge_validated',
      -- opinion
      'claims_confirmed', 'drafting_opinion', 'opinion_drafted',
      -- output
      'approved', 'generating_docs', 'completed'
    ));
  RAISE NOTICE 'opinion_projects_status_check 재생성(28 status)';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'opinion_projects 테이블 미존재 — 본 마이그레이션 스킵';
  WHEN others THEN
    RAISE NOTICE 'opinion_projects status 보강 실패: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- [확인 쿼리]
--   SELECT column_name, data_type, character_maximum_length
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='opinion_projects' AND column_name='status';
--   -- 기대: data_type='text', character_maximum_length=NULL
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid='public.opinion_projects'::regclass AND contype='c'
--      AND pg_get_constraintdef(oid) ILIKE '%status%';
--   -- 기대: opinion_projects_status_check 에 28개 status 모두 포함
-- ─────────────────────────────────────────────────────────────────────
