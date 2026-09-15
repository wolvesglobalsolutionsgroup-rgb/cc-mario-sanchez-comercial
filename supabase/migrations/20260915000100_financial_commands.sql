BEGIN;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES auth.users(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text;
UPDATE public.payments SET status=verification_status WHERE status IS NULL;
ALTER TABLE public.payments ALTER COLUMN status SET DEFAULT 'pendiente';
ALTER TABLE public.payments ALTER COLUMN verification_status SET DEFAULT 'pendiente';
CREATE TABLE public.processed_commands (
 organization_id uuid NOT NULL REFERENCES public.organizations(id), command_key uuid NOT NULL,
 payload_hash text NOT NULL, result jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,command_key)
);
CREATE TABLE public.payment_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 payment_id uuid NOT NULL REFERENCES public.payments(id), invoice_id uuid NOT NULL REFERENCES public.invoices(id),
 concept text NOT NULL CHECK(concept IN ('canon','condominio','otros','anticipo')),
 amount_usd numeric(16,2) NOT NULL CHECK(amount_usd>0), UNIQUE(payment_id,concept)
);
CREATE TABLE public.payment_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id),
 amount numeric(16,2) NOT NULL CHECK(amount>0), currency text NOT NULL,
 usd_equivalent numeric(16,2) NOT NULL, bcv_rate numeric(16,6) NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.journal_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 payment_id uuid NOT NULL REFERENCES public.payments(id),
 account text NOT NULL CHECK(account IN ('cash','receivable_canon','receivable_condominio','receivable_otros','customer_advance')),
 debit numeric(16,2) NOT NULL DEFAULT 0,credit numeric(16,2) NOT NULL DEFAULT 0,
 CHECK((debit>0 AND credit=0) OR (credit>0 AND debit=0)), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.financial_periods (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),period date NOT NULL,closed_at timestamptz,
 PRIMARY KEY(organization_id,period),CHECK(period=date_trunc('month',period)::date)
);
CREATE FUNCTION ccms_private.immutable_financial_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_RECORD'; END $$;
REVOKE ALL ON FUNCTION ccms_private.immutable_financial_row() FROM PUBLIC;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['processed_commands','payment_allocations','payment_receipts','journal_lines','financial_periods'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY finance_read ON public.%I FOR SELECT TO authenticated USING(public.ccms_can(organization_id,''ledger'',''read''))',t);
  IF t<>'financial_periods' THEN EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION ccms_private.immutable_financial_row()',t); END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.approve_payment_v2(payment_id uuid, expected_version integer, command_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
<<command>>
DECLARE p public.payments; i public.invoices; m public.organization_memberships; prior public.processed_commands;
 actor uuid:=auth.uid(); payload_hash text; result jsonb; receipt uuid;
 remaining numeric(16,2); applied numeric(16,2); credit numeric(16,2); total_applied numeric(16,2);
 concept text; charged numeric(16,2); allocated numeric(16,2);
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF expected_version IS NULL OR command_key IS NULL THEN RAISE EXCEPTION 'INVALID_PARAMETER'; END IF;
 SELECT * INTO p FROM public.payments WHERE id=payment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
 SELECT * INTO m FROM public.organization_memberships WHERE user_id=actor AND organization_id=p.organization_id FOR SHARE;
 IF NOT public.ccms_can(p.organization_id,'payments','approve',p.id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'AUTH_MFA_REQUIRED'; END IF;
 IF p.reported_by IS NULL OR p.reported_by=actor THEN RAISE EXCEPTION 'INDEPENDENT_APPROVER_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p.organization_id::text||command_key::text,0));
 payload_hash:=encode(sha256(convert_to(jsonb_build_object('payment_id',payment_id,'version',expected_version)::text,'UTF8')),'hex');
 SELECT * INTO prior FROM public.processed_commands c WHERE c.organization_id=p.organization_id AND c.command_key=approve_payment_v2.command_key;
 IF FOUND THEN
  IF prior.payload_hash<>payload_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN prior.result;
 END IF;
 IF p.version IS DISTINCT FROM expected_version THEN RAISE EXCEPTION 'OPTIMISTIC_LOCK_CONFLICT'; END IF;
 IF p.status<>'pendiente' THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE'; END IF;
 IF p.usd_equivalent<=0 OR p.amount_paid<=0 OR p.bcv_rate_applied<=0 OR p.eur_rate_applied<=0 THEN RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT_OR_RATE'; END IF;
 SELECT * INTO i FROM public.invoices WHERE id=p.invoice_id FOR UPDATE;
 IF NOT FOUND OR i.organization_id IS DISTINCT FROM p.organization_id THEN RAISE EXCEPTION 'CROSS_ORG_FORBIDDEN'; END IF;
 IF EXISTS(SELECT 1 FROM public.financial_periods f WHERE f.organization_id=p.organization_id AND f.period=date_trunc('month',p.payment_date)::date AND f.closed_at IS NOT NULL) THEN RAISE EXCEPTION 'PERIOD_CLOSED'; END IF;
 IF i.total_usd<0 OR i.rent_usd<0 OR i.condo_usd<0 OR i.total_usd<i.rent_usd+i.condo_usd THEN RAISE EXCEPTION 'INVALID_INVOICE'; END IF;
 -- Deterministic allocation: rent, condominium, other charges, then customer advance.
 remaining:=p.usd_equivalent;
 FOREACH concept IN ARRAY ARRAY['canon','condominio','otros'] LOOP
  charged:=CASE concept WHEN 'canon' THEN i.rent_usd WHEN 'condominio' THEN i.condo_usd ELSE i.total_usd-i.rent_usd-i.condo_usd END;
  SELECT coalesce(sum(a.amount_usd),0) INTO allocated FROM public.payment_allocations a WHERE a.invoice_id=i.id AND a.concept=command.concept;
  credit:=least(remaining,greatest(0,charged-allocated));
  IF credit>0 THEN
   INSERT INTO public.payment_allocations(organization_id,payment_id,invoice_id,concept,amount_usd) VALUES(p.organization_id,p.id,i.id,concept,credit);
   INSERT INTO public.journal_lines(organization_id,payment_id,account,credit) VALUES(p.organization_id,p.id,'receivable_'||concept,credit);
   remaining:=remaining-credit;
  END IF;
 END LOOP;
 IF remaining>0 THEN
  INSERT INTO public.payment_allocations(organization_id,payment_id,invoice_id,concept,amount_usd) VALUES(p.organization_id,p.id,i.id,'anticipo',remaining);
  INSERT INTO public.journal_lines(organization_id,payment_id,account,credit) VALUES(p.organization_id,p.id,'customer_advance',remaining);
 END IF;
 INSERT INTO public.journal_lines(organization_id,payment_id,account,debit) VALUES(p.organization_id,p.id,'cash',p.usd_equivalent);
 IF (SELECT sum(j.debit-j.credit) FROM public.journal_lines j WHERE j.payment_id=p.id)<>0 THEN RAISE EXCEPTION 'UNBALANCED_JOURNAL'; END IF;
 INSERT INTO public.payment_receipts(organization_id,payment_id,amount,currency,usd_equivalent,bcv_rate,actor_id)
 VALUES(p.organization_id,p.id,p.amount_paid,p.currency,p.usd_equivalent,p.bcv_rate_applied,actor) RETURNING id INTO receipt;
 UPDATE public.payments SET status='verificado',verification_status='verificado',version=version+1,verified_at=now(),verified_by=actor::text,updated_at=now() WHERE id=p.id;
 SELECT coalesce(sum(a.amount_usd),0) INTO total_applied FROM public.payment_allocations a WHERE a.invoice_id=i.id AND a.concept<>'anticipo';
 UPDATE public.invoices SET status=CASE WHEN total_applied>=i.total_usd THEN 'pagado' ELSE 'pendiente' END,
 paid_at=CASE WHEN total_applied>=i.total_usd THEN p.payment_date ELSE NULL END,updated_at=now() WHERE id=i.id;
 result:=jsonb_build_object('payment_id',p.id,'receipt_id',receipt,'version',p.version+1,'applied_usd',p.usd_equivalent-remaining,'advance_usd',remaining);
 INSERT INTO public.processed_commands(organization_id,command_key,payload_hash,result,actor_id) VALUES(p.organization_id,command_key,payload_hash,result,actor);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.approve_payment_v2(uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_v2(uuid,integer,uuid) TO authenticated;

CREATE FUNCTION public.current_capabilities(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.organization_memberships; output jsonb;
BEGIN
 SELECT * INTO m FROM public.organization_memberships WHERE user_id=auth.uid() AND organization_id=org AND status='active';
 IF NOT FOUND OR NOT public.has_ccms_organization(org) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT jsonb_agg(jsonb_build_object('module',p.module,'action',p.action,'allowed',public.ccms_can(org,p.module,p.action))) INTO output FROM public.permissions p;
 RETURN jsonb_build_object('organization_id',org,'membership_id',m.id,'version',m.policy_version,'capabilities',output,
 'overrides',(SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM public.membership_permission_overrides o WHERE o.membership_id=m.id));
END $$;
REVOKE ALL ON FUNCTION public.current_capabilities(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_capabilities(uuid) TO authenticated;
COMMIT;
