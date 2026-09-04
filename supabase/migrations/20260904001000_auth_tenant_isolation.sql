-- CCEMS: autenticación, relación usuario-inquilino y RLS por mínimo privilegio.
-- Aplicar después de 20260904000340_init_ccms_erp.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'tenant' check (role in ('admin', 'tenant')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_tenants (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists user_tenants_tenant_id_idx on public.user_tenants(tenant_id);

alter table public.profiles enable row level security;
alter table public.user_tenants enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.is_ccms_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.has_ccms_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_tenants
    where user_id = (select auth.uid()) and tenant_id = target_tenant_id
  );
$$;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using ((select auth.uid()) = id or public.is_ccms_admin());

drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());

drop policy if exists "user tenants self read" on public.user_tenants;
create policy "user tenants self read" on public.user_tenants
  for select using ((select auth.uid()) = user_id or public.is_ccms_admin());

drop policy if exists "user tenants admin write" on public.user_tenants;
create policy "user tenants admin write" on public.user_tenants
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());

drop policy if exists "app settings admin" on public.app_settings;
create policy "app settings admin" on public.app_settings
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());

-- Reemplaza las políticas amplias que trataban a todo authenticated como admin.
drop policy if exists "Admin total chart_of_accounts" on public.chart_of_accounts;
create policy "Admin total chart_of_accounts" on public.chart_of_accounts
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());

drop policy if exists "Admin total units" on public.units;
create policy "Admin total units" on public.units
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());

drop policy if exists "Admin total tenants" on public.tenants;
create policy "Admin total tenants" on public.tenants
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());
drop policy if exists "Tenant own tenant" on public.tenants;
create policy "Tenant own tenant" on public.tenants
  for select using (public.has_ccms_tenant(id));

drop policy if exists "Admin total contracts" on public.contracts;
create policy "Admin total contracts" on public.contracts
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());
drop policy if exists "Tenant own contracts" on public.contracts;
create policy "Tenant own contracts" on public.contracts
  for select using (public.has_ccms_tenant(tenant_id));

drop policy if exists "Admin total condo_expenses" on public.condo_expenses;
create policy "Admin total condo_expenses" on public.condo_expenses
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());

drop policy if exists "Admin total invoices" on public.invoices;
create policy "Admin total invoices" on public.invoices
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());
drop policy if exists "Tenant own invoices" on public.invoices;
create policy "Tenant own invoices" on public.invoices
  for select using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_id and public.has_ccms_tenant(c.tenant_id)
    )
  );

drop policy if exists "Admin total payments" on public.payments;
create policy "Admin total payments" on public.payments
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());
drop policy if exists "Tenant own payments" on public.payments;
create policy "Tenant own payments" on public.payments
  for select using (
    exists (
      select 1 from public.invoices i
      join public.contracts c on c.id = i.contract_id
      where i.id = invoice_id and public.has_ccms_tenant(c.tenant_id)
    )
  );

drop policy if exists "Admin total transactions" on public.transactions;
create policy "Admin total transactions" on public.transactions
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());

drop policy if exists "Admin total alerts" on public.alerts;
create policy "Admin total alerts" on public.alerts
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());
drop policy if exists "Tenant own alerts" on public.alerts;
create policy "Tenant own alerts" on public.alerts
  for select using (tenant_id is not null and public.has_ccms_tenant(tenant_id));

drop policy if exists "Admin total audit_logs" on public.audit_logs;
create policy "Admin total audit_logs" on public.audit_logs
  for all using (public.is_ccms_admin()) with check (public.is_ccms_admin());
