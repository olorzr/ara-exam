-- =============================================
-- 103. 문제지를 만든 뒤에도 고친다 — 순서 바꾸기 · 문항 빼기 · 새 문항 넣기 (2026-11-12)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/103_problem_paper_edit.sql
-- 적용 뒤 반드시: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/verify_problem_paper_edit.sql
-- =============================================
-- 배경 (선생님들 요청 → 원장님 결정, 2026-11-12)
--   "문제은행에서 만든 문제지를 이후에 수정할 수 있으면 좋겠다 — 문제 순서라던가, 넣었다가 뺀다던가."
--   지금까지 문제지는 **불변 스냅샷**이고 쓰기는 create_problem_paper 한 곳뿐이었다(sql/17). 그 원칙을 이렇게 바꾼다:
--   · 쓰기는 여전히 **RPC 두 곳**(만들기·고치기)뿐이다 — 표에 INSERT·UPDATE 정책을 열지 않는다(위조 불가 그대로).
--   · **남긴 문항의 본문은 만들 때 굳힌 그대로**다. 새로 담은 문항만 지금 원본으로 굳힌다. 원본을 고쳐도 이미 만든
--     문제지에 흘러들지 않는다는 뜻의 '불변' 은 그대로 지킨다.
--   · 같은 지문 묶음에 새 문항을 넣으면 **그 묶음의 지문 판을 물려받는다**(한 묶음 = 한 지문). 인쇄는 묶음 첫 문항의
--     지문을 찍으므로 판이 섞이면 순서만 바꿔도 인쇄되는 지문이 바뀐다. 지금 원본과 다르면 번호를 돌려준다.
--
-- 누가 고치나 (원장님 결정)
--   · 만든 선생님 + 원장. 다른 선생님은 보기·인쇄만. (지우기 권한은 그대로 — 이 파일은 손대지 않는다)
--   · **책에 담긴 문제지는 원장만**(지우기가 ON DELETE RESTRICT 로 막히는 것과 같은 기준).
--   · **OMR 문제지는 채점 전까지만** — 판정은 Ara-system 계약 함수 public.problem_paper_exam_state(mig598)다.
--     '채점됨' 의 정의를 사본으로 들지 않는다(그쪽이 성적 저장 자리를 넓히면 사본은 조용히 열린다). 호출이 실패하면
--     **고칠 수 없음**으로 닫는다.
--
-- 함께 하는 일
--   · 그 문제지를 담은 책의 page_counts 를 비운다(CLAUDE.md 2026-10-26 규칙 — 책 구성 지문은 문항 내용을 모른다).
--   · OMR 문제지를 고치면 '정답표 반영 대기' 표시를 남긴다(exam.problem_paper_sync_pending). 정답표 재등록은 수정과
--     **다른 트랜잭션**(앱 → 발신 라우트 → 성적 시스템)이라 그 요청이 못 닿으면 옛 정답표가 아무 신호 없이 남는다.
--     발신 라우트가 등록에 성공하고 정답표가 얼지 않았을 때만 지운다. 표시가 남아 있으면 보기 화면이 경고한다.
--   · 문제지 UPDATE 감사 트리거를 단다(누가 고쳤나 — updated_by). 항목 바꾸기는 RPC 가 감사 행을 직접 쓴다
--     (뺀 항목의 스냅샷은 여기에만 남는다).
--
-- ⚠️ 이 파일이 exam.create_problem_paper 의 **새 정식 정의**다(sql/17 → 23 → 34 → 35 → 54 → 68 → 여기).
--    스냅샷·출처 라벨·설정 조립을 헬퍼로 뺐다 — 만들기와 고치기가 **같은 함수**로 굳힌다. 실행 로직·검사·오류
--    문구는 sql/68 그대로이고, 아래 검증이 헬퍼 결과를 sql/68 의 식과 표본 대조한다. sql/68 을 다시 돌려도
--    결과는 같지만(인라인 식) 헬퍼와 두 벌이 되므로 이 파일을 뒤이어 돌릴 것.
-- ⚠️ 원장 이메일 리터럴 자리가 하나 는다(exam.is_owner_email) — src/lib/constants.ts ADMIN_EMAIL · sql/03 · 57 · 65 · 76 · 84 · 103.
-- 멱등: CREATE OR REPLACE · IF NOT EXISTS · DROP TRIGGER IF EXISTS. 파괴적 문 없음.
-- run-sql.js 는 파일 전체를 한 트랜잭션으로 보낸다 — 아래 검증이 실패하면 통째로 되돌아간다.
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problem_papers') IS NULL OR to_regclass('exam.book_chapters') IS NULL THEN
    RAISE EXCEPTION 'exam.problem_papers / exam.book_chapters 가 없다 (현재 DB: %) — 공유 프로젝트에서 실행할 것', current_database();
  END IF;
  IF to_regproc('exam.omr_choice_answer_ok') IS NULL THEN
    RAISE EXCEPTION 'sql/54 를 먼저 적용하세요 (exam.omr_choice_answer_ok 가 없다)';
  END IF;
  IF to_regprocedure('public.problem_paper_exam_state(uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Ara-system mig598 을 먼저 적용하세요 (public.problem_paper_exam_state 가 없다)';
  END IF;
  -- 두 단계 재배치(+10000)가 부딪히지 않으려면 지금 자리가 그보다 작아야 한다
  IF EXISTS (SELECT 1 FROM exam.problem_paper_items WHERE order_index >= 10000) THEN
    RAISE EXCEPTION '자리 번호가 10000 이상인 문제지 항목이 있다 — 먼저 살펴볼 것';
  END IF;
END
$guard$;

-- ---------------------------------------------
-- 1. 헬퍼 — 굳히는 식은 여기 한 곳 (만들기·고치기 공용, 브라우저는 못 부른다)
-- ---------------------------------------------

-- 출처 스냅샷 — sql/68 의 'source' 객체 그대로
CREATE OR REPLACE FUNCTION exam.paper_source_snapshot(s exam.problem_sources)
RETURNS JSONB LANGUAGE sql STABLE
SET search_path = exam, pg_temp
AS $$
  SELECT jsonb_build_object(
    'source_type', (s).source_type,
    'title',       (s).title,
    'school_name', (s).school_name,
    'year',        (s).year,
    'grade',       (s).grade,
    -- 2026-09-20(sql/35): 학기. 옛 스냅샷에는 이 키가 없어 앱이 옵셔널로 받는다(`PaperSourceSnapshot.semester?`)
    'semester',    (s).semester,
    'exam_type',   (s).exam_type,
    'publisher',   (s).publisher
  );
$$;

-- 문항 스냅샷 — sql/68 의 jsonb_build_object 그대로. 지문이 없으면(LEFT JOIN 이 비면) passage 는 null
CREATE OR REPLACE FUNCTION exam.paper_item_snapshot(p exam.problems, ps exam.passages, s exam.problem_sources)
RETURNS JSONB LANGUAGE sql STABLE
SET search_path = exam, pg_temp
AS $$
  SELECT jsonb_build_object(
    'number',           (p).number,
    'question_type',    (p).question_type,
    'stem_html',        (p).stem_html,
    'choices',          (p).choices,
    'answer',           (p).answer,
    'score',            (p).score,
    'explanation_html', (p).explanation_html,
    'area_path',        to_jsonb((p).area_path),
    'work_title',       (p).work_title,
    -- 2026-10-11(sql/68): 이 문항이 묻는 작품 목록 — 인쇄에서 묻지 않는 (가)(나) 구역을 뺀다
    'work_titles',      to_jsonb((p).work_titles),
    'render_mode',      (p).render_mode,
    'image_path',       (p).image_path,
    'figure_paths',     to_jsonb((p).figure_paths),
    'passage', CASE WHEN (ps).id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',           (ps).id,
      'label',        (ps).label,
      'title',        (ps).title,
      'author',       (ps).author,
      'html',         (ps).html,
      'render_mode',  (ps).render_mode,
      'image_path',   (ps).image_path,
      'figure_paths', to_jsonb((ps).figure_paths),
      'works',        (ps).works
    ) END,
    'source', exam.paper_source_snapshot(s)
  );
$$;

-- 출처 한 줄 — 출처 스냅샷(jsonb)에서 만든다. 옛 스냅샷에 'semester' 키가 없으면 ->> 가 null 이라 concat_ws 가 건너뛴다
CREATE OR REPLACE FUNCTION exam.paper_source_label(src JSONB)
RETURNS TEXT LANGUAGE sql IMMUTABLE
SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(btrim(concat_ws(' ',
      NULLIF(src ->> 'year', ''), NULLIF(src ->> 'grade', ''),
      NULLIF(src ->> 'school_name', ''), NULLIF(src ->> 'semester', ''),
      NULLIF(src ->> 'exam_type', ''))), ''),
    src ->> 'title');
$$;

-- 인쇄 설정 허용 목록 — sql/68 그대로(앱 normalizePaperSettings 와 1:1 거울)
CREATE OR REPLACE FUNCTION exam.paper_settings_normalized(p_settings JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE
SET search_path = exam, pg_temp
AS $$
  SELECT jsonb_build_object(
    'columns',    CASE WHEN p_settings ->> 'columns' = '1' THEN 1 ELSE 2 END,
    'showScore',  CASE WHEN p_settings ->> 'showScore' = 'false' THEN false ELSE true END,
    'showSource', CASE WHEN jsonb_typeof(p_settings -> 'showSource') = 'boolean'
                       THEN (p_settings -> 'showSource')::boolean ELSE true END,
    'omr',        CASE WHEN jsonb_typeof(p_settings -> 'omr') = 'boolean'
                       THEN (p_settings -> 'omr')::boolean ELSE false END
  );
$$;

-- 원장인가 — JWT 이메일 리터럴(sql/57·76·84 와 같은 판단, ara-system 의 is_director() 에 매달지 않는다)
-- ⚠️ 리터럴은 src/lib/constants.ts ADMIN_EMAIL 과 같아야 한다(paper-edit-policy.test.ts 가 대조한다)
CREATE OR REPLACE FUNCTION exam.is_owner_email()
RETURNS BOOLEAN LANGUAGE sql STABLE
SET search_path = exam, pg_temp
AS $$
  SELECT (select auth.role()) = 'authenticated'
     AND (select exam.is_allowed_domain())
     AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr';
$$;

-- 지금 사람이 이 문제지를 고칠 수 있는가(채점 여부 빼고) — null 이면 된다, 아니면 'not_owner' · 'in_book'
-- ⚠️ DEFINER 함수 안에서만 부른다 — 선생님은 book_chapters 를 RLS 로 못 읽는다
CREATE OR REPLACE FUNCTION exam.paper_edit_access(p_user_id UUID, p_paper_id UUID)
RETURNS TEXT LANGUAGE sql STABLE
SET search_path = exam, pg_temp
AS $$
  SELECT CASE
    WHEN exam.is_owner_email() THEN NULL
    WHEN auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN 'not_owner'
    WHEN EXISTS (SELECT 1 FROM exam.book_chapters c WHERE c.paper_id = p_paper_id) THEN 'in_book'
    ELSE NULL
  END;
$$;

-- OMR 문제지가 채점됐는가 — null 이면 고쳐도 된다, 'graded' · 'grade_check_failed' 면 안 된다.
-- ⚠️ 계약 함수가 없거나 실패하거나 모르는 값을 주면 **닫는다**. p_lock 이면 OMR 저장과 같은 잠금을 트랜잭션 끝까지 잡는다
--    (예외 블록이 정상으로 끝나면 하위 트랜잭션이 잡은 자문 잠금은 바깥 트랜잭션으로 넘어간다).
CREATE OR REPLACE FUNCTION exam.paper_grade_block(p_paper_id UUID, p_lock BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql VOLATILE
SET search_path = exam, pg_temp
AS $$
DECLARE
  v_state TEXT;
BEGIN
  BEGIN
    v_state := public.problem_paper_exam_state(p_paper_id, p_lock);
  EXCEPTION WHEN OTHERS THEN
    RETURN 'grade_check_failed';
  END;
  IF v_state IN ('unregistered', 'open') THEN RETURN NULL; END IF;
  IF v_state = 'graded' THEN RETURN 'graded'; END IF;
  RETURN 'grade_check_failed';
END;
$$;

-- 고친 뒤 순서대로의 행 — 남긴 항목은 스냅샷에서, 새 문항은 원본에서 읽는다(연속성·OMR 검사 공용)
CREATE OR REPLACE FUNCTION exam.paper_entry_rows(p_paper_id UUID, p_item_ids UUID[], p_new_ids UUID[])
RETURNS TABLE (ord BIGINT, passage_key TEXT, question_type TEXT, answer TEXT, choices JSONB)
LANGUAGE sql STABLE
SET search_path = exam, pg_temp
AS $$
  SELECT u.ord,
         CASE WHEN u.item_id IS NOT NULL THEN i.snapshot -> 'passage' ->> 'id' ELSE p.passage_id::text END,
         CASE WHEN u.item_id IS NOT NULL THEN i.snapshot ->> 'question_type' ELSE p.question_type END,
         CASE WHEN u.item_id IS NOT NULL THEN i.snapshot ->> 'answer' ELSE p.answer END,
         CASE WHEN u.item_id IS NOT NULL THEN i.snapshot -> 'choices' ELSE p.choices END
    FROM unnest(p_item_ids, p_new_ids) WITH ORDINALITY AS u(item_id, problem_id, ord)
    LEFT JOIN exam.problem_paper_items i ON i.id = u.item_id AND i.paper_id = p_paper_id
    LEFT JOIN exam.problems p            ON p.id = u.problem_id;
$$;

DO $revoke_helpers$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'exam.paper_source_snapshot(exam.problem_sources)',
    'exam.paper_item_snapshot(exam.problems, exam.passages, exam.problem_sources)',
    'exam.paper_source_label(jsonb)',
    'exam.paper_settings_normalized(jsonb)',
    'exam.is_owner_email()',
    'exam.paper_edit_access(uuid, uuid)',
    'exam.paper_grade_block(uuid, boolean)',
    'exam.paper_entry_rows(uuid, uuid[], uuid[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$revoke_helpers$;

-- ---------------------------------------------
-- 2. 반영 대기 표시 — OMR 문제지를 고쳤는데 성적 시스템 정답표가 아직 옛것일 수 있다
-- ---------------------------------------------
-- 브라우저는 읽지도 쓰지도 않는다 — 고치기 RPC 가 쓰고, 상태 RPC 가 읽고, 발신 라우트(service_role)가 지운다.
CREATE TABLE IF NOT EXISTS exam.problem_paper_sync_pending (
  paper_id  UUID PRIMARY KEY REFERENCES exam.problem_papers(id) ON DELETE CASCADE,
  -- 이 시각(= 고친 뒤 문제지 updated_at) 이후의 문제지로 등록에 성공해야 지운다
  edited_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE exam.problem_paper_sync_pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exam.problem_paper_sync_pending FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON exam.problem_paper_sync_pending TO service_role;
COMMENT ON TABLE exam.problem_paper_sync_pending IS
  'OMR 문제지를 고친 뒤 성적 시스템 정답표 재등록을 기다리는 표시(sql/103). 발신 라우트가 등록 성공·비동결이면 지운다.';

-- ---------------------------------------------
-- 3. 문제지 UPDATE 감사 — 범용 함수가 updated_by 를 채운다
-- ---------------------------------------------
-- 차례: aa_lock_user_id_… → audit_… → problem_papers_updated_at (이름 순). 감사의 new_data.updated_at 은 올리기 전 값이다
-- (problem_sources 와 같다).
DROP TRIGGER IF EXISTS audit_problem_papers_update ON exam.problem_papers;
CREATE TRIGGER audit_problem_papers_update BEFORE UPDATE ON exam.problem_papers
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

-- ---------------------------------------------
-- 4. 만들기 — 서명·검사·문구는 sql/68 그대로, 굳히는 식만 헬퍼로
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.create_problem_paper(
  p_title       TEXT,
  p_problem_ids UUID[],
  p_settings    JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_paper_id  UUID;
  v_count     INT;
  v_found     INT;
  v_broken    INT;
  v_settings  JSONB;
BEGIN
  IF NOT exam.is_allowed_domain() THEN
    RAISE EXCEPTION '허용되지 않은 계정입니다' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION '문제지 제목이 필요합니다' USING ERRCODE = 'check_violation';
  END IF;

  v_count := COALESCE(cardinality(p_problem_ids), 0);
  IF v_count < 1 OR v_count > 200 THEN
    RAISE EXCEPTION '문항은 1~200개여야 합니다 (요청: %)', v_count USING ERRCODE = 'check_violation';
  END IF;

  IF v_count <> (SELECT COUNT(DISTINCT x) FROM unnest(p_problem_ids) AS x) THEN
    RAISE EXCEPTION '같은 문항이 두 번 들어 있습니다' USING ERRCODE = 'check_violation';
  END IF;

  -- ⚠️ 검사 전에 잠근다(sql/68 의 까닭 그대로 — 검사와 스냅샷 INSERT 가 같은 상태를 봐야 한다)
  PERFORM 1 FROM exam.problems WHERE id = ANY (p_problem_ids) FOR UPDATE;

  SELECT COUNT(*) INTO v_found FROM exam.problems WHERE id = ANY (p_problem_ids);
  IF v_found <> v_count THEN
    RAISE EXCEPTION '존재하지 않는 문항이 있습니다 (%/%)', v_found, v_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 지문 연속성(gaps-and-islands)
  WITH joined AS (
    SELECT t.ord, p.passage_id
      FROM unnest(p_problem_ids) WITH ORDINALITY AS t(pid, ord)
      JOIN exam.problems p ON p.id = t.pid
     WHERE p.passage_id IS NOT NULL
  ), islands AS (
    SELECT passage_id,
           ord - ROW_NUMBER() OVER (PARTITION BY passage_id ORDER BY ord) AS island
      FROM joined
  )
  SELECT COUNT(*) INTO v_broken
    FROM (SELECT passage_id FROM islands GROUP BY passage_id HAVING COUNT(DISTINCT island) > 1) x;

  IF v_broken > 0 THEN
    RAISE EXCEPTION '같은 지문의 문항이 떨어져 있습니다 (지문 %개)', v_broken
      USING ERRCODE = 'check_violation';
  END IF;

  v_settings := exam.paper_settings_normalized(p_settings);

  -- OMR 을 켰으면 굳히기 전에 정답 모양을 본다 — 번호는 문제지 안의 자리(ord)
  IF (v_settings ->> 'omr')::boolean THEN
    DECLARE
      v_objective INT;
      v_bad       TEXT;
    BEGIN
      SELECT COUNT(*) FILTER (WHERE p.question_type = '객관식'),
             string_agg(t.ord::text || '번', ', ' ORDER BY t.ord) FILTER (
               WHERE p.question_type = '객관식'
                 AND NOT exam.omr_choice_answer_ok(
                   p.answer,
                   CASE WHEN jsonb_typeof(p.choices) = 'array' THEN jsonb_array_length(p.choices) ELSE 0 END))
        INTO v_objective, v_bad
        FROM unnest(p_problem_ids) WITH ORDINALITY AS t(pid, ord)
        JOIN exam.problems p ON p.id = t.pid;
      IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'OMR 로 채점할 수 없는 정답이 있어요 (%) — 객관식 정답은 ①~⑤ 번호여야 해요', v_bad
          USING ERRCODE = 'check_violation';
      END IF;
      IF v_objective = 0 THEN
        RAISE EXCEPTION '객관식 문항이 없어 OMR 로 채점할 수 없어요' USING ERRCODE = 'check_violation';
      END IF;
    END;
  END IF;

  INSERT INTO exam.problem_papers (title, settings, total_questions, source_labels, user_id)
  SELECT
    btrim(p_title),
    v_settings,
    v_count,
    COALESCE(ARRAY(
      SELECT DISTINCT exam.paper_source_label(exam.paper_source_snapshot(s))
        FROM exam.problems p
        JOIN exam.problem_sources s ON s.id = p.source_id
       WHERE p.id = ANY (p_problem_ids)
       ORDER BY 1
    ), '{}'),
    -- user_id 는 aa_enforce_user_id 트리거가 auth.uid() 로 덮어쓴다(자리만 채운다)
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  RETURNING id INTO v_paper_id;

  -- 본문 스냅샷 — 원본이 바뀌거나 지워져도 이 문제지는 그대로다
  INSERT INTO exam.problem_paper_items (paper_id, order_index, problem_id, passage_id, snapshot)
  SELECT v_paper_id, (t.ord - 1)::INT, p.id, p.passage_id, exam.paper_item_snapshot(p, ps, s)
    FROM unnest(p_problem_ids) WITH ORDINALITY AS t(pid, ord)
    JOIN exam.problems p              ON p.id = t.pid
    JOIN exam.problem_sources s       ON s.id = p.source_id
    LEFT JOIN exam.passages ps        ON ps.id = p.passage_id;

  RETURN v_paper_id;
END;
$$;

REVOKE ALL ON FUNCTION exam.create_problem_paper(TEXT, UUID[], JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.create_problem_paper(TEXT, UUID[], JSONB) TO authenticated, service_role;

-- ---------------------------------------------
-- 5. 고치기
-- ---------------------------------------------
-- p_entries: 고친 뒤 차례대로 [{"item": <기존 항목 id>} | {"problem": <문항 id>}, …]
--   item    = 그 항목을 그대로 둔다(스냅샷·id·problem_id 유지 — '다른 문제지에 담긴 문항 빼기'(sql/97)가 problem_id 를 본다)
--   problem = 지금 원본으로 새로 굳힌다
-- p_title · p_settings 가 null 이면 그대로 둔다. settings 는 columns · showSource 만 받는다(omr · showScore 는 저장값 유지 —
-- OMR 은 만들 때만 정한다).
-- 거절은 SQLSTATE + HINT 토큰으로 가른다(앱 src/lib/problem-paper/paper-edit.ts 가 HINT 로 문구를 고른다):
--   42501 not_owner · in_book / 55000 graded · grade_check_failed / P0001 conflict / P0002 missing / 23514 내용 검사
CREATE OR REPLACE FUNCTION exam.update_problem_paper(
  p_paper_id          UUID,
  p_expect_updated_at TIMESTAMPTZ,
  p_title             TEXT,
  p_entries           JSONB,
  p_settings          JSONB DEFAULT NULL
) RETURNS JSONB
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_paper        exam.problem_papers%ROWTYPE;
  v_block        TEXT;
  v_title        TEXT;
  v_count        INT;
  v_item_ids     UUID[];
  v_new_ids      UUID[];
  v_keep         UUID[];
  v_fresh        UUID[];
  v_found        INT;
  v_broken       INT;
  v_old_settings JSONB;
  v_settings     JSONB;
  v_objective    INT;
  v_bad          TEXT;
  v_before       JSONB;
  v_removed      JSONB;
  v_changed      JSONB;
  v_updated      TIMESTAMPTZ;
  v_check        RECORD;
BEGIN
  IF NOT exam.is_allowed_domain() OR v_uid IS NULL THEN
    RAISE EXCEPTION '허용되지 않은 계정입니다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_paper_id IS NULL THEN
    RAISE EXCEPTION '문제지를 찾지 못했어요' USING ERRCODE = 'P0002', HINT = 'missing';
  END IF;

  -- ⚠️ FOR UPDATE(FOR NO KEY UPDATE 아님) — 책에 장으로 담는 INSERT 의 FK 잠금(KEY SHARE)과도 줄을 서서
  --    '책에 담김' 판정과 엇갈리지 않는다
  SELECT * INTO v_paper FROM exam.problem_papers WHERE id = p_paper_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '문제지를 찾지 못했어요 — 지워졌을 수 있어요' USING ERRCODE = 'P0002', HINT = 'missing';
  END IF;

  v_block := exam.paper_edit_access(v_paper.user_id, v_paper.id);
  IF v_block = 'not_owner' THEN
    RAISE EXCEPTION '이 문제지를 만든 선생님과 원장님만 고칠 수 있어요' USING ERRCODE = '42501', HINT = 'not_owner';
  ELSIF v_block = 'in_book' THEN
    RAISE EXCEPTION '책에 담긴 문제지라 원장님만 고칠 수 있어요' USING ERRCODE = '42501', HINT = 'in_book';
  ELSIF v_block IS NOT NULL THEN
    RAISE EXCEPTION '고칠 수 없는 문제지예요' USING ERRCODE = '42501', HINT = v_block;
  END IF;

  -- 낙관적 잠금 — 앱은 문제지 행을 **항목보다 먼저** 읽어 그 updated_at 을 보낸다
  IF p_expect_updated_at IS NULL OR v_paper.updated_at IS DISTINCT FROM p_expect_updated_at THEN
    RAISE EXCEPTION '다른 곳에서 이 문제지가 바뀌었어요 — 저장된 것을 다시 불러와 주세요'
      USING ERRCODE = 'P0001', HINT = 'conflict';
  END IF;

  IF p_title IS NOT NULL AND btrim(p_title) = '' THEN
    RAISE EXCEPTION '문제지 제목이 필요합니다' USING ERRCODE = 'check_violation';
  END IF;
  v_title := COALESCE(btrim(p_title), v_paper.title);

  -- 항목 모양 — 캐스트보다 먼저 본다(22P02 대신 check_violation). CASE 는 차례대로 평가된다
  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION '문항 목록이 올바르지 않습니다' USING ERRCODE = 'check_violation';
  END IF;
  v_count := jsonb_array_length(p_entries);
  IF v_count < 1 OR v_count > 200 THEN
    RAISE EXCEPTION '문항은 1~200개여야 합니다 (요청: %)', v_count USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_entries) AS e(v)
     WHERE CASE
             WHEN jsonb_typeof(e.v) <> 'object' THEN true
             WHEN (SELECT count(*) FROM jsonb_object_keys(e.v)) <> 1 THEN true
             WHEN NOT (e.v ? 'item' OR e.v ? 'problem') THEN true
             WHEN jsonb_typeof(COALESCE(e.v -> 'item', e.v -> 'problem')) <> 'string' THEN true
             WHEN COALESCE(e.v ->> 'item', e.v ->> 'problem')
                  !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN true
             ELSE false
           END
  ) THEN
    RAISE EXCEPTION '문항 목록 모양이 올바르지 않습니다' USING ERRCODE = 'check_violation';
  END IF;

  SELECT array_agg(CASE WHEN e.v ? 'item'    THEN (e.v ->> 'item')::uuid    END ORDER BY e.ord),
         array_agg(CASE WHEN e.v ? 'problem' THEN (e.v ->> 'problem')::uuid END ORDER BY e.ord)
    INTO v_item_ids, v_new_ids
    FROM jsonb_array_elements(p_entries) WITH ORDINALITY AS e(v, ord);
  v_keep  := array_remove(v_item_ids, NULL);
  v_fresh := array_remove(v_new_ids, NULL);

  IF cardinality(v_keep) <> (SELECT count(DISTINCT x) FROM unnest(v_keep) AS x) THEN
    RAISE EXCEPTION '같은 항목이 두 번 들어 있습니다' USING ERRCODE = 'check_violation';
  END IF;
  IF cardinality(v_fresh) <> (SELECT count(DISTINCT x) FROM unnest(v_fresh) AS x) THEN
    RAISE EXCEPTION '같은 문항이 두 번 들어 있습니다' USING ERRCODE = 'check_violation';
  END IF;

  -- 남기는 항목은 이 문제지 것이어야 한다(문제지 행 잠금 아래라 항목은 이 함수만 바꾼다)
  SELECT count(*) INTO v_found FROM exam.problem_paper_items
   WHERE paper_id = p_paper_id AND id = ANY (v_keep);
  IF v_found <> cardinality(v_keep) THEN
    RAISE EXCEPTION '이 문제지에 없는 항목이 있습니다' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_paper_items WHERE paper_id = p_paper_id AND order_index >= 10000) THEN
    RAISE EXCEPTION '문제지 항목 자리 번호가 올바르지 않습니다' USING ERRCODE = 'check_violation';
  END IF;

  -- 새 문항 — 검사 전에 잠근다(create 와 같은 까닭). id 차례로 잠가 교착을 피한다
  IF cardinality(v_fresh) > 0 THEN
    PERFORM 1 FROM exam.problems WHERE id = ANY (v_fresh) ORDER BY id FOR UPDATE;
    SELECT count(*) INTO v_found FROM exam.problems WHERE id = ANY (v_fresh);
    IF v_found <> cardinality(v_fresh) THEN
      RAISE EXCEPTION '존재하지 않는 문항이 있습니다 (%/%)', v_found, cardinality(v_fresh)
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    -- 남긴 항목과 같은 문항을 또 담을 수 없다(빠지는 항목과 같은 문항을 새로 담는 것은 된다 — 그 문항만 새로 굳힌다)
    IF EXISTS (SELECT 1 FROM exam.problem_paper_items
                WHERE paper_id = p_paper_id AND id = ANY (v_keep) AND problem_id = ANY (v_fresh)) THEN
      RAISE EXCEPTION '같은 문항이 두 번 들어 있습니다' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 지문 연속성 — 남긴 것은 **스냅샷의 지문 id**(인쇄가 묶는 기준), 새 것은 지금 원본 passage_id
  SELECT count(*) INTO v_broken FROM (
    SELECT passage_key FROM (
      SELECT r.passage_key, r.ord - ROW_NUMBER() OVER (PARTITION BY r.passage_key ORDER BY r.ord) AS island
        FROM exam.paper_entry_rows(p_paper_id, v_item_ids, v_new_ids) r
       WHERE r.passage_key IS NOT NULL
    ) t GROUP BY passage_key HAVING count(DISTINCT island) > 1
  ) x;
  IF v_broken > 0 THEN
    RAISE EXCEPTION '같은 지문의 문항이 떨어져 있습니다 (지문 %개)', v_broken USING ERRCODE = 'check_violation';
  END IF;

  -- 설정 — omr · showScore 는 저장값 그대로
  v_old_settings := exam.paper_settings_normalized(v_paper.settings);
  v_settings := CASE WHEN p_settings IS NULL THEN v_old_settings ELSE exam.paper_settings_normalized(p_settings) END
                || jsonb_build_object('omr', v_old_settings -> 'omr', 'showScore', v_old_settings -> 'showScore');

  IF (v_settings ->> 'omr')::boolean THEN
    SELECT count(*) FILTER (WHERE r.question_type = '객관식'),
           string_agg(r.ord::text || '번', ', ' ORDER BY r.ord) FILTER (
             WHERE r.question_type = '객관식'
               AND NOT exam.omr_choice_answer_ok(
                 r.answer,
                 CASE WHEN jsonb_typeof(r.choices) = 'array' THEN jsonb_array_length(r.choices) ELSE 0 END))
      INTO v_objective, v_bad
      FROM exam.paper_entry_rows(p_paper_id, v_item_ids, v_new_ids) r;
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'OMR 로 채점할 수 없는 정답이 있어요 (%) — 객관식 정답은 ①~⑤ 번호여야 해요', v_bad
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_objective = 0 THEN
      RAISE EXCEPTION '객관식 문항이 없어 OMR 로 채점할 수 없어요' USING ERRCODE = 'check_violation';
    END IF;

    -- 채점 여부 — OMR 저장과 같은 잠금을 잡은 채 판정한다(이 트랜잭션이 끝날 때까지 채점이 끼어들지 못한다)
    v_block := exam.paper_grade_block(p_paper_id, true);
    IF v_block = 'graded' THEN
      RAISE EXCEPTION '이미 OMR 로 채점한 시험이라 고칠 수 없어요' USING ERRCODE = '55000', HINT = 'graded';
    ELSIF v_block IS NOT NULL THEN
      RAISE EXCEPTION '채점했는지 확인하지 못해 지금은 고칠 수 없어요 — 잠시 뒤 다시 해 주세요'
        USING ERRCODE = '55000', HINT = 'grade_check_failed';
    END IF;
  END IF;

  -- ── 여기부터 쓰기 ──
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', i.id, 'problem_id', i.problem_id, 'order_index', i.order_index)
                            ORDER BY i.order_index), '[]'::jsonb),
         COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.order_index) FILTER (WHERE NOT (i.id = ANY (v_keep))), '[]'::jsonb)
    INTO v_before, v_removed
    FROM exam.problem_paper_items i WHERE i.paper_id = p_paper_id;

  DELETE FROM exam.problem_paper_items WHERE paper_id = p_paper_id AND NOT (id = ANY (v_keep));

  -- 두 단계 재배치 — (paper_id, order_index) 유니크가 지연 불가라 행마다 검사된다. 음수는 CHECK 가 막아 위쪽 대역을 쓴다
  UPDATE exam.problem_paper_items SET order_index = order_index + 10000 WHERE paper_id = p_paper_id;
  UPDATE exam.problem_paper_items i SET order_index = (u.ord - 1)::int
    FROM unnest(v_item_ids) WITH ORDINALITY AS u(item_id, ord)
   WHERE u.item_id IS NOT NULL AND i.id = u.item_id AND i.paper_id = p_paper_id;

  -- 같은 지문의 남긴 항목이 있으면 그 지문 판을 물려받는다 — 지금 원본과 다른 자리는 번호로 알린다
  SELECT COALESCE(jsonb_agg(u.ord ORDER BY u.ord), '[]'::jsonb) INTO v_changed
    FROM unnest(v_new_ids) WITH ORDINALITY AS u(problem_id, ord)
    JOIN exam.problems p        ON p.id = u.problem_id
    JOIN exam.problem_sources s ON s.id = p.source_id
    JOIN exam.passages ps       ON ps.id = p.passage_id
    JOIN LATERAL (
      SELECT k.snapshot -> 'passage' AS passage
        FROM exam.problem_paper_items k
       WHERE k.paper_id = p_paper_id AND k.snapshot -> 'passage' ->> 'id' = p.passage_id::text
       ORDER BY k.order_index LIMIT 1
    ) g ON true
   WHERE g.passage IS DISTINCT FROM exam.paper_item_snapshot(p, ps, s) -> 'passage';

  INSERT INTO exam.problem_paper_items (paper_id, order_index, problem_id, passage_id, snapshot)
  SELECT p_paper_id, (u.ord - 1)::int, p.id, p.passage_id,
         CASE WHEN g.passage IS NOT NULL
              THEN jsonb_set(exam.paper_item_snapshot(p, ps, s), '{passage}', g.passage)
              ELSE exam.paper_item_snapshot(p, ps, s) END
    FROM unnest(v_new_ids) WITH ORDINALITY AS u(problem_id, ord)
    JOIN exam.problems p        ON p.id = u.problem_id
    JOIN exam.problem_sources s ON s.id = p.source_id
    LEFT JOIN exam.passages ps  ON ps.id = p.passage_id
    LEFT JOIN LATERAL (
      SELECT k.snapshot -> 'passage' AS passage
        FROM exam.problem_paper_items k
       WHERE k.paper_id = p_paper_id AND k.snapshot -> 'passage' ->> 'id' = p.passage_id::text
       ORDER BY k.order_index LIMIT 1
    ) g ON p.passage_id IS NOT NULL;

  SELECT count(*) AS n, min(order_index) AS lo, max(order_index) AS hi INTO v_check
    FROM exam.problem_paper_items WHERE paper_id = p_paper_id;
  IF v_check.n <> v_count OR v_check.lo <> 0 OR v_check.hi <> v_count - 1 THEN
    RAISE EXCEPTION '문제지 항목 재배치가 어긋났다 (개수 %/%, 자리 %~%)', v_check.n, v_count, v_check.lo, v_check.hi;
  END IF;

  -- 문제지 행은 **반드시 한 번** 고친다 — 순서만 바꿔도 updated_at(버전)이 올라야 다른 탭이 충돌로 잡힌다
  UPDATE exam.problem_papers SET
    title           = v_title,
    settings        = v_settings,
    total_questions = v_count,
    -- 출처 줄은 **스냅샷**에서 — 원본이 지워진 항목도 남고, 남긴 항목의 출처가 그 뒤 고쳐져도 인쇄되는 값과 같다
    source_labels   = COALESCE(ARRAY(
                        SELECT DISTINCT exam.paper_source_label(i.snapshot -> 'source')
                          FROM exam.problem_paper_items i
                         WHERE i.paper_id = p_paper_id
                         ORDER BY 1), '{}')
  WHERE id = p_paper_id
  RETURNING updated_at INTO v_updated;

  -- 항목 바꾸기 감사 — 뺀 항목의 스냅샷은 여기에만 남는다
  INSERT INTO exam.audit_log (table_name, record_id, action, actor_id, actor_email, old_data, new_data)
  VALUES (
    'problem_paper_items', p_paper_id, 'UPDATE', v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    jsonb_build_object('order', v_before, 'removed', v_removed),
    jsonb_build_object('order', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', i.id, 'problem_id', i.problem_id, 'order_index', i.order_index)
                                ORDER BY i.order_index), '[]'::jsonb)
        FROM exam.problem_paper_items i WHERE i.paper_id = p_paper_id))
  );

  -- 이 문제지를 담은 책은 쪽 수를 다시 재야 한다(책 구성 지문은 문항 내용을 모른다)
  UPDATE exam.books b SET page_counts = '{}'::jsonb
   WHERE b.page_counts <> '{}'::jsonb
     AND EXISTS (SELECT 1 FROM exam.book_chapters c WHERE c.book_id = b.id AND c.paper_id = p_paper_id);

  -- OMR — 성적 시스템 정답표가 새것으로 바뀔 때까지 표시를 남긴다(발신 라우트가 지운다)
  IF (v_settings ->> 'omr')::boolean THEN
    INSERT INTO exam.problem_paper_sync_pending (paper_id, edited_at) VALUES (p_paper_id, v_updated)
    ON CONFLICT (paper_id) DO UPDATE SET edited_at = EXCLUDED.edited_at;
  END IF;

  RETURN jsonb_build_object(
    'updated_at',      v_updated,
    'total_questions', v_count,
    'passage_changed', v_changed
  );
END;
$$;

REVOKE ALL ON FUNCTION exam.update_problem_paper(UUID, TIMESTAMPTZ, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.update_problem_paper(UUID, TIMESTAMPTZ, TEXT, JSONB, JSONB) TO authenticated, service_role;

-- ---------------------------------------------
-- 6. 고칠 수 있는가 — 보기·목록 화면이 '수정' 단추와 막힌 까닭을 그린다
-- ---------------------------------------------
-- 돌려주는 모양: { "<문제지 id>": { "reason": null | 'not_owner' | 'in_book' | 'graded' | 'grade_check_failed',
--                                 "in_book": bool, "pending": bool, "workbook": bool }, … }   (없는 id 는 빠진다)
-- workbook = 평가문제집 문항이 들어 있다 — 그런 문제지는 평가문제집이 보이는 책 쪽 고치기 화면으로 연다(문제 은행 쪽은 숨긴다)
-- VOLATILE(계약 함수가 VOLATILE) — 앱은 POST 로 부른다(supabase .rpc() 기본값).
CREATE OR REPLACE FUNCTION exam.problem_paper_edit_states(p_paper_ids UUID[])
RETURNS JSONB
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
DECLARE
  r        RECORD;
  v_reason TEXT;
  v_out    JSONB := '{}'::jsonb;
BEGIN
  IF NOT exam.is_allowed_domain() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION '허용되지 않은 계정입니다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF COALESCE(cardinality(p_paper_ids), 0) > 200 THEN
    RAISE EXCEPTION '한 번에 200장까지 물을 수 있어요' USING ERRCODE = 'check_violation';
  END IF;

  FOR r IN SELECT p.id, p.user_id, p.settings FROM exam.problem_papers p WHERE p.id = ANY (p_paper_ids) LOOP
    v_reason := exam.paper_edit_access(r.user_id, r.id);
    IF v_reason IS NULL AND (exam.paper_settings_normalized(r.settings) ->> 'omr')::boolean THEN
      v_reason := exam.paper_grade_block(r.id, false);
    END IF;
    v_out := v_out || jsonb_build_object(r.id::text, jsonb_build_object(
      'reason',  v_reason,
      'in_book', EXISTS (SELECT 1 FROM exam.book_chapters c WHERE c.paper_id = r.id),
      'pending', EXISTS (SELECT 1 FROM exam.problem_paper_sync_pending s WHERE s.paper_id = r.id),
      'workbook', EXISTS (SELECT 1 FROM exam.problem_paper_items i
                           WHERE i.paper_id = r.id AND i.snapshot -> 'source' ->> 'source_type' = '평가문제집')
    ));
  END LOOP;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION exam.problem_paper_edit_states(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.problem_paper_edit_states(UUID[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 ① 헬퍼가 sql/68 의 식과 같은가 — 표본 문항·전체 출처로 대조
-- ---------------------------------------------
-- ⚠️ 아래 인라인 식은 sql/68 의 본문을 **글자 그대로** 옮긴 것이다(대조의 기준). 헬퍼를 고치면 이 식은 고치지 말 것.
DO $verify_same$
DECLARE
  v_n        INT;
  v_bad      INT;
  v_lbl_n    INT;
  v_lbl_bad  INT;
  v_set_bad  INT;
BEGIN
  WITH sample AS (
    (SELECT p.id FROM exam.problems p WHERE p.passage_id IS NOT NULL ORDER BY md5(p.id::text) LIMIT 400)
    UNION ALL
    (SELECT p.id FROM exam.problems p WHERE p.passage_id IS NULL ORDER BY md5(p.id::text) LIMIT 200)
  ), both_ AS (
    SELECT exam.paper_item_snapshot(p, ps, s) AS helper,
      jsonb_build_object(
        'number',           p.number,
        'question_type',    p.question_type,
        'stem_html',        p.stem_html,
        'choices',          p.choices,
        'answer',           p.answer,
        'score',            p.score,
        'explanation_html', p.explanation_html,
        'area_path',        to_jsonb(p.area_path),
        'work_title',       p.work_title,
        'work_titles',      to_jsonb(p.work_titles),
        'render_mode',      p.render_mode,
        'image_path',       p.image_path,
        'figure_paths',     to_jsonb(p.figure_paths),
        'passage', CASE WHEN ps.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id',          ps.id,
          'label',       ps.label,
          'title',       ps.title,
          'author',      ps.author,
          'html',        ps.html,
          'render_mode',  ps.render_mode,
          'image_path',   ps.image_path,
          'figure_paths', to_jsonb(ps.figure_paths),
          'works',        ps.works
        ) END,
        'source', jsonb_build_object(
          'source_type', s.source_type,
          'title',       s.title,
          'school_name', s.school_name,
          'year',        s.year,
          'grade',       s.grade,
          'semester',    s.semester,
          'exam_type',   s.exam_type,
          'publisher',   s.publisher
        )
      ) AS inline_
      FROM sample x
      JOIN exam.problems p        ON p.id = x.id
      JOIN exam.problem_sources s ON s.id = p.source_id
      LEFT JOIN exam.passages ps  ON ps.id = p.passage_id
  )
  SELECT count(*), count(*) FILTER (WHERE helper IS DISTINCT FROM inline_) INTO v_n, v_bad FROM both_;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'sql/103: 문항 스냅샷 헬퍼가 sql/68 식과 다르다 (%/%건)', v_bad, v_n;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE exam.paper_source_label(exam.paper_source_snapshot(s)) IS DISTINCT FROM
           COALESCE(
             NULLIF(btrim(concat_ws(' ',
               NULLIF(s.year, ''), NULLIF(s.grade, ''),
               NULLIF(s.school_name, ''), NULLIF(s.semester, ''),
               NULLIF(s.exam_type, ''))), ''),
             s.title))
    INTO v_lbl_n, v_lbl_bad FROM exam.problem_sources s;
  IF v_lbl_bad > 0 THEN
    RAISE EXCEPTION 'sql/103: 출처 라벨 헬퍼가 sql/68 식과 다르다 (%/%건)', v_lbl_bad, v_lbl_n;
  END IF;

  -- 이미 만든 문제지의 저장된 라벨 = 그 항목 스냅샷으로 다시 만든 라벨(고치기가 쓰는 식)
  SELECT count(*) INTO v_bad
    FROM exam.problem_papers pp
   WHERE pp.source_labels IS DISTINCT FROM COALESCE(ARRAY(
           SELECT DISTINCT exam.paper_source_label(i.snapshot -> 'source')
             FROM exam.problem_paper_items i WHERE i.paper_id = pp.id ORDER BY 1), '{}');
  IF v_bad > 0 THEN
    RAISE NOTICE 'sql/103: 저장된 출처 라벨과 스냅샷 라벨이 다른 문제지 %장 — 원본 출처가 그 뒤 고쳐진 경우다(고치면 스냅샷 기준으로 바뀐다)', v_bad;
  END IF;

  -- 설정 허용 목록 = sql/68 의 식(경우 표)
  SELECT count(*) INTO v_set_bad FROM (VALUES
    ('{}'::jsonb, '{"columns":2,"showScore":true,"showSource":true,"omr":false}'::jsonb),
    ('{"columns":1,"showScore":false,"showSource":false,"omr":true}', '{"columns":1,"showScore":false,"showSource":false,"omr":true}'),
    ('{"columns":"1","showSource":"false","omr":"true"}', '{"columns":1,"showScore":true,"showSource":true,"omr":false}'),
    ('{"columns":3,"showSource":0,"omr":1}', '{"columns":2,"showScore":true,"showSource":true,"omr":false}')
  ) AS t(input, expected)
  WHERE exam.paper_settings_normalized(t.input) IS DISTINCT FROM t.expected;
  IF v_set_bad > 0 THEN
    RAISE EXCEPTION 'sql/103: 설정 허용 목록이 계약과 다르다 (%건)', v_set_bad;
  END IF;

  RAISE NOTICE 'sql/103: 문항 스냅샷 %건 · 출처 라벨 %건이 sql/68 식과 같다, 설정 허용 목록 그대로', v_n, v_lbl_n;
END
$verify_same$;

-- ---------------------------------------------
-- 검증 ② 구조 — 표 권한·정책은 그대로(쓰기는 RPC 뿐), 새 함수 권한, 트리거
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_list TEXT;
  f      TEXT;
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'problem_papers') <> 2
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'exam' AND tablename = 'problem_paper_items') <> 1
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'exam'
                 AND tablename IN ('problem_papers', 'problem_paper_items') AND cmd IN ('INSERT', 'UPDATE', 'ALL')) THEN
    SELECT string_agg(tablename || ':' || cmd, ', ') INTO v_list FROM pg_policies
     WHERE schemaname = 'exam' AND tablename IN ('problem_papers', 'problem_paper_items');
    RAISE EXCEPTION 'sql/103: 문제지 표 정책이 바뀌었다: %', v_list;
  END IF;
  -- ⚠️ 표 권한은 exam 기본권한(mig254)으로 authenticated 에 넓게 열려 있다 — 막는 것은 **RLS 에 쓰기 정책이 없다는 것**이다.
  --    그래서 RLS 가 켜져 있는지를 본다(직접 써 보면 막히는지는 verify_problem_paper_edit.sql 이 잰다)
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'exam.problem_papers'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'exam.problem_paper_items'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'exam.problem_paper_sync_pending'::regclass) THEN
    RAISE EXCEPTION 'sql/103: 문제지 표의 RLS 가 꺼져 있다';
  END IF;
  IF has_table_privilege('authenticated', 'exam.problem_paper_sync_pending', 'SELECT')
     OR has_table_privilege('authenticated', 'exam.problem_paper_sync_pending', 'INSERT')
     OR has_table_privilege('authenticated', 'exam.problem_paper_sync_pending', 'DELETE')
     OR has_table_privilege('anon', 'exam.problem_paper_sync_pending', 'SELECT') THEN
    RAISE EXCEPTION 'sql/103: 브라우저가 반영 대기 표에 닿는다';
  END IF;

  FOREACH f IN ARRAY ARRAY[
    'exam.update_problem_paper(uuid, timestamptz, text, jsonb, jsonb)',
    'exam.problem_paper_edit_states(uuid[])',
    'exam.create_problem_paper(text, uuid[], jsonb)'
  ] LOOP
    IF NOT has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'sql/103: % 실행 권한이 어긋났다', f;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'exam.paper_item_snapshot(exam.problems, exam.passages, exam.problem_sources)',
    'exam.paper_edit_access(uuid, uuid)', 'exam.paper_grade_block(uuid, boolean)',
    'exam.is_owner_email()', 'exam.paper_entry_rows(uuid, uuid[], uuid[])'
  ] LOOP
    IF has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'sql/103: 헬퍼 % 가 브라우저에 열려 있다', f;
    END IF;
  END LOOP;

  SELECT string_agg(tgname, ', ' ORDER BY tgname) INTO v_list
    FROM pg_trigger WHERE tgrelid = 'exam.problem_papers'::regclass AND NOT tgisinternal;
  IF v_list IS DISTINCT FROM
     'aa_enforce_user_id_problem_papers_insert, aa_lock_user_id_problem_papers_update, audit_problem_papers_delete, audit_problem_papers_insert, audit_problem_papers_update, problem_papers_updated_at' THEN
    RAISE EXCEPTION 'sql/103: 문제지 트리거가 예상과 다르다: %', v_list;
  END IF;

  RAISE NOTICE 'sql/103 구조: 문제지 표 쓰기 정책 없음(RLS), 반영 대기 표 브라우저 차단, RPC 셋 authenticated 전용, 헬퍼 잠김, 트리거 %', v_list;
END
$verify_shape$;
