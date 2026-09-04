// Build script: genera assets/speed-insights.js a partir de @vercel/speed-insights
// El paquete es ESM; lo transformamos a un IIFE con window.injectSpeedInsights
// para que funcione en HTML estático sin type="module".
const path = require('path');
const fs = require('fs');

const ENTRY = path.join(__dirname, '..', 'node_modules', '@vercel', 'speed-insights', 'dist', 'index.mjs');
const OUT = path.join(__dirname, '..', 'assets', 'speed-insights.js');

if (!fs.existsSync(ENTRY)) {
  console.error('ERROR: No se encontró', ENTRY);
  console.error('Ejecuta primero: npm install @vercel/speed-insights');
  process.exit(1);
}

let src = fs.readFileSync(ENTRY, 'utf8');

// Quitar el export block al final (formato multi-línea)
src = src.replace(/\/\/#\s*sourceMappingURL=index\.mjs\.map\s*$/, '');
src = src.replace(/export\s*\{\s*computeRoute\s*,?\s*generic_default\s+as\s+default\s*,?\s*injectSpeedInsights\s*\};?\s*$/m, '');
src = src.replace(/var\s+\$\s*=\s*\{injectSpeedInsights\s*,\s*computeRoute\s*\};?\s*$/m, '');

// Exponer la función principal en window
src += '\nwindow.injectSpeedInsights = injectSpeedInsights;\n';

const outDir = path.dirname(OUT);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(OUT, src);

console.log('OK bundle escrito en', OUT, fs.statSync(OUT).size, 'bytes');
