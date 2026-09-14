/**
 * MAESTRO DE DATOS: ARCHIVO SANITIZADO / RETIRADO POR PRIVACIDAD
 * Cumplimiento estricto de confidencialidad y directrices de seguridad (R04).
 * Los datos sensibles reales han sido removidos del bundle público.
 * En modo demostración y pruebas, se cargan los fixtures sintéticos de fixtures-synthetic.js.
 */
(function(global) {
  'use strict';
  if (global.CCMS_SYNTHETIC_FIXTURES && global.CCMS_SYNTHETIC_FIXTURES.full_dataset) {
    global.CCMS_SEED_DATA = global.CCMS_SYNTHETIC_FIXTURES.full_dataset;
  } else {
    global.CCMS_SEED_DATA = {
      version: 2,
      sanitized: true,
      units: [],
      tenants: [],
      contracts: [],
      invoices: [],
      payments: [],
      condo_expenses: []
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
