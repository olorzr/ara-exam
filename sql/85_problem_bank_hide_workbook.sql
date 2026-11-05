-- =============================================
-- 85. 문제 은행에서 평가문제집 숨기기 — 패싯은 평가문제집 몫을 따로 싣고, 작품·문법 함수는 '이 유형 빼고' 를 받는다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/85_problem_bank_hide_workbook.sql
-- =============================================
-- 배경: 원장님(2026-11-05) "문제은행에서 평가문제집은 안 보이게, 책 만드는 곳에만 우선 보이게. 책 만들 때 빼고는 안 쓸 거라서."
--   평가문제집 문항도 단원·작품·문법 태그를 다 달고 있어 유형 칸과 트리 가지만 숨기면 조건 없는 목록·트리 건수에 그대로 남는다.
--   작품·문법·영역·단원 패싯은 문항을 묶어 센 가중치 행이라 **앱에서 평가문제집 몫을 뺄 수 없다** — 서버가 갈라 준다.
-- ⚠️ **이 파일이 두 함수의 정식 정의다**(archive_facets_refresh · problems_for_archive) — sql/71·72·82 를 다시 돌리면
--    평가문제집이 문제 은행 건수에 조용히 되섞이고 앱의 '빼고' 조건이 거절된다(세 파일 머리에 경고).
-- ⚠️ 네 묶음(area_paths·unit_paths·grammar_paths·work_titles)은 이제 **평가문제집을 뺀** 값이고 `*_workbook` 이 그 몫이다.
--    앱 facets.ts 가 화면 모드에 따라 합친다. sources 는 트리 가지 재료라, passage_works 는 지은이·갈래 표결이라(건수를 안 만든다) 그대로다.
-- ⚠️ 패싯이 이제 문항의 source_id 를 읽는다 — 쓰기 표시 트리거의 WHEN 에 그 칸을 더했다(sql/71 의 '패싯이 읽는 칸과 1:1' 규약).
--    출처 쪽 트리거(sql/82 판, title 을 본다)도 여기서 다시 만든다 — sql/71 을 다시 돌린 뒤 이 파일만 돌려도 패싯이 읽는 칸이 전부 살아난다.
-- ⚠️ p_source 키 목록은 앱 source-axes.ts 의 SOURCE_EQ_AXES + grades + exclude_source_type 과 1:1(archive-rpc.test.ts 가 이 파일과 대조).
-- ⚠️ 숨김은 권한이 아니다 — RLS 는 그대로고, 책 만들기의 '문제지 만들기' 화면이 평가문제집을 함께 읽는다.

DO $guard$
BEGIN
  IF to_regprocedure('exam.archive_facets_refresh(boolean)') IS NULL
     OR to_regprocedure('exam.problems_for_archive(text, boolean, text[], jsonb)') IS NULL THEN
    RAISE EXCEPTION 'sql/85: sql/82 가 먼저 적용돼야 한다 (현재 DB: %)', current_database();
  END IF;
END
$guard$;

-- ---------------------------------------------
-- 1. 쓰기 표시 — 문항이 다른 출처로 옮겨 가도(평가문제집 몫이 달라진다), 출처 제목이 바뀌어도(sql/82) 다시 짓는다
-- ---------------------------------------------
DROP TRIGGER IF EXISTS archive_facets_dirty_problems_upd ON exam.problems;
CREATE TRIGGER archive_facets_dirty_problems_upd
  AFTER UPDATE ON exam.problems
  FOR EACH ROW
  WHEN (OLD.area_path     IS DISTINCT FROM NEW.area_path
     OR OLD.unit_path     IS DISTINCT FROM NEW.unit_path
     OR OLD.grammar_paths IS DISTINCT FROM NEW.grammar_paths
     OR OLD.work_titles   IS DISTINCT FROM NEW.work_titles
     OR OLD.source_id     IS DISTINCT FROM NEW.source_id)
  EXECUTE FUNCTION exam.archive_facets_mark_dirty();

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
-- 2. 패싯 짓기 (sql/82 판 + 평가문제집 몫 가르기)
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

  -- 스냅샷과 payload 를 **한 문장**에서 — 같은 스냅샷이어야 '이 빌드가 본 쓰기' 가 정확하다.
  -- ⚠️ 문항 표는 묶음마다 **한 번만** 훑고 평가문제집 여부를 묶음 열쇠에 더해 FILTER 로 가른다. 몫마다 따로 훑으면
  --    스캔이 네 번에서 여덟 번이 된다(이 인스턴스는 쪽 수가 곧 비용이다, sql/71 머리말).
  WITH wb AS (SELECT id FROM exam.problem_sources WHERE source_type = '평가문제집')
  SELECT pg_current_snapshot(),
         jsonb_build_object(
    'sources', COALESCE((
      SELECT jsonb_agg(to_jsonb(s))
        -- 제목은 평가문제집만 싣는다(책 단위 잎) — 다른 유형까지 실으면 출처마다 한 줄이 돼 payload 만 커진다(sql/82)
        FROM (SELECT DISTINCT school_name, year, grade, textbook, source_type, semester, exam_type,
                     CASE WHEN source_type = '평가문제집' THEN title ELSE '' END AS title
                FROM exam.problem_sources) s), '[]'::jsonb),
    'passage_works', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('title', v.title, 'author', v.author,
                                          'area_path', v.area_path, 'n', v.n))
        FROM (SELECT e ->> 'title' AS title, COALESCE(e ->> 'author', '') AS author,
                     pa.area_path, count(*) AS n
                FROM exam.passages pa, jsonb_array_elements(pa.works) AS e
               WHERE COALESCE(e ->> 'title', '') <> ''
               GROUP BY 1, 2, 3) v), '[]'::jsonb)
  )
  || (SELECT jsonb_build_object(
        'area_paths',          COALESCE(jsonb_agg(to_jsonb(a.area_path)) FILTER (WHERE NOT a.wb), '[]'::jsonb),
        'area_paths_workbook', COALESCE(jsonb_agg(to_jsonb(a.area_path)) FILTER (WHERE a.wb), '[]'::jsonb))
        FROM (SELECT DISTINCT p.area_path, p.source_id IN (SELECT id FROM wb) AS wb
                FROM exam.problems p WHERE p.area_path <> '{}') a)
  || (SELECT jsonb_build_object(
        'unit_paths',          COALESCE(jsonb_agg(to_jsonb(u.unit_path)) FILTER (WHERE NOT u.wb), '[]'::jsonb),
        'unit_paths_workbook', COALESCE(jsonb_agg(to_jsonb(u.unit_path)) FILTER (WHERE u.wb), '[]'::jsonb))
        FROM (SELECT DISTINCT p.unit_path, p.source_id IN (SELECT id FROM wb) AS wb
                FROM exam.problems p WHERE p.unit_path <> '{}') u)
  || (SELECT jsonb_build_object(
        'grammar_paths',          COALESCE(jsonb_agg(jsonb_build_object('paths', g.grammar_paths, 'n', g.n)) FILTER (WHERE NOT g.wb), '[]'::jsonb),
        'grammar_paths_workbook', COALESCE(jsonb_agg(jsonb_build_object('paths', g.grammar_paths, 'n', g.n)) FILTER (WHERE g.wb), '[]'::jsonb))
        FROM (SELECT p.grammar_paths, p.source_id IN (SELECT id FROM wb) AS wb, count(*) AS n
                FROM exam.problems p WHERE p.grammar_paths <> '{}' GROUP BY 1, 2) g)
  || (SELECT jsonb_build_object(
        'work_titles',          COALESCE(jsonb_agg(jsonb_build_object('titles', w.work_titles, 'n', w.n)) FILTER (WHERE NOT w.wb), '[]'::jsonb),
        'work_titles_workbook', COALESCE(jsonb_agg(jsonb_build_object('titles', w.work_titles, 'n', w.n)) FILTER (WHERE w.wb), '[]'::jsonb))
        FROM (SELECT p.work_titles, p.source_id IN (SELECT id FROM wb) AS wb, count(*) AS n
                FROM exam.problems p WHERE p.work_titles <> '{}' GROUP BY 1, 2) w)
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
  '아카이브 패싯을 신선하면 캐시에서, 아니면 다시 지어 돌려준다. true 면 무조건 다시 짓는다(트리거 끈 백필 뒤). 호출자 검사 없음 — 소유자·service_role 전용. sql/71 · 출처 제목 sql/82 · 평가문제집 몫 가르기 sql/85';
REVOKE ALL ON FUNCTION exam.archive_facets_refresh(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION exam.archive_facets_refresh(boolean) TO service_role;

-- ---------------------------------------------
-- 3. 작품·문법 함수 (sql/82 판 + '이 유형 빼고')
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
  -- 출처 칸: 앱 source-axes.ts 의 SOURCE_EQ_AXES + grades + exclude_source_type 과 1:1. 모르는 키는 거절(조용히 빠지지 않게)
  IF jsonb_typeof(v_src) <> 'object' OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(v_src) AS k
        WHERE k NOT IN ('source_type', 'school_name', 'year', 'grade', 'semester', 'exam_type', 'textbook', 'title', 'grades', 'exclude_source_type')) THEN
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
  --       exclude_source_type 만 '키가 있으면 다름' 이다 — 문제 은행이 평가문제집을 뺄 때 건다(sql/85).
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
       AND (NOT $3 ? 'exclude_source_type' OR s.source_type <> $3 ->> 'exclude_source_type')
       AND ($4::text[] IS NULL OR s.grade = ANY ($4))$q$
    USING v_title, v_paths, v_src, v_grades;
END;
$$;
COMMENT ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) IS
  '아카이브 작품·문법 축 — RLS 아래선 @>/&& 가 leakproof 가 아니라 GIN 을 못 타므로(sql/66) 소유자로 돌아 인덱스를 탄다. 출처 칸은 p_source(PostgREST 14.5 가 함수 결과 임베드에 필터를 못 건다). 앱 queries.ts 가 그 축이 있을 때만 POST 로 부르고 나머지 조건은 PostgREST 가 결과에 건다. sql/72 · 출처 제목 축 sql/82 · 유형 빼기 sql/85';
REVOKE ALL ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 4. 검증 — 패싯 두 몫의 합이 문항 수와 맞는가 · 평가문제집 몫이 정확한가 · 트리거가 source_id 를 보는가
-- ---------------------------------------------
DO $verify$
DECLARE
  v_out   JSONB;
  v_key   TEXT;
  v_all   BIGINT;
  v_wb    BIGINT;
  v_sum   BIGINT;
  v_share BIGINT;
  v_def   TEXT;
BEGIN
  v_out := exam.archive_facets_refresh(true);
  FOREACH v_key IN ARRAY ARRAY['area_paths', 'unit_paths', 'grammar_paths', 'work_titles'] LOOP
    IF NOT (v_out ? v_key) OR NOT (v_out ? (v_key || '_workbook')) THEN
      RAISE EXCEPTION 'sql/85: 패싯에 % 또는 그 평가문제집 몫이 없다', v_key;
    END IF;
  END LOOP;

  -- 작품: 두 몫의 합 = 작품이 달린 문항 수, 평가문제집 몫 = 평가문제집 출처의 작품 달린 문항 수
  SELECT count(*), count(*) FILTER (WHERE s.source_type = '평가문제집') INTO v_all, v_wb
    FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id WHERE p.work_titles <> '{}';
  SELECT COALESCE(sum((e ->> 'n')::bigint), 0) INTO v_sum FROM jsonb_array_elements(v_out -> 'work_titles') e;
  SELECT COALESCE(sum((e ->> 'n')::bigint), 0) INTO v_share FROM jsonb_array_elements(v_out -> 'work_titles_workbook') e;
  IF v_sum + v_share <> v_all OR v_share <> v_wb THEN
    RAISE EXCEPTION 'sql/85: 작품 몫이 어긋난다 (은행 % + 평가문제집 % / 전체 % · 평가문제집 %)', v_sum, v_share, v_all, v_wb;
  END IF;
  RAISE NOTICE 'sql/85 작품 달린 문항: 은행 % · 평가문제집 %', v_sum, v_share;

  -- 문법도 같다
  SELECT count(*), count(*) FILTER (WHERE s.source_type = '평가문제집') INTO v_all, v_wb
    FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id WHERE p.grammar_paths <> '{}';
  SELECT COALESCE(sum((e ->> 'n')::bigint), 0) INTO v_sum FROM jsonb_array_elements(v_out -> 'grammar_paths') e;
  SELECT COALESCE(sum((e ->> 'n')::bigint), 0) INTO v_share FROM jsonb_array_elements(v_out -> 'grammar_paths_workbook') e;
  IF v_sum + v_share <> v_all OR v_share <> v_wb THEN
    RAISE EXCEPTION 'sql/85: 문법 몫이 어긋난다 (은행 % + 평가문제집 % / 전체 % · 평가문제집 %)', v_sum, v_share, v_all, v_wb;
  END IF;
  RAISE NOTICE 'sql/85 문법 달린 문항: 은행 % · 평가문제집 %', v_sum, v_share;

  -- 출처 행은 그대로 — 책 화면의 트리 가지 재료다
  IF EXISTS (SELECT 1 FROM exam.problem_sources WHERE source_type = '평가문제집')
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_out -> 'sources') e WHERE e ->> 'source_type' = '평가문제집') THEN
    RAISE EXCEPTION 'sql/85: 패싯 출처 행에서 평가문제집이 사라졌다';
  END IF;

  SELECT pg_get_triggerdef(t.oid) INTO v_def FROM pg_trigger t
   WHERE t.tgrelid = 'exam.problems'::regclass AND t.tgname = 'archive_facets_dirty_problems_upd';
  IF v_def IS NULL OR position('source_id' IN v_def) = 0 THEN
    RAISE EXCEPTION 'sql/85: 문항 갱신 트리거가 source_id 를 보지 않는다';
  END IF;
  SELECT pg_get_triggerdef(t.oid) INTO v_def FROM pg_trigger t
   WHERE t.tgrelid = 'exam.problem_sources'::regclass AND t.tgname = 'archive_facets_dirty_sources_upd';
  IF v_def IS NULL OR position('title' IN v_def) = 0 OR position('source_type' IN v_def) = 0 THEN
    RAISE EXCEPTION 'sql/85: 출처 갱신 트리거가 제목·유형을 보지 않는다';
  END IF;
  RAISE NOTICE '✓ sql/85 패싯 — 두 몫 합·평가문제집 몫·출처 행·트리거 둘 확인';
END
$verify$;

-- 함수는 호출자 검사를 하므로 교직원 JWT 로 실제로 불러 본다 — 빼기가 듣는가 · 모르는 키는 여전히 거절되는가
DO $probe$
DECLARE
  v_user   UUID;
  v_email  TEXT;
  v_title  TEXT;
  v_all    BIGINT;
  v_hidden BIGINT;
  v_wb     BIGINT;
  v_ok     BOOLEAN := false;
BEGIN
  SELECT id, email INTO v_user, v_email
    FROM auth.users WHERE email LIKE '%@araeducation.co.kr' ORDER BY created_at LIMIT 1;
  -- 평가문제집과 다른 유형에 함께 실린 작품 — 빼기가 둘을 가르는지 볼 수 있는 것
  SELECT t.title INTO v_title
    FROM (SELECT unnest(p.work_titles) AS title, s.source_type
            FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id) t
   GROUP BY t.title
  HAVING count(*) FILTER (WHERE t.source_type = '평가문제집') > 0
     AND count(*) FILTER (WHERE t.source_type <> '평가문제집') > 0
   ORDER BY count(*) DESC, t.title LIMIT 1;
  IF v_user IS NULL OR v_title IS NULL THEN
    RAISE NOTICE 'sql/85 probe 건너뜀: 학원 사용자 또는 겹치는 작품이 없다';
    RETURN;
  END IF;
  SELECT count(*) FILTER (WHERE s.source_type = '평가문제집') INTO v_wb
    FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id WHERE p.work_titles @> ARRAY[v_title];

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', v_email)::text, true);

    SELECT count(*) INTO v_all FROM exam.problems_for_archive(v_title, false, NULL, '{}'::jsonb);
    SELECT count(*) INTO v_hidden FROM exam.problems_for_archive(
      v_title, false, NULL, jsonb_build_object('exclude_source_type', '평가문제집'));
    IF v_hidden <> v_all - v_wb OR v_hidden = v_all THEN
      RAISE EXCEPTION 'sql/85 probe 실패: 「%」 전체 % · 뺀 뒤 % · 평가문제집 %', v_title, v_all, v_hidden, v_wb;
    END IF;

    BEGIN
      PERFORM count(*) FROM exam.problems_for_archive(v_title, false, NULL, '{"no_such_key":"x"}'::jsonb);
    EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'sql/85 probe 실패: 모르는 출처 키가 통과했다'; END IF;

    RAISE EXCEPTION '__sql85_probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__sql85_probe_rollback__' THEN RAISE; END IF;
  END;
  IF current_user <> session_user THEN RAISE EXCEPTION 'sql/85: 역할이 되돌아가지 않았다'; END IF;
  RAISE NOTICE '✓ sql/85 함수 — 「%」 전체 % → 평가문제집 뺀 뒤 % (평가문제집 %) · 모르는 키 거절', v_title, v_all, v_hidden, v_wb;
END
$probe$;
