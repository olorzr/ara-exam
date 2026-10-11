-- =============================================
-- 67. 문항에 딸린 지문의 대영역을 문항 행에 복제한다 — '문법만 있는 문항' 필터
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/67_problem_bank_passage_area.sql
-- =============================================
-- 배경 (2026-10-11 원장님: "해당 문학 작품 혹은 해당 문법만 있는(다른 지문은 겹치지 않은) 문제만 뽑아 쓸 수 있도록")
--
-- 문법으로 훑으면 문학·독서 지문에 딸린 문항("윗글의 ㉠에서 일어난 음운 변동은?")까지 나온다.
-- 그 문항은 지문 없이는 못 쓴다. 사용자 결정: **지문이 없거나 화법과 언어 지문**(문법 설명글·대화문·
-- 「훈민정음」)에 딸린 문항만 남기고, 문학·독서 지문에 딸린 것을 뺀다.
--
-- 왜 복제 컬럼인가:
--   · 문항 행에는 지문의 영역이 없다(`problems.area_path` 는 **그 물음**의 영역이라, 문학 지문에 딸린
--     문법 문항은 `화법과 언어 > 언어` 다 — CLAUDE.md 2026-09-21 "문항이 아니라 지문의 영역으로 센다").
--   · PostgREST 는 부모 조건과 임베드 조건을 OR 로 묶지 못하고, `passages!inner` 는 **지문 없는 문항**
--     (문법 문항의 다수, 운영 1,626건)을 통째로 떨어뜨린다. 조인으로는 못 푼다.
--
-- ⚠️ 여기는 **원시값**(지문 `area_path[1]` 글자 그대로, 지문 없으면 '')만 둔다. 어느 영역이 '문법 전용'
--    인가는 TS 상수(`solo-filter.ts` 의 GRAMMAR_SOLO_PASSAGE_AREAS)가 정한다 — 영역 이름을 SQL 에
--    거울로 두면 검수 화면·트리와 갈라진다(sql/66 머리말과 같은 규약).
-- ⚠️ 지문 쪽 전파 트리거는 `exam.skip_work_sync` 를 **따르지 않는다** — 그 표시는 작품 목록을 합치는
--    동안만의 일이고, 영역은 합치기와 무관하게 늘 참이어야 한다.
--
-- 멱등: ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS. 백필은 다시 돌리면 0행.
-- ⛳️ 되돌릴 때: DROP TRIGGER aa_passage_area_problems ON exam.problems; DROP TRIGGER passages_sync_area
--    ON exam.passages; DROP FUNCTION exam.problems_passage_area(), exam.sync_passage_area_to_problems(),
--    exam.passage_area_of(UUID); ALTER TABLE exam.problems DROP COLUMN passage_area;
-- =============================================

DO $guard$
BEGIN
  IF to_regclass('exam.problems') IS NULL OR to_regclass('exam.passages') IS NULL THEN
    RAISE EXCEPTION 'exam 문제 은행 표가 없습니다 (현재 DB: %). ara-system 과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;
  IF (SELECT count(*) FROM pg_trigger
       WHERE tgrelid = 'exam.problems'::regclass
         AND tgname IN ('audit_problems_update', 'problems_updated_at')) <> 2 THEN
    RAISE EXCEPTION 'audit_problems_update·problems_updated_at 트리거가 없습니다 — 백필 절차가 이 둘을 끄고 켭니다';
  END IF;
  RAISE NOTICE '대상 DB = % / 롤 = %', current_database(), current_user;
END
$guard$;

-- ---------------------------------------------
-- 1. 컬럼 (상수 기본값이라 표를 다시 쓰지 않는다)
-- ---------------------------------------------
ALTER TABLE exam.problems
  ADD COLUMN IF NOT EXISTS passage_area TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN exam.problems.passage_area IS
  '딸린 지문의 대영역(passages.area_path[1], 지문이 없으면 ''''). 트리거가 채운다 — 앱에서 보내지 말 것. '
  '어느 영역이 문법 전용인가는 앱 solo-filter.ts 가 정한다(sql/67)';

-- ---------------------------------------------
-- 2. 지문의 대영역 — 지문이 없거나 영역이 비었으면 ''
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.passage_area_of(p_passage UUID)
RETURNS TEXT
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE((SELECT ps.area_path[1] FROM exam.passages ps WHERE ps.id = p_passage), '');
$$;

-- ---------------------------------------------
-- 3. 문항 BEFORE 트리거 — 지문이 바뀌거나 누가 이 칸을 직접 보내면 다시 계산해 덮는다
-- ---------------------------------------------
-- ⚠️ **지문 행을 `FOR SHARE` 로 읽는다**(코덱스 5R). 문항을 넣거나 다른 지문에 붙이는 트랜잭션과
--    그 지문의 대영역을 고치는 트랜잭션이 겹치면, 잠그지 않은 읽기는 **옛 영역**을 베끼고 지문 쪽
--    전파(`passages_sync_area`)는 아직 커밋 안 된 문항을 못 봐서 **둘 다 커밋된 뒤에도 어긋난다**
--    (FK 의 KEY SHARE 잠금은 키가 아닌 칸의 UPDATE 를 막지 않는다). FOR SHARE 면 READ COMMITTED 에서
--    ① 지문 UPDATE 가 먼저 잡았으면 커밋을 기다렸다가 **새 값**을 읽고 ② 이쪽이 먼저 잡았으면 지문
--    UPDATE 가 이 커밋을 기다렸다가 전파 UPDATE 에서 이 문항을 본다.
--    STABLE 인 `passage_area_of` 는 행을 잠글 수 없어(백필·보고용으로 둔다) 여기서 직접 읽는다.
--    FOR SHARE 는 지문 표의 UPDATE 권한·정책을 요구한다 — authenticated 는 공유 정책으로 갖고 있다(sql/17·65)
CREATE OR REPLACE FUNCTION exam.problems_passage_area() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_area TEXT;
BEGIN
  IF NEW.passage_id IS NULL THEN
    NEW.passage_area := '';
    RETURN NEW;
  END IF;
  SELECT ps.area_path[1] INTO v_area
    FROM exam.passages ps WHERE ps.id = NEW.passage_id
     FOR SHARE;
  NEW.passage_area := COALESCE(v_area, '');
  RETURN NEW;
END;
$$;

-- ⚠️ `aa_` 접두사는 의도다 — 트리거는 이름순으로 돈다. `audit_problems_update` 보다 앞이라야
--    감사 로그가 확정된 값을 본다(sql/33 의 aa_works_* 와 같은 규약).
-- ⚠️ `passage_area` 를 컬럼 목록에 넣은 까닭: 앱·스크립트가 그 칸을 SET 해도 늘 다시 계산해 덮는다
--    (`search_text`·`work_title` 과 같은 계약). 지문을 지우면 FK(ON DELETE SET NULL)가
--    `UPDATE … SET passage_id = NULL` 을 돌리므로 이 트리거가 함께 돈다.
DROP TRIGGER IF EXISTS aa_passage_area_problems ON exam.problems;
CREATE TRIGGER aa_passage_area_problems
  BEFORE INSERT OR UPDATE OF passage_id, passage_area ON exam.problems
  FOR EACH ROW EXECUTE FUNCTION exam.problems_passage_area();

-- ---------------------------------------------
-- 4. 지문 AFTER 트리거 — 대영역이 바뀌면 딸린 문항이 따라간다
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.sync_passage_area_to_problems() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_area TEXT := COALESCE(NEW.area_path[1], '');
BEGIN
  UPDATE exam.problems
     SET passage_area = v_area
   WHERE passage_id = NEW.id
     -- ⚠️ 달라진 행만 — 아니면 상관없는 문항의 updated_at 이 올라 열어 둔 검수 탭이 튕긴다
     AND passage_area IS DISTINCT FROM v_area;
  RETURN NULL;
END;
$$;

-- ⚠️ 컬럼 목록 없이 걸고 WHEN 으로 실제 변화를 본다(sql/33 §5 와 같은 까닭 — `UPDATE OF` 는 SET 목록만 본다)
DROP TRIGGER IF EXISTS passages_sync_area ON exam.passages;
CREATE TRIGGER passages_sync_area
  AFTER UPDATE ON exam.passages
  FOR EACH ROW
  WHEN (OLD.area_path[1] IS DISTINCT FROM NEW.area_path[1])
  EXECUTE FUNCTION exam.sync_passage_area_to_problems();

-- ---------------------------------------------
-- 5. 백필 — 감사·updated_at 트리거만 끄고 돌린다
-- ---------------------------------------------
-- ⚠️ `session_replication_role = replica` 로 끄지 말 것 — problems_search_text·aa_* 까지 꺼진다(sql/33 규약).
-- ⚠️ problems_updated_at 도 끈다 — 2만 9천 행의 updated_at 이 한꺼번에 오르면 열어 둔 검수 탭이 전부
--    다음 저장에서 충돌로 튕긴다. 이 칸은 사람이 고친 것이 아니라 파생값이다.
-- run-sql.js 는 파일 전체를 한 번에 보내 한 트랜잭션이다 — 끄고 켜기가 원자적이고, 아래 검증이
-- 실패하면 컬럼까지 통째로 되돌아간다.
ALTER TABLE exam.problems DISABLE TRIGGER audit_problems_update;
ALTER TABLE exam.problems DISABLE TRIGGER problems_updated_at;

DO $backfill$
DECLARE
  v_n INT;
BEGIN
  UPDATE exam.problems p
     SET passage_area = s.area
    FROM (
      SELECT q.id, COALESCE(ps.area_path[1], '') AS area
        FROM exam.problems q
        LEFT JOIN exam.passages ps ON ps.id = q.passage_id
    ) s
   WHERE p.id = s.id
     AND p.passage_area IS DISTINCT FROM s.area;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '백필 %건 (다시 돌리면 0 이어야 한다)', v_n;
END
$backfill$;

ALTER TABLE exam.problems ENABLE TRIGGER audit_problems_update;
ALTER TABLE exam.problems ENABLE TRIGGER problems_updated_at;

-- ---------------------------------------------
-- 6. 자가 검증 — 트리거가 **실제로 도는지** 넣었다 지워서 확인한다
-- ---------------------------------------------
-- 하위 트랜잭션 안에서 진짜 행을 넣고 7단계를 확인한 뒤 일부러 예외를 던져 통째로 되돌린다.
DO $probe$
DECLARE
  v_user UUID := '00000000-0000-0000-0000-000000000000';
  v_src  UUID := gen_random_uuid();
  v_p1   UUID := gen_random_uuid();
  v_q1   UUID := gen_random_uuid();
  v_a    TEXT;
  v_ctid TID;
BEGIN
  BEGIN
    INSERT INTO exam.problem_sources (id, source_type, title, user_id)
      VALUES (v_src, '내신기출', '__probe__ 지우세요', v_user);
    INSERT INTO exam.passages (id, source_id, html, area_path, user_id)
      VALUES (v_p1, v_src, '<p>지문</p>', ARRAY['문학', '운문 문학'], v_user);

    -- ① 넣을 때 앱이 보낸 값을 무시하고 지문에서 채운다
    INSERT INTO exam.problems (id, source_id, passage_id, stem_html, passage_area, user_id)
      VALUES (v_q1, v_src, v_p1, '<p>물음</p>', '엉터리', v_user);
    SELECT passage_area INTO v_a FROM exam.problems WHERE id = v_q1;
    IF v_a <> '문학' THEN RAISE EXCEPTION 'probe ① 실패(넣을 때): %', v_a; END IF;

    -- ② 직접 UPDATE 로 보내도 덮는다
    UPDATE exam.problems SET passage_area = '엉터리' WHERE id = v_q1;
    SELECT passage_area INTO v_a FROM exam.problems WHERE id = v_q1;
    IF v_a <> '문학' THEN RAISE EXCEPTION 'probe ② 실패(직접 UPDATE): %', v_a; END IF;

    -- ③ 지문 본문만 고치면 문항 행을 건드리지 않는다(updated_at 보호)
    SELECT ctid INTO v_ctid FROM exam.problems WHERE id = v_q1;
    UPDATE exam.passages SET html = '<p>고친 지문</p>' WHERE id = v_p1;
    IF (SELECT ctid FROM exam.problems WHERE id = v_q1) <> v_ctid THEN
      RAISE EXCEPTION 'probe ③ 실패(본문만 고쳤는데 문항 행이 바뀌었다)';
    END IF;
    -- 소영역만 바뀌어도 건드리지 않는다
    UPDATE exam.passages SET area_path = ARRAY['문학', '산문 문학'] WHERE id = v_p1;
    IF (SELECT ctid FROM exam.problems WHERE id = v_q1) <> v_ctid THEN
      RAISE EXCEPTION 'probe ③ 실패(소영역만 바뀌었는데 문항 행이 바뀌었다)';
    END IF;

    -- ④ 지문의 대영역을 바꾸면 따라간다 — 합치기 표시가 켜져 있어도
    PERFORM set_config('exam.skip_work_sync', 'on', true);
    UPDATE exam.passages SET area_path = ARRAY['화법과 언어', '언어'] WHERE id = v_p1;
    PERFORM set_config('exam.skip_work_sync', '', true);
    SELECT passage_area INTO v_a FROM exam.problems WHERE id = v_q1;
    IF v_a <> '화법과 언어' THEN RAISE EXCEPTION 'probe ④ 실패(영역 전파): %', v_a; END IF;

    -- ⑤ 지문에서 떼면 ''
    UPDATE exam.problems SET passage_id = NULL WHERE id = v_q1;
    SELECT passage_area INTO v_a FROM exam.problems WHERE id = v_q1;
    IF v_a <> '' THEN RAISE EXCEPTION 'probe ⑤ 실패(지문에서 뗐다): %', v_a; END IF;

    -- ⑥ 다시 붙이면 돌아온다
    UPDATE exam.problems SET passage_id = v_p1 WHERE id = v_q1;
    SELECT passage_area INTO v_a FROM exam.problems WHERE id = v_q1;
    IF v_a <> '화법과 언어' THEN RAISE EXCEPTION 'probe ⑥ 실패(다시 붙였다): %', v_a; END IF;

    -- ⑦ 지문을 지우면(FK SET NULL) ''
    DELETE FROM exam.passages WHERE id = v_p1;
    SELECT passage_area INTO v_a FROM exam.problems WHERE id = v_q1;
    IF v_a <> '' THEN RAISE EXCEPTION 'probe ⑦ 실패(지문을 지웠다): %', v_a; END IF;

    RAISE EXCEPTION '__probe_rollback__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = '__probe_rollback__' THEN
      RAISE NOTICE '✓ 트리거 자가 검증 7단계 통과 (넣은 행은 전부 되돌렸습니다)';
    ELSE
      RAISE;
    END IF;
  END;
END
$probe$;

-- ---------------------------------------------
-- 7. 결과 — 불변식(어긋남 0)·분포·트리거 상태
-- ---------------------------------------------
DO $report$
DECLARE
  v_bad   INT;
  v_rec   RECORD;
  v_names TEXT;
BEGIN
  SELECT count(*) INTO v_bad
    FROM exam.problems p
    LEFT JOIN exam.passages ps ON ps.id = p.passage_id
   WHERE p.passage_area IS DISTINCT FROM COALESCE(ps.area_path[1], '');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '백필 불변식 위반: 지문 영역과 어긋난 문항 %건', v_bad;
  END IF;
  RAISE NOTICE '어긋남 0건';

  FOR v_rec IN
    SELECT CASE WHEN passage_area = '' THEN '(지문 없음·영역 없음)' ELSE passage_area END AS area,
           count(*) AS n,
           count(*) FILTER (WHERE grammar_paths <> '{}') AS grammar
      FROM exam.problems GROUP BY 1 ORDER BY 2 DESC
  LOOP
    RAISE NOTICE '  지문 대영역 % → 문항 % (문법 태그 %)', v_rec.area, v_rec.n, v_rec.grammar;
  END LOOP;

  IF position('FOR SHARE' IN pg_get_functiondef('exam.problems_passage_area()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'problems_passage_area 가 지문 행을 잠그지 않는다 — 동시 쓰기에서 영역이 어긋난다';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger
              WHERE tgrelid = 'exam.problems'::regclass
                AND tgname IN ('audit_problems_update', 'problems_updated_at', 'aa_passage_area_problems')
                AND tgenabled <> 'O') THEN
    RAISE EXCEPTION '꺼진 채 남은 트리거가 있습니다';
  END IF;

  SELECT string_agg(tgname, ' < ' ORDER BY tgname) INTO v_names
    FROM pg_trigger
   WHERE tgrelid = 'exam.problems'::regclass AND NOT tgisinternal;
  RAISE NOTICE '문항 트리거 차례: %', v_names;
END
$report$;

NOTIFY pgrst, 'reload schema';
