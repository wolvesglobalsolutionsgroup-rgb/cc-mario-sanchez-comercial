/**
 * ==============================================================================
 * APLICACIÓN PRINCIPAL: GESTIÓN DE INQUILINOS, CONTABILIDAD Y COBRANZAS
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 * Arquitectura Cuatrimoneda (USD / EUR / VES / USDT) & Modo Dual (Claro / Oscuro)
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. ESTADO GLOBAL
  const session = (window.AuthGuard && window.AuthGuard.currentUser) ? window.AuthGuard.currentUser() : null;
  const currentRole = session ? session.role : 'admin'; // fallback si guard no está cargado
  const currentTenantId = session ? session.tenant_id : null;
  let currentCurrency = localStorage.getItem('ccms_active_currency') || 'USD'; // 'USD', 'EUR', 'VES', 'USDT'
  let currentTheme = localStorage.getItem('ccms_theme') || 'dark'; // 'dark' o 'light'

  // Para inquilinos arrancamos en la pestaña de cobranzas (lo único que les concierne)
  let currentTab = (currentRole === 'tenant') ? 'cobranzas' : 'inquilinos';

  // Si el usuario es inquilino, el sidebar no debe mostrar "inquilinos" como activo;
  // ajustamos la visibilidad de la pestaña activa de arranque.
  if (currentRole === 'tenant') {
    const targetTab = document.querySelector('.nav-item[data-tab="cobranzas"]');
    if (targetTab) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      targetTab.classList.add('active');
    }
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

  // 4. TICKER BCV DINÁMICO & AUTO-SINCRONIZACIÓN CON API GRATUITA (DOLARAPI)
  const bcvTickerVal = document.getElementById('bcv-rate-val');
  const bcvSyncIcon = document.getElementById('bcv-sync-icon');

  function updateBcvDisplay() {
    if (bcvTickerVal) {
      const currentRate = financialEngine.getRates().VES;
      bcvTickerVal.innerText = `${currentRate.toFixed(2)} Bs/USD`;
    }
  }
  updateBcvDisplay();

  // Función asíncrona para sincronizar en vivo con la API oficial gratuita
  window.syncBcvRate = async function() {
    if (bcvSyncIcon) bcvSyncIcon.classList.add('fa-spin');
    try {
      const res = await financialEngine.fetchOfficialBcvRate();
      if (res.success) {
        updateBcvDisplay();
        renderAll();
        // Feedback visual
        if (bcvTickerVal) {
          bcvTickerVal.style.color = 'var(--emerald)';
          setTimeout(() => { bcvTickerVal.style.color = ''; }, 2000);
        }
      } else {
        console.warn("No se pudo obtener la tasa en vivo, manteniendo tasa en memoria:", res.error);
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
  }, 1000);

  // Modal para editar tasa BCV manualmente si el usuario lo requiere
  window.editBcvRate = function() {
    const current = financialEngine.getRates().VES;
    const input = prompt("Ingrese la nueva Tasa Oficial del Banco Central de Venezuela (Bs/USD):", current.toFixed(2));
    if (input !== null) {
      try {
        financialEngine.setBcvRate(input);
        updateBcvDisplay();
        renderAll();
        alert(`Tasa BCV actualizada a: ${financialEngine.getRates().VES.toFixed(2)} Bs/USD`);
      } catch (e) {
        alert(e.message);
      }
    }
  };

  window.resetDemoData = function() {
    if (currentRole !== 'admin' || !window.dbService || typeof window.dbService.resetDemoData !== 'function') return;
    const confirmed = window.confirm('¿Restablecer la demo? Se borrarán los cambios ficticios hechos en este navegador y volverán los datos iniciales.');
    if (!confirmed) return;
    window.dbService.resetDemoData();
    window.location.reload();
  };

  // 5. NAVEGACIÓN Y MENÚ MÓVIL
  const sidebarEl = document.getElementById('app-sidebar');
  const mobileToggleBtn = document.getElementById('mobile-menu-toggle');

  if (mobileToggleBtn && sidebarEl) {
    mobileToggleBtn.onclick = () => sidebarEl.classList.toggle('open');
  }

  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentTab = item.getAttribute('data-tab');
      
      document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');
      const activeView = document.getElementById(`tab-${currentTab}`);
      if (activeView) activeView.style.display = 'block';

      if (window.innerWidth <= 1024 && sidebarEl) {
        sidebarEl.classList.remove('open');
      }
    });
  });

  // Helper de conversión y formato dinámico
  function formatMoney(amountInUsd) {
    const converted = financialEngine.convert(amountInUsd, 'USD', currentCurrency);
    return financialEngine.format(converted, currentCurrency);
  }

  // 6. RENDERIZACIÓN GLOBAL
  function renderAll() {
    renderKPIsAndBalances();
    if (currentRole === 'admin') {
      renderTenantsTable();
      renderCondoExpenses();
    }
    renderInvoicesTable();
    renderCalendarView();
    renderAlertsCenter();
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

    // 3. Recaudado
    const paidInvoices = invoices.filter(i => i.status === 'pagado');
    const totalPaidUsd = paidInvoices.reduce((acc, i) => acc + i.total_usd, 0);
    const collectionPct = totalBilledUsd > 0 ? Math.round((totalPaidUsd / totalBilledUsd) * 100) : 0;
    const collEl = document.getElementById('kpi-collected');
    if (collEl) {
      collEl.innerText = formatMoney(totalPaidUsd);
      document.getElementById('kpi-collected-sub').innerText = `${collectionPct}% ${currentRole === 'admin' ? 'de recaudación efectiva' : 'pagado'}`;
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

  // C. TABLA DE COBRANZAS Y CUOTAS
  function renderInvoicesTable() {
    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const invoices = visibleInvoices(dbService.getInvoices());
    const tenants = visibleTenants(dbService.getTenants());

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
      tr.innerHTML = `<td colspan="6" style="text-align:center;padding:32px;color:var(--txt-muted);font-style:italic;">${currentRole === 'tenant' ? 'No tiene cuotas registradas todavía. Contacte a la administración.' : 'Sin cuotas para mostrar.'}</td>`;
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
            ${inv.status !== 'pagado' && currentRole === 'admin' ? `
              <button class="btn-action-icon" title="Registrar Pago Multimoneda" style="background: var(--emerald-glow); color: var(--emerald);" onclick="window.openPaymentModal('${inv.id}')">
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

  // D. GASTOS COMUNES Y DISTRIBUCIÓN CONDOMINIAL
  function renderCondoExpenses() {
    const tbody = document.getElementById('condo-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const expenses = [
      { concept: 'Vigilancia y Seguridad Armada 24/7', cat: 'Seguridad', amount_usd: 1200 },
      { concept: 'Energía Eléctrica Común y Postes (Corpoelec)', cat: 'Servicios', amount_usd: 350 },
      { concept: 'Suministro Cisterna de Agua (40.000 L)', cat: 'Servicios', amount_usd: 220 },
      { concept: 'Mantenimiento Preventivo Drenajes y Asfalto', cat: 'Mantenimiento', amount_usd: 180 }
    ];

    expenses.forEach(exp => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${exp.concept}</strong></td>
        <td><span class="status-pill pill-info">${exp.cat}</span></td>
        <td><strong>${formatMoney(exp.amount_usd)}</strong></td>
        <td><span style="font-size: 11.5px; color: var(--txt-muted);">Distribuido por alícuota m²</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // E. CALENDARIO DE VENCIMIENTOS
  function renderCalendarView() {
    const listEl = document.getElementById('calendar-events-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const events = [
      {
        title: 'Vencimiento Cuotas de Alquiler (Día 5 Hábiles)',
        date: '2026-03-05',
        type: 'cuota',
        desc: 'Fecha límite de pago sin recargos según costumbre comercial del CC Mario Sánchez.'
      },
      {
        title: 'Corte de Gastos Comunes y Condominio',
        date: '2026-03-10',
        type: 'condominio',
        desc: 'Cierre de alícuotas ordinarias de electricidad de áreas comunes, aseo y vigilancia.'
      },
      {
        title: 'Vencimiento Contrato FerroCruz Pro (Local 01)',
        date: '2026-03-31',
        type: 'contrato',
        desc: 'Cumple 1 año de contrato. Arrendatario con opción a Prórroga Legal obligatoria (Art. 25 G.O. 40.418).'
      },
      {
        title: 'Término de Prórroga Legal El Faro Market (Local 04)',
        date: '2026-04-10',
        type: 'prorroga',
        desc: 'Finalización de los 6 meses de prórroga legal estipulados según la Ley de Arrendamiento Comercial.'
      }
    ];

    events.forEach(evt => {
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
    modal.classList.add('open');
  };

  window.calculateProrroga = function() {
    const years = parseFloat(document.getElementById('pror-years-input').value) || 1;
    const ext = VenezuelaLegal.calculateLegalExtension(years);

    document.getElementById('pror-res-months').innerText = `${ext.months} Meses`;
    document.getElementById('pror-res-desc').innerText = ext.description;
    document.getElementById('pror-calc-result').style.display = 'block';
  };

  // 3. Modal Registro de Pago Multimoneda con Snapshot y TxID
  window.openPaymentModal = function(invoiceId) {
    const inv = dbService.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;

    document.getElementById('pay-invoice-id').value = invoiceId;
    document.getElementById('pay-invoice-num').innerText = inv.invoice_number;
    document.getElementById('pay-unit').innerText = inv.unit_code;
    document.getElementById('pay-amount').value = inv.total_usd;
    document.getElementById('pay-currency-select').value = 'USD';
    
    updatePaymentEquivalents();
    document.getElementById('modal-payment').classList.add('open');
  };

  // Actualización dinámica de equivalencias en el modal de pago
  window.updatePaymentEquivalents = function() {
    const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
    const cur = document.getElementById('pay-currency-select').value;
    const method = document.getElementById('pay-method').value;

    const bcvRate = financialEngine.getRates().VES;
    const usdEq = financialEngine.convert(amount, cur, 'USD');
    const vesEq = financialEngine.convert(amount, cur, 'VES');

    document.getElementById('pay-eq-usd').innerText = `$${usdEq.toFixed(2)} USD`;
    document.getElementById('pay-eq-ves').innerText = `Bs. ${vesEq.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

    // Mostrar campo TxID si es Cripto USDT
    const txidGroup = document.getElementById('pay-txid-group');
    if (txidGroup) {
      txidGroup.style.display = (cur === 'USDT' || method.includes('Cripto')) ? 'flex' : 'none';
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

      // Validación cripto si aplica
      if (currency === 'USDT' && txid) {
        const val = financialEngine.validateTxID(txid, 'TRC20');
        if (!val.isValid) {
          alert('Advertencia: ' + val.message);
          return;
        }
      }

      try {
        // Crear snapshot financiero
        const snapshot = financialEngine.createPaymentSnapshot(amount, currency);

        dbService.recordPayment(invId, {
          payment_method: method,
          reference_number: ref || txid,
          txid: txid,
          amount_paid: amount,
          currency: currency,
          snapshot: snapshot,
          receipt_proof: currentUploadedProof
        });

        const paidInvoice = dbService.getInvoices().find(i => i.id === invId);
        const paidTenant = paidInvoice && dbService.getTenants().find(t => t.id === paidInvoice.tenant_id);
        if (paidTenant && paidTenant.email && window.Notifications) {
          void Notifications.email({
            to: paidTenant.email,
            subject: `Pago recibido — ${paidInvoice.invoice_number} — CC Mario Sánchez`,
            body: `Hemos registrado el pago de la cuota ${paidInvoice.invoice_number} correspondiente al período ${paidInvoice.period_month}/${paidInvoice.period_year}. Referencia: ${ref || txid || 'no indicada'}.`
          });
        }

        document.getElementById('modal-payment').classList.remove('open');
        paymentForm.reset();
        removeReceiptFile();
        renderAll();
        alert(`¡Pago registrado y conciliado exitosamente!\nSnapshot financiero capturado: Tasa BCV ${snapshot.bcv_rate_applied.toFixed(2)} Bs/USD.\n${currentUploadedProof ? 'Comprobante adjuntado con éxito.' : ''}`);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    };
  }

  // Manejador de archivo comprobante de pago (base64)
  let currentUploadedProof = null;
  window.handleReceiptFileChange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validación de tamaño (Máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo seleccionado excede el límite máximo de 5MB.");
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      currentUploadedProof = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: evt.target.result // Base64 Data URL
      };
      const previewCont = document.getElementById('receipt-preview-container');
      const nameEl = document.getElementById('receipt-file-name');
      if (previewCont && nameEl) {
        nameEl.innerText = `${file.name} (${Math.round(file.size / 1024)} KB)`;
        previewCont.style.display = 'flex';
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeReceiptFile = function() {
    currentUploadedProof = null;
    const fileInput = document.getElementById('pay-receipt-file');
    if (fileInput) fileInput.value = '';
    const previewCont = document.getElementById('receipt-preview-container');
    if (previewCont) previewCont.style.display = 'none';
  };

  // Visor de Comprobante de Pago
  window.viewReceiptProof = function(invoiceId) {
    const inv = dbService.getInvoices().find(i => i.id === invoiceId);
    if (!inv || !inv.receipt_proof) {
      alert("Esta cuota no posee un comprobante adjunto.");
      return;
    }
    const proof = inv.receipt_proof;
    if (!proof || !isSafeReceiptDataUrl(proof.data)) {
      alert('El comprobante no tiene un formato seguro o válido.');
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
  }

  window.saveCuotasConfig = function(e) {
    e.preventDefault();
    dbService.saveSettings({
      rate_locales_m2: parseFloat(document.getElementById('cfg-rate-locales').value) || 4.5,
      rate_macrolotes_m2: parseFloat(document.getElementById('cfg-rate-macrolotes').value) || 2.3,
      rate_galpones_m2: parseFloat(document.getElementById('cfg-rate-galpones').value) || 2.5,
      condo_fee_aliquot_base: parseFloat(document.getElementById('cfg-condo-aliquot').value) || 8.0
    });
    alert("¡Parámetros de Cuotas y Cánones guardados con éxito!");
  };

  window.saveAlertasConfig = function(e) {
    e.preventDefault();
    dbService.saveSettings({
      cutoff_day: parseInt(document.getElementById('cfg-cutoff-day').value) || 5,
      alert_days_before: parseInt(document.getElementById('cfg-alert-before').value) || 3,
      grace_days: parseInt(document.getElementById('cfg-grace-days').value) || 5
    });
    alert("¡Configuración de Alertas & Vencimientos guardada!");
  };

  window.saveMensajesConfig = function(e) {
    e.preventDefault();
    dbService.saveSettings({
      msg_preventive_template: document.getElementById('cfg-msg-preventive').value.trim(),
      msg_mora_template: document.getElementById('cfg-msg-mora').value.trim()
    });
    renderAlertsCenter();
    alert("¡Plantillas de Mensajes WhatsApp/Gmail actualizadas!");
  };

  window.resetDefaultTemplates = function() {
    if (confirm("¿Desea restablecer las plantillas a los textos legales predeterminados?")) {
      const defaults = dbService.getSettings();
      document.getElementById('cfg-msg-preventive').value = `Estimados *{inquilino}* ({unidad}):\nLe remitimos su aviso de cobro del período *{periodo}* por un total de *{monto_usd}* (Bs. {monto_bs} a tasa BCV {tasa_bcv}).\nFecha límite de pago: *{fecha_limite}*.\nPor favor remitir comprobante a este canal para conciliación.`;
      document.getElementById('cfg-msg-mora').value = `⚠️ *AVISO DE RETRASO — CC MARIO SÁNCHEZ*\nEstimados *{inquilino}* ({unidad}):\nLe informamos que su cuota del período *{periodo}* se encuentra en estado de MORA por un saldo de *{monto_usd}* (Bs. {monto_bs}).\nConforme a la Gaceta Oficial 40.418, agradecemos regularizar el pago a la brevedad para evitar recargos o suspensión de servicios comunes.`;
      window.saveMensajesConfig(new Event('submit'));
    }
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

    document.getElementById('modal-dossier').classList.add('open');
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

  // Cerrar Modales
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    };
  });

  window.onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  };

  // Render inicial
  renderAll();
});
