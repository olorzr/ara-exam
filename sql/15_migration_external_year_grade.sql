-- =============================================
-- 외부지문 및 프린트에 년도(year) · 학년(grade) 도입
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   외부지문 카테고리는 "학교 > 프린트/작품명" 2레벨뿐이라 같은 이름의 프린트를
--   학년도별·학년별로 구분할 수 없었다. 또 ensureCategoryId 가 외부지문의 grade 를
--   빈 문자열로 강제 저장해, grade 접두사로 중등/고등을 판정하는 levelGradeToDivision
--   (src/lib/grade-division.ts) 이 항상 NULL 을 반환 → ara-system 이 외부지문
--   개념지를 전부 중등부로 등록하는 부작용도 있었다.
--
-- 조치:
--   1) school_materials 에 year/grade 를 두어 프린트를 (학교, 년도, 학년) 조합에 붙인다.
--   2) categories 에 year 를 추가하고 자연키 유니크 인덱스를 재생성한다.
--   3) concept_sheets 에 year/school_name 을 추가해 개념지도 외부지문을 담을 수 있게 한다.
--   4) 외부지문 rename 동기화 트리거를 year/grade 로 좁히고 concept_sheets 까지 갱신한다.
--
-- 타입이 INTEGER 가 아니라 TEXT 인 이유:
--   categories.grade/semester, major_chapters.grade 가 모두 TEXT NOT NULL DEFAULT ''
--   이고, 자연키 유니크 인덱스가 빈 문자열로 "미지정"을 표현한다. NULL 을 쓰면
--   upsert(onConflict) 의 NULLS NOT DISTINCT 의미가 흔들리므로 표기를 통일한다.
--   년도는 '2026' 문자열로 저장하고 정렬은 클라이언트의 naturalCompare 가 처리한다.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용해야 한다.
--   words-save.ts 의 CATEGORY_NATURAL_KEY(upsert onConflict) 가 아래 인덱스의
--   컬럼 목록과 정확히 일치해야 하며, 앱이 먼저 배포되면 단어 저장이 전부 실패한다.
--
-- 기존 데이터: year/grade 는 '' (미지정) 으로 남는다. 앱의 Select 에서 '미지정'
--   항목으로 그대로 보이고 선택할 수 있으므로 일괄 백필은 하지 않는다.

-- ⚠️ 이 앱의 테이블은 ara-system 과 공유하는 Supabase 프로젝트의 **exam 스키마**에 있고,
--   `public` 에는 ara-system 의 동명 테이블(schools 등)이 따로 존재한다. search_path 를
--   지정하지 않고 실행하면 public 을 향해 엉뚱한 테이블을 건드리거나 함수가 public 에
--   중복 생성된다(exam 쪽은 그대로 남아 조용히 무효). 반드시 아래 설정과 함께 실행할 것.
SET search_path = exam, public;

-- ---------------------------------------------
-- 1. school_materials: 년도/학년 컬럼 + 유니크 키 확장
-- ---------------------------------------------
ALTER TABLE school_materials ADD COLUMN IF NOT EXISTS year TEXT NOT NULL DEFAULT '';
ALTER TABLE school_materials ADD COLUMN IF NOT EXISTS grade TEXT NOT NULL DEFAULT '';

-- UNIQUE(name, school_id) → UNIQUE(name, school_id, year, grade)
-- 같은 이름의 프린트를 학년도/학년별로 따로 둘 수 있어야 한다.
ALTER TABLE school_materials DROP CONSTRAINT IF EXISTS school_materials_name_school_id_key;
ALTER TABLE school_materials DROP CONSTRAINT IF EXISTS school_materials_name_school_id_year_grade_key;
ALTER TABLE school_materials
  ADD CONSTRAINT school_materials_name_school_id_year_grade_key
  UNIQUE (name, school_id, year, grade);

-- ---------------------------------------------
-- 2. categories: year 컬럼 + 자연키 유니크 인덱스 재생성
-- ---------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS year TEXT NOT NULL DEFAULT '';

-- 컬럼이 하나 늘어난 인덱스는 기존 인덱스보다 덜 제한적이므로 재생성 시 충돌하지 않는다.
DROP INDEX IF EXISTS idx_categories_natural_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_natural_key
  ON categories (level, year, grade, publisher, semester, chapter, sub_chapter, school_name)
  NULLS NOT DISTINCT;

-- ---------------------------------------------
-- 3. concept_sheets: 외부지문을 담기 위한 컬럼
-- ---------------------------------------------
-- 개념지는 카테고리를 텍스트로 복사 저장하는데 school_name 이 없어 외부지문을
-- 표현할 수 없었다(편집기 트리에도 외부지문이 없었다).
ALTER TABLE concept_sheets ADD COLUMN IF NOT EXISTS year TEXT NOT NULL DEFAULT '';
ALTER TABLE concept_sheets ADD COLUMN IF NOT EXISTS school_name TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------
-- 4. 외부지문 rename 동기화 트리거 확장
-- ---------------------------------------------
-- 학교명 변경 → categories.school_name + concept_sheets.school_name 동기화
CREATE OR REPLACE FUNCTION sync_school_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET school_name = NEW.name
    WHERE school_name = OLD.name
      AND level = '외부지문 및 프린트';

    UPDATE concept_sheets
    SET school_name = NEW.name
    WHERE school_name = OLD.name
      AND level = '외부지문 및 프린트';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 프린트/작품명 변경 → categories.chapter + concept_sheets.unit 동기화
-- year/grade 조건이 없으면 2026 중2 프린트 이름을 바꿀 때 다른 년도·학년의
-- 동명 카테고리까지 함께 바뀐다(년도/학년 도입 전에는 구분 자체가 없어 무해했다).
CREATE OR REPLACE FUNCTION sync_school_material_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET chapter = NEW.name
    FROM schools s
    WHERE categories.chapter = OLD.name
      AND categories.school_name = s.name
      AND categories.level = '외부지문 및 프린트'
      AND categories.year = OLD.year
      AND categories.grade = OLD.grade
      AND s.id = OLD.school_id;

    UPDATE concept_sheets
    SET unit = NEW.name
    FROM schools s
    WHERE concept_sheets.unit = OLD.name
      AND concept_sheets.school_name = s.name
      AND concept_sheets.level = '외부지문 및 프린트'
      AND concept_sheets.year = OLD.year
      AND concept_sheets.grade = OLD.grade
      AND s.id = OLD.school_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 자체는 01_schema.sql 에서 이미 생성됨(AFTER UPDATE). 본 마이그레이션은
-- 함수 본문만 CREATE OR REPLACE 로 교체하므로 트리거 재생성은 불필요하다.
