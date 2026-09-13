# ÍNDICE MAESTRO DE FUENTES PRIMARIAS, GACETAS OFICIALES Y FORMULARIOS ORIGINALES (PDF)
**Base de Conocimiento para Ingesta en NotebookLM:** `https://notebooklm.google.com/notebook/3914afb9-a48b-4130-8890-7eaed1fddb28`
**Área de Dominio:** Commercial Real Estate (CRE), Arrendamiento Inmobiliario Comercial, Tributación Municipal y SENIAT en Venezuela.

---

## 1. Legislación Nacional & Sectorial de Arrendamiento Comercial

### 1.1 Gaceta Oficial N° 40.418 (23 de mayo de 2014)
* **Nombre Oficial:** Decreto N° 929 con Rango, Valor y Fuerza de Ley de Regulación del Arrendamiento Inmobiliario para el Uso Comercial.
* **Materia:** Régimen de fijación de cánones (CAF, CAV, CAM), depósitos en garantía (máximo 3 meses en cuenta bancaria remunerada), prórroga legal escalonada obligatoria (Art. 26), finiquitos y arbitraje de controversias ante la SUNDDE.
* **Enlace Oficial TSJ / Repositorio:**
  * [Tribunal Supremo de Justicia (Gaceta 40.418)](http://historico.tsj.gob.ve/gaceta/mayo/2352014/2352014-3982.pdf)
  * [Pandectas Digital - Decreto Ley 929](https://pandectasdigital.home.blog/2014/05/23/gaceta-oficial-n-40-418/)
* **Uso en NotebookLM:** Extraer reglas sobre prórroga obligatoria, penalidades por mora y límites del canon variable (8%) y mixto (50% porción fija).

---

## 2. Régimen Tributario Municipal & Armonización Fiscal (Alcaldías)

### 2.1 Gaceta Oficial N° 6.755 Extraordinario (10 de agosto de 2023)
* **Nombre Oficial:** Ley Orgánica de Coordinación y Armonización de las Potestades Tributarias de los Estados y Municipios (LOCAT).
* **Materia:** Establece los límites máximos a las alícuotas municipales, clasificador único de actividades económicas (CIIU 6810 para bienes inmuebles comerciales), prohibición de cobro confiscatorio y adopción del Tipo de Cambio de la Moneda de Mayor Valor fijado por el BCV (TCMMV) como unidad de cuenta.
* **Enlace Oficial TSJ / Asamblea Nacional:**
  * [Gaceta Oficial Extraordinaria 6.755 (PDF)](http://spgoin.imprentanacional.gob.ve/cgi-win/be_alex.cgi?Documento=T028700042456/0&Nombrebd=spgoin&CodAsocDoc=3211&TipoDoc=GXT&Sesion=163013832)
* **Uso en NotebookLM:** Consultar topes de alícuotas del ISAE (máximo 3.0%), exoneraciones de fondos de terceros y límites a tasas de aseo urbano.

### 2.2 Código Civil de Venezuela (Gaceta N° 2.990 Extraordinario de 26/07/1982)
* **Artículos Clave:**
  * **Artículo 1.684:** Naturaleza del Mandato ("El mandato es un contrato por el cual una persona se obliga gratuitamente, o mediante salario, a ejecutar uno o más negocios por cuenta de otra, que la ha encargado de ello").
  * **Fundamento:** Los cobros de luz, agua, vigilancia y mantenimiento de áreas comunes recaudados por la Administradora constituyen fondos en custodia de la Comunidad de Propietarios/Inquilinos. **NO son enriquecimiento ni ingreso bruto de la sociedad mercantil, por lo que están legalmente exentos de patente municipal (ISAE)**.

---

## 3. Normativa Fiscal Nacional (SENIAT)

### 3.1 Providencia Administrativa SENIAT SNAT/2023/000035 (01 de agosto de 2023 - G.O. N° 42.682)
* **Materia:** Régimen de Retenciones de IVA para Sujetos Pasivos Especiales.
* **Porcentajes:** 75% regla general / 100% en supuestos especiales.
* **Formato de Archivo TXT Oficial:**
  * Estructura por columnas separadas por tabulador (`\t`):
    `RIF_AGENTE\tPERIODO\tFECHA_FAC\tTIPO_OP\tTIPO_DOC\tRIF_SUJETO\tNUM_FAC\tNUM_CTRL\tMONTO_TOTAL\tBASE\tIVA_RETENIDO\tNUM_AFECT\tNUM_COMPROB\tEXENTO\tALICUOTA\tNUM_EXP`
  * **Regla estricta:** Período en formato `AAAAMM` (Año 4 dígitos + Mes 2 dígitos, ej. 202603) y RIF limpio sin guiones.
* **Enlace SENIAT:** [Portal SENIAT - Manual de Retenciones](http://declaraciones.seniat.gob.ve)

### 3.2 Providencia Administrativa SENIAT SNAT/2014/0032 (25 de julio de 2014 - G.O. N° 40.461)
* **Materia:** Requisitos formales de emisión de facturas, órdenes de entrega y libros fiscales (Libro de Compras y Libro de Ventas).
* **Conservación:** Obligación de conservar comprobantes y libros digitales por 10 años auditable (Art. 102 COT).

### 3.3 Decreto N° 1.808 (12 de mayo de 1997 - G.O. N° 36.203)
* **Materia:** Reglamento Parcial de la Ley de Impuesto sobre la Renta en materia de Retenciones.
* **Alícuota Inmobiliaria:** 5% para personas jurídicas arrendadoras / 3% para personas naturales residentes (Art. 9, Numeral 11).

### 3.4 Gaceta Oficial N° 6.687 Extraordinario (25 de febrero de 2022)
* **Materia:** Ley de Impuesto a las Grandes Transacciones Financieras (IGTF).
* **Alícuota:** 3% sobre pagos recibidos en divisas en efectivo, Zelle, criptomonedas o transferencias bancarias internacionales no intermediadas por la banca nacional.

---

## 4. Formularios y Planillas Oficiales a Replicar en el SaaS

1. **Formulario DP-ISAE (Declaración de Actividades Económicas de la Alcaldía):**
   * Encabezado con RIF, Nombre Comercial, Licencia de Funcionamiento.
   * Clasificador de Actividad (6810-01).
   * Columna 1: Ingresos Brutos Totales Declarados.
   * Columna 2: Deducciones Legales / Fondos de Terceros Exentos (Condominio).
   * Columna 3: Base Imponible Neta Sujeta a Patente.
   * Columna 4: Alícuota Municipal Aplicable (ej. 2.00%).
   * Columna 5: Impuesto Autoliquidado a Pagar al Municipio.
2. **Archivo Plano TXT SENIAT:**
   * Archivo físico `.txt` codificado en UTF-8 o ANSI sin encabezado, listo para subir por la opción "Carga de Archivo de Retenciones de IVA" en el portal SENIAT.
3. **Certificado Bomberil de Inspección:**
   * Formulario de Evaluación de Riesgos y Carga Calórica para Edificaciones Comerciales.
4. **Ficha Catastral Urbana:**
   * Formato de registro de linderos, superficie de terreno y construcción para el cálculo del Derecho de Frente.
