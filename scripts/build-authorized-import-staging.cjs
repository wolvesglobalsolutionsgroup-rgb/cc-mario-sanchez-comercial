#!/usr/bin/env node
/**
 * Builds an idempotent SQL payload for the authorized Excel import staging
 * table. It deliberately stages records for review; it never writes units,
 * tenants or contracts directly into operational tables.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');

const [organizationId, propertyId] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/i.test(organizationId || '') || !/^[0-9a-f-]{36}$/i.test(propertyId || '')) {
  console.error('Uso: node scripts/build-authorized-import-staging.cjs <organization_uuid> <property_uuid>');
  process.exit(2);
}
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require.resolve('../gestion/js/fixtures-authorized-demo.js'), 'utf8'), sandbox);
const dataset = sandbox.CCMS_AUTHORIZED_DEMO_FIXTURES.full_dataset;
const sourceName = 'EVALUACION DE GASTOS.xlsx';
const sourceSheet = 'RELAC DE ARRE. 14 JUM 2026';
const quote = value => `'${String(value).replace(/'/g, "''")}'`;
const rows = dataset.units.map((unit, index) => ({
  source_name: sourceName,
  source_sheet: sourceSheet,
  source_row: index + 1,
  source_record_key: unit.code,
  record_type: 'lease_bundle',
  payload: { unit, tenant: dataset.tenants[index], contract: dataset.contracts[index] }
}));
for (const exception of dataset.data_quality_exceptions || []) rows.push({
  source_name: sourceName,
  source_sheet: exception.source_sheet || sourceSheet,
  source_row: exception.source_row,
  source_record_key: `exception-${exception.source_row}`,
  record_type: 'data_quality_exception',
  payload: exception
});
const values = rows.map(row => {
  const canonical = JSON.stringify(row.payload);
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  return `(${quote(organizationId)}, ${quote(propertyId)}, ${quote(row.source_name)}, ${quote(row.source_sheet)}, ${row.source_row}, ${quote(row.source_record_key)}, ${quote(hash)}, ${quote(row.record_type)}, ${quote(canonical)}::jsonb)`;
}).join(',\n');
process.stdout.write(`INSERT INTO public.authorized_import_staging\n  (organization_id, property_id, source_name, source_sheet, source_row, source_record_key, source_hash, record_type, payload)\nVALUES\n${values}\nON CONFLICT (organization_id, source_name, source_sheet, source_record_key) DO UPDATE SET\n  property_id = EXCLUDED.property_id, source_hash = EXCLUDED.source_hash, payload = EXCLUDED.payload,\n  updated_at = timezone('utc'::text, now())\nWHERE authorized_import_staging.status = 'pending_validation';\n`);
