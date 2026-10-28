-- =============================================
-- 84. 작품 전문 · 개념(reference_texts) 올리기·고치기·지우기는 원장만 — 읽기는 학원 선생님 모두
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/84_reference_texts_owner_writes.sql
-- =============================================
-- 배경 (2026-10-28 원장님 "전문 올리는 거나 개념 정리 올리는 건 나만 가능하게 해 주라")
--   sql/30 · 65 의 정책은 FOR ALL 하나라 도메인 계정이면 누구나 올리고 고치고 지울 수 있었다.
--   SELECT(도메인)와 INSERT · UPDATE · DELETE(원장 이메일)로 쪼갠다. 선생님은 계속 읽는다 —
--   목록 · 보기 화면과 문제 만들기(O,X·단답형)의 참고자료가 이 표를 읽는다.
--
-- 판정 기준: **JWT 이메일 리터럴**(sql/57 · 76 과 같은 판단 — ara-system 의 is_director() 에 매달지 않는다.
--   그 함수가 바뀌면 이 표의 권한이 이쪽 변경 없이 달라진다).
--   ⚠️ 원장 이메일 리터럴 자리: src/lib/constants.ts ADMIN_EMAIL · sql/03 · 57 · 65 · 76 · 84 — 바뀌면 함께.
--
-- ⚠️ reference_texts 정책의 **정식 정의는 이제 이 파일**이다. sql/30 을 단독으로 다시 돌리면 FOR ALL 이 되살아나
--   (정책은 OR 로 합쳐진다) 선생님 쓰기가 다시 열린다 — 그랬다면 이 파일을 다시 돌릴 것. sql/65 는 이 파일이
--   적용된 DB 에서 reference_texts 를 건너뛴다.
-- 적재 스크립트(~/.claude/tools/ingest-reference-texts.js)는 postgres 직결이라 RLS 와 무관하다.
--
-- ⛳️ 되돌릴 때: 아래 네 정책을 DROP 하고 sql/65 §3 의 FOR ALL 정책 하나를 다시 만든다.
-- 멱등: DROP POLICY IF EXISTS + CREATE. run-sql.js 는 파일 전체를 한 트랜잭션으로 보내 검증이 실패하면 통째로 되돌아간다.
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.reference_texts') IS NULL
     OR to_regprocedure('exam.is_allowed_domain()') IS NULL THEN
    RAISE EXCEPTION
      'exam.reference_texts 또는 exam.is_allowed_domain() 이 없습니다 (현재 DB: %). '
      'ara-system 과 공유하는 프로젝트에서 실행하세요.', current_database();
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "Authenticated users can manage reference_texts" ON exam.reference_texts;
DROP POLICY IF EXISTS "Authenticated users can read reference_texts" ON exam.reference_texts;
DROP POLICY IF EXISTS "Admin can insert reference_texts" ON exam.reference_texts;
DROP POLICY IF EXISTS "Admin can update reference_texts" ON exam.reference_texts;
DROP POLICY IF EXISTS "Admin can delete reference_texts" ON exam.reference_texts;

CREATE POLICY "Authenticated users can read reference_texts" ON exam.reference_texts
  FOR SELECT
  USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

-- ⚠️ 리터럴은 src/lib/constants.ts ADMIN_EMAIL 과 같아야 한다(owner-policy.test.ts 가 대조한다)
CREATE POLICY "Admin can insert reference_texts" ON exam.reference_texts
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  );

CREATE POLICY "Admin can update reference_texts" ON exam.reference_texts
  FOR UPDATE
  USING (
    (select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  )
  WITH CHECK (
    (select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  );

CREATE POLICY "Admin can delete reference_texts" ON exam.reference_texts
  FOR DELETE
  USING (
    (select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  );

-- ---------------------------------------------
-- 검증 ① 정책 모양 — 넷, FOR ALL 없음, 쓰기 셋에 원장 리터럴, 읽기에는 없음, 전부 (select …) 꼴
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_total INT;
  v_all   INT;
  v_list  TEXT;
  v_bad   TEXT;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE cmd = 'ALL'),
         string_agg(policyname || ':' || cmd, ', ' ORDER BY cmd)
    INTO v_total, v_all, v_list
    FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'reference_texts';
  IF v_total <> 4 OR v_all <> 0 THEN
    RAISE EXCEPTION 'sql/84: 정책이 4개(ALL 0개)여야 하는데 %개(ALL %개): %', v_total, v_all, v_list;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'reference_texts'
                  AND cmd = 'INSERT' AND with_check LIKE '%ara0723@araeducation.co.kr%')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'reference_texts'
                  AND cmd = 'UPDATE' AND qual LIKE '%ara0723@araeducation.co.kr%' AND with_check LIKE '%ara0723@araeducation.co.kr%')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'reference_texts'
                  AND cmd = 'DELETE' AND qual LIKE '%ara0723@araeducation.co.kr%') THEN
    RAISE EXCEPTION 'sql/84: 쓰기 정책에 원장 이메일 조건이 없다: %', v_list;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'reference_texts'
              AND cmd = 'SELECT' AND qual LIKE '%ara0723%') THEN
    RAISE EXCEPTION 'sql/84: 읽기 정책에 원장 조건이 붙었다 — 선생님이 못 읽는다';
  END IF;

  -- 감싼 호출을 지우고 남은 글에 함수 호출이 있으면 행마다 평가된다(sql/65 와 같은 검사)
  SELECT string_agg(policyname, ', ') INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'exam' AND tablename = 'reference_texts'
     AND regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
           'SELECT \(?(auth\.(role|jwt)\(\)|exam\.is_allowed_domain\(\))', '', 'g')
         ~ '(auth\.(role|jwt)\(\)|is_allowed_domain\(\))';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'sql/84: 감싸지 않은 정책이 있다: %', v_bad;
  END IF;

  RAISE NOTICE 'sql/84 정책: %', v_list;
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 ② 실제로 막히는가 — JWT 를 흉내 내 잰다 (되돌리는 하위 트랜잭션)
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 역할을 바꿔서 잰다(sql/57 과 같은 방법).
DO $verify_probe$
DECLARE
  v_owner_rows INT;
  v_any        UUID;
  v_director   UUID;
  v_new        UUID;
  v_n          INT;
  v_blocked    BOOLEAN;
BEGIN
  SELECT count(*) INTO v_owner_rows FROM exam.reference_texts;
  SELECT id INTO v_any FROM exam.reference_texts ORDER BY created_at LIMIT 1;
  SELECT id INTO v_director FROM auth.users WHERE email = 'ara0723@araeducation.co.kr' LIMIT 1;
  IF v_director IS NULL THEN
    RAISE NOTICE 'sql/84: 원장 계정이 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';

    -- ① 다른 선생님: 소유자가 보는 만큼 그대로 읽고, 올리기 거절 · 고치기 0행 · 지우기 0행
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_director::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    SELECT count(*) INTO v_n FROM exam.reference_texts;
    IF v_n <> v_owner_rows THEN RAISE EXCEPTION '선생님이 %행만 읽는다(소유자 %행)', v_n, v_owner_rows; END IF;
    v_blocked := false;
    BEGIN
      INSERT INTO exam.reference_texts (title, body) VALUES ('sql/84 검증', '본문');
    EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION '선생님이 작품 전문·개념을 올릴 수 있다'; END IF;
    IF v_any IS NOT NULL THEN
      UPDATE exam.reference_texts SET note = note WHERE id = v_any;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n <> 0 THEN RAISE EXCEPTION '선생님이 고칠 수 있다 (%행)', v_n; END IF;
      DELETE FROM exam.reference_texts WHERE id = v_any;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n <> 0 THEN RAISE EXCEPTION '선생님이 지울 수 있다 (%행)', v_n; END IF;
    END IF;

    -- ② 바깥 도메인: 하나도 안 보인다
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_director::text, 'role', 'authenticated', 'email', 'verify@gmail.com'
    )::text, true);
    SELECT count(*) INTO v_n FROM exam.reference_texts;
    IF v_n <> 0 THEN RAISE EXCEPTION '바깥 도메인이 %행을 읽는다', v_n; END IF;

    -- ③ 원장: 올리기 1행(트리거가 user_id 를 채운다) · 고치기 1행 · 지우기 1행
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_director::text, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr'
    )::text, true);
    INSERT INTO exam.reference_texts (title, body, kind, format)
      VALUES ('sql/84 검증', '<p>본문</p>', '개념', 'html') RETURNING id INTO v_new;
    IF (SELECT user_id FROM exam.reference_texts WHERE id = v_new) IS DISTINCT FROM v_director THEN
      RAISE EXCEPTION 'user_id 가 원장으로 채워지지 않았다';
    END IF;
    UPDATE exam.reference_texts SET note = '검증' WHERE id = v_new;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION '원장이 고치지 못한다 (%행)', v_n; END IF;
    DELETE FROM exam.reference_texts WHERE id = v_new;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION '원장이 지우지 못한다 (%행)', v_n; END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN
      RAISE;
    END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/84: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  SELECT count(*) INTO v_n FROM exam.reference_texts;
  IF v_n <> v_owner_rows THEN
    RAISE EXCEPTION 'sql/84: 검증이 되돌아가지 않았다 (% → %행)', v_owner_rows, v_n;
  END IF;

  RAISE NOTICE 'sql/84 검증: 선생님 읽기 %행 ○ · 올리기 거절 · 고치기·지우기 0행, 바깥 도메인 0행, 원장 올리기·고치기·지우기 ○ (전부 되돌림)', v_owner_rows;
END
$verify_probe$;
