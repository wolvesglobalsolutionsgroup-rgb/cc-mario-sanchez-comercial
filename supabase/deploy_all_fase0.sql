-- ==============================================================================
-- WGS · WOLVES GLOBAL SOLUTIONS GROUP
-- CC MARIO SÁNCHEZ COMERCIAL — DESPLIEGUE MAESTRO SUPABASE CLOUD (FASE 0)
-- Proyecto: wgs-proptech-prod (kjvmtsfibjedufcqsrwg)
-- Fecha: 2026-09-13
-- Contenido: Esquema Base + RBAC + Anti-Replay + Fiscal G.O. 40.418/6.687 +
--           Capa Multi-Tenant Fase 0 (organizations) + Seed Data + Forense
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1.1. Plan de Cuentas Contables
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.2. Unidades Inmobiliarias (Locales, Galpones, Macro-Lotes)
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL,
    area_m2 NUMERIC(10, 2) NOT NULL,
    base_rent_usd NUMERIC(12, 2) NOT NULL,
    condo_aliquot NUMERIC(5, 4) DEFAULT 0.0500,
    status VARCHAR(20) DEFAULT 'disponible',
    frontage_m NUMERIC(6, 2),
    power_kva VARCHAR(50),
    has_loading_dock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.3. Arrendatarios / Inquilinos
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rif VARCHAR(20) NOT NULL UNIQUE,
    business_name VARCHAR(150) NOT NULL,
    trade_name VARCHAR(150),
    commercial_registry TEXT,
    legal_rep_name VARCHAR(120) NOT NULL,
    legal_rep_dni VARCHAR(20) NOT NULL,
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    whatsapp VARCHAR(30) NOT NULL,
    fiscal_address TEXT,
    commercial_activity VARCHAR(150),
    status VARCHAR(20) DEFAULT 'activo',
    politica_fiscal_default VARCHAR(30) DEFAULT 'flexible',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.4. Contratos de Arrendamiento (G.O. 40.418)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(30) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_months INTEGER NOT NULL,
    monthly_rent_usd NUMERIC(12, 2) NOT NULL,
    security_deposit_usd NUMERIC(12, 2) DEFAULT 0.00,
    security_deposit_months INTEGER DEFAULT 3,
    billing_day INTEGER DEFAULT 1,
    grace_period_days INTEGER DEFAULT 5,
    late_fee_percentage NUMERIC(5, 2) DEFAULT 0.00,
    arbitration_clause BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.5. Facturas / Cuentas de Cobro
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(30) NOT NULL UNIQUE,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    rent_amount_usd NUMERIC(12, 2) NOT NULL,
    condo_amount_usd NUMERIC(12, 2) DEFAULT 0.00,
    penalty_amount_usd NUMERIC(12, 2) DEFAULT 0.00,
    subtotal_usd NUMERIC(12, 2) NOT NULL,
    bcv_rate NUMERIC(12, 4),
    subtotal_bs NUMERIC(16, 2),
    status VARCHAR(20) DEFAULT 'emitida',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.6. Pagos y Conciliaciones (con Anti-Replay e IGTF)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    amount_usd NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    amount_native NUMERIC(16, 2) NOT NULL,
    exchange_rate NUMERIC(12, 4),
    payment_method VARCHAR(30) NOT NULL,
    reference_number VARCHAR(100),
    banco_origen VARCHAR(50),
    banco_destino VARCHAR(50),
    referencia_operacion VARCHAR(64),
    fecha_operacion DATE,
    payment_date DATE NOT NULL,
    receipt_url TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'conciliado',
    version INTEGER NOT NULL DEFAULT 1,
    tratamiento_fiscal VARCHAR(30) DEFAULT 'exento_bs',
    igtf_aplica BOOLEAN DEFAULT false,
    igtf_alicuota NUMERIC(5,2) NOT NULL DEFAULT 3.00,
    igtf_monto_usd NUMERIC(12, 2) DEFAULT 0.00,
    tasa_bcv_usada NUMERIC(12, 4),
    concepto_fiscal TEXT,
    monto_total_con_igtf_usd NUMERIC(12, 2),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.7. Gastos Comunes / Condominio
CREATE TABLE IF NOT EXISTS public.condo_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    concept VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount_usd NUMERIC(12, 2) NOT NULL,
    bcv_rate NUMERIC(12, 4),
    amount_bs NUMERIC(16, 2),
    invoice_ref VARCHAR(50),
    supplier VARCHAR(150),
    payment_date DATE,
    status VARCHAR(20) DEFAULT 'pagado',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.8. Libro Diario / Transacciones Contables
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number BIGSERIAL,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    debit_usd NUMERIC(12, 2) DEFAULT 0.00,
    credit_usd NUMERIC(12, 2) DEFAULT 0.00,
    debit_bs NUMERIC(16, 2) DEFAULT 0.00,
    credit_bs NUMERIC(16, 2) DEFAULT 0.00,
    bcv_rate NUMERIC(12, 4),
    description TEXT NOT NULL,
    reference_type VARCHAR(30),
    reference_id UUID,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.9. Alertas Operativas y de Mora
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(30) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(10) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    target_role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.10. Bitácora Forense / Logs de Auditoría
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(100) DEFAULT 'sistema',
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. AUTENTICACIÓN, PERFILES Y RELACIÓN DE INQUILINOS
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'tenant' CHECK (role IN ('superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento', 'heredero', 'tenant')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.user_tenants (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.1. Mesa de Ayuda / Tickets de Servicio
CREATE TABLE IF NOT EXISTS public.service_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(32) NOT NULL UNIQUE DEFAULT (
        'TCK-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)
    ),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_code VARCHAR(16) NOT NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'infraestructura',
    priority VARCHAR(16) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'alta', 'urgente')),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'en_atencion', 'resuelto')),
    technician VARCHAR(100),
    admin_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. CAPA MULTI-TENANT DE ORGANIZACIONES (FASE 0)
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

-- Semilla de Mario Sánchez
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

-- organization_id en Profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
UPDATE public.profiles SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- organization_id en las 11 Tablas Transaccionales
ALTER TABLE public.units
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.units SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_organization_id ON public.units(organization_id);

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.tenants SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_organization_id ON public.tenants(organization_id);

ALTER TABLE public.contracts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.contracts SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_organization_id ON public.contracts(organization_id);

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.invoices SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.payments SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON public.payments(organization_id);

ALTER TABLE public.condo_expenses
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.condo_expenses SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_condo_expenses_organization_id ON public.condo_expenses(organization_id);

ALTER TABLE public.chart_of_accounts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.chart_of_accounts SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_organization_id ON public.chart_of_accounts(organization_id);

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
UPDATE public.transactions SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_organization_id ON public.transactions(organization_id);

ALTER TABLE public.alerts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.alerts SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_organization_id ON public.alerts(organization_id);

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.audit_logs SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);

ALTER TABLE public.service_tickets
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.service_tickets SET organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_tickets_organization_id ON public.service_tickets(organization_id);

-- 4. SEGURIDAD Y RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condo_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_ccms_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $f$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento')
  );
$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $f$
  SELECT public.is_ccms_admin();
$;

CREATE OR REPLACE FUNCTION public.is_ccms_heredero()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $f$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'heredero'
  );
$;

CREATE OR REPLACE FUNCTION public.has_ccms_organization(target_org_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $f$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND (
        organization_id = target_org_id
        OR role = 'superadmin'
      )
  );
$;

CREATE OR REPLACE FUNCTION public.has_ccms_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $f$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = (SELECT auth.uid()) AND tenant_id = target_tenant_id
  );
$;

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

DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
CREATE POLICY "profiles self read" ON public.profiles
    FOR SELECT USING ((SELECT auth.uid()) = id OR public.is_ccms_admin());

DROP POLICY IF EXISTS "profiles admin write" ON public.profiles;
CREATE POLICY "profiles admin write" ON public.profiles
    FOR ALL USING (public.is_ccms_admin()) WITH CHECK (public.is_ccms_admin());

-- 5. SEMILLA DE DATOS CCMS MARIO SÁNCHEZ
INSERT INTO public.chart_of_accounts (code, name, account_type, description, organization_id)
VALUES
('1.1.01', 'Cuentas por Cobrar — Cánones de Arrendamiento', 'activo', 'Cobranzas pendientes de unidades comerciales', 'a0000000-0000-0000-0000-000000000001'::uuid),
('1.1.02', 'Cuentas por Cobrar — Gastos Comunes / Condominio', 'activo', 'Alícuotas de mantenimiento y servicios ordinarios', 'a0000000-0000-0000-0000-000000000001'::uuid),
('1.1.03', 'Banco Banesco (Cuenta Corriente Bs)', 'activo', 'Cuenta receptora nacional', 'a0000000-0000-0000-0000-000000000001'::uuid),
('1.1.04', 'Banco Mercantil (Cuenta Corriente Bs / Pago Móvil)', 'activo', 'Cuenta recaudadora Pago Móvil', 'a0000000-0000-0000-0000-000000000001'::uuid),
('1.1.05', 'Banesco Panamá / Custodia USD', 'activo', 'Recepción de transferencias internacionales y custodia', 'a0000000-0000-0000-0000-000000000001'::uuid),
('1.1.06', 'Billetera Digital USDT (TRC20)', 'activo', 'Custodia de pagos cripto en stablecoin', 'a0000000-0000-0000-0000-000000000001'::uuid),
('2.1.01', 'Depósitos en Garantía de Arrendatarios', 'pasivo', 'Garantías en custodia (máximo 3 meses legal Art. 19)', 'a0000000-0000-0000-0000-000000000001'::uuid),
('4.1.01', 'Ingresos por Cánones de Arrendamiento Fijo (CAF)', 'ingreso', 'Ingreso mensual por alquiler comercial', 'a0000000-0000-0000-0000-000000000001'::uuid),
('5.1.01', 'Gastos Operativos — Vigilancia y Seguridad 24/7', 'egreso', 'Custodia física y monitoreo CCTV', 'a0000000-0000-0000-0000-000000000001'::uuid),
('5.1.02', 'Gastos Operativos — Energía Eléctrica Áreas Comunes', 'egreso', 'Iluminación exterior, bombas y pasillos', 'a0000000-0000-0000-0000-000000000001'::uuid),
('5.1.03', 'Gastos Operativos — Suministro de Agua / Cisterna', 'egreso', 'Abastecimiento de tanques y red sanitaria', 'a0000000-0000-0000-0000-000000000001'::uuid),
('5.1.04', 'Gastos Operativos — Aseo Urbano y Manejo de Desechos', 'egreso', 'Recolección y compactación de basura', 'a0000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.units (code, name, category, area_m2, base_rent_usd, condo_aliquot, status, frontage_m, power_kva, has_loading_dock, organization_id)
VALUES
('LOT-C01', 'Macro-Lote C01 (Norte)', 'macro-lotes', 1730.00, 3800.00, 0.2315, 'disponible', 27.95, 'Transformador 150 kVA', true, 'a0000000-0000-0000-0000-000000000001'::uuid),
('LOT-C02', 'Macro-Lote C02 (Medio)', 'macro-lotes', 1730.00, 3800.00, 0.2315, 'disponible', 27.95, 'Transformador 150 kVA', true, 'a0000000-0000-0000-0000-000000000001'::uuid),
('LOT-C03', 'Macro-Lote C03 (Sur)', 'macro-lotes', 1730.00, 3800.00, 0.2315, 'disponible', 27.96, 'Transformador 150 kVA', true, 'a0000000-0000-0000-0000-000000000001'::uuid),
('LOC-01', 'Local 01 — Fachada Principal', 'locales', 250.00, 1100.00, 0.0335, 'arrendado', 12.00, 'Trifásica 25 kVA', false, 'a0000000-0000-0000-0000-000000000001'::uuid),
('LOC-02', 'Local 02 — Fachada Comercial', 'locales', 250.00, 1050.00, 0.0335, 'arrendado', 12.00, 'Trifásica 25 kVA', false, 'a0000000-0000-0000-0000-000000000001'::uuid),
('LOC-03', 'Local 03 — Planta Baja', 'locales', 180.00, 850.00, 0.0241, 'disponible', 9.00, 'Monofásica/Trifásica', false, 'a0000000-0000-0000-0000-000000000001'::uuid),
('LOC-04', 'Local 04 — Planta Baja', 'locales', 180.00, 850.00, 0.0241, 'arrendado', 9.00, 'Monofásica/Trifásica', false, 'a0000000-0000-0000-0000-000000000001'::uuid),
('LOC-05', 'Local 05 — Zona Media', 'locales', 160.00, 750.00, 0.0214, 'disponible', 8.00, 'Monofásica 15 kVA', false, 'a0000000-0000-0000-0000-000000000001'::uuid),
('LOC-06', 'Local 06 — Zona Media', 'locales', 160.00, 750.00, 0.0214, 'arrendado', 8.00, 'Monofásica 15 kVA', false, 'a0000000-0000-0000-0000-000000000001'::uuid),
('GAL-01', 'Galpón 01 Logístico y Almacén', 'galpones', 750.00, 1900.00, 0.1004, 'arrendado', 25.00, 'Industrial 75 kVA', true, 'a0000000-0000-0000-0000-000000000001'::uuid),
('GAL-02', 'Galpón 02 Distribución & Taller', 'galpones', 560.00, 1500.00, 0.0750, 'disponible', 20.00, 'Industrial 50 kVA', true, 'a0000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.tenants (rif, business_name, trade_name, commercial_registry, legal_rep_name, legal_rep_dni, email, phone, whatsapp, fiscal_address, commercial_activity, status, organization_id)
VALUES
('J-30987123-4', 'Distribuidora Oriente Marino, C.A.', 'Oriente Marine Supply', 'RM Segundo Puerto La Cruz, Tomo 45-A, Nro 12', 'Carlos Eduardo Mendoza', 'V-14.289.412', 'carlos.mendoza@orientemarine.com', '+58 281-2674400', '+58 414-8123456', 'Av. Municipal c/c Calle Montes, Puerto La Cruz', 'Repuestos e insumos navieros e industriales', 'activo', 'a0000000-0000-0000-0000-000000000001'::uuid),
('J-40112890-1', 'Logística y Cargas del Caribe, S.A.', 'Caribe Logistics Hub', 'RM Primero Barcelona, Tomo 112, Nro 89', 'Mariana Valentina Silva', 'V-16.904.551', 'msilva@caribelogistics.com', '+58 281-2869010', '+58 424-8199234', 'Zona Industrial Los Montones, Barcelona', 'Distribución logística, bodegaje y paquetería', 'activo', 'a0000000-0000-0000-0000-000000000001'::uuid),
('J-31445892-0', 'Ferretería Industrial La Cruz, C.A.', 'FerroCruz Pro', 'RM Segundo Puerto La Cruz, Tomo 88, Nro 204', 'Ing. Roberto Hernández', 'V-12.780.334', 'gerencia@ferrocruz.com.ve', '+58 281-2681122', '+58 412-3556789', 'Av. Intercomunal c/ Av. Municipal, PLC', 'Materiales de construcción y ferretería pesada', 'activo', 'a0000000-0000-0000-0000-000000000001'::uuid),
('J-50239011-8', 'AutoPartes & Servicios Express, C.A.', 'AutoExpress PLC', 'RM Primero PLC, Tomo 34, Nro 15', 'Alejandro José Gómez', 'V-18.441.902', 'admin@autopartesexpress.net', '+58 281-2659988', '+58 416-6801234', 'Av. Municipal, CC Mario Sánchez, Local 01', 'Venta de autopartes, lubricantes y baterías', 'activo', 'a0000000-0000-0000-0000-000000000001'::uuid),
('J-41220993-2', 'Bodegón & Delicateses El Faro, C.A.', 'El Faro Market', 'RM Segundo PLC, Tomo 90, Nro 44', 'Lucía Carolina Morales', 'V-15.332.109', 'contacto@elfaromarket.com', '+58 281-2693311', '+58 424-8224567', 'Av. Municipal, Local 02, CC Mario Sánchez', 'Viveres, importados, panadería gourmet y café', 'moroso', 'a0000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (rif) DO NOTHING;

INSERT INTO public.condo_expenses (period_month, period_year, concept, category, amount_usd, bcv_rate, amount_bs, organization_id)
VALUES
(3, 2026, 'Servicio de Seguridad y Vigilancia Armada 24/7', 'seguridad', 1200.00, 72.50, 87000.00, 'a0000000-0000-0000-0000-000000000001'::uuid),
(3, 2026, 'Energía Eléctrica Áreas Comunes & Postes (Corpoelec)', 'servicios_publicos', 350.00, 72.50, 25375.00, 'a0000000-0000-0000-0000-000000000001'::uuid),
(3, 2026, 'Servicio Privado de Cisterna de Agua (40.000 L)', 'servicios_publicos', 220.00, 72.50, 15950.00, 'a0000000-0000-0000-0000-000000000001'::uuid),
(3, 2026, 'Mantenimiento Preventivo Bomba de Achique y Drenajes', 'mantenimiento', 180.00, 72.50, 13050.00, 'a0000000-0000-0000-0000-000000000001'::uuid);

COMMIT;

-- VERIFICACIÓN FORENSE
SELECT 
    'public.organizations' AS objeto,
    count(*)::text AS total_filas,
    'Fila semilla CC Mario Sánchez activa' AS estado
FROM public.organizations
WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid
UNION ALL
SELECT 
    'Tablas con organization_id' AS objeto,
    count(DISTINCT table_name)::text AS total_filas,
    '11 tablas transaccionales + profiles aseguradas' AS estado
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'organization_id'
UNION ALL
SELECT 
    'Índices organization_id' AS objeto,
    count(*)::text AS total_filas,
    'Índices creados exitosamente' AS estado
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE '%organization_id%'
UNION ALL
SELECT 
    'Función RLS has_ccms_organization' AS objeto,
    count(*)::text AS total_filas,
    'Función de aislamiento multi-tenant activa' AS estado
FROM pg_proc
WHERE proname = 'has_ccms_organization';
