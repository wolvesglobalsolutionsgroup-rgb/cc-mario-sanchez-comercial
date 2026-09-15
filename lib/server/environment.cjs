'use strict';
function environment(env = process.env) {
  const name = env.APP_ENV;
  if (!['production', 'staging', 'demo', 'development'].includes(name)) throw new Error('APP_ENV_REQUIRED');
  const url = new URL(env.SUPABASE_URL);
  const origin = new URL(env.APP_ORIGIN);
  const ref = env.SUPABASE_EXPECTED_PROJECT_REF;
  if (!ref || url.hostname !== `${ref}.supabase.co` || url.protocol !== 'https:') throw new Error('PROJECT_MISMATCH');
  if (origin.protocol !== 'https:' && name !== 'development') throw new Error('HTTPS_REQUIRED');
  if (!env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('PUBLIC_KEY_REQUIRED');
  if (env.DEMO_ENABLED === 'true' && name !== 'demo') throw new Error('DEMO_ENVIRONMENT_MISMATCH');
  return { name, supabaseUrl: url.origin, origin: origin.origin, anonKey: env.SUPABASE_ANON_KEY, ref };
}
module.exports = { environment };
