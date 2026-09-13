# Estado y Registro de Auditorías — CC Mario Sánchez (CCMS)

Las auto-evaluaciones anteriores a septiembre de 2026 generadas durante ciclos de desarrollo rápido han sido formalmente archivadas y retractadas por transparencia técnica y gobernanza.

El estándar vigente para este proyecto es el **Diagnóstico Unificado v2 & Protocolo Evidence-First**, el cual establece:

1. **Protocolo Evidence-First:** Ningún certificado o afirmación tiene validez sin pruebas directas sobre el código ejecutable, la sintaxis y las configuraciones de producción.
2. **Ground Truth Inmobiliario:** Los datos de los 39 locales, cánones y gastos provienen de los archivos maestros oficiales del Centro Comercial Mario Sánchez (5.190 m²).
3. **Acuerdo de Modo DEMO & Condición de Go-Live (SEC-02):**
   - **Fase Actual (Showcase / Evaluación Comercial):** `CCMS_DEMO_MODE` opera activo por defecto (`localStorage.getItem('CCMS_FORCE_DEMO') !== 'false'`) para permitir demostración inmediata a inversionistas y juntas directivas vía URL directa de Vercel. Se cuenta con el atajo `?demo=off` para desactivación explícita.
   - **Condición Estricta de Go-Live (Previo a conectar el primer cliente real en esta URL):**  
     Se debe invertir la condición en `gestion/index.html` (línea ~48) y `gestion/login.html` (línea ~35) a:
     ```javascript
     window.CCMS_DEMO_MODE = (localStorage.getItem('CCMS_FORCE_DEMO') === 'true');
     ```
     En ese momento el login se delega exclusivamente a `supabase.auth.signInWithPassword()` y se inhabilitan las contraseñas de evaluación (`Admin2026*` / `Demo2026*`).
4. **Visor de Contratos Notariados (G.O. 40.418):**
   - Corregido el patrón *fail-open*: si un inquilino específico no se encuentra, la aplicación retorna `null` y despliega toast de error administrativo, impidiendo la exposición de datos de terceros.
5. **Integridad de la Cadena de Suministro (SRI):**
   - Hash SHA-512 de `proj4.js` v2.9.0 verificado bit por bit contra CDN:  
     `sha512-lO8f7sIViqr9x5VE6Q72PS6f4FoZcuh5W9YzeSyfNRJ9z/qL3bkweiwG6keGzWS0BQzNDqAWXdBhYzFD6KffIw==`.
6. **Conciliación Bancaria Tridimensional:**
   - Algoritmo en `bank-reconciliation.js` aplica tolerancia de fecha (`toleranceDays = 3`) junto con referencia y monto para evitar falsos positivos en cobros recurrentes.
7. **Persistencia Híbrida y Control de Concurrencia Optimista:**
   - En fase de evaluación/showcase, `DatabaseService` actúa como almacén reactivo local (`localStorage`) que incrementa la columna `version` para simular control de concurrencia.
   - En conexión de producción real (`window.supabaseClient`), `approvePayment` ejecuta la mutación remota directa contra PostgreSQL:
     ```javascript
     window.supabaseClient.from('payments').update({
       status: 'verificado',
       verified_by: payment.verified_by,
       verified_at: payment.verified_at,
       version: payment.version
     }).eq('id', payment.id).eq('version', currentVersion)
     ```
     garantizando atomicidad e impidiendo colisiones de estado en red (Optimistic Locking).
8. **Consolidación Canónica de Esquema SQL:**
   - La arquitectura de base de datos se unificó estrictamente bajo el estándar de Supabase CLI en `supabase/migrations/` (6 migraciones secuenciales ordenadas cronológicamente) más `supabase/seed_data.sql`.
   - Se eliminaron todos los directorios redundantes (`/migrations`), archivos raíz sueltos (`supabase_schema_rls.sql`) y duplicados obsoletos (`supabase/schema.sql`).
9. **Marco Legal, Tributario y Disclaimers Doctrinales:**
   - **Prórroga Legal Inmobiliaria:** Obligatoria y escalonada regida por el **Artículo 26** del Decreto Ley N° 929 de Arrendamiento Inmobiliario para el Uso Comercial (G.O. 40.418).
   - **Retenciones IVA SENIAT:** Generación del archivo TXT bajo instructivo oficial `RI_DRIVA2020-IT01V3_0_0` (16 columnas separadas por tabulador y período `AAAAMM`).
   - **IGTF (3%):** Percepción del Impuesto a las Grandes Transacciones Financieras (G.O. Ext. 6.687) para pagos en divisas en efectivo o criptoactivos no bancarios.
   - **Deducción de Condominio (ISAE Municipal):** Basada en la doctrina de representación y mandato del **Artículo 1.684 del Código Civil Venezolano** (los fondos de condominio recaudados actúan por cuenta y orden de la comunidad de propietarios, no como ingreso bruto propio del arrendador). *Nota de gobernanza: Esta interpretación doctrinal y la alícuota referencial del 2% para el Municipio Sotillo deben ser ratificadas por un abogado tributarista colegiado en la jurisdicción local antes de la presentación de declaraciones juradas definitivas.*
