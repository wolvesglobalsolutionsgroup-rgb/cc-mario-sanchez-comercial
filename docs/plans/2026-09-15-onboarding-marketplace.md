# Extensión del plan CCMS: onboarding SaaS y marketplace

## Veredicto

**APROBADO CON CAMBIOS.** La propuesta es viable y reutiliza `organizations`, `properties`, permisos, el parser de libros y el catálogo existente en [`js/alquiler.js`](../../js/alquiler.js). El onboarding real debe convertirse en una entrega propia porque `api/onboarding.js` no existe actualmente en este checkout. El marketplace debe permanecer posterior al alta de varios clientes y operar sobre una proyección pública curada, nunca sobre `units` directamente.

## Onboarding de una nueva organización

1. **Descubrimiento:** registrar cantidad de inmuebles, municipio, régimen sucesoral, plan contratado, moneda operativa, responsables y aceptación de tratamiento de datos.
2. **Alta controlada:** crear `organizations` y `properties` en una transacción; aplicar `features` versionadas y crear una invitación de primer administrador con expiración.
3. **Carga maestra:** recibir el libro, calcular hash, guardar origen y mostrar vista previa con conteos, campos faltantes, duplicados y filas ambiguas. Confirmar solo después de la revisión del cliente.
4. **Usuarios:** invitar Dirección, Administración, Contabilidad, Auditoría y Operaciones; los inquilinos se vinculan después a su unidad mediante invitación separada.
5. **Arranque:** ejecutar un primer período acompañado, validar saldos y dejar acta de aceptación. El sistema conserva el origen y permite reversar una importación sin borrar auditoría.

### Entregas que se agregan al plan

- **E14 — Onboarding serverless:** endpoint de alta idempotente, invitaciones, expiración, límites por plan y auditoría. Nunca acepta `organization_id`, rol propietario ni permisos desde el navegador sin recalcularlos en servidor.
- **E15 — Configuración de features:** formulario por organización para sucesión, fiscalidad municipal, terminología, monedas y módulos. Cambios versionados, con diff y motivo.
- **E16 — Importador con vista previa:** parser por formato, staging con hash, errores por fila, confirmación transaccional y recuperación.
- **E17 — Activación guiada:** checklist, invitaciones, capacitación y primer cierre de período.

### Contratos de aceptación del onboarding

- Un usuario ordinario no puede crear organizaciones ni otorgarse `founder`.
- Repetir la misma clave de alta no duplica organización, inmueble ni invitación.
- Una importación con errores queda en staging y no cambia indicadores.
- Dos organizaciones no pueden leer ni modificar datos de la otra.
- La configuración de features no puede activar un módulo sin permiso de la organización.

## Marketplace multi-organización

### Modelo recomendado

- `organizations.marketplace_opt_in` y estado de publicación con auditoría.
- `marketplace_listings`: `organization_id`, `property_id`, `unit_id`, nombre público, ciudad, categoría, área, rango de canon, fotos aprobadas, estado y fecha de publicación.
- `marketplace_leads`: listado, organización propietaria, datos mínimos del interesado, consentimiento, estado y responsable de seguimiento.
- Vista pública o endpoint dedicado que exponga solo listados publicados y campos permitidos. No publicar RIF, mora, contratos, propietarios, cuentas bancarias ni documentos.
- RLS privada para administración; la lectura pública se limita a `status = 'published'`, `marketplace_opt_in = true` y campos de la proyección pública.

### Fases del marketplace

- **E18 — Opt-in y curación:** switches por organización/inmueble, revisión de fotos y publicación explícita.
- **E19 — Catálogo público:** filtros por rubro, área, presupuesto y ciudad; responsive y sin datos privados.
- **E20 — Leads:** captura con consentimiento, deduplicación, bandeja del administrador y trazabilidad de estados.
- **E21 — Match conversacional opcional:** primero reglas deterministas; IA solo como adaptador posterior, con confirmación y presupuesto autorizado.

La monetización inicial recomendada es incluirlo en un plan Pro/Enterprise. Cobrar por cierre requiere revisión legal venezolana antes de anunciarlo; no forma parte de la primera versión. Los análisis de mercado deben ser agregados y anonimizados.

## Orden incorporado al plan maestro

Cerrar E14–E17 antes de buscar clientes adicionales. Iniciar E18 cuando existan al menos tres organizaciones con datos maestros validados. E19 y E20 requieren pruebas de aislamiento, consentimiento y eliminación de leads; E21 queda desactivado si no hay proveedor IA y presupuesto autorizados.

## Dependencias y riesgos

- Supabase Auth, correo de invitaciones y límites de plan son necesarios para E14.
- Fotos requieren Storage con buckets privados y una proyección pública segura.
- La validación legal de corretaje precede cualquier comisión por cierre.
- No se reutiliza el bundle demo ni se publica información de los libros de Mario Sánchez sin el alcance de autorización correspondiente.
