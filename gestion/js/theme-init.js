/**
 * CCMS - Theme Initializer
 * Version: 4.2.0-stable (Pure Clean Release)
 */
(function() {
  const savedTheme = localStorage.getItem('ccms_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.documentElement.className = savedTheme;
})();

