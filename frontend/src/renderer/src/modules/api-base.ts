/**
 * API base for split deploy (e.g. app at https://app.restify.online, API at https://api.restify.online).
 * Production: config-domains sets __RESTIFY_API_BASE__ on app.restify.online.
 * Override manually: window.__RESTIFY_API_BASE__ = 'https://api.restify.online'
 * Empty / unset = same origin (Electron, localhost, or reverse proxy).
 */

function trimSlash(s: string): string {
  return String(s || '').replace(/\/+$/, '')
}

function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  const w = window.__RESTIFY_API_BASE__
  if (w != null && String(w).trim() !== '') return trimSlash(w)
  const leg = window.__RESTFY_API_BASE__
  if (leg != null && String(leg).trim() !== '') return trimSlash(leg)
  return ''
}

export function initApiBase(): void {
  window.getRestifyApiBase = getApiBase

  window.restifyApiUrl = function (path: string): string {
    const p = path.charAt(0) === '/' ? path : '/' + path
    const base = getApiBase()
    return base ? base + p : p
  }

  /** Web: cross-origin http(s) via server proxy. Electron: direct fetch. */
  window.restifyFetch = function (url: string, opts?: RequestInit): Promise<Response> {
    const isElectron = typeof window !== 'undefined' && window.electronAPI
    if (!isElectron && typeof url === 'string' && url.indexOf('http') === 0) {
      return fetch(
        window.restifyApiUrl('/api/proxy') + '?' + new URLSearchParams({ url }),
        opts
      )
    }
    return fetch(url, opts)
  }
}
