-- =============================================
-- 개념지에 합격 기준(커트라인) 도입 — 단어 시험지(exams.pass_percentage)와 같은 규약
-- 실행: Supabase SQL Editor 에서 postgres 로 실행 (또는 ara-system 의 `npm run sql <절대경로>`)
-- =============================================
-- 배경:
--   학원의 모든 시험은 커트라인 미만이면 재시험이다. 단어 시험지는 exams.pass_percentage /
--   pass_count 로 기준을 들고 있고 인쇄물 머리에도 '합격 N개 이상 (P%)' 이 찍히는데,
--   개념지에는 그 필드가 아예 없어서 ara-system 이 합격/불합격을 계산할 수 없었다
--   (원장 확인: 개념시험도 80점 이상이 합격, 단어시험과 같은 방식).
--
--   ara-system 쪽은 커트라인을 exam_subtype.pass_count/pass_percentage 실컬럼으로 저장하고
--   exam_results.passed 를 트리거로 판정한다(그쪽 migration 477). 그 값의 원본이 여기다.
--
-- 합격 개수 계산식은 네 곳이 1:1 미러다 — 하나만 바꾸면 인쇄물과 성적이 어긋난다:
--   ① exam.create_exam_with_words RPC : CEIL(p_pass_percentage::numeric / 100 * v_total)
--   ② 이 앱 src/lib/pass-count.ts      : passCountOf(pct, total)
--   ③ ara-system migration 477         : CEIL(v_pct / 100.0 * p_total_questions)
--   ④ ara-system scripts/backfill-araexam-grades.js
--
-- 기본값 80:
--   운영 중인 개념지 121장에 기준이 없으므로 DEFAULT 80 으로 일괄 부여한다(원장이 정한 값).
--   개념지별로 다르게 두고 싶으면 개념지 편집기의 '합격 기준 (%)' 칸에서 바꾼다.
--
-- 파괴적 작업 없음 — 컬럼 추가 + CHECK 뿐. RLS 변경도 없다(concept_sheets 는 공유 FOR ALL 이라
-- 편집기가 이 컬럼을 그대로 쓴다. 낙관적 동시성(updated_at)도 그대로).

-- ---------------------------------------------
-- 실행 대상 확인 (가장 먼저)
-- ---------------------------------------------
-- 이 앱의 테이블은 ara-system 과 공유하는 Supabase 프로젝트의 exam 스키마에 있다.
-- exam 이 없는 DB 에서 실행하면 무자격 객체가 전부 public 을 향해 남의 스키마를 오염시킨다.
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). SQL Editor 가 다른 Supabase 프로젝트에 '
      '연결돼 있을 가능성이 높습니다 — 앱의 NEXT_PUBLIC_SUPABASE_URL 이 가리키는 '
      '프로젝트(ara-system 과 공유하는 쪽)에서 실행하세요.', current_database();
  END IF;
END
$guard$;

-- ⚠️ DDL 은 반드시 스키마를 명시한다(CLAUDE.md 2026-08-30 Gotcha).
--    Supabase SQL Editor 는 문(statement)별로 다른 백엔드에 갈 수 있어
--    파일 머리의 SET search_path 가 뒤따르는 문에 적용된다고 믿으면 안 된다.
ALTER TABLE exam.concept_sheets
  ADD COLUMN IF NOT EXISTS pass_percentage integer NOT NULL DEFAULT 80;

-- 0 도 허용 — exams.pass_percentage 쪽 입력칸이 min=0 이라 표기를 맞춘다("전원 합격" 표현).
ALTER TABLE exam.concept_sheets
  DROP CONSTRAINT IF EXISTS concept_sheets_pass_percentage_chk;
ALTER TABLE exam.concept_sheets
  ADD CONSTRAINT concept_sheets_pass_percentage_chk
  CHECK (pass_percentage BETWEEN 0 AND 100);

COMMENT ON COLUMN exam.concept_sheets.pass_percentage IS
  '합격 기준(%) — exams.pass_percentage 와 같은 뜻. 합격 개수 = CEIL(pct/100 × 마킹 수). 기본 80.';

-- PostgREST 스키마 캐시 갱신 — 새 컬럼을 즉시 읽고 쓰게 한다
NOTIFY pgrst, 'reload schema';
