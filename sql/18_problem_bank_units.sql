-- =============================================
-- 18. 기출 문제 은행 2차 — 학교 마스터 연결 · 교과서 단원 분류
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   ① 업로드 폼의 학교가 이 앱의 `exam.schools`(외부지문용 이름 마스터)를 읽고 있었다.
--      실제 학교 마스터는 관리자시스템의 `public.schools`(중등 15·고등 5, level 컬럼 보유)라
--      거기서 고르고 `school_id` 로 함께 남긴다.
--   ② 문항을 **교과서별 단원별**로 찾을 수 있어야 한다. 단원 마스터의 정본은
--      이 앱의 카테고리 관리(`exam.publishers › major_chapters › sub_chapters`)다
--      (관리자시스템 `curriculum_textbooks` 는 그것을 매일 밤 복사한 사본이다).
--   ③ 배점을 인쇄에서 뺀다. 컬럼은 남기고 발문에 글자로 섞여 들어온 '(3.4점)' 만 지운다.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--   앱이 먼저 배포되면 OCR 저장이 school_id/textbook/unit_path 를 보내다가
--   PGRST204(컬럼 없음)로 **전부 실패**한다.
--
-- ⚠️ 아래 stem_html 정리는 `updated_at` 을 올린다(낙관적 동시성). 적용 시점에 열려 있던
--   검수 탭은 새로고침 전까지 저장이 충돌로 튕긴다 — 배포와 붙여서 돌리고 안내할 것.
--
-- ⚠️ sql/17 과 같은 이유로 **모든 DDL 에 `exam.` 을 명시**한다(SQL Editor 는 문마다 다른
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

  IF to_regclass('exam.problem_sources') IS NULL
     OR to_regclass('exam.passages') IS NULL
     OR to_regclass('exam.problems') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;

  -- 학교 백필이 조용히 0건으로 끝나지 않도록 원본 표의 존재를 확인한다
  IF to_regclass('public.schools') IS NULL THEN
    RAISE EXCEPTION
      'public.schools 가 없습니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 출처 — 학교 마스터 id · 교과서
-- ---------------------------------------------
-- school_id 에 FK 를 걸지 않는다: public.schools 는 ara-system 이 소유하고, 학교를 지웠다고
-- 이미 읽어 둔 기출이 함께 사라지면 안 된다. 표시·필터·문제지 스냅샷은 계속 school_name 을 쓴다.
ALTER TABLE exam.problem_sources ADD COLUMN IF NOT EXISTS school_id UUID;

-- 교과서 = exam.publishers.name 의 **이름 스냅샷**('' 는 미지정).
-- id 를 참조하지 않는 이유는 unit_path 와 같다(아래).
ALTER TABLE exam.problem_sources ADD COLUMN IF NOT EXISTS textbook TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------
-- 2. 지문·문항 — 교과서 단원 경로
-- ---------------------------------------------
-- area_path 와 같은 규약: 마스터 노드 id 가 아니라 **이름 경로 스냅샷**을 담는다
-- (['2. 문학의 갈래', '(1) 시의 화자']). 마스터에서 단원 이름이 바뀌거나 지워져도
-- 이미 태깅한 문항과 인쇄한 문제지는 그대로여야 한다.
ALTER TABLE exam.passages ADD COLUMN IF NOT EXISTS unit_path TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE exam.problems ADD COLUMN IF NOT EXISTS unit_path TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE exam.passages DROP CONSTRAINT IF EXISTS passages_unit_path_depth;
ALTER TABLE exam.passages ADD CONSTRAINT passages_unit_path_depth
  CHECK (cardinality(unit_path) <= 2);
ALTER TABLE exam.problems DROP CONSTRAINT IF EXISTS problems_unit_path_depth;
ALTER TABLE exam.problems ADD CONSTRAINT problems_unit_path_depth
  CHECK (cardinality(unit_path) <= 2);

-- 배열 포함(@>) 검색용 — '대단원' 하나로 그 아래 소단원 문항까지 찾는다
CREATE INDEX IF NOT EXISTS idx_problems_unit_path ON exam.problems USING GIN (unit_path);
CREATE INDEX IF NOT EXISTS idx_problem_sources_textbook ON exam.problem_sources (textbook);

-- ---------------------------------------------
-- 3. 기존 출처의 학교 id 백필
-- ---------------------------------------------
-- 이름이 **정확히 한 학교**에만 맞을 때만 채운다(0개·2개면 그대로 NULL).
-- ara-system 의 resolveSchoolIdByName 과 같은 규칙 — 잘못 붙이는 것보다 비워 두는 게 낫다.
UPDATE exam.problem_sources s
   SET school_id = m.id
  FROM (
    SELECT regexp_replace(lower(name), '\s+', '', 'g') AS k,
           min(id::text)::uuid AS id,
           count(*) AS n
      FROM public.schools
     GROUP BY 1
  ) m
 WHERE s.school_id IS NULL
   AND s.school_name <> ''
   AND m.n = 1
   AND m.k = regexp_replace(lower(s.school_name), '\s+', '', 'g');

-- ---------------------------------------------
-- 4. 발문에 글자로 섞여 들어온 인쇄 배점 제거
-- ---------------------------------------------
-- '(3.4점)' '[3점]' '（3점）' '【3점】' 을 지운다. 단 **뒤에 태그나 글 끝이 오는 것만** —
-- 앱의 stripPrintedScore 와 같은 규칙이다(lookahead). 이렇게 하면
--   · 발문 끝              '…적절하지 않은 것은? (3.5점)'        → 지운다
--   · 닫는 태그 앞          '…것은? (3.4점)</p>'                 → 지운다
--   · 〈보기〉 상자 앞      '…고른 것은? (3.7점)<blockquote>'     → 지운다
--   · 문장 가운데          '다음 중 (3점)짜리 문항은?'           → 그대로 둔다
-- 운영 데이터로 미리 확인함(2026-09-08): 25개 발문에서 배점 표기만 25건 제거, 잔재 0.
-- ⚠️ problems_search_text 트리거가 다시 돌고 updated_at 이 올라간다(위 경고 참조).
UPDATE exam.problems
   SET stem_html = regexp_replace(
         stem_html,
         '\s*[(\[（［【]\s*\d+(?:\.\d+)?\s*점\s*[)\]）］】](?=\s*(?:<|$))',
         '', 'g')
 WHERE stem_html ~ '\s*[(\[（［【]\s*\d+(?:\.\d+)?\s*점\s*[)\]）］】](?=\s*(?:<|$))';

-- ---------------------------------------------
-- 5. 주석
-- ---------------------------------------------
COMMENT ON COLUMN exam.problem_sources.school_id IS
  'public.schools.id 스냅샷. FK 없음 — ara-system 이 학교를 지워도 기출은 남는다. 표시·필터는 school_name';
COMMENT ON COLUMN exam.problem_sources.textbook IS
  '교과서 = exam.publishers.name 이름 스냅샷. '''' 는 미지정';
COMMENT ON COLUMN exam.problems.unit_path IS
  '교과서 단원의 **이름 경로 스냅샷** [대단원, 소단원] (최대 2단, id 가 아니다)';
COMMENT ON COLUMN exam.passages.unit_path IS
  '교과서 단원의 **이름 경로 스냅샷** [대단원, 소단원] (최대 2단, id 가 아니다)';

-- PostgREST 스키마 캐시 갱신 — 없으면 배포 직후 새 컬럼이 PGRST204 로 거부된다
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인 쿼리 (적용 뒤 직접 돌려 볼 것)
-- ---------------------------------------------
-- 컬럼 4개:
--   SELECT table_name, column_name FROM information_schema.columns
--    WHERE table_schema = 'exam'
--      AND ((table_name = 'problem_sources' AND column_name IN ('school_id','textbook'))
--        OR (table_name IN ('problems','passages') AND column_name = 'unit_path'))
--    ORDER BY 1, 2;                                   -- 4행
-- 학교 백필:
--   SELECT count(*) FILTER (WHERE school_id IS NOT NULL) AS linked, count(*) AS total
--     FROM exam.problem_sources WHERE school_name <> '';
-- 배점 잔재(0이어야 한다):
--   SELECT count(*) FROM exam.problems
--    WHERE stem_html ~ '\s*[(\[（［【]\s*\d+(?:\.\d+)?\s*점\s*[)\]）］】](?=\s*(?:<|$))';
-- 인덱스·제약:
--   SELECT indexname FROM pg_indexes WHERE schemaname = 'exam'
--    AND indexname IN ('idx_problems_unit_path','idx_problem_sources_textbook');   -- 2행
--   SELECT conname FROM pg_constraint
--    WHERE conname IN ('problems_unit_path_depth','passages_unit_path_depth');     -- 2행
