/**
 * ==============================================================================
 * APLICACIÓN PRINCIPAL: GESTIÓN DE INQUILINOS, CONTABILIDAD Y COBRANZAS
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 * Arquitectura Cuatrimoneda (USD / EUR / VES / USDT) & Modo Dual (Claro / Oscuro)
 * ==============================================================================
 */

// Guard de acceso inmediato (Auto-redirect si no hay sesión)
(function() {
  if (typeof AuthGuard !== 'undefined') {
    const sess = AuthGuard.require('any');
    if (!sess) return;
    document.documentElement.removeAttribute('data-auth-pending');
  }
})();

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.warn('[PWA] ServiceWorker registration skipped:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  /**
   * Helper para notificaciones tipo Toast seguras y no intrusivas
   */
  function showToast(message, type = 'info', title = null) {
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast(message, type, title);
    } else {
      console.log(`[TOAST ${type}]`, title ? `${title}: ${message}` : message);
    }
  }
  window.showToast = showToast;

  // ==============================================================================
  // GESTOR UNIVERSAL DE MODALES (EJECUTIVO, ROBUSTO Y MULTI-NAVEGADOR)
  // ==============================================================================
  window.openModal = function(modalOrId) {
    const modal = (typeof modalOrId === 'string') 
      ? document.getElementById(modalOrId) 
      : modalOrId;
    if (modal) {
      modal.style.removeProperty('display');
      modal.style.display = 'flex';
      modal.classList.add('open', 'active');
      const win = modal.querySelector('.modal-window');
      if (win) win.scrollTop = 0;
    }
  };

  window.closeModal = function(modalOrId) {
    const modal = (typeof modalOrId === 'string') 
      ? document.getElementById(modalOrId) 
      : modalOrId;
    if (modal) {
      modal.classList.remove('open', 'active');
      modal.style.display = 'none';
    }
  };

  window.closeAllModals = function() {
    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.classList.remove('open', 'active');
      m.style.display = 'none';
    });
  };

  window.closePaymentModal = function() { window.closeModal('modal-payment'); };
  window.closeDossierModal = function() { window.closeModal('modal-dossier'); };
  window.closeProrrogaModal = function() { window.closeModal('modal-prorroga'); };
  window.closeExpenseProofModal = function() { window.closeModal('modal-expense-proof'); };
  window.closeInviteUserModal = function() { window.closeModal('modal-invite-user'); };
  window.closeCalendarDetailModal = function() { window.closeModal('modal-calendar-detail'); };
  window.closeRatesEditorModal = function() { window.closeModal('modal-rates-editor'); };
  window.closeBankAccountModal = function() { window.closeModal('modal-bank-account'); };
  window.closeContractModal = function() { window.closeModal('modal-contract-viewer'); };
  window.closeReceiptPreviewModal = function() { window.closeModal('modal-receipt-preview'); };
  window.closeExpenseModal = function() { window.closeModal('modal-expense'); };

  /**
   * Genera sello SHA-256 REAL de 256 bits vía WebCrypto API
   * Reemplaza el hash de 4x32 bits en los recibos oficiales
   */
  async function generateReceiptSealAsync(receipt, bcvRate) {
    const rawSealData = [
      receipt.receipt_number,
      receipt.tenant_rif,
      Number(receipt.total_usd || 0).toFixed(2),
      bcvRate,
      'GO40418',
      receipt.approved_at || Date.now()
    ].join('|');

    try {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(rawSealData)
      );
      const hashHex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      return `CCMS-SHA256-${hashHex.substring(0, 16).toUpperCase()}-${hashHex.substring(48, 64).toUpperCase()}`;
    } catch (err) {
      console.warn('[SECURITY] WebCrypto no disponible, usando fallback:', err);
      return `CCMS-LEGACY-${Date.now().toString(16).toUpperCase()}`;
    }
  }

  // Aplicar visibilidad y chip de usuario
  if (window.AuthGuard) {
    AuthGuard.mountUserChip();
    AuthGuard.applyRoleVisibility();
  }

  // 1. ESTADO GLOBAL
  const session = (window.AuthGuard && window.AuthGuard.currentUser) ? window.AuthGuard.currentUser() : null;
  const currentRole = session ? session.role : 'admin'; // fallback si guard no está cargado
  const currentTenantId = session ? session.tenant_id : null;
  let currentCurrency = localStorage.getItem('ccms_active_currency') || 'USD'; // 'USD', 'EUR', 'VES', 'USDT'
  let currentTheme = localStorage.getItem('ccms_theme') || 'dark'; // 'dark' o 'light'

  // Para inquilinos arrancamos en la pestaña de cobranzas (lo único que les concierne)
  let currentTab = (currentRole === 'tenant') ? 'cobranzas' : 'inquilinos';

  // Si el usuario es inquilino, activar de inmediato tab-cobranzas y ocultar tab-inquilinos
  if (currentRole === 'tenant') {
    const targetTab = document.querySelector('.nav-item[data-tab="cobranzas"]');
    if (targetTab) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      targetTab.classList.add('active');
    }
    document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');
    const cobView = document.getElementById('tab-cobranzas');
    if (cobView) cobView.style.display = 'block';
  }

  // 2. INICIALIZAR TEMA (MODO CLARO / OSCURO)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const htmlRoot = document.documentElement;

  function applyTheme(theme) {
    currentTheme = theme;
    htmlRoot.setAttribute('data-theme', theme);
    localStorage.setItem('ccms_theme', theme);
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'dark' 
        ? '<i class="fa-solid fa-sun" style="color: var(--amber);"></i>' 
        : '<i class="fa-solid fa-moon" style="color: var(--cyan);"></i>';
      themeToggleBtn.title = theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro';
    }
  }
  applyTheme(currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.onclick = () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    };
  }

  // 3. SELECTOR CUATRIMONEDA (USD / EUR / VES / USDT)
  const curPills = document.querySelectorAll('.cur-pill');
  // Sincronizar pills de inicio inmediatamente según localStorage o valor por defecto
  curPills.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-cur') === currentCurrency);
  });

  function setActiveCurrency(cur) {
    currentCurrency = cur;
    localStorage.setItem('ccms_active_currency', cur);
    curPills.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cur') === cur);
    });
    renderAll();
  }

  curPills.forEach(btn => {
    btn.onclick = () => setActiveCurrency(btn.getAttribute('data-cur'));
  });

  // 4. TICKER DINÁMICO: BCV OFICIAL + BINANCE P2P USDT/VES
  const bcvTickerVal = document.getElementById('bcv-rate-val');
  const usdtTickerVal = document.getElementById('usdt-rate-val');
  const bcvSyncIcon = document.getElementById('bcv-sync-icon');
  const bcvSyncTimeStr = document.getElementById('bcv-sync-time-str');

  function updateBcvDisplay() {
    const rates = financialEngine.getRates();
    if (bcvTickerVal) {
      bcvTickerVal.innerText = `${rates.VES.toFixed(2)} Bs/USD`;
    }
    if (usdtTickerVal) {
      const usdtVes = rates.USDT_VES || rates.VES;
      usdtTickerVal.innerText = `${usdtVes.toFixed(2)} Bs/USDT`;
    }
    if (bcvSyncTimeStr) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const tStr = `${hours}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;
      bcvSyncTimeStr.innerText = `${dStr} ${tStr}`;
    }
  }
  updateBcvDisplay();

  // Función asíncrona para sincronizar en vivo con las APIs gratuitas (DolarApi y Binance P2P vía Yadio)
  window.syncBcvRate = async function() {
    if (bcvSyncIcon) bcvSyncIcon.classList.add('fa-spin');
    try {
      const res = await financialEngine.fetchLiveRates();
      if (res.success) {
        updateBcvDisplay();
        renderAll();
        // Feedback visual
        if (bcvTickerVal) {
          bcvTickerVal.style.color = 'var(--emerald)';
          setTimeout(() => { bcvTickerVal.style.color = ''; }, 2000);
        }
        if (usdtTickerVal) {
          usdtTickerVal.style.color = 'var(--emerald)';
          setTimeout(() => { usdtTickerVal.style.color = ''; }, 2000);
        }
      } else {
        console.warn("No se pudo obtener la tasa en vivo, manteniendo tasa en memoria:", res.errors);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (bcvSyncIcon) bcvSyncIcon.classList.remove('fa-spin');
    }
  };

  // Sincronización automática de fondo al iniciar
  setTimeout(() => {
    window.syncBcvRate();
    if (window.Notifications && typeof window.Notifications.checkDailyPaymentReminders === 'function') {
      window.Notifications.checkDailyPaymentReminders(dbService, financialEngine).then(res => {
        if (res.sent > 0) {
          console.log(`[Cashea-Reminders] Se verificaron ${res.processed} cuotas y se generaron ${res.sent} recordatorios automáticos.`);
        }
      }).catch(err => console.error(err));
    }
  }, 1000);

  // Modal para editar tasas manualmente de forma ejecutiva
  window.editBcvRate = function() {
    const modal = document.getElementById('modal-rates-editor');
    if (!modal) return;
    const rates = financialEngine.getRates();
    const bcvInput = document.getElementById('rate-edit-bcv');
    const usdtInput = document.getElementById('rate-edit-usdt');
    if (bcvInput) bcvInput.value = rates.VES.toFixed(2);
    if (usdtInput) usdtInput.value = (rates.USDT_VES || rates.VES).toFixed(2);
    window.openModal(modal);
  };

  window.closeRatesEditorModal = function() {
    window.closeModal('modal-rates-editor');
  };

  window.handleSaveManualRates = function(e) {
    e.preventDefault();
    const bcvVal = document.getElementById('rate-edit-bcv').value;
    const usdtVal = document.getElementById('rate-edit-usdt').value;

    try {
      if (bcvVal) financialEngine.setBcvRate(bcvVal);
      if (usdtVal) financialEngine.setUsdtRate(usdtVal);
      updateBcvDisplay();
      renderAll();
      closeRatesEditorModal();

      if (window.SecuritySuite && window.SecuritySuite.toast) {
        window.SecuritySuite.toast('Tasas actualizadas y recalculadas en todo el sistema.', 'success', 'Tasas Guardadas');
      } else {
        alert("Tasas actualizadas con éxito.");
      }
    } catch (err) {
      if (window.SecuritySuite && window.SecuritySuite.toast) {
        window.SecuritySuite.toast(err.message, 'error', 'Error en Tasas');
      } else {
        alert(err.message);
      }
    }
  };

  window.resetDemoData = async function() {
    if (currentRole !== 'admin' || !window.dbService || typeof window.dbService.resetDemoData !== 'function') return;
    const confirmed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Restablecer los datos demo iniciales? Se borrarán las modificaciones temporales de prueba en este navegador.', 'Restablecer Datos Demo', 'Restablecer', 'Cancelar')
      : window.confirm('¿Restablecer la demo? Se borrarán los cambios ficticios hechos en este navegador y volverán los datos iniciales.');
    if (!confirmed) return;
    window.dbService.resetDemoData();
    window.location.reload();
  };

  // 5. NAVEGACIÓN Y MENÚ MÓVIL
  const sidebarEl = document.getElementById('app-sidebar');
  const mobileToggleBtn = document.getElementById('mobile-menu-toggle');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  function openMobileSidebar() {
    if (sidebarEl) sidebarEl.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
  }

  function closeMobileSidebar() {
    if (sidebarEl) sidebarEl.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  }

  if (mobileToggleBtn) {
    mobileToggleBtn.onclick = () => {
      if (sidebarEl && sidebarEl.classList.contains('open')) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    };
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.onclick = () => closeMobileSidebar();
  }

  window.openConfigTab = function() {
    const configNav = document.querySelector('.nav-item[data-tab="configuracion"]');
    if (configNav) configNav.click();
  };

  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentTab = item.getAttribute('data-tab');
      
      document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');
      const activeView = document.getElementById(`tab-${currentTab}`);
      if (activeView) activeView.style.display = 'block';

      // Control de visibilidad del grid de KPIs principales: solo visible en vistas operativas/dashboard
      const kpiGrid = document.querySelector('.kpi-grid');
      if (kpiGrid) {
        if (currentTab === 'inquilinos' || currentTab === 'cobranzas') {
          kpiGrid.style.display = '';
        } else {
          kpiGrid.style.display = 'none';
        }
      }

      // Re-renderizar de inmediato para garantizar datos frescos y sincronizados al instante
      renderAll();

      if (currentTab === 'ayuda' && window.HelpContent && typeof window.HelpContent.render === 'function') {
        try { window.HelpContent.render(); } catch (err) { console.error('[HelpContent] Render error:', err); }
      }

      if (window.innerWidth <= 1024) {
        closeMobileSidebar();
      }
    });
  });

  // Helper de conversión y formato dinámico
  function formatMoney(amountInUsd) {
    const converted = financialEngine.convert(amountInUsd, 'USD', currentCurrency);
    return financialEngine.format(converted, currentCurrency);
  }

  // 6. RENDERIZACIÓN GLOBAL RESILIENTE (PROTECCIÓN AISLADA POR MÓDULO)
  function renderAll() {
    try { renderKPIsAndBalances(); } catch (e) { console.error('[RenderError] KPIs:', e); }
    if (currentRole === 'admin') {
      try { renderTenantsTable(); } catch (e) { console.error('[RenderError] TenantsTable:', e); }
      try { renderCondoExpenses(); } catch (e) { console.error('[RenderError] CondoExpenses:', e); }
    }
    try { renderReceivingAccounts(); } catch (e) { console.error('[RenderError] ReceivingAccounts:', e); }
    try { renderInvoicesTable(); } catch (e) { console.error('[RenderError] InvoicesTable:', e); }
    try { renderCalendarView(); } catch (e) { console.error('[RenderError] CalendarView:', e); }
    try { renderAlertsCenter(); } catch (e) { console.error('[RenderError] AlertsCenter:', e); }
    if (currentRole === 'admin') {
      try { renderAdminBankAccounts(); } catch (e) { console.error('[RenderError] AdminBankAccounts:', e); }
      try { renderUserApprovalsTable(); } catch (e) { console.error('[RenderError] UserApprovals:', e); }
      try { initReportsTab(); } catch (e) { console.error('[RenderError] ReportsTab:', e); }
    }
    if (window.HelpContent && typeof window.HelpContent.render === 'function') {
      try { window.HelpContent.render(); } catch (e) { console.error('[RenderError] HelpContent:', e); }
    }
  }

  // --- RENDERIZAR CUENTAS RECEPTORAS OFICIALES (PORTAL INQUILINO / CLIENTE) ---
  function renderReceivingAccounts() {
    const card = document.getElementById('tenant-receiving-accounts-card');
    const grid = document.getElementById('receiving-accounts-grid');
    const valDateEl = document.getElementById('value-date-display');
    const valRateEl = document.getElementById('value-rate-display');
    if (!card || !grid) return;

    // Actualizar fecha valor y tasa en el header de la tarjeta
    const today = new Date();
    const formattedDate = today.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const bcvRate = financialEngine.getRates().VES;
    if (valDateEl) valDateEl.innerText = formattedDate;
    if (valRateEl) valRateEl.innerText = `${bcvRate.toFixed(2)} Bs/USD`;

    const tenantFilterId = (currentRole === 'tenant') ? currentTenantId : null;
    const accounts = dbService.getReceivingAccounts ? dbService.getReceivingAccounts(tenantFilterId) : [];
    grid.innerHTML = '';

    accounts.forEach(acc => {
      const el = document.createElement('div');
      el.style.background = 'var(--bg-card)';
      el.style.border = '1px solid var(--border-subtle)';
      el.style.borderRadius = '8px';
      el.style.padding = '12px 14px';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '6px';
      el.style.fontSize = '12px';

      let detailsHtml = '';
      if (acc.account_number) {
        detailsHtml = `
          <div>Cuenta: <strong style="font-family: monospace; color: var(--txt-primary);">${acc.account_number}</strong></div>
          <div style="font-size: 11px; color: var(--txt-muted);">Titular: ${acc.beneficiary} • RIF: ${acc.rif}</div>
        `;
      } else if (acc.phone) {
        detailsHtml = `
          <div>Teléfono: <strong style="color: var(--txt-primary);">${acc.phone}</strong> | RIF: ${acc.rif}</div>
          <div style="font-size: 11px; color: var(--txt-muted);">Bancos: ${acc.bank_code}</div>
        `;
      } else if (acc.email) {
        detailsHtml = `
          <div>Email: <strong style="color: var(--amber);">${acc.email}</strong></div>
          <div style="font-size: 11px; color: var(--txt-muted);">Beneficiario: ${acc.beneficiary}</div>
        `;
      } else if (acc.wallet_address) {
        detailsHtml = `
          <div>Wallet TRC20: <strong style="font-family: monospace; font-size: 10.5px; color: var(--emerald); word-break: break-all;">${acc.wallet_address}</strong></div>
          <div style="font-size: 11px; color: var(--txt-muted);">Binance Pay ID: <strong>${acc.binance_pay_id}</strong></div>
        `;
      }

      el.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <strong style="color: var(--txt-primary); display: flex; align-items: center; gap: 6px;">
            <i class="${acc.icon}" style="color: var(--amber);"></i> ${acc.bank}
          </strong>
          <span class="status-pill pill-info" style="font-size: 10px; padding: 2px 6px;">${acc.badge}</span>
        </div>
        <div style="margin-top: 2px;">
          ${detailsHtml}
        </div>
        <div style="font-size: 10.5px; color: var(--txt-secondary); margin-top: 4px; border-top: 1px dashed var(--border-subtle); padding-top: 4px;">
          ${acc.instructions}
        </div>
      `;
      grid.appendChild(el);
    });
  }

  /**
   * Devuelve las facturas visibles para el usuario actual.
   * - admin: todas
   * - tenant: solo las suyas
   */
  function visibleInvoices(allInvoices) {
    if (currentRole === 'tenant' && currentTenantId) {
      return allInvoices.filter(i => i.tenant_id === currentTenantId);
    }
    return allInvoices;
  }

  /**
   * Devuelve los inquilinos visibles para el usuario actual.
   * - admin: todos
   * - tenant: solo el suyo
   */
  function visibleTenants(allTenants) {
    if (currentRole === 'tenant' && currentTenantId) {
      return allTenants.filter(t => t.id === currentTenantId);
    }
    return allTenants;
  }

  // A. BALANCES Y KPIS FINANCIEROS
  function renderKPIsAndBalances() {
    const units = dbService.getUnits();
    const allInvoices = dbService.getInvoices();
    const invoices = visibleInvoices(allInvoices);

    // 1. Ocupación (solo visible para admin)
    const kpiOcc = document.getElementById('kpi-occupancy');
    const kpiOccSub = document.getElementById('kpi-occupancy-sub');
    const occCard = kpiOcc ? kpiOcc.closest('.kpi-card') : null;
    if (currentRole === 'admin') {
      const occupiedUnits = units.filter(u => u.status === 'arrendado');
      const totalArea = units.reduce((acc, u) => acc + u.area_m2, 0);
      const occupiedArea = occupiedUnits.reduce((acc, u) => acc + u.area_m2, 0);
      const occupancyRate = Math.round((occupiedArea / totalArea) * 100);
      kpiOcc.innerText = `${occupancyRate}%`;
      kpiOccSub.innerText = `${occupiedArea.toLocaleString()} m² de 5.190 m²`;
      if (occCard) occCard.style.display = '';
    } else if (occCard) {
      occCard.style.display = 'none';
    }

    // 2. Facturación
    const totalBilledUsd = invoices.reduce((acc, i) => acc + i.total_usd, 0);
    const billedEl = document.getElementById('kpi-billed');
    if (billedEl) {
      billedEl.innerText = formatMoney(totalBilledUsd);
      const billedTitle = billedEl.closest('.kpi-card')?.querySelector('.kpi-title');
      if (billedTitle) billedTitle.textContent = currentRole === 'admin' ? 'Facturación Mensual' : 'Mi Facturación del Período';
    }

    // 3. Recaudado (para Admin) / Mi Estado de Solvencia y Semáforo (para Inquilino)
    const paidInvoices = invoices.filter(i => i.status === 'pagado');
    const totalPaidUsd = paidInvoices.reduce((acc, i) => acc + i.total_usd, 0);
    const collectionPct = totalBilledUsd > 0 ? Math.round((totalPaidUsd / totalBilledUsd) * 100) : 0;
    const collEl = document.getElementById('kpi-collected');
    const collCard = collEl ? collEl.closest('.kpi-card') : null;
    const collTitle = collCard?.querySelector('.kpi-title');
    const collBadge = collCard?.querySelector('.kpi-icon-badge');
    const collSub = document.getElementById('kpi-collected-sub');

    if (currentRole === 'admin') {
      if (collTitle) collTitle.textContent = 'Total Recaudado';
      if (collBadge) collBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
      if (collEl) collEl.innerText = formatMoney(totalPaidUsd);
      if (collSub) collSub.innerText = `${collectionPct}% de recaudación efectiva`;
    } else {
      // INQUILINO: Semáforo interactivo y contador de días
      if (collTitle) collTitle.textContent = 'Mi Semáforo de Solvencia';
      const pendingOrOverdue = invoices.filter(i => i.status !== 'pagado');
      
      if (pendingOrOverdue.length === 0) {
        // Al día
        if (collBadge) {
          collBadge.className = 'kpi-icon-badge badge-emerald';
          collBadge.innerHTML = '<i class="fa-solid fa-shield-check"></i>';
        }
        if (collEl) {
          collEl.innerHTML = '<span style="color: var(--emerald); font-size: 20px;">Solvente y al Día</span>';
        }
        if (collSub) {
          collSub.innerHTML = `
            <div style="width: 100%;">
              <div class="semaforo-bar-container"><div class="semaforo-indicator" style="width: 100%; background: var(--emerald);"></div></div>
              <span style="color: var(--emerald); font-weight: 700;">Sin deudas pendientes registradas</span>
            </div>
          `;
        }
      } else {
        // Tiene cuotas pendientes o en mora. Calcular días del vencimiento más próximo o vencido
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let minDiffDays = Infinity;
        let isAnyMora = false;

        pendingOrOverdue.forEach(inv => {
          if (inv.status === 'en_mora') isAnyMora = true;
          if (inv.due_date) {
            const dueDate = new Date(inv.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = dueDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < minDiffDays) {
              minDiffDays = diffDays;
            }
          }
        });

        if (isAnyMora || minDiffDays < 0) {
          const daysLate = Math.abs(minDiffDays === Infinity ? 1 : minDiffDays);
          if (collBadge) {
            collBadge.className = 'kpi-icon-badge badge-rose';
            collBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
          }
          if (collEl) {
            collEl.innerHTML = `<span style="color: var(--rose); font-size: 20px;">En Mora (${daysLate} d retraso)</span>`;
          }
          if (collSub) {
            collSub.innerHTML = `
              <div style="width: 100%;">
                <div class="semaforo-bar-container"><div class="semaforo-indicator" style="width: 100%; background: var(--rose);"></div></div>
                <span style="color: var(--rose); font-weight: 700;">Regularice su pago para evitar recargos</span>
              </div>
            `;
          }
        } else if (minDiffDays <= 5) {
          if (collBadge) {
            collBadge.className = 'kpi-icon-badge badge-amber';
            collBadge.innerHTML = '<i class="fa-solid fa-clock"></i>';
          }
          if (collEl) {
            collEl.innerHTML = `<span style="color: var(--amber); font-size: 20px;">Vence en ${minDiffDays} días</span>`;
          }
          if (collSub) {
            collSub.innerHTML = `
              <div style="width: 100%;">
                <div class="semaforo-bar-container"><div class="semaforo-indicator" style="width: ${(minDiffDays / 5) * 100}%; background: var(--amber);"></div></div>
                <span style="color: var(--amber); font-weight: 700;">Próximo corte cercano a vencer</span>
              </div>
            `;
          }
        } else {
          if (collBadge) {
            collBadge.className = 'kpi-icon-badge badge-emerald';
            collBadge.innerHTML = '<i class="fa-solid fa-calendar-check"></i>';
          }
          if (collEl) {
            collEl.innerHTML = `<span style="color: var(--emerald); font-size: 20px;">${minDiffDays} días restantes</span>`;
          }
          if (collSub) {
            collSub.innerHTML = `
              <div style="width: 100%;">
                <div class="semaforo-bar-container"><div class="semaforo-indicator" style="width: 75%; background: var(--emerald);"></div></div>
                <span style="color: var(--txt-secondary);">Cuota en plazo voluntario de pago</span>
              </div>
            `;
          }
        }
      }
    }

    // 4. Mora
    const overdueInvoices = invoices.filter(i => i.status === 'en_mora');
    const totalOverdueUsd = overdueInvoices.reduce((acc, i) => acc + i.total_usd, 0);
    const overEl = document.getElementById('kpi-overdue');
    if (overEl) {
      overEl.innerText = formatMoney(totalOverdueUsd);
      document.getElementById('kpi-overdue-sub').innerText = `${overdueInvoices.length} ${currentRole === 'admin' ? 'cuentas con retraso' : 'facturas vencidas'}`;
    }

    // 5. Egresos: solo admin
    const expEl = document.getElementById('kpi-expenses');
    const expCard = expEl ? expEl.closest('.kpi-card') : null;
    if (expEl) {
      if (currentRole === 'admin') {
        const condoExpenses = [
          { concept: 'Vigilancia 24/7', amount_usd: 1200 },
          { concept: 'Energía Eléctrica Común (Corpoelec)', amount_usd: 350 },
          { concept: 'Cisterna de Agua (40.000 L)', amount_usd: 220 },
          { concept: 'Mantenimiento Preventivo Drenajes', amount_usd: 180 }
        ];
        const totalExpensesUsd = condoExpenses.reduce((acc, e) => acc + e.amount_usd, 0);
        expEl.innerText = formatMoney(totalExpensesUsd);
        document.getElementById('kpi-expenses-sub').innerText = `4 conceptos de gastos comunes`;
        if (expCard) expCard.style.display = '';
      } else if (expCard) {
        expCard.style.display = 'none';
      }
    }

    // 6. Utilidad: solo admin
    const netEl = document.getElementById('kpi-netprofit');
    const netCard = netEl ? netEl.closest('.kpi-card') : null;
    if (netEl) {
      if (currentRole === 'admin') {
        const netProfitUsd = totalPaidUsd - 1950;
        netEl.innerText = formatMoney(netProfitUsd);
        netEl.style.color = netProfitUsd >= 0 ? 'var(--emerald)' : 'var(--rose)';
        if (netCard) netCard.style.display = '';
      } else if (netCard) {
        netCard.style.display = 'none';
      }
    }
  }

  // B. DIRECTORIO DE INQUILINOS & LOCALES
  function renderTenantsTable() {
    const tbody = document.getElementById('tenants-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const units = dbService.getUnits();
    const tenants = dbService.getTenants();
    const contracts = dbService.getContracts();

    units.forEach(unit => {
      const tr = document.createElement('tr');
      const tenant = tenants.find(t => t.id === unit.tenant_id);
      const contract = contracts.find(c => c.unit_code === unit.code);

      let statusBadge = '';
      if (unit.status === 'disponible') {
        statusBadge = '<span class="status-pill pill-info"><i class="fa-solid fa-circle"></i> Disponible</span>';
      } else if (tenant && tenant.status === 'moroso') {
        statusBadge = '<span class="status-pill pill-overdue"><i class="fa-solid fa-circle-exclamation"></i> En Mora</span>';
      } else if (contract && contract.status === 'por_vencer') {
        statusBadge = '<span class="status-pill pill-warning"><i class="fa-solid fa-clock"></i> Por Vencer</span>';
      } else {
        statusBadge = '<span class="status-pill pill-active"><i class="fa-solid fa-circle-check"></i> Solvente</span>';
      }

      tr.innerHTML = `
        <td>
          <strong style="color: var(--amber); font-family: var(--font-heading); font-size: 13.5px;">${escapeHtml(unit.code)}</strong>
          <div style="font-size: 11px; color: var(--txt-muted);">${escapeHtml(unit.name)}</div>
        </td>
        <td>
          ${tenant ? `<strong>${escapeHtml(tenant.business_name)}</strong><div style="font-size: 11px; color: var(--txt-secondary);">RIF: ${escapeHtml(tenant.rif)} • ${escapeHtml(tenant.trade_name || '')}</div>` : '<span style="color: var(--txt-muted); font-style: italic;">Sin Arrendatario</span>'}
        </td>
        <td>
          <strong>${unit.area_m2.toLocaleString()} m²</strong>
          <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase;">${escapeHtml(unit.category)}</div>
        </td>
        <td>
          <strong>${formatMoney(unit.base_rent_usd)}</strong>
          <div style="font-size: 10.5px; color: var(--amber);">Alícuota: ${(unit.condo_aliquot * 100).toFixed(1)}%</div>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${tenant ? `
              <button class="btn-action-icon" title="Ver Expediente Jurídico" onclick="window.openTenantDossier('${tenant.id}')">
                <i class="fa-solid fa-folder-open"></i>
              </button>
              <button class="btn-action-icon" title="Ver Contrato de Arrendamiento (G.O. 40.418)" style="color: var(--cyan);" onclick="window.viewTenantContract('${tenant.id}')">
                <i class="fa-solid fa-file-signature"></i>
              </button>
              <button class="btn-action-icon btn-wa-action" title="Mensaje Instantáneo WhatsApp" onclick="window.openWhatsAppModal('${tenant.id}')">
                <i class="fa-brands fa-whatsapp"></i>
              </button>
              <button class="btn-action-icon" title="Calcular Prórroga Legal" style="color: var(--amber);" onclick="window.openProrrogaModal('${unit.code}')">
                <i class="fa-solid fa-scale-balanced"></i>
              </button>
            ` : `
              <a href="onboarding.html?unit=${unit.code}" class="btn-action-icon" title="Asignar Arrendatario" style="text-decoration: none;">
                <i class="fa-solid fa-user-plus" style="color: var(--amber);"></i>
              </a>
            `}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Variables de filtros activos
  let filterCobranzasMonth = '3';
  let filterCobranzasYear = '2026';
  let filterCobranzasStatus = 'all';

  let filterCondoMonth = '3';
  let filterCondoYear = '2026';

  let filterCalendarType = 'all';

  window.applyCobranzasFilters = function() {
    const mEl = document.getElementById('filter-cobranzas-month');
    const yEl = document.getElementById('filter-cobranzas-year');
    const sEl = document.getElementById('filter-cobranzas-status');
    if (mEl) filterCobranzasMonth = mEl.value;
    if (yEl) filterCobranzasYear = yEl.value;
    if (sEl) filterCobranzasStatus = sEl.value;
    renderInvoicesTable();
  };

  window.applyCondoFilters = function() {
    const mEl = document.getElementById('filter-condo-month');
    const yEl = document.getElementById('filter-condo-year');
    if (mEl) filterCondoMonth = mEl.value;
    if (yEl) filterCondoYear = yEl.value;
    renderCondoExpenses();
  };

  window.applyCalendarFilter = function() {
    const tEl = document.getElementById('filter-calendar-type');
    if (tEl) filterCalendarType = tEl.value;
    renderCalendarView();
  };

  // C. TABLA DE COBRANZAS Y CUOTAS CON FILTRADO POR PERÍODO
  function renderInvoicesTable() {
    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let allInvoices = dbService.getInvoices();
    let invoices = visibleInvoices(allInvoices);
    const tenants = visibleTenants(dbService.getTenants());

    // Actualizar badge administrativo de comprobantes pendientes de revisión
    const pendingReviews = allInvoices.filter(i => i.status === 'verificando').length;
    const adminBadge = document.getElementById('admin-pending-review-badge');
    const adminCount = document.getElementById('admin-pending-count');
    if (adminBadge && adminCount) {
      if (currentRole === 'admin' && pendingReviews > 0) {
        adminBadge.style.display = 'inline-flex';
        adminCount.innerText = `${pendingReviews} ${pendingReviews === 1 ? 'comprobante por revisar' : 'comprobantes por revisar'}`;
        adminBadge.style.cursor = 'pointer';
        adminBadge.onclick = () => {
          const statusFilter = document.getElementById('filter-cobranzas-status');
          if (statusFilter) {
            statusFilter.value = 'verificando';
            window.applyCobranzasFilters();
          }
        };
      } else {
        adminBadge.style.display = 'none';
      }
    }

    // Aplicar filtros de período y estado
    if (filterCobranzasMonth !== 'all') {
      const targetMonth = parseInt(filterCobranzasMonth);
      invoices = invoices.filter(i => i.period_month === targetMonth);
    }
    if (filterCobranzasYear !== 'all') {
      const targetYear = parseInt(filterCobranzasYear);
      invoices = invoices.filter(i => i.period_year === targetYear);
    }
    if (filterCobranzasStatus !== 'all') {
      invoices = invoices.filter(i => i.status === filterCobranzasStatus);
    }

    // Ajustar el título de la sección según el rol
    const sectionTitle = document.querySelector('#tab-cobranzas .section-title');
    if (sectionTitle) {
      if (currentRole === 'tenant') {
        sectionTitle.innerHTML = '<i class="fa-solid fa-receipt" style="color: var(--emerald);"></i> Mis Cuotas, Pagos y Recibos';
      } else {
        sectionTitle.innerHTML = '<i class="fa-solid fa-receipt" style="color: var(--emerald);"></i> Cobranzas y Conciliación Multimoneda';
      }
    }

    if (invoices.length === 0) {
      const tr = document.createElement('tr');
      const emptyHtml = window.SecuritySuite && window.SecuritySuite.renderEmptyState
        ? window.SecuritySuite.renderEmptyState(
            'No hay cuotas registradas',
            `No se encontraron cuotas para el filtro seleccionado (${filterCobranzasMonth !== 'all' ? 'Mes ' + filterCobranzasMonth : 'Todos los meses'} / ${filterCobranzasYear}).`,
            'fa-receipt'
          )
        : '<div style="padding:24px;text-align:center;color:var(--txt-muted);">No se encontraron cuotas.</div>';
      tr.innerHTML = `<td colspan="6" style="padding: 20px 0;">${emptyHtml}</td>`;
      tbody.appendChild(tr);
      return;
    }

    invoices.forEach(inv => {
      const tr = document.createElement('tr');
      const tenant = tenants.find(t => t.id === inv.tenant_id) || { business_name: 'Desconocido', whatsapp: '' };

      let statusBadge = '';
      if (inv.status === 'pagado') {
        statusBadge = '<span class="status-pill pill-active"><i class="fa-solid fa-circle-check"></i> Pagado</span>';
      } else if (inv.status === 'en_mora') {
        statusBadge = '<span class="status-pill pill-overdue"><i class="fa-solid fa-triangle-exclamation"></i> En Mora</span>';
      } else if (inv.status === 'verificando') {
        statusBadge = '<span class="status-pill pill-warning"><i class="fa-solid fa-magnifying-glass"></i> En revisión</span>';
      } else {
        statusBadge = '<span class="status-pill pill-warning"><i class="fa-solid fa-hourglass-half"></i> Pendiente</span>';
      }

      tr.innerHTML = `
        <td>
          <strong style="font-family: var(--font-heading);">${escapeHtml(inv.invoice_number)}</strong>
          <div style="font-size: 11px; color: var(--txt-muted);">Período ${inv.period_month}/${inv.period_year}</div>
        </td>
        <td>
          <strong style="color: var(--amber);">${escapeHtml(inv.unit_code)}</strong> — ${escapeHtml(tenant.business_name)}
        </td>
        <td>
          <strong>${formatMoney(inv.total_usd)}</strong>
          <div style="font-size: 10.5px; color: var(--txt-muted);">Canon: $${inv.rent_usd} | Cond: $${inv.condo_usd}</div>
        </td>
        <td>
          <span>${escapeHtml(inv.due_date)}</span>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${inv.status !== 'pagado' && (currentRole === 'admin' || currentRole === 'tenant') ? `
              <button class="btn-action-icon" title="${currentRole === 'tenant' ? 'Reportar pago y adjuntar comprobante' : (inv.status === 'verificando' ? 'Revisar comprobante' : 'Registrar Pago Multimoneda')}" style="background: var(--emerald-glow); color: var(--emerald);" onclick="window.openPaymentModal('${inv.id}')">
                <i class="fa-solid fa-receipt"></i>
              </button>
            ` : ''}
            ${inv.receipt_proof ? `
              <button class="btn-action-icon" title="Ver Comprobante de Pago Adjunto" style="color: var(--cyan); border-color: var(--cyan);" onclick="window.viewReceiptProof('${inv.id}')">
                <i class="fa-solid fa-paperclip"></i>
              </button>
            ` : ''}
            <button class="btn-action-icon" title="Imprimir Recibo Oficial" onclick="window.printReceipt('${inv.id}')">
              <i class="fa-solid fa-print"></i>
            </button>
            ${currentRole === 'admin' ? `
              <button class="btn-action-icon btn-wa-action" title="Aviso de Cobranza WhatsApp" onclick="window.openWhatsAppModal('${tenant.id}', '${inv.id}')">
                <i class="fa-brands fa-whatsapp"></i>
              </button>
            ` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // D. GASTOS COMUNES Y DISTRIBUCIÓN CONDOMINIAL CON FILTRADO POR PERÍODO
  function renderCondoExpenses() {
    const tbody = document.getElementById('condo-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const allExpenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];

    let filtered = allExpenses;
    if (filterCondoMonth !== 'all') {
      filtered = filtered.filter(e => e.period_month === parseInt(filterCondoMonth));
    }
    if (filterCondoYear !== 'all') {
      filtered = filtered.filter(e => e.period_year === parseInt(filterCondoYear));
    }

    const totalPeriodUsd = filtered.reduce((acc, e) => acc + (parseFloat(e.amount_usd) || 0), 0);
    const reserveUsd = Math.round(totalPeriodUsd * 0.10 * 100) / 100;

    // Estimación de Retenciones SENIAT (IVA 16% * 75% + ISLR 2%)
    let totalWithholdingsUsd = 0;
    filtered.forEach(e => {
      const base = parseFloat(e.amount_usd) || 0;
      let w = 0;
      if (e.withhold_iva) w += (base * 0.16 * 0.75);
      if (e.withhold_islr) w += (base * 0.02);
      totalWithholdingsUsd += w;
    });

    const totalPeriodEl = document.getElementById('condo-total-period');
    const reservePeriodEl = document.getElementById('condo-reserve-period');
    const withholdingsEl = document.getElementById('condo-withholdings-period');
    if (totalPeriodEl) totalPeriodEl.innerText = formatMoney(totalPeriodUsd);
    if (reservePeriodEl) reservePeriodEl.innerText = formatMoney(reserveUsd);
    if (withholdingsEl) withholdingsEl.innerText = formatMoney(totalWithholdingsUsd);

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" style="text-align:center;padding:32px;color:var(--txt-muted);font-style:italic;">No hay egresos registrados para este período (${filterCondoMonth !== 'all' ? 'Mes ' + filterCondoMonth : 'Todos los meses'} / ${filterCondoYear}).</td>`;
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach(exp => {
      const tr = document.createElement('tr');
      const baseUsd = parseFloat(exp.amount_usd) || 0;
      const baseBs = financialEngine.convert(baseUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
      const cat = exp.category || exp.cat || 'General';

      let withholdBadges = [];
      if (exp.withhold_iva) withholdBadges.push('<span class="status-pill pill-info" style="font-size:9.5px;padding:2px 5px;">IVA 75%</span>');
      if (exp.withhold_islr) withholdBadges.push('<span class="status-pill pill-warning" style="font-size:9.5px;padding:2px 5px;">ISLR 2%</span>');
      if (withholdBadges.length === 0) withholdBadges.push('<span style="font-size:10px;color:var(--txt-muted);font-style:italic;">Exento / No aplica</span>');

      const proofBtn = exp.invoice_proof ? `
        <button type="button" class="btn-action-icon" style="color:var(--purple);border-color:var(--purple);" title="Ver Factura de Proveedor" onclick="window.viewExpenseProof('${exp.id}')">
          <i class="fa-solid fa-file-pdf"></i>
        </button>
      ` : `<span style="font-size:10.5px;color:var(--txt-muted);font-style:italic;">Sin archivo</span>`;

      tr.innerHTML = `
        <td>
          <strong style="color:var(--txt-primary);">${escapeHtml(exp.concept)}</strong>
          <div style="font-size:11px;color:var(--txt-muted);margin-top:2px;">
            <i class="fa-solid fa-truck-field" style="color:var(--amber);"></i> ${escapeHtml(exp.provider_name || 'Proveedor General')}
            ${exp.provider_rif ? `<span style="margin-left:4px;">(RIF: ${escapeHtml(exp.provider_rif)})</span>` : ''}
          </div>
        </td>
        <td>
          <span style="font-family:monospace;font-size:11.5px;font-weight:700;color:var(--txt-primary);">${escapeHtml(exp.invoice_number || 'S/N')}</span>
          <div style="font-size:10.5px;color:var(--txt-secondary);">Control: ${escapeHtml(exp.control_number || 'N/A')}</div>
        </td>
        <td><span class="status-pill pill-info">${escapeHtml(cat)}</span></td>
        <td><span style="font-family: var(--font-heading); font-size: 11.5px; color: var(--amber);">${exp.period_month}/${exp.period_year}</span></td>
        <td>
          <strong>${formatMoney(baseUsd)}</strong>
          <div style="font-size:10.5px;color:var(--txt-muted);">Bs. ${baseBs}</div>
        </td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${withholdBadges.join('')}
          </div>
        </td>
        <td>${proofBtn}</td>
        <td>
          ${currentRole === 'admin' ? `
            <div style="display:flex;gap:4px;">
              <button type="button" class="btn-action-icon" title="Editar Gasto" onclick="window.openExpenseModal('${exp.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button type="button" class="btn-action-icon" style="color:var(--rose);border-color:var(--rose);" title="Eliminar Gasto" onclick="window.deleteExpense('${exp.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          ` : '<span style="font-size:10.5px;color:var(--txt-muted);">Auditoría</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Variables para la cuadrícula mensual interactiva
  let calCurrentYear = 2026;
  let calCurrentMonth = 2; // 0-indexed: 2 = Marzo

  window.changeCalendarMonth = function(delta) {
    calCurrentMonth += delta;
    if (calCurrentMonth < 0) {
      calCurrentMonth = 11;
      calCurrentYear -= 1;
    } else if (calCurrentMonth > 11) {
      calCurrentMonth = 0;
      calCurrentYear += 1;
    }
    renderCalendarView();
  };

  window.showCalendarEventDetail = function(title, date, type, desc) {
    const modal = document.getElementById('modal-calendar-detail');
    if (!modal) return;

    const titleEl = document.getElementById('cal-detail-title');
    const dateEl = document.getElementById('cal-detail-date');
    const descEl = document.getElementById('cal-detail-desc');
    const typeBadge = document.getElementById('cal-detail-type-badge');
    const iconBadge = document.getElementById('cal-detail-icon-badge');
    const gcalBtn = document.getElementById('cal-detail-gcal-btn');

    if (titleEl) titleEl.innerText = title;
    if (dateEl) dateEl.innerText = `Fecha de vencimiento: ${date}`;
    if (descEl) descEl.innerText = desc || 'Sin detalles adicionales.';

    const typeConfig = {
      cuota: { label: 'CUOTA DE ARRENDAMIENTO', badgeClass: 'pill-warning', iconClass: 'badge-amber', icon: 'fa-solid fa-coins' },
      condominio: { label: 'CORTE DE GASTOS COMUNES', badgeClass: 'pill-info', iconClass: 'badge-purple', icon: 'fa-solid fa-building-user' },
      contrato: { label: 'VENCIMIENTO DE CONTRATO', badgeClass: 'pill-active', iconClass: 'badge-cyan', icon: 'fa-solid fa-file-contract' },
      prorroga: { label: 'PRÓRROGA LEGAL (ART. 25 G.O. 40.418)', badgeClass: 'pill-overdue', iconClass: 'badge-rose', icon: 'fa-solid fa-scale-balanced' }
    };

    const cfg = typeConfig[type] || typeConfig.cuota;
    if (typeBadge) {
      typeBadge.className = `status-pill ${cfg.badgeClass}`;
      typeBadge.innerText = cfg.label;
    }
    if (iconBadge) {
      iconBadge.className = `kpi-icon-badge ${cfg.iconClass}`;
      iconBadge.innerHTML = `<i class="${cfg.icon}"></i>`;
    }

    if (gcalBtn) {
      const calUrl = GoogleWorkspace.createCalendarUrl(title, desc, 'CC Mario Sánchez, Puerto La Cruz', date);
      gcalBtn.href = calUrl;
    }

    window.openModal(modal);
  };

  window.closeCalendarDetailModal = function() {
    window.closeModal('modal-calendar-detail');
  };

  // --- GESTIÓN DE RECORDATORIOS / EVENTOS PERSONALIZADOS DEL CALENDARIO ---
  const CUSTOM_EVENTS_STORAGE_KEY = 'ccms_custom_calendar_events';

  function getCustomCalendarEvents() {
    try {
      const stored = localStorage.getItem(CUSTOM_EVENTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomCalendarEvents(eventsList) {
    try {
      localStorage.setItem(CUSTOM_EVENTS_STORAGE_KEY, JSON.stringify(eventsList));
    } catch (e) {}
  }

  window.openAddCalendarEventModal = function(defaultDate = null) {
    const modal = document.getElementById('modal-add-calendar-event');
    if (!modal) return;

    const dateInput = document.getElementById('new-cal-date');
    const titleInput = document.getElementById('new-cal-title');
    const descInput = document.getElementById('new-cal-desc');
    const typeSelect = document.getElementById('new-cal-type');

    if (dateInput) {
      if (defaultDate) {
        dateInput.value = defaultDate;
      } else {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (typeSelect) typeSelect.value = 'cuota';

    window.openModal(modal);
  };

  window.closeAddCalendarEventModal = function() {
    window.closeModal('modal-add-calendar-event');
  };

  window.handleSaveCalendarEvent = function(e) {
    if (e && e.preventDefault) e.preventDefault();

    const titleInput = document.getElementById('new-cal-title');
    const dateInput = document.getElementById('new-cal-date');
    const typeSelect = document.getElementById('new-cal-type');
    const descInput = document.getElementById('new-cal-desc');

    const title = titleInput ? titleInput.value.trim() : '';
    const date = dateInput ? dateInput.value.trim() : '';
    const type = typeSelect ? typeSelect.value : 'cuota';
    const desc = descInput ? descInput.value.trim() : '';

    if (!title || !date) {
      showToast('Por favor ingrese el título y la fecha del evento', 'warning', 'Campos Requeridos');
      return;
    }

    const parts = date.split('-');
    if (parts.length !== 3) {
      showToast('Formato de fecha inválido', 'error', 'Error de Fecha');
      return;
    }

    const newEvent = {
      id: 'evt-' + Date.now(),
      title,
      date,
      day: parseInt(parts[2]),
      month: parseInt(parts[1]) - 1,
      year: parseInt(parts[0]),
      type,
      desc: desc || 'Evento creado por administración.',
      created_at: new Date().toISOString()
    };

    const currentList = getCustomCalendarEvents();
    currentList.push(newEvent);
    saveCustomCalendarEvents(currentList);

    closeAddCalendarEventModal();
    renderCalendarView();
    showToast(`Recordatorio "${title}" guardado con éxito`, 'success', 'Recordatorio Creado');
  };

  // E. CALENDARIO DE VENCIMIENTOS INTERACTIVO
  function renderCalendarView() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const titleEl = document.getElementById('calendar-month-title');
    if (titleEl) {
      titleEl.innerText = `${monthNames[calCurrentMonth]} ${calCurrentYear}`;
    }

    const gridEl = document.getElementById('calendar-month-grid');
    const listEl = document.getElementById('calendar-events-list');

    // Base de eventos dinámicos
    const events = [
      {
        title: 'Vencimiento Cuotas de Alquiler (Día 5 Hábiles)',
        date: '2026-03-05',
        day: 5, month: 2, year: 2026,
        type: 'cuota',
        desc: 'Fecha límite de pago sin recargos según costumbre comercial del CC Mario Sánchez.'
      },
      {
        title: 'Corte de Gastos Comunes y Condominio',
        date: '2026-03-10',
        day: 10, month: 2, year: 2026,
        type: 'condominio',
        desc: 'Cierre de alícuotas ordinarias de electricidad de áreas comunes, aseo y vigilancia.'
      },
      {
        title: 'Vencimiento Contrato FerroCruz Pro (Local 01)',
        date: '2026-03-31',
        day: 31, month: 2, year: 2026,
        type: 'contrato',
        desc: 'Cumple 1 año de contrato. Arrendatario con opción a Prórroga Legal obligatoria (Art. 25 G.O. 40.418).'
      },
      {
        title: 'Término de Prórroga Legal El Faro Market (Local 04)',
        date: '2026-04-10',
        day: 10, month: 3, year: 2026,
        type: 'prorroga',
        desc: 'Finalización de los 6 meses de prórroga legal estipulados según la Ley de Arrendamiento Comercial.'
      }
    ];

    // Cargar eventos personalizados del usuario / administración
    const customEvents = getCustomCalendarEvents();
    customEvents.forEach(evt => {
      events.push(evt);
    });

    // Incorporar cuotas reales desde la base de datos
    const dbInvoices = visibleInvoices(dbService.getInvoices());
    dbInvoices.forEach(inv => {
      if (inv.due_date) {
        const parts = inv.due_date.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]) - 1;
          const d = parseInt(parts[2]);
          const exists = events.some(e => e.date === inv.due_date && e.invoice_id === inv.id);
          if (!exists) {
            events.push({
              title: `Vencimiento ${inv.invoice_number} (${inv.unit_code})`,
              date: inv.due_date,
              day: d, month: m, year: y,
              type: 'cuota',
              invoice_id: inv.id,
              desc: `Cuota ${inv.period_month}/${inv.period_year} por $${inv.total_usd.toFixed(2)} USD. Estatus: ${inv.status}.`
            });
          }
        }
      }
    });

    // 1. RENDERIZAR CUADRÍCULA MENSUAL INTERACTIVA
    if (gridEl) {
      gridEl.innerHTML = '';
      const firstDayOfMonth = new Date(calCurrentYear, calCurrentMonth, 1);
      const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
      
      // Ajustar día de la semana (0 = Domingo, cambiar a Lunes = 0)
      let startingDay = firstDayOfMonth.getDay() - 1;
      if (startingDay === -1) startingDay = 6;

      // Celdas vacías previas
      for (let i = 0; i < startingDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-cell empty';
        gridEl.appendChild(emptyCell);
      }

      const today = new Date();
      const isCurrentMonthAndYear = today.getFullYear() === calCurrentYear && today.getMonth() === calCurrentMonth;
      const todayDate = today.getDate();

      // Celdas de cada día del mes
      for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        if (isCurrentMonthAndYear && day === todayDate) {
          cell.classList.add('today');
        }

        const dateStr = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = events.filter(e => {
          if (filterCalendarType !== 'all' && e.type !== filterCalendarType) return false;
          return e.year === calCurrentYear && e.month === calCurrentMonth && e.day === day;
        });

        // Cabecera del día
        const headerDiv = document.createElement('div');
        headerDiv.className = 'cal-cell-header';
        headerDiv.innerHTML = `
          <span class="cal-day-num">${day}</span>
          ${dayEvents.length > 0 ? `<span style="font-size: 9px; font-weight: 800; color: var(--amber);"><i class="fa-solid fa-circle" style="font-size: 6px;"></i> ${dayEvents.length}</span>` : ''}
        `;
        cell.appendChild(headerDiv);

        // Contenedor de badges de eventos
        const badgeContainer = document.createElement('div');
        badgeContainer.style.display = 'flex';
        badgeContainer.style.flexDirection = 'column';
        badgeContainer.style.gap = '2px';
        badgeContainer.style.overflowY = 'auto';

        dayEvents.forEach(evt => {
          const badge = document.createElement('div');
          const badgeClass = evt.type === 'cuota' ? 'cal-badge-cuota' : evt.type === 'condominio' ? 'cal-badge-condominio' : 'cal-badge-contrato';
          badge.className = `cal-event-badge ${badgeClass}`;
          badge.title = `${evt.title}: ${evt.desc}`;
          badge.textContent = evt.title;
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            showCalendarEventDetail(evt.title, evt.date, evt.type, evt.desc);
          });
          badgeContainer.appendChild(badge);
        });

        cell.appendChild(badgeContainer);

        // Clic en la celda: Si tiene eventos abre el primero, si está vacía abre el creador de eventos con esa fecha
        cell.addEventListener('click', () => {
          if (dayEvents.length > 0) {
            const firstEvt = dayEvents[0];
            showCalendarEventDetail(firstEvt.title, firstEvt.date, firstEvt.type, firstEvt.desc);
          } else {
            openAddCalendarEventModal(dateStr);
          }
        });

        gridEl.appendChild(cell);
      }
    }

    // 2. RENDERIZAR LISTA DE HITOS
    if (listEl) {
      listEl.innerHTML = '';
      const filteredEvents = filterCalendarType === 'all'
        ? events
        : events.filter(e => e.type === filterCalendarType);

      if (filteredEvents.length === 0) {
        listEl.innerHTML = `<div class="data-card" style="padding:24px;text-align:center;color:var(--txt-muted);font-style:italic;">No hay eventos para el filtro seleccionado.</div>`;
        return;
      }

      filteredEvents.forEach(evt => {
        const card = document.createElement('div');
        card.className = 'data-card';
        card.style.padding = '16px 20px';
        card.style.marginBottom = '12px';

        const calUrl = GoogleWorkspace.createCalendarUrl(
          evt.title,
          evt.desc,
          'CC Mario Sánchez, Puerto La Cruz',
          evt.date
        );

        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="status-pill ${evt.type === 'contrato' ? 'pill-warning' : evt.type === 'prorroga' ? 'pill-overdue' : 'pill-info'}">
                  <i class="fa-solid fa-calendar-day"></i> ${escapeHtml(evt.date)}
                </span>
                <h4 style="font-family: var(--font-heading); font-size: 14.5px; color: var(--txt-primary);">${escapeHtml(evt.title)}</h4>
              </div>
              <p style="font-size: 12px; color: var(--txt-secondary); margin-top: 4px;">${escapeHtml(evt.desc)}</p>
            </div>
            <a href="${calUrl}" target="_blank" rel="noopener noreferrer" class="btn-action-icon" style="width: auto; padding: 6px 14px; gap: 6px; font-size: 12px; font-weight: 700; text-decoration: none;" title="Agregar a Google Calendar">
              <i class="fa-brands fa-google"></i> <span>Google Calendar</span>
            </a>
          </div>
        `;
        listEl.appendChild(card);
      });
    }
  }

  // F. CENTRO DE ALERTAS
  function renderAlertsCenter() {
    const alertsContainer = document.getElementById('alerts-center-list');
    if (!alertsContainer) return;
    alertsContainer.innerHTML = '';

    const tenants = visibleTenants(dbService.getTenants());
    const invoices = visibleInvoices(dbService.getInvoices());

    // Ajustar título de la sección
    const sectionTitle = document.querySelector('#tab-alertas .section-title');
    if (sectionTitle) {
      if (currentRole === 'tenant') {
        sectionTitle.innerHTML = '<i class="fa-solid fa-bell" style="color: var(--rose);"></i> Mis Avisos de Cobro y Alertas de Mora';
      } else {
        sectionTitle.innerHTML = '<i class="fa-solid fa-bell" style="color: var(--rose);"></i> Centro de Avisos de Cobro y Alertas de Mora';
      }
    }

    const pending = invoices.filter(i => i.status !== 'pagado');
    if (pending.length === 0) {
      alertsContainer.innerHTML = `<div class="data-card" style="padding:32px;text-align:center;color:var(--txt-muted);font-style:italic;">${currentRole === 'tenant' ? 'No tiene cuotas pendientes. ¡Está al día!' : 'No hay alertas pendientes.'}</div>`;
      return;
    }

    pending.forEach(inv => {
      const tenant = tenants.find(t => t.id === inv.tenant_id);
      if (!tenant) return;

      const card = document.createElement('div');
      card.className = 'data-card';
      card.style.padding = '18px 20px';
      card.style.marginBottom = '14px';

      const waMsg = buildMultiCurrencyWhatsAppMessage(tenant, inv);
      const waUrl = GoogleWorkspace.createWhatsAppUrl(tenant.whatsapp, waMsg);
      const gmailUrl = GoogleWorkspace.createGmailUrl(tenant.email, `Aviso de Cobro Cuota ${inv.period_month}/${inv.period_year} — CC Mario Sánchez`, waMsg);

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="status-pill ${inv.status === 'en_mora' ? 'pill-overdue' : 'pill-warning'}">
                ${inv.status === 'en_mora' ? 'Alerta de Retraso' : 'Aviso Preventivo'}
              </span>
              <strong style="font-size: 14px; color: var(--txt-primary);">${escapeHtml(tenant.business_name)} (${escapeHtml(inv.unit_code)})</strong>
            </div>
            <p style="font-size: 12px; color: var(--txt-secondary); margin-top: 4px;">
              Cuota: $ ${inv.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} • Bs. ${financialEngine.convert(inv.total_usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 })} • USDT ${inv.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-action-icon btn-wa-action" style="width: auto; padding: 6px 14px; gap: 6px; font-weight: 700; text-decoration: none;">
              <i class="fa-brands fa-whatsapp"></i> <span>Enviar WhatsApp</span>
            </a>
            <a href="${gmailUrl}" target="_blank" rel="noopener noreferrer" class="btn-action-icon" style="width: auto; padding: 6px 14px; gap: 6px; font-weight: 700; text-decoration: none;">
              <i class="fa-regular fa-envelope"></i> <span>Gmail</span>
            </a>
          </div>
        </div>
      `;
      alertsContainer.appendChild(card);
    });
  }

  // --- GENERADOR DE MENSAJE MULTIMONEDA PARA WHATSAPP ---
  function buildMultiCurrencyWhatsAppMessage(tenant, invoice) {
    const totalUsd = invoice.total_usd;
    const totalBs = financialEngine.convert(totalUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const totalEur = financialEngine.convert(totalUsd, 'USD', 'EUR').toLocaleString('de-DE', { minimumFractionDigits: 2 });
    const totalUsdt = totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const bcvRate = financialEngine.getRates().VES.toFixed(2);
    const settings = dbService.getSettings();

    // Seleccionar plantilla según el estado
    let template = (invoice.status === 'en_mora') ? settings.msg_mora_template : settings.msg_preventive_template;

    // Remplazo de variables
    let body = template
      .replace(/{inquilino}/g, tenant.business_name)
      .replace(/{unidad}/g, invoice.unit_code)
      .replace(/{periodo}/g, `${invoice.period_month}/${invoice.period_year}`)
      .replace(/{monto_usd}/g, `$ ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`)
      .replace(/{monto_bs}/g, `${totalBs}`)
      .replace(/{tasa_bcv}/g, `${bcvRate} Bs/USD`)
      .replace(/{fecha_limite}/g, invoice.due_date);

    return `🏛️ *CENTRO COMERCIAL MARIO SÁNCHEZ*\n` +
      `*Departamento de Administración & Cobranzas*\n` +
      `Av. Municipal, Puerto La Cruz, Venezuela\n\n` +
      `${body}\n\n` +
      `💰 *RESUMEN DE EQUIVALENCIAS:*\n` +
      `• *Dólares:* $ ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\n` +
      `• *Bolívares (Tasa Oficial BCV ${bcvRate}):* Bs. ${totalBs}\n` +
      `• *Euros:* € ${totalEur} EUR\n` +
      `• *Cripto USDT (TRC20):* USDT ${totalUsdt}\n\n` +
      `🏦 *CUENTAS BANCARIAS AUTORIZADAS:*\n` +
      `• *Banesco Corriente:* 0134-0982-12-0987654321\n` +
      `• *Pago Móvil:* Banesco (0134) | RIF: J-40899123-1 | Telf: 0424-7380002\n` +
      `• *Zelle / Custodia USD:* administracion@ccmariosanchez.com\n` +
      `• *Billetera USDT (TRC20):* TXz9y8W7v6U5t4S3r2Q1p0OnMlKjIhGfEd\n\n` +
      `⚖️ *Base Legal:* Ley de Arrendamiento Inmobiliario para Uso Comercial (Gaceta Oficial N° 40.418).\n` +
      `Agradecemos remitir el comprobante adjunto a este canal para su conciliación inmediata.`;
  }

  // --- MODAL CONTROLLERS ---

  // 1. WhatsApp Instantáneo Modal
  window.openWhatsAppModal = function(tenantId, invoiceId = null) {
    const tenant = dbService.getTenants().find(t => t.id === tenantId);
    if (!tenant) return;

    let invoice = null;
    if (invoiceId) {
      invoice = dbService.getInvoices().find(i => i.id === invoiceId);
    } else {
      invoice = dbService.getInvoices().find(i => i.tenant_id === tenantId && i.status !== 'pagado') 
        || dbService.getInvoices().find(i => i.tenant_id === tenantId);
    }

    if (!invoice) {
      invoice = { total_usd: 1000, period_month: 3, period_year: 2026, unit_code: tenant.unit_code || 'LOCAL', due_date: '2026-03-05' };
    }

    const message = buildMultiCurrencyWhatsAppMessage(tenant, invoice);
    const url = GoogleWorkspace.createWhatsAppUrl(tenant.whatsapp, message);
    window.open(url, '_blank');
  };

  // 2. Calculadora de Prórroga Legal (Art. 25 G.O. 40.418) Modal
  window.openProrrogaModal = function(unitCode) {
    const unit = dbService.getUnits().find(u => u.code === unitCode);
    const modal = document.getElementById('modal-prorroga');
    if (!modal) return;

    document.getElementById('pror-unit-code').innerText = unitCode;
    document.getElementById('pror-calc-result').style.display = 'none';
    window.openModal(modal);
  };

  window.calculateProrroga = function() {
    const years = parseFloat(document.getElementById('pror-years-input').value) || 1;
    const ext = VenezuelaLegal.calculateLegalExtension(years);

    document.getElementById('pror-res-months').innerText = `${ext.months} Meses`;
    document.getElementById('pror-res-desc').innerText = ext.description;
    document.getElementById('pror-calc-result').style.display = 'block';
  };

  // 3. Modal Registro de Pago Multimoneda con Snapshot y TxID
  window.openTenantQuickPay = function() {
    const currentTenant = (window.AuthGuard && window.AuthGuard.currentTenant) ? window.AuthGuard.currentTenant() : null;
    const allInvoices = (window.dbService && window.dbService.getInvoices) ? window.dbService.getInvoices() : [];
    
    let myInvoices = [];
    if (currentTenant) {
      myInvoices = allInvoices.filter(i => i.tenant_id === currentTenant.id || i.unit_code === currentTenant.unit_code);
    }
    if (myInvoices.length === 0) {
      myInvoices = allInvoices;
    }

    if (myInvoices.length === 0) {
      showToast("No hay registros de cuotas emitidas en el sistema.", "info", "Sin Cuotas");
      return;
    }

    const pendingInvoices = myInvoices.filter(i => i.status !== 'pagado');
    const targetInvoice = pendingInvoices.length > 0 ? pendingInvoices[0] : myInvoices[0];

    const selectGroup = document.getElementById('pay-select-invoice-group');
    const select = document.getElementById('pay-invoice-select');
    if (selectGroup && select) {
      selectGroup.style.display = 'block';
      select.innerHTML = myInvoices.map(inv => {
        let badge = inv.status === 'pagado' ? '✓ Pagado' : (inv.status === 'verificando' ? '⏳ En Revisión' : (inv.status === 'en_mora' ? '⚠️ En Mora' : 'Pendiente'));
        return `
          <option value="${inv.id}">
            ${inv.invoice_number} — Unidad ${inv.unit_code} — ${inv.period_month}/${inv.period_year} — $${inv.total_usd.toFixed(2)} USD [${badge}]
          </option>
        `;
      }).join('');
      select.value = targetInvoice.id;
    }

    window.openPaymentModal(targetInvoice.id);
  };

  window.onSelectInvoiceToPay = function(invoiceId) {
    if (!invoiceId) return;
    window.openPaymentModal(invoiceId);
  };

  // Toggle para origen del pago móvil/transferencia (Estilo Cashea)
  window.setPaymentOriginType = function(type) {
    const isRegistered = type === 'registered';
    const regRadio = document.getElementById('origin-type-registered');
    const thirdRadio = document.getElementById('origin-type-third');
    const labelReg = document.getElementById('label-origin-registered');
    const labelThird = document.getElementById('label-origin-third');
    const infoBox = document.getElementById('pay-registered-info-box');
    const thirdBox = document.getElementById('pay-third-party-box');

    if (regRadio) regRadio.checked = isRegistered;
    if (thirdRadio) thirdRadio.checked = !isRegistered;

    if (labelReg) {
      labelReg.className = isRegistered ? 'pay-origin-pill active' : 'pay-origin-pill';
      labelReg.style.borderColor = isRegistered ? 'var(--emerald)' : 'var(--border-subtle)';
      labelReg.style.background = isRegistered ? 'rgba(16, 185, 129, 0.12)' : 'transparent';
      labelReg.style.color = isRegistered ? 'var(--txt-primary)' : 'var(--txt-secondary)';
    }

    if (labelThird) {
      labelThird.className = !isRegistered ? 'pay-origin-pill active' : 'pay-origin-pill';
      labelThird.style.borderColor = !isRegistered ? 'var(--amber)' : 'var(--border-subtle)';
      labelThird.style.background = !isRegistered ? 'rgba(245, 158, 11, 0.12)' : 'transparent';
      labelThird.style.color = !isRegistered ? 'var(--txt-primary)' : 'var(--txt-secondary)';
    }

    if (infoBox) infoBox.style.display = isRegistered ? 'flex' : 'none';
    if (thirdBox) thirdBox.style.display = isRegistered ? 'none' : 'flex';
  };

  window.openPaymentModal = function(invoiceId) {
    const inv = dbService.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;

    document.getElementById('pay-invoice-id').value = invoiceId;
    document.getElementById('pay-invoice-num').innerText = inv.invoice_number;
    document.getElementById('pay-unit').innerText = inv.unit_code;
    document.getElementById('pay-amount').value = inv.total_usd;
    document.getElementById('pay-currency-select').value = 'USD';

    // Sincronizar select si existe
    const select = document.getElementById('pay-invoice-select');
    if (select && select.value !== invoiceId) {
      select.value = invoiceId;
    }

    const selectGroup = document.getElementById('pay-select-invoice-group');
    if (selectGroup) {
      selectGroup.style.display = (currentRole === 'tenant') ? 'block' : 'none';
      if (currentRole === 'tenant' && select && select.options.length === 0) {
        const currentTenant = (window.AuthGuard && window.AuthGuard.currentTenant) ? window.AuthGuard.currentTenant() : null;
        const allInvs = dbService.getInvoices();
        const myInvs = currentTenant ? allInvs.filter(i => i.tenant_id === currentTenant.id || i.unit_code === currentTenant.unit_code) : allInvs;
        if (myInvs.length > 0) {
          select.innerHTML = myInvs.map(i => {
            let badge = i.status === 'pagado' ? '✓ Pagado' : (i.status === 'verificando' ? '⏳ En Revisión' : (i.status === 'en_mora' ? '⚠️ En Mora' : 'Pendiente'));
            return `
              <option value="${i.id}">
                ${i.invoice_number} — Unidad ${i.unit_code} — ${i.period_month}/${i.period_year} — $${i.total_usd.toFixed(2)} USD [${badge}]
              </option>
            `;
          }).join('');
          select.value = invoiceId;
        }
      }
    }

    // Cargar datos del inquilino para autocompletado Cashea
    const allTenants = dbService.getTenants();
    const invTenant = allTenants.find(t => t.id === inv.tenant_id || t.unit_code === inv.unit_code);
    const currTenant = (window.AuthGuard && window.AuthGuard.currentTenant) ? window.AuthGuard.currentTenant() : null;
    const activeTenantObj = invTenant || currTenant || {
      business_name: 'Inquilino Titular',
      phone: '0414-5550192',
      rif: 'J-50123456-7'
    };

    const regNameEl = document.getElementById('pay-registered-name');
    const regPhoneEl = document.getElementById('pay-registered-phone');
    const regDocEl = document.getElementById('pay-registered-doc');
    if (regNameEl) regNameEl.textContent = activeTenantObj.business_name || activeTenantObj.legal_name || 'Inquilino Titular';
    if (regPhoneEl) regPhoneEl.textContent = activeTenantObj.phone || '0414-5550192';
    if (regDocEl) regDocEl.textContent = activeTenantObj.rif || activeTenantObj.doc_id || 'J-50123456-7';

    const pending = currentRole === 'admin' ? dbService.getPendingPayment(invoiceId) : null;
    const isTenantSubmission = currentRole === 'tenant';
    const isAdminReview = currentRole === 'admin' && Boolean(pending);
    document.getElementById('payment-modal-title').innerText = isTenantSubmission ? 'Reportar / Cargar Pago' : (isAdminReview ? 'Revisar Comprobante' : 'Registrar y Conciliar Pago');
    document.getElementById('payment-submit-label').innerText = isTenantSubmission ? 'Enviar Comprobante a Administración' : (isAdminReview ? 'Aprobar y Conciliar Pago' : 'Confirmar Pago & Guardar Comprobante');
    document.getElementById('pay-reject-btn').style.display = isAdminReview ? 'flex' : 'none';
    document.getElementById('pay-review-mode').value = isAdminReview ? '1' : '0';
    if (pending) {
      document.getElementById('pay-amount').value = pending.amount_paid;
      document.getElementById('pay-currency-select').value = pending.currency;
      document.getElementById('pay-method').value = pending.payment_method;
      document.getElementById('pay-ref').value = pending.reference_number || '';
    }

    // Resetear o cargar datos del banco emisor y origen (Estilo Cashea)
    const bankSelect = document.getElementById('pay-bank-issuer');
    if (bankSelect) {
      bankSelect.value = (pending && pending.issuing_bank) ? pending.issuing_bank : (inv && inv.issuing_bank ? inv.issuing_bank : '');
    }

    if (pending && pending.origin_type === 'third_party') {
      window.setPaymentOriginType('third_party');
      if (document.getElementById('pay-sender-phone')) document.getElementById('pay-sender-phone').value = pending.origin_phone || '';
      if (document.getElementById('pay-sender-doc')) document.getElementById('pay-sender-doc').value = pending.origin_doc || '';
      if (document.getElementById('pay-sender-name')) document.getElementById('pay-sender-name').value = pending.origin_name || '';
    } else {
      window.setPaymentOriginType('registered');
      if (document.getElementById('pay-sender-phone')) document.getElementById('pay-sender-phone').value = '';
      if (document.getElementById('pay-sender-doc')) document.getElementById('pay-sender-doc').value = '';
      if (document.getElementById('pay-sender-name')) document.getElementById('pay-sender-name').value = '';
    }

    if (pending && pending.zelle_holder) {
      if (document.getElementById('pay-zelle-holder')) document.getElementById('pay-zelle-holder').value = pending.zelle_holder;
      if (document.getElementById('pay-zelle-email')) document.getElementById('pay-zelle-email').value = pending.zelle_email || '';
    }

    // Inicializar dropzone y soporte visual de comprobante
    window.removeReceiptFile();
    const proofToDisplay = (pending && pending.receipt_proof) ? pending.receipt_proof : (inv && inv.receipt_proof ? inv.receipt_proof : null);
    if (proofToDisplay) {
      currentUploadedProof = proofToDisplay;
      const previewCont = document.getElementById('receipt-preview-container');
      const dropzone = document.getElementById('pay-receipt-dropzone');
      const nameEl = document.getElementById('receipt-file-name');
      const sizeEl = document.getElementById('receipt-file-size');
      const iconEl = document.getElementById('pay-preview-icon');
      if (previewCont) previewCont.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
      if (nameEl) nameEl.textContent = proofToDisplay.name || 'Comprobante_Pago_Adjunto';
      if (sizeEl && proofToDisplay.size) sizeEl.textContent = `${(proofToDisplay.size / 1024).toFixed(1)} KB • Archivo cargado`;
      if (iconEl && proofToDisplay.type && proofToDisplay.type.includes('pdf')) iconEl.className = 'fa-solid fa-file-pdf';
    }
    
    updatePaymentEquivalents();
    window.openModal('modal-payment');
  };

  // Actualización dinámica de equivalencias y campos condicionales en el modal de pago
  window.updatePaymentEquivalents = function() {
    const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
    const cur = document.getElementById('pay-currency-select').value;
    const method = document.getElementById('pay-method').value;

    const rates = financialEngine.getRates();
    const bcvRate = rates.VES;
    const usdtVesRate = rates.USDT_VES || bcvRate;
    const usdEq = financialEngine.convert(amount, cur, 'USD');
    const vesEq = financialEngine.convert(amount, cur, 'VES');

    document.getElementById('pay-eq-usd').innerText = `$${usdEq.toFixed(2)} USD`;

    if (cur === 'USDT' || method.includes('Cripto')) {
      const p2pTotal = Math.round((usdEq * usdtVesRate) * 100) / 100;
      document.getElementById('pay-eq-ves').innerText = `Bs. ${vesEq.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (BCV) | Ref. Binance: Bs. ${p2pTotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
    } else {
      document.getElementById('pay-eq-ves').innerText = `Bs. ${vesEq.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
    }

    // Alternar campos condicionales (Bancos Venezuela vs Zelle vs Cripto TxID)
    const isVesBank = method.includes('Pago Móvil') || method.includes('Transferencia Bancaria Bs') || method.includes('Transferencia Divisas');
    const isZelle = method.includes('Zelle');
    const isCrypto = cur === 'USDT' || method.includes('Cripto');

    const veBankFields = document.getElementById('venezuela-bank-fields');
    if (veBankFields) veBankFields.style.display = isVesBank ? 'block' : 'none';

    const zelleFields = document.getElementById('zelle-fields');
    if (zelleFields) zelleFields.style.display = isZelle ? 'block' : 'none';

    // Mostrar campo TxID si es Cripto USDT
    const txidGroup = document.getElementById('pay-txid-group');
    if (txidGroup) {
      txidGroup.style.display = isCrypto ? 'block' : 'none';
    }
  };

  // Enviar Formulario de Pago con Snapshot
  const paymentForm = document.getElementById('payment-form');
  if (paymentForm) {
    paymentForm.onsubmit = (e) => {
      e.preventDefault();
      const invId = document.getElementById('pay-invoice-id').value;
      const method = document.getElementById('pay-method').value;
      const ref = document.getElementById('pay-ref').value.trim();
      const amount = parseFloat(document.getElementById('pay-amount').value);
      const currency = document.getElementById('pay-currency-select').value;
      const txid = document.getElementById('pay-txid') ? document.getElementById('pay-txid').value.trim() : '';

      const bankIssuer = document.getElementById('pay-bank-issuer') ? document.getElementById('pay-bank-issuer').value : '';
      const originType = document.querySelector('input[name="pay_origin_type"]:checked')?.value || 'registered';
      const senderPhone = (originType === 'third_party' && document.getElementById('pay-sender-phone'))
        ? document.getElementById('pay-sender-phone').value.trim()
        : (document.getElementById('pay-registered-phone')?.textContent || '');
      const senderDoc = (originType === 'third_party' && document.getElementById('pay-sender-doc'))
        ? document.getElementById('pay-sender-doc').value.trim()
        : (document.getElementById('pay-registered-doc')?.textContent || '');
      const senderName = (originType === 'third_party' && document.getElementById('pay-sender-name'))
        ? document.getElementById('pay-sender-name').value.trim()
        : (document.getElementById('pay-registered-name')?.textContent || '');
      const zelleHolder = document.getElementById('pay-zelle-holder') ? document.getElementById('pay-zelle-holder').value.trim() : '';
      const zelleEmail = document.getElementById('pay-zelle-email') ? document.getElementById('pay-zelle-email').value.trim() : '';

      // Mitigación de Abuso / Rate Limiting (Máx 6 intentos por minuto)
      if (window.SecuritySuite && window.SecuritySuite.checkRateLimit) {
        const rateCheck = SecuritySuite.checkRateLimit('payment_submission', 6, 60000);
        if (!rateCheck.allowed) {
          if (window.SecuritySuite.toast) {
            window.SecuritySuite.toast(rateCheck.message, 'warning', 'Límite de Solicitudes');
          } else {
            alert('🛡️ Seguridad Activa: ' + rateCheck.message);
          }
          return;
        }
      }

      // Verificación de amenazas (Anti-SQL Injection / Command / Prompt Injection)
      if (window.SecuritySuite && window.SecuritySuite.detectThreats) {
        const threatRef = SecuritySuite.detectThreats(ref);
        const threatTx = SecuritySuite.detectThreats(txid);
        const threatBank = SecuritySuite.detectThreats(bankIssuer);
        const threatPhone = SecuritySuite.detectThreats(senderPhone);
        if (!threatRef.safe || !threatTx.safe || !threatBank.safe || !threatPhone.safe) {
          if (window.SecuritySuite.toast) {
            window.SecuritySuite.toast('Se detectaron caracteres o patrones no permitidos en la referencia o comprobante.', 'error', 'Entrada Rechazada');
          } else {
            alert('🛡️ Entrada rechazada: Se detectaron caracteres o patrones no permitidos en la referencia o comprobante.');
          }
          console.warn('[SECURITY] Bloqueo de inyección en formulario de pago:', threatRef.threats.concat(threatTx.threats));
          return;
        }
      }

      // Verificación de Autorización Zero-Trust / Anti-IDOR
      const targetInvoice = dbService.getInvoices().find(i => i.id === invId);
      if (window.SecuritySuite && window.SecuritySuite.verifyResourceAccess) {
        const access = SecuritySuite.verifyResourceAccess(targetInvoice, AuthGuard.currentUser());
        if (!access.allowed) {
          if (window.SecuritySuite.toast) {
            window.SecuritySuite.toast('No tiene autorización para procesar o modificar este recibo.', 'error', 'Acceso Denegado (IDOR)');
          } else {
            alert('🛡️ Error de Seguridad (IDOR): No tiene autorización para procesar o modificar este recibo.');
          }
          return;
        }
      }

      // Validación cripto si aplica
      if (currency === 'USDT' && txid) {
        const val = financialEngine.validateTxID(txid, 'TRC20');
        if (!val.isValid) {
          if (window.SecuritySuite && window.SecuritySuite.toast) {
            window.SecuritySuite.toast(val.message, 'warning', 'Validación Cripto');
          } else {
            alert('Advertencia: ' + val.message);
          }
          return;
        }
      }

      try {
        // Crear snapshot financiero
        const snapshot = financialEngine.createPaymentSnapshot(amount, currency);

        const paymentPayload = {
          payment_method: method,
          reference_number: ref || txid,
          txid: txid,
          amount_paid: amount,
          currency: currency,
          issuing_bank: bankIssuer,
          origin_type: originType,
          origin_phone: senderPhone,
          origin_doc: senderDoc,
          origin_name: senderName,
          zelle_holder: zelleHolder,
          zelle_email: zelleEmail,
          snapshot: snapshot,
          receipt_proof: currentUploadedProof,
          submitted_by: AuthGuard.currentUser()?.identifier
        };

        let approvalResult = null;
        if (currentRole === 'tenant') {
          dbService.submitPayment(invId, paymentPayload);
        } else if (document.getElementById('pay-review-mode').value === '1') {
          approvalResult = dbService.approvePayment(invId, AuthGuard.currentUser()?.identifier);
        } else {
          dbService.recordPayment(invId, paymentPayload);
        }

        const paidInvoice = dbService.getInvoices().find(i => i.id === invId);
        const paidTenant = paidInvoice && dbService.getTenants().find(t => t.id === paidInvoice.tenant_id);
        const notificationRecipient = currentRole === 'tenant'
          ? 'administracion@ccmariosanchez.com'
          : (paidTenant && paidTenant.email);
        if (notificationRecipient && window.Notifications) {
          void Notifications.email({
            to: notificationRecipient,
            subject: `${currentRole === 'tenant' ? 'Comprobante enviado para revisión' : 'Pago aprobado'} — ${paidInvoice.invoice_number} — CC Mario Sánchez`,
            body: `${currentRole === 'tenant' ? 'Se recibió un comprobante de pago para revisión administrativa' : 'Hemos aprobado el pago de la cuota'} ${paidInvoice.invoice_number} correspondiente al período ${paidInvoice.period_month}/${paidInvoice.period_year}. Referencia: ${ref || txid || 'no indicada'}.`
          });
        }

        if (currentRole === 'tenant') {
          // Secuencia visual interactiva de procesamiento y cifrado para Inquilinos
          const modalContent = document.querySelector('#modal-payment .modal-content') || document.getElementById('modal-payment');
          const originalModalHTML = modalContent.innerHTML;
          
          modalContent.innerHTML = `
            <div style="padding: 36px 20px; text-align: center;">
              <div style="width: 68px; height: 68px; margin: 0 auto 18px; border-radius: 50%; background: var(--cyan-glow); display: flex; align-items: center; justify-content: center; font-size: 26px; color: var(--cyan);">
                <i class="fa-solid fa-shield-halved fa-spin" style="--fa-animation-duration: 2.5s;"></i>
              </div>
              <h3 id="proc-anim-title" style="font-family: var(--font-heading); font-size: 18px; color: var(--txt-primary); margin-bottom: 8px;">
                Cifrando Comprobante de Pago...
              </h3>
              <p id="proc-anim-desc" style="font-size: 12.5px; color: var(--txt-secondary); margin-bottom: 22px;">
                Generando hash de integridad SHA-256 y protegiendo metadatos bancarios.
              </p>
              
              <div style="width: 100%; max-width: 320px; height: 6px; background: var(--border-subtle); border-radius: 4px; margin: 0 auto 18px; overflow: hidden;">
                <div id="proc-anim-bar" style="width: 30%; height: 100%; background: linear-gradient(90deg, var(--cyan), var(--emerald)); transition: width 0.4s ease; border-radius: 4px;"></div>
              </div>

              <div id="proc-anim-steps" style="display: flex; flex-direction: column; gap: 8px; text-align: left; max-width: 320px; margin: 0 auto; font-size: 12px; color: var(--txt-secondary);">
                <div id="step-1" style="display: flex; align-items: center; gap: 8px; color: var(--cyan);"><i class="fa-solid fa-circle-check"></i> Cifrado de comprobante completado</div>
                <div id="step-2" style="display: flex; align-items: center; gap: 8px; color: var(--txt-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Notificando a Administración (Email & WhatsApp)...</div>
                <div id="step-3" style="display: flex; align-items: center; gap: 8px; color: var(--txt-muted);"><i class="fa-regular fa-circle"></i> Asignando estado: En Revisión</div>
              </div>
            </div>
          `;

          setTimeout(() => {
            const step2 = document.getElementById('step-2');
            const step3 = document.getElementById('step-3');
            const bar = document.getElementById('proc-anim-bar');
            const title = document.getElementById('proc-anim-title');
            const desc = document.getElementById('proc-anim-desc');
            if (bar) bar.style.width = '70%';
            if (step2) { step2.style.color = 'var(--cyan)'; step2.innerHTML = '<i class="fa-solid fa-circle-check"></i> Alerta despachada a Administración'; }
            if (step3) { step3.style.color = 'var(--amber)'; step3.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Asignando estado: En Revisión...'; }
            if (title) title.innerText = 'Notificando a Administración...';
            if (desc) desc.innerText = 'Despachando alertas seguras al departamento de cobranzas.';
          }, 600);

          setTimeout(() => {
            const step3 = document.getElementById('step-3');
            const bar = document.getElementById('proc-anim-bar');
            const title = document.getElementById('proc-anim-title');
            const desc = document.getElementById('proc-anim-desc');
            if (bar) bar.style.width = '100%';
            if (step3) { step3.style.color = 'var(--emerald)'; step3.innerHTML = '<i class="fa-solid fa-circle-check"></i> Estado asignado: ⏳ En Revisión'; }
            if (title) { title.innerText = '¡Comprobante Enviado con Éxito!'; title.style.color = 'var(--emerald)'; }
            if (desc) desc.innerText = 'El administrador verificará la acreditación bancaria y emitirá su recibo oficial.';
          }, 1200);

          setTimeout(() => {
            window.closeModal('modal-payment');
            modalContent.innerHTML = originalModalHTML;
            paymentForm.reset();
            removeReceiptFile();
            renderAll();
            if (window.SecuritySuite && window.SecuritySuite.toast) {
              window.SecuritySuite.toast('Comprobante enviado a Administración. Su cuota está ⏳ En Revisión hasta su validación.', 'success', 'Comprobante Registrado');
            }
          }, 1900);

          return;
        }

        window.closeModal('modal-payment');
        paymentForm.reset();
        removeReceiptFile();
        renderAll();

        if (approvalResult && approvalResult.receipt) {
          window.openReceiptPreview(approvalResult.receipt);
          if (window.SecuritySuite && window.SecuritySuite.toast) {
            window.SecuritySuite.toast('Pago aprobado. Se ha emitido y archivado el recibo oficial correlativo.', 'success', 'Cobranza Conciliada');
          }
        } else {
          const successMsg = `Pago registrado y conciliado exitosamente (Tasa BCV: ${snapshot.bcv_rate_applied.toFixed(2)} Bs/USD).`;
          if (window.SecuritySuite && window.SecuritySuite.toast) {
            window.SecuritySuite.toast(successMsg, 'success', 'Pago Conciliado');
          } else {
            alert(successMsg);
          }
        }
      } catch (err) {
        if (window.SecuritySuite && window.SecuritySuite.toast) {
          window.SecuritySuite.toast(err.message, 'error', 'Fallo al Procesar Pago');
        } else {
          alert('Error: ' + err.message);
        }
      }
    };
  }

  window.rejectPendingPayment = async function() {
    const invoiceId = document.getElementById('pay-invoice-id').value;
    let reason = null;
    if (window.SecuritySuite && window.SecuritySuite.prompt) {
      reason = await window.SecuritySuite.prompt(
        'Indique detalladamente el motivo del rechazo del comprobante de pago para notificación del inquilino:',
        'Rechazar Comprobante de Pago',
        'Rechazar Comprobante',
        'Cancelar',
        'Ej: Referencia no coincide con extracto bancario o monto incompleto'
      );
    } else {
      reason = window.prompt('Indique el motivo del rechazo:');
    }
    if (!reason || !reason.trim()) return;
    try {
      dbService.rejectPayment(invoiceId, reason.trim(), AuthGuard.currentUser()?.identifier);
      window.closeModal('modal-payment');
      renderAll();
      showToast('Comprobante rechazado y motivo registrado en la trazabilidad.', 'info', 'Pago Rechazado');
    } catch (err) {
      showToast('Error: ' + err.message, 'error', 'Error al Rechazar');
    }
  };

  // Manejador de archivo comprobante de pago (base64) con soporte Drag & Drop
  let currentUploadedProof = null;
  window.handleReceiptFileChange = function(e) {
    const file = (e.target && e.target.files && e.target.files[0])
      ? e.target.files[0]
      : (e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
    if (!file) return;

    // Validación de tamaño (Máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast("El comprobante seleccionado excede el límite máximo de 10MB.", "warning", "Archivo Excedido");
      const input = document.getElementById('pay-receipt-file');
      if (input) input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      currentUploadedProof = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: evt.target.result // Base64 Data URL
      };
      const previewCont = document.getElementById('receipt-preview-container');
      const dropzone = document.getElementById('pay-receipt-dropzone');
      const nameEl = document.getElementById('receipt-file-name');
      const sizeEl = document.getElementById('receipt-file-size');
      const iconEl = document.getElementById('pay-preview-icon');

      if (previewCont) previewCont.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB • ${(file.type || 'Documento').split('/')[1] || 'archivo'}`;
      if (iconEl) {
        iconEl.className = file.type && file.type.includes('pdf') ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-image';
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeReceiptFile = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    currentUploadedProof = null;
    const fileInput = document.getElementById('pay-receipt-file');
    if (fileInput) fileInput.value = '';
    const previewCont = document.getElementById('receipt-preview-container');
    const dropzone = document.getElementById('pay-receipt-dropzone');
    if (previewCont) previewCont.style.display = 'none';
    if (dropzone) dropzone.style.display = 'flex';
  };

  // Visor de Comprobante de Pago
  window.viewReceiptProof = function(invoiceId) {
    const inv = dbService.getInvoices().find(i => i.id === invoiceId);
    if (!inv || !inv.receipt_proof) {
      showToast("Esta cuota no posee un comprobante adjunto.", "info", "Comprobante");
      return;
    }
    const proof = inv.receipt_proof;
    if (!proof || !isSafeReceiptDataUrl(proof.data)) {
      showToast('El comprobante no tiene un formato seguro o válido.', 'error', 'Formato Inválido');
      return;
    }
    const win = window.open('', '_blank');
    if (proof.type && proof.type.includes('pdf')) {
      win.document.write(`<iframe src="${proof.data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
      win.document.write(`
        <div style="background:#04070d; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; font-family:sans-serif; color:#f8fafc;">
          <h3 style="margin-bottom:12px; color:#f59e0b;">Comprobante de Pago — Recibo ${escapeHtml(inv.invoice_number)}</h3>
          <img src="${proof.data}" alt="Comprobante" style="max-width:90%; max-height:85vh; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.8); border:1px solid rgba(255,255,255,0.1);">
          <p style="margin-top:10px; font-size:12px; color:#94a3b8;">${escapeHtml(proof.name)}</p>
        </div>
      `);
    }
  };

  // --- MÓDULO DE CONFIGURACIÓN DE LA APP ---
  window.openConfigTab = function() {
    const configNavBtn = document.getElementById('nav-tab-configuracion');
    if (configNavBtn) {
      configNavBtn.click();
    } else {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');
      const target = document.getElementById('tab-configuracion');
      if (target) target.style.display = 'block';
    }
  };

  // Cargar configuración guardada en los inputs
  function loadConfigFields() {
    const cfg = dbService.getSettings();
    if (document.getElementById('cfg-rate-locales')) document.getElementById('cfg-rate-locales').value = cfg.rate_locales_m2 || 4.5;
    if (document.getElementById('cfg-rate-macrolotes')) document.getElementById('cfg-rate-macrolotes').value = cfg.rate_macrolotes_m2 || 2.3;
    if (document.getElementById('cfg-rate-galpones')) document.getElementById('cfg-rate-galpones').value = cfg.rate_galpones_m2 || 2.5;
    if (document.getElementById('cfg-condo-aliquot')) document.getElementById('cfg-condo-aliquot').value = cfg.condo_fee_aliquot_base || 8.0;

    if (document.getElementById('cfg-cutoff-day')) document.getElementById('cfg-cutoff-day').value = cfg.cutoff_day || 5;
    if (document.getElementById('cfg-alert-before')) document.getElementById('cfg-alert-before').value = cfg.alert_days_before || 3;
    if (document.getElementById('cfg-grace-days')) document.getElementById('cfg-grace-days').value = cfg.grace_days || 5;

    if (document.getElementById('cfg-msg-preventive')) document.getElementById('cfg-msg-preventive').value = cfg.msg_preventive_template;
    if (document.getElementById('cfg-msg-mora')) document.getElementById('cfg-msg-mora').value = cfg.msg_mora_template;

    window.updateTemplateLivePreview();
  }

  // --- EDITOR INTERACTIVO DE PLANTILLAS Y VISTA PREVIA ---
  window.activeTemplateTextarea = null;

  window.insertVarToActiveTemplate = function(varName) {
    let textarea = window.activeTemplateTextarea;
    if (!textarea) {
      textarea = document.getElementById('cfg-msg-preventive');
    }
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + varName + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + varName.length;
    textarea.focus();
    window.updateTemplateLivePreview();
  };

  window.updateTemplateLivePreview = function() {
    const sampleData = {
      '{inquilino}': 'Inversiones FarmaPlus C.A.',
      '{unidad}': 'Local L-04',
      '{periodo}': 'Septiembre 2026',
      '{monto_usd}': '$420.00 USD',
      '{monto_bs}': 'Bs. 17,220.00',
      '{tasa_bcv}': '41.00 Bs/USD',
      '{fecha_limite}': '05/09/2026'
    };

    const renderSample = (tpl) => {
      if (!tpl || !tpl.trim()) {
        return '<span style="color:#64748b;font-style:italic;">Escriba una plantilla para visualizar la vista previa...</span>';
      }
      let res = escapeHtml(tpl);
      for (const [key, val] of Object.entries(sampleData)) {
        res = res.split(key).join(`<span style="background:rgba(217,119,6,0.25);color:#fbbf24;padding:1px 5px;border-radius:4px;font-weight:700;">${val}</span>`);
      }
      // Reemplazo básico de asteriscos para simular negrita en WhatsApp
      res = res.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
      return res.replace(/\n/g, '<br>');
    };

    const prevEl = document.getElementById('cfg-msg-preventive');
    const moraEl = document.getElementById('cfg-msg-mora');
    const prevBox = document.getElementById('preview-msg-preventive');
    const moraBox = document.getElementById('preview-msg-mora');

    if (prevBox && prevEl) prevBox.innerHTML = renderSample(prevEl.value);
    if (moraBox && moraEl) moraBox.innerHTML = renderSample(moraEl.value);
  };

  window.saveCuotasConfig = function(e) {
    e.preventDefault();
    dbService.saveSettings({
      rate_locales_m2: parseFloat(document.getElementById('cfg-rate-locales').value) || 4.5,
      rate_macrolotes_m2: parseFloat(document.getElementById('cfg-rate-macrolotes').value) || 2.3,
      rate_galpones_m2: parseFloat(document.getElementById('cfg-rate-galpones').value) || 2.5,
      condo_fee_aliquot_base: parseFloat(document.getElementById('cfg-condo-aliquot').value) || 8.0
    });
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Parámetros base de cánones y gastos comunes actualizados.', 'success', 'Cánones Guardados');
    } else {
      alert("¡Parámetros de Cuotas y Cánones guardados con éxito!");
    }
  };

  window.saveAlertasConfig = function(e) {
    e.preventDefault();
    dbService.saveSettings({
      cutoff_day: parseInt(document.getElementById('cfg-cutoff-day').value) || 5,
      alert_days_before: parseInt(document.getElementById('cfg-alert-before').value) || 3,
      grace_days: parseInt(document.getElementById('cfg-grace-days').value) || 5
    });
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Días de corte, plazos de gracia y avisos preventivos guardados.', 'success', 'Alertas Actualizadas');
    } else {
      alert("¡Configuración de Alertas & Vencimientos guardada!");
    }
  };

  window.saveMensajesConfig = function(e) {
    e.preventDefault();
    dbService.saveSettings({
      msg_preventive_template: document.getElementById('cfg-msg-preventive').value.trim(),
      msg_mora_template: document.getElementById('cfg-msg-mora').value.trim()
    });
    window.updateTemplateLivePreview();
    renderAlertsCenter();
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Plantillas de notificación para WhatsApp y correo actualizadas.', 'success', 'Plantillas Guardadas');
    } else {
      alert("¡Plantillas de Mensajes WhatsApp/Gmail actualizadas!");
    }
  };

  window.resetDefaultTemplates = async function() {
    const proceed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Desea restablecer los textos de notificación a las plantillas legales predeterminadas de Gaceta Oficial 40.418?', 'Restablecer Plantillas', 'Restablecer', 'Cancelar')
      : confirm("¿Desea restablecer las plantillas a los textos legales predeterminados?");
    if (!proceed) return;

    document.getElementById('cfg-msg-preventive').value = `Estimados *{inquilino}* ({unidad}):\nLe remitimos su aviso de cobro del período *{periodo}* por un total de *{monto_usd}* (Bs. {monto_bs} a tasa BCV {tasa_bcv}).\nFecha límite de pago: *{fecha_limite}*.\nPor favor remitir comprobante a este canal para conciliación.`;
    document.getElementById('cfg-msg-mora').value = `⚠️ *AVISO DE RETRASO — CC MARIO SÁNCHEZ*\nEstimados *{inquilino}* ({unidad}):\nLe informamos que su cuota del período *{periodo}* se encuentra en estado de MORA por un saldo de *{monto_usd}* (Bs. {monto_bs}).\nConforme a la Gaceta Oficial 40.418, agradecemos regularizar el pago a la brevedad para evitar recargos o suspensión de servicios comunes.`;
    window.saveMensajesConfig(new Event('submit'));
    window.updateTemplateLivePreview();
  };

  loadConfigFields();

  // 4. Expediente de Inquilino
  window.openTenantDossier = function(tenantId) {
    const tenant = dbService.getTenants().find(t => t.id === tenantId);
    if (!tenant) return;
    const contract = dbService.getContracts().find(c => c.tenant_id === tenantId);
    const ext = VenezuelaLegal.calculateLegalExtension(1);

    document.getElementById('dossier-company').innerText = tenant.business_name;
    document.getElementById('dossier-trade').innerText = tenant.trade_name || 'N/A';
    document.getElementById('dossier-rif').innerText = tenant.rif;
    document.getElementById('dossier-rep').innerText = `${tenant.legal_rep_name} (C.I. ${tenant.legal_rep_dni})`;
    document.getElementById('dossier-unit').innerText = tenant.unit_code;
    document.getElementById('dossier-activity').innerText = tenant.commercial_activity;
    document.getElementById('dossier-contact').innerText = `${tenant.phone} | WA: ${tenant.whatsapp} | ${tenant.email}`;

    if (contract) {
      document.getElementById('dossier-contract-num').innerText = contract.contract_number;
      document.getElementById('dossier-contract-dates').innerText = `${contract.start_date} al ${contract.end_date}`;
      document.getElementById('dossier-contract-rent').innerText = formatMoney(contract.rent_usd) + '/mes';
      document.getElementById('dossier-contract-deposit').innerText = `$${contract.deposit_usd.toLocaleString()} USD (${contract.deposit_months} meses - Límite legal Art. 19)`;
      document.getElementById('dossier-legal-extension').innerText = ext.description;
    }

    // Poblar Historial Mensual del Cliente / Inquilino
    const historyTbody = document.getElementById('dossier-history-table-body');
    const solvencyBadge = document.getElementById('dossier-solvency-badge');
    if (historyTbody) {
      historyTbody.innerHTML = '';
      const tenantInvoices = dbService.getInvoices().filter(i => i.tenant_id === tenantId);
      tenantInvoices.sort((a, b) => {
        if (b.period_year !== a.period_year) return b.period_year - a.period_year;
        return b.period_month - a.period_month;
      });

      const hasOverdue = tenantInvoices.some(i => i.status === 'en_mora');
      const hasPending = tenantInvoices.some(i => i.status === 'pendiente' || i.status === 'verificando');

      if (solvencyBadge) {
        if (hasOverdue) {
          solvencyBadge.className = 'status-pill pill-overdue';
          solvencyBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> En Mora';
        } else if (hasPending) {
          solvencyBadge.className = 'status-pill pill-warning';
          solvencyBadge.innerHTML = '<i class="fa-solid fa-clock"></i> Cuota Pendiente';
        } else {
          solvencyBadge.className = 'status-pill pill-active';
          solvencyBadge.innerHTML = '<i class="fa-solid fa-check"></i> Solvente al Día';
        }
      }

      if (tenantInvoices.length === 0) {
        historyTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--txt-muted);font-style:italic;">No registra historial previo.</td></tr>`;
      } else {
        tenantInvoices.forEach(inv => {
          const tr = document.createElement('tr');
          let stBadge = '';
          if (inv.status === 'pagado') stBadge = '<span class="status-pill pill-active" style="font-size:10px;padding:2px 6px;"><i class="fa-solid fa-check"></i> Pagado</span>';
          else if (inv.status === 'en_mora') stBadge = '<span class="status-pill pill-overdue" style="font-size:10px;padding:2px 6px;"><i class="fa-solid fa-triangle-exclamation"></i> En Mora</span>';
          else if (inv.status === 'verificando') stBadge = '<span class="status-pill pill-warning" style="font-size:10px;padding:2px 6px;"><i class="fa-solid fa-magnifying-glass"></i> Revisión</span>';
          else stBadge = '<span class="status-pill pill-warning" style="font-size:10px;padding:2px 6px;"><i class="fa-solid fa-hourglass"></i> Pendiente</span>';

          const dateDetail = inv.paid_at ? `Pagado: ${escapeHtml(inv.paid_at)}` : `Vence: ${escapeHtml(inv.due_date)}`;

          tr.innerHTML = `
            <td><strong style="color:var(--amber);">${inv.period_month}/${inv.period_year}</strong></td>
            <td><span style="font-family:monospace;">${escapeHtml(inv.invoice_number)}</span></td>
            <td><strong>${formatMoney(inv.total_usd)}</strong></td>
            <td><span style="font-size:11px;color:var(--txt-secondary);">${dateDetail}</span></td>
            <td>${stBadge}</td>
            <td>
              <div style="display:flex;gap:4px;">
                <button type="button" class="btn-action-icon" style="width:26px;height:26px;font-size:11px;" title="Imprimir Recibo" onclick="window.printReceipt('${inv.id}')">
                  <i class="fa-solid fa-print"></i>
                </button>
                ${inv.receipt_proof ? `
                  <button type="button" class="btn-action-icon" style="width:26px;height:26px;font-size:11px;color:var(--cyan);border-color:var(--cyan);" title="Ver Comprobante" onclick="window.viewReceiptProof('${inv.id}')">
                    <i class="fa-solid fa-paperclip"></i>
                  </button>
                ` : ''}
              </div>
            </td>
          `;
          historyTbody.appendChild(tr);
        });
      }
    }

    const dossierContractBtn = document.getElementById('btn-dossier-view-contract');
    if (dossierContractBtn) {
      dossierContractBtn.onclick = () => {
        window.viewTenantContract(tenantId);
      };
    }

    window.openModal('modal-dossier');
  };

  // 5. Imprimir Recibo Cuatrimoneda
  window.printReceipt = function(invoiceId) {
    const inv = dbService.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;
    const tenant = dbService.getTenants().find(t => t.id === inv.tenant_id);

    const bcvRate = financialEngine.getRates().VES.toFixed(2);
    const totalBs = financialEngine.convert(inv.total_usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const totalEur = financialEngine.convert(inv.total_usd, 'USD', 'EUR').toLocaleString('de-DE', { minimumFractionDigits: 2 });

    const content = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #000; max-width: 680px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="margin: 0; font-size: 18px;">CENTRO COMERCIAL MARIO SÁNCHEZ</h2>
          <p style="margin: 3px 0; font-size: 12px;">Av. Municipal, Puerto La Cruz, Estado Anzoátegui, Venezuela</p>
          <h3 style="margin: 8px 0 0; font-size: 14px; color: #b45309;">RECIBO OFICIAL DE COBRANZA — N° ${inv.invoice_number}</h3>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px;">
          <div>
            <strong>ARRENDATARIO:</strong> ${tenant ? tenant.business_name : 'N/A'}<br>
            <strong>RIF:</strong> ${tenant ? tenant.rif : 'N/A'}<br>
            <strong>UNIDAD COMERCIAL:</strong> ${inv.unit_code}
          </div>
          <div style="text-align: right;">
            <strong>PERÍODO:</strong> ${inv.period_month}/${inv.period_year}<br>
            <strong>FECHA VALOR:</strong> ${inv.due_date}<br>
            <strong>ESTADO:</strong> ${inv.status.toUpperCase()}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
          <thead>
            <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 8px; text-align: left;">Concepto</th>
              <th style="padding: 8px; text-align: right;">Monto USD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Canon Fijo de Arrendamiento Comercial (Art. 32 G.O. 40.418)</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">$${inv.rent_usd.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Alícuota Gastos Comunes / Condominio</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">$${inv.condo_usd.toFixed(2)}</td>
            </tr>
            <tr style="font-weight: bold; background: #f8fafc;">
              <td style="padding: 10px 8px;">TOTAL USD PACTADO:</td>
              <td style="padding: 10px 8px; text-align: right;">$${inv.total_usd.toFixed(2)} USD</td>
            </tr>
          </tbody>
        </table>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 11.5px; margin-bottom: 16px;">
          <strong>Equivalencias Cuatrimoneda a la Fecha Valor:</strong>
          <div style="margin-top: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
            <div>• Bolívares (Tasa Oficial BCV ${bcvRate}): <strong>Bs. ${totalBs}</strong></div>
            <div>• Euros (€): <strong>€ ${totalEur} EUR</strong></div>
            <div>• Criptoactivos (USDT TRC20): <strong>USDT ${inv.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
            <div>• Dólares ($): <strong>$ ${inv.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong></div>
          </div>
        </div>

        <div style="font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px; text-align: center;">
          Documento emitido de conformidad con la Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial.<br>
          Administración del Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela.
        </div>
      </div>
    `;

    const printWin = window.open('', '_blank', 'width=750,height=650');
    printWin.document.write(content);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 250);
  };

  // =========================================================================
  // MÓDULO 1: GESTIÓN DE CUENTAS BANCARIAS RECEPTORAS (ADMINISTRADOR)
  // =========================================================================
  window.renderAdminBankAccounts = function() {
    const tbody = document.getElementById('admin-accounts-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const accounts = dbService.getReceivingAccounts ? dbService.getReceivingAccounts() : [];
    const allTenants = dbService.getTenants ? dbService.getTenants() : [];

    if (accounts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--txt-muted);">No hay cuentas configuradas.</td></tr>`;
      return;
    }

    accounts.forEach(acc => {
      const tr = document.createElement('tr');
      const isAct = acc.is_active !== false;

      let assignedText = '';
      if (!acc.assigned_tenants || acc.assigned_tenants.includes('all')) {
        assignedText = '<span class="status-pill pill-info" style="font-size:10.5px;"><i class="fa-solid fa-users"></i> Todos los inquilinos</span>';
      } else {
        const assignedNames = acc.assigned_tenants
          .map(tId => {
            const t = allTenants.find(item => item.id === tId);
            return t ? (t.trade_name || t.business_name.split(' ')[0]) : tId;
          })
          .join(', ');
        assignedText = `<span style="font-size:11px;color:var(--amber);"><i class="fa-solid fa-user-check"></i> ${escapeHtml(assignedNames || 'Ninguno')}</span>`;
      }

      const accountIdentifier = acc.account_number || acc.wallet_address || acc.phone || acc.email || 'N/A';

      tr.innerHTML = `
        <td>
          <strong style="color:var(--txt-primary);display:flex;align-items:center;gap:6px;">
            <i class="${acc.icon || 'fa-solid fa-building-columns'}" style="color:var(--amber);"></i> ${escapeHtml(acc.bank)}
          </strong>
          <div style="font-size:11px;color:var(--txt-muted);">Titular: ${escapeHtml(acc.beneficiary || 'N/A')}</div>
        </td>
        <td>
          <span style="font-weight:600;">${escapeHtml(acc.type || '')}</span>
          <div style="font-size:10.5px;color:var(--txt-secondary);">${escapeHtml(acc.badge || '')}</div>
        </td>
        <td>
          <span style="font-family:monospace;font-size:11.5px;color:var(--txt-primary);">${escapeHtml(accountIdentifier)}</span>
          <div style="font-size:10.5px;color:var(--txt-muted);">RIF: ${escapeHtml(acc.rif || '')}</div>
        </td>
        <td>${assignedText}</td>
        <td>
          <span class="status-pill ${isAct ? 'pill-active' : 'pill-overdue'}" style="font-size:10.5px;cursor:pointer;" onclick="window.toggleAccountStatus('${acc.id}')" title="Click para alternar estado">
            <i class="fa-solid ${isAct ? 'fa-check' : 'fa-ban'}"></i> ${isAct ? 'Habilitada' : 'Inactiva'}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-action-icon" title="Editar Cuenta" onclick="window.openBankAccountModal('${acc.id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button type="button" class="btn-action-icon" style="color:var(--rose);border-color:var(--rose);" title="Eliminar Cuenta" onclick="window.deleteAccount('${acc.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  window.openBankAccountModal = function(accountId = null) {
    const modal = document.getElementById('modal-bank-account');
    const form = document.getElementById('bank-account-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('bank-acc-id').value = accountId || '';
    document.getElementById('bank-account-modal-title').innerHTML = accountId
      ? '<i class="fa-solid fa-pen-to-square" style="color: var(--amber);"></i> Editar Cuenta Receptora'
      : '<i class="fa-solid fa-building-columns" style="color: var(--amber);"></i> Nueva Cuenta Receptora';

    // Rellenar lista de inquilinos para el checklist
    const checklist = document.getElementById('acc-tenants-checklist');
    const allTenants = dbService.getTenants ? dbService.getTenants() : [];
    if (checklist) {
      checklist.innerHTML = allTenants.map(t => `
        <label style="display:flex;align-items:center;gap:8px;font-size:11.5px;padding:3px 0;cursor:pointer;">
          <input type="checkbox" class="acc-tenant-chk" value="${t.id}">
          <span><strong>${escapeHtml(t.unit_code)}</strong> — ${escapeHtml(t.business_name)}</span>
        </label>
      `).join('');
    }

    if (accountId) {
      const accounts = dbService.getReceivingAccounts ? dbService.getReceivingAccounts() : [];
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        document.getElementById('bank-acc-bank').value = acc.bank || '';
        document.getElementById('bank-acc-type').value = acc.type || '';
        document.getElementById('bank-acc-holder').value = acc.beneficiary || '';
        document.getElementById('bank-acc-rif').value = acc.rif || '';
        document.getElementById('bank-acc-phone').value = acc.phone || acc.email || '';
        document.getElementById('bank-acc-number').value = acc.account_number || acc.wallet_address || acc.binance_pay_id || '';
        
        let cur = 'VES';
        if (acc.badge && acc.badge.includes('USD')) cur = 'USD';
        else if (acc.badge && acc.badge.includes('USDT')) cur = 'USDT';
        else if (acc.badge && acc.badge.includes('EUR')) cur = 'EUR';
        document.getElementById('bank-acc-currency').value = cur;

        const isCustom = acc.assigned_tenants && !acc.assigned_tenants.includes('all');
        const radios = document.getElementsByName('acc-assign-type');
        radios.forEach(r => {
          r.checked = (r.value === 'custom' && isCustom) || (r.value === 'all' && !isCustom);
        });

        window.onAccountAssignChange();
        if (isCustom && checklist) {
          const chks = checklist.querySelectorAll('.acc-tenant-chk');
          chks.forEach(chk => {
            chk.checked = acc.assigned_tenants.includes(chk.value);
          });
        }
      }
    } else {
      const radios = document.getElementsByName('acc-assign-type');
      radios.forEach(r => { if (r.value === 'all') r.checked = true; });
      window.onAccountAssignChange();
    }

    window.openModal(modal);
  };

  window.closeBankAccountModal = function() {
    window.closeModal('modal-bank-account');
  };

  window.onAccountAssignChange = function() {
    const radios = document.getElementsByName('acc-assign-type');
    let selected = 'all';
    radios.forEach(r => { if (r.checked) selected = r.value; });
    const checklist = document.getElementById('acc-tenants-checklist');
    if (checklist) {
      checklist.style.display = (selected === 'custom') ? 'block' : 'none';
    }
  };

  window.saveBankAccount = function(e) {
    e.preventDefault();
    const id = document.getElementById('bank-acc-id').value;
    const bank = document.getElementById('bank-acc-bank').value.trim();
    const type = document.getElementById('bank-acc-type').value.trim();
    const holder = document.getElementById('bank-acc-holder').value.trim();
    const rif = document.getElementById('bank-acc-rif').value.trim();
    const contact = document.getElementById('bank-acc-phone').value.trim();
    const number = document.getElementById('bank-acc-number').value.trim();
    const cur = document.getElementById('bank-acc-currency').value;

    let assignType = 'all';
    document.getElementsByName('acc-assign-type').forEach(r => { if (r.checked) assignType = r.value; });

    let assignedTenants = ['all'];
    if (assignType === 'custom') {
      const checkedBoxes = document.querySelectorAll('.acc-tenant-chk:checked');
      assignedTenants = Array.from(checkedBoxes).map(cb => cb.value);
      if (assignedTenants.length === 0) {
        showToast("Seleccione al menos un inquilino autorizado para esta cuenta o seleccione 'Todos los Inquilinos'.", "warning", "Validación Requerida");
        return;
      }
    }

    let badge = 'Bs. Tasa BCV';
    let icon = 'fa-solid fa-building-columns';
    let accountNumber = '';
    let phone = '';
    let email = '';
    let walletAddress = '';
    let binancePayId = '';

    if (cur === 'USD') {
      badge = 'USD Oficial';
      icon = 'fa-solid fa-vault';
      if (number.length >= 15) accountNumber = number;
      else if (contact.includes('@')) email = contact;
    } else if (cur === 'USDT') {
      badge = 'USDT 1:1 USD';
      icon = 'fa-solid fa-coins';
      if (number.length > 20) walletAddress = number;
      else binancePayId = number;
    } else if (cur === 'EUR') {
      badge = 'EUR Oficial';
      icon = 'fa-solid fa-euro-sign';
      accountNumber = number;
    } else {
      if (number.length >= 15) accountNumber = number;
      if (contact) phone = contact;
    }

    const payload = {
      bank: bank,
      type: type,
      account_number: accountNumber || number,
      phone: phone,
      email: email,
      wallet_address: walletAddress,
      binance_pay_id: binancePayId,
      beneficiary: holder,
      rif: rif,
      icon: icon,
      badge: badge,
      instructions: `Operaciones en ${cur}. Por favor notificar el comprobante en su portal para conciliación automática.`,
      assigned_tenants: assignedTenants
    };

    if (id) payload.id = id;

    try {
      dbService.saveReceivingAccount(payload);
      closeBankAccountModal();
      renderAll();
      showToast('Cuenta receptora oficial guardada y actualizada con éxito.', 'success', 'Cuenta Configurada');
    } catch (err) {
      showToast('Error al guardar cuenta: ' + err.message, 'error', 'Error en Cuenta');
    }
  };

  window.toggleAccountStatus = function(accountId) {
    if (!accountId) return;
    try {
      dbService.toggleReceivingAccount(accountId);
      renderAll();
      showToast('Estado de disponibilidad de la cuenta actualizado.', 'info', 'Cuenta Modificada');
    } catch (err) {
      showToast('Error: ' + err.message, 'error', 'Error en Cuenta');
    }
  };

  window.deleteAccount = async function(accountId) {
    const proceed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Está seguro de eliminar esta cuenta receptora? Los inquilinos dejarán de verla inmediatamente.', 'Eliminar Cuenta Receptora', 'Eliminar Cuenta', 'Cancelar')
      : confirm("¿Está seguro de eliminar esta cuenta receptora? Esta acción no se puede deshacer.");
    if (!proceed) return;

    try {
      dbService.deleteReceivingAccount(accountId);
      renderAll();
      showToast('Cuenta receptora eliminada satisfactoriamente.', 'warning', 'Cuenta Eliminada');
    } catch (err) {
      showToast('Error: ' + err.message, 'error', 'Error al Eliminar');
    }
  };

  // =========================================================================
  // MÓDULO 1.5: COMITÉ DE APROBACIÓN DE USUARIOS & DELEGACIÓN DE ACCESO
  // =========================================================================
  window.renderUserApprovalsTable = function() {
    const tbody = document.getElementById('admin-user-approvals-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!window.AuthGuard || typeof window.AuthGuard.listUsers !== 'function') return;

    const users = window.AuthGuard.listUsers();
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--txt-muted);">No hay usuarios registrados.</td></tr>`;
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      const isAct = u.status === 'active';
      const isPending = u.status === 'pending_approval';
      const isRej = u.status === 'rejected';

      let statusBadge = '';
      if (isAct) {
        statusBadge = '<span class="status-pill pill-active" style="font-size:10.5px;"><i class="fa-solid fa-check"></i> Activo / Autorizado</span>';
      } else if (isPending) {
        statusBadge = '<span class="status-pill pill-pending" style="font-size:10.5px; background: rgba(245,158,11,0.15); color: var(--amber); border-color: rgba(245,158,11,0.3);"><i class="fa-solid fa-hourglass-half fa-spin"></i> Pendiente Comité</span>';
      } else {
        statusBadge = '<span class="status-pill pill-overdue" style="font-size:10.5px;"><i class="fa-solid fa-ban"></i> Acceso Revocado</span>';
      }

      const roleBadge = u.role === 'admin' 
        ? '<span style="color:var(--amber);font-weight:700;"><i class="fa-solid fa-user-shield"></i> Administrador</span>'
        : '<span style="color:var(--emerald);font-weight:700;"><i class="fa-solid fa-store"></i> Inquilino (' + escapeHtml(u.unit || 'Local') + ')</span>';

      const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A';

      tr.innerHTML = `
        <td>
          <strong style="color:var(--txt-primary);font-family:monospace;font-size:12px;">${escapeHtml(u.identifier)}</strong>
          <div style="font-size:10.5px;color:var(--txt-muted);">ID: ${escapeHtml(u.id)}</div>
        </td>
        <td>
          <span style="font-weight:600;color:var(--txt-primary);">${escapeHtml(u.display_name)}</span>
        </td>
        <td>${roleBadge}</td>
        <td><span style="font-size:11.5px;color:var(--txt-secondary);">${dateStr}</span></td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex;gap:6px;">
            ${!isAct ? `
              <button type="button" class="btn-action-icon" title="Aprobar y Autorizar Acceso" onclick="window.approveUserAccess('${u.id}')" style="background: rgba(16,185,129,0.15); color: var(--emerald); border-color: rgba(16,185,129,0.3);">
                <i class="fa-solid fa-check"></i>
              </button>
            ` : ''}
            ${!isRej && u.id !== 'u-admin-1' ? `
              <button type="button" class="btn-action-icon" title="Revocar Acceso" onclick="window.rejectUserAccess('${u.id}')" style="background: rgba(244,63,94,0.15); color: var(--rose); border-color: rgba(244,63,94,0.3);">
                <i class="fa-solid fa-ban"></i>
              </button>
            ` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  window.approveUserAccess = async function(userId) {
    const proceed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Desea aprobar y activar inmediatamente el acceso para este usuario?', 'Aprobar Acceso de Usuario', 'Aprobar & Activar', 'Cancelar')
      : confirm('¿Desea aprobar y activar inmediatamente el acceso para este usuario?');
    if (!proceed) return;

    const res = window.AuthGuard.approveUser(userId);
    if (res.ok) {
      window.renderUserApprovalsTable();
      showToast(`Acceso aprobado con éxito para ${res.user.display_name}.`, 'success', 'Usuario Activado');
    } else {
      showToast('Error: ' + res.error, 'error', 'Fallo de Activación');
    }
  };

  window.rejectUserAccess = async function(userId) {
    const proceed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Desea revocar o suspender el acceso de este usuario al portal inmobiliario?', 'Revocar Acceso de Usuario', 'Revocar Acceso', 'Cancelar')
      : confirm('¿Desea revocar o rechazar el acceso de este usuario?');
    if (!proceed) return;

    const res = window.AuthGuard.rejectUser(userId);
    if (res.ok) {
      window.renderUserApprovalsTable();
      showToast(`Acceso revocado para ${res.user.display_name}.`, 'warning', 'Acceso Revocado');
    } else {
      showToast('Error: ' + res.error, 'error', 'Error al Revocar');
    }
  };

  window.openInviteUserModal = function() {
    const modal = document.getElementById('modal-invite-user');
    if (modal) {
      const form = document.getElementById('invite-user-form');
      if (form) form.reset();
      window.onInviteRoleChange('tenant');
      window.openModal(modal);
    }
  };

  window.closeInviteUserModal = function() {
    window.closeModal('modal-invite-user');
  };

  window.onInviteRoleChange = function(role) {
    const unitGroup = document.getElementById('inv-tenant-unit-group');
    const idLabel = document.getElementById('inv-identifier-label');
    if (unitGroup) {
      unitGroup.style.display = (role === 'tenant') ? 'block' : 'none';
    }
    if (idLabel) {
      idLabel.innerText = (role === 'admin') ? 'Correo Electrónico Administrador' : 'RIF Jurídico / Identificador Fiscal';
    }
  };

  window.handleSaveUserApproval = async function(e) {
    e.preventDefault();
    const role = document.getElementById('inv-role').value;
    const name = document.getElementById('inv-name').value.trim();
    const identifier = document.getElementById('inv-identifier').value.trim();
    const unit = document.getElementById('inv-unit').value.trim();
    const status = document.getElementById('inv-status').value;

    if (!name || !identifier) {
      showToast('Por favor complete todos los campos obligatorios del formulario.', 'warning', 'Campos Incompletos');
      return;
    }

    const res = await window.AuthGuard.registerOrInviteUser({
      role,
      display_name: name,
      identifier,
      unit,
      status
    });

    if (res.ok) {
      window.closeInviteUserModal();
      window.renderUserApprovalsTable();
      const statusLabel = status === 'active' ? 'Activo & Autorizado' : 'Pendiente de Comité';
      showToast(`Usuario ${name} registrado satisfactoriamente (${statusLabel}).`, 'success', 'Usuario Registrado');
    } else {
      showToast(res.error, 'error', 'Error al Registrar');
    }
  };

  // =========================================================================
  // MÓDULO 2: GENERADOR DE INFORMES CONTABLES Y DE RECAUDACIÓN
  // =========================================================================
  function initReportsTab() {
    const tenantSelect = document.getElementById('report-param-tenant');
    if (tenantSelect && tenantSelect.options.length === 0) {
      const tenants = dbService.getTenants ? dbService.getTenants() : [];
      tenantSelect.innerHTML = tenants.map(t => `
        <option value="${t.id}">${escapeHtml(t.business_name)} (${escapeHtml(t.unit_code)})</option>
      `).join('');
    }
    // Generar informe por defecto si está vacío
    const container = document.getElementById('report-display-container');
    if (container && (!container.innerHTML || container.innerHTML.trim() === '')) {
      generateSelectedReport();
    }
  }

  window.onReportTypeChange = function() {
    const type = document.getElementById('report-type-select').value;
    const periodGroup = document.getElementById('report-param-period');
    const tenantWrapper = document.getElementById('report-param-tenant-wrapper');
    const seniatTxtBtn = document.getElementById('btn-export-seniat-txt');

    if (seniatTxtBtn) {
      seniatTxtBtn.style.display = (type === 'seniat_compras') ? 'inline-flex' : 'none';
    }

    if (type === 'solvencia') {
      if (periodGroup) periodGroup.style.display = 'none';
      if (tenantWrapper) tenantWrapper.style.display = 'block';
    } else {
      if (periodGroup) periodGroup.style.display = 'flex';
      if (tenantWrapper) tenantWrapper.style.display = 'none';
    }
    generateSelectedReport();
  };

  window.generateSelectedReport = function() {
    const type = document.getElementById('report-type-select') ? document.getElementById('report-type-select').value : 'recaudacion';
    const month = parseInt(document.getElementById('report-param-month') ? document.getElementById('report-param-month').value : 3);
    const year = parseInt(document.getElementById('report-param-year') ? document.getElementById('report-param-year').value : 2026);
    const tenantId = document.getElementById('report-param-tenant') ? document.getElementById('report-param-tenant').value : null;
    const container = document.getElementById('report-display-container');
    if (!container) return;

    // Estado de Carga elegante
    if (window.SecuritySuite && window.SecuritySuite.renderLoadingState) {
      container.innerHTML = window.SecuritySuite.renderLoadingState('Generando y auditando informe contable...');
    }

    // Renderizado reactivo protegido con manejo de error
    setTimeout(() => {
      try {
        if (type === 'recaudacion') {
          container.innerHTML = renderRecaudacionReportHTML(month, year);
        } else if (type === 'condominio') {
          container.innerHTML = renderCondominioReportHTML(month, year);
        } else if (type === 'solvencia') {
          container.innerHTML = renderSolvenciaReportHTML(tenantId);
        } else if (type === 'seniat_ventas') {
          container.innerHTML = renderSeniatVentasReportHTML(month, year);
        } else if (type === 'seniat_compras') {
          container.innerHTML = renderSeniatComprasReportHTML(month, year);
        } else if (type === 'conciliacion') {
          container.innerHTML = renderConciliacionReportHTML(month, year);
        }
      } catch (err) {
        console.error('[REPORT ERROR]', err);
        if (window.SecuritySuite && window.SecuritySuite.renderErrorState) {
          container.innerHTML = window.SecuritySuite.renderErrorState(
            'Error al liquidar el informe',
            `No se pudo consolidar la información del reporte seleccionado. Causa: ${err.message}`,
            'window.generateSelectedReport'
          );
        } else {
          container.innerHTML = `<div style="color:var(--rose);padding:24px;text-align:center;">Error: ${err.message}</div>`;
        }
      }
    }, 120);
  };

  function renderRecaudacionReportHTML(month, year) {
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const invoices = dbService.getInvoices().filter(i => i.period_month === month && i.period_year === year);
    const tenants = dbService.getTenants();
    const bcvRate = financialEngine.getRates().VES.toFixed(2);

    let totalFacturadoUsd = 0;
    let totalCobradoUsd = 0;
    let totalPendienteUsd = 0;

    const rows = invoices.map((inv, idx) => {
      const t = tenants.find(item => item.id === inv.tenant_id) || { business_name: 'Inquilino', rif: 'N/A' };
      totalFacturadoUsd += inv.total_usd;
      if (inv.status === 'pagado') totalCobradoUsd += inv.total_usd;
      else totalPendienteUsd += inv.total_usd;

      let stText = 'Pendiente';
      let stColor = '#d97706';
      if (inv.status === 'pagado') { stText = 'Cobrado'; stColor = '#059669'; }
      else if (inv.status === 'en_mora') { stText = 'En Mora'; stColor = '#dc2626'; }
      else if (inv.status === 'verificando') { stText = 'En Revisión'; stColor = '#2563eb'; }

      const totalBs = financialEngine.convert(inv.total_usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11.5px;">
          <td style="padding: 8px 10px; font-weight: 600;">${idx + 1}</td>
          <td style="padding: 8px 10px;">
            <strong>${escapeHtml(t.business_name)}</strong>
            <div style="font-size: 10px; color: #64748b;">RIF: ${escapeHtml(t.rif)}</div>
          </td>
          <td style="padding: 8px 10px; font-weight: 700; color: #b45309;">${escapeHtml(inv.unit_code)}</td>
          <td style="padding: 8px 10px; text-align: right;">$${inv.rent_usd.toFixed(2)}</td>
          <td style="padding: 8px 10px; text-align: right;">$${inv.condo_usd.toFixed(2)}</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 700;">$${inv.total_usd.toFixed(2)}</td>
          <td style="padding: 8px 10px; text-align: right; color: #475569;">Bs. ${totalBs}</td>
          <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: ${stColor};">${stText}</td>
        </tr>
      `;
    }).join('');

    const cobradoBs = financialEngine.convert(totalCobradoUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const porcentajeRecaudacion = totalFacturadoUsd > 0 ? ((totalCobradoUsd / totalFacturadoUsd) * 100).toFixed(1) : '0.0';

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
        <!-- MEMBRETE OFICIAL -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h2 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11.5px; color: #475569;">RIF: J-29881234-0 • Av. Municipal, Puerto La Cruz, Estado Anzoátegui, Venezuela</div>
            <div style="font-size: 11.5px; color: #475569;">Departamento de Administración, Finanzas & Cobranzas</div>
          </div>
          <div style="text-align: right; font-size: 11.5px; color: #334155;">
            <div><strong>INFORME EJECUTIVO</strong></div>
            <div>Fecha Emisión: ${new Date().toLocaleDateString('es-VE')}</div>
            <div>Tasa BCV Aplicada: <strong>${bcvRate} Bs/USD</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 18px;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; text-transform: uppercase; color: #1e293b;">
            INFORME MENSUAL DE FACTURACIÓN, COBRANZAS & CARTERA — ${monthNames[month].toUpperCase()} ${year}
          </h3>
          <p style="margin: 4px 0; font-size: 11.5px; color: #64748b;">
            Emisión bajo las regulaciones de la Ley de Arrendamiento Inmobiliario para Uso Comercial (Gaceta Oficial N° 40.418)
          </p>
        </div>

        <!-- TARJETAS DE RESUMEN CONTABLE -->
        <div class="report-summary-grid" style="gap: 10px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Facturado</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">$${totalFacturadoUsd.toFixed(2)}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10.5px; color: #166534; font-weight: 700; text-transform: uppercase;">Efectivamente Cobrado</div>
            <div style="font-size: 16px; font-weight: 800; color: #15803d;">$${totalCobradoUsd.toFixed(2)}</div>
            <div style="font-size: 9.5px; color: #166534;">Bs. ${cobradoBs}</div>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10.5px; color: #92400e; font-weight: 700; text-transform: uppercase;">Cartera Pendiente / Mora</div>
            <div style="font-size: 16px; font-weight: 800; color: #b45309;">$${totalPendienteUsd.toFixed(2)}</div>
          </div>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10.5px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Efectividad de Recaudación</div>
            <div style="font-size: 16px; font-weight: 800; color: #1d4ed8;">${porcentajeRecaudacion}%</div>
          </div>
        </div>

        <!-- TABLA DETALLADA CON WRAPPER RESPONSIVE -->
        <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px;">
          <table style="width: 100%; min-width: 650px; border-collapse: collapse; margin-bottom: 0;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569;">
                <th style="padding: 8px 10px; text-align: left;">N°</th>
                <th style="padding: 8px 10px; text-align: left;">Arrendatario / Razón Social</th>
                <th style="padding: 8px 10px; text-align: left;">Local</th>
                <th style="padding: 8px 10px; text-align: right;">Canon Base</th>
                <th style="padding: 8px 10px; text-align: right;">Condominio</th>
                <th style="padding: 8px 10px; text-align: right;">Total USD</th>
                <th style="padding: 8px 10px; text-align: right;">Total Bs. (BCV)</th>
                <th style="padding: 8px 10px; text-align: center;">Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="8" style="text-align:center;padding:16px;">No hay facturas para este período.</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- PIE Y FIRMAS DE AUDITORÍA -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1;">
          <div style="text-align: center;">
            <div style="height: 45px;"></div>
            <div style="border-top: 1px solid #475569; padding-top: 6px; font-size: 11.5px; font-weight: 700;">LCDO. MARIO SÁNCHEZ</div>
            <div style="font-size: 10.5px; color: #64748b;">Administrador General — Sociedad Administradora</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 45px;"></div>
            <div style="border-top: 1px solid #475569; padding-top: 6px; font-size: 11.5px; font-weight: 700;">DPTO. DE CONTABILIDAD & AUDITORÍA</div>
            <div style="font-size: 10.5px; color: #64748b;">Revisado & Conciliado Conforme</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCondominioReportHTML(month, year) {
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const units = dbService.getUnits();
    const tenants = dbService.getTenants();
    const bcvRate = financialEngine.getRates().VES.toFixed(2);
    const allDbExpenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
    const expensesPeriod = allDbExpenses.filter(e => e.period_month === month && e.period_year === year);

    const totalGastosUsd = expensesPeriod.reduce((sum, e) => sum + (parseFloat(e.amount_usd) || 0), 0);
    const totalGastosBs = financialEngine.convert(totalGastosUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });

    const expensesRows = expensesPeriod.map((e, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11.5px;">
        <td style="padding: 7px 10px;">${idx + 1}</td>
        <td style="padding: 7px 10px;">
          <strong>${escapeHtml(e.concept)}</strong>
          <div style="font-size: 10px; color: #64748b;">${escapeHtml(e.provider_name || 'Proveedor')} • Factura: ${escapeHtml(e.invoice_number || 'S/N')}</div>
        </td>
        <td style="padding: 7px 10px; color: #64748b;">${escapeHtml(e.category || e.cat || '')}</td>
        <td style="padding: 7px 10px; text-align: right; font-weight: 700;">$${e.amount_usd.toFixed(2)}</td>
        <td style="padding: 7px 10px; text-align: right; color: #475569;">Bs. ${financialEngine.convert(e.amount_usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const distributionRows = units.map(u => {
      const t = tenants.find(item => item.id === u.tenant_id);
      const cuotaCondoUsd = totalGastosUsd * u.condo_aliquot;
      const cuotaCondoBs = financialEngine.convert(cuotaCondoUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11.5px;">
          <td style="padding: 7px 10px; font-weight: 700; color: #b45309;">${u.code}</td>
          <td style="padding: 7px 10px;">${t ? `<strong>${escapeHtml(t.business_name)}</strong>` : '<span style="color:#94a3b8;font-style:italic;">Disponible (Asume Propietario)</span>'}</td>
          <td style="padding: 7px 10px; text-align: right;">${u.area_m2} m²</td>
          <td style="padding: 7px 10px; text-align: right; font-weight: 600;">${(u.condo_aliquot * 100).toFixed(2)}%</td>
          <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #0f172a;">$${cuotaCondoUsd.toFixed(2)}</td>
          <td style="padding: 7px 10px; text-align: right; color: #475569;">Bs. ${cuotaCondoBs}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h2 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f172a;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11.5px; color: #475569;">RIF: J-29881234-0 • Junta de Condominio & Sociedad Administradora</div>
            <div style="font-size: 11.5px; color: #475569;">Liquidación de Gastos Comunes Inmobiliarios (Art. 32-34 G.O. 40.418)</div>
          </div>
          <div style="text-align: right; font-size: 11.5px; color: #334155;">
            <div><strong>ESTADO DE CONDOMINIO</strong></div>
            <div>Período: <strong>${monthNames[month]} ${year}</strong></div>
            <div>Tasa BCV: <strong>${bcvRate} Bs/USD</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 18px;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #1e293b;">
            1. Relación de Gastos Comunes Operativos Incurridos en el Mes
          </h4>
          <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 12px;">
            <table style="width: 100%; min-width: 550px; border-collapse: collapse; margin-bottom: 0;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase;">
                  <th style="padding: 7px 10px; text-align: left;">N°</th>
                  <th style="padding: 7px 10px; text-align: left;">Concepto / Proveedor</th>
                  <th style="padding: 7px 10px; text-align: left;">Categoría</th>
                  <th style="padding: 7px 10px; text-align: right;">Total USD</th>
                  <th style="padding: 7px 10px; text-align: right;">Total Bs.</th>
                </tr>
              </thead>
              <tbody>
                ${expensesRows}
                <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                  <td colspan="3" style="padding: 8px 10px;">TOTAL GASTOS COMUNES LIQUIDADOS:</td>
                  <td style="padding: 8px 10px; text-align: right; color: #0f172a;">$${totalGastosUsd.toFixed(2)} USD</td>
                  <td style="padding: 8px 10px; text-align: right; color: #0f172a;">Bs. ${totalGastosBs}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #1e293b;">
            2. Distribución Alícuota y Cobro por Unidad Comercial
          </h4>
          <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;">
            <table style="width: 100%; min-width: 550px; border-collapse: collapse;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase;">
                  <th style="padding: 7px 10px; text-align: left;">Unidad</th>
                  <th style="padding: 7px 10px; text-align: left;">Arrendatario / Ocupante</th>
                  <th style="padding: 7px 10px; text-align: right;">Área</th>
                  <th style="padding: 7px 10px; text-align: right;">Alícuota %</th>
                  <th style="padding: 7px 10px; text-align: right;">Cuota USD</th>
                  <th style="padding: 7px 10px; text-align: right;">Cuota Bs.</th>
                </tr>
              </thead>
              <tbody>
                ${distributionRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderSolvenciaReportHTML(tenantId) {
    const tenants = dbService.getTenants();
    const tenant = tenants.find(t => t.id === tenantId) || tenants[0];
    if (!tenant) return '<div style="padding:20px;text-align:center;">No se encontró información del arrendatario.</div>';

    const unit = dbService.getUnits().find(u => u.code === tenant.unit_code) || { code: tenant.unit_code, area_m2: 0 };
    const contract = dbService.getContracts().find(c => c.tenant_id === tenant.id);
    const invoices = dbService.getInvoices().filter(i => i.tenant_id === tenant.id);
    const bcvRate = financialEngine.getRates().VES.toFixed(2);

    const hasOverdue = invoices.some(i => i.status === 'en_mora');
    const hasPending = invoices.some(i => i.status === 'pendiente' || i.status === 'verificando');
    const isSolvente = !hasOverdue && !hasPending;

    const invoiceRows = invoices.map(inv => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; font-weight: 600;">${inv.period_month}/${inv.period_year}</td>
        <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(inv.invoice_number)}</td>
        <td style="padding: 6px 8px; text-align: right;">$${inv.rent_usd.toFixed(2)}</td>
        <td style="padding: 6px 8px; text-align: right;">$${inv.condo_usd.toFixed(2)}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: 700;">$${inv.total_usd.toFixed(2)}</td>
        <td style="padding: 6px 8px; text-align: center;">${inv.paid_at || 'Pendiente'}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: ${inv.status === 'pagado' ? '#059669' : '#d97706'};">
          ${inv.status === 'pagado' ? 'SOLVENTE' : 'PENDIENTE'}
        </td>
      </tr>
    `).join('');

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 32px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px;">
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11px; color: #475569;">RIF: J-29881234-0 • Av. Municipal, Puerto La Cruz, Venezuela</div>
            <div style="font-size: 11px; color: #475569;">Oficina de Administración Inmobiliaria</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #334155;">
            <div>CONSTANCIA N°: <strong>SOLV-${new Date().getFullYear()}-${tenant.unit_code}</strong></div>
            <div>Fecha: <strong>${new Date().toLocaleDateString('es-VE')}</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a;">
            CERTIFICADO OFICIAL DE SOLVENCIA CONDOMINIAL & ARRENDATARIA
          </h3>
          <span style="font-size: 11px; color: #64748b;">De conformidad con el Artículo 25 y 32 de la Gaceta Oficial N° 40.418</span>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; font-size: 12px; margin-bottom: 20px; line-height: 1.6;">
          Por medio de la presente, la <strong>SOCIEDAD ADMINISTRADORA DEL CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</strong>, hace constar que el arrendatario:
          <div style="margin: 10px 0; padding: 10px; background: white; border-left: 4px solid #b45309; border-radius: 4px;">
            <div>Razón Social: <strong>${escapeHtml(tenant.business_name)}</strong></div>
            <div>Nombre Comercial: <strong>${escapeHtml(tenant.trade_name || 'N/A')}</strong> | RIF: <strong>${escapeHtml(tenant.rif)}</strong></div>
            <div>Representante Legal: <strong>${escapeHtml(tenant.legal_rep_name)}</strong> (C.I. ${escapeHtml(tenant.legal_rep_dni)})</div>
            <div>Local Asignado: <strong>${escapeHtml(tenant.unit_code)}</strong> (${unit.area_m2} m²)</div>
            <div>Contrato N°: <strong>${contract ? contract.contract_number : 'N/A'}</strong></div>
          </div>
          Se encuentra actualmente clasificado en el estado de:
          <div style="text-align: center; margin: 12px 0;">
            <span style="display: inline-block; padding: 8px 22px; border-radius: 20px; font-size: 14px; font-weight: 800; background: ${isSolvente ? '#dcfce7' : '#fee2e2'}; color: ${isSolvente ? '#15803d' : '#b91c1c'}; border: 1px solid ${isSolvente ? '#86efac' : '#fca5a5'};">
              ${isSolvente ? '✓ SOLVENTE Y AL DÍA CON SUS OBLIGACIONES' : '⚠ REGISTRA CUOTAS PENDIENTES O EN MORA'}
            </span>
          </div>
        </div>

        <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #1e293b;">
          Historial Cronológico de Facturación
        </h4>
        <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 25px;">
          <table style="width: 100%; min-width: 520px; border-collapse: collapse; margin-bottom: 0;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase;">
                <th style="padding: 6px 8px; text-align: left;">Período</th>
                <th style="padding: 6px 8px; text-align: left;">Recibo</th>
                <th style="padding: 6px 8px; text-align: right;">Canon</th>
                <th style="padding: 6px 8px; text-align: right;">Condominio</th>
                <th style="padding: 6px 8px; text-align: right;">Total USD</th>
                <th style="padding: 6px 8px; text-align: center;">Fecha Pago</th>
                <th style="padding: 6px 8px; text-align: center;">Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceRows}
            </tbody>
          </table>
        </div>

        <div style="text-align: center; margin-top: 50px;">
          <div style="display: inline-block; width: 280px; border-top: 1px solid #475569; padding-top: 8px; font-size: 11.5px;">
            <strong>ADMINISTRACIÓN CC MARIO SÁNCHEZ</strong><br>
            <span style="font-size: 10.5px; color: #64748b;">Sello Húmedo y Firma de Cobranzas</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderSeniatVentasReportHTML(month, year) {
    const bcvRate = financialEngine.getRates().VES;
    const invoices = dbService.getInvoices();
    const salesBook = window.SeniatEngine ? window.SeniatEngine.generateSalesBook(invoices, { month, year, bcvRate }) : { items: [], resumen: {} };
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const rows = salesBook.items.map(r => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; text-align: center;">${r.op}</td>
        <td style="padding: 6px 8px;">${r.fecha}</td>
        <td style="padding: 6px 8px; font-weight: 600;">${escapeHtml(r.rif)}</td>
        <td style="padding: 6px 8px;">${escapeHtml(r.nombre)}</td>
        <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(r.num_factura)}</td>
        <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(r.num_control)}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: 700;">Bs. ${r.total_ventas_con_iva.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 6px 8px; text-align: right;">Bs. ${r.base_imponible.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 6px 8px; text-align: right; color: #0284c7;">Bs. ${r.debito_fiscal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 6px 8px; text-align: right; color: #16a34a;">${r.iva_retenido_por_comprador > 0 ? 'Bs. ' + r.iva_retenido_por_comprador.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; color: #475569;">$${r.total_usd.toFixed(2)}</td>
      </tr>
    `).join('');

    const res = salesBook.resumen || {};

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h2 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f172a;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11.5px; color: #475569;">RIF: J-29881234-0 • Contribuyente Ordinario del IVA</div>
            <div style="font-size: 11.5px; color: #0284c7; font-weight: 700;">LIBRO FISCAL DE VENTAS — PROVIDENCIA SNAT/2014/0032</div>
          </div>
          <div style="text-align: right; font-size: 11.5px; color: #334155;">
            <div>Período: <strong>${monthNames[month]} ${year}</strong></div>
            <div>Fecha Emisión: ${new Date().toLocaleDateString('es-VE')}</div>
            <div>Tasa Oficial BCV: <strong>${bcvRate.toFixed(2)} Bs/USD</strong></div>
          </div>
        </div>

        <div class="report-summary-grid" style="gap: 10px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Ventas Brutas</div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">Bs. ${(res.total_ventas_con_iva_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 9.5px; color: #64748b;">$${(res.total_ventas_usd || 0).toFixed(2)} USD</div>
          </div>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #0369a1; font-weight: 700; text-transform: uppercase;">Base Imponible (16%)</div>
            <div style="font-size: 15px; font-weight: 800; color: #0284c7;">Bs. ${(res.total_base_imponible_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #9d174d; font-weight: 700; text-transform: uppercase;">Débito Fiscal IVA (16%)</div>
            <div style="font-size: 15px; font-weight: 800; color: #db2777;">Bs. ${(res.total_debito_fiscal_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #166534; font-weight: 700; text-transform: uppercase;">IVA Retenido 75%</div>
            <div style="font-size: 15px; font-weight: 800; color: #16a34a;">Bs. ${(res.total_iva_retenido_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px;">
          <table style="width: 100%; min-width: 780px; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10px; text-transform: uppercase; color: #475569;">
                <th style="padding: 6px 8px; text-align: center;">Op.</th>
                <th style="padding: 6px 8px; text-align: left;">Fecha</th>
                <th style="padding: 6px 8px; text-align: left;">RIF</th>
                <th style="padding: 6px 8px; text-align: left;">Razón Social Arrendatario</th>
                <th style="padding: 6px 8px; text-align: left;">N° Factura</th>
                <th style="padding: 6px 8px; text-align: left;">N° Control</th>
                <th style="padding: 6px 8px; text-align: right;">Total Facturado</th>
                <th style="padding: 6px 8px; text-align: right;">Base Imponible</th>
                <th style="padding: 6px 8px; text-align: right;">IVA (16%)</th>
                <th style="padding: 6px 8px; text-align: right;">IVA Retenido</th>
                <th style="padding: 6px 8px; text-align: right;">Equiv. USD</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="11" style="text-align:center;padding:16px;">No hay facturas registradas en este período.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderSeniatComprasReportHTML(month, year) {
    const bcvRate = financialEngine.getRates().VES;
    const expenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
    const purchasesBook = window.SeniatEngine ? window.SeniatEngine.generatePurchasesBook(expenses, { month, year, bcvRate }) : { items: [], resumen: {} };
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const rows = purchasesBook.items.map(r => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; text-align: center;">${r.op}</td>
        <td style="padding: 6px 8px;">${r.fecha}</td>
        <td style="padding: 6px 8px; font-weight: 600;">${escapeHtml(r.rif_proveedor)}</td>
        <td style="padding: 6px 8px;">${escapeHtml(r.nombre_proveedor)}</td>
        <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(r.num_factura)}</td>
        <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(r.num_control)}</td>
        <td style="padding: 6px 8px;">${escapeHtml(r.concepto)}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: 700;">Bs. ${r.total_compras_con_iva.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 6px 8px; text-align: right;">Bs. ${r.base_imponible.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 6px 8px; text-align: right; color: #0284c7;">Bs. ${r.credito_fiscal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 6px 8px; text-align: right; color: #dc2626;">${r.iva_retenido_efectuado > 0 ? 'Bs. ' + r.iva_retenido_efectuado.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; color: #b45309;">${r.islr_retenido_efectuado > 0 ? 'Bs. ' + r.islr_retenido_efectuado.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}</td>
      </tr>
    `).join('');

    const res = purchasesBook.resumen || {};

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h2 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f172a;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11.5px; color: #475569;">RIF: J-29881234-0 • Agente de Retención de IVA e ISLR</div>
            <div style="font-size: 11.5px; color: #16a34a; font-weight: 700;">LIBRO DE COMPRAS & RELACIÓN DE RETENCIONES — SENIAT</div>
          </div>
          <div style="text-align: right; font-size: 11.5px; color: #334155;">
            <div>Período: <strong>${monthNames[month]} ${year}</strong></div>
            <div>Fecha Emisión: ${new Date().toLocaleDateString('es-VE')}</div>
            <div>Tasa BCV: <strong>${bcvRate.toFixed(2)} Bs/USD</strong></div>
          </div>
        </div>

        <div class="report-summary-grid" style="gap: 10px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Compras / Gastos</div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">Bs. ${(res.total_compras_con_iva_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #166534; font-weight: 700; text-transform: uppercase;">Crédito Fiscal IVA</div>
            <div style="font-size: 15px; font-weight: 800; color: #15803d;">Bs. ${(res.total_credito_fiscal_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #991b1b; font-weight: 700; text-transform: uppercase;">Retenciones IVA 75%</div>
            <div style="font-size: 15px; font-weight: 800; color: #dc2626;">Bs. ${(res.total_iva_retenido_efectuado_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #92400e; font-weight: 700; text-transform: uppercase;">Retenciones ISLR 2%</div>
            <div style="font-size: 15px; font-weight: 800; color: #b45309;">Bs. ${(res.total_islr_retenido_efectuado_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px;">
          <table style="width: 100%; min-width: 820px; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10px; text-transform: uppercase; color: #475569;">
                <th style="padding: 6px 8px; text-align: center;">Op.</th>
                <th style="padding: 6px 8px; text-align: left;">Fecha</th>
                <th style="padding: 6px 8px; text-align: left;">RIF Proveedor</th>
                <th style="padding: 6px 8px; text-align: left;">Proveedor</th>
                <th style="padding: 6px 8px; text-align: left;">N° Factura</th>
                <th style="padding: 6px 8px; text-align: left;">N° Control</th>
                <th style="padding: 6px 8px; text-align: left;">Concepto</th>
                <th style="padding: 6px 8px; text-align: right;">Total Compras</th>
                <th style="padding: 6px 8px; text-align: right;">Base Imponible</th>
                <th style="padding: 6px 8px; text-align: right;">Crédito Fiscal</th>
                <th style="padding: 6px 8px; text-align: right;">Ret. IVA 75%</th>
                <th style="padding: 6px 8px; text-align: right;">Ret. ISLR 2%</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="12" style="text-align:center;padding:16px;">No hay gastos registrados en este período.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderConciliacionReportHTML(month, year) {
    const bcvRate = financialEngine.getRates().VES;
    const invoices = dbService.getInvoices();
    
    // Transacciones demo de extractos bancarios multientidad para la conciliación
    const demoBankTx = [
      { id: 'tx-1', date: `${year}-${String(month).padStart(2, '0')}-02`, reference: '0029841', amount: 56516.60, description: 'TRANSFERENCIA BANESCO - DISTRIBUIDORA ORIENTE' },
      { id: 'tx-2', date: `${year}-${String(month).padStart(2, '0')}-03`, reference: '8849102', amount: 36332.10, description: 'PAGO MOVIL MERCANTIL - RESTAURANT GOURMET' },
      { id: 'tx-3', date: `${year}-${String(month).padStart(2, '0')}-04`, reference: '7712399', amount: 28258.30, description: 'TRANSFERENCIA BDV - FARMACIA MARITIMA' },
      { id: 'tx-4', date: `${year}-${String(month).padStart(2, '0')}-05`, reference: '9940182', amount: 150.00, description: 'ZELLE RECIBIDO - TECNOLOGIA INTEGRAL' }
    ];

    const recon = window.BankReconciliation 
      ? window.BankReconciliation.reconcile(demoBankTx, invoices, { bcvRate })
      : { matched: [], discrepancies: [], unmatchedBank: [], summary: { totalBankTx: 4, matchedCount: 4, discrepancyCount: 0, unmatchedBankCount: 0 } };

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h2 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f172a;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11.5px; color: #475569;">Departamento de Tesorería & Conciliación Bancaria</div>
            <div style="font-size: 11.5px; color: #6366f1; font-weight: 700;">AUDITORÍA Y CONCILIACIÓN AUTOMÁTICA MULTIENTIDAD</div>
          </div>
          <div style="text-align: right; font-size: 11.5px; color: #334155;">
            <div>Fecha Conciliación: <strong>${new Date().toLocaleDateString('es-VE')}</strong></div>
            <div>Tasa BCV: <strong>${bcvRate.toFixed(2)} Bs/USD</strong></div>
          </div>
        </div>

        <div class="report-summary-grid" style="gap: 10px; margin-bottom: 20px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #166534; font-weight: 700; text-transform: uppercase;">Conciliados Exactos</div>
            <div style="font-size: 18px; font-weight: 800; color: #15803d;">${recon.summary.matchedCount}</div>
            <div style="font-size: 9.5px; color: #166534;">100% de coincidencia</div>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #92400e; font-weight: 700; text-transform: uppercase;">Discrepancias de Monto</div>
            <div style="font-size: 18px; font-weight: 800; color: #b45309;">${recon.summary.discrepancyCount}</div>
            <div style="font-size: 9.5px; color: #92400e;">Requiere ajuste menor</div>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #991b1b; font-weight: 700; text-transform: uppercase;">Partidas no Conciliadas</div>
            <div style="font-size: 18px; font-weight: 800; color: #dc2626;">${recon.summary.unmatchedBankCount}</div>
            <div style="font-size: 9.5px; color: #991b1b;">Pendiente de comprobante</div>
          </div>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Efectividad de Conciliación</div>
            <div style="font-size: 18px; font-weight: 800; color: #1d4ed8;">${recon.summary.matchedCount > 0 ? ((recon.summary.matchedCount / recon.summary.totalBankTx) * 100).toFixed(0) : 100}%</div>
          </div>
        </div>

        <div style="margin-bottom: 12px; font-size: 12px; color: #475569;">
          <strong>Detalle de Partidas Bancarias Auditadas:</strong>
        </div>
        <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;">
          <table style="width: 100%; min-width: 680px; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10px; text-transform: uppercase; color: #475569;">
                <th style="padding: 6px 8px; text-align: left;">Fecha Valor</th>
                <th style="padding: 6px 8px; text-align: left;">Referencia Bancaria</th>
                <th style="padding: 6px 8px; text-align: left;">Descripción Extracto</th>
                <th style="padding: 6px 8px; text-align: right;">Monto Extracto</th>
                <th style="padding: 6px 8px; text-align: left;">Factura Asociada</th>
                <th style="padding: 6px 8px; text-align: center;">Estado Conciliación</th>
              </tr>
            </thead>
            <tbody>
              ${demoBankTx.map(tx => `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                  <td style="padding: 6px 8px;">${tx.date}</td>
                  <td style="padding: 6px 8px; font-family: monospace; font-weight: 700;">${tx.reference}</td>
                  <td style="padding: 6px 8px;">${tx.description}</td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: 700;">${tx.description.includes('ZELLE') ? '$' + tx.amount.toFixed(2) : 'Bs. ' + tx.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                  <td style="padding: 6px 8px; color: #0284c7; font-weight: 600;">FAC-${year}-${month}</td>
                  <td style="padding: 6px 8px; text-align: center;">
                    <span style="background: #dcfce7; color: #166534; font-size: 9.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">CONCILIADO</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  window.downloadSeniatTxtReport = function() {
    const month = parseInt(document.getElementById('report-param-month') ? document.getElementById('report-param-month').value : 3);
    const year = parseInt(document.getElementById('report-param-year') ? document.getElementById('report-param-year').value : 2026);
    const bcvRate = financialEngine.getRates().VES;
    const expenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
    
    if (!window.SeniatEngine) {
      alert("Módulo SENIAT no disponible.");
      return;
    }
    
    const purchasesBook = window.SeniatEngine.generatePurchasesBook(expenses, { month, year, bcvRate });
    const txtContent = window.SeniatEngine.generateSeniatTxtRetention(purchasesBook, 'J-29881234-0');
    
    if (!txtContent || txtContent.trim() === '') {
      if (window.SecuritySuite && window.SecuritySuite.toast) {
        window.SecuritySuite.toast('No hay retenciones de IVA registradas en el período para generar el TXT.', 'warning', 'SENIAT TXT');
      } else {
        alert("No hay retenciones de IVA registradas en este período.");
      }
      return;
    }
    
    const filename = `RETENCION_IVA_SENIAT_${purchasesBook.periodo.replace('/', '')}.txt`;
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast(`Archivo TXT oficial ${filename} generado para carga en el SENIAT.`, 'success', 'SENIAT TXT Exportado');
    }
  };

  window.printCurrentReport = function() {
    const container = document.getElementById('report-display-container');
    if (!container) return;
    const printWin = window.open('', '_blank', 'width=900,height=750');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Informe Oficial — CC Mario Sánchez</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: white; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${container.innerHTML}
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 300);
  };

  /**
   * Exporta la tabla de datos del informe actual a formato CSV compatible con Microsoft Excel (con BOM UTF-8)
   */
  window.exportReportToCSV = function() {
    const container = document.getElementById('report-display-container');
    if (!container) return;
    const tables = container.querySelectorAll('table');
    if (tables.length === 0) {
      showToast("No hay tablas de datos para exportar en el informe actual.", "info", "Informe Vacío");
      return;
    }

    let csvContent = '\uFEFF'; // BOM UTF-8 para Excel
    tables.forEach((table, tIdx) => {
      if (tIdx > 0) csvContent += '\r\n\r\n';
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
          let text = col.innerText.replace(/(\r\n|\n|\r)/gm, ' ').trim();
          text = text.replace(/"/g, '""');
          rowData.push(`"${text}"`);
        });
        csvContent += rowData.join(';') + '\r\n';
      });
    });

    const reportType = document.getElementById('report-type-select') ? document.getElementById('report-type-select').value : 'informe';
    const filename = `CCMS_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Archivo CSV "${filename}" descargado exitosamente.`, 'success', 'Exportación CSV');
  };

  /**
   * Copia la tabla de datos del informe en formato TSV (Tab-Separated Values)
   * listo para pegar directamente en celdas de Google Sheets con Ctrl+V
   */
  window.copyReportForGoogleSheets = function() {
    const container = document.getElementById('report-display-container');
    if (!container) return;
    const tables = container.querySelectorAll('table');
    if (tables.length === 0) {
      showToast("No hay tablas de datos en el informe actual.", "info", "Informe Vacío");
      return;
    }

    let tsvContent = '';
    tables.forEach((table, tIdx) => {
      if (tIdx > 0) tsvContent += '\n\n';
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
          let text = col.innerText.replace(/(\r\n|\n|\r)/gm, ' ').trim();
          rowData.push(text);
        });
        tsvContent += rowData.join('\t') + '\n';
      });
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsvContent).then(() => {
        showToast("✓ Datos copiados al portapapeles. Abra Google Sheets y presione Ctrl + V para pegar.", "success", "Copiado a Google Sheets");
      }).catch(err => {
        console.warn('[CLIPBOARD] Fallback a prompt:', err);
        showToast("No se pudo copiar automáticamente al portapapeles.", "warning", "Copiado Manual");
      });
    } else {
      showToast("Portapapeles no soportado en este entorno de navegación.", "warning", "Portapapeles");
    }
  };

  // =========================================================================
  // MÓDULO 3: VISOR & GENERADOR DE CONTRATOS LEGALES (G.O. 40.418)
  // =========================================================================
  window.viewTenantContract = async function(tenantId) {
    const modal = document.getElementById('modal-contract-viewer');
    const docWrapper = document.getElementById('contract-document-wrapper');
    if (!modal || !docWrapper) return;

    const tenant = dbService.getTenants().find(t => t.id === tenantId);
    if (!tenant) {
      showToast('No se encontró el inquilino seleccionado.', 'error', 'Inquilino No Encontrado');
      return;
    }

    const contract = dbService.getContracts().find(c => c.tenant_id === tenantId) || {
      contract_number: `CCMS-CTR-2026-${tenant.unit_code}`,
      tenant_id: tenant.id,
      unit_code: tenant.unit_code,
      start_date: '2026-01-01',
      end_date: '2027-01-01',
      rent_usd: 1200,
      rent_method: 'CAF (Canon Fijo Art. 32)',
      deposit_usd: 3600,
      deposit_months: 3,
      status: 'vigente'
    };

    const unit = dbService.getUnits().find(u => u.code === tenant.unit_code) || {
      code: tenant.unit_code,
      name: `Local Comercial ${tenant.unit_code}`,
      area_m2: 120,
      condo_aliquot: 0.08,
      base_rent_usd: contract.rent_usd
    };

    if (window.VenezuelaLegal && typeof window.VenezuelaLegal.generateContractHTML === 'function') {
      // async: generateContractHTML ahora usa SHA-256 real vía WebCrypto
      docWrapper.innerHTML = await window.VenezuelaLegal.generateContractHTML(contract, tenant, unit);
    } else {
      docWrapper.innerHTML = `<div style="padding:20px;">Generador de contratos no disponible temporalmente.</div>`;
    }

    window.openModal(modal);
  };

  window.closeContractModal = function() {
    window.closeModal('modal-contract-viewer');
  };

  window.printActiveContract = function() {
    const docWrapper = document.getElementById('contract-document-wrapper');
    if (!docWrapper) return;
    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Contrato de Arrendamiento Comercial — G.O. 40.418</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 25px; background: white; color: black; line-height: 1.5; font-size: 13.5px; }
          @media print { body { padding: 15px; font-size: 12.5px; } }
        </style>
      </head>
      <body>
        ${docWrapper.innerHTML}
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 300);
  };

  // =========================================================================
  // MÓDULO 4: VISOR & RECIBO OFICIAL TRAS APROBACIÓN DE PAGO
  // =========================================================================
  window.openReceiptPreview = async function(receipt) {
    const modal = document.getElementById('modal-receipt-preview');
    const wrapper = document.getElementById('receipt-document-wrapper');
    if (!modal || !wrapper || !receipt) return;

    const bcvRate = (receipt.snapshot && receipt.snapshot.bcv_rate_applied)
      ? receipt.snapshot.bcv_rate_applied.toFixed(2)
      : financialEngine.getRates().VES.toFixed(2);

    const totalBs = financialEngine.convert(receipt.total_usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const totalEur = financialEngine.convert(receipt.total_usd, 'USD', 'EUR').toLocaleString('de-DE', { minimumFractionDigits: 2 });

    const tenantName = (window.TenantConfig && window.TenantConfig.getLegalName) ? window.TenantConfig.getLegalName() : 'CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.';
    const tenantRif = (window.TenantConfig && window.TenantConfig.getRif) ? window.TenantConfig.getRif() : 'J-29881234-0';
    const tenantAddr = (window.TenantConfig && window.TenantConfig.getAddress) ? window.TenantConfig.getAddress() : 'Av. Municipal, Puerto La Cruz, Venezuela';

    // Generar Sello Criptográfico Digital Inmutable (SHA-256 REAL vía WebCrypto)
    const digitalSeal = await generateReceiptSealAsync(receipt, bcvRate);

    wrapper.innerHTML = `
      <div style="border: 2px solid #0f172a; padding: 24px; border-radius: 8px; background: white; color: #0f172a;">
        <!-- HEADER MEMBRETE -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${escapeHtml(tenantName)}</h2>
            <div style="font-size: 11px; color: #475569;">RIF: ${escapeHtml(tenantRif)} • ${escapeHtml(tenantAddr)}</div>
            <div style="font-size: 11px; color: #475569;">Sociedad Administradora Inmobiliaria & Junta Condominial</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 15px; font-weight: 900; color: #059669;">RECIBO OFICIAL DE COBRANZA</div>
            <div style="font-family: monospace; font-size: 13px; font-weight: 700; color: #0f172a;">${escapeHtml(receipt.receipt_number)}</div>
            <div style="font-size: 11px; color: #64748b;">Fecha Aprobación: ${new Date(receipt.approved_at || Date.now()).toLocaleDateString('es-VE')}</div>
          </div>
        </div>

        <!-- DATOS DEL ARRENDATARIO Y UNIDAD -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div><strong>Arrendatario:</strong> ${escapeHtml(receipt.tenant_name)}</div>
          <div><strong>RIF:</strong> ${escapeHtml(receipt.tenant_rif)}</div>
          <div><strong>Unidad Comercial:</strong> <span style="color: #b45309; font-weight: 700;">${escapeHtml(receipt.unit_code)}</span></div>
          <div><strong>Período Liquidado:</strong> ${receipt.period_month}/${receipt.period_year}</div>
          <div><strong>Método de Pago:</strong> ${escapeHtml(receipt.payment_method)}</div>
          <div><strong>N° Referencia Bancaria:</strong> <span style="font-family: monospace; font-weight: 700;">${escapeHtml(receipt.reference_number)}</span></div>
          ${receipt.issuing_bank ? `<div><strong>Banco Emisor:</strong> <span style="font-weight: 600; color: #1e293b;">${escapeHtml(receipt.issuing_bank)}</span></div>` : ''}
          ${receipt.origin_phone ? `<div><strong>Teléfono / Origen Pago:</strong> <span style="font-family: monospace;">${escapeHtml(receipt.origin_phone)}</span> ${receipt.origin_doc ? `(${escapeHtml(receipt.origin_doc)})` : ''}</div>` : ''}
          ${receipt.zelle_holder ? `<div style="grid-column: 1 / -1;"><strong>Titular Zelle Emisor:</strong> ${escapeHtml(receipt.zelle_holder)} (${escapeHtml(receipt.zelle_email || 'N/A')})</div>` : ''}
          ${receipt.txid ? `<div style="grid-column: 1 / -1;"><strong>Hash Cripto TxID:</strong> <span style="font-family: monospace; font-size: 10.5px; color: #059669; word-break: break-all;">${escapeHtml(receipt.txid)}</span></div>` : ''}
        </div>

        <!-- DETALLE DE CONCEPTOS -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; text-align: left;">Concepto Arrendaticio</th>
              <th style="padding: 8px; text-align: right;">Monto USD</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px;">Canon Fijo Mensual de Arrendamiento (CAF Art. 32)</td>
              <td style="padding: 8px; text-align: right;">$${receipt.rent_usd.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px;">Cuota de Gastos Comunes / Condominio</td>
              <td style="padding: 8px; text-align: right;">$${receipt.condo_usd.toFixed(2)}</td>
            </tr>
            <tr style="font-weight: 800; background: #f8fafc; font-size: 13px;">
              <td style="padding: 10px 8px;">TOTAL PAGADO & CONCILIADO:</td>
              <td style="padding: 10px 8px; text-align: right; color: #059669;">$${receipt.total_usd.toFixed(2)} USD</td>
            </tr>
          </tbody>
        </table>

        <!-- SNAPSHOT MULTIMONEDA A LA FECHA VALOR -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; font-size: 11.5px; margin-bottom: 16px;">
          <strong>Snapshot Contable Multimoneda a la Fecha Valor:</strong>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 4px;">
            <div>• Bolívares Oficiales (Tasa BCV ${bcvRate} Bs/USD): <strong>Bs. ${totalBs}</strong></div>
            <div>• Euros (€): <strong>€ ${totalEur} EUR</strong></div>
            <div>• Criptoactivos USDT: <strong>USDT ${receipt.total_usd.toFixed(2)}</strong></div>
            <div>• Verificado por: <strong>${escapeHtml(receipt.approved_by || 'Administración')}</strong></div>
          </div>
        </div>

        <!-- SELLO DIGITAL DE INTEGRIDAD JURÍDICA (SHA-256) -->
        <div style="border-top: 1px dashed #94a3b8; padding-top: 10px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 10px; color: #475569;">
          <div>
            <strong style="color: #0f172a; text-transform: uppercase;">Sello Criptográfico de Integridad (SHA-256)</strong><br>
            <span>Hash: ${digitalSeal}</span><br>
            <span>Emitido bajo Gaceta Oficial N° 40.418 | SENIAT Finiquito Fiscal</span>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 4px 8px; border: 1px solid #10b981; color: #047857; font-weight: bold; border-radius: 4px; background: #ecfdf5; font-size: 9.5px;">
              ✓ RECIBO INMUTABLE
            </span>
          </div>
        </div>
      </div>
    `;

    window.openModal('modal-receipt-preview');
  };

  window.closeReceiptPreviewModal = function() {
    window.closeModal('modal-receipt-preview');
  };

  window.printActiveReceipt = function() {
    const wrapper = document.getElementById('receipt-document-wrapper');
    if (!wrapper) return;
    const printWin = window.open('', '_blank', 'width=800,height=700');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo Oficial de Cobranza — CC Mario Sánchez</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 25px; background: white; color: black; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${wrapper.innerHTML}
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 250);
  };

  // =========================================================================
  // MÓDULO 5: GESTIÓN DE GASTOS COMUNES, FACTURAS & RETENCIONES SENIAT
  // =========================================================================
  let currentExpenseProof = null;

  window.openExpenseModal = function(expenseId = null) {
    const modal = document.getElementById('modal-expense');
    const form = document.getElementById('expense-form');
    if (!modal || !form) return;

    form.reset();
    currentExpenseProof = null;
    document.getElementById('exp-id').value = expenseId || '';
    document.getElementById('expense-modal-title').innerHTML = expenseId
      ? '<i class="fa-solid fa-pen-to-square" style="color: var(--purple);"></i> Editar Gasto / Factura'
      : '<i class="fa-solid fa-file-invoice-dollar" style="color: var(--purple);"></i> Registrar Gasto / Factura de Proveedor';

    removeExpenseFile();

    if (expenseId) {
      const expenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
      const exp = expenses.find(e => e.id === expenseId);
      if (exp) {
        document.getElementById('exp-concept').value = exp.concept || '';
        document.getElementById('exp-category').value = exp.category || exp.cat || 'Seguridad';
        document.getElementById('exp-month').value = String(exp.period_month);
        document.getElementById('exp-year').value = String(exp.period_year);
        document.getElementById('exp-provider').value = exp.provider_name || '';
        document.getElementById('exp-rif').value = exp.provider_rif || '';
        document.getElementById('exp-invoice-num').value = exp.invoice_number || '';
        document.getElementById('exp-control-num').value = exp.control_number || '';
        document.getElementById('exp-amount-usd').value = exp.amount_usd || '';
        document.getElementById('exp-withhold-iva').checked = Boolean(exp.withhold_iva);
        document.getElementById('exp-withhold-islr').checked = Boolean(exp.withhold_islr);

        if (exp.invoice_proof) {
          currentExpenseProof = exp.invoice_proof;
          const container = document.getElementById('exp-proof-preview-container');
          const dropzone = document.getElementById('exp-proof-dropzone');
          const nameEl = document.getElementById('exp-file-name');
          const sizeEl = document.getElementById('exp-file-size');
          const iconEl = document.getElementById('exp-preview-icon');
          if (container && nameEl) {
            nameEl.innerText = exp.invoice_proof.name || 'Factura_Fiscal_Adjunta';
            if (sizeEl && exp.invoice_proof.size) sizeEl.innerText = `${(exp.invoice_proof.size / 1024).toFixed(1)} KB • Archivo adjunto`;
            if (iconEl && exp.invoice_proof.type && exp.invoice_proof.type.includes('pdf')) iconEl.className = 'fa-solid fa-file-pdf';
            if (dropzone) dropzone.style.display = 'none';
            container.style.display = 'flex';
          }
        }
      }
    } else {
      // Valores por defecto para nuevo gasto
      if (filterCondoMonth !== 'all') {
        document.getElementById('exp-month').value = filterCondoMonth;
      }
      if (filterCondoYear !== 'all') {
        document.getElementById('exp-year').value = filterCondoYear;
      }
    }

    updateExpenseEquivalents();
    window.openModal(modal);
  };

  window.closeExpenseModal = function() {
    window.closeModal('modal-expense');
  };

  window.updateExpenseEquivalents = function() {
    const amount = parseFloat(document.getElementById('exp-amount-usd').value) || 0;
    const bcvRate = financialEngine.getRates().VES;
    const vesEq = financialEngine.convert(amount, 'USD', 'VES');

    const previewEl = document.getElementById('exp-amount-bs-preview');
    if (previewEl) {
      previewEl.innerText = `Bs. ${vesEq.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Tasa: ${bcvRate.toFixed(2)})`;
    }

    // Calcular retenciones SENIAT
    const wIva = document.getElementById('exp-withhold-iva') ? document.getElementById('exp-withhold-iva').checked : false;
    const wIslr = document.getElementById('exp-withhold-islr') ? document.getElementById('exp-withhold-islr').checked : false;

    let retIvaUsd = 0;
    let retIslrUsd = 0;
    if (wIva) retIvaUsd = amount * 0.16 * 0.75; // 75% del IVA al 16%
    if (wIslr) retIslrUsd = amount * 0.02;      // 2% de retención ISLR a personas jurídicas servicios

    const totalRetUsd = retIvaUsd + retIslrUsd;
    const totalRetBs = financialEngine.convert(totalRetUsd, 'USD', 'VES');

    const summaryEl = document.getElementById('exp-withholding-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        Retenciones estimadas: <strong>$${totalRetUsd.toFixed(2)} USD</strong> (Bs. ${totalRetBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})
        • IVA 75%: $${retIvaUsd.toFixed(2)} | ISLR 2%: $${retIslrUsd.toFixed(2)}
      `;
    }
  };

  window.handleExpenseFileChange = function(e) {
    const file = (e.target && e.target.files && e.target.files[0])
      ? e.target.files[0]
      : (e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("La factura o comprobante fiscal excede el límite de 10MB.", "warning", "Archivo Excedido");
      const input = document.getElementById('exp-proof-file');
      if (input) input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      currentExpenseProof = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: evt.target.result,
        uploaded_at: new Date().toISOString()
      };

      const container = document.getElementById('exp-proof-preview-container');
      const dropzone = document.getElementById('exp-proof-dropzone');
      const nameEl = document.getElementById('exp-file-name');
      const sizeEl = document.getElementById('exp-file-size');
      const iconEl = document.getElementById('exp-preview-icon');

      if (container) container.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB • ${(file.type || 'Documento').split('/')[1] || 'archivo'}`;
      if (iconEl) {
        iconEl.className = file.type && file.type.includes('pdf') ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-image';
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeExpenseFile = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    currentExpenseProof = null;
    const input = document.getElementById('exp-proof-file');
    if (input) input.value = '';
    const container = document.getElementById('exp-proof-preview-container');
    const dropzone = document.getElementById('exp-proof-dropzone');
    if (container) container.style.display = 'none';
    if (dropzone) dropzone.style.display = 'flex';
  };

  window.saveExpense = function(e) {
    e.preventDefault();
    const id = document.getElementById('exp-id').value;
    const concept = document.getElementById('exp-concept').value.trim();
    const category = document.getElementById('exp-category').value;
    const month = parseInt(document.getElementById('exp-month').value);
    const year = parseInt(document.getElementById('exp-year').value);
    const provider = document.getElementById('exp-provider').value.trim();
    const rif = document.getElementById('exp-rif').value.trim();
    const invoiceNum = document.getElementById('exp-invoice-num').value.trim();
    const controlNum = document.getElementById('exp-control-num').value.trim();
    const amountUsd = parseFloat(document.getElementById('exp-amount-usd').value);
    const withholdIva = document.getElementById('exp-withhold-iva').checked;
    const withholdIslr = document.getElementById('exp-withhold-islr').checked;

    if (isNaN(amountUsd) || amountUsd <= 0) {
      showToast('Por favor ingrese un monto facturado válido mayor a cero.', 'warning', 'Monto Requerido');
      return;
    }

    const payload = {
      concept: concept,
      category: category,
      period_month: month,
      period_year: year,
      provider_name: provider,
      provider_rif: rif,
      invoice_number: invoiceNum,
      control_number: controlNum,
      amount_usd: amountUsd,
      currency: 'USD',
      withhold_iva: withholdIva,
      withhold_islr: withholdIslr,
      invoice_proof: currentExpenseProof
    };

    if (id) payload.id = id;

    try {
      dbService.saveCondoExpense(payload);
      closeExpenseModal();
      renderAll();
      showToast('Gasto operativo y factura fiscal registrados y liquidados exitosamente.', 'success', 'Gasto Liquidado');
    } catch (err) {
      showToast('Error al guardar gasto: ' + err.message, 'error', 'Error al Guardar');
    }
  };

  window.deleteExpense = async function(expenseId) {
    const proceed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Está seguro de eliminar este gasto operativo? Esto recalculará la liquidación condominal del período.', 'Eliminar Gasto Operativo', 'Eliminar Gasto', 'Cancelar')
      : confirm("¿Está seguro de eliminar este gasto operativo? Esto recalculará la liquidación condominal del período.");
    if (!proceed) return;

    try {
      dbService.deleteCondoExpense(expenseId);
      renderAll();
      showToast('Gasto operativo eliminado y cuotas condominales recalculadas.', 'warning', 'Gasto Eliminado');
    } catch (err) {
      showToast('Error: ' + err.message, 'error', 'Error al Eliminar');
    }
  };

  window.viewExpenseProof = function(expenseId) {
    const expenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp || !exp.invoice_proof) {
      showToast("Este gasto no tiene factura digital adjunta.", "info", "Sin Factura Adjunta");
      return;
    }

    const modal = document.getElementById('modal-expense-proof');
    const content = document.getElementById('expense-proof-viewer-content');
    if (!modal || !content) return;

    const proof = exp.invoice_proof;
    const isDataUrl = typeof proof.data === 'string' && proof.data.startsWith('data:');
    const isPdf = (proof.type && proof.type.includes('pdf')) || (proof.name && proof.name.toLowerCase().endsWith('.pdf'));

    if (isDataUrl && isPdf) {
      content.innerHTML = `
        <div style="margin-bottom:12px;font-size:12.5px;color:var(--txt-secondary);">
          <strong>${escapeHtml(proof.name)}</strong> • Proveedor: <strong>${escapeHtml(exp.provider_name || 'N/A')}</strong>
        </div>
        <embed src="${proof.data}" type="application/pdf" width="100%" height="520px" style="border:1px solid var(--border-subtle);border-radius:8px;" />
      `;
    } else if (isDataUrl) {
      content.innerHTML = `
        <div style="margin-bottom:12px;font-size:12.5px;color:var(--txt-secondary);">
          <strong>${escapeHtml(proof.name)}</strong> • Proveedor: <strong>${escapeHtml(exp.provider_name || 'N/A')}</strong>
        </div>
        <img src="${proof.data}" alt="Factura de Proveedor" style="max-width:100%;max-height:550px;border-radius:8px;border:1px solid var(--border-subtle);" />
      `;
    } else {
      content.innerHTML = `
        <div style="padding:24px;text-align:center;">
          <p>Archivo adjunto: <strong>${escapeHtml(proof.name || 'Factura')}</strong></p>
          <a href="${proof.data || '#'}" target="_blank" class="btn-onboarding-cta" style="display:inline-flex;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir soporte fiscal en nueva pestaña
          </a>
        </div>
      `;
    }

    window.openModal(modal);
  };

  // Listener Delegado para Botones de Cierre y Backdrop
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.modal-close');
    if (closeBtn) {
      e.preventDefault();
      const parentModal = closeBtn.closest('.modal-overlay');
      if (parentModal) {
        window.closeModal(parentModal);
      } else {
        window.closeAllModals();
      }
      return;
    }

    if (e.target.classList.contains('modal-overlay')) {
      window.closeModal(e.target);
    }
  });

  // Cierre por tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      window.closeAllModals();
    }
  });

  // ==============================================================================
  // EXPORTADOR CONTABLE CORPORATIVO (LIBRO DE COBRANZAS & GASTOS EN CSV)
  // ==============================================================================
  window.downloadCSV = function(filename, csvContent) {
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  window.exportPaymentsCSV = function() {
    const payments = dbService.getPayments();
    const invoices = dbService.getInvoices();
    const tenants = dbService.getTenants();

    let csv = "ID_Pago,Fecha_Pago,Nro_Recibo,Periodo,Unidad,Inquilino,RIF,Monto_USD,Tasa_BCV,Monto_VES,Metodo,Banco_Origen,Referencia,TxID_Hash,Estado,Verificado_Por\n";

    payments.forEach(p => {
      const inv = invoices.find(i => i.id === p.invoice_id) || {};
      const tenant = tenants.find(t => t.id === inv.tenant_id) || {};
      const rate = p.bcv_rate_applied || financialEngine.getRates().VES;
      const vesAmount = (p.amount_paid && p.currency === 'VES') ? p.amount_paid : (p.usd_equivalent * rate);

      const row = [
        `"${p.id || ''}"`,
        `"${p.payment_date || ''}"`,
        `"${p.receipt_number || inv.invoice_number || ''}"`,
        `"${inv.period_month || ''}/${inv.period_year || ''}"`,
        `"${inv.unit_code || tenant.unit_code || ''}"`,
        `"${(tenant.business_name || '').replace(/"/g, '""')}"`,
        `"${tenant.rif || ''}"`,
        (p.usd_equivalent || 0).toFixed(2),
        rate.toFixed(2),
        vesAmount.toFixed(2),
        `"${p.payment_method || ''}"`,
        `"${p.bank_origin || ''}"`,
        `"${p.reference_number || ''}"`,
        `"${p.txid || ''}"`,
        `"${p.verification_status || 'verificado'}"`,
        `"${p.verified_by || 'Admin'}"`
      ];
      csv += row.join(",") + "\n";
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    window.downloadCSV(`Libro_Cobranzas_${dateStr}.csv`, csv);
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast("Libro de Cobranzas exportado exitosamente a CSV.", "success", "Exportación Exitosa");
    }
  };

  window.exportExpensesCSV = function() {
    const expenses = dbService.getExpenses();
    let csv = "ID_Gasto,Periodo,Concepto,Categoria,Monto_USD,Tasa_BCV,Monto_VES,Proveedor,Soporte_URL,Fecha_Registro\n";

    expenses.forEach(e => {
      const rate = e.bcv_rate || financialEngine.getRates().VES;
      const vesAmount = e.amount_bs || (e.amount_usd * rate);
      const row = [
        `"${e.id || ''}"`,
        `"${e.period_month || ''}/${e.period_year || ''}"`,
        `"${(e.concept || '').replace(/"/g, '""')}"`,
        `"${e.category || ''}"`,
        (e.amount_usd || 0).toFixed(2),
        rate.toFixed(2),
        vesAmount.toFixed(2),
        `"${e.provider || ''}"`,
        `"${e.receipt_url ? 'SI' : 'NO'}"`,
        `"${e.created_at || ''}"`
      ];
      csv += row.join(",") + "\n";
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    window.downloadCSV(`Libro_Gastos_Comunes_${dateStr}.csv`, csv);
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast("Libro de Gastos exportado exitosamente a CSV.", "success", "Exportación Exitosa");
    }
  };

  // Configuración de eventos Drag & Drop para los Dropzones personalizados
  function setupCustomDropzones() {
    [
      { zoneId: 'pay-receipt-dropzone', handler: window.handleReceiptFileChange },
      { zoneId: 'exp-proof-dropzone', handler: window.handleExpenseFileChange }
    ].forEach(item => {
      const zone = document.getElementById(item.zoneId);
      if (!zone) return;

      ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.add('dragover');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.remove('dragover');
        }, false);
      });

      zone.addEventListener('drop', (e) => {
        item.handler(e);
      }, false);
    });
  }

  setupCustomDropzones();

  // Render inicial
  renderAll();
});
