const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const fixture = require('../gestion/js/fixtures-synthetic.js');

const store = new Map();
const context = {
  console,
  Date,
  Math,
  JSON,
  setTimeout,
  clearTimeout,
  localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) },
  location: { hostname: 'localhost' },
  document: { addEventListener() {}, dispatchEvent() {}, getElementById() { return null; } },
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  window: {}
};
context.window.localStorage = context.localStorage;
store.set('ccms_session', JSON.stringify({ is_demo: true, organization_id: 'd0000000-0000-0000-0000-000000000001' }));
context.globalThis = context;
context.CCMS_SYNTHETIC_FIXTURES = fixture;
vm.createContext(context);
vm.runInContext(fs.readFileSync('./gestion/js/supabase-client.js', 'utf8'), context, { filename: 'supabase-client.js' });
const db = context.window.dbService;
(async () => {
assert.equal(db.persistenceState, 'demo_fixture');
db.resetDemoData();

const initial = db.getData();
assert.equal(initial.organizations.length, 2);
assert.equal(initial.properties.length, 3);
assert.ok(initial.units.some(u => u.property_id && u.organization_id));
assert.equal(db.getScopedData(initial.organizations[0].id).organizations.length, 1);
assert.equal(db.getScopedData(initial.organizations[0].id).properties.every(p => p.organization_id === initial.organizations[0].id), true);
assert.equal(db.canDemoAction('m-syn-finance', 'write'), true);
db.suspendDemoMember('m-syn-finance');
assert.equal(db.canDemoAction('m-syn-finance', 'write'), false);
db.resetDemoData();

const org = db.createOrganization({ name: 'Organización de Prueba' });
const property = db.createProperty({ organization_id: org.id, name: 'Inmueble de Prueba', city: 'Caracas' });
const unit = db.createUnit({ property_id: property.id, code: 'TEST-01', area_m2: 50 });
const tenant = initial.tenants[0];
const contract = db.createContract({ tenant_id: tenant.id, unit_id: unit.id, rent_usd: 100, start_date: '2026-04-01', end_date: '2027-03-31' });
assert.throws(() => db.issueInvoiceOnce(contract.id, '2026-04'), /CONTRACT_NOT_APPROVED/);
db.approveContract(contract.id, 'director-demo');
const invoice = db.issueInvoiceOnce(contract.id, '2026-04', { total_usd: 100 }).invoice;
assert.equal(db.issueInvoiceOnce(contract.id, '2026-04').created, false);

const p1 = db.submitPayment(invoice.id, { payment_method: 'transferencia', reference_number: 'UNIT-60', amount_paid: 60, currency: 'USD', submitted_by: 'tenant-demo', receipt_proof: 'hash-a' });
assert.equal(db.getData().invoices.find(i => i.id === invoice.id).status, 'verificando');
assert.rejects(() => db.approvePayment(invoice.id, 'tenant-demo'), /SEGREGATION_OF_DUTIES/);
await db.approvePayment(invoice.id, 'finance-demo', { commandId: 'cmd-1', amount: 60 });
assert.equal(db.getData().invoices.find(i => i.id === invoice.id).status, 'parcial');
assert.equal(db.getFinancialSummary(invoice.id).collected_usd, 60);
const p2 = db.submitPayment(invoice.id, { payment_method: 'transferencia', reference_number: 'UNIT-50', amount_paid: 50, currency: 'USD', submitted_by: 'tenant-demo' });
await db.approvePayment(invoice.id, 'finance-demo', { commandId: 'cmd-2', amount: 50 });
assert.equal(db.getData().invoices.find(i => i.id === invoice.id).status, 'pagado');
const replay = await db.approvePayment(invoice.id, 'finance-demo', { commandId: 'cmd-2', amount: 50 });
assert.equal(replay.receipt.invoice_id, invoice.id);
await assert.rejects(() => db.approvePayment(invoice.id, 'finance-demo', { commandId: 'cmd-2', amount: 51 }), /COMMAND_ID_CONFLICT/);
await db.reversePayment(p2.id, 'Ajuste demo', 'director-demo');
// p2 is verificado and can be reversed; its invoice returns to parcial with 60 paid.
assert.equal(db.getData().invoices.find(i => i.id === invoice.id).status, 'parcial');
assert.equal(db.getData().receipts.find(r => r.payment_id === p2.id)?.status, 'reversado');
assert.equal(db.getData().payments.find(p => p.id === p1.id).receipt_proof, 'hash-a');
const bank = db.reconcileBankCsv(`reference,amount,date\nUNIT-60,60,2026-04-10\nUNIT-60,60,2026-04-10`);
assert.equal(bank.duplicates.length, 1); assert.equal(bank.candidates.length, 1); assert.equal(bank.approved, false);
assert.equal(db.reconcileBankCsv('reference,amount,date\nVE-DEC,"1.250,50",2026-04-10').transactions[0].amount, 1250.5);
const expense = db.createExpense({ concept: 'Gasto demo', amount_usd: 100, beneficiary: 'Proveedor Demo', period_key: '2026-04' });
assert.equal(db.getExpenseSummary('2026-04').pactado_usd, 100); db.approveExpense(expense.id); db.payExpense(expense.id); assert.equal(db.getExpenseSummary('2026-04').pagado_usd, 100);
const secondInvoice = db.issueInvoiceOnce(contract.id, '2026-05', { total_usd: 100 }).invoice;
db.closePeriod('2026-06'); assert.throws(() => db.issueInvoiceOnce(contract.id, '2026-06', { total_usd: 100 }), /PERIOD_CLOSED/);
const secondPayment = db.submitPayment(secondInvoice.id, { payment_method: 'transferencia', reference_number: 'CONCURRENT-1', amount_paid: 100, currency: 'USD', submitted_by: 'tenant-demo' });
const concurrent = await Promise.allSettled([db.approvePayment(secondInvoice.id, 'finance-demo'), db.approvePayment(secondInvoice.id, 'finance-demo')]);
assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1); assert.equal(concurrent.filter(r => r.status === 'rejected').length, 1);
assert.throws(() => db.removeDemoMember('m-syn-director'), /LAST_DIRECTOR_PROTECTED/);
const rejectedInvoice = db.issueInvoiceOnce(contract.id, '2026-07', { total_usd: 100 }).invoice;
const rejectedPayment = db.submitPayment(rejectedInvoice.id, { payment_method: 'transferencia', reference_number: 'REJECT-1', amount_paid: 100, currency: 'USD', submitted_by: 'tenant-demo' });
db.rejectPayment(rejectedInvoice.id, 'Referencia ilegible', 'finance-demo');
assert.equal(db.getData().payments.find(p => p.id === rejectedPayment.id).status, 'rechazado');
db.closePeriod('2026-07'); assert.throws(() => db.submitPayment(rejectedInvoice.id, { payment_method: 'transferencia', reference_number: 'REJECT-2', amount_paid: 100, currency: 'USD', submitted_by: 'tenant-demo' }), /PERIOD_CLOSED/);
const snapshotBeforeQuota = db.getData(); const persist = db._persistDemoSnapshot; db._persistDemoSnapshot = () => { throw new Error('QUOTA_EXCEEDED'); }; assert.throws(() => db.saveData(snapshotBeforeQuota), /QUOTA_EXCEEDED/); db._persistDemoSnapshot = persist;

const vacant = db.getData().units.find(u => u.status === 'disponible');
const csv = `rif,business_name,unit_code,rent_usd,start_date,end_date\nJ-TEST-1,Importado Demo,${vacant.code},abc,2026-05-01,2027-04-30`;
const preview = db.importTenantsCsv(csv);
assert.equal(preview.committed, false);
assert.ok(preview.errors.some(e => e.code === 'INVALID_FIELDS'));
const validCsv = `rif,business_name,unit_code,rent_usd,start_date,end_date\nJ-TEST-2,Importado Demo,${vacant.code},1250,2026-05-01,2027-04-30`;
assert.equal(db.importTenantsCsv(validCsv, { commit: true }).committed, true);
assert.ok(db.importTenantsCsv(validCsv).errors.some(e => e.code === 'DUPLICATE_RIF'));
const mixedCsv = `rif,business_name,unit_code,rent_usd,start_date,end_date\nJ-TEST-3,Importado Decimal,${db.getData().units.find(u => u.status === 'disponible')?.code || 'TEST-02'},"1.250,50",2026-06-01,2027-05-31`;
assert.equal(db.importTenantsCsv(mixedCsv).rows[0].rent_usd, 1250.5);

const listing = db.publishListing(vacant.id, { title: 'Local disponible demo' });
const lead = db.captureLead(listing.id, { name: 'Prospecto Demo', email: 'prospecto@example.test', consent: true, organization_id: 'malicioso' });
assert.equal(lead.organization_id, listing.organization_id);
db.retireListing(listing.id);
assert.throws(() => db.captureLead(listing.id, { name: 'X', consent: true }), /LISTING_NOT_PUBLIC/);

const ticket = db.createTicket({ tenant_id: tenant.id, title: 'Luminaria demo' });
db.updateTicket(ticket.id, { status: 'resuelto' });
assert.equal(db.getData().service_tickets.find(t => t.id === ticket.id).status, 'resuelto');
const tenantOtherOrg = db.getData().tenants.find(t => t.organization_id === initial.organizations[1].id);
if (tenantOtherOrg) { const otherTicket = db.createTicket({ tenant_id: tenantOtherOrg.id, title: 'Ticket otra organización' }); assert.equal(db.getScopedData(initial.organizations[0].id).service_tickets.some(t => t.id === otherTicket.id), false); }
assert.throws(() => db.adjustStock('MISSING', 1, 'SALIDA'), /STOCK_ITEM_NOT_FOUND/);
const item = db.getData().consumibles?.[0];
if (item) assert.throws(() => db.adjustStock(item.code, Number(item.stock_current || 0) + 1, 'SALIDA'), /STOCK_NEGATIVE_FORBIDDEN/);
const reservation = db.createReservation({ property_id: property.id, start_at: '2026-04-10T10:00:00Z', end_at: '2026-04-10T11:00:00Z' });
assert.throws(() => db.createReservation({ property_id: property.id, start_at: '2026-04-10T10:30:00Z', end_at: '2026-04-10T11:30:00Z' }), /RESERVATION_CONFLICT/);

assert.equal(db.calibrateFloorPlan({ width: 10, height: 5, scale_m_per_unit: 1 }).area_m2, 50);
assert.equal(db.calibrateFloorPlan({ width: 10, height: 5 }).area_m2, null);
assert.match(db.exportFloorPlanSvg({ width: 10, height: 5, scale_m_per_unit: 1 }), /<svg/);
const simulatedIntegrations = ['email', 'bank', 'ia', 'invitation', 'subscription'].map(kind => db.simulateIntegration(kind, { demo: true }));
assert.equal(simulatedIntegrations.length, 5);
assert.ok(simulatedIntegrations.every(event => event.status === 'simulado'));
const backup = db.exportDemoBackup();
db.resetDemoData();
assert.throws(() => db.restoreDemoBackup({ schema: 'bad', version: 99 }), /BACKUP_INVALID/);
const corruptBackup = JSON.parse(JSON.stringify(backup)); corruptBackup.attachment_manifest.push({ ref: 'corrupt', hash: 'wrong' }); const unitsBeforeCorrupt = db.getData().units.length; assert.throws(() => db.restoreDemoBackup(corruptBackup), /BACKUP_ATTACHMENT_HASH_MISMATCH/); assert.equal(db.getData().units.length, unitsBeforeCorrupt);
assert.equal(db.restoreDemoBackup(backup).restored, true);
assert.match(db.exportDemoCsv('invoices'), /invoice_number/);
assert.equal(db.getData().reservations.some(r => r.id === reservation.id), true);
assert.equal(db.getData().payments.some(p => p.receipt_proof === 'hash-a'), true);

console.log('[DEMO-UNIT] PASS: organizaciones, contratos, importación, facturación idempotente, maker-checker, parciales/reverso, conciliación bancaria, gastos, permisos, tickets, stock, reservas, marketplace, planos, simulaciones, backup/restore y export CSV.');
})().catch(error => { console.error('[DEMO-UNIT] FAIL', error); process.exitCode = 1; });
