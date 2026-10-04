-- =============================================
-- 61. 문제지 표지 (problem_paper_covers)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/61_problem_paper_covers.sql
-- =============================================
-- 배경:
--   문제은행 문제지를 중철 제본(A3 가로 양면 → 반으로 접어 철하는 책자)으로 뽑게 되면서
--   **표지**가 필요해졌다. 표지는 두 가지다(사용자 요청 2026-10-04):
--     ① simple — 앱이 그리는 간단한 표지(제목·부제·이름 칸)
--     ② image  — 선생님이 만든 표지 그림을 올려 그대로 쓴다
--
-- ⚠️ `problem_papers` 에 칸을 더하지 않고 **곁표**를 둔다.
--   문제지는 만들 때 굳힌 불변 스냅샷이라 authenticated 에 UPDATE 권한이 없다(sql/17 —
--   GRANT SELECT, DELETE). 거기 칸을 더하면 표지 하나 고치려고 문제지 전체의 쓰기 경로를
--   열어야 한다. 표지는 인쇄 꾸밈이지 시험 내용이 아니라서 따로 고쳐도 된다.
--
-- ⚠️ 그림은 Storage 경로만 둔다(`papers/{paper_id}/cover-{token}.jpg`, 버킷 exam-problem-bank).
--   버킷은 application/pdf · image/jpeg 만 받으므로 앱이 JPEG 로 다시 인코딩해 올린다.
--   경로는 **한 번만 쓰는 이름**이고 옛 파일은 지우지 않는다(UPDATE 정책 없음 — sql/17).
--
-- ⚠️ 글자 수 상한(제목 100 · 부제 200)은 앱 `src/lib/problem-paper/cover.ts` 의
--   COVER_TITLE_MAX · COVER_SUBTITLE_MAX 와 **같아야 한다**.
--
-- ⚠️ 적용 순서: **앱 배포보다 먼저**. 문제지 화면이 이 표를 조회한다(조회 실패는 '표지 없음'
--   으로 감싸지만, 저장이 42P01 로 죽는다).
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

  IF to_regprocedure('exam.is_allowed_domain()') IS NULL
     OR to_regprocedure('exam.enforce_user_id_from_auth()') IS NULL
     OR to_regprocedure('exam.lock_user_id_on_update()') IS NULL
     OR to_regprocedure('exam.update_updated_at()') IS NULL
     OR to_regclass('exam.audit_log') IS NULL THEN
    RAISE EXCEPTION
      'exam 스키마에 헬퍼 함수/audit_log 가 없습니다 (현재 DB: %). '
      'ara-system 마이그레이션 254 가 적용된 공유 프로젝트에서 실행하세요.', current_database();
  END IF;

  IF to_regprocedure('exam.audit_problem_bank()') IS NULL
     OR to_regclass('exam.problem_papers') IS NULL THEN
    RAISE EXCEPTION
      'exam.problem_papers / exam.audit_problem_bank() 가 없습니다. sql/17 을 먼저 적용하세요.';
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. problem_paper_covers — 문제지 하나에 표지 하나
-- ---------------------------------------------
-- '표지 없음' 은 행이 없는 것이다(kind 에 'none' 을 두지 않는다 — 두 표현이 생긴다).
-- ⚠️ 기본 키는 `id` 이고 문제지와의 1:1 은 `paper_id UNIQUE` 가 지킨다. 범용 감사 함수
--    `exam.audit_problem_bank()` 가 `NEW.id`/`OLD.id` 를 읽으므로 `paper_id` 를 기본 키로 두면
--    모든 쓰기가 `record "new" has no field "id"` 로 죽는다(처음 적용 때 실제로 걸렸다).
--    앱의 저장은 `upsert(onConflict: 'paper_id')` 다.
CREATE TABLE IF NOT EXISTS exam.problem_paper_covers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id      UUID NOT NULL UNIQUE REFERENCES exam.problem_papers(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('simple', 'image')),
  -- 비어 있으면 문제지 제목을 쓴다(앱이 그린다). 교사용·답지 꼬리는 앱이 붙인다
  title         TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 100),
  subtitle      TEXT NOT NULL DEFAULT '' CHECK (length(subtitle) <= 200),
  show_name_box BOOLEAN NOT NULL DEFAULT true,
  -- 버킷 exam-problem-bank 기준 경로. image 일 때만 쓴다
  image_path    TEXT NOT NULL DEFAULT '',
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 그림 표지인데 그림이 없으면 인쇄물 첫 장이 빈 종이가 된다
  CONSTRAINT problem_paper_covers_image_needs_path
    CHECK (kind <> 'image' OR image_path <> '')
);

-- ---------------------------------------------
-- 2. user_id 강제 / 잠금 + updated_at 트리거
-- ---------------------------------------------
DROP TRIGGER IF EXISTS aa_enforce_user_id_problem_paper_covers_insert ON exam.problem_paper_covers;
CREATE TRIGGER aa_enforce_user_id_problem_paper_covers_insert
  BEFORE INSERT ON exam.problem_paper_covers
  FOR EACH ROW EXECUTE FUNCTION exam.enforce_user_id_from_auth();

DROP TRIGGER IF EXISTS aa_lock_user_id_problem_paper_covers_update ON exam.problem_paper_covers;
CREATE TRIGGER aa_lock_user_id_problem_paper_covers_update
  BEFORE UPDATE ON exam.problem_paper_covers
  FOR EACH ROW EXECUTE FUNCTION exam.lock_user_id_on_update();

DROP TRIGGER IF EXISTS problem_paper_covers_updated_at ON exam.problem_paper_covers;
CREATE TRIGGER problem_paper_covers_updated_at
  BEFORE UPDATE ON exam.problem_paper_covers
  FOR EACH ROW EXECUTE FUNCTION exam.update_updated_at();

-- ---------------------------------------------
-- 3. 감사 로그 — sql/17 의 범용 함수
-- ---------------------------------------------
DROP TRIGGER IF EXISTS audit_problem_paper_covers_insert ON exam.problem_paper_covers;
CREATE TRIGGER audit_problem_paper_covers_insert AFTER INSERT ON exam.problem_paper_covers
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_problem_paper_covers_update ON exam.problem_paper_covers;
CREATE TRIGGER audit_problem_paper_covers_update BEFORE UPDATE ON exam.problem_paper_covers
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_problem_paper_covers_delete ON exam.problem_paper_covers;
CREATE TRIGGER audit_problem_paper_covers_delete BEFORE DELETE ON exam.problem_paper_covers
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

-- ---------------------------------------------
-- 4. RLS — concept_sheets 와 같은 학원 공유 모델(선생님들이 함께 고친다)
-- ---------------------------------------------
ALTER TABLE exam.problem_paper_covers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage problem_paper_covers" ON exam.problem_paper_covers;
CREATE POLICY "Authenticated users can manage problem_paper_covers" ON exam.problem_paper_covers
  USING      (auth.role() = 'authenticated' AND exam.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

GRANT SELECT, INSERT, UPDATE, DELETE ON exam.problem_paper_covers TO authenticated;
GRANT ALL ON exam.problem_paper_covers TO service_role;

-- ---------------------------------------------
-- 5. 주석
-- ---------------------------------------------
COMMENT ON TABLE exam.problem_paper_covers IS
  '문제지 표지(인쇄 첫 장). 행이 없으면 표지 없음. 문제지 본문(불변 스냅샷)과 따로 고친다.';
COMMENT ON COLUMN exam.problem_paper_covers.title IS
  '표지 제목. 비면 문제지 제목을 쓴다. 상한 100자 — 앱 COVER_TITLE_MAX 와 같아야 한다.';
COMMENT ON COLUMN exam.problem_paper_covers.image_path IS
  '그림 표지 Storage 경로(papers/{paper_id}/cover-{token}.jpg). 한 번만 쓰는 이름, 옛 파일은 남긴다.';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 검증 — 구조
-- ---------------------------------------------
DO $verify_shape$
DECLARE
  v_triggers TEXT;
  v_policies INT;
  v_grants   TEXT;
BEGIN
  SELECT string_agg(tgname, ',' ORDER BY tgname) INTO v_triggers
    FROM pg_trigger WHERE tgrelid = 'exam.problem_paper_covers'::regclass AND NOT tgisinternal;
  IF v_triggers IS DISTINCT FROM
     'aa_enforce_user_id_problem_paper_covers_insert,aa_lock_user_id_problem_paper_covers_update,'
     'audit_problem_paper_covers_delete,audit_problem_paper_covers_insert,'
     'audit_problem_paper_covers_update,problem_paper_covers_updated_at' THEN
    RAISE EXCEPTION 'sql/61: 트리거 목록이 다르다: %', v_triggers;
  END IF;

  SELECT count(*) INTO v_policies FROM pg_policies
   WHERE schemaname = 'exam' AND tablename = 'problem_paper_covers'
     AND qual LIKE '%is_allowed_domain%' AND with_check LIKE '%is_allowed_domain%';
  IF v_policies <> 1 THEN
    RAISE EXCEPTION 'sql/61: 도메인 조건이 걸린 정책이 1개가 아니다 (%)', v_policies;
  END IF;

  SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) INTO v_grants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'exam' AND table_name = 'problem_paper_covers' AND grantee = 'authenticated';
  IF v_grants IS DISTINCT FROM 'DELETE,INSERT,SELECT,UPDATE' THEN
    RAISE EXCEPTION 'sql/61: authenticated 권한이 다르다: %', v_grants;
  END IF;

  RAISE NOTICE 'sql/61 구조: 트리거 6 · 도메인 정책 1 · 권한 %', v_grants;
END
$verify_shape$;

-- ---------------------------------------------
-- 검증 — 실제로 도는가 (선생님 JWT 흉내, 되돌리는 하위 트랜잭션)
-- ---------------------------------------------
-- postgres 는 표 소유자라 RLS 를 지나친다 → authenticated 로 역할을 바꿔서 잰다.
-- user_id 는 auth.users FK 라 **실제 사용자 id** 로 흉내 낸다(문제지를 만든 사람).
DO $verify_probe$
DECLARE
  v_paper UUID;
  v_user  UUID;
  v_n     INT;
  v_owner UUID;
  v_ok    BOOLEAN := false;
BEGIN
  SELECT id, user_id INTO v_paper, v_user FROM exam.problem_papers ORDER BY created_at LIMIT 1;
  IF v_paper IS NULL THEN
    RAISE NOTICE 'sql/61: 문제지가 없어 실제 검증은 건너뛴다 (신규 환경)';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_paper_covers WHERE paper_id = v_paper) THEN
    RAISE NOTICE 'sql/61: 검증용 문제지에 이미 표지가 있어 실제 검증은 건너뛴다(재실행)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user::text, 'role', 'authenticated', 'email', 'verify@araeducation.co.kr'
    )::text, true);

    -- 넣기: user_id 를 보내지 않아도 트리거가 JWT 로 채운다
    INSERT INTO exam.problem_paper_covers (paper_id, kind, title) VALUES (v_paper, 'simple', '검증');
    SELECT user_id INTO v_owner FROM exam.problem_paper_covers WHERE paper_id = v_paper;
    IF v_owner IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'user_id 가 JWT 로 채워지지 않았다 (%)', v_owner;
    END IF;

    -- 그림 표지인데 경로가 없으면 막힌다
    BEGIN
      UPDATE exam.problem_paper_covers SET kind = 'image' WHERE paper_id = v_paper;
      RAISE EXCEPTION '경로 없는 그림 표지가 통과했다';
    EXCEPTION WHEN check_violation THEN
      v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION '그림 경로 CHECK 가 돌지 않았다'; END IF;

    -- 제목 상한
    v_ok := false;
    BEGIN
      UPDATE exam.problem_paper_covers SET title = repeat('가', 101) WHERE paper_id = v_paper;
      RAISE EXCEPTION '101자 제목이 통과했다';
    EXCEPTION WHEN check_violation THEN
      v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION '제목 상한 CHECK 가 돌지 않았다'; END IF;

    -- upsert(앱 저장 경로)
    INSERT INTO exam.problem_paper_covers (paper_id, kind, image_path)
      VALUES (v_paper, 'image', 'papers/x/cover-abc123def456.jpg')
      ON CONFLICT (paper_id) DO UPDATE SET kind = EXCLUDED.kind, image_path = EXCLUDED.image_path;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION 'upsert 가 1행이 아니다 (%)', v_n; END IF;

    -- 지우기
    DELETE FROM exam.problem_paper_covers WHERE paper_id = v_paper;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION '선생님이 표지를 못 지운다 (%행)', v_n; END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN
      RAISE;
    END IF;
  END;

  IF current_user <> session_user THEN
    RAISE EXCEPTION 'sql/61: 검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.problem_paper_covers WHERE paper_id = v_paper) THEN
    RAISE EXCEPTION 'sql/61: 검증용 표지가 되돌아가지 않았다';
  END IF;

  RAISE NOTICE 'sql/61 검증: 넣기(user_id 강제)·그림 경로 CHECK·제목 상한·upsert·지우기 통과 (전부 되돌림)';
END
$verify_probe$;
