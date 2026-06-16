-- =============================================
-- rename 동기화 트리거에 concept_sheets(개념지) 추가
-- 실행: Supabase SQL Editor 에서 실행
-- =============================================
-- 배경:
--   단어 테스트지(categories) 와 시험지(exams) 는 categories 를 id 로 참조하므로
--   출판사/대단원/소단원 이름을 마스터에서 바꾸면 sync_*_name 트리거가
--   categories.publisher/chapter/sub_chapter 텍스트를 갱신해 자동으로 따라온다.
--   반면 개념지(concept_sheets) 는 생성 시점에 카테고리 텍스트를
--   publisher/unit/subunit 로 "복사"해 저장하므로, 이름을 바꿔도 옛 개념지가
--   따라오지 않아 단어지와 개념지에 같은 출판사가 두 표기로 갈라져 보였다.
--
-- 조치(아키텍처 방향 A):
--   기존 rename 트리거 3개에 concept_sheets 갱신을 추가해, 마스터 이름을 한 번
--   바꾸면 단어지(categories)·개념지(concept_sheets) 가 동시에 따라오게 한다.
--   concept_sheets 는 categories 와 컬럼명이 다르다: chapter→unit, sub_chapter→subunit.
--   외부지문(schools/school_materials) 트리거는 concept_sheets 가 중등/고등만
--   다루므로 대상이 아니다.
--
-- 주의:
--   - concept_sheets 에는 자연키 유니크 제약이 없어, categories 와 달리 동일 표기로
--     수렴해도 충돌(에러)이 나지 않는다(행이 그대로 합쳐져 보임).
--   - 이 마이그레이션 적용 전에 기존 공백/표기 변형은 한 번 정리해 둘 것
--     (예: '비상 (박현숙)' → '비상(박현숙)'). 정리 후 적용해야 향후 rename 이
--     올바른 표기 기준으로 동기화된다.
--   - 함수 본문은 schema.sql 의 정의와 동일하게 유지한다(미러). 한쪽만 바꾸면
--     스키마 재적용 순서에 따라 동기화 로직이 사라지는 퇴행이 생긴다.

-- 출판사명 변경 → categories.publisher + concept_sheets.publisher 동기화
CREATE OR REPLACE FUNCTION sync_publisher_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET publisher = NEW.name
    WHERE publisher = OLD.name AND level = OLD.level;

    UPDATE concept_sheets
    SET publisher = NEW.name
    WHERE publisher = OLD.name AND level = OLD.level;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 대단원명 변경 → categories.chapter + concept_sheets.unit 동기화
CREATE OR REPLACE FUNCTION sync_major_chapter_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET chapter = NEW.name
    FROM publishers p
    WHERE categories.chapter = OLD.name
      AND categories.publisher = p.name
      AND categories.level = p.level
      AND categories.grade = OLD.grade
      AND categories.semester = OLD.semester
      AND p.id = OLD.publisher_id;

    UPDATE concept_sheets
    SET unit = NEW.name
    FROM publishers p
    WHERE concept_sheets.unit = OLD.name
      AND concept_sheets.publisher = p.name
      AND concept_sheets.level = p.level
      AND concept_sheets.grade = OLD.grade
      AND concept_sheets.semester = OLD.semester
      AND p.id = OLD.publisher_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 소단원명 변경 → categories.sub_chapter + concept_sheets.subunit 동기화
CREATE OR REPLACE FUNCTION sync_sub_chapter_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET sub_chapter = NEW.name
    FROM major_chapters mc
    JOIN publishers p ON p.id = mc.publisher_id
    WHERE categories.sub_chapter = OLD.name
      AND categories.chapter = mc.name
      AND categories.publisher = p.name
      AND categories.level = p.level
      AND categories.grade = mc.grade
      AND categories.semester = mc.semester
      AND mc.id = OLD.major_chapter_id;

    UPDATE concept_sheets
    SET subunit = NEW.name
    FROM major_chapters mc
    JOIN publishers p ON p.id = mc.publisher_id
    WHERE concept_sheets.subunit = OLD.name
      AND concept_sheets.unit = mc.name
      AND concept_sheets.publisher = p.name
      AND concept_sheets.level = p.level
      AND concept_sheets.grade = mc.grade
      AND concept_sheets.semester = mc.semester
      AND mc.id = OLD.major_chapter_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 자체는 schema.sql 에서 이미 생성됨(AFTER UPDATE). 본 마이그레이션은
-- 함수 본문만 CREATE OR REPLACE 로 교체하므로 트리거 재생성은 불필요하다.
