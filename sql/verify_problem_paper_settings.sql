-- ---------------------------------------------------------------
-- 검증: exam.create_problem_paper 의 settings 화이트리스트 (재실행 안전)
-- ---------------------------------------------------------------
-- sql/34 를 적용한 뒤 **실제로 함수를 불러** 저장되는 값을 확인한다. 정의 문자열만 보면
-- "그 자리에 그 코드가 있다" 까지만 알 수 있고, 진짜로 그렇게 저장되는지는 모른다.
--
-- 만든 검증용 문제지는 **하위 트랜잭션째 되돌린다** — 감사 로그 행도 함께 되돌아간다.
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/verify_problem_paper_settings.sql
--
-- 계약(앱 `normalizePaperSettings` 와 1:1 거울):
--   키 없음 → true / 불리언 false → false / 불리언 true → true / 불리언이 아닌 값 → true
DO $verify$
DECLARE
  v_problem    UUID;
  v_user       UUID;
  v_id         UUID;
  v_audit_before BIGINT;
  v_audit_after  BIGINT;
  v_case       RECORD;
  v_got        BOOLEAN;
  v_bad        INT := 0;
  v_left       BIGINT;
BEGIN
  SELECT id INTO v_problem FROM exam.problems LIMIT 1;
  SELECT user_id INTO v_user FROM exam.problems WHERE user_id IS NOT NULL LIMIT 1;
  IF v_problem IS NULL OR v_user IS NULL THEN
    RAISE NOTICE '문항이 없어 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_audit_before FROM exam.audit_log;

  BEGIN
    -- 함수가 도메인 가드(`is_allowed_domain`)를 걸어 두어 JWT 를 흉내 낸다.
    -- `is_local = true` 라 이 트랜잭션에서만 유효하다.
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);

    FOR v_case IN
      SELECT * FROM (VALUES
        ('키 없음',          '{"columns":2}'::jsonb,                        true),
        ('불리언 false',     '{"columns":2,"showSource":false}'::jsonb,     false),
        ('불리언 true',      '{"columns":2,"showSource":true}'::jsonb,      true),
        ('문자열 "false"',   '{"columns":2,"showSource":"false"}'::jsonb,   true),
        ('숫자 0',           '{"columns":2,"showSource":0}'::jsonb,         true)
      ) AS t(label, settings, expected)
    LOOP
      v_id := exam.create_problem_paper('검증용 임시 문제지 ' || v_case.label,
                                        ARRAY[v_problem], v_case.settings);
      SELECT (settings ->> 'showSource')::boolean INTO v_got
        FROM exam.problem_papers WHERE id = v_id;

      IF v_got IS DISTINCT FROM v_case.expected THEN
        v_bad := v_bad + 1;
        RAISE WARNING '% → showSource = % (기대 %)', v_case.label, v_got, v_case.expected;
      ELSE
        RAISE NOTICE '% → showSource = % (기대대로)', v_case.label, v_got;
      END IF;
    END LOOP;

    IF v_bad > 0 THEN
      RAISE EXCEPTION '화이트리스트가 계약과 다르다 (%건)', v_bad;
    END IF;

    -- 여기까지 왔으면 전부 통과 — 만든 것을 되돌린다
    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
    RAISE NOTICE '다섯 경우 모두 기대대로 — 검증용 문제지는 되돌렸다';
  END;

  -- 되돌아갔는지는 **말로 하지 않고 검사한다** — NOTICE 만 내면 뒷정리가 깨져도
  -- '완료' 로 끝나고, 검증용 문제지가 선생님 목록에 남는다
  SELECT COUNT(*) INTO v_audit_after FROM exam.audit_log;
  SELECT COUNT(*) INTO v_left FROM exam.problem_papers WHERE title LIKE '검증용 임시 문제지%';
  IF v_left <> 0 OR v_audit_after <> v_audit_before THEN
    RAISE EXCEPTION '뒷정리가 안 됐다 — 남은 검증 행 %건, 감사 로그 증가 %건 (직접 지울 것)',
      v_left, v_audit_after - v_audit_before;
  END IF;
  RAISE NOTICE '뒷정리 확인: 남은 검증 행 0, 감사 로그 증가 0';
END
$verify$;
