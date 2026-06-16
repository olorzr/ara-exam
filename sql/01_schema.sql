-- =============================================
-- Voca Master - Supabase 테이블 스키마
-- =============================================

-- 1. 카테고리 테이블 (중등/고등 > 학년 > 출판사 > 학기 > 대단원 > 소단원)
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('중등', '고등', '외부지문 및 프린트')),
  grade TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  semester TEXT NOT NULL DEFAULT '',
  chapter TEXT NOT NULL DEFAULT '',
  sub_chapter TEXT NOT NULL DEFAULT '',
  school_name TEXT DEFAULT '',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 단어 테이블
CREATE TABLE words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 시험지 테이블
CREATE TABLE exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  pass_percentage INT NOT NULL DEFAULT 80,
  total_questions INT NOT NULL DEFAULT 0,
  pass_count INT NOT NULL DEFAULT 0,
  category_ids UUID[] DEFAULT '{}',
  word_ids UUID[] DEFAULT '{}',
  parent_exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  retake_number INT DEFAULT 0,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 시험지 단어 테이블 (시험지에 포함된 단어 스냅샷)
CREATE TABLE exam_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  word_id UUID NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  order_index INT DEFAULT 0
);

-- 5. 출판사 마스터 (모든 사용자 공유)
CREATE TABLE publishers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('중등', '고등')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, level)
);

-- 6. 대단원 마스터 (출판사 + 학년 + 학기별)
CREATE TABLE major_chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  semester TEXT NOT NULL DEFAULT '1학기',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, publisher_id, grade, semester)
);

-- 7. 소단원 마스터 (대단원별)
CREATE TABLE sub_chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  major_chapter_id UUID NOT NULL REFERENCES major_chapters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, major_chapter_id)
);

-- 8. 학교 마스터 (외부지문용)
CREATE TABLE schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 프린트/작품명 마스터 (학교별)
CREATE TABLE school_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, school_id)
);

-- 인덱스
CREATE INDEX idx_words_category ON words(category_id);
CREATE INDEX idx_exam_words_exam ON exam_words(exam_id);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_exams_user ON exams(user_id);
CREATE INDEX idx_exams_parent ON exams(parent_exam_id);
-- 재시험 차수 경쟁 상태 방어선: 같은 부모에 동일 차수 두 행이 만들어지지 못하게 부분 유일 인덱스
CREATE UNIQUE INDEX idx_exams_parent_retake_unique
  ON exams (parent_exam_id, retake_number)
  WHERE parent_exam_id IS NOT NULL;
CREATE INDEX idx_publishers_level ON publishers(level);
CREATE INDEX idx_major_chapters_publisher ON major_chapters(publisher_id);
CREATE INDEX idx_major_chapters_grade ON major_chapters(grade);
CREATE INDEX idx_sub_chapters_major ON sub_chapters(major_chapter_id);
CREATE INDEX idx_school_materials_school ON school_materials(school_id);

-- 카테고리 자연키 유니크: 동시 저장 시 같은 단원이 중복 생성되는 것을 막는다.
-- ensureCategoryId 의 upsert(onConflict) 가 이 인덱스에 의존한다.
-- (기존 DB 의 중복 병합은 sql/09_migration_categories_unique.sql 참조)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_natural_key
  ON categories (level, grade, publisher, semester, chapter, sub_chapter, school_name)
  NULLS NOT DISTINCT;

-- 허용 도메인 판정 헬퍼. 모든 공유 테이블 정책의 USING/WITH CHECK 에서 호출해
-- @araeducation.co.kr 이메일 세션만 데이터에 접근하도록 강제한다(세션이 localStorage
-- 라 서버 미들웨어로는 막을 수 없어 RLS 계층에서 강제). auth.jwt() 는 요청 JWT 를
-- 읽으며 SECURITY context 와 무관하다. 자세한 내용은 sql/08_migration_domain_restriction.sql.
CREATE OR REPLACE FUNCTION public.is_allowed_domain()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') LIKE '%@araeducation.co.kr';
$$;
GRANT EXECUTE ON FUNCTION public.is_allowed_domain() TO authenticated;

-- RLS (Row Level Security) 정책
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_words ENABLE ROW LEVEL SECURITY;

-- 카테고리: 모든 인증된 사용자 접근 가능 (학원 공유)
CREATE POLICY "Authenticated users can manage categories"
  ON categories FOR ALL
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND public.is_allowed_domain());

-- 단어: 모든 인증된 사용자 접근 가능 (학원 공유)
CREATE POLICY "Authenticated users can manage words"
  ON words FOR ALL
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND public.is_allowed_domain());

-- 시험지: 모든 인증된 사용자 공유 (감사 로그로 변경 이력 추적)
CREATE POLICY "Authenticated users can manage exams"
  ON exams FOR ALL
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND public.is_allowed_domain());

-- 시험지 단어: 읽기만 공유. 쓰기는 SECURITY DEFINER 함수 create_exam_with_words
-- 를 통해서만 가능하다(직접 INSERT/UPDATE/DELETE 차단). 자세한 내용은
-- sql/10_migration_lock_exam_words.sql 참고.
CREATE POLICY "Authenticated users can read exam_words"
  ON exam_words FOR SELECT
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain());

-- 마스터 테이블: 모든 인증된 사용자 접근 가능 (공유 데이터)
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE major_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage publishers"
  ON publishers FOR ALL
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND public.is_allowed_domain());

CREATE POLICY "Authenticated users can manage major_chapters"
  ON major_chapters FOR ALL
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND public.is_allowed_domain());

CREATE POLICY "Authenticated users can manage sub_chapters"
  ON sub_chapters FOR ALL
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND public.is_allowed_domain());

CREATE POLICY "Authenticated users can manage schools"
  ON schools FOR ALL
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND public.is_allowed_domain());

CREATE POLICY "Authenticated users can manage school_materials"
  ON school_materials FOR ALL
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain())
  WITH CHECK (auth.role() = 'authenticated' AND public.is_allowed_domain());

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER words_updated_at
  BEFORE UPDATE ON words
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 마스터 테이블 이름 변경 시 categories 자동 동기화 트리거
-- =============================================

-- 출판사명 변경 → categories.publisher + concept_sheets.publisher 동기화
-- (concept_sheets 동기화 근거: sql/07_migration_sync_concept_sheets.sql)
CREATE OR REPLACE FUNCTION sync_publisher_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET publisher = NEW.name
    WHERE publisher = OLD.name AND level = OLD.level;

    UPDATE concept_sheets
    SET publisher = NEW.name
    WHERE publisher = OLD.name AND level = OLD.level;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_publisher_name_trigger
  AFTER UPDATE ON publishers
  FOR EACH ROW
  EXECUTE FUNCTION sync_publisher_name();

-- 대단원명 변경 → categories.chapter + concept_sheets.unit 동기화
-- (concept_sheets 동기화 근거: sql/07_migration_sync_concept_sheets.sql)
CREATE OR REPLACE FUNCTION sync_major_chapter_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET chapter = NEW.name
    FROM publishers p
    WHERE categories.chapter = OLD.name
      AND categories.publisher = p.name
      AND categories.level = p.level
      AND categories.grade = OLD.grade
      AND categories.semester = OLD.semester
      AND p.id = OLD.publisher_id;

    UPDATE concept_sheets
    SET unit = NEW.name
    FROM publishers p
    WHERE concept_sheets.unit = OLD.name
      AND concept_sheets.publisher = p.name
      AND concept_sheets.level = p.level
      AND concept_sheets.grade = OLD.grade
      AND concept_sheets.semester = OLD.semester
      AND p.id = OLD.publisher_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_major_chapter_name_trigger
  AFTER UPDATE ON major_chapters
  FOR EACH ROW
  EXECUTE FUNCTION sync_major_chapter_name();

-- 소단원명 변경 → categories.sub_chapter + concept_sheets.subunit 동기화
-- (concept_sheets 동기화 근거: sql/07_migration_sync_concept_sheets.sql)
CREATE OR REPLACE FUNCTION sync_sub_chapter_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET sub_chapter = NEW.name
    FROM major_chapters mc
    JOIN publishers p ON p.id = mc.publisher_id
    WHERE categories.sub_chapter = OLD.name
      AND categories.chapter = mc.name
      AND categories.publisher = p.name
      AND categories.level = p.level
      AND categories.grade = mc.grade
      AND categories.semester = mc.semester
      AND mc.id = OLD.major_chapter_id;

    UPDATE concept_sheets
    SET subunit = NEW.name
    FROM major_chapters mc
    JOIN publishers p ON p.id = mc.publisher_id
    WHERE concept_sheets.subunit = OLD.name
      AND concept_sheets.unit = mc.name
      AND concept_sheets.publisher = p.name
      AND concept_sheets.level = p.level
      AND concept_sheets.grade = mc.grade
      AND concept_sheets.semester = mc.semester
      AND mc.id = OLD.major_chapter_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_sub_chapter_name_trigger
  AFTER UPDATE ON sub_chapters
  FOR EACH ROW
  EXECUTE FUNCTION sync_sub_chapter_name();

-- 학교명 변경 → categories.school_name 동기화
CREATE OR REPLACE FUNCTION sync_school_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET school_name = NEW.name
    WHERE school_name = OLD.name
      AND level = '외부지문 및 프린트';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_school_name_trigger
  AFTER UPDATE ON schools
  FOR EACH ROW
  EXECUTE FUNCTION sync_school_name();

-- 프린트/작품명 변경 → categories.chapter 동기화 (외부지문)
CREATE OR REPLACE FUNCTION sync_school_material_name()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    UPDATE categories
    SET chapter = NEW.name
    FROM schools s
    WHERE categories.chapter = OLD.name
      AND categories.school_name = s.name
      AND categories.level = '외부지문 및 프린트'
      AND s.id = OLD.school_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_school_material_name_trigger
  AFTER UPDATE ON school_materials
  FOR EACH ROW
  EXECUTE FUNCTION sync_school_material_name();

-- =============================================
-- 시험지/재시험 생성 RPC (원자성 + 차수 경쟁 상태 방어)
-- =============================================
-- 클라이언트가 exams insert → exam_words insert 를 별도 호출하면 두 번째 insert 실패 시
-- 단어 없는 유령 시험지가 남는다. 함수 본문은 단일 트랜잭션이므로 어느 insert가 실패해도 전체 롤백된다.
--
-- 재시험(p_parent_exam_id IS NOT NULL) 호출의 경우 차수 계산을 클라이언트에 맡기면
-- 동시에 두 사용자가 같은 (parent, retake_number) 행을 만들 수 있어, 차수와 제목 접미사 모두
-- 서버에서 결정한다. pg_advisory_xact_lock 으로 동일 부모 동시 호출을 직렬화하고,
-- (parent_exam_id, retake_number) 부분 유일 인덱스가 마지막 안전망으로 동작한다.
--
-- user_id 는 sql/13_migration_enforce_user_id.sql 의 BEFORE INSERT 트리거가
-- auth.uid() 로 채운다. 본 RPC 는 user_id 컬럼을 명시하지 않는다.
--
-- 이 함수는 SECURITY DEFINER 다. exam_words 직접 쓰기를 RLS 로 차단했기 때문에
-- (sql/10_migration_lock_exam_words.sql), 정상 생성 경로인 이 함수만 잠긴 RLS 를
-- 우회해 exam_words 에 INSERT 할 수 있다. auth.uid() 는 SECURITY context 와 무관하게
-- 요청 JWT 클레임을 읽으므로 DEFINER 에서도 호출자 attribution 이 그대로 유지된다.
-- total_questions / pass_count / word_ids 는 서버가 재계산하고, 신규 생성 경로는
-- word·meaning 을 canonical words 에서 재조립해 내용 위조를 차단한다.
-- (정식 정의는 sql/10_migration_lock_exam_words.sql 와 동일하게 유지할 것)
CREATE OR REPLACE FUNCTION create_exam_with_words(
  p_title TEXT,
  p_pass_percentage INT,
  p_total_questions INT,   -- 무시: 서버가 p_words 길이로 재계산
  p_pass_count INT,        -- 무시: 서버가 pass_percentage 로 재계산
  p_category_ids UUID[],
  p_word_ids UUID[],       -- 무시: 서버가 p_words 에서 재구성
  p_words JSONB,
  p_parent_exam_id UUID DEFAULT NULL,
  p_retake_number INT DEFAULT 0  -- 무시: 재시험 차수는 서버가 결정
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exam_id      UUID;
  v_retake       INT  := 0;
  v_title        TEXT := p_title;
  v_total        INT;
  v_pass         INT;
  v_pass_pct     INT;
  v_category_ids UUID[];
  v_word_ids     UUID[];
  v_is_retake    BOOLEAN := p_parent_exam_id IS NOT NULL;
BEGIN
  -- 도메인 제한: SECURITY DEFINER 라 테이블 RLS(is_allowed_domain)를 우회하므로
  -- 본문에서 직접 강제해 비허용 도메인 세션의 RPC 직접 호출을 막는다.
  IF NOT public.is_allowed_domain() THEN
    RAISE EXCEPTION 'caller is not in an allowed email domain'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_is_retake THEN
    -- 재시험: 모든 내용을 부모 exam 에서 서버가 읽어 재조립한다(클라이언트 입력 무시).
    -- 직접 RPC 호출로 부모와 다른 내용의 가짜 "재시험 N차" 를 만드는 것을 차단한다.
    SELECT pass_percentage, category_ids
      INTO v_pass_pct, v_category_ids
      FROM exams
     WHERE id = p_parent_exam_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent exam % not found', p_parent_exam_id
        USING ERRCODE = 'no_data_found';
    END IF;

    SELECT COUNT(*) INTO v_total FROM exam_words WHERE exam_id = p_parent_exam_id;
    IF v_total < 5 THEN
      RAISE EXCEPTION 'parent exam requires at least 5 words (got %)', v_total
        USING ERRCODE = 'check_violation';
    END IF;
    v_pass := CEIL(v_pass_pct::numeric / 100 * v_total);
    -- 부모 단어를 한 번 셔플해 순서를 고정한다. exams.word_ids 와 exam_words.order_index
    -- 양쪽에 동일하게 써서 메타와 실제 출제 순서를 일치시킨다.
    v_word_ids := ARRAY(
      SELECT word_id FROM exam_words WHERE exam_id = p_parent_exam_id ORDER BY random()
    );

    PERFORM pg_advisory_xact_lock(hashtext(p_parent_exam_id::text));
    SELECT COALESCE(MAX(retake_number), 0) + 1
      INTO v_retake
      FROM exams
     WHERE parent_exam_id = p_parent_exam_id;
    v_title := format('%s (재시험 %s차)', p_title, v_retake);

    INSERT INTO exams (
      title, pass_percentage, total_questions, pass_count,
      category_ids, word_ids, parent_exam_id, retake_number
    )
    VALUES (
      v_title, v_pass_pct, v_total, v_pass,
      v_category_ids, v_word_ids, p_parent_exam_id, v_retake
    )
    RETURNING id INTO v_exam_id;

    -- 부모 exam_words 스냅샷(삭제된 단어 포함)을 위에서 고정한 v_word_ids 순서로
    -- 복사한다(order_index = ordinality-1). exams.word_ids 와 순서가 일치한다.
    INSERT INTO exam_words (exam_id, word_id, word, meaning, order_index)
    SELECT
      v_exam_id, ew.word_id, ew.word, ew.meaning, (u.ord - 1)
    FROM unnest(v_word_ids) WITH ORDINALITY AS u(wid, ord)
    JOIN exam_words ew
      ON ew.exam_id = p_parent_exam_id AND ew.word_id = u.wid;
  ELSE
    -- 신규 생성: 메타데이터는 서버 재계산, word·meaning 은 canonical words 재조립.
    IF p_pass_percentage IS NULL OR p_pass_percentage < 0 OR p_pass_percentage > 100 THEN
      RAISE EXCEPTION 'pass_percentage must be between 0 and 100 (got %)', p_pass_percentage
        USING ERRCODE = 'check_violation';
    END IF;

    -- 객관식 5지선다(정답 1 + 오답 4) 보장용. 클라이언트 우회 방어선.
    IF p_words IS NULL OR jsonb_array_length(p_words) < 5 THEN
      RAISE EXCEPTION 'exam requires at least 5 words (got %)', COALESCE(jsonb_array_length(p_words), 0)
        USING ERRCODE = 'check_violation';
    END IF;

    v_total := jsonb_array_length(p_words);
    v_pass  := CEIL(p_pass_percentage::numeric / 100 * v_total);
    v_word_ids := ARRAY(
      SELECT (elem->>'word_id')::UUID
      FROM jsonb_array_elements(p_words) AS elem
      ORDER BY (elem->>'order_index')::INT
    );

    IF EXISTS (
      SELECT 1
      FROM unnest(v_word_ids) AS wid
      WHERE NOT EXISTS (SELECT 1 FROM words w WHERE w.id = wid)
    ) THEN
      RAISE EXCEPTION 'p_words contains word_id not present in words table'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- category_ids 는 클라이언트 입력(p_category_ids)을 신뢰하지 않고, 실제 포함된
    -- 단어들의 canonical words.category_id 집합으로 서버가 재계산한다(words.category_id
    -- 는 NOT NULL). 직접 RPC 호출로 시험 내용과 무관한 출처/필터 라벨을 위조하는 것을 차단한다.
    v_category_ids := ARRAY(
      SELECT DISTINCT w.category_id
      FROM unnest(v_word_ids) AS wid
      JOIN words w ON w.id = wid
    );

    INSERT INTO exams (
      title, pass_percentage, total_questions, pass_count,
      category_ids, word_ids, parent_exam_id, retake_number
    )
    VALUES (
      p_title, p_pass_percentage, v_total, v_pass,
      v_category_ids, v_word_ids, NULL, 0
    )
    RETURNING id INTO v_exam_id;

    INSERT INTO exam_words (exam_id, word_id, word, meaning, order_index)
    SELECT
      v_exam_id, w.id, w.word, w.meaning, (elem->>'order_index')::INT
    FROM jsonb_array_elements(p_words) AS elem
    JOIN words w ON w.id = (elem->>'word_id')::UUID;
  END IF;

  RETURN v_exam_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_exam_with_words(
  TEXT, INT, INT, INT, UUID[], UUID[], JSONB, UUID, INT
) TO authenticated;
