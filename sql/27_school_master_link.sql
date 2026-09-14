-- 27_school_master_link.sql
-- 외부지문·프린트의 학교를 관리자시스템 마스터(public.schools)와 **같은 id** 로 맞춘다.
--
-- 왜: 프린트 스캔의 학교 선택지가 `exam.schools`(선생님이 카테고리 관리에서 손으로 타이핑한
-- 이름 마스터)에서 나와 두 곳밖에 없었다. 기출 업로드는 이미 sql/18 에서 `public.schools`
-- (중등 15·고등 5)로 옮겨 갔는데 프린트만 남아 있었다.
--
-- 이후 규약: 선택지는 `public.schools` 에서 읽고, `exam.schools` 는 **실제로 프린트가 있는
-- 학교만 담는 거울**이 된다(앱의 `ensureSchoolMirror` 가 저장 직전에 만든다). 마스터 전체를
-- 미리 복사하지 않는 이유는 카테고리 관리의 외부지문 트리가 이 표를 그대로 그리기 때문이다
-- (`aggregate.ts` 의 `fetchAll('schools')`) — 복사하면 프린트가 하나도 없는 학교가 트리를 채운다.
-- id 를 같게 맞추는 덕분에 `school_materials` 의 FK 와 `sync_school_name` 트리거를 그대로 쓴다.
--
-- ⚠️ 이 파일을 **앱 배포보다 먼저** 적용한다. 순서가 뒤집히면 새 앱이 마스터 id 를 옛 행에
--    붙이려다 FK 위반으로 조용히 실패한다(`ensureSchoolMaterial` 이 오류를 삼켜 왔다).
-- ⚠️ 전부를 **DO 블록 하나**에 가뒀다. Supabase SQL Editor 는 문(statement)마다 다른 백엔드로
--    보낼 수 있어 TEMP TABLE·SET search_path 가 다음 문에서 조용히 사라진다(CLAUDE.md 2026-08-30).
--    DO 블록은 단일 문이라 통째로 한 트랜잭션이고, RAISE EXCEPTION 이면 전부 되돌아간다.
-- ⚠️ 이름은 **건드리지 않는다**. 운영 대조 결과 옮길 두 학교의 이름이 마스터와 글자까지 같고
--    `exam.normalize_category_name` 도 그대로 돌려준다 — 그래서 `sync_school_name_trigger` 가
--    발화하지 않고 categories/concept_sheets 의 학교명 스냅샷도 손댈 것이 없다.
-- 다시 돌려도 안전하다: 대상이 0행이 되고 FK 는 떼었다가 같은 모양으로 다시 붙는다.

DO $migrate$
DECLARE
  v_dup       TEXT;
  v_unmatched TEXT;
  v_moved     INTEGER;
  v_orphans   INTEGER;
BEGIN
  ----------------------------------------------------------------
  -- 0. 실행 대상이 맞는지
  ----------------------------------------------------------------
  IF to_regnamespace('exam') IS NULL THEN
    RAISE EXCEPTION 'exam 스키마가 없습니다(현재 DB: %) — 옛 standalone ara-exam 프로젝트에 붙은 것 같습니다.',
      current_database();
  END IF;
  IF to_regclass('exam.print_bundles') IS NULL THEN
    RAISE EXCEPTION 'sql/26(프린트 스캔)을 먼저 적용하세요.';
  END IF;
  IF to_regclass('public.schools') IS NULL OR (SELECT count(*) FROM public.schools) = 0 THEN
    RAISE EXCEPTION 'public.schools 가 없거나 비었습니다(현재 DB: %) — 관리자시스템과 공유하는 프로젝트에서 실행하세요.',
      current_database();
  END IF;

  ----------------------------------------------------------------
  -- 1. 옮길 수 없는 상태면 먼저 멈춘다 (조용한 no-op 금지)
  ----------------------------------------------------------------
  -- public.schools 에는 이름 UNIQUE 가 없다. 동명이 둘이면 어느 id 에 붙일지 정할 수 없다.
  SELECT string_agg(name, ', ' ORDER BY name) INTO v_dup
  FROM (
    SELECT e.name
    FROM exam.schools e
    JOIN public.schools p ON p.name = e.name AND p.level IN ('중등', '고등')
    GROUP BY e.id, e.name
    HAVING count(*) > 1
  ) d;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION '관리자시스템에 같은 이름의 학교가 둘 이상 있습니다(%) — public.schools 를 먼저 정리하세요.', v_dup;
  END IF;

  -- 마스터에 짝이 없는 행은 **그대로 둔다**. 학교가 아닌 옛 임시 행('전체')에도 프린트가 딸려 있고,
  -- 지우면 school_materials 가 CASCADE 로 함께 사라진다. 앱은 이런 행을 '옛 항목' 으로 계속 보여 준다.
  SELECT string_agg(e.name, ', ' ORDER BY e.name) INTO v_unmatched
  FROM exam.schools e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.schools p WHERE p.name = e.name AND p.level IN ('중등', '고등')
  );
  IF v_unmatched IS NOT NULL THEN
    RAISE NOTICE '마스터에 짝이 없어 그대로 둔 학교(기존 자료 보존): %', v_unmatched;
  END IF;

  ----------------------------------------------------------------
  -- 2. FK 를 잠시 떼고 id 를 갈아끼운다
  --    **자식을 먼저** 옮긴다 — exam.schools.id 를 먼저 바꾸면 옛 id 로 자식을 찾을 수 없다.
  --    FK 가 없는 동안 자식이 아직 없는 id 를 가리키지만, 블록이 끝나기 전에 전부 맞춰진다.
  ----------------------------------------------------------------
  ALTER TABLE exam.school_materials DROP CONSTRAINT IF EXISTS school_materials_school_id_fkey;

  UPDATE exam.school_materials m
  SET school_id = p.id
  FROM exam.schools e
  JOIN public.schools p ON p.name = e.name AND p.level IN ('중등', '고등')
  WHERE m.school_id = e.id AND e.id <> p.id;

  -- print_bundles.school_id 는 비-FK 스냅샷이지만 같이 맞춰 준다(도입 시점엔 0행)
  UPDATE exam.print_bundles b
  SET school_id = p.id
  FROM exam.schools e
  JOIN public.schools p ON p.name = e.name AND p.level IN ('중등', '고등')
  WHERE b.school_id = e.id AND e.id <> p.id;

  UPDATE exam.schools e
  SET id = p.id
  FROM public.schools p
  WHERE p.name = e.name AND p.level IN ('중등', '고등') AND e.id <> p.id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE '마스터 id 로 옮긴 학교: %건', v_moved;

  ALTER TABLE exam.school_materials
    ADD CONSTRAINT school_materials_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES exam.schools(id) ON DELETE CASCADE;

  ----------------------------------------------------------------
  -- 3. 학교를 잃은 프린트가 하나라도 있으면 통째로 되돌린다
  ----------------------------------------------------------------
  SELECT count(*) INTO v_orphans
  FROM exam.school_materials m
  WHERE NOT EXISTS (SELECT 1 FROM exam.schools s WHERE s.id = m.school_id);
  IF v_orphans > 0 THEN
    RAISE EXCEPTION '프린트 마스터 %건이 학교를 잃었습니다 — 되돌립니다.', v_orphans;
  END IF;
END
$migrate$;

COMMENT ON TABLE exam.schools IS
  '외부지문·프린트의 학교. 관리자시스템 public.schools 의 **온디맨드 거울**이며 id 가 같다(sql/27). '
  '마스터가 아니다 — 새 학교는 관리자시스템에서만 등록하고, 여기 행은 앱이 프린트를 저장하기 직전에 '
  'ensureSchoolMirror 로 만든다. 마스터 20개를 미리 복사하지 말 것: 카테고리 관리의 외부지문 트리가 '
  '이 표를 그대로 그려서 프린트가 없는 학교로 가득 찬다. 마스터에 짝이 없는 옛 행은 딸린 자료 보존을 '
  '위해 남겨 둔다.';

COMMENT ON COLUMN exam.schools.id IS 'public.schools.id 와 같은 값 (거울 계약, sql/27)';
