-- =============================================
-- 106. 고1 공통국어(2022 개정) 기출 3건에 같은 학교·해 다른 시험의 교과서를 채운다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/106_high_2022_textbook_from_sibling.sql
-- =============================================
-- 배경(2026-11-13 원장님): 기출 공유 사이트가 가져올 때 같은 학교·학년·해의 다른 시험 교과서로 채운 3건을
--   "문제은행도 똑같이" 채운다. 셋 다 2022 개정 고1 공통국어이고, 형제 시험의 교과서가 한 가지뿐이다.
--     2025 성수고 1학년 1학기 중간·기말 공통국어1 ← 같은 해 2학기 중간·기말 공통국어2 = 공통국어 창비
--     2026 무학여고 1학년 1학기 중간 공통국어1     ← 같은 학기 기말 공통국어1 = 공통국어 천재(김수학)
--   대상은 출처 id 로 못박는다 — 이 규칙으로 다른 시험지를 새로 채우지 않는다.
--
-- ⚠️ 2015 개정 시험지는 무조건 건드리지 않는다(원장님 "15개정은 무조건 냅둬", sql/105 참고).
-- ⚠️ 이미 교과서가 적힌 출처는 덮지 않는다. 형제 시험의 교과서가 바뀌었거나 둘로 갈렸으면, 또는 단원 태그가
--    붙었으면 멈춘다(교과서를 바꾸면 단원 정리가 필요하다 — 그때는 set_source_textbook 으로 할 일).
-- 다시 돌려도 안전하다(빈 칸만 채우므로 두 번째부터 0건).

BEGIN;

CREATE TEMP TABLE fill_106 (
  source_id UUID PRIMARY KEY,
  textbook  TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO fill_106 (source_id, textbook) VALUES
  ('3dabce32-78ce-5d08-9cba-a3014b2cc2ae', '공통국어 창비'),         -- 2025 성수고 1학년 1학기 중간 공통국어1
  ('c31f5292-7283-53c8-a6e9-4be3021fe358', '공통국어 창비'),         -- 2025 성수고 1학년 1학기 기말 공통국어1
  ('07642a43-92a1-55de-bb8d-c70dde2b593c', '공통국어 천재(김수학)'); -- 2026 무학여고 1학년 1학기 중간 공통국어1

DO $apply$
DECLARE
  v_bad TEXT;
  v_n   INT;
  r     RECORD;
BEGIN
  IF to_regclass('exam.problem_sources') IS NULL OR to_regclass('exam.publishers') IS NULL THEN
    RAISE EXCEPTION 'exam.problem_sources / exam.publishers 가 없습니다 (현재 DB: %)', current_database();
  END IF;

  SELECT string_agg(DISTINCT f.textbook, ', ') INTO v_bad
    FROM fill_106 f
   WHERE NOT EXISTS (SELECT 1 FROM exam.publishers p WHERE p.name = f.textbook AND p.level = '고등');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '카테고리 관리(exam.publishers, 고등)에 없는 교과서: %', v_bad;
  END IF;

  -- 대상이 모두 있고, 2022 개정 고1 내신기출이어야 한다
  SELECT string_agg(f.source_id::text, ', ') INTO v_bad
    FROM fill_106 f
    LEFT JOIN exam.problem_sources s ON s.id = f.source_id
   WHERE s.id IS NULL OR s.source_type <> '내신기출' OR s.grade <> '고1' OR s.year !~ '^[0-9]{4}$' OR s.year::int < 2025;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '대상이 없거나 2022 개정 고1 내신기출이 아닙니다: %', v_bad;
  END IF;

  -- 같은 학교·학년·해의 다른 시험(교과서가 적힌 것)이 지금도 그 한 가지 교과서뿐이어야 한다
  FOR r IN
    SELECT s.title, f.textbook,
           (SELECT string_agg(DISTINCT b.textbook, ' / ') FROM exam.problem_sources b
             WHERE b.source_type = '내신기출' AND b.id <> s.id AND b.school_name = s.school_name
               AND b.grade = s.grade AND b.year = s.year AND coalesce(btrim(b.textbook), '') <> '') AS siblings
      FROM fill_106 f JOIN exam.problem_sources s ON s.id = f.source_id
  LOOP
    IF r.siblings IS DISTINCT FROM r.textbook THEN
      RAISE EXCEPTION '형제 시험의 교과서가 달라졌습니다: % — 표 %, 지금 %', r.title, r.textbook, COALESCE(r.siblings, '(없음)');
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM fill_106 f JOIN exam.problem_sources s ON s.id = f.source_id
     WHERE coalesce(s.textbook, '') = ''
       AND (EXISTS (SELECT 1 FROM exam.problems p WHERE p.source_id = s.id AND cardinality(p.unit_path) > 0)
            OR EXISTS (SELECT 1 FROM exam.passages a WHERE a.source_id = s.id AND cardinality(a.unit_path) > 0))
  ) THEN
    RAISE EXCEPTION '단원 태그가 붙은 출처가 대상에 있습니다 — set_source_textbook 으로 단원까지 정리할 것';
  END IF;

  UPDATE exam.problem_sources s
     SET textbook = f.textbook
    FROM fill_106 f
   WHERE s.id = f.source_id AND coalesce(s.textbook, '') = '';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '고1 공통국어 기출 %건에 교과서를 채웠습니다 (재실행이면 0)', v_n;

  FOR r IN
    SELECT s.title, COALESCE(NULLIF(s.textbook, ''), '(비어 있음)') AS textbook, f.textbook AS expected
      FROM fill_106 f JOIN exam.problem_sources s ON s.id = f.source_id ORDER BY s.title
  LOOP
    RAISE NOTICE '  % → %', r.title,
      r.textbook || CASE WHEN r.textbook = r.expected THEN '' ELSE ' (표와 다름: ' || r.expected || ' — 그대로 둠)' END;
  END LOOP;
END
$apply$;

COMMIT;
