/**
 * CCMS - Keep-Alive & Liveness Ping
 * Ejecuta una consulta ligera a Supabase Cloud cada 3 días
 * para evitar que el Free Tier pause la base de datos por inactividad.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ 
      ok: false, 
      error: 'Variables SUPABASE_URL o SUPABASE_ANON_KEY no configuradas' 
    });
  }

  try {
    const pingStart = Date.now();
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/organizations?select=id&limit=1`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    const latencyMs = Date.now() - pingStart;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase respondió HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return res.status(200).json({
      ok: true,
      service: 'CCMS Supabase Keep-Alive',
      timestamp: new Date().toISOString(),
      latencyMs,
      activeRows: Array.isArray(data) ? data.length : 0,
      message: 'Ping a Supabase Cloud exitoso. Base de datos activa y en línea.'
    });
  } catch (err) {
    console.error('[KEEP-ALIVE] Error en ping a Supabase:', err);
    return res.status(500).json({
      ok: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};
