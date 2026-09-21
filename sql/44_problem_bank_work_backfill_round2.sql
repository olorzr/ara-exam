-- =============================================
-- 44. 기출 문제 은행 — 작품명 되찾기 2차 (sql/43 이 채운 이름이 새 근거가 됐다)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/44_problem_bank_work_backfill_round2.sql
-- =============================================
-- 배경 (2026-09-22, sql/43 적용 직후 다시 훑어 나온 것):
--   되찾기는 **본문이 같은데 이름이 있는 지문**을 근거로 삼는다. 그래서 sql/43 이 27건에
--   이름을 붙이자 **그 27건이 다시 근거가 되어** 6건이 새로 드러났다 — 되찾기는 한 번으로
--   끝나지 않고 **더 나오지 않을 때까지 돌려야 한다**(이번 2차에서 멈췄다).
--   예: 『정전기가 겨울로 간 까닭은』은 sql/42 가 표기를 합치고 sql/43 이 빈 칸을 채운 뒤에야
--   두 학교의 짧은 발췌 5건과 본문이 이어졌다.
--
-- ⚠️ 겹친 대목을 눈으로 확인했고(정전기 5건은 "정전기란 전하가 정지 상태로…" 첫 문단,
--    잊힐 권리 1건은 "개인정보 자기 결정권" 문단), 교과서 수록작 목록과도 대조했다.
-- ⚠️ 멱등하다 — 비어 있을 때만 채운다.
-- =============================================

DO $round2$
DECLARE
  v_n INT;
  v_bad INT;
BEGIN
  UPDATE exam.passages p
     SET works = jsonb_build_array(jsonb_build_object(
                   'label', '', 'title', m.title, 'author', m.author))
    FROM (VALUES
      ('8e1331f8-740d-5ae9-8545-8d3caa56d8f8'::UUID, '잊힐 권리의 법제화',        ''),
      ('adbc4dc0-c85b-5a99-af6c-bc4045ad229c'::UUID, '정전기가 겨울로 간 까닭은', '김정훈'),
      ('0b16da92-1134-50bc-b4e9-911e27dfafd6'::UUID, '정전기가 겨울로 간 까닭은', '김정훈'),
      ('c17120ed-8b08-577c-87f7-5c3c4ffdb3c7'::UUID, '정전기가 겨울로 간 까닭은', '김정훈'),
      ('5b309596-5650-5ed9-b4cb-6f25b9c24609'::UUID, '정전기가 겨울로 간 까닭은', '김정훈'),
      ('4a62b842-937d-5186-b6c3-41d7397c5461'::UUID, '정전기가 겨울로 간 까닭은', '김정훈'),
      -- 본문 대조로는 짝이 없었다. 교과서 수록작 목록에서 찾았다 —
      -- 김문태 「서당 일일 훈장이 된 김득신」(천재교육 박영목 외, 기타, 추가 읽기 자료).
      -- 다독으로 이름난 김득신이 학동들에게 책 읽기를 이야기하는 글이다
      ('9ea04e19-fd73-5849-8603-d1a8ac9a04bf'::UUID, '서당 일일 훈장이 된 김득신', '김문태')
    ) AS m(id, title, author)
   WHERE p.id = m.id
     AND jsonb_array_length(p.works) = 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '1. 빈 지문 %건에 작품명을 채웠습니다 (재실행이면 0)', v_n;

  -- 자가 검증 — sql/41 의 불변식
  SELECT count(*) INTO v_bad
    FROM exam.problems pr JOIN exam.passages q ON q.id = pr.passage_id
   WHERE NOT (pr.work_titles <@ exam.works_titles(q.works));
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 지문에 없는 작품을 묻는 문항 %건.', v_bad;
  END IF;

  SELECT count(*) INTO v_bad FROM exam.passages WHERE jsonb_array_length(works) = 0;
  RAISE NOTICE '2. 아직 작품명이 빈 지문 %건 (대화·강연·활동 자료가 대부분이다)', v_bad;
  RAISE NOTICE '3. 자가 검증 통과';
END
$round2$;
