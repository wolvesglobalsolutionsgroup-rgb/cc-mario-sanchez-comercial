/**
 * ============================================================================
 * CCMS - MÓDULO DE GESTIÓN SUCESORAL & FRUTOS PATRIMONIALES (FASE 6)
 * Sucesión Mario Sánchez (RIF: J-30211544-2) — 14 Coherederos / Comunidad Indivisa
 * Arts. 552 y 768 del Código Civil Venezolano
 * Arquitectura Desacoplada (Dimensión 9: Desmonolito)
 * ============================================================================
 */

(function(global) {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const COHEREDEROS_DEFECTO = [
    { id: 1, name: "Estirpe Mario Sánchez Jr.", doc: "V-8.452.190", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 2, name: "Estirpe Narváez Sánchez (Local 4-A)", doc: "V-9.821.405", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 3, name: "Coheredero Estirpe Sánchez Mendoza", doc: "V-11.234.567", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 4, name: "Coheredero Estirpe Sánchez Gil", doc: "V-12.890.123", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 5, name: "Coheredero Estirpe Sánchez Rodríguez", doc: "V-10.456.789", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 6, name: "Coheredero Estirpe Sánchez Ramos", doc: "V-13.456.001", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 7, name: "Coheredero Estirpe Sánchez Velásquez", doc: "V-14.789.234", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 8, name: "Coheredero Estirpe Sánchez Carvajal", doc: "V-15.012.345", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 9, name: "Coheredero Estirpe Sánchez Salazar", doc: "V-16.123.890", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 10, name: "Coheredero Estirpe Sánchez Rondón", doc: "V-17.234.901", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 11, name: "Coheredero Estirpe Sánchez Guzmán", doc: "V-18.345.678", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 12, name: "Coheredero Estirpe Sánchez Marcano", doc: "V-19.456.789", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 13, name: "Coheredero Estirpe Sánchez Blanco", doc: "V-20.567.890", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" },
    { id: 14, name: "Coheredero Estirpe Sánchez Gómez", doc: "V-21.678.901", sharePct: "7.142857%", shareFrac: "1/14", status: "Disponible" }
  ];

  const HerederosManager = {
    getCoherederos() {
      return COHEREDEROS_DEFECTO;
    },

    /**
     * Actualiza el indicador visual / tarjeta KPI en el Dashboard ejecutivo.
     * Solo se muestra si la organización tiene régimen sucesoral activo (Fase 6 Multi-tenant).
     */
    renderKPI(isDirectiva, orgFeatures, sysSettings = {}) {
      const frutoEl = document.getElementById('kpi-fruto-patrimonial');
      const frutoCard = document.getElementById('card-kpi-fruto-patrimonial');
      const frutoSub = document.getElementById('kpi-fruto-patrimonial-sub');
      if (!frutoEl) return;

      const hasRegimenSucesoral = isDirectiva && (orgFeatures?.regimen_sucesoral?.activo === true);

      if (hasRegimenSucesoral) {
        const cuotaBaseHeredero = parseFloat(orgFeatures?.regimen_sucesoral?.cuota_base || sysSettings.cuota_base_heredero_usd) || 400.00;
        const coherederosCount = parseInt(orgFeatures?.regimen_sucesoral?.coherederos, 10) || 14;
        const totalFrutosBase = cuotaBaseHeredero * coherederosCount;

        const formatMoney = global.formatMoney || ((val) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        frutoEl.innerText = formatMoney(totalFrutosBase);
        if (frutoSub) {
          frutoSub.innerText = `${coherederosCount} cuotas de ${formatMoney(cuotaBaseHeredero)} • Clic para desglose`;
        }
        if (frutoCard) frutoCard.style.display = '';
      } else if (frutoCard) {
        frutoCard.style.display = 'none';
      }
    },

    /**
     * Navegación directa desde la tarjeta de KPI al informe de liquidación
     */
    navigateToFrutoPatrimonial() {
      if (typeof global.switchTab === 'function') {
        global.switchTab('informes');
      }
      const select = document.getElementById('report-type-select');
      if (select) {
        select.value = 'herederos';
        if (typeof global.onReportTypeChange === 'function') global.onReportTypeChange();
        if (typeof global.generateSelectedReport === 'function') global.generateSelectedReport();
      }
      setTimeout(() => {
        const container = document.getElementById('report-display-container') || document.getElementById('tab-informes');
        if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    },

    /**
     * Genera el informe HTML oficial de liquidación sucesoral (Informe 11)
     */
    renderReportHTML(month, year) {
      const dbService = global.dbService || (typeof global.DatabaseService === 'function' ? (global._dbServiceInstance || (global._dbServiceInstance = new global.DatabaseService())) : null);
      const financialEngine = global.financialEngine || (typeof global.FinancialEngine === 'function' ? (global._financialEngineInstance || (global._financialEngineInstance = new global.FinancialEngine())) : null);
      const invoices = dbService && typeof dbService.getInvoices === 'function'
        ? dbService.getInvoices().filter(i => Number(i.period_month) === Number(month) && Number(i.period_year) === Number(year))
        : [];

      // Total facturado y cobrado de los 39 locales
      let totalFacturadoUsd = 0;
      let totalCobradoUsd = 0;
      invoices.forEach(inv => {
        const rent = parseFloat(inv.rent_usd !== undefined ? inv.rent_usd : (inv.base_rent_usd || 0)) || 0;
        const condo = parseFloat(inv.condo_usd || 0) || 0;
        const total = parseFloat(inv.total_usd !== undefined ? inv.total_usd : (rent + condo)) || 0;
        totalFacturadoUsd += total;
        if (inv.status === 'pagado') totalCobradoUsd += total;
      });

      const baseIngresos = totalCobradoUsd;

      // Egresos comunes
      const sysSettings = (dbService && dbService.getSettings) ? dbService.getSettings() : {};
      const allDbExpenses = dbService && dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
      const expensesPeriod = allDbExpenses.filter(e => Number(e.period_month) === Number(month) && Number(e.period_year) === Number(year));
      const totalGastosUsd = expensesPeriod.length > 0
        ? expensesPeriod.reduce((sum, e) => sum + (parseFloat(e.amount_usd) || 0), 0)
        : (totalCobradoUsd > 0 ? (parseFloat(sysSettings.base_monthly_expenses_usd) || 0) : 0);

      const totalIngresosCents = Math.round(baseIngresos * 100);
      const totalGastosCents = Math.round(totalGastosUsd * 100);
      const utilidadNetaCents = Math.max(0, totalIngresosCents - totalGastosCents);
      const cuotaConfiguradaUsd = parseFloat(sysSettings.cuota_base_heredero_usd) || 400.00;
      const cuotaConfiguradaCents = Math.round(cuotaConfiguradaUsd * 100);
      const coherederos = this.getCoherederos();
      const numHerederos = coherederos.length || 14;

      // Si no hay ingresos cobrados o hay déficit, la cuota efectivamente liquidada es 0
      const totalFrutosBaseCents = (baseIngresos > 0 && utilidadNetaCents > 0)
        ? Math.min(cuotaConfiguradaCents * numHerederos, utilidadNetaCents)
        : 0;

      const baseCentsPerHeredero = Math.floor(totalFrutosBaseCents / numHerederos);
      const remainderCents = totalFrutosBaseCents % numHerederos;

      const totalFrutosBaseUsd = totalFrutosBaseCents / 100;
      const remanentePatrimonialUsd = Math.max(0, (utilidadNetaCents - totalFrutosBaseCents) / 100);
      const utilidadNetaUsd = utilidadNetaCents / 100;

      const rowsHtml = coherederos.map((h, idx) => {
        const heirCents = baseCentsPerHeredero + (idx < remainderCents ? 1 : 0);
        const heirUsd = heirCents / 100;
        const bsAmount = financialEngine && financialEngine.convert 
          ? financialEngine.convert(heirUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 })
          : (heirUsd * 40.0).toFixed(2);
        const estatusHeredero = baseIngresos <= 0 ? 'Sin recaudación' : (heirUsd > 0 ? h.status : 'Déficit / En espera');
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11.5px;">
            <td style="padding: 8px 10px; font-weight: 700; text-align: center;">${idx + 1}</td>
            <td style="padding: 8px 10px;">
              <strong>${escapeHtml(h.name)}</strong>
              <div style="font-size: 10px; color: #64748b;">Doc / C.I.: ${escapeHtml(h.doc)}</div>
            </td>
            <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #7c3aed;">${h.shareFrac} (${h.sharePct})</td>
            <td style="padding: 8px 10px; text-align: right; color: #64748b;">$${cuotaConfiguradaUsd.toFixed(2)}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0f172a;">$${heirUsd.toFixed(2)}</td>
            <td style="padding: 8px 10px; text-align: right; color: #475569;">Bs. ${bsAmount}</td>
            <td style="padding: 8px 10px; text-align: center;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: ${heirUsd > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)'}; color: ${heirUsd > 0 ? '#059669' : '#64748b'}; border: 1px solid ${heirUsd > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.3)'};">
                ${estatusHeredero}
              </span>
            </td>
          </tr>
        `;
      }).join('');

      const convertVES = (usd) => (financialEngine && financialEngine.convert)
        ? financialEngine.convert(usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 })
        : (usd * 40.0).toFixed(2);

      const baseIngresosBs = convertVES(baseIngresos);
      const totalGastosBs = convertVES(totalGastosUsd);
      const utilidadNetaBs = convertVES(utilidadNetaUsd);
      const totalFrutosBaseBs = convertVES(totalFrutosBaseUsd);
      const remanentePatrimonialBs = convertVES(remanentePatrimonialUsd);

      const renderHeader = global.renderOfficialReportHeaderHTML || ((t, num, sub) => `
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px; color: #0f172a;">${t}</h2>
          <div style="font-size: 11px; color: #64748b;">${sub} • N° ${num}</div>
        </div>
      `);

      return `
        <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
          ${renderHeader('LIQUIDACIÓN DE FRUTOS CIVILES SUCESORALES', `SUC-${year}-${String(month).padStart(2, '0')}`, 'Sucesión Mario Sánchez (RIF: J-30211544-2) • Arts. 552 y 768 Código Civil')}

          <!-- KPI CARDS SUCESORALES -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 22px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">1. Ingresos Recaudados</div>
              <div style="font-size: 15px; font-weight: 800; color: #0f172a;">$${baseIngresos.toFixed(2)}</div>
              <div style="font-size: 9.5px; color: #64748b;">Bs. ${baseIngresosBs}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #b91c1c;">2. Egresos Operativos</div>
              <div style="font-size: 15px; font-weight: 800; color: #b91c1c;">-$${totalGastosUsd.toFixed(2)}</div>
              <div style="font-size: 9.5px; color: #64748b;">Bs. ${totalGastosBs}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #0284c7;">3. Utilidad Neta en Caja</div>
              <div style="font-size: 15px; font-weight: 800; color: #0284c7;">$${utilidadNetaUsd.toFixed(2)}</div>
              <div style="font-size: 9.5px; color: #0284c7;">Bs. ${utilidadNetaBs}</div>
            </div>
            <div style="background: rgba(124, 58, 237, 0.08); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #7c3aed;">4. Fruto Base (14 Estirpes)</div>
              <div style="font-size: 15px; font-weight: 800; color: #7c3aed;">$${totalFrutosBaseUsd.toFixed(2)}</div>
              <div style="font-size: 9.5px; color: #7c3aed; font-weight: 700;">14 Cuotas (${remainderCents > 0 ? `base $${(baseCentsPerHeredero / 100).toFixed(2)} + restos` : `$${(baseCentsPerHeredero / 100).toFixed(2)} c/u`})</div>
            </div>
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #059669;">5. Remanente Patrimonial</div>
              <div style="font-size: 16px; font-weight: 900; color: #059669;">$${remanentePatrimonialUsd.toFixed(2)}</div>
              <div style="font-size: 9.5px; color: #059669; font-weight: 700;">Bs. ${remanentePatrimonialBs}</div>
            </div>
          </div>

          <!-- TABLA DE DISTRIBUCIÓN SUCESORAL -->
          <div style="margin-bottom: 22px;">
            <h4 style="font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px; color: #0f172a; border-left: 3px solid #7c3aed; padding-left: 8px;">
              Distribución Individual por Estirpe Hereditaria (1/14 Cuota Indivisa)
            </h4>
            <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 22px;">
              <table style="width: 100%; min-width: 650px; border-collapse: collapse; margin-top: 6px;">
                <thead>
                  <tr style="background: #0f172a; color: white; font-size: 10.5px; text-transform: uppercase;">
                    <th style="padding: 8px 10px; text-align: center; width: 35px;">N°</th>
                    <th style="padding: 8px 10px; text-align: left;">Coheredero / Estirpe</th>
                    <th style="padding: 8px 10px; text-align: center;">Alícuota Indivisa</th>
                    <th style="padding: 8px 10px; text-align: right;">Cuota Base Flujo</th>
                    <th style="padding: 8px 10px; text-align: right;">Liquidación Neta USD</th>
                    <th style="padding: 8px 10px; text-align: right;">Liquidación Neta Bs.</th>
                    <th style="padding: 8px 10px; text-align: center;">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                  <tr style="background: #f1f5f9; font-weight: 900; border-top: 2px solid #0f172a; font-size: 12px;">
                    <td colspan="2" style="padding: 10px;">TOTAL DISTRIBUIDO (14 ESTIRPES):</td>
                    <td style="padding: 10px; text-align: center; color: #7c3aed;">100.00% (14/14)</td>
                    <td style="padding: 10px; text-align: right; color: #64748b;">$${totalFrutosBaseUsd.toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right; color: #059669;">$${totalFrutosBaseUsd.toFixed(2)} USD</td>
                    <td style="padding: 10px; text-align: right; color: #0f172a;">Bs. ${totalFrutosBaseBs}</td>
                    <td style="padding: 10px; text-align: center; color: #059669;">✓ 100% Asignado</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- NOTAS LEGALES Y AUDITORÍA SUCESORAL -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 11px; margin-bottom: 25px; line-height: 1.5; color: #334155;">
            <strong>FUNDAMENTO LEGAL Y NORMAS DE PARTICIÓN:</strong>
            La presente liquidación se rige por los Artículos 552 (Frutos Civiles) y 768 (Comunidad Indivisa) del Código Civil de la República Bolivariana de Venezuela, en concordancia con el Decreto con Rango, Valor y Fuerza de Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (G.O. N° 40.418). Los montos calculados corresponden a las facturas cobradas y gastos operativos registrados en el sistema para el período, sujetos a conciliación bancaria definitiva, aprobación de la Junta de Sucesores y cierre contable.
          </div>

          <!-- FIRMAS AUTORIZADAS -->
          <div class="report-signatures-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; margin-top: 35px;">
            <div style="text-align: center;">
              <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px;">
                <strong>ADMINISTRACIÓN GENERAL & CONTABILIDAD</strong><br>
                Centro Comercial Mario Sánchez, C.A.<br>
                <span style="font-size: 10px; color: #64748b;">Firma y Sello Oficial</span>
              </div>
            </div>
            <div style="text-align: center;">
              <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px;">
                <strong>REPRESENTACIÓN SUCESORAL / ALBACEAZGO</strong><br>
                Sucesión Mario Sánchez (RIF: J-30211544-2)<br>
                <span style="font-size: 10px; color: #64748b;">Comité de Vigilancia Coherederos</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  };

  // Exposición en espacio de nombres y enlaces globales
  global.HerederosManager = HerederosManager;
  global.navigateToFrutoPatrimonial = () => HerederosManager.navigateToFrutoPatrimonial();
  global.renderHerederosReportHTML = (m, y) => HerederosManager.renderReportHTML(m, y);

})(typeof window !== 'undefined' ? window : global);
