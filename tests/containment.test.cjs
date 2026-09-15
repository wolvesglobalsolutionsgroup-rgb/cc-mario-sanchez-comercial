const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
process.env.GEMINI_API_KEY = 'synthetic-test-key';
process.env.SUPABASE_URL = 'https://production-test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'public-anon-test';
process.env.SUPABASE_EXPECTED_PROJECT_REF = 'production-test';
process.env.APP_ENV = 'production';
process.env.APP_ORIGIN = 'https://erp.example.test';
const config = require('../api/config.js');
const gemini = require('../api/gemini.js');
function response() { return { setHeader(){}, status(s){this.code=s;return this;}, json(v){this.body=v;return this;},end(){} }; }
test('public config never issues an authentication token', async () => {
  const res=response(); await config({method:'GET',headers:{}},res);
  assert.equal(res.code,200); assert.equal(res.body.demoToken,undefined);
});
test('public-key signed demo tokens are rejected before network access', async () => {
  const payload=Buffer.from(JSON.stringify({sub:'visitor',role:'demo'})).toString('base64url');
  const sig=crypto.createHmac('sha256',process.env.SUPABASE_ANON_KEY).update(payload).digest('base64url');
  const res=response(); await gemini({method:'POST',headers:{authorization:`Bearer demo.${payload}.${sig}`},body:{}},res);
  assert.equal(res.code,401);
});
test('production ignores legacy cache and synthetic fixture', () => {
  const oldData=JSON.stringify({units:[{id:'private-legacy'}]});
  const storage=new Map([['ccms_inmobiliario_db_v1',oldData],['CCMS_FORCE_DEMO','true']]);
  const sandbox={console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},CCMS_DEMO_MODE:false,CCMS_SYNTHETIC_FIXTURES:{full_dataset:{units:[{id:'synthetic'}]}}};
  sandbox.window=sandbox; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('../gestion/js/supabase-client.js'),'utf8'),sandbox);
  assert.equal(sandbox.dbService.getUnits().length,0);
  assert.equal(storage.get('ccms_inmobiliario_db_v1'),oldData,'do not destroy historical cache during containment');
  assert.throws(()=>sandbox.dbService.saveData({units:[]}),/REMOTE_PERSISTENCE_REQUIRED/);
});
