/**
 * ==============================================================================
 * PILAR 4: GESTOR RESILIENTE DE PETICIONES EXTERNAS & INFERENCIA
 * Centro Comercial Mario Sánchez — ERP Inmobiliario
 * 
 * Garantías:
 * 1. Timeouts forzados de 15 a 30 segundos mediante AbortController (sin hilos colgados).
 * 2. Reintentos automáticos con Exponential Backoff y jitter (máximo 3 intentos).
 * 3. Control estricto de parámetros computacionales (max_tokens en APIs de IA).
 * ==============================================================================
 */

async function fetchWithResilience(url, options = {}, config = {}) {
  const {
    timeoutMs = 20000,
    maxRetries = 3,
    baseBackoffMs = 800,
    maxTokens = 2048
  } = config;

  // Si la petición contiene body JSON con prompt o mensajes, asegurar max_tokens estricto
  if (options.body && typeof options.body === 'string') {
    try {
      const parsed = JSON.parse(options.body);
      if (parsed && typeof parsed === 'object') {
        if (!parsed.max_tokens || parsed.max_tokens > maxTokens) {
          parsed.max_tokens = maxTokens;
          options.body = JSON.stringify(parsed);
        }
      }
    } catch (e) {}
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const mergedOptions = Object.assign({}, options, {
      signal: controller.signal
    });

    try {
      const response = await fetch(url, mergedOptions);
      clearTimeout(timeoutId);

      // Si el servidor responde 429 (Too Many Requests) o 5xx, reintentar con backoff
      if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
        if (attempt >= maxRetries) {
          return response;
        }
        const delay = baseBackoffMs * Math.pow(2, attempt - 1) + Math.random() * 200;
        await new Promise(res => setTimeout(res, delay));
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      if (attempt >= maxRetries) {
        break;
      }

      // Backoff antes de reintentar
      const delay = baseBackoffMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw new Error(`[RESILIENCE TIMEOUT / RETRIES EXHAUSTED] Fallaron los ${maxRetries} intentos hacia ${url}. Último error: ${lastError ? lastError.message : 'Timeout'}`);
}

module.exports = {
  fetchWithResilience
};
