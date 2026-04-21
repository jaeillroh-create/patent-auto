-- ═══════════════════════════════════════════════════════════
-- 분할출원 검증 테이블 확장 — spec_quote, support_type
-- 작성일: 2026-04-21
-- 목적: AI 검증(LLM) 결과의 명세서 원문 인용(spec_quote)과
--       뒷받침 유형(support_type)을 DB에 영구 저장
-- ═══════════════════════════════════════════════════════════

-- 1) division_validation_results 테이블 컬럼 추가
ALTER TABLE division_validation_results
  ADD COLUMN IF NOT EXISTS spec_quote TEXT,
  ADD COLUMN IF NOT EXISTS support_type TEXT
    CHECK (support_type IS NULL OR support_type IN ('direct','substantial','derivable','none'));

-- 2) 주석
COMMENT ON COLUMN division_validation_results.spec_quote IS
  'AI 검증 시 LLM이 발췌한 명세서 근거 원문 (30~200자)';
COMMENT ON COLUMN division_validation_results.support_type IS
  '뒷받침 유형: direct=직접 기재, substantial=실질적 뒷받침, derivable=자명한 도출, none=근거 없음';

-- 적용 확인:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name='division_validation_results'
-- AND column_name IN ('spec_quote','support_type');
