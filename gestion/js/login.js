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
  const btnAdmin = document.getElementById('btn-role-admin');
  const btnTenant = document.getElementById('btn-role-tenant');
  const lblUser = document.getElementById('lbl-identifier');
  const btnDemoA = document.getElementById('btn-demo-admin');
  const btnDemoT = document.getElementById('btn-demo-tenant');

  if (role === 'admin') {
    if (btnAdmin) btnAdmin.classList.add('active');
    if (btnTenant) btnTenant.classList.remove('active');
    if (btnDemoA) btnDemoA.classList.add('active');
    if (btnDemoT) btnDemoT.classList.remove('active');
    if (lblUser) lblUser.innerText = 'Correo Electrónico Administrador';
  } else {
    if (btnTenant) btnTenant.classList.add('active');
    if (btnAdmin) btnAdmin.classList.remove('active');
    if (btnDemoT) btnDemoT.classList.add('active');
    if (btnDemoA) btnDemoA.classList.remove('active');
    if (lblUser) lblUser.innerText = 'RIF Jurídico o Correo del Arrendatario';
  }
}

function fillDemo(role) {
  if (!AuthGuard.demoEnabled) {
    showError('El acceso demo está deshabilitado en producción. Configure Supabase Auth para ingresar.');
    return;
  }
  if (role === 'pending') {
    switchRole('tenant');
    const userIn = document.getElementById('login-user');
    const passIn = document.getElementById('login-pass');
    if (userIn) userIn.value = 'J-40129845-0';
    if (passIn) passIn.value = 'Demo2026*';
  } else {
    switchRole(role);
    const userIn = document.getElementById('login-user');
    const passIn = document.getElementById('login-pass');
    if (userIn) userIn.value = role === 'admin' ? 'administracion@ccmariosanchez.com' : 'J-30987123-4';
    if (passIn) passIn.value = role === 'admin' ? 'Admin2026*' : 'Demo2026*';
  }
  const passIn = document.getElementById('login-pass');
  if (passIn) passIn.focus();
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
});
