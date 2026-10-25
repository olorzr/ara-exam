-- =============================================
-- 75. 문제지 뒷표지 · 표지의 선생님 이름 · 디자인 F(라인드로잉)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/75_problem_paper_cover_back_teacher.sql
-- =============================================
-- 배경 (2026-10-25):
--   ① 선생님들이 앞표지처럼 **뒷표지도 고를 수 있게** 한다(사용자 요청). 뒷표지는 셋이다 —
--      없음(none) / 앞표지 디자인의 짝(design) / 올린 그림(image). 디자인 짝은 간단 표지일 때만 있다
--      (그 디자인의 글꼴·꾸밈을 쓴다). 뒷표지는 앞표지가 있어야 있으므로 **같은 행**에 둔다 —
--      따로 행을 두면 '앞은 없는데 뒤만 있는' 문제지와 upsert 키 두 개를 관리해야 한다.
--   ② 원장님이 클로드 디자인 캔버스(2026-10-25 판)에서 디자인 표지마다 '선생님 송알' 줄을 넣었다.
--      이름은 문제지를 만든 선생님(관리자시스템 profiles)을 자동으로 쓰고, 표지 창에서 고칠 수 있게
--      `teacher` 칸을 둔다 — **비어 있으면 자동**이다.
--   ③ 여섯째 디자인 'zine'(F · 라인드로잉)을 더한다.
--
-- ⚠️ 값 목록은 앱 `src/lib/problem-paper/cover.ts` 의 COVER_LAYOUTS · BACK_COVER_KINDS · COVER_TEACHER_MAX 와
--   **같아야 한다**(cover.test.ts 가 이 파일을 읽어 대조한다). 디자인 CHECK 의 정본은 이제 이 파일이다
--   (sql/70 은 칸과 기본값을 만든 기록으로 남는다 — 다시 돌려도 CHECK 가 이미 있으면 건너뛴다).
--
-- ⚠️ 적용 순서: **앱 배포보다 먼저**. 앱의 표지 조회(COVER_COLUMNS)가 새 칸 셋을 select 하므로
--   칸이 없으면 모든 문제지에서 표지 조회가 42703 으로 실패해 인쇄가 잠긴다(sql/70 과 같은 규율).
--   지금 앱(0.9.55)은 새 칸을 모르므로 먼저 적용해도 아무 영향이 없다(기본값이 'none'·'').
--
-- ⚠️ 모든 DDL 은 `exam.` 으로 스키마를 명시한다(SQL Editor 는 문마다 백엔드가 다를 수 있다).

-- ---------------------------------------------
-- 실행 대상 확인 (가장 먼저)
-- ---------------------------------------------
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;

  IF to_regclass('exam.problem_paper_covers') IS NULL THEN
    RAISE EXCEPTION 'exam.problem_paper_covers 가 없습니다. sql/61 을 먼저 적용하세요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'exam' AND table_name = 'problem_paper_covers' AND column_name = 'layout'
  ) THEN
    RAISE EXCEPTION 'problem_paper_covers.layout 이 없습니다. sql/70 을 먼저 적용하세요.';
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 새 칸 셋 — 기존 행은 뒷표지 없음 · 선생님 자동
-- ---------------------------------------------
ALTER TABLE exam.problem_paper_covers
  ADD COLUMN IF NOT EXISTS teacher TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS back_kind TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS back_image_path TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------
-- 2. 제약 — 없으면 더한다. 디자인 CHECK 만은 값이 늘었으므로 지우고 다시 건다
-- ---------------------------------------------
ALTER TABLE exam.problem_paper_covers DROP CONSTRAINT IF EXISTS problem_paper_covers_layout_check;
ALTER TABLE exam.problem_paper_covers
  ADD CONSTRAINT problem_paper_covers_layout_check
  CHECK (layout IN ('basic', 'editorial', 'rings', 'spines', 'soft', 'sketch', 'zine'));

DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'exam.problem_paper_covers'::regclass
                    AND conname = 'problem_paper_covers_teacher_check') THEN
    ALTER TABLE exam.problem_paper_covers
      ADD CONSTRAINT problem_paper_covers_teacher_check CHECK (length(teacher) <= 40);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'exam.problem_paper_covers'::regclass
                    AND conname = 'problem_paper_covers_back_kind_check') THEN
    ALTER TABLE exam.problem_paper_covers
      ADD CONSTRAINT problem_paper_covers_back_kind_check CHECK (back_kind IN ('none', 'design', 'image'));
  END IF;

  -- 그림 뒷표지인데 그림이 없으면 마지막 장이 빈 종이가 된다(앞표지의 image_needs_path 와 같은 규칙)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'exam.problem_paper_covers'::regclass
                    AND conname = 'problem_paper_covers_back_image_needs_path') THEN
    ALTER TABLE exam.problem_paper_covers
      ADD CONSTRAINT problem_paper_covers_back_image_needs_path
      CHECK (back_kind <> 'image' OR back_image_path <> '');
  END IF;

  -- 디자인 뒷표지는 앞표지 디자인의 짝이다 — 그림 앞표지에는 디자인이 없다(앱 toCoverRow 와 같은 규칙)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'exam.problem_paper_covers'::regclass
                    AND conname = 'problem_paper_covers_back_design_needs_simple') THEN
    ALTER TABLE exam.problem_paper_covers
      ADD CONSTRAINT problem_paper_covers_back_design_needs_simple
      CHECK (back_kind <> 'design' OR kind = 'simple');
  END IF;
END
$checks$;

COMMENT ON COLUMN exam.problem_paper_covers.layout IS
  '간단 표지의 디자인(basic·editorial·rings·spines·soft·sketch·zine). 그림 표지면 앱이 무시하고 basic 을 저장한다. '
  '앱 COVER_LAYOUTS 와 같아야 한다(정본 CHECK: sql/75).';
COMMENT ON COLUMN exam.problem_paper_covers.teacher IS
  '디자인 표지의 선생님 이름. 비어 있으면 앱이 문제지를 만든 선생님(public.profiles.name)을 쓴다. 40자까지.';
COMMENT ON COLUMN exam.problem_paper_covers.back_kind IS
  '뒷표지 — none(없음) · design(앞표지 디자인의 짝, kind=simple 일 때만) · image(올린 그림).';
COMMENT ON COLUMN exam.problem_paper_covers.back_image_path IS
  '그림 뒷표지의 Storage 경로(버킷 exam-problem-bank, papers/{id}/cover-{token}.jpg). back_kind=image 일 때만 쓴다.';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 구조
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_col     TEXT;
  v_null    TEXT;
  v_default TEXT;
  v_check   TEXT;
  v_layout  TEXT;
  v_rows    INT;
  v_back    INT;
BEGIN
  FOREACH v_col IN ARRAY ARRAY['teacher', 'back_kind', 'back_image_path'] LOOP
    SELECT is_nullable, column_default INTO v_null, v_default
      FROM information_schema.columns
     WHERE table_schema = 'exam' AND table_name = 'problem_paper_covers' AND column_name = v_col;
    IF v_null IS DISTINCT FROM 'NO' THEN
      RAISE EXCEPTION 'sql/75: % 가 없거나 NOT NULL 이 아니다 (%)', v_col, v_null;
    END IF;
    IF v_default IS NULL THEN
      RAISE EXCEPTION 'sql/75: % 기본값이 없다', v_col;
    END IF;
  END LOOP;

  SELECT pg_get_constraintdef(oid) INTO v_check
    FROM pg_constraint
   WHERE conrelid = 'exam.problem_paper_covers'::regclass AND conname = 'problem_paper_covers_layout_check';
  FOREACH v_layout IN ARRAY ARRAY['basic', 'editorial', 'rings', 'spines', 'soft', 'sketch', 'zine'] LOOP
    IF v_check IS NULL OR position(quote_literal(v_layout) IN v_check) = 0 THEN
      RAISE EXCEPTION 'sql/75: 디자인 CHECK 에 % 가 없다 (%)', v_layout, v_check;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_constraint
       WHERE conrelid = 'exam.problem_paper_covers'::regclass
         AND conname IN ('problem_paper_covers_teacher_check', 'problem_paper_covers_back_kind_check',
                         'problem_paper_covers_back_image_needs_path',
                         'problem_paper_covers_back_design_needs_simple')) <> 4 THEN
    RAISE EXCEPTION 'sql/75: 새 제약 넷이 다 걸리지 않았다';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE back_kind <> 'none') INTO v_rows, v_back
    FROM exam.problem_paper_covers;
  RAISE NOTICE 'sql/75 구조: 새 칸 셋 NOT NULL · 디자인 CHECK 7값 · 새 제약 4 · 표지 %행 중 뒷표지 %행', v_rows, v_back;
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 — 실제로 도는가 (선생님 JWT 흉내, 되돌리는 하위 트랜잭션)
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 역할을 바꿔서 잰다(sql/61·70 과 같은 방식).
DO $verify_probe$
DECLARE
  v_paper UUID;
  v_user  UUID;
  v_row   RECORD;
  v_n     INT;

BEGIN
  SELECT p.id, p.user_id INTO v_paper, v_user
    FROM exam.problem_papers p
   WHERE NOT EXISTS (SELECT 1 FROM exam.problem_paper_covers c WHERE c.paper_id = p.id)
   ORDER BY p.created_at LIMIT 1;
  IF v_paper IS NULL THEN
    RAISE NOTICE 'sql/75: 표지 없는 문제지가 없어 실제 검증은 건너뛴다';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);

    -- 새 칸을 안 보내면(옛 앱) 뒷표지 없음 · 선생님 자동
    INSERT INTO exam.problem_paper_covers (paper_id, kind, title) VALUES (v_paper, 'simple', '검증');
    SELECT back_kind, back_image_path, teacher INTO v_row FROM exam.problem_paper_covers WHERE paper_id = v_paper;
    IF v_row.back_kind IS DISTINCT FROM 'none' OR v_row.back_image_path <> '' OR v_row.teacher <> '' THEN
      RAISE EXCEPTION '기본값이 다르다 (%, %, %)', v_row.back_kind, v_row.back_image_path, v_row.teacher;
    END IF;

    -- 새 디자인 · 디자인 뒷표지 · 선생님 이름
    UPDATE exam.problem_paper_covers SET layout = 'zine', back_kind = 'design', teacher = '송알'
     WHERE paper_id = v_paper;
    SELECT layout, back_kind, teacher INTO v_row FROM exam.problem_paper_covers WHERE paper_id = v_paper;
    IF v_row.layout <> 'zine' OR v_row.back_kind <> 'design' OR v_row.teacher <> '송알' THEN
      RAISE EXCEPTION '새 값이 저장되지 않았다 (%, %, %)', v_row.layout, v_row.back_kind, v_row.teacher;
    END IF;

    -- 막혀야 하는 넷
    BEGIN
      UPDATE exam.problem_paper_covers SET back_kind = 'image', back_image_path = '' WHERE paper_id = v_paper;
      RAISE EXCEPTION 'NOT_BLOCKED 그림 없는 그림 뒷표지';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE exam.problem_paper_covers SET teacher = repeat('가', 41) WHERE paper_id = v_paper;
      RAISE EXCEPTION 'NOT_BLOCKED 41자 선생님 이름';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE exam.problem_paper_covers SET back_kind = 'both' WHERE paper_id = v_paper;
      RAISE EXCEPTION 'NOT_BLOCKED 모르는 뒷표지 종류';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE exam.problem_paper_covers SET kind = 'image', image_path = 'papers/x/cover-a.jpg', back_kind = 'design'
       WHERE paper_id = v_paper;
      RAISE EXCEPTION 'NOT_BLOCKED 그림 앞표지 + 디자인 뒷표지';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- upsert(앱 저장 경로) — 그림 뒷표지
    INSERT INTO exam.problem_paper_covers (paper_id, kind, layout, title, teacher, back_kind, back_image_path)
      VALUES (v_paper, 'simple', 'rings', '검증', '', 'image', 'papers/x/cover-b.jpg')
      ON CONFLICT (paper_id) DO UPDATE SET layout = EXCLUDED.layout, teacher = EXCLUDED.teacher,
        back_kind = EXCLUDED.back_kind, back_image_path = EXCLUDED.back_image_path;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    SELECT layout, back_kind, back_image_path, teacher INTO v_row
      FROM exam.problem_paper_covers WHERE paper_id = v_paper;
    IF v_n <> 1 OR v_row.back_kind <> 'image' OR v_row.back_image_path <> 'papers/x/cover-b.jpg'
       OR v_row.teacher <> '' OR v_row.layout <> 'rings' THEN
      RAISE EXCEPTION 'upsert 로 뒷표지가 저장되지 않았다 (%행, %, %)', v_n, v_row.back_kind, v_row.back_image_path;
    END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN
      RAISE;
    END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/75: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_paper_covers WHERE paper_id = v_paper) THEN
    RAISE EXCEPTION 'sql/75: 검증용 표지가 되돌아가지 않았다';
  END IF;

  RAISE NOTICE 'sql/75 검증: 기본값·zine·디자인 뒷표지·선생님 이름 저장, 막혀야 할 넷 거절, 그림 뒷표지 upsert 통과 (전부 되돌림)';
END
$verify_probe$;
