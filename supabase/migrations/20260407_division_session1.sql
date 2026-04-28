-- 분할출원 개선: 기반 인프라 마이그레이션
-- 실행 순서: 1) 20260407_division_varchar_to_text.sql → 2) 이 파일

-- [1] division_projects — 명세서 전문 저장 컬럼
ALTER TABLE division_projects
ADD COLUMN IF NOT EXISTS spec_full_text TEXT;

-- [2] division_validation_results — 코드 레벨 검증 결과
ALTER TABLE division_validation_results
ADD COLUMN IF NOT EXISTS auto_verify_issues JSONB DEFAULT '[]'::jsonb;

-- [3] division_claims_output — 조립 메타데이터 (basis 보존, 추가 구성 추적)
ALTER TABLE division_claims_output
ADD COLUMN IF NOT EXISTS draft_data JSONB DEFAULT '{}'::jsonb;

-- [4] division_unused_components — 교차검증 메타데이터 (근거 원문, overlap 경고)
ALTER TABLE division_unused_components
ADD COLUMN IF NOT EXISTS component_data JSONB DEFAULT '{}'::jsonb;

-- [5] division_projects — 신규사항 확인 결과
ALTER TABLE division_projects
ADD COLUMN IF NOT EXISTS new_matter_check TEXT;
