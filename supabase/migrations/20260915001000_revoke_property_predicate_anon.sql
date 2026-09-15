-- Property membership predicate is used by RLS and must never be callable
-- anonymously through PostgREST.
REVOKE EXECUTE ON FUNCTION public.has_ccms_property(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_ccms_property(uuid) TO authenticated;
