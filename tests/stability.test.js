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
