-- =============================================
-- 76. 책 만들기 (books · book_chapters) — 원장 전용
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/76_books.sql
-- =============================================
-- 배경 (2026-10-25 원장 요청 "학원 문제은행을 기준으로 책을 만들꺼야. 책 만드는 메뉴는 나만 보이게"):
--   저장된 문제지 여러 장을 장(챕터)으로 묶어 한 권의 책(A4 무선제본)으로 뽑는다. 내지와 표지(뒷표지 · 책등 ·
--   앞표지 펼침면)를 열림인쇄에 따로 올리고, 책등(세네카) 폭은 앱이 인쇄소와 같은 식으로 계산한다.
--
-- 표 둘:
--   · books          — 제목 · 설정(jsonb) · 판별 잰 쪽 수(jsonb) · 표지(jsonb, 문제지 표지와 같은 모양)
--   · book_chapters  — 책 ↔ 문제지 차례. 장 제목을 따로 적을 수 있다
--
-- ⚠️ 원장 전용: 두 표 모두 RLS 가 **원장 이메일**에만 열린다(읽기도). 판정은 sql/57 과 같은 JWT 이메일 리터럴이다
--   (ara-system 함수에 매달지 않는다 — 그쪽 정의가 바뀌면 이 표의 권한이 이쪽 변경 없이 달라진다).
--   ⚠️ 원장 이메일이 바뀌면 함께: src/lib/constants.ts ADMIN_EMAIL · sql/03 · sql/57 · sql/65 · 이 파일.
--
-- ⚠️ 책에 담긴 문제지는 지울 수 없다(`paper_id … ON DELETE RESTRICT`). 참조 무결성 검사는 RLS 를 타지 않으므로
--   선생님이 지우려 해도 23503 으로 막힌다 — 앱(`deletePaper`)이 그 오류를 '책에 담긴 문제지' 안내로 바꾼다.
--   CASCADE 로 두면 선생님이 문제지 하나를 지운 것만으로 원장님 책의 장이 말없이 사라진다.
--
-- ⚠️ 책 표지 그림(`books/…`)은 문제 은행 버킷을 같이 쓰므로, 맨 아래에서 그 버킷의 저장소 정책 셋을 다시 만들어
--   `books/` 경로만 원장 이메일로 좁힌다(다른 경로는 예전 그대로).
--
-- ⚠️ 설정·쪽 수·표지는 jsonb 한 칸씩이고 CHECK 를 두지 않는다 — 원장님 혼자 쓰는 표라 읽을 때 앱 정규화
--   (`normalizeBookSettings` · `normalizePageCounts` · `normalizePaperCover`)가 모르는 값을 걸러 낸다.
--   표지 디자인 목록을 SQL 에 한 벌 더 베끼지 않으려는 판단이다(문제지 표지는 sql/75 CHECK 가 지킨다).
--
-- ⚠️ `(book_id, order_index)` 유일 제약은 DEFERRABLE INITIALLY DEFERRED 다 — 장 차례 바꾸기를 upsert 한 문장으로
--   보낼 때 문장 도중의 자리 겹침을 허용하고 커밋 때 검사한다(앱 `reorderChapters`).
--
-- 적용 순서: **앱 배포보다 먼저**(책 화면이 이 표를 조회한다). 멱등(IF NOT EXISTS · DROP … IF EXISTS).
-- 모든 DDL 은 `exam.` 으로 스키마를 명시한다.

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;

  IF to_regprocedure('exam.is_allowed_domain()') IS NULL
     OR to_regprocedure('exam.enforce_user_id_from_auth()') IS NULL
     OR to_regprocedure('exam.lock_user_id_on_update()') IS NULL
     OR to_regprocedure('exam.update_updated_at()') IS NULL
     OR to_regprocedure('exam.audit_problem_bank()') IS NULL
     OR to_regclass('exam.audit_log') IS NULL
     OR to_regclass('exam.problem_papers') IS NULL THEN
    RAISE EXCEPTION
      'exam 헬퍼 함수·audit_log·problem_papers 가 없습니다 (현재 DB: %). sql/17 이 적용된 공유 프로젝트에서 실행하세요.',
      current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. books
-- ---------------------------------------------
-- ⚠️ 기본 키는 `id` — 범용 감사 함수 `exam.audit_problem_bank()` 가 NEW.id/OLD.id 를 읽는다(sql/61 의 교훈).
CREATE TABLE IF NOT EXISTS exam.books (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 100),
  settings     JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_counts  JSONB NOT NULL DEFAULT '{}'::jsonb,
  cover        JSONB,
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  updated_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------
-- 2. book_chapters
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.book_chapters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         UUID NOT NULL REFERENCES exam.books(id) ON DELETE CASCADE,
  paper_id        UUID NOT NULL REFERENCES exam.problem_papers(id) ON DELETE RESTRICT,
  order_index     INT NOT NULL CHECK (order_index >= 0),
  title_override  TEXT NOT NULL DEFAULT '' CHECK (length(title_override) <= 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT book_chapters_book_paper_key UNIQUE (book_id, paper_id),
  CONSTRAINT book_chapters_book_order_key UNIQUE (book_id, order_index) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_book_chapters_paper ON exam.book_chapters (paper_id);
CREATE INDEX IF NOT EXISTS idx_books_recent ON exam.books (created_at DESC, id DESC);

-- ---------------------------------------------
-- 3. 트리거 — user_id 강제·잠금 · updated_at · 감사(books 만 — 장 차례 바꾸기는 소음이라 감사하지 않는다)
-- ---------------------------------------------
DROP TRIGGER IF EXISTS aa_enforce_user_id_books_insert ON exam.books;
CREATE TRIGGER aa_enforce_user_id_books_insert
  BEFORE INSERT ON exam.books
  FOR EACH ROW EXECUTE FUNCTION exam.enforce_user_id_from_auth();

DROP TRIGGER IF EXISTS aa_lock_user_id_books_update ON exam.books;
CREATE TRIGGER aa_lock_user_id_books_update
  BEFORE UPDATE ON exam.books
  FOR EACH ROW EXECUTE FUNCTION exam.lock_user_id_on_update();

DROP TRIGGER IF EXISTS books_updated_at ON exam.books;
CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON exam.books
  FOR EACH ROW EXECUTE FUNCTION exam.update_updated_at();

DROP TRIGGER IF EXISTS audit_books_insert ON exam.books;
CREATE TRIGGER audit_books_insert AFTER INSERT ON exam.books
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_books_update ON exam.books;
CREATE TRIGGER audit_books_update BEFORE UPDATE ON exam.books
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_books_delete ON exam.books;
CREATE TRIGGER audit_books_delete BEFORE DELETE ON exam.books
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

-- ---------------------------------------------
-- 4. RLS — 원장 전용 (sql/65 의 (select …) 꼴)
-- ---------------------------------------------
ALTER TABLE exam.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.book_chapters ENABLE ROW LEVEL SECURITY;

-- ⚠️ 리터럴은 src/lib/constants.ts ADMIN_EMAIL · sql/03 · sql/57 · sql/65 와 같아야 한다
DROP POLICY IF EXISTS "Director can manage books" ON exam.books;
CREATE POLICY "Director can manage books" ON exam.books
  USING (
    (select auth.role()) = 'authenticated'
    AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  )
  WITH CHECK (
    (select auth.role()) = 'authenticated'
    AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  );

DROP POLICY IF EXISTS "Director can manage book_chapters" ON exam.book_chapters;
CREATE POLICY "Director can manage book_chapters" ON exam.book_chapters
  USING (
    (select auth.role()) = 'authenticated'
    AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  )
  WITH CHECK (
    (select auth.role()) = 'authenticated'
    AND (select exam.is_allowed_domain())
    AND (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON exam.books TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON exam.book_chapters TO authenticated;
GRANT ALL ON exam.books TO service_role;
GRANT ALL ON exam.book_chapters TO service_role;

-- ---------------------------------------------
-- 5. 주석
-- ---------------------------------------------
COMMENT ON TABLE exam.books IS
  '책(원장 전용). 저장된 문제지를 장으로 묶어 A4 무선제본 내지·표지 펼침면을 뽑는다. 앱 src/lib/book.';
COMMENT ON COLUMN exam.books.settings IS
  '설정 jsonb — innerPaper(열림인쇄 용지 코드) · columns · chapterStart · trimWorks · spineColor · spineText · backFill. 앱 normalizeBookSettings 가 정리.';
COMMENT ON COLUMN exam.books.page_counts IS
  '판별 잰 쪽 수 jsonb {student|teacher|key: {pages, key}} — pages 는 4의 배수로 채운 총 쪽 수, key 는 내지 구성 지문(bookLayoutKey). 책등 두께는 저장하지 않고 그릴 때 계산한다.';
COMMENT ON COLUMN exam.books.cover IS
  '표지 jsonb — problem_paper_covers 한 행에서 paper_id 를 뺀 모양(앞·뒤표지). null 이면 표지 없음. 그림은 books/{id}/cover-{token}.jpg.';
COMMENT ON TABLE exam.book_chapters IS
  '책의 장 — 저장된 문제지 한 장. 차례는 order_index. 책에 담긴 문제지는 지울 수 없다(RESTRICT).';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 구조
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_triggers TEXT;
  v_policies INT;
  v_grants   TEXT;
  v_deferred BOOLEAN;
  v_delete   "char";
BEGIN
  SELECT string_agg(tgname, ',' ORDER BY tgname) INTO v_triggers
    FROM pg_trigger WHERE tgrelid = 'exam.books'::regclass AND NOT tgisinternal;
  IF v_triggers IS DISTINCT FROM
     'aa_enforce_user_id_books_insert,aa_lock_user_id_books_update,audit_books_delete,'
     'audit_books_insert,audit_books_update,books_updated_at' THEN
    RAISE EXCEPTION 'sql/76: books 트리거 목록이 다르다: %', v_triggers;
  END IF;

  SELECT count(*) INTO v_policies FROM pg_policies
   WHERE schemaname = 'exam' AND tablename IN ('books', 'book_chapters')
     AND qual LIKE '%ara0723@araeducation.co.kr%' AND with_check LIKE '%ara0723@araeducation.co.kr%'
     AND qual LIKE '%is_allowed_domain%';
  IF v_policies <> 2 THEN
    RAISE EXCEPTION 'sql/76: 원장 이메일 정책이 두 표에 하나씩이 아니다 (%)', v_policies;
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'exam' AND tablename IN ('books', 'book_chapters')) <> 2 THEN
    RAISE EXCEPTION 'sql/76: 두 표에 원장 정책 말고 다른 정책이 있다';
  END IF;

  SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) INTO v_grants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'exam' AND table_name = 'book_chapters' AND grantee = 'authenticated';
  IF v_grants IS DISTINCT FROM 'DELETE,INSERT,SELECT,UPDATE' THEN
    RAISE EXCEPTION 'sql/76: book_chapters 권한이 다르다: %', v_grants;
  END IF;

  SELECT condeferred INTO v_deferred FROM pg_constraint WHERE conname = 'book_chapters_book_order_key';
  IF v_deferred IS NOT TRUE THEN
    RAISE EXCEPTION 'sql/76: 장 차례 유일 제약이 INITIALLY DEFERRED 가 아니다';
  END IF;

  SELECT confdeltype INTO v_delete FROM pg_constraint
   WHERE conrelid = 'exam.book_chapters'::regclass AND confrelid = 'exam.problem_papers'::regclass;
  IF v_delete IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'sql/76: 문제지 FK 가 RESTRICT 가 아니다 (%)', v_delete;
  END IF;

  RAISE NOTICE 'sql/76 구조: books 트리거 6 · 원장 정책 2 · 차례 유일 DEFERRED · 문제지 RESTRICT · 권한 %', v_grants;
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 — 실제로 막히고 열리는가 (JWT 흉내, 되돌리는 하위 트랜잭션)
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 역할을 바꿔서 잰다(sql/57 과 같은 방식).
-- user_id 는 auth.users FK 라 원장의 **실제 사용자 id** 로 흉내 낸다.
DO $verify_probe$
DECLARE
  v_director UUID;
  v_paper    UUID;
  v_paper2   UUID;
  v_book     UUID;
  v_ch1      UUID;
  v_ch2      UUID;
  v_n        INT;
  v_blocked  BOOLEAN;
BEGIN
  SELECT id INTO v_director FROM auth.users WHERE email = 'ara0723@araeducation.co.kr' LIMIT 1;
  SELECT id INTO v_paper FROM exam.problem_papers ORDER BY created_at LIMIT 1;
  SELECT id INTO v_paper2 FROM exam.problem_papers WHERE id <> v_paper ORDER BY created_at LIMIT 1;
  IF v_director IS NULL OR v_paper IS NULL OR v_paper2 IS NULL THEN
    RAISE NOTICE 'sql/76: 원장 계정이나 문제지 두 장이 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';

    -- 원장: 책·장 만들기, 차례 맞바꾸기(DEFERRED)
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_director::text, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr'
    )::text, true);

    INSERT INTO exam.books (title) VALUES ('sql/76 검증') RETURNING id INTO v_book;
    IF (SELECT user_id FROM exam.books WHERE id = v_book) IS DISTINCT FROM v_director THEN
      RAISE EXCEPTION 'user_id 가 원장으로 채워지지 않았다';
    END IF;
    INSERT INTO exam.book_chapters (book_id, paper_id, order_index) VALUES (v_book, v_paper, 0) RETURNING id INTO v_ch1;
    INSERT INTO exam.book_chapters (book_id, paper_id, order_index) VALUES (v_book, v_paper2, 1) RETURNING id INTO v_ch2;

    -- 앱의 차례 바꾸기와 같은 한 문장 upsert — 문장 도중 자리가 겹쳐도 커밋 때만 본다
    INSERT INTO exam.book_chapters (id, book_id, paper_id, order_index, title_override)
      VALUES (v_ch1, v_book, v_paper, 1, ''), (v_ch2, v_book, v_paper2, 0, '')
      ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index;
    SET CONSTRAINTS exam.book_chapters_book_order_key IMMEDIATE;
    IF (SELECT order_index FROM exam.book_chapters WHERE id = v_ch2) <> 0 THEN
      RAISE EXCEPTION '차례 맞바꾸기가 저장되지 않았다';
    END IF;
    SET CONSTRAINTS exam.book_chapters_book_order_key DEFERRED;

    SELECT count(*) INTO v_n FROM exam.book_chapters WHERE book_id = v_book;
    IF v_n <> 2 THEN RAISE EXCEPTION '원장이 장을 못 읽는다 (%행)', v_n; END IF;

    -- 다른 선생님: 읽기 0행 · 쓰기 거절
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_director::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    SELECT count(*) INTO v_n FROM exam.books WHERE id = v_book;
    IF v_n <> 0 THEN RAISE EXCEPTION '다른 선생님이 책을 읽는다 (%행)', v_n; END IF;
    SELECT count(*) INTO v_n FROM exam.book_chapters WHERE book_id = v_book;
    IF v_n <> 0 THEN RAISE EXCEPTION '다른 선생님이 장을 읽는다 (%행)', v_n; END IF;
    UPDATE exam.books SET title = '변조' WHERE id = v_book;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '다른 선생님이 책을 고친다 (%행)', v_n; END IF;
    DELETE FROM exam.book_chapters WHERE book_id = v_book;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '다른 선생님이 장을 지운다 (%행)', v_n; END IF;
    v_blocked := false;
    BEGIN
      INSERT INTO exam.books (title) VALUES ('남의 책');
    EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION '다른 선생님이 책을 만든다'; END IF;

    -- 다른 선생님이 책에 담긴 문제지를 지우려 하면 막힌다 — 참조 검사는 RLS 를 타지 않아 장이 안 보여도 걸린다
    v_blocked := false;
    BEGIN
      DELETE FROM exam.problem_papers WHERE id = v_paper;
    EXCEPTION WHEN foreign_key_violation THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION '책에 담긴 문제지가 지워졌다'; END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN
      RAISE;
    END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/76: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.books WHERE title = 'sql/76 검증') THEN
    RAISE EXCEPTION 'sql/76: 검증용 책이 되돌아가지 않았다';
  END IF;

  RAISE NOTICE 'sql/76 검증: 원장 만들기·차례 맞바꾸기, 다른 선생님 읽기 0행·쓰기 거절·담긴 문제지 삭제 막힘 (전부 되돌림)';
END
$verify_probe$;

-- ---------------------------------------------
-- 저장소 — 책 표지 그림(books/…)은 원장만 (코덱스 2R)
-- ---------------------------------------------
-- 책 표지 그림은 문제 은행 버킷(exam-problem-bank)의 `books/{책 id}/cover-{token}.jpg` 에 올라간다. 그 버킷의 정책
-- (sql/17)은 도메인 계정 누구에게나 읽기·올리기·지우기를 열어 두어, 선생님이 `books/` 를 훑어 원장님 책 표지를 읽거나
-- 지울 수 있었다. 세 정책을 **같은 모양 그대로** 다시 만들고 `books/` 경로만 원장 이메일로 좁힌다 — 다른 경로
-- (sources/·problems/·passages/·papers/·print-scans/)는 예전과 똑같이 열려 있다(아래 검증이 확인한다).
-- ⚠️ sql/17 의 저장소 블록을 다시 돌리면 이 좁힘이 풀린다(그 파일 머리에 경고를 적었다).
DROP POLICY IF EXISTS "exam_problem_bank_select" ON storage.objects;
CREATE POLICY "exam_problem_bank_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exam-problem-bank' AND exam.is_allowed_domain()
    AND (name NOT LIKE 'books/%' OR (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr')
  );

DROP POLICY IF EXISTS "exam_problem_bank_insert" ON storage.objects;
CREATE POLICY "exam_problem_bank_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exam-problem-bank' AND exam.is_allowed_domain()
    AND (name NOT LIKE 'books/%' OR (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr')
  );

DROP POLICY IF EXISTS "exam_problem_bank_delete" ON storage.objects;
CREATE POLICY "exam_problem_bank_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'exam-problem-bank' AND exam.is_allowed_domain()
    AND (name NOT LIKE 'books/%' OR (select auth.jwt() ->> 'email') = 'ara0723@araeducation.co.kr')
  );

-- 검증 — 선생님은 books/ 를 못 보고 못 올리며, 다른 경로는 예전처럼 보인다. 원장은 books/ 가 보인다 (되돌림)
DO $verify_storage$
DECLARE
  v_n       INT;
  v_other   INT;
  v_blocked BOOLEAN;
BEGIN
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'storage' AND tablename = 'objects'
         AND policyname IN ('exam_problem_bank_select', 'exam_problem_bank_insert', 'exam_problem_bank_delete')
         AND coalesce(qual, with_check) LIKE '%books/%%ara0723@araeducation.co.kr%') <> 3 THEN
    RAISE EXCEPTION 'sql/76: 저장소 정책 셋에 books/ 원장 조건이 다 걸리지 않았다';
  END IF;

  SELECT count(*) INTO v_other FROM storage.objects
   WHERE bucket_id = 'exam-problem-bank' AND name NOT LIKE 'books/%';

  BEGIN
    BEGIN
      INSERT INTO storage.objects (bucket_id, name) VALUES ('exam-problem-bank', 'books/sql76-verify/cover-verify.jpg');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'sql/76: 저장소 검증용 행을 넣지 못해 실제 검증은 건너뛴다 (%)', SQLERRM;
      RAISE EXCEPTION 'ROLLBACK_VERIFY';
    END;

    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);
    SELECT count(*) INTO v_n FROM storage.objects WHERE bucket_id = 'exam-problem-bank' AND name LIKE 'books/%';
    IF v_n <> 0 THEN RAISE EXCEPTION '선생님이 books/ 를 본다 (%행)', v_n; END IF;
    SELECT count(*) INTO v_n FROM storage.objects WHERE bucket_id = 'exam-problem-bank' AND name NOT LIKE 'books/%';
    IF v_n <> v_other THEN RAISE EXCEPTION '선생님에게 다른 경로가 덜 보인다 (% / %)', v_n, v_other; END IF;
    -- 지우기 정책은 위 모양 검사가 본다 — storage 는 SQL 로 직접 지우는 문장을 트리거로 통째로 막아 여기서 잴 수 없다
    v_blocked := false;
    BEGIN
      INSERT INTO storage.objects (bucket_id, name) VALUES ('exam-problem-bank', 'books/sql76-verify/cover-teacher.jpg');
    EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION '선생님이 books/ 에 올린다'; END IF;

    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid()::text, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr'
    )::text, true);
    SELECT count(*) INTO v_n FROM storage.objects WHERE bucket_id = 'exam-problem-bank' AND name = 'books/sql76-verify/cover-verify.jpg';
    IF v_n <> 1 THEN RAISE EXCEPTION '원장이 books/ 를 못 본다 (%행)', v_n; END IF;

    RAISE NOTICE 'sql/76 저장소 검증: 선생님 books/ 읽기 0행·올리기 거절, 다른 경로 %행 그대로, 원장 books/ 읽기 1행 (되돌림)', v_other;
    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/76: 저장소 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE name LIKE 'books/sql76-verify/%') THEN
    RAISE EXCEPTION 'sql/76: 저장소 검증용 행이 되돌아가지 않았다';
  END IF;
END
$verify_storage$;
