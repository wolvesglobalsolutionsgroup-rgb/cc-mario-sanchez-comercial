/**
 * Centro Comercial Mario Sánchez — Portal Inmobiliario & Alquiler
 * Interactive Leaflet Map & Space Selection Engine
 */

// 1. Initial Leaflet Map
const map = L.map('map', {
  center: [10.20468, -64.63290],
  zoom: 18,
  minZoom: 15,
  maxZoom: 21,
  zoomControl: false
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Satellite Layer
L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
  maxZoom: 22,
  maxNativeZoom: 20,
  attribution: '© Google Earth'
}).addTo(map);

// 2. Real Estate Database with Real Architectural Photography & 100% Stable URLs
const catalog = [
  {
    id: "LOT-C01",
    name: "Macro-Lote C01 (Norte)",
    category: "macro-lotes",
    area: "1.730 m²",
    status: "disponible",
    statusText: "Disponible",
    color: "#f59e0b",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Oeste (20.00 m) + Frente Norte (64.31 m)",
    power: "Trifásica 220V/440V Industrial",
    truck: "27,95 m Frente a Canal Gandolas",
    parking: "Retiro Norte Clientes + Batería 90°",
    description: "Macro-Lote comercial transversal norte. Cuenta con 27,95 m de frente vial al Pasillo Oeste de gandolas (20 m) y 64,31 m de frente al Retiro de Clientes.",
    useCases: [
      "Concesionario o showroom de maquinaria y camiones.",
      "Tienda ferretera mayorista y materiales de construcción.",
      "Retail de gran formato, supermercado o feria gastronómica."
    ],
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
    status: "disponible",
    statusText: "Disponible",
    color: "#0ea5e9",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Oeste (20.00 m) + Pasillo Este (23.80 m)",
    power: "Trifásica 220V/440V Industrial",
    truck: "27,95 m Frente a Canal Gandolas",
    parking: "Pasillo de Retorno Este",
    description: "Macro-Lote central intermedio con doble conectividad vial: 27,95 m de frente directo a la Avenida de Servicio de 20 m y fondo este al pasillo de retorno de 23,80 m.",
    useCases: [
      "Patio logístico de contenedores y carga pesada.",
      "Galpón modular desmontable en estructura de acero.",
      "Almacén seco para alimentos, farmacia o consumo masivo."
    ],
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
    status: "disponible",
    statusText: "Disponible",
    color: "#c084fc",
    image: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Oeste (20.00 m) + Patio Sur (20.00 m)",
    power: "Acometida Industrial 440V con Transformador",
    truck: "27,96 m Frente + Frente Sur al Patio de Maniobras",
    parking: "Patio Sur Carga Pesada",
    description: "Macro-Lote sur de alta capacidad operativa. Posee 27,96 m de frente al Pasillo Oeste y frente sur directo al Patio de Maniobras de 20 m frente a Repuestos de Oriente.",
    useCases: [
      "Taller de servicio pesado, mantenimiento automotriz y lubricación.",
      "Patio de gandolas, maquinaria pesada y equipos industriales.",
      "Centro de distribución regional y cross-docking."
    ],
    coords: [
      [10.2047841, -64.6331808],
      [10.2046851, -64.6326151],
      [10.2044512, -64.6326685],
      [10.2045362, -64.6332309]
    ]
  },
  // LOCALES
  {
    id: "LOC-N01",
    name: "Local Comercial Norte 01",
    category: "locales",
    area: "95 m²",
    status: "disponible",
    statusText: "Disponible",
    color: "#10b981",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
    road: "Retiro Norte (23.86 m)",
    power: "Bifásica / 220V",
    truck: "Vehículos Ligeros",
    parking: "Frontal Inmediato",
    description: "Local comercial con vitrina frente a la zona de estacionamiento de clientes del Retiro Norte.",
    useCases: ["Cafetería / Bakery gourmet.", "Oficina de servicios o seguros.", "Farmacia de conveniencia."],
    coords: [
      [10.20542, -64.63315],
      [10.20540, -64.63295],
      [10.20534, -64.63296],
      [10.20536, -64.63316]
    ]
  },
  {
    id: "LOC-N02",
    name: "Local Comercial Norte 02",
    category: "locales",
    area: "110 m²",
    status: "disponible",
    statusText: "Disponible",
    color: "#10b981",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    road: "Retiro Norte (23.86 m)",
    power: "220V Bifásica",
    truck: "Acceso Frontal",
    parking: "Frontal Inmediato",
    description: "Espacio comercial contiguo a la entrada con alto flujo de clientes y estacionamiento directo.",
    useCases: ["Ferretería ligera / Iluminación.", "Tienda de tecnología / Retail.", "Minimarket."],
    coords: [
      [10.20540, -64.63295],
      [10.20538, -64.63275],
      [10.20532, -64.63276],
      [10.20534, -64.63296]
    ]
  },
  {
    id: "LOC-O04",
    name: "Local Showroom Oeste 04",
    category: "locales",
    area: "120 m²",
    status: "disponible",
    statusText: "Disponible",
    color: "#10b981",
    image: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Oeste (20.00 m)",
    power: "220V Trifásica",
    truck: "Frente a Pasillo Gandolas",
    parking: "Batería 90° al Frente",
    description: "Showroom comercial de doble altura con portón corredizo para vehículos livianos y mezzanina.",
    useCases: ["Venta de repuestos pesados.", "Distribución de lubricantes.", "Taller rápido."],
    coords: [
      [10.20505, -64.63345],
      [10.20503, -64.63335],
      [10.20485, -64.63338],
      [10.20487, -64.63348]
    ]
  },
  // GALPONES
  {
    id: "GAL-S01",
    name: "Galpón Repuestos de Oriente",
    category: "galpones",
    area: "850 m²",
    status: "arrendado",
    statusText: "Arrendado",
    color: "#f43f5e",
    image: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80",
    road: "Patio Sur (20.00 m)",
    power: "Industrial 440V",
    truck: "Muelle de Carga",
    parking: "Patio Exclusivo",
    description: "Sede principal activa de Repuestos de Oriente con patio de maniobras de 20 metros.",
    useCases: ["Centro de distribución automotriz (En Operación)."],
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
    status: "disponible",
    statusText: "Disponible",
    color: "#a855f7",
    image: "https://images.unsplash.com/photo-1586528116493-a029325540fa?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Este (23.80 m)",
    power: "Trifásica 220V",
    truck: "Acceso Lateral Gandolas",
    parking: "Pasillo 23.80 m",
    description: "Galpón cerrado para almacenaje de alta rotación con piso reforzado para montacargas.",
    useCases: ["Almacén de distribución.", "Empaque e-commerce.", "Taller metalmecánico."],
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
    status: "disponible",
    statusText: "Disponible",
    color: "#a855f7",
    image: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80",
    road: "Pasillo Este (23.80 m)",
    power: "220V Trifásica",
    truck: "Acceso Lateral",
    parking: "Pasillo 23.80 m",
    description: "Depósito cerrado con portón para descarga directa de camiones medianos.",
    useCases: ["Depósito de materiales.", "Archivo y custodia de inventario."],
    coords: [
      [10.20465, -64.63230],
      [10.20463, -64.63220],
      [10.20440, -64.63225],
      [10.20442, -64.63235]
    ]
  }
];

// 3. Render Geometry & Polygons
const mapItems = {};
const layersGroup = L.layerGroup().addTo(map);

catalog.forEach(item => {
  const poly = L.polygon(item.coords, {
    color: item.color,
    weight: 2,
    fillColor: item.color,
    fillOpacity: item.status === 'arrendado' ? 0.2 : 0.45
  }).addTo(layersGroup);

  const center = poly.getBounds().getCenter();
  const marker = L.marker(center, {
    icon: L.divIcon({
      className: 'map-label-clean',
      html: `
        <div class="pin-pill-clean ${item.category === 'locales' ? 'emerald' : ''}">
          <span>${item.id}</span>
        </div>
      `,
      iconSize: null
    })
  }).addTo(layersGroup);

  const trigger = () => openLotDossier(item.id);
  poly.on('click', trigger);
  marker.on('click', trigger);

  mapItems[item.id] = { poly, marker, data: item };
});

// 4. Render Catalog Cards
const cardsContainer = document.getElementById('cards-container');
const counterText = document.getElementById('catalog-counter');

function renderCatalogCards(items) {
  if (!cardsContainer || !counterText) return;
  cardsContainer.innerHTML = '';
  counterText.innerText = `${items.length} espacios listados`;

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = `space-card`;
    card.id = `card-${item.id}`;
    card.onclick = () => openLotDossier(item.id);

    let statusBadgeClass = 'status-disp';
    if (item.status === 'arrendado') statusBadgeClass = 'status-arren';

    card.innerHTML = `
      <div class="card-photo-wrapper">
        <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80'" class="card-photo-img">
        <div class="card-photo-overlay">
          <span class="card-code-tag">${item.id}</span>
          <span class="badge-status ${statusBadgeClass}">${item.statusText}</span>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${item.name}</h3>
        <div class="card-specs-row">
          <div class="spec-box">
            <span class="lbl">Superficie</span>
            <span class="val" style="color: var(--amber);">${item.area}</span>
          </div>
          <div class="spec-box">
            <span class="lbl">Vialidad</span>
            <span class="val">${item.road.split('(')[0]}</span>
          </div>
        </div>
        <div class="card-bottom">
          <span style="font-size: 11px; color: var(--txt-muted);">${item.useCases[0].substring(0, 32)}...</span>
          <button class="btn-card-link">
            <span>Detalles</span> <i class="fa-solid fa-arrow-right" style="font-size: 9px;"></i>
          </button>
        </div>
      </div>
    `;

    cardsContainer.appendChild(card);
  });
}

// 5. Open Detailed Dossier Drawer
const drawer = document.getElementById('drawer');
const drawerCloseBtn = document.getElementById('drawer-close');

function openLotDossier(id) {
  const item = catalog.find(c => c.id === id);
  if (!item) return;

  document.querySelectorAll('.space-card').forEach(c => c.classList.remove('selected'));
  const targetCard = document.getElementById(`card-${id}`);
  if (targetCard) {
    targetCard.classList.add('selected');
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  Object.values(mapItems).forEach(obj => {
    obj.poly.setStyle({ weight: 2, fillOpacity: obj.data.status === 'arrendado' ? 0.2 : 0.45 });
  });
  if (mapItems[id]) {
    mapItems[id].poly.setStyle({ weight: 4.5, fillOpacity: 0.75, color: '#ffffff' });
    map.flyToBounds(mapItems[id].poly.getBounds(), { padding: [60, 60], duration: 0.8 });
  }

  document.getElementById('drawer-hero-img').src = item.image;
  document.getElementById('drawer-code').innerText = item.id;
  document.getElementById('drawer-title').innerText = item.name;
  document.getElementById('drawer-area').innerText = item.area;
  document.getElementById('drawer-desc').innerText = item.description;

  const badgeStatus = document.getElementById('drawer-badge-status');
  badgeStatus.innerText = item.statusText;
  badgeStatus.className = `badge-status ${item.status === 'arrendado' ? 'status-arren' : 'status-disp'}`;

  document.getElementById('drawer-road').innerText = item.road;
  document.getElementById('drawer-power').innerText = item.power;
  document.getElementById('drawer-truck').innerText = item.truck;
  document.getElementById('drawer-parking').innerText = item.parking;

  const usecasesList = document.getElementById('drawer-usecases');
  usecasesList.innerHTML = '';
  item.useCases.forEach(u => {
    const li = document.createElement('li');
    li.className = 'usecase-item';
    li.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${u}</span>`;
    usecasesList.appendChild(li);
  });

  const waMsg = encodeURIComponent(`¡Hola Marisol! Me interesa solicitar información y disponibilidad del espacio [${item.id}: ${item.name} (${item.area})] en el CC Mario Sánchez.`);
  document.getElementById('drawer-wa-link').href = `https://wa.me/584247380002?text=${waMsg}`;

  drawer.classList.add('open');
}

if (drawerCloseBtn) {
  drawerCloseBtn.onclick = () => drawer.classList.remove('open');
}

// 6. Filter Catalog
function filterCatalog(category, btn) {
  if (btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  let filtered = catalog;
  if (category === 'macro-lotes') filtered = catalog.filter(c => c.category === 'macro-lotes');
  if (category === 'locales') filtered = catalog.filter(c => c.category === 'locales');
  if (category === 'galpones') filtered = catalog.filter(c => c.category === 'galpones');
  if (category === 'disponibles') filtered = catalog.filter(c => c.status === 'disponible');

  catalog.forEach(item => {
    const isVisible = filtered.some(f => f.id === item.id);
    if (isVisible) {
      if (!map.hasLayer(mapItems[item.id].poly)) map.addLayer(mapItems[item.id].poly);
      if (!map.hasLayer(mapItems[item.id].marker)) map.addLayer(mapItems[item.id].marker);
    } else {
      if (map.hasLayer(mapItems[item.id].poly)) map.removeLayer(mapItems[item.id].poly);
      if (map.hasLayer(mapItems[item.id].marker)) map.removeLayer(mapItems[item.id].marker);
    }
  });

  renderCatalogCards(filtered);
}

window.filterCatalog = filterCatalog;
window.openLotDossier = openLotDossier;

// Initial Render
renderCatalogCards(catalog);

// 7. Mobile Drawer FAB & Toggle
const mobileFab = document.getElementById('mobile-fab');
const sidebar = document.getElementById('sidebar');

function toggleSidebar(forceState) {
  if (!sidebar) return;
  if (typeof forceState === 'boolean') {
    if (forceState) sidebar.classList.add('open');
    else sidebar.classList.remove('open');
  } else {
    sidebar.classList.toggle('open');
  }
  if (mobileFab) {
    const isOpen = sidebar.classList.contains('open');
    mobileFab.querySelector('span').innerText = isOpen ? 'Cerrar Lista' : `Ver Espacios (${catalog.length})`;
    mobileFab.querySelector('i').className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-list-check';
  }
}

if (mobileFab) {
  mobileFab.onclick = () => toggleSidebar();
}

// 8. PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
