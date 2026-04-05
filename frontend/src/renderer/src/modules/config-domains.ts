/** Production split-deploy: browser UI on app.* talks to API on api.* */
export function initConfigDomains(): void {
  if (typeof window === 'undefined' || !window.location) return
  const h = String(window.location.hostname || '').toLowerCase()
  if (h === 'app.restify.online') {
    window.__RESTIFY_API_BASE__ = 'https://api.restify.online'
  }
}
