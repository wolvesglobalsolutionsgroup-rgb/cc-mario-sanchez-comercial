-- Performance hardening for operational RLS and foreign-key lookups.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['special_agreements','receiving_accounts','activos_fijos','consumibles','kardex_movimientos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_manage ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.ccms_can(organization_id, ''properties'', ''manage'', property_id))', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.ccms_can(organization_id, ''properties'', ''manage'', property_id)) WITH CHECK (public.ccms_can(organization_id, ''properties'', ''manage'', property_id))', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (public.ccms_can(organization_id, ''properties'', ''manage'', property_id))', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_org_idx ON public.%I (organization_id)', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_property_idx ON public.%I (property_id)', t, t);
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS special_agreements_tenant_idx ON public.special_agreements (tenant_id);
CREATE INDEX IF NOT EXISTS kardex_movimientos_item_idx ON public.kardex_movimientos (organization_id, item_code);
DROP POLICY IF EXISTS property_membership_read ON public.property_memberships;
CREATE POLICY property_membership_read ON public.property_memberships
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.ccms_can((SELECT organization_id FROM public.properties WHERE id=property_id),'properties','manage',property_id));
