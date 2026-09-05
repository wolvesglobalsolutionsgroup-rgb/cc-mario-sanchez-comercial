/**
 * ==============================================================================
 * AUTH GUARD & SESIÓN REACTIVA
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 *
 * - Centraliza login, logout, timeout y visibilidad de UI por rol.
 * - Hash de credenciales: PBKDF2 (100k iteraciones + salt aleatorio) vía WebCrypto.
 *   Retrocompatible con SHA-256 plano de versiones anteriores.
 * - Rate limiting de 5 intentos / 5 min de bloqueo.
 * - El modo demo está habilitado para esta demo pública; los datos son ficticios.
 *
 * v2.4.1 - FIX AUDITORÍA: PBKDF2 con salt + auto-migración de hashes antiguos
 * ==============================================================================
 */

(function (global) {
  'use strict';

  // --- 1. CONFIGURACIÓN DE USUARIOS DEMO --------------------------------------
  // Formato de password_sha256:
  //   - NUEVO: "salt_hex:hash_hex" (PBKDF2 con 100k iteraciones, salt aleatorio 16 bytes)
  //   - LEGACY: 64 caracteres hex (SHA-256 plano, migrado automáticamente en primer login)
  const PBKDF2_ITERATIONS = 100000;

  const DEFAULT_USERS = [
    {
      id: 'u-admin-1',
      role: 'admin',
      display_name: 'Administración CCMS',
      identifier: 'administracion@ccmariosanchez.com',
      // PBKDF2-SHA256 de "Admin2026*" con salt fija determinista para usuarios por defecto
      // (los usuarios nuevos en producción usarán salts aleatorias)
      password_sha256: '43434d535f323032365f53414c545f56:f1f52c83808596560eb7cd953f5f3a98a0e4f998bb685eb6d0fa920bbc8557ff',
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
      // PBKDF2-SHA256 de "Demo2026*"
      password_sha256: '43434d535f323032365f53414c545f56:206fa3bb6f04293dd6435c310e77367036027ea99750d5f5eee39f60bbd68ad0',
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
      password_sha256: '43434d535f323032365f53414c545f56:206fa3bb6f04293dd6435c310e77367036027ea99750d5f5eee39f60bbd68ad0',
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

  const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
  const SESSION_KEY = 'ccms_session';
  const THEME_KEY = 'ccms_theme';
  const CURRENCY_KEY = 'ccms_active_currency';
  const DEMO_ENABLED = global.CCMS_DEMO_MODE !== false;

  // --- 2. CRIPTOGRAFÍA: PBKDF2 CON SALT ---------------------------------------

  /**
   * Hash SHA-256 legacy (sólo para auto-migración de usuarios antiguos)
   */
  async function sha256Legacy(text) {
    if (global.crypto && global.crypto.subtle) {
      const enc = new TextEncoder().encode(text);
      const buf = await global.crypto.subtle.digest('SHA-256', enc);
      const arr = Array.from(new Uint8Array(buf));
      return arr.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return 'PLAIN:' + text;
  }

  function bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Hash PBKDF2-SHA256 con salt aleatorio de 16 bytes.
   * Formato de retorno: "salt_hex:hash_hex"
   */
  async function hashPasswordWithSalt(password, fixedSaltHex = null) {
    if (!global.crypto || !global.crypto.subtle) {
      // Fallback inseguro — etiquetado como PLAIN
      return 'PLAIN:' + password;
    }
    try {
      const salt = fixedSaltHex
        ? hexToBytes(fixedSaltHex)
        : global.crypto.getRandomValues(new Uint8Array(16));
      const keyMat = await global.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const bits = await global.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMat,
        256
      );
      return `${bytesToHex(salt)}:${bytesToHex(bits)}`;
    } catch (e) {
      console.error('[AUTH] hashPasswordWithSalt falló:', e);
      return 'PLAIN:' + password;
    }
  }

  /**
   * Verifica una contraseña contra un hash almacenado.
   * Soporta ambos formatos:
   *   - Legacy (SHA-256 plano): 64 caracteres hex sin ':'
   *   - Nuevo (PBKDF2): "salt_hex:hash_hex"
   *   - PLAIN:password (fallback inseguro)
   */
  async function verifyPassword(password, storedHash) {
    if (!password || !storedHash) return false;

    // Fallback PLAIN (sólo para compatibilidad rota)
    if (storedHash.startsWith('PLAIN:')) {
      return storedHash === 'PLAIN:' + password;
    }

    // Formato nuevo: PBKDF2 con salt
    if (storedHash.includes(':')) {
      const parts = storedHash.split(':');
      if (parts.length !== 2) return false;
      const [saltHex, expectedHashHex] = parts;
      if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(expectedHashHex)) {
        return false;
      }
      if (!global.crypto || !global.crypto.subtle) return false;
      try {
        const salt = hexToBytes(saltHex);
        const keyMat = await global.crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(password),
          'PBKDF2',
          false,
          ['deriveBits']
        );
        const bits = await global.crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
          keyMat,
          256
        );
        const computedHex = bytesToHex(bits);
        // Comparación constant-time para mitigar timing attacks
        if (computedHex.length !== expectedHashHex.length) return false;
        let diff = 0;
        for (let i = 0; i < computedHex.length; i++) {
          diff |= computedHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
        }
        return diff === 0;
      } catch (e) {
        console.error('[AUTH] verifyPassword PBKDF2 falló:', e);
        return false;
      }
    }

    // Formato legacy: SHA-256 plano (64 hex chars) — será auto-migrado tras login exitoso
    if (/^[0-9a-f]{64}$/i.test(storedHash)) {
      const hash = await sha256Legacy(password);
      if (hash.startsWith('PLAIN:')) return false;
      return hash === storedHash;
    }

    return false;
  }

  /**
   * Detecta si un hash está en formato legacy (sin salt).
   */
  function isLegacyHash(storedHash) {
    return typeof storedHash === 'string'
      && !storedHash.includes(':')
      && /^[0-9a-f]{64}$/i.test(storedHash);
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

  function loginPath() {
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

    // RATE LIMITING / LOCKOUT: Máximo 5 intentos fallidos en 5 minutos
    const LOCKOUT_KEY = 'ccms_login_lockout';
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
    
    let lockoutState = { count: 0, lockedUntil: 0 };
    try {
      const storedLock = localStorage.getItem(LOCKOUT_KEY);
      if (storedLock) lockoutState = JSON.parse(storedLock);
    } catch (e) {}

    if (lockoutState.lockedUntil && lockoutState.lockedUntil > now()) {
      const remainingSec = Math.ceil((lockoutState.lockedUntil - now()) / 1000);
      return {
        ok: false,
        error: `Acceso temporalmente bloqueado por demasiados intentos fallidos. Intente nuevamente en ${remainingSec} segundos.`
      };
    }

    const recordFailedAttempt = () => {
      let currentAttempts = (lockoutState.lockedUntil && lockoutState.lockedUntil <= now()) ? 0 : (lockoutState.count || 0);
      currentAttempts += 1;
      let lockedUntil = 0;
      if (currentAttempts >= MAX_ATTEMPTS) {
        lockedUntil = now() + LOCKOUT_DURATION_MS;
      }
      localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ count: currentAttempts, lockedUntil }));
    };

    const clearLockout = () => {
      localStorage.removeItem(LOCKOUT_KEY);
    };

    const idLower = String(identifier).trim().toLowerCase();
    const allUsers = getUsers();
    const user = allUsers.find(u => u.identifier.toLowerCase() === idLower);
    if (!user) {
      recordFailedAttempt();
      return { ok: false, error: 'Usuario o contraseña incorrectos' };
    }

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

    // Verificación PBKDF2 (con retrocompatibilidad SHA-256 legacy)
    const valid = await verifyPassword(password, user.password_sha256);
    if (!valid) {
      recordFailedAttempt();
      return { ok: false, error: 'Usuario o contraseña incorrectos' };
    }

    // AUTO-MIGRACIÓN: si el usuario estaba en formato legacy SHA-256, re-hash con PBKDF2
    if (isLegacyHash(user.password_sha256)) {
      try {
        user.password_sha256 = await hashPasswordWithSalt(password);
        saveUsers(allUsers);
        console.info('[AUTH] Usuario migrado automáticamente de SHA-256 legacy a PBKDF2 con salt.');
      } catch (e) {
        console.warn('[AUTH] No se pudo migrar el hash:', e);
      }
    }

    clearLockout();

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
    return { ok: true, session, redirect: 'index.html' };
  }

  function logout() {
    clearSession();
    global.location.replace(loginPath());
  }

  function currentUser() {
    return getSession();
  }

  function require(requiredRole) {
    const sess = getSession();
    if (!sess) {
      redirectToLogin('no_session');
      return null;
    }
    if (requiredRole && requiredRole !== 'any' && sess.role !== requiredRole) {
      if (sess.role !== 'admin') {
        redirectToLogin('forbidden_role');
        return null;
      }
    }
    return sess;
  }

  // --- 4. UI HELPERS -----------------------------------------------------------

  function mountUserChip(containerEl) {
    const sess = getSession();
    if (!sess) return;

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
        logoutBtn.onclick = async function(e) {
          e.preventDefault();
          const proceed = window.SecuritySuite && window.SecuritySuite.confirm 
            ? await window.SecuritySuite.confirm('¿Desea cerrar su sesión segura y salir del sistema de gestión inmobiliaria?', 'Cerrar Sesión', 'Salir del Sistema', 'Permanecer')
            : confirm('¿Cerrar sesión y salir del sistema de gestión?');
          if (proceed) {
            logout();
          }
        };
      }
    }

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
        btn.onclick = async function (e) {
          e.preventDefault();
          const proceed = window.SecuritySuite && window.SecuritySuite.confirm 
            ? await window.SecuritySuite.confirm('¿Desea cerrar su sesión segura y salir del sistema?', 'Cerrar Sesión', 'Salir', 'Cancelar')
            : confirm('¿Cerrar sesión y volver al login?');
          if (proceed) {
            logout();
          }
        };
      }
    }
  }

  function applyRoleVisibility(rootEl) {
    const sess = getSession();
    if (!sess) return;
    const root = rootEl || document;

    root.querySelectorAll('[data-roles="admin"]').forEach(el => {
      el.style.display = (sess.role === 'admin') ? '' : 'none';
    });
    root.querySelectorAll('[data-roles="tenant"]').forEach(el => {
      el.style.display = (sess.role === 'tenant') ? '' : 'none';
    });
    root.querySelectorAll('[data-tenant-name]').forEach(el => {
      el.textContent = sess.display_name || '';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

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
    // NUEVOS USUARIOS: hash PBKDF2 con salt aleatoria (no SHA-256 plano)
    const hash = await hashPasswordWithSalt(defaultPass);

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
    listUsers,
    approveUser,
    rejectUser,
    registerOrInviteUser,
    hashPasswordWithSalt,
    verifyPassword,
    sha256: sha256Legacy,
    demoEnabled: DEMO_ENABLED
  };

  global.escapeHtml = escapeHtml;

  function audit(event, detail) {
    try {
      const sess = getSession();
      console.log('[CCMS-AUDIT]', new Date().toISOString(), event, sess ? sess.user_id : 'anon', detail || '');
    } catch (e) { /* noop */ }
  }
  global.AuthGuard.audit = audit;

})(window);
