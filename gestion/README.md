# Suite de Gestión Inmobiliaria, Fiscal & Cobranzas — CC Mario Sánchez (CRE ERP)

Plataforma SaaS para la administración integral de locales comerciales, macro-lotes y galpones, control de cuotas mensuales, conciliación de pagos multimoneda y cumplimiento fiscal y legal de arrendamiento comercial en Venezuela.

---

## 🚀 Capacidades Principales del ERP

1. **Dashboard Ejecutivo de Cobranzas**:
   - Métricas de ocupación en m² sobre el total del master plan (5.190 m²).
   - Recaudación mensual proyectada vs. cobrada en tiempo real.
   - Indicador de cartera en mora y contratos próximos a vencer con prórroga legal (Art. 26 G.O. 40.418).
   - Ticker bimonetario USD / Bs. a la tasa oficial del Banco Central de Venezuela (BCV).
2. **Onboarding de Inquilinos en 4 Pasos**:
   - Asignación de unidades comerciales.
   - Registro de datos jurídicos (RIF, Registro Mercantil, Cédula del Representante Legal).
   - Estipulación de canon según métodos CAF / CAV / CAM (Art. 32 G.O. 40.418).
   - Depósito en garantía restringido a máximo 3 meses en cuenta remunerada (Art. 19).
3. **Control de Pagos y Emisión de Recibos**:
   - Conciliación de transferencias bancarias nacionales (Banesco, Mercantil, BDV), Pago Móvil, Zelle, efectivo en custodia y USDT.
   - Emisión e impresión de recibos oficiales con formato legal y desglose de condominio.
4. **Liquidación Tributaria Automatizada (Pilar 6)**:
   - **Motor SENIAT (`seniat-engine.js`):** Genera el archivo plano físico `.txt` de 16 columnas delimitadas por tabulador conforme a la Providencia SNAT/2023/000035 y el instructivo oficial `RI_DRIVA2020-IT01V3_0_0`, listo para procesarse en el Portal Fiscal del SENIAT sin errores tipográficos.
   - **Motor Alcaldías (`alcaldia-engine.js`):** Liquidación automatizada del Impuesto Sobre Actividades Económicas (ISAE) con clasificador CIIU 6810, alícuotas configurables para 10 municipios venezolanos (Chacao, Baruta, Sotillo, Valencia, Maracaibo, etc.) y deducción estricta de gastos de condominio por Contrato de Mandato (Art. 1.684 Código Civil).
5. **Observabilidad & Monitoreo en Producción (Pilar 1)**:
   - Módulo `telemetry.js` que escucha excepciones globales (`window.onerror`), mide métricas Web Vitals (LCP, CLS, FID) y permite exportar diagnósticos en JSON con datos sensibles redactados.
6. **Autenticación Robusta & Modo Demo por Roles (Pilar 2)**:
   - Selector visual de roles (`Superadmin`, `Inquilino`, `Directiva`, `Auditor`) tanto en modo Demo como en conexión activa con Supabase PostgreSQL.
7. **Centro de Ayuda con Fórmulas Determinísticas**:
   - Modal interactivo con memoria de cálculo detallada de cada fórmula matemática y marco normativo venezolano.

---

## ⚖️ Resumen de Fórmulas y Bases Legales

| Cálculo | Fórmula Determinística | Base Legal Vinculante |
|:---|:---|:---|
| **Canon con Amortización** | $\text{Canon Neto} = \max(0, \text{Base} - \text{Acuerdo}) + \text{Condominio}$ | G.O. N° 40.418 (Art. 32) & Cód. Civil Art. 1.159 |
| **Prorrateo Condominio** | $(\text{Área Local } \text{m}^2 / \text{Área Total}) \times \$2,540.00$ | G.O. N° 40.418 (Art. 13 y 19) |
| **Recargo Moratorio** | $\text{Deuda} \times (\text{Tasa Mensual } \% / 30) \times \text{Días Mora}$ | Código de Comercio Venezolano Art. 108 |
| **Frutos Sucesión (1/14)** | $(\text{Ingresos Cobrados} - \text{Egresos} - \text{Reservas}) / 14$ | Código Civil Art. 552 y Art. 768 |
| **Base Imponible ISAE** | $\text{Ingresos Brutos Totales} - \text{Condominio en Custodia}$ | LOCAT (G.O. Ext. 6.755) & Art. 1684 Cód. Civil |
| **Retención IVA SENIAT** | $\text{Base Imponible} \times 16\% \times 75\%$ | Providencia SNAT/2023/000035 |
| **Retención ISLR Arrendamiento**| $\text{Base Imponible} \times 5\%$ (Jurídicas) / $3\%$ (Naturales) | Decreto 1808 (Art. 9 Num. 11) |
| **IGTF en Divisas** | $\text{Cobro Divisas / Cripto} \times 3.00\%$ | Gaceta Oficial Ext. N° 6.687 |

---

## 📚 Base de Datos para Google NotebookLM

En `docs/corpus_notebooklm/pdfs/` se encuentran descargados los 7 archivos PDF oficiales físicos (Decreto 929 de Arrendamiento Comercial, LOCAT, COT 2020, Ley IGTF, Decreto 1808 ISLR, Providencia IVA 40.720 y Providencia Facturación 0071). Puedes arrastrarlos directamente a tu cuaderno:
👉 `https://notebooklm.google.com/notebook/3914afb9-a48b-4130-8890-7eaed1fddb28`
