-- Revoca RPCs administrativos del rol anon. La clave anon nunca debe poder invocar
-- funciones SECURITY DEFINER aunque la función vuelva a comprobar auth.uid().
REVOKE EXECUTE ON FUNCTION public.ccms_can(uuid,text,text,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_member_permission(uuid,text,text,boolean,integer,text,text,uuid[],timestamptz) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_payment_v2(uuid,integer,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_capabilities(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_ccms_organization(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_ccms_tenant(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ccms_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ccms_auditor() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ccms_director() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ccms_financial_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ccms_heir() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ccms_heredero() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ccms_can(uuid,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_permission(uuid,text,text,boolean,integer,text,text,uuid[],timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payment_v2(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_capabilities(uuid) TO authenticated;
-- Las funciones de predicado se ejecutan dentro de las políticas RLS; el rol
-- autenticado debe poder evaluarlas, aunque anon y public no puedan invocarlas.
GRANT EXECUTE ON FUNCTION public.has_ccms_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_ccms_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ccms_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ccms_auditor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ccms_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ccms_financial_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ccms_heir() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ccms_heredero() TO authenticated;
ALTER FUNCTION ccms_private.immutable_financial_row() SET search_path = public, pg_catalog;

CREATE POLICY alerts_explicit_deny ON public.alerts FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY app_settings_explicit_deny ON public.app_settings FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY role_permissions_explicit_deny ON public.role_permissions FOR ALL USING (false) WITH CHECK (false);
