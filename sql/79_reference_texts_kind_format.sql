-- =============================================
-- 79. 작품 전문 · 개념 — 종류(작품/개념) · 본문 형식(평문/HTML) · 차례 · 태그 · 적재 열쇠
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/79_reference_texts_kind_format.sql
-- =============================================
-- 배경:
--   원장님 요청(2026-10-28): "평가문제집에 모든 단원의 내용이 있으니 이걸 토대로 작품 전문을 적어 내려가고,
--   전문에는 문법 개념이나 여러 개념들도 — 전문이 아닌 개념 파트로. 교과서 단원으로 카테고리도."
--   그래서 한 표(reference_texts)가 **작품 전문**과 **개념 정리**를 함께 담는다(kind 로 가른다).
--   개념지(concept_sheets — 인쇄·채점용 빈칸 시험지)와는 다른 것이다.
--
-- ⚠️ 표가 비어 있을 때(2026-10-28 운영 0행) 들어간다 — 기본값('작품','text')이 곧 옛 행의 뜻이라 백필이 없다.
-- ⚠️ format 'html' 본문은 문항 정화기(sanitizeProblemHTML, 지문 프로필)를 지난 값이다 — 앱이 저장할 때 정화하고
--    그릴 때도 다시 정화한다. DB 는 모양을 검사하지 않는다(sql/60 의 'CHECK 는 거절만' 규약과 같은 결).
-- ⚠️ char_count 는 html 이면 **태그를 벗긴 길이**다(목록의 'n자' 가 마크업 길이가 되지 않게). 엔티티는 풀지 않는다
--    — 목록 표시용 어림값이라 그 정도 차이는 감수한다.
-- ⚠️ source_key 는 헤드리스 적재(~/.claude/tools/ingest-reference-texts.js)의 멱등 열쇠다. 앱은 보내지 않는다.
-- ⚠️ 상한(태그 8 · 차례 9999)은 앱 constants.ts 와 같아야 한다.
-- ⚠️ 적용 순서: **앱 배포보다 먼저** — 목록이 새 칸을 select 하므로 앱이 먼저 나가면 /reference-texts 가 42703 으로 죽는다.

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION 'exam 스키마가 없습니다 (현재 DB: %).', current_database();
  END IF;
  IF to_regclass('exam.reference_texts') IS NULL THEN
    RAISE EXCEPTION 'sql/30(작품 전문)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  IF to_regprocedure('exam.reference_units_valid(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'sql/60(단원·문법·판본 메모)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 칸
-- ---------------------------------------------
ALTER TABLE exam.reference_texts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT '작품';
ALTER TABLE exam.reference_texts ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'text';
ALTER TABLE exam.reference_texts ADD COLUMN IF NOT EXISTS seq INTEGER;
ALTER TABLE exam.reference_texts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE exam.reference_texts ADD COLUMN IF NOT EXISTS source_key TEXT;

-- ---------------------------------------------
-- 2. 제약 (지우고 다시 — 멱등)
-- ---------------------------------------------
ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_kind_valid;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_kind_valid CHECK (kind IN ('작품', '개념'));

ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_format_valid;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_format_valid CHECK (format IN ('text', 'html'));

ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_seq_range;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_seq_range
  CHECK (seq IS NULL OR seq BETWEEN 0 AND 9999);

-- REFERENCE_TAGS_MAX
ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_tags_max;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_tags_max CHECK (cardinality(tags) <= 8);

-- ---------------------------------------------
-- 3. 인덱스
-- ---------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_reference_texts_source_key
  ON exam.reference_texts (source_key) WHERE source_key IS NOT NULL;
-- 단원 축의 차례(개념 → 차례 → 제목)
CREATE INDEX IF NOT EXISTS idx_reference_texts_kind_seq ON exam.reference_texts (kind, seq, title);

-- ---------------------------------------------
-- 4. 글자 수 — html 이면 태그를 벗긴 길이
-- ---------------------------------------------
-- 이름·순서(`ab_`)는 sql/30 그대로다 — aa_enforce_user_id 뒤, audit 앞.
CREATE OR REPLACE FUNCTION exam.reference_texts_fill_char_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = exam, pg_temp
AS $$
BEGIN
  NEW.char_count := length(
    CASE WHEN NEW.format = 'html' THEN regexp_replace(NEW.body, '<[^>]*>', '', 'g') ELSE NEW.body END
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------
-- 5. 주석 · 스키마 캐시
-- ---------------------------------------------
COMMENT ON COLUMN exam.reference_texts.kind IS
  '작품(작품 전문) | 개념(단원 핵심 정리·제재 개관). 개념지(concept_sheets)와 다른 것이다. sql/79';
COMMENT ON COLUMN exam.reference_texts.format IS
  'text = 평문 본문 | html = 문항 정화기(sanitizeProblemHTML) 프로필 HTML. sql/79';
COMMENT ON COLUMN exam.reference_texts.seq IS '단원 안 차례(작을수록 앞, NULL 은 맨 뒤). sql/79';
COMMENT ON COLUMN exam.reference_texts.tags IS
  '구역·성격 꼬리표(학습 목표·핵심 정리·더 읽어 보기 …, 최대 8). sql/79';
COMMENT ON COLUMN exam.reference_texts.source_key IS
  '헤드리스 적재의 멱등 열쇠(평가문제집|교과서|…). 앱은 보내지 않는다. sql/79';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 6. 자가 검증 — 교직원 JWT 로 넣고 되돌린다(sql/60 과 같은 수)
-- ---------------------------------------------
DO $probe$
DECLARE
  v_user    UUID;
  v_email   TEXT;
  v_id      UUID;
  v_n       INT;
  v_blocked INT := 0;
  v_row     exam.reference_texts%ROWTYPE;
BEGIN
  SELECT id, email INTO v_user, v_email
    FROM auth.users WHERE email LIKE '%@araeducation.co.kr'
   ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'sql/79 probe 건너뜀: 학원 도메인 사용자가 없다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', v_email
    )::text, true);

    -- ① 새 칸 없이 넣으면(옛 앱) 기본값 — 작품 · 평문 · 차례 없음 · 태그 없음 · 열쇠 없음
    INSERT INTO exam.reference_texts (title, body) VALUES ('__sql79_probe__', '본문 다섯자')
      RETURNING * INTO v_row;
    v_id := v_row.id;
    IF v_row.kind <> '작품' OR v_row.format <> 'text' OR v_row.seq IS NOT NULL
       OR v_row.tags <> '{}' OR v_row.source_key IS NOT NULL OR v_row.char_count <> 6 THEN
      RAISE EXCEPTION 'probe ① 실패: kind=% format=% seq=% tags=% key=% chars=%',
        v_row.kind, v_row.format, v_row.seq, v_row.tags, v_row.source_key, v_row.char_count;
    END IF;

    -- ② 개념 · html — 글자 수는 태그를 벗긴 길이
    UPDATE exam.reference_texts
       SET kind = '개념', format = 'html', seq = 3, tags = ARRAY['핵심 정리'],
           source_key = '__sql79_probe__:1', body = '<p>가나다</p><table><tr><td>라</td></tr></table>'
     WHERE id = v_id
     RETURNING * INTO v_row;
    IF v_row.char_count <> 4 OR v_row.kind <> '개념' OR v_row.seq <> 3 THEN
      RAISE EXCEPTION 'probe ② 실패: chars=% kind=% seq=%', v_row.char_count, v_row.kind, v_row.seq;
    END IF;

    -- ③ 모양 위반은 하나하나 CHECK 에 막힌다
    BEGIN UPDATE exam.reference_texts SET kind = '시' WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET format = 'md' WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET seq = -1 WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET seq = 10000 WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    BEGIN UPDATE exam.reference_texts SET tags = ARRAY['1','2','3','4','5','6','7','8','9'] WHERE id = v_id;
    EXCEPTION WHEN check_violation THEN v_blocked := v_blocked + 1; END;
    IF v_blocked <> 5 THEN
      RAISE EXCEPTION 'probe ③ 실패: 위반 5종 가운데 %종만 막혔다', v_blocked;
    END IF;

    -- ④ 같은 적재 열쇠는 둘이 될 수 없다 · 열쇠 없는 행은 몇 개든 된다
    BEGIN
      INSERT INTO exam.reference_texts (title, body, source_key) VALUES ('__sql79_probe__', 'x', '__sql79_probe__:1');
      RAISE EXCEPTION 'probe ④ 실패: 같은 source_key 가 들어갔다';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    INSERT INTO exam.reference_texts (title, body) VALUES ('__sql79_probe__', 'y'), ('__sql79_probe__', 'z');

    -- ⑤ 상한 그대로(태그 8 · 차례 0·9999)는 들어간다
    UPDATE exam.reference_texts SET tags = ARRAY['1','2','3','4','5','6','7','8'], seq = 9999 WHERE id = v_id;
    UPDATE exam.reference_texts SET seq = 0 WHERE id = v_id;

    -- ⑥ 지우기도 교직원 권한으로 된다
    DELETE FROM exam.reference_texts WHERE title = '__sql79_probe__';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 3 THEN RAISE EXCEPTION 'probe ⑥ 실패: % 행만 지워졌다', v_n; END IF;

    RAISE EXCEPTION '__sql79_probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__sql79_probe_rollback__' THEN RAISE; END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/79: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.reference_texts WHERE title = '__sql79_probe__') THEN
    RAISE EXCEPTION 'sql/79: 검증 행이 남았다';
  END IF;
  RAISE NOTICE '✓ sql/79 자가 검증 6단계 통과 (교직원 JWT · 넣은 행은 전부 되돌렸습니다)';
END
$probe$;

-- ---------------------------------------------
-- 7. 적용 결과
-- ---------------------------------------------
DO $report$
DECLARE
  v_cols INT;
  v_cons INT;
  v_idx  INT;
BEGIN
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'exam' AND table_name = 'reference_texts'
     AND column_name IN ('kind', 'format', 'seq', 'tags', 'source_key');
  SELECT count(*) INTO v_cons FROM pg_constraint
   WHERE conrelid = 'exam.reference_texts'::regclass
     AND conname IN ('reference_texts_kind_valid', 'reference_texts_format_valid',
                     'reference_texts_seq_range', 'reference_texts_tags_max');
  SELECT count(*) INTO v_idx FROM pg_indexes
   WHERE schemaname = 'exam' AND tablename = 'reference_texts'
     AND indexname IN ('idx_reference_texts_source_key', 'idx_reference_texts_kind_seq');
  RAISE NOTICE 'sql/79 칸 %/5 · 제약 %/4 · 인덱스 %/2', v_cols, v_cons, v_idx;
  IF v_cols <> 5 OR v_cons <> 4 OR v_idx <> 2 THEN
    RAISE EXCEPTION 'sql/79 적용 결과가 기대와 다르다';
  END IF;
END
$report$;
