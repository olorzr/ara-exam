-- =============================================
-- 카테고리 이름 표기 정규화 + 표기 변형으로 갈라진 중복 병합
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   카테고리 트리는 이름 문자열 완전 일치로 노드를 묶는다
--   (src/lib/category-tree.ts 의 groupBy). 그래서 눈에는 똑같은
--   '천재(정호웅)' 과 '천재 (정호웅)' 이 서로 다른 폴더 두 개로 갈라져 보였다.
--   DB 도 막아주지 못한다 — publishers 의 UNIQUE(name, level) 도,
--   categories 의 idx_categories_natural_key 도 바이트 비교라 두 표기를
--   서로 다른 값으로 보고 둘 다 저장한다.
--
--   변형이 생기는 경로: 붙여넣기로 섞여 들어온 NBSP·폭 없는 문자(U+200B/U+FEFF),
--   한글 IME 의 전각 괄호（），한글 자모 분리(NFD), 그리고 사람이 그때그때 다르게 넣는
--   괄호 앞 공백. 앱의 쓰기 경로에는 `.trim()` 뿐이라 내부 표기 변형이 그대로 저장됐다.
--   CHANGELOG 0.1.2 에서 concept_sheets 만 일회성으로 정리한 적이 있으나,
--   publishers/categories 는 대상이 아니었고 쓰기 경로 방어도 없어 재발했다.
--
-- 조치:
--   1) normalize_category_name() 표준 정규화 함수를 만든다.
--   2) categories → concept_sheets → 마스터 5테이블 순으로 중복을 병합하고 표기를 통일한다.
--   3) (앱 측) src/lib/category-name.ts 의 normalizeCategoryName 이 모든 쓰기 경로에서
--      같은 규칙을 적용해 재발을 막는다.
--
-- ⚠️ 앱의 normalizeCategoryName 과 아래 normalize_category_name() 은 **같은 규칙**이어야
--   한다. 한쪽만 바꾸면 앱이 저장한 값과 DB 가 병합한 값이 갈라져 중복이 다시 생긴다.
--
-- ⚠️ 이 앱의 테이블은 ara-system 과 공유하는 Supabase 프로젝트의 **exam 스키마**에 있고,
--   `public` 에는 ara-system 의 동명 테이블(schools 등)이 따로 존재한다. search_path 를
--   지정하지 않고 실행하면 public 을 향해 엉뚱한 테이블을 건드린다. 반드시 아래 설정과
--   함께 실행할 것. (sql/15 와 같은 이유)
--
-- 멱등: 재실행하면 정규화 대상도 중복도 없어 아무 행도 바뀌지 않는다.
--
-- ⚠️ 실행 순서: **이 파일(16)을 sql/15 보다 먼저 적용해도 된다 — 오히려 그래야 한다.**
--   sql/15 는 categories 에 year 를 추가하면서 자연키 유니크 인덱스를 재생성하는데,
--   표기 변형으로 갈라진 중복 행이 남아 있으면 그 인덱스 생성이 실패한다. 편집기가
--   파일 전체를 한 트랜잭션으로 묶으면 앞의 ADD COLUMN 까지 롤백되어 year 가 없는
--   상태로 되돌아간다(실제로 겪은 증상: 42703 column "year" does not exist).
--   그래서 이 파일은 sql/15 적용 전 스키마에서도 돌아가도록 만들었다 — year/grade/
--   school_name 이 없으면 그 컬럼을 키에서 빼고 묶는다(pre-15 데이터는 그 값이 아예
--   없으므로 결과가 같다). 권장 순서: **16 → 15** (그 뒤 16 재실행은 no-op).
--
-- ---------------------------------------------
-- 실행 전/후 진단 쿼리 (표기 변형 확인용)
-- ---------------------------------------------
--   -- 같은 이름이 hex 가 다른 두 행으로 있으면 표기 변형이다.
--   SELECT id, level, name, length(name) AS len,
--          encode(convert_to(name, 'UTF8'), 'hex') AS hex
--   FROM exam.publishers WHERE name LIKE '%천재%' ORDER BY level, name;
--
--   SELECT publisher, length(publisher) AS len,
--          encode(convert_to(publisher, 'UTF8'), 'hex') AS hex, count(*)
--   FROM exam.categories WHERE publisher LIKE '%천재%' GROUP BY publisher;
--
--   SELECT publisher, length(publisher) AS len,
--          encode(convert_to(publisher, 'UTF8'), 'hex') AS hex, count(*)
--   FROM exam.concept_sheets WHERE publisher LIKE '%천재%' GROUP BY publisher;
--
--   -- 실행 후에는 위 세 쿼리 모두 이름별 hex 가 하나로 수렴해야 한다.

-- ---------------------------------------------
-- 실행 대상 확인 (가장 먼저)
-- ---------------------------------------------
-- 이 앱의 테이블은 ara-system 과 공유하는 Supabase 프로젝트의 exam 스키마에 있다.
-- exam 이 없는 DB 에서 실행하면 `SET search_path = exam, public` 의 exam 이 조용히
-- 건너뛰어지고 무자격 객체가 전부 public 을 향한다 — 남의 스키마를 오염시키거나
-- `column "year" does not exist` 같은 엉뚱한 에러가 난다(실제로 겪었다).
-- 그래서 시작 전에 명확히 멈춘다.
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). SQL Editor 가 다른 Supabase 프로젝트에 '
      '연결돼 있을 가능성이 높습니다 — 앱의 NEXT_PUBLIC_SUPABASE_URL 이 가리키는 '
      '프로젝트(ara-system 과 공유하는 쪽)에서 실행하세요.', current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 표준 정규화 함수
-- ---------------------------------------------
-- 스키마를 명시하지 않고 만든다 — search_path 의 첫 스키마(exam)에 생성되며,
-- 다른 sync_*_name 함수들과 같은 관례다.
--
-- 규칙 (src/lib/category-name.ts 의 normalizeCategoryName 과 1:1 대응):
--   1) 폭 없는 문자(U+200B ZWSP · U+FEFF BOM) 제거
--   2) NFC 정규화 — 자모 분리(NFD)로 들어온 한글을 합친다 + 전각 괄호 → ASCII 괄호
--   3) 공백류(JS `\s` 와 같은 집합) 연속을 한 칸으로 축약, 양끝 trim
--   4) 괄호 주변 공백 제거 — '천재 (정호웅)' · '천재( 정호웅 )' → '천재(정호웅)' 이 표준 표기
--
-- 1 이 맨 앞이어야 멱등이다. 'ᄀ<ZWSP>ᅡ' 처럼 분리된 자모 사이에 폭 없는 문자가 끼면
-- NFC 가 합치지 못하는데, NFC 를 먼저 돌려버리면 ZWSP 를 뗀 뒤에도 자모가 분리된 채
-- 남아 결과가 NFC 가 아니게 된다 — 재실행 때 값이 또 바뀌어 아래 "충돌 없음" 논증이 깨진다.
-- ⚠️ 반드시 exam 스키마로 못박는다. 파일 머리의 SET search_path 와 이 CREATE 가
-- 서로 다른 백엔드에서 실행될 수 있다는 전제(아래 DO 블록 주석 참고)를 그대로 따르면,
-- 무자격으로 두면 public 에 만들어져 ara-system 의 동명 함수를 덮어쓸 수 있다.
CREATE OR REPLACE FUNCTION exam.normalize_category_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
-- SECURITY INVOKER(기본)이지만, 본문이 참조하는 건 pg_catalog 내장 함수뿐이라
-- 호출 세션의 search_path 조작으로 다른 구현이 끼어들지 못하게 고정한다.
SET search_path = pg_catalog, pg_temp
AS $$
  WITH stripped AS (
    -- 1) 폭 없는 문자 제거: U+200B ZWSP, U+FEFF BOM.
    --    NFC 보다 **먼저** 해야 한다 — 분리된 자모 사이에 ZWSP 가 끼면('ᄀ<ZWSP>ᅡ')
    --    NFC 가 합치지 못하는데, NFC 를 먼저 돌리면 ZWSP 를 뗀 뒤에도 자모가 분리된 채
    --    남아 결과가 NFC 가 아니게 되고 재실행 때 값이 또 바뀐다(멱등 깨짐).
    --    공백 축약(3)보다 먼저이기도 해야 '천재<space><ZWSP><space>(' 가 한 칸으로 합쳐진다.
    SELECT regexp_replace(p_name, '[\u200B\uFEFF]', '', 'g') AS v
  ),
  parens AS (
    -- 2) NFC 정규화 + 전각 괄호(U+FF08/U+FF09) -> ASCII 괄호
    SELECT translate(normalize(v, NFC), U&'\FF08\FF09', '()') AS v FROM stripped
  ),
  collapsed AS (
    -- 3) 공백류 연속을 한 칸으로 축약하고 양끝을 자른다.
    --    문자 집합은 JS 의 `\s` 와 같아야 한다(U+FEFF 는 1 에서 이미 제거됨).
    --    Postgres 의 `\s` 는 ASCII 공백만 잡으므로 유니코드 공백을 직접 나열한다.
    --    btrim 은 공백만 제거하지만, 축약 후엔 모든 공백류가 ASCII 공백이라 충분하다.
    SELECT btrim(regexp_replace(
             v,
             '[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+',
             ' ', 'g'
           )) AS v FROM parens
  )
  -- 4) 괄호 주변 공백 제거 — '천재 (정호웅)' / '천재( 정호웅 )' → '천재(정호웅)'
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(v, ' +\(', '(', 'g'),
             '\( +', '(', 'g'
           ),
           ' +\)', ')', 'g'
         )
  FROM collapsed;
$$;

COMMENT ON FUNCTION exam.normalize_category_name(TEXT) IS
  '카테고리 이름 표준 표기 정규화. src/lib/category-name.ts 의 normalizeCategoryName 과 규칙이 같아야 한다.';

-- ---------------------------------------------
-- 2. 기존 데이터 병합 + 정규화
-- ---------------------------------------------
-- 전체를 하나의 DO 블록(단일 statement)으로 감싼다. Supabase SQL Editor 는 문
-- (statement)별로 풀러를 통해 서로 다른 백엔드에서 실행할 수 있어 여러 문에 걸친
-- TEMP 테이블이 사라진다. DO 블록은 하나의 백엔드에서 원자적으로 실행되므로
-- 블록 내 TEMP 테이블이 유지되고, 중간 실패 시 전체가 롤백되어 부분 적용을 막는다.
--
-- ⚠️ 순서가 중요하다 — categories/concept_sheets 를 **마스터보다 먼저** 정리한다.
--   마스터 rename 은 sync_*_name 트리거를 발화시키는데, 그 트리거는
--   `UPDATE categories SET publisher = NEW.name WHERE publisher = OLD.name` 형태라
--   categories 가 아직 정리되지 않았으면 이미 존재하는 정규형 행과
--   idx_categories_natural_key 유니크 충돌을 일으켜 블록 전체가 롤백된다.
--   categories 를 먼저 정규화해 두면 트리거의 WHERE 가 0행을 잡아 안전한 no-op 이 된다.
DO $$
DECLARE
  v_cat_dups        INT;
  v_words_merged    INT;
  v_words_repointed INT;
  v_cat_renamed     INT;
  v_sheets_renamed  INT;
  v_master_dups     INT;
  v_master_renamed  INT;
  v_n               INT;
  -- sql/15 적용 여부. 아래 "스키마 버전 감지" 참고.
  v_has_cat_year    BOOLEAN;
  v_has_sm_year     BOOLEAN;
  v_has_cs_school   BOOLEAN;
BEGIN
  -- 파일 머리의 SET 과 같은 값을 블록 안에서 한 번 더 세운다. Supabase SQL Editor 가
  -- 문(statement)별로 다른 백엔드에 보낼 수 있다는 전제(바로 위 주석)를 그대로
  -- 따르면 머리의 SET 이 이 블록까지 살아 있으리라 보장할 수 없다. 그 경우 public 의
  -- ara-system 동명 테이블을 건드리게 되므로, 블록이 스스로 경로를 확정한다.
  -- (exam 스키마가 없는 배포에서는 조용히 무시되고 public 으로 떨어진다.)
  SET LOCAL search_path = exam, public;

  -- 이전 실패 실행이 같은 세션에 남긴 잔여 테이블 정리
  DROP TABLE IF EXISTS tmp_cat_dups;
  DROP TABLE IF EXISTS tmp_pub_map;
  DROP TABLE IF EXISTS tmp_mc_map;
  DROP TABLE IF EXISTS tmp_sc_map;
  DROP TABLE IF EXISTS tmp_school_map;
  DROP TABLE IF EXISTS tmp_sm_map;

  -- ===========================================================
  -- 0) 스키마 버전 감지 (sql/15 적용 전에도 실행할 수 있어야 한다)
  -- ===========================================================
  -- 닭-달걀 문제가 있다: sql/15 는 categories 에 year 를 추가하면서 자연키 유니크
  -- 인덱스를 재생성하는데, **표기 변형으로 갈라진 중복 행이 남아 있으면 그 인덱스
  -- 생성이 실패**한다(그리고 편집기가 파일 전체를 한 트랜잭션으로 감싸면 앞의
  -- ADD COLUMN 까지 롤백되어 year 가 없는 상태로 되돌아간다). 즉 중복 정리(이 파일)가
  -- sql/15 보다 먼저 돌아야 하는데, 이 파일이 year 를 요구하면 영원히 진행할 수 없다.
  --
  -- 그래서 year/grade 는 **파티션 키에서만** 쓰이는 점을 이용해, 컬럼이 없으면
  -- 키에서 빼고 묶는다. sql/15 적용 전 데이터는 year 가 아예 없으므로(적용 후에는
  -- 전 행이 DEFAULT '') 두 방식의 그룹 결과가 완전히 같다.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'exam' AND table_name = 'categories' AND column_name = 'year'
  ) INTO v_has_cat_year;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'exam' AND table_name = 'school_materials' AND column_name = 'year'
  ) INTO v_has_sm_year;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'exam' AND table_name = 'concept_sheets' AND column_name = 'school_name'
  ) INTO v_has_cs_school;

  IF NOT v_has_cat_year THEN
    RAISE NOTICE '[알림] categories.year 가 없습니다(sql/15 미적용). year 를 뺀 자연키로 병합합니다.';
    RAISE NOTICE '[알림] 이 파일을 먼저 끝낸 뒤 sql/15 를 적용하면 유니크 인덱스가 정상 생성됩니다.';
  END IF;

  -- ===========================================================
  -- A) categories: 표기 변형으로 갈라진 중복 병합 → 표기 통일
  --    (병합 머시너리는 sql/09_migration_categories_unique.sql 과 동일한 구조)
  -- ===========================================================
  -- 정규화하면 자연키가 같아지는 행들을 묶어 canonical(최초 생성)을 고른다.
  -- year 컬럼이 없으면(sql/15 미적용) 파티션 키에서 뺀다. 위 "스키마 버전 감지" 참고.
  EXECUTE format($q$
    CREATE TEMP TABLE tmp_cat_dups AS
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER w AS rn,
        FIRST_VALUE(id) OVER w AS canonical_id
      FROM categories
      WINDOW w AS (
        PARTITION BY
          level,
          %s
          grade,
          normalize_category_name(publisher),
          semester,
          normalize_category_name(chapter),
          normalize_category_name(sub_chapter),
          normalize_category_name(COALESCE(school_name, ''))
        ORDER BY created_at, id
      )
    )
    SELECT id AS dup_id, canonical_id FROM ranked WHERE rn > 1
  $q$, CASE WHEN v_has_cat_year THEN 'year,' ELSE '' END);

  SELECT count(*) INTO v_cat_dups FROM tmp_cat_dups;

  -- words 의 UNIQUE(category_id, word) (words_category_word_unique, sql/06) 충돌 방지.
  -- ⚠️ "dup vs canonical" 만 비교하면 안 된다 — 한 그룹에 dup 이 둘 이상이고 그 둘이
  --    같은 단어를 갖고 있으면(canonical 에는 없고), 아래 repoint 에서 둘 다 canonical
  --    로 옮겨가 유니크 제약이 터진다. 표기 변형은 몇 달에 걸쳐 쌓이므로 3개 이상
  --    묶이는 그룹이 예외가 아니라 기본이다(sql/09 의 원래 형태가 가진 한계).
  --    그래서 canonical + 그 dup 전부를 한 묶음으로 보고 (canonical, word) 당 한 행만 남긴다.
  --    남길 우선순위: canonical 에 원래 있던 행 → 먼저 만들어진 행.
  DELETE FROM words w
  USING (
    SELECT
      x.id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(d.canonical_id, x.category_id), x.word
        ORDER BY (d.canonical_id IS NULL) DESC, x.created_at, x.id
      ) AS rn
    FROM words x
    LEFT JOIN tmp_cat_dups d ON d.dup_id = x.category_id
    WHERE x.category_id IN (SELECT dup_id FROM tmp_cat_dups)
       OR x.category_id IN (SELECT canonical_id FROM tmp_cat_dups)
  ) k
  WHERE w.id = k.id AND k.rn > 1;
  GET DIAGNOSTICS v_words_merged = ROW_COUNT;

  -- words.category_id (FK, ON DELETE CASCADE) repoint — dup 삭제로 단어가 딸려
  -- 지워지지 않도록 반드시 삭제보다 먼저 한다.
  UPDATE words w
  SET category_id = d.canonical_id
  FROM tmp_cat_dups d
  WHERE w.category_id = d.dup_id;
  GET DIAGNOSTICS v_words_repointed = ROW_COUNT;

  -- exams.category_ids (UUID[]) — dup id 를 canonical 로 치환하고 중복 제거.
  -- WITH ORDINALITY 로 원래 순서를 보존한 뒤, 치환으로 생긴 중복은 첫 등장만 남긴다.
  UPDATE exams e
  SET category_ids = sub.new_ids
  FROM (
    SELECT
      e2.id,
      ARRAY(
        SELECT mapped_id
        FROM (
          SELECT
            COALESCE(d.canonical_id, u.elem) AS mapped_id,
            MIN(u.ord) AS first_ord
          FROM unnest(e2.category_ids) WITH ORDINALITY AS u(elem, ord)
          LEFT JOIN tmp_cat_dups d ON d.dup_id = u.elem
          GROUP BY COALESCE(d.canonical_id, u.elem)
        ) m
        ORDER BY first_ord
      ) AS new_ids
    FROM exams e2
    WHERE EXISTS (
      SELECT 1
      FROM unnest(e2.category_ids) AS elem
      JOIN tmp_cat_dups d ON d.dup_id = elem
    )
  ) AS sub
  WHERE e.id = sub.id;

  DELETE FROM categories c
  USING tmp_cat_dups d
  WHERE c.id = d.dup_id;

  DROP TABLE tmp_cat_dups;

  -- 남은 행의 표기 통일. 중복은 위에서 없앴으므로 유니크 충돌이 나지 않는다
  -- (어떤 행의 정규화 결과가 다른 행의 현재 값과 같다면 둘은 같은 자연키였고,
  --  그 경우는 이미 병합됐다 — normalize 는 멱등이므로 그 밖의 경우는 없다).
  -- school_name 만 nullable 이라 COALESCE 로 감싼다(normalize_category_name 은 STRICT).
  -- NULL → '' 도 여기서 함께 처리한다 — 병합 전에 따로 UPDATE 하면, NULL 행과 '' 행이
  -- 함께 있을 때 idx_categories_natural_key(NULLS NOT DISTINCT) 충돌로 블록이 통째로
  -- 롤백된다. 위 병합이 두 행을 이미 하나로 합쳐 둔 뒤라야 안전하다.
  UPDATE categories
  SET publisher   = normalize_category_name(publisher),
      chapter     = normalize_category_name(chapter),
      sub_chapter = normalize_category_name(sub_chapter),
      school_name = normalize_category_name(COALESCE(school_name, ''))
  WHERE publisher   IS DISTINCT FROM normalize_category_name(publisher)
     OR chapter     IS DISTINCT FROM normalize_category_name(chapter)
     OR sub_chapter IS DISTINCT FROM normalize_category_name(sub_chapter)
     OR school_name IS DISTINCT FROM normalize_category_name(COALESCE(school_name, ''));
  GET DIAGNOSTICS v_cat_renamed = ROW_COUNT;

  RAISE NOTICE 'categories: 중복 % 행 병합(단어 % 건 병합 삭제 / % 건 이관), 표기 % 행 정규화',
    v_cat_dups, v_words_merged, v_words_repointed, v_cat_renamed;

  -- ===========================================================
  -- B) concept_sheets: 표기 통일
  --    자연키 유니크 제약이 없어 병합 없이 UPDATE 만으로 같은 노드로 수렴한다.
  -- ===========================================================
  -- school_name 도 sql/15 가 추가한다. 없으면 그 항만 뺀다.
  EXECUTE format($q$
    UPDATE concept_sheets
    SET publisher   = normalize_category_name(publisher),
        unit        = normalize_category_name(unit),
        subunit     = normalize_category_name(subunit)
        %s
    WHERE publisher   IS DISTINCT FROM normalize_category_name(publisher)
       OR unit        IS DISTINCT FROM normalize_category_name(unit)
       OR subunit     IS DISTINCT FROM normalize_category_name(subunit)
       %s
  $q$,
    CASE WHEN v_has_cs_school THEN ', school_name = normalize_category_name(school_name)' ELSE '' END,
    CASE WHEN v_has_cs_school THEN 'OR school_name IS DISTINCT FROM normalize_category_name(school_name)' ELSE '' END);
  GET DIAGNOSTICS v_sheets_renamed = ROW_COUNT;

  RAISE NOTICE 'concept_sheets: 표기 % 행 정규화', v_sheets_renamed;

  -- ===========================================================
  -- C) 마스터 5테이블: 중복 병합 + 표기 통일
  -- ===========================================================
  -- C-1) 매핑을 **먼저 전부** 계산한다(위 → 아래).
  --      하위 테이블의 그룹 키에는 상위의 canonical id 를 써야, 상위를 합친 뒤에
  --      하위가 유니크 제약에 부딪히는 일이 없다.
  v_master_dups := 0;

  -- publishers: (정규화된 이름, level)
  CREATE TEMP TABLE tmp_pub_map AS
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER w AS rn,
           FIRST_VALUE(id) OVER w AS canonical_id
    FROM publishers
    WINDOW w AS (
      PARTITION BY normalize_category_name(name), level
      ORDER BY created_at, id
    )
  )
  SELECT id AS dup_id, canonical_id FROM ranked WHERE rn > 1;

  -- major_chapters: (정규화된 이름, canonical 출판사, 학년, 학기)
  CREATE TEMP TABLE tmp_mc_map AS
  WITH eff AS (
    SELECT mc.id, mc.created_at, mc.name, mc.grade, mc.semester,
           COALESCE(pm.canonical_id, mc.publisher_id) AS eff_publisher_id
    FROM major_chapters mc
    LEFT JOIN tmp_pub_map pm ON pm.dup_id = mc.publisher_id
  ),
  ranked AS (
    SELECT id,
           ROW_NUMBER() OVER w AS rn,
           FIRST_VALUE(id) OVER w AS canonical_id
    FROM eff
    WINDOW w AS (
      PARTITION BY normalize_category_name(name), eff_publisher_id, grade, semester
      ORDER BY created_at, id
    )
  )
  SELECT id AS dup_id, canonical_id FROM ranked WHERE rn > 1;

  -- sub_chapters: (정규화된 이름, canonical 대단원)
  CREATE TEMP TABLE tmp_sc_map AS
  WITH eff AS (
    SELECT sc.id, sc.created_at, sc.name,
           COALESCE(mm.canonical_id, sc.major_chapter_id) AS eff_major_chapter_id
    FROM sub_chapters sc
    LEFT JOIN tmp_mc_map mm ON mm.dup_id = sc.major_chapter_id
  ),
  ranked AS (
    SELECT id,
           ROW_NUMBER() OVER w AS rn,
           FIRST_VALUE(id) OVER w AS canonical_id
    FROM eff
    WINDOW w AS (
      PARTITION BY normalize_category_name(name), eff_major_chapter_id
      ORDER BY created_at, id
    )
  )
  SELECT id AS dup_id, canonical_id FROM ranked WHERE rn > 1;

  -- schools: (정규화된 이름)  — schools.name 은 전역 UNIQUE
  CREATE TEMP TABLE tmp_school_map AS
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER w AS rn,
           FIRST_VALUE(id) OVER w AS canonical_id
    FROM schools
    WINDOW w AS (
      PARTITION BY normalize_category_name(name)
      ORDER BY created_at, id
    )
  )
  SELECT id AS dup_id, canonical_id FROM ranked WHERE rn > 1;

  -- school_materials: (정규화된 이름, canonical 학교, 년도, 학년)
  -- year/grade 는 sql/15 가 추가한다. 없으면 pre-15 의 UNIQUE(name, school_id) 기준으로 묶는다.
  EXECUTE format($q$
    CREATE TEMP TABLE tmp_sm_map AS
    WITH eff AS (
      SELECT sm.id, sm.created_at, sm.name, %s
             COALESCE(km.canonical_id, sm.school_id) AS eff_school_id
      FROM school_materials sm
      LEFT JOIN tmp_school_map km ON km.dup_id = sm.school_id
    ),
    ranked AS (
      SELECT id,
             ROW_NUMBER() OVER w AS rn,
             FIRST_VALUE(id) OVER w AS canonical_id
      FROM eff
      WINDOW w AS (
        PARTITION BY normalize_category_name(name), eff_school_id %s
        ORDER BY created_at, id
      )
    )
    SELECT id AS dup_id, canonical_id FROM ranked WHERE rn > 1
  $q$,
    CASE WHEN v_has_sm_year THEN 'sm.year, sm.grade,' ELSE '' END,
    CASE WHEN v_has_sm_year THEN ', year, grade'      ELSE '' END);

  -- C-2) 적용은 **아래 → 위** 순서.
  --      상위 dup 을 먼저 지우면 ON DELETE CASCADE 로 멀쩡한 하위 행까지 딸려 지워진다.
  --      각 단계는 "dup 삭제 → 생존 행 repoint → 이름 정규화" 순서여야 유니크 충돌이 없다
  --      (같은 부모 아래 같은 이름이 되는 행은 이미 dup 으로 지워진 상태다).

  -- 소단원 (자식 없음)
  DELETE FROM sub_chapters WHERE id IN (SELECT dup_id FROM tmp_sc_map);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_dups := v_master_dups + v_n;

  UPDATE sub_chapters sc
  SET major_chapter_id = mm.canonical_id
  FROM tmp_mc_map mm
  WHERE sc.major_chapter_id = mm.dup_id;

  -- 대단원 (소단원이 모두 canonical 을 보게 된 뒤에 삭제)
  DELETE FROM major_chapters WHERE id IN (SELECT dup_id FROM tmp_mc_map);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_dups := v_master_dups + v_n;

  UPDATE major_chapters mc
  SET publisher_id = pm.canonical_id
  FROM tmp_pub_map pm
  WHERE mc.publisher_id = pm.dup_id;

  -- 출판사
  DELETE FROM publishers WHERE id IN (SELECT dup_id FROM tmp_pub_map);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_dups := v_master_dups + v_n;

  -- 프린트/작품명
  DELETE FROM school_materials WHERE id IN (SELECT dup_id FROM tmp_sm_map);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_dups := v_master_dups + v_n;

  UPDATE school_materials sm
  SET school_id = km.canonical_id
  FROM tmp_school_map km
  WHERE sm.school_id = km.dup_id;

  -- 학교
  DELETE FROM schools WHERE id IN (SELECT dup_id FROM tmp_school_map);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_dups := v_master_dups + v_n;

  DROP TABLE tmp_sc_map;
  DROP TABLE tmp_mc_map;
  DROP TABLE tmp_pub_map;
  DROP TABLE tmp_sm_map;
  DROP TABLE tmp_school_map;

  -- C-3) 이름 정규화. 위 병합으로 "부모 + 정규화된 이름" 이 유일해졌으므로 충돌이 없다.
  --      여기서 발화하는 sync_*_name 트리거의 categories/concept_sheets UPDATE 는
  --      A)·B) 에서 이미 정규화해 둔 덕분에 0행을 잡는 no-op 이다.
  v_master_renamed := 0;

  UPDATE sub_chapters SET name = normalize_category_name(name)
  WHERE name IS DISTINCT FROM normalize_category_name(name);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_renamed := v_master_renamed + v_n;

  UPDATE major_chapters SET name = normalize_category_name(name)
  WHERE name IS DISTINCT FROM normalize_category_name(name);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_renamed := v_master_renamed + v_n;

  UPDATE publishers SET name = normalize_category_name(name)
  WHERE name IS DISTINCT FROM normalize_category_name(name);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_renamed := v_master_renamed + v_n;

  UPDATE school_materials SET name = normalize_category_name(name)
  WHERE name IS DISTINCT FROM normalize_category_name(name);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_renamed := v_master_renamed + v_n;

  UPDATE schools SET name = normalize_category_name(name)
  WHERE name IS DISTINCT FROM normalize_category_name(name);
  GET DIAGNOSTICS v_n = ROW_COUNT;  v_master_renamed := v_master_renamed + v_n;

  RAISE NOTICE '마스터: 중복 % 행 병합, 표기 % 행 정규화', v_master_dups, v_master_renamed;
END $$;
