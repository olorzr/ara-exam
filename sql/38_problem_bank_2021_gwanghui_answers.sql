-- =============================================
-- 38. 2021 광희중 여덟 세트 — 별도 답지로 정답 채우기
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/38_problem_bank_2021_gwanghui_answers.sql
-- =============================================
-- 배경:
--   2021년 광희중 기출 여덟 세트(234문항)는 OCR 당시 **정답지가 없어 정답 칸이 통째로 비어**
--   있었다(`ocr_meta.warnings` 에 그 경고가 남아 있다). 2026-09-21 에 학교 배부본 답지
--   PDF 여덟 장을 받아 `sources/{id}/answer-key/1.pdf` 로 올리고, 그 표를 읽어 채운다.
--
-- ⚠️ **사람이 원본 답지를 읽어 옮긴 값이라 재계산이 안 된다.** DB 만 고치고 끝내면
--   복구했을 때 되살릴 길이 없어 sql/32(문법 태깅 백필)와 같은 이유로 여기 남긴다.
--
-- 규약:
--   · 객관식 저장값은 자리 번호 문자열('3'), 복수 정답은 **공백 없는 쉼표**('1,4') —
--     `src/lib/problem-paper/answers.ts` 가 이 꼴만 선지로 읽는다.
--   · 서술형은 답지에 인쇄된 정답과 채점 기준을 그대로 옮긴다(여러 줄은 ' / ' 로 잇는다).
--   · **비어 있는 칸만 채운다**(`btrim(answer) = ''`). 이미 손으로 넣은 답이 있으면 건드리지 않는다.
--   · 멱등하다 — 다시 돌리면 0행이 바뀐다.

DO $guard$
BEGIN
  IF to_regclass('exam.problems') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  -- 2번 단계가 쓰는 컬럼은 sql/19 가 만든다. 여기서 안 보면 정답만 채우고 그 UPDATE 에서 죽는다
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='exam' AND table_name='problem_sources' AND column_name='answer_key_paths')
  THEN
    RAISE EXCEPTION 'sql/19(별도 답지 파일)가 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  IF to_regclass('exam.problem_paper_items') IS NULL THEN
    RAISE EXCEPTION 'sql/17 의 problem_paper_items 가 없습니다 (현재 DB: %).', current_database();
  END IF;
END
$guard$;

SET search_path = exam, public;

-- ---------------------------------------------
-- 1. 정답 채우기
-- ---------------------------------------------
DO $fill$
DECLARE
  r RECORD;
  n_filled INT;
  n_rows INT;
  n_conflict INT := 0;
BEGIN
  CREATE TEMP TABLE _ans (
    source_id     UUID NOT NULL,
    question_type TEXT NOT NULL,
    number        INT  NOT NULL,
    answer        TEXT NOT NULL
  ) ON COMMIT DROP;

  -- 중2 1학기 중간 (선택형 24 + 서술형 2)
  INSERT INTO _ans VALUES
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 1,'1'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 2,'3'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 3,'4'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 4,'5'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 5,'3'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 6,'5'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 7,'2'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 8,'5'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식', 9,'1'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',10,'2'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',11,'4'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',12,'3'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',13,'2'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',14,'2'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',15,'1'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',16,'4'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',17,'3'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',18,'5'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',19,'2'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',20,'4'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',21,'5'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',22,'2'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',23,'3'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','객관식',24,'4'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','서술형', 1,'1) 동백꽃 / 2) 알싸한 그리고 향긋한 그 냄새에 나는 땅이 꺼지는 듯 온 정신이 고만 아찔하였다.'),
    ('0e1e22dd-5518-5e28-b672-502880c25c7f','서술형', 2,'당신은 흙발로 나를 짓밟습니다. / 당신은 물만 건너면 나를 돌아보지도 않고 가십니다그려. (둘 중 하나만 쓰면 정답.)');

  -- 중2 1학기 기말 (선택형 28)
  INSERT INTO _ans VALUES
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 1,'5'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 2,'1,4'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 3,'4'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 4,'4'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 5,'1'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 6,'2'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 7,'3'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 8,'4'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식', 9,'3'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',10,'3'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',11,'2'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',12,'3'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',13,'3'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',14,'2'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',15,'5'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',16,'1'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',17,'4'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',18,'4'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',19,'2'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',20,'3'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',21,'2'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',22,'1'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',23,'5'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',24,'1'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',25,'5'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',26,'1'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',27,'4'),
    ('2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4','객관식',28,'2');

  -- 중2 2학기 중간 (선택형 24 + 서술형 2)
  INSERT INTO _ans VALUES
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 1,'3'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 2,'4'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 3,'4'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 4,'4'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 5,'4'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 6,'2'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 7,'2'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 8,'3'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식', 9,'5'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',10,'5'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',11,'3'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',12,'4'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',13,'2'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',14,'1'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',15,'4'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',16,'5'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',17,'3'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',18,'1'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',19,'5'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',20,'5'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',21,'1'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',22,'4'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',23,'5'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','객관식',24,'3'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','서술형', 1,'꿰맨 고무신이 벗겨져 물살에 흘러가고 만다.'),
    ('920f9972-4f23-5f7e-a0db-385ebfca82a3','서술형', 2,'㉠: 소리가 세짐 / ㉡: 가획 / ㉢: ㆆ / ㉣: ㅎ');

  -- 중2 2학기 기말 (선택형 28)
  INSERT INTO _ans VALUES
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 1,'3'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 2,'1'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 3,'4'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 4,'2'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 5,'3,5'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 6,'4'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 7,'1'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 8,'3'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식', 9,'4'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',10,'1'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',11,'3'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',12,'4'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',13,'5'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',14,'4'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',15,'3'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',16,'2'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',17,'2'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',18,'5'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',19,'5'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',20,'5'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',21,'4'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',22,'3'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',23,'2'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',24,'4'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',25,'4'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',26,'1'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',27,'3'),
    ('a059f929-9f9f-55c6-8958-9dfaf7e5ad20','객관식',28,'1');

  -- 중3 1학기 중간 (선택형 30 + 서술형 3)
  INSERT INTO _ans VALUES
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 1,'1,4'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 2,'2'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 3,'5'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 4,'3'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 5,'4'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 6,'2'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 7,'5'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 8,'1'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식', 9,'3'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',10,'2'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',11,'4'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',12,'5'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',13,'4'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',14,'3'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',15,'4'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',16,'3'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',17,'2'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',18,'4'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',19,'2'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',20,'1'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',21,'1'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',22,'3'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',23,'2'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',24,'1'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',25,'5'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',26,'5'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',27,'3'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',28,'1'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',29,'5'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','객관식',30,'5'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','서술형', 1,'(1) 시계: 자연의 질서를(에) 따르지 않는(안 따르는) 삶 / (2) 달력: 자연의 질서를(에) 따르는 삶 / ※ ''자연, 질서, 따르다'' 제시어를 모두 활용하고 위 정답과 의미가 유사하면 정답 처리함.'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','서술형', 2,'음운은 말의 (1) 뜻을(의미를) 구별(구분)해 주는 (2) 소리의 (3) 가장 작은 단위이다.'),
    ('6f99ddb7-fdae-5ad2-a75a-85f42351582a','서술형', 3,'혀의 최고점의 위치');

  -- 중3 1학기 기말 (선택형 33)
  INSERT INTO _ans VALUES
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 1,'1,5'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 2,'4,5'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 3,'2'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 4,'3'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 5,'2'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 6,'3'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 7,'4'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 8,'1'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식', 9,'2,5'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',10,'5'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',11,'4'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',12,'3'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',13,'1'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',14,'4'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',15,'3'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',16,'1'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',17,'3'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',18,'1'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',19,'2'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',20,'1'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',21,'2'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',22,'4'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',23,'5'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',24,'2'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',25,'3'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',26,'4'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',27,'5'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',28,'3'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',29,'2'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',30,'1'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',31,'4'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',32,'3'),
    ('988b2bed-6298-5f35-af5d-f9ebbf15549f','객관식',33,'5');

  -- 중3 2학기 중간 (선택형 28 + 서술형 2)
  INSERT INTO _ans VALUES
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 1,'1'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 2,'1,3'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 3,'5'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 4,'5'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 5,'5'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 6,'2'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 7,'4'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 8,'2'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식', 9,'2'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',10,'2,3'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',11,'1,4'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',12,'5'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',13,'5'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',14,'1'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',15,'2'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',16,'4'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',17,'4'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',18,'1'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',19,'3'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',20,'5'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',21,'3'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',22,'3'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',23,'3'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',24,'1,2'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',25,'4'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',26,'4'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',27,'4'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','객관식',28,'5'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','서술형', 1,'국어 상용의 가'),
    ('7315b8ba-daee-5e6f-877a-8b3d13606d83','서술형', 2,'택배 기사들은 노동자이다. / 택배 기사들은 노동자에 속한다. / 택배 기사들은 택배 산업에서 핵심이 되는 노동자들이다. / ※ ''택배 기사들''을 주어로, ''노동자''를 서술어나 부사어로 삼아 동일하거나 포함되는 관계로 서술하면 정답 처리함.');

  -- 중3 2학기 기말 (선택형 30)
  INSERT INTO _ans VALUES
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 1,'3'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 2,'5'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 3,'5'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 4,'4'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 5,'4,5'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 6,'1,4'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 7,'1'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 8,'2'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식', 9,'1'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',10,'5'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',11,'3'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',12,'3'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',13,'2,4'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',14,'3'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',15,'5'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',16,'3'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',17,'1'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',18,'3'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',19,'4'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',20,'2'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',21,'2'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',22,'2'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',23,'2'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',24,'1'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',25,'2,5'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',26,'5'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',27,'1'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',28,'4'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',29,'3'),
    ('0a18c4e1-3509-5ae4-86be-abc53c0fa252','객관식',30,'1,4');

  -- 적재한 답과 실제 문항이 **양방향으로** 1:1 인지 먼저 본다.
  -- ⚠️ 한쪽(답지 → 문항)만 보면 시험지 쪽에 OCR 중복행이 하나 더 있어도 통과한다 —
  --    그 행은 답이 빈 채 남고 같은 답이 두 행에 붙는다(2025 광희중 중1 2학기 중간에서
  --    16~19번이 실제로 그랬다). 그래서 **중복·양방향 짝·개수** 셋을 다 보고, 어긋나면
  --    한 행도 고치지 않고 멈춘다.
  FOR r IN
    SELECT p.source_id, p.question_type, p.number, count(*) AS c
      FROM exam.problems p
     WHERE p.source_id IN (SELECT DISTINCT source_id FROM _ans)
     GROUP BY 1, 2, 3 HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION '같은 번호의 문항이 여럿입니다(중복 적재): % % %번 %개 — 먼저 정리하세요',
      r.source_id, r.question_type, r.number, r.c;
  END LOOP;

  FOR r IN
    SELECT a.source_id, a.question_type, a.number
      FROM _ans a
     WHERE NOT EXISTS (
       SELECT 1 FROM exam.problems p
        WHERE p.source_id = a.source_id AND p.question_type = a.question_type AND p.number = a.number)
  LOOP
    RAISE EXCEPTION '답지에 있는 문항이 DB 에 없습니다: % % %번', r.source_id, r.question_type, r.number;
  END LOOP;

  FOR r IN
    SELECT p.source_id, p.question_type, p.number
      FROM exam.problems p
     WHERE p.source_id IN (SELECT DISTINCT source_id FROM _ans)
       AND NOT EXISTS (
         SELECT 1 FROM _ans a
          WHERE a.source_id = p.source_id AND a.question_type = p.question_type AND a.number = p.number)
  LOOP
    RAISE EXCEPTION 'DB 에 있는 문항이 답지에 없습니다: % % %번', r.source_id, r.question_type, r.number;
  END LOOP;

  SELECT count(*) INTO n_rows FROM exam.problems
   WHERE source_id IN (SELECT DISTINCT source_id FROM _ans);
  IF n_rows <> (SELECT count(*) FROM _ans) THEN
    RAISE EXCEPTION '문항 수(%)와 답지 줄 수(%)가 다릅니다', n_rows, (SELECT count(*) FROM _ans);
  END IF;

  -- ⚠️ **이미 답이 있는데 답지와 다르면 조용히 넘기지 않는다.**
  --    아래 UPDATE 는 빈 칸만 채운다 — 손으로 넣은 값을 덮지 않으려는 규칙인데, 그것만으로
  --    끝내면 답지와 **어긋난 답이 남은 채 '완료'** 로 읽힌다(둘 중 하나는 틀린 것이고,
  --    어느 쪽인지는 사람이 원본을 보고 정해야 한다). 그래서 한 건이라도 있으면
  --    **한 행도 고치지 않고** 전부 적어 놓고 멈춘다. 재실행은 값이 같으면 걸리지 않는다.
  FOR r IN
    SELECT p.source_id, p.question_type, p.number, p.answer AS live, a.answer AS sheet
      FROM exam.problems p
      JOIN _ans a ON a.source_id = p.source_id
                 AND a.question_type = p.question_type
                 AND a.number = p.number
     WHERE btrim(p.answer) <> '' AND btrim(p.answer) <> a.answer
     ORDER BY p.source_id, p.question_type, p.number
  LOOP
    n_conflict := n_conflict + 1;
    RAISE WARNING '답지와 다른 답이 이미 들어 있습니다: % % %번 — DB [%] / 답지 [%]',
      r.source_id, r.question_type, r.number, r.live, r.sheet;
  END LOOP;
  IF n_conflict > 0 THEN
    RAISE EXCEPTION '답지와 어긋나는 정답이 %건 있습니다 — 위 목록을 원본과 맞춰 본 뒤 다시 돌리세요', n_conflict;
  END IF;

  UPDATE exam.problems p
     SET answer = a.answer
    FROM _ans a
   WHERE p.source_id = a.source_id
     AND p.question_type = a.question_type
     AND p.number = a.number
     AND btrim(p.answer) = '';
  GET DIAGNOSTICS n_filled = ROW_COUNT;
  RAISE NOTICE '정답을 채운 문항: %건 (처음 실행이면 234)', n_filled;
END
$fill$;

-- ---------------------------------------------
-- 2. 이미 만들어 둔 문제지의 스냅샷도 함께 고친다
-- ---------------------------------------------
-- ⚠️ **인쇄는 원본이 아니라 스냅샷을 읽는다.** 정답을 채우기 전에 담아 둔 문항은
--    스냅샷의 `answer` 가 빈 채라 교사용·답지에 계속 '미입력' 으로 찍힌다(sql/36 의 상자
--    교정과 같은 자리 — 스냅샷 불변 규약은 '원본 수정이 흘러든다' 를 막는 것이지, 비어 있던
--    칸을 원본 답지로 메우는 교정까지 막는 뜻은 아니다).
-- **빈 칸만 채운다** — 스냅샷에 이미 답이 있으면(그 문제지를 만든 뒤 답이 바뀌었을 수 있다)
-- 건드리지 않는다.
DO $snap$
DECLARE n INT; n_diff INT;
BEGIN
  -- 스냅샷에 **다른** 답이 들어 있는 것은 그대로 둔다(그 문제지를 만든 뒤 답이 바뀐 경우가
  -- 있어 불변이 맞다). 다만 몇 건인지는 적어 둔다 — 조용히 지나가면 인쇄물이 아카이브와
  -- 다른 답을 찍고 있다는 것을 아무도 모른다.
  SELECT count(*) INTO n_diff
    FROM exam.problem_paper_items i
    JOIN exam.problems p ON p.id = i.problem_id
   WHERE p.source_id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
     AND btrim(coalesce(i.snapshot ->> 'answer', '')) <> ''
     AND btrim(i.snapshot ->> 'answer') <> btrim(p.answer);
  IF n_diff > 0 THEN
    RAISE WARNING '문제지 스냅샷이 아카이브와 다른 답을 들고 있습니다: %건 (일부러 그대로 둡니다)', n_diff;
  END IF;

  UPDATE exam.problem_paper_items i
     SET snapshot = jsonb_set(i.snapshot, '{answer}', to_jsonb(p.answer))
    FROM exam.problems p
   WHERE p.id = i.problem_id
     AND p.source_id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
     AND btrim(p.answer) <> ''
     AND btrim(coalesce(i.snapshot ->> 'answer', '')) = '';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '정답을 채운 문제지 스냅샷: %건', n;
END
$snap$;

-- ---------------------------------------------
-- 3. 출처에 답지 파일 경로 남기기
-- ---------------------------------------------
-- 파일은 Storage(exam-problem-bank)의 `sources/{id}/answer-key/1.pdf` 에 이미 올라가 있다.
UPDATE exam.problem_sources
   SET answer_key_paths = ARRAY['sources/' || id::text || '/answer-key/1.pdf']
 WHERE id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
   AND answer_key_paths = '{}';

-- ---------------------------------------------
-- 4. 업로드 메모 고치기 — '정답지가 없다' 는 이제 사실이 아니다
-- ---------------------------------------------
-- ⚠️ 학교·연도로 잡지 말 것 — 나중에 같은 학교·같은 해 출처를 더 올리면 그 메모까지
--    '정답을 채웠다' 고 바꿔 버린다. 이 파일이 손댄 여덟 출처만 고친다.
UPDATE exam.problem_sources
   SET notes = replace(notes,
         '정답지가 따로 없어 정답 칸은 비워 두었습니다.',
         '정답지를 2026-09-21 에 따로 받아 정답을 채웠습니다(sql/38).')
 WHERE id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
   AND notes LIKE '%정답지가 따로 없어 정답 칸은 비워 두었습니다.%';

-- ---------------------------------------------
-- 5. 적용 뒤 검증 (이 파일이 손댄 여덟 출처만)
-- ---------------------------------------------
DO $verify$
DECLARE r RECORD; bad INT;
BEGIN
  RAISE NOTICE '--- 출처별 정답 채움률 ---';
  FOR r IN
    SELECT s.grade, s.semester, s.exam_type, cardinality(s.answer_key_paths) AS keys,
           count(*) FILTER (WHERE btrim(p.answer) <> '') AS filled, count(*) AS tot
      FROM exam.problem_sources s JOIN exam.problems p ON p.source_id = s.id
     WHERE s.id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
     GROUP BY s.id, s.grade, s.semester, s.exam_type, s.answer_key_paths
     ORDER BY s.grade, s.semester, s.exam_type
  LOOP
    RAISE NOTICE '  % % % : %/% (답지파일 %)', r.grade, r.semester, r.exam_type, r.filled, r.tot, r.keys;
  END LOOP;

  -- ⚠️ 검증은 NOTICE 로 끝내지 않는다 — 실행기는 종료코드만 보므로, 어긋난 채 '완료' 로 읽힌다.
  SELECT count(*) INTO bad FROM exam.problems p
   WHERE p.source_id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
     AND p.question_type = '객관식'
     AND (btrim(p.answer) = ''
          OR btrim(p.answer) !~ '^[1-5](,[1-5])*$'
          OR (SELECT max(x::int) FROM unnest(string_to_array(p.answer, ',')) x) > jsonb_array_length(p.choices));
  IF bad > 0 THEN
    RAISE EXCEPTION '객관식 중 비었거나·꼴이 틀렸거나·없는 선지를 가리키는 것이 %건 있습니다', bad;
  END IF;
  RAISE NOTICE '객관식 정답 꼴·선지 범위 검사: 이상 없음';

  SELECT count(*) INTO bad FROM exam.problems p
   WHERE p.source_id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
     AND btrim(p.answer) = '';
  IF bad > 0 THEN
    RAISE EXCEPTION '이 여덟 출처에 답 없는 문항이 %건 남았습니다', bad;
  END IF;
  RAISE NOTICE '2021 광희중 답 없는 문항: 0건';

  SELECT count(*) INTO bad FROM exam.problem_sources
   WHERE id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
     AND cardinality(answer_key_paths) <> 1;
  IF bad > 0 THEN
    RAISE EXCEPTION '답지 파일 경로가 안 붙은 출처가 %건 있습니다', bad;
  END IF;
  RAISE NOTICE '답지 파일 경로: 여덟 출처 모두 1개';

  SELECT count(*) INTO bad FROM exam.problem_paper_items i
    JOIN exam.problems p ON p.id = i.problem_id
   WHERE p.source_id IN (
   '0e1e22dd-5518-5e28-b672-502880c25c7f','2e7c0945-a8ff-5d8f-bb2a-9590b1cef3a4',
   '920f9972-4f23-5f7e-a0db-385ebfca82a3','a059f929-9f9f-55c6-8958-9dfaf7e5ad20',
   '6f99ddb7-fdae-5ad2-a75a-85f42351582a','988b2bed-6298-5f35-af5d-f9ebbf15549f',
   '7315b8ba-daee-5e6f-877a-8b3d13606d83','0a18c4e1-3509-5ae4-86be-abc53c0fa252')
     AND btrim(coalesce(i.snapshot ->> 'answer', '')) = '';
  IF bad > 0 THEN
    RAISE EXCEPTION '답이 빈 문제지 스냅샷이 %건 남았습니다', bad;
  END IF;
  RAISE NOTICE '문제지 스냅샷 중 답 빈 것: 0건';
END
$verify$;
