-- =============================================
-- 113. 문제 은행 오류 신고 — 선생님이 신고하고 원장이 처리한다 (2026-11-22)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/113_problem_reports.sql
-- =============================================
-- ⚠️⚠️ 2026-11-23 부터 신고 종류 CHECK 와 `exam.report_problem` 의 정식 정의는 sql/114(태그 오류 · 출처·번호 오류를 더했다).
--   이 파일을 다시 돌리면 RPC 가 옛 다섯 종류로 되돌아가니 **곧바로 sql/114 를 다시 돌릴 것**(표의 CHECK 는 CREATE TABLE IF NOT
--   EXISTS 라 그대로다).
-- 배경 (원장님 "문제은행에서 오류가 있는 문제들을 선생님들이 체킹할 수 있는 기능 … 대부분 애들 문제은행에서 문제지로
--   만든 다음에 그걸 풀리다가 찾거든? 그래서 그걸 신고하는 부분이 있으면 좋겠어. 신고하면 나한테 연락오게끔")
--   · 신고 자리는 둘 — 문제지 보기 화면(몇 번 문항인지 고른다)과 문제 은행 문항 상세 창. 원장 연락(웍스 DM)은 앱이 저장
--     뒤에 서버 라우트(api/notify-problem-report → 관리자센터 인테이크)로 보내고 `notified_at` 을 남긴다.
--   · **신고 때의 모습을 복사해 둔다**(snapshot · paper_title · printed_no · source_label). 재적재하면 문항 id 가 바뀌고
--     (적재기가 출처를 지우고 다시 넣는다), 문제지를 고치면 항목이 지워진다(sql/103). 그래서 세 참조는 SET NULL 이고,
--     참조가 끊겨도 무엇을 신고했는지는 남는다.
--   · 목록은 선생님 모두 읽는다(이미 신고된 문항인지·고쳐졌는지 알게). **쓰기는 RPC 둘뿐** — 신고(도메인 전원)·처리(원장).
--     표에는 브라우저 INSERT·UPDATE·DELETE 권한을 주지 않는다(문제지와 같은 규약 — 남의 신고를 고치거나 처리 상태를 위조 못 한다).
--   · 원장 판정은 **JWT 이메일 리터럴**이다(sql/57·76·84·104 와 같다 — exam.is_owner_email() 은 sql/103 이 브라우저에서 거뒀다).
--
-- ⚠️ 원장 이메일 리터럴 자리가 하나 는다 — src/lib/constants.ts ADMIN_EMAIL JSDoc 이 대조 목록을 들고 있다.
-- 멱등: IF NOT EXISTS · CREATE OR REPLACE · DROP … IF EXISTS. 파괴적 문 없음.
-- run-sql.js 는 파일 전체를 한 트랜잭션으로 보낸다 — 아래 검증이 실패하면 통째로 되돌아간다.
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problem_paper_items') IS NULL OR to_regclass('exam.problems') IS NULL
     OR to_regprocedure('exam.is_allowed_domain()') IS NULL
     OR to_regprocedure('exam.paper_item_snapshot(exam.problems, exam.passages, exam.problem_sources)') IS NULL
     OR to_regprocedure('exam.paper_source_label(jsonb)') IS NULL
     OR to_regprocedure('exam.enforce_user_id_from_auth()') IS NULL THEN
    RAISE EXCEPTION
      'exam 문제 은행 표·헬퍼(sql/17·103)가 있어야 합니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;
END
$guard$;

-- ---------------------------------------------
-- 1. 표
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.problem_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 참조 셋은 끊길 수 있다(재적재·문제지 고치기·지우기) — 무엇을 신고했는지는 아래 복사본이 남긴다
  problem_id      UUID REFERENCES exam.problems(id) ON DELETE SET NULL,
  paper_id        UUID REFERENCES exam.problem_papers(id) ON DELETE SET NULL,
  paper_item_id   UUID REFERENCES exam.problem_paper_items(id) ON DELETE SET NULL,
  -- 신고 때의 모습(문제지면 그 항목의 스냅샷, 문제 은행이면 그때 원본으로 굳힌 것 — exam.paper_item_snapshot 과 같은 모양)
  snapshot        JSONB NOT NULL,
  paper_title     TEXT,
  printed_no      INT CHECK (printed_no IS NULL OR printed_no >= 1),
  source_label    TEXT,
  category        TEXT NOT NULL CHECK (category IN ('answer', 'text', 'passage', 'figure', 'other')),
  note            TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'rejected')),
  resolution_note TEXT NOT NULL DEFAULT '' CHECK (length(resolution_note) <= 500),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  -- 원장에게 웍스로 닿은 때(보냈거나 아침 브리핑 보관함에 넣음) — 서버 라우트(service_role)만 쓴다
  notified_at     TIMESTAMPTZ,
  user_id         UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'open') = (resolved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_problem_reports_status_created ON exam.problem_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_problem_reports_problem ON exam.problem_reports (problem_id) WHERE problem_id IS NOT NULL;

COMMENT ON TABLE exam.problem_reports IS
  '문제 은행 오류 신고(sql/113). 쓰기는 RPC report_problem(선생님)·resolve_problem_report(원장)와 알림 라우트(notified_at, service_role)뿐.';

-- ---------------------------------------------
-- 2. 트리거 — user_id 강제·잠금 · updated_at (저장소 규약 그대로)
-- ---------------------------------------------
DROP TRIGGER IF EXISTS aa_enforce_user_id_problem_reports_insert ON exam.problem_reports;
CREATE TRIGGER aa_enforce_user_id_problem_reports_insert
  BEFORE INSERT ON exam.problem_reports
  FOR EACH ROW EXECUTE FUNCTION exam.enforce_user_id_from_auth();

DROP TRIGGER IF EXISTS aa_lock_user_id_problem_reports_update ON exam.problem_reports;
CREATE TRIGGER aa_lock_user_id_problem_reports_update
  BEFORE UPDATE ON exam.problem_reports
  FOR EACH ROW EXECUTE FUNCTION exam.lock_user_id_on_update();

DROP TRIGGER IF EXISTS problem_reports_updated_at ON exam.problem_reports;
CREATE TRIGGER problem_reports_updated_at
  BEFORE UPDATE ON exam.problem_reports
  FOR EACH ROW EXECUTE FUNCTION exam.update_updated_at();

-- ---------------------------------------------
-- 3. 권한 · RLS — 읽기는 도메인 전원, 쓰기는 RPC 만
-- ---------------------------------------------
ALTER TABLE exam.problem_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exam.problem_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON exam.problem_reports TO authenticated;
GRANT ALL ON exam.problem_reports TO service_role;

DROP POLICY IF EXISTS "Domain users can read problem_reports" ON exam.problem_reports;
CREATE POLICY "Domain users can read problem_reports" ON exam.problem_reports
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND (select exam.is_allowed_domain()));

-- ---------------------------------------------
-- 4. 신고 — 문제지 항목(p_paper_item_id) 또는 문제 은행 문항(p_problem_id) 하나
-- ---------------------------------------------
-- 문제지 항목이면 화면이 보고 있는 문제지 판(p_paper_revision = updated_at)이 지금 판과 같아야 한다 — 다른 곳에서 순서를
-- 바꿨으면 화면의 번호와 다른 문항이 신고되고 printed_no 도 어긋난다(코덱스 1R). 문제지 행을 FOR SHARE 로 잡아
-- 고치기(sql/103 update_problem_paper — 같은 행을 UPDATE)와 겹치면 그쪽 커밋 뒤의 판으로 견준다.
-- 첫 적용 판(인자 넷)은 판 대조가 없었다 — 지우고 새 서명으로 만든다(오버로드가 남으면 PostgREST 가 못 고른다).
DROP FUNCTION IF EXISTS exam.report_problem(TEXT, TEXT, UUID, UUID);
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
  IF p_category IS NULL OR p_category NOT IN ('answer', 'text', 'passage', 'figure', 'other') THEN
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

-- ---------------------------------------------
-- 5. 처리 — 원장만. open 으로 되돌리면 처리 기록을 비운다
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.resolve_problem_report(
  p_id     UUID,
  p_status TEXT,
  p_note   TEXT DEFAULT ''
) RETURNS VOID
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_note TEXT := btrim(COALESCE(p_note, ''));
BEGIN
  -- ⚠️ 리터럴은 src/lib/constants.ts ADMIN_EMAIL 과 같아야 한다
  IF auth.uid() IS NULL OR NOT exam.is_allowed_domain()
     OR COALESCE(auth.jwt() ->> 'email', '') <> 'ara0723@araeducation.co.kr' THEN
    RAISE EXCEPTION '원장님만 처리할 수 있어요' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('open', 'fixed', 'rejected') THEN
    RAISE EXCEPTION '처리 상태가 올바르지 않습니다' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_note) > 500 THEN
    RAISE EXCEPTION '처리 메모는 500자까지 적을 수 있습니다' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE exam.problem_reports
     SET status = p_status,
         resolution_note = CASE WHEN p_status = 'open' THEN '' ELSE v_note END,
         resolved_at = CASE WHEN p_status = 'open' THEN NULL ELSE now() END,
         resolved_by = CASE WHEN p_status = 'open' THEN NULL ELSE auth.uid() END
   WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '신고를 찾지 못했어요' USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION exam.resolve_problem_report(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.resolve_problem_report(UUID, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 ① 모양 — 트리거·정책·권한·참조 동작
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_list TEXT;
BEGIN
  SELECT string_agg(tgname, ', ' ORDER BY tgname) INTO v_list
    FROM pg_trigger WHERE tgrelid = 'exam.problem_reports'::regclass AND NOT tgisinternal;
  IF v_list IS DISTINCT FROM
     'aa_enforce_user_id_problem_reports_insert, aa_lock_user_id_problem_reports_update, problem_reports_updated_at' THEN
    RAISE EXCEPTION 'sql/113: 트리거가 예상과 다르다: %', v_list;
  END IF;

  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname) INTO v_list
    FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'problem_reports';
  IF v_list IS DISTINCT FROM 'Domain users can read problem_reports:SELECT' THEN
    RAISE EXCEPTION 'sql/113: 정책은 읽기 하나뿐이어야 하는데: %', v_list;
  END IF;

  IF has_table_privilege('authenticated', 'exam.problem_reports', 'INSERT')
     OR has_table_privilege('authenticated', 'exam.problem_reports', 'UPDATE')
     OR has_table_privilege('authenticated', 'exam.problem_reports', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'exam.problem_reports', 'SELECT') THEN
    RAISE EXCEPTION 'sql/113: authenticated 표 권한이 읽기 하나가 아니다';
  END IF;

  SELECT string_agg(confdeltype::text, '' ORDER BY conname) INTO v_list
    FROM pg_constraint WHERE conrelid = 'exam.problem_reports'::regclass AND contype = 'f';
  IF v_list IS DISTINCT FROM 'nnn' THEN
    RAISE EXCEPTION 'sql/113: 참조 셋이 모두 SET NULL 이어야 하는데: %', v_list;
  END IF;

  IF (SELECT count(*) FROM pg_proc WHERE proname = 'report_problem' AND pronamespace = 'exam'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'sql/113: exam.report_problem 이 하나가 아니다(옛 서명이 남았다)';
  END IF;

  RAISE NOTICE 'sql/113 모양 통과 — 트리거 3 · 읽기 정책 1 · 표 권한 읽기만 · 참조 SET NULL 3 · 신고 RPC 하나';
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 ② 실제로 — JWT 를 흉내 내 신고·읽기·처리를 해 본다(전부 되돌린다)
-- ---------------------------------------------
-- 선생님 A 가 문제지 항목을 신고 → 선생님 B 가 읽음 · B 의 처리 거절 · B 의 직접 INSERT 거절 · 바깥 도메인 0행 ·
-- 원장 처리 성공 · 문제 은행 문항 신고(지금 원본을 굳힘). postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 잰다.
DO $verify_probe$
DECLARE
  v_item     UUID;
  v_item_no  INT;
  v_rev      TIMESTAMPTZ;
  v_problem  UUID;
  v_a        UUID := gen_random_uuid();
  v_b        UUID := gen_random_uuid();
  v_id       UUID;
  v_id2      UUID;
  v_n        INT;
  v_row      exam.problem_reports;
BEGIN
  SELECT i.id, i.order_index + 1, p.updated_at INTO v_item, v_item_no, v_rev
    FROM exam.problem_paper_items i JOIN exam.problem_papers p ON p.id = i.paper_id
   ORDER BY i.paper_id, i.order_index LIMIT 1 OFFSET 2;
  SELECT p.id INTO v_problem FROM exam.problems p ORDER BY p.created_at LIMIT 1;
  IF v_item IS NULL OR v_problem IS NULL THEN
    RAISE NOTICE 'sql/113: 문제지 항목·문항이 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';

    -- 선생님 A: 문제지 항목 신고
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_a::text, 'role', 'authenticated', 'email', 'verify-a@araeducation.co.kr')::text, true);
    v_id := exam.report_problem('answer', '  정답이 틀려요  ', NULL, v_item, v_rev);
    SELECT * INTO v_row FROM exam.problem_reports WHERE id = v_id;
    IF v_row.user_id <> v_a OR v_row.status <> 'open' OR v_row.note <> '정답이 틀려요'
       OR v_row.printed_no IS NULL OR v_row.paper_id IS NULL OR v_row.snapshot ->> 'stem_html' IS NULL THEN
      RAISE EXCEPTION '신고 행이 이상하다: user=% status=% note=% no=% paper=%',
        v_row.user_id, v_row.status, v_row.note, v_row.printed_no, v_row.paper_id;
    END IF;

    -- '기타' 는 내용이 있어야 한다
    BEGIN
      PERFORM exam.report_problem('other', '   ', NULL, v_item, v_rev);
      RAISE EXCEPTION 'sql113_other_passed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 화면이 본 판이 지금 판과 다르면 거절(다른 곳에서 순서를 바꾼 뒤의 신고)
    BEGIN
      PERFORM exam.report_problem('answer', '', NULL, v_item, v_rev - interval '1 second');
      RAISE EXCEPTION 'sql113_stale_passed';
    EXCEPTION WHEN serialization_failure THEN NULL;
    END;
    -- 판 없이 문제지 항목을 신고할 수 없다
    BEGIN
      PERFORM exam.report_problem('answer', '', NULL, v_item, NULL);
      RAISE EXCEPTION 'sql113_norev_passed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 선생님 B: 읽기는 되고, 처리·직접 쓰기는 막힌다
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_b::text, 'role', 'authenticated', 'email', 'verify-b@araeducation.co.kr')::text, true);
    SELECT count(*) INTO v_n FROM exam.problem_reports WHERE id = v_id;
    IF v_n <> 1 THEN RAISE EXCEPTION '다른 선생님이 신고를 못 읽는다 (%행)', v_n; END IF;
    BEGIN
      PERFORM exam.resolve_problem_report(v_id, 'fixed', '');
      RAISE EXCEPTION 'sql113_teacher_resolved';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      INSERT INTO exam.problem_reports (snapshot, category, user_id) VALUES ('{}'::jsonb, 'answer', v_b);
      RAISE EXCEPTION 'sql113_direct_insert';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      UPDATE exam.problem_reports SET status = 'rejected', resolved_at = now() WHERE id = v_id;
      RAISE EXCEPTION 'sql113_direct_update';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- 바깥 도메인: 0행
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_b::text, 'role', 'authenticated', 'email', 'verify@example.com')::text, true);
    SELECT count(*) INTO v_n FROM exam.problem_reports WHERE id = v_id;
    IF v_n <> 0 THEN RAISE EXCEPTION '바깥 도메인이 신고를 읽는다 (%행)', v_n; END IF;

    -- 원장: 처리 → 되돌리기
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr')::text, true);
    PERFORM exam.resolve_problem_report(v_id, 'fixed', '정답 고쳤어요');
    SELECT * INTO v_row FROM exam.problem_reports WHERE id = v_id;
    IF v_row.status <> 'fixed' OR v_row.resolved_at IS NULL OR v_row.resolved_by IS NULL
       OR v_row.resolution_note <> '정답 고쳤어요' OR v_row.user_id <> v_a THEN
      RAISE EXCEPTION '원장 처리가 이상하다: status=% at=% by=% user=%', v_row.status, v_row.resolved_at, v_row.resolved_by, v_row.user_id;
    END IF;
    PERFORM exam.resolve_problem_report(v_id, 'open', '');
    SELECT * INTO v_row FROM exam.problem_reports WHERE id = v_id;
    IF v_row.status <> 'open' OR v_row.resolved_at IS NOT NULL OR v_row.resolved_by IS NOT NULL THEN
      RAISE EXCEPTION '되돌리기가 처리 기록을 비우지 않았다';
    END IF;

    -- 문제 은행 문항 신고 — 지금 원본을 굳히고 문제지 칸은 비어 있다
    v_id2 := exam.report_problem('text', '', v_problem, NULL, NULL);
    SELECT * INTO v_row FROM exam.problem_reports WHERE id = v_id2;
    IF v_row.problem_id <> v_problem OR v_row.paper_id IS NOT NULL OR v_row.printed_no IS NOT NULL
       OR v_row.snapshot ->> 'stem_html' IS NULL THEN
      RAISE EXCEPTION '문항 신고 행이 이상하다';
    END IF;

    RAISE EXCEPTION 'sql113_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'sql113_rollback' THEN RAISE; END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/113: 검증 뒤 역할이 돌아오지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_reports WHERE id IN (v_id, v_id2)) THEN
    RAISE EXCEPTION 'sql/113: 검증용 신고가 되돌아가지 않았다';
  END IF;
  RAISE NOTICE 'sql/113 실제 검증 통과 — 신고 · 옛 판·판 없음 거절 · 다른 선생님 읽기 · 처리·직접 쓰기 거절 · 바깥 도메인 0 · 원장 처리·되돌리기 · 문항 신고 (전부 되돌림)';
END
$verify_probe$;
