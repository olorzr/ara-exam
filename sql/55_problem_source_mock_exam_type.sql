-- =============================================
-- 55. 모의고사 출처의 회차 — exam_type 에 '수능'·'6월 모평' … 을 허용한다
-- =============================================
--
-- 왜:
--   기출 트리를 고등 / 중등 / 모의고사·수능 으로 가르면서(2026-09-29 사용자 요청), 모의고사는
--   **학년도 › 회차** 로 훑게 했다. 모의고사는 전국 공통이라 학교·학기가 없고, 같은 학년도 안에서
--   시험을 가르는 것이 회차뿐이다. 새 컬럼을 두지 않고 내신의 '중간·기말' 자리(exam_type)에
--   담는다 — 필터 축·주소(`?exam=`)·출처 줄이 이미 이 칸을 쓰고 있어 그대로 이어진다.
--
--   그런데 CHECK 가 ('', '중간', '기말') 만 받아서, 평가원 수능·모평을 적재하면 거절된다.
--
-- 규칙:
--   · '', '중간', '기말' 은 지금처럼 **어느 유형에나** 둔다(옛 행을 건드리지 않는다).
--   · 회차 값은 **source_type = '모의고사' 일 때만**. 목록은 앱의
--     `MOCK_EXAM_TYPE_OPTIONS`(src/lib/problem-bank/source-form.ts)와 **같아야 한다** —
--     한쪽에만 더하면 화면에 없는 값이 생기거나 저장이 거절된다.
--
-- 멱등: 제약을 지우고 같은 이름으로 다시 만든다.
-- =============================================

ALTER TABLE exam.problem_sources DROP CONSTRAINT IF EXISTS problem_sources_exam_type_check;

ALTER TABLE exam.problem_sources ADD CONSTRAINT problem_sources_exam_type_check CHECK (
  exam_type IN ('', '중간', '기말')
  OR (
    source_type = '모의고사'
    AND exam_type IN (
      '수능', '6월 모평', '9월 모평', '모평', '예비평가', '예비시행', '예시문항',
      '3월 학평', '4월 학평', '5월 학평', '6월 학평', '7월 학평', '9월 학평', '10월 학평', '11월 학평'
    )
  )
);

COMMENT ON COLUMN exam.problem_sources.exam_type IS
  '내신: 중간·기말. 모의고사: 회차(수능·6월 모평·9월 모평·예비시행·3월 학평 …, sql/55). '''' = 미지정';

-- ---------------------------------------------
-- 검증
-- ---------------------------------------------
DO $$
DECLARE
  def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
    FROM pg_constraint
   WHERE conrelid = 'exam.problem_sources'::regclass
     AND conname = 'problem_sources_exam_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'exam_type CHECK 가 없다'; END IF;
  IF position('수능' IN def) = 0 THEN RAISE EXCEPTION '회차 값이 CHECK 에 없다: %', def; END IF;
  RAISE NOTICE 'sql/55 적용됨: %', def;
END $$;
