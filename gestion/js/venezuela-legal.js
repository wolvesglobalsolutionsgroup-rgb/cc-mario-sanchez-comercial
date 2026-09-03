/**
 * ==============================================================================
 * MÓDULO LEGAL: ARRENDAMIENTO INMOBILIARIO COMERCIAL EN VENEZUELA
 * Conforme a la Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial
 * (Decreto N° 929, Gaceta Oficial N° 40.418)
 * ==============================================================================
 */

const VenezuelaLegal = {
  // Tasa oficial de cambio BCV de referencia (actualizable dinámicamente)
  BCV_RATE: 72.50, // Bs. por USD

  /**
   * 1. Cálculo del Canon de Arrendamiento Fijo (CAF)
   * Artículo 32 de la Ley (G.O. 40.418)
   * Fórmula: CAF = (Valor Inmueble / 12 / Área Total) * Área del Local * % Rentabilidad
   * 
   * @param {number} valorInmuebleUsd - Avalúo del inmueble en USD
   * @param {number} areaTotalM2 - Superficie total arrendable (5.190 m2)
   * @param {number} areaLocalM2 - Metraje del local
   * @param {boolean} esInmuebleNuevo - Si es centro comercial nuevo aplica hasta 20%, estándar 12%
   * @returns {number} Canon mensual fijo calculado
   */
  calculateCAF(valorInmuebleUsd, areaTotalM2, areaLocalM2, esInmuebleNuevo = false) {
    const rentabilidadAnual = esInmuebleNuevo ? 0.20 : 0.12;
    const costoM2 = valorInmuebleUsd / 12 / areaTotalM2;
    const canonFijo = costoM2 * areaLocalM2 * rentabilidadAnual;
    return Math.round(canonFijo * 100) / 100;
  },

  /**
   * 2. Validación de Garantía y Depósito
   * Artículo 19 de la Ley (G.O. 40.418)
   * "El arrendador sólo podrá exigir un depósito en efectivo o fianza equivalente
   * como máximo a tres (3) meses de canon de arrendamiento."
   */
  validateDeposit(months) {
    if (months > 3) {
      return {
        valid: false,
        message: 'Alerta Legal (Art. 19 G.O. 40.418): El depósito en garantía no puede superar tres (3) meses de canon.',
        maxAllowed: 3
      };
    }
    return {
      valid: true,
      message: `Conforme a ley: ${months} meses de garantía asignados (Tope máximo legal: 3 meses).`
    };
  },

  /**
   * 3. Duración Mínima Contractual
   * Artículo 13 de la Ley (G.O. 40.418)
   * "La relación de arrendamiento comercial tendrá una duración mínima de un (1) año."
   */
  validateDuration(months) {
    if (months < 12) {
      return {
        valid: false,
        message: 'Advertencia Legal (Art. 13 G.O. 40.418): Los contratos comerciales deben pactarse por un plazo mínimo de un (1) año.'
      };
    }
    return { valid: true };
  },

  /**
   * 4. Cálculo de Prórroga Legal Obligatoria
   * Artículo 25 de la Ley (G.O. 40.418)
   * "Vencido el contrato, si el arrendatario ha cumplido sus obligaciones, tiene derecho
   * a continuar ocupando el inmueble bajo las mismas condiciones por el lapso que corresponda:"
   * - Hasta 1 año de contrato: Prórroga máxima de 6 meses.
   * - Más de 1 año hasta 5 años: Prórroga máxima de 1 año.
   * - Más de 5 años hasta 10 años: Prórroga máxima de 2 años.
   * - Más de 10 años: Prórroga máxima de 3 años.
   */
  calculateLegalExtension(durationYears) {
    if (durationYears <= 1) {
      return {
        months: 6,
        description: 'Hasta 6 meses de prórroga legal obligatoria (Art. 25, literal a).'
      };
    } else if (durationYears <= 5) {
      return {
        months: 12,
        description: 'Hasta 1 año de prórroga legal obligatoria (Art. 25, literal b).'
      };
    } else if (durationYears <= 10) {
      return {
        months: 24,
        description: 'Hasta 2 años de prórroga legal obligatoria (Art. 25, literal c).'
      };
    } else {
      return {
        months: 36,
        description: 'Hasta 3 años de prórroga legal obligatoria (Art. 25, literal d).'
      };
    }
  },

  /**
   * 5. Conversión y Formateo Bimonetario (USD / Bs. BCV)
   */
  convertUsdToBs(amountUsd, customRate = null) {
    const rate = customRate || this.BCV_RATE;
    return amountUsd * rate;
  },

  formatUSD(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  },

  formatBs(amount) {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2
    }).format(amount).replace('VES', 'Bs.');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VenezuelaLegal;
}
