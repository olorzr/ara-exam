-- =============================================
-- 20. 기출 문제 은행 4차 — 작품(지문) 축
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   문항을 **작품별로** 찾을 수 있어야 한다. 같은 「동백꽃」을 여러 학교가 내는데,
--   지금은 학교 기출 트리로만 훑을 수 있어 한 작품의 기출을 모으려면 학교를 하나씩 돌아야 했다.
--
--   축은 `problems.work_title` 하나로 간다(인덱스·검색어가 이미 이 컬럼에 있다).
--   지문의 작품명(`passages.title`)과의 동기화는 **DB 가** 맡는다 — OCR 저장·검수 수정·
--   직접 SQL 어느 길로 들어와도 같은 규칙이어야 하기 때문이다.
--
-- ⚠️ 적용 순서: 이 마이그레이션을 **앱 배포보다 먼저** 적용한다.
--   반대 순서라도 조용히 깨지지는 않지만(앱이 새 컬럼을 만들지 않는다), 그 사이 올라온
--   기출은 문항 작품명이 비어 작품 트리에 안 보인다.
--
-- ⚠️ 아래 6번 백필은 문항의 `updated_at` 을 올린다(낙관적 동시성). 적용 시점에 열려 있던
--   검수 탭은 새로고침 전까지 저장이 충돌로 튕긴다 — 배포와 붙여서 돌리고 안내할 것.
--
-- ⚠️ sql/17·18 과 같은 이유로 **모든 DDL 에 `exam.` 을 명시**한다(SQL Editor 는 문마다
--   다른 백엔드에 보낼 수 있어 파일 머리의 `SET search_path` 를 믿으면 안 된다).

-- ---------------------------------------------
-- 실행 대상 확인 (가장 먼저)
-- ---------------------------------------------
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'exam') THEN
    RAISE EXCEPTION
      'exam 스키마가 없습니다 (현재 DB: %). SQL Editor 가 다른 Supabase 프로젝트에 '
      '연결돼 있을 가능성이 높습니다.', current_database();
  END IF;

  IF to_regclass('exam.passages') IS NULL OR to_regclass('exam.problems') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;

  IF to_regprocedure('exam.normalize_category_name(text)') IS NULL THEN
    RAISE EXCEPTION
      'exam.normalize_category_name 이 없습니다 (현재 DB: %). sql/16 을 먼저 적용하세요.',
      current_database();
  END IF;

  -- 검색 평문 트리거보다 먼저 돌아야 하는 트리거를 만든다(4번) — 그 트리거가 있어야
  -- 이름 순서를 따질 의미가 있다
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
-- 1. 작품명 표기 정규화 함수
-- ---------------------------------------------
-- ⚠️ 앱의 `src/lib/problem-bank/work-title.ts` 의 `normalizeWorkTitle` 과 **같은 규칙**이어야
--   한다. 한쪽만 바꾸면 앱이 저장한 값과 트리거가 옮긴 값이 갈라져 작품 트리에 같은 작품이
--   두 폴더로 보인다(sql/16 ↔ category-name.ts 와 같은 계약).
--
-- 규칙: 양끝의 감싸는 기호(낫표·겹낫표·꺾쇠·따옴표)와 공백을 벗기고 카테고리 정규화에 넘긴다.
--   「동백꽃」 → 동백꽃, 『삼국유사』 → 삼국유사, "동백꽃" → 동백꽃
-- 안쪽 기호는 건드리지 않는다 — '봄봄 · 「동백꽃」' 처럼 두 편을 한 칸에 적은 경우 뜻이 있다.
CREATE OR REPLACE FUNCTION exam.normalize_work_title(p_name TEXT)
RETURNS TEXT
  LANGUAGE sql
  IMMUTABLE
  SET search_path = exam, pg_temp
AS $$
  SELECT exam.normalize_category_name(
    regexp_replace(
      regexp_replace(COALESCE(p_name, ''), '^[「」『』〈〉《》＜＞<>“”‘’"''\s]+', ''),
      '[「」『』〈〉《》＜＞<>“”‘’"''\s]+$', ''
    )
  );
$$;

COMMENT ON FUNCTION exam.normalize_work_title(TEXT) IS
  '작품명·지은이 표기 정규화. 앱의 src/lib/problem-bank/work-title.ts 와 1:1 로 같은 규칙이어야 한다';

-- ---------------------------------------------
-- 2. 이미 쌓인 값 정규화 (백필보다 **먼저**)
-- ---------------------------------------------
-- 순서가 중요하다: 정규화를 나중에 하면 백필이 다듬지 않은 제목을 문항에 복사해
-- 같은 작품이 두 갈래로 남는다.
UPDATE exam.passages
   SET title  = exam.normalize_work_title(title),
       author = exam.normalize_work_title(author)
 WHERE title  IS DISTINCT FROM exam.normalize_work_title(title)
    OR author IS DISTINCT FROM exam.normalize_work_title(author);

UPDATE exam.problems
   SET work_title = exam.normalize_work_title(work_title)
 WHERE work_title IS DISTINCT FROM exam.normalize_work_title(work_title);

-- ---------------------------------------------
-- 3. 새 문항이 지문의 작품명을 물려받는다
-- ---------------------------------------------
-- OCR 은 지문을 먼저 넣고 문항을 넣으므로 INSERT 시점에 지문이 이미 있다.
-- 모델이 문항의 work_title 을 비워 보내도 지문에서 채워진다.
CREATE OR REPLACE FUNCTION exam.fill_problem_work_title() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  IF COALESCE(NEW.work_title, '') = '' AND NEW.passage_id IS NOT NULL THEN
    SELECT COALESCE(p.title, '') INTO NEW.work_title
      FROM exam.passages p WHERE p.id = NEW.passage_id;
    NEW.work_title := COALESCE(NEW.work_title, '');
  END IF;
  RETURN NEW;
END;
$$;

-- ⚠️ 이름의 `aa_` 접두사는 의도적이다 — 트리거는 알파벳 순으로 실행되므로
--   `problems_search_text`(BEFORE INSERT/UPDATE) 보다 **먼저** 돌아야 물려받은 작품명이
--   검색 평문에 들어간다. 이름을 바꾸면 검색에서 작품명이 조용히 빠진다(sql/17 과 같은 규약).
DROP TRIGGER IF EXISTS aa_fill_work_title_problems ON exam.problems;
CREATE TRIGGER aa_fill_work_title_problems
  BEFORE INSERT OR UPDATE OF passage_id ON exam.problems
  FOR EACH ROW EXECUTE FUNCTION exam.fill_problem_work_title();

-- ---------------------------------------------
-- 4. 지문의 작품명을 고치면 딸린 문항이 따라간다
-- ---------------------------------------------
-- 검수에서 작품명을 채우거나 고치는 일이 잦은데, 문항마다 손으로 다시 치게 하면
-- 아무도 안 한다(그러면 작품 트리가 늘 반쯤 비어 있다).
--
-- ⚠️ **사람이 문항에 따로 적은 작품명은 건드리지 않는다** — 옛 지문 제목을 그대로 물려받은
--   문항(work_title = OLD.title)과 아직 빈 문항만 따라간다. (가)(나) 지문에서 문항마다
--   다른 작품을 적어 둔 경우가 그래서 보존된다.
-- ⚠️ 지문 제목을 ''로 지우면 물려받았던 문항도 ''가 된다(의도한 동작이다 — 잘못 붙은
--   작품명을 지우는 유일한 길이다).
CREATE OR REPLACE FUNCTION exam.sync_passage_title_to_problems() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
BEGIN
  UPDATE exam.problems
     SET work_title = NEW.title
   WHERE passage_id = NEW.id
     AND work_title IN ('', OLD.title)
     AND work_title IS DISTINCT FROM NEW.title;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS passages_sync_work_title ON exam.passages;
CREATE TRIGGER passages_sync_work_title
  AFTER UPDATE OF title ON exam.passages
  FOR EACH ROW WHEN (OLD.title IS DISTINCT FROM NEW.title)
  EXECUTE FUNCTION exam.sync_passage_title_to_problems();

-- ---------------------------------------------
-- 5. 되돌림 백필 — 문항의 작품명으로 **지문**의 작품명을 채운다
-- ---------------------------------------------
-- 옛 프롬프트는 title/author 를 설명하지 않아 모델이 늘 비워 보냈다. 그래서 운영 데이터는
-- **지문 제목이 전부 비어 있고 문항에만 작품명이 있다**(2026-09-09 기준 지문 12건 전부 '',
-- 문항 9건이 '동백꽃'). 이대로 두면 작품 트리는 '지은이 미입력' 한 폴더가 되고 지문 묶음
-- 머리가 '제목 없는 지문' 으로 나온다 — 작품별 보기의 핵심이 죽는다.
--
-- ⚠️ **문항들이 한 작품으로 일치할 때만** 올린다. (가)(나) 지문처럼 문항마다 다른 작품을
--   가리키는 경우 하나를 골라 올리면 거짓이 된다.
-- 지은이는 이렇게 되살릴 수 없다 — 문항에 없는 정보다. 검수에서 손으로 넣거나
-- 새 프롬프트로 다시 읽어야 채워진다.
UPDATE exam.passages ps
   SET title = agreed.work_title
  FROM (
    SELECT p.passage_id, min(p.work_title) AS work_title
      FROM exam.problems p
     WHERE p.passage_id IS NOT NULL AND p.work_title <> ''
     GROUP BY p.passage_id
    HAVING count(DISTINCT p.work_title) = 1
  ) AS agreed
 WHERE ps.id = agreed.passage_id
   AND ps.title = '';

-- ---------------------------------------------
-- 6. 백필 — 이미 있는 문항에 지문의 작품명을 붙인다
-- ---------------------------------------------
-- ⚠️ 이 UPDATE 는 행마다 `audit_problems_update`(BEFORE UPDATE) 를 발화시켜 본문 HTML 째로
--   감사 로그를 남긴다. **먼저 건수를 세어 보고**(아래 확인 쿼리) 수백 건을 넘으면
--   이 문 앞뒤로만 감사 트리거를 껐다 켠다:
--     ALTER TABLE exam.problems DISABLE TRIGGER audit_problems_update;
--     ... UPDATE ...
--     ALTER TABLE exam.problems ENABLE TRIGGER audit_problems_update;
--   ⚠️ `session_replication_role = replica` 로 끄지 말 것 — `problems_search_text` 까지
--   함께 꺼져 검색 평문이 옛 값으로 굳는다.
UPDATE exam.problems p
   SET work_title = ps.title
  FROM exam.passages ps
 WHERE p.passage_id = ps.id
   AND p.work_title = ''
   AND ps.title <> '';

-- ---------------------------------------------
-- 7. 주석
-- ---------------------------------------------
COMMENT ON COLUMN exam.problems.work_title IS
  '작품명(표준 표기). 지문(passages.title)에서 트리거가 물려주고 따라 바꾼다. 아카이브 작품 트리의 축';
COMMENT ON COLUMN exam.passages.title IS
  '작품명 / 글 제목(표준 표기). 바꾸면 딸린 문항의 work_title 도 함께 바뀐다';
COMMENT ON FUNCTION exam.fill_problem_work_title() IS
  '문항의 작품명이 비어 있으면 지문에서 채운다. problems_search_text 보다 먼저 돌아야 해서 트리거 이름이 aa_ 로 시작한다';
COMMENT ON FUNCTION exam.sync_passage_title_to_problems() IS
  '지문 작품명 변경을 딸린 문항에 전파한다. 사람이 문항에 따로 적은 작품명은 건드리지 않는다';

-- PostgREST 스키마 캐시 갱신 — 함수를 추가했으므로 알린다
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인 쿼리 (적용 전후로 직접 돌려 볼 것)
-- ---------------------------------------------
-- 적용 전: 되돌림 백필로 제목이 생길 지문 수
-- SELECT count(*) FROM exam.passages ps WHERE ps.title = '' AND EXISTS (
--   SELECT 1 FROM exam.problems p WHERE p.passage_id = ps.id AND p.work_title <> ''
--    GROUP BY p.passage_id HAVING count(DISTINCT p.work_title) = 1);
--
-- 적용 전: 백필이 건드릴 문항 수 (감사 로그가 그만큼 쌓인다)
-- SELECT count(*) FROM exam.problems p JOIN exam.passages ps ON ps.id = p.passage_id
--  WHERE p.work_title = '' AND ps.title <> '';
--
-- 적용 후 ① 지문에 제목이 있는데 문항이 빈 것: 0 이어야 한다
-- SELECT count(*) FROM exam.problems p JOIN exam.passages ps ON ps.id = p.passage_id
--  WHERE p.work_title = '' AND ps.title <> '';
--
-- 적용 후 ② 트리거 순서: aa_fill_work_title_problems 가 problems_search_text 보다 앞
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'exam.problems'::regclass AND NOT tgisinternal ORDER BY tgname;
--
-- 적용 후 ③ 작품 목록 미리보기 (아카이브 트리에 이렇게 나온다)
-- SELECT p.work_title, count(*) AS 문항수,
--        (SELECT ps.author FROM exam.passages ps
--          WHERE ps.title = p.work_title AND ps.author <> '' LIMIT 1) AS 지은이
--   FROM exam.problems p WHERE p.work_title <> ''
--  GROUP BY p.work_title ORDER BY count(*) DESC;
--
-- 적용 후 ④ 정규화가 남긴 것이 없는지
-- SELECT count(*) FROM exam.passages
--  WHERE title IS DISTINCT FROM exam.normalize_work_title(title)
--     OR author IS DISTINCT FROM exam.normalize_work_title(author);
