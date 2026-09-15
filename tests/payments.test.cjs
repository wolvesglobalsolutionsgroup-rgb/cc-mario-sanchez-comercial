const {test}=require('node:test');
const assert=require('node:assert/strict');
const {database}=require('./helpers/postgres.cjs');
const O='a0000000-0000-0000-0000-000000000001',A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002';
test('financial command creates a balanced receipt and preserves idempotency',async t=>{
 const db=await database();
 try{
  await db.exec(`INSERT INTO auth.users(id) VALUES('${A}'),('${B}');
   INSERT INTO public.profiles(id,role,organization_id) VALUES('${A}','org_director','${O}'),('${B}','accountant','${O}');
   INSERT INTO public.organization_memberships(user_id,organization_id,role) VALUES('${A}','${O}','org_director'),('${B}','${O}','accountant');`);
  const unit=(await db.query("INSERT INTO units(code,name,category,area_m2,base_rent_usd,organization_id) VALUES('UNIT','Synthetic','local',10,80,$1) RETURNING id",[O])).rows[0].id;
  const tenant=(await db.query("INSERT INTO tenants(rif,business_name,legal_rep_name,legal_rep_dni,email,phone,whatsapp,organization_id) VALUES('TEST','Synthetic','Test','TEST','test@example.invalid','TEST','TEST',$1) RETURNING id",[O])).rows[0].id;
  const contract=(await db.query("INSERT INTO contracts(contract_number,tenant_id,unit_id,start_date,end_date,rent_amount_usd,deposit_amount_usd,organization_id) VALUES('TEST',$1,$2,'2026-01-01','2026-12-31',80,0,$3) RETURNING id",[tenant,unit,O])).rows[0].id;
  const invoice=(await db.query("INSERT INTO invoices(invoice_number,contract_id,period_month,period_year,rent_usd,condo_usd,total_usd,bcv_exchange_rate,total_bs,total_eur,total_usdt,due_date,organization_id) VALUES('TEST',$1,9,2026,80,20,100,40,4000,90,100,'2026-09-30',$2) RETURNING id",[contract,O])).rows[0].id;
  async function payment(amount,reporter=B){
   await db.exec('RESET ROLE');
   return (await db.query("INSERT INTO payments(invoice_id,payment_date,payment_method,reference_number,amount_paid,currency,bcv_rate_applied,eur_rate_applied,usd_equivalent,organization_id,reported_by) VALUES($1,'2026-09-14','Test','TEST',$2,'USD',40,45,$2,$3,$4) RETURNING id",[invoice,amount,O,reporter])).rows[0].id;
  }
  async function approve(id,key,version=1){
   await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[A]);
   await db.exec(`SELECT set_config('request.jwt.claims','{"aal":"aal2"}',false); SET ROLE authenticated;`);
   return (await db.query('SELECT public.approve_payment_v2($1,$2,$3) AS result',[id,version,key])).rows[0].result;
  }
  const p=await payment('60.00'), key='20000000-0000-0000-0000-000000000001';
  await t.test('partial payment leaves invoice pending and journal balanced',async()=>{
   const result=await approve(p,key);assert.equal(result.applied_usd,60);
   assert.equal((await db.query('SELECT status FROM invoices WHERE id=$1',[invoice])).rows[0].status,'pendiente');
   assert.equal(Number((await db.query('SELECT sum(debit-credit) AS balance FROM journal_lines')).rows[0].balance),0);
  });
  await t.test('retry returns same receipt without creating effects',async()=>{
   const one=await approve(p,key),two=await approve(p,key);assert.deepEqual(one,two);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM payment_receipts')).rows[0].n,1);
   await assert.rejects(approve(p,key,2),/IDEMPOTENCY_CONFLICT/);
  });
  await t.test('overpayment settles remaining charges and records advance',async()=>{
   const p2=await payment('50');const r=await approve(p2,'20000000-0000-0000-0000-000000000002');
   assert.equal(r.advance_usd,10);
   assert.equal((await db.query('SELECT status FROM invoices WHERE id=$1',[invoice])).rows[0].status,'pagado');
   assert.equal(Number((await db.query('SELECT sum(debit-credit) AS balance FROM journal_lines')).rows[0].balance),0);
  });
  await t.test('maker cannot approve own report and no receipt is created',async()=>{
   const own=await payment('10',A);
   await assert.rejects(approve(own,'20000000-0000-0000-0000-000000000003'),/INDEPENDENT_APPROVER_REQUIRED/);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM payment_receipts')).rows[0].n,2);
  });
  await t.test('ledger cannot be edited directly by client',async()=>{
   await assert.rejects(db.query('UPDATE journal_lines SET debit=999'),/permission denied/);
  });
 }finally{await db.close();}
});
