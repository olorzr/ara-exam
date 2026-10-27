-- =============================================
-- 81. 2022 개정 중2 1학기 교과서 단원 마스터 교정 — 평가문제집 차례와 대조
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/81_m2s1_unit_master_fixes.sql
-- =============================================
-- 배경: 원장님(2026-10-28) "더 알아보기 단원이 있거나 단원 우리가 잘못한 거 있으면 그것도 좀 수정".
--   중2-1 평가문제집 6종의 차례(출판사 표기)를 카테고리 관리 마스터와 대조해 어긋난 곳만 고친다.
--     · 동아 3. 의도가 담긴 말과 글 — 소단원이 비어 있었다 → (1) 피동 표현과 인용 표현 · (2) 매체 자료 분석하기
--     · 동아 (2) 소설과 서술자 [동백꽃] · 해냄 (1) 화자와 서술자 [아일랜드 베이비] — 제재 꼬리 떼기
--     · 천재(정호웅) (1) 피통 → 피동 · 천재(노미숙) (1) 공감하며 존중하며 → 공감하고 존중하며
--     · 해냄 2-(2) · 천재(정호웅) 2-(2) · 천재(노미숙) 3-(1) '점검, 조정하며' → '점검·조정하며'(책 표기)
--   '더 읽어 보기'(동아 소단원마다 딸린 제재)는 소단원을 만들지 않는다 — 작품 전문·문항의 tags 로 단다
--   (문항 unit_path 는 2단이 상한이고, 가짜 소단원은 문제 은행 교과서 트리까지 어지럽힌다).
--   비상(박영민) '어휘 탐정 활동지' 대단원은 책에 없지만 학원 활동지일 수 있어 **건드리지 않고 알리기만** 한다.
--
-- ⚠️ 이름 바꾸기는 sub_chapters UPDATE 하나로 — sync_sub_chapter_name 트리거가 categories·concept_sheets 를
--    그 교과서·대단원·학년·학기로 좁혀 따라 바꾼다(ara-system mig254). 문항·지문 unit_path·작품 전문 units 는
--    아무도 따라 바꾸지 않는 스냅샷이라 여기서 직접 고친다(적용 날 0건이었다).
--    관리자시스템 curriculum_textbooks.toc 는 야간 동기화가 마스터에서 다시 만든다.
-- ⚠️ 멱등 — 이미 고친 이름은 건너뛴다. 바꿀 이름이 이미 있으면(누가 먼저 만들었으면) 멈춘다(손으로 정할 일).

DO $guard$
BEGIN
  IF to_regclass('exam.sub_chapters') IS NULL OR to_regclass('exam.problems') IS NULL
     OR to_regclass('exam.reference_texts') IS NULL THEN
    RAISE EXCEPTION 'exam 마스터·문제 은행 표가 없습니다 (현재 DB: %).', current_database();
  END IF;
END
$guard$;

DO $fix$
DECLARE
  -- 교과서 · 대단원 · 옛 소단원 · 새 소단원 (모두 중등 · 중2 · 1학기)
  v_renames CONSTANT TEXT[][] := ARRAY[
    ARRAY['동아',         '2. 나와 너의 세상 보기',      '(2) 소설과 서술자 [동백꽃]',          '(2) 소설과 서술자'],
    ARRAY['해냄',         '1. 시선과 공감',              '(1) 화자와 서술자 [아일랜드 베이비]', '(1) 화자와 서술자'],
    ARRAY['천재(정호웅)', '3. 상황에 맞는 표현',         '(1) 피통 표현과 인용 표현',           '(1) 피동 표현과 인용 표현'],
    ARRAY['천재(노미숙)', '2. 소통으로 여는 세상',       '(1) 공감하며 존중하며 대화하기',      '(1) 공감하고 존중하며 대화하기'],
    ARRAY['해냄',         '2. 적절한 표현, 정확한 읽기', '(2) 점검, 조정하며 읽기',             '(2) 점검·조정하며 읽기'],
    ARRAY['천재(정호웅)', '2. 설명과 이해',              '(2) 점검, 조정하며 설명하는 글 쓰기', '(2) 점검·조정하며 설명하는 글 쓰기'],
    ARRAY['천재(노미숙)', '3. 나와 세상의 연결 고리',    '(1) 점검, 조정하며 글 읽기',          '(1) 점검·조정하며 글 읽기']
  ];
  v_pub    TEXT;
  v_major  TEXT;
  v_old    TEXT;
  v_new    TEXT;
  v_mid    UUID;
  v_sid    UUID;
  v_n      INT;
  v_done   INT := 0;
  v_skip   INT := 0;
  v_snap   INT := 0;
  v_ins    INT := 0;
  i        INT;
BEGIN
  SET LOCAL search_path = exam, public;

  -- 1) 동아 3단원 소단원 둘
  SELECT m.id INTO v_mid
    FROM exam.major_chapters m JOIN exam.publishers p ON p.id = m.publisher_id
   WHERE p.name = '동아' AND p.level = '중등' AND m.grade = '중2' AND m.semester = '1학기'
     AND m.name = '3. 의도가 담긴 말과 글';
  IF v_mid IS NULL THEN RAISE EXCEPTION 'sql/81: 동아 중2 1학기 「3. 의도가 담긴 말과 글」 이 없다'; END IF;
  INSERT INTO exam.sub_chapters (name, major_chapter_id)
  VALUES ('(1) 피동 표현과 인용 표현', v_mid), ('(2) 매체 자료 분석하기', v_mid)
  ON CONFLICT (name, major_chapter_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;
  RAISE NOTICE 'sql/81 동아 3단원 소단원 새로 넣음: %건 (이미 있으면 0)', v_ins;

  -- 2) 이름 바꾸기
  FOR i IN 1 .. array_length(v_renames, 1) LOOP
    v_pub := v_renames[i][1]; v_major := v_renames[i][2]; v_old := v_renames[i][3]; v_new := v_renames[i][4];

    SELECT m.id INTO v_mid
      FROM exam.major_chapters m JOIN exam.publishers p ON p.id = m.publisher_id
     WHERE p.name = v_pub AND p.level = '중등' AND m.grade = '중2' AND m.semester = '1학기' AND m.name = v_major;
    IF v_mid IS NULL THEN
      RAISE EXCEPTION 'sql/81: %「%」 대단원이 없다 — 마스터가 바뀌었는지 먼저 볼 것', v_pub, v_major;
    END IF;

    SELECT id INTO v_sid FROM exam.sub_chapters WHERE major_chapter_id = v_mid AND name = v_old;
    IF v_sid IS NULL THEN
      IF EXISTS (SELECT 1 FROM exam.sub_chapters WHERE major_chapter_id = v_mid AND name = v_new) THEN
        v_skip := v_skip + 1;   -- 이미 고쳤다
      ELSE
        RAISE EXCEPTION 'sql/81: %「%」 아래에 「%」 도 「%」 도 없다', v_pub, v_major, v_old, v_new;
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM exam.sub_chapters WHERE major_chapter_id = v_mid AND name = v_new) THEN
        RAISE EXCEPTION 'sql/81: %「%」 아래에 「%」 와 「%」 가 둘 다 있다 — 손으로 합칠 것', v_pub, v_major, v_old, v_new;
      END IF;
      UPDATE exam.sub_chapters SET name = v_new WHERE id = v_sid;   -- 트리거: categories · concept_sheets
      v_done := v_done + 1;
    END IF;

    -- 스냅샷(문항·지문 unit_path, 작품 전문 units) — 그 교과서 출처·단원만
    UPDATE exam.problems p SET unit_path[2] = v_new
      FROM exam.problem_sources s
     WHERE p.source_id = s.id AND s.textbook = v_pub
       AND p.unit_path[1] = v_major AND p.unit_path[2] = v_old;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_snap := v_snap + v_n;
    UPDATE exam.passages g SET unit_path[2] = v_new
      FROM exam.problem_sources s
     WHERE g.source_id = s.id AND s.textbook = v_pub
       AND g.unit_path[1] = v_major AND g.unit_path[2] = v_old;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_snap := v_snap + v_n;
    UPDATE exam.reference_texts r
       SET units = (
         SELECT jsonb_agg(
                  CASE WHEN u ->> 'textbook' = v_pub AND u -> 'unit_path' ->> 0 = v_major
                            AND u -> 'unit_path' ->> 1 = v_old
                       THEN jsonb_set(u, '{unit_path,1}', to_jsonb(v_new)) ELSE u END
                  ORDER BY ord)
           FROM jsonb_array_elements(r.units) WITH ORDINALITY AS e(u, ord))
     WHERE r.units @> jsonb_build_array(jsonb_build_object(
             'textbook', v_pub, 'unit_path', jsonb_build_array(v_major, v_old)));
    GET DIAGNOSTICS v_n = ROW_COUNT; v_snap := v_snap + v_n;
  END LOOP;

  RAISE NOTICE 'sql/81 소단원 이름 바꿈 %건 · 이미 고쳐져 건너뜀 %건 · 스냅샷(문항·지문·작품 전문) %행',
    v_done, v_skip, v_snap;

  -- 3) 남은 옛 이름이 없어야 한다(그 교과서·대단원 안에서)
  FOR i IN 1 .. array_length(v_renames, 1) LOOP
    v_pub := v_renames[i][1]; v_major := v_renames[i][2]; v_old := v_renames[i][3];
    SELECT (SELECT count(*) FROM exam.categories
             WHERE level = '중등' AND publisher = v_pub AND grade = '중2' AND semester = '1학기'
               AND chapter = v_major AND sub_chapter = v_old)
         + (SELECT count(*) FROM exam.concept_sheets
             WHERE level = '중등' AND publisher = v_pub AND grade = '중2' AND semester = '1학기'
               AND unit = v_major AND subunit = v_old)
      INTO v_n;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'sql/81: %「%」 옛 이름이 카테고리·개념지에 %건 남았다 — 트리거를 볼 것', v_pub, v_old, v_n;
    END IF;
  END LOOP;

  -- 4) 알리기만 — 비상(박영민) 어휘 탐정 활동지
  SELECT count(*) INTO v_n
    FROM exam.major_chapters m JOIN exam.publishers p ON p.id = m.publisher_id
   WHERE p.name = '비상(박영민)' AND m.grade = '중2' AND m.semester = '1학기' AND m.name = '어휘 탐정 활동지';
  IF v_n > 0 THEN
    RAISE NOTICE 'sql/81 참고: 비상(박영민) 중2 1학기 「어휘 탐정 활동지」 대단원은 평가문제집 차례에 없다 — 원장님 결정 대기(그대로 둠)';
  END IF;
END
$fix$;
