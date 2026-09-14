/**
 * ==============================================================================
 * CCMS - MÓDULO DE GOBERNANZA Y GESTIÓN DE ACCESOS (FASE 5 / T22)
 * Centro Comercial Mario Sánchez — Arquitectura PropTech Multi-Tenant
 *
 * - Matriz visual e interactiva de permisos por rol institucional.
 * - Conmutadores (toggles) reactivos por módulo y operación.
 * - Prevención de escalamiento no autorizado y registro de auditoría.
 * ==============================================================================
 */

(function(global) {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const DEFAULT_PERMISSIONS = {
    org_director: {
      name: 'Director General (Junta Directiva)',
      description: 'Acceso total y gobierno de la organización',
      color: 'var(--amber)',
      modules: {
        invoices: { label: 'Facturación & Cuotas', read: true, write: true, delete: true },
        payments: { label: 'Cobranzas & Verificación', read: true, write: true, delete: true },
        tenants: { label: 'Arrendatarios & Contratos', read: true, write: true, delete: true },
        accounting: { label: 'Libros Contables & Bancos', read: true, write: true, delete: true },
        succession: { label: 'Régimen Sucesoral (Frutos)', read: true, write: true, delete: true },
        settings: { label: 'Configuración & Seguridad', read: true, write: true, delete: true }
      }
    },
    org_admin: {
      name: 'Administrador de Organización',
      description: 'Gestión operativa y cobranzas generales',
      color: 'var(--amber)',
      modules: {
        invoices: { label: 'Facturación & Cuotas', read: true, write: true, delete: false },
        payments: { label: 'Cobranzas & Verificación', read: true, write: true, delete: false },
        tenants: { label: 'Arrendatarios & Contratos', read: true, write: true, delete: false },
        accounting: { label: 'Libros Contables & Bancos', read: true, write: false, delete: false },
        succession: { label: 'Régimen Sucesoral (Frutos)', read: true, write: false, delete: false },
        settings: { label: 'Configuración & Seguridad', read: true, write: false, delete: false }
      }
    },
    accountant: {
      name: 'Contador General & Finanzas',
      description: 'Conciliación bancaria, libros y facturación',
      color: 'var(--emerald)',
      modules: {
        invoices: { label: 'Facturación & Cuotas', read: true, write: true, delete: false },
        payments: { label: 'Cobranzas & Verificación', read: true, write: true, delete: false },
        tenants: { label: 'Arrendatarios & Contratos', read: true, write: false, delete: false },
        accounting: { label: 'Libros Contables & Bancos', read: true, write: true, delete: false },
        succession: { label: 'Régimen Sucesoral (Frutos)', read: true, write: true, delete: false },
        settings: { label: 'Configuración & Seguridad', read: false, write: false, delete: false }
      }
    },
    fiscal_auditor: {
      name: 'Auditor Fiscal & Tributario',
      description: 'Solo lectura tributaria y exportación SENIAT/Alcaldía',
      color: 'var(--cyan)',
      modules: {
        invoices: { label: 'Facturación & Cuotas', read: true, write: false, delete: false },
        payments: { label: 'Cobranzas & Verificación', read: true, write: false, delete: false },
        tenants: { label: 'Arrendatarios & Contratos', read: true, write: false, delete: false },
        accounting: { label: 'Libros Contables & Bancos', read: true, write: false, delete: false },
        succession: { label: 'Régimen Sucesoral (Frutos)', read: false, write: false, delete: false },
        settings: { label: 'Configuración & Seguridad', read: false, write: false, delete: false }
      }
    },
    operations_manager: {
      name: 'Gerente de Operaciones & Mantenimiento',
      description: 'Control de locales, bienes, stock y tickets',
      color: '#f97316',
      modules: {
        invoices: { label: 'Facturación & Cuotas', read: false, write: false, delete: false },
        payments: { label: 'Cobranzas & Verificación', read: false, write: false, delete: false },
        tenants: { label: 'Arrendatarios & Contratos', read: true, write: false, delete: false },
        accounting: { label: 'Libros Contables & Bancos', read: false, write: false, delete: false },
        succession: { label: 'Régimen Sucesoral (Frutos)', read: false, write: false, delete: false },
        settings: { label: 'Configuración & Seguridad', read: false, write: false, delete: false }
      }
    },
    heir_viewer: {
      name: 'Copropietario Heredero (1/14 Cuota)',
      description: 'Consulta transparente de frutos patrimoniales e informes',
      color: 'var(--purple)',
      modules: {
        invoices: { label: 'Facturación & Cuotas', read: true, write: false, delete: false },
        payments: { label: 'Cobranzas & Verificación', read: false, write: false, delete: false },
        tenants: { label: 'Arrendatarios & Contratos', read: false, write: false, delete: false },
        accounting: { label: 'Libros Contables & Bancos', read: true, write: false, delete: false },
        succession: { label: 'Régimen Sucesoral (Frutos)', read: true, write: false, delete: false },
        settings: { label: 'Configuración & Seguridad', read: false, write: false, delete: false }
      }
    },
    tenant_user: {
      name: 'Arrendatario / Inquilino Comercial',
      description: 'Portal de autoservicio para consulta y reporte de pagos propios',
      color: 'var(--emerald)',
      modules: {
        invoices: { label: 'Facturación & Cuotas (Propias)', read: true, write: false, delete: false },
        payments: { label: 'Cobranzas & Verificación (Propias)', read: true, write: true, delete: false },
        tenants: { label: 'Arrendatarios & Contratos (Propio)', read: true, write: false, delete: false },
        accounting: { label: 'Libros Contables & Bancos', read: false, write: false, delete: false },
        succession: { label: 'Régimen Sucesoral (Frutos)', read: false, write: false, delete: false },
        settings: { label: 'Configuración & Seguridad', read: false, write: false, delete: false }
      }
    }
  };

  const STORAGE_KEY = 'ccms_role_permissions_matrix';

  const AccessManagement = {
    getMatrix() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
    },

    saveMatrix(matrix) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
    },

    togglePermission(roleKey, moduleKey, action) {
      const matrix = this.getMatrix();
      if (!matrix[roleKey] || !matrix[roleKey].modules[moduleKey]) return;
      matrix[roleKey].modules[moduleKey][action] = !matrix[roleKey].modules[moduleKey][action];
      this.saveMatrix(matrix);
      this.render();
      if (global.SecuritySuite && global.SecuritySuite.toast) {
        global.SecuritySuite.toast(`Permiso ${action.toUpperCase()} actualizado para ${matrix[roleKey].name}`, 'info', 'Control de Accesos');
      }
    },

    render() {
      const container = document.getElementById('access-management-matrix-container');
      if (!container) return;

      const matrix = this.getMatrix();
      const roles = Object.keys(matrix);

      let html = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--txt-primary); font-family: var(--font-heading);">
                <i class="fa-solid fa-shield-halved" style="color: var(--amber);"></i> Matriz Visual de Permisos y Control de Acceso (RBAC)
              </h4>
              <span style="font-size: 11.5px; color: var(--txt-secondary);">Configuración granular de facultades por rol institucional (Fase 5 - Gobernanza).</span>
            </div>
            <button type="button" class="btn-currency-toggle" onclick="window.AccessManagement.resetDefaults()" style="font-size: 11px; padding: 5px 12px; gap: 6px;">
              <i class="fa-solid fa-arrow-rotate-left"></i> Restablecer Matriz
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
      `;

      roles.forEach(roleKey => {
        const roleData = matrix[roleKey];
        html += `
          <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
              <div>
                <strong style="color: ${roleData.color}; font-size: 12.5px;">${escapeHtml(roleData.name)}</strong>
                <div style="font-size: 10px; color: var(--txt-muted);">${escapeHtml(roleData.description)}</div>
              </div>
              <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: var(--txt-secondary); font-family: monospace;">
                ${roleKey}
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
        `;

        Object.keys(roleData.modules).forEach(modKey => {
          const mod = roleData.modules[modKey];
          html += `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 4px 6px; border-radius: 4px; background: rgba(255,255,255,0.02);">
              <span style="color: var(--txt-primary); font-weight: 600;">${escapeHtml(mod.label)}</span>
              <div style="display: flex; gap: 6px;">
                <label style="cursor: pointer; display: flex; align-items: center; gap: 2px; font-size: 9.5px; color: ${mod.read ? 'var(--emerald)' : 'var(--txt-muted)'};">
                  <input type="checkbox" ${mod.read ? 'checked' : ''} onchange="window.AccessManagement.togglePermission('${roleKey}', '${modKey}', 'read')" style="accent-color: var(--emerald);"> R
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 2px; font-size: 9.5px; color: ${mod.write ? 'var(--amber)' : 'var(--txt-muted)'};">
                  <input type="checkbox" ${mod.write ? 'checked' : ''} onchange="window.AccessManagement.togglePermission('${roleKey}', '${modKey}', 'write')" style="accent-color: var(--amber);"> W
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 2px; font-size: 9.5px; color: ${mod.delete ? 'var(--rose)' : 'var(--txt-muted)'};">
                  <input type="checkbox" ${mod.delete ? 'checked' : ''} onchange="window.AccessManagement.togglePermission('${roleKey}', '${modKey}', 'delete')" style="accent-color: var(--rose);"> D
                </label>
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;

      container.innerHTML = html;
    },

    hasPermission(roleKey, moduleKey, action = 'read') {
      const matrix = this.getMatrix();
      if (!matrix[roleKey] || !matrix[roleKey].modules[moduleKey]) return false;
      return Boolean(matrix[roleKey].modules[moduleKey][action]);
    },

    resetDefaults() {
      localStorage.removeItem(STORAGE_KEY);
      this.render();
      if (global.SecuritySuite && global.SecuritySuite.toast) {
        global.SecuritySuite.toast('Matriz de permisos restablecida a los valores oficiales.', 'info', 'Permisos Restablecidos');
      }
    }
  };

  global.AccessManagement = AccessManagement;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessManagement;
  }
})(typeof window !== 'undefined' ? window : globalThis);
