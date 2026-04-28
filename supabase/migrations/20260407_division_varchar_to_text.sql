-- 분할출원 VARCHAR→TEXT 마이그레이션
-- 'value too long for type character varying' 에러 방지

-- [1] division_projects
ALTER TABLE division_projects
  ALTER COLUMN status TYPE TEXT,
  ALTER COLUMN division_type TYPE TEXT,
  ALTER COLUMN name TYPE TEXT,
  ALTER COLUMN reference_number TYPE TEXT,
  ALTER COLUMN application_number TYPE TEXT,
  ALTER COLUMN input_mode TYPE TEXT,
  ALTER COLUMN title_ko TYPE TEXT,
  ALTER COLUMN title_en TYPE TEXT,
  ALTER COLUMN original_title_ko TYPE TEXT,
  ALTER COLUMN original_title_en TYPE TEXT;

-- [2] division_unused_components
ALTER TABLE division_unused_components
  ALTER COLUMN paragraph_number TYPE TEXT,
  ALTER COLUMN content TYPE TEXT,
  ALTER COLUMN related_element TYPE TEXT,
  ALTER COLUMN limitation_type TYPE TEXT,
  ALTER COLUMN risk_level TYPE TEXT,
  ALTER COLUMN insertion_point TYPE TEXT,
  ALTER COLUMN suggestion TYPE TEXT,
  ALTER COLUMN user_selection TYPE TEXT;

-- [3] division_claims_output
ALTER TABLE division_claims_output
  ALTER COLUMN claim_type TYPE TEXT,
  ALTER COLUMN claim_text TYPE TEXT,
  ALTER COLUMN claim_text_highlighted TYPE TEXT;

-- [4] division_claims_parsed
ALTER TABLE division_claims_parsed
  ALTER COLUMN claim_type TYPE TEXT,
  ALTER COLUMN original_text TYPE TEXT,
  ALTER COLUMN amended_text TYPE TEXT,
  ALTER COLUMN rejection_status TYPE TEXT,
  ALTER COLUMN amendment_status TYPE TEXT,
  ALTER COLUMN division_role TYPE TEXT;

-- [5] division_validation_results
ALTER TABLE division_validation_results
  ALTER COLUMN check_type TYPE TEXT,
  ALTER COLUMN target_text TYPE TEXT,
  ALTER COLUMN result TYPE TEXT,
  ALTER COLUMN detail TYPE TEXT,
  ALTER COLUMN suggestion TYPE TEXT,
  ALTER COLUMN spec_paragraph_number TYPE TEXT;

-- [6] division_files
ALTER TABLE division_files
  ALTER COLUMN file_type TYPE TEXT,
  ALTER COLUMN file_name TYPE TEXT,
  ALTER COLUMN storage_path TYPE TEXT;

-- [7] division_spec_paragraphs
ALTER TABLE division_spec_paragraphs
  ALTER COLUMN paragraph_number TYPE TEXT,
  ALTER COLUMN content TYPE TEXT;
