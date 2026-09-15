const {test}=require('node:test');
const assert=require('node:assert/strict');
const {database}=require('./helpers/postgres.cjs');
test('all application migrations execute on a clean PostgreSQL database', async()=>{
  const db=await database();
  try { assert.ok((await db.query("SELECT to_regclass('public.organization_memberships') as relation")).rows[0].relation); }
  finally {await db.close();}
});
