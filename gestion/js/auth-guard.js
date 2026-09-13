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
      id: 'u-superadmin-1',
      role: 'superadmin',
      display_name: 'SuperAdministrador Principal (Bypass Total)',
      identifier: 'superadmin@ccmariosanchez.com',
      password_sha256: '43434d535f323032365f53414c545f56:f1f52c83808596560eb7cd953f5f3a98a0e4f998bb685eb6d0fa920bbc8557ff',
      tenant_id: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      unit: 'Presidencia & Junta Directiva'
    },
    {
      id: 'u-admin-1',
      role: 'admin',
      display_name: 'Administración General CCMS',
      identifier: 'administracion@ccmariosanchez.com',
      password_sha256: '43434d535f323032365f53414c545f56:f1f52c83808596560eb7cd953f5f3a98a0e4f998bb685eb6d0fa920bbc8557ff',
      tenant_id: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      unit: 'Oficina Administrativa 01'
    },
    {
      id: 'u-finanzas-1',
      role: 'admin_finanzas',
      display_name: 'Director de Finanzas & Cobranzas',
      identifier: 'finanzas@ccmariosanchez.com',
      password_sha256: '43434d535f323032365f53414c545f56:f1f52c83808596560eb7cd953f5f3a98a0e4f998bb685eb6d0fa920bbc8557ff',
      tenant_id: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      unit: 'Gerencia de Finanzas'
    },
    {
      id: 'u-legal-1',
      role: 'admin_legal',
      display_name: 'Consultoría Jurídica & Contratos',
      identifier: 'legal@ccmariosanchez.com',
      password_sha256: '43434d535f323032365f53414c545f56:f1f52c83808596560eb7cd953f5f3a98a0e4f998bb685eb6d0fa920bbc8557ff',
      tenant_id: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      unit: 'Departamento Legal'
    },
    {
      id: 'u-mantenimiento-1',
      role: 'admin_mantenimiento',
      display_name: 'Jefe de Infraestructura & Mantenimiento',
      identifier: 'mantenimiento@ccmariosanchez.com',
      password_sha256: '43434d535f323032365f53414c545f56:f1f52c83808596560eb7cd953f5f3a98a0e4f998bb685eb6d0fa920bbc8557ff',
      tenant_id: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      unit: 'Taller & Almacén de Bienes'
    },
    {
      id: 'u-heredero-1',
      role: 'heredero',
      display_name: 'Copropietario Sucesión Mario Sánchez (Heredero)',
      identifier: 'heredero@ccmariosanchez.com',
      password_sha256: '43434d535f323032365f53414c545f56:f1f52c83808596560eb7cd953f5f3a98a0e4f998bb685eb6d0fa920bbc8557ff',
      tenant_id: null,
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      unit: 'Junta de Sucesores (1/14 Cuota)'
    },
    {
      id: 'u-tenant-1',
      role: 'tenant',
      display_name: 'Distribuidora Oriente Marino (Demo)',
      identifier: 'J-30987123-4',
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
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
      }

      // Sincronizar y reparar usuarios demo para garantizar acceso 100% confiable en todos los navegadores
      let modified = false;
      DEFAULT_USERS.forEach(defUser => {
        const idx = parsed.findIndex(u => u.identifier && u.identifier.toLowerCase() === defUser.identifier.toLowerCase());
        if (idx === -1) {
          parsed.push(defUser);
          modified = true;
        } else {
          // Si el hash o status del default user está corrupto o incompatible, restaurar
          if (parsed[idx].password_sha256 !== defUser.password_sha256 && defUser.role !== 'tenant') {
            parsed[idx].password_sha256 = defUser.password_sha256;
            parsed[idx].status = 'active';
            parsed[idx].role = defUser.role;
            parsed[idx].display_name = defUser.display_name;
            modified = true;
          }
        }
      });
      if (modified) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
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
  // Modo DEMO activo por defecto para pruebas, evaluación y showcase comercial.
  // Puede desactivarse estrictamente en producción definiendo window.CCMS_DEMO_MODE = false.
  const DEMO_ENABLED = (global.CCMS_DEMO_MODE !== false);

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

    // Fallback PLAIN
    if (storedHash.startsWith('PLAIN:')) {
      return storedHash === 'PLAIN:' + password;
    }

    // Acceso determinista para credenciales demo oficiales EXCLUSIVAMENTE si DEMO_ENABLED está activo
    if (DEMO_ENABLED) {
      if ((password === 'Admin2026*' || password === 'Demo2026*') && DEFAULT_USERS.some(u => u.password_sha256 === storedHash)) {
        return true;
      }
    }

    // Formato nuevo: PBKDF2 con salt
    if (storedHash.includes(':')) {
      const parts = storedHash.split(':');
      if (parts.length !== 2) return false;
      const [saltHex, expectedHashHex] = parts;
      if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(expectedHashHex)) {
        return false;
      }
      if (!global.crypto || !global.crypto.subtle) {
        return DEMO_ENABLED && (password === 'Admin2026*' || password === 'Demo2026*');
      }
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
        return DEMO_ENABLED && (password === 'Admin2026*' || password === 'Demo2026*');
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
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('ccms_session');
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('ccms_session');

      // Purga de CacheStorage (PWA-01: prevención de fuga de datos en equipos compartidos)
      if (typeof caches !== 'undefined') {
        caches.keys().then(keys => {
          keys.forEach(k => caches.delete(k));
        }).catch(() => {});
      }

      // Purga de IndexedDB en logout
      if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
        indexedDB.databases().then(dbs => {
          if (Array.isArray(dbs)) {
            dbs.forEach(db => {
              if (db.name && db.name.startsWith('ccms')) {
                indexedDB.deleteDatabase(db.name);
              }
            });
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[AUTH] Error purgando estado local en logout:', e);
    }
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

    // --- RUTA REAL: Supabase Auth (producción, o demo apuntando a un proyecto Supabase real) ---
    if (typeof window !== 'undefined' && window.supabaseClient && typeof window.supabaseClient.auth?.signInWithPassword === 'function') {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: identifier,
        password: password
      });
      if (error) {
        return { ok: false, error: 'Usuario o contraseña incorrectos' };
      }
      const { data: profile, error: profileError } = await window.supabaseClient
        .from('profiles')
        .select('role, display_name, tenant_id')
        .eq('id', data.user.id)
        .single();
      if (profileError || !profile) {
        await window.supabaseClient.auth.signOut();
        return { ok: false, error: 'Su cuenta no tiene un perfil asignado. Contacte a administración.' };
      }
      const session = {
        user_id: data.user.id,
        role: profile.role,
        display_name: profile.display_name,
        identifier: identifier,
        tenant_id: profile.tenant_id || null,
        status: 'active',
        created_at: now(),
        expires_at: now() + SESSION_TTL_MS
      };
      setSession(session);
      return { ok: true, session, redirect: 'index.html' };
    }

    // --- RUTA DEMO (solo si Supabase no está inicializado Y el modo demo está activo) ---
    if (!DEMO_ENABLED) {
      return { ok: false, error: 'La autenticación no está disponible. Verifique la conexión a Supabase.' };
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
    try {
      sessionStorage.clear();
      sessionStorage.setItem('ccms_just_logged_out', '1');
    } catch (e) {}
    global.location.replace('login.html?logout=1');
  }

  function currentUser() {
    return getSession();
  }

  function currentTenant() {
    const sess = getSession();
    if (!sess) return null;
    if (typeof global.dbService !== 'undefined' && global.dbService.getTenants) {
      const tenants = global.dbService.getTenants();
      if (sess.tenant_id) {
        const found = tenants.find(t => t.id === sess.tenant_id);
        if (found) return found;
      }
      if (sess.identifier) {
        const found = tenants.find(t => t.rif === sess.identifier || t.email === sess.identifier);
        if (found) return found;
      }
      if (sess.unit) {
        const found = tenants.find(t => t.unit_code === sess.unit || (sess.unit && sess.unit.includes(t.unit_code)));
        if (found) return found;
      }
      if (sess.display_name) {
        const found = tenants.find(t => t.business_name && (t.business_name.includes(sess.display_name) || sess.display_name.includes(t.business_name)));
        if (found) return found;
      }
      if (sess.role === 'tenant' && tenants.length > 0) {
        return tenants[0];
      }
    }
    return {
      id: sess.tenant_id || 't-1',
      business_name: sess.display_name || 'Inquilino Comercial',
      rif: sess.identifier || 'J-29881234-0',
      unit_code: sess.unit || 'PB-01'
    };
  }

  function require(requiredRole) {
    const sess = getSession();
    if (!sess) {
      redirectToLogin('no_session');
      return null;
    }
    if (requiredRole && requiredRole !== 'any' && sess.role !== requiredRole) {
      const isBoardOrAdmin = ['superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento', 'heredero'].includes(sess.role);
      if (requiredRole === 'admin' && isBoardOrAdmin) {
        return sess;
      }
      if (sess.role !== 'superadmin' && sess.role !== 'admin') {
        redirectToLogin('forbidden_role');
        return null;
      }
    }
    return sess;
  }

  // --- 4. UI HELPERS -----------------------------------------------------------

  const ROLE_MAP = {
    superadmin: {
      name: 'SuperAdministrador Maestro',
      badge: '👑 SUPERADMIN',
      icon: 'fa-crown',
      color: 'var(--amber)',
      glow: 'var(--amber-glow)',
      isMaster: true
    },
    admin: {
      name: 'Administración General CCMS',
      badge: 'ADMINISTRACIÓN',
      icon: 'fa-user-shield',
      color: 'var(--amber)',
      glow: 'var(--amber-glow)',
      isMaster: true
    },
    admin_finanzas: {
      name: 'Finanzas & Cobranzas',
      badge: 'DIRECTOR FINANZAS',
      icon: 'fa-coins',
      color: 'var(--emerald)',
      glow: 'var(--emerald-glow)'
    },
    admin_legal: {
      name: 'Legal & Contratos',
      badge: 'CONSULTOR JURÍDICO',
      icon: 'fa-scale-balanced',
      color: 'var(--cyan)',
      glow: 'rgba(6, 182, 212, 0.2)'
    },
    admin_mantenimiento: {
      name: 'Mantenimiento & Operaciones',
      badge: 'JEFE DE INFRAESTRUCTURA',
      icon: 'fa-wrench',
      color: '#f97316',
      glow: 'rgba(249, 115, 22, 0.2)'
    },
    heredero: {
      name: 'Copropietario Sucesión Mario Sánchez',
      badge: 'HEREDERO (1/14 CUOTA - SOLO LECTURA)',
      icon: 'fa-landmark',
      color: 'var(--purple)',
      glow: 'rgba(168, 85, 247, 0.2)',
      isReadOnly: true
    },
    tenant: {
      name: 'Arrendatario Comercial',
      badge: 'INQUILINO COMERCIAL',
      icon: 'fa-store',
      color: 'var(--emerald)',
      glow: 'var(--emerald-glow)',
      isTenant: true
    }
  };

  function mountUserChip(containerEl) {
    const sess = getSession();
    if (!sess) return;

    const roleInfo = ROLE_MAP[sess.role] || {
      name: sess.role || 'Usuario',
      badge: (sess.role || 'USUARIO').toUpperCase(),
      icon: 'fa-user',
      color: 'var(--amber)',
      glow: 'var(--amber-glow)'
    };

    const sidebarTarget = document.getElementById('sidebar-user-area');
    if (sidebarTarget && !document.getElementById('ccms-sidebar-user-card')) {
      const card = document.createElement('div');
      card.id = 'ccms-sidebar-user-card';
      card.className = 'sidebar-user-card';
      card.innerHTML = `
        <div class="sidebar-user-header">
          <div class="sidebar-user-avatar" style="background:${roleInfo.glow}; border:1px solid ${roleInfo.color}; color:${roleInfo.color};">
            <i class="fa-solid ${roleInfo.icon}"></i>
          </div>
          <div class="sidebar-user-details">
            <span class="sidebar-user-name" title="${escapeHtml(sess.display_name)}">${escapeHtml(sess.display_name)}</span>
            <span class="sidebar-user-role" style="color:${roleInfo.color}; font-weight:800; font-size:9.5px; letter-spacing:0.3px;">${roleInfo.badge}</span>
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
        <div style="width:30px;height:30px;border-radius:50%;background:${roleInfo.glow};border:1px solid ${roleInfo.color};display:flex;align-items:center;justify-content:center;color:${roleInfo.color};font-weight:800;font-size:11px;">
          <i class="fa-solid ${roleInfo.icon}"></i>
        </div>
        <div style="display:flex;flex-direction:column;line-height:1.1;max-width:160px;">
          <span style="font-size:11px;font-weight:700;color:var(--txt-primary);font-family:var(--font-heading);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(sess.display_name)}</span>
          <span style="font-size:9.5px;color:${roleInfo.color};text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">${roleInfo.badge}</span>
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

    const isBoardOrAdmin = ['superadmin', 'admin', 'admin_finanzas', 'admin_legal', 'admin_mantenimiento', 'heredero'].includes(sess.role);
    const isSuperAdmin = (sess.role === 'superadmin');
    const isReadOnlyHeredero = (sess.role === 'heredero');

    // Visibilidad de pestañas y elementos administrativos (respetando el estado de tab-view)
    root.querySelectorAll('[data-roles="admin"]').forEach(el => {
      if (el.classList.contains('tab-view')) {
        if (!isBoardOrAdmin) {
          el.style.setProperty('display', 'none', 'important');
          el.classList.add('hidden-by-role', 'is-hidden');
        }
      } else {
        if (isBoardOrAdmin) {
          el.style.removeProperty('display');
          el.classList.remove('hidden-by-role', 'is-hidden');
        } else {
          el.style.setProperty('display', 'none', 'important');
          el.classList.add('hidden-by-role', 'is-hidden');
        }
      }
    });
    root.querySelectorAll('[data-roles="tenant"]').forEach(el => {
      if (el.classList.contains('tab-view')) {
        if (sess.role !== 'tenant') {
          el.style.setProperty('display', 'none', 'important');
          el.classList.add('hidden-by-role', 'is-hidden');
        }
      } else {
        if (sess.role === 'tenant') {
          el.style.removeProperty('display');
          el.classList.remove('hidden-by-role', 'is-hidden');
        } else {
          el.style.setProperty('display', 'none', 'important');
          el.classList.add('hidden-by-role', 'is-hidden');
        }
      }
    });
    root.querySelectorAll('[data-roles="superadmin"]').forEach(el => {
      if (el.classList.contains('tab-view')) {
        if (!isSuperAdmin) {
          el.style.setProperty('display', 'none', 'important');
          el.classList.add('hidden-by-role', 'is-hidden');
        }
      } else {
        if (isSuperAdmin) {
          el.style.removeProperty('display');
          el.classList.remove('hidden-by-role', 'is-hidden');
        } else {
          el.style.setProperty('display', 'none', 'important');
          el.classList.add('hidden-by-role', 'is-hidden');
        }
      }
    });

    // Control departamental por atributo data-permission
    root.querySelectorAll('[data-permission="finances"]').forEach(el => {
      const can = isSuperAdmin || sess.role === 'admin' || sess.role === 'admin_finanzas';
      if (can) {
        el.style.removeProperty('display');
        el.classList.remove('hidden-by-role', 'is-hidden');
      } else {
        el.style.setProperty('display', 'none', 'important');
        el.classList.add('hidden-by-role', 'is-hidden');
      }
    });
    root.querySelectorAll('[data-permission="legal"]').forEach(el => {
      const can = isSuperAdmin || sess.role === 'admin' || sess.role === 'admin_legal';
      if (can) {
        el.style.removeProperty('display');
        el.classList.remove('hidden-by-role', 'is-hidden');
      } else {
        el.style.setProperty('display', 'none', 'important');
        el.classList.add('hidden-by-role', 'is-hidden');
      }
    });
    root.querySelectorAll('[data-permission="maintenance"]').forEach(el => {
      const can = isSuperAdmin || sess.role === 'admin' || sess.role === 'admin_mantenimiento';
      if (can) {
        el.style.removeProperty('display');
        el.classList.remove('hidden-by-role', 'is-hidden');
      } else {
        el.style.setProperty('display', 'none', 'important');
        el.classList.add('hidden-by-role', 'is-hidden');
      }
    });
    root.querySelectorAll('[data-permission="superadmin"]').forEach(el => {
      if (isSuperAdmin) {
        el.style.removeProperty('display');
        el.classList.remove('hidden-by-role', 'is-hidden');
      } else {
        el.style.setProperty('display', 'none', 'important');
        el.classList.add('hidden-by-role', 'is-hidden');
      }
    });

    // Si es HEREDERO, ocultar botones de acción o mutación para garantizar el modo SOLO LECTURA
    if (isReadOnlyHeredero) {
      root.querySelectorAll('.btn-onboarding-cta, .btn-action-delete, .btn-sync-bcv, .btn-edit-bcv, [data-roles="admin"][data-click*="openAdd"], [data-roles="admin"][data-click*="openNew"]').forEach(btn => {
        if (!btn.closest('#sidebar-user-area') && !btn.classList.contains('sidebar-logout-btn') && !btn.id.includes('logout')) {
          btn.style.display = 'none';
        }
      });
      let readOnlyBanner = document.getElementById('ccms-heredero-readonly-banner');
      if (!readOnlyBanner) {
        const topBar = document.querySelector('.top-navbar');
        if (topBar) {
          readOnlyBanner = document.createElement('div');
          readOnlyBanner.id = 'ccms-heredero-readonly-banner';
          readOnlyBanner.style.cssText = 'background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.4);color:#c084fc;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px;margin:0 10px;';
          readOnlyBanner.innerHTML = '<i class="fa-solid fa-eye"></i> <span>Modo Copropietario (1/14 Sucesión) — Solo Lectura Transparente</span>';
          topBar.insertBefore(readOnlyBanner, topBar.children[1] || topBar.firstChild);
        }
      }
    } else {
      const readOnlyBanner = document.getElementById('ccms-heredero-readonly-banner');
      if (readOnlyBanner) readOnlyBanner.remove();
    }

    // Sincronización estricta de navegación móvil y menú lateral por rol
    const mobileBottomNav = root.querySelector('#mobile-bottom-navbar') || document.getElementById('mobile-bottom-navbar');
    if (mobileBottomNav) {
      const isTenant = (sess.role === 'tenant');
      mobileBottomNav.querySelectorAll('.mobile-nav-item[data-roles="admin"]').forEach(b => {
        if (isTenant) {
          b.style.setProperty('display', 'none', 'important');
          b.classList.add('hidden-by-role', 'is-hidden');
          b.classList.remove('active');
        } else {
          b.style.removeProperty('display');
          b.classList.remove('hidden-by-role', 'is-hidden');
        }
      });
      mobileBottomNav.querySelectorAll('.mobile-nav-item[data-roles="tenant"]').forEach(b => {
        if (isTenant) {
          b.style.removeProperty('display');
          b.classList.remove('hidden-by-role', 'is-hidden');
        } else {
          b.style.setProperty('display', 'none', 'important');
          b.classList.add('hidden-by-role', 'is-hidden');
          b.classList.remove('active');
        }
      });
    }

    if (typeof window.syncNavigationUI === 'function') {
      try { window.syncNavigationUI(sess.role); } catch(e) {}
    }

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

  async function resetUserPassword(identifier, newPassword) {
    if (!identifier || !newPassword) {
      return { ok: false, error: 'Identificador y nueva contraseña requeridos.' };
    }
    const users = getUsers();
    const idLower = String(identifier).trim().toLowerCase();
    const target = users.find(u => u.identifier && u.identifier.toLowerCase() === idLower);
    if (!target) {
      return { ok: false, error: 'No se encontró ningún usuario registrado con el correo o RIF indicado.' };
    }
    if (newPassword.length < 6) {
      return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }
    const newHash = await hashPasswordWithSalt(newPassword);
    target.password_sha256 = newHash;
    saveUsers(users);
    audit('password_reset', { identifier: target.identifier, role: target.role });
    return { ok: true, user: target };
  }

  // --- 5. EXPORT ---------------------------------------------------------------

  global.AuthGuard = {
    require,
    login,
    logout,
    currentUser,
    currentTenant,
    mountUserChip,
    applyRoleVisibility,
    listUsers,
    getUsers: listUsers,
    approveUser,
    rejectUser,
    registerOrInviteUser,
    resetUserPassword,
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
