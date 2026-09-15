const {test}=require('node:test');
const assert=require('node:assert/strict');
const {database}=require('./helpers/postgres.cjs');
const orgA='a0000000-0000-0000-0000-000000000001',orgB='b0000000-0000-0000-0000-000000000001';
const director='10000000-0000-0000-0000-000000000001',auditor='10000000-0000-0000-0000-000000000002';
test('RLS isolation, explicit grants, revocation and protected identity execute in PostgreSQL',async t=>{
 const db=await database();
 try {
  await db.exec(`INSERT INTO public.organizations(id,name,slug) VALUES('${orgB}','Synthetic B','synthetic-b');
   INSERT INTO auth.users(id) VALUES('${director}'),('${auditor}');
   INSERT INTO public.profiles(id,role,organization_id) VALUES('${director}','org_director','${orgA}'),('${auditor}','fiscal_auditor','${orgA}');
   INSERT INTO public.organization_memberships(organization_id,user_id,role) VALUES('${orgA}','${director}','org_director'),('${orgA}','${auditor}','fiscal_auditor');
   INSERT INTO public.units(code,name,category,area_m2,base_rent_usd,organization_id) VALUES('TEST-A','Synthetic A','local',10,100,'${orgA}'),('TEST-B','Synthetic B','local',10,100,'${orgB}');`);
  const member=(await db.query('SELECT id FROM public.organization_memberships WHERE user_id=$1',[auditor])).rows[0].id;
  async function as(user){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('SET ROLE authenticated');}
  await t.test('director cannot read another organization',async()=>{
   await as(director);const r=await db.query('SELECT code FROM public.units');assert.deepEqual(r.rows.map(x=>x.code),['TEST-A']);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n,1);
  });
  await t.test('direct profile escalation and command receipt writes are denied',async()=>{
   await as(director);
   await assert.rejects(db.query("UPDATE public.profiles SET role='superadmin' WHERE id=$1",[director]),/permission denied/);
   await assert.rejects(db.query('DELETE FROM public.command_receipts'),/permission denied/);
  });
  await t.test('auditor gains explicitly authorized editing and deny overrides a template',async()=>{
   await as(auditor);
   assert.equal((await db.query("SELECT public.ccms_can($1,'expenses','draft') AS allowed",[orgA])).rows[0].allowed,false);
   await as(director);
   await db.query("SELECT public.set_member_permission($1,'expenses','draft',true,1,'Responsabilidad autorizada')",[member]);
   await as(auditor);
   assert.equal((await db.query("SELECT public.ccms_can($1,'expenses','draft') AS allowed",[orgA])).rows[0].allowed,true);
   await as(director);
   await db.query("SELECT public.set_member_permission($1,'ledger','read',false,2,'Revocación autorizada')",[member]);
   await as(auditor);
   assert.equal((await db.query("SELECT public.ccms_can($1,'ledger','read') AS allowed",[orgA])).rows[0].allowed,false);
  });
  await t.test('stale edits and self escalation fail',async()=>{
   await as(director);
   await assert.rejects(db.query("SELECT public.set_member_permission($1,'expenses','draft',false,1,'Cambio obsoleto')",[member]),/OPTIMISTIC_LOCK_CONFLICT/);
   await as(auditor);
   await assert.rejects(db.query("SELECT public.set_member_permission($1,'payments','approve',true,3,'Auto escalamiento')",[member]),/FORBIDDEN/);
  });
  await t.test('suspended membership immediately loses access despite profile role',async()=>{
   await db.exec('RESET ROLE');await db.query("UPDATE public.organization_memberships SET status='suspended' WHERE user_id=$1",[director]);
   await as(director);assert.equal((await db.query('SELECT count(*)::int AS n FROM public.units')).rows[0].n,0);
  });
 } finally {await db.close();}
});
