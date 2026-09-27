-- =============================================
-- 47. 기출 문제 은행 — 철자가 다른 같은 작품(동의어)을 한 표기로 묶는다 + 찬기파랑가 해독자 교정
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/47_problem_bank_work_title_alias.sql
-- =============================================
-- 배경 (2026-09-27, 제보 "최은숙은 아끼다 똥 될지라도가 맞는 거임 / 찬기파랑가는 김완진인지
--   양주동해독인지 확인해서 넣어줘 / 조세희 난쏘공도 이름 통일해줘 / 장석남도 통일 /
--   이개 같은 경우에도 중세국어랑 표기가 2개로 나뉠땐 어떻게 하는게 좋을까?"):
--   sql/46 의 비교 열쇠는 띄어쓰기·한자 괄호·줄표만 무시한다. 여기 남은 갈래는 **글자 자체가
--   다르다**('아끼다가' ↔ '아끼다', '난쟁이' ↔ '난장이', 현대어 ↔ 옛 표기) — 열쇠로는 못 잡고,
--   한 번 합쳐도 다음 시험지가 또 가른다. 그래서 **동의어 표**를 두고 대장 조회가 먼저 그것을
--   따라가게 한다. 새 갈래가 보이면 이 표에 한 줄 더하고 `apply_work_title_canon()` 이면 끝난다.
--
-- 대표 표기(사용자 결정):
--   · 최은숙 「아끼다 똥 될지라도」 — 교과서 목록(tsv, 비상)은 '아끼다가' 지만 사용자가 이쪽이 맞다고 했다
--   · 조세희 「난장이가 쏘아올린 작은 공」 — 1978 원제 표기(작품명은 고유명사라 맞춤법보다 원제)
--   · 이개 「방 안에 혓는 촛불」 — 원문 첫 구. 현대어로 옮긴 시험지(행당중 '방 안에 켜 있는 촛불')와
--     옛 표기 그대로 실은 시험지(현대고 '방 안에 혓는 촉불')를 한 작품으로 묶는다
--
-- ⚠️ **장석남 「배를 매며」 ↔ 「배를 밀며」 는 합치지 않는다.** 다른 시다 — 2023 성수고 지문
--    (`fb186760…`)에 「배를 매며」, 백석 「백화」, 「배를 밀며」("배를 민다 / 배를 밀어보는 것은…")
--    세 편이 실제로 함께 인쇄돼 있다.
--
-- ⚠️ **찬기파랑가는 동의어로 걸지 않고 지문 하나만 고친다**(§4). 해독 표시 없는 「찬기파랑가」를
--    전부 한 해독자에게 붙이면 거짓이 된다 — 해독자는 지문마다 본문을 보고 정한다.
-- ⚠️ 멱등하다. 두 번째 실행에서는 바꿀 행이 없다.
-- =============================================

-- ---------------------------------------------
-- 1. 동의어 표
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS exam.work_title_alias (
  -- 동의어의 비교 열쇠(exam.work_title_key)
  alias_key  TEXT PRIMARY KEY CHECK (alias_key <> ''),
  -- 그 동의어가 가리키는 대장 줄
  canon_key  TEXT NOT NULL REFERENCES exam.work_title_canon(key) ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_title_alias_not_self CHECK (alias_key <> canon_key)
);

COMMENT ON TABLE exam.work_title_alias IS
  '작품명 동의어 — 글자가 달라도 같은 작품(옛 표기·맞춤법 차이). 대장 조회가 이 표를 먼저 따라간다';

ALTER TABLE exam.work_title_alias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read work_title_alias" ON exam.work_title_alias;
CREATE POLICY "Authenticated users can read work_title_alias" ON exam.work_title_alias
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated' AND exam.is_allowed_domain());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON exam.work_title_alias FROM authenticated, anon;
GRANT SELECT ON exam.work_title_alias TO authenticated;
GRANT ALL ON exam.work_title_alias TO service_role;

-- ---------------------------------------------
-- 2. 대장 조회가 동의어를 먼저 따라간다 (sql/46 판을 다시 정의한다)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION exam.canonical_work_title(p_title TEXT)
RETURNS TEXT
  LANGUAGE sql STABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT c.title
       FROM exam.work_title_alias a
       JOIN exam.work_title_canon c ON c.key = a.canon_key
      WHERE a.alias_key = exam.work_title_key(p_title)),
    (SELECT c.title FROM exam.work_title_canon c WHERE c.key = exam.work_title_key(p_title)),
    p_title);
$$;

/**
 * 처음 보는 열쇠를 대장에 올린다 (sql/46 판 + 동의어 열쇠는 올리지 않는다).
 * 가드 둘(도메인·트리거 안에서만)은 sql/46 과 같다 — 까닭은 그쪽 주석을 볼 것.
 */
CREATE OR REPLACE FUNCTION exam.register_work_titles(p_titles TEXT[])
RETURNS VOID
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = exam, pg_temp
AS $$
DECLARE
  v_role TEXT := auth.role();
BEGIN
  IF v_role = 'authenticated' AND NOT exam.is_allowed_domain() THEN
    RAISE EXCEPTION 'work title registry: domain not allowed' USING ERRCODE = '42501';
  END IF;
  IF pg_trigger_depth() = 0 AND v_role IS NOT NULL AND v_role <> 'service_role' THEN
    RAISE EXCEPTION 'work title registry: only via triggers' USING ERRCODE = '42501';
  END IF;

  INSERT INTO exam.work_title_canon (key, title)
  SELECT DISTINCT ON (k) k, t
    FROM (
      SELECT exam.work_title_key(u.t) AS k, exam.normalize_work_title(u.t) AS t, u.ord
        FROM unnest(COALESCE(p_titles, '{}'::TEXT[])) WITH ORDINALITY AS u(t, ord)
    ) x
   WHERE k <> ''
     -- 동의어 열쇠는 따로 대장 줄을 갖지 않는다 — 가진다면 동의어 표를 지웠을 때 그 표기가 되살아난다
     AND NOT EXISTS (SELECT 1 FROM exam.work_title_alias a WHERE a.alias_key = x.k)
   ORDER BY k, ord
  ON CONFLICT (key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION exam.register_work_titles(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION exam.register_work_titles(TEXT[]) TO authenticated, service_role;

-- ---------------------------------------------
-- 3. 대표 표기와 동의어 등록 → 다시 입히기
-- ---------------------------------------------
DO $alias$
DECLARE
  -- (대표 표기, 동의어) — 대표 표기가 대장에 없거나 다르면 이 값으로 맞춘다
  v_pairs CONSTANT TEXT[][] := ARRAY[
    ['아끼다 똥 될지라도',           '아끼다가 똥 될지라도'],
    ['난장이가 쏘아올린 작은 공',     '난쟁이가 쏘아 올린 작은 공'],
    ['방 안에 혓는 촛불',             '방 안에 켜 있는 촛불'],
    ['방 안에 혓는 촛불',             '방 안에 혓는 촉불']
  ];
  v_i     INT;
  v_canon TEXT;
  v_alias TEXT;
  r       RECORD;
BEGIN
  FOR v_i IN 1 .. array_length(v_pairs, 1) LOOP
    v_canon := exam.normalize_work_title(v_pairs[v_i][1]);
    v_alias := exam.work_title_key(v_pairs[v_i][2]);

    INSERT INTO exam.work_title_canon (key, title)
    VALUES (exam.work_title_key(v_canon), v_canon)
    ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, updated_at = now()
      WHERE exam.work_title_canon.title IS DISTINCT FROM EXCLUDED.title;

    INSERT INTO exam.work_title_alias (alias_key, canon_key)
    VALUES (v_alias, exam.work_title_key(v_canon))
    ON CONFLICT (alias_key) DO UPDATE SET canon_key = EXCLUDED.canon_key;

    -- 동의어 열쇠가 sql/46 에서 제 대장 줄을 얻어 두었으면 걷는다(위 register 주석과 같은 까닭)
    DELETE FROM exam.work_title_canon WHERE key = v_alias;
  END LOOP;

  SELECT * INTO r FROM exam.apply_work_title_canon();
  RAISE NOTICE '동의어 적용: 지문 % 건 · 문항 % 건', r.passages_fixed, r.problems_fixed;
END;
$alias$;

-- ---------------------------------------------
-- 4. 찬기파랑가 해독자 교정 — 2025 성수고 2-1 중간 문학 (마) 한 건
-- ---------------------------------------------
-- 시험지는 `- 충담사, 「찬기파랑가」 -` 만 인쇄하고 해독자를 밝히지 않았다(원본 6쪽 이미지로 확인).
-- 본문의 중세어 해독이 **김완진 해독**이다. 근거:
--   · 가르는 두 구절이 모두 김완진 쪽이다
--       咽嗚爾處米 → 「늣겨곰 ᄇᆞ라매」(흐느끼며 바라보매). 양주동은 「열치매」(열어젖히며)
--       雪是毛冬乃乎尸花判也 → 「누니 모ᄃᆞᆯ 두폴 곳가리여」(눈이 못 덮을 고깔이여). 양주동은 「서리 몯누올 화판이여」
--   · 두 해독의 현대어 풀이를 해독자 이름과 함께 인쇄한 2024 도선고 지문(`8cd19a0c…`)의
--     「(김완진 해독)」과 열 줄이 1:1 로 맞는다(흐느끼며 바라보매 / 이슬 밝힌 달이 / … /
--     눈이라도 덮지 못할 고깔이여). 「(양주동 해독)」과는 첫 줄부터 다르다
--   · 18번 문항이 ⓐ「누니」와 가까운 뜻을 '눈' 시에서 고르게 한다 — 雪 을 '눈' 으로 읽는 해독이다
-- ⚠️ 지금 값이 그대로일 때만 고친다(sql/42 규약) — 그사이 사람이 고쳤으면 건드리지 않는다.
--    구분 표시·지은이는 물려준다. 딸린 문항은 전파 트리거가 따라온다.
DO $chan$
DECLARE
  v_n INT;
BEGIN
  UPDATE exam.passages p
     SET works = (
       SELECT jsonb_agg(
                CASE WHEN e->>'title' = '찬기파랑가'
                     THEN jsonb_set(e, '{title}', to_jsonb('찬기파랑가(김완진 해독)'::TEXT))
                     ELSE e END
                ORDER BY ord)
         FROM jsonb_array_elements(p.works) WITH ORDINALITY AS a(e, ord))
   WHERE p.id = '368cdb0f-cf34-4dc1-a8ef-ae5a9b804fe8'
     AND exam.works_titles(p.works) @> ARRAY['찬기파랑가'];
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '찬기파랑가 해독자 교정: 지문 % 건', v_n;
END;
$chan$;
