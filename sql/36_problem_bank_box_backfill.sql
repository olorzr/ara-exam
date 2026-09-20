-- =============================================
-- 36. 기출 문제 은행 — 〈보기〉 상자 말머리 백필 (데이터 교정)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/36_problem_bank_box_backfill.sql
-- =============================================
-- 배경 (2026-09-20, 제보 "동마중 2025 중1 2학기 중간 — 보기 설정이 아예 안 됐다"):
--   인쇄 CSS 는 `blockquote[data-box]` 만 상자로 그린다. 그런데 OCR 이 말머리 없이 낸
--   `<blockquote>` 가 문항 15건에 남아 있었다 — 시험지에 '〈보기〉' 가 안 찍힌 예문·대화 상자를
--   모델이 맨 blockquote 로 냈고, 정화기는 그것을 그대로 통과시킨다. 인쇄물에서는 테두리도
--   말머리도 없이 **들여쓰기만 된 글**로 찍혔다. 같은 원인이 세 갈래 더 있었다:
--     ① 무학중 중1 2학기 중간 6문항: 발문이 '<보기>에서 … 고른 것은?' 인데 상자 자체가 없다
--        (원본 이미지 `problems/<id>/region.jpg` 를 눈으로 읽어 옮겼다 — 이 파일이 유일한 원본)
--     ② 동마중 22~23번: 두 문항이 공유하는 상자를 22번 발문 **앞**에 넣어 두었다 →
--        [22~23] 지문으로 옮긴다(광희중 중1 2학기 중간 1·5·6번의 공용 〈보기〉와 같은 모양)
--     ③ (바)·(사) 글 구분이 허용 목록(가~마) 밖이라 정화기가 속성째 지워 맨 blockquote 만 남은
--        지문 3건 — **이 파일이 아니라 sql/37** 이다. 앱이 목록을 (차)까지 넓혀 배포된 뒤에만 돌린다
--   덤: 동마중 지문 머리글 둘이 '14~16]다음글을읽고물음에답하시오.' 로 저장돼 있었다.
--
-- ⚠️ **사람이 읽고 정한 값이다.** 무학중 6문항의 〈보기〉 본문은 원본 이미지를 읽어 적은 것이라
--    재계산할 수 없다 — 아래 목록이 유일한 원본이다.
-- ⚠️ **전부 멱등하다.** 이미 말머리가 있는 상자·이미 옮긴 문항은 건드리지 않는다. 대상 문항은
--    id 로 잡고, 개수가 어긋나면 EXCEPTION 으로 멈춘다(엉뚱한 문항에 조용히 붙는 일이 없게).
-- ⚠️ 문제지 스냅샷(problem_paper_items)도 같은 결함을 그대로 들고 있어 **함께 고친다**(5건).
--    스냅샷은 원본 문항을 고쳐도 안 변하는 것이 규약이지만, 이것은 내용 변경이 아니라 같은
--    상자에 말머리 속성을 붙이는 표시 교정이다 — 안 고치면 그 문제지는 다시 만들어야 한다.
-- ⚠️ **이 파일은 어느 앱 버전에서나 안전하다** — 붙이는 말머리가 전부 '보기' 라 옛 앱의 정화기도 통과한다.
--    (바)·(사) 복원(sql/37)은 그렇지 않아 **일부러 다른 파일**로 두었다: 같은 파일에 두면 여기 적힌
--    실행 명령 한 줄이 배포를 기다리지 않고 그것까지 돌려 버린다(코덱스 리뷰 1R).

SET search_path = exam, public;

DO $part1$
DECLARE
  v         INT;
  v_total   INT := 0;
  v_src     UUID := '1d564d1e-ef54-4ee7-84eb-90bf869fb3f9';  -- 2025 동마중학교 중1 2학기 중간
  v_p22     UUID := '39516693-6525-425f-8356-f38dc88204dd';
  v_p23     UUID := '132020bb-e330-4808-9e36-cb8109b67328';
  v_pass    UUID;
  -- 말머리 없는 상자의 여는 태그(속성 순서 무관). 앱의 normalize-html.ts `BARE_BLOCKQUOTE_RE` 와 같은 뜻
  c_bare    TEXT := '<blockquote(?![^>]*\sdata-box\s*=)(\s[^>]*)?>';
  c_fill    TEXT := '<blockquote data-box="보기"\1>';
  v_box22   TEXT := '<blockquote data-box="보기">'
                 || '<p>(가) 저 기차는 무척 빠르다.</p>'
                 || '<p>(나) 철수는 정말 좋은 학생이야.</p>'
                 || '<p>(다) 오늘도 영희만 일찍 일어났다.</p>'
                 || '<p>(라) 명주는 매우 빨리 일을 끝냈다.</p>'
                 || '<p>(마) 깜박하고 지갑을 놓고 왔네, 에이!</p>'
                 || '</blockquote>';
BEGIN
  IF to_regclass('exam.problems') IS NULL OR to_regclass('exam.problem_paper_items') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  RAISE NOTICE '대상 DB=% / 롤=%', current_database(), current_user;

  -- -------------------------------------------
  -- 1. 동마중 22~23번 — 공용 상자를 [22~23] 지문으로
  -- -------------------------------------------
  -- 원본 시험지: "[22~23] 다음을 보고 물음에 답하시오." + (가)~(마) 상자 + 22번 + 23번.
  -- OCR 은 상자를 22번 발문 앞에 넣었고 23번은 상자 없이 '(가)~(마)에 대한 설명' 을 물었다.
  IF NOT EXISTS (SELECT 1 FROM exam.problems WHERE id IN (v_p22, v_p23) AND source_id = v_src) THEN
    RAISE EXCEPTION '동마중 22·23번 문항을 찾지 못했다';
  END IF;
  SELECT id INTO v_pass FROM exam.passages WHERE source_id = v_src AND label = '22~23';
  IF v_pass IS NULL THEN
    -- user_id 는 22번 문항의 것을 잇는다(NOT NULL·auth.uid() 없음). works 는 비워 둔다(문법 문항)
    INSERT INTO exam.passages (source_id, label, html, page_no, user_id)
    SELECT v_src, '22~23', v_box22, page_no, user_id FROM exam.problems WHERE id = v_p22
    RETURNING id INTO v_pass;
    v_total := v_total + 1;
    RAISE NOTICE '1. 동마중 [22~23] 지문 생성: %', v_pass;
  END IF;
  UPDATE exam.problems SET passage_id = v_pass
   WHERE id IN (v_p22, v_p23) AND passage_id IS DISTINCT FROM v_pass;
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  UPDATE exam.problems SET stem_html = '<p>(가)~(마) 중 부사가 들어있지 않은 것은?</p>'
   WHERE id = v_p22 AND stem_html LIKE '<blockquote>%';
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE '1. 동마중 22·23번 지문 연결 완료';

  -- -------------------------------------------
  -- 2. 발문 안 말머리 없는 상자 14건 → 〈보기〉
  -- -------------------------------------------
  -- 전부 발문 아래 상자다(시·예문·대화·활동지·단어 목록). 2024 행당중 기말 19번은 원본 말머리가
  -- '<활동지>' 인데 허용 목록 밖이라 〈보기〉로 두고 상자 첫 줄의 '활동지' 글자를 남긴다.
  CREATE TEMP TABLE bare_box(id UUID PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO bare_box VALUES
    ('8e2d67cc-8b02-5294-bf51-068ccff8e553'),  -- 2021 행당중 중2 1학기 기말 3
    ('e5863022-ac2a-5daa-a2b2-447d012a29ec'),  -- 2021 행당중 중2 1학기 기말 12
    ('ba453b25-badb-53a7-bbc4-63e1beef5788'),  -- 2021 행당중 중2 1학기 기말 21
    ('f919f408-0f3b-541a-b537-f30e5650dd98'),  -- 2023 행당중 중1 2학기 기말 13
    ('81a2d9fc-a812-5c85-8d99-f9b3fc69a25b'),  -- 2024 행당중 중1 2학기 기말 2
    ('12ef2c24-56ab-5781-8df1-a8adac8622cc'),  -- 2024 행당중 중1 2학기 기말 17
    ('f4be70f9-b210-55f0-823b-4874fc171e13'),  -- 2024 행당중 중1 2학기 기말 19 (활동지)
    ('e6209905-9068-58ee-9cb8-a5f50d87c64a'),  -- 2024 행당중 중1 2학기 중간 4
    ('e2528243-f32b-514e-ae14-6d288ce40435'),  -- 2024 행당중 중1 2학기 중간 20
    ('702ad2b0-e8f7-4043-babc-5a1a7f07975c'),  -- 2025 동마중 중1 2학기 중간 25
    ('32f576b0-3271-4e60-b505-7bcecc9d42f4'),  -- 2025 동마중 중1 2학기 중간 28
    ('8bd984db-ca66-431d-80b4-ac7d03ba3d32'),  -- 2025 동마중 중1 2학기 중간 29
    ('06a07850-7466-4228-bf1f-80cba54afb01'),  -- 2025 동마중 중1 2학기 중간 30
    ('77b5b5d2-ee82-5706-b409-acea70f24a91'); -- 2025 행당중 중2 1학기 기말 7
  SELECT count(*) INTO v FROM bare_box b JOIN exam.problems p ON p.id = b.id;
  IF v <> 14 THEN RAISE EXCEPTION '2. 대상 문항 14건 중 %건만 찾았다 — 목록을 다시 확인할 것', v; END IF;
  UPDATE exam.problems p
     SET stem_html = regexp_replace(p.stem_html, c_bare, c_fill, 'g')
    FROM bare_box b
   WHERE p.id = b.id AND p.stem_html ~ c_bare;
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE '2. 말머리 없는 상자 → 〈보기〉: %건', v;

  -- -------------------------------------------
  -- 3. 무학중 중1 2학기 중간 6문항 — 빠진 〈보기〉 본문을 원본 이미지에서 옮긴다
  -- -------------------------------------------
  -- 발문은 저장된 것을 그대로 두고(<p> 가 없으면 감싼다) 뒤에 상자를 붙인다.
  CREATE TEMP TABLE muhak_box(id UUID PRIMARY KEY, number INT, box TEXT) ON COMMIT DROP;
  INSERT INTO muhak_box VALUES
    ('80e49fec-30fc-4e0d-aef8-0c2a08589af8', 9,
     '<blockquote data-box="보기"><p>ㄱ. 쟁그럽다: 징그럽다</p><p>ㄴ. 싱둥겅둥: 건성건성</p>'
     || '<p>ㄷ. 단매: 단 한 번에 때리는 매</p><p>ㄹ. 알싸하다: 매운맛이나 독한 냄새 따위로 코 속이나 혀끝이 알알하다</p></blockquote>'),
    ('394f7349-48a0-4774-a4cf-6b1b909e2018', 12,
     '<blockquote data-box="보기"><p>ㄱ. 비속어를 사용해서 갈등 해소와 해학성이 잘 드러나고 있어.</p>'
     || '<p>ㄴ. 노란 동백꽃은 향토적이고 서정적인 분위기를 표현하고 있어.</p>'
     || '<p>ㄷ. 점순이의 마음을 ‘나’만 모르는 상황이 웃음을 유발하고 있어.</p>'
     || '<p>ㄹ. 계층 간의 갈등이 없는 순박한 시골 남녀의 단순한 사랑 이야기로 보여.</p></blockquote>'),
    ('3e746d5f-ec9b-4ff3-9c83-12534f40e3b5', 15,
     '<blockquote data-box="보기"><p>ㄱ. 하인들까지 천하게 본다.</p><p>ㄴ. 신분 제도가 엄격한 사회다.</p>'
     || '<p>ㄷ. 남자로 태어나서 차별을 받는다.</p><p>ㄹ. 천한 신분의 사람은 출세하기가 어렵다.</p></blockquote>'),
    ('583d9b19-8ec9-4bd5-9ce7-cd1d46bbaf46', 22,
     '<blockquote data-box="보기"><p>㉠ <u>한</u>여름<br>㉡ <u>치</u>뜨다<br>㉢ 부채<u>질</u><br>㉣ 뒤집<u>개</u><br>㉤ <u>새</u>파랗다</p></blockquote>'),
    ('55ed8e92-a1f2-4178-b88b-c2d2c7c0ee36', 23,
     '<blockquote data-box="보기"><p>- ㉠<u>실눈</u>으로 하늘을 바라본다.</p>'
     || '<p>- 열 번 찍어 아니 ㉡<u>넘어가는</u> 나무 없다.</p>'
     || '<p>- ㉢<u>낮말</u>은 새가 듣고 ㉣<u>밤말</u>은 쥐가 듣는다.</p>'
     || '<p>- 열 길 ㉤<u>물속</u>은 알아도 한 길 사람의 속은 모른다.</p></blockquote>'),
    ('56a8865b-df69-42c4-9216-30e0e5bcc7f7', 27,
     '<blockquote data-box="보기"><p>먹방, 얌체족, 빨래방, 둘레길, 편의점, 라볶이, 웃프다, 누리꾼, 취존, 캠핑족</p></blockquote>');
  SELECT count(*) INTO v FROM muhak_box m JOIN exam.problems p ON p.id = m.id AND p.number = m.number;
  IF v <> 6 THEN RAISE EXCEPTION '3. 무학중 대상 6문항 중 %건만 맞았다 — 목록을 다시 확인할 것', v; END IF;
  UPDATE exam.problems p
     SET stem_html = CASE WHEN p.stem_html ~ '^\s*<p' THEN p.stem_html ELSE '<p>' || p.stem_html || '</p>' END || m.box
    FROM muhak_box m
   WHERE p.id = m.id AND p.stem_html !~ 'data-box';
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE '3. 무학중 〈보기〉 본문 보충: %건', v;
  -- 27번 선지 ④ 오독: 원본은 '둘레길' (상자 본문과 같은 낱말)
  UPDATE exam.problems SET choices = jsonb_set(choices, '{3}', '"둘레길, 라볶이"')
   WHERE id = '56a8865b-df69-42c4-9216-30e0e5bcc7f7' AND choices->>3 = '돌레길, 라볶이';
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;

  -- -------------------------------------------
  -- 4. 동마중 지문 머리글 — 안내문이 딸려 들어간 것을 범위만 남긴다 (merge-keys.normalizeLabel 모양)
  -- -------------------------------------------
  UPDATE exam.passages SET label = '14~16'
   WHERE id = 'd1e2b2b0-66d1-4484-9787-7120f3210ae1' AND source_id = v_src AND label LIKE '14~16]%';
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  UPDATE exam.passages SET label = '17~19'
   WHERE id = 'e0942cf9-889b-4d21-b8d2-f44ddac757eb' AND source_id = v_src AND label LIKE '17~19]%';
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;

  -- -------------------------------------------
  -- 5. 문제지 스냅샷 — 같은 상자에 같은 말머리 (동마중 22·25·28~30번을 담은 문제지 1장, 5항목)
  -- -------------------------------------------
  -- 22번 스냅샷은 상자를 발문 안에 그대로 둔다(그 문제지에는 23번도 [22~23] 지문도 없다).
  UPDATE exam.problem_paper_items
     SET snapshot = jsonb_set(snapshot, '{stem_html}', to_jsonb(regexp_replace(snapshot->>'stem_html', c_bare, c_fill, 'g')))
   WHERE snapshot->>'stem_html' ~ c_bare;
  GET DIAGNOSTICS v = ROW_COUNT; v_total := v_total + v;
  RAISE NOTICE '5. 문제지 스냅샷 말머리: %건', v;

  -- -------------------------------------------
  -- 검증
  -- -------------------------------------------
  SELECT count(*) INTO v FROM exam.problems WHERE stem_html ~ c_bare;
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 말머리 없는 상자가 문항 %건에 남았다', v; END IF;
  SELECT count(*) INTO v FROM exam.problem_paper_items WHERE snapshot->>'stem_html' ~ c_bare;
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 말머리 없는 상자가 스냅샷 %건에 남았다', v; END IF;
  SELECT count(*) INTO v FROM exam.problems p JOIN muhak_box m ON m.id = p.id
   WHERE p.stem_html !~ 'data-box="보기"' OR p.stem_html !~ '^<p>';
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 무학중 %건에 상자가 없다', v; END IF;
  SELECT count(*) INTO v FROM exam.problems WHERE id IN (v_p22, v_p23) AND passage_id = v_pass;
  IF v <> 2 THEN RAISE EXCEPTION '검증 실패: 동마중 22·23번이 [22~23] 지문에 안 붙었다 (%건)', v; END IF;
  SELECT count(*) INTO v FROM exam.passages WHERE source_id = v_src AND label ~ '\]';
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 동마중 지문 머리글 %건이 아직 안내문을 달고 있다', v; END IF;
  RAISE NOTICE '검증 통과 (이번에 바꾼 행 %건 — 재실행이면 0)', v_total;
END
$part1$;
