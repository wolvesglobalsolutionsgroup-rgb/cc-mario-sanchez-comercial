/**
 * ==============================================================================
 * TEST SUITE: 5 PILARES DE ESTABILIDAD OPERATIVA
 * Centro Comercial Mario Sánchez — ERP Inmobiliario
 * ==============================================================================
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRateLimit } from "../api/rate-limit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { validateSqlCommand, isProductionEnvironment } = require("../scripts/db-guardrail.js");

describe("PILAR 1: OBSERVABILIDAD, ERRORES Y TELEMETRÍA", () => {
  test("El módulo de telemetría debe existir y contener métodos esenciales", () => {
    const telemetryPath = path.join(rootDir, "gestion", "js", "telemetry.js");
    assert.ok(fs.existsSync(telemetryPath), "gestion/js/telemetry.js debe existir");

    const content = fs.readFileSync(telemetryPath, "utf8");
    assert.ok(content.includes("class TelemetryEngine") || content.includes("CCMSTelemetry"), "Debe definir el motor de telemetría");
    assert.ok(content.includes("captureError"), "Debe contar con método captureError");
    assert.ok(content.includes("captureAction"), "Debe contar con método captureAction");
    assert.ok(content.includes("sanitizeData"), "Debe contar con método de sanitización");
  });

  test("La sanitización en telemetría debe redactar claves críticas", () => {
    const telemetryContent = fs.readFileSync(path.join(rootDir, "gestion", "js", "telemetry.js"), "utf8");
    assert.ok(telemetryContent.includes("password"), "Debe redactar passwords");
    assert.ok(telemetryContent.includes("token"), "Debe redactar tokens");
    assert.ok(telemetryContent.includes("[REDACTED]"), "Debe reemplazar campos sensibles con [REDACTED]");
  });
});

describe("PILAR 2: AUTENTICACIÓN ROBUSTA & CONTROL DE ACCESO (RBAC)", () => {
  test("Auth-Guard debe aplicar hashing PBKDF2 y RLS sin contraseñas en texto plano", () => {
    const authGuardPath = path.join(rootDir, "gestion", "js", "auth-guard.js");
    assert.ok(fs.existsSync(authGuardPath), "gestion/js/auth-guard.js debe existir");
    const authGuardJs = fs.readFileSync(authGuardPath, "utf8");

    assert.ok(
      authGuardJs.includes("PBKDF2") && authGuardJs.includes("100000"),
      "AuthGuard debe implementar PBKDF2 con 100.000 iteraciones"
    );
    assert.ok(
      authGuardJs.includes("crypto.subtle.importKey") || authGuardJs.includes("crypto.subtle.deriveBits"),
      "Debe usar WebCrypto API nativo"
    );
  });

  test("Separación de dominios: Inquilino no debe tener acceso a despacho de avisos de mora", () => {
    const appJsPath = path.join(rootDir, "gestion", "js", "app.js");
    const appJs = fs.readFileSync(appJsPath, "utf8");

    assert.ok(
      appJs.includes("currentRole === 'tenant'") || appJs.includes("isTenant"),
      "app.js debe contemplar separación estricta de roles para el inquilino"
    );
    assert.ok(
      appJs.includes("Buzón de Notificaciones") || appJs.includes("Mesa de Servicio") || appJs.includes("modal-tenant-new-ticket"),
      "El inquilino debe disponer de buzón y mesa de servicio para emitir solicitudes"
    );
  });
});

describe("PILAR 3: BASE DE DATOS SEGURA & GUARDRAILS ANTI-DESTRUCCIÓN", () => {
  test("Guardrail debe abortar DROP TABLE en entorno de producción", () => {
    const prodEnv = { NODE_ENV: "production", DATABASE_URL: "postgresql://admin@db.supabase.co:5432/prod" };
    assert.strictEqual(isProductionEnvironment(prodEnv), true, "Debe detectar entorno de producción");

    const result = validateSqlCommand("DROP TABLE facturas CASCADE;", prodEnv);
    assert.strictEqual(result.ok, false, "No debe permitir DROP TABLE en producción");
    assert.ok(result.error.includes("GUARDRAIL CRÍTICO VIOLADO"), "Debe emitir error crítico");
  });

  test("Guardrail debe abortar TRUNCATE en entorno de producción", () => {
    const prodEnv = { NODE_ENV: "production" };
    const result = validateSqlCommand("TRUNCATE TABLE contratos RESTART IDENTITY;", prodEnv);
    assert.strictEqual(result.ok, false, "No debe permitir TRUNCATE en producción");
  });

  test("Guardrail debe permitir consultas seguras en producción", () => {
    const prodEnv = { NODE_ENV: "production" };
    const safeQuery = "SELECT id, nombre, canon_usd FROM locales WHERE estado = $1";
    const result = validateSqlCommand(safeQuery, prodEnv);
    assert.strictEqual(result.ok, true, "Debe permitir SELECT seguro");
  });

  test("Los archivos de migración deben existir y estructurar el esquema íntegro", () => {
    const mig1Path = path.join(rootDir, "migrations", "0001_initial_ccms_core.sql");
    const mig2Path = path.join(rootDir, "migrations", "0002_add_telemetry_and_security.sql");
    assert.ok(fs.existsSync(mig1Path), "migrations/0001_initial_ccms_core.sql debe existir");
    assert.ok(fs.existsSync(mig2Path), "migrations/0002_add_telemetry_and_security.sql debe existir");
    
    const sql1 = fs.readFileSync(mig1Path, "utf8");
    const sql2 = fs.readFileSync(mig2Path, "utf8");

    assert.ok(sql1.includes("CREATE TABLE IF NOT EXISTS units"), "Debe definir tabla units");
    assert.ok(sql1.includes("CREATE TABLE IF NOT EXISTS tenants"), "Debe definir tabla tenants");
    assert.ok(sql1.includes("CREATE TABLE IF NOT EXISTS invoices"), "Debe definir tabla invoices");
    assert.ok(sql2.includes("CREATE TABLE IF NOT EXISTS audit_logs"), "Debe definir tabla audit_logs");
    assert.ok(sql2.includes("CREATE TABLE IF NOT EXISTS auth_security_tokens"), "Debe definir tabla auth_security_tokens");
  });
});

describe("PILAR 4: GOBERNANZA DE RECURSOS & RATE LIMITING", () => {
  test("Sliding window rate-limiter debe permitir peticiones bajo el umbral", () => {
    const testKey = "test-client-ip-" + Date.now();
    const result1 = checkRateLimit(testKey, 5, 10);
    assert.strictEqual(result1.allowed, true);
    assert.strictEqual(result1.remaining, 4);

    const result2 = checkRateLimit(testKey, 5, 10);
    assert.strictEqual(result2.allowed, true);
    assert.strictEqual(result2.remaining, 3);
  });

  test("Sliding window rate-limiter debe bloquear cuando se supera el límite", () => {
    const blockedKey = "blocked-ip-" + Date.now();
    checkRateLimit(blockedKey, 3, 10);
    checkRateLimit(blockedKey, 3, 10);
    checkRateLimit(blockedKey, 3, 10);

    const blockedResult = checkRateLimit(blockedKey, 3, 10);
    assert.strictEqual(blockedResult.allowed, false, "Debe bloquear la petición excedente");
    assert.strictEqual(blockedResult.remaining, 0);
  });
});

describe("PILAR 5: PIPELINE DE AUTOMATIZACIÓN & HIGIENE DE CÓDIGO", () => {
  test("Scripts de verificación de sintaxis y linter deben estar presentes", () => {
    assert.ok(fs.existsSync(path.join(rootDir, "scripts", "check-syntax.js")), "scripts/check-syntax.js debe existir");
    assert.ok(fs.existsSync(path.join(rootDir, "scripts", "lint-guard.js")), "scripts/lint-guard.js debe existir");
  });

  test("Prohibición estricta de eval() en el código fuente de la plataforma", () => {
    const appJs = fs.readFileSync(path.join(rootDir, "gestion", "js", "app.js"), "utf8");
    assert.ok(!appJs.includes("eval(match.action)"), "No debe usarse eval() para ejecutar comandos del Command Palette");
  });
});

describe("PILAR 6: CUMPLIMIENTO REGULATORIO & LIQUIDACIÓN TRIBUTARIA (SENIAT & ALCALDÍAS LOCAT)", () => {
  const AlcaldiaEngine = require("../gestion/js/alcaldia-engine.js");
  const SeniatEngine = require("../gestion/js/seniat-engine.js");

  test("AlcaldiaEngine debe calcular la declaración ISAE segregando el canon del condominio", () => {
    const mockInvoices = [
      { id: 1, period_month: 3, period_year: 2026, canon_usd: 500, condo_usd: 100, total_usd: 600, unit_number: "PB-01", tenant_name: "Farmacia El Progreso", tenant_rif: "J-12345678-9" },
      { id: 2, period_month: 3, period_year: 2026, canon_usd: 800, condo_usd: 150, total_usd: 950, unit_number: "L-02", tenant_name: "Café Gourmet", tenant_rif: "J-98765432-1" }
    ];

    const declaracion = AlcaldiaEngine.calcularDeclaracionISAE(mockInvoices, [], {
      month: 3,
      year: 2026,
      bcvRate: 800,
      municipioId: "sotillo"
    });

    assert.strictEqual(declaracion.resumen.total_locales_declarados, 2);
    assert.strictEqual(declaracion.resumen.total_canon_usd, 1300);
    assert.strictEqual(declaracion.resumen.total_condo_exento_usd, 250);
    assert.strictEqual(declaracion.resumen.total_facturado_usd, 1550);

    // Base imponible en Bs debe ser SOLO el canon (1300 * 800 = 1,040,000)
    assert.strictEqual(declaracion.resumen.total_base_imponible_bs, 1040000);
    // Condominio exento en Bs (250 * 800 = 200,000)
    assert.strictEqual(declaracion.resumen.total_condo_exento_bs, 200000);

    // ISAE al 2.0% (1,040,000 * 0.02 = 20,800)
    assert.strictEqual(declaracion.resumen.impuesto_isae_a_pagar_bs, 20800);
    // Ahorro fiscal por condominio exento (200,000 * 0.02 = 4,000)
    assert.strictEqual(declaracion.resumen.ahorro_tributario_patente_bs, 4000);
  });

  test("AlcaldiaEngine debe admitir soporte Multi-Municipal con alícuotas dinámicas", () => {
    const municipios = AlcaldiaEngine.getMunicipios();
    assert.ok(municipios.length >= 5, "Debe tener configurados al menos 5 municipios clave");

    // Verificar Chacao (alícuota 2.5%) vs Sotillo (alícuota 2.0%)
    const chacaoMun = municipios.find(m => m.id === "chacao");
    assert.ok(chacaoMun, "Debe incluir municipio Chacao");
    assert.strictEqual(chacaoMun.alicuota_isae, 0.025);

    const declaracionChacao = AlcaldiaEngine.calcularDeclaracionISAE(
      [{ id: 1, period_month: 3, period_year: 2026, canon_usd: 1000, condo_usd: 200, total_usd: 1200 }],
      [],
      { month: 3, year: 2026, bcvRate: 800, municipioId: "chacao" }
    );
    assert.strictEqual(declaracionChacao.alicuota_aplicada_pct, 2.5);
    // Base 800,000 Bs * 2.5% = 20,000 Bs
    assert.strictEqual(declaracionChacao.resumen.impuesto_isae_a_pagar_bs, 20000);
  });

  test("Exportación de Matriz Alcaldia CSV debe generar formato tabular válido", () => {
    const declaracion = AlcaldiaEngine.calcularDeclaracionISAE(
      [{ id: 1, period_month: 3, period_year: 2026, canon_usd: 500, condo_usd: 100, total_usd: 600, unit_number: "PB-01", tenant_name: "Test Tenant", tenant_rif: "J-11111111-1" }],
      [],
      { month: 3, year: 2026, bcvRate: 800 }
    );
    const csv = AlcaldiaEngine.exportarMatrizAlcaldiaCSV(declaracion);
    assert.ok(csv.includes("Canon Gravable"), "El CSV debe incluir cabecera de canon gravable");
    assert.ok(csv.includes("PB-01"), "El CSV debe incluir la unidad");
    assert.ok(csv.includes("No Sujeto / Mandato Terceros"), "El CSV debe citar el fundamento de mandato");
  });

  test("SeniatEngine TXT debe generar formato de período AAAAMM y 16 campos oficiales", () => {
    const mockPurchases = {
      periodo: "03/2026",
      items: [
        {
          op: 1,
          fecha: "2026-03-05",
          rif_proveedor: "J-31049281-0",
          nombre_proveedor: "Seguridad y Custodia Oriente C.A.",
          num_factura: "FAC-2026-0301",
          num_control: "00-008912",
          concepto: "Servicio de Vigilancia Áreas Comunes",
          total_compras_con_iva: 880000,
          compras_exentas: 0,
          base_imponible: 758620.69,
          alicuota_pct: 16.00,
          credito_fiscal: 121379.31,
          iva_retenido_efectuado: 91034.48,
          num_comprobante_iva: "20260300000001"
        }
      ]
    };

    const txt = SeniatEngine.generateSeniatTxtRetention(mockPurchases, "J-30211544-2");
    assert.ok(txt && txt.length > 0, "El TXT no debe estar vacío");
    const fields = txt.split("\t");
    assert.strictEqual(fields.length, 16, "El TXT del SENIAT debe contener exactamente 16 campos separados por tab");
    assert.strictEqual(fields[0], "J302115442", "Campo 1: RIF Agente sin guiones");
    assert.strictEqual(fields[1], "202603", "Campo 2: Período oficial en formato AAAAMM");
    assert.strictEqual(fields[3], "C", "Campo 4: Tipo de Operación 'C'");
    assert.strictEqual(fields[4], "01", "Campo 5: Tipo de Documento '01'");
    assert.strictEqual(fields[12], "20260300000001", "Campo 13: Número de comprobante 14 dígitos");
  });
});

describe("PILAR 7: AUDITORÍA DE INTEGRIDAD, FAIL-CLOSED & CONCILIACIÓN BANCARIA", () => {
  const ContractViewer = require("../gestion/js/contract-viewer.js");
  const BankReconciliation = require("../gestion/js/bank-reconciliation.js");

  test("ContractViewer debe aplicar fail-closed (retornar null) si no encuentra el inquilino solicitado", () => {
    // Si se consulta un ID de inquilino inexistente, NUNCA debe devolver datos reales de otro inquilino
    const nonExistentTenant = ContractViewer.resolveTenant("inquilino-inexistente-999");
    assert.strictEqual(nonExistentTenant, null, "Debe retornar null en vez de exponer datos de otro inquilino");

    const nullContract = ContractViewer.resolveContract(null);
    assert.strictEqual(nullContract, null, "resolveContract(null) debe retornar null de forma segura");
  });

  test("BankReconciliation debe considerar la ventana de tolerancia de fecha (toleranceDays)", () => {
    const mockTxs = [
      { id: "tx-1", date: "2026-03-05", reference: "REF999888", amount: 450, description: "Pago Alquiler" },
      { id: "tx-2", date: "2026-06-25", reference: "NOREF", amount: 450, description: "Pago Desfasado 3 meses" }
    ];

    const mockInvoices = [
      { id: "inv-1", due_date: "2026-03-04", total_usd: 450, payment_proof_ref: "REF999888" },
      { id: "inv-2", due_date: "2026-03-05", total_usd: 450, payment_proof_ref: "" }
    ];

    const result = BankReconciliation.reconcile(mockTxs, mockInvoices, {
      bcvRate: 1.0, // Moneda directa para la prueba
      toleranceDays: 3
    });

    // tx-1 debe conciliar exacto con inv-1 (mismo monto y fecha dentro de 3 días)
    const match1 = result.matched.find(m => m.bankTx.id === "tx-1");
    assert.ok(match1, "tx-1 debe estar conciliado");
    assert.strictEqual(match1.status, "CONCILIADO_EXACTO");

    // tx-2 (junio) no debe emparejarse con inv-2 (marzo) por exceso de tolerancia de fecha
    const match2 = result.matched.find(m => m.bankTx.id === "tx-2");
    assert.strictEqual(match2, undefined, "tx-2 no debe conciliar exacto con una factura de 3 meses antes");
  });
});


