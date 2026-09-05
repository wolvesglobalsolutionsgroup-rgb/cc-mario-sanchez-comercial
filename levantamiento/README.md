# Módulo de Levantamiento Técnico, GIS & Planos Arquitectónicos

Este módulo contiene la plataforma técnica georreferenciada y todos los entregables de arquitectura y topografía del **Centro Comercial Mario Sánchez** (Puerto La Cruz, Anzoátegui, Venezuela).

---

## 🗺️ Visor GIS Interactivo
- **Archivo:** `index.html` / `js/gis-app.js`
- **Tecnología:** Leaflet + Proj4js (Proyección UTM Huso 19 Norte / EPSG:32619 / Sirgas-REGVEN)
- **Capas:**
  - Vista Satelital Híbrida de Alta Resolución (Google Earth)
  - Polígono General del Terreno (14.207 m²)
  - Huella Central del Proyecto (5.190 m² / Real: 5.189,67 m²)
  - Parcelamiento de Macro-Lotes, Locales y Depósitos
  - Cuadrícula UTM y herramientas de medición de distancias y polígonos de área.

---

## 📐 Entregables Técnicos
1. `PLANO_CC_MARIO_SANCHEZ.dxf` - Plano Maestro AutoCAD georreferenciado en coordenadas UTM 19N.
2. `PLANO_CC_MARIO_SANCHEZ_LOCAL.dxf` - Plano AutoCAD en sistema de coordenadas local relativo (0,0).
3. `PLANO_EJECUTIVO.pdf` - Lámina técnica ejecutiva oficial en formato vectorial.
4. `PLANO_EJECUTIVO_ALTA_RESOLUCION.png` - Render ejecutivo en 300 DPI.
5. `CC MARIO SANCHEZ - MASTER PLAN DEFINITIVO.kml` - Polígonos oficiales para visualización en Google Earth Pro y Google Earth Web 3D.

---

## 🐍 Scripts de Generación
- `scripts/generar_cad.py` - Generador automatizado de archivos DXF.
- `scripts/generar_plano_tecnico.py` - Generador de láminas ejecutivas y balance de superficies.
