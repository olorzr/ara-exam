-- ============================================================
-- 23. 기출 문제 은행 — 본문 제자리에 끼우는 그림
-- ============================================================
-- 그림은 발문·지문의 **원래 있던 자리**에 들어가야 한다. 표 위에 있던 그래프가 선지
-- 아래로 밀려 나오면 문항이 안 읽힌다. 지금까지는 그림이 있으면 **문항을 통째로**
-- 이미지로 출제했는데, 그러면 글이 아니라 사진이 되어 편집도 검색도 재조판도 안 된다.
--
-- 본문 HTML 에는 URL 없는 자리표시자 `<figure data-figure="1"></figure>` 만 둔다
-- (`<img>` 는 여전히 금지 — 서명 URL 은 만료돼 본문에 굳힐 수 없다). 숫자는
-- `figure_paths` 배열의 1-based 순번이고, 그리는 쪽이 그 자리에서 이미지를 끼운다.
--
-- `problems.figure_paths` 는 sql/17 부터 있었지만 **아무도 채우지 않았다.** 이제 채운다.
-- `passages` 에는 없었으므로 여기서 더한다.
--
-- 스키마는 모든 문장에 `exam.` 을 명시한다 (SQL Editor 가 문마다 다른 백엔드로 보낼 수 있다).

-- ---------------------------------------------
-- 1. 지문에도 그림 배열
-- ---------------------------------------------
ALTER TABLE exam.passages
  ADD COLUMN IF NOT EXISTS figure_paths TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN exam.passages.figure_paths IS
  '본문 제자리에 끼울 그림들(Storage 경로, 1-based). html 의 <figure data-figure="n"> 과 순번으로 짝을 이룬다. 못 만든 자리는 빈 문자열 — 압축하면 번호가 어긋난다';
COMMENT ON COLUMN exam.problems.figure_paths IS
  '본문 제자리에 끼울 그림들(Storage 경로, 1-based). stem_html 의 <figure data-figure="n"> 과 순번으로 짝을 이룬다';

-- ---------------------------------------------
-- 2. 문제지 스냅샷에 지문 그림을 싣는다
-- ---------------------------------------------
-- ⚠️ 스냅샷에 안 실으면 **문제지에서만 그림이 사라진다.** 아카이브 화면은 원본 행을 읽어
--    멀쩡해 보이는데 인쇄물에는 빈칸이 나오는, 가장 알아채기 어려운 종류의 결함이다.
--    이미 만들어 둔 문제지의 스냅샷에는 이 키가 없으므로 앱이 `?? []` 로 받는다.
-- sql/17 의 함수를 그대로 옮기고 지문 스냅샷 한 덩어리만 늘렸다.

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
    'showSource', CASE WHEN p_settings ->> 'showSource' = 'true'  THEN true  ELSE false END
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

-- PostgREST 스키마 캐시 갱신 — 없으면 배포 직후 새 컬럼이 PGRST204 로 거부된다
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인 쿼리 (적용 뒤 직접 돌려 볼 것)
-- ---------------------------------------------
-- 컬럼이 생겼는지:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema = 'exam' AND table_name = 'passages' AND column_name = 'figure_paths';
--
-- 새 문제지의 지문 스냅샷에 키가 들어가는지 (문제지를 하나 만든 뒤):
--   SELECT snapshot->'passage'->'figure_paths'
--     FROM exam.problem_paper_items ORDER BY created_at DESC LIMIT 1;
