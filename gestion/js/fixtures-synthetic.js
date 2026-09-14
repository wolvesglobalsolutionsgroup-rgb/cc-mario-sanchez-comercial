/**
 * ==============================================================================
 * CCMS - FIXTURES SINTÉTICOS Y DESIDENTIFICADOS (FICHA F1 / T06)
 * Centro Comercial Mario Sánchez — Entorno Seguro Demo & Staging
 * 
 * Cumplimiento estricto de privacidad:
 * - Cero PII real (Nombres ficticios de fantasía, RIFs sintéticos J-99000000-X)
 * - Mantiene dimensiones estructurales y métricas operativas intactas
 * ==============================================================================
 */

(function(global) {
  'use strict';

  const SYNTHETIC_FIXTURES = {
    version: '2026.09.14-synthetic',
    organization: {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Centro Comercial Demo Experimental',
      slug: 'demo-ccms',
      business_type: 'centro_comercial',
      plan: 'enterprise'
    },
    demo_users: [
      { id: 'usr-demo-dir', role: 'org_director', display_name: 'Directora Demo General', email: 'director@demo.ccms.local' },
      { id: 'usr-demo-acc', role: 'accountant', display_name: 'Contador Demo Principal', email: 'contador@demo.ccms.local' },
      { id: 'usr-demo-tnt', role: 'tenant_user', display_name: 'Inquilino Sintético Local 01', email: 'arrendatario1@demo.ccms.local' }
    ],
    sample_units: [
      { id: 'u-syn-1', code: 'LOC-01', name: 'Local Sintético 01 - Retail', area_m2: 120, base_rent_usd: 600, status: 'arrendado' },
      { id: 'u-syn-2', code: 'LOC-02', name: 'Local Sintético 02 - Servicios', area_m2: 85, base_rent_usd: 450, status: 'arrendado' },
      { id: 'u-syn-3', code: 'LOC-03', name: 'Local Sintético 03 - Farmacia', area_m2: 150, base_rent_usd: 800, status: 'disponible' }
    ],
    sample_tenants: [
      { id: 't-syn-1', rif: 'J-99000001-1', business_name: 'Comercializadora Aurora Sintética C.A.', unit_code: 'LOC-01', status: 'activo' },
      { id: 't-syn-2', rif: 'J-99000002-2', business_name: 'Servicios Génesis Digital C.A.', unit_code: 'LOC-02', status: 'activo' }
    ]
  };

  global.CCMS_SYNTHETIC_FIXTURES = SYNTHETIC_FIXTURES;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SYNTHETIC_FIXTURES;
  }
})(typeof window !== 'undefined' ? window : globalThis);
