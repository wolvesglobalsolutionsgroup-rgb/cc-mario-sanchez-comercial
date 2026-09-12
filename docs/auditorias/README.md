# Estado y Registro de Auditorías — CC Mario Sánchez (CCMS)

Las auto-evaluaciones anteriores a septiembre de 2026 generadas durante ciclos de desarrollo rápido (incluyendo 'CERTIFICADO_AUDITORIA_v2.6.0.md') han sido formalmente archivadas y retractadas por transparencia técnica y gobernanza.

El estándar vigente para este proyecto es el **Diagnóstico Unificado v2 & Protocolo Evidence-First**, el cual establece:
1. Ningún certificado o claim 'Enterprise Ready' tiene validez sin pruebas directas sobre el código ejecutable y las configuraciones de producción.
2. Los datos de los 39 locales, cánones y gastos provienen de los archivos maestros oficiales del Centro Comercial Mario Sánchez (Ground Truth).
3. El modo DEMO está aislado bajo el flag estricto opt-in (\CCMS_DEMO_MODE === true\) y las credenciales demo quedan inhabilitadas en producción.
4. La Prórroga Legal obligatoria se rige formalmente por el **Artículo 26** del Decreto Ley N° 929 (G.O. 40.418).
5. Se incorpora la alícuota del 3% de IGTF (G.O. 6.687) para pagos en divisas y criptoactivos.
6. Se aplican restricciones anti-replay y purga de estado local (CacheStorage / IndexedDB) en el logout.
