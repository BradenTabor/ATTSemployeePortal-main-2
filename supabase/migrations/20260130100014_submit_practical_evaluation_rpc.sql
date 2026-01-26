-- =============================================================================
-- Submit practical evaluation — RPC
-- =============================================================================
-- Checks can_evaluate_user, inserts practical_evaluations, updates
-- certification_records when passed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submit_practical_evaluation(
  p_user_id UUID,
  p_certification_type_id UUID,
  p_checklist_items JSONB,
  p_evaluator_notes TEXT DEFAULT NULL,
  p_evaluator_signature TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluator_id UUID := auth.uid();
  v_items_total INT := 0;
  v_items_passed INT := 0;
  v_passed BOOLEAN;
  v_ev_id UUID;
  v_cert_id UUID;
  v_validity INTERVAL;
  v_rec RECORD;
  v_cat TEXT;
  v_arr JSONB;
  v_item JSONB;
  v_item_passed BOOLEAN;
BEGIN
  IF v_evaluator_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_evaluate_user(v_evaluator_id, p_user_id, p_certification_type_id) THEN
    RAISE EXCEPTION 'Not authorized to evaluate this user for this certification';
  END IF;

  FOR v_cat, v_arr IN SELECT * FROM jsonb_each(p_checklist_items)
  LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_arr)
    LOOP
      v_items_total := v_items_total + 1;
      v_item_passed := (v_item->>'passed')::boolean;
      IF v_item_passed THEN
        v_items_passed := v_items_passed + 1;
      END IF;
    END LOOP;
  END LOOP;

  IF v_items_total = 0 THEN
    RAISE EXCEPTION 'Checklist must have at least one item';
  END IF;

  v_passed := (v_items_passed::float / v_items_total::float) >= 0.8;

  INSERT INTO public.practical_evaluations (
    user_id,
    certification_type_id,
    evaluator_id,
    evaluation_date,
    checklist_items,
    items_total,
    items_passed,
    passed,
    evaluator_notes,
    evaluator_signature
  ) VALUES (
    p_user_id,
    p_certification_type_id,
    v_evaluator_id,
    now(),
    p_checklist_items,
    v_items_total,
    v_items_passed,
    v_passed,
    p_evaluator_notes,
    p_evaluator_signature
  )
  RETURNING id INTO v_ev_id;

  IF v_passed THEN
    SELECT validity_months INTO v_validity
    FROM public.certification_types
    WHERE id = p_certification_type_id;

    v_validity := COALESCE(v_validity, 12) * INTERVAL '1 month';

    UPDATE public.certification_records
    SET
      practical_evaluation_id = v_ev_id,
      practical_passed_at = now(),
      status = 'active',
      certified_at = now(),
      certified_by = v_evaluator_id,
      expires_at = now() + v_validity,
      updated_at = now()
    WHERE user_id = p_user_id
      AND certification_type_id = p_certification_type_id
      AND status = 'written_passed';
  END IF;

  RETURN v_ev_id;
END;
$$;

COMMENT ON FUNCTION public.submit_practical_evaluation(UUID, UUID, JSONB, TEXT, TEXT) IS
  'Evaluator submits practical checklist. Updates cert record when passed.';

GRANT EXECUTE ON FUNCTION public.submit_practical_evaluation(UUID, UUID, JSONB, TEXT, TEXT) TO authenticated;
