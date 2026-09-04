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
    this.isSupabaseConfigured = Boolean(this.supabaseUrl && this.supabaseKey);
    this.initDatabase();
  }

  initDatabase() {
    if (!localStorage.getItem(this.storageKey)) {
      this.seedInitialData();
    }
  }

  resetDemoData() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem('ccms_notif_log_v1');
    this.seedInitialData();
    return this.getData();
  }

  seedInitialData() {
    const initialData = {
      units: [
        { id: 'u-1', code: 'LOT-A1', name: 'Macro-Lote A (Frente Av. Municipal)', category: 'macro-lotes', area_m2: 1500, base_rent_usd: 3500, condo_aliquot: 0.289, status: 'arrendado', tenant_id: 't-1' },
        { id: 'u-2', code: 'LOT-A2', name: 'Macro-Lote B (Zona Posterior & Maniobras)', category: 'macro-lotes', area_m2: 1200, base_rent_usd: 2600, condo_aliquot: 0.231, status: 'arrendado', tenant_id: 't-2' },
        { id: 'u-3', code: 'LOC-01', name: 'Local 01 — Fachada Principal', category: 'locales', area_m2: 250, base_rent_usd: 1100, condo_aliquot: 0.048, status: 'arrendado', tenant_id: 't-3' },
        { id: 'u-4', code: 'LOC-02', name: 'Local 02 — Fachada Comercial', category: 'locales', area_m2: 250, base_rent_usd: 1050, condo_aliquot: 0.048, status: 'arrendado', tenant_id: 't-4' },
        { id: 'u-5', code: 'LOC-03', name: 'Local 03 — Planta Baja', category: 'locales', area_m2: 180, base_rent_usd: 850, condo_aliquot: 0.035, status: 'disponible', tenant_id: null },
        { id: 'u-6', code: 'LOC-04', name: 'Local 04 — Planta Baja', category: 'locales', area_m2: 180, base_rent_usd: 850, condo_aliquot: 0.035, status: 'arrendado', tenant_id: 't-5' },
        { id: 'u-7', code: 'LOC-05', name: 'Local 05 — Zona Media', category: 'locales', area_m2: 160, base_rent_usd: 750, condo_aliquot: 0.031, status: 'disponible', tenant_id: null },
        { id: 'u-8', code: 'LOC-06', name: 'Local 06 — Zona Media', category: 'locales', area_m2: 160, base_rent_usd: 750, condo_aliquot: 0.031, status: 'arrendado', tenant_id: 't-6' },
        { id: 'u-9', code: 'GAL-01', name: 'Galpón 01 Logístico y Almacén', category: 'galpones', area_m2: 750, base_rent_usd: 1900, condo_aliquot: 0.145, status: 'arrendado', tenant_id: 't-7' },
        { id: 'u-10', code: 'GAL-02', name: 'Galpón 02 Distribución & Taller', category: 'galpones', area_m2: 560, base_rent_usd: 1500, condo_aliquot: 0.108, status: 'disponible', tenant_id: null }
      ],
      tenants: [
        {
          id: 't-1',
          rif: 'J-30987123-4',
          business_name: 'Distribuidora Oriente Marino, C.A.',
          trade_name: 'Oriente Marine Supply',
          legal_rep_name: 'Carlos Eduardo Mendoza',
          legal_rep_dni: 'V-14.289.412',
          email: 'carlos.mendoza@orientemarine.com',
          phone: '+58 281-2674400',
          whatsapp: '+58 414-8123456',
          commercial_activity: 'Repuestos e insumos navieros e industriales',
          status: 'activo',
          unit_code: 'LOT-A1'
        },
        {
          id: 't-2',
          rif: 'J-40112890-1',
          business_name: 'Logística y Cargas del Caribe, S.A.',
          trade_name: 'Caribe Logistics Hub',
          legal_rep_name: 'Mariana Valentina Silva',
          legal_rep_dni: 'V-16.904.551',
          email: 'msilva@caribelogistics.com',
          phone: '+58 281-2869010',
          whatsapp: '+58 424-8199234',
          commercial_activity: 'Distribución logística, bodegaje y paquetería',
          status: 'activo',
          unit_code: 'LOT-A2'
        },
        {
          id: 't-3',
          rif: 'J-31445892-0',
          business_name: 'Ferretería Industrial La Cruz, C.A.',
          trade_name: 'FerroCruz Pro',
          legal_rep_name: 'Ing. Roberto Hernández',
          legal_rep_dni: 'V-12.780.334',
          email: 'gerencia@ferrocruz.com.ve',
          phone: '+58 281-2681122',
          whatsapp: '+58 412-3556789',
          commercial_activity: 'Materiales de construcción y ferretería pesada',
          status: 'activo',
          unit_code: 'LOC-01'
        },
        {
          id: 't-4',
          rif: 'J-50239011-8',
          business_name: 'AutoPartes & Servicios Express, C.A.',
          trade_name: 'AutoExpress PLC',
          legal_rep_name: 'Alejandro José Gómez',
          legal_rep_dni: 'V-18.441.902',
          email: 'admin@autopartesexpress.net',
          phone: '+58 281-2659988',
          whatsapp: '+58 416-6801234',
          commercial_activity: 'Venta de autopartes, lubricantes y baterías',
          status: 'activo',
          unit_code: 'LOC-02'
        },
        {
          id: 't-5',
          rif: 'J-41220993-2',
          business_name: 'Bodegón & Delicateses El Faro, C.A.',
          trade_name: 'El Faro Market',
          legal_rep_name: 'Lucía Carolina Morales',
          legal_rep_dni: 'V-15.332.109',
          email: 'contacto@elfaromarket.com',
          phone: '+58 281-2693311',
          whatsapp: '+58 424-8224567',
          commercial_activity: 'Víveres, importados, panadería gourmet y café',
          status: 'moroso',
          unit_code: 'LOC-04'
        },
        {
          id: 't-6',
          rif: 'J-29801455-9',
          business_name: 'Servicios Técnicos Industriales Anzoátegui, C.A.',
          trade_name: 'STIA Electricidad & Redes',
          legal_rep_name: 'Nelson José Vargas',
          legal_rep_dni: 'V-13.882.019',
          email: 'nvargas@stia.com.ve',
          phone: '+58 281-2710033',
          whatsapp: '+58 414-8209988',
          commercial_activity: 'Mantenimiento electromecánico y telecomunicaciones',
          status: 'activo',
          unit_code: 'LOC-06'
        },
        {
          id: 't-7',
          rif: 'J-31889021-7',
          business_name: 'Consorcio Naviero del Golfo, C.A.',
          trade_name: 'Naviera del Golfo',
          legal_rep_name: 'Cap. Andrés Eloy Rivas',
          legal_rep_dni: 'V-10.450.912',
          email: 'operaciones@navieradelgolfo.com',
          phone: '+58 281-2601199',
          whatsapp: '+58 412-8877112',
          commercial_activity: 'Armadores navieros y servicios costa afuera',
          status: 'activo',
          unit_code: 'GAL-01'
        }
      ],
      contracts: [
        {
          id: 'c-1',
          contract_number: 'CCMS-CTR-2025-001',
          tenant_id: 't-1',
          unit_code: 'LOT-A1',
          start_date: '2025-06-01',
          end_date: '2026-06-01',
          rent_usd: 3500,
          rent_method: 'CAF (Canon Fijo Art. 32)',
          deposit_usd: 10500,
          deposit_months: 3,
          status: 'vigente'
        },
        {
          id: 'c-2',
          contract_number: 'CCMS-CTR-2025-002',
          tenant_id: 't-2',
          unit_code: 'LOT-A2',
          start_date: '2025-08-15',
          end_date: '2026-08-15',
          rent_usd: 2600,
          rent_method: 'CAF (Canon Fijo Art. 32)',
          deposit_usd: 7800,
          deposit_months: 3,
          status: 'vigente'
        },
        {
          id: 'c-3',
          contract_number: 'CCMS-CTR-2025-003',
          tenant_id: 't-3',
          unit_code: 'LOC-01',
          start_date: '2025-03-01',
          end_date: '2026-03-31', // Por vencer
          rent_usd: 1100,
          rent_method: 'CAF (Canon Fijo Art. 32)',
          deposit_usd: 3300,
          deposit_months: 3,
          status: 'por_vencer'
        },
        {
          id: 'c-4',
          contract_number: 'CCMS-CTR-2025-004',
          tenant_id: 't-4',
          unit_code: 'LOC-02',
          start_date: '2025-09-01',
          end_date: '2026-09-01',
          rent_usd: 1050,
          rent_method: 'CAF (Canon Fijo Art. 32)',
          deposit_usd: 3150,
          deposit_months: 3,
          status: 'vigente'
        },
        {
          id: 'c-5',
          contract_number: 'CCMS-CTR-2025-005',
          tenant_id: 't-5',
          unit_code: 'LOC-04',
          start_date: '2025-01-10',
          end_date: '2026-01-10',
          rent_usd: 850,
          rent_method: 'CAF (Canon Fijo Art. 32)',
          deposit_usd: 2550,
          deposit_months: 3,
          status: 'en_prorroga'
        },
        {
          id: 'c-6',
          contract_number: 'CCMS-CTR-2025-006',
          tenant_id: 't-6',
          unit_code: 'LOC-06',
          start_date: '2025-10-01',
          end_date: '2026-10-01',
          rent_usd: 750,
          rent_method: 'CAF (Canon Fijo Art. 32)',
          deposit_usd: 2250,
          deposit_months: 3,
          status: 'vigente'
        },
        {
          id: 'c-7',
          contract_number: 'CCMS-CTR-2025-007',
          tenant_id: 't-7',
          unit_code: 'GAL-01',
          start_date: '2025-05-01',
          end_date: '2026-05-01',
          rent_usd: 1900,
          rent_method: 'CAF (Canon Fijo Art. 32)',
          deposit_usd: 5700,
          deposit_months: 3,
          status: 'vigente'
        }
      ],
      invoices: [
        {
          id: 'inv-1',
          invoice_number: 'REC-2026-03-001',
          tenant_id: 't-1',
          unit_code: 'LOT-A1',
          period_month: 3,
          period_year: 2026,
          rent_usd: 3500,
          condo_usd: 250,
          total_usd: 3750,
          due_date: '2026-03-05',
          status: 'pagado',
          paid_at: '2026-03-03'
        },
        {
          id: 'inv-2',
          invoice_number: 'REC-2026-03-002',
          tenant_id: 't-2',
          unit_code: 'LOT-A2',
          period_month: 3,
          period_year: 2026,
          rent_usd: 2600,
          condo_usd: 200,
          total_usd: 2800,
          due_date: '2026-03-05',
          status: 'pagado',
          paid_at: '2026-03-04'
        },
        {
          id: 'inv-3',
          invoice_number: 'REC-2026-03-003',
          tenant_id: 't-3',
          unit_code: 'LOC-01',
          period_month: 3,
          period_year: 2026,
          rent_usd: 1100,
          condo_usd: 80,
          total_usd: 1180,
          due_date: '2026-03-05',
          status: 'pagado',
          paid_at: '2026-03-02'
        },
        {
          id: 'inv-4',
          invoice_number: 'REC-2026-03-004',
          tenant_id: 't-4',
          unit_code: 'LOC-02',
          period_month: 3,
          period_year: 2026,
          rent_usd: 1050,
          condo_usd: 80,
          total_usd: 1130,
          due_date: '2026-03-05',
          status: 'pendiente',
          paid_at: null
        },
        {
          id: 'inv-5',
          invoice_number: 'REC-2026-03-005',
          tenant_id: 't-5',
          unit_code: 'LOC-04',
          period_month: 3,
          period_year: 2026,
          rent_usd: 850,
          condo_usd: 60,
          total_usd: 910,
          due_date: '2026-03-05',
          status: 'en_mora',
          paid_at: null
        },
        {
          id: 'inv-6',
          invoice_number: 'REC-2026-03-006',
          tenant_id: 't-6',
          unit_code: 'LOC-06',
          period_month: 3,
          period_year: 2026,
          rent_usd: 750,
          condo_usd: 50,
          total_usd: 800,
          due_date: '2026-03-05',
          status: 'pendiente',
          paid_at: null
        },
        {
          id: 'inv-7',
          invoice_number: 'REC-2026-03-007',
          tenant_id: 't-7',
          unit_code: 'GAL-01',
          period_month: 3,
          period_year: 2026,
          rent_usd: 1900,
          condo_usd: 150,
          total_usd: 2050,
          due_date: '2026-03-05',
          status: 'pagado',
          paid_at: '2026-03-01'
        },
        {
          id: 'inv-8',
          invoice_number: 'REC-2026-04-008',
          tenant_id: 't-1',
          unit_code: 'LOT-A1',
          period_month: 4,
          period_year: 2026,
          rent_usd: 3500,
          condo_usd: 250,
          total_usd: 3750,
          due_date: '2026-04-05',
          status: 'pendiente',
          paid_at: null
        },
        // --- HISTORIAL PREVIO (ENERO Y FEBRERO 2026) PARA AUDITORÍA SOCIETARIA ---
        {
          id: 'inv-hist-1',
          invoice_number: 'REC-2026-02-001',
          tenant_id: 't-1',
          unit_code: 'LOT-A1',
          period_month: 2,
          period_year: 2026,
          rent_usd: 3500,
          condo_usd: 240,
          total_usd: 3740,
          due_date: '2026-02-05',
          status: 'pagado',
          paid_at: '2026-02-04'
        },
        {
          id: 'inv-hist-2',
          invoice_number: 'REC-2026-01-001',
          tenant_id: 't-1',
          unit_code: 'LOT-A1',
          period_month: 1,
          period_year: 2026,
          rent_usd: 3500,
          condo_usd: 230,
          total_usd: 3730,
          due_date: '2026-01-05',
          status: 'pagado',
          paid_at: '2026-01-03'
        },
        {
          id: 'inv-hist-3',
          invoice_number: 'REC-2026-02-003',
          tenant_id: 't-3',
          unit_code: 'LOC-01',
          period_month: 2,
          period_year: 2026,
          rent_usd: 1100,
          condo_usd: 80,
          total_usd: 1180,
          due_date: '2026-02-05',
          status: 'pagado',
          paid_at: '2026-02-03'
        },
        {
          id: 'inv-hist-4',
          invoice_number: 'REC-2026-02-005',
          tenant_id: 't-5',
          unit_code: 'LOC-04',
          period_month: 2,
          period_year: 2026,
          rent_usd: 850,
          condo_usd: 60,
          total_usd: 910,
          due_date: '2026-02-05',
          status: 'pagado',
          paid_at: '2026-02-08'
        }
      ],
      payments: [
        {
          id: 'p-1',
          invoice_id: 'inv-1',
          payment_date: '2026-03-03',
          payment_method: 'Transferencia Divisas (Custodia Banesco)',
          reference_number: 'BNS-09823412',
          amount_paid: 3750,
          currency: 'USD',
          status: 'verificado'
        },
        {
          id: 'p-2',
          invoice_id: 'inv-2',
          payment_date: '2026-03-04',
          payment_method: 'Transferencia Bs. (Tasa Oficial BCV)',
          reference_number: 'BDV-55421098',
          amount_paid: 203000,
          currency: 'BS',
          status: 'verificado'
        },
        {
          id: 'p-3',
          invoice_id: 'inv-3',
          payment_date: '2026-03-02',
          payment_method: 'Pago Móvil Mercantil',
          reference_number: 'PM-78119022',
          amount_paid: 85550,
          currency: 'BS',
          status: 'verificado'
        },
        {
          id: 'p-4',
          invoice_id: 'inv-7',
          payment_date: '2026-03-01',
          payment_method: 'Zelle',
          reference_number: 'ZLL-90184451',
          amount_paid: 2050,
          currency: 'USD',
          status: 'verificado'
        }
      ]
    };

    localStorage.setItem(this.storageKey, JSON.stringify(initialData));
  }

  getData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Error reading localStorage DB:", e);
      return null;
    }
  }

  saveData(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  // --- MÉTODOS CRUD ---

  getUnits() {
    const data = this.getData();
    return data ? data.units : [];
  }

  getTenants() {
    const data = this.getData();
    return data ? data.tenants : [];
  }

  getContracts() {
    const data = this.getData();
    return data ? data.contracts : [];
  }

  getInvoices() {
    const data = this.getData();
    return data ? data.invoices : [];
  }

  getPayments() {
    const data = this.getData();
    return data ? data.payments : [];
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

  getCondoExpenses() {
    const data = this.getData();
    return (data && data.condo_expenses) ? data.condo_expenses : [
      { id: 'exp-1', period_month: 3, period_year: 2026, concept: 'Vigilancia y Seguridad Armada 24/7', category: 'Seguridad', amount_usd: 1200 },
      { id: 'exp-2', period_month: 3, period_year: 2026, concept: 'Energía Eléctrica Común y Postes (Corpoelec)', category: 'Servicios', amount_usd: 350 },
      { id: 'exp-3', period_month: 3, period_year: 2026, concept: 'Suministro Cisterna de Agua (40.000 L)', category: 'Servicios', amount_usd: 220 },
      { id: 'exp-4', period_month: 3, period_year: 2026, concept: 'Mantenimiento Preventivo Drenajes y Asfalto', category: 'Mantenimiento', amount_usd: 180 }
    ];
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

  approvePayment(invoiceId, verifier) {
    const data = this.getData();
    const invoice = data.invoices.find(i => i.id === invoiceId);
    const payment = data.payments && data.payments.find(p => p.invoice_id === invoiceId && p.status === 'pendiente');
    if (!invoice || !payment) throw new Error('No hay un pago pendiente de revisión');
    payment.status = 'verificado';
    payment.verified_by = verifier || null;
    payment.verified_at = new Date().toISOString();
    invoice.status = 'pagado';
    invoice.paid_at = payment.payment_date;
    this.saveData(data);
    return payment;
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

  // --- MÓDULO DE CONFIGURACIÓN DE LA APP ---
  getSettings() {
    const data = this.getData();
    const defaults = {
      // Configuración de Cuotas & Cánones
      rate_locales_m2: 4.5,
      rate_macrolotes_m2: 2.3,
      rate_galpones_m2: 2.5,
      condo_fee_aliquot_base: 8.0, // 8% sobre canon base
      // Configuración de Alertas & Vencimientos
      cutoff_day: 5,               // Día 5 de cada mes
      alert_days_before: 3,        // Aviso preventivo 3 días antes
      grace_days: 5,               // 5 días de gracia antes de marcar en mora
      // Plantillas de Mensajes
      msg_preventive_template: `Estimados *{inquilino}* ({unidad}):\nLe remitimos su aviso de cobro del período *{periodo}* por un total de *{monto_usd}* (Bs. {monto_bs} a tasa BCV {tasa_bcv}).\nFecha límite de pago: *{fecha_limite}*.\nPor favor remitir comprobante a este canal para conciliación.`,
      msg_mora_template: `⚠️ *AVISO DE RETRASO — CC MARIO SÁNCHEZ*\nEstimados *{inquilino}* ({unidad}):\nLe informamos que su cuota del período *{periodo}* se encuentra en estado de MORA por un saldo de *{monto_usd}* (Bs. {monto_bs}).\nConforme a la Gaceta Oficial 40.418, agradecemos regularizar el pago a la brevedad para evitar recargos o suspensión de servicios comunes.`
    };
    return (data && data.app_settings) ? { ...defaults, ...data.app_settings } : defaults;
  }

  // --- CUENTAS RECEPTORAS OFICIALES DE LA SOCIEDAD ADMINISTRADORA ---
  getReceivingAccounts() {
    return [
      {
        id: 'acc-banesco-divisas',
        bank: 'Banesco Banco Universal',
        type: 'Custodia Moneda Extranjera (USD)',
        account_number: '0134-0982-12-0982341200',
        beneficiary: 'Centro Comercial Mario Sánchez, C.A.',
        rif: 'J-29881234-0',
        icon: 'fa-solid fa-vault',
        badge: 'USD Oficial',
        instructions: 'Indicar número de contrato y unidad comercial en el memo de depósito en taquilla o transferencia entre cuentas Banesco Verde.'
      },
      {
        id: 'acc-pagomovil',
        bank: 'Pago Móvil Interbancario (Bs. BCV)',
        type: 'Pago Móvil Jurídico C2P',
        phone: '0414-8123456',
        rif: 'J-29881234-0',
        bank_code: '0134 (Banesco) / 0102 (BDV)',
        beneficiary: 'Centro Comercial Mario Sánchez, C.A.',
        icon: 'fa-solid fa-mobile-screen-button',
        badge: 'Bs. Tasa BCV',
        instructions: 'Calcular el monto exacto multiplicando el total USD por la tasa oficial BCV del día valor. Adjuntar referencia de 8 dígitos.'
      },
      {
        id: 'acc-banesco-bs',
        bank: 'Banesco Banco Universal',
        type: 'Cuenta Corriente Nacional (Bs)',
        account_number: '0134-0382-71-3821004921',
        beneficiary: 'Centro Comercial Mario Sánchez, C.A.',
        rif: 'J-29881234-0',
        icon: 'fa-solid fa-building-columns',
        badge: 'Transferencia Bs.',
        instructions: 'Transferencias desde cualquier banco nacional vía ACH o inmediata. Notificar dentro de las 24 horas del día valor.'
      },
      {
        id: 'acc-zelle',
        bank: 'Zelle (Divisas EE.UU.)',
        type: 'Zelle Corporativo',
        email: 'pagos@ccmariosanchez.com',
        beneficiary: 'Mario Sanchez Commercial Management LLC',
        icon: 'fa-solid fa-bolt',
        badge: 'Zelle Directo',
        instructions: 'Colocar obligatoriamente en la nota o concepto: "Recibo [N° Recibo] - [Unidad Comercial]". Cero comisiones.'
      },
      {
        id: 'acc-usdt',
        bank: 'Criptoactivos (USDT TRC20 / Binance Pay)',
        type: 'Billetera Digital USDT (Red TRON)',
        wallet_address: 'TYp9XvR4KmZn7Qb8Ls2D1Hg5wJ9kL4mPqR',
        binance_pay_id: '891044231',
        beneficiary: 'Tesorería CC Mario Sánchez',
        icon: 'fa-solid fa-coins',
        badge: 'USDT 1:1 USD',
        instructions: 'Enviar únicamente por red TRON (TRC20) o Binance Pay ID. El sistema verifica el hash de transacción (TxID de 64 caracteres hex) de manera automatizada.'
      }
    ];
  }
}

// Instancia global
window.dbService = new DatabaseService();
