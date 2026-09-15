# Estado de salida a producción — 15-09-2026

## Evidencia verificada

- SHA publicado en `main`: `ab92507`.
- Build de Vercel corregido: el proyecto ahora declara `npm run build` y genera el bundle de Speed Insights; la causa del fallo en `4cf77f2` era la ausencia del script `build`.
- Vercel responde `200` en `/login`, `/onboarding`, `/gestion`, `/gestion/login` y `/gestion/onboarding`.
- Supabase `wgs-proptech-prod` tiene aplicadas las migraciones de identidad, RLS, comandos financieros y endurecimiento.
- Demo pública verificada con datos autorizados de los libros: 38 unidades físicas operativas, 38 inquilinos, facturación $7.560, recaudado $2.910, 30 cuotas vencidas por $4.650 y 159 gastos. El libro contiene 39 registros numerados: `LUBRICANTES DANCO, C.A.` queda registrado como excepción pendiente (sin metraje/unidad física identificable), no como local inventado.
- `npm test`: 57/57 pruebas; verificación de remediaciones y smoke UI 390/1440 aprobados.
- Smoke UI ampliado: los seis botones de acceso demo crean sesión y navegan al tablero en un clic; los 11 módulos siguen navegables sin errores.
- Los fixtures autorizados se consumen solo como snapshot demo; el fixture sintético no se carga en `index.html` y la política pública heredada de `units` fue eliminada.
- Las escrituras de producción ya tienen frontera serverless `/api/records`: Bearer de Supabase, membresía activa, aislamiento por organización y RLS; la demo mantiene mutaciones solo en memoria.
- Mesa de ayuda/tickets ya no reintroduce incidentes de muestra desde `localStorage`; usa el servicio de datos autorizado y falla cerrado cuando no existe persistencia.
- Supabase: se revocó la ejecución pública de `rls_auto_enable()`; el aviso de funciones SECURITY DEFINER pasó de 14 a 13 y las restantes corresponden a predicados/RPC que RLS y los comandos autorizados necesitan.
- Modelo multi-inmueble: `units.property_id` y `property_memberships` ya están creados; el backfill de producción dejó 1 inmueble y 11/11 unidades vinculadas para `mario-sanchez`.
- Reconciliación de inventario: la fuente autorizada contiene 39 filas numeradas; 38 son unidades físicas identificables y una queda como excepción. La demo conserva las 38; producción aún requiere importar/mapear las 27 restantes sobre las 11 existentes, con revisión de duplicados y contratos antes de ejecutar el backfill.
- Bandeja de importación productiva: `authorized_import_staging` ya está aplicada en Supabase y contiene 38 paquetes de arrendamiento y 1 excepción, todos `pending_validation`, con hash SHA-256 y payload de origen. Ningún registro incompleto se convirtió en unidad operativa.
- Contexto visual multi-inmueble: el encabezado ya incluye selector accesible, persistencia de preferencia y filtrado por inmueble para unidades, inquilinos, contratos, facturas y pagos cuando existan dos o más inmuebles.
- Calidad de datos visible: la demo muestra una advertencia cuando existen registros del libro pendientes de validación y explica que quedan fuera de los indicadores operativos.
- Fidelidad de producción: gastos y cuentas receptoras ya no caen a valores de muestra cuando la lectura remota está vacía; los defaults quedan limitados a la demo autorizada.
- Reproducibilidad CI: `scripts/verify-ui.js` usa un puerto efímero para evitar falsos fallos `EADDRINUSE` cuando existe otra previsualización local.
- Revisión desde la app: la bandeja de origen se expone como lectura autorizada y permanece bloqueada para escrituras directas; el banner de calidad muestra los paquetes pendientes en producción.
- UX de validación: Configuración incluye un panel accesible con conteo, excepciones y primeras filas pendientes; no ofrece acciones que salten la revisión contable.
- Comando de revisión: RPC `review_authorized_import` aplicada en Supabase y protegida por sesión, alcance de inmueble y permiso `properties.manage`; rechaza aprobaciones con datos incompletos y registra revisor/fecha/motivo.
- Edición controlada: RPC `update_authorized_import_payload` y formulario accesible permiten completar solo área, RIF, documento y fechas; preservan el resto del payload y no alteran tablas operativas.
- Materialización transaccional: RPC `materialize_authorized_import` crea unidad, inquilino y contrato juntos, verifica duplicados y marca el origen como `imported` solo si las tres inserciones completan; cualquier error revierte todo.
- Pruebas de contrato: la suite verifica separación de edición/aprobación/materialización, bloqueo de estado incorrecto, detección de duplicados y revocación de ejecución anónima.
- Endurecimiento financiero: `/api/records` ya no acepta escrituras de `payments` ni `transactions`; esos efectos deben pasar por comandos/RPC atómicos. La suite verifica esta frontera.
- Supabase Security Advisor: se eliminó la alerta de ejecución anónima de `has_ccms_property`; el predicado queda ejecutable solo por `authenticated`. Permanecen advertencias de funciones SECURITY DEFINER usadas intencionalmente por RLS y comandos protegidos.
- E14 iniciada: RPC `create_organization_onboarding` y `/api/onboarding` crean organización + primer inmueble de forma atómica, solo para `platform_staff.role = founder`, con slug único y features permitidas.
- E15 iniciada: RPC `update_organization_features` y `/api/organization-features` aplican whitelist, versión esperada, motivo obligatorio y auditoría para fiscalidad, sucesión, IA y marketplace.
- E18 iniciada: migración `marketplace_foundation` aplicada con publicación opt-in por organización, listings y leads separados, consentimiento persistido y vista pública `security_invoker`; no existe concesión anónima todavía.
- Verificación post-corrección: `npm run build`, sintaxis (48 archivos), linter y estabilidad (50/50) aprobados localmente.
- Persistencia defensiva: las escrituras remotas ahora se serializan y revierten el snapshot optimista cuando el servidor rechaza el cambio; la UI recibe `ccms:data-error` y no conserva un “guardado” falso.
- Separación de entorno reforzada: el fallback HTML del fixture autorizado exige sesión demo explícita y host permitido; producción no recibe datos demo ante fallos de carga.
- Estado de persistencia visible: el dashboard muestra un aviso bloqueante cuando la lectura o escritura remota no se confirma, evitando presentar ceros o cambios optimistas como datos válidos.
- Flujo de revisión operativo: la bandeja de importación ahora ofrece aprobar o rechazar cada paquete; el rechazo exige motivo y ambas decisiones pasan por la RPC protegida antes de habilitar la materialización.

## Bloqueos restantes antes de aceptar producción real

1. Crear/validar usuarios reales en Supabase Auth y recorrer cada rol con dos organizaciones.
2. Aprobar la bandeja de importación y materializar los 38 paquetes después de validar duplicados, RIF, fechas y contratos; luego validar en entorno con usuarios reales las altas, ediciones y bajas remotas de cada módulo.
3. Validar Storage, exportaciones, restauración de base/archivos y ensayo RPO/RTO.
4. Ejecutar E2E autenticado en 360/390/768/1440 px y revisión manual WCAG 2.2 AA.
5. Cerrar aceptación del período contable patrón y revisar saldos contra libros originales.
6. Activar, cuando el cliente lo autorice, las credenciales de IA, Telegram/WhatsApp, correo, alertas y dominio/Cloudflare.

Estimación operativa: **80 % de avance de ingeniería; 65 % de aceptación productiva**. La versión actual es una demo operativa y una base de producción conectada con persistencia remota inicial; no se debe declarar producción contable definitiva hasta cerrar los seis puntos anteriores.
