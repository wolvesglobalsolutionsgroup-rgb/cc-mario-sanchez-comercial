const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

console.log('=====================================================');
console.log('CCMS VERIFICATION SUITE - DIRECTIVES REMEDIATION');
console.log('=====================================================');

async function runAll() {
  // 1. HEREDEROS REMINDER & CENT DISTRIBUTION
  console.log('\n[1] TEST HEREDEROS CENT DISTRIBUTION & LEGAL AUDIT');
  {
    const c = {
      global: null,
      dbService: {
        getInvoices: () => [{ period_month: 1, period_year: 2026, status: 'pagado', total_usd: 100 }],
        getCondoExpenses: () => [],
        getSettings: () => ({ base_monthly_expenses_usd: 0, cuota_base_heredero_usd: 400 })
      }
    };
    c.global = c;
    vm.createContext(c);
    vm.runInContext(read('gestion/js/modules/herederos-manager.js'), c);
    const html = c.HerederosManager.renderReportHTML(1, 2026);
    const beneficiaryRows = (html.match(/<tr\b[\s\S]*?<\/tr>/g) || []).filter(r => r.includes('Doc / C.I.'));
    const displayed = beneficiaryRows.map(r => Number([...r.matchAll(/\$(\d+\.\d{2})/g)][1][1]));
    const sumOfDisplayedLines = displayed.reduce((a, v) => a + Math.round(v * 100), 0) / 100;
    console.log(' - Displayed per beneficiary:', displayed);
    console.log(' - Sum of displayed lines:', sumOfDisplayedLines);
    console.log(' - Report contains $100.00:', html.includes('$100.00'));
    console.log(' - Claims bank funds in text:', html.includes('fondos efectivamente percibidos en cuenta bancaria'));

    if (sumOfDisplayedLines !== 100.00) {
      throw new Error(`FAIL: sumOfDisplayedLines is ${sumOfDisplayedLines}, expected 100.00`);
    }
    if (html.includes('fondos efectivamente percibidos en cuenta bancaria')) {
      throw new Error('FAIL: still contains unverified bank ledger audit claim');
    }
    console.log(' -> PASS: Cent remainder distribution and legal audit claims verified.');
  }

  // 2. ACCESS MANAGEMENT & PERMISSION ENFORCEMENT
  console.log('\n[2] TEST ACCESS MANAGEMENT & ROLE PRIVILEGE ESCALATION');
  {
    const store = {};
    const a = {
      window: null,
      localStorage: {
        getItem: k => store[k] || null,
        setItem: (k, v) => store[k] = v,
        removeItem: k => delete store[k]
      },
      document: { getElementById: () => null }
    };
    a.window = a;
    vm.createContext(a);
    vm.runInContext(read('gestion/js/modules/access-management.js'), a);

    const before = a.AccessManagement.hasPermission('fiscal_auditor', 'payments', 'write');
    a.AccessManagement.togglePermission('fiscal_auditor', 'payments', 'write');
    const after = a.AccessManagement.hasPermission('fiscal_auditor', 'payments', 'write');
    console.log(' - fiscal_auditor write before toggle:', before);
    console.log(' - fiscal_auditor write after toggle (unauthenticated):', after);

    if (before !== false || after !== false) {
      throw new Error('FAIL: fiscal_auditor write was toggled or true!');
    }

    // Attempting write with simulated directiva session still blocks read-only roles
    a.AuthGuard = { getUserRole: () => 'org_director' };
    a.AccessManagement.togglePermission('fiscal_auditor', 'payments', 'write');
    const afterDirector = a.AccessManagement.hasPermission('fiscal_auditor', 'payments', 'write');
    console.log(' - fiscal_auditor write after toggle (with director session):', afterDirector);
    if (afterDirector !== false) {
      throw new Error('FAIL: fiscal_auditor write allowed even with director session!');
    }
    console.log(' -> PASS: AccessManagement immutability and authorization verified.');
  }

  // 3. GEMINI AUTHENTICATION BYPASS CONTAINMENT
  console.log('\n[3] TEST GEMINI AUTHENTICATION & DEMO TOKEN ENFORCEMENT');
  {
    const geminiHandler = require('../api/gemini.js');
    
    // Test unsigned demo request without Authorization header returns 401
    const mockRes = {
      setHeader(k, v) { return this; },
      status(s) { status = s; return this; },
      json(b) { body = b; return this; },
      writeHead(s, h) { status = s; return this; },
      end(b) { if (b) { try { body = JSON.parse(b); } catch (_) { body = b; } } return this; }
    };

    const reqUnsigned = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      url: '/api/gemini',
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify({ demo: true, prompt: 'Hello' }));
      }
    };

    await geminiHandler(reqUnsigned, mockRes);
    console.log(' - Unsigned request status:', status);
    console.log(' - Unsigned response body:', body);
    if (status !== 401) {
      throw new Error(`FAIL: expected 401 for unsigned demo, got ${status}`);
    }

    if (geminiHandler.signDemoToken) throw new Error('Legacy demo token issuer must be removed');
    console.log(' -> PASS: unsigned access rejected and legacy issuer removed.');
  }

  // 4. HTML SENSITIVE SEED REMOVAL & SYNTHETIC FIXTURE CONSUMPTION
  console.log('\n[4] TEST INDEX.HTML SEED DATA REMOVAL');
  {
    const indexHtml = read('gestion/index.html');
    const loadsRealSeed = indexHtml.includes('js/seed-data-39.js');
    const loadsSynthetic = indexHtml.includes('js/fixtures-synthetic.js');
    console.log(' - index.html loads seed-data-39.js:', loadsRealSeed);
    console.log(' - index.html loads fixtures-synthetic.js:', loadsSynthetic);

    if (loadsRealSeed) {
      throw new Error('FAIL: index.html still loads js/seed-data-39.js');
    }
    if (loadsSynthetic) {
      throw new Error('FAIL: index.html must not load demo fixtures in production');
    }

    // Check seed-data-39.js is sanitized
    const seed39 = read('gestion/js/seed-data-39.js');
    const containsRealNames = seed39.includes('MARIA AUXILIADORA') || seed39.includes('NARVAEZ');
    console.log(' - seed-data-39.js contains real tenant names:', containsRealNames);
    if (containsRealNames) {
      throw new Error('FAIL: seed-data-39.js still contains real tenant PII');
    }

    // Check synthetic fixtures has dedicated demo org ID
    const fixtures = read('gestion/js/fixtures-synthetic.js');
    const hasDemoOrg = fixtures.includes('d0000000-0000-0000-0000-000000000001');
    const usesProdOrgAsDemo = fixtures.includes('a0000000-0000-0000-0000-000000000001');
    console.log(' - fixtures-synthetic uses dedicated demo org ID (d000...):', hasDemoOrg);
    console.log(' - fixtures-synthetic uses prod org ID (a000...):', usesProdOrgAsDemo);
    if (!hasDemoOrg || usesProdOrgAsDemo) {
      throw new Error('FAIL: fixtures-synthetic must use dedicated demo org ID');
    }
    console.log(' -> PASS: Sensitive seed data removed and synthetic fixtures verified.');
  }

  // 5. SQL MIGRATION INTEGRITY & RPC SECURITY
  console.log('\n[5] TEST SQL MIGRATION SECURITY & COLUMN RECONCILIATION');
  {
    const sql = read('supabase/migrations/20260914000000_expand_identity_and_command_receipts.sql');
    
    const hasColumnReconciliation = sql.includes('ADD COLUMN IF NOT EXISTS verified_at') &&
                                    sql.includes('ADD COLUMN IF NOT EXISTS verified_by') &&
                                    sql.includes('ADD COLUMN IF NOT EXISTS version') &&
                                    sql.includes('ADD COLUMN IF NOT EXISTS paid_at');
    console.log(' - Reconciles missing columns:', hasColumnReconciliation);
    if (!hasColumnReconciliation) {
      throw new Error('FAIL: SQL migration does not reconcile missing columns');
    }

    // Check is_ccms_admin does NOT include fiscal_auditor or operations_manager
    const adminFuncMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.is_ccms_admin[\s\S]*?\$func\$;/);
    const adminFuncBody = adminFuncMatch ? adminFuncMatch[0] : '';
    const adminIncludesAuditor = adminFuncBody.includes('fiscal_auditor') || adminFuncBody.includes('operations_manager');
    console.log(' - is_ccms_admin() includes auditor/operations:', adminIncludesAuditor);
    if (adminIncludesAuditor) {
      throw new Error('FAIL: is_ccms_admin() incorrectly grants admin power to auditor/operations');
    }

    // Check RPC approve_payment_transaction authorization & validation
    const rpcMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.approve_payment_transaction[\s\S]*?\$\$;/);
    const rpcBody = rpcMatch ? rpcMatch[0] : '';
    const rpcChecksAuthUid = rpcBody.includes('auth.uid()');
    const rpcChecksRelationalMatch = rpcBody.includes('v_payment.invoice_id') && rpcBody.includes('p_invoice_id');
    const rpcChecksOrgMatch = rpcBody.includes('v_invoice.organization_id != v_org_id') || rpcBody.includes('CROSS_ORG_FORBIDDEN');
    const rpcHasExplicitGrants = sql.includes('REVOKE ALL ON FUNCTION public.approve_payment_transaction') &&
                                 sql.includes('GRANT EXECUTE ON FUNCTION public.approve_payment_transaction');

    const hasOverridesTable = sql.includes('CREATE TABLE IF NOT EXISTS public.membership_permission_overrides');
    const hasPlatformStaffTable = sql.includes('CREATE TABLE IF NOT EXISTS public.platform_staff');
    const hasMembershipBackfill = sql.includes('INSERT INTO public.organization_memberships') && sql.includes('FROM public.profiles');

    console.log(' - RPC checks auth.uid():', rpcChecksAuthUid);
    console.log(' - RPC validates payment.invoice_id = p_invoice_id:', rpcChecksRelationalMatch);
    console.log(' - RPC validates organization isolation:', rpcChecksOrgMatch);
    console.log(' - RPC has explicit REVOKE/GRANT permissions:', rpcHasExplicitGrants);
    console.log(' - Migration creates membership_permission_overrides:', hasOverridesTable);
    console.log(' - Migration creates platform_staff:', hasPlatformStaffTable);
    console.log(' - Migration backfills memberships from profiles:', hasMembershipBackfill);

    if (!rpcChecksAuthUid || !rpcChecksRelationalMatch || !rpcChecksOrgMatch || !rpcHasExplicitGrants || !hasOverridesTable || !hasPlatformStaffTable || !hasMembershipBackfill) {
      throw new Error('FAIL: SQL migration security checks or table declarations incomplete');
    }
    console.log(' -> PASS: SQL migration security, authorization, and schema reconciliation verified.');
  }

  // 6. ROLE NORMALIZATION ACROSS APP.JS AND AUTH-GUARD.JS
  console.log('\n[6] TEST ROLE NORMALIZATION (isTenantRole, org_director, accountant, etc.)');
  {
    const authGuardCode = read('gestion/js/auth-guard.js');
    const appCode = read('gestion/js/app.js');

    const authGuardHasTenantHelper = authGuardCode.includes('isTenantRole');
    const appHasTenantHelper = appCode.includes('function isTenantRole');
    const appSuperAdminIncludesOrgDirector = appCode.includes("currentRole === 'superadmin' || currentRole === 'org_director'");
    const appDirectivaIncludesEnterpriseRoles = appCode.includes("'org_director'") &&
                                                appCode.includes("'accountant'") &&
                                                appCode.includes("'fiscal_auditor'") &&
                                                appCode.includes("'operations_manager'") &&
                                                appCode.includes("'heir_viewer'");

    console.log(' - AuthGuard exports isTenantRole:', authGuardHasTenantHelper);
    console.log(' - app.js defines isTenantRole:', appHasTenantHelper);
    console.log(' - isSuperAdmin includes org_director:', appSuperAdminIncludesOrgDirector);
    console.log(' - isDirectiva includes all enterprise roles:', appDirectivaIncludesEnterpriseRoles);

    if (!authGuardHasTenantHelper || !appHasTenantHelper || !appSuperAdminIncludesOrgDirector || !appDirectivaIncludesEnterpriseRoles) {
      throw new Error('FAIL: role normalization incomplete');
    }
    console.log(' -> PASS: Role normalization across AuthGuard and app.js verified.');
  }

  console.log('\n=====================================================');
  console.log('ALL REMEDIATION CHECKS PASSED PERFECTLY!');
  console.log('=====================================================');
}

runAll().catch(err => {
  console.error('\nSUITE ERROR:', err.message);
  process.exit(1);
});
