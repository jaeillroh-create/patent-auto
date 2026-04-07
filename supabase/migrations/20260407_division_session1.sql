-- 분할출원 개선 세션 1: 기반 인프라 마이그레이션
-- T1: spec_full_text, auto_verify_issues 컬럼 추가

-- [1] division_projects — 명세서 전문 저장 컬럼 추가
ALTER TABLE division_projects
ADD COLUMN IF NOT EXISTS spec_full_text TEXT;

-- [2] division_validation_results — 코드 레벨 검증 결과 저장
ALTER TABLE division_validation_results
ADD COLUMN IF NOT EXISTS auto_verify_issues JSONB DEFAULT '[]'::jsonb;
