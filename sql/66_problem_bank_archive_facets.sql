-- =============================================
-- 66. 기출 아카이브 성능 — 패싯을 서버에서 한 번에 · 목록 정렬 인덱스
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/66_problem_bank_archive_facets.sql
-- =============================================
-- 배경 (2026-10-11 "문제가 많아져서 작품 목록이나 그런 게 너무 느리다", 문항 29,045 · 지문 6,317 · 출처 1,089)
--
-- 1) 패싯(작품·영역·단원·문법 트리와 필터 선택지)
--    앱이 problems 의 한 열을 `ORDER BY id LIMIT 1000 OFFSET n` 으로 1,000행씩 **순서대로** 받아
--    브라우저에서 셌다 — 열마다 19~29번 왕복이고(작품 열 하나만 3.3초) 작품은 passages 를 또 긁는다.
--    게다가 안전판 20,000행에 영역 열(29,045행)이 이미 걸려 있었고 작품 열(18,810행)도 코앞이었다 —
--    걸리면 뒤쪽 문항이 트리·건수에서 **조용히** 빠진다(그날은 고유 영역 20개가 앞쪽에 다 있어 빠진 값은 없었다).
--    exam.archive_facets() 가 jsonb 하나로 돌려준다(PostgREST 1,000행 상한과 무관).
--    ⚠️ SQL 은 DISTINCT·GROUP BY 개수만 한다. 문법 조상 펴기·문항 단위 중복 제거(grammar-counts.ts),
--       문학/문법/비문학 표결과 동률 차례·지은이 다수결(work-counts.ts), 'ko' 정렬은 **TS 에 그대로** 둔다 —
--       영역 이름 상수(LITERARY_AREA·GRAMMAR_AREA_NAMES)를 SQL 에 거울로 두면 검수 화면과 트리가 갈라진다.
--    ⚠️ SECURITY INVOKER 라 RLS 가 그대로 걸린다(sql/65 로 행마다 평가되지 않게 해 두었다).
--
-- 2) 최근순 목록(queries.ts runProblemQuery 의 기본 정렬)과 올라간 기출 목록(source-list.ts)에 정렬 인덱스.
--    없으면 매 쪽 29,000행을 정렬하고, 출처 목록은 1,089출처 전부의 문항 수를 센 뒤 30행을 자른다.
--    (정렬만 쓰는 인덱스라 아래 3) 의 leakproof 제약을 받지 않는다 — 실측 91ms → 0.3ms, 출처 7ms → 0.9ms)
--
-- 3) 검색은 인덱스로 못 푼다 — **RLS 아래에서는 leakproof 가 아닌 연산자가 인덱스 조건이 될 수 없다**.
--    `LIKE`(textlike)·`ILIKE`·배열 `@>`(arraycontains)·`&&`(arrayoverlap) 가 전부 proleakproof=false 라,
--    authenticated 로 물으면 enable_seqscan=off 로도 인덱스 경로가 아예 안 생긴다(2026-10-11 실측).
--    pg_trgm GIN 을 시험 삼아 만들어 보니 postgres 롤로는 '사미인곡' 560ms → 6.8ms 였지만 앱으로는 그대로
--    순차 스캔이었다 → 만들지 않는다(쓰이지 않는 37MB 인덱스 + 공유 DB 확장만 남는다).
--    ⚠️ 같은 까닭으로 **기존 배열 GIN 인덱스(area_path·unit_path·work_titles·grammar_paths)도 앱 조회에는
--       안 쓰인다.** LEAKPROOF 지정은 superuser 권한이라 Supabase 에서 못 한다. 인덱스를 타게 하려면
--       도메인을 직접 확인하는 SECURITY DEFINER RPC 로 조회를 옮겨야 한다(지금은 표가 작아 순차 스캔으로 충분).
--    대신 앱이 ILIKE 를 LIKE 로 바꾼다 — search_text 는 트리거가 이미 소문자로 저장하므로(sql/17 §5)
--    결과가 같고, 한글에서 대소문자 접기가 빠져 4배 빠르다(2글자 '화자' 505ms → 128ms, 같은 4,979건).
--
-- 멱등: CREATE OR REPLACE / IF NOT EXISTS. 반환 모양을 바꿀 일이 생기면 DROP FUNCTION 먼저(sql/51 선례).
-- ⛳️ 되돌릴 때: DROP FUNCTION exam.archive_facets(); DROP INDEX exam.idx_problems_recent,
--    exam.idx_problem_sources_recent;
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problems') IS NULL OR to_regclass('exam.passages') IS NULL
     OR to_regclass('exam.problem_sources') IS NULL THEN
    RAISE EXCEPTION 'exam 문제 은행 표가 없습니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;
END
$guard$;

-- ---------------------------------------------
-- 1. 패싯 — 한 번의 왕복으로 아카이브 트리·선택지 재료 전부
-- ---------------------------------------------
-- 돌려주는 키 (facets-payload.ts 의 ArchiveFacetsPayload 와 1:1):
--   sources        출처 7칸의 서로 다른 조합 — uniq·collectSchoolExams·collectSchoolsByLevel 이 쓴다
--   area_paths     서로 다른 영역 경로
--   unit_paths     서로 다른 교과서 단원 경로
--   grammar_paths  문법 태그 묶음(배열 그대로)마다 문항 수 — 조상 펴기·중복 제거는 TS
--   work_titles    작품명 묶음(배열 그대로)마다 문항 수 — 낱개로 펴서 세는 것은 TS
--   passage_works  지문의 (제목, 지은이, 영역) 조합마다 지문 수 — 지은이 표·갈래 표는 TS
CREATE OR REPLACE FUNCTION exam.archive_facets()
RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER
  SET search_path = exam, pg_temp
AS $$
  SELECT jsonb_build_object(
    'sources', COALESCE((
      SELECT jsonb_agg(to_jsonb(s))
        FROM (SELECT DISTINCT school_name, year, grade, textbook, source_type, semester, exam_type
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
  );
$$;

COMMENT ON FUNCTION exam.archive_facets() IS
  '기출 아카이브 패싯(출처 조합·영역·단원·문법·작품 묶음 개수) — 앱 facets.ts 가 한 번에 읽는다. SECURITY INVOKER(RLS 적용)';

REVOKE ALL ON FUNCTION exam.archive_facets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.archive_facets() TO authenticated, service_role;

-- ---------------------------------------------
-- 2. 정렬 인덱스
-- ---------------------------------------------
-- 최근순 목록: ORDER BY created_at DESC, page_no, number NULLS LAST, id — 인덱스 순서 그대로 읽어 60행에서 멈춘다
-- ⚠️ queries.ts 의 기본 정렬과 열·방향이 같아야 쓰인다(바꾸면 둘 다)
CREATE INDEX IF NOT EXISTS idx_problems_recent
  ON exam.problems (created_at DESC, page_no, number, id);

-- 올라간 기출 기본 정렬(created_at DESC, id DESC): 정렬 없이 30행에서 멈춘다 → 문항 수 count 도 30번만 돈다
CREATE INDEX IF NOT EXISTS idx_problem_sources_recent
  ON exam.problem_sources (created_at DESC, id DESC);

ANALYZE exam.problems;
ANALYZE exam.problem_sources;

-- ---------------------------------------------
-- 검증 — 함수 속성·권한·결과 크기, 인덱스가 실제로 쓰이는가 (authenticated 롤로 흉내)
-- ---------------------------------------------
DO $verify$
DECLARE
  v_fn     RECORD;
  v_out    JSONB;
  v_plan   TEXT;
  v_line   RECORD;
  v_keys   TEXT;
BEGIN
  SELECT provolatile, prosecdef INTO v_fn FROM pg_proc WHERE oid = 'exam.archive_facets()'::regprocedure;
  IF v_fn.provolatile <> 's' OR v_fn.prosecdef THEN
    RAISE EXCEPTION 'sql/66: archive_facets 는 STABLE · SECURITY INVOKER 여야 한다 (vol=%, definer=%)',
      v_fn.provolatile, v_fn.prosecdef;
  END IF;
  IF NOT has_function_privilege('authenticated', 'exam.archive_facets()', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.archive_facets()', 'EXECUTE') THEN
    RAISE EXCEPTION 'sql/66: 실행 권한이 어긋났다 (authenticated 만 열려 있어야 한다)';
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);

    v_out := exam.archive_facets();
    SELECT string_agg(k || '=' || jsonb_array_length(v_out -> k), ', ' ORDER BY k) INTO v_keys
      FROM unnest(ARRAY['sources', 'area_paths', 'unit_paths', 'grammar_paths', 'work_titles', 'passage_works']) AS k;
    IF (SELECT count(*) FROM jsonb_object_keys(v_out)) <> 6 THEN
      RAISE EXCEPTION 'sql/66: 키가 6개가 아니다: %', v_keys;
    END IF;
    IF jsonb_array_length(v_out -> 'work_titles') = 0 AND EXISTS (SELECT 1 FROM exam.problems WHERE work_titles <> '{}') THEN
      RAISE EXCEPTION 'sql/66: 작품이 있는데 work_titles 가 비었다(RLS?)';
    END IF;

    -- 바깥 도메인은 빈 패싯
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@gmail.com'
    )::text, true);
    IF jsonb_array_length(exam.archive_facets() -> 'work_titles') <> 0
       OR jsonb_array_length(exam.archive_facets() -> 'sources') <> 0 THEN
      RAISE EXCEPTION 'sql/66: 바깥 도메인에게 패싯이 보인다';
    END IF;

    -- 정렬 인덱스를 **쓸 수 있는가** — 비용으로 고른 계획을 보면 빈·작은 표에서는 순차 스캔이 맞는
    -- 선택이라 멀쩡한 마이그레이션이 실패한다(코덱스 1R). 순차 스캔·정렬을 끄고도 인덱스로 가는지 본다
    -- (이 하위 트랜잭션과 함께 되돌아간다)
    PERFORM set_config('enable_seqscan', 'off', true);
    PERFORM set_config('enable_sort', 'off', true);
    v_plan := '';
    FOR v_line IN EXECUTE 'EXPLAIN SELECT id FROM exam.problems ORDER BY created_at DESC, page_no, number NULLS LAST, id LIMIT 60' LOOP
      v_plan := v_plan || v_line."QUERY PLAN" || E'\n';
    END LOOP;
    IF v_plan NOT LIKE '%idx_problems_recent%' THEN
      RAISE EXCEPTION 'sql/66: 최근순 정렬이 인덱스를 쓸 수 없다: %', v_plan;
    END IF;
    v_plan := '';
    FOR v_line IN EXECUTE 'EXPLAIN SELECT id FROM exam.problem_sources ORDER BY created_at DESC, id DESC LIMIT 30' LOOP
      v_plan := v_plan || v_line."QUERY PLAN" || E'\n';
    END LOOP;
    IF v_plan NOT LIKE '%idx_problem_sources_recent%' THEN
      RAISE EXCEPTION 'sql/66: 출처 목록 정렬이 인덱스를 쓸 수 없다: %', v_plan;
    END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
  END;
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/66: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;

  RAISE NOTICE 'sql/66 검증: archive_facets STABLE·INVOKER·authenticated 전용, 결과 %; 바깥 도메인 빈 패싯; 최근순·출처 정렬 인덱스 사용 가능',
    v_keys;
END
$verify$;
