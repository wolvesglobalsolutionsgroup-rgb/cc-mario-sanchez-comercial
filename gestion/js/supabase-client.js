/**
 * ==============================================================================
 * CLIENTE DE BASE DE DATOS: SUPABASE CON PERSISTENCIA LOCAL AUTOMÁTICA
 * Soporta conexión real a Supabase (PostgreSQL) o modo local reactivo (LocalStorage)
 * ==============================================================================
 */

class DatabaseService {
  constructor() {
    this.storageKey = 'ccms_inmobiliario_db_v1';
    this.supabaseUrl = localStorage.getItem('ccms_supabase_url') || '';
    this.supabaseKey = localStorage.getItem('ccms_supabase_key') || '';

    // --- SEGURIDAD: Validar que la clave sea anon_key, NO service_role_key ---
    // Si alguien configura la service_role en el cliente, la eliminamos para evitar
    // bypass de RLS con permisos administrativos totales sobre la base de datos.
    if (this.supabaseKey) {
      try {
        if (this.supabaseKey.startsWith('eyJ')) {
          const payloadB64 = this.supabaseKey.split('.')[1];
          if (payloadB64) {
            const payload = JSON.parse(atob(payloadB64));
            if (payload.role === 'service_role') {
              console.error('[SUPABASE SECURITY ALERT] Se detectó service_role key en cliente. Esta clave da permisos totales y debe usarse SOLO en el servidor. La clave fue eliminada del navegador.');
              localStorage.removeItem('ccms_supabase_key');
              this.supabaseKey = '';
            }
          }
        }
      } catch (e) {
        console.warn('[SUPABASE] No se pudo validar la clave:', e);
      }
    }

    this.isSupabaseConfigured = Boolean(this.supabaseUrl && this.supabaseKey);
    this.initDatabase();
  }

  initDatabase() {
    let demoSession = false;
    try { demoSession = JSON.parse(localStorage.getItem('ccms_session') || '{}').is_demo === true; } catch (_) {}
    const demoHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1', 'cc-mario-sanchez-comercial.vercel.app'].includes(location.hostname);
    if (demoSession && demoHost && (globalThis.CCMS_AUTHORIZED_DEMO_FIXTURES?.full_dataset || globalThis.CCMS_SYNTHETIC_FIXTURES?.full_dataset)) {
      this.remoteSnapshot = JSON.parse(JSON.stringify(globalThis.CCMS_AUTHORIZED_DEMO_FIXTURES?.full_dataset || globalThis.CCMS_SYNTHETIC_FIXTURES.full_dataset));
      this.persistenceState = 'demo_fixture';
      return;
    }
    // Legacy storage is not an authoritative source, even if it contains 39 units.
    this.remoteSnapshot = { units: [], tenants: [], invoices: [], payments: [], receipts: [], condo_expenses: [], activos_fijos: [], consumibles: [], kardex_movimientos: [], special_agreements: [], receiving_accounts: [], settings: {} };
    this.persistenceState = 'not_loaded';
    return;

  }

  resetDemoData() {
    throw new Error('REMOTE_PERSISTENCE_REQUIRED: Reinicie la sesión en el entorno demo aislado.');

  }

  seedInitialData() {
    throw new Error('REMOTE_PERSISTENCE_REQUIRED: No se permite sembrar datos locales.');

  }

  getData() {
    return JSON.parse(JSON.stringify(this.remoteSnapshot));

  }

  // --- MÓDULO DE ACTIVOS FIJOS / BIENES PROPIOS ---
  getActivosFijos() {
    const data = this.getData();
    return (data && Array.isArray(data.activos_fijos)) ? data.activos_fijos : [];
  }

  saveActivoFijo(item) {
    const data = this.getData();
    if (!data.activos_fijos) data.activos_fijos = [];
    if (item.id) {
      const idx = data.activos_fijos.findIndex(a => a.id === item.id);
      if (idx >= 0) {
        data.activos_fijos[idx] = { ...data.activos_fijos[idx], ...item };
      } else {
        data.activos_fijos.push(item);
      }
    } else {
      const newItem = {
        ...item,
        id: 'act-' + Date.now(),
        created_at: new Date().toISOString()
      };
      data.activos_fijos.push(newItem);
    }
    this.saveData(data);
    return data.activos_fijos;
  }

  deleteActivoFijo(id) {
    const data = this.getData();
    if (!data.activos_fijos) return [];
    data.activos_fijos = data.activos_fijos.filter(a => a.id !== id);
    this.saveData(data);
    return data.activos_fijos;
  }

  // --- MÓDULO DE CONSUMIBLES & STOCK ---
  getConsumibles() {
    const data = this.getData();
    return (data && Array.isArray(data.consumibles)) ? data.consumibles : [];
  }

  saveConsumible(item) {
    const data = this.getData();
    if (!data.consumibles) data.consumibles = [];
    if (item.id) {
      const idx = data.consumibles.findIndex(c => c.id === item.id);
      if (idx >= 0) {
        data.consumibles[idx] = { ...data.consumibles[idx], ...item };
      } else {
        data.consumibles.push(item);
      }
    } else {
      const newItem = {
        ...item,
        id: 'cns-' + Date.now(),
        created_at: new Date().toISOString()
      };
      data.consumibles.push(newItem);
    }
    this.saveData(data);
    return data.consumibles;
  }

  deleteConsumible(id) {
    const data = this.getData();
    if (!data.consumibles) return [];
    data.consumibles = data.consumibles.filter(c => c.id !== id);
    this.saveData(data);
    return data.consumibles;
  }

  // --- MÓDULO DE KARDEX DE ENTRADAS Y SALIDAS ---
  getKardex() {
    const data = this.getData();
    return (data && Array.isArray(data.kardex_movimientos)) ? data.kardex_movimientos : [];
  }

  addKardexMovimiento(mov) {
    const data = this.getData();
    if (!data.kardex_movimientos) data.kardex_movimientos = [];
    const newMov = {
      ...mov,
      id: 'kdx-' + Date.now(),
      timestamp: mov.timestamp || new Date().toISOString()
    };
    data.kardex_movimientos.unshift(newMov);

    if (data.consumibles && mov.item_code) {
      const item = data.consumibles.find(c => c.code === mov.item_code);
      if (item) {
        const qty = parseFloat(mov.quantity) || 0;
        if (mov.type === 'ENTRADA') {
          item.stock_current = (parseFloat(item.stock_current) || 0) + qty;
        } else if (mov.type === 'SALIDA') {
          item.stock_current = Math.max(0, (parseFloat(item.stock_current) || 0) - qty);
        }
        item.status = (item.stock_current <= item.stock_min) ? 'alerta' : 'ok';
      }
    }

    this.saveData(data);
    return newMov;
  }

  saveData(data) {
    throw new Error('REMOTE_PERSISTENCE_REQUIRED: La operación requiere un comando remoto confirmado.');
  }

  // --- MÉTODOS CRUD ---

  getUnits() {
    const data = this.getData();
    return (data && Array.isArray(data.units)) ? data.units : [];
  }

  getTenants() {
    const data = this.getData();
    return (data && Array.isArray(data.tenants)) ? data.tenants : [];
  }

  /**
   * Helper interno: detectar tenant_id desde la sesión activa (IDOR zero-trust).
   * Si el usuario es tenant y no se especificó tenantId, filtra por su propio tenant.
   */
  _sessionTenantId(explicitTenantId) {
    if (explicitTenantId) return explicitTenantId;
    if (typeof window !== 'undefined' && window.AuthGuard && typeof window.AuthGuard.currentUser === 'function') {
      try {
        const sess = window.AuthGuard.currentUser();
        if (sess && sess.role === 'tenant' && sess.tenant_id) {
          return sess.tenant_id;
        }
      } catch (e) { /* noop */ }
    }
    return null;
  }

  getContracts(tenantId = null) {
    const data = this.getData();
    if (!data || !Array.isArray(data.contracts)) return [];
    const effectiveTenantId = this._sessionTenantId(tenantId);
    if (effectiveTenantId) {
      return data.contracts.filter(c => c.tenant_id === effectiveTenantId);
    }
    return data.contracts;
  }

  getInvoices(tenantId = null) {
    const data = this.getData();
    if (!data || !Array.isArray(data.invoices)) return [];
    const effectiveTenantId = this._sessionTenantId(tenantId);
    if (effectiveTenantId) {
      return data.invoices.filter(i => i.tenant_id === effectiveTenantId);
    }
    return data.invoices;
  }

  getPayments(tenantId = null) {
    const data = this.getData();
    if (!data || !Array.isArray(data.payments)) return [];
    const effectiveTenantId = this._sessionTenantId(tenantId);
    if (effectiveTenantId) {
      const tenantInvoiceIds = new Set(this.getInvoices(effectiveTenantId).map(i => i.id));
      return data.payments.filter(p => p.tenant_id === effectiveTenantId || tenantInvoiceIds.has(p.invoice_id));
    }
    return data.payments;
  }

  addTenant(tenantData, contractData) {
    const data = this.getData();
    const newTenantId = 't-' + Date.now();
    const newTenant = {
      id: newTenantId,
      ...tenantData,
      status: 'activo'
    };
    data.tenants.push(newTenant);

    // Actualizar estado del local a arrendado
    const unit = data.units.find(u => u.code === tenantData.unit_code);
    if (unit) {
      unit.status = 'arrendado';
      unit.tenant_id = newTenantId;
    }

    // Crear contrato asociado
    const newContractId = 'c-' + Date.now();
    const newContract = {
      id: newContractId,
      contract_number: `CCMS-CTR-2026-${Math.floor(100 + Math.random() * 900)}`,
      tenant_id: newTenantId,
      unit_code: tenantData.unit_code,
      start_date: contractData.start_date,
      end_date: contractData.end_date,
      rent_usd: parseFloat(contractData.rent_usd),
      rent_method: contractData.rent_method || 'CAF (Canon Fijo Art. 32)',
      deposit_usd: parseFloat(contractData.deposit_usd),
      deposit_months: parseInt(contractData.deposit_months) || 3,
      status: 'vigente'
    };
    data.contracts.push(newContract);

    // Crear primera cuota de alquiler
    const firstInvoice = {
      id: 'inv-' + Date.now(),
      invoice_number: `REC-2026-03-${Math.floor(100 + Math.random() * 900)}`,
      tenant_id: newTenantId,
      unit_code: tenantData.unit_code,
      period_month: 3,
      period_year: 2026,
      rent_usd: parseFloat(contractData.rent_usd),
      condo_usd: Math.round(parseFloat(contractData.rent_usd) * 0.08),
      total_usd: Math.round(parseFloat(contractData.rent_usd) * 1.08),
      due_date: '2026-03-10',
      status: 'pendiente',
      paid_at: null
    };
    data.invoices.push(firstInvoice);

    this.saveData(data);
    return { tenant: newTenant, contract: newContract, invoice: firstInvoice };
  }

  updateTenant(tenantId, updateData) {
    const data = this.getData();
    if (!data.tenants) return null;
    const idx = data.tenants.findIndex(t => t.id === tenantId);
    if (idx === -1) return null;
    const oldTenant = { ...data.tenants[idx] };
    data.tenants[idx] = { ...data.tenants[idx], ...updateData };
    this.saveData(data);
    this.logAuditAction({
      action: 'UPDATE',
      entity: 'TENANT',
      entity_id: tenantId,
      entity_name: data.tenants[idx].business_name,
      details: `Actualización de ficha y datos del arrendatario ${data.tenants[idx].business_name}`,
      previous_state: oldTenant,
      new_state: data.tenants[idx]
    });
    return data.tenants[idx];
  }

  updateContract(tenantId, updateData) {
    const data = this.getData();
    if (!data.contracts) data.contracts = [];
    let idx = data.contracts.findIndex(c => c.tenant_id === tenantId);
    let updated;
    if (idx === -1) {
      updated = { id: 'c-' + Date.now(), tenant_id: tenantId, ...updateData };
      data.contracts.push(updated);
    } else {
      data.contracts[idx] = { ...data.contracts[idx], ...updateData };
      updated = data.contracts[idx];
    }
    this.saveData(data);
    this.logAuditAction({
      action: 'UPDATE',
      entity: 'CONTRACT',
      entity_id: tenantId,
      entity_name: updated.contract_number || 'Contrato Legal',
      details: `Actualización de condiciones del contrato ${updated.contract_number || ''}`
    });
    return updated;
  }

  // --- MÓDULO DE ACUERDOS ESPECIALES, REPARACIONES & COMPENSACIONES ---
  getSpecialAgreements(tenantId = null) {
    const data = this.getData();
    if (!data || !Array.isArray(data.special_agreements)) return [];
    const effectiveTenantId = this._sessionTenantId(tenantId);
    if (effectiveTenantId) {
      return data.special_agreements.filter(a => a.tenant_id === effectiveTenantId);
    }
    return data.special_agreements;
  }

  saveSpecialAgreement(agreement) {
    const data = this.getData();
    if (!data.special_agreements) data.special_agreements = [];
    let saved = null;
    if (agreement.id) {
      const idx = data.special_agreements.findIndex(a => a.id === agreement.id);
      if (idx >= 0) {
        const oldState = { ...data.special_agreements[idx] };
        data.special_agreements[idx] = { ...data.special_agreements[idx], ...agreement };
        saved = data.special_agreements[idx];
        this.logAuditAction({
          action: 'UPDATE',
          entity: 'AGREEMENT',
          entity_id: agreement.id,
          entity_name: agreement.agreement_type || 'Acuerdo Especial',
          details: `Modificación de acuerdo especial para inquilino ${agreement.tenant_id}`,
          previous_state: oldState,
          new_state: saved
        });
      }
    } else {
      const newAgr = {
        ...agreement,
        id: 'agr-' + Date.now(),
        status: agreement.status || 'activo',
        created_at: new Date().toISOString()
      };
      data.special_agreements.push(newAgr);
      saved = newAgr;
      this.logAuditAction({
        action: 'CREATE',
        entity: 'AGREEMENT',
        entity_id: newAgr.id,
        entity_name: newAgr.agreement_type || 'Acuerdo Especial',
        details: `Registro de nuevo acuerdo especial / deducción ($${newAgr.discount_monthly_usd}/mes) para inquilino ${newAgr.tenant_id}`,
        new_state: newAgr
      });
    }
    this.saveData(data);
    return saved;
  }

  deleteSpecialAgreement(id) {
    const data = this.getData();
    if (!data.special_agreements) return [];
    const target = data.special_agreements.find(a => a.id === id);
    data.special_agreements = data.special_agreements.filter(a => a.id !== id);
    this.saveData(data);
    if (target) {
      this.logAuditAction({
        action: 'DELETE',
        entity: 'AGREEMENT',
        entity_id: id,
        entity_name: target.agreement_type || 'Acuerdo Especial',
        details: `Eliminación de acuerdo especial ${target.agreement_type} de inquilino ${target.tenant_id}`,
        previous_state: target
      });
    }
    return data.special_agreements;
  }

  getDefaultCondoExpenses() {
    return [
      {
        id: 'exp-1',
        period_month: 3,
        period_year: 2026,
        concept: 'Vigilancia y Seguridad Armada 24/7',
        category: 'Seguridad',
        provider_name: 'Seguridad Blindada de Oriente, C.A.',
        provider_rif: 'J-30491823-1',
        invoice_number: 'FAC-2026-0891',
        control_number: '00-001428',
        amount_usd: 1200,
        currency: 'USD',
        withhold_iva: true,
        withhold_islr: true,
        invoice_proof: null,
        created_at: '2026-03-01T08:00:00.000Z'
      },
      {
        id: 'exp-2',
        period_month: 3,
        period_year: 2026,
        concept: 'Energía Eléctrica Común y Postes (Corpoelec)',
        category: 'Servicios',
        provider_name: 'Corporación Eléctrica Nacional (CORPOELEC)',
        provider_rif: 'G-20010014-1',
        invoice_number: 'REC-ELEC-44091',
        control_number: '00-098231',
        amount_usd: 350,
        currency: 'VES',
        withhold_iva: false,
        withhold_islr: false,
        invoice_proof: null,
        created_at: '2026-03-02T10:30:00.000Z'
      },
      {
        id: 'exp-3',
        period_month: 3,
        period_year: 2026,
        concept: 'Suministro Cisterna de Agua (40.000 L)',
        category: 'Servicios',
        provider_name: 'Inversiones Hídricas El Morro C.A.',
        provider_rif: 'J-40192834-5',
        invoice_number: 'FAC-003882',
        control_number: '00-000452',
        amount_usd: 220,
        currency: 'USD',
        withhold_iva: true,
        withhold_islr: false,
        invoice_proof: null,
        created_at: '2026-03-03T14:15:00.000Z'
      },
      {
        id: 'exp-4',
        period_month: 3,
        period_year: 2026,
        concept: 'Mantenimiento Preventivo Drenajes y Asfalto',
        category: 'Mantenimiento',
        provider_name: 'Constructora y Vialidad Puerto La Cruz, C.A.',
        provider_rif: 'J-29801944-8',
        invoice_number: 'FAC-2026-0112',
        control_number: '00-000198',
        amount_usd: 180,
        currency: 'USD',
        withhold_iva: true,
        withhold_islr: true,
        invoice_proof: null,
        created_at: '2026-03-04T09:00:00.000Z'
      },
      {
        id: 'exp-5',
        period_month: 2,
        period_year: 2026,
        concept: 'Vigilancia y Seguridad Armada Febrero',
        category: 'Seguridad',
        provider_name: 'Seguridad Blindada de Oriente, C.A.',
        provider_rif: 'J-30491823-1',
        invoice_number: 'FAC-2026-0740',
        control_number: '00-001290',
        amount_usd: 1200,
        currency: 'USD',
        withhold_iva: true,
        withhold_islr: true,
        invoice_proof: null,
        created_at: '2026-02-01T08:00:00.000Z'
      },
      {
        id: 'exp-6',
        period_month: 2,
        period_year: 2026,
        concept: 'Reparación de Bomba Hidroneumática Principal',
        category: 'Mantenimiento',
        provider_name: 'Técnicos Bombas & Motores Anzoátegui C.A.',
        provider_rif: 'J-31982736-2',
        invoice_number: 'FAC-2026-0045',
        control_number: '00-000088',
        amount_usd: 480,
        currency: 'USD',
        withhold_iva: true,
        withhold_islr: true,
        invoice_proof: null,
        created_at: '2026-02-15T11:00:00.000Z'
      },
      {
        id: 'exp-7',
        period_month: 1,
        period_year: 2026,
        concept: 'Vigilancia y Seguridad Enero 2026',
        category: 'Seguridad',
        provider_name: 'Seguridad Blindada de Oriente, C.A.',
        provider_rif: 'J-30491823-1',
        invoice_number: 'FAC-2026-0610',
        control_number: '00-001150',
        amount_usd: 1150,
        currency: 'USD',
        withhold_iva: true,
        withhold_islr: true,
        invoice_proof: null,
        created_at: '2026-01-01T08:00:00.000Z'
      }
    ];
  }

  getCondoExpenses() {
    const data = this.getData();
    return (data && data.condo_expenses && Array.isArray(data.condo_expenses))
      ? data.condo_expenses
      : this.getDefaultCondoExpenses();
  }

  getExpenses() {
    return this.getCondoExpenses();
  }

  saveCondoExpense(expenseData) {
    const data = this.getData();
    if (!data.condo_expenses) data.condo_expenses = this.getDefaultCondoExpenses();

    if (expenseData.id) {
      const idx = data.condo_expenses.findIndex(e => e.id === expenseData.id);
      if (idx >= 0) {
        data.condo_expenses[idx] = { ...data.condo_expenses[idx], ...expenseData };
      } else {
        data.condo_expenses.push(expenseData);
      }
    } else {
      const newExp = {
        ...expenseData,
        id: 'exp-' + Date.now(),
        created_at: new Date().toISOString()
      };
      data.condo_expenses.unshift(newExp);
    }
    this.saveData(data);
    return data.condo_expenses;
  }

  deleteCondoExpense(expenseId) {
    const data = this.getData();
    if (!data.condo_expenses) return;
    data.condo_expenses = data.condo_expenses.filter(e => e.id !== expenseId);
    this.saveData(data);
    return data.condo_expenses;
  }

  recordPayment(invoiceId, paymentData) {
    const data = this.getData();
    const invoice = data.invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Cuota no encontrada');

    const newPayment = {
      id: 'p-' + Date.now(),
      invoice_id: invoiceId,
      payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
      payment_method: paymentData.payment_method,
      reference_number: paymentData.reference_number,
      txid: paymentData.txid || null,
      amount_paid: parseFloat(paymentData.amount_paid),
      currency: paymentData.currency,
      issuing_bank: paymentData.issuing_bank || null,
      origin_type: paymentData.origin_type || 'registered',
      origin_phone: paymentData.origin_phone || null,
      origin_doc: paymentData.origin_doc || null,
      origin_name: paymentData.origin_name || null,
      zelle_holder: paymentData.zelle_holder || null,
      zelle_email: paymentData.zelle_email || null,
      snapshot: paymentData.snapshot || null,
      receipt_proof: paymentData.receipt_proof || null, // Comprobante de pago (base64/archivo)
      status: 'verificado'
    };

    if (!data.payments) data.payments = [];
    data.payments.push(newPayment);
    invoice.status = 'pagado';
    invoice.paid_at = newPayment.payment_date;
    invoice.receipt_proof = newPayment.receipt_proof;

    // Verificar si el inquilino estaba moroso y ya no tiene deudas pendientes
    const tenant = data.tenants.find(t => t.id === invoice.tenant_id);
    if (tenant) {
      const remainingOverdue = data.invoices.filter(i => i.tenant_id === tenant.id && i.status === 'en_mora' && i.id !== invoiceId);
      if (remainingOverdue.length === 0) {
        tenant.status = 'activo';
      }
    }

    this.saveData(data);
    return newPayment;
  }

  submitPayment(invoiceId, paymentData) {
    const data = this.getData();
    const invoice = data.invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Cuota no encontrada');
    if (invoice.status === 'pagado') throw new Error('Esta cuota ya figura como pagada');

    const payment = {
      id: 'p-' + Date.now(),
      invoice_id: invoiceId,
      payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
      payment_method: paymentData.payment_method,
      reference_number: paymentData.reference_number,
      txid: paymentData.txid || null,
      amount_paid: parseFloat(paymentData.amount_paid),
      currency: paymentData.currency,
      issuing_bank: paymentData.issuing_bank || null,
      origin_type: paymentData.origin_type || 'registered',
      origin_phone: paymentData.origin_phone || null,
      origin_doc: paymentData.origin_doc || null,
      origin_name: paymentData.origin_name || null,
      zelle_holder: paymentData.zelle_holder || null,
      zelle_email: paymentData.zelle_email || null,
      snapshot: paymentData.snapshot || null,
      receipt_proof: paymentData.receipt_proof || null,
      status: 'pendiente',
      submitted_by: paymentData.submitted_by || null
    };
    if (!data.payments) data.payments = [];
    data.payments.push(payment);
    invoice.status = 'verificando';
    invoice.receipt_proof = payment.receipt_proof;
    this.saveData(data);
    return payment;
  }

  getPendingPayment(invoiceId) {
    const data = this.getData();
    return data && data.payments
      ? data.payments.find(p => p.invoice_id === invoiceId && p.status === 'pendiente') || null
      : null;
  }

  async approvePayment(invoiceId, verifier) {
    // All production approvals are server-side commands. The browser never
    // fabricates a payment, receipt, ledger line, or verifier identity.
    if (typeof window === 'undefined' || !window.supabaseClient?.from || !window.supabaseClient?.rpc) {
      throw new Error('REMOTE_PERSISTENCE_REQUIRED: Conecte Supabase para aprobar pagos.');
    }
    const { data: pending, error: pendingError } = await window.supabaseClient
      .from('payments').select('*').eq('invoice_id', invoiceId).eq('status', 'pendiente').limit(1).maybeSingle();
    if (pendingError) throw pendingError;
    if (!pending) throw new Error('No hay un pago pendiente de revisión.');
    const paymentVersion = Number(pending.version || 1);
    const commandKey = (globalThis.crypto?.randomUUID)
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-0000-0000-0000-000000000000`;
    const { data: result, error: commandError } = await window.supabaseClient.rpc('approve_payment_v2', {
      payment_id: pending.id,
      expected_version: paymentVersion,
      command_key: commandKey
    });
    if (commandError) {
      const code = /CONFLICT|VERSION/.test(commandError.message || '') ? 'OPTIMISTIC_LOCK_CONFLICT' : commandError.message;
      throw new Error(code || 'No se pudo aprobar el pago.');
    }
    return { payment: { ...pending, status: 'verificado', version: paymentVersion + 1 }, invoice: { id: invoiceId }, receipt: { id: result?.receipt_id || null } };
    /* Legacy local approval retained below for migration reference only.
    const data = this.getData();
    const invoice = data.invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Factura no encontrada.');

    // --- PROTECCIÓN CONTRA RACE CONDITIONS Y DOBLE APROBACIÓN ---
    if (invoice.status === 'pagado') {
      throw new Error(`Esta factura ya fue marcada como pagada. No se puede aprobar dos veces.`);
    }

    let payment = data.payments && data.payments.find(p => p.invoice_id === invoiceId);
    if (!payment) {
      payment = {
        id: 'pay-' + Date.now(),
        invoice_id: invoiceId,
        tenant_id: invoice.tenant_id,
        unit_code: invoice.unit_code,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: invoice.payment_method || 'Transferencia Bancaria',
        reference_number: invoice.reference_number || ('REF-' + Date.now().toString().slice(-6)),
        amount_paid: invoice.total_usd,
        currency: 'USD',
        status: 'pendiente',
        created_at: new Date().toISOString()
      };
      if (!Array.isArray(data.payments)) data.payments = [];
      data.payments.push(payment);
    }

    if (payment.status !== 'pendiente') {
      payment.status = 'pendiente';
    }

    // OPTIMISTIC LOCKING: versión para detectar modificaciones concurrentes (PostgreSQL + Local)
    const currentVersion = Number(payment.version || payment._version || 1);
    payment.version = currentVersion + 1;
    payment._version = payment.version;

    payment.status = 'verificado';
    payment.verified_by = verifier || null;
    payment.verified_at = new Date().toISOString();
    invoice.status = 'pagado';
    invoice.paid_at = payment.payment_date;

    // --- HOOK REMOTO SUPABASE POSTGRESQL (CUANDO ESTÉ CONECTADO EN PRODUCCIÓN) ---
    if (typeof window !== 'undefined' && window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      const { data: remoteData, error: remoteErr } = await window.supabaseClient
        .from('payments')
        .update({
          status: 'verificado',
          verified_by: payment.verified_by,
          verified_at: payment.verified_at,
          version: payment.version
        })
        .eq('id', payment.id)
        .eq('version', currentVersion)
        .select();

      const conflictoDeVersion = !remoteErr && Array.isArray(remoteData) && remoteData.length === 0;

      if (remoteErr || conflictoDeVersion) {
        // ROLLBACK: revertir el estado local optimista que se aplicó más arriba en esta función
        payment.status = 'pendiente';
        payment.version = currentVersion;
        payment._version = currentVersion;
        invoice.status = invoice.status === 'pagado' ? 'pendiente' : invoice.status;

        console.error('[SUPABASE OPTIMISTIC LOCK CONFLICT] Modificación concurrente detectada:', remoteErr || 'version_mismatch');

        if (typeof showToast === 'function') {
          showToast(
            'Este pago ya fue verificado o modificado por otro usuario. La pantalla se sincronizó con el servidor — por favor revisa el estado actualizado.',
            'warning',
            'Conflicto de concurrencia'
          );
        } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
          window.showToast(
            'Este pago ya fue verificado o modificado por otro usuario. La pantalla se sincronizó con el servidor — por favor revisa el estado actualizado.',
            'warning',
            'Conflicto de concurrencia'
          );
        } else {
          alert('Este pago ya fue verificado por otro usuario. Refresca la vista para ver el estado actualizado.');
        }

        if (typeof window !== 'undefined' && typeof window.refreshPaymentsView === 'function') {
          window.refreshPaymentsView();
        }

        throw new Error('OPTIMISTIC_LOCK_CONFLICT');
      }

      console.info('[SUPABASE POSTGRES] Pago verificado con incremento de versión en base de datos remota:', payment.id);
    }

    const tenant = data.tenants && data.tenants.find(t => t.id === invoice.tenant_id);

    // Verificar y normalizar solvencia del inquilino tras la aprobación
    if (tenant) {
      const remainingOverdue = (data.invoices || []).filter(i => i.tenant_id === tenant.id && (i.status === 'en_mora' || i.status === 'pendiente') && i.id !== invoiceId);
      if (remainingOverdue.length === 0) {
        tenant.status = 'activo';
      }
    }

    // --- GENERACIÓN AUTOMÁTICA DEL RECIBO OFICIAL DE COBRANZA & REGISTRO CONTABLE ---
    const tenantObj = tenant || { business_name: 'Arrendatario', rif: 'N/A' };
    const receiptNum = `REC-${invoice.period_year}-${String(invoice.period_month).padStart(2, '0')}-${invoice.unit_code}`;
    
    const receipt = {
      id: 'rec-' + Date.now(),
      receipt_number: receiptNum,
      invoice_id: invoiceId,
      invoice_number: invoice.invoice_number,
      tenant_id: invoice.tenant_id,
      tenant_name: tenantObj.business_name,
      tenant_rif: tenantObj.rif,
      unit_code: invoice.unit_code,
      period_month: invoice.period_month,
      period_year: invoice.period_year,
      rent_usd: invoice.rent_usd,
      condo_usd: invoice.condo_usd,
      total_usd: invoice.total_usd,
      payment_method: payment.payment_method,
      reference_number: payment.reference_number,
      txid: payment.txid || null,
      amount_paid: payment.amount_paid,
      currency: payment.currency,
      issuing_bank: payment.issuing_bank || null,
      origin_type: payment.origin_type || 'registered',
      origin_phone: payment.origin_phone || null,
      origin_doc: payment.origin_doc || null,
      origin_name: payment.origin_name || null,
      zelle_holder: payment.zelle_holder || null,
      zelle_email: payment.zelle_email || null,
      snapshot: payment.snapshot || (window.financialEngine ? window.financialEngine.createPaymentSnapshot(invoice.total_usd, 'USD') : null),
      receipt_proof: payment.receipt_proof || null,
      approved_by: verifier || 'Administración CCMS',
      approved_at: new Date().toISOString(),
      status: 'emitido'
    };

    if (!data.receipts) data.receipts = [];
    const existingRecIdx = data.receipts.findIndex(r => r.invoice_id === invoiceId);
    if (existingRecIdx >= 0) {
      data.receipts[existingRecIdx] = receipt;
    } else {
      data.receipts.push(receipt);
    }

    this.saveData(data);
    return { payment, invoice, receipt }; */
  }

  getReceipts() {
    const data = this.getData();
    return (data && data.receipts) ? data.receipts : [];
  }

  getReceiptByInvoiceId(invoiceId) {
    const receipts = this.getReceipts();
    return receipts.find(r => r.invoice_id === invoiceId) || null;
  }

  rejectPayment(invoiceId, reason, verifier) {
    const data = this.getData();
    const invoice = data.invoices.find(i => i.id === invoiceId);
    const payment = data.payments && data.payments.find(p => p.invoice_id === invoiceId && p.status === 'pendiente');
    if (!invoice || !payment) throw new Error('No hay un pago pendiente de revisión');
    payment.status = 'rechazado';
    payment.rejection_reason = reason || 'No especificado';
    payment.verified_by = verifier || null;
    payment.verified_at = new Date().toISOString();
    invoice.status = 'pendiente';
    this.saveData(data);
    return payment;
  }

  // --- MÓDULO DE ACUERDOS DE OBRAS Y DEDUCCIONES (ARTS. 13 & 32 G.O. 40.418) ---
  getAgreements() {
    const data = this.getData();
    if (!data.agreements) {
      try {
        data.agreements = JSON.parse(localStorage.getItem('ccms_agreements') || '[]');
      } catch (e) {
        data.agreements = [];
      }
    }
    return data.agreements || [];
  }

  saveAgreement(agrData) {
    const data = this.getData();
    if (!data.agreements) data.agreements = [];
    const newAgr = {
      id: agrData.id || 'agr-' + Date.now(),
      tenant_id: agrData.tenant_id,
      unit_code: agrData.unit_code,
      type: agrData.type || 'Deducción de Canon por Obras Mayores (Art. 13 & 32)',
      description: agrData.description || 'Acuerdo de Obras y Mejoras Estructurales',
      total_amount_usd: parseFloat(agrData.total_amount_usd) || 0,
      monthly_discount_usd: parseFloat(agrData.monthly_discount_usd) || 0,
      months_count: parseInt(agrData.months_count) || 6,
      start_date: agrData.start_date || new Date().toISOString().split('T')[0],
      end_date: agrData.end_date || '',
      proof_file: agrData.proof_file || null,
      created_at: new Date().toISOString(),
      status: 'activo'
    };

    const existingIdx = data.agreements.findIndex(a => a.id === newAgr.id);
    if (existingIdx >= 0) {
      data.agreements[existingIdx] = newAgr;
    } else {
      data.agreements.unshift(newAgr);
    }

    this.saveData(data);
    try {
      localStorage.setItem('ccms_agreements', JSON.stringify(data.agreements));
    } catch (e) {}
    return newAgr;
  }

  deleteAgreement(agreementId) {
    const data = this.getData();
    if (!data.agreements) return [];
    data.agreements = data.agreements.filter(a => a.id !== agreementId);
    this.saveData(data);
    try {
      localStorage.setItem('ccms_agreements', JSON.stringify(data.agreements));
    } catch (e) {}
    return data.agreements;
  }

  // --- MÓDULO DE CONFIGURACIÓN DE LA APP ---
  getSettings() {
    return this.getData().app_settings || {};
  }

  saveSettings(newSettings) {
    const data = this.getData();
    data.app_settings = { ...this.getSettings(), ...newSettings };
    this.saveData(data);
    return data.app_settings;
  }

  // --- CUENTAS RECEPTORAS OFICIALES & ASIGNACIÓN POR INQUILINO ---
  getDefaultReceivingAccounts() {
    return [
      {
        id: 'acc-banesco-divisas',
        bank: 'Banesco Banco Universal',
        type: 'Custodia Moneda Extranjera (USD)',
        account_number: '0134-0982-12-0982341200',
        phone: '',
        email: '',
        wallet_address: '',
        binance_pay_id: '',
        beneficiary: 'Centro Comercial Mario Sánchez, C.A.',
        rif: 'J-29881234-0',
        icon: 'fa-solid fa-vault',
        badge: 'USD Oficial',
        instructions: 'Indicar número de contrato y unidad comercial en el memo de depósito en taquilla o transferencia entre cuentas Banesco Verde.',
        is_active: true,
        assigned_tenants: ['all']
      },
      {
        id: 'acc-pagomovil',
        bank: 'Pago Móvil Interbancario (Bs. BCV)',
        type: 'Pago Móvil Jurídico C2P',
        account_number: '',
        phone: '0414-8123456',
        email: '',
        wallet_address: '',
        binance_pay_id: '',
        rif: 'J-29881234-0',
        bank_code: '0134 (Banesco) / 0102 (BDV)',
        beneficiary: 'Centro Comercial Mario Sánchez, C.A.',
        icon: 'fa-solid fa-mobile-screen-button',
        badge: 'Bs. Tasa BCV',
        instructions: 'Calcular el monto exacto multiplicando el total USD por la tasa oficial BCV del día valor. Adjuntar referencia de 8 dígitos.',
        is_active: true,
        assigned_tenants: ['all']
      },
      {
        id: 'acc-banesco-bs',
        bank: 'Banesco Banco Universal',
        type: 'Cuenta Corriente Nacional (Bs)',
        account_number: '0134-0382-71-3821004921',
        phone: '',
        email: '',
        wallet_address: '',
        binance_pay_id: '',
        beneficiary: 'Centro Comercial Mario Sánchez, C.A.',
        rif: 'J-29881234-0',
        icon: 'fa-solid fa-building-columns',
        badge: 'Transferencia Bs.',
        instructions: 'Transferencias desde cualquier banco nacional vía ACH o inmediata. Notificar dentro de las 24 horas del día valor.',
        is_active: true,
        assigned_tenants: ['all']
      },
      {
        id: 'acc-zelle',
        bank: 'Zelle (Divisas EE.UU.)',
        type: 'Zelle Corporativo',
        account_number: '',
        phone: '',
        email: 'pagos@ccmariosanchez.com',
        wallet_address: '',
        binance_pay_id: '',
        beneficiary: 'Mario Sanchez Commercial Management LLC',
        rif: 'EIN-8291044',
        icon: 'fa-solid fa-bolt',
        badge: 'Zelle Directo',
        instructions: 'Colocar obligatoriamente en la nota o concepto: "Recibo [N° Recibo] - [Unidad Comercial]". Cero comisiones.',
        is_active: true,
        assigned_tenants: ['all']
      },
      {
        id: 'acc-usdt',
        bank: 'Criptoactivos (USDT TRC20 / Binance Pay)',
        type: 'Billetera Digital USDT (Red TRON)',
        account_number: '',
        phone: '',
        email: '',
        wallet_address: 'TYp9XvR4KmZn7Qb8Ls2D1Hg5wJ9kL4mPqR',
        binance_pay_id: '891044231',
        beneficiary: 'Tesorería CC Mario Sánchez',
        rif: 'J-29881234-0',
        icon: 'fa-solid fa-coins',
        badge: 'USDT 1:1 USD',
        instructions: 'Enviar únicamente por red TRON (TRC20) o Binance Pay ID. El sistema verifica el hash de transacción (TxID de 64 caracteres hex) de manera automatizada.',
        is_active: true,
        assigned_tenants: ['all']
      }
    ];
  }

  getReceivingAccounts(tenantId = null) {
    const data = this.getData();
    const accounts = (data && data.receiving_accounts && Array.isArray(data.receiving_accounts))
      ? data.receiving_accounts
      : this.getDefaultReceivingAccounts();

    if (!tenantId) {
      return accounts;
    }

    return accounts.filter(acc => {
      if (acc.is_active === false) return false;
      if (!acc.assigned_tenants || !Array.isArray(acc.assigned_tenants)) return true;
      if (acc.assigned_tenants.includes('all')) return true;
      return acc.assigned_tenants.includes(tenantId);
    });
  }

  saveReceivingAccount(accountData) {
    const data = this.getData();
    if (!data.receiving_accounts) data.receiving_accounts = this.getDefaultReceivingAccounts();

    if (accountData.id) {
      const idx = data.receiving_accounts.findIndex(a => a.id === accountData.id);
      if (idx >= 0) {
        data.receiving_accounts[idx] = { ...data.receiving_accounts[idx], ...accountData };
      } else {
        data.receiving_accounts.push(accountData);
      }
    } else {
      const newAcc = {
        ...accountData,
        id: 'acc-' + Date.now(),
        is_active: accountData.is_active !== undefined ? accountData.is_active : true,
        assigned_tenants: (accountData.assigned_tenants && accountData.assigned_tenants.length) ? accountData.assigned_tenants : ['all']
      };
      data.receiving_accounts.push(newAcc);
    }
    this.saveData(data);
    return data.receiving_accounts;
  }

  toggleReceivingAccount(accountId, isActive = null) {
    const data = this.getData();
    if (!data.receiving_accounts) return;
    const acc = data.receiving_accounts.find(a => a.id === accountId);
    if (acc) {
      acc.is_active = (isActive !== null) ? Boolean(isActive) : !acc.is_active;
      this.saveData(data);
    }
    return acc;
  }

  deleteReceivingAccount(accountId) {
    const data = this.getData();
    if (!data.receiving_accounts) return;
    data.receiving_accounts = data.receiving_accounts.filter(a => a.id !== accountId);
    this.saveData(data);
    return data.receiving_accounts;
  }

  // ==============================================================================
  // MÓDULO DE AUDITORÍA & TRAZABILIDAD DE MODIFICACIONES (AUDIT TRAIL)
  // Registra quién realizó el cambio, cuándo, qué entidad y qué valores cambiaron
  // ==============================================================================
  logAuditAction({ action, entity, entity_id, entity_name, details, previous_state = null, new_state = null, user = null }) {
    const data = this.getData();
    if (!data.audit_trail) data.audit_trail = [];

    let authorName = 'Sistema Automático';
    let authorEmail = 'sistema@ccmariosanchez.com';
    let authorRole = 'system';

    if (user) {
      authorName = user.display_name || user.name || authorName;
      authorEmail = user.identifier || user.email || authorEmail;
      authorRole = user.role || authorRole;
    } else if (typeof window !== 'undefined' && window.AuthGuard && typeof window.AuthGuard.currentUser === 'function') {
      const current = window.AuthGuard.currentUser();
      if (current) {
        authorName = current.display_name || authorName;
        authorEmail = current.identifier || authorEmail;
        authorRole = current.role || authorRole;
      }
    }

    const logEntry = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      action: action || 'EDIT', // CREATE, UPDATE, DELETE, RECONCILE, DISPATCH
      entity: entity || 'GENERAL', // TENANT, CONTRACT, EXPENSE, INVENTORY, KARDEX, SETTINGS
      entity_id: entity_id || 'N/A',
      entity_name: entity_name || entity_id || 'Registro',
      details: details || `Modificación realizada en ${entity}`,
      author_name: authorName,
      author_email: authorEmail,
      author_role: authorRole,
      previous_state: previous_state ? JSON.parse(JSON.stringify(previous_state)) : null,
      new_state: new_state ? JSON.parse(JSON.stringify(new_state)) : null
    };

    data.audit_trail.unshift(logEntry);
    // Limitar historial a los últimos 500 eventos para optimizar espacio
    if (data.audit_trail.length > 500) {
      data.audit_trail = data.audit_trail.slice(0, 500);
    }

    this.saveData(data);
    return logEntry;
  }

  getAuditLogs(limit = 100) {
    const data = this.getData();
    if (!data || !Array.isArray(data.audit_trail)) return [];
    return data.audit_trail.slice(0, limit);
  }

  getAuditLogsForEntity(entity, entity_id = null) {
    const logs = this.getAuditLogs(300);
    return logs.filter(l => {
      const matchEntity = (!entity || l.entity === entity);
      const matchId = (!entity_id || l.entity_id === entity_id);
      return matchEntity && matchId;
    });
  }
}

// Instancia global: nunca dejar la aplicación en un estado silencioso sin servicio.
try {
  window.DatabaseService = DatabaseService;
  window.dbService = new DatabaseService();
  // Declaración global explícita para módulos legacy que referencian dbService sin window.
  var dbService = window.dbService;
} catch (error) {
  console.error('[DB] No se pudo inicializar el servicio de datos:', error);
  const fallbackData = (typeof globalThis !== 'undefined' && globalThis.CCMS_AUTHORIZED_DEMO_FIXTURES?.full_dataset) || { units: [], tenants: [], contracts: [], invoices: [], payments: [], receipts: [], condo_expenses: [], activos_fijos: [], consumibles: [], kardex_movimientos: [], special_agreements: [], receiving_accounts: [], settings: {}, audit_trail: [] };
  window.dbService = {
    persistenceState: 'error',
    getData: () => JSON.parse(JSON.stringify(fallbackData)),
    getUnits: () => fallbackData.units || [], getTenants: () => fallbackData.tenants || [], getContracts: () => fallbackData.contracts || [], getInvoices: () => fallbackData.invoices || [], getPayments: () => fallbackData.payments || [], getReceipts: () => fallbackData.receipts || [], getCondoExpenses: () => fallbackData.condo_expenses || [], getActivosFijos: () => fallbackData.activos_fijos || [], getConsumibles: () => fallbackData.consumibles || [], getKardexMovimientos: () => fallbackData.kardex_movimientos || [], getReceivingAccounts: () => fallbackData.receiving_accounts || [], getSettings: () => fallbackData.settings || {}, getAuditLogs: () => fallbackData.audit_trail || [],
    saveData: () => { throw new Error('REMOTE_PERSISTENCE_REQUIRED'); }
  };
  var dbService = window.dbService;
}
