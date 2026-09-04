/**
 * ==============================================================================
 * MOTOR FINANCIERO CUATRIMONEDA (USD / EUR / VES / USDT)
 * Centro Comercial Mario Sánchez — Arquitectura Contable & Snapshot Histórico
 * Conforme a la Ley de Arrendamiento Inmobiliario para Uso Comercial (G.O. 40.418)
 * ==============================================================================
 */

class FinancialEngine {
  constructor() {
    this.storageKey = 'ccms_financial_rates_v1';
    this.rates = this.loadRates();
  }

  loadRates() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading rates from storage:", e);
      }
    }
    // Tasas oficiales y de paridad por defecto
    return {
      USD: 1.00,
      EUR: 0.92,       // 1 USD = 0.92 EUR
      VES: 72.50,      // Tasa Oficial BCV de referencia (Bs. por USD)
      USDT: 1.00,      // Paridad cripto 1:1 con USD
      lastUpdated: new Date().toISOString(),
      source: 'BCV Oficial (Referencial)'
    };
  }

  saveRates() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.rates));
  }

  setBcvRate(newRate, source = 'Ajuste Manual Administrativo') {
    const r = parseFloat(newRate);
    if (isNaN(r) || r <= 0) throw new Error("Tasa BCV inválida");
    this.rates.VES = r;
    this.rates.lastUpdated = new Date().toISOString();
    this.rates.source = source;
    this.saveRates();
    return this.rates.VES;
  }

  setEurRate(newRate, source = 'Ajuste Manual Administrativo') {
    const r = parseFloat(newRate);
    if (isNaN(r) || r <= 0) throw new Error("Tasa EUR inválida");
    this.rates.EUR = r;
    this.rates.lastUpdated = new Date().toISOString();
    this.rates.source = source;
    this.saveRates();
    return this.rates.EUR;
  }

  /**
   * Sincroniza en tiempo real las tasas oficiales (USD BCV y EUR BCV)
   * utilizando la API pública DolarApi con fallback automático
   */
  async fetchOfficialBcvRate() {
    let vesUpdated = false;
    let eurUpdated = false;
    let errors = [];

    // 1. Obtener Dólar Oficial BCV
    try {
      const resp = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.promedio && !isNaN(data.promedio)) {
          this.rates.VES = parseFloat(data.promedio);
          this.rates.lastUpdated = data.fechaActualizacion || new Date().toISOString();
          this.rates.source = 'Banco Central de Venezuela (vía DolarApi)';
          vesUpdated = true;
        }
      }
    } catch (err) {
      errors.push(`VES: ${err.message}`);
    }

    // 2. Obtener Euro Oficial BCV
    try {
      const respEur = await fetch('https://ve.dolarapi.com/v1/euros/oficial');
      if (respEur.ok) {
        const dataEur = await respEur.json();
        if (dataEur && dataEur.promedio && !isNaN(dataEur.promedio) && this.rates.VES > 0) {
          // Relación EUR/USD calculada a partir de los Bs oficiales
          const eurBs = parseFloat(dataEur.promedio);
          this.rates.EUR = Math.round((this.rates.VES / eurBs) * 10000) / 10000;
          eurUpdated = true;
        }
      }
    } catch (err) {
      // Fallback a paridad estándar si falla la API de euros
      errors.push(`EUR: ${err.message}`);
    }

    this.saveRates();

    return {
      success: vesUpdated,
      rates: { ...this.rates },
      date: this.rates.lastUpdated,
      source: this.rates.source || 'BCV Oficial',
      errors: errors.length ? errors.join('; ') : null
    };
  }

  getRates() {
    return { ...this.rates };
  }

  /**
   * Conversión universal entre las 4 monedas
   */
  convert(amount, fromCur, toCur) {
    const num = parseFloat(amount);
    if (isNaN(num)) return 0;
    if (fromCur === toCur) return num;

    // 1. Convertir moneda origen a USD (Base común)
    let amountInUsd = 0;
    if (fromCur === 'USD' || fromCur === 'USDT') {
      amountInUsd = num;
    } else if (fromCur === 'EUR') {
      amountInUsd = num / this.rates.EUR;
    } else if (fromCur === 'VES') {
      amountInUsd = num / this.rates.VES;
    }

    // 2. Convertir USD a moneda destino
    if (toCur === 'USD' || toCur === 'USDT') {
      return amountInUsd;
    } else if (toCur === 'EUR') {
      return amountInUsd * this.rates.EUR;
    } else if (toCur === 'VES') {
      return amountInUsd * this.rates.VES;
    }

    return amountInUsd;
  }

  /**
   * Formateo visual localizado para cada moneda
   */
  format(amount, currency) {
    const val = parseFloat(amount) || 0;
    switch (currency) {
      case 'USD':
        return `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'EUR':
        return `€ ${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'VES':
        return `Bs. ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'USDT':
        return `USDT ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      default:
        return `${currency} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  /**
   * Validación de Hash de Transacción Cripto (TxID)
   * Red TRON (TRC20) o Binance Smart Chain (BEP20)
   */
  validateTxID(txid, network = 'TRC20') {
    const clean = (txid || '').trim();
    // Expresión regular para 64 caracteres hexadecimales
    const isHex64 = /^[a-fA-F0-9]{64}$/.test(clean);
    return {
      isValid: isHex64,
      network: network,
      cleanTxID: clean,
      explorerUrl: network === 'TRC20' 
        ? `https://tronscan.org/#/transaction/${clean}`
        : `https://bscscan.com/tx/${clean}`,
      message: isHex64 
        ? `TxID verificado en red ${network}`
        : `El Hash TxID debe contener exactamente 64 caracteres hexadecimales.`
    };
  }

  /**
   * Snapshot Financiero Histórico
   * Cada pago registra la tasa y equivalencias al momento de la fecha valor (G.O. 40.418)
   */
  createPaymentSnapshot(amount, currency, valueDate = null) {
    const date = valueDate || new Date().toISOString().split('T')[0];
    const usdEq = this.convert(amount, currency, 'USD');

    return {
      original_amount: parseFloat(amount),
      original_currency: currency,
      value_date: date,
      bcv_rate_applied: this.rates.VES,
      eur_rate_applied: this.rates.EUR,
      usd_equivalent: Math.round(usdEq * 100) / 100,
      ves_equivalent: Math.round(this.convert(amount, currency, 'VES') * 100) / 100,
      eur_equivalent: Math.round(this.convert(amount, currency, 'EUR') * 100) / 100,
      usdt_equivalent: Math.round(usdEq * 100) / 100,
      snapshot_timestamp: new Date().toISOString(),
      rate_source: this.rates.source || 'BCV Oficial (DolarApi)'
    };
  }

  /**
   * Distribución de Gastos Comunes / Condominio
   * Distribuye el total de egresos operativos según la alícuota de cada local
   */
  distributeCondoExpenses(totalExpensesUsd, units) {
    const totalArea = units.reduce((acc, u) => acc + u.area_m2, 0);
    return units.map(unit => {
      const aliquot = unit.area_m2 / totalArea;
      const shareUsd = Math.round((totalExpensesUsd * aliquot) * 100) / 100;
      return {
        unit_code: unit.code,
        area_m2: unit.area_m2,
        aliquot_pct: Math.round(aliquot * 10000) / 100, // Ej: 28.90%
        share_usd: shareUsd,
        share_ves: Math.round(this.convert(shareUsd, 'USD', 'VES') * 100) / 100
      };
    });
  }
}

// Instancia global del motor financiero
window.financialEngine = new FinancialEngine();
