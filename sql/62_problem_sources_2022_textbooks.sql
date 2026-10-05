-- =============================================
-- 62. 2022 개정 교육과정으로 배운 기출에 학교별 교과서를 채운다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/62_problem_sources_2022_textbooks.sql
-- =============================================
-- 배경(2026-10-05 원장님): 2022 개정 교육과정은 **2025 중1 → 2026 중2 → 2027 중3** 순으로 올라간다.
--   그해 그 학년보다 아래 학년은 당연히 새 교육과정이다(2026 중1, 2027 중1·중2 …).
--   그 시험지에 학교가 고른 2022 개정 교과서를 넣는다:
--     광희중 천재(정호웅) · 동마중 동아 · 무학중 중1 미래엔(신유식) / 중2 비상(박영민)
--     한대부중 비상(박현숙) · 압구정중 비상(박현숙) · 행당중 해냄
--   이름은 카테고리 관리(exam.publishers)의 **2022 개정 쪽 이름 그대로**다 — 2015 개정 책은 이름 뒤에
--   '(2015개정)' 이 붙어 따로 있다. 미래엔은 중1·중2 단원이 등록된 '미래엔(신유식)' 이다('미래엔(2015개정)' 아님).
--   무학중 중3 은 아직 모른다 — 표에 없으니 2027 중3 기출이 들어와도 비어 있다.
--
-- ⚠️ 2015 개정으로 배운 시험지(2025 중2·중3, 2026 중3, 2024 이전 전부)는 **건드리지 않는다.**
--    그쪽 교과서는 학교마다 따로 확인할 일이다.
-- ⚠️ **이미 교과서가 적힌 출처는 덮지 않는다**(손으로 고른 값이 우선). 표와 다른 책이 적혀 있으면 NOTICE 로만 알린다.
--    채우는 대상(2026-10-05 기준 16건)은 단원 태그가 하나도 없어 set_source_textbook 의 단원 정리가 필요 없다.
--    광희중 2025 중1 2학기 중간은 이미 천재(정호웅) + 단원 태그 13문항이라 그대로 둔다.
-- ⚠️ 앞으로 적재하는 기출은 ~/.claude/tools/ingest-exam.js 의 TEXTBOOK_2022 가 같은 규칙으로 채운다 —
--    학교가 교과서를 바꾸면 **둘 다** 고칠 것.
-- 다시 돌려도 안전하다(빈 칸만 채우므로 두 번째부터 0건).

BEGIN;

CREATE TEMP TABLE textbook_2022 (
  school_name TEXT NOT NULL,
  grade       TEXT,          -- NULL = 그 학교 모든 학년
  textbook    TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO textbook_2022 (school_name, grade, textbook) VALUES
  ('광희중학교',           NULL,  '천재(정호웅)'),
  ('동마중학교',           NULL,  '동아'),
  ('무학중학교',           '중1', '미래엔(신유식)'),
  ('무학중학교',           '중2', '비상(박영민)'),
  ('한양대학교부속중학교', NULL,  '비상(박현숙)'),
  ('압구정중학교',         NULL,  '비상(박현숙)'),
  ('행당중학교',           NULL,  '해냄');

-- 출처 하나가 2022 개정으로 배운 시험지인가. 학년 '중N' 이 (연도 - 2024) 이하면 그렇다.
-- 형식이 다른 값(고등·빈 칸·연도 아님)은 캐스팅 전에 걸러 false 로 둔다(WHERE 의 AND 는 순서를 보장하지 않는다).
CREATE FUNCTION pg_temp.is_curriculum_2022(p_year TEXT, p_grade TEXT) RETURNS BOOLEAN
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
  v_bad TEXT;
  v_n   INT;
  r     RECORD;
BEGIN
  -- 실행 대상 확인 — 엉뚱한 프로젝트에 붙어 있으면 여기서 멈춘다
  IF to_regclass('exam.problem_sources') IS NULL OR to_regclass('exam.publishers') IS NULL
     OR to_regclass('public.schools') IS NULL THEN
    RAISE EXCEPTION 'exam.problem_sources / exam.publishers / public.schools 가 없습니다 (현재 DB: %)',
      current_database();
  END IF;

  -- 표의 교과서 이름이 카테고리 관리에 그대로 있어야 한다 — 아니면 교과서 필터·단원 트리가 둘로 갈린다
  SELECT string_agg(DISTINCT m.textbook, ', ') INTO v_bad
    FROM textbook_2022 m
   WHERE NOT EXISTS (SELECT 1 FROM exam.publishers p WHERE p.name = m.textbook AND p.level = '중등');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '카테고리 관리(exam.publishers, 중등)에 없는 교과서: %', v_bad;
  END IF;

  SELECT string_agg(DISTINCT m.school_name, ', ') INTO v_bad
    FROM textbook_2022 m
   WHERE (SELECT count(*) FROM public.schools s WHERE s.name = m.school_name) <> 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'public.schools 에 정확히 하나로 있지 않은 학교: %', v_bad;
  END IF;

  -- 한 출처에 두 줄이 걸리면(같은 학교에 '모든 학년' 줄과 학년 줄이 함께 있으면) 어느 책인지 모른다
  SELECT string_agg(DISTINCT a.school_name, ', ') INTO v_bad
    FROM textbook_2022 a JOIN textbook_2022 b
      ON a.school_name = b.school_name AND a.ctid <> b.ctid
     AND (a.grade IS NULL OR b.grade IS NULL OR a.grade = b.grade);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '교과서 표에서 학년이 겹치는 학교: %', v_bad;
  END IF;

  UPDATE exam.problem_sources s
     SET textbook = m.textbook
    FROM textbook_2022 m
   WHERE s.source_type = '내신기출'
     AND s.textbook = ''
     AND s.school_name = m.school_name
     AND (m.grade IS NULL OR m.grade = s.grade)
     AND pg_temp.is_curriculum_2022(s.year, s.grade);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '2022 개정 기출 %건에 교과서를 채웠습니다 (재실행이면 0)', v_n;

  -- 손으로 고른 값이 표와 다르면 덮지 않고 알린다
  FOR r IN
    SELECT s.school_name, s.year, s.grade, s.semester, s.exam_type, s.textbook, m.textbook AS expected
      FROM exam.problem_sources s
      JOIN textbook_2022 m
        ON s.school_name = m.school_name AND (m.grade IS NULL OR m.grade = s.grade)
     WHERE s.source_type = '내신기출'
       AND pg_temp.is_curriculum_2022(s.year, s.grade)
       AND s.textbook NOT IN ('', m.textbook)
     ORDER BY 1, 2, 3, 4, 5
  LOOP
    RAISE NOTICE '  표와 다른 교과서(그대로 둠): % % % % % — 적힌 값 %, 표 %',
      r.school_name, r.year, r.grade, r.semester, r.exam_type, r.textbook, r.expected;
  END LOOP;

  -- 2022 개정 중학 기출인데 여전히 비어 있는 것(표에 없는 학교·학년)
  FOR r IN
    SELECT s.school_name, s.year, s.grade, count(*) AS n
      FROM exam.problem_sources s
     WHERE s.source_type = '내신기출'
       AND s.textbook = ''
       AND pg_temp.is_curriculum_2022(s.year, s.grade)
     GROUP BY 1, 2, 3
     ORDER BY 1, 2, 3
  LOOP
    RAISE NOTICE '  교과서 미상으로 남음: % % % (%건)', r.school_name, r.year, r.grade, r.n;
  END LOOP;

  -- 결과 — 2022 개정 기출의 학교·연도·학년별 교과서
  FOR r IN
    SELECT s.school_name, s.year, s.grade, s.textbook, count(*) AS n
      FROM exam.problem_sources s
     WHERE s.source_type = '내신기출'
       AND pg_temp.is_curriculum_2022(s.year, s.grade)
     GROUP BY 1, 2, 3, 4
     ORDER BY 1, 2, 3, 4
  LOOP
    RAISE NOTICE '  % % % → % (%건)', r.school_name, r.year, r.grade,
      COALESCE(NULLIF(r.textbook, ''), '(비어 있음)'), r.n;
  END LOOP;
END
$apply$;

COMMIT;
