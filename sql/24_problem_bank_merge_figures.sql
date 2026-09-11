-- ============================================================
-- 24. 지문 합치기가 그림을 잃지 않게 (sql/22 보정)
-- ============================================================
-- sql/22 의 `exam.merge_passages` 는 본문만 이어 붙이고 **그림을 옮기지 않았다.**
-- 뒤 지문에 그림이 있으면 합친 뒤 그 그림이 통째로 사라지거나(경로를 안 옮겼으니)
-- 자리표시자 번호가 겹쳐 **앞 지문의 그림이 엉뚱한 자리에 그려졌다**
-- (본문의 `<figure data-figure="n">` 은 `figure_paths` 의 1-based 순번과 짝이다).
--
-- sql/23 이 `passages.figure_paths` 를 만들므로 **그 뒤에** 적용해야 한다.
-- 코덱스 리뷰에서 잡힌 결함이다.

CREATE OR REPLACE FUNCTION exam.merge_passages(
  p_target UUID,
  p_source UUID
) RETURNS TIMESTAMPTZ
  LANGUAGE plpgsql
  SET search_path = exam, pg_temp
AS $$
DECLARE
  v_target exam.passages%ROWTYPE;
  v_source exam.passages%ROWTYPE;
  v_offset INT;
  v_room   INT;
  v_html   TEXT;
  v_updated TIMESTAMPTZ;
  -- 한 항목에 달 수 있는 그림 수. 앱의 MAX_FIGURES(figure-placeholders.ts)와 같아야 한다
  c_max_figures CONSTANT INT := 9;
BEGIN
  IF p_target = p_source THEN
    RAISE EXCEPTION '같은 지문끼리는 합칠 수 없습니다' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ⚠️ 두 행을 **잠그고** 읽는다. 안 그러면 다른 탭이 그 사이 본문을 고쳐도
  --    여기서 읽어 둔 옛 본문으로 덮어써 그 수정이 조용히 사라진다
  SELECT * INTO v_target FROM exam.passages WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '앞 지문을 찾지 못했습니다 (id: %)', p_target USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_source FROM exam.passages WHERE id = p_source FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '뒤 지문을 찾지 못했습니다 (id: %)', p_source USING ERRCODE = 'no_data_found';
  END IF;

  IF v_target.source_id <> v_source.source_id THEN
    RAISE EXCEPTION '다른 출처의 지문끼리는 합칠 수 없습니다' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 뒤 지문의 그림은 앞 지문 것 **뒤로** 밀린다. 상한을 넘는 것은 붙이지 않는다
  v_offset := cardinality(v_target.figure_paths);
  v_room   := GREATEST(c_max_figures - v_offset, 0);

  -- 뒤 지문 본문의 자리표시자 번호를 그만큼 민다. 밀지 않으면 뒤 지문의 '1번' 이
  -- 앞 지문의 1번 그림을 가리킨다. 자리가 없어 못 붙인 그림의 표시는 지운다.
  -- 큰 번호부터 바꿔야 1→2, 2→3 이 연쇄로 겹치지 않는다
  v_html := COALESCE(v_source.html, '');
  IF v_offset > 0 THEN
    FOR i IN REVERSE c_max_figures..1 LOOP
      IF i <= cardinality(v_source.figure_paths) AND i <= v_room THEN
        v_html := replace(
          v_html,
          '<figure data-figure="' || i || '"></figure>',
          '<figure data-figure="' || (i + v_offset) || '"></figure>'
        );
      ELSE
        v_html := replace(v_html, '<figure data-figure="' || i || '"></figure>', '');
      END IF;
    END LOOP;
  END IF;

  UPDATE exam.passages SET
    -- 본문은 **뒤에 붙인다**. 순서를 바꾸면 글이 거꾸로 읽힌다
    html = CASE
      WHEN v_html = '' THEN v_target.html
      WHEN COALESCE(v_target.html, '') = '' THEN v_html
      ELSE v_target.html || E'\n' || v_html
    END,
    -- 그림 경로도 같은 순서로 이어 붙인다 — 본문 자리표시자와 순번으로 짝을 이룬다
    figure_paths = v_target.figure_paths || v_source.figure_paths[1:v_room],
    -- 빈 칸만 채운다 — 앞 지문에 이미 있는 값은 건드리지 않는다(앱의 병합 규칙과 같다).
    -- 뒤 조각에서만 작품명·지은이를 알아본 경우가 흔하다(앞 쪽에는 머리글이 없다)
    title      = CASE WHEN COALESCE(v_target.title, '')  = '' THEN v_source.title  ELSE v_target.title  END,
    author     = CASE WHEN COALESCE(v_target.author, '') = '' THEN v_source.author ELSE v_target.author END,
    label      = CASE WHEN COALESCE(v_target.label, '')  = '' THEN v_source.label  ELSE v_target.label  END,
    area_path  = CASE WHEN cardinality(v_target.area_path) = 0 THEN v_source.area_path ELSE v_target.area_path END,
    unit_path  = CASE WHEN cardinality(v_target.unit_path) = 0 THEN v_source.unit_path ELSE v_target.unit_path END,
    -- ⚠️ render_mode 는 **글로 되돌린다.** 잘라 둔 이미지는 한쪽 쪽만 담고 있어서,
    --    합친 뒤에도 이미지 출제로 두면 이어 붙인 부분이 인쇄물에서 통째로 사라진다
    render_mode = 'text'
  WHERE id = p_target;

  -- 딸린 문항을 옮긴다. 이게 빠지면 문항이 지워진 지문을 가리키다 NULL 이 되어
  -- '지문 없는 문항' 으로 남는다
  UPDATE exam.problems SET passage_id = p_target WHERE passage_id = p_source;

  -- ⚠️ Storage 파일은 지우지 않는다 — 뒤 지문의 그림 경로를 앞 지문이 물려받았고,
  --    이미 만든 문제지도 스냅샷으로 들고 있다
  DELETE FROM exam.passages WHERE id = p_source;

  SELECT updated_at INTO v_updated FROM exam.passages WHERE id = p_target;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION exam.merge_passages(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exam.merge_passages(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION exam.merge_passages(UUID, UUID) IS
  '갈라진 지문 둘을 하나로 (본문·그림 이어 붙이기 + 자리표시자 번호 밀기 + 문항 이관 + 빈 칸 채우기 + 뒤 지문 삭제). 한 트랜잭션이라야 문항만 남는 상태가 안 생긴다';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인 쿼리 (적용 뒤 직접 돌려 볼 것)
-- ---------------------------------------------
-- 앞 지문에 그림 1개, 뒤 지문에 그림 1개인 상태에서 합친 뒤:
--   SELECT cardinality(figure_paths), html LIKE '%data-figure="2"%'
--     FROM exam.passages WHERE id = '<앞 지문 id>';
--   → 2, true 여야 한다
