# Resultados D-T01…D-T30

Evidencia generada el 2026-09-15 con `npm run test:demo`. **Automatizado** significa que el comportamiento está ejercitado por código; **humano pendiente** significa que todavía requiere recorrido visual/teclado independiente.

| Caso | Resultado actual | Evidencia |
|---|---|---|
| D-T01 | APROBADO automatizado | E2E bloquea proveedores y APIs |
| D-T02 | APROBADO automatizado | Seis botones demo y sesiones por rol |
| D-T03 | APROBADO automatizado | CRUD + recarga IndexedDB |
| D-T04 | APROBADO automatizado | `resetDemoData()` y restore |
| D-T05 | APROBADO automatizado | Organización, inmueble, unidad, contrato y aprobación |
| D-T06 | APROBADO automatizado | `getScopedData()` para dos organizaciones |
| D-T07 | APROBADO automatizado | Preview, inválido, duplicado y decimal mixto |
| D-T08 | APROBADO automatizado | `issueInvoiceOnce()` idempotente |
| D-T09 | APROBADO automatizado | Comprobante persiste tras recarga |
| D-T10 | APROBADO automatizado | Autoaprobación rechazada; actor distinto aprobado |
| D-T11 | APROBADO automatizado | 100→60→50→reverso, saldo e historia |
| D-T12 | APROBADO automatizado | Reintento igual y conflicto de payload |
| D-T13 | APROBADO automatizado | Dos aprobaciones concurrentes: una sola efectiva |
| D-T14 | APROBADO automatizado | Rechazo motivado y período cerrado |
| D-T15 | APROBADO automatizado | Dedupe y candidatos de extracto |
| D-T16 | APROBADO automatizado | Resumen financiero y export |
| D-T17 | APROBADO automatizado | Pactado/aprobado/pagado y pendiente |
| D-T18 | APROBADO automatizado | Ticket cerrado y aislamiento por organización |
| D-T19 | APROBADO automatizado | Stock negativo y reserva solapada bloqueados |
| D-T20 | APROBADO automatizado | Suspensión y último director protegido |
| D-T21 | APROBADO automatizado | Publicar/retirar listing; landing y alquiler proyectan la misma marca pública y retiran el local al retirar listing |
| D-T22 | APROBADO automatizado | Lead consentido conserva propietario del listing |
| D-T23 | APROBADO automatizado parcial | Plano 10×5 = 50 m²; sin escala no inventa área; SVG coherente; PNG/ficha quedan para revisión |
| D-T24 | APROBADO automatizado | Cinco conectores con estado `simulado` |
| D-T25 | APROBADO automatizado + inspección PDF | CSV seguro, HTML imprimible y PDF A4 de 4 páginas |
| D-T26 | APROBADO automatizado | Backup/restore y manifest de adjuntos |
| D-T27 | APROBADO automatizado | Versión desconocida y hash corrupto no mutan dataset |
| D-T28 | APROBADO automatizado | Cinco anchos sin overflow; todos los modales reciben foco y tienen cierre; Escape restaura el disparador |
| D-T29 | APROBADO automatizado | CSV/restore inválidos no mutan; almacenamiento ausente deja borrador en memoria, muestra alerta y permite backup |
| D-T30 | APROBADO automatizado | ERP, landing, alquiler y levantamiento demo con 0 solicitudes externas; tasas financieras quedan sintéticas y rotuladas |

## Veredicto de esta ronda

**CON-CAMBIOS.** Los treinta casos tienen evidencia automatizada; la aceptación contractual final aún requiere el recorrido visual humano de todos los módulos que exige `06-ACEPTACION.md`.
