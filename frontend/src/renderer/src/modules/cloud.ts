import { state, saveState } from './state'
import { escHtml, showNotif, appPrompt } from './utils'

const CLOUD_DEFAULT = 'https://api.restify.online'
const LS_CLOUD_SESSION = 'restify_cloud_session'
const LS_CLOUD_SESSION_LEGACY = 'restfy_cloud_session'
const LS_CLOUD_URL = 'restify_cloud_url'
const LS_CLOUD_URL_LEGACY = 'restfy_cloud_url'

function cloudBase(): string {
  const u = localStorage.getItem(LS_CLOUD_URL) || localStorage.getItem(LS_CLOUD_URL_LEGACY)
  const t = u && String(u).trim()
  if (t) return String(t).replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const w = window.__RESTIFY_API_BASE__ ?? window.__RESTFY_API_BASE__
    if (w != null && String(w).trim() !== '') return String(w).trim().replace(/\/+$/, '')
  }
  return String(CLOUD_DEFAULT).replace(/\/+$/, '')
}

function cloudApiUrl(path: string): string {
  const p = path.charAt(0) === '/' ? path : '/' + path
  return cloudBase() + p
}

async function _cloudReadJson(resp: Response): Promise<any> {
  const text = await resp.text()
  const trimmed = text.trimStart()
  if (!trimmed || trimmed.startsWith('<')) {
    throw new Error(
      'Server returned a web page instead of JSON. Use the API base only (e.g. https://api.restify.online), not the web app URL.'
    )
  }
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON from server.')
  }
  if (!resp.ok) throw new Error(data.error || data.message || 'Request failed')
  return data
}

let _cloudUser: any = null
let _cloudToken: string | null = null
let _syncInProgress = false
let _lastSyncAt = 0

export function isCloudLoggedIn(): boolean {
  return !!_cloudToken
}

function _cloudHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_cloudToken) h['Authorization'] = 'Bearer ' + _cloudToken
  return h
}

function _loadCloudSession(): void {
  try {
    const s = localStorage.getItem(LS_CLOUD_SESSION) || localStorage.getItem(LS_CLOUD_SESSION_LEGACY)
    if (s) {
      const parsed = JSON.parse(s)
      _cloudUser = parsed.user
      _cloudToken = parsed.token
      _lastSyncAt = parsed.lastSyncAt || 0
    }
  } catch {}
}

function _saveCloudSession(): void {
  if (_cloudUser && _cloudToken) {
    localStorage.setItem(
      LS_CLOUD_SESSION,
      JSON.stringify({ user: _cloudUser, token: _cloudToken, lastSyncAt: _lastSyncAt })
    )
    localStorage.removeItem(LS_CLOUD_SESSION_LEGACY)
  } else {
    localStorage.removeItem(LS_CLOUD_SESSION)
    localStorage.removeItem(LS_CLOUD_SESSION_LEGACY)
  }
}

export function getCloudUser(): any {
  return _cloudUser
}

export async function cloudRegister(email: string, password: string, name: string): Promise<any> {
  const resp = await fetch(cloudApiUrl('/api/auth/register'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  })
  const data = await _cloudReadJson(resp)
  _cloudUser = data.user
  _cloudToken = data.token
  _saveCloudSession()
  return data
}

export async function cloudLogin(email: string, password: string): Promise<any> {
  const resp = await fetch(cloudApiUrl('/api/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const data = await _cloudReadJson(resp)
  _cloudUser = data.user
  _cloudToken = data.token
  _saveCloudSession()
  return data
}

export async function cloudLogout(): Promise<void> {
  try {
    await fetch(cloudApiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
  } catch (_) {}
  _cloudUser = null
  _cloudToken = null
  _lastSyncAt = 0
  _saveCloudSession()
  renderCloudStatus()
  // Reset banner to "My Workspace" but keep it visible
  const nameEl = document.getElementById('workspaceBannerNameText')
  if (nameEl) nameEl.textContent = 'My Workspace'
}

export async function cloudSync(): Promise<void> {
  if (!_cloudToken || _syncInProgress) return
  _syncInProgress = true
  renderCloudStatus()

  try {
    const colResp = await fetch(cloudApiUrl('/api/collections/sync'), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ collections: state.collections, lastSyncAt: _lastSyncAt })
    })
    if (colResp.status === 401) {
      void cloudLogout()
      throw new Error('Session expired')
    }
    const colData = await _cloudReadJson(colResp)

    const envResp = await fetch(cloudApiUrl('/api/environments/sync'), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ environments: state.environments, globalVars: state.globalVars })
    })
    const envData = await _cloudReadJson(envResp)

    if (colData.collections) {
      state.collections.length = 0
      colData.collections.forEach((c: any) => {
        delete c._syncedAt
        state.collections.push(c)
      })
    }
    if (envData.environments) {
      state.environments.length = 0
      envData.environments.forEach((e: any) => {
        delete e._syncedAt
        state.environments.push(e)
      })
    }
    if (envData.globalVars) {
      state.globalVars.length = 0
      envData.globalVars.forEach((v: any) => state.globalVars.push(v))
    }

    _lastSyncAt = colData.syncedAt || Math.floor(Date.now() / 1000)
    _saveCloudSession()
    saveState()
    if (typeof (window as any).renderSidebar === 'function') (window as any).renderSidebar()
    if (typeof (window as any).renderEnvSelector === 'function') (window as any).renderEnvSelector()
    showNotif('Synced with cloud', 'success')
  } catch (err: any) {
    showNotif('Sync error: ' + err.message, 'error')
  } finally {
    _syncInProgress = false
    renderCloudStatus()
  }
}

function _renderSidebarCloudLink(): void {
  const side = document.getElementById('sidebarCloudLink')
  if (!side) return
  if (!_cloudToken) {
    side.innerHTML =
      '<button type="button" class="sidebar-cloud-btn" onclick="openCloudModal()" title="Restify Cloud">☁ Cloud · Sign in</button>'
    return
  }
  const initial = (_cloudUser?.name || _cloudUser?.email || '?').charAt(0).toUpperCase()
  side.innerHTML = `<button type="button" class="sidebar-cloud-btn sidebar-cloud-btn--in" onclick="openCloudModal()" title="${escHtml(_cloudUser?.email || '')}">☁ ${initial}</button>`
}

export async function cloudForgotPassword(): Promise<void> {
  const email = await appPrompt(
    'Forgot password',
    'If this email is registered, we will send you a reset link.',
    { placeholder: 'you@example.com', okLabel: 'Send link' }
  )
  if (!email?.trim()) return
  try {
    const resp = await fetch(cloudApiUrl('/api/auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    const data = (await resp.json()) as { message?: string }
    showNotif(data.message || 'Check your email inbox.', 'success')
  } catch {
    showNotif('Could not send request. Try again later.', 'error')
  }
}

/** Handle `?resetPassword=token` from email link (strip query, prompt for new password). */
export async function maybeOpenPasswordResetFromUrl(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(window.location.href)
    const t = u.searchParams.get('resetPassword')
    if (!t) return
    u.searchParams.delete('resetPassword')
    window.history.replaceState({}, '', u.pathname + u.search + u.hash)
    const p1 = await appPrompt('New password', 'Choose a password (at least 6 characters).', {
      inputType: 'password',
      okLabel: 'Continue',
    })
    if (!p1 || p1.length < 6) {
      showNotif('Password must be at least 6 characters', 'error')
      return
    }
    const p2 = await appPrompt('Confirm password', 'Enter the same password again.', {
      inputType: 'password',
      okLabel: 'Reset password',
    })
    if (!p2) return
    if (p1 !== p2) {
      showNotif('Passwords do not match', 'error')
      return
    }
    const resp = await fetch(cloudApiUrl('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t, newPassword: p1 }),
    })
    const data = (await resp.json().catch(() => ({}))) as { error?: string }
    if (!resp.ok) {
      showNotif(data.error || 'Reset failed', 'error')
      return
    }
    showNotif('Password updated — you can sign in.', 'success')
    openCloudModal()
  } catch {
    showNotif('Reset failed', 'error')
  }
}

export function renderCloudStatus(): void {
  const el = document.getElementById('cloudStatusArea')
  if (el) {
    if (!_cloudToken) {
      el.innerHTML =
        '<button class="cloud-login-btn" onclick="openCloudModal()" title="Restify Cloud">Sign in</button>'
    } else {
      const initial = (_cloudUser.name || _cloudUser.email || '?').charAt(0).toUpperCase()
      el.innerHTML = `
    <div class="cloud-status-pill" onclick="openCloudModal()" title="${escHtml(_cloudUser.email)}">
      <span class="cloud-avatar">${initial}</span>
      <span class="cloud-sync-icon ${_syncInProgress ? 'spinning' : ''}">↻</span>
    </div>
  `
    }
  }
  _renderSidebarCloudLink()
}

export function openCloudModal(): void {
  if (_cloudToken) _renderCloudAccountView()
  else _renderCloudLoginView()
  document.getElementById('cloudModal')?.classList.add('open')
}

export function closeCloudModal(): void {
  document.getElementById('cloudModal')?.classList.remove('open')
}

function _renderCloudLoginView(): void {
  const body = document.getElementById('cloudModalBody')
  if (!body) return
  body.innerHTML = `
    <div class="cloud-tabs">
      <button class="cloud-tab-btn active" id="cloudTabLogin" onclick="_switchCloudTab('login')">Sign In</button>
      <button class="cloud-tab-btn" id="cloudTabRegister" onclick="_switchCloudTab('register')">Create Account</button>
    </div>
    <div id="cloudTabContent">
      <div class="cloud-form">
        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="cloudEmail" placeholder="you@example.com" autocomplete="email"></div>
        <div class="form-group"><label class="form-label">Password</label><input type="password" class="form-input" id="cloudPassword" placeholder="••••••" autocomplete="current-password"></div>
        <div style="text-align:right;margin:-6px 0 8px"><button type="button" class="btn-text" style="font-size:12px;padding:0" onclick="cloudForgotPassword()">Forgot password?</button></div>
        <div id="cloudNameGroup" class="form-group" style="display:none"><label class="form-label">Name</label><input type="text" class="form-input" id="cloudName" placeholder="Your name" autocomplete="name"></div>
        <div id="cloudError" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
        <button class="btn-primary" style="width:100%;padding:10px" id="cloudSubmitBtn" onclick="_submitCloudAuth()">Sign In</button>
      </div>
    </div>
  `
  setTimeout(() => (document.getElementById('cloudEmail') as HTMLElement)?.focus(), 100)
}

let _cloudAuthMode = 'login'

export function _switchCloudTab(mode: string): void {
  _cloudAuthMode = mode
  document.getElementById('cloudTabLogin')?.classList.toggle('active', mode === 'login')
  document.getElementById('cloudTabRegister')?.classList.toggle('active', mode === 'register')
  const nameGroup = document.getElementById('cloudNameGroup') as HTMLElement
  if (nameGroup) nameGroup.style.display = mode === 'register' ? 'block' : 'none'
  const submitBtn = document.getElementById('cloudSubmitBtn') as HTMLButtonElement
  if (submitBtn) submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account'
  const errEl = document.getElementById('cloudError') as HTMLElement
  if (errEl) errEl.style.display = 'none'
}

export async function _submitCloudAuth(): Promise<void> {
  const email = (document.getElementById('cloudEmail') as HTMLInputElement).value.trim()
  const password = (document.getElementById('cloudPassword') as HTMLInputElement).value
  const nameEl = document.getElementById('cloudName') as HTMLInputElement | null
  const name = nameEl?.value?.trim() || ''
  const errEl = document.getElementById('cloudError') as HTMLElement

  if (!email || !password) {
    errEl.textContent = 'Email and password are required'
    errEl.style.display = 'block'
    return
  }

  const btn = document.getElementById('cloudSubmitBtn') as HTMLButtonElement
  btn.disabled = true
  btn.textContent = 'Please wait...'

  try {
    if (_cloudAuthMode === 'register') {
      await cloudRegister(email, password, name)
    } else {
      await cloudLogin(email, password)
    }
    closeCloudModal()
    renderCloudStatus()
    cloudSync()
    if (typeof (window as any).initWorkspaceBanner === 'function') {
      void (window as any).initWorkspaceBanner()
    }
  } catch (err: any) {
    errEl.textContent = err.message
    errEl.style.display = 'block'
  } finally {
    btn.disabled = false
    btn.textContent = _cloudAuthMode === 'login' ? 'Sign In' : 'Create Account'
  }
}

function _renderCloudAccountView(): void {
  const body = document.getElementById('cloudModalBody')
  if (!body) return
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div class="cloud-avatar-large">${(_cloudUser.name || _cloudUser.email || '?').charAt(0).toUpperCase()}</div>
      <div style="font-size:16px;font-weight:600;margin-top:8px">${escHtml(_cloudUser.name || 'Restify User')}</div>
      <div style="font-size:13px;color:var(--text-dim)">${escHtml(_cloudUser.email)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn-primary" style="width:100%" onclick="cloudSync(); closeCloudModal();">↻ Sync Now</button>
      <button class="btn-secondary" style="width:100%" onclick="closeCloudModal(); openTeamsModal();">👥 Teams</button>
      <button class="btn-secondary" style="width:100%" onclick="_cloudAutoSync()">Enable Auto-Sync</button>
      <div style="border-top:1px solid var(--border);margin:8px 0"></div>
      <button class="btn-secondary" style="width:100%;color:var(--red);border-color:var(--red)" onclick="cloudLogout(); closeCloudModal();">Sign Out</button>
    </div>
    <div style="margin-top:16px;font-size:11px;color:var(--text-dim);text-align:center">
      Last synced: ${_lastSyncAt ? new Date(_lastSyncAt * 1000).toLocaleString() : 'Never'}
    </div>
  `
}

let _autoSyncInterval: ReturnType<typeof setInterval> | null = null

export function _cloudAutoSync(): void {
  if (_autoSyncInterval) {
    clearInterval(_autoSyncInterval)
    _autoSyncInterval = null
    showNotif('Auto-sync disabled', 'info')
    return
  }
  _autoSyncInterval = setInterval(() => {
    if (_cloudToken) cloudSync()
  }, 60000)
  showNotif('Auto-sync enabled (every 60s)', 'success')
}

_loadCloudSession()
