-- =============================================
-- user_id attribution 을 DB auth.uid() 로 강제 (정식 numbered migration 승격)
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경(High): exams / categories / concept_sheets 의 user_id 는 NOT NULL 이지만,
--   앱 코드(create_exam_with_words RPC, words-save, useConceptSheetEditor)는
--   user_id 를 보내지 않는다. 이 값을 채우는 BEFORE INSERT 트리거
--   enforce_user_id_from_auth 가 그동안 sql/archive/migration_enforce_user_id.sql
--   에만 있어서, 번호 마이그레이션(01~12)만 적용한 신규 환경에서는
--     (a) 트리거가 없어 user_id 가 NULL → NOT NULL 위반으로 모든 생성이 깨지고,
--     (b) "DB 가 auth.uid() 로 user_id 를 강제한다"는 보안 전제도 active 경로에
--         존재하지 않는 문서/실제 불일치가 발생했다.
--   본 파일은 그 트리거 정의를 archive 에서 정식 번호 마이그레이션으로 승격한다.
--   (archive/migration_enforce_user_id.sql 은 이 파일로 대체됨 — 이력 보존용)
--
-- 멱등성: 함수는 CREATE OR REPLACE, 트리거는 DROP IF EXISTS → CREATE 라
--   이미 트리거가 적용된 기존 운영 DB 에 재실행해도 안전하다(동일 재생성).
--
-- 트리거 함수는 audit_log 트리거와 동일하게 SECURITY DEFINER 로 둔다.
--   auth.uid() 가 NULL 이면(postgres 역할로 실행되는 시드/백필) 덮어쓰지 않는다.
--   SET search_path 를 고정해 무자격 객체 참조의 스키마 오염을 차단한다.

-- 1) INSERT 시 auth.uid() 로 user_id 강제
CREATE OR REPLACE FUNCTION enforce_user_id_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2) UPDATE 시 user_id 변경 차단(생성자 크레딧 탈취 방어)
CREATE OR REPLACE FUNCTION lock_user_id_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3) exams 테이블에 트리거 부착
-- 트리거 이름을 알파벳 앞쪽(aa_)으로 둬서 audit_exam_* 보다 먼저 실행되게 한다
-- (audit 트리거의 new_data 에 잠긴 user_id 가 반영되도록).
DROP TRIGGER IF EXISTS aa_enforce_user_id_exams_insert ON exams;
CREATE TRIGGER aa_enforce_user_id_exams_insert
  BEFORE INSERT ON exams
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_from_auth();

DROP TRIGGER IF EXISTS aa_lock_user_id_exams_update ON exams;
CREATE TRIGGER aa_lock_user_id_exams_update
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION lock_user_id_on_update();

-- 4) categories 테이블
DROP TRIGGER IF EXISTS aa_enforce_user_id_categories_insert ON categories;
CREATE TRIGGER aa_enforce_user_id_categories_insert
  BEFORE INSERT ON categories
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_from_auth();

DROP TRIGGER IF EXISTS aa_lock_user_id_categories_update ON categories;
CREATE TRIGGER aa_lock_user_id_categories_update
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION lock_user_id_on_update();

-- 5) concept_sheets 테이블
DROP TRIGGER IF EXISTS aa_enforce_user_id_concept_sheets_insert ON concept_sheets;
CREATE TRIGGER aa_enforce_user_id_concept_sheets_insert
  BEFORE INSERT ON concept_sheets
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_from_auth();

DROP TRIGGER IF EXISTS aa_lock_user_id_concept_sheets_update ON concept_sheets;
CREATE TRIGGER aa_lock_user_id_concept_sheets_update
  BEFORE UPDATE ON concept_sheets
  FOR EACH ROW EXECUTE FUNCTION lock_user_id_on_update();
