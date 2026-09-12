/**
 * ==============================================================================
 * PILAR 1: OBSERVABILIDAD, ERRORES Y TELEMETRÍA EN TIEMPO REAL
 * Centro Comercial Mario Sánchez — ERP Inmobiliario
 * 
 * Cumplimiento:
 * 1. Logger estructurado en JSON con niveles estrictos: DEBUG, INFO, WARN, ERROR, FATAL.
 * 2. Captura integral de excepciones con contexto: userId, rol, ruta, timestamp ISO, stack trace.
 * 3. Interceptores globales: window.onerror y window.onunhandledrejection.
 * 4. Compatibilidad agnóstica con Sentry, PostHog, Axiom o ingestión vía API (/api/telemetry).
 * 5. Buffer circular en memoria y persistencia local para diagnóstico y auditoría forense.
 * ==============================================================================
 */

(function (global) {
  'use strict';

  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
  };

  const BUFFER_MAX_SIZE = 150;
  const STORAGE_KEY = 'ccms_telemetry_buffer_v1';
  const currentMinLevel = LOG_LEVELS.INFO;

  class TelemetryEngine {
    constructor() {
      this.buffer = [];
      this.sessionTraceId = this.generateTraceId();
      this.endpoint = '/api/telemetry';
      this.loadPersistedBuffer();
      this.initGlobalHooks();
    }

    generateTraceId() {
      return 'tr-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
    }

    getExecutionEnvironment() {
      const user = (global.AuthGuard && typeof global.AuthGuard.currentUser === 'function')
        ? global.AuthGuard.currentUser()
        : null;

      return {
        traceId: this.sessionTraceId,
        userId: user ? user.id : 'anonymous',
        userRole: user ? user.role : 'guest',
        userEmail: user ? user.identifier : 'unauthenticated',
        tenantId: user ? user.tenant_id : null,
        route: global.location ? global.location.pathname + global.location.hash : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        screen: (typeof screen !== 'undefined') ? `${screen.width}x${screen.height}` : 'unknown'
      };
    }

    loadPersistedBuffer() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.buffer = JSON.parse(raw).slice(-BUFFER_MAX_SIZE);
        }
      } catch (e) {
        this.buffer = [];
      }
    }

    persistBuffer() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buffer.slice(-BUFFER_MAX_SIZE)));
      } catch (e) {
        // En caso de cuota excedida en localStorage, limpiar la mitad más vieja
        try {
          this.buffer = this.buffer.slice(-50);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buffer));
        } catch (err) {}
      }
    }

    sanitizeData(data) {
      if (!data || typeof data !== 'object') return data;
      if (Array.isArray(data)) {
        return data.map(item => this.sanitizeData(item));
      }
      const SENSITIVE_PATTERN = /password|pass|secret|token|authorization|bearer|card|cvv|pin/i;
      const clean = {};
      for (const [k, v] of Object.entries(data)) {
        if (SENSITIVE_PATTERN.test(k)) {
          clean[k] = '[REDACTED]';
        } else if (typeof v === 'object' && v !== null) {
          clean[k] = this.sanitizeData(v);
        } else {
          clean[k] = v;
        }
      }
      return clean;
    }

    createEntry(levelName, message, data = {}, error = null) {
      const env = this.getExecutionEnvironment();
      const sanitizedContext = this.sanitizeData(data);
      const entry = {
        timestamp: new Date().toISOString(),
        level: levelName,
        message: String(message),
        env: env,
        context: sanitizedContext
      };

      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack ? error.stack.split('\n').map(l => l.trim()) : null
        };
      } else if (error) {
        entry.error = { message: String(error) };
      }

      return entry;
    }

    record(levelName, message, data = {}, error = null) {
      const levelCode = LOG_LEVELS[levelName] ?? LOG_LEVELS.INFO;
      if (levelCode < currentMinLevel) return;

      const entry = this.createEntry(levelName, message, data, error);

      // Guardar en el ring buffer interno
      this.buffer.push(entry);
      if (this.buffer.length > BUFFER_MAX_SIZE) {
        this.buffer.shift();
      }
      this.persistBuffer();

      // Emisión estructurada JSON
      const jsonOutput = JSON.stringify(entry);
      if (levelName === 'FATAL' || levelName === 'ERROR') {
        console.error('[CCMS-TELEMETRY-ERR]', jsonOutput);
      } else if (levelName === 'WARN') {
        console.warn('[CCMS-TELEMETRY-WARN]', jsonOutput);
      } else {
        console.info('[CCMS-TELEMETRY]', jsonOutput);
      }

      // Despacho a integraciones remotas (Sentry / PostHog / Axiom / Endpoint local)
      this.forwardRemote(entry);

      // Si es FATAL, alertar en consola y registrar en auditoría de seguridad
      if (levelName === 'FATAL') {
        if (global.AuthGuard && typeof global.AuthGuard.audit === 'function') {
          global.AuthGuard.audit('critical_fatal_incident', { message, data, error: entry.error });
        }
      }
    }

    forwardRemote(entry) {
      try {
        // 1. Integración con Sentry si está presente en el runtime
        if (global.Sentry && typeof global.Sentry.captureException === 'function') {
          if (entry.error) {
            global.Sentry.captureException(new Error(entry.message), {
              extra: entry.context,
              tags: { level: entry.level, role: entry.env.userRole }
            });
          } else if (entry.level === 'WARN' || entry.level === 'ERROR' || entry.level === 'FATAL') {
            global.Sentry.captureMessage(entry.message, entry.level.toLowerCase());
          }
        }

        // 2. Integración con PostHog si está configurado
        if (global.posthog && typeof global.posthog.capture === 'function') {
          global.posthog.capture(`ccms_${entry.level.toLowerCase()}`, entry);
        }

        // 3. Fallback de despacho silencioso vía Beacon / fetch hacia API de monitoreo
        if (typeof navigator !== 'undefined' && navigator.sendBeacon && (entry.level === 'ERROR' || entry.level === 'FATAL')) {
          const blob = new Blob([JSON.stringify(entry)], { type: 'application/json' });
          navigator.sendBeacon(this.endpoint, blob);
        }
      } catch (e) {
        // Telemetría nunca debe romper la ejecución de la app
      }
    }

    // Métodos públicos del logger estructurado
    debug(message, context = {}) {
      this.record('DEBUG', message, context);
    }

    info(message, context = {}) {
      this.record('INFO', message, context);
    }

    warn(message, context = {}) {
      this.record('WARN', message, context);
    }

    error(message, error = null, context = {}) {
      this.record('ERROR', message, context, error);
    }

    fatal(message, error = null, context = {}) {
      this.record('FATAL', message, context, error);
    }

    captureException(error, context = {}) {
      const msg = (error && error.message) ? error.message : 'Excepción no controlada capturada';
      this.record('ERROR', msg, context, error);
    }

    captureError(message, error = null, context = {}) {
      this.record('ERROR', message, context, error);
    }

    captureAction(actionName, details = {}) {
      this.record('INFO', `Acción de usuario: ${actionName}`, details);
    }

    initGlobalHooks() {
      if (typeof window === 'undefined') return;

      // Interceptor para errores síncronos de ventana
      window.addEventListener('error', (event) => {
        const error = event.error || new Error(event.message || 'Script execution error');
        this.record('ERROR', `Error no controlado en script: ${event.message}`, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }, error);
      });

      // Interceptor para promesas rechazadas sin catch
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const err = (reason instanceof Error) ? reason : new Error(String(reason));
        this.record('ERROR', `Promesa rechazada no controlada: ${err.message}`, {
          reason: typeof reason === 'object' ? JSON.stringify(reason) : String(reason)
        }, err);
      });
    }

    getRecentLogs() {
      return [...this.buffer];
    }

    clearLogs() {
      this.buffer = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }

    exportDiagnosticBundle() {
      const data = {
        exportedAt: new Date().toISOString(),
        system: 'CC Mario Sánchez ERP — Telemetry & Diagnostics',
        environment: this.getExecutionEnvironment(),
        recentLogs: this.getRecentLogs()
      };
      return JSON.stringify(data, null, 2);
    }
  }

  const telemetryInstance = new TelemetryEngine();

  // Exponer a nivel global
  global.CCMSTelemetry = telemetryInstance;
  global.CCMSLogger = {
    debug: (msg, ctx) => telemetryInstance.debug(msg, ctx),
    info: (msg, ctx) => telemetryInstance.info(msg, ctx),
    warn: (msg, ctx) => telemetryInstance.warn(msg, ctx),
    error: (msg, err, ctx) => telemetryInstance.error(msg, err, ctx),
    fatal: (msg, err, ctx) => telemetryInstance.fatal(msg, err, ctx)
  };

})(typeof window !== 'undefined' ? window : this);
