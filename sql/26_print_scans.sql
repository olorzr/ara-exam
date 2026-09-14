-- =============================================
-- 26. 학교 프린트 시험지 (print scan → bundle → concept sheet)
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   아이들이 학교에서 받아 온 프린트를 스캔해 올리면, 선생님 PC 의 ChatGPT 가 읽어
--   **개념지**로 만든다. 그 뒤는 개념지와 완전히 같다 — 빈칸 마킹 → 1~3단계 시험지 인쇄
--   → 학원 성적 등록. 그래서 시험지 자체를 위한 새 표는 만들지 않는다.
--
-- 구조:
--   print_scans   (업로드한 스캔 PDF 1건)
--     └ print_bundles (묶음 = 프린트 한 장. 쪽 집합 + 학교/년도/학년/프린트명)
--          └ concept_sheets.print_bundle_id  (그 묶음에서 만들어진 시험지)
--
--   한 PDF 에 여러 아이의 여러 프린트가 섞여 오기 때문에 '묶음' 이 필요하다.
--   OCR 은 묶음 단위로 돈다(묶음 하나가 한 프린트이자 한 개념지다).
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--   개념지 목록 조회가 `print_bundle_id` 를 참조하므로, 앱이 먼저 배포되면
--   개념지 목록 전체가 42703(컬럼 없음)으로 죽는다.
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

  -- 시험지는 개념지 표에 담긴다 — 그 표가 없으면 이 기능이 성립하지 않는다.
  IF to_regclass('exam.concept_sheets') IS NULL
     OR to_regclass('exam.schools') IS NULL
     OR to_regclass('exam.school_materials') IS NULL THEN
    RAISE EXCEPTION 'exam.concept_sheets / schools / school_materials 가 없습니다 (현재 DB: %).',
      current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. print_scans — 업로드한 스캔 PDF 1건
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.print_scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT '',
  -- 원본 PDF 의 Storage 경로. **다시 읽기가 이것에 달려 있다** —
  -- 실패한 묶음을 파일 없이 다시 읽을 방법이 없다.
  file_path   TEXT NOT NULL DEFAULT '',
  page_count  INTEGER NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_scans_created
  ON exam.print_scans (created_at DESC);

-- ---------------------------------------------
-- 2. print_bundles — 묶음(프린트 한 장)
-- ---------------------------------------------
-- 분류 텍스트는 categories 관례를 그대로 따른다: TEXT NOT NULL DEFAULT '' 이고 '' 가 "미지정".
CREATE TABLE IF NOT EXISTS exam.print_bundles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     UUID NOT NULL REFERENCES exam.print_scans(id) ON DELETE CASCADE,
  -- 프린트명 — 개념지의 unit(= categories.chapter) 으로 복사된다
  name        TEXT NOT NULL CHECK (btrim(name) <> ''),
  -- 학교 마스터 id 스냅샷. **FK 가 아니다**(problem_sources.school_id 와 같은 규약) —
  -- 학교가 지워져도 이미 만든 시험지는 남아야 한다. 표시·동기화는 school_name 이 한다.
  school_id   UUID,
  school_name TEXT NOT NULL DEFAULT '',
  year        TEXT NOT NULL DEFAULT '',
  grade       TEXT NOT NULL DEFAULT '',
  -- 학생이 손으로 적은 답·필기까지 옮길 것인가. 기본은 꺼짐(인쇄된 글만).
  include_handwriting BOOLEAN NOT NULL DEFAULT false,
  -- 이 묶음이 덮는 원본 쪽 번호(1-based, 오름차순). 하나도 없는 묶음은 읽을 것이 없다.
  pages       INTEGER[] NOT NULL DEFAULT '{}' CHECK (cardinality(pages) >= 1),
  -- pages 와 **같은 순서**의 Storage 경로. 올리지 못한 쪽은 빈 문자열로 자리를 남긴다
  -- (압축하면 쪽 번호와 어긋나 엉뚱한 쪽 이미지가 옆에 붙는다).
  page_paths  TEXT[] NOT NULL DEFAULT '{}',
  -- 읽어 낸 원문. 시험지를 지우고 다시 만들 때 ChatGPT 를 또 쓰지 않으려고 남긴다.
  ocr_html    TEXT NOT NULL DEFAULT '',
  ocr_meta    JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT '대기'
              CHECK (status IN ('대기', '읽는중', '읽기완료', '실패')),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_bundles_scan
  ON exam.print_bundles (scan_id, created_at);
CREATE INDEX IF NOT EXISTS idx_print_bundles_status
  ON exam.print_bundles (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_bundles_school
  ON exam.print_bundles (school_name, year, grade);

-- ---------------------------------------------
-- 3. concept_sheets ← 묶음 연결
-- ---------------------------------------------
-- ⚠️ ON DELETE **CASCADE** 다(SET NULL 아님). 근거:
--   프린트 시험지는 개념지 목록(/exam/builder)에서 `print_bundle_id IS NULL` 로 숨긴다.
--   SET NULL 이면 묶음을 지운 순간 그 시험지들이 개념지 목록에 **갑자기 나타난다** —
--   숨기기로 한 결정이 삭제로 깨진다. 앱에서 시험지를 먼저 지우는 방법도 있지만
--   두 번의 DELETE 는 원자적이지 않다(중간에 끊기면 고아가 남는다).
--   대신 삭제 확인창이 **함께 사라지는 시험지 수를 반드시 밝힌다**
--   (이미 학원 성적에 등록된 회차는 ara-system 쪽 복사본이라 사라지지 않는다).
ALTER TABLE exam.concept_sheets
  ADD COLUMN IF NOT EXISTS print_bundle_id UUID
  REFERENCES exam.print_bundles(id) ON DELETE CASCADE;

-- 묶음당 시험지는 하나다. 부분 유니크라서 일반 개념지(NULL)는 얼마든지 있을 수 있고,
-- 다시 읽기가 옛 실패와 겹쳐도 두 번째 INSERT 가 23505 로 드러난다(조용한 중복 방지).
CREATE UNIQUE INDEX IF NOT EXISTS idx_concept_sheets_print_bundle
  ON exam.concept_sheets (print_bundle_id)
  WHERE print_bundle_id IS NOT NULL;

-- ---------------------------------------------
-- 4. user_id 강제 / 잠금 + updated_at 트리거
-- ---------------------------------------------
-- 이름의 `aa_` 접두사는 의도적이다 — 트리거는 알파벳 순으로 실행되므로
-- 감사 트리거보다 먼저 돌아야 audit 의 new_data 가 확정된 user_id 를 본다(sql/17 과 같은 규약).
DO $mig$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['print_scans', 'print_bundles'] LOOP
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
-- 5. 감사 로그 — sql/17 의 범용 함수를 그대로 쓴다
-- ---------------------------------------------
-- `exam.audit_problem_bank()` 는 TG_TABLE_NAME 으로 표 이름을 읽고 UPDATE 에서
-- NEW.updated_by 를 채우는 **범용** 함수라 새 표에 그대로 붙일 수 있다.
--
-- passages·problems 와 달리 INSERT 도 감사한다 — OCR 한 번에 수백 행이 들어가는 표가
-- 아니라 스캔 1행 + 묶음 몇 행이라 audit_log 가 커지지 않는다.
-- 묶음 UPDATE 에는 ocr_html 이 old_data/new_data 로 두 번 실린다(묶음당 2~3회, 수십 KB).
-- 프린트 한 장 분량이라 감수한 값이다 — 더 줄이려면 이 UPDATE 트리거만 떼면 된다.
DROP TRIGGER IF EXISTS audit_print_scans_insert ON exam.print_scans;
CREATE TRIGGER audit_print_scans_insert AFTER INSERT ON exam.print_scans
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_print_scans_update ON exam.print_scans;
CREATE TRIGGER audit_print_scans_update BEFORE UPDATE ON exam.print_scans
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_print_scans_delete ON exam.print_scans;
CREATE TRIGGER audit_print_scans_delete BEFORE DELETE ON exam.print_scans
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_print_bundles_insert ON exam.print_bundles;
CREATE TRIGGER audit_print_bundles_insert AFTER INSERT ON exam.print_bundles
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_print_bundles_update ON exam.print_bundles;
CREATE TRIGGER audit_print_bundles_update BEFORE UPDATE ON exam.print_bundles
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_print_bundles_delete ON exam.print_bundles;
CREATE TRIGGER audit_print_bundles_delete BEFORE DELETE ON exam.print_bundles
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

-- ---------------------------------------------
-- 6. RLS — concept_sheets 와 같은 공유 모델
-- ---------------------------------------------
ALTER TABLE exam.print_scans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.print_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage print_scans" ON exam.print_scans;
CREATE POLICY "Authenticated users can manage print_scans" ON exam.print_scans
  USING      (auth.role() = 'authenticated' AND exam.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

DROP POLICY IF EXISTS "Authenticated users can manage print_bundles" ON exam.print_bundles;
CREATE POLICY "Authenticated users can manage print_bundles" ON exam.print_bundles
  USING      (auth.role() = 'authenticated' AND exam.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

-- 권한: mig254 의 ALTER DEFAULT PRIVILEGES 가 있지만 실행 롤이 다르면 적용되지 않으므로 명시한다
GRANT SELECT, INSERT, UPDATE, DELETE ON exam.print_scans, exam.print_bundles TO authenticated;
GRANT ALL ON exam.print_scans, exam.print_bundles TO service_role;

-- ---------------------------------------------
-- 7. 이름 변경 동기화 확장 (학교명·프린트명 → print_bundles)
-- ---------------------------------------------
-- ⚠️ sql/01 과 sql/15 는 이 두 함수를 **무자격**(`CREATE FUNCTION sync_school_name()`)으로
--    정의했다 — exam 스키마 이전 시대의 표기라 DB 에 따라 `public` 에 남아 있을 수 있다.
--    여기서 `exam.` 으로 다시 정의하고 **트리거도 다시 걸어** 어느 쪽을 가리키고 있었든
--    확실히 새 정의를 쓰게 한다. 이 파일이 두 함수의 **정본**이다.
--
-- 왜 필요한가: 개념지와 마찬가지로 묶음도 학교명·프린트명을 **텍스트로 복사**해 들고 있다.
-- 안 따라가면 카테고리 관리에서 이름을 바꾼 순간 프린트 목록만 옛 이름으로 남는다.
CREATE OR REPLACE FUNCTION exam.sync_school_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = exam, pg_temp
AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE exam.categories
    SET school_name = NEW.name
    WHERE school_name = OLD.name
      AND level = '외부지문 및 프린트';

    UPDATE exam.concept_sheets
    SET school_name = NEW.name
    WHERE school_name = OLD.name
      AND level = '외부지문 및 프린트';

    -- 프린트 묶음도 학교명을 복사해 들고 있다(레벨 컬럼이 없다 — 전부 외부지문이다)
    UPDATE exam.print_bundles
    SET school_name = NEW.name
    WHERE school_name = OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION exam.sync_school_material_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = exam, pg_temp
AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE exam.categories
    SET chapter = NEW.name
    FROM exam.schools s
    WHERE categories.chapter = OLD.name
      AND categories.school_name = s.name
      AND categories.level = '외부지문 및 프린트'
      AND categories.year = OLD.year
      AND categories.grade = OLD.grade
      AND s.id = OLD.school_id;

    UPDATE exam.concept_sheets
    SET unit = NEW.name
    FROM exam.schools s
    WHERE concept_sheets.unit = OLD.name
      AND concept_sheets.school_name = s.name
      AND concept_sheets.level = '외부지문 및 프린트'
      AND concept_sheets.year = OLD.year
      AND concept_sheets.grade = OLD.grade
      AND s.id = OLD.school_id;

    -- 묶음의 프린트명. year/grade 로 좁히는 이유는 위 두 UPDATE 와 같다 —
    -- 안 좁히면 다른 년도·학년의 동명 프린트까지 함께 바뀐다.
    UPDATE exam.print_bundles
    SET name = NEW.name
    FROM exam.schools s
    WHERE print_bundles.name = OLD.name
      AND print_bundles.school_name = s.name
      AND print_bundles.year = OLD.year
      AND print_bundles.grade = OLD.grade
      AND s.id = OLD.school_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 트리거를 다시 건다 — 옛 `public.` 함수를 가리키고 있었다면 그대로 두면 새 정의가 안 돈다
DROP TRIGGER IF EXISTS sync_school_name_trigger ON exam.schools;
CREATE TRIGGER sync_school_name_trigger
  AFTER UPDATE ON exam.schools
  FOR EACH ROW
  EXECUTE FUNCTION exam.sync_school_name();

DROP TRIGGER IF EXISTS sync_school_material_name_trigger ON exam.school_materials;
CREATE TRIGGER sync_school_material_name_trigger
  AFTER UPDATE ON exam.school_materials
  FOR EACH ROW
  EXECUTE FUNCTION exam.sync_school_material_name();

-- ---------------------------------------------
-- 8. Storage — 새 버킷을 만들지 않는다
-- ---------------------------------------------
-- `exam-problem-bank` 버킷을 그대로 쓴다(정책이 버킷 단위이고 MIME 화이트리스트에
-- application/pdf·image/jpeg 가 이미 있다). 새 경로 가족만 추가된다:
--   print-scans/{scan_id}/original.pdf
--   print-scans/{scan_id}/pages/{n}.jpg
-- 업로드는 여기서도 **upsert:false** 다(UPDATE 정책이 없다 — sql/17 주석 참고).

-- ---------------------------------------------
-- 9. 주석
-- ---------------------------------------------
COMMENT ON TABLE exam.print_scans IS
  '학교 프린트 스캔 PDF 1건. 한 파일에 여러 프린트가 섞여 있을 수 있어 묶음으로 나눈다.';
COMMENT ON TABLE exam.print_bundles IS
  '프린트 한 장(= 개념지 한 장). 원본 쪽 집합 + 학교/년도/학년/프린트명 + 손글씨 포함 여부.';
COMMENT ON COLUMN exam.print_bundles.pages IS
  '이 묶음이 덮는 원본 쪽 번호(1-based, 오름차순). page_paths 와 순서가 같다.';
COMMENT ON COLUMN exam.print_bundles.page_paths IS
  'pages 와 같은 순서의 Storage 경로. 올리지 못한 쪽은 빈 문자열로 자리를 남긴다.';
COMMENT ON COLUMN exam.print_bundles.include_handwriting IS
  '학생이 손으로 적은 답·필기까지 옮길지. 기본 false(인쇄된 글만).';
COMMENT ON COLUMN exam.print_bundles.ocr_html IS
  '읽어 낸 원문(정화 완료). 시험지를 다시 만들 때 ChatGPT 를 또 쓰지 않으려고 남긴다.';
COMMENT ON COLUMN exam.concept_sheets.print_bundle_id IS
  '학교 프린트 묶음에서 만든 개념지. 개념지 목록(/exam/builder)은 이 값이 NULL 인 행만 보여 주고, 프린트 시험지는 /print-sheets 에서만 보인다.';

-- ---------------------------------------------
-- 10. PostgREST 스키마 캐시 리로드
-- ---------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인용 (실행 후 눈으로)
-- ---------------------------------------------
-- 1) 표 2개가 exam 스키마에 있는지
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'exam' AND table_name LIKE 'print_%';
--
-- 2) 정책 2행 (둘 다 도메인 조건)
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'exam' AND tablename IN ('print_scans','print_bundles');
--
-- 3) 동기화 함수가 exam 에 있는지 + public 잔재 확인
--    (public 행이 보이면 더 이상 쓰이지 않는 옛 정의다 — 아래 4)로 트리거 연결을 확인할 것)
-- SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE p.proname IN ('sync_school_name', 'sync_school_material_name') ORDER BY 1;
--
-- 4) 트리거가 exam 함수에 묶였는지 (nspname 이 둘 다 exam 이어야 한다)
-- SELECT t.tgname, n.nspname AS fn_schema, p.proname
--   FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE t.tgname IN ('sync_school_name_trigger', 'sync_school_material_name_trigger');
--
-- 5) 개념지 연결 컬럼·유니크 인덱스
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'exam' AND indexname = 'idx_concept_sheets_print_bundle';
