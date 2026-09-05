(function() {
  const savedTheme = localStorage.getItem('ccms_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.documentElement.className = savedTheme;
})();
