-- =============================================
-- 29. 학교 프린트 — 스캔 단위 학기·시험 (print_bundles ← semester · exam_type)
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
--       또는 ara-system 에서 `npm run sql /경로/sql/29_print_bundle_exam_meta.sql`
-- =============================================
-- 배경:
--   학교·학년도·학년을 **프린트마다** 고르던 것을 **스캔을 올릴 때 한 번**으로 옮기면서
--   (고등/중등 → 학교 → 학년 → 학기 → 중간/기말), 여태 없던 두 칸이 생겼다.
--   한 번에 스캔하는 프린트는 대개 같은 시험 범위 것이라 스캔 단위로 묻는 편이 맞다.
--
-- 왜 묶음(print_bundles)에 두는가 — 스캔(print_scans)이 아니라:
--   분류를 읽는 쪽(`ensureSchoolMaterial`·카테고리 트리·`exam.sync_school_name` 트리거·
--   목록 줄)이 전부 **묶음 행**을 본다. 스캔에 두면 그 모두가 조인을 하나 더 타야 하고,
--   묶음을 옮기거나 나중에 한 장만 고칠 길이 막힌다. 화면이 스캔 단위로 묻고
--   **저장할 때 묶음마다 복사**한다(학교·학년도·학년이 이미 그렇게 저장된다).
--
-- ⚠️ 학교급(중등/고등)은 **저장하지 않는다.** 학교·학년 선택지를 좁히는 데만 쓰고
--   DB 에서는 grade('중2')의 접두사로 되찾는다(`levelFromGrade`) — sql/18 과 같은 규약이다.
--   저장하면 '중1인데 고등' 같은 어긋난 행을 CHECK 로 또 막아야 한다.
--
-- ⚠️ concept_sheets 쪽 semester 는 계속 '' 다(`bundleSheetCategory`). 외부지문 카테고리는
--   `학교 > 년도 > 학년 > 프린트` 계층이라 학기가 자연키에 끼면 이미 만든 시험지가
--   트리에서 다른 자리로 옮겨가고, ara-system 성적 시리즈 이름(= 학년)도 갈라진다.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--   앱이 먼저 배포되면 `insertBundles` 가 semester/exam_type 로 PGRST204(컬럼 없음)를 내
--   프린트 업로드 전체가 막힌다(sql/28 과 같은 함정).
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
END
$guard$;

-- ---------------------------------------------
-- 1. 컬럼 두 개 (멱등)
-- ---------------------------------------------
-- 분류 텍스트는 categories 관례를 그대로 따른다: TEXT NOT NULL DEFAULT '' 이고 '' 가 "미지정".
-- CHECK 를 걸지 않는 것도 같은 까닭이다 — year·grade 도 안 걸려 있고, 값 목록은 화면
-- (SEMESTER_OPTIONS · EXAM_TYPE_OPTIONS)이 정한다. 이미 올라와 있는 묶음은 '' 로 채워진다.
ALTER TABLE exam.print_bundles
  ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT '';

ALTER TABLE exam.print_bundles
  ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN exam.print_bundles.semester IS
  '학기(1학기·2학기). '''' 가 미지정. 스캔을 올릴 때 한 번 고른 값을 묶음마다 복사한다(sql/29).';
COMMENT ON COLUMN exam.print_bundles.exam_type IS
  '시험 구분(중간·기말). '''' 가 미지정. 학교급은 저장하지 않는다 — grade 접두사로 되찾는다.';

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
--    AND column_name IN ('semester', 'exam_type');
