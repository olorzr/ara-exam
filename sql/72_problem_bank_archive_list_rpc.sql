-- =============================================
-- 72. 기출 아카이브 작품·문법 목록 — GIN 인덱스를 타는 SECURITY DEFINER 함수 (PostgREST 가 그 결과에 나머지 조건을 건다)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/72_problem_bank_archive_list_rpc.sql
-- =============================================
-- 배경 (2026-10-15, sql/71 과 같은 제보)
--   pg_stat_statements: 작품 목록(`work_titles @>`) 667회 · 평균 243 ms · 최대 4.9초, 문법 목록(`grammar_paths &&`) 106회 ·
--   평균 479 ms · 최대 5.8초. RLS 아래에서는 `@>`·`&&`·배열 `=` 가 leakproof 가 아니라 GIN 인덱스가 조건이 될 수 없어
--   (sql/66 머리말 3) — pg_proc.proleakproof 로 재확인) 클릭마다 문항 표 11,028쪽을 순차 스캔하고 count exact 로 한 번 더 한다.
--   이 인스턴스는 최근 안 건드린 쪽을 되읽는 데 쪽당 0.3~0.5 ms 라 그 스캔 한 번이 수 초다(sql/71 머리말).
--   소유자 롤에서는 같은 조건이 Bitmap Index Scan 이다 — 인기 작품(582건) 305쪽(warm 1.9 ms / cold 245 ms), 드문 작품 28쪽,
--   솔로(`@>` AND `=`)도 GIN + recheck 10 ms.
--
-- 무엇을 하는가
--   · exam.problems_for_archive(작품, 그 작품만, 문법 경로들) RETURNS SETOF exam.problems — SECURITY DEFINER 라 소유자로 돌아
--     GIN 을 탄다. 첫 줄에서 호출자를 직접 본다(exam.archive_caller_allowed, sql/71).
--   · ⚠️ 필터 체인을 SQL 로 옮기지 **않았다.** PostgREST(운영 14.5)는 표 타입을 돌려주는 함수 결과에 표와 똑같이
--     select·임베드(`source:problem_sources!inner(*)`)·수평 필터·order·limit·count 를 건다. 그래서 앱(queries.ts)은
--     작품·문법 축이 걸렸을 때만 **출발점**을 `.from('problems')` 에서 `.rpc('problems_for_archive', …)` 로 바꾸고
--     나머지 조건(출처 축·영역·단원·지문 대영역·유형·검색·정렬·쪽)은 그대로 체인에 건다 — 체인은 query-chain.ts 한 벌.
--   · 영역·단원 축은 여기 넣지 않는다 — `area_path @> {'문학'}` 은 1만 5천 행이라 함수 결과 구체화(work_mem 2 MB → 임시 파일)가
--     순차 스캔보다 나쁘다. 문법은 태그 전체가 2,512행(2026-10-15)이라 상한이 있다.
--   · 작품·문법이 둘 다 비면 거절한다(invalid_parameter_value) — 30,191행을 함수로 구체화하는 길을 막는다. 호출부는 축이 있을 때만 부른다.
--   · 본문은 걸린 축 조건만 글자로 이은 EXECUTE … USING 이다(값은 바인드). `($1 IS NULL OR …)` 가드로 한 문장에 몰면
--     그 식은 인덱스 조건이 될 수 없어 generic plan 이 순차 스캔으로 굳을 수 있다. 한 번 쓰는 계획이라 값을 보고 GIN 을 고른다.
--   · ⚠️ 앱은 POST 로 부른다 — GET /rpc 는 postgrest-js 가 배열 인자를 따옴표 없이 `{a,b}` 로 실어 쉼표 든 작품명
--     (「소녀, 두드리다」)이 두 원소로 갈린다(2026-09-27 의 그 버그). JSON 본문이면 그대로 간다.
--   · count exact: PostgREST 는 함수 호출을 CTE(pgrst_call)로 두 곳(목록·개수)에서 참조해 한 번 구체화한다.
--   · ⚠️ 운영 PostgREST 14.5 의 함수 결과 한계 두 가지(2026-10-15 실측):
--     ① **임베드에는 필터를 못 건다** — `source.grade=in.(…)` 가 `column pgrst_call.grade does not exist` 로 400 이다
--       (임베드 자체 `source:problem_sources!inner(*)` 는 된다). 그래서 출처 칸 조건은 **함수 인자 p_source** 로 받아
--       안에서 조인한다. 키 모양은 앱 source-axes.ts 의 sourceAxisArgs 가 만든다 — 같은 칸 목록(SOURCE_EQ_AXES)과
--       같은 규칙('있는 키만 건다' · '' 은 미지정인 것만 · grades 는 in). 모르는 키가 오면 **거절한다** — 앱이 칸을
--       더했는데 여기를 안 고치면 조건이 조용히 빠지는 대신 목록이 오류를 낸다(source-axes.test.ts 가 이 파일과 대조한다).
--     ② **select 에 없는 칸으로는 정렬하지 못한다** — `column problems.passage_id does not exist`. 앱(queries.ts)이 함수
--       경로에서는 정렬 칸을 select 에 보탠다(withOrderColumns).
--
-- 멱등: CREATE OR REPLACE.
-- ⛳️ 되돌릴 때: DROP FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb); 앱은 그 전에 표 경로로 되돌릴 것(아니면 PGRST202).
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problems') IS NULL OR to_regclass('exam.problem_sources') IS NULL THEN
    RAISE EXCEPTION 'exam 문제 은행 표가 없습니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;
  IF to_regclass('exam.idx_problems_work_titles') IS NULL OR to_regclass('exam.idx_problems_grammar_paths') IS NULL THEN
    RAISE EXCEPTION 'sql/72: GIN 인덱스(idx_problems_work_titles · idx_problems_grammar_paths)가 없다 — sql/33·21 을 먼저';
  END IF;
  IF to_regprocedure('exam.archive_caller_allowed()') IS NULL THEN
    RAISE EXCEPTION 'sql/72: exam.archive_caller_allowed() 가 없다 — sql/71 을 먼저 적용할 것';
  END IF;
  RAISE NOTICE 'sql/72 대상 DB=% 롤=%', current_database(), current_user;
END
$guard$;

-- ---------------------------------------------
-- 1. 함수
-- ---------------------------------------------
-- 같은 날 먼저 적용한 인자 셋짜리(출처 인자 없음)를 걷는다 — 겹쳐 두면 PostgREST 가 이름으로 오버로드를 고른다
DROP FUNCTION IF EXISTS exam.problems_for_archive(text, boolean, text[]);

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
        WHERE k NOT IN ('source_type', 'school_name', 'year', 'grade', 'semester', 'exam_type', 'textbook', 'grades')) THEN
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
       AND ($4::text[] IS NULL OR s.grade = ANY ($4))$q$
    USING v_title, v_paths, v_src, v_grades;
END;
$$;
COMMENT ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) IS
  '아카이브 작품·문법 축 — RLS 아래선 @>/&& 가 leakproof 가 아니라 GIN 을 못 타므로(sql/66) 소유자로 돌아 인덱스를 탄다. 출처 칸은 p_source(PostgREST 14.5 가 함수 결과 임베드에 필터를 못 건다). 앱 queries.ts 가 그 축이 있을 때만 POST 로 부르고 나머지 조건은 PostgREST 가 결과에 건다. sql/72';
REVOKE ALL ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb) TO authenticated, service_role;

-- PostgREST 스키마 캐시 — 없으면 새 RPC 가 404(PGRST202)
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 속성·권한, 함수 = 표(개수 4가지), 인덱스 사용 가능, 빈 조건·바깥 도메인 거절 (하위 트랜잭션에서 되돌린다)
-- ---------------------------------------------
DO $verify$
DECLARE
  v_fn     RECORD;
  v_top    TEXT;
  v_gram   TEXT[];
  v_cnt_t  BIGINT; v_cnt_f  BIGINT;
  v_solo_t BIGINT; v_solo_f BIGINT;
  v_g_t    BIGINT; v_g_f    BIGINT;
  v_both_t BIGINT; v_both_f BIGINT;
  v_lvl_t  BIGINT; v_lvl_f  BIGINT;
  v_none_t BIGINT; v_none_f BIGINT;
  v_yr     TEXT;   v_yr_t   BIGINT; v_yr_f BIGINT;
  v_plan   TEXT;
  v_line   RECORD;
  t0       TIMESTAMPTZ;
  v_ms     NUMERIC;
BEGIN
  SELECT provolatile, prosecdef, COALESCE(array_to_string(proconfig, ','), '') AS cfg INTO v_fn
    FROM pg_proc WHERE oid = 'exam.problems_for_archive(text, boolean, text[], jsonb)'::regprocedure;
  IF v_fn.provolatile <> 's' OR NOT v_fn.prosecdef OR v_fn.cfg NOT LIKE '%search_path=exam, pg_temp%' THEN
    RAISE EXCEPTION 'sql/72: problems_for_archive 는 STABLE · SECURITY DEFINER · search_path=exam, pg_temp 여야 한다 (vol=%, definer=%, cfg=%)',
      v_fn.provolatile, v_fn.prosecdef, v_fn.cfg;
  END IF;
  IF NOT has_function_privilege('authenticated', 'exam.problems_for_archive(text, boolean, text[], jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.problems_for_archive(text, boolean, text[], jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'sql/72: 실행 권한이 어긋났다 (authenticated 만 열려 있어야 한다)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM exam.problems WHERE work_titles <> '{}')
     OR NOT EXISTS (SELECT 1 FROM exam.problems WHERE grammar_paths <> '{}') THEN
    RAISE NOTICE 'sql/72: 작품·문법 태그가 없는 표라 개수 대조를 건너뛴다';
    RETURN;
  END IF;

  -- 대표 조건: 가장 많이 태깅된 작품, '단어' 가지의 모든 경로(없으면 아무 경로 다섯)
  SELECT t INTO v_top FROM exam.problems, unnest(work_titles) AS t GROUP BY t ORDER BY count(*) DESC, t LIMIT 1;
  SELECT array_agg(DISTINCT t) INTO v_gram FROM exam.problems, unnest(grammar_paths) AS t WHERE t LIKE '단어%';
  IF v_gram IS NULL THEN
    SELECT array_agg(DISTINCT t) INTO v_gram
      FROM (SELECT t FROM exam.problems, unnest(grammar_paths) AS t LIMIT 5) s;
  END IF;

  -- 표에서 센 수 (소유자 = DEFINER 본문이 도는 롤)
  SELECT count(*) INTO v_cnt_t  FROM exam.problems WHERE work_titles @> ARRAY[v_top];
  SELECT count(*) INTO v_solo_t FROM exam.problems WHERE work_titles = ARRAY[v_top];
  SELECT count(*) INTO v_g_t    FROM exam.problems WHERE grammar_paths && v_gram;
  SELECT count(*) INTO v_both_t FROM exam.problems WHERE work_titles @> ARRAY[v_top] AND grammar_paths && v_gram;
  -- 출처 인자: 학교급(학년 여럿 in) · 교과서 '' (미지정인 출처만) · 학년도 eq — 표에서 조인해 센 수와 맞아야 한다
  SELECT count(*) INTO v_lvl_t FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id
   WHERE p.work_titles @> ARRAY[v_top] AND s.grade = ANY (ARRAY['중1', '중2', '중3']);
  SELECT count(*) INTO v_none_t FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id
   WHERE p.grammar_paths && v_gram AND s.textbook = '';
  SELECT s.year INTO v_yr FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id
   WHERE p.work_titles @> ARRAY[v_top] GROUP BY s.year ORDER BY count(*) DESC LIMIT 1;
  SELECT count(*) INTO v_yr_t FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id
   WHERE p.work_titles @> ARRAY[v_top] AND s.year = v_yr AND s.source_type = '내신기출';

  BEGIN
    -- 인덱스를 **쓸 수 있는가** (소유자 롤 — 비용으로 고른 계획은 작은 표에서 순차 스캔이 맞을 수 있어 끄고 본다, sql/66 꼴)
    PERFORM set_config('enable_seqscan', 'off', true);
    v_plan := '';
    FOR v_line IN EXECUTE format('EXPLAIN SELECT * FROM exam.problems WHERE work_titles @> %L::text[]', ARRAY[v_top]) LOOP
      v_plan := v_plan || v_line."QUERY PLAN" || E'\n';
    END LOOP;
    IF v_plan NOT LIKE '%idx_problems_work_titles%' THEN
      RAISE EXCEPTION 'sql/72: 작품 조건이 GIN 을 쓸 수 없다: %', v_plan;
    END IF;
    v_plan := '';
    FOR v_line IN EXECUTE format('EXPLAIN SELECT * FROM exam.problems WHERE grammar_paths && %L::text[]', v_gram) LOOP
      v_plan := v_plan || v_line."QUERY PLAN" || E'\n';
    END LOOP;
    IF v_plan NOT LIKE '%idx_problems_grammar_paths%' THEN
      RAISE EXCEPTION 'sql/72: 문법 조건이 GIN 을 쓸 수 없다: %', v_plan;
    END IF;
    PERFORM set_config('enable_seqscan', 'on', true);

    -- 선생님 계정으로 함수에서 센 수 = 표
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    SELECT count(*) INTO v_cnt_f  FROM exam.problems_for_archive(v_top);
    SELECT count(*) INTO v_solo_f FROM exam.problems_for_archive(v_top, true);
    t0 := clock_timestamp();
    SELECT count(*) INTO v_g_f    FROM exam.problems_for_archive(NULL, false, v_gram);
    v_ms := round(extract(epoch FROM clock_timestamp() - t0) * 1000);
    SELECT count(*) INTO v_both_f FROM exam.problems_for_archive(v_top, false, v_gram);
    IF v_cnt_f <> v_cnt_t OR v_solo_f <> v_solo_t OR v_g_f <> v_g_t OR v_both_f <> v_both_t THEN
      RAISE EXCEPTION 'sql/72: 함수와 표의 개수가 다르다 (작품 %/%, 솔로 %/%, 문법 %/%, 둘 %/%)',
        v_cnt_f, v_cnt_t, v_solo_f, v_solo_t, v_g_f, v_g_t, v_both_f, v_both_t;
    END IF;
    SELECT count(*) INTO v_lvl_f  FROM exam.problems_for_archive(v_top, false, NULL, '{"grades":["중1","중2","중3"]}');
    SELECT count(*) INTO v_none_f FROM exam.problems_for_archive(NULL, false, v_gram, '{"textbook":""}');
    SELECT count(*) INTO v_yr_f   FROM exam.problems_for_archive(v_top, false, NULL,
      jsonb_build_object('year', v_yr, 'source_type', '내신기출'));
    IF v_lvl_f <> v_lvl_t OR v_none_f <> v_none_t OR v_yr_f <> v_yr_t THEN
      RAISE EXCEPTION 'sql/72: 출처 인자를 건 개수가 표와 다르다 (학교급 %/%, 교과서 미지정 %/%, 학년도 %/%)',
        v_lvl_f, v_lvl_t, v_none_f, v_none_t, v_yr_f, v_yr_t;
    END IF;
    -- 모르는 출처 키는 거절 — 앱이 칸을 더했는데 여기를 안 고치면 조건이 조용히 빠지는 대신 오류가 난다
    BEGIN
      PERFORM count(*) FROM exam.problems_for_archive(v_top, false, NULL, '{"school_level":"중등"}');
      RAISE EXCEPTION 'sql/72: 모르는 출처 키가 통과했다';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;

    -- 빈 조건은 거절
    BEGIN
      PERFORM count(*) FROM exam.problems_for_archive(NULL, false, NULL);
      RAISE EXCEPTION 'sql/72: 조건 없는 호출이 통과했다';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
    BEGIN
      PERFORM count(*) FROM exam.problems_for_archive('  ', false, '{}');
      RAISE EXCEPTION 'sql/72: 빈 글자·빈 배열 호출이 통과했다';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;

    -- 바깥 도메인은 거절
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@gmail.com'
    )::text, true);
    BEGIN
      PERFORM count(*) FROM exam.problems_for_archive(v_top);
      RAISE EXCEPTION 'sql/72: 바깥 도메인에게 문항이 보인다';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
  END;
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/72: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;

  RAISE NOTICE 'sql/72 검증: 작품 "%" %건 · 그 작품만 %건 · 문법 %개 경로 %건(함수 % ms) · 작품+문법 %건 · 중등 %건 · 교과서 미지정 %건 · % 내신 %건 — 함수=표, GIN 둘 사용 가능, 빈 조건·모르는 출처 키·바깥 도메인 거절',
    v_top, v_cnt_t, v_solo_t, cardinality(v_gram), v_g_t, v_ms, v_both_t, v_lvl_t, v_none_t, v_yr, v_yr_t;
END
$verify$;
