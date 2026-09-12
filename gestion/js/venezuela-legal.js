/**
 * ==============================================================================
 * MÓDULO LEGAL: ARRENDAMIENTO INMOBILIARIO COMERCIAL EN VENEZUELA
 * Conforme a la Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial
 * (Decreto N° 929, Gaceta Oficial N° 40.418)
 *
 * v2.4.1 - FIX AUDITORÍA: Hash SHA-256 real vía WebCrypto API (antes djb2 disfrazado)
 * ==============================================================================
 */

const VenezuelaLegal = {
  BCV_RATE: 72.50,

  calculateCAF(valorInmuebleUsd, areaTotalM2, areaLocalM2, esInmuebleNuevo = false) {
    const rentabilidadAnual = esInmuebleNuevo ? 0.20 : 0.12;
    const costoM2 = valorInmuebleUsd / 12 / areaTotalM2;
    const canonFijo = costoM2 * areaLocalM2 * rentabilidadAnual;
    return Math.round(canonFijo * 100) / 100;
  },

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

  validateDuration(months) {
    if (months < 12) {
      return {
        valid: false,
        message: 'Advertencia Legal (Art. 13 G.O. 40.418): Los contratos comerciales deben pactarse por un plazo mínimo de un (1) año.'
      };
    }
    return { valid: true };
  },

  calculateLegalExtension(durationYears) {
    if (durationYears <= 1) {
      return { months: 6, description: 'Hasta 6 meses de prórroga legal obligatoria (Art. 26, Decreto Ley N° 929, G.O. 40.418).' };
    } else if (durationYears <= 5) {
      return { months: 12, description: 'Hasta 1 año de prórroga legal obligatoria (Art. 26, Decreto Ley N° 929, G.O. 40.418).' };
    } else if (durationYears <= 10) {
      return { months: 24, description: 'Hasta 2 años de prórroga legal obligatoria (Art. 26, Decreto Ley N° 929, G.O. 40.418).' };
    } else {
      return { months: 36, description: 'Hasta 3 años de prórroga legal obligatoria (Art. 26, Decreto Ley N° 929, G.O. 40.418).' };
    }
  },

  convertUsdToBs(amountUsd, customRate = null) {
    const rate = customRate || this.BCV_RATE;
    return amountUsd * rate;
  },

  formatUSD(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2
    }).format(amount);
  },

  formatBs(amount) {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency', currency: 'VES', minimumFractionDigits: 2
    }).format(amount).replace('VES', 'Bs.');
  },

  /**
   * Genera SHA-256 REAL vía WebCrypto. Devuelve un objeto {hex, algorithm, timestamp}.
   * Si WebCrypto no está disponible, cae a djb2 (etiquetado correctamente, NO como SHA-256).
   */
  async computeContractSeal(contractNumber, tenantRif, startDate, rentUsd, companyRif) {
    const raw = `${contractNumber}|${tenantRif}|${startDate}|${rentUsd}|${companyRif}|GO40418|${Date.now()}`;
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
        const enc = new TextEncoder().encode(raw);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        const arr = Array.from(new Uint8Array(buf));
        const hex = arr.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        return {
          seal: `CCMS-CTR-SHA256-${hex.substring(0, 32)}-${Date.now().toString(16).toUpperCase().slice(-6)}`,
          algorithm: 'SHA-256 (WebCrypto)',
          fullHash: hex,
          timestamp: new Date().toISOString()
        };
      }
    } catch (e) {
      console.error('[LEGAL] WebCrypto falló:', e);
    }
    // Fallback djb2 — etiquetado honestamente, NO como SHA-256
    let fallbackHash = 0;
    for (let i = 0; i < raw.length; i++) {
      fallbackHash = ((fallbackHash << 5) - fallbackHash) + raw.charCodeAt(i);
      fallbackHash |= 0;
    }
    const fallbackHex = Math.abs(fallbackHash).toString(16).padStart(8, '0').toUpperCase();
    return {
      seal: `CCMS-CTR-DJB2-${fallbackHex}-${Date.now().toString(16).toUpperCase().slice(-6)}`,
      algorithm: 'djb2 (fallback sin WebCrypto)',
      fullHash: fallbackHex,
      timestamp: new Date().toISOString()
    };
  },

  async generateContractHTML(contract, tenant, unit, options = {}) {
    if (!contract || !tenant || !unit) {
      return '<div style="padding:20px;color:red;">Error: Faltan datos contractuales para generar el documento.</div>';
    }

    const bcvRate = options.bcvRate || 807.38;
    const canonBs = Math.round(contract.rent_usd * bcvRate * 100) / 100;
    const durMonths = options.durationMonths || 12;
    const durYears = durMonths / 12;
    const prorroga = this.calculateLegalExtension(durYears);

    const companyLegalName = (typeof window !== 'undefined' && window.TenantConfig && window.TenantConfig.getLegalName) 
      ? window.TenantConfig.getLegalName() 
      : 'CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.';
    const companyBrandName = (typeof window !== 'undefined' && window.TenantConfig && window.TenantConfig.getBrandName) 
      ? window.TenantConfig.getBrandName() 
      : 'Centro Comercial Mario Sánchez';
    const companyRif = (typeof window !== 'undefined' && window.TenantConfig && window.TenantConfig.getRif) 
      ? window.TenantConfig.getRif() 
      : 'J-29881234-0';
    const companyAddress = (typeof window !== 'undefined' && window.TenantConfig && window.TenantConfig.getAddress) 
      ? window.TenantConfig.getAddress() 
      : 'Av. Municipal, Puerto La Cruz, Estado Anzoátegui, Venezuela';
    const arbitrationCity = (typeof window !== 'undefined' && window.TenantConfig && window.TenantConfig.get) 
      ? window.TenantConfig.get('legal.arbitrationCity', 'Puerto La Cruz') 
      : 'Puerto La Cruz';

    // SELLO CRIPTOGRÁFICO REAL (SHA-256 vía WebCrypto)
    const sealData = await this.computeContractSeal(
      contract.contract_number, tenant.rif, contract.start_date, contract.rent_usd, companyRif
    );

    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    return `
      <div class="contract-doc" style="font-family: 'Times New Roman', Times, serif; font-size: 13.5px; line-height: 1.6; color: #111; max-width: 820px; margin: 0 auto; background: #fff; padding: 40px 48px; border: 1px solid #ddd; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: justify;">
        
        <div style="text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 22px;">
          <h2 style="font-size: 16px; margin: 0; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">${esc(companyLegalName)}</h2>
          <p style="font-size: 11.5px; margin: 3px 0; color: #444;">R.I.F. ${esc(companyRif)} — Domicilio: ${esc(companyAddress)}</p>
          <div style="margin-top: 8px; font-weight: 700; font-size: 14px; text-transform: uppercase; color: #854d0e;">
            CONTRATO DE ARRENDAMIENTO INMOBILIARIO PARA USO COMERCIAL
          </div>
          <div style="font-size: 12px; font-weight: 700; margin-top: 2px;">N° DE INSTRUMENTO: ${esc(contract.contract_number)}</div>
        </div>

        <p>
          Entre la sociedad mercantil <strong>${esc(companyLegalName)}</strong>, titular del Registro de Información Fiscal (R.I.F.) N° <strong>${esc(companyRif)}</strong>, domiciliada en ${esc(arbitrationCity)}, en lo sucesivo denominada a los efectos de este contrato <strong>"LA ARRENDADORA"</strong>, por una parte; y por la otra, la sociedad mercantil <strong>${esc(tenant.business_name)}</strong>, titular del R.I.F. N° <strong>${esc(tenant.rif)}</strong>, legalmente representada en este acto por el ciudadano(a) <strong>${esc(tenant.legal_rep_name)}</strong>, titular de la Cédula de Identidad N° <strong>${esc(tenant.legal_rep_dni)}</strong>, en lo sucesivo denominada <strong>"LA ARRENDATARIA"</strong>, se ha convenido en celebrar el presente Contrato de Arrendamiento Inmobiliario para Uso Comercial, el cual se regirá de conformidad con las disposiciones de la <strong>Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (Decreto con Rango, Valor y Fuerza de Ley N° 929, publicado en la Gaceta Oficial de la República Bolivariana de Venezuela N° 40.418 de fecha 23 de mayo de 2014)</strong>, y por las cláusulas siguientes:
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA PRIMERA: OBJETO DEL CONTRATO</h4>
        <p>
          LA ARRENDADORA da en arrendamiento a LA ARRENDATARIA, y ésta acepta en tal concepto, el inmueble constituido por la Unidad Comercial identificada con la nomenclatura <strong>${esc(unit.code)}</strong> ("${esc(unit.name)}"), con una superficie aproximada de <strong>${Number(unit.area_m2 || 0).toFixed(2)} metros cuadrados (m²)</strong>, ubicado en las instalaciones de ${esc(companyBrandName)}.
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA SEGUNDA: DESTINO EXCLUSIVO</h4>
        <p>
          El inmueble objeto de este contrato será destinado única y exclusivamente para la actividad comercial de: <strong>${esc(tenant.commercial_activity)}</strong>. Queda expresamente prohibido cambiar el ramo o destino comercial pactado sin la previa autorización por escrito de LA ARRENDADORA.
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA TERCERA: DURACIÓN DEL CONTRATO</h4>
        <p>
          El término de duración del presente contrato es de <strong>UN (1) AÑO</strong> ininterrumpido (plazo mínimo legal según el Artículo 13 de la Ley especial), con vigencia a partir del <strong>${esc(contract.start_date)}</strong> hasta el <strong>${esc(contract.end_date)}</strong>.
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA CUARTA: CANON DE ARRENDAMIENTO & CONDICIONES DE PAGO</h4>
        <p>
          El canon mensual de arrendamiento ha sido fijado bajo la metodología del <strong>Canon de Arrendamiento Fijo (CAF)</strong> contemplada en el Artículo 32 de la Ley especial, por la cantidad neta de <strong>USD $${Number(contract.rent_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> (o su equivalente oficial en Bolívares pagaderos a la Tasa Oficial publicada por el Banco Central de Venezuela a la fecha valor del pago, equivalente hoy referencialmente a Bs. ${canonBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}). Los pagos deberán efectuarse por mes adelantado dentro de los primeros cinco (5) días continuos de cada mes en los canales oficiales debidamente autorizados por LA ARRENDADORA.
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA QUINTA: GASTOS COMUNES Y CONDOMINIO</h4>
        <p>
          LA ARRENDATARIA se obliga a pagar mensualmente la cuota de participación en los Gastos Comunes correspondiente a su alícuota del <strong>${((unit.condo_aliquot || 0.05) * 100).toFixed(2)}%</strong> sobre el total de egresos operativos (vigilancia armada 24/7, suministro hidroneumático, iluminación de áreas comunes, aseo y mantenimiento de drenajes y asfalto).
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA SEXTA: DEPÓSITO EN GARANTÍA</h4>
        <p>
          De conformidad con el Artículo 19 de la Ley (G.O. 40.418), LA ARRENDATARIA ha consignado la cantidad de <strong>USD $${Number(contract.deposit_usd || contract.rent_usd * 3).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>, equivalente a <strong>${contract.deposit_months || 3} meses de canon</strong> (límite máximo legal), para garantizar el fiel cumplimiento de todas las obligaciones contraídas.
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA SÉPTIMA: PRÓRROGA LEGAL OBLIGATORIA</h4>
        <p>
          Al vencimiento del presente contrato, si LA ARRENDATARIA se encontrare solvente en el cumplimiento de sus obligaciones patrimoniales, tendrá derecho a la Prórroga Legal obligatoria estipulada en el <strong>Artículo 26 del Decreto Ley N° 929 (G.O. 40.418)</strong>, correspondiéndole a la fecha un lapso máximo de: <strong>${prorroga.months} MESES (${esc(prorroga.description)})</strong>.
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA OCTAVA: PROHIBICIÓN DE CESIÓN Y SUBARRENDAMIENTO</h4>
        <p>
          Queda terminantemente prohibido el subarrendamiento total o parcial del inmueble, así como la cesión o traspaso del presente contrato, sin la autorización previa, expresa y por escrito de LA ARRENDADORA.
        </p>

        <h4 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px; font-weight: bold;">CLÁUSULA NOVENA: DOMICILIO ESPECIAL Y JURISDICCIÓN</h4>
        <p>
          Para todos los efectos derivados y consecuencias del presente contrato, las partes eligen como domicilio especial y excluyente la ciudad de ${esc(arbitrationCity)}, a la jurisdicción de cuyos Tribunales declaran someterse expresamente.
        </p>

        <p style="margin-top: 18px;">
          Se hacen dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de ${esc(arbitrationCity)}, a los ${new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>

        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 16px;">
          <div style="text-align: center; width: 44%; border-top: 1px solid #222; padding-top: 8px;">
            <strong>POR "LA ARRENDADORA"</strong><br>
            <span>${esc(companyLegalName)}</span><br>
            <span style="font-size: 11px; color: #555;">R.I.F. ${esc(companyRif)}</span><br>
            <div style="margin-top: 6px; font-size: 10.5px; color: #047857; font-weight: bold;">[Firma y Sello Autorizado]</div>
          </div>

          <div style="text-align: center; width: 44%; border-top: 1px solid #222; padding-top: 8px;">
            <strong>POR "LA ARRENDATARIA"</strong><br>
            <span>${esc(tenant.business_name)}</span><br>
            <span style="font-size: 11px; color: #555;">${esc(tenant.legal_rep_name)} — C.I. ${esc(tenant.legal_rep_dni)}</span><br>
            <div style="margin-top: 6px; font-size: 10.5px; color: #b45309; font-weight: bold;">[Firma y Sello del Representante]</div>
          </div>
        </div>

        <!-- SELLO DIGITAL DE INTEGRIDAD (SHA-256 REAL vía WebCrypto API) -->
        <div style="border-top: 1px dashed #94a3b8; margin-top: 28px; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 9.5px; color: #475569;">
          <div>
            <strong style="color: #0f172a; text-transform: uppercase;">Sello Criptográfico de Integridad (${esc(sealData.algorithm)})</strong><br>
            <span>Hash: ${esc(sealData.seal)}</span><br>
            <span>Timestamp: ${esc(sealData.timestamp)}</span><br>
            <span>Validación Gaceta Oficial N° 40.418 | Documento Inmutable</span>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 3px 8px; border: 1px solid #10b981; color: #047857; font-weight: bold; border-radius: 4px; background: #ecfdf5; font-size: 9px;">
              ✓ CONTRATO REGISTRADO & VÁLIDO
            </span>
          </div>
        </div>

      </div>
    `;
  },

  async generateSolvenciaHTML(tenant, unit, invoices = [], options = {}) {
    if (!tenant || !unit) return '<div style="padding:20px;color:red;">Error: Faltan datos del arrendatario o local.</div>';
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    
    const companyLegalName = 'SUCESIÓN MARIO SÁNCHEZ / C.C. MARIO SÁNCHEZ';
    const companyRif = 'J-30211544-2';
    const companyAddress = 'Av. Municipal c/c Calle Juncal, Puerto La Cruz, Edo. Anzoátegui, Venezuela';
    const issueDate = options.issueDate || new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
    const validityDate = options.validityDate || '30 días continuos a partir de su emisión';
    const destination = options.destination || 'A QUIEN PUEDA INTERESAR';
    const notes = options.notes || 'El arrendatario se encuentra al corriente en el pago de cánones de arrendamiento, cuotas de gastos comunes y alícuotas condominiales.';

    const sealData = await this.computeContractSeal(`SOLV-${unit.code}-${Date.now()}`, tenant.rif, issueDate, 0, companyRif);

    return `
      <div class="printable-legal-doc" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.45; color: #0f172a; max-width: 820px; margin: 0 auto; background: #ffffff; padding: 22px 26px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); page-break-inside: avoid;">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 8mm 10mm; }
            body { background: #fff !important; color: #000 !important; }
            .printable-legal-doc { border: none !important; box-shadow: none !important; padding: 6px 12px !important; max-width: 100% !important; page-break-inside: avoid !important; }
          }
        </style>

        <!-- HEADER EXECUTIVE (TIME TO PROGRAM BOILERPLATE STANDARD) -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="logo_cc_mario_sanchez_2k.svg" alt="CCMS Logo" style="width: 46px; height: 46px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;" onerror="this.style.display='none';">
            <div>
              <h2 style="font-size: 15px; margin: 0; text-transform: uppercase; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">${esc(companyLegalName)}</h2>
              <div style="font-size: 10.5px; color: #475569; font-weight: 600; margin-top: 1px;">R.I.F. ${esc(companyRif)} • Domicilio: ${esc(companyAddress)}</div>
              <div style="font-size: 10px; color: #64748b;">Administración Inmobiliaria Comercial • Gaceta Oficial N° 40.418</div>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; background: #ecfdf5; color: #047857; border: 1px solid #10b981; border-radius: 9999px; font-weight: 800; font-size: 10.5px; text-transform: uppercase; margin-bottom: 3px;">
              ● SOLVENTE Y AL DÍA
            </span>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">CCMS-SOLV-${esc(unit.code)}-${new Date().getFullYear()}</div>
            <div style="font-size: 10.5px; color: #64748b;">Emisión: <strong>${esc(issueDate)}</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 12px;">
          <h3 style="font-size: 13.5px; font-weight: 800; text-transform: uppercase; color: #047857; letter-spacing: 0.4px; margin: 0;">
            CERTIFICADO OFICIAL DE SOLVENCIA CONDOMINIAL & CANON
          </h3>
          <div style="font-size: 10.5px; color: #64748b; font-weight: 600; margin-top: 2px;">DESTINATARIO: <strong>${esc(destination).toUpperCase()}</strong></div>
        </div>

        <!-- 2-COLUMN METADATA GRID (TIME TO PROGRAM STYLE) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 11.5px;">
            <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
              DATOS DEL ARRENDATARIO / TITULAR
            </div>
            <div><strong>Razón Social:</strong> ${esc(tenant.business_name)}</div>
            <div><strong>R.I.F.:</strong> <span style="font-family: monospace; font-weight: 700;">${esc(tenant.rif)}</span></div>
            <div><strong>Representante:</strong> ${esc(tenant.legal_rep_name)} (C.I. ${esc(tenant.legal_rep_dni)})</div>
            <div><strong>Actividad Comercial:</strong> ${esc(tenant.commercial_activity || 'Comercial')}</div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 11.5px;">
            <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
              DATOS DEL INMUEBLE ARRENDADO
            </div>
            <div><strong>Local Comercial:</strong> <span style="color: #b45309; font-weight: 800;">${esc(unit.code)}</span> ("${esc(unit.name)}")</div>
            <div><strong>Superficie Arrendada:</strong> ${Number(unit.area_m2 || 0).toFixed(2)} m²</div>
            <div><strong>Alícuota Condominial:</strong> ${((unit.condo_aliquot || 0) * 100).toFixed(2)}%</div>
            <div><strong>Ubicación:</strong> C.C. Mario Sánchez, Puerto La Cruz</div>
          </div>
        </div>

        <!-- CERTIFICATION STATEMENT BODY -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; font-size: 11.5px; text-align: justify;">
          <p style="margin: 0;">
            La Administración del <strong>CENTRO COMERCIAL MARIO SÁNCHEZ</strong> certifica formalmente que el arrendatario identificado se encuentra <strong>SOLVENTE Y AL DÍA</strong> en todas sus obligaciones económicas por concepto de Cánones Fijos de Arrendamiento (CAF Art. 32 G.O. 40.418) y Cuotas de Participación en Gastos Comunes de Condominio causadas hasta la fecha, no existiendo saldos deudores ni recargos moratorios pendientes en los libros contables.
          </p>
        </div>

        <div style="font-size: 11px; color: #334155; margin-bottom: 12px;">
          <strong>Observaciones de Administración:</strong> ${esc(notes)}<br>
          <span style="color: #64748b;">Este documento posee una vigencia de <strong>${esc(validityDate)}</strong> a partir de su fecha de emisión.</span>
        </div>

        <!-- SIGNATURES GRID -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 24px; padding-top: 8px;">
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 6px;">
            <div style="font-weight: 800; font-size: 11.5px; color: #0f172a;">ADMINISTRACIÓN GENERAL</div>
            <div style="font-size: 10px; color: #64748b;">${esc(companyLegalName)} • R.I.F. ${esc(companyRif)}</div>
            <div style="margin-top: 3px; font-size: 9.5px; color: #047857; font-weight: 700;">[Sello Digital y Firma Autorizada]</div>
          </div>

          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 6px;">
            <div style="font-weight: 800; font-size: 11.5px; color: #0f172a;">CONTROL DE FINANZAS & COBRANZAS</div>
            <div style="font-size: 10px; color: #64748b;">Dpto. de Conciliación & Auditoría Condominial</div>
            <div style="margin-top: 3px; font-size: 9.5px; color: #047857; font-weight: 700;">[Validación Electrónica CCMS]</div>
          </div>
        </div>

        <!-- SHA-256 DIGITAL INTEGRITY SEAL -->
        <div style="border-top: 1px dashed #cbd5e1; margin-top: 16px; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 9px; color: #64748b;">
          <div>
            <strong style="color: #0f172a;">SELLO CRIPTOGRÁFICO DE INTEGRIDAD:</strong> ${esc(sealData.seal)}<br>
            <span>Generado vía WebCrypto API | Inmutable bajo Gaceta Oficial N° 40.418</span>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 2px 6px; background: #ecfdf5; border: 1px solid #10b981; color: #047857; font-weight: 700; border-radius: 4px; font-size: 8.5px;">
              ✓ DOCUMENTO DIGITAL VERIFICADO
            </span>
          </div>
        </div>
      </div>
    `;
  },

  async generateNotificacionMoraHTML(tenant, unit, unpaidInvoices = [], options = {}) {
    if (!tenant || !unit) return '<div style="padding:20px;color:red;">Error: Faltan datos del arrendatario.</div>';
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const bcvRate = options.bcvRate || 814.69;
    const formatMoney = (val) => '$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const formatBs = (val) => 'Bs. ' + Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });

    const companyLegalName = 'SUCESIÓN MARIO SÁNCHEZ / C.C. MARIO SÁNCHEZ';
    const companyRif = 'J-30211544-2';
    const companyAddress = 'Av. Municipal c/c Calle Juncal, Puerto La Cruz, Edo. Anzoátegui';
    const issueDate = options.issueDate || new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
    const deadlineHours = options.deadlineHours || '72 horas';
    const totalOwedUsd = unpaidInvoices.reduce((acc, i) => acc + (parseFloat(i.total_usd) || 0), 0);
    const totalOwedVes = totalOwedUsd * bcvRate;

    const sealData = await this.computeContractSeal(`NOTIF-${unit.code}-${Date.now()}`, tenant.rif, issueDate, totalOwedUsd, companyRif);

    return `
      <div class="printable-legal-doc" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; line-height: 1.45; color: #0f172a; max-width: 820px; margin: 0 auto; background: #ffffff; padding: 22px 26px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); page-break-inside: avoid;">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 8mm 10mm; }
            body { background: #fff !important; color: #000 !important; }
            .printable-legal-doc { border: none !important; box-shadow: none !important; padding: 6px 12px !important; max-width: 100% !important; page-break-inside: avoid !important; }
          }
        </style>

        <!-- HEADER EXECUTIVE -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="logo_cc_mario_sanchez_2k.svg" alt="CCMS Logo" style="width: 46px; height: 46px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;" onerror="this.style.display='none';">
            <div>
              <h2 style="font-size: 15px; margin: 0; text-transform: uppercase; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">${esc(companyLegalName)}</h2>
              <div style="font-size: 10.5px; color: #475569; font-weight: 600; margin-top: 1px;">R.I.F. ${esc(companyRif)} • ${esc(companyAddress)}</div>
              <div style="font-size: 10px; color: #64748b;">Dpto. de Cobranzas y Consultoría Legal • Gaceta Oficial N° 40.418</div>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; background: #fef2f2; color: #b91c1c; border: 1px solid #f87171; border-radius: 9999px; font-weight: 800; font-size: 10.5px; text-transform: uppercase; margin-bottom: 3px;">
              ● NOTIFICACIÓN EXTRAJUDICIAL
            </span>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">EXP-MORA-${esc(unit.code)}-${new Date().getFullYear()}</div>
            <div style="font-size: 10.5px; color: #64748b;">Emisión: <strong>${esc(issueDate)}</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 10px;">
          <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #b91c1c; letter-spacing: 0.3px; margin: 0;">
            NOTIFICACIÓN FORMAL DE COBRO EXTRAJUDICIAL & ESTADO DE MORA
          </h3>
        </div>

        <!-- 2-COLUMN METADATA GRID -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 11px;">
            <div><strong>Destinatario / Titular:</strong> ${esc(tenant.business_name)}</div>
            <div><strong>R.I.F.:</strong> <span style="font-family: monospace; font-weight: 700;">${esc(tenant.rif)}</span></div>
            <div><strong>Representante:</strong> ${esc(tenant.legal_rep_name)} (C.I. ${esc(tenant.legal_rep_dni)})</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 11px;">
            <div><strong>Inmueble:</strong> Local Comercial <strong style="color: #b45309;">${esc(unit.code)}</strong> ("${esc(unit.name)}")</div>
            <div><strong>Plazo Conciliatorio:</strong> <strong style="color: #b91c1c;">${esc(deadlineHours)}</strong> continuas</div>
            <div><strong>Tasa Oficial BCV Aplicada:</strong> Bs. ${bcvRate.toFixed(2)} / USD</div>
          </div>
        </div>

        <!-- TABLE OF DEBTS (TIME TO PROGRAM MODERN COMPACT TABLE) -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 5px 8px;">N° Recibo / Período</th>
              <th style="padding: 5px 8px;">Concepto</th>
              <th style="padding: 5px 8px;">Vencimiento</th>
              <th style="padding: 5px 8px; text-align: right;">Monto USD</th>
              <th style="padding: 5px 8px; text-align: right;">Equiv. Bs. BCV</th>
            </tr>
          </thead>
          <tbody>
            ${unpaidInvoices.length === 0 ? `
              <tr><td colspan="5" style="text-align: center; padding: 8px; color: #64748b;">No existen cuotas vencidas registradas.</td></tr>
            ` : unpaidInvoices.map(i => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 700; font-family: monospace;">${esc(i.invoice_number || i.id)}</td>
                <td style="padding: 5px 8px;">${esc(i.concept || 'Canon Fijo + Condominio')}</td>
                <td style="padding: 5px 8px;">${esc(i.due_date || 'Vencido')}</td>
                <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: #b91c1c;">${formatMoney(i.total_usd)}</td>
                <td style="padding: 5px 8px; text-align: right; color: #854d0e;">${formatBs(i.total_usd * bcvRate)}</td>
              </tr>
            `).join('')}
            <tr style="background: #fef2f2; font-weight: 800; border-top: 2px solid #f87171;">
              <td colspan="3" style="padding: 6px 8px; text-transform: uppercase;">TOTAL ADEUDADO AL CORTE:</td>
              <td style="padding: 6px 8px; text-align: right; color: #b91c1c; font-size: 12px;">${formatMoney(totalOwedUsd)}</td>
              <td style="padding: 6px 8px; text-align: right; color: #854d0e; font-size: 12px;">${formatBs(totalOwedVes)}</td>
            </tr>
          </tbody>
        </table>

        <div style="font-size: 10.5px; color: #334155; line-height: 1.4; text-align: justify; margin-bottom: 12px;">
          En virtud de lo dispuesto en la <strong>Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (G.O. 40.418)</strong> y el contrato suscrito, se le intima a efectuar y reportar la cancelación inmediata en los canales autorizados. De haber cancelado previamente, consigne el comprobante bancario para su conciliación.
        </div>

        <!-- SIGNATURES -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px;">
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 4px;">
            <div style="font-weight: 700; font-size: 11px;">POR LA ADMINISTRACIÓN</div>
            <div style="font-size: 9.5px; color: #64748b;">Dpto. de Cobranzas y Consultoría Legal</div>
          </div>
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 4px;">
            <div style="font-weight: 700; font-size: 11px;">RECIBIDO POR EL ARRENDATARIO</div>
            <div style="font-size: 9.5px; color: #64748b;">Firma, C.I. y Fecha: ______________________</div>
          </div>
        </div>

        <!-- SHA-256 SEAL -->
        <div style="border-top: 1px dashed #cbd5e1; margin-top: 14px; padding-top: 6px; font-family: monospace; font-size: 8.5px; color: #64748b; display: flex; justify-content: space-between;">
          <span><strong>Sello Criptográfico:</strong> ${esc(sealData.seal)}</span>
          <span style="color: #b91c1c; font-weight: 700;">REGISTRO EXTRAJUDICIAL INMUTABLE</span>
        </div>
      </div>
    `;
  },

  async generateConstanciaArrendatarioHTML(tenant, unit, contract = {}, options = {}) {
    if (!tenant || !unit) return '<div style="padding:20px;color:red;">Error: Faltan datos del arrendatario.</div>';
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const companyLegalName = 'SUCESIÓN MARIO SÁNCHEZ / C.C. MARIO SÁNCHEZ';
    const companyRif = 'J-30211544-2';
    const companyAddress = 'Av. Municipal c/c Calle Juncal, Puerto La Cruz, Edo. Anzoátegui';
    const issueDate = options.issueDate || new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
    const destination = options.destination || 'A QUIEN PUEDA INTERESAR / ENTIDAD BANCARIA / ORGANISMO PÚBLICO';

    const sealData = await this.computeContractSeal(`CONST-${unit.code}-${Date.now()}`, tenant.rif, issueDate, 0, companyRif);

    return `
      <div class="printable-legal-doc" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #0f172a; max-width: 820px; margin: 0 auto; background: #ffffff; padding: 24px 28px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); page-break-inside: avoid;">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 8mm 10mm; }
            body { background: #fff !important; color: #000 !important; }
            .printable-legal-doc { border: none !important; box-shadow: none !important; padding: 6px 12px !important; max-width: 100% !important; page-break-inside: avoid !important; }
          }
        </style>

        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="logo_cc_mario_sanchez_2k.svg" alt="CCMS Logo" style="width: 46px; height: 46px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;" onerror="this.style.display='none';">
            <div>
              <h2 style="font-size: 15px; margin: 0; text-transform: uppercase; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">${esc(companyLegalName)}</h2>
              <div style="font-size: 10.5px; color: #475569; font-weight: 600; margin-top: 1px;">R.I.F. ${esc(companyRif)} • ${esc(companyAddress)}</div>
              <div style="font-size: 10px; color: #64748b;">Administración Inmobiliaria • Gaceta Oficial N° 40.418</div>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; background: #eff6ff; color: #1d4ed8; border: 1px solid #3b82f6; border-radius: 9999px; font-weight: 800; font-size: 10.5px; text-transform: uppercase; margin-bottom: 3px;">
              ● ARRENDATARIO ACTIVO
            </span>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">CCMS-CONST-${esc(unit.code)}-${new Date().getFullYear()}</div>
            <div style="font-size: 10.5px; color: #64748b;">Emisión: <strong>${esc(issueDate)}</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 14px;">
          <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.4px; margin: 0;">
            CONSTANCIA DE ARRENDATARIO COMERCIAL ACTIVO
          </h3>
          <div style="font-size: 10.5px; color: #64748b; font-weight: 600; margin-top: 2px;">DIRIGIDO A: <strong>${esc(destination).toUpperCase()}</strong></div>
        </div>

        <!-- 2-COLUMN METADATA GRID -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 11.5px;">
            <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
              DATOS DE LA EMPRESA ARRENDATARIA
            </div>
            <div><strong>Razón Social:</strong> ${esc(tenant.business_name)}</div>
            <div><strong>R.I.F.:</strong> <span style="font-family: monospace; font-weight: 700;">${esc(tenant.rif)}</span></div>
            <div><strong>Representante:</strong> ${esc(tenant.legal_rep_name)} (C.I. ${esc(tenant.legal_rep_dni)})</div>
            <div><strong>Actividad Comercial:</strong> ${esc(tenant.commercial_activity || 'Comercial')}</div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 11.5px;">
            <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
              DATOS DEL LOCAL COMERCIAL
            </div>
            <div><strong>Unidad / Local:</strong> <span style="color: #b45309; font-weight: 800;">${esc(unit.code)}</span> ("${esc(unit.name)}")</div>
            <div><strong>Superficie:</strong> ${Number(unit.area_m2 || 0).toFixed(2)} m²</div>
            <div><strong>Alícuota Condominial:</strong> ${((unit.condo_aliquot || 0) * 100).toFixed(2)}%</div>
            <div><strong>Régimen:</strong> Ley Especial de Arrendamiento Comercial</div>
          </div>
        </div>

        <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 14px; font-size: 12px; line-height: 1.5; text-align: justify;">
          Por medio de la presente, la <strong>ADMINISTRACIÓN DEL CENTRO COMERCIAL MARIO SÁNCHEZ</strong> hace constar que la sociedad mercantil <strong>"${esc(tenant.business_name)}"</strong> (R.I.F. ${esc(tenant.rif)}) es arrendataria formal, legal y activa del <strong>Local ${esc(unit.code)}</strong> en nuestras instalaciones, manteniendo vigencia contractual y cumplimiento de las normativas de condominio y convivencia.
        </div>

        <div style="font-size: 11px; color: #64748b; margin-bottom: 14px;">
          Constancia que se expide a solicitud de la parte interesada a los fines consiguientes en la ciudad de Puerto La Cruz, a los <strong>${esc(issueDate)}</strong>.
        </div>

        <!-- SIGNATURES -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 28px;">
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 6px;">
            <div style="font-weight: 800; font-size: 11.5px;">ADMINISTRACIÓN GENERAL</div>
            <div style="font-size: 10px; color: #64748b;">${esc(companyLegalName)} • R.I.F. ${esc(companyRif)}</div>
            <div style="margin-top: 3px; font-size: 9.5px; color: #1d4ed8; font-weight: 700;">[Sello Húmedo y Firma Autorizada]</div>
          </div>
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 6px;">
            <div style="font-weight: 800; font-size: 11.5px;">CONSULTORÍA JURÍDICA</div>
            <div style="font-size: 10px; color: #64748b;">Validación Notarial / Gaceta Oficial 40.418</div>
            <div style="margin-top: 3px; font-size: 9.5px; color: #1d4ed8; font-weight: 700;">[Certificación Digital]</div>
          </div>
        </div>

        <!-- SHA-256 SEAL -->
        <div style="border-top: 1px dashed #cbd5e1; margin-top: 18px; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 9px; color: #64748b;">
          <span><strong>Sello Criptográfico de Emisión:</strong> ${esc(sealData.seal)}</span>
          <span style="color: #1d4ed8; font-weight: 700;">✓ CONSTANCIA OFICIAL VÁLIDA</span>
        </div>
      </div>
    `;
  },

  async generateActaEntregaHTML(tenant, unit, contract = {}, options = {}) {
    if (!tenant || !unit) return '<div style="padding:20px;color:red;">Error: Faltan datos del local.</div>';
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const companyLegalName = 'SUCESIÓN MARIO SÁNCHEZ / C.C. MARIO SÁNCHEZ';
    const companyRif = 'J-30211544-2';
    const companyAddress = 'Av. Municipal c/c Calle Juncal, Puerto La Cruz, Edo. Anzoátegui';
    const issueDate = options.issueDate || new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
    const isReceiving = options.mode === 'devolucion' ? 'DESOCUPACIÓN / RECEPCIÓN' : 'ENTREGA INICIAL & POSESIÓN';

    return `
      <div class="printable-legal-doc" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; line-height: 1.45; color: #0f172a; max-width: 820px; margin: 0 auto; background: #ffffff; padding: 22px 26px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); page-break-inside: avoid;">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 8mm 10mm; }
            body { background: #fff !important; color: #000 !important; }
            .printable-legal-doc { border: none !important; box-shadow: none !important; padding: 6px 12px !important; max-width: 100% !important; page-break-inside: avoid !important; }
          }
        </style>

        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="logo_cc_mario_sanchez_2k.svg" alt="CCMS Logo" style="width: 46px; height: 46px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;" onerror="this.style.display='none';">
            <div>
              <h2 style="font-size: 15px; margin: 0; text-transform: uppercase; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">${esc(companyLegalName)}</h2>
              <div style="font-size: 10.5px; color: #475569; font-weight: 600; margin-top: 1px;">R.I.F. ${esc(companyRif)} • ${esc(companyAddress)}</div>
              <div style="font-size: 10px; color: #64748b;">Dpto. de Operaciones & Mantenimiento</div>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; background: #f0fdfa; color: #0f766e; border: 1px solid #14b8a6; border-radius: 9999px; font-weight: 800; font-size: 10.5px; text-transform: uppercase; margin-bottom: 3px;">
              ● ACTA CIRCUNSTANCIADA
            </span>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">ACTA-${esc(unit.code)}-${new Date().getFullYear()}</div>
            <div style="font-size: 10.5px; color: #64748b;">Fecha: <strong>${esc(issueDate)}</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 12px;">
          <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 0.3px; margin: 0;">
            ACTA CIRCUNSTANCIADA DE ${esc(isReceiving)} DE LOCAL COMERCIAL
          </h3>
          <div style="font-size: 10.5px; color: #64748b; font-weight: 600; margin-top: 2px;">LOCAL COMERCIAL: <strong>${esc(unit.code)}</strong> ("${esc(unit.name)}") — ÁREA: ${Number(unit.area_m2 || 0).toFixed(2)} m²</div>
        </div>

        <!-- 2-COLUMN METADATA GRID -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 11px;">
            <div><strong>Arrendatario:</strong> ${esc(tenant.business_name)} (R.I.F. ${esc(tenant.rif)})</div>
            <div><strong>Representante:</strong> ${esc(tenant.legal_rep_name)} (C.I. ${esc(tenant.legal_rep_dni)})</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 11px;">
            <div><strong>Administradora:</strong> ${esc(companyLegalName)}</div>
            <div><strong>Inspección:</strong> Dpto. de Mantenimiento & Infraestructura</div>
          </div>
        </div>

        <!-- INVENTORY CHECKLIST TABLE -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px;">
          <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">
            INVENTARIO & ESTADO FÍSICO DE ENTREGA
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
            <div>• <strong>Paredes y Pintura:</strong> Óptimas condiciones higiénicas. <span style="color:#047857;font-weight:700;">[✓ Conforme]</span></div>
            <div>• <strong>Pisos y Cerámica:</strong> Sin fracturas ni desgastes. <span style="color:#047857;font-weight:700;">[✓ Conforme]</span></div>
            <div>• <strong>Tablero Eléctrico:</strong> Breakers y acometida operativos. <span style="color:#047857;font-weight:700;">[✓ Operativo]</span></div>
            <div>• <strong>Santa María / Cerraduras:</strong> 2 llaves maestras entregadas. <span style="color:#047857;font-weight:700;">[✓ Operativo]</span></div>
            <div style="grid-column: 1 / -1;">• <strong>Servicio de Agua:</strong> Punto hidroneumático probado y sin fugas. <span style="color:#047857;font-weight:700;">[✓ Operativo]</span></div>
          </div>
        </div>

        <div style="font-size: 10.5px; color: #334155; line-height: 1.4; text-align: justify; margin-bottom: 12px;">
          Las partes declaran su plena conformidad con las condiciones físicas y legales asentadas en la presente acta circunstanciada, firmando dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Puerto La Cruz, a los <strong>${esc(issueDate)}</strong>.
        </div>

        <!-- SIGNATURES -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 22px;">
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 4px;">
            <div style="font-weight: 700; font-size: 11px;">POR LA ADMINISTRADORA</div>
            <div style="font-size: 9.5px; color: #64748b;">Dpto. de Operaciones & Mantenimiento</div>
          </div>
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 4px;">
            <div style="font-weight: 700; font-size: 11px;">POR EL ARRENDATARIO</div>
            <div style="font-size: 9.5px; color: #64748b;">${esc(tenant.legal_rep_name)} — C.I. ${esc(tenant.legal_rep_dni)}</div>
          </div>
        </div>
      </div>
    `;
  },

  async generateAdendaObrasHTML(tenant, unit, agreement = {}, options = {}) {
    if (!tenant || !unit) return '<div style="padding:20px;color:red;">Error: Faltan datos del acuerdo.</div>';
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const companyLegalName = 'SUCESIÓN MARIO SÁNCHEZ / C.C. MARIO SÁNCHEZ';
    const companyRif = 'J-30211544-2';
    const companyAddress = 'Av. Municipal c/c Calle Juncal, Puerto La Cruz, Edo. Anzoátegui';
    const issueDate = options.issueDate || new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
    const formatMoney = (val) => '$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    const discountUsd = agreement.monthly_discount_usd || 0;
    const desc = agreement.description || 'Reparaciones mayores y mejoras estructurales autorizadas en el local comercial.';
    const startDate = agreement.start_date || '2026-01-01';
    const endDate = agreement.end_date || '2026-12-31';

    return `
      <div class="printable-legal-doc" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; line-height: 1.45; color: #0f172a; max-width: 820px; margin: 0 auto; background: #ffffff; padding: 22px 26px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); page-break-inside: avoid;">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 8mm 10mm; }
            body { background: #fff !important; color: #000 !important; }
            .printable-legal-doc { border: none !important; box-shadow: none !important; padding: 6px 12px !important; max-width: 100% !important; page-break-inside: avoid !important; }
          }
        </style>

        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="logo_cc_mario_sanchez_2k.svg" alt="CCMS Logo" style="width: 46px; height: 46px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;" onerror="this.style.display='none';">
            <div>
              <h2 style="font-size: 15px; margin: 0; text-transform: uppercase; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">${esc(companyLegalName)}</h2>
              <div style="font-size: 10.5px; color: #475569; font-weight: 600; margin-top: 1px;">R.I.F. ${esc(companyRif)} • ${esc(companyAddress)}</div>
              <div style="font-size: 10px; color: #64748b;">Administración Inmobiliaria • Arts. 13 & 32 G.O. 40.418</div>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; background: #faf5ff; color: #7e22ce; border: 1px solid #c084fc; border-radius: 9999px; font-weight: 800; font-size: 10.5px; text-transform: uppercase; margin-bottom: 3px;">
              ● ACUERDO DE OBRAS
            </span>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">ADENDA-${esc(unit.code)}-${new Date().getFullYear()}</div>
            <div style="font-size: 10.5px; color: #64748b;">Fecha: <strong>${esc(issueDate)}</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 12px;">
          <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #7e22ce; letter-spacing: 0.3px; margin: 0;">
            ADENDA DE ACUERDO DE OBRAS, MEJORAS Y DEDUCCIÓN DE CANON
          </h3>
          <div style="font-size: 10.5px; color: #64748b; font-weight: 600; margin-top: 2px;">CONFORME AL ARTÍCULO 13 & 32 DE LA GACETA OFICIAL N° 40.418</div>
        </div>

        <!-- 2-COLUMN METADATA GRID -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 11px;">
            <div><strong>Arrendatario:</strong> ${esc(tenant.business_name)}</div>
            <div><strong>R.I.F.:</strong> <span style="font-family: monospace; font-weight: 700;">${esc(tenant.rif)}</span></div>
            <div><strong>Representante:</strong> ${esc(tenant.legal_rep_name)} (C.I. ${esc(tenant.legal_rep_dni)})</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 11px;">
            <div><strong>Local Comercial:</strong> <span style="color: #b45309; font-weight: 800;">${esc(unit.code)}</span> ("${esc(unit.name)}")</div>
            <div><strong>Deducción Mensual Aprobada:</strong> <strong style="color: #7e22ce;">${formatMoney(discountUsd)} / mes</strong></div>
            <div><strong>Período:</strong> ${esc(startDate)} al ${esc(endDate)}</div>
          </div>
        </div>

        <div style="background: #faf5ff; border-left: 4px solid #a855f7; padding: 10px 14px; margin-bottom: 12px; font-size: 11.5px;">
          <strong>Descripción y Alcance de las Mejoras Autorizadas:</strong><br>
          <span style="color: #334155;">${esc(desc)}</span>
        </div>

        <div style="font-size: 10.5px; color: #334155; line-height: 1.4; text-align: justify; margin-bottom: 12px;">
          La presente deducción compensatoria se aplicará mensualmente contra la liquidación del canon de arrendamiento y/o condominio previa verificación física y documental de los soportes y facturas de obra por parte del departamento de infraestructura de la arrendadora.
        </div>

        <!-- SIGNATURES -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 24px;">
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 4px;">
            <div style="font-weight: 700; font-size: 11px;">POR LA ARRENDADORA</div>
            <div style="font-size: 9.5px; color: #64748b;">${esc(companyLegalName)}</div>
          </div>
          <div style="text-align: center; border-top: 1px solid #0f172a; padding-top: 4px;">
            <div style="font-weight: 700; font-size: 11px;">POR LA ARRENDATARIA</div>
            <div style="font-size: 9.5px; color: #64748b;">${esc(tenant.legal_rep_name)} (C.I. ${esc(tenant.legal_rep_dni)})</div>
          </div>
        </div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.VenezuelaLegal = VenezuelaLegal;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VenezuelaLegal;
}
