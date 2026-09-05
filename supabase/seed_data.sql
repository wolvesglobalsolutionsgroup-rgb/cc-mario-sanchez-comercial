-- ==============================================================================
-- DATOS INICIALES (SEED DATA) EXTENDIDO - CENTRO COMERCIAL MARIO SÁNCHEZ
-- ==============================================================================

-- 1. PLAN DE CUENTAS (CHART OF ACCOUNTS)
INSERT INTO chart_of_accounts (code, name, account_type, description)
VALUES
('1.1.01', 'Cuentas por Cobrar — Cánones de Arrendamiento', 'activo', 'Cobranzas pendientes de unidades comerciales'),
('1.1.02', 'Cuentas por Cobrar — Gastos Comunes / Condominio', 'activo', 'Alícuotas de mantenimiento y servicios ordinarios'),
('1.1.03', 'Banco Banesco (Cuenta Corriente Bs)', 'activo', 'Cuenta receptora nacional'),
('1.1.04', 'Banco Mercantil (Cuenta Corriente Bs / Pago Móvil)', 'activo', 'Cuenta recaudadora Pago Móvil'),
('1.1.05', 'Banesco Panamá / Custodia USD', 'activo', 'Recepción de transferencias internacionales y custodia'),
('1.1.06', 'Billetera Digital USDT (TRC20)', 'activo', 'Custodia de pagos cripto en stablecoin'),
('2.1.01', 'Depósitos en Garantía de Arrendatarios', 'pasivo', 'Garantías en custodia (máximo 3 meses legal Art. 19)'),
('4.1.01', 'Ingresos por Cánones de Arrendamiento Fijo (CAF)', 'ingreso', 'Ingreso mensual por alquiler comercial'),
('5.1.01', 'Gastos Operativos — Vigilancia y Seguridad 24/7', 'egreso', 'Custodia física y monitoreo CCTV'),
('5.1.02', 'Gastos Operativos — Energía Eléctrica Áreas Comunes', 'egreso', 'Iluminación exterior, bombas y pasillos'),
('5.1.03', 'Gastos Operativos — Suministro de Agua / Cisterna', 'egreso', 'Abastecimiento de tanques y red sanitaria'),
('5.1.04', 'Gastos Operativos — Aseo Urbano y Manejo de Desechos', 'egreso', 'Recolección y compactación de basura')
ON CONFLICT (code) DO NOTHING;

-- 2. LAS UNIDADES REALES DEL CCMS (INCLUYE SUBDIVISIÓN DE HUELLA EN 3 MACRO-LOTES)
INSERT INTO units (code, name, category, area_m2, base_rent_usd, condo_aliquot, status, frontage_m, power_kva, has_loading_dock)
VALUES
('LOT-C01', 'Macro-Lote C01 (Norte)', 'macro-lotes', 1730.00, 3800.00, 0.2315, 'disponible', 27.95, 'Transformador 150 kVA', true),
('LOT-C02', 'Macro-Lote C02 (Medio)', 'macro-lotes', 1730.00, 3800.00, 0.2315, 'disponible', 27.95, 'Transformador 150 kVA', true),
('LOT-C03', 'Macro-Lote C03 (Sur)', 'macro-lotes', 1730.00, 3800.00, 0.2315, 'disponible', 27.96, 'Transformador 150 kVA', true),
('LOC-01', 'Local 01 — Fachada Principal', 'locales', 250.00, 1100.00, 0.0335, 'arrendado', 12.00, 'Trifásica 25 kVA', false),
('LOC-02', 'Local 02 — Fachada Comercial', 'locales', 250.00, 1050.00, 0.0335, 'arrendado', 12.00, 'Trifásica 25 kVA', false),
('LOC-03', 'Local 03 — Planta Baja', 'locales', 180.00, 850.00, 0.0241, 'disponible', 9.00, 'Monofásica/Trifásica', false),
('LOC-04', 'Local 04 — Planta Baja', 'locales', 180.00, 850.00, 0.0241, 'arrendado', 9.00, 'Monofásica/Trifásica', false),
('LOC-05', 'Local 05 — Zona Media', 'locales', 160.00, 750.00, 0.0214, 'disponible', 8.00, 'Monofásica 15 kVA', false),
('LOC-06', 'Local 06 — Zona Media', 'locales', 160.00, 750.00, 0.0214, 'arrendado', 8.00, 'Monofásica 15 kVA', false),
('GAL-01', 'Galpón 01 Logístico y Almacén', 'galpones', 750.00, 1900.00, 0.1004, 'arrendado', 25.00, 'Industrial 75 kVA', true),
('GAL-02', 'Galpón 02 Distribución & Taller', 'galpones', 560.00, 1500.00, 0.0750, 'disponible', 20.00, 'Industrial 50 kVA', true)
ON CONFLICT (code) DO NOTHING;

-- 3. INQUILINOS ACTIVOS DE PUERTO LA CRUZ
INSERT INTO tenants (rif, business_name, trade_name, commercial_registry, legal_rep_name, legal_rep_dni, email, phone, whatsapp, fiscal_address, commercial_activity, status)
VALUES
('J-30987123-4', 'Distribuidora Oriente Marino, C.A.', 'Oriente Marine Supply', 'RM Segundo Puerto La Cruz, Tomo 45-A, Nro 12', 'Carlos Eduardo Mendoza', 'V-14.289.412', 'carlos.mendoza@orientemarine.com', '+58 281-2674400', '+58 414-8123456', 'Av. Municipal c/c Calle Montes, Puerto La Cruz', 'Repuestos e insumos navieros e industriales', 'activo'),
('J-40112890-1', 'Logística y Cargas del Caribe, S.A.', 'Caribe Logistics Hub', 'RM Primero Barcelona, Tomo 112, Nro 89', 'Mariana Valentina Silva', 'V-16.904.551', 'msilva@caribelogistics.com', '+58 281-2869010', '+58 424-8199234', 'Zona Industrial Los Montones, Barcelona', 'Distribución logística, bodegaje y paquetería', 'activo'),
('J-31445892-0', 'Ferretería Industrial La Cruz, C.A.', 'FerroCruz Pro', 'RM Segundo Puerto La Cruz, Tomo 88, Nro 204', 'Ing. Roberto Hernández', 'V-12.780.334', 'gerencia@ferrocruz.com.ve', '+58 281-2681122', '+58 412-3556789', 'Av. Intercomunal c/ Av. Municipal, PLC', 'Materiales de construcción y ferretería pesada', 'activo'),
('J-50239011-8', 'AutoPartes & Servicios Express, C.A.', 'AutoExpress PLC', 'RM Primero PLC, Tomo 34, Nro 15', 'Alejandro José Gómez', 'V-18.441.902', 'admin@autopartesexpress.net', '+58 281-2659988', '+58 416-6801234', 'Av. Municipal, CC Mario Sánchez, Local 01', 'Venta de autopartes, lubricantes y baterías', 'activo'),
('J-41220993-2', 'Bodegón & Delicateses El Faro, C.A.', 'El Faro Market', 'RM Segundo PLC, Tomo 90, Nro 44', 'Lucía Carolina Morales', 'V-15.332.109', 'contacto@elfaromarket.com', '+58 281-2693311', '+58 424-8224567', 'Av. Municipal, Local 02, CC Mario Sánchez', 'Viveres, importados, panadería gourmet y café', 'moroso')
ON CONFLICT (rif) DO NOTHING;

-- 4. GASTOS COMUNES DEL MES (EGRESOS OPERATIVOS)
INSERT INTO condo_expenses (period_month, period_year, concept, category, amount_usd, bcv_rate, amount_bs)
VALUES
(3, 2026, 'Servicio de Seguridad y Vigilancia Armada 24/7', 'seguridad', 1200.00, 72.50, 87000.00),
(3, 2026, 'Energía Eléctrica Áreas Comunes & Postes (Corpoelec)', 'servicios_publicos', 350.00, 72.50, 25375.00),
(3, 2026, 'Servicio Privado de Cisterna de Agua (40.000 L)', 'servicios_publicos', 220.00, 72.50, 15950.00),
(3, 2026, 'Mantenimiento Preventivo Bomba de Achique y Drenajes', 'mantenimiento', 180.00, 72.50, 13050.00);
