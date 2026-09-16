-- =============================================
-- 31. 학교 프린트 문답 시험지 (print_bundles ← qa_items · qa_meta)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/31_print_bundle_qa.sql
-- =============================================
-- 배경:
--   광희중처럼 선생님이 직접 만든 프린트는 `N. 물음 … 답: 정답` 꼴이다. 지금은 그것을
--   개념지(빈칸 시험지) 한 장으로만 만들 수 있는데, 선생님들은 **문제지 / 교사용(문제 밑에 답) /
--   답지** 세 가지를 따로 뽑고 싶어 한다. 그러려면 읽어 둔 본문(`ocr_html`)을 물음·답으로
--   갈라 **구조로** 들고 있어야 한다 — OCR 결과는 구조 없는 HTML 한 덩어리다.
--
-- 왜 두 컬럼인가 (sql/28 의 words_meta 와 같은 규약):
--   - qa_items: 문답 목록. 선생님이 손으로 고친 답·AI 모범답안이 여기 쌓인다.
--   - qa_meta:  나눈 영수증(무엇으로 나눴는지·경고·그때 쓴 참고자료·원문 지문).
--   ⚠️ `ocr_meta` 에 합치지 않는다 — '다시 읽기' 가 `ocr_meta` 를 통째로 덮어쓰는데
--      문답은 그 뒤에도 살아 있어야 한다(선생님이 손본 답을 잃으면 안 된다).
--
-- ⚠️ `qa_meta.sourceHash` 는 나눌 때 본 `ocr_html` 의 해시다. 다시 읽어 본문이 바뀌면
--    앱이 **지우지 않고 '원문이 바뀌었어요' 로 알린다**(손본 답을 말없이 버리지 않는다).
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--    앱이 먼저 배포되면 문답 저장이 PGRST204(컬럼 없음)로 통째로 막힌다.
--
-- ⚠️ 이 앱의 테이블은 ara-system 과 공유하는 Supabase 프로젝트의 **exam 스키마**에 있다.
--    모든 DDL 은 `exam.` 으로 스키마를 명시한다(SQL Editor 는 문마다 다른 백엔드로 갈 수 있다).

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
END
$guard$;

-- ---------------------------------------------
-- 1. 컬럼 두 개 (멱등)
-- ---------------------------------------------
ALTER TABLE exam.print_bundles
  ADD COLUMN IF NOT EXISTS qa_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE exam.print_bundles
  ADD COLUMN IF NOT EXISTS qa_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 목록이 아니라 **배열**이어야 한다 — 객체가 들어오면 화면이 `.map` 에서 통째로 죽는다.
-- 앱이 늘 배열을 보내지만, RPC·SQL 로 직접 쓰는 길이 열려 있어 DB 에서도 막는다.
DO $ck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'exam.print_bundles'::regclass
       AND conname = 'print_bundles_qa_items_is_array'
  ) THEN
    ALTER TABLE exam.print_bundles
      ADD CONSTRAINT print_bundles_qa_items_is_array
      CHECK (jsonb_typeof(qa_items) = 'array');
  END IF;
END
$ck$;

COMMENT ON COLUMN exam.print_bundles.qa_items IS
  '문답 목록 [{id, label, lead, question, answer, answerSource(printed|handwritten|ai|teacher|none), studentAnswer, evidence, evidenceSource, verified}]. 문제지·교사용·답지 세 인쇄물이 이것 하나를 쓴다.';
COMMENT ON COLUMN exam.print_bundles.qa_meta IS
  '문답 나누기 영수증 {status(done|failed), sourceHash: 나눌 때 본 ocr_html 해시, work:{title,author}, model, effort, warnings, references: 모범답안에 쓴 자료 이름, answeredAt, ranAt}. ocr_meta 와 수명이 달라 따로 둔다(다시 읽기가 ocr_meta 를 덮어쓴다).';

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
--    AND column_name IN ('qa_items', 'qa_meta');
