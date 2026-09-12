-- ==============================================================================
-- MIGRACIÓN 0002: TELEMETRÍA, KARDEX DE CONSUMIBLES Y AUDITORÍA CRIPTOGRÁFICA
-- Centro Comercial Mario Sánchez C.A. (RIF: J-30211544-2)
-- ==============================================================================

-- 6. Kardex de Bienes y Consumibles de Mantenimiento
CREATE TABLE IF NOT EXISTS kardex_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost_usd DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    previous_stock INTEGER NOT NULL,
    resulting_stock INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    responsible_user VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 7. Registro de Auditoría Inmutable de Seguridad
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL,
    ip_address VARCHAR(45),
    integrity_hash VARCHAR(64) NOT NULL
);

-- 8. Sesiones y Tokens de Seguridad Efímeros (Recuperación de Claves)
CREATE TABLE IF NOT EXISTS auth_security_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_identifier VARCHAR(255) NOT NULL,
    token_hash_sha256 VARCHAR(64) NOT NULL,
    token_type VARCHAR(50) NOT NULL, -- password_reset, email_verify
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Índices de Auditoría y Seguridad
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_security_tokens(token_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_kardex_item_code ON kardex_inventory(item_code);
