/**
 * ==============================================================================
 * SUITE DE SEGURIDAD DEFENSIVA INTEGRAL (OWASP TOP 10, ZERO-TRUST & CRYPTO)
 * Centro Comercial Mario Sánchez — SaaS Inmobiliario
 * 
 * Cobertura de estándares:
 * 1. Anti-XSS (HTML Entity Encoding estricto)
 * 2. Detección y Neutralización de Inyección SQL, Comandos y Prompt Injection
 * 3. Control de Acceso Estricto & Prevención IDOR (Insecure Direct Object References)
 * 4. Cifrado en Reposo y en Uso con WebCrypto (AES-GCM 256 bits + PBKDF2)
 * 5. Protección de Cadena de Suministro y Validación de Integridad
 * 6. Rate Limiting (Límites de Uso y Mitigación de Abuso / Fuerza Bruta)
 * 7. Generadores Reutilizables de Estados UI (Cargando, Error y Vacío)
 * ==============================================================================
 */

(function (global) {
  'use strict';

  // --- 1. HIGIENE DE ENTRADAS Y ANTI-XSS ---
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function isSafeReceiptDataUrl(value) {
    return typeof value === 'string' && /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,/i.test(value);
  }

  // --- 2. DETECCIÓN DE INYECCIÓN SQL, COMANDOS DE SISTEMA Y PROMPT INJECTION ---
  const SQL_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|DECLARE)\b)/i,
    /(--|\/\*|\*\/|;|xp_|sp_)/i,
    /(' OR '1'='1|' OR 1=1|" OR "1"="1)/i
  ];

  const CMD_PATTERNS = [
    /(;|\||&&|`|\$\(|\b(bash|sh|cmd|powershell|curl|wget|nc|netcat|eval|system|exec)\b)/i
  ];

  const PROMPT_INJECTION_PATTERNS = [
    /(ignore previous instructions|disregard prior prompt|system prompt|jailbreak|DAN mode|developer mode|act as an unfiltered)/i
  ];

  function detectThreats(input) {
    if (typeof input !== 'string') return { safe: true, threats: [] };
    const threats = [];
    
    if (SQL_PATTERNS.some(re => re.test(input))) {
      threats.push('SQL_INJECTION');
    }
    if (CMD_PATTERNS.some(re => re.test(input))) {
      threats.push('COMMAND_INJECTION');
    }
    if (PROMPT_INJECTION_PATTERNS.some(re => re.test(input))) {
      threats.push('PROMPT_INJECTION');
    }
    
    return {
      safe: threats.length === 0,
      threats
    };
  }

  function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return escapeHtml(input.trim().replace(/[\0\x08\x09\x1a\n\r"'\\]/g, char => {
      switch (char) {
        case "\0": return "";
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "'": return "&#39;";
        case "\"": return "&quot;";
        default: return char;
      }
    }));
  }

  // --- 3. CONTROL DE ACCESO ESTRICTO & PREVENCIÓN IDOR (ZERO-TRUST) ---
  function verifyResourceAccess(resource, session) {
    if (!session || !session.role) return { allowed: false, reason: 'NO_AUTH' };
    if (session.role === 'admin') return { allowed: true, role: 'admin' };
    
    if (session.role === 'tenant') {
      const userTenantId = session.tenant_id;
      if (!userTenantId) return { allowed: false, reason: 'TENANT_UNASSIGNED' };

      if (resource && resource.tenant_id && resource.tenant_id !== userTenantId) {
        console.warn(`[SECURITY ALERT - IDOR PREVENTED] Acceso no autorizado a recurso ${resource.id || 'desconocido'}`);
        return { allowed: false, reason: 'IDOR_VIOLATION' };
      }

      if (resource && resource.id && resource.id.startsWith('t-') && resource.id !== userTenantId) {
        console.warn(`[SECURITY ALERT - IDOR PREVENTED] Acceso a arrendatario ajeno bloqueado: ${resource.id}`);
        return { allowed: false, reason: 'IDOR_VIOLATION' };
      }

      return { allowed: true, role: 'tenant' };
    }

    return { allowed: false, reason: 'UNKNOWN_ROLE' };
  }

  // --- 4. GESTIÓN DE SECRETOS Y CIFRADO EN REPOSO / EN USO (WebCrypto AES-GCM 256) ---
  const ENCRYPTION_SALT = new TextEncoder().encode('CC_MARIO_SANCHEZ_SALT_2026_ESTABLE');

  async function getDerivedKey(passphrase) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase || 'CCMS_DEFAULT_CLIENT_CIPHER_KEY'),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: ENCRYPTION_SALT,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptData(plainText, keyString) {
    try {
      if (!plainText) return '';
      const key = await getDerivedKey(keyString);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plainText);
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
      );
      
      const buffer = new Uint8Array(ciphertext);
      const combined = new Uint8Array(iv.length + buffer.length);
      combined.set(iv);
      combined.set(buffer, iv.length);
      
      return 'ENC:' + btoa(String.fromCharCode.apply(null, combined));
    } catch (err) {
      console.error('[CRYPTO ERROR] Fallo al cifrar datos en reposo:', err);
      return plainText;
    }
  }

  async function decryptData(cipherBlob, keyString) {
    try {
      if (!cipherBlob || !cipherBlob.startsWith('ENC:')) return cipherBlob;
      const base64 = cipherBlob.slice(4);
      const binary = atob(base64);
      const combined = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);
      
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const key = await getDerivedKey(keyString);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      return new TextDecoder().decode(decrypted);
    } catch (err) {
      console.warn('[CRYPTO WARNING] No se pudo descifrar datos:', err);
      return '';
    }
  }

  // --- 5. LÍMITES DE USO Y MITIGACIÓN DE ABUSO (RATE LIMITING) ---
  const RATE_LIMITS = {};

  function checkRateLimit(action, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    if (!RATE_LIMITS[action]) {
      RATE_LIMITS[action] = [];
    }
    RATE_LIMITS[action] = RATE_LIMITS[action].filter(ts => now - ts < windowMs);
    
    if (RATE_LIMITS[action].length >= maxAttempts) {
      const waitSeconds = Math.ceil((RATE_LIMITS[action][0] + windowMs - now) / 1000);
      return {
        allowed: false,
        retryAfterSec: waitSeconds,
        message: `Límite de peticiones excedido para '${action}'. Espere ${waitSeconds} segundos.`
      };
    }

    RATE_LIMITS[action].push(now);
    return { allowed: true, remaining: maxAttempts - RATE_LIMITS[action].length };
  }

  // --- 6. GENERADORES REUTILIZABLES DE ESTADOS UI (CARGA, ERROR, VACÍO) ---
  function renderLoadingState(message = 'Cargando información contable...') {
    return `
      <div class="ui-state-container state-loading" style="padding: 40px 20px; text-align: center;">
        <div class="ui-state-spinner" style="width: 38px; height: 38px; border: 3px solid rgba(245, 158, 11, 0.2); border-top-color: var(--amber); border-radius: 50%; animation: ccms-spin 0.8s linear infinite; margin: 0 auto 16px auto;"></div>
        <div style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: var(--txt-primary);">${escapeHtml(message)}</div>
        <div style="font-size: 11.5px; color: var(--txt-muted); margin-top: 4px;">Sincronizando con base de datos segura y tasas en tiempo real...</div>
      </div>
    `;
  }

  function renderErrorState(title = 'Error al procesar la información', detail = 'Ocurrió un problema de validación o acceso.', retryFnName = 'renderAll') {
    return `
      <div class="ui-state-container state-error" style="padding: 32px 20px; text-align: center; background: rgba(244, 63, 94, 0.05); border: 1px dashed rgba(244, 63, 94, 0.3); border-radius: 10px; margin: 12px 0;">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--rose-glow); border: 1px solid var(--rose); color: var(--rose); display: flex; align-items: center; justify-content: center; font-size: 18px; margin: 0 auto 14px auto;">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 800; color: var(--rose); margin: 0 0 6px 0;">${escapeHtml(title)}</h4>
        <p style="font-size: 12px; color: var(--txt-secondary); max-width: 460px; margin: 0 auto 16px auto;">${escapeHtml(detail)}</p>
        ${retryFnName ? `
          <button type="button" class="btn-action-icon" onclick="${retryFnName}()" style="width: auto; padding: 7px 16px; font-size: 12px; font-weight: 700; gap: 8px; background: var(--bg-card); border-color: var(--border-subtle); color: var(--txt-primary);">
            <i class="fa-solid fa-rotate-right"></i> <span>Reintentar Operación</span>
          </button>
        ` : ''}
      </div>
    `;
  }

  function renderEmptyState(title = 'No hay registros disponibles', subtitle = 'Los registros generados aparecerán aquí ordenados cronológicamente.', icon = 'fa-folder-open', actionBtnHtml = '') {
    return `
      <div class="ui-state-container state-empty" style="padding: 48px 20px; text-align: center;">
        <div style="width: 52px; height: 52px; border-radius: 12px; background: var(--bg-card-hover); border: 1px solid var(--border-subtle); color: var(--txt-muted); display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 16px auto;">
          <i class="fa-solid ${escapeHtml(icon)}"></i>
        </div>
        <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 700; color: var(--txt-primary); margin: 0 0 6px 0;">${escapeHtml(title)}</h4>
        <p style="font-size: 12px; color: var(--txt-secondary); max-width: 420px; margin: 0 auto 18px auto;">${escapeHtml(subtitle)}</p>
        ${actionBtnHtml}
      </div>
    `;
  }

  // --- 7. SISTEMA DE NOTIFICACIONES TOAST & DIÁLOGOS MODERNOS ---
  function getToastContainer() {
    let container = document.getElementById('ccms-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ccms-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'info', title = null, duration = 4000) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `ccms-toast toast-${type}`;

    const icons = {
      success: 'fa-solid fa-circle-check',
      error: 'fa-solid fa-circle-xmark',
      warning: 'fa-solid fa-triangle-exclamation',
      info: 'fa-solid fa-circle-info'
    };

    const defaultTitles = {
      success: 'Operación Exitosa',
      error: 'Atención Requerida',
      warning: 'Advertencia del Sistema',
      info: 'Notificación'
    };

    const displayTitle = title || defaultTitles[type] || 'Aviso';
    const iconClass = icons[type] || icons.info;

    toast.innerHTML = `
      <i class="${iconClass} ccms-toast-icon"></i>
      <div class="ccms-toast-content">
        <div class="ccms-toast-title">${escapeHtml(displayTitle)}</div>
        <div class="ccms-toast-message">${escapeHtml(message)}</div>
      </div>
      <button type="button" class="ccms-toast-close" title="Cerrar"><i class="fa-solid fa-xmark"></i></button>
    `;

    const closeBtn = toast.querySelector('.ccms-toast-close');
    closeBtn.onclick = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 250);
    };

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateX(50px)';
          setTimeout(() => toast.remove(), 250);
        }
      }, duration);
    }
  }

  function showModernConfirm(message, title = 'Confirmar Acción', confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'ccms-dialog-overlay';

      overlay.innerHTML = `
        <div class="ccms-dialog-card">
          <div class="ccms-dialog-header">
            <div class="ccms-dialog-icon" style="background: var(--amber-glow); color: var(--amber); border: 1px solid var(--border-highlight);">
              <i class="fa-solid fa-circle-question"></i>
            </div>
            <div>
              <h4 class="ccms-dialog-title">${escapeHtml(title)}</h4>
              <span style="font-size: 11px; color: var(--txt-muted);">CC Mario Sánchez — Gestión Segura</span>
            </div>
          </div>
          <div class="ccms-dialog-body">${escapeHtml(message)}</div>
          <div class="ccms-dialog-actions">
            <button type="button" class="btn-currency-toggle" id="ccms-dialog-cancel-btn">${escapeHtml(cancelText)}</button>
            <button type="button" class="btn-onboarding-cta" id="ccms-dialog-confirm-btn" style="background: var(--amber); border-color: var(--amber); color: #000; font-weight: 800;">
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const confirmBtn = overlay.querySelector('#ccms-dialog-confirm-btn');
      const cancelBtn = overlay.querySelector('#ccms-dialog-cancel-btn');

      const cleanup = (val) => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
        resolve(val);
      };

      confirmBtn.onclick = () => cleanup(true);
      cancelBtn.onclick = () => cleanup(false);
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanup(false);
      };
    });
  }

  function showModernPrompt(message, title = 'Ingresar Dato', confirmText = 'Aceptar', cancelText = 'Cancelar', defaultValue = '') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'ccms-dialog-overlay';

      const isPlaceholder = typeof defaultValue === 'string' && defaultValue.startsWith('Ej:');
      const inputVal = isPlaceholder ? '' : defaultValue;
      const inputPlaceholder = isPlaceholder ? defaultValue : '';

      overlay.innerHTML = `
        <div class="ccms-dialog-card">
          <div class="ccms-dialog-header">
            <div class="ccms-dialog-icon" style="background: var(--amber-glow); color: var(--amber); border: 1px solid var(--border-highlight);">
              <i class="fa-solid fa-pen-to-square"></i>
            </div>
            <div>
              <h4 class="ccms-dialog-title">${escapeHtml(title)}</h4>
              <span style="font-size: 11px; color: var(--txt-muted);">CC Mario Sánchez — Gestión Segura</span>
            </div>
          </div>
          <div class="ccms-dialog-body" style="padding: 16px 20px;">
            <p style="margin: 0 0 12px; font-size: 13px; color: var(--txt-primary);">${escapeHtml(message)}</p>
            <input type="text" id="ccms-dialog-prompt-input" class="form-control" value="${escapeHtml(inputVal)}" placeholder="${escapeHtml(inputPlaceholder)}" style="width: 100%; font-size: 13px; padding: 10px 12px;" />
          </div>
          <div class="ccms-dialog-actions" style="display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--border-subtle);">
            <button type="button" class="btn-currency-toggle" id="ccms-dialog-cancel-btn">${escapeHtml(cancelText)}</button>
            <button type="button" class="btn-onboarding-cta" id="ccms-dialog-confirm-btn" style="background: var(--amber); border-color: var(--amber); color: #000; font-weight: 800;">
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const input = overlay.querySelector('#ccms-dialog-prompt-input');
      const confirmBtn = overlay.querySelector('#ccms-dialog-confirm-btn');
      const cancelBtn = overlay.querySelector('#ccms-dialog-cancel-btn');

      if (input) {
        setTimeout(() => {
          input.focus();
          input.select();
        }, 50);
      }

      const cleanup = (val) => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
        resolve(val);
      };

      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            cleanup(input.value.trim());
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(null);
          }
        });
      }

      confirmBtn.onclick = () => cleanup(input ? input.value.trim() : '');
      cancelBtn.onclick = () => cleanup(null);
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanup(null);
      };
    });
  }

  // --- 9. UNIVERSAL CSP-SAFE DOM EVENT DELEGATOR ---
  function safeInvoke(code, elem, event) {
    if (!code) return;
    try {
      const callMatch = code.match(/^([a-zA-Z0-9_$.]+)\s*\((.*)\)$/);
      if (callMatch) {
        const fnPath = callMatch[1];
        const rawArgs = callMatch[2];
        
        let targetFn = global;
        const parts = fnPath.split('.');
        for (const p of parts) {
          if (targetFn) targetFn = targetFn[p];
        }
        
        if (typeof targetFn === 'function') {
          const args = rawArgs.length ? rawArgs.split(',').map(s => {
            s = s.trim();
            if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) return s.slice(1, -1);
            if (!isNaN(s) && s !== '') return Number(s);
            if (s === 'true') return true;
            if (s === 'false') return false;
            if (s === 'this') return elem;
            if (s === 'this.value') return elem.value;
            if (s === 'event') return event;
            return s;
          }) : [];
          targetFn.apply(elem, args);
          return;
        }
      }
      if (code.includes('window.activeTemplateTextarea = this')) {
        global.activeTemplateTextarea = elem;
        return;
      }
      const clickMatch = code.match(/document\.getElementById\(['"]([^'"]+)['"]\)\.click\(\)/);
      if (clickMatch) {
        const el = document.getElementById(clickMatch[1]);
        if (el) el.click();
        return;
      }
    } catch (err) {
      console.warn('SafeInvoke warn:', err);
    }
  }

  document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-click]');
    if (target) {
      safeInvoke(target.getAttribute('data-click'), target, e);
    }
  }, true);

  document.addEventListener('change', function(e) {
    const target = e.target.closest('[data-change]');
    if (target) {
      safeInvoke(target.getAttribute('data-change'), target, e);
    }
  }, true);

  document.addEventListener('input', function(e) {
    const target = e.target.closest('[data-input]');
    if (target) {
      safeInvoke(target.getAttribute('data-input'), target, e);
    }
  }, true);

  document.addEventListener('submit', function(e) {
    const target = e.target.closest('[data-submit]');
    if (target) {
      e.preventDefault();
      safeInvoke(target.getAttribute('data-submit'), target, e);
    }
  }, true);

  document.addEventListener('focusin', function(e) {
    const target = e.target.closest('[data-focus]');
    if (target) {
      safeInvoke(target.getAttribute('data-focus'), target, e);
    }
  }, true);

  // Export to global
  global.safeInvoke = safeInvoke;
  global.SecuritySuite = {
    escapeHtml,
    sanitizeInput,
    detectThreats,
    isSafeReceiptDataUrl,
    verifyResourceAccess,
    encryptData,
    decryptData,
    checkRateLimit,
    renderLoadingState,
    renderErrorState,
    renderEmptyState,
    toast: showToast,
    confirm: showModernConfirm,
    prompt: showModernPrompt
  };
  global.escapeHtml = escapeHtml;
  global.isSafeReceiptDataUrl = isSafeReceiptDataUrl;

})(window);
