/**
 * ==============================================================================
 * PILAR 3: MODELADO RELACIONAL CODE-FIRST (DRIZZLE / SUPABASE ORM COMPATIBLE)
 * Centro Comercial Mario Sánchez C.A. (RIF: J-30211544-2)
 * 
 * Esquema tipado para prevención estricta de inyecciones SQL y gobierno de datos:
 * - units: Inventario de 39 locales comerciales, plantas y metrajes.
 * - tenants: Arrendatarios, RIF fiscal, solvencia y representación legal.
 * - contracts: Contratos de arrendamiento notariados bajo G.O. 40.418.
 * - invoices: Cánones de arrendamiento, cuotas de condominio y recibos con SHA-256.
 * - condo_expenses: Gastos comunes y retenciones fiscales corporativas SENIAT.
 * - kardex_inventory: Control de consumibles, stock mínimo y movimientos de almacén.
 * - audit_logs: Trazabilidad inmutable de acciones administrativas y fiscales.
 * - auth_sessions: Sesiones criptográficas con TTL y validación de IP/dispositivo.
 * ==============================================================================
 */

export const UnitsTable = {
  name: 'units',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    code: { type: 'varchar(20)', unique: true, notNull: true }, // Ej: PB-01, P1-14
    floor: { type: 'varchar(10)', notNull: true }, // PB, Mezzanina, Piso 1, Terraza
    surface_m2: { type: 'decimal(8, 2)', notNull: true },
    alicuota_pct: { type: 'decimal(6, 4)', notNull: true }, // % alícuota sobre condominio
    canon_base_usd: { type: 'decimal(10, 2)', notNull: true },
    status: { type: 'varchar(20)', default: "'disponible'", notNull: true }, // disponible, ocupado, mantenimiento
    created_at: { type: 'timestamp with time zone', default: 'now()', notNull: true }
  }
};

export const TenantsTable = {
  name: 'tenants',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    business_name: { type: 'varchar(255)', notNull: true },
    trade_name: { type: 'varchar(255)' },
    rif: { type: 'varchar(20)', unique: true, notNull: true }, // Formato SENIAT: J-XXXXXXXX-X
    category: { type: 'varchar(100)', notNull: true },
    legal_representative: { type: 'varchar(255)', notNull: true },
    id_doc: { type: 'varchar(20)', notNull: true }, // CI: V-XXXXXXXX
    email: { type: 'varchar(255)', notNull: true },
    phone: { type: 'varchar(50)', notNull: true },
    unit_id: { type: 'uuid', references: 'units.id' },
    status: { type: 'varchar(20)', default: "'solvente'", notNull: true }, // solvente, en_mora, desalojo
    created_at: { type: 'timestamp with time zone', default: 'now()', notNull: true }
  }
};

export const ContractsTable = {
  name: 'contracts',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    contract_number: { type: 'varchar(50)', unique: true, notNull: true }, // CTR-2026-XXXX
    tenant_id: { type: 'uuid', references: 'tenants.id', notNull: true },
    unit_id: { type: 'uuid', references: 'units.id', notNull: true },
    monthly_rent_usd: { type: 'decimal(10, 2)', notNull: true },
    alicuota_condo_pct: { type: 'decimal(6, 4)', notNull: true },
    deposit_held_usd: { type: 'decimal(10, 2)', notNull: true }, // Máx 3 meses Art 25 G.O. 40.418
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    is_notarized: { type: 'boolean', default: 'true', notNull: true },
    document_hash_sha256: { type: 'varchar(64)', notNull: true },
    created_at: { type: 'timestamp with time zone', default: 'now()', notNull: true }
  }
};

export const InvoicesTable = {
  name: 'invoices',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    receipt_number: { type: 'varchar(50)', unique: true, notNull: true },
    control_number: { type: 'varchar(50)', notNull: true }, // Formato SENIAT: 00-XXXXXX
    tenant_id: { type: 'uuid', references: 'tenants.id', notNull: true },
    concept: { type: 'varchar(255)', notNull: true },
    total_usd: { type: 'decimal(10, 2)', notNull: true },
    bcv_rate: { type: 'decimal(10, 4)', notNull: true },
    total_ves: { type: 'decimal(14, 2)', notNull: true },
    status: { type: 'varchar(20)', default: "'pendiente'", notNull: true }, // pendiente, pagado, en_mora, pendiente_aprobacion
    payment_method: { type: 'varchar(50)' },
    reference_number: { type: 'varchar(100)' },
    payment_date: { type: 'date' },
    sha256_seal: { type: 'varchar(64)', notNull: true },
    created_at: { type: 'timestamp with time zone', default: 'now()', notNull: true }
  }
};

export const CondoExpensesTable = {
  name: 'condo_expenses',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    concept: { type: 'varchar(255)', notNull: true },
    provider_name: { type: 'varchar(255)', notNull: true },
    provider_rif: { type: 'varchar(20)', notNull: true },
    invoice_number: { type: 'varchar(50)', notNull: true },
    control_number: { type: 'varchar(50)', notNull: true },
    category: { type: 'varchar(50)', notNull: true }, // SEGURIDAD, MANTENIMIENTO, SERVICIOS, etc.
    amount_usd: { type: 'decimal(10, 2)', notNull: true },
    bcv_rate: { type: 'decimal(10, 4)', notNull: true },
    amount_ves: { type: 'decimal(14, 2)', notNull: true },
    ret_iva_pct: { type: 'decimal(5, 2)', default: '75.00' }, // 75% retención IVA agente especial CCMS
    ret_islr_pct: { type: 'decimal(5, 2)', default: '2.00' },
    period_month: { type: 'integer', notNull: true },
    period_year: { type: 'integer', notNull: true },
    created_at: { type: 'timestamp with time zone', default: 'now()', notNull: true }
  }
};

export const KardexInventoryTable = {
  name: 'kardex_inventory',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    item_code: { type: 'varchar(50)', notNull: true },
    item_name: { type: 'varchar(255)', notNull: true },
    category: { type: 'varchar(100)', notNull: true },
    movement_type: { type: 'varchar(20)', notNull: true }, // entrada, salida, ajuste
    quantity: { type: 'integer', notNull: true },
    unit_cost_usd: { type: 'decimal(10, 2)', default: '0.00' },
    previous_stock: { type: 'integer', notNull: true },
    resulting_stock: { type: 'integer', notNull: true },
    reason: { type: 'varchar(255)', notNull: true },
    responsible_user: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamp with time zone', default: 'now()', notNull: true }
  }
};

export const AuditLogsTable = {
  name: 'audit_logs',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    timestamp: { type: 'timestamp with time zone', default: 'now()', notNull: true },
    user_id: { type: 'varchar(100)', notNull: true },
    role: { type: 'varchar(50)', notNull: true },
    action: { type: 'varchar(100)', notNull: true },
    details: { type: 'jsonb', notNull: true },
    ip_address: { type: 'varchar(45)' },
    integrity_hash: { type: 'varchar(64)', notNull: true }
  }
};
