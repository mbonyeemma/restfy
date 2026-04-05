/**
 * API base for split deploy (e.g. app at https://app.restify.online, API at https://api.restify.online).
 * Production: js/config-domains.js sets __RESTIFY_API_BASE__ on app.restify.online.
 * Override manually:
 *   window.__RESTIFY_API_BASE__ = 'https://api.restify.online'
 * Legacy: window.__RESTFY_API_BASE__
 * Empty / unset = same origin (Electron, localhost, or reverse proxy).
 */
(function () {
  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  function getApiBase() {
    if (typeof window === 'undefined') return '';
    var w = window.__RESTIFY_API_BASE__;
    if (w != null && String(w).trim() !== '') return trimSlash(w);
    var leg = window.__RESTFY_API_BASE__;
    if (leg != null && String(leg).trim() !== '') return trimSlash(leg);
    return '';
  }

  window.getRestifyApiBase = getApiBase;
  window.restifyApiUrl = function (path) {
    var p = path.charAt(0) === '/' ? path : '/' + path;
    var base = getApiBase();
    return base ? base + p : p;
  };

  /** Web: cross-origin http(s) via server proxy. Electron: direct fetch. */
  window.restifyFetch = function (url, opts) {
    var isElectron = typeof window !== 'undefined' && window.electronAPI;
    if (!isElectron && typeof url === 'string' && url.indexOf('http') === 0) {
      return fetch(
        window.restifyApiUrl('/api/proxy') + '?' + new URLSearchParams({ url: url }),
        opts
      );
    }
    return fetch(url, opts);
  };
})();
