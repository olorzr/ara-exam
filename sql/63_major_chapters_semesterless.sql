-- =============================================
-- 63. 고등 선택과목 교과서를 '학기 구분 없음' 으로 (major_chapters.semester = '')
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/63_major_chapters_semesterless.sql
-- =============================================
-- 배경(2026-10-10 원장님): "고등의 화법과 언어·독서와 작문·문학 같은 선택 과목은 1·2학기 구분 없이
--   1학기만 사용하게 되어 있어. 학교마다 1학기에 할지 2학기에 할지는 본인 취향이고."
--   그래서 이 교과서들의 대단원 학기를 빈 문자열('' = 학기 구분 없음)로 바꾼다. 카테고리 관리는 고등에서
--   '학기 구분 없음' 을 고를 수 있게 됐다(src/lib/semester.ts).
--   공통국어(지학사·창비·천재)는 1학기 권·2학기 권이 진짜 따로라 그대로 둔다.
--
-- ⚠️ 여기 학기는 **교과서 권의 학기**다. 기출 출처(problem_sources.semester)는 **시험을 본 학기**라
--    건드리지 않는다 — 2학기에 화법과 언어 시험을 보는 학교의 기출은 여전히 '2학기 중간' 이다.
-- ⚠️ **관리자시스템 야간 동기화가 빈 학기를 받는 판(ara-system fbf0b49f, 리포트 version 2)이 배포된 뒤에** 돌린다.
--    옛 판은 빈 학기 대단원을 버리고 그 교과서를 자동 숨김해 내신 관리 교과서 목록에서 지운다.
--
-- 함께 고치는 것: 같은 교과서를 가리키는 categories(단어 카테고리)·concept_sheets(개념지)의 학기도 '' 로 —
--   이름 변경 트리거(exam.sync_major_chapter_name)가 학기로 짝을 찾으므로 어긋나면 이름 변경 전파가 끊긴다.
--   2026-10-10 기준 둘 다 0건이라 안전망이다. reference_texts.units(작품 전문 단원)도 고등은 0건이다.
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
     OR to_regclass('exam.categories') IS NULL OR to_regclass('exam.concept_sheets') IS NULL THEN
    RAISE EXCEPTION 'exam 스키마 표가 없습니다 — 공유 Supabase 프로젝트(ara-system)에 붙었는지 확인하세요';
  END IF;

  SELECT count(*) INTO v_found
    FROM exam.publishers WHERE level = '고등' AND name = ANY (v_publishers);
  IF v_found <> cardinality(v_publishers) THEN
    RAISE EXCEPTION '고등 선택과목 교과서 %개 중 %개만 찾았습니다 — 카테고리 관리의 이름이 바뀌었는지 확인하세요',
      cardinality(v_publishers), v_found;
  END IF;

  -- 1. 학기 값 지키기 — 화면이 고르는 셋만(빈 값 = 학기 구분 없음)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'exam.major_chapters'::regclass AND conname = 'major_chapters_semester_check'
  ) THEN
    ALTER TABLE exam.major_chapters
      ADD CONSTRAINT major_chapters_semester_check CHECK (semester IN ('1학기', '2학기', ''));
    RAISE NOTICE 'major_chapters 학기 CHECK 추가';
  END IF;

  -- 2. 같은 이름 대단원이 이미 '' 로 있으면 UNIQUE(name, publisher_id, grade, semester) 에 걸린다 — 먼저 센다
  SELECT count(*) INTO v_clash
    FROM exam.major_chapters m
    JOIN exam.publishers p ON p.id = m.publisher_id
   WHERE p.level = '고등' AND p.name = ANY (v_publishers) AND m.semester <> ''
     AND EXISTS (
       SELECT 1 FROM exam.major_chapters o
        WHERE o.publisher_id = m.publisher_id AND o.grade = m.grade AND o.name = m.name
          AND o.id <> m.id AND (o.semester = '' OR o.semester <> m.semester)
     );
  IF v_clash > 0 THEN
    RAISE EXCEPTION '학기를 비우면 이름이 겹치는 대단원이 %건 있습니다 — 카테고리 관리에서 먼저 정리하세요', v_clash;
  END IF;

  UPDATE exam.major_chapters m
     SET semester = ''
    FROM exam.publishers p
   WHERE p.id = m.publisher_id AND p.level = '고등' AND p.name = ANY (v_publishers)
     AND m.semester <> '';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'major_chapters 학기 비움: %건', v_n;

  -- 3. 단어 카테고리 — 자연키(idx_categories_natural_key)가 겹치면 멈춘다
  SELECT count(*) INTO v_clash
    FROM exam.categories c
   WHERE c.level = '고등' AND c.publisher = ANY (v_publishers) AND c.semester <> ''
     AND EXISTS (
       SELECT 1 FROM exam.categories o
        WHERE o.id <> c.id AND o.level = c.level
          AND o.year IS NOT DISTINCT FROM c.year AND o.grade IS NOT DISTINCT FROM c.grade
          AND o.publisher IS NOT DISTINCT FROM c.publisher AND o.chapter IS NOT DISTINCT FROM c.chapter
          AND o.sub_chapter IS NOT DISTINCT FROM c.sub_chapter
          AND o.school_name IS NOT DISTINCT FROM c.school_name
          AND (o.semester = '' OR o.semester <> c.semester)
     );
  IF v_clash > 0 THEN
    RAISE EXCEPTION '학기를 비우면 겹치는 단어 카테고리가 %건 있습니다 — 단어를 한쪽으로 옮긴 뒤 다시 돌리세요', v_clash;
  END IF;

  UPDATE exam.categories
     SET semester = ''
   WHERE level = '고등' AND publisher = ANY (v_publishers) AND semester <> '';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'categories 학기 비움: %건', v_n;

  -- 4. 개념지 — 자연키가 없어 겹쳐도 에러가 나지 않는다(같은 폴더에 모일 뿐)
  UPDATE exam.concept_sheets
     SET semester = ''
   WHERE level = '고등' AND publisher = ANY (v_publishers) AND semester <> '';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'concept_sheets 학기 비움: %건', v_n;

  -- 5. 검증 — 고등 교과서별 학기 분포
  FOR r IN
    SELECT p.name, m.grade, CASE WHEN m.semester = '' THEN '(학기 구분 없음)' ELSE m.semester END AS sem,
           count(*) AS n
      FROM exam.major_chapters m JOIN exam.publishers p ON p.id = m.publisher_id
     WHERE p.level = '고등'
     GROUP BY 1, 2, 3 ORDER BY 1, 2, 3
  LOOP
    RAISE NOTICE '  % · % · % : %', r.name, r.grade, r.sem, r.n;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM exam.major_chapters m JOIN exam.publishers p ON p.id = m.publisher_id
     WHERE p.level = '고등' AND p.name = ANY (v_publishers) AND m.semester <> ''
  ) THEN
    RAISE EXCEPTION '검증 실패: 선택과목 대단원에 학기가 남았습니다';
  END IF;
END
$apply$;

COMMIT;
