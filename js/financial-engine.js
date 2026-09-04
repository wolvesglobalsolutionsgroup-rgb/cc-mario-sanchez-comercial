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
      EUR: 0.92,       // 1 USD = 0.92 EUR (o 1 EUR = ~1.087 USD)
      VES: 72.50,      // Tasa Oficial BCV de referencia (Bs. por USD)
      USDT: 1.00,      // Paridad cripto estricta 1:1 con USD
      lastUpdated: new Date().toISOString().split('T')[0]
    };
  }

  saveRates() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.rates));
  }

  setBcvRate(newRate) {
    const r = parseFloat(newRate);
    if (isNaN(r) || r <= 0) throw new Error("Tasa BCV inválida");
    this.rates.VES = r;
    this.rates.lastUpdated = new Date().toISOString().split('T')[0];
    this.saveRates();
    return this.rates.VES;
  }

  setEurRate(newRate) {
    const r = parseFloat(newRate);
    if (isNaN(r) || r <= 0) throw new Error("Tasa EUR inválida");
    this.rates.EUR = r;
    this.saveRates();
    return this.rates.EUR;
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
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
      case 'EUR':
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
      case 'VES':
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', minimumFractionDigits: 2 }).format(val).replace('VES', 'Bs.');
      case 'USDT':
        return `₮ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
      default:
        return `${val.toFixed(2)} ${currency}`;
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
      snapshot_timestamp: new Date().toISOString()
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
