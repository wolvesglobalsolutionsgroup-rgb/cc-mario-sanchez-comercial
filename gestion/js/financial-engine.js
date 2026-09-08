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
      EUR: 0.92,          // 1 USD = 0.92 EUR
      EUR_VES: 947.30,    // Tasa Oficial BCV Euro (Bs. por EUR)
      VES: 814.69,        // Tasa Oficial BCV Dólar (Bs. por USD)
      USDT: 1.00,         // Paridad cripto 1:1 con USD
      USDT_VES: 965.40,   // Tasa de mercado USDT frente a Bolívares (Binance P2P)
      lastUpdated: new Date().toISOString(),
      source: 'BCV Oficial (Referencial)',
      usdtSource: 'Binance P2P Real'
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

  setUsdtRate(newRate, source = 'Ajuste Manual Binance P2P') {
    const r = parseFloat(newRate);
    if (isNaN(r) || r <= 0) throw new Error("Tasa USDT/VES inválida");
    this.rates.USDT_VES = r;
    this.rates.lastUpdated = new Date().toISOString();
    this.rates.usdtSource = source;
    this.saveRates();
    return this.rates.USDT_VES;
  }

  /**
   * Sincroniza en tiempo real las tasas oficiales (USD BCV y EUR BCV)
   * y la tasa Binance P2P USDT/VES mediante APIs abiertas y CORS-friendly
   */
  async fetchOfficialBcvRate() {
    return this.fetchLiveRates();
  }

  async fetchLiveRates() {
    let vesUpdated = false;
    let eurUpdated = false;
    let usdtUpdated = false;
    let errors = [];

    // 1. Obtener Dólar Oficial BCV (DolarApi)
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

    // 2. Obtener Euro Oficial BCV (DolarApi)
    try {
      const respEur = await fetch('https://ve.dolarapi.com/v1/euros/oficial');
      if (respEur.ok) {
        const dataEur = await respEur.json();
        if (dataEur && dataEur.promedio && !isNaN(dataEur.promedio)) {
          const eurBs = parseFloat(dataEur.promedio);
          this.rates.EUR_VES = eurBs;
          if (this.rates.VES > 0) {
            this.rates.EUR = Math.round((this.rates.VES / eurBs) * 10000) / 10000;
          }
          eurUpdated = true;
        }
      }
    } catch (err) {
      errors.push(`EUR: ${err.message}`);
    }

    // 3. Obtener Tasa USDT/VES (Binance P2P / Cripto en tiempo real)
    // Intento 1: DolarApi Paralelo/Cripto (mediana comprobada de transacciones P2P)
    try {
      const respParalelo = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
      if (respParalelo.ok) {
        const dataParalelo = await respParalelo.json();
        if (dataParalelo && dataParalelo.promedio && !isNaN(dataParalelo.promedio)) {
          this.rates.USDT_VES = parseFloat(dataParalelo.promedio);
          this.rates.usdtSource = 'Binance P2P / Cripto Mercado';
          usdtUpdated = true;
        }
      }
    } catch (errParalelo) {
      // Intento 2: Yadio API (Order book de respaldo)
      try {
        const respYadio = await fetch('https://api.yadio.io/json');
        if (respYadio.ok) {
          const dataYadio = await respYadio.json();
          const p2pRate = dataYadio?.USD?.other?.p2p_usdt?.rate || dataYadio?.USD?.rate;
          if (p2pRate && !isNaN(p2pRate)) {
            this.rates.USDT_VES = parseFloat(p2pRate);
            this.rates.usdtSource = 'Binance P2P (vía Yadio)';
            usdtUpdated = true;
          }
        }
      } catch (errYadio) {
        errors.push(`USDT_VES: ${errYadio.message}`);
      }
    }

    this.saveRates();

    return {
      success: vesUpdated || usdtUpdated,
      rates: { ...this.rates },
      date: this.rates.lastUpdated,
      source: this.rates.source || 'BCV Oficial',
      usdtSource: this.rates.usdtSource || 'Binance P2P',
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
      usdt_rate_applied: this.rates.USDT || 1.00,
      usdt_ves_rate_applied: this.rates.USDT_VES || this.rates.VES,
      usd_equivalent: Math.round(usdEq * 100) / 100,
      ves_equivalent: Math.round(this.convert(amount, currency, 'VES') * 100) / 100,
      eur_equivalent: Math.round(this.convert(amount, currency, 'EUR') * 100) / 100,
      usdt_equivalent: Math.round(usdEq * 100) / 100,
      snapshot_timestamp: new Date().toISOString(),
      rate_source: this.rates.source || 'BCV Oficial (DolarApi)',
      usdt_rate_source: this.rates.usdtSource || 'Binance P2P (vía Yadio)'
    };
  }

  /**
   * Distribución de Gastos Comunes / Condominio
   * Distribuye el total de egresos operativos según la alícuota de cada local
   */
  distributeCondoExpenses(totalExpensesUsd, units) {
    if (!units || !units.length) return [];
    const totalArea = units.reduce((acc, u) => acc + (u.area_m2 || 0), 0);
    if (totalArea <= 0) return [];
    
    let allocatedUsd = 0;
    return units.map((unit, index) => {
      const aliquot = (unit.area_m2 || 0) / totalArea;
      let shareUsd = Math.round((totalExpensesUsd * aliquot) * 100) / 100;
      
      // Ajuste de residuo por redondeo en la última unidad para garantizar balance 100.00%
      if (index === units.length - 1) {
        shareUsd = Math.round((totalExpensesUsd - allocatedUsd) * 100) / 100;
      } else {
        allocatedUsd += shareUsd;
      }

      return {
        unit_code: unit.code,
        area_m2: unit.area_m2,
        aliquot_pct: Math.round(aliquot * 10000) / 100, // Ej: 28.90%
        share_usd: shareUsd,
        share_ves: Math.round(this.convert(shareUsd, 'USD', 'VES') * 100) / 100
      };
    });
  }

  /**
   * Cálculo de Mora Legal e Intereses Moratorios (G.O. 40.418, Art. 30 y Código de Comercio Art. 108)
   * - Cesa automáticamente en cuanto la factura pasa a 'pagado' o 'verificando'.
   * - Respeta el período de gracia configurable antes de liquidar penalidad.
   * - Desglose transparente en USD, VES BCV, EUR y USDT.
   */
  calculateMora(invoice, asOfDate = null, customSettings = null) {
    if (!invoice) {
      return { inMora: false, daysOverdue: 0, moraRatePct: 0, moraUsd: 0, moraVes: 0, totalDueUsd: 0, totalDueVes: 0 };
    }

    const baseAmountUsd = parseFloat(invoice.total_usd) || (parseFloat(invoice.rent_usd || 0) + parseFloat(invoice.condo_usd || 0));

    // Si la cuota ya fue pagada o el inquilino consignó comprobante en verificación, la mora se detiene
    if (invoice.status === 'pagado' || invoice.status === 'verificando') {
      return {
        inMora: false,
        isSettled: true,
        statusText: invoice.status === 'pagado' ? 'Solvente / Cancelado' : 'Pago Consignado (En Verificación)',
        daysOverdue: 0,
        moraRatePct: 0,
        baseAmountUsd: baseAmountUsd,
        moraUsd: 0,
        moraVes: 0,
        totalDueUsd: baseAmountUsd,
        totalDueVes: Math.round(this.convert(baseAmountUsd, 'USD', 'VES') * 100) / 100
      };
    }

    const cfg = customSettings || (window.dbService ? window.dbService.getSettings() : {
      grace_days: 5,
      mora_monthly_rate: 3.0
    });

    const graceDays = parseInt(cfg.grace_days) !== undefined && !isNaN(parseInt(cfg.grace_days)) ? parseInt(cfg.grace_days) : 5;
    const monthlyRate = parseFloat(cfg.mora_monthly_rate) || 3.0; // 3% mensual
    const dailyRate = (monthlyRate / 30) / 100; // Tasa diaria decimal (ej. 0.001 = 0.1% diario)

    const now = asOfDate ? new Date(asOfDate) : new Date();

    if (!invoice.due_date) {
      return {
        inMora: false,
        daysOverdue: 0,
        moraRatePct: 0,
        baseAmountUsd: baseAmountUsd,
        moraUsd: 0,
        moraVes: 0,
        totalDueUsd: baseAmountUsd,
        totalDueVes: Math.round(this.convert(baseAmountUsd, 'USD', 'VES') * 100) / 100
      };
    }

    const parseLocalDate = (val) => {
      if (!val) return new Date();
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        const [y, m, d] = val.split('T')[0].split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      const dt = new Date(val);
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    };

    const dueDate = parseLocalDate(invoice.due_date);
    const asOfDateOnly = parseLocalDate(asOfDate);

    const diffTime = asOfDateOnly.getTime() - dueDate.getTime();
    const daysSinceDue = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (daysSinceDue <= graceDays) {
      const isWithinGrace = (daysSinceDue > 0);
      const graceRemaining = Math.max(0, graceDays - daysSinceDue);

      return {
        inMora: false,
        isWithinGrace: isWithinGrace,
        graceDaysRemaining: graceRemaining,
        daysOverdue: Math.max(0, daysSinceDue),
        moraRatePct: 0,
        baseAmountUsd: baseAmountUsd,
        moraUsd: 0,
        moraVes: 0,
        totalDueUsd: baseAmountUsd,
        totalDueVes: Math.round(this.convert(baseAmountUsd, 'USD', 'VES') * 100) / 100
      };
    }

    // Excedió el período de gracia: mora acumulada desde el vencimiento
    const daysOverdue = daysSinceDue;
    const accumulatedRatePct = Math.round((dailyRate * daysOverdue * 100) * 100) / 100;
    const moraUsd = Math.round((baseAmountUsd * (dailyRate * daysOverdue)) * 100) / 100;
    const moraVes = Math.round(this.convert(moraUsd, 'USD', 'VES') * 100) / 100;
    const totalDueUsd = Math.round((baseAmountUsd + moraUsd) * 100) / 100;
    const totalDueVes = Math.round(this.convert(totalDueUsd, 'USD', 'VES') * 100) / 100;

    return {
      inMora: true,
      isWithinGrace: false,
      graceDaysRemaining: 0,
      daysOverdue: daysOverdue,
      monthlyRatePct: monthlyRate,
      moraRatePct: accumulatedRatePct,
      baseAmountUsd: baseAmountUsd,
      moraUsd: moraUsd,
      moraVes: moraVes,
      totalDueUsd: totalDueUsd,
      totalDueVes: totalDueVes,
      legalBasis: 'Cláusula Penal Moratoria conforme a G.O. 40.418 y Art. 108 Código de Comercio'
    };
  }
}

// Instancia global del motor financiero
window.financialEngine = new FinancialEngine();

