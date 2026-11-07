-- =============================================
-- 98. 개념 묶음 — 낱개 개념을 단원 총괄·제재 정리의 '부분' 으로 숨긴다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/98_reference_texts_part_of.sql
-- =============================================
-- 배경: 원장님(2026-11-07) "작품 개념들이 너무 중구난방이야. 단원별로 단원 전체를 아우르는 개념 1개, 지문당 개념 1묶음."
--   평가문제집 개념은 전사 구역마다 쪼개져 한 소단원에 5~10행(많게는 35행)이 따로 선다.
--   묶음 행은 저장소 밖 도구(~/.claude/tools/regroup-concepts.js)가 짓고, 낱개 행은 지우지 않고 part_of 로 숨긴다.
--   앞으로 들어오는 구역을 적재하면 같은 도구가 묶음을 다시 짓기 때문이다 — 낱개를 지우면 다시 지을 재료가 없다.
-- ⚠️ part_of 는 숨김이지 권한이 아니다. 주소로 열면 낱개 행도 그대로 보인다. RLS·트리거는 손대지 않았다.
-- ⚠️ 묶음을 지우면 그 부분도 함께 지워진다(ON DELETE CASCADE). 도구는 부분을 옮긴 **뒤에** 빈 묶음을 지운다.
-- ⚠️ bundle_digest 는 도구가 마지막으로 쓴 본문의 md5 다. 앱은 읽지도 보내지도 않는다. 지금 본문과 다르면 원장이 앱에서
--    고친 것이라 도구가 그 묶음을 덮지 않는다. note 에 두면 선생님 화면에 그 값이 찍혀서 칸을 따로 뒀다.
-- ⚠️ 적용 순서: **앱 배포보다 먼저** — 새 앱이 part_of 로 거르고 고른다. 옛 앱은 칸을 이름으로 골라 영향이 없다.

DO $guard$
BEGIN
  IF to_regclass('exam.reference_texts') IS NULL THEN
    RAISE EXCEPTION 'sql/98: exam.reference_texts 가 없습니다 (현재 DB: %).', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'exam.reference_texts'::regclass AND attname = 'source_key' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'sql/98: sql/79 가 먼저 적용돼야 합니다 (현재 DB: %).', current_database();
  END IF;
END
$guard$;

ALTER TABLE exam.reference_texts
  ADD COLUMN IF NOT EXISTS part_of UUID REFERENCES exam.reference_texts(id) ON DELETE CASCADE;
ALTER TABLE exam.reference_texts ADD COLUMN IF NOT EXISTS bundle_digest TEXT;

ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_part_of_not_self;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_part_of_not_self
  CHECK (part_of IS NULL OR part_of <> id);

CREATE INDEX IF NOT EXISTS idx_reference_texts_part_of
  ON exam.reference_texts (part_of) WHERE part_of IS NOT NULL;

COMMENT ON COLUMN exam.reference_texts.part_of IS
  '이 행이 든 묶음(단원 총괄·제재 정리). 있으면 목록·트리·고르기에서 숨긴다. 숨김이지 권한이 아니다. 적재 도구만 쓴다. sql/98';
COMMENT ON COLUMN exam.reference_texts.bundle_digest IS
  '묶음 도구가 마지막으로 쓴 본문의 md5. 지금 본문과 다르면 앱에서 고친 것이라 도구가 덮지 않는다. 앱은 읽지도 보내지도 않는다. sql/98';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 자가 검증 — 쓰기는 원장만이라(sql/84) 원장 JWT 로 넣고 되돌린다
-- ---------------------------------------------
DO $probe$
DECLARE
  v_director UUID;
  v_bundle   UUID;
  v_part     UUID;
  v_blocked  BOOLEAN := false;
  v_left     INT;
BEGIN
  SELECT id INTO v_director FROM auth.users WHERE email = 'ara0723@araeducation.co.kr' LIMIT 1;
  IF v_director IS NULL THEN
    RAISE NOTICE 'sql/98 probe 건너뜀: 원장 계정이 없다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_director::text, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr')::text, true);

    -- ① 새 칸 없이 넣으면(옛 앱) 둘 다 비어 있다
    INSERT INTO exam.reference_texts (title, body) VALUES ('__sql98_probe_bundle__', '묶음') RETURNING id INTO v_bundle;
    IF EXISTS (SELECT 1 FROM exam.reference_texts WHERE id = v_bundle AND (part_of IS NOT NULL OR bundle_digest IS NOT NULL)) THEN
      RAISE EXCEPTION 'probe ① 실패: 새 칸의 기본값이 비어 있지 않다';
    END IF;

    -- ② 부분이 묶음을 가리킨다
    INSERT INTO exam.reference_texts (title, body, part_of) VALUES ('__sql98_probe_part__', '부분', v_bundle) RETURNING id INTO v_part;

    -- ③ 자기 자신을 가리키면 막힌다
    BEGIN
      UPDATE exam.reference_texts SET part_of = id WHERE id = v_bundle;
    EXCEPTION WHEN check_violation THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION 'probe ③ 실패: 자기 자신을 가리키는 행이 들어갔다'; END IF;

    -- ④ 묶음을 지우면 부분도 사라진다
    DELETE FROM exam.reference_texts WHERE id = v_bundle;
    SELECT count(*) INTO v_left FROM exam.reference_texts WHERE id = v_part;
    IF v_left <> 0 THEN RAISE EXCEPTION 'probe ④ 실패: 묶음을 지웠는데 부분이 남았다'; END IF;

    RAISE EXCEPTION '__sql98_probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__sql98_probe_rollback__' THEN RAISE; END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/98: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.reference_texts WHERE title LIKE '__sql98_probe_%') THEN
    RAISE EXCEPTION 'sql/98: 검증 행이 남았다';
  END IF;
  RAISE NOTICE '✓ sql/98 자가 검증 4단계 통과 (원장 JWT · 넣은 행은 전부 되돌렸습니다)';
END
$probe$;

DO $report$
DECLARE
  v_cols INT;
  v_fk   TEXT;
  v_idx  INT;
BEGIN
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'exam' AND table_name = 'reference_texts' AND column_name IN ('part_of', 'bundle_digest');
  SELECT pg_get_constraintdef(oid) INTO v_fk FROM pg_constraint
   WHERE conrelid = 'exam.reference_texts'::regclass AND contype = 'f'
     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'exam.reference_texts'::regclass AND attname = 'part_of')];
  SELECT count(*) INTO v_idx FROM pg_indexes
   WHERE schemaname = 'exam' AND tablename = 'reference_texts' AND indexname = 'idx_reference_texts_part_of';
  RAISE NOTICE 'sql/98 칸 %/2 · 인덱스 %/1 · 외래 키 %', v_cols, v_idx, v_fk;
  IF v_cols <> 2 OR v_idx <> 1 OR v_fk NOT LIKE '%ON DELETE CASCADE%' THEN
    RAISE EXCEPTION 'sql/98 적용 결과가 기대와 다르다';
  END IF;
END
$report$;
