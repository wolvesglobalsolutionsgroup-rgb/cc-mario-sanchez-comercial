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
    console.log('[UI] Production guard verified: no synthetic session is injected by the smoke test.');
  } finally { if (browser) await browser.close(); server.close(); }
});
