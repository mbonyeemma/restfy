/**
 * API base for split deploy: static frontend + separate API server.
 * Before other scripts, or via your static host inject:
 *   <script>window.__RESTFY_API_BASE__ = 'https://your-api.example.com';</script>
 * Empty / unset = same origin (monorepo dev or reverse proxy).
 */
(function () {
  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  function getApiBase() {
    if (typeof window === 'undefined') return '';
    var w = window.__RESTFY_API_BASE__;
    if (w != null && String(w).trim() !== '') return trimSlash(w);
    return '';
  }

  window.getRestfyApiBase = getApiBase;
  window.restfyApiUrl = function (path) {
    var p = path.charAt(0) === '/' ? path : '/' + path;
    var base = getApiBase();
    return base ? base + p : p;
  };

  /** Web: cross-origin http(s) via server proxy. Electron: direct fetch. */
  window.restfyFetch = function (url, opts) {
    var isElectron = typeof window !== 'undefined' && window.electronAPI;
    if (!isElectron && typeof url === 'string' && url.indexOf('http') === 0) {
      return fetch(
        window.restfyApiUrl('/api/proxy') + '?' + new URLSearchParams({ url: url }),
        opts
      );
    }
    return fetch(url, opts);
  };
})();
