CREATE OR REPLACE FUNCTION public.update_authorized_import_payload(
  p_staging_id uuid,
  p_patch jsonb
) RETURNS public.authorized_import_staging
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE item public.authorized_import_staging; new_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'INVALID_IMPORT_PATCH'; END IF;
  SELECT * INTO item FROM public.authorized_import_staging WHERE id=p_staging_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'IMPORT_NOT_FOUND'; END IF;
  IF item.status <> 'pending_validation' THEN RAISE EXCEPTION 'IMPORT_NOT_PENDING'; END IF;
  IF NOT public.ccms_can(item.organization_id,'properties','manage',item.property_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  new_payload := item.payload;
  IF p_patch ? 'unit' AND p_patch->'unit' ? 'area_m2' THEN new_payload := jsonb_set(new_payload,'{unit,area_m2}',to_jsonb(p_patch->'unit'->>'area_m2'),true); END IF;
  IF p_patch ? 'tenant' AND p_patch->'tenant' ? 'rif' THEN new_payload := jsonb_set(new_payload,'{tenant,rif}',to_jsonb(p_patch->'tenant'->>'rif'),true); END IF;
  IF p_patch ? 'tenant' AND p_patch->'tenant' ? 'legal_rep_dni' THEN new_payload := jsonb_set(new_payload,'{tenant,legal_rep_dni}',to_jsonb(p_patch->'tenant'->>'legal_rep_dni'),true); END IF;
  IF p_patch ? 'contract' AND p_patch->'contract' ? 'start_date' THEN new_payload := jsonb_set(new_payload,'{contract,start_date}',to_jsonb(p_patch->'contract'->>'start_date'),true); END IF;
  IF p_patch ? 'contract' AND p_patch->'contract' ? 'end_date' THEN new_payload := jsonb_set(new_payload,'{contract,end_date}',to_jsonb(p_patch->'contract'->>'end_date'),true); END IF;
  UPDATE public.authorized_import_staging
  SET payload = new_payload,
      review_note = NULLIF(p_patch->>'review_note',''),
      updated_at = timezone('utc'::text,now())
  WHERE id=item.id RETURNING * INTO item;
  RETURN item;
END; $$;
REVOKE ALL ON FUNCTION public.update_authorized_import_payload(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_authorized_import_payload(uuid,jsonb) TO authenticated;
