-- =============================================
-- 114. 오류 신고 종류 둘 더 — 태그 오류 · 출처·번호 오류 (2026-11-23)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/114_problem_report_tag_source_categories.sql
-- =============================================
-- 배경 (원장님 "오류 신고에 태그잘못? 이런거 넣어주라")
--   · 'tag'    태그 오류 — 문항에 붙은 작품·단원·영역(문법 태그 포함)이 틀렸다. 문제 은행 카드에 보이는 그 꼬리표들이다.
--   · 'source' 출처·번호 오류 — 교사용·문제 은행에 찍히는 출처('2026 중2 상현중 1학기 중간 17번')가 틀렸다(0.9.95 부터
--     교사용에 늘 찍혀 선생님이 원본과 맞춰 본다).
--   · 처리 흐름은 그대로다(원장 웍스 DM · 원장 처리). '기타' 만 내용을 꼭 적는다.
--   · **신고 창은 '굳힐 상태'(태그 넷 + 굳힐 출처 + 원래 번호)를 스스로 읽어 보여 주고, 그 상태의 지문(md5)을 실어 보낸다**
--     (`problem_report_state`, 코덱스 3·4·5R). 출처·번호는 **신고가 굳힐 그 값**이다 — 문제 은행 문항이면 지금 원본, 문제지 항목이면
--     문제지를 만들 때 굳힌 스냅샷(신고 목록·알림이 그 값을 보여 준다). 태그는 둘 다 지금 원본(문제지 스냅샷엔 단원·문법이 없다). RPC 는 굳힐 값(같은 SELECT 에서 읽은 태그·출처)의 지문과 다르면 40001 로 거절한다 — 창을 연 사이 다른
--     선생님이 태그나 출처를 고치면, 창이 보여 준 값과 '신고 때 태그'·스냅샷 출처가 갈렸다(문항 `updated_at` 판만으로는 출처 수정이
--     안 잡힌다 — 출처는 다른 표다). 지문은 서버가 만들고 서버가 견준다(브라우저가 같은 식을 흉내 내지 않는다). 인자를 더해 서명이
--     여섯이 됐다 — 옛 서명은 지운다(오버로드가 남으면 PostgREST 가 못 고른다). 배포 전 탭은 지문을 안 보내 대조를 건너뛴다.
--   · **신고 때의 태그를 남긴다**(`tags` 칸, 코덱스 1R) — 태그 신고는 내용 없이도 되는데, 신고 스냅샷(문제지 항목 모양)에는
--     단원·문법 태그가 없다. 원장이 보기 전에 태그를 고치거나 다시 적재하면 선생님이 짚은 값이 사라진다. 그래서 RPC 가
--     신고하는 순간 원본 문항의 작품·단원·영역·문법 태그를 굳혀 둔다(종류와 상관없이 — 원본이 지워진 문제지 항목이면 NULL).
--     신고 목록이 태그 신고에 그 값을 보여 준다. sql/114 전 신고는 NULL 이다.
--
-- ⚠️ 종류 값은 앱 `src/lib/problem-report/types.ts` 의 REPORT_CATEGORIES 와 1:1 이다 — 하나를 바꾸면 둘 다(types.test 가 이 파일을 읽어 대조).
-- ⚠️⚠️ 이제 신고 종류 CHECK 와 `exam.report_problem` 의 **정식 정의는 이 파일**이다.
--   함수 본문은 sql/113 판에서 종류 목록 한 줄과 `tags` 를 굳히는 칸(두 SELECT 에 하나씩)만 다르다(적용 전에 운영 정의 = sql/113 파일임을 확인했다).
--   sql/113 은 이 파일이 적용된 DB(`tags` 칸이 있다)에서 옛 report_problem 정의를 건너뛴다(코덱스 2R) — 다시 돌려도 안전하다.
-- 멱등: 칸은 IF NOT EXISTS, 제약은 지우고 다시 만들고, 함수는 옛 다섯 서명을 지운 뒤 여섯 서명을 CREATE OR REPLACE.
-- =============================================

-- 정의는 한 트랜잭션으로 커밋한 **뒤에** 검증한다(코덱스 3R) — 검증이 실제 문제지 행을 FOR SHARE 로 잡는 동안 표 잠금(ALTER TABLE)을
-- 들고 있으면, 그 문제지에서 항목을 지우는 선생님(문제지 행 잠금 → 신고 참조 SET NULL 로 이 표를 기다림)과 교착해 한쪽이 죽는다.
BEGIN;

-- ---------------------------------------------
-- 1. 표의 종류 CHECK — 이름은 sql/113 의 인라인 CHECK 가 받은 기본 이름 그대로
-- ---------------------------------------------
ALTER TABLE exam.problem_reports DROP CONSTRAINT IF EXISTS problem_reports_category_check;
ALTER TABLE exam.problem_reports ADD CONSTRAINT problem_reports_category_check
  CHECK (category IN ('answer', 'text', 'passage', 'figure', 'tag', 'source', 'other'));

-- ---------------------------------------------
-- 2. 신고 때의 태그 — 원본 문항의 작품·단원·영역·문법 태그(jsonb 배열 넷). 표 권한·RLS 는 sql/113 그대로(읽기만)
-- ---------------------------------------------
ALTER TABLE exam.problem_reports ADD COLUMN IF NOT EXISTS tags JSONB;
COMMENT ON COLUMN exam.problem_reports.tags IS
  '신고 때 원본 문항의 태그 {work_titles, unit_path, area_path, grammar_paths}(sql/114). 원본이 없었거나 sql/114 전 신고면 NULL.';

-- 태그 넷을 굳히는 식 — 신고 RPC 만 부른다(DEFINER 안에서 소유자 권한으로 돈다, 브라우저에 안 연다)
CREATE OR REPLACE FUNCTION exam.problem_report_tags(p exam.problems)
RETURNS JSONB LANGUAGE sql STABLE
SET search_path = exam, pg_temp
AS $$
  SELECT jsonb_build_object(
    'work_titles',   to_jsonb((p).work_titles),
    'unit_path',     to_jsonb((p).unit_path),
    'area_path',     to_jsonb((p).area_path),
    'grammar_paths', to_jsonb((p).grammar_paths));
$$;
REVOKE ALL ON FUNCTION exam.problem_report_tags(exam.problems) FROM PUBLIC, anon, authenticated;

-- 같은 날 잠깐 있던 판(태그 + 지금 출처만 — 문제지 항목의 굳힌 출처·원래 번호를 못 담았다, 코덱스 5R)
DROP FUNCTION IF EXISTS exam.problem_report_state(UUID);
DROP FUNCTION IF EXISTS exam.problem_report_state_of(exam.problems, exam.problem_sources);

-- 글 한 칸 정규화 — 화면에서 같아 보이는 글은 같은 값으로(Stop 게이트). 앱 `normalizeReportText`(display.ts)와 **글자 하나까지 같은 규칙**이다
-- (두 목록을 바꾸면 둘 다 — display.test 가 이 파일의 두 정규식을 읽어 대조한다):
--   ① 보이지 않는 글자(폭 없는 공백·BOM·단어 잇기·방향 제어·줄 바꿈 가능 하이픈 …)를 걷는다 — 빈 칸과 BOM 하나만 든 칸이 같아 보였다
--   ② NFC 로 합친다(풀어 쓴 한글과 합친 한글은 같아 보인다) — ①이 먼저여야 멱등이다(category-name 규칙과 같은 차례)
--   ③ 탭·줄바꿈·유니코드 공백(NBSP·전각 공백 …)의 연속을 한 칸으로 접고 ④ 앞뒤를 걷는다, 비면 null.
--   ⚠️ ③을 ④보다 먼저 — btrim 은 띄어쓰기만 걷어, 먼저 걷으면 앞뒤 탭이 남아 공백 한 칸이 됐다.
--   이모지 잇기(ZWJ)·이체자 선택자·옛한글 채움 글자는 걷지 않는다 — 보이는 모양을 바꾼다
CREATE OR REPLACE FUNCTION exam.problem_report_norm_text(v TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
SET search_path = exam, pg_temp
AS $$
  SELECT NULLIF(btrim(regexp_replace(
           normalize(regexp_replace(COALESCE(v, ''), '[\u00AD\u034F\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]', '', 'g'), NFC),
           '[\s\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+', ' ', 'g')), '');
$$;
REVOKE ALL ON FUNCTION exam.problem_report_norm_text(TEXT) FROM PUBLIC, anon, authenticated;

-- 글 목록 정규화 — 칸마다 위처럼, 빈 칸은 뺀다(차례는 그대로). 배열이 아니면 빈 배열
CREATE OR REPLACE FUNCTION exam.problem_report_norm_list(v JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE
SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t.x) ORDER BY t.ord), '[]'::jsonb)
    FROM (SELECT exam.problem_report_norm_text(e) AS x, ord
            FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(v) = 'array' THEN v ELSE '[]'::jsonb END)
                 WITH ORDINALITY AS a(e, ord)) t
   WHERE t.x IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION exam.problem_report_norm_list(JSONB) FROM PUBLIC, anon, authenticated;

-- 신고 창이 보여 주는 '굳힐 상태' — 태그 넷(원본이 없으면 null) + 굳힐 출처 여덟 칸 + 원래 번호, **정규화한 모양**.
-- 지문은 이 jsonb 글의 md5(jsonb 글은 키 차례가 정해져 있다). 만드는 곳은 이 함수 하나 — 창이 읽는 쪽과 신고가 견주는 쪽이 같은 식이다.
-- ⚠️ 정규화하는 까닭(Stop 게이트): 날값으로 지문을 만들면 빈 글·null·키 없음·공백만 다른 두 상태가 화면에선 똑같이 보이는데 신고는
--   '바뀌었어요' 로 거절된다. 창은 이 정규화된 값을 그대로 그린다 — 지문이 다르면 화면도 다르다(목록 칸은 칸마다 따로 그린다)
CREATE OR REPLACE FUNCTION exam.problem_report_state_build(p_tags JSONB, p_source JSONB, p_number JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE
SET search_path = exam, pg_temp
AS $$
  SELECT jsonb_build_object(
    'tags', CASE WHEN jsonb_typeof(p_tags) = 'object' THEN jsonb_build_object(
              'work_titles',   exam.problem_report_norm_list(p_tags -> 'work_titles'),
              'unit_path',     exam.problem_report_norm_list(p_tags -> 'unit_path'),
              'area_path',     exam.problem_report_norm_list(p_tags -> 'area_path'),
              'grammar_paths', exam.problem_report_norm_list(p_tags -> 'grammar_paths')) END,
    'source', CASE WHEN jsonb_typeof(p_source) = 'object' THEN jsonb_build_object(
              'source_type', exam.problem_report_norm_text(p_source ->> 'source_type'),
              'title',       exam.problem_report_norm_text(p_source ->> 'title'),
              'year',        exam.problem_report_norm_text(p_source ->> 'year'),
              'grade',       exam.problem_report_norm_text(p_source ->> 'grade'),
              'school_name', exam.problem_report_norm_text(p_source ->> 'school_name'),
              'publisher',   exam.problem_report_norm_text(p_source ->> 'publisher'),
              'semester',    exam.problem_report_norm_text(p_source ->> 'semester'),
              'exam_type',   exam.problem_report_norm_text(p_source ->> 'exam_type')) END,
    -- 번호는 정수만(화면이 정수만 'N번' 으로 그린다)
    'number', CASE WHEN jsonb_typeof(p_number) = 'number' AND p_number::text ~ '^-?[0-9]+$' THEN p_number END);
$$;
REVOKE ALL ON FUNCTION exam.problem_report_state_build(JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;

-- 신고 창이 부른다 — 문항(문제 은행) 또는 문제지 항목 하나의 굳힐 상태 + 지문(token). 도메인 전원
CREATE OR REPLACE FUNCTION exam.problem_report_state(p_problem_id UUID DEFAULT NULL, p_paper_item_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = exam, pg_temp
AS $$
DECLARE
  v_state JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT exam.is_allowed_domain() THEN
    RAISE EXCEPTION '허용되지 않은 계정입니다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (p_problem_id IS NULL) = (p_paper_item_id IS NULL) THEN
    RAISE EXCEPTION '문제지 항목이나 문항 중 하나만 골라 주세요' USING ERRCODE = 'check_violation';
  END IF;
  IF p_paper_item_id IS NOT NULL THEN
    -- 문제지 항목 — 출처·번호는 항목 스냅샷(신고가 굳힐 값), 태그는 지금 원본(지워졌으면 null)
    SELECT exam.problem_report_state_build(
             CASE WHEN pr.id IS NULL THEN NULL ELSE exam.problem_report_tags(pr) END,
             i.snapshot -> 'source', i.snapshot -> 'number')
      INTO v_state
      FROM exam.problem_paper_items i
      LEFT JOIN exam.problems pr ON pr.id = i.problem_id
     WHERE i.id = p_paper_item_id;
  ELSE
    SELECT exam.problem_report_state_build(exam.problem_report_tags(p), exam.paper_source_snapshot(s), to_jsonb(p.number))
      INTO v_state
      FROM exam.problems p
      LEFT JOIN exam.problem_sources s ON s.id = p.source_id
     WHERE p.id = p_problem_id;
  END IF;
  IF v_state IS NULL THEN
    RAISE EXCEPTION '문항을 찾지 못했어요 — 지워졌거나 다시 올라왔을 수 있어요' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v_state || jsonb_build_object('token', md5(v_state::text));
END;
$$;
REVOKE ALL ON FUNCTION exam.problem_report_state(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.problem_report_state(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------
-- 3. 신고 RPC — sql/113 판에서 종류 목록을 넓히고 태그를 굳힌다
-- ---------------------------------------------
DROP FUNCTION IF EXISTS exam.report_problem(TEXT, TEXT, UUID, UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS exam.report_problem(TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ);  -- 같은 날 잠깐 있던 '문항 판' 서명
-- ⚠️ 태그는 스냅샷과 **같은 문장**에서 읽는다(코덱스 2R) — 따로 읽으면 READ COMMITTED 에서 그 사이 커밋된 태그 수정이 끼어
--   스냅샷(옛 작품·영역)과 '신고 때 태그'(새 값)가 다른 판이 된다. 문제지 항목은 스냅샷이 인쇄 때 모습이라 태그만 지금 원본이다.
CREATE OR REPLACE FUNCTION exam.report_problem(
  p_category       TEXT,
  p_note           TEXT DEFAULT '',
  p_problem_id     UUID DEFAULT NULL,
  p_paper_item_id  UUID DEFAULT NULL,
  p_paper_revision TIMESTAMPTZ DEFAULT NULL,
  p_state_token    TEXT DEFAULT NULL
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
  v_tags        JSONB;
  v_token       TEXT;
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
    -- 신고 때의 태그(sql/114) — 원본 문항이 남아 있으면 지금 원본의 태그(선생님이 문제 은행에서 보는 값)
    SELECT i.snapshot, i.problem_id, i.paper_id, p.title,
           (SELECT count(*) + 1 FROM exam.problem_paper_items o
             WHERE o.paper_id = i.paper_id AND o.order_index < i.order_index)::int,
           CASE WHEN pr.id IS NULL THEN NULL ELSE exam.problem_report_tags(pr) END,
           md5(exam.problem_report_state_build(
             CASE WHEN pr.id IS NULL THEN NULL ELSE exam.problem_report_tags(pr) END,
             i.snapshot -> 'source', i.snapshot -> 'number')::text)
      INTO v_snapshot, v_problem_id, v_paper_id, v_paper_title, v_printed_no, v_tags, v_token
      FROM exam.problem_paper_items i
      JOIN exam.problem_papers p ON p.id = i.paper_id
      LEFT JOIN exam.problems pr ON pr.id = i.problem_id
     WHERE i.id = p_paper_item_id;
    IF v_snapshot IS NULL THEN
      RAISE EXCEPTION '문제지 문항을 찾지 못했어요 — 문제지가 바뀌었을 수 있어요' USING ERRCODE = 'no_data_found';
    END IF;
  ELSE
    -- 문제 은행에서 — 지금 원본을 문제지와 같은 모양으로 굳힌다
    SELECT exam.paper_item_snapshot(p, ps, s), p.id, exam.problem_report_tags(p),
           md5(exam.problem_report_state_build(exam.problem_report_tags(p), exam.paper_source_snapshot(s), to_jsonb(p.number))::text)
      INTO v_snapshot, v_problem_id, v_tags, v_token
      FROM exam.problems p
      LEFT JOIN exam.passages ps ON ps.id = p.passage_id
      LEFT JOIN exam.problem_sources s ON s.id = p.source_id
     WHERE p.id = p_problem_id;
    IF v_snapshot IS NULL THEN
      RAISE EXCEPTION '문항을 찾지 못했어요 — 지워졌거나 다시 올라왔을 수 있어요' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  -- 신고 창이 보여 준 태그·출처와 굳힐 값이 다르면 거절(sql/114, 코덱스 3·4R) — 지문은 위의 같은 SELECT 에서 굳힐 값으로 만들었다.
  -- 창은 이 거절을 받으면 지금 상태를 다시 읽어 보여 주므로 쓰던 글을 지우지 않고 다시 누르면 된다
  IF p_state_token IS NOT NULL AND v_token IS DISTINCT FROM p_state_token THEN
    RAISE EXCEPTION '이 문항의 태그나 출처가 방금 다른 곳에서 바뀌었어요. 신고 창에 바뀐 내용을 다시 띄웠으니 확인하고 다시 신고해 주세요'
      USING ERRCODE = 'serialization_failure';
  END IF;

  INSERT INTO exam.problem_reports
    (problem_id, paper_id, paper_item_id, snapshot, paper_title, printed_no, source_label, category, note, user_id, tags)
  VALUES
    (v_problem_id, v_paper_id, p_paper_item_id, v_snapshot, v_paper_title, v_printed_no,
     exam.paper_source_label(v_snapshot -> 'source'), p_category, v_note, auth.uid(), v_tags)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION exam.report_problem(TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.report_problem(TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

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
  SELECT pg_get_functiondef('exam.report_problem(text,text,uuid,uuid,timestamptz,text)'::regprocedure) INTO v_def;
  IF v_def NOT LIKE '%''figure'', ''tag'', ''source'', ''other''%' THEN
    RAISE EXCEPTION 'sql/114: report_problem 의 종류 목록이 넓혀지지 않았다';
  END IF;
  IF NOT has_function_privilege('authenticated', 'exam.report_problem(text,text,uuid,uuid,timestamptz,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.report_problem(text,text,uuid,uuid,timestamptz,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'sql/114: report_problem 실행 권한이 authenticated 만이 아니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'exam' AND table_name = 'problem_reports' AND column_name = 'tags' AND data_type = 'jsonb') THEN
    RAISE EXCEPTION 'sql/114: problem_reports.tags 칸이 없다';
  END IF;
  IF has_function_privilege('authenticated', 'exam.problem_report_tags(exam.problems)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'exam.problem_report_state_build(jsonb,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'exam.problem_report_norm_text(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'exam.problem_report_norm_list(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'sql/114: 태그·상태 헬퍼가 브라우저에 열려 있다';
  END IF;
  IF NOT has_function_privilege('authenticated', 'exam.problem_report_state(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'exam.problem_report_state(uuid,uuid)', 'EXECUTE')
     OR (SELECT count(*) FROM pg_proc WHERE proname = 'problem_report_state' AND pronamespace = 'exam'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'sql/114: problem_report_state 실행 권한이 authenticated 만이 아니다';
  END IF;
  IF has_column_privilege('authenticated', 'exam.problem_reports', 'tags', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'exam.problem_reports', 'tags', 'SELECT') THEN
    RAISE EXCEPTION 'sql/114: tags 칸 권한이 읽기 하나가 아니다';
  END IF;
  -- 정규화 — 빈 글·null·키 없음·공백만 다른 상태는 같은 지문, 칸을 옮기면 다른 지문
  IF exam.problem_report_state_build(NULL, '{"title":"수능  ", "grade":""}', '3')
     IS DISTINCT FROM exam.problem_report_state_build(NULL, '{"title":" 수능", "grade":null, "semester":"   "}', '3')
     -- 보이지 않는 글자(BOM)만 든 칸 = 빈 칸, NBSP = 공백, 풀어 쓴 한글 = 합친 한글
     OR exam.problem_report_state_build(NULL, jsonb_build_object('publisher', chr(65279), 'title', '수' || chr(160) || '능'), NULL)
        IS DISTINCT FROM exam.problem_report_state_build(NULL, '{"title":"수 능"}', NULL)
     OR exam.problem_report_norm_text(normalize('한글', NFD)) <> '한글'
     OR exam.problem_report_norm_text('가' || chr(8203) || '나') <> '가나'
     -- 탭·줄바꿈만 다른 값도 같은 지문(앞뒤든 안쪽이든)
     OR exam.problem_report_state_build('{"work_titles":["\t동백꽃\n", "봄\t\n봄"]}', '{"title":"\n수능\t", "grade":"\t"}', NULL)
        IS DISTINCT FROM exam.problem_report_state_build('{"work_titles":["동백꽃", "봄 봄"]}', '{"title":"수능"}', NULL)
     OR exam.problem_report_state_build('{"work_titles":["가", " ", "나  다"]}', NULL, NULL) -> 'tags' -> 'work_titles'
        IS DISTINCT FROM '["가", "나 다"]'::jsonb
     OR exam.problem_report_state_build(NULL, '{"school_name":"서울시교육청"}', NULL)
        = exam.problem_report_state_build(NULL, '{"publisher":"서울시교육청"}', NULL)
     OR exam.problem_report_state_build(NULL, NULL, '"3"') -> 'number' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'sql/114: 상태 정규화가 이상하다';
  END IF;
  RAISE NOTICE 'sql/114 모양 통과 — 종류 CHECK 1 · 신고 RPC 1 · 목록 일곱 · 권한 그대로 · tags 칸(읽기만) · 상태 정규화';
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 ② 실제로 — 검증용 출처·문항·문제지를 만들어 선생님 JWT 로 새 두 종류를 신고해 보고(내용 없이도 된다), 모르는 종류는 거절(전부 되돌린다)
-- ---------------------------------------------
DO $verify_probe$
DECLARE
  v_uid     UUID;
  v_src     UUID;
  v_problem UUID;
  v_paper   UUID;
  v_item    UUID;
  v_rev     TIMESTAMPTZ;
  v_id1     UUID;
  v_id2     UUID;
  v_id3     UUID;
  v_cat     TEXT;
  v_tags    JSONB;
  v_state   JSONB;
  v_istate  JSONB;
BEGIN
  -- ⚠️ 운영 행을 읽지도 잠그지도 않는다 — 검증용 출처·문항·문제지·항목을 이 블록 안에서 만들고 되돌린다(코덱스 9R · Stop 게이트).
  --   운영 행으로 재면 그 사이 선생님이 고쳐 헛실패하고(9R), 잠그면 문제지 저장과 차례가 엇갈려 교착한다(문항 → 문제지 대 문제지 → 항목).
  --   빌려 오는 것은 실제 계정 id 하나뿐이다(user_id 참조·강제 트리거)
  SELECT s.user_id INTO v_uid FROM exam.problem_sources s LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE NOTICE 'sql/114: 계정이 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_uid::text, 'role', 'authenticated', 'email', 'verify-a@araeducation.co.kr')::text, true);
    INSERT INTO exam.problem_sources (source_type, title, user_id, school_name, year, grade, semester, exam_type)
    VALUES ('내신기출', 'sql114 검증용', v_uid, '검증중', '2026', '중2', '1학기', '중간')
    RETURNING id INTO v_src;
    INSERT INTO exam.problems (source_id, user_id, number, question_type, stem_html, unit_path, area_path, grammar_paths)
    VALUES (v_src, v_uid, 7, '객관식', '<p>sql114 검증 문항</p>', ARRAY['1. 검증 단원'], ARRAY['문학'], ARRAY['단어 > 품사'])
    RETURNING id INTO v_problem;
    INSERT INTO exam.problem_papers (title, user_id) VALUES ('sql114 검증용', v_uid) RETURNING id INTO v_paper;
    INSERT INTO exam.problem_paper_items (paper_id, problem_id, order_index, snapshot)
    SELECT v_paper, p.id, 0, exam.paper_item_snapshot(p, NULL::exam.passages, s)
      FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id
     WHERE p.id = v_problem
    RETURNING id INTO v_item;
    SELECT updated_at INTO v_rev FROM exam.problem_papers WHERE id = v_paper;

    EXECUTE 'SET LOCAL ROLE authenticated';

    -- 창이 읽는 굳힐 상태 — 정규화한 태그·출처·원래 번호와 지문
    v_state := exam.problem_report_state(v_problem);
    IF v_state -> 'tags' IS DISTINCT FROM
         '{"work_titles": [], "unit_path": ["1. 검증 단원"], "area_path": ["문학"], "grammar_paths": ["단어 > 품사"]}'::jsonb
       OR v_state -> 'source' ->> 'school_name' IS DISTINCT FROM '검증중'
       OR v_state -> 'source' ->> 'publisher' IS NOT NULL
       OR v_state -> 'number' IS DISTINCT FROM '7'::jsonb
       OR length(v_state ->> 'token') <> 32 THEN
      RAISE EXCEPTION '지금 상태가 이상하다: %', v_state;
    END IF;
    -- 그 지문을 실어 신고 — 같으면 된다(내용 없이도)
    v_id1 := exam.report_problem('tag', '', v_problem, NULL, NULL, v_state ->> 'token');
    SELECT category, tags INTO v_cat, v_tags FROM exam.problem_reports WHERE id = v_id1;
    IF v_cat IS DISTINCT FROM 'tag' OR v_tags -> 'unit_path' IS DISTINCT FROM '["1. 검증 단원"]'::jsonb
       OR v_tags -> 'grammar_paths' IS DISTINCT FROM '["단어 > 품사"]'::jsonb THEN
      RAISE EXCEPTION '태그 오류 신고가 이상하다: % %', v_cat, v_tags;
    END IF;

    -- 문제지 항목은 항목 기준 — 출처·번호는 항목 스냅샷, 태그는 지금 원본
    v_istate := exam.problem_report_state(NULL, v_item);
    IF v_istate -> 'source' ->> 'school_name' IS DISTINCT FROM '검증중' OR v_istate -> 'number' IS DISTINCT FROM '7'::jsonb
       OR v_istate -> 'tags' -> 'unit_path' IS DISTINCT FROM '["1. 검증 단원"]'::jsonb THEN
      RAISE EXCEPTION '문제지 항목의 상태가 이상하다: %', v_istate;
    END IF;
    v_id3 := exam.report_problem('tag', '', NULL, v_item, v_rev, v_istate ->> 'token');
    SELECT tags INTO v_tags FROM exam.problem_reports WHERE id = v_id3;
    IF v_tags -> 'unit_path' IS DISTINCT FROM '["1. 검증 단원"]'::jsonb THEN
      RAISE EXCEPTION '문제지 항목 신고에 원본 태그가 안 굳었다: %', v_tags;
    END IF;

    -- 창이 본 상태와 다르면(창을 연 뒤 다른 곳에서 고쳐짐) 거절 — 문항 신고도 문제지 항목 신고도
    BEGIN
      PERFORM exam.report_problem('tag', '', v_problem, NULL, NULL, md5('엉뚱한 상태'));
      RAISE EXCEPTION 'sql114_stale_problem_passed';
    EXCEPTION WHEN serialization_failure THEN NULL;
    END;
    BEGIN
      PERFORM exam.report_problem('tag', '', NULL, v_item, v_rev, md5('엉뚱한 상태'));
      RAISE EXCEPTION 'sql114_stale_item_passed';
    EXCEPTION WHEN serialization_failure THEN NULL;
    END;

    v_id2 := exam.report_problem('source', '원래 8번이에요', v_problem, NULL, NULL);
    SELECT category INTO v_cat FROM exam.problem_reports WHERE id = v_id2;
    IF v_cat IS DISTINCT FROM 'source' THEN RAISE EXCEPTION '출처 오류 신고가 이상하다 (%)', v_cat; END IF;

    BEGIN
      PERFORM exam.report_problem('evil', '', v_problem, NULL, NULL);
      RAISE EXCEPTION 'sql114_unknown_passed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 바깥 도메인은 굳힐 상태를 못 읽는다
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@example.com')::text, true);
    BEGIN
      PERFORM exam.problem_report_state(v_problem);
      RAISE EXCEPTION 'sql114_outside_state';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    RAISE EXCEPTION 'sql114_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'sql114_rollback' THEN RAISE; END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/114: 검증 뒤 역할이 돌아오지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_sources WHERE id = v_src)
     OR EXISTS (SELECT 1 FROM exam.problem_papers WHERE id = v_paper)
     OR EXISTS (SELECT 1 FROM exam.problem_reports WHERE id IN (v_id1, v_id2, v_id3)) THEN
    RAISE EXCEPTION 'sql/114: 검증용 행이 되돌아가지 않았다';
  END IF;
  RAISE NOTICE 'sql/114 실제 검증 통과(검증용 행 — 운영 행은 안 건드림) — 태그 오류(내용 없이, 원본 태그 굳힘 · 문제지 항목도) · 창이 본 상태와 다르면 거절(문항·문제지 항목) · 출처·번호 오류 신고 · 모르는 종류 거절 · 바깥 도메인 상태 못 읽음 (전부 되돌림)';
END
$verify_probe$;
