# Estado de salida a producción — 15-09-2026

## Evidencia verificada

- SHA publicado en `main`: `7f46d8e`.
- Vercel responde `200` en `/login`, `/onboarding`, `/gestion`, `/gestion/login` y `/gestion/onboarding`.
- Supabase `wgs-proptech-prod` tiene aplicadas las migraciones de identidad, RLS, comandos financieros y endurecimiento.
- Demo pública verificada con datos autorizados de los libros: 38 locales, 38 inquilinos, facturación $7.560, recaudado $2.910, 30 cuotas vencidas por $4.650 y 159 gastos.
- `npm test`: 57/57 pruebas; verificación de remediaciones y smoke UI 390/1440 aprobados.
- Los fixtures reales se cargan solo en sesión demo y host permitido; producción no los incluye en `index.html`.

## Bloqueos restantes antes de aceptar producción real

1. Crear/validar usuarios reales en Supabase Auth y recorrer cada rol con dos organizaciones.
2. Completar comandos remotos de altas, ediciones y bajas de módulos no financieros; la demo permanece deliberadamente de solo lectura.
3. Validar Storage, exportaciones, restauración de base/archivos y ensayo RPO/RTO.
4. Ejecutar E2E autenticado en 360/390/768/1440 px y revisión manual WCAG 2.2 AA.
5. Cerrar aceptación del período contable patrón y revisar saldos contra libros originales.
6. Activar, cuando el cliente lo autorice, las credenciales de IA, Telegram/WhatsApp, correo, alertas y dominio/Cloudflare.

La versión actual es una demo operativa y una base de producción conectada; no se debe declarar producción contable definitiva hasta cerrar los seis puntos anteriores.
