/**
 * Centro Comercial Mario Sánchez — Landing Page Interactive Engine
 * Wolves Global Solutions (c) 2026 Enterprise Architecture
 * Includes: Leaflet Map, Space Inspection Modal, Dynamic Simulator & Lead Intake
 */

// 0. Vercel Speed Insights Safe Activation
window.addEventListener('load', function() {
  if (window.injectSpeedInsights) {
    try { window.injectSpeedInsights(); } catch (e) { /* noop */ }
  }
});

// 1. Initial Leaflet Map inside Landing
let map = null;
const mapLayers = {};

function initLandingMap() {
  const mapEl = document.getElementById('interactive-map');
  if (!mapEl || typeof L === 'undefined') return;

  map = L.map('interactive-map', {
    center: [10.20468, -64.63290],
    zoom: 18,
    minZoom: 15,
    maxZoom: 21,
    zoomControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Google Satellite Layer
  L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 22,
    maxNativeZoom: 20,
    attribution: '© Google Earth'
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 350);
  window.addEventListener('resize', () => map && map.invalidateSize());

  // Render Polygons & Markers
  const polyGroup = L.layerGroup().addTo(map);

  spacesData.forEach(item => {
    const poly = L.polygon(item.coords, {
      color: item.color,
      weight: 2,
      fillColor: item.color,
      fillOpacity: item.status === 'Arrendado' ? 0.2 : 0.45
    }).addTo(polyGroup);

    const marker = L.marker(poly.getBounds().getCenter(), {
      icon: L.divIcon({
        className: 'map-pin-custom',
        html: `<button class="pin-pill" aria-label="Espacio ${item.id} - ${item.area}"><span>${item.id}</span> (${item.area})</button>`,
        iconSize: null
      })
    }).addTo(polyGroup);

    const selectAction = () => openDetailModal(item.id);
    poly.on('click', selectAction);
    marker.on('click', selectAction);

    mapLayers[item.id] = { poly, marker, data: item };
  });

  renderList(spacesData);
}

// 2. Spaces Catalog Data
const spacesData = [
  {
    id: "LOT-C01",
    name: "Macro-Lote C01 (Norte)",
    category: "macro-lotes",
    area: "1.730 m²",
    status: "Disponible",
    color: "#f59e0b",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Oeste (20.00 m) + Frente Norte (64.31 m)",
    power: "Trifásica 220V/440V Industrial",
    use: "Concesionario / Retail Mayorista / Showroom",
    desc: "Macro-Lote comercial transversal norte (1.730 m²). Dispone de 27,95 m de frente al Pasillo Oeste de gandolas (20 m) y 64,31 m de frente al Retiro de Clientes.",
    coords: [
      [10.2052798, -64.6330805],
      [10.2051530, -64.6325082],
      [10.2049191, -64.6325616],
      [10.2050319, -64.6331306]
    ]
  },
  {
    id: "LOT-C02",
    name: "Macro-Lote C02 (Medio)",
    category: "macro-lotes",
    area: "1.730 m²",
    status: "Disponible",
    color: "#0ea5e9",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Oeste (20.00 m) + Pasillo Este (23.80 m)",
    power: "Trifásica 220V/440V Industrial",
    use: "Patio Logístico / Galpón Modular / Almacén Seco",
    desc: "Macro-Lote central intermedio (1.730 m²). 27,95 m de frente a la Avenida de Servicio de 20 m y fondo este al pasillo de retorno de 23,80 m.",
    coords: [
      [10.2050319, -64.6331306],
      [10.2049191, -64.6325616],
      [10.2046851, -64.6326151],
      [10.2047841, -64.6331808]
    ]
  },
  {
    id: "LOT-C03",
    name: "Macro-Lote C03 (Sur)",
    category: "macro-lotes",
    area: "1.730 m²",
    status: "Disponible",
    color: "#c084fc",
    image: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Oeste (20.00 m) + Patio Sur (20.00 m)",
    power: "Industrial 440V con Transformador",
    use: "Taller Servicio Pesado / Patio Gandolas / Distribución",
    desc: "Macro-Lote sur (1.730 m²). Posee 27,96 m de frente al Pasillo Oeste y frente sur directo al Patio de Maniobras de 20 m frente a Repuestos de Oriente.",
    coords: [
      [10.2047841, -64.6331808],
      [10.2046851, -64.6326151],
      [10.2044512, -64.6326685],
      [10.2045362, -64.6332309]
    ]
  },
  {
    id: "LOC-N01",
    name: "Local Comercial Norte 01",
    category: "locales",
    area: "95 m²",
    status: "Disponible",
    color: "#10b981",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
    road: "Frente Norte a Av. Municipal (Retiro)",
    power: "Bifásica 110V/220V Comercial",
    use: "Cafetería / Boutique / Farmacia",
    desc: "Local comercial frontal con vitrina de cristal hacia el área de estacionamiento norte de clientes.",
    coords: [
      [10.20538, -64.63280],
      [10.20536, -64.63265],
      [10.20528, -64.63266],
      [10.20530, -64.63281]
    ]
  },
  {
    id: "LOC-N02",
    name: "Local Comercial Norte 02",
    category: "locales",
    area: "110 m²",
    status: "Disponible",
    color: "#10b981",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    road: "Frente Norte a Av. Municipal (Retiro)",
    power: "Trifásica 220V",
    use: "Minimarket / Consultorio / Retail",
    desc: "Excelente visibilidad peatonal y vehicular con 110 m² útiles y baño interno terminado.",
    coords: [
      [10.20536, -64.63265],
      [10.20534, -64.63250],
      [10.20526, -64.63251],
      [10.20528, -64.63266]
    ]
  },
  {
    id: "LOC-O04",
    name: "Local Showroom Oeste 04",
    category: "locales",
    area: "120 m²",
    status: "Disponible",
    color: "#0ea5e9",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Oeste (20.00 m)",
    power: "Trifásica 220V",
    use: "Venta de Repuestos / Taller Rápido",
    desc: "Módulo con acceso directo para carga y descarga en el pasillo principal oeste.",
    coords: [
      [10.20480, -64.63320],
      [10.20478, -64.63305],
      [10.20468, -64.63306],
      [10.20470, -64.63321]
    ]
  },
  {
    id: "GAL-01",
    name: "Galpón Repuestos de Oriente",
    category: "galpones",
    area: "850 m²",
    status: "Arrendado",
    color: "#f43f5e",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    road: "Patio Sur",
    power: "Trifásica 440V",
    use: "Distribución Automotriz (En Operación)",
    desc: "Galpón industrial actualmente operativo como centro de distribución automotriz de la empresa Repuestos de Oriente.",
    coords: [
      [10.20435, -64.63310],
      [10.20432, -64.63270],
      [10.20415, -64.63274],
      [10.20418, -64.63314]
    ]
  },
  {
    id: "DEP-E01",
    name: "Depósito Logístico Este 01",
    category: "galpones",
    area: "250 m²",
    status: "Disponible",
    color: "#a855f7",
    image: "https://images.unsplash.com/photo-1586528116493-a029325540fa?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Este (23.80 m)",
    power: "Trifásica 220V",
    use: "Almacén Seco / Montacargas",
    desc: "Almacén techado con piso de cemento pulido de alta resistencia para racks y montacargas.",
    coords: [
      [10.20495, -64.63235],
      [10.20493, -64.63225],
      [10.20465, -64.63230],
      [10.20467, -64.63240]
    ]
  },
  {
    id: "DEP-E02",
    name: "Depósito Comercial Este 02",
    category: "galpones",
    area: "180 m²",
    status: "Disponible",
    color: "#a855f7",
    image: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Este (23.80 m)",
    power: "Trifásica 220V",
    use: "Depósito de Encomiendas / Mercancía",
    desc: "Módulo de depósito cerrado para custodia de inventario de alto valor.",
    coords: [
      [10.20465, -64.63230],
      [10.20463, -64.63220],
      [10.20440, -64.63225],
      [10.20442, -64.63235]
    ]
  }
];

// 3. Render Cards in Side List
function renderList(items) {
  const listContainer = document.getElementById('spaces-list-box');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = `p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/50 cursor-pointer transition-all flex gap-3 items-center group`;
    card.id = `map-card-${item.id}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Consultar detalles de ${item.name}`);
    card.onclick = () => openDetailModal(item.id);
    card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') openDetailModal(item.id); };

    card.innerHTML = `
      <img src="${item.image}" alt="Vista previa de ${item.name}" loading="lazy" width="64" height="64" class="w-16 h-16 rounded-lg object-cover flex-shrink-0 group-hover:scale-105 transition-transform bg-slate-800">
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1">
          <span class="font-heading font-extrabold text-xs text-white truncate">${item.name}</span>
          <span class="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">${item.area}</span>
        </div>
        <p class="text-[11px] text-slate-300 truncate mt-0.5">${item.use}</p>
        <div class="flex items-center justify-between mt-1.5 pt-1.5 border-t border-white/5 text-[10.5px]">
          <span class="${item.status === 'Arrendado' ? 'text-rose-400' : 'text-emerald-400'} font-semibold">${item.status}</span>
          <span class="text-amber-400 font-bold group-hover:underline flex items-center gap-1">
            Ver Detalles <i class="fa-solid fa-arrow-right text-[9px]" aria-hidden="true"></i>
          </span>
        </div>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

// 4. Modal / Drawer de Detalles con Prevención de Distorsión y Cero Saltos
function openDetailModal(id) {
  const item = spacesData.find(s => s.id === id);
  if (!item) return;

  // Highlight on map smoothly without disruptive viewport jump
  Object.values(mapLayers).forEach(l => l.poly.setStyle({ weight: 2, fillOpacity: l.data.status === 'Arrendado' ? 0.2 : 0.45 }));
  if (mapLayers[id]) {
    mapLayers[id].poly.setStyle({ weight: 4.5, fillOpacity: 0.75, color: '#ffffff' });
    try {
      map.panTo(mapLayers[id].poly.getBounds().getCenter(), { animate: true, duration: 0.5 });
    } catch (e) {}
  }

  // Populate Modal
  const codeEl = document.getElementById('modal-code');
  const titleEl = document.getElementById('modal-title');
  const imgEl = document.getElementById('modal-img');
  const areaEl = document.getElementById('modal-area');
  const statusEl = document.getElementById('modal-status');
  const powerEl = document.getElementById('modal-power');
  const roadEl = document.getElementById('modal-road');
  const descEl = document.getElementById('modal-desc');
  const waBtn = document.getElementById('modal-wa-btn');

  if (codeEl) codeEl.innerText = item.id;
  if (titleEl) titleEl.innerText = item.name;
  if (imgEl) {
    imgEl.src = item.image;
    imgEl.alt = item.name;
  }
  if (areaEl) areaEl.innerText = item.area;
  if (statusEl) {
    statusEl.innerText = item.status;
    statusEl.className = item.status === 'Arrendado' ? 'text-rose-400 font-heading text-sm' : 'text-emerald-400 font-heading text-sm';
  }
  if (powerEl) powerEl.innerText = item.power;
  if (roadEl) roadEl.innerText = item.road;
  if (descEl) descEl.innerText = item.desc;

  if (waBtn) {
    const waMsg = encodeURIComponent(`¡Hola Marisol! Me interesa consultar la disponibilidad y condiciones del espacio [${item.id}: ${item.name} (${item.area})] en el Centro Comercial Mario Sánchez.`);
    waBtn.href = `https://wa.me/584247380002?text=${waMsg}`;
  }

  // Lock body scroll
  document.body.style.overflow = 'hidden';
  const modal = document.getElementById('detail-modal');
  const backdrop = document.getElementById('modal-backdrop');
  const dialog = document.getElementById('modal-dialog');

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
      if (backdrop) {
        backdrop.classList.remove('opacity-0');
        backdrop.classList.add('opacity-100');
      }
      if (dialog) {
        dialog.classList.remove('scale-95', 'opacity-0');
        dialog.classList.add('scale-100', 'opacity-100');
      }
    });
  }
}

function closeDetailModal() {
  const modal = document.getElementById('detail-modal');
  const backdrop = document.getElementById('modal-backdrop');
  const dialog = document.getElementById('modal-dialog');

  // Restore body scroll
  document.body.style.overflow = '';

  if (backdrop) {
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
  }
  if (dialog) {
    dialog.classList.remove('scale-100', 'opacity-100');
    dialog.classList.add('scale-95', 'opacity-0');
  }

  setTimeout(() => {
    if (modal) {
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }
  }, 200);
}

// Close on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('detail-modal');
    if (modal && !modal.classList.contains('hidden')) {
      closeDetailModal();
    }
  }
});

// 5. Filter Map Layers
function filterMap(cat, btn) {
  document.querySelectorAll('.map-filter-btn').forEach(b => {
    b.className = 'map-filter-btn px-3 py-1.5 rounded-lg text-xs font-heading font-bold text-slate-300 hover:text-white';
  });
  if (btn) {
    btn.className = 'map-filter-btn active px-3 py-1.5 rounded-lg text-xs font-heading font-bold bg-amber-500 text-slate-950';
  }

  let filtered = spacesData;
  if (cat === 'macro-lotes') filtered = spacesData.filter(s => s.category === 'macro-lotes');
  if (cat === 'locales') filtered = spacesData.filter(s => s.category === 'locales');
  if (cat === 'galpones') filtered = spacesData.filter(s => s.category === 'galpones');

  spacesData.forEach(s => {
    const visible = filtered.some(f => f.id === s.id);
    if (visible) {
      if (map && !map.hasLayer(mapLayers[s.id].poly)) map.addLayer(mapLayers[s.id].poly);
      if (map && !map.hasLayer(mapLayers[s.id].marker)) map.addLayer(mapLayers[s.id].marker);
    } else {
      if (map && map.hasLayer(mapLayers[s.id].poly)) map.removeLayer(mapLayers[s.id].poly);
      if (map && map.hasLayer(mapLayers[s.id].marker)) map.removeLayer(mapLayers[s.id].marker);
    }
  });

  renderList(filtered);
}

// 6. Dynamic Simulator Logic
let currentType = 'retail';
function setSimType(type, btn) {
  currentType = type;
  document.querySelectorAll('.sim-btn').forEach(b => {
    b.className = 'sim-btn px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-heading font-bold text-xs text-center transition-all';
  });
  if (btn) {
    btn.className = 'sim-btn active px-3 py-2.5 rounded-xl border border-amber-500 bg-amber-500/20 text-amber-300 font-heading font-bold text-xs text-center transition-all';
  }
  updateSim();
}

function updateSim() {
  const rangeEl = document.getElementById('sim-range');
  if (!rangeEl) return;
  const area = parseInt(rangeEl.value);
  const areaValEl = document.getElementById('sim-area-val');
  if (areaValEl) areaValEl.innerText = `${area} m²`;

  const titleEl = document.getElementById('sim-result-title');
  const capEl = document.getElementById('sim-result-cap');
  const powerEl = document.getElementById('sim-result-power');
  const accessEl = document.getElementById('sim-result-access');
  const parkingEstEl = document.getElementById('sim-parking-est');

  const parkingSlots = Math.round(area / 25);
  if (parkingEstEl) parkingEstEl.innerText = `~${parkingSlots} a ${parkingSlots + 6} vehículos`;

  if (titleEl && capEl && powerEl && accessEl) {
    if (area <= 120) {
      titleEl.innerText = "Local Comercial Frontal o Showroom Oeste";
      capEl.innerText = `~${Math.round(area / 6)} a ${Math.round(area / 4)} personas de aforo`;
      powerEl.innerText = "Bifásica / 220V";
      accessEl.innerText = "Retiro Norte (Estacionamiento Clientes)";
    } else if (area <= 400) {
      titleEl.innerText = "Depósito Logístico Este o Showroom Ampliado";
      capEl.innerText = `~${Math.round(area / 45)} Contenedores 40ft / ${Math.round(area * 0.8)} pallets`;
      powerEl.innerText = "Trifásica 220V";
      accessEl.innerText = "Pasillo Este (23.80 m Libres)";
    } else if (area <= 1200) {
      titleEl.innerText = "Franja Comercial o Módulo de Almacén";
      capEl.innerText = `~12 a 16 Contenedores 40ft o Galpón Mediano`;
      powerEl.innerText = "Trifásica Industrial 220V/440V";
      accessEl.innerText = "Patio Sur de Maniobras (20.00 m) / Pasillo Este";
    } else {
      titleEl.innerText = "Macro-Lote C01, C02 o C03 (1.730 m² c/u)";
      capEl.innerText = `~28 m lineales de frente al corredor de gandolas de 20 m`;
      powerEl.innerText = "Trifásica Industrial 440V con Transformador Propio";
      accessEl.innerText = "Pasillo Oeste (20.00 m Libres para Gandolas)";
    }
  }

  const typeLabels = {
    retail: "Retail / Tienda Comercial",
    containers: "Plaza de Contenedores Modulares",
    logistica: "Distribución Logística / Almacén",
    automotriz: "Taller Automotriz / Showroom"
  };

  const simWaBtn = document.getElementById('sim-wa-btn');
  if (simWaBtn) {
    const waText = encodeURIComponent(`¡Hola! Utilicé el simulador del CC Mario Sánchez y deseo cotizar un espacio de [${area} m²] para el rubro de [${typeLabels[currentType]}].`);
    simWaBtn.href = `https://wa.me/584247380002?text=${waText}`;
  }
}

// 7. Lead Form Submission
function handleLeadSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const leadData = {
    id: 'LEAD-' + Date.now(),
    date: new Date().toISOString(),
    name: (document.getElementById('lead-name')?.value || '').trim(),
    company: (document.getElementById('lead-company')?.value || '').trim(),
    phone: (document.getElementById('lead-phone')?.value || '').trim(),
    email: (document.getElementById('lead-email')?.value || '').trim(),
    space: document.getElementById('lead-space')?.value || '',
    rubro: document.getElementById('lead-rubro')?.value || '',
    msg: (document.getElementById('lead-msg')?.value || '').trim()
  };

  const existingLeads = JSON.parse(localStorage.getItem('ccms_leads') || '[]');
  existingLeads.push(leadData);
  localStorage.setItem('ccms_leads', JSON.stringify(existingLeads));

  const toastEl = document.getElementById('lead-toast');
  if (toastEl) toastEl.classList.remove('hidden');

  const msg = encodeURIComponent(
    `*POSTULACIÓN COMERCIAL - CC MARIO SÁNCHEZ*\n` +
    `• Nombre: ${leadData.name}\n` +
    `• Empresa: ${leadData.company}\n` +
    `• Teléfono: ${leadData.phone}\n` +
    `• Espacio Solicitado: ${leadData.space}\n` +
    `• Rubro: ${leadData.rubro}\n` +
    `• Mensaje: ${leadData.msg || 'Sin nota'}`
  );

  setTimeout(() => {
    window.open(`https://wa.me/584247380002?text=${msg}`, '_blank');
  }, 1200);
}

// 8. Scroll Reveal Observer
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// Global Expose & DOM Ready Initialization
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.filterMap = filterMap;
window.setSimType = setSimType;
window.updateSim = updateSim;
window.handleLeadSubmit = handleLeadSubmit;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLandingMap();
    updateSim();
    initScrollReveal();
  });
} else {
  initLandingMap();
  updateSim();
  initScrollReveal();
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

