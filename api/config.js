/**
 * ==============================================================================
 * VERCEL SERVERLESS FUNCTION: /api/config
 * Expone SOLO configuración pública (URL + ANON KEY) para inicializar el
 * cliente Supabase en el navegador. La SERVICE_ROLE_KEY nunca se expone aquí.
 * ==============================================================================
 */

const { environment } = require('../lib/server/environment.cjs');
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no admitido.' });
  let config;
  try { config = environment(); } catch (_) {
    return res.status(503).json({ error: 'El entorno requiere configuración antes de iniciar sesión.' });
  }

  return res.status(200).json({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.anonKey,
    environment: config.name
  });
};
