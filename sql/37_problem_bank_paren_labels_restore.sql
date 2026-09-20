-- =============================================
-- 37. 기출 문제 은행 — (바)·(사) 글 구분 말머리 복원 (데이터 교정, **배포 뒤에만**)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/37_problem_bank_paren_labels_restore.sql
-- =============================================
-- ⚠️⚠️ **선행 조건: 허용 말머리를 (차)까지 넓힌 앱(0.9.5 이상, box-labels.ts 의 PAREN_LABELS)이
--    운영에 배포된 뒤에만 돌린다.** 이 앱은 읽기·인쇄 진입에서도 정화하므로(sanitize-problem.ts),
--    옛 앱이 떠 있는 동안 붙이면 정화기가 속성을 지우고 — 여기서 상자 첫 문단의 '(바) ' 글자를
--    속성으로 올려 버린 뒤라 — 그 지문은 **머리글 없이** 찍힌다. sql/36(1부 교정)과 파일을 나눈
--    까닭이 이것이다(코덱스 리뷰 1R): 한 파일에 두면 실행 명령 한 줄이 배포를 기다리지 않는다.
--    새 DB 부트스트랩처럼 코드가 이미 최신이면 36 다음에 그냥 이어 돌리면 된다.
--
-- 배경: (바)·(사) 는 허용 목록(가~마) 밖이라 OCR 이 낸 data-box="바" 를 정화기가 속성째 지워
--   `<blockquote><p>(바) …` 모양으로 남았다(2023 행당중 편지글·하늘은 맑건만, 2021 행당중 양반전).
--   인쇄물에는 '(바)' 머리글 없이 본문만 들여쓰기로 찍혔다.
-- 멱등: 이미 속성이 붙은 상자는 정규식에 안 걸린다. 대상은 id 로 잡는다.

SET search_path = exam, public;

DO $restore$
DECLARE
  v      INT;
  v_bad  INT;
  c_bare TEXT := '<blockquote(?![^>]*\sdata-box\s*=)(\s[^>]*)?>';
BEGIN
  IF to_regclass('exam.passages') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  RAISE NOTICE '대상 DB=% / 롤=%', current_database(), current_user;

  -- 대상 지문과 그 지문이 되찾아야 할 말머리
  CREATE TEMP TABLE paren_target(id UUID PRIMARY KEY, labels TEXT[]) ON COMMIT DROP;
  INSERT INTO paren_target VALUES
    ('b434c063-9e2e-5e15-b7f8-746943c0c5c0', ARRAY['바']),        -- 2023 행당중 중2 1학기 기말 [21~22] 편지글
    ('269025ce-c6e8-5332-9008-f8ccc32a6471', ARRAY['바', '사']),  -- 2023 행당중 중1 2학기 기말 하늘은 맑건만
    ('27747b89-27f0-59f3-9930-f2546dbe6c5b', ARRAY['바']);        -- 2021 행당중 중2 1학기 기말 양반전
  SELECT count(*) INTO v FROM paren_target t JOIN exam.passages g ON g.id = t.id;
  IF v <> 3 THEN RAISE EXCEPTION '대상 지문 3건 중 %건만 찾았다 — 목록을 다시 확인할 것', v; END IF;

  -- 상자 첫 문단 머리의 '(바) ' 글자를 말머리 속성으로 올린다
  UPDATE exam.passages g
     SET html = regexp_replace(g.html, '<blockquote><p>\(([바사아자차])\)\s*', '<blockquote data-box="\1"><p>', 'g')
    FROM paren_target t
   WHERE g.id = t.id AND g.html ~ '<blockquote><p>\([바사아자차]\)';
  GET DIAGNOSTICS v = ROW_COUNT;
  RAISE NOTICE '(바)·(사) 말머리 복원: %건 (재실행이면 0)', v;

  -- 검증은 **대상 3건만** 본다(코덱스 2R) — 다른 지문의 맨 blockquote 는 인용 글일 수 있어 여기 일이 아니다
  SELECT count(*) INTO v_bad
    FROM paren_target t JOIN exam.passages g ON g.id = t.id
   WHERE g.html ~ c_bare
      OR EXISTS (SELECT 1 FROM unnest(t.labels) l WHERE position('data-box="' || l || '"' IN g.html) = 0);
  IF v_bad > 0 THEN RAISE EXCEPTION '검증 실패: 대상 지문 %건에 말머리 없는 상자가 남았거나 기대한 말머리가 없다', v_bad; END IF;
  RAISE NOTICE '검증 통과: 대상 3건 모두 말머리가 붙어 있고 맨 상자가 없다';
END
$restore$;
