# Auditoría integral — Centro Comercial Mario Sánchez

Fecha: 2026-09-03  
Fuente auditada: `C:\Users\Administrator\Desktop\Memoria\cc-mario-sanchez-comercial`  
Remoto: `wolvesglobalsolutionsgroup-rgb/cc-mario-sanchez-comercial`  
Commit base: `2ae788b` (`feat(auth+cleanup): real auth guard with SHA-256...`)

## Veredicto ejecutivo

**CON-CAMBIOS / WARNING — no listo para manejar datos reales de arrendatarios o cobranzas.**

La aplicación es una SPA estática funcional para demo comercial, con una estructura pequeña y JavaScript válido. No se encontraron patrones evidentes de malware, payloads codificados, scripts de instalación ni exfiltración automática. Sin embargo, la autenticación y la persistencia no son seguridad real: las credenciales demo están publicadas en el cliente, la sesión vive en `localStorage`, el rol se controla en el navegador y la integración Supabase no está implementada.

## Hallazgos prioritarios

### P0 — Autenticación únicamente del lado del cliente

- `gestion/js/auth-guard.js:19-45` contiene usuarios demo, identificadores y hashes; `gestion/login.html:165-168` contiene además las contraseñas demo en texto plano.
- `gestion/js/auth-guard.js:72-90` guarda la sesión en `localStorage`.
- `gestion/js/auth-guard.js:163-177` aplica el rol en JavaScript; un usuario puede modificar `localStorage` o cargar directamente los HTML.
- Conclusión: sirve para demo, **no protege un ERP real**. Debe migrarse a Supabase Auth o backend con sesión verificable y autorización en servidor/RLS.

### P0 — Supabase declarado, pero no conectado

- `gestion/js/supabase-client.js:8-14` solo lee `ccms_supabase_url` y `ccms_supabase_key`.
- `gestion/js/supabase-client.js:377-389` implementa lectura/escritura exclusivamente en `localStorage`.
- No existen llamadas REST, SDK Supabase ni operaciones remotas en ese archivo.
- La documentación afirma persistencia remota opcional, pero el comportamiento actual es local.

### P0 — RLS sin aislamiento por rol o inquilino

- `supabase/migrations/20260904000340_init_ccms_erp.sql:179-203` activa RLS, pero autoriza `FOR ALL USING (auth.role() = 'authenticated')` en todas las tablas.
- Cualquier usuario autenticado tendría acceso de lectura y escritura a tenants, contratos, facturas, pagos, transacciones y auditoría.
- No hay políticas basadas en `auth.uid()` ni vínculo entre usuario autenticado y `tenant_id`.

### P1 — Rutas públicas documentadas devuelven 404 en producción

Verificación HTTP directa contra `https://cc-mario-sanchez-comercial.vercel.app`:

| Ruta | Resultado |
|---|---:|
| `/` | 200 |
| `/alquiler` | 200 |
| `/gestion` | 200 |
| `/gestion/login.html` | 200 |
| `/gestion/onboarding.html` | 200 |
| `/login` | 404 |
| `/onboarding` | 404 |

Las reglas están en `vercel.json:8-11`, por lo que hay una discrepancia entre el archivo local y el despliegue publicado o la configuración efectiva del proyecto Vercel. Las rutas directas funcionan; el flujo amigable documentado no.

### P1 — Gap visual del hero

- El hueco visible de la captura coincide principalmente con `index.html:363`, donde `#servicios` usaba `py-24` (96 px de padding superior).
- El intento anterior era una regla genérica en CSS y dependía del orden de estilos del CDN.
- Se corrigió localmente de forma directa a `pt-8 pb-24` en `index.html:363`, conservando el fade de Minimax.
- El cambio está **solo en la copia local** y queda como modificación no comprometida; Vercel no lo reflejará hasta publicar ese commit.

### P1 — Inyección HTML potencial en datos dinámicos

`gestion/js/app.js` usa `innerHTML` en tablas, tarjetas, alertas y comprobantes (`aprox. líneas 280-800`). Parte de los valores provienen de datos de inquilinos, plantillas o comprobantes. Debe migrarse a `textContent`/DOM seguro o sanitizar explícitamente antes de interpolar HTML.

### P1 — Comprobantes en Base64 dentro de localStorage

`gestion/js/app.js:746-800` serializa comprobantes como Data URL y `gestion/js/supabase-client.js:488-506` los guarda en la base local. Esto expone documentos sensibles a cualquier script del mismo origen, tiene límites de almacenamiento y no ofrece control de acceso ni retención.

## Calidad y consistencia

- Los archivos JavaScript pasan `node --check`.
- No hay `package.json`, lockfile, pipeline CI ni suite de pruebas para este proyecto.
- Hay dos esquemas SQL equivalentes (`supabase/schema.sql` y `gestion/supabase/schema.sql`) más una migración. Esto crea riesgo de divergencia.
- La documentación menciona ocho tablas como `commercial_units` y `app_settings`; el SQL actual usa diez tablas, entre ellas `units`, y no crea `app_settings` como tabla.
- El catálogo público contiene valores y datos de demostración embebidos en HTML/JS, lo cual es adecuado para una maqueta, no para un catálogo administrable.
- Leaflet tiene integridad SRI; Tailwind CDN y otros CDNs dependen de recursos externos en tiempo de ejecución.
- El proyecto activo contiene `_backup_duplicates/`, ignorado por Git, con copias, JSON de Vercel y scripts de verificación. No forma parte del runtime, pero debe mantenerse fuera del árbol operativo.

## Auditoría de seguridad del repositorio

Puntuación orientativa: **58/100 — WARNING**.

| Área | Resultado | Nota |
|---|---:|---|
| Proveniencia | 9/20 | Repo público, 0 estrellas, 0 forks, sin licencia visible en la raíz |
| Seguridad del código | 20/25 | Sin patrones críticos de ejecución codificada; hay HTML dinámico y credenciales demo |
| Dependencias | 12/20 | Sin manifest ni lockfile; CDNs externos, algunos con SRI y otros sin fijar |
| Comportamiento | 11/15 | Sin install hooks; red esperada, pero webhook configurable y almacenamiento local sensible |
| Reputación/documentación | 6/20 | README claro, pero poca evidencia comunitaria y claims que no coinciden totalmente con código |

No se detectaron `eval(atob(...))`, `child_process`, `os.system`, `Invoke-Expression`, payloads codificados ni scripts `preinstall/postinstall`.

## Organización encontrada

Fuente activa única:

`C:\Users\Administrator\Desktop\Memoria\cc-mario-sanchez-comercial`

Archivo histórico separado:

`C:\Users\Administrator\Desktop\Memoria\Proyecto Centro Comercial Mario Sánchez`

Ese archivo histórico contiene tres módulos: `01_Levantamiento_Tecnico_GIS`, `02_Portal_Comercial_Web` y `03_Gestion_Inquilinos_SaaS`. En la raíz de `Memoria` también existían un `index.html` y `vercel.json` antiguos; ya fueron apartados en:

`03_ARCHIVO_MARIO_SANCHEZ\02_ARCHIVOS_SUELTOS_ANTIGUOS`

El movimiento de la carpeta histórica completa quedó pendiente porque otro proceso la mantiene abierta; no se sobrescribió ni eliminó ningún archivo.

## Orden recomendado de trabajo

1. Publicar y verificar la corrección del hero y las rutas `/login` y `/onboarding`.
2. Separar demo de producción: eliminar credenciales embebidas y usar Supabase Auth/backend.
3. Definir una sola fuente SQL y crear migraciones idempotentes para `app_settings`, usuarios y relación usuario-inquilino.
4. Implementar CRUD remoto o renombrar honestamente el sistema como demo local.
5. Aplicar RLS por `auth.uid()` y pruebas negativas de aislamiento.
6. Sustituir Base64/localStorage para documentos por Storage privado con URLs firmadas.
7. Agregar `package.json`, lint, pruebas y CI antes de seguir acumulando cambios manuales.

