-- =============================================
-- 42. 기출 문제 은행 — 갈라진 작품 표기를 합치고, 〈보기〉에만 실린 글을 작품 축에서 뺀다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/42_problem_bank_work_title_merge.sql
-- =============================================
-- 배경 (2026-09-22, 제보 "문학 작품에서 중복 되는 것이 있음 … 동해바다-후포에서가 3개나
--   중복되어서 다른 이름으로 써있다 / 한중일 삼국의 젓가락도 한중일 삼국의 식사 문화와
--   젓가락으로 2개로 나뉘어져 있음 / 정전기가 겨울로 간 까닭은도 정전기랑 정전기 예방법으로
--   나뉘어져 있어 / 그린 북은 … 하늘은 맑건만 안에만 있으면 좋을 것 같아"):
--   같은 제보의 다른 항목들(잊었노라→먼 후일, 서시, 청노루·엄마야 누나야 지은이 어긋남,
--   풀꽃)은 **sql/39·41 이 이미 고쳤다** — 이 파일은 그 뒤에 남은 것만 다룬다.
--
-- 왜 표기가 갈렸는가: 작품 축에는 마스터 표가 없고(`work-tree.ts` 규약) 시험지에 인쇄된
--   이름이 그대로 쌓인다. 같은 글을 학교·연도마다 다르게 인쇄하면 작품 트리에 잎이 여럿 선다.
--   `exam.normalize_work_title` 은 감싸는 기호만 벗기므로 붙임표·띄어쓰기는 손대지 않는다
--   (안쪽까지 건드리면 뜻이 있는 표기가 뭉개진다) — 그래서 **사람이 정한 대표 표기로 합친다**.
--
-- ⚠️ **대표 표기는 시험지에 인쇄된 출처 표기를 따랐다.** 지어낸 이름이 아니다:
--   · 정전기  → 2021 광희중 지문 끝에 `- 김정훈, 「정전기가 겨울로 간 까닭은」 중에서`
--   · 젓가락  → 2021 광희중 지문 끝에 `- 김경은, 「한중일 삼국의 젓가락」`
--     (2024·2025 의 '한중일 삼국의 식사 문화와 젓가락' 은 인쇄된 이름이 아니라 첫 문단
--      "이 글에서는 한중일 삼국의 식사 문화와 … 살펴보고자 한다" 에서 딴 값이다)
--   · 동해 바다 → 인쇄된 표기가 학교마다 갈려(광희중 2023 은 '동해바다-후포에서') 정답이
--     없다. **사용자가 `'동해 바다 - 후포에서'` 를 골랐다**(지금 가장 많이 쌓인 표기이기도 하다).
--
-- ⚠️ **지문만 고친다 — 문항은 트리거가 따라온다.** `passages_sync_work_titles`(sql/33 §5)가
--    `exam.rename_work_titles` 로 자리 기준 이름 바꾸기를 해 준다. 여기 대상은 전부 작품이
--    한 편뿐인 지문이라 '옛 목록이 두 편 이상일 때만 넓힌다' 가지에도 안 걸린다 — 문항 25건이
--    저절로 따라온다. 문항을 손으로 고치면 그 둘이 어긋날 때 어느 쪽이 참인지 알 수 없어진다.
-- ⚠️ **구분 표시(label)는 지금 값을 그대로 물려준다.** sql/39 가 사람이 읽고 붙인 값이라
--    `''` 로 덮으면 그 일이 지워진다(여기 대상은 지금 전부 `''` 이지만, 나중에 붙을 수 있다).
-- ⚠️ **작품이 지금도 한 편인 지문만 고친다**(`works_titles(works) = ARRAY[옛 이름]`).
--    검수에서 (나)가 더 붙은 지문을 통째로 덮으면 그 작품이 말없이 사라진다.
-- ⚠️ **멱등하다.** 한 번 합치고 나면 옛 이름이 없어 다시 안 걸린다(재실행하면 0건).
--
-- 감사 트리거는 **끄지 않는다** — 손대는 행이 지문 7 · 문항 28건뿐이고, 이런 교정이야말로
-- `exam.audit_log` 에 남아야 한다(sql/33 백필이 끈 것은 1,193건짜리였기 때문이다).
-- =============================================

DO $merge$
DECLARE
  v_n INT;
  v_bad INT;
  v_txt TEXT;
BEGIN
  -- -------------------------------------------
  -- 1. 갈라진 표기를 대표 표기로 합친다 (지문만)
  -- -------------------------------------------
  UPDATE exam.passages p
     SET works = jsonb_build_array(jsonb_build_object(
                   -- 지금 붙어 있는 구분 표시를 지킨다(sql/39 가 사람이 읽고 붙인 값이다)
                   'label',  COALESCE(p.works -> 0 ->> 'label', ''),
                   'title',  m.new_title,
                   'author', m.new_author))
    FROM (VALUES
      -- 동해 바다 — 붙임표·띄어쓰기가 갈렸다 (전각 '－', 공백 없는 '-')
      ('8b4472f9-05d4-5efc-9498-e4599c5a38f9'::UUID, '동해 바다 － 후포에서',
       '동해 바다 - 후포에서', '신경림'),
      ('65cb613c-31fa-5186-b949-916c8290023d'::UUID, '동해바다-후포에서',
       '동해 바다 - 후포에서', '신경림'),
      -- 젓가락 — 첫 문단에서 딴 이름이 인쇄된 제목을 밀어냈다. 지은이도 함께 채운다
      ('7b261009-265e-5830-966a-b84ecc7f1967'::UUID, '한중일 삼국의 식사 문화와 젓가락',
       '한중일 삼국의 젓가락', '김경은'),
      ('b0cba07a-4804-5bce-b467-d85d7f4ce1dd'::UUID, '한중일 삼국의 식사 문화와 젓가락',
       '한중일 삼국의 젓가락', '김경은'),
      -- 정전기 — 같은 글의 다른 대목이 제각기 이름을 얻었다('정전기', '정전기 예방법')
      ('54d982d5-c59e-596b-8b85-294f3a455ab6'::UUID, '정전기',
       '정전기가 겨울로 간 까닭은', '김정훈'),
      ('7a45b664-d0e1-5583-a727-17a1d7ecb4f4'::UUID, '정전기',
       '정전기가 겨울로 간 까닭은', '김정훈'),
      ('3c91a421-e819-5ca7-8662-06a7c8666eb1'::UUID, '정전기 예방법',
       '정전기가 겨울로 간 까닭은', '김정훈')
    ) AS m(id, old_title, new_title, new_author)
   WHERE p.id = m.id
     -- 작품이 지금도 그 한 편일 때만 — 그 사이 (나)가 붙었으면 건드리지 않는다
     AND exam.works_titles(p.works) = ARRAY[m.old_title];
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '1. 지문 %건의 작품 표기를 합쳤습니다 (재실행이면 0)', v_n;

  -- -------------------------------------------
  -- 2. 〈보기〉에만 실린 글을 작품 축에서 뺀다
  -- -------------------------------------------
  -- 셋 다 지문 없는 단독 문항이라 `merge.ts` 의 "지문에 없는 이름은 버린다" 대조가 돌지 않아
  -- 들어왔다. 〈보기〉는 문항이 딸고 온 참고 자료지 이 시험지가 묻는 작품이 아니다 —
  -- 그대로 두면 작품 트리에 문항 한두 건짜리 잎이 서고, 지은이·갈래를 긁어올 지문이 없어
  -- '영역 미지정 › 지은이 미입력' 폴더에 떨어진다.
  -- ⚠️ `passage_id IS NULL` 이라 `exam.fill_problem_work_titles` 가 다시 채우지 않는다.
  UPDATE exam.problems
     SET work_titles = ARRAY['하늘은 맑건만']   -- 『그린 북』은 〈보기〉의 줄거리 요약일 뿐이다
   WHERE id = 'ea842051-a84a-40a8-b009-a6140c37e412'
     AND work_titles @> ARRAY['그린 북'];
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '2. 그린 북을 뺐습니다 — 문항 %건 (재실행이면 0)', v_n;

  -- 서정홍 「우리말 사랑 1」 도 〈보기〉에만 실렸다. 이 둘은 다른 작품 태그가 없어 작품
  -- 트리에서는 사라진다 — 학교 기출·문법 트리와 검색으로는 그대로 찾힌다(사용자 결정).
  UPDATE exam.problems
     SET work_titles = '{}'::TEXT[]
   WHERE id IN ('c314f352-d59c-571d-8561-af1658cc23c0',
                'ff520cb1-29ee-546a-9051-5b597969f1c3')
     AND cardinality(work_titles) > 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '3. 우리말 사랑 1 을 뺐습니다 — 문항 %건 (재실행이면 0)', v_n;

  -- -------------------------------------------
  -- 자가 검증
  -- -------------------------------------------
  -- ① 합친 옛 이름이 지문·문항 어디에도 안 남았는가 (문항은 트리거가 따라왔어야 한다)
  SELECT count(*), string_agg(DISTINCT t, ', ')
    INTO v_bad, v_txt
    FROM (
      SELECT (jsonb_array_elements(works) ->> 'title') t FROM exam.passages
      UNION ALL
      SELECT unnest(work_titles) FROM exam.problems
    ) s
   WHERE t IN ('동해 바다 － 후포에서', '동해바다-후포에서',
               '한중일 삼국의 식사 문화와 젓가락', '정전기', '정전기 예방법',
               '그린 북', '우리말 사랑 1');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 합쳤어야 할 옛 작품명이 %건 남았습니다 (%).', v_bad, v_txt;
  END IF;

  -- ② 대표 표기로 모인 문항 수 — 갈라져 있던 수의 합과 같아야 한다
  FOR v_txt, v_n IN
    SELECT t, count(*)::INT
      FROM exam.problems, unnest(work_titles) t
     WHERE t IN ('동해 바다 - 후포에서', '한중일 삼국의 젓가락', '정전기가 겨울로 간 까닭은')
     GROUP BY t ORDER BY t
  LOOP
    RAISE NOTICE '4. % — 문항 %건', v_txt, v_n;
  END LOOP;

  -- ③ sql/41 의 불변식을 깨지 않았는가 — 문항은 딸린 지문의 작품만 물어야 한다
  SELECT count(*), string_agg(DISTINCT left(pr.id::text, 8), ', ')
    INTO v_bad, v_txt
    FROM exam.problems pr JOIN exam.passages q ON q.id = pr.passage_id
   WHERE NOT (pr.work_titles <@ exam.works_titles(q.works));
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 지문에 없는 작품을 묻는 문항 %건 (%).', v_bad, v_txt;
  END IF;

  -- ④ 작품이 통째로 빈 문항은 지문 없는 단독 문항뿐이어야 한다
  SELECT count(*) INTO v_bad
    FROM exam.problems pr JOIN exam.passages q ON q.id = pr.passage_id
   WHERE cardinality(pr.work_titles) = 0 AND jsonb_array_length(q.works) > 0;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 작품이 통째로 빈 문항 %건.', v_bad;
  END IF;

  RAISE NOTICE '5. 자가 검증 통과';
END
$merge$;
