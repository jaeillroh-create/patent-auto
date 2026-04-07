-- 분할출원 테이블 컬럼 확인 쿼리
-- Supabase SQL Editor에서 실행

-- [1] division_claims_output 컬럼 목록
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'division_claims_output'
ORDER BY ordinal_position;

-- [2] division_projects 컬럼 목록
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'division_projects'
ORDER BY ordinal_position;

-- [3] division_unused_components 컬럼 목록
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'division_unused_components'
ORDER BY ordinal_position;

-- [4] division_validation_results 컬럼 목록
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'division_validation_results'
ORDER BY ordinal_position;

-- [5] VARCHAR→TEXT migration 적용 확인
-- data_type이 'character varying'인 컬럼이 남아있으면 migration 미적용
SELECT table_name, column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name LIKE 'division_%'
  AND data_type = 'character varying'
ORDER BY table_name, ordinal_position;

-- [6] 세션1 migration 적용 확인 (spec_full_text, auto_verify_issues)
SELECT column_name, data_type
FROM information_schema.columns
WHERE (table_name = 'division_projects' AND column_name = 'spec_full_text')
   OR (table_name = 'division_validation_results' AND column_name = 'auto_verify_issues');

-- [7] 데이터 건수 확인
SELECT 'division_projects' as tbl, count(*) as cnt FROM division_projects
UNION ALL SELECT 'division_claims_output', count(*) FROM division_claims_output
UNION ALL SELECT 'division_unused_components', count(*) FROM division_unused_components
UNION ALL SELECT 'division_validation_results', count(*) FROM division_validation_results;
