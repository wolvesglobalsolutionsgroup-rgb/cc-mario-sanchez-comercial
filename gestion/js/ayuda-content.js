/**
 * ============================================================================
 * MÓDULO DE AYUDA DIDÁCTICA & GUÍA DEL USUARIO
 * Centro Comercial Mario Sánchez — Suite de Gestión Inmobiliaria
 * Explica paso a paso cómo funciona cada módulo según el perfil activo (Admin vs Inquilino)
 * ============================================================================
 */

const HelpContent = {
  /**
   * Renderiza la vista completa de ayuda con navegación por sub-pestañas adaptada al rol
   */
  render() {
    const container = document.getElementById('help-content-container');
    if (!container) return;

    const currentUser = (window.AuthGuard && typeof window.AuthGuard.currentUser === 'function') 
      ? window.AuthGuard.currentUser() 
      : null;
    const isTenant = currentUser?.role === 'tenant';

    if (isTenant) {
      // Menú exclusivo para el perfil de Inquilino / Arrendatario
      container.innerHTML = `
        <!-- BARRA DE NAVEGACIÓN INQUILINOS -->
        <div class="help-nav-bar" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; padding: 10px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 10px;">
          <button class="help-nav-btn active" data-help-tab="welcome_tenant" style="flex: 1; min-width: 130px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            <i class="fa-solid fa-house-chimney-user"></i> Mi Portal
          </button>
          <button class="help-nav-btn" data-help-tab="pagos_tenant" style="flex: 1; min-width: 130px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-credit-card"></i> Reportar Pagos
          </button>
          <button class="help-nav-btn" data-help-tab="recibos_tenant" style="flex: 1; min-width: 130px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-file-invoice-dollar"></i> Recibos SHA-256
          </button>
          <button class="help-nav-btn" data-help-tab="calendario_tenant" style="flex: 1; min-width: 130px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-calendar-check"></i> Vencimientos & Fechas
          </button>
          <button class="help-nav-btn" data-help-tab="legal_tenant" style="flex: 1; min-width: 130px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-scale-balanced"></i> Mis Derechos & Ley
          </button>
          <button class="help-nav-btn" data-help-tab="seguridad_tenant" style="flex: 1; min-width: 130px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-shield-halved"></i> Seguridad & Datos
          </button>
          <button class="help-nav-btn" data-help-tab="faq_tenant" style="flex: 1; min-width: 130px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-circle-question"></i> Preguntas & Soporte
          </button>
        </div>

        <!-- CONTENEDOR DEL CONTENIDO DIDÁCTICO -->
        <div id="help-content-area"></div>
      `;
    } else {
      // Menú completo para el perfil de Administrador / Junta de Condominio
      container.innerHTML = `
        <!-- BARRA DE NAVEGACIÓN ADMIN -->
        <div class="help-nav-bar" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; padding: 10px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 10px;">
          <button class="help-nav-btn active" data-help-tab="welcome" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            <i class="fa-solid fa-house"></i> Bienvenida
          </button>
          <button class="help-nav-btn" data-help-tab="dashboard" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-gauge-high"></i> Dashboard
          </button>
          <button class="help-nav-btn" data-help-tab="locales" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-store"></i> Locales
          </button>
          <button class="help-nav-btn" data-help-tab="cobranzas" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-receipt"></i> Cobranzas
          </button>
          <button class="help-nav-btn" data-help-tab="gastos" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-calculator"></i> Gastos
          </button>
          <button class="help-nav-btn" data-help-tab="calendario" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-calendar-days"></i> Calendario
          </button>
          <button class="help-nav-btn" data-help-tab="informes" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-file-contract"></i> Informes
          </button>
          <button class="help-nav-btn" data-help-tab="legal" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-scale-balanced"></i> Marco Legal
          </button>
          <button class="help-nav-btn" data-help-tab="seguridad" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-shield-halved"></i> Seguridad
          </button>
          <button class="help-nav-btn" data-help-tab="faq" style="flex: 1; min-width: 110px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-circle-question"></i> FAQ & Errores
          </button>
        </div>

        <!-- CONTENEDOR DEL CONTENIDO DIDÁCTICO -->
        <div id="help-content-area"></div>
      `;
    }

    // Activar navegación por tabs
    document.querySelectorAll('.help-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.help-nav-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--txt-secondary)';
          b.style.borderColor = 'var(--border-subtle)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--cyan-glow)';
        btn.style.color = 'var(--cyan)';
        btn.style.borderColor = 'var(--cyan)';
        HelpContent.renderTab(btn.dataset.helpTab);
      });
    });

    // Renderizar pestaña inicial según rol
    const initialTab = isTenant ? 'welcome_tenant' : 'welcome';
    const activeBtn = document.querySelector(`.help-nav-btn[data-help-tab="${initialTab}"]`) || document.querySelector('.help-nav-btn');
    if (activeBtn) {
      activeBtn.style.background = 'var(--cyan-glow)';
      activeBtn.style.color = 'var(--cyan)';
      activeBtn.style.borderColor = 'var(--cyan)';
    }
    HelpContent.renderTab(initialTab);
  },

  /**
   * Renderiza el contenido de cada sub-pestaña
   */
  renderTab(tabName) {
    const area = document.getElementById('help-content-area');
    if (!area) return;

    const content = this.getTabContent(tabName);
    area.innerHTML = content;
  },

  /**
   * Devuelve el HTML de cada sub-pestaña didáctica
   */
  getTabContent(tab) {
    const templates = {

      // =========================================================================
      // SECCIONES EXCLUSIVAS PARA INQUILINOS (TENANT)
      // =========================================================================

      welcome_tenant: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 22px; color: var(--txt-primary); margin-bottom: 10px;">
            <i class="fa-solid fa-hand-sparkles" style="color: var(--emerald);"></i>
            Bienvenido a su Portal de Arrendatario
          </h3>
          <p style="font-size: 14px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Este portal ha sido diseñado para facilitarle la autogestión de su local comercial en el <strong>Centro Comercial Mario Sánchez</strong>. Aquí podrá consultar sus cuotas de canon y condominio, reportar sus pagos en cualquier moneda, descargar recibos oficiales con firma criptográfica y verificar su solvencia las 24 horas del día.
          </p>

          <h4 style="font-family: var(--font-heading); color: var(--cyan); margin: 20px 0 12px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
            <i class="fa-solid fa-compass"></i> ¿Qué puede hacer desde este portal?
          </h4>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--emerald); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: rgba(16,185,129,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--emerald);"><i class="fa-solid fa-credit-card"></i></div>
                <strong style="color: var(--txt-primary);">Reportar Pagos al Instante</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                Cargue sus comprobantes de Pago Móvil, transferencia bancaria, Zelle, efectivo o Binance USDT en segundos directamente desde su teléfono o computador.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--cyan); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: var(--cyan-glow); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--cyan);"><i class="fa-solid fa-file-shield"></i></div>
                <strong style="color: var(--txt-primary);">Descargar Recibos Oficiales</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                Cada pago verificado genera un recibo digital oficial correlativo con <strong>sello criptográfico SHA-256</strong> con validez legal probatoria y tributaria.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--amber); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: var(--amber-glow); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--amber);"><i class="fa-solid fa-clock"></i></div>
                <strong style="color: var(--txt-primary);">Monitorear su Solvencia</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                Consulte su estado de cuenta en tiempo real, conozca las fechas límite de corte y evite cargos o intereses por mora.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--purple); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: rgba(168,85,247,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--purple);"><i class="fa-solid fa-coins"></i></div>
                <strong style="color: var(--txt-primary);">Conversión Multimoneda BCV</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                Consulte sus montos en Bolívares (Bs.), Dólares (USD) o Cripto USDT con conversión automática a la tasa oficial del Banco Central de Venezuela.
              </p>
            </div>
          </div>

          <div style="margin-top: 24px; padding: 18px; background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(14,165,233,0.05)); border: 1px solid var(--border-highlight); border-radius: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <i class="fa-solid fa-circle-check" style="color: var(--emerald); font-size: 20px;"></i>
              <strong style="color: var(--txt-primary); font-size: 14px;">Aislamiento & Privacidad Garantizada (Zero-Trust)</strong>
            </div>
            <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
              Su sesión está estrictamente protegida. Ningún otro comerciante o tercero puede ver su información financiera, historial de pagos, ni contratos.
            </p>
          </div>
        </div>
      `,

      pagos_tenant: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-credit-card" style="color: var(--emerald);"></i>
            Guía Paso a Paso: Cómo Reportar y Cargar sus Pagos
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Siga estas instrucciones para reportar el pago de su canon de arrendamiento y cuota de condominio de forma rápida y segura.
          </p>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: var(--bg-card); border-left: 5px solid var(--emerald); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 14px;">
                <strong>Paso 1:</strong> Haga clic en "Cargar / Reportar Pago" o en el botón verde de su cuota
              </h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                En el panel de cobranzas o en la tarjeta superior de acceso directo, pulse el botón <strong>"Reportar Pago"</strong>. Se abrirá la ventana para cargar el comprobante.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--cyan); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 14px;">
                <strong>Paso 2:</strong> Seleccione el método de pago e ingrese el número de referencia
              </h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                Indique si pagó mediante <strong>Pago Móvil</strong>, <strong>Transferencia Bancaria</strong>, <strong>Dólares en Efectivo</strong> o <strong>Binance USDT (TRC20)</strong>. Ingrese los últimos 6 a 8 dígitos de la referencia bancaria o el Hash/TxID si fue en cripto.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--amber); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 14px;">
                <strong>Paso 3:</strong> Adjunte la captura o foto del comprobante
              </h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                Arrastre o seleccione la imagen (PNG, JPG) o PDF del comprobante emitido por su banco. Asegúrese de que el monto, la fecha y el número de referencia sean completamente legibles.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--purple); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 14px;">
                <strong>Paso 4:</strong> Envíe el comprobante y siga el estatus en tiempo real
              </h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                Al pulsar <strong>"Enviar Comprobante a Administración"</strong>, el sistema cifrará el comprobante y notificará al equipo administrativo. Su cuota pasará de inmediato al estado <span class="status-pill pill-pending" style="font-size:11px;"><i class="fa-solid fa-hourglass-half"></i> ⏳ En Revisión</span>.
              </p>
            </div>
          </div>

          <div style="margin-top: 24px; padding: 16px; background: rgba(14,165,233,0.06); border: 1px solid var(--border-subtle); border-radius: 8px;">
            <h4 style="margin: 0 0 6px; color: var(--cyan); font-size: 13.5px;"><i class="fa-solid fa-building-columns"></i> Datos Bancarios Oficiales para Pagos</h4>
            <div style="font-size: 12px; color: var(--txt-secondary); line-height: 1.8;">
              <div>• <strong>Titular:</strong> Centro Comercial Mario Sánchez, C.A.</div>
              <div>• <strong>RIF:</strong> J-29881234-0</div>
              <div>• <strong>Banco Mercantil / Banco de Venezuela:</strong> Cuenta Corriente N° 0105-0062-11-1062123456</div>
              <div>• <strong>Pago Móvil:</strong> Banco Mercantil (0105) • Tel: 0424-7380002 • RIF: J-298812340</div>
              <div>• <strong>Binance Pay / USDT (TRC20):</strong> Solicitar billetera oficial en administración</div>
            </div>
          </div>
        </div>
      `,

      recibos_tenant: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-file-invoice-dollar" style="color: var(--cyan);"></i>
            Recibos Oficiales & Sello Criptográfico SHA-256
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Cada vez que la administración aprueba y concilia su pago bancario, el sistema emite de forma automática un <strong>Recibo Oficial de Pago</strong> con número correlativo único.
          </p>

          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px; color: var(--txt-primary); font-size: 15px;">
              <i class="fa-solid fa-fingerprint" style="color: var(--amber);"></i> ¿Qué es el Sello Criptográfico SHA-256?
            </h4>
            <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 12px;">
              Es una firma digital matemática de 256 bits generada a partir de los datos exactos del pago (número de recibo, fecha y hora, monto, tasa de cambio BCV aplicada y RIF de las partes).
            </p>
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 6px; font-family: monospace; font-size: 11.5px; color: var(--cyan); word-break: break-all;">
              Ejemplo de Sello: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            </div>
            <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin-top: 10px;">
              <strong>Garantía de Inalterabilidad:</strong> Si cualquier persona intentara modificar aunque sea un centavo del recibo, el hash cambiaría completamente, demostrando que el documento fue alterado. Esto le brinda plena seguridad jurídica ante auditorías fiscales y contables.
            </p>
          </div>

          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 18px; border-radius: 8px;">
            <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 14px;">
              <i class="fa-solid fa-print"></i> ¿Cómo descargar o imprimir su recibo?
            </h4>
            <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
              En la tabla de cobranzas, ubique la cuota con estado <span class="status-pill pill-active" style="font-size:11px;">✓ Pagado</span> y haga clic en el botón azul con ícono de recibo <i class="fa-solid fa-receipt"></i>. Se abrirá la vista previa del recibo oficial con botón de <strong>"Imprimir / Guardar PDF"</strong>.
            </p>
          </div>
        </div>
      `,

      calendario_tenant: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-calendar-check" style="color: var(--amber);"></i>
            Vencimientos, Períodos de Gracia & Notificaciones
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Conozca las fechas clave del cronograma de facturación para mantener su local en estricta solvencia operativa.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 20px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-top: 4px solid var(--cyan); padding: 16px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Día 1 al 5 de cada mes</div>
              <h4 style="color: var(--txt-primary); margin: 6px 0 8px; font-size: 14px;">Emisión de Cuota & Facturación</h4>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Se publica la cuota mensual del canon y condominio en su portal y se notifica el monto correspondiente.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-top: 4px solid var(--emerald); padding: 16px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Hasta el Día 10</div>
              <h4 style="color: var(--txt-primary); margin: 6px 0 8px; font-size: 14px;">Período Regular de Pago</h4>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Ventana de pago sin ningún tipo de recargo o penalidad contractual.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-top: 4px solid var(--rose); padding: 16px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">A partir del Día 11</div>
              <h4 style="color: var(--txt-primary); margin: 6px 0 8px; font-size: 14px;">Período de Mora</h4>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Se activan recordatorios automáticos por WhatsApp y aplican los recargos previstos en el contrato de arrendamiento.
              </p>
            </div>
          </div>

          <div style="padding: 16px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <i class="fa-solid fa-bell" style="color: var(--amber);"></i>
              <strong style="color: var(--txt-primary); font-size: 13px;">Alertas Automáticas de Recordatorio</strong>
            </div>
            <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
              El sistema le enviará recordatorios preventivos a su correo y WhatsApp antes del vencimiento para que nunca olvide reportar su cuota a tiempo.
            </p>
          </div>
        </div>
      `,

      legal_tenant: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-scale-balanced" style="color: var(--purple);"></i>
            Marco Legal del Arrendatario Comercial en Venezuela
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Todo arrendamiento de locales comerciales en el Centro Comercial Mario Sánchez se rige estrictamente por la legislación nacional vigente:
          </p>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--cyan); font-size: 14px;">
                <i class="fa-solid fa-gavel"></i> Decreto Ley N° 929 (Gaceta Oficial N° 40.418)
              </h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial. Establece la fijación justa de cánones comerciales, la obligatoriedad de entrega de recibos y la prohibición de cobros indebidos.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--emerald); font-size: 14px;">
                <i class="fa-solid fa-clock-rotate-left"></i> Prórroga Legal Obligatoria (Artículo 25)
              </h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 10px;">
                Al vencerse el contrato de arrendamiento a tiempo determinado, el arrendatario que esté solvente tiene derecho a una prórroga legal automática según su antigüedad:
              </p>
              <div style="font-size: 12px; color: var(--txt-secondary); line-height: 1.8; padding-left: 10px;">
                <div>• <strong>Hasta 1 año de contrato:</strong> 6 meses de prórroga legal máxima.</div>
                <div>• <strong>De 1 a 2 años de contrato:</strong> 1 año de prórroga legal máxima.</div>
                <div>• <strong>De 2 a 3 años de contrato:</strong> 2 años de prórroga legal máxima.</div>
                <div>• <strong>Más de 3 años de contrato:</strong> Hasta 3 años de prórroga legal máxima.</div>
              </div>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--amber); font-size: 14px;">
                <i class="fa-solid fa-money-bill-transfer"></i> Moneda de Pago & Tasa BCV (Ley BCV Art. 128)
              </h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                Aunque el canon esté pactado en moneda extranjera (USD/EUR) como unidad de cuenta de valor, el inquilino tiene el derecho inalienable de pagar en Bolívares calculados a la tasa oficial publicada por el <strong>Banco Central de Venezuela (BCV)</strong> para la fecha del pago efectivo.
              </p>
            </div>
          </div>
        </div>
      `,

      seguridad_tenant: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-shield-halved" style="color: var(--cyan);"></i>
            Seguridad de sus Datos & Protección de Privacidad
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Esta plataforma implementa estándares bancarios y de grado de auditoría para proteger su información financiera y comercial.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--cyan); font-weight: 700;">
                <i class="fa-solid fa-lock"></i> Cifrado de Comunicaciones (TLS 1.3)
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Todas las conexiones están protegidas con cifrado HTTPS estricto con cabeceras HSTS pre-cargadas (31536000 seg) que impiden intercepciones en la red.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--emerald); font-weight: 700;">
                <i class="fa-solid fa-user-lock"></i> Aislamiento Total de Datos (Anti-IDOR)
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Mecanismos de control de acceso basados en roles (RBAC) garantizan que ningún otro usuario o comerciante pueda acceder a sus recibos o estados de cuenta.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--amber); font-weight: 700;">
                <i class="fa-solid fa-shield-virus"></i> Sanitización & Anti-Inyección
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Los archivos de comprobante y números de referencia son analizados y sanitizados contra código malicioso antes de almacenarse en la base de datos.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--purple); font-weight: 700;">
                <i class="fa-solid fa-cloud-arrow-up"></i> Respaldos Criptográficos
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Los registros de auditoría y recibos cuentan con snapshots inmutables que previenen pérdidas de datos ante fallos técnicos o de conectividad.
              </p>
            </div>
          </div>
        </div>
      `,

      faq_tenant: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-circle-question" style="color: var(--amber);"></i>
            Preguntas Frecuentes & Canales de Soporte
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Respuestas a las dudas más habituales sobre el uso del portal y gestión de pagos:
          </p>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ ¿Cuánto tiempo tarda la administración en validar mi pago?</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                El equipo administrativo revisa los comprobantes durante el horario comercial (8:00 AM a 6:00 PM). Generalmente la validación bancaria toma entre <strong>1 y 4 horas hábiles</strong>. Una vez aprobado, el estatus cambiará a "✓ Pagado" y tendrá su recibo disponible.
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ ¿Qué debo hacer si me equivoqué en el número de referencia o monto?</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                Si el pago aún está en estado <strong>⏳ En Revisión</strong>, comuníquese de inmediato con la administración vía WhatsApp (+58 424-7380002) indicando su local y la referencia correcta para que lo corrijan durante la conciliación.
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ ¿Puedo pagar varios meses o cuotas por adelantado?</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                Sí. En el modal de pago puede seleccionar las cuotas consecutivas o coordinar con la administración para que le habiliten los períodos futuros en su portal.
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ ¿Cómo contacto al equipo de administración?</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Canales oficiales de atención:</strong>
                <ul style="margin: 8px 0; padding-left: 18px;">
                  <li><i class="fa-brands fa-whatsapp" style="color: #25D366;"></i> <strong>WhatsApp Administración:</strong> +58 424-7380002</li>
                  <li><i class="fa-solid fa-envelope" style="color: var(--cyan);"></i> <strong>Correo:</strong> administracion@ccmariosanchez.com</li>
                  <li><i class="fa-solid fa-building" style="color: var(--amber);"></i> <strong>Oficina Física:</strong> CC Mario Sánchez, Nivel Mezzanina, Oficina de Administración (Lunes a Viernes 8:00 AM - 5:00 PM).</li>
                </ul>
              </div>
            </details>
          </div>
        </div>
      `,

      // =========================================================================
      // SECCIONES ADMINISTRATIVAS (ADMIN / BOARD)
      // =========================================================================

      welcome: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 22px; color: var(--txt-primary); margin-bottom: 10px;">
            <i class="fa-solid fa-hand-sparkles" style="color: var(--amber);"></i>
            Bienvenido a su Centro de Control Inmobiliario
          </h3>
          <p style="font-size: 14px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Esta plataforma es su <strong>oficina administrativa digital 24/7</strong>. Desde aquí podrá gestionar todo lo relacionado con arrendamientos comerciales, cobranzas, gastos comunes, contratos legales y reportes fiscales SENIAT del Centro Comercial Mario Sánchez.
          </p>

          <h4 style="font-family: var(--font-heading); color: var(--cyan); margin: 20px 0 12px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
            <i class="fa-solid fa-rocket"></i> Tour Rápido en 5 Pasos
          </h4>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--cyan); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: var(--cyan-glow); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--cyan);">1</div>
                <strong style="color: var(--txt-primary);">Mire el Panel Superior</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                Las <strong>6 tarjetas KPI</strong> arriba le muestran en tiempo real: ocupación, facturación, recaudación, mora, egresos y utilidad neta del mes.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--amber); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: var(--amber-glow); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--amber);">2</div>
                <strong style="color: var(--txt-primary);">Navegue por el Menú Izquierdo</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                Las <strong>8 pestañas</strong> (Locales, Cobranzas, Gastos, Calendario, Alertas, Informes, Configuración, Ayuda) le dan acceso a cada área.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--emerald); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: rgba(16,185,129,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--emerald);">3</div>
                <strong style="color: var(--txt-primary);">Cambie la Moneda Arriba</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                El selector <strong>USD / EUR / Bs. / USDT</strong> convierte al instante TODOS los montos de la pantalla con la tasa oficial BCV del día.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--purple); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: rgba(168,85,247,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--purple);">4</div>
                <strong style="color: var(--txt-primary);">Actualice la Tasa BCV</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                Haga clic en el ícono <i class="fa-solid fa-arrows-rotate"></i> del ticker superior para sincronizar la tasa oficial en vivo desde el BCV y Binance P2P.
              </p>
            </div>
          </div>
        </div>
      `,

      dashboard: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-gauge-high" style="color: var(--cyan);"></i>
            Panel de Control Superior (KPIs) — Qué significa cada número
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Las 6 tarjetas superiores son sus <strong>indicadores clave de rendimiento</strong> (KPIs). Se recalculan en tiempo real cada vez que ingresa un pago, gasto o modifica una cuota.
          </p>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: var(--bg-card); border-left: 5px solid var(--cyan); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 15px;">Ocupación del Inmueble</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                Porcentaje del área total del centro comercial que está actualmente arrendada. Se calcula como (m² arrendados ÷ m² totales) × 100.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--amber); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 15px;">Facturación Mensual</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                El monto TOTAL facturado en el período (canon de arrendamiento + condominio), independientemente de si se ha cobrado o no.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--emerald); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 15px;">Total Recaudado</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                El dinero que REALMENTE ha ingresado y ha sido conciliado en las cuentas del centro comercial.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--rose); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px; color: var(--txt-primary); font-size: 15px;">Cuentas por Cobrar (Mora)</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                Total pendiente de cobro en el mes. Cuotas vencidas que requieren gestión de cobranza activa.
              </p>
            </div>
          </div>
        </div>
      `,

      locales: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-store" style="color: var(--amber);"></i>
            Gestión de Locales Comerciales & Inquilinos
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Administración completa de unidades físicas, contratos de arrendamiento, alícuotas de condominio y datos fiscales.
          </p>
          <ul style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8;">
            <li><strong>Registrar Nuevo Local:</strong> Cree unidades asignando código de local, área en m², alícuota porcentual y canon base.</li>
            <li><strong>Asignar Inquilino:</strong> Vincule datos jurídicos del comerciante (Razón Social, RIF, teléfono de contacto y correo para notificaciones).</li>
            <li><strong>Fijación de Cánones:</strong> Compatible con modalidad fija, variable sobre ventas o mixta conforme al Decreto Ley 929.</li>
          </ul>
        </div>
      `,

      cobranzas: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-receipt" style="color: var(--emerald);"></i>
            Módulo de Cobranzas, Conciliación & Recibos
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Control de facturas emitidas, revisión de pagos pendientes y emisión de comprobantes oficiales con hash SHA-256.
          </p>
          <ul style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8;">
            <li><strong>Revisión de Comprobantes:</strong> Cuando un inquilino carga su pago, aparece con estado ⏳ En Revisión. El administrador puede verificar el extracto bancario y presionar "Aprobar y Conciliar" o "Rechazar" indicando el motivo.</li>
            <li><strong>Snapshot Financiero:</strong> Al aprobar, el sistema congela la tasa oficial BCV del momento exacto del pago.</li>
            <li><strong>Recibos Correlativos:</strong> Se emite un recibo oficial inmutable con firma criptográfica.</li>
          </ul>
        </div>
      `,

      gastos: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-calculator" style="color: var(--purple);"></i>
            Gastos Comunes & Distribución por Alícuota
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Motor de cálculo automático de condominio según la alícuota de cada local comercial.
          </p>
          <ul style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8;">
            <li><strong>Carga de Egresos:</strong> Servicios públicos (electricidad, agua, aseo), nómina y vigilancia, mantenimiento y reparaciones.</li>
            <li><strong>Distribución Equitativa:</strong> Cada gasto se reparte automáticamente entre los locales según su porcentaje de participación indivisa.</li>
          </ul>
        </div>
      `,

      calendario: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-calendar-days" style="color: var(--cyan);"></i>
            Calendario Operativo & Recordatorios
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7;">
            Visualización gráfica de vencimientos de cánones, fechas de corte fiscal, mantenimientos preventivos y eventos administrativos.
          </p>
        </div>
      `,

      informes: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-file-contract" style="color: var(--amber);"></i>
            Informes Contables & Exportación SENIAT
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Generación instantánea de reportes ejecutivos para la junta de condominio y archivos TXT con formato tributario oficial.
          </p>
          <ul style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8;">
            <li><strong>Informe de Recaudación:</strong> Balance de facturación, efectividad de cobranza y detalle por local.</li>
            <li><strong>Libro de Compras / Ventas SENIAT:</strong> Cumple con la Providencia Administrativa SNAT/2014/0032.</li>
            <li><strong>Certificados de Solvencia:</strong> Emisión de constancias de solvencia con sello de verificación.</li>
          </ul>
        </div>
      `,

      legal: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-scale-balanced" style="color: var(--purple);"></i>
            Marco Jurídico Inmobiliario Venezolano
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7;">
            Normativa aplicable: Decreto Ley N° 929 de Arrendamiento Comercial, Prórrogas Legales del Art. 25, Ley del BCV Art. 128 y Convenio Cambiario N° 1.
          </p>
        </div>
      `,

      seguridad: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-shield-halved" style="color: var(--cyan);"></i>
            Arquitectura de Seguridad & Auditoría
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7;">
            Protección de datos bajo modelo Zero-Trust, control de acceso RBAC, sanitización contra inyecciones y cabeceras estrictas CSP + HSTS.
          </p>
        </div>
      `,

      faq: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-circle-question" style="color: var(--amber);"></i>
            Preguntas Frecuentes & Soporte Administrativo
          </h3>
          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7;">
            Canales de contacto y resolución de incidencias técnicas o financieras en la plataforma.
          </p>
        </div>
      `
    };

    return templates[tab] || templates.welcome;
  }
};

window.HelpContent = HelpContent;
