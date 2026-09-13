const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '/gestion' || reqPath === '/gestion/') reqPath = '/gestion/index.html';
  const filePath = path.join(rootDir, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8103, async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    
    await page.addInitScript(() => {
      localStorage.setItem('ccms_session', JSON.stringify({
        user_id: 'u-superadmin-1',
        role: 'superadmin',
        display_name: 'Super Admin',
        identifier: 'superadmin@ccmariosanchez.com',
        expires_at: Date.now() + 36000000
      }));
      localStorage.setItem('CCMS_FORCE_DEMO', 'true');
    });

    await page.goto('http://localhost:8103/gestion/index.html?demo=true');
    await page.waitForTimeout(600);
    await page.evaluate(() => window.switchTab('ayuda'));
    await page.waitForTimeout(400);

    // Click on Marco Legal
    await page.click('button[data-help-tab="legal"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(rootDir, 'test_ayuda_legal.png') });

    const text = await page.evaluate(() => document.getElementById('help-content-area').innerText);
    console.log('Legal text snippet:', text.substring(0, 300));

    // Test Fruto Patrimonial KPI click navigation
    await page.evaluate(() => window.switchTab('dashboard'));
    await page.waitForTimeout(400);
    const kpiExists = await page.evaluate(() => !!document.getElementById('card-kpi-fruto-patrimonial'));
    console.log('KPI Fruto Patrimonial exists in DOM:', kpiExists);

    // Click KPI
    await page.click('#card-kpi-fruto-patrimonial');
    await page.waitForTimeout(400);
    const activeTabAfterKpi = await page.evaluate(() => {
      const active = Array.from(document.querySelectorAll('.tab-view')).find(t => t.style.display !== 'none');
      const selectVal = document.getElementById('report-type-select') ? document.getElementById('report-type-select').value : null;
      return { tabId: active ? active.id : null, reportType: selectVal };
    });
    console.log('Navigation after KPI click:', activeTabAfterKpi);

    await browser.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
  }
});
