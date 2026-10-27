-- =============================================
-- 82. 문제 은행 — 평가문제집 책 단위로 훑기 (패싯 출처 행에 제목, 작품·문법 함수에 제목 축)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/82_problem_bank_source_title_axis.sql
-- =============================================
-- 배경: 평가문제집(sql/80)은 학교·시험이 없어 기출 트리가 '교과서 › 학년·학기 › 책(출처 제목)' 으로 가른다.
--   그런데 패싯 출처 행(sql/71 archive_facets_refresh 의 sources)에 제목이 없고, 작품·문법 함수
--   (sql/72 problems_for_archive)의 p_source 도 제목 키를 거절한다.
-- ⚠️ **이 파일이 두 함수의 정식 정의다** — sql/71·72 를 다시 돌리면 제목이 조용히 빠진다(두 파일 머리에 경고).
--    sql/66 은 다시 돌리지 말 것(캐시가 꺼진다 — sql/71 머리).
-- ⚠️ 제목은 **평가문제집만** 싣는다. 다른 유형까지 실으면 DISTINCT 가 출처마다 한 줄이 돼 payload 가 불어난다.
--    앱 facets-payload.ts 의 `title` 은 빠지면 '' 로 읽는다.
-- ⚠️ p_source 키 목록은 앱 source-axes.ts 의 SOURCE_EQ_AXES + grades 와 1:1(archive-rpc.test.ts 가 이 파일과 대조).

DO $guard$
BEGIN
  IF to_regprocedure('exam.archive_facets_refresh(boolean)') IS NULL
     OR to_regprocedure('exam.problems_for_archive(text, boolean, text[], jsonb)') IS NULL THEN
    RAISE EXCEPTION 'sql/82: sql/71·72 가 먼저 적용돼야 한다 (현재 DB: %)', current_database();
  END IF;
END
$guard$;

-- ---------------------------------------------
-- 1. 출처 제목이 바뀌어도 패싯을 다시 짓는다
-- ---------------------------------------------
DROP TRIGGER IF EXISTS archive_facets_dirty_sources_upd ON exam.problem_sources;
CREATE TRIGGER archive_facets_dirty_sources_upd
  AFTER UPDATE ON exam.problem_sources
  FOR EACH ROW
  WHEN (OLD.school_name IS DISTINCT FROM NEW.school_name
     OR OLD.year        IS DISTINCT FROM NEW.year
     OR OLD.grade       IS DISTINCT FROM NEW.grade
     OR OLD.textbook    IS DISTINCT FROM NEW.textbook
     OR OLD.source_type IS DISTINCT FROM NEW.source_type
     OR OLD.semester    IS DISTINCT FROM NEW.semester
     OR OLD.exam_type   IS DISTINCT FROM NEW.exam_type
     OR OLD.title       IS DISTINCT FROM NEW.title)
  EXECUTE FUNCTION exam.archive_facets_mark_dirty();

-- ---------------------------------------------
-- 2. 패싯 짓기 (sql/71 판 + 평가문제집 제목)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.archive_facets_refresh(p_force BOOLEAN DEFAULT FALSE)
RETURNS jsonb
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_payload JSONB;
  v_snap    PG_SNAPSHOT;
BEGIN
  -- 빠른 길: 지은 스냅샷에 안 보이는(그 뒤 커밋했거나 그때 진행 중이던) 쓰기가 없으면 그대로.
  -- p_force 는 이 길을 건너뛴다 — 트리거를 끄고 돌린 백필은 표시를 안 남겨 빠른 길이 옛 캐시를 돌려준다
  IF NOT COALESCE(p_force, FALSE) THEN
    SELECT c.payload INTO v_payload
      FROM exam.archive_facets_cache c
     WHERE c.id = 1
       AND NOT EXISTS (SELECT 1 FROM exam.archive_facets_dirty d
                        WHERE NOT pg_visible_in_snapshot(d.xid, c.built_snapshot));
    IF FOUND THEN RETURN v_payload; END IF;
  END IF;

  -- 한 번에 하나만 짓는다. 기다리던 쪽은 방금 커밋된 빌드를 받는다(READ COMMITTED — 문장마다 새 스냅샷).
  -- 강제 호출은 기다린 뒤에도 다시 짓는다 — 운영자가 손으로 부르는 길이라 뜻을 단순하게 둔다
  PERFORM pg_advisory_xact_lock(hashtext('exam.archive_facets'));
  IF NOT COALESCE(p_force, FALSE) THEN
    SELECT c.payload INTO v_payload
      FROM exam.archive_facets_cache c
     WHERE c.id = 1
       AND NOT EXISTS (SELECT 1 FROM exam.archive_facets_dirty d
                        WHERE NOT pg_visible_in_snapshot(d.xid, c.built_snapshot));
    IF FOUND THEN RETURN v_payload; END IF;
  END IF;

  -- 스냅샷과 payload 를 **한 문장**에서 — 같은 스냅샷이어야 '이 빌드가 본 쓰기' 가 정확하다
  SELECT pg_current_snapshot(),
         jsonb_build_object(
    'sources', COALESCE((
      SELECT jsonb_agg(to_jsonb(s))
        -- 제목은 평가문제집만 싣는다(책 단위 잎) — 다른 유형까지 실으면 출처마다 한 줄이 돼 payload 만 커진다(sql/82)
        FROM (SELECT DISTINCT school_name, year, grade, textbook, source_type, semester, exam_type,
                     CASE WHEN source_type = '평가문제집' THEN title ELSE '' END AS title
                FROM exam.problem_sources) s), '[]'::jsonb),
    'area_paths', COALESCE((
      SELECT jsonb_agg(to_jsonb(a.area_path))
        FROM (SELECT DISTINCT area_path FROM exam.problems WHERE area_path <> '{}') a), '[]'::jsonb),
    'unit_paths', COALESCE((
      SELECT jsonb_agg(to_jsonb(u.unit_path))
        FROM (SELECT DISTINCT unit_path FROM exam.problems WHERE unit_path <> '{}') u), '[]'::jsonb),
    'grammar_paths', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('paths', g.grammar_paths, 'n', g.n))
        FROM (SELECT grammar_paths, count(*) AS n FROM exam.problems
               WHERE grammar_paths <> '{}' GROUP BY grammar_paths) g), '[]'::jsonb),
    'work_titles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('titles', w.work_titles, 'n', w.n))
        FROM (SELECT work_titles, count(*) AS n FROM exam.problems
               WHERE work_titles <> '{}' GROUP BY work_titles) w), '[]'::jsonb),
    'passage_works', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('title', v.title, 'author', v.author,
                                          'area_path', v.area_path, 'n', v.n))
        FROM (SELECT e ->> 'title' AS title, COALESCE(e ->> 'author', '') AS author,
                     pa.area_path, count(*) AS n
                FROM exam.passages pa, jsonb_array_elements(pa.works) AS e
               WHERE COALESCE(e ->> 'title', '') <> ''
               GROUP BY 1, 2, 3) v), '[]'::jsonb)
  )
    INTO v_snap, v_payload;

  -- 이 빌드가 본 쓰기의 표시는 지운다. 진행 중이던(안 보이는) 것은 남아 다음 호출이 다시 짓게 한다
  DELETE FROM exam.archive_facets_dirty WHERE pg_visible_in_snapshot(xid, v_snap);

  INSERT INTO exam.archive_facets_cache (id, payload, built_at, built_snapshot)
  VALUES (1, v_payload, clock_timestamp(), v_snap)
  ON CONFLICT (id) DO UPDATE
     SET payload = EXCLUDED.payload, built_at = EXCLUDED.built_at, built_snapshot = EXCLUDED.built_snapshot;

  RETURN v_payload;
END;
$$;
COMMENT ON FUNCTION exam.archive_facets_refresh(boolean) IS
  '아카이브 패싯을 신선하면 캐시에서, 아니면 다시 지어 돌려준다. true 면 무조건 다시 짓는다(트리거 끈 백필 뒤). 호출자 검사 없음 — 소유자·service_role 전용. sql/71 · 출처 제목(평가문제집) sql/82';
REVOKE ALL ON FUNCTION exam.archive_facets_refresh(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION exam.archive_facets_refresh(boolean) TO service_role;

-- ---------------------------------------------
-- 3. 작품·문법 함수 (sql/72 판 + 제목 축)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.problems_for_archive(
  p_work_title    TEXT    DEFAULT NULL,
  p_only_work     BOOLEAN DEFAULT FALSE,
  p_grammar_paths TEXT[]  DEFAULT NULL,
  p_source        JSONB   DEFAULT NULL
)
RETURNS SETOF exam.problems
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = exam, pg_temp
  ROWS 300
AS $$
DECLARE
  v_title  TEXT    := NULLIF(btrim(p_work_title), '');
  v_paths  TEXT[]  := CASE WHEN cardinality(p_grammar_paths) > 0 THEN p_grammar_paths END;
  v_only   BOOLEAN := COALESCE(p_only_work, FALSE);
  v_src    JSONB   := COALESCE(p_source, '{}'::jsonb);
  v_grades TEXT[];
  v_where  TEXT[]  := ARRAY[]::text[];
BEGIN
  IF NOT exam.archive_caller_allowed() THEN
    RAISE EXCEPTION '허용되지 않은 계정입니다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_title IS NULL AND v_paths IS NULL THEN
    RAISE EXCEPTION '작품 또는 문법 조건이 필요합니다' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- 출처 칸: 앱 source-axes.ts 의 SOURCE_EQ_AXES + grades 와 1:1. 모르는 키는 거절(조용히 빠지지 않게)
  IF jsonb_typeof(v_src) <> 'object' OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(v_src) AS k
        WHERE k NOT IN ('source_type', 'school_name', 'year', 'grade', 'semester', 'exam_type', 'textbook', 'title', 'grades')) THEN
    RAISE EXCEPTION '알 수 없는 출처 조건입니다: %', v_src USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_src ? 'grades' THEN
    IF jsonb_typeof(v_src -> 'grades') <> 'array' THEN
      RAISE EXCEPTION '학년 목록은 배열이어야 합니다' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_grades := ARRAY(SELECT jsonb_array_elements_text(v_src -> 'grades'));
  END IF;

  -- 작품: 배열 포함(@>) — (가)(나) 를 함께 묻는 문항도 어느 작품으로 훑어도 나온다(sql/33).
  --       '그 작품만' 은 같음(=) 을 **더** 건다 — GIN 이 @> 로 좁힌 뒤 recheck 에서 가른다.
  -- 문법: 겹침(&&) — 원소 하나가 경로 하나라 상위 검색은 아래 경로를 나열해 "하나라도" 로 찾는다(sql/21, grammarPathsUnder).
  -- ⚠️ 축 조건은 **걸린 것만 글자로 잇는다**(값은 USING 으로 바인드). `CASE WHEN $1 IS NULL …`·`($1 IS NULL OR …)` 로 한 문장에
  --    몰면 그 식은 인덱스 조건이 될 수 없어 generic plan 이 순차 스캔으로 굳을 수 있다. EXECUTE 는 한 번 쓰는 계획이라
  --    값을 보고 GIN 을 고른다.
  -- 출처: '키가 있으면 같음' — '' 도 값이다(미지정인 출처만). grades 는 하나라도(빈 배열은 앱이 보내지 않는다).
  --       출처 표는 1천여 행이라 문항을 GIN 으로 좁힌 뒤 기본 키로 붙인다.
  IF v_title IS NOT NULL THEN
    v_where := array_append(v_where, 'p.work_titles @> ARRAY[$1]');
    IF v_only THEN v_where := array_append(v_where, 'p.work_titles = ARRAY[$1]'); END IF;
  END IF;
  IF v_paths IS NOT NULL THEN
    v_where := array_append(v_where, 'p.grammar_paths && $2');
  END IF;

  RETURN QUERY EXECUTE
    'SELECT p.* FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id WHERE '
    || array_to_string(v_where, ' AND ')
    || $q$
       AND (NOT $3 ? 'source_type' OR s.source_type = $3 ->> 'source_type')
       AND (NOT $3 ? 'school_name' OR s.school_name = $3 ->> 'school_name')
       AND (NOT $3 ? 'year'        OR s.year        = $3 ->> 'year')
       AND (NOT $3 ? 'grade'       OR s.grade       = $3 ->> 'grade')
       AND (NOT $3 ? 'semester'    OR s.semester    = $3 ->> 'semester')
       AND (NOT $3 ? 'exam_type'   OR s.exam_type   = $3 ->> 'exam_type')
       AND (NOT $3 ? 'textbook'    OR s.textbook    = $3 ->> 'textbook')
       AND (NOT $3 ? 'title'       OR s.title       = $3 ->> 'title')
       AND ($4::text[] IS NULL OR s.grade = ANY ($4))$q$
    USING v_title, v_paths, v_src, v_grades;
END;
$$;
COMMENT ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) IS
  '아카이브 작품·문법 축 — RLS 아래선 @>/&& 가 leakproof 가 아니라 GIN 을 못 타므로(sql/66) 소유자로 돌아 인덱스를 탄다. 출처 칸은 p_source(PostgREST 14.5 가 함수 결과 임베드에 필터를 못 건다). 앱 queries.ts 가 그 축이 있을 때만 POST 로 부르고 나머지 조건은 PostgREST 가 결과에 건다. sql/72 · 출처 제목 축 sql/82';
REVOKE ALL ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 4. 검증 — 패싯이 제목 칸을 싣는가 · 함수가 제목 키를 받고 모르는 키는 거절하는가
-- ---------------------------------------------
DO $verify$
DECLARE
  v_out  JSONB;
  v_bad  BOOLEAN := false;
  v_n    INT;
  v_def  TEXT;
BEGIN
  v_out := exam.archive_facets_refresh(true);
  IF jsonb_array_length(v_out -> 'sources') > 0 AND NOT ((v_out -> 'sources' -> 0) ? 'title') THEN
    RAISE EXCEPTION 'sql/82: 패싯 출처 행에 title 칸이 없다';
  END IF;
  SELECT count(*) INTO v_n FROM jsonb_array_elements(v_out -> 'sources') e
   WHERE e ->> 'title' <> '' AND e ->> 'source_type' <> '평가문제집';
  IF v_n <> 0 THEN RAISE EXCEPTION 'sql/82: 평가문제집 아닌 출처에 제목이 실렸다 (%행)', v_n; END IF;

  SELECT pg_get_triggerdef(t.oid) INTO v_def FROM pg_trigger t
   WHERE t.tgrelid = 'exam.problem_sources'::regclass AND t.tgname = 'archive_facets_dirty_sources_upd';
  IF v_def IS NULL OR position('title' IN v_def) = 0 THEN
    RAISE EXCEPTION 'sql/82: 출처 갱신 트리거가 제목을 보지 않는다';
  END IF;

  -- 함수는 호출자 검사를 하므로 postgres 로는 못 부른다 — 정의 글자로 확인한다
  SELECT pg_get_functiondef('exam.problems_for_archive(text, boolean, text[], jsonb)'::regprocedure) INTO v_def;
  IF position($k$'title', 'grades'$k$ IN v_def) = 0 OR position($k$s.title       = $3 ->> 'title'$k$ IN v_def) = 0 THEN
    RAISE EXCEPTION 'sql/82: problems_for_archive 에 제목 축이 없다';
  END IF;
  RAISE NOTICE '✓ sql/82 — 패싯 출처 %행(제목 칸 있음, 평가문제집만 값) · 제목 축 · 트리거 확인',
    jsonb_array_length(v_out -> 'sources');
END
$verify$;
