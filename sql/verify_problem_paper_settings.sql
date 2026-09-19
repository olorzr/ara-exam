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
--
-- [2026-09-20] 항목 스냅샷의 **출처에 학기**(sql/35)가 실리는지도 함께 본다 — 그 키가 빠지면
-- 문항 위의 출처가 '2026 중2 상현중 중간' 까지만 찍혀 1·2학기를 구분할 수 없다.
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
  v_semester_problem UUID;
  v_has_semester BOOLEAN;
  v_semester   TEXT;
  v_labels     TEXT;
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

  -- 출처 스냅샷에 학기 키가 실리는가 (sql/35).
  -- ⚠️ **키가 있는가**로 본다 — 학기가 비어 있는 출처도 있어서 값으로 보면 그 출처를
  --    골랐을 때 통과·실패가 뒤집힌다. 값이 있는 출처가 있으면 라벨까지 함께 본다.
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);

    -- 학기가 적힌 출처의 문항을 고른다(없으면 아무거나 — 키 검사는 그래도 유효하다)
    SELECT p.id INTO v_semester_problem
      FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id
     WHERE COALESCE(s.semester, '') <> '' LIMIT 1;

    v_id := exam.create_problem_paper('검증용 임시 문제지 학기',
                                      ARRAY[COALESCE(v_semester_problem, v_problem)], '{}'::jsonb);

    SELECT (i.snapshot -> 'source') ? 'semester', i.snapshot -> 'source' ->> 'semester'
      INTO v_has_semester, v_semester
      FROM exam.problem_paper_items i WHERE i.paper_id = v_id;
    SELECT array_to_string(source_labels, ' | ') INTO v_labels
      FROM exam.problem_papers WHERE id = v_id;

    IF NOT v_has_semester THEN
      RAISE EXCEPTION '항목 스냅샷의 출처에 학기 키가 없다 — sql/35 가 적용되지 않았다';
    END IF;
    RAISE NOTICE '스냅샷 출처의 학기 키 있음 (값: %)', COALESCE(NULLIF(v_semester, ''), '(비어 있음)');

    IF v_semester_problem IS NOT NULL THEN
      IF position(v_semester IN v_labels) = 0 THEN
        RAISE EXCEPTION 'source_labels 에 학기가 안 들어갔다 (라벨: %)', v_labels;
      END IF;
      RAISE NOTICE 'source_labels 에도 학기가 들어갔다: %', v_labels;
    ELSE
      RAISE NOTICE '학기가 적힌 출처가 없어 라벨 검사는 건너뛴다';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
    RAISE NOTICE '학기 검증용 문제지는 되돌렸다';
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
