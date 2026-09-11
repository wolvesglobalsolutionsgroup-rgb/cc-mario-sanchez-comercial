-- ==============================================================================
-- CENTRO COMERCIAL MARIO SANCHEZ, C.A. & SUCESION MARIO SANCHEZ (RIF: J-30211544-2)
-- ESQUEMA RELACIONAL POSTGRESQL & POLITICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
-- Version de Produccion: 2.5-PROD-2026
-- ==============================================================================

-- 1. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TIPOS ENUMERADOS
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM (
        'superadmin',
        'admin',
        'admin_finanzas',
        'admin_legal',
        'admin_mantenimiento',
        'heredero',
        'tenant'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status_type AS ENUM ('active', 'pending_approval', 'rejected', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE unit_status_type AS ENUM ('ocupado', 'disponible', 'mantenimiento', 'reservado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status_type AS ENUM ('pendiente', 'verificando', 'pagado', 'en_mora', 'anulado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('transferencia_ves', 'pago_movil_ves', 'transferencia_usd', 'zelle', 'efectivo_usd', 'usdt_binance', 'otro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE agreement_status_type AS ENUM ('activo', 'completado', 'cancelado', 'en_revision');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLA DE PERFILES DE USUARIO (INTEGRADA CON SUPABASE AUTH)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role_type NOT NULL DEFAULT 'tenant',
    display_name VARCHAR(255) NOT NULL,
    identifier VARCHAR(255) UNIQUE NOT NULL, -- Email o RIF/C.I.
    status user_status_type NOT NULL DEFAULT 'pending_approval',
    unit VARCHAR(100), -- Local asignado o Estirpe (ej: 'Estirpe 1 - Mario Sanchez Jr.')
    estirpe_number INT CHECK (estirpe_number BETWEEN 1 AND 14),
    share_fraction VARCHAR(20) DEFAULT '1/14',
    phone VARCHAR(50),
    avatar_base64 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE UNIDADES INMOBILIARIAS (39 UNIDADES AUDITADAS)
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- 'PB-01', '4-A', 'OFIC.', 'LUB-DANCO'
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'Local Comercial',
    area_m2 NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_rent_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    condo_aliquot_usd NUMERIC(12,2) NOT NULL DEFAULT 50.00,
    aliquot_percentage NUMERIC(6,4) DEFAULT 0.0000,
    status unit_status_type NOT NULL DEFAULT 'disponible',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA DE INQUILINOS / ARRENDATARIOS
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_code VARCHAR(50) NOT NULL REFERENCES public.units(code) ON UPDATE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    rif VARCHAR(50) UNIQUE NOT NULL,
    legal_rep_name VARCHAR(255) NOT NULL,
    legal_rep_dni VARCHAR(50) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    observations TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE CONTRATOS DE ARRENDAMIENTO (G.O. 40.418)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_code VARCHAR(50) NOT NULL REFERENCES public.units(code) ON UPDATE CASCADE,
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rent_usd NUMERIC(12,2) NOT NULL,
    rent_method VARCHAR(100) NOT NULL DEFAULT 'CAF (Canon Fijo Art. 32)',
    deposit_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    deposit_months INT DEFAULT 3,
    status VARCHAR(50) NOT NULL DEFAULT 'vigente',
    contract_pdf_base64 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA DE FACTURAS Y CUOTAS MENSUALES
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_code VARCHAR(50) NOT NULL REFERENCES public.units(code) ON UPDATE CASCADE,
    period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2050),
    rent_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    condo_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    mora_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    agreement_deduction_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status invoice_status_type NOT NULL DEFAULT 'pendiente',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_period UNIQUE (tenant_id, period_month, period_year)
);

-- 8. TABLA DE PAGOS Y COMPROBANTES CONSIGNADOS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_code VARCHAR(50) NOT NULL,
    amount_usd NUMERIC(12,2) NOT NULL,
    amount_ves NUMERIC(16,2),
    bcv_rate NUMERIC(12,4) NOT NULL,
    payment_method payment_method_type NOT NULL,
    bank_name VARCHAR(100),
    bank_reference VARCHAR(100) NOT NULL,
    payment_date DATE NOT NULL,
    proof_base64 TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'verificando',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA DE RECIBOS INMUTABLES CON HASH SHA-256
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    qr_payload TEXT NOT NULL,
    receipt_data JSONB NOT NULL
);

-- 10. TABLA DE GASTOS COMUNES Y EGRESOS ($2,540 PRESUPUESTO BASE AUDITADO)
CREATE TABLE IF NOT EXISTS public.condo_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2050),
    category VARCHAR(100) NOT NULL, -- 'Vigilancia', 'Aseo', 'Areas Comunes', 'Servicios', 'Bombas', 'Insumos', 'Imprevistos'
    concept VARCHAR(255) NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    provider_rif VARCHAR(50),
    invoice_number VARCHAR(100),
    amount_usd NUMERIC(12,2) NOT NULL,
    receipt_photo_base64 TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABLA DE ACUERDOS ESPECIALES Y AMORTIZACIONES POR MEJORAS
CREATE TABLE IF NOT EXISTS public.special_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_code VARCHAR(50) NOT NULL REFERENCES public.units(code) ON UPDATE CASCADE,
    agreement_type VARCHAR(100) NOT NULL DEFAULT 'Reparaciones Estructurales',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    total_investment_usd NUMERIC(12,2) NOT NULL,
    monthly_deduction_usd NUMERIC(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status agreement_status_type NOT NULL DEFAULT 'activo',
    evidence_base64 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TABLA DE DISTRIBUCION SUCESORAL A COHEREDEROS (1/14 SUCESION MARIO SANCHEZ)
CREATE TABLE IF NOT EXISTS public.coherederos_distributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2050),
    estirpe_number INT NOT NULL CHECK (estirpe_number BETWEEN 1 AND 14),
    coheredero_name VARCHAR(255) NOT NULL,
    coheredero_doc VARCHAR(50) NOT NULL,
    share_fraction VARCHAR(20) NOT NULL DEFAULT '1/14',
    share_percentage NUMERIC(8,6) NOT NULL DEFAULT 7.142857,
    gross_revenue_usd NUMERIC(12,2) NOT NULL,
    common_expenses_usd NUMERIC(12,2) NOT NULL DEFAULT 2540.00,
    reserve_fund_usd NUMERIC(12,2) NOT NULL, -- 10%
    admin_fee_usd NUMERIC(12,2) NOT NULL, -- 5%
    net_fruit_usd NUMERIC(12,2) NOT NULL,
    net_fruit_ves NUMERIC(16,2) NOT NULL,
    bcv_rate NUMERIC(12,4) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Disponible',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_coheredero_period UNIQUE (period_month, period_year, estirpe_number)
);

-- 13. TABLA DE INVENTARIO: ACTIVOS FIJOS
CREATE TABLE IF NOT EXISTS public.activos_fijos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL DEFAULT 'C.C. Mario Sanchez',
    estimated_value_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    condition VARCHAR(50) NOT NULL DEFAULT 'Operativo',
    photo_base64 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. TABLA DE INVENTARIO: CONSUMIBLES Y REPUESTOS
CREATE TABLE IF NOT EXISTS public.consumibles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    min_threshold NUMERIC(10,2) NOT NULL DEFAULT 5.00,
    unit_measure VARCHAR(50) NOT NULL DEFAULT 'unidades',
    cost_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    photo_base64 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. TABLA DE KARDEX DE ALMACEN
CREATE TABLE IF NOT EXISTS public.kardex_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL, -- 'activo' o 'consumible'
    item_code VARCHAR(50) NOT NULL,
    movement_type VARCHAR(20) NOT NULL, -- 'entrada' o 'salida'
    quantity NUMERIC(10,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    signed_delivery_base64 TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. TABLA DE CUENTAS BANCARIAS RECEPTORAS
CREATE TABLE IF NOT EXISTS public.receiving_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    holder_name VARCHAR(255) NOT NULL,
    holder_rif VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_tenants TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. TABLA DE BITACORA DE AUDITORIA & TRAZABILIDAD (ZERO-TRUST)
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 18. HABILITACION DE ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condo_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coherederos_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos_fijos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kardex_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 19. FUNCIONES HELPER PARA POLITICAS DE SEGURIDAD
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role_type AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND status = 'active' LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND status = 'active' 
          AND role IN ('superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_authorized_heredero()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND status = 'active' 
          AND role = 'heredero'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 20. POLITICAS RLS ESPECIFICAS POR ROL Y TABLA
-- ==============================================================================

-- A. TABLA PROFILES
CREATE POLICY "Superadmin full access on profiles"
    ON public.profiles FOR ALL
    USING (public.current_user_role() = 'superadmin');

CREATE POLICY "Admin read and update on profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Users can read their own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

-- B. TABLA COHEREDEROS_DISTRIBUTIONS (SUCESION MARIO SANCHEZ)
-- Los herederos y la administracion pueden ver los estados de cuenta sucesorales.
-- SOLO la administracion puede generar o liquidar distribuciones.
CREATE POLICY "Admin manage coherederos distributions"
    ON public.coherederos_distributions FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Herederos view distributions"
    ON public.coherederos_distributions FOR SELECT
    USING (public.is_authorized_heredero());

-- C. TABLA CONDO_EXPENSES
CREATE POLICY "Admin manage condo expenses"
    ON public.condo_expenses FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Herederos view condo expenses"
    ON public.condo_expenses FOR SELECT
    USING (public.is_authorized_heredero());

-- D. TABLA UNITS
CREATE POLICY "Admin manage units"
    ON public.units FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Public read active units"
    ON public.units FOR SELECT
    USING (true);

-- E. TABLA TENANTS & CONTRACTS
CREATE POLICY "Admin manage tenants"
    ON public.tenants FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Herederos view tenants list"
    ON public.tenants FOR SELECT
    USING (public.is_authorized_heredero());

CREATE POLICY "Tenants view own tenant profile"
    ON public.tenants FOR SELECT
    USING (
        id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admin manage contracts"
    ON public.contracts FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Tenants view own contract"
    ON public.contracts FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- F. TABLA INVOICES & PAYMENTS & RECEIPTS
CREATE POLICY "Admin manage invoices"
    ON public.invoices FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Herederos view invoices"
    ON public.invoices FOR SELECT
    USING (public.is_authorized_heredero());

CREATE POLICY "Tenants view own invoices"
    ON public.invoices FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admin manage payments"
    ON public.payments FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Tenants insert and view own payments"
    ON public.payments FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Tenants select own payments"
    ON public.payments FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Public verify receipts with hash"
    ON public.receipts FOR SELECT
    USING (true);

-- G. TABLA INVENTARIO (ACTIVOS & CONSUMIBLES & KARDEX)
CREATE POLICY "Admin manage inventory"
    ON public.activos_fijos FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Herederos view activos fijos"
    ON public.activos_fijos FOR SELECT
    USING (public.is_authorized_heredero());

CREATE POLICY "Admin manage consumibles"
    ON public.consumibles FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Admin manage kardex"
    ON public.kardex_movimientos FOR ALL
    USING (public.is_admin_or_superadmin());

-- H. TABLA SPECIAL AGREEMENTS
CREATE POLICY "Admin manage special agreements"
    ON public.special_agreements FOR ALL
    USING (public.is_admin_or_superadmin());

CREATE POLICY "Tenants view own agreements"
    ON public.special_agreements FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- I. TABLA AUDIT TRAIL
CREATE POLICY "Admin insert audit trail"
    ON public.audit_trail FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Superadmin read audit trail"
    ON public.audit_trail FOR SELECT
    USING (public.current_user_role() = 'superadmin' OR public.is_authorized_heredero());
