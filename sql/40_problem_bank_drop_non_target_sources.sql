-- =============================================
-- 40. 기출 문제 은행 — 광희중·행당중 외 출처를 지운다 (파괴적)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/40_problem_bank_drop_non_target_sources.sql
-- =============================================
-- 배경 (2026-09-22, 사용자 지시 "광희중과 행당중 말고 나머지는 제대로 올라간 게 아니라서
--   무학중 동마중 이런 다른 것들은 삭제해 줬으면 해"):
--   운영에 남아 있는 기출 출처는 광희중 43 · 행당중 40 · 동마중 1 · 무학중 1 · 성수고 1 건이었다.
--   뒤의 셋은 시험 삼아 올린 것이라 검수를 못 믿는다. 지운다.
--     · 2025 동마중학교 중1 2학기 중간 — 문항 30 · 지문 10
--     · 2025 무학중학교 중1 2학기 중간 — 문항 30 · 지문 6
--     · 2026 성수고등학교 고1 1학기 기말 — 상태 '업로드'(OCR 이 not_configured 로 실패), 문항 0
--
-- ⚠️⚠️ **되돌릴 수 없다.** 문항·지문은 `source_id` 의 ON DELETE CASCADE 로 함께 사라진다.
--    지운 행은 `exam.audit_log` 에 old_data 로 남으므로(삭제 감사 트리거는 **끄지 않는다**)
--    본문·정답은 그 로그에서 되찾을 수 있다. Storage 파일은 이 파일이 건드리지 않는다
--    (경로는 아래 3의 NOTICE 로 찍어 두고, 참조가 0 인 것을 확인한 뒤 따로 지운다).
--
-- ⚠️ **문제지에서도 그 문항을 뺀다**(사용자 결정 2026-09-22). `problem_paper_items.problem_id` 는
--    ON DELETE SET NULL 이라 그냥 두면 문제지는 스냅샷으로 **계속 인쇄된다** — 지운 학교의
--    문항 13개가 남는다는 뜻이다. 그래서 출처를 지우기 **전에** 항목을 먼저 뺀다:
--    출처가 사라지면 그 항목이 어느 학교 것인지 알아낼 길이 없어진다(problem_id 가 NULL 이 된다).
--    문제지 자체는 남긴다.
--      · '행당중 1학년 품사'        50문항 → 40문항 (동마중 9 · 무학중 1)
--      · '광희중 2 2학기 중간 직보' 22문항 → 19문항 (무학중 3)
--    ⚠️ `problem_paper_items` 는 `UNIQUE(paper_id, order_index)` 라 번호를 당길 때 두 걸음이
--       필요하다(한 번에 당기면 남아 있는 번호와 부딪힌다).
--    ⚠️ `total_questions`·`source_labels` 도 다시 만든다 — 목록 화면이 그 둘을 읽는다.
--       `source_labels` 는 `create_problem_paper`(sql/35)와 **같은 식**으로 다시 만든다.
--
-- ⚠️ **대상은 id 로 못박고 학교 이름으로 한 번 더 확인한다.** 개수가 어긋나면 EXCEPTION 으로 멈춘다.
-- ⚠️ **멱등하다.** 이미 지웠으면 대상이 0건이고 아무것도 하지 않는다.

SET search_path = exam, public;

DO $drop$
DECLARE
  v_src       UUID[] := ARRAY[
    '1d564d1e-ef54-4ee7-84eb-90bf869fb3f9',  -- 2025 동마중학교 중1 2학기 중간
    '799dcfc1-8d1f-4e46-be4e-57910cbf08fb',  -- 2025 무학중학교 중1 2학기 중간
    '4c855afa-7d27-4cae-a23a-93ffa10e8bd1'   -- 2026 성수고등학교 고1 1학기 기말
  ]::UUID[];
  -- 문제지에서 뺄 항목 — 위 출처의 문항을 담고 있는 13건(2026-09-22 조회)
  v_items     UUID[] := ARRAY[
    '43f39d36-c417-4799-8cca-0013b557884c',  -- 광희중 2 2학기 중간 직보 / 무학중 13
    'f730acdb-cada-493c-953c-b65f057bb2ee',  -- 광희중 2 2학기 중간 직보 / 무학중 14
    'a5b8b697-6a80-4135-b7de-6d423cee40db',  -- 광희중 2 2학기 중간 직보 / 무학중 15
    '3dac44f9-1fc5-4fad-9ac2-55e7ee391496',  -- 행당중 1학년 품사 / 동마중 22
    '627b0c2c-314f-4a10-970f-4e0067d81c58',  -- 행당중 1학년 품사 / 동마중 23
    '31668059-051b-4a60-bc57-084f5af59cb6',  -- 행당중 1학년 품사 / 동마중 24
    '07db5fa0-31c6-4e39-a2cb-3cc3a5f83bdb',  -- 행당중 1학년 품사 / 동마중 25
    '915ebc2b-4a8a-40d9-8b9f-7345b6e2636b',  -- 행당중 1학년 품사 / 동마중 26
    'cc376749-3063-44a9-a21f-3d37a1076753',  -- 행당중 1학년 품사 / 동마중 27
    'c4ac69f2-cd6e-48cd-b587-23ff4428367e',  -- 행당중 1학년 품사 / 동마중 28
    '32778560-6f82-41fb-9d19-3199bd22d139',  -- 행당중 1학년 품사 / 동마중 29
    '54bec270-3645-4966-9faa-6e51423f358e',  -- 행당중 1학년 품사 / 동마중 30
    'c4906b9f-451c-4a75-b52f-494301f6ea7f'   -- 행당중 1학년 품사 / 무학중 18
  ]::UUID[];
  v_live      INT;
  v_bad       INT;
  v_bad_txt   TEXT;
  v_items_now UUID[];
  v_n         INT;
  v_papers    UUID[];
BEGIN
  IF to_regclass('exam.problem_sources') IS NULL OR to_regclass('exam.problem_paper_items') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  RAISE NOTICE '대상 DB=% / 롤=%', current_database(), current_user;

  SELECT count(*) INTO v_live FROM exam.problem_sources WHERE id = ANY (v_src);
  IF v_live = 0 THEN
    RAISE NOTICE '지울 출처가 이미 없습니다 — 아무것도 하지 않습니다.';
    RETURN;
  END IF;

  -- -------------------------------------------
  -- 0. 적용 전 확인 — 대상이 정말 광희중·행당중이 아닌 출처인가
  -- -------------------------------------------
  SELECT count(*), string_agg(school_name || ' ' || coalesce(title, ''), ' / ')
    INTO v_bad, v_bad_txt
    FROM exam.problem_sources
   WHERE id = ANY (v_src) AND school_name IN ('광희중학교', '행당중학교');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '대상에 남겨야 할 학교가 %건 섞였습니다 (%).', v_bad, v_bad_txt;
  END IF;

  -- 광희중·행당중 아닌 출처가 이 목록 **밖에** 또 있으면 멈춘다(그 사이 새로 올라온 것이 있다는 뜻)
  SELECT count(*), string_agg(school_name || ' ' || coalesce(title, ''), ' / ')
    INTO v_bad, v_bad_txt
    FROM exam.problem_sources
   WHERE school_name NOT IN ('광희중학교', '행당중학교') AND NOT (id = ANY (v_src));
  IF v_bad > 0 THEN
    RAISE EXCEPTION '목록에 없는 다른 학교 출처가 %건 있습니다 (%) — 목록을 다시 만들어야 합니다.', v_bad, v_bad_txt;
  END IF;

  SELECT string_agg(school_name || ' ' || coalesce(title, '') || ' (문항 '
           || (SELECT count(*) FROM exam.problems p WHERE p.source_id = s.id) || ' · 지문 '
           || (SELECT count(*) FROM exam.passages q WHERE q.source_id = s.id) || ')', E'\n     ')
    INTO v_bad_txt FROM exam.problem_sources s WHERE s.id = ANY (v_src);
  RAISE NOTICE '0. 지울 출처 %건:%     %', v_live, E'\n', v_bad_txt;

  -- -------------------------------------------
  -- 1. 문제지 항목 — 지금 실제로 걸리는 것과 못박아 둔 목록이 같은가
  -- -------------------------------------------
  SELECT coalesce(array_agg(pi.id ORDER BY pi.id), '{}')
    INTO v_items_now
    FROM exam.problem_paper_items pi
    JOIN exam.problems p ON p.id = pi.problem_id
   WHERE p.source_id = ANY (v_src);

  IF NOT (v_items_now <@ v_items AND v_items_now @> v_items) THEN
    RAISE EXCEPTION '문제지 항목이 못박아 둔 목록(%건)과 다릅니다 (지금 %건) — 그 사이 문제지가 바뀌었습니다.',
      cardinality(v_items), cardinality(v_items_now);
  END IF;

  SELECT coalesce(array_agg(DISTINCT paper_id), '{}') INTO v_papers
    FROM exam.problem_paper_items WHERE id = ANY (v_items);

  DELETE FROM exam.problem_paper_items WHERE id = ANY (v_items);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '1. 문제지 항목 %건 뺐습니다 (문제지 %건)', v_n, cardinality(v_papers);

  -- 번호 당기기 — 유니크(paper_id, order_index) 때문에 두 걸음으로
  UPDATE exam.problem_paper_items SET order_index = order_index + 10000
   WHERE paper_id = ANY (v_papers);

  WITH seq AS (
    SELECT id, row_number() OVER (PARTITION BY paper_id ORDER BY order_index) - 1 AS n
      FROM exam.problem_paper_items WHERE paper_id = ANY (v_papers)
  )
  UPDATE exam.problem_paper_items pi SET order_index = seq.n
    FROM seq WHERE pi.id = seq.id;

  -- 문항 수·출처 줄 다시 만들기 (`create_problem_paper`(sql/35)와 같은 식)
  UPDATE exam.problem_papers pp
     SET total_questions = (SELECT count(*) FROM exam.problem_paper_items pi WHERE pi.paper_id = pp.id),
         source_labels = COALESCE(ARRAY(
           SELECT DISTINCT COALESCE(
             NULLIF(btrim(concat_ws(' ',
               NULLIF(s.year, ''), NULLIF(s.grade, ''),
               NULLIF(s.school_name, ''), NULLIF(s.semester, ''),
               NULLIF(s.exam_type, ''))), ''),
             s.title)
             FROM exam.problem_paper_items pi
             JOIN exam.problems p ON p.id = pi.problem_id
             JOIN exam.problem_sources s ON s.id = p.source_id
            WHERE pi.paper_id = pp.id
            ORDER BY 1
         ), '{}')
   WHERE pp.id = ANY (v_papers);
  RAISE NOTICE '2. 문제지 %건의 문항 수·출처 줄을 다시 만들었습니다', cardinality(v_papers);

  -- -------------------------------------------
  -- 3. Storage 경로를 남긴다 (이 파일은 파일을 지우지 않는다)
  -- -------------------------------------------
  SELECT count(*) INTO v_n FROM (
    SELECT s.file_path FROM exam.problem_sources s WHERE s.id = ANY (v_src) AND coalesce(s.file_path, '') <> ''
    UNION ALL SELECT unnest(s.answer_key_paths) FROM exam.problem_sources s WHERE s.id = ANY (v_src)
    UNION ALL SELECT p.image_path FROM exam.problems p WHERE p.source_id = ANY (v_src) AND coalesce(p.image_path, '') <> ''
    UNION ALL SELECT unnest(p.figure_paths) FROM exam.problems p WHERE p.source_id = ANY (v_src)
    UNION ALL SELECT q.image_path FROM exam.passages q WHERE q.source_id = ANY (v_src) AND coalesce(q.image_path, '') <> ''
    UNION ALL SELECT unnest(q.figure_paths) FROM exam.passages q WHERE q.source_id = ANY (v_src)
  ) t;
  RAISE NOTICE '3. 이 출처들이 들고 있던 Storage 경로 %건 — 파일은 따로 지웁니다(`exam-problem-bank`)', v_n;

  -- -------------------------------------------
  -- 4. 출처 삭제 — 문항·지문은 CASCADE
  -- -------------------------------------------
  DELETE FROM exam.problem_sources WHERE id = ANY (v_src);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '4. 출처 %건 삭제 (문항·지문은 CASCADE)', v_n;

  -- -------------------------------------------
  -- 5. 자가 검증
  -- -------------------------------------------
  SELECT count(*) INTO v_bad FROM exam.problem_sources WHERE id = ANY (v_src);
  IF v_bad > 0 THEN RAISE EXCEPTION '검증 실패: 출처 %건이 남았습니다.', v_bad; END IF;

  SELECT count(*), string_agg(DISTINCT school_name, ', ') INTO v_bad, v_bad_txt
    FROM exam.problem_sources WHERE school_name NOT IN ('광희중학교', '행당중학교');
  IF v_bad > 0 THEN RAISE EXCEPTION '검증 실패: 다른 학교 출처 %건이 남았습니다 (%).', v_bad, v_bad_txt; END IF;

  SELECT count(*) INTO v_bad FROM exam.problems  WHERE source_id = ANY (v_src);
  IF v_bad > 0 THEN RAISE EXCEPTION '검증 실패: 문항 %건이 남았습니다.', v_bad; END IF;
  SELECT count(*) INTO v_bad FROM exam.passages  WHERE source_id = ANY (v_src);
  IF v_bad > 0 THEN RAISE EXCEPTION '검증 실패: 지문 %건이 남았습니다.', v_bad; END IF;

  -- 문제지: 항목이 남김없이 원본 문항을 가리키고, 번호가 0부터 빈틈없이 이어지는가
  SELECT count(*) INTO v_bad
    FROM exam.problem_paper_items pi
   WHERE pi.paper_id = ANY (v_papers) AND pi.problem_id IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 원본이 없는 문제지 항목 %건 (지운 문항이 남았습니다).', v_bad;
  END IF;

  SELECT count(*) INTO v_bad FROM (
    SELECT pi.paper_id FROM exam.problem_paper_items pi
     WHERE pi.paper_id = ANY (v_papers)
     GROUP BY pi.paper_id
    HAVING min(pi.order_index) <> 0 OR max(pi.order_index) <> count(*) - 1
  ) t;
  IF v_bad > 0 THEN RAISE EXCEPTION '검증 실패: 번호가 이어지지 않는 문제지 %건.', v_bad; END IF;

  SELECT count(*) INTO v_bad
    FROM exam.problem_papers pp
   WHERE pp.id = ANY (v_papers)
     AND pp.total_questions <> (SELECT count(*) FROM exam.problem_paper_items pi WHERE pi.paper_id = pp.id);
  IF v_bad > 0 THEN RAISE EXCEPTION '검증 실패: 문항 수가 어긋난 문제지 %건.', v_bad; END IF;

  SELECT count(*), string_agg(pp.title || ': ' || array_to_string(pp.source_labels, ' | '), ' / ')
    INTO v_bad, v_bad_txt
    FROM exam.problem_papers pp
   WHERE pp.id = ANY (v_papers)
     AND EXISTS (SELECT 1 FROM unnest(pp.source_labels) l
                  WHERE l LIKE '%동마중%' OR l LIKE '%무학중%' OR l LIKE '%성수고%');
  IF v_bad > 0 THEN RAISE EXCEPTION '검증 실패: 지운 학교가 출처 줄에 남은 문제지 %건 (%).', v_bad, v_bad_txt; END IF;

  SELECT string_agg(pp.title || ' — ' || pp.total_questions || '문항', ' / ')
    INTO v_bad_txt FROM exam.problem_papers pp WHERE pp.id = ANY (v_papers);
  RAISE NOTICE '5. 자가 검증 통과 — %', v_bad_txt;
END
$drop$;
