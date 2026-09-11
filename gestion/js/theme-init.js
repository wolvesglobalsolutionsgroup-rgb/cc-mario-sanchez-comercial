/**
 * CCMS - Theme Initializer
 * Version: 4.2.1-stable (Pure Clean Release)
 */
(function() {
  try {
    const savedTheme = localStorage.getItem('ccms_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.className = savedTheme;
    // Limpieza de cualquier residuo de pruebas anteriores
    localStorage.removeItem('ccms_seeded_v1');
  } catch(e) {}
})();


