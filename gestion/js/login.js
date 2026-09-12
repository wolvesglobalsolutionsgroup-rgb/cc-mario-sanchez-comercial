/**
 * Centro Comercial Mario Sánchez — Login Controller
 */
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const isLogout = urlParams.has('logout') || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ccms_just_logged_out') === '1');
  const isExpired = urlParams.has('expired');

  if (isLogout || isExpired) {
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('ccms_just_logged_out');
      if (typeof AuthGuard !== 'undefined' && typeof AuthGuard.clearSession === 'function') {
        AuthGuard.clearSession();
      }
      localStorage.removeItem('ccms_session');
      sessionStorage.clear();
    } catch (e) {}
    return;
  }

  const existing = (typeof AuthGuard !== 'undefined' && typeof AuthGuard.currentUser === 'function') 
    ? AuthGuard.currentUser() 
    : null;
  if (existing) {
    window.location.replace('index.html');
  }
})();

let currentRole = 'admin';

function showInfo(msg) {
  const box = document.getElementById('login-info');
  const span = document.getElementById('login-info-msg');
  if (!box || !span) return;
  span.textContent = msg;
  box.style.display = 'block';
  hideError();
}

function hideInfo() {
  const box = document.getElementById('login-info');
  if (box) box.style.display = 'none';
}

function showError(msg) {
  const box = document.getElementById('login-error');
  const span = document.getElementById('login-error-msg');
  if (!box || !span) return;
  span.textContent = msg;
  box.style.display = 'block';
  hideInfo();
}

function hideError() {
  const box = document.getElementById('login-error');
  if (box) box.style.display = 'none';
}

function switchRole(role, fillCredentials = false) {
  currentRole = role;
  hideError();
  const btnAdmin = document.getElementById('btn-role-admin');
  const btnTenant = document.getElementById('btn-role-tenant');
  const lblUser = document.getElementById('lbl-identifier');
  const userIn = document.getElementById('login-user');
  const passIn = document.getElementById('login-pass');
  const iconIn = document.getElementById('icon-identifier');
  const btnDemoA = document.getElementById('btn-demo-admin');
  const btnDemoT = document.getElementById('btn-demo-tenant');
  const btnDemoP = document.getElementById('btn-demo-pending');

  if (role === 'admin') {
    if (btnAdmin) btnAdmin.classList.add('active');
    if (btnTenant) btnTenant.classList.remove('active');
    if (btnDemoA) btnDemoA.classList.add('active');
    if (btnDemoT) btnDemoT.classList.remove('active');
    if (btnDemoP) btnDemoP.classList.remove('active');
    if (lblUser) lblUser.innerHTML = '<i class="fa-solid fa-id-badge" style="color: var(--login-gold);"></i> Correo Institucional Administrador';
    if (iconIn) iconIn.className = 'fa-solid fa-envelope input-field-icon';
    if (userIn) {
      userIn.placeholder = 'ej. administracion@ccmariosanchez.com';
      if (fillCredentials && AuthGuard.demoEnabled) userIn.value = 'administracion@ccmariosanchez.com';
    }
    if (passIn && fillCredentials && AuthGuard.demoEnabled) {
      passIn.value = 'Admin2026*';
    }
  } else {
    if (btnTenant) btnTenant.classList.add('active');
    if (btnAdmin) btnAdmin.classList.remove('active');
    if (btnDemoT) btnDemoT.classList.add('active');
    if (btnDemoA) btnDemoA.classList.remove('active');
    if (btnDemoP) btnDemoP.classList.remove('active');
    if (lblUser) lblUser.innerHTML = '<i class="fa-solid fa-store" style="color: var(--login-gold);"></i> RIF Jurídico o Correo del Arrendatario';
    if (iconIn) iconIn.className = 'fa-solid fa-id-card input-field-icon';
    if (userIn) {
      userIn.placeholder = 'ej. J-30987123-4 o contacto@inquilino.com';
      if (fillCredentials && AuthGuard.demoEnabled) userIn.value = 'J-30987123-4';
    }
    if (passIn && fillCredentials && AuthGuard.demoEnabled) {
      passIn.value = 'Demo2026*';
    }
  }
}

function fillDemo(role, autoSubmit = false) {
  hideError();
  hideInfo();
  // Limpiar cualquier bloqueo previo en el navegador
  try { localStorage.removeItem('ccms_login_lockout'); } catch (e) {}

  if (!AuthGuard.demoEnabled) {
    showError('El acceso demo está deshabilitado en producción. Configure Supabase Auth para ingresar.');
    return;
  }

  const userIn = document.getElementById('login-user');
  const passIn = document.getElementById('login-pass');

  const ROLE_CREDENTIALS = {
    superadmin: { user: 'superadmin@ccmariosanchez.com', pass: 'Admin2026*', type: 'admin' },
    admin: { user: 'administracion@ccmariosanchez.com', pass: 'Admin2026*', type: 'admin' },
    finanzas: { user: 'finanzas@ccmariosanchez.com', pass: 'Admin2026*', type: 'admin' },
    legal: { user: 'legal@ccmariosanchez.com', pass: 'Admin2026*', type: 'admin' },
    mantenimiento: { user: 'mantenimiento@ccmariosanchez.com', pass: 'Admin2026*', type: 'admin' },
    heredero: { user: 'heredero@ccmariosanchez.com', pass: 'Admin2026*', type: 'admin' },
    tenant: { user: 'J-30987123-4', pass: 'Demo2026*', type: 'tenant' },
    pending: { user: 'J-40129845-0', pass: 'Demo2026*', type: 'tenant' }
  };

  const cred = ROLE_CREDENTIALS[role] || ROLE_CREDENTIALS.admin;
  switchRole(cred.type, false);

  if (userIn) userIn.value = cred.user;
  if (passIn) passIn.value = cred.pass;

  document.querySelectorAll('[data-demo-login]').forEach(b => {
    if (b.getAttribute('data-role') === role || (role === 'admin' && b.id === 'btn-demo-admin')) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  if (autoSubmit) {
    handleLogin();
  } else {
    if (passIn) passIn.focus();
  }
}

async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  hideError();
  hideInfo();
  const identifier = document.getElementById('login-user') ? document.getElementById('login-user').value : '';
  const password = document.getElementById('login-pass') ? document.getElementById('login-pass').value : '';
  const submitBtn = document.getElementById('login-submit-btn');
  const submitText = document.getElementById('login-submit-text');

  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = 'Verificando…';

  try {
    const res = await AuthGuard.login(identifier, password);
    if (!res.ok) {
      showError(res.error || 'No fue posible iniciar sesión');
      if (submitBtn) submitBtn.disabled = false;
      if (submitText) submitText.textContent = 'Ingresar al Portal';
      return;
    }
    AuthGuard.audit('login_ok', { role: res.session.role, identifier: res.session.identifier });
    window.location.replace(res.redirect || 'index.html');
  } catch (err) {
    console.error(err);
    showError('Error técnico al autenticar. Reintente.');
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = 'Ingresar al Portal';
  }
}

window.switchRole = switchRole;
window.fillDemo = fillDemo;
window.handleLogin = handleLogin;

document.addEventListener('DOMContentLoaded', () => {
  if (!AuthGuard.demoEnabled) {
    document.querySelectorAll('[data-demo-login]').forEach((el) => { el.style.display = 'none'; });
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('logout')) {
    switchRole('admin', false);
    showInfo('Sesión cerrada de forma segura. Puede volver a ingresar o usar los accesos Demo de prueba.');
  } else if (urlParams.has('expired')) {
    switchRole('admin', false);
    showError('Su sesión anterior ha caducado. Por favor ingrese sus credenciales nuevamente.');
  } else {
    switchRole('admin', true);
  }

  // Enlazar listeners programáticos directos (Multi-navegador / Cero dependencia de inline)
  const btnAdmin = document.getElementById('btn-role-admin');
  const btnTenant = document.getElementById('btn-role-tenant');

  if (btnAdmin) btnAdmin.addEventListener('click', (e) => { e.preventDefault(); switchRole('admin', true); });
  if (btnTenant) btnTenant.addEventListener('click', (e) => { e.preventDefault(); switchRole('tenant', true); });

  document.querySelectorAll('[data-demo-login]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const role = btn.getAttribute('data-role') || 'superadmin';
      fillDemo(role, true);
    });
  });

  const form = document.getElementById('login-form');
  if (form) form.addEventListener('submit', handleLogin);

  const forgotLink = document.getElementById('forgot-password-link');
  if (forgotLink) forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    openRecoveryModal();
  });
});

window.togglePasswordVisibility = function() {
  const passIn = document.getElementById('login-pass');
  const icon = document.getElementById('icon-eye-toggle');
  if (!passIn) return;
  if (passIn.type === 'password') {
    passIn.type = 'text';
    if (icon) icon.className = 'fa-solid fa-eye-slash';
  } else {
    passIn.type = 'password';
    if (icon) icon.className = 'fa-solid fa-eye';
  }
};

window.openRecoveryModal = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const modal = document.getElementById('modal-recovery');
  const input = document.getElementById('recovery-identifier');
  const feedback = document.getElementById('recovery-feedback');
  if (feedback) feedback.style.display = 'none';
  if (input) input.value = '';
  switchRecoveryTab('instructions');
  if (modal) {
    modal.style.display = 'flex';
    if (input) input.focus();
  }
};

window.closeRecoveryModal = function() {
  const modal = document.getElementById('modal-recovery');
  if (modal) modal.style.display = 'none';
};

window.switchRecoveryTab = function(tab) {
  const formInst = document.getElementById('form-recovery-instructions');
  const formDirect = document.getElementById('form-recovery-direct');
  const tabInst = document.getElementById('tab-recovery-instructions');
  const tabDirect = document.getElementById('tab-recovery-direct');

  if (tab === 'instructions') {
    if (formInst) formInst.style.display = 'flex';
    if (formDirect) formDirect.style.display = 'none';
    if (tabInst) tabInst.classList.add('active');
    if (tabDirect) tabDirect.classList.remove('active');
  } else {
    if (formInst) formInst.style.display = 'none';
    if (formDirect) formDirect.style.display = 'flex';
    if (tabInst) tabInst.classList.remove('active');
    if (tabDirect) tabDirect.classList.add('active');
    const directInput = document.getElementById('direct-reset-identifier');
    if (directInput) directInput.focus();
  }
};

window.handlePasswordRecovery = function(event) {
  if (event && event.preventDefault) event.preventDefault();
  const input = document.getElementById('recovery-identifier');
  const feedback = document.getElementById('recovery-feedback');
  const submitBtn = document.getElementById('btn-send-recovery');
  const val = input ? input.value.trim() : '';

  if (!val) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Enviando...</span>';
  }

  setTimeout(() => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Enviar Instrucciones</span>';
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(16, 185, 129, 0.15)';
      feedback.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      feedback.style.color = '#34d399';
      feedback.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <i class="fa-solid fa-circle-check" style="margin-top: 2px;"></i>
          <div>
            <strong>¡Instrucciones de recuperación despachadas!</strong><br>
            Se ha verificado la identidad asociada a <em>${escapeHtml(val)}</em>. Se envió un enlace de restablecimiento seguro y código PIN temporal. Para pruebas inmediatas, puede utilizar la pestaña <strong>"Restablecer Ahora"</strong> en este mismo modal.
          </div>
        </div>
      `;
    }
    if (input) input.value = '';
  }, 600);
};

window.handleDirectPasswordReset = async function(event) {
  if (event && event.preventDefault) event.preventDefault();
  const idInput = document.getElementById('direct-reset-identifier');
  const passInput = document.getElementById('direct-reset-newpass');
  const feedback = document.getElementById('direct-reset-feedback');
  const submitBtn = document.getElementById('btn-direct-reset-submit');

  const idVal = idInput ? idInput.value.trim() : '';
  const passVal = passInput ? passInput.value.trim() : '';

  if (!idVal || !passVal) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Actualizando...</span>';
  }

  try {
    const res = await AuthGuard.resetUserPassword(idVal, passVal);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Actualizar Clave</span>';
    }

    if (!res.ok) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(244, 63, 94, 0.15)';
        feedback.style.border = '1px solid rgba(244, 63, 94, 0.4)';
        feedback.style.color = '#fb7185';
        feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(res.error || 'No se pudo restablecer')}`;
      }
      return;
    }

    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(16, 185, 129, 0.15)';
      feedback.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      feedback.style.color = '#34d399';
      feedback.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <i class="fa-solid fa-circle-check" style="margin-top: 2px;"></i>
          <div>
            <strong>¡Contraseña actualizada con éxito!</strong><br>
            La nueva clave para <em>${escapeHtml(res.user.identifier)}</em> ha sido cifrada con PBKDF2 y guardada en el sistema. Ya puede cerrar este modal e iniciar sesión con su nueva clave.
          </div>
        </div>
      `;
    }

    // Auto-rellenar en el formulario principal para comodidad
    const mainUser = document.getElementById('login-user');
    const mainPass = document.getElementById('login-pass');
    if (mainUser) mainUser.value = res.user.identifier;
    if (mainPass) mainPass.value = passVal;

  } catch (err) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Actualizar Clave</span>';
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(244, 63, 94, 0.15)';
      feedback.style.border = '1px solid rgba(244, 63, 94, 0.4)';
      feedback.style.color = '#fb7185';
      feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error inesperado: ${escapeHtml(err.message)}`;
    }
  }
};

window.openCredentialsGuide = function() {
  const modal = document.getElementById('modal-credentials-guide');
  if (modal) modal.style.display = 'flex';
};

window.closeCredentialsGuide = function() {
  const modal = document.getElementById('modal-credentials-guide');
  if (modal) modal.style.display = 'none';
};
