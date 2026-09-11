-- ============================================================
-- 22. 기출 문제 은행 — 갈라진 지문 이어 붙이기
-- ============================================================
-- 쪽을 넘어가는 지문이 **두 개로 갈라져** 저장되는 일이 있다. 모델이 '이어진다' 표시를
-- 빠뜨리거나, 겹쳐 읽은 묶음이 뒷부분만 따로 내놓았을 때다. 앱(merge.ts)이 대부분을
-- 자동으로 잇지만, 이미 아카이브에 들어간 것은 손으로 합칠 길이 있어야 한다.
--
-- ⚠️ **한 트랜잭션이어야 한다.** 앱에서 UPDATE 를 나눠 보내면 중간에 하나가 실패했을 때
--    '본문은 합쳐졌는데 문항은 옛 지문에 남은' 상태가 된다 — 그러면 인쇄에서 같은 지문이
--    두 번 나오고 머리글 범위가 거짓말을 한다(set_source_textbook 과 같은 까닭).
--
-- 스키마는 모든 문장에 `exam.` 을 명시한다 (SQL Editor 가 문마다 다른 백엔드로 보낼 수 있다).

-- ---------------------------------------------
-- 1. RPC — 뒤 지문을 앞 지문에 붙이고 지운다
-- ---------------------------------------------
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
  v_updated TIMESTAMPTZ;
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

  -- 본문은 **뒤에 붙인다**. 순서를 바꾸면 글이 거꾸로 읽힌다
  UPDATE exam.passages SET
    html = CASE
      WHEN COALESCE(v_source.html, '') = '' THEN v_target.html
      WHEN COALESCE(v_target.html, '') = '' THEN v_source.html
      ELSE v_target.html || E'\n' || v_source.html
    END,
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

  DELETE FROM exam.passages WHERE id = p_source;

  SELECT updated_at INTO v_updated FROM exam.passages WHERE id = p_target;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION exam.merge_passages(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exam.merge_passages(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION exam.merge_passages(UUID, UUID) IS
  '갈라진 지문 둘을 하나로 (본문 이어 붙이기 + 문항 이관 + 빈 칸 채우기 + 뒤 지문 삭제). 한 트랜잭션이라야 문항만 남는 상태가 안 생긴다';

-- PostgREST 스키마 캐시 갱신 — 없으면 배포 직후 새 RPC 가 PGRST202 로 거부된다
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------
-- 확인 쿼리 (적용 뒤 직접 돌려 볼 것)
-- ---------------------------------------------
-- 함수가 생겼는지:
--   SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'exam' AND proname = 'merge_passages';
--
-- 실제 합치기 (되돌릴 수 없다 — 시험용 출처에서만):
--   SELECT exam.merge_passages('<앞 지문 id>', '<뒤 지문 id>');
