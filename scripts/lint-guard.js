/**
 * ==============================================================================
 * PILAR 5: LINTER DEFENSIVO Y CHEQUEO DE HIGIENE DE CÓDIGO
 * Centro Comercial Mario Sánchez — CI/CD Pipeline
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
  { pattern: /eval\s*\(/, message: 'Uso prohibido de eval() en código de producción' },
  { pattern: /localStorage\.setItem\s*\(\s*['"]password['"]/, message: 'Almacenamiento de contraseñas en texto plano detectado' }
];

let violations = 0;

function lintFile(filePath) {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.html')) return;
  const content = fs.readFileSync(filePath, 'utf8');

  // Skip vendor scripts or self
  if (filePath.includes('node_modules') || filePath.includes('speed-insights.js') || filePath.includes('lint-guard.js')) return;

  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.pattern.test(content)) {
      console.error(`\x1b[31m[LINT VIOLATION]\x1b[0m ${filePath}: ${rule.message}`);
      violations++;
    }
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walkDir(fullPath);
    } else {
      lintFile(fullPath);
    }
  }
}

console.log('[CI/CD] Ejecutando linter defensivo y análisis estático de seguridad...');
walkDir(path.resolve(__dirname, '..', 'gestion'));
walkDir(path.resolve(__dirname, '..', 'api'));
walkDir(path.resolve(__dirname, '..', 'scripts'));

if (violations > 0) {
  console.error(`\x1b[31m[LINT FALLÓ]\x1b[0m Se detectaron ${violations} violaciones de seguridad en el código.`);
  process.exit(1);
} else {
  console.log('\x1b[32m[LINT ÉXITO]\x1b[0m Código 100% conforme con las reglas defensivas y de higiene.');
  process.exit(0);
}
