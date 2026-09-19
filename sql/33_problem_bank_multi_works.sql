-- =============================================
-- 33. 기출 문제 은행 — 지문 하나에 작품 여러 편
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/33_problem_bank_multi_works.sql
-- =============================================
-- 배경:
--   시험지에는 `(가) 진달래꽃 – 김소월 / (나) 엄마 걱정 – 기형도` 처럼 **한 지문에 작품이
--   둘 이상** 실리는 일이 흔하다. 지금 스키마는 지문 하나 = 작품 하나라, OCR 프롬프트가
--   `'먼 후일 · 독은 아름답다'` 처럼 **한 칸에 이어 적게** 하고 있었다(sql/20 주석 참조).
--   그 결과 작품 트리에 그 이름의 **가짜 작품 하나**가 생기고, '먼 후일' 만 골라서는
--   그 문항이 나오지 않는다(아카이브가 `work_title` 완전 일치로 찾는다).
--   2026-09-19 운영 데이터: 지문 486건 중 19건, 문항 2,491건 중 58건이 그 모양이다.
--
-- 이 마이그레이션이 하는 일 — **원본을 옮기고 옛 컬럼은 파생으로 남긴다**:
--   · `passages.works`  JSONB  `[{label,title,author}]`  ← 원본
--     `passages.title`/`author` 는 트리거가 `' · '` 로 이어 만드는 **파생 컬럼**이 된다.
--   · `problems.work_titles` TEXT[]                      ← 원본
--     `problems.work_title` 은 같은 규칙의 **파생 컬럼**이 된다.
--   옛 컬럼을 지우지 않는 이유: 인쇄 스냅샷(sql/23)·검색 평문(sql/17)·지문 고르기·
--   참고자료 매칭 등 **문자열을 읽는 곳이 스무 군데**다. 파생으로 남기면 그 전부가 그대로 돈다.
--   `search_text`(sql/17)·`char_count`(sql/30)와 같은 계약이다 — **앱은 파생 컬럼을 보내지 않는다.**
--
-- ⚠️ 빈 값의 뜻: 문항의 `work_titles = '{}'` 은 **'이 지문 전체'** 라는 뜻이고, 트리거가
--    그 자리에서 지문의 작품 목록으로 채운다. 그래서 저장된 값은 늘 명시적이다.
--    문항에 **좁혀 적은** 목록(`{엄마 걱정}`)은 지문 쪽이 바뀌어도 보존된다(sql/20 의 규약 그대로).
--
-- ⚠️ 트리거가 표마다 **두 벌**이다(`aa_works_a_*` → `aa_works_b_*`). 한 벌로는 안 된다:
--    화면이 배열과 옛 파생 문자열을 **한 UPDATE 에 같이** 보내면(구 앱·폼 전체 저장)
--    "문자열이 바뀌었으니 배열을 다시 만든다" 가 **방금 추가한 작품을 지운다**.
--    `UPDATE OF <컬럼>` 은 그 컬럼이 SET 목록에 있으면 발화하므로(값이 바뀌었는지와 무관),
--    '배열이 실려 왔는가' 를 그것으로 가른다. 그리고 BEFORE 트리거의 WHEN 은 앞 트리거가
--    고친 NEW 를 보므로, `_a` 가 파생 문자열을 다시 만들어 두면 `_b` 는 조용히 지나간다.
--
-- ⚠️ 지문 → 문항 전파 트리거는 `AFTER UPDATE`(컬럼 목록 **없이**) + `WHEN` 이다.
--    `AFTER UPDATE OF works` 로 두면 **문자열 경로**(`SET title = …`)로 들어온 변경에서
--    `_b` 가 `works` 를 다시 만들어도 발화하지 않는다 — `UPDATE OF` 는 SET 목록만 본다.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--    반대로 하면 앱이 보내는 `works`/`work_titles` 가 PGRST204(컬럼 없음)로 튕겨
--    검수 저장이 통째로 막힌다.
--
-- ⚠️ 이 앱의 표는 ara-system 과 공유하는 Supabase 프로젝트의 **exam 스키마**에 있다.
--    모든 DDL 에 `exam.` 을 명시한다(SQL Editor 는 문마다 다른 백엔드로 갈 수 있다).
--
-- 알려진 한계(문자열 경로에서만):
--   지은이를 파생 문자열로 접으면 **중복이 접힌다**(작품 둘이 같은 작가면 '김유정' 하나).
--   그래서 `works_from_strings` 는 **옛 works 에서 제목으로 지은이를 먼저 찾고**, 없을 때만
--   자리대로 짝짓는다. 지은이가 하나뿐인데 작품이 여럿이면 모두에게 그 지은이를 준다
--   (운영 데이터의 `봄봄 · 동백꽃 / 김유정` 이 그 꼴이다).

-- ---------------------------------------------
-- 실행 대상 확인 (가장 먼저)
-- ---------------------------------------------
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). SQL Editor/DATABASE_URL 이 다른 Supabase '
      '프로젝트에 연결돼 있을 가능성이 높습니다.', current_database();
  END IF;

  IF to_regclass('exam.passages') IS NULL OR to_regclass('exam.problems') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;

  IF to_regprocedure('exam.normalize_work_title(text)') IS NULL THEN
    RAISE EXCEPTION
      'exam.normalize_work_title 이 없습니다 (현재 DB: %). sql/20 을 먼저 적용하세요.',
      current_database();
  END IF;

  -- sql/24 의 그림까지 옮기는 merge_passages 를 이 파일이 다시 정의한다.
  -- 그림 컬럼이 없으면 sql/23·24 가 아직인 것이고, 그대로 두면 그림이 사라진다.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'exam.passages'::regclass AND attname = 'figure_paths' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'exam.passages.figure_paths 가 없습니다 (현재 DB: %). sql/23·24 를 먼저 적용하세요.',
      current_database();
  END IF;

  -- 파생 문자열이 검색 평문에 들어가려면 우리 트리거가 이것보다 **먼저** 돌아야 한다
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'exam.problems'::regclass AND tgname = 'problems_search_text'
  ) THEN
    RAISE EXCEPTION 'exam.problems 의 problems_search_text 트리거가 없습니다 (현재 DB: %).',
      current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 컬럼
-- ---------------------------------------------
-- NOT NULL DEFAULT 는 PG 11+ 에서 메타데이터만 바꾼다(표를 다시 쓰지 않는다).
ALTER TABLE exam.passages ADD COLUMN IF NOT EXISTS works JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE exam.problems ADD COLUMN IF NOT EXISTS work_titles TEXT[] NOT NULL DEFAULT '{}';

-- 상한 6: 시험지 한 지문에 (가)~(마) 다섯 편이 최대치다. CHECK 는 BEFORE 트리거 **뒤에**
-- 검사하므로 정규화를 통과한 값만 본다 — 실제로 걸리는 것은 직접 SQL 뿐이다.
DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'exam.passages'::regclass AND conname = 'passages_works_shape') THEN
    ALTER TABLE exam.passages ADD CONSTRAINT passages_works_shape
      CHECK (jsonb_typeof(works) = 'array' AND jsonb_array_length(works) <= 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'exam.problems'::regclass AND conname = 'problems_work_titles_max') THEN
    ALTER TABLE exam.problems ADD CONSTRAINT problems_work_titles_max
      CHECK (cardinality(work_titles) <= 6);
  END IF;
END
$checks$;

-- 아카이브가 '이 작품이 든 문항' 을 `@>` 로 찾는다(`grammar_paths` 와 같은 규약).
CREATE INDEX IF NOT EXISTS idx_problems_work_titles ON exam.problems USING GIN (work_titles);
-- ⚠️ idx_problems_work_title(단수)은 **남긴다** — 파생 문자열로 거는 조회가 아직 있다.

-- ---------------------------------------------
-- 2. 값 다루는 함수들
-- ---------------------------------------------
-- 이음 기호는 `' · '`(가운뎃점 + 양쪽 공백) **하나**로 못박는다. 나눌 때는 가운뎃점 세 종류를
-- 다 받는다 — OCR 이 U+00B7·U+2022·U+30FB 를 섞어 낸다.
-- ⚠️ `split(join(x)) = x` 가 성립해야 파생↔원본이 서로를 덮지 않는다. 그래서 정규화는
--    **제목 안에 남은 이음 기호까지 쪼갠다**.

-- ⚠️ **sql/20 의 `normalize_work_title` 을 여기서 다시 정의한다.** 그 판은 양끝 공백을
--    `\s` 로 잡는데 Postgres 의 `\s` 는 **ASCII 공백만** 잡는다 — 앱의 JS `\s` 는 NBSP·전각
--    공백·BOM 까지 잡으므로, NBSP 가 앞에 붙은 `「동백꽃」` 에서 앱은 `동백꽃` 을, DB 는
--    `「동백꽃」` 을 만들어 **같은 작품이 두 갈래로 쌓였다**(sql/16 이 같은 이유로 공백류를
--    직접 나열한다). 문자 집합은 JS 의 `\s` 와 **글자 하나까지 같아야 한다**.
CREATE OR REPLACE FUNCTION exam.normalize_work_title(p_name TEXT)
RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE
  SET search_path = exam, pg_temp
AS $$
  SELECT exam.normalize_category_name(
    regexp_replace(
      regexp_replace(COALESCE(p_name, ''),
        '^[「」『』〈〉《》＜＞<>“”‘’"''\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+', ''),
      '[「」『』〈〉《》＜＞<>“”‘’"''\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$', ''
    )
  );
$$;

COMMENT ON FUNCTION exam.normalize_work_title(TEXT) IS
  '작품명·지은이 표기 정규화. 앱의 src/lib/problem-bank/work-title.ts 와 1:1 로 같은 규칙이어야 한다(공백류는 sql/16 과 같은 집합)';

/** 작품 구분 표시('가','나') 다듬기 — 괄호·공백을 벗기고 4자로 자른다 */
CREATE OR REPLACE FUNCTION exam.normalize_work_label(p_label TEXT)
RETURNS TEXT
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  -- 공백류는 위 `normalize_work_title` 과 같은 집합이다(Postgres 의 `\s` 는 ASCII 만 잡는다)
  SELECT left(btrim(regexp_replace(
    COALESCE(p_label, ''), '[()（）\[\]〈〉<>\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]', '', 'g')), 4);
$$;

/** 이어 적은 작품명 문자열 → 표준 표기 목록 (빈 값·중복 제거, 등장 순서 유지) */
CREATE OR REPLACE FUNCTION exam.split_work_titles(p_text TEXT)
RETURNS TEXT[]
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(array_agg(t ORDER BY ord), '{}'::TEXT[])
    FROM (
      SELECT DISTINCT ON (t) t, ord
        FROM (
          SELECT exam.normalize_work_title(part) AS t, ord
            -- 이음 기호 둘레의 공백도 JS 와 같은 집합으로 본다(위 주석과 같은 까닭)
            FROM regexp_split_to_table(
                   COALESCE(p_text, ''),
                   '[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*[·•・][\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*')
                 WITH ORDINALITY AS s(part, ord)
        ) x
       WHERE t <> ''
       ORDER BY t, ord
    ) d;
$$;

/** 작품명 배열 다듬기 — 원소 안의 이음 기호까지 쪼개고 중복을 없앤 뒤 6개로 자른다 */
CREATE OR REPLACE FUNCTION exam.normalize_work_titles(p_titles TEXT[])
RETURNS TEXT[]
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(
    (exam.split_work_titles(array_to_string(COALESCE(p_titles, '{}'::TEXT[]), ' · ')))[1:6],
    '{}'::TEXT[]);
$$;

/** 지문 작품 목록의 제목만 (순서대로) */
CREATE OR REPLACE FUNCTION exam.works_titles(p_works JSONB)
RETURNS TEXT[]
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(array_agg(t ORDER BY ord), '{}'::TEXT[])
    FROM (
      SELECT a.e->>'title' AS t, a.ord
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(COALESCE(p_works, '[]'::jsonb)) = 'array'
                    THEN p_works ELSE '[]'::jsonb END
             ) WITH ORDINALITY AS a(e, ord)
    ) x
   WHERE COALESCE(t, '') <> '';
$$;

/** 파생 지은이 문자열 — 같은 지은이는 한 번만 적는다(두 편이 한 작가면 '김유정' 하나) */
CREATE OR REPLACE FUNCTION exam.works_authors(p_works JSONB)
RETURNS TEXT
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(string_agg(a, ' · ' ORDER BY ord), '')
    FROM (
      SELECT DISTINCT ON (a) a, ord FROM (
        SELECT x.e->>'author' AS a, x.ord
          FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(COALESCE(p_works, '[]'::jsonb)) = 'array'
                      THEN p_works ELSE '[]'::jsonb END
               ) WITH ORDINALITY AS x(e, ord)
      ) y WHERE COALESCE(a, '') <> '' ORDER BY a, ord
    ) d;
$$;

/** 지문 작품 목록 다듬기 — 표기 정규화, 제목 없는 원소 버림, 제목 중복은 첫 것만, 6편까지 */
CREATE OR REPLACE FUNCTION exam.normalize_works(p_works JSONB)
RETURNS JSONB
  LANGUAGE plpgsql IMMUTABLE SET search_path = exam, pg_temp
AS $$
DECLARE
  v_out    JSONB   := '[]'::jsonb;
  v_seen   TEXT[]  := '{}';
  v_elem   JSONB;
  v_label  TEXT;
  v_author TEXT;
  v_title  TEXT;
BEGIN
  IF p_works IS NULL OR jsonb_typeof(p_works) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_elem IN SELECT a.e FROM jsonb_array_elements(p_works) AS a(e) LOOP
    CONTINUE WHEN jsonb_typeof(v_elem) <> 'object';
    v_label  := exam.normalize_work_label(v_elem->>'label');
    v_author := exam.normalize_work_title(COALESCE(v_elem->>'author', ''));
    -- ⚠️ 제목 칸에 `'봄봄 · 동백꽃'` 이 통째로 들어온 경우 **여기서 쪼갠다.**
    --    안 쪼개면 파생 문자열을 되나눌 때 원소가 늘어 배열과 문자열이 영영 어긋난다.
    FOREACH v_title IN ARRAY exam.split_work_titles(COALESCE(v_elem->>'title', '')) LOOP
      EXIT WHEN cardinality(v_seen) >= 6;
      CONTINUE WHEN v_title = ANY (v_seen);
      v_seen := v_seen || v_title;
      v_out  := v_out || jsonb_build_array(
        jsonb_build_object('label', v_label, 'title', v_title, 'author', v_author));
    END LOOP;
    EXIT WHEN cardinality(v_seen) >= 6;
  END LOOP;

  RETURN v_out;
END;
$$;

/**
 * 파생 문자열 → 작품 목록 (구 앱·직접 SQL·백필이 쓴다).
 *
 * 문자열에는 **구분 표시가 없고 지은이는 중복이 접혀 있다.** 그래서 옛 목록에서 되찾는다:
 *  · 구분 표시: 같은 제목의 옛 줄에서, 없으면 **같은 자리**의 옛 줄에서.
 *    자리까지 안 보면 제목만 고쳤을 때 '(나)' 표시가 통째로 사라진다.
 *  · 지은이: `p_keep_authors` 가 참일 때만 옛 줄에서 가져온다. 지은이 문자열이 **실제로
 *    바뀐** 호출에서 옛 값을 먼저 보면, 고친 지은이가 저장에 성공한 척하며 사라진다.
 *    못 찾으면 지은이가 하나뿐일 때 모두에게 주고, 아니면 자리대로 짝짓는다.
 */
-- ⚠️ 인자가 늘었으므로 **옷 판을 먼저 지운다.** 기본값이 있는 새 판만 더하면 오버로드가 되어
--    3인자 호출이 `is not unique` 로 막힌다(이 파일을 다시 돌릴 때 실제로 죽었다).
DROP FUNCTION IF EXISTS exam.works_from_strings(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION exam.works_from_strings(
  p_title        TEXT,
  p_author       TEXT,
  p_prev         JSONB   DEFAULT '[]'::jsonb,
  p_keep_authors BOOLEAN DEFAULT TRUE
) RETURNS JSONB
  LANGUAGE plpgsql IMMUTABLE SET search_path = exam, pg_temp
AS $$
DECLARE
  v_titles  TEXT[] := exam.split_work_titles(p_title);
  v_authors TEXT[] := exam.split_work_titles(p_author);
  v_prev    JSONB  := exam.normalize_works(p_prev);
  v_out     JSONB  := '[]'::jsonb;
  v_hit     JSONB;
  v_at      JSONB;
  v_author  TEXT;
  v_label   TEXT;
  v_i       INT;
BEGIN
  FOR v_i IN 1 .. COALESCE(cardinality(v_titles), 0) LOOP
    SELECT a.e INTO v_hit
      FROM jsonb_array_elements(v_prev) AS a(e)
     WHERE a.e->>'title' = v_titles[v_i]
     LIMIT 1;
    -- 같은 자리에 있던 옛 줄 — 제목을 고친 경우 구분 표시를 되찾을 유일한 단서다.
    -- ⚠️ 다만 **그 자리의 옛 작품이 어디에도 안 남았을 때만** 가져온다. 그냥 자리로 가져오면
    --    새 작품을 가운데 끼워 넣은 경우('B · 새 작품')에 밀려난 옛 줄의 표시를 베껴
    --    `(나)` 가 두 줄에 붙는다(코덱스 리뷰 2R)
    v_at := v_prev -> (v_i - 1);
    IF v_at IS NOT NULL AND (v_at->>'title') = ANY (v_titles) THEN
      v_at := NULL;
    END IF;

    v_label := COALESCE(NULLIF(v_hit->>'label', ''), NULLIF(v_at->>'label', ''), '');

    v_author := '';
    IF p_keep_authors THEN
      v_author := COALESCE(NULLIF(v_hit->>'author', ''), '');
    END IF;
    IF v_author = '' THEN
      IF cardinality(v_authors) = 1 THEN
        v_author := v_authors[1];
      ELSE
        v_author := COALESCE(v_authors[v_i], '');
      END IF;
    END IF;

    v_out := v_out || jsonb_build_array(
      jsonb_build_object('label', v_label, 'title', v_titles[v_i], 'author', v_author));
  END LOOP;

  RETURN v_out;
END;
$$;

/**
 * 지문의 작품 이름이 바뀌었을 때, **문항이 좁혀 적은** 목록을 따라가게 한다.
 *
 * 짝짓기는 **자리**로 한다. 규칙 셋:
 *  · 여전히 그 지문의 작품이면(이름 그대로·자리만 바뀜) 그대로 둔다.
 *  · 그 자리의 이름이 **새로 생긴 이름**으로 바뀌었으면 따라간다.
 *  · 지문에서 빠졌거나 사람이 따로 적은 이름이면 **그대로 둔다** — 지우면 그 문항이
 *    무엇을 묻는지에 대해 거짓말이 된다(sql/20 의 "사람이 적은 작품명은 건드리지 않는다").
 */
CREATE OR REPLACE FUNCTION exam.rename_work_titles(p_titles TEXT[], p_old TEXT[], p_new TEXT[])
RETURNS TEXT[]
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(array_agg(t ORDER BY ord), '{}'::TEXT[])
    FROM (
      SELECT DISTINCT ON (t) t, ord
        FROM (
          SELECT u.ord,
                 CASE
                   WHEN u.t = ANY (p_new) THEN u.t
                   WHEN array_position(p_old, u.t) IS NOT NULL
                    AND p_new[array_position(p_old, u.t)] IS NOT NULL
                    AND NOT (p_new[array_position(p_old, u.t)] = ANY (p_old))
                     THEN p_new[array_position(p_old, u.t)]
                   ELSE u.t
                 END AS t
            FROM unnest(COALESCE(p_titles, '{}'::TEXT[])) WITH ORDINALITY AS u(t, ord)
        ) s
       WHERE t <> ''
       ORDER BY t, ord
    ) d;
$$;

-- ---------------------------------------------
-- 3. passages 트리거 — 작품 목록이 원본, 문자열은 파생
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.passages_works_from_array() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  -- INSERT 부트스트랩: 목록은 안 보냈는데 문자열은 있다(구 앱·직접 SQL)
  IF TG_OP = 'INSERT'
     AND COALESCE(NEW.works, '[]'::jsonb) = '[]'::jsonb
     AND COALESCE(NEW.title, '') <> '' THEN
    NEW.works := exam.works_from_strings(NEW.title, NEW.author, '[]'::jsonb);
  END IF;

  NEW.works  := exam.normalize_works(NEW.works);
  NEW.title  := array_to_string(exam.works_titles(NEW.works), ' · ');
  NEW.author := exam.works_authors(NEW.works);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION exam.passages_works_from_string() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  -- 앞 트리거(_a)가 이미 파생 문자열을 다시 만들어 놓았으면 할 일이 없다.
  -- ⚠️ 이 가드가 없으면 '목록 + 옛 문자열' 을 함께 보낸 저장에서 방금 더한 작품이 사라진다.
  IF NEW.title  IS NOT DISTINCT FROM array_to_string(exam.works_titles(NEW.works), ' · ')
     AND NEW.author IS NOT DISTINCT FROM exam.works_authors(NEW.works) THEN
    RETURN NEW;
  END IF;

  -- ⚠️ 지은이 문자열이 **실제로 바뀌었으면** 옛 목록의 지은이를 쓰지 않는다. 쓰면
  --    `SET author = '새 지은이'` 가 아무 일도 하지 않고(옛 값이 다시 파생된다) 저장에
  --    성공한 것처럼 보인다 — 가장 찾기 어려운 조용한 유실이다
  NEW.works  := exam.normalize_works(exam.works_from_strings(
                  NEW.title, NEW.author, OLD.works,
                  NEW.author IS NOT DISTINCT FROM exam.works_authors(OLD.works)));
  NEW.title  := array_to_string(exam.works_titles(NEW.works), ' · ');
  NEW.author := exam.works_authors(NEW.works);
  RETURN NEW;
END;
$$;

-- ⚠️ 이름의 `aa_` 접두사와 a/b 순서는 의도적이다 — 트리거는 알파벳 순으로 돈다.
--    `aa_works_*` 는 `audit_passages_update`·`passages_updated_at` 보다 앞이라
--    감사 로그가 확정된 값을 본다. `_a` 가 `_b` 보다 먼저여야 위 가드가 뜻을 갖는다.
DROP TRIGGER IF EXISTS aa_works_a_array_passages ON exam.passages;
CREATE TRIGGER aa_works_a_array_passages
  BEFORE INSERT OR UPDATE OF works ON exam.passages
  FOR EACH ROW EXECUTE FUNCTION exam.passages_works_from_array();

DROP TRIGGER IF EXISTS aa_works_b_string_passages ON exam.passages;
CREATE TRIGGER aa_works_b_string_passages
  BEFORE UPDATE OF title, author ON exam.passages
  FOR EACH ROW
  WHEN (NEW.title IS DISTINCT FROM OLD.title OR NEW.author IS DISTINCT FROM OLD.author)
  EXECUTE FUNCTION exam.passages_works_from_string();

-- ---------------------------------------------
-- 4. problems 트리거 — 작품명 배열이 원본, 문자열은 파생
-- ---------------------------------------------
/** 빈 목록은 '이 지문 전체' 라는 뜻 — 그 자리에서 지문의 작품으로 채운다 */
CREATE OR REPLACE FUNCTION exam.fill_problem_work_titles(p_titles TEXT[], p_passage UUID)
RETURNS TEXT[]
  LANGUAGE plpgsql STABLE SET search_path = exam, pg_temp
AS $$
DECLARE
  v_titles TEXT[] := exam.normalize_work_titles(p_titles);
BEGIN
  IF cardinality(v_titles) = 0 AND p_passage IS NOT NULL THEN
    SELECT exam.works_titles(ps.works) INTO v_titles
      FROM exam.passages ps WHERE ps.id = p_passage;
  END IF;
  RETURN COALESCE(v_titles, '{}'::TEXT[]);
END;
$$;

CREATE OR REPLACE FUNCTION exam.problems_works_from_array() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_titles TEXT[] := exam.normalize_work_titles(NEW.work_titles);
BEGIN
  -- INSERT 부트스트랩: 배열은 안 보냈는데 문자열은 있다(구 앱·직접 SQL)
  IF cardinality(v_titles) = 0 AND TG_OP = 'INSERT' AND COALESCE(NEW.work_title, '') <> '' THEN
    v_titles := exam.split_work_titles(NEW.work_title);
  END IF;

  NEW.work_titles := exam.fill_problem_work_titles(v_titles, NEW.passage_id);
  NEW.work_title  := array_to_string(NEW.work_titles, ' · ');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION exam.problems_works_from_string() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  -- 앞 트리거(_a)가 이미 다시 만들어 놓았으면 할 일이 없다(passages 쪽과 같은 가드)
  IF NEW.work_title IS NOT DISTINCT FROM array_to_string(NEW.work_titles, ' · ') THEN
    RETURN NEW;
  END IF;

  NEW.work_titles := exam.fill_problem_work_titles(
                       exam.split_work_titles(NEW.work_title), NEW.passage_id);
  NEW.work_title  := array_to_string(NEW.work_titles, ' · ');
  RETURN NEW;
END;
$$;

-- ⚠️ `problems_search_text` 보다 **먼저** 돌아야 파생 작품명이 검색 평문에 들어간다
--    ('aa_w' < 'au' < 'pr'). 이름을 바꾸면 검색에서 작품명이 조용히 빠진다.
DROP TRIGGER IF EXISTS aa_works_a_array_problems ON exam.problems;
CREATE TRIGGER aa_works_a_array_problems
  BEFORE INSERT OR UPDATE OF passage_id, work_titles ON exam.problems
  FOR EACH ROW EXECUTE FUNCTION exam.problems_works_from_array();

DROP TRIGGER IF EXISTS aa_works_b_string_problems ON exam.problems;
CREATE TRIGGER aa_works_b_string_problems
  BEFORE UPDATE OF work_title ON exam.problems
  FOR EACH ROW
  WHEN (NEW.work_title IS DISTINCT FROM OLD.work_title)
  EXECUTE FUNCTION exam.problems_works_from_string();

-- ---------------------------------------------
-- 5. 지문의 작품이 바뀌면 딸린 문항이 따라간다 (sql/20 §4 의 후신)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.sync_passage_works_to_problems() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_old TEXT[] := exam.works_titles(OLD.works);
  v_new TEXT[] := exam.works_titles(NEW.works);
BEGIN
  -- ⚠️ **지문을 합치는 중에는 전파하지 않는다**(코덱스 stop 리뷰 2R). 합치기는 앞 지문의
  --    작품 목록을 늘리는데, 그것을 '작품이 하나 더 붙었다' 로 보면 앞 지문의 문항이
  --    **뒤 지문의 작품까지 묻는 문항이 된다** — 쪽이 갈려 따로 읽힌 것뿐인데 묻는 대상이 는다.
  --    표시는 트랜잭션 지역(`set_config(..., true)`)이라 그 합치기에만 걸린다
  IF COALESCE(current_setting('exam.skip_work_sync', true), '') = 'on' THEN
    RETURN NULL;
  END IF;

  UPDATE exam.problems p
     SET work_titles = n.titles
    FROM (
      SELECT q.id,
             CASE
               -- 빈 목록은 '이 지문 전체' 라는 뜻이다 — 늘 새 목록을 따라간다
               WHEN cardinality(q.work_titles) = 0 THEN v_new
               -- ⚠️ 물려받은 그대로(집합이 같다)면 따라가되, **옛 목록이 두 편 이상일 때만**이다.
               --    작품이 하나뿐이던 지문에서는 '전체를 묻는다' 와 '그 한 편으로 좁혔다' 가
               --    저장값으로 **구별되지 않는다**. 그때 따라가게 두면, 뒤늦게 (나)를 더하거나
               --    갈라진 지문을 합칠 때 그 한 편만 묻던 문항까지 **말없이 두 편을 묻는 문항이
               --    된다** — 없는 사실을 지어내는 쪽이라, 이 저장소의 다른 규칙과 같은 까닭으로
               --    넓히지 않는다. 새 작품은 검수 화면에서 체크로 붙인다(코덱스 stop 리뷰)
               WHEN cardinality(v_old) >= 2
                AND q.work_titles <@ v_old AND q.work_titles @> v_old THEN v_new
               -- 사람이 좁혀 적었으면 자리로 이름만 따라간다(이름 바꾸기·빠짐은 그대로 따라간다)
               ELSE exam.rename_work_titles(q.work_titles, v_old, v_new)
             END AS titles
        FROM exam.problems q
       WHERE q.passage_id = NEW.id
    ) n
   WHERE p.id = n.id
     -- ⚠️ 달라진 행만 건드린다 — 아니면 상관없는 문항의 updated_at 이 올라
     --    열어 둔 검수 탭이 아무도 안 고쳤는데 충돌로 튕긴다
     AND p.work_titles IS DISTINCT FROM n.titles;
  RETURN NULL;
END;
$$;

-- ⚠️ **`AFTER UPDATE OF works` 로 두지 말 것.** `UPDATE OF` 는 SET 목록만 보므로,
--    문자열 경로(`SET title = …`)에서 `_b` 가 works 를 다시 만들어도 발화하지 않는다.
--    컬럼 목록 없이 걸고 WHEN 에서 실제 변화를 본다(WHEN 은 최종 NEW 를 본다).
DROP TRIGGER IF EXISTS passages_sync_work_titles ON exam.passages;
CREATE TRIGGER passages_sync_work_titles
  AFTER UPDATE ON exam.passages
  FOR EACH ROW
  WHEN (exam.works_titles(OLD.works) IS DISTINCT FROM exam.works_titles(NEW.works))
  EXECUTE FUNCTION exam.sync_passage_works_to_problems();

-- ---------------------------------------------
-- 6. 옛 트리거·함수 치우기 (sql/20 §3·§4)
-- ---------------------------------------------
DROP TRIGGER IF EXISTS aa_fill_work_title_problems ON exam.problems;
DROP TRIGGER IF EXISTS passages_sync_work_title ON exam.passages;
DROP FUNCTION IF EXISTS exam.fill_problem_work_title();
DROP FUNCTION IF EXISTS exam.sync_passage_title_to_problems();

-- ---------------------------------------------
-- 7. merge_passages 다시 — 작품 목록을 이어 붙인다 (sql/24 판을 이어받는다)
-- ---------------------------------------------
-- sql/24 본문 그대로이되 **작품 두 줄만 바뀐다**: 빈 칸 채우기(`title`/`author`)가 아니라
-- 목록을 이어 붙인다. 앞 지문에 이미 있는 작품은 `normalize_works` 가 접는다.
-- ⚠️ SET 목록에서 `title`/`author` 를 **빼야 한다** — 남기면 `aa_works_b` 가 발화해
--    방금 이어 붙인 목록을 문자열에서 다시 만든다.
CREATE OR REPLACE FUNCTION exam.merge_passages(
  p_target UUID,
  p_source UUID
) RETURNS TIMESTAMPTZ
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_target exam.passages%ROWTYPE;
  v_source exam.passages%ROWTYPE;
  v_offset INT;
  v_room   INT;
  v_html   TEXT;
  v_work_count INT;
  v_prev_skip TEXT;
  v_updated TIMESTAMPTZ;
  -- 한 항목에 달 수 있는 그림 수. 앱의 MAX_FIGURES(figure-placeholders.ts)와 같아야 한다
  c_max_figures CONSTANT INT := 9;
  -- 한 지문에 실릴 수 있는 작품 수. 위 CHECK·normalize_works·앱의 WORKS_MAX 와 같다
  c_max_works CONSTANT INT := 6;
BEGIN
  IF p_target = p_source THEN
    RAISE EXCEPTION '같은 지문끼리는 합칠 수 없습니다' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ⚠️ 두 행을 **잠그고** 읽는다. 안 그러면 다른 탭이 그 사이 본문을 고쳐도
  --    여기서 읽어 둔 옛 본문으로 덮어써 그 수정이 조용히 사라진다
  SELECT * INTO v_target FROM exam.passages WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '앞 지문을 찾지 못했습니다 (id: %)', p_target USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_source FROM exam.passages WHERE id = p_source FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '뒤 지문을 찾지 못했습니다 (id: %)', p_source USING ERRCODE = 'no_data_found';
  END IF;

  IF v_target.source_id <> v_source.source_id THEN
    RAISE EXCEPTION '다른 출처의 지문끼리는 합칠 수 없습니다' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ⚠️ 합치면 작품이 상한을 넘는지 **먼저** 본다. `normalize_works` 는 넘치는 편을 조용히
  --    잘라 내는데, 그때 뒤 지문은 이미 지워진 뒤라 되돌릴 길이 없다. 더욱이 그 편을 묻던
  --    문항은 '지문 전체' 로 넓어져 **다른 작품을 묻는 문항이 된다**. 그림 상한과 같은
  --    규약으로, 아무것도 건드리지 않고 까닭을 그대로 알린다(코덱스 리뷰 2R)
  SELECT count(*) INTO v_work_count FROM (
    SELECT DISTINCT u.t
      FROM jsonb_array_elements(
             COALESCE(v_target.works, '[]'::jsonb) || COALESCE(v_source.works, '[]'::jsonb)
           ) AS a(e),
           LATERAL unnest(exam.split_work_titles(COALESCE(a.e->>'title', ''))) AS u(t)
  ) x;
  IF v_work_count > c_max_works THEN
    RAISE EXCEPTION
      '두 지문의 작품이 %편이라 합칠 수 없습니다(최대 %편). 작품을 먼저 정리해 주세요.',
      v_work_count, c_max_works
      USING ERRCODE = 'check_violation';
  END IF;

  -- 뒤 지문의 그림은 앞 지문 것 **뒤로** 밀린다.
  v_offset := cardinality(v_target.figure_paths);
  v_room   := GREATEST(c_max_figures - v_offset, 0);

  -- ⚠️ 자리가 모자라면 **아무것도 건드리지 않고 멈춘다.** 넘치는 그림만 조용히 버리고
  --    성공했다고 알리면, 지문은 지워진 뒤라 되돌릴 길이 없다.
  IF cardinality(v_source.figure_paths) > v_room THEN
    RAISE EXCEPTION
      '두 지문의 그림이 %개라 합칠 수 없습니다(최대 %개). 그림을 먼저 정리해 주세요.',
      v_offset + cardinality(v_source.figure_paths), c_max_figures
      USING ERRCODE = 'check_violation';
  END IF;

  -- 뒤 지문 본문의 자리표시자 번호를 그만큼 민다. 큰 번호부터 바꿔야 연쇄로 겹치지 않는다
  v_html := COALESCE(v_source.html, '');
  IF v_offset > 0 THEN
    FOR i IN REVERSE c_max_figures..1 LOOP
      IF i <= cardinality(v_source.figure_paths) THEN
        v_html := replace(
          v_html,
          '<figure data-figure="' || i || '"></figure>',
          '<figure data-figure="' || (i + v_offset) || '"></figure>'
        );
      ELSE
        v_html := replace(v_html, '<figure data-figure="' || i || '"></figure>', '');
      END IF;
    END LOOP;
  END IF;

  -- ⚠️ 이 UPDATE 로 작품 목록이 늘어난다 — 그것을 전파 트리거가 '작품이 하나 더 붙었다' 로
  --    보면 앞 지문의 문항이 뒤 지문의 작품까지 묻게 된다. 그 트리거만 잠시 끈다.
  -- ⚠️ 끝나면 `'off'` 로 **덮지 말고 원래 값으로 되돌린다**(코덱스 stop 리뷰 3R). 같은
  --    트랜잭션의 바깥에서 이미 꺼 두고 불렀다면, 덮는 순간 그쪽 의도가 풀린다
  v_prev_skip := COALESCE(current_setting('exam.skip_work_sync', true), '');
  PERFORM set_config('exam.skip_work_sync', 'on', true);

  UPDATE exam.passages SET
    -- 본문은 **뒤에 붙인다**. 순서를 바꾸면 글이 거꾸로 읽힌다
    html = CASE
      WHEN v_html = '' THEN v_target.html
      WHEN COALESCE(v_target.html, '') = '' THEN v_html
      ELSE v_target.html || E'\n' || v_html
    END,
    figure_paths = v_target.figure_paths || v_source.figure_paths,
    -- ⚠️ 작품은 **이어 붙인다**(빈 칸 채우기가 아니다, sql/33). 쪽을 넘어가는 (가)(나)
    --    지문이 둘로 갈라져 저장되면 각자 한 편씩만 들고 있다 — 빈 칸만 채우면 뒤 편을 잃는다.
    --    `aa_works_a_array_passages` 가 중복을 접고 `title`/`author` 를 다시 만든다
    works = COALESCE(v_target.works, '[]'::jsonb) || COALESCE(v_source.works, '[]'::jsonb),
    label      = CASE WHEN COALESCE(v_target.label, '')  = '' THEN v_source.label  ELSE v_target.label  END,
    area_path  = CASE WHEN cardinality(v_target.area_path) = 0 THEN v_source.area_path ELSE v_target.area_path END,
    unit_path  = CASE WHEN cardinality(v_target.unit_path) = 0 THEN v_source.unit_path ELSE v_target.unit_path END,
    -- ⚠️ render_mode 는 **글로 되돌린다.** 잘라 둔 이미지는 한쪽 쪽만 담고 있어서,
    --    합친 뒤에도 이미지 출제로 두면 이어 붙인 부분이 인쇄물에서 통째로 사라진다
    render_mode = 'text'
  WHERE id = p_target;

  -- 딸린 문항을 옮긴다. 이게 빠지면 문항이 지워진 지문을 가리키다 NULL 이 되어
  -- '지문 없는 문항' 으로 남는다.
  -- ⚠️ 작품 목록은 **그대로 둔다.** 뒤 지문의 작품은 합친 지문에도 그대로 있으므로 옮길 것이
  --    없고, 빈 목록으로 되돌려 보내면 합쳐진 목록을 통째로 물려받아 **앞 지문의 작품까지
  --    묻는 문항이 된다** — 쪽이 갈려 따로 읽힌 것뿐인데 묻는 대상이 늘어난다(코덱스 stop 리뷰).
  --    작품이 아예 없던 문항은 빈 목록이라 `aa_works_a_array_problems` 가 합쳐진 목록을 준다
  PERFORM set_config('exam.skip_work_sync', v_prev_skip, true);

  UPDATE exam.problems SET passage_id = p_target WHERE passage_id = p_source;

  -- 작품이 **아예 없던** 문항만 합쳐진 목록을 받는다. 빈 목록은 '이 지문 전체' 라는 뜻이라
  -- 합친 뒤에도 참이고, 비워 두면 그 문항이 작품 트리 어디에도 안 걸린다.
  -- 빈 값을 다시 넣어 `aa_works_a_array_problems` 가 물려주게 한다.
  -- ⚠️ **합친 지문에 작품이 있을 때만** 한다(코덱스 stop 리뷰 3R). 양쪽 다 작품이 없으면
  --    값이 하나도 안 바뀌는데 `updated_at` 과 감사 로그만 올라, 그 문항을 열어 둔 탭이
  --    아무도 안 고쳤는데 충돌로 튕긴다
  IF EXISTS (SELECT 1 FROM exam.passages WHERE id = p_target AND works <> '[]'::jsonb) THEN
    UPDATE exam.problems SET work_titles = '{}'
     WHERE passage_id = p_target AND cardinality(work_titles) = 0;
  END IF;

  -- ⚠️ Storage 파일은 지우지 않는다 — 뒤 지문의 그림 경로를 앞 지문이 물려받았고,
  --    이미 만든 문제지도 스냅샷으로 들고 있다
  DELETE FROM exam.passages WHERE id = p_source;

  SELECT updated_at INTO v_updated FROM exam.passages WHERE id = p_target;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION exam.merge_passages(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exam.merge_passages(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION exam.merge_passages(UUID, UUID) IS
  '갈라진 지문 둘을 하나로 (본문·그림·작품 목록 이어 붙이기 + 자리표시자 번호 밀기 + 문항 이관 + 뒤 지문 삭제). 한 트랜잭션이라야 문항만 남는 상태가 안 생긴다';

-- ---------------------------------------------
-- 8. 백필 — 이어 적은 문자열을 목록으로 편다
-- ---------------------------------------------
-- ⚠️ **문항을 먼저, 지문을 나중에.** 순서를 바꾸면 지문 백필의 전파 트리거가 그 시점에
--    아직 전부 비어 있는 문항들을 '물려받는 중' 으로 보고, **사람이 좁혀 적어 둔 작품명**을
--    지문 전체 목록으로 덮어쓴다.
--
-- ⚠️ 이 두 UPDATE 는 행마다 감사 트리거를 발화시켜 본문 HTML 째로 로그를 남긴다
--    (2026-09-19 기준 문항 993건 + 지문 200건). 그래서 **그 트리거만 껐다 켠다.**
--    ⚠️ `session_replication_role = replica` 로 끄지 말 것 — `problems_search_text` 와
--    이 파일의 `aa_works_*` 까지 함께 꺼져 파생 컬럼이 빈 채로 굳는다.
-- ⚠️ `updated_at` 은 그대로 올라간다(sql/20 §6 과 같다) — 적용 시점에 열려 있던 검수 탭은
--    새로고침 전까지 저장이 충돌로 튕긴다. 배포와 붙여 돌리고 안내할 것.
ALTER TABLE exam.problems DISABLE TRIGGER audit_problems_update;
ALTER TABLE exam.passages DISABLE TRIGGER audit_passages_update;

UPDATE exam.problems
   SET work_titles = exam.split_work_titles(work_title)
 WHERE cardinality(work_titles) = 0 AND work_title <> '';

UPDATE exam.passages
   SET works = exam.works_from_strings(title, author, '[]'::jsonb)
 WHERE works = '[]'::jsonb AND title <> '';

-- 표기 규칙이 바뀌었을 때를 위한 재정규화(위 공백 집합 수정 같은 경우). 이미 표준 표기면
-- 0행이라 그냥 지나간다 — `works = works` 로 써야 `aa_works_a` 가 발화해 다시 다듬는다.
UPDATE exam.passages SET works = works
 WHERE works IS DISTINCT FROM exam.normalize_works(works);
UPDATE exam.problems SET work_titles = work_titles
 WHERE work_titles IS DISTINCT FROM exam.normalize_work_titles(work_titles);

ALTER TABLE exam.problems ENABLE TRIGGER audit_problems_update;
ALTER TABLE exam.passages ENABLE TRIGGER audit_passages_update;

-- ---------------------------------------------
-- 9. 주석
-- ---------------------------------------------
COMMENT ON COLUMN exam.passages.works IS
  '이 지문에 실린 작품들 [{label,title,author}] — (가)(나)면 두 편. 작품 축의 원본이다';
COMMENT ON COLUMN exam.passages.title IS
  '작품명 파생 문자열(works 의 제목을 " · " 로 이은 값). 트리거가 채운다 — 앱에서 보내지 말 것';
COMMENT ON COLUMN exam.passages.author IS
  '지은이 파생 문자열(works 의 지은이를 중복 없이 " · " 로 이은 값). 트리거가 채운다 — 앱에서 보내지 말 것';
COMMENT ON COLUMN exam.problems.work_titles IS
  '이 문항이 묻는 작품명들. 비워 보내면 딸린 지문의 작품 전체를 트리거가 채운다. 아카이브 작품 트리의 축';
COMMENT ON COLUMN exam.problems.work_title IS
  'work_titles 를 " · " 로 이은 파생 문자열(검색 평문·인쇄 스냅샷용). 트리거가 채운다 — 앱에서 보내지 말 것';
COMMENT ON FUNCTION exam.normalize_works(JSONB) IS
  '지문 작품 목록 다듬기. 앱의 src/lib/problem-bank/work-title.ts 와 1:1 로 같은 규칙이어야 한다';
COMMENT ON FUNCTION exam.split_work_titles(TEXT) IS
  '이어 적은 작품명 문자열을 표준 표기 목록으로. 앱의 splitWorkTitles 와 1:1';
COMMENT ON FUNCTION exam.sync_passage_works_to_problems() IS
  '지문 작품 변경을 딸린 문항에 전파한다. 사람이 좁혀 적은 목록은 자리로 이름만 따라간다';

-- PostgREST 스키마 캐시 갱신 — 컬럼·함수를 더했으므로 알린다
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 10. 자가 검증 — 트리거가 **실제로 도는지** 넣었다 지워서 확인한다
-- ---------------------------------------------
-- 하위 트랜잭션(BEGIN … EXCEPTION) 안에서 진짜 행을 넣고 14단계를 확인한 뒤 일부러 예외를
-- 던져 **통째로 되돌린다.** 감사 로그도 함께 되돌아간다. 결과는 NOTICE 로만 남는다
-- (run-sql.js 는 SELECT 결과를 찍지 않는다 — CLAUDE.md 의 '검증은 NOTICE 로' 규칙).
DO $probe$
DECLARE
  v_user UUID := '00000000-0000-0000-0000-000000000000';
  v_src  UUID := gen_random_uuid();
  v_p1   UUID := gen_random_uuid();
  v_p2   UUID := gen_random_uuid();
  v_p3   UUID := gen_random_uuid();
  v_p5   UUID := gen_random_uuid();
  v_p6   UUID := gen_random_uuid();
  v_p7   UUID := gen_random_uuid();
  v_p8   UUID := gen_random_uuid();
  v_p9   UUID := gen_random_uuid();
  v_q1   UUID := gen_random_uuid();
  v_q2   UUID := gen_random_uuid();
  v_q3   UUID := gen_random_uuid();
  v_q4   UUID := gen_random_uuid();
  v_q5   UUID := gen_random_uuid();
  v_t    TEXT[];
  v_s    TEXT;
  v_j    JSONB;
BEGIN
  BEGIN
    INSERT INTO exam.problem_sources (id, source_type, title, user_id)
      VALUES (v_src, '내신기출', '__probe__ 지우세요', v_user);

    -- ① 문자열만으로 넣어도 작품 목록이 생긴다(구 앱·직접 SQL 경로)
    INSERT INTO exam.passages (id, source_id, title, author, html, user_id)
      VALUES (v_p1, v_src, '「봄봄」 · 동백꽃', '김유정', '<p>지문</p>', v_user);
    SELECT exam.works_titles(works), title || '|' || author INTO v_t, v_s
      FROM exam.passages WHERE id = v_p1;
    IF v_t <> ARRAY['봄봄','동백꽃'] OR v_s <> '봄봄 · 동백꽃|김유정' THEN
      RAISE EXCEPTION 'probe ① 실패: 목록=% 문자열=%', v_t, v_s;
    END IF;

    -- ② 문항은 지문의 작품을 물려받고, 그 값이 검색 평문에도 들어간다
    --    (aa_works_a 가 problems_search_text 보다 먼저 돈다는 뜻)
    INSERT INTO exam.problems (id, source_id, passage_id, stem_html, user_id)
      VALUES (v_q1, v_src, v_p1, '<p>발문</p>', v_user);
    SELECT work_titles, work_title INTO v_t, v_s FROM exam.problems WHERE id = v_q1;
    IF v_t <> ARRAY['봄봄','동백꽃'] OR v_s <> '봄봄 · 동백꽃'
       OR NOT EXISTS (SELECT 1 FROM exam.problems WHERE id = v_q1 AND search_text LIKE '%동백꽃%') THEN
      RAISE EXCEPTION 'probe ② 실패: 목록=% 문자열=%', v_t, v_s;
    END IF;

    -- ③ 목록과 **옛 파생 문자열을 함께** 보내도 목록이 이긴다(작품이 사라지지 않는다)
    UPDATE exam.problems SET work_titles = ARRAY['봄봄','동백꽃'], work_title = '봄봄' WHERE id = v_q1;
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q1;
    IF v_t <> ARRAY['봄봄','동백꽃'] THEN
      RAISE EXCEPTION 'probe ③ 실패(목록을 문자열이 덮었다): %', v_t;
    END IF;

    -- ④ 좁혀 적은 문항은, 지문 제목을 **문자열 경로**로 고쳐도 이름만 따라가고 지은이는 남는다
    UPDATE exam.problems SET work_titles = ARRAY['동백꽃'] WHERE id = v_q1;
    UPDATE exam.passages SET title = '봄봄 · 동백꽃(개정)' WHERE id = v_p1;
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q1;
    SELECT works INTO v_j FROM exam.passages WHERE id = v_p1;
    IF v_t <> ARRAY['동백꽃(개정)'] THEN
      RAISE EXCEPTION 'probe ④ 실패(이름이 안 따라갔다): %', v_t;
    END IF;
    IF (v_j->1->>'author') <> '김유정' THEN
      RAISE EXCEPTION 'probe ④ 실패(문자열 경로에서 지은이를 잃었다): %', v_j;
    END IF;

    -- ⑤ 빈 목록은 '지문 전체' — 그 자리에서 다시 물려받는다
    UPDATE exam.problems SET work_titles = '{}' WHERE id = v_q1;
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q1;
    IF v_t <> ARRAY['봄봄','동백꽃(개정)'] THEN
      RAISE EXCEPTION 'probe ⑤ 실패(다시 물려받지 않았다): %', v_t;
    END IF;

    -- ⑥ 앱이 보낸 파생 문자열은 무시한다(char_count 와 같은 계약)
    UPDATE exam.passages
       SET works = '[{"label":"","title":"봄봄","author":"김유정"}]'::jsonb,
           title = '앱이 보낸 엉뚱한 이름', author = '엉뚱한 지은이'
     WHERE id = v_p1;
    SELECT title || '|' || author INTO v_s FROM exam.passages WHERE id = v_p1;
    IF v_s <> '봄봄|김유정' THEN
      RAISE EXCEPTION 'probe ⑥ 실패(앱이 보낸 파생값이 살아남았다): %', v_s;
    END IF;

    -- ⑦ 지문 합치기는 작품 목록을 **이어 붙이고**, 물려받던 문항은 합쳐진 목록을 받는다
    INSERT INTO exam.passages (id, source_id, works, html, user_id) VALUES
      (v_p2, v_src,
       '[{"label":"가","title":"가나다전","author":"갑"},
         {"label":"나","title":"사아자전","author":"정"}]'::jsonb, '<p>앞</p>', v_user),
      (v_p3, v_src, '[{"label":"다","title":"라마바전","author":"을"}]'::jsonb, '<p>뒤</p>', v_user);
    INSERT INTO exam.problems (id, source_id, passage_id, stem_html, user_id) VALUES
      (v_q2, v_src, v_p2, '<p>앞 문항</p>', v_user),
      (v_q3, v_src, v_p3, '<p>뒤 문항</p>', v_user);
    PERFORM exam.merge_passages(v_p2, v_p3);
    SELECT exam.works_titles(works) INTO v_t FROM exam.passages WHERE id = v_p2;
    IF v_t <> ARRAY['가나다전','사아자전','라마바전'] THEN
      RAISE EXCEPTION 'probe ⑦ 실패(합친 지문의 작품): %', v_t;
    END IF;
    -- ⚠️ 합친다고 **묻는 작품이 늘지 않는다.** 쪽이 갈려 따로 읽힌 것뿐이라, 앞 지문의 문항이
    --    뒤 지문의 작품까지 묻게 되면 없는 사실을 지어내는 셈이다(코덱스 stop 리뷰).
    --    앞 지문이 **두 편 이상**일 때가 특히 놓치기 쉽다 — 전파 트리거의 '집합이 같으면
    --    따라간다' 갈래에 그대로 걸리기 때문이다(코덱스 stop 리뷰 2R)
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q2;
    IF v_t <> ARRAY['가나다전','사아자전'] THEN
      RAISE EXCEPTION 'probe ⑦ 실패(앞 지문 문항이 넓어졌다): %', v_t;
    END IF;
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q3;
    IF v_t <> ARRAY['라마바전'] THEN
      RAISE EXCEPTION 'probe ⑦ 실패(옮긴 문항이 묻던 작품을 잃었다): %', v_t;
    END IF;
    -- 작품이 아예 없던 지문에 붙이면, 그 지문의 문항은 합쳐진 목록을 받는다(빈 목록 = 전체)
    INSERT INTO exam.passages (id, source_id, html, user_id)
      VALUES (v_p8, v_src, '<p>작품 없는 앞 지문</p>', v_user);
    INSERT INTO exam.problems (id, source_id, passage_id, stem_html, user_id)
      VALUES (v_q5, v_src, v_p8, '<p>물음</p>', v_user);
    INSERT INTO exam.passages (id, source_id, works, html, user_id)
      VALUES (v_p9, v_src, '[{"label":"","title":"붙는작품","author":""}]'::jsonb, '<p>뒤</p>', v_user);
    PERFORM exam.merge_passages(v_p8, v_p9);
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q5;
    IF v_t <> ARRAY['붙는작품'] THEN
      RAISE EXCEPTION 'probe ⑦ 실패(빈 목록이 합쳐진 작품을 못 받았다): %', v_t;
    END IF;

    -- ⑧ 문자열 경로로 **제목만** 고쳐도 구분 표시는 남는다(같은 자리에서 되찾는다)
    UPDATE exam.passages SET works =
      '[{"label":"가","title":"봄봄","author":"김유정"},
        {"label":"나","title":"동백꽃","author":"김유정"}]'::jsonb WHERE id = v_p1;
    UPDATE exam.passages SET title = '봄봄 · 동백꽃(개정)' WHERE id = v_p1;
    SELECT works INTO v_j FROM exam.passages WHERE id = v_p1;
    IF (v_j->1->>'label') <> '나' OR (v_j->1->>'title') <> '동백꽃(개정)' THEN
      RAISE EXCEPTION 'probe ⑧ 실패(제목을 고치자 구분 표시를 잃었다): %', v_j;
    END IF;

    -- ⑨ 문자열 경로로 **지은이만** 고치면 그 값이 저장된다(옛 값이 되살아나지 않는다)
    UPDATE exam.passages SET author = '고친이' WHERE id = v_p1;
    SELECT works INTO v_j FROM exam.passages WHERE id = v_p1;
    IF (v_j->0->>'author') <> '고친이' OR (v_j->1->>'author') <> '고친이' THEN
      RAISE EXCEPTION 'probe ⑨ 실패(지은이 수정이 사라졌다): %', v_j;
    END IF;

    -- ⑩ 가운데 새 작품을 끼워 넣어도 옛 구분 표시를 베끼지 않는다
    UPDATE exam.passages SET works =
      '[{"label":"가","title":"봄봄","author":"김유정"},
        {"label":"나","title":"동백꽃","author":"김유정"}]'::jsonb WHERE id = v_p1;
    UPDATE exam.passages SET title = '동백꽃 · 새 작품' WHERE id = v_p1;
    SELECT works INTO v_j FROM exam.passages WHERE id = v_p1;
    IF (v_j->0->>'label') <> '나' OR COALESCE(v_j->1->>'label', '') <> '' THEN
      RAISE EXCEPTION 'probe ⑩ 실패(밀려난 줄의 구분 표시를 베꼈다): %', v_j;
    END IF;

    -- ⑪ 합쳐서 작품이 상한을 넘으면 **아무것도 건드리지 않고** 멈춘다
    INSERT INTO exam.passages (id, source_id, works, html, user_id) VALUES
      (v_p5, v_src,
       '[{"label":"","title":"작품1","author":""},{"label":"","title":"작품2","author":""},
         {"label":"","title":"작품3","author":""},{"label":"","title":"작품4","author":""},
         {"label":"","title":"작품5","author":""},{"label":"","title":"작품6","author":""}]'::jsonb,
       '<p>앞</p>', v_user),
      (v_p6, v_src, '[{"label":"","title":"작품7","author":""}]'::jsonb, '<p>뒤</p>', v_user);
    BEGIN
      PERFORM exam.merge_passages(v_p5, v_p6);
      RAISE EXCEPTION 'probe ⑪ 실패(상한을 넘겼는데 합쳐졌다)';
    EXCEPTION WHEN check_violation THEN
      IF NOT EXISTS (SELECT 1 FROM exam.passages WHERE id = v_p6) THEN
        RAISE EXCEPTION 'probe ⑪ 실패(멈췄다면서 뒤 지문을 지웠다)';
      END IF;
    END;

    -- ⑫ 작품이 **하나뿐이던** 지문에 한 편을 더해도 딸린 문항은 넓어지지 않는다
    INSERT INTO exam.passages (id, source_id, works, html, user_id) VALUES
      (v_p7, v_src, '[{"label":"","title":"홀로작품","author":"갑"}]'::jsonb, '<p>글</p>', v_user);
    INSERT INTO exam.problems (id, source_id, passage_id, stem_html, user_id)
      VALUES (v_q4, v_src, v_p7, '<p>물음</p>', v_user);
    UPDATE exam.passages SET works = works || '[{"label":"나","title":"새작품","author":"을"}]'::jsonb
     WHERE id = v_p7;
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q4;
    IF v_t <> ARRAY['홀로작품'] THEN
      RAISE EXCEPTION 'probe ⑫ 실패(한 편짜리 지문에서 문항이 말없이 넓어졌다): %', v_t;
    END IF;
    -- 이름을 바꾸면 그건 따라간다(넓히는 것과 이름 따라가기는 다른 일이다)
    UPDATE exam.passages SET works =
      '[{"label":"","title":"홀로작품(개정)","author":"갑"},
        {"label":"나","title":"새작품","author":"을"}]'::jsonb WHERE id = v_p7;
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q4;
    IF v_t <> ARRAY['홀로작품(개정)'] THEN
      RAISE EXCEPTION 'probe ⑫ 실패(이름이 안 따라갔다): %', v_t;
    END IF;

    -- ⑬ 두 편 이상이던 지문에서 **전체를 묻던** 문항은 새 작품을 따라간다(넓히기는 여기서만)
    UPDATE exam.problems SET work_titles = ARRAY['홀로작품(개정)','새작품'] WHERE id = v_q4;
    UPDATE exam.passages SET works = works || '[{"label":"다","title":"셋째작품","author":"병"}]'::jsonb
     WHERE id = v_p7;
    SELECT work_titles INTO v_t FROM exam.problems WHERE id = v_q4;
    IF v_t <> ARRAY['홀로작품(개정)','새작품','셋째작품'] THEN
      RAISE EXCEPTION 'probe ⑬ 실패(전체를 묻던 문항이 안 따라갔다): %', v_t;
    END IF;

    -- ⑭ 되돌린다 — 아래 handler 가 이 메시지만 성공으로 읽는다
    RAISE EXCEPTION '__probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = '__probe_rollback__' THEN
      RAISE NOTICE '✓ 트리거 자가 검증 14단계 통과 (넣은 행은 전부 되돌렸습니다)';
    ELSE
      RAISE;
    END IF;
  END;
END
$probe$;

-- ---------------------------------------------
-- 11. 적용 결과 요약 (NOTICE 로 남긴다)
-- ---------------------------------------------
DO $report$
DECLARE
  v_multi_pass INT; v_multi_prob INT; v_bad_pass INT; v_bad_prob INT; v_orphan INT;
BEGIN
  SELECT count(*) INTO v_multi_pass FROM exam.passages WHERE jsonb_array_length(works) >= 2;
  SELECT count(*) INTO v_multi_prob FROM exam.problems WHERE cardinality(work_titles) >= 2;
  SELECT count(*) INTO v_bad_pass FROM exam.passages
   WHERE title  IS DISTINCT FROM array_to_string(exam.works_titles(works), ' · ')
      OR author IS DISTINCT FROM exam.works_authors(works);
  SELECT count(*) INTO v_bad_prob FROM exam.problems
   WHERE work_title IS DISTINCT FROM array_to_string(work_titles, ' · ');
  SELECT count(*) INTO v_orphan FROM exam.problems p JOIN exam.passages ps ON ps.id = p.passage_id
   WHERE cardinality(p.work_titles) = 0 AND ps.works <> '[]'::jsonb;

  RAISE NOTICE '작품 두 편 이상인 지문 %건 · 문항 %건', v_multi_pass, v_multi_prob;
  RAISE NOTICE '파생 문자열이 어긋난 지문 %건 · 문항 %건 (둘 다 0 이어야 한다)', v_bad_pass, v_bad_prob;
  RAISE NOTICE '작품 있는 지문에 딸렸는데 목록이 빈 문항 %건 (0 이어야 한다)', v_orphan;

  IF v_bad_pass > 0 OR v_bad_prob > 0 OR v_orphan > 0 THEN
    RAISE EXCEPTION '백필 결과가 불변식을 어깁니다 — 위 건수를 확인하세요';
  END IF;
END
$report$;

-- ---------------------------------------------
-- 확인 쿼리 (적용 뒤 직접 돌려 볼 것)
-- ---------------------------------------------
-- ① 컬럼이 생겼고 **생성 컬럼이 아니다**(attgenerated 가 빈 문자열이어야 한다 —
--    GENERATED 로 두면 BEFORE 감사 트리거가 한 판 뒤진 값을 로그에 남긴다):
--   SELECT attrelid::regclass, attname, format_type(atttypid, atttypmod), attgenerated
--     FROM pg_attribute WHERE attrelid IN ('exam.passages'::regclass,'exam.problems'::regclass)
--      AND attname IN ('works','work_titles') AND NOT attisdropped;
--
-- ② 트리거 이름·순서·발화 조건. 옛 이름(aa_fill_work_title_problems·passages_sync_work_title)은
--    없어야 하고, passages_sync_work_titles 는 **컬럼 목록 없는 AFTER UPDATE** 여야 한다:
--   SELECT tgrelid::regclass, tgname, pg_get_triggerdef(oid) FROM pg_trigger
--    WHERE tgrelid IN ('exam.passages'::regclass,'exam.problems'::regclass)
--      AND NOT tgisinternal ORDER BY tgrelid, tgname;
--
-- ③ 감사 트리거가 다시 켜졌는가 (tgenabled = 'O'):
--   SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgname IN ('audit_problems_update','audit_passages_update');
--
-- ④ 작품 목록 미리보기 (작품 트리에 이렇게 나온다):
--   SELECT t AS 작품, count(*) AS 문항수 FROM exam.problems p, unnest(p.work_titles) AS t
--    GROUP BY t ORDER BY count(*) DESC LIMIT 30;
--
-- ⑤ 여러 편이 실린 지문들:
--   SELECT id, works FROM exam.passages WHERE jsonb_array_length(works) >= 2 ORDER BY created_at DESC;
