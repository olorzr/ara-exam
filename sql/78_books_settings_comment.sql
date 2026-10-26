-- =========================================================
-- 78. 책 설정 jsonb 의 칸 설명에 목차(toc) · 책등 글꼴(spineFont) 을 더한다 (2026-10-26, 0.9.59)
--
-- 칸·제약·RLS·트리거는 그대로다 — 설정은 jsonb 한 칸이고 앱 normalizeBookSettings 가 읽을 때 정리한다
-- (모르는 값은 기본으로). 설명(COMMENT)만 앱의 BookSettings 와 맞춘다. 멱등.
-- =========================================================

DO $guard$
BEGIN
  IF to_regclass('exam.books') IS NULL THEN
    RAISE EXCEPTION 'exam.books 가 없습니다 — ara-exam 의 공유 프로젝트(exam 스키마)에 붙었는지 확인하세요 (sql/76 먼저)';
  END IF;
END
$guard$;

COMMENT ON COLUMN exam.books.settings IS
  '설정 jsonb — innerPaper(열림인쇄 용지 코드) · columns · chapterStart · trimWorks · toc(내지 첫 쪽 목차) · spineColor · spineText · spineFont(책등 제목 글꼴 이름표) · backFill · manualPages(표지만 항목의 판별 쪽 수). 앱 normalizeBookSettings 가 정리.';

-- 검증 — 설명에 새 칸 이름이 들어갔다
DO $verify$
DECLARE
  v_comment text := col_description('exam.books'::regclass, (
    SELECT attnum FROM pg_attribute WHERE attrelid = 'exam.books'::regclass AND attname = 'settings'
  ));
BEGIN
  IF v_comment IS NULL OR position('toc' IN v_comment) = 0 OR position('spineFont' IN v_comment) = 0 THEN
    RAISE EXCEPTION 'settings 칸 설명이 갱신되지 않았습니다: %', v_comment;
  END IF;
  RAISE NOTICE 'sql/78 검증 통과 — db=%, settings 설명: %', current_database(), v_comment;
END
$verify$;
