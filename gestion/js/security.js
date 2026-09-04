/* Utilidades de seguridad compartidas por las vistas del ERP. */
(function (global) {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function isSafeReceiptDataUrl(value) {
    return typeof value === 'string' && /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,/i.test(value);
  }

  global.escapeHtml = escapeHtml;
  global.isSafeReceiptDataUrl = isSafeReceiptDataUrl;
})(window);
