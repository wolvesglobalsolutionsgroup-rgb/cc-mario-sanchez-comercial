CREATE OR REPLACE FUNCTION public.create_organization_onboarding(
  p_name text,
  p_slug text,
  p_property_name text,
  p_business_type text DEFAULT 'centro_comercial',
  p_features jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE org_id uuid; property_id uuid; safe_features jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_staff ps WHERE ps.user_id=auth.uid() AND ps.role='founder' AND ps.status='active') THEN RAISE EXCEPTION 'PLATFORM_FOUNDER_REQUIRED'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 OR length(p_name) > 200 THEN RAISE EXCEPTION 'INVALID_ORGANIZATION_NAME'; END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR length(p_slug) > 100 THEN RAISE EXCEPTION 'INVALID_ORGANIZATION_SLUG'; END IF;
  IF p_property_name IS NULL OR length(trim(p_property_name)) < 2 OR length(p_property_name) > 200 THEN RAISE EXCEPTION 'INVALID_PROPERTY_NAME'; END IF;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug=p_slug) THEN RAISE EXCEPTION 'ORGANIZATION_SLUG_EXISTS'; END IF;
  IF p_features IS NULL OR jsonb_typeof(p_features) <> 'object' THEN RAISE EXCEPTION 'INVALID_FEATURES'; END IF;
  safe_features := jsonb_build_object(
    'fiscal_bcv', COALESCE((p_features->>'fiscal_bcv')::boolean, true),
    'seniat_txt', COALESCE((p_features->>'seniat_txt')::boolean, true),
    'multicurrency', COALESCE((p_features->>'multicurrency')::boolean, true),
    'ai_assistant', COALESCE((p_features->>'ai_assistant')::boolean, false),
    'regimen_sucesoral', COALESCE(p_features->'regimen_sucesoral','{}'::jsonb),
    'marketplace_opt_in', COALESCE((p_features->>'marketplace_opt_in')::boolean, false)
  );
  INSERT INTO public.organizations(name,slug,business_type,plan,status,features)
  VALUES (trim(p_name),p_slug,COALESCE(NULLIF(trim(p_business_type),''),'centro_comercial'),'trial','activo',safe_features)
  RETURNING id INTO org_id;
  INSERT INTO public.properties(organization_id,name) VALUES (org_id,trim(p_property_name)) RETURNING id INTO property_id;
  RETURN jsonb_build_object('organization_id',org_id,'property_id',property_id,'status','created');
END; $$;
REVOKE ALL ON FUNCTION public.create_organization_onboarding(text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_onboarding(text,text,text,text,jsonb) TO authenticated;
