-- =============================================
-- 107. 기출 세트 목록 — 학교만 다른 내신 시험 · 같은 회차의 모의고사 과목을 한 번에 묶어 준다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/107_problem_source_sets.sql
-- =============================================
-- 배경 (2026-11-13, 원장님: "기출 공유 사이트처럼 세트 별로 볼 수 있게 하는 곳도 있으면 좋겠음 … 몇학기 무슨 학교 나오게")
--   새 화면 `/problems/sets` 가 세트 카드를 그린다. 세트의 뜻은 기출 공유 사이트(exam-share browse_slots)와 같다:
--     · 내신기출 — 학년도·학년·학기·시험·교과서가 같고 **학교만 다른** 시험들
--     · 모의고사 — 학년도·학년·회차(exam_type)·주관(publisher)이 같은 **과목들**(제목 끝 괄호가 과목)
--   평가문제집·문제집·프린트는 세트가 아니다(문제 은행이 평가문제집을 숨기는 규칙 — sql/85 — 과도 맞다).
--
-- 무엇을 하는가
--   · exam.source_sets() → jsonb 배열 하나. 원소 = {source_type, year, grade, semester, exam_type, textbook, publisher,
--     exam_count, names}. 키 이름·모양은 앱 src/lib/problem-bank/source-sets-payload.ts 와 1:1 이다.
--     names 는 내신이면 학교 이름, 모의고사면 출처 제목(DISTINCT). exam_count 는 출처 행 수 — 같은 학교가 한 세트에
--     두 건(과목 둘) 든 세트가 있어 names 수와 다를 수 있다(2026-11-13 운영 8세트).
--   · jsonb 하나로 주는 까닭: PostgREST 는 행을 1,000에서 **말없이** 자른다(내신 세트만 141장이지만 늘어난다).
--   · **문항 표를 읽지 않는다** — 이 인스턴스는 쪽 수가 비용이다(sql/71 머리말). 세트 카드에는 문항 수가 없고,
--     세트 한 장 화면은 그 세트 출처만 계산 열(sql/74 problem_count)로 센다.
--   · SECURITY INVOKER — problem_sources 의 SELECT 정책(교직원 전원, sql/65)이 그대로 걸린다. 바깥 도메인은 빈 배열.
--   · 모의고사는 학기·교과서를 ''로 접는다 — 옛 행에 값이 남아도 같은 회차가 두 장으로 갈리지 않게(기출 트리
--     school-exam-tree.ts 와 같은 판단). 내신은 주관을 ''로 접는다(내신 행의 publisher 는 세트를 가르지 않는다).
--   · 평가원 회차의 학년 합치기('' 와 '고3')는 **앱이 한다**(isKiceRound) — 회차 목록을 SQL 에 거울로 두지 않는다.
--
-- archive_facets().sources(sql/85)를 쓰지 않은 까닭: 거기에는 주관·제목·건수가 없어 모의고사 과목 줄을 못 그린다.
--   그 함수에 칸을 더하면 캐시·쓰기 표시 트리거(sql/71·85 의 WHEN 칸 목록)까지 함께 고쳐야 한다.
--
-- ⚠️ **앱 배포보다 먼저** 적용한다 — 세트 목록 화면이 이 함수를 부른다(없으면 그 화면만 '불러오지 못했어요').
-- 멱등: CREATE OR REPLACE.
-- ⛳️ 되돌릴 때: 앱의 '기출 세트' 메뉴·화면을 먼저 내린 뒤
--    DROP FUNCTION exam.source_sets(); NOTIFY pgrst, 'reload schema';
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problem_sources') IS NULL THEN
    RAISE EXCEPTION 'sql/107: exam.problem_sources 가 없다 — 공유 프로젝트(exam 스키마)에 붙었는지 확인할 것 (db=%)',
      current_database();
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION exam.source_sets()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = exam, pg_temp
AS $fn$
  SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
    FROM (
      SELECT k.source_type, k.year, k.grade, k.semester, k.exam_type, k.textbook, k.publisher,
             count(*)::int AS exam_count,
             array_agg(DISTINCT k.name ORDER BY k.name) AS names
        FROM (
          SELECT s.source_type, s.year, s.grade, s.exam_type,
                 CASE WHEN s.source_type = '모의고사' THEN '' ELSE s.semester END     AS semester,
                 CASE WHEN s.source_type = '모의고사' THEN '' ELSE s.textbook END     AS textbook,
                 CASE WHEN s.source_type = '모의고사' THEN s.publisher ELSE '' END    AS publisher,
                 CASE WHEN s.source_type = '모의고사' THEN s.title ELSE s.school_name END AS name
            FROM exam.problem_sources s
           WHERE s.source_type IN ('내신기출', '모의고사')
        ) k
       GROUP BY k.source_type, k.year, k.grade, k.semester, k.exam_type, k.textbook, k.publisher
    ) g
$fn$;
COMMENT ON FUNCTION exam.source_sets() IS
  '기출 세트 목록(내신: 학년도·학년·학기·시험·교과서가 같은 학교들 / 모의고사: 학년도·학년·회차·주관이 같은 과목들) — 앱 source-set-queries.ts 가 한 번에 읽는다. SECURITY INVOKER(RLS 적용), 문항 표를 읽지 않는다. sql/107';
REVOKE ALL ON FUNCTION exam.source_sets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.source_sets() TO authenticated, service_role;

-- PostgREST 스키마 캐시 — 없으면 rpc/source_sets 가 404
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 속성·권한, 세트 수·건수 합 대조, 원소 모양, 바깥 도메인 빈 배열 (하위 트랜잭션에서 되돌린다)
-- ---------------------------------------------
DO $verify$
DECLARE
  v_fn            RECORD;
  v_in            JSONB;
  v_out           JSONB;
  v_plan          JSONB;
  v_want_rows     BIGINT;
  v_want_sets     BIGINT;
  v_school        BIGINT;
  v_mock          BIGINT;
  v_blank_tb      BIGINT;
  v_max           BIGINT;
  v_twice         BIGINT;
  v_mock_nograde  BIGINT;
  v_got_rows      BIGINT;
  v_got_names     BIGINT;
  v_want_names    BIGINT;
  v_bad           BIGINT;
BEGIN
  -- 1. 속성·권한
  SELECT p.provolatile, p.prosecdef, array_to_string(p.proconfig, ',') AS cfg INTO v_fn
    FROM pg_proc p WHERE p.oid = 'exam.source_sets()'::regprocedure;
  IF v_fn.provolatile <> 's' OR v_fn.prosecdef OR COALESCE(v_fn.cfg, '') NOT LIKE '%search_path=exam, pg_temp%' THEN
    RAISE EXCEPTION 'sql/107: source_sets 는 STABLE · SECURITY INVOKER · search_path=exam, pg_temp 여야 한다 (vol=%, definer=%, cfg=%)',
      v_fn.provolatile, v_fn.prosecdef, v_fn.cfg;
  END IF;
  IF NOT has_function_privilege('authenticated', 'exam.source_sets()', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.source_sets()', 'EXECUTE') THEN
    RAISE EXCEPTION 'sql/107: 실행 권한이 어긋났다 (authenticated 만 열려 있어야 한다)';
  END IF;

  -- 2. 기대값 — 소유자(RLS 밖)로 표에서 직접 센다
  SELECT count(*) INTO v_want_rows FROM exam.problem_sources WHERE source_type IN ('내신기출', '모의고사');
  SELECT count(*),
         count(*) FILTER (WHERE t.source_type = '내신기출'),
         count(*) FILTER (WHERE t.source_type = '모의고사'),
         count(*) FILTER (WHERE t.source_type = '내신기출' AND t.textbook = ''),
         COALESCE(max(t.names), 0),
         count(*) FILTER (WHERE t.n > t.names),
         COALESCE(sum(t.names), 0)
    INTO v_want_sets, v_school, v_mock, v_blank_tb, v_max, v_twice, v_want_names
    FROM (SELECT source_type, year, grade, exam_type,
                 CASE WHEN source_type = '모의고사' THEN '' ELSE semester END  AS semester,
                 CASE WHEN source_type = '모의고사' THEN '' ELSE textbook END  AS textbook,
                 CASE WHEN source_type = '모의고사' THEN publisher ELSE '' END AS publisher,
                 count(*) AS n,
                 count(DISTINCT CASE WHEN source_type = '모의고사' THEN title ELSE school_name END) AS names
            FROM exam.problem_sources
           WHERE source_type IN ('내신기출', '모의고사')
           GROUP BY 1, 2, 3, 4, 5, 6, 7) t;
  SELECT count(*) INTO v_mock_nograde FROM exam.problem_sources WHERE source_type = '모의고사' AND grade = '';
  IF v_want_rows = 0 THEN
    RAISE NOTICE 'sql/107: 내신기출·모의고사 출처가 없어 값·RLS 검사를 건너뛴다';
    RETURN;
  END IF;

  -- 3. 교직원 JWT 와 바깥 도메인
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    v_in := exam.source_sets();
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT exam.source_sets()' INTO v_plan;

    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@gmail.com'
    )::text, true);
    v_out := exam.source_sets();

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
  END;
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/107: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;

  IF jsonb_typeof(v_in) <> 'array' OR jsonb_array_length(v_in) <> v_want_sets THEN
    RAISE EXCEPTION 'sql/107: 교직원이 받은 세트 수가 표와 다르다 (함수 % · 표 %)', jsonb_array_length(v_in), v_want_sets;
  END IF;
  SELECT COALESCE(sum((e ->> 'exam_count')::bigint), 0),
         COALESCE(sum(jsonb_array_length(e -> 'names')), 0),
         count(*) FILTER (WHERE NOT (e ?& ARRAY['source_type','year','grade','semester','exam_type','textbook','publisher','exam_count','names'])
                             OR jsonb_typeof(e -> 'names') <> 'array'
                             OR jsonb_array_length(e -> 'names') = 0
                             OR e ->> 'source_type' NOT IN ('내신기출', '모의고사'))
    INTO v_got_rows, v_got_names, v_bad
    FROM jsonb_array_elements(v_in) e;
  IF v_got_rows <> v_want_rows THEN
    RAISE EXCEPTION 'sql/107: 시험 건수 합이 표와 다르다 (함수 % · 표 %)', v_got_rows, v_want_rows;
  END IF;
  IF v_got_names <> v_want_names THEN
    RAISE EXCEPTION 'sql/107: 이름 수 합이 표와 다르다 (함수 % · 표 %)', v_got_names, v_want_names;
  END IF;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'sql/107: 모양이 어긋난 세트가 % 장', v_bad;
  END IF;
  IF v_out <> '[]'::jsonb THEN
    RAISE EXCEPTION 'sql/107: 바깥 도메인에게 세트가 보인다 (% 장)', jsonb_array_length(v_out);
  END IF;

  RAISE NOTICE 'sql/107 검증: STABLE·INVOKER·authenticated 전용; 세트 % (내신 % · 모의고사 %) · 시험 % 건 · 이름 % 개 = 표와 일치; 교과서 빈 내신 세트 %; 한 세트 최대 % 곳; 같은 이름 두 건 든 세트 %; 학년 빈 모의고사 % 건; 바깥 도메인 빈 배열; % 쪽 · % ms · % bytes',
    v_want_sets, v_school, v_mock, v_want_rows, v_want_names, v_blank_tb, v_max, v_twice, v_mock_nograde,
    (v_plan -> 0 -> 'Plan' ->> 'Shared Hit Blocks')::bigint + (v_plan -> 0 -> 'Plan' ->> 'Shared Read Blocks')::bigint,
    round((v_plan -> 0 ->> 'Execution Time')::numeric, 1), octet_length(v_in::text);
END
$verify$;
