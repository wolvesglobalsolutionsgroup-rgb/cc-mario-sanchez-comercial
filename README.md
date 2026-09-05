# 🏢 Centro Comercial Mario Sánchez — Ecosistema Digital Unificado

Plataforma integral de arquitectura técnica, portal inmobiliario comercial y sistema ERP administrativo y de cobranzas para el **Centro Comercial Mario Sánchez** (Av. Municipal, Puerto La Cruz, Anzoátegui, Venezuela).

---

## 🏛️ Arquitectura del Repositorio (3 Módulos Principales)

```
cc-mario-sanchez-comercial/
│
├── 🗺️ 1. LEVANTAMIENTO TÉCNICO & VISOR GIS (/levantamiento/)
│   ├── index.html                           # Mini-App con Visor GIS / Coordenadas UTM 19N y Capas Satelitales
│   ├── js/gis-app.js                        # Motor interactivo de medición, polígonos y capas
│   ├── CC MARIO SANCHEZ - MASTER PLAN DEFINITIVO.kml # Archivo KML oficial Google Earth
│   ├── PLANO_CC_MARIO_SANCHEZ.dxf           # Plano Maestro AutoCAD georreferenciado UTM 19N
│   ├── PLANO_CC_MARIO_SANCHEZ_LOCAL.dxf     # Plano AutoCAD en sistema local (0,0)
│   ├── PLANO_EJECUTIVO.pdf                  # Lámina arquitectónica ejecutiva oficial
│   ├── PLANO_EJECUTIVO_ALTA_RESOLUCION.png   # Render de alta definición (2K/300 DPI)
│   ├── scripts/                             # Generadores Python de planos y CAD
│   └── README.md                            # Ficha técnica topográfica y balance de superficies
│
├── 🏢 2. PORTAL COMERCIAL & HERRAMIENTA DE ALQUILER (/)
│   ├── index.html                           # Landing Page oficial (100/100 PageSpeed, LCP ultrarrápido)
│   ├── alquiler.html                        # Portal Inmobiliario con catálogo interactivo de 10 espacios
│   ├── js/landing.js                        # Simulador de metraje y motor de captación de leads
│   ├── js/alquiler.js                       # Fichas técnicas, filtros por categoría y reserva WhatsApp
│   └── css/tailwind-built.min.css           # Estilos CSS compilados y optimizados
│
├── 💼 3. ERP DE GESTIÓN INMOBILIARIA, COBRANZAS & PAGOS (/gestion/)
│   ├── index.html                           # Dashboard administrativo y portal de inquilinos
│   ├── login.html                           # Portal de acceso seguro con control de roles (Admin / Inquilino)
│   ├── onboarding.html                      # Wizard de registro y alta de nuevos contratos
│   ├── js/app.js                            # Lógica del ERP, gestión de cánones, prórrogas y reportes
│   ├── js/security.js                       # Suite Criptográfica AES-GCM, CSP y Zero-Inline Dispatcher
│   ├── js/financial-engine.js               # Motor financiero multimoneda (Tasas BCV y Paralelo)
│   ├── js/theme-init.js                     # Anti-FOUC para modo oscuro/claro
│   └── css/dashboard.css                    # Sistema de diseño con variables CSS y tema dual
│
├── 📚 DOCUMENTACIÓN & RECURSOS (/docs/ y /assets/)
│   ├── docs/auditorias/                     # Informes de auditoría de seguridad y rendimiento
│   └── assets/                              # Logos vectoriales oficiales 2K (SVG) e iconografía
│
└── ⚙️ CONFIGURACIÓN GLOBAL
    ├── vercel.json                          # Enrutamiento limpio, CSP A+ y reescrituras de URL
    └── manifest.json                        # Progressive Web App (PWA) Manifest
```

---

## 🚀 Acceso Rápido a los Módulos (Producción)

- **🌐 Sitio Web Comercial & Simulador:** `https://cc-mario-sanchez-comercial.vercel.app/`
- **🏢 Portal de Alquiler de Espacios:** `https://cc-mario-sanchez-comercial.vercel.app/alquiler`
- **🗺️ Levantamiento Técnico & Visor GIS:** `https://cc-mario-sanchez-comercial.vercel.app/levantamiento`
- **💼 ERP de Gestión & Cobranzas:** `https://cc-mario-sanchez-comercial.vercel.app/gestion`
- **🔐 Acceso / Login:** `https://cc-mario-sanchez-comercial.vercel.app/login`

---

## 🛠️ Ejecución Local

Para probar todo el ecosistema localmente con un servidor HTTP estático:

```bash
# Opción 1: Node.js http-server o serve
npx serve -l 3000

# Opción 2: Python HTTP Server
python -m http.server 3000
```

Navega a `http://localhost:3000/` para la landing comercial, `http://localhost:3000/levantamiento/` para el visor GIS, o `http://localhost:3000/gestion/` para el ERP.

---

## 🛡️ Seguridad y Rendimiento

- **SecurityHeaders Grade:** **A+** (Content Security Policy estricta sin `unsafe-inline` ni `unsafe-eval`, HSTS, X-Frame-Options DENY).
- **Google PageSpeed Insights:** **100/100** (CSS crítico inlined, fuentes no bloqueantes, carga diferida de mapas e imágenes).
- **Criptografía:** Cifrado en reposo y tránsito con WebCrypto API (**AES-GCM 256 bits**).
- **Marco Legal Venezolano:** Conforme a **Gaceta Oficial 40.418**, Decretos de Prórroga Legal y normativas SENIAT.
