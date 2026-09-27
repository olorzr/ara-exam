-- =============================================
-- 53. 기출 문제 은행 — 남은 작품명 갈래를 하나로 (대표 표기·동의어·다른 작품·지은이 빈칸)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js /Users/ara/Projects/ara-exam/sql/53_problem_bank_work_title_dedupe.sql
-- =============================================
-- sql/50 이 옛 글자·끝 물음표 갈래를 열쇠로 접고, sql/51 의 exam.work_title_suspects() 가 남은 닮은 쌍
-- 아홉을 찾았다(2026-09-27). 쌍마다 **지문 본문을 열어 보고** 정했다:
--
--   같은 작품 → 동의어                                         대표 표기(사용자 결정)
--     두꺼비 파리를 물고                                        두터비 파리를 물고   (원문 낱말)
--     이별하던 날에 피눈물이 난지 만지 (홍서봉)                 이별하던 날에        (초장 첫 두 음보)
--     춘향전(열녀춘향수절가) · 열녀춘향수절가(완판 84장본)      열녀춘향수절가       (이본은 따로, 「춘향전」 그대로)
--     훈민정음 어제 서문 (행당중 현대어 풀이)                   세종어제훈민정음     (대원국제중에 인쇄된 제목)
--   다른 작품 → work_title_distinct
--     제망매가 ↔ 제망매가(김완진 해독)       해독자는 따로 선다(sql/46·47)
--     배를 매며 ↔ 배를 밀며 (장석남)         한 지문에 두 편이 함께 실려 있다(sql/47)
--     사미인곡 ↔ 속미인곡 (정철)             다른 가사
--     내 마음(강미주, 학생 시) ↔ 내 마음의 풍금(시나리오)
--     머리카락(김민우, 학생 글) ↔ 머리카락의 비밀(무학중, 다른 설명문)
--     훈민정음(광희중 제자 원리 설명글) ↔ 세종어제훈민정음   춘향전 ↔ 열녀춘향수절가(이본은 따로)
--
-- 대표 표기 규칙(사용자 결정 2026-09-27): **원문 낱말 + 현대 글자, 초장 첫 두 음보**. 이개
-- 「방 안에 혓는 촛불」(sql/47)과 같은 방식이다. 그래서 한 갈래뿐인 옛 글자 제목도 현대 글자로 바꾼다 —
-- 열쇠가 같으니 대장 표기만 고치면 지문·문항이 따라온다. 「이화우 흣ᄲᅳ릴 제」의 ᄲ 은 기계로 못 접어
-- 동의어로 건다.
--
-- ⚠️ 끝에 **work_title_suspects() 0건**을 확인한다 — 이것이 앞으로의 불변식이다(적재 스크립트가 지킨다).
-- ⚠️ 멱등하다. 두 번째 실행에서는 고칠 지문이 없다.
-- =============================================

DO $dedupe$
DECLARE
  -- 대표 표기만 현대 글자로 (열쇠가 같다)
  v_display CONSTANT TEXT[] := ARRAY[
    '수양산 바라보며', '춘산에 눈 노긴 바람', '눈 마자 휘어진 대를', '묏버들 갈해 것거',
    '댁들에 동난지이 사오'];
  -- (동의어, 대표)
  v_alias CONSTANT TEXT[][] := ARRAY[
    ['두꺼비 파리를 물고',                  '두터비 파리를 물고'],
    ['이별하던 날에 피눈물이 난지 만지',    '이별하던 날에'],
    ['춘향전(열녀춘향수절가)',              '열녀춘향수절가'],
    ['열녀춘향수절가(완판 84장본)',         '열녀춘향수절가'],
    ['훈민정음 어제 서문',                  '세종어제훈민정음'],
    [E'이화우 흣\u1132\u1173릴 제',         '이화우 흩뿌릴 제']];
  -- (가, 나, 까닭) — 닮았지만 다른 작품
  v_distinct CONSTANT TEXT[][] := ARRAY[
    ['제망매가',  '제망매가(김완진 해독)', '해독자는 따로 선다'],
    ['배를 매며', '배를 밀며',             '장석남의 다른 시 — 2023 성수고 지문에 함께 실렸다'],
    ['사미인곡',  '속미인곡',              '정철의 다른 가사'],
    ['내 마음',   '내 마음의 풍금',        '강미주(학생) 시 ↔ 시나리오'],
    ['머리카락',  '머리카락의 비밀',       '김민우(학생) 글 ↔ 무학중의 다른 설명문'],
    -- 아래 둘은 동의어와 견주면서 드러난다(동의어 「훈민정음 어제 서문」·「춘향전(열녀춘향수절가)」의 앞부분)
    ['훈민정음',  '세종어제훈민정음',      '광희중 「훈민정음」은 제자 원리 설명글 — 서문과 다른 글'],
    ['춘향전',    '열녀춘향수절가',        '이본은 따로 선다(사용자 결정 2026-09-27)']];
  -- (작품, 지은이) — 같은 작품인데 지은이가 비어 있던 지문. 본문을 대조해 같은 글임을 확인했다
  v_author CONSTANT TEXT[][] := ARRAY[
    ['두터비 파리를 물고',               '작자 미상'],
    ['세종어제훈민정음',                 '세종'],
    ['봄나무',                           '이상국'],
    ['돼지고기 두어 근 끊어 왔다는 말',  '안도현'],
    ['거울 뉴런',                        '남종영']];
  v_i     INT;
  v_n     INT;
  v_title TEXT;
  r       RECORD;
BEGIN
  -- 1) 대표 표기를 현대 글자로 — 열쇠가 같은 대장 줄이 이미 있어야 한다(없으면 표기가 틀린 것)
  FOREACH v_title IN ARRAY v_display LOOP
    IF NOT EXISTS (SELECT 1 FROM exam.work_title_canon WHERE key = exam.work_title_key(v_title)) THEN
      RAISE EXCEPTION '「%」 과 열쇠가 같은 대장 줄이 없다 — 표기를 확인할 것', v_title;
    END IF;
    SELECT * INTO r FROM exam.set_canonical_work_title(v_title);
    RAISE NOTICE '대표 표기 「%」: 지문 % 건 · 문항 % 건', v_title, r.passages_fixed, r.problems_fixed;
  END LOOP;

  -- 2) 글자가 다른 같은 작품 → 동의어
  FOR v_i IN 1 .. array_length(v_alias, 1) LOOP
    SELECT * INTO r FROM exam.alias_work_title(v_alias[v_i][1], v_alias[v_i][2]);
    RAISE NOTICE '동의어 「%」 → 「%」: 지문 % 건 · 문항 % 건',
      v_alias[v_i][1], v_alias[v_i][2], r.passages_fixed, r.problems_fixed;
  END LOOP;

  -- 3) 닮았지만 다른 작품
  FOR v_i IN 1 .. array_length(v_distinct, 1) LOOP
    PERFORM exam.mark_work_titles_distinct(v_distinct[v_i][1], v_distinct[v_i][2], v_distinct[v_i][3]);
  END LOOP;

  -- 4) 지은이 빈칸 채우기 — 작품마다 따로 돈다. 한 지문에 대상 작품이 둘 있을 수 있어서
  --    (무학중 2022 중3 에 「돼지고기…」·「봄나무」가 함께 실렸다) UPDATE … FROM 한 번으로는 하나만 걸린다.
  --    구분 표시·차례는 그대로 물려준다. 문항은 제목이 안 바뀌니 건드리지 않는다.
  FOR v_i IN 1 .. array_length(v_author, 1) LOOP
    UPDATE exam.passages p
       SET works = (
         SELECT jsonb_agg(
                  CASE WHEN a.e->>'title' = v_author[v_i][1] AND COALESCE(a.e->>'author', '') = ''
                       THEN jsonb_set(a.e, '{author}', to_jsonb(v_author[v_i][2]))
                       ELSE a.e END
                  ORDER BY a.ord)
           FROM jsonb_array_elements(p.works) WITH ORDINALITY AS a(e, ord))
     WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(p.works) x
                    WHERE x->>'title' = v_author[v_i][1] AND COALESCE(x->>'author', '') = '');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '지은이 「%」 ← %: 지문 % 건', v_author[v_i][1], v_author[v_i][2], v_n;
  END LOOP;

  -- 5) 불변식 — 닮은 쌍이 남으면 이 파일 전체를 되돌린다
  SELECT count(*) INTO v_n FROM exam.work_title_suspects();
  IF v_n > 0 THEN
    FOR r IN SELECT * FROM exam.work_title_suspects() LOOP
      RAISE NOTICE '남은 닮은 쌍: 「%」 ↔ 「%」 (%, %)', r.title_a, r.title_b, r.author, r.reason;
    END LOOP;
    RAISE EXCEPTION '닮은 작품명 쌍이 % 개 남았다', v_n;
  END IF;

  -- 대장 표기에 옛 글자가 남았는지 (남아도 되지만 규칙상 없어야 한다 — 알리기만)
  FOR r IN SELECT title FROM exam.work_title_canon
            WHERE title ~ E'[\u119E\u11A1\u3145\u3163\u1100-\u115F\u1176-\u11FF]' LOOP
    RAISE NOTICE '옛 글자가 남은 대장 표기: %', r.title;
  END LOOP;
END;
$dedupe$;
