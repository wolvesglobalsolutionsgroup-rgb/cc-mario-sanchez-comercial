ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS marketplace_opt_in boolean NOT NULL DEFAULT false;
UPDATE public.organizations
SET marketplace_opt_in = COALESCE((features->>'marketplace_opt_in')::boolean, false)
WHERE features ? 'marketplace_opt_in';

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  public_name text NOT NULL,
  city text NOT NULL,
  category text NOT NULL,
  area_m2 numeric(10,2) NOT NULL CHECK (area_m2 > 0),
  rent_min_usd numeric(12,2) CHECK (rent_min_usd IS NULL OR rent_min_usd >= 0),
  rent_max_usd numeric(12,2) CHECK (rent_max_usd IS NULL OR rent_max_usd >= rent_min_usd),
  description text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','published','archived')),
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text,now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text,now()),
  UNIQUE (organization_id, unit_id)
);
CREATE TABLE IF NOT EXISTS public.marketplace_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text,
  consent_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed','discarded')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text,now())
);
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_listing_manage ON public.marketplace_listings;
CREATE POLICY marketplace_listing_manage ON public.marketplace_listings FOR ALL TO authenticated
USING (public.ccms_can(organization_id,'properties','manage',property_id))
WITH CHECK (public.ccms_can(organization_id,'properties','manage',property_id));
DROP POLICY IF EXISTS marketplace_lead_read ON public.marketplace_leads;
CREATE POLICY marketplace_lead_read ON public.marketplace_leads FOR SELECT TO authenticated
USING (public.ccms_can(organization_id,'properties','read'));
CREATE OR REPLACE VIEW public.marketplace_public_listings
WITH (security_invoker = true) AS
SELECT l.id, l.public_name, l.city, l.category, l.area_m2, l.rent_min_usd,
       l.rent_max_usd, l.description, l.photos, l.published_at
FROM public.marketplace_listings l
JOIN public.organizations o ON o.id=l.organization_id
WHERE l.status='published' AND o.marketplace_opt_in=true;
