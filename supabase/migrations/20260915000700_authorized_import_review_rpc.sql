-- Review command for source imports. Approval is deliberately stricter than
-- staging: incomplete book rows can be rejected, never promoted silently.
CREATE OR REPLACE FUNCTION public.review_authorized_import(
  p_staging_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
) RETURNS public.authorized_import_staging
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.authorized_import_staging;
  area numeric;
  start_date text;
  end_date text;
  rif text;
  legal_dni text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'INVALID_REVIEW_DECISION'; END IF;

  SELECT * INTO item
  FROM public.authorized_import_staging
  WHERE id = p_staging_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'IMPORT_NOT_FOUND'; END IF;
  IF NOT public.ccms_can(item.organization_id, 'properties', 'manage', item.property_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF item.status <> 'pending_validation' THEN RAISE EXCEPTION 'IMPORT_NOT_PENDING'; END IF;

  IF p_decision = 'approved' AND item.record_type <> 'lease_bundle' THEN
    RAISE EXCEPTION 'EXCEPTION_REQUIRES_REJECTION';
  END IF;
  IF p_decision = 'approved' THEN
    area := NULLIF(item.payload->'unit'->>'area_m2', '')::numeric;
    start_date := NULLIF(item.payload->'contract'->>'start_date', '');
    end_date := NULLIF(item.payload->'contract'->>'end_date', '');
    rif := NULLIF(item.payload->'tenant'->>'rif', '');
    legal_dni := NULLIF(item.payload->'tenant'->>'legal_rep_dni', '');
    IF area IS NULL OR area <= 0 OR start_date IS NULL OR end_date IS NULL
       OR rif IS NULL OR legal_dni IS NULL THEN
      RAISE EXCEPTION 'IMPORT_INCOMPLETE_REQUIRES_DATA';
    END IF;
  END IF;

  UPDATE public.authorized_import_staging
  SET status = p_decision,
      review_note = NULLIF(p_note, ''),
      reviewed_by = auth.uid(), reviewed_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = item.id
  RETURNING * INTO item;
  RETURN item;
END;
$$;

REVOKE ALL ON FUNCTION public.review_authorized_import(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_authorized_import(uuid, text, text) TO authenticated;
