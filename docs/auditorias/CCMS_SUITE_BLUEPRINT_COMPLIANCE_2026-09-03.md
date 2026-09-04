# CCMS — Blueprint de Suite Administrativa, Contable, Trazable y de Pagos

Fecha: 2026-09-03  
Alcance: Portal comercial, alquiler, ERP administrativo y portal del inquilino. El levantamiento GIS se mantiene como entrega independiente.

## Veredicto actual

La versión publicada es una demo funcional basada en `localStorage`. Sirve para mostrar navegación, catálogo, onboarding, contratos simulados, cuotas, pagos, recibos y alertas, pero todavía **no es un sistema contable ni fiscal de producción**: no existe persistencia multiusuario, autenticación de servidor, conciliación bancaria real, proveedor de pagos, envío transaccional configurado ni documento fiscal autorizado.

No se debe presentar un recibo demo como factura fiscal válida. Para emitir documentos fiscales debe definirse con el contador y el asesor tributario del arrendador la modalidad autorizada por el SENIAT y, si aplica, integrar una imprenta digital/proveedor autorizado.

## Requisitos funcionales que debe cubrir la suite

### Administración inmobiliaria

- Catálogo de unidades con código único, metraje, categoría, disponibilidad, alícuota, servicios y evidencias fotográficas.
- Expediente de cada arrendatario: RIF, razón social, marca, representante, domicilio fiscal, actividad, contactos y documentos.
- Contratos versionados: número, fechas, canon, método CAF/CAP/MIXTO, garantía, prórroga, anexos, renovaciones y terminación.
- Onboarding con validaciones, checklist documental, aceptación, invitación de usuario y trazabilidad de cada paso.
- Agenda de vencimientos, renovaciones, inspecciones, mantenimientos y tareas asignadas.

### Facturación, recibos y contabilidad

- Factura/recibo con serie, número, período, concepto, unidad, contrato, emisor, receptor, RIF, moneda, tasa aplicada, base imponible, IVA, descuentos, retenciones, IGTF cuando corresponda, total y saldo.
- Líneas de factura separadas: canon, condominio, electricidad, servicios, recargos y otros conceptos.
- Notas de crédito, notas de débito, anulaciones con motivo y referencia al documento original; nunca borrar documentos emitidos.
- Libro de ingresos/egresos, plan de cuentas, asientos vinculados a factura/pago/gasto, conciliación y exportación para el contador.
- Numeración controlada y auditada: no reutilizar números, registrar anulaciones, usuario, fecha/hora, IP y motivo.
- Estados separados: borrador, emitida, enviada, parcialmente pagada, pagada, vencida, en disputa, anulada.
- PDF descargable y comprobante de pago claramente identificado como recibo administrativo o documento fiscal, según la configuración autorizada.

### Pagos del inquilino

- Portal privado donde el inquilino vea únicamente sus contratos, cuotas, saldos, estados de cuenta y documentos.
- Instrucciones de pago por moneda y método: transferencia, pago móvil, cuenta bancaria, Zelle/otro canal permitido y cripto solo si el arrendador lo autoriza.
- Registro de intención de pago, monto, moneda, fecha valor, banco, referencia, comprobante, TxID/red cuando corresponda y comentarios.
- Flujo `enviado → en revisión → aprobado/rechazado`, con motivo obligatorio de rechazo y reenvío.
- Snapshot inmutable de tasa BCV y equivalencias al momento del pago; no recalcular históricos con la tasa actual.
- Conciliación administrativa: aprobar, rechazar, aplicar parcial, reversar con autorización y relacionar el pago con la factura.
- Recibo automático después de aprobación, estado de cuenta actualizado y notificación al inquilino.

### Notificaciones multicanal

- Correo transaccional desde servidor con Resend y dominio verificado mediante SPF/DKIM; nunca exponer API keys en el frontend.
- SMS/WhatsApp mediante proveedor autorizado y consentimiento/configuración por destinatario; WhatsApp Web manual no equivale a automatización.
- Plantillas versionadas para bienvenida, factura emitida, vencimiento, mora, pago recibido, pago aprobado/rechazado, renovación y mantenimiento.
- Registro por intento: canal, destinatario, plantilla, evento, proveedor, estado, timestamp, message ID, error y reintentos.
- Preferencias del inquilino y baja de comunicaciones no esenciales; mantener los avisos contractuales conforme a la política aprobada.
- Bandeja de fallos para reintento manual y webhook de rebotes/quejas del proveedor.

### Cumplimiento y trazabilidad

- Bitácora append-only de login, alta, modificación, emisión, envío, pago, aprobación, rechazo, anulación, exportación y cambio de configuración.
- Cada evento debe conservar actor, rol, tenant, entidad, antes/después, motivo, fecha/hora UTC, IP/user-agent cuando sea legal y disponible.
- Retención configurable y exportación de expediente completo por arrendatario/contrato/período.
- RLS por organización y arrendatario; el administrador ve su organización y el inquilino solo sus registros.
- Separación de funciones: quien registra no necesariamente aprueba; acciones de alto impacto requieren confirmación y motivo.
- Cifrado en tránsito, almacenamiento de documentos fuera de `localStorage`, URLs firmadas y límites de tamaño/tipo.
- Política de privacidad, términos de uso, consentimiento de comunicaciones y procedimiento para corrección/consulta de datos.

## Marco venezolano a convertir en controles

1. **Arrendamiento comercial:** el sistema puede parametrizar cláusulas, garantías, fechas y prórrogas, pero el contrato final debe ser revisado por abogado local. Las reglas no deben quedar codificadas como verdades universales sin configuración y evidencia.
2. **Facturación digital:** la Providencia Administrativa SNAT/2024/000102 regula el uso de medios digitales para facturas y otros documentos, incluyendo notas de débito, notas de crédito, órdenes/guías y comprobantes de retención. El sistema debe separar “recibo administrativo” de “documento fiscal” y dejar la integración fiscal como adaptador verificable.
3. **Cambios regulatorios:** antes de producción debe verificarse la norma vigente, autorizaciones del contribuyente, numeración/control, imprenta digital o proveedor y conservación documental. La revisión publicada sobre SNAT/2026/00084 indica cambios recientes sobre proveedores de sistemas; no se debe asumir que una integración propia queda automáticamente autorizada.
4. **Moneda y tasa:** toda conversión debe guardar tasa, fuente, fecha/hora, moneda original y equivalente; la tasa mostrada al cliente debe distinguirse de una tasa histórica aplicada a un pago.
5. **Datos personales:** RIF, cédula, teléfonos, correo, documentos y comprobantes requieren acceso mínimo, propósito, conservación y controles de privacidad; debe existir un responsable que valide las obligaciones aplicables.

## Diferencia entre demo y producción

| Capacidad | Demo actual | Producción requerida |
|---|---|---|
| Persistencia | `localStorage` por navegador | Supabase PostgreSQL + RLS |
| Login | credenciales demo cliente | Supabase Auth + invitación |
| Factura | datos de muestra/recibo | motor fiscal o proveedor autorizado |
| Pago | registro local | intención, revisión, conciliación y reverso |
| Documento | PDF/impresión administrativa | numeración y conservación según modalidad fiscal |
| Correo | `mailto`/endpoint preparado | Resend con dominio y webhooks |
| Teléfono | enlaces manuales | proveedor SMS/WhatsApp + consentimiento |
| Auditoría | consola/local | tabla append-only y reportes |
| Archivos | base64 local | Storage privado + URLs firmadas |

## Auditoría de identidad CCMS

Los dos archivos actuales `logo_cc_mario_sanchez.svg` (raíz y `gestion/`) tienen el mismo SHA-256 y se usan en portal, alquiler, login, onboarding y ERP. Debe mantenerse una única fuente maestra y copiarla solo durante el build, con alt text consistente: `Logo CC Mario Sánchez`. No se detectó una divergencia de archivo en esta auditoría; sí conviene eliminar futuras copias manuales y centralizar favicon, encabezado, pie y plantilla de documentos.

## Orden de implementación recomendado

1. Crear Supabase y aplicar esquema, perfiles, organizaciones, invitaciones, RLS y Storage privado.
2. Migrar entidades locales a tablas normalizadas: invoice_lines, fiscal_documents, payment_submissions, notification_deliveries, exchange_rate_snapshots, tenant_documents y audit_events.
3. Conectar Supabase Auth y reemplazar guard demo; conservar demo en un proyecto/flag aislado.
4. Construir portal de inquilino con estado de cuenta, instrucciones, envío de comprobante y seguimiento.
5. Construir bandeja administrativa de revisión, conciliación, emisión de recibos y anulaciones.
6. Integrar correo Resend; después agregar SMS/WhatsApp con proveedor y webhooks.
7. Integrar proveedor fiscal autorizado si el cliente requiere factura fiscal digital; validar con contador/abogado.
8. Agregar exportaciones, cierres mensuales, reportes de morosidad/ocupación y expediente auditable.
9. Validar con datos reales anonimizados en Preview; solo después promover a producción.

## Criterios de aceptación

- Un administrador crea un inquilino y contrato; el sistema genera la primera cuota con snapshot de tasa.
- El inquilino invitado ve únicamente sus datos y envía un comprobante.
- El administrador revisa, aprueba/rechaza y cada transición queda registrada.
- El inquilino recibe correo y la notificación telefónica configurada; cada intento es consultable.
- Un recibo aprobado reproduce exactamente monto, moneda, tasa y referencia del pago.
- Un documento anulado conserva número, motivo, actor y relación con el documento original.
- Dos organizaciones no pueden leer ni modificar datos entre sí.
- No se puede borrar silenciosamente una factura, pago, contrato o evento de auditoría.
- Los cinco usos del logo (portal, alquiler, login, ERP y documentos) muestran la misma identidad CCMS.

Este documento es una especificación técnica y de control. No constituye certificación fiscal ni asesoría legal.
