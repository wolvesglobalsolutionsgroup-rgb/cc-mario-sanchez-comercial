CREATE OR REPLACE FUNCTION public.update_organization_features(
  p_organization_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb,
  p_change_reason text
) RETURNS public.organizations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_org public.organizations; clean jsonb := '{}'::jsonb; updated public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 3 THEN RAISE EXCEPTION 'CHANGE_REASON_REQUIRED'; END IF;
  IF jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'INVALID_FEATURE_PATCH'; END IF;
  IF NOT public.ccms_can(p_organization_id, 'settings', 'write') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO current_org FROM public.organizations WHERE id=p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND'; END IF;
  IF p_expected_updated_at IS NULL OR current_org.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'OPTIMISTIC_LOCK_CONFLICT'; END IF;
  IF p_patch ? 'fiscal_bcv' THEN clean := jsonb_set(clean,'{fiscal_bcv}',to_jsonb((p_patch->>'fiscal_bcv')::boolean),true); END IF;
  IF p_patch ? 'seniat_txt' THEN clean := jsonb_set(clean,'{seniat_txt}',to_jsonb((p_patch->>'seniat_txt')::boolean),true); END IF;
  IF p_patch ? 'multicurrency' THEN clean := jsonb_set(clean,'{multicurrency}',to_jsonb((p_patch->>'multicurrency')::boolean),true); END IF;
  IF p_patch ? 'ai_assistant' THEN clean := jsonb_set(clean,'{ai_assistant}',to_jsonb((p_patch->>'ai_assistant')::boolean),true); END IF;
  IF p_patch ? 'marketplace_opt_in' THEN clean := jsonb_set(clean,'{marketplace_opt_in}',to_jsonb((p_patch->>'marketplace_opt_in')::boolean),true); END IF;
  IF p_patch ? 'regimen_sucesoral' AND jsonb_typeof(p_patch->'regimen_sucesoral')='object' THEN clean := jsonb_set(clean,'{regimen_sucesoral}',p_patch->'regimen_sucesoral',true); END IF;
  UPDATE public.organizations SET features=COALESCE(current_org.features,'{}'::jsonb)||clean, updated_at=timezone('utc'::text,now()) WHERE id=p_organization_id RETURNING * INTO updated;
  INSERT INTO public.access_audit (organization_id,actor_id,target_id,reason,before_state,after_state)
  VALUES (p_organization_id,auth.uid(),p_organization_id,trim(p_change_reason),current_org.features,updated.features);
  RETURN updated;
END; $$;
REVOKE ALL ON FUNCTION public.update_organization_features(uuid,timestamptz,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_organization_features(uuid,timestamptz,jsonb,text) TO authenticated;
