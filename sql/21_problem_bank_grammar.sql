-- =============================================
-- 21. 기출 문제 은행 — 문법 분류 축
-- 실행: Supabase SQL Editor 에서 postgres 로 실행
-- =============================================
-- 배경:
--   문법 문항을 '음운 변동'·'높임법'·'피동/사동' 처럼 **문법 개념 단위**로 찾을 길이 없었다.
--   기존 두 분류 축은 둘 다 재사용할 수 없다 —
--     · area_path : ara-system 마스터에 '문법' 대영역만 있고 그 아래가 비어 있다(쓰기 권한도 없다)
--     · unit_path : 교과서(problem_sources.textbook)에 종속돼, 교과서를 안 고른 출처는 칸조차 안 뜬다
--   문법 개념은 교과서·학년과 무관한 축이라 세 번째 축을 만든다.
--
-- ⚠️ **이 축은 원소 하나가 경로 하나다** (area_path/unit_path 와 모양이 다르다).
--   area_path 는 TEXT[] 하나가 경로 하나라('{문학,현대시}') 문항에 **한 개**만 붙는다.
--   수능 문법 문항은 개념 두셋을 걸치므로 여기서는 경로를 ' > ' 로 이어 붙인 **문자열**을
--   원소로 담는다: '{"단어 > 품사 > 명사","문장 > 문법 요소 > 피동 표현"}'.
--   따라서 상위 검색은 @>(contains) 가 아니라 **&&(overlaps)** 다 — 앱이 마스터에서 그 가지의
--   잎 경로를 전부 펼쳐 넣는다(src/lib/problem-bank/grammar-tree.ts 의 grammarPathsUnder).
--
-- ⚠️ 마스터는 DB 가 아니라 **코드 상수**다(grammar-tree.ts). 수능 문법 체계는 교재 목차대로
--   고정이라 관리 화면·마스터 표를 두지 않았다. 저장하는 값은 그 이름 경로의 스냅샷이므로
--   상수를 고쳐도 이미 태깅한 문항은 그대로다(area_path·unit_path 와 같은 규약).
--
-- ⚠️ passages 에는 넣지 않는다. 문법 문항은 지문에 딸리지 않는 단독 문항이고
--   〈보기〉는 지문이 아니라 발문 안 상자다.
--
-- ⚠️ 적용 순서: **이 마이그레이션을 앱 배포보다 먼저** 적용한다. 순서가 뒤바뀌면 문법 태그를
--   보내는 저장이 PGRST204(컬럼 없음), 일괄 태깅이 PGRST202(함수 없음)로 실패한다.
--   그리고 마이그레이션과 배포를 **붙여서** 한다 — 사이를 벌리면 그 틈에 조용히 실패한다.
--
-- ⚠️ sql/17·18·19·20 과 같은 이유로 **모든 DDL 에 `exam.` 을 명시**한다(SQL Editor 는 문마다
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

  IF to_regclass('exam.problems') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'exam' AND table_name = 'problems' AND column_name = 'unit_path'
  ) THEN
    RAISE EXCEPTION 'sql/18(교과서 단원)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 문항 — 문법 분류 경로 목록
-- ---------------------------------------------
ALTER TABLE exam.problems
  ADD COLUMN IF NOT EXISTS grammar_paths TEXT[] NOT NULL DEFAULT '{}';

-- 상한은 **경로 길이가 아니라 태그 개수**다. 가지마다 깊이가 다르기 때문이다
-- (담화·어문 규정은 2단에서 끝나고 나머지는 3단). 앱의 GRAMMAR_MAX_TAGS 와 미러다.
ALTER TABLE exam.problems DROP CONSTRAINT IF EXISTS problems_grammar_paths_max;
ALTER TABLE exam.problems ADD CONSTRAINT problems_grammar_paths_max
  CHECK (cardinality(grammar_paths) <= 5);

-- 상위 검색이 && 라 GIN 이 그대로 쓰인다
CREATE INDEX IF NOT EXISTS idx_problems_grammar_paths
  ON exam.problems USING GIN (grammar_paths);

-- ---------------------------------------------
-- 2. 일괄 태깅 RPC (아카이브에서 여러 문항에 한 번에 붙인다)
-- ---------------------------------------------
-- PostgREST 로는 배열 append 를 못 한다. 행마다 읽고-합치고-쓰면 한 쪽(60행)에 60왕복이고,
-- 그 사이 다른 사람이 붙인 태그를 덮어쓴다. 한 문장으로 합집합을 만든다.
--
-- **덧붙이기만 하고 덮어쓰지 않는다** — 그래서 낙관적 동시성 조건(updated_at)이 필요 없다.
-- 남의 태그를 지우는 경로가 아예 없기 때문이다.
--
-- ⚠️ 기존 태그를 **앞**에 두고 새 것을 뒤에 붙인 다음 상한까지 자른다. 정렬해서 자르면
--   이미 5개인 문항에서 **기존 태그가 밀려 사라진다** — 붙이려던 것이 지우는 일이 된다.
--
-- SECURITY INVOKER(기본): 호출자의 RLS 를 그대로 받는다. problems 는 이미 authenticated +
-- 도메인 조건으로 열려 있어 DEFINER 가 필요 없다(sql/18 의 set_source_textbook 과 같은 근거).
CREATE OR REPLACE FUNCTION exam.add_grammar_paths(
  p_problem_ids UUID[],
  p_paths       TEXT[]
) RETURNS INTEGER
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_problem_ids IS NULL OR cardinality(p_problem_ids) = 0 THEN RETURN 0; END IF;
  IF p_paths IS NULL OR cardinality(p_paths) = 0 THEN RETURN 0; END IF;

  WITH united AS (
    SELECT q.id,
           -- ⚠️ COALESCE 가 반드시 필요하다. 원소가 전부 빈 문자열이면 array_agg 가 **NULL**
           --    을 내는데, 그대로 넣으면 NOT NULL 컬럼이라 저장이 통째로 실패한다
           COALESCE((
             SELECT array_agg(d.v ORDER BY d.ord)
               FROM (
                 -- 같은 경로가 이미 있으면 **먼저 나온 자리**를 유지한다
                 SELECT DISTINCT ON (t.v) t.v, t.ord
                   FROM unnest(q.grammar_paths || p_paths) WITH ORDINALITY AS t(v, ord)
                  WHERE btrim(t.v) <> ''
                  ORDER BY t.v, t.ord
               ) d
           ), ARRAY[]::TEXT[]) AS paths
      FROM exam.problems q
     WHERE q.id = ANY(p_problem_ids)
  ), merged AS (
    -- 상한까지 자른다. 기존 태그가 앞에 있으므로 잘리는 것은 **새로 붙이려던 쪽**이다.
    -- 숫자는 위 problems_grammar_paths_max CHECK 와 미러다
    SELECT id, paths[1:5] AS paths FROM united
  )
  UPDATE exam.problems p
     SET grammar_paths = merged.paths
    FROM merged
   WHERE p.id = merged.id
     -- 이미 다 붙어 있는 문항은 건드리지 않는다(updated_at 을 헛되이 올리면
     -- 그 문항을 열어 둔 다른 탭의 저장이 까닭 없이 충돌로 튕긴다)
     AND p.grammar_paths IS DISTINCT FROM merged.paths;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION exam.add_grammar_paths(UUID[], TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exam.add_grammar_paths(UUID[], TEXT[]) TO authenticated, service_role;

-- ---------------------------------------------
-- 3. 주석
-- ---------------------------------------------
COMMENT ON COLUMN exam.problems.grammar_paths IS
  '문법 분류의 **이름 경로 스냅샷 목록**. 원소 하나가 경로 하나이고 '' > '' 로 잇는다(예: "단어 > 품사 > 명사"). area_path 와 달리 문항에 여러 개가 붙는다. 마스터는 앱의 코드 상수(grammar-tree.ts)';

COMMENT ON FUNCTION exam.add_grammar_paths(UUID[], TEXT[]) IS
  '문항 여러 개에 문법 분류를 덧붙인다(합집합, 최대 5개). 기존 태그를 지우지 않는다. 반환값은 실제로 바뀐 행 수';

-- PostgREST 스키마 캐시 갱신 — 없으면 배포 직후 새 컬럼이 PGRST204,
-- 새 RPC 가 PGRST202 로 거부된다
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인 쿼리 (적용 뒤 직접 돌려 볼 것)
-- ---------------------------------------------
-- 컬럼·제약·인덱스:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'exam' AND table_name = 'problems' AND column_name = 'grammar_paths';
--
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'exam.problems'::regclass AND conname = 'problems_grammar_paths_max';
--
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE schemaname = 'exam' AND indexname = 'idx_problems_grammar_paths';
--
-- RPC 가 exam 스키마에 생겼는지 (public 에 새면 sql/16 과 같은 사고다):
--   SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE p.proname = 'add_grammar_paths';
--
-- 합집합·상한이 기존 태그를 지우지 않는지 (롤백 트랜잭션으로 안전하게):
--   BEGIN;
--     UPDATE exam.problems SET grammar_paths = ARRAY['가','나','다','라','마']
--      WHERE id = (SELECT id FROM exam.problems LIMIT 1);
--     SELECT exam.add_grammar_paths(
--       ARRAY[(SELECT id FROM exam.problems LIMIT 1)], ARRAY['바']);
--     -- 기대: 0행 변경 없음이 아니라, 가~마 가 그대로 남고 '바' 는 상한에 밀려 안 들어간다
--     SELECT grammar_paths FROM exam.problems LIMIT 1;
--   ROLLBACK;
