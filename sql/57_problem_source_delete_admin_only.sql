-- =============================================
-- 57. 올라간 기출(problem_sources) 삭제는 원장만
-- =============================================
-- 배경 (2026-09-30 원장 요청 "문제 은행 올라간 기출에서 삭제할 수 있는 기능은 나 한 명뿐")
--   sql/17 의 정책은 FOR ALL 하나라 도메인 계정이면 누구나 출처를 통째로 지울 수 있었다
--   (지문·문항은 CASCADE 로 함께 사라진다). 그 정책을 SELECT/INSERT/UPDATE 와 DELETE 로
--   쪼개, DELETE 에만 원장 조건을 붙인다. 읽기·올리기·고치기는 예전 그대로 학원 공유다.
--
-- 범위 (사용자 결정): **출처 통째 삭제만** 막는다. 문항·지문 낱개 삭제와 지문 합치기
--   (exam.merge_passages) 는 passages·problems 정책을 타므로 그대로 선생님들도 쓴다.
--   앱 밖 적재 스크립트(~/.claude/tools/ingest-exam.js)는 postgres 직결이라 RLS 와 무관하다.
--
-- 판정 기준: **JWT 이메일 리터럴**
--   · 앱 화면 게이트가 `isAdminEmail`(src/lib/constants.ts 의 ADMIN_EMAIL)이라 화면과 DB 가
--     같은 기준이다. 같은 저장소 선례: exam.audit_log 읽기 정책(sql/03).
--   · ara-system 의 public.is_super_admin() 에 매달지 않는다 — 그 함수는 mig366 에서 이름이
--     is_director() 로 바뀌며 재정의됐고, 그때 그것을 쓰던 정책이 조용히 부원장까지 열렸다.
--     다른 저장소의 함수가 바뀌면 이 표의 권한이 이쪽 변경 없이 달라진다.
--   · ⚠️ 원장 계정 이메일이 바뀌면 세 곳을 함께: src/lib/constants.ts ADMIN_EMAIL · sql/03 · 이 파일.
--
-- ⛳️ 되돌릴 때: 아래 네 정책을 DROP 하고 sql/17 의 FOR ALL 정책 하나를 다시 만든다
--   (DROP POLICY … "Authenticated users can read/insert/update problem_sources",
--    "Admin can delete problem_sources" → CREATE POLICY "Authenticated users can manage problem_sources"
--    USING/WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain())).
--
-- 멱등: DROP POLICY IF EXISTS + CREATE. run-sql.js 는 파일 전체를 한 번에 보내 한 트랜잭션이라
--   아래 검증이 실패하면 정책 교체까지 통째로 되돌아간다(정책 없는 창이 생기지 않는다).
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problem_sources') IS NULL
     OR to_regprocedure('exam.is_allowed_domain()') IS NULL THEN
    RAISE EXCEPTION
      'exam.problem_sources 또는 exam.is_allowed_domain() 이 없습니다 (현재 DB: %). '
      'ara-system 과 공유하는 프로젝트에서 실행하세요.', current_database();
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "Authenticated users can manage problem_sources" ON exam.problem_sources;

DROP POLICY IF EXISTS "Authenticated users can read problem_sources" ON exam.problem_sources;
CREATE POLICY "Authenticated users can read problem_sources" ON exam.problem_sources
  FOR SELECT
  USING (auth.role() = 'authenticated' AND exam.is_allowed_domain());

DROP POLICY IF EXISTS "Authenticated users can insert problem_sources" ON exam.problem_sources;
CREATE POLICY "Authenticated users can insert problem_sources" ON exam.problem_sources
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

DROP POLICY IF EXISTS "Authenticated users can update problem_sources" ON exam.problem_sources;
CREATE POLICY "Authenticated users can update problem_sources" ON exam.problem_sources
  FOR UPDATE
  USING      (auth.role() = 'authenticated' AND exam.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

-- ⚠️ 리터럴은 src/lib/constants.ts ADMIN_EMAIL · sql/03 audit_log 정책과 같아야 한다
DROP POLICY IF EXISTS "Admin can delete problem_sources" ON exam.problem_sources;
CREATE POLICY "Admin can delete problem_sources" ON exam.problem_sources
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND exam.is_allowed_domain()
    AND (auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  );

-- ---------------------------------------------
-- 검증 ① 정책 모양
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_total INT;
  v_all   INT;
  v_list  TEXT;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE cmd = 'ALL'),
         string_agg(policyname || ':' || cmd, ', ' ORDER BY cmd)
    INTO v_total, v_all, v_list
    FROM pg_policies
   WHERE schemaname = 'exam' AND tablename = 'problem_sources';

  IF v_total <> 4 OR v_all <> 0 THEN
    RAISE EXCEPTION 'sql/57: problem_sources 정책이 4개(ALL 0개)여야 하는데 %개(ALL %개): %',
      v_total, v_all, v_list;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'exam' AND tablename = 'problem_sources'
       AND cmd = 'DELETE' AND qual LIKE '%ara0723@araeducation.co.kr%'
  ) THEN
    RAISE EXCEPTION 'sql/57: DELETE 정책에 원장 이메일 조건이 없다';
  END IF;

  RAISE NOTICE 'sql/57 정책: %', v_list;
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 ② 실제로 막히는가 — 다른 선생님 JWT 로 흉내 내 본다 (되돌리는 하위 트랜잭션)
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 역할을 바꿔서 잰다.
-- JWT 흉내는 verify_problem_paper_settings.sql 과 같은 set_config('request.jwt.claims', …, true).
DO $verify_probe$
DECLARE
  v_source UUID;
  v_n      INT;
BEGIN
  SELECT id INTO v_source FROM exam.problem_sources ORDER BY created_at LIMIT 1;
  IF v_source IS NULL THEN
    RAISE NOTICE 'sql/57: 출처가 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';

    -- 다른 선생님: 읽기·고치기·올리기는 되고, 지우기만 0행
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);

    SELECT count(*) INTO v_n FROM exam.problem_sources WHERE id = v_source;
    IF v_n <> 1 THEN RAISE EXCEPTION '다른 선생님이 출처를 못 읽는다 (%행)', v_n; END IF;

    UPDATE exam.problem_sources SET notes = notes WHERE id = v_source;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION '다른 선생님이 출처를 못 고친다 (%행)', v_n; END IF;

    INSERT INTO exam.problem_sources (source_type, title) VALUES ('문제집', 'sql/57 검증');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION '다른 선생님이 출처를 못 올린다 (%행)', v_n; END IF;

    DELETE FROM exam.problem_sources WHERE id = v_source;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '다른 선생님이 출처를 지울 수 있다 (%행)', v_n; END IF;

    -- 원장: 지우기 1행 (지문·문항 CASCADE·감사 트리거까지 — 아래에서 통째로 되돌린다)
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

  -- 하위 트랜잭션이 되돌아가며 역할·JWT 도 되돌아갔는지, 출처가 그대로인지
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/57: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM exam.problem_sources WHERE id = v_source) THEN
    RAISE EXCEPTION 'sql/57: 검증용 삭제가 되돌아가지 않았다';
  END IF;

  RAISE NOTICE 'sql/57 검증: 다른 선생님 읽기·고치기·올리기 1행 / 지우기 0행, 원장 지우기 1행 (전부 되돌림)';
END
$verify_probe$;
