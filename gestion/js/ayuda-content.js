/**
 * ============================================================================
 * MÓDULO DE AYUDA DIDÁCTICA & GUÍA DEL USUARIO
 * Centro Comercial Mario Sánchez — Suite de Gestión Inmobiliaria
 * Explica paso a paso cómo funciona cada módulo del sistema
 * ============================================================================
 */

const HelpContent = {
  /**
   * Renderiza la vista completa de ayuda con navegación por sub-pestañas
   */
  render() {
    const container = document.getElementById('help-content-container');
    if (!container) return;

    container.innerHTML = `
      <!-- BARRA DE NAVEGACIÓN DE SUB-SECCIONES -->
      <div class="help-nav-bar" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; padding: 10px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 10px;">
        <button class="help-nav-btn active" data-help-tab="welcome" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
          <i class="fa-solid fa-house"></i> Bienvenida
        </button>
        <button class="help-nav-btn" data-help-tab="dashboard" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-gauge-high"></i> Dashboard
        </button>
        <button class="help-nav-btn" data-help-tab="locales" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-store"></i> Locales
        </button>
        <button class="help-nav-btn" data-help-tab="cobranzas" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-receipt"></i> Cobranzas
        </button>
        <button class="help-nav-btn" data-help-tab="gastos" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-calculator"></i> Gastos
        </button>
        <button class="help-nav-btn" data-help-tab="calendario" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-calendar-days"></i> Calendario
        </button>
        <button class="help-nav-btn" data-help-tab="informes" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-file-contract"></i> Informes
        </button>
        <button class="help-nav-btn" data-help-tab="legal" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-scale-balanced"></i> Marco Legal
        </button>
        <button class="help-nav-btn" data-help-tab="seguridad" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-shield-halved"></i> Seguridad
        </button>
        <button class="help-nav-btn" data-help-tab="faq" style="flex: 1; min-width: 120px; padding: 8px 12px; background: transparent; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--txt-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-circle-question"></i> FAQ & Errores
        </button>
      </div>

      <!-- CONTENEDOR DEL CONTENIDO DIDÁCTICO -->
      <div id="help-content-area"></div>
    `;

    // Activar navegación
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

    // Renderizar pestaña inicial
    const activeBtn = document.querySelector('.help-nav-btn.active');
    if (activeBtn) {
      activeBtn.style.background = 'var(--cyan-glow)';
      activeBtn.style.color = 'var(--cyan)';
      activeBtn.style.borderColor = 'var(--cyan)';
    }
    HelpContent.renderTab('welcome');
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

      // ─────────────────────────────────────────────────────────────
      // 1. BIENVENIDA & TOUR GUIADO
      // ─────────────────────────────────────────────────────────────
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

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--rose); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: rgba(244,63,94,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--rose);">5</div>
                <strong style="color: var(--txt-primary);">Use el Modo Oscuro/Claro</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                El botón <i class="fa-solid fa-sun"></i> arriba a la derecha alterna entre modo oscuro (recomendado) y claro. Su preferencia se guarda automáticamente.
              </p>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 4px solid var(--cyan); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: var(--cyan-glow); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--cyan);">+</div>
                <strong style="color: var(--txt-primary);">Instale en su Celular (PWA)</strong>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); line-height: 1.6;">
                Esta app funciona sin internet. En Chrome móvil, pulse el menú <strong>⋮ → "Instalar aplicación"</strong> para tenerla como ícono en su pantalla de inicio.
              </p>
            </div>
          </div>

          <div style="margin-top: 24px; padding: 18px; background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(14,165,233,0.05)); border: 1px solid var(--border-highlight); border-radius: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <i class="fa-solid fa-lightbulb" style="color: var(--amber); font-size: 20px;"></i>
              <strong style="color: var(--txt-primary); font-size: 14px;">💡 Consejo Pro:</strong>
            </div>
            <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
              Los <strong>botones azules</strong> en cualquier tabla abren ventanas de detalle; los <strong>botones verdes</strong> registran pagos; los <strong>botones naranja</strong> abren WhatsApp con mensajes pre-escritos para cobrar; y los <strong>botones rosa</strong> eliminan registros (con confirmación).
            </p>
          </div>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 2. DASHBOARD & KPIs EXPLICADOS
      // ─────────────────────────────────────────────────────────────
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
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="kpi-icon-badge badge-cyan"><i class="fa-solid fa-building-circle-check"></i></div>
                  <h4 style="margin: 0; color: var(--txt-primary); font-size: 15px;">Ocupación del Inmueble</h4>
                </div>
                <span class="status-pill pill-info">Solo Administrador</span>
              </div>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué mide?</strong> Porcentaje del área total del centro comercial que está actualmente arrendada.<br>
                <strong>¿Cómo se calcula?</strong> (m² arrendados ÷ m² totales) × 100.<br>
                <strong>¿Para qué sirve?</strong> Evaluar eficiencia comercial. Un valor bajo (menos del 80%) indica que hay locales disponibles para ofertar.<br>
                <strong style="color: var(--amber);">Ejemplo:</strong> "85% = 4,411 m² de 5,190 m² están ocupados por comerciantes activos."
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--amber); padding: 18px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div class="kpi-icon-badge badge-amber"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                <h4 style="margin: 0; color: var(--txt-primary); font-size: 15px;">Facturación Mensual</h4>
              </div>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué mide?</strong> El monto TOTAL facturado en el período (canon de arrendamiento + condominio), independientemente de si se ha cobrado o no.<br>
                <strong>¿Cómo se calcula?</strong> Suma de TODAS las facturas emitidas para el mes/año seleccionado.<br>
                <strong>¿Para qué sirve?</strong> Medir el potencial de ingresos del período.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--emerald); padding: 18px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div class="kpi-icon-badge badge-emerald"><i class="fa-solid fa-circle-check"></i></div>
                <h4 style="margin: 0; color: var(--txt-primary); font-size: 15px;">Total Recaudado</h4>
              </div>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué mide?</strong> Solo el dinero que REALMENTE ha ingresado a las cuentas del centro comercial.<br>
                <strong>¿Cómo se calcula?</strong> Suma de facturas con estado "Pagado" + porcentaje de efectividad.<br>
                <strong>💡 Tip inquilino:</strong> Para usted, esta tarjeta se convierte en un <strong>"Semáforo de Solvencia"</strong>: verde (al día), ámbar (vence en pocos días) o rojo (en mora).
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--rose); padding: 18px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div class="kpi-icon-badge badge-rose"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <h4 style="margin: 0; color: var(--txt-primary); font-size: 15px;">Cuentas por Cobrar (Mora)</h4>
              </div>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué mide?</strong> El monto total de facturas vencidas (pasados los días de gracia configurados).<br>
                <strong>⚠️ Acción inmediata:</strong> Cuando este número crece, diríjase a <strong>Alertas & Avisos</strong> para enviar recordatorios por WhatsApp a los inquilinos morosos con un solo clic.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--purple); padding: 18px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div class="kpi-icon-badge badge-purple"><i class="fa-solid fa-money-bill-transfer"></i></div>
                <h4 style="margin: 0; color: var(--txt-primary); font-size: 15px;">Egresos Operativos</h4>
              </div>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué mide?</strong> Todo lo gastado en el mes: vigilancia, energía eléctrica común, cisterna de agua, mantenimiento, etc.<br>
                <strong>💡 Dato importante:</strong> Estos gastos se distribuyen después entre todos los inquilinos según su alícuota de m² (ver sección Gastos Comunes).
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--emerald); padding: 18px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div class="kpi-icon-badge badge-emerald"><i class="fa-solid fa-chart-line"></i></div>
                <h4 style="margin: 0; color: var(--txt-primary); font-size: 15px;">Utilidad Neta del Mes</h4>
              </div>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué mide?</strong> La ganancia real: <strong>Recaudado − Egresos</strong>.<br>
                <strong>¿Cómo interpretar?</strong> Verde = ganancia. Rojo = pérdida (necesita revisar cobranzas o reducir gastos).<br>
                <strong>📊 Benchmark:</strong> Una utilidad saludable para un centro comercial venezolano es entre 15% y 30% de la facturación total.
              </p>
            </div>

          </div>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 3. GESTIÓN DE LOCALES E INQUILINOS
      // ─────────────────────────────────────────────────────────────
      locales: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-store" style="color: var(--amber);"></i>
            Locales & Inquilinos — Directorio Completo
          </h3>

          <div style="background: linear-gradient(135deg, rgba(245,158,11,0.08), transparent); padding: 16px; border-radius: 8px; margin-bottom: 18px; border: 1px solid var(--border-highlight);">
            <strong style="color: var(--amber);">¿Qué encontrará aquí?</strong>
            <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 6px 0 0;">
              El listado de TODOS los espacios comerciales del centro (11 unidades) con sus inquilinos, RIF, contratos, áreas y estado de solvencia.
            </p>
          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">📋 Paso a Paso: Registrar un Nuevo Inquilino</h4>
          <ol style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8; padding-left: 20px;">
            <li>Haga clic en el botón <strong style="color: var(--amber);">"Registrar Inquilino"</strong> (arriba a la derecha) o en el ícono <i class="fa-solid fa-user-plus"></i> junto a cualquier local disponible.</li>
            <li>Se abre el <strong>Asistente de Onboarding</strong> — llene los 4 pasos: datos fiscales (RIF, razón social), datos del representante legal, actividad comercial y condiciones del contrato.</li>
            <li>El sistema genera automáticamente: contrato legal (G.O. 40.418), primera cuota, registro en el calendario y expediente jurídico.</li>
            <li>El nuevo inquilino queda <strong>"Pendiente de Aprobación por Comité"</strong> hasta que usted lo autorice en Configuración.</li>
          </ol>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">📂 Los 4 Botones de Acción por Local</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
            <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <i class="fa-solid fa-folder-open" style="color: var(--amber);"></i>
                <strong style="font-size: 12px;">Expediente</strong>
              </div>
              <p style="font-size: 11px; color: var(--txt-secondary); margin: 0;">Abre ficha completa: datos, contrato, historial de pagos, solvencia.</p>
            </div>
            <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <i class="fa-solid fa-file-signature" style="color: var(--cyan);"></i>
                <strong style="font-size: 12px;">Contrato</strong>
              </div>
              <p style="font-size: 11px; color: var(--txt-secondary); margin: 0;">Genera contrato legal imprimible con sello SHA-256.</p>
            </div>
            <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i>
                <strong style="font-size: 12px;">WhatsApp</strong>
              </div>
              <p style="font-size: 11px; color: var(--txt-secondary); margin: 0;">Abre WhatsApp Web con mensaje pre-escrito al inquilino.</p>
            </div>
            <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <i class="fa-solid fa-scale-balanced" style="color: var(--amber);"></i>
                <strong style="font-size: 12px;">Prórroga</strong>
              </div>
              <p style="font-size: 11px; color: var(--txt-secondary); margin: 0;">Calcula meses de prórroga legal Art. 25 G.O. 40.418.</p>
            </div>
          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">🎨 Significado de los Estados (Badges de Color)</h4>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
            <div><span class="status-pill pill-active"><i class="fa-solid fa-circle-check"></i> Solvente</span> — Inquilino al día con todos sus pagos.</div>
            <div><span class="status-pill pill-warning"><i class="fa-solid fa-clock"></i> Por Vencer</span> — Contrato próximo a expirar (30 días o menos).</div>
            <div><span class="status-pill pill-overdue"><i class="fa-solid fa-circle-exclamation"></i> En Mora</span> — Inquilino con cuotas vencidas.</div>
            <div><span class="status-pill pill-info"><i class="fa-solid fa-circle"></i> Disponible</span> — Local sin arrendatario asignado.</div>
          </div>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 4. COBRANZAS, PAGOS Y RECIBOS
      // ─────────────────────────────────────────────────────────────
      cobranzas: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-receipt" style="color: var(--emerald);"></i>
            Cobranzas & Recibos — Flujo Completo de Pago
          </h3>

          <div style="background: linear-gradient(135deg, rgba(16,185,129,0.08), transparent); padding: 16px; border-radius: 8px; margin-bottom: 18px; border: 1px solid var(--border-highlight);">
            <strong style="color: var(--emerald);">💡 Este es el módulo MÁS usado del sistema.</strong>
            <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 6px 0 0;">
              Aquí se concentra todo el proceso de cobro: desde la factura pendiente hasta el recibo oficial impreso.
            </p>
          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">🔄 Flujo de Pago (4 Estados)</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 20px;">
            <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border-left: 4px solid var(--amber);">
              <strong style="color: var(--amber); font-size: 12px;">1. PENDIENTE</strong>
              <p style="font-size: 11px; color: var(--txt-secondary); margin: 6px 0 0;">Factura generada pero sin pagar. Se genera automáticamente el día 1 de cada mes.</p>
            </div>
            <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border-left: 4px solid #2563eb;">
              <strong style="color: #2563eb; font-size: 12px;">2. EN REVISIÓN</strong>
              <p style="font-size: 11px; color: var(--txt-secondary); margin: 6px 0 0;">Inquilino cargó comprobante. Administración debe aprobar o rechazar.</p>
            </div>
            <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border-left: 4px solid var(--rose);">
              <strong style="color: var(--rose); font-size: 12px;">3. EN MORA</strong>
              <p style="font-size: 11px; color: var(--txt-secondary); margin: 6px 0 0;">Pasaron los días de gracia sin pago. Se activan alertas automáticas.</p>
            </div>
            <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border-left: 4px solid var(--emerald);">
              <strong style="color: var(--emerald); font-size: 12px;">4. PAGADO ✓</strong>
              <p style="font-size: 11px; color: var(--txt-secondary); margin: 6px 0 0;">Pago aprobado. Se emite recibo oficial con sello SHA-256 inmutable.</p>
            </div>
          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">✅ Registrar un Pago (Administrador)</h4>
          <ol style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8; padding-left: 20px;">
            <li>En la tabla de Cobranzas, haga clic en el <strong style="color: var(--emerald);">ícono verde</strong> <i class="fa-solid fa-receipt"></i> de la fila del inquilino.</li>
            <li>Se abre el modal "Registrar y Conciliar Pago". Seleccione moneda (USD, Bs, EUR, USDT).</li>
            <li>Ingrese monto recibido. El sistema convierte automáticamente a las 4 monedas en tiempo real.</li>
            <li>Seleccione método de pago: Pago Móvil, Transferencia, Zelle, Efectivo, Cripto.</li>
            <li>Escriba la referencia bancaria (ej: "REF-88901234").</li>
            <li><strong style="color: var(--amber);">OBLIGATORIO:</strong> Arrastre o seleccione el comprobante (captura de pantalla, PDF bancario, etc.).</li>
            <li>Clic en "Confirmar Pago & Guardar Comprobante". El recibo se genera e imprime automáticamente.</li>
          </ol>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">👤 Reportar un Pago (Inquilino — Portal Cliente)</h4>
          <ol style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8; padding-left: 20px;">
            <li>El inquilino entra con su usuario y ve <strong>solo sus facturas</strong>.</li>
            <li>Hace clic en <strong style="color: var(--emerald);">"Reportar / Cargar Pago"</strong> (botón verde arriba).</li>
            <li>Selecciona su cuota pendiente y carga el comprobante.</li>
            <li>La factura pasa a estado "En Revisión".</li>
            <li>El administrador recibe notificación y aprueba o rechaza (con motivo).</li>
            <li>Una vez aprobado, el recibo oficial queda disponible para descarga.</li>
          </ol>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">🏦 Cuentas Receptoras (Portal del Inquilino)</h4>
          <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7;">
            Los inquilinos ven <strong>solamente las cuentas bancarias autorizadas</strong> para pagar: Banesco, Mercantil, Pago Móvil, Zelle, Wallet USDT (TRC20), Binance Pay. Cada cuenta muestra banco, número, RIF del titular y teléfono.
          </p>

          <div style="background: rgba(244,63,94,0.05); border-left: 4px solid var(--rose); padding: 14px; border-radius: 6px; margin-top: 16px;">
            <strong style="color: var(--rose);">⚠️ Protección IDOR:</strong>
            <p style="font-size: 12px; color: var(--txt-secondary); margin: 6px 0 0;">
              Los inquilinos NO pueden ver recibos ni pagos de otros locales. El sistema bloquea cualquier intento de acceder a facturas ajenas (defensa zero-trust).
            </p>
          </div>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 5. GASTOS COMUNES Y CONDOMINIO
      // ─────────────────────────────────────────────────────────────
      gastos: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-calculator" style="color: var(--purple);"></i>
            Gastos Comunes — Cómo se Distribuye el Condominio
          </h3>

          <div style="background: linear-gradient(135deg, rgba(168,85,247,0.08), transparent); padding: 16px; border-radius: 8px; margin-bottom: 18px; border: 1px solid var(--border-highlight);">
            <strong style="color: var(--purple);">¿Qué es el condominio?</strong>
            <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 6px 0 0;">
              Son los gastos compartidos de TODO el centro comercial: vigilancia, luz de áreas comunes, aseo, cisterna, mantenimiento, administración. Cada inquilino paga su parte proporcional según los m² que ocupa.
            </p>
          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">📐 Fórmula Matemática</h4>
          <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border: 1px solid var(--border-subtle); font-family: monospace; font-size: 13px; color: var(--txt-primary); text-align: center;">
            Cuota del Inquilino = Gasto Total × (m² del Local ÷ m² Totales del Centro)
          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">📝 Ejemplo Real</h4>
          <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; font-size: 12.5px; line-height: 1.8; color: var(--txt-secondary);">
            <p><strong style="color: var(--txt-primary);">Gastos del mes:</strong> $1,950 USD (vigilancia + luz + agua + aseo)</p>
            <p><strong style="color: var(--txt-primary);">m² totales del centro:</strong> 5,190 m²</p>
            <p><strong style="color: var(--txt-primary);">Local PB-08 (Farmacia):</strong> 120 m² → Alícuota: 120 ÷ 5,190 = <strong style="color: var(--amber);">2.31%</strong></p>
            <p><strong style="color: var(--txt-primary);">Cuota condominio PB-08:</strong> $1,950 × 2.31% = <strong style="color: var(--emerald);">$45.05 USD</strong></p>
          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">➕ Registrar un Nuevo Gasto (Paso a Paso)</h4>
          <ol style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8; padding-left: 20px;">
            <li>Clic en <strong style="color: var(--purple);">"Registrar Gasto / Factura"</strong> (arriba a la derecha).</li>
            <li>Concepto: "Vigilancia y Seguridad Armada 24/7".</li>
            <li>Categoría: Seguridad y Vigilancia.</li>
            <li>Período: mes/año al que corresponde.</li>
            <li>Datos del proveedor: razón social + RIF.</li>
            <li><strong style="color: var(--amber);">Obligatorio:</strong> número de factura fiscal + número de control SENIAT.</li>
            <li>Monto en USD (el sistema calcula Bs automáticamente con tasa BCV del día).</li>
            <li><strong>Marque casillas de retenciones:</strong> IVA 75% (si aplica) + ISLR 2% (servicios).</li>
            <li>Adjunte factura escaneada (PDF o imagen, máx 10 MB).</li>
            <li>Guardar. El sistema recalcula TODAS las cuotas condominales automáticamente.</li>
          </ol>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">💰 Retenciones SENIAT Automáticas</h4>
          <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7;">
            Al registrar un gasto con retenciones, el sistema calcula automáticamente:
          </p>
          <ul style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8; padding-left: 20px;">
            <li><strong style="color: var(--amber);">Retención IVA 75%:</strong> Si el proveedor es Contribuyente Especial, usted retiene el 75% del IVA de la factura. (16% × 75% = 12% efectivo).</li>
            <li><strong style="color: var(--rose);">Retención ISLR 2%:</strong> Para servicios profesionales prestados por personas jurídicas.</li>
          </ul>
          <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin-top: 10px;">
            Luego podrá <strong>exportar el TXT oficial</strong> para cargar directamente en el portal del SENIAT (ver sección Informes).
          </p>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 6. CALENDARIO, ALERTAS Y NOTIFICACIONES
      // ─────────────────────────────────────────────────────────────
      calendario: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-calendar-days" style="color: var(--amber);"></i>
            Calendario, Vencimientos y Alertas
          </h3>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">📅 El Calendario Mensual Interactivo</h4>
          <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7;">
            La cuadrícula muestra todos los días del mes con <strong>badges de colores</strong> indicando eventos:
          </p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin: 10px 0 20px; font-size: 12px;">
            <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: var(--amber); border-radius: 2px;"></span> Vencimiento de Cuota</div>
            <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: var(--purple); border-radius: 2px;"></span> Corte de Condominio</div>
            <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: var(--cyan); border-radius: 2px;"></span> Vencimiento Contrato</div>
            <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: var(--rose); border-radius: 2px;"></span> Prórroga Legal</div>
          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">➕ Crear un Nuevo Recordatorio</h4>
          <ol style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8; padding-left: 20px;">
            <li>Clic en <strong>"+ Nuevo Recordatorio"</strong> (arriba del calendario) o directamente en una celda vacía del calendario.</li>
            <li>Complete: título, fecha, categoría (Asamblea, Mantenimiento, Cuota, etc.), instrucción.</li>
            <li>Guardar. El evento aparece en el calendario y en la lista de hitos.</li>
            <li>Opcional: clic en <strong>"Google Calendar"</strong> para sincronizar con su agenda personal.</li>
          </ol>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">🔔 Centro de Alertas (Pestaña "Alertas & Avisos")</h4>
          <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7;">
            Lista automática de inquilinos con cuotas pendientes o en mora. Cada tarjeta tiene <strong>dos botones de acción:</strong>
          </p>
          <ul style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.8; padding-left: 20px;">
            <li><i class="fa-brands fa-whatsapp" style="color: #25D366;"></i> <strong>Enviar WhatsApp:</strong> Abre WhatsApp Web con mensaje pre-escrito en las 4 monedas.</li>
            <li><i class="fa-regular fa-envelope" style="color: var(--cyan);"></i> <strong>Gmail:</strong> Abre Gmail con el mismo mensaje en formato email.</li>
          </ul>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 18px 0 10px;">⚙️ Personalizar Plantillas de Mensajes</h4>
          <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7;">
            En <strong>Configuración</strong> puede editar los textos que se envían automáticamente. Use variables como <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 3px; color: var(--amber);">{inquilino}</code>, <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 3px; color: var(--amber);">{monto_usd}</code>, <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 3px; color: var(--amber);">{tasa_bcv}</code> para personalizar.
          </p>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 7. INFORMES, SENIAT Y CONCILIACIÓN
      // ─────────────────────────────────────────────────────────────
      informes: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-file-contract" style="color: var(--cyan);"></i>
            Informes & Contabilidad — 6 Tipos de Reportes
          </h3>

          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            El sistema genera automáticamente 6 tipos de reportes ejecutivos, todos imprimibles, exportables a Excel y con formato legal.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-top: 4px solid var(--cyan);">
              <h5 style="margin: 0 0 8px 0; color: var(--cyan); font-size: 13px;">1. Recaudación Mensual</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Reporte ejecutivo con facturación, cobranza efectiva, cartera vencida y efectividad. Incluye tabla detallada por inquilino con montos en USD y Bs.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-top: 4px solid var(--purple);">
              <h5 style="margin: 0 0 8px 0; color: var(--purple); font-size: 13px;">2. Gastos Comunes</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Liquidación condominal: lista todos los gastos del mes y muestra la distribución alícuota por unidad comercial.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-top: 4px solid var(--emerald);">
              <h5 style="margin: 0 0 8px 0; color: var(--emerald); font-size: 13px;">3. Certificado de Solvencia</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Constancia oficial para un inquilino específico. Indica si está solvente o no, con historial completo de pagos.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-top: 4px solid var(--amber);">
              <h5 style="margin: 0 0 8px 0; color: var(--amber); font-size: 13px;">4. Libro de Ventas SENIAT</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Libro fiscal de ventas conforme a Providencia SNAT/2014/0032. Base imponible, débito fiscal IVA 16%, IVA retenido 75%.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-top: 4px solid var(--rose);">
              <h5 style="margin: 0 0 8px 0; color: var(--rose); font-size: 13px;">5. Libro de Compras & Retenciones</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Todas las facturas de proveedores con retenciones IVA/ISLR aplicadas. Incluye <strong>exportación TXT oficial</strong> para cargar al portal SENIAT.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-top: 4px solid #6366f1;">
              <h5 style="margin: 0 0 8px 0; color: #6366f1; font-size: 13px;">6. Conciliación Bancaria</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); line-height: 1.6; margin: 0;">
                Auditoría automática multientidad (Banesco, Mercantil, BDV, Zelle, Binance). Compara extractos bancarios con facturas.
              </p>
            </div>

          </div>

          <h4 style="color: var(--cyan); font-size: 14px; margin: 24px 0 10px;">📥 Cómo Exportar a Excel, Google Sheets o Imprimir</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
            <div style="background: var(--bg-card); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle); font-size: 11.5px;">
              <strong style="color: var(--emerald);"><i class="fa-solid fa-file-excel"></i> Excel (.csv)</strong>
              <p style="margin: 4px 0 0; color: var(--txt-secondary);">Descarga archivo .csv compatible con Excel, LibreOffice, Numbers.</p>
            </div>
            <div style="background: var(--bg-card); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle); font-size: 11.5px;">
              <strong style="color: var(--cyan);"><i class="fa-solid fa-table"></i> Google Sheets</strong>
              <p style="margin: 4px 0 0; color: var(--txt-secondary);">Copia la tabla al portapapeles; pegue en Sheets con Ctrl+V.</p>
            </div>
            <div style="background: var(--bg-card); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle); font-size: 11.5px;">
              <strong style="color: var(--amber);"><i class="fa-solid fa-file-code"></i> TXT SENIAT</strong>
              <p style="margin: 4px 0 0; color: var(--txt-secondary);">Archivo oficial para cargar al portal fiscal del SENIAT.</p>
            </div>
            <div style="background: var(--bg-card); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle); font-size: 11.5px;">
              <strong style="color: var(--cyan);"><i class="fa-solid fa-print"></i> Imprimir/PDF</strong>
              <p style="margin: 4px 0 0; color: var(--txt-secondary);">Abre diálogo de impresión. Seleccione "Guardar como PDF".</p>
            </div>
          </div>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 8. MARCO LEGAL (AMPLIADO)
      // ─────────────────────────────────────────────────────────────
      legal: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-scale-balanced" style="color: var(--amber);"></i>
            Marco Legal Completo — Gaceta Oficial N° 40.418
          </h3>

          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Esta plataforma está fundamentada en el <strong>Decreto con Rango, Valor y Fuerza de Ley de Regulación del Arrendamiento Inmobiliario para Uso Comercial</strong>, publicado en Gaceta Oficial N° 40.418. A continuación, los artículos que el sistema aplica automáticamente:
          </p>

          <div style="display: flex; flex-direction: column; gap: 16px;">

            <div style="background: var(--bg-card); border-left: 5px solid var(--amber); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: var(--amber); font-size: 14px;">📜 Artículo 25 — Prórroga Legal de Permanencia</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué dice la ley?</strong> El arrendatario SOLVENTE tiene derecho a prórroga obligatoria según su antigüedad:<br>
                • Menos de 1 año: <strong>6 meses</strong> de prórroga.<br>
                • Entre 1 y 3 años: <strong>12 meses</strong>.<br>
                • Entre 3 y 5 años: <strong>18 meses</strong>.<br>
                • Más de 5 años: <strong>24 a 36 meses</strong>.<br><br>
                <strong style="color: var(--cyan);">Cómo lo aplica el sistema:</strong> La calculadora integrada en cada expediente determina automáticamente el período de prórroga aplicable.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--cyan); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: var(--cyan); font-size: 14px;">💵 Artículo 32 — Canon en Divisas</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué dice la ley?</strong> Los cánones pueden pactarse en moneda extranjera, pero el pago se liquida al tipo de cambio oficial publicado por el <strong>Banco Central de Venezuela (BCV)</strong> en la fecha efectiva del pago.<br><br>
                <strong style="color: var(--cyan);">Cómo lo aplica el sistema:</strong> El motor cuatrimoneda consulta la tasa BCV oficial en vivo y calcula automáticamente el equivalente en bolívares con snapshot inmutable.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--purple); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: var(--purple); font-size: 14px;">🏢 Artículos 38-40 — Gastos Comunes</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué dice la ley?</strong> Los gastos comunes se distribuyen entre todos los arrendatarios de forma <strong>transparente y documentada</strong>. El administrador debe rendir cuentas mensuales con facturas soporte.<br><br>
                <strong style="color: var(--cyan);">Cómo lo aplica el sistema:</strong> Cada gasto queda registrado con proveedor, RIF, factura, número de control SENIAT y archivo digital adjunto. La distribución alícuota se recalcula en tiempo real.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--emerald); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: var(--emerald); font-size: 14px;">🛡️ Artículo 19 — Depósito en Garantía</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué dice la ley?</strong> El depósito máximo permitido es de <strong>3 meses de canon</strong>. No puede aplicarse al pago de cánones corrientes.<br><br>
                <strong style="color: var(--cyan);">Cómo lo aplica el sistema:</strong> El generador de contratos limita automáticamente el depósito al tope legal y lo excluye del flujo mensual.
              </p>
            </div>

            <div style="background: var(--bg-card); border-left: 5px solid var(--rose); padding: 18px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: var(--rose); font-size: 14px;">📜 Providencia SENIAT SNAT/2014/0032</h4>
              <p style="font-size: 12.5px; color: var(--txt-secondary); line-height: 1.7; margin: 0;">
                <strong>¿Qué dice?</strong> Establece el formato oficial de los <strong>Libros de Compra y Venta</strong> del IVA y la obligación de emitir TXT con formato exacto para carga al portal fiscal.<br><br>
                <strong style="color: var(--cyan);">Cómo lo aplica el sistema:</strong> El módulo "Informes" genera ambos libros y el archivo TXT oficial listo para cargar al SENIAT.
              </p>
            </div>

          </div>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 9. SEGURIDAD Y PRIVACIDAD
      // ─────────────────────────────────────────────────────────────
      seguridad: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-shield-halved" style="color: var(--emerald);"></i>
            Seguridad y Privacidad — Cómo Protegemos sus Datos
          </h3>

          <p style="font-size: 13px; color: var(--txt-secondary); line-height: 1.7; margin-bottom: 20px;">
            Esta plataforma implementa <strong>defensa en profundidad</strong> con 8 capas de seguridad activas:
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-left: 4px solid var(--emerald);">
              <h5 style="margin: 0 0 6px; color: var(--emerald); font-size: 12.5px;">🔐 1. Contraseñas con PBKDF2</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); margin: 0; line-height: 1.6;">
                Las contraseñas se guardan con <strong>100,000 iteraciones PBKDF2 + salt aleatorio</strong>. Imposibles de crackear incluso si se filtrara la base de datos.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-left: 4px solid var(--cyan);">
              <h5 style="margin: 0 0 6px; color: var(--cyan); font-size: 12.5px;">🔒 2. Cifrado AES-GCM 256</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); margin: 0; line-height: 1.6;">
                Los comprobantes bancarios se cifran en su navegador con AES-GCM antes de guardarse. Nadie puede leerlos sin su contraseña.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-left: 4px solid var(--amber);">
              <h5 style="margin: 0 0 6px; color: var(--amber); font-size: 12.5px;">🛡️ 3. Anti-XSS (DOMPurify)</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); margin: 0; line-height: 1.6;">
                Todo texto ingresado por el usuario se <strong>sanitiza</strong> antes de mostrarse. Imposible ejecutar código malicioso inyectado.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-left: 4px solid var(--rose);">
              <h5 style="margin: 0 0 6px; color: var(--rose); font-size: 12.5px;">🚫 4. Anti-Inyección SQL</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); margin: 0; line-height: 1.6;">
                El sistema detecta y bloquea patrones de SQL Injection, Command Injection y Prompt Injection en tiempo real.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-left: 4px solid var(--purple);">
              <h5 style="margin: 0 0 6px; color: var(--purple); font-size: 12.5px;">🎯 5. Aislamiento Zero-Trust (IDOR)</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); margin: 0; line-height: 1.6;">
                Cada inquilino <strong>solo puede ver sus propias facturas</strong>. Cualquier intento de acceder a datos ajenos es bloqueado.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-left: 4px solid #6366f1;">
              <h5 style="margin: 0 0 6px; color: #6366f1; font-size: 12.5px;">🔐 6. Rate Limiting</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); margin: 0; line-height: 1.6;">
                Máximo 5 intentos de login fallidos en 15 minutos. Bloqueo automático contra ataques de fuerza bruta.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-left: 4px solid var(--emerald);">
              <h5 style="margin: 0 0 6px; color: var(--emerald); font-size: 12.5px;">🏛️ 7. Políticas RLS Supabase</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); margin: 0; line-height: 1.6;">
                La base de datos PostgreSQL tiene Row-Level Security: cada fila tiene dueño, y solo ese dueño puede leerla/modificarla.
              </p>
            </div>

            <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border-left: 4px solid var(--cyan);">
              <h5 style="margin: 0 0 6px; color: var(--cyan); font-size: 12.5px;">📝 8. Sello SHA-256 Inmutable</h5>
              <p style="font-size: 11.5px; color: var(--txt-secondary); margin: 0; line-height: 1.6;">
                Cada contrato y recibo lleva un <strong>hash criptográfico SHA-256</strong> que garantiza que el documento no ha sido alterado.
              </p>
            </div>

          </div>

          <div style="background: rgba(244,63,94,0.05); border-left: 4px solid var(--rose); padding: 14px; border-radius: 6px; margin-top: 20px;">
            <strong style="color: var(--rose);">🛡️ Recomendaciones de Seguridad para el Usuario:</strong>
            <ul style="font-size: 12px; color: var(--txt-secondary); margin: 8px 0 0; padding-left: 18px; line-height: 1.8;">
              <li>Use contraseñas de mínimo 10 caracteres con mayúsculas, minúsculas y números.</li>
              <li>Cierre sesión al terminar, especialmente en computadoras compartidas.</li>
              <li>NO comparta su contraseña ni la escriba en lugares visibles.</li>
              <li>Verifique que la URL empiece con <code style="background: var(--bg-card); padding: 1px 5px; border-radius: 3px; color: var(--emerald);">https://</code> (candado verde).</li>
              <li>Si detecta actividad sospechosa, cambie su contraseña inmediatamente.</li>
            </ul>
          </div>
        </div>
      `,

      // ─────────────────────────────────────────────────────────────
      // 10. FAQ Y SOLUCIÓN DE ERRORES
      // ─────────────────────────────────────────────────────────────
      faq: `
        <div class="data-card" style="padding: 28px;">
          <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--txt-primary); margin-bottom: 14px;">
            <i class="fa-solid fa-circle-question" style="color: var(--cyan);"></i>
            Preguntas Frecuentes & Solución de Problemas
          </h3>

          <div style="display: flex; flex-direction: column; gap: 14px;">

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ No veo los datos del centro comercial, solo aparece "Cargando..."</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Solución:</strong>
                <ol style="margin: 6px 0; padding-left: 18px;">
                  <li>Verifique su conexión a internet.</li>
                  <li>Presione F5 para recargar la página.</li>
                  <li>Si persiste, limpie caché del navegador (Ctrl+Shift+Del).</li>
                  <li>Verifique que la tasa BCV esté sincronizada (ícono <i class="fa-solid fa-arrows-rotate"></i> en el ticker superior).</li>
                </ol>
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ El sistema no acepta mi contraseña</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Posibles causas:</strong>
                <ul style="margin: 6px 0; padding-left: 18px;">
                  <li>Mayúsculas/minúsculas invertidas (verifique Bloq Mayús).</li>
                  <li>5 intentos fallidos: el sistema bloquea el acceso por 15 minutos por seguridad.</li>
                  <li>Su usuario está "Pendiente de Aprobación": contacte al administrador.</li>
                </ul>
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ Intenté guardar un recordatorio en el calendario y no se guardó</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Solución:</strong> Asegúrese de completar <strong>TODOS los campos obligatorios</strong> (título, fecha, instrucción). Si algún campo queda vacío, el sistema no guarda el evento. Intente de nuevo rellenando todos los campos.
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ El monto en bolívares no coincide con lo que aparece en mi banco</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Explicación:</strong> El sistema usa la <strong>tasa oficial BCV del día</strong>. Las tasas bancarias pueden variar en centavos. Para verificar, haga clic en el ícono de refresh <i class="fa-solid fa-arrows-rotate"></i> del ticker superior para forzar la sincronización en vivo.
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ Como inquilino, no puedo ver las facturas de otros locales</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Esto es INTENCIONAL y es una medida de seguridad:</strong> el sistema aplica aislamiento zero-trust (IDOR protection). Cada inquilino solo puede ver sus propios datos. Esto protege la privacidad financiera de todos los comerciantes.
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ Cómo exportar el Libro SENIAT en TXT oficial</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Paso a paso:</strong>
                <ol style="margin: 6px 0; padding-left: 18px;">
                  <li>Vaya a <strong>Informes & Contabilidad</strong>.</li>
                  <li>Seleccione "Libro de Compras & Retenciones IVA/ISLR".</li>
                  <li>Seleccione el mes y año del período fiscal.</li>
                  <li>Clic en <strong>"TXT SENIAT"</strong> (aparece automáticamente).</li>
                  <li>Se descarga un archivo <code>.txt</code> con el formato oficial de la Providencia SNAT/2014/0032.</li>
                  <li>Cargue este archivo en el portal fiscal del SENIAT (portalfiscal.seniat.gob.ve).</li>
                </ol>
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ El recibo impreso sale muy pequeño o cortado</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Solución:</strong> En el diálogo de impresión del navegador:
                <ul style="margin: 6px 0; padding-left: 18px;">
                  <li>Oriente la hoja en <strong>vertical</strong>.</li>
                  <li>Tamaño: <strong>Carta (Letter)</strong>.</li>
                  <li>Márgenes: <strong>Predeterminados</strong>.</li>
                  <li>Desactive <strong>"Encabezados y pies de página"</strong>.</li>
                  <li>Escala: <strong>100%</strong>.</li>
                </ul>
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ Cómo funciona el modo offline (sin internet)</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                Esta es una <strong>PWA (Progressive Web App)</strong>. Una vez que haya visitado la página al menos una vez, queda instalada en su navegador. Puede:
                <ul style="margin: 6px 0; padding-left: 18px;">
                  <li>Abrir la app sin conexión a internet.</li>
                  <li>Consultar facturas, recibos, contratos cargados previamente.</li>
                  <li>Registrar pagos (se sincronizan cuando regrese la conexión).</li>
                </ul>
                Para activarla en el móvil, use Chrome → Menú <strong>⋮ → "Instalar aplicación"</strong>.
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ ¿Quién puede ver mi información personal?</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Solo usted y los administradores autorizados del centro comercial.</strong> Los datos se almacenan cifrados en servidores de Supabase en Europa (cumpliendo GDPR) y nunca se comparten con terceros. La plataforma cumple con la <strong>Ley Especial contra Delitos Informáticos de Venezuela</strong> y la <strong>Ley de Protección de Datos Personales</strong>.
              </div>
            </details>

            <details style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--txt-primary); font-size: 13px;">❓ Necesito soporte técnico urgente</summary>
              <div style="font-size: 12.5px; color: var(--txt-secondary); margin: 10px 0 0; line-height: 1.7;">
                <strong>Canales de contacto:</strong>
                <ul style="margin: 6px 0; padding-left: 18px;">
                  <li><i class="fa-solid fa-envelope" style="color: var(--cyan);"></i> Email: administracion@ccmariosanchez.com</li>
                  <li><i class="fa-brands fa-whatsapp" style="color: #25D366;"></i> WhatsApp: +58 424-7380002 (horario 8am-6pm)</li>
                  <li><i class="fa-solid fa-phone" style="color: var(--amber);"></i> Teléfono oficina: +58 281-2674400</li>
                </ul>
              </div>
            </details>

          </div>
        </div>
      `
    };

    return templates[tab] || templates.welcome;
  }
};

window.HelpContent = HelpContent;
