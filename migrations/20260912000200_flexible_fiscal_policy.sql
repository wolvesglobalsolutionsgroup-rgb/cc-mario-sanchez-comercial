-- ==============================================================================
-- MIGRACIÓN: POLÍTICA FISCAL FLEXIBLE E INTEGRACIÓN TRIBUTARIA SENIAT (IGTF 3%)
-- Fecha: 2026-09-12 00:02:00 UTC
-- Gaceta Oficial Extraordinaria N° 6.687 / Gaceta Oficial N° 40.418
-- Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
-- ==============================================================================

-- 1. Campos de Tratamiento Fiscal en Pagos (public.payments)
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS tratamiento_fiscal VARCHAR(30) DEFAULT 'exento_bs',
  ADD COLUMN IF NOT EXISTS igtf_aplica BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS igtf_monto_usd NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tasa_bcv_usada NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS concepto_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS monto_total_con_igtf_usd NUMERIC(12, 2);

-- Restricción CHECK idempotente para tratamiento_fiscal en payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_tratamiento_fiscal'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT chk_payments_tratamiento_fiscal
      CHECK (tratamiento_fiscal IN ('exento_bs', 'igtf_3_divisa', 'manual_exento', 'bs_exento', 'divisa_igtf'));
  END IF;
END $$;

-- 2. Política Fiscal por Defecto en Inquilinos (public.tenants)
ALTER TABLE IF EXISTS public.tenants
  ADD COLUMN IF NOT EXISTS politica_fiscal_default VARCHAR(30) DEFAULT 'flexible';

-- Restricción CHECK idempotente para politica_fiscal_default en tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenants_politica_fiscal_default'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT chk_tenants_politica_fiscal_default
      CHECK (politica_fiscal_default IN ('flexible', 'siempre_divisa', 'siempre_bs'));
  END IF;
END $$;

-- Comentarios forenses y de auditoría fiscal
COMMENT ON COLUMN public.payments.tratamiento_fiscal IS 'Régimen de tributación aplicado: exento_bs (Pago Móvil/Transferencia en Bs) o igtf_3_divisa (Divisa en efectivo/custodia/cripto fuera de banca nacional)';
COMMENT ON COLUMN public.payments.igtf_monto_usd IS 'Monto percibido por concepto de IGTF 3% (G.O. 6.687) en dólares';
COMMENT ON COLUMN public.payments.tasa_bcv_usada IS 'Tasa cambiaria oficial del Banco Central de Venezuela (Art. 38 G.O. 40.418) fijada a la fecha valor del pago';
COMMENT ON COLUMN public.tenants.politica_fiscal_default IS 'Preferencia fiscal de liquidación del inquilino: flexible (por defecto), siempre_divisa o siempre_bs';
