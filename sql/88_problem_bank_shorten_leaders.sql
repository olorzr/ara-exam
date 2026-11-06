-- =============================================
-- 88. 기출 문제 은행 — 긴 지시선을 짧게 (데이터 교정)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/88_problem_bank_shorten_leaders.sql
-- =============================================
-- 배경(원장님 2026-11-06): 「남신의주 유동 박시봉방」 41번 — 맞춤법 조항 뒤의 점선 지시선 62자가 〈보기〉 상자를 옆 단까지
-- 밀었다. 넘침 자체는 0.9.68 의 CSS 가 막았고, 이 파일은 2단 칸에서 줄을 통째로 차지하던 지시선을 줄인다.
--
-- ⚠️ **8자 이상만 줄인다.** 지시선은 원본 판면에서 오른쪽 끝을 맞추던 점이라 내용이 아니지만, 지문의 '……'·'......' 은
--    내용이다(대본·소설에 흔하다). 8자 아래는 건드리지 않는다.
-- ⚠️ 문제지 스냅샷은 고치지 않는다 — CSS 로 이미 안 넘치고, 고치면 쪽 수가 바뀌어 책등 쪽 수까지 다시 재야 한다.
-- ⚠️ 같은 규칙이 적재 문에 있다(layout-lint.cjs 의 shortenLeaders) — 다시 적재해도 긴 지시선은 못 들어온다.
-- 멱등하다 — 줄인 뒤에는 조건에 안 걸린다. 문항 UPDATE 이므로 감사 로그와 updated_at 이 그대로 돈다.

BEGIN;

SET LOCAL search_path = exam, public;

CREATE OR REPLACE FUNCTION pg_temp.shorten_leaders(t TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT regexp_replace(regexp_replace(regexp_replace(t,
    '·{8,}', '······', 'g'), '…{8,}', '……', 'g'), '\.{8,}', '......', 'g');
$fn$;

DO $leaders$
DECLARE
  v_stem INT; v_choice INT; v_exp INT; v_passage INT; v_left INT;
BEGIN
  IF to_regclass('exam.problems') IS NULL THEN
    RAISE EXCEPTION 'exam.problems 가 없습니다 (현재 DB: %).', current_database();
  END IF;

  UPDATE exam.problems SET stem_html = pg_temp.shorten_leaders(stem_html)
   WHERE stem_html ~ '·{8,}|…{8,}|\.{8,}';
  GET DIAGNOSTICS v_stem = ROW_COUNT;

  UPDATE exam.problems SET choices = pg_temp.shorten_leaders(choices::text)::jsonb
   WHERE choices::text ~ '·{8,}|…{8,}|\.{8,}';
  GET DIAGNOSTICS v_choice = ROW_COUNT;

  UPDATE exam.problems SET explanation_html = pg_temp.shorten_leaders(explanation_html)
   WHERE explanation_html ~ '·{8,}|…{8,}|\.{8,}';
  GET DIAGNOSTICS v_exp = ROW_COUNT;

  UPDATE exam.passages SET html = pg_temp.shorten_leaders(html)
   WHERE html ~ '·{8,}|…{8,}|\.{8,}';
  GET DIAGNOSTICS v_passage = ROW_COUNT;

  RAISE NOTICE '줄임 — 발문 % / 선지 % / 해설 % / 지문 %', v_stem, v_choice, v_exp, v_passage;

  SELECT count(*) INTO v_left FROM exam.problems
   WHERE stem_html ~ '·{8,}|…{8,}|\.{8,}' OR choices::text ~ '·{8,}|…{8,}|\.{8,}' OR explanation_html ~ '·{8,}|…{8,}|\.{8,}';
  IF v_left > 0 THEN RAISE EXCEPTION '긴 지시선이 든 문항 %건이 남았습니다.', v_left; END IF;
END
$leaders$;

COMMIT;
