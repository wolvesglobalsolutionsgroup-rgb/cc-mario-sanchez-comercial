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
    const mig1Path = path.join(rootDir, "supabase", "migrations", "20260904000340_init_ccms_erp.sql");
    const mig2Path = path.join(rootDir, "supabase", "migrations", "20260912000000_normalize_roles_and_anti_replay.sql");
    assert.ok(fs.existsSync(mig1Path), "supabase/migrations/20260904000340_init_ccms_erp.sql debe existir");
    assert.ok(fs.existsSync(mig2Path), "supabase/migrations/20260912000000_normalize_roles_and_anti_replay.sql debe existir");
    
    const sql1 = fs.readFileSync(mig1Path, "utf8");
    const sql2 = fs.readFileSync(mig2Path, "utf8");

    assert.ok(sql1.includes("units"), "Debe definir tabla units");
    assert.ok(sql1.includes("tenants"), "Debe definir tabla tenants");
    assert.ok(sql1.includes("invoices"), "Debe definir tabla invoices");
    assert.ok(sql2.includes("ANTI-REPLAY") || sql2.includes("anti_replay"), "Debe estructurar restricción anti-replay");
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

  test("Arquitectura Modular (Dimensión 9): Módulos desacoplados en gestion/js/modules/ deben estructurarse e inyectarse", () => {
    const modulesDir = path.join(rootDir, "gestion", "js", "modules");
    assert.ok(fs.existsSync(modulesDir), "gestion/js/modules/ debe existir");
    assert.ok(fs.existsSync(path.join(modulesDir, "gemini-assistant.js")), "gemini-assistant.js debe existir en modules");
    assert.ok(fs.existsSync(path.join(modulesDir, "herederos-manager.js")), "herederos-manager.js debe existir en modules");
    assert.ok(fs.existsSync(path.join(modulesDir, "env-badge.js")), "env-badge.js debe existir en modules");

    const indexHtml = fs.readFileSync(path.join(rootDir, "gestion", "index.html"), "utf8");
    assert.ok(indexHtml.includes("js/modules/gemini-assistant.js"), "index.html debe cargar gemini-assistant.js");
    assert.ok(indexHtml.includes("js/modules/herederos-manager.js"), "index.html debe cargar herederos-manager.js");
    assert.ok(indexHtml.includes("js/modules/env-badge.js"), "index.html debe cargar env-badge.js");

    // Verificar que HerederosManager resuelva correctamente métodos de dbService y financialEngine
    require(path.join(modulesDir, "herederos-manager.js"));
    global.dbService = {
      getInvoices: () => [{ period_month: 9, period_year: 2026, rent_usd: 500, condo_usd: 100, status: 'pagado' }],
      getSettings: () => ({ cuota_base_heredero_usd: 400 }),
      getCondoExpenses: () => []
    };
    global.financialEngine = {
      convert: (usd) => usd * 800
    };
    const reportHtml = global.HerederosManager.renderReportHTML(9, 2026);
    assert.ok(reportHtml.includes("LIQUIDACIÓN DE FRUTOS CIVILES SUCESORALES"), "HerederosManager debe renderizar el informe sucesoral");
    assert.ok(reportHtml.includes("$600.00"), "HerederosManager debe calcular los ingresos recaudados de los recibos");
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

describe("PILAR 8: CONEXIÓN REAL A SUPABASE, CONFIGURACIÓN SERVERLESS & CONTROL DE CONCURRENCIA", () => {
  const configHandler = require("../api/config.js");

  test("Ficha A: /api/config debe responder 500 si faltan variables y 200 con cabeceras de caché si están presentes", async () => {
    // Caso 1: Variables no configuradas
    const prevUrl = process.env.SUPABASE_URL;
    const prevKey = process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    let statusCode = 0;
    let jsonResult = null;
    const mockRes500 = {
      setHeader: () => {},
      status: (c) => { statusCode = c; return mockRes500; },
      json: (d) => { jsonResult = d; }
    };
    await configHandler({}, mockRes500);
    assert.strictEqual(statusCode, 500, "Debe retornar 500 si faltan credenciales");

    // Caso 2: Variables configuradas
    process.env.SUPABASE_URL = "https://ccms-prod.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key-mock-12345";
    const headers = {};
    const mockRes200 = {
      setHeader: (k, v) => { headers[k] = v; },
      status: (c) => { statusCode = c; return mockRes200; },
      json: (d) => { jsonResult = d; }
    };
    await configHandler({}, mockRes200);
    assert.strictEqual(statusCode, 200, "Debe retornar 200 cuando las credenciales están configuradas");
    assert.strictEqual(jsonResult.supabaseUrl, "https://ccms-prod.supabase.co");
    assert.strictEqual(jsonResult.supabaseAnonKey, "anon-key-mock-12345");
    assert.ok(headers["Cache-Control"].includes("s-maxage=3600"), "Debe tener cabecera de CDN cache");

    // Restaurar estado
    if (prevUrl) process.env.SUPABASE_URL = prevUrl; else delete process.env.SUPABASE_URL;
    if (prevKey) process.env.SUPABASE_ANON_KEY = prevKey; else delete process.env.SUPABASE_ANON_KEY;
  });

  test("Ficha A: supabase-init.js debe estar inyectado en index.html y login.html antes de auth-guard", () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, "gestion", "index.html"), "utf8");
    const loginHtml = fs.readFileSync(path.join(rootDir, "gestion", "login.html"), "utf8");

    assert.ok(indexHtml.includes("supabase-init.js"), "index.html debe cargar supabase-init.js");
    assert.ok(loginHtml.includes("supabase-init.js"), "login.html debe cargar supabase-init.js");

    const indexInitPos = indexHtml.indexOf("supabase-init.js");
    const indexAuthPos = indexHtml.indexOf("auth-guard.js");
    assert.ok(indexInitPos < indexAuthPos, "supabase-init.js debe cargarse antes de auth-guard.js en index.html");

    const loginInitPos = loginHtml.indexOf("supabase-init.js");
    const loginAuthPos = loginHtml.indexOf("auth-guard.js");
    assert.ok(loginInitPos < loginAuthPos, "supabase-init.js debe cargarse antes de auth-guard.js en login.html");
  });

  test("Ficha B & C: AuthGuard y DatabaseService deben estructurar conexión real y rollback de concurrencia", () => {
    const authGuardSrc = fs.readFileSync(path.join(rootDir, "gestion", "js", "auth-guard.js"), "utf8");
    const dbClientSrc = fs.readFileSync(path.join(rootDir, "gestion", "js", "supabase-client.js"), "utf8");

    // Ficha B
    assert.ok(authGuardSrc.includes("supabaseClient.auth.signInWithPassword"), "AuthGuard debe invocar signInWithPassword");
    assert.ok(authGuardSrc.includes("profiles"), "AuthGuard debe validar el rol en la tabla profiles");

    // Ficha C
    assert.ok(dbClientSrc.includes("conflictoDeVersion"), "DatabaseService debe detectar conflicto de versión");
    assert.ok(dbClientSrc.includes("OPTIMISTIC_LOCK_CONFLICT"), "DatabaseService debe lanzar OPTIMISTIC_LOCK_CONFLICT");
    assert.ok(dbClientSrc.includes("payment.status = 'pendiente'"), "DatabaseService debe hacer rollback a pendiente ante conflicto");
  });
});

describe("PILAR 9: INTEGRACIÓN DE IA RESILIENTE (GEMINI FLASH) & CONFIGURACIÓN FISCAL/PARAMÉTRICA", () => {
  const geminiHandler = require("../api/gemini.js");
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-gemini-key-ci";

  test("Proxy Gemini: Validación defensiva de métodos HTTP y cuerpo de la petición", async () => {
    let statusCode = 0;
    let jsonResult = null;
    const mockRes = {
      setHeader: () => {},
      status: (c) => { statusCode = c; return mockRes; },
      json: (d) => { jsonResult = d; return mockRes; }
    };

    // GET debe ser rechazado con 405
    await geminiHandler({ method: "GET" }, mockRes);
    assert.strictEqual(statusCode, 405, "Debe retornar 405 para peticiones GET");

    // POST sin autenticación ni demo debe ser rechazado con 401 incondicionalmente
    await geminiHandler({ method: "POST", headers: { "x-forwarded-for": "10.0.0.1" }, body: { prompt: "Test no autenticado" } }, mockRes);
    assert.strictEqual(statusCode, 401, "Debe rechazar peticiones no autenticadas con 401 incondicionalmente");

    // POST con esquema de autorización no Bearer debe retornar 401
    await geminiHandler({ method: "POST", headers: { "x-forwarded-for": "10.0.0.1", "authorization": "Basic user:pass" }, body: { prompt: "Test" } }, mockRes);
    assert.strictEqual(statusCode, 401, "Debe rechazar esquemas no Bearer con 401");

    // POST con Bearer token vacío debe retornar 401
    await geminiHandler({ method: "POST", headers: { "x-forwarded-for": "10.0.0.1", "authorization": "Bearer   " }, body: { prompt: "Test" } }, mockRes);
    assert.strictEqual(statusCode, 401, "Debe rechazar token Bearer vacío con 401");

    // POST con token en entorno sin Supabase URL debe fallar cerrado con 401
    await geminiHandler({ method: "POST", headers: { "x-forwarded-for": "10.0.0.1", "authorization": "Bearer fake-unverified-token" }, body: { prompt: "Test" } }, mockRes);
    assert.strictEqual(statusCode, 401, "Debe fallar cerrado con 401 cuando no se puede verificar el token con Supabase");

    // POST con body vacío debe retornar 400
    await geminiHandler({ method: "POST", headers: { "x-forwarded-for": "10.0.0.1", "x-ccms-demo": "true" }, body: {} }, mockRes);
    assert.strictEqual(statusCode, 400, "Debe retornar 400 si el prompt está ausente");

    // POST con prompt superior a 4000 caracteres debe retornar 400
    await geminiHandler({ method: "POST", headers: { "x-forwarded-for": "10.0.0.2", "x-ccms-demo": "true" }, body: { prompt: "X".repeat(4001) } }, mockRes);
    assert.strictEqual(statusCode, 400, "Debe rechazar prompts de más de 4000 caracteres con 400");
    assert.ok(jsonResult.error.includes("4.000"), "Debe notificar el límite de 4.000 caracteres");

    // POST en demo sin GEMINI_API_KEY debe retornar 500 informando servicio no configurado
    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await geminiHandler({ method: "POST", headers: { "x-forwarded-for": "10.0.0.3", "x-ccms-demo": "true" }, body: { prompt: "Consulta prueba" } }, mockRes);
      assert.strictEqual(statusCode, 500, "Debe retornar 500 si GEMINI_API_KEY está ausente");
      assert.strictEqual(jsonResult.code, "MISSING_API_KEY", "Debe incluir código MISSING_API_KEY");
    } finally {
      process.env.GEMINI_API_KEY = savedKey;
    }
  });

  test("Proxy Gemini: Rate Limiter por ventana deslizante debe bloquear abusos con HTTP 429", async () => {
    const https = require("https");
    const originalRequest = https.request;
    https.request = (url, options, callback) => {
      const { EventEmitter } = require("events");
      const reqMock = new EventEmitter();
      reqMock.write = () => {};
      reqMock.end = () => {
        const resMock = new EventEmitter();
        resMock.statusCode = 200;
        process.nextTick(() => {
          callback(resMock);
          resMock.emit("data", JSON.stringify({ candidates: [{ content: { parts: [{ text: "Respuesta legal simulada" }] } }] }));
          resMock.emit("end");
        });
      };
      return reqMock;
    };

    const testIp = "192.168.99.100";
    let lastCode = 0;
    let lastJson = null;
    const headers = {};
    const mockRes = {
      setHeader: (k, v) => { headers[k] = v; },
      status: (c) => { lastCode = c; return mockRes; },
      json: (d) => { lastJson = d; return mockRes; }
    };

    try {
      // Ejecutar ráfaga de peticiones para agotar la cuota
      for (let i = 0; i < 20; i++) {
        await geminiHandler({
          method: "POST",
          headers: { "x-forwarded-for": testIp, "x-ccms-demo": "true" },
          body: { prompt: "Consulta legal de prueba" }
        }, mockRes);
      }
    } finally {
      https.request = originalRequest;
    }

    assert.strictEqual(lastCode, 429, "Debe retornar HTTP 429 cuando se excede la tasa por IP");
    assert.ok(headers["Retry-After"] !== undefined, "Debe incluir cabecera Retry-After");
    assert.ok(lastJson.error.includes("Límite de solicitudes"), "Debe devolver mensaje informativo de límite excedido");
  });

  test("Proxy Gemini: Fallback resiliente ante modelo 404 y desvinculación sucesoral de organizaciones genéricas", async () => {
    const https = require("https");
    const originalRequest = https.request;
    const requestedModels = [];

    https.request = (url, options, callback) => {
      const { EventEmitter } = require("events");
      const reqMock = new EventEmitter();
      reqMock.write = () => {};
      reqMock.end = () => {
        const resMock = new EventEmitter();
        const modelMatch = url.match(/models\/([^:]+):generateContent/);
        const model = modelMatch ? modelMatch[1] : "unknown";
        requestedModels.push(model);

        // Simular que el primer modelo devuelve 404 (deprecado) y el siguiente 200
        if (requestedModels.length === 1) {
          resMock.statusCode = 404;
          process.nextTick(() => {
            callback(resMock);
            resMock.emit("data", JSON.stringify({ error: { message: `Model ${model} is discontinued.` } }));
            resMock.emit("end");
          });
        } else {
          resMock.statusCode = 200;
          process.nextTick(() => {
            callback(resMock);
            resMock.emit("data", JSON.stringify({ candidates: [{ content: { parts: [{ text: "Respuesta exitosa del modelo fallback" }] } }] }));
            resMock.emit("end");
          });
        }
      };
      return reqMock;
    };

    let statusCode = 0;
    let jsonResult = null;
    const mockRes = {
      setHeader: () => {},
      status: (c) => { statusCode = c; return mockRes; },
      json: (d) => { jsonResult = d; return mockRes; }
    };

    try {
      await geminiHandler({
        method: "POST",
        headers: { "x-forwarded-for": "172.16.0.5", "x-ccms-demo": "true" },
        body: {
          prompt: "¿Cuál es el canon máximo legal?",
          organization: { name: "Centro Comercial Plaza Mayor", features: {} }
        }
      }, mockRes);
    } finally {
      https.request = originalRequest;
    }

    assert.strictEqual(statusCode, 200, "Debe responder 200 utilizando el modelo de fallback");
    assert.strictEqual(jsonResult.ok, true, "La respuesta debe ser exitosa");
    assert.ok(requestedModels.length >= 2, "Debe haber intentado al menos dos modelos en cascada");
  });

  test("Seguridad e Inmunidad de Credenciales: .gitignore y no exposición de llaves de API", () => {
    const gitignorePath = path.join(rootDir, ".gitignore");
    assert.ok(fs.existsSync(gitignorePath), ".gitignore debe existir");
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    assert.ok(gitignoreContent.includes(".env"), ".gitignore debe ignorar .env");

    // Verificar que los archivos cliente en gestion/js no contengan la clave de API real de Gemini en texto plano
    const clientFiles = ["app.js", "supabase-client.js", "venezuela-legal.js", "contract-viewer.js", "ayuda-content.js"];
    for (const f of clientFiles) {
      const filePath = path.join(rootDir, "gestion", "js", f);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        assert.ok(!content.includes("AIzaSy"), `El archivo cliente ${f} no debe contener la clave privada de Google AI en texto plano`);
      }
    }
  });

  test("Contenido de Ayuda e Informes: Sin jerga de desarrollo interno y con respaldo legal oficial", () => {
    const ayudaPath = path.join(rootDir, "gestion", "js", "ayuda-content.js");
    assert.ok(fs.existsSync(ayudaPath), "ayuda-content.js debe existir");
    const ayudaContent = fs.readFileSync(ayudaPath, "utf8");

    // Prohibir términos informales o de desarrollo interno
    assert.ok(!ayudaContent.includes("NotebookLM"), "No debe mencionar NotebookLM");
    assert.ok(!ayudaContent.includes("Colab"), "No debe mencionar Colab");
    assert.ok(!ayudaContent.includes("7 archivos"), "No debe mencionar '7 archivos'");
    assert.ok(!ayudaContent.includes("no tenemos respaldo"), "No debe mencionar 'no tenemos respaldo'");

    // Exigir referencias normativas oficiales
    assert.ok(ayudaContent.includes("40.418"), "Debe citar el Decreto Ley de Arrendamiento Comercial G.O. 40.418");
    assert.ok(ayudaContent.includes("LOCAT"), "Debe citar la Ley Orgánica de Coordinación y Armonización Tributaria (LOCAT)");
    assert.ok(ayudaContent.includes("Código Civil"), "Debe citar el Código Civil Venezolano (Arts. 552 y 768)");
  });

  test("Configuración Paramétrica: Valores por defecto y persistencia de perfil tributario y gastos", () => {
    // Probar instancia con mock de localStorage
    global.localStorage = {
      _store: {},
      getItem(k) { return this._store[k] || null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; }
    };
    if (!global.window) global.window = {};

    require("../gestion/js/supabase-client.js");
    const dbService = global.window.dbService;
    const settings = dbService.getSettings();

    // Valores por defecto
    assert.strictEqual(settings.tax_contributor_type, "especial", "Tipo de contribuyente por defecto debe ser especial");
    assert.strictEqual(settings.tax_iva_withhold_pct, 75, "Retención IVA por defecto debe ser 75%");
    assert.strictEqual(settings.tax_islr_withhold_pct, 2.0, "Retención ISLR por defecto debe ser 2.0%");
    assert.strictEqual(settings.base_monthly_expenses_usd, 2540.00, "Gasto mensual base por defecto debe ser $2,540.00");
    assert.strictEqual(settings.reserve_fund_pct, 10.0, "Fondo de reserva por defecto debe ser 10.0%");
    assert.strictEqual(settings.admin_fee_pct, 5.0, "Gasto de administración por defecto debe ser 5.0%");

    // Guardado y actualización
    const updated = dbService.saveSettings({
      base_monthly_expenses_usd: 2800.00,
      reserve_fund_pct: 12.0
    });
    assert.strictEqual(updated.base_monthly_expenses_usd, 2800.00, "Debe persistir el nuevo gasto base");
    assert.strictEqual(updated.reserve_fund_pct, 12.0, "Debe persistir el nuevo porcentaje de fondo de reserva");

    // Restaurar a valores iniciales
    dbService.saveSettings({
      base_monthly_expenses_usd: 2540.00,
      reserve_fund_pct: 10.0
    });
  });

  test("Diseño Responsive Móvil: Estructura de documentos y clases oficiales de visualización", () => {
    const cssContent = fs.readFileSync(path.join(rootDir, "gestion", "css", "dashboard.css"), "utf8");
    const indexContent = fs.readFileSync(path.join(rootDir, "gestion", "index.html"), "utf8");

    // Clases CSS añadidas para documentos oficiales
    assert.ok(cssContent.includes(".report-official-header"), "dashboard.css debe incluir .report-official-header");
    assert.ok(cssContent.includes(".report-signatures-grid"), "dashboard.css debe incluir .report-signatures-grid");
    assert.ok(cssContent.includes(".report-metadata-grid"), "dashboard.css debe incluir .report-metadata-grid");

    // Elementos UI en HTML
    assert.ok(indexContent.includes("id=\"card-kpi-fruto-patrimonial\""), "index.html debe contener la tarjeta KPI de Fruto Patrimonial");
    assert.ok(indexContent.includes("id=\"modal-gemini-assistant\""), "index.html debe contener el modal del Asistente Gemini");
    assert.ok(indexContent.includes("btn-gemini-assistant-trigger"), "index.html debe contener el botón disparador del asistente IA");
    assert.ok(indexContent.includes("id=\"modal-solvency-preview\""), "index.html debe contener el modal de vista previa de Solvencia");
    assert.ok(indexContent.includes("id=\"fab-gemini-assistant\""), "index.html debe contener el botón flotante (FAB) de Asistente IA");
    assert.ok(cssContent.includes(".fab-gemini-chat"), "dashboard.css debe incluir estilos para .fab-gemini-chat");
  });
});

describe("PILAR 10: ARQUITECTURA MULTI-TENANT (FASE 0) & CONDICIÓN DE CARRERA DE AUTENTICACIÓN", () => {
  const rootDir = path.resolve(__dirname, "..");

  test("Ficha Login: login.js debe resolver condición de carrera mediante supabaseReadyPromise", () => {
    const loginJs = fs.readFileSync(path.join(rootDir, "gestion", "js", "login.js"), "utf8");
    assert.ok(loginJs.includes("supabaseReadyPromise"), "login.js debe definir la promesa determinista supabaseReadyPromise");
    assert.ok(loginJs.includes("await supabaseReadyPromise;"), "handleLogin debe esperar await supabaseReadyPromise antes de procesar credenciales");
    assert.ok(loginJs.includes("supabase:ready"), "supabaseReadyPromise debe escuchar el evento 'supabase:ready'");
  });

  test("Fase 0 Multi-Tenant: Migración SQL 20260913000000 debe estructurar organizations, profiles y 11 tablas", () => {
    const migrationFile = path.join(rootDir, "supabase", "migrations", "20260913000000_add_organizations_layer.sql");
    assert.ok(fs.existsSync(migrationFile), "El archivo de migración multi-tenant debe existir");

    const sql = fs.readFileSync(migrationFile, "utf8");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.organizations"), "Debe crear la tabla maestra public.organizations");
    assert.ok(sql.includes("has_ccms_organization"), "Debe definir la función de RLS has_ccms_organization()");
    assert.ok(sql.includes("Centro Comercial Mario Sánchez"), "Debe insertar la organización semilla del CC Mario Sánchez");

    const requiredTables = [
      "units", "tenants", "contracts", "invoices", "payments",
      "condo_expenses", "chart_of_accounts", "transactions", "alerts",
      "audit_logs", "service_tickets"
    ];

    for (const table of requiredTables) {
      assert.ok(
        sql.includes("public." + table) && sql.includes("organization_id UUID"),
        "La migración debe agregar organization_id a la tabla public." + table
      );
    }
  });

  test("Vista Previa In-App: Solvencia Arrendaticia debe contar con modal y controladores oficiales", () => {
    const appJs = fs.readFileSync(path.join(rootDir, "gestion", "js", "app.js"), "utf8");
    assert.ok(appJs.includes("openSolvencyPreviewModal"), "app.js debe exponer window.openSolvencyPreviewModal");
    assert.ok(appJs.includes("printActiveSolvencyCertificate"), "app.js debe exponer window.printActiveSolvencyCertificate");
    assert.ok(appJs.includes("downloadActiveSolvencyPDF"), "app.js debe exponer window.downloadActiveSolvencyPDF");
  });

  test("Fase 0 Multi-Tenant RLS: Migración 20260913000100 debe aislar por has_ccms_organization en 11 tablas", () => {
    const migrationFile = path.join(rootDir, "supabase", "migrations", "20260913000100_enforce_organization_isolation.sql");
    assert.ok(fs.existsSync(migrationFile), "La migración de aislamiento RLS 20260913000100 debe existir");

    const sql = fs.readFileSync(migrationFile, "utf8");
    assert.ok(sql.includes("has_ccms_organization(organization_id)"), "Debe aplicar has_ccms_organization(organization_id)");
    assert.ok(sql.includes("regimen_sucesoral"), "Debe configurar features.regimen_sucesoral para la organización");

    const requiredTables = [
      "chart_of_accounts", "units", "tenants", "contracts",
      "condo_expenses", "invoices", "payments", "transactions",
      "alerts", "audit_logs", "service_tickets"
    ];

    for (const table of requiredTables) {
      assert.ok(
        sql.includes(table),
        `La política RLS de aislamiento debe contemplar la tabla public.${table}`
      );
    }
  });

  test("Higiene UI y Flujo Demo/Producción: No modales invasivos en header y no autollenado en producción", () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, "gestion", "index.html"), "utf8");
    const loginJs = fs.readFileSync(path.join(rootDir, "gestion", "js", "login.js"), "utf8");
    const appJs = fs.readFileSync(path.join(rootDir, "gestion", "js", "app.js"), "utf8");

    // Modal de entorno eliminado
    assert.ok(!indexHtml.includes("id=\"modal-env-status\""), "index.html no debe contener el modal intrusivo #modal-env-status");
    assert.ok(!indexHtml.includes("toggleEnvironmentModal()"), "index.html no debe enlazar onclick toggleEnvironmentModal()");

    // Badge discreto por defecto oculto en HTML estático
    assert.ok(indexHtml.includes("id=\"env-mode-badge\""), "index.html debe contener el badge discreto #env-mode-badge");
    assert.ok(indexHtml.includes("id=\"env-mode-badge\" style=\"display: none;"), "El badge debe estar oculto por defecto para no parpadear en producción");

    // Botón de restablecer datos demo oculto por defecto
    assert.ok(indexHtml.includes("id=\"btn-header-reset-demo\""), "index.html debe contener el id #btn-header-reset-demo");
    assert.ok(indexHtml.includes("id=\"btn-header-reset-demo\"") && indexHtml.includes("style=\"display: none;\""), "El botón reset demo debe estar oculto en el header por defecto");

    // En producción no se deben autollenar contraseñas ficticias
    assert.ok(loginJs.includes("switchRole('admin', false);"), "login.js no debe autollenar credenciales demo al iniciar en producción");

    // Fruto Patrimonial condicional estricto
    assert.ok(appJs.includes("regimen_sucesoral?.activo === true"), "app.js debe exigir estrictamente regimen_sucesoral.activo === true");
  });
});

describe("PILAR 11: REMEDIACIÓN TÉCNICA MAESTRA (FASES F1-F5 / T04-T22)", () => {
  const BankReconciliation = require("../gestion/js/bank-reconciliation.js");

  test("BankReconciliation: Parseo exacto de montos en formatos 1,250.50 (US) y 1.250,50 (VE/EU)", () => {
    const csvContent = [
      "fecha;referencia;monto;descripcion",
      "2026-03-05;REF-001;1,250.50;Transferencia Formato US",
      "2026-03-05;REF-002;1.250,50;Transferencia Formato VE",
      "2026-03-05;REF-003;500.00;Transferencia Simple",
      "2026-03-05;REF-004;750,25;Transferencia Coma Decimal"
    ].join("\n");

    const parsed = BankReconciliation.parseCSV(csvContent);
    assert.strictEqual(parsed.length, 4, "Debe parsear 4 transacciones válidas");
    assert.strictEqual(parsed[0].amount, 1250.50, "1,250.50 debe interpretarse exactamente como 1250.50");
    assert.strictEqual(parsed[1].amount, 1250.50, "1.250,50 debe interpretarse exactamente como 1250.50");
    assert.strictEqual(parsed[2].amount, 500.00, "500.00 debe interpretarse como 500");
    assert.strictEqual(parsed[3].amount, 750.25, "750,25 debe interpretarse como 750.25");
  });

  test("HerederosManager: Cero recaudación no debe fabricar $9,050 ficticios", () => {
    if (!global.window) global.window = {};
    // Simular dbService sin facturas pagadas
    global.dbService = {
      getInvoices: () => [],
      getCondoExpenses: () => [],
      getSettings: () => ({ base_monthly_expenses_usd: 2540.00, cuota_base_heredero_usd: 400.00 })
    };
    require("../gestion/js/modules/herederos-manager.js");
    const html = global.HerederosManager.renderReportHTML(1, 2040);
    assert.ok(!html.includes("$9050.00"), "No debe fabricar $9,050.00 cuando no hay facturas");
    assert.ok(html.includes("$0.00"), "Los ingresos recaudados deben reflejar $0.00");
    assert.ok(html.includes("Sin recaudación"), "Los herederos deben reflejar 'Sin recaudación'");
    assert.ok(!html.includes("Los recursos han sido auditados"), "No debe contener afirmaciones infundadas de auditoría");
  });

  test("Migración Expansiva 20260914000000: Estructura roles enterprise, command_receipts y RPC atómico", () => {
    const migPath = path.join(rootDir, "supabase", "migrations", "20260914000000_expand_identity_and_command_receipts.sql");
    assert.ok(fs.existsSync(migPath), "La migración 20260914000000 debe existir");
    const sql = fs.readFileSync(migPath, "utf8");

    assert.ok(sql.includes("org_director"), "Debe definir rol org_director");
    assert.ok(sql.includes("accountant"), "Debe definir rol accountant");
    assert.ok(sql.includes("fiscal_auditor"), "Debe definir rol fiscal_auditor");
    assert.ok(sql.includes("command_receipts"), "Debe crear tabla command_receipts");
    assert.ok(sql.includes("approve_payment_transaction"), "Debe implementar RPC approve_payment_transaction");
    assert.ok(sql.includes("OPTIMISTIC_LOCK_CONFLICT"), "RPC debe manejar OPTIMISTIC_LOCK_CONFLICT");
  });

  test("Fixtures Sintéticos y Gobernanza de Acceso: Archivos desacoplados presentes", () => {
    const synPath = path.join(rootDir, "gestion", "js", "fixtures-synthetic.js");
    const accPath = path.join(rootDir, "gestion", "js", "modules", "access-management.js");
    assert.ok(fs.existsSync(synPath), "fixtures-synthetic.js debe existir");
    assert.ok(fs.existsSync(accPath), "access-management.js debe existir");

    const accJs = fs.readFileSync(accPath, "utf8");
    assert.ok(accJs.includes("AccessManagement"), "Debe definir objeto global AccessManagement");
    assert.ok(accJs.includes("togglePermission"), "Debe soportar toggle de permisos");
    assert.ok(accJs.includes("hasPermission"), "Debe definir helper hasPermission para control en runtime");
  });

  test("HerederosManager & AccessManagement: Compatibilidad con cadenas de período y verificación de permisos", () => {
    // 1. Verificar coincidencia de períodos string vs number en HerederosManager
    global.dbService = {
      getInvoices: () => [
        { period_month: "3", period_year: "2026", status: "pagado", total_usd: 1500.00 }
      ],
      getCondoExpenses: () => [
        { period_month: "3", period_year: "2026", amount_usd: 500.00 }
      ],
      getSettings: () => ({ base_monthly_expenses_usd: 500.00, cuota_base_heredero_usd: 400.00 })
    };
    require("../gestion/js/modules/herederos-manager.js");
    const htmlWithStrings = global.HerederosManager.renderReportHTML(3, 2026);
    assert.ok(htmlWithStrings.includes("$1500.00"), "Debe recaudar $1500.00 aún cuando period_month y period_year son cadenas");

    // 2. Verificar helper de permisos en AccessManagement
    const AccessManagement = require("../gestion/js/modules/access-management.js");
    assert.strictEqual(AccessManagement.hasPermission("org_director", "invoices", "write"), true, "org_director debe tener write en invoices");
    assert.strictEqual(AccessManagement.hasPermission("fiscal_auditor", "invoices", "write"), false, "fiscal_auditor no debe tener write en invoices");
    assert.strictEqual(AccessManagement.hasPermission("fiscal_auditor", "invoices", "read"), true, "fiscal_auditor debe tener read en invoices");
  });
});
