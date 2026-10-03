-- =============================================
-- 60. 작품 전문 — 교과서 단원(여럿) · 문법 분류 · 판본 메모
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/60_reference_texts_classification.sql
-- =============================================
-- 배경:
--   원장님 요청(2026-10-03): "작품 전문도 문제 은행처럼 교과서별로, 작품별로 넣을 수 있게 —
--   전문을 쓰면 교과서 단원·문법·작품을 고를 수 있게. 학교는 필요없어."
--   지금까지 전문은 제목·지은이·본문뿐이라 최근 고친 순 목록으로만 찾을 수 있었다.
--
-- ⚠️ 교과서 단원은 **전문 하나에 여러 개**다(사용자 결정). 같은 「봄봄」이 천재·비상 교과서에
--    다 실린다 — 단원마다 전문을 따로 올리게 하면 같은 글이 교과서 수만큼 쌓인다.
--    그래서 problems.unit_path(TEXT[] 경로 하나)가 아니라 **원소가 단원 하나인 JSONB 배열**이다:
--      [{"grade":"중2","textbook":"천재(노미숙)","semester":"1학기","unit_path":["1. 문학","(1) 시"]}, …]
--    문항은 교과서·학년·학기를 출처 행(problem_sources)에 두지만 전문에는 출처가 없어 원소가 들고 있다.
--    자식 표를 두지 않은 까닭: 목록 거르기가 `units @> '[{…}]'` 한 줄(GIN)이고, 저장이 한 행 쓰기라
--    `updated_at` 낙관적 동시성이 그대로 걸린다. 작품 수백 편 규모라 정규화로 얻을 것이 없다.
--    jsonb 포함은 배열을 원소 단위로 비교하므로 `{"unit_path":["1. 문학"]}` 로 찾으면
--    `["1. 문학","(1) 시"]` 단원도 걸린다 — 대단원만 골라 그 아래 소단원까지 보는 검색이 공짜다.
-- ⚠️ 학교 축은 없다(사용자 결정). 원소에 학교·학년도를 넣지 않는다.
-- ⚠️ grammar_paths 는 problems.grammar_paths 와 **같은 모양**이다(원소 = '단어 > 품사 > 명사' 경로 문자열,
--    상한 5, 상위 검색은 && — sql/21). 마스터는 코드 상수 GRAMMAR_TREE.
-- ⚠️ note(판본 메모)는 "학교마다 본문이 조금 다를 때" 의 답이다: 글이 실제로 다르면 전문을 따로
--    올리고 이 칸에 '교학사 수록본' 처럼 적어 가른다. 거의 같으면 한 편에 단원을 여럿 붙인다.
-- ⚠️ 모양 검사는 **CHECK + 검사 함수**다(정규화 트리거가 아니다). 앱이 보내기 전에 다듬으므로
--    (normalizeReferenceUnits) DB 는 앱이 보낼 리 없는 것만 거절하면 된다 — 정규화를 두 언어로
--    미러하던 sql/33 의 부담을 지지 않는다. 상한(8·2·5·200)은 앱 상수와 같아야 한다.
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다. 목록이 새 컬럼을 select 하므로
--    앱이 먼저 나가면 `/reference-texts` 가 42703(컬럼 없음)으로 죽는다.
-- ⚠️ 모든 DDL 에 `exam.` 을 명시한다(SQL Editor 의 문마다 다른 백엔드 문제 — sql/30 머리 참고).

-- ---------------------------------------------
-- 실행 대상 확인 (가장 먼저)
-- ---------------------------------------------
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). SQL Editor 가 다른 Supabase 프로젝트에 '
      '연결돼 있을 가능성이 높습니다.', current_database();
  END IF;

  IF to_regclass('exam.reference_texts') IS NULL THEN
    RAISE EXCEPTION 'sql/30(작품 전문)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;

  IF to_regprocedure('exam.audit_problem_bank()') IS NULL
     OR to_regprocedure('exam.is_allowed_domain()') IS NULL THEN
    RAISE EXCEPTION 'exam 헬퍼(audit_problem_bank·is_allowed_domain)가 없습니다 (현재 DB: %).',
      current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 단원 목록 모양 검사 — CHECK 에서 부른다
-- ---------------------------------------------
-- plpgsql 인 까닭: 배열이 아닐 때 jsonb_array_elements 가 오류를 내는데, SQL 의 AND 는
-- 평가 순서를 보장하지 않는다. 순서대로 걸러야 '배열 아님' 이 오류가 아니라 false 가 된다.
CREATE OR REPLACE FUNCTION exam.reference_units_valid(p JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = exam, pg_temp
AS $$
DECLARE
  u   JSONB;
  seg JSONB;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN RETURN false; END IF;
  -- 상한은 앱의 REFERENCE_UNITS_MAX 와 같다
  IF jsonb_array_length(p) > 8 THEN RETURN false; END IF;

  FOR u IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(u) <> 'object' THEN RETURN false; END IF;
    IF jsonb_typeof(u->'grade') IS DISTINCT FROM 'string'
       OR jsonb_typeof(u->'semester') IS DISTINCT FROM 'string'
       OR jsonb_typeof(u->'textbook') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;
    -- 교과서가 없으면 어느 단원인지 알 수 없다(대단원 이름은 교과서마다 겹친다)
    IF btrim(u->>'textbook') = '' THEN RETURN false; END IF;

    -- 대단원 하나 또는 대단원·소단원 — problems.unit_path 와 같은 2단 상한(UNIT_DEPTH_MAX)
    IF jsonb_typeof(u->'unit_path') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    IF jsonb_array_length(u->'unit_path') NOT BETWEEN 1 AND 2 THEN RETURN false; END IF;
    FOR seg IN SELECT value FROM jsonb_array_elements(u->'unit_path') LOOP
      IF jsonb_typeof(seg) <> 'string' OR btrim(seg #>> '{}') = '' THEN RETURN false; END IF;
    END LOOP;
  END LOOP;

  RETURN true;
END;
$$;

-- CHECK 는 쓰는 사람의 권한으로 함수를 부른다 — 기본 권한에 기대지 않고 직접 준다
GRANT EXECUTE ON FUNCTION exam.reference_units_valid(JSONB) TO authenticated, service_role;

-- ---------------------------------------------
-- 2. 컬럼
-- ---------------------------------------------
ALTER TABLE exam.reference_texts
  ADD COLUMN IF NOT EXISTS units JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE exam.reference_texts
  ADD COLUMN IF NOT EXISTS grammar_paths TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE exam.reference_texts
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------
-- 3. 제약 (지우고 다시 — 멱등)
-- ---------------------------------------------
ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_units_shape;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_units_shape
  CHECK (exam.reference_units_valid(units));

-- problems_grammar_paths_max 와 같은 상한 (GRAMMAR_MAX_TAGS)
ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_grammar_paths_max;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_grammar_paths_max
  CHECK (cardinality(grammar_paths) <= 5);

-- 한 줄 메모 (REFERENCE_NOTE_MAX)
ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_note_len;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_note_len
  CHECK (length(note) <= 200);

-- ---------------------------------------------
-- 4. 인덱스
-- ---------------------------------------------
-- 단원은 `@>` 로만 찾는다 → jsonb_path_ops(작고 빠르다, @> 전용)
CREATE INDEX IF NOT EXISTS idx_reference_texts_units
  ON exam.reference_texts USING GIN (units jsonb_path_ops);
-- 문법 상위 검색이 && 라 GIN 이 그대로 쓰인다(sql/21 과 같다)
CREATE INDEX IF NOT EXISTS idx_reference_texts_grammar_paths
  ON exam.reference_texts USING GIN (grammar_paths);

-- ---------------------------------------------
-- 5. 주석 · 스키마 캐시
-- ---------------------------------------------
COMMENT ON COLUMN exam.reference_texts.units IS
  '실린 교과서 단원들 — [{grade, textbook, semester, unit_path:[대단원(, 소단원)]}] (최대 8). '
  '카테고리 관리의 이름 스냅샷(id 아님). 학교 축은 없다. 찾기는 units @> ''[{…}]''.';
COMMENT ON COLUMN exam.reference_texts.grammar_paths IS
  '문법 분류 — problems.grammar_paths 와 같은 모양(''단어 > 품사 > 명사'', 최대 5). 상위 검색은 &&.';
COMMENT ON COLUMN exam.reference_texts.note IS
  '판본 메모 — 같은 작품을 교과서마다 다른 본문으로 따로 올릴 때 가르는 한 줄(최대 200자).';
COMMENT ON FUNCTION exam.reference_units_valid(JSONB) IS
  'reference_texts.units 모양 검사 (CHECK 전용). 상한은 앱 상수 REFERENCE_UNITS_MAX·UNIT_DEPTH_MAX 와 같다.';

-- PostgREST 스키마 캐시 갱신 — 없으면 배포 직후 새 컬럼이 PGRST204/42703 이 된다
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 6. 자가 검증 — 앱과 같은 길(authenticated + 교직원 JWT)로 넣고 되돌린다
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → 역할을 바꿔야 정책·권한·CHECK 함수 실행 권한까지 잰다.
-- ⚠️ JWT 의 sub 는 **진짜 사용자**여야 한다: enforce_user_id_from_auth 가 user_id 를 auth.uid() 로
--    덮는데 user_id 는 auth.users FK 라 가짜 UUID 면 FK 에 걸린다(sql/57 처럼 임의 UUID 를 못 쓴다).
-- 모든 변경은 일부러 던진 예외로 하위 트랜잭션째 되돌린다(sql/33·sql/57 과 같은 수).
DO $probe$
DECLARE
  v_user    UUID;
  v_email   TEXT;
  v_id      UUID;
  v_n       INT;
  v_blocked INT := 0;
  v_row     exam.reference_texts%ROWTYPE;
  v_two     CONSTANT JSONB := '[
    {"grade":"중2","textbook":"천재(노미숙)","semester":"1학기","unit_path":["1. 문학, 그리고 삶","(1) 시"]},
    {"grade":"중3","textbook":"비상(김진수)","semester":"2학기","unit_path":["3. 소설의 세계"]}
  ]';
BEGIN
  SELECT id, email INTO v_user, v_email
    FROM auth.users WHERE email LIKE '%@araeducation.co.kr'
   ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'sql/60 probe 건너뜀: 학원 도메인 사용자가 없다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', v_email
    )::text, true);

    -- ① 새 칸 없이 넣으면(옛 앱·다른 경로) 기본값이고, 기존 트리거는 그대로 돈다
    INSERT INTO exam.reference_texts (title, body)
      VALUES ('__sql60_probe__', '본문 다섯자')
      RETURNING * INTO v_row;
    v_id := v_row.id;
    IF v_row.units <> '[]'::jsonb OR v_row.grammar_paths <> '{}' OR v_row.note <> ''
       OR v_row.char_count <> 6 OR v_row.user_id <> v_user THEN
      RAISE EXCEPTION 'probe ① 실패: units=% grammar=% note=% chars=% user=%',
        v_row.units, v_row.grammar_paths, v_row.note, v_row.char_count, v_row.user_id;
    END IF;

    -- ② 앱이 보내는 모양 그대로 고친다 (단원 둘 · 문법 하나 · 메모)
    UPDATE exam.reference_texts
       SET units = v_two, grammar_paths = ARRAY['단어 > 품사 > 명사'], note = '교학사 수록본'
     WHERE id = v_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION 'probe ② 실패: 교직원이 고치지 못한다 (%행)', v_n; END IF;

    -- ③ 찾기 — 대단원만 줘도 그 아래 소단원 단원이 걸린다(쉼표 든 이름 포함), 학년이 다르면 안 걸린다
    SELECT count(*) INTO v_n FROM exam.reference_texts
     WHERE id = v_id
       AND units @> '[{"grade":"중2","textbook":"천재(노미숙)","unit_path":["1. 문학, 그리고 삶"]}]';
    IF v_n <> 1 THEN RAISE EXCEPTION 'probe ③ 실패: 대단원 접두 검색이 안 걸린다'; END IF;
    SELECT count(*) INTO v_n FROM exam.reference_texts
     WHERE id = v_id AND units @> '[{"grade":"중1","textbook":"천재(노미숙)"}]';
    IF v_n <> 0 THEN RAISE EXCEPTION 'probe ③ 실패: 다른 학년이 걸린다'; END IF;
    -- 두 단원의 칸을 섞어 한 원소처럼 찾으면 안 걸려야 한다(원소 단위 비교)
    SELECT count(*) INTO v_n FROM exam.reference_texts
     WHERE id = v_id AND units @> '[{"grade":"중2","textbook":"비상(김진수)"}]';
    IF v_n <> 0 THEN RAISE EXCEPTION 'probe ③ 실패: 다른 단원의 칸이 섞여 걸린다'; END IF;
    SELECT count(*) INTO v_n FROM exam.reference_texts
     WHERE id = v_id AND grammar_paths && ARRAY['단어 > 품사', '단어 > 품사 > 명사'];
    IF v_n <> 1 THEN RAISE EXCEPTION 'probe ③ 실패: 문법 상위 검색이 안 걸린다'; END IF;

    -- ④ 모양 위반은 하나하나 CHECK 에 막힌다
    BEGIN UPDATE exam.reference_texts SET units = '{}'::jsonb WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET units = '[{"grade":"중2","textbook":"천재","semester":""}]' WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET units = '[{"grade":"중2","textbook":"천재","semester":"","unit_path":["가","나","다"]}]' WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET units = '[{"grade":"중2","textbook":"  ","semester":"","unit_path":["가"]}]' WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET units = '[{"grade":"중2","textbook":"천재","semester":"","unit_path":[" "]}]' WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts
            SET units = (SELECT jsonb_agg(jsonb_build_object(
                  'grade','중2','textbook','천재','semester','','unit_path', jsonb_build_array(i::text)))
                 FROM generate_series(1, 9) AS i)
          WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET grammar_paths = ARRAY['a','b','c','d','e','f'] WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET note = repeat('가', 201) WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    IF v_blocked <> 8 THEN
      RAISE EXCEPTION 'probe ④ 실패: 위반 8종 가운데 %종만 막혔다', v_blocked;
    END IF;

    -- ⑤ 상한 그대로(단원 8 · 문법 5 · 메모 200자)는 들어간다
    UPDATE exam.reference_texts
       SET units = (SELECT jsonb_agg(jsonb_build_object(
             'grade','고1','textbook','미래엔','semester','','unit_path', jsonb_build_array(i::text, '(1) 소')))
            FROM generate_series(1, 8) AS i),
           grammar_paths = ARRAY['a','b','c','d','e'],
           note = repeat('가', 200)
     WHERE id = v_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION 'probe ⑤ 실패: 상한 그대로가 막힌다'; END IF;

    -- ⑥ 지우기도 교직원 권한으로 된다(정책을 건드리지 않았다)
    DELETE FROM exam.reference_texts WHERE id = v_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION 'probe ⑥ 실패: 교직원이 지우지 못한다 (%행)', v_n; END IF;

    RAISE EXCEPTION '__sql60_probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__sql60_probe_rollback__' THEN
      RAISE;
    END IF;
  END;

  -- 하위 트랜잭션이 되돌아가며 역할·JWT 도 되돌아갔는지, 검증 행이 남지 않았는지
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/60: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.reference_texts WHERE title = '__sql60_probe__') THEN
    RAISE EXCEPTION 'sql/60: 검증 행이 남았다';
  END IF;
  RAISE NOTICE '✓ sql/60 자가 검증 6단계 통과 (교직원 JWT · 넣은 행은 전부 되돌렸습니다)';
END
$probe$;

-- ---------------------------------------------
-- 7. 적용 결과 (NOTICE 로 남긴다 — 실행기가 SELECT 결과를 찍지 않는다)
-- ---------------------------------------------
DO $report$
DECLARE
  v_cols TEXT;
  v_cons TEXT;
  v_idx  TEXT;
  v_rows INT;
BEGIN
  SELECT string_agg(column_name || ':' || data_type || '=' || column_default, ', ' ORDER BY column_name)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'exam' AND table_name = 'reference_texts'
     AND column_name IN ('units', 'grammar_paths', 'note');
  SELECT string_agg(conname, ', ' ORDER BY conname) INTO v_cons
    FROM pg_constraint
   WHERE conrelid = 'exam.reference_texts'::regclass
     AND conname IN ('reference_texts_units_shape', 'reference_texts_grammar_paths_max',
                     'reference_texts_note_len');
  SELECT string_agg(indexname, ', ' ORDER BY indexname) INTO v_idx
    FROM pg_indexes
   WHERE schemaname = 'exam' AND tablename = 'reference_texts'
     AND indexname IN ('idx_reference_texts_units', 'idx_reference_texts_grammar_paths');
  SELECT count(*) INTO v_rows FROM exam.reference_texts WHERE NOT exam.reference_units_valid(units);

  RAISE NOTICE 'sql/60 컬럼: %', v_cols;
  RAISE NOTICE 'sql/60 제약: %', v_cons;
  RAISE NOTICE 'sql/60 인덱스: %', v_idx;
  RAISE NOTICE 'sql/60 모양이 어긋난 행: %건 (0 이어야 한다)', v_rows;

  IF v_cols IS NULL OR array_length(string_to_array(v_cols, ', '), 1) <> 3
     OR v_cons IS NULL OR array_length(string_to_array(v_cons, ', '), 1) <> 3
     OR v_idx IS NULL OR array_length(string_to_array(v_idx, ', '), 1) <> 2
     OR v_rows <> 0 THEN
    RAISE EXCEPTION 'sql/60 적용 결과가 기대와 다르다 — 위 NOTICE 를 확인하세요';
  END IF;
END
$report$;
