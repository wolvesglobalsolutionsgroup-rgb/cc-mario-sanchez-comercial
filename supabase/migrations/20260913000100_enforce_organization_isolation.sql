-- ==============================================================================
-- MIGRACIÓN: APLICAR AISLAMIENTO MULTI-TENANT POR ORGANIZACIÓN (RLS)
-- Fecha: 2026-09-13 00:01:00 UTC
-- Centro Comercial Mario Sánchez — Arquitectura PropTech Multi-Tenant
-- ==============================================================================

-- 1. PLAN DE CUENTAS (CHART_OF_ACCOUNTS)
DROP POLICY IF EXISTS "Admin total chart_of_accounts" ON public.chart_of_accounts;
CREATE POLICY "Admin total chart_of_accounts" ON public.chart_of_accounts
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

-- 2. UNIDADES INMOBILIARIAS (UNITS)
DROP POLICY IF EXISTS "Admin total units" ON public.units;
CREATE POLICY "Admin total units" ON public.units
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

-- 3. ARRENDATARIOS / INQUILINOS (TENANTS)
DROP POLICY IF EXISTS "Admin total tenants" ON public.tenants;
CREATE POLICY "Admin total tenants" ON public.tenants
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

DROP POLICY IF EXISTS "Tenant own tenant" ON public.tenants;
CREATE POLICY "Tenant own tenant" ON public.tenants
  FOR SELECT USING (public.has_ccms_tenant(id) AND public.has_ccms_organization(organization_id));

-- 4. CONTRATOS (CONTRACTS)
DROP POLICY IF EXISTS "Admin total contracts" ON public.contracts;
CREATE POLICY "Admin total contracts" ON public.contracts
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

DROP POLICY IF EXISTS "Tenant own contracts" ON public.contracts;
CREATE POLICY "Tenant own contracts" ON public.contracts
  FOR SELECT USING (public.has_ccms_tenant(tenant_id) AND public.has_ccms_organization(organization_id));

-- 5. GASTOS COMUNES / CONDOMINIO (CONDO_EXPENSES)
DROP POLICY IF EXISTS "Admin total condo_expenses" ON public.condo_expenses;
CREATE POLICY "Admin total condo_expenses" ON public.condo_expenses
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

-- 6. FACTURAS / CUOTAS (INVOICES)
DROP POLICY IF EXISTS "Admin total invoices" ON public.invoices;
CREATE POLICY "Admin total invoices" ON public.invoices
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

DROP POLICY IF EXISTS "Tenant own invoices" ON public.invoices;
CREATE POLICY "Tenant own invoices" ON public.invoices
  FOR SELECT USING (
    public.has_ccms_organization(organization_id) AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_id AND public.has_ccms_tenant(c.tenant_id)
    )
  );

-- 7. PAGOS (PAYMENTS)
DROP POLICY IF EXISTS "Admin total payments" ON public.payments;
CREATE POLICY "Admin total payments" ON public.payments
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

DROP POLICY IF EXISTS "Tenant own payments" ON public.payments;
CREATE POLICY "Tenant own payments" ON public.payments
  FOR SELECT USING (
    public.has_ccms_organization(organization_id) AND EXISTS (
      SELECT 1 FROM public.invoices i JOIN public.contracts c ON c.id = i.contract_id
      WHERE i.id = invoice_id AND public.has_ccms_tenant(c.tenant_id)
    )
  );

-- 8. LIBRO DIARIO / TRANSACCIONES (TRANSACTIONS)
DROP POLICY IF EXISTS "Admin total transactions" ON public.transactions;
CREATE POLICY "Admin total transactions" ON public.transactions
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

-- 9. ALERTAS DEL SISTEMA (ALERTS)
DROP POLICY IF EXISTS "Admin total alerts" ON public.alerts;
CREATE POLICY "Admin total alerts" ON public.alerts
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

DROP POLICY IF EXISTS "Tenant own alerts" ON public.alerts;
CREATE POLICY "Tenant own alerts" ON public.alerts
  FOR SELECT USING (tenant_id IS NOT NULL AND public.has_ccms_tenant(tenant_id) AND public.has_ccms_organization(organization_id));

-- 10. AUDIT LOGS (AUDIT_LOGS)
DROP POLICY IF EXISTS "Admin total audit_logs" ON public.audit_logs;
CREATE POLICY "Admin total audit_logs" ON public.audit_logs
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

-- 11. MESA DE TICKETS (SERVICE_TICKETS)
DROP POLICY IF EXISTS "Inquilinos pueden ver solo sus propios tickets" ON public.service_tickets;
CREATE POLICY "Inquilinos pueden ver solo sus propios tickets" ON public.service_tickets
  FOR SELECT USING (
    public.has_ccms_organization(organization_id) AND
    (public.is_ccms_admin() OR tenant_id IN (SELECT id FROM public.tenants WHERE public.has_ccms_tenant(id)))
  );

DROP POLICY IF EXISTS "Inquilinos y administradores pueden crear tickets" ON public.service_tickets;
CREATE POLICY "Inquilinos y administradores pueden crear tickets" ON public.service_tickets
  FOR INSERT WITH CHECK (
    public.has_ccms_organization(organization_id) AND
    (public.is_ccms_admin() OR tenant_id IN (SELECT id FROM public.tenants WHERE public.has_ccms_tenant(id)))
  );

-- 12. CONFIGURACIÓN PARAMÉTRICA DE FEATURES EN ORGANIZACIÓN SEMILLA
UPDATE public.organizations
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{regimen_sucesoral}',
  '{"activo": true, "cuota_base": 400.00, "coherederos": 14}'::jsonb
)
WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid;
