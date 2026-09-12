/**
 * ==============================================================================
 * PILAR 3: GUARDRAIL ANTI-DESTRUCCIÓN DE BASE DE DATOS (SAFETY NET)
 * Centro Comercial Mario Sánchez — ERP Inmobiliario
 * 
 * Regla innegociable:
 * Queda terminantemente prohibido ejecutar comandos destructivos (DROP TABLE, 
 * TRUNCATE, MIGRATE RESET, DROP DATABASE) contra bases de datos en producción.
 * ==============================================================================
 */

const DESTRUCTIVE_KEYWORDS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bTRUNCATE\b/i,
  /\bMIGRATE\s+RESET\b/i,
  /\bALTER\s+TABLE\s+.*\s+DROP\s+COLUMN\b/i
];

function isProductionEnvironment(env = process.env) {
  const nodeEnv = (env.NODE_ENV || '').toLowerCase();
  const dbUrl = env.DATABASE_URL || env.SUPABASE_URL || '';
  
  return nodeEnv === 'production' || 
         nodeEnv === 'prod' || 
         dbUrl.includes('.supabase.co') || 
         dbUrl.includes('prod') || 
         dbUrl.includes('aws.neon.tech');
}

function validateSqlCommand(sqlString, env = process.env) {
  if (typeof sqlString !== 'string') {
    return { ok: true };
  }

  const isProd = isProductionEnvironment(env);

  for (const pattern of DESTRUCTIVE_KEYWORDS) {
    if (pattern.test(sqlString)) {
      if (isProd) {
        return {
          ok: false,
          error: `[GUARDRAIL CRÍTICO VIOLADO] Se intentó ejecutar una operación destructiva prohibida (${pattern.source}) en entorno de PRODUCCIÓN. Operación cancelada.`,
          pattern: pattern.source,
          isProduction: true
        };
      } else {
        return {
          ok: true,
          warning: `[GUARDRAIL ADVERTENCIA] Operación destructiva (${pattern.source}) permitida únicamente en entorno local o staging.`,
          isProduction: false
        };
      }
    }
  }

  return { ok: true, isProduction: isProd };
}

// Ejecución CLI independiente si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2).join(' ');
  const result = validateSqlCommand(args);
  if (!result.ok) {
    console.error('\x1b[31m%s\x1b[0m', result.error);
    process.exit(1);
  } else {
    if (result.warning) console.warn('\x1b[33m%s\x1b[0m', result.warning);
    console.log('\x1b[32m%s\x1b[0m', '[GUARDRAIL] Sentencia validada exitosamente. Sin riesgos destructivos.');
    process.exit(0);
  }
}

module.exports = {
  validateSqlCommand,
  isProductionEnvironment
};
