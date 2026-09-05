/**
 * Centro Comercial Mario Sánchez — Onboarding Wizard Controller
 */

// El wizard de onboarding es solo-admin
(function() {
  if (typeof AuthGuard !== 'undefined') {
    const sess = AuthGuard.require('admin');
    if (!sess) return;
    document.addEventListener('DOMContentLoaded', function() {
      AuthGuard.mountUserChip();
    });
  }
})();

let currentStep = 1;
const units = (typeof dbService !== 'undefined' && dbService.getUnits) ? dbService.getUnits() : [];

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('ob-unit-select');
  if (!select) return;
  const urlParams = new URLSearchParams(window.location.search);
  const targetUnit = urlParams.get('unit');

  units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.code;
    opt.innerText = `${u.code} — ${u.name} (${u.area_m2} m²) [${u.status.toUpperCase()}]`;
    if (targetUnit && u.code === targetUnit) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = updateUnitPreview;
  updateUnitPreview();
});

function updateUnitPreview() {
  const select = document.getElementById('ob-unit-select');
  if (!select) return;
  const code = select.value;
  const u = units.find(x => x.code === code) || units[0];
  if (!u) return;

  const prevName = document.getElementById('prev-unit-name');
  const prevCat = document.getElementById('prev-unit-cat');
  const prevArea = document.getElementById('prev-unit-area');
  const prevRent = document.getElementById('prev-unit-rent');
  const rentUsd = document.getElementById('ob-rent-usd');

  if (prevName) prevName.innerText = `${u.code}: ${u.name}`;
  if (prevCat) prevCat.innerText = u.category;
  if (prevArea) prevArea.innerText = `${u.area_m2.toLocaleString()} m²`;
  if (prevRent) prevRent.innerText = `$ ${u.base_rent_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD/mes`;

  if (rentUsd) rentUsd.value = u.base_rent_usd;
  updateDepositCalc();
}

function updateDepositCalc() {
  const rentEl = document.getElementById('ob-rent-usd');
  const monthsEl = document.getElementById('ob-deposit-months');
  const depEl = document.getElementById('ob-deposit-usd');
  const rent = rentEl ? (parseFloat(rentEl.value) || 0) : 0;
  const months = monthsEl ? (parseInt(monthsEl.value) || 3) : 3;
  if (depEl) depEl.value = (rent * months).toFixed(2);
}

function goToStep(step) {
  if (step === 2) {
    // Validate step 1
  } else if (step === 3) {
    const name = document.getElementById('ob-business-name') ? document.getElementById('ob-business-name').value.trim() : '';
    const rif = document.getElementById('ob-rif') ? document.getElementById('ob-rif').value.trim() : '';
    const rep = document.getElementById('ob-rep-name') ? document.getElementById('ob-rep-name').value.trim() : '';
    if (!name || !rif || !rep) {
      alert('Por favor complete los campos obligatorios del Arrendatario (Razón Social, RIF y Representante Legal).');
      return;
    }
  } else if (step === 4) {
    updateSummary();
  }

  currentStep = step;
  document.querySelectorAll('.step-pane').forEach((p, idx) => {
    p.classList.toggle('active', idx + 1 === step);
  });
  document.querySelectorAll('.step-item').forEach((s, idx) => {
    s.classList.toggle('active', idx + 1 === step);
    s.classList.toggle('completed', idx + 1 < step);
  });
}

function updateSummary() {
  const sumBiz = document.getElementById('sum-business');
  const sumRif = document.getElementById('sum-rif');
  const sumRep = document.getElementById('sum-rep');
  const sumUnit = document.getElementById('sum-unit');
  const sumRent = document.getElementById('sum-rent');
  const sumDep = document.getElementById('sum-deposit');
  const sumDates = document.getElementById('sum-dates');

  if (sumBiz) sumBiz.innerText = document.getElementById('ob-business-name')?.value || '';
  if (sumRif) sumRif.innerText = document.getElementById('ob-rif')?.value || '';
  if (sumRep) sumRep.innerText = `${document.getElementById('ob-rep-name')?.value || ''} (${document.getElementById('ob-rep-dni')?.value || ''})`;
  if (sumUnit) sumUnit.innerText = document.getElementById('ob-unit-select')?.value || '';
  if (sumRent) sumRent.innerText = parseFloat(document.getElementById('ob-rent-usd')?.value || '0').toLocaleString();
  if (sumDep) sumDep.innerText = parseFloat(document.getElementById('ob-deposit-usd')?.value || '0').toLocaleString();
  if (sumDates) sumDates.innerText = `${document.getElementById('ob-start-date')?.value || ''} al ${document.getElementById('ob-end-date')?.value || ''}`;
}

function submitOnboarding() {
  const tenantData = {
    rif: document.getElementById('ob-rif')?.value.trim() || '',
    business_name: document.getElementById('ob-business-name')?.value.trim() || '',
    trade_name: document.getElementById('ob-trade-name')?.value.trim() || '',
    commercial_registry: document.getElementById('ob-registry')?.value.trim() || '',
    legal_rep_name: document.getElementById('ob-rep-name')?.value.trim() || '',
    legal_rep_dni: document.getElementById('ob-rep-dni')?.value.trim() || '',
    email: document.getElementById('ob-email')?.value.trim() || '',
    phone: document.getElementById('ob-whatsapp')?.value.trim() || '',
    whatsapp: document.getElementById('ob-whatsapp')?.value.trim() || '',
    commercial_activity: document.getElementById('ob-activity')?.value.trim() || '',
    unit_code: document.getElementById('ob-unit-select')?.value || ''
  };

  const contractData = {
    start_date: document.getElementById('ob-start-date')?.value || '',
    end_date: document.getElementById('ob-end-date')?.value || '',
    rent_usd: document.getElementById('ob-rent-usd')?.value || '0',
    rent_method: document.getElementById('ob-rent-method')?.value || '',
    deposit_usd: document.getElementById('ob-deposit-usd')?.value || '0',
    deposit_months: document.getElementById('ob-deposit-months')?.value || '3'
  };

  try {
    dbService.addTenant(tenantData, contractData);
    alert('¡Inquilino y Contrato registrados exitosamente en el sistema!');
    window.location.href = 'index.html';
  } catch (err) {
    alert('Error al registrar: ' + err.message);
  }
}

window.goToStep = goToStep;
window.updateUnitPreview = updateUnitPreview;
window.updateDepositCalc = updateDepositCalc;
window.submitOnboarding = submitOnboarding;
