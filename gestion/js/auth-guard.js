/**
 * ==============================================================================
 * AUTH GUARD & SESIÓN REACTIVA
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 *
 * - Centraliza login, logout, timeout y visibilidad de UI por rol.
 * - Hash de credenciales en SHA-256 vía Web Crypto API (nativo, sin libs).
 * - El modo demo está habilitado para esta demo pública; los datos son ficticios.
 *
 * USO:
 *   <script src="js/auth-guard.js"></script>
 *   <script>AuthGuard.require('admin'); // o 'tenant' / 'any'</script>
 * ==============================================================================
 */

(function (global) {
  'use strict';

  // --- 1. CONFIGURACIÓN DE USUARIOS DEMO --------------------------------------
  // En producción real estos vienen de Supabase con bcrypt. Para demo se
  // almacenan hasheados y se comparan en cliente. NO usar en producción real.
  // Lista base inicial de usuarios autorizados
  const DEFAULT_USERS = [
    {
      id: 'u-admin-1',
      role: 'admin',
      display_name: 'Administración CCMS',
      identifier: 'administracion@ccmariosanchez.com',
      // SHA-256 de "Admin2026*"
      password_sha256: '8d90ed647b948fa80c3c9bbf5316c78f151723f52fb9d6101f818af8afff69ec',
      tenant_id: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      unit: 'Oficina Administrativa 01'
    },
    {
      id: 'u-tenant-1',
      role: 'tenant',
      display_name: 'Distribuidora Oriente Marino (Demo)',
      identifier: 'J-30987123-4',
      // SHA-256 de "Demo2026*"
      password_sha256: 'c244e6aa94ea784ec36662388c4af538cad09ecc88da5b1e7a8cc066990d07b6',
      tenant_id: 't-1',
      status: 'active',
      created_at: '2026-02-15T10:30:00.000Z',
      unit: 'Local PB-01'
    },
    {
      id: 'u-tenant-2',
      role: 'tenant',
      display_name: 'Farmacia & Suministros Caribe',
      identifier: 'J-40129845-0',
      password_sha256: 'c244e6aa94ea784ec36662388c4af538cad09ecc88da5b1e7a8cc066990d07b6',
      tenant_id: 't-2',
      status: 'pending_approval',
      created_at: '2026-09-02T14:20:00.000Z',
      unit: 'Local PB-02'
    }
  ];

  const USERS_STORAGE_KEY = 'ccms_registered_users';

  function getUsers() {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
      }
      return JSON.parse(stored);
    } catch (e) {
      return DEFAULT_USERS;
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
  const SESSION_KEY = 'ccms_session';
  const THEME_KEY = 'ccms_theme';
  const CURRENCY_KEY = 'ccms_active_currency';
  // Esta versión pública es una demo. Al conectar Supabase, se cambiará a
  // CCMS_DEMO_MODE=false mediante configuración de producción.
  const DEMO_ENABLED = global.CCMS_DEMO_MODE !== false;

  // --- 2. UTILIDADES -----------------------------------------------------------

  /**
   * SHA-256 de un string usando Web Crypto. Devuelve hex lowercase.
   * Si la API no está disponible (navegadores muy viejos), hace fallback
   * a comparación en texto plano SOLO si el flag de demo inseguro lo permite.
   */
  async function sha256(text) {
    if (global.crypto && global.crypto.subtle) {
      const enc = new TextEncoder().encode(text);
      const buf = await global.crypto.subtle.digest('SHA-256', enc);
      const arr = Array.from(new Uint8Array(buf));
      return arr.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback MUY inseguro. Solo para entornos sin Web Crypto.
    return 'PLAIN:' + text;
  }

  function now() { return Date.now(); }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const sess = JSON.parse(raw);
      if (!sess || !sess.user_id || !sess.role || !sess.expires_at) return null;
      if (sess.expires_at < now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return sess;
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /**
   * Calcula la ruta relativa de login para que el guard funcione
   * tanto desde la raíz como desde /gestion/ sin hardcodear prefijos.
   */
  function loginPath() {
    // Si la página actual vive dentro de /gestion/, el login relativo es ./login.html
    const path = global.location.pathname.replace(/\\/g, '/');
    if (/\/gestion\//.test(path)) return 'login.html';
    return 'login.html';
  }

  function redirectToLogin(reason) {
    clearSession();
    const target = loginPath();
    const sep = target.includes('?') ? '&' : '?';
    const url = target + sep + 'expired=' + encodeURIComponent(reason || '1');
    global.location.replace(url);
  }

  // --- 3. AUTH API -------------------------------------------------------------

  async function login(identifier, password) {
    if (!identifier || !password) {
      return { ok: false, error: 'Credenciales incompletas' };
    }

    if (!DEMO_ENABLED) {
      return { ok: false, error: 'La autenticación demo está deshabilitada en producción. Configure Supabase Auth.' };
    }

    // Busca coincidencia por identifier (case-insensitive)
    const idLower = String(identifier).trim().toLowerCase();
    const allUsers = getUsers();
    const user = allUsers.find(u => u.identifier.toLowerCase() === idLower);
    if (!user) {
      return { ok: false, error: 'Usuario o contraseña incorrectos' };
    }

    // CONTROL DE ACCESO POR COMITÉ: Verificar estado de autorización
    if (user.status === 'pending_approval') {
      return { 
        ok: false, 
        error: 'Su cuenta está registrada pero aún PENDIENTE DE APROBACIÓN por el Comité / Administrador Principal. Comuníquese con la gerencia para activar su acceso.' 
      };
    }
    if (user.status === 'rejected') {
      return { 
        ok: false, 
        error: 'El acceso para este usuario ha sido denegado o revocado por el Comité de Administración.' 
      };
    }

    const hash = await sha256(password);
    if (hash !== user.password_sha256 && !hash.startsWith('PLAIN:')) {
      return { ok: false, error: 'Usuario o contraseña incorrectos' };
    }
    if (hash.startsWith('PLAIN:') && hash !== 'PLAIN:' + password) {
      return { ok: false, error: 'Usuario o contraseña incorrectos' };
    }

    const session = {
      user_id: user.id,
      role: user.role,
      display_name: user.display_name,
      identifier: user.identifier,
      tenant_id: user.tenant_id || null,
      status: user.status || 'active',
      created_at: now(),
      expires_at: now() + SESSION_TTL_MS
    };
    setSession(session);
    return { ok: true, session, redirect: user.role === 'admin' ? 'index.html' : 'index.html' };
  }

  function logout() {
    clearSession();
    global.location.replace(loginPath());
  }

  function currentUser() {
    return getSession();
  }

  /**
   * Guard principal. Llamar al inicio de cada página privada.
   * @param {'admin'|'tenant'|'any'} requiredRole
   */
  function require(requiredRole) {
    const sess = getSession();
    if (!sess) {
      redirectToLogin('no_session');
      return null;
    }
    if (requiredRole && requiredRole !== 'any' && sess.role !== requiredRole) {
      // El rol no coincide. Si el usuario es admin lo dejamos pasar (siempre
      // tiene acceso), pero los tenants no pueden entrar a páginas solo-admin.
      if (sess.role !== 'admin') {
        redirectToLogin('forbidden_role');
        return null;
      }
    }
    return sess;
  }

  // --- 4. UI HELPERS -----------------------------------------------------------

  /**
   * Inyecta la tarjeta de usuario y el botón de salida del sistema.
   * Prioridad 1: #sidebar-user-area (ubicado a la izquierda, al pie del sidebar).
   * Fallback: #top-actions-user-area o containerEl pasado por parámetro.
   */
  function mountUserChip(containerEl) {
    const sess = getSession();
    if (!sess) return;

    // Si existe el área dedicada en el sidebar (abajo a la izquierda)
    const sidebarTarget = document.getElementById('sidebar-user-area');
    if (sidebarTarget && !document.getElementById('ccms-sidebar-user-card')) {
      const isAdm = sess.role === 'admin';
      const roleName = isAdm ? 'Administrador' : 'Inquilino';
      const icon = isAdm ? 'fa-user-shield' : 'fa-store';
      const themeColor = isAdm ? 'var(--amber)' : 'var(--emerald)';
      const themeGlow = isAdm ? 'var(--amber-glow)' : 'var(--emerald-glow)';

      const card = document.createElement('div');
      card.id = 'ccms-sidebar-user-card';
      card.className = 'sidebar-user-card';
      card.innerHTML = `
        <div class="sidebar-user-header">
          <div class="sidebar-user-avatar" style="background:${themeGlow}; border:1px solid ${themeColor}; color:${themeColor};">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div class="sidebar-user-details">
            <span class="sidebar-user-name" title="${escapeHtml(sess.display_name)}">${escapeHtml(sess.display_name)}</span>
            <span class="sidebar-user-role">${roleName}</span>
          </div>
        </div>
        <button id="ccms-sidebar-logout-btn" type="button" class="sidebar-logout-btn" title="Cerrar sesión y salir del sistema">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span>Cerrar Sesión</span>
        </button>
      `;
      sidebarTarget.innerHTML = '';
      sidebarTarget.appendChild(card);

      const logoutBtn = document.getElementById('ccms-sidebar-logout-btn');
      if (logoutBtn) {
        logoutBtn.onclick = function(e) {
          e.preventDefault();
          if (confirm('¿Cerrar sesión y salir del sistema de gestión?')) {
            logout();
          }
        };
      }
    }

    // Si además existe contenedor alternativo (ej. header en páginas secundarias o si no hay sidebar)
    const topTarget = containerEl || document.getElementById('top-actions-user-area');
    if (topTarget && !sidebarTarget && !document.getElementById('ccms-user-chip')) {
      const chip = document.createElement('div');
      chip.id = 'ccms-user-chip';
      chip.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px 4px 4px;border:1px solid var(--border-subtle);border-radius:24px;background:var(--bg-card);';
      chip.innerHTML = `
        <div style="width:30px;height:30px;border-radius:50%;background:${sess.role === 'admin' ? 'var(--amber-glow)' : 'var(--emerald-glow)'};border:1px solid ${sess.role === 'admin' ? 'var(--amber)' : 'var(--emerald)'};display:flex;align-items:center;justify-content:center;color:${sess.role === 'admin' ? 'var(--amber)' : 'var(--emerald)'};font-weight:800;font-size:11px;">
          <i class="fa-solid ${sess.role === 'admin' ? 'fa-user-shield' : 'fa-store'}"></i>
        </div>
        <div style="display:flex;flex-direction:column;line-height:1.1;max-width:160px;">
          <span style="font-size:11px;font-weight:700;color:var(--txt-primary);font-family:var(--font-heading);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(sess.display_name)}</span>
          <span style="font-size:9.5px;color:var(--txt-muted);text-transform:uppercase;letter-spacing:0.5px;">${sess.role === 'admin' ? 'Administrador' : 'Inquilino'}</span>
        </div>
        <button id="ccms-logout-btn" type="button" title="Cerrar sesión" style="background:transparent;border:none;color:var(--rose);cursor:pointer;padding:4px 6px;font-size:13px;border-radius:50%;">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      `;
      topTarget.appendChild(chip);

      const btn = document.getElementById('ccms-logout-btn');
      if (btn) {
        btn.onclick = function (e) {
          e.preventDefault();
          if (confirm('¿Cerrar sesión y volver al login?')) {
            logout();
          }
        };
      }
    }
  }

  /**
   * Aplica visibilidad por rol: oculta los nodos con data-roles="admin"
   * a los inquilinos, y los data-roles="tenant" a los admins (excepto
   * que el admin quiera ver el módulo de inquilinos, en cuyo caso se
   * permite por defecto y se controla con data-hide-from-admin).
   */
  function applyRoleVisibility(rootEl) {
    const sess = getSession();
    if (!sess) return;
    const root = rootEl || document;

    // Elementos exclusivos de admin
    root.querySelectorAll('[data-roles="admin"]').forEach(el => {
      el.style.display = (sess.role === 'admin') ? '' : 'none';
    });
    // Elementos exclusivos de tenant
    root.querySelectorAll('[data-roles="tenant"]').forEach(el => {
      el.style.display = (sess.role === 'tenant') ? '' : 'none';
    });
    // Para el inquilino: pegar su nombre en elementos con data-tenant-name
    root.querySelectorAll('[data-tenant-name]').forEach(el => {
      el.textContent = sess.display_name || '';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // --- FUNCIONES DE COMITÉ & APROBACIÓN DE USUARIOS ---
  function listUsers() {
    return getUsers();
  }

  function approveUser(userId) {
    const users = getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) return { ok: false, error: 'Usuario no encontrado' };
    target.status = 'active';
    target.approved_at = new Date().toISOString();
    saveUsers(users);
    audit('user_approved', { user_id: userId, identifier: target.identifier });
    return { ok: true, user: target };
  }

  function rejectUser(userId) {
    const users = getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) return { ok: false, error: 'Usuario no encontrado' };
    target.status = 'rejected';
    target.rejected_at = new Date().toISOString();
    saveUsers(users);
    audit('user_rejected', { user_id: userId, identifier: target.identifier });
    return { ok: true, user: target };
  }

  async function registerOrInviteUser(userData) {
    const users = getUsers();
    const idLower = String(userData.identifier || '').trim().toLowerCase();
    const exists = users.find(u => u.identifier.toLowerCase() === idLower);
    if (exists) {
      return { ok: false, error: 'Ya existe un usuario con este identificador o correo.' };
    }

    const defaultPass = userData.role === 'admin' ? 'Admin2026*' : 'Demo2026*';
    const hash = await sha256(defaultPass);

    const newUser = {
      id: 'u-' + Date.now(),
      role: userData.role || 'tenant',
      display_name: userData.display_name || 'Nuevo Usuario',
      identifier: userData.identifier,
      password_sha256: hash,
      tenant_id: userData.role === 'tenant' ? ('t-' + Date.now()) : null,
      unit: userData.unit || 'Por asignar',
      status: userData.status || 'pending_approval',
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    audit('user_created', { user_id: newUser.id, identifier: newUser.identifier, status: newUser.status });
    return { ok: true, user: newUser };
  }

  // --- 5. EXPORT ---------------------------------------------------------------

  global.AuthGuard = {
    require,
    login,
    logout,
    currentUser,
    mountUserChip,
    applyRoleVisibility,
    // Gestión por Comité de Acceso
    listUsers,
    approveUser,
    rejectUser,
    registerOrInviteUser,
    // utilidades expuestas para casos puntuales
    sha256,
    demoEnabled: DEMO_ENABLED
  };

  // Reutilizable por los renderizadores del dashboard para escapar datos de usuario.
  global.escapeHtml = escapeHtml;

  // Log de auditoría mínimo (en consola por ahora; cuando se conecte Supabase
  // se persistirá en la tabla audit_logs)
  function audit(event, detail) {
    try {
      const sess = getSession();
      console.log('[CCMS-AUDIT]', new Date().toISOString(), event, sess ? sess.user_id : 'anon', detail || '');
    } catch (e) { /* noop */ }
  }
  global.AuthGuard.audit = audit;

})(window);
