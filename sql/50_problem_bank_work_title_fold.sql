-- =============================================
-- 50. 기출 문제 은행 — 옛 글자·끝 문장부호로 갈린 작품명을 비교 열쇠에서 접는다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/50_problem_bank_work_title_fold.sql
-- =============================================
-- 배경 (2026-09-27, 제보 "여전히 문학 이름이 중복된 게 많아. 황진이 동짓달… 이것도 많고.. 두꺼비도 많고..
--   다 찾아서 하나로 바꿔 주고 재발하지 않도록 해 줄래?"):
--   sql/46 의 열쇠는 띄어쓰기·한자 괄호·줄표만 무시한다. 운영 DB 에 남은 갈래를 세어 보니
--   **글자는 같은데 옛 글자로 적었거나**(시조 제목) **끝에 물음표가 붙은** 것이 절반이었다:
--     · 동지ㅅᄃᆞᆯ 기나긴 밤을 / 동지ㅅ달 기나긴 밤을 / 동짓달 기나긴 밤을   (황진이)
--     · 두터비 ᄑᆞ리를 물고 / 두터비 파리를 물고                           (작자 미상)
--     · ᄆᆞ음이 어린 후ㅣ니 / 마음이 어린 후이니                           (서경덕)
--     · 정전기가 겨울로 간 까닭은 / 정전기가 겨울로 간 까닭은?             (김정훈)
--   이것은 **같은 낱말을 다른 글자로** 적은 것이라 기계가 확실히 접을 수 있다(§1). 낱말 자체가
--   다른 갈래(두꺼비↔두터비, 앞부분만 같은 제목)는 여기서 접지 않고 sql/51 이 찾아내 사람이 정한다.
--
-- ⚠️ **표기가 아니라 열쇠만 접는다.** 아래아(ᆞ)를 표기에서 ㅏ 로 일괄 바꾸면 `ᄆᆞᄋᆞᆷ` 이 `마암` 이
--    된다(둘째 음절 아래아는 ㅡ 로 바뀌었다). 열쇠는 사람이 읽지 않으니 `마암` 이어도 되고, 표기는
--    대장(exam.work_title_canon)의 사람이 정한 값을 쓴다. 대표 표기 규칙은 CLAUDE.md 의 이 항목
--    (**원문 낱말 + 현대 글자, 초장 첫 두 음보**, 사용자 결정 2026-09-27)을 볼 것.
-- ⚠️ 앱의 `workTitleKey`(src/lib/problem-bank/work-title.ts)와 **1:1 거울**이다 — 한쪽만 바꾸지 말 것.
-- ⚠️ 멱등하다. 두 번째 실행에서는 다시 매길 열쇠도 고칠 지문도 없다.
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.work_title_canon') IS NULL OR to_regclass('exam.work_title_alias') IS NULL THEN
    RAISE EXCEPTION 'sql/46·47 이 먼저 적용돼 있어야 한다 (exam.work_title_canon / work_title_alias 없음)';
  END IF;
END;
$guard$;

-- ---------------------------------------------
-- 1. 옛 글자 접기 — 열쇠 문자열에만 쓴다
-- ---------------------------------------------
-- 차례가 뜻을 가진다:
--   ① NFD 로 풀어 음절을 자모로 만든다(`지` → ᄌ ᅵ) — 그래야 뒤에 오는 ㅅ 을 받침으로 붙일 수 있다
--   ② 아래아 ᆞ(U+119E) → ᅡ, ᆡ(U+11A1) → ᅢ, 방점(U+302E·302F)은 버린다
--   ③ 모음 자모 바로 뒤의 사이ㅅ(호환 자모 U+3145) → 받침 ㅅ(U+11BA): 동지ㅅ달 → 동짓달
--   ④ 자모 뒤에 홀로 선 ㅣ(호환 자모 U+3163) → '이': 후ㅣ니 → 후이니
--   ⑤ NFC 로 다시 모은다(ᄃ ᅡ ᆯ → 달). 옛 초성(ᄲ 등)은 모을 음절이 없어 자모로 남는다
--   ⑥ 끝에 붙은 ? ! . … (전각 포함)을 뗀다 — 같은 제목에 물음표만 붙였다 뗐다 한다
-- 코드포인트는 운영 제목에서 실측했다(2026-09-27): ㅅ·ㅣ 는 **호환 자모**로 들어와 있었다.
CREATE OR REPLACE FUNCTION exam.fold_work_title_key(p_key TEXT)
RETURNS TEXT
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT regexp_replace(
    normalize(
      regexp_replace(
        regexp_replace(
          translate(normalize(COALESCE(p_key, ''), NFD), E'\u119E\u11A1\u302E\u302F', E'\u1161\u1162'),
          E'([\u1161-\u11A7])\u3145', E'\\1\u11BA', 'g'),
        E'([\u1100-\u11FF])\u3163', E'\\1\uC774', 'g'),
      NFC),
    E'[?!.\u2026\uFF1F\uFF01\u3002\uFF0E]+$', '');
$$;

COMMENT ON FUNCTION exam.fold_work_title_key(TEXT) IS
  '작품명 열쇠의 옛 글자 접기(아래아·사이ㅅ·홀로 선 ㅣ·방점)와 끝 문장부호 떼기. 앱 foldWorkTitleKey 와 1:1';

-- ---------------------------------------------
-- 2. 비교 열쇠 — sql/46 판 + 접기
-- ---------------------------------------------
-- 앞 두 단계(한자 괄호·공백 지우기)는 sql/46 과 **같은 글자 집합**이다 — 거기서는 날글자로, 여기서는
-- E'' 이스케이프로 적었을 뿐이다(적용 뒤 운영 제목 전부로 옛 열쇠와 대조했다).
CREATE OR REPLACE FUNCTION exam.work_title_key(p_title TEXT)
RETURNS TEXT
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT exam.fold_work_title_key(
    regexp_replace(
      regexp_replace(
        exam.normalize_work_title(p_title),
        E'\\([\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u00B7,\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+\\)',
        '', 'g'),
      E'[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]', '', 'g'));
$$;

COMMENT ON FUNCTION exam.work_title_key(TEXT) IS
  '작품명 비교 열쇠 — 공백·한자 괄호를 지우고 옛 글자·끝 문장부호를 접는다. 앱의 workTitleKey 와 같은 규칙';

-- ---------------------------------------------
-- 3. 대장·동의어 열쇠 다시 매기기
-- ---------------------------------------------
-- 열쇠 함수가 바뀌었으니 저장된 열쇠를 새 규칙으로 옮긴다. ⚠️ CHECK(key = work_title_key(title))는
-- 함수를 바꿔도 **기존 행을 다시 검사하지 않는다** — 여기서 옮기지 않으면 조용히 어긋난 채 남는다.
-- 새 열쇠가 겹치는 줄은 하나만 남긴다:
--   ① 아래 못박은 표기(사용자 결정: 원문 낱말 + 현대 글자) ② 동의어가 가리키는 줄 ③ 지문에 더 많이
--   실린 줄 ④ 표기 가나다순. 진 줄을 가리키던 동의어는 이긴 줄로 먼저 옮긴다(FK).
DO $rekey$
DECLARE
  v_pins CONSTANT TEXT[] := ARRAY[
    '동짓달 기나긴 밤을', '두터비 파리를 물고', '마음이 어린 후이니', '정전기가 겨울로 간 까닭은'];
  r        RECORD;
  v_n      INT;
  v_bad    INT;
BEGIN
  CREATE TEMP TABLE _rekey ON COMMIT DROP AS
  WITH used AS (
    SELECT e->>'title' AS title, count(*) AS n
      FROM exam.passages p, jsonb_array_elements(p.works) e GROUP BY 1
  )
  SELECT c.key AS old_key, c.title, exam.work_title_key(c.title) AS new_key,
         row_number() OVER (
           PARTITION BY exam.work_title_key(c.title)
           ORDER BY (c.title = ANY (v_pins)) DESC,
                    EXISTS (SELECT 1 FROM exam.work_title_alias a WHERE a.canon_key = c.key) DESC,
                    COALESCE(u.n, 0) DESC, c.title) AS rank
    FROM exam.work_title_canon c
    LEFT JOIN used u ON u.title = c.title;

  -- 동의어부터 — **대장 열쇠를 바꾸기 전에** 한다(코덱스 2R). 접은 동의어 열쇠가 자기가 가리키는 작품의
  -- 새 열쇠와 같으면(`foo? → foo` 처럼) 이제 열쇠만으로 묶이니 지운다. 대장을 먼저 바꾸면 FK CASCADE 가
  -- canon_key 를 새 열쇠로 옮기는 순간 alias_key = canon_key 가 되어 work_title_alias_not_self 에 걸려
  -- 파일 전체가 멈춘다.
  DELETE FROM exam.work_title_alias a
   USING _rekey t
   WHERE t.old_key = a.canon_key AND exam.fold_work_title_key(a.alias_key) = t.new_key;
  IF EXISTS (
    SELECT 1 FROM exam.work_title_alias a JOIN _rekey t ON t.new_key = exam.fold_work_title_key(a.alias_key)
  ) THEN
    RAISE EXCEPTION '동의어 열쇠가 접히면서 다른 작품의 대장 열쇠와 같아졌다 — 손으로 정할 것';
  END IF;
  IF EXISTS (
    SELECT 1 FROM exam.work_title_alias a JOIN _rekey t ON t.old_key = a.canon_key
     GROUP BY exam.fold_work_title_key(a.alias_key) HAVING count(DISTINCT t.new_key) > 1
  ) THEN
    RAISE EXCEPTION '두 동의어가 한 열쇠로 접히는데 가리키는 작품이 다르다 — 손으로 정할 것';
  END IF;

  -- 진 줄 → 이긴 줄 (동의어 먼저 옮기고 지운다)
  FOR r IN
    SELECT l.old_key AS loser, w.old_key AS winner, l.title AS loser_title, w.title AS winner_title
      FROM _rekey l JOIN _rekey w ON w.new_key = l.new_key AND w.rank = 1
     WHERE l.rank > 1
  LOOP
    UPDATE exam.work_title_alias SET canon_key = r.winner WHERE canon_key = r.loser;
    DELETE FROM exam.work_title_canon WHERE key = r.loser;
    RAISE NOTICE '대장 합침: % → %', r.loser_title, r.winner_title;
  END LOOP;

  -- 남은 줄의 열쇠를 새 규칙으로 (FK ON UPDATE CASCADE 가 동의어의 canon_key 를 따라 옮긴다)
  UPDATE exam.work_title_canon c SET key = exam.work_title_key(c.title), updated_at = now()
   WHERE c.key IS DISTINCT FROM exam.work_title_key(c.title);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '대장 열쇠 다시 매김: % 줄', v_n;

  -- 동의어 열쇠를 새 규칙으로 — 위에서 걸러 냈으니 가리키는 작품은 한 열쇠로 접히는 것끼리 같다.
  -- 한 열쇠로 접히는 동의어는 한 줄만 남긴다(이미 접힌 줄을 먼저). 안 걷으면 아래 UPDATE 가 PK 에 걸린다
  DELETE FROM exam.work_title_alias
   WHERE alias_key IN (
     SELECT alias_key FROM (
       SELECT alias_key, row_number() OVER (
                PARTITION BY exam.fold_work_title_key(alias_key)
                ORDER BY (alias_key = exam.fold_work_title_key(alias_key)) DESC, alias_key) AS rn
         FROM exam.work_title_alias) x
      WHERE x.rn > 1);
  UPDATE exam.work_title_alias a SET alias_key = exam.fold_work_title_key(a.alias_key)
   WHERE a.alias_key <> exam.fold_work_title_key(a.alias_key);

  SELECT count(*) INTO v_bad FROM exam.work_title_canon WHERE key <> exam.work_title_key(title);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '대장 열쇠가 규칙과 어긋난 줄이 % 개 남았다', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM exam.work_title_alias a JOIN exam.work_title_canon c ON c.key = a.alias_key) THEN
    RAISE EXCEPTION '동의어 열쇠에 대장 줄이 있다 — 대장 조회가 어느 쪽을 따를지 갈린다';
  END IF;
END;
$rekey$;

-- ---------------------------------------------
-- 4. 지은이 표기 — '작자미상' 을 '작자 미상' 으로
-- ---------------------------------------------
-- 작품 트리의 지은이순 보기는 지은이 문자열로 폴더를 세운다. `작자미상` 한 줄이 `작자 미상`(52건)
-- 옆에 폴더 하나를 따로 세웠다. 캐논 층(canonicalize_works)에 얹으므로 앱 거울은 필요 없다 —
-- 편집기는 저장 뒤 서버 값을 받아들인다(usePassageWorksState).
CREATE OR REPLACE FUNCTION exam.canonical_work_author(p_author TEXT)
RETURNS TEXT
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT regexp_replace(COALESCE(p_author, ''), '^작자 ?미상$', '작자 미상');
$$;

/** 지문 작품 목록을 표준 표기로 — sql/46 판 + 지은이 표기 */
CREATE OR REPLACE FUNCTION exam.canonicalize_works(p_works JSONB)
RETURNS JSONB
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  SELECT exam.normalize_works(COALESCE(jsonb_agg(
           jsonb_set(
             jsonb_set(a.e, '{title}', to_jsonb(exam.canonical_work_title(a.e->>'title'))),
             '{author}', to_jsonb(exam.canonical_work_author(a.e->>'author')))
           ORDER BY a.ord), '[]'::jsonb))
    FROM jsonb_array_elements(exam.normalize_works(p_works)) WITH ORDINALITY AS a(e, ord);
$$;

-- ---------------------------------------------
-- 5. 다시 입히기
-- ---------------------------------------------
DO $apply$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r FROM exam.apply_work_title_canon();
  RAISE NOTICE '새 열쇠 적용: 지문 % 건 · 문항 % 건', r.passages_fixed, r.problems_fixed;
END;
$apply$;
