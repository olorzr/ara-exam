-- =============================================
-- 77. 책 만들기 — 표지만 항목(kind)과 다 만든 책(finished_at)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/77_books_kind_finished.sql
-- =============================================
-- 배경 (2026-10-26 원장 요청 "책만들기는 아예 새로 빼줘, 카테고리에서 대분류로. 소분류에 표지만들기를 따로 …
--   표지만 만들어야 할 수도 있거든 … 내지만들기 따로 … 다 만든 책 이런 식으로도"):
--   사이드바의 '책 만들기' 가 대분류가 되고 표지 만들기 · 내지 만들기 · 다 만든 책 세 화면으로 갈린다.
--
-- 칸 둘:
--   · kind        — 'book'(장을 담아 내지까지 만드는 책) / 'cover'(표지만 — 장이 없고 쪽 수를 직접 넣는다).
--                   기존 행은 기본값 'book' 이라 예전 그대로다.
--   · finished_at — '다 만들었어요' 를 누른 때. NULL 이면 아직 만드는 중(표지·내지 목록), 값이 있으면 '다 만든 책'.
--                   인쇄 여부는 기계가 알 수 없어 사람이 표시한다.
--
-- ⚠️ 표지만 항목의 쪽 수는 settings jsonb 의 manualPages {student|teacher|key: 쪽 수} 다(새 칸이 아니다 —
--   settings 의 다른 키와 같이 앱 normalizeBookSettings 가 정리한다). 내지 구성 지문(bookLayoutKey)에는 넣지 않는다.
--
-- RLS·GRANT·트리거는 바꾸지 않는다 — sql/76 의 정책은 행 단위(USING/WITH CHECK)이고 GRANT 는 표 단위라
--   새 칸에도 그대로 걸린다(원장 이메일에만 열림). 감사·updated_at·user_id 잠금 트리거도 칸 목록이 없다.
--
-- 적용 순서: **앱 배포보다 먼저**(책 화면이 두 칸을 select 한다 — 없으면 책 화면이 전부 400). 멱등.
-- 모든 DDL 은 `exam.` 으로 스키마를 명시한다.

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;
  IF to_regclass('exam.books') IS NULL THEN
    RAISE EXCEPTION 'exam.books 가 없습니다 (현재 DB: %). sql/76 을 먼저 적용하세요.', current_database();
  END IF;
END
$guard$;

ALTER TABLE exam.books ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'book';
ALTER TABLE exam.books DROP CONSTRAINT IF EXISTS books_kind_check;
ALTER TABLE exam.books ADD CONSTRAINT books_kind_check CHECK (kind IN ('book', 'cover'));
ALTER TABLE exam.books ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

COMMENT ON COLUMN exam.books.kind IS
  '종류 — book(장을 담아 내지까지 만드는 책) / cover(표지만, 장 없이 쪽 수를 settings.manualPages 에 직접 넣는다). 앱 BOOK_KINDS.';
COMMENT ON COLUMN exam.books.finished_at IS
  '다 만든 때 — NULL 이면 만드는 중(표지·내지 만들기 목록), 값이 있으면 다 만든 책 목록. 사람이 표시한다.';
COMMENT ON COLUMN exam.books.settings IS
  '설정 jsonb — innerPaper(열림인쇄 용지 코드) · columns · chapterStart · trimWorks · spineColor · spineText · backFill · manualPages(표지만 항목의 판별 쪽 수). 앱 normalizeBookSettings 가 정리.';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 칸·제약이 있고, 기존 행은 그대로이며, 모르는 종류는 막힌다 (되돌림)
-- ---------------------------------------------
DO $verify$
DECLARE
  v_cols    TEXT;
  v_check   TEXT;
  v_changed INT;
  v_total   INT;
  v_blocked BOOLEAN := false;
BEGIN
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY column_name) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'exam' AND table_name = 'books' AND column_name IN ('kind', 'finished_at');
  IF v_cols IS DISTINCT FROM 'finished_at:timestamp with time zone:YES,kind:text:NO' THEN
    RAISE EXCEPTION 'sql/77: 칸 모양이 다르다: %', v_cols;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_check
    FROM pg_constraint WHERE conrelid = 'exam.books'::regclass AND conname = 'books_kind_check';
  IF v_check IS NULL OR v_check NOT LIKE '%''book''%' OR v_check NOT LIKE '%''cover''%' THEN
    RAISE EXCEPTION 'sql/77: books_kind_check 가 다르다: %', v_check;
  END IF;

  SELECT count(*) FILTER (WHERE kind <> 'book' OR finished_at IS NOT NULL), count(*) INTO v_changed, v_total
    FROM exam.books;

  BEGIN
    BEGIN
      INSERT INTO exam.books (title, user_id, kind) VALUES ('sql77 검증', gen_random_uuid(), 'inner');
    EXCEPTION WHEN check_violation THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION '모르는 종류(inner)가 막히지 않았다'; END IF;
    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'sql/77 검증: 칸 % · 제약 % · 책 %권 중 book 아니거나 완성 표시된 것 %권 · 모르는 종류 거절 (되돌림)',
    v_cols, v_check, v_total, v_changed;
END
$verify$;
