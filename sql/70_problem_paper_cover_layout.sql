-- =============================================
-- 70. 문제지 표지 디자인 (problem_paper_covers.layout)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/70_problem_paper_cover_layout.sql
-- =============================================
-- 배경:
--   원장님이 클로드 디자인에서 문제지 표지 시안 다섯 가지(에디토리얼·링·책등·블러·스케치)를 만들었다
--   (2026-10-06 '문제지 표지 시안'). 이것을 '간단 표지' 안에서 고르는 **디자인** 으로 옮긴다
--   (사용자 결정 2026-10-13: 다섯 가지 전부, 회차·단원·날짜 칸은 따로 두지 않는다 — 기존 칸인
--   제목·부제·이름 칸으로 채우고 연도는 문제지를 만든 해를 쓴다).
--
--   그래서 표에 더하는 것은 **고른 디자인 하나** 뿐이다. 다른 선생님·다른 탭이 같은 표지를 인쇄해야
--   하므로 화면 기억(localStorage)이 아니라 표지 행에 둔다.
--
-- ⚠️ 값 목록은 앱 `src/lib/problem-paper/cover.ts` 의 COVER_LAYOUTS 와 **같아야 한다**(cover.test.ts 가
--   이 파일을 읽어 대조한다). 'basic' 이 예전부터 있던 모양이고 기본값이다 — 기존 행은 모양이 그대로다.
--   그림 표지(kind='image')에는 디자인이 없다 — 앱이 'basic' 을 저장하고 읽을 때도 무시한다.
--
-- ⚠️ 적용 순서: **앱 배포보다 먼저**. 앱의 표지 조회(COVER_COLUMNS)가 layout 을 select 하므로
--   열이 없으면 모든 문제지에서 표지 조회가 42703 으로 실패해 인쇄가 잠긴다.
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
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. layout 칸 — 없으면 더한다(기존 행은 'basic')
-- ---------------------------------------------
ALTER TABLE exam.problem_paper_covers
  ADD COLUMN IF NOT EXISTS layout TEXT NOT NULL DEFAULT 'basic';

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'exam.problem_paper_covers'::regclass
       AND conname = 'problem_paper_covers_layout_check'
  ) THEN
    ALTER TABLE exam.problem_paper_covers
      ADD CONSTRAINT problem_paper_covers_layout_check
      CHECK (layout IN ('basic', 'editorial', 'rings', 'spines', 'soft', 'sketch'));
  END IF;
END
$check$;

COMMENT ON COLUMN exam.problem_paper_covers.layout IS
  '간단 표지의 디자인(basic·editorial·rings·spines·soft·sketch). 그림 표지면 앱이 무시하고 basic 을 저장한다. '
  '앱 COVER_LAYOUTS 와 같아야 한다.';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 구조
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_nullable TEXT;
  v_default  TEXT;
  v_check    TEXT;
  v_layout   TEXT;
  v_rows     INT;
  v_basic    INT;
BEGIN
  SELECT is_nullable, column_default INTO v_nullable, v_default
    FROM information_schema.columns
   WHERE table_schema = 'exam' AND table_name = 'problem_paper_covers' AND column_name = 'layout';
  IF v_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'sql/70: layout 이 NOT NULL 이 아니다 (%)', v_nullable;
  END IF;
  IF v_default IS NULL OR position('''basic''' IN v_default) = 0 THEN
    RAISE EXCEPTION 'sql/70: layout 기본값이 basic 이 아니다 (%)', v_default;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_check
    FROM pg_constraint
   WHERE conrelid = 'exam.problem_paper_covers'::regclass AND conname = 'problem_paper_covers_layout_check';
  FOREACH v_layout IN ARRAY ARRAY['basic', 'editorial', 'rings', 'spines', 'soft', 'sketch'] LOOP
    IF v_check IS NULL OR position(quote_literal(v_layout) IN v_check) = 0 THEN
      RAISE EXCEPTION 'sql/70: 디자인 CHECK 에 % 가 없다 (%)', v_layout, v_check;
    END IF;
  END LOOP;

  SELECT count(*), count(*) FILTER (WHERE layout = 'basic') INTO v_rows, v_basic
    FROM exam.problem_paper_covers;
  RAISE NOTICE 'sql/70 구조: layout NOT NULL · 기본값 basic · CHECK 6값 · 표지 %행 중 basic %행', v_rows, v_basic;
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 — 실제로 도는가 (선생님 JWT 흉내, 되돌리는 하위 트랜잭션)
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 역할을 바꿔서 잰다(sql/61 과 같은 방식).
DO $verify_probe$
DECLARE
  v_paper  UUID;
  v_user   UUID;
  v_layout TEXT;
  v_n      INT;
  v_ok     BOOLEAN := false;
BEGIN
  SELECT p.id, p.user_id INTO v_paper, v_user
    FROM exam.problem_papers p
   WHERE NOT EXISTS (SELECT 1 FROM exam.problem_paper_covers c WHERE c.paper_id = p.id)
   ORDER BY p.created_at LIMIT 1;
  IF v_paper IS NULL THEN
    RAISE NOTICE 'sql/70: 표지 없는 문제지가 없어 실제 검증은 건너뛴다';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);

    -- 디자인을 안 보내면(옛 앱) basic
    INSERT INTO exam.problem_paper_covers (paper_id, kind, title) VALUES (v_paper, 'simple', '검증');
    SELECT layout INTO v_layout FROM exam.problem_paper_covers WHERE paper_id = v_paper;
    IF v_layout IS DISTINCT FROM 'basic' THEN
      RAISE EXCEPTION '디자인 기본값이 basic 이 아니다 (%)', v_layout;
    END IF;

    UPDATE exam.problem_paper_covers SET layout = 'rings' WHERE paper_id = v_paper;
    SELECT layout INTO v_layout FROM exam.problem_paper_covers WHERE paper_id = v_paper;
    IF v_layout IS DISTINCT FROM 'rings' THEN
      RAISE EXCEPTION '디자인을 바꾸지 못했다 (%)', v_layout;
    END IF;

    -- 모르는 디자인은 막힌다
    BEGIN
      UPDATE exam.problem_paper_covers SET layout = 'nope' WHERE paper_id = v_paper;
      RAISE EXCEPTION '모르는 디자인이 통과했다';
    EXCEPTION WHEN check_violation THEN
      v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION '디자인 CHECK 가 돌지 않았다'; END IF;

    -- upsert(앱 저장 경로)
    INSERT INTO exam.problem_paper_covers (paper_id, kind, layout, title)
      VALUES (v_paper, 'simple', 'sketch', '검증')
      ON CONFLICT (paper_id) DO UPDATE SET layout = EXCLUDED.layout;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    SELECT layout INTO v_layout FROM exam.problem_paper_covers WHERE paper_id = v_paper;
    IF v_n <> 1 OR v_layout IS DISTINCT FROM 'sketch' THEN
      RAISE EXCEPTION 'upsert 로 디자인이 저장되지 않았다 (%행, %)', v_n, v_layout;
    END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN
      RAISE;
    END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/70: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_paper_covers WHERE paper_id = v_paper) THEN
    RAISE EXCEPTION 'sql/70: 검증용 표지가 되돌아가지 않았다';
  END IF;

  RAISE NOTICE 'sql/70 검증: 기본값 basic·디자인 바꾸기·모르는 값 CHECK·upsert 통과 (전부 되돌림)';
END
$verify_probe$;
