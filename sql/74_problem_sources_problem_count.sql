-- =============================================
-- 74. 올라간 기출 목록의 문항 수 — 임베드 대신 계산 열(computed field)로, 보이는 30건에만 센다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/74_problem_sources_problem_count.sql
-- =============================================
-- 배경 (2026-10-22, 원장님: "올라간 기출 리스트가 한세월 네월 보이네")
--   `/problems/sources` 는 한 쪽(30건)을 `select=*,problems(count)` 한 번으로 받는다. 출처 1,185 · 문항 32,621 시점에
--   pg_stat_statements: 156회 · 평균 0.9초 · 최대 7.7초 · 호출당 12,216쪽. authenticated 롤 + JWT 로 EXPLAIN ANALYZE 하면
--   첫 실행 6.5초 / 곧바로 다시 0.13초, 56,051쪽이다(이 인스턴스는 '쪽 수' 가 비용이다 — sql/71 머리말).
--
-- 원인
--   · 플래너가 RLS 조건 `(select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain())` 의 선택도를 몰라
--     출처를 **3행**으로 추정한다. 그래서 `idx_problem_sources_recent` 로 30건에서 멈추는 대신
--     출처 전체 순차 스캔 → **1,185개 출처마다** 문항 count(LATERAL 조인) → 정렬 → 30건 을 고른다.
--   · PostgREST 의 임베드 count 는 `count(problems_1)`(행 전체)라 인덱스 전용 스캔도 못 타고 문항 본문 쪽까지 읽는다.
--   · ⚠️ sql/66 의 "정렬 인덱스를 쓰면 count 도 30번만 돈다" 는 `enable_seqscan=off` 로 '쓸 수 있는가' 만 본 것이었다 —
--     실제 계획은 그 인덱스를 고르지 않는다.
--
-- 무엇을 하는가
--   · exam.problem_count(exam.problem_sources) — PostgREST 계산 열. 앱은 `select=*,problem_count` 로 부른다.
--   · 계산 열은 select 목록의 함수 호출이라, 플래너가 **비싼 식을 정렬·LIMIT 뒤로 미룬다**(make_sort_input_target —
--     LIMIT 이 있고 식 비용이 10 × cpu_operator_cost 를 **넘으면** — 같으면 안 미뤄진다). 그래서 계획이 무엇이든 count 는 **보이는 30건에만** 돈다.
--     본문이 `count(*)` 라 `idx_problems_source_page` 인덱스 전용 스캔이다. 같은 모양 실측: 870쪽, 첫 실행 0.69초 / 다시 ~15 ms.
--   · ⚠️ COST 100(SQL 함수 기본값)을 **10 이하로 내리지 말 것**(10 초과여야 한다) — 미뤄지지 않고 1,185번 돈다(0.0025 × 100 = 0.25 > 0.025).
--   · ⚠️ 본문에 FROM 이 있어야 한다 — FROM 없는 SQL 함수는 호출 자리에 인라인돼 함수 비용이 사라진다.
--   · SECURITY INVOKER — 지금 임베드처럼 problems RLS 아래에서 센다(`source_id = …` 의 `=` 는 leakproof 라 인덱스를 탄다).
--   · 필터 체인은 그대로 앱(source-axes.ts 의 applySourceAxes)에 둔다 — sql/72 와 같은 판단. 목록·'더 보기'·지운 뒤
--     다시 읽기(refetchSources)·count exact 가 바뀌지 않는다.
--   · 두 왕복(목록 → 그 30건의 개수)으로 나누지 않은 까닭: 한 왕복으로 같은 효과가 나고, 두 응답을 맞추는 코드가 필요 없다.
--
-- ⚠️ **앱 배포보다 먼저** 적용한다 — 앱이 problem_count 를 select 하므로 함수가 없으면 목록이 400 으로 통째로 죽는다.
-- 멱등: CREATE OR REPLACE.
-- ⛳️ 되돌릴 때: 앱(source-list.ts)을 `problems(count)` 임베드로 먼저 되돌린 뒤
--    DROP FUNCTION exam.problem_count(exam.problem_sources); NOTIFY pgrst, 'reload schema';
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problem_sources') IS NULL OR to_regclass('exam.problems') IS NULL THEN
    RAISE EXCEPTION 'sql/74: exam.problem_sources / exam.problems 가 없다 — 공유 프로젝트(exam 스키마)에 붙었는지 확인할 것 (db=%)',
      current_database();
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION exam.problem_count(s exam.problem_sources)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
COST 100
AS $fn$
  SELECT count(*)::integer FROM exam.problems WHERE source_id = s.id
$fn$;
COMMENT ON FUNCTION exam.problem_count(exam.problem_sources) IS
  '올라간 기출 목록의 문항 수(PostgREST 계산 열, select=*,problem_count). 임베드 count 는 RLS 행 추정(3) 때문에 출처 전체에 돌았다 — 계산 열은 정렬·LIMIT 뒤로 미뤄져 보이는 행에만 돈다. COST 는 10 초과여야 한다. sql/74';
REVOKE ALL ON FUNCTION exam.problem_count(exam.problem_sources) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.problem_count(exam.problem_sources) TO authenticated, service_role;

-- PostgREST 스키마 캐시 — 없으면 `column problem_sources.problem_count does not exist`(400)
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 속성·권한, 값 대조, 정렬·LIMIT 뒤로 미뤄지는가(쪽 수), 바깥 도메인 0 (하위 트랜잭션에서 되돌린다)
-- ---------------------------------------------
DO $verify$
DECLARE
  v_fn       RECORD;
  v_bad      BIGINT;
  v_sources  BIGINT;
  v_row      exam.problem_sources;
  v_want     BIGINT;
  v_got_in   INTEGER;
  v_got_out  INTEGER;
  v_new      JSONB;
  v_old      JSONB;
  v_new_blk  BIGINT;
  v_old_blk  BIGINT;
  v_new_ms   NUMERIC;
  v_old_ms   NUMERIC;
  v_scan_hit BIGINT;
  v_any_hit  BIGINT;
  -- PostgREST 14.5 가 내는 모양(목록 CTE + count exact CTE). PostgREST 는 속성 표기 `"exam"."problem_sources"."problem_count"` 로
  -- 부르고(search_path=exam 으로 함수를 찾는다) 여기서는 함수 표기로 쓴다 — 둘 다 같은 함수 호출로 계획된다(2026-10-22 실측)
  c_new CONSTANT TEXT := $sql$
    WITH pgrst_source AS (
      SELECT "exam"."problem_sources".*, "exam"."problem_count"("problem_sources") AS "problem_count"
      FROM "exam"."problem_sources"
      ORDER BY "exam"."problem_sources"."created_at" DESC, "exam"."problem_sources"."id" DESC
      LIMIT 30 OFFSET 0
    ), pgrst_source_count AS (SELECT 1 FROM "exam"."problem_sources")
    SELECT (SELECT pg_catalog.count(*) FROM pgrst_source_count) AS total_result_set,
           pg_catalog.count(_postgrest_t) AS page_total,
           coalesce(json_agg(_postgrest_t), '[]') AS body
    FROM (SELECT * FROM pgrst_source) _postgrest_t
  $sql$;
  -- 옛 임베드 모양(`select=*,problems(count)`) — 비교 기준
  c_old CONSTANT TEXT := $sql$
    WITH pgrst_source AS (
      SELECT "exam"."problem_sources".*,
             COALESCE("problem_sources_problems_1"."problem_sources_problems_1", '[]'::jsonb) AS "problems"
      FROM "exam"."problem_sources"
      LEFT JOIN LATERAL (
        SELECT json_agg("problem_sources_problems_1")::jsonb AS "problem_sources_problems_1"
        FROM (SELECT "problems_1"."count" FROM "exam"."problems" AS "problems_1"
              WHERE "problems_1"."source_id" = "exam"."problem_sources"."id" LIMIT ALL OFFSET 0) AS "problem_sources_problems_1"
      ) AS "problem_sources_problems_1" ON TRUE
      ORDER BY "exam"."problem_sources"."created_at" DESC, "exam"."problem_sources"."id" DESC
      LIMIT 30 OFFSET 0
    ), pgrst_source_count AS (SELECT 1 FROM "exam"."problem_sources")
    SELECT (SELECT pg_catalog.count(*) FROM pgrst_source_count) AS total_result_set,
           pg_catalog.count(_postgrest_t) AS page_total,
           coalesce(json_agg(_postgrest_t), '[]') AS body
    FROM (SELECT * FROM pgrst_source) _postgrest_t
  $sql$;
BEGIN
  -- 1. 속성·권한
  SELECT provolatile, prosecdef, procost INTO v_fn
    FROM pg_proc WHERE oid = 'exam.problem_count(exam.problem_sources)'::regprocedure;
  IF v_fn.provolatile <> 's' OR v_fn.prosecdef OR v_fn.procost <= 10 THEN
    RAISE EXCEPTION 'sql/74: problem_count 는 STABLE · SECURITY INVOKER · COST > 10 이어야 한다 (vol=%, definer=%, cost=%)',
      v_fn.provolatile, v_fn.prosecdef, v_fn.procost;
  END IF;
  IF NOT has_function_privilege('authenticated', 'exam.problem_count(exam.problem_sources)', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.problem_count(exam.problem_sources)', 'EXECUTE') THEN
    RAISE EXCEPTION 'sql/74: 실행 권한이 어긋났다 (authenticated 만 열려 있어야 한다)';
  END IF;

  -- 2. 값 대조 (소유자 — 모든 출처)
  SELECT count(*) INTO v_sources FROM exam.problem_sources;
  SELECT count(*) INTO v_bad FROM exam.problem_sources s
   WHERE exam.problem_count(s) <> (SELECT count(*) FROM exam.problems p WHERE p.source_id = s.id);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'sql/74: 문항 수가 직접 센 값과 다른 출처가 % 건', v_bad;
  END IF;
  IF v_sources = 0 THEN
    RAISE NOTICE 'sql/74: 출처가 없는 표라 계획·RLS 검사를 건너뛴다';
    RETURN;
  END IF;
  SELECT s.* INTO v_row FROM exam.problem_sources s
   ORDER BY (SELECT count(*) FROM exam.problems p WHERE p.source_id = s.id) DESC, s.id LIMIT 1;
  SELECT count(*) INTO v_want FROM exam.problems WHERE source_id = v_row.id;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);

    -- 3. 교직원 JWT — 같은 값, 그리고 count 가 정렬·LIMIT 뒤로 미뤄지는가
    v_got_in := exam.problem_count(v_row);
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ' || c_new INTO v_new;
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || c_old INTO v_old;

    -- 4. 바깥 도메인 — problems RLS 아래라 0
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@gmail.com'
    )::text, true);
    v_got_out := exam.problem_count(v_row);

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
  END;
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/74: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;

  IF v_got_in <> v_want THEN
    RAISE EXCEPTION 'sql/74: 교직원 JWT 로 센 문항 수(%)가 표의 수(%)와 다르다', v_got_in, v_want;
  END IF;
  IF v_got_out <> 0 AND v_want > 0 THEN
    RAISE EXCEPTION 'sql/74: 바깥 도메인에게 문항 수가 보인다 (%)', v_got_out;
  END IF;

  -- 출처 표를 읽는 스캔 노드가 계산 열을 내면 미뤄지지 않은 것이다(전부에 돈다)
  SELECT count(*) FILTER (WHERE n ->> 'Relation Name' = 'problem_sources' AND n ->> 'Node Type' LIKE '%Scan'),
         count(*)
    INTO v_scan_hit, v_any_hit
    FROM (SELECT DISTINCT n FROM jsonb_path_query(v_new, 'lax $.**') AS n
           WHERE jsonb_typeof(n) = 'object' AND n ? 'Node Type'
             AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(n -> 'Output', '[]'::jsonb)) o
                          WHERE o LIKE '%problem_count(%')) AS x;
  IF v_any_hit = 0 THEN
    RAISE EXCEPTION 'sql/74: 계획 어디에도 problem_count 가 없다 — 인라인됐나? %', v_new;
  END IF;
  IF v_scan_hit > 0 THEN
    RAISE EXCEPTION 'sql/74: 문항 수가 출처 스캔에서 계산된다(정렬·LIMIT 뒤로 미뤄지지 않았다) — COST 를 확인할 것: %', v_new;
  END IF;

  v_new_blk := (v_new -> 0 -> 'Plan' ->> 'Shared Hit Blocks')::bigint + (v_new -> 0 -> 'Plan' ->> 'Shared Read Blocks')::bigint;
  v_old_blk := (v_old -> 0 -> 'Plan' ->> 'Shared Hit Blocks')::bigint + (v_old -> 0 -> 'Plan' ->> 'Shared Read Blocks')::bigint;
  v_new_ms  := round((v_new -> 0 ->> 'Execution Time')::numeric, 1);
  v_old_ms  := round((v_old -> 0 ->> 'Execution Time')::numeric, 1);
  IF v_sources >= 100 AND v_new_blk * 3 >= v_old_blk THEN
    RAISE EXCEPTION 'sql/74: 새 모양이 옛 임베드보다 충분히 덜 읽지 않는다 (새 %쪽 · 옛 %쪽)', v_new_blk, v_old_blk;
  END IF;

  RAISE NOTICE 'sql/74 검증: STABLE·INVOKER·COST %, 출처 % 건 값 일치, 교직원 % = 표 % / 바깥 도메인 %; 계산 열은 스캔 밖(정렬·LIMIT 뒤); 쪽 수 옛 % → 새 % (% ms → % ms)',
    v_fn.procost, v_sources, v_got_in, v_want, v_got_out, v_old_blk, v_new_blk, v_old_ms, v_new_ms;
END
$verify$;
