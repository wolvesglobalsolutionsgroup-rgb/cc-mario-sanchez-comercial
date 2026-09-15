-- El catálogo inmobiliario dejó de ser público al introducir el aislamiento
-- multi-tenant. Eliminar la política histórica que ignoraba organization_id.
DROP POLICY IF EXISTS "Unidades publicas" ON public.units;

-- Los permisos de tabla deben ser explícitos; RLS continúa siendo la autoridad
-- final por organización, rol y acción.
REVOKE ALL ON TABLE public.units, public.tenants, public.contracts,
  public.invoices, public.payments, public.condo_expenses,
  public.transactions, public.alerts, public.audit_logs
  FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.units, public.tenants,
  public.contracts, public.invoices, public.payments, public.condo_expenses,
  public.transactions, public.alerts, public.audit_logs TO authenticated;
