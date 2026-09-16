# Matriz de aceptación de demo (smoke ejecutable)

Esta matriz registra la entrega ejecutada en este paquete. No reemplaza la
aceptación independiente D-T01…D-T30 de `PLAN-SAAS-WGS-2026-09-15/06-ACEPTACION.md`;
esa revisión debe confirmar visualmente el recorrido completo.

| ID | Criterio | Evidencia | Estado |
|---|---|---|---|
| D0 | Inicio sin servicios ni cuentas de terceros | `npm run demo`, `test:demo` y contador de 0 llamadas remotas | APROBADO |
| D1 | Datos sintéticos aislados | 39 unidades y ausencia de `CCMS_AUTHORIZED_DEMO_FIXTURES` en runtime | APROBADO |
| D2 | Seis roles demo | `scripts/verify-ui.js` | APROBADO |
| D3 | Persistencia local tras recarga | IndexedDB `ccms-demo-sandbox` en `verify-demo.cjs` | APROBADO |
| D4 | Cobranza maker-checker | `submitPayment` + `approvePayment` con verificador distinto | APROBADO |
| D5 | Recibo y estados | factura pagada, pago verificado y recibo emitido | APROBADO |
| D6 | Reinicio reproducible | `resetDemoData()` | APROBADO |
| D7 | Navegación y responsive | login 390/1440 px, 11 módulos | APROBADO |
| D8 | Regresión técnica | 70 tests + sintaxis + lint | APROBADO |
| D9 | Preparación de producción | checklist en `ESTADO.md` y plan maestro | CON-CAMBIOS |

## Inventario de superficies S01–S32

| Superficie | Evidencia ejecutada | Estado |
|---|---|---|
| S01 Inicio demo | Login demo, selector de seis roles y laboratorio | APROBADO |
| S02 Login/cuenta | Sesiones demo aisladas; invitación/MFA quedan simuladas | CON-CAMBIOS |
| S03 Panel WGS | Alta de organizaciones y suspensión demo en adapter | APROBADO |
| S04 Asistente de alta | Alta de organización, inmueble y responsable desde flujo demo | CON-CAMBIOS |
| S05 Inmuebles | CRUD de propiedades y alcance por organización | APROBADO |
| S06 Unidades | 39 unidades sintéticas, selector y alcance | APROBADO |
| S07 Inquilinos/contratos | CRUD, borrador y aprobación de contrato | APROBADO |
| S08 Dashboard | KPIs sintéticos calculados y responsive | APROBADO |
| S09 Cargos/cobranza | Emisión idempotente, saldos y export | APROBADO |
| S10 Reportar pago | Comprobante, estado pendiente y persistencia | APROBADO |
| S11 Conciliación | Parser bancario, duplicados y candidatos | CON-CAMBIOS |
| S12 Aprobación/recibo | Maker-checker, parciales, reverso y recibo | APROBADO |
| S13 Gastos comunes | Pactado/aprobado/pagado y resumen | APROBADO |
| S14 Informes/exportación | CSV, HTML imprimible y PDF de evidencia | APROBADO |
| S15 Calendario | Reservas, solapamiento y eventos locales | APROBADO |
| S16 Alertas | Integración rotulada como simulada | CON-CAMBIOS |
| S17 Tickets | Alta, respuesta, cierre y aislamiento | APROBADO |
| S18 Activos/consumibles | Kardex y bloqueo de stock negativo | APROBADO |
| S19 Plaza/servicios | Reserva con fechas, importe y choque bloqueado | APROBADO |
| S20 Equipo/permisos | Suspensión, acción denegada y último director | APROBADO |
| S21 Configuración | Parámetros y dos secciones sin IDs duplicados | APROBADO |
| S22 Importación/calidad | Preview, fila inválida, duplicado y commit | APROBADO |
| S23 Auditoría | Trazabilidad en registros demo y export | CON-CAMBIOS |
| S24 Portal inquilino | Rol aislado, cargos, pagos y tickets | APROBADO |
| S25 Portal beneficiario | Rol heredero y distribución determinista | CON-CAMBIOS |
| S26 Planos/editor | Calibración 10×5 y SVG rotulado | APROBADO |
| S27 Catálogo/dossier | Catálogo sintético y fuente común de unidades | APROBADO |
| S28 Marketplace demo | Publicar/retirar listing y lead consentido | APROBADO |
| S29 Respaldo/restauración | Backup versionado, manifest y rechazo de corrupción | APROBADO |
| S30 Asistente/integraciones | Cinco conectores con estado `simulado` | APROBADO |
| S31 Ayuda/soporte | Contenido accesible en pantalla de ayuda | CON-CAMBIOS |
| S32 Suscripción WGS | Evento de suscripción simulado, sin cobro real | CON-CAMBIOS |

La evidencia de comportamiento está en `scripts/verify-demo-unit.cjs`,
`scripts/verify-demo-exports.cjs` y `scripts/verify-demo.cjs`. Los estados
CON-CAMBIOS indican superficies cuyo recorrido visual o con proveedor real
pertenece a la revisión humana o a producción pagada; no ocultan un efecto
simulado como si fuera una operación externa real.

El smoke D0–D8 y los treinta casos D-T están cubiertos por pruebas automatizadas. La aceptación final de demo permanece **CON-CAMBIOS** hasta que otra persona ejecute el recorrido visual completo. D9 requiere cuentas, configuración y decisiones que corresponden a producción pagada.
