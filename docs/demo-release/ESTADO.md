# Estado de la demo vendible

**Fecha de verificación:** 2026-09-15
**Repositorio:** `cc-mario-sanchez-comercial`
**HEAD auditado:** `6f148ca839a79c808c106e0f12a6843bfbb02c03`
**Estado:** DEMO FUNCIONAL PARA PILOTO / aceptación independiente D-T01…D-T30 pendiente / producción pendiente

**Datos de demostración:** la ruta explícita `gestion/login.html?demo=1&dataset=mario` carga el fixture autorizado de 38 locales y gastos extraído de los libros proporcionados por Freddy. Permanece aislado en IndexedDB y no realiza escritura cloud. La ruta demo ordinaria conserva el escenario sintético de 39 unidades.

**Despliegue Vercel:** la URL `https://cc-mario-sanchez-comercial.vercel.app` responde HTTP 200, pero sirve el `main` remoto del SHA base `6f148ca839a79c808c106e0f12a6843bfbb02c03`; las modificaciones de esta entrega permanecen locales sin publicar. `/gestion/demo-lab.html` aún responde 404 en Vercel. No se ejecutó ningún despliegue ni escritura cloud.

**Conectores verificados el 2026-09-15 (solo lectura):** GitHub confirmó `wolvesglobalsolutionsgroup-rgb/cc-mario-sanchez-comercial` como repositorio público con `main` como rama predeterminada. Supabase mostró el proyecto `wgs-proptech-prod` en estado `ACTIVE_HEALTHY`. Vercel devolvió `teams: []` y `403 Forbidden` al consultar el proyecto asociado en `.vercel/project.json`; por eso no se publicó esta entrega.

## Entregado

- Dataset 100 % sintético cargado en el runtime de demo; el fixture autorizado de migración ya no se carga.
- Modo offline explícito: `supabase-init.js` evita SDK, `/api/config` y proveedores cuando la URL lleva `demo=1` o la sesión demo está activa.
- `DatabaseService` con almacén IndexedDB `ccms-demo-sandbox`, clave por organización, hidratación tras recarga y `resetDemoData()`.
- Cobranza local completa: `submitPayment` → factura `verificando` → `approvePayment` por actor distinto → recibo emitido; rechazo existente y reinicio comprobados.
- `npm run demo` y `npm run test:demo` documentados y reproducibles.
- Capas de verificación separadas: `test:demo:unit`, `test:demo:e2e` y `test:demo:exports`.
- Dominio demo ampliado para organizaciones, propiedades, miembros suspendibles, importación, reservas, tickets, inventario, marketplace, planos, simulaciones, cierres de período y backup versionado.
- Pantalla visible de laboratorio en `/gestion/demo-lab.html` con botones para ejecutar los flujos sin consola.
- Landing, alquiler y levantamiento admiten `?demo=1` sin descargar mapas, fuentes, iconos ni tiles externos; el visor GIS muestra una lámina offline rotulada.
- Evidencia visual: `evidence-login-demo.png` y `evidence-dashboard-demo.png`; ejemplos CSV y backup en `examples/`.
- Reporte PDF multipágina inspeccionado: `evidence-report-demo.pdf` (4 páginas A4, tabla legible).
- Matriz caso por caso: `D-T-RESULTADOS.md`.
- Puntuación separada demo/producción: `PUNTUACION-ACTUAL.md`.
- Verificador UI actualizado al fixture sintético actual; login desktop/móvil, seis roles y once módulos navegables sin errores.
- Accesibilidad de modales verificada: foco inicial en control de cierre, `Escape` cierra y devuelve el foco al disparador en todos los modales.
- Tasas financieras bloqueadas a proveedores en demo; se conserva una tasa sintética rotulada y se muestra alerta recuperable si IndexedDB/cuota no está disponible.
- Catálogo público sincronizado con el listing demo mediante una proyección local: publicar aparece en landing/alquiler y retirar deja de mostrarlo; verificado E2E.

El smoke entregado cubre el recorrido comercial principal. No se declara todavía
aceptación final de todos los casos D-T01…D-T30 del plan maestro; esos casos
requieren una segunda revisión independiente.

## Evidencia ejecutada

| Comando | Resultado |
|---|---|
| `npm run test:demo` | PASS: 39 unidades, IndexedDB, submit/aprobación/recibo/reset, 0 llamadas remotas |
| `npm run test:demo:unit` | PASS: CRUD de dominio, idempotencia, reverso, permisos, importación, tickets, reservas, marketplace y planos |
| `npm run test:demo:exports` | PASS: CSV neutralizado, backup versionado y restore inválido sin mutación |
| `npm run test:demo:e2e` | PASS: seis roles, dashboard, laboratorio, cinco anchos responsive, landing/alquiler/levantamiento y 0 llamadas remotas |
| `npm test` | PASS: 70 tests, verificaciones de remediación y UI responsive |
| `node scripts/check-syntax.js` | PASS: 48 archivos |
| `node scripts/lint-guard.js` | PASS |

## Pendiente antes de vender producción

1. Crear organización e identidad reales en Supabase con MFA, RLS y revisión de políticas por propiedad.
2. Migrar datos de Mario Sánchez únicamente con autorización, staging y aprobación humana; nunca desde el fixture demo.
3. Configurar dominio, correo transaccional, backups, monitoreo y política de retención.
4. Implementar conciliación bancaria y comprobantes reales con un proveedor elegido; la demo solo simula el flujo.
5. Resolver catálogo único entre landing, alquiler y ERP, y completar accesibilidad/móvil en las pantallas detectadas en `PLAN-SAAS-WGS-2026-09-15/01-AUDITORIA.md`.

## Pendiente de aceptación demo completa

- Recorrido visual humano D-T01…D-T30 con acta independiente; la suite automatizada ya cubre los treinta casos, incluidos foco/teclado y almacenamiento ausente.
- Presentación comercial final y revisión de textos por el responsable del piloto.

## Nota de control de cambios

`gestion/js/app.js` ya tenía una modificación del usuario antes de este paquete. Se preservó y no se atribuye a la implementación de demo. No se hicieron escrituras en Supabase/Vercel ni se publicaron datos reales.
