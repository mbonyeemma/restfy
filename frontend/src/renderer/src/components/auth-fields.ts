/**
 * Reusable auth field rendering.
 * Used by both the request auth panel (idPrefix='auth')
 * and the folder/collection settings editor (idPrefix='folderAuth').
 */
import { escHtml } from '../modules/utils'

export interface AuthData {
  type?: string
  token?: string
  username?: string
  password?: string
  key?: string
  value?: string
  addTo?: string
  tokenUrl?: string
  clientId?: string
  clientSecret?: string
  scope?: string
  grant?: string
}

interface AuthFieldsOptions {
  /** Info HTML shown for "inherit" type */
  inheritedInfo?: string
  /** Whether to show the "Add to" field for API Key (only for per-request auth) */
  showAddTo?: boolean
  /** Whether to show the OAuth2 section (only for per-request auth) */
  showOAuth2?: boolean
}

export function renderAuthFields(
  container: HTMLElement,
  type: string,
  authData: AuthData,
  idPrefix: string = 'auth',
  opts: AuthFieldsOptions = {}
): void {
  const { inheritedInfo, showAddTo = true, showOAuth2 = true } = opts
  container.innerHTML = ''

  if (type === 'inherit') {
    container.innerHTML = inheritedInfo
      ? `<div class="auth-inherit-info">${inheritedInfo}</div>`
      : `<div class="auth-inherit-info">No parent auth to inherit.</div>`
    return
  }

  if (type === 'bearer') {
    container.innerHTML = `
      <div>
        <label class="auth-field-label">Token</label>
        <input type="text" class="auth-input" id="${idPrefix}Token"
          placeholder="Bearer token..." value="${escHtml(authData?.token || '')}">
      </div>`
    return
  }

  if (type === 'basic' || type === 'digest') {
    container.innerHTML = `
      <div>
        <label class="auth-field-label">Username</label>
        <input type="text" class="auth-input" id="${idPrefix}User"
          placeholder="username" value="${escHtml(authData?.username || '')}">
      </div>
      <div>
        <label class="auth-field-label">Password</label>
        <input type="password" class="auth-input" id="${idPrefix}Pass"
          placeholder="password" value="${escHtml(authData?.password || '')}">
      </div>`
    return
  }

  if (type === 'apikey') {
    container.innerHTML = `
      <div>
        <label class="auth-field-label">Key</label>
        <input type="text" class="auth-input" id="${idPrefix}Key"
          placeholder="X-API-Key" value="${escHtml(authData?.key || 'X-API-Key')}">
      </div>
      <div>
        <label class="auth-field-label">Value</label>
        <input type="text" class="auth-input" id="${idPrefix}Value"
          placeholder="your-api-key" value="${escHtml(authData?.value || '')}">
      </div>
      ${showAddTo ? `
      <div>
        <label class="auth-field-label">Add to</label>
        <select class="auth-input" id="${idPrefix}AddTo">
          <option value="header" ${(authData?.addTo || 'header') === 'header' ? 'selected' : ''}>Header</option>
          <option value="query" ${authData?.addTo === 'query' ? 'selected' : ''}>Query Params</option>
        </select>
      </div>` : ''}`
    return
  }

  if (type === 'oauth2' && showOAuth2) {
    container.innerHTML = `
      <div>
        <label class="auth-field-label">Grant Type</label>
        <select class="auth-input" id="oauth2Grant">
          <option value="client_credentials" ${(authData?.grant || 'client_credentials') === 'client_credentials' ? 'selected' : ''}>Client Credentials</option>
          <option value="authorization_code" ${authData?.grant === 'authorization_code' ? 'selected' : ''}>Authorization Code</option>
          <option value="password" ${authData?.grant === 'password' ? 'selected' : ''}>Password</option>
          <option value="implicit" ${authData?.grant === 'implicit' ? 'selected' : ''}>Implicit</option>
        </select>
      </div>
      <div>
        <label class="auth-field-label">Token URL</label>
        <input type="text" class="auth-input" id="oauth2TokenUrl" value="${escHtml(authData?.tokenUrl || '')}">
      </div>
      <div>
        <label class="auth-field-label">Client ID</label>
        <input type="text" class="auth-input" id="oauth2ClientId" value="${escHtml(authData?.clientId || '')}">
      </div>
      <div>
        <label class="auth-field-label">Client Secret</label>
        <input type="text" class="auth-input" id="oauth2ClientSecret" value="${escHtml(authData?.clientSecret || '')}">
      </div>
      <div>
        <label class="auth-field-label">Scope</label>
        <input type="text" class="auth-input" id="oauth2Scope" value="${escHtml(authData?.scope || '')}">
      </div>
      <button class="btn-primary" style="margin-top:8px" onclick="fetchOAuth2Token()">Get Token</button>
      <div id="oauth2TokenResult" style="margin-top:8px"></div>`
  }
}

export function readAuthFields(idPrefix: string = 'auth'): AuthData {
  const sel = document.getElementById(`${idPrefix}Type`) as HTMLSelectElement | null
  const type = sel?.value || 'none'
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value || ''
  const selVal = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value || ''

  if (type === 'bearer') return { type, token: val(`${idPrefix}Token`) }
  if (type === 'basic') return { type, username: val(`${idPrefix}User`), password: val(`${idPrefix}Pass`) }
  if (type === 'digest') return { type, username: val(`${idPrefix}User`), password: val(`${idPrefix}Pass`) }
  if (type === 'apikey') return {
    type,
    key: val(`${idPrefix}Key`) || 'X-API-Key',
    value: val(`${idPrefix}Value`),
    addTo: selVal(`${idPrefix}AddTo`) || 'header'
  }
  if (type === 'oauth2') return {
    type,
    grant: selVal('oauth2Grant') || 'client_credentials',
    tokenUrl: val('oauth2TokenUrl'),
    clientId: val('oauth2ClientId'),
    clientSecret: val('oauth2ClientSecret'),
    scope: val('oauth2Scope'),
    token: (document.getElementById('oauth2TokenResult') as any)?.dataset?.token || ''
  }
  if (type === 'inherit') return { type: 'inherit' }
  return { type: 'none' }
}

/** Human-readable label for an auth type string */
export function authTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    bearer: 'Bearer Token',
    basic: 'Basic Auth',
    apikey: 'API Key',
    oauth2: 'OAuth 2.0',
    digest: 'Digest Auth',
    inherit: 'Inherit',
    none: 'No Auth'
  }
  return labels[t] || t || 'No Auth'
}
