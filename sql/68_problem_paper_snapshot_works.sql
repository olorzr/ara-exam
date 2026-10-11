-- ---------------------------------------------------------------
-- 68. 문제지 스냅샷에 작품 목록을 싣는다 — 묻는 작품의 (가)(나) 구역만 인쇄
-- ---------------------------------------------------------------
-- 원장님 요청(2026-10-11): "해당 문학 작품만 있는 문제만 뽑아 쓸 수 있도록" — 사용자 결정으로
-- (가)(나) 복합 지문에서 **한 작품만 묻는 문항**도 남기고, 문제지에서는 **그 작품의 구역만** 인쇄한다.
-- 인쇄는 스냅샷만 보므로 무엇을 묻는지(`problems.work_titles`)와 어느 구역이 어느 작품인지
-- (`passages.works` 의 label)가 스냅샷에 있어야 한다. 지금까지는 둘 다 ' · ' 로 이은 파생 문자열뿐이었다.
--
-- ⚠️ **이 파일이 `exam.create_problem_paper` 의 정식 정의다**(sql/17 → 23 → 34 → 35 → 54 → 여기).
--    sql/54 를 나중에 단독으로 다시 돌리면 두 키가 조용히 빠져 **새 문제지가 지문 전체를 인쇄한다**
--    (오류 없이). 그 파일 머리에 경고를 적었다. 함수를 고칠 때는 번호가 가장 큰 정의를 고칠 것.
-- 바뀐 실행 로직은 없다 — 스냅샷 키 둘(문항 `work_titles`, 지문 `works`)만 더했다. 그 밖에는 sql/54 본문 그대로다.
-- ⚠️ **이미 만든 문제지는 바뀌지 않는다**(스냅샷은 불변이다). 옛 문제지는 키가 없어 앱이 지문을 통째로 인쇄한다.
-- 멱등: CREATE OR REPLACE.
--
-- 적용: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/68_problem_paper_snapshot_works.sql
-- 실호출 검증: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/verify_problem_paper_settings.sql

DO $guard$
BEGIN
  IF to_regnamespace('exam') IS NULL THEN
    RAISE EXCEPTION 'exam 스키마가 없다 — 이 마이그레이션은 공유 프로젝트(ara-system) 전용이다';
  END IF;
  IF to_regproc('exam.omr_choice_answer_ok') IS NULL THEN
    RAISE EXCEPTION 'sql/54 를 먼저 적용하세요 (exam.omr_choice_answer_ok 가 없다)';
  END IF;
END
$guard$;

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

  -- ⚠️ **검사 전에 잠근다.** 기본 격리 수준(READ COMMITTED)에서는 문(statement)마다
  --    다른 스냅샷을 보므로, 검사와 스냅샷 INSERT 사이에 남이 문항을 지우거나 지문을
  --    바꾸면 조용히 어긋난다 — 지워진 문항은 INSERT 에서 빠지는데 total_questions 는
  --    그대로 남고, 지문이 바뀌면 연속성 검사를 통과한 배치가 실제로는 흩어진다.
  --    잠금은 이 트랜잭션이 끝날 때까지 유지되어 아래 조립까지 같은 상태를 본다.
  PERFORM 1 FROM exam.problems WHERE id = ANY (p_problem_ids) FOR UPDATE;

  SELECT COUNT(*) INTO v_found FROM exam.problems WHERE id = ANY (p_problem_ids);
  IF v_found <> v_count THEN
    RAISE EXCEPTION '존재하지 않는 문항이 있습니다 (%/%)', v_found, v_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 지문 연속성: 같은 지문의 문항은 반드시 붙어 있어야 한다.
  -- 흩어지면 인쇄에서 같은 지문이 여러 번 반복되거나 머리글 범위가 거짓말을 한다.
  -- (gaps-and-islands: 지문별로 ord 연속 구간이 2개 이상이면 흩어진 것)
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

  -- 설정은 클라이언트 값을 그대로 담지 않고 화이트리스트로 재조립한다.
  -- 문자열 캐스팅 오류가 나지 않도록 값 비교로만 판정한다.
  v_settings := jsonb_build_object(
    'columns',    CASE WHEN p_settings ->> 'columns' = '1' THEN 1 ELSE 2 END,
    'showScore',  CASE WHEN p_settings ->> 'showScore'  = 'false' THEN false ELSE true END,
    -- 2026-09-19: 기본이 **표시**다. 앱은 늘 키를 실어 보내므로 이 폴백에 닿는 것은
    -- 키를 빠뜨린 직접 호출뿐이고, 그때도 화면 기본값과 같아야 한다.
    -- ⚠️ **불리언일 때만 그 값을 쓴다**(`jsonb_typeof`, 코덱스 3R). `->>` 로 글자만 견주면
    --    JSON **문자열** `"false"` 까지 숨김이 되는데, 앱의 `normalizePaperSettings` 는
    --    불리언이 아닌 값을 전부 기본(표시)으로 친다 — 그 둘은 1:1 거울이어야 한다.
    --    (`showScore` 는 옛 모양 그대로 둔다 — 렌더러가 보지 않는 죽은 키다)
    'showSource', CASE
                    WHEN jsonb_typeof(p_settings -> 'showSource') = 'boolean'
                      THEN (p_settings -> 'showSource')::boolean
                    ELSE true
                  END,
    -- 2026-09-29(sql/54): OMR 채점을 골랐는가. 기본 **꺼짐** — 불리언 true 일 때만 켠다.
    'omr',        CASE
                    WHEN jsonb_typeof(p_settings -> 'omr') = 'boolean'
                      THEN (p_settings -> 'omr')::boolean
                    ELSE false
                  END
  );

  -- OMR 을 켰으면 **굳히기 전에** 정답 모양을 본다 — 불변 문제지가 영영 등록 못 되는 일을 막는다.
  --   번호는 문제지 안의 자리(ord)라 화면·성적 시스템의 번호와 같다
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
      SELECT DISTINCT COALESCE(
        NULLIF(btrim(concat_ws(' ',
          NULLIF(s.year, ''), NULLIF(s.grade, ''),
          NULLIF(s.school_name, ''), NULLIF(s.semester, ''),
          NULLIF(s.exam_type, ''))), ''),
        s.title)
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
  SELECT
    v_paper_id,
    (t.ord - 1)::INT,
    p.id,
    p.passage_id,
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
      -- 2026-10-11(sql/68): 이 문항이 묻는 작품 목록 — 인쇄에서 묻지 않는 (가)(나) 구역을 빼는 데 쓴다.
      -- 옛 스냅샷에는 이 키가 없어 앱이 `work_title` 문자열로 물러선다(`PaperItemSnapshot.work_titles?`)
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
        -- 지문 본문 제자리에 끼울 그림들. 옛 스냅샷에는 이 키가 없어 앱이 `?? []` 로 받는다
        'figure_paths', to_jsonb(ps.figure_paths),
        -- 2026-10-11(sql/68): 작품마다 (가)(나) 구역 표시까지 — 옛 스냅샷에는 없어 인쇄는 지문 전체를 그린다
        'works',        ps.works
      ) END,
      'source', jsonb_build_object(
        'source_type', s.source_type,
        'title',       s.title,
        'school_name', s.school_name,
        'year',        s.year,
        'grade',       s.grade,
        -- 2026-09-20: 학기를 더했다. '중간' 만으로는 1학기인지 2학기인지 알 수 없다.
        -- 옛 스냅샷에는 이 키가 없어 앱이 옵셔널로 받는다(`PaperSourceSnapshot.semester?`)
        'semester',    s.semester,
        'exam_type',   s.exam_type,
        'publisher',   s.publisher
      )
    )
    FROM unnest(p_problem_ids) WITH ORDINALITY AS t(pid, ord)
    JOIN exam.problems p              ON p.id = t.pid
    JOIN exam.problem_sources s       ON s.id = p.source_id
    LEFT JOIN exam.passages ps        ON ps.id = p.passage_id;

  RETURN v_paper_id;
END;
$$;

REVOKE ALL ON FUNCTION exam.create_problem_paper(TEXT, UUID[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exam.create_problem_paper(TEXT, UUID[], JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인 — 새 두 키가 들어갔고, 앞 마이그레이션의 결정이 살아 있는가
-- ---------------------------------------------
-- ⚠️ 정의 문자열 검사는 "그 자리에 그 코드가 있다" 까지만 말한다. 실제로 그렇게 저장되는지는
--    sql/verify_problem_paper_settings.sql 이 함수를 불러 본다.
DO $verify$
DECLARE
  v_src TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'exam' AND p.proname = 'create_problem_paper';

  IF position('''work_titles'',      to_jsonb(p.work_titles)' IN v_src) = 0 THEN
    RAISE EXCEPTION '문항 스냅샷에 work_titles 가 안 들어갔다';
  END IF;
  IF position('''works'',        ps.works' IN v_src) = 0 THEN
    RAISE EXCEPTION '지문 스냅샷에 works 가 안 들어갔다';
  END IF;
  -- 앞 마이그레이션의 결정(복사하다 흘리기 가장 쉬운 자리)
  IF position('''semester'',    s.semester' IN v_src) = 0 THEN
    RAISE EXCEPTION 'sql/35 의 학기 스냅샷이 되돌아갔다';
  END IF;
  IF position('jsonb_typeof(p_settings -> ''showSource'') = ''boolean''' IN v_src) = 0 THEN
    RAISE EXCEPTION 'sql/34 의 showSource 기본값이 되돌아갔다';
  END IF;
  IF position('figure_paths' IN v_src) = 0 THEN
    RAISE EXCEPTION 'sql/23 의 그림 스냅샷이 되돌아갔다';
  END IF;
  IF position('jsonb_typeof(p_settings -> ''omr'') = ''boolean''' IN v_src) = 0
     OR position('omr_choice_answer_ok' IN v_src) = 0 THEN
    RAISE EXCEPTION 'sql/54 의 OMR 설정·정답 검사가 되돌아갔다';
  END IF;
  IF position('FOR UPDATE' IN v_src) = 0 OR position('PARTITION BY passage_id' IN v_src) = 0 THEN
    RAISE EXCEPTION '잠금·지문 연속성 검사가 되돌아갔다';
  END IF;
  RAISE NOTICE 'create_problem_paper: work_titles·works 스냅샷 + 학기·showSource·그림·OMR·잠금·연속성 모두 확인';
END
$verify$;
