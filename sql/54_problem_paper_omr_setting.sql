-- ---------------------------------------------------------------
-- 54. 문제지에 'OMR 채점' 설정을 싣는다
-- ---------------------------------------------------------------
-- 문제은행에서 만든 문제지도 단어 시험처럼 기성 90A OMR 답안지로 채점하게 됐다(2026-09-29).
-- 대신 **선생님이 문제지마다 고른다**(사용자 결정) — 조합 화면의 'OMR 채점' 체크가
-- `settings.omr` 로 저장되고, 켜진 문제지만 저장 직후 성적 시스템(ara-system)에 시험으로 등록된다
-- (`/api/sync-paper-to-grades` → ara-system `integrations/problem-paper`, 그쪽 mig519).
--
-- ⚠️ **이 파일이 `exam.create_problem_paper` 의 정식 정의다**(sql/17 → 23 → 34 → 35 → 여기).
--    sql/35 를 나중에 단독으로 다시 돌리면 `omr` 키가 조용히 빠져 **OMR 을 켜고 만든 문제지가
--    등록되지 않는다**(발신 라우트가 `omr_not_enabled` 로 거절한다). 그 파일 머리에 경고를 적었다.
--
-- 바뀐 **실행 로직**은 하나뿐이다: 설정 화이트리스트에 `'omr'` 한 키. 그 밖에는 sql/35 본문 그대로다.
-- ⚠️ **불리언일 때만 그 값을 쓴다**(`jsonb_typeof`) — 앱 `normalizePaperSettings` 의
--    `value.omr === true` 와 1:1 거울이다. 문자열 `"true"` 로 켜지면 앱과 갈린다(sql/34 의 showSource 와 같은 근거).
--    기본은 **꺼짐**이다 — 옛 문제지와 키를 빠뜨린 호출이 성적 시스템에 저절로 올라가면 안 된다.
-- 멱등: CREATE OR REPLACE 라 다시 돌려도 안전하다.
--
-- ⚠️ **OMR 을 켰으면 정답 모양을 여기서도 검사한다**(코덱스 1R). 앱(`buildOmrAnswerKey`)이 미리 막지만,
--    RPC 를 직접 부르거나 조합 화면을 연 사이 다른 선생님이 정답을 고치면 OMR 로 못 채점하는 문제지가
--    **불변으로** 만들어져 성적 등록이 영영 거절된다. 스냅샷을 굳히는 **같은 트랜잭션·같은 잠금** 아래서
--    객관식 정답이 보기 번호(①~⑤, 복수 '1,4')인지, 객관식이 하나 이상인지 본다.
--    규칙은 `exam.omr_choice_answer_ok` 한 곳 — 앱 `omr-payload.ts` 의 `checkObjective` 와 1:1 거울이다.
--
-- ⚠️ **이미 만들어 둔 문제지는 바뀌지 않는다**(스냅샷은 불변이다). OMR 은 **만들 때만** 정한다 —
--    옛 문제지를 OMR 로 채점하려면 새로 만든다.
--
-- 적용: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/54_problem_paper_omr_setting.sql

DO $guard$
BEGIN
  IF to_regnamespace('exam') IS NULL THEN
    RAISE EXCEPTION 'exam 스키마가 없다 — 이 마이그레이션은 공유 프로젝트(ara-system) 전용이다';
  END IF;
END
$guard$;

-- 객관식 정답을 90A OMR 로 채점할 수 있는가 — 앱 `omr-payload.ts` 의 `checkObjective` 거울.
--   조각(**반각 쉼표**로만 가르고 앞뒤 공백 허용 — 교사용·답지의 `correctChoiceIndices` 와 같은 규칙)이
--   **전부** 한 자리 번호이며(빈 조각·공백 구분·전각 쉼표 = 실패: 인쇄물이 정답을 표시하지 못하는 값이다),
--   선지 수(0 이면 90A 칸 수 5)와 5 가운데 작은 값을 넘지 않아야 한다.
--   ⚠️ 캐스트를 CASE 안에 둔다 — AND 는 계산 순서를 보장하지 않아 '가'::int 가 터질 수 있다.
CREATE OR REPLACE FUNCTION exam.omr_choice_answer_ok(p_answer TEXT, p_choice_count INT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = exam, pg_temp
AS $$
  SELECT COUNT(*) > 0 AND COALESCE(bool_and(
           CASE WHEN x ~ '^[1-9]$'
                THEN x::int <= CASE WHEN COALESCE(p_choice_count, 0) > 0 THEN LEAST(p_choice_count, 5) ELSE 5 END
                ELSE false
           END), false)
    FROM regexp_split_to_table(btrim(COALESCE(p_answer, '')), '\s*,\s*') AS x;
$$;

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
-- 확인 — omr 키가 들어갔고, 앞 마이그레이션의 결정이 살아 있는가
-- ---------------------------------------------
-- ⚠️ 정의 문자열 검사는 "그 자리에 그 코드가 있다" 까지만 말한다. 실제로 그렇게 저장되는지는
--    sql/verify_problem_paper_settings.sql 처럼 함수를 불러 봐야 알 수 있다.
DO $verify$
DECLARE
  v_src TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'exam' AND p.proname = 'create_problem_paper';

  IF position('''semester'',    s.semester' IN v_src) = 0 THEN
    RAISE EXCEPTION '항목 스냅샷에 학기가 안 들어갔다';
  END IF;
  IF position('NULLIF(s.school_name, ''''), NULLIF(s.semester, '''')' IN v_src) = 0 THEN
    RAISE EXCEPTION 'source_labels 에 학기가 안 들어갔다';
  END IF;
  -- 앞 마이그레이션의 결정이 살아 있는지도 함께 본다(복사하다 흘리기 가장 쉬운 자리다)
  IF position('jsonb_typeof(p_settings -> ''showSource'') = ''boolean''' IN v_src) = 0 THEN
    RAISE EXCEPTION 'sql/34 의 showSource 기본값이 되돌아갔다';
  END IF;
  IF position('figure_paths' IN v_src) = 0 THEN
    RAISE EXCEPTION 'sql/23 의 그림 스냅샷이 되돌아갔다';
  END IF;
  IF position('jsonb_typeof(p_settings -> ''omr'') = ''boolean''' IN v_src) = 0 THEN
    RAISE EXCEPTION 'omr 설정 키가 안 들어갔다';
  END IF;
  IF position('omr_choice_answer_ok' IN v_src) = 0 THEN
    RAISE EXCEPTION 'OMR 정답 검사가 안 들어갔다';
  END IF;
  -- 정답 검사 함수가 앱 규칙과 같은가(거울) — 대표 경우를 직접 불러 본다
  IF NOT (exam.omr_choice_answer_ok('3', 5) AND exam.omr_choice_answer_ok('4, 1', 5)
          AND exam.omr_choice_answer_ok('5', 0)
          AND NOT exam.omr_choice_answer_ok('', 5) AND NOT exam.omr_choice_answer_ok('6', 5)
          AND NOT exam.omr_choice_answer_ok('1,6', 5) AND NOT exam.omr_choice_answer_ok('5', 4)
          AND NOT exam.omr_choice_answer_ok('ㄱ', 5) AND NOT exam.omr_choice_answer_ok('③', 5)
          AND NOT exam.omr_choice_answer_ok('14', 5) AND NOT exam.omr_choice_answer_ok('6', 0)
          AND NOT exam.omr_choice_answer_ok('1,', 5) AND NOT exam.omr_choice_answer_ok(',1', 5)
          AND NOT exam.omr_choice_answer_ok('1,,3', 5) AND exam.omr_choice_answer_ok(' 1 , 4 ', 5)
          AND NOT exam.omr_choice_answer_ok('1 4', 5) AND NOT exam.omr_choice_answer_ok('4，1', 5)) THEN
    RAISE EXCEPTION 'omr_choice_answer_ok 가 앱 규칙(omr-payload.ts)과 다르다';
  END IF;
  RAISE NOTICE 'create_problem_paper: omr 키 + 학기 2곳 + showSource 기본값 + 그림 스냅샷 모두 확인';
END
$verify$;
