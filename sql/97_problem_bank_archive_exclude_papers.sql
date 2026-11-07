-- =============================================
-- 97. 문제지 만들기 — 작품·문법 함수가 '이 문제지들에 담긴 문항은 빼고' 를 받는다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/97_problem_bank_archive_exclude_papers.sql
-- =============================================
-- 배경: 원장님(2026-11-07) "음운 2주차는 1주차에 안 넣었던 문제들만 넣고 싶어 — 어떤 문제지들과 중복되지 않은 문제만 넣는 기능".
--   표 경로는 PostgREST 임베드 반조인으로 뺀다(`problem_paper_items!left(paper_id)` + `problem_paper_items=is.null`, 운영 실측).
--   함수 결과에는 임베드 필터를 못 건다(운영 PostgREST 14.5 `column pgrst_call.paper_id does not exist`) — 그래서 함수 인자다.
-- ⚠️ **이 파일이 exam.problems_for_archive 의 정식 정의다** — sql/72·82·85 를 다시 돌리면 4인자 판이 함께 생겨 PostgREST 가
--    후보를 못 고르고(300) 작품·문법 목록이 통째로 죽는다. 다시 돌렸으면 이 파일을 뒤이어 돌릴 것(4인자 판을 지운다).
--    패싯(archive_facets_refresh)의 정식 정의는 그대로 sql/85 다.
-- ⚠️ 옛 판을 지우고 새로 만든다 — CREATE OR REPLACE 는 인자가 다르면 오버로드를 만든다. run-sql.js 는 파일을 한 번에 보내
--    한 트랜잭션이라 함수가 없는 틈이 없고, 옛 탭의 4인자 호출은 DEFAULT 로 그대로 된다.
-- ⚠️ 정답 없는 문항 빼기(`answer=neq.`)는 함수 결과의 제 칸이라 PostgREST 가 건다 — 인자가 필요 없다.
-- ⚠️ 그 조건은 문제지 만들기의 **기본값**이라 화면을 열 때마다 돈다. 그냥 걸면 개수 조회(count exact)가 인덱스 전용 스캔에서
--    문항 표 순차 스캔(11,268쪽)으로 바뀐다 — 이 인스턴스는 쪽 수가 비용이라 차가울 때 수 초다(운영 임시 대조가 5초에 걸렸다, sql/71 머리말).
--    그래서 부분 인덱스를 둔다. 술어의 `<>`(textne)는 leakproof 라 RLS 아래에서도 인덱스 전용 스캔이 된다(authenticated 롤로 실측).
--    `id` 까지 든 까닭: 문제지 빼기의 반조인이 문항 id 로 묻는다 — 없으면 그 개수 조회가 다시 표를 읽는다.

DO $guard$
BEGIN
  IF to_regclass('exam.problem_paper_items') IS NULL THEN
    RAISE EXCEPTION 'sql/97: exam.problem_paper_items 가 없다 (현재 DB: %)', current_database();
  END IF;
  IF to_regprocedure('exam.problems_for_archive(text, boolean, text[], jsonb)') IS NULL
     AND to_regprocedure('exam.problems_for_archive(text, boolean, text[], jsonb, uuid[])') IS NULL THEN
    RAISE EXCEPTION 'sql/97: sql/85 가 먼저 적용돼야 한다 (현재 DB: %)', current_database();
  END IF;
END
$guard$;

-- 정답을 적은 문항만 담은 240쪽 안팎의 인덱스. 술어를 바꾸면 앱의 `answer=neq.`(paper-exclusions.ts)와 어긋나 조용히 안 쓰인다
CREATE INDEX IF NOT EXISTS idx_problems_source_answered ON exam.problems (source_id, id) WHERE answer <> '';

DROP FUNCTION IF EXISTS exam.problems_for_archive(text, boolean, text[], jsonb);

CREATE OR REPLACE FUNCTION exam.problems_for_archive(
  p_work_title     TEXT    DEFAULT NULL,
  p_only_work      BOOLEAN DEFAULT FALSE,
  p_grammar_paths  TEXT[]  DEFAULT NULL,
  p_source         JSONB   DEFAULT NULL,
  p_exclude_papers UUID[]  DEFAULT NULL
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
  -- 문제지 빼기: 담긴 문항은 지운 문항이면 problem_id 가 NULL 이라 안 걸린다(스냅샷만 남은 자리 — 빼고 말고 할 문항이 없다).
  IF v_title IS NOT NULL THEN
    v_where := array_append(v_where, 'p.work_titles @> ARRAY[$1]');
    IF v_only THEN v_where := array_append(v_where, 'p.work_titles = ARRAY[$1]'); END IF;
  END IF;
  IF v_paths IS NOT NULL THEN
    v_where := array_append(v_where, 'p.grammar_paths && $2');
  END IF;
  IF cardinality(p_exclude_papers) > 0 THEN
    v_where := array_append(v_where,
      'NOT EXISTS (SELECT 1 FROM exam.problem_paper_items i WHERE i.problem_id = p.id AND i.paper_id = ANY ($5))');
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
    USING v_title, v_paths, v_src, v_grades, p_exclude_papers;
END;
$$;
COMMENT ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb, uuid[]) IS
  '아카이브 작품·문법 축 — RLS 아래선 @>/&& 가 leakproof 가 아니라 GIN 을 못 타므로(sql/66) 소유자로 돌아 인덱스를 탄다. 출처 칸은 p_source, 문제지 빼기는 p_exclude_papers(PostgREST 14.5 가 함수 결과 임베드에 필터를 못 건다). 앱 queries.ts 가 그 축이 있을 때만 POST 로 부르고 나머지 조건은 PostgREST 가 결과에 건다. sql/72 · 출처 제목 축 sql/82 · 유형 빼기 sql/85 · 문제지 빼기 sql/97';
REVOKE ALL ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.problems_for_archive(text, boolean, text[], jsonb, uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 옛 판이 없는가 · 교직원 JWT 로 불러 빼기가 듣는가 · 비우면 그대로인가 · 모르는 키는 여전히 거절되는가
-- ---------------------------------------------
DO $probe$
DECLARE
  v_user   UUID;
  v_email  TEXT;
  v_paper  UUID;
  v_path   TEXT;
  v_inside BIGINT;
  v_all    BIGINT;
  v_empty  BIGINT;
  v_left   BIGINT;
  v_ok     BOOLEAN := false;
  v_line   TEXT;
  v_plan   TEXT;
  v_indexed BOOLEAN := false;
BEGIN
  IF to_regprocedure('exam.problems_for_archive(text, boolean, text[], jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'sql/97: 4인자 판이 남아 있다 — PostgREST 가 후보를 못 고른다';
  END IF;

  SELECT id, email INTO v_user, v_email
    FROM auth.users WHERE email LIKE '%@araeducation.co.kr' ORDER BY created_at LIMIT 1;
  -- 문법 태그가 달린 문항이 가장 많이 담긴 문제지와 그 태그 — 빼기가 가르는 것을 볼 수 있는 조합
  SELECT i.paper_id, g.path INTO v_paper, v_path
    FROM exam.problem_paper_items i
    JOIN exam.problems p ON p.id = i.problem_id
    CROSS JOIN LATERAL unnest(p.grammar_paths) AS g(path)
   GROUP BY i.paper_id, g.path
   ORDER BY count(*) DESC, i.paper_id, g.path LIMIT 1;
  IF v_user IS NULL OR v_paper IS NULL THEN
    RAISE NOTICE 'sql/97 probe 건너뜀: 학원 사용자 또는 문법 문항이 담긴 문제지가 없다';
    RETURN;
  END IF;
  SELECT count(DISTINCT i.problem_id) INTO v_inside
    FROM exam.problem_paper_items i JOIN exam.problems p ON p.id = i.problem_id
   WHERE i.paper_id = v_paper AND p.grammar_paths && ARRAY[v_path];

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', v_email)::text, true);

    SELECT count(*) INTO v_all FROM exam.problems_for_archive(NULL, false, ARRAY[v_path], '{}'::jsonb);
    SELECT count(*) INTO v_empty FROM exam.problems_for_archive(NULL, false, ARRAY[v_path], '{}'::jsonb, ARRAY[]::uuid[]);
    SELECT count(*) INTO v_left FROM exam.problems_for_archive(NULL, false, ARRAY[v_path], '{}'::jsonb, ARRAY[v_paper]);
    IF v_empty <> v_all THEN
      RAISE EXCEPTION 'sql/97 probe 실패: 빈 목록이 조건이 됐다 (전체 % · 빈 목록 %)', v_all, v_empty;
    END IF;
    IF v_left <> v_all - v_inside OR v_inside = 0 THEN
      RAISE EXCEPTION 'sql/97 probe 실패: 「%」 전체 % · 뺀 뒤 % · 담긴 %', v_path, v_all, v_left, v_inside;
    END IF;

    BEGIN
      PERFORM count(*) FROM exam.problems_for_archive(NULL, false, ARRAY[v_path], '{"no_such_key":"x"}'::jsonb);
    EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'sql/97 probe 실패: 모르는 출처 키가 통과했다'; END IF;

    -- 비용으로 고른 실제 계획을 본다. 통계가 바뀌면 달라질 수 있어 멈추지 않고 알리기만 한다
    v_plan := '';
    FOR v_line IN EXECUTE $q$EXPLAIN SELECT count(*) FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id
                              WHERE s.source_type <> '평가문제집' AND p.answer <> ''$q$ LOOP
      v_plan := v_plan || v_line;
    END LOOP;
    v_indexed := position('idx_problems_source_answered' IN v_plan) > 0;

    RAISE EXCEPTION '__sql97_probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__sql97_probe_rollback__' THEN RAISE; END IF;
  END;
  IF current_user <> session_user THEN RAISE EXCEPTION 'sql/97: 역할이 되돌아가지 않았다'; END IF;
  RAISE NOTICE '✓ sql/97 함수 — 「%」 전체 % → 문제지 뺀 뒤 % (담긴 %) · 빈 목록은 조건 아님 · 모르는 키 거절', v_path, v_all, v_left, v_inside;
  IF v_indexed THEN
    RAISE NOTICE '✓ sql/97 인덱스 — 정답 빼기 개수 조회가 idx_problems_source_answered 를 쓴다';
  ELSE
    RAISE WARNING 'sql/97: 정답 빼기 개수 조회가 부분 인덱스를 안 쓴다 — authenticated 롤로 EXPLAIN 을 볼 것';
  END IF;
END
$probe$;
