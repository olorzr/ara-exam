-- =============================================
-- 48. 기출 문제 은행 — 원본에 없는 구역 상자 표시를 벗긴다 (데이터 교정)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/48_problem_bank_unwrap_passage_frame_boxes.sql
-- =============================================
-- 배경 (2026-09-27, 제보 "초등 문학 시험지~! 6쪽 춘향전이 깨져서 나온다"):
--   대원국제중 시험지는 **모든 지문을 테두리 상자 안에** 찍는다. OCR 이 그 테두리를
--   `<blockquote data-box="가">`(일부는 "보기") 구역으로 읽어, 지문 전체가 상자 하나에 담긴 채 저장됐다.
--   인쇄 엔진은 최상위 요소 하나를 쪼갤 수 없는 블록으로 다루므로 3,416자 춘향전이 한 블록이 되어
--   한 쪽을 넘겼고, 통째로 축소돼 깨알같이 찍혔다. 앱(0.9.26)은 이제 상자를 문단 단위로 터뜨려
--   더는 축소되지 않지만, **원본에 없는 '(가)' 머리글**이 찍히는 것은 데이터를 고쳐야 한다.
--
-- ⚠️ **사람이 원본 쪽 이미지를 한 장씩 보고 정한 목록이다**(sources/{source_id}/pages/{page_no}.jpg).
--    대원국제중 출처에서 '맨 앞이 상자이고 상자가 하나뿐인' 지문 35건을 전부 대조했고, 34건은 (가)·〈보기〉
--    글자 없이 테두리만 있었다. 32건은 지문 전체를, 2건(85766245·5a3dde28)은 맨 앞 '앞부분 줄거리'
--    문단만 〈보기〉 로 감싸 두었다 — 원본은 둘 다 상자 없는 문단이다. 나머지 한 건은 **여기 넣지 않았다**(아래 후속).
-- ⚠️ 상자 태그만 벗기고 안쪽 HTML 은 **글자 하나 바꾸지 않는다** — 검증이 태그를 뺀 평문을 전후로 견준다.
-- ⚠️ 멱등하다. 아직 맨 앞에 `<blockquote data-box="가|보기">` 가 있고 상자가 **하나뿐인** 행만 벗긴다(재실행 0행).
-- ⚠️ 어느 앱 버전에서나 안전하다 — 벗긴 지문은 평범한 `<p>` 문단들이라 옛 앱도 문단 단위로 쪼갠다.
-- ⚠️ 문제지 스냅샷(problem_paper_items)도 **함께 고친다**(sql/36 과 같은 '표시 교정' 규약 — 내용이 아니라
--    원본에 없는 상자 표시를 걷는 일이다). 적용 날 이 결함을 든 문제지는 '초등 문학 시험지~!' 하나(4항목)였다.
-- 감사 트리거는 켠 채 둔다(34행 — sql/36 도 켠 채 32행을 고쳤다). `works`·제목은 건드리지 않으므로
--   작품명 전파 트리거는 돌지 않는다. `updated_at` 은 오르므로 그 지문을 열어 둔 검수 탭은 저장이 충돌로
--   튕길 수 있다(정상 — 다시 읽으면 된다).
--
-- 후속(이 파일 범위 밖 — 2026-09-27 정정):
--   · a854a665-8724-42db-aec1-8658ea2ef86d (2024 대원국제중 중3 1학기 중간 4쪽, 코르니유 영감의 비밀) —
--     [A] 는 진짜 구간 표시이고, 저장된 상자도 **이미 앞 두 문단만** 감싸고 있어 원본과 같다. 고칠 것 없음.
--     (처음에 '지문 전체를 감쌌다' 고 적었던 것은 조사 쿼리의 끝 기준이 빠진 오판이었다)
--   · 452a376b-9df9-4bd9-b37b-827589d8467e (2022 대원국제중 중3 2학기 기말 4쪽, 에어컨 토론) — 원본의 [A] 는
--     '(반대1) 현중' 첫 문단 전체에 걸린 괄호인데 DB 에는 밑줄 친 글자 "[A] …" 로 들어가 있었다 → sql/49 가 고쳤다.

SET search_path = exam, public;

DO $unwrap$
DECLARE
  v        INT;
  v_total  INT := 0;
  -- 원본 대조를 마친 지문(34건). 출처·쪽은 사람이 확인한 자리다
  c_ids    CONSTANT UUID[] := ARRAY[
    '186eca46-bbc9-4574-8fe0-ad2fc4656192'::uuid,  -- 2022 중2 1학기 기말 6쪽
    '0325374b-d914-48e3-a71c-077a63e25cc9'::uuid,  -- 2022 중2 1학기 중간 3쪽
    'b00b1ac2-390c-4a03-a438-5d9fb766aa3d'::uuid,  -- 2022 중2 1학기 중간 5쪽
    '5d4d8616-883c-4a85-82fc-69b0d3ce89cd'::uuid,  -- 2022 중2 2학기 기말 6쪽
    '0d12ac46-31b9-46bb-a968-28cbdb3c4ef6'::uuid,  -- 2022 중2 2학기 기말 7쪽
    '6ecb7c0e-4b2b-4b8c-910b-56ec0acc0fd8'::uuid,  -- 2022 중2 2학기 기말 7쪽
    '5a284d54-12d3-40dc-a22e-785c4b57e879'::uuid,  -- 2022 중2 2학기 기말 7쪽
    '671afe5e-5f3e-40c8-a36b-8955b3d5b222'::uuid,  -- 2022 중2 2학기 중간 2쪽
    'b111483f-a9a5-41db-bddd-7193dab85e94'::uuid,  -- 2022 중2 2학기 중간 4쪽
    'dd255513-2bfc-4f81-9060-3f8592fb7941'::uuid,  -- 2022 중2 2학기 중간 4쪽
    'f4892df6-c254-4531-a3ec-2054ec2aaf1d'::uuid,  -- 2022 중3 1학기 기말 3쪽
    '6d89fd0e-49f8-42ce-8570-976a1a2c92ce'::uuid,  -- 2022 중3 1학기 기말 6쪽
    'ff58ab88-df06-4a94-b361-92efc78cbe2a'::uuid,  -- 2022 중3 1학기 기말 8쪽
    'b28d0cef-f470-478f-99ea-29c88bc5e7c6'::uuid,  -- 2022 중3 1학기 기말 9쪽
    '73fdffbc-62de-45d1-b118-bf3e3569e35c'::uuid,  -- 2022 중3 1학기 중간 3쪽
    '4df352bd-3277-453c-bcee-e104ca882bde'::uuid,  -- 2022 중3 1학기 중간 4쪽
    'b006fdbb-bc5f-456c-a452-9119a2dac532'::uuid,  -- 2022 중3 1학기 중간 4쪽
    '669e2c87-95bc-4428-8443-4801fcad242b'::uuid,  -- 2022 중3 1학기 중간 5쪽
    '27007d2b-328a-4854-8898-ff7be60ef141'::uuid,  -- 2022 중3 1학기 중간 6쪽
    'a368086b-0259-4d05-8814-e67f283e1383'::uuid,  -- 2022 중3 2학기 기말 2쪽
    '89cee8cc-2aa2-4196-80b4-23e2846de839'::uuid,  -- 2022 중3 2학기 기말 3쪽
    '452a376b-9df9-4bd9-b37b-827589d8467e'::uuid,  -- 2022 중3 2학기 기말 4쪽
    'b539a8fb-c373-4dcc-9e68-7c57627823dc'::uuid,  -- 2022 중3 2학기 기말 6쪽
    '4bfa7e61-7965-4ffd-a27c-66302b5c40ec'::uuid,  -- 2022 중3 2학기 기말 7쪽
    '2ef8fb1c-3ca1-42ac-9ac6-add1bc472272'::uuid,  -- 2022 중3 2학기 기말 8쪽
    '6587a62b-5a8b-4ebd-959b-bf76e0bd8d5e'::uuid,  -- 2022 중3 2학기 중간 2쪽
    'b4caf8a7-e554-4fcb-a7c1-e80b606e89b4'::uuid,  -- 2022 중3 2학기 중간 2쪽
    '689d09ff-e40f-49e8-a62f-f9d534dcd2e5'::uuid,  -- 2022 중3 2학기 중간 2쪽
    'eb3a55b0-da41-4f10-9c2a-f1a922451b24'::uuid,  -- 2022 중3 2학기 중간 3쪽
    'b2b049af-a52c-4b08-9431-684f7f38fec9'::uuid,  -- 2022 중3 2학기 중간 6쪽
    '8314eccc-3fd9-44aa-8e2b-805a6659dde3'::uuid,  -- 2022 중3 2학기 중간 6쪽
    '85766245-97ef-4cb4-9eec-449169bf62f0'::uuid,  -- 2023 중2 1학기 기말 5쪽
    'd2c1dc56-734e-4421-b71b-b7df09b7d197'::uuid,  -- 2023 중2 1학기 중간 11쪽
    '5a3dde28-02c1-4676-a7ba-71716f486e8c'::uuid   -- 2024 중3 1학기 기말 10쪽
  ];
  -- 맨 앞의 상자 하나 — 안쪽(\1)과 뒤따르는 문단(\2)을 잡아 태그만 뺀다. 상자가 하나뿐일 때만 쓰므로
  -- 욕심쟁이 `(.*)` 가 닿는 `</blockquote>` 는 그 상자의 닫는 태그다(ARE 의 `.` 는 줄바꿈도 잡는다)
  c_box    CONSTANT TEXT := '^\s*<blockquote data-box="(?:가|보기)">(.*)</blockquote>(.*)$';
  c_paper  CONSTANT UUID := '7593549f-89c0-40e0-b850-efa6cd6318ac';  -- 초등 문학 시험지~!
  c_chun   CONSTANT UUID := '0d12ac46-31b9-46bb-a968-28cbdb3c4ef6';  -- 춘향전
BEGIN
  IF to_regclass('exam.passages') IS NULL OR to_regclass('exam.problem_paper_items') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  RAISE NOTICE '대상 DB=% / 롤=%', current_database(), current_user;

  -- -------------------------------------------
  -- 0. 목록 검증
  -- -------------------------------------------
  SELECT count(*) INTO v FROM exam.passages WHERE id = ANY (c_ids);
  IF v <> cardinality(c_ids) THEN
    RAISE EXCEPTION '대상 지문 %건 중 %건만 찾았다 — 목록을 다시 볼 것', cardinality(c_ids), v;
  END IF;
  -- 아직 감싸인 행은 상자가 **하나뿐**이어야 한다(둘 이상이면 통째 상자가 아니다 — 안쪽 상자를 잃는다)
  SELECT count(*) INTO v FROM exam.passages
   WHERE id = ANY (c_ids) AND html ~ c_box
     AND array_length(regexp_split_to_array(html, '<blockquote'), 1) <> 2;
  IF v > 0 THEN RAISE EXCEPTION '%건은 상자가 둘 이상이다 — 목록에서 뺄 것', v; END IF;

  DROP TABLE IF EXISTS pg_temp.frame_before;  -- 같은 세션에서 다시 돌려도 되게
  CREATE TEMP TABLE frame_before ON COMMIT DROP AS
    SELECT id, regexp_replace(html, '<[^>]+>', '', 'g') AS plain
      FROM exam.passages WHERE id = ANY (c_ids);

  SELECT count(*) INTO v FROM exam.passages WHERE id = ANY (c_ids) AND html ~ c_box;
  RAISE NOTICE '0. 목록 %건 중 아직 감싸인 지문 %건 (재실행이면 0)', cardinality(c_ids), v;

  -- -------------------------------------------
  -- 1. 지문 — 상자 태그만 벗긴다
  -- -------------------------------------------
  UPDATE exam.passages
     SET html = regexp_replace(html, c_box, '\1\2')
   WHERE id = ANY (c_ids) AND html ~ c_box
     AND array_length(regexp_split_to_array(html, '<blockquote'), 1) = 2;
  GET DIAGNOSTICS v = ROW_COUNT;
  v_total := v_total + v;
  RAISE NOTICE '1. 지문 상자 벗김: %건', v;

  -- -------------------------------------------
  -- 2. 문제지 스냅샷 — 같은 지문을 든 항목 전부(같은 조건으로만)
  -- -------------------------------------------
  UPDATE exam.problem_paper_items
     SET snapshot = jsonb_set(snapshot, '{passage,html}',
                              to_jsonb(regexp_replace(snapshot->'passage'->>'html', c_box, '\1\2')))
   WHERE snapshot->'passage'->>'id' = ANY (c_ids::text[])
     AND (snapshot->'passage'->>'html') ~ c_box
     AND array_length(regexp_split_to_array(snapshot->'passage'->>'html', '<blockquote'), 1) = 2;
  GET DIAGNOSTICS v = ROW_COUNT;
  v_total := v_total + v;
  RAISE NOTICE '2. 문제지 스냅샷: %건 (첫 실행 기대 4 — 초등 문학 시험지~! 의 춘향전 4항목)', v;

  -- -------------------------------------------
  -- 검증 — 하나라도 어긋나면 통째로 되돌아간다
  -- -------------------------------------------
  SELECT count(*) INTO v FROM exam.passages WHERE id = ANY (c_ids) AND html ~ '<blockquote';
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 대상 지문 %건에 상자가 남았다', v; END IF;

  SELECT count(*) INTO v FROM exam.passages p JOIN frame_before b ON b.id = p.id
   WHERE regexp_replace(p.html, '<[^>]+>', '', 'g') <> b.plain;
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 대상 지문 %건의 글자가 바뀌었다(태그만 벗겨야 한다)', v; END IF;

  SELECT count(*) INTO v FROM exam.passages WHERE id = ANY (c_ids) AND btrim(html) = '';
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 대상 지문 %건이 비었다', v; END IF;

  SELECT count(*) INTO v FROM exam.problem_paper_items
   WHERE snapshot->'passage'->>'id' = ANY (c_ids::text[]) AND (snapshot->'passage'->>'html') ~ '<blockquote';
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 스냅샷 %건에 상자가 남았다', v; END IF;

  SELECT count(*) INTO v FROM exam.problem_paper_items i JOIN exam.passages p ON p.id = c_chun
   WHERE i.paper_id = c_paper AND i.snapshot->'passage'->>'id' = c_chun::text
     AND i.snapshot->'passage'->>'html' = p.html;
  IF v <> 4 THEN RAISE EXCEPTION '검증 실패: 춘향전 스냅샷 %건만 원본과 같다(4 기대)', v; END IF;

  RAISE NOTICE '검증 통과 — 이번에 바꾼 행 %건 (재실행이면 0)', v_total;
END
$unwrap$;
