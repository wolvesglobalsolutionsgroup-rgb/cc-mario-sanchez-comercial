/**
 * ============================================================================
 * CCMS - MÓDULO DE GESTIÓN DE ENTORNO (PRODUCCIÓN VS DEMO)
 * Centro Comercial Mario Sánchez — Puerto La Cruz, Venezuela
 * Higiene Visual y Control de Estado de Ejecución
 * Arquitectura Desacoplada (Dimensión 9: Desmonolito)
 * ============================================================================
 */

(function(global) {
  'use strict';

  const EnvBadgeManager = {
    updateBadge() {
      const badge = document.getElementById('env-mode-badge');
      const text = document.getElementById('env-mode-text');
      const pulse = document.getElementById('env-mode-pulse');
      const banner = document.getElementById('demo-mode-alert-banner');
      const resetDemoBtn = document.getElementById('btn-header-reset-demo');

      const sess = (typeof global.AuthGuard !== 'undefined' && typeof global.AuthGuard.currentUser === 'function') 
        ? global.AuthGuard.currentUser() 
        : null;
      const isSupabaseAuth = sess && sess.is_supabase_auth;
      const isDemo = localStorage.getItem('CCMS_FORCE_DEMO') === 'true' || (!isSupabaseAuth && global.CCMS_DEMO_MODE !== false);
      const currentRole = global.currentRole || (sess && sess.role) || 'admin';

      if (isSupabaseAuth && !isDemo) {
        if (badge) badge.style.display = 'none';
        if (banner) banner.style.display = 'none';
        if (resetDemoBtn) resetDemoBtn.style.display = 'none';
      } else {
        if (badge) {
          badge.style.display = 'inline-flex';
          badge.style.cursor = 'default';
          if (text) text.textContent = 'Modo Demo';
          if (pulse) {
            pulse.style.background = '#f59e0b';
            pulse.style.boxShadow = '0 0 6px #f59e0b';
          }
        }
        if (banner) banner.style.display = 'flex';
        if (resetDemoBtn) resetDemoBtn.style.display = (currentRole === 'admin' ? 'inline-flex' : 'none');
      }
    },

    setMode(mode) {
      if (mode === 'demo') {
        localStorage.setItem('CCMS_FORCE_DEMO', 'true');
      } else {
        localStorage.setItem('CCMS_FORCE_DEMO', 'false');
      }
      global.location.reload();
    },

    toggleModal() {},
    closeModal() {}
  };

  // Exposición en espacio de nombres y funciones globales
  global.EnvBadgeManager = EnvBadgeManager;
  global.updateEnvironmentBadge = () => EnvBadgeManager.updateBadge();
  global.setEnvironmentMode = (m) => EnvBadgeManager.setMode(m);
  global.toggleEnvironmentModal = () => EnvBadgeManager.toggleModal();
  global.closeEnvironmentModal = () => EnvBadgeManager.closeModal();

  // Auto-ejecución al cargar
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => EnvBadgeManager.updateBadge());
    } else {
      EnvBadgeManager.updateBadge();
    }
  }

})(typeof window !== 'undefined' ? window : global);
