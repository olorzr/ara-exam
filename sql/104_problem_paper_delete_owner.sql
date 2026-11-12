-- =============================================
-- 104. 문제지 지우기는 만든 선생님과 원장만
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/104_problem_paper_delete_owner.sql
-- =============================================
-- 배경 (2026-11-13 원장님 "지우기도 다른 선생님 껀 못 하게 해, 원장이랑 본인만 가능하게 해")
--   0.9.84(sql/103)에서 **고치기**는 만든 선생님 + 원장으로 좁혔는데 **지우기**는 학원 공유(sql/17·65 의 도메인
--   조건)로 남아 있었다. DELETE 정책 하나를 '만든 사람(user_id = auth.uid()) 또는 원장 JWT 이메일' 로 바꾼다.
--   · 책에 담긴 문제지는 여전히 **아무도** 못 지운다(sql/76 RESTRICT) — 원장도 책에서 먼저 뺀다. 고치기의 '책이면 원장만'
--     과 다른 까닭: 지우기는 책의 장을 없애므로 원장에게도 막는 것이 이미 규칙이다.
--   · 항목 · 반영 대기 표시 · 표지는 CASCADE 로 함께 지워진다(참조 동작은 RLS 를 안 탄다).
--   · 원장 판정은 **리터럴**이다(sql/57·76·84 와 같다). exam.is_owner_email() 은 sql/103 이 브라우저에서 거둬서
--     정책에서 부르면 선생님 요청이 권한 오류로 죽는다(정책 식은 부르는 사람 권한으로 돈다).
--   · 꼴은 sql/65 규약 — 호출을 (select …) 로 감싸 문장마다 한 번 평가한다.
--
-- ⚠️ 원장 이메일 리터럴 자리가 하나 는다 — src/lib/constants.ts ADMIN_EMAIL JSDoc · paper-edit-policy.test.ts 가 대조한다.
-- ⚠️ 이 정책의 **정식 정의는 이제 이 파일**이다. sql/17·65 는 이것이 적용된 DB 에서 옛 '도메인 전원' 삭제 정책을
--    만들지 않는다 — 정책은 OR 로 합쳐져 옛것이 하나라도 남으면 다시 전원에게 열린다.
--
-- ⛳️ 되돌릴 때: 아래 정책을 지우고 sql/65 의 옛 정의("Authenticated users can delete problem_papers")를 다시 만든다.
--
-- 멱등: DROP POLICY IF EXISTS + CREATE. run-sql.js 는 파일 전체를 한 트랜잭션으로 보내
--   아래 검증이 실패하면 정책 교체까지 통째로 되돌아간다(정책 없는 창이 생기지 않는다).
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problem_papers') IS NULL OR to_regclass('exam.book_chapters') IS NULL
     OR to_regprocedure('exam.is_allowed_domain()') IS NULL THEN
    RAISE EXCEPTION
      'exam.problem_papers · exam.book_chapters · exam.is_allowed_domain() 이 있어야 합니다 (현재 DB: %). '
      'ara-system 과 공유하는 프로젝트에서 실행하세요.', current_database();
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "Authenticated users can delete problem_papers" ON exam.problem_papers;
DROP POLICY IF EXISTS "Owner or director can delete problem_papers" ON exam.problem_papers;
-- ⚠️ 리터럴은 src/lib/constants.ts ADMIN_EMAIL 과 같아야 한다
CREATE POLICY "Owner or director can delete problem_papers" ON exam.problem_papers
  FOR DELETE USING (
    (select auth.role()) = 'authenticated'
    AND (select exam.is_allowed_domain())
    AND (
      user_id = (select auth.uid())
      OR (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
    )
  );

-- ---------------------------------------------
-- 검증 ① 정책 모양 — 문제지 표의 정책은 읽기 하나 + 지우기 하나뿐(INSERT·UPDATE 는 RPC 만, sql/17)
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_list TEXT;
  v_qual TEXT;
BEGIN
  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY cmd, policyname) INTO v_list
    FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'problem_papers';
  IF v_list IS DISTINCT FROM
     'Owner or director can delete problem_papers:DELETE, Authenticated users can read problem_papers:SELECT' THEN
    RAISE EXCEPTION 'sql/104: problem_papers 정책이 읽기 하나 + 지우기 하나여야 하는데: %', v_list;
  END IF;

  SELECT qual INTO v_qual FROM pg_policies
   WHERE schemaname = 'exam' AND tablename = 'problem_papers' AND cmd = 'DELETE';
  IF v_qual NOT LIKE '%user_id = ( SELECT auth.uid()%' OR v_qual NOT LIKE '%ara0723@araeducation.co.kr%' THEN
    RAISE EXCEPTION 'sql/104: 지우기 정책에 작성자·원장 조건이 없다: %', v_qual;
  END IF;

  RAISE NOTICE 'sql/104 정책: %', v_list;
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 ② 실제로 막히는가 — JWT 를 흉내 내 지워 본다(전부 되돌린다)
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 역할을 바꿔서 잰다(sql/57 과 같은 방법).
-- 책에 담기지 않은 문제지 하나로: 다른 선생님 0행 · 만든 사람인데 바깥 도메인 0행 · 만든 사람 1행 · 원장 1행.
DO $verify_probe$
DECLARE
  v_paper UUID;
  v_owner UUID;
  v_n     INT;
BEGIN
  SELECT p.id, p.user_id INTO v_paper, v_owner
    FROM exam.problem_papers p
   WHERE NOT EXISTS (SELECT 1 FROM exam.book_chapters c WHERE c.paper_id = p.id)
   ORDER BY p.created_at LIMIT 1;
  IF v_paper IS NULL THEN
    RAISE NOTICE 'sql/104: 책에 안 담긴 문제지가 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';

    -- 다른 선생님: 읽기는 되고 지우기는 0행
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    SELECT count(*) INTO v_n FROM exam.problem_papers WHERE id = v_paper;
    IF v_n <> 1 THEN RAISE EXCEPTION '다른 선생님이 문제지를 못 읽는다 (%행)', v_n; END IF;
    DELETE FROM exam.problem_papers WHERE id = v_paper;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '다른 선생님이 남의 문제지를 지울 수 있다 (%행)', v_n; END IF;

    -- 만든 사람이어도 학원 도메인이 아니면 0행
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_owner::text, 'role', 'authenticated', 'email', 'verify@example.com'
    )::text, true);
    DELETE FROM exam.problem_papers WHERE id = v_paper;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '바깥 도메인이 문제지를 지울 수 있다 (%행)', v_n; END IF;

    -- 만든 사람: 1행(하위 트랜잭션째 되돌려 원장 차례에도 그 문제지가 남게)
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', v_owner::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
      )::text, true);
      DELETE FROM exam.problem_papers WHERE id = v_paper;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n <> 1 THEN RAISE EXCEPTION '만든 선생님이 제 문제지를 못 지운다 (%행)', v_n; END IF;
      RAISE EXCEPTION 'sql104_rollback_owner';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'sql104_rollback_owner' THEN RAISE; END IF;
    END;

    -- 원장: 남의 문제지도 1행
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr'
    )::text, true);
    DELETE FROM exam.problem_papers WHERE id = v_paper;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION '원장이 남의 문제지를 못 지운다 (%행)', v_n; END IF;

    RAISE EXCEPTION 'sql104_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'sql104_rollback' THEN RAISE; END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/104: 검증 뒤 역할이 돌아오지 않았다 (%)', current_user;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM exam.problem_papers WHERE id = v_paper) THEN
    RAISE EXCEPTION 'sql/104: 검증용 문제지가 되돌아오지 않았다';
  END IF;
  RAISE NOTICE 'sql/104 실제 검증 통과 — 다른 선생님 0 · 바깥 도메인 0 · 만든 사람 1 · 원장 1 (전부 되돌림)';
END
$verify_probe$;

NOTIFY pgrst, 'reload schema';
