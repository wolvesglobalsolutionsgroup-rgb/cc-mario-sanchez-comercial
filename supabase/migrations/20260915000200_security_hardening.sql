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
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ccms_can(uuid,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_permission(uuid,text,text,boolean,integer,text,text,uuid[],timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payment_v2(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_capabilities(uuid) TO authenticated;
ALTER FUNCTION ccms_private.immutable_financial_row() SET search_path = public, pg_catalog;

CREATE POLICY alerts_explicit_deny ON public.alerts FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY app_settings_explicit_deny ON public.app_settings FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY role_permissions_explicit_deny ON public.role_permissions FOR ALL USING (false) WITH CHECK (false);
