# INSTRUCTIVO TÉCNICO OFICIAL SENIAT: DECLARACIÓN DE RETENCIONES DE IVA (ARCHIVO TXT 16 COLUMNAS)
**Código Oficial:** RI_DRIVA2020-IT01V3_0_0 (Gerencia General de Tecnología de Información y Comunicaciones - SENIAT)  
**Propósito:** Especificación de campo obligatoria para carga masiva de Retenciones de IVA por Sujetos Pasivos Especiales en el Portal Fiscal del SENIAT (`declaraciones.seniat.gob.ve`).

---

## 1. ESPECIFICACIÓN DE ESTRUCTURA (16 COLUMNAS SEPARADAS POR TABULADOR `\t`)

El archivo debe ser un archivo de texto plano (`.txt`), sin encabezados ni títulos de columnas, con exactamente 16 campos por fila delimitados por tabulador (`\t`) y con salto de línea estándar (`\r\n` o `\n`).

| Columna | Nombre del Campo | Tipo | Longitud | Descripción y Reglas de Validación | Ejemplo |
|:---|:---|:---:|:---:|:---|:---|
| **1** | `RIF_Contribuyente` | Alfanumérico | 10 | RIF del Agente de Retención (sin guiones ni espacios). Comienza con V, E, J, G o P. | `J309999990` |
| **2** | `Periodo_Impositivo` | Numérico | 6 | Período impositivo bajo formato estricto `AAAAMM`. El año no puede ser menor a 2003 ni mayor al actual. | `202603` |
| **3** | `Fecha_Documento` | Numérico | 10 | Fecha de la factura o documento en formato `AAAA-MM-DD`. Debe ser menor o igual al período de imposición. | `2026-03-01` |
| **4** | `Tipo_Operacion` | Alfabético | 1 | `C` = Compra / Proveedor (o `V` = Venta si aplica exportador). Para retención por arrendamiento/servicios es `C`. | `C` |
| **5** | `Tipo_Documento` | Numérico | 2 | `01` = Factura<br>`02` = Nota de Débito<br>`03` = Nota de Crédito<br>`04` = Certificaciones<br>`05` = Importación<br>`06` = Exportación | `01` |
| **6** | `RIF_Comprador_Vendedor` | Alfanumérico | 10 | RIF del Sujeto Retenido (arrendador o proveedor) sin guiones. Si no posee RIF se coloca `0` (en cuyo caso se valida retención al 100%). | `J123456789` |
| **7** | `Numero_Documento` | Alfanumérico | 20 | Número de la factura emitida. Sin espacios en blanco. Si no aplica, colocar `0`. | `FAC-0042` |
| **8** | `Numero_Control_Documento` | Alfanumérico | 20 | Número de control fiscal preimpreso o asignado. Sin espacios en blanco. Si no aplica, colocar `0`. | `00-009841` |
| **9** | `Monto_Documento` | Numérico (15,2) | 15 | Monto total bruto de la factura (Base + IVA + Exentos). Separador decimal punto (`.`). Mayor a 0. | `1160.00` |
| **10** | `Base_Imponible` | Numérico (15,2) | 15 | Base imponible sujeta a IVA. Separador decimal punto (`.`). Si la operación es 100% exenta, colocar `0.00`. | `1000.00` |
| **11** | `Monto_IVA_Retenido` | Numérico (15,2) | 15 | **Monto del IVA efectivamente retenido** por el Agente (ej. el 75% o 100% del impuesto causado). Separador decimal punto (`.`). Si no aplica, colocar `0.00`. | `120.00` |
| **12** | `Numero_Documento_Afectado`| Alfanumérico | 20 | En caso de Nota de Débito o Crédito (`02` o `03`), número de la factura original que se afecta. Si es Factura (`01`), colocar `0`. | `0` |
| **13** | `Numero_Comprobante` | Numérico | 14 | Identificador único del Comprobante de Retención entregado al proveedor bajo formato `AAAAMMSSSSSSSS` (Año 4 + Mes 2 + Secuencial de 8 dígitos con ceros a la izquierda). | `20260300000001` |
| **14** | `Monto_Exento_IVA` | Numérico (15,2) | 15 | Monto total de operaciones exentas, exoneradas o no sujetas a IVA (ej. gastos de condominio o fondos de terceros). Separador punto (`.`). Si no hay, colocar `0.00`. | `0.00` |
| **15** | `Alicuota` | Numérico (5,2) | 5 | Porcentaje de la alícuota de IVA aplicada a la factura (`16.00`, `8.00`, etc.). Separador punto (`.`). Si está exenta, colocar `0.00`. | `16.00` |
| **16** | `Numero_Expediente` | Numérico | 15 | Número de confrontación asignado en aduana para importación (SIDUNEA/CODA). Para operaciones nacionales, colocar obligatoriamente `0`. | `0` |

---

## 2. REGLAS CRÍTICAS DE CONSISTENCIA Y VALIDACIÓN DEL SENIAT

1. **Separador decimal:** Obligatoriamente el carácter punto (`.`). NUNCA usar coma (`,`).
2. **Separador de columnas:** Únicamente el carácter Tabulador (`\t`). No usar espacios, barras `|` ni punto y coma `;`.
3. **RIF del Agente (Col 1):** Debe coincidir exactamente con el RIF del contribuyente que ingresó al Portal del SENIAT con su clave fiscal.
4. **Período (Col 2):** Formato `AAAAMM` (6 dígitos exactos). Coincidente con la quincena o mes objeto de declaración.
5. **Comprobante (Col 13):** Exactamente 14 dígitos. Los primeros 6 dígitos (`AAAAMM`) deben ser idénticos al `Periodo_Impositivo` de la Columna 2.
6. **Monto IVA Retenido (Col 11):** En las compras/arrendamientos donde el Centro Comercial actúa como agente de retención, este valor es el monto que se descuenta y se entera al fisco:
   $$\text{Monto IVA Causado} = \text{Base Imponible} \times \left(\frac{\text{Alícuota}}{100}\right)$$
   $$\text{Monto Retenido} = \text{Monto IVA Causado} \times \left(\frac{\% \text{ Retención (75\% o 100\%)}}{100}\right)$$
7. **Documento Afectado (Col 12) y Expediente (Col 16):** Si no existen, rellenar estrictamente con el carácter `0`.

---

## 3. TABLA OFICIAL DE ERRORES DEL SISTEMA SENIAT

| Mensaje de Error en Portal | Causa Frecuente | Solución Técnica |
|:---|:---|:---|
| *Tipo incorrecto de archivo, debe ser un archivo tipo texto de 16 columnas* | Archivo tiene 15 o 17 columnas o caracteres invisibles. | Verificar que cada fila termine en la columna 16 (`0`) y tenga exactamente 15 tabuladores. |
| *Existe una línea que no tiene la cantidad de campos requeridos* | Líneas en blanco al final o saltos de línea huérfanos. | Eliminar líneas vacías al final del `.txt`. |
| *Formato errado en la columna período Impositivo* | Se colocó `2026-03` o `03/2026`. | Usar formato estricto `202603`. |
| *Formato errado en la columna fecha del documento* | Se colocó `01/03/2026` o `01-03-2026`. | Usar formato internacional ISO `AAAA-MM-DD` (`2026-03-01`). |
| *La columna RIF del Agente no puede quedar en blanco* | Espacios antes o después del RIF. | Aplicar trim a los campos de texto. |
