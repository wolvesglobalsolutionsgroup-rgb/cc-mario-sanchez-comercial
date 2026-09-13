/**
 * ==============================================================================
 * MOTOR MULTI-MUNICIPAL DE LIQUIDACIÓN Y ALCALDÍAS (ISAE & LOCAT)
 * Arquitectura SaaS Adaptable a cualquier Municipio de Venezuela
 *
 * Marco Normativo:
 * - Ley Orgánica de Coordinación y Armonización de las Potestades Tributarias
 *   de los Estados y Municipios (LOCAT - G.O. N° 6.755 Extraordinario).
 * - Código Civil de Venezuela (Art. 1.684: Mandato y fondos de terceros).
 * - Clasificador Armonizado de Actividades Económicas (Código CIIU 6810).
 * - Ordenanzas Municipales de Actividades Económicas, Inmuebles Urbanos y Aseo.
 * ==============================================================================
 */

(function (global) {
  'use strict';

  const AlcaldiaEngine = {
    DEFAULT_ISAE_RATE: 0.02, // 2.0% Alícuota armonizada para Arrendamiento Inmobiliario Comercial
    ASEO_RATE_PER_M2_USD: 0.40, // 0.40 USD/m² promedio comercial municipal
    MINIMO_TRIBUTABLE_TCMMV: 15, // Unidades de Moneda de Mayor Valor (BCV)

    // Catálogo Maestro de Municipios de Venezuela con Parámetros Tributarios Armonizados
    MUNICIPIOS_DISPONIBLES: {
      sotillo: {
        id: 'sotillo',
        nombre: 'Juan Antonio Sotillo (Puerto La Cruz)',
        estado: 'Anzoátegui',
        ente_recaudador: 'Dirección de Administración Tributaria (DAT / SATM)',
        portal_tributario: 'https://satm.alcaldiasotillo.gob.ve',
        alicuota_isae: 0.020, // 2.0%
        aseo_m2_usd: 0.40,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 15
      },
      urbaneja: {
        id: 'urbaneja',
        nombre: 'Diego Bautista Urbaneja (Lechería)',
        estado: 'Anzoátegui',
        ente_recaudador: 'Servicio Autónomo Bolivariano de Administración Tributaria (SEDABAT)',
        portal_tributario: 'https://sedabat.alcaldiadelecheria.gob.ve',
        alicuota_isae: 0.025, // 2.5%
        aseo_m2_usd: 0.55,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 20
      },
      bolivar: {
        id: 'bolivar',
        nombre: 'Simón Bolívar (Barcelona)',
        estado: 'Anzoátegui',
        ente_recaudador: 'Servicio Desconcentrado de Administración Tributaria (SEDEBAT)',
        portal_tributario: 'https://sedebat.alcaldiadebarcelona.gob.ve',
        alicuota_isae: 0.020, // 2.0%
        aseo_m2_usd: 0.38,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 15
      },
      chacao: {
        id: 'chacao',
        nombre: 'Chacao (Caracas)',
        estado: 'Miranda',
        ente_recaudador: 'Dirección de Administración Tributaria (DAT Chacao)',
        portal_tributario: 'https://rentas.chacao.gob.ve',
        alicuota_isae: 0.025, // 2.5%
        aseo_m2_usd: 0.65,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 30
      },
      baruta: {
        id: 'baruta',
        nombre: 'Baruta (Caracas)',
        estado: 'Miranda',
        ente_recaudador: 'Servicio Autónomo Municipal de Administración Tributaria (SEMAT Baruta)',
        portal_tributario: 'https://semat.alcaldiadebaruta.gob.ve',
        alicuota_isae: 0.022, // 2.2%
        aseo_m2_usd: 0.60,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 25
      },
      sucre: {
        id: 'sucre',
        nombre: 'Sucre (Petare / Caracas)',
        estado: 'Miranda',
        ente_recaudador: 'Dirección de Rentas Municipales (SEDAT Sucre)',
        portal_tributario: 'https://sedat.alcaldiadesucre.gob.ve',
        alicuota_isae: 0.020, // 2.0%
        aseo_m2_usd: 0.45,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 20
      },
      libertador: {
        id: 'libertador',
        nombre: 'Libertador (Distrito Capital)',
        estado: 'Distrito Capital',
        ente_recaudador: 'Superintendencia Municipal de Administración Tributaria (SUMAT Caracas)',
        portal_tributario: 'https://sumat.caracas.gob.ve',
        alicuota_isae: 0.020, // 2.0%
        aseo_m2_usd: 0.50,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 20
      },
      valencia: {
        id: 'valencia',
        nombre: 'Valencia',
        estado: 'Carabobo',
        ente_recaudador: 'Dirección de Hacienda del Municipio Valencia',
        portal_tributario: 'https://hacienda.alcaldiadevalencia.gob.ve',
        alicuota_isae: 0.020, // 2.0%
        aseo_m2_usd: 0.45,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 20
      },
      maracaibo: {
        id: 'maracaibo',
        nombre: 'Maracaibo',
        estado: 'Zulia',
        ente_recaudador: 'Servicio Desconcentrado Municipal de Administración Tributaria (SEDEMAT)',
        portal_tributario: 'https://sedemat.alcaldiademaracaibo.gob.ve',
        alicuota_isae: 0.025, // 2.5%
        aseo_m2_usd: 0.50,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 25
      },
      iribarren: {
        id: 'iribarren',
        nombre: 'Iribarren (Barquisimeto)',
        estado: 'Lara',
        ente_recaudador: 'Servicio Municipal de Administración Tributaria (SEMAT Iribarren)',
        portal_tributario: 'https://semat.alcaldiadeiribarren.gob.ve',
        alicuota_isae: 0.020, // 2.0%
        aseo_m2_usd: 0.40,
        codigo_ciiu: '6810-01',
        minimo_tcmmv: 18
      }
    },

    activeMunicipioId: 'sotillo',

    config: {
      municipio: 'Juan Antonio Sotillo (Puerto La Cruz)',
      estado: 'Anzoátegui',
      ente_recaudador: 'Dirección de Administración Tributaria (DAT / SATM)',
      codigo_actividad: '6810-01',
      descripcion_actividad: 'Arrendamiento y administración de inmuebles comerciales no residenciales',
      alicuota_isae: 0.020,
      aseo_m2_usd: 0.40,
      base_legal_mandato: 'Art. 1.684 Código Civil & Doctrina SPA-TSJ (Exclusión de fondos por cuenta de terceros)'
    },

    /**
     * Devuelve el listado ordenado de municipios disponibles para selectores UI.
     */
    getMunicipios() {
      return Object.values(this.MUNICIPIOS_DISPONIBLES);
    },

    /**
     * Configura el municipio activo para el cálculo tributario municipal.
     */
    setMunicipio(municipioId) {
      const mun = this.MUNICIPIOS_DISPONIBLES[municipioId] || this.MUNICIPIOS_DISPONIBLES.sotillo;
      this.activeMunicipioId = mun.id;
      this.config.municipio = mun.nombre;
      this.config.estado = mun.estado;
      this.config.ente_recaudador = mun.ente_recaudador;
      this.config.alicuota_isae = mun.alicuota_isae;
      this.config.aseo_m2_usd = mun.aseo_m2_usd;
      this.config.codigo_actividad = mun.codigo_ciiu;
      return this.config;
    },

    /**
     * Calcula la declaración mensual del Impuesto sobre Actividades Económicas (ISAE).
     * Aplica la segregación estricta entre Canon (Gravable) y Condominio (Exento de patente).
     *
     * @param {Array} invoices - Lista de facturas del período
     * @param {Array} condoExpenses - Gastos comunes soportados en el mes
     * @param {Object} options - Parámetros { month, year, bcvRate, isaeRate, municipioId }
     */
    calcularDeclaracionISAE(invoices = [], condoExpenses = [], options = {}) {
      const month = options.month || new Date().getMonth() + 1;
      const year = options.year || new Date().getFullYear();
      const bcvRate = options.bcvRate || 807.38;
      
      // Adaptación al municipio seleccionado
      const munId = options.municipioId || this.activeMunicipioId;
      const munData = this.MUNICIPIOS_DISPONIBLES[munId] || this.MUNICIPIOS_DISPONIBLES.sotillo;
      const isaeRate = options.isaeRate !== undefined ? options.isaeRate : munData.alicuota_isae;
      const aseoRate = options.aseoRate !== undefined ? options.aseoRate : munData.aseo_m2_usd;

      // Filtrar facturas del período
      const filteredInvoices = (invoices || []).filter(inv => {
        const matchMonth = options.allMonths || inv.period_month === parseInt(month);
        const matchYear = inv.period_year === parseInt(year);
        return matchMonth && matchYear;
      });

      let opIndex = 1;
      let totalCanonUsd = 0;
      let totalCondoUsd = 0;
      let totalRecaudadoUsd = 0;

      let totalBaseImponibleBs = 0;
      let totalCondoExentoBs = 0;
      let totalIsaeBs = 0;

      const items = filteredInvoices.map(inv => {
        const totalUsd = parseFloat(inv.total_usd || inv.amount_usd || 0);
        let canonUsd = parseFloat(inv.canon_usd || inv.base_rent_usd || 0);
        let condoUsd = parseFloat(inv.condo_usd || inv.condo_share_usd || 0);

        if (canonUsd === 0 && totalUsd > 0) {
          canonUsd = Math.round(totalUsd * 0.82 * 100) / 100;
          condoUsd = Math.round((totalUsd - canonUsd) * 100) / 100;
        }

        const canonBs = Math.round(canonUsd * bcvRate * 100) / 100;
        const condoBs = Math.round(condoUsd * bcvRate * 100) / 100;
        const totalBs = Math.round(totalUsd * bcvRate * 100) / 100;

        const baseImponibleBs = canonBs;
        const impuestoIsaeBs = Math.round(baseImponibleBs * isaeRate * 100) / 100;
        const impuestoIsaeUsd = Math.round(canonUsd * isaeRate * 100) / 100;

        totalCanonUsd += canonUsd;
        totalCondoUsd += condoUsd;
        totalRecaudadoUsd += totalUsd;

        totalBaseImponibleBs += baseImponibleBs;
        totalCondoExentoBs += condoBs;
        totalIsaeBs += impuestoIsaeBs;

        return {
          op: opIndex++,
          invoice_id: inv.id,
          unit_number: inv.unit_number || inv.unit || 'L-00',
          tenant_name: inv.tenant_name || 'Arrendatario Comercial',
          tenant_rif: inv.tenant_rif || 'J-00000000-0',
          invoice_number: inv.invoice_number || ('FAC-' + inv.id),
          control_number: inv.control_number || ('00-' + String(opIndex).padStart(6, '0')),
          fecha: inv.issue_date || (year + '-' + String(month).padStart(2, '0') + '-05'),
          canon_usd: canonUsd,
          condo_usd: condoUsd,
          total_usd: totalUsd,
          canon_bs: canonBs,
          condo_bs: condoBs,
          total_bs: totalBs,
          base_imponible_bs: baseImponibleBs,
          alicuota_isae_pct: Number((isaeRate * 100).toFixed(2)),
          impuesto_isae_bs: impuestoIsaeBs,
          impuesto_isae_usd: impuestoIsaeUsd,
          tratamiento_condominio: 'No Sujeto / Mandato Terceros (Art. 1684 C.C.)'
        };
      });

      const ahorroFiscalBs = Math.round(totalCondoExentoBs * isaeRate * 100) / 100;
      const ahorroFiscalUsd = Math.round(totalCondoUsd * isaeRate * 100) / 100;

      const superficieTotalM2 = 2450;
      const tasaAseoEstimadaUsd = Math.round(superficieTotalM2 * aseoRate * 100) / 100;
      const tasaAseoEstimadaBs = Math.round(tasaAseoEstimadaUsd * bcvRate * 100) / 100;

      return {
        periodo: String(month).padStart(2, '0') + '/' + year,
        periodo_mes: parseInt(month),
        periodo_ano: parseInt(year),
        municipio_id: munData.id,
        municipio: munData.nombre,
        estado: munData.estado,
        ente_recaudador: munData.ente_recaudador,
        portal_tributario: munData.portal_tributario,
        codigo_actividad: munData.codigo_ciiu,
        alicuota_aplicada_pct: Number((isaeRate * 100).toFixed(2)),
        tasa_bcv_aplicada: bcvRate,
        resumen: {
          total_locales_declarados: items.length,
          total_canon_usd: Math.round(totalCanonUsd * 100) / 100,
          total_condo_exento_usd: Math.round(totalCondoUsd * 100) / 100,
          total_facturado_usd: Math.round(totalRecaudadoUsd * 100) / 100,
          total_base_imponible_bs: Math.round(totalBaseImponibleBs * 100) / 100,
          total_condo_exento_bs: Math.round(totalCondoExentoBs * 100) / 100,
          total_ingresos_brutos_bs: Math.round((totalBaseImponibleBs + totalCondoExentoBs) * 100) / 100,
          impuesto_isae_a_pagar_bs: Math.round(totalIsaeBs * 100) / 100,
          impuesto_isae_a_pagar_usd: Math.round((totalIsaeBs / bcvRate) * 100) / 100,
          ahorro_tributario_patente_bs: ahorroFiscalBs,
          ahorro_tributario_patente_usd: ahorroFiscalUsd,
          estimacion_aseo_urbano_usd: tasaAseoEstimadaUsd,
          estimacion_aseo_urbano_bs: tasaAseoEstimadaBs
        },
        items: items
      };
    },

    /**
     * Exporta la Matriz de Declaración Municipal a formato CSV compatible con Excel y portales fiscales.
     */
    exportarMatrizAlcaldiaCSV(declaracion) {
      const headers = [
        'N° Op',
        'Local / Unidad',
        'Razón Social Inquilino',
        'RIF Inquilino',
        'N° Factura',
        'N° Control',
        'Fecha Emisión',
        'Canon Gravable (USD)',
        'Expensas Condominio Exentas (USD)',
        'Total Cobrado (USD)',
        'Base Imponible ISAE (Bs)',
        'Condominio No Gravable (Bs)',
        'Alícuota ISAE %',
        'Impuesto Municipal ISAE (Bs)',
        'Tasa BCV Aplicada',
        'Fundamento No Sujeción Condominio'
      ];

      const rows = [headers.join(';')];

      (declaracion.items || []).forEach(r => {
        rows.push([
          r.op,
          '"' + r.unit_number + '"',
          '"' + r.tenant_name + '"',
          '"' + r.tenant_rif + '"',
          '"' + r.invoice_number + '"',
          '"' + r.control_number + '"',
          r.fecha,
          r.canon_usd.toFixed(2),
          r.condo_usd.toFixed(2),
          r.total_usd.toFixed(2),
          r.base_imponible_bs.toFixed(2),
          r.condo_bs.toFixed(2),
          r.alicuota_isae_pct.toFixed(2),
          r.impuesto_isae_bs.toFixed(2),
          declaracion.tasa_bcv_aplicada.toFixed(2),
          '"' + r.tratamiento_condominio + '"'
        ].join(';'));
      });

      return rows.join('\n');
    }
  };

  global.AlcaldiaEngine = AlcaldiaEngine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlcaldiaEngine;
    module.exports.AlcaldiaEngine = AlcaldiaEngine;
    module.exports.default = AlcaldiaEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
