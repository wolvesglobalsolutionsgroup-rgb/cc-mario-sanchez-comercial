-- ==============================================================================
-- MIGRACIÓN: EXPANSIÓN DE IDENTIDAD, ACL/RBAC, COMMAND RECEIPTS Y APROBACIÓN ATÓMICA
-- Fecha: 2026-09-14 00:00:00 UTC
-- Fases: F2 (T07, T08, T09) & F3 (T12, T14)
-- Conforme al PLAN-MAESTRO.md y BACKLOG-EJECUTOR.md
-- ==============================================================================

-- 1. EXTENSIÓN DE ROLES EN PROFILES
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE IF EXISTS public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento', 'heredero', 'tenant',
    'org_director', 'org_admin', 'accountant', 'fiscal_auditor', 'operations_manager', 'heir_viewer', 'tenant_user'
  ));

-- Migrar roles legacy a roles enterprise
UPDATE public.profiles SET role = 'org_director' WHERE role = 'superadmin';
UPDATE public.profiles SET role = 'accountant' WHERE role = 'admin_finanzas';
UPDATE public.profiles SET role = 'operations_manager' WHERE role = 'admin_mantenimiento';

-- 2. TABLA DE MEMBRESÍAS DE ORGANIZACIÓN (ORGANIZATION_MEMBERSHIPS)
CREATE TABLE IF NOT EXISTS public.organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN (
      'org_director', 'org_admin', 'accountant', 'fiscal_auditor', 'operations_manager', 'heir_viewer', 'tenant_user',
      'superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento', 'heredero', 'tenant'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_org UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- 3. CATÁLOGO DE PERMISOS DE ROLES (ROLE_PERMISSIONS)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_role_module_action UNIQUE (role, module, action)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Sembrar catálogo base de permisos
INSERT INTO public.role_permissions (role, module, action, description)
VALUES
  ('org_director', '*', 'manage', 'Acceso total y gobierno de la organización'),
  ('org_admin', 'invoices', 'manage', 'Gestión completa de facturación y cuotas'),
  ('org_admin', 'tenants', 'manage', 'Gestión de arrendatarios y contratos'),
  ('org_admin', 'units', 'manage', 'Gestión de unidades y locales'),
  ('org_admin', 'payments', 'manage', 'Verificación y conciliación de pagos'),
  ('accountant', 'invoices', 'manage', 'Emisión y ajuste de facturas'),
  ('accountant', 'payments', 'verify', 'Aprobación y verificación de cobranzas'),
  ('accountant', 'bank_reconciliation', 'manage', 'Conciliación bancaria tridimensional'),
  ('accountant', 'accounting', 'manage', 'Libros contables y estados financieros'),
  ('fiscal_auditor', 'invoices', 'read', 'Auditoría de facturación y recibos'),
  ('fiscal_auditor', 'taxes', 'export', 'Generación de TXT SENIAT y Matriz ISAE Alcaldía'),
  ('fiscal_auditor', 'audit_trail', 'read', 'Revisión de bitácora inmutable'),
  ('operations_manager', 'units', 'read', 'Supervisión de locales y áreas comunes'),
  ('operations_manager', 'inventory', 'manage', 'Control de kardex y consumibles'),
  ('operations_manager', 'tickets', 'manage', 'Órdenes de trabajo y mantenimiento'),
  ('heir_viewer', 'succession', 'read', 'Consulta de liquidación de frutos patrimoniales'),
  ('heir_viewer', 'reports', 'read', 'Consulta de estados financieros publicados'),
  ('tenant_user', 'invoices', 'read_own', 'Consulta de sus propios recibos y avisos'),
  ('tenant_user', 'payments', 'create_own', 'Reporte de comprobantes de pago propios'),
  ('tenant_user', 'tickets', 'create_own', 'Reporte de novedades de mantenimiento de su local')
ON CONFLICT (role, module, action) DO NOTHING;

-- 4. TABLA DE COMMAND RECEIPTS (IDEMPOTENCIA & AUDITORÍA TRANSACCIONAL)
CREATE TABLE IF NOT EXISTS public.command_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    command_id VARCHAR(100) NOT NULL UNIQUE,
    command_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_command_receipts_entity ON public.command_receipts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_command_receipts_command_id ON public.command_receipts(command_id);
ALTER TABLE public.command_receipts ENABLE ROW LEVEL SECURITY;

-- 5. ACTUALIZAR FUNCIONES HELPER ACL
CREATE OR REPLACE FUNCTION public.is_ccms_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('superadmin', 'org_director', 'admin', 'org_admin', 'admin_finanzas', 'accountant', 'fiscal_auditor', 'admin_legal', 'admin_mantenimiento', 'operations_manager')
  );
$func$;

CREATE OR REPLACE FUNCTION public.is_ccms_director()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('superadmin', 'org_director')
  );
$func$;

CREATE OR REPLACE FUNCTION public.is_ccms_heir()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('heredero', 'heir_viewer')
  );
$func$;

-- 6. POLÍTICAS RLS PARA LAS NUEVAS TABLAS
DROP POLICY IF EXISTS "Directores y admins gestionan memberships" ON public.organization_memberships;
CREATE POLICY "Directores y admins gestionan memberships" ON public.organization_memberships
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

DROP POLICY IF EXISTS "Usuarios leen su propia membership" ON public.organization_memberships;
CREATE POLICY "Usuarios leen su propia membership" ON public.organization_memberships
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Permisos legibles por usuarios autenticados" ON public.role_permissions;
CREATE POLICY "Permisos legibles por usuarios autenticados" ON public.role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Command receipts auditable por admins" ON public.command_receipts;
CREATE POLICY "Command receipts auditable por admins" ON public.command_receipts
  FOR ALL USING (public.is_ccms_admin() AND public.has_ccms_organization(organization_id))
  WITH CHECK (public.is_ccms_admin() AND public.has_ccms_organization(organization_id));

-- 7. FUNCIÓN RPC: APROBACIÓN TRANSACCIONAL DE PAGO ATÓMICA (T14)
CREATE OR REPLACE FUNCTION public.approve_payment_transaction(
    p_payment_id VARCHAR(100),
    p_invoice_id VARCHAR(100),
    p_verifier_name VARCHAR(150),
    p_expected_version INTEGER,
    p_command_id VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
    v_cmd_id VARCHAR(100);
    v_existing_receipt RECORD;
    v_org_id UUID;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_cmd_id := COALESCE(p_command_id, 'cmd-pay-appr-' || p_payment_id || '-' || p_expected_version);

    -- 1. Idempotencia: Verificar si el comando ya fue ejecutado exitosamente
    SELECT * INTO v_existing_receipt FROM public.command_receipts WHERE command_id = v_cmd_id;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'ok', true,
            'idempotent', true,
            'message', 'Comando de aprobación ya procesado previamente',
            'receipt', v_existing_receipt.result
        );
    END IF;

    -- 2. Validar existencia y versión del pago (Optimistic Locking)
    SELECT * INTO v_payment FROM public.payments WHERE id::text = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND: El pago no existe.';
    END IF;

    IF v_payment.version != p_expected_version THEN
        RAISE EXCEPTION 'OPTIMISTIC_LOCK_CONFLICT: Conflicto de versión. Esperada %, actual %.', p_expected_version, v_payment.version;
    END IF;

    v_org_id := v_payment.organization_id;

    -- 3. Validar factura asociada
    SELECT * INTO v_invoice FROM public.invoices WHERE id::text = p_invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND: La factura asociada no existe.';
    END IF;

    IF v_invoice.status = 'pagado' THEN
        RAISE EXCEPTION 'INVOICE_ALREADY_PAID: La factura ya se encuentra liquidada.';
    END IF;

    -- 4. Actualizar estado del pago con incremento de versión
    UPDATE public.payments
    SET status = 'verificado',
        verified_by = p_verifier_name,
        verified_at = v_now,
        version = v_payment.version + 1,
        updated_at = v_now
    WHERE id = v_payment.id;

    -- 5. Actualizar estado de la factura
    UPDATE public.invoices
    SET status = 'pagado',
        paid_at = v_now::date,
        updated_at = v_now
    WHERE id = v_invoice.id;

    -- 6. Insertar recibo en command_receipts garantizando efecto atómico
    INSERT INTO public.command_receipts (
        organization_id,
        command_id,
        command_type,
        entity_type,
        entity_id,
        actor_id,
        status,
        payload,
        result
    ) VALUES (
        v_org_id,
        v_cmd_id,
        'APPROVE_PAYMENT',
        'payment',
        p_payment_id,
        auth.uid(),
        'completed',
        jsonb_build_object('payment_id', p_payment_id, 'invoice_id', p_invoice_id, 'version', p_expected_version),
        jsonb_build_object(
            'payment_id', p_payment_id,
            'invoice_id', p_invoice_id,
            'new_version', v_payment.version + 1,
            'verified_at', v_now,
            'status', 'verificado'
        )
    );

    RETURN jsonb_build_object(
        'ok', true,
        'payment_id', p_payment_id,
        'invoice_id', p_invoice_id,
        'new_version', v_payment.version + 1,
        'status', 'verificado'
    );
END;
$$;
