-- =============================================
-- 28. 학교 프린트 단어 자동 등록 (print_bundles ← register_words · words_meta)
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
--       또는 ara-system 에서 `npm run sql /경로/sql/28_print_bundle_words.sql`
-- =============================================
-- 배경:
--   학교 프린트에는 '어휘 정리' 처럼 **단어 — 뜻**이 적힌 자리가 자주 있다. 프린트를 읽을 때
--   그것을 함께 뽑아 그 프린트의 카테고리(학교 > 학년도 > 학년 > 프린트명) 단어로 등록한다.
--   단어가 중요한 프린트만 켜는 기능이라 묶음마다 켜고 끈다.
--
-- 왜 두 컬럼인가:
--   - register_words: 업로드 폼에서 고른 값. 읽기가 끝난 뒤 단어 단계를 돌릴지 정한다.
--   - words_meta: 등록 **영수증**(몇 개 넣었고 몇 개 건너뛰었고 무엇을 확인해야 하는지).
--     ⚠️ `ocr_meta` 에 넣지 않는다 — '다시 읽기' 가 `ocr_meta` 를 통째로 덮어쓰고,
--        단어 등록은 목록의 '단어 등록' 버튼으로 **따로** 돌 수 있어 수명이 다르다.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--   앱이 먼저 배포되면 `insertBundles` 가 `register_words` 로 PGRST204(컬럼 없음)를 내
--   프린트 업로드 전체가 막힌다.
--
-- ⚠️ 이 앱의 테이블은 ara-system 과 공유하는 Supabase 프로젝트의 **exam 스키마**에 있다.
--   Supabase SQL Editor 는 문(statement)마다 다른 백엔드에 보낼 수 있어 파일 머리의
--   `SET search_path` 를 믿으면 안 된다 → **모든 DDL 은 `exam.` 으로 스키마를 명시**한다.

-- ---------------------------------------------
-- 실행 대상 확인 (가장 먼저)
-- ---------------------------------------------
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). SQL Editor 가 다른 Supabase 프로젝트에 '
      '연결돼 있을 가능성이 높습니다 — 앱의 NEXT_PUBLIC_SUPABASE_URL 이 가리키는 '
      '프로젝트(ara-system 과 공유하는 쪽)에서 실행하세요.', current_database();
  END IF;

  IF to_regclass('exam.print_bundles') IS NULL THEN
    RAISE EXCEPTION 'exam.print_bundles 가 없습니다. sql/26_print_scans.sql 을 먼저 적용하세요.';
  END IF;

  -- 단어는 categories → words 로 들어간다. 둘이 없으면 이 기능이 성립하지 않는다.
  IF to_regclass('exam.categories') IS NULL OR to_regclass('exam.words') IS NULL THEN
    RAISE EXCEPTION 'exam.categories / exam.words 가 없습니다 (현재 DB: %).', current_database();
  END IF;

  -- 등록은 이 RPC 한 곳으로만 한다(카테고리 단위 advisory lock + 중복 무시).
  IF to_regprocedure('exam.insert_words_batch(uuid, jsonb)') IS NULL THEN
    RAISE EXCEPTION
      'exam.insert_words_batch(uuid, jsonb) 가 없습니다. sql/06_words_concurrency.sql 을 먼저 적용하세요.';
  END IF;
END
$guard$;

-- ---------------------------------------------
-- 1. 컬럼 두 개 (멱등)
-- ---------------------------------------------
ALTER TABLE exam.print_bundles
  ADD COLUMN IF NOT EXISTS register_words BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE exam.print_bundles
  ADD COLUMN IF NOT EXISTS words_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN exam.print_bundles.register_words IS
  '프린트에 적힌 단어(단어 — 뜻)를 이 프린트 카테고리의 단어로 자동 등록할지. 기본 false.';
COMMENT ON COLUMN exam.print_bundles.words_meta IS
  '단어 등록 영수증 {status: 마지막 시도(done|empty|failed), wordCount: 올려 둔 단어 수(누적, 줄지 않음), registered/skipped/noMeaning/unverified/notInText: 마지막 시도의 숫자, categoryId, warnings, ranAt}. ocr_meta 와 수명이 달라 따로 둔다(다시 읽기가 ocr_meta 를 덮어쓴다).';

-- ---------------------------------------------
-- 2. PostgREST 스키마 캐시 리로드
-- ---------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인용 (실행 후 눈으로)
-- ---------------------------------------------
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'exam' AND table_name = 'print_bundles'
--    AND column_name IN ('register_words', 'words_meta');
