/**
 * ==============================================================================
 * PILAR 4: GOBERNANZA DE RECURSOS & RATE LIMITING (SLIDING WINDOW)
 * Centro Comercial Mario Sánchez — ERP Inmobiliario
 * 
 * Previene ataques de fuerza bruta, abuso de cuotas y desbordamiento de costos.
 * ==============================================================================
 */

// Memoria volátil compartida para rate-limiting en runtime
const memoryStore = new Map();

/**
 * Aplica límite de peticiones usando algoritmo Sliding Window Counter
 * @param {string} key Identificador único (IP, userId, email)
 * @param {number} limit Límite máximo de peticiones permitidas en la ventana
 * @param {number} windowSeconds Duración de la ventana en segundos
 * @returns {{ allowed: boolean, remaining: number, resetAfterSec: number }}
 */
export function checkRateLimit(key, limit = 10, windowSeconds = 60) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  let record = memoryStore.get(key);
  if (!record || (now - record.startTime > windowMs)) {
    record = {
      startTime: now,
      count: 1
    };
    memoryStore.set(key, record);
    return {
      allowed: true,
      remaining: limit - 1,
      resetAfterSec: windowSeconds
    };
  }

  record.count += 1;
  const elapsed = now - record.startTime;
  const remaining = Math.max(0, limit - record.count);
  const resetAfterSec = Math.ceil((windowMs - elapsed) / 1000);

  if (record.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAfterSec
    };
  }

  return {
    allowed: true,
    remaining,
    resetAfterSec
  };
}

/**
 * Limpieza periódica de memoria para evitar memory leaks
 */
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now - record.startTime > 300000) { // 5 minutos sin actividad
      memoryStore.delete(key);
    }
  }
}, 60000);
if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}
