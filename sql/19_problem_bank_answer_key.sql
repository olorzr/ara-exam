-- =============================================
-- 19. 기출 문제 은행 — 별도 답지 파일
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   답지가 시험지 PDF 안에 붙어 있으면 업로드 화면에서 그 쪽을 '정답표' 로 지정하면 된다.
--   그런데 학교 기출은 답지가 **따로** 오는 일이 흔하다(별지 PDF, 또는 휴대폰으로 찍은 사진).
--   그 파일을 원본과 함께 보관하고 OCR 이 읽을 수 있도록 경로 목록을 남긴다.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포 직전에** 적용한다.
--   컬럼이 NOT NULL DEFAULT 라 옛 앱은 아무 영향을 받지 않는다. 반대로 앱이 먼저 배포되면
--   답지를 올린 업로드가 PGRST204(컬럼 없음)로 실패한다(그 밖의 업로드는 계속 된다 —
--   앱이 답지가 있을 때만 이 컬럼을 보낸다).
--
-- ⚠️ sql/17·18 과 같은 이유로 **모든 DDL 에 `exam.` 을 명시**한다(SQL Editor 는 문마다 다른
--   백엔드에 보낼 수 있어 파일 머리의 `SET search_path` 를 믿으면 안 된다).

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

  IF to_regclass('exam.problem_sources') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 출처 — 별도 답지 파일 경로
-- ---------------------------------------------
-- 원본 PDF 안의 정답표 쪽은 여기 넣지 않는다. 그쪽은 `ocr_meta.pages` 에 있고
-- 페이지 이미지도 `sources/{id}/pages/{n}.jpg` 로 이미 올라간다.
-- 별도 답지는 **다른 경로 가족**(`answer-key/`)을 써서 쪽 번호가 절대 겹치지 않게 한다.
ALTER TABLE exam.problem_sources
  ADD COLUMN IF NOT EXISTS answer_key_paths TEXT[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------
-- 2. 주석
-- ---------------------------------------------
COMMENT ON COLUMN exam.problem_sources.answer_key_paths IS
  '별도 답지 파일의 Storage 경로 목록(sources/{id}/answer-key/{n}.pdf|jpg). 원본 PDF 안의 정답표 쪽은 여기가 아니라 ocr_meta.pages 에 있다';

-- PostgREST 스키마 캐시 갱신 — 없으면 배포 직후 새 컬럼이 PGRST204 로 거부된다
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인 쿼리 (적용 뒤 직접 돌려 볼 것)
-- ---------------------------------------------
-- 컬럼:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'exam' AND table_name = 'problem_sources'
--      AND column_name = 'answer_key_paths';                        -- 1행, ARRAY, NO, '{}'
-- 옛 행이 전부 빈 배열인지:
--   SELECT count(*) FROM exam.problem_sources WHERE answer_key_paths <> '{}';   -- 0
