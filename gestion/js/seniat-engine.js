/**
 * ==============================================================================
 * MOTOR DE CUMPLIMIENTO SENIAT Y LIBROS FISCALES OFICIALES
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 *
 * Cumplimiento de la Providencia Administrativa SENIAT SNAT/2014/0032
 * - Libro de Ventas Mensual (Art. 75-77 Reglamento Ley IVA)
 * - Libro de Compras y Gastos Comunes con Retenciones (75% / 100%)
 * - Relación de Retenciones de ISLR (Decreto 1808)
 * - Generador de Archivos TXT para Declaración Electrónica SENIAT
 * ==============================================================================
 */

(function (global) {
  'use strict';

  const SeniatEngine = {
    /**
     * Genera el Libro de Ventas Fiscal del período solicitado.
     */
    generateSalesBook(invoices, options = {}) {
      const month = options.month || new Date().getMonth() + 1;
      const year = options.year || new Date().getFullYear();
      const bcvRate = options.bcvRate || 807.38;

      const filtered = invoices.filter(inv => {
        const matchMonth = options.allMonths || inv.period_month === parseInt(month);
        const matchYear = inv.period_year === parseInt(year);
        return matchMonth && matchYear;
      });

      let opIndex = 1;
      let totalVentasBs = 0;
      let totalExentoBs = 0;
      let totalBaseBs = 0;
      let totalIvaBs = 0;
      let totalIvaRetenidoBs = 0;

      const rows = filtered.map(inv => {
        const totalUsd = inv.total_usd || 0;
        const totalBs = Math.round(totalUsd * bcvRate * 100) / 100;
        
        // El canon de arrendamiento comercial genera IVA 16% según Art. 1 Ley IVA
        const baseImponibleBs = Math.round((totalBs / 1.16) * 100) / 100;
        const ivaBs = Math.round((totalBs - baseImponibleBs) * 100) / 100;
        
        // Retención de IVA 75% si el inquilino es Contribuyente Especial
        const ivaRetenidoBs = inv.tenant_is_special_taxpayer ? Math.round(ivaBs * 0.75 * 100) / 100 : 0;

        totalVentasBs += totalBs;
        totalBaseBs += baseImponibleBs;
        totalIvaBs += ivaBs;
        totalIvaRetenidoBs += ivaRetenidoBs;

        return {
          op: opIndex++,
          fecha: inv.issue_date || `${year}-${String(month).padStart(2, '0')}-05`,
          rif: inv.tenant_rif || 'J-00000000-0',
          nombre: inv.tenant_name || 'Arrendatario Comercial',
          num_factura: inv.invoice_number || `FAC-${year}-${String(inv.id).slice(-4)}`,
          num_control: inv.control_number || `00-${String(opIndex).padStart(6, '0')}`,
          tipo_transaccion: '01-REG',
          num_factura_afectada: '',
          total_ventas_con_iva: totalBs,
          ventas_exentas: 0.00,
          base_imponible: baseImponibleBs,
          alicuota_iva_pct: 16.00,
          debito_fiscal: ivaBs,
          iva_retenido_por_comprador: ivaRetenidoBs,
          num_comprobante_retencion: ivaRetenidoBs > 0 ? `${year}${String(month).padStart(2, '0')}${String(opIndex).padStart(8, '0')}` : '',
          total_usd: totalUsd,
          tasa_bcv: bcvRate,
          status: inv.status
        };
      });

      return {
        periodo: `${String(month).padStart(2, '0')}/${year}`,
        fecha_emision: new Date().toISOString().split('T')[0],
        tasa_bcv_aplicada: bcvRate,
        resumen: {
          total_operaciones: rows.length,
          total_ventas_con_iva_bs: totalVentasBs,
          total_exento_bs: totalExentoBs,
          total_base_imponible_bs: totalBaseBs,
          total_debito_fiscal_bs: totalIvaBs,
          total_iva_retenido_bs: totalIvaRetenidoBs,
          total_ventas_usd: filtered.reduce((acc, i) => acc + i.total_usd, 0)
        },
        items: rows
      };
    },

    /**
     * Genera el Libro de Compras y Gastos Comunes del período solicitado.
     */
    generatePurchasesBook(expenses, options = {}) {
      const month = options.month || new Date().getMonth() + 1;
      const year = options.year || new Date().getFullYear();
      const bcvRate = options.bcvRate || 807.38;

      const filtered = expenses.filter(exp => {
        const matchMonth = options.allMonths || exp.period_month === parseInt(month);
        const matchYear = exp.period_year === parseInt(year);
        return matchMonth && matchYear;
      });

      let opIndex = 1;
      let totalComprasBs = 0;
      let totalExentoBs = 0;
      let totalBaseBs = 0;
      let totalCreditoBs = 0;
      let totalIvaRetenidoEfectuadoBs = 0;
      let totalIslrRetenidoBs = 0;

      const rows = filtered.map(exp => {
        const baseUsd = parseFloat(exp.amount_usd) || 0;
        const totalBs = Math.round(baseUsd * bcvRate * 100) / 100;
        
        const isExempt = !exp.withhold_iva && !exp.has_iva;
        const baseImponibleBs = isExempt ? 0 : Math.round((totalBs / 1.16) * 100) / 100;
        const creditoFiscalBs = isExempt ? 0 : Math.round((totalBs - baseImponibleBs) * 100) / 100;
        const exentasBs = isExempt ? totalBs : 0;

        // Retenciones efectuadas a proveedores (Agente de Retención)
        const ivaRetenidoBs = exp.withhold_iva ? Math.round(creditoFiscalBs * 0.75 * 100) / 100 : 0;
        const islrRetenidoBs = exp.withhold_islr ? Math.round(baseImponibleBs * 0.02 * 100) / 100 : 0;

        totalComprasBs += totalBs;
        totalExentoBs += exentasBs;
        totalBaseBs += baseImponibleBs;
        totalCreditoBs += creditoFiscalBs;
        totalIvaRetenidoEfectuadoBs += ivaRetenidoBs;
        totalIslrRetenidoBs += islrRetenidoBs;

        return {
          op: opIndex++,
          fecha: exp.date || `${year}-${String(month).padStart(2, '0')}-10`,
          rif_proveedor: exp.provider_rif || 'J-30000000-1',
          nombre_proveedor: exp.provider_name || 'Proveedor General',
          num_factura: exp.invoice_number || 'S/N',
          num_control: exp.control_number || '00-000000',
          concepto: exp.concept,
          categoria: exp.category || 'Mantenimiento',
          total_compras_con_iva: totalBs,
          compras_exentas: exentasBs,
          base_imponible: baseImponibleBs,
          alicuota_pct: isExempt ? 0 : 16.00,
          credito_fiscal: creditoFiscalBs,
          iva_retenido_efectuado: ivaRetenidoBs,
          islr_retenido_efectuado: islrRetenidoBs,
          num_comprobante_iva: ivaRetenidoBs > 0 ? `${year}${String(month).padStart(2, '0')}${String(opIndex).padStart(8, '0')}` : '',
          total_usd: baseUsd
        };
      });

      return {
        periodo: `${String(month).padStart(2, '0')}/${year}`,
        fecha_emision: new Date().toISOString().split('T')[0],
        tasa_bcv_aplicada: bcvRate,
        resumen: {
          total_operaciones: rows.length,
          total_compras_con_iva_bs: totalComprasBs,
          total_exento_bs: totalExentoBs,
          total_base_imponible_bs: totalBaseBs,
          total_credito_fiscal_bs: totalCreditoBs,
          total_iva_retenido_efectuado_bs: totalIvaRetenidoEfectuadoBs,
          total_islr_retenido_efectuado_bs: totalIslrRetenidoBs,
          total_gastos_usd: filtered.reduce((acc, e) => acc + (parseFloat(e.amount_usd) || 0), 0)
        },
        items: rows
      };
    },

    /**
     * Exporta el Libro de Ventas a formato CSV estándar compatible con Excel y SENIAT.
     */
    exportSalesBookCSV(salesBook) {
      const headers = [
        'Operación N°', 'Fecha', 'RIF Comprador', 'Razón Social Comprador',
        'N° Factura', 'N° Control', 'Tipo Transacción', 'Total Facturado (Bs)',
        'Ventas Exentas (Bs)', 'Base Imponible (Bs)', 'Alícuota %',
        'Débito Fiscal IVA (Bs)', 'IVA Retenido Comprador (Bs)', 'N° Comprobante Retención',
        'Equivalente USD', 'Tasa BCV'
      ];

      const csvRows = [headers.join(';')];

      salesBook.items.forEach(r => {
        csvRows.push([
          r.op,
          r.fecha,
          `"${r.rif}"`,
          `"${r.nombre}"`,
          `"${r.num_factura}"`,
          `"${r.num_control}"`,
          r.tipo_transaccion,
          r.total_ventas_con_iva.toFixed(2),
          r.ventas_exentas.toFixed(2),
          r.base_imponible.toFixed(2),
          r.alicuota_iva_pct.toFixed(2),
          r.debito_fiscal.toFixed(2),
          r.iva_retenido_por_comprador.toFixed(2),
          `"${r.num_comprobante_retencion}"`,
          r.total_usd.toFixed(2),
          r.tasa_bcv.toFixed(2)
        ].join(';'));
      });

      return csvRows.join('\n');
    },

    /**
     * Exporta el Libro de Compras a formato CSV.
     */
    exportPurchasesBookCSV(purchasesBook) {
      const headers = [
        'Operación N°', 'Fecha', 'RIF Proveedor', 'Nombre / Razón Social',
        'N° Factura', 'N° Control', 'Concepto', 'Categoría',
        'Total Compras (Bs)', 'Compras Exentas (Bs)', 'Base Imponible (Bs)',
        'Alícuota %', 'Crédito Fiscal IVA (Bs)', 'Retención IVA 75% (Bs)',
        'Retención ISLR 2% (Bs)', 'N° Comprobante IVA', 'Monto USD'
      ];

      const csvRows = [headers.join(';')];

      purchasesBook.items.forEach(r => {
        csvRows.push([
          r.op,
          r.fecha,
          `"${r.rif_proveedor}"`,
          `"${r.nombre_proveedor}"`,
          `"${r.num_factura}"`,
          `"${r.num_control}"`,
          `"${r.concepto}"`,
          `"${r.categoria}"`,
          r.total_compras_con_iva.toFixed(2),
          r.compras_exentas.toFixed(2),
          r.base_imponible.toFixed(2),
          r.alicuota_pct.toFixed(2),
          r.credito_fiscal.toFixed(2),
          r.iva_retenido_efectuado.toFixed(2),
          r.islr_retenido_efectuado.toFixed(2),
          `"${r.num_comprobante_iva}"`,
          r.total_usd.toFixed(2)
        ].join(';'));
      });

      return csvRows.join('\n');
    },

    /**
     * Genera el archivo TXT oficial para la declaración de retenciones de IVA en el portal SENIAT.
     * Estructura requerida por Providencia SNAT/2014/0032:
     * RIF_AGENTE\tPERIODO\tFECHA_FAC\tTIPO_OP\tTIPO_DOC\tRIF_SUJETO\tNUM_FAC\tNUM_CTRL\tMONTO_TOTAL\tBASE\tIVA_RETENIDO\tNUM_AFECT\tNUM_COMPROB\tEXENTO\tALICUOTA\tNUM_EXP
     */
    generateSeniatTxtRetention(purchasesBook, agentRif = 'J-29881234-0') {
      const lines = [];
      const cleanRif = (rif) => rif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const periodStr = purchasesBook.periodo.replace('/', '');

      purchasesBook.items.filter(r => r.iva_retenido_efectuado > 0).forEach(r => {
        const line = [
          cleanRif(agentRif),
          periodStr,
          r.fecha,
          'C', // Compra
          '01', // Factura
          cleanRif(r.rif_proveedor),
          r.num_factura.replace(/[^0-9A-Za-z-]/g, ''),
          r.num_control.replace(/[^0-9A-Za-z-]/g, ''),
          r.total_compras_con_iva.toFixed(2),
          r.base_imponible.toFixed(2),
          r.iva_retenido_efectuado.toFixed(2),
          '0',
          r.num_comprobante_iva,
          r.compras_exentas.toFixed(2),
          r.alicuota_pct.toFixed(2),
          '0'
        ].join('\t');
        lines.push(line);
      });

      return lines.join('\r\n');
    }
  };

  global.SeniatEngine = SeniatEngine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeniatEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
