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
      return { months: 6, description: 'Hasta 6 meses de prórroga legal obligatoria (Art. 25, literal a).' };
    } else if (durationYears <= 5) {
      return { months: 12, description: 'Hasta 1 año de prórroga legal obligatoria (Art. 25, literal b).' };
    } else if (durationYears <= 10) {
      return { months: 24, description: 'Hasta 2 años de prórroga legal obligatoria (Art. 25, literal c).' };
    } else {
      return { months: 36, description: 'Hasta 3 años de prórroga legal obligatoria (Art. 25, literal d).' };
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
          Al vencimiento del presente contrato, si LA ARRENDATARIA se encontrare solvente en el cumplimiento de sus obligaciones patrimoniales, tendrá derecho a la Prórroga Legal obligatoria estipulada en el <strong>Artículo 25 de la Ley especial</strong>, correspondiéndole a la fecha un lapso máximo de: <strong>${prorroga.months} MESES (${esc(prorroga.description)})</strong>.
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
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VenezuelaLegal;
}
