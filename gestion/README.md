# Suite de Gestión Inmobiliaria & Cobranzas — CC Mario Sánchez

Plataforma SaaS para la administración integral de locales comerciales, macro-lotes y galpones, control de cuotas mensuales, conciliación de pagos multimoneda y cumplimiento legal de arrendamiento comercial en Venezuela.

---

## Características Principales

1. **Dashboard Ejecutivo de Cobranzas**:
   - Métricas de ocupación en m² sobre el total del master plan (5.190 m²).
   - Recaudación mensual proyectada vs. cobrada en tiempo real.
   - Indicador de cartera en mora y contratos próximos a vencer.
   - Ticker bimonetario USD / Bs. a la tasa oficial del Banco Central de Venezuela (BCV).
2. **Onboarding de Inquilinos en 4 Pasos**:
   - Asignación de unidades comerciales.
   - Registro de datos jurídicos (RIF, Registro Mercantil, Cédula del Representante Legal).
   - Estipulación de canon según métodos CAF / CAP (Art. 32 G.O. 40.418).
   - Depósito en garantía restringido a máximo 3 meses según Art. 19.
3. **Control de Pagos y Emisión de Recibos**:
   - Registro de transferencias bancarias nacionales (Banesco, Mercantil, BDV), Pago Móvil, Zelle, efectivo en custodia y USDT.
   - Emisión e impresión de recibos oficiales con formato legal.
4. **Centro de Alertas & Notificaciones**:
   - Generación de avisos de cobro y recordatorios formateados para WhatsApp con un solo clic.
   - Enlace directo con Gmail para comunicaciones formales por correo.
5. **Calendario y Sincronización Google Workspace**:
   - Vencimientos de pagos (días 1 al 5).
   - Corte de condominio (día 10).
   - Botón directo para añadir eventos a Google Calendar (`calendar.google.com`).
6. **Backend Supabase**:
   - Scripts `supabase/schema.sql` y `supabase/seed_data.sql` listos para PostgreSQL.
   - Persistencia reactiva local (LocalStorage) lista para operar sin configuración previa.
