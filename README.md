# 🏢 Centro Comercial Mario Sánchez — Ecosistema Digital Unificado & CRE ERP SaaS

Plataforma integral de arquitectura técnica, portal inmobiliario comercial y sistema ERP administrativo, fiscal y de cobranzas para el **Centro Comercial Mario Sánchez** (Av. Municipal, Puerto La Cruz, Anzoátegui, Venezuela), diseñado bajo el estándar arquitectónico institucional para escalarse a centros comerciales y complejos empresariales a nivel nacional.

---

## 🏛️ Arquitectura del Repositorio (4 Módulos Principales)

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
│   └── scripts/                             # Generadores Python de planos y CAD
│
├── 🏢 2. PORTAL COMERCIAL & HERRAMIENTA DE ALQUILER (/)
│   ├── index.html                           # Landing Page oficial (100/100 PageSpeed, LCP ultrarrápido)
│   ├── alquiler.html                        # Portal Inmobiliario con catálogo interactivo de 10 espacios
│   ├── js/landing.js                        # Simulador de metraje y motor de captación de leads
│   ├── js/alquiler.js                       # Fichas técnicas, filtros por categoría y reserva WhatsApp
│   └── css/tailwind-built.min.css           # Estilos CSS compilados y optimizados
│
├── 💼 3. ERP DE GESTIÓN INMOBILIARIA, FISCAL & COBRANZAS (/gestion/)
│   ├── index.html                           # Dashboard administrativo y portal de inquilinos / directiva
│   ├── login.html                           # Acceso seguro con selector por roles (Superadmin, Inquilino, Directiva, etc.)
│   ├── onboarding.html                      # Wizard de registro y alta de nuevos contratos
│   ├── js/app.js                            # Lógica del ERP, liquidación sucesoral, acuerdos y reportes
│   ├── js/alcaldia-engine.js                # Motor Multi-Municipal LOCAT (ISAE y deducción por Mandato)
│   ├── js/seniat-engine.js                  # Motor SENIAT (TXT 16 columnas tabuladas y Libros Fiscales)
│   ├── js/telemetry.js                      # Pilar 1: Observabilidad, captura de errores y monitoreo en vivo
│   ├── js/rate-limiter.js                   # Pilar 4: Sliding Window Rate Limiting defensivo
│   ├── js/security.js                       # Cifrado WebCrypto AES-GCM 256 bits y CSP A+
│   ├── js/ayuda-content.js                  # Centro de documentación interactiva, fórmulas y marco legal
│   └── css/dashboard.css                    # Sistema de diseño con variables CSS y tema dual
│
├── 📚 4. CORPUS LEGAL VENEZOLANO & DATASET NOTEBOOKLM (/docs/corpus_notebooklm/)
│   ├── pdfs/                                # 7 Archivos PDF oficiales físicos originales descargados
│   │   ├── 01_Gaceta_Oficial_40418_Decreto_929_Arrendamiento_Comercial.pdf (0.91 MB)
│   │   ├── 02_Gaceta_Oficial_6755_LOCAT_Armonizacion_Tributaria.pdf (0.92 MB)
│   │   ├── 03_Gaceta_Oficial_6507_Codigo_Organico_Tributario.pdf (1.99 MB)
│   │   ├── 04_Gaceta_Oficial_6687_Ley_IGTF.pdf (1.87 MB)
│   │   ├── 05_Decreto_1808_Retenciones_ISLR_Gaceta_36203.pdf (13.04 MB)
│   │   ├── 06_Agentes_Retencion_IVA_Gaceta_40720.pdf (3.42 MB)
│   │   └── 07_Providencia_0071_Facturacion_Libros_Fiscales.pdf (5.59 MB)
│   ├── 08_SENIAT_INSTRUCTIVO_TECNICO_TXT_16_COLUMNAS.md # Especificación RI_DRIVA2020-IT01V3_0_0
│   ├── 01_ALCALDIA_TRIBUTOS_MUNICIPALES_LOCAT.md        # Catálogo 10 Municipios y Art. 1684 C.C.
│   └── DOSSIER_MAESTRO_RECAUDOS_Y_CUMPLIMIENTO_CRE_VENEZUELA.md # Recaudos para licencias y solvencias
│
└── ⚙️ CONFIGURACIÓN GLOBAL & CI/CD
    ├── supabase/migrations/                 # DDL PostgreSQL seguro con RLS y Guardrails
    ├── tests/stability.test.js              # Suite de 16 pruebas automatizadas (6 Pilares)
    ├── scripts/check-syntax.js              # Validador de sintaxis estricta JS
    ├── scripts/lint-guard.js                # Linter defensivo (anti-eval, anti-inline)
    ├── vercel.json                          # Enrutamiento limpio, CSP A+ y reescrituras de URL
    └── manifest.json                        # Progressive Web App (PWA) Manifest
```

---

## ⚖️ Memoria de Cálculo y Fórmulas Determinísticas

La plataforma opera bajo el principio de **cero discrecionalidad algorítmica**. Todos los cálculos financieros y tributarios se rigen por fórmulas matemáticas respaldadas en la legislación venezolana:

### 1. Canon Facturado con Acuerdos Especiales (G.O. N° 40.418, Art. 32)
$$\text{Canon Facturado} = \max(0, \text{Canon Base} - \text{Deducción Mensual por Mejoras}) + \text{Alícuota Condominio} + \text{Recargo Mora}$$

### 2. Gastos Comunes y Alícuota Condominial (G.O. N° 40.418, Art. 13 y 19)
$$\text{Alícuota Inmueble (\%)} = \left(\frac{\text{Área Local } \text{m}^2}{\text{Área Total Arrendable } \text{m}^2}\right) \times 100$$
$$\text{Cuota Mensual Gastos} = \text{Presupuesto Común Mensual } (\$2,540.00) \times \text{Alícuota Inmueble (\%)} $$

### 3. Recargo Moratorio Diario (Código de Comercio Art. 108)
$$\text{Recargo Mora} = \text{Saldo Vencido} \times \left(\frac{\text{Tasa Mensual \%}}{30}\right) \times \text{Días de Retraso Transcurridos}$$

### 4. Liquidación Sucesoral y Frutos Civiles (Código Civil Art. 552 y 768)
$$\text{Utilidad Repartible} = \text{Ingresos Cobrados} - \text{Gastos Comunes} - \text{Fondo Reserva (10\%)} - \text{Gasto Adm (5\%)}$$
$$\text{Cuota por Coheredero} = \frac{\text{Utilidad Repartible}}{14} \quad (7.142857\% \text{ por estirpe})$$

### 5. Impuesto Municipal a las Actividades Económicas (ISAE - LOCAT G.O. Ext. 6.755)
$$\text{Base Gravable ISAE} = \text{Ingresos Brutos Totales} - \text{Fondos en Custodia (Condominio, Art. 1684 C.C.)}$$
$$\text{ISAE a Pagar} = \text{Base Gravable ISAE} \times \text{Alícuota Municipal (ej. 2.00\% Sotillo, 1.50\% Chacao)}$$

### 6. Retenciones de IVA del SENIAT (Providencia SNAT/2023/000035)
$$\text{Monto Retenido} = \text{Base Imponible} \times 16\% \times 75\% \quad (\text{o } 100\% \text{ en supuestos especiales})$$

### 7. Impuesto a las Grandes Transacciones Financieras (IGTF - G.O. Ext. 6.687)
$$\text{IGTF} = \text{Cobro en Divisas Efectivo / Cripto / Zelle} \times 3.00\%$$

---

## 🤖 Base de Conocimiento para Google NotebookLM (Ground Truth)

Para eliminar cualquier alucinación en modelos de IA y asistentes cognitivos, el proyecto cuenta con un conjunto de datos verificado listo para cargar en NotebookLM:

* **URL del Cuaderno:** [`https://notebooklm.google.com/notebook/3914afb9-a48b-4130-8890-7eaed1fddb28`](https://notebooklm.google.com/notebook/3914afb9-a48b-4130-8890-7eaed1fddb28)
* **Fuentes Físicas:** Reposan localmente en `docs/corpus_notebooklm/pdfs/` (7 gacetas y reglamentos oficiales que suman 27 MB).
* **Guía de Carga:** Abre NotebookLM, selecciona "Añadir fuentes" -> "Subir archivos" y selecciona los 7 archivos PDF de la carpeta `pdfs/` más los resúmenes técnicos en markdown.

---

## 🛡️ Los 6 Pilares de Estabilidad para Producción

1. **Pilar 1: Observabilidad y Telemetría en Vivo (`telemetry.js`):** Captura de excepciones globales (`window.onerror`), métricas de rendimiento web (LCP, FID, CLS), sanitización automática de datos sensibles (redacción de claves y RIFs) y buffer con exportación JSON.
2. **Pilar 2: Autenticación Robusta & RBAC Multi-Rol (`auth-guard.js`):** Separación de dominios para Superadministrador, Inquilino, Directiva y Auditor. Modo Demo accesible sin alterar la seguridad de producción.
3. **Pilar 3: Base de Datos Segura & Guardrails (`database-guard.js`):** Interceptor que bloquea en seco instrucciones `DROP TABLE` o `TRUNCATE` en entornos de producción. Migraciones versionadas en PostgreSQL con RLS.
4. **Pilar 4: Gobernanza de Recursos & Rate Limiting (`rate-limiter.js`):** Algoritmo de ventana deslizante (*Sliding Window*) que previene saturación de API y abusos de peticiones masivas.
5. **Pilar 5: Pipeline de CI/CD & Calidad (`check-syntax.js` + `lint-guard.js`):** Validación de sintaxis estricta y prohibición de `eval()` o scripts inline no autorizados. 16/16 pruebas unitarias y de integración pasando.
6. **Pilar 6: Motores Fiscales Oficiales (`seniat-engine.js` + `alcaldia-engine.js`):**
   - **Alcaldías:** Liquidación ISAE con clasificador CIIU 6810, alícuotas dinámicas de 10 ciudades y exportación en formato CSV con UTF-8 BOM.
   - **SENIAT:** Generador del archivo plano `.txt` de 16 columnas separadas por tabulador según instructivo `RI_DRIVA2020-IT01V3_0_0`, con validación de período `AAAAMM` y comprobante de 14 dígitos.

---

## 🚀 Acceso Rápido a los Módulos (Producción)

- **🌐 Sitio Web Comercial & Simulador:** `https://cc-mario-sanchez-comercial.vercel.app/`
- **🏢 Portal de Alquiler de Espacios:** `https://cc-mario-sanchez-comercial.vercel.app/alquiler`
- **🗺️ Levantamiento Técnico & Visor GIS:** `https://cc-mario-sanchez-comercial.vercel.app/levantamiento`
- **💼 ERP de Gestión & Cobranzas:** `https://cc-mario-sanchez-comercial.vercel.app/gestion`
- **🔐 Acceso / Login:** `https://cc-mario-sanchez-comercial.vercel.app/login`
