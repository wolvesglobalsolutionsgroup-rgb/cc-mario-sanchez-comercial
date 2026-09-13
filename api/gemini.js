/**
 * ==============================================================================
 * VERCEL SERVERLESS FUNCTION: /api/gemini
 * Centro Comercial Mario Sánchez — Asistente IA Inmobiliario, Fiscal & Legal
 * 
 * Proxy seguro para Google Gemini API.
 * Protege la API Key en el servidor, aplica Rate Limiting estricto por IP,
 * valida sanitización de entradas, timeout defensivo y tolerancia a fallos 503.
 * ==============================================================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { checkRateLimit } = require('./rate-limit.js');

// Auto-cargar .env local si no están cargadas las variables por el orquestador
if (!process.env.GEMINI_API_KEY) {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim();
          if (!process.env[k]) process.env[k] = v;
        }
      }
    }
  } catch (_) {}
}

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-2.5-pro'];
const RATE_LIMIT_MAX = parseInt(process.env.GEMINI_RATE_LIMIT_PER_MIN || '15', 10);
const TIMEOUT_MS = parseInt(process.env.EXTERNAL_API_TIMEOUT_MS || '15000', 10);

function redactSecrets(text, keyToRedact) {
  if (!text) return '';
  let cleaned = String(text)
    .replace(/AQ\.[A-Za-z0-9_-]+/g, '[REDACTED_GEMINI_KEY]')
    .replace(/AIzaSy[A-Za-z0-9_-]+/g, '[REDACTED_GOOGLE_KEY]');
  if (keyToRedact && keyToRedact.length > 5) {
    cleaned = cleaned.split(keyToRedact).join('[REDACTED_KEY]');
  }
  return cleaned;
}

const SYSTEM_PROMPT_PREFIX = `[INSTRUCCIÓN DE SISTEMA - CONTEXTO VENEZOLANO OBLIGATORIO]
Eres el Asistente Experto en Gestión Inmobiliaria, Jurídica y Tributaria del Centro Comercial Mario Sánchez (Puerto La Cruz, Estado Anzoátegui, Venezuela).
Tu conocimiento cubre:
1. Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (Decreto N° 929, G.O. N° 40.418): Métodos de canon CAF, CAV, CAM; topes de canon variable (8%); depósitos en garantía (máximo 3 meses en cuenta bancaria remunerada); prórroga legal escalonada (Art. 26).
2. Ley Orgánica de Coordinación y Armonización de las Potestades Tributarias (LOCAT, G.O. Ext. N° 6.755): Clasificador Único de Actividades Económicas (CIIU 6810-01), topes de alícuotas ISAE (máximo 3.0%), no sujeción del condominio en mandato, y TCMMV.
3. Código Orgánico Tributario (COT 2020) y Providencia Administrativa SNAT/2011/0071 de Facturación y Libros Fiscales.
4. Régimen de Sujetos Pasivos Especiales: Agentes de retención de IVA (75% y 100%, G.O. 40.720) y Retenciones de ISLR sobre arrendamiento comercial (Decreto 1808: 5% personas jurídicas, 3% personas naturales).
5. Régimen de Frutos Civiles Sucesorales (Arts. 552 y 768 Código Civil) para la distribución a los 14 coherederos.
Responde de manera profesional, estructurada, precisa y en español.
---
`;

function callGeminiModel(model, apiKey, promptText, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: [
        {
          parts: [{ text: SYSTEM_PROMPT_PREFIX + promptText }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        topP: 0.85
      }
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: timeoutMs
    };

    const request = https.request(url, options, (response) => {
      let responseBody = '';
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            const parsed = JSON.parse(responseBody);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            resolve({ statusCode: response.statusCode, text, model });
          } catch (jsonErr) {
            reject(new Error('Respuesta JSON inválida de Gemini API'));
          }
        } else {
          let errorMsg = 'Error en Gemini API (' + response.statusCode + ')';
          try {
            const errParsed = JSON.parse(responseBody);
            if (errParsed.error && errParsed.error.message) {
              errorMsg = redactSecrets(errParsed.error.message, apiKey);
            }
          } catch (_) {}
          const error = new Error(errorMsg);
          error.statusCode = response.statusCode;
          reject(error);
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.on('timeout', () => {
      request.destroy();
      const err = new Error('Tiempo de espera agotado con Gemini AI (' + timeoutMs + 'ms)');
      err.statusCode = 504;
      reject(err);
    });

    request.write(payload);
    request.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido. Utilice POST.'
    });
  }

  // 1. Gobernanza & Rate Limiting por IP del cliente
  const reqHeaders = req.headers || {};
  const clientIp = reqHeaders['x-forwarded-for']?.split(',')[0]?.trim() ||
                   reqHeaders['x-real-ip'] ||
                   req.socket?.remoteAddress ||
                   'local-client';
  const rateLimitKey = 'gemini-api:' + clientIp;
  const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, 60);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);

  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', rateCheck.resetAfterSec);
    return res.status(429).json({
      success: false,
      error: 'Límite de solicitudes de IA excedido. Por favor espere ' + rateCheck.resetAfterSec + ' segundos.',
      resetAfterSec: rateCheck.resetAfterSec
    });
  }

  // 2. Validación y sanitización de entrada
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'JSON malformado en el cuerpo de la petición.' });
    }
  }

  const prompt = (body && (body.prompt || body.message || body.query)) ? String(body.prompt || body.message || body.query).trim() : null;
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'El campo prompt o message es requerido.'
    });
  }

  if (prompt.length > 4000) {
    return res.status(400).json({
      success: false,
      error: 'El texto de la consulta supera el límite defensivo de 4.000 caracteres.'
    });
  }

  // 3. Verificación de credenciales en entorno seguro
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return res.status(500).json({
      success: false,
      error: 'El servicio de IA no está configurado (GEMINI_API_KEY faltante en el servidor).'
    });
  }

  const context = body.context ? String(body.context).slice(0, 2000) : '';
  const fullPrompt = context
    ? `[Contexto del Centro Comercial / Unidad:]\n${context}\n\n[Consulta del Usuario:]\n${prompt}`
    : prompt;

  // 4. Invocación con alta disponibilidad (Primary -> Cadena de Fallbacks si 503/429/timeout)
  try {
    let result = null;
    let lastError = null;
    const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter(m => m !== PRIMARY_MODEL)];

    for (const modelCandidate of modelsToTry) {
      try {
        result = await callGeminiModel(modelCandidate, apiKey, fullPrompt, TIMEOUT_MS);
        if (result && result.text) break;
      } catch (err) {
        lastError = err;
        // Solo reintentar en siguiente modelo si es error transitorio de capacidad o timeout
        if (err.statusCode === 503 || err.statusCode === 429 || err.statusCode === 504 || err.statusCode === 500) {
          continue;
        } else {
          throw err;
        }
      }
    }

    if (!result) {
      throw lastError || new Error('No fue posible obtener respuesta de los modelos disponibles de Gemini.');
    }

    return res.status(200).json({
      success: true,
      model: result.model,
      reply: result.text,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    const cleanMsg = redactSecrets(err.message, apiKey);
    return res.status(502).json({
      success: false,
      error: cleanMsg
    });
  }
};
