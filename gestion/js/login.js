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
  const btnDemoA = document.getElementById('btn-demo-admin');
  const btnDemoT = document.getElementById('btn-demo-tenant');
  const btnDemoP = document.getElementById('btn-demo-pending');

  if (role === 'admin') {
    if (btnAdmin) btnAdmin.classList.add('active');
    if (btnTenant) btnTenant.classList.remove('active');
    if (btnDemoA) btnDemoA.classList.add('active');
    if (btnDemoT) btnDemoT.classList.remove('active');
    if (btnDemoP) btnDemoP.classList.remove('active');
    if (lblUser) lblUser.innerText = 'Correo Electrónico Administrador';
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
    if (lblUser) lblUser.innerText = 'RIF Jurídico o Correo del Arrendatario';
    if (userIn) {
      userIn.placeholder = 'ej. J-30987123-4';
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
  const btnDemoA = document.getElementById('btn-demo-admin');
  const btnDemoT = document.getElementById('btn-demo-tenant');
  const btnDemoP = document.getElementById('btn-demo-pending');
  const userIn = document.getElementById('login-user');
  const passIn = document.getElementById('login-pass');

  if (role === 'pending') {
    switchRole('tenant', false);
    if (btnDemoP) btnDemoP.classList.add('active');
    if (btnDemoT) btnDemoT.classList.remove('active');
    if (btnDemoA) btnDemoA.classList.remove('active');
    if (userIn) userIn.value = 'J-40129845-0';
    if (passIn) passIn.value = 'Demo2026*';
  } else if (role === 'tenant') {
    switchRole('tenant', false);
    if (userIn) userIn.value = 'J-30987123-4';
    if (passIn) passIn.value = 'Demo2026*';
  } else {
    switchRole('admin', false);
    if (userIn) userIn.value = 'administracion@ccmariosanchez.com';
    if (passIn) passIn.value = 'Admin2026*';
  }

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
  const btnDemoA = document.getElementById('btn-demo-admin');
  const btnDemoT = document.getElementById('btn-demo-tenant');
  const btnDemoP = document.getElementById('btn-demo-pending');

  if (btnAdmin) btnAdmin.addEventListener('click', (e) => { e.preventDefault(); switchRole('admin', true); });
  if (btnTenant) btnTenant.addEventListener('click', (e) => { e.preventDefault(); switchRole('tenant', true); });
  if (btnDemoA) btnDemoA.addEventListener('click', (e) => { e.preventDefault(); fillDemo('admin', true); });
  if (btnDemoT) btnDemoT.addEventListener('click', (e) => { e.preventDefault(); fillDemo('tenant', true); });
  if (btnDemoP) btnDemoP.addEventListener('click', (e) => { e.preventDefault(); fillDemo('pending', true); });

  const form = document.getElementById('login-form');
  if (form) form.addEventListener('submit', handleLogin);

  const forgotLink = document.getElementById('forgot-password-link');
  if (forgotLink) forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Contacte al Administrador Principal para restablecer credenciales.');
  });
});
