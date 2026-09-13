/**
 * Inicializa window.supabaseClient cargando el SDK oficial desde CDN
 * y la configuración pública desde /api/config. Debe cargarse ANTES
 * de auth-guard.js, login.js y supabase-client.js.
 */
(async function initSupabaseClient() {
  try {
    // Cargar el SDK de Supabase JS (UMD) si no está ya presente
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('No se pudo cargar el SDK de Supabase.'));
        document.head.appendChild(script);
      });
    }

    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('No se pudo obtener la configuración de Supabase desde /api/config.');
    const { supabaseUrl, supabaseAnonKey } = await res.json();

    window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    console.info('[SUPABASE] Cliente inicializado correctamente.');
    document.dispatchEvent(new CustomEvent('supabase:ready'));
  } catch (err) {
    console.error('[SUPABASE] No se pudo inicializar el cliente:', err);
    window.supabaseClient = null;
    document.dispatchEvent(new CustomEvent('supabase:failed', { detail: err }));
  }
})();
