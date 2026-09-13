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
7. **Control de Concurrencia (Anti-IDOR):**
   - Columna `version` en `payments` es incrementada y sincronizada tanto en PostgreSQL como en el almacenamiento local en cada aprobación de cobranza.
8. **Marco Legal y Tributario:**
   - Prórroga Legal obligatoria escalonada regida por el **Artículo 26** del Decreto Ley N° 929 (G.O. 40.418).
   - Deducción de gastos de condominio en base imponible municipal conforme al **Artículo 1.684 del Código Civil** (Contrato de Mandato).
   - Generación del archivo TXT de retenciones de IVA SENIAT bajo instructivo oficial `RI_DRIVA2020-IT01V3_0_0` (16 columnas tabuladas y período `AAAAMM`).
   - Percepción del 3% de IGTF (G.O. Ext. 6.687) para pagos en divisas efectivo o criptoactivos no bancarios.
