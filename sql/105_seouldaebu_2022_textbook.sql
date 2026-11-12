-- =============================================
-- 105. 서울사대부중 2022 개정 기출에 교과서 천재(노미숙)을 채운다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/105_seouldaebu_2022_textbook.sql
-- =============================================
-- 배경(2026-11-13 원장님): "서울사대부중 2022 개정은 천재(노미숙)". sql/62 의 학교표에 없던 학교다.
--   대상은 2022 개정으로 배운 시험지(학년 '중N' ≤ 연도 − 2024)뿐 — 지금은 2025 중1·2026 중1 2건.
--   이름은 카테고리 관리(exam.publishers)의 2022 개정 쪽 '천재(노미숙)' 그대로('천재(노미숙)(2015개정)' 아님).
--
-- ⚠️ 2015 개정으로 배운 시험지(2025 중2·중3, 2026 중3, 2024 이전)는 **무조건 건드리지 않는다**(원장님 2026-11-13:
--    "15개정은 무조건 냅둬"). 학교별 2015 교과서를 알아도 채우지 않는다.
-- ⚠️ 이미 교과서가 적힌 출처는 덮지 않는다. 단원 태그가 붙은 출처가 대상에 끼면 멈춘다
--    (교과서를 바꾸면 단원 정리가 필요하다 — 그때는 set_source_textbook 으로 할 일).
-- ⚠️ 앞으로 적재하는 기출은 ~/.claude/tools/ingest-exam.js 의 TEXTBOOK_2022 가 같은 값으로 채운다(같은 날 추가).
-- 다시 돌려도 안전하다(빈 칸만 채우므로 두 번째부터 0건).

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.is_curriculum_2022(p_year TEXT, p_grade TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_grade ~ '^중[1-3]$' AND p_year ~ '^[0-9]{4}$'
      THEN substr(p_grade, 2)::int <= p_year::int - 2024
    ELSE FALSE
  END;
$$;

DO $apply$
DECLARE
  c_school   CONSTANT TEXT := '서울사대부중학교';
  c_textbook CONSTANT TEXT := '천재(노미숙)';
  v_n        INT;
  r          RECORD;
BEGIN
  IF to_regclass('exam.problem_sources') IS NULL OR to_regclass('exam.publishers') IS NULL
     OR to_regclass('public.schools') IS NULL THEN
    RAISE EXCEPTION 'exam.problem_sources / exam.publishers / public.schools 가 없습니다 (현재 DB: %)',
      current_database();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM exam.publishers p WHERE p.name = c_textbook AND p.level = '중등') THEN
    RAISE EXCEPTION '카테고리 관리(exam.publishers, 중등)에 없는 교과서: %', c_textbook;
  END IF;
  IF (SELECT count(*) FROM public.schools s WHERE s.name = c_school) <> 1 THEN
    RAISE EXCEPTION 'public.schools 에 정확히 하나로 있지 않은 학교: %', c_school;
  END IF;

  IF EXISTS (
    SELECT 1 FROM exam.problem_sources s
     WHERE s.source_type = '내신기출' AND s.school_name = c_school AND coalesce(s.textbook, '') = ''
       AND pg_temp.is_curriculum_2022(s.year, s.grade)
       AND (EXISTS (SELECT 1 FROM exam.problems p WHERE p.source_id = s.id AND cardinality(p.unit_path) > 0)
            OR EXISTS (SELECT 1 FROM exam.passages a WHERE a.source_id = s.id AND cardinality(a.unit_path) > 0))
  ) THEN
    RAISE EXCEPTION '단원 태그가 붙은 출처가 대상에 있습니다 — set_source_textbook 으로 단원까지 정리할 것';
  END IF;

  UPDATE exam.problem_sources s
     SET textbook = c_textbook
   WHERE s.source_type = '내신기출'
     AND s.school_name = c_school
     AND coalesce(s.textbook, '') = ''
     AND pg_temp.is_curriculum_2022(s.year, s.grade);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '서울사대부중 2022 개정 기출 %건에 교과서를 채웠습니다 (재실행이면 0)', v_n;

  FOR r IN
    SELECT s.year, s.grade, s.semester, s.exam_type, s.textbook
      FROM exam.problem_sources s
     WHERE s.source_type = '내신기출' AND s.school_name = c_school
       AND pg_temp.is_curriculum_2022(s.year, s.grade) AND s.textbook <> c_textbook
     ORDER BY 1, 2, 3, 4
  LOOP
    RAISE NOTICE '  표와 다른 교과서(그대로 둠): % % % % — 적힌 값 %', r.year, r.grade, r.semester, r.exam_type,
      COALESCE(NULLIF(r.textbook, ''), '(비어 있음)');
  END LOOP;

  FOR r IN
    SELECT s.year, s.grade, pg_temp.is_curriculum_2022(s.year, s.grade) AS c2022,
           COALESCE(NULLIF(s.textbook, ''), '(비어 있음)') AS textbook, count(*) AS n
      FROM exam.problem_sources s
     WHERE s.source_type = '내신기출' AND s.school_name = c_school
     GROUP BY 1, 2, 3, 4 ORDER BY 1, 2
  LOOP
    RAISE NOTICE '  % % [%] → % (%건)', r.year, r.grade, CASE WHEN r.c2022 THEN '2022' ELSE '2015 — 그대로' END,
      r.textbook, r.n;
  END LOOP;
END
$apply$;

COMMIT;
