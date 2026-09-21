-- =============================================
-- 45. 기출 문제 은행 — (다) 자리의 「거울」을 지문에 붙이고, 그 구역을 묻는 문항에만 단다
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/45_problem_bank_add_third_work_georum.sql
-- =============================================
-- 배경 (2026-09-22, 사용자 결정 "붙여"):
--   「모진 소리 · 따뜻한 말」 지문 3건은 실제로 **세 편**을 싣고 있다 —
--   (가) 황인숙 「모진 소리」 · (나) 김지호(학생글) 「따뜻한 말」 · (다) 조은서(학생글) 「거울」.
--   본문의 `<blockquote data-box>` 도 가·나·다 셋이고, 발문도 (다)를 짚는다.
--   sql/43 이 「거울」 단독 발췌 3건에는 이름을 붙였지만, 세 편이 함께 실린 이 지문들에는
--   (다)가 빠져 있었다.
--
-- ⚠️⚠️ **전파 트리거를 끄고 문항을 직접 맞춘다**(`exam.skip_work_sync`).
--   `sync_passage_works_to_problems`(sql/33 §5)는 "옛 목록과 집합이 같으면 새 목록 전부를
--   물려준다" 인데, 옛 목록이 두 편이라 **그 가지를 탄다** — 그대로 두면
--   `(가)와 (나)를 감상한 내용으로…` 처럼 시 두 편만 묻는 문항까지 **「거울」을 묻는 문항이
--   된다.** 없는 사실을 지어내는 쪽이라, 끄고 **발문이 (다)를 짚은 문항에만** 손으로 단다.
--
-- ⚠️ **발문이 구역을 안 짚은 문항(`㉠~㉤에 대한 설명으로…`)은 건드리지 않는다.**
--    그 기호가 어느 상자에 있는지 발문만으로는 알 수 없다 — sql/41 의
--    "짚은 구역에 작품이 없으면 건드리지 않는다" 와 같은 규약이다.
--
-- ⚠️ **작품 차례는 읽는 순서**(가 → 다)다. `array_agg(DISTINCT …)` 처럼 가나다순으로
--    다시 세우면 파생 문자열이 '거울 · 모진 소리' 로 뒤집힌다(sql/41 규약).
--
-- ⚠️ 참고 — sql/41 이 이 지문의 `[가]`·`[나]` 대괄호 표기를 못 좁혔다(괄호 표기만 봤다).
--    행당중 2024 의 15·16·18 번이 한 구역만 묻는데 두 편으로 남아 있다. **이 파일에서는
--    손대지 않는다**(「거울」과 무관하고, 좁히기는 따로 볼 일이다).
-- ⚠️ 멱등하다 — 이미 세 편이면 WHERE 에 안 걸린다.
-- =============================================

DO $georum$
DECLARE
  v_prev TEXT;
  v_n INT;
  v_bad INT;
  v_txt TEXT;
BEGIN
  v_prev := COALESCE(current_setting('exam.skip_work_sync', true), '');
  PERFORM set_config('exam.skip_work_sync', 'on', true);

  -- 1. (다) 자리에 「거울」을 더한다
  UPDATE exam.passages p
     SET works = p.works || jsonb_build_array(
                   jsonb_build_object('label', '다', 'title', '거울', 'author', '조은서(학생글)'))
   WHERE p.id IN ('e857927c-ddf2-5e03-be83-e329ef1ae7e9',   -- 광희중 2023 중2
                  '8c733d7d-012b-54e5-9f9e-167068e49af6',   -- 광희중 2024 중2
                  'ce10763b-3632-54b8-9505-21a8d6606355')   -- 행당중 2024 중2
     AND exam.works_titles(p.works) = ARRAY['모진 소리', '따뜻한 말'];
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '1. 지문 %건에 (다) 「거울」을 더했습니다 (재실행이면 0)', v_n;

  PERFORM set_config('exam.skip_work_sync', v_prev, true);

  -- 2. 발문이 (다)를 짚은 문항에만 「거울」을 단다
  UPDATE exam.problems q
     SET work_titles = m.titles
    FROM (VALUES
      -- '(다)는 (가)를 재구성한 소설이다'
      ('6f92faa5-79b1-5443-afc0-de61db2663dd'::UUID, ARRAY['모진 소리','거울']),
      -- '(가)를 (다)로 재구성할 때 쓴 계획서'
      ('efba2a56-235e-5608-9ae4-a1c08b09da31'::UUID, ARRAY['모진 소리','거울']),
      -- '(다)에서 민아가 현우에게 한 모진 소리를' — (다) 하나만 묻는다
      ('207bd8a7-b0a6-5586-9553-9ee10aa7a230'::UUID, ARRAY['거울']),
      -- '(가)를 (다)로 재구성할 때 반영하지 않은 것은?'
      ('b63edf37-ea50-5c25-8e21-6730c66df04f'::UUID, ARRAY['모진 소리','거울']),
      -- '[다]의 문맥을 고려하여 볼 때' — [다] 하나만 묻는다
      ('e0862994-026f-501c-8c40-3e6d0652cbee'::UUID, ARRAY['거울']),
      -- '[다]는 [가]를 재구성한 것이다'
      ('14a2964f-30cd-57e9-9e4c-c9a1d69b17e4'::UUID, ARRAY['모진 소리','거울']),
      -- '[다]와 [가]를 비교하여 감상한 내용'
      ('b4561ea7-123f-50f9-b8a7-3affdf825f1e'::UUID, ARRAY['모진 소리','거울'])
    ) AS m(id, titles)
   WHERE q.id = m.id
     AND q.work_titles IS DISTINCT FROM m.titles;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '2. (다)를 묻는 문항 %건에 「거울」을 달았습니다 (재실행이면 0)', v_n;

  -- -------------------------------------------
  -- 자가 검증
  -- -------------------------------------------
  -- ① 세 지문이 모두 세 편을 들고 있는가
  SELECT count(*) INTO v_bad
    FROM exam.passages
   WHERE id IN ('e857927c-ddf2-5e03-be83-e329ef1ae7e9',
                '8c733d7d-012b-54e5-9f9e-167068e49af6',
                'ce10763b-3632-54b8-9505-21a8d6606355')
     AND exam.works_titles(works) IS DISTINCT FROM ARRAY['모진 소리', '따뜻한 말', '거울'];
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: (다)가 안 붙었거나 차례가 어긋난 지문 %건.', v_bad;
  END IF;

  -- ② 전파 트리거가 다른 문항까지 넓히지 않았는가 — (다)를 안 짚은 문항에 「거울」이 있으면 안 된다
  SELECT count(*), string_agg(left(q.id::text, 8), ', ')
    INTO v_bad, v_txt
    FROM exam.problems q
   WHERE q.passage_id IN ('e857927c-ddf2-5e03-be83-e329ef1ae7e9',
                          '8c733d7d-012b-54e5-9f9e-167068e49af6',
                          'ce10763b-3632-54b8-9505-21a8d6606355')
     AND q.work_titles @> ARRAY['거울']
     AND NOT (q.stem_html ~ '\(다\)' OR q.stem_html ~ '\[다\]');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: (다)를 안 짚었는데 「거울」이 붙은 문항 %건 (%).', v_bad, v_txt;
  END IF;

  -- ③ sql/41 의 불변식
  SELECT count(*) INTO v_bad
    FROM exam.problems pr JOIN exam.passages q ON q.id = pr.passage_id
   WHERE NOT (pr.work_titles <@ exam.works_titles(q.works));
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 지문에 없는 작품을 묻는 문항 %건.', v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM exam.problems, unnest(work_titles) t WHERE t = '거울';
  RAISE NOTICE '3. 「거울」 — 문항 %건', v_n;
  RAISE NOTICE '4. 자가 검증 통과';
END
$georum$;
