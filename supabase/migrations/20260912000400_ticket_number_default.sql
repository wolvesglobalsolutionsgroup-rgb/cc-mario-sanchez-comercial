-- ==============================================================================
-- MIGRACIÓN: VALOR POR DEFECTO PARA TICKET_NUMBER EN SERVICE_TICKETS (SEC-03)
-- Fecha: 2026-09-12 00:04:00 UTC
-- Autogenera ticket_number único e inmutable en inserciones desde cliente
-- ==============================================================================

ALTER TABLE public.service_tickets
  ALTER COLUMN ticket_number SET DEFAULT (
    'TCK-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)
  );
