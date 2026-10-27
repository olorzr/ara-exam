-- =============================================
-- 80. 기출 출처 유형에 '평가문제집' — 출판사 교과서 평가문제집(학교 없음)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/80_problem_source_workbook_type.sql
-- =============================================
-- 배경: 원장님(2026-10-28) "평가문제집은 유형을 평가문제집으로 넣어줘." 2022 개정 중2-1 평가문제집 6종
--   (동아·비상(박현숙)·비상(박영민)·천재(노미숙)·천재(정호웅)·해냄)을 소단원 하나 = 출처 하나로 넣는다.
--   학교·학기 시험이 없고(school_name '' · exam_type ''), 교과서(textbook)·출판사(publisher)로 찾는다.
-- ⚠️ 값 목록은 앱 `ProblemSourceType`·`SOURCE_TYPE_OPTIONS`(source-form.ts)와 같아야 한다.
-- ⚠️ exam_type CHECK(sql/55)는 '' 를 모든 유형에 허용하므로 손대지 않는다.

DO $guard$
BEGIN
  IF to_regclass('exam.problem_sources') IS NULL THEN
    RAISE EXCEPTION 'exam.problem_sources 가 없습니다 (현재 DB: %).', current_database();
  END IF;
END
$guard$;

ALTER TABLE exam.problem_sources DROP CONSTRAINT IF EXISTS problem_sources_source_type_check;
ALTER TABLE exam.problem_sources ADD CONSTRAINT problem_sources_source_type_check
  CHECK (source_type IN ('내신기출', '모의고사', '문제집', '프린트', '평가문제집'));

NOTIFY pgrst, 'reload schema';

-- 자가 검증 — 교직원 JWT 로 평가문제집 출처를 넣고(학교 없음) 모르는 유형은 막히는지 본 뒤 되돌린다
DO $probe$
DECLARE
  v_user  UUID;
  v_email TEXT;
  v_id    UUID;
  v_ok    BOOLEAN := false;
BEGIN
  SELECT id, email INTO v_user, v_email
    FROM auth.users WHERE email LIKE '%@araeducation.co.kr' ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'sql/80 probe 건너뜀: 학원 도메인 사용자가 없다';
    RETURN;
  END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', v_email)::text, true);

    INSERT INTO exam.problem_sources (source_type, title, grade, semester, textbook, publisher)
      VALUES ('평가문제집', '__sql80_probe__', '중2', '1학기', '동아', '동아출판')
      RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'probe 실패: 평가문제집 출처가 안 들어갔다'; END IF;

    BEGIN
      INSERT INTO exam.problem_sources (source_type, title) VALUES ('교재', '__sql80_probe__');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'probe 실패: 모르는 유형이 통과했다'; END IF;

    RAISE EXCEPTION '__sql80_probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__sql80_probe_rollback__' THEN RAISE; END IF;
  END;
  IF current_user <> session_user THEN RAISE EXCEPTION 'sql/80: 역할이 되돌아가지 않았다'; END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_sources WHERE title = '__sql80_probe__') THEN
    RAISE EXCEPTION 'sql/80: 검증 행이 남았다';
  END IF;
  RAISE NOTICE '✓ sql/80 자가 검증 통과 — 평가문제집 출처(학교 없음) 들어감 · 모르는 유형 막힘 · 되돌림';
END
$probe$;

DO $report$
DECLARE v_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'exam.problem_sources'::regclass AND conname = 'problem_sources_source_type_check';
  RAISE NOTICE 'sql/80 source_type: %', v_def;
  IF v_def IS NULL OR position('평가문제집' IN v_def) = 0 THEN
    RAISE EXCEPTION 'sql/80 적용 결과가 기대와 다르다';
  END IF;
END
$report$;
