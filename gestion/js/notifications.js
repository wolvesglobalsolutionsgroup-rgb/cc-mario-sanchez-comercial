/**
 * ==============================================================================
 * SERVICIO DE NOTIFICACIONES — CORREO ELECTRÓNICO
 * Centro Comercial Mario Sánchez
 *
 * Diseñado como capa de transporte abstracta. Hoy funciona con:
 *   - "mailto"  (cliente de correo local del usuario, sin backend)
 *   - "webhook" (endpoint HTTP configurable, sin API key, ideal para Resend/Formspree/Mailgun en el futuro)
 *
 * Para activar un proveedor real (Resend, SendGrid, Mailgun, Postmark, etc.)
 * basta con registrar el endpoint en Notifications.configure() y el sistema
 * cambia automáticamente del fallback mailto al webhook.
 *
 * Uso:
 *   await Notifications.email({
 *     to: 'inquilino@example.com',
 *     subject: 'Aviso de Cobro',
 *     body: '...',
 *   });
 * ==============================================================================
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'ccms_notif_config_v1';
  const LOG_KEY     = 'ccms_notif_log_v1';

  // Configuración por defecto. El admin puede cambiarla en runtime.
  const DEFAULT_CONFIG = {
    transport: 'mailto',       // 'mailto' | 'webhook'
    webhook_url: '/api/send-email',
    webhook_method: 'POST',    // 'POST' | 'PUT'
    from_name: 'Administración CC Mario Sánchez',
    from_email: 'no-reply@ccmariosanchez.com',
    enabled: true
  };

  // --- 1. CONFIGURACIÓN -------------------------------------------------------

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (e) { /* noop */ }
    return { ...DEFAULT_CONFIG };
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function configure(partial) {
    const merged = { ...loadConfig(), ...partial };
    saveConfig(merged);
    return merged;
  }

  function getConfig() { return loadConfig(); }

  // --- 2. LOG DE AUDITORÍA ----------------------------------------------------

  function pushLog(entry) {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ ...entry, ts: new Date().toISOString() });
      // mantener solo los últimos 200
      localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(0, 200)));
    } catch (e) { /* noop */ }
  }

  function getLog(limit) {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return limit ? arr.slice(0, limit) : arr;
    } catch (e) { return []; }
  }

  // --- 3. TRANSPORTE: MAILTO --------------------------------------------------

  function openMailto({ to, subject, body }) {
    const params = new URLSearchParams({ subject: subject || '', body: body || '' });
    const url = `mailto:${encodeURIComponent(to || '')}?${params.toString()}`;
    // En navegadores modernos, abrir un mailto en ventana nueva es seguro.
    const win = global.open(url, '_blank', 'noopener,noreferrer');
    return { ok: true, transport: 'mailto', opened: !!win, to, subject };
  }

  // --- 4. TRANSPORTE: WEBHOOK -------------------------------------------------

  async function sendWebhook({ to, subject, body, cfg }) {
    if (!cfg.webhook_url) {
      throw new Error('webhook_url no configurada');
    }
    const payload = {
      from_name: cfg.from_name,
      from_email: cfg.from_email,
      to,
      subject,
      body,
      sent_at: new Date().toISOString()
    };
    const resp = await fetch(cfg.webhook_url, {
      method: cfg.webhook_method || 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} del proveedor`);
    }
    return { ok: true, transport: 'webhook', status: resp.status };
  }

  // --- 5. API PRINCIPAL -------------------------------------------------------

  /**
   * Envía (o encola) un correo.
   * @param {{to:string, subject:string, body:string, from_email?:string, from_name?:string}} opts
   * @returns {Promise<{ok:boolean, transport:string, ...}>}
   */
  async function email(opts) {
    const cfg = loadConfig();
    if (!cfg.enabled) {
      pushLog({ event: 'skipped', reason: 'disabled', to: opts.to, subject: opts.subject });
      return { ok: false, transport: 'none', error: 'Notificaciones deshabilitadas en configuración' };
    }
    if (!opts || !opts.to) {
      pushLog({ event: 'invalid', reason: 'no_to', subject: opts && opts.subject });
      return { ok: false, transport: cfg.transport, error: 'Falta destinatario (to)' };
    }

    try {
      let result;
      if (cfg.transport === 'webhook' && cfg.webhook_url) {
        result = await sendWebhook({ ...opts, cfg });
      } else {
        result = openMailto({ to: opts.to, subject: opts.subject, body: opts.body });
      }
      pushLog({ event: result.ok ? 'sent' : 'failed', transport: result.transport, to: opts.to, subject: opts.subject });
      return result;
    } catch (err) {
      pushLog({ event: 'error', transport: cfg.transport, to: opts.to, subject: opts.subject, error: err.message });
      // Si falla webhook, fallback automático a mailto (para no perder el envío)
      try {
        const fb = openMailto({ to: opts.to, subject: opts.subject, body: opts.body });
        pushLog({ event: 'fallback_to_mailto', to: opts.to, subject: opts.subject });
        return { ...fb, fallback: true, originalError: err.message };
      } catch (e2) {
        return { ok: false, transport: cfg.transport, error: err.message };
      }
    }
  }

  /**
   * Helper para enviar una plantilla con variables {tenant}, {unit}, etc.
   * Acepta una plantilla (string con {llaves}) y un objeto de valores.
   */
  function renderTemplate(template, values) {
    if (!template) return '';
    return String(template).replace(/\{(\w+)\}/g, (m, key) => {
      const v = values && values[key];
      return v === undefined || v === null ? m : String(v);
    });
  }

  /**
   * Compone un correo de aviso de cobro a partir de la configuración del admin
   * y los datos de la factura. Devuelve {to, subject, body} listo para .email().
   */
  function buildCollectionEmail({ tenant, invoice, bcvRate, template, mora }) {
    if (!tenant || !invoice) return null;
    const monto_usd = Number(invoice.total_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const monto_bs  = (Number(invoice.total_usd || 0) * (bcvRate || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const values = {
      inquilino: tenant.business_name || tenant.trade_name || 'Arrendatario',
      unidad: invoice.unit_code || '',
      periodo: `${invoice.period_month || ''}/${invoice.period_year || ''}`,
      monto_usd,
      monto_bs,
      tasa_bcv: bcvRate ? bcvRate.toFixed(2) : '—',
      fecha_limite: invoice.due_date || ''
    };
    const body = renderTemplate(template || '', values);
    const subjectPrefix = mora ? '⚠️ AVISO DE MORA' : 'Aviso de Cobro';
    const subject = `${subjectPrefix} — ${values.unidad} — ${values.periodo} — CC Mario Sánchez`;
    return { to: tenant.email || '', subject, body };
  }

  /**
   * SISTEMA DE RECORDATORIO RECURRENTE (ESTILO CASHEA)
   * Verifica facturas pendientes o en mora. Si no se ha enviado recordatorio hoy,
   * dispara o registra la notificación automática y persiste el historial en localStorage.
   */
  const REMINDER_STORAGE_KEY = 'ccms_daily_reminders_log_v1';

  function getDailyRemindersLog() {
    try {
      const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveDailyRemindersLog(log) {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(log));
  }

  async function checkDailyPaymentReminders(dbService, financialEngine) {
    if (!dbService || typeof dbService.getInvoices !== 'function') return { processed: 0, sent: 0 };
    const invoices = dbService.getInvoices();
    const tenants = dbService.getTenants ? dbService.getTenants() : [];
    const bcvRate = financialEngine ? financialEngine.getRates().VES : 800;
    const remindersLog = getDailyRemindersLog();
    const todayStr = new Date().toISOString().slice(0, 10);

    let processed = 0;
    let sent = 0;

    const pendingInvoices = invoices.filter(i => i.status === 'pendiente' || i.status === 'en_mora' || i.status === 'por_vencer');
    
    for (const inv of pendingInvoices) {
      processed++;
      const tenant = tenants.find(t => t.id === inv.tenant_id);
      if (!tenant) continue;

      const logKey = `${inv.id}_${todayStr}`;
      // Si ya se despachó o registró recordatorio hoy para esta cuota, saltar
      if (remindersLog[logKey]) continue;

      // Determinar si aplica recordatorio:
      // - Si está en mora: diario persistente
      // - Si faltan 3 días o menos para el vencimiento: preventivo diario
      let shouldAlert = false;
      let isMora = inv.status === 'en_mora';

      if (isMora) {
        shouldAlert = true;
      } else if (inv.due_date) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const due = new Date(inv.due_date);
        due.setHours(0,0,0,0);
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) {
          shouldAlert = true;
        }
      }

      if (shouldAlert) {
        // Registrar en log de recordatorios diarios
        remindersLog[logKey] = {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          tenant_id: tenant.id,
          tenant_name: tenant.business_name,
          date: todayStr,
          status: inv.status,
          amount_usd: inv.total_usd
        };
        sent++;

        pushLog({
          event: 'automated_daily_reminder',
          invoice_number: inv.invoice_number,
          tenant: tenant.business_name,
          email: tenant.email,
          status: inv.status,
          date: todayStr
        });
      }
    }

    saveDailyRemindersLog(remindersLog);
    return { processed, sent };
  }

  // --- 6. EXPORT --------------------------------------------------------------

  global.Notifications = {
    configure,
    getConfig,
    email,
    buildCollectionEmail,
    renderTemplate,
    getLog,
    checkDailyPaymentReminders,
    getDailyRemindersLog
  };

})(window);
