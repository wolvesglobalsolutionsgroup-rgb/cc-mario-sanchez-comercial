# Auditoría Técnica Integral — CC Mario Sánchez (Suite Portal + ERP)

**Auditor:** Arquitecto Senior / Auditor Técnico (Claude)
**Fecha:** 2026-09-03
**Alcance:** `C:\Users\Administrator\Desktop\Memoria\cc-mario-sanchez-comercial`
**Repositorio remoto:** `wolvesglobalsolutionsgroup-rgb/cc-mario-sanchez-comercial` (rama `main`, sincronizada con `origin`)
**Commit HEAD auditado:** `d02b545` — `fix(ui-ux): reduce hero bottom fade and first-section padding to eliminate visual gap`
**Cambios sin commitear al momento de la auditoría:** `index.html` (fix de gap del hero, ver sección 6)
**Producción:** `https://cc-mario-sanchez-comercial.vercel.app` (verificado por HTTP en vivo durante esta auditoría)
**Modo de trabajo:** Solo lectura. No se modificó, movió ni eliminó ningún archivo del proyecto. No se hizo commit, push ni deploy.

Nota: Existe un informe previo (`AUDITORIA_CC_MARIO_SANCHEZ_2026-09-03.md`) generado el mismo día por otro proceso/agente. Este documento es una auditoría independiente, más extensa y con verificación en vivo de rutas de producción; sus conclusiones son consistentes con las de ese informe y las amplían.

---

## 1. Resumen ejecutivo

El proyecto es una **SPA estática multi-página** (HTML+CSS+JS vanilla, sin build step, sin framework, sin backend propio) que implementa un portal público comercial y un ERP inmobiliario de gestión de arrendamiento para un centro comercial en Puerto La Cruz, Venezuela. El código es limpio, organizado y sin patrones maliciosos. El motor financiero multi-moneda con tasa BCV en vivo, el catálogo público, el flujo de onboarding y el dashboard de cobranzas **están genuinamente implementados y funcionan**, pero **todo el sistema opera sobre `localStorage` del navegador**: no hay backend real conectado, la "conexión a Supabase" está declarada pero nunca invocada, la autenticación es enteramente del lado del cliente con credenciales demo embebidas, y las políticas RLS de la base de datos (aunque el esquema es correcto) no aíslan a los inquilinos entre sí.

En términos simples: **es una maqueta de alta fidelidad, no un ERP en producción.** Es completamente inapropiado para manejar datos reales de arrendatarios, pagos o comprobantes hasta que se implemente un backend con autenticación y autorización verificables en servidor.

Adicionalmente, se confirmó en vivo que **las rutas limpias `/login` y `/onboarding` devuelven 404 en producción** pese a estar correctamente configuradas y comprometidas en `vercel.json` desde el commit `8d57ca5`, indicando una discrepancia entre el repositorio y la configuración/despliegue efectivo en el panel de Vercel.

**Veredicto: CON-CAMBIOS.** Ver sección 17.

---

## 2. Mapa real del proyecto

```
cc-mario-sanchez-comercial/          (fuente de verdad — repo Git, sincronizado con GitHub)
├── index.html                       Portal público — landing (REAL, hero + catálogo embebido + formulario lead)
├── alquiler.html                    Portal público — catálogo GIS de 10 unidades (REAL, dataset propio hardcodeado)
├── vercel.json                      Rewrites de rutas limpias (comprometido, pero no reflejado 100% en prod)
├── README.md                        Documentación maestra (desactualizada respecto al código, ver §4/§8)
├── css/                             Carpeta VACÍA — referenciada en README pero sin archivo real (root usa <style> inline)
├── js/                              Carpeta declarada en README.md — NO EXISTE en el árbol real (los scripts reales
│                                    solo existen dentro de gestion/js/); index.html y alquiler.html no cargan
│                                    financial-engine.js, supabase-client.js, app.js, etc. — usan JS embebido propio.
├── gestion/                         ERP privado — fuente de verdad real de la app de gestión
│   ├── index.html                   Dashboard (REAL, SPA de una sola vista con secciones)
│   ├── login.html                   Login con credenciales demo (REAL pero solo cliente)
│   ├── onboarding.html              Wizard de 4 pasos (REAL, escribe a localStorage)
│   ├── css/dashboard.css            Hoja de estilos del ERP (única fuente real de dashboard.css)
│   ├── js/auth-guard.js             Autenticación demo SHA-256 client-side (REAL pero inseguro)
│   ├── js/supabase-client.js        Motor de persistencia — 100% localStorage, Supabase NO conectado
│   ├── js/app.js                    Controlador del dashboard (REAL, usa innerHTML sin sanitizar)
│   ├── js/financial-engine.js       Motor 4-monedas + fetch real a dolarapi.com (REAL y funcional)
│   ├── js/venezuela-legal.js        Calculadora de prórroga legal Art. 25 (REAL)
│   ├── js/notifications.js          Notificaciones — transporte mailto/webhook (REAL, sin proveedor conectado)
│   ├── js/google-workspace.js       Generador de enlaces (Calendar/Gmail/WhatsApp) — NO es sync real (ver §C)
│   └── supabase/                    Copia duplicada de supabase/schema.sql y seed_data.sql (idéntica, byte a byte)
├── supabase/                        Definición real de base de datos
│   ├── config.toml                  Config CLI local de Supabase
│   ├── schema.sql                   DDL — 10 tablas (no 8 como dice el README, ver §4)
│   ├── seed_data.sql                Datos semilla
│   └── migrations/20260904000340_init_ccms_erp.sql   Migración única aplicada
├── .vercel/                          Metadata de proyecto Vercel (ignorado por git salvo README.txt)
└── _backup_duplicates/              Copias de respaldo de una limpieza anterior — IGNORADO por .gitignore,
                                      no forma parte del runtime ni del repo remoto. Contiene versiones previas
                                      de app.js, auth-guard.js, login.html, landing.html, scripts de verificación
                                      Node ad-hoc y JSON de respuestas de la API de Vercel/GitHub (algunos con
                                      tokens de proyecto potencialmente sensibles — ver §7).
```

**Relación con `C:\Users\Administrator\Desktop\Memoria\Proyecto Centro Comercial Mario Sánchez`:**
Es un árbol **histórico y separado**, no forma parte del repositorio Git de `cc-mario-sanchez-comercial` y no fue tocado por esta auditoría. Contiene tres módulos (`01_Levantamiento_Tecnico_GIS`, `02_Portal_Comercial_Web`, `03_Gestion_Inquilinos_SaaS`) y, además, una copia suelta de `index.html`/`README.md`/`vercel.json` en su propia raíz que **no está relacionada con el repo Git activo** — es un remanente de una iteración anterior del proyecto antes de que se moviera a su propio repositorio. Existe también `03_ARCHIVO_MARIO_SANCHEZ` en la raíz de `Memoria`, que según el histórico de la carpeta ya recibió archivos sueltos antiguos apartados de la raíz de `Memoria`. **Recomendación:** no fusionar estos árboles; si contienen material de referencia (planos GIS, levantamiento técnico) que aún es válido, versionarlo aparte, no dentro del repo Git de la app.

No se detectó mezcla con Industrial-360, PDVSA, Semax ni otros proyectos del directorio `Memoria` — el proyecto está correctamente aislado en su propia carpeta y su propio repositorio Git.

---

## 3. Fuente de verdad recomendada

**`C:\Users\Administrator\Desktop\Memoria\cc-mario-sanchez-comercial`** (repo Git sincronizado con `origin/main`) es la única fuente de verdad operativa. Dentro de ella:

- **Frontend privado (ERP):** `gestion/` es la fuente real. El árbol `js/` y `css/` declarados en la raíz del README **no existen** como tal — deben eliminarse del README o crearse realmente si la intención original era que `index.html`/`alquiler.html` reutilizaran esos módulos (actualmente no lo hacen, tienen su propio catálogo hardcodeado y su propio `<style>`).
- **Base de datos:** `supabase/schema.sql` + `supabase/migrations/20260904000340_init_ccms_erp.sql` (idénticos a su copia en `gestion/supabase/`, que es 100% redundante y debe eliminarse, dejando una sola copia y que `gestion/` la referencie o documente por qué existe duplicada).
- **`_backup_duplicates/`** no es fuente de verdad de nada; es un directorio de transición de una limpieza previa. Ver §16 sobre riesgos de removerlo.

---

## 4. Tabla de funcionalidades

| Módulo | Estado | Evidencia |
|---|---|---|
| Portal público (`index.html`) | **Funcional** | Landing completa, hero, simulador de metraje, formulario de leads con redirección a WhatsApp. Contenido real, sin backend (no requiere uno). |
| Catálogo de alquiler (`alquiler.html`) | **Funcional (aislado)** | Dataset propio `const catalog = [...]` (línea 976), con 10 unidades. **No está sincronizado** con el dataset del ERP en `gestion/js/supabase-client.js` (nombres/estados pueden divergir — ej. una unidad puede figurar "disponible" en el catálogo público y "arrendada" en el ERP sin que nada las reconcilie). |
| Login | **Funcional pero solo demo / client-side** | `gestion/js/auth-guard.js:25-45` (usuarios hardcodeados), `gestion/login.html:166-167` (contraseñas demo en texto plano en el propio HTML). No hay verificación en servidor. |
| Dashboard ERP | **Funcional (UI) / datos 100% locales** | Todas las secciones renderizan y calculan correctamente sobre datos de `localStorage`. Sin persistencia multi-usuario ni multi-dispositivo real. |
| Onboarding | **Funcional** | Wizard de 4 pasos que escribe un nuevo inquilino/contrato a `localStorage` (`gestion/onboarding.html:402-429`). Sin sanitización de los campos de texto libre. |
| Motor financiero (4 monedas) | **Funcional** | `gestion/js/financial-engine.js:52-60` hace `fetch()` real a `https://ve.dolarapi.com/v1/dolares/oficial` (API pública gratuita, sin key). Conversión y snapshot histórico funcionan. |
| Cobranzas | **Funcional (local)** | Registro y conciliación de pagos completo en `app.js`, pero no hay pasarela de pago real ni verificación bancaria — es un registro manual de lo que el admin declara haber recibido. |
| Comprobantes | **Funcional pero inseguro** | Carga y visualización de comprobantes vía `FileReader.readAsDataURL` (`app.js:765,774`), almacenados como Base64 dentro del mismo `localStorage` de la app — sin control de acceso, cifrado ni límite real de retención. |
| Alertas (WhatsApp / correo) | **Parcial** | Los mensajes se generan y despachan correctamente vía enlaces `wa.me` y `mailto:` (`notifications.js`, `google-workspace.js`). El transporte `webhook` existe en el código pero **no hay ningún proveedor configurado**; no se envía correo real de forma automática sin intervención manual del usuario en su cliente de correo. |
| Calendario | **Parcial / mal descrito** | `google-workspace.js:createCalendarUrl` solo genera un enlace `calendar.google.com/render?action=TEMPLATE...` que el admin debe abrir y guardar manualmente. **No es una "sincronización"** como indica el README — no hay OAuth, no hay API de Calendar, no hay creación automática de eventos. |
| Conversión BCV | **Funcional** | Confirmado, ver Motor financiero arriba. |
| Multi-moneda | **Funcional** | USD/EUR/VES/USDT soportados end-to-end en cálculo y visualización. |
| Modo demo | **Funcional** | Botones "Demo Admin" / "Demo Inquilino" auto-rellenan credenciales (`gestion/login.html:198`). |
| Modo producción | **Inexistente como modo distinto** | No existe una bandera de entorno real ni separación de build. El único "interruptor" hacia producción es rellenar `ccms_supabase_url`/`ccms_supabase_key` en Configuración, pero como se documenta en §5/§8, **aunque se rellenen esos campos, el código nunca los usa para hacer una sola llamada de red a Supabase.** Es efectivamente un solo modo (local) disfrazado de dos. |
| Conexión Supabase | **Simulada / declarada, no implementada** | Ver hallazgo P0 en §5. |
| Aislamiento admin/inquilino (RLS) | **Simulada** | Las políticas existen y se activan, pero autorizan a cualquier usuario autenticado por igual — no hay aislamiento real. Ver §5/§8. |

---

## 5. Hallazgos críticos

### P0-1 — Autenticación exclusivamente del lado del cliente
- **Archivo:** `gestion/js/auth-guard.js:25-45` (usuarios y hashes demo), `:130` (comparación de hash en el navegador), `:163-177` (función `require()` que decide acceso).
- **Archivo:** `gestion/login.html:166-167` (contraseñas demo **en texto plano**, no solo hasheadas).
- **Evidencia:** El arreglo `USERS_DEMO` con `identifier` y `password_sha256` viaja íntegro al navegador de cualquier visitante. `login.html` además incluye `password: 'Admin2026*'` y `password: 'Demo2026*'` literalmente en el HTML servido.
- **Impacto:** Cualquier persona con acceso a "Ver código fuente" obtiene las credenciales admin en texto plano. Además, la sesión (`localStorage` `ccms_session`) puede fabricarse manualmente en la consola del navegador sin pasar por `login()`, otorgando rol `admin` a voluntad.
- **Solución recomendada:** Migrar a Supabase Auth (o backend propio) con verificación de contraseña y emisión de sesión/JWT en servidor; eliminar `USERS_DEMO` y las contraseñas en texto plano del HTML; si se necesita un modo demo, usar una cuenta real con permisos limitados, nunca credenciales embebidas en el cliente.
- **Criterio de verificación:** Inspeccionar el código fuente servido de `login.html` y confirmar que no contiene contraseñas ni hashes; confirmar que `require()` valida contra una sesión emitida por el servidor (cookie httpOnly o JWT verificado), no contra un objeto en `localStorage` que el propio cliente puede escribir.

### P0-2 — Supabase declarado pero nunca conectado
- **Archivo:** `gestion/js/supabase-client.js:11-13` (lee `ccms_supabase_url`/`ccms_supabase_key` y calcula `isSupabaseConfigured`).
- **Evidencia:** Se buscó en todo el archivo (550 líneas) cualquier `fetch(`, `createClient(` o referencia al SDK `@supabase/supabase-js`: **no existe ninguna.** `isSupabaseConfigured` se calcula en la línea 13 y **nunca vuelve a leerse en el resto del archivo** — es una bandera muerta. Toda lectura/escritura (`initDatabase`, `seedInitialData`, y los métodos CRUD del resto del archivo) opera exclusivamente sobre `localStorage.getItem(this.storageKey)` / `localStorage.setItem(...)` (líneas 374, 388, entre otras).
- **Impacto:** El README (§3.D, §6.1) y el panel de "Configuración" del ERP prometen persistencia remota multi-usuario que **no existe en el código**. Cualquier cliente que configure sus credenciales de Supabase creyendo que activa sincronización en la nube seguirá operando 100% local, sin advertencia alguna en la UI.
- **Solución recomendada:** O se implementa realmente el cliente Supabase (SDK oficial, llamadas REST con RLS activo), o se elimina la promesa de "persistencia dual" del README y de la UI de configuración, dejando claro que el sistema es local-only hasta nuevo aviso.
- **Criterio de verificación:** Con credenciales Supabase válidas configuradas, un cambio hecho en un navegador debe reflejarse en otro navegador/dispositivo distinto sin recurrir a exportar/importar manualmente.

### P0-3 — RLS activo pero sin aislamiento real por rol o inquilino
- **Archivo:** `supabase/migrations/20260904000340_init_ccms_erp.sql:179-188` (RLS habilitado en las 10 tablas), `:194-203` (políticas).
- **Evidencia:** Todas las políticas administrativas usan `FOR ALL USING (auth.role() = 'authenticated')` — es decir, cualquier usuario autenticado (sin distinguir admin de inquilino, ni un inquilino de otro) tiene lectura y escritura total sobre `tenants`, `contracts`, `invoices`, `payments`, `transactions` y `audit_logs`. No hay ninguna política que use `auth.uid()` ni una tabla de relación usuario↔`tenant_id`.
- **Impacto:** Si Supabase llegara a conectarse (ver P0-2) sin corregir esto primero, cualquier inquilino autenticado podría leer o modificar los datos financieros y de contrato de **todos los demás inquilinos**, y del propio administrador.
- **Solución recomendada:** Crear tabla/relación `user_id ↔ tenant_id`; reescribir políticas para que los inquilinos solo puedan `SELECT` sus propias filas (`tenant_id = (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())`), y que solo el rol `admin` (via `auth.jwt() ->> 'role'` o tabla de roles) tenga `FOR ALL`. Escribir pruebas negativas (un inquilino no debe poder ver filas de otro).
- **Criterio de verificación:** Con dos usuarios inquilino de prueba autenticados por separado, cada uno solo debe poder leer/escribir sus propias facturas y pagos; intentos de acceso cruzado deben devolver 0 filas o error de política, no datos.

### P1-1 — Rutas limpias `/login` y `/onboarding` devuelven 404 en producción
- **Archivo:** `vercel.json:8-9` (reglas presentes y comprometidas desde el commit `8d57ca5`, `git log -p` confirma que siguen intactas en HEAD `d02b545`).
- **Evidencia verificada en vivo durante esta auditoría** (no es una suposición del README):

  | Ruta | Resultado HTTP real |
  |---|---:|
  | `/` | 200 |
  | `/gestion` | 200 |
  | `/gestion/login.html` | 200 |
  | `/login` | **404** |
  | `/onboarding` | **404** |

- **Impacto:** El flujo de navegación "amigable" documentado en el README no funciona para el usuario final; solo las rutas directas a `.html` funcionan. Cualquier enlace o botón que apunte a `/login` o `/onboarding` (en vez de a `gestion/login.html`) está roto en producción.
- **Solución recomendada:** Revisar en el panel de Vercel del proyecto si la "Production Branch" y el alias de dominio realmente apuntan al último commit de `main`, y si hay reglas de rewrite/redirect configuradas manualmente en el dashboard de Vercel que estén pisando `vercel.json`. Forzar un nuevo despliegue de producción (`vercel --prod`) y re-verificar.
- **Criterio de verificación:** `curl -I https://cc-mario-sanchez-comercial.vercel.app/login` y `/onboarding` deben devolver `200`.

### P1-2 — Inyección HTML no sanitizada en datos capturados por formularios (XSS almacenado, exploit real de punta a punta)
- **Archivo (entrada):** `gestion/onboarding.html:402-404` — `document.getElementById('ob-business-name').value.trim()` se toma tal cual, sin escapar, y se persiste en `localStorage` como `tenant.business_name`.
- **Archivo (salida):** `gestion/js/app.js:302-317` — `tr.innerHTML = \`...${tenant.business_name}...${tenant.rif}...\`` interpola ese mismo valor sin escapar dentro de una tabla renderizada con `innerHTML`. Hay 17 usos de `.innerHTML` en `app.js` (líneas 39, 280, 302, 347, 356, 520, 529, 531, 537, 554 y siguientes), varios de los cuales interpolan datos de inquilinos/facturas.
- **Impacto:** Un usuario que complete el wizard de onboarding con `<img src=x onerror=alert(1)>` como razón social insertará ese payload en el DOM sin sanitizar la próxima vez que el admin (o el propio inquilino, en su vista) abra el dashboard. Es un vector de XSS almacenado completo y verificado, no teórico.
- **Solución recomendada:** Usar `textContent` para todos los campos de texto libre, o una función de escape HTML consistente (el propio `auth-guard.js:escapeHtml`, ya existente en el proyecto, no se reutiliza en `app.js`) antes de interpolar en plantillas `innerHTML`.
- **Criterio de verificación:** Registrar un inquilino con un payload HTML/JS en `business_name`/`trade_name` y confirmar que se renderiza como texto plano, no se ejecuta.

### P1-3 — Comprobantes de pago en Base64 dentro de `localStorage`
- **Archivo:** `gestion/js/app.js:746-774` (`FileReader.readAsDataURL`, guardado como `data: evt.target.result`), `:785-800` (visor que inyecta `proof.data` como `src` de una imagen).
- **Impacto:** Documentos potencialmente sensibles (comprobantes bancarios) quedan expuestos a cualquier script que corra en el mismo origen, sin cifrado, sin control de acceso por usuario y sujetos al límite de ~5-10 MB de `localStorage` del navegador.
- **Solución recomendada:** Subir a un bucket de Storage privado (Supabase Storage con política de acceso por `tenant_id`/rol) y guardar solo la URL firmada de corta duración, no el binario.
- **Criterio de verificación:** Un comprobante subido no debe ser legible abriendo las DevTools → Application → Local Storage sin autenticación adicional.

### P2-1 — Documentación (README) desalineada con el esquema real de base de datos
- **Archivo:** `README.md` (sección 3.D) dice "8 tablas relacionales: `commercial_units`, `tenants`, `contracts`, `invoices`, `payments`, `condo_expenses`, `app_settings` y `audit_logs`".
- **Evidencia real:** `supabase/schema.sql` y la migración `20260904000340_init_ccms_erp.sql` definen **10 tablas**: `chart_of_accounts`, `units` (no `commercial_units`), `tenants`, `contracts`, `condo_expenses`, `invoices`, `payments`, `transactions`, `alerts`, `audit_logs`. No existe ninguna tabla `app_settings` — esos parámetros solo se guardan en `localStorage` bajo otra clave.
- **Impacto:** Cualquier desarrollador nuevo (humano o agente) que confíe en el README para escribir queries fallará por nombres de tabla inexistentes.
- **Solución recomendada:** Regenerar la sección 3.D del README a partir del `schema.sql` real, o generarla automáticamente con un script.
- **Criterio de verificación:** Cada nombre de tabla citado en el README debe existir literalmente en `schema.sql`.

### P2-2 — Duplicación de esquema y datos semilla SQL
- **Archivos:** `supabase/schema.sql` y `gestion/supabase/schema.sql` son **idénticos byte a byte** (mismo hash SHA-256); igual para `supabase/seed_data.sql` y `gestion/supabase/seed_data.sql`.
- **Impacto:** Riesgo de divergencia silenciosa si alguien edita una copia y no la otra.
- **Solución recomendada:** Eliminar `gestion/supabase/` por completo; no hay ninguna referencia de código que la use (el frontend en `gestion/` no lee SQL directamente, solo `localStorage`).
- **Criterio de verificación:** `gestion/supabase/` no existe tras la limpieza y ningún build/require lo referenciaba.

### P2-3 — "Sincronización con Google Calendar" mal descrita
- **Archivo:** `gestion/js/google-workspace.js:createCalendarUrl` (líneas ~14-28).
- **Evidencia:** Solo construye una URL `https://calendar.google.com/render?action=TEMPLATE&...` para que el usuario la abra manualmente y pulse "Guardar" en su propia cuenta de Google. No hay OAuth, no hay llamada a Google Calendar API, no hay persistencia automática del evento.
- **Impacto:** Expectativa incorrecta de automatización para el cliente final del sistema.
- **Solución recomendada:** Renombrar la funcionalidad en README y en la UI como "Agregar a Google Calendar (manual)" en vez de "Sincronización", o implementar la integración real vía OAuth 2.0 + Calendar API si se requiere automatización.
- **Criterio de verificación:** El texto de la UI/README coincide con el comportamiento real (enlace manual vs. sync automático).

### P2-4 — Catálogo público desincronizado del inventario del ERP
- **Archivo:** `alquiler.html:976` (`const catalog = [...]`, dataset propio) vs. `gestion/js/supabase-client.js` (`units: [...]`, dataset propio del ERP).
- **Impacto:** El estado "disponible/arrendado" que ve el público en `/alquiler` puede no coincidir con el estado real gestionado en el ERP, porque son dos arreglos hardcodeados independientes sin ninguna fuente común.
- **Solución recomendada:** Una sola fuente de datos de unidades (idealmente la futura tabla `units` de Supabase, expuesta públicamente solo en modo lectura vía la política `"Unidades publicas" ... FOR SELECT USING (true)` que **ya existe** en la migración, línea 191) consumida tanto por el portal público como por el ERP.
- **Criterio de verificación:** Cambiar el estado de una unidad en el ERP se refleja en `/alquiler` sin editar manualmente dos archivos.

### P3-1 — Carpetas `js/` y `css/` del README no existen en la raíz del repo
- **Evidencia:** README §4 describe `js/financial-engine.js`, `js/supabase-client.js`, etc. en la raíz; en el árbol real esos archivos **solo existen dentro de `gestion/js/`**. La carpeta raíz `css/` existe pero está vacía.
- **Impacto:** Bajo (no rompe nada en runtime porque `index.html`/`alquiler.html` no referencian esos paths), pero es confuso para cualquier agente que audite el proyecto guiándose por el README.
- **Solución recomendada:** Eliminar la carpeta `css/` vacía y corregir el árbol de archivos documentado en el README §4.

### P3-2 — Ausencia total de tooling de calidad
- **Evidencia:** No existe `package.json`, lockfile, linter, formateador ni pipeline CI en el repo.
- **Impacto:** No hay forma automatizada de detectar regresiones (como la propia P1-2) antes de hacer push.
- **Solución recomendada:** Agregar `package.json` mínimo con ESLint + un `pre-commit` (o GitHub Action) que corra `node --check` sobre los `.js` como mínimo.

---

## 6. Análisis específico del gap del hero

**Causa raíz confirmada — no es un problema de despliegue desactualizado, es CSS.**

1. `.hero-canvas` (`index.html`, bloque `<style>` en `<head>`) usa `min-height: 100vh` y termina en un pseudo-elemento `::after` (líneas ~112-125) que dibuja un degradado de 120px de alto, de `transparent` a `#04070d` (el mismo color de fondo de la sección siguiente), para disimular el corte de la imagen del hero.
2. Inmediatamente después, la sección `#servicios` (`Todo lo que tu Negocio Necesita`) usaba la clase de utilidad Tailwind `py-24` (96px de padding arriba y abajo) — commit histórico antes de `d02b545`.
3. El resultado visual era: 120px de degradado (ya sólido en color de fondo, sin contenido) **+ 96px adicionales de padding vacío** antes de que aparezca el texto "Infraestructura de Primera" — un hueco visual de ~216px sin ningún elemento.
4. Había además una regla propia `.hero-canvas + section { padding-top: 2rem; }` (eliminada en el diff pendiente) que **intentaba** corregir esto, pero perdía la pulseada de especificidad: Tailwind CDN (`<script src="https://cdn.tailwindcss.com">`) inyecta su hoja de estilos generada dinámicamente en tiempo de ejecución, típicamente **después** en el CSSOM que un `<style>` estático de igual especificidad (0,1,0) declarado antes en el documento — por lo que la utilidad `.py-24` ganaba la cascada por orden de aparición efectivo, no por especificidad numérica.
5. **No es un problema de DOM, de altura de `hero-canvas`, de viewport ni de responsive** — el mismo patrón de exceso de padding aparece igual en desktop y mobile porque `#servicios` no tiene una regla de media query distinta para el padding superior.

**Estado del fix:** Ya aplicado **localmente pero no comprometido** (`git diff index.html` confirmado en esta auditoría): se eliminó la regla `.hero-canvas + section { padding-top: 2rem; }` (que era redundante e inefectiva) y se cambió la clase de la sección de `py-24` a `pt-8 pb-24` (`index.html:363`), reduciendo el padding superior de 96px a 32px y dejando el fade del hero intacto. Esto reduce el hueco visual de ~216px a ~152px, eliminando el "salto" perceptible sin comprimir el fade de Minimax que evita el corte duro de la imagen.

**Pendiente:** Este cambio **vive solo en la copia local** de `index.html`; no está comprometido ni desplegado. Hasta que se haga commit + push + redeploy, la producción sigue mostrando el gap de 216px.

---

## 7. Riesgos de seguridad

1. **Credenciales en texto plano en el cliente** (P0-1) — la más grave.
2. **Sesión falsificable desde la consola del navegador** — cualquier visitante puede ejecutar `localStorage.setItem('ccms_session', JSON.stringify({role:'admin', expires_at: Date.now()+999999999}))` y obtener acceso admin sin conocer ninguna contraseña, porque `require()` (`auth-guard.js:163`) solo valida la forma del objeto de sesión, no su origen.
3. **XSS almacenado end-to-end** (P1-2), explotable desde el propio formulario público de onboarding.
4. **Comprobantes sensibles sin control de acceso** (P1-3).
5. **`_backup_duplicates/gh_last_commit.json`, `gh_user.json`, `vercel_project_detail.json`, `vercel_projects.json`** — son respuestas JSON crudas de las APIs de GitHub/Vercel guardadas por scripts de verificación de despliegues anteriores. No se inspeccionó su contenido línea por línea (fuera del alcance de esta auditoría por directriz de no exponer secretos), pero **por tipo de archivo son candidatos típicos a contener tokens de API o metadata de proyecto sensible**. Recomendación: revisar manualmente ese directorio y purgar cualquier token antes de conservarlo, aunque esté fuera del árbol Git.
6. **Dependencias de CDN sin integridad fijada** — Tailwind CDN, Font Awesome y Google Fonts se cargan sin atributo `integrity` (a diferencia de Leaflet, que sí lo tiene, `index.html:22-23`). Un compromiso de esos CDN afectaría directamente al sitio.
7. **Ningún control de tasa ni CAPTCHA** en el formulario de leads del portal público ni en el login — no es crítico para una demo, pero debe evaluarse antes de tráfico real.

No se detectaron patrones de malware, exfiltración automática, `eval`, ofuscación ni scripts de instalación en ningún archivo `.js` del proyecto.

---

## 8. Riesgos de datos y Supabase

- **P0-2 y P0-3** (arriba) son los riesgos centrales: no hay conexión real y, si se conectara tal cual está hoy, no habría aislamiento por inquilino.
- **Inconsistencia de nombres:** el frontend (`localStorage`) usa claves como `units`, `tenants`, `contracts` que **sí coinciden** con los nombres de tabla reales de `schema.sql` (`units`, `tenants`, `contracts`...) — esto es una buena señal para una futura migración, ya que el modelo de datos del cliente ya está alineado al esquema SQL real, no al del README desactualizado.
- **Doble fuente de catálogo público vs. ERP** (P2-4).
- **Sin auditoría real:** la tabla `audit_logs` existe en el esquema, pero `auth-guard.js:audit()` solo hace `console.log(...)` — nunca escribe a ninguna tabla ni a `localStorage`. La trazabilidad prometida por el nombre de la tabla no se materializa hoy.

---

## 9. Propuesta para proveedor de correo (Resend)

Arquitectura recomendada, consistente con la capa de abstracción que **ya existe** en `notifications.js` (transporte `webhook`), sin necesidad de reescribirla desde cero:

```
Navegador (gestion/js/notifications.js, transporte "webhook")
        │  POST { to, subject, body, from_name, from_email }
        ▼
Función serverless de Vercel  (/api/send-email.js)
        │  Lee RESEND_API_KEY desde variable de entorno de Vercel (nunca del cliente)
        │  Llama a la API de Resend con esa key
        ▼
Resend API  →  Entrega de correo real
```

- La función `/api/send-email.js` es la única pieza nueva de infraestructura necesaria (Vercel Functions, Node.js, sin costo en el plan free para volumen bajo).
- `notifications.js` ya soporta esto sin cambios de lógica: basta con `Notifications.configure({ transport: 'webhook', webhook_url: '/api/send-email' })` desde el panel de Configuración del admin.
- La API key de Resend **nunca** se expone al navegador — solo vive en `process.env.RESEND_API_KEY` en el runtime serverless.
- Para poder **cambiar de proveedor en el futuro** sin tocar el frontend: la función `/api/send-email.js` debe internamente delegar a un adaptador (`sendViaResend`, `sendViaSendgrid`, `sendViaPostmark`, ...) seleccionado por otra variable de entorno (`EMAIL_PROVIDER=resend`), manteniendo el mismo contrato `{to, subject, body, from_name, from_email} → {ok, status}` que ya expone `notifications.js` hacia el resto de la app.

**Plantillas propuestas** (usando el motor `renderTemplate` ya existente en `notifications.js`, variables `{inquilino} {unidad} {periodo} {monto_usd} {monto_bs} {tasa_bcv} {fecha_limite}`):

1. **Aviso de cobro** — emitido al generar la factura del período.
2. **Pago recibido** — confirmación automática al conciliar un pago en el dashboard (dispara `Notifications.email(...)` desde el mismo flujo que hoy solo muestra un `alert()` en `app.js:739`).
3. **Mora** — ya existe como `avisoMora` en `google-workspace.js` y como plantilla configurable en la UI; solo falta conectarlo al transporte real de correo.
4. **Vencimiento de contrato** — ya existe como `avisoVencimientoContrato` en `google-workspace.js`; falta el disparo automático (hoy es 100% manual).
5. **Comprobante recibido** — nueva plantilla, a enviar al inquilino como acuse de recibo cuando el admin marca su comprobante como conciliado.

---

## 10. Propuesta de arquitectura multi-cliente (plantilla reutilizable)

Extraer toda la configuración específica de un cliente a un único objeto `tenant-config.json` (o una tabla `app_settings` real en Supabase, resolviendo así también el hallazgo P2-1) consumido en tiempo de carga por `index.html`, `alquiler.html` y `gestion/`:

```json
{
  "business_name": "Centro Comercial Mario Sánchez",
  "legal_entity": "...",
  "logo_url": "/logo_cc_mario_sanchez.svg",
  "theme": { "amber": "#f59e0b", "cyan": "#0ea5e9", "void": "#04070d" },
  "address": "Av. Municipal, Puerto La Cruz, Anzoátegui, Venezuela",
  "phones": { "whatsapp_admin": "584247380002" },
  "emails": { "admin": "administracion@ccmariosanchez.com" },
  "hero_images": { "desktop": "puerto_la_cruz_drone.webp", "mobile": "puerto_la_cruz_drone_mobile.webp" },
  "units": "→ vendría de la tabla units de Supabase, no hardcodeada",
  "rates_per_m2": { "locales": 4.5, "macro_lotes": 2.3, "galpones": 2.5 },
  "currencies_enabled": ["USD", "EUR", "VES", "USDT"],
  "legal_framework_text": "Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial (G.O. 40.418)",
  "email_provider": "resend"
}
```

Pasos concretos:
1. Reemplazar todos los literales hoy embebidos en HTML/JS (nombre comercial, teléfonos, correos, colores Tailwind `brand.*`, textos legales, tarifas base) por lecturas de este objeto de configuración.
2. Mover el objeto a una tabla `app_settings` (clave/valor o columnas tipadas) en Supabase, con RLS de solo-lectura pública para lo no sensible (logo, colores, nombre) y protegido para lo sensible (tarifas, reglas legales).
3. El despliegue por cliente nuevo se reduce a: duplicar el proyecto en Vercel, crear un proyecto Supabase, cargar su `app_settings` y sus imágenes — cero cambios de código fuente.
4. El proveedor de correo ya queda resuelto de forma agnóstica por la arquitectura de la sección 9.

Este es un rediseño de mediano alcance, no cosmético — requiere tocar la mayoría de las plantillas HTML para leer de configuración en vez de texto fijo. Debe planificarse como su propia fase (ver Fase 4 abajo), no como un ajuste rápido.

---

## 11. Plan de mejoras por fases

**Fase 0 — Higiene inmediata (sin riesgo, reversible)**
- Comprometer y desplegar el fix del gap del hero (ya está listo localmente).
- Eliminar `gestion/supabase/` (duplicado exacto).
- Eliminar la carpeta `css/` vacía en la raíz y corregir el árbol de archivos del README.
- Corregir README §3.D con los 10 nombres de tabla reales.

**Fase 1 — Seguridad de acceso**
- Migrar autenticación a Supabase Auth (o backend propio) con verificación en servidor.
- Eliminar credenciales/hashes demo del cliente; si se conserva un modo demo, usar una cuenta real de alcance limitado.
- Corregir el 404 de `/login` y `/onboarding` en producción (revisar configuración de Vercel).

**Fase 2 — Datos reales y aislamiento**
- Implementar el cliente Supabase real en `supabase-client.js` (SDK oficial) reemplazando las llamadas a `localStorage` por REST/SDK, manteniendo `localStorage` solo como caché offline opcional.
- Reescribir las políticas RLS con `auth.uid()` + relación usuario↔inquilino.
- Pruebas negativas de aislamiento (un inquilino no ve datos de otro).

**Fase 3 — Endurecimiento**
- Sanitizar toda interpolación `innerHTML` (reutilizar `escapeHtml` de `auth-guard.js` o migrar a `textContent`/plantillas seguras).
- Mover comprobantes de Base64/`localStorage` a Supabase Storage con URLs firmadas.
- Conectar correo real (Resend) vía función serverless, según §9.

**Fase 4 — Adaptabilidad comercial**
- Extraer configuración multi-cliente según §10.
- Unificar el catálogo público y el inventario del ERP en una sola fuente (`units`).

**Fase 5 — Calidad continua**
- `package.json`, lint, y una GitHub Action mínima que corra `node --check` y, si se agregan pruebas, las ejecute en cada push.

---

## 12. Orden exacto recomendado de implementación

1. Fase 0 completa (bajo riesgo, alto valor documental/visual inmediato).
2. Fix de rutas `/login` y `/onboarding` en Vercel (Fase 1, primer ítem accionable, no depende de nada más).
3. Migración de autenticación a backend/Supabase Auth (Fase 1).
4. Cliente Supabase real + RLS correcto (Fase 2) — **debe hacerse junto**, nunca conectar datos reales antes de corregir RLS.
5. Sanitización de `innerHTML` y comprobantes a Storage (Fase 3) — puede paralelizarse con el paso 4 porque toca archivos distintos (`app.js` vs `supabase-client.js`), pero debe cerrarse antes de recibir datos reales de producción.
6. Correo real vía Resend (Fase 3, último ítem, no bloquea nada más).
7. Multi-cliente (Fase 4) — solo después de que el modelo de datos esté estable en Supabase, para no rehacer trabajo.
8. Tooling/CI (Fase 5) — puede empezar en paralelo desde el día 1, no depende de nada.

---

## 13. Criterios de aceptación verificables por fase

- **Fase 0:** `git status` limpio tras commit; `gestion/supabase/` no existe; README coincide 1:1 con `schema.sql`.
- **Fase 1:** `curl -I .../login` y `.../onboarding` devuelven 200; el código fuente servido de `login.html` no contiene ninguna contraseña en texto plano; un `localStorage.setItem` manual de sesión ya no otorga acceso (la sesión se valida contra el servidor en cada carga de página protegida).
- **Fase 2:** Dos navegadores distintos, mismo usuario, ven los mismos datos tras un cambio en uno de ellos; un usuario inquilino de prueba no puede leer facturas de otro inquilino (verificado con una consulta directa autenticada como ese usuario).
- **Fase 3:** Un payload `<script>`/`<img onerror>` en cualquier campo de texto libre se renderiza como texto, no se ejecuta; un comprobante subido no aparece en claro en `localStorage` del navegador.
- **Fase 4:** Duplicar el proyecto para un cliente nuevo no requiere editar ningún archivo `.html`/`.js`, solo el registro de configuración.
- **Fase 5:** Un push con un error de sintaxis JS falla el pipeline antes de llegar a `main`.

---

## 14. Archivos que Codex debe modificar (por fase)

- Fase 0: `README.md`; eliminar `gestion/supabase/schema.sql`, `gestion/supabase/seed_data.sql`; eliminar carpeta `css/` vacía; commitear el `index.html` ya modificado localmente.
- Fase 1: `gestion/js/auth-guard.js`, `gestion/login.html`, `vercel.json`/configuración del proyecto en el panel de Vercel (fuera del repo).
- Fase 2: `gestion/js/supabase-client.js`, `supabase/migrations/` (nueva migración, no editar la existente ya aplicada — agregar una nueva).
- Fase 3: `gestion/js/app.js`, `gestion/js/notifications.js` (agregar el transporte real hacia la función serverless), nuevo archivo `api/send-email.js`.
- Fase 4: `index.html`, `alquiler.html`, `gestion/index.html`, `gestion/onboarding.html`, `gestion/login.html` (para leer de configuración), nueva tabla/registro `app_settings`.
- Fase 5: nuevo `package.json`, nuevo workflow `.github/workflows/ci.yml`.

## 15. Archivos que no deben tocarse

- `supabase/migrations/20260904000340_init_ccms_erp.sql` — no editar una migración ya aplicada; cualquier cambio de esquema debe ir en una migración nueva.
- `_backup_duplicates/` — no modificar (ver §16); si se decide limpiar, es una acción separada y explícita, no parte de ninguna fase de desarrollo funcional.
- `puerto_la_cruz_drone*.jpg/webp`, `logo_cc_mario_sanchez.svg` — activos de marca, sin motivo técnico para tocarlos en ninguna fase de este plan.
- `C:\Users\Administrator\Desktop\Memoria\Proyecto Centro Comercial Mario Sánchez` (árbol histórico completo) — fuera del alcance de este repo; no fusionar ni mover sin una decisión explícita y separada del propietario del proyecto.

## 16. Riesgos de mover o eliminar archivos

- Eliminar `gestion/supabase/` es de bajo riesgo (duplicado exacto verificado por hash, no referenciado por ningún código).
- Eliminar `_backup_duplicates/` es de **riesgo bajo-medio**: no está en Git ni en el runtime, pero puede ser la única copia local de versiones anteriores de `app.js`/`auth-guard.js`/`login.html` fuera del historial de Git (útil como referencia rápida sin `git checkout`). Contiene además JSON con posibles tokens de proyecto (ver §7) — antes de eliminarlo, se recomienda revisar y purgar esos JSON, no el resto de la carpeta.
- Mover el árbol histórico completo `Proyecto Centro Comercial Mario Sánchez` quedó pendiente en el informe previo del mismo día porque otro proceso lo mantenía abierto; esta auditoría no lo intentó de nuevo por estar fuera de su alcance (solo lectura). Antes de moverlo, confirmar que ningún proceso/agente activo depende de esa ruta.

---

## 17. Veredicto final

# **CON-CAMBIOS**

El proyecto es una base de producto sólida y visualmente pulida, con funcionalidad de negocio (motor financiero, cobranzas, catálogo, onboarding) genuinamente construida y operativa a nivel de UI/lógica de cliente. **No está listo para manejar datos reales de arrendatarios, pagos o comprobantes** hasta cerrar los tres hallazgos P0 (autenticación solo-cliente, Supabase no conectado, RLS sin aislamiento real) y el hallazgo P1 de XSS almacenado explotable de punta a punta. El gap visual del hero tiene causa raíz identificada y solución ya escrita, pendiente solo de commit y despliegue. La discrepancia de rutas `/login` y `/onboarding` en producción debe resolverse a nivel de configuración de Vercel, no de código.
