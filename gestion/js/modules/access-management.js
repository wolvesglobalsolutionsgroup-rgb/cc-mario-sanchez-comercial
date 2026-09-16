/**
 * Matriz visible de permisos CCMS.
 * Las claves internas se conservan para compatibilidad; toda la experiencia
 * para las personas usuarias se expresa en español.
 */
(function (global) {
  'use strict';

  const ACCIONES = {
    read: { nombre: 'Consultar', descripcion: 'Ver información y descargar reportes autorizados.', color: 'var(--emerald)' },
    write: { nombre: 'Gestionar', descripcion: 'Crear, registrar, editar o aprobar según el módulo.', color: 'var(--amber)' },
    delete: { nombre: 'Eliminar', descripcion: 'Anular o retirar registros cuando la política lo permita.', color: 'var(--rose)' }
  };

  const DEFAULT_PERMISSIONS = {
    org_director: { name: 'Director General o Junta Directiva', shortName: 'Dirección', description: 'Gobierna la organización, aprueba reglas y consulta toda la operación.', color: 'var(--amber)', modules: {
      invoices: { label: 'Facturación y cuotas', read: true, write: true, delete: true }, payments: { label: 'Cobranzas y verificación', read: true, write: true, delete: true }, tenants: { label: 'Locales, contratos e inquilinos', read: true, write: true, delete: true }, accounting: { label: 'Contabilidad, gastos y bancos', read: true, write: true, delete: true }, succession: { label: 'Frutos y copropiedad', read: true, write: true, delete: true }, settings: { label: 'Configuración, equipo y seguridad', read: true, write: true, delete: true }
    } },
    org_admin: { name: 'Administrador de la organización', shortName: 'Administración', description: 'Gestiona el día a día, contratos, cuotas y cobros sin cambiar el gobierno institucional.', color: 'var(--amber)', modules: {
      invoices: { label: 'Facturación y cuotas', read: true, write: true, delete: false }, payments: { label: 'Cobranzas y verificación', read: true, write: true, delete: false }, tenants: { label: 'Locales, contratos e inquilinos', read: true, write: true, delete: false }, accounting: { label: 'Contabilidad, gastos y bancos', read: true, write: false, delete: false }, succession: { label: 'Frutos y copropiedad', read: true, write: false, delete: false }, settings: { label: 'Configuración, equipo y seguridad', read: true, write: false, delete: false }
    } },
    accountant: { name: 'Contador y finanzas', shortName: 'Finanzas', description: 'Concilia pagos, registra gastos, prepara libros y controla la facturación.', color: 'var(--emerald)', modules: {
      invoices: { label: 'Facturación y cuotas', read: true, write: true, delete: false }, payments: { label: 'Cobranzas y verificación', read: true, write: true, delete: false }, tenants: { label: 'Locales, contratos e inquilinos', read: true, write: false, delete: false }, accounting: { label: 'Contabilidad, gastos y bancos', read: true, write: true, delete: false }, succession: { label: 'Frutos y copropiedad', read: true, write: true, delete: false }, settings: { label: 'Configuración, equipo y seguridad', read: false, write: false, delete: false }
    } },
    fiscal_auditor: { name: 'Auditor fiscal y tributario', shortName: 'Auditoría', description: 'Revisa información y exporta soportes sin alterar operaciones ni saldos.', color: 'var(--cyan)', modules: {
      invoices: { label: 'Facturación y cuotas', read: true, write: false, delete: false }, payments: { label: 'Cobranzas y verificación', read: true, write: false, delete: false }, tenants: { label: 'Locales, contratos e inquilinos', read: true, write: false, delete: false }, accounting: { label: 'Contabilidad, gastos y bancos', read: true, write: false, delete: false }, succession: { label: 'Frutos y copropiedad', read: false, write: false, delete: false }, settings: { label: 'Configuración, equipo y seguridad', read: false, write: false, delete: false }
    } },
    operations_manager: { name: 'Gerente de operaciones y mantenimiento', shortName: 'Operaciones', description: 'Atiende locales, activos, inventario, planos y tickets de mantenimiento.', color: '#f97316', modules: {
      invoices: { label: 'Facturación y cuotas', read: false, write: false, delete: false }, payments: { label: 'Cobranzas y verificación', read: false, write: false, delete: false }, tenants: { label: 'Locales, contratos e inquilinos', read: true, write: false, delete: false }, accounting: { label: 'Contabilidad, gastos y bancos', read: false, write: false, delete: false }, succession: { label: 'Frutos y copropiedad', read: false, write: false, delete: false }, settings: { label: 'Configuración, equipo y seguridad', read: false, write: false, delete: false }
    } },
    heir_viewer: { name: 'Copropietario heredero', shortName: 'Copropietario', description: 'Consulta los frutos patrimoniales e informes que le corresponden.', color: 'var(--purple)', modules: {
      invoices: { label: 'Facturación y cuotas', read: true, write: false, delete: false }, payments: { label: 'Cobranzas y verificación', read: false, write: false, delete: false }, tenants: { label: 'Locales, contratos e inquilinos', read: false, write: false, delete: false }, accounting: { label: 'Contabilidad, gastos y bancos', read: true, write: false, delete: false }, succession: { label: 'Frutos y copropiedad', read: true, write: false, delete: false }, settings: { label: 'Configuración, equipo y seguridad', read: false, write: false, delete: false }
    } },
    tenant_user: { name: 'Inquilino comercial', shortName: 'Inquilino', description: 'Usa un portal privado para su local: cuotas, pagos, recibos y solicitudes propias.', color: 'var(--emerald)', modules: {
      invoices: { label: 'Mis facturas y cuotas', read: true, write: false, delete: false }, payments: { label: 'Mis pagos y comprobantes', read: true, write: true, delete: false }, tenants: { label: 'Mi local y mi contrato', read: true, write: false, delete: false }, accounting: { label: 'Contabilidad, gastos y bancos', read: false, write: false, delete: false }, succession: { label: 'Frutos y copropiedad', read: false, write: false, delete: false }, settings: { label: 'Configuración, equipo y seguridad', read: false, write: false, delete: false }
    } }
  };

  let runtimeMatrix = null;
  const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);

  const AccessManagement = {
    getMatrix() { if (!runtimeMatrix) runtimeMatrix = cloneDefaults(); return runtimeMatrix; },
    saveMatrix(matrix) { runtimeMatrix = matrix; },
    async loadRemote(organizationId) {
      const session = global.AuthGuard && typeof global.AuthGuard.getSession === 'function' ? await global.AuthGuard.getSession() : null;
      if (!session?.access_token || !organizationId) return { ok: false, reason: 'missing_session' };
      const response = await fetch(`/api/capabilities?organization_id=${encodeURIComponent(organizationId)}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(`CAPABILITIES_${response.status}`);
      const payload = await response.json();
      this.activeMembership = { id: payload.membership_id, version: payload.version };
      this.render();
      return { ok: true, ...payload };
    },
    async persistOverride(membershipId, moduleKey, action, granted, expectedVersion, reason, scope, resourceIds, expiresAt) {
      const session = global.AuthGuard && typeof global.AuthGuard.getSession === 'function' ? await global.AuthGuard.getSession() : null;
      if (!session?.access_token) throw new Error('AUTH_REQUIRED');
      const response = await fetch('/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ type: 'permissions.set', expected_version: expectedVersion, data: { membership_id: membershipId, module: moduleKey, action, granted, reason, scope, resource_ids: resourceIds, expires_at: expiresAt } }) });
      if (response.status === 409) throw new Error('CONFLICT');
      if (!response.ok) throw new Error(`PERMISSION_${response.status}`);
      return response.json();
    },
    togglePermission(roleKey, moduleKey, action) {
      if ((roleKey === 'fiscal_auditor' || roleKey === 'heir_viewer') && action !== 'read') {
        global.SecuritySuite?.toast?.('Este rol es de solo consulta y no puede recibir permisos de gestión ni eliminación.', 'warning', 'Rol protegido');
        return false;
      }
      const currentRole = global.AuthGuard && typeof global.AuthGuard.getUserRole === 'function' ? global.AuthGuard.getUserRole() : (global.currentRole || null);
      if (currentRole !== 'org_director' && currentRole !== 'superadmin') {
        global.SecuritySuite?.toast?.('Solo Dirección puede modificar una plantilla de permisos.', 'error', 'Acceso restringido');
        return false;
      }
      const matrix = this.getMatrix();
      if (!matrix[roleKey]?.modules[moduleKey] || !ACCIONES[action]) return false;
      matrix[roleKey].modules[moduleKey][action] = !matrix[roleKey].modules[moduleKey][action];
      this.saveMatrix(matrix);
      this.render();
      global.SecuritySuite?.toast?.(`Plantilla actualizada: ${ACCIONES[action].nombre} en ${matrix[roleKey].shortName}. La demo no modifica cuentas reales.`, 'info', 'Matriz de demostración');
      return true;
    },
    render() {
      const container = document.getElementById('access-management-matrix-container');
      if (!container) return;
      const matrix = this.getMatrix();
      const isDemo = Boolean(global.CCMS_DEMO_DATASET || global.AuthGuard?.currentUser?.()?.is_demo);
      container.innerHTML = `<section aria-labelledby="matriz-permisos-titulo" style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:12px;padding:20px;margin-bottom:24px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px;"><div style="max-width:720px;"><p style="margin:0 0 5px;color:var(--cyan);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Gobierno de accesos</p><h4 id="matriz-permisos-titulo" style="margin:0;color:var(--txt-primary);font:800 18px var(--font-heading);"><i class="fa-solid fa-shield-halved" style="color:var(--amber)"></i> Matriz de permisos por rol</h4><p style="margin:8px 0 0;color:var(--txt-secondary);font-size:12px;line-height:1.6;">Define qué puede hacer cada perfil. <strong>Consultar</strong> permite ver; <strong>Gestionar</strong> permite crear o modificar; <strong>Eliminar</strong> permite anular o retirar cuando la política lo autorice.</p></div><button type="button" class="btn-currency-toggle" onclick="window.AccessManagement.resetDefaults()" style="font-size:11px;padding:7px 12px;gap:6px;"><i class="fa-solid fa-arrow-rotate-left"></i> Restablecer plantilla</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:16px;">${Object.values(ACCIONES).map(action => `<div style="border:1px solid var(--border-subtle);border-radius:8px;padding:10px;background:rgba(255,255,255,.02)"><strong style="display:block;color:${action.color};font-size:12px">${action.nombre}</strong><span style="font-size:10.5px;color:var(--txt-secondary);line-height:1.45">${action.descripcion}</span></div>`).join('')}</div>${isDemo ? '<div role="note" style="padding:10px 12px;border-left:3px solid var(--amber);background:rgba(245,158,11,.08);color:var(--txt-secondary);font-size:11.5px;line-height:1.55;margin-bottom:16px"><i class="fa-solid fa-flask" style="color:var(--amber)"></i> Estás en demostración: los cambios visuales se mantienen solo mientras dure la sesión y no alteran usuarios ni datos reales.</div>' : '<div role="note" style="padding:10px 12px;border-left:3px solid var(--cyan);background:var(--cyan-glow);color:var(--txt-secondary);font-size:11.5px;line-height:1.55;margin-bottom:16px"><i class="fa-solid fa-circle-info" style="color:var(--cyan)"></i> La matriz muestra la plantilla organizacional. Las excepciones individuales se administran desde el servicio de permisos.</div>'}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:14px;">${Object.entries(matrix).map(([roleKey, role]) => { const count = Object.values(role.modules).reduce((total, mod) => total + Object.keys(ACCIONES).filter(key => mod[key]).length, 0); return `<article style="background:rgba(15,23,42,.36);border:1px solid var(--border-subtle);border-top:3px solid ${role.color};border-radius:10px;padding:14px;"><div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--border-subtle);padding-bottom:10px;margin-bottom:10px;"><div><strong style="display:block;color:${role.color};font-size:13px">${escapeHtml(role.name)}</strong><span style="display:block;margin-top:3px;color:var(--txt-secondary);font-size:10.5px;line-height:1.45">${escapeHtml(role.description)}</span></div><span aria-label="${count} permisos habilitados" style="align-self:flex-start;white-space:nowrap;background:rgba(255,255,255,.06);color:var(--txt-secondary);border-radius:99px;padding:4px 7px;font-size:10px">${count} acciones</span></div><div style="display:flex;flex-direction:column;gap:7px;">${Object.entries(role.modules).map(([moduleKey, mod]) => `<div style="padding:8px;border-radius:7px;background:rgba(255,255,255,.025)"><div style="color:var(--txt-primary);font-size:11px;font-weight:700;margin-bottom:7px">${escapeHtml(mod.label)}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${Object.entries(ACCIONES).map(([actionKey, action]) => `<label title="${action.descripcion}" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:10px;color:${mod[actionKey] ? action.color : 'var(--txt-muted)'}"><input aria-label="${action.nombre}: ${mod.label}, ${role.name}" type="checkbox" ${mod[actionKey] ? 'checked' : ''} onchange="window.AccessManagement.togglePermission('${roleKey}','${moduleKey}','${actionKey}')" style="accent-color:${action.color}"> ${action.nombre}</label>`).join('')}</div></div>`).join('')}</div></article>`; }).join('')}</div></section>`;
    },
    hasPermission(roleKey, moduleKey, action = 'read') {
      if ((roleKey === 'fiscal_auditor' || roleKey === 'heir_viewer') && action !== 'read') return false;
      return Boolean(this.getMatrix()[roleKey]?.modules[moduleKey]?.[action]);
    },
    resetDefaults() { runtimeMatrix = cloneDefaults(); this.render(); global.SecuritySuite?.toast?.('La plantilla de permisos volvió a sus valores iniciales.', 'info', 'Permisos restablecidos'); }
  };
  global.AccessManagement = AccessManagement;
  if (typeof module !== 'undefined' && module.exports) module.exports = AccessManagement;
})(typeof window !== 'undefined' ? window : globalThis);
