-- =============================================
-- 52. 기출 문제 은행 — 작품명 정리 도우미 (합치기·가르기·대표 표기를 한 줄로)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/52_problem_bank_work_title_helpers.sql
-- =============================================
-- sql/51 의 exam.work_title_suspects() 가 닮은 쌍을 찾으면 사람이 이 셋 가운데 하나로 정한다:
--   같은 작품(글자가 다름)  → SELECT * FROM exam.alias_work_title('새 표기', '대표 표기');
--   다른 작품               → SELECT exam.mark_work_titles_distinct('가', '나', '까닭');
--   대표 표기만 바꾸기       → SELECT * FROM exam.set_canonical_work_title('표기');   (열쇠가 같을 때)
-- 셋 다 대장·동의어를 고친 뒤 exam.apply_work_title_canon() 까지 해서 지문·문항이 바로 따라온다
-- (지문·문항을 전부 훑으므로 한 번에 8초쯤 걸린다). sql/47 의 DO 블록이 손으로 하던 일을 함수로 뺐다.
-- ⚠️ 관리 SQL(postgres)·service_role 전용 — authenticated 는 대장·동의어에 쓰기 권한이 없다(sql/46).
-- ⚠️ 쌍을 정하기 전에 **지문 본문을 열어 볼 것**(sql/47 의 「배를 매며」·「배를 밀며」).
-- ⚠️ 멱등하다.
-- =============================================

/**
 * 대표 표기를 정한다(열쇠가 같은 표기끼리). 옛 글자 제목을 현대 글자로 바꾸는 데 쓴다 —
 * 열쇠가 같으니 대장 표기만 고치면 지문·문항이 따라온다.
 */
CREATE OR REPLACE FUNCTION exam.set_canonical_work_title(p_title TEXT,
  OUT passages_fixed INT, OUT problems_fixed INT)
  LANGUAGE plpgsql SET search_path = exam, pg_temp
AS $$
DECLARE
  v_title TEXT := exam.normalize_work_title(p_title);
  v_key   TEXT := exam.work_title_key(p_title);
BEGIN
  IF v_key = '' THEN RAISE EXCEPTION '빈 작품명'; END IF;
  IF EXISTS (SELECT 1 FROM exam.work_title_alias WHERE alias_key = v_key) THEN
    RAISE EXCEPTION '「%」 은 다른 작품의 동의어다 — 대표로 쓰려면 동의어부터 지울 것', v_title;
  END IF;
  INSERT INTO exam.work_title_canon (key, title) VALUES (v_key, v_title)
  ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, updated_at = now()
    WHERE exam.work_title_canon.title IS DISTINCT FROM EXCLUDED.title;
  SELECT r.passages_fixed, r.problems_fixed INTO passages_fixed, problems_fixed
    FROM exam.apply_work_title_canon() r;
END;
$$;

/**
 * 글자가 다른 같은 작품을 묶는다 — 별칭을 대표의 동의어로 걸고 다시 입힌다.
 * 별칭이 대장 줄이었으면(그 표기로 쌓인 지문이 있었으면) 그 줄을 가리키던 동의어까지 대표로 옮기고 지운다.
 */
CREATE OR REPLACE FUNCTION exam.alias_work_title(p_alias TEXT, p_canon TEXT,
  OUT passages_fixed INT, OUT problems_fixed INT)
  LANGUAGE plpgsql SET search_path = exam, pg_temp
AS $$
DECLARE
  v_alias TEXT := exam.work_title_key(p_alias);
  v_title TEXT := exam.normalize_work_title(p_canon);
  v_canon TEXT := exam.work_title_key(p_canon);
BEGIN
  IF v_alias = '' OR v_canon = '' THEN RAISE EXCEPTION '빈 작품명'; END IF;
  IF v_alias = v_canon THEN
    RAISE EXCEPTION '「%」·「%」 은 이미 열쇠가 같다 — exam.set_canonical_work_title 로 표기만 정할 것',
      p_alias, p_canon;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.work_title_alias WHERE alias_key = v_canon) THEN
    RAISE EXCEPTION '대표로 고른 「%」 이 이미 다른 작품의 동의어다 — 그 작품을 대표로 고를 것', v_title;
  END IF;

  INSERT INTO exam.work_title_canon (key, title) VALUES (v_canon, v_title)
  ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, updated_at = now()
    WHERE exam.work_title_canon.title IS DISTINCT FROM EXCLUDED.title;
  UPDATE exam.work_title_alias SET canon_key = v_canon WHERE canon_key = v_alias;
  INSERT INTO exam.work_title_alias (alias_key, canon_key) VALUES (v_alias, v_canon)
  ON CONFLICT (alias_key) DO UPDATE SET canon_key = EXCLUDED.canon_key;
  -- 동의어 열쇠는 대장 줄을 갖지 않는다(sql/47) — 가지면 동의어를 지웠을 때 옛 표기가 되살아난다
  DELETE FROM exam.work_title_canon WHERE key = v_alias;
  DELETE FROM exam.work_title_distinct
   WHERE key_a = least(v_alias, v_canon) AND key_b = greatest(v_alias, v_canon);

  SELECT r.passages_fixed, r.problems_fixed INTO passages_fixed, problems_fixed
    FROM exam.apply_work_title_canon() r;
END;
$$;

/** 닮았지만 다른 작품이라고 적어 둔다 — 닮은 쌍 점검이 다시 묻지 않는다 */
CREATE OR REPLACE FUNCTION exam.mark_work_titles_distinct(p_a TEXT, p_b TEXT, p_note TEXT DEFAULT '')
RETURNS VOID
  LANGUAGE plpgsql SET search_path = exam, pg_temp
AS $$
DECLARE
  ka TEXT := exam.work_title_key(p_a);
  kb TEXT := exam.work_title_key(p_b);
BEGIN
  IF ka = '' OR kb = '' OR ka = kb THEN
    RAISE EXCEPTION '다른 작품으로 적을 수 없는 쌍: 「%」·「%」', p_a, p_b;
  END IF;
  INSERT INTO exam.work_title_distinct (key_a, key_b, note)
  VALUES (least(ka, kb), greatest(ka, kb), COALESCE(p_note, ''))
  ON CONFLICT (key_a, key_b) DO UPDATE SET note = EXCLUDED.note
    WHERE exam.work_title_distinct.note IS DISTINCT FROM EXCLUDED.note;
END;
$$;

REVOKE ALL ON FUNCTION exam.set_canonical_work_title(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION exam.alias_work_title(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION exam.mark_work_titles_distinct(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION exam.set_canonical_work_title(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION exam.alias_work_title(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION exam.mark_work_titles_distinct(TEXT, TEXT, TEXT) TO service_role;
