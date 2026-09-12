-- ==============================================================================
-- MIGRACIÓN 0001: ESQUEMA INICIAL NÚCLEO INMOBILIARIO & FISCAL CCMS
-- Centro Comercial Mario Sánchez C.A. (RIF: J-30211544-2)
-- Base legal: G.O. 40.418 Arrendamiento Comercial & Providencia SNAT/2014/0032
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Unidades / Locales Comerciales (Total 39 unidades maestras)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    floor VARCHAR(10) NOT NULL,
    surface_m2 DECIMAL(8, 2) NOT NULL,
    alicuota_pct DECIMAL(6, 4) NOT NULL,
    canon_base_usd DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'disponible',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Inquilinos / Arrendatarios
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    rif VARCHAR(20) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    legal_representative VARCHAR(255) NOT NULL,
    id_doc VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'solvente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Contratos de Arrendamiento Notariados
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT NOT NULL,
    monthly_rent_usd DECIMAL(10, 2) NOT NULL,
    alicuota_condo_pct DECIMAL(6, 4) NOT NULL,
    deposit_held_usd DECIMAL(10, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_notarized BOOLEAN DEFAULT true NOT NULL,
    document_hash_sha256 VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Cuentas por Cobrar, Cánones y Recibos
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    control_number VARCHAR(50) NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT NOT NULL,
    concept VARCHAR(255) NOT NULL,
    total_usd DECIMAL(10, 2) NOT NULL,
    bcv_rate DECIMAL(10, 4) NOT NULL,
    total_ves DECIMAL(14, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pendiente' NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    payment_date DATE,
    sha256_seal VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. Gastos Comunes de Condominio y Retenciones Fiscales SENIAT
CREATE TABLE IF NOT EXISTS condo_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept VARCHAR(255) NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    provider_rif VARCHAR(20) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    control_number VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount_usd DECIMAL(10, 2) NOT NULL,
    bcv_rate DECIMAL(10, 4) NOT NULL,
    amount_ves DECIMAL(14, 2) NOT NULL,
    ret_iva_pct DECIMAL(5, 2) DEFAULT 75.00 NOT NULL,
    ret_islr_pct DECIMAL(5, 2) DEFAULT 2.00 NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Índices de Rendimiento Operativo
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_rif ON tenants(rif);
CREATE INDEX IF NOT EXISTS idx_condo_expenses_period ON condo_expenses(period_year, period_month);
