CREATE OR REPLACE FUNCTION public.materialize_authorized_import(p_staging_id uuid)
RETURNS public.authorized_import_staging
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE item public.authorized_import_staging; u jsonb; t jsonb; c jsonb;
  unit_id uuid; tenant_id uuid; contract_id uuid;
  area numeric; rent numeric; start_date date; end_date date;
  unit_code text; rif text; contract_number text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO item FROM public.authorized_import_staging WHERE id=p_staging_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'IMPORT_NOT_FOUND'; END IF;
  IF item.status <> 'approved' THEN RAISE EXCEPTION 'IMPORT_NOT_APPROVED'; END IF;
  IF NOT public.ccms_can(item.organization_id,'properties','manage',item.property_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  u := item.payload->'unit'; t := item.payload->'tenant'; c := item.payload->'contract';
  unit_code := NULLIF(u->>'code',''); rif := NULLIF(t->>'rif',''); contract_number := NULLIF(c->>'contract_number','');
  area := NULLIF(u->>'area_m2','')::numeric; rent := COALESCE(NULLIF(u->>'base_rent_usd','')::numeric, NULLIF(c->>'monthly_rent_usd','')::numeric, 0);
  start_date := NULLIF(c->>'start_date','')::date; end_date := NULLIF(c->>'end_date','')::date;
  IF unit_code IS NULL OR rif IS NULL OR contract_number IS NULL OR area IS NULL OR area <= 0
     OR start_date IS NULL OR end_date IS NULL
     OR NULLIF(t->>'legal_rep_name','') IS NULL OR NULLIF(t->>'legal_rep_dni','') IS NULL
     OR NULLIF(t->>'email','') IS NULL OR NULLIF(t->>'phone','') IS NULL OR NULLIF(t->>'whatsapp','') IS NULL THEN
    RAISE EXCEPTION 'IMPORT_INCOMPLETE_REQUIRES_DATA';
  END IF;
  IF EXISTS (SELECT 1 FROM public.units existing_unit WHERE existing_unit.organization_id=item.organization_id AND existing_unit.code=unit_code) THEN RAISE EXCEPTION 'DUPLICATE_UNIT_CODE'; END IF;
  IF EXISTS (SELECT 1 FROM public.tenants existing_tenant WHERE existing_tenant.organization_id=item.organization_id AND existing_tenant.rif=rif) THEN RAISE EXCEPTION 'DUPLICATE_TENANT_RIF'; END IF;
  IF EXISTS (SELECT 1 FROM public.contracts existing_contract WHERE existing_contract.organization_id=item.organization_id AND existing_contract.contract_number=contract_number) THEN RAISE EXCEPTION 'DUPLICATE_CONTRACT_NUMBER'; END IF;
  INSERT INTO public.units (code,name,category,area_m2,base_rent_usd,condo_aliquot,status,organization_id,property_id)
  VALUES (unit_code,COALESCE(NULLIF(u->>'name',''),unit_code),COALESCE(NULLIF(u->>'category',''),'locales'),area,rent,COALESCE(NULLIF(u->>'condo_aliquot','')::numeric,0),'arrendado',item.organization_id,item.property_id)
  RETURNING id INTO unit_id;
  INSERT INTO public.tenants (rif,business_name,trade_name,legal_rep_name,legal_rep_dni,email,phone,whatsapp,commercial_activity,status,organization_id)
  VALUES (rif,COALESCE(NULLIF(t->>'business_name',''),NULLIF(u->>'name','')),NULLIF(t->>'trade_name',''),t->>'legal_rep_name',t->>'legal_rep_dni',t->>'email',t->>'phone',t->>'whatsapp',NULLIF(t->>'commercial_activity',''),'activo',item.organization_id)
  RETURNING id INTO tenant_id;
  INSERT INTO public.contracts (contract_number,tenant_id,unit_id,start_date,end_date,duration_months,rent_method,rent_amount_usd,deposit_months,deposit_amount_usd,status,notes,organization_id)
  VALUES (contract_number,tenant_id,unit_id,start_date,end_date,12,'CAF',rent,0,0,'vigente',concat('Importado desde ',item.source_name,' fila ',item.source_row),item.organization_id)
  RETURNING id INTO contract_id;
  UPDATE public.authorized_import_staging SET status='imported',updated_at=timezone('utc'::text,now()),reviewed_at=COALESCE(reviewed_at,timezone('utc'::text,now())),review_note=COALESCE(review_note,'Materializado de forma transaccional') WHERE id=item.id RETURNING * INTO item;
  RETURN item;
END; $$;
REVOKE ALL ON FUNCTION public.materialize_authorized_import(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.materialize_authorized_import(uuid) TO authenticated;
