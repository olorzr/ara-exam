-- =============================================
-- 102. 붙어 보이는 글 — 제재 정리는 작품 맨 위에, 단원 총괄의 여백 글은 총괄 오른쪽에
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/102_reference_texts_attached_to.sql
-- =============================================
-- 배경: 원장님(2026-11-07 저녁) "차례대로 이어 붙이지 말고, 오른쪽 여백(설명 쓰는 곳)에 자습서나 평가문제집이 개념 넣듯이 넣어 줘.
--   제재 정리는 항상 지문의 맨 위에." 묶음(sql/98)을 다른 글의 화면 안에 보이게 하려고 '어디에 붙어 보이는가' 칸을 둔다.
-- ⚠️ part_of(sql/98)와 다른 관계다. part_of 는 '이 묶음의 재료' 라 묶음을 지우면 함께 지워진다(CASCADE).
--    attached_to 는 '이 글의 화면에 붙어 보인다' 뿐이라 붙은 곳을 지우면 비워진다(SET NULL) — 작품을 지워도 제재 정리와 그 낱개는
--    남아 목록에 다시 보인다. part_of 로 붙였다면 작품 하나를 지운 것만으로 개념 여러 편이 말없이 사라진다.
-- ⚠️ 숨김이지 권한이 아니다. 앱 목록·트리·고르기는 part_of 와 attached_to 가 둘 다 빈 행만 보인다. 주소로 열면 그대로 열린다.
-- ⚠️ 쓰는 것은 묶기 도구(~/.claude/tools/regroup-concepts.js)뿐이다. 앱은 읽기만 한다.
-- ⚠️ 적용 순서: **앱 배포보다 먼저** — 새 앱이 이 칸으로 거르고 고른다. 옛 앱은 칸을 이름으로 골라 영향이 없다.

DO $guard$
BEGIN
  IF to_regclass('exam.reference_texts') IS NULL THEN
    RAISE EXCEPTION 'sql/102: exam.reference_texts 가 없습니다 (현재 DB: %).', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'exam.reference_texts'::regclass AND attname = 'part_of' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'sql/102: sql/98 이 먼저 적용돼야 합니다 (현재 DB: %).', current_database();
  END IF;
END
$guard$;

ALTER TABLE exam.reference_texts
  ADD COLUMN IF NOT EXISTS attached_to UUID REFERENCES exam.reference_texts(id) ON DELETE SET NULL;

ALTER TABLE exam.reference_texts DROP CONSTRAINT IF EXISTS reference_texts_attached_to_not_self;
ALTER TABLE exam.reference_texts ADD CONSTRAINT reference_texts_attached_to_not_self
  CHECK (attached_to IS NULL OR attached_to <> id);

CREATE INDEX IF NOT EXISTS idx_reference_texts_attached_to
  ON exam.reference_texts (attached_to) WHERE attached_to IS NOT NULL;

COMMENT ON COLUMN exam.reference_texts.attached_to IS
  '이 글이 붙어 보이는 글(제재 정리 → 작품 맨 위, 단원 총괄 여백 → 총괄 오른쪽). 있으면 목록·트리·고르기에서 숨긴다. 붙은 곳을 지우면 비워진다. 묶기 도구만 쓴다. sql/102';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 자가 검증 — 쓰기는 원장만이라(sql/84) 원장 JWT 로 넣고 되돌린다
-- ---------------------------------------------
DO $probe$
DECLARE
  v_director UUID;
  v_host     UUID;
  v_guest    UUID;
  v_part     UUID;
  v_blocked  BOOLEAN := false;
  v_row      exam.reference_texts%ROWTYPE;
BEGIN
  SELECT id INTO v_director FROM auth.users WHERE email = 'ara0723@araeducation.co.kr' LIMIT 1;
  IF v_director IS NULL THEN
    RAISE NOTICE 'sql/102 probe 건너뜀: 원장 계정이 없다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_director::text, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr')::text, true);

    -- ① 붙은 글과 그 재료 하나
    INSERT INTO exam.reference_texts (title, body) VALUES ('__sql102_probe_host__', '작품') RETURNING id INTO v_host;
    INSERT INTO exam.reference_texts (title, body, kind, attached_to) VALUES ('__sql102_probe_guest__', '제재 정리', '개념', v_host)
      RETURNING id INTO v_guest;
    INSERT INTO exam.reference_texts (title, body, kind, part_of) VALUES ('__sql102_probe_part__', '낱개', '개념', v_guest)
      RETURNING id INTO v_part;

    -- ② 자기 자신에게는 못 붙는다
    BEGIN
      UPDATE exam.reference_texts SET attached_to = id WHERE id = v_guest;
    EXCEPTION WHEN check_violation THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION 'probe ② 실패: 자기 자신에게 붙었다'; END IF;

    -- ③ 붙은 곳(작품)을 지우면 붙은 글은 남고 칸만 비워진다 — 재료(낱개)도 그대로다
    DELETE FROM exam.reference_texts WHERE id = v_host;
    SELECT * INTO v_row FROM exam.reference_texts WHERE id = v_guest;
    IF NOT FOUND OR v_row.attached_to IS NOT NULL THEN
      RAISE EXCEPTION 'probe ③ 실패: 작품을 지웠더니 붙은 글이 사라졌거나 칸이 남았다';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM exam.reference_texts WHERE id = v_part AND part_of = v_guest) THEN
      RAISE EXCEPTION 'probe ③ 실패: 붙은 글의 재료가 사라졌다';
    END IF;

    RAISE EXCEPTION '__sql102_probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__sql102_probe_rollback__' THEN RAISE; END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/102: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.reference_texts WHERE title LIKE '__sql102_probe_%') THEN
    RAISE EXCEPTION 'sql/102: 검증 행이 남았다';
  END IF;
  RAISE NOTICE '✓ sql/102 자가 검증 3단계 통과 (원장 JWT · 넣은 행은 전부 되돌렸습니다)';
END
$probe$;

DO $report$
DECLARE
  v_fk  TEXT;
  v_idx INT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_fk FROM pg_constraint
   WHERE conrelid = 'exam.reference_texts'::regclass AND contype = 'f'
     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'exam.reference_texts'::regclass AND attname = 'attached_to')];
  SELECT count(*) INTO v_idx FROM pg_indexes
   WHERE schemaname = 'exam' AND tablename = 'reference_texts' AND indexname = 'idx_reference_texts_attached_to';
  RAISE NOTICE 'sql/102 인덱스 %/1 · 외래 키 %', v_idx, v_fk;
  IF v_idx <> 1 OR v_fk NOT LIKE '%ON DELETE SET NULL%' THEN
    RAISE EXCEPTION 'sql/102 적용 결과가 기대와 다르다';
  END IF;
END
$report$;
