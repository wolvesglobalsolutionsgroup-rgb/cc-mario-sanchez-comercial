-- ==============================================================================
-- MIGRACIÓN: CAPA MULTI-TENANT DE ORGANIZACIONES (FASE 0)
-- Fecha: 2026-09-13 00:00:00 UTC
-- Centro Comercial Mario Sánchez — Arquitectura PropTech Multi-Tenant
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA MAESTRA DE ORGANIZACIONES (ORGANIZATIONS)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    business_type VARCHAR(50) NOT NULL DEFAULT 'centro_comercial',
    plan VARCHAR(50) NOT NULL DEFAULT 'enterprise',
    status VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo', 'suspendido', 'demo')),
    features JSONB NOT NULL DEFAULT '{"fiscal_bcv": true, "seniat_txt": true, "multicurrency": true, "ai_assistant": true}'::jsonb,
    logo_url TEXT,
    color_primario VARCHAR(20) NOT NULL DEFAULT '#D97706',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS en Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. INSERTAR ORGANIZACIÓN MAESTRA (CENTRO COMERCIAL MARIO SÁNCHEZ)
INSERT INTO public.organizations (id, name, slug, business_type, plan, status, color_primario)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Centro Comercial Mario Sánchez',
    'mario-sanchez',
    'centro_comercial',
    'enterprise',
    'activo',
    '#D97706'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    business_type = EXCLUDED.business_type,
    updated_at = timezone('utc'::text, now());

-- 3. ASOCIACIÓN EN PERFILES (PROFILES)
ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.profiles
SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- 4. AGREGAR Y BACKFILLEAR organization_id EN LAS 11 TABLAS TRANSACCIONALES

-- 4.1. UNIDADES (UNITS)
ALTER TABLE IF EXISTS public.units
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.units SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_organization_id ON public.units(organization_id);

-- 4.2. INQUILINOS (TENANTS)
ALTER TABLE IF EXISTS public.tenants
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.tenants SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_organization_id ON public.tenants(organization_id);

-- 4.3. CONTRATOS (CONTRACTS)
ALTER TABLE IF EXISTS public.contracts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.contracts SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_organization_id ON public.contracts(organization_id);

-- 4.4. FACTURAS / CUOTAS (INVOICES)
ALTER TABLE IF EXISTS public.invoices
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.invoices SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);

-- 4.5. PAGOS (PAYMENTS)
ALTER TABLE IF EXISTS public.payments
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.payments SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON public.payments(organization_id);

-- 4.6. GASTOS COMUNES / CONDOMINIO (CONDO_EXPENSES)
ALTER TABLE IF EXISTS public.condo_expenses
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.condo_expenses SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_condo_expenses_organization_id ON public.condo_expenses(organization_id);

-- 4.7. PLAN DE CUENTAS (CHART_OF_ACCOUNTS)
ALTER TABLE IF EXISTS public.chart_of_accounts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.chart_of_accounts SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_organization_id ON public.chart_of_accounts(organization_id);

-- 4.8. LIBRO DIARIO / TRANSACCIONES (TRANSACTIONS)
ALTER TABLE IF EXISTS public.transactions
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.transactions SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_organization_id ON public.transactions(organization_id);

-- 4.9. ALERTAS (ALERTS)
ALTER TABLE IF EXISTS public.alerts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.alerts SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_organization_id ON public.alerts(organization_id);

-- 4.10. LOGS DE AUDITORÍA (AUDIT_LOGS)
ALTER TABLE IF EXISTS public.audit_logs
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.audit_logs SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);

-- 4.11. MESA DE TICKETS / SERVICIOS (SERVICE_TICKETS)
ALTER TABLE IF EXISTS public.service_tickets
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.service_tickets SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_tickets_organization_id ON public.service_tickets(organization_id);

-- 5. FUNCIÓN DE AISLAMIENTO MULTI-TENANT (RLS)
CREATE OR REPLACE FUNCTION public.has_ccms_organization(target_org_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND (
        organization_id = target_org_id
        OR role = 'superadmin'
      )
  );
$$;

-- 6. POLÍTICAS DE RLS PARA ORGANIZATIONS
DROP POLICY IF EXISTS "Organizaciones lectura miembros" ON public.organizations;
CREATE POLICY "Organizaciones lectura miembros"
    ON public.organizations
    FOR SELECT
    USING (
        id IN (SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid()))
        OR public.is_ccms_admin()
        OR status = 'activo'
    );

DROP POLICY IF EXISTS "Organizaciones superadmin escritura" ON public.organizations;
CREATE POLICY "Organizaciones superadmin escritura"
    ON public.organizations
    FOR ALL
    USING (public.is_ccms_admin())
    WITH CHECK (public.is_ccms_admin());
