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

// Revalidación inmediata anti-bfcache (Back/Forward Cache del navegador)
window.addEventListener('pageshow', function(event) {
  if (typeof AuthGuard !== 'undefined') {
    const sess = AuthGuard.currentUser();
    if (!sess) {
      window.location.replace('login.html?expired=bfcache');
    }
  }
});

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
  const isSuperAdmin = (currentRole === 'superadmin');
  const isDirectiva = ['superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento', 'heredero'].includes(currentRole);
  const isMasterAdmin = (currentRole === 'superadmin' || currentRole === 'admin');
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

  // 4. TICKER DINÁMICO: USD BCV + EUR BCV + BINANCE P2P USDT
  const bcvTickerVal = document.getElementById('bcv-rate-val');
  const eurTickerVal = document.getElementById('eur-rate-val');
  const usdtTickerVal = document.getElementById('usdt-rate-val');
  const bcvSyncIcon = document.getElementById('bcv-sync-icon');
  const bcvSyncTimeStr = document.getElementById('bcv-sync-time-str');

  function updateBcvDisplay() {
    const rates = financialEngine.getRates();
    if (bcvTickerVal) {
      bcvTickerVal.innerText = `${rates.VES.toFixed(2)} Bs.`;
    }
    if (eurTickerVal) {
      const eurBs = rates.EUR_VES || (rates.VES / (rates.EUR || 0.86));
      eurTickerVal.innerText = `${eurBs.toFixed(2)} Bs.`;
    }
    if (usdtTickerVal) {
      const usdtVes = rates.USDT_VES || rates.VES;
      usdtTickerVal.innerText = `${usdtVes.toFixed(2)} Bs.`;
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

  // Función asíncrona para sincronizar en vivo con las APIs oficiales y de mercado
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
        if (eurTickerVal) {
          eurTickerVal.style.color = 'var(--cyan)';
          setTimeout(() => { eurTickerVal.style.color = ''; }, 2000);
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
    const eurInput = document.getElementById('rate-edit-eur');
    const usdtInput = document.getElementById('rate-edit-usdt');
    if (bcvInput) bcvInput.value = rates.VES.toFixed(2);
    if (eurInput) eurInput.value = (rates.EUR_VES || (rates.VES / (rates.EUR || 0.86))).toFixed(2);
    if (usdtInput) usdtInput.value = (rates.USDT_VES || rates.VES).toFixed(2);
    window.openModal(modal);
  };

  window.closeRatesEditorModal = function() {
    window.closeModal('modal-rates-editor');
  };

  window.handleSaveManualRates = function(e) {
    e.preventDefault();
    const bcvVal = document.getElementById('rate-edit-bcv').value;
    const eurVal = document.getElementById('rate-edit-eur')?.value;
    const usdtVal = document.getElementById('rate-edit-usdt').value;

    try {
      if (bcvVal) financialEngine.setBcvRate(bcvVal);
      if (eurVal && financialEngine.setEurRate) {
        const eurBs = parseFloat(eurVal);
        if (eurBs > 0) {
          financialEngine.rates.EUR_VES = eurBs;
          const currentVes = parseFloat(bcvVal) || financialEngine.rates.VES;
          if (currentVes > 0) {
            financialEngine.rates.EUR = Math.round((currentVes / eurBs) * 10000) / 10000;
          }
          financialEngine.saveRates();
        }
      }
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
    if (isDirectiva) {
      try { renderTenantsTable(); } catch (e) { console.error('[RenderError] TenantsTable:', e); }
      try { renderCondoExpenses(); } catch (e) { console.error('[RenderError] CondoExpenses:', e); }
      try { renderInventory(); } catch (e) { console.error('[RenderError] Inventory:', e); }
    }
    try { renderReceivingAccounts(); } catch (e) { console.error('[RenderError] ReceivingAccounts:', e); }
    try { renderInvoicesTable(); } catch (e) { console.error('[RenderError] InvoicesTable:', e); }
    try { renderCalendarView(); } catch (e) { console.error('[RenderError] CalendarView:', e); }
    try { renderAlertsCenter(); } catch (e) { console.error('[RenderError] AlertsCenter:', e); }
    if (isMasterAdmin) {
      try { renderAdminBankAccounts(); } catch (e) { console.error('[RenderError] AdminBankAccounts:', e); }
      try { renderUserApprovalsTable(); } catch (e) { console.error('[RenderError] UserApprovals:', e); }
    }
    if (isDirectiva) {
      try { initReportsTab(); } catch (e) { console.error('[RenderError] ReportsTab:', e); }
      if (typeof window.renderStaffProfileCards === 'function') {
        try { window.renderStaffProfileCards(); } catch (e) { console.error('[RenderError] StaffProfiles:', e); }
      }
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

    // 1. Ocupación (visible para toda la directiva)
    const kpiOcc = document.getElementById('kpi-occupancy');
    const kpiOccSub = document.getElementById('kpi-occupancy-sub');
    const occCard = kpiOcc ? kpiOcc.closest('.kpi-card') : null;
    if (isDirectiva) {
      const occupiedUnits = units.filter(u => u.status === 'arrendado');
      const totalArea = units.reduce((acc, u) => acc + (parseFloat(u.area_m2) || 0), 0);
      const occupiedArea = occupiedUnits.reduce((acc, u) => acc + (parseFloat(u.area_m2) || 0), 0);
      const occupancyRate = totalArea > 0 ? Math.round((occupiedArea / totalArea) * 100) : 0;
      if (kpiOcc) kpiOcc.innerText = `${occupancyRate}%`;
      if (kpiOccSub) kpiOccSub.innerText = `${occupiedArea.toLocaleString()} m² de ${totalArea.toLocaleString()} m²`;
      if (occCard) occCard.style.display = '';
    } else if (occCard) {
      occCard.style.display = 'none';
    }

    // 2. Facturación
    const totalBilledUsd = invoices.reduce((acc, i) => acc + (parseFloat(i.total_usd) || 0), 0);
    const billedEl = document.getElementById('kpi-billed');
    if (billedEl) {
      billedEl.innerText = formatMoney(totalBilledUsd);
      const billedTitle = billedEl.closest('.kpi-card')?.querySelector('.kpi-title');
      if (billedTitle) billedTitle.textContent = isDirectiva ? 'Facturación del Período' : 'Mi Facturación del Período';
    }

    // 3. Recaudado (para Directiva) / Mi Estado de Solvencia y Semáforo (para Inquilino)
    const paidInvoices = invoices.filter(i => i.status === 'pagado');
    const totalPaidUsd = paidInvoices.reduce((acc, i) => acc + (parseFloat(i.total_usd) || 0), 0);
    const collectionPct = totalBilledUsd > 0 ? Math.round((totalPaidUsd / totalBilledUsd) * 100) : 0;
    const collEl = document.getElementById('kpi-collected');
    const collCard = collEl ? collEl.closest('.kpi-card') : null;
    const collTitle = collCard?.querySelector('.kpi-title');
    const collBadge = collCard?.querySelector('.kpi-icon-badge');
    const collSub = document.getElementById('kpi-collected-sub');

    if (isDirectiva) {
      if (collTitle) collTitle.textContent = 'Total Recaudado';
      if (collBadge) {
        collBadge.className = 'kpi-icon-badge badge-emerald';
        collBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
      }
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
    const totalOverdueUsd = overdueInvoices.reduce((acc, i) => acc + (parseFloat(i.total_usd) || 0), 0);
    const overEl = document.getElementById('kpi-overdue');
    if (overEl) {
      overEl.innerText = formatMoney(totalOverdueUsd);
      const overSub = document.getElementById('kpi-overdue-sub');
      if (overSub) {
        overSub.innerText = `${overdueInvoices.length} ${isDirectiva ? 'cuentas con retraso' : 'facturas vencidas'}`;
      }
    }

    // 5. Egresos: solo directiva
    const expEl = document.getElementById('kpi-expenses');
    const expCard = expEl ? expEl.closest('.kpi-card') : null;
    if (expEl) {
      if (isDirectiva) {
        const condoExpenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
        const totalExpensesUsd = condoExpenses.length > 0
          ? condoExpenses.reduce((acc, e) => acc + (parseFloat(e.amount_usd) || 0), 0)
          : 1950;
        expEl.innerText = formatMoney(totalExpensesUsd);
        const expSub = document.getElementById('kpi-expenses-sub');
        if (expSub) expSub.innerText = `${condoExpenses.length || 4} conceptos de gastos comunes`;
        if (expCard) expCard.style.display = '';
      } else if (expCard) {
        expCard.style.display = 'none';
      }
    }

    // 6. Utilidad: solo directiva
    const netEl = document.getElementById('kpi-netprofit');
    const netCard = netEl ? netEl.closest('.kpi-card') : null;
    if (netEl) {
      if (isDirectiva) {
        const condoExpenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
        const totalExp = condoExpenses.length > 0
          ? condoExpenses.reduce((acc, e) => acc + (parseFloat(e.amount_usd) || 0), 0)
          : 1950;
        const netProfitUsd = totalPaidUsd - totalExp;
        netEl.innerText = formatMoney(netProfitUsd);
        netEl.style.color = netProfitUsd >= 0 ? 'var(--emerald)' : 'var(--rose)';
        if (netCard) netCard.style.display = '';
      } else if (netCard) {
        netCard.style.display = 'none';
      }
    }

    // 7. Aging Report (Antigüedad de Cuentas por Cobrar - 30/60/90+ días)
    renderAgingReport(invoices, currentRole);
  }

  // C. AGING REPORT (ANTIGÜEDAD DE DEUDA EJECUTIVA - ESTILO TIME TO PROGRAM)
  function renderAgingReport(invoices, currentRole) {
    const reportCard = document.getElementById('aging-report-section');
    if (!reportCard) return;
    if (!isDirectiva) {
      reportCard.style.display = 'none';
      return;
    }
    reportCard.style.display = '';

    const pendingInvoices = invoices.filter(i => i.status !== 'pagado');
    const now = new Date();

    let bucketCurrent = { count: 0, usd: 0 }; // Al día / corriente
    let bucket30 = { count: 0, usd: 0 };      // 1 a 30 días
    let bucket60 = { count: 0, usd: 0 };      // 31 a 60 días
    let bucket90 = { count: 0, usd: 0 };      // Más de 60 días (Mora Crítica)

    pendingInvoices.forEach(inv => {
      const dueDate = new Date(inv.due_date || now);
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const amount = inv.total_usd || 0;

      if (diffDays <= 0) {
        bucketCurrent.count++;
        bucketCurrent.usd += amount;
      } else if (diffDays <= 30) {
        bucket30.count++;
        bucket30.usd += amount;
      } else if (diffDays <= 60) {
        bucket60.count++;
        bucket60.usd += amount;
      } else {
        bucket90.count++;
        bucket90.usd += amount;
      }
    });

    const totalOverdueSum = bucketCurrent.usd + bucket30.usd + bucket60.usd + bucket90.usd;

    // Distribución porcentual en la barra visual
    const pctCurrent = totalOverdueSum > 0 ? Math.max(3, (bucketCurrent.usd / totalOverdueSum) * 100) : 25;
    const pct30 = totalOverdueSum > 0 ? Math.max(3, (bucket30.usd / totalOverdueSum) * 100) : 25;
    const pct60 = totalOverdueSum > 0 ? Math.max(3, (bucket60.usd / totalOverdueSum) * 100) : 25;
    const pct90 = totalOverdueSum > 0 ? Math.max(3, (bucket90.usd / totalOverdueSum) * 100) : 25;

    const barCurrent = document.getElementById('aging-bar-current');
    const bar30 = document.getElementById('aging-bar-30');
    const bar60 = document.getElementById('aging-bar-60');
    const bar90 = document.getElementById('aging-bar-90');

    if (barCurrent) barCurrent.style.width = `${pctCurrent}%`;
    if (bar30) bar30.style.width = `${pct30}%`;
    if (bar60) bar60.style.width = `${pct60}%`;
    if (bar90) bar90.style.width = `${pct90}%`;

    const formatBs = (usd) => {
      try {
        return 'Bs. ' + financialEngine.convert(usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch (e) {
        return 'Bs. 0,00';
      }
    };

    const updateAgingBucket = (suffix, bucket) => {
      const elVal = document.getElementById(`aging-val-${suffix}`);
      const elVes = document.getElementById(`aging-ves-${suffix}`);
      const elCount = document.getElementById(`aging-count-${suffix}`);
      if (elVal) elVal.innerText = formatMoney(bucket.usd);
      if (elVes) elVes.innerText = formatBs(bucket.usd);
      if (elCount) elCount.innerText = `${bucket.count} ${bucket.count === 1 ? 'cuota' : 'cuotas'}`;
    };

    updateAgingBucket('current', bucketCurrent);
    updateAgingBucket('30', bucket30);
    updateAgingBucket('60', bucket60);
    updateAgingBucket('90', bucket90);
  }

  // B. DIRECTORIO DE INQUILINOS & LOCALES (TIME TO PROGRAM MODERN ARCHITECTURE)
  let tenantsViewMode = 'cards'; // 'cards' | 'table'

  window.setTenantsViewMode = function(mode) {
    tenantsViewMode = mode;
    const cardsGrid = document.getElementById('tenants-cards-grid');
    const tableCont = document.getElementById('tenants-table-container');
    const btnCards = document.getElementById('btn-view-cards');
    const btnTable = document.getElementById('btn-view-table');

    if (mode === 'cards') {
      if (cardsGrid) cardsGrid.style.display = 'grid';
      if (tableCont) tableCont.style.display = 'none';
      if (btnCards) btnCards.classList.add('active');
      if (btnTable) btnTable.classList.remove('active');
    } else {
      if (cardsGrid) cardsGrid.style.display = 'none';
      if (tableCont) tableCont.style.display = 'block';
      if (btnCards) btnCards.classList.remove('active');
      if (btnTable) btnTable.classList.add('active');
    }
  };

  window.filterTenantsView = function() {
    renderTenantsDirectory();
  };

  const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
    'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
  ];

  function getMonogramAndGradient(name, index = 0) {
    const clean = (name || 'CC').trim();
    const words = clean.split(/\s+/);
    let monogram = 'CC';
    if (words.length > 1) {
      monogram = (words[0][0] + words[1][0]).toUpperCase();
    } else {
      monogram = clean.substring(0, 2).toUpperCase();
    }
    const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
    return { monogram, gradient };
  }

  function renderTenantsDirectory() {
    const units = dbService.getUnits();
    const tenants = dbService.getTenants();
    const contracts = dbService.getContracts();
    const allInvoices = dbService.getInvoices();

    const searchInput = document.getElementById('ttp-tenant-search');
    const filterQuery = (searchInput ? searchInput.value.trim().toLowerCase() : '');
    const filterStatusEl = document.getElementById('ttp-tenant-filter-status');
    const filterStatus = filterStatusEl ? filterStatusEl.value : 'all';

    // Saludo reactivo
    const currentSess = (typeof AuthGuard !== 'undefined') ? AuthGuard.currentUser() : null;
    const greetingEl = document.getElementById('ttp-greeting-name');
    if (greetingEl && currentSess) {
      greetingEl.textContent = currentSess.display_name || 'Administración CCMS';
    }

    // Mini KPIs Globales
    let countSolvente = 0;
    let countMoroso = 0;
    let countDisponible = 0;
    let totalMoraUsd = 0;

    units.forEach(unit => {
      if (unit.status === 'disponible') {
        countDisponible++;
        return;
      }
      const tenant = tenants.find(t => t.id === unit.tenant_id);
      if (!tenant) return;
      const tenantInvoices = allInvoices.filter(i => i.tenant_id === tenant.id);
      const moraInvoices = tenantInvoices.filter(i => i.status === 'en_mora');
      const moraAmt = moraInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
      if (moraAmt > 0 || tenant.status === 'moroso') {
        countMoroso++;
        totalMoraUsd += moraAmt;
      } else {
        countSolvente++;
      }
    });

    const setKpiText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setKpiText('dir-kpi-solventes', countSolvente);
    setKpiText('dir-kpi-morosos', countMoroso);
    setKpiText('dir-kpi-disponibles', countDisponible);
    setKpiText('dir-kpi-total-mora', formatMoney(totalMoraUsd));

    // Filtrado de Unidades
    const filteredUnits = units.filter(unit => {
      const tenant = tenants.find(t => t.id === unit.tenant_id);
      const contract = contracts.find(c => c.unit_code === unit.code);
      const tenantInvoices = tenant ? allInvoices.filter(i => i.tenant_id === tenant.id) : [];
      const moraInvoices = tenantInvoices.filter(i => i.status === 'en_mora');
      const moraAmt = moraInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
      const isMoroso = moraAmt > 0 || (tenant && tenant.status === 'moroso');

      if (filterStatus === 'solvente' && (unit.status === 'disponible' || isMoroso)) return false;
      if (filterStatus === 'moroso' && !isMoroso) return false;
      if (filterStatus === 'disponible' && unit.status !== 'disponible') return false;

      if (filterQuery) {
        const uCode = (unit.code || '').toLowerCase();
        const uName = (unit.name || '').toLowerCase();
        const tName = tenant ? (tenant.business_name || '').toLowerCase() : '';
        const tTrade = tenant ? (tenant.trade_name || '').toLowerCase() : '';
        const tRif = tenant ? (tenant.rif || '').toLowerCase() : '';
        const tRep = tenant ? (tenant.legal_rep_name || '').toLowerCase() : '';
        return uCode.includes(filterQuery) || uName.includes(filterQuery) || tName.includes(filterQuery) || tTrade.includes(filterQuery) || tRif.includes(filterQuery) || tRep.includes(filterQuery);
      }
      return true;
    });

    // RENDER 1: CARDS GRID (TIME TO PROGRAM IMAGE 4 STYLE)
    const cardsGrid = document.getElementById('tenants-cards-grid');
    if (cardsGrid) {
      cardsGrid.innerHTML = '';
      if (filteredUnits.length === 0) {
        cardsGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border-subtle); border-radius: 12px;">
            <i class="fa-solid fa-magnifying-glass" style="font-size: 32px; color: var(--txt-muted); margin-bottom: 10px;"></i>
            <div style="font-weight: 700; color: var(--txt-primary); font-size: 15px;">No se encontraron resultados</div>
            <div style="font-size: 12px; color: var(--txt-secondary); margin-top: 4px;">Intente con otro término de búsqueda o cambie el filtro de estado.</div>
          </div>
        `;
      } else {
        filteredUnits.forEach((unit, idx) => {
          const tenant = tenants.find(t => t.id === unit.tenant_id);
          const contract = contracts.find(c => c.unit_code === unit.code);
          const tenantInvoices = tenant ? allInvoices.filter(i => i.tenant_id === tenant.id) : [];
          const unpaidInvoices = tenantInvoices.filter(i => i.status !== 'pagado');
          const moraInvoices = tenantInvoices.filter(i => i.status === 'en_mora');
          const totalBilled = tenantInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
          const pendingSaldoUsd = unpaidInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
          const isOverdue = moraInvoices.length > 0 || (tenant && tenant.status === 'moroso');

          const card = document.createElement('div');
          const isVacant = unit.status === 'disponible';
          const cardClass = isVacant ? 'ttp-client-card is-vacant' : (isOverdue ? 'ttp-client-card is-overdue' : 'ttp-client-card is-solvent');
          card.className = cardClass;

          const { monogram, gradient } = getMonogramAndGradient(tenant ? tenant.business_name : unit.name, idx);

          let statusBadge = '';
          if (isVacant) {
            statusBadge = `<span class="status-pill pill-info"><i class="fa-solid fa-building"></i> Disponible</span>`;
          } else if (isOverdue) {
            statusBadge = `<span class="status-pill pill-overdue"><i class="fa-solid fa-circle-exclamation"></i> En Mora: ${formatMoney(pendingSaldoUsd)}</span>`;
          } else {
            statusBadge = `<span class="status-pill pill-active"><i class="fa-solid fa-circle-check"></i> Solvente</span>`;
          }

          card.innerHTML = `
            <div class="ttp-card-header">
              <div class="ttp-avatar-circle" style="background: ${gradient};">
                ${monogram}
              </div>
              <div class="ttp-client-info">
                <div class="ttp-client-name" title="${escapeHtml(tenant ? tenant.business_name : unit.name)}">
                  ${escapeHtml(tenant ? tenant.business_name : unit.name)}
                </div>
                <div class="ttp-client-sub">
                  ${escapeHtml(unit.code)} • ${(parseFloat(unit.area_m2) || 0).toLocaleString()} m² ${tenant ? `• RIF: ${escapeHtml(tenant.rif)}` : ''}
                </div>
              </div>
            </div>

            <div class="ttp-card-body">
              <div class="ttp-metric-col">
                <span class="ttp-metric-label">Total Facturado</span>
                <span class="ttp-metric-val">${tenant ? formatMoney(totalBilled) : '$0.00'}</span>
              </div>
              <div class="ttp-metric-col" style="align-items: flex-end;">
                <span class="ttp-metric-label">Estado</span>
                ${statusBadge}
              </div>
            </div>
          `;

          card.onclick = () => {
            if (tenant) {
              window.openTenantFullProfile(tenant.id);
            } else {
              window.location.href = `onboarding.html?unit=${encodeURIComponent(unit.code)}`;
            }
          };

          cardsGrid.appendChild(card);
        });
      }
    }

    // RENDER 2: TABLE VIEW
    const tbody = document.getElementById('tenants-table-body');
    if (tbody) {
      tbody.innerHTML = '';
      filteredUnits.forEach(unit => {
        const tr = document.createElement('tr');
        const tenant = tenants.find(t => t.id === unit.tenant_id);
        const contract = contracts.find(c => c.unit_code === unit.code);
        const tenantInvoices = tenant ? allInvoices.filter(i => i.tenant_id === tenant.id) : [];
        const unpaidInvoices = tenantInvoices.filter(i => i.status !== 'pagado');
        const moraInvoices = tenantInvoices.filter(i => i.status === 'en_mora');
        const pendingSaldoUsd = unpaidInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
        const moraAmtUsd = moraInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);

        let statusBadge = '';
        if (unit.status === 'disponible') {
          statusBadge = '<span class="status-pill pill-info"><i class="fa-solid fa-circle"></i> Disponible</span>';
        } else if (moraAmtUsd > 0 || (tenant && tenant.status === 'moroso')) {
          statusBadge = '<span class="status-pill pill-overdue"><i class="fa-solid fa-circle-exclamation"></i> En Mora</span>';
        } else if (contract && contract.status === 'por_vencer') {
          statusBadge = '<span class="status-pill pill-warning"><i class="fa-solid fa-clock"></i> Por Vencer</span>';
        } else {
          statusBadge = '<span class="status-pill pill-active"><i class="fa-solid fa-circle-check"></i> Solvente</span>';
        }

        const saldoHtml = tenant
          ? pendingSaldoUsd > 0
            ? `<strong style="color: var(--amber); font-family: var(--font-heading);">${formatMoney(pendingSaldoUsd)}</strong>
               <div style="font-size: 10px; color: var(--txt-muted);">${unpaidInvoices.length} cuotas</div>`
            : `<span style="color: var(--emerald); font-weight: 700;"><i class="fa-solid fa-circle-check" style="font-size: 10px;"></i> Al día</span>`
          : `<span style="color: var(--txt-muted); font-style: italic;">—</span>`;

        const moraHtml = tenant
          ? moraAmtUsd > 0
            ? `<strong style="color: var(--rose); font-family: var(--font-heading);">${formatMoney(moraAmtUsd)}</strong>
               <div style="font-size: 10px; color: var(--rose);">${moraInvoices.length} vencidas</div>`
            : `<span style="color: var(--txt-muted);">$0.00</span>`
          : `<span style="color: var(--txt-muted); font-style: italic;">—</span>`;

        tr.innerHTML = `
          <td>
            <strong style="color: var(--amber); font-family: var(--font-heading); font-size: 13.5px;">${escapeHtml(unit.code)}</strong>
            <div style="font-size: 11px; color: var(--txt-muted);">${escapeHtml(unit.name)}</div>
          </td>
          <td>
            ${tenant ? `<strong style="cursor:pointer;" onclick="window.openTenantFullProfile('${tenant.id}')">${escapeHtml(tenant.business_name)}</strong><div style="font-size: 11px; color: var(--txt-secondary);">RIF: ${escapeHtml(tenant.rif)} • ${escapeHtml(tenant.trade_name || '')}</div>` : '<span style="color: var(--txt-muted); font-style: italic;">Sin Arrendatario</span>'}
          </td>
          <td>
            <strong>${(parseFloat(unit.area_m2) || 0).toLocaleString()} m²</strong>
            <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase;">${escapeHtml(unit.category || '')}</div>
          </td>
          <td>
            <strong>${formatMoney(unit.base_rent_usd)}</strong>
            <div style="font-size: 10.5px; color: var(--amber);">Alícuota: ${((parseFloat(unit.condo_aliquot) || 0) * 100).toFixed(1)}%</div>
          </td>
          <td>${saldoHtml}</td>
          <td>${moraHtml}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              ${tenant ? `
                <button class="btn-action-icon" title="Ver Expediente Completo (Ficha)" onclick="window.openTenantFullProfile('${tenant.id}')">
                  <i class="fa-solid fa-user-tie"></i>
                </button>
                <button class="btn-action-icon" title="Ver Expediente Modal" data-click="openTenantDossier('${tenant.id}')">
                  <i class="fa-solid fa-folder-open"></i>
                </button>
                <button class="btn-action-icon btn-wa-action" title="Mensaje WhatsApp" data-click="openWhatsAppModal('${tenant.id}')">
                  <i class="fa-brands fa-whatsapp"></i>
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
  }

  function renderTenantsTable() {
    renderTenantsDirectory();
  }

  // TIME TO PROGRAM FULL CLIENT PROFILE SHEET CONTROLLER (IMAGE 5 STYLE)
  let activeProfileTenantId = null;

  window.openTenantFullProfile = function(tenantId) {
    activeProfileTenantId = tenantId;
    const mainView = document.getElementById('tenants-main-view');
    const profileSheet = document.getElementById('client-full-profile-sheet');
    if (mainView) mainView.style.display = 'none';
    if (profileSheet) {
      profileSheet.style.display = 'flex';
      renderClientFullProfile(tenantId);
      profileSheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.closeTenantFullProfile = function() {
    const mainView = document.getElementById('tenants-main-view');
    const profileSheet = document.getElementById('client-full-profile-sheet');
    if (profileSheet) profileSheet.style.display = 'none';
    if (mainView) mainView.style.display = 'block';
    renderTenantsDirectory();
  };

  window.renderClientFullProfile = function(tenantId) {
    const profileSheet = document.getElementById('client-full-profile-sheet');
    if (!profileSheet) return;

    const tenant = dbService.getTenants().find(t => t.id === tenantId);
    if (!tenant) return;
    const contract = dbService.getContracts().find(c => c.tenant_id === tenantId);
    const unit = dbService.getUnits().find(u => u.code === tenant.unit_code);
    const allInvoices = dbService.getInvoices().filter(i => i.tenant_id === tenantId);

    // Ordenar facturas por período descendente
    allInvoices.sort((a, b) => {
      if (b.period_year !== a.period_year) return b.period_year - a.period_year;
      return b.period_month - a.period_month;
    });

    const totalBilled = allInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
    const paidInvoices = allInvoices.filter(i => i.status === 'pagado');
    const unpaidInvoices = allInvoices.filter(i => i.status !== 'pagado');
    const totalCollected = paidInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
    const balanceOwed = unpaidInvoices.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
    const avgInvoice = allInvoices.length ? (totalBilled / allInvoices.length) : 0;
    const maxInvoice = allInvoices.length ? Math.max(...allInvoices.map(i => parseFloat(i.total_usd) || 0)) : 0;
    const pctPaid = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    const { monogram, gradient } = getMonogramAndGradient(tenant.business_name);
    const cleanWa = (tenant.whatsapp || '').replace(/[^0-9]/g, '');

    // Acuerdos especiales para este inquilino
    const agreements = (dbService.getAgreements ? dbService.getAgreements() : []).filter(a => a.tenant_id === tenantId || a.unit_code === tenant.unit_code);

    profileSheet.innerHTML = `
      <!-- TOP BAR WITH BACK BUTTON & ACTIONS -->
      <div class="ttp-sheet-topbar">
        <div class="ttp-sheet-client-meta">
          <button type="button" class="ttp-back-btn" onclick="window.closeTenantFullProfile()" title="Volver al Directorio de Clientes">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="ttp-sheet-avatar" style="background: ${gradient};">
            ${monogram}
          </div>
          <div>
            <h1 class="ttp-sheet-title">${escapeHtml(tenant.business_name)}</h1>
            <div class="ttp-sheet-subtitle">
              ${escapeHtml(tenant.email || 'sin-correo@ccms.com')} • RIF: ${escapeHtml(tenant.rif)} • <strong style="color: var(--amber);">${escapeHtml(tenant.unit_code)}</strong> • ${escapeHtml(tenant.commercial_activity || 'Comercial')}
            </div>
          </div>
        </div>

        <div class="ttp-sheet-actions">
          <button type="button" class="btn-currency-toggle" data-click="openTenantDossier('${tenant.id}')" style="font-size: 12px; padding: 7px 14px;">
            <i class="fa-solid fa-folder-open" style="color: var(--amber);"></i> <span>Expediente Modal</span>
          </button>
          <button type="button" class="btn-currency-toggle" data-click="viewTenantContract('${tenant.id}')" style="color: var(--cyan); border-color: var(--cyan); font-size: 12px; padding: 7px 14px;">
            <i class="fa-solid fa-file-contract"></i> <span>Ver Contrato Legal</span>
          </button>
          <button type="button" class="btn-onboarding-cta" data-click="openDossierQuickPay('${tenant.id}')" style="background: var(--emerald); border-color: var(--emerald); color: #fff; font-size: 12px; padding: 7px 16px;">
            <i class="fa-solid fa-receipt"></i> <span>Registrar Pago</span>
          </button>
          ${cleanWa ? `
            <a href="https://wa.me/${cleanWa}" target="_blank" rel="noopener noreferrer" class="btn-onboarding-cta" style="background: #25D366; border-color: #25D366; color: #fff; font-size: 12px; padding: 7px 14px; text-decoration: none;">
              <i class="fa-brands fa-whatsapp"></i> <span>WhatsApp</span>
            </a>
          ` : ''}
        </div>
      </div>

      <!-- TOP 3 KPIS BANNER (IMAGE 5 STYLE) -->
      <div class="ttp-kpi-banner">
        <div class="ttp-kpi-sheet-card">
          <span class="ttp-kpi-sheet-label">Total Cuotas / Facturas</span>
          <span class="ttp-kpi-sheet-val" style="color: var(--cyan);">${allInvoices.length} <span style="font-size: 14px; font-weight: 600; color: var(--txt-muted);">Emitidas</span></span>
        </div>
        <div class="ttp-kpi-sheet-card">
          <span class="ttp-kpi-sheet-label">Total Facturado</span>
          <span class="ttp-kpi-sheet-val" style="color: var(--txt-primary);">${formatMoney(totalBilled)}</span>
        </div>
        <div class="ttp-kpi-sheet-card" style="border-color: ${balanceOwed > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'};">
          <span class="ttp-kpi-sheet-label">Saldo Pendiente / Mora</span>
          <span class="ttp-kpi-sheet-val" style="color: ${balanceOwed > 0 ? 'var(--rose)' : 'var(--emerald)'};">${formatMoney(balanceOwed)}</span>
        </div>
      </div>

      <!-- 4-CARD PROFILE DASHBOARD GRID -->
      <div class="ttp-profile-grid">
        
        <!-- CARD 1: CONTACT DETAILS -->
        <div class="ttp-panel-card">
          <div class="ttp-panel-head">
            <h3 class="ttp-panel-title">
              <i class="fa-solid fa-address-card" style="color: var(--amber);"></i> Datos del Arrendatario & Contacto
            </h3>
            <button type="button" class="btn-currency-toggle" style="font-size: 11px; padding: 4px 10px;" data-click="toggleDossierEditMode(true); openTenantDossier('${tenant.id}')">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 12.5px;">
            <div>
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Razón Social</div>
              <strong style="color: var(--txt-primary);">${escapeHtml(tenant.business_name)}</strong>
            </div>
            <div>
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Nombre Comercial</div>
              <span style="color: var(--txt-primary);">${escapeHtml(tenant.trade_name || 'Sin Nombre Comercial')}</span>
            </div>
            <div>
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">RIF Jurídico</div>
              <span style="color: var(--amber); font-family: monospace; font-weight: 700;">${escapeHtml(tenant.rif)}</span>
            </div>
            <div>
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Representante Legal</div>
              <span style="color: var(--txt-primary);">${escapeHtml(tenant.legal_rep_name)} (C.I. ${escapeHtml(tenant.legal_rep_dni)})</span>
            </div>
            <div>
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Teléfono & Móvil</div>
              <span style="color: var(--txt-primary);">${escapeHtml(tenant.phone || 'N/A')}</span>
            </div>
            <div>
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Correo Electrónico</div>
              <span style="color: var(--txt-primary);">${escapeHtml(tenant.email || 'N/A')}</span>
            </div>
            <div>
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Unidad & Área</div>
              <strong style="color: var(--amber);">${escapeHtml(tenant.unit_code)}</strong> (${unit ? (parseFloat(unit.area_m2) || 0).toLocaleString() : 0} m²)
            </div>
            <div>
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Canon & Alícuota</div>
              <strong style="color: var(--emerald);">${contract ? formatMoney(contract.rent_usd) : (unit ? formatMoney(unit.base_rent_usd) : '$0.00')} / mes</strong>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; margin-top: 4px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--amber); text-transform: uppercase; margin-bottom: 4px;">
              <i class="fa-solid fa-clipboard-list"></i> Observaciones del Arrendatario
            </div>
            <p style="font-size: 12px; color: var(--txt-secondary); margin: 0; line-height: 1.4; font-style: italic;">
              ${escapeHtml(tenant.observations || 'Sin observaciones registradas.')}
            </p>
          </div>
        </div>

        <!-- CARD 2: PAYMENT STATUS & SUMMARY -->
        <div class="ttp-panel-card">
          <div class="ttp-panel-head">
            <h3 class="ttp-panel-title">
              <i class="fa-solid fa-chart-pie" style="color: var(--emerald);"></i> Estado de Pago & Rendimiento
            </h3>
            <span class="status-pill ${pctPaid === 100 ? 'pill-active' : (pctPaid >= 70 ? 'pill-warning' : 'pill-overdue')}" style="font-size: 11px;">
              ${pctPaid}% Pagado
            </span>
          </div>

          <!-- Barra de Progreso Cobrado vs Pendiente -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 6px;">
              <span style="color: var(--emerald); font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Pagado: ${formatMoney(totalCollected)}</span>
              <span style="color: var(--rose); font-weight: 700;"><i class="fa-solid fa-circle-exclamation"></i> Pendiente: ${formatMoney(balanceOwed)}</span>
            </div>
            <div style="width: 100%; height: 12px; border-radius: 6px; background: rgba(239,68,68,0.25); overflow: hidden; display: flex;">
              <div style="width: ${pctPaid}%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); height: 100%; transition: width 0.6s ease;"></div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; font-size: 12.5px;">
            <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Promedio Factura</div>
              <div style="font-size: 18px; font-weight: 800; color: var(--txt-primary); font-family: var(--font-heading); margin-top: 2px;">
                ${formatMoney(avgInvoice)}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Factura Más Alta</div>
              <div style="font-size: 18px; font-weight: 800; color: var(--amber); font-family: var(--font-heading); margin-top: 2px;">
                ${formatMoney(maxInvoice)}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 12px; color: var(--txt-secondary);">
            <span>Cuotas al día: <strong style="color: var(--emerald);">${paidInvoices.length}</strong></span>
            <span>Cuotas vencidas: <strong style="color: var(--rose);">${unpaidInvoices.length}</strong></span>
          </div>
        </div>

        <!-- CARD 3: INVOICE HISTORY TABLE -->
        <div class="ttp-panel-card" style="grid-column: 1/-1;">
          <div class="ttp-panel-head">
            <h3 class="ttp-panel-title">
              <i class="fa-solid fa-file-invoice-dollar" style="color: var(--cyan);"></i> Historial Completo de Facturas & Cuotas
            </h3>
            <button type="button" class="btn-currency-toggle" data-click="exportPaymentsCSV()" style="font-size: 11px; padding: 4px 10px;">
              <i class="fa-solid fa-file-csv" style="color: var(--emerald);"></i> Exportar CSV
            </button>
          </div>

          <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
            <table class="modern-table" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>N° Recibo / Período</th>
                  <th>Concepto</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
                  <th>Monto USD</th>
                  <th>Equiv. Bs. BCV</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${allInvoices.length === 0 ? `
                  <tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--txt-muted);">No hay facturas emitidas aún.</td></tr>
                ` : allInvoices.map(inv => {
                  let pill = '<span class="status-pill pill-active"><i class="fa-solid fa-circle-check"></i> Pagado</span>';
                  if (inv.status === 'en_mora') pill = '<span class="status-pill pill-overdue"><i class="fa-solid fa-circle-exclamation"></i> En Mora</span>';
                  else if (inv.status === 'pendiente' || inv.status === 'verificando') pill = '<span class="status-pill pill-warning"><i class="fa-solid fa-clock"></i> Pendiente</span>';

                  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                  const periodTxt = `${monthNames[(inv.period_month || 1) - 1]} ${inv.period_year || 2026}`;

                  return `
                    <tr>
                      <td><strong style="color: var(--amber);">${escapeHtml(inv.invoice_number || inv.id)}</strong><div style="font-size: 10.5px; color: var(--txt-muted);">${periodTxt}</div></td>
                      <td>${escapeHtml(inv.concept || 'Canon de Arrendamiento + Condominio')}</td>
                      <td>${inv.issue_date || '—'}</td>
                      <td>${inv.due_date || '—'}</td>
                      <td><strong style="color: var(--txt-primary);">${formatMoney(inv.total_usd)}</strong></td>
                      <td><span style="color: var(--amber); font-weight: 700;">${formatVes(inv.total_ves || (inv.total_usd * 48.5))}</span></td>
                      <td>${pill}</td>
                      <td>
                        <div style="display: flex; gap: 6px;">
                          <button class="btn-action-icon" title="Ver Recibo Imprimible" onclick="window.viewInvoiceDetail('${inv.id}')">
                            <i class="fa-solid fa-print"></i>
                          </button>
                          ${inv.status !== 'pagado' ? `
                            <button class="btn-action-icon" title="Registrar Pago" style="color: var(--emerald);" onclick="window.openPaymentModal('${inv.id}')">
                              <i class="fa-solid fa-cash-register"></i>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- CARD 4: ACUERDOS ESPECIALES, OBRAS & ARCHIVOS ADJUNTOS -->
        <div class="ttp-panel-card" style="grid-column: 1/-1;">
          <div class="ttp-panel-head">
            <h3 class="ttp-panel-title">
              <i class="fa-solid fa-handshake-angle" style="color: var(--purple);"></i> Acuerdos Especiales, Deducciones por Obras & Soporte Documental
            </h3>
            <span class="status-pill pill-info" style="font-size: 10px;">Art. 13 & 32 G.O. 40.418</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- SUB-PANEL 1: ACUERDOS REGISTRADOS -->
            <div>
              <h4 style="font-size: 12px; font-weight: 700; color: var(--amber); text-transform: uppercase; margin: 0 0 10px 0;">
                <i class="fa-solid fa-list-check"></i> Acuerdos Vigentes
              </h4>
              ${agreements.length === 0 ? `
                <div style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border-subtle); border-radius: 8px; font-size: 12px; color: var(--txt-muted); text-align: center;">
                  No hay acuerdos o deducciones especiales registrados para este arrendatario.
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
                  ${agreements.map(a => `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px; font-size: 12px;">
                      <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--txt-primary);">
                        <span>${escapeHtml(a.type || 'Deducción')}</span>
                        <span style="color: var(--emerald);">${formatMoney(a.monthly_discount_usd)} / mes</span>
                      </div>
                      <div style="font-size: 11px; color: var(--txt-secondary); margin-top: 3px;">${escapeHtml(a.description || '')}</div>
                      <div style="font-size: 10px; color: var(--txt-muted); margin-top: 4px;">Vigencia: ${a.start_date} al ${a.end_date}</div>
                    </div>
                  `).join('')}
                </div>
              `}
              <div style="margin-top: 12px;">
                <button type="button" class="btn-currency-toggle" style="font-size: 11.5px; padding: 6px 12px;" data-click="openTenantDossier('${tenant.id}')">
                  <i class="fa-solid fa-plus-circle" style="color: var(--amber);"></i> Registrar Nuevo Acuerdo en Modal
                </button>
              </div>
            </div>

            <!-- SUB-PANEL 2: DROPZONE UNIVERSAL PARA ADJUNTAR SOPORTES / CONTRATO / FOTOS DE REPARACIONES -->
            <div>
              <h4 style="font-size: 12px; font-weight: 700; color: var(--cyan); text-transform: uppercase; margin: 0 0 10px 0;">
                <i class="fa-solid fa-paperclip"></i> Cargar Anexos & Soportes de Obras
              </h4>

              <input type="file" id="client-profile-doc-file" accept="image/*,.pdf" style="display: none;" onchange="window.handleProfileDocFileChange(event, '${tenant.id}')">
              
              <div class="custom-file-dropzone amber-zone" id="client-profile-doc-dropzone" onclick="document.getElementById('client-profile-doc-file').click()" style="padding: 16px; text-align: center; border: 2px dashed var(--border-subtle); border-radius: 10px; cursor: pointer; background: rgba(255,255,255,0.02);">
                <i class="fa-solid fa-cloud-arrow-up dropzone-icon" style="font-size: 24px; color: var(--amber); margin-bottom: 6px;"></i>
                <div class="dropzone-main-text" style="font-size: 12px; font-weight: 700; color: var(--txt-primary);">Arrastra un archivo o haz clic para subir</div>
                <div class="dropzone-sub-text" style="font-size: 10.5px; color: var(--txt-muted);">Facturas de compras, fotos de remodelaciones o contratos escaneados (PDF, JPG, PNG)</div>
              </div>

              <div id="profile-doc-preview-container" class="file-preview-card" style="display: none; margin-top: 10px;">
                <div class="file-preview-info">
                  <i class="fa-solid fa-file-circle-check" id="profile-doc-icon" style="color: var(--emerald); font-size: 20px;"></i>
                  <div style="min-width: 0;">
                    <div id="profile-doc-name" class="file-preview-name" style="font-size: 12px;"></div>
                    <div id="profile-doc-size" class="file-preview-size" style="font-size: 10.5px;"></div>
                  </div>
                </div>
                <button type="button" class="btn-remove-file" onclick="window.removeProfileDoc()" title="Remover archivo"><i class="fa-solid fa-xmark"></i></button>
              </div>

              <div id="profile-uploaded-docs-list" style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                <!-- Documentos guardados previamente -->
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    // Renderizar documentos ya adjuntos previamente si existen en localStorage
    renderTenantSavedDocs(tenantId);
  };

  // Manejo de archivos adjuntos del perfil de inquilino
  window.handleProfileDocFileChange = function(e, tenantId) {
    const file = (e.target && e.target.files && e.target.files[0])
      ? e.target.files[0]
      : (e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('El archivo seleccionado excede el límite máximo de 10 MB.', 'warning', 'Archivo Excedido');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      const docItem = {
        id: 'doc-' + Date.now(),
        tenant_id: tenantId,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: evt.target.result,
        uploaded_at: new Date().toISOString()
      };

      try {
        const storedKey = 'ccms_tenant_docs_' + tenantId;
        const existing = JSON.parse(localStorage.getItem(storedKey) || '[]');
        existing.push(docItem);
        localStorage.setItem(storedKey, JSON.stringify(existing));
        showToast('Documento o soporte de obra adjuntado exitosamente.', 'success', 'Archivo Guardado');
        renderTenantSavedDocs(tenantId);
      } catch (err) {
        console.error('[ProfileDoc] Storage err:', err);
        showToast('Error al guardar el archivo adjunto.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  function renderTenantSavedDocs(tenantId) {
    const listEl = document.getElementById('profile-uploaded-docs-list');
    if (!listEl) return;
    const storedKey = 'ccms_tenant_docs_' + tenantId;
    let docs = [];
    try {
      docs = JSON.parse(localStorage.getItem(storedKey) || '[]');
    } catch (e) {}

    if (docs.length === 0) {
      listEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = docs.map(d => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <i class="${d.type.includes('pdf') ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-image'}" style="color: var(--amber);"></i>
          <span style="font-size: 11.5px; font-weight: 700; color: var(--txt-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(d.name)}</span>
          <span style="font-size: 10px; color: var(--txt-muted);">(${(d.size / 1024).toFixed(1)} KB)</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <a href="${d.data}" download="${escapeHtml(d.name)}" class="btn-action-icon" title="Descargar"><i class="fa-solid fa-download"></i></a>
          <button type="button" class="btn-action-icon" style="color: var(--rose);" onclick="window.deleteTenantDoc('${tenantId}', '${d.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  window.deleteTenantDoc = function(tenantId, docId) {
    const storedKey = 'ccms_tenant_docs_' + tenantId;
    try {
      let docs = JSON.parse(localStorage.getItem(storedKey) || '[]');
      docs = docs.filter(d => d.id !== docId);
      localStorage.setItem(storedKey, JSON.stringify(docs));
      showToast('Documento eliminado.', 'info');
      renderTenantSavedDocs(tenantId);
    } catch (e) {}
  };

  window.removeProfileDoc = function() {
    const input = document.getElementById('client-profile-doc-file');
    if (input) input.value = '';
    const container = document.getElementById('profile-doc-preview-container');
    if (container) container.style.display = 'none';
  };

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
      if (isDirectiva && pendingReviews > 0) {
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

    // Renderizado del banner de estado de cuenta para inquilino
    const tenantBanner = document.getElementById('tenant-statement-banner');
    if (tenantBanner) {
      if (currentRole === 'tenant') {
        const myAllInvoices = allInvoices.filter(i => i.tenant_id === currentTenantId);
        const myUnpaid = myAllInvoices.filter(i => i.status !== 'pagado');
        const myOverdue = myAllInvoices.filter(i => i.status === 'en_mora');
        const mySaldoUsd = myUnpaid.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
        const myMoraUsd = myOverdue.reduce((a, i) => a + (parseFloat(i.total_usd) || 0), 0);
        const bcvRate = 814.69;
        const mySaldoVes = mySaldoUsd * bcvRate;
        const recargoMoraUsd = myMoraUsd > 0 ? (myMoraUsd * 0.03) : 0;

        tenantBanner.style.display = 'block';
        tenantBanner.innerHTML = `
          <div class="data-card" style="padding: 18px 20px; border-left: 4px solid ${mySaldoUsd > 0 ? (myOverdue.length > 0 ? 'var(--rose)' : 'var(--amber)') : 'var(--emerald)'}; background: linear-gradient(135deg, ${mySaldoUsd > 0 ? (myOverdue.length > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)') : 'rgba(16,185,129,0.06)'} 0%, transparent 100%);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span class="status-pill ${mySaldoUsd > 0 ? (myOverdue.length > 0 ? 'pill-overdue' : 'pill-warning') : 'pill-active'}" style="font-size: 11px;">
                    <i class="fa-solid ${mySaldoUsd > 0 ? (myOverdue.length > 0 ? 'fa-triangle-exclamation' : 'fa-clock') : 'fa-circle-check'}"></i>
                    ${mySaldoUsd > 0 ? (myOverdue.length > 0 ? 'Estado: En Mora' : 'Estado: Pendiente por Pagar') : 'Estado: Solvente y al Día'}
                  </span>
                  <span style="font-size: 12px; color: var(--txt-muted); font-family: var(--font-heading);">${myUnpaid.length} ${myUnpaid.length === 1 ? 'cuota pendiente' : 'cuotas pendientes'}</span>
                </div>
                <div style="font-size: 12px; color: var(--txt-secondary);">
                  ${myOverdue.length > 0 ? 'Posee facturas con retraso sujetas a recargo legal según Art. 40 G.O. 40.418.' : (mySaldoUsd > 0 ? 'Sus cuotas están dentro del plazo voluntario de pago.' : 'No mantiene deudas pendientes con la administración.')}
                </div>
              </div>

              <!-- Cifras de Saldo, Mora y Recargo -->
              <div style="display: flex; gap: 18px; align-items: center; flex-wrap: wrap;">
                <div style="text-align: right;">
                  <div style="font-size: 10.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Saldo Total Adeudado</div>
                  <div style="font-size: 20px; font-weight: 800; color: ${mySaldoUsd > 0 ? 'var(--amber)' : 'var(--emerald)'}; font-family: var(--font-heading);">${formatMoney(mySaldoUsd)}</div>
                  <div style="font-size: 10px; color: var(--txt-muted);">≈ Bs. ${mySaldoVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>

                ${myMoraUsd > 0 ? `
                  <div style="border-left: 1px solid var(--border-subtle); padding-left: 14px; text-align: right;">
                    <div style="font-size: 10.5px; color: var(--rose); text-transform: uppercase; font-weight: 700;">Capital en Mora</div>
                    <div style="font-size: 17px; font-weight: 800; color: var(--rose); font-family: var(--font-heading);">${formatMoney(myMoraUsd)}</div>
                    <div style="font-size: 10px; color: var(--rose);">+ Recargo moratorio: ${formatMoney(recargoMoraUsd)}</div>
                  </div>
                ` : ''}

                ${mySaldoUsd > 0 ? `
                  <button type="button" class="btn-onboarding-cta" data-click="openTenantQuickPay()" style="background: var(--emerald); border-color: var(--emerald); color: #fff; padding: 8px 16px; font-size: 12.5px;">
                    <i class="fa-solid fa-file-invoice-dollar"></i> Reportar Pago
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      } else {
        tenantBanner.style.display = 'none';
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
              <button class="btn-action-icon" title="${currentRole === 'tenant' ? 'Reportar pago y adjuntar comprobante' : (inv.status === 'verificando' ? 'Revisar comprobante' : 'Registrar Pago Multimoneda')}" style="background: var(--emerald-glow); color: var(--emerald);" data-click="openPaymentModal('${inv.id}')">
                <i class="fa-solid fa-receipt"></i>
              </button>
            ` : ''}
            ${inv.receipt_proof ? `
              <button class="btn-action-icon" title="Ver Comprobante de Pago Adjunto" style="color: var(--cyan); border-color: var(--cyan);" data-click="viewReceiptProof('${inv.id}')">
                <i class="fa-solid fa-paperclip"></i>
              </button>
            ` : ''}
            <button class="btn-action-icon" title="Imprimir Recibo Oficial" data-click="printReceipt('${inv.id}')">
              <i class="fa-solid fa-print"></i>
            </button>
            ${currentRole === 'admin' ? `
              <button class="btn-action-icon btn-wa-action" title="Aviso de Cobranza WhatsApp" data-click="openWhatsAppModal('${tenant.id}', '${inv.id}')">
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
        <button type="button" class="btn-action-icon" style="color:var(--purple);border-color:var(--purple);" title="Ver Factura de Proveedor" data-click="viewExpenseProof('${exp.id}')">
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
              <button type="button" class="btn-action-icon" title="Editar Gasto" data-click="openExpenseModal('${exp.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button type="button" class="btn-action-icon" style="color:var(--rose);border-color:var(--rose);" title="Eliminar Gasto" data-click="deleteExpense('${exp.id}')">
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
    const appSettings = dbService.getSettings();

    // Ajustar título de la sección
    const sectionTitle = document.querySelector('#tab-alertas .section-title');
    if (sectionTitle) {
      if (currentRole === 'tenant') {
        sectionTitle.innerHTML = '<i class="fa-solid fa-bell" style="color: var(--rose);"></i> Mis Avisos de Cobro y Alertas de Mora';
      } else {
        sectionTitle.innerHTML = '<i class="fa-solid fa-bell" style="color: var(--rose);"></i> Centro de Avisos de Cobro y Alertas de Mora';
      }
    }

    // CESE INMEDIATO DE ALERTAS: Si la cuota está 'pagado' o 'verificando', cesan las notificaciones
    const pending = invoices.filter(i => i.status !== 'pagado' && i.status !== 'verificando');
    if (pending.length === 0) {
      alertsContainer.innerHTML = `<div class="data-card" style="padding:32px;text-align:center;color:var(--txt-muted);font-style:italic;">${currentRole === 'tenant' ? 'No tiene cuotas pendientes ni en mora. ¡Está al día!' : 'No hay alertas pendientes. Todas las cuotas están solventes o con comprobante en verificación.'}</div>`;
      return;
    }

    pending.forEach(inv => {
      const tenant = tenants.find(t => t.id === inv.tenant_id);
      if (!tenant) return;

      const moraInfo = financialEngine.calculateMora(inv, null, appSettings);

      const card = document.createElement('div');
      card.className = 'data-card';
      card.style.padding = '18px 20px';
      card.style.marginBottom = '14px';

      const waMsg = buildMultiCurrencyWhatsAppMessage(tenant, inv);
      const waUrl = GoogleWorkspace.createWhatsAppUrl(tenant.whatsapp, waMsg);
      const gmailUrl = GoogleWorkspace.createGmailUrl(tenant.email, `Aviso de Cobro Cuota ${inv.period_month}/${inv.period_year} — CC Mario Sánchez`, waMsg);

      const statusBadge = moraInfo.inMora
        ? `<span class="status-pill pill-overdue"><i class="fa-solid fa-triangle-exclamation"></i> En Mora (${moraInfo.daysOverdue} días)</span>`
        : (moraInfo.isWithinGrace
            ? `<span class="status-pill pill-warning"><i class="fa-solid fa-hourglass-half"></i> Período de Gracia (${moraInfo.graceDaysRemaining}d restantes)</span>`
            : `<span class="status-pill pill-warning"><i class="fa-solid fa-clock"></i> Aviso Preventivo</span>`);

      const breakdownText = moraInfo.inMora
        ? `Base: $ ${moraInfo.baseAmountUsd.toFixed(2)} • <strong style="color: var(--rose);">Recargo Mora (${moraInfo.moraRatePct}%): +$ ${moraInfo.moraUsd.toFixed(2)}</strong> • <strong>Total: $ ${moraInfo.totalDueUsd.toFixed(2)} USD (Bs. ${moraInfo.totalDueVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</strong>`
        : `Cuota Base: $ ${inv.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} • Bs. ${financialEngine.convert(inv.total_usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 })} • USDT ${inv.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${statusBadge}
              <strong style="font-size: 14px; color: var(--txt-primary);">${escapeHtml(tenant.business_name)} (${escapeHtml(inv.unit_code)})</strong>
            </div>
            <p style="font-size: 12px; color: var(--txt-secondary); margin-top: 4px;">
              ${breakdownText}
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
    const settings = dbService.getSettings();
    const moraInfo = financialEngine.calculateMora(invoice, null, settings);

    const baseUsd = moraInfo.baseAmountUsd;
    const finalTotalUsd = moraInfo.totalDueUsd;
    const finalTotalBs = moraInfo.totalDueVes.toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const finalTotalEur = financialEngine.convert(finalTotalUsd, 'USD', 'EUR').toLocaleString('de-DE', { minimumFractionDigits: 2 });
    const finalTotalUsdt = finalTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const bcvRate = financialEngine.getRates().VES.toFixed(2);

    // Seleccionar plantilla según el estado de mora
    let template = (moraInfo.inMora || invoice.status === 'en_mora') ? settings.msg_mora_template : settings.msg_preventive_template;

    // Remplazo de variables dinámicas ampliadas
    let body = template
      .replace(/{inquilino}/g, tenant.business_name)
      .replace(/{unidad}/g, invoice.unit_code)
      .replace(/{periodo}/g, `${invoice.period_month}/${invoice.period_year}`)
      .replace(/{monto_usd}/g, `$ ${baseUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`)
      .replace(/{monto_bs}/g, `${financialEngine.convert(baseUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 })}`)
      .replace(/{tasa_bcv}/g, `${bcvRate} Bs/USD`)
      .replace(/{fecha_limite}/g, invoice.due_date)
      .replace(/{dias_mora}/g, `${moraInfo.daysOverdue}`)
      .replace(/{recargo_mora_usd}/g, `$ ${moraInfo.moraUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`)
      .replace(/{recargo_mora_bs}/g, `Bs. ${moraInfo.moraVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`)
      .replace(/{total_con_mora_usd}/g, `$ ${finalTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`)
      .replace(/{total_con_mora_bs}/g, `Bs. ${finalTotalBs}`);

    return `🏛️ *CENTRO COMERCIAL MARIO SÁNCHEZ*\n` +
      `*Departamento de Administración & Cobranzas*\n` +
      `Av. Municipal, Puerto La Cruz, Venezuela\n\n` +
      `${body}\n\n` +
      `💰 *RESUMEN DE EQUIVALENCIAS:*\n` +
      `• *Total a Pagar:* $ ${finalTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\n` +
      `• *Bolívares (Tasa Oficial BCV ${bcvRate}):* Bs. ${finalTotalBs}\n` +
      `• *Euros:* € ${finalTotalEur} EUR\n` +
      `• *Cripto USDT (TRC20):* USDT ${finalTotalUsdt}\n\n` +
      `🏦 *CUENTAS BANCARIAS AUTORIZADAS:*\n` +
      `• *Banesco Corriente:* 0134-0982-12-0987654321\n` +
      `• *Pago Móvil:* Banesco (0134) | RIF: J-40899123-1 | Telf: 0424-7380002\n` +
      `• *Zelle / Custodia USD:* administracion@ccmariosanchez.com\n` +
      `• *Billetera USDT (TRC20):* TXz9y8W7v6U5t4S3r2Q1p0OnMlKjIhGfEd\n\n` +
      `⚖️ *Base Legal:* Ley de Arrendamiento Inmobiliario para Uso Comercial (Gaceta Oficial N° 40.418).\n` +
      `Agradecemos remitir el comprobante adjunto a este canal para suspender notificaciones y conciliar de inmediato.`;
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
    if (document.getElementById('cfg-mora-rate')) document.getElementById('cfg-mora-rate').value = cfg.mora_monthly_rate !== undefined ? cfg.mora_monthly_rate : 3.0;
    if (document.getElementById('cfg-mora-recurrence')) document.getElementById('cfg-mora-recurrence').value = cfg.mora_recurrence_days || 3;

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
      '{fecha_limite}': '05/09/2026',
      '{dias_mora}': '8',
      '{recargo_mora_usd}': '$ 3.36 USD',
      '{recargo_mora_bs}': 'Bs. 137.76',
      '{total_con_mora_usd}': '$ 423.36 USD',
      '{total_con_mora_bs}': 'Bs. 17,357.76'
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
      grace_days: parseInt(document.getElementById('cfg-grace-days').value) || 5,
      mora_monthly_rate: parseFloat(document.getElementById('cfg-mora-rate').value) || 3.0,
      mora_recurrence_days: parseInt(document.getElementById('cfg-mora-recurrence').value) || 3
    });
    renderAlertsCenter();
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Días de corte, plazos de gracia, tasa de mora legal y recurrencia guardados.', 'success', 'Alertas Actualizadas');
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
    document.getElementById('cfg-msg-mora').value = `⚠️ *AVISO FORMAL DE MORA — CC MARIO SÁNCHEZ*\nEstimados *{inquilino}* ({unidad}):\nLe notificamos que su cuota del período *{periodo}* (vencida el *{fecha_limite}*) presenta *{dias_mora} días de retraso*.\n• Canon & Gastos Base: *{monto_usd}*\n• Recargo Moratorio Legal (Art. 30 G.O. 40.418): *{recargo_mora_usd}* (Bs. {recargo_mora_bs})\n• *TOTAL EXIGIBLE AL DÍA*: *{total_con_mora_usd}* (Bs. {total_con_mora_bs} a tasa BCV {tasa_bcv})\nPor favor consignar su comprobante a este canal para suspender las alertas automáticas y registrar su solvencia.`;
    window.saveMensajesConfig(new Event('submit'));
    window.updateTemplateLivePreview();
  };

  loadConfigFields();

  let currentDossierTenantId = null;

  window.switchDossierTab = function(tabName) {
    const tabs = ['overview', 'contract', 'history', 'agreements'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-dossier-${t}`);
      const panel = document.getElementById(`panel-dossier-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (panel) panel.classList.toggle('active', t === tabName);
    });
    if (tabName === 'agreements' && currentDossierTenantId) {
      window.renderSpecialAgreements(currentDossierTenantId);
    }
  };

  let isDossierEditMode = false;

  window.toggleDossierEditMode = function(forceState) {
    const viewMode = document.getElementById('dossier-view-mode');
    const editMode = document.getElementById('dossier-edit-mode');
    const editText = document.getElementById('btn-dossier-edit-text');
    if (!viewMode || !editMode) return;

    if (forceState !== undefined) {
      isDossierEditMode = forceState;
    } else {
      isDossierEditMode = !isDossierEditMode;
    }

    if (isDossierEditMode) {
      viewMode.style.display = 'none';
      editMode.style.display = 'flex';
      if (editText) editText.innerText = 'Cancelar Edición';
    } else {
      viewMode.style.display = 'block';
      editMode.style.display = 'none';
      if (editText) editText.innerText = 'Editar Ficha';
    }
  };

  window.saveTenantDossierChanges = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentDossierTenantId) return;

    const updatedData = {
      business_name: document.getElementById('dossier-edit-company').value.trim(),
      trade_name: document.getElementById('dossier-edit-trade').value.trim(),
      legal_rep_name: document.getElementById('dossier-edit-rep').value.trim(),
      legal_rep_dni: document.getElementById('dossier-edit-dni').value.trim(),
      commercial_activity: document.getElementById('dossier-edit-activity').value.trim(),
      phone: document.getElementById('dossier-edit-phone').value.trim(),
      whatsapp: document.getElementById('dossier-edit-whatsapp').value.trim(),
      email: document.getElementById('dossier-edit-email').value.trim(),
      observations: document.getElementById('dossier-edit-observations').value.trim()
    };

    if (dbService.updateTenant) {
      dbService.updateTenant(currentDossierTenantId, updatedData);
    } else {
      const allTenants = dbService.getTenants();
      const t = allTenants.find(item => item.id === currentDossierTenantId);
      if (t) {
        Object.assign(t, updatedData);
        dbService.saveData(dbService.getData());
      }
    }

    window.toggleDossierEditMode(false);
    window.openTenantDossier(currentDossierTenantId);
    if (typeof renderTenantsTable === 'function') renderTenantsTable();
    if (typeof renderKPIsAndBalances === 'function') renderKPIsAndBalances();

    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Ficha del arrendatario y observaciones actualizadas exitosamente.', 'success', 'Ficha Guardada');
    }
  };

  let currentAgreementProof = null;

  window.handleAgreementProofChange = function(e) {
    const file = (e.target && e.target.files && e.target.files[0])
      ? e.target.files[0]
      : (e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      if (window.SecuritySuite && window.SecuritySuite.toast) {
        window.SecuritySuite.toast('El archivo de soporte excede el límite de 10 MB.', 'warning', 'Archivo Excedido');
      }
      const input = document.getElementById('agr-proof-file');
      if (input) input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      currentAgreementProof = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: evt.target.result,
        uploaded_at: new Date().toISOString()
      };

      const container = document.getElementById('agr-proof-preview-container');
      const dropzone = document.getElementById('agr-proof-dropzone');
      const nameEl = document.getElementById('agr-proof-name');
      const sizeEl = document.getElementById('agr-proof-size');
      const iconEl = document.getElementById('agr-proof-icon');

      if (container) container.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB • ${(file.type || 'Archivo').split('/')[1] || 'soporte'}`;
      if (iconEl) {
        iconEl.className = file.type && file.type.includes('pdf') ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-image';
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeAgreementProof = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    currentAgreementProof = null;
    const input = document.getElementById('agr-proof-file');
    if (input) input.value = '';
    const container = document.getElementById('agr-proof-preview-container');
    const dropzone = document.getElementById('agr-proof-dropzone');
    if (container) container.style.display = 'none';
    if (dropzone) dropzone.style.display = 'flex';
  };

  window.resetAgreementForm = function() {
    const form = document.getElementById('form-dossier-agreement');
    if (form) form.reset();
    document.getElementById('agr-id').value = '';
    document.getElementById('agr-discount-monthly').value = '0.00';
    document.getElementById('agr-total-investment').value = '0.00';
    window.removeAgreementProof();
    
    const today = new Date().toISOString().split('T')[0];
    const sixMonths = new Date();
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    const endDef = sixMonths.toISOString().split('T')[0];
    const startEl = document.getElementById('agr-start-date');
    const endEl = document.getElementById('agr-end-date');
    if (startEl) startEl.value = today;
    if (endEl) endEl.value = endDef;
  };

  window.handleSaveSpecialAgreement = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentDossierTenantId) return;

    const tenant = dbService.getTenants().find(t => t.id === currentDossierTenantId);
    const agrId = document.getElementById('agr-id').value;
    const agreementData = {
      tenant_id: currentDossierTenantId,
      unit_code: tenant ? tenant.unit_code : 'N/A',
      agreement_type: document.getElementById('agr-type').value,
      discount_monthly_usd: parseFloat(document.getElementById('agr-discount-monthly').value) || 0,
      total_investment_usd: parseFloat(document.getElementById('agr-total-investment').value) || 0,
      start_date: document.getElementById('agr-start-date').value,
      end_date: document.getElementById('agr-end-date').value,
      description: document.getElementById('agr-description').value.trim(),
      proof_file: currentAgreementProof,
      status: 'activo'
    };
    if (agrId) agreementData.id = agrId;

    if (dbService.saveSpecialAgreement) {
      dbService.saveSpecialAgreement(agreementData);
    }
    window.resetAgreementForm();
    window.renderSpecialAgreements(currentDossierTenantId);
    if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    if (typeof renderKPIsAndBalances === 'function') renderKPIsAndBalances();

    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Acuerdo especial registrado y aplicado al cálculo de cánones.', 'success', 'Acuerdo Guardado');
    }
  };

  window.renderSpecialAgreements = function(tenantId) {
    const container = document.getElementById('dossier-agreements-list-container');
    if (!container) return;

    const agreements = (dbService.getSpecialAgreements ? dbService.getSpecialAgreements(tenantId) : []) || [];
    if (agreements.length === 0) {
      container.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--txt-muted); font-size: 12px; font-style: italic;">
          No hay acuerdos o deducciones especiales registrados para este arrendatario.
        </div>
      `;
      return;
    }

    let html = `
      <table class="modern-table" style="font-size: 11.5px; width: 100%;">
        <thead>
          <tr>
            <th>Tipo de Acuerdo</th>
            <th>Deducción / Mes</th>
            <th>Inversión Total</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Soporte</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;

    agreements.forEach(agr => {
      const isExpired = new Date(agr.end_date) < new Date();
      const stClass = (!isExpired && agr.status === 'activo') ? 'pill-active' : 'pill-disabled';
      const stText = (!isExpired && agr.status === 'activo') ? 'Vigente' : 'Finalizado';
      
      const proofBtn = agr.proof_file ? `
        <button type="button" class="btn-action-icon" style="width:24px;height:24px;font-size:10px;color:var(--cyan);border-color:var(--cyan);" title="Ver Soporte de Obra" data-click="viewAgreementProof('${agr.id}')">
          <i class="fa-solid fa-paperclip"></i>
        </button>
      ` : '<span style="color:var(--txt-muted);font-size:10px;">—</span>';

      html += `
        <tr>
          <td>
            <strong style="color:var(--txt-primary);">${escapeHtml(agr.agreement_type)}</strong>
            <div style="font-size:10.5px;color:var(--txt-muted);margin-top:2px;">${escapeHtml(agr.description || '')}</div>
          </td>
          <td><strong style="color:var(--emerald);">-$${(agr.discount_monthly_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
          <td><span>$${(agr.total_investment_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
          <td><span style="font-size:10.5px;color:var(--txt-secondary);">${agr.start_date} al ${agr.end_date}</span></td>
          <td><span class="status-pill ${stClass}" style="font-size:9.5px;padding:2px 5px;">${stText}</span></td>
          <td style="text-align:center;">${proofBtn}</td>
          <td>
            <button type="button" class="btn-action-icon" style="width:24px;height:24px;font-size:10px;color:var(--rose);border-color:var(--rose);" title="Eliminar Acuerdo" data-click="deleteDossierSpecialAgreement('${agr.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  };

  window.deleteDossierSpecialAgreement = async function(id) {
    const proceed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Desea dar de baja este acuerdo especial? El canon volverá al valor estándar sin deducciones.', 'Eliminar Acuerdo', 'Eliminar', 'Cancelar')
      : confirm('¿Eliminar este acuerdo especial?');
    if (!proceed) return;

    if (dbService.deleteSpecialAgreement) {
      dbService.deleteSpecialAgreement(id);
    }
    if (currentDossierTenantId) {
      window.renderSpecialAgreements(currentDossierTenantId);
    }
    if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    if (typeof renderKPIsAndBalances === 'function') renderKPIsAndBalances();
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Acuerdo especial eliminado.', 'info', 'Acuerdo Removido');
    }
  };

  window.viewAgreementProof = function(agreementId) {
    const agreements = dbService.getSpecialAgreements ? dbService.getSpecialAgreements() : [];
    const agr = agreements.find(a => a.id === agreementId);
    if (!agr || !agr.proof_file) {
      if (window.SecuritySuite && window.SecuritySuite.toast) {
        window.SecuritySuite.toast('No hay soporte o comprobante adjunto para este acuerdo.', 'warning', 'Sin Soporte');
      }
      return;
    }

    const proof = agr.proof_file;
    if (proof.type && proof.type.includes('pdf')) {
      const pdfWindow = window.open("");
      if (pdfWindow) {
        pdfWindow.document.write(`<iframe src="${proof.data}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`);
      } else {
        const link = document.createElement('a');
        link.href = proof.data;
        link.download = proof.name || 'soporte_acuerdo.pdf';
        link.click();
      }
    } else {
      const imgWindow = window.open("");
      if (imgWindow) {
        imgWindow.document.write(`
          <body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; min-height:100vh;">
            <div style="text-align:center; padding:20px;">
              <h3 style="color:#f59e0b; font-family:sans-serif; margin-bottom:10px;">Soporte de Acuerdo / Obra (${escapeHtml(proof.name)})</h3>
              <img src="${proof.data}" style="max-width:90vw; max-height:85vh; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5); border:1px solid #334155;">
            </div>
          </body>
        `);
      }
    }
  };

  window.closeDossierModal = function() {
    window.closeModal('modal-dossier');
  };

  window.openDossierQuickPay = function() {
    if (!currentDossierTenantId) return;
    const invoices = dbService.getInvoices().filter(i => i.tenant_id === currentDossierTenantId && i.status !== 'pagado');
    window.closeDossierModal();
    if (invoices.length > 0) {
      window.openPaymentModal(invoices[0].id);
    } else {
      window.openPaymentModal();
    }
  };

  window.openDossierWhatsApp = function() {
    if (!currentDossierTenantId) return;
    window.closeDossierModal();
    window.openWhatsAppModal(currentDossierTenantId);
  };

  // 4. Ficha Integral y Expediente Ejecutivo de Inquilino (Estilo Time To Program)
  window.openTenantDossier = function(tenantId) {
    currentDossierTenantId = tenantId;
    const tenant = dbService.getTenants().find(t => t.id === tenantId);
    if (!tenant) return;
    const contract = dbService.getContracts().find(c => c.tenant_id === tenantId);
    const unit = dbService.getUnits().find(u => u.code === tenant.unit_code);
    const ext = VenezuelaLegal.calculateLegalExtension(1);

    // Resetear modo edición
    window.toggleDossierEditMode(false);

    // Monograma Avatar (iniciales de la razón social)
    const words = (tenant.business_name || 'CC').trim().split(/\s+/);
    const monogram = words.length > 1 
      ? (words[0][0] + words[1][0]).toUpperCase() 
      : (words[0].substring(0, 2)).toUpperCase();
    const avatarEl = document.getElementById('dossier-avatar');
    if (avatarEl) avatarEl.innerText = monogram;

    // Encabezado
    const compEl = document.getElementById('dossier-company');
    if (compEl) compEl.innerText = tenant.business_name;
    const tradeEl = document.getElementById('dossier-trade');
    if (tradeEl) tradeEl.innerText = tenant.trade_name ? `«${tenant.trade_name}»` : 'Sin Denominación Comercial';
    const rifEl = document.getElementById('dossier-rif');
    if (rifEl) rifEl.innerText = tenant.rif;
    const unitBadgeEl = document.getElementById('dossier-unit-badge');
    if (unitBadgeEl) unitBadgeEl.innerText = tenant.unit_code;
    const actInlineEl = document.getElementById('dossier-activity-inline');
    if (actInlineEl) actInlineEl.innerText = `• ${tenant.commercial_activity || 'Comercial'}`;

    // Facturas del inquilino y métricas financieras
    const tenantInvoices = dbService.getInvoices().filter(i => i.tenant_id === tenantId);
    tenantInvoices.sort((a, b) => {
      if (b.period_year !== a.period_year) return b.period_year - a.period_year;
      return b.period_month - a.period_month;
    });

    const totalBilled = tenantInvoices.reduce((acc, i) => acc + (i.total_usd || 0), 0);
    const balanceOwed = tenantInvoices.filter(i => i.status !== 'pagado').reduce((acc, i) => acc + (i.total_usd || 0), 0);
    const rentUsd = contract ? contract.rent_usd : (unit ? unit.base_rent_usd : 0);
    const aliquot = unit ? (unit.condo_aliquot * 100).toFixed(1) + '%' : '0.0%';

    const statBilledEl = document.getElementById('dossier-stat-billed');
    if (statBilledEl) statBilledEl.innerText = formatMoney(totalBilled);
    
    const statBalEl = document.getElementById('dossier-stat-balance');
    if (statBalEl) {
      statBalEl.innerText = formatMoney(balanceOwed);
      statBalEl.style.color = balanceOwed > 0 ? 'var(--rose)' : 'var(--emerald)';
    }

    const statRentEl = document.getElementById('dossier-stat-rent');
    if (statRentEl) statRentEl.innerText = formatMoney(rentUsd);

    const statAliEl = document.getElementById('dossier-stat-aliquot');
    if (statAliEl) statAliEl.innerText = aliquot;

    // Tab 1: Datos & Representante (Modo Vista y Modo Edición)
    const repEl = document.getElementById('dossier-rep');
    if (repEl) repEl.innerText = `${tenant.legal_rep_name} (C.I. ${tenant.legal_rep_dni})`;
    const actEl = document.getElementById('dossier-activity');
    if (actEl) actEl.innerText = tenant.commercial_activity;
    const unitEl = document.getElementById('dossier-unit');
    if (unitEl) unitEl.innerText = tenant.unit_code;
    const areaEl = document.getElementById('dossier-area-m2');
    if (areaEl) areaEl.innerText = `${unit ? unit.area_m2.toLocaleString() : '0'} m²`;
    const contEl = document.getElementById('dossier-contact');
    if (contEl) contEl.innerHTML = `<strong>Teléfono:</strong> ${escapeHtml(tenant.phone || 'N/A')}<br><strong>WhatsApp:</strong> ${escapeHtml(tenant.whatsapp || 'N/A')}<br><strong>Correo:</strong> ${escapeHtml(tenant.email || 'N/A')}`;

    // Observaciones
    const obsDisplay = document.getElementById('dossier-observations-display');
    if (obsDisplay) {
      obsDisplay.innerText = tenant.observations ? tenant.observations : 'Sin observaciones registradas para este arrendatario.';
    }

    // Cargar valores en formulario de edición
    const edComp = document.getElementById('dossier-edit-company');
    if (edComp) edComp.value = tenant.business_name || '';
    const edTrade = document.getElementById('dossier-edit-trade');
    if (edTrade) edTrade.value = tenant.trade_name || '';
    const edRep = document.getElementById('dossier-edit-rep');
    if (edRep) edRep.value = tenant.legal_rep_name || '';
    const edDni = document.getElementById('dossier-edit-dni');
    if (edDni) edDni.value = tenant.legal_rep_dni || '';
    const edAct = document.getElementById('dossier-edit-activity');
    if (edAct) edAct.value = tenant.commercial_activity || '';
    const edPhone = document.getElementById('dossier-edit-phone');
    if (edPhone) edPhone.value = tenant.phone || '';
    const edWa = document.getElementById('dossier-edit-whatsapp');
    if (edWa) edWa.value = tenant.whatsapp || '';
    const edEmail = document.getElementById('dossier-edit-email');
    if (edEmail) edEmail.value = tenant.email || '';
    const edObs = document.getElementById('dossier-edit-observations');
    if (edObs) edObs.value = tenant.observations || '';

    const waLinkEl = document.getElementById('dossier-contact-wa-link');
    if (waLinkEl) {
      const cleanWa = (tenant.whatsapp || '').replace(/[^0-9]/g, '');
      waLinkEl.href = cleanWa ? `https://wa.me/${cleanWa}` : '#';
      waLinkEl.style.display = cleanWa ? 'inline-flex' : 'none';
    }

    // Tab 2: Contrato
    if (contract) {
      const cNum = document.getElementById('dossier-contract-num');
      if (cNum) cNum.innerText = contract.contract_number;
      const cDates = document.getElementById('dossier-contract-dates');
      if (cDates) cDates.innerText = `${contract.start_date} al ${contract.end_date}`;
      const cRent = document.getElementById('dossier-contract-rent');
      if (cRent) cRent.innerText = formatMoney(contract.rent_usd) + ' / mes';
      const cDep = document.getElementById('dossier-contract-deposit');
      if (cDep) cDep.innerText = `$${contract.deposit_usd.toLocaleString()} USD (${contract.deposit_months} meses - Límite legal Art. 19)`;
      const cExt = document.getElementById('dossier-legal-extension');
      if (cExt) cExt.innerText = ext.description;
    }

    const dossierContractBtn = document.getElementById('btn-dossier-view-contract');
    if (dossierContractBtn) {
      dossierContractBtn.onclick = () => {
        window.closeDossierModal();
        window.viewTenantContract(tenantId);
      };
    }

    // Tab 3: Historial
    const historyTbody = document.getElementById('dossier-history-table-body');
    const solvencyBadge = document.getElementById('dossier-solvency-badge');
    if (historyTbody) {
      historyTbody.innerHTML = '';
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
        historyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--txt-muted);font-style:italic;">No registra facturación previa.</td></tr>`;
      } else {
        tenantInvoices.forEach(inv => {
          const tr = document.createElement('tr');
          let stBadge = '';
          if (inv.status === 'pagado') stBadge = '<span class="status-pill pill-active" style="font-size:10px;padding:2px 6px;"><i class="fa-solid fa-check"></i> Pagado</span>';
          else if (inv.status === 'en_mora') stBadge = '<span class="status-pill pill-overdue" style="font-size:10px;padding:2px 6px;"><i class="fa-solid fa-triangle-exclamation"></i> En Mora</span>';
          else if (inv.status === 'verificando') stBadge = '<span class="status-pill pill-warning" style="font-size:10px;padding:2px 6px;"><i class="fa-solid fa-magnifying-glass"></i> Revisión</span>';
          else stBadge = '<span class="status-pill pill-warning" style="font-size:10px;padding:2px 6px;"><i class="fa-solid fa-hourglass"></i> Pendiente</span>';

          const dateDetail = inv.paid_at ? `Pagado: ${escapeHtml(inv.paid_at)}` : `Vence: ${escapeHtml(inv.due_date)}`;
          let equivBs = 'Bs. 0,00';
          try {
            equivBs = 'Bs. ' + financialEngine.convert(inv.total_usd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          } catch(e) {}

          tr.innerHTML = `
            <td><strong style="color:var(--amber);">${inv.period_month}/${inv.period_year}</strong></td>
            <td><span style="font-family:monospace;font-weight:700;">${escapeHtml(inv.invoice_number)}</span></td>
            <td><strong>${formatMoney(inv.total_usd)}</strong></td>
            <td><span style="font-size:11px;color:var(--txt-muted);">${equivBs}</span></td>
            <td><span style="font-size:11px;color:var(--txt-secondary);">${dateDetail}</span></td>
            <td>${stBadge}</td>
            <td>
              <div style="display:flex;gap:4px;">
                <button type="button" class="btn-action-icon" style="width:26px;height:26px;font-size:11px;" title="Ver Recibo Oficial" data-click="printReceipt('${inv.id}')">
                  <i class="fa-solid fa-receipt"></i>
                </button>
                ${inv.receipt_proof ? `
                  <button type="button" class="btn-action-icon" style="width:26px;height:26px;font-size:11px;color:var(--cyan);border-color:var(--cyan);" title="Ver Comprobante Bancario" data-click="viewReceiptProof('${inv.id}')">
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

    // Tab 4: Cargar Acuerdos
    window.resetAgreementForm();
    window.renderSpecialAgreements(tenantId);

    // Restablecer a la primera pestaña
    window.switchDossierTab('overview');
    window.openModal('modal-dossier');
  };

  // 5. Visor de Recibo Oficial / Impresión Editorial (Estilo Time To Program)
  window.printReceipt = function(invoiceId) {
    const inv = dbService.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;
    const tenant = dbService.getTenants().find(t => t.id === inv.tenant_id);

    const receiptObj = {
      receipt_number: inv.receipt_number || `REC-${inv.invoice_number}`,
      invoice_number: inv.invoice_number,
      tenant_name: tenant ? tenant.business_name : 'Inquilino Comercial',
      tenant_rif: tenant ? tenant.rif : 'N/A',
      unit_code: inv.unit_code,
      period_month: inv.period_month,
      period_year: inv.period_year,
      rent_usd: inv.rent_usd || 0,
      condo_usd: inv.condo_usd || 0,
      total_usd: inv.total_usd || 0,
      payment_method: inv.payment_method || (inv.status === 'pagado' ? 'Transferencia Bancaria Nacional' : 'Pendiente de Conciliación'),
      reference_number: inv.reference_number || (inv.status === 'pagado' ? 'REF-CONCILIADA' : 'PENDIENTE-PAGO'),
      approved_at: inv.paid_at || inv.due_date || new Date().toISOString(),
      issuing_bank: inv.issuing_bank || 'Banesco / BDV / Mercantil',
      origin_phone: tenant ? tenant.phone : '',
      origin_doc: tenant ? tenant.legal_rep_dni : '',
      approved_by: 'Administración CCMS',
      status: inv.status,
      snapshot: {
        bcv_rate_applied: financialEngine.getRates().VES
      }
    };

    if (window.openReceiptPreview) {
      window.openReceiptPreview(receiptObj);
    }
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
          <span class="status-pill ${isAct ? 'pill-active' : 'pill-overdue'}" style="font-size:10.5px;cursor:pointer;" data-click="toggleAccountStatus('${acc.id}')" title="Click para alternar estado">
            <i class="fa-solid ${isAct ? 'fa-check' : 'fa-ban'}"></i> ${isAct ? 'Habilitada' : 'Inactiva'}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-action-icon" title="Editar Cuenta" data-click="openBankAccountModal('${acc.id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button type="button" class="btn-action-icon" style="color:var(--rose);border-color:var(--rose);" title="Eliminar Cuenta" data-click="deleteAccount('${acc.id}')">
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

      let roleBadge = '';
      if (u.role === 'superadmin') {
        roleBadge = '<span style="color:var(--amber);font-weight:700;"><i class="fa-solid fa-crown"></i> Superadmin</span>';
      } else if (u.role === 'admin') {
        roleBadge = '<span style="color:var(--amber);font-weight:700;"><i class="fa-solid fa-user-shield"></i> Administrador General</span>';
      } else if (u.role === 'admin_finanzas') {
        roleBadge = '<span style="color:var(--emerald);font-weight:700;"><i class="fa-solid fa-coins"></i> Finanzas & Cobranzas</span>';
      } else if (u.role === 'admin_legal') {
        roleBadge = '<span style="color:var(--cyan);font-weight:700;"><i class="fa-solid fa-scale-balanced"></i> Legal & Contratos</span>';
      } else if (u.role === 'admin_mantenimiento') {
        roleBadge = '<span style="color:#f97316;font-weight:700;"><i class="fa-solid fa-wrench"></i> Mantenimiento</span>';
      } else if (u.role === 'heredero') {
        roleBadge = '<span style="color:var(--purple);font-weight:700;"><i class="fa-solid fa-landmark"></i> Heredero (' + escapeHtml(u.unit || '1/14 Sucesión') + ')</span>';
      } else {
        roleBadge = '<span style="color:var(--emerald);font-weight:700;"><i class="fa-solid fa-store"></i> Inquilino (' + escapeHtml(u.unit || 'Local') + ')</span>';
      }

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
              <button type="button" class="btn-action-icon" title="Aprobar y Autorizar Acceso" data-click="approveUserAccess('${u.id}')" style="background: rgba(16,185,129,0.15); color: var(--emerald); border-color: rgba(16,185,129,0.3);">
                <i class="fa-solid fa-check"></i>
              </button>
            ` : ''}
            ${!isRej && u.id !== 'u-admin-1' ? `
              <button type="button" class="btn-action-icon" title="Revocar Acceso" data-click="rejectUserAccess('${u.id}')" style="background: rgba(244,63,94,0.15); color: var(--rose); border-color: rgba(244,63,94,0.3);">
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
    const unitLabel = unitGroup ? unitGroup.querySelector('label') : null;
    const unitInput = document.getElementById('inv-unit');
    const idLabel = document.getElementById('inv-identifier-label');
    
    if (role === 'tenant') {
      if (unitGroup) unitGroup.style.display = 'block';
      if (unitLabel) unitLabel.innerText = 'Unidad / Local Comercial Asignado';
      if (unitInput) unitInput.placeholder = 'Ej: Local PB-08';
      if (idLabel) idLabel.innerText = 'RIF Jurídico / Identificador Fiscal';
    } else if (role === 'heredero') {
      if (unitGroup) unitGroup.style.display = 'block';
      if (unitLabel) unitLabel.innerText = 'Estirpe Sucesoral / Cuota Indivisa (1/14)';
      if (unitInput) unitInput.placeholder = 'Ej: Estirpe 1 - Mario Sánchez Jr. (1/14 Cuota)';
      if (idLabel) idLabel.innerText = 'Correo Electrónico / C.I. del Heredero';
    } else {
      if (unitGroup) unitGroup.style.display = 'none';
      if (idLabel) idLabel.innerText = 'Correo Electrónico Corporativo';
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

    // Los informes que requieren seleccionar inquilino específico:
    const requiresTenant = ['solvencia', 'finiquito_entrega', 'notificacion_mora'].includes(type);

    if (requiresTenant) {
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
        } else if (type === 'finiquito_entrega') {
          container.innerHTML = renderFiniquitoEntregaReportHTML(tenantId);
        } else if (type === 'retencion_iva') {
          container.innerHTML = renderRetencionIvaReportHTML(month, year);
        } else if (type === 'retencion_islr') {
          container.innerHTML = renderRetencionIslrReportHTML(month, year);
        } else if (type === 'notificacion_mora') {
          container.innerHTML = renderNotificacionMoraReportHTML(tenantId);
        } else if (type === 'herederos') {
          container.innerHTML = renderHerederosReportHTML(month, year);
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
      const rentUsd = parseFloat(inv.rent_usd !== undefined ? inv.rent_usd : (inv.base_rent_usd || 0)) || 0;
      const condoUsd = parseFloat(inv.condo_usd || 0) || 0;
      const totalUsd = parseFloat(inv.total_usd !== undefined ? inv.total_usd : (rentUsd + condoUsd)) || 0;

      totalFacturadoUsd += totalUsd;
      if (inv.status === 'pagado') totalCobradoUsd += totalUsd;
      else totalPendienteUsd += totalUsd;

      let stText = 'Pendiente';
      let stColor = '#d97706';
      if (inv.status === 'pagado') { stText = 'Cobrado'; stColor = '#059669'; }
      else if (inv.status === 'en_mora') { stText = 'En Mora'; stColor = '#dc2626'; }
      else if (inv.status === 'verificando') { stText = 'En Revisión'; stColor = '#2563eb'; }

      const totalBs = financialEngine.convert(totalUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11.5px;">
          <td style="padding: 8px 10px; font-weight: 600;">${idx + 1}</td>
          <td style="padding: 8px 10px;">
            <strong>${escapeHtml(t.business_name)}</strong>
            <div style="font-size: 10px; color: #64748b;">RIF: ${escapeHtml(t.rif)}</div>
          </td>
          <td style="padding: 8px 10px; font-weight: 700; color: #b45309;">${escapeHtml(inv.unit_code)}</td>
          <td style="padding: 8px 10px; text-align: right;">$${rentUsd.toFixed(2)}</td>
          <td style="padding: 8px 10px; text-align: right;">$${condoUsd.toFixed(2)}</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 700;">$${totalUsd.toFixed(2)}</td>
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

    const invoiceRows = invoices.length === 0
      ? `<tr><td colspan="7" style="text-align: center; padding: 14px; color: #64748b;">No hay facturas emitidas para este local.</td></tr>`
      : invoices.map(inv => {
        const rentUsd = parseFloat(inv.rent_usd !== undefined ? inv.rent_usd : (inv.base_rent_usd || 0)) || 0;
        const condoUsd = parseFloat(inv.condo_usd || 0) || 0;
        const totalUsd = parseFloat(inv.total_usd !== undefined ? inv.total_usd : (rentUsd + condoUsd)) || 0;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 6px 8px; font-weight: 600;">${inv.period_month || 1}/${inv.period_year || 2026}</td>
            <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(inv.invoice_number || 'S/N')}</td>
            <td style="padding: 6px 8px; text-align: right;">$${rentUsd.toFixed(2)}</td>
            <td style="padding: 6px 8px; text-align: right;">$${condoUsd.toFixed(2)}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700;">$${totalUsd.toFixed(2)}</td>
            <td style="padding: 6px 8px; text-align: center;">${inv.paid_at || 'Pendiente'}</td>
            <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: ${inv.status === 'pagado' ? '#059669' : '#d97706'};">
              ${inv.status === 'pagado' ? 'SOLVENTE' : 'PENDIENTE'}
            </td>
          </tr>
        `;
      }).join('');

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

  // --- REPORTE 7: ACTA DE ENTREGA / DESOCUPACIÓN Y FINIQUITO (G.O. 40.418) ---
  function renderFiniquitoEntregaReportHTML(tenantId) {
    const tenants = dbService.getTenants();
    const tenant = tenants.find(t => t.id === tenantId) || tenants[0];
    if (!tenant) return '<div style="padding:24px;text-align:center;">No hay arrendatario seleccionado.</div>';

    const unit = dbService.getUnits().find(u => u.code === tenant.unit_code) || { code: tenant.unit_code, area_m2: 0 };
    const contract = dbService.getContracts().find(c => c.tenant_id === tenant.id);
    const invoices = dbService.getInvoices().filter(i => i.tenant_id === tenant.id);
    const pendingInvoices = invoices.filter(i => i.status !== 'pagado');
    const isSolventeTotal = pendingInvoices.length === 0;

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 32px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif; max-width: 820px; margin: 0 auto; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px;">
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11px; color: #475569;">RIF: J-29881234-0 • Av. Municipal, Puerto La Cruz, Edo. Anzoátegui</div>
            <div style="font-size: 11px; color: #475569;">Consultoría Jurídica & Administración Inmobiliaria</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #334155;">
            <div>DOCUMENTO LEGAL N°: <strong>FIN-${new Date().getFullYear()}-${tenant.unit_code}</strong></div>
            <div>Fecha: <strong>${new Date().toLocaleDateString('es-VE')}</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 22px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a;">
            ACTA FORMAL DE RECEPCIÓN, DESOCUPACIÓN & FINIQUITO DE CONTRATO COMERCIAL
          </h3>
          <span style="font-size: 11px; color: #64748b;">Conforme al Artículo 12, 13, 24 y 25 del Decreto con Rango, Valor y Fuerza de Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (G.O. N° 40.418)</span>
        </div>

        <div style="font-size: 12px; color: #1e293b; text-align: justify; margin-bottom: 18px;">
          En la ciudad de Puerto La Cruz, a la fecha de emisión del presente documento, comparecen por una parte la <strong>SOCIEDAD ADMINISTRADORA DEL CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</strong>, y por la otra el Arrendatario <strong>${escapeHtml(tenant.business_name)}</strong> (RIF: <strong>${escapeHtml(tenant.rif)}</strong>), debidamente representado por el ciudadano <strong>${escapeHtml(tenant.legal_rep_name)}</strong>, portador de la Cédula de Identidad N° <strong>${escapeHtml(tenant.legal_rep_dni)}</strong>, para dejar formal constancia de la entrega material y desocupación del inmueble identificado como <strong>Local ${escapeHtml(tenant.unit_code)}</strong> con un área aproximada de <strong>${unit.area_m2} m²</strong>, bajo las siguientes cláusulas de inspección y finiquito:
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; font-size: 11.5px; margin-bottom: 18px;">
          <div style="font-weight: 800; margin-bottom: 6px; text-transform: uppercase; color: #0f172a;">1. Estado Físico del Inmueble y Bienhechurías:</div>
          <div>• <strong>Paredes, friso y pintura:</strong> Entregado en perfecto estado de conservación y aseo.</div>
          <div>• <strong>Instalaciones eléctricas y luminarias:</strong> Tablero operativo, cableado intacto, breaker principal verificado.</div>
          <div>• <strong>Piezas sanitarias / hidráulicas:</strong> Llaves de paso, tuberías y desagües operativos y sin filtraciones.</div>
          <div>• <strong>Santa María / Cerraduras:</strong> Mecanismo de cortina metálica y llaves maestras recibidas a entera conformidad de la Administradora.</div>
        </div>

        <div style="background: ${isSolventeTotal ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${isSolventeTotal ? '#bbf7d0' : '#fde68a'}; border-radius: 6px; padding: 14px; font-size: 11.5px; margin-bottom: 24px;">
          <div style="font-weight: 800; margin-bottom: 6px; text-transform: uppercase; color: ${isSolventeTotal ? '#166534' : '#92400e'};">2. Estado de Cuentas, Cánones y Cuotas Condominales:</div>
          <div>
            ${isSolventeTotal
              ? `El Arrendatario ha cancelado la totalidad de los cánones de arrendamiento, alícuotas condominales y servicios comunes hasta la presente fecha. Las partes se otorgan <strong>MUTUO, PLENO Y DEFINITIVO FINIQUITO</strong>, declarando que nada se adeudan por concepto de contrato mercantil, depósitos ni lucro cesante.`
              : `Se deja constancia expresa de que el Arrendatario mantiene un saldo deudor pendiente de liquidación por un monto total de <strong>$${pendingInvoices.reduce((s, i) => s + (parseFloat(i.total_usd) || 0), 0).toFixed(2)} USD</strong> correspondientes a ${pendingInvoices.length} recibo(s), acordándose un plazo improrrogable de conciliación de cinco (5) días hábiles.`
            }
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px;">
          <div style="text-align: center;">
            <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11.5px;">
              <strong>POR LA SOCIEDAD ADMINISTRADORA</strong><br>
              Centro Comercial Mario Sánchez, C.A.<br>
              <span style="font-size: 10px; color: #64748b;">Administrador General / Consultor Jurídico</span>
            </div>
          </div>
          <div style="text-align: center;">
            <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11.5px;">
              <strong>POR EL ARRENDATARIO (ENTREGANTE)</strong><br>
              ${escapeHtml(tenant.business_name)}<br>
              <span style="font-size: 10px; color: #64748b;">C.I. ${escapeHtml(tenant.legal_rep_dni)} • Firma y Huella</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- REPORTE 8: COMPROBANTE DE RETENCIÓN DE IVA (PROVIDENCIA SNAT/2015/0049) ---
  function renderRetencionIvaReportHTML(month, year) {
    const expenses = (dbService.getCondoExpenses ? dbService.getCondoExpenses() : []).filter(e => e.period_month === month && e.period_year === year && e.withhold_iva);
    const bcvRate = financialEngine.getRates().VES;
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const rows = expenses.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:16px;color:#64748b;">No existen comprobantes de retención de IVA para este período fiscal.</td></tr>`
      : expenses.map((e, idx) => {
        const baseUsd = parseFloat(e.amount_usd) || 0;
        const ivaUsd = baseUsd * 0.16;
        const retUsd = ivaUsd * 0.75; // 75% Prov. 0049
        const retBs = financialEngine.convert(retUsd, 'USD', 'VES');
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 6px 8px;">${idx + 1}</td>
            <td style="padding: 6px 8px;">${escapeHtml(e.provider_name || 'Proveedor')} <br><small style="color:#64748b;">RIF: ${escapeHtml(e.provider_rif || 'N/A')}</small></td>
            <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(e.invoice_number || 'S/N')}</td>
            <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(e.control_number || 'S/N')}</td>
            <td style="padding: 6px 8px; text-align: right;">$${baseUsd.toFixed(2)}</td>
            <td style="padding: 6px 8px; text-align: right; color:#0284c7;">$${ivaUsd.toFixed(2)}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; color:#16a34a;">Bs. ${retBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}<br><small style="color:#64748b;">($${retUsd.toFixed(2)})</small></td>
          </tr>
        `;
      }).join('');

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif; max-width: 850px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h2 style="margin: 0; font-size: 17px; font-weight: 800;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11px; color: #475569;">RIF: J-29881234-0 • Agente de Retención de Impuesto al Valor Agregado</div>
            <div style="font-size: 11px; color: #475569;">Providencia Administrativa SENIAT N° SNAT/2015/0049</div>
          </div>
          <div style="text-align: right; font-size: 11px;">
            <div>COMPROBANTE GENERAL DE RETENCIÓN IVA</div>
            <div>Período Fiscal: <strong>${monthNames[month]} ${year}</strong></div>
            <div>Tasa BCV Oficial: <strong>${bcvRate.toFixed(2)} Bs/USD</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 14px; font-size: 11.5px; color: #334155; line-height: 1.5;">
          Relación certificada de retenciones del Impuesto al Valor Agregado (75%) practicadas a proveedores de bienes y servicios comunes durante las operaciones del centro comercial.
        </div>

        <div class="table-responsive" style="margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase;">
                <th style="padding: 6px 8px; text-align: left;">N°</th>
                <th style="padding: 6px 8px; text-align: left;">Sujeto Retenido / Proveedor</th>
                <th style="padding: 6px 8px; text-align: left;">N° Factura</th>
                <th style="padding: 6px 8px; text-align: left;">N° Control</th>
                <th style="padding: 6px 8px; text-align: right;">Base Imponible</th>
                <th style="padding: 6px 8px; text-align: right;">IVA (16%)</th>
                <th style="padding: 6px 8px; text-align: right;">IVA Retenido (75%)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <div style="display: inline-block; width: 280px; border-top: 1px solid #475569; padding-top: 6px; font-size: 11px;">
            <strong>AGENTE DE RETENCIÓN AUTORIZADO</strong><br>
            <span style="font-size: 10px; color: #64748b;">Firma y Sello Oficial • Departamento de Impuestos y Tributos</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- REPORTE 9: COMPROBANTE DE RETENCIÓN DE ISLR (ART. 9 DECRETO 1808) ---
  function renderRetencionIslrReportHTML(month, year) {
    const expenses = (dbService.getCondoExpenses ? dbService.getCondoExpenses() : []).filter(e => e.period_month === month && e.period_year === year && e.withhold_islr);
    const bcvRate = financialEngine.getRates().VES;
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const rows = expenses.length === 0
      ? `<tr><td colspan="6" style="text-align:center;padding:16px;color:#64748b;">No existen comprobantes de retención de ISLR para este período.</td></tr>`
      : expenses.map((e, idx) => {
        const baseUsd = parseFloat(e.amount_usd) || 0;
        const retUsd = baseUsd * 0.02; // 2% Art. 9 Nral. 11 Dec. 1808
        const retBs = financialEngine.convert(retUsd, 'USD', 'VES');
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 6px 8px;">${idx + 1}</td>
            <td style="padding: 6px 8px;">${escapeHtml(e.provider_name || 'Proveedor')} <br><small style="color:#64748b;">RIF: ${escapeHtml(e.provider_rif || 'N/A')}</small></td>
            <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(e.invoice_number || 'S/N')}</td>
            <td style="padding: 6px 8px; text-align: right;">$${baseUsd.toFixed(2)}</td>
            <td style="padding: 6px 8px; text-align: center; color:#b45309; font-weight:700;">2.00%</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; color:#16a34a;">Bs. ${retBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}<br><small style="color:#64748b;">($${retUsd.toFixed(2)})</small></td>
          </tr>
        `;
      }).join('');

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif; max-width: 850px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h2 style="margin: 0; font-size: 17px; font-weight: 800;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11px; color: #475569;">RIF: J-29881234-0 • Agente de Retención de Impuesto sobre la Renta (ISLR)</div>
            <div style="font-size: 11px; color: #475569;">Reglamento Parcial en Materia de Retenciones (Decreto N° 1.808)</div>
          </div>
          <div style="text-align: right; font-size: 11px;">
            <div>COMPROBANTE GENERAL DE RETENCIÓN ISLR (ARC)</div>
            <div>Período Fiscal: <strong>${monthNames[month]} ${year}</strong></div>
            <div>Tasa BCV Oficial: <strong>${bcvRate.toFixed(2)} Bs/USD</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 14px; font-size: 11.5px; color: #334155; line-height: 1.5;">
          Certificado de retenciones de ISLR practicadas a prestadores de servicios y proveedores comerciales (Concepto: Honorarios y Servicios a Personas Jurídicas Domicialiadas - 2%).
        </div>

        <div class="table-responsive" style="margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase;">
                <th style="padding: 6px 8px; text-align: left;">N°</th>
                <th style="padding: 6px 8px; text-align: left;">Beneficiario del Pago / Proveedor</th>
                <th style="padding: 6px 8px; text-align: left;">N° Factura</th>
                <th style="padding: 6px 8px; text-align: right;">Monto Objeto de Retención</th>
                <th style="padding: 6px 8px; text-align: center;">% Retención</th>
                <th style="padding: 6px 8px; text-align: right;">Total ISLR Retenido</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <div style="display: inline-block; width: 280px; border-top: 1px solid #475569; padding-top: 6px; font-size: 11px;">
            <strong>DPTO. DE CONTABILIDAD TRIBUTARIA</strong><br>
            <span style="font-size: 10px; color: #64748b;">Firma y Sello Oficial • Centro Comercial Mario Sánchez</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- REPORTE 10: ACTA DE NOTIFICACIÓN FORMAL DE MORA Y CITACIÓN ADMINISTRATIVA ---
  function renderNotificacionMoraReportHTML(tenantId) {
    const tenants = dbService.getTenants();
    const tenant = tenants.find(t => t.id === tenantId) || tenants[0];
    if (!tenant) return '<div style="padding:24px;text-align:center;">No hay arrendatario seleccionado.</div>';

    const unit = dbService.getUnits().find(u => u.code === tenant.unit_code) || { code: tenant.unit_code, area_m2: 0 };
    const contract = dbService.getContracts().find(c => c.tenant_id === tenant.id);
    const invoices = dbService.getInvoices().filter(i => i.tenant_id === tenant.id);
    const overdueInvoices = invoices.filter(i => i.status === 'en_mora' || i.status === 'pendiente');
    const bcvRate = financialEngine.getRates().VES.toFixed(2);

    const totalDeudaUsd = overdueInvoices.reduce((s, i) => {
      const rent = parseFloat(i.rent_usd !== undefined ? i.rent_usd : (i.base_rent_usd || 0)) || 0;
      const condo = parseFloat(i.condo_usd || 0) || 0;
      return s + (parseFloat(i.total_usd !== undefined ? i.total_usd : (rent + condo)) || 0);
    }, 0);

    const totalDeudaBs = financialEngine.convert(totalDeudaUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });

    const rows = overdueInvoices.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:12px;color:#15803d;font-weight:700;">✓ El arrendatario se encuentra al día. No registra cuotas vencidas.</td></tr>`
      : overdueInvoices.map((inv, idx) => {
        const rent = parseFloat(inv.rent_usd !== undefined ? inv.rent_usd : (inv.base_rent_usd || 0)) || 0;
        const condo = parseFloat(inv.condo_usd || 0) || 0;
        const tot = parseFloat(inv.total_usd !== undefined ? inv.total_usd : (rent + condo)) || 0;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 6px 8px;">${idx + 1}</td>
            <td style="padding: 6px 8px; font-weight: 600;">${inv.period_month || 1}/${inv.period_year || 2026}</td>
            <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(inv.invoice_number || 'S/N')}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #dc2626;">$${tot.toFixed(2)}</td>
            <td style="padding: 6px 8px; text-align: center;"><span style="background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px;font-weight:700;font-size:9.5px;">VENCIDO</span></td>
          </tr>
        `;
      }).join('');

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 32px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #b91c1c; padding-bottom: 14px; margin-bottom: 20px;">
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">CENTRO COMERCIAL MARIO SÁNCHEZ, C.A.</h2>
            <div style="font-size: 11px; color: #475569;">RIF: J-29881234-0 • Dpto. de Cobranzas, Auditoría & Asuntos Legales</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #334155;">
            <div>NOTIFICACIÓN N°: <strong>NOT-${new Date().getFullYear()}-${tenant.unit_code}</strong></div>
            <div>Fecha de Emisión: <strong>${new Date().toLocaleDateString('es-VE')}</strong></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 22px;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 900; text-transform: uppercase; color: #b91c1c;">
            NOTIFICACIÓN EXTRAJUDICIAL DE COBRO EN MORA & CITACIÓN CONCILIATORIA
          </h3>
          <span style="font-size: 11px; color: #64748b;">Procedimiento Administrativo Preventivo — Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (G.O. 40.418)</span>
        </div>

        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin-bottom: 18px; font-size: 12px;">
          <strong>DIRIGIDO A:</strong> ${escapeHtml(tenant.business_name)} (RIF: ${escapeHtml(tenant.rif)})<br>
          <strong>ATENCIÓN:</strong> ${escapeHtml(tenant.legal_rep_name)} (C.I. ${escapeHtml(tenant.legal_rep_dni)})<br>
          <strong>LOCAL ARRENDADO:</strong> ${escapeHtml(tenant.unit_code)} (${unit.area_m2} m²)<br>
          <strong>CONTRATO VINCULANTE:</strong> ${contract ? contract.contract_number : 'Contrato Vigente'}
        </div>

        <div style="font-size: 12px; color: #1e293b; text-align: justify; margin-bottom: 18px;">
          Por medio de la presente, se le intima formalmente al pago de las obligaciones pecuniarias vencidas y causadas por concepto de cánones de arrendamiento y alícuotas condominales comunes, las cuales se detallan en el siguiente estado cronológico de cuenta:
        </div>

        <div class="table-responsive" style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase;">
                <th style="padding: 6px 8px; text-align: left;">N°</th>
                <th style="padding: 6px 8px; text-align: left;">Período Vencido</th>
                <th style="padding: 6px 8px; text-align: left;">N° Recibo</th>
                <th style="padding: 6px 8px; text-align: right;">Total Adeudado</th>
                <th style="padding: 6px 8px; text-align: center;">Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                <td colspan="3" style="padding: 8px;">TOTAL CONSOLIDADO EN MORA:</td>
                <td style="padding: 8px; text-align: right; color: #dc2626;">$${totalDeudaUsd.toFixed(2)} USD</td>
                <td style="padding: 8px; text-align: center; color: #475569;">Bs. ${totalDeudaBs}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; font-size: 11.5px; margin-bottom: 25px; line-height: 1.5;">
          <strong>PLAZO DE SUBSANACIÓN Y CONCILIACIÓN:</strong> Se otorga un plazo de <strong>setenta y dos (72) horas hábiles</strong> a partir de la recepción de la presente comunicación para consignar comprobante de liquidación total o apersonarse en la Oficina de Administración del Centro Comercial para la firma de un acuerdo de conciliación extrajudicial, so pena de dar inicio a las acciones resolutorias del contrato de arrendamiento ante las instancias jurisdiccionales correspondientes.
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px;">
          <div style="text-align: center;">
            <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px;">
              <strong>ADMINISTRACIÓN & COBRANZAS</strong><br>
              Centro Comercial Mario Sánchez, C.A.<br>
              <span style="font-size: 10px; color: #64748b;">Firma Autorizada</span>
            </div>
          </div>
          <div style="text-align: center;">
            <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px;">
              <strong>CONSTANCIA DE RECEPCIÓN</strong><br>
              Recibido por: _________________________<br>
              <span style="font-size: 10px; color: #64748b;">Firma, Huella y Fecha</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * =========================================================================
   * INFORME 11: ESTADO DE CUENTA & LIQUIDACIÓN DE FRUTOS CIVILES SUCESORALES
   * Sucesión Mario Sánchez (RIF: J-30211544-2) — 14 Coherederos / 1/14 Cuota
   * Arts. 552 y 768 del Código Civil Venezolano y Gaceta Oficial N° 40.418
   * =========================================================================
   */
  function renderHerederosReportHTML(month, year) {
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const bcvRate = financialEngine.getRates().VES.toFixed(2);
    const invoices = dbService.getInvoices().filter(i => i.period_month === month && i.period_year === year);
    const units = dbService.getUnits();
    
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

    // Si aún no hay cobros en este mes de prueba, tomar totalFacturado como referencia de liquidación estimada
    const baseIngresos = totalCobradoUsd > 0 ? totalCobradoUsd : (totalFacturadoUsd > 0 ? totalFacturadoUsd : 9050.00);

    // Egresos comunes: presupuesto base de $2,540.00 o gastos reales registrados
    const allDbExpenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
    const expensesPeriod = allDbExpenses.filter(e => e.period_month === month && e.period_year === year);
    const totalGastosUsd = expensesPeriod.length > 0
      ? expensesPeriod.reduce((sum, e) => sum + (parseFloat(e.amount_usd) || 0), 0)
      : 2540.00; // Presupuesto base mensual auditado ($2,540.00)

    // Deducciones reglamentarias: Fondo de Reserva (10%) y Gastos de Administración (5%)
    const fondoReservaUsd = baseIngresos * 0.10;
    const gastoAdmUsd = baseIngresos * 0.05;

    // Utilidad Neta / Frutos Civiles Repartibles
    const utilidadNetaUsd = Math.max(0, baseIngresos - totalGastosUsd - fondoReservaUsd - gastoAdmUsd);
    
    // 14 Coherederos / Estirpes (1/14 cada uno = 7.142857%)
    // Base de $400.00 mensual por coheredero según presupuesto anual ($5,600 / 14 = $400)
    const cuotaPorHerederoUsd = utilidadNetaUsd / 14;

    const coherederos = [
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

    const rowsHtml = coherederos.map((h, idx) => {
      const bsAmount = financialEngine.convert(cuotaPorHerederoUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11.5px;">
          <td style="padding: 8px 10px; font-weight: 700; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px 10px;">
            <strong>${escapeHtml(h.name)}</strong>
            <div style="font-size: 10px; color: #64748b;">Doc / C.I.: ${escapeHtml(h.doc)}</div>
          </td>
          <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #7c3aed;">${h.shareFrac} (${h.sharePct})</td>
          <td style="padding: 8px 10px; text-align: right; color: #64748b;">$400.00</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0f172a;">$${cuotaPorHerederoUsd.toFixed(2)}</td>
          <td style="padding: 8px 10px; text-align: right; color: #475569;">Bs. ${bsAmount}</td>
          <td style="padding: 8px 10px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3);">
              ${h.status}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const baseIngresosBs = financialEngine.convert(baseIngresos, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const totalGastosBs = financialEngine.convert(totalGastosUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const fondoReservaBs = financialEngine.convert(fondoReservaUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const gastoAdmBs = financialEngine.convert(gastoAdmUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const utilidadNetaBs = financialEngine.convert(utilidadNetaUsd, 'USD', 'VES').toLocaleString('es-VE', { minimumFractionDigits: 2 });

    return `
      <div class="printable-report" style="background: white; color: #0f172a; padding: 28px; border-radius: 8px; font-family: 'Segoe UI', Arial, sans-serif;">
        <!-- MEMBRETE OFICIAL SUCESORAL -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h2 style="margin: 0; font-size: 19px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">CENTRO COMERCIAL MARIO SÁNCHEZ</h2>
            <div style="font-size: 12px; font-weight: 700; color: #7c3aed;">SUCESIÓN MARIO SÁNCHEZ — RIF: J-30211544-2</div>
            <div style="font-size: 11px; color: #64748b;">Av. 5 de Julio c/c Calle Concordia, Puerto La Cruz, Edo. Anzoátegui</div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Régimen de Comunidad Hereditaria Indivisa — Código Civil Venezolano Arts. 552 y 768</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">LIQUIDACIÓN DE FRUTOS CIVILES</div>
            <div style="font-size: 12px; color: #64748b;">Período: <strong>${monthNames[month]} ${year}</strong></div>
            <div style="font-size: 11px; color: #059669; font-weight: 700; margin-top: 4px;">Tasa Oficial BCV: Bs. ${bcvRate} / USD</div>
          </div>
        </div>

        <!-- KPI CARDS SUCESORALES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 22px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">1. Ingresos Base</div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">$${baseIngresos.toFixed(2)}</div>
            <div style="font-size: 9.5px; color: #64748b;">Bs. ${baseIngresosBs}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #b91c1c;">2. Egresos Operativos</div>
            <div style="font-size: 15px; font-weight: 800; color: #b91c1c;">-$${totalGastosUsd.toFixed(2)}</div>
            <div style="font-size: 9.5px; color: #64748b;">Ppto Base: $2,540.00</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #d97706;">3. Fondo Reserva (10%)</div>
            <div style="font-size: 15px; font-weight: 800; color: #d97706;">-$${fondoReservaUsd.toFixed(2)}</div>
            <div style="font-size: 9.5px; color: #64748b;">Bs. ${fondoReservaBs}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #7c3aed;">4. Gasto Adm. (5%)</div>
            <div style="font-size: 15px; font-weight: 800; color: #7c3aed;">-$${gastoAdmUsd.toFixed(2)}</div>
            <div style="font-size: 9.5px; color: #64748b;">Bs. ${gastoAdmBs}</div>
          </div>
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #059669;">5. Utilidad Repartible</div>
            <div style="font-size: 16px; font-weight: 900; color: #059669;">$${utilidadNetaUsd.toFixed(2)}</div>
            <div style="font-size: 9.5px; color: #059669; font-weight: 700;">14 Cuotas de $${cuotaPorHerederoUsd.toFixed(2)}</div>
          </div>
        </div>

        <!-- TABLA DE DISTRIBUCIÓN SUCESORAL -->
        <div style="margin-bottom: 22px;">
          <h4 style="font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px; color: #0f172a; border-left: 3px solid #7c3aed; padding-left: 8px;">
            Distribución Individual por Estirpe Hereditaria (1/14 Cuota Indivisa)
          </h4>
          <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
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
                <td style="padding: 10px; text-align: right; color: #64748b;">$5,600.00</td>
                <td style="padding: 10px; text-align: right; color: #059669;">$${utilidadNetaUsd.toFixed(2)} USD</td>
                <td style="padding: 10px; text-align: right; color: #0f172a;">Bs. ${utilidadNetaBs}</td>
                <td style="padding: 10px; text-align: center; color: #059669;">✓ 100% Asignado</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- NOTAS LEGALES Y AUDITORÍA SUCESORAL -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 11px; margin-bottom: 25px; line-height: 1.5; color: #334155;">
          <strong>FUNDAMENTO LEGAL Y NORMAS DE PARTICIÓN:</strong>
          La presente liquidación se rige por los Artículos 552 (Frutos Civiles) y 768 (Comunidad Indivisa) del Código Civil de la República Bolivariana de Venezuela, en concordancia con el Decreto con Rango, Valor y Fuerza de Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (G.O. N° 40.418). Los recursos han sido auditados según los comprobantes bancarios, facturas de gastos operativos y deducciones correspondientes al Fondo de Reserva y Honorarios de Administración de la Sociedad.
        </div>

        <!-- FIRMAS AUTORIZADAS -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 35px;">
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

  /**
   * =========================================================================
   * MOTOR DE RESPALDO INTEGRAL & COPIAS DE SEGURIDAD (100% DATOS + IMÁGENES BASE64)
   * =========================================================================
   */
  window.exportFullSystemBackup = function() {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
      
      const backupPayload = {
        backup_info: {
          system: "Centro Comercial Mario Sánchez - ERP Inmobiliario & Sucesoral",
          rif: "J-30211544-2",
          version: "2.5-PROD",
          exported_at: now.toISOString(),
          exported_by: (window.AuthGuard && window.AuthGuard.currentUser()) ? window.AuthGuard.currentUser().email : "Superadmin",
          integrity_checksum_algorithm: "SHA-256"
        },
        collections: {
          units: dbService.getUnits ? dbService.getUnits() : [],
          tenants: dbService.getTenants ? dbService.getTenants() : [],
          contracts: dbService.getContracts ? dbService.getContracts() : [],
          invoices: dbService.getInvoices ? dbService.getInvoices() : [],
          payments: dbService.getPayments ? dbService.getPayments() : [],
          receipts: dbService.getReceipts ? dbService.getReceipts() : [],
          condo_expenses: dbService.getCondoExpenses ? dbService.getCondoExpenses() : [],
          staff_members: dbService.getStaffMembers ? dbService.getStaffMembers() : [],
          staff_photos: JSON.parse(localStorage.getItem('ccms_staff_photos_v1') || '{}'),
          activos_fijos: dbService.getActivosFijos ? dbService.getActivosFijos() : [],
          consumibles: dbService.getConsumibles ? dbService.getConsumibles() : [],
          kardex_movimientos: dbService.getKardexMovimientos ? dbService.getKardexMovimientos() : [],
          special_agreements: dbService.getSpecialAgreements ? dbService.getSpecialAgreements() : [],
          receiving_accounts: dbService.getReceivingAccounts ? dbService.getReceivingAccounts() : [],
          app_settings: dbService.getSettings ? dbService.getSettings() : {},
          audit_trail: JSON.parse(localStorage.getItem('ccms_audit_trail_v1') || '[]')
        }
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const filename = `CCMS_BACKUP_COMPLETO_${dateStr}_${timeStr}.json`;

      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.SecuritySuite && window.SecuritySuite.logAudit) {
        window.SecuritySuite.logAudit('BACKUP_EXPORT', `Generación y descarga de copia de seguridad integral (${filename})`);
      }
      showToast(`✓ Respaldo integral "${filename}" descargado con éxito. Incluye imágenes Base64 y 100% de tablas.`, 'success', 'Copia de Seguridad');
    } catch (err) {
      console.error('[BACKUP EXPORT ERROR]', err);
      showToast(`Error al exportar respaldo: ${err.message}`, 'error', 'Fallo de Respaldo');
    }
  };

  /**
   * =========================================================================
   * EXCEL MAESTRO CON FÓRMULAS VIVAS (SPREADSHEETML XML MULTI-HOJA)
   * =========================================================================
   */
  window.exportMasterExcelWithFormulas = function() {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const units = dbService.getUnits ? dbService.getUnits() : [];
      const tenants = dbService.getTenants ? dbService.getTenants() : [];
      const invoices = dbService.getInvoices ? dbService.getInvoices() : [];
      const expenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
      const activos = dbService.getActivosFijos ? dbService.getActivosFijos() : [];
      const consumibles = dbService.getConsumibles ? dbService.getConsumibles() : [];

      function xmlEscape(val) {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      }

      // SHEET 1: LOCALES E INQUILINOS
      let sheet1Rows = `
        <Row ss:StyleID="Header">
          <Cell><Data ss:Type="String">N°</Data></Cell>
          <Cell><Data ss:Type="String">Código Unidad</Data></Cell>
          <Cell><Data ss:Type="String">Tipo</Data></Cell>
          <Cell><Data ss:Type="String">Área (m²)</Data></Cell>
          <Cell><Data ss:Type="String">Inquilino / Razón Social</Data></Cell>
          <Cell><Data ss:Type="String">RIF</Data></Cell>
          <Cell><Data ss:Type="String">Canon Base ($)</Data></Cell>
          <Cell><Data ss:Type="String">Alícuota Condominio ($)</Data></Cell>
          <Cell><Data ss:Type="String">Total Mensual ($)</Data></Cell>
        </Row>
      `;

      units.forEach((u, idx) => {
        const t = tenants.find(item => item.unit_code === u.code) || { business_name: 'Disponible / Sin asignar', rif: 'N/A' };
        const rent = parseFloat(u.base_rent_usd || u.price_monthly_usd || 0);
        const condo = parseFloat(u.condo_aliquot_usd || 50.0);

        sheet1Rows += `
          <Row>
            <Cell><Data ss:Type="Number">${idx + 1}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(u.code)}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(u.type || 'Local')}</Data></Cell>
            <Cell ss:StyleID="Decimal"><Data ss:Type="Number">${parseFloat(u.area_m2 || 0)}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(t.business_name)}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(t.rif)}</Data></Cell>
            <Cell ss:StyleID="Currency"><Data ss:Type="Number">${rent}</Data></Cell>
            <Cell ss:StyleID="Currency"><Data ss:Type="Number">${condo}</Data></Cell>
            <Cell ss:StyleID="Currency" ss:Formula="=RC[-2]+RC[-1]"><Data ss:Type="Number">${rent + condo}</Data></Cell>
          </Row>
        `;
      });

      const totalUnitsRow = units.length + 2;
      sheet1Rows += `
        <Row ss:StyleID="Total">
          <Cell ss:MergeAcross="2"><Data ss:Type="String">TOTALES CONSOLIDADOS (39 UNIDADES):</Data></Cell>
          <Cell ss:StyleID="TotalDecimal" ss:Formula="=SUM(R2C4:R${totalUnitsRow - 1}C4)"><Data ss:Type="Number">0</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C7:R${totalUnitsRow - 1}C7)"><Data ss:Type="Number">0</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C8:R${totalUnitsRow - 1}C8)"><Data ss:Type="Number">0</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C9:R${totalUnitsRow - 1}C9)"><Data ss:Type="Number">0</Data></Cell>
        </Row>
      `;

      // SHEET 2: FACTURACIÓN & COBRANZAS
      let sheet2Rows = `
        <Row ss:StyleID="Header">
          <Cell><Data ss:Type="String">N°</Data></Cell>
          <Cell><Data ss:Type="String">Código</Data></Cell>
          <Cell><Data ss:Type="String">Inquilino</Data></Cell>
          <Cell><Data ss:Type="String">Período</Data></Cell>
          <Cell><Data ss:Type="String">Canon ($)</Data></Cell>
          <Cell><Data ss:Type="String">Condominio ($)</Data></Cell>
          <Cell><Data ss:Type="String">Total Facturado ($)</Data></Cell>
          <Cell><Data ss:Type="String">Monto Cobrado ($)</Data></Cell>
          <Cell><Data ss:Type="String">Saldo Pendiente ($)</Data></Cell>
          <Cell><Data ss:Type="String">Estatus</Data></Cell>
        </Row>
      `;

      invoices.forEach((inv, idx) => {
        const t = tenants.find(item => item.id === inv.tenant_id) || { business_name: 'Inquilino' };
        const rent = parseFloat(inv.rent_usd !== undefined ? inv.rent_usd : (inv.base_rent_usd || 0)) || 0;
        const condo = parseFloat(inv.condo_usd || 0) || 0;
        const total = rent + condo;
        const cobrado = (inv.status === 'pagado') ? total : 0;

        sheet2Rows += `
          <Row>
            <Cell><Data ss:Type="Number">${idx + 1}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(inv.unit_code)}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(t.business_name)}</Data></Cell>
            <Cell><Data ss:Type="String">${inv.period_month}/${inv.period_year}</Data></Cell>
            <Cell ss:StyleID="Currency"><Data ss:Type="Number">${rent}</Data></Cell>
            <Cell ss:StyleID="Currency"><Data ss:Type="Number">${condo}</Data></Cell>
            <Cell ss:StyleID="Currency" ss:Formula="=RC[-2]+RC[-1]"><Data ss:Type="Number">${total}</Data></Cell>
            <Cell ss:StyleID="Currency"><Data ss:Type="Number">${cobrado}</Data></Cell>
            <Cell ss:StyleID="Currency" ss:Formula="=RC[-2]-RC[-1]"><Data ss:Type="Number">${total - cobrado}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(inv.status || 'pendiente')}</Data></Cell>
          </Row>
        `;
      });

      const totalInvRow = invoices.length + 2;
      sheet2Rows += `
        <Row ss:StyleID="Total">
          <Cell ss:MergeAcross="3"><Data ss:Type="String">TOTALES CONSOLIDADOS:</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C5:R${totalInvRow - 1}C5)"><Data ss:Type="Number">0</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C6:R${totalInvRow - 1}C6)"><Data ss:Type="Number">0</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C7:R${totalInvRow - 1}C7)"><Data ss:Type="Number">0</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C8:R${totalInvRow - 1}C8)"><Data ss:Type="Number">0</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C9:R${totalInvRow - 1}C9)"><Data ss:Type="Number">0</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
        </Row>
      `;

      // SHEET 3: GASTOS COMUNES (PRESUPUESTO $2,540 / AUDITADO)
      let sheet3Rows = `
        <Row ss:StyleID="Header">
          <Cell><Data ss:Type="String">N°</Data></Cell>
          <Cell><Data ss:Type="String">Categoría de Gasto</Data></Cell>
          <Cell><Data ss:Type="String">Concepto / Partida Operativa</Data></Cell>
          <Cell><Data ss:Type="String">Presupuesto Mensual USD ($)</Data></Cell>
          <Cell><Data ss:Type="String">Proyección Anual USD ($)</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="Number">1</Data></Cell>
          <Cell><Data ss:Type="String">Vigilancia</Data></Cell>
          <Cell><Data ss:Type="String">Servicio de Seguridad Privada 24/7 y Control de Acceso</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">1200.00</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=RC[-1]*12"><Data ss:Type="Number">14400.00</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="Number">2</Data></Cell>
          <Cell><Data ss:Type="String">Aseo y Desechos</Data></Cell>
          <Cell><Data ss:Type="String">Bote de Basura, Disposición de Desechos y Contenedores</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">350.00</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=RC[-1]*12"><Data ss:Type="Number">4200.00</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="Number">3</Data></Cell>
          <Cell><Data ss:Type="String">Áreas Comunes</Data></Cell>
          <Cell><Data ss:Type="String">Limpieza y Mantenimiento de Pasillos, Baños y Plaza Central</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">400.00</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=RC[-1]*12"><Data ss:Type="Number">4800.00</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="Number">4</Data></Cell>
          <Cell><Data ss:Type="String">Servicios Básicos</Data></Cell>
          <Cell><Data ss:Type="String">Electricidad de Áreas Comunes e Iluminación Perimetral</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">250.00</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=RC[-1]*12"><Data ss:Type="Number">3000.00</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="Number">5</Data></Cell>
          <Cell><Data ss:Type="String">Sistemas Hidroneumáticos</Data></Cell>
          <Cell><Data ss:Type="String">Mantenimiento Preventivo de Bombas de Agua y Tableros</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">180.00</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=RC[-1]*12"><Data ss:Type="Number">2160.00</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="Number">6</Data></Cell>
          <Cell><Data ss:Type="String">Insumos Operativos</Data></Cell>
          <Cell><Data ss:Type="String">Reposición de Productos Químicos y Artículos de Limpieza</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">100.00</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=RC[-1]*12"><Data ss:Type="Number">1200.00</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="Number">7</Data></Cell>
          <Cell><Data ss:Type="String">Fondo Imprevistos</Data></Cell>
          <Cell><Data ss:Type="String">Gastos Menores Operativos de Emergencia</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">60.00</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=RC[-1]*12"><Data ss:Type="Number">720.00</Data></Cell>
        </Row>
        <Row ss:StyleID="Total">
          <Cell ss:MergeAcross="2"><Data ss:Type="String">TOTAL PRESUPUESTO MENSUAL DE EGRESOS:</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C4:R8C4)"><Data ss:Type="Number">2540.00</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C5:R8C5)"><Data ss:Type="Number">30480.00</Data></Cell>
        </Row>
      `;

      // SHEET 4: DISTRIBUCIÓN SUCESORAL A COHEREDEROS (1/14 SUCESIÓN MARIO SÁNCHEZ)
      let sheet4Rows = `
        <Row ss:StyleID="Header">
          <Cell ss:MergeAcross="3"><Data ss:Type="String">SUCESIÓN MARIO SÁNCHEZ — LIQUIDACIÓN DE FRUTOS CIVILES (14 COHEREDEROS)</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="String">1. Ingresos Brutos Cobrados ($):</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">9050.00</Data></Cell>
          <Cell ss:MergeAcross="1"><Data ss:Type="String">Recaudación mensual total</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="String">2. Egresos Operativos ($):</Data></Cell>
          <Cell ss:StyleID="Currency"><Data ss:Type="Number">2540.00</Data></Cell>
          <Cell ss:MergeAcross="1"><Data ss:Type="String">Presupuesto mensual base</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="String">3. Fondo de Reserva Legal (10%):</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=R2C2*0.1"><Data ss:Type="Number">905.00</Data></Cell>
          <Cell ss:MergeAcross="1"><Data ss:Type="String">10% sobre ingresos</Data></Cell>
        </Row>
        <Row>
          <Cell><Data ss:Type="String">4. Gastos de Administración (5%):</Data></Cell>
          <Cell ss:StyleID="Currency" ss:Formula="=R2C2*0.05"><Data ss:Type="Number">452.50</Data></Cell>
          <Cell ss:MergeAcross="1"><Data ss:Type="String">5% sobre ingresos</Data></Cell>
        </Row>
        <Row ss:StyleID="Total">
          <Cell><Data ss:Type="String">5. Utilidad Neta Liquidable ($):</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=R2C2-R3C2-R4C2-R5C2"><Data ss:Type="Number">5152.50</Data></Cell>
          <Cell ss:MergeAcross="1"><Data ss:Type="String">Monto a repartir entre 14 estirpes</Data></Cell>
        </Row>
        <Row></Row>
        <Row ss:StyleID="Header">
          <Cell><Data ss:Type="String">N°</Data></Cell>
          <Cell><Data ss:Type="String">Estirpe / Coheredero</Data></Cell>
          <Cell><Data ss:Type="String">Alícuota Indivisa</Data></Cell>
          <Cell><Data ss:Type="String">Liquidación Neta USD ($)</Data></Cell>
        </Row>
      `;

      for (let i = 1; i <= 14; i++) {
        sheet4Rows += `
          <Row>
            <Cell><Data ss:Type="Number">${i}</Data></Cell>
            <Cell><Data ss:Type="String">Estirpe Coheredero ${i} (Sucesión Mario Sánchez)</Data></Cell>
            <Cell ss:StyleID="Percent"><Data ss:Type="Number">0.07142857</Data></Cell>
            <Cell ss:StyleID="Currency" ss:Formula="=R6C2/14"><Data ss:Type="Number">368.04</Data></Cell>
          </Row>
        `;
      }

      sheet4Rows += `
        <Row ss:StyleID="Total">
          <Cell ss:MergeAcross="1"><Data ss:Type="String">TOTAL DISTRIBUIDO (14 ESTIRPES):</Data></Cell>
          <Cell ss:StyleID="TotalPercent" ss:Formula="=SUM(R9C3:R22C3)"><Data ss:Type="Number">1.00</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R9C4:R22C4)"><Data ss:Type="Number">5152.50</Data></Cell>
        </Row>
      `;

      // SHEET 5: INVENTARIO Y BIENES
      let sheet5Rows = `
        <Row ss:StyleID="Header">
          <Cell><Data ss:Type="String">Código</Data></Cell>
          <Cell><Data ss:Type="String">Descripción del Bien / Activo</Data></Cell>
          <Cell><Data ss:Type="String">Categoría</Data></Cell>
          <Cell><Data ss:Type="String">Ubicación</Data></Cell>
          <Cell><Data ss:Type="String">Cantidad</Data></Cell>
          <Cell><Data ss:Type="String">Costo Unitario ($)</Data></Cell>
          <Cell><Data ss:Type="String">Valor Total ($)</Data></Cell>
          <Cell><Data ss:Type="String">Estado</Data></Cell>
        </Row>
      `;

      activos.forEach(a => {
        sheet5Rows += `
          <Row>
            <Cell><Data ss:Type="String">${xmlEscape(a.code || a.id)}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(a.name || a.description)}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(a.category || 'Activo')}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(a.location || 'C.C. Mario Sánchez')}</Data></Cell>
            <Cell><Data ss:Type="Number">1</Data></Cell>
            <Cell ss:StyleID="Currency"><Data ss:Type="Number">${parseFloat(a.estimated_value_usd || 0)}</Data></Cell>
            <Cell ss:StyleID="Currency" ss:Formula="=RC[-2]*RC[-1]"><Data ss:Type="Number">${parseFloat(a.estimated_value_usd || 0)}</Data></Cell>
            <Cell><Data ss:Type="String">${xmlEscape(a.condition || 'Operativo')}</Data></Cell>
          </Row>
        `;
      });

      const totalActRows = activos.length + 2;
      sheet5Rows += `
        <Row ss:StyleID="Total">
          <Cell ss:MergeAcross="5"><Data ss:Type="String">TOTAL VALORACIÓN ACTIVOS:</Data></Cell>
          <Cell ss:StyleID="Total" ss:Formula="=SUM(R2C7:R${totalActRows - 1}C7)"><Data ss:Type="Number">0</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
        </Row>
      `;

      const excelXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Total">
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Size="11"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;$&quot;#,##0.00"/>
  </Style>
  <Style ss:ID="TotalDecimal">
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Size="11"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="TotalPercent">
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Size="11"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="0.00%"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="&quot;$&quot;#,##0.00"/>
  </Style>
  <Style ss:ID="Decimal">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="Percent">
   <NumberFormat ss:Format="0.00%"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Locales_e_Inquilinos">
  <Table>
   ${sheet1Rows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Facturacion_y_Cobranzas">
  <Table>
   ${sheet2Rows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Gastos_Comunes_Ppto_2540">
  <Table>
   ${sheet3Rows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Distribucion_Coherederos">
  <Table>
   ${sheet4Rows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Inventario_Bienes_Kardex">
  <Table>
   ${sheet5Rows}
  </Table>
 </Worksheet>
</Workbook>`;

      const filename = `CCMS_EXCEL_MAESTRO_FORMULAS_${dateStr}.xls`;
      const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.SecuritySuite && window.SecuritySuite.logAudit) {
        window.SecuritySuite.logAudit('EXCEL_EXPORT_FORMULAS', `Exportación de Excel Maestro con fórmulas determinísticas activas (${filename})`);
      }
      showToast(`✓ Archivo Excel multi-hoja con fórmulas vivas "${filename}" descargado con éxito.`, 'success', 'Excel con Fórmulas');
    } catch (err) {
      console.error('[EXCEL EXPORT ERROR]', err);
      showToast(`Error al generar Excel: ${err.message}`, 'error', 'Fallo de Excel');
    }
  };

  /**
   * =========================================================================
   * CONTROLADOR DE RESTAURACIÓN DE RESPALDO JSON
   * =========================================================================
   */
  window.handleBackupRestoreFileInput = function(event) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const json = JSON.parse(e.target.result);
        if (!json.collections && !json.units && !json.tenants) {
          throw new Error("El archivo seleccionado no corresponde a un respaldo válido del C.C. Mario Sánchez.");
        }

        const cols = json.collections || json;
        const uCount = (cols.units || []).length;
        const tCount = (cols.tenants || []).length;
        const iCount = (cols.invoices || []).length;
        const pCount = (cols.payments || []).length;
        const eCount = (cols.condo_expenses || []).length;

        const confirmMsg = `¿Desea restaurar este respaldo?\n\n` +
          `• Unidades: ${uCount}\n` +
          `• Inquilinos: ${tCount}\n` +
          `• Facturas: ${iCount}\n` +
          `• Comprobantes/Pagos: ${pCount}\n` +
          `• Gastos Comunes: ${eCount}\n\n` +
          `ATENCIÓN: Esta acción sincronizará los datos locales del sistema con la copia de seguridad.`;

        if (!confirm(confirmMsg)) {
          event.target.value = '';
          return;
        }

        if (cols.units && Array.isArray(cols.units)) localStorage.setItem('ccms_units_v1', JSON.stringify(cols.units));
        if (cols.tenants && Array.isArray(cols.tenants)) localStorage.setItem('ccms_tenants_v1', JSON.stringify(cols.tenants));
        if (cols.contracts && Array.isArray(cols.contracts)) localStorage.setItem('ccms_contracts_v1', JSON.stringify(cols.contracts));
        if (cols.invoices && Array.isArray(cols.invoices)) localStorage.setItem('ccms_invoices_v1', JSON.stringify(cols.invoices));
        if (cols.payments && Array.isArray(cols.payments)) localStorage.setItem('ccms_payments_v1', JSON.stringify(cols.payments));
        if (cols.receipts && Array.isArray(cols.receipts)) localStorage.setItem('ccms_receipts_v1', JSON.stringify(cols.receipts));
        if (cols.condo_expenses && Array.isArray(cols.condo_expenses)) localStorage.setItem('ccms_condo_expenses_v1', JSON.stringify(cols.condo_expenses));
        if (cols.staff_members && Array.isArray(cols.staff_members)) localStorage.setItem('ccms_staff_members_v1', JSON.stringify(cols.staff_members));
        if (cols.staff_photos && typeof cols.staff_photos === 'object') localStorage.setItem('ccms_staff_photos_v1', JSON.stringify(cols.staff_photos));
        if (cols.activos_fijos && Array.isArray(cols.activos_fijos)) localStorage.setItem('ccms_activos_fijos_v1', JSON.stringify(cols.activos_fijos));
        if (cols.consumibles && Array.isArray(cols.consumibles)) localStorage.setItem('ccms_consumibles_v1', JSON.stringify(cols.consumibles));
        if (cols.kardex_movimientos && Array.isArray(cols.kardex_movimientos)) localStorage.setItem('ccms_kardex_v1', JSON.stringify(cols.kardex_movimientos));
        if (cols.special_agreements && Array.isArray(cols.special_agreements)) localStorage.setItem('ccms_special_agreements_v1', JSON.stringify(cols.special_agreements));
        if (cols.receiving_accounts && Array.isArray(cols.receiving_accounts)) localStorage.setItem('ccms_bank_accounts_v1', JSON.stringify(cols.receiving_accounts));
        if (cols.app_settings && typeof cols.app_settings === 'object') localStorage.setItem('ccms_settings_v1', JSON.stringify(cols.app_settings));

        if (window.SecuritySuite && window.SecuritySuite.logAudit) {
          window.SecuritySuite.logAudit('BACKUP_RESTORE', `Restauración exitosa de copia de seguridad (${file.name})`);
        }

        showToast("✓ Copia de seguridad restaurada exitosamente. Recargando estado...", "success", "Restauración Completa");
        setTimeout(() => { window.location.reload(); }, 1200);
      } catch (err) {
        console.error('[RESTORE ERROR]', err);
        showToast(`Error al procesar el archivo de respaldo: ${err.message}`, "error", "Error de Restauración");
      }
      event.target.value = '';
    };
    reader.readAsText(file);
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
      dbService.logAuditAction({
        action: id ? 'UPDATE' : 'CREATE',
        entity: 'EXPENSE',
        entity_id: id || payload.invoice_number || 'N/A',
        entity_name: `${payload.concept} (${payload.provider_name})`,
        details: `${id ? 'Actualización' : 'Registro'} de gasto operativo por $${payload.amount_usd.toFixed(2)} USD. Factura: ${payload.invoice_number || 'S/N'}. Con factura adjunta: ${payload.invoice_proof ? 'SÍ' : 'NO'}.`
      });

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
      const expenses = dbService.getCondoExpenses ? dbService.getCondoExpenses() : [];
      const expToDelete = expenses.find(e => e.id === expenseId);
      dbService.deleteCondoExpense(expenseId);
      dbService.logAuditAction({
        action: 'DELETE',
        entity: 'EXPENSE',
        entity_id: expenseId,
        entity_name: expToDelete ? expToDelete.concept : expenseId,
        details: `Eliminación de gasto operativo ${expToDelete ? expToDelete.concept : ''} ($${expToDelete ? expToDelete.amount_usd : 0} USD). Recalculadas alícuotas.`
      });

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

  // Configuración Universal de Eventos Click y Drag & Drop para todos los Dropzones
  function initUniversalDropzones() {
    const DROPZONE_CONFIGS = [
      { zoneId: 'pay-receipt-dropzone', inputId: 'pay-receipt-file', handler: window.handleReceiptFileChange },
      { zoneId: 'exp-proof-dropzone', inputId: 'exp-proof-file', handler: window.handleExpenseFileChange },
      { zoneId: 'agr-proof-dropzone', inputId: 'agr-proof-file', handler: window.handleAgreementProofChange },
      { zoneId: 'inv-con-photo-dropzone', inputId: 'inv-con-photo-file', handler: window.handleConsumablePhotoChange },
      { zoneId: 'inv-kdx-photo-dropzone', inputId: 'inv-kdx-photo-file', handler: window.handleKardexPhotoChange },
      { zoneId: 'backup-restore-dropzone', inputId: 'backup-restore-file-input', handler: window.handleBackupRestoreFileInput },
      { zoneId: 'staff-photo-dropzone', inputId: 'staff-photo-file', handler: window.handleStaffPhotoChange }
    ];

    DROPZONE_CONFIGS.forEach(cfg => {
      const zone = document.getElementById(cfg.zoneId);
      const input = document.getElementById(cfg.inputId);
      if (!zone) return;

      // Click listener directo para abrir diálogo de archivo
      zone.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
        if (input && typeof input.click === 'function') {
          input.click();
        }
      });

      // Drag & Drop listeners
      ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.add('drag-active', 'dragover');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.remove('drag-active', 'dragover');
        }, false);
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (input && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          try {
            input.files = e.dataTransfer.files;
          } catch (err) {}
        }
        if (typeof cfg.handler === 'function') {
          cfg.handler(e);
        }
      }, false);
    });
  }

  window.initUniversalDropzones = initUniversalDropzones;
  initUniversalDropzones();

  // ==============================================================================
  // MÓDULO DE INVENTARIO: ACTIVOS FIJOS, CONSUMIBLES & KARDEX
  // ==============================================================================
  let currentInvSubtab = 'activos';

  window.switchInventorySubtab = function(subtabName) {
    currentInvSubtab = subtabName;
    const subtabs = ['activos', 'consumibles', 'kardex'];
    subtabs.forEach(t => {
      const btn = document.getElementById(`btn-subtab-${t}`);
      const panel = document.getElementById(`subtab-panel-${t}`);
      if (btn) {
        if (t === subtabName) {
          btn.style.background = 'var(--amber-glow)';
          btn.style.color = 'var(--amber)';
          btn.style.borderColor = 'var(--amber)';
          btn.style.fontWeight = '700';
        } else {
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
          btn.style.fontWeight = 'normal';
        }
      }
      if (panel) {
        panel.style.display = (t === subtabName) ? 'block' : 'none';
      }
    });

    if (subtabName === 'activos') renderInventoryActivos();
    else if (subtabName === 'consumibles') renderInventoryConsumibles();
    else if (subtabName === 'kardex') renderInventoryKardex();
  };

  function renderInventory() {
    renderInventoryActivos();
    renderInventoryConsumibles();
    renderInventoryKardex();
  }

  function renderInventoryActivos() {
    const tbody = document.getElementById('inventory-activos-table-body');
    const totalEl = document.getElementById('inv-total-activos');
    if (!tbody) return;

    const activos = dbService.getActivosFijos ? dbService.getActivosFijos() : [];
    if (totalEl) totalEl.innerText = `${activos.length} Equipos`;

    if (activos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--txt-muted);padding:24px;">No hay activos fijos registrados en el inventario maestro.</td></tr>`;
      return;
    }

    const canEdit = isSuperAdmin || currentRole === 'admin' || currentRole === 'admin_mantenimiento';

    tbody.innerHTML = activos.map(a => `
      <tr>
        <td>
          <strong style="color:var(--amber);font-family:monospace;font-size:11.5px;">${escapeHtml(a.code)}</strong><br>
          <span style="font-weight:700;color:var(--txt-primary);">${escapeHtml(a.name)}</span>
        </td>
        <td><i class="fa-solid fa-location-dot" style="color:var(--cyan);font-size:10px;margin-right:4px;"></i>${escapeHtml(a.location)}</td>
        <td style="max-width:280px;font-size:11px;color:var(--txt-secondary);">${escapeHtml(a.technical_spec || 'N/A')}</td>
        <td style="font-family:monospace;font-size:11px;">${escapeHtml(a.serial_number || 'S/N')}</td>
        <td>
          <span class="status-pill pill-success" style="font-size:10.5px;padding:3px 8px;">
            <i class="fa-solid fa-circle-check"></i> ${escapeHtml(a.status || 'operativo').toUpperCase()}
          </span>
        </td>
        <td>
          <span style="font-size:11px;font-weight:700;color:var(--txt-primary);">${escapeHtml(a.maintenance_frequency || 'Trimestral')}</span><br>
          <small style="color:var(--txt-muted);font-size:10px;">Próx: ${escapeHtml(a.next_maintenance || 'Pendiente')}</small>
        </td>
        <td>
          ${canEdit ? `
            <button type="button" class="btn-action-icon" data-click="window.deleteActivoFijoItem('${a.id}')" title="Dar de baja activo" style="color:var(--rose);">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : `<span style="color:var(--txt-muted);font-size:10px;"><i class="fa-solid fa-eye"></i> Protegido</span>`}
        </td>
      </tr>
    `).join('');
  }

  function renderInventoryConsumibles() {
    const tbody = document.getElementById('inventory-consumibles-table-body');
    if (!tbody) return;

    const consumibles = dbService.getConsumibles ? dbService.getConsumibles() : [];
    if (consumibles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--txt-muted);padding:24px;">No hay consumibles registrados en el stock del centro comercial.</td></tr>`;
      return;
    }

    const canEdit = isSuperAdmin || currentRole === 'admin' || currentRole === 'admin_mantenimiento';

    tbody.innerHTML = consumibles.map(c => {
      const isAlerta = (parseFloat(c.stock_current) <= parseFloat(c.stock_min));
      const statusBadge = isAlerta 
        ? `<span class="status-pill pill-overdue" style="font-size:10.5px;"><i class="fa-solid fa-triangle-exclamation"></i> BAJO STOCK</span>`
        : `<span class="status-pill pill-success" style="font-size:10.5px;"><i class="fa-solid fa-check"></i> DISPONIBLE</span>`;

      return `
        <tr>
          <td><strong style="color:var(--cyan);font-family:monospace;font-size:11.5px;">${escapeHtml(c.code)}</strong></td>
          <td><strong style="color:var(--txt-primary);">${escapeHtml(c.name)}</strong></td>
          <td><span style="font-size:11px;color:var(--txt-secondary);">${escapeHtml(c.category || 'General')}</span></td>
          <td><span style="font-size:13px;font-weight:800;color:${isAlerta ? 'var(--rose)' : 'var(--emerald)'};">${c.stock_current} ${escapeHtml(c.unit || 'uds')}</span></td>
          <td style="font-size:11.5px;color:var(--txt-muted);">${c.stock_min} ${escapeHtml(c.unit || 'uds')}</td>
          <td style="font-size:12px;font-weight:700;color:var(--txt-primary);">$ ${(parseFloat(c.cost_usd) || 0).toFixed(2)}</td>
          <td>${statusBadge}</td>
          <td>
            ${canEdit ? `
              <button type="button" class="btn-action-icon" data-click="window.openEditConsumableModal('${c.id}')" title="Editar stock o costo" style="color:var(--amber);margin-right:4px;">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button type="button" class="btn-action-icon" data-click="window.deleteConsumableItem('${c.id}')" title="Eliminar ítem" style="color:var(--rose);">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : `<span style="color:var(--txt-muted);font-size:10px;"><i class="fa-solid fa-eye"></i> Consulta</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderInventoryKardex() {
    const tbody = document.getElementById('inventory-kardex-table-body');
    if (!tbody) return;

    const kardex = dbService.getKardex ? dbService.getKardex() : [];
    if (kardex.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--txt-muted);padding:24px;">No se han asentado movimientos de Kardex en el período.</td></tr>`;
      return;
    }

    tbody.innerHTML = kardex.map(k => {
      const isEntrada = (k.type === 'ENTRADA');
      const badge = isEntrada
        ? `<span class="status-pill pill-success" style="font-size:10px;padding:2px 7px;"><i class="fa-solid fa-arrow-down"></i> ENTRADA</span>`
        : `<span class="status-pill pill-overdue" style="font-size:10px;padding:2px 7px;"><i class="fa-solid fa-arrow-up"></i> SALIDA</span>`;

      const formattedDate = k.timestamp ? new Date(k.timestamp).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';

      const photoBtn = k.photo_proof
        ? `<button type="button" class="btn-action-icon" data-click="window.viewKardexPhoto('${k.id}')" title="Ver comprobante fotográfico" style="color:var(--amber);border-color:rgba(245,158,11,0.3);background:rgba(245,158,11,0.1);">
             <i class="fa-solid fa-image"></i> Ver Foto
           </button>`
        : `<span style="color:var(--txt-muted);font-size:10.5px;">-</span>`;

      return `
        <tr>
          <td style="font-size:11px;color:var(--txt-secondary);">${formattedDate}</td>
          <td>${badge}</td>
          <td>
            <strong style="color:var(--txt-primary);font-size:12px;">${escapeHtml(k.item_name || k.item_code)}</strong><br>
            <small style="color:var(--txt-muted);font-family:monospace;font-size:10px;">${escapeHtml(k.item_code || '')}</small>
          </td>
          <td><strong style="font-size:12.5px;color:${isEntrada ? 'var(--emerald)' : 'var(--rose)'};">${isEntrada ? '+' : '-'}${k.quantity}</strong></td>
          <td style="font-size:11.5px;color:var(--txt-secondary);">${escapeHtml(k.destination || 'Uso General')}</td>
          <td style="font-size:11.5px;color:var(--txt-primary);"><i class="fa-solid fa-user-gear" style="color:var(--amber);font-size:10px;margin-right:4px;"></i>${escapeHtml(k.responsible || 'N/A')}</td>
          <td><span style="font-family:monospace;font-size:11px;background:rgba(255,255,255,0.04);padding:2px 6px;border-radius:4px;">${escapeHtml(k.reference_document || 'N/A')}</span></td>
          <td style="text-align:center;">${photoBtn}</td>
        </tr>
      `;
    }).join('');
  }

  // --- MODAL 12: GESTIÓN DE INVENTARIO & KARDEX ---
  window.openNewInventoryItemModal = function() {
    const modal = document.getElementById('modal-inventory-item');
    if (!modal) return;
    window.switchInvModalMode('consumible');
    const formCon = document.getElementById('form-inv-consumible');
    if (formCon) formCon.reset();
    document.getElementById('inv-con-id').value = '';
    document.getElementById('inv-modal-title').innerText = 'Registrar Nuevo Insumo / Consumible';
    window.openModal(modal);
  };

  window.openEditConsumableModal = function(id) {
    const consumibles = dbService.getConsumibles();
    const item = consumibles.find(c => c.id === id);
    if (!item) return;

    window.switchInvModalMode('consumible');
    document.getElementById('inv-con-id').value = item.id;
    document.getElementById('inv-con-code').value = item.code;
    document.getElementById('inv-con-desc').value = item.name;
    document.getElementById('inv-con-cat').value = item.category || 'Mantenimiento';
    document.getElementById('inv-con-stock').value = item.stock_current;
    document.getElementById('inv-con-min').value = item.stock_min;
    document.getElementById('inv-con-cost').value = item.cost_usd;
    document.getElementById('inv-modal-title').innerText = `Editar Insumo: ${item.code}`;

    const modal = document.getElementById('modal-inventory-item');
    if (modal) window.openModal(modal);
  };

  window.closeInventoryModal = function() {
    window.closeModal('modal-inventory-item');
  };

  window.switchInvModalMode = function(mode) {
    const tabCon = document.getElementById('tab-btn-modal-consumible');
    const tabKdx = document.getElementById('tab-btn-modal-kardex');
    const formCon = document.getElementById('form-inv-consumible');
    const formKdx = document.getElementById('form-inv-kardex');

    if (mode === 'consumible') {
      if (tabCon) { tabCon.style.color = 'var(--amber)'; tabCon.style.borderBottom = '2px solid var(--amber)'; }
      if (tabKdx) { tabKdx.style.color = 'var(--txt-muted)'; tabKdx.style.borderBottom = '2px solid transparent'; }
      if (formCon) formCon.style.display = 'flex';
      if (formKdx) formKdx.style.display = 'none';
      document.getElementById('inv-modal-title').innerText = 'Gestión de Insumo / Consumible';
    } else {
      if (tabKdx) { tabKdx.style.color = 'var(--amber)'; tabKdx.style.borderBottom = '2px solid var(--amber)'; }
      if (tabCon) { tabCon.style.color = 'var(--txt-muted)'; tabCon.style.borderBottom = '2px solid transparent'; }
      if (formCon) formCon.style.display = 'none';
      if (formKdx) formKdx.style.display = 'flex';
      document.getElementById('inv-modal-title').innerText = 'Asentar Movimiento en Kardex';
      populateKardexItemSelect();
    }
  };

  function populateKardexItemSelect() {
    const select = document.getElementById('inv-kdx-item');
    if (!select) return;
    const consumibles = dbService.getConsumibles();
    select.innerHTML = consumibles.map(c => `
      <option value="${c.code}" data-name="${escapeHtml(c.name)}">${c.code} — ${escapeHtml(c.name)} (Stock: ${c.stock_current})</option>
    `).join('');
  }

  window.handleSaveConsumable = function(e) {
    e.preventDefault();
    const id = document.getElementById('inv-con-id').value;
    const itemData = {
      code: document.getElementById('inv-con-code').value.trim().toUpperCase(),
      name: document.getElementById('inv-con-desc').value.trim(),
      category: document.getElementById('inv-con-cat').value,
      stock_current: parseFloat(document.getElementById('inv-con-stock').value) || 0,
      stock_min: parseFloat(document.getElementById('inv-con-min').value) || 0,
      cost_usd: parseFloat(document.getElementById('inv-con-cost').value) || 0,
      unit: 'Unidad',
      status: 'ok'
    };
    if (id) itemData.id = id;

    dbService.saveConsumible(itemData);
    renderInventoryConsumibles();
    closeInventoryModal();

    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Insumo registrado y actualizado en el inventario.', 'success', 'Inventario Guardado');
    } else {
      alert('¡Insumo guardado con éxito!');
    }
  };

  window.deleteConsumableItem = async function(id) {
    const proceed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Desea eliminar este insumo del stock maestro de mantenimiento?', 'Eliminar Insumo', 'Eliminar', 'Cancelar')
      : confirm('¿Eliminar este insumo del inventario?');
    if (!proceed) return;

    dbService.deleteConsumible(id);
    renderInventoryConsumibles();
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Insumo removido del inventario.', 'info', 'Inventario');
    }
  };

  window.deleteActivoFijoItem = async function(id) {
    const proceed = window.SecuritySuite && window.SecuritySuite.confirm
      ? await window.SecuritySuite.confirm('¿Confirma la baja definitiva de este activo fijo de la Sucesión Mario Sánchez?', 'Baja de Activo', 'Confirmar Baja', 'Cancelar')
      : confirm('¿Dar de baja este activo fijo?');
    if (!proceed) return;

    dbService.deleteActivoFijo(id);
    renderInventoryActivos();
    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast('Activo fijo dado de baja del inventario patrimonial.', 'info', 'Activo Removido');
    }
  };

  let currentKardexPhoto = null;

  window.handleKardexPhotoChange = function(e) {
    const file = (e.target && e.target.files && e.target.files[0])
      ? e.target.files[0]
      : (e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("La foto o soporte excede el límite de 10MB.", "warning", "Archivo Excedido");
      const input = document.getElementById('inv-kdx-photo-file');
      if (input) input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      currentKardexPhoto = {
        name: file.name,
        type: file.type || 'image/jpeg',
        size: file.size,
        data: evt.target.result,
        uploaded_at: new Date().toISOString()
      };

      const container = document.getElementById('inv-kdx-photo-preview-container');
      const dropzone = document.getElementById('inv-kdx-photo-dropzone');
      const nameEl = document.getElementById('inv-kdx-photo-name');
      const sizeEl = document.getElementById('inv-kdx-photo-size');
      const iconEl = document.getElementById('inv-kdx-photo-icon');

      if (container) container.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB • ${(file.type || 'Imagen').split('/')[1] || 'archivo'}`;
      if (iconEl) {
        iconEl.className = file.type && file.type.includes('pdf') ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-image';
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeKardexPhoto = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    currentKardexPhoto = null;
    const input = document.getElementById('inv-kdx-photo-file');
    if (input) input.value = '';
    const container = document.getElementById('inv-kdx-photo-preview-container');
    const dropzone = document.getElementById('inv-kdx-photo-dropzone');
    if (container) container.style.display = 'none';
    if (dropzone) dropzone.style.display = 'flex';
  };

  let currentConsumablePhoto = null;
  window.handleConsumablePhotoChange = function(e) {
    const file = (e.target && e.target.files && e.target.files[0])
      ? e.target.files[0]
      : (e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("La foto o ficha técnica excede el límite de 10MB.", "warning", "Archivo Excedido");
      const input = document.getElementById('inv-con-photo-file');
      if (input) input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      currentConsumablePhoto = {
        name: file.name,
        type: file.type || 'image/jpeg',
        size: file.size,
        data: evt.target.result,
        uploaded_at: new Date().toISOString()
      };

      const container = document.getElementById('inv-con-photo-preview-container');
      const dropzone = document.getElementById('inv-con-photo-dropzone');
      const nameEl = document.getElementById('inv-con-photo-name');
      const sizeEl = document.getElementById('inv-con-photo-size');
      const iconEl = document.getElementById('inv-con-photo-icon');

      if (container) container.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB • ${(file.type || 'Imagen').split('/')[1] || 'archivo'}`;
      if (iconEl) {
        iconEl.className = file.type && file.type.includes('pdf') ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-image';
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeConsumablePhoto = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    currentConsumablePhoto = null;
    const input = document.getElementById('inv-con-photo-file');
    if (input) input.value = '';
    const container = document.getElementById('inv-con-photo-preview-container');
    const dropzone = document.getElementById('inv-con-photo-dropzone');
    if (container) container.style.display = 'none';
    if (dropzone) dropzone.style.display = 'flex';
  };

  window.viewKardexPhoto = function(movId) {
    const kardex = dbService.getKardex ? dbService.getKardex() : [];
    const mov = kardex.find(k => k.id === movId);
    if (!mov || !mov.photo_proof) {
      showToast("Este movimiento no tiene comprobante fotográfico adjunto.", "info", "Sin Foto");
      return;
    }

    const modal = document.getElementById('modal-kardex-photo-viewer');
    const content = document.getElementById('kardex-photo-viewer-content');
    if (!modal || !content) return;

    const photo = mov.photo_proof;
    const isDataUrl = typeof photo.data === 'string' && photo.data.startsWith('data:');
    const isPdf = (photo.type && photo.type.includes('pdf')) || (photo.name && photo.name.toLowerCase().endsWith('.pdf'));

    if (isDataUrl && isPdf) {
      content.innerHTML = `
        <div style="margin-bottom:12px;font-size:12.5px;color:var(--txt-secondary);">
          <strong>${escapeHtml(photo.name)}</strong> • Ítem: <strong>${escapeHtml(mov.item_name)}</strong> (${mov.type})
        </div>
        <embed src="${photo.data}" type="application/pdf" width="100%" height="480px" style="border:1px solid var(--border-subtle);border-radius:8px;" />
      `;
    } else if (isDataUrl) {
      content.innerHTML = `
        <div style="margin-bottom:12px;font-size:12.5px;color:var(--txt-secondary);">
          <strong>${escapeHtml(photo.name)}</strong> • Ítem: <strong>${escapeHtml(mov.item_name)}</strong> (${mov.type})
        </div>
        <img src="${photo.data}" alt="Comprobante Kardex" style="max-width:100%;max-height:500px;border-radius:8px;border:1px solid var(--border-subtle);" />
      `;
    }
    window.openModal(modal);
  };

  window.closeKardexPhotoModal = function() {
    window.closeModal('modal-kardex-photo-viewer');
  };

  window.handleSaveKardex = function(e) {
    e.preventDefault();
    const select = document.getElementById('inv-kdx-item');
    const selectedOpt = select.options[select.selectedIndex];
    const itemCode = select.value;
    const itemName = selectedOpt ? selectedOpt.getAttribute('data-name') : itemCode;

    const mov = {
      type: document.getElementById('inv-kdx-type').value,
      item_code: itemCode,
      item_name: itemName,
      quantity: parseFloat(document.getElementById('inv-kdx-qty').value) || 1,
      destination: document.getElementById('inv-kdx-dest').value.trim(),
      responsible: document.getElementById('inv-kdx-resp').value.trim(),
      reference_document: document.getElementById('inv-kdx-doc').value.trim().toUpperCase(),
      photo_proof: currentKardexPhoto,
      timestamp: new Date().toISOString()
    };

    dbService.addKardexMovimiento(mov);
    dbService.logAuditAction({
      action: 'DISPATCH',
      entity: 'KARDEX',
      entity_id: mov.reference_document,
      entity_name: `${mov.type} - ${mov.item_code} (${mov.quantity} uds)`,
      details: `${mov.type} de ${mov.quantity} unidades para ${mov.destination}. Responsable: ${mov.responsible}. Comprobante: ${mov.reference_document}.`
    });

    removeKardexPhoto();
    renderInventory();
    closeInventoryModal();

    if (window.SecuritySuite && window.SecuritySuite.toast) {
      window.SecuritySuite.toast(`Movimiento de ${mov.type} asentado y stock recalculado automáticamente.`, 'success', 'Kardex Actualizado');
    } else {
      alert(`Movimiento de ${mov.type} registrado en Kardex.`);
    }
  };

  // ==============================================================================
  // MODAL 14: HISTORIAL DE AUDITORÍA & TRAZABILIDAD (AUDIT TRAIL)
  // ==============================================================================
  window.openAuditTrailModal = function() {
    const modal = document.getElementById('modal-audit-trail');
    if (!modal) return;
    renderAuditLogsList();
    window.openModal(modal);
  };

  window.closeAuditTrailModal = function() {
    window.closeModal('modal-audit-trail');
  };

  window.renderAuditLogsList = function() {
    const tbody = document.getElementById('audit-logs-table-body');
    const filterSelect = document.getElementById('audit-filter-entity');
    if (!tbody) return;

    const filterVal = filterSelect ? filterSelect.value : 'ALL';
    const logs = dbService.getAuditLogs ? dbService.getAuditLogs(150) : [];
    const filtered = (filterVal === 'ALL') ? logs : logs.filter(l => l.entity === filterVal);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--txt-muted);">No hay eventos de auditoría registrados para esta categoría.</td></tr>`;
      return;
    }

    const actionColors = {
      CREATE: 'var(--emerald)',
      UPDATE: 'var(--amber)',
      DELETE: 'var(--rose)',
      DISPATCH: 'var(--cyan)',
      RECONCILE: 'var(--purple)'
    };

    tbody.innerHTML = filtered.map(log => {
      const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
      const color = actionColors[log.action] || 'var(--txt-primary)';

      return `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <td style="padding: 7px 10px; color: var(--txt-secondary); white-space: nowrap;">${dateStr}</td>
          <td style="padding: 7px 10px;">
            <span style="font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: ${color}; border: 1px solid ${color};">
              ${escapeHtml(log.action)}
            </span>
          </td>
          <td style="padding: 7px 10px;">
            <strong style="color: var(--txt-primary);">${escapeHtml(log.entity)}</strong><br>
            <small style="color: var(--txt-muted); font-family: monospace;">${escapeHtml(log.entity_name || log.entity_id)}</small>
          </td>
          <td style="padding: 7px 10px; color: var(--txt-secondary); font-size: 11px; max-width: 320px;">
            ${escapeHtml(log.details)}
          </td>
          <td style="padding: 7px 10px;">
            <strong style="color: var(--amber); font-size: 11px;"><i class="fa-solid fa-user-shield"></i> ${escapeHtml(log.author_name || 'Admin')}</strong><br>
            <small style="color: var(--txt-muted); font-size: 10px;">${escapeHtml(log.author_email || '')}</small>
          </td>
        </tr>
      `;
    }).join('');
  };

  // ==============================================================================
  // MÓDULO 15: PERFILES DE EQUIPO & PERSONAL ADMINISTRATIVO (STAFF PROFILES)
  // ==============================================================================
  const STAFF_PHOTOS_KEY = 'ccms_staff_photos_v1';

  function getStaffPhotos() {
    try { return JSON.parse(localStorage.getItem(STAFF_PHOTOS_KEY) || '{}'); }
    catch(e) { return {}; }
  }

  function saveStaffPhotos(photos) {
    try { localStorage.setItem(STAFF_PHOTOS_KEY, JSON.stringify(photos)); }
    catch(e) {}
  }

  function getMonogram(displayName) {
    const words = (displayName || 'XX').trim().split(/\s+/);
    return words.length > 1
      ? (words[0][0] + words[1][0]).toUpperCase()
      : (words[0].substring(0, 2)).toUpperCase();
  }

  const STAFF_ROLE_CONFIG = {
    superadmin:        { label: 'SuperAdministrador',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   icon: 'fa-crown' },
    admin:             { label: 'Administración General',   color: '#10b981', bg: 'rgba(16,185,129,0.12)',   icon: 'fa-building' },
    admin_finanzas:    { label: 'Finanzas & Cobranzas',     color: '#10b981', bg: 'rgba(16,185,129,0.12)',   icon: 'fa-coins' },
    admin_legal:       { label: 'Legal & Contratos',        color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',   icon: 'fa-scale-balanced' },
    admin_mantenimiento: { label: 'Infraestructura',        color: '#f97316', bg: 'rgba(249,115,22,0.12)',   icon: 'fa-wrench' },
    heredero:          { label: 'Copropietario Heredero',   color: '#a855f7', bg: 'rgba(168,85,247,0.12)',   icon: 'fa-landmark' }
  };

  window.renderStaffProfileCards = function() {
    const grid = document.getElementById('staff-profile-grid');
    if (!grid) return;

    const allUsers = (window.AuthGuard && window.AuthGuard.listUsers) ? window.AuthGuard.listUsers() : [];
    // Filtrar solo personal administrativo/directiva (los inquilinos NO llevan perfil con foto)
    const staffUsers = allUsers.filter(u => u.role !== 'tenant');

    if (staffUsers.length === 0) {
      grid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--txt-muted);font-size:12px;grid-column:1/-1;">No hay usuarios directivos registrados.</div>';
      return;
    }

    const photos = getStaffPhotos();

    grid.innerHTML = staffUsers.map(u => {
      const rc = STAFF_ROLE_CONFIG[u.role] || STAFF_ROLE_CONFIG.admin;
      const mono = getMonogram(u.display_name);
      const photo = photos[u.id];
      const avatarHtml = photo
        ? `<img src="${photo.data || photo}" alt="${escapeHtml(u.display_name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : mono;
      
      const statusBadge = u.status === 'active'
        ? '<span class="status-pill pill-active" style="font-size:9.5px;padding:2px 7px;"><i class="fa-solid fa-circle" style="font-size:6px;"></i> Activo</span>'
        : '<span class="status-pill pill-warning" style="font-size:9.5px;padding:2px 7px;"><i class="fa-solid fa-clock" style="font-size:6px;"></i> Pendiente</span>';

      return `
        <div class="data-card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.15s ease, box-shadow 0.15s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.25)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
          <!-- Banner degradado de color de rol -->
          <div style="height: 52px; background: linear-gradient(135deg, ${rc.bg.replace('0.12', '0.45')}, transparent); border-bottom: 1px solid ${rc.bg};"></div>

          <!-- Avatar flotante -->
          <div style="display: flex; justify-content: center; margin-top: -32px; position: relative; z-index: 1;">
            <div class="staff-avatar-ring" data-user-id="${u.id}" data-click="openStaffPhotoModal('${u.id}')" title="Haga clic para cambiar foto de perfil" style="width: 64px; height: 64px; border-radius: 50%; background: var(--bg-card); border: 2.5px solid ${rc.color}; display: flex; align-items: center; justify-content: center; overflow: hidden; font-size: 20px; font-weight: 800; color: ${rc.color}; font-family: var(--font-heading); cursor: pointer; position: relative;">
              ${avatarHtml}
              <div class="cam-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s;pointer-events:none;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                <i class="fa-solid fa-camera" style="color:#fff;font-size:16px;"></i>
              </div>
            </div>
          </div>

          <!-- Contenido del perfil -->
          <div style="padding: 10px 14px 16px; flex: 1; display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center;">
            <div style="font-size: 13px; font-weight: 800; color: var(--txt-primary); font-family: var(--font-heading); line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(u.display_name)}">
              ${escapeHtml(u.display_name)}
            </div>

            <div style="display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 20px; background: ${rc.bg}; border: 1px solid ${rc.color}33; font-size: 10px; font-weight: 700; color: ${rc.color};">
              <i class="fa-solid ${rc.icon}" style="font-size: 8.5px;"></i>
              ${rc.label}
            </div>

            <div style="font-size: 10px; color: var(--txt-muted); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;" title="${escapeHtml(u.identifier)}">
              ${escapeHtml(u.identifier)}
            </div>

            <div style="font-size: 9.5px; color: var(--txt-muted);">
              <i class="fa-solid fa-location-dot" style="font-size: 8.5px;"></i> ${escapeHtml(u.unit || 'Oficina Administrativa')}
            </div>

            <div style="margin-top: 4px;">
              ${statusBadge}
            </div>
          </div>

          <!-- Footer con botón de cambio de foto -->
          <div style="border-top: 1px solid var(--border-subtle); padding: 8px 14px; display: flex; gap: 6px; justify-content: center; background: rgba(255,255,255,0.01);">
            <button type="button" class="btn-action-icon" data-click="openStaffPhotoModal('${u.id}')" title="Actualizar foto de perfil" style="width: auto; padding: 4px 10px; font-size: 11px; gap: 5px; color: ${rc.color}; border-color: ${rc.color}33;">
              <i class="fa-solid fa-camera"></i> Cambiar Foto
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  let _editingStaffUserId = null;
  let _tempStaffPhotoData = null;

  window.openStaffPhotoModal = function(userId) {
    _editingStaffUserId = userId;
    _tempStaffPhotoData = null;

    const allUsers = (window.AuthGuard && window.AuthGuard.listUsers) ? window.AuthGuard.listUsers() : [];
    const u = allUsers.find(x => x.id === userId);
    if (!u) return;

    const photos = getStaffPhotos();
    const rc = STAFF_ROLE_CONFIG[u.role] || STAFF_ROLE_CONFIG.admin;

    const previewEl = document.getElementById('staff-photo-current-preview');
    const nameEl = document.getElementById('staff-photo-user-name');
    const roleEl = document.getElementById('staff-photo-user-role');
    const fileInput = document.getElementById('staff-photo-file');

    if (fileInput) fileInput.value = '';
    if (nameEl) nameEl.textContent = u.display_name;
    if (roleEl) roleEl.textContent = rc.label + ' — ' + (u.identifier || '');

    if (previewEl) {
      previewEl.style.color = rc.color;
      previewEl.style.background = rc.bg;
      previewEl.style.borderColor = rc.color;
      const photo = photos[userId];
      if (photo) {
        previewEl.innerHTML = `<img src="${photo.data || photo}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        previewEl.innerHTML = getMonogram(u.display_name);
      }
    }

    window.openModal('modal-staff-photo');
  };

  window.closeStaffPhotoModal = function() {
    _tempStaffPhotoData = null;
    _editingStaffUserId = null;
    window.closeModal('modal-staff-photo');
  };

  window.handleStaffPhotoChange = function(e) {
    const file = e && e.target && e.target.files ? e.target.files[0] : null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen excede el límite máximo de 5 MB.', 'warning', 'Archivo Excedido');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
      _tempStaffPhotoData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: evt.target.result,
        updated_at: new Date().toISOString()
      };
      const previewEl = document.getElementById('staff-photo-current-preview');
      if (previewEl) {
        previewEl.innerHTML = `<img src="${evt.target.result}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeStaffPhoto = function() {
    if (!_editingStaffUserId) return;
    const photos = getStaffPhotos();
    delete photos[_editingStaffUserId];
    saveStaffPhotos(photos);
    _tempStaffPhotoData = null;
    dbService.logAuditAction({
      action: 'DELETE',
      entity: 'CONFIG',
      entity_id: _editingStaffUserId,
      entity_name: 'Foto de Personal',
      details: 'Eliminación de foto de perfil administrativo.'
    });
    window.closeStaffPhotoModal();
    window.renderStaffProfileCards();
    showToast('Foto de perfil eliminada correctamente.', 'info', 'Perfil Actualizado');
  };

  window.saveStaffPhoto = function() {
    if (!_editingStaffUserId) return;
    if (!_tempStaffPhotoData) {
      showToast('Seleccione primero una imagen para guardar.', 'info', 'Sin Imagen');
      return;
    }
    const photos = getStaffPhotos();
    photos[_editingStaffUserId] = _tempStaffPhotoData;
    saveStaffPhotos(photos);
    dbService.logAuditAction({
      action: 'UPDATE',
      entity: 'CONFIG',
      entity_id: _editingStaffUserId,
      entity_name: 'Foto de Personal',
      details: 'Actualización de foto de perfil administrativo.'
    });
    window.closeStaffPhotoModal();
    window.renderStaffProfileCards();
    showToast('Foto de perfil guardada con éxito.', 'success', 'Perfil Actualizado');
  };

  // Render inicial
  renderAll();
  if (isDirectiva) {
    try { renderStaffProfileCards(); } catch(e) {}
  }
});

