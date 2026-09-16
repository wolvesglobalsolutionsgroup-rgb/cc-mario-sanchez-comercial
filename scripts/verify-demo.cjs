const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  let reqPath = (req.url || '/').split('?')[0];
  if (reqPath === '/') reqPath = '/gestion/login.html';
  const filePath = path.join(rootDir, reqPath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return res.writeHead(404).end('Not found');
  const ext = path.extname(filePath);
  const mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
  res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(filePath));
});

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const blockedRemote = [];
    page.on('request', request => {
      const url = request.url();
      if (/supabase\.co|\/api\//i.test(url)) blockedRemote.push(url);
    });
    await page.goto(`${baseUrl}/gestion/login.html?demo=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('#panel-auth-demo').waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path: path.join(rootDir, 'docs', 'demo-release', 'evidence-login-demo.png'), fullPage: true });
    await page.locator('#btn-demo-superadmin').click();
    await page.waitForURL(/index\.html/, { timeout: 8000 });
    await page.waitForFunction(() => window.dbService?.persistenceState === 'demo_fixture', null, { timeout: 10000 });
    await page.waitForSelector('#kpi-billed', { state: 'visible', timeout: 10000 });
    await page.screenshot({ path: path.join(rootDir, 'docs', 'demo-release', 'evidence-dashboard-demo.png'), fullPage: true });
    const initial = await page.evaluate(() => ({
      state: window.dbService?.persistenceState,
      units: window.dbService?.getData()?.units?.length || 0,
      realFixtureLoaded: Boolean(window.CCMS_AUTHORIZED_DEMO_FIXTURES),
      session: JSON.parse(localStorage.getItem('ccms_session') || '{}').is_demo === true
    }));
    if (initial.state !== 'demo_fixture' || initial.units < 1 || !initial.session) throw new Error(`Demo bootstrap inválido: ${JSON.stringify(initial)}`);
    if (initial.realFixtureLoaded) throw new Error('El fixture autorizado quedó expuesto en el runtime demo.');

    await page.locator('.nav-item[data-tab="condominio"]:visible').click();
    await page.locator('#btn-open-expense-modal').click();
    const modalFocus = await page.evaluate(() => ({
      visible: document.getElementById('modal-expense')?.style.display === 'flex',
      focusedInside: Boolean(document.getElementById('modal-expense')?.contains(document.activeElement)),
      focusedClass: document.activeElement?.className || ''
    }));
    if (!modalFocus.visible || !modalFocus.focusedInside || !String(modalFocus.focusedClass).includes('modal-close')) {
      throw new Error(`Foco inicial del modal inválido: ${JSON.stringify(modalFocus)}`);
    }
    await page.keyboard.press('Escape');
    const modalClosed = await page.evaluate(() => ({
      visible: document.getElementById('modal-expense')?.style.display === 'flex',
      returnedToTrigger: document.activeElement?.id === 'btn-open-expense-modal'
    }));
    if (modalClosed.visible || !modalClosed.returnedToTrigger) throw new Error(`Cierre Escape/restauración de foco inválidos: ${JSON.stringify(modalClosed)}`);
    const modalAudit = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay')).map(modal => {
      window.openModal(modal);
      const focusedInside = modal.contains(document.activeElement);
      const closeControl = Boolean(modal.querySelector('.modal-close, .btn-close-modal, [onclick*="close"]'));
      window.closeModal(modal);
      return { id: modal.id, focusedInside, closeControl };
    }));
    const modalFocusFailures = modalAudit.filter(result => !result.focusedInside || !result.closeControl);
    if (modalFocusFailures.length) throw new Error(`Modales sin foco/cierre accesible: ${JSON.stringify(modalFocusFailures)}`);

    const flow = await page.evaluate(async () => {
      const data = window.dbService.getData();
      const invoice = data.invoices.find(i => !['pagado', 'verificando'].includes(i.status));
      if (!invoice) throw new Error('El fixture sintético no tiene una factura cobrable para el smoke test.');
      const payment = window.dbService.submitPayment(invoice.id, {
        payment_method: 'transferencia_bancaria', reference_number: `DEMO-${Date.now()}`,
        amount_paid: invoice.total_usd, currency: 'USD', submitted_by: 'inquilino-demo', receipt_proof: 'synthetic-proof-hash'
      });
      return { invoiceId: invoice.id, paymentId: payment.id };
    });
    await page.waitForTimeout(150);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.dbService?.demoStorageReady === true, null, { timeout: 5000 });
    const persisted = await page.evaluate(({ invoiceId, paymentId }) => {
      const data = window.dbService.getData();
      return { paymentPresent: data.payments.some(p => p.id === paymentId), paymentProof: data.payments.find(p => p.id === paymentId)?.receipt_proof || null, status: data.invoices.find(i => i.id === invoiceId)?.status };
    }, flow);
    if (!persisted.paymentPresent || persisted.paymentProof !== 'synthetic-proof-hash' || persisted.status !== 'verificando') throw new Error(`Persistencia IndexedDB inválida: ${JSON.stringify(persisted)}`);

    const approved = await page.evaluate(async ({ invoiceId, paymentId }) => {
      const result = await window.dbService.approvePayment(invoiceId, 'administracion-demo');
      const data = window.dbService.getData();
      return {
        payment: data.payments.find(p => p.id === paymentId)?.status,
        invoice: data.invoices.find(i => i.id === invoiceId)?.status,
        receipt: data.receipts.some(r => r.invoice_id === invoiceId),
        receiptNumber: result.receipt?.receipt_number || null
      };
    }, flow);
    if (approved.payment !== 'verificado' || approved.invoice !== 'pagado' || !approved.receipt) throw new Error(`Aprobación demo inválida: ${JSON.stringify(approved)}`);

    for (const width of [375, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.dbService?.persistenceState === 'demo_fixture', null, { timeout: 5000 });
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, mainButton: Boolean(document.querySelector('button, a')) }));
      if (layout.scrollWidth > layout.width + 2 || !layout.mainButton) throw new Error(`Responsive layout inválido a ${width}px: ${JSON.stringify(layout)}`);
    }

    const storageFallback = await page.evaluate(() => {
      const originalIndexedDb = window.indexedDB;
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
      const draft = window.dbService.getData();
      draft.settings = { ...(draft.settings || {}), demo_storage_probe: 'draft-kept-in-memory' };
      const saved = window.dbService.saveData(draft);
      const backup = window.dbService.exportDemoBackup();
      const bannerVisible = document.getElementById('persistence-status-banner')?.hidden === false;
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: originalIndexedDb });
      return { saved, storageError: window.dbService.demoStorageError, backupUnits: backup.dataset.units.length, bannerVisible, draft: window.dbService.getData().settings.demo_storage_probe };
    });
    if (!storageFallback.saved || !storageFallback.storageError || !storageFallback.backupUnits || !storageFallback.bannerVisible || storageFallback.draft !== 'draft-kept-in-memory') {
      throw new Error(`Fallback de almacenamiento/cuota inválido: ${JSON.stringify(storageFallback)}`);
    }

    const reset = await page.evaluate(() => {
      window.dbService.resetDemoData();
      const data = window.dbService.getData();
      return { state: window.dbService.persistenceState, pending: data.payments.filter(p => p.status === 'pendiente').length };
    });
    if (reset.state !== 'demo_fixture') throw new Error('resetDemoData salió del modo demo.');
    if (blockedRemote.length) throw new Error(`La demo intentó usar servicios remotos: ${blockedRemote.slice(0, 3).join(', ')}`);
    const labContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const lab = await labContext.newPage();
    await lab.goto(`${baseUrl}/gestion/demo-lab.html`, { waitUntil: 'domcontentloaded' });
    await lab.waitForFunction(() => window.dbService?.persistenceState === 'demo_fixture', null, { timeout: 5000 });
    await lab.locator('#payment-flow').focus();
    await lab.keyboard.press('Enter');
    await lab.waitForFunction(() => /recibo emitido|segundo actor/i.test(document.getElementById('status')?.textContent || ''), null, { timeout: 5000 });
    await lab.locator('#plan-flow').click();
    await lab.locator('#market-flow').click();
    const publishedListing = await lab.evaluate(() => {
      const listing = window.dbService.getData().listings.at(-1);
      return listing ? { id: listing.id, unitId: listing.unit_id, title: listing.title, origin: location.origin, marker: localStorage.getItem('ccms-demo-public-listings') } : null;
    });
    if (!publishedListing) throw new Error('El flujo demo no creó listing publicable.');
    const publicCatalog = await labContext.newPage({ viewport: { width: 390, height: 844 } });
    await publicCatalog.goto(`${baseUrl}/alquiler.html?demo=1`, { waitUntil: 'domcontentloaded' });
    await publicCatalog.waitForTimeout(250);
    const publishedText = await publicCatalog.locator('body').textContent();
    const publishedProjection = await publicCatalog.evaluate(() => ({ origin: location.origin, marker: localStorage.getItem('ccms-demo-public-listings'), hasFixture: Boolean(window.CCMS_SYNTHETIC_FIXTURES), sample: document.querySelector('#spaces-list-box')?.textContent?.slice(0, 180) || '' }));
    if (!publishedText.includes(publishedListing.title)) throw new Error(`El catálogo público demo no refleja el listing publicado: ${JSON.stringify({ publishedListing, publishedProjection })}`);
    await lab.evaluate((listingId) => window.dbService.retireListing(listingId), publishedListing.id);
    await publicCatalog.reload({ waitUntil: 'domcontentloaded' });
    await publicCatalog.waitForTimeout(250);
    const retiredText = await publicCatalog.locator('body').textContent();
    if (retiredText.includes(publishedListing.title)) throw new Error('El catálogo público demo conserva un listing retirado.');
    await publicCatalog.close();
    await lab.locator('#reset').click();
    await lab.locator('#import-flow').click();
    await lab.locator('#backup').click();
    const reportHtml = await lab.evaluate(() => window.dbService.exportDemoReportHtml('invoices'));
    const reportPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await reportPage.setContent(reportHtml, { waitUntil: 'domcontentloaded' });
    await reportPage.pdf({ path: path.join(rootDir, 'docs', 'demo-release', 'evidence-report-demo.pdf'), format: 'A4', printBackground: true });
    await reportPage.close();
    await lab.close();
    await labContext.close();
    for (const publicRoute of ['/index.html?demo=1', '/alquiler.html?demo=1', '/levantamiento/index.html?demo=1']) {
      const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const external = []; const errors = [];
      publicPage.on('request', request => { if (!request.url().startsWith(baseUrl)) external.push(request.url()); });
      publicPage.on('pageerror', error => errors.push(error.message));
      await publicPage.goto(`${baseUrl}${publicRoute}`, { waitUntil: 'domcontentloaded' }); await publicPage.waitForTimeout(400);
      const width = await publicPage.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
      if (external.length || errors.length || width.scroll > width.inner + 2) throw new Error(`Superficie pública demo inválida ${publicRoute}: ${JSON.stringify({ external, errors, width })}`);
      await publicPage.close();
    }
    const marioContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const marioPage = await marioContext.newPage();
    const marioRemote = [];
    marioPage.on('request', request => { if (/supabase\.co|\/api\//i.test(request.url())) marioRemote.push(request.url()); });
    await marioPage.goto(`${baseUrl}/gestion/login.html?demo=1&dataset=mario`, { waitUntil: 'domcontentloaded' });
    await marioPage.locator('#panel-auth-demo').waitFor({ state: 'visible', timeout: 5000 });
    await marioPage.locator('#btn-demo-superadmin').click();
    await marioPage.waitForURL(/index\.html/, { timeout: 8000 });
    await marioPage.waitForFunction(() => window.dbService?.persistenceState === 'demo_fixture', null, { timeout: 10000 });
    const marioScenario = await marioPage.evaluate(() => ({
      dataset: window.dbService?.demoDataset,
      units: window.dbService?.getData()?.units?.length || 0,
      organizations: window.dbService?.getData()?.organizations?.length || 0,
      fixtureLoaded: Boolean(window.CCMS_AUTHORIZED_DEMO_FIXTURES),
      label: window.dbService?.getData()?.demoDataLabel || ''
    }));
    if (marioScenario.dataset !== 'mario-authorized' || marioScenario.units !== 38 || marioScenario.organizations !== 1 || !marioScenario.fixtureLoaded || !/autorizados/i.test(marioScenario.label)) {
      throw new Error(`Demo autorizada de Mario Sánchez inválida: ${JSON.stringify(marioScenario)}`);
    }
    if (marioRemote.length) throw new Error(`La demo autorizada intentó usar servicios remotos: ${marioRemote.slice(0, 3).join(', ')}`);
    await marioPage.close();
    await marioContext.close();
    console.log(`[DEMO] PASS: demo sintética (${initial.units} unidades) y demo autorizada Mario Sánchez (${marioScenario.units} locales), IndexedDB, submit→approve→recibo y 0 llamadas remotas.`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
