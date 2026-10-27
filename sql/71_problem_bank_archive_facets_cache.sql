-- =============================================
-- 71. 기출 아카이브 패싯 서버 캐시 — archive_facets() 는 캐시를 돌려주고, 쓰기는 트랜잭션 id 로그만 남긴다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/71_problem_bank_archive_facets_cache.sql
-- =============================================
-- ⚠️⚠️ [2026-10-28] exam.archive_facets_refresh() 의 정식 정의는 이제 sql/82 다(평가문제집 출처 제목). 이 파일을 다시 돌리면 제목이 조용히 빠진다 —
--       다시 돌렸으면 sql/82 를 뒤이어 돌릴 것.
-- 배경 (2026-10-15 "여전히 작품 보기나 문법 보기를 하면 로딩이 너무 오래 걸려", 문항 30,191 · 지문 6,644 · 출처 1,131)
--   pg_stat_statements: exam.archive_facets() 9회 · 평균 5.3초 · 최대 7.1초. 문항 표(heap 86 MB = 11,028쪽)를 네 번,
--   지문 표(706쪽)를 한 번 훑는다. 이 인스턴스(shared_buffers 224 MB · work_mem 2 MB)는 최근 안 건드린 쪽을 첫 접근에
--   쪽당 0.3~0.5 ms 로 되읽어(OS 페이징 — pg_stat_io 의 디스크 읽기는 거의 0, "shared hit" 인데도) 전체 스캔 한 번이
--   3.5~4초다. 패싯은 새 탭·5분·쓰기 뒤마다 그것을 다시 셌다.
--   → 결과를 표 한 행에 두고, 패싯이 읽는 칸을 바꾼 **트랜잭션**만 로그에 남겨 신선함을 판정한다.
--
-- 왜 dirty 불리언·버전 카운터가 아니라 트랜잭션 id 로그인가
--   · `UPDATE cache SET dirty = true WHERE NOT dirty` — 리빌드 도중 커밋한 쓰기를 영영 놓친다(리빌드가 든 false 는
--     커밋 전이라 쓰기 쪽 WHERE 가 옛 true 를 보고 no-op, 리빌드가 false 를 커밋하면 그 쓰기는 다음 쓰기까지 안 보인다).
--   · 조건 없는 `UPDATE … version + 1` — 쓰기마다 한 행 잠금을 **트랜잭션 끝까지** 들어, 적재(수 초)에 다른 선생님 저장이 줄을 선다.
--   · 로그 INSERT 는 서로 막지 않고 쓴 트랜잭션과 함께 되돌아간다. 신선함 = "캐시를 지은 스냅샷에 안 보이는 xid 가 로그에 없다"
--     (pg_visible_in_snapshot). 빌드 뒤 커밋했거나 빌드 때 진행 중이던 트랜잭션은 정의상 안 보인다 → 다시 짓는다.
--   ⚠️ 같은 트랜잭션 안에서 쓰고 바로 읽으면 자기 xid 가 자기 스냅샷에 '보여' 신선으로 판정한다 — 앱에 그런 흐름은 없다
--     (쓰기는 커밋되고 다음 요청이 읽는다). 아래 검증도 그래서 합성 xid(스냅샷의 xmax)로 '다시 짓는가' 를 본다.
--
-- ⚠️ exam.archive_facets() 의 정식 정의는 이제 이 파일이다(sql/66 → 71). VOLATILE · SECURITY DEFINER 로 바뀌었다:
--   · DEFINER — 소유자(postgres)로 돌아 RLS 없이 캐시 표를 읽고 쓴다. 그래서 첫 줄에서 호출자를 직접 본다
--     (exam.archive_caller_allowed — create_problem_paper 와 같은 꼴). 바깥 도메인은 예전처럼 빈 패싯이 아니라
--     insufficient_privilege 다 — 데이터를 들고 있는 함수가 거절하는 것이 맞다.
--   · VOLATILE — 캐시를 다시 지을 때 INSERT/UPDATE 한다. ⚠️ PostgREST 는 GET /rpc 를 읽기 전용 트랜잭션으로 돌리므로
--     앱은 POST 로 부른다(postgrest-js .rpc() 기본값, facets.test.ts 가 고정).
--   · 출력 jsonb 는 sql/66 과 글자 하나까지 같다(facets-payload.ts 무변경) — jsonb_build_object 본문을 그대로 옮겼다.
--   · 적재 스크립트(~/.claude/tools/ingest-exam.js, postgres 직결) 뒤에는 `SELECT exam.archive_facets_refresh();`
--     한 줄을 붙이면 첫 선생님이 cold 리빌드(최대 5초)를 내지 않는다. ⚠️ DISABLE TRIGGER ALL/USER 로 돌린 백필은
--     로그가 안 남아 그 호출이 옛 캐시를 그대로 돌려준다 — **`SELECT exam.archive_facets_refresh(true);`**(강제)로 끝낼 것
--     (코덱스 1R).
--   · 쓰기 표시는 두 가지다(코덱스 1R): INSERT·DELETE·TRUNCATE 는 **문장 단위**(적재 27,000행도 트랜잭션당 한 행),
--     UPDATE 는 **행 단위 AFTER + WHEN(OLD 와 NEW 의 패싯 칸이 다를 때)**. `UPDATE OF 칸` 은 SET 목록만 봐서, 지문의
--     `author` 만 고치면 BEFORE 트리거(aa_works_b_string_passages)가 `works` 를 다시 쓰는데도 발화하지 않았다
--     (문항 `work_title` → `work_titles`, 표기 대장 aa_works_c_canon_* 도 같은 꼴). AFTER 행 트리거의 NEW 는 BEFORE
--     트리거가 끝낸 **최종 값**이라 어느 길로 바뀌어도 잡히고, 값이 같은 저장(검수 화면의 통째 저장)은 표시하지 않는다.
--     WHEN 의 칸 목록은 패싯이 읽는 칸과 1:1 이다 — 패싯이 읽는 칸을 더하면 여기도 함께.
--
-- 멱등: CREATE OR REPLACE / IF NOT EXISTS / DROP TRIGGER IF EXISTS.
-- ⛳️ 되돌릴 때: sql/66 의 archive_facets() 정의를 다시 적용(INVOKER·STABLE)하고
--   DROP TRIGGER archive_facets_dirty_problems ON exam.problems; DROP TRIGGER archive_facets_dirty_problems_upd ON exam.problems;
--   (passages·problem_sources 도 같은 이름 꼴 — _passages[_upd], _sources[_upd])
--   DROP FUNCTION exam.archive_facets_mark_dirty(), exam.archive_facets_refresh(boolean), exam.archive_caller_allowed();
--   DROP TABLE exam.archive_facets_cache, exam.archive_facets_dirty;
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problems') IS NULL OR to_regclass('exam.passages') IS NULL
     OR to_regclass('exam.problem_sources') IS NULL THEN
    RAISE EXCEPTION 'exam 문제 은행 표가 없습니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;
  IF to_regprocedure('exam.archive_facets()') IS NULL THEN
    RAISE EXCEPTION 'sql/71: exam.archive_facets() 가 없다 — sql/66 을 먼저 적용할 것';
  END IF;
  IF to_regprocedure('exam.is_allowed_domain()') IS NULL THEN
    RAISE EXCEPTION 'sql/71: exam.is_allowed_domain() 이 없다 (ara-system mig254 가 만든다)';
  END IF;
  RAISE NOTICE 'sql/71 대상 DB=% 롤=%', current_database(), current_user;
END
$guard$;

-- ---------------------------------------------
-- 1. 캐시 표 둘 — 선생님 계정은 손대지 못한다(정책 없는 RLS). 소유자 함수와 service_role 만.
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.archive_facets_cache (
  id             SMALLINT PRIMARY KEY CHECK (id = 1),
  payload        JSONB NOT NULL,
  built_at       TIMESTAMPTZ NOT NULL,
  built_snapshot PG_SNAPSHOT NOT NULL
);
COMMENT ON TABLE exam.archive_facets_cache IS
  '기출 아카이브 패싯(archive_facets 의 jsonb) 캐시 한 행. built_snapshot 과 archive_facets_dirty 로 신선함을 판정한다(sql/71)';

CREATE TABLE IF NOT EXISTS exam.archive_facets_dirty (
  xid XID8 PRIMARY KEY,
  at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
COMMENT ON TABLE exam.archive_facets_dirty IS
  '패싯이 읽는 칸을 바꾼 트랜잭션의 id. 문장 트리거가 남기고, 리빌드가 자기 스냅샷에 보이는 것을 지운다(sql/71)';

ALTER TABLE exam.archive_facets_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.archive_facets_dirty ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exam.archive_facets_cache, exam.archive_facets_dirty FROM PUBLIC, anon, authenticated;
GRANT ALL ON exam.archive_facets_cache, exam.archive_facets_dirty TO service_role;

-- ---------------------------------------------
-- 2. 호출자 판정 — 선생님(authenticated + 학원 도메인) 또는 service_role(검증·운영 스크립트)
-- ---------------------------------------------
-- DEFINER 함수들이 첫 줄에서 부른다. RLS 정책의 술어와 같은 뜻이고(sql/65), service_role 은 RLS 도 지나치는 롤이라 함께 연다.
CREATE OR REPLACE FUNCTION exam.archive_caller_allowed()
RETURNS boolean
  LANGUAGE sql STABLE
  SET search_path = exam, pg_temp
AS $$
  SELECT auth.role() = 'service_role'
      OR (auth.role() = 'authenticated' AND exam.is_allowed_domain());
$$;
REVOKE ALL ON FUNCTION exam.archive_caller_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.archive_caller_allowed() TO authenticated, service_role;

-- ---------------------------------------------
-- 3. 쓰기 표시 — 문장마다 한 번, 트랜잭션마다 한 행
-- ---------------------------------------------
-- DEFINER 인 까닭: 선생님 계정은 로그 표에 INSERT 권한이 없다. RETURNS trigger 라 /rpc 로는 부를 수 없다.
CREATE OR REPLACE FUNCTION exam.archive_facets_mark_dirty()
RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
BEGIN
  INSERT INTO exam.archive_facets_dirty (xid) VALUES (pg_current_xact_id())
  ON CONFLICT (xid) DO NOTHING;
  RETURN NULL;
END;
$$;
-- 실행 권한은 선생님 계정에도 둔다 — 트리거로만 불리고(RETURNS trigger 는 /rpc 로 못 부른다), 권한을 막으면
-- 발화 때 확인하는 버전이 있을 경우 모든 쓰기가 실패한다. 아래 검증이 선생님 계정의 쓰기로 직접 확인한다.
REVOKE ALL ON FUNCTION exam.archive_facets_mark_dirty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.archive_facets_mark_dirty() TO authenticated, service_role;

-- INSERT·DELETE·TRUNCATE — 문장 단위. 문장 트리거는 행 트리거가 전부 돈 뒤에 돌고 다른 문장 트리거가 없어
-- `aa_` 접두(BEFORE ROW 차례용)가 필요 없다. 출처 CASCADE 삭제는 RI 가 실제 DELETE 문을 돌려 지문·문항 쪽도 걸린다.
DROP TRIGGER IF EXISTS archive_facets_dirty_problems ON exam.problems;
CREATE TRIGGER archive_facets_dirty_problems
  AFTER INSERT OR DELETE OR TRUNCATE ON exam.problems
  FOR EACH STATEMENT EXECUTE FUNCTION exam.archive_facets_mark_dirty();

DROP TRIGGER IF EXISTS archive_facets_dirty_passages ON exam.passages;
CREATE TRIGGER archive_facets_dirty_passages
  AFTER INSERT OR DELETE OR TRUNCATE ON exam.passages
  FOR EACH STATEMENT EXECUTE FUNCTION exam.archive_facets_mark_dirty();

DROP TRIGGER IF EXISTS archive_facets_dirty_sources ON exam.problem_sources;
CREATE TRIGGER archive_facets_dirty_sources
  AFTER INSERT OR DELETE OR TRUNCATE ON exam.problem_sources
  FOR EACH STATEMENT EXECUTE FUNCTION exam.archive_facets_mark_dirty();

-- UPDATE — 행 단위, **최종 값**이 달라진 행만(WHEN 은 줄 세울 때 평가돼 안 걸린 행은 대기열에도 안 오른다).
-- ⚠️ 칸 목록(UPDATE OF)을 두지 않는다 — BEFORE 트리거가 다시 쓰는 칸(works ← title/author, work_titles ← work_title,
--    표기 대장)은 SET 목록에 없어도 바뀐다(코덱스 1R).
DROP TRIGGER IF EXISTS archive_facets_dirty_problems_upd ON exam.problems;
CREATE TRIGGER archive_facets_dirty_problems_upd
  AFTER UPDATE ON exam.problems
  FOR EACH ROW
  WHEN (OLD.area_path     IS DISTINCT FROM NEW.area_path
     OR OLD.unit_path     IS DISTINCT FROM NEW.unit_path
     OR OLD.grammar_paths IS DISTINCT FROM NEW.grammar_paths
     OR OLD.work_titles   IS DISTINCT FROM NEW.work_titles)
  EXECUTE FUNCTION exam.archive_facets_mark_dirty();

DROP TRIGGER IF EXISTS archive_facets_dirty_passages_upd ON exam.passages;
CREATE TRIGGER archive_facets_dirty_passages_upd
  AFTER UPDATE ON exam.passages
  FOR EACH ROW
  WHEN (OLD.works     IS DISTINCT FROM NEW.works
     OR OLD.area_path IS DISTINCT FROM NEW.area_path)
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
     OR OLD.exam_type   IS DISTINCT FROM NEW.exam_type)
  EXECUTE FUNCTION exam.archive_facets_mark_dirty();

-- ---------------------------------------------
-- 4. 신선하면 캐시, 아니면 다시 짓기 — 호출자 검사 없음(소유자·service_role 전용)
-- ---------------------------------------------
-- 돌려주는 키 (facets-payload.ts 의 ArchiveFacetsPayload 와 1:1, sql/66 과 같다):
--   sources · area_paths · unit_paths · grammar_paths · work_titles · passage_works
-- ⚠️ SQL 은 DISTINCT·GROUP BY 개수만 한다 — 세는 규칙(문법 조상 펴기·문학/문법/비문학 표결·지은이 다수결)은 TS 그대로.
-- 같은 날 먼저 적용한 인자 없는 판을 걷는다(강제 리빌드 인자가 생겼다, 코덱스 1R)
DROP FUNCTION IF EXISTS exam.archive_facets_refresh();

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
  '아카이브 패싯을 신선하면 캐시에서, 아니면 다시 지어 돌려준다. true 면 무조건 다시 짓는다(트리거 끈 백필 뒤). 호출자 검사 없음 — 소유자·service_role 전용. sql/71';
REVOKE ALL ON FUNCTION exam.archive_facets_refresh(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION exam.archive_facets_refresh(boolean) TO service_role;

-- ---------------------------------------------
-- 5. 앱이 부르는 RPC — 호출자 검사 뒤 캐시
-- ---------------------------------------------
-- 인자·반환형이 sql/66 과 같아 CREATE OR REPLACE 로 바꾼다(언어·휘발성·보안 속성은 바꿀 수 있다).
CREATE OR REPLACE FUNCTION exam.archive_facets()
RETURNS jsonb
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
BEGIN
  IF NOT exam.archive_caller_allowed() THEN
    RAISE EXCEPTION '허용되지 않은 계정입니다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN exam.archive_facets_refresh();
END;
$$;
COMMENT ON FUNCTION exam.archive_facets() IS
  '기출 아카이브 패싯(출처 조합·영역·단원·문법·작품 묶음 개수) — 앱 facets.ts 가 POST 로 한 번에 읽는다. SECURITY DEFINER + 서버 캐시(sql/71), 정식 정의는 sql/71';
REVOKE ALL ON FUNCTION exam.archive_facets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.archive_facets() TO authenticated, service_role;

-- PostgREST 가 함수 휘발성·권한을 캐시한다 — 다시 읽게 한다(커밋 때 전달)
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 6. 미리 채운다 — 첫 선생님이 cold 리빌드를 내지 않게 (검증보다 먼저: 아래 빠른 길 검사가 이 행을 쓴다)
--    ⚠️ **강제**로 짓는다 — 다시 적용할 때는 트리거 설계가 바뀌었을 수 있어 그 사이 옛 트리거가 놓친 쓰기가 남는다
-- ---------------------------------------------
DO $warm$
DECLARE
  t0 TIMESTAMPTZ := clock_timestamp();
  v  JSONB;
BEGIN
  v := exam.archive_facets_refresh(true);
  RAISE NOTICE 'sql/71 미리 채움: % ms, payload % bytes, 키 %개',
    round(extract(epoch FROM clock_timestamp() - t0) * 1000), pg_column_size(v),
    (SELECT count(*) FROM jsonb_object_keys(v));
END
$warm$;

-- ---------------------------------------------
-- 검증 — 속성·권한·트리거·캐시↔표 대조·사이클·열 목록·도메인 (쓰는 부분은 하위 트랜잭션에서 되돌린다)
-- ---------------------------------------------
DO $verify$
DECLARE
  v_fn     RECORD;
  v_out    JSONB;
  v_groups BIGINT;
  v_n      INT;
  v_t1     TIMESTAMPTZ;
  v_t2     TIMESTAMPTZ;
  v_sid    UUID;
  v_pid    UUID;
  v_paid   UUID;
BEGIN
  -- 1) 세 함수 모두 VOLATILE · DEFINER · search_path 고정
  FOR v_fn IN
    SELECT p.oid::regprocedure AS f, p.provolatile, p.prosecdef,
           COALESCE(array_to_string(p.proconfig, ','), '') AS cfg
      FROM pg_proc p
     WHERE p.oid IN ('exam.archive_facets()'::regprocedure,
                     'exam.archive_facets_refresh(boolean)'::regprocedure,
                     'exam.archive_facets_mark_dirty()'::regprocedure)
  LOOP
    IF v_fn.provolatile <> 'v' OR NOT v_fn.prosecdef OR v_fn.cfg NOT LIKE '%search_path=exam, pg_temp%' THEN
      RAISE EXCEPTION 'sql/71: % 는 VOLATILE · SECURITY DEFINER · search_path=exam, pg_temp 여야 한다 (vol=%, definer=%, cfg=%)',
        v_fn.f, v_fn.provolatile, v_fn.prosecdef, v_fn.cfg;
    END IF;
  END LOOP;
  IF to_regprocedure('exam.archive_facets_refresh()') IS NOT NULL THEN
    RAISE EXCEPTION 'sql/71: 인자 없는 옛 archive_facets_refresh() 가 남아 있다';
  END IF;

  -- 2) 권한 — 선생님은 archive_facets 만, 캐시 표·refresh 는 못 본다
  IF NOT has_function_privilege('authenticated', 'exam.archive_facets()', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.archive_facets()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'exam.archive_facets_refresh(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.archive_facets_refresh(boolean)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'exam.archive_facets_cache', 'SELECT')
     OR has_table_privilege('authenticated', 'exam.archive_facets_dirty', 'SELECT') THEN
    RAISE EXCEPTION 'sql/71: 권한이 어긋났다 (authenticated 는 archive_facets 실행만, anon 은 0)';
  END IF;
  IF NOT (SELECT bool_and(relrowsecurity) FROM pg_class
           WHERE oid IN ('exam.archive_facets_cache'::regclass, 'exam.archive_facets_dirty'::regclass)) THEN
    RAISE EXCEPTION 'sql/71: 캐시 표에 RLS 가 꺼져 있다';
  END IF;

  -- 3) 트리거 여섯 — 문장 단위 셋(INSERT·DELETE·TRUNCATE, UPDATE 없음), 행 단위 셋(UPDATE + WHEN, 칸 목록 없음)
  SELECT count(*) INTO v_n
    FROM pg_trigger t
   WHERE t.tgname IN ('archive_facets_dirty_problems', 'archive_facets_dirty_passages', 'archive_facets_dirty_sources')
     AND NOT t.tgisinternal AND t.tgenabled = 'O'
     AND (t.tgtype & 1) = 0          -- 문장 단위
     AND (t.tgtype & 16) = 0         -- UPDATE 아님
     AND (t.tgtype & 4) <> 0 AND (t.tgtype & 8) <> 0 AND (t.tgtype & 32) <> 0;  -- INSERT·DELETE·TRUNCATE
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'sql/71: 넣기·지우기 표시 트리거가 3개가 아니다 (%)', v_n;
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_trigger t
   WHERE t.tgname IN ('archive_facets_dirty_problems_upd', 'archive_facets_dirty_passages_upd', 'archive_facets_dirty_sources_upd')
     AND NOT t.tgisinternal AND t.tgenabled = 'O'
     AND (t.tgtype & 1) <> 0         -- 행 단위
     AND (t.tgtype & 16) <> 0        -- UPDATE
     AND t.tgqual IS NOT NULL        -- WHEN 있음
     AND COALESCE(array_length(t.tgattr::int2[], 1), 0) = 0;  -- 칸 목록 없음(BEFORE 트리거가 다시 쓴 칸도 잡는다)
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'sql/71: 고치기 표시 트리거가 3개가 아니다 (%)', v_n;
  END IF;

  -- 4) 캐시 ↔ 표 대조 (소유자) — 키 6개, 작품 묶음 수가 GROUP BY 와 같다
  v_out := exam.archive_facets_refresh();
  IF (SELECT count(*) FROM jsonb_object_keys(v_out)) <> 6 THEN
    RAISE EXCEPTION 'sql/71: 키가 6개가 아니다: %', (SELECT string_agg(k, ',') FROM jsonb_object_keys(v_out) k);
  END IF;
  SELECT count(*) INTO v_groups
    FROM (SELECT work_titles FROM exam.problems WHERE work_titles <> '{}' GROUP BY work_titles) g;
  IF jsonb_array_length(v_out -> 'work_titles') <> v_groups THEN
    RAISE EXCEPTION 'sql/71: 캐시의 작품 묶음 %개 ≠ 표 %개', jsonb_array_length(v_out -> 'work_titles'), v_groups;
  END IF;

  BEGIN
    -- 5) 사이클: 더럽혀진 것이 없으면 그대로 / 안 보이는 xid 가 로그에 있으면 다시 짓는다 / 강제는 늘 다시 짓는다
    DELETE FROM exam.archive_facets_dirty;
    PERFORM exam.archive_facets_refresh();
    SELECT built_at INTO v_t1 FROM exam.archive_facets_cache WHERE id = 1;
    PERFORM exam.archive_facets_refresh();
    SELECT built_at INTO v_t2 FROM exam.archive_facets_cache WHERE id = 1;
    IF v_t2 <> v_t1 THEN
      RAISE EXCEPTION 'sql/71: 더럽혀진 것이 없는데 다시 지었다 (% → %)', v_t1, v_t2;
    END IF;
    PERFORM exam.archive_facets_refresh(true);
    SELECT built_at INTO v_t2 FROM exam.archive_facets_cache WHERE id = 1;
    IF v_t2 <= v_t1 THEN
      RAISE EXCEPTION 'sql/71: 강제(true)인데 다시 짓지 않았다 — 트리거 끈 백필을 따라잡을 길이 없다';
    END IF;
    v_t1 := v_t2;
    -- 지은 스냅샷의 xmax 는 그 스냅샷에 절대 보이지 않는 xid 다 → '빌드 뒤에 쓴 트랜잭션' 을 흉내 낸다
    INSERT INTO exam.archive_facets_dirty (xid)
      SELECT pg_snapshot_xmax(built_snapshot) FROM exam.archive_facets_cache WHERE id = 1;
    PERFORM exam.archive_facets_refresh();
    SELECT built_at INTO v_t2 FROM exam.archive_facets_cache WHERE id = 1;
    IF v_t2 <= v_t1 THEN
      RAISE EXCEPTION 'sql/71: 안 보이는 xid 가 로그에 있는데 다시 짓지 않았다';
    END IF;
    DELETE FROM exam.archive_facets_dirty;

    -- 6) 값이 같은 저장·패싯이 안 읽는 칸은 표시가 없다
    SELECT id INTO v_sid FROM exam.problem_sources LIMIT 1;
    SELECT id INTO v_pid FROM exam.problems LIMIT 1;
    IF v_sid IS NOT NULL THEN
      UPDATE exam.problem_sources SET title = title, school_name = school_name WHERE id = v_sid;
    END IF;
    IF v_pid IS NOT NULL THEN
      UPDATE exam.problems SET grammar_paths = grammar_paths, stem_html = stem_html WHERE id = v_pid;
    END IF;
    IF EXISTS (SELECT 1 FROM exam.archive_facets_dirty) THEN
      RAISE EXCEPTION 'sql/71: 값이 같은 저장(검수 화면의 통째 저장)이 표시를 남겼다';
    END IF;

    -- 7) 선생님 계정: 패싯을 받고, **그 계정의 쓰기**도 표시를 남긴다(트리거 함수 실행 권한·RLS 를 실제 경로로)
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    v_out := exam.archive_facets();
    IF (SELECT count(*) FROM jsonb_object_keys(v_out)) <> 6
       OR (jsonb_array_length(v_out -> 'work_titles') = 0 AND v_groups > 0) THEN
      RAISE EXCEPTION 'sql/71: 선생님 계정으로 패싯이 온전히 오지 않는다';
    END IF;
    IF v_pid IS NOT NULL THEN
      -- 실제로 값을 바꾼다(비었으면 하나 넣고, 있으면 비운다) — 하위 트랜잭션과 함께 되돌아간다
      UPDATE exam.problems
         SET grammar_paths = CASE WHEN grammar_paths = '{}' THEN ARRAY['검증 > 표시'] ELSE '{}'::text[] END
       WHERE id = v_pid;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n <> 1 THEN
        RAISE EXCEPTION 'sql/71: 선생님 계정으로 문항을 고치지 못했다(RLS?)';
      END IF;
    END IF;
    EXECUTE 'RESET ROLE';
    IF v_pid IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM exam.archive_facets_dirty WHERE xid = pg_current_xact_id()) THEN
      RAISE EXCEPTION 'sql/71: 선생님 계정이 문법 태그를 바꿨는데 표시가 없다';
    END IF;
    DELETE FROM exam.archive_facets_dirty;

    -- 8) 지은이만 고친 지문 — SET 목록에 works 가 없어도 BEFORE 트리거가 다시 쓴 works 로 표시가 남는다(코덱스 1R)
    SELECT id INTO v_paid FROM exam.passages
     WHERE jsonb_array_length(works) = 1 AND COALESCE(author, '') <> '' LIMIT 1;
    IF v_paid IS NOT NULL THEN
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
      )::text, true);
      UPDATE exam.passages SET author = author || '검증' WHERE id = v_paid;
      EXECUTE 'RESET ROLE';
      IF NOT EXISTS (SELECT 1 FROM exam.archive_facets_dirty WHERE xid = pg_current_xact_id()) THEN
        RAISE EXCEPTION 'sql/71: 지은이만 고친 지문이 표시를 남기지 않았다(works 를 BEFORE 트리거가 다시 썼는데)';
      END IF;
    ELSE
      RAISE NOTICE 'sql/71: 작품 하나·지은이 있는 지문이 없어 지은이 경로 검사를 건너뛴다';
    END IF;

    -- 9) 바깥 도메인은 거절(빈 패싯이 아니다)
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@gmail.com'
    )::text, true);
    BEGIN
      v_out := exam.archive_facets();
      RAISE EXCEPTION 'sql/71: 바깥 도메인에게 패싯이 보인다';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
  END;
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/71: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;

  RAISE NOTICE 'sql/71 검증: 함수 3개 VOLATILE·DEFINER, 권한·RLS, 트리거 6개(문장 3·행 3), 작품 묶음 %개 캐시=표, 캐시 적중·강제·합성 xid 리빌드, 같은 값 저장 무표시, 선생님 쓰기·지은이만 고친 지문 표시, 도메인 거절 통과',
    v_groups;
END
$verify$;
