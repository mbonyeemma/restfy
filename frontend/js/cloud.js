// ═══════════════════════════════════════════
// CLOUD SYNC — Auth, sync, and account mgmt
// ═══════════════════════════════════════════

const CLOUD_DEFAULT = 'https://api.restify.online/';
const LS_CLOUD_SESSION = 'restify_cloud_session';
const LS_CLOUD_SESSION_LEGACY = 'restfy_cloud_session';
const LS_CLOUD_URL = 'restify_cloud_url';
const LS_CLOUD_URL_LEGACY = 'restfy_cloud_url';

function cloudBase() {
  const u =
    localStorage.getItem(LS_CLOUD_URL) ||
    localStorage.getItem(LS_CLOUD_URL_LEGACY);
  const t = u && String(u).trim();
  return t || CLOUD_DEFAULT;
}

let _cloudUser = null;
let _cloudToken = null;
let _syncInProgress = false;
let _lastSyncAt = 0;

function _cloudHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (_cloudToken) h['Authorization'] = 'Bearer ' + _cloudToken;
  return h;
}

function _loadCloudSession() {
  try {
    const s =
      localStorage.getItem(LS_CLOUD_SESSION) ||
      localStorage.getItem(LS_CLOUD_SESSION_LEGACY);
    if (s) {
      const parsed = JSON.parse(s);
      _cloudUser = parsed.user;
      _cloudToken = parsed.token;
      _lastSyncAt = parsed.lastSyncAt || 0;
    }
  } catch {}
}

function _saveCloudSession() {
  if (_cloudUser && _cloudToken) {
    localStorage.setItem(
      LS_CLOUD_SESSION,
      JSON.stringify({
        user: _cloudUser,
        token: _cloudToken,
        lastSyncAt: _lastSyncAt
      })
    );
    localStorage.removeItem(LS_CLOUD_SESSION_LEGACY);
  } else {
    localStorage.removeItem(LS_CLOUD_SESSION);
    localStorage.removeItem(LS_CLOUD_SESSION_LEGACY);
  }
}

function isCloudLoggedIn() {
  return !!_cloudToken;
}

function getCloudUser() {
  return _cloudUser;
}

async function cloudRegister(email, password, name) {
  const resp = await fetch(cloudBase() + '/api/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Registration failed');
  _cloudUser = data.user;
  _cloudToken = data.token;
  _saveCloudSession();
  return data;
}

async function cloudLogin(email, password) {
  const resp = await fetch(cloudBase() + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Login failed');
  _cloudUser = data.user;
  _cloudToken = data.token;
  _saveCloudSession();
  return data;
}

async function cloudLogout() {
  try {
    await fetch(cloudBase() + '/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (_) {}
  _cloudUser = null;
  _cloudToken = null;
  _lastSyncAt = 0;
  _saveCloudSession();
  renderCloudStatus();
}

async function cloudSync() {
  if (!_cloudToken || _syncInProgress) return;
  _syncInProgress = true;
  renderCloudStatus();

  try {
    const colResp = await fetch(cloudBase() + '/api/collections/sync', {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ collections: collections, lastSyncAt: _lastSyncAt })
    });
    if (!colResp.ok) {
      if (colResp.status === 401) { void cloudLogout(); throw new Error('Session expired'); }
      throw new Error('Sync failed');
    }
    const colData = await colResp.json();

    const envResp = await fetch(cloudBase() + '/api/environments/sync', {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ environments: environments, globalVars: globalVars })
    });
    if (!envResp.ok) throw new Error('Environment sync failed');
    const envData = await envResp.json();

    if (colData.collections) {
      collections.length = 0;
      colData.collections.forEach(c => {
        delete c._syncedAt;
        collections.push(c);
      });
    }

    if (envData.environments) {
      environments.length = 0;
      envData.environments.forEach(e => {
        delete e._syncedAt;
        environments.push(e);
      });
    }

    if (envData.globalVars) {
      globalVars.length = 0;
      envData.globalVars.forEach(v => globalVars.push(v));
    }

    _lastSyncAt = colData.syncedAt || Math.floor(Date.now() / 1000);
    _saveCloudSession();
    saveState();
    renderSidebar();
    renderEnvSelector();
    showNotif('Synced with cloud', 'success');
  } catch (err) {
    showNotif('Sync error: ' + err.message, 'error');
  } finally {
    _syncInProgress = false;
    renderCloudStatus();
  }
}

function renderCloudStatus() {
  const el = document.getElementById('cloudStatusArea');
  if (!el) return;

  if (!_cloudToken) {
    el.innerHTML = '<button class="cloud-login-btn" onclick="openCloudModal()">Sign in</button>';
    return;
  }

  const initial = (_cloudUser.name || _cloudUser.email || '?').charAt(0).toUpperCase();
  el.innerHTML = `
    <div class="cloud-status-pill" onclick="openCloudModal()" title="${escHtml(_cloudUser.email)}">
      <span class="cloud-avatar">${initial}</span>
      <span class="cloud-sync-icon ${_syncInProgress ? 'spinning' : ''}">\u{21BB}</span>
    </div>
  `;
}

function openCloudModal() {
  if (_cloudToken) {
    _renderCloudAccountView();
  } else {
    _renderCloudLoginView();
  }
  document.getElementById('cloudModal').classList.add('open');
}

function closeCloudModal() {
  document.getElementById('cloudModal').classList.remove('open');
}

function _renderCloudLoginView() {
  const body = document.getElementById('cloudModalBody');
  body.innerHTML = `
    <div class="cloud-tabs">
      <button class="cloud-tab-btn active" id="cloudTabLogin" onclick="_switchCloudTab('login')">Sign In</button>
      <button class="cloud-tab-btn" id="cloudTabRegister" onclick="_switchCloudTab('register')">Create Account</button>
    </div>
    <div id="cloudTabContent">
      <div class="cloud-form">
        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="cloudEmail" placeholder="you@example.com" autocomplete="email"></div>
        <div class="form-group"><label class="form-label">Password</label><input type="password" class="form-input" id="cloudPassword" placeholder="••••••" autocomplete="current-password"></div>
        <div id="cloudNameGroup" class="form-group" style="display:none"><label class="form-label">Name</label><input type="text" class="form-input" id="cloudName" placeholder="Your name" autocomplete="name"></div>
        <div id="cloudError" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
        <button class="btn-primary" style="width:100%;padding:10px" id="cloudSubmitBtn" onclick="_submitCloudAuth()">Sign In</button>
      </div>
      <div style="margin-top:16px;text-align:center">
        <div style="font-size:11px;color:var(--text-dim)">Server: <input type="text" id="cloudServerUrl" class="form-input" style="width:200px;display:inline;font-size:11px;padding:3px 6px" value="${escHtml(cloudBase())}" onchange="localStorage.setItem('${LS_CLOUD_URL}', this.value);localStorage.removeItem('${LS_CLOUD_URL_LEGACY}')"></div>
      </div>
    </div>
  `;
  setTimeout(() => document.getElementById('cloudEmail')?.focus(), 100);
}

let _cloudAuthMode = 'login';

function _switchCloudTab(mode) {
  _cloudAuthMode = mode;
  document.getElementById('cloudTabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('cloudTabRegister').classList.toggle('active', mode === 'register');
  document.getElementById('cloudNameGroup').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('cloudSubmitBtn').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  document.getElementById('cloudError').style.display = 'none';
}

async function _submitCloudAuth() {
  const email = document.getElementById('cloudEmail').value.trim();
  const password = document.getElementById('cloudPassword').value;
  const name = document.getElementById('cloudName')?.value?.trim() || '';
  const errEl = document.getElementById('cloudError');

  if (!email || !password) {
    errEl.textContent = 'Email and password are required';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('cloudSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Please wait...';

  try {
    if (_cloudAuthMode === 'register') {
      await cloudRegister(email, password, name);
    } else {
      await cloudLogin(email, password);
    }
    closeCloudModal();
    renderCloudStatus();
    cloudSync();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = _cloudAuthMode === 'login' ? 'Sign In' : 'Create Account';
  }
}

function _renderCloudAccountView() {
  const body = document.getElementById('cloudModalBody');
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div class="cloud-avatar-large">${(_cloudUser.name || _cloudUser.email || '?').charAt(0).toUpperCase()}</div>
      <div style="font-size:16px;font-weight:600;margin-top:8px">${escHtml(_cloudUser.name || 'Restify User')}</div>
      <div style="font-size:13px;color:var(--text-dim)">${escHtml(_cloudUser.email)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn-primary" style="width:100%" onclick="cloudSync(); closeCloudModal();">
        \u{21BB} Sync Now
      </button>
      <button class="btn-secondary" style="width:100%" onclick="_cloudAutoSync()">
        Enable Auto-Sync
      </button>
      <div style="border-top:1px solid var(--border);margin:8px 0"></div>
      <button class="btn-secondary" style="width:100%;color:var(--red);border-color:var(--red)" onclick="cloudLogout(); closeCloudModal();">
        Sign Out
      </button>
    </div>
    <div style="margin-top:16px;font-size:11px;color:var(--text-dim);text-align:center">
      Last synced: ${_lastSyncAt ? new Date(_lastSyncAt * 1000).toLocaleString() : 'Never'}
    </div>
  `;
}

let _autoSyncInterval = null;

function _cloudAutoSync() {
  if (_autoSyncInterval) {
    clearInterval(_autoSyncInterval);
    _autoSyncInterval = null;
    showNotif('Auto-sync disabled', 'info');
    return;
  }
  _autoSyncInterval = setInterval(() => {
    if (_cloudToken) cloudSync();
  }, 60000);
  showNotif('Auto-sync enabled (every 60s)', 'success');
}

_loadCloudSession();
