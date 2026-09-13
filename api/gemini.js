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

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
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

function buildSystemPrompt(org = {}) {
  const orgName = org.name || 'Centro Comercial Mario Sánchez';
  const unitsCount = org.units_count || 39;
  const areaM2 = org.area_m2 || '5.190';
  const location = org.location || 'Puerto La Cruz, Municipio Sotillo, Anzoátegui';
  const rif = org.rif || 'J-30211544-2';
  const baseExpenses = org.base_monthly_expenses_usd || '2.540,00';

  const hasRegimenSucesoral = org?.features?.regimen_sucesoral?.activo === true;
  const coherederos = hasRegimenSucesoral ? (parseInt(org?.features?.regimen_sucesoral?.coherederos, 10) || 14) : 0;

  let sucesoralClause = '';
  let sucesoralLaw = '';
  if (hasRegimenSucesoral && coherederos > 0) {
    sucesoralClause = `\n- Administración y Régimen Sucesoral: Comunidad integrada por ${coherederos} coherederos con alícuotas indivisas sobre los frutos civiles (Arts. 552 y 768 Código Civil).`;
    sucesoralLaw = `\n5. Régimen de Frutos Civiles Sucesorales (Arts. 552 y 768 Código Civil) para la liquidación neta mensual a los ${coherederos} coherederos.`;
  }

  return `[INSTRUCCIÓN DE SISTEMA - CONTEXTO VENEZOLANO Y OPERATIVO INMOBILIARIO]
Eres el Asistente Experto en Gestión Inmobiliaria, Jurídica, Tributaria y Operativa de ${orgName} (${location}, Venezuela).

DATOS CLAVE DEL PROYECTO INMOBILIARIO:
- ${orgName}: Complejo comercial ubicado en ${location}.
- ${unitsCount} unidades inmobiliarias (locales comerciales PB y PA, oficinas ejecutivas, macro-lotes y galpones logísticos). Superficie total arrendable: ${areaM2} m².
- Identificación Fiscal: ${rif}.${sucesoralClause}
- Cánones y Moneda: Cánones pactados en divisas de referencia, exigibles y pagaderos en Bolívares a la tasa oficial del Banco Central de Venezuela (BCV) del día valor o mediante transferencias/USDT según contrato (Arts. 32 y 38 Decreto 929, G.O. 40.418).
- Gastos Comunes / Condominio: Presupuesto base mensual de $${baseExpenses} USD asignado por alícuotas según m² (Vigilancia 24/7, Mantenimiento Eléctrico e Hidráulico, Bombeo de Agua, Limpieza, Fondo de Reserva 10%, Gestión Administrativa 5%).
- Escaneo y Reconocimiento de Facturas/Documentos: Si el usuario proporciona una imagen o datos de una factura/recibo/documento, debes analizarla, verificar sus datos fiscales (RIF emisor, N° Control SENIAT, fecha, base imponible, desglose IVA, retenciones) y emitir un diagnóstico estructurado.

MARCO JURÍDICO Y TRIBUTARIO VENEZOLANO:
1. Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (Decreto N° 929, G.O. N° 40.418): Métodos CAF, CAV, CAM; límite máximo de canon variable (8% sobre ventas brutas); depósito en garantía tope de 3 meses en cuenta bancaria separada y remunerada (Art. 19); derecho de preferencia y prórroga legal escalonada (Art. 26).
2. Ley Orgánica de Coordinación y Armonización de las Potestades Tributarias (LOCAT, G.O. Ext. N° 6.755): Clasificador Único de Actividades Económicas (CIIU 6810-01), topes de alícuotas de Actividad Económica ISAE (máx 3.0%), no sujeción ni gravabilidad del reembolso de gastos de condominio en mandato (Art. 1.684 Código Civil), y TCMMV.
3. Código Orgánico Tributario (COT 2020) y Providencias SENIAT SNAT/2011/0071 y SNAT/2014/0032 de Facturación y Libros Fiscales.
4. Sujetos Pasivos Especiales: Agentes de retención de IVA (75% y 100%, Providencia SNAT/2015/0049) y Retenciones de ISLR sobre arrendamiento comercial (Decreto 1808: 5% personas jurídicas, 3% personas naturales).${sucesoralLaw}
6. Ley de Reforma del IGTF (G.O. Ext. 6.687): Alícuota del 3% aplicable a cobros liquidados en divisas en efectivo o monedas extranjeras sin intermediación bancaria nacional.

Responde de manera profesional, estructurada, precisa y en español. Si te consultan por un local, estado de cuenta o cálculo, explica las fórmulas paso a paso.
---
`;
}

function callGeminiModel(model, apiKey, promptText, timeoutMs, inlineAttachment = null, systemPrompt = null) {
  return new Promise((resolve, reject) => {
    const sysPrompt = systemPrompt || buildSystemPrompt();
    const parts = [{ text: sysPrompt + promptText }];
    if (inlineAttachment && inlineAttachment.data && inlineAttachment.mimeType) {
      parts.unshift({
        inline_data: {
          mime_type: inlineAttachment.mimeType,
          data: inlineAttachment.data
        }
      });
    }

    const payload = JSON.stringify({
      contents: [
        {
          parts: parts
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

  // 1. Parseo y sanitización temprana del cuerpo
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'JSON malformado en el cuerpo de la petición.' });
    }
  }

  // 2. Control de Autenticación Incondicional & Detección de Modo Demo
  // Blindaje estricto de seguridad: no depende de NODE_ENV ni VERCEL_ENV volátiles.
  const reqHeaders = req.headers || {};
  const isDemo = (body && body.demo === true) || 
                 reqHeaders['x-ccms-demo'] === 'true' || 
                 reqHeaders['x-demo'] === 'true';
  const authHeader = reqHeaders['authorization'] || reqHeaders['Authorization'];
  let authenticatedUser = null;

  if (!isDemo && !authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Autenticación requerida. Inicie sesión con credenciales válidas o especifique el modo demostración.'
    });
  }

  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Formato de autorización inválido. Debe utilizar esquema Bearer token.'
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token de autorización vacío.'
      });
    }

    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
      try {
        const verifyRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
          }
        });
        if (verifyRes.ok) {
          authenticatedUser = await verifyRes.json();
        } else if (!isDemo) {
          return res.status(401).json({
            success: false,
            error: 'Sesión de Supabase inválida o expirada. Por favor vuelva a iniciar sesión.'
          });
        }
      } catch (e) {
        console.warn('[Gemini Auth] Advertencia verificando token con Supabase:', e.message);
        if (!isDemo) {
          return res.status(401).json({
            success: false,
            error: 'Error de verificación de autenticación con el servidor central.'
          });
        }
      }
    } else if (!isDemo) {
      return res.status(401).json({
        success: false,
        error: 'Servidor no configurado para validar sesiones de usuario (SUPABASE_URL no disponible).'
      });
    }
  }

  // 3. Gobernanza & Rate Limiting por IP del cliente (con control estricto para modo Demo)
  const clientIp = reqHeaders['x-forwarded-for']?.split(',')[0]?.trim() ||
                   reqHeaders['x-real-ip'] ||
                   req.socket?.remoteAddress ||
                   'local-client';
  const effectiveMaxRate = isDemo ? Math.min(RATE_LIMIT_MAX, 6) : RATE_LIMIT_MAX;
  const rateLimitKey = 'gemini-api:' + (isDemo ? 'demo:' : '') + clientIp;
  const rateCheck = checkRateLimit(rateLimitKey, effectiveMaxRate, 60);

  res.setHeader('X-RateLimit-Limit', effectiveMaxRate);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);

  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', rateCheck.resetAfterSec);
    return res.status(429).json({
      success: false,
      error: 'Límite de solicitudes de IA excedido. Por favor espere ' + rateCheck.resetAfterSec + ' segundos.',
      resetAfterSec: rateCheck.resetAfterSec
    });
  }

  // 4. Validación de campos requeridos
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

  // 5. Verificación de credenciales en entorno seguro
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return res.status(500).json({
      success: false,
      error: 'El servicio de IA no está configurado (GEMINI_API_KEY faltante en el servidor).',
      code: 'MISSING_API_KEY'
    });
  }

  const context = body.context ? String(body.context).slice(0, 2000) : '';
  const fullPrompt = context
    ? `[Contexto del Centro Comercial / Unidad:]\n${context}\n\n[Consulta del Usuario:]\n${prompt}`
    : prompt;

  const systemPrompt = buildSystemPrompt(body?.organization || {});

  let inlineAttachment = null;
  if (body && (body.image || body.file_base64)) {
    const base64Raw = String(body.image || body.file_base64).replace(/^data:[^;]+;base64,/, '');
    inlineAttachment = {
      mimeType: body.image_type || body.mime_type || 'image/jpeg',
      data: base64Raw
    };
  }

  // 6. Invocación con alta disponibilidad (Primary -> Cadena de Fallbacks si 503/429/timeout)
  try {
    let result = null;
    let lastError = null;
    const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter(m => m !== PRIMARY_MODEL)];

    for (const modelCandidate of modelsToTry) {
      try {
        result = await callGeminiModel(modelCandidate, apiKey, fullPrompt, TIMEOUT_MS, inlineAttachment, systemPrompt);
        if (result && result.text) break;
      } catch (err) {
        lastError = err;
        // Reintentar en siguiente modelo si es error transitorio (503/429/504/500) o modelo no disponible/deprecado (404)
        if (err.statusCode === 503 || err.statusCode === 429 || err.statusCode === 504 || err.statusCode === 500 || err.statusCode === 404) {
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
      ok: true,
      success: true,
      model: result.model,
      text: result.text,
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
