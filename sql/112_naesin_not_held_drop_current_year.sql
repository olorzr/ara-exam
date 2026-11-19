-- 112: 올해(2026) 칸의 '시험 없음' 기록을 지운다 (2026-11-19)
--
-- 왜: 원장님 "2026은 우선 다 x 표하지 말아 봐… 학교에서 아직 안 올렸을 수도 있음".
--     올해 시험지는 학교가 아직 안 올렸을 수 있어, 데스크가 못 찾았다는 것이 '시험 없음'의 근거가 못 된다.
-- 무엇: sql/111 이 넣은 2026 칸(서울사대부중 중2·중3 1학기 중간) 2행을 지운다. sql/111 도 그 두 행을 빼 128칸으로 고쳐,
--       다시 돌려도 되살아나지 않게 했다. 빠진 기출 목록 도구(naesin-gaps/gaps.cjs)도 올해 칸은 어떤 '없음' 표시로도 빼지 않는다.
-- 멱등: 조건 있는 DELETE — 다시 돌리면 0행.

BEGIN;

DELETE FROM exam.naesin_exams_not_held
 WHERE year = '2026' AND confirmed_by = '데스크' AND confirmed_on = DATE '2026-11-19';

DO $$
DECLARE n int; m int;
BEGIN
  SELECT count(*) INTO n FROM exam.naesin_exams_not_held WHERE year = '2026';
  SELECT count(*) INTO m FROM exam.naesin_exams_not_held;
  RAISE NOTICE 'naesin_exams_not_held: 2026 칸 %행 남음(기대 0) · 전체 %행(기대 128)', n, m;
  IF n <> 0 THEN RAISE EXCEPTION '2026 칸이 남았다: %', n; END IF;
END $$;

COMMIT;
