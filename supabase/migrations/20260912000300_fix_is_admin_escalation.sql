-- ==============================================================================
-- MIGRACIÓN: REEMPLAZO SEGURO DE is_admin() (SEC-04)
-- Fecha: 2026-09-12 00:03:00 UTC
-- Reemplaza is_admin() (vulnerable a escalada vía user_metadata) por un wrapper
-- de is_ccms_admin() (ya definida de forma segura, consultando public.profiles).
-- NO se redefine is_ccms_admin() aquí para no pisar su versión ya correcta.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_ccms_admin();
$$;
