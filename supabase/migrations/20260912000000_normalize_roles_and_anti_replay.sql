-- ==============================================================================
-- MIGRACIÓN: NORMALIZACIÓN DE ROLES, RESTRICCIÓN ANTI-REPLAY, IGTF Y TICKETS RLS
-- Fecha: 2026-09-12 00:00:00 UTC
-- Centro Comercial Mario Sánchez — Arquitectura PropTech / Fintech
-- ==============================================================================

-- 1. Normalización de Roles en Perfiles (AUTH-04)
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE IF EXISTS public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento', 'heredero', 'tenant'));

-- Actualizar función de verificación administrativa is_ccms_admin()
CREATE OR REPLACE FUNCTION public.is_ccms_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento')
  );
$func$;

-- Función de solo lectura para rol especial 'heredero'
CREATE OR REPLACE FUNCTION public.is_ccms_heredero()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'heredero'
  );
$func$;

-- 2. Restricción Anti-Replay en Pagos (BANK-01)
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS banco_origen VARCHAR(50),
  ADD COLUMN IF NOT EXISTS banco_destino VARCHAR(50),
  ADD COLUMN IF NOT EXISTS referencia_operacion VARCHAR(64),
  ADD COLUMN IF NOT EXISTS fecha_operacion DATE,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_payments_anti_replay'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT uq_payments_anti_replay
      UNIQUE (banco_origen, banco_destino, referencia_operacion, fecha_operacion, amount_usd);
  END IF;
END $body$;

-- 3. Campos de IGTF 3% (FIN-01 / G.O. 6.687)
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS igtf_aplica BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS igtf_alicuota NUMERIC(5,2) NOT NULL DEFAULT 3.00,
  ADD COLUMN IF NOT EXISTS igtf_monto_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS monto_total_con_igtf_usd NUMERIC(12,2);

-- 4. Mesa de Reclamos y Solicitudes de Servicio (Service Tickets) con RLS Anti-IDOR
CREATE TABLE IF NOT EXISTS public.service_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(32) NOT NULL UNIQUE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_code VARCHAR(16) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'infraestructura',
  priority VARCHAR(16) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'alta', 'urgente')),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'en_atencion', 'resuelto')),
  technician VARCHAR(100),
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS obligatorio
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;

-- Políticas Anti-IDOR: Inquilinos solo leen sus propios tickets; Administradores ven todo
DROP POLICY IF EXISTS "Inquilinos pueden ver solo sus propios tickets" ON public.service_tickets;
CREATE POLICY "Inquilinos pueden ver solo sus propios tickets"
  ON public.service_tickets
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM public.tenants WHERE profile_id = (SELECT auth.uid())
    )
    OR public.is_ccms_admin()
  );

DROP POLICY IF EXISTS "Inquilinos pueden crear sus propios tickets" ON public.service_tickets;
CREATE POLICY "Inquilinos pueden crear sus propios tickets"
  ON public.service_tickets
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.tenants WHERE profile_id = (SELECT auth.uid())
    )
    OR public.is_ccms_admin()
  );

DROP POLICY IF EXISTS "Solo administradores pueden actualizar tickets" ON public.service_tickets;
CREATE POLICY "Solo administradores pueden actualizar tickets"
  ON public.service_tickets
  FOR UPDATE
  USING (public.is_ccms_admin())
  WITH CHECK (public.is_ccms_admin());
