/**
 * ==============================================================================
 * WOLVES GLOBAL SOLUTIONS - TENANT CONFIGURATION & WHITE-LABEL LOADER
 * Suite de Gestión Inmobiliaria & Cobranzas (v2.4 Enterprise)
 * ==============================================================================
 */

(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    tenant: {
      id: "cc-mario-sanchez",
      brandName: "Centro Comercial Mario Sánchez",
      shortName: "C.C. Mario Sánchez",
      legalName: "Inversiones y Servicios C.C. Mario Sánchez, C.A.",
      rif: "J-50123456-7",
      phone: "+58 281-2674400",
      email: "administracion@ccmariosanchez.com",
      address: "Av. Municipal cruce con Calle Sucre, Puerto La Cruz, Edo. Anzoátegui, Venezuela",
      city: "Puerto La Cruz",
      state: "Anzoátegui",
      country: "Venezuela",
      logoUrl: "logo_cc_mario_sanchez.svg",
      faviconUrl: "logo_cc_mario_sanchez.svg"
    },
    theme: {
      primaryColor: "#38bdf8",
      accentColor: "#f59e0b",
      mode: "dark"
    },
    finance: {
      baseCurrency: "USD",
      supportedCurrencies: ["USD", "VES", "EUR", "USDT"],
      graceDays: 5,
      lateFeePercent: 2.0,
      bcvFallbackRate: 82.50,
      eurFallbackRate: 89.20,
      usdtFallbackRate: 85.00
    },
    banking: [
      {
        id: "acc-default-1",
        bank: "Banesco Banco Universal",
        type: "Pago Móvil / Transferencia en Bolívares",
        account_number: "0134-0982-12-0987654321",
        ci_rif: "J-50123456-7",
        phone: "0424-7380002",
        holder: "C.C. Mario Sánchez, C.A.",
        currency: "VES",
        is_active: true,
        assigned_tenants: ["all"]
      },
      {
        id: "acc-default-2",
        bank: "Mercantil Banco",
        type: "Cuenta Corriente en Bolívares",
        account_number: "0105-0022-88-1009876543",
        ci_rif: "J-50123456-7",
        phone: "0414-8123456",
        holder: "C.C. Mario Sánchez, C.A.",
        currency: "VES",
        is_active: true,
        assigned_tenants: ["all"]
      },
      {
        id: "acc-default-3",
        bank: "Zelle Corporativo",
        type: "Custodia Internacional USD",
        account_number: "pagos@ccmariosanchez.com",
        ci_rif: "pagos@ccmariosanchez.com",
        phone: "",
        holder: "Mario Sanchez Management LLC",
        currency: "USD",
        is_active: true,
        assigned_tenants: ["all"]
      },
      {
        id: "acc-default-4",
        bank: "Binance Pay / Red TRON",
        type: "USDT Billetera Digital (TRC20)",
        account_number: "TXz9y8W7v6U5t4S3r2Q1p0OnMlKjIhGfEd",
        ci_rif: "USDT Vault",
        phone: "",
        holder: "Tesoreria C.C. Mario Sanchez",
        currency: "USDT",
        is_active: true,
        assigned_tenants: ["all"]
      }
    ],
    legal: {
      framework: "Gaceta Oficial N° 40.418 (Decreto Ley N° 929)",
      depositMonthsMax: 3,
      fixedRentMethod: "CAF (Canon Fijo Art. 32)",
      arbitrationCity: "Puerto La Cruz, Estado Anzoátegui"
    }
  };

  class TenantManager {
    constructor() {
      this.config = DEFAULT_CONFIG;
      this.isLoaded = false;
    }

    async init() {
      try {
        const res = await fetch('tenant_config.json?v=' + Date.now());
        if (res.ok) {
          const remoteConfig = await res.json();
          this.config = this.deepMerge(this.config, remoteConfig);
        }
      } catch (e) {
        console.info('[TENANT] Usando configuración de marca predeterminada.');
      }
      this.isLoaded = true;
      this.applyToDOM();
      this.syncSupabaseConfig();
      return this.config;
    }

    deepMerge(target, source) {
      const output = Object.assign({}, target);
      if (this.isObject(target) && this.isObject(source)) {
        Object.keys(source).forEach(key => {
          if (this.isObject(source[key])) {
            if (!(key in target)) Object.assign(output, { [key]: source[key] });
            else output[key] = this.deepMerge(target[key], source[key]);
          } else {
            Object.assign(output, { [key]: source[key] });
          }
        });
      }
      return output;
    }

    isObject(item) {
      return (item && typeof item === 'object' && !Array.isArray(item));
    }

    get(path, fallback = null) {
      const keys = path.split('.');
      let current = this.config;
      for (const k of keys) {
        if (current && current[k] !== undefined) {
          current = current[k];
        } else {
          return fallback;
        }
      }
      return current;
    }

    getBrandName() { return this.get('tenant.brandName', 'Centro Comercial'); }
    getShortName() { return this.get('tenant.shortName', 'C.C.'); }
    getLegalName() { return this.get('tenant.legalName', 'Administración Comercial C.A.'); }
    getRif() { return this.get('tenant.rif', 'J-00000000-0'); }
    getAddress() { return this.get('tenant.address', 'Venezuela'); }
    getPhone() { return this.get('tenant.phone', ''); }
    getEmail() { return this.get('tenant.email', ''); }
    getBankingList() { return this.get('banking', []); }
    getLegalFramework() { return this.get('legal.framework', 'Gaceta Oficial N° 40.418'); }

    applyToDOM() {
      // 1. Título de página
      const brand = this.getBrandName();
      if (document.title && !document.title.includes(brand)) {
        document.title = `${brand} — Sistema de Gestión Inmobiliaria`;
      }

      // 2. Textos dinámicos en DOM
      document.querySelectorAll('[data-tenant-brand]').forEach(el => el.textContent = brand);
      document.querySelectorAll('[data-tenant-short]').forEach(el => el.textContent = this.getShortName());
      document.querySelectorAll('[data-tenant-rif]').forEach(el => el.textContent = this.getRif());
      document.querySelectorAll('[data-tenant-legal]').forEach(el => el.textContent = this.getLegalName());
      document.querySelectorAll('[data-tenant-address]').forEach(el => el.textContent = this.getAddress());
      document.querySelectorAll('[data-tenant-phone]').forEach(el => el.textContent = this.getPhone());
      document.querySelectorAll('[data-tenant-email]').forEach(el => el.textContent = this.getEmail());

      // 3. Logos e imágenes
      const logoUrl = this.get('tenant.logoUrl');
      if (logoUrl) {
        document.querySelectorAll('[data-tenant-logo]').forEach(el => {
          if (el.tagName === 'IMG') el.src = logoUrl;
        });
      }
    }

    syncSupabaseConfig() {
      const sbUrl = this.get('supabase.url');
      const sbKey = this.get('supabase.anonKey');
      if (sbUrl && sbKey) {
        localStorage.setItem('ccms_supabase_url', sbUrl);
        localStorage.setItem('ccms_supabase_key', sbKey);
      }
    }
  }

  window.TenantConfig = new TenantManager();
  // Inicializar al cargar DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.TenantConfig.init());
  } else {
    window.TenantConfig.init();
  }
})();
