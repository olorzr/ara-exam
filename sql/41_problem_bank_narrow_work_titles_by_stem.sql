-- =============================================
-- 41. 기출 문제 은행 — 발문이 짚은 구역으로 문항의 작품을 좁힌다 (데이터 교정)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/41_problem_bank_narrow_work_titles_by_stem.sql
-- =============================================
-- 배경 (2026-09-22, sql/39 자가 점검에서 나왔다):
--   sql/39 는 '옛 목록과 같으면 = 지문 전체를 묻는다' 로 보고 새 목록 **전부**를 물려줬다.
--   그 판단 자체는 맞다(옛 목록은 사람이 좁힌 값이 아니라 OCR 이 한 편만 알아본 값이다).
--   다만 그 결과로 **발문이 `(가)` 한 구역만 짚는 문항까지 두세 편을 묻는 문항이 됐다** —
--   '(가)의 화자에 대한 설명으로…' 가 『엄마 걱정 + 딸기』로 태깅되면, 『딸기』로 훑을 때
--   딸기와 상관없는 문항이 딸려 나온다. sql/33 이 경고한 "한 편만 묻던 문항이 말없이 두 편을
--   묻는 문항이 된다" 와 같은 자리다.
--
--   고칠 근거는 **지어내지 않아도 이미 발문 안에 있다**: 시험지가 `(가)` 라고 적어 두었다.
--   sql/39 가 그 `(가)` 를 작품에 이어 놓았으므로 이제 기계로 이을 수 있다.
--
-- ⚠️ **좁히기만 한다 — 넓히지 않는다.** 지금 값이 그 지문의 **작품 전부**일 때만 손댄다.
--    사람이(또는 옛 OCR 이) 이미 좁혀 적어 둔 값은 발문과 달라도 건드리지 않는다.
--    2026-09-22 운영 데이터에서 그 둘이 어긋나는 문항은 **0건**이었다 — 지금은 안전하지만,
--    조건을 풀면 나중에 검수에서 손으로 좁힌 값을 이 파일이 덮는다.
-- ⚠️ **발문의 범위 표기 `(가)~(다)` 를 편다.** 안 펴면 가운데 (나)가 빠져 세 편짜리 물음이
--    두 편으로 좁혀진다(실측: 그 꼴이 23건 + (가)~(마) 56건 … 이 저장소에서 가장 흔한 표기다).
--    쉼표 표기 `(가), (나)` 는 낱개 매칭으로 그대로 잡힌다.
-- ⚠️ **작품의 구분 표시가 범위(`'가~라'`)면 그 안의 구역을 전부 덮는 것으로 본다**
--    (소설 (가)~(라) + 드라마 대본 (마) 같은 지문).
-- ⚠️ **짚은 구역에 작품이 없으면 건드리지 않는다**(해설·학생 글 상자만 짚은 문항 10건).
--    그때 남는 작품만으로 좁히면 '(가)와 (나)를 견주라' 가 한 편만 묻는 것으로 읽힌다.
-- ⚠️ **작품 차례는 목록 안 차례(= 읽는 순서)를 지킨다.** `array_agg(DISTINCT …)` 로 담으면
--    가나다순으로 다시 서서, 집합은 같은데 배열이 달라진 문항까지 헛되이 갱신되고 파생
--    문자열이 '딸기 · 엄마 걱정' 처럼 뒤집힌다(실측: 그 꼴로 21건이 더 걸렸다).
-- ⚠️ **멱등하다.** 한 번 좁히고 나면 그 값은 더 이상 '작품 전부' 가 아니라 다시 걸리지 않는다.

SET search_path = exam, public;

DO $narrow$
DECLARE
  v_n     INT;
  v_bad   INT;
  v_txt   TEXT;
BEGIN
  IF to_regclass('exam.problems') IS NULL OR to_regproc('exam.works_titles') IS NULL THEN
    RAISE EXCEPTION 'sql/17·33 이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  RAISE NOTICE '대상 DB=% / 롤=%', current_database(), current_user;

  -- 구역 차례 — 한글 순서 표시는 코드포인트가 이어지지 않아 목록으로 둔다
  CREATE TEMP TABLE _ord (c TEXT PRIMARY KEY, n INT NOT NULL) ON COMMIT DROP;
  INSERT INTO _ord VALUES ('가',1),('나',2),('다',3),('라',4),('마',5),
                          ('바',6),('사',7),('아',8),('자',9),('차',10);

  -- 작품 → 그 작품이 덮는 구역들
  CREATE TEMP TABLE _work ON COMMIT DROP AS
  SELECT q.id AS pid,
         e.ord AS ord,
         e.v->>'title' AS title,
         CASE
           WHEN (e.v->>'label') ~ '^[가-차]~[가-차]$' THEN
             (SELECT array_agg(o.c ORDER BY o.n) FROM _ord o
               WHERE o.n BETWEEN (SELECT n FROM _ord WHERE c = left(e.v->>'label', 1))
                             AND (SELECT n FROM _ord WHERE c = right(e.v->>'label', 1)))
           WHEN (e.v->>'label') ~ '^[가-차]$' THEN ARRAY[e.v->>'label']
           ELSE '{}'::TEXT[]
         END AS covers
    FROM exam.passages q,
         LATERAL jsonb_array_elements(q.works) WITH ORDINALITY AS e(v, ord)
   WHERE (e.v->>'label') <> '';

  SELECT count(DISTINCT pid) INTO v_n FROM _work;
  RAISE NOTICE '0. 구분 표시가 붙은 지문 %건', v_n;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'sql/39(구분 표시 백필)가 아직 적용되지 않았습니다.';
  END IF;

  -- 발문이 짚은 구역 (낱개 + 범위 펴기)
  CREATE TEMP TABLE _ref ON COMMIT DROP AS
  WITH stem AS (
    SELECT pr.id, pr.passage_id,
           regexp_replace(regexp_replace(pr.stem_html, '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g') AS txt
      FROM exam.problems pr
     WHERE pr.passage_id IN (SELECT DISTINCT pid FROM _work)
  ), singles AS (
    SELECT s.id, m[1] AS c FROM stem s, regexp_matches(s.txt, '\(([가-차])\)', 'g') m
  ), ranges AS (
    SELECT s.id, o.c
      FROM stem s, regexp_matches(s.txt, '\(([가-차])\)\s*~\s*\(([가-차])\)', 'g') m, _ord o
     WHERE o.n BETWEEN (SELECT n FROM _ord WHERE c = m[1]) AND (SELECT n FROM _ord WHERE c = m[2])
  )
  SELECT id, array_agg(DISTINCT c) AS cs
    FROM (SELECT * FROM singles UNION ALL SELECT * FROM ranges) u
   GROUP BY id;

  -- 좁힐 문항 — 지금 값이 그 지문의 작품 **전부**일 때만
  CREATE TEMP TABLE _fix ON COMMIT DROP AS
  SELECT pr.id,
         (SELECT array_agg(w.title ORDER BY w.ord) FROM _work w
           WHERE w.pid = pr.passage_id AND w.covers && r.cs) AS titles
    FROM exam.problems pr
    JOIN _ref r ON r.id = pr.id
   WHERE EXISTS (
           SELECT 1 FROM (SELECT array_agg(w2.title ORDER BY w2.ord) t FROM _work w2 WHERE w2.pid = pr.passage_id) f
            WHERE pr.work_titles <@ f.t AND pr.work_titles @> f.t);

  DELETE FROM _fix WHERE titles IS NULL;

  UPDATE exam.problems pr
     SET work_titles = f.titles
    FROM _fix f
   WHERE pr.id = f.id
     AND pr.work_titles IS DISTINCT FROM f.titles;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '1. 문항 %건을 발문이 짚은 구역으로 좁혔습니다 (재실행이면 0)', v_n;

  -- -------------------------------------------
  -- 자가 검증
  -- -------------------------------------------
  SELECT count(*), string_agg(DISTINCT left(pr.id::text, 8), ', ')
    INTO v_bad, v_txt
    FROM exam.problems pr JOIN exam.passages q ON q.id = pr.passage_id
   WHERE NOT (pr.work_titles <@ exam.works_titles(q.works));
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 지문에 없는 작품을 묻는 문항 %건 (%).', v_bad, v_txt;
  END IF;

  SELECT count(*) INTO v_bad
    FROM exam.problems pr JOIN exam.passages q ON q.id = pr.passage_id
   WHERE cardinality(pr.work_titles) = 0 AND jsonb_array_length(q.works) > 0;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 작품이 통째로 빈 문항 %건.', v_bad;
  END IF;

  -- 좁힌 문항의 발문이 짚은 구역과 태깅이 맞는가
  SELECT count(*) INTO v_bad
    FROM exam.problems pr JOIN _fix f ON f.id = pr.id
   WHERE pr.work_titles IS DISTINCT FROM f.titles;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 좁히지 못한 문항 %건.', v_bad;
  END IF;

  RAISE NOTICE '2. 자가 검증 통과';
END
$narrow$;
