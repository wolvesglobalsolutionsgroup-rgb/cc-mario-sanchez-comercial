
  // 1. Configuración Proj4 UTM 19N (EPSG:32619)
  proj4.defs("EPSG:32619", "+proj=utm +zone=19 +ellps=WGS84 +datum=WGS84 +units=m +no_defs");

  function wgsToUtm(lon, lat) {
    var p = proj4("EPSG:4326", "EPSG:32619", [lon, lat]);
    return { e: p[0], n: p[1] };
  }

  // 2. Inicialización del Mapa
  const mapCenter = [10.20468, -64.63290];
  const map = L.map('map', {
    center: mapCenter,
    zoom: 18,
    minZoom: 14,
    maxZoom: 21,
    zoomControl: false
  });

  // Controles de Zoom en la esquina inferior derecha
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // 3. Capas Satelitales Base
  const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 22,
    maxNativeZoom: 20,
    attribution: '© Google'
  }).addTo(map);

  const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 22,
    maxNativeZoom: 20,
    attribution: '© Google'
  });

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OSM'
  });

  L.control.layers({
    "Satélite Híbrido": googleHybrid,
    "Satélite": googleSat,
    "OpenStreetMap": osm
  }, null, { position: 'topright' }).addTo(map);

  // 4. Geometrías Vectoriales del Proyecto
  const coordsP = [
    [-64.6334931, 10.2041270], // P1
    [-64.6325898, 10.2039085], // P2
    [-64.6322931, 10.2051063], // P3
    [-64.6332604, 10.2053150]  // P4
  ];
  const latlngsP = coordsP.map(c => [c[1], c[0]]);

  // ESTÁNDAR DEFINITIVO: Huella 5.190 m² (Real: 5.189,67 m²)
  const coordsQ = [
    [-64.6330805, 10.2052798], // Q1 (NW)
    [-64.6332309, 10.2045362], // Q2 (SW)
    [-64.6326685, 10.2044512], // Q3 (SE)
    [-64.6325082, 10.2051530]  // Q4 (NE)
  ];
  const latlngsQ = coordsQ.map(c => [c[1], c[0]]);

  // Franja de Estacionamientos en Batería a 90° en Pasillo Oeste (~35 puestos)
  const coordsEstac = [
    [-64.6333400, 10.2045550],
    [-64.6331900, 10.2052700],
    [-64.6332400, 10.2052800],
    [-64.6333900, 10.2045650]
  ];
  const latlngsEstac = coordsEstac.map(c => [c[1], c[0]]);

  const groupGeneral = L.layerGroup().addTo(map);
  const groupPlaza = L.layerGroup().addTo(map);
  const groupEstac = L.layerGroup().addTo(map);
  const groupTransito = L.layerGroup().addTo(map);
  const groupRetiros = L.layerGroup().addTo(map);
  const groupAcceso = L.layerGroup().addTo(map);
  const groupCotas = L.layerGroup().addTo(map);

  // Polígono General
  const polyGeneral = L.polygon(latlngsP, {
    color: '#38bdf8',
    weight: 2.8,
    opacity: 0.95,
    fillColor: '#38bdf8',
    fillOpacity: 0.08
  }).addTo(groupGeneral);

  // Huella Central: 5.190 m² (Real: 5.189,67 m²) dividida en 3 Macro-Lotes
  // LOT-C01 (Norte): 1.730 m²
  const polyLot1 = L.polygon([
    [10.2052798, -64.6330805],
    [10.2051530, -64.6325082],
    [10.2049191, -64.6325616],
    [10.2050319, -64.6331306]
  ], {
    color: '#f59e0b',
    weight: 2.4,
    opacity: 0.95,
    fillColor: '#fbbf24',
    fillOpacity: 0.32
  }).bindTooltip('<b>LOT-C01: Macro-Lote Norte</b><br>1.730 m² | Fte. Oeste: 27,95 m', { sticky: true }).addTo(groupPlaza);

  // LOT-C02 (Medio): 1.730 m²
  const polyLot2 = L.polygon([
    [10.2050319, -64.6331306],
    [10.2049191, -64.6325616],
    [10.2046851, -64.6326151],
    [10.2047841, -64.6331808]
  ], {
    color: '#0ea5e9',
    weight: 2.4,
    opacity: 0.95,
    fillColor: '#38bdf8',
    fillOpacity: 0.32
  }).bindTooltip('<b>LOT-C02: Macro-Lote Central</b><br>1.730 m² | Fte. Oeste: 27,95 m', { sticky: true }).addTo(groupPlaza);

  // LOT-C03 (Sur): 1.730 m²
  const polyLot3 = L.polygon([
    [10.2047841, -64.6331808],
    [10.2046851, -64.6326151],
    [10.2044512, -64.6326685],
    [10.2045362, -64.6332309]
  ], {
    color: '#c084fc',
    weight: 2.4,
    opacity: 0.95,
    fillColor: '#a855f7',
    fillOpacity: 0.32
  }).bindTooltip('<b>LOT-C03: Macro-Lote Sur</b><br>1.730 m² | Fte. Oeste: 27,96 m', { sticky: true }).addTo(groupPlaza);

  // Envolvente exterior huella central
  const polyPlaza = L.polygon(latlngsQ, {
    color: '#b45309',
    weight: 1.8,
    opacity: 0.8,
    fill: false
  }).addTo(groupPlaza);

  // Franja de Estacionamiento Pasillo Oeste
  L.polygon(latlngsEstac, {
    color: '#3b82f6',
    weight: 2.0,
    dashArray: '4, 4',
    fillColor: '#60a5fa',
    fillOpacity: 0.35
  }).addTo(groupEstac);

  // Eje de Acceso
  L.polyline([
    [10.2056053, -64.6338884],
    [10.2054640, -64.6335738],
    [10.2053150, -64.6332600]
  ], {
    color: '#c084fc',
    weight: 2.6,
    dashArray: '6, 5'
  }).addTo(groupAcceso);

  // Creador de tags/cotas sin desbordamiento
  function createTag(lat, lon, text, cssClass, targetGroup) {
    return L.marker([lat, lon], {
      icon: L.divIcon({
        className: 'cota-wrapper',
        html: `<div class="cota-pill ${cssClass}">${text}</div>`,
        iconSize: null
      })
    }).addTo(targetGroup);
  }

  // 1. Cotas Polígono General (Exterior)
  createTag(10.203870, -64.633041, '101.88 m', '', groupCotas);
  createTag(10.204507, -64.632280, '136.42 m', '', groupCotas);
  createTag(10.205360, -64.632777, '108.47 m', '', groupCotas);
  createTag(10.204721, -64.633560, '133.85 m', '', groupCotas);

  // 2. Cotas Huella Central (5.190 m²: Fte. Norte 64.31m, Fte. Sur 62.38m, Lat. Oeste 83.86m, Lat. Este 79.56m)
  createTag(10.205200, -64.632790, 'Fte. Norte: 64.31 m', 'cota-pill-amber', groupCotas);
  createTag(10.204800, -64.632730, 'Lat. Este: 79.56 m', 'cota-pill-amber', groupCotas);
  createTag(10.204550, -64.632950, 'Fte. Sur: 62.38 m', 'cota-pill-amber', groupCotas);
  createTag(10.204910, -64.633110, 'Lat. Oeste: 83.86 m', 'cota-pill-amber', groupCotas);

  // 3. Retiros y Pasillos Críticos
  createTag(10.205460, -64.633000, 'Retiro N: 23.86 m (Acceso y Estac. Clientes)', 'cota-pill-rose', groupRetiros);
  L.polyline([[10.2052485, -64.6329559], [10.2054593, -64.6329095]], {
    color: '#f43f5e', weight: 2.2
  }).addTo(groupRetiros);

  createTag(10.204390, -64.632900, 'Patio Sur: 20.00 m (Maniobra Repuestos de Oriente)', 'cota-pill-rose', groupRetiros);
  L.polyline([[10.2045012, -64.6328983], [10.2043359, -64.6329145]], {
    color: '#f43f5e', weight: 2.2
  }).addTo(groupRetiros);

  createTag(10.205651, -64.633879, 'Boca: 11.50 m', 'cota-pill-rose', groupRetiros);
  createTag(10.205460, -64.633570, 'Eje: 76.00 m', 'cota-pill-rose', groupRetiros);
  
  // Pasillo Oeste 20.00m (Av. de Servicio)
  createTag(10.204730, -64.633330, 'Pasillo O: 20.00 m (Av. Servicio: Gandolas + Batería 90° ~35 Puestos)', 'cota-pill-blue', groupRetiros);
  
  // Pasillo Este
  createTag(10.204650, -64.632420, 'Pasillo E: 23.80 m (Tránsito / Retorno / Estac.)', 'cota-pill-rose', groupRetiros);

  // 4. Flechas de flujo de gandolas (Sentido Horario con Retorno Noreste)
  function createFlowMarker(lat, lon, angleDeg) {
    const icon = L.divIcon({
      className: 'flow-marker-wrapper',
      html: `
        <div class="flow-marker-inner" style="transform: rotate(${angleDeg}deg);">
          <i class="fa-solid fa-truck" style="color: #34d399; font-size: 13px;"></i>
          <i class="fa-solid fa-arrow-right" style="color: #34d399; font-size: 14px;"></i>
        </div>
      `,
      iconSize: null
    });
    return L.marker([lat, lon], { icon: icon }).addTo(groupTransito);
  }

  createFlowMarker(10.20498, -64.63336, 172); // Pasillo Oeste (Norte a Sur)
  createFlowMarker(10.20430, -64.63265, 84);  // Maniobra Sur (Oeste a Este)
  createFlowMarker(10.20490, -64.63242, 355); // Pasillo Este (Sur a Norte)
  createFlowMarker(10.20525, -64.63248, 315); // Curva Retorno Noreste
  createFlowMarker(10.20546, -64.63285, 265); // Retiro Norte (Salida hacia Callejón de Acceso)

  // 5. Visibilidad de Etiquetas en función del Zoom
  function updateZoomVisibility() {
    const currentZoom = map.getZoom();
    const cotasChecked = document.getElementById('toggle-cotas').checked;
    
    if (currentZoom < 18) {
      if (map.hasLayer(groupCotas)) map.removeLayer(groupCotas);
      if (map.hasLayer(groupRetiros)) map.removeLayer(groupRetiros);
    } else {
      if (cotasChecked && !map.hasLayer(groupCotas)) map.addLayer(groupCotas);
      if (document.getElementById('toggle-retiros').checked && !map.hasLayer(groupRetiros)) {
        map.addLayer(groupRetiros);
      }
    }
  }

  map.on('zoomend', updateZoomVisibility);

  // 6. Eventos de los Toggles de Capas
  document.getElementById('toggle-general').addEventListener('change', (e) => {
    if (e.target.checked) map.addLayer(groupGeneral); else map.removeLayer(groupGeneral);
  });
  document.getElementById('toggle-plaza').addEventListener('change', (e) => {
    if (e.target.checked) map.addLayer(groupPlaza); else map.removeLayer(groupPlaza);
  });
  document.getElementById('toggle-estac').addEventListener('change', (e) => {
    if (e.target.checked) map.addLayer(groupEstac); else map.removeLayer(groupEstac);
  });
  document.getElementById('toggle-transito').addEventListener('change', (e) => {
    if (e.target.checked) map.addLayer(groupTransito); else map.removeLayer(groupTransito);
  });
  document.getElementById('toggle-retiros').addEventListener('change', (e) => {
    if (e.target.checked && map.getZoom() >= 18) map.addLayer(groupRetiros); else map.removeLayer(groupRetiros);
  });
  document.getElementById('toggle-acceso').addEventListener('change', (e) => {
    if (e.target.checked) map.addLayer(groupAcceso); else map.removeLayer(groupAcceso);
  });
  document.getElementById('toggle-cotas').addEventListener('change', (e) => {
    if (e.target.checked && map.getZoom() >= 18) map.addLayer(groupCotas); else map.removeLayer(groupCotas);
  });

  // 7. HUD de Coordenadas en Vivo (Desktop y Panel Móvil)
  map.on('mousemove', (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const utm = wgsToUtm(lng, lat);
    const wgsStr = `${lat.toFixed(6)}° N, ${Math.abs(lng).toFixed(6)}° W`;
    const utmStr = `E: ${utm.e.toFixed(1)} m | N: ${utm.n.toFixed(1)} m`;

    const hudWgs = document.getElementById('hud-wgs');
    const hudUtm = document.getElementById('hud-utm');
    if (hudWgs) hudWgs.innerText = wgsStr;
    if (hudUtm) hudUtm.innerText = utmStr;

    const sbWgs = document.getElementById('sidebar-wgs');
    const sbUtm = document.getElementById('sidebar-utm');
    if (sbWgs) sbWgs.innerText = wgsStr;
    if (sbUtm) sbUtm.innerText = utmStr;
  });

  // 8. Vistas Predefinidas
  function goToView(type) {
    closeMobileDrawer();
    if (type === 'general') {
      map.flyToBounds(polyGeneral.getBounds(), { padding: [30, 30], duration: 1 });
    } else if (type === 'plaza') {
      map.flyToBounds(polyPlaza.getBounds(), { padding: [40, 40], duration: 1 });
    } else if (type === 'acceso') {
      map.flyTo([10.20548, -64.63357], 19, { duration: 1 });
    } else if (type === 'gandolas') {
      map.flyTo([10.20490, -64.63328], 19.5, { duration: 1 });
    }
  }

  // 9. Botón de Recentrar
  const btnRecenter = document.getElementById('btn-recenter');
  btnRecenter.addEventListener('click', () => {
    map.flyToBounds(polyGeneral.getBounds(), { padding: [30, 30], duration: 1 });
  });

  // 10. MOTOR NATIVO DE MEDICIÓN INTERACTIVA
  let isMeasuring = false;
  let measureMode = 'distance';
  let measurePoints = [];
  let measureMarkers = [];
  let measureLine = null;
  let measurePolygon = null;
  const measureGroup = L.layerGroup().addTo(map);

  const btnMeasure = document.getElementById('btn-measure');
  const measureBox = document.getElementById('measure-box');
  const btnMeasureClose = document.getElementById('btn-measure-close');
  const btnModeDist = document.getElementById('btn-mode-distance');
  const btnModeArea = document.getElementById('btn-mode-area');
  const btnMeasureClear = document.getElementById('btn-measure-clear');
  const btnMeasureFinish = document.getElementById('btn-measure-finish');
  const measureOutput = document.getElementById('measure-output');
  const measureHint = document.getElementById('measure-hint');

  function calculateDistanceMeters(pts) {
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      total += pts[i].distanceTo(pts[i+1]);
    }
    return total;
  }

  function calculateAreaMeters(pts) {
    if (pts.length < 3) return 0;
    const utmPts = pts.map(p => wgsToUtm(p.lng, p.lat));
    let area = 0;
    for (let i = 0; i < utmPts.length; i++) {
      const j = (i + 1) % utmPts.length;
      area += utmPts[i].e * utmPts[j].n;
      area -= utmPts[j].e * utmPts[i].n;
    }
    return Math.abs(area) / 2.0;
  }

  function updateMeasurementDisplay() {
    if (measurePoints.length === 0) {
      measureOutput.innerText = measureMode === 'distance' ? '0.00 m' : '0.00 m²';
      measureHint.innerText = 'Toca en el mapa para marcar puntos';
      return;
    }

    if (measureMode === 'distance') {
      const dist = calculateDistanceMeters(measurePoints);
      measureOutput.innerText = `${dist.toFixed(2)} m`;
      measureHint.innerText = `${measurePoints.length} vértice(s) fijado(s)`;
    } else {
      if (measurePoints.length < 3) {
        const dist = calculateDistanceMeters(measurePoints);
        measureOutput.innerText = `${dist.toFixed(2)} m (Línea)`;
        measureHint.innerText = 'Se requieren al menos 3 puntos para calcular área';
      } else {
        const area = calculateAreaMeters(measurePoints);
        const perim = calculateDistanceMeters([...measurePoints, measurePoints[0]]);
        measureOutput.innerText = `${area.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
        measureHint.innerText = `Perímetro: ${perim.toFixed(2)} m (${measurePoints.length} vértices)`;
      }
    }
  }

  function redrawMeasurementGraphics() {
    if (measureLine) measureGroup.removeLayer(measureLine);
    if (measurePolygon) measureGroup.removeLayer(measurePolygon);

    if (measurePoints.length >= 2) {
      if (measureMode === 'distance') {
        measureLine = L.polyline(measurePoints, {
          color: '#38bdf8',
          weight: 3.5,
          dashArray: '5, 5'
        }).addTo(measureGroup);
      } else {
        measurePolygon = L.polygon(measurePoints, {
          color: '#fbbf24',
          weight: 3,
          fillColor: '#f59e0b',
          fillOpacity: 0.35
        }).addTo(measureGroup);
      }
    }
    updateMeasurementDisplay();
  }

  function handleMapClickForMeasure(e) {
    if (!isMeasuring) return;
    const latlng = e.latlng;
    measurePoints.push(latlng);

    const marker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'cota-wrapper',
        html: '<div class="measure-dot"></div>',
        iconSize: [12, 12]
      })
    }).addTo(measureGroup);
    measureMarkers.push(marker);

    redrawMeasurementGraphics();
  }

  map.on('click', handleMapClickForMeasure);

  function resetMeasurements() {
    measurePoints = [];
    measureMarkers.forEach(m => measureGroup.removeLayer(m));
    measureMarkers = [];
    if (measureLine) { measureGroup.removeLayer(measureLine); measureLine = null; }
    if (measurePolygon) { measureGroup.removeLayer(measurePolygon); measurePolygon = null; }
    updateMeasurementDisplay();
  }

  function startMeasuring() {
    isMeasuring = true;
    btnMeasure.classList.add('active');
    measureBox.classList.add('active');
    map.getContainer().style.cursor = 'crosshair';
    updateMeasurementDisplay();
  }

  function stopMeasuring() {
    isMeasuring = false;
    btnMeasure.classList.remove('active');
    measureBox.classList.remove('active');
    map.getContainer().style.cursor = '';
  }

  btnMeasure.addEventListener('click', () => {
    if (isMeasuring) {
      stopMeasuring();
    } else {
      startMeasuring();
    }
  });

  btnMeasureClose.addEventListener('click', stopMeasuring);

  btnModeDist.addEventListener('click', () => {
    measureMode = 'distance';
    btnModeDist.classList.add('active');
    btnModeArea.classList.remove('active');
    redrawMeasurementGraphics();
  });

  btnModeArea.addEventListener('click', () => {
    measureMode = 'area';
    btnModeArea.classList.add('active');
    btnModeDist.classList.remove('active');
    redrawMeasurementGraphics();
  });

  btnMeasureClear.addEventListener('click', resetMeasurements);
  btnMeasureFinish.addEventListener('click', () => {
    if (measurePoints.length > 0) {
      updateMeasurementDisplay();
      measureHint.innerText = 'Medición completada ✓';
    }
  });

  // 11. Colapso del Sidebar en Desktop
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const toggleIcon = document.getElementById('toggle-icon');
  const hudBar = document.getElementById('hud-bar');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleBtn.classList.toggle('sidebar-is-collapsed');
    hudBar.classList.toggle('sidebar-is-collapsed');
    
    if (sidebar.classList.contains('collapsed')) {
      toggleIcon.className = 'fa-solid fa-chevron-right';
    } else {
      toggleIcon.className = 'fa-solid fa-chevron-left';
    }
    setTimeout(() => map.invalidateSize(), 300);
  });

  // 12. Modal / Drawer en Móvil con Botón Flotante y Cierre
  const mobileFabBtn = document.getElementById('mobile-fab-btn');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');

  function openMobileDrawer() {
    sidebar.classList.add('open');
    modalBackdrop.classList.add('active');
  }

  function closeMobileDrawer() {
    sidebar.classList.remove('open');
    modalBackdrop.classList.remove('active');
  }

  mobileFabBtn.addEventListener('click', openMobileDrawer);
  modalBackdrop.addEventListener('click', closeMobileDrawer);
  drawerCloseBtn.addEventListener('click', closeMobileDrawer);


// Event delegation for data-view buttons
document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', function() {
    goToView(this.getAttribute('data-view'));
  });
});
