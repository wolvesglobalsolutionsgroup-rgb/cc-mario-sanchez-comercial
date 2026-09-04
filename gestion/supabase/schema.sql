-- ==============================================================================
-- CENTRO COMERCIAL MARIO SÁNCHEZ - SUITE DE GESTIÓN INMOBILIARIA & COBRANZAS
-- Base de Datos PostgreSQL / Supabase
-- Conforme a la Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial
-- (Decreto Ley N° 929, Gaceta Oficial N° 40.418)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PLAN DE CUENTAS CONTABLES (CHART OF ACCOUNTS)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) NOT NULL UNIQUE,          -- Ej: 1.1.01 (Cuentas por Cobrar Cánones), 2.1.01 (Vigilancia)
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(20) NOT NULL,         -- 'activo', 'pasivo', 'ingreso', 'egreso'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA DE UNIDADES INMOBILIARIAS (LOCALES, GALPONES, MACRO-LOTES)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,          -- Ej: LOT-A1, LOC-01, GAL-01
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL,             -- 'macro-lotes', 'locales', 'galpones'
    area_m2 NUMERIC(10, 2) NOT NULL,          -- Superficie arrendable
    base_rent_usd NUMERIC(12, 2) NOT NULL,     -- Canon base en USD
    condo_aliquot NUMERIC(5, 4) DEFAULT 0.0500,-- Alícuota de condominio/gastos comunes (ej: 0.10 = 10%)
    status VARCHAR(20) DEFAULT 'disponible',   -- 'disponible', 'arrendado', 'reservado', 'mantenimiento'
    frontage_m NUMERIC(6, 2),                  -- Metros lineales de frente comercial
    power_kva VARCHAR(50),                     -- Capacidad eléctrica
    has_loading_dock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE ARRENDATARIOS (EMPRESAS O PERSONAS NATURALES)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rif VARCHAR(20) NOT NULL UNIQUE,           -- Registro Único de Información Fiscal (J-12345678-9)
    business_name VARCHAR(150) NOT NULL,       -- Razón Social
    trade_name VARCHAR(150),                   -- Nombre Comercial de la Marca/Tienda
    commercial_registry TEXT,                  -- Datos del Registro Mercantil (Tomo, Nro, Fecha)
    legal_rep_name VARCHAR(120) NOT NULL,      -- Representante Legal
    legal_rep_dni VARCHAR(20) NOT NULL,        -- Cédula de Identidad
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,                -- Teléfono principal
    whatsapp VARCHAR(30) NOT NULL,             -- Número directo para avisos WhatsApp
    fiscal_address TEXT,
    commercial_activity VARCHAR(150),          -- Rubro (Ferretería, Alimentos, Naviero, etc.)
    status VARCHAR(20) DEFAULT 'activo',       -- 'activo', 'moroso', 'inactivo', 'en_tramite'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA DE CONTRATOS DE ARRENDAMIENTO COMERCIAL (G.O. 40.418)
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(30) NOT NULL UNIQUE,-- Ej: CCMS-CTR-2026-001
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_months INT DEFAULT 12,            -- Mínimo 1 año según Art. 13 de la Ley
    rent_method VARCHAR(30) DEFAULT 'CAF',     -- 'CAF' (Fijo Art. 32), 'CAP' (Variable Ventas), 'MIXTO'
    rent_amount_usd NUMERIC(12, 2) NOT NULL,   -- Monto pactado en USD de referencia
    cap_percentage NUMERIC(5, 2) DEFAULT 0.00, -- % sobre ventas brutas si aplica CAP (1% - 8%)
    deposit_months INT DEFAULT 3,              -- Límite máx legal de 3 meses según Art. 19
    deposit_amount_usd NUMERIC(12, 2) NOT NULL,-- Monto total en garantía
    legal_extension_status VARCHAR(20) DEFAULT 'no_aplica', -- 'no_aplica', 'concedida', 'en_curso' (Art. 25)
    legal_extension_months INT DEFAULT 0,      -- Meses calculados por antigüedad
    status VARCHAR(20) DEFAULT 'vigente',      -- 'vigente', 'por_vencer', 'vencido', 'resuelto'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA DE GASTOS COMUNES / CONDOMINIO (CONDO EXPENSES)
CREATE TABLE IF NOT EXISTS condo_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_month INT NOT NULL,
    period_year INT NOT NULL,
    concept VARCHAR(120) NOT NULL,             -- 'Vigilancia 24/7', 'Energía Eléctrica Común', 'Aseo', 'Cisterna Agua'
    category VARCHAR(50) NOT NULL,             -- 'seguridad', 'servicios_publicos', 'mantenimiento', 'administracion'
    amount_usd NUMERIC(12, 2) NOT NULL,
    bcv_rate NUMERIC(10, 4) NOT NULL,
    amount_bs NUMERIC(16, 2) NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id),
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA DE CUOTAS / FACTURAS MENSUALES (INVOICES)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(30) NOT NULL UNIQUE,-- Ej: REC-2026-03-001
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    period_month INT NOT NULL,                 -- Mes facturado (1-12)
    period_year INT NOT NULL,                  -- Año facturado (2026)
    rent_usd NUMERIC(12, 2) NOT NULL,
    condo_usd NUMERIC(12, 2) DEFAULT 0.00,
    electricity_usd NUMERIC(12, 2) DEFAULT 0.00,
    total_usd NUMERIC(12, 2) NOT NULL,
    bcv_exchange_rate NUMERIC(10, 4) NOT NULL, -- Tasa oficial BCV a la fecha de emisión
    total_bs NUMERIC(16, 2) NOT NULL,          -- Monto en Bolívares según tasa oficial BCV
    total_eur NUMERIC(12, 2) NOT NULL,         -- Equivalente en EUR
    total_usdt NUMERIC(12, 2) NOT NULL,        -- Equivalente en USDT
    due_date DATE NOT NULL,                    -- Día límite de pago (primeros 5 días hábiles)
    days_overdue INT DEFAULT 0,                -- Días de retraso acumulados
    accumulated_balance_usd NUMERIC(12, 2) DEFAULT 0.00, -- Saldo pendiente total
    status VARCHAR(20) DEFAULT 'pendiente',    -- 'pendiente', 'pagado', 'en_mora', 'verificando'
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABLA DE PAGOS Y CONCILIACIONES MULTIMONEDA CON SNAPSHOT
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,       -- 'Transferencia Bs', 'Pago Móvil', 'Zelle', 'Efectivo USD', 'USDT'
    bank_origin VARCHAR(50),                   -- Banco emisor (Banesco, Mercantil, BDV, etc.)
    bank_destination VARCHAR(50),              -- Cuenta receptora
    reference_number VARCHAR(80) NOT NULL,     -- Nro de confirmación bancaria o Hash TxID
    txid VARCHAR(80),                          -- Hash específico de red TRC20 / BEP20 si es USDT
    amount_paid NUMERIC(16, 2) NOT NULL,       -- Monto recibido en la moneda de pago
    currency VARCHAR(10) NOT NULL,             -- 'USD', 'EUR', 'VES', 'USDT'
    bcv_rate_applied NUMERIC(10, 4) NOT NULL,  -- Snapshot de tasa oficial en la fecha valor
    eur_rate_applied NUMERIC(10, 4) NOT NULL,  -- Snapshot de tasa EUR
    usd_equivalent NUMERIC(12, 2) NOT NULL,    -- Equivalente neto acreditado en USD
    receipt_url TEXT,                          -- Comprobante digital adjunto
    verification_status VARCHAR(20) DEFAULT 'verificado', -- 'pendiente', 'verificado', 'rechazado'
    verified_by VARCHAR(80),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. LIBRO DIARIO DE TRANSACCIONES CONTABLES (TRANSACTIONS)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_date DATE NOT NULL,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    transaction_type VARCHAR(20) NOT NULL,     -- 'ingreso', 'egreso'
    concept VARCHAR(150) NOT NULL,
    original_currency VARCHAR(10) NOT NULL,    -- 'USD', 'EUR', 'VES', 'USDT'
    original_amount NUMERIC(16, 2) NOT NULL,
    bcv_rate NUMERIC(10, 4) NOT NULL,
    usd_equivalent NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference_number VARCHAR(80) NOT NULL,
    support_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABLA DE ALERTAS Y NOTIFICACIONES
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    alert_type VARCHAR(40) NOT NULL,           -- 'aviso_cobro', 'recordatorio_vencimiento', 'mora', 'renovacion'
    channel VARCHAR(20) NOT NULL,              -- 'whatsapp', 'email', 'ambos'
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    sent_status VARCHAR(20) DEFAULT 'enviado',  -- 'pendiente', 'enviado', 'fallido'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. TABLA DE AUDITORÍA (AUDIT LOGS)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_email VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ==============================================================================
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE condo_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Función de Seguridad para Verificar Rol Administrativo
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('admin', 'comite')
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Unidades Comerciales: Catálogo público en lectura, administrable por directiva
CREATE POLICY "Unidades publicas lectura" ON units FOR SELECT USING (true);
CREATE POLICY "Unidades administracion total" ON units FOR ALL USING (is_admin());

-- 3. Arrendatarios / Inquilinos: Admin gestiona todo; inquilino solo consulta su registro
CREATE POLICY "Admin total tenants" ON tenants FOR ALL USING (is_admin());
CREATE POLICY "Tenant propio ver perfil" ON tenants FOR SELECT USING (
  id::text = auth.uid()::text OR email = (auth.jwt() ->> 'email')
);

-- 4. Contratos: Admin gestiona todo; inquilino solo lee su contrato asignado
CREATE POLICY "Admin total contracts" ON contracts FOR ALL USING (is_admin());
CREATE POLICY "Tenant propio ver contratos" ON contracts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tenants t
    WHERE t.id = contracts.tenant_id
    AND (t.id::text = auth.uid()::text OR t.email = (auth.jwt() ->> 'email'))
  )
);

-- 5. Gastos Comunes: Lectura transparente para la junta y arrendatarios (Art. 14 Ley Arrendamiento)
CREATE POLICY "Lectura transparente gastos comunes" ON condo_expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin gestionar gastos comunes" ON condo_expenses FOR ALL USING (is_admin());

-- 6. Recibos / Cuotas (Invoices): Admin gestiona todo; inquilino solo ve sus cuotas
CREATE POLICY "Admin total invoices" ON invoices FOR ALL USING (is_admin());
CREATE POLICY "Tenant propio ver facturas" ON invoices FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM contracts c
    JOIN tenants t ON c.tenant_id = t.id
    WHERE c.id = invoices.contract_id
    AND (t.id::text = auth.uid()::text OR t.email = (auth.jwt() ->> 'email'))
  )
);

-- 7. Pagos & Conciliaciones: Admin gestiona todo; inquilino registra y consulta sus propios pagos
CREATE POLICY "Admin total payments" ON payments FOR ALL USING (is_admin());
CREATE POLICY "Tenant propio ver pagos" ON payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN contracts c ON i.contract_id = c.id
    JOIN tenants t ON c.tenant_id = t.id
    WHERE i.id = payments.invoice_id
    AND (t.id::text = auth.uid()::text OR t.email = (auth.jwt() ->> 'email'))
  )
);
CREATE POLICY "Tenant registrar pago propio" ON payments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN contracts c ON i.contract_id = c.id
    JOIN tenants t ON c.tenant_id = t.id
    WHERE i.id = payments.invoice_id
    AND (t.id::text = auth.uid()::text OR t.email = (auth.jwt() ->> 'email'))
  )
);

-- 8. Contabilidad & Auditoría: Acceso exclusivo a administradores y comités
CREATE POLICY "Admin total chart_of_accounts" ON chart_of_accounts FOR ALL USING (is_admin());
CREATE POLICY "Admin total transactions" ON transactions FOR ALL USING (is_admin());
CREATE POLICY "Admin total alerts" ON alerts FOR ALL USING (is_admin());
CREATE POLICY "Admin total audit_logs" ON audit_logs FOR ALL USING (is_admin());
