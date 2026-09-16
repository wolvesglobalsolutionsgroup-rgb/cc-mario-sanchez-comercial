# Demo CCMS: inicio en cinco minutos

## Requisitos

- Node.js 20 o superior.
- El repositorio clonado; no se necesita cuenta de Supabase, Vercel, SMTP, banco ni proveedor de IA.

## Ejecutar

```powershell
cd C:\Users\Administrator\Desktop\Memoria\cc-mario-sanchez-comercial
npm install
npm run demo
```

Abrir `http://localhost:4173/gestion/login.html?demo=1` y elegir cualquiera de los seis accesos demo. El servidor queda local y no hace llamadas a Supabase ni a las APIs de negocio.

Para la presentación autorizada de Mario Sánchez, abrir `http://localhost:4173/gestion/login.html?demo=1&dataset=mario`. Esta variante carga 38 locales y gastos provenientes de los dos libros autorizados, únicamente dentro de IndexedDB del navegador; no los materializa ni los escribe en Supabase. El laboratorio equivalente es `http://localhost:4173/gestion/demo-lab.html?dataset=mario`.

Para una presentación técnica de las operaciones nuevas, abrir también `http://localhost:4173/gestion/demo-lab.html`; incluye botones visibles para cobranza, importación, planos, marketplace, simulaciones y backup/restore.

## Verificar

En otra terminal:

```powershell
npm run test:demo
npm test
```

`test:demo` ejecuta tres capas: `test:demo:unit` (dominio y permisos), `test:demo:exports` (CSV/backup) y `test:demo:e2e` (navegador y red). Comprueba login, datos sintéticos, persistencia IndexedDB tras recarga, registro de pago, aprobación por un segundo actor, recibo y reinicio. `npm test` añade los 70 tests de estabilidad, seguridad, migraciones y UI responsive.

## Reiniciar la demo

Desde la consola del navegador se puede ejecutar `window.dbService.resetDemoData()`. Esto borra los cambios del escenario de la organización demo y conserva el fixture sintético original.

## Límites explícitos

La demo no envía correos, no consulta bancos, no firma documentos y no invoca IA. Cualquier pantalla de integración se presenta como simulación rotulada. La producción requiere configurar Supabase, dominio, correo, backups y proveedores de pago siguiendo `PLAN-SAAS-WGS-2026-09-15/04-STACK-Y-NEGOCIO.md`.
