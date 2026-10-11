-- =============================================
-- 65. 문제 은행 RLS 정책을 '문장마다 한 번' 평가되는 꼴로 — (select …) 로 감싸기
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/65_exam_rls_initplan.sql
-- =============================================
-- 배경 (2026-10-11 "문제가 많아져서 작품 목록이나 그런 게 너무 느리다")
--   정책 술어 `auth.role() = 'authenticated' AND exam.is_allowed_domain()` 가 함수 호출 그대로라
--   Postgres 가 **행마다** 부른다 — 둘 다 request.jwt.claims(JSON 문자열)를 파싱하므로 문항 29,000행을
--   훑는 조회는 JWT 를 29,000번 읽는다. `(select …)` 로 감싸면 플래너가 InitPlan 으로 한 번만 계산해
--   그 값을 쓴다(Supabase 권고). 운영 실측(authenticated 롤로 흉내, 적용 전 → 후):
--     작품 집계 unnest(work_titles) GROUP BY   172ms → 84ms   (postgres 롤 62ms)
--     문항 1,000행 한 쪽(ORDER BY id OFFSET)   119ms → 39ms
--     최근순 60행                              91ms → 37ms
--     전체 개수(count exact)                   63ms → 17ms
--
-- 범위: 문제 은행·프린트·작품 전문·문제지 표 12개·정책 16개(이 저장소 sql/17·26·30·46·47·51·57·61 이 만든 정책).
--   ⚠️ 술어는 **글자 그대로 같다** — 호출을 감쌀 뿐 의미는 하나도 안 바뀐다.
--   범위 밖(아래 검증이 NOTICE 로 남은 것만 알린다):
--     · sql/01~14 시대 표(categories·words·exams·exam_words·concept_sheets·publishers·major_chapters·
--       sub_chapters·schools·school_materials) — 운영 정의를 ara-system mig254 가 소유한다
--     · storage.objects 정책(sql/17 §버킷), exam.audit_log 읽기 정책(sql/03)
--
-- ⚠️ 앞으로 exam 스키마에 정책을 새로 만들 때도 **이 꼴**로 쓴다(CLAUDE.md 2026-10-11 항목).
--
-- ⛳️ 되돌릴 때: 같은 이름으로 감싸지 않은 식을 다시 CREATE 하면 된다(sql/17·57 의 원래 정의).
--
-- ⚠️ 정책 교체는 표마다 배타 잠금을 잡는다 — 적재 스크립트가 돌 때 다시 돌리면 교착(deadlock)으로
--    통째로 되돌아갈 수 있다(2026-10-11 실제로 한 번). 상태는 그대로이니 적재가 끝난 뒤 다시 돌리면 된다.
--
-- 멱등: DROP POLICY IF EXISTS + CREATE. run-sql.js 는 파일 전체를 한 트랜잭션으로 보내
--   아래 검증이 실패하면 정책 교체까지 통째로 되돌아간다(정책 없는 창이 생기지 않는다).
-- =============================================

DO $guard$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(t, ', ') INTO v_missing
    FROM unnest(ARRAY[
      'exam.problems', 'exam.passages', 'exam.problem_sources', 'exam.problem_papers',
      'exam.problem_paper_items', 'exam.print_scans', 'exam.print_bundles', 'exam.reference_texts',
      'exam.problem_paper_covers', 'exam.work_title_canon', 'exam.work_title_alias',
      'exam.work_title_distinct'
    ]) AS t
   WHERE to_regclass(t) IS NULL;
  IF v_missing IS NOT NULL OR to_regprocedure('exam.is_allowed_domain()') IS NULL THEN
    RAISE EXCEPTION
      '표·함수가 없습니다 (%; is_allowed_domain=%) — 현재 DB: %. ara-system 과 공유하는 프로젝트에서 실행하세요.',
      v_missing, to_regprocedure('exam.is_allowed_domain()'), current_database();
  END IF;
END
$guard$;

-- ---------------------------------------------
-- 1. 아카이브 3표 (sql/17 · sql/57)
-- ---------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage problems" ON exam.problems;
CREATE POLICY "Authenticated users can manage problems" ON exam.problems
  USING      ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()))
  WITH CHECK ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can manage passages" ON exam.passages;
CREATE POLICY "Authenticated users can manage passages" ON exam.passages
  USING      ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()))
  WITH CHECK ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can read problem_sources" ON exam.problem_sources;
CREATE POLICY "Authenticated users can read problem_sources" ON exam.problem_sources
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can insert problem_sources" ON exam.problem_sources;
CREATE POLICY "Authenticated users can insert problem_sources" ON exam.problem_sources
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can update problem_sources" ON exam.problem_sources;
CREATE POLICY "Authenticated users can update problem_sources" ON exam.problem_sources
  FOR UPDATE
  USING      ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()))
  WITH CHECK ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

-- ⚠️ 리터럴은 src/lib/constants.ts ADMIN_EMAIL · sql/03 audit_log 정책 · sql/57 과 같아야 한다
DROP POLICY IF EXISTS "Admin can delete problem_sources" ON exam.problem_sources;
CREATE POLICY "Admin can delete problem_sources" ON exam.problem_sources
  FOR DELETE
  USING (
    (select auth.role()) = 'authenticated'
    AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  );

-- ---------------------------------------------
-- 2. 문제지 (sql/17 — 읽기·삭제만, 생성은 RPC)
-- ---------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read problem_papers" ON exam.problem_papers;
CREATE POLICY "Authenticated users can read problem_papers" ON exam.problem_papers
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can delete problem_papers" ON exam.problem_papers;
CREATE POLICY "Authenticated users can delete problem_papers" ON exam.problem_papers
  FOR DELETE USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can read problem_paper_items" ON exam.problem_paper_items;
CREATE POLICY "Authenticated users can read problem_paper_items" ON exam.problem_paper_items
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can manage problem_paper_covers" ON exam.problem_paper_covers;
CREATE POLICY "Authenticated users can manage problem_paper_covers" ON exam.problem_paper_covers
  USING      ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()))
  WITH CHECK ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

-- ---------------------------------------------
-- 3. 프린트·작품 전문 (sql/26 · sql/30)
-- ---------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage print_scans" ON exam.print_scans;
CREATE POLICY "Authenticated users can manage print_scans" ON exam.print_scans
  USING      ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()))
  WITH CHECK ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can manage print_bundles" ON exam.print_bundles;
CREATE POLICY "Authenticated users can manage print_bundles" ON exam.print_bundles
  USING      ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()))
  WITH CHECK ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can manage reference_texts" ON exam.reference_texts;
CREATE POLICY "Authenticated users can manage reference_texts" ON exam.reference_texts
  USING      ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()))
  WITH CHECK ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

-- ---------------------------------------------
-- 4. 작품명 대장 (sql/46 · 47 · 51 — 읽기 전용, TO authenticated 그대로)
-- ---------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read work_title_canon" ON exam.work_title_canon;
CREATE POLICY "Authenticated users can read work_title_canon" ON exam.work_title_canon
  FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can read work_title_alias" ON exam.work_title_alias;
CREATE POLICY "Authenticated users can read work_title_alias" ON exam.work_title_alias
  FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

DROP POLICY IF EXISTS "Authenticated users can read work_title_distinct" ON exam.work_title_distinct;
CREATE POLICY "Authenticated users can read work_title_distinct" ON exam.work_title_distinct
  FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

-- ---------------------------------------------
-- 검증 ① 정책 모양 — 이 파일이 맡은 표에는 감싸지 않은 호출이 하나도 없어야 한다
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_tables CONSTANT TEXT[] := ARRAY[
    'problems', 'passages', 'problem_sources', 'problem_papers', 'problem_paper_items',
    'problem_paper_covers', 'print_scans', 'print_bundles', 'reference_texts',
    'work_title_canon', 'work_title_alias', 'work_title_distinct'];
  v_bad   TEXT;
  v_left  TEXT;
  v_count INT;
  v_all   INT;
BEGIN
  -- 감싼 호출(`SELECT auth.role()` · `SELECT exam.is_allowed_domain()` · `SELECT (auth.jwt() …`)을 지우고
  -- 남은 글에 함수 호출이 있으면 그 정책은 아직 행마다 평가된다
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'exam' AND tablename = ANY (v_tables)
     AND regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
           'SELECT \(?(auth\.(role|jwt)\(\)|exam\.is_allowed_domain\(\))', '', 'g')
         ~ '(auth\.(role|jwt)\(\)|is_allowed_domain\(\))';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'sql/65: 아직 감싸지 않은 정책이 있다: %', v_bad;
  END IF;

  -- 정책 수가 그대로인가(DROP 만 되고 CREATE 가 빠진 정책이 없게)
  SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'exam' AND tablename = ANY (v_tables);
  IF v_count <> 16 THEN
    RAISE EXCEPTION 'sql/65: 정책이 16개여야 하는데 %개', v_count;
  END IF;

  -- sql/57 불변식: problem_sources 는 4개, ALL 없음, DELETE 는 원장 이메일
  SELECT count(*), count(*) FILTER (WHERE cmd = 'ALL') INTO v_count, v_all
    FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'problem_sources';
  IF v_count <> 4 OR v_all <> 0 THEN
    RAISE EXCEPTION 'sql/65: problem_sources 정책이 4개(ALL 0개)여야 하는데 %개(ALL %개)', v_count, v_all;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'exam' AND tablename = 'problem_sources'
                    AND cmd = 'DELETE' AND qual LIKE '%ara0723@araeducation.co.kr%') THEN
    RAISE EXCEPTION 'sql/65: DELETE 정책에 원장 이메일 조건이 없다';
  END IF;

  -- 이 파일이 맡지 않은 exam 정책 중 아직 감싸지 않은 것 — 알리기만 한다(ara-system 소유)
  SELECT string_agg(DISTINCT tablename, ', ') INTO v_left
    FROM pg_policies
   WHERE schemaname = 'exam' AND NOT (tablename = ANY (v_tables))
     AND regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
           'SELECT \(?(auth\.(role|jwt)\(\)|exam\.is_allowed_domain\(\))', '', 'g')
         ~ '(auth\.(role|jwt)\(\)|is_allowed_domain\(\))';
  RAISE NOTICE 'sql/65 정책 모양 확인: 16개 전부 (select …) 꼴. 범위 밖 감싸지 않은 표: %', coalesce(v_left, '(없음)');
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 ② 의미가 그대로인가 — JWT 를 흉내 내 실제로 읽고 막히는지 (되돌리는 하위 트랜잭션)
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 역할을 바꿔서 잰다(sql/57 과 같은 방법).
DO $verify_probe$
DECLARE
  v_source   UUID;
  v_n        INT;
  v_denied   BOOLEAN;
  -- 소유자(postgres, RLS 지나침)가 보는 개수 — 선생님 JWT 로도 **똑같이** 보여야 한다.
  -- '1행 이상' 으로 재면 문항을 다 지운 출처나 빈 대장에서 멀쩡한 정책이 실패로 잡힌다(코덱스 1R)
  v_problems INT;
  v_passages INT;
  v_canon    INT;
BEGIN
  SELECT id INTO v_source FROM exam.problem_sources ORDER BY created_at LIMIT 1;
  IF v_source IS NULL THEN
    RAISE NOTICE 'sql/65: 출처가 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;
  SELECT count(*) INTO v_problems FROM exam.problems WHERE source_id = v_source;
  SELECT count(*) INTO v_passages FROM exam.passages WHERE source_id = v_source;
  SELECT count(*) INTO v_canon FROM exam.work_title_canon;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';

    -- ① 학원 선생님: 소유자가 보는 만큼 그대로 읽힌다
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    SELECT count(*) INTO v_n FROM exam.problems WHERE source_id = v_source;
    IF v_n <> v_problems THEN RAISE EXCEPTION '선생님이 문항을 %행만 읽는다(소유자 %행)', v_n, v_problems; END IF;
    SELECT count(*) INTO v_n FROM exam.passages WHERE source_id = v_source;
    IF v_n <> v_passages THEN RAISE EXCEPTION '선생님이 지문을 %행만 읽는다(소유자 %행)', v_n, v_passages; END IF;
    SELECT count(*) INTO v_n FROM exam.problem_sources WHERE id = v_source;
    IF v_n <> 1 THEN RAISE EXCEPTION '선생님이 출처를 못 읽는다 (%행)', v_n; END IF;
    SELECT count(*) INTO v_n FROM exam.work_title_canon;
    IF v_n <> v_canon THEN RAISE EXCEPTION '선생님이 작품명 대장을 %행만 읽는다(소유자 %행)', v_n, v_canon; END IF;

    UPDATE exam.problem_sources SET notes = notes WHERE id = v_source;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION '선생님이 출처를 못 고친다 (%행)', v_n; END IF;

    DELETE FROM exam.problem_sources WHERE id = v_source;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '선생님이 출처를 지울 수 있다 (%행)', v_n; END IF;

    -- ② 바깥 도메인: 하나도 안 보이고, 올리기는 거절된다
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@gmail.com'
    )::text, true);
    SELECT (SELECT count(*) FROM exam.problems) + (SELECT count(*) FROM exam.passages)
         + (SELECT count(*) FROM exam.problem_sources) + (SELECT count(*) FROM exam.print_bundles)
         + (SELECT count(*) FROM exam.work_title_canon)
      INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION '바깥 도메인이 %행을 읽는다', v_n; END IF;

    v_denied := false;
    BEGIN
      INSERT INTO exam.problem_sources (source_type, title) VALUES ('문제집', 'sql/65 검증');
    EXCEPTION WHEN insufficient_privilege THEN
      v_denied := true;
    END;
    IF NOT v_denied THEN RAISE EXCEPTION '바깥 도메인이 출처를 올릴 수 있다'; END IF;

    -- ③ 익명 역할 표시(JWT role 이 authenticated 가 아님): 안 보인다
    PERFORM set_config('request.jwt.claims', json_build_object(
      'role', 'anon', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    SELECT count(*) INTO v_n FROM exam.problems;
    IF v_n <> 0 THEN RAISE EXCEPTION 'role=anon 이 문항 %행을 읽는다', v_n; END IF;

    -- ④ 원장: 출처 지우기 1행 (CASCADE·감사 트리거까지 — 아래에서 통째로 되돌린다)
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr'
    )::text, true);
    DELETE FROM exam.problem_sources WHERE id = v_source;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION '원장 이메일로도 출처를 못 지운다 (%행)', v_n; END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN
      RAISE;
    END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/65: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM exam.problem_sources WHERE id = v_source) THEN
    RAISE EXCEPTION 'sql/65: 검증용 삭제가 되돌아가지 않았다';
  END IF;

  RAISE NOTICE 'sql/65 검증: 선생님 읽기·고치기 ○ / 지우기 ✕, 바깥 도메인·anon 0행·올리기 거절, 원장 지우기 ○ (전부 되돌림)';
END
$verify_probe$;
