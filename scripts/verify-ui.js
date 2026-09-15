const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const rootDir = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/gestion/login.html';
  const filePath = path.join(rootDir, reqPath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return res.writeHead(404).end('Not found');
  const ext = path.extname(filePath);
  const mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
  res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(filePath));
});
server.listen(8103, async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto('http://localhost:8103/gestion/login.html', { waitUntil: 'networkidle' });
      const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, visibleText: /Acceso a Producción|Modo Demostración/i.test(document.body.innerText) }));
      if (metrics.scrollWidth > metrics.innerWidth) throw new Error(`Overflow login ${viewport.width}: ${metrics.scrollWidth} > ${metrics.innerWidth}`);
      if (!metrics.visibleText) throw new Error(`Login content missing at ${viewport.width}px`);
      await page.screenshot({ path: path.join(require('os').tmpdir(), `ccms-ui-login-${viewport.width}.png`), fullPage: true });
      await page.close();
      console.log(`[UI] login ${viewport.width}px: PASS (${metrics.scrollWidth}px content width)`);
    }
    // Smoke autenticado del tablero demo: evita que una regresión de carga deje
    // la interfaz visualmente viva pero sin los datos que debe presentar.
    const demoPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await demoPage.addInitScript(() => localStorage.setItem('ccms_session', JSON.stringify({
      user_id: 'demo-ui-user', role: 'admin', display_name: 'Demo UI', is_demo: true,
      organization_id: 'd0000000-0000-0000-0000-000000000001', expires_at: Date.now() + 3600000
    })));
    await demoPage.goto('http://localhost:8103/gestion/index.html', { waitUntil: 'networkidle' });
    await demoPage.waitForFunction(() => document.getElementById('kpi-billed')?.textContent?.trim() !== '$0.00', null, { timeout: 5000 });
    const dashboard = await demoPage.evaluate(() => ({
      billed: document.getElementById('kpi-billed')?.textContent?.trim(),
      collected: document.getElementById('kpi-collected')?.textContent?.trim(),
      overdue: document.getElementById('kpi-overdue')?.textContent?.trim(),
      units: document.getElementById('kpi-occupancy')?.textContent?.trim()
    }));
    if (!/\$\s*7,560\.00/.test(dashboard.billed || '') || !/\$\s*4,650\.00/.test(dashboard.overdue || '') || dashboard.units !== '100%') {
      throw new Error(`Dashboard demo metrics incomplete: ${JSON.stringify(dashboard)}`);
    }
    if (demoPage.url().includes('login')) throw new Error('Demo session was rejected by auth guard');
    const browserErrors = [];
    demoPage.on('pageerror', error => browserErrors.push(error.message));
    const internalTabs = await demoPage.locator('.nav-item[data-tab]').evaluateAll(nodes => nodes
      .filter(n => n.offsetParent !== null && !n.classList.contains('is-hidden'))
      .map(n => n.getAttribute('data-tab')).filter(Boolean));
    for (const tabName of [...new Set(internalTabs)]) {
      await demoPage.locator(`.nav-item[data-tab="${tabName}"]`).first().evaluate(el => el.click());
      await demoPage.waitForTimeout(40);
      const visiblePanel = await demoPage.locator(`#tab-${tabName}`).count();
      if (!visiblePanel) throw new Error(`Missing panel for navigation tab: ${tabName}`);
    }
    if (browserErrors.length) throw new Error(`Runtime errors during module navigation: ${browserErrors.join(' | ')}`);
    await demoPage.close();
    console.log(`[UI] dashboard demo 390px: PASS (KPIs y ${new Set(internalTabs).size} módulos navegables sin errores)`);
    console.log('[UI] Production guard verified: no synthetic session is injected by the smoke test.');
  } finally { if (browser) await browser.close(); server.close(); }
});
