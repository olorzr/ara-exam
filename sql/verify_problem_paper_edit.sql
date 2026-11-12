-- ---------------------------------------------------------------
-- 검증: 문제지 고치기(sql/103) — 실제로 불러서 되는 것·막히는 것을 잰다 (재실행 안전, 전부 되돌림)
-- ---------------------------------------------------------------
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/verify_problem_paper_edit.sql
--
-- postgres 는 표 소유자라 RLS 를 지나친다 → 호출은 `SET LOCAL ROLE authenticated` + JWT 흉내로 한다(sql/57·84 와 같은 방법).
-- 선생님 A·B 는 가짜 uuid(문제지 user_id 는 FK 가 없다), 원장은 실제 계정 id(책 user_id 는 auth.users FK).
-- 끝에서 하위 트랜잭션째 되돌리고, 되돌아갔는지를 **검사한다**(검증 행·감사 로그·역할·계약 함수 본문).
-- 이어서 모든 문제지의 불변식을 훑는다(읽기만).
DO $verify$
DECLARE
  v_owner     UUID;
  v_a         UUID := gen_random_uuid();
  v_b         UUID := gen_random_uuid();
  v_pass      UUID;
  v_ps        UUID[];
  v_ss        UUID[];
  v_os        UUID[];
  v_bad_obj   UUID;
  v_subj      UUID;
  v_p3_snap   JSONB;
  v_audit0    BIGINT;
  v_audit1    BIGINT;
  v_paper     UUID;
  v_paper2    UUID;
  v_omr       UUID;
  v_book      UUID;
  v_ids       UUID[];
  v_md5       TEXT[];
  v_cur       UUID[];
  v_oids      UUID[];
  v_exp       TIMESTAMPTZ;
  v_res       JSONB;
  v_got       TEXT;
  v_n         INT;
  v_row       RECORD;
  v_json      JSONB;
  v_txt       TEXT;
  v_labels    TEXT[];
  v_jwt_a     TEXT;
  v_jwt_b     TEXT;
  v_jwt_own   TEXT;
  v_jwt_out   TEXT;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'ara0723@araeducation.co.kr' LIMIT 1;
  SELECT passage_id INTO v_pass FROM exam.problems WHERE passage_id IS NOT NULL
   GROUP BY passage_id HAVING count(*) >= 3 ORDER BY passage_id LIMIT 1;
  SELECT array_agg(id ORDER BY number NULLS LAST, id) INTO v_ps
    FROM (SELECT id, number FROM exam.problems WHERE passage_id = v_pass ORDER BY number NULLS LAST, id LIMIT 3) x;
  SELECT array_agg(id ORDER BY id) INTO v_ss
    FROM (SELECT id FROM exam.problems WHERE passage_id IS NULL ORDER BY id LIMIT 2) x;
  SELECT array_agg(id ORDER BY id) INTO v_os
    FROM (SELECT id FROM exam.problems
           WHERE passage_id IS NULL AND question_type = '객관식'
             AND exam.omr_choice_answer_ok(answer, CASE WHEN jsonb_typeof(choices) = 'array' THEN jsonb_array_length(choices) ELSE 0 END)
           ORDER BY id LIMIT 2) x;
  SELECT id INTO v_bad_obj FROM exam.problems
   WHERE passage_id IS NULL AND question_type = '객관식'
     AND NOT exam.omr_choice_answer_ok(answer, CASE WHEN jsonb_typeof(choices) = 'array' THEN jsonb_array_length(choices) ELSE 0 END)
   ORDER BY id LIMIT 1;
  SELECT id INTO v_subj FROM exam.problems WHERE passage_id IS NULL AND question_type <> '객관식' ORDER BY id LIMIT 1;

  IF v_owner IS NULL OR cardinality(v_ps) < 3 OR cardinality(v_ss) < 2 OR cardinality(v_os) < 2
     OR v_bad_obj IS NULL OR v_subj IS NULL THEN
    RAISE NOTICE '검증에 쓸 문항이 모자라 건너뛴다 (신규 환경)';
    RETURN;
  END IF;

  SELECT exam.paper_item_snapshot(p, ps, s) INTO v_p3_snap
    FROM exam.problems p JOIN exam.problem_sources s ON s.id = p.source_id
    LEFT JOIN exam.passages ps ON ps.id = p.passage_id WHERE p.id = v_ps[3];

  v_jwt_a   := json_build_object('sub', v_a, 'role', 'authenticated', 'email', 'verify-a@araeducation.co.kr')::text;
  v_jwt_b   := json_build_object('sub', v_b, 'role', 'authenticated', 'email', 'verify-b@araeducation.co.kr')::text;
  v_jwt_own := json_build_object('sub', v_owner, 'role', 'authenticated', 'email', 'ara0723@araeducation.co.kr')::text;
  v_jwt_out := json_build_object('sub', v_a, 'role', 'authenticated', 'email', 'verify@gmail.com')::text;

  SELECT count(*) INTO v_audit0 FROM exam.audit_log;

  BEGIN
    -- 거절을 잡아 'SQLSTATE|HINT|문구' 로 돌려주는 시험용 함수(이 하위 트랜잭션과 함께 사라진다)
    CREATE FUNCTION exam.zz_verify_try(p_paper UUID, p_expect TIMESTAMPTZ, p_title TEXT, p_entries JSONB, p_settings JSONB)
    RETURNS TEXT LANGUAGE plpgsql AS $f$
    DECLARE v_state TEXT; v_hint TEXT; v_msg TEXT;
    BEGIN
      PERFORM exam.update_problem_paper(p_paper, p_expect, p_title, p_entries, p_settings);
      RETURN 'ok';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_hint = PG_EXCEPTION_HINT, v_msg = MESSAGE_TEXT;
      RETURN v_state || '|' || COALESCE(NULLIF(v_hint, ''), '-') || '|' || v_msg;
    END $f$;
    GRANT EXECUTE ON FUNCTION exam.zz_verify_try(UUID, TIMESTAMPTZ, TEXT, JSONB, JSONB) TO authenticated;

    EXECUTE 'SET LOCAL ROLE authenticated';

    -- ① 선생님 A — 만들고, 순서 바꾸기 + 빼기 + 넣기 + 설정
    PERFORM set_config('request.jwt.claims', v_jwt_a, true);
    v_paper := exam.create_problem_paper('검증용 임시 문제지 수정', ARRAY[v_ps[1], v_ps[2], v_ss[1], v_ss[2]], '{"columns":2}');
    SELECT array_agg(id ORDER BY order_index), array_agg(md5(snapshot::text) ORDER BY order_index)
      INTO v_ids, v_md5 FROM exam.problem_paper_items WHERE paper_id = v_paper;
    SELECT updated_at INTO v_exp FROM exam.problem_papers WHERE id = v_paper;

    v_res := exam.update_problem_paper(v_paper, v_exp, '검증용 임시 문제지 수정 2',
      jsonb_build_array(jsonb_build_object('item', v_ids[3]), jsonb_build_object('item', v_ids[2]),
                        jsonb_build_object('item', v_ids[1]), jsonb_build_object('problem', v_ps[3])),
      '{"columns":1,"showSource":false,"omr":true}');
    IF (v_res ->> 'total_questions')::int <> 4 OR v_res -> 'passage_changed' <> '[]'::jsonb OR v_res ->> 'updated_at' IS NULL THEN
      RAISE EXCEPTION '① 돌려준 값이 이상하다: %', v_res;
    END IF;
    SELECT array_agg(id ORDER BY order_index) INTO v_cur FROM exam.problem_paper_items WHERE paper_id = v_paper;
    IF cardinality(v_cur) <> 4 OR v_cur[1] <> v_ids[3] OR v_cur[2] <> v_ids[2] OR v_cur[3] <> v_ids[1] THEN
      RAISE EXCEPTION '① 차례가 어긋났다: % (원래 %)', v_cur, v_ids;
    END IF;
    IF (SELECT array_agg(order_index ORDER BY order_index) FROM exam.problem_paper_items WHERE paper_id = v_paper) <> ARRAY[0, 1, 2, 3] THEN
      RAISE EXCEPTION '① 자리 번호가 0..3 이 아니다';
    END IF;
    FOR v_n IN 1..3 LOOP
      IF (SELECT md5(snapshot::text) FROM exam.problem_paper_items WHERE id = v_ids[v_n]) <> v_md5[v_n] THEN
        RAISE EXCEPTION '① 남긴 항목 %의 스냅샷이 바뀌었다', v_n;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM exam.problem_paper_items WHERE id = v_ids[4]) THEN
      RAISE EXCEPTION '① 뺀 항목이 남았다';
    END IF;
    SELECT problem_id, snapshot INTO v_row FROM exam.problem_paper_items WHERE id = v_cur[4];
    IF v_row.problem_id <> v_ps[3] OR v_row.snapshot <> v_p3_snap THEN
      RAISE EXCEPTION '① 새 항목이 지금 원본 스냅샷과 다르다';
    END IF;
    SELECT * INTO v_row FROM exam.problem_papers WHERE id = v_paper;
    IF v_row.title <> '검증용 임시 문제지 수정 2' OR v_row.total_questions <> 4
       OR v_row.settings ->> 'columns' <> '1' OR v_row.settings ->> 'showSource' <> 'false'
       OR v_row.settings ->> 'omr' <> 'false' OR v_row.updated_by IS DISTINCT FROM v_a OR v_row.user_id <> v_a THEN
      RAISE EXCEPTION '① 문제지 행이 이상하다: title=% total=% settings=% updated_by=% user_id=%',
        v_row.title, v_row.total_questions, v_row.settings, v_row.updated_by, v_row.user_id;
    END IF;

    EXECUTE 'RESET ROLE';
    IF v_row.source_labels IS DISTINCT FROM COALESCE(ARRAY(
         SELECT DISTINCT exam.paper_source_label(i.snapshot -> 'source') FROM exam.problem_paper_items i
          WHERE i.paper_id = v_paper ORDER BY 1), '{}') THEN
      RAISE EXCEPTION '① 출처 줄이 다시 만들어지지 않았다: %', v_row.source_labels;
    END IF;
    IF (SELECT count(*) FROM exam.audit_log WHERE record_id = v_paper AND table_name = 'problem_papers' AND action = 'UPDATE') <> 1 THEN
      RAISE EXCEPTION '① 문제지 UPDATE 감사가 한 줄이 아니다';
    END IF;
    SELECT old_data INTO v_json FROM exam.audit_log
     WHERE record_id = v_paper AND table_name = 'problem_paper_items' AND action = 'UPDATE';
    IF v_json IS NULL OR jsonb_array_length(v_json -> 'removed') <> 1 OR jsonb_array_length(v_json -> 'order') <> 4
       OR (v_json -> 'removed' -> 0 ->> 'id')::uuid <> v_ids[4] OR NOT (v_json -> 'removed' -> 0) ? 'snapshot' THEN
      RAISE EXCEPTION '① 항목 감사가 이상하다: %', v_json;
    END IF;
    IF EXISTS (SELECT 1 FROM exam.problem_paper_sync_pending WHERE paper_id = v_paper) THEN
      RAISE EXCEPTION '① OMR 아닌 문제지에 반영 대기 표시가 생겼다';
    END IF;
    EXECUTE 'SET LOCAL ROLE authenticated';

    -- ①' 표에 직접 쓰기는 여전히 막힌다(RLS 에 쓰기 정책이 없다) — 고치기는 RPC 로만
    UPDATE exam.problem_papers SET title = '직접 고침' WHERE id = v_paper;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '①'' 선생님이 문제지 행을 직접 고칠 수 있다'; END IF;
    UPDATE exam.problem_paper_items SET order_index = order_index WHERE paper_id = v_paper;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '①'' 선생님이 항목을 직접 고칠 수 있다'; END IF;
    DELETE FROM exam.problem_paper_items WHERE paper_id = v_paper;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 0 THEN RAISE EXCEPTION '①'' 선생님이 항목을 직접 지울 수 있다'; END IF;
    v_got := 'ok';
    BEGIN
      INSERT INTO exam.problem_paper_items (paper_id, order_index, snapshot) VALUES (v_paper, 99, '{}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN v_got := 'blocked';
    END;
    IF v_got <> 'blocked' THEN RAISE EXCEPTION '①'' 선생님이 항목을 직접 넣을 수 있다'; END IF;

    -- ② 낡은 버전 → conflict, 아무것도 안 바뀜 (한 트랜잭션이라 updated_at 이 그대로다 — 1초 앞으로 보낸다)
    v_got := exam.zz_verify_try(v_paper, v_exp - interval '1 second', NULL,
               jsonb_build_array(jsonb_build_object('item', v_cur[1])), NULL);
    IF split_part(v_got, '|', 1) <> 'P0001' OR split_part(v_got, '|', 2) <> 'conflict' THEN
      RAISE EXCEPTION '② 낡은 버전이 막히지 않았다: %', v_got;
    END IF;
    IF (SELECT count(*) FROM exam.problem_paper_items WHERE paper_id = v_paper) <> 4 THEN
      RAISE EXCEPTION '② 충돌인데 항목이 바뀌었다';
    END IF;

    -- ③ 선생님 B 는 못 고친다, 바깥 도메인은 거절, 원장은 된다(user_id 는 A 그대로)
    PERFORM set_config('request.jwt.claims', v_jwt_b, true);
    v_got := exam.zz_verify_try(v_paper, v_exp, NULL, jsonb_build_array(jsonb_build_object('item', v_cur[1])), NULL);
    IF split_part(v_got, '|', 1) <> '42501' OR split_part(v_got, '|', 2) <> 'not_owner' THEN
      RAISE EXCEPTION '③ 다른 선생님이 막히지 않았다: %', v_got;
    END IF;
    PERFORM set_config('request.jwt.claims', v_jwt_out, true);
    v_got := exam.zz_verify_try(v_paper, v_exp, NULL, jsonb_build_array(jsonb_build_object('item', v_cur[1])), NULL);
    IF split_part(v_got, '|', 1) <> '42501' THEN
      RAISE EXCEPTION '③ 바깥 도메인이 막히지 않았다: %', v_got;
    END IF;
    PERFORM set_config('request.jwt.claims', v_jwt_own, true);
    v_res := exam.update_problem_paper(v_paper, v_exp, NULL,
      jsonb_build_array(jsonb_build_object('item', v_cur[3]), jsonb_build_object('item', v_cur[2]),
                        jsonb_build_object('item', v_cur[4]), jsonb_build_object('item', v_cur[1])), NULL);
    SELECT * INTO v_row FROM exam.problem_papers WHERE id = v_paper;
    IF v_row.updated_by IS DISTINCT FROM v_owner OR v_row.user_id <> v_a OR v_row.title <> '검증용 임시 문제지 수정 2'
       OR v_row.settings ->> 'columns' <> '1' THEN
      RAISE EXCEPTION '③ 원장 수정 뒤 행이 이상하다: updated_by=% user_id=% title=% settings=%',
        v_row.updated_by, v_row.user_id, v_row.title, v_row.settings;
    END IF;
    SELECT array_agg(id ORDER BY order_index) INTO v_cur FROM exam.problem_paper_items WHERE paper_id = v_paper;
    -- 이제 차례: [p1, p2, p3(새), s1]

    -- ④ 책에 담기면 선생님(작성자도)은 막히고 원장은 되며, 그 책의 쪽 수가 비워진다
    INSERT INTO exam.books (title) VALUES ('검증용 임시 책') RETURNING id INTO v_book;
    INSERT INTO exam.book_chapters (book_id, paper_id, order_index) VALUES (v_book, v_paper, 0);
    UPDATE exam.books SET page_counts = '{"student":{"pages":8,"key":"verify"}}'::jsonb WHERE id = v_book;
    PERFORM set_config('request.jwt.claims', v_jwt_a, true);
    v_got := exam.zz_verify_try(v_paper, v_exp, NULL, to_jsonb(ARRAY(
               SELECT jsonb_build_object('item', u.x) FROM unnest(v_cur) WITH ORDINALITY AS u(x, o) ORDER BY u.o)), NULL);
    IF split_part(v_got, '|', 1) <> '42501' OR split_part(v_got, '|', 2) <> 'in_book' THEN
      RAISE EXCEPTION '④ 책에 담긴 문제지를 작성자가 고칠 수 있다: %', v_got;
    END IF;
    v_json := exam.problem_paper_edit_states(ARRAY[v_paper]);
    IF v_json -> v_paper::text ->> 'reason' IS DISTINCT FROM 'in_book' OR (v_json -> v_paper::text ->> 'in_book')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION '④ 상태가 in_book 이 아니다: %', v_json;
    END IF;
    PERFORM set_config('request.jwt.claims', v_jwt_own, true);
    v_json := exam.problem_paper_edit_states(ARRAY[v_paper]);
    IF v_json -> v_paper::text -> 'reason' <> 'null'::jsonb THEN
      RAISE EXCEPTION '④ 원장 상태가 막혔다: %', v_json;
    END IF;
    PERFORM exam.update_problem_paper(v_paper, v_exp, NULL, to_jsonb(ARRAY(
              SELECT jsonb_build_object('item', u.x) FROM unnest(v_cur) WITH ORDINALITY AS u(x, o) ORDER BY u.o)), NULL);
    IF (SELECT page_counts FROM exam.books WHERE id = v_book) <> '{}'::jsonb THEN
      RAISE EXCEPTION '④ 책 쪽 수가 비워지지 않았다';
    END IF;
    DELETE FROM exam.book_chapters WHERE book_id = v_book;

    -- ⑤ 묶음을 가르면 거절, 같은 지문 새 문항은 남긴 묶음의 지문 판을 물려받고 그 자리를 알린다
    PERFORM set_config('request.jwt.claims', v_jwt_a, true);
    v_got := exam.zz_verify_try(v_paper, v_exp, NULL,
               jsonb_build_array(jsonb_build_object('item', v_cur[1]), jsonb_build_object('item', v_cur[4]),
                                 jsonb_build_object('item', v_cur[2]), jsonb_build_object('item', v_cur[3])), NULL);
    IF split_part(v_got, '|', 1) <> '23514' OR position('떨어져' IN v_got) = 0 THEN
      RAISE EXCEPTION '⑤ 갈라진 지문 묶음이 막히지 않았다: %', v_got;
    END IF;
    EXECUTE 'RESET ROLE';
    UPDATE exam.problem_paper_items SET snapshot = jsonb_set(snapshot, '{passage,html}', '"<p>검증 옛 판</p>"')
     WHERE paper_id = v_paper AND snapshot -> 'passage' ->> 'id' = v_pass::text;
    EXECUTE 'SET LOCAL ROLE authenticated';
    -- p3 항목을 빼고 같은 문항을 새로 담는다(빠지는 항목과 같은 문항은 다시 담을 수 있다)
    v_res := exam.update_problem_paper(v_paper, v_exp, NULL,
      jsonb_build_array(jsonb_build_object('item', v_cur[1]), jsonb_build_object('item', v_cur[2]),
                        jsonb_build_object('problem', v_ps[3]), jsonb_build_object('item', v_cur[4])), NULL);
    IF v_res -> 'passage_changed' <> '[3]'::jsonb THEN
      RAISE EXCEPTION '⑤ 지문 판이 다른 자리를 알리지 않았다: %', v_res;
    END IF;
    SELECT snapshot -> 'passage' ->> 'html' INTO v_txt FROM exam.problem_paper_items WHERE paper_id = v_paper AND order_index = 2;
    IF v_txt IS DISTINCT FROM '<p>검증 옛 판</p>' THEN
      RAISE EXCEPTION '⑤ 새 문항이 묶음의 지문 판을 물려받지 않았다: %', left(v_txt, 40);
    END IF;
    SELECT array_agg(id ORDER BY order_index) INTO v_cur FROM exam.problem_paper_items WHERE paper_id = v_paper;

    -- ⑥ 모양·중복·소속·개수
    v_paper2 := exam.create_problem_paper('검증용 임시 문제지 남의 것', ARRAY[v_ss[2]], '{}'::jsonb);
    FOR v_row IN
      SELECT * FROM (VALUES
        ('항목 두 번',      jsonb_build_array(jsonb_build_object('item', v_cur[1]), jsonb_build_object('item', v_cur[1])), '23514'),
        ('새 문항 두 번',   jsonb_build_array(jsonb_build_object('item', v_cur[1]), jsonb_build_object('item', v_cur[2]),
                                              jsonb_build_object('item', v_cur[3]), jsonb_build_object('item', v_cur[4]),
                                              jsonb_build_object('problem', v_ss[2]), jsonb_build_object('problem', v_ss[2])), '23514'),
        ('남긴 문항 또',    jsonb_build_array(jsonb_build_object('item', v_cur[1]), jsonb_build_object('problem', v_ps[1])), '23514'),
        ('남의 항목',       jsonb_build_array(jsonb_build_object('item',
                              (SELECT id FROM exam.problem_paper_items WHERE paper_id = v_paper2 LIMIT 1))), '23514'),
        ('빈 목록',         '[]'::jsonb, '23514'),
        ('201개',           (SELECT jsonb_agg(jsonb_build_object('problem', gen_random_uuid())) FROM generate_series(1, 201)), '23514'),
        ('uuid 아님',       '[{"item":"abc"}]'::jsonb, '23514'),
        ('키 둘',           jsonb_build_array(jsonb_build_object('item', v_cur[1], 'problem', v_ps[1])), '23514'),
        ('배열 아님',       '"x"'::jsonb, '23514'),
        ('객체 아님',       '[1]'::jsonb, '23514'),
        ('없는 문항',       jsonb_build_array(jsonb_build_object('problem', gen_random_uuid())), '23503')
      ) AS t(label, entries, expected)
    LOOP
      v_got := exam.zz_verify_try(v_paper, v_exp, NULL, v_row.entries, NULL);
      IF split_part(v_got, '|', 1) <> v_row.expected THEN
        RAISE EXCEPTION '⑥ % — 기대 %, 결과 %', v_row.label, v_row.expected, v_got;
      END IF;
    END LOOP;
    v_got := exam.zz_verify_try(v_paper, v_exp, '   ', jsonb_build_array(jsonb_build_object('item', v_cur[1])), NULL);
    IF split_part(v_got, '|', 1) <> '23514' THEN RAISE EXCEPTION '⑥ 빈 제목이 막히지 않았다: %', v_got; END IF;
    IF (SELECT count(*) FROM exam.problem_paper_items WHERE paper_id = v_paper) <> 4 THEN
      RAISE EXCEPTION '⑥ 거절했는데 항목이 바뀌었다';
    END IF;

    -- ⑦ OMR — 정답 모양(새 자리 번호), 객관식 0, 채점 여부(계약 함수를 잠깐 갈아 끼운다), 반영 대기 표시
    v_omr := exam.create_problem_paper('검증용 임시 문제지 OMR', v_os, '{"omr":true}'::jsonb);
    SELECT array_agg(id ORDER BY order_index) INTO v_oids FROM exam.problem_paper_items WHERE paper_id = v_omr;
    v_got := exam.zz_verify_try(v_omr, v_exp, NULL,
               jsonb_build_array(jsonb_build_object('item', v_oids[1]), jsonb_build_object('item', v_oids[2]),
                                 jsonb_build_object('problem', v_bad_obj)), NULL);
    IF split_part(v_got, '|', 1) <> '23514' OR position('3번' IN v_got) = 0 THEN
      RAISE EXCEPTION '⑦ 채점할 수 없는 정답이 막히지 않았다: %', v_got;
    END IF;
    v_got := exam.zz_verify_try(v_omr, v_exp, NULL, jsonb_build_array(jsonb_build_object('problem', v_subj)), NULL);
    IF split_part(v_got, '|', 1) <> '23514' OR position('객관식 문항이 없어' IN v_got) = 0 THEN
      RAISE EXCEPTION '⑦ 객관식 없는 OMR 이 막히지 않았다: %', v_got;
    END IF;

    FOR v_row IN
      SELECT * FROM (VALUES
        ('graded',  $b$CREATE OR REPLACE FUNCTION public.problem_paper_exam_state(p_source_exam_id uuid, p_lock boolean DEFAULT false)
                     RETURNS text LANGUAGE sql AS $s$ SELECT 'graded'::text $s$$b$, 'graded'),
        ('예외',    $b$CREATE OR REPLACE FUNCTION public.problem_paper_exam_state(p_source_exam_id uuid, p_lock boolean DEFAULT false)
                     RETURNS text LANGUAGE plpgsql AS $s$ BEGIN RAISE EXCEPTION 'boom'; END $s$$b$, 'grade_check_failed'),
        ('모르는 값', $b$CREATE OR REPLACE FUNCTION public.problem_paper_exam_state(p_source_exam_id uuid, p_lock boolean DEFAULT false)
                     RETURNS text LANGUAGE sql AS $s$ SELECT 'weird'::text $s$$b$, 'grade_check_failed'),
        ('함수 없음', $b$DROP FUNCTION public.problem_paper_exam_state(uuid, boolean)$b$, 'grade_check_failed')
      ) AS t(label, ddl, expected)
    LOOP
      BEGIN
        EXECUTE 'RESET ROLE';
        EXECUTE v_row.ddl;
        EXECUTE 'SET LOCAL ROLE authenticated';
        v_got := exam.zz_verify_try(v_omr, v_exp, NULL,
                   jsonb_build_array(jsonb_build_object('item', v_oids[2]), jsonb_build_object('item', v_oids[1])), NULL);
        v_json := exam.problem_paper_edit_states(ARRAY[v_omr]);
        RAISE EXCEPTION 'SWAP_DONE';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'SWAP_DONE' THEN RAISE; END IF;
      END;
      IF split_part(v_got, '|', 1) <> '55000' OR split_part(v_got, '|', 2) <> v_row.expected THEN
        RAISE EXCEPTION '⑦ 계약 함수 %: 기대 %, 결과 %', v_row.label, v_row.expected, v_got;
      END IF;
      IF v_json -> v_omr::text ->> 'reason' IS DISTINCT FROM v_row.expected THEN
        RAISE EXCEPTION '⑦ 계약 함수 % 상태: 기대 %, 결과 %', v_row.label, v_row.expected, v_json;
      END IF;
    END LOOP;
    IF current_user <> 'authenticated' THEN
      RAISE EXCEPTION '⑦ 갈아 끼우기 뒤 역할이 authenticated 가 아니다 (%)', current_user;
    END IF;

    -- 진짜 계약 함수 — 등록 전(unregistered)이라 고쳐지고 반영 대기 표시가 남는다
    v_res := exam.update_problem_paper(v_omr, v_exp, NULL,
      jsonb_build_array(jsonb_build_object('item', v_oids[2]), jsonb_build_object('item', v_oids[1])), NULL);
    v_json := exam.problem_paper_edit_states(ARRAY[v_omr]);
    IF (v_json -> v_omr::text ->> 'pending')::boolean IS NOT TRUE OR v_json -> v_omr::text -> 'reason' <> 'null'::jsonb THEN
      RAISE EXCEPTION '⑦ OMR 수정 뒤 상태가 이상하다: %', v_json;
    END IF;
    IF (SELECT settings ->> 'omr' FROM exam.problem_papers WHERE id = v_omr) <> 'true' THEN
      RAISE EXCEPTION '⑦ OMR 문제지의 omr 이 꺼졌다';
    END IF;
    EXECUTE 'RESET ROLE';
    IF (SELECT edited_at FROM exam.problem_paper_sync_pending WHERE paper_id = v_omr)
       IS DISTINCT FROM (SELECT updated_at FROM exam.problem_papers WHERE id = v_omr) THEN
      RAISE EXCEPTION '⑦ 반영 대기 표시의 시각이 문제지 updated_at 과 다르다';
    END IF;

    -- ⑧ 원본이 지워진 항목(problem_id NULL)과 학기 키 없는 옛 스냅샷도 그대로 남고 출처 줄에 들어간다
    UPDATE exam.problem_paper_items SET problem_id = NULL WHERE id = v_cur[4];
    UPDATE exam.problem_paper_items SET snapshot = snapshot #- '{source,semester}' WHERE id = v_cur[1];
    SELECT exam.paper_source_label(snapshot -> 'source') INTO v_txt FROM exam.problem_paper_items WHERE id = v_cur[1];
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims', v_jwt_a, true);
    PERFORM exam.update_problem_paper(v_paper, v_exp, NULL, to_jsonb(ARRAY(
              SELECT jsonb_build_object('item', u.x) FROM unnest(v_cur) WITH ORDINALITY AS u(x, o) ORDER BY u.o)), NULL);
    SELECT source_labels INTO v_labels FROM exam.problem_papers WHERE id = v_paper;
    IF (SELECT problem_id FROM exam.problem_paper_items WHERE id = v_cur[4]) IS NOT NULL
       OR NOT (v_txt = ANY (v_labels)) THEN
      RAISE EXCEPTION '⑧ 원본 없는 항목·학기 없는 스냅샷 처리가 이상하다 (라벨 %)', v_txt;
    END IF;

    -- ⑨ 상태 — 작성자 null, 다른 선생님 not_owner
    v_json := exam.problem_paper_edit_states(ARRAY[v_paper, v_paper2]);
    IF v_json -> v_paper::text -> 'reason' <> 'null'::jsonb OR (v_json -> v_paper::text ->> 'in_book')::boolean
       OR NOT (v_json -> v_paper::text) ? 'workbook' THEN
      RAISE EXCEPTION '⑨ 작성자 상태가 이상하다: %', v_json;
    END IF;
    PERFORM set_config('request.jwt.claims', v_jwt_b, true);
    v_json := exam.problem_paper_edit_states(ARRAY[v_paper]);
    IF v_json -> v_paper::text ->> 'reason' IS DISTINCT FROM 'not_owner' THEN
      RAISE EXCEPTION '⑨ 다른 선생님 상태가 not_owner 가 아니다: %', v_json;
    END IF;

    RAISE EXCEPTION 'ROLLBACK_VERIFY';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_VERIFY' THEN RAISE; END IF;
  END;

  -- 되돌아갔는지는 말로 하지 않고 검사한다
  IF current_user <> session_user THEN
    RAISE EXCEPTION '검증 뒤 역할이 되돌아가지 않았다 (%)', current_user;
  END IF;
  SELECT count(*) INTO v_audit1 FROM exam.audit_log;
  SELECT count(*) INTO v_n FROM exam.problem_papers WHERE title LIKE '검증용 임시 문제지%';
  IF v_n <> 0 OR v_audit1 <> v_audit0 OR to_regproc('exam.zz_verify_try') IS NOT NULL
     OR EXISTS (SELECT 1 FROM exam.books WHERE title = '검증용 임시 책') THEN
    RAISE EXCEPTION '뒷정리가 안 됐다 — 검증 문제지 %장, 감사 로그 증가 %건 (직접 살펴볼 것)', v_n, v_audit1 - v_audit0;
  END IF;
  IF position('exam_results' IN pg_get_functiondef('public.problem_paper_exam_state(uuid,boolean)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION '계약 함수가 시험용으로 바뀐 채 남았다 — Ara-system mig598 을 다시 돌릴 것';
  END IF;

  RAISE NOTICE '문제지 고치기 검증 통과: 순서·빼기·넣기·설정·감사 / 충돌 / 다른 선생님·바깥 도메인 거절, 원장 됨 / 책: 작성자 막힘·원장 됨·쪽 수 비움 / 묶음 가르기 거절·지문 판 물려받기 / 모양·중복·개수 11가지 / OMR 정답·객관식 0·채점 4가지·반영 대기 / 원본 없는 항목·학기 없는 스냅샷 / 상태 — 전부 되돌림';
END
$verify$;

-- ---------------------------------------------
-- 모든 문제지 불변식 (읽기만) — 고치기 RPC 가 지켜야 하는 것들
-- ---------------------------------------------
DO $sweep$
DECLARE
  v_papers  INT;
  v_gap     INT;
  v_count   INT;
  v_scatter INT;
  v_mixed   INT;
  v_dup     INT;
  v_pending INT;
BEGIN
  SELECT count(*) INTO v_papers FROM exam.problem_papers;
  SELECT count(*) INTO v_gap FROM (
    SELECT paper_id FROM exam.problem_paper_items GROUP BY paper_id
    HAVING min(order_index) <> 0 OR max(order_index) <> count(*) - 1) x;
  SELECT count(*) INTO v_count FROM exam.problem_papers p
   WHERE p.total_questions <> (SELECT count(*) FROM exam.problem_paper_items i WHERE i.paper_id = p.id);
  SELECT count(DISTINCT paper_id) INTO v_scatter FROM (
    SELECT paper_id, pid FROM (
      SELECT paper_id, snapshot -> 'passage' ->> 'id' AS pid,
             order_index - row_number() OVER (PARTITION BY paper_id, snapshot -> 'passage' ->> 'id' ORDER BY order_index) AS island
        FROM exam.problem_paper_items WHERE snapshot -> 'passage' ->> 'id' IS NOT NULL) t
    GROUP BY paper_id, pid HAVING count(DISTINCT island) > 1) y;
  SELECT count(*) INTO v_mixed FROM (
    SELECT paper_id, snapshot -> 'passage' ->> 'id'
      FROM exam.problem_paper_items WHERE snapshot -> 'passage' ->> 'id' IS NOT NULL
     GROUP BY 1, 2 HAVING count(DISTINCT md5((snapshot -> 'passage')::text)) > 1) x;
  SELECT count(*) INTO v_dup FROM (
    SELECT paper_id, problem_id FROM exam.problem_paper_items WHERE problem_id IS NOT NULL
     GROUP BY 1, 2 HAVING count(*) > 1) x;
  SELECT count(*) INTO v_pending FROM exam.problem_paper_sync_pending;

  IF v_gap + v_count + v_scatter + v_mixed + v_dup > 0 THEN
    RAISE EXCEPTION '문제지 불변식 위반 — 자리 빈틈 %, 문항 수 어긋남 %, 흩어진 묶음 %, 묶음 안 지문 판 섞임 %, 같은 문항 두 번 %',
      v_gap, v_count, v_scatter, v_mixed, v_dup;
  END IF;
  RAISE NOTICE '문제지 %장 불변식 통과 (자리 0..n-1 · 문항 수 · 묶음 연속 · 묶음 한 판 · 중복 없음), 정답표 반영 대기 %장', v_papers, v_pending;
END
$sweep$;
