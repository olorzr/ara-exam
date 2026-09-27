-- =============================================
-- 51. 기출 문제 은행 — 닮은 작품명을 찾아낸다 (합치고 가르는 도우미는 sql/52)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/51_problem_bank_work_title_suspects.sql
-- =============================================
-- 배경: sql/50 이 **같은 낱말을 다른 글자로** 적은 갈래는 기계로 접었다. 남는 것은 기계가 확실히
--   판단할 수 없는 갈래다 — 낱말이 다르거나(두꺼비↔두터비) 앞부분만 같다(홍서봉 「이별하던 날에」
--   ↔ 「이별하던 날에 피눈물이 난지 만지」). 이것을 자동으로 합치면 「배를 매며」·「배를 밀며」처럼
--   **한 지문에 함께 실린 다른 시**까지 합친다(sql/47). 그래서 합치지 않고 **찾아내기만** 한다:
--     · exam.work_title_suspects()             — 지금 쌓인 작품 가운데 닮은 쌍 전부
--     · exam.work_title_suspects_for(제목, 지은이) — 새로 들어올 이름 하나가 닮은 기존 작품
--   적재 스크립트(~/.claude/tools/ingest-exam.js)가 이 둘로 **닮은 쌍이 남으면 적재를 멈춘다.**
--   사람이 보고 exam.alias_work_title(같은 작품) 이나 exam.mark_work_titles_distinct(다른 작품)로
--   정하면 끝난다(둘 다 sql/52). 앱으로 올라온 시험지가 만든 쌍도 다음 적재에서 걸린다.
--
-- ⚠️ 불변식: **work_title_suspects() 는 늘 0건이다**(sql/53 이 0건으로 맞춰 두었다). 1건이라도 있으면
--    누군가 새 갈래를 만든 것이다.
-- ⚠️ 닮음 규칙은 work_titles_look_alike 한 곳이다 — 두 조회가 따로 규칙을 들면 적재 때는 통과하고
--    전체 점검에서만 걸리는 이름이 생긴다.
-- ⚠️ 멱등하다.
-- =============================================

-- ---------------------------------------------
-- 1. 확인한 '다른 작품' 쌍
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.work_title_distinct (
  key_a      TEXT NOT NULL,
  key_b      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key_a, key_b),
  -- 한 쌍은 한 줄 — 늘 작은 열쇠가 앞이다
  CONSTRAINT work_title_distinct_ordered CHECK (key_a < key_b AND key_a <> '')
);

COMMENT ON TABLE exam.work_title_distinct IS
  '닮았지만 다른 작품으로 확인한 작품명 쌍(열쇠). exam.work_title_suspects() 가 이 쌍을 건너뛴다';

ALTER TABLE exam.work_title_distinct ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read work_title_distinct" ON exam.work_title_distinct;
CREATE POLICY "Authenticated users can read work_title_distinct" ON exam.work_title_distinct
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated' AND exam.is_allowed_domain());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON exam.work_title_distinct FROM authenticated, anon;
GRANT SELECT ON exam.work_title_distinct TO authenticated;
GRANT ALL ON exam.work_title_distinct TO service_role;

-- ---------------------------------------------
-- 2. 닮음 규칙
-- ---------------------------------------------
/**
 * 글자 단위 편집 거리 — p_max 를 넘으면 p_max + 1 에서 멈춘다.
 * 확장(fuzzystrmatch)을 공유 DB 에 새로 깔지 않으려고 직접 둔다. 열쇠는 짧아(대개 20자 안) 충분하다.
 */
CREATE OR REPLACE FUNCTION exam.text_edit_distance(p_a TEXT, p_b TEXT, p_max INT)
RETURNS INT
  LANGUAGE plpgsql IMMUTABLE SET search_path = exam, pg_temp
AS $$
DECLARE
  a    TEXT[] := regexp_split_to_array(COALESCE(p_a, ''), '');
  b    TEXT[] := regexp_split_to_array(COALESCE(p_b, ''), '');
  la   INT := char_length(COALESCE(p_a, ''));
  lb   INT := char_length(COALESCE(p_b, ''));
  prev INT[];
  cur  INT[];
  i    INT;
  j    INT;
  best INT;
BEGIN
  IF abs(la - lb) > p_max THEN RETURN p_max + 1; END IF;
  IF la = 0 OR lb = 0 THEN RETURN greatest(la, lb); END IF;
  prev := ARRAY(SELECT generate_series(0, lb));
  FOR i IN 1 .. la LOOP
    cur := ARRAY[i];
    best := i;
    FOR j IN 1 .. lb LOOP
      cur := cur || least(prev[j + 1] + 1, cur[j] + 1,
                          prev[j] + CASE WHEN a[i] = b[j] THEN 0 ELSE 1 END);
      best := least(best, cur[j + 1]);
    END LOOP;
    IF best > p_max THEN RETURN p_max + 1; END IF;
    prev := cur;
  END LOOP;
  RETURN least(prev[lb + 1], p_max + 1);
END;
$$;

/**
 * 두 열쇠가 같은 작품의 다른 표기로 보이는가 — 보이면 까닭, 아니면 NULL.
 *
 *  ① 짧은 쪽(3자 이상)이 긴 쪽의 **앞부분** — 시조 제목은 시험지마다 초장을 다른 데서 끊는다
 *  ② 글자 편집 거리 1 이하(긴 쪽이 8자 이상이면 2 이하) — 두꺼비↔두터비, 한 글자 오기
 * 지은이 비교는 부르는 쪽이 한다(여기는 열쇠만 본다). 3자 미만은 보지 않는다 — '봄'·'벼'·'고향'
 * 같은 짧은 제목은 거의 모든 것과 닮아 경고 전체를 못 믿게 만든다.
 */
CREATE OR REPLACE FUNCTION exam.work_titles_look_alike(p_a TEXT, p_b TEXT)
RETURNS TEXT
  LANGUAGE plpgsql IMMUTABLE SET search_path = exam, pg_temp
AS $$
DECLARE
  la  INT := char_length(COALESCE(p_a, ''));
  lb  INT := char_length(COALESCE(p_b, ''));
  lim INT := CASE WHEN greatest(la, lb) >= 8 THEN 2 ELSE 1 END;
  d   INT;
BEGIN
  IF p_a IS NULL OR p_b IS NULL OR p_a = p_b OR least(la, lb) < 3 THEN
    RETURN NULL;
  END IF;
  IF starts_with(p_a, p_b) OR starts_with(p_b, p_a) THEN
    RETURN '앞부분이 같다';
  END IF;
  d := exam.text_edit_distance(p_a, p_b, lim);
  IF d <= lim THEN
    RETURN format('%s글자 다르다', d);
  END IF;
  RETURN NULL;
END;
$$;

/**
 * 지금 쓰이는 작품 — 열쇠마다 대표 표기·쓰인 수·가장 많이 쓰인 지은이(보여 주기용)·**지은이 표기 전부**
 * (견주기용 — 가장 많은 것 하나만 견주면 드문 표기(`알퐁스 도데(한정영 옮김)`)로 들어온 닮은 제목이
 * 빠져나간다, 코덱스 4R).
 * 문항에만 있는 제목은 지은이가 없다(빈칸). 대장에만 있고 아무도 안 쓰는 줄은 트리에 안 뜨니 뺀다.
 */
-- ⚠️ 돌려주는 열이 바뀐 적이 있어(authors 추가, 코덱스 4R) CREATE OR REPLACE 로는 못 고친다 — 지우고 만든다
DROP FUNCTION IF EXISTS exam.work_title_match_keys();
DROP FUNCTION IF EXISTS exam.work_titles_in_use();
CREATE FUNCTION exam.work_titles_in_use()
RETURNS TABLE (key TEXT, title TEXT, author TEXT, authors TEXT[], uses BIGINT)
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  WITH w AS (
    SELECT exam.work_title_key(e->>'title') AS key, e->>'title' AS title,
           exam.canonical_work_author(COALESCE(e->>'author', '')) AS author
      FROM exam.passages p, jsonb_array_elements(p.works) e
    UNION ALL
    SELECT exam.work_title_key(u), u, ''
      FROM exam.problems q, unnest(q.work_titles) u
  ), titles AS (
    SELECT w.key, min(w.title) AS title, count(*) AS uses FROM w WHERE w.key <> '' GROUP BY w.key
  ), top_author AS (
    SELECT DISTINCT ON (w.key) w.key, w.author
      FROM w WHERE w.author <> ''
     GROUP BY w.key, w.author
     ORDER BY w.key, count(*) DESC, w.author
  ), all_authors AS (
    SELECT w.key, array_agg(DISTINCT w.author ORDER BY w.author) AS authors
      FROM w WHERE w.author <> '' GROUP BY w.key
  )
  SELECT t.key, COALESCE(c.title, t.title), COALESCE(ta.author, ''), COALESCE(aa.authors, '{}'), t.uses
    FROM titles t
    LEFT JOIN exam.work_title_canon c ON c.key = t.key
    LEFT JOIN top_author ta ON ta.key = t.key
    LEFT JOIN all_authors aa ON aa.key = t.key;
$$;
/**
 * 견줄 열쇠 — 쓰이는 작품의 열쇠 + **알려진 동의어의 열쇠**(가리키는 대표 작품을 달고).
 *
 * 새 표기는 대표보다 이미 본 다른 표기에 더 가까울 수 있다(`두꺼비 …` 계열은 대표 `두터비 …` 보다
 * 동의어 `두꺼비 …` 에 가깝다). 대표만 견주면 그 표기가 닮은 쌍 점검을 빠져나가 영영 남는다(코덱스 1R).
 * 두 조회(전체·하나)가 **이 한 목록**을 쓴다 — 따로 들면 적재 때는 걸리는데 전체 점검은 통과하는 이름이 생긴다.
 */
CREATE FUNCTION exam.work_title_match_keys()
RETURNS TABLE (match_key TEXT, canon_key TEXT, title TEXT, author TEXT, authors TEXT[], uses BIGINT)
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  WITH u AS (SELECT * FROM exam.work_titles_in_use())
  SELECT u.key, u.key, u.title, u.author, u.authors, u.uses FROM u
  UNION ALL
  SELECT a.alias_key, u.key, u.title, u.author, u.authors, u.uses
    FROM exam.work_title_alias a JOIN u ON u.key = a.canon_key;
$$;

-- ---------------------------------------------
-- 3. 닮은 쌍 찾기
-- ---------------------------------------------
/**
 * 쓰이는 작품 가운데 닮은 쌍 전부(작품 쌍마다 한 줄). **지은이 표기가 하나라도 겹치거나 한쪽이 비었을 때**만 본다 —
 * 지은이가 다르면 제목이 닮아도 다른 작품이다(「고향」 백석 ↔ 「고향」 정지용).
 * 양쪽 다 **대표와 동의어를 모두** 견준다(대표↔대표·대표↔동의어·동의어↔동의어, 코덱스 1R·3R) —
 * 두 작품의 동의어끼리만 닮아도 그 표기는 어느 쪽인지 모호하다.
 */
CREATE OR REPLACE FUNCTION exam.work_title_suspects()
RETURNS TABLE (title_a TEXT, title_b TEXT, author TEXT, reason TEXT, uses_a BIGINT, uses_b BIGINT,
               key_a TEXT, key_b TEXT)
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  WITH m AS (
    SELECT * FROM exam.work_title_match_keys()
  ), pairs AS (
    SELECT DISTINCT ON (a.canon_key, b.canon_key) a.canon_key AS ka, b.canon_key AS kb, r.reason
      FROM m a
      JOIN m b ON a.canon_key < b.canon_key
       AND (a.authors = '{}' OR b.authors = '{}' OR a.authors && b.authors)
      CROSS JOIN LATERAL (SELECT exam.work_titles_look_alike(a.match_key, b.match_key) AS reason) r
     WHERE r.reason IS NOT NULL
     ORDER BY a.canon_key, b.canon_key, r.reason
  ), u AS (
    SELECT * FROM exam.work_titles_in_use()
  )
  SELECT ua.title, ub.title, COALESCE(NULLIF(ua.author, ''), ub.author), p.reason, ua.uses, ub.uses,
         p.ka, p.kb
    FROM pairs p
    JOIN u ua ON ua.key = p.ka
    JOIN u ub ON ub.key = p.kb
   WHERE NOT EXISTS (SELECT 1 FROM exam.work_title_distinct d WHERE d.key_a = p.ka AND d.key_b = p.kb)
   ORDER BY 3, 1, 2;
$$;

/**
 * 새로 들어올 작품명 하나가 닮은 기존 작품. 이미 있는 작품(열쇠·동의어가 맞는다)이면 빈 결과다 —
 * 그 이름은 트리거가 대표 표기로 바꿔 넣는다. 동의어와 닮았으면 그 동의어가 가리키는 대표를 알려 준다.
 */
CREATE OR REPLACE FUNCTION exam.work_title_suspects_for(p_title TEXT, p_author TEXT DEFAULT '')
RETURNS TABLE (title TEXT, author TEXT, reason TEXT, uses BIGINT)
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  WITH k AS (
    SELECT exam.work_title_key(p_title) AS key,
           exam.canonical_work_author(exam.normalize_work_title(COALESCE(p_author, ''))) AS author
  )
  SELECT DISTINCT ON (x.uses, x.title) x.title, x.author, x.reason, x.uses
    FROM (
      SELECT m.title, m.author, r.reason, m.uses
        FROM k
        JOIN exam.work_title_match_keys() m ON m.match_key <> k.key
         AND (k.author = '' OR m.authors = '{}' OR k.author = ANY (m.authors))
        CROSS JOIN LATERAL (SELECT exam.work_titles_look_alike(k.key, m.match_key) AS reason) r
       WHERE k.key <> ''
         AND r.reason IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM exam.work_title_canon w WHERE w.key = k.key)
         AND NOT EXISTS (SELECT 1 FROM exam.work_title_alias a WHERE a.alias_key = k.key)
         AND NOT EXISTS (SELECT 1 FROM exam.work_title_distinct d
                          WHERE d.key_a = least(k.key, m.canon_key) AND d.key_b = greatest(k.key, m.canon_key))
    ) x
   ORDER BY x.uses DESC, x.title;
$$;

REVOKE ALL ON FUNCTION exam.work_titles_in_use() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION exam.work_title_match_keys() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION exam.work_title_suspects() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION exam.work_title_suspects_for(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.work_titles_in_use() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION exam.work_title_match_keys() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION exam.work_title_suspects() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION exam.work_title_suspects_for(TEXT, TEXT) TO authenticated, service_role;
