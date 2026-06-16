-- =============================================
-- exam_words 직접 쓰기 차단 + create_exam_with_words 서버 검증 강화
-- 실행: Supabase SQL Editor 에서 실행
-- =============================================
-- 배경(Critical):
--   exam_words 는 그동안 'authenticated' 전원에게 FOR ALL(INSERT/UPDATE/DELETE)
--   이 열려 있었다. 학원 공유 모델이라 RLS 가 소유자를 따지지 않으므로, 임의의
--   인증 사용자가 콘솔에서
--     supabase.from('exam_words').update({ word: 'HACKED' }).eq('exam_id', victim)
--   처럼 남의 시험지 단어를 조용히 변조/삭제할 수 있었고, exam_words 에는 감사
--   트리거도 없어 흔적이 남지 않았다.
--
-- 방어:
--   1) exam_words 직접 쓰기를 막고 SELECT 만 허용한다.
--   2) 정상 생성 경로인 create_exam_with_words 를 SECURITY DEFINER 로 바꿔,
--      잠긴 RLS 를 우회해 exam_words 에 INSERT 할 수 있게 한다(유일한 쓰기 경로).
--   3) exam_words 는 exams 의 자식 스냅샷이므로 감사는 exams 단위(이미 존재하는
--      audit_exam_* 트리거)로 충분하다. 삭제는 exams ON DELETE CASCADE 로만
--      일어나고 그 exam 삭제가 audit_exam_delete 에 남는다. 따라서 exam_words 에
--      별도 행 단위 감사 트리거는 두지 않는다(시험당 N행 노이즈만 늘 뿐 새로운
--      포렌식 가치가 없음).
--
-- 배경(High #3):
--   기존 RPC 는 p_total_questions / p_pass_count / p_word_ids / p_words 의 word·
--   meaning 을 전부 클라이언트 신뢰로 저장했다. RPC 를 직접 호출하면 메타데이터와
--   실제 단어 내용이 어긋난(예: total_questions=100, 실제 5단어) 시험지나, 존재
--   하지 않는 word_id 를 가진 시험지를 만들 수 있었다.
-- 방어:
--   - 신규 생성(p_parent_exam_id IS NULL): total_questions / word_ids / pass_count
--     를 서버에서 p_words·pass_percentage 로 재계산하고, word·meaning 은 canonical
--     words 에서 재조립 + 모든 word_id 실재를 강제한다 → 내용 위조 차단.
--   - 재시험(p_parent_exam_id IS NOT NULL): 클라이언트 입력(p_words/p_category_ids
--     /메타)을 전혀 신뢰하지 않고, 부모 exam 과 부모 exam_words 를 서버가 직접 읽어
--     재조립한다(서버 셔플 순서). 직접 RPC 호출로 부모와 다른 내용의 가짜 "재시험
--     N차" 를 만드는 것을 차단한다. 부모 스냅샷을 복사하므로 이미 삭제된 단어도
--     보존된다(CLAUDE.md: exam_words 는 스냅샷이라 원본 수정/삭제가 영향 없음).
--   - SECURITY DEFINER 라 테이블 RLS(is_allowed_domain)를 우회하므로, 함수 본문
--     첫머리에서 public.is_allowed_domain() 을 직접 검사해 도메인 우회를 막는다.
--
-- 주의: 이 파일이 create_exam_with_words 의 정식(canonical) 정의다.
--   archive/migration_enforce_user_id.sql / archive/migration_retake_atomic.sql / archive/migration_exam_rpc.sql
--   의 옛 정의는 모두 무력화(포인터 주석)했다. archive/migration_retake_atomic.sql 이후 이
--   파일을 마지막에 실행할 것.
--
-- 운영 전제(중요): 이 함수가 잠긴 exam_words RLS 를 우회해 INSERT 하려면 함수
--   owner 가 테이블 owner(또는 BYPASSRLS) 여야 한다. Supabase SQL Editor 에서는
--   기본적으로 postgres 로 실행되어 테이블 owner 와 동일하므로 충족된다. 다른
--   역할로 이 파일을 실행하면 시험 생성이 깨질 수 있으니 postgres 로 적용할 것.

-- ---------------------------------------------
-- 1) exam_words 직접 쓰기 차단 → SELECT 전용
-- ---------------------------------------------
DROP POLICY IF EXISTS "Users can manage own exam words" ON exam_words;
DROP POLICY IF EXISTS "Authenticated users can manage exam_words" ON exam_words;
DROP POLICY IF EXISTS "Authenticated users can read exam_words" ON exam_words;

-- 도메인 조건(public.is_allowed_domain())을 반드시 포함한다. 이 파일은 적용
-- 순서상 마지막(나머지 → retake_atomic → domain_restriction → categories_unique
-- → lock_exam_words)이므로, 여기서 도메인 조건을 빠뜨리면 앞서
-- 08_migration_domain_restriction.sql 이 입힌 도메인 제한을 덮어써 제거하게 된다.
CREATE POLICY "Authenticated users can read exam_words"
  ON exam_words FOR SELECT
  USING (auth.role() = 'authenticated' AND public.is_allowed_domain());
-- INSERT/UPDATE/DELETE 정책을 의도적으로 만들지 않는다(기본 deny).
-- 쓰기는 오직 SECURITY DEFINER 함수 create_exam_with_words 를 통해서만 가능하다.

-- ---------------------------------------------
-- 2) create_exam_with_words: SECURITY DEFINER + 서버 검증
-- ---------------------------------------------
-- 옛 시그니처(p_user_id 포함)와 현재 시그니처 모두 제거 후 재생성.
DROP FUNCTION IF EXISTS create_exam_with_words(
  TEXT, INT, INT, INT, UUID[], UUID[], UUID, JSONB, UUID, INT
);
DROP FUNCTION IF EXISTS create_exam_with_words(
  TEXT, INT, INT, INT, UUID[], UUID[], JSONB, UUID, INT
);

CREATE FUNCTION create_exam_with_words(
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
  -- 도메인 제한 ----------------------------------------------
  -- 이 함수는 SECURITY DEFINER 라 테이블 RLS(public.is_allowed_domain())를 우회한다.
  -- 따라서 본문에서 직접 도메인을 강제해야, 비허용 도메인 세션이 RPC 를 직접 호출해
  -- 시험을 생성하는 우회 경로를 막을 수 있다.
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
    -- 부모 단어를 한 번 셔플해 순서를 고정한다. 이 순서를 exams.word_ids 와
    -- exam_words.order_index 양쪽에 동일하게 써서 메타와 실제 출제 순서를 일치시킨다.
    v_word_ids := ARRAY(
      SELECT word_id FROM exam_words WHERE exam_id = p_parent_exam_id ORDER BY random()
    );

    -- 같은 부모에 대한 동시 재시험 생성을 직렬화하고 차수를 서버가 계산한다.
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
    -- 신규 생성: 클라이언트 메타데이터는 서버가 재계산하고, word·meaning 은
    -- canonical words 에서 재조립해 내용 위조를 차단한다.
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

    -- 모든 word_id 가 canonical words 에 실재해야 한다.
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

    -- user_id 는 aa_enforce_user_id_exams_insert 트리거(sql/13_migration_enforce_user_id.sql)가
    -- auth.uid() 로 채움
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
