/**
 * Centro Comercial Mario Sánchez — Login Controller
 */
(function() {
  const existing = AuthGuard.currentUser();
  if (existing) {
    const u = new URL(window.location.href);
    if (u.searchParams.get('expired')) {
      u.searchParams.delete('expired');
      window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash);
    } else {
      window.location.replace('index.html');
    }
  }
})();

let currentRole = 'admin';

function switchRole(role) {
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
      if (AuthGuard.demoEnabled) userIn.value = 'administracion@ccmariosanchez.com';
    }
    if (passIn && AuthGuard.demoEnabled) {
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
      if (AuthGuard.demoEnabled) userIn.value = 'J-30987123-4';
    }
    if (passIn && AuthGuard.demoEnabled) {
      passIn.value = 'Demo2026*';
    }
  }
}

function fillDemo(role, autoSubmit = false) {
  hideError();
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
    switchRole('tenant');
    if (btnDemoP) btnDemoP.classList.add('active');
    if (btnDemoT) btnDemoT.classList.remove('active');
    if (btnDemoA) btnDemoA.classList.remove('active');
    if (userIn) userIn.value = 'J-40129845-0';
    if (passIn) passIn.value = 'Demo2026*';
  } else if (role === 'tenant') {
    switchRole('tenant');
    if (userIn) userIn.value = 'J-30987123-4';
    if (passIn) passIn.value = 'Demo2026*';
  } else {
    switchRole('admin');
    if (userIn) userIn.value = 'administracion@ccmariosanchez.com';
    if (passIn) passIn.value = 'Admin2026*';
  }

  if (autoSubmit) {
    handleLogin();
  } else {
    if (passIn) passIn.focus();
  }
}

function showError(msg) {
  const box = document.getElementById('login-error');
  const span = document.getElementById('login-error-msg');
  if (!box || !span) return;
  span.textContent = msg;
  box.style.display = 'block';
}

function hideError() {
  const box = document.getElementById('login-error');
  if (box) box.style.display = 'none';
}

async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  hideError();
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
  switchRole('admin');

  // Enlazar listeners programáticos directos (Multi-navegador / Cero dependencia de inline)
  const btnAdmin = document.getElementById('btn-role-admin');
  const btnTenant = document.getElementById('btn-role-tenant');
  const btnDemoA = document.getElementById('btn-demo-admin');
  const btnDemoT = document.getElementById('btn-demo-tenant');
  const btnDemoP = document.getElementById('btn-demo-pending');

  if (btnAdmin) btnAdmin.addEventListener('click', (e) => { e.preventDefault(); switchRole('admin'); });
  if (btnTenant) btnTenant.addEventListener('click', (e) => { e.preventDefault(); switchRole('tenant'); });
  if (btnDemoA) btnDemoA.addEventListener('click', (e) => { e.preventDefault(); fillDemo('admin', true); });
  if (btnDemoT) btnDemoT.addEventListener('click', (e) => { e.preventDefault(); fillDemo('tenant', true); });
  if (btnDemoP) btnDemoP.addEventListener('click', (e) => { e.preventDefault(); fillDemo('pending', true); });
});
