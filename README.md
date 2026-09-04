# Centro Comercial Mario Sánchez — Suite Integral (Portal Comercial & ERP Inmobiliario)

> **Repositorio Oficial de GitHub**: [`wolvesglobalsolutionsgroup-rgb/cc-mario-sanchez-comercial`](https://github.com/wolvesglobalsolutionsgroup-rgb/cc-mario-sanchez-comercial.git)  
> **Despliegue en Producción Vercel**: [https://cc-mario-sanchez-comercial.vercel.app](https://cc-mario-sanchez-comercial.vercel.app)  
> **Ubicación Física**: Av. Municipal, Puerto La Cruz, Anzoátegui, Venezuela (Área total: 5.190 m²)  
> **Marco Legal**: Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (*Gaceta Oficial N° 40.418*)

---

## 1. Misión del Proyecto y Continuidad para Nuevos Agentes / Desarrolladores

Este documento sirve como **especificación técnica maestra** y memoria viva del sistema. Si tomas este proyecto tras el relevo de un agente previo, aquí tienes la radiografía exacta de lo construido, las reglas de negocio y las directrices arquitectónicas que debes preservar.

### Principios Inquebrantables del Sistema:
1. **Cero Dependencias de Pago**: La suite funciona 100% con herramientas gratuitas (Vercel Free, GitHub, Supabase Free, APIs públicas sin API key de pago, CDNs sin costo).
2. **Separación Estricta de Contextos (Seguridad & UX)**:
   - El público general y posibles arrendatarios interactúan con el portal comercial (`/` y `/alquiler`).
   - El personal administrativo y arrendatarios acreditados acceden al ERP interno a través del portal protegido (`/login` -> `/gestion`).
3. **Modo Claro (Light Executive) y Modo Oscuro (Dark Luxury) Unificado**:
   - Todo color está tokenizado mediante CSS semántico en `css/dashboard.css`.
   - Cero estilos *hardcodeados*. Compatibilidad total de contraste en `<select>` y `<option>` (Windows/Chromium).
4. **Símbolos Monetarios y Precisión Bancaria**:
   - Prohibido el uso de glifos ambiguos (ej. no usar caracteres que se confundan con rupias).
   - Formato estandarizado:
     * `$ 1,234.56 USD` (Dólar Estadounidense)
     * `€ 1.234,56 EUR` (Euro)
     * `Bs. 1.234,56` (Bolívar a tasa oficial BCV)
     * `USDT 1,234.56` (Tether TRC20 con paridad 1:1)

---

## 2. Mapa de Rutas y Arquitectura de Navegación

```
CC MARIO SÁNCHEZ
│
├── 🌐 PÚBLICO
│   ├── /                        -> index.html (Landing Comercial, Hero Drone PLC, Simulador, Leads WA)
│   └── /alquiler                -> alquiler.html (Catálogo GIS de 10 Unidades, Filtros, Fichas Técnicas)
│
├── 🔐 ACCESO & SEGURIDAD
│   └── /login                   -> gestion/login.html (Acceso 1-click Demo Admin e Inquilino)
│
└── 💼 PRIVADO (ERP INMOBILIARIO)
    ├── /gestion                 -> gestion/index.html (Dashboard Multimoneda, Recaudación, KPIs)
    │   ├── Locales & Inquilinos (Expediente Legal Art. 25 G.O. 40.418)
    │   ├── Cobranzas & Recibos  (Conciliación de Pagos + Carga de Comprobantes Voucher/PDF)
    │   ├── Gastos Comunes       (Condominio distribuido por alícuota m²)
    │   ├── Calendario           (Vencimientos y sincronización con Google Calendar)
    │   ├── Alertas              (Despacho rápido WhatsApp Web y Gmail con plantillas dinámicas)
    │   └── Configuración App    (Ajuste de cuotas $/m², días de corte y editor de plantillas)
    │
    └── /onboarding              -> gestion/onboarding.html (Wizard 4 Pasos: Unidad, Inquilino, Contrato, Emisión)
```

---

## 3. Especificaciones de Módulos Construidos

### A. Motor Financiero Cuatrimoneda (`js/financial-engine.js`)
- **Tasa Oficial BCV Automatizada**:
  * Consumo asíncrono del endpoint gratuito: `https://ve.dolarapi.com/v1/dolares/oficial`.
  * Botón de recarga en tiempo real `<button onclick="syncBcvRate()">` con icono animado `fa-spin`.
  * Opción de edición manual de emergencia con validación numérica.
- **Snapshot Financiero Histórico**: Cada pago registrado almacena la tasa oficial y las 4 equivalencias a la fecha valor, protegiendo contablemente la operación bajo la G.O. 40.418.
- **Validador de Transacciones Cripto (TxID)**: Validación regex de hashes hexadecimales de 64 caracteres para redes TRON (TRC20) y BSC (BEP20) con enlace directo a Tronscan / BscScan.

### B. Módulo de Carga y Registro de Comprobantes de Pago
- Integrado en el Modal de Pago (`#modal-payment`) de `/gestion`.
- Soporte para adjuntar archivos tipo Imagen (`.jpg`, `.png`, `.webp`) y documentos `.pdf` (hasta 5MB).
- Serialización automática en DataURL / Base64 para almacenamiento instantáneo y auditoría directa.
- Botón visual de inspección (`<i class="fa-solid fa-paperclip"></i>`) en la tabla de cobranzas para visualizar el comprobante adjunto en una pestaña emergente.

### C. Módulo de Configuración del Sistema
- Accesible mediante el icono de engranaje en la cabecera superior y la pestaña lateral `Configuración del Sistema`.
- **Submódulo 1: Cánones & Gastos Comunes**:
  * Cuota base por m² para Locales Comerciales ($4.5/m²), Macro-Lotes ($2.3/m²) y Galpones ($2.5/m²).
  * Alícuota porcentual base de gastos comunes de condominio.
- **Submódulo 2: Alertas & Calendario**:
  * Día de corte mensual configurable (por defecto día 5).
  * Anticipación en días para avisos preventivos (por defecto 3 días antes).
  * Días de gracia antes de marcar en estado `en_mora` (por defecto 5 días).
- **Submódulo 3: Editor de Plantillas de Mensajería**:
  * Editor en tiempo real para avisos preventivos y alertas de mora con variables dinámicas:
    `{inquilino}`, `{unidad}`, `{periodo}`, `{monto_usd}`, `{monto_bs}`, `{tasa_bcv}`, `{fecha_limite}`.
  * Botón de restauración a la plantilla legal predeterminada.

### D. Base de Datos Relacional (`supabase/migrations/`)
- DDL PostgreSQL completo con 8 tablas relacionales:
  * `commercial_units`, `tenants`, `contracts`, `invoices`, `payments`, `condo_expenses`, `app_settings` y `audit_logs`.
- Políticas de Seguridad a Nivel de Fila (RLS) para Administradores e Inquilinos.
- Persistencia dual: funciona sin fricción localmente vía `LocalStorage` y se conecta a Supabase remoto al suministrar las variables de entorno.

---

## 4. Estructura de Archivos del Repositorio

```
cc-mario-sanchez-comercial/
├── index.html                   # Landing page pública optimizada
├── alquiler.html                # Catálogo interactivo de locales y mapa GIS
├── logo_cc_mario_sanchez.svg    # Isotipo heráldico MS (38px x 38px)
├── puerto_la_cruz_drone.webp    # Fotografía aérea desktop
├── puerto_la_cruz_drone_mobile.webp # Fotografía aérea móvil (9:16)
├── vercel.json                  # Reglas de enrutamiento limpio (Clean URLs & Rewrites)
├── README.md                    # Documentación maestra del sistema
│
├── css/
│   └── dashboard.css            # Hoja de estilos compartida con matriz Dark/Light tokens
│
├── js/
│   ├── financial-engine.js      # Motor cuatrimoneda y consumo de DolarApi
│   ├── supabase-client.js       # Base de datos y configuración del sistema
│   ├── app.js                   # Controlador interactivo del dashboard
│   ├── venezuela-legal.js       # Calculadora de prórrogas legales (Art. 25)
│   └── google-workspace.js      # Integrador de enlaces WhatsApp, Gmail y Calendar
│
├── gestion/                     # Portal Administrativo ERP (Protegido)
│   ├── index.html               # Tablero principal de cobranzas y configuración
│   ├── login.html               # Pantalla de acceso con botones 1-click Demo
│   ├── onboarding.html          # Asistente de registro legal de inquilinos
│   ├── css/dashboard.css        # Estilos sincronizados del ERP
│   └── js/                      # Scripts sincronizados del ERP
│
└── supabase/                    # Configuración de base de datos PostgreSQL
    ├── config.toml              # Configuración local de Supabase CLI
    ├── schema.sql               # Esquema DDL
    ├── seed_data.sql            # Datos de prueba iniciales
    └── migrations/              # Historial de migraciones SQL
```

---

## 5. Guía de Ejecución y Despliegue

### Probar en Local:
```bash
# Iniciar servidor HTTP en el puerto 5500
python -m http.server 5500
# Abrir en el navegador: http://localhost:5500
```

### Desplegar en Producción (Vercel):
```bash
# Despliegue directo sin costo
npx vercel --prod --yes
```

---

## 6. Próximos Pasos Recomendados para Nuevos Agentes
1. **Conexión de Supabase en la Nube**: Añadir `ccms_supabase_url` y `ccms_supabase_key` en el panel de configuración de la app para habilitar sincronización en tiempo real multi-usuario en la nube.
2. **Generación de PDF en Cliente**: Integrar librería ligera como `jspdf` o `html2pdf.js` para descarga directa de contratos y recibos sin depender del diálogo de impresión nativo del navegador.
3. **Webhook de Pagos Automáticos**: Conectar notificaciones automáticas de transferencias bancarias o webhooks de pasarelas nacionales venezolanas.
