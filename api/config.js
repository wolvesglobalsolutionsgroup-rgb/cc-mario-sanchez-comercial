/**
 * ==============================================================================
 * VERCEL SERVERLESS FUNCTION: /api/config
 * Expone SOLO configuración pública (URL + ANON KEY) para inicializar el
 * cliente Supabase en el navegador. La SERVICE_ROLE_KEY nunca se expone aquí.
 * ==============================================================================
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase no está configurado en las variables de entorno del servidor.' });
  }

  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
};
