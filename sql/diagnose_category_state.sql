-- =============================================
-- 카테고리 상태 진단 (마이그레이션 아님 — 읽기 전용, 순서 무관)
-- 실행: Supabase SQL Editor
-- =============================================
-- 목적: 중복이 어디에 얼마나 남아 있는지, 스키마가 어느 단계인지 한 번에 본다.
-- 아무것도 바꾸지 않으므로 언제든 몇 번이든 실행해도 안전하다.

-- 0) normalize_category_name 이 어느 스키마에 있는가
--    'exam' 만 나와야 정상. 'public' 이 나오면 sql/16 의 옛 버전이 무자격 CREATE 로
--    ara-system 의 public 스키마에 함수를 만든 것이다(수정 전 파일의 결함).
--    ara-system 에는 동명 함수가 없어 덮어쓴 피해는 없지만, 공유 스키마 오염이므로 지운다.
SELECT n.nspname AS schema, p.proname AS function
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'normalize_category_name'
ORDER BY n.nspname;

-- 1) 스키마 단계 — sql/15 적용 여부
SELECT
  'categories.year'          AS column_name,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='exam' AND table_name='categories' AND column_name='year') AS exists
UNION ALL SELECT 'school_materials.year',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='exam' AND table_name='school_materials' AND column_name='year')
UNION ALL SELECT 'concept_sheets.year',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='exam' AND table_name='concept_sheets' AND column_name='year')
UNION ALL SELECT 'concept_sheets.school_name',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='exam' AND table_name='concept_sheets' AND column_name='school_name');

-- 2) 표기 변형이 남아 있는 출판사 (hex 가 다르면 눈에 같아도 다른 값이다)
SELECT publisher,
       length(publisher) AS len,
       encode(convert_to(publisher, 'UTF8'), 'hex') AS hex,
       count(*) AS rows
FROM exam.concept_sheets
GROUP BY publisher
HAVING count(*) > 0
ORDER BY publisher;

-- 3) categories 쪽 같은 확인
SELECT publisher,
       length(publisher) AS len,
       encode(convert_to(publisher, 'UTF8'), 'hex') AS hex,
       count(*) AS rows
FROM exam.categories
GROUP BY publisher
ORDER BY publisher;

-- 4) 마스터 출판사 목록
SELECT id, level, name,
       length(name) AS len,
       encode(convert_to(name, 'UTF8'), 'hex') AS hex
FROM exam.publishers
ORDER BY level, name;
