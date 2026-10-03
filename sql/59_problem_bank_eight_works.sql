-- 2026-10-03: A mixed classical-poetry passage contains seven distinct works.
-- Keep the app limit, both CHECK constraints, normalizers, and passage merge guard in sync.
BEGIN;

ALTER TABLE exam.passages DROP CONSTRAINT IF EXISTS passages_works_shape;
ALTER TABLE exam.problems DROP CONSTRAINT IF EXISTS problems_work_titles_max;

CREATE OR REPLACE FUNCTION exam.normalize_work_titles(p_titles TEXT[])
RETURNS TEXT[]
  LANGUAGE sql IMMUTABLE SET search_path = exam, pg_temp
AS $$
  SELECT COALESCE(
    (exam.split_work_titles(array_to_string(COALESCE(p_titles, '{}'::TEXT[]), ' · ')))[1:8],
    '{}'::TEXT[]);
$$;

CREATE OR REPLACE FUNCTION exam.normalize_works(p_works JSONB)
RETURNS JSONB
  LANGUAGE plpgsql IMMUTABLE SET search_path = exam, pg_temp
AS $$
DECLARE
  v_out    JSONB   := '[]'::jsonb;
  v_seen   TEXT[]  := '{}';
  v_elem   JSONB;
  v_label  TEXT;
  v_author TEXT;
  v_title  TEXT;
BEGIN
  IF p_works IS NULL OR jsonb_typeof(p_works) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_elem IN SELECT a.e FROM jsonb_array_elements(p_works) AS a(e) LOOP
    CONTINUE WHEN jsonb_typeof(v_elem) <> 'object';
    v_label  := exam.normalize_work_label(v_elem->>'label');
    v_author := exam.normalize_work_title(COALESCE(v_elem->>'author', ''));
    -- A pasted 'A · B' title is split before the count check, as in the app.
    FOREACH v_title IN ARRAY exam.split_work_titles(COALESCE(v_elem->>'title', '')) LOOP
      EXIT WHEN cardinality(v_seen) >= 8;
      CONTINUE WHEN v_title = ANY (v_seen);
      v_seen := v_seen || v_title;
      v_out  := v_out || jsonb_build_array(
        jsonb_build_object('label', v_label, 'title', v_title, 'author', v_author));
    END LOOP;
    EXIT WHEN cardinality(v_seen) >= 8;
  END LOOP;

  RETURN v_out;
END;
$$;

DO $merge_guard$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('exam.merge_passages(uuid,uuid)'::regprocedure)
    INTO v_definition;
  IF v_definition LIKE '%c_max_works CONSTANT INT := 6;%' THEN
    EXECUTE replace(v_definition,
      'c_max_works CONSTANT INT := 6;',
      'c_max_works CONSTANT INT := 8;');
  ELSIF v_definition NOT LIKE '%c_max_works CONSTANT INT := 8;%' THEN
    RAISE EXCEPTION 'merge_passages work limit changed unexpectedly';
  END IF;
END;
$merge_guard$;

ALTER TABLE exam.passages ADD CONSTRAINT passages_works_shape
  CHECK (jsonb_typeof(works) = 'array' AND jsonb_array_length(works) <= 8);
ALTER TABLE exam.problems ADD CONSTRAINT problems_work_titles_max
  CHECK (cardinality(work_titles) <= 8);

DO $verify$
DECLARE
  v_works JSONB := '[]'::jsonb;
  v_titles TEXT[] := '{}';
  v_i INT;
BEGIN
  FOR v_i IN 1..8 LOOP
    v_works := v_works || jsonb_build_array(jsonb_build_object(
      'label', '', 'title', '검증용 작품' || v_i::TEXT, 'author', ''));
    v_titles := v_titles || ('검증용 작품' || v_i::TEXT);
  END LOOP;
  IF jsonb_array_length(exam.normalize_works(v_works)) <> 8
     OR cardinality(exam.normalize_work_titles(v_titles)) <> 8 THEN
    RAISE EXCEPTION 'Eight-work normalization failed';
  END IF;
  RAISE NOTICE 'Eight-work normalization and constraints installed';
END;
$verify$;

COMMIT;
