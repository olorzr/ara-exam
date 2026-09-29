-- =============================================
-- 56. 학교 프린트 시험지를 직접 입력으로도 만든다 — print_bundles.source
-- =============================================
--
-- 왜:
--   원장님 요청(2026-09-30): "학교 프린트 시험지를 그냥 본인이 타이핑하게도 해 주라, 평범하게
--   개념지 올리듯이". 프린트 시험지는 이미 `concept_sheets` 행(+print_bundle_id)이라 편집기·
--   인쇄·성적 연동은 그대로 쓴다(sql/26). 막는 것은 하나뿐이다 — 묶음은 **원본 쪽이 1쪽
--   이상**이어야 했다(`print_bundles_pages_check`). 직접 입력한 시험지에는 원본 쪽이 없다.
--
-- 규칙:
--   · `source` 가 묶음이 어디서 왔는지 말한다 — 'scan'(스캔을 읽었다, 기본) · 'typed'(직접 입력).
--     앱은 이 값으로 '읽기'·쪽 수·원본 패널을 가른다. 옛 행은 전부 'scan' 이 된다.
--   · 쪽 제약은 **스캔 묶음에만** 건다. 스캔 묶음이 쪽 없이 들어오는 것은 여전히 막는다 —
--     그런 묶음은 읽을 것이 없어 목록에서 영영 '대기' 로 멈춘다.
--   · 직접 입력 묶음도 **스캔 행 하나에 매달린다**(파일 없는 스캔, file_path '', page_count 0).
--     `scan_id NOT NULL`·목록의 스캔 단위 묶기·CASCADE 삭제를 그대로 쓰려고 — 스캔 없이
--     두면 목록 조회·지우기·확인 문구를 전부 두 벌로 만들어야 한다.
--
-- 멱등: 컬럼은 IF NOT EXISTS, 제약은 지우고 같은 이름으로 다시 만든다.
-- 한 DO 블록 = 한 트랜잭션 — 쪽 제약을 지운 채 멈추는 일이 없다(sql/27 과 같은 까닭).
-- =============================================

DO $migrate$
BEGIN
  IF to_regclass('exam.print_bundles') IS NULL THEN
    RAISE EXCEPTION 'exam.print_bundles 가 없다 — 다른 프로젝트에 붙었는지 확인할 것 (db=%)', current_database();
  END IF;

  ALTER TABLE exam.print_bundles ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'scan';

  ALTER TABLE exam.print_bundles DROP CONSTRAINT IF EXISTS print_bundles_source_check;
  ALTER TABLE exam.print_bundles ADD CONSTRAINT print_bundles_source_check
    CHECK (source IN ('scan', 'typed'));

  ALTER TABLE exam.print_bundles DROP CONSTRAINT IF EXISTS print_bundles_pages_check;
  ALTER TABLE exam.print_bundles ADD CONSTRAINT print_bundles_pages_check
    CHECK (source = 'typed' OR cardinality(pages) >= 1);
END
$migrate$;

COMMENT ON COLUMN exam.print_bundles.source IS
  '묶음이 어디서 왔는가: scan(스캔을 읽음, 기본) · typed(직접 입력 — 원본 쪽이 없다, sql/56)';

-- 새 컬럼을 앱이 곧바로 넣는다 — PostgREST 가 옛 스키마를 들고 있으면 PGRST204 로 막힌다(코덱스 1R)
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 제약 정의를 읽고, 실제 행을 넣어 본 뒤 되돌린다
-- ---------------------------------------------
DO $verify$
DECLARE
  def TEXT;
  owner UUID;
  scan_id UUID := gen_random_uuid();
  typed_ok BOOLEAN := false;
  scan_blocked BOOLEAN := false;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint
   WHERE conrelid = 'exam.print_bundles'::regclass AND conname = 'print_bundles_pages_check';
  IF def IS NULL OR position('typed' IN def) = 0 THEN
    RAISE EXCEPTION '쪽 제약이 직접 입력을 모른다: %', def;
  END IF;

  -- 검증용 행의 주인 — 이미 스캔을 올린 사람 아무나(직접 접속이라 auth.uid() 가 없다)
  SELECT user_id INTO owner FROM exam.print_scans LIMIT 1;
  IF owner IS NULL THEN
    RAISE NOTICE 'sql/56: 스캔이 하나도 없어 행 검증은 건너뛴다 — 제약 정의는 %', def;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO exam.print_scans (id, title, file_path, page_count, user_id)
      VALUES (scan_id, 'sql/56 검증', '', 0, owner);
    INSERT INTO exam.print_bundles (scan_id, name, pages, status, source, user_id)
      VALUES (scan_id, 'sql/56 검증 — 직접 입력', '{}', '읽기완료', 'typed', owner);
    typed_ok := true;

    BEGIN
      INSERT INTO exam.print_bundles (scan_id, name, pages, user_id)
        VALUES (scan_id, 'sql/56 검증 — 쪽 없는 스캔', '{}', owner);
    EXCEPTION WHEN check_violation THEN
      scan_blocked := true;
    END;

    -- 넣은 행을 모두 되돌린다(감사 로그까지 함께 사라진다)
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'sql56_verify_rollback';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'sql56_verify_rollback' THEN RAISE; END IF;
  END;

  IF NOT typed_ok THEN RAISE EXCEPTION '직접 입력 묶음을 넣지 못했다'; END IF;
  IF NOT scan_blocked THEN RAISE EXCEPTION '쪽 없는 스캔 묶음이 막히지 않았다'; END IF;
  IF EXISTS (SELECT 1 FROM exam.print_scans WHERE id = scan_id) THEN
    RAISE EXCEPTION '검증용 스캔이 남았다';
  END IF;
  RAISE NOTICE 'sql/56 적용됨: 직접 입력 묶음은 들어가고 쪽 없는 스캔 묶음은 막힌다 — %', def;
END
$verify$;
