const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
async function database() {
  const db = new PGlite();
  // Only Supabase platform primitives and the unavailable UUID extension are supplied.
  // All application tables, functions, policies and constraints come from migrations.
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT current_setting('request.jwt.claim.role', true) $$;
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid(),auth.role() TO anon, authenticated;
  `);
  const dir=path.resolve(__dirname,'../../supabase/migrations');
  try {
    for (const file of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) {
      const sql=fs.readFileSync(path.join(dir,file),'utf8').replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi,'');
      try { await db.exec(sql); } catch(e) { throw new Error(`${file}: ${e.message}`); }
    }
    return db;
  } catch(e) { await db.close(); throw e; }
}
module.exports={database};
