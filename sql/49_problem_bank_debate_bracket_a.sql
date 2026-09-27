-- =============================================
-- 49. 기출 문제 은행 — 에어컨 토론 지문의 [A] 를 원본 모양(문단 한 개를 두른 구간)으로 (데이터 교정)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/49_problem_bank_debate_bracket_a.sql
-- =============================================
-- 배경 (2026-09-27, sql/48 의 후속):
--   2022 대원국제중 중3 2학기 기말 4쪽 토론 지문(452a376b)은 원본에서 '(반대1) 현중 학습 효과를 …
--   의문스럽습니다.' 문단 **하나 전체**에 오른쪽 [A] 괄호가 걸려 있다(밑줄 없음 — 쪽 이미지를 확대해 확인).
--   OCR 은 그것을 `<u>[A] 학습 효과를 …</u>` 로, 즉 밑줄 친 글자 앞에 "[A]" 를 적어 넣었다. 11번 문항이
--   "[A]의 발언에 대해 조언을 한다고 할 때" 를 묻는데 인쇄물에는 원본에 없는 밑줄과 글자 "[A]" 가 찍혔다.
--   → 그 문단을 `<blockquote data-box="A">` 로 감싸고 밑줄과 글자 "[A]" 를 뺀다(인쇄가 [A] 세로선·말머리를 그린다).
--
-- ⚠️ 이 한 건만 고친다. 운영에 글자 "[A]" 가 든 지문은 31건이지만 대부분 **밑줄 친 구절 옆 표시**나
--    빈칸 "( [A] )" 라서 상자로 바꾸면 오히려 원본과 달라진다 — 원본을 본 것만 고친다.
-- ⚠️ sql/48 의 머리 주석이 적은 두 후속 가운데 a854a665(코르니유 영감의 비밀)는 **고칠 것이 없었다** —
--    [A] 상자가 이미 앞 두 문단만 감싸고 있고 원본과 같다(조사 쿼리의 끝 기준이 빠져 오판했다).
-- ⚠️ 멱등하다(바꿀 문단이 그대로 있을 때만 바꾼다, 재실행 0행). 이 지문을 담은 문제지 스냅샷은 없다(적용 날 0건).

SET search_path = exam, public;

DO $bracket$
DECLARE
  v       INT;
  c_id    CONSTANT UUID := '452a376b-9df9-4bd9-b37b-827589d8467e';
  c_old   CONSTANT TEXT := $old$<p>(반대1) 현중 <u>[A] 학습 효과를 높이기 위해 온도를 낮추어야 한다니 어이가 없습니다. 찬성 측 토론자는 평소 수업 시간에 딴짓을 많이 하는데, 실내 온도가 낮아진다고 공부에 집중할까요? 저는 그 점이 매우 의문스럽습니다.</u></p>$old$;
  c_new   CONSTANT TEXT := $new$<blockquote data-box="A"><p>(반대1) 현중 학습 효과를 높이기 위해 온도를 낮추어야 한다니 어이가 없습니다. 찬성 측 토론자는 평소 수업 시간에 딴짓을 많이 하는데, 실내 온도가 낮아진다고 공부에 집중할까요? 저는 그 점이 매우 의문스럽습니다.</p></blockquote>$new$;
  v_plain TEXT;
BEGIN
  IF to_regclass('exam.passages') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  RAISE NOTICE '대상 DB=% / 롤=%', current_database(), current_user;

  SELECT regexp_replace(html, '<[^>]+>', '', 'g') INTO v_plain FROM exam.passages WHERE id = c_id;
  IF v_plain IS NULL THEN RAISE EXCEPTION '지문 %를 찾지 못했다', c_id; END IF;

  -- 바꿀 문단이 정확히 한 번 있을 때만 바꾼다(두 번이면 어느 것인지 모른다)
  UPDATE exam.passages
     SET html = replace(html, c_old, c_new)
   WHERE id = c_id
     AND array_length(string_to_array(html, c_old), 1) = 2;
  GET DIAGNOSTICS v = ROW_COUNT;
  RAISE NOTICE '1. [A] 구간 상자로: %건 (재실행이면 0)', v;

  -- 검증
  SELECT count(*) INTO v FROM exam.passages
   WHERE id = c_id AND array_length(string_to_array(html, c_new), 1) = 2 AND strpos(html, c_old) = 0;
  IF v <> 1 THEN RAISE EXCEPTION '검증 실패: 새 [A] 상자가 한 번 들어가 있지 않다'; END IF;

  SELECT count(*) INTO v FROM exam.passages
   WHERE id = c_id AND regexp_replace(html, '<[^>]+>', '', 'g') <> replace(v_plain, '[A] ', '')
     AND regexp_replace(html, '<[^>]+>', '', 'g') <> v_plain;
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 글자 "[A] " 말고 다른 글자가 바뀌었다'; END IF;

  SELECT count(*) INTO v FROM exam.passages WHERE id = c_id AND html ~ '\[A\]';
  IF v > 0 THEN RAISE EXCEPTION '검증 실패: 글자 "[A]" 가 남았다'; END IF;

  RAISE NOTICE '검증 통과';
END
$bracket$;
