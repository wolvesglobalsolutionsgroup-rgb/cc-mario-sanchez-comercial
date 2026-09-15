BEGIN;

-- Esta rutina solo sirve para tareas administrativas de migración. Nunca debe
-- poder invocarse desde el API REST por un usuario autenticado.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

COMMIT;
