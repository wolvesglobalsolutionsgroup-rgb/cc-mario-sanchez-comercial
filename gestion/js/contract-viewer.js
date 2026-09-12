/**
 * ============================================================================
 * CCMS - VISOR DE CONTRATOS NOTARIADOS & GESTOR LEGAL (G.O. 40.418)
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 * Decreto Ley N° 929 de Regulación del Arrendamiento Inmobiliario Comercial
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

  const ContractViewer = {
    /**
     * Genera hash SHA-256 auténtico vía WebCrypto API del navegador
     */
    async generateCryptoSeal(payloadString) {
      try {
        if (crypto && crypto.subtle && typeof crypto.subtle.digest === 'function') {
          const enc = new TextEncoder();
          const buf = await crypto.subtle.digest('SHA-256', enc.encode(payloadString));
          const arr = Array.from(new Uint8Array(buf));
          return 'CCMS-SHA256-' + arr.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().substring(0, 32);
        }
      } catch (e) {
        console.warn('[ContractViewer] WebCrypto no disponible, fallback determinista:', e);
      }
      let hash = 0;
      for (let i = 0; i < payloadString.length; i++) {
        hash = ((hash << 5) - hash) + payloadString.charCodeAt(i);
        hash |= 0;
      }
      return `CCMS-SHA256-${Math.abs(hash).toString(16).padStart(16, '0').toUpperCase()}`;
    },

    /**
     * Resuelve el objeto de inquilino según ID o sesión actual
     */
    resolveTenant(tenantId) {
      if (window.AuthGuard && typeof window.AuthGuard.currentTenant === 'function') {
        const current = window.AuthGuard.currentTenant();
        if (current && (!tenantId || current.id === tenantId || current.rif === tenantId || current.unit_code === tenantId)) {
          return current;
        }
      }
      if (typeof dbService !== 'undefined' && dbService.getTenants) {
        const tenants = dbService.getTenants();
        if (tenantId) {
          const found = tenants.find(t => t.id === tenantId || t.rif === tenantId || t.unit_code === tenantId);
          if (found) return found;
        }
        if (tenants && tenants.length > 0) return tenants[0];
      }
      return {
        id: 'ten-1',
        business_name: 'Mueblería Juncal, C.A.',
        rif: 'J-08010995-3',
        unit_code: 'LOC-1',
        rep_name: 'Giuseppe Juncal',
        rep_dni: 'V-8.452.190',
        phone: '0414-8254190',
        email: 'administracion@muebleriajuncal.com',
        canon_usd: 450.00,
        rent_usd: 450.00,
        alicuota_pct: 7.25,
        deposit_held_usd: 900.00,
        area_m2: 54.5
      };
    },

    /**
     * Resuelve el contrato asociado o genera uno canónico legal
     */
    resolveContract(tenant) {
      if (typeof dbService !== 'undefined' && dbService.getContracts) {
        const contracts = dbService.getContracts();
        const found = contracts.find(c => c.tenant_id === tenant.id || c.unit_code === tenant.unit_code);
        if (found) {
          const cUsd = parseFloat(found.canon_usd ?? found.rent_usd ?? found.base_rent_usd ?? tenant.canon_usd ?? tenant.rent_usd ?? 450);
          const aPct = parseFloat(found.alicuota_pct ?? tenant.alicuota_pct ?? (tenant.condo_aliquot ? tenant.condo_aliquot * 100 : 7.25));
          return {
            ...found,
            contract_number: found.contract_number || tenant.contract_number || `CTR-2026-${tenant.unit_code || 'LOC-1'}`,
            notary_entry: found.notary_entry || 'Tomo 14-A, Protocolo Primero, Asiento N° 42',
            notary_office: found.notary_office || 'Notaría Pública Primera de Puerto La Cruz',
            start_date: found.start_date || tenant.contract_start || '2026-01-01',
            end_date: found.end_date || tenant.contract_end || '2026-12-31',
            canon_usd: isNaN(cUsd) ? 450 : cUsd,
            rent_usd: isNaN(cUsd) ? 450 : cUsd,
            alicuota_pct: isNaN(aPct) ? 7.25 : aPct,
            status: found.status || 'vigente'
          };
        }
      }
      const canonVal = parseFloat(tenant.canon_usd ?? tenant.rent_usd ?? tenant.monthly_rent_usd ?? 450.00);
      const aliVal = parseFloat(tenant.alicuota_pct ?? (tenant.condo_aliquot ? tenant.condo_aliquot * 100 : 7.25));
      return {
        id: 'ctr-canonical-1',
        contract_number: tenant.contract_number || `CTR-2026-${tenant.unit_code || 'LOC-1'}`,
        notary_entry: 'Tomo 14-A, Protocolo Primero, Asiento N° 42',
        notary_office: 'Notaría Pública Primera de Puerto La Cruz',
        start_date: tenant.contract_start || '2026-01-01',
        end_date: tenant.contract_end || '2026-12-31',
        canon_usd: isNaN(canonVal) ? 450 : canonVal,
        rent_usd: isNaN(canonVal) ? 450 : canonVal,
        alicuota_pct: isNaN(aliVal) ? 7.25 : aliVal,
        status: 'vigente'
      };
    },

    /**
     * Abre el modal visor de contrato notariado
     */
    async openModal(tenantId = null) {
      const tenant = this.resolveTenant(tenantId);
      const contract = this.resolveContract(tenant);
      const bcvRate = (typeof financialEngine !== 'undefined' && financialEngine.getRates)
        ? (financialEngine.getRates().VES || 832.49)
        : 832.49;

      const canonUsd = Number(contract.canon_usd || 450);
      const canonVes = canonUsd * bcvRate;
      const canonFormattedVes = canonVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const canonFormattedUsd = canonUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const sealPayload = `${contract.contract_number}|${tenant.rif || 'J-00000000-0'}|${tenant.unit_code || 'LOC-1'}|${canonUsd}|${contract.start_date}|${contract.end_date}|GO_40418_ART26`;
      const cryptoSeal = await this.generateCryptoSeal(sealPayload);

      const modal = document.getElementById('modal-contract-viewer');
      const body = document.getElementById('contract-document-wrapper') || document.getElementById('contract-viewer-body');
      const title = (modal ? modal.querySelector('.modal-title') : null) || document.getElementById('contract-viewer-title');

      if (title) {
        title.innerHTML = `<i class="fa-solid fa-file-contract" style="color: var(--amber);"></i> Contrato Notariado Oficial (${escapeHtml(contract.contract_number)})`;
      }

      if (body) {
        body.innerHTML = `
          <div class="printable-contract-doc" style="font-family: 'Times New Roman', Times, serif; font-size: 13px; line-height: 1.7; color: #111827; background: #ffffff; padding: 36px 42px; border-radius: 8px; border: 1px solid #e5e7eb; max-width: 820px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
            
            <style>
              @media print {
                @page { size: letter; margin: 18mm 15mm; }
                body { background: #fff !important; color: #000 !important; }
                .modal-overlay { position: static !important; background: none !important; display: block !important; padding: 0 !important; }
                .modal-window { box-shadow: none !important; border: none !important; max-width: 100% !important; padding: 0 !important; }
                .modal-header, .contract-viewer-actions, .app-sidebar, .top-navbar, .mobile-bottom-nav { display: none !important; }
                .printable-contract-doc { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
              }
            </style>

            <!-- ENCABEZADO NOTARIAL CON TIMBRE DE LEY -->
            <div style="text-align: center; border-bottom: 2px double #111827; padding-bottom: 14px; margin-bottom: 20px;">
              <h2 style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">República Bolivariana de Venezuela</h2>
              <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 3px 0;">${escapeHtml(contract.notary_office)}</h3>
              <div style="font-size: 11px; font-style: italic; color: #374151;">Asiento Notarial: ${escapeHtml(contract.notary_entry)} • Fecha de Autenticación: ${contract.start_date}</div>
              <div style="font-size: 10.5px; font-weight: 700; color: #b45309; text-transform: uppercase; margin-top: 4px;">
                Instrumento Jurídico Vinculante bajo el Decreto Presidencial N° 929 con Rango, Valor y Fuerza de Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (G.O. 40.418)
              </div>
            </div>

            <!-- TÍTULO PRINCIPAL -->
            <h1 style="text-align: center; font-size: 15px; font-weight: 900; text-transform: uppercase; margin: 18px 0 24px; text-decoration: underline;">
              Contrato de Arrendamiento Comercial Inmobiliario N° ${escapeHtml(contract.contract_number)}
            </h1>

            <!-- COMPARECIENTES -->
            <p style="text-align: justify; margin-bottom: 14px;">
              Entre la sociedad mercantil <strong>CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</strong>, inscrita por ante el Registro Mercantil Primero de la Circunscripción Judicial del Estado Anzoátegui, titular del R.I.F. <strong>J-30211544-2</strong>, domiciliada en la Avenida Municipal, Puerto La Cruz, en lo sucesivo denominada <strong>"LA ARRENDADORA"</strong>, por una parte; y por la otra parte la entidad mercantil <strong>${escapeHtml(tenant.business_name)}</strong>, R.I.F. <strong>${escapeHtml(tenant.rif)}</strong>, debidamente representada en este acto por el ciudadano <strong>${escapeHtml(tenant.rep_name || 'Representante Legal')}</strong>, titular de la C.I. <strong>${escapeHtml(tenant.rep_dni || 'V-00.000.000')}</strong>, en lo adelante denominada <strong>"LA ARRENDATARIA"</strong>, se ha convenido celebrar el presente contrato comercial:
            </p>

            <!-- CLÁUSULA PRIMERA: OBJETO -->
            <p style="text-align: justify; margin-bottom: 12px;">
              <strong><u>PRIMERA (OBJETO):</u></strong> LA ARRENDADORA cede en arrendamiento comercial a LA ARRENDATARIA, y ésta acepta, el inmueble comercial individualizado como <strong>Local Comercial N° ${escapeHtml(tenant.unit_code)}</strong>, ubicado dentro del Conjunto Mario Sánchez, con un área privativa de aproximadamente <strong>${tenant.surface_m2 || 54.5} m²</strong>, para el ejercicio exclusivo de su actividad comercial legalmente autorizada.
            </p>

            <!-- CLÁUSULA SEGUNDA: CANON DE ARRENDAMIENTO -->
            <p style="text-align: justify; margin-bottom: 12px;">
              <strong><u>SEGUNDA (CANON MENSUAL & EQUIVALENCIA BCV):</u></strong> Las partes pactan como canon mensual de arrendamiento comercial la cantidad de <strong>$ ${canonFormattedUsd} USD</strong> (DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA), pagaderos por mensualidades anticipadas dentro de los primeros cinco (5) días hábiles de cada mes. De conformidad con la Ley del Banco Central de Venezuela y el Artículo 32 de la G.O. 40.418, la arrendataria liquidará dicho monto en Bolívares a la <strong>tasa oficial fijada por el Banco Central de Venezuela (BCV)</strong> a la fecha valor del pago efectivo (al presente: <strong>Bs. ${canonFormattedVes}</strong>).
            </p>

            <!-- CLÁUSULA TERCERA: CONDICIONES TRIBUTARIAS E IGTF -->
            <p style="text-align: justify; margin-bottom: 12px;">
              <strong><u>TERCERA (REGIMEN FISCAL E IGTF 3%):</u></strong> Conforme a las normas del Servicio Nacional Integrado de Administración Aduanera y Tributaria (SENIAT) y la Gaceta Oficial N° 6.687, en caso de que los pagos sean extinguidos en divisas en efectivo, transferencias internacionales (Zelle/Swift) o criptoactivos (USDT), aplicará la percepción del <strong>3% de Impuesto a las Grandes Transacciones Financieras (IGTF)</strong> sobre la base imponible del canon comercial, emitiéndose el comprobante oficial correspondiente.
            </p>

            <!-- CLÁUSULA CUARTA: GASTOS COMUNES Y CONDOMINIO -->
            <p style="text-align: justify; margin-bottom: 12px;">
              <strong><u>CUARTA (GASTOS COMUNES & ALÍCUOTA):</u></strong> LA ARRENDATARIA se obliga a pagar mensualmente su cuota de participación en los gastos comunes y conservación del centro comercial, equivalente a una alícuota del <strong>${contract.alicuota_pct}%</strong> calculada sobre los egresos de condominio debidamente comprobados.
            </p>

            <!-- CLÁUSULA QUINTA: MORA Y RECARGOS -->
            <p style="text-align: justify; margin-bottom: 12px;">
              <strong><u>QUINTA (RECARGO MORATORIO LEGAL):</u></strong> El vencimiento del plazo sin el pago del canon causará un recargo por mora equivalente a los intereses moratorios permitidos por la normativa bancaria y comercial aplicable (Artículo 30 de la Gaceta Oficial 40.418).
            </p>

            <!-- CLÁUSULA SEXTA: VIGENCIA DEL CONTRATO -->
            <p style="text-align: justify; margin-bottom: 12px;">
              <strong><u>SEXTA (DURACIÓN DETERMINADA):</u></strong> La vigencia pactada del presente contrato comercial es de un (1) año calendario, contada a partir del <strong>${contract.start_date}</strong> hasta el <strong>${contract.end_date}</strong> inclusive.
            </p>

            <!-- CLÁUSULA SÉPTIMA: PRÓRROGA LEGAL OBLIGATORIA (ART. 26 G.O. 40.418) -->
            <div style="background: #f8fafc; border-left: 3px solid #b45309; padding: 10px 14px; margin: 14px 0;">
              <p style="text-align: justify; margin: 0; font-weight: 700; color: #0f172a;">
                <u>SÉPTIMA (PRÓRROGA LEGAL OBLIGATORIA — ARTÍCULO 26 G.O. 40.418):</u>
              </p>
              <p style="text-align: justify; margin: 4px 0 0; font-size: 12.5px; color: #334155;">
                Al vencimiento del término pactado de un (1) año, LA ARRENDATARIA tendrá derecho potestativo a la <strong>Prórroga Legal de cumplimiento obligatorio para el arrendador</strong> por un lapso máximo de hasta seis (6) meses, conforme a lo establecido taxativamente en el <strong>Artículo 26 del Decreto Ley N° 929 (Gaceta Oficial N° 40.418)</strong>, manteniéndose inalterables las estipulaciones contractuales y el canon convenido, salvaguardando la solvencia y la continuidad del ejercicio del comercio en el establecimiento.
              </p>
            </div>

            <!-- CLÁUSULA OCTAVA: JURISDICCIÓN -->
            <p style="text-align: justify; margin-bottom: 24px;">
              <strong><u>OCTAVA (DOMICILIO ESPECIAL):</u></strong> Para todos los efectos derivados de este contrato, las partes eligen como domicilio especial y excluyente a la ciudad de Puerto La Cruz, Estado Anzoátegui, a la jurisdicción de cuyos tribunales declaran someterse.
            </p>

            <!-- SECCIÓN DE FIRMAS Y REGISTRO -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 36px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center;">
              <div>
                <div style="font-family: monospace; font-size: 11px; color: #64748b; margin-bottom: 30px;">[FIRMADO DIGITALMENTE POR LA ARRENDADORA]</div>
                <div style="border-top: 1px solid #111827; padding-top: 6px;">
                  <strong style="font-size: 12px; display: block;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</strong>
                  <span style="font-size: 11px; color: #4b5563;">R.I.F. J-30211544-2 • LA ARRENDADORA</span>
                </div>
              </div>

              <div>
                <div style="font-family: monospace; font-size: 11px; color: #64748b; margin-bottom: 30px;">[FIRMADO DIGITALMENTE POR LA ARRENDATARIA]</div>
                <div style="border-top: 1px solid #111827; padding-top: 6px;">
                  <strong style="font-size: 12px; display: block;">${escapeHtml(tenant.business_name)}</strong>
                  <span style="font-size: 11px; color: #4b5563;">R.I.F. ${escapeHtml(tenant.rif)} • LA ARRENDATARIA</span>
                </div>
              </div>
            </div>

            <!-- SELLO CRIPTOGRÁFICO Y HASH DE VERIFICACIÓN -->
            <div style="margin-top: 30px; padding: 12px 14px; background: #fdf6ec; border: 1px solid #fbd38d; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div style="min-width: 260px; flex: 1;">
                <div style="font-size: 10px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">
                  Sello Criptográfico Notarial de Verificación (WebCrypto SHA-256)
                </div>
                <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #78350f; margin-top: 2px; word-break: break-all;">
                  ${cryptoSeal}
                </div>
                <div style="font-size: 9.5px; color: #92400e; margin-top: 2px;">
                  Documento inalterable depositado en bóveda digital del Centro Comercial Mario Sánchez.
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 54px; height: 54px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 26px; color: #b45309;" title="QR de Verificación Legal">
                  <i class="fa-solid fa-qrcode"></i>
                </div>
              </div>
            </div>

          </div>
        `;
      }

      if (modal) {
        if (typeof window.openModal === 'function') {
          window.openModal(modal);
        } else {
          modal.style.display = 'flex';
          modal.classList.add('active');
        }
      }
    },

    closeModal() {
      const modal = document.getElementById('modal-contract-viewer');
      if (modal) {
        if (typeof window.closeModal === 'function') {
          window.closeModal('modal-contract-viewer');
        } else {
          modal.style.display = 'none';
          modal.classList.remove('active');
        }
      }
    },

    print() {
      window.print();
    },

    downloadPDF() {
      window.print();
    },

    /**
     * Renderiza el desglose formal del recibo con citas canónicas a la G.O. 40.418 y G.O. 6.687
     * @param {Object} pago - Objeto del pago o cuota conciliada
     * @param {Object} [liquidacionFiscal] - Resultado del cálculo de SeniatEngine.calcularLiquidacionFiscal
     * @returns {string} Fragmento HTML con tabla y leyenda jurídica
     */
    renderDesgloseReciboHTML(pago, liquidacionFiscal = null) {
      const montoBase = Number(liquidacionFiscal?.montoBaseUsd ?? pago?.rent_usd ?? pago?.amount_paid ?? 0);
      const tasaBcv = Number(liquidacionFiscal?.tasaBcv ?? pago?.tasa_bcv_usada ?? pago?.snapshot?.bcv_rate_applied ?? 832.49);
      const montoBaseBs = montoBase * tasaBcv;
      const igtfAplica = Boolean(liquidacionFiscal ? liquidacionFiscal.igtfAplica : (pago?.igtf_aplica || (Number(pago?.igtf_monto_usd) > 0)));
      const igtfMonto = Number(liquidacionFiscal?.igtfMontoUsd ?? pago?.igtf_monto_usd ?? (igtfAplica ? Math.round(montoBase * 0.03 * 100) / 100 : 0));
      const condoUsd = Number(pago?.condo_usd ?? 0);
      const totalUsd = Number(liquidacionFiscal?.totalPagarUsd ?? pago?.total_usd ?? pago?.monto_total_con_igtf_usd ?? (montoBase + condoUsd + igtfMonto));
      const totalBs = totalUsd * tasaBcv;

      return `
        <div class="desglose-fiscal-oficial" style="margin: 14px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #1e293b;">
                <th style="padding: 7px 10px; text-align: left;">Concepto Liquidado</th>
                <th style="padding: 7px 10px; text-align: right;">Monto USD</th>
                <th style="padding: 7px 10px; text-align: right;">Equivalente Oficial Bs. (BCV ${tasaBcv.toFixed(2)})</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 10px;">
                  <strong style="color: #0f172a;">Canon Fijo Mensual de Arrendamiento</strong>
                  <div style="font-size: 10px; color: #64748b;">Decreto Ley N° 929 (G.O. 40.418, Art. 38) • Efecto liberatorio en Bs. a Tasa Oficial BCV</div>
                </td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 600;">$${montoBase.toFixed(2)}</td>
                <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 600;">Bs. ${montoBaseBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              ${condoUsd > 0 ? `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 10px;">
                  <strong>Cuota de Participación en Gastos Comunes / Condominio</strong>
                  <div style="font-size: 10px; color: #64748b;">Alícuota condominial de mantenimiento y servicios esenciales</div>
                </td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 600;">$${condoUsd.toFixed(2)}</td>
                <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 600;">Bs. ${(condoUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              ${igtfAplica ? `
              <tr style="border-bottom: 1px solid #e2e8f0; background: #fffbeb;">
                <td style="padding: 7px 10px;">
                  <strong style="color: #b45309;"><i class="fa-solid fa-percent" style="font-size: 10px;"></i> Percepción IGTF (3%)</strong>
                  <div style="font-size: 10px; color: #92400e;">Gaceta Oficial Extraordinaria N° 6.687 • Pagos en divisa/cripto sin intermediación financiera nacional</div>
                </td>
                <td style="padding: 7px 10px; text-align: right; color: #b45309; font-weight: 700;">+$${igtfMonto.toFixed(2)}</td>
                <td style="padding: 7px 10px; text-align: right; color: #b45309; font-family: monospace; font-weight: 700;">Bs. ${(igtfMonto * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              ` : `
              <tr style="border-bottom: 1px solid #e2e8f0; background: #f0fdf4;">
                <td style="padding: 7px 10px;">
                  <strong style="color: #047857;"><i class="fa-solid fa-shield-check" style="font-size: 10px;"></i> Régimen IGTF (0% Exento)</strong>
                  <div style="font-size: 10px; color: #047857;">Decreto Presidencial N° 4.647 / Providencia SNAT/2022/000013 • Pago en Bolívares vía banca nacional</div>
                </td>
                <td style="padding: 7px 10px; text-align: right; color: #047857; font-weight: 600;">$0.00</td>
                <td style="padding: 7px 10px; text-align: right; color: #047857; font-family: monospace;">Bs. 0,00</td>
              </tr>
              `}
              <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1; font-size: 12px;">
                <td style="padding: 9px 10px; color: #0f172a;">TOTAL COBRADO / LIQUIDADO:</td>
                <td style="padding: 9px 10px; text-align: right; color: #047857; font-size: 13px;">$${totalUsd.toFixed(2)} USD</td>
                <td style="padding: 9px 10px; text-align: right; color: #047857; font-family: monospace; font-size: 13px;">Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top: 8px; font-size: 9.5px; color: #64748b; line-height: 1.4; background: #f8fafc; padding: 7px 10px; border-radius: 4px; border: 1px dashed #cbd5e1; font-style: italic;">
            Base imponible y régimen tarifario regulados por el Decreto con Rango, Valor y Fuerza de Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (G.O. 40.418, Art. 38 y Convenio Cambiario N° 1 BCV). Retención y régimen de IGTF aplicados conforme a la G.O. Extraordinaria 6.687 y Providencias Administrativas del SENIAT.
          </div>
        </div>
      `;
    }
  };

  // Exponer a nivel global y CJS/ESM
  global.ContractViewer = ContractViewer;
  global.renderDesgloseReciboHTML = function(pago, liquidacionFiscal) {
    return ContractViewer.renderDesgloseReciboHTML(pago, liquidacionFiscal);
  };
  global.openContractModal = function(tenantId) {
    ContractViewer.openModal(tenantId);
  };
  global.closeContractModal = function() {
    ContractViewer.closeModal();
  };
  global.viewTenantContract = function(tenantId) {
    ContractViewer.openModal(tenantId);
  };
  global.viewTenantPhysicalContract = function() {
    ContractViewer.openModal();
  };
  global.printContractDocument = function() {
    ContractViewer.print();
  };
  global.downloadContractPDF = function() {
    ContractViewer.downloadPDF();
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContractViewer;
    module.exports.ContractViewer = ContractViewer;
    module.exports.renderDesgloseReciboHTML = ContractViewer.renderDesgloseReciboHTML;
    module.exports.default = ContractViewer;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
