-- =============================================
-- 114. 오류 신고 종류 둘 더 — 태그 오류 · 출처·번호 오류 (2026-11-23)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/114_problem_report_tag_source_categories.sql
-- =============================================
-- 배경 (원장님 "오류 신고에 태그잘못? 이런거 넣어주라")
--   · 'tag'    태그 오류 — 문항에 붙은 작품·단원·영역(문법 태그 포함)이 틀렸다. 문제 은행 카드에 보이는 그 꼬리표들이다.
--   · 'source' 출처·번호 오류 — 교사용·문제 은행에 찍히는 출처('2026 중2 상현중 1학기 중간 17번')가 틀렸다(0.9.95 부터
--     교사용에 늘 찍혀 선생님이 원본과 맞춰 본다).
--   · 처리 흐름은 그대로다(원장 웍스 DM · 원장 처리). '기타' 만 내용을 꼭 적는다.
--
-- ⚠️ 종류 값은 앱 `src/lib/problem-report/types.ts` 의 REPORT_CATEGORIES 와 1:1 이다 — 하나를 바꾸면 둘 다(types.test 가 이 파일을 읽어 대조).
-- ⚠️⚠️ 이제 신고 종류 CHECK 와 `exam.report_problem` 의 **정식 정의는 이 파일**이다. sql/113 을 다시 돌리면 RPC 가 옛 다섯 종류로
--   되돌아가 '태그 오류' 신고가 거절된다 — 그 뒤에는 이 파일을 다시 돌릴 것(sql/113 머리에도 적었다).
--   함수 본문은 sql/113 판과 글자 그대로 같고 종류 목록 한 줄만 다르다(적용 전에 운영 정의 = sql/113 파일임을 확인했다).
-- 멱등: 제약은 지우고 다시 만들고, 함수는 CREATE OR REPLACE(서명 그대로 — 오버로드가 생기지 않는다).
-- =============================================

-- ---------------------------------------------
-- 1. 표의 종류 CHECK — 이름은 sql/113 의 인라인 CHECK 가 받은 기본 이름 그대로
-- ---------------------------------------------
ALTER TABLE exam.problem_reports DROP CONSTRAINT IF EXISTS problem_reports_category_check;
ALTER TABLE exam.problem_reports ADD CONSTRAINT problem_reports_category_check
  CHECK (category IN ('answer', 'text', 'passage', 'figure', 'tag', 'source', 'other'));

-- ---------------------------------------------
-- 2. 신고 RPC — sql/113 판 그대로, 종류 목록만 넓힌다
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.report_problem(
  p_category       TEXT,
  p_note           TEXT DEFAULT '',
  p_problem_id     UUID DEFAULT NULL,
  p_paper_item_id  UUID DEFAULT NULL,
  p_paper_revision TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_note        TEXT := btrim(COALESCE(p_note, ''));
  v_snapshot    JSONB;
  v_problem_id  UUID;
  v_paper_id    UUID;
  v_paper_title TEXT;
  v_printed_no  INT;
  v_revision    TIMESTAMPTZ;
  v_id          UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT exam.is_allowed_domain() THEN
    RAISE EXCEPTION '허용되지 않은 계정입니다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('answer', 'text', 'passage', 'figure', 'tag', 'source', 'other') THEN
    RAISE EXCEPTION '신고 종류가 올바르지 않습니다' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_note) > 1000 THEN
    RAISE EXCEPTION '내용은 1000자까지 적을 수 있습니다' USING ERRCODE = 'check_violation';
  END IF;
  IF p_category = 'other' AND v_note = '' THEN
    RAISE EXCEPTION '기타 신고는 내용을 적어 주세요' USING ERRCODE = 'check_violation';
  END IF;
  IF (p_problem_id IS NULL) = (p_paper_item_id IS NULL) THEN
    RAISE EXCEPTION '문제지 항목이나 문항 중 하나만 골라 주세요' USING ERRCODE = 'check_violation';
  END IF;

  IF p_paper_item_id IS NOT NULL THEN
    IF p_paper_revision IS NULL THEN
      RAISE EXCEPTION '문제지 판이 필요합니다' USING ERRCODE = 'check_violation';
    END IF;
    SELECT p.updated_at INTO v_revision
      FROM exam.problem_papers p
      JOIN exam.problem_paper_items i ON i.paper_id = p.id
     WHERE i.id = p_paper_item_id
       FOR SHARE OF p;
    IF v_revision IS NULL THEN
      RAISE EXCEPTION '문제지 문항을 찾지 못했어요 — 문제지가 바뀌었을 수 있어요' USING ERRCODE = 'no_data_found';
    END IF;
    IF v_revision <> p_paper_revision THEN
      RAISE EXCEPTION '문제지가 다른 곳에서 바뀌었어요. 화면을 새로 고친 뒤 다시 신고해 주세요'
        USING ERRCODE = 'serialization_failure';
    END IF;
    -- 문제지에서 — 그 항목의 스냅샷(인쇄된 모습)과 문제지 안 번호를 남긴다. 번호는 자리 차례(인쇄 번호와 같다)
    SELECT i.snapshot, i.problem_id, i.paper_id, p.title,
           (SELECT count(*) + 1 FROM exam.problem_paper_items o
             WHERE o.paper_id = i.paper_id AND o.order_index < i.order_index)::int
      INTO v_snapshot, v_problem_id, v_paper_id, v_paper_title, v_printed_no
      FROM exam.problem_paper_items i
      JOIN exam.problem_papers p ON p.id = i.paper_id
     WHERE i.id = p_paper_item_id;
    IF v_snapshot IS NULL THEN
      RAISE EXCEPTION '문제지 문항을 찾지 못했어요 — 문제지가 바뀌었을 수 있어요' USING ERRCODE = 'no_data_found';
    END IF;
  ELSE
    -- 문제 은행에서 — 지금 원본을 문제지와 같은 모양으로 굳힌다
    SELECT exam.paper_item_snapshot(p, ps, s), p.id
      INTO v_snapshot, v_problem_id
      FROM exam.problems p
      LEFT JOIN exam.passages ps ON ps.id = p.passage_id
      LEFT JOIN exam.problem_sources s ON s.id = p.source_id
     WHERE p.id = p_problem_id;
    IF v_snapshot IS NULL THEN
      RAISE EXCEPTION '문항을 찾지 못했어요 — 지워졌거나 다시 올라왔을 수 있어요' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  INSERT INTO exam.problem_reports
    (problem_id, paper_id, paper_item_id, snapshot, paper_title, printed_no, source_label, category, note, user_id)
  VALUES
    (v_problem_id, v_paper_id, p_paper_item_id, v_snapshot, v_paper_title, v_printed_no,
     exam.paper_source_label(v_snapshot -> 'source'), p_category, v_note, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION exam.report_problem(TEXT, TEXT, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.report_problem(TEXT, TEXT, UUID, UUID, TIMESTAMPTZ) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 ① 모양 — 제약 하나 · 함수 하나 · 목록이 같은가
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_def TEXT;
  v_n   INT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'exam.problem_reports'::regclass AND conname = 'problem_reports_category_check';
  IF v_def IS NULL OR v_def NOT LIKE '%''tag''%' OR v_def NOT LIKE '%''source''%' OR v_def NOT LIKE '%''other''%' THEN
    RAISE EXCEPTION 'sql/114: 종류 CHECK 가 이상하다: %', v_def;
  END IF;
  SELECT count(*) INTO v_n FROM pg_constraint
   WHERE conrelid = 'exam.problem_reports'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%category%';
  IF v_n <> 1 THEN RAISE EXCEPTION 'sql/114: 종류 CHECK 가 하나가 아니다 (%)', v_n; END IF;

  IF (SELECT count(*) FROM pg_proc WHERE proname = 'report_problem' AND pronamespace = 'exam'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'sql/114: exam.report_problem 이 하나가 아니다';
  END IF;
  SELECT pg_get_functiondef('exam.report_problem(text,text,uuid,uuid,timestamptz)'::regprocedure) INTO v_def;
  IF v_def NOT LIKE '%''figure'', ''tag'', ''source'', ''other''%' THEN
    RAISE EXCEPTION 'sql/114: report_problem 의 종류 목록이 넓혀지지 않았다';
  END IF;
  IF NOT has_function_privilege('authenticated', 'exam.report_problem(text,text,uuid,uuid,timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.report_problem(text,text,uuid,uuid,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'sql/114: report_problem 실행 권한이 authenticated 만이 아니다';
  END IF;
  RAISE NOTICE 'sql/114 모양 통과 — 종류 CHECK 1 · 신고 RPC 1 · 목록 일곱 · 권한 그대로';
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 ② 실제로 — 선생님 JWT 로 새 두 종류를 신고해 보고(내용 없이도 된다), 모르는 종류는 거절(전부 되돌린다)
-- ---------------------------------------------
DO $verify_probe$
DECLARE
  v_problem UUID;
  v_id1     UUID;
  v_id2     UUID;
  v_cat     TEXT;
BEGIN
  SELECT p.id INTO v_problem FROM exam.problems p ORDER BY p.created_at LIMIT 1;
  IF v_problem IS NULL THEN
    RAISE NOTICE 'sql/114: 문항이 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify-a@araeducation.co.kr')::text, true);

    v_id1 := exam.report_problem('tag', '', v_problem, NULL, NULL);
    SELECT category INTO v_cat FROM exam.problem_reports WHERE id = v_id1;
    IF v_cat IS DISTINCT FROM 'tag' THEN RAISE EXCEPTION '태그 오류 신고가 이상하다 (%)', v_cat; END IF;

    v_id2 := exam.report_problem('source', '원래 18번이에요', v_problem, NULL, NULL);
    SELECT category INTO v_cat FROM exam.problem_reports WHERE id = v_id2;
    IF v_cat IS DISTINCT FROM 'source' THEN RAISE EXCEPTION '출처 오류 신고가 이상하다 (%)', v_cat; END IF;

    BEGIN
      PERFORM exam.report_problem('evil', '', v_problem, NULL, NULL);
      RAISE EXCEPTION 'sql114_unknown_passed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'sql114_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'sql114_rollback' THEN RAISE; END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/114: 검증 뒤 역할이 돌아오지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_reports WHERE id IN (v_id1, v_id2)) THEN
    RAISE EXCEPTION 'sql/114: 검증용 신고가 되돌아가지 않았다';
  END IF;
  RAISE NOTICE 'sql/114 실제 검증 통과 — 태그 오류(내용 없이) · 출처·번호 오류 신고 · 모르는 종류 거절 (전부 되돌림)';
END
$verify_probe$;
