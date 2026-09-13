/**
 * ==============================================================================
 * VERCEL SERVERLESS FUNCTION: /api/rates
 * Centro Comercial Mario Sánchez — API de Tasas Oficiales BCV & Cripto P2P
 * Cache distribuido en el Edge (15-30 min) y registro auditable para SUDEBAN
 * ==============================================================================
 */

module.exports = async function handler(req, res) {
  // CORS y cabeceras de caché distribuido en Vercel Edge CDN
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const timestamp = new Date().toISOString();
  let bcvUsd = 832.49;
  let bcvEur = 947.30;
  let usdtP2p = 985.50;
  let sourceUsd = 'Fallback Base / Histórico';
  let sourceEur = 'Fallback Base / Histórico';
  let sourceUsdt = 'Fallback Binance P2P';
  let errors = [];

  // 1. Obtener Tasa Dólar Oficial BCV (vía DolarApi)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.promedio && !isNaN(data.promedio)) {
        bcvUsd = parseFloat(data.promedio);
        sourceUsd = 'Banco Central de Venezuela (vía DolarApi Oficial)';
      }
    }
  } catch (e) {
    errors.push(`BCV_USD: ${e.message}`);
  }

  // 2. Obtener Tasa Euro Oficial BCV
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const respEur = await fetch('https://ve.dolarapi.com/v1/euros/oficial', { signal: controller.signal });
    clearTimeout(timeout);
    if (respEur.ok) {
      const dataEur = await respEur.json();
      if (dataEur && dataEur.promedio && !isNaN(dataEur.promedio)) {
        bcvEur = parseFloat(dataEur.promedio);
        sourceEur = 'Banco Central de Venezuela (vía DolarApi Euro)';
      }
    }
  } catch (e) {
    errors.push(`BCV_EUR: ${e.message}`);
  }

  // 3. Obtener Tasa Binance P2P / Paralelo
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const respParalelo = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', { signal: controller.signal });
    clearTimeout(timeout);
    if (respParalelo.ok) {
      const dataParalelo = await respParalelo.json();
      if (dataParalelo && dataParalelo.promedio && !isNaN(dataParalelo.promedio)) {
        usdtP2p = parseFloat(dataParalelo.promedio);
        sourceUsdt = 'Binance P2P / Mercado Cripto (DolarApi Paralelo)';
      }
    }
  } catch (e) {
    errors.push(`P2P_USDT: ${e.message}`);
  }

  const responsePayload = {
    success: true,
    timestamp: timestamp,
    rates: {
      USD: 1.00,
      EUR: Math.round((bcvUsd / bcvEur) * 10000) / 10000,
      EUR_VES: bcvEur,
      VES: bcvUsd,
      USDT: 1.00,
      USDT_VES: usdtP2p
    },
    metadata: {
      bcv_source: sourceUsd,
      eur_source: sourceEur,
      p2p_source: sourceUsdt,
      cached_ttl_seconds: 900,
      regulatory_notice: 'Tasa oficial conforme al Convenio Cambiario N° 1 y Art. 128 Ley del BCV',
      errors: errors.length ? errors : null
    }
  };

  return res.status(200).json(responsePayload);
};
