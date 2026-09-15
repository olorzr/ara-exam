-- =============================================
-- 30. 작품 전문 (reference_texts)
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   O,X·단답형(문제 만들기)이 지문 하나만 보고 문항을 낸다. 학원에는 이미 그 작품을
--   가르치는 자료가 쌓여 있는데(개념지·학교 프린트·기출 지문) **작품 원문 전체**를 올려 둘
--   자리만 없었다. 이 표가 그 자리다 — 시·소설의 전문을 올려 두면 잘린 지문으로 문항을
--   만들 때 AI 가 함께 읽고, 근거도 여기서 가져올 수 있다.
--
-- ⚠️ 본문(body)은 **평문(TEXT)** 이다. HTML 이 아니다 —
--   개념지(editor_html)와 달리 서식이 필요 없고, 평문이면 화면이 텍스트 노드로만 그려
--   정화를 한 겹 더 두는 것보다 확실하다(passage-quiz 의 지문과 같은 판단).
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--   `/reference-texts` 화면이 이 표를 직접 조회하므로, 앱이 먼저 배포되면 그 화면이
--   42P01(표 없음)로 죽는다(문제 만들기의 후보 조회는 실패를 감싸므로 경고만 뜬다).
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

  -- 헬퍼가 없으면 트리거·정책이 런타임에만 깨지므로(생성은 성공) 여기서 멈춘다.
  IF to_regprocedure('exam.is_allowed_domain()') IS NULL
     OR to_regprocedure('exam.enforce_user_id_from_auth()') IS NULL
     OR to_regprocedure('exam.lock_user_id_on_update()') IS NULL
     OR to_regprocedure('exam.update_updated_at()') IS NULL
     OR to_regclass('exam.audit_log') IS NULL THEN
    RAISE EXCEPTION
      'exam 스키마에 헬퍼 함수/audit_log 가 없습니다 (현재 DB: %). '
      'ara-system 마이그레이션 254 가 적용된 공유 프로젝트에서 실행하세요.', current_database();
  END IF;

  -- 감사 함수는 sql/17(기출 문제 은행)이 만든 범용 함수를 그대로 재사용한다.
  IF to_regprocedure('exam.audit_problem_bank()') IS NULL THEN
    RAISE EXCEPTION
      'exam.audit_problem_bank() 가 없습니다. sql/17_problem_bank.sql 을 먼저 적용하세요.';
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. reference_texts — 작품 전문 한 건
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.reference_texts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 작품명. 자동 매칭이 이 이름으로 지문을 찾으므로 비어 있으면 쓸모가 없다
  title       TEXT NOT NULL CHECK (btrim(title) <> ''),
  author      TEXT NOT NULL DEFAULT '',
  -- ⚠️ **평문**이다(HTML 아님). 화면은 텍스트 노드로만 그린다
  body        TEXT NOT NULL DEFAULT '',
  -- 목록이 body 를 읽지 않고도 길이를 보여 주려고 둔다. **트리거가 채운다** —
  -- 앱이 보내는 값은 무시된다(problems.search_text 와 같은 규약).
  char_count  INTEGER NOT NULL DEFAULT 0 CHECK (char_count >= 0),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reference_texts_updated
  ON exam.reference_texts (updated_at DESC);

-- 제목·지은이 검색은 `ilike` 다(트라이그램 인덱스를 두지 않는다 — pg_trgm 확장을 새로
-- 켜야 하고, 이 표는 작품 수백 건 규모라 전체 스캔으로 충분하다).

-- ---------------------------------------------
-- 2. char_count 채우기
-- ---------------------------------------------
-- 이름의 `ab_` 접두사는 의도적이다 — 트리거는 알파벳 순으로 돌므로
-- `aa_enforce_user_id_*` 뒤, `audit_*` 앞이어야 감사 로그가 확정된 값을 본다.
CREATE OR REPLACE FUNCTION exam.reference_texts_fill_char_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = exam, pg_temp
AS $$
BEGIN
  NEW.char_count := length(NEW.body);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ab_reference_texts_char_count ON exam.reference_texts;
CREATE TRIGGER ab_reference_texts_char_count
  BEFORE INSERT OR UPDATE ON exam.reference_texts
  FOR EACH ROW EXECUTE FUNCTION exam.reference_texts_fill_char_count();

-- ---------------------------------------------
-- 3. user_id 강제 / 잠금 + updated_at 트리거
-- ---------------------------------------------
DO $mig$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['reference_texts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS aa_enforce_user_id_%1$s_insert ON exam.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER aa_enforce_user_id_%1$s_insert BEFORE INSERT ON exam.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION exam.enforce_user_id_from_auth()', t);

    EXECUTE format('DROP TRIGGER IF EXISTS aa_lock_user_id_%1$s_update ON exam.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER aa_lock_user_id_%1$s_update BEFORE UPDATE ON exam.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION exam.lock_user_id_on_update()', t);

    EXECUTE format('DROP TRIGGER IF EXISTS %1$s_updated_at ON exam.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER %1$s_updated_at BEFORE UPDATE ON exam.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION exam.update_updated_at()', t);
  END LOOP;
END
$mig$;

-- ---------------------------------------------
-- 4. 감사 로그 — sql/17 의 범용 함수를 그대로 쓴다
-- ---------------------------------------------
-- ⚠️ UPDATE 감사에는 전문이 old_data/new_data 로 **두 번** 실린다. 전문 한 편이
--    수십~수백 KB 라 audit_log 가 눈에 띄게 커지면 **이 UPDATE 트리거만** 떼면 된다
--    (누가 만들고 지웠는지는 INSERT·DELETE 감사에 그대로 남는다).
DROP TRIGGER IF EXISTS audit_reference_texts_insert ON exam.reference_texts;
CREATE TRIGGER audit_reference_texts_insert AFTER INSERT ON exam.reference_texts
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_reference_texts_update ON exam.reference_texts;
CREATE TRIGGER audit_reference_texts_update BEFORE UPDATE ON exam.reference_texts
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_reference_texts_delete ON exam.reference_texts;
CREATE TRIGGER audit_reference_texts_delete BEFORE DELETE ON exam.reference_texts
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

-- ---------------------------------------------
-- 5. RLS — concept_sheets 와 같은 공유 모델
-- ---------------------------------------------
ALTER TABLE exam.reference_texts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage reference_texts" ON exam.reference_texts;
CREATE POLICY "Authenticated users can manage reference_texts" ON exam.reference_texts
  USING      (auth.role() = 'authenticated' AND exam.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

GRANT SELECT, INSERT, UPDATE, DELETE ON exam.reference_texts TO authenticated;
GRANT ALL ON exam.reference_texts TO service_role;

-- ---------------------------------------------
-- 6. 주석
-- ---------------------------------------------
COMMENT ON TABLE exam.reference_texts IS
  '작품 전문. 문제 만들기(O,X·단답형)가 참고자료로 함께 읽는다. 본문은 평문이다.';
COMMENT ON COLUMN exam.reference_texts.body IS
  '작품 전문(평문, HTML 아님). 붙여넣기·.txt·PDF 글자 레이어에서 가져온다.';
COMMENT ON COLUMN exam.reference_texts.char_count IS
  '본문 글자 수. 트리거(ab_reference_texts_char_count)가 채운다 — 앱이 보내는 값은 무시된다.';

-- ---------------------------------------------
-- 7. PostgREST 스키마 캐시 리로드
-- ---------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인용 (실행 후 눈으로)
-- ---------------------------------------------
-- 1) 표가 exam 스키마에 있는지
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'exam' AND table_name = 'reference_texts';
--
-- 2) 정책 1행 (도메인 조건 포함)
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'exam' AND tablename = 'reference_texts';
--
-- 3) 트리거 순서 (aa_ → ab_ → audit_)
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'exam.reference_texts'::regclass
--   AND NOT tgisinternal ORDER BY tgname;
