-- E02/E03: active membership is authority; legacy profile roles are not grants.
BEGIN;
CREATE SCHEMA IF NOT EXISTS ccms_private;
REVOKE ALL ON SCHEMA ccms_private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.organization_memberships ADD COLUMN IF NOT EXISTS policy_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.membership_permission_overrides
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'organization' CHECK(scope IN ('organization','assigned')),
  ADD COLUMN IF NOT EXISTS resource_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reason text;

CREATE TABLE public.permissions (
  module text NOT NULL, action text NOT NULL, sensitive boolean NOT NULL DEFAULT false,
  PRIMARY KEY(module,action)
);
CREATE TABLE public.role_permission_grants (
  role text NOT NULL, module text NOT NULL, action text NOT NULL,
  PRIMARY KEY(role,module,action), FOREIGN KEY(module,action) REFERENCES public.permissions(module,action)
);
CREATE TABLE public.access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id), target_id uuid NOT NULL,
  reason text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL, UNIQUE(organization_id,id)
);
CREATE TABLE public.organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
  value jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1
);
INSERT INTO public.permissions(module,action,sensitive)
SELECT m,a,a IN ('approve','reverse','manage') FROM unnest(ARRAY[
  'units','tenants','contracts','invoices','payments','expenses','ledger','tickets',
  'succession','audit','permissions','settings','ai','channels','properties'
]) m CROSS JOIN unnest(ARRAY['read','draft','approve','export','reverse','manage']) a;
-- Explicit grants; never interpret wildcard 'manage' from the obsolete catalog.
INSERT INTO public.role_permission_grants SELECT 'org_director',module,action FROM public.permissions;
INSERT INTO public.role_permission_grants SELECT r,module,action
FROM unnest(ARRAY['org_admin','accountant']) r CROSS JOIN public.permissions
WHERE module IN ('units','tenants','contracts','invoices','payments','expenses','ledger','tickets','properties')
AND action IN ('read','draft','export');
INSERT INTO public.role_permission_grants SELECT 'fiscal_auditor',module,action FROM public.permissions
WHERE module IN ('invoices','payments','expenses','ledger','audit') AND action IN ('read','export');
INSERT INTO public.role_permission_grants VALUES
('operations_manager','units','read'),('operations_manager','tickets','read'),('operations_manager','tickets','draft');
INSERT INTO public.role_permission_grants SELECT r,'ai','read' FROM unnest(ARRAY[
'org_admin','accountant','fiscal_auditor','operations_manager','tenant_user','heir_viewer']) r;

CREATE FUNCTION ccms_private.can_actor(actor uuid, org uuid, mod text, act text, resource uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE member public.organization_memberships; ov public.membership_permission_overrides;
BEGIN
  SELECT m.* INTO member FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id
  WHERE m.user_id=actor AND m.organization_id=org AND m.status='active' AND o.status IN ('activo','demo');
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO ov FROM public.membership_permission_overrides
  WHERE membership_id=member.id AND module=mod AND action=act AND (expires_at IS NULL OR expires_at>now());
  IF FOUND THEN
    RETURN ov.granted AND (ov.scope='organization' OR resource=ANY(ov.resource_ids));
  END IF;
  RETURN EXISTS(SELECT 1 FROM public.role_permission_grants WHERE role=member.role AND module=mod AND action=act);
END $$;
REVOKE ALL ON FUNCTION ccms_private.can_actor(uuid,uuid,text,text,uuid) FROM PUBLIC;

CREATE FUNCTION public.ccms_can(org uuid, mod text, act text, resource uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT ccms_private.can_actor(auth.uid(),org,mod,act,resource)
$$;
REVOKE ALL ON FUNCTION public.ccms_can(uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ccms_can(uuid,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_ccms_organization(target_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id
 WHERE m.user_id=auth.uid() AND m.organization_id=target_org_id AND m.status='active' AND o.status IN ('activo','demo'))
$$;

-- Remove all accumulated policies on application-owned tables before replacing them.
DO $$ DECLARE p record; t text; mod text;
BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN (
 'units','tenants','contracts','invoices','payments','condo_expenses','transactions','chart_of_accounts',
 'service_tickets','audit_logs','command_receipts','properties','access_audit','organization_settings',
 'profiles','organizations','organization_memberships','membership_permission_overrides','role_permissions',
 'platform_staff','user_tenants','app_settings','alerts','permissions','role_permission_grants')
 LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
 FOR t,mod IN SELECT * FROM (VALUES
 ('units','units'),('tenants','tenants'),('contracts','contracts'),('invoices','invoices'),
 ('payments','payments'),('condo_expenses','expenses'),('transactions','ledger'),('chart_of_accounts','ledger'),
 ('service_tickets','tickets'),('audit_logs','audit'),('command_receipts','audit'),('properties','properties'),('access_audit','audit')
 ) x(t,m)
 LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
   EXECUTE format('CREATE POLICY authorized_read ON public.%I FOR SELECT TO authenticated USING (public.ccms_can(organization_id,%L,''read'',id))',t,mod);
 END LOOP;
END $$;

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles, public.organizations, public.organization_memberships,
 public.membership_permission_overrides,public.role_permissions,public.platform_staff,
 public.user_tenants,public.app_settings,public.alerts,public.permissions,public.role_permission_grants,
 public.organization_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profiles,public.organizations,public.organization_memberships,
 public.membership_permission_overrides,public.platform_staff,public.user_tenants,
 public.permissions,public.role_permission_grants,public.organization_settings TO authenticated;
CREATE POLICY own_profile ON public.profiles FOR SELECT TO authenticated USING(id=(select auth.uid()));
CREATE POLICY member_organization ON public.organizations FOR SELECT TO authenticated USING(public.has_ccms_organization(id));
CREATE POLICY own_membership ON public.organization_memberships FOR SELECT TO authenticated
 USING(user_id=(select auth.uid()) OR public.ccms_can(organization_id,'permissions','read'));
CREATE POLICY own_overrides ON public.membership_permission_overrides FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.organization_memberships m WHERE m.id=membership_id));
CREATE POLICY own_platform ON public.platform_staff FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY own_tenant_link ON public.user_tenants FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY permission_catalog ON public.permissions FOR SELECT TO authenticated USING(true);
CREATE POLICY role_catalog ON public.role_permission_grants FOR SELECT TO authenticated USING(true);
CREATE POLICY settings_read ON public.organization_settings FOR SELECT TO authenticated USING(public.ccms_can(organization_id,'settings','read'));

-- Own records still require an active organizational membership.
CREATE POLICY own_tenant ON public.tenants FOR SELECT TO authenticated USING(
 public.has_ccms_organization(organization_id) AND public.has_ccms_tenant(id));
CREATE POLICY own_contract ON public.contracts FOR SELECT TO authenticated USING(
 public.has_ccms_organization(organization_id) AND public.has_ccms_tenant(tenant_id));
CREATE POLICY own_invoice ON public.invoices FOR SELECT TO authenticated USING(
 public.has_ccms_organization(organization_id) AND EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=contract_id AND public.has_ccms_tenant(c.tenant_id)));
CREATE POLICY own_payment ON public.payments FOR SELECT TO authenticated USING(
 public.has_ccms_organization(organization_id) AND EXISTS(SELECT 1 FROM public.invoices i JOIN public.contracts c ON c.id=i.contract_id WHERE i.id=invoice_id AND public.has_ccms_tenant(c.tenant_id)));
CREATE POLICY own_ticket ON public.service_tickets FOR SELECT TO authenticated USING(
 public.has_ccms_organization(organization_id) AND public.has_ccms_tenant(tenant_id));

CREATE FUNCTION public.set_member_permission(target uuid, mod text, act text, allow_access boolean,
 expected_version integer, change_reason text, scope_type text DEFAULT 'organization', resources uuid[] DEFAULT '{}', valid_until timestamptz DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.organization_memberships; old_state jsonb; actor uuid:=auth.uid();
BEGIN
 SELECT * INTO m FROM public.organization_memberships WHERE id=target FOR UPDATE;
 IF NOT FOUND OR actor IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF actor=m.user_id OR NOT public.ccms_can(m.organization_id,'permissions','manage') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF mod='permissions' OR NOT EXISTS(SELECT 1 FROM public.permissions WHERE module=mod AND action=act)
 THEN RAISE EXCEPTION 'NON_DELEGABLE_PERMISSION'; END IF;
 IF scope_type NOT IN ('organization','assigned') OR (scope_type='assigned' AND cardinality(resources)=0)
 OR (valid_until IS NOT NULL AND valid_until<=now()) OR length(trim(change_reason))<5
 OR change_reason IS NULL THEN RAISE EXCEPTION 'INVALID_PARAMETER'; END IF;
 IF NOT public.ccms_can(m.organization_id,mod,act) THEN RAISE EXCEPTION 'OUTSIDE_DELEGABLE_AUTHORITY'; END IF;
 IF expected_version IS DISTINCT FROM m.policy_version THEN RAISE EXCEPTION 'OPTIMISTIC_LOCK_CONFLICT'; END IF;
 SELECT to_jsonb(o) INTO old_state FROM public.membership_permission_overrides o WHERE membership_id=target AND module=mod AND action=act;
 INSERT INTO public.membership_permission_overrides(membership_id,module,action,granted,scope,resource_ids,expires_at,granted_by,reason)
 VALUES(target,mod,act,allow_access,scope_type,resources,valid_until,actor,change_reason)
 ON CONFLICT(membership_id,module,action) DO UPDATE SET granted=excluded.granted,scope=excluded.scope,
 resource_ids=excluded.resource_ids,expires_at=excluded.expires_at,granted_by=actor,reason=change_reason,updated_at=now();
 UPDATE public.organization_memberships SET policy_version=policy_version+1 WHERE id=target;
 INSERT INTO public.access_audit(organization_id,actor_id,target_id,reason,before_state,after_state)
 VALUES(m.organization_id,actor,target,change_reason,coalesce(old_state,'{}'),jsonb_build_object('module',mod,'action',act,'granted',allow_access,'scope',scope_type,'resources',resources,'expires_at',valid_until));
 RETURN m.policy_version+1;
END $$;
REVOKE ALL ON FUNCTION public.set_member_permission(uuid,text,text,boolean,integer,text,text,uuid[],timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_member_permission(uuid,text,text,boolean,integer,text,text,uuid[],timestamptz) TO authenticated;

-- Unsafe legacy financial RPC is unavailable until the replacement command is installed.
REVOKE ALL ON FUNCTION public.approve_payment_transaction(varchar,varchar,varchar,integer,varchar) FROM PUBLIC,anon,authenticated;
COMMIT;
