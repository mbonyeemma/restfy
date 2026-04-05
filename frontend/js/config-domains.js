/**
 * Production split-deploy: browser UI on app.* talks to API on api.*
 * Electron / localhost leave __RESTIFY_API_BASE__ unset (direct / same-origin).
 */
(function () {
  if (typeof window === 'undefined' || !window.location) return;
  var h = String(window.location.hostname || '').toLowerCase();
  if (h === 'app.restify.online') {
    window.__RESTIFY_API_BASE__ = 'https://api.restify.online';
  }
})();
