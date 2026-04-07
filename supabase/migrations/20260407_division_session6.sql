-- 분할출원 검증-수정 루프: 세션 6 마이그레이션
-- V1: 수정 이력 + 사용자 수용 기록 컬럼 추가
-- V10: check_type_check 제약조건 제거

-- [V10] check_type 제약조건 제거 (신규 check_type 값 허용)
ALTER TABLE division_validation_results
DROP CONSTRAINT IF EXISTS division_validation_results_check_type_check;

ALTER TABLE division_validation_results
DROP CONSTRAINT IF EXISTS division_validation_results_result_check;

-- [V1] 수정 이력 추적
ALTER TABLE division_validation_results
ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;
-- 구조: [{ round, action, before, after, reason, timestamp }]

-- [V1] 사용자 수용 기록
ALTER TABLE division_validation_results
ADD COLUMN IF NOT EXISTS user_accepted_warnings JSONB DEFAULT '[]'::jsonb;
-- 구조: [{ check_index, reason, timestamp }]

-- [V1] re_verifying 상태 허용 (status 제약조건이 있다면 확장)
ALTER TABLE division_projects
DROP CONSTRAINT IF EXISTS division_projects_status_check;
