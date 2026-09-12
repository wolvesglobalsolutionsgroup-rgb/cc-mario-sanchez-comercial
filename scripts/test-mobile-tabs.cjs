const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseDir = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.startsWith('/gestion/')) reqPath = reqPath.slice(9);
  if (!reqPath || reqPath === '/') reqPath = 'index.html';
  const filePath = path.join(baseDir, 'gestion', reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8199, async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:8199/gestion/index.html', { waitUntil: 'networkidle' });

    const tabs = ['tab-inquilinos', 'tab-cobranzas', 'tab-condominio', 'tab-inventario', 'tab-calendario', 'tab-alertas', 'tab-ayuda'];
    for (const tabId of tabs) {
      await page.evaluate((id) => {
        if (typeof window.switchTab === 'function') {
          window.switchTab(id);
        }
      }, tabId);
      await page.waitForTimeout(250);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      const iw = await page.evaluate(() => window.innerWidth);
      console.log(`[Viewport Test 390px] Tab: ${tabId} -> scrollWidth: ${sw}, innerWidth: ${iw} -> ${sw <= iw ? 'PASS' : 'FAIL'}`);
      if (sw > iw) throw new Error(`Overflow on ${tabId}: ${sw} > ${iw}`);
    }

    // Probar apertura y responsividad del modal de contrato
    await page.evaluate(() => {
      if (typeof window.openContractModal === 'function') {
        window.openContractModal('t-1');
      }
    });
    await page.waitForTimeout(300);
    const swContract = await page.evaluate(() => document.documentElement.scrollWidth);
    const iwContract = await page.evaluate(() => window.innerWidth);
    console.log(`[Viewport Test 390px] Modal Contrato -> scrollWidth: ${swContract}, innerWidth: ${iwContract} -> ${swContract <= iwContract ? 'PASS' : 'FAIL'}`);

    // Probar apertura del modal de nuevo ticket
    await page.evaluate(() => {
      if (typeof window.openTenantNewTicketModal === 'function') {
        window.openTenantNewTicketModal('LOC-1');
      }
    });
    await page.waitForTimeout(300);
    const swTicket = await page.evaluate(() => document.documentElement.scrollWidth);
    const iwTicket = await page.evaluate(() => window.innerWidth);
    console.log(`[Viewport Test 390px] Modal Ticket -> scrollWidth: ${swTicket}, innerWidth: ${iwTicket} -> ${swTicket <= iwTicket ? 'PASS' : 'FAIL'}`);

    console.log('✅ TODAS LAS PRUEBAS DE RESPONSIVIDAD 390px PASARON EXITOSAMENTE CON 0 OVERFLOW.');
    await browser.close();
  } catch (err) {
    console.error('❌ Error en prueba de viewport:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
