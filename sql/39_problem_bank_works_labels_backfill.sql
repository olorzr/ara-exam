-- =============================================
-- 39. 기출 문제 은행 — 복합 지문의 작품을 (가)(나)별로 다시 적는다 (데이터 교정)
-- 실행: node /Users/ara/Projects/Ara-system/scripts/run-sql.js sql/39_problem_bank_works_labels_backfill.sql
-- =============================================
-- 배경 (2026-09-22, 제보 "(가)는 이육사 광야, (나)는 윤동주 서시 … 이런 지문은 각각 문학 정보를
--   적을 수 있게 해 달라. 이전에 그랬던 애들도 전수조사해서 바꿔 달라"):
--   구조는 이미 있다 — `passages.works` 는 sql/33 부터 `[{label,title,author}]` 목록이고
--   검수 화면(PassageWorksEditor)이 줄마다 구분 표시·작품명·지은이를 받는다. 그런데
--   **운영 데이터의 works 원소 224개가 전부 `label=''` 이었다**: 광희중·행당중 출처 83건이
--   모두 sql/33 적용(2026-09-19 22:38) **이전**에 올라가(마지막 업로드 09-19 16:29),
--   옛 `' · '` 이음 문자열을 쪼갠 값이라 구분 표시가 처음부터 없었다. 게다가 옛 프롬프트는
--   작품을 한 편만 적게 해서 (가)(나)(다) 지문의 뒤 작품이 통째로 빠져 있었다.
--   OCR 프롬프트는 이미 label 을 요구하므로(prompt-works.ts) **새 업로드부터는 저절로 채워진다** —
--   앱 코드는 손댈 것이 없고, 이 파일은 **이미 쌓인 지문을 전수조사해 고치는 일회성 교정**이다.
--
-- 대상: 광희중·행당중 지문 중 대영역이 `문학` 인 213건을 **전부 눈으로 읽었다**(상자별 본문·
--   인쇄된 출처 표기). 그중 118건을 고친다. 나머지 95건은 한 작품이 (가)~(바) 전체를 덮는
--   발췌라 지금 값이 이미 맞다(구분 표시를 붙이지 않는 것이 맞다 — 어느 한 상자의 작품이 아니다).
--
-- ⚠️ **사람이 읽고 정한 값이다.** 아래 목록이 유일한 원본이고 재계산할 수 없다. 규칙 셋:
--   ① 인쇄된 출처 표기('- 김소월, 먼 후일')를 가장 먼저 따른다.
--   ② 인쇄돼 있지 않으면 **교과서 수록작으로 분명할 때만** 적는다. 모르면 비워 두고 보고한다
--      (학생 모작 시, 출처 미상 산문 등 7건은 works 를 비운 채 두었다 — 지어내지 않는다).
--   ③ 표기는 **같은 학교에 이미 쌓인 표기**를 그대로 쓴다(작품 트리가 갈라지지 않게).
--      그래서 같은 수필이 광희중은 '아들아'/'우리 동네 예술가들'/'내가 읽은 책과 세상',
--      행당중은 '어머니는 왜 숲속의 이슬을 털었을까'/'길모퉁이에서 만난 사람'/'맛있는 책, 일생의 보약'
--      로 남는다 — 교과서가 학교마다 다르고, 어느 쪽도 틀린 이름이 아니다.
-- ⚠️ **구분 표시는 본문의 구역 표시와 1:1 로 맞췄다.** 광희중·행당중은 `<blockquote data-box="가">`
--    가 주된 표시이고 일부 출처는 본문에 `(가)` 글자로만 있다 — 둘 다 확인했다(적용 전 검사).
--    한 작품이 여러 상자에 걸치면 `'가~라'` 처럼 범위로 적는다(그 작품이 어디부터 어디까지인지가
--    사실이고, `normalizeWorkLabel` 은 넉 자까지 그대로 통과시킨다).
-- ⚠️ **해설·학생 글 상자는 작품 줄을 만들지 않는다**(비문학은 인쇄된 제목이 있을 때만 — OCR 규칙과 같다).
--    예외로 행당중 두 지문의 해설은 '- 정호웅, 「소망과 믿음의 노래」' 가 인쇄돼 있어 작품으로 적었다.
-- ⚠️ **'소나기' 세 표기를 하나로 합친다**: 드라마 대본이 '소나기/황순원 원작'·'소나기/염일호 각본'·
--    '소나기(드라마 대본)/(지은이 없음)' 셋으로 갈려 있어 작품 트리에서 한 작품이 네 갈래로 쌓였다.
--    소설은 `소나기/황순원`, 드라마 대본은 `소나기(드라마 대본)/염일호 각본` 으로 통일한다.
-- ⚠️ **전파 트리거를 끄고 문항을 직접 맞춘다**(`exam.skip_work_sync`). 그 트리거는 "옛 목록이
--    **두 편 이상**일 때만 새 목록을 물려준다" 는 규약이라(sql/33), 0·1편이던 지문에 편을 더하는
--    이번 교정에서는 **물려받던 문항이 따라오지 않는다**. 규칙은 아래 3단계이고 파일 안에 못박았다.
-- ⚠️ **감사 트리거를 백필 동안만 끈다**(sql/33 과 같은 방식). 지문 118건·문항 수백 건의 본문 HTML 이
--    통째로 `audit_log` 에 복사되는 것을 막는다. UPDATE 감사만 끄고 DELETE 감사는 건드리지 않는다.
-- ⚠️ **멱등하다.** 이미 같은 값이면 UPDATE 가 0행이고, 끝의 자가 검증이 실패하면 통째로 되돌아간다.

SET search_path = exam, public;

DO $guard$
BEGIN
  IF to_regclass('exam.passages') IS NULL OR to_regclass('exam.problems') IS NULL THEN
    RAISE EXCEPTION 'sql/17(기출 문제 은행)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  IF to_regproc('exam.normalize_works') IS NULL OR to_regproc('exam.works_titles') IS NULL THEN
    RAISE EXCEPTION 'sql/33(지문 하나에 작품 여러 편)이 아직 적용되지 않았습니다 (현재 DB: %).', current_database();
  END IF;
  RAISE NOTICE '대상 DB=% / 롤=%', current_database(), current_user;
END
$guard$;

-- 사람이 읽고 정한 목록 (지문 id, works). 이 파일이 유일한 원본이다.
CREATE TEMP TABLE _want (passage_id UUID PRIMARY KEY, works JSONB NOT NULL) ON COMMIT DROP;

INSERT INTO _want (passage_id, works) VALUES
    ('f64c57bc-ba6e-5614-836e-d78aa00b11a5'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('42a6155c-eed4-500e-b785-32f0261a6408'::uuid, '[{"label":"가","title":"엄마 걱정","author":"기형도"},{"label":"나","title":"딸기","author":"이재무"}]'::jsonb),
    ('124ba46a-bd7d-5544-bbc9-aa365679c66a'::uuid, '[{"label":"가","title":"나룻배와 행인","author":"한용운"},{"label":"나","title":"진달래꽃","author":"김소월"}]'::jsonb),
    ('0019116f-a045-5a23-9db4-32393fcb7fe1'::uuid, '[{"label":"","title":"내가 읽은 책과 세상","author":"성석제"}]'::jsonb),
    ('326d4d42-e2cc-5645-b12d-1e8dad28bdc7'::uuid, '[{"label":"가","title":"모진 소리","author":"황인숙"},{"label":"나","title":"따뜻한 말","author":"김지호"}]'::jsonb),
    ('578c3608-2275-51de-816b-b14c2ee694d6'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('a9e56d7f-fdea-598f-adc3-72f19024025f'::uuid, '[{"label":"가","title":"청포도","author":"이육사"},{"label":"다","title":"새로운 길","author":"윤동주"},{"label":"라","title":"서시","author":"윤동주"}]'::jsonb),
    ('1a2da9cc-a204-5c33-81f2-5ea96ca11db2'::uuid, '[{"label":"","title":"우리 동네 예술가들","author":"양귀자"}]'::jsonb),
    ('f5f2e8b9-5191-5a30-a559-2097d0e5b280'::uuid, '[{"label":"","title":"아들아","author":"이순원"}]'::jsonb),
    ('0ada689e-c6af-5904-8d6c-964eb85d5be5'::uuid, '[{"label":"가","title":"꽃","author":"김춘수"},{"label":"나","title":"어린 왕자","author":"생텍쥐페리"}]'::jsonb),
    ('eb291552-0389-59ef-a1e5-32ddd60768e0'::uuid, '[{"label":"가","title":"까마귀 눈비 맞아","author":"박팽년"},{"label":"나","title":"들판이 적막하다","author":"정현종"}]'::jsonb),
    ('2173097d-d45d-5cfa-aecd-e3696c4c29c6'::uuid, '[{"label":"","title":"꺼삐딴 리","author":"전광용"}]'::jsonb),
    ('71673ac6-cdbf-57cf-88aa-43f0593933e0'::uuid, '[{"label":"","title":"이옥설","author":"이규보"}]'::jsonb),
    ('0091ed9c-7f9e-540c-8fd8-d32ebf496e16'::uuid, '[{"label":"","title":"엄마 걱정","author":"기형도"}]'::jsonb),
    ('58eb547d-c3af-5eac-b022-ccce0d3d06d1'::uuid, '[{"label":"나","title":"두꺼비 파리를 물고","author":""}]'::jsonb),
    ('7c15cd10-ca98-52bc-a35b-49ef4635639a'::uuid, '[{"label":"","title":"먼 후일","author":"김소월"}]'::jsonb),
    ('ad723c7d-edf9-5fa8-ab90-cdc43ead0f19'::uuid, '[{"label":"","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('dc8718e2-10b1-5fdd-a09c-632a8fe208f5'::uuid, '[{"label":"","title":"동백꽃","author":"김유정"}]'::jsonb),
    ('12a8e210-14d1-55ea-a32e-9e7e1dc685a0'::uuid, '[{"label":"","title":"내가 읽은 책과 세상","author":"성석제"}]'::jsonb),
    ('c399f50e-0716-5400-8046-61f0c197db1f'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('f318b70c-5186-573e-860c-cd92e7298d90'::uuid, '[{"label":"가","title":"모진 소리","author":"황인숙"},{"label":"나","title":"따뜻한 말","author":"김지호"}]'::jsonb),
    ('263d98b2-23c8-5ec3-bc81-622edfcda2e6'::uuid, '[{"label":"가","title":"소나기","author":"황순원"},{"label":"나","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('7d736115-e5fc-57fb-a82b-786b5473ab93'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('001ed21e-78f7-5b95-a0f6-55b8b28cd879'::uuid, '[{"label":"가","title":"청포도","author":"이육사"}]'::jsonb),
    ('87b6bb45-4349-57c2-aa0e-3ea3dc7d65a3'::uuid, '[{"label":"가","title":"새로운 길","author":"윤동주"},{"label":"나","title":"서시","author":"윤동주"},{"label":"다","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('c1cbc8ef-c86a-5206-8428-8d261014b85d'::uuid, '[{"label":"","title":"우리 동네 예술가들","author":"양귀자"}]'::jsonb),
    ('f0594fc9-22e4-50ef-bd32-fcba48f83ca6'::uuid, '[{"label":"","title":"우리 동네 예술가들","author":"양귀자"}]'::jsonb),
    ('f421b2a4-0a9f-59ff-b98b-6cca1d3c5358'::uuid, '[{"label":"가","title":"꽃","author":"김춘수"},{"label":"나","title":"라디오와 같이 사랑을 끄고 켤 수 있다면","author":"장정일"},{"label":"다","title":"어린 왕자","author":"생텍쥐페리"}]'::jsonb),
    ('c8902369-bc41-56b7-a622-fe0c22ced311'::uuid, '[{"label":"","title":"아들아","author":"이순원"}]'::jsonb),
    ('983a34d7-c413-5f9c-93de-007573d909f9'::uuid, '[{"label":"가","title":"까마귀 눈비 맞아","author":"박팽년"},{"label":"나","title":"까마귀 싸우는 골에","author":""},{"label":"다","title":"천만 리 머나먼 길에","author":"왕방연"},{"label":"라","title":"들판이 적막하다","author":"정현종"}]'::jsonb),
    ('0b7be547-be1c-5526-93ae-c6714a5bf841'::uuid, '[{"label":"","title":"이옥설","author":"이규보"}]'::jsonb),
    ('1406e2b8-98e7-5eed-8f7d-db10107891d3'::uuid, '[{"label":"","title":"꺼삐딴 리","author":"전광용"}]'::jsonb),
    ('8bb69783-e05a-50f0-bc2f-4b78b3736fc9'::uuid, '[{"label":"","title":"홍길동전","author":"허균"}]'::jsonb),
    ('9b7b5b88-749a-5467-87a3-676c8e0612b2'::uuid, '[{"label":"","title":"소녀, 두드리다","author":""}]'::jsonb),
    ('1634e94e-152e-569c-963b-bbee62a62699'::uuid, '[{"label":"","title":"책상은 책상이다","author":"페터 빅셀"}]'::jsonb),
    ('ef409735-a601-559c-abfa-1fdeca154c2a'::uuid, '[{"label":"","title":"하늘은 맑건만","author":"현덕"}]'::jsonb),
    ('5433c77a-da9a-55fb-91d0-575e9786cb62'::uuid, '[{"label":"","title":"내가 읽은 책과 세상","author":"성석제"}]'::jsonb),
    ('cfa4d849-446f-592c-b947-d9d65fc30842'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('4ba5b27d-0861-5c48-8ebc-3d17e7904c1c'::uuid, '[{"label":"가","title":"엄마 걱정","author":"기형도"},{"label":"나","title":"딸기","author":"이재무"}]'::jsonb),
    ('752aa291-4ae2-5602-92ca-cc410986332c'::uuid, '[{"label":"","title":"동백꽃","author":"김유정"}]'::jsonb),
    ('30306f01-826a-59a3-9bc0-fdf90175e93d'::uuid, '[{"label":"가","title":"나룻배와 행인","author":"한용운"}]'::jsonb),
    ('edff7b10-589e-5f9b-8f73-93b25a094a6c'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('e857927c-ddf2-5e03-be83-e329ef1ae7e9'::uuid, '[{"label":"가","title":"모진 소리","author":"황인숙"},{"label":"나","title":"따뜻한 말","author":"김지호"}]'::jsonb),
    ('fe81ac2e-5af9-5ca5-9661-11014b600e8b'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('932b7db4-10e0-58ad-8bcc-2eb8b6828010'::uuid, '[{"label":"가","title":"청포도","author":"이육사"},{"label":"나","title":"새로운 길","author":"윤동주"}]'::jsonb),
    ('113e636e-26aa-5f0e-9682-638f2fd4e262'::uuid, '[{"label":"가","title":"꽃","author":"김춘수"},{"label":"나","title":"어린 왕자","author":"생텍쥐페리"}]'::jsonb),
    ('01317d74-d0d8-5032-b3be-34d28f43e8e4'::uuid, '[{"label":"","title":"아들아","author":"이순원"}]'::jsonb),
    ('b7fe239a-1d66-5734-b34e-0e05014b3697'::uuid, '[{"label":"","title":"우리 동네 예술가들","author":"양귀자"}]'::jsonb),
    ('c47fc2be-820f-517c-94ae-109ff123e393'::uuid, '[{"label":"","title":"우리 동네 예술가들","author":"양귀자"}]'::jsonb),
    ('f714d5fd-d03d-517d-9f45-1a11b867874d'::uuid, '[{"label":"가","title":"까마귀 눈비 맞아","author":"박팽년"},{"label":"나","title":"까마귀 싸우는 골에","author":""},{"label":"다","title":"들판이 적막하다","author":"정현종"}]'::jsonb),
    ('2fa318c8-fa9d-5365-9314-909c0fd6ba30'::uuid, '[{"label":"","title":"꺼삐딴 리","author":"전광용"}]'::jsonb),
    ('82406654-33cf-59b8-9e58-cdd74ed4c7b3'::uuid, '[{"label":"","title":"이옥설","author":"이규보"}]'::jsonb),
    ('ff4776f2-aa0a-5c6b-be32-f2afa6aaccf0'::uuid, '[{"label":"","title":"꺼삐딴 리","author":"전광용"}]'::jsonb),
    ('6522633f-914a-5711-90ef-5c34bf4f0d26'::uuid, '[{"label":"","title":"소녀, 두드리다","author":""}]'::jsonb),
    ('d36c9b28-68c7-538c-8a35-2726f5b50b3f'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('79e4b7a5-d2e2-5789-ae22-45a47c573328'::uuid, '[{"label":"가","title":"엄마 걱정","author":"기형도"},{"label":"나","title":"나룻배와 행인","author":"한용운"}]'::jsonb),
    ('3c762c2f-5734-567b-a2c0-4e961a85098d'::uuid, '[{"label":"가","title":"딸기","author":"이재무"}]'::jsonb),
    ('8edcfb3f-5e01-5142-93d6-96b32980fe75'::uuid, '[{"label":"","title":"동백꽃","author":"김유정"}]'::jsonb),
    ('cf29b711-5eae-5b08-9e77-de85dfbc4f7f'::uuid, '[{"label":"가~라","title":"소나기","author":"황순원"},{"label":"마","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('e5fbaf74-b687-5d8c-9577-b10e740f9910'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('8c733d7d-012b-54e5-9f9e-167068e49af6'::uuid, '[{"label":"가","title":"모진 소리","author":"황인숙"},{"label":"나","title":"따뜻한 말","author":"김지호"}]'::jsonb),
    ('b7b1a652-0850-506c-8313-9bc8dd380218'::uuid, '[{"label":"가","title":"청포도","author":"이육사"},{"label":"라","title":"새로운 길","author":"윤동주"}]'::jsonb),
    ('f7b8a18d-aaf3-5269-a2d0-400cebda8236'::uuid, '[{"label":"가","title":"꽃","author":"김춘수"},{"label":"나","title":"어린 왕자","author":"생텍쥐페리"}]'::jsonb),
    ('b4419c6b-8728-52cf-af6b-50d134933625'::uuid, '[{"label":"","title":"우리 동네 예술가들","author":"양귀자"}]'::jsonb),
    ('71dedf28-3691-59b5-afae-822a994a6108'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('4d86aa74-671b-546c-b67a-6c1b5db3c9d5'::uuid, '[{"label":"가","title":"엄마 걱정","author":"기형도"},{"label":"나","title":"딸기","author":"이재무"},{"label":"다","title":"나룻배와 행인","author":"한용운"}]'::jsonb),
    ('25387b93-37ac-594d-a896-5854aa8f3d4d'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('5d6b135c-462d-597b-9caf-e1ff22d60c71'::uuid, '[{"label":"가","title":"내 마음","author":"강미주"},{"label":"나","title":"모진 소리","author":"황인숙"},{"label":"다","title":"따뜻한 말","author":"김지호"}]'::jsonb),
    ('209ee5ed-6a1a-51d8-9f3b-10943dce9d3d'::uuid, '[{"label":"가","title":"청포도","author":"이육사"}]'::jsonb),
    ('13f930bf-edff-5fbe-b467-5d0c2349bf8d'::uuid, '[{"label":"가","title":"꽃","author":"김춘수"},{"label":"나","title":"어린 왕자","author":"생텍쥐페리"}]'::jsonb),
    ('214bb1af-aa32-5de2-8409-005e4a99744b'::uuid, '[{"label":"","title":"우리 동네 예술가들","author":"양귀자"}]'::jsonb),
    ('ec741ea4-0b75-5ee1-ba94-8ad2a4b5ad60'::uuid, '[{"label":"가","title":"까마귀 눈비 맞아","author":"박팽년"},{"label":"나","title":"들판이 적막하다","author":"정현종"}]'::jsonb),
    ('16a0f272-0363-533e-a2f2-74c9fb01c4ee'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('4b31d731-1819-55cb-8e0f-1317fb4fcd9a'::uuid, '[{"label":"나","title":"엄마 걱정","author":"기형도"},{"label":"다","title":"딸기","author":"이재무"}]'::jsonb),
    ('99d8ffab-188e-5139-a064-995a8837d895'::uuid, '[{"label":"가","title":"산 너머 남촌에는","author":"김동환"},{"label":"다","title":"나룻배와 행인","author":"한용운"}]'::jsonb),
    ('673b4782-4466-5570-9b77-ebff29ecb60b'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('89932f9c-06b7-53e8-85b6-740f9da9630b'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('de196cc9-7b2f-5114-90bc-5f1a1ba04ff3'::uuid, '[{"label":"나","title":"내 마음","author":"강미주"}]'::jsonb),
    ('99c43bf4-9454-5a03-86a4-5ea11b836dc6'::uuid, '[{"label":"","title":"모진 소리","author":"황인숙"}]'::jsonb),
    ('ae3650e5-5d46-51aa-8128-567fce87253d'::uuid, '[{"label":"","title":"새싹 하나가 나기까지는","author":"경종호"}]'::jsonb),
    ('8cc0807e-1c15-57fa-afda-6caa0f7e9268'::uuid, '[{"label":"가","title":"청포도","author":"이육사"},{"label":"나","title":"소망과 믿음의 노래","author":"정호웅"},{"label":"다","title":"새로운 길","author":"윤동주"}]'::jsonb),
    ('55b0ffd4-776b-5722-bdc9-be3fd699f53f'::uuid, '[{"label":"가","title":"까마귀 눈비 맞아","author":"박팽년"},{"label":"나","title":"들판이 적막하다","author":"정현종"}]'::jsonb),
    ('2751ec14-181e-5ad3-a7ea-69ee705af1a3'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('28fb9bdd-2d86-52fa-8d87-4fe99683c196'::uuid, '[{"label":"가","title":"엄마 걱정","author":"기형도"},{"label":"나","title":"딸기","author":"이재무"}]'::jsonb),
    ('be8929e6-0266-5e19-8aa8-81002964230a'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('37405f75-50e2-5cf5-9be6-874f49a70609'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('2519dc00-3285-59cb-a2c2-ba07d6919801'::uuid, '[{"label":"가","title":"모진 소리","author":"황인숙"},{"label":"나","title":"따뜻한 말","author":"김지호"}]'::jsonb),
    ('65a755bd-bab2-58b1-99c4-43a9452f809d'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('b7527e91-2d33-53ce-97a6-e07ee0864e7f'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('fbaada29-f80e-5643-a0f8-5c29035236de'::uuid, '[{"label":"","title":"소망과 믿음의 노래","author":"정호웅"},{"label":"","title":"청포도","author":"이육사"}]'::jsonb),
    ('1bf08959-73ae-510b-bc49-3b0fbfb869e8'::uuid, '[{"label":"가","title":"까마귀 눈비 맞아","author":"박팽년"},{"label":"나","title":"이 몸이 죽어 가서","author":"성삼문"},{"label":"다","title":"방 안에 켜 있는 촛불","author":"이개"},{"label":"라","title":"천만 리 머나먼 길에","author":"왕방연"},{"label":"마","title":"들판이 적막하다","author":"정현종"}]'::jsonb),
    ('1957ca4e-5c8d-5cbc-b54a-47f81b28f11d'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('29c64cb9-bd2d-54d6-9102-e1e3589d30b5'::uuid, '[{"label":"가","title":"엄마 걱정","author":"기형도"}]'::jsonb),
    ('6f5f43a3-eb28-5a86-a21c-db3baa88aa6c'::uuid, '[{"label":"가","title":"딸기","author":"이재무"},{"label":"나","title":"나룻배와 행인","author":"한용운"}]'::jsonb),
    ('9da70e54-ad6f-5225-b545-d593b46f66a6'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('525c2993-fe89-5232-b57f-c19376f35fba'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('cc150c1d-1ad0-54be-9118-945a4d0c1932'::uuid, '[{"label":"가","title":"모진 소리","author":"황인숙"},{"label":"나","title":"따뜻한 말","author":"김지호"}]'::jsonb),
    ('7034a232-bfad-508e-9d3f-61cc72da9dff'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('7da8a6df-c1d7-525a-858a-8fc34cb27dc6'::uuid, '[{"label":"가~나","title":"소나기","author":"황순원"},{"label":"다","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('2fe750fa-919b-596b-9448-49b000234064'::uuid, '[{"label":"가","title":"청포도","author":"이육사"}]'::jsonb),
    ('8ac815af-c008-5eff-a0e6-919f24b20855'::uuid, '[{"label":"가","title":"새로운 길","author":"윤동주"},{"label":"나","title":"까마귀 눈비 맞아","author":"박팽년"},{"label":"다","title":"들판이 적막하다","author":"정현종"}]'::jsonb),
    ('208c05e7-5fa0-5cca-87a8-09d38a978ac5'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('104681f6-fe41-565b-8da5-6976ba5e2ecc'::uuid, '[{"label":"나","title":"엄마 걱정","author":"기형도"},{"label":"다","title":"딸기","author":"이재무"},{"label":"라","title":"나룻배와 행인","author":"한용운"}]'::jsonb),
    ('20ab5e6a-5596-54f9-8d82-eeb4728a80d9'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('96320312-b7db-5330-ba4b-32c6da99f620'::uuid, '[{"label":"","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('ce10763b-3632-54b8-9505-21a8d6606355'::uuid, '[{"label":"가","title":"모진 소리","author":"황인숙"},{"label":"나","title":"따뜻한 말","author":"김지호"}]'::jsonb),
    ('f5daa54d-a12c-586b-9ce4-d228d10d73e3'::uuid, '[{"label":"","title":"소나기","author":"황순원"}]'::jsonb),
    ('44d92b16-55f1-5d12-89ff-a218a21e285f'::uuid, '[{"label":"가","title":"소나기","author":"황순원"},{"label":"나","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('c06817d1-0b79-5b85-881d-8aaaa9383786'::uuid, '[{"label":"가","title":"소나기","author":"황순원"},{"label":"나","title":"소나기(드라마 대본)","author":"염일호 각본"}]'::jsonb),
    ('5567ee3f-e5d4-539c-b3c9-e1aa105ddccb'::uuid, '[{"label":"가","title":"청포도","author":"이육사"},{"label":"다","title":"새로운 길","author":"윤동주"}]'::jsonb),
    ('d2fc47f8-5228-52b4-bc30-384020fe0739'::uuid, '[{"label":"가","title":"꽃","author":"김춘수"},{"label":"나","title":"라디오와 같이 사랑을 끄고 켤 수 있다면","author":"장정일"}]'::jsonb),
    ('6786f812-0589-5ecc-928e-63ab48311e85'::uuid, '[{"label":"가","title":"까마귀 눈비 맞아","author":"박팽년"},{"label":"나","title":"들판이 적막하다","author":"정현종"}]'::jsonb),
    ('dec6b687-7dc9-5439-90dc-1e62a8d270f4'::uuid, '[{"label":"가","title":"먼 후일","author":"김소월"},{"label":"나","title":"독은 아름답다","author":"함민복"}]'::jsonb),
    ('6902fe77-ad9e-5630-a578-1a4e3e73a6fe'::uuid, '[{"label":"가","title":"진달래꽃","author":"김소월"},{"label":"나","title":"엄마야 누나야","author":"김소월"},{"label":"다","title":"나룻배와 행인","author":"한용운"},{"label":"라","title":"청노루","author":"박목월"}]'::jsonb),
    ('e86e1cb8-d7c8-5580-bc7b-019ef0c86ed4'::uuid, '[{"label":"가","title":"사랑방 손님과 어머니","author":"주요섭"},{"label":"나","title":"내가 그린 히말라야시다 그림","author":"성석제"},{"label":"다","title":"돌다리","author":"이태준"},{"label":"라","title":"동행","author":"전상국"}]'::jsonb),
    ('9c40e382-9e93-5566-99b2-b19c9a31b57e'::uuid, '[{"label":"가","title":"청포도","author":"이육사"},{"label":"다","title":"새로운 길","author":"윤동주"}]'::jsonb),
    ('e384401e-c920-5444-9596-5df5936e7b88'::uuid, '[{"label":"가","title":"꽃","author":"김춘수"},{"label":"나","title":"풀꽃","author":"나태주"}]'::jsonb),
    ('fc2acd93-6e6d-5c93-9f69-f81d60adc9da'::uuid, '[{"label":"가","title":"꽃","author":"김춘수"},{"label":"나","title":"어린 왕자","author":"생텍쥐페리"}]'::jsonb);

DO $backfill$
DECLARE
  v_targets   INT;
  v_passages  INT;
  v_problems  INT;
  v_bad       INT;
  v_bad_txt   TEXT;
BEGIN
  SELECT count(*) INTO v_targets FROM _want;
  IF v_targets <> 118 THEN
    RAISE EXCEPTION '대상 목록이 118건이 아닙니다 (%건) — 파일이 잘린 것 같습니다.', v_targets;
  END IF;

  -- -------------------------------------------
  -- 0. 적용 전 확인 — 대상 지문이 전부 있고, 전부 광희중·행당중 문학 지문인가
  -- -------------------------------------------
  SELECT count(*) INTO v_bad
    FROM _want w LEFT JOIN exam.passages q ON q.id = w.passage_id
   WHERE q.id IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '대상 지문 %건을 찾지 못했습니다 — 다른 DB 이거나 지문이 지워졌습니다.', v_bad;
  END IF;

  SELECT count(*), string_agg(DISTINCT coalesce(s.school_name, '(없음)'), ', ')
    INTO v_bad, v_bad_txt
    FROM _want w
    JOIN exam.passages q ON q.id = w.passage_id
    JOIN exam.problem_sources s ON s.id = q.source_id
   WHERE s.school_name NOT IN ('광희중학교', '행당중학교') OR q.area_path[1] <> '문학';
  IF v_bad > 0 THEN
    RAISE EXCEPTION '대상에 광희중·행당중 문학 지문이 아닌 것이 %건 섞였습니다 (%).', v_bad, v_bad_txt;
  END IF;

  -- ⚠️ 구분 표시는 본문에 실제로 있는 구역만 가리켜야 한다. `data-box="가"` 든 본문의 `(가)` 든
  --    하나는 있어야 하고, 없으면 엉뚱한 자리를 가리키는 값이므로 멈춘다.
  SELECT count(*), string_agg(DISTINCT left(w.passage_id::text, 8) || ':' || c.lbl, ', ')
    INTO v_bad, v_bad_txt
    FROM _want w
    JOIN exam.passages q ON q.id = w.passage_id
    CROSS JOIN LATERAL jsonb_array_elements(w.works) e
    CROSS JOIN LATERAL regexp_split_to_table(replace(e->>'label', '~', ''), '') c(lbl)
   WHERE c.lbl <> ''
     AND q.html !~ ('data-box="' || c.lbl || '"')
     AND q.html !~ ('\(' || c.lbl || '\)');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '본문에 없는 구분 표시가 %건 있습니다 (%).', v_bad, v_bad_txt;
  END IF;

  RAISE NOTICE '0. 적용 전 확인 통과 — 대상 지문 %건', v_targets;

  -- -------------------------------------------
  -- 1. 옛 작품 목록을 먼저 닫아 둔다 (문항 규칙이 '바뀌기 전 값' 을 봐야 한다)
  -- -------------------------------------------
  CREATE TEMP TABLE _plan ON COMMIT DROP AS
  SELECT w.passage_id,
         exam.works_titles(q.works)                    AS old_titles,
         exam.works_titles(exam.normalize_works(w.works)) AS new_titles,
         exam.normalize_works(w.works)                 AS new_works
    FROM _want w
    JOIN exam.passages q ON q.id = w.passage_id;

  -- ⚠️ 정규화가 작품을 통째로 버렸으면(제목이 비었거나 상한 초과) 여기서 멈춘다.
  SELECT count(*) INTO v_bad
    FROM _plan p JOIN _want w ON w.passage_id = p.passage_id
   WHERE jsonb_array_length(p.new_works) <> jsonb_array_length(w.works);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '정규화가 작품을 버린 지문이 %건 있습니다 (제목 중복·상한 초과).', v_bad;
  END IF;

  -- -------------------------------------------
  -- 2. 지문 작품 목록 — 전파 트리거를 끄고 넣는다
  -- -------------------------------------------
  -- ⚠️ 전파 트리거(`passages_sync_work_titles`)를 켠 채로 넣으면 안 된다: 그 규약은 "옛 목록이
  --    두 편 이상일 때만 새 목록을 물려준다" 라, 0·1편이던 지문에 (나)(다)를 더하는 이번 교정에서는
  --    **물려받던 문항이 그 자리에 멈춘다**. 아래 3에서 우리가 직접 맞춘다.
  PERFORM set_config('exam.skip_work_sync', 'on', true);

  ALTER TABLE exam.passages DISABLE TRIGGER audit_passages_update;
  ALTER TABLE exam.problems DISABLE TRIGGER audit_problems_update;

  UPDATE exam.passages q
     SET works = p.new_works
    FROM _plan p
   WHERE q.id = p.passage_id
     AND q.works IS DISTINCT FROM p.new_works;
  GET DIAGNOSTICS v_passages = ROW_COUNT;
  RAISE NOTICE '2. 지문 %건 갱신 (재실행이면 0)', v_passages;

  -- -------------------------------------------
  -- 3. 딸린 문항이 묻는 작품 — 세 갈래로 가른다
  -- -------------------------------------------
  --   ① 옛 목록과 집합이 같으면(빈 목록 포함) '지문 전체를 묻는다' 는 뜻이므로 새 목록 전부로.
  --   ② 그게 아니고 새 목록 안에 전부 들어 있으면 **사람이 좁혀 적은 값**이라 그대로 둔다
  --      (지문은 비어 있는데 문항만 '엄마 걱정' 을 들고 있던 117건이 여기 해당한다 — 그 문항은
  --       진짜로 한 편만 묻는다).
  --   ③ 새 목록에 없는 이름이 섞였으면 버리고 새 목록 전부로(parse.ts 의 "지문에 없는 이름은
  --      버린다" 와 같은 규칙 — 남겨 두면 트리에 가짜 작품이 잎으로 남는다).
  WITH fix AS (
    SELECT pr.id,
           CASE
             WHEN pr.work_titles <@ p.old_titles AND pr.work_titles @> p.old_titles THEN p.new_titles
             WHEN cardinality(pr.work_titles) > 0 AND pr.work_titles <@ p.new_titles THEN pr.work_titles
             ELSE p.new_titles
           END AS titles
      FROM exam.problems pr
      JOIN _plan p ON p.passage_id = pr.passage_id
  )
  UPDATE exam.problems pr
     SET work_titles = fix.titles
    FROM fix
   WHERE pr.id = fix.id
     AND pr.work_titles IS DISTINCT FROM fix.titles;
  GET DIAGNOSTICS v_problems = ROW_COUNT;
  RAISE NOTICE '3. 문항 %건 갱신 (재실행이면 0)', v_problems;

  ALTER TABLE exam.passages ENABLE TRIGGER audit_passages_update;
  ALTER TABLE exam.problems ENABLE TRIGGER audit_problems_update;

  -- -------------------------------------------
  -- 4. 자가 검증 — 하나라도 어긋나면 통째로 되돌린다
  -- -------------------------------------------
  SELECT count(*) INTO v_bad
    FROM _plan p JOIN exam.passages q ON q.id = p.passage_id
   WHERE q.works IS DISTINCT FROM p.new_works;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 목록대로 저장되지 않은 지문 %건.', v_bad;
  END IF;

  -- 파생 문자열이 트리거가 만든 값과 같은가(`' · '` 이음)
  SELECT count(*) INTO v_bad
    FROM _plan p JOIN exam.passages q ON q.id = p.passage_id
   WHERE q.title IS DISTINCT FROM array_to_string(exam.works_titles(q.works), ' · ')
      OR q.author IS DISTINCT FROM exam.works_authors(q.works);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 파생 문자열이 목록과 어긋난 지문 %건.', v_bad;
  END IF;

  -- 딸린 문항이 지문에 없는 작품을 묻고 있지 않은가
  SELECT count(*), string_agg(DISTINCT left(pr.id::text, 8), ', ')
    INTO v_bad, v_bad_txt
    FROM exam.problems pr JOIN _plan p ON p.passage_id = pr.passage_id
   WHERE NOT (pr.work_titles <@ p.new_titles);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 지문에 없는 작품을 묻는 문항 %건 (%).', v_bad, v_bad_txt;
  END IF;

  -- 문항의 작품 목록이 비어 있지 않은가(빈 값은 '지문 전체' 라 위 ①에서 채워졌어야 한다)
  SELECT count(*) INTO v_bad
    FROM exam.problems pr JOIN _plan p ON p.passage_id = pr.passage_id
   WHERE cardinality(pr.work_titles) = 0 AND cardinality(p.new_titles) > 0;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 작품을 물려받지 못한 문항 %건.', v_bad;
  END IF;

  -- 구분 표시가 '가'~'차'(와 범위 물결)로만 이뤄졌는가
  SELECT count(*) INTO v_bad
    FROM _plan p
    CROSS JOIN LATERAL jsonb_array_elements(p.new_works) e
   WHERE (e->>'label') <> '' AND (e->>'label') !~ '^[가-차](~[가-차])?$';
  IF v_bad > 0 THEN
    RAISE EXCEPTION '검증 실패: 구분 표시 모양이 어긋난 작품 %건.', v_bad;
  END IF;

  RAISE NOTICE '4. 자가 검증 통과 — 지문 %건 / 문항 %건 고침', v_passages, v_problems;
END
$backfill$;
