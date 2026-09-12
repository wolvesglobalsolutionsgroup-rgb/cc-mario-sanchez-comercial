/**
 * ==============================================================================
 * PILAR 5: VALIDADOR DE INTEGRIDAD Y SINTAXIS ESTRICTA
 * Centro Comercial Mario Sánchez — CI/CD Pipeline
 * ==============================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targetDirs = ['gestion/js', 'api', 'scripts'];
let errorCount = 0;
let checkedCount = 0;

function checkFile(filePath) {
  if (!filePath.endsWith('.js')) return;
  checkedCount++;
  try {
    execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
  } catch (err) {
    console.error(`\x1b[31m[SYNTAX ERROR]\x1b[0m ${filePath}`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
    errorCount++;
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else {
      checkFile(fullPath);
    }
  }
}

console.log('[CI/CD] Iniciando validación estricta de sintaxis en todos los módulos...');
for (const d of targetDirs) {
  walkDir(path.resolve(__dirname, '..', d));
}

if (errorCount > 0) {
  console.error(`\x1b[31m[CI/CD FALLÓ]\x1b[0m Se encontraron ${errorCount} errores de sintaxis en ${checkedCount} archivos analizados.`);
  process.exit(1);
} else {
  console.log(`\x1b[32m[CI/CD ÉXITO]\x1b[0m ${checkedCount} archivos JavaScript validados con sintaxis 100% limpia.`);
  process.exit(0);
}
