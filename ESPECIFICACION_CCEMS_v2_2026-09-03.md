# Especificación Técnica v2 — CCEMS (Centro Comercial Empresarial Mario Sánchez)

**Fecha:** 2026-09-03
**Reemplaza/extiende:** `AUDITORIA_TECNICA_INTEGRAL_2026-09-03.md` (léase primero — esta especificación asume ese diagnóstico como base).
**Objetivo de este documento:** dejar el proyecto en estado "solo falta cargar datos reales" — rebranding a CCEMS, backend real conectado, verificación por correo, y una suite de gestión completa para el arrendador.

**Nota de estado en vivo:** Durante esta sesión se aplicó y desplegó el fix definitivo del gap del hero (commit `5676b9b`, ver §7). También se detectó que otro proceso agregó `package.json`, `scripts/build-speed-insights.js` y `assets/speed-insights.js` (integración de Vercel Speed Insights) en paralelo a este trabajo — no forma parte de esta especificación, no lo toques al ejecutar las fases de abajo, y verifica `git status` antes de cada commit para no pisar cambios de otro agente trabajando en el mismo repo.

---

## 1. Rebranding: "CC Mario Sánchez" → "Centro Comercial Empresarial Mario Sánchez" (CCEMS)

### 1.1 Decisión que falta tomar antes de ejecutar (bloqueante para una parte del trabajo)

El nombre comercial es un cambio de texto/UI simple. Pero hay 3 cosas atadas al nombre viejo que **no se resuelven solo editando código** y necesito que confirmes:

| Elemento | Valor actual | ¿Se mantiene o cambia? |
|---|---|---|
| Repositorio GitHub | `wolvesglobalsolutionsgroup-rgb/cc-mario-sanchez-comercial` | Renombrar el repo en GitHub no rompe nada (GitHub redirige el nombre viejo), pero es una acción manual en la web de GitHub, no de código. |
| Dominio Vercel | `cc-mario-sanchez-comercial.vercel.app` | Cambiarlo requiere un nuevo proyecto Vercel o un alias nuevo — si cambias el nombre del proyecto en Vercel, la URL cambia y hay que actualizar todos los enlaces ya compartidos (WhatsApp, tarjetas, etc). Recomiendo **mantener esta URL técnica** y usar CCEMS solo como nombre visible en el sitio, o comprar un dominio propio (`ccems.com.ve` o similar) y apuntarlo — eso sí ya es 100% independiente del código. |
| Correo administrativo | `administracion@ccmariosanchez.com` | Si el dominio de correo no cambia, se mantiene igual (solo es texto). Si vas a migrar a un dominio nuevo, eso es trámite de DNS + Resend (ver §5), no de código. |

**Asunción con la que voy a trabajar en este documento** (corrígeme si es distinta): el nombre visible cambia a "Centro Comercial Empresarial Mario Sánchez" y la sigla corta a usar en UI compacta (chips, footer, favicon alt) es **CCEMS**; la URL técnica de Vercel y el dominio de correo **se mantienen** hasta que definas un dominio propio nuevo.

### 1.2 Inventario exacto de lo que hay que tocar (85 ocurrencias detectadas)

| Archivo | Ocurrencias | Qué contiene |
|---|---:|---|
| `index.html` | 13 | `<title>`, texto del hero, footer, textos de meta/preload alt |
| `alquiler.html` | 4 | Título, header, footer |
| `gestion/login.html` | 5 | Título, header, credenciales demo (identifier admin) |
| `gestion/index.html` | 4 | Título, sidebar |
| `gestion/onboarding.html` | 5 | Título, header |
| `gestion/js/app.js` | 13 | Textos generados dinámicamente (recibos, alertas, dossier) |
| `gestion/js/auth-guard.js` | 11 | `display_name` de usuarios demo, comentarios |
| `gestion/js/supabase-client.js` | 12 | Nombres de tenants demo (`Distribuidora Oriente Marino`, etc. no llevan el nombre del CC, pero hay referencias en textos de plantilla) |
| `gestion/js/notifications.js` | 6 | `from_name` por defecto, asuntos de correo |
| `gestion/js/google-workspace.js` | 7 | Plantillas de WhatsApp/correo, `ADMIN_EMAIL` |
| `gestion/js/financial-engine.js` | 2 | Comentarios de cabecera |
| `README.md` | 3 | Título y descripción |
| `logo_cc_mario_sanchez.svg` (nombre de archivo) | — | El propio nombre de archivo queda desactualizado; renombrar a `logo_ccems.svg` y actualizar las ~6 referencias a él en HTML |
| `vercel.json` | 0 (solo `"name"` interno, cosmético) | — |

**No renombrar** (quedan igual pese al rebranding, por lo explicado en 1.1): rutas de carpetas (`cc-mario-sanchez-comercial/`), claves de `localStorage` (`ccms_session`, `ccms_theme`, etc. — cambiarlas invalidaría sesiones activas sin ganar nada), y el dominio de correo salvo que definas uno nuevo.

### 1.3 Regla de nomenclatura para el código nuevo que se escriba de aquí en adelante

- Nombre comercial completo (para textos legales, contratos, encabezados): **Centro Comercial Empresarial Mario Sánchez**.
- Sigla corta (para UI compacta, chips, badges, asunto de correos): **CCEMS**.
- Prefijos de código/claves internas (localStorage, tablas, funciones): mantener `ccms_` / `ccms` tal cual, por compatibilidad — no vale la pena migrar datos existentes solo por la sigla.

---

## 2. Autorización de arrendatarios por correo — flujo completo

### 2.1 Regla de negocio, tal como la planteaste

> La administración (CCEMS / el arrendador) es la única que autoriza el acceso de un arrendatario a la plataforma. Esa autorización se hace suministrando/validando el correo del arrendatario, y **ese correo es el único habilitado** para entrar a su portal.

Esto reemplaza por completo el modelo actual (`USERS_DEMO` con credenciales fijas) por un flujo de **invitación por correo controlada por el admin**, sin que el arrendatario pueda auto-registrarse nunca.

### 2.2 Flujo paso a paso

```
1. Admin CCEMS completa el onboarding de un nuevo arrendatario
   (gestion/onboarding.html) → captura: razón social, RIF, representante
   legal, unidad asignada, condiciones de contrato, y el CORREO del
   arrendatario (campo ya existe en el wizard, hoy no dispara nada).

2. Al finalizar el onboarding, el sistema:
   a) Crea el registro en `tenants` (Supabase).
   b) Crea una fila en una nueva tabla `tenant_invitations`
      (tenant_id, email, token, status: 'pending', expires_at, created_by).
   c) Llama a Supabase Auth Admin API (`inviteUserByEmail`) o dispara un
      correo transaccional propio vía Resend con un enlace de un solo uso
      tipo `https://.../gestion/activar.html?token=...`.

3. El arrendatario recibe el correo, abre el enlace, define su contraseña
   (o usa un magic link sin contraseña, más simple y más seguro — recomendado).
   Esto activa su cuenta en Supabase Auth con ese correo exacto, vinculada
   a `tenant_id` vía la tabla `user_tenants` (ya definida en el plan de
   backend anterior).

4. Desde ese momento, SOLO ese correo puede iniciar sesión como ese
   arrendatario. Si el admin necesita cambiar el correo autorizado
   (ej. el arrendatario cambió de representante), el admin revoca el
   acceso viejo y reenvía una nueva invitación — el arrendatario nunca
   puede cambiar su propio correo de acceso sin pasar de nuevo por el admin.

5. El admin (CCEMS) tiene su propio acceso, separado, con permisos totales
   — no pasa por este flujo de invitación, es una cuenta administrativa
   fija gestionada aparte (ver §2.4).
```

### 2.3 Cambios de base de datos necesarios (nueva migración, no tocar la existente)

```sql
-- Nueva migración: 20260910000000_tenant_auth_flow.sql

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id),
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | revoked | expired
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_tenants (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id text NOT NULL REFERENCES tenants(id),
  role text NOT NULL DEFAULT 'tenant', -- 'tenant' (arrendatario) o 'admin' (CCEMS)
  PRIMARY KEY (user_id, tenant_id)
);

ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- Solo el admin CCEMS puede crear/ver/revocar invitaciones
CREATE POLICY "Admin gestiona invitaciones" ON tenant_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.user_id = auth.uid() AND ut.role = 'admin')
  );

-- Cada usuario ve solo su propia fila de vínculo tenant
CREATE POLICY "Usuario ve su propio vinculo" ON user_tenants
  FOR SELECT USING (user_id = auth.uid());
```

Con esta tabla `user_tenants`, las políticas RLS de `tenants`, `contracts`, `invoices`, `payments`, etc. (ya identificadas como P0-3 en la auditoría) se reescriben así:

```sql
-- Ejemplo para invoices — reemplaza la política actual
CREATE POLICY "Tenant ve solo sus facturas" ON invoices
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin gestiona todas las facturas" ON invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.user_id = auth.uid() AND ut.role = 'admin')
  );
```

(Este patrón se replica para `contracts`, `payments`, `condo_expenses`, `transactions`, `alerts`, `audit_logs` — 7 tablas más, mismo molde.)

### 2.4 Cuenta del arrendador (CCEMS admin)

- No pasa por invitación por correo tipo arrendatario — es una cuenta creada directamente en Supabase Auth por quien administra el proyecto (tú), con `role = 'admin'` en `user_tenants` (sin `tenant_id`, o con un `tenant_id` especial `'ADMIN'` según cómo prefieras modelarlo).
- Puede tener más de un usuario admin (ej. tú + un contador + un gerente de cobranzas) — todos con `role = 'admin'`, todos con acceso total, diferenciados solo por nombre en `display_name`.
- Recomendado: agregar un tercer rol intermedio `staff` (ej. cobranzas) con permisos de solo-lectura + registrar pagos, sin poder editar contratos ni ver reportes fiscales — evalúa si lo necesitas ahora o lo dejamos para una v3.

### 2.5 Pantalla nueva necesaria

`gestion/activar.html` — pantalla de activación de cuenta que:
1. Lee `?token=...` de la URL.
2. Valida contra `tenant_invitations` (token existe, no expiró, `status = 'pending'`).
3. Si es válido: crea/activa el usuario en Supabase Auth con ese correo (vía magic link de Supabase, es lo más simple y seguro — no hay que inventar gestión de contraseñas propia).
4. Marca la invitación como `accepted`.
5. Redirige al dashboard con sesión iniciada.

---

## 3. Suite de gestión completa para el arrendador (CCEMS)

Esto es la parte más grande. Divido en 5 sub-sistemas. Todo lo que sigue asume que ya está resuelto el Bloque 2 de la conversación anterior (backend Supabase real + RLS correcto) — sin eso, nada de esto puede considerarse "real".

### 3.1 Gestión administrativa (ya existe una base, hay que completarla)

Lo que **ya funciona hoy** (nivel UI/lógica, sobre localStorage): directorio de unidades, expediente de inquilino, contratos, calculadora de prórroga legal.

Lo que **falta**:
- **Documentos adjuntos por inquilino/contrato**: subir PDF del contrato firmado, cédula/RIF escaneado, fianza, referencias comerciales — a Supabase Storage, con metadata en una tabla `tenant_documents (tenant_id, contract_id, doc_type, storage_path, uploaded_at, uploaded_by)`.
- **Historial de renovaciones**: hoy un contrato es una sola fila; falta un historial versionado (`contract_amendments`) para registrar cada renovación/modificación sin perder la anterior.
- **Gestión de vacantes y lista de espera**: cuando una unidad se desocupa, registrar interesados en espera (ya hay leads del formulario público de `index.html`, hoy no se conectan a nada — deberían caer en una tabla `leads` visible en el dashboard admin).

### 3.2 Gestión fiscal (no existe hoy, hay que construirla desde cero)

Contexto legal: Venezuela, arrendamiento comercial bajo G.O. 40.418 — el sistema ya calcula prórroga legal, pero no lleva ningún control fiscal.

- **Libro de ingresos por período**: reporte de todos los `payments` conciliados en un rango de fechas, con su equivalencia en las 4 monedas y la tasa BCV aplicada al momento (el snapshot histórico **ya existe** en el motor financiero — solo falta exponerlo como reporte).
- **Registro de retenciones (ISLR/IVA si aplica a tu figura fiscal)**: nuevo campo en `payments` — `withholding_amount`, `withholding_percentage`, `withholding_certificate_number` — para poder declarar lo retenido por arrendatarios que son agentes de retención.
- **Comprobantes fiscales por cobro**: generación de un PDF simple (recibo/factura no fiscal, o fiscal si tramitas una imprenta autorizada por el SENIAT — decisión de negocio, no técnica) por cada pago conciliado.
- **Control de RIF y vigencia**: alerta cuando el RIF de un arrendatario está por vencer (dato ya capturado en onboarding, falta el campo de vigencia y la alerta).
- **Exportación para el contador**: botón "Exportar período a Excel/CSV" con columnas normalizadas (fecha, unidad, inquilino, RIF, monto USD, monto Bs, tasa BCV, método de pago, referencia) — listo para entregarle a un contador externo sin que tenga acceso al sistema.

### 3.3 Historial organizado (auditoría real, hoy es falsa)

- **Reemplazar `auth-guard.js:audit()`** (hoy solo hace `console.log`, no persiste nada — hallazgo de la auditoría) por una escritura real a la tabla `audit_logs`: cada login, cada creación/edición de contrato, cada pago registrado, cada invitación enviada/revocada.
- **Vista de línea de tiempo por entidad**: dentro del expediente de cada inquilino/unidad/contrato, un timeline cronológico armado a partir de `audit_logs` filtrado por esa entidad — "quién hizo qué y cuándo" visible para el admin sin salir del dashboard.
- **Trazabilidad de cambios de contrato**: cada modificación de canon, vigencia o condiciones queda registrada con el valor anterior y el nuevo (no solo el estado final).

### 3.4 Reportes / informes

Módulo nuevo: `gestion` → sección "Informes", con al menos:

| Informe | Filtros | Salida |
|---|---|---|
| Estado de cuenta por inquilino | Inquilino, rango de fechas | PDF con saldo, historial de pagos, mora si aplica |
| Recaudación consolidada | Rango de fechas, moneda | Excel/CSV con totales por unidad y por período |
| Morosidad | Fecha de corte | Lista de inquilinos en mora, días de atraso, monto adeudado |
| Ocupación | — | % ocupado/vacante por categoría de unidad, con histórico mensual |
| Libro de ingresos (fiscal) | Rango de fechas | Ver §3.2 |
| Vencimientos de contrato | Próximos N días | Lista de contratos por vencer, para planificar renovaciones |

Todos deben poder **exportarse** (PDF para estado de cuenta/morosidad, Excel/CSV para recaudación/libro de ingresos) — no basta con verlos en pantalla, porque el propósito es entregarlos a terceros (contador, socios, el propio arrendatario).

**Nota técnica:** dado que es una SPA sin backend de renderizado, la generación de PDF debe hacerse en el cliente con una librería ligera (`jspdf` + `jspdf-autotable`, ya mencionada como pendiente en el README original) o, si el volumen de datos crece, mover la generación a una función serverless de Vercel (mismo patrón que la función de correo del Bloque 3 anterior) para no sobrecargar el navegador del admin.

### 3.5 Panel de KPIs (ya existe visualmente, falta conectarlo a datos reales)

El dashboard (`gestion/index.html`) ya tiene las tarjetas de "Ocupación", "Facturación Mensual", "Total Recaudado", "Cuentas por Cobrar", "Egresos Operativos", "Utilidad Neta" — hoy muestran `0%`/`$0.00` porque no hay datos reales cargados. Una vez conectado el backend (Bloque 2 anterior) y cargados los datos reales de unidades/contratos, estas tarjetas funcionan sin cambios adicionales — es un problema de datos, no de código, salvo por un detalle: **"Egresos Operativos" no tiene ningún módulo de captura hoy** (no hay dónde registrar un gasto operativo del centro comercial, solo condo_expenses presupuestados) — hay que agregar un CRUD simple de gastos reales ejecutados contra la tabla `transactions` (ya existe en el esquema, hoy sin UI que la use).

---

## 4. Corrección completa de errores (consolidado, incluye lo ya identificado + lo nuevo de esta sesión)

| # | Error | Estado | Acción |
|---|---|---|---|
| 1 | Gap visual del hero | **Corregido y desplegado en esta sesión** (commit `5676b9b`) | Verificar visualmente en producción tras el redeploy de Vercel (puede tardar 1-2 min) |
| 2 | `/login` y `/onboarding` devuelven 404 en producción | Pendiente | Revisar panel de Vercel (Bloque 4 de la respuesta anterior) |
| 3 | Autenticación 100% cliente, contraseñas en texto plano | Pendiente — este documento lo reemplaza por completo con el flujo de §2 | Implementar §2 |
| 4 | Supabase declarado, nunca conectado | Pendiente | Bloque 2 de la respuesta anterior |
| 5 | RLS sin aislamiento real | Pendiente | Resuelto por el modelo de §2.3, reemplaza el RLS actual |
| 6 | XSS almacenado en `app.js` (innerHTML sin escapar) | Pendiente | Reutilizar `escapeHtml()` de `auth-guard.js` en los 17 usos de `innerHTML` |
| 7 | Comprobantes en Base64/localStorage | Pendiente | Migrar a Supabase Storage |
| 8 | README desalineado con el esquema SQL real (8 vs 10 tablas) | Pendiente | Regenerar README §3.D, incluir las tablas nuevas de §2.3 |
| 9 | `gestion/supabase/` duplicado exacto de `supabase/` | Pendiente | Eliminar |
| 10 | Carpeta `css/` vacía en la raíz, referenciada en README | Pendiente | Eliminar o poblar realmente |
| 11 | Catálogo público (`alquiler.html`) desincronizado del inventario del ERP | Pendiente | Unificar contra la tabla `units` real |
| 12 | "Sincronización con Google Calendar" es solo un enlace manual | Pendiente | Renombrar en UI/README, o implementar OAuth real si se necesita automatización |
| 13 | `auth-guard.js:audit()` no persiste nada (solo `console.log`) | Pendiente | Resuelto por §3.3 |
| 14 | CDNs sin `integrity` fijado (Tailwind, FontAwesome, Google Fonts) | Pendiente, bajo riesgo | Agregar SRI donde el proveedor lo permita |
| 15 | Egresos operativos sin módulo de captura | Nuevo (detectado en §3.5) | Construir CRUD contra `transactions` |
| 16 | Sin control fiscal de ningún tipo | Nuevo (requerimiento de esta sesión) | Resuelto por §3.2 |
| 17 | Leads del formulario público no se conectan a ningún lado | Nuevo (detectado en §3.1) | Tabla `leads` + vista en dashboard admin |

---

## 5. Verificación / notificaciones por correo — ampliación del diseño anterior

Ya definido el transporte (Resend vía función serverless, notificaciones.js sin cambios de lógica — ver el mensaje anterior de esta conversación). Se añade con esta sesión:

- **Correo de invitación** (nuevo, el más importante): dispara el flujo de §2.2. Debe incluir: nombre del arrendatario, unidad asignada, enlace de activación de un solo uso, vigencia del enlace (7 días recomendado), y quién lo invitó (para trazabilidad).
- **Correo de confirmación de activación**: al arrendatario, confirmando que su cuenta quedó activa — y **copia (BCC o CC) al correo administrativo de CCEMS**, para que quede registro de cada activación sin depender solo de `audit_logs`.
- **Correo de revocación**: si el admin revoca el acceso de un correo (ej. cambio de representante legal del inquilino), notificar al correo viejo que su acceso fue revocado (buena práctica de seguridad, evita sorpresas).

---

## 6. Orden de implementación actualizado (reemplaza el orden de la respuesta anterior)

1. ~~Fix del gap del hero~~ — **hecho en esta sesión.**
2. Fix de rutas `/login`/`/onboarding` en Vercel (no depende de nada más).
3. Rebranding textual a CCEMS (§1) — puede hacerse en paralelo a todo lo demás, es solo texto; hazlo antes de conectar Supabase para no tener que tocar dos veces los mismos archivos.
4. Proyecto Supabase real + migración base (`20260904000340_init_ccms_erp.sql`, sin editar) + nueva migración de auth (`tenant_invitations`, `user_tenants`, políticas RLS corregidas — §2.3).
5. Flujo de invitación por correo (§2.2, §2.5) + función serverless de Resend (Bloque 3 anterior) — se construyen juntos porque la invitación depende del correo.
6. Migrar `auth-guard.js` a Supabase Auth real (elimina `USERS_DEMO`).
7. Migrar `supabase-client.js` de `localStorage` a llamadas reales Supabase.
8. Sanitizar los 17 `innerHTML` de `app.js` (§4, ítem 6) — antes de cargar un solo dato real de un inquilino.
9. Comprobantes a Supabase Storage (§4, ítem 7).
10. Auditoría real (§3.3) — reemplaza `audit()`.
11. Módulo fiscal (§3.2) + módulo de egresos (§3.5, ítem 15) + tabla `leads` (§3.1).
12. Módulo de informes exportables (§3.4).
13. Unificar catálogo público con `units` (§4, ítem 11).
14. Limpieza final: duplicados SQL, carpeta `css/` vacía, README (§4, ítems 8-10).

A partir de aquí, lo único pendiente es cargar datos reales de unidades, imágenes y condiciones de contrato.

---

## 7. Registro de cambios aplicados en esta sesión

- `index.html`: fix definitivo del gap del hero (degradado reforzado a 220px + sello sólido de respaldo `::before`, padding de `#servicios` reducido a `pt-4`). Commiteado como `5676b9b` y **publicado (push a `origin/main`)**.
- Este documento de especificación creado en la raíz del proyecto.

Pendiente de verificación por tu parte: recarga `https://cc-mario-sanchez-comercial.vercel.app` con caché forzado (Ctrl+Shift+R) una vez Vercel termine el redeploy (usualmente 1-2 minutos tras el push) y confírmame si el gap desapareció del todo o si el problema resulta estar en la imagen fuente en sí (ver nota al final del Bloque 1 de la respuesta anterior).
