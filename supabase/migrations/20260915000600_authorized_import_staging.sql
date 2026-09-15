-- Authorized source import staging. Records stay pending until an authorized
-- reviewer validates identifiers, dates and contractual relationships.
CREATE TABLE IF NOT EXISTS public.authorized_import_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE RESTRICT,
  source_name text NOT NULL,
  source_sheet text NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  source_record_key text NOT NULL,
  source_hash text NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('lease_bundle','data_quality_exception')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending_validation'
    CHECK (status IN ('pending_validation','approved','rejected','imported')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (organization_id, source_name, source_sheet, source_record_key)
);

CREATE INDEX IF NOT EXISTS idx_authorized_import_staging_status
  ON public.authorized_import_staging (organization_id, status);

ALTER TABLE public.authorized_import_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authorized_import_staging_read ON public.authorized_import_staging;
CREATE POLICY authorized_import_staging_read
  ON public.authorized_import_staging FOR SELECT TO authenticated
  USING (public.has_ccms_organization(organization_id));

DROP POLICY IF EXISTS authorized_import_staging_manage ON public.authorized_import_staging;
CREATE POLICY authorized_import_staging_manage
  ON public.authorized_import_staging FOR ALL TO authenticated
  USING (public.ccms_can(organization_id, 'properties', 'manage', property_id))
  WITH CHECK (public.ccms_can(organization_id, 'properties', 'manage', property_id));
