-- ---------------------------------------------------------------
-- 34. 문제지 기본 설정 — 출처는 기본으로 찍는다
-- ---------------------------------------------------------------
-- 화면 기본값(`DEFAULT_PAPER_SETTINGS.showSource`)이 2026-09-19 에 **표시**로 바뀌었는데
-- RPC 화이트리스트의 폴백만 '숨김' 으로 남아 있었다. 앱(`usePaperComposer.save`)은 늘
-- 전체 settings 를 실어 보내므로 앱 경로의 동작은 이미 맞지만, **키를 빠뜨린 직접 호출**은
-- 서버 기본값을 따르게 되어 화면이 말하는 기본과 갈린다. 두 기본값은 같아야 한다.
--
-- ⚠️ **적용 시점(2026-09-19)에는 이 파일이 `exam.create_problem_paper` 의 정식 정의였다**
--    (sql/17 → sql/23 → 여기). **지금은 아니다** — 아래 2026-09-20 경고를 볼 것.
--    함수를 고칠 일이 생기면 **번호가 가장 큰 정의**를 고치고, 옛 파일에는 포인터만
--    남길 것(`create_exam_with_words` 와 같은 규약).
--
-- 바뀐 **실행 로직**은 `v_settings` 조립의 `showSource` 분기 하나뿐이다(그 밖에는 설명 주석만
-- 늘었고, 주석을 걷어 내면 sql/23 본문과 해시가 같다 — 기계로 대조했다).
-- 멱등: CREATE OR REPLACE 라 다시 돌려도 안전하다.
--
-- 적용: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/34_problem_paper_show_source_default.sql

-- ⚠️ [2026-09-20] **여기의 정의는 더 이상 정식이 아니다.** 출처 스냅샷에 학기가
--    sql/35_problem_paper_source_semester.sql 에서 더해졌다. 이 파일을 **단독으로 다시
--    돌리면 학기가 조용히 빠진다** — 되돌렸다면 sql/35 를 다시 적용할 것.
--    번호 순서(…→34→35)로 적용하면 괜찮다.

DO $guard$
BEGIN
  IF to_regnamespace('exam') IS NULL THEN
    RAISE EXCEPTION 'exam 스키마가 없다 — 이 마이그레이션은 공유 프로젝트(ara-system) 전용이다';
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
                  END
  );

  INSERT INTO exam.problem_papers (title, settings, total_questions, source_labels, user_id)
  SELECT
    btrim(p_title),
    v_settings,
    v_count,
    COALESCE(ARRAY(
      SELECT DISTINCT COALESCE(
        NULLIF(btrim(concat_ws(' ',
          NULLIF(s.year, ''), NULLIF(s.grade, ''),
          NULLIF(s.school_name, ''), NULLIF(s.exam_type, ''))), ''),
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
        'figure_paths', to_jsonb(ps.figure_paths)
      ) END,
      'source', jsonb_build_object(
        'source_type', s.source_type,
        'title',       s.title,
        'school_name', s.school_name,
        'year',        s.year,
        'grade',       s.grade,
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

DO $verify$
DECLARE
  v_src TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'exam' AND p.proname = 'create_problem_paper';

  IF position('jsonb_typeof(p_settings -> ''showSource'') = ''boolean''' IN v_src) = 0 THEN
    RAISE EXCEPTION '화이트리스트가 새 기본값으로 안 바뀌었다';
  END IF;
  RAISE NOTICE 'create_problem_paper: showSource 는 불리언일 때만 그 값, 아니면 표시(true)';
END
$verify$;
