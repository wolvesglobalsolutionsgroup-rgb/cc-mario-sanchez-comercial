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
    // Las escrituras de negocio se serializan para evitar que dos cambios
    // consecutivos se pisen y para poder revertir de forma determinista si
    // el servidor rechaza alguno de ellos.
    this._persistQueue = Promise.resolve();
    this.demoStorageError = null;
    this.demoStorageReady = false;
    this.initDatabase();
    if (typeof document !== 'undefined') {
      document.addEventListener('supabase:ready', () => { this.loadRemoteSnapshot(); }, { once: true });
      document.addEventListener('ccms:data-ready', () => { this.renderPropertySelector(); });
      this.renderPropertySelector();
    }
  }

  initDatabase() {
    let demoSession = false;
    try { demoSession = JSON.parse(localStorage.getItem('ccms_session') || '{}').is_demo === true; } catch (_) {}
    const demoHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1', 'cc-mario-sanchez-comercial.vercel.app'].includes(location.hostname);
    const useMarioAuthorizedDataset = globalThis.CCMS_DEMO_DATASET === 'mario-authorized'
      && Boolean(globalThis.CCMS_AUTHORIZED_DEMO_FIXTURES?.full_dataset);
    const demoFixture = useMarioAuthorizedDataset
      ? globalThis.CCMS_AUTHORIZED_DEMO_FIXTURES
      : globalThis.CCMS_SYNTHETIC_FIXTURES;
    if (demoSession && demoHost && demoFixture?.full_dataset) {
      this.demoDataset = useMarioAuthorizedDataset ? 'mario-authorized' : 'synthetic';
      this._demoSeed = this._normalizeDemoSeed(demoFixture.full_dataset, {
        dataset: this.demoDataset,
        organization: demoFixture.organization || null
      });
      this.remoteSnapshot = JSON.parse(JSON.stringify(this._demoSeed));
      this.persistenceState = 'demo_fixture';
      this.demoStorageKey = `ccms-demo:${this.demoDataset}:${demoSession.organization_id || 'sandbox'}`;
      this._hydrateDemoStorage();
      return;
    }
    // Legacy storage is not an authoritative source, even if it contains 39 units.
    this.remoteSnapshot = { units: [], tenants: [], invoices: [], payments: [], receipts: [], condo_expenses: [], activos_fijos: [], consumibles: [], kardex_movimientos: [], agreements: [], receiving_accounts: [], authorized_import_staging: [], settings: {} };
    this.persistenceState = 'not_loaded';
    if (typeof window !== 'undefined' && window.supabaseClient?.from) this.loadRemoteSnapshot();
    return;

  }

  _normalizeDemoSeed(raw, context = {}) {
    const seed = JSON.parse(JSON.stringify(raw || {}));
    const isMarioAuthorizedDemo = context.dataset === 'mario-authorized';
    if (isMarioAuthorizedDemo) {
      const organization = context.organization || { id: 'd0000000-0000-0000-0000-000000000099', name: 'Centro Comercial Mario Sánchez — Demo autorizada' };
      seed.organizations = [{ id: organization.id, name: organization.name, status: 'activa' }];
      seed.properties = [{ id: 'p-demo-mario-sanchez', organization_id: organization.id, name: 'Centro Comercial Mario Sánchez', city: 'Puerto La Cruz', status: 'activo' }];
    } else {
      seed.organizations = [
        { id: 'd0000000-0000-0000-0000-000000000001', name: 'Organización Demo Centro Oriente', status: 'activa' },
        { id: 'd0000000-0000-0000-0000-000000000002', name: 'Organización Demo Patrimonial', status: 'activa' }
      ];
      seed.properties = [
        { id: 'p-syn-a1', organization_id: seed.organizations[0].id, name: 'Centro Demo Puerto', city: 'Puerto La Cruz', status: 'activo' },
        { id: 'p-syn-a2', organization_id: seed.organizations[0].id, name: 'Galería Demo Lechería', city: 'Lechería', status: 'activo' },
        { id: 'p-syn-b1', organization_id: seed.organizations[1].id, name: 'Patrimonio Demo Barcelona', city: 'Barcelona', status: 'activo' }
      ];
    }
    (seed.units || []).forEach((unit, index) => {
      const property = isMarioAuthorizedDemo ? seed.properties[0] : (index < 16 ? seed.properties[0] : index < 28 ? seed.properties[1] : seed.properties[2]);
      unit.property_id = property.id;
      unit.organization_id = property.organization_id;
    });
    const unitByCode = new Map((seed.units || []).map(u => [u.code, u]));
    (seed.tenants || []).forEach(t => { const u = unitByCode.get(t.unit_code); if (u) { t.unit_id = u.id; t.property_id = u.property_id; t.organization_id = u.organization_id; } });
    const tenantById = new Map((seed.tenants || []).map(t => [t.id, t]));
    (seed.contracts || []).forEach(c => { const t = tenantById.get(c.tenant_id); if (t) { c.unit_id = t.unit_id; c.property_id = t.property_id; c.organization_id = t.organization_id; } });
    (seed.invoices || []).forEach(i => { const t = tenantById.get(i.tenant_id); if (t) { i.unit_id = t.unit_id; i.property_id = t.property_id; i.organization_id = t.organization_id; } });
    (seed.payments || []).forEach(p => { const i = (seed.invoices || []).find(inv => inv.id === p.invoice_id); if (i) { p.organization_id = i.organization_id; p.property_id = i.property_id; } });
    seed.service_tickets = Array.isArray(seed.service_tickets) ? seed.service_tickets : [];
    seed.reservations = Array.isArray(seed.reservations) ? seed.reservations : [];
    seed.listings = Array.isArray(seed.listings) ? seed.listings : [];
    seed.leads = Array.isArray(seed.leads) ? seed.leads : [];
    seed.closed_periods = Array.isArray(seed.closed_periods) ? seed.closed_periods : [];
    seed.command_receipts = Array.isArray(seed.command_receipts) ? seed.command_receipts : [];
    seed.audit_trail = Array.isArray(seed.audit_trail) ? seed.audit_trail : [];
    seed.integration_events = Array.isArray(seed.integration_events) ? seed.integration_events : [];
    seed.attachments = Array.isArray(seed.attachments) ? seed.attachments : [];
    seed.organization_memberships = [
      { id: 'm-syn-founder', organization_id: seed.organizations[0].id, user_id: 'u-demo-founder', role: 'founder', status: 'active' },
      { id: 'm-syn-director', organization_id: seed.organizations[0].id, user_id: 'u-demo-director', role: 'director', status: 'active' },
      { id: 'm-syn-finance', organization_id: seed.organizations[0].id, user_id: 'u-demo-finance', role: 'finance', status: 'active' }
    ];
    seed.seedVersion = seed.seedVersion || (isMarioAuthorizedDemo ? 'mario-authorized-demo-2026-09-15-v1' : 'demo-2026-09-15-v1');
    seed.businessDate = seed.businessDate || (isMarioAuthorizedDemo ? '2026-08-15' : '2026-03-15');
    seed.demoDataLabel = isMarioAuthorizedDemo ? 'Datos de Mario Sánchez autorizados solo para demostración' : 'Escenario sintético';
    return seed;
  }

  _hydrateDemoStorage() {
    if (typeof indexedDB === 'undefined') {
      this.demoStorageReady = true;
      this._markDemoStorageError('INDEXEDDB_UNAVAILABLE');
      return;
    }
    try {
      const request = indexedDB.open('ccms-demo-sandbox', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction('snapshots', 'readonly').objectStore('snapshots').get(this.demoStorageKey);
        read.onsuccess = () => {
          if (read.result && this.persistenceState === 'demo_fixture') this.remoteSnapshot = read.result;
          this.demoStorageReady = true;
          if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('ccms:data-ready', { detail: { source: 'demo_storage' } }));
          db.close();
        };
        read.onerror = () => { this.demoStorageReady = true; this._markDemoStorageError('DEMO_STORAGE_READ_FAILED'); db.close(); };
      };
      request.onerror = () => { this.demoStorageReady = true; this._markDemoStorageError('DEMO_STORAGE_OPEN_FAILED'); };
    } catch (_) { this.demoStorageReady = true; this._markDemoStorageError('DEMO_STORAGE_UNAVAILABLE'); }
  }

  _markDemoStorageError(code) {
    if (this.demoStorageError) return;
    this.demoStorageError = String(code || 'DEMO_STORAGE_FAILED');
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('ccms:data-error', { detail: { error: new Error(this.demoStorageError) } }));
  }

  _persistDemoSnapshot(snapshot) {
    if (typeof indexedDB === 'undefined' || !this.demoStorageKey) {
      this._markDemoStorageError(typeof indexedDB === 'undefined' ? 'INDEXEDDB_UNAVAILABLE' : 'DEMO_STORAGE_KEY_MISSING');
      return false;
    }
    try {
      const request = indexedDB.open('ccms-demo-sandbox', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put(JSON.parse(JSON.stringify(snapshot)), this.demoStorageKey);
        tx.oncomplete = () => db.close();
        tx.onerror = () => { this._markDemoStorageError('DEMO_STORAGE_WRITE_FAILED'); db.close(); };
        tx.onabort = () => { this._markDemoStorageError('DEMO_STORAGE_QUOTA_OR_ABORT'); db.close(); };
      };
    } catch (_) { this._markDemoStorageError('DEMO_STORAGE_WRITE_FAILED'); return false; }
    return true;
  }

  async loadRemoteSnapshot() {
    if (this.persistenceState === 'demo_fixture' || typeof window === 'undefined' || !window.supabaseClient?.from) return;
    const tables = ['organizations', 'properties', 'units', 'tenants', 'contracts', 'invoices', 'payments', 'payment_receipts', 'receipts', 'condo_expenses', 'expenses', 'activos_fijos', 'consumibles', 'kardex_movimientos', 'special_agreements', 'receiving_accounts', 'authorized_import_staging', 'audit_logs', 'app_settings'];
    const snapshot = { units: [], tenants: [], contracts: [], invoices: [], payments: [], receipts: [], condo_expenses: [], activos_fijos: [], consumibles: [], kardex_movimientos: [], agreements: [], receiving_accounts: [], authorized_import_staging: [], settings: {}, audit_trail: [] };
    let successfulReads = 0;
    for (const table of tables) {
      try {
        const { data, error } = await window.supabaseClient.from(table).select('*');
        if (error) continue; // tablas opcionales no deben ocultar las disponibles
        successfulReads += 1;
        if (table === 'payment_receipts' || table === 'receipts') snapshot.receipts.push(...(data || []));
        else if (table === 'special_agreements') snapshot.agreements = data || [];
        else if (table === 'app_settings') {
          for (const row of (data || [])) {
            if (row.key) snapshot.settings[row.key] = row.value ?? row;
          }
        } else if (table === 'audit_logs') snapshot.audit_trail = data || [];
        else if (Object.prototype.hasOwnProperty.call(snapshot, table)) snapshot[table] = data || [];
      } catch (_) { /* fail closed: conservar estado vacío y trazable */ }
    }
    if (successfulReads > 0) {
      this.remoteSnapshot = snapshot;
      this.persistenceState = 'remote';
      document.dispatchEvent(new CustomEvent('ccms:data-ready'));
    } else {
      this.persistenceState = 'remote_error';
      document.dispatchEvent(new CustomEvent('ccms:data-error'));
    }
  }

  resetDemoData() {
    if (this.persistenceState !== 'demo_fixture') throw new Error('REMOTE_PERSISTENCE_REQUIRED: Reinicie la sesión en el entorno demo aislado.');
    this.remoteSnapshot = JSON.parse(JSON.stringify(this._demoSeed || {}));
    this._persistDemoSnapshot(this.remoteSnapshot);
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('ccms:data-ready', { detail: { source: 'demo_reset' } }));
    return this.getData();
  }

  seedInitialData() {
    if (this.persistenceState !== 'demo_fixture') throw new Error('REMOTE_PERSISTENCE_REQUIRED: No se permite sembrar datos locales.');
    return JSON.parse(JSON.stringify(this._demoSeed || {}));
  }

  getData() {
    return JSON.parse(JSON.stringify(this.remoteSnapshot));

  }

  // Source records awaiting authorized review; never treated as operational data.
  getAuthorizedImportStaging() {
    const rows = this.getData().authorized_import_staging;
    return Array.isArray(rows) ? rows : [];
  }

  async reviewAuthorizedImport(stagingId, decision, note = '') {
    if (this.persistenceState === 'demo_fixture') throw new Error('REMOTE_PERSISTENCE_REQUIRED: La revisión de origen solo está disponible en producción.');
    if (!['approved', 'rejected'].includes(decision)) throw new Error('INVALID_REVIEW_DECISION');
    const session = (typeof window !== 'undefined' && window.AuthGuard?.currentUser)
      ? window.AuthGuard.currentUser() : null;
    const token = session?.access_token || (await window.supabaseClient?.auth?.getSession?.())?.data?.session?.access_token;
    if (!token) throw new Error('REMOTE_SESSION_REQUIRED');
    const response = await fetch('/api/import-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ staging_id: stagingId, decision, note })
    });
    if (!response.ok) throw new Error(`IMPORT_REVIEW_${response.status}`);
    await this.loadRemoteSnapshot();
    return response.json();
  }

  async updateAuthorizedImport(stagingId, patch) {
    if (this.persistenceState === 'demo_fixture') throw new Error('REMOTE_PERSISTENCE_REQUIRED: La edición de origen solo está disponible en producción.');
    const session = (typeof window !== 'undefined' && window.AuthGuard?.currentUser)
      ? window.AuthGuard.currentUser() : null;
    const token = session?.access_token || (await window.supabaseClient?.auth?.getSession?.())?.data?.session?.access_token;
    if (!token) throw new Error('REMOTE_SESSION_REQUIRED');
    const response = await fetch('/api/import-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ operation: 'update', staging_id: stagingId, patch })
    });
    if (!response.ok) throw new Error(`IMPORT_UPDATE_${response.status}`);
    await this.loadRemoteSnapshot();
    return response.json();
  }

  async materializeAuthorizedImport(stagingId) {
    if (this.persistenceState === 'demo_fixture') throw new Error('REMOTE_PERSISTENCE_REQUIRED: La materialización solo está disponible en producción.');
    const session = (typeof window !== 'undefined' && window.AuthGuard?.currentUser)
      ? window.AuthGuard.currentUser() : null;
    const token = session?.access_token || (await window.supabaseClient?.auth?.getSession?.())?.data?.session?.access_token;
    if (!token) throw new Error('REMOTE_SESSION_REQUIRED');
    const response = await fetch('/api/import-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ operation: 'materialize', staging_id: stagingId })
    });
    if (!response.ok) throw new Error(`IMPORT_MATERIALIZE_${response.status}`);
    await this.loadRemoteSnapshot();
    return response.json();
  }

  async updateOrganizationFeatures(organizationId, expectedUpdatedAt, patch, reason) {
    if (this.persistenceState === 'demo_fixture') throw new Error('REMOTE_PERSISTENCE_REQUIRED: La configuración institucional solo está disponible en producción.');
    const session = (typeof window !== 'undefined' && window.AuthGuard?.currentUser) ? window.AuthGuard.currentUser() : null;
    const token = session?.access_token || (await window.supabaseClient?.auth?.getSession?.())?.data?.session?.access_token;
    if (!token) throw new Error('REMOTE_SESSION_REQUIRED');
    const response = await fetch('/api/organization-features', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ organization_id: organizationId, expected_updated_at: expectedUpdatedAt, patch, reason })
    });
    if (!response.ok) throw new Error(`FEATURE_UPDATE_${response.status}`);
    await this.loadRemoteSnapshot();
    return response.json();
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
    if (this.persistenceState === 'demo_fixture') {
      // La demo es un sandbox local por organización: permite probar altas,
      // ediciones y cobranza sin tocar Supabase ni publicar datos reales.
      this.remoteSnapshot = JSON.parse(JSON.stringify(data || {}));
      this._persistDemoSnapshot(this.remoteSnapshot);
      this._syncDemoPublicListings(this.remoteSnapshot);
      if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('ccms:data-ready'));
      return true;
    }
    if (this.persistenceState !== 'remote') {
      throw new Error('REMOTE_PERSISTENCE_REQUIRED: La operación requiere una sesión remota válida.');
    }
    const previous = this.remoteSnapshot || {};
    this.remoteSnapshot = JSON.parse(JSON.stringify(data || {}));
    const nextSnapshot = JSON.parse(JSON.stringify(this.remoteSnapshot));
    // Actualización optimista para que la interfaz siga siendo reactiva; el
    // servidor vuelve a validar sesión, pertenencia, organización y RLS.
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('ccms:data-ready'));
    this._persistQueue = this._persistQueue
      .then(() => this._persistRemoteDiff(previous, nextSnapshot))
      .catch(error => console.error('[CCMS] Cola de persistencia detenida', error));
    return true;
  }

  _syncDemoPublicListings(snapshot) {
    if (typeof localStorage === 'undefined') return;
    try {
      const listings = (snapshot?.listings || []).filter(listing => listing && listing.unit_id).map(listing => ({
        id: listing.id,
        unit_id: listing.unit_id,
        organization_id: listing.organization_id || null,
        status: listing.status || 'publicado',
        title: listing.title || null,
        updated_at: listing.updated_at || new Date().toISOString()
      }));
      localStorage.setItem('ccms-demo-public-listings', JSON.stringify(listings));
    } catch (_) {
      // La proyección pública es auxiliar; el snapshot principal conserva el dato.
    }
  }

  async _persistRemoteDiff(previous, next) {
    const entities = {
      units: 'units', tenants: 'tenants', contracts: 'contracts', invoices: 'invoices',
      condo_expenses: 'condo_expenses', properties: 'properties', service_tickets: 'service_tickets',
      organization_memberships: 'organization_memberships', organization_settings: 'organization_settings',
      activos_fijos: 'activos_fijos', consumibles: 'consumibles', kardex_movimientos: 'kardex_movimientos',
      agreements: 'special_agreements', receiving_accounts: 'receiving_accounts'
    };
    const session = (typeof window !== 'undefined' && window.AuthGuard?.currentUser)
      ? window.AuthGuard.currentUser() : null;
    const token = session?.access_token || (await window.supabaseClient?.auth?.getSession?.())?.data?.session?.access_token;
    const organizationId = session?.organization_id || session?.org_id || next.organization_id;
    if (!token || !organizationId) throw new Error('REMOTE_SESSION_REQUIRED');
    const send = async (payload) => {
      const response = await fetch('/api/records', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organization_id: organizationId, ...payload })
      });
      if (!response.ok) throw new Error(`REMOTE_WRITE_${response.status}`);
      return response.json();
    };
    try {
      for (const [key, entity] of Object.entries(entities)) {
        const beforeRows = Array.isArray(previous[key]) ? previous[key] : [];
        const nextRows = Array.isArray(next[key]) ? next[key] : [];
        const before = new Map(beforeRows.filter(row => row?.id).map(row => [row.id, row]));
        const after = new Map(nextRows.filter(row => row?.id).map(row => [row.id, row]));
        for (const [id, row] of after) {
          if (JSON.stringify(before.get(id)) !== JSON.stringify(row)) {
            const scopedRow = { ...row };
            if (['activos_fijos', 'consumibles', 'kardex_movimientos', 'agreements', 'receiving_accounts'].includes(key) && !scopedRow.property_id) {
              scopedRow.property_id = this.getActivePropertyId() || null;
            }
            await send({ entity, operation: 'upsert', row: scopedRow });
          }
        }
        for (const id of before.keys()) {
          if (!after.has(id)) await send({ entity, operation: 'delete', id });
        }
      }
    } catch (error) {
      this.persistenceState = 'remote_error';
      // Nunca dejamos que el optimismo de UI se convierta en un dato falso:
      // solo revertimos si nadie ha escrito un snapshot posterior mientras
      // este lote estaba en vuelo.
      if (JSON.stringify(this.remoteSnapshot) === JSON.stringify(next)) {
        this.remoteSnapshot = JSON.parse(JSON.stringify(previous));
      }
      if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('ccms:data-error', { detail: { error } }));
      console.error('[CCMS] No se pudo persistir el cambio remoto', error);
    }
  }

  // --- MÉTODOS CRUD ---

  getProperties() {
    const data = this.getData();
    return Array.isArray(data.properties) ? data.properties : [];
  }

  _requireDemo() {
    if (this.persistenceState !== 'demo_fixture') throw new Error('REMOTE_PERSISTENCE_REQUIRED: Esta operación demo no está disponible en producción.');
  }

  createOrganization(input = {}) {
    this._requireDemo();
    if (!String(input.name || '').trim()) throw new Error('ORGANIZATION_NAME_REQUIRED');
    const data = this.getData();
    const organization = { id: this._newId('org'), name: String(input.name).trim(), status: 'activa', created_at: new Date().toISOString() };
    data.organizations = Array.isArray(data.organizations) ? data.organizations : [];
    data.organizations.push(organization);
    this.saveData(data);
    return organization;
  }

  createProperty(input = {}) {
    this._requireDemo();
    if (!input.organization_id || !String(input.name || '').trim()) throw new Error('PROPERTY_REQUIRED_FIELDS');
    const data = this.getData();
    if (!(data.organizations || []).some(o => o.id === input.organization_id)) throw new Error('ORGANIZATION_NOT_FOUND');
    const property = { id: this._newId('property'), organization_id: input.organization_id, name: String(input.name).trim(), city: input.city || '', status: 'activo', created_at: new Date().toISOString() };
    data.properties = Array.isArray(data.properties) ? data.properties : [];
    data.properties.push(property);
    this.saveData(data);
    return property;
  }

  createUnit(input = {}) {
    this._requireDemo();
    if (!input.property_id || !String(input.code || '').trim() || Number(input.area_m2) <= 0) throw new Error('UNIT_REQUIRED_FIELDS');
    const data = this.getData();
    const property = (data.properties || []).find(p => p.id === input.property_id);
    if (!property) throw new Error('PROPERTY_NOT_FOUND');
    if ((data.units || []).some(u => u.property_id === input.property_id && u.code === input.code)) throw new Error('DUPLICATE_UNIT');
    const unit = { id: this._newId('unit'), code: String(input.code).trim(), name: input.name || `Unidad ${input.code}`, area_m2: Number(input.area_m2), status: 'disponible', property_id: property.id, organization_id: property.organization_id, tenant_id: null, created_at: new Date().toISOString() };
    data.units = Array.isArray(data.units) ? data.units : [];
    data.units.push(unit);
    this.saveData(data);
    return unit;
  }

  createContract(input = {}) {
    this._requireDemo();
    if (!input.tenant_id || !input.unit_id || Number(input.rent_usd) <= 0 || !input.start_date || !input.end_date) throw new Error('CONTRACT_REQUIRED_FIELDS');
    const data = this.getData();
    const unit = (data.units || []).find(u => u.id === input.unit_id);
    const tenant = (data.tenants || []).find(t => t.id === input.tenant_id);
    if (!unit || !tenant) throw new Error('CONTRACT_RELATION_REQUIRED');
    if (new Date(input.end_date) <= new Date(input.start_date)) throw new Error('CONTRACT_DATE_RANGE_INVALID');
    const contract = { id: this._newId('contract'), contract_number: input.contract_number || `CTR-DEMO-${Date.now()}`, tenant_id: tenant.id, unit_id: unit.id, unit_code: unit.code, property_id: unit.property_id, organization_id: unit.organization_id, start_date: input.start_date, end_date: input.end_date, rent_usd: Number(input.rent_usd), status: 'borrador', created_at: new Date().toISOString() };
    data.contracts = Array.isArray(data.contracts) ? data.contracts : [];
    data.contracts.push(contract);
    this.saveData(data);
    return contract;
  }

  issueInvoiceOnce(contractId, periodKey, input = {}) {
    this._requireDemo();
    const data = this.getData();
    if (data.closed_periods?.includes(periodKey)) throw new Error('PERIOD_CLOSED');
    const existing = (data.invoices || []).find(i => i.contract_id === contractId && i.period_key === periodKey);
    if (existing) return { invoice: existing, created: false };
    const contract = (data.contracts || []).find(c => c.id === contractId);
    if (!contract || contract.status === 'borrador') throw new Error('CONTRACT_NOT_APPROVED');
    const [year, month] = String(periodKey).split('-').map(Number);
    const invoice = { id: this._newId('invoice'), invoice_number: `FAC-DEMO-${periodKey}-${String(contract.unit_code || contract.id).replace(/[^A-Za-z0-9]/g, '')}`, contract_id: contract.id, tenant_id: contract.tenant_id, unit_id: contract.unit_id, unit_code: contract.unit_code, property_id: contract.property_id, organization_id: contract.organization_id, period_key: periodKey, period_year: year, period_month: month, rent_usd: Number(input.rent_usd ?? contract.rent_usd), condo_usd: Number(input.condo_usd || 0), total_usd: Number(input.total_usd ?? (Number(input.rent_usd ?? contract.rent_usd) + Number(input.condo_usd || 0))), status: 'pendiente', issue_date: input.issue_date || new Date().toISOString().slice(0, 10), due_date: input.due_date || `${periodKey}-10` };
    data.invoices.push(invoice);
    this.saveData(data);
    return { invoice, created: true };
  }

  approveContract(contractId, actor = 'administracion-demo') {
    this._requireDemo();
    const data = this.getData();
    const contract = (data.contracts || []).find(c => c.id === contractId);
    if (!contract) throw new Error('CONTRACT_NOT_FOUND');
    if (!contract.tenant_id || !contract.unit_id || Number(contract.rent_usd) <= 0 || !contract.start_date || !contract.end_date) throw new Error('CONTRACT_INCOMPLETE');
    contract.status = 'vigente'; contract.approved_by = actor; contract.approved_at = new Date().toISOString();
    this.saveData(data);
    this.logAuditAction({ action: 'APPROVE', entity: 'CONTRACT', entity_id: contract.id, entity_name: contract.contract_number, details: 'Contrato demo aprobado' });
    return contract;
  }

  reversePayment(paymentId, reason, actor = 'administracion-demo') {
    this._requireDemo();
    if (!String(reason || '').trim()) throw new Error('REVERSAL_REASON_REQUIRED');
    const data = this.getData();
    const payment = (data.payments || []).find(p => p.id === paymentId);
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    if (payment.status !== 'verificado') throw new Error('PAYMENT_NOT_VERIFIED');
    payment.status = 'reversado'; payment.reversed_at = new Date().toISOString(); payment.reversed_by = actor; payment.reversal_reason = String(reason).trim();
    (data.receipts || []).filter(r => r.invoice_id === payment.invoice_id && (!r.payment_id || r.payment_id === payment.id)).forEach(r => { r.status = 'reversado'; r.reversed_at = payment.reversed_at; });
    const invoice = (data.invoices || []).find(i => i.id === payment.invoice_id);
    if (invoice) {
      const verified = (data.payments || []).filter(p => p.invoice_id === invoice.id && p.status === 'verificado').reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      invoice.paid_amount_usd = verified;
      invoice.status = verified >= Number(invoice.total_usd || 0) ? 'pagado' : (verified > 0 ? 'parcial' : 'pendiente');
      if (invoice.status !== 'pagado') invoice.paid_at = null;
    }
    this.saveData(data);
    this.logAuditAction({ action: 'REVERSE', entity: 'PAYMENT', entity_id: payment.id, entity_name: payment.reference_number, details: String(reason).trim() });
    return payment;
  }

  closePeriod(periodKey, actor = 'administracion-demo') {
    this._requireDemo();
    const data = this.getData();
    data.closed_periods = Array.isArray(data.closed_periods) ? data.closed_periods : [];
    if (!data.closed_periods.includes(periodKey)) data.closed_periods.push(periodKey);
    this.saveData(data);
    this.logAuditAction({ action: 'CLOSE_PERIOD', entity: 'PERIOD', entity_id: periodKey, entity_name: periodKey, details: `Período cerrado por ${actor}` });
    return periodKey;
  }

  importTenantsCsv(csvText, options = {}) {
    this._requireDemo();
    const text = String(csvText || '').replace(/^\uFEFF/, '').trim();
    if (!text) return { rows: [], errors: [{ row: 0, code: 'EMPTY_FILE', message: 'El archivo está vacío.' }], committed: false };
    const lines = text.split(/\r?\n/).filter(Boolean);
    const parseCsvLine = line => { const out = []; let value = '', quoted = false; for (let i = 0; i < line.length; i += 1) { const ch = line[i]; if (ch === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; } else if (ch === '"') quoted = !quoted; else if (ch === ',' && !quoted) { out.push(value.trim()); value = ''; } else value += ch; } out.push(value.trim()); return out; };
    const headers = parseCsvLine(lines.shift()).map(h => h.toLowerCase());
    const required = ['rif', 'business_name', 'unit_code', 'rent_usd', 'start_date', 'end_date'];
    const missing = required.filter(h => !headers.includes(h));
    if (missing.length) return { rows: [], errors: [{ row: 1, code: 'MISSING_COLUMNS', message: `Faltan columnas: ${missing.join(', ')}` }], committed: false };
    const data = this.getData(); const seen = new Set((data.tenants || []).map(t => t.rif));
    const rows = []; const errors = [];
    lines.forEach((line, index) => {
      const cols = parseCsvLine(line); const row = Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
      const moneyText = String(row.rent_usd || '').replace(/\s/g, '');
      const lastComma = moneyText.lastIndexOf(','), lastDot = moneyText.lastIndexOf('.');
      let normalizedMoney = moneyText;
      if (lastComma >= 0 && lastDot >= 0) {
        const decimalAt = Math.max(lastComma, lastDot); normalizedMoney = moneyText.slice(0, decimalAt).replace(/[.,]/g, '') + '.' + moneyText.slice(decimalAt + 1);
      } else if (lastComma >= 0) {
        normalizedMoney = (moneyText.length - lastComma - 1 === 3) ? moneyText.replace(/,/g, '') : moneyText.replace(',', '.');
      } else if (lastDot >= 0 && moneyText.length - lastDot - 1 === 3) {
        normalizedMoney = moneyText.replace(/\./g, '');
      }
      row.rent_usd = Number(normalizedMoney);
      if (!row.rif || !row.business_name || !row.unit_code || !Number.isFinite(row.rent_usd) || row.rent_usd <= 0) errors.push({ row: index + 2, code: 'INVALID_FIELDS', message: 'RIF, nombre, local y canon son obligatorios.' });
      if (seen.has(row.rif)) errors.push({ row: index + 2, code: 'DUPLICATE_RIF', message: `El RIF ${row.rif} ya existe.` });
      seen.add(row.rif); rows.push(row);
    });
    const result = { rows, errors, committed: false };
    if (options.commit === true && errors.length === 0) {
      rows.forEach(row => {
        const unit = (data.units || []).find(u => u.code === row.unit_code && u.status === 'disponible');
        if (!unit) { errors.push({ row: rows.indexOf(row) + 2, code: 'UNIT_UNAVAILABLE', message: `El local ${row.unit_code} no está disponible.` }); return; }
        const tenant = { id: this._newId('tenant'), rif: row.rif, business_name: row.business_name, unit_code: row.unit_code, unit_id: unit.id, property_id: unit.property_id, organization_id: unit.organization_id, status: 'activo' };
        data.tenants.push(tenant); unit.status = 'arrendado'; unit.tenant_id = tenant.id;
        data.contracts.push({ id: this._newId('contract'), contract_number: `CTR-IMP-${Date.now()}`, tenant_id: tenant.id, unit_id: unit.id, unit_code: unit.code, property_id: unit.property_id, organization_id: unit.organization_id, rent_usd: row.rent_usd, start_date: row.start_date, end_date: row.end_date, status: 'borrador' });
      });
      if (errors.length === 0) { this.saveData(data); result.committed = true; }
    }
    result.errors = errors; return result;
  }

  reconcileBankCsv(csvText) {
    this._requireDemo(); const lines = String(csvText || '').trim().split(/\r?\n/).filter(Boolean); if (lines.length < 2) throw new Error('BANK_FILE_EMPTY');
    const parse = line => { const out = []; let v = '', q = false; for (let i = 0; i < line.length; i += 1) { const ch = line[i]; if (ch === '"' && line[i + 1] === '"' && q) { v += '"'; i += 1; } else if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(v.trim()); v = ''; } else v += ch; } out.push(v.trim()); return out; }; const headers = parse(lines.shift()).map(h => h.toLowerCase());
    const refAt = headers.indexOf('reference'), amountAt = headers.indexOf('amount'), dateAt = headers.indexOf('date'); if (refAt < 0 || amountAt < 0) throw new Error('BANK_COLUMNS_REQUIRED');
    const seen = new Set(), transactions = [], duplicates = [], candidates = [];
    lines.forEach((line, index) => { const c = parse(line), reference = c[refAt], rawAmount = String(c[amountAt] || '').replace(/\s/g, ''), lastComma = rawAmount.lastIndexOf(','), lastDot = rawAmount.lastIndexOf('.'); let normalized = rawAmount; if (lastComma >= 0 && lastDot >= 0) { const at = Math.max(lastComma, lastDot); normalized = rawAmount.slice(0, at).replace(/[.,]/g, '') + '.' + rawAmount.slice(at + 1); } else if (lastComma >= 0) normalized = rawAmount.length - lastComma - 1 === 3 ? rawAmount.replace(/,/g, '') : rawAmount.replace(',', '.'); else if (lastDot >= 0 && rawAmount.length - lastDot - 1 === 3) normalized = rawAmount.replace(/\./g, ''); const amount = Number(normalized); const tx = { row: index + 2, reference, amount, date: c[dateAt] || null }; if (seen.has(reference)) duplicates.push(tx); else { seen.add(reference); transactions.push(tx); const matches = (this.getData().payments || []).filter(p => p.reference_number === reference || Math.abs(Number(p.amount_paid || 0) - amount) < 0.01); if (matches.length) candidates.push({ transaction: tx, payment_ids: matches.map(p => p.id), requires_confirmation: matches.length !== 1 }); } });
    return { transactions, duplicates, candidates, approved: false, note: 'Ninguna coincidencia se aprueba automáticamente en demo.' };
  }

  createExpense(input = {}) {
    this._requireDemo(); if (!String(input.concept || '').trim() || Number(input.amount_usd) <= 0) throw new Error('EXPENSE_REQUIRED_FIELDS');
    const data = this.getData(); const expense = { id: this._newId('expense'), concept: String(input.concept).trim(), amount_usd: Number(input.amount_usd), beneficiary: input.beneficiary || '', period_key: input.period_key || '2026-04', status: 'pactado', created_at: new Date().toISOString() }; data.condo_expenses = Array.isArray(data.condo_expenses) ? data.condo_expenses : []; data.condo_expenses.push(expense); this.saveData(data); return expense;
  }

  approveExpense(expenseId, actor = 'director-demo') {
    this._requireDemo(); const data = this.getData(); const expense = data.condo_expenses.find(e => e.id === expenseId); if (!expense) throw new Error('EXPENSE_NOT_FOUND'); if (expense.status !== 'pactado') throw new Error('EXPENSE_STATE_INVALID'); expense.status = 'aprobado'; expense.approved_by = actor; expense.approved_at = new Date().toISOString(); this.saveData(data); return expense;
  }

  payExpense(expenseId, actor = 'finance-demo') {
    this._requireDemo(); const data = this.getData(); const expense = data.condo_expenses.find(e => e.id === expenseId); if (!expense) throw new Error('EXPENSE_NOT_FOUND'); if (expense.status !== 'aprobado') throw new Error('EXPENSE_NOT_APPROVED'); expense.status = 'pagado'; expense.paid_by = actor; expense.paid_at = new Date().toISOString(); this.saveData(data); return expense;
  }

  getExpenseSummary(periodKey = null) {
    this._requireDemo(); const rows = (this.getData().condo_expenses || []).filter(e => !periodKey || e.period_key === periodKey); return { pactado_usd: rows.filter(e => e.status === 'pactado').reduce((s, e) => s + Number(e.amount_usd || 0), 0), aprobado_usd: rows.filter(e => e.status === 'aprobado').reduce((s, e) => s + Number(e.amount_usd || 0), 0), pagado_usd: rows.filter(e => e.status === 'pagado').reduce((s, e) => s + Number(e.amount_usd || 0), 0), pending_usd: rows.filter(e => e.status !== 'pagado').reduce((s, e) => s + Number(e.amount_usd || 0), 0) };
  }

  createTicket(input = {}) {
    this._requireDemo();
    if (!input.tenant_id || !String(input.title || '').trim()) throw new Error('TICKET_REQUIRED_FIELDS');
    const data = this.getData(); const tenant = (data.tenants || []).find(t => t.id === input.tenant_id);
    if (!tenant) throw new Error('TENANT_NOT_FOUND');
    const ticket = { id: this._newId('ticket'), ticket_number: `TK-DEMO-${Date.now()}`, tenant_id: tenant.id, property_id: tenant.property_id, organization_id: tenant.organization_id, title: String(input.title).trim(), description: input.description || '', status: 'abierto', created_at: new Date().toISOString() };
    data.service_tickets.push(ticket); this.saveData(data); return ticket;
  }

  updateTicket(ticketId, patch = {}) {
    this._requireDemo(); const data = this.getData(); const ticket = (data.service_tickets || []).find(t => t.id === ticketId); if (!ticket) throw new Error('TICKET_NOT_FOUND');
    Object.assign(ticket, patch, { updated_at: new Date().toISOString() }); this.saveData(data); return ticket;
  }

  adjustStock(itemCode, quantity, type = 'ENTRADA') {
    this._requireDemo(); const data = this.getData(); const item = (data.consumibles || []).find(i => i.code === itemCode); if (!item) throw new Error('STOCK_ITEM_NOT_FOUND');
    const qty = Number(quantity); if (!Number.isFinite(qty) || qty <= 0) throw new Error('STOCK_QUANTITY_INVALID');
    const next = Number(item.stock_current || 0) + (type === 'SALIDA' ? -qty : qty); if (next < 0) throw new Error('STOCK_NEGATIVE_FORBIDDEN');
    item.stock_current = next; this.saveData(data); return item;
  }

  createReservation(input = {}) {
    this._requireDemo(); const data = this.getData();
    if (!input.property_id || !input.start_at || !input.end_at) throw new Error('RESERVATION_REQUIRED_FIELDS');
    const start = new Date(input.start_at), end = new Date(input.end_at); if (!(end > start)) throw new Error('RESERVATION_DATE_RANGE_INVALID');
    const conflict = data.reservations.some(r => r.property_id === input.property_id && r.status !== 'cancelada' && new Date(r.start_at) < end && start < new Date(r.end_at));
    if (conflict) throw new Error('RESERVATION_CONFLICT');
    const reservation = { id: this._newId('reservation'), ...input, status: 'confirmada', created_at: new Date().toISOString() }; data.reservations.push(reservation); this.saveData(data); return reservation;
  }

  publishListing(unitId, input = {}) {
    this._requireDemo(); const data = this.getData(); const unit = (data.units || []).find(u => u.id === unitId); if (!unit) throw new Error('UNIT_NOT_FOUND');
    const listing = { id: this._newId('listing'), unit_id: unit.id, property_id: unit.property_id, organization_id: unit.organization_id, title: input.title || unit.name || unit.code, description: input.description || '', status: 'publicado', published_at: new Date().toISOString() };
    data.listings = data.listings.filter(l => l.unit_id !== unitId); data.listings.push(listing); this.saveData(data); return listing;
  }

  retireListing(listingId) {
    this._requireDemo(); const data = this.getData(); const listing = data.listings.find(l => l.id === listingId); if (!listing) throw new Error('LISTING_NOT_FOUND'); listing.status = 'retirado'; listing.retired_at = new Date().toISOString(); this.saveData(data); return listing;
  }

  captureLead(listingId, input = {}) {
    this._requireDemo(); if (input.consent !== true) throw new Error('LEAD_CONSENT_REQUIRED'); const data = this.getData(); const listing = data.listings.find(l => l.id === listingId && l.status === 'publicado'); if (!listing) throw new Error('LISTING_NOT_PUBLIC');
    const lead = { id: this._newId('lead'), listing_id: listing.id, organization_id: listing.organization_id, property_id: listing.property_id, name: input.name || '', email: input.email || '', phone: input.phone || '', consent: true, created_at: new Date().toISOString() }; data.leads.push(lead); this.saveData(data); return lead;
  }

  calibrateFloorPlan(input = {}) {
    const width = Number(input.width), height = Number(input.height), scale = Number(input.scale_m_per_unit);
    if (width <= 0 || height <= 0) throw new Error('FLOOR_PLAN_DIMENSIONS_INVALID');
    return { width, height, scale: scale > 0 ? scale : null, area_m2: scale > 0 ? width * height * scale * scale : null, scaled: scale > 0 };
  }

  exportFloorPlanSvg(input = {}) {
    const plan = this.calibrateFloorPlan(input); const w = plan.width * 20, h = plan.height * 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Plano demo"><rect width="${w}" height="${h}" fill="#eef4f8" stroke="#1b4d72" stroke-width="2"/><text x="10" y="20" font-family="sans-serif">${plan.area_m2 ? `${plan.area_m2.toFixed(2)} m²` : 'Sin escala'}</text></svg>`;
  }

  simulateIntegration(kind, payload = {}) {
    this._requireDemo(); const data = this.getData(); const event = { id: this._newId('integration'), kind, status: 'simulado', payload: JSON.parse(JSON.stringify(payload)), created_at: new Date().toISOString() }; data.integration_events.push(event); this.saveData(data); return event;
  }

  exportDemoBackup() {
    this._requireDemo(); const snapshot = this.getData();
    const attachment_manifest = [...(snapshot.attachments || []), ...(snapshot.payments || []).filter(p => p.receipt_proof).map(p => ({ ref: `payment:${p.id}`, hash: String(p.receipt_proof) }))];
    return { schema: 'ccms-demo-backup', version: 1, seedVersion: snapshot.seedVersion, exported_at: new Date().toISOString(), attachment_manifest, dataset: snapshot };
  }

  restoreDemoBackup(backup) {
    this._requireDemo(); if (!backup || backup.schema !== 'ccms-demo-backup' || backup.version !== 1 || !backup.dataset || !Array.isArray(backup.dataset.units)) throw new Error('BACKUP_INVALID_OR_UNKNOWN_VERSION');
    const current = this.getData(); const next = JSON.parse(JSON.stringify(backup.dataset)); if (!Array.isArray(next.payments) || !Array.isArray(next.invoices)) throw new Error('BACKUP_DATASET_INCOMPLETE');
    if (Array.isArray(backup.attachment_manifest)) {
      const actual = [...(next.attachments || []), ...(next.payments || []).filter(p => p.receipt_proof).map(p => ({ ref: `payment:${p.id}`, hash: String(p.receipt_proof) }))];
      const expected = JSON.stringify(backup.attachment_manifest); if (JSON.stringify(actual) !== expected) throw new Error('BACKUP_ATTACHMENT_HASH_MISMATCH');
    }
    this.remoteSnapshot = next; this._persistDemoSnapshot(next); if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('ccms:data-ready', { detail: { source: 'demo_restore' } }));
    return { units: next.units.length, tenants: (next.tenants || []).length, invoices: next.invoices.length, payments: next.payments.length, restored: true, previous_units: current.units?.length || 0 };
  }

  exportDemoCsv(entity = 'invoices') {
    this._requireDemo(); const rows = Array.isArray(this.getData()[entity]) ? this.getData()[entity] : []; if (!rows.length) return '';
    const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]; const safe = value => { const text = String(value ?? '').replace(/"/g, '""'); return /^[=+\-@]/.test(text) ? `'${text}` : text; };
    return [headers.join(','), ...rows.map(r => headers.map(h => `"${safe(r[h])}"`).join(','))].join('\n');
  }

  exportDemoReportHtml(entity = 'invoices') {
    this._requireDemo(); const rows = Array.isArray(this.getData()[entity]) ? this.getData()[entity] : [];
    const preferred = entity === 'invoices' ? ['invoice_number', 'unit_code', 'period_key', 'total_usd', 'status', 'issue_date', 'due_date'] : entity === 'payments' ? ['reference_number', 'invoice_id', 'amount_paid', 'currency', 'status', 'payment_date'] : null;
    const headers = rows.length ? (preferred ? preferred.filter(h => rows.some(r => Object.prototype.hasOwnProperty.call(r, h))) : [...new Set(rows.flatMap(r => Object.keys(r)))]) : ['resultado'];
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const datasetLabel = this.demoDataset === 'mario-authorized' ? 'Datos autorizados de Mario Sánchez para demostración' : 'Escenario sintético';
    return `<!doctype html><html lang="es"><meta charset="utf-8"><title>CCMS · Reporte demo</title><style>@page{size:A4;margin:14mm}body{font:10px Arial;color:#182b3b}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #b8c5d0;padding:5px;text-align:left;vertical-align:top}th{background:#e8f0f6}tr{break-inside:avoid}@media print{.no-print{display:none}}</style><h1>CCMS · Reporte ${esc(entity)}</h1><p>${esc(datasetLabel)} · ${new Date().toISOString().slice(0, 10)} · Moneda según registro</p><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></html>`;
  }

  getFinancialSummary(invoiceId = null) {
    this._requireDemo(); const data = this.getData();
    const invoices = invoiceId ? (data.invoices || []).filter(i => i.id === invoiceId) : (data.invoices || []);
    const invoiceIds = new Set(invoices.map(i => i.id));
    const verified = (data.payments || []).filter(p => p.status === 'verificado' && invoiceIds.has(p.invoice_id)).reduce((s, p) => s + Number(p.amount_paid || 0), 0);
    const billed = invoices.reduce((s, i) => s + Number(i.total_usd || 0), 0);
    return { billed_usd: billed, collected_usd: verified, balance_usd: Math.max(0, billed - verified), advance_usd: Math.max(0, verified - billed), invoice_count: invoices.length };
  }

  getScopedData(organizationId) {
    this._requireDemo(); const data = this.getData(); if (!organizationId) return data;
    const properties = (data.properties || []).filter(p => p.organization_id === organizationId); const propertyIds = new Set(properties.map(p => p.id));
    const units = (data.units || []).filter(u => propertyIds.has(u.property_id)); const unitIds = new Set(units.map(u => u.id));
    const tenants = (data.tenants || []).filter(t => t.organization_id === organizationId || propertyIds.has(t.property_id)); const tenantIds = new Set(tenants.map(t => t.id));
    const contracts = (data.contracts || []).filter(c => c.organization_id === organizationId || propertyIds.has(c.property_id)); const contractIds = new Set(contracts.map(c => c.id));
    const invoices = (data.invoices || []).filter(i => i.organization_id === organizationId || propertyIds.has(i.property_id) || tenantIds.has(i.tenant_id) || contractIds.has(i.contract_id)); const invoiceIds = new Set(invoices.map(i => i.id));
    return { ...data, organizations: (data.organizations || []).filter(o => o.id === organizationId), properties, units, tenants, contracts, invoices, payments: (data.payments || []).filter(p => p.organization_id === organizationId || invoiceIds.has(p.invoice_id)), receipts: (data.receipts || []).filter(r => invoiceIds.has(r.invoice_id)), service_tickets: (data.service_tickets || []).filter(t => t.organization_id === organizationId || tenantIds.has(t.tenant_id)), listings: (data.listings || []).filter(l => l.organization_id === organizationId), leads: (data.leads || []).filter(l => l.organization_id === organizationId) };
  }

  suspendDemoMember(memberId) {
    this._requireDemo(); const data = this.getData(); const member = (data.organization_memberships || []).find(m => m.id === memberId); if (!member) throw new Error('MEMBER_NOT_FOUND'); member.status = 'suspended'; this.saveData(data); return member;
  }

  canDemoAction(memberId, action = 'read') {
    this._requireDemo(); const member = (this.getData().organization_memberships || []).find(m => m.id === memberId); if (!member || member.status !== 'active') return false; if (action === 'write' && ['auditor', 'viewer'].includes(member.role)) return false; return true;
  }

  removeDemoMember(memberId) {
    this._requireDemo(); const data = this.getData(); const target = (data.organization_memberships || []).find(m => m.id === memberId); if (!target) throw new Error('MEMBER_NOT_FOUND'); if (target.role === 'director' && data.organization_memberships.filter(m => m.organization_id === target.organization_id && m.role === 'director' && m.status === 'active').length <= 1) throw new Error('LAST_DIRECTOR_PROTECTED'); data.organization_memberships = data.organization_memberships.filter(m => m.id !== memberId); this.saveData(data); return true;
  }

  getActivePropertyId() {
    try { return localStorage.getItem('ccms_active_property') || ''; } catch (_) { return ''; }
  }

  setActiveProperty(propertyId) {
    const valid = !propertyId || this.getProperties().some(p => p.id === propertyId);
    if (!valid) throw new Error('PROPERTY_NOT_AUTHORIZED');
    try {
      if (propertyId) localStorage.setItem('ccms_active_property', propertyId);
      else localStorage.removeItem('ccms_active_property');
    } catch (_) {}
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('ccms:property-changed', { detail: { propertyId: propertyId || null } }));
  }

  _filterByActiveProperty(rows) {
    const propertyId = this.getActivePropertyId();
    if (!propertyId || !Array.isArray(rows)) return rows;
    const data = this.getData();
    const units = Array.isArray(data.units) ? data.units : [];
    const unitCodes = new Set(units.filter(u => u.property_id === propertyId).map(u => u.code));
    const unitIds = new Set(units.filter(u => u.property_id === propertyId).map(u => u.id));
    const tenants = Array.isArray(data.tenants) ? data.tenants : [];
    const tenantIds = new Set(tenants.filter(t => t.property_id === propertyId || unitCodes.has(t.unit_code) || unitIds.has(t.unit_id)).map(t => t.id));
    return rows.filter(row => row.property_id === propertyId || unitCodes.has(row.unit_code) || unitIds.has(row.unit_id) || tenantIds.has(row.tenant_id));
  }

  renderPropertySelector() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('property-selector');
    if (!select) return;
    const properties = this.getProperties();
    const previous = this.getActivePropertyId();
    select.innerHTML = `<option value="">Todos los inmuebles</option>` + properties.map(p => `<option value="${String(p.id).replace(/"/g, '&quot;')}">${String(p.name || 'Inmueble').replace(/</g, '&lt;')}</option>`).join('');
    select.value = properties.some(p => p.id === previous) ? previous : '';
    select.hidden = properties.length < 2;
  }

  getUnits() {
    const data = this.getData();
    return (data && Array.isArray(data.units)) ? this._filterByActiveProperty(data.units) : [];
  }

  getTenants() {
    const data = this.getData();
    return (data && Array.isArray(data.tenants)) ? this._filterByActiveProperty(data.tenants) : [];
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
      return this._filterByActiveProperty(data.contracts.filter(c => c.tenant_id === effectiveTenantId));
    }
    return this._filterByActiveProperty(data.contracts);
  }

  getInvoices(tenantId = null) {
    const data = this.getData();
    if (!data || !Array.isArray(data.invoices)) return [];
    const effectiveTenantId = this._sessionTenantId(tenantId);
    if (effectiveTenantId) {
      return this._filterByActiveProperty(data.invoices.filter(i => i.tenant_id === effectiveTenantId));
    }
    return this._filterByActiveProperty(data.invoices);
  }

  getPayments(tenantId = null) {
    const data = this.getData();
    if (!data || !Array.isArray(data.payments)) return [];
    const effectiveTenantId = this._sessionTenantId(tenantId);
    if (effectiveTenantId) {
      const tenantInvoiceIds = new Set(this.getInvoices(effectiveTenantId).map(i => i.id));
      return this._filterByActiveProperty(data.payments.filter(p => p.tenant_id === effectiveTenantId || tenantInvoiceIds.has(p.invoice_id)));
    }
    return this._filterByActiveProperty(data.payments);
  }

  _newId(prefix = 'ccms') {
    if (this.persistenceState !== 'demo_fixture' && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  addTenant(tenantData, contractData) {
    const data = this.getData();
    const newTenantId = this._newId('tenant');
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
    const newContractId = this._newId('contract');
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
      id: this._newId('invoice'),
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
      updated = { id: this._newId('contract'), tenant_id: tenantId, ...updateData };
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
    if (!data || !Array.isArray(data.agreements)) return [];
    const effectiveTenantId = this._sessionTenantId(tenantId);
    if (effectiveTenantId) {
      return data.agreements.filter(a => a.tenant_id === effectiveTenantId);
    }
    return data.agreements;
  }

  saveSpecialAgreement(agreement) {
    const data = this.getData();
    if (!data.agreements) data.agreements = [];
    let saved = null;
    if (agreement.id) {
      const idx = data.agreements.findIndex(a => a.id === agreement.id);
      if (idx >= 0) {
        const oldState = { ...data.agreements[idx] };
        data.agreements[idx] = { ...data.agreements[idx], ...agreement };
        saved = data.agreements[idx];
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
      data.agreements.push(newAgr);
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
    if (!data.agreements) return [];
    const target = data.agreements.find(a => a.id === id);
    data.agreements = data.agreements.filter(a => a.id !== id);
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
    return data.agreements;
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
      : (this.persistenceState === 'demo_fixture' ? this.getDefaultCondoExpenses() : []);
  }

  getExpenses() {
    return this.getCondoExpenses();
  }

  saveCondoExpense(expenseData) {
    const data = this.getData();
    if (!data.condo_expenses) {
      data.condo_expenses = this.persistenceState === 'demo_fixture' ? this.getDefaultCondoExpenses() : [];
    }

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
        id: this._newId('expense'),
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
      id: this._newId('payment'),
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
    if (this.persistenceState === 'demo_fixture' && data.closed_periods?.includes(invoice.period_key || `${invoice.period_year}-${String(invoice.period_month).padStart(2, '0')}`)) throw new Error('PERIOD_CLOSED');
    const duplicateReference = (data.payments || []).find(p => p.reference_number && paymentData.reference_number && p.reference_number === paymentData.reference_number && p.status !== 'rechazado');
    if (duplicateReference) throw new Error('DUPLICATE_PAYMENT_REFERENCE');

    const payment = {
      id: this._newId('payment'),
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
      submitted_by: paymentData.submitted_by || null,
      tenant_id: invoice.tenant_id,
      unit_id: invoice.unit_id || null,
      property_id: invoice.property_id || null,
      organization_id: invoice.organization_id || null
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

  async approvePayment(invoiceId, verifier, options = {}) {
    if (this.persistenceState === 'demo_fixture') {
      const data = this.getData();
      data.command_receipts = Array.isArray(data.command_receipts) ? data.command_receipts : [];
      const commandId = options.commandId || null;
      if (commandId) {
        const prior = data.command_receipts.find(c => c.command_id === commandId);
        if (prior) {
          if (prior.invoice_id !== invoiceId || prior.amount !== Number(options.amount ?? prior.amount)) throw new Error('COMMAND_ID_CONFLICT');
          return prior.result;
        }
      }
      const invoice = (data.invoices || []).find(i => i.id === invoiceId);
      const payment = (data.payments || []).find(p => p.invoice_id === invoiceId && p.status === 'pendiente');
      if (!invoice) throw new Error('Factura no encontrada.');
      if (!payment) throw new Error('No hay un pago pendiente de revisión.');
      const submittedBy = payment.submitted_by || payment.origin_name || '';
      if (verifier && submittedBy && String(verifier) === String(submittedBy)) throw new Error('SEGREGATION_OF_DUTIES: El verificador debe ser distinto al registrador.');
      payment.status = 'verificado';
      payment.verified_by = verifier || 'Administración demo';
      payment.verified_at = new Date().toISOString();
      payment.version = Number(payment.version || 1) + 1;
      const verifiedTotal = (data.payments || []).filter(p => p.invoice_id === invoice.id && p.status === 'verificado').reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      invoice.paid_amount_usd = verifiedTotal;
      invoice.status = verifiedTotal >= Number(invoice.total_usd || 0) ? 'pagado' : (verifiedTotal > 0 ? 'parcial' : 'pendiente');
      invoice.paid_at = invoice.status === 'pagado' ? payment.payment_date : null;
      const tenant = (data.tenants || []).find(t => t.id === invoice.tenant_id);
      if (tenant) tenant.status = 'activo';
      const receipt = {
        id: this._newId('receipt'), receipt_number: `REC-DEMO-${String(invoice.invoice_number || invoice.id).replace(/[^A-Za-z0-9-]/g, '')}`,
        payment_id: payment.id, invoice_id: invoice.id, invoice_number: invoice.invoice_number, tenant_id: invoice.tenant_id,
        tenant_name: tenant?.business_name || 'Inquilino demo', unit_code: invoice.unit_code || null,
        total_usd: Number(payment.amount_paid || invoice.total_usd || 0), payment_method: payment.payment_method,
        reference_number: payment.reference_number, amount_paid: payment.amount_paid, currency: payment.currency || 'USD',
        approved_by: payment.verified_by, approved_at: payment.verified_at, status: 'emitido'
      };
      data.receipts = Array.isArray(data.receipts) ? data.receipts : [];
      data.receipts = data.receipts.filter(r => r.invoice_id !== invoice.id);
      data.receipts.push(receipt);
      this.saveData(data);
      const result = { payment, invoice, receipt };
      if (commandId) {
        data.command_receipts.push({ command_id: commandId, invoice_id: invoiceId, amount: Number(options.amount ?? payment.amount_paid), result });
        this.saveData(data);
      }
      return result;
    }
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
    return Array.isArray(data.agreements) ? data.agreements : [];
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
    return newAgr;
  }

  deleteAgreement(agreementId) {
    const data = this.getData();
    if (!data.agreements) return [];
    data.agreements = data.agreements.filter(a => a.id !== agreementId);
    this.saveData(data);
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
      : (this.persistenceState === 'demo_fixture' ? this.getDefaultReceivingAccounts() : []);

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
  const fallbackData = (typeof globalThis !== 'undefined' && globalThis.CCMS_SYNTHETIC_FIXTURES?.full_dataset) || { units: [], tenants: [], contracts: [], invoices: [], payments: [], receipts: [], condo_expenses: [], activos_fijos: [], consumibles: [], kardex_movimientos: [], agreements: [], receiving_accounts: [], settings: {}, audit_trail: [] };
  window.dbService = {
    persistenceState: 'error',
    getData: () => JSON.parse(JSON.stringify(fallbackData)),
    getUnits: () => fallbackData.units || [], getTenants: () => fallbackData.tenants || [], getContracts: () => fallbackData.contracts || [], getInvoices: () => fallbackData.invoices || [], getPayments: () => fallbackData.payments || [], getReceipts: () => fallbackData.receipts || [], getCondoExpenses: () => fallbackData.condo_expenses || [], getActivosFijos: () => fallbackData.activos_fijos || [], getConsumibles: () => fallbackData.consumibles || [], getKardexMovimientos: () => fallbackData.kardex_movimientos || [], getReceivingAccounts: () => fallbackData.receiving_accounts || [], getSettings: () => fallbackData.settings || {}, getAuditLogs: () => fallbackData.audit_trail || [],
    saveData: () => { throw new Error('REMOTE_PERSISTENCE_REQUIRED'); }
  };
  var dbService = window.dbService;
}
