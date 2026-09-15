BEGIN;

-- Un cliente SaaS puede administrar varios inmuebles. Cada unidad debe quedar
-- vinculada a uno, sin perder el aislamiento existente por organización.
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE RESTRICT;

INSERT INTO public.properties (organization_id, name)
SELECT o.id, 'Inmueble principal'
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.properties p WHERE p.organization_id = o.id
);

UPDATE public.units u
SET property_id = p.id
FROM public.properties p
WHERE u.organization_id = p.organization_id AND u.property_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);

CREATE TABLE IF NOT EXISTS public.property_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_property_memberships_user ON public.property_memberships(user_id, status);

ALTER TABLE public.property_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_memberships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.property_memberships TO authenticated;

CREATE OR REPLACE FUNCTION public.has_ccms_property(target_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties p
    JOIN public.organization_memberships om ON om.organization_id=p.organization_id
    WHERE p.id=target_property_id AND om.user_id=auth.uid() AND om.status='active'
      AND (NOT EXISTS (SELECT 1 FROM public.property_memberships pm WHERE pm.property_id=p.id AND pm.status='active')
           OR EXISTS (SELECT 1 FROM public.property_memberships pm WHERE pm.property_id=p.id AND pm.user_id=auth.uid() AND pm.status='active'))
  )
$$;
REVOKE ALL ON FUNCTION public.has_ccms_property(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_ccms_property(uuid) TO authenticated;

CREATE POLICY property_membership_read ON public.property_memberships
  FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.ccms_can((SELECT organization_id FROM public.properties WHERE id=property_id),'properties','manage',property_id));

COMMIT;
