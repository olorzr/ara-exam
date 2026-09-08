-- =============================================
-- 17. 기출 문제 은행 (problem bank)
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   학교 내신 기출·모의고사·문제집 PDF 를 선생님 PC 의 ChatGPT(코덱스 브릿지)로 읽어
--   지문·문항 단위로 아카이빙하고, 그 문항을 골라 새 문제지를 조합·인쇄한다.
--   기존 단어 시험지(exams/exam_words)와는 별개의 도메인이라 테이블을 새로 만든다.
--
-- 구조:
--   problem_sources (업로드한 PDF 1건)
--     └ passages     (공유 지문 — "[1~3] 다음 글을 읽고 물음에 답하시오")
--     └ problems     (문항 — passage_id 로 지문에 붙는다)
--   problem_papers / problem_paper_items (조합한 문제지 + 불변 스냅샷)
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--   앱이 먼저 배포되면 문제 은행 화면 전체가 PGRST205(테이블 없음)로 죽는다.
--
-- ⚠️ 이 앱의 테이블은 ara-system 과 공유하는 Supabase 프로젝트의 **exam 스키마**에 있고,
--   `public` 에는 ara-system 의 동명 테이블(schools 등)이 따로 존재한다. Supabase SQL Editor 는
--   문(statement)마다 다른 백엔드에 보낼 수 있어 파일 머리의 `SET search_path` 를 믿으면 안 된다
--   (sql/16 의 함수가 실제로 public 에 생성된 사고가 있었다).
--   → **아래 모든 DDL 은 `exam.` 으로 스키마를 명시**한다.
--
-- ⚠️ 헬퍼 함수는 `public` 이 아니라 **`exam` 스키마**에 있다(ara-system mig254 가 만들었다).
--   sql/01~14 의 `public.is_allowed_domain()` 표기는 옛 standalone 프로젝트 기준이다.

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
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. problem_sources — 업로드한 원본 문서 1건
-- ---------------------------------------------
-- 분류 텍스트는 categories 관례를 그대로 따른다: TEXT NOT NULL DEFAULT '' 이고 '' 가 "미지정".
-- NULL 을 쓰면 화면 Select(shadcn) 와 필터 비교가 갈라진다.
CREATE TABLE IF NOT EXISTS exam.problem_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type  TEXT NOT NULL CHECK (source_type IN ('내신기출', '모의고사', '문제집', '프린트')),
  title        TEXT NOT NULL CHECK (btrim(title) <> ''),
  school_name  TEXT NOT NULL DEFAULT '',
  year         TEXT NOT NULL DEFAULT '',
  grade        TEXT NOT NULL DEFAULT '',
  semester     TEXT NOT NULL DEFAULT '',
  exam_type    TEXT NOT NULL DEFAULT '' CHECK (exam_type IN ('', '중간', '기말')),
  -- 문제집이면 출판사, 모의고사면 주관(교육청·평가원)
  publisher    TEXT NOT NULL DEFAULT '',
  -- Storage 경로(버킷 exam-problem-bank 기준). 업로드 실패 시 '' 로 남는다
  file_path    TEXT NOT NULL DEFAULT '',
  page_count   INT  NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  status       TEXT NOT NULL DEFAULT '업로드' CHECK (status IN ('업로드', '추출중', '검수중', '완료')),
  -- OCR 실행 기록(model·effort·묶음 수·소요시간·경고). 감사 로그 대신 여기 남긴다
  ocr_meta     JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes        TEXT NOT NULL DEFAULT '',
  user_id      UUID NOT NULL,
  updated_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_sources_filter
  ON exam.problem_sources (source_type, school_name, year, grade);
CREATE INDEX IF NOT EXISTS idx_problem_sources_status
  ON exam.problem_sources (status, created_at DESC);

-- ---------------------------------------------
-- 2. passages — 여러 문항이 공유하는 지문
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.passages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES exam.problem_sources(id) ON DELETE CASCADE,
  -- '[1~3]' 처럼 시험지에 인쇄된 머리글 범위
  label       TEXT NOT NULL DEFAULT '',
  -- 작품명 / 글 제목
  title       TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  html        TEXT NOT NULL DEFAULT '',
  page_no     INT  NOT NULL DEFAULT 0 CHECK (page_no >= 0),
  -- {x,y,w,h} 정규화(0~1) 좌표. 크롭 실패/미측정이면 NULL
  bbox        JSONB CHECK (bbox IS NULL OR jsonb_typeof(bbox) = 'object'),
  image_path  TEXT NOT NULL DEFAULT '',
  -- 'image' 면 인쇄에서 html 대신 image_path 를 쓴다(표·그림이 많아 글로 못 옮긴 지문)
  render_mode TEXT NOT NULL DEFAULT 'text' CHECK (render_mode IN ('text', 'image')),
  -- ara-system 영역 분류 마스터의 **이름 경로 스냅샷**(id 가 아니다).
  -- 마스터에서 이름을 바꾸거나 노드를 지워도 이미 태깅한 문항은 그대로여야 한다.
  area_path   TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(area_path) <= 4),
  user_id     UUID NOT NULL,
  updated_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passages_source ON exam.passages (source_id, page_no);

-- ---------------------------------------------
-- 3. problems — 문항
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.problems (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        UUID NOT NULL REFERENCES exam.problem_sources(id) ON DELETE CASCADE,
  -- 지문을 지워도 문항은 남는다(발문만으로도 출제 가능)
  passage_id       UUID REFERENCES exam.passages(id) ON DELETE SET NULL,
  -- 원본 시험지의 문항 번호. 문제지로 조합하면 1..N 으로 다시 매긴다
  number           INT CHECK (number IS NULL OR number >= 1),
  question_type    TEXT NOT NULL DEFAULT '객관식' CHECK (question_type IN ('객관식', '주관식', '서술형')),
  stem_html        TEXT NOT NULL DEFAULT '',
  -- 선지 본문 배열(①~⑤ 기호는 렌더에서 붙인다). 주관식·서술형은 빈 배열
  choices          JSONB NOT NULL DEFAULT '[]'::jsonb
                     CHECK (jsonb_typeof(choices) = 'array' AND jsonb_array_length(choices) <= 5),
  -- 객관식은 '1'~'5', 그 밖은 자유 텍스트. '' = 미입력(정답표에 없었거나 아직 안 넣음)
  answer           TEXT NOT NULL DEFAULT '',
  -- 인쇄된 배점을 못 읽었으면 NULL. 0 이나 균등값으로 채우지 않는다
  score            NUMERIC(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  explanation_html TEXT NOT NULL DEFAULT '',
  area_path        TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(area_path) <= 4),
  work_title       TEXT NOT NULL DEFAULT '',
  tags             TEXT[] NOT NULL DEFAULT '{}',
  page_no          INT  NOT NULL DEFAULT 0 CHECK (page_no >= 0),
  bbox             JSONB CHECK (bbox IS NULL OR jsonb_typeof(bbox) = 'object'),
  image_path       TEXT NOT NULL DEFAULT '',
  -- 발문 안에 끼워 넣을 그림·표 이미지들(텍스트 출제일 때도 쓸 수 있다)
  figure_paths     TEXT[] NOT NULL DEFAULT '{}',
  render_mode      TEXT NOT NULL DEFAULT 'text' CHECK (render_mode IN ('text', 'image')),
  status           TEXT NOT NULL DEFAULT '초안' CHECK (status IN ('초안', '검수완료')),
  verified_by      UUID,
  verified_at      TIMESTAMPTZ,
  -- 검색용 평문(태그 제거 + 소문자). 트리거가 채운다 — 앱에서 보내지 말 것
  search_text      TEXT NOT NULL DEFAULT '',
  user_id          UUID NOT NULL,
  updated_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (source_id, number) 는 **유니크가 아니다**: 문제집·프린트는 절마다 번호가 1부터 다시 시작하고,
-- PostgREST 의 일괄 INSERT 는 원자적이라 중복 하나에 OCR 결과 전체가 실패한다.
-- 중복 정리는 클라이언트 병합(merge.ts, (page, number) first-wins)이 맡는다.
CREATE INDEX IF NOT EXISTS idx_problems_source_number ON exam.problems (source_id, number);
CREATE INDEX IF NOT EXISTS idx_problems_source_page   ON exam.problems (source_id, page_no);
CREATE INDEX IF NOT EXISTS idx_problems_passage       ON exam.problems (passage_id);
CREATE INDEX IF NOT EXISTS idx_problems_area          ON exam.problems USING GIN (area_path);
CREATE INDEX IF NOT EXISTS idx_problems_status        ON exam.problems (status);
CREATE INDEX IF NOT EXISTS idx_problems_work_title    ON exam.problems (work_title);

-- ---------------------------------------------
-- 4. problem_papers / problem_paper_items — 조합한 문제지
-- ---------------------------------------------
-- exams/exam_words 와 같은 규약: 본문은 **불변 스냅샷**이라 원본 문항을 고쳐도
-- 이미 인쇄한 문제지는 변하지 않는다. 쓰기는 RPC 한 곳으로만 열린다.
CREATE TABLE IF NOT EXISTS exam.problem_papers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL CHECK (btrim(title) <> ''),
  -- {columns:1|2, showScore:bool, showSource:bool} — RPC 가 화이트리스트로 재조립한다
  settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 인쇄 머리말의 출처 줄('2025 중2 상현중 중간')
  source_labels   TEXT[] NOT NULL DEFAULT '{}',
  total_questions INT NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  user_id         UUID NOT NULL,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_papers_created ON exam.problem_papers (created_at DESC);

CREATE TABLE IF NOT EXISTS exam.problem_paper_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id    UUID NOT NULL REFERENCES exam.problem_papers(id) ON DELETE CASCADE,
  order_index INT  NOT NULL CHECK (order_index >= 0),
  -- 원본이 지워져도 스냅샷으로 계속 인쇄된다(추적용 링크일 뿐)
  problem_id  UUID REFERENCES exam.problems(id) ON DELETE SET NULL,
  passage_id  UUID REFERENCES exam.passages(id) ON DELETE SET NULL,
  snapshot    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT problem_paper_items_order_unique UNIQUE (paper_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_problem_paper_items_paper ON exam.problem_paper_items (paper_id, order_index);
CREATE INDEX IF NOT EXISTS idx_problem_paper_items_problem ON exam.problem_paper_items (problem_id);

-- ---------------------------------------------
-- 5. 검색 평문 트리거 (problems.search_text)
-- ---------------------------------------------
-- PostgREST `.or()` + ilike 는 백슬래시·`*` 이스케이프가 까다로워 쓰지 않는다
-- (ara-system reference: PostgREST .or() + ilike escaping). 대신 평문 컬럼 하나에
-- 발문·선지·작품명을 모아 두고 단일 ilike 로 찾는다.
CREATE OR REPLACE FUNCTION exam.problems_search_text() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  NEW.search_text := lower(btrim(regexp_replace(
    regexp_replace(
      COALESCE(NEW.stem_html, '') || ' ' ||
      COALESCE((SELECT string_agg(c, ' ') FROM jsonb_array_elements_text(NEW.choices) AS t(c)), '') || ' ' ||
      COALESCE(NEW.work_title, ''),
      '<[^>]*>', ' ', 'g'),                 -- 태그 제거
    '\s+', ' ', 'g')));                     -- 공백 축약
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS problems_search_text ON exam.problems;
CREATE TRIGGER problems_search_text
  BEFORE INSERT OR UPDATE ON exam.problems
  FOR EACH ROW EXECUTE FUNCTION exam.problems_search_text();

-- ---------------------------------------------
-- 6. user_id 강제 / 잠금 + updated_at 트리거
-- ---------------------------------------------
-- 이름의 `aa_` 접두사는 의도적이다 — 트리거는 알파벳 순으로 실행되므로
-- 감사 트리거보다 먼저 돌아야 audit 의 new_data 가 확정된 user_id 를 본다.
DO $mig$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['problem_sources', 'passages', 'problems', 'problem_papers'] LOOP
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
-- 7. 감사 로그
-- ---------------------------------------------
-- 기존 감사 함수는 테이블마다 3개씩(insert/update/delete) 있지만, 여기서는 표 이름을
-- TG_TABLE_NAME 으로 읽는 범용 함수 하나를 쓴다 — 새 표 4개면 12개가 되어 관리가 어렵다.
-- 보안 형태(SECURITY DEFINER + search_path 고정, pg_temp 마지막)는 동일하다.
CREATE OR REPLACE FUNCTION exam.audit_problem_bank() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
  END IF;

  INSERT INTO audit_log (table_name, record_id, action, actor_id, actor_email, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ⚠️ passages·problems 는 **INSERT 를 감사하지 않는다.**
--    OCR 한 번이 수백 행을 넣는데 본문 HTML 째로 audit_log 에 복사하면 표가 폭발한다.
--    "언제 누가 무엇을 추출했나"는 problem_sources.ocr_meta + 그 행의 UPDATE 감사로 남는다.
--    수정·삭제(사람이 하는 행위)는 전부 감사한다.
DROP TRIGGER IF EXISTS audit_problem_sources_insert ON exam.problem_sources;
CREATE TRIGGER audit_problem_sources_insert AFTER INSERT ON exam.problem_sources
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();
DROP TRIGGER IF EXISTS audit_problem_sources_update ON exam.problem_sources;
CREATE TRIGGER audit_problem_sources_update BEFORE UPDATE ON exam.problem_sources
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();
DROP TRIGGER IF EXISTS audit_problem_sources_delete ON exam.problem_sources;
CREATE TRIGGER audit_problem_sources_delete BEFORE DELETE ON exam.problem_sources
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_passages_update ON exam.passages;
CREATE TRIGGER audit_passages_update BEFORE UPDATE ON exam.passages
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();
DROP TRIGGER IF EXISTS audit_passages_delete ON exam.passages;
CREATE TRIGGER audit_passages_delete BEFORE DELETE ON exam.passages
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_problems_update ON exam.problems;
CREATE TRIGGER audit_problems_update BEFORE UPDATE ON exam.problems
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();
DROP TRIGGER IF EXISTS audit_problems_delete ON exam.problems;
CREATE TRIGGER audit_problems_delete BEFORE DELETE ON exam.problems
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

DROP TRIGGER IF EXISTS audit_problem_papers_insert ON exam.problem_papers;
CREATE TRIGGER audit_problem_papers_insert AFTER INSERT ON exam.problem_papers
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();
DROP TRIGGER IF EXISTS audit_problem_papers_delete ON exam.problem_papers;
CREATE TRIGGER audit_problem_papers_delete BEFORE DELETE ON exam.problem_papers
  FOR EACH ROW EXECUTE FUNCTION exam.audit_problem_bank();

-- ---------------------------------------------
-- 8. RLS
-- ---------------------------------------------
-- 도메인 조건(exam.is_allowed_domain())은 데이터 계층의 권위다. 세션이 localStorage 에
-- 있어 서버 미들웨어로 못 막기 때문에 **모든 정책에 반드시 함께** 넣는다.
ALTER TABLE exam.problem_sources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.passages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.problems            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.problem_papers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam.problem_paper_items ENABLE ROW LEVEL SECURITY;

-- 아카이브 3표는 concept_sheets 와 같은 공유 모델 — 선생님들이 함께 검수한다
DROP POLICY IF EXISTS "Authenticated users can manage problem_sources" ON exam.problem_sources;
CREATE POLICY "Authenticated users can manage problem_sources" ON exam.problem_sources
  USING      (auth.role() = 'authenticated' AND exam.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

DROP POLICY IF EXISTS "Authenticated users can manage passages" ON exam.passages;
CREATE POLICY "Authenticated users can manage passages" ON exam.passages
  USING      (auth.role() = 'authenticated' AND exam.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

DROP POLICY IF EXISTS "Authenticated users can manage problems" ON exam.problems;
CREATE POLICY "Authenticated users can manage problems" ON exam.problems
  USING      (auth.role() = 'authenticated' AND exam.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND exam.is_allowed_domain());

-- 문제지는 exams 와 같은 잠금 모델: 읽기·삭제만 열고 생성은 RPC 로만.
-- INSERT/UPDATE 정책이 **없으므로 기본 거부**다(직접 INSERT 로 위조 불가).
DROP POLICY IF EXISTS "Authenticated users can read problem_papers" ON exam.problem_papers;
CREATE POLICY "Authenticated users can read problem_papers" ON exam.problem_papers
  FOR SELECT USING (auth.role() = 'authenticated' AND exam.is_allowed_domain());
DROP POLICY IF EXISTS "Authenticated users can delete problem_papers" ON exam.problem_papers;
CREATE POLICY "Authenticated users can delete problem_papers" ON exam.problem_papers
  FOR DELETE USING (auth.role() = 'authenticated' AND exam.is_allowed_domain());

-- 항목은 읽기 전용(삭제는 부모 CASCADE)
DROP POLICY IF EXISTS "Authenticated users can read problem_paper_items" ON exam.problem_paper_items;
CREATE POLICY "Authenticated users can read problem_paper_items" ON exam.problem_paper_items
  FOR SELECT USING (auth.role() = 'authenticated' AND exam.is_allowed_domain());

-- 권한: mig254 의 ALTER DEFAULT PRIVILEGES 가 있지만 실행 롤이 다르면 적용되지 않으므로 명시한다
GRANT SELECT, INSERT, UPDATE, DELETE ON exam.problem_sources, exam.passages, exam.problems TO authenticated;
GRANT SELECT, DELETE ON exam.problem_papers TO authenticated;
GRANT SELECT ON exam.problem_paper_items TO authenticated;
GRANT ALL ON exam.problem_sources, exam.passages, exam.problems,
             exam.problem_papers, exam.problem_paper_items TO service_role;

-- ---------------------------------------------
-- 9. RPC — 문제지 생성 (유일한 쓰기 경로)
-- ---------------------------------------------
-- SECURITY DEFINER 라 잠긴 RLS 를 우회해 INSERT 한다. 우회하는 만큼 도메인 검사를
-- **함수 본문에서 직접** 한다(정책이 안 걸리므로). owner 는 postgres 여야 한다.
CREATE OR REPLACE FUNCTION exam.create_problem_paper(
  p_title       TEXT,
  p_problem_ids UUID[],
  p_settings    JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_paper_id  UUID;
  v_count     INT;
  v_found     INT;
  v_broken    INT;
  v_settings  JSONB;
BEGIN
  IF NOT exam.is_allowed_domain() THEN
    RAISE EXCEPTION '허용되지 않은 계정입니다' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION '문제지 제목이 필요합니다' USING ERRCODE = 'check_violation';
  END IF;

  v_count := COALESCE(cardinality(p_problem_ids), 0);
  IF v_count < 1 OR v_count > 200 THEN
    RAISE EXCEPTION '문항은 1~200개여야 합니다 (요청: %)', v_count USING ERRCODE = 'check_violation';
  END IF;

  IF v_count <> (SELECT COUNT(DISTINCT x) FROM unnest(p_problem_ids) AS x) THEN
    RAISE EXCEPTION '같은 문항이 두 번 들어 있습니다' USING ERRCODE = 'check_violation';
  END IF;

  -- ⚠️ **검사 전에 잠근다.** 기본 격리 수준(READ COMMITTED)에서는 문(statement)마다
  --    다른 스냅샷을 보므로, 검사와 스냅샷 INSERT 사이에 남이 문항을 지우거나 지문을
  --    바꾸면 조용히 어긋난다 — 지워진 문항은 INSERT 에서 빠지는데 total_questions 는
  --    그대로 남고, 지문이 바뀌면 연속성 검사를 통과한 배치가 실제로는 흩어진다.
  --    잠금은 이 트랜잭션이 끝날 때까지 유지되어 아래 조립까지 같은 상태를 본다.
  PERFORM 1 FROM exam.problems WHERE id = ANY (p_problem_ids) FOR UPDATE;

  SELECT COUNT(*) INTO v_found FROM exam.problems WHERE id = ANY (p_problem_ids);
  IF v_found <> v_count THEN
    RAISE EXCEPTION '존재하지 않는 문항이 있습니다 (%/%)', v_found, v_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 지문 연속성: 같은 지문의 문항은 반드시 붙어 있어야 한다.
  -- 흩어지면 인쇄에서 같은 지문이 여러 번 반복되거나 머리글 범위가 거짓말을 한다.
  -- (gaps-and-islands: 지문별로 ord 연속 구간이 2개 이상이면 흩어진 것)
  WITH joined AS (
    SELECT t.ord, p.passage_id
      FROM unnest(p_problem_ids) WITH ORDINALITY AS t(pid, ord)
      JOIN exam.problems p ON p.id = t.pid
     WHERE p.passage_id IS NOT NULL
  ), islands AS (
    SELECT passage_id,
           ord - ROW_NUMBER() OVER (PARTITION BY passage_id ORDER BY ord) AS island
      FROM joined
  )
  SELECT COUNT(*) INTO v_broken
    FROM (SELECT passage_id FROM islands GROUP BY passage_id HAVING COUNT(DISTINCT island) > 1) x;

  IF v_broken > 0 THEN
    RAISE EXCEPTION '같은 지문의 문항이 떨어져 있습니다 (지문 %개)', v_broken
      USING ERRCODE = 'check_violation';
  END IF;

  -- 설정은 클라이언트 값을 그대로 담지 않고 화이트리스트로 재조립한다.
  -- 문자열 캐스팅 오류가 나지 않도록 값 비교로만 판정한다.
  v_settings := jsonb_build_object(
    'columns',    CASE WHEN p_settings ->> 'columns' = '1' THEN 1 ELSE 2 END,
    'showScore',  CASE WHEN p_settings ->> 'showScore'  = 'false' THEN false ELSE true END,
    'showSource', CASE WHEN p_settings ->> 'showSource' = 'true'  THEN true  ELSE false END
  );

  INSERT INTO exam.problem_papers (title, settings, total_questions, source_labels, user_id)
  SELECT
    btrim(p_title),
    v_settings,
    v_count,
    COALESCE(ARRAY(
      SELECT DISTINCT COALESCE(
        NULLIF(btrim(concat_ws(' ',
          NULLIF(s.year, ''), NULLIF(s.grade, ''),
          NULLIF(s.school_name, ''), NULLIF(s.exam_type, ''))), ''),
        s.title)
        FROM exam.problems p
        JOIN exam.problem_sources s ON s.id = p.source_id
       WHERE p.id = ANY (p_problem_ids)
       ORDER BY 1
    ), '{}'),
    -- user_id 는 aa_enforce_user_id 트리거가 auth.uid() 로 덮어쓴다(자리만 채운다)
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  RETURNING id INTO v_paper_id;

  -- 본문 스냅샷 — 원본이 바뀌거나 지워져도 이 문제지는 그대로다
  INSERT INTO exam.problem_paper_items (paper_id, order_index, problem_id, passage_id, snapshot)
  SELECT
    v_paper_id,
    (t.ord - 1)::INT,
    p.id,
    p.passage_id,
    jsonb_build_object(
      'number',           p.number,
      'question_type',    p.question_type,
      'stem_html',        p.stem_html,
      'choices',          p.choices,
      'answer',           p.answer,
      'score',            p.score,
      'explanation_html', p.explanation_html,
      'area_path',        to_jsonb(p.area_path),
      'work_title',       p.work_title,
      'render_mode',      p.render_mode,
      'image_path',       p.image_path,
      'figure_paths',     to_jsonb(p.figure_paths),
      'passage', CASE WHEN ps.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id',          ps.id,
        'label',       ps.label,
        'title',       ps.title,
        'author',      ps.author,
        'html',        ps.html,
        'render_mode', ps.render_mode,
        'image_path',  ps.image_path
      ) END,
      'source', jsonb_build_object(
        'source_type', s.source_type,
        'title',       s.title,
        'school_name', s.school_name,
        'year',        s.year,
        'grade',       s.grade,
        'exam_type',   s.exam_type,
        'publisher',   s.publisher
      )
    )
    FROM unnest(p_problem_ids) WITH ORDINALITY AS t(pid, ord)
    JOIN exam.problems p              ON p.id = t.pid
    JOIN exam.problem_sources s       ON s.id = p.source_id
    LEFT JOIN exam.passages ps        ON ps.id = p.passage_id;

  RETURN v_paper_id;
END;
$$;

REVOKE ALL ON FUNCTION exam.create_problem_paper(TEXT, UUID[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exam.create_problem_paper(TEXT, UUID[], JSONB) TO authenticated, service_role;

-- ---------------------------------------------
-- 10. Storage 버킷 — 원본 PDF · 페이지 이미지 · 문항 영역 이미지
-- ---------------------------------------------
-- Storage 는 프로젝트 전역이라(스키마 옵션과 무관) ara-system 버킷과 이름이 겹치면 안 된다.
-- 경로 규약: sources/{source_id}/original.pdf, sources/{source_id}/pages/{n}.jpg,
--           problems/{problem_id}/region.jpg, passages/{passage_id}/region.jpg
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exam-problem-bank', 'exam-problem-bank', false, 50 * 1024 * 1024,
        ARRAY['application/pdf', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 비공개 버킷이라 읽기도 정책이 필요하다(앱은 createSignedUrl 로 연다).
-- UPDATE 정책은 **일부러 만들지 않는다** — 클라이언트가 upsert:true 로 올리면
-- storage-api 가 UPDATE 권한까지 요구해 전량 실패한다(ara-system mig334 사고).
-- 업로드는 항상 upsert:false + 새 UUID 경로.
DROP POLICY IF EXISTS "exam_problem_bank_select" ON storage.objects;
CREATE POLICY "exam_problem_bank_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exam-problem-bank' AND exam.is_allowed_domain());

DROP POLICY IF EXISTS "exam_problem_bank_insert" ON storage.objects;
CREATE POLICY "exam_problem_bank_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exam-problem-bank' AND exam.is_allowed_domain());

DROP POLICY IF EXISTS "exam_problem_bank_delete" ON storage.objects;
CREATE POLICY "exam_problem_bank_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'exam-problem-bank' AND exam.is_allowed_domain());

-- ---------------------------------------------
-- 11. PostgREST 스키마 캐시 리로드
-- ---------------------------------------------
-- 이걸 빠뜨리면 배포 직후 새 표·RPC 호출이 전부 PGRST205/PGRST202 로 실패한다.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인용 (실행 후 눈으로)
-- ---------------------------------------------
-- 1) 표 5개가 exam 스키마에 있는지
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'exam' AND table_name LIKE 'problem%' OR table_name = 'passages';
--
-- 2) 정책이 전부 도메인 조건을 갖는지 (7행이어야 한다)
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'exam'
--    AND tablename IN ('problem_sources','passages','problems','problem_papers','problem_paper_items')
--  ORDER BY tablename, policyname;
--
-- 3) RPC 가 public 이 아니라 exam 에 생성됐는지 (반드시 exam 한 줄만)
-- SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE p.proname IN ('create_problem_paper', 'audit_problem_bank', 'problems_search_text');
--
-- 4) 버킷·정책
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'exam-problem-bank';
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname = 'storage' AND policyname LIKE 'exam_problem_bank%';
