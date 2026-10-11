-- =============================================
-- 64. 고등 선택과목 교과서를 '선택과목' 으로 (major_chapters.grade = '' — 학년 구분 없음)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/64_major_chapters_gradeless.sql
-- =============================================
-- 배경(2026-10-11 원장님): "선택과목들은 고2, 고3 구분도 없는데 어떻게 하지?"
--   sql/63 으로 학기를 걷어낸 데 이어 학년도 걷는다. 문학·화법과 언어 같은 일반선택은 고2 에서도 고3 에서도
--   배운다. 그래서 이 교과서들의 대단원 학년을 빈 문자열('' = 학년 구분 없음, 화면 이름 '선택과목')로 바꾼다.
--   카테고리 관리는 고등에서 학년 '선택과목' 을 고를 수 있게 됐다(src/lib/textbook-grade.ts).
--
-- ⚠️ 여기 학년은 **교과서의 학년**이다. 기출 출처(problem_sources.grade)는 **시험을 본 학년**이라 건드리지 않는다.
-- ⚠️ **관리자시스템 야간 동기화가 빈 학년을 받는 판(Ara-system e294ad04, 리포트 version 3)이 배포된 뒤에**,
--    그리고 **동기화 리스(public.claim_araexam_sync)를 잡은 채로** 돌리고, 바로 이어서 Ara-system mig529 를 돌린다.
--    그 사이에 동기화가 돌면 빈 학년 그룹이 기존 교과서(grade '고2')에 못 붙어 '선택과목' 새 행을 만들고 옛 행을 숨긴다.
--
-- 함께 고치는 것(이름 변경 트리거 exam.sync_major_chapter_name 이 학년으로 짝을 찾으므로 어긋나면 안 된다):
--   categories(단어 카테고리)·concept_sheets(개념지)·reference_texts.units(작품 전문 단원 — jsonb 안의 grade).
--   2026-10-11 기준 셋 다 0건이라 안전망이다.
-- 다시 돌려도 안전하다(두 번째부터 0건).

BEGIN;

DO $apply$
DECLARE
  v_publishers CONSTANT TEXT[] := ARRAY[
    '문학 비상', '문학 지학사(정재찬)', '문학 천재(정호웅)',
    '화작과언어 미래엔', '화작과언어 창비'
  ];
  v_found INT;
  v_clash INT;
  v_n     INT;
  r       RECORD;
BEGIN
  -- 실행 대상 확인 — 엉뚱한 프로젝트에 붙어 있으면 여기서 멈춘다
  IF to_regclass('exam.major_chapters') IS NULL OR to_regclass('exam.publishers') IS NULL
     OR to_regclass('exam.categories') IS NULL OR to_regclass('exam.concept_sheets') IS NULL
     OR to_regclass('exam.reference_texts') IS NULL THEN
    RAISE EXCEPTION 'exam 스키마 표가 없습니다 — 공유 Supabase 프로젝트(ara-system)에 붙었는지 확인하세요';
  END IF;

  SELECT count(*) INTO v_found
    FROM exam.publishers WHERE level = '고등' AND name = ANY (v_publishers);
  IF v_found <> cardinality(v_publishers) THEN
    RAISE EXCEPTION '고등 선택과목 교과서 %개 중 %개만 찾았습니다 — 카테고리 관리의 이름이 바뀌었는지 확인하세요',
      cardinality(v_publishers), v_found;
  END IF;

  -- 1. 학년 값 지키기 — 화면이 고르는 값만(빈 값 = 학년 구분 없음)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'exam.major_chapters'::regclass AND conname = 'major_chapters_grade_check'
  ) THEN
    ALTER TABLE exam.major_chapters
      ADD CONSTRAINT major_chapters_grade_check
      CHECK (grade IN ('중1', '중2', '중3', '고1', '고2', '고3', ''));
    RAISE NOTICE 'major_chapters 학년 CHECK 추가';
  END IF;

  -- 2. 학년을 비우면 UNIQUE(name, publisher_id, grade, semester) 가 겹치는지 — 같은 교과서를 고2·고3 둘 다에
  --    등록했거나 이미 '' 로 있는 같은 이름이 있으면 멈춘다(합치기는 사람이 정한다)
  SELECT count(*) INTO v_clash
    FROM exam.major_chapters m
    JOIN exam.publishers p ON p.id = m.publisher_id
   WHERE p.level = '고등' AND p.name = ANY (v_publishers) AND m.grade <> ''
     AND EXISTS (
       SELECT 1 FROM exam.major_chapters o
        WHERE o.id <> m.id AND o.publisher_id = m.publisher_id AND o.name = m.name
          AND o.semester = m.semester AND (o.grade = '' OR o.grade <> m.grade)
     );
  IF v_clash > 0 THEN
    RAISE EXCEPTION '학년을 비우면 이름이 겹치는 대단원이 %건 있습니다 — 카테고리 관리에서 먼저 정리하세요', v_clash;
  END IF;

  UPDATE exam.major_chapters m
     SET grade = ''
    FROM exam.publishers p
   WHERE p.id = m.publisher_id AND p.level = '고등' AND p.name = ANY (v_publishers)
     AND m.grade <> '';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'major_chapters 학년 비움: %건', v_n;

  -- 3. 단어 카테고리 — 자연키(idx_categories_natural_key)가 겹치면 멈춘다
  SELECT count(*) INTO v_clash
    FROM exam.categories c
   WHERE c.level = '고등' AND c.publisher = ANY (v_publishers) AND c.grade <> ''
     AND EXISTS (
       SELECT 1 FROM exam.categories o
        WHERE o.id <> c.id AND o.level = c.level
          AND o.year IS NOT DISTINCT FROM c.year
          AND o.publisher IS NOT DISTINCT FROM c.publisher
          AND o.semester IS NOT DISTINCT FROM c.semester
          AND o.chapter IS NOT DISTINCT FROM c.chapter
          AND o.sub_chapter IS NOT DISTINCT FROM c.sub_chapter
          AND o.school_name IS NOT DISTINCT FROM c.school_name
          AND (o.grade = '' OR o.grade <> c.grade)
     );
  IF v_clash > 0 THEN
    RAISE EXCEPTION '학년을 비우면 겹치는 단어 카테고리가 %건 있습니다 — 단어를 한쪽으로 옮긴 뒤 다시 돌리세요', v_clash;
  END IF;

  UPDATE exam.categories
     SET grade = ''
   WHERE level = '고등' AND publisher = ANY (v_publishers) AND grade <> '';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'categories 학년 비움: %건', v_n;

  -- 4. 개념지 — 자연키가 없어 겹쳐도 에러가 나지 않는다(같은 폴더에 모일 뿐)
  UPDATE exam.concept_sheets
     SET grade = ''
   WHERE level = '고등' AND publisher = ANY (v_publishers) AND grade <> '';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'concept_sheets 학년 비움: %건', v_n;

  -- 5. 작품 전문 단원 — units 배열 안에서 그 교과서 원소의 grade 만 비운다(차례는 그대로)
  UPDATE exam.reference_texts t
     SET units = (
       SELECT jsonb_agg(
                CASE WHEN u ->> 'textbook' = ANY (v_publishers) AND u ->> 'grade' <> ''
                     THEN jsonb_set(u, '{grade}', '""'::jsonb) ELSE u END
                ORDER BY ord)
         FROM jsonb_array_elements(t.units) WITH ORDINALITY AS e(u, ord)
     )
   WHERE EXISTS (
     SELECT 1 FROM jsonb_array_elements(t.units) u
      WHERE u ->> 'textbook' = ANY (v_publishers) AND u ->> 'grade' <> ''
   );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'reference_texts 단원 학년 비움: %건', v_n;

  -- 6. 검증 — 고등 교과서별 학년·학기 분포
  FOR r IN
    SELECT p.name,
           CASE WHEN m.grade = '' THEN '(선택과목)' ELSE m.grade END AS grade,
           CASE WHEN m.semester = '' THEN '(학기 구분 없음)' ELSE m.semester END AS sem,
           count(*) AS n
      FROM exam.major_chapters m JOIN exam.publishers p ON p.id = m.publisher_id
     WHERE p.level = '고등'
     GROUP BY 1, 2, 3 ORDER BY 1, 2, 3
  LOOP
    RAISE NOTICE '  % · % · % : %', r.name, r.grade, r.sem, r.n;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM exam.major_chapters m JOIN exam.publishers p ON p.id = m.publisher_id
     WHERE p.level = '고등' AND p.name = ANY (v_publishers) AND m.grade <> ''
  ) THEN
    RAISE EXCEPTION '검증 실패: 선택과목 대단원에 학년이 남았습니다';
  END IF;
END
$apply$;

COMMIT;
