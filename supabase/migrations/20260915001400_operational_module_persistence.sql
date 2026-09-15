-- Operational persistence for modules previously kept only in the client snapshot.
CREATE TABLE IF NOT EXISTS public.special_agreements (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  unit_code text,
  type text NOT NULL,
  description text NOT NULL,
  total_amount_usd numeric(14,2) NOT NULL DEFAULT 0,
  monthly_discount_usd numeric(14,2) NOT NULL DEFAULT 0,
  months_count integer NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  proof_file text,
  status text NOT NULL DEFAULT 'activo',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.receiving_accounts (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  bank text NOT NULL,
  type text NOT NULL,
  account_number text,
  phone text,
  email text,
  wallet_address text,
  binance_pay_id text,
  beneficiary text,
  rif text,
  icon text,
  badge text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  assigned_tenants jsonb NOT NULL DEFAULT '["all"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.activos_fijos (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text,
  description text,
  acquisition_date date,
  acquisition_cost_usd numeric(14,2),
  current_value_usd numeric(14,2),
  status text NOT NULL DEFAULT 'activo',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.consumibles (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  unit text,
  stock_current numeric(14,3) NOT NULL DEFAULT 0,
  stock_min numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost_usd numeric(14,2),
  status text NOT NULL DEFAULT 'ok',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS public.kardex_movimientos (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  item_code text NOT NULL,
  type text NOT NULL CHECK (type IN ('ENTRADA','SALIDA')),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  destination text,
  responsible text,
  document text,
  timestamp timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['special_agreements','receiving_accounts','activos_fijos','consumibles','kardex_movimientos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON public.%I FOR SELECT TO authenticated USING (public.has_ccms_organization(organization_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_manage ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_manage ON public.%I FOR ALL TO authenticated USING (public.ccms_can(organization_id, ''properties'', ''manage'', property_id)) WITH CHECK (public.ccms_can(organization_id, ''properties'', ''manage'', property_id))', t, t);
  END LOOP;
END $$;
