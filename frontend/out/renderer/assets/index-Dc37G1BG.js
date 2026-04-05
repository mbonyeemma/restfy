function initConfigDomains() {
  if (typeof window === "undefined" || !window.location) return;
  const h = String(window.location.hostname || "").toLowerCase();
  if (h === "app.restify.online") {
    window.__RESTIFY_API_BASE__ = "https://api.restify.online";
  }
}
function trimSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}
function getApiBase() {
  if (typeof window === "undefined") return "";
  const w = window.__RESTIFY_API_BASE__;
  if (w != null && String(w).trim() !== "") return trimSlash(w);
  const leg = window.__RESTFY_API_BASE__;
  if (leg != null && String(leg).trim() !== "") return trimSlash(leg);
  return "";
}
function initApiBase() {
  window.getRestifyApiBase = getApiBase;
  window.restifyApiUrl = function(path) {
    const p = path.charAt(0) === "/" ? path : "/" + path;
    const base = getApiBase();
    return base ? base + p : p;
  };
  window.restifyFetch = function(url, opts) {
    const isElectron = typeof window !== "undefined" && window.electronAPI;
    if (!isElectron && typeof url === "string" && url.indexOf("http") === 0) {
      return fetch(
        window.restifyApiUrl("/api/proxy") + "?" + new URLSearchParams({ url }),
        opts
      );
    }
    return fetch(url, opts);
  };
}
function genId() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 9);
}
function escHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
function syntaxHighlight(json) {
  if (json == null) return "";
  const s = String(json);
  let result = "";
  let lastIndex = 0;
  const re = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    result += escHtml(s.slice(lastIndex, m.index));
    const match = m[0];
    let cls = "json-number";
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? "json-key" : "json-string";
    } else if (/true|false/.test(match)) {
      cls = "json-bool";
    } else if (/null/.test(match)) {
      cls = "json-null";
    }
    result += '<span class="' + cls + '">' + escHtml(match) + "</span>";
    lastIndex = re.lastIndex;
  }
  result += escHtml(s.slice(lastIndex));
  return result;
}
function syntaxHighlightXml(xml) {
  let out = escHtml(xml);
  out = out.replace(/(&lt;\/?[\w:-]+)/g, '<span class="xml-tag">$1</span>');
  out = out.replace(/([\w:-]+)(=)(&quot;[^&]*&quot;)/g, '<span class="xml-attr">$1</span>$2<span class="xml-value">$3</span>');
  out = out.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xml-comment">$1</span>');
  return out;
}
function showNotif(msg, type = "info") {
  const n = document.getElementById("notif");
  if (!n) return;
  n.textContent = msg;
  n.className = "notif " + type;
  setTimeout(() => n.classList.add("show"), 10);
  setTimeout(() => n.classList.remove("show"), 2500);
}
navigator.platform.toUpperCase().indexOf("MAC") >= 0;
function appConfirm(title, message, opts) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("appDialogOverlay");
    const titleEl = document.getElementById("appDialogTitle");
    const bodyEl = document.getElementById("appDialogBody");
    const footerEl = document.getElementById("appDialogFooter");
    titleEl.textContent = title || "Confirm";
    bodyEl.innerHTML = "";
    bodyEl.textContent = message || "";
    footerEl.innerHTML = "";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-secondary";
    cancelBtn.textContent = opts?.cancelLabel || "Cancel";
    cancelBtn.onclick = () => {
      overlay.classList.remove("open");
      resolve(false);
    };
    const okBtn = document.createElement("button");
    okBtn.className = opts?.danger ? "btn-danger" : "btn-primary";
    okBtn.textContent = opts?.okLabel || "OK";
    okBtn.onclick = () => {
      overlay.classList.remove("open");
      resolve(true);
    };
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(okBtn);
    overlay.classList.add("open");
    okBtn.focus();
    overlay.onkeydown = (e) => {
      if (e.key === "Escape") {
        overlay.classList.remove("open");
        resolve(false);
      }
    };
  });
}
function appPrompt(title, message, opts) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("appDialogOverlay");
    const titleEl = document.getElementById("appDialogTitle");
    const bodyEl = document.getElementById("appDialogBody");
    const footerEl = document.getElementById("appDialogFooter");
    titleEl.textContent = title || "";
    bodyEl.innerHTML = "";
    if (message) {
      const p = document.createElement("div");
      p.textContent = message;
      bodyEl.appendChild(p);
    }
    const isTextarea = opts?.textarea;
    const input = document.createElement(isTextarea ? "textarea" : "input");
    input.className = isTextarea ? "app-dialog-textarea" : "app-dialog-input";
    if (!isTextarea) input.type = "text";
    input.placeholder = opts?.placeholder || "";
    input.value = opts?.defaultValue || "";
    bodyEl.appendChild(input);
    footerEl.innerHTML = "";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-secondary";
    cancelBtn.textContent = opts?.cancelLabel || "Cancel";
    cancelBtn.onclick = () => {
      overlay.classList.remove("open");
      resolve(null);
    };
    const okBtn = document.createElement("button");
    okBtn.className = "btn-primary";
    okBtn.textContent = opts?.okLabel || "OK";
    const submit = () => {
      const val = input.value.trim();
      if (!val && !opts?.allowEmpty) return;
      overlay.classList.remove("open");
      resolve(val);
    };
    okBtn.onclick = submit;
    if (!isTextarea) input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(okBtn);
    overlay.classList.add("open");
    input.focus();
    if (!isTextarea) input.select();
    overlay.onkeydown = (e) => {
      if (e.key === "Escape") {
        overlay.classList.remove("open");
        resolve(null);
      }
    };
  });
}
const state = {
  collections: [],
  environments: [],
  activeEnvId: null,
  globalVars: [],
  history: [],
  tabs: [],
  activeTabId: null,
  tabData: {},
  openFolders: /* @__PURE__ */ new Set(),
  sidebarMode: "collections",
  currentBodyType: "none",
  pendingImport: null,
  editingNodeId: null
};
const LS_DATA = "restify_data";
const LS_DATA_LEGACY = "restfy_data";
function lsGetDataRaw() {
  return localStorage.getItem(LS_DATA) ?? localStorage.getItem(LS_DATA_LEGACY);
}
function lsSetDataRaw(json) {
  localStorage.setItem(LS_DATA, json);
}
function makeDefaultKv() {
  return [{ key: "", value: "", enabled: true }];
}
function makeRequest(overrides) {
  return Object.assign({
    id: genId(),
    type: "request",
    name: "New Request",
    method: "GET",
    url: "",
    params: makeDefaultKv(),
    headers: makeDefaultKv(),
    bodyType: "json",
    body: "{}",
    bodyForm: makeDefaultKv(),
    auth: { type: "none" },
    preRequestScript: "",
    testScript: ""
  }, overrides || {});
}
function makeFolder(overrides) {
  return Object.assign({
    id: genId(),
    type: "folder",
    name: "New Folder",
    headers: [],
    auth: { type: "none" },
    children: []
  }, overrides || {});
}
function makeCollection(overrides) {
  return Object.assign({
    id: genId(),
    type: "collection",
    name: "New Collection",
    description: "",
    headers: [],
    auth: { type: "none" },
    variables: [],
    preRequestScript: "",
    testScript: "",
    children: []
  }, overrides || {});
}
function findNodeById(id, nodes) {
  if (!nodes) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(id, node.children);
      if (found) return found;
    }
  }
  return null;
}
function findNodeInAll(id) {
  return findNodeById(id, state.collections);
}
function findParentOf(id, nodes, parent) {
  if (!nodes) return null;
  for (const node of nodes) {
    if (node.id === id) return parent;
    if (node.children) {
      const found = findParentOf(id, node.children, node);
      if (found) return found;
    }
  }
  return null;
}
function findParentInAll(id) {
  for (const col of state.collections) {
    if (col.id === id) return null;
    const found = findParentOf(id, col.children, col);
    if (found) return found;
  }
  return null;
}
function getAncestorChain(id) {
  const chain = [];
  let parent = findParentInAll(id);
  while (parent) {
    chain.unshift(parent);
    parent = findParentInAll(parent.id);
  }
  return chain;
}
function getInheritedHeaders(nodeId) {
  const chain = getAncestorChain(nodeId);
  const merged = {};
  chain.forEach((ancestor) => {
    if (ancestor.headers) {
      ancestor.headers.forEach((h) => {
        if (h.enabled !== false && h.key) merged[h.key] = { value: h.value, from: ancestor.name || "" };
      });
    }
  });
  return merged;
}
function getInheritedAuth(nodeId) {
  const chain = getAncestorChain(nodeId);
  for (let i = chain.length - 1; i >= 0; i--) {
    const a = chain[i].auth;
    if (a && a.type !== "none") return { auth: a, from: chain[i].name || "" };
  }
  return null;
}
function countRequests(node) {
  if (node.type === "request") return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, c) => sum + countRequests(c), 0);
}
function deleteNode(id) {
  for (let i = 0; i < state.collections.length; i++) {
    if (state.collections[i].id === id) {
      state.collections.splice(i, 1);
      return true;
    }
  }
  const parent = findParentInAll(id);
  if (parent && parent.children) {
    const idx = parent.children.findIndex((c) => c.id === id);
    if (idx !== -1) {
      parent.children.splice(idx, 1);
      return true;
    }
  }
  return false;
}
function duplicateNode(id) {
  const node = findNodeInAll(id);
  if (!node) return null;
  const parent = findParentInAll(id);
  const clone = deepClone(node);
  assignNewIds(clone);
  clone.name = node.name + " (copy)";
  if (parent && parent.children) {
    const idx = parent.children.findIndex((c) => c.id === id);
    parent.children.splice(idx + 1, 0, clone);
  } else if (node.type === "collection") {
    const idx = state.collections.findIndex((c) => c.id === id);
    state.collections.splice(idx + 1, 0, clone);
  }
  return clone;
}
function assignNewIds(node) {
  node.id = genId();
  if (node.children) node.children.forEach((c) => assignNewIds(c));
}
function getSiblingArrayForNode(nodeId) {
  const rootIdx = state.collections.findIndex((c) => c.id === nodeId);
  if (rootIdx !== -1) return state.collections;
  const parent = findParentInAll(nodeId);
  if (parent && parent.children) return parent.children;
  return null;
}
function reorderAmongSiblings(dragId, targetId, placeAfter) {
  if (dragId === targetId) return false;
  const arr = getSiblingArrayForNode(dragId);
  if (!arr || arr !== getSiblingArrayForNode(targetId)) return false;
  let from = arr.findIndex((n) => n.id === dragId);
  let to = arr.findIndex((n) => n.id === targetId);
  if (from < 0 || to < 0) return false;
  const [item] = arr.splice(from, 1);
  if (from < to) to--;
  if (placeAfter) to++;
  arr.splice(to, 0, item);
  return true;
}
let _diskPersistTimer = null;
function buildStateObject() {
  const data = {
    version: 2,
    savedAt: Date.now(),
    collections: state.collections,
    environments: state.environments,
    activeEnvId: state.activeEnvId,
    globalVars: state.globalVars,
    history: state.history,
    openTabs: state.tabs.map((t) => ({
      id: t.id,
      name: t.name,
      method: t.method,
      url: t.url,
      sourceId: t.sourceId,
      pinned: t.pinned
    })),
    activeTabId: state.activeTabId,
    tabData: {},
    openFolders: Array.from(state.openFolders)
  };
  for (const tid in state.tabData) {
    const d = state.tabData[tid];
    data.tabData[tid] = {
      params: d.params,
      headers: d.headers,
      bodyForm: d.bodyForm,
      bodyType: d.bodyType,
      body: d.body,
      graphqlVars: d.graphqlVars || "",
      auth: d.auth,
      preRequestScript: d.preRequestScript || "",
      testScript: d.testScript || "",
      pinned: d.pinned || false
    };
  }
  return data;
}
function scheduleDiskPersist(jsonString) {
  if (!window.electronAPI?.persistRestifyState) return;
  if (_diskPersistTimer) clearTimeout(_diskPersistTimer);
  _diskPersistTimer = setTimeout(() => {
    _diskPersistTimer = null;
    window.electronAPI.persistRestifyState(jsonString).catch(() => {
    });
  }, 400);
}
function saveState(opts) {
  const forceDisk = opts?.forceDisk;
  let json;
  try {
    json = JSON.stringify(buildStateObject());
  } catch (e) {
    console.error("Save failed (serialize):", e);
    return;
  }
  try {
    lsSetDataRaw(json);
  } catch (e) {
    console.error("Save failed (localStorage):", e);
    if (window.electronAPI?.persistRestifyState) {
      window.electronAPI.persistRestifyState(json).catch(() => {
      });
    }
    if (forceDisk && window.electronAPI?.flushRestifyState) {
      window.electronAPI.flushRestifyState(json);
    }
    return;
  }
  if (window.electronAPI?.persistRestifyState) {
    if (forceDisk && window.electronAPI?.flushRestifyState) {
      window.electronAPI.flushRestifyState(json);
    } else {
      scheduleDiskPersist(json);
    }
  }
}
function applyStateFromData(d) {
  if (!d) return;
  if (d.version === 2) {
    state.collections = d.collections || [];
    state.environments = d.environments || [];
    state.activeEnvId = d.activeEnvId || null;
    if (state.activeEnvId && !state.environments.some((e) => e.id === state.activeEnvId)) {
      state.activeEnvId = null;
    }
    state.globalVars = d.globalVars || [];
    state.history = d.history || [];
    state.openFolders = new Set(d.openFolders || []);
    if (d.openTabs && d.openTabs.length > 0) {
      state.tabs = d.openTabs;
      state.tabData = d.tabData || {};
      state.activeTabId = d.activeTabId || state.tabs[0].id;
    }
  } else {
    migrateV1(d);
  }
}
async function loadState() {
  let local = null;
  try {
    const raw = lsGetDataRaw();
    if (raw) local = JSON.parse(raw);
  } catch (e) {
    console.error("Load failed (localStorage):", e);
  }
  let file = null;
  if (window.electronAPI?.loadRestifyState) {
    try {
      const raw = await window.electronAPI.loadRestifyState();
      if (raw) file = JSON.parse(raw);
    } catch (e) {
      console.error("Load failed (disk cache):", e);
    }
  }
  let d = null;
  if (local && file) {
    const nLocal = local.collections && local.collections.length || 0;
    const nFile = file.collections && file.collections.length || 0;
    const tLocal = local.savedAt || 0;
    const tFile = file.savedAt || 0;
    if (nLocal === 0 && nFile > 0) d = file;
    else if (nFile === 0 && nLocal > 0) d = local;
    else d = tFile > tLocal ? file : local;
    const envMap = /* @__PURE__ */ new Map();
    (local.environments || []).forEach((e) => {
      if (e?.id) envMap.set(e.id, e);
    });
    (file.environments || []).forEach((e) => {
      if (e?.id) envMap.set(e.id, e);
    });
    const mergedEnvs = Array.from(envMap.values());
    if (mergedEnvs.length) d = { ...d, environments: mergedEnvs };
  } else {
    d = local || file;
  }
  if (!d) return;
  applyStateFromData(d);
  try {
    if (!local && file) {
      lsSetDataRaw(JSON.stringify(buildStateObject()));
    } else if (file && local && d === file && (file.savedAt || 0) > (local.savedAt || 0)) {
      lsSetDataRaw(JSON.stringify(buildStateObject()));
    }
  } catch (_) {
  }
}
function migrateV1(d) {
  const old = d.collections || d;
  if (typeof old === "object" && !Array.isArray(old)) {
    state.collections = Object.entries(old).map(([name, requests]) => {
      const col = makeCollection({ name });
      col.children = (requests || []).map((r) => makeRequest({
        name: r.name,
        method: r.method,
        url: r.url,
        params: r.params || makeDefaultKv(),
        headers: r.headers || makeDefaultKv(),
        bodyType: r.bodyType || "none",
        body: r.body || "",
        bodyForm: r.bodyForm || makeDefaultKv(),
        auth: r.auth || { type: "none" }
      }));
      return col;
    });
  }
}
function resolveVariables(str) {
  if (!str || typeof str !== "string") return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const env = state.environments.find((e) => e.id === state.activeEnvId);
    if (env) {
      const v = env.variables.find((v2) => v2.enabled !== false && v2.key === key);
      if (v) return v.value;
    }
    const g = state.globalVars.find((v) => v.enabled !== false && v.key === key);
    if (g) return g.value;
    return match;
  });
}
function lookupVariableKey(key) {
  const env = state.environments.find((e) => e.id === state.activeEnvId);
  if (env) {
    const v = env.variables.find((v2) => v2.enabled !== false && v2.key === key);
    if (v) return { value: v.value, source: "environment" };
  }
  const g = state.globalVars.find((v) => v.enabled !== false && v.key === key);
  if (g) return { value: g.value, source: "global" };
  return { value: null, source: "unresolved" };
}
function addToHistory(entry) {
  state.history.unshift({
    id: genId(),
    method: entry.method,
    url: entry.url,
    status: entry.status,
    time: entry.time,
    size: entry.size,
    timestamp: Date.now()
  });
  if (state.history.length > 500) state.history = state.history.slice(0, 500);
  saveState();
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
function methodBadge(method, variant = "tree") {
  const m = (method || "GET").toUpperCase();
  if (variant === "tab") {
    return `<span class="tab-method m-${m}">${m}</span>`;
  }
  return `<span class="req-method-badge m-${m} bg-${m}">${m}</span>`;
}
function methodBadgeEl(method) {
  const span = document.createElement("span");
  const m = (method || "GET").toUpperCase();
  span.className = `req-method-badge m-${m} bg-${m}`;
  span.textContent = m;
  return span;
}
function renderAuthFields(container, type, authData, idPrefix = "auth", opts = {}) {
  const { inheritedInfo, showAddTo = true, showOAuth2 = true } = opts;
  container.innerHTML = "";
  if (type === "inherit") {
    container.innerHTML = inheritedInfo ? `<div class="auth-inherit-info">${inheritedInfo}</div>` : `<div class="auth-inherit-info">No parent auth to inherit.</div>`;
    return;
  }
  if (type === "bearer") {
    container.innerHTML = `
      <div>
        <label class="auth-field-label">Token</label>
        <input type="text" class="auth-input" id="${idPrefix}Token"
          placeholder="Bearer token..." value="${escHtml(authData?.token || "")}">
      </div>`;
    return;
  }
  if (type === "basic" || type === "digest") {
    container.innerHTML = `
      <div>
        <label class="auth-field-label">Username</label>
        <input type="text" class="auth-input" id="${idPrefix}User"
          placeholder="username" value="${escHtml(authData?.username || "")}">
      </div>
      <div>
        <label class="auth-field-label">Password</label>
        <input type="password" class="auth-input" id="${idPrefix}Pass"
          placeholder="password" value="${escHtml(authData?.password || "")}">
      </div>`;
    return;
  }
  if (type === "apikey") {
    container.innerHTML = `
      <div>
        <label class="auth-field-label">Key</label>
        <input type="text" class="auth-input" id="${idPrefix}Key"
          placeholder="X-API-Key" value="${escHtml(authData?.key || "X-API-Key")}">
      </div>
      <div>
        <label class="auth-field-label">Value</label>
        <input type="text" class="auth-input" id="${idPrefix}Value"
          placeholder="your-api-key" value="${escHtml(authData?.value || "")}">
      </div>
      ${showAddTo ? `
      <div>
        <label class="auth-field-label">Add to</label>
        <select class="auth-input" id="${idPrefix}AddTo">
          <option value="header" ${(authData?.addTo || "header") === "header" ? "selected" : ""}>Header</option>
          <option value="query" ${authData?.addTo === "query" ? "selected" : ""}>Query Params</option>
        </select>
      </div>` : ""}`;
    return;
  }
  if (type === "oauth2" && showOAuth2) {
    container.innerHTML = `
      <div>
        <label class="auth-field-label">Grant Type</label>
        <select class="auth-input" id="oauth2Grant">
          <option value="client_credentials" ${(authData?.grant || "client_credentials") === "client_credentials" ? "selected" : ""}>Client Credentials</option>
          <option value="authorization_code" ${authData?.grant === "authorization_code" ? "selected" : ""}>Authorization Code</option>
          <option value="password" ${authData?.grant === "password" ? "selected" : ""}>Password</option>
          <option value="implicit" ${authData?.grant === "implicit" ? "selected" : ""}>Implicit</option>
        </select>
      </div>
      <div>
        <label class="auth-field-label">Token URL</label>
        <input type="text" class="auth-input" id="oauth2TokenUrl" value="${escHtml(authData?.tokenUrl || "")}">
      </div>
      <div>
        <label class="auth-field-label">Client ID</label>
        <input type="text" class="auth-input" id="oauth2ClientId" value="${escHtml(authData?.clientId || "")}">
      </div>
      <div>
        <label class="auth-field-label">Client Secret</label>
        <input type="text" class="auth-input" id="oauth2ClientSecret" value="${escHtml(authData?.clientSecret || "")}">
      </div>
      <div>
        <label class="auth-field-label">Scope</label>
        <input type="text" class="auth-input" id="oauth2Scope" value="${escHtml(authData?.scope || "")}">
      </div>
      <button class="btn-primary" style="margin-top:8px" onclick="fetchOAuth2Token()">Get Token</button>
      <div id="oauth2TokenResult" style="margin-top:8px"></div>`;
  }
}
function readAuthFields(idPrefix = "auth") {
  const sel = document.getElementById(`${idPrefix}Type`);
  const type = sel?.value || "none";
  const val = (id) => document.getElementById(id)?.value || "";
  const selVal = (id) => document.getElementById(id)?.value || "";
  if (type === "bearer") return { type, token: val(`${idPrefix}Token`) };
  if (type === "basic") return { type, username: val(`${idPrefix}User`), password: val(`${idPrefix}Pass`) };
  if (type === "digest") return { type, username: val(`${idPrefix}User`), password: val(`${idPrefix}Pass`) };
  if (type === "apikey") return {
    type,
    key: val(`${idPrefix}Key`) || "X-API-Key",
    value: val(`${idPrefix}Value`),
    addTo: selVal(`${idPrefix}AddTo`) || "header"
  };
  if (type === "oauth2") return {
    type,
    grant: selVal("oauth2Grant") || "client_credentials",
    tokenUrl: val("oauth2TokenUrl"),
    clientId: val("oauth2ClientId"),
    clientSecret: val("oauth2ClientSecret"),
    scope: val("oauth2Scope"),
    token: document.getElementById("oauth2TokenResult")?.dataset?.token || ""
  };
  if (type === "inherit") return { type: "inherit" };
  return { type: "none" };
}
function authTypeLabel(t) {
  const labels = {
    bearer: "Bearer Token",
    basic: "Basic Auth",
    apikey: "API Key",
    oauth2: "OAuth 2.0",
    digest: "Digest Auth",
    inherit: "Inherit",
    none: "No Auth"
  };
  return labels[t] || t || "No Auth";
}
function readKvRows(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const rows = [];
  container.querySelectorAll(".kv-row").forEach((row) => {
    const inputs = row.querySelectorAll(".kv-input");
    const cb = row.querySelector(".kv-enabled");
    if (inputs.length >= 2) {
      rows.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb ? cb.checked : true });
    }
  });
  return rows;
}
function createKvRow(containerId, storeKey, row, idx) {
  const d = document.createElement("div");
  d.className = "kv-row" + (row.enabled === false ? " disabled" : "") + (idx % 2 === 1 ? " kv-alt" : "");
  const isHeader = storeKey === "headers";
  const isFormData = storeKey === "bodyForm" && state.currentBodyType === "form";
  let keyAttrs = `type="text" class="kv-input" placeholder="Key" value="${escHtml(row.key)}"`;
  if (isHeader) keyAttrs += ` list="headerSuggestions"`;
  let valueHtml = `<input type="text" class="kv-input" placeholder="Value" value="${escHtml(row.value)}"
    oninput="kvChange('${containerId}','${storeKey}',${idx},'value',this.value)">`;
  if (isFormData && row.type === "file") {
    valueHtml = `<input type="file" class="kv-input kv-file"
      onchange="kvFileChange('${containerId}','${storeKey}',${idx},this.files[0])">`;
  }
  const typeSelect = isFormData ? `<select class="kv-type-select" onchange="kvTypeChange('${containerId}','${storeKey}',${idx},this.value)">
        <option value="text" ${row.type !== "file" ? "selected" : ""}>Text</option>
        <option value="file" ${row.type === "file" ? "selected" : ""}>File</option>
       </select>` : "";
  d.innerHTML = `
    <input type="checkbox" class="kv-enabled" ${row.enabled !== false ? "checked" : ""}
      onchange="kvChange('${containerId}','${storeKey}',${idx},'enabled',this.checked)">
    <input ${keyAttrs} oninput="kvChange('${containerId}','${storeKey}',${idx},'key',this.value)">
    ${valueHtml}
    ${typeSelect}
    <button class="kv-delete" onclick="deleteKvRow('${containerId}','${storeKey}',${idx})">&times;</button>
  `;
  return d;
}
function createReadOnlyKvRow(key, value, fromLabel) {
  const d = document.createElement("div");
  d.className = "kv-row inherited-row";
  d.innerHTML = `
    <input type="checkbox" class="kv-enabled" checked disabled>
    <input type="text" class="kv-input inherited" value="${escHtml(key)}" readonly>
    <input type="text" class="kv-input inherited" value="${escHtml(value)}" readonly>
    ${fromLabel ? `<span class="inherited-from">${escHtml(fromLabel)}</span>` : ""}
  `;
  return d;
}
function renderKvEditor(containerId, rows, storeKey) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (!rows || rows.length === 0) rows = makeDefaultKv();
  rows.forEach((row, i) => container.appendChild(createKvRow(containerId, storeKey, row, i)));
}
function getKvStore(storeKey) {
  if (storeKey === "folderHeaders" || storeKey === "folderVars") return [];
  if (!state.activeTabId || !state.tabData[state.activeTabId]) return [];
  const d = state.tabData[state.activeTabId];
  if (storeKey === "params") return d.params;
  if (storeKey === "headers") return d.headers;
  if (storeKey === "bodyForm") return d.bodyForm;
  return [];
}
const FOLDER_KEYS = /* @__PURE__ */ new Set(["folderHeaders", "folderVars", "cdocsVars"]);
function addKvRow(containerId, storeKey) {
  if (FOLDER_KEYS.has(storeKey)) {
    const rows2 = readKvRows(containerId);
    rows2.push({ key: "", value: "", enabled: true });
    renderKvEditor(containerId, rows2, storeKey);
    return;
  }
  if (!state.activeTabId) return;
  const rows = getKvStore(storeKey);
  const newRow = { key: "", value: "", enabled: true };
  rows.push(newRow);
  const container = document.getElementById(containerId);
  container.appendChild(createKvRow(containerId, storeKey, newRow, rows.length - 1));
}
function deleteKvRow(containerId, storeKey, idx) {
  if (FOLDER_KEYS.has(storeKey)) {
    const rows2 = readKvRows(containerId).filter((_, i) => i !== idx);
    if (rows2.length === 0) rows2.push({ key: "", value: "", enabled: true });
    renderKvEditor(containerId, rows2, storeKey);
    return;
  }
  const rows = getKvStore(storeKey);
  if (rows.length <= 1) {
    rows[0] = { key: "", value: "", enabled: true };
  } else {
    rows.splice(idx, 1);
  }
  renderKvEditor(containerId, rows, storeKey);
  if (storeKey === "headers") {
    document.dispatchEvent(new CustomEvent("kv:headers-changed"));
  }
}
function kvChange(containerId, storeKey, idx, field, val) {
  const rows = getKvStore(storeKey);
  if (rows && rows[idx]) {
    rows[idx][field] = val;
    if (field === "enabled") {
      const row = document.getElementById(containerId)?.children[idx];
      if (row) row.classList.toggle("disabled", !val);
    }
    if (storeKey === "headers") {
      document.dispatchEvent(new CustomEvent("kv:headers-changed"));
    }
  }
}
function kvFileChange(_containerId, storeKey, idx, file) {
  const rows = getKvStore(storeKey);
  if (rows && rows[idx]) {
    rows[idx].file = file;
    rows[idx].value = file ? file.name : "";
  }
}
function kvTypeChange(containerId, storeKey, idx, type) {
  const rows = getKvStore(storeKey);
  if (rows && rows[idx]) {
    rows[idx].type = type;
    rows[idx].value = "";
    rows[idx].file = null;
    renderKvEditor(containerId, rows, storeKey);
  }
}
function buildCtxHtml(items) {
  return items.map((item) => {
    if (item === "separator") return '<div class="ctx-sep"></div>';
    return `<div class="ctx-item${item.danger ? " ctx-danger" : ""}" onclick="${item.action}">${item.label}</div>`;
  }).join("");
}
function showCtxMenu(e, items) {
  const menu = document.getElementById("contextMenu");
  if (!menu) return;
  menu.innerHTML = buildCtxHtml(items);
  positionContextMenu(menu, e);
}
function positionContextMenu(menu, e) {
  menu.style.display = "block";
  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + "px";
  menu.style.top = Math.min(e.clientY, window.innerHeight - 300) + "px";
  setTimeout(() => document.addEventListener("click", hideContextMenu, { once: true }), 0);
}
function hideContextMenu() {
  const menu = document.getElementById("contextMenu");
  if (menu) menu.style.display = "none";
}
function activateTabStrip(key, opts) {
  const { tabSelector, tabAttr = "data-tab", panelSelector, panelMatch = "id" } = opts;
  document.querySelectorAll(tabSelector).forEach(
    (t) => t.classList.toggle("active", t.getAttribute(tabAttr) === key)
  );
  if (panelSelector) {
    document.querySelectorAll(panelSelector).forEach((p) => {
      const match = panelMatch === "suffix" ? p.id.endsWith(key) : p.id === key;
      p.classList.toggle("active", match);
    });
  }
}
function setActiveTabBtn(selector, key, attr = "data-tab") {
  document.querySelectorAll(selector).forEach(
    (t) => t.classList.toggle("active", t.getAttribute(attr) === key)
  );
}
const VIEW_PANELS = {
  workspace: { id: "requestWorkspace", display: "flex" },
  empty: { id: "emptyState", display: "flex" },
  "folder-editor": { id: "folderEditor", display: "flex" },
  "collection-docs": { id: "collectionDocs", display: "flex" }
};
function setMainView(view) {
  Object.entries(VIEW_PANELS).forEach(([key, { id, display }]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = key === view ? display : "none";
  });
}
let _collectionTreeFilter = "";
let _treeDragActiveId = null;
function clearTreeDropTargetClasses() {
  document.querySelectorAll(".tree-drop-target, .tree-drop-after").forEach((el) => {
    el.classList.remove("tree-drop-target", "tree-drop-after");
  });
}
function bindTreeRowDnD(rowEl, nodeId) {
  if (_collectionTreeFilter) {
    rowEl.classList.add("tree-drag-disabled");
    return;
  }
  const handle = rowEl.querySelector(".tree-drag-handle");
  if (!handle) return;
  handle.setAttribute("draggable", "true");
  handle.onmousedown = (e) => e.stopPropagation();
  handle.onclick = (e) => e.stopPropagation();
  handle.ondragstart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", nodeId);
    e.dataTransfer.effectAllowed = "move";
    _treeDragActiveId = nodeId;
    rowEl.classList.add("dragging");
  };
  handle.ondragend = () => {
    _treeDragActiveId = null;
    rowEl.classList.remove("dragging");
    clearTreeDropTargetClasses();
  };
  rowEl.ondragover = (e) => {
    if (!_treeDragActiveId || _treeDragActiveId === nodeId) return;
    const arrA = getSiblingArrayForNode(_treeDragActiveId);
    const arrB = getSiblingArrayForNode(nodeId);
    if (!arrA || arrA !== arrB) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = rowEl.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    clearTreeDropTargetClasses();
    rowEl.classList.add("tree-drop-target");
    if (after) rowEl.classList.add("tree-drop-after");
  };
  rowEl.ondragleave = (e) => {
    if (!rowEl.contains(e.relatedTarget)) rowEl.classList.remove("tree-drop-target", "tree-drop-after");
  };
  rowEl.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dragId = e.dataTransfer.getData("text/plain");
    rowEl.classList.remove("tree-drop-target", "tree-drop-after");
    if (!dragId || dragId === nodeId) return;
    const rect = rowEl.getBoundingClientRect();
    const placeAfter = e.clientY > rect.top + rect.height / 2;
    if (reorderAmongSiblings(dragId, nodeId, placeAfter)) {
      saveState();
      const sb = document.querySelector(".sidebar-search");
      renderSidebar(sb ? sb.value : "");
    }
  };
}
function newTab(req, sourceId) {
  const id = "tab_" + Date.now();
  const tab = {
    id,
    name: req ? req.name : "New Request",
    method: req ? req.method : "GET",
    url: req ? req.url : "",
    sourceId: sourceId || null,
    pinned: false
  };
  state.tabs.push(tab);
  state.tabData[id] = {
    params: req?.params ? deepClone(req.params) : makeDefaultKv(),
    headers: req?.headers ? deepClone(req.headers) : makeDefaultKv(),
    bodyForm: req?.bodyForm ? deepClone(req.bodyForm) : makeDefaultKv(),
    bodyType: req ? req.bodyType != null ? req.bodyType : "json" : "json",
    body: req ? req.body != null ? req.body : "{}" : "{}",
    graphqlVars: req ? req.graphqlVars || "" : "",
    auth: req ? deepClone(req.auth || { type: "none" }) : { type: "none" },
    preRequestScript: req ? req.preRequestScript || "" : "",
    testScript: req ? req.testScript || "" : ""
  };
  setActiveTab(id);
  renderTabs();
}
function setActiveTab(id) {
  if (state.activeTabId && state.activeTabId !== id) saveCurrentTabState();
  state.activeTabId = id;
  state.editingNodeId = null;
  loadTabState(id);
  renderTabs();
  showWorkspace();
}
function closeTab(id, e) {
  if (e) e.stopPropagation();
  const td = state.tabData[id];
  if (td?.pinned) return;
  const idx = state.tabs.findIndex((t) => t.id === id);
  state.tabs.splice(idx, 1);
  delete state.tabData[id];
  if (state.tabs.length === 0) {
    state.activeTabId = null;
    showEmpty();
    renderTabs();
    return;
  }
  if (state.activeTabId === id) {
    const newIdx = Math.min(idx, state.tabs.length - 1);
    setActiveTab(state.tabs[newIdx].id);
  }
  renderTabs();
}
function togglePinTab(id) {
  const d = state.tabData[id];
  if (d) d.pinned = !d.pinned;
  renderTabs();
}
function saveCurrentTabState() {
  if (!state.activeTabId || !state.tabData[state.activeTabId]) return;
  const t = state.tabs.find((t2) => t2.id === state.activeTabId);
  if (!t) return;
  const ms = document.getElementById("methodSelect");
  const ui = document.getElementById("urlInput");
  if (ms) t.method = ms.value;
  if (ui) t.url = ui.value;
  t.name = t.url ? (t.url.replace(/https?:\/\//, "").split("?")[0].split("/").filter(Boolean).pop() || t.url).substring(0, 30) : "New Request";
  state.tabData[state.activeTabId].bodyType = state.currentBodyType;
  const bt = document.getElementById("bodyTextarea");
  if (bt) state.tabData[state.activeTabId].body = bt.value;
  const gv = document.getElementById("graphqlVarsTextarea");
  if (gv) state.tabData[state.activeTabId].graphqlVars = gv.value;
  state.tabData[state.activeTabId].auth = getAuthState();
  const prs = document.getElementById("preRequestScriptEditor");
  if (prs) state.tabData[state.activeTabId].preRequestScript = prs.value;
  const ts = document.getElementById("testScriptEditor");
  if (ts) state.tabData[state.activeTabId].testScript = ts.value;
}
function loadTabState(id) {
  const t = state.tabs.find((t2) => t2.id === id);
  const d = state.tabData[id];
  if (!t || !d) return;
  document.getElementById("methodSelect").value = t.method || "GET";
  document.getElementById("urlInput").value = t.url || "";
  updateMethodColor();
  updateUrlHighlight();
  renderKvEditor("paramsEditor", d.params, "params");
  renderKvEditor("headersEditor", d.headers, "headers");
  renderInheritedHeaders();
  renderAutoHeaders();
  updateHeaderBadge();
  renderKvEditor("bodyFormEditor", d.bodyForm, "bodyForm");
  setBodyType(d.bodyType || "none");
  document.getElementById("bodyTextarea").value = d.body || "";
  updateBodyHighlight();
  const gv = document.getElementById("graphqlVarsTextarea");
  if (gv) gv.value = d.graphqlVars || "";
  document.getElementById("authType").value = d.auth ? d.auth.type || "none" : "none";
  updateAuthFields(d.auth);
  const prs = document.getElementById("preRequestScriptEditor");
  if (prs) prs.value = d.preRequestScript || "";
  const ts = document.getElementById("testScriptEditor");
  if (ts) ts.value = d.testScript || "";
  if (d.response) restoreResponse(d.response);
  else showResponsePlaceholder();
  switchReqTab(t.sourceId ? "body" : "params");
}
function renderTabs() {
  const bar = document.getElementById("tabsBar");
  if (!bar) return;
  bar.innerHTML = "";
  state.tabs.forEach((t) => {
    const d = state.tabData[t.id];
    const pinned = d?.pinned;
    const div = document.createElement("div");
    div.className = "tab" + (t.id === state.activeTabId ? " active" : "") + (pinned ? " pinned" : "") + (d?.dirty ? " unsaved" : "");
    div.onclick = () => setActiveTab(t.id);
    div.innerHTML = `
      ${methodBadge(t.method, "tab")}
      <span class="tab-name">${escHtml(t.name)}</span>
      ${pinned ? '<span class="tab-pin" title="Pinned">📌</span>' : ""}
      <span class="tab-close" onclick="closeTab('${t.id}', event)" title="Close tab">&times;</span>
    `;
    div.oncontextmenu = (e) => {
      e.preventDefault();
      showTabContextMenu(e, t.id);
    };
    bar.appendChild(div);
  });
}
function showTabContextMenu(e, tabId) {
  const pinned = state.tabData[tabId]?.pinned;
  showCtxMenu(e, [
    { label: pinned ? "Unpin Tab" : "Pin Tab", action: `togglePinTab('${tabId}'); hideContextMenu();` },
    { label: "Duplicate Tab", action: `duplicateTab('${tabId}'); hideContextMenu();` },
    "separator",
    { label: "Close Tab", action: `closeTab('${tabId}'); hideContextMenu();` },
    { label: "Close Other Tabs", action: `closeOtherTabs('${tabId}'); hideContextMenu();` }
  ]);
}
function duplicateTab(tabId) {
  const t = state.tabs.find((t2) => t2.id === tabId);
  const d = state.tabData[tabId];
  if (!t || !d) return;
  newTab({ name: t.name, method: t.method, url: t.url, params: d.params, headers: d.headers, bodyForm: d.bodyForm, bodyType: d.bodyType, body: d.body, graphqlVars: d.graphqlVars, auth: d.auth, preRequestScript: d.preRequestScript, testScript: d.testScript });
}
function closeOtherTabs(keepId) {
  const toClose = state.tabs.filter((t) => t.id !== keepId && !state.tabData[t.id]?.pinned);
  toClose.forEach((t) => {
    delete state.tabData[t.id];
  });
  state.tabs = state.tabs.filter((t) => t.id === keepId || state.tabData[t.id]?.pinned);
  if (!state.tabs.find((t) => t.id === state.activeTabId)) setActiveTab(keepId);
  renderTabs();
}
function renderSidebar(filter) {
  if (state.sidebarMode === "collections") {
    let f = filter;
    if (f === void 0) {
      const sb = document.querySelector(".sidebar-search");
      f = sb ? sb.value : "";
    }
    renderCollectionTree(f || "");
  } else {
    renderHistoryList(filter || "");
  }
}
function switchSidebarMode(mode) {
  state.sidebarMode = mode;
  setActiveTabBtn(".sidebar-mode-btn", mode, "data-mode");
  renderSidebar();
}
function renderCollectionTree(filter) {
  _collectionTreeFilter = (filter || "").trim();
  const container = document.getElementById("sidebarContent");
  container.innerHTML = "";
  if (state.collections.length === 0) {
    container.innerHTML = `<div class="sidebar-empty">No collections yet.<br>Import a Postman collection<br>or save a request.</div>`;
    return;
  }
  state.collections.forEach((col) => {
    const el = renderTreeNode(col, 0, col.id, filter);
    if (el) container.appendChild(el);
  });
}
function renderTreeNode(node, depth, collectionId, filter) {
  if (node.type === "request") {
    if (filter && !node.name.toLowerCase().includes(filter.toLowerCase()) && !node.url.toLowerCase().includes(filter.toLowerCase())) return null;
    const div = document.createElement("div");
    div.className = "tree-node tree-request";
    div.style.paddingLeft = 12 + depth * 16 + "px";
    div.dataset.id = node.id;
    div.innerHTML = `
      <span class="tree-drag-handle" title="Drag to reorder">⋮⋮</span>
      ${methodBadge(node.method)}
      <span class="tree-label">${escHtml(node.name)}</span>
    `;
    div.onclick = () => openRequest(node.id);
    div.oncontextmenu = (e) => {
      e.preventDefault();
      showNodeContextMenu(e, node.id, "request");
    };
    bindTreeRowDnD(div, node.id);
    return div;
  }
  const isOpen = state.openFolders.has(node.id) || !!filter;
  const count = countRequests(node);
  const isCollection = node.type === "collection";
  const wrapper = document.createElement("div");
  wrapper.className = "tree-group" + (isCollection ? " tree-collection" : "");
  const header = document.createElement("div");
  header.className = "tree-node tree-folder-header" + (isOpen ? " open" : "");
  header.style.paddingLeft = 12 + depth * 16 + "px";
  header.dataset.id = node.id;
  header.innerHTML = `
    <span class="tree-drag-handle" title="Drag to reorder">⋮⋮</span>
    <span class="tree-toggle">${isOpen ? "▼" : "▶"}</span>
    <span class="tree-label">${escHtml(node.name)}</span>
    <span class="tree-count">${count}</span>
    <button class="tree-add-btn" onclick="event.stopPropagation(); quickAddRequest('${node.id}')" title="Add request">+</button>
  `;
  header.onclick = () => {
    toggleFolder(node.id);
    if (isCollection) openCollectionDocs(node.id);
  };
  header.oncontextmenu = (e) => {
    e.preventDefault();
    showNodeContextMenu(e, node.id, node.type);
  };
  bindTreeRowDnD(header, node.id);
  wrapper.appendChild(header);
  if (isOpen && node.children) {
    const childContainer = document.createElement("div");
    childContainer.className = "tree-children";
    let hasVisibleChild = false;
    node.children.forEach((child) => {
      const childEl = renderTreeNode(child, depth + 1, collectionId, filter);
      if (childEl) {
        childContainer.appendChild(childEl);
        hasVisibleChild = true;
      }
    });
    if (hasVisibleChild || !filter) wrapper.appendChild(childContainer);
  }
  if (filter && count === 0 && !node.name.toLowerCase().includes(filter.toLowerCase())) return null;
  return wrapper;
}
function toggleFolder(id) {
  if (state.openFolders.has(id)) state.openFolders.delete(id);
  else state.openFolders.add(id);
  renderSidebar();
}
function filterSidebar(val) {
  renderSidebar(val);
}
function openRequest(nodeId) {
  const node = findNodeInAll(nodeId);
  if (!node || node.type !== "request") return;
  const existing = state.tabs.find((t) => t.sourceId === nodeId);
  if (existing) {
    setActiveTab(existing.id);
    return;
  }
  newTab(node, nodeId);
}
let _activeDocsColId = null;
let _docsFullDocsVisible = false;
function openCollectionDocs(colId) {
  const col = findNodeInAll(colId);
  if (!col || col.type !== "collection") return;
  _activeDocsColId = colId;
  _docsFullDocsVisible = false;
  if (state.activeTabId) saveCurrentTabState();
  setMainView("collection-docs");
  switchCDocsTab("overview");
  renderCollectionDocs(col);
}
function switchCDocsTab(tab) {
  activateTabStrip(tab, {
    tabSelector: ".cdocs-tab",
    tabAttr: "data-cdocs-tab",
    panelSelector: ".cdocs-panel",
    panelMatch: "id"
  });
  document.querySelectorAll(".cdocs-panel").forEach((p) => p.classList.remove("active"));
  const panel = document.getElementById("cdocsPanel" + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.classList.add("active");
  if (tab !== "overview") {
    const col = _activeDocsColId ? findNodeInAll(_activeDocsColId) : null;
    if (!col) return;
    if (tab === "authorization") _renderCDocsAuth(col);
    else if (tab === "scripts") _renderCDocsScripts(col);
    else if (tab === "variables") _renderCDocsVars(col);
    else if (tab === "runs") _renderCDocsRuns(col);
  }
}
function renderCollectionDocs(col) {
  const nameEl = document.getElementById("cdocsTopbarName");
  const titleEl = document.getElementById("cdocsOverviewTitle");
  if (nameEl) nameEl.textContent = col.name;
  if (titleEl) titleEl.textContent = col.name;
  const reqCount = countRequests(col);
  const folderCount = _countFolders(col);
  const metaEl = document.getElementById("cdocsOverviewMeta");
  if (metaEl) {
    metaEl.innerHTML = "";
    const items = [
      { icon: '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>', text: reqCount + " request" + (reqCount !== 1 ? "s" : "") },
      { icon: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>', text: folderCount + " folder" + (folderCount !== 1 ? "s" : "") }
    ];
    items.forEach((it) => {
      const span = document.createElement("span");
      span.className = "cdocs-overview-meta-item";
      span.innerHTML = it.icon + " " + it.text;
      metaEl.appendChild(span);
    });
  }
  const descEl = document.getElementById("cdocsDesc");
  if (descEl) {
    descEl.value = col.description || "";
    descEl.oninput = function() {
      col.description = this.value;
      saveState();
    };
  }
  const authTab = document.querySelector('[data-cdocs-tab="authorization"]');
  if (authTab) {
    const hasAuth = col.auth?.type && col.auth.type !== "none";
    const dot = authTab.querySelector(".cdocs-tab-dot");
    if (hasAuth && !dot) authTab.innerHTML += '<span class="cdocs-tab-dot"></span>';
    else if (!hasAuth && dot) dot.remove();
  }
  const viewLink = document.getElementById("cdocsViewDocsLink");
  if (viewLink) viewLink.onclick = (e) => {
    e.preventDefault();
    _toggleFullDocs(col);
  };
  const publishBtn = document.getElementById("cdocsPublishBtn");
  if (publishBtn) publishBtn.onclick = () => window.shareCollection(col.id);
  const copyBtn = document.getElementById("cdocsCopyLinkBtn");
  if (copyBtn) copyBtn.onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(deepClone(col), null, 2)).then(() => showNotif("Collection JSON copied to clipboard", "success"));
  };
  const runBtn = document.getElementById("cdocsRunCollectionBtn");
  if (runBtn) runBtn.onclick = () => window.runCollection(col.id);
  const fullDocs = document.getElementById("cdocsFullDocs");
  if (fullDocs) {
    fullDocs.style.display = _docsFullDocsVisible ? "block" : "none";
    if (_docsFullDocsVisible) _buildFullDocs(col, fullDocs);
  }
}
function _countFolders(node) {
  let c = 0;
  if (node.children) node.children.forEach((ch) => {
    if (ch.type === "folder") {
      c++;
      c += _countFolders(ch);
    }
  });
  return c;
}
function _toggleFullDocs(col) {
  _docsFullDocsVisible = !_docsFullDocsVisible;
  const el = document.getElementById("cdocsFullDocs");
  const link = document.getElementById("cdocsViewDocsLink");
  if (_docsFullDocsVisible) {
    el.style.display = "block";
    _buildFullDocs(col, el);
    if (link) link.innerHTML = "Hide documentation &uarr;";
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    el.style.display = "none";
    if (link) link.innerHTML = "View complete documentation &rarr;";
  }
}
function _buildFullDocs(col, container) {
  container.innerHTML = "";
  const header = document.createElement("div");
  header.className = "cdocs-full-docs-header";
  header.innerHTML = '<div class="cdocs-full-docs-title">' + escHtml(col.name) + "</div>";
  container.appendChild(header);
  if (col.description) {
    const descP = document.createElement("p");
    descP.style.cssText = "font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0 0 20px;white-space:pre-wrap";
    descP.textContent = col.description;
    container.appendChild(descP);
  }
  if (col.auth?.type && col.auth.type !== "none") _renderDocAuthRow(container, col.auth, col.name);
  if (!col.children || col.children.length === 0) {
    container.innerHTML += '<div style="text-align:center;color:var(--text-dim);padding:32px;font-size:13px">No requests in this collection yet.</div>';
    return;
  }
  col.children.filter((c) => c.type === "request").forEach((req) => _renderDocRequestCard(container, req));
  col.children.filter((c) => c.type === "folder").forEach((f) => _renderDocFolderSection(container, f, col));
}
function _renderDocFolderSection(container, folder, parentCol) {
  const section = document.createElement("div");
  section.className = "cdocs-folder-section";
  const heading = document.createElement("div");
  heading.className = "cdocs-folder-heading";
  heading.textContent = folder.name;
  section.appendChild(heading);
  if (folder.description) {
    const desc = document.createElement("div");
    desc.className = "cdocs-folder-desc";
    desc.textContent = folder.description;
    section.appendChild(desc);
  }
  const effectiveAuth = folder.auth?.type && folder.auth.type !== "none" ? folder.auth : null;
  if (effectiveAuth) {
    _renderDocAuthRow(section, effectiveAuth);
  } else if (parentCol.auth?.type && parentCol.auth.type !== "none") {
    const note = document.createElement("div");
    note.className = "cdocs-folder-auth-row";
    note.innerHTML = `<strong>Authorization</strong> <span>${escHtml(authTypeLabel(parentCol.auth.type))}</span> <span style="margin-left:auto;font-style:italic">inherited from collection ${escHtml(parentCol.name)}</span>`;
    section.appendChild(note);
  }
  (folder.children || []).filter((c) => c.type === "request").forEach((req) => _renderDocRequestCard(section, req));
  container.appendChild(section);
  if (folder.children) folder.children.filter((c) => c.type === "folder").forEach((sub) => _renderDocFolderSection(container, sub, parentCol));
}
function _renderDocRequestCard(container, req) {
  const card = document.createElement("div");
  card.className = "cdocs-req-card";
  const header = document.createElement("div");
  header.className = "cdocs-req-card-header";
  header.onclick = () => openRequest(req.id);
  const badge = methodBadgeEl(req.method || "GET");
  badge.className = "cdocs-req-card-method bg-" + (req.method || "GET");
  const name = document.createElement("span");
  name.className = "cdocs-req-card-name";
  name.textContent = req.name || "Untitled";
  const openLink = document.createElement("span");
  openLink.className = "cdocs-req-card-open";
  openLink.textContent = "Open request →";
  header.appendChild(badge);
  header.appendChild(name);
  header.appendChild(openLink);
  card.appendChild(header);
  if (req.url) {
    const urlWrap = document.createElement("div");
    urlWrap.className = "cdocs-req-card-url";
    urlWrap.innerHTML = "<code>" + escHtml(req.url) + "</code>";
    card.appendChild(urlWrap);
  }
  container.appendChild(card);
}
function _renderDocAuthRow(container, auth, _sourceName) {
  const row = document.createElement("div");
  row.className = "cdocs-folder-auth-row";
  let html = `<strong>Authorization</strong> <span>${escHtml(authTypeLabel(auth.type))}</span>`;
  if (auth.type === "bearer") html += ' &mdash; Token: <code style="font-size:11px;background:var(--bg-mid);padding:2px 6px;border-radius:3px">&lt;token&gt;</code>';
  if (auth.type === "basic") html += " &mdash; Username: " + escHtml(auth.username || "");
  if (auth.type === "apikey") html += " &mdash; " + escHtml(auth.key || "X-API-Key") + ": &lt;value&gt;";
  row.innerHTML = html;
  container.appendChild(row);
}
function _renderCDocsAuth(col) {
  const el = document.getElementById("cdocsAuthContent");
  if (!el) return;
  const auth = col.auth || { type: "none" };
  if (!auth.type || auth.type === "none") {
    el.innerHTML = `<div class="cdocs-auth-header">Authorization</div>
      <div class="cdocs-auth-type">No Auth</div>
      <div class="cdocs-auth-note">This collection does not have authorization configured.</div>
      <div style="margin-top:16px"><button class="btn-secondary" onclick="openFolderEditor('${col.id}')">Configure Authorization</button></div>`;
    return;
  }
  let tableRows = "";
  if (auth.type === "bearer") tableRows = `<tr><td>Type</td><td>Bearer Token</td></tr><tr><td>Token</td><td>${escHtml(auth.token || "<token>")}</td></tr>`;
  else if (auth.type === "basic") tableRows = `<tr><td>Type</td><td>Basic Auth</td></tr><tr><td>Username</td><td>${escHtml(auth.username || "")}</td></tr><tr><td>Password</td><td>••••••</td></tr>`;
  else if (auth.type === "apikey") tableRows = `<tr><td>Type</td><td>API Key</td></tr><tr><td>Header</td><td>${escHtml(auth.key || "X-API-Key")}</td></tr><tr><td>Value</td><td>${escHtml(auth.value || "")}</td></tr>`;
  el.innerHTML = `<div class="cdocs-auth-header">Authorization</div>
    <div class="cdocs-auth-type">${authTypeLabel(auth.type)}</div>
    <table class="cdocs-auth-table">${tableRows}</table>
    <div class="cdocs-auth-note">This authorization is inherited by all requests in the collection unless overridden.</div>
    <div style="margin-top:16px"><button class="btn-secondary" onclick="openFolderEditor('${col.id}')">Edit Authorization</button></div>`;
}
function _renderCDocsScripts(col) {
  const pre = document.getElementById("cdocsPreScript");
  const test = document.getElementById("cdocsTestScript");
  if (pre) pre.value = col.preRequestScript || "";
  if (test) test.value = col.testScript || "";
  const saveBtn = document.getElementById("cdocsSaveScriptsBtn");
  if (saveBtn) saveBtn.onclick = () => {
    col.preRequestScript = document.getElementById("cdocsPreScript").value;
    col.testScript = document.getElementById("cdocsTestScript").value;
    saveState();
    showNotif("Scripts saved", "success");
  };
}
function _renderCDocsVars(col) {
  renderKvEditor("cdocsVarsEditor", col.variables || [], "cdocsVars");
  const saveBtn = document.getElementById("cdocsSaveVarsBtn");
  if (saveBtn) saveBtn.onclick = () => {
    col.variables = readKvRows("cdocsVarsEditor");
    saveState();
    showNotif("Variables saved", "success");
  };
}
function _renderCDocsRuns(col) {
  const runBtn = document.getElementById("cdocsRunCollectionBtn");
  if (runBtn) runBtn.onclick = () => window.runCollection(col.id);
}
function openFolderEditor(nodeId) {
  const node = findNodeInAll(nodeId);
  if (!node) return;
  _activeDocsColId = null;
  state.editingNodeId = nodeId;
  if (state.activeTabId) saveCurrentTabState();
  setMainView("folder-editor");
  renderFolderEditor(node);
}
function renderFolderEditor(node) {
  const titleEl = document.getElementById("folderEditorTitle");
  const iconEl = document.getElementById("folderEditorIcon");
  if (titleEl) titleEl.textContent = node.name;
  if (iconEl) iconEl.textContent = node.type === "collection" ? "📦" : "📁";
  renderKvEditor("folderHeadersEditor", node.headers || [], "folderHeaders");
  document.getElementById("folderAuthType").value = node.auth?.type || "none";
  updateFolderAuthFields(node.auth);
  const varsPanel = document.getElementById("folderVarsPanel");
  if (node.type === "collection") {
    if (varsPanel) varsPanel.style.display = "block";
    renderKvEditor("folderVarsEditor", node.variables || [], "folderVars");
  } else {
    if (varsPanel) varsPanel.style.display = "none";
  }
  const pre = document.getElementById("folderPreRequestScript");
  const ts = document.getElementById("folderTestScript");
  if (pre) pre.value = node.preRequestScript || "";
  if (ts) ts.value = node.testScript || "";
}
function saveFolderEdits() {
  if (!state.editingNodeId) return;
  const node = findNodeInAll(state.editingNodeId);
  if (!node) return;
  node.headers = readKvRows("folderHeadersEditor");
  node.auth = readAuthFields("folderAuth");
  if (node.type === "collection") node.variables = readKvRows("folderVarsEditor");
  node.preRequestScript = document.getElementById("folderPreRequestScript").value;
  node.testScript = document.getElementById("folderTestScript").value;
  saveState();
  showNotif("Folder settings saved", "success");
}
function updateFolderAuthFields(authData) {
  const type = document.getElementById("folderAuthType").value;
  const container = document.getElementById("folderAuthFields");
  renderAuthFields(container, type, authData, "folderAuth", { showAddTo: false, showOAuth2: false });
}
function quickAddRequest(parentId) {
  const parent = findNodeInAll(parentId);
  if (!parent || !parent.children) return;
  const req = makeRequest({ name: "New Request" });
  parent.children.push(req);
  state.openFolders.add(parentId);
  saveState();
  renderSidebar();
  openRequest(req.id);
}
function showNodeContextMenu(e, nodeId, nodeType, _collectionId) {
  const items = [];
  if (nodeType === "collection" || nodeType === "folder") {
    if (nodeType === "collection") items.push({ label: "View Documentation", action: `openCollectionDocs('${nodeId}'); hideContextMenu();` });
    items.push(
      { label: "New Request", action: `quickAddRequest('${nodeId}'); hideContextMenu();` },
      { label: "New Folder", action: `addSubfolder('${nodeId}'); hideContextMenu();` },
      { label: "Edit Settings", action: `openFolderEditor('${nodeId}'); hideContextMenu();` },
      "separator"
    );
  }
  if (nodeType === "request") {
    items.push({ label: "Open", action: `openRequest('${nodeId}'); hideContextMenu();` }, "separator");
  }
  items.push(
    { label: "Rename", action: `startRename('${nodeId}'); hideContextMenu();` },
    { label: "Duplicate", action: `doDuplicate('${nodeId}'); hideContextMenu();` }
  );
  if (nodeType === "collection") {
    items.push(
      { label: "Export as Postman JSON", action: `exportCollectionAsPostman('${nodeId}'); hideContextMenu();` },
      { label: "Share &amp; Publish Docs", action: `shareCollection('${nodeId}'); hideContextMenu();` },
      { label: "Run Collection", action: `runCollection('${nodeId}'); hideContextMenu();` }
    );
  }
  items.push("separator", { label: "Delete", action: `doDelete('${nodeId}'); hideContextMenu();`, danger: true });
  showCtxMenu(e, items);
}
function addSubfolder(parentId) {
  const parent = findNodeInAll(parentId);
  if (!parent || !parent.children) return;
  const folder = makeFolder({ name: "New Folder" });
  parent.children.push(folder);
  state.openFolders.add(parentId);
  saveState();
  renderSidebar();
  startRename(folder.id);
}
function startRename(nodeId) {
  renderSidebar();
  const el = document.querySelector(`[data-id="${nodeId}"] .tree-label`);
  if (!el) return;
  const node = findNodeInAll(nodeId);
  if (!node) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-rename";
  input.value = node.name;
  input.onclick = (e) => e.stopPropagation();
  input.onkeydown = (e) => {
    if (e.key === "Enter") _commitRename(nodeId, input.value);
    if (e.key === "Escape") renderSidebar();
  };
  input.onblur = () => {
    _commitRename(nodeId, input.value);
  };
  el.replaceWith(input);
  input.focus();
  input.select();
}
function _commitRename(nodeId, newName) {
  const node = findNodeInAll(nodeId);
  if (node && newName.trim()) {
    node.name = newName.trim();
    saveState();
  }
  renderSidebar();
}
function doDuplicate(nodeId) {
  duplicateNode(nodeId);
  saveState();
  renderSidebar();
  showNotif("Duplicated", "success");
}
async function doDelete(nodeId) {
  const node = findNodeInAll(nodeId);
  if (!node) return;
  const ok = await appConfirm("Delete item", `Delete "${node.name}"? This cannot be undone.`, { danger: true, okLabel: "Delete" });
  if (!ok) return;
  state.tabs.filter((t) => t.sourceId === nodeId).forEach((t) => closeTab(t.id));
  deleteNode(nodeId);
  saveState();
  renderSidebar();
  showNotif("Deleted", "success");
}
function renderHistoryList(filter) {
  const container = document.getElementById("sidebarContent");
  container.innerHTML = "";
  if (state.history.length === 0) {
    container.innerHTML = '<div class="sidebar-empty">No history yet.<br>Send a request to see it here.</div>';
    return;
  }
  const clearBtn = document.createElement("div");
  clearBtn.className = "history-clear";
  clearBtn.innerHTML = '<button class="btn-text" onclick="clearHistory()">Clear History</button>';
  container.appendChild(clearBtn);
  const groups = {};
  state.history.forEach((h) => {
    if (filter && !h.url.toLowerCase().includes(filter.toLowerCase())) return;
    const date = new Date(h.timestamp).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(h);
  });
  Object.entries(groups).forEach(([date, items]) => {
    const group = document.createElement("div");
    group.className = "history-group";
    group.innerHTML = `<div class="history-date">${date}</div>`;
    items.forEach((h) => {
      const item = document.createElement("div");
      item.className = "tree-node tree-request";
      item.style.paddingLeft = "12px";
      item.innerHTML = `
        ${methodBadge(h.method)}
        <span class="tree-label">${escHtml(h.url.replace(/https?:\/\//, "").substring(0, 40))}</span>
        <span class="history-meta">${h.status || ""} · ${h.time}ms</span>
      `;
      item.onclick = () => newTab({ name: h.url.split("/").pop() || "Request", method: h.method, url: h.url });
      group.appendChild(item);
    });
    container.appendChild(group);
  });
}
async function clearHistory() {
  const ok = await appConfirm("Clear history", "Clear all request history? This cannot be undone.", { danger: true, okLabel: "Clear" });
  if (!ok) return;
  state.history = [];
  saveState();
  renderSidebar();
}
const AUTO_HEADERS = [
  { key: "User-Agent", value: "Restify/2.0" },
  { key: "Accept", value: "*/*" },
  { key: "Accept-Encoding", value: "gzip, deflate, br" },
  { key: "Connection", value: "keep-alive" }
];
function getAutoHeaders() {
  const auto = [...AUTO_HEADERS];
  if (state.currentBodyType === "json") auto.push({ key: "Content-Type", value: "application/json" });
  else if (state.currentBodyType === "urlencoded") auto.push({ key: "Content-Type", value: "application/x-www-form-urlencoded" });
  else if (state.currentBodyType === "graphql") auto.push({ key: "Content-Type", value: "application/json" });
  else if (state.currentBodyType === "raw") auto.push({ key: "Content-Type", value: "text/plain" });
  const auth = state.activeTabId && state.tabData[state.activeTabId] ? state.tabData[state.activeTabId].auth : { type: "none" };
  if (auth.type === "bearer" && auth.token) auto.push({ key: "Authorization", value: "Bearer <token>" });
  else if (auth.type === "basic") auto.push({ key: "Authorization", value: "Basic <credentials>" });
  else if (auth.type === "apikey") auto.push({ key: auth.key || "X-API-Key", value: "<api-key>" });
  const userHeaders = state.activeTabId ? getKvStore("headers") || [] : [];
  return auto.filter((a) => !userHeaders.some((h) => h.enabled && h.key.toLowerCase() === a.key.toLowerCase()));
}
function renderAutoHeaders() {
  const container = document.getElementById("autoHeadersSection");
  if (!container) return;
  const auto = getAutoHeaders();
  if (auto.length === 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";
  container.innerHTML = '<div class="inherited-title">Auto-generated Headers</div>';
  auto.forEach((h) => container.appendChild(createReadOnlyKvRow(h.key, h.value, "auto")));
}
function updateHeaderBadge() {
  const badge = document.querySelector('.panel-tab[data-tab="headers"] .badge');
  const userHeaders = state.activeTabId ? (getKvStore("headers") || []).filter((h) => h.key) : [];
  const autoCount = getAutoHeaders().length;
  const sourceTab = state.activeTabId ? state.tabs.find((t) => t.id === state.activeTabId) : null;
  const inherited = sourceTab?.sourceId ? Object.keys(getInheritedHeaders(sourceTab.sourceId)).length : 0;
  const total = userHeaders.length + autoCount + inherited;
  if (badge) {
    badge.textContent = String(total);
    badge.style.display = total > 0 ? "inline-flex" : "none";
  }
}
function renderInheritedHeaders() {
  const container = document.getElementById("inheritedHeadersSection");
  if (!container) return;
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  if (!tab?.sourceId) {
    container.style.display = "none";
    return;
  }
  const inherited = getInheritedHeaders(tab.sourceId);
  const keys = Object.keys(inherited);
  if (keys.length === 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";
  container.innerHTML = '<div class="inherited-title">Inherited Headers</div>';
  keys.forEach((key) => {
    const h = inherited[key];
    container.appendChild(createReadOnlyKvRow(key, h.value, `from ${h.from}`));
  });
}
document.addEventListener("kv:headers-changed", () => {
  renderAutoHeaders();
  updateHeaderBadge();
});
function setBodyType(type, _btnEl, _silent) {
  state.currentBodyType = type;
  if (state.activeTabId && state.tabData[state.activeTabId]) state.tabData[state.activeTabId].bodyType = type;
  document.querySelectorAll(".body-type-btn").forEach((b) => b.classList.toggle("active", b.dataset.bodytype === type));
  const show = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.style.display = v ? "flex" : "none";
  };
  const showB = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.style.display = v ? "block" : "none";
  };
  show("bodyTextContainer", type === "json" || type === "raw");
  show("bodyFormContainer", type === "form" || type === "urlencoded");
  showB("bodyNoneMsg", type === "none");
  const fmtBtn = document.getElementById("formatJsonBtn");
  if (fmtBtn) fmtBtn.style.display = type === "json" || type === "raw" ? "inline-flex" : "none";
  show("graphqlContainer", type === "graphql");
  show("binaryContainer", type === "binary");
  _updateBodySize();
  updateBodyHighlight();
  renderAutoHeaders();
  updateHeaderBadge();
}
function formatJson() {
  const ta = document.getElementById("bodyTextarea");
  try {
    ta.value = JSON.stringify(JSON.parse(ta.value), null, 2);
    showNotif("Beautified", "success");
    _updateBodySize();
    updateBodyHighlight();
  } catch {
    showNotif("Invalid JSON", "error");
  }
}
function beautifyResponse() {
  const content = document.getElementById("responseBodyContent");
  const raw = window._lastResponse;
  if (!raw) return;
  try {
    content.innerHTML = syntaxHighlight(JSON.stringify(JSON.parse(raw), null, 2));
    showNotif("Response beautified", "success");
  } catch {
    try {
      content.innerHTML = syntaxHighlightXml(raw.replace(/></g, ">\n<"));
      showNotif("Response beautified", "success");
    } catch {
      showNotif("Cannot beautify this response", "error");
    }
  }
}
function _updateBodySize() {
  const el = document.getElementById("bodySizeIndicator");
  if (!el) return;
  let size = 0;
  if (state.currentBodyType === "json" || state.currentBodyType === "raw" || state.currentBodyType === "graphql") {
    size = new Blob([document.getElementById("bodyTextarea")?.value || ""]).size;
  }
  el.textContent = size > 0 ? formatBytes(size) : "";
}
function _highlightVarTokens(html) {
  return html.replace(/\{\{(\w+)\}\}/g, '<span class="var-token">{{$1}}</span>');
}
function updateUrlHighlight() {
  const input = document.getElementById("urlInput");
  const overlay = document.getElementById("urlHighlightOverlay");
  if (!input || !overlay) return;
  const val = input.value;
  if (!val || !/\{\{/.test(val)) {
    overlay.style.display = "none";
    input.classList.remove("url-has-vars");
    return;
  }
  overlay.style.display = "block";
  input.classList.add("url-has-vars");
  overlay.innerHTML = _highlightVarTokens(escHtml(val));
  overlay.scrollLeft = input.scrollLeft;
}
function updateBodyHighlight() {
  const ta = document.getElementById("bodyTextarea");
  const overlay = document.getElementById("bodyHighlightOverlay");
  const lineNums = document.getElementById("bodyLineNumbers");
  if (!ta || !overlay || !lineNums) return;
  const val = ta.value || "";
  const isJson = state.currentBodyType === "json";
  const isRaw = state.currentBodyType === "raw";
  const isGraphql = state.currentBodyType === "graphql";
  if (!isJson && !isRaw && !isGraphql) {
    overlay.style.display = "none";
    lineNums.style.display = "none";
    ta.style.color = "var(--text-primary)";
    return;
  }
  overlay.style.display = "block";
  lineNums.style.display = "block";
  ta.style.color = "transparent";
  ta.style.caretColor = "var(--text-primary)";
  overlay.innerHTML = isJson ? _highlightVarTokens(syntaxHighlight(val)) : _highlightVarTokens(escHtml(val));
  lineNums.innerHTML = val.split("\n").map((_, i) => `<div>${i + 1}</div>`).join("");
}
function syncBodyScroll() {
  const ta = document.getElementById("bodyTextarea");
  const overlay = document.getElementById("bodyHighlightOverlay");
  const lineNums = document.getElementById("bodyLineNumbers");
  if (!ta || !overlay) return;
  overlay.scrollTop = ta.scrollTop;
  overlay.scrollLeft = ta.scrollLeft;
  if (lineNums) lineNums.scrollTop = ta.scrollTop;
}
function updateAuthFields(authData) {
  const type = document.getElementById("authType")?.value || "none";
  const container = document.getElementById("authFields");
  const sourceTab = state.activeTabId ? state.tabs.find((t) => t.id === state.activeTabId) : null;
  const inheritedAuth = sourceTab?.sourceId ? getInheritedAuth(sourceTab.sourceId) : null;
  const inheritedInfo = inheritedAuth ? `Inheriting <strong>${inheritedAuth.auth.type}</strong> auth from <em>${escHtml(inheritedAuth.from)}</em>` : void 0;
  renderAuthFields(container, type, authData, "auth", { inheritedInfo });
  renderAutoHeaders();
  updateHeaderBadge();
}
function getAuthState() {
  return readAuthFields("auth");
}
async function fetchOAuth2Token() {
  const s = getAuthState();
  if (!s.tokenUrl) {
    showNotif("Token URL required", "error");
    return;
  }
  try {
    const body = new URLSearchParams();
    body.append("grant_type", s.grant);
    body.append("client_id", s.clientId);
    body.append("client_secret", s.clientSecret);
    if (s.scope) body.append("scope", s.scope);
    const resp = await window.restifyFetch(resolveVariables(s.tokenUrl), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const data = await resp.json();
    const result = document.getElementById("oauth2TokenResult");
    if (data.access_token) {
      result.dataset.token = data.access_token;
      result.innerHTML = `<div style="color:var(--green)">Token acquired (${data.token_type || "bearer"})</div>
        <input class="auth-input" value="${escHtml(data.access_token)}" readonly style="margin-top:4px">`;
      showNotif("OAuth2 token acquired", "success");
    } else {
      result.innerHTML = `<div style="color:var(--red)">Error: ${escHtml(JSON.stringify(data))}</div>`;
    }
  } catch (err) {
    showNotif("OAuth2 error: " + err.message, "error");
  }
}
function toggleTheme() {
  const html = document.documentElement;
  const next = (html.getAttribute("data-theme") || "dark") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("restify_theme", next);
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.textContent = next === "dark" ? "☾" : "☀";
}
function loadTheme() {
  const saved = localStorage.getItem("restify_theme") || localStorage.getItem("restfy_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.textContent = saved === "dark" ? "☾" : "☀";
}
function switchReqTab(name) {
  activateTabStrip(name, {
    tabSelector: ".panel-tabs .panel-tab",
    tabAttr: "data-tab",
    panelSelector: ".request-panels .panel-content",
    panelMatch: "suffix"
  });
  document.querySelectorAll(".request-panels .panel-content").forEach(
    (p) => p.classList.toggle("active", p.id === "panel-" + name)
  );
}
function switchRespTab(name) {
  setActiveTabBtn(".response-tabs .response-tab", name);
  ["resp-body", "resp-headers", "resp-cookies", "resp-tests"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === "resp-" + name ? "flex" : "none";
  });
}
function showWorkspace() {
  setMainView("workspace");
  _activeDocsColId = null;
}
function showEmpty() {
  setMainView("empty");
  _activeDocsColId = null;
}
function updateMethodColor() {
  const sel = document.getElementById("methodSelect");
  const method = sel.value;
  sel.className = "method-select m-" + method;
  const urlInput = document.getElementById("urlInput");
  if (urlInput) urlInput.className = "url-input method-border-" + method;
  const t = state.tabs.find((t2) => t2.id === state.activeTabId);
  if (t) {
    t.method = method;
    renderTabs();
  }
}
function copyResponse() {
  if (window._lastResponse) navigator.clipboard.writeText(window._lastResponse).then(() => showNotif("Copied!", "success"));
}
function switchResponseMode(mode) {
  setActiveTabBtn(".resp-mode-btn", mode, "data-mode");
  const content = document.getElementById("responseBodyContent");
  const raw = document.getElementById("responseBodyRaw");
  const preview = document.getElementById("responseBodyPreview");
  if (content) content.style.display = mode === "pretty" ? "block" : "none";
  if (raw) raw.style.display = mode === "raw" ? "block" : "none";
  if (preview) preview.style.display = mode === "preview" ? "block" : "none";
}
function showResponsePlaceholder() {
  const el = (id) => document.getElementById(id);
  const sb = el("statusBadge");
  if (sb) sb.innerHTML = "";
  const rm = el("respMeta");
  if (rm) rm.textContent = "";
  ["copyRespBtn", "curlBtn", "codeGenBtn", "beautifyRespBtn"].forEach((id) => {
    const e = el(id);
    if (e) e.style.display = "none";
  });
  const ph = el("responsePlaceholder");
  if (ph) ph.style.display = "block";
  ["responseBodyContent", "responseBodyRaw", "responseBodyPreview"].forEach((id) => {
    const e = el(id);
    if (e) e.style.display = "none";
  });
}
function restoreResponse(cached) {
  if (!cached) return showResponsePlaceholder();
  const el = (id) => document.getElementById(id);
  const sb = el("statusBadge");
  if (sb) sb.innerHTML = cached.statusHtml || "";
  const rm = el("respMeta");
  if (rm) rm.textContent = cached.meta || "";
  ["copyRespBtn", "curlBtn", "codeGenBtn", "beautifyRespBtn"].forEach((id) => {
    const e = el(id);
    if (e) e.style.display = "inline-flex";
  });
  const ph = el("responsePlaceholder");
  if (ph) ph.style.display = "none";
  const bc = el("responseBodyContent");
  if (bc) {
    bc.style.display = "block";
    bc.innerHTML = cached.bodyHtml || "";
  }
  const br = el("responseBodyRaw");
  if (br) {
    br.textContent = cached.bodyRaw || "";
  }
  const preview = el("responseBodyPreview");
  if (preview && cached.bodyRaw && /<html/i.test(cached.bodyRaw)) preview.srcdoc = cached.bodyRaw;
  const rhb = el("respHeadersBody");
  if (rhb && cached.headersHtml) rhb.innerHTML = cached.headersHtml;
  const rcb = el("respCookiesBody");
  if (rcb && cached.cookiesHtml) rcb.innerHTML = cached.cookiesHtml;
  window._lastResponse = cached.bodyRaw;
  switchResponseMode("pretty");
}
function openSaveModal() {
  const sel = document.getElementById("saveCollection");
  sel.innerHTML = '<option value="__new__">+ New Collection</option>';
  state.collections.forEach((c) => {
    sel.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
  });
  sel.onchange = () => {
    const nCG = document.getElementById("newCollectionGroup");
    if (nCG) nCG.style.display = sel.value === "__new__" ? "block" : "none";
    _renderSaveTargetFolders(sel.value);
  };
  sel.value = "__new__";
  const t = state.tabs.find((t2) => t2.id === state.activeTabId);
  const rn = document.getElementById("saveReqName");
  if (rn) rn.value = t ? t.name : "";
  const ncn = document.getElementById("newCollectionName");
  if (ncn) ncn.value = "";
  const ncg = document.getElementById("newCollectionGroup");
  if (ncg) ncg.style.display = "block";
  const stf = document.getElementById("saveTargetFolder");
  if (stf) stf.innerHTML = "";
  document.getElementById("saveModal")?.classList.add("open");
}
function _renderSaveTargetFolders(collectionId) {
  const sel = document.getElementById("saveTargetFolder");
  sel.innerHTML = '<option value="">Collection Root</option>';
  if (collectionId === "__new__") return;
  const col = state.collections.find((c) => c.id === collectionId);
  if (!col) return;
  function addOptions(children, depth) {
    children.forEach((child) => {
      if (child.type === "folder") {
        sel.innerHTML += `<option value="${child.id}">${"  ".repeat(depth)}${escHtml(child.name)}</option>`;
        if (child.children) addOptions(child.children, depth + 1);
      }
    });
  }
  if (col.children) addOptions(col.children, 1);
}
function closeSaveModal() {
  document.getElementById("saveModal")?.classList.remove("open");
}
function saveRequest() {
  saveCurrentTabState();
  const name = document.getElementById("saveReqName").value.trim() || "Request";
  let colId = document.getElementById("saveCollection").value;
  const targetFolderId = document.getElementById("saveTargetFolder")?.value || "";
  if (colId === "__new__") {
    const colName = document.getElementById("newCollectionName").value.trim() || "My Collection";
    const col = makeCollection({ name: colName });
    state.collections.push(col);
    colId = col.id;
    state.openFolders.add(col.id);
  }
  const t = state.tabs.find((t2) => t2.id === state.activeTabId);
  const d = state.activeTabId ? state.tabData[state.activeTabId] : null;
  if (!t || !d) return;
  const req = makeRequest({ name, method: t.method, url: t.url, params: deepClone(d.params), headers: deepClone(d.headers), bodyForm: deepClone(d.bodyForm), bodyType: d.bodyType, body: d.body, graphqlVars: d.graphqlVars, auth: deepClone(d.auth), preRequestScript: d.preRequestScript, testScript: d.testScript });
  const target = targetFolderId ? findNodeInAll(targetFolderId) : findNodeInAll(colId);
  if (target?.children) {
    target.children.push(req);
    t.sourceId = req.id;
  }
  if (d) d.dirty = false;
  saveState();
  renderSidebar();
  closeSaveModal();
  renderTabs();
  showNotif("Saved to collection", "success");
}
function openEnvManager() {
  document.getElementById("envModal")?.classList.add("open");
  setEnvModalTab("envs");
  renderEnvSelector();
  renderEnvManager();
}
function setEnvModalTab(which) {
  setActiveTabBtn("#envModal .env-tab-btn", which, "data-env-tab");
  const envs = document.getElementById("envTabEnvs");
  const globs = document.getElementById("envTabGlobals");
  if (envs) envs.style.display = which === "envs" ? "block" : "none";
  if (globs) globs.style.display = which === "globals" ? "block" : "none";
}
function clearActiveEnv() {
  state.activeEnvId = null;
  saveState();
  renderEnvManager();
  renderEnvSelector();
}
function closeEnvManager() {
  document.getElementById("envModal")?.classList.remove("open");
}
function renderEnvManager() {
  const summary = document.getElementById("envActiveSummary");
  if (summary) {
    const active = state.environments.find((e) => e.id === state.activeEnvId);
    summary.innerHTML = active ? `<strong>Active environment:</strong> ${escHtml(active.name)} <button type="button" class="btn-text" style="margin-left:8px" onclick="clearActiveEnv()">No environment</button>` : "No environment selected — globals still apply.";
  }
  const hint = document.getElementById("envEmptyHint");
  if (hint) {
    if (state.environments.length === 0) {
      hint.style.display = "block";
      hint.innerHTML = "Create an environment to group variables.";
    } else hint.style.display = "none";
  }
  const namedList = document.getElementById("envNamedList");
  if (namedList) {
    namedList.innerHTML = "";
    state.environments.forEach((env) => {
      const sec = document.createElement("div");
      sec.className = "env-section" + (env.id === state.activeEnvId ? " active-env" : "");
      sec.innerHTML = `
        <div class="env-section-header">
          <span class="env-section-title">${escHtml(env.name)}</span>
          <div class="env-actions">
            <button type="button" class="btn-text ${env.id === state.activeEnvId ? "active" : ""}" onclick="setActiveEnv('${env.id}')">${env.id === state.activeEnvId ? "Active" : "Set active"}</button>
            <button type="button" class="btn-text" onclick="renameEnv('${env.id}')">Rename</button>
            <button type="button" class="btn-text ctx-danger" onclick="deleteEnv('${env.id}')">Delete</button>
          </div>
        </div>
        <div class="kv-editor" id="envVars_${env.id}"></div>
        <button type="button" class="add-row-btn" onclick="addEnvVar('${env.id}')">+ Add variable</button>
      `;
      namedList.appendChild(sec);
      _renderEnvVarsEditor(env);
    });
  }
  _renderGlobalVarsEditor();
}
function _renderGlobalVarsEditor() {
  const container = document.getElementById("globalVarsEditor");
  if (!container) return;
  container.innerHTML = "";
  if (state.globalVars.length === 0) state.globalVars = [{ key: "", value: "", enabled: true }];
  state.globalVars.forEach((v, i) => {
    const row = document.createElement("div");
    row.className = "kv-row" + (i % 2 === 1 ? " kv-alt" : "");
    row.innerHTML = `
      <input type="checkbox" class="kv-enabled" ${v.enabled !== false ? "checked" : ""} onchange="state.globalVars[${i}].enabled=this.checked">
      <input type="text" class="kv-input" placeholder="Variable" value="${escHtml(v.key)}" oninput="state.globalVars[${i}].key=this.value">
      <input type="text" class="kv-input" placeholder="Value" value="${escHtml(v.value)}" oninput="state.globalVars[${i}].value=this.value">
      <button class="kv-delete" onclick="state.globalVars.splice(${i},1); renderEnvManager()">&times;</button>
    `;
    container.appendChild(row);
  });
}
function addGlobalVar() {
  state.globalVars.push({ key: "", value: "", enabled: true });
  renderEnvManager();
}
function _renderEnvVarsEditor(env) {
  const container = document.getElementById("envVars_" + env.id);
  if (!container) return;
  container.innerHTML = "";
  if (!env.variables || env.variables.length === 0) env.variables = [{ key: "", value: "", enabled: true }];
  env.variables.forEach((v, i) => {
    const row = document.createElement("div");
    row.className = "kv-row" + (i % 2 === 1 ? " kv-alt" : "");
    row.innerHTML = `
      <input type="checkbox" class="kv-enabled" ${v.enabled !== false ? "checked" : ""} onchange="updateEnvVar('${env.id}',${i},'enabled',this.checked)">
      <input type="text" class="kv-input" placeholder="Variable" value="${escHtml(v.key)}" oninput="updateEnvVar('${env.id}',${i},'key',this.value)">
      <input type="text" class="kv-input" placeholder="Value" value="${escHtml(v.value)}" oninput="updateEnvVar('${env.id}',${i},'value',this.value)">
      <button class="kv-delete" onclick="deleteEnvVar('${env.id}',${i})">&times;</button>
    `;
    container.appendChild(row);
  });
}
function updateEnvVar(envId, idx, field, val) {
  const env = state.environments.find((e) => e.id === envId);
  if (env?.variables[idx]) env.variables[idx][field] = val;
}
function addEnvVar(envId) {
  const env = state.environments.find((e) => e.id === envId);
  if (env) {
    env.variables.push({ key: "", value: "", enabled: true });
    renderEnvManager();
  }
}
function deleteEnvVar(envId, idx) {
  const env = state.environments.find((e) => e.id === envId);
  if (env) {
    env.variables.splice(idx, 1);
    if (env.variables.length === 0) env.variables.push({ key: "", value: "", enabled: true });
    renderEnvManager();
  }
}
function addEnvironmentFromInput() {
  const input = document.getElementById("envNewNameInput");
  const name = (input?.value || "").trim();
  if (!name) {
    showNotif("Enter a name for the environment", "info");
    return;
  }
  state.environments.push({ id: genId(), name, variables: [{ key: "", value: "", enabled: true }] });
  if (input) input.value = "";
  saveState();
  renderEnvManager();
  renderEnvSelector();
}
async function renameEnv(envId) {
  const env = state.environments.find((e) => e.id === envId);
  if (!env) return;
  const name = await appPrompt("Rename environment", void 0, { placeholder: "Environment name", defaultValue: env.name });
  if (name) {
    env.name = name;
    saveState();
    renderEnvManager();
    renderEnvSelector();
  }
}
async function deleteEnv(envId) {
  const env = state.environments.find((e) => e.id === envId);
  const ok = await appConfirm("Delete environment", `Delete "${env ? env.name : "this environment"}"? This cannot be undone.`, { danger: true, okLabel: "Delete" });
  if (!ok) return;
  state.environments = state.environments.filter((e) => e.id !== envId);
  if (state.activeEnvId === envId) state.activeEnvId = null;
  saveState();
  renderEnvManager();
  renderEnvSelector();
}
function setActiveEnv(envId) {
  state.activeEnvId = state.activeEnvId === envId ? null : envId;
  saveState();
  renderEnvManager();
  renderEnvSelector();
}
function saveEnvChanges() {
  saveState();
  renderEnvSelector();
  closeEnvManager();
  showNotif("Environments saved", "success");
}
function renderEnvSelector() {
  const sel = document.getElementById("envSelector");
  if (!sel) return;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "No Environment";
  sel.appendChild(none);
  state.environments.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.name;
    sel.appendChild(opt);
  });
  sel.value = state.activeEnvId && state.environments.some((x) => x.id === state.activeEnvId) ? state.activeEnvId : "";
  hideUrlVarPopover();
}
function exportEnvironments() {
  const data = { _type: "restify_environments", version: 1, environments: deepClone(state.environments), globalVars: deepClone(state.globalVars) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "restify-environments.json";
  a.click();
  URL.revokeObjectURL(a.href);
  showNotif("Environments exported", "success");
}
function importEnvironments(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    try {
      const data = JSON.parse(reader.result);
      if (data._type !== "restify_environments" && data._type !== "restfy_environments" || !Array.isArray(data.environments)) {
        showNotif("Invalid environment file", "error");
        return;
      }
      let added = 0;
      data.environments.forEach((env) => {
        if (!env.name || !env.variables) return;
        if (!state.environments.find((e) => e.name === env.name)) {
          env.id = genId();
          state.environments.push(env);
          added++;
        }
      });
      if (data.globalVars && Array.isArray(data.globalVars)) {
        data.globalVars.forEach((g) => {
          if (g.key && !state.globalVars.find((v) => v.key === g.key)) state.globalVars.push({ key: g.key, value: g.value, enabled: g.enabled !== false });
        });
      }
      saveState();
      renderEnvManager();
      renderEnvSelector();
      showNotif(`Imported ${added} environment(s)`, "success");
    } catch {
      showNotif("Failed to parse environment file", "error");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}
let _urlVarMeasureCanvas = null;
let _urlVarPopoverHideTimer = null;
let _urlVarHitSig = null;
let _urlVarHoverWired = false;
function _getUrlMeasureCtx() {
  const input = document.getElementById("urlInput");
  if (!input) return null;
  if (!_urlVarMeasureCanvas) _urlVarMeasureCanvas = document.createElement("canvas");
  const ctx = _urlVarMeasureCanvas.getContext("2d");
  const cs = getComputedStyle(input);
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return { ctx, input };
}
function _measureTextWidth(upToIndex, fullText) {
  const o = _getUrlMeasureCtx();
  if (!o) return 0;
  return o.ctx.measureText(fullText.slice(0, upToIndex)).width;
}
function _getVarRegions(value) {
  const regions = [];
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(value)) !== null) regions.push({ start: m.index, end: m.index + m[0].length, key: m[1], raw: m[0] });
  return regions;
}
function _hitTestUrlVar(clientX) {
  const input = document.getElementById("urlInput");
  const ws = document.getElementById("requestWorkspace");
  if (!input || !ws || ws.style.display === "none") return null;
  const rect = input.getBoundingClientRect();
  const cs = getComputedStyle(input);
  const x = clientX - rect.left - (parseFloat(cs.paddingLeft) || 0) + input.scrollLeft;
  if (x < 0) return null;
  const regions = _getVarRegions(input.value);
  for (const r of regions) {
    if (x >= _measureTextWidth(r.start, input.value) - 2 && x <= _measureTextWidth(r.end, input.value) + 2) return r;
  }
  return null;
}
function hideUrlVarPopover() {
  const pop = document.getElementById("urlVarPopover");
  if (pop) pop.hidden = true;
  const input = document.getElementById("urlInput");
  if (input) input.classList.remove("url-input--var-hover");
  _urlVarHitSig = null;
}
function _positionUrlVarPopover(clientX, clientY) {
  const pop = document.getElementById("urlVarPopover");
  if (!pop || pop.hidden) return;
  const margin = 10, pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = clientX - pw / 2, top = clientY + margin;
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
  if (top + ph > window.innerHeight - margin) top = clientY - ph - margin;
  pop.style.left = left + "px";
  pop.style.top = Math.max(margin, top) + "px";
}
function _updateUrlVarPopover(hit, clientX, clientY) {
  const pop = document.getElementById("urlVarPopover");
  if (!pop || !hit) return;
  const { key, raw } = hit;
  const { value, source } = lookupVariableKey(key);
  const tokenEl = document.getElementById("urlVarPopoverToken");
  if (tokenEl) tokenEl.textContent = raw;
  const linkEl = document.getElementById("urlVarPopoverValueLink");
  const textEl = document.getElementById("urlVarPopoverValueText");
  if (linkEl) linkEl.style.display = "none";
  if (textEl) {
    textEl.style.display = "none";
    textEl.className = "url-var-popover-value-text";
    textEl.textContent = "";
  }
  const isHttp = (s) => /^https?:\/\/.+/i.test(String(s || "").trim());
  if (source === "unresolved") {
    if (textEl) {
      textEl.style.display = "block";
      textEl.textContent = "No value — variable is not defined";
      textEl.classList.add("url-var-popover-value-muted");
    }
  } else if (value == null || String(value).trim() === "") {
    if (textEl) {
      textEl.style.display = "block";
      textEl.textContent = "(empty value)";
      textEl.classList.add("url-var-popover-value-muted");
    }
  } else if (isHttp(value)) {
    if (linkEl) {
      linkEl.style.display = "inline-block";
      linkEl.href = String(value).trim();
      linkEl.textContent = String(value).trim();
    }
  } else if (textEl) {
    textEl.style.display = "block";
    textEl.textContent = String(value);
  }
  const badge = document.getElementById("urlVarPopoverBadge");
  if (badge) {
    if (source === "environment") badge.innerHTML = '<span class="url-var-popover-badge-icon env">E</span><span>Environment</span>';
    else if (source === "global") badge.innerHTML = '<span class="url-var-popover-badge-icon glob">G</span><span>Global</span>';
    else badge.innerHTML = '<span class="url-var-popover-badge-icon miss">?</span><span>Unresolved</span>';
  }
  const input = document.getElementById("urlInput");
  const fullResolved = input ? resolveVariables(input.value.trim()) : "";
  const resRow = document.getElementById("urlVarPopoverResolvedRow");
  const resLink = document.getElementById("urlVarPopoverResolvedLink");
  if (resRow && resLink) {
    if (fullResolved && isHttp(fullResolved)) {
      resRow.style.display = "block";
      resLink.href = fullResolved.trim();
      resLink.textContent = fullResolved.trim();
    } else resRow.style.display = "none";
  }
  const manageBtn = document.getElementById("urlVarPopoverManageBtn");
  if (manageBtn) manageBtn.onclick = () => {
    hideUrlVarPopover();
    openEnvManager();
  };
  pop.hidden = false;
  requestAnimationFrame(() => _positionUrlVarPopover(clientX, clientY));
}
function setupUrlVariableHover() {
  const input = document.getElementById("urlInput");
  const pop = document.getElementById("urlVarPopover");
  if (!input || !pop || _urlVarHoverWired) return;
  _urlVarHoverWired = true;
  input.addEventListener("mousemove", (e) => {
    const hit = _hitTestUrlVar(e.clientX);
    if (!hit) {
      input.classList.remove("url-input--var-hover");
      _urlVarHitSig = null;
      if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer);
      _urlVarPopoverHideTimer = setTimeout(() => {
        if (!pop.matches(":hover")) hideUrlVarPopover();
      }, 100);
      return;
    }
    if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer);
    input.classList.add("url-input--var-hover");
    const sig = hit.start + ":" + hit.end;
    if (sig !== _urlVarHitSig) {
      _urlVarHitSig = sig;
      _updateUrlVarPopover(hit, e.clientX, e.clientY);
    } else _positionUrlVarPopover(e.clientX, e.clientY);
  });
  input.addEventListener("mouseleave", (e) => {
    if (e.relatedTarget && pop.contains(e.relatedTarget)) return;
    if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer);
    _urlVarPopoverHideTimer = setTimeout(() => {
      if (!pop.matches(":hover")) hideUrlVarPopover();
    }, 120);
  });
  pop.addEventListener("mouseenter", () => {
    if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer);
  });
  pop.addEventListener("mouseleave", (e) => {
    if (e.relatedTarget && input.contains(e.relatedTarget)) return;
    hideUrlVarPopover();
  });
  input.addEventListener("scroll", () => {
    hideUrlVarPopover();
    _syncUrlHighlightScroll();
  });
}
function _syncUrlHighlightScroll() {
  const input = document.getElementById("urlInput");
  const overlay = document.getElementById("urlHighlightOverlay");
  if (input && overlay) overlay.scrollLeft = input.scrollLeft;
}
function setupInputVarTooltips() {
  const handler = (e) => {
    const el = e.target;
    if (!el.matches(".kv-input, .auth-input, .form-input")) return;
    const val = el.value || "";
    el.title = /\{\{\w+\}\}/.test(val) ? resolveVariables(val) : "";
  };
  document.addEventListener("input", handler, true);
  document.addEventListener("focusin", handler, true);
}
async function renderSidebarAppVersion() {
  const row = document.getElementById("sidebarVersionRow");
  if (!row) return;
  let v = typeof window.RESTIFY_APP_VERSION === "string" ? window.RESTIFY_APP_VERSION : "1.0.0";
  if (window.electronAPI?.getAppVersion) {
    try {
      v = await window.electronAPI.getAppVersion();
    } catch {
    }
  }
  row.innerHTML = `<span style="font-size:11px;color:var(--text-dim)">Restify v${v}</span>`;
}
function runPreRequestScript(script, context) {
  if (!script || !script.trim()) return;
  const pm = {
    environment: {
      get: (key) => {
        const env = state.environments.find((e) => e.id === state.activeEnvId);
        if (!env) return void 0;
        const v = env.variables.find((v2) => v2.key === key);
        return v ? v.value : void 0;
      },
      set: (key, value) => {
        const env = state.environments.find((e) => e.id === state.activeEnvId);
        if (!env) return;
        const v = env.variables.find((v2) => v2.key === key);
        if (v) v.value = value;
        else env.variables.push({ key, value, enabled: true });
      }
    },
    globals: {
      get: (key) => {
        const v = state.globalVars.find((v2) => v2.key === key);
        return v ? v.value : void 0;
      },
      set: (key, value) => {
        const v = state.globalVars.find((v2) => v2.key === key);
        if (v) v.value = value;
        else state.globalVars.push({ key, value, enabled: true });
      }
    },
    request: {
      url: context.url,
      method: context.method,
      headers: Object.assign({}, context.headers),
      body: context.body,
      addHeader(key, value) {
        this.headers[key] = value;
      },
      removeHeader(key) {
        delete this.headers[key];
      }
    },
    variables: {
      get: (key) => resolveVariables("{{" + key + "}}"),
      set: (key, value) => {
        const env = state.environments.find((e) => e.id === state.activeEnvId);
        if (env) {
          const v = env.variables.find((v2) => v2.key === key);
          if (v) v.value = value;
          else env.variables.push({ key, value, enabled: true });
        }
      }
    }
  };
  try {
    const fn = new Function("pm", "console", script);
    fn(pm, console);
  } catch (e) {
    throw new Error("Pre-request script error: " + e.message);
  }
  return { url: pm.request.url, method: pm.request.method, headers: pm.request.headers, body: pm.request.body };
}
function runTestScript(script, context) {
  if (!script || !script.trim()) return [];
  const results = [];
  const pm = {
    response: {
      code: context.status,
      status: context.statusText,
      body: context.body,
      headers: context.headers,
      json: () => {
        try {
          return JSON.parse(context.body);
        } catch {
          return null;
        }
      }
    },
    test: (name, fn) => {
      try {
        fn();
        results.push({ name, passed: true });
      } catch (e) {
        results.push({ name, passed: false, error: e.message });
      }
    },
    expect: (actual) => ({
      to: {
        equal: (expected) => {
          if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
        },
        get be() {
          return {
            above: (val) => {
              if (!(actual > val)) throw new Error(`Expected ${actual} to be above ${val}`);
            },
            below: (val) => {
              if (!(actual < val)) throw new Error(`Expected ${actual} to be below ${val}`);
            },
            oneOf: (arr) => {
              if (!arr.includes(actual)) throw new Error(`Expected ${actual} to be one of [${arr}]`);
            },
            a: (type) => {
              if (typeof actual !== type) throw new Error(`Expected type ${type}, got ${typeof actual}`);
            }
          };
        },
        have: {
          property: (prop) => {
            if (typeof actual !== "object" || !(prop in actual)) throw new Error(`Missing property: ${prop}`);
          },
          length: (len) => {
            if (!actual || actual.length !== len) throw new Error(`Expected length ${len}, got ${actual?.length}`);
          }
        },
        include: (val) => {
          if (typeof actual === "string" && !actual.includes(val)) throw new Error(`Expected string to include "${val}"`);
          if (Array.isArray(actual) && !actual.includes(val)) throw new Error(`Expected array to include ${val}`);
        },
        get exist() {
          if (actual === null || actual === void 0) throw new Error("Expected value to exist");
          return true;
        }
      },
      toBe: (expected) => {
        if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
      },
      toContain: (val) => {
        if (!String(actual).includes(val)) throw new Error(`Expected to contain "${val}"`);
      },
      toBeGreaterThan: (val) => {
        if (!(actual > val)) throw new Error(`Expected ${actual} > ${val}`);
      }
    }),
    environment: {
      get: (key) => {
        const env = state.environments.find((e) => e.id === state.activeEnvId);
        const v = env?.variables?.find((v2) => v2.key === key);
        return v ? v.value : void 0;
      },
      set: (key, value) => {
        const env = state.environments.find((e) => e.id === state.activeEnvId);
        if (env) {
          const v = env.variables.find((v2) => v2.key === key);
          if (v) v.value = value;
          else env.variables.push({ key, value, enabled: true });
        }
      }
    },
    globals: {
      get: (key) => {
        const v = state.globalVars.find((v2) => v2.key === key);
        return v ? v.value : void 0;
      },
      set: (key, value) => {
        const v = state.globalVars.find((v2) => v2.key === key);
        if (v) v.value = value;
        else state.globalVars.push({ key, value, enabled: true });
      }
    }
  };
  try {
    const fn = new Function("pm", "console", script);
    fn(pm, console);
  } catch (e) {
    results.push({ name: "Script Execution", passed: false, error: e.message });
  }
  return results;
}
function openImport() {
  state.pendingImport = null;
  const preview = document.getElementById("importPreview");
  const doImportBtn = document.getElementById("doImportBtn");
  const fileInput = document.getElementById("fileInput");
  const ta = document.getElementById("importJsonTextarea");
  const urlInput = document.getElementById("importUrlInput");
  const urlStatus = document.getElementById("importUrlStatus");
  if (preview) preview.style.display = "none";
  if (doImportBtn) doImportBtn.style.display = "none";
  if (fileInput) fileInput.value = "";
  if (ta) ta.value = "";
  if (urlInput) urlInput.value = "";
  if (urlStatus) urlStatus.textContent = "";
  switchImportTab("file");
  document.getElementById("importModal")?.classList.add("open");
}
function closeImport() {
  document.getElementById("importModal")?.classList.remove("open");
}
function switchImportTab(tab) {
  document.querySelectorAll(".import-tab-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.style.background = active ? "var(--bg-light)" : "transparent";
    b.style.color = active ? "var(--text-primary)" : "var(--text-dim)";
    b.classList.toggle("active", active);
  });
  const fileTab = document.getElementById("importTabFile");
  const textTab = document.getElementById("importTabText");
  const linkTab = document.getElementById("importTabLink");
  if (fileTab) fileTab.style.display = tab === "file" ? "block" : "none";
  if (textTab) textTab.style.display = tab === "text" ? "block" : "none";
  if (linkTab) linkTab.style.display = tab === "link" ? "block" : "none";
}
function importFromText() {
  const ta = document.getElementById("importJsonTextarea");
  const raw = (ta?.value || "").trim();
  if (!raw) {
    showNotif("Paste some JSON first", "error");
    return;
  }
  try {
    const data = JSON.parse(raw);
    processImportData(data);
  } catch (err) {
    showNotif("Invalid JSON: " + err.message, "error");
  }
}
async function importFromUrl() {
  const input = document.getElementById("importUrlInput");
  let url = (input?.value || "").trim();
  if (!url) {
    showNotif("Enter a URL", "error");
    return;
  }
  if (!url.startsWith("http")) url = "https://" + url;
  const status = document.getElementById("importUrlStatus");
  status.textContent = "Fetching...";
  status.style.color = "var(--text-dim)";
  try {
    const resp = await window.restifyFetch(url, { method: "GET", headers: { "Accept": "application/json" } });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const text = await resp.text();
    const data = JSON.parse(text);
    status.textContent = "";
    processImportData(data);
  } catch (err) {
    status.textContent = "Failed: " + err.message;
    status.style.color = "var(--red)";
  }
}
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById("dropZone")?.classList.add("drag-over");
}
function handleDragLeave(_e) {
  document.getElementById("dropZone")?.classList.remove("drag-over");
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById("dropZone")?.classList.remove("drag-over");
  const file = e.dataTransfer?.files[0];
  if (file) processImportFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (file) processImportFile(file);
}
function processImportFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      processImportData(data);
    } catch (err) {
      showNotif("Invalid JSON file: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}
function processImportData(data) {
  const result = parsePostmanCollection(data);
  if (result) {
    let collectReqs = function(node) {
      if (node.type === "request") requests.push(node);
      if (node.children) node.children.forEach(collectReqs);
    };
    state.pendingImport = result;
    const preview = document.getElementById("importPreview");
    preview.style.display = "block";
    const requests = [];
    result.children.forEach(collectReqs);
    preview.innerHTML = `
      <div style="margin-bottom:8px; font-weight:600; color: var(--text-primary);">${escHtml(result.name)}</div>
      <div style="color: var(--text-secondary);">${requests.length} request${requests.length !== 1 ? "s" : ""}, ${result.children.filter((c) => c.type === "folder").length} folder(s)</div>
      <div style="margin-top:8px; max-height:150px; overflow-y:auto;">
        ${requests.slice(0, 30).map((r) => `<div style="padding:3px 0; display:flex; gap:8px; align-items:center;">
          <span class="req-method-badge m-${r.method} bg-${r.method}" style="font-size:9px">${r.method}</span>
          <span style="font-size:12px; color:var(--text-secondary)">${escHtml(r.name)}</span>
        </div>`).join("")}
        ${requests.length > 30 ? `<div style="color:var(--text-dim);font-size:11px">...and ${requests.length - 30} more</div>` : ""}
      </div>
    `;
    const doImportBtn = document.getElementById("doImportBtn");
    doImportBtn.style.display = "inline-flex";
  }
}
function parsePostmanCollection(data) {
  if (!data.info || !data.item) {
    showNotif("Not a valid Postman collection", "error");
    return null;
  }
  const col = makeCollection({ name: data.info.name || "Imported Collection" });
  if (data.auth) col.auth = parsePostmanAuth(data.auth);
  function parseItems(items) {
    return items.map((item) => {
      if (item.item) {
        const folder = makeFolder({ name: item.name || "Folder" });
        if (item.auth) folder.auth = parsePostmanAuth(item.auth);
        folder.children = parseItems(item.item);
        return folder;
      }
      if (item.request) {
        const r = item.request;
        const method = (typeof r.method === "string" ? r.method : "GET").toUpperCase();
        const url = typeof r.url === "string" ? r.url : r.url?.raw || "";
        const params = [];
        if (r.url?.query) r.url.query.forEach((q) => params.push({ key: q.key || "", value: q.value || "", enabled: !q.disabled }));
        if (params.length === 0) params.push({ key: "", value: "", enabled: true });
        const headers = [];
        if (r.header) r.header.forEach((h) => headers.push({ key: h.key || "", value: h.value || "", enabled: !h.disabled }));
        if (headers.length === 0) headers.push({ key: "", value: "", enabled: true });
        let bodyType = "none", body = "", bodyForm = [{ key: "", value: "", enabled: true }];
        if (r.body) {
          if (r.body.mode === "raw") {
            body = r.body.raw || "";
            bodyType = r.body.options?.raw?.language === "json" ? "json" : "raw";
          } else if (r.body.mode === "formdata") {
            bodyType = "form";
            bodyForm = (r.body.formdata || []).map((f) => ({ key: f.key || "", value: f.value || "", enabled: !f.disabled }));
          } else if (r.body.mode === "urlencoded") {
            bodyType = "urlencoded";
            bodyForm = (r.body.urlencoded || []).map((f) => ({ key: f.key || "", value: f.value || "", enabled: !f.disabled }));
          } else if (r.body.mode === "graphql") {
            bodyType = "graphql";
            body = r.body.graphql?.query || "";
          }
          if (bodyForm.length === 0) bodyForm.push({ key: "", value: "", enabled: true });
        }
        const auth = r.auth ? parsePostmanAuth(r.auth) : { type: "none" };
        return makeRequest({ name: item.name || "Request", method, url, params, headers, bodyType, body, bodyForm, auth });
      }
      return null;
    }).filter(Boolean);
  }
  col.children = parseItems(data.item);
  return col;
}
function parsePostmanAuth(pmAuth) {
  if (!pmAuth) return { type: "none" };
  if (pmAuth.type === "bearer") {
    const t = (pmAuth.bearer || []).find((b) => b.key === "token");
    return { type: "bearer", token: t?.value || "" };
  }
  if (pmAuth.type === "basic") {
    const u = (pmAuth.basic || []).find((b) => b.key === "username");
    const p = (pmAuth.basic || []).find((b) => b.key === "password");
    return { type: "basic", username: u?.value || "", password: p?.value || "" };
  }
  if (pmAuth.type === "apikey") {
    const k = (pmAuth.apikey || []).find((b) => b.key === "key");
    const v = (pmAuth.apikey || []).find((b) => b.key === "value");
    return { type: "apikey", key: k?.value || "X-API-Key", value: v?.value || "" };
  }
  return { type: "none" };
}
function doImport() {
  if (!state.pendingImport) return;
  state.collections.push(state.pendingImport);
  state.openFolders.add(state.pendingImport.id);
  saveState();
  if (typeof window.renderSidebar === "function") window.renderSidebar();
  closeImport();
  showNotif(`Imported "${state.pendingImport.name}"`, "success");
  state.pendingImport = null;
}
async function openCurlImport() {
  const curl = await window.appPrompt("Import cURL", "Paste a cURL command below.", {
    textarea: true,
    placeholder: 'curl https://api.example.com/endpoint -H "Authorization: Bearer ..."',
    okLabel: "Import"
  });
  if (!curl) return;
  try {
    const req = parseCurl(curl);
    window.newTab(req);
    showNotif("Imported from cURL", "success");
  } catch (e) {
    showNotif("Failed to parse cURL: " + e.message, "error");
  }
}
function parseCurl(curlStr) {
  const req = makeRequest();
  curlStr = curlStr.replace(/\\\n/g, " ").trim();
  if (curlStr.startsWith("curl ")) curlStr = curlStr.substring(5);
  const urlMatch = curlStr.match(/(?:^|\s)(['"]?)(https?:\/\/[^\s'"]+)\1/);
  if (urlMatch) req.url = urlMatch[2];
  const methodMatch = curlStr.match(/-X\s+(\w+)/);
  if (methodMatch) req.method = methodMatch[1].toUpperCase();
  const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
  let hm;
  const headers = [];
  while ((hm = headerRegex.exec(curlStr)) !== null) {
    const [key, ...rest] = hm[1].split(":");
    headers.push({ key: key.trim(), value: rest.join(":").trim(), enabled: true });
  }
  if (headers.length > 0) req.headers = headers;
  const dataMatch = curlStr.match(/(?:-d|--data|--data-raw)\s+['"](.+?)['"]/);
  if (dataMatch) {
    req.body = dataMatch[1];
    if (!req.method || req.method === "GET") req.method = "POST";
    try {
      JSON.parse(req.body);
      req.bodyType = "json";
    } catch {
      req.bodyType = "raw";
    }
  }
  if (!req.method) req.method = "GET";
  req.name = req.url ? req.url.replace(/https?:\/\//, "").split("?")[0].split("/").pop() || "Request" : "Request";
  return req;
}
function exportCollectionAsPostman(colId) {
  const col = findNodeInAll(colId);
  if (!col) return;
  const postmanData = {
    info: { name: col.name, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    item: exportItems(col.children)
  };
  if (col.auth?.type !== "none") postmanData.auth = exportAuth(col.auth);
  downloadJson(postmanData, col.name + ".postman_collection.json");
  showNotif("Collection exported", "success");
}
function exportItems(children) {
  if (!children) return [];
  return children.map((child) => {
    if (child.type === "folder") {
      const item2 = { name: child.name, item: exportItems(child.children) };
      if (child.auth?.type !== "none") item2.auth = exportAuth(child.auth);
      return item2;
    }
    const item = {
      name: child.name,
      request: {
        method: child.method,
        url: { raw: child.url, query: child.params?.filter((p) => p.key).map((p) => ({ key: p.key, value: p.value, disabled: !p.enabled })) || [] },
        header: child.headers?.filter((h) => h.key).map((h) => ({ key: h.key, value: h.value, disabled: !h.enabled })) || []
      }
    };
    if (child.bodyType !== "none") {
      if (child.bodyType === "json") item.request.body = { mode: "raw", raw: child.body, options: { raw: { language: "json" } } };
      else if (child.bodyType === "raw") item.request.body = { mode: "raw", raw: child.body };
      else if (child.bodyType === "form") item.request.body = { mode: "formdata", formdata: child.bodyForm?.filter((f) => f.key).map((f) => ({ key: f.key, value: f.value, disabled: !f.enabled })) || [] };
      else if (child.bodyType === "urlencoded") item.request.body = { mode: "urlencoded", urlencoded: child.bodyForm?.filter((f) => f.key).map((f) => ({ key: f.key, value: f.value, disabled: !f.enabled })) || [] };
      else if (child.bodyType === "graphql") item.request.body = { mode: "graphql", graphql: { query: child.body } };
    }
    if (child.auth?.type !== "none" && child.auth?.type !== "inherit") item.request.auth = exportAuth(child.auth);
    return item;
  });
}
function exportAuth(auth) {
  if (auth.type === "bearer") return { type: "bearer", bearer: [{ key: "token", value: auth.token }] };
  if (auth.type === "basic") return { type: "basic", basic: [{ key: "username", value: auth.username }, { key: "password", value: auth.password }] };
  if (auth.type === "apikey") return { type: "apikey", apikey: [{ key: "key", value: auth.key }, { key: "value", value: auth.value }] };
  return { type: "noauth" };
}
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function generateCurl() {
  if (typeof window.saveCurrentTabState === "function") window.saveCurrentTabState();
  const method = document.getElementById("methodSelect").value;
  let url = resolveVariables(document.getElementById("urlInput").value.trim());
  if (!url.startsWith("http")) url = "https://" + url;
  const getKvStore2 = window.getKvStore;
  const getAuthState2 = window.getAuthState;
  const params = getKvStore2("params").filter((r) => r.enabled && r.key);
  if (params.length) {
    const qs = params.map((r) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join("&");
    url += (url.includes("?") ? "&" : "?") + qs;
  }
  const parts = [`curl -X ${method}`, `  '${url}'`];
  const allHeaders = {};
  getKvStore2("headers").filter((r) => r.enabled && r.key).forEach((r) => {
    allHeaders[resolveVariables(r.key)] = resolveVariables(r.value);
  });
  const auth = getAuthState2();
  if (auth.type === "bearer") allHeaders["Authorization"] = `Bearer ${resolveVariables(auth.token)}`;
  else if (auth.type === "basic") allHeaders["Authorization"] = "Basic " + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`);
  else if (auth.type === "apikey") allHeaders[resolveVariables(auth.key)] = resolveVariables(auth.value);
  if (state.currentBodyType === "json" && !allHeaders["Content-Type"]) allHeaders["Content-Type"] = "application/json";
  if (state.currentBodyType === "urlencoded" && !allHeaders["Content-Type"]) allHeaders["Content-Type"] = "application/x-www-form-urlencoded";
  Object.entries(allHeaders).forEach(([k, v]) => {
    parts.push(`  -H '${k}: ${v}'`);
  });
  if (method !== "GET" && method !== "HEAD") {
    if (state.currentBodyType === "json" || state.currentBodyType === "raw") {
      const body = resolveVariables(document.getElementById("bodyTextarea").value);
      if (body) parts.push(`  -d '${body.replace(/'/g, "'\\''")}'`);
    } else if (state.currentBodyType === "form") {
      getKvStore2("bodyForm").filter((r) => r.enabled && r.key).forEach((r) => {
        parts.push(`  -F '${resolveVariables(r.key)}=${resolveVariables(r.value)}'`);
      });
    } else if (state.currentBodyType === "urlencoded") {
      const body = getKvStore2("bodyForm").filter((r) => r.enabled && r.key).map((r) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join("&");
      if (body) parts.push(`  -d '${body}'`);
    } else if (state.currentBodyType === "graphql") {
      const query = resolveVariables(document.getElementById("bodyTextarea").value);
      const vars = document.getElementById("graphqlVarsTextarea")?.value || "{}";
      parts.push(`  -d '${JSON.stringify({ query, variables: JSON.parse(resolveVariables(vars) || "{}") }).replace(/'/g, "'\\''")}'`);
    }
  }
  const curl = parts.join(" \\\n");
  navigator.clipboard.writeText(curl).then(() => showNotif("cURL copied to clipboard", "success"));
  return curl;
}
function openCodeGen() {
  document.getElementById("codeGenModal")?.classList.add("open");
  generateCodeSnippet("javascript_fetch");
}
function closeCodeGen() {
  document.getElementById("codeGenModal")?.classList.remove("open");
  const title = document.getElementById("codeGenTitle");
  if (title) title.textContent = "Generate Code Snippet";
  const langs = document.querySelector(".codegen-langs");
  if (langs) langs.style.display = "";
}
function generateCodeSnippet(lang) {
  document.querySelectorAll(".codegen-lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  if (typeof window.saveCurrentTabState === "function") window.saveCurrentTabState();
  const method = document.getElementById("methodSelect").value;
  let url = resolveVariables(document.getElementById("urlInput").value.trim());
  if (!url.startsWith("http")) url = "https://" + url;
  const getKvStore2 = window.getKvStore;
  const getAuthState2 = window.getAuthState;
  const params = getKvStore2("params").filter((r) => r.enabled && r.key);
  if (params.length) {
    const qs = params.map((r) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join("&");
    url += (url.includes("?") ? "&" : "?") + qs;
  }
  const hdrs = {};
  getKvStore2("headers").filter((r) => r.enabled && r.key).forEach((r) => {
    hdrs[resolveVariables(r.key)] = resolveVariables(r.value);
  });
  const auth = getAuthState2();
  if (auth.type === "bearer") hdrs["Authorization"] = `Bearer ${resolveVariables(auth.token)}`;
  else if (auth.type === "basic") hdrs["Authorization"] = "Basic " + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`);
  else if (auth.type === "apikey") hdrs[resolveVariables(auth.key)] = resolveVariables(auth.value);
  if (state.currentBodyType === "json" && !hdrs["Content-Type"]) hdrs["Content-Type"] = "application/json";
  let bodyStr = "";
  if (method !== "GET" && method !== "HEAD" && (state.currentBodyType === "json" || state.currentBodyType === "raw")) {
    bodyStr = resolveVariables(document.getElementById("bodyTextarea").value);
  }
  let code = "";
  if (lang === "javascript_fetch") code = genJsFetch(method, url, hdrs, bodyStr);
  else if (lang === "javascript_axios") code = genJsAxios(method, url, hdrs, bodyStr);
  else if (lang === "python") code = genPython(method, url, hdrs, bodyStr);
  else if (lang === "go") code = genGo(method, url, hdrs, bodyStr);
  else if (lang === "php") code = genPhp(method, url, hdrs, bodyStr);
  else if (lang === "curl") code = generateCurl();
  const output = document.getElementById("codeGenOutput");
  if (output) output.textContent = code;
}
function genJsFetch(method, url, hdrs, body) {
  let code = `const response = await fetch('${url}', {
  method: '${method}'`;
  if (Object.keys(hdrs).length) code += `,
  headers: ${JSON.stringify(hdrs, null, 4).replace(/\n/g, "\n  ")}`;
  if (body) code += `,
  body: ${/^\{/.test(body.trim()) ? `JSON.stringify(${body})` : `'${body.replace(/'/g, "\\'")}'`}`;
  code += `
});

const data = await response.json();
console.log(data);`;
  return code;
}
function genJsAxios(method, url, hdrs, body) {
  let code = `const axios = require('axios');

const response = await axios({
  method: '${method.toLowerCase()}',
  url: '${url}'`;
  if (Object.keys(hdrs).length) code += `,
  headers: ${JSON.stringify(hdrs, null, 4).replace(/\n/g, "\n  ")}`;
  if (body) code += `,
  data: ${body}`;
  code += `
});

console.log(response.data);`;
  return code;
}
function genPython(method, url, hdrs, body) {
  let code = `import requests

response = requests.${method.toLowerCase()}(
    '${url}'`;
  if (Object.keys(hdrs).length) code += `,
    headers=${JSON.stringify(hdrs).replace(/"/g, "'")}`;
  if (body) code += `,
    json=${body}`;
  code += `
)

print(response.json())`;
  return code;
}
function genGo(method, url, hdrs, body) {
  let code = `package main

import (
    "fmt"
    "io"
    "net/http"
`;
  if (body) code += `    "strings"
`;
  code += `)

func main() {
`;
  if (body) code += `    body := strings.NewReader(\`${body}\`)
    req, _ := http.NewRequest("${method}", "${url}", body)
`;
  else code += `    req, _ := http.NewRequest("${method}", "${url}", nil)
`;
  Object.entries(hdrs).forEach(([k, v]) => {
    code += `    req.Header.Set("${k}", "${v}")
`;
  });
  code += `
    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()
    data, _ := io.ReadAll(resp.Body)
    fmt.Println(string(data))
}`;
  return code;
}
function genPhp(method, url, hdrs, body) {
  let code = `<?php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, '${url}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');
`;
  const hdrArr = Object.entries(hdrs).map(([k, v]) => `'${k}: ${v}'`);
  if (hdrArr.length) code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [${hdrArr.join(", ")}]);
`;
  if (body) code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${body.replace(/'/g, "\\'")}');
`;
  code += `
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`;
  return code;
}
function copyCodeGen() {
  const code = document.getElementById("codeGenOutput")?.textContent || "";
  navigator.clipboard.writeText(code).then(() => showNotif("Code copied!", "success"));
}
async function runCollection(colId) {
  const col = findNodeInAll(colId);
  if (!col) return;
  const requests = [];
  function collect(node) {
    if (node.type === "request") requests.push({ req: node, id: node.id });
    if (node.children) node.children.forEach((c) => collect(c));
  }
  collect(col);
  if (requests.length === 0) {
    showNotif("No requests to run", "error");
    return;
  }
  showNotif(`Running ${requests.length} requests...`, "info");
  const results = [];
  for (const { req } of requests) {
    let url = resolveVariables(req.url);
    if (!url.startsWith("http")) url = "https://" + url;
    const params = (req.params || []).filter((r) => r.enabled && r.key);
    if (params.length) {
      const qs = params.map((r) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join("&");
      url += (url.includes("?") ? "&" : "?") + qs;
    }
    const headers = {};
    const chain = getAncestorChain(req.id);
    chain.forEach((ancestor) => {
      if (ancestor.headers) ancestor.headers.forEach((h) => {
        if (h.enabled !== false && h.key) headers[resolveVariables(h.key)] = resolveVariables(h.value);
      });
    });
    (req.headers || []).filter((r) => r.enabled && r.key).forEach((r) => {
      headers[resolveVariables(r.key)] = resolveVariables(r.value);
    });
    let auth = req.auth || { type: "none" };
    if (!auth || auth.type === "none" || auth.type === "inherit") {
      const inheritedAuth = getInheritedAuth(req.id);
      if (inheritedAuth) auth = inheritedAuth.auth;
    }
    if (auth.type === "bearer") headers["Authorization"] = `Bearer ${resolveVariables(auth.token)}`;
    else if (auth.type === "basic") headers["Authorization"] = "Basic " + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`);
    else if (auth.type === "apikey") headers[resolveVariables(auth.key)] = resolveVariables(auth.value);
    if (req.bodyType === "json" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const opts = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.bodyType === "json" || req.bodyType === "raw") opts.body = resolveVariables(req.body);
      else if (req.bodyType === "urlencoded") {
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
        opts.body = (req.bodyForm || []).filter((r) => r.enabled && r.key).map((r) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join("&");
      }
    }
    let reqCtx = { url, method: req.method, headers, body: opts.body };
    for (const ancestor of chain) {
      if (ancestor.preRequestScript) {
        try {
          const r = runPreRequestScript(ancestor.preRequestScript, reqCtx);
          if (r) Object.assign(reqCtx, r);
        } catch (e) {
          results.push({ name: req.name, method: req.method, status: "ERR", time: 0, passed: false, error: "Pre-req script: " + e.message });
          continue;
        }
      }
    }
    if (req.preRequestScript) {
      try {
        const r = runPreRequestScript(req.preRequestScript, reqCtx);
        if (r) Object.assign(reqCtx, r);
      } catch (e) {
        results.push({ name: req.name, method: req.method, status: "ERR", time: 0, passed: false, error: "Pre-req script: " + e.message });
        continue;
      }
    }
    opts.method = reqCtx.method;
    Object.assign(headers, reqCtx.headers);
    if (reqCtx.body !== void 0) opts.body = reqCtx.body;
    const start = Date.now();
    try {
      const resp = await window.restifyFetch(reqCtx.url, opts);
      const respText = await resp.text();
      let testResults = [];
      const respCtx = { status: resp.status, statusText: resp.statusText, body: respText, headers: Object.fromEntries(resp.headers.entries()) };
      for (const ancestor of chain) {
        if (ancestor.testScript) {
          try {
            testResults = testResults.concat(runTestScript(ancestor.testScript, respCtx));
          } catch {
          }
        }
      }
      if (req.testScript) {
        try {
          testResults = testResults.concat(runTestScript(req.testScript, respCtx));
        } catch {
        }
      }
      const testFailed = testResults.some((t) => !t.passed);
      results.push({ name: req.name, method: req.method, status: resp.status, time: Date.now() - start, passed: resp.status < 400 && !testFailed, tests: testResults });
    } catch (e) {
      results.push({ name: req.name, method: req.method, status: "ERR", time: Date.now() - start, passed: false, error: e.message });
    }
  }
  showRunnerResults(results);
}
function showRunnerResults(results) {
  const modal = document.getElementById("codeGenModal");
  modal?.classList.add("open");
  const titleEl = document.getElementById("codeGenTitle");
  if (titleEl) titleEl.textContent = "Collection Runner Results";
  const output = document.getElementById("codeGenOutput");
  if (!output) return;
  let html = "";
  let passed = 0, failed = 0;
  results.forEach((r) => {
    if (r.passed) passed++;
    else failed++;
    html += `${r.passed ? "✓" : "✗"} [${r.method}] ${r.name} - ${r.status} (${r.time}ms)${r.error ? " - " + r.error : ""}
`;
  });
  html = `Results: ${passed} passed, ${failed} failed
${"─".repeat(50)}
` + html;
  output.textContent = html;
  const langs = document.querySelector(".codegen-langs");
  if (langs) langs.style.display = "none";
}
function _publishApiRoot() {
  if (typeof window.getRestifyApiBase === "function") {
    const b = window.getRestifyApiBase();
    if (b) return String(b).replace(/\/+$/, "");
  }
  return "https://api.restify.online";
}
function shareQuickUrl() {
  if (typeof window.restifyApiUrl === "function") {
    const u = window.restifyApiUrl("/api/share/quick");
    if (/^https?:\/\//i.test(u)) return u;
  }
  return _publishApiRoot() + "/api/share/quick";
}
function apiSharedUrl(id) {
  if (typeof window.restifyApiUrl === "function") {
    const u = window.restifyApiUrl("/api/shared/" + encodeURIComponent(id));
    if (/^https?:\/\//i.test(u)) return u;
  }
  return _publishApiRoot() + "/api/shared/" + encodeURIComponent(id);
}
async function shareCollection(colId) {
  const col = findNodeInAll(colId);
  if (!col) return;
  const shareData = deepClone(col);
  try {
    const resp = await fetch(shareQuickUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection: shareData, name: col.name })
    });
    const text = await resp.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith("<")) {
      throw new Error(
        "API returned a web page instead of JSON. On desktop, ensure the Restify API is running or reachable (default https://api.restify.online)."
      );
    }
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("Invalid response from server");
    }
    if (!resp.ok) throw new Error(result.error || "Server returned " + resp.status);
    showShareResult(result, col.name);
    showNotif("Published online — copy the documentation link to share", "success");
  } catch (err) {
    showNotif("Publish failed: " + err.message, "error");
  }
}
function showShareResult(result, name) {
  const nameEl = document.getElementById("shareCollectionName");
  const docUrlEl = document.getElementById("shareDocUrl");
  const importUrlEl = document.getElementById("shareImportUrl");
  const docLinkEl = document.getElementById("shareDocLink");
  const shareModal = document.getElementById("shareModal");
  if (nameEl) nameEl.textContent = name;
  if (docUrlEl) docUrlEl.value = result.docUrl;
  if (importUrlEl) importUrlEl.value = result.importUrl;
  if (docLinkEl) docLinkEl.href = result.docUrl;
  shareModal?.classList.add("open");
}
function closeShareModal() {
  document.getElementById("shareModal")?.classList.remove("open");
}
function copyShareUrl(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => showNotif("Link copied!", "success"));
}
async function checkAutoImport() {
  const params = new URLSearchParams(window.location.search);
  const importId = params.get("import");
  if (!importId) return;
  try {
    const resp = await fetch(apiSharedUrl(importId));
    if (!resp.ok) throw new Error("Collection not found");
    const data = await resp.json();
    if (data.collection) {
      const col = data.collection;
      assignNewIds(col);
      state.collections.push(col);
      state.openFolders.add(col.id);
      saveState();
      if (typeof window.renderSidebar === "function") window.renderSidebar();
      showNotif(`Imported "${col.name}"`, "success");
      window.history.replaceState({}, "", "/");
    }
  } catch (err) {
    showNotif("Import failed: " + err.message, "error");
  }
}
const CLOUD_DEFAULT = "https://api.restify.online";
const LS_CLOUD_SESSION = "restify_cloud_session";
const LS_CLOUD_SESSION_LEGACY = "restfy_cloud_session";
const LS_CLOUD_URL = "restify_cloud_url";
const LS_CLOUD_URL_LEGACY = "restfy_cloud_url";
function cloudBase() {
  const u = localStorage.getItem(LS_CLOUD_URL) || localStorage.getItem(LS_CLOUD_URL_LEGACY);
  const t = u && String(u).trim();
  const raw = t || CLOUD_DEFAULT;
  return String(raw).replace(/\/+$/, "");
}
function cloudApiUrl(path) {
  const p = path.charAt(0) === "/" ? path : "/" + path;
  return cloudBase() + p;
}
async function _cloudReadJson(resp) {
  const text = await resp.text();
  const trimmed = text.trimStart();
  if (!trimmed || trimmed.startsWith("<")) {
    throw new Error(
      "Server returned a web page instead of JSON. Use the API base only (e.g. https://api.restify.online), not the web app URL."
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON from server.");
  }
  if (!resp.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}
let _cloudUser = null;
let _cloudToken = null;
let _syncInProgress = false;
let _lastSyncAt = 0;
function _cloudHeaders() {
  const h = { "Content-Type": "application/json" };
  if (_cloudToken) h["Authorization"] = "Bearer " + _cloudToken;
  return h;
}
function _loadCloudSession() {
  try {
    const s = localStorage.getItem(LS_CLOUD_SESSION) || localStorage.getItem(LS_CLOUD_SESSION_LEGACY);
    if (s) {
      const parsed = JSON.parse(s);
      _cloudUser = parsed.user;
      _cloudToken = parsed.token;
      _lastSyncAt = parsed.lastSyncAt || 0;
    }
  } catch {
  }
}
function _saveCloudSession() {
  if (_cloudUser && _cloudToken) {
    localStorage.setItem(
      LS_CLOUD_SESSION,
      JSON.stringify({ user: _cloudUser, token: _cloudToken, lastSyncAt: _lastSyncAt })
    );
    localStorage.removeItem(LS_CLOUD_SESSION_LEGACY);
  } else {
    localStorage.removeItem(LS_CLOUD_SESSION);
    localStorage.removeItem(LS_CLOUD_SESSION_LEGACY);
  }
}
async function cloudRegister(email, password, name) {
  const resp = await fetch(cloudApiUrl("/api/auth/register"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });
  const data = await _cloudReadJson(resp);
  _cloudUser = data.user;
  _cloudToken = data.token;
  _saveCloudSession();
  return data;
}
async function cloudLogin(email, password) {
  const resp = await fetch(cloudApiUrl("/api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await _cloudReadJson(resp);
  _cloudUser = data.user;
  _cloudToken = data.token;
  _saveCloudSession();
  return data;
}
async function cloudLogout() {
  try {
    await fetch(cloudApiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
  } catch (_) {
  }
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
    const colResp = await fetch(cloudApiUrl("/api/collections/sync"), {
      method: "POST",
      credentials: "include",
      headers: _cloudHeaders(),
      body: JSON.stringify({ collections: state.collections, lastSyncAt: _lastSyncAt })
    });
    if (colResp.status === 401) {
      void cloudLogout();
      throw new Error("Session expired");
    }
    const colData = await _cloudReadJson(colResp);
    const envResp = await fetch(cloudApiUrl("/api/environments/sync"), {
      method: "POST",
      credentials: "include",
      headers: _cloudHeaders(),
      body: JSON.stringify({ environments: state.environments, globalVars: state.globalVars })
    });
    const envData = await _cloudReadJson(envResp);
    if (colData.collections) {
      state.collections.length = 0;
      colData.collections.forEach((c) => {
        delete c._syncedAt;
        state.collections.push(c);
      });
    }
    if (envData.environments) {
      state.environments.length = 0;
      envData.environments.forEach((e) => {
        delete e._syncedAt;
        state.environments.push(e);
      });
    }
    if (envData.globalVars) {
      state.globalVars.length = 0;
      envData.globalVars.forEach((v) => state.globalVars.push(v));
    }
    _lastSyncAt = colData.syncedAt || Math.floor(Date.now() / 1e3);
    _saveCloudSession();
    saveState();
    if (typeof window.renderSidebar === "function") window.renderSidebar();
    if (typeof window.renderEnvSelector === "function") window.renderEnvSelector();
    showNotif("Synced with cloud", "success");
  } catch (err) {
    showNotif("Sync error: " + err.message, "error");
  } finally {
    _syncInProgress = false;
    renderCloudStatus();
  }
}
function renderCloudStatus() {
  const el = document.getElementById("cloudStatusArea");
  if (!el) return;
  if (!_cloudToken) {
    el.innerHTML = '<button class="cloud-login-btn" onclick="openCloudModal()">Sign in</button>';
    return;
  }
  const initial = (_cloudUser.name || _cloudUser.email || "?").charAt(0).toUpperCase();
  el.innerHTML = `
    <div class="cloud-status-pill" onclick="openCloudModal()" title="${escHtml(_cloudUser.email)}">
      <span class="cloud-avatar">${initial}</span>
      <span class="cloud-sync-icon ${_syncInProgress ? "spinning" : ""}">↻</span>
    </div>
  `;
}
function openCloudModal() {
  if (_cloudToken) {
    _renderCloudAccountView();
  } else {
    _renderCloudLoginView();
  }
  document.getElementById("cloudModal")?.classList.add("open");
}
function closeCloudModal() {
  document.getElementById("cloudModal")?.classList.remove("open");
}
function _renderCloudLoginView() {
  const body = document.getElementById("cloudModalBody");
  if (!body) return;
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
        <div style="font-size:11px;color:var(--text-dim)">Server: <input type="text" id="cloudServerUrl" class="form-input" style="width:200px;display:inline;font-size:11px;padding:3px 6px" value="${escHtml(cloudBase())}" onchange="(function(v){v=String(v).trim().replace(/\\/+$/, '');localStorage.setItem('${LS_CLOUD_URL}', v);localStorage.removeItem('${LS_CLOUD_URL_LEGACY}');})(this.value)"></div>
      </div>
    </div>
  `;
  setTimeout(() => document.getElementById("cloudEmail")?.focus(), 100);
}
let _cloudAuthMode = "login";
function _switchCloudTab(mode) {
  _cloudAuthMode = mode;
  document.getElementById("cloudTabLogin")?.classList.toggle("active", mode === "login");
  document.getElementById("cloudTabRegister")?.classList.toggle("active", mode === "register");
  const nameGroup = document.getElementById("cloudNameGroup");
  if (nameGroup) nameGroup.style.display = mode === "register" ? "block" : "none";
  const submitBtn = document.getElementById("cloudSubmitBtn");
  if (submitBtn) submitBtn.textContent = mode === "login" ? "Sign In" : "Create Account";
  const errEl = document.getElementById("cloudError");
  if (errEl) errEl.style.display = "none";
}
async function _submitCloudAuth() {
  const email = document.getElementById("cloudEmail").value.trim();
  const password = document.getElementById("cloudPassword").value;
  const nameEl = document.getElementById("cloudName");
  const name = nameEl?.value?.trim() || "";
  const errEl = document.getElementById("cloudError");
  if (!email || !password) {
    errEl.textContent = "Email and password are required";
    errEl.style.display = "block";
    return;
  }
  const btn = document.getElementById("cloudSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Please wait...";
  try {
    if (_cloudAuthMode === "register") {
      await cloudRegister(email, password, name);
    } else {
      await cloudLogin(email, password);
    }
    closeCloudModal();
    renderCloudStatus();
    cloudSync();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = _cloudAuthMode === "login" ? "Sign In" : "Create Account";
  }
}
function _renderCloudAccountView() {
  const body = document.getElementById("cloudModalBody");
  if (!body) return;
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div class="cloud-avatar-large">${(_cloudUser.name || _cloudUser.email || "?").charAt(0).toUpperCase()}</div>
      <div style="font-size:16px;font-weight:600;margin-top:8px">${escHtml(_cloudUser.name || "Restify User")}</div>
      <div style="font-size:13px;color:var(--text-dim)">${escHtml(_cloudUser.email)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn-primary" style="width:100%" onclick="cloudSync(); closeCloudModal();">↻ Sync Now</button>
      <button class="btn-secondary" style="width:100%" onclick="_cloudAutoSync()">Enable Auto-Sync</button>
      <div style="border-top:1px solid var(--border);margin:8px 0"></div>
      <button class="btn-secondary" style="width:100%;color:var(--red);border-color:var(--red)" onclick="cloudLogout(); closeCloudModal();">Sign Out</button>
    </div>
    <div style="margin-top:16px;font-size:11px;color:var(--text-dim);text-align:center">
      Last synced: ${_lastSyncAt ? new Date(_lastSyncAt * 1e3).toLocaleString() : "Never"}
    </div>
  `;
}
let _autoSyncInterval = null;
function _cloudAutoSync() {
  if (_autoSyncInterval) {
    clearInterval(_autoSyncInterval);
    _autoSyncInterval = null;
    showNotif("Auto-sync disabled", "info");
    return;
  }
  _autoSyncInterval = setInterval(() => {
    if (_cloudToken) cloudSync();
  }, 6e4);
  showNotif("Auto-sync enabled (every 60s)", "success");
}
_loadCloudSession();
let _activeAbortController = null;
let _requestElapsedTimer = null;
function cancelRequest() {
  if (_activeAbortController) {
    _activeAbortController.abort();
    _activeAbortController = null;
  }
}
async function sendRequest() {
  const methodSel = document.getElementById("methodSelect");
  const urlInput = document.getElementById("urlInput");
  let method = methodSel.value;
  let url = urlInput.value.trim();
  if (!url) {
    showNotif("Please enter a URL", "error");
    return;
  }
  if (!url.startsWith("http")) url = "https://" + url;
  url = resolveVariables(url);
  const params = getKvStore("params").filter((r) => r.enabled && r.key);
  if (params.length) {
    const qs = params.map((r) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join("&");
    url += (url.includes("?") ? "&" : "?") + qs;
  }
  const headers = {};
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  if (tab?.sourceId) {
    const inherited = getInheritedHeaders(tab.sourceId);
    Object.entries(inherited).forEach(([k, v]) => {
      headers[k] = v.value;
    });
  }
  getKvStore("headers").filter((r) => r.enabled && r.key).forEach((r) => {
    headers[resolveVariables(r.key)] = resolveVariables(r.value);
  });
  let auth = getAuthState();
  if (auth.type === "inherit" && tab?.sourceId) {
    const inherited = getInheritedAuth(tab.sourceId);
    if (inherited) auth = inherited.auth;
  }
  if (auth.type === "bearer") headers["Authorization"] = `Bearer ${resolveVariables(auth.token)}`;
  else if (auth.type === "basic") headers["Authorization"] = "Basic " + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`);
  else if (auth.type === "apikey") headers[resolveVariables(auth.key)] = resolveVariables(auth.value);
  else if (auth.type === "oauth2" && auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
  let body = null;
  const bodyType = state.currentBodyType;
  if (method !== "GET" && method !== "HEAD") {
    if (bodyType === "json" || bodyType === "raw") {
      body = resolveVariables(document.getElementById("bodyTextarea").value);
      if (bodyType === "json" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    } else if (bodyType === "graphql") {
      const query = resolveVariables(document.getElementById("bodyTextarea").value);
      const vars = document.getElementById("graphqlVarsTextarea")?.value || "{}";
      try {
        body = JSON.stringify({ query, variables: JSON.parse(resolveVariables(vars)) });
      } catch {
        body = JSON.stringify({ query, variables: {} });
      }
      headers["Content-Type"] = "application/json";
    } else if (bodyType === "form") {
      const fd = new FormData();
      getKvStore("bodyForm").filter((r) => r.enabled && r.key).forEach((r) => {
        if (r.type === "file" && r.file) fd.append(r.key, r.file);
        else fd.append(resolveVariables(r.key), resolveVariables(r.value));
      });
      body = fd;
    } else if (bodyType === "urlencoded") {
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = getKvStore("bodyForm").filter((r) => r.enabled && r.key).map((r) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join("&");
    } else if (bodyType === "binary") {
      const fileInput = document.getElementById("binaryFileInput");
      if (fileInput?.files?.[0]) body = fileInput.files[0];
    }
  }
  let reqContext = { url, method, headers, body };
  if (tab?.sourceId) {
    const chain = getAncestorChain(tab.sourceId);
    for (const ancestor of chain) {
      if (ancestor.preRequestScript) {
        try {
          const r = runPreRequestScript(ancestor.preRequestScript, reqContext);
          if (r) Object.assign(reqContext, r);
        } catch (e) {
          showNotif("Pre-request script error (" + ancestor.name + "): " + e.message, "error");
          return;
        }
      }
    }
  }
  const preScript = state.activeTabId ? state.tabData[state.activeTabId]?.preRequestScript : "";
  if (preScript) {
    try {
      const r = runPreRequestScript(preScript, reqContext);
      if (r) Object.assign(reqContext, r);
    } catch (e) {
      showNotif("Pre-request script error: " + e.message, "error");
      return;
    }
  }
  url = reqContext.url;
  method = reqContext.method;
  Object.assign(headers, reqContext.headers);
  if (reqContext.body !== void 0) body = reqContext.body;
  const sendBtn = document.getElementById("sendBtn");
  sendBtn.innerHTML = '<span class="spinner"></span><span id="sendElapsed"></span>';
  sendBtn.classList.add("loading");
  sendBtn.onclick = cancelRequest;
  const startTime = Date.now();
  _requestElapsedTimer = setInterval(() => {
    const el = document.getElementById("sendElapsed");
    if (el) el.textContent = ((Date.now() - startTime) / 1e3).toFixed(1) + "s";
  }, 100);
  _activeAbortController = new AbortController();
  const signal = _activeAbortController.signal;
  try {
    const opts = { method, headers, signal };
    if (body) opts.body = body;
    const response = await window.restifyFetch(url, opts);
    const elapsed = Date.now() - startTime;
    const respText = await response.text();
    showResponse(response, respText, elapsed, url, method);
    const respCtx = { status: response.status, statusText: response.statusText, body: respText, headers: Object.fromEntries(response.headers.entries()) };
    let allTestResults = [];
    if (tab?.sourceId) {
      const chain = getAncestorChain(tab.sourceId);
      for (const ancestor of chain) {
        if (ancestor.testScript) {
          try {
            allTestResults = allTestResults.concat(runTestScript(ancestor.testScript, respCtx));
          } catch (e) {
            console.error("Test script error (" + ancestor.name + "):", e);
          }
        }
      }
    }
    const testScript = state.activeTabId ? state.tabData[state.activeTabId]?.testScript : "";
    if (testScript) {
      try {
        allTestResults = allTestResults.concat(runTestScript(testScript, respCtx));
      } catch (e) {
        console.error("Test script error:", e);
      }
    }
    if (allTestResults.length) renderTestResults(allTestResults);
  } catch (err) {
    if (err.name === "AbortError") {
      showNotif("Request cancelled", "info");
      showResponsePlaceholder();
    } else showError(err.message);
  } finally {
    if (_requestElapsedTimer) {
      clearInterval(_requestElapsedTimer);
      _requestElapsedTimer = null;
    }
    _activeAbortController = null;
    sendBtn.innerHTML = "&#9654; Send";
    sendBtn.classList.remove("loading");
    sendBtn.onclick = sendRequest;
  }
}
function showResponse(response, text, elapsed, reqUrl, reqMethod) {
  const statusBadge = document.getElementById("statusBadge");
  const cls = response.status < 300 ? "2xx" : response.status < 400 ? "3xx" : response.status < 500 ? "4xx" : "5xx";
  const statusHtml = `<span class="status-badge status-${cls}"><span class="status-dot"></span>${response.status} ${response.statusText}</span>`;
  statusBadge.innerHTML = statusHtml;
  const size = new Blob([text]).size;
  const meta = `${elapsed}ms · ${formatBytes(size)}`;
  const rm = document.getElementById("respMeta");
  if (rm) rm.textContent = meta;
  ["copyRespBtn", "curlBtn", "codeGenBtn", "beautifyRespBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "inline-flex";
  });
  let bodyHtml = "";
  const content = document.getElementById("responseBodyContent");
  try {
    const json = JSON.parse(text);
    bodyHtml = syntaxHighlight(JSON.stringify(json, null, 2));
    content.innerHTML = bodyHtml;
  } catch {
    if (text.trim().startsWith("<") && (text.includes("</") || text.includes("/>"))) {
      bodyHtml = syntaxHighlightXml(text);
      content.innerHTML = bodyHtml;
    } else {
      content.textContent = text;
      bodyHtml = escHtml(text);
    }
  }
  const ph = document.getElementById("responsePlaceholder");
  if (ph) ph.style.display = "none";
  content.style.display = "block";
  const raw = document.getElementById("responseBodyRaw");
  if (raw) {
    raw.style.display = "none";
    raw.textContent = text;
  }
  const preview = document.getElementById("responseBodyPreview");
  if (preview) preview.srcdoc = text.trim().startsWith("<") ? text : `<pre style="font-family:monospace;white-space:pre-wrap;padding:12px">${escHtml(text)}</pre>`;
  switchResponseMode("pretty");
  const tbody = document.getElementById("respHeadersBody");
  tbody.innerHTML = "";
  let headersHtml = "";
  response.headers.forEach((val, name) => {
    const row = `<tr><td>${escHtml(name)}</td><td>${escHtml(val)}</td></tr>`;
    headersHtml += row;
    tbody.innerHTML += row;
  });
  let cookiesHtml = "";
  const cookieBody = document.getElementById("respCookiesBody");
  cookieBody.innerHTML = "";
  response.headers.forEach((val, name) => {
    if (name.toLowerCase() === "set-cookie") {
      const parts = val.split(";").map((s) => s.trim());
      const [nameVal, ...attrs] = parts;
      const [cName, cVal] = nameVal.split("=");
      const row = `<tr><td>${escHtml(cName)}</td><td>${escHtml(cVal || "")}</td><td>${escHtml(attrs.join("; "))}</td></tr>`;
      cookiesHtml += row;
      cookieBody.innerHTML += row;
    }
  });
  window._lastResponse = text;
  if (state.activeTabId && state.tabData[state.activeTabId]) {
    state.tabData[state.activeTabId].response = { statusHtml, meta, bodyHtml, bodyRaw: text, headersHtml, cookiesHtml };
  }
  addToHistory({ method: reqMethod || "GET", url: reqUrl || "", status: response.status, time: elapsed, size });
  saveState();
}
function showError(msg) {
  const sb = document.getElementById("statusBadge");
  sb.innerHTML = '<span class="status-badge status-4xx"><span class="status-dot"></span>Error</span>';
  const rm = document.getElementById("respMeta");
  if (rm) rm.textContent = "";
  const ph = document.getElementById("responsePlaceholder");
  if (ph) ph.style.display = "none";
  const content = document.getElementById("responseBodyContent");
  content.style.display = "block";
  content.textContent = `Request failed

${msg}

If you see CORS errors, the server doesn't allow browser requests.
The desktop app bypasses CORS restrictions.`;
  const raw = document.getElementById("responseBodyRaw");
  if (raw) raw.textContent = msg;
  ["curlBtn", "codeGenBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "inline-flex";
  });
  window._lastResponse = msg;
}
function renderTestResults(results) {
  const container = document.getElementById("testResultsContent");
  if (!container || !results?.length) return;
  container.innerHTML = "";
  let passed = 0, failed = 0;
  results.forEach((r) => {
    if (r.passed) passed++;
    else failed++;
    const div = document.createElement("div");
    div.className = "test-result " + (r.passed ? "test-pass" : "test-fail");
    div.innerHTML = `<span class="test-icon">${r.passed ? "✓" : "✗"}</span> <span>${escHtml(r.name)}</span>${r.error ? `<span class="test-error">${escHtml(r.error)}</span>` : ""}`;
    container.appendChild(div);
  });
  const summary = document.createElement("div");
  summary.className = "test-summary";
  summary.textContent = `${passed} passed, ${failed} failed`;
  container.prepend(summary);
  const badge = document.querySelector('.response-tab[data-tab="tests"] .tab-badge');
  if (badge) {
    badge.textContent = String(failed > 0 ? failed : passed);
    badge.className = "tab-badge " + (failed > 0 ? "badge-fail" : "badge-pass");
  }
}
initConfigDomains();
initApiBase();
Object.assign(window, {
  // Tabs
  newTab,
  setActiveTab,
  closeTab,
  togglePinTab,
  saveCurrentTabState,
  renderTabs,
  duplicateTab,
  closeOtherTabs,
  // Sidebar
  renderSidebar,
  switchSidebarMode,
  toggleFolder,
  filterSidebar,
  openRequest,
  openCollectionDocs,
  switchCDocsTab,
  openFolderEditor,
  saveFolderEdits,
  updateFolderAuthFields,
  quickAddRequest,
  showNodeContextMenu,
  hideContextMenu,
  addSubfolder,
  startRename,
  doDuplicate,
  doDelete,
  clearHistory,
  // KV Editor
  getKvStore,
  renderKvEditor,
  addKvRow,
  deleteKvRow,
  kvChange,
  kvFileChange,
  kvTypeChange,
  // Auth
  getAuthState,
  updateAuthFields,
  fetchOAuth2Token,
  // Body
  setBodyType,
  formatJson,
  beautifyResponse,
  updateBodyHighlight,
  syncBodyScroll,
  updateUrlHighlight,
  // Theme
  toggleTheme,
  loadTheme,
  // Panels
  switchReqTab,
  switchRespTab,
  showWorkspace,
  showEmpty,
  // Workspace
  updateMethodColor,
  copyResponse,
  switchResponseMode,
  showResponsePlaceholder,
  restoreResponse,
  // Save Modal
  openSaveModal,
  closeSaveModal,
  saveRequest,
  // Environments
  openEnvManager,
  setEnvModalTab,
  clearActiveEnv,
  closeEnvManager,
  renderEnvManager,
  addGlobalVar,
  addEnvVar,
  deleteEnvVar,
  updateEnvVar,
  addEnvironmentFromInput,
  renameEnv,
  deleteEnv,
  setActiveEnv,
  saveEnvChanges,
  renderEnvSelector,
  exportEnvironments,
  importEnvironments,
  // URL variable hover
  hideUrlVarPopover,
  setupUrlVariableHover,
  setupInputVarTooltips,
  // Version
  renderSidebarAppVersion,
  getAutoHeaders,
  // Import/Export/Codegen
  openImport,
  closeImport,
  switchImportTab,
  importFromText,
  importFromUrl,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileSelect,
  doImport,
  openCurlImport,
  exportCollectionAsPostman,
  generateCurl,
  openCodeGen,
  closeCodeGen,
  generateCodeSnippet,
  copyCodeGen,
  runCollection,
  // Share
  shareCollection,
  closeShareModal,
  copyShareUrl,
  // Cloud
  cloudSync,
  renderCloudStatus,
  openCloudModal,
  closeCloudModal,
  _switchCloudTab,
  _submitCloudAuth,
  _cloudAutoSync,
  cloudLogout,
  // HTTP
  sendRequest,
  cancelRequest,
  // Utils (used in inline HTML)
  appConfirm,
  appPrompt,
  showNotif,
  // State (for inline globalVars mutation in env editor)
  state
});
async function init() {
  loadTheme();
  await loadState();
  if (state.tabs.length === 0) {
    newTab();
  } else {
    const id = state.activeTabId || state.tabs[0].id;
    setActiveTab(id);
  }
  renderSidebar();
  renderEnvSelector();
  renderCloudStatus();
  renderSidebarAppVersion();
  setupUrlVariableHover();
  setupInputVarTooltips();
  document.getElementById("urlInput")?.addEventListener("input", function() {
    const t = state.tabs.find((t2) => t2.id === state.activeTabId);
    if (t) {
      t.url = this.value;
      t.name = this.value ? (this.value.replace(/https?:\/\//, "").split("?")[0].split("/").filter(Boolean).pop() || this.value).substring(0, 30) : "New Request";
      if (state.activeTabId && state.tabData[state.activeTabId]) state.tabData[state.activeTabId].dirty = true;
      renderTabs();
    }
  });
  document.getElementById("bodyTextarea2")?.addEventListener("input", function() {
    const bt = document.getElementById("bodyTextarea");
    if (bt) {
      bt.value = this.value;
      window.updateBodySize?.();
    }
  });
  document.getElementById("bodyTextarea")?.addEventListener("input", function() {
    if (state.currentBodyType === "graphql") {
      const bt2 = document.getElementById("bodyTextarea2");
      if (bt2) bt2.value = this.value;
    }
  });
  const handle = document.getElementById("resizeHandle");
  if (handle) {
    let dragging = false, startY = 0, startH = 0;
    handle.addEventListener("mousedown", (e) => {
      dragging = true;
      startY = e.clientY;
      startH = document.getElementById("responseArea").offsetHeight;
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const delta = startY - e.clientY;
      const newH = Math.max(100, Math.min(startH + delta, window.innerHeight - 300));
      document.getElementById("responseArea").style.height = newH + "px";
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });
  }
  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "n") {
      e.preventDefault();
      newTab();
    }
    if (mod && e.key === "w") {
      e.preventDefault();
      if (state.activeTabId) closeTab(state.activeTabId);
    }
    if (mod && e.key === "s") {
      e.preventDefault();
      if (state.activeTabId) openSaveModal();
    }
    if (mod && e.key === "l") {
      e.preventDefault();
      document.getElementById("urlInput")?.focus();
    }
    if (mod && e.key === "Enter") {
      e.preventDefault();
      sendRequest();
    }
    if (mod && e.key === "e") {
      e.preventDefault();
      openEnvManager();
    }
    if (mod && e.key === "d") {
      e.preventDefault();
      if (state.activeTabId) duplicateTab(state.activeTabId);
    }
    if (mod && e.shiftKey && e.key === "C") {
      e.preventDefault();
      generateCurl();
    }
    if (mod && e.key === "b") {
      e.preventDefault();
      formatJson();
    }
    if (e.key === "Escape") {
      hideContextMenu();
      document.querySelectorAll(".modal-overlay.open").forEach((m) => m.classList.remove("open"));
      const dlg = document.getElementById("appDialogOverlay");
      if (dlg?.classList.contains("open")) dlg.classList.remove("open");
    }
  });
  const envSel = document.getElementById("envSelector");
  if (envSel) {
    envSel.addEventListener("change", function() {
      state.activeEnvId = this.value === "" ? null : this.value;
      saveState();
      hideUrlVarPopover();
    });
  }
  setInterval(() => {
    if (state.activeTabId) saveCurrentTabState();
    saveState();
  }, 3e4);
  window.addEventListener("beforeunload", () => {
    if (state.activeTabId) saveCurrentTabState();
    saveState({ forceDisk: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (state.activeTabId) saveCurrentTabState();
      saveState({ forceDisk: true });
    }
  });
  setupElectronUpdateListener();
  checkAutoImport();
  window.createNewCollection = async () => {
    const name = await appPrompt("New collection", "Enter a name for the new collection.", { placeholder: "My Collection" });
    if (!name) return;
    const col = makeCollection({ name });
    state.collections.push(col);
    state.openFolders.add(col.id);
    saveState();
    renderSidebar();
  };
}
function setupElectronUpdateListener() {
  if (!window.electronAPI?.onUpdateStatus) return;
  let _manualUpdateCheck = false;
  window.electronAPI.onUpdateStatus((p) => {
    if (!p?.event) return;
    if (p.event === "available") {
      _manualUpdateCheck = false;
      showNotif("Update v" + (p.version || "") + " is downloading…", "info");
    } else if (p.event === "downloaded") {
      const v = p.version ? " version " + p.version : "";
      appConfirm("Update ready", "Restart Restify to finish installing" + v + ".", { okLabel: "Restart now", cancelLabel: "Later" }).then((ok) => {
        if (ok && window.electronAPI?.quitAndInstall) window.electronAPI.quitAndInstall();
      });
    } else if (p.event === "none" && _manualUpdateCheck) {
      _manualUpdateCheck = false;
      showNotif("You're on the latest version.", "info");
    } else if (p.event === "error" && _manualUpdateCheck) {
      _manualUpdateCheck = false;
      showNotif("Update check failed: " + (p.message || "unknown error"), "error");
    }
  });
}
init().catch(console.error);
