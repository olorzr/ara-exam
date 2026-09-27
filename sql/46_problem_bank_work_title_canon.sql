-- =============================================
-- 46. 기출 문제 은행 — 띄어쓰기·한자·줄표로 갈라진 작품명을 한 표기로 묶는다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/46_problem_bank_work_title_canon.sql
-- =============================================
-- 배경 (2026-09-27, 제보 "기형도 엄마 걱정은 '엄마 걱정'이랑 '엄마걱정' 두개로 나뉘어져 있어 /
--   김사인의 '지상의 방 한칸 - 박영한 님의 제를 빌려'도 2개 / 김시습 이생규장전 같은 경우에는
--   한자가 있고 없고로 나뉘어져 있음 … 이렇게 2개 이상 뜨는 것도 방지하는 방법은 없을까?
--   물론, xxx 해독 이런건 별도로 있어야 하는게 맞아"):
--   작품 축은 문자열 완전 일치로 묶인다(`work-tree.ts`). sql/42 는 갈래를 **하나씩 손으로**
--   합쳤지만, 새 시험지가 들어올 때마다 같은 갈래가 다시 생긴다. 실제 DB 를 읽어 보니 갈래의
--   원인은 셋뿐이었다:
--     · 띄어쓰기   — 엄마 걱정 / 엄마걱정, 봄 길 / 봄길, 주몽신화 / 주몽 신화 …
--     · 한자 괄호  — 이생규장전 / 이생규장전(李生窺墻傳), 제망매가 / 제망매가(祭亡妹歌) …
--     · 줄표 글자  — 지상의 방 한 칸 `-` 박영한 … / `–`(U+2013) 박영한 … (김사인 작품은
--                    부제 때문이 아니라 이것 때문에 갈렸다), 동해 바다 - / – 후포에서
--
-- 그래서 두 층으로 막는다:
--   1) **줄표는 표기 자체를 `-` 로 맞춘다** — 글자만 다르고 뜻은 같다(§1).
--   2) **띄어쓰기·한자 괄호는 표기를 두고 '비교 열쇠' 로만 무시한다**(§2). 표기는 사람이
--      읽는 값이라 공백을 다 지울 수는 없다. 대신 열쇠가 같은 제목은 **표준 표기 대장**
--      (`exam.work_title_canon`, §3)의 한 표기로 저장한다. 대장에 없던 열쇠는 처음 들어온
--      표기가 표준이 된다 — 그래서 적재 스크립트·앱 OCR·검수 편집기 어디로 들어와도
--      이미 있는 표기에 붙는다(§4 트리거).
--
-- ⚠️ **해독은 따로 남는다.** `제망매가(김완진 해독)`·`찬기파랑가(양주동 해독)` 은 괄호 안에
--    **한글**이 있어 열쇠가 지우지 않는다. 열쇠가 지우는 괄호는 안이 **한자·공백·가운뎃점·
--    쉼표뿐**인 것만이다 — 한 글자라도 한글이 섞이면 뜻이 있는 부제로 본다.
-- ⚠️ **표준 표기를 바꾸려면 대장 한 줄을 고치고 `SELECT exam.apply_work_title_canon();`** 을
--    부른다(§5). 검수 화면에서 한 지문만 다른 띄어쓰기로 고치면 트리거가 표준 표기로 되돌린다 —
--    그러지 않으면 갈래가 다시 생긴다.
-- ⚠️ 같은 제목의 **다른 작품**(거울/이상 · 거울/조은서)은 이 파일과 무관하다 — 원래 같은 문자열이라
--    합칠 것이 없다(작품 트리가 제목만으로 묶는 것은 따로 풀 문제다).
-- ⚠️ **멱등하다.** 두 번째 실행에서는 바꿀 행이 없다.
-- =============================================

-- ---------------------------------------------
-- 1. 표기 정규화 — 줄표 글자를 `-` 로 (sql/33 판을 다시 정의한다)
-- ---------------------------------------------
-- ⚠️ 앱의 `normalizeWorkTitle`(src/lib/problem-bank/work-title.ts)과 **글자 하나까지 같은**
--    집합이어야 한다: U+2010~2015(하이픈·줄표·가로줄), U+2212(빼기), U+FE58·FE63·FF0D(작은·전각).
--    한쪽만 바꾸면 앱이 보낸 값과 트리거가 옮긴 값이 갈라진다.
CREATE OR REPLACE FUNCTION exam.normalize_work_title(p_name TEXT)
RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE
  SET search_path = exam, pg_temp
AS $$
  SELECT exam.normalize_category_name(
    translate(
      regexp_replace(
        regexp_replace(COALESCE(p_name, ''),
          '^[「」『』〈〉《》＜＞<>“”‘’"''\u0009-\u000D    -     　﻿]+', ''),
        '[「」『』〈〉《》＜＞<>“”‘’"''\u0009-\u000D    -     　﻿]+$', ''
      ),
      U&'\2010\2011\2012\2013\2014\2015\2212\FE58\FE63\FF0D', '----------'
    )
  );
$$;

COMMENT ON FUNCTION exam.normalize_work_title(TEXT) IS
  '작품명·지은이 표기 정규화(감싼 기호·줄표 글자). 앱의 src/lib/problem-bank/work-title.ts 와 1:1 로 같은 규칙이어야 한다';

-- ---------------------------------------------
-- 2. 비교 열쇠 — 띄어쓰기·한자 괄호를 무시한다
-- ---------------------------------------------
-- 앱의 `workTitleKey` 와 1:1 거울이다. 한자 범위: CJK 통합(4E00~9FFF)·확장 A(3400~4DBF)·
-- 호환(F900~FAFF). 공백류는 sql/33 과 같은 집합이다(Postgres 의 `\s` 는 ASCII 만 잡는다).
CREATE OR REPLACE FUNCTION exam.work_title_key(p_title TEXT)
RETURNS TEXT
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT regexp_replace(
    regexp_replace(
      exam.normalize_work_title(p_title),
      '\([㐀-䶿一-鿿豈-﫿·,\u0009-\u000D    -     　﻿]+\)',
      '', 'g'),
    '[\u0009-\u000D    -     　﻿]', '', 'g');
$$;

COMMENT ON FUNCTION exam.work_title_key(TEXT) IS
  '작품명 비교 열쇠 — 공백과 한자만 든 괄호를 지운다. 앱의 workTitleKey 와 같은 규칙';

-- ---------------------------------------------
-- 3. 표준 표기 대장
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.work_title_canon (
  key        TEXT PRIMARY KEY CHECK (key <> ''),
  title      TEXT NOT NULL CHECK (btrim(title) <> ''),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 표준 표기는 제 열쇠를 가져야 한다 — 아니면 그 표기로 저장된 값이 또 다른 줄을 찾는다
  CONSTRAINT work_title_canon_key_matches CHECK (exam.work_title_key(title) = key)
);

COMMENT ON TABLE exam.work_title_canon IS
  '작품명 표준 표기 — 열쇠(exam.work_title_key)가 같은 제목은 이 표기로 저장된다. 고친 뒤 exam.apply_work_title_canon() 을 부른다';

-- 읽기는 누구나(검수 화면이 나중에 쓸 수 있다), 쓰기는 아래 등록 함수와 관리자 SQL 로만
ALTER TABLE exam.work_title_canon ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read work_title_canon" ON exam.work_title_canon;
-- 도메인 조건은 문제 은행 표들(sql/17)과 같은 모양이다 — 새 공유 표 정책에는 반드시 붙인다
CREATE POLICY "Authenticated users can read work_title_canon" ON exam.work_title_canon
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated' AND exam.is_allowed_domain());
-- ⚠️ exam 스키마의 기본 권한이 새 표에 쓰기까지 준다 — RLS 에 쓰기 정책이 없어 막히기는 하지만,
--    정책 하나가 잘못 더해지는 날 대장이 열리지 않게 권한에서도 걷는다
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON exam.work_title_canon FROM authenticated, anon;
GRANT SELECT ON exam.work_title_canon TO authenticated;
GRANT ALL ON exam.work_title_canon TO service_role;

/**
 * 처음 보는 열쇠를 대장에 올린다 — 먼저 들어온 표기가 표준이 된다.
 *
 * ⚠️ SECURITY DEFINER 다: 트리거는 저장하는 사람의 권한으로 도는데, 대장 쓰기를 그 사람에게
 *    열어 두면 아무 줄이나 고칠 수 있다. 이 함수는 **없던 열쇠를 더하기만** 한다.
 * ⚠️ **트리거 안에서만 받는다**(코덱스 1R). 먼저 온 표기가 이기므로, RPC 로 직접 불러 아직 없는
 *    열쇠를 엉뚱한 표기로 선점하면 그 뒤 올라오는 시험지가 전부 그 표기로 저장된다. 트리거 밖
 *    호출은 JWT 없는 직접 접속(관리 SQL·적재 스크립트)과 service_role 만 허락한다. 그리고
 *    DEFINER 라 RLS 를 건너뛰므로 **도메인 조건도 여기서 직접** 본다(CLAUDE.md 의 DEFINER 규약).
 */
CREATE OR REPLACE FUNCTION exam.register_work_titles(p_titles TEXT[])
RETURNS VOID
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = exam, pg_temp
AS $$
DECLARE
  v_role TEXT := auth.role();
BEGIN
  IF v_role = 'authenticated' AND NOT exam.is_allowed_domain() THEN
    RAISE EXCEPTION 'work title registry: domain not allowed' USING ERRCODE = '42501';
  END IF;
  IF pg_trigger_depth() = 0 AND v_role IS NOT NULL AND v_role <> 'service_role' THEN
    RAISE EXCEPTION 'work title registry: only via triggers' USING ERRCODE = '42501';
  END IF;

  INSERT INTO exam.work_title_canon (key, title)
  SELECT DISTINCT ON (k) k, t
    FROM (
      SELECT exam.work_title_key(u.t) AS k, exam.normalize_work_title(u.t) AS t, u.ord
        FROM unnest(COALESCE(p_titles, '{}'::TEXT[])) WITH ORDINALITY AS u(t, ord)
    ) x
   WHERE k <> ''
   ORDER BY k, ord
  ON CONFLICT (key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION exam.register_work_titles(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.register_work_titles(TEXT[]) TO authenticated, service_role;

/** 표준 표기 — 대장에 없으면 받은 그대로 */
CREATE OR REPLACE FUNCTION exam.canonical_work_title(p_title TEXT)
RETURNS TEXT
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT c.title FROM exam.work_title_canon c WHERE c.key = exam.work_title_key(p_title)),
    p_title);
$$;

/** 작품명 배열을 표준 표기로 — 바꾼 뒤 겹친 제목은 첫 것만 남긴다 */
CREATE OR REPLACE FUNCTION exam.canonicalize_work_titles(p_titles TEXT[])
RETURNS TEXT[]
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  SELECT exam.normalize_work_titles(ARRAY(
    SELECT exam.canonical_work_title(u.t)
      FROM unnest(exam.normalize_work_titles(p_titles)) WITH ORDINALITY AS u(t, ord)
     ORDER BY u.ord));
$$;

/**
 * 지문 작품 목록을 표준 표기로 — 구분 표시·지은이는 그대로 물려준다.
 * 바꾼 뒤 한 지문에 같은 제목이 둘 생기면 `normalize_works` 가 첫 줄만 남긴다.
 */
CREATE OR REPLACE FUNCTION exam.canonicalize_works(p_works JSONB)
RETURNS JSONB
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  SELECT exam.normalize_works(COALESCE(jsonb_agg(
           jsonb_set(a.e, '{title}', to_jsonb(exam.canonical_work_title(a.e->>'title')))
           ORDER BY a.ord), '[]'::jsonb))
    FROM jsonb_array_elements(exam.normalize_works(p_works)) WITH ORDINALITY AS a(e, ord);
$$;

-- ---------------------------------------------
-- 4. 트리거 — 어디로 들어와도 표준 표기로 저장한다
-- ---------------------------------------------
-- ⚠️ 이름의 `aa_works_c_` 는 의도적이다: 트리거는 이름순으로 돈다. `_a`(목록 정규화)·`_b`
--    (문자열 경로)가 확정한 목록을 받아 표준 표기로 바꾸고, 감사(`audit_*`)·검색 평문
--    (`problems_search_text`)은 그 뒤에 확정된 값을 본다.
-- ⚠️ 컬럼 목록 없이 건다 — 문자열 경로(`SET title = …`)에서는 `_b` 가 works 를 다시 만드는데
--    `UPDATE OF works` 로 두면 그때 안 돈다(sql/33 §5 와 같은 까닭). 대신 안에서 변화를 본다.
CREATE OR REPLACE FUNCTION exam.passages_works_canon() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.works IS NOT DISTINCT FROM OLD.works THEN
    RETURN NEW;
  END IF;

  PERFORM exam.register_work_titles(exam.works_titles(NEW.works));
  NEW.works  := exam.canonicalize_works(NEW.works);
  NEW.title  := array_to_string(exam.works_titles(NEW.works), ' · ');
  NEW.author := exam.works_authors(NEW.works);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_works_c_canon_passages ON exam.passages;
CREATE TRIGGER aa_works_c_canon_passages
  BEFORE INSERT OR UPDATE ON exam.passages
  FOR EACH ROW EXECUTE FUNCTION exam.passages_works_canon();

CREATE OR REPLACE FUNCTION exam.problems_works_canon() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.work_titles IS NOT DISTINCT FROM OLD.work_titles THEN
    RETURN NEW;
  END IF;

  PERFORM exam.register_work_titles(NEW.work_titles);
  NEW.work_titles := exam.canonicalize_work_titles(NEW.work_titles);
  NEW.work_title  := array_to_string(NEW.work_titles, ' · ');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_works_c_canon_problems ON exam.problems;
CREATE TRIGGER aa_works_c_canon_problems
  BEFORE INSERT OR UPDATE ON exam.problems
  FOR EACH ROW EXECUTE FUNCTION exam.problems_works_canon();

-- ---------------------------------------------
-- 5. 대장을 고친 뒤 다시 입히기
-- ---------------------------------------------
/**
 * 대장과 어긋난 지문·문항을 표준 표기로 다시 쓴다.
 *
 * 지문만 고치면 딸린 문항은 `passages_sync_work_titles` 가 자리 기준으로 따라온다. 그 뒤에도
 * 어긋난 문항(지문 없는 문항, 좁혀 적은 문항)을 따로 맞춘다.
 * ⚠️ 달라진 행만 건드린다 — 아니면 열어 둔 검수 탭이 아무도 안 고쳤는데 충돌로 튕긴다.
 * @returns 고친 지문 수·문항 수
 */
CREATE OR REPLACE FUNCTION exam.apply_work_title_canon(OUT passages_fixed INT, OUT problems_fixed INT)
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  UPDATE exam.passages p
     SET works = exam.canonicalize_works(p.works)
   WHERE p.works IS DISTINCT FROM exam.canonicalize_works(p.works);
  GET DIAGNOSTICS passages_fixed = ROW_COUNT;

  UPDATE exam.problems q
     SET work_titles = exam.canonicalize_work_titles(q.work_titles)
   WHERE q.work_titles IS DISTINCT FROM exam.canonicalize_work_titles(q.work_titles);
  GET DIAGNOSTICS problems_fixed = ROW_COUNT;
END;
$$;

REVOKE ALL ON FUNCTION exam.apply_work_title_canon() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION exam.apply_work_title_canon() TO service_role;

-- ---------------------------------------------
-- 6. 지금 있는 갈래 합치기 (한 번)
-- ---------------------------------------------
-- 대장을 지금 데이터로 채운다. 한 열쇠에 표기가 여럿이면:
--   ① 한자 괄호가 없는 쪽 — 한자는 시험지마다 붙였다 뗐다 한다(9쌍 중 8쌍이 없는 쪽이 다수)
--   ② 지문에 더 많이 실린 쪽 — 엄마 걱정(13) > 엄마걱정(1)
--   ③ 그래도 같으면 아래 못박은 표기:
--      · 주몽신화            — 교과서 목록(docs/textbook-works.tsv, 교학사)이 붙여 쓴다
--      · 그 복숭아나무 곁으로 — '복숭아나무' 는 한 낱말이다(표준국어대사전)
-- ⚠️ 이미 있는 대장 줄은 건드리지 않는다(ON CONFLICT DO NOTHING) — 다시 돌려도 사람이 고친
--    표준 표기를 덮지 않는다.
WITH used AS (
  SELECT exam.normalize_work_title(w->>'title') AS title, count(*) AS n
    FROM exam.passages p, jsonb_array_elements(p.works) w
   GROUP BY 1
  UNION ALL
  SELECT exam.normalize_work_title(u), 0
    FROM exam.problems q, unnest(q.work_titles) u
), tallied AS (
  SELECT title, sum(n) AS n FROM used WHERE title <> '' GROUP BY title
), pinned(title) AS (
  VALUES ('주몽신화'), ('그 복숭아나무 곁으로')
)
INSERT INTO exam.work_title_canon (key, title)
SELECT DISTINCT ON (exam.work_title_key(t.title)) exam.work_title_key(t.title), t.title
  FROM tallied t
 WHERE exam.work_title_key(t.title) <> ''
 ORDER BY exam.work_title_key(t.title),
          (t.title <> exam.normalize_work_title(regexp_replace(t.title,
             '\([㐀-䶿一-鿿豈-﫿·, ]+\)', '', 'g'))),  -- ① 한자 괄호 없는 쪽 먼저
          t.n DESC,                                                             -- ②
          (t.title IN (SELECT title FROM pinned)) DESC,                         -- ③
          t.title
ON CONFLICT (key) DO NOTHING;

DO $apply$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r FROM exam.apply_work_title_canon();
  RAISE NOTICE '표준 표기 적용: 지문 % 건 · 문항 % 건', r.passages_fixed, r.problems_fixed;
END;
$apply$;
