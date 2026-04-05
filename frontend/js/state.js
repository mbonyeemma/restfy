// ═══════════════════════════════════════════
// STATE & DATA MODEL
// ═══════════════════════════════════════════

let collections = [];
let environments = [];
let activeEnvId = null;
let globalVars = [];
let history = [];
let tabs = [];
let activeTabId = null;
let tabData = {};
let openFolders = new Set();
let sidebarMode = 'collections';
let currentBodyType = 'none';
let pendingImport = null;
let editingNodeId = null;

const LS_DATA = 'restify_data';
const LS_DATA_LEGACY = 'restfy_data';

function lsGetDataRaw() {
  return localStorage.getItem(LS_DATA) ?? localStorage.getItem(LS_DATA_LEGACY);
}

function lsSetDataRaw(json) {
  localStorage.setItem(LS_DATA, json);
}

function makeDefaultKv() {
  return [{ key: '', value: '', enabled: true }];
}

function makeRequest(overrides) {
  return Object.assign({
    id: genId(),
    type: 'request',
    name: 'New Request',
    method: 'GET',
    url: '',
    params: makeDefaultKv(),
    headers: makeDefaultKv(),
    bodyType: 'json',
    body: '{}',
    bodyForm: makeDefaultKv(),
    auth: { type: 'none' },
    preRequestScript: '',
    testScript: ''
  }, overrides || {});
}

function makeFolder(overrides) {
  return Object.assign({
    id: genId(),
    type: 'folder',
    name: 'New Folder',
    headers: [],
    auth: { type: 'none' },
    children: []
  }, overrides || {});
}

function makeCollection(overrides) {
  return Object.assign({
    id: genId(),
    type: 'collection',
    name: 'New Collection',
    description: '',
    headers: [],
    auth: { type: 'none' },
    variables: [],
    preRequestScript: '',
    testScript: '',
    children: []
  }, overrides || {});
}

// ── Tree traversal helpers ──

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
  return findNodeById(id, collections);
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
  for (const col of collections) {
    if (col.id === id) return null;
    const found = findParentOf(id, col.children, col);
    if (found) return found;
  }
  return null;
}

function findCollectionOf(id) {
  for (const col of collections) {
    if (col.id === id) return col;
    if (findNodeById(id, col.children)) return col;
  }
  return null;
}

function getAncestorChain(id) {
  const chain = [];
  let current = findNodeInAll(id);
  if (!current) return chain;
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
  chain.forEach(ancestor => {
    if (ancestor.headers) {
      ancestor.headers.forEach(h => {
        if (h.enabled !== false && h.key) merged[h.key] = { value: h.value, from: ancestor.name };
      });
    }
  });
  return merged;
}

function getInheritedAuth(nodeId) {
  const chain = getAncestorChain(nodeId);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].auth && chain[i].auth.type !== 'none') {
      return { auth: chain[i].auth, from: chain[i].name };
    }
  }
  return null;
}

function countRequests(node) {
  if (node.type === 'request') return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + countRequests(child), 0);
}

function deleteNode(id) {
  for (let i = 0; i < collections.length; i++) {
    if (collections[i].id === id) {
      collections.splice(i, 1);
      return true;
    }
  }
  const parent = findParentInAll(id);
  if (parent && parent.children) {
    const idx = parent.children.findIndex(c => c.id === id);
    if (idx !== -1) { parent.children.splice(idx, 1); return true; }
  }
  return false;
}

function duplicateNode(id) {
  const node = findNodeInAll(id);
  if (!node) return null;
  const parent = findParentInAll(id);
  const clone = deepClone(node);
  assignNewIds(clone);
  clone.name = node.name + ' (copy)';
  if (parent && parent.children) {
    const idx = parent.children.findIndex(c => c.id === id);
    parent.children.splice(idx + 1, 0, clone);
  } else if (node.type === 'collection') {
    const idx = collections.findIndex(c => c.id === id);
    collections.splice(idx + 1, 0, clone);
  }
  return clone;
}

function assignNewIds(node) {
  node.id = genId();
  if (node.children) node.children.forEach(c => assignNewIds(c));
}

function moveNode(nodeId, targetParentId) {
  const node = findNodeInAll(nodeId);
  if (!node) return;
  const oldParent = findParentInAll(nodeId);
  const target = findNodeInAll(targetParentId);
  if (!target || !target.children) return;
  if (oldParent && oldParent.children) {
    const idx = oldParent.children.findIndex(c => c.id === nodeId);
    if (idx !== -1) oldParent.children.splice(idx, 1);
  }
  target.children.push(node);
}

function getSiblingArrayForNode(nodeId) {
  const rootIdx = collections.findIndex(c => c.id === nodeId);
  if (rootIdx !== -1) return collections;
  const parent = findParentInAll(nodeId);
  if (parent && parent.children) return parent.children;
  return null;
}

/** Reorder within the same parent list only (collections[] or parent.children). */
function reorderAmongSiblings(dragId, targetId, placeAfter) {
  if (dragId === targetId) return false;
  const arr = getSiblingArrayForNode(dragId);
  if (!arr || arr !== getSiblingArrayForNode(targetId)) return false;
  const from = arr.findIndex(n => n.id === dragId);
  let to = arr.findIndex(n => n.id === targetId);
  if (from < 0 || to < 0) return false;
  const [item] = arr.splice(from, 1);
  if (from < to) to--;
  if (placeAfter) to++;
  arr.splice(to, 0, item);
  return true;
}

// ── Persistence (localStorage + Electron userData disk cache) ──

let _diskPersistTimer = null;

function buildStateObject() {
  const data = {
    version: 2,
    savedAt: Date.now(),
    collections,
    environments,
    activeEnvId,
    globalVars,
    history,
    openTabs: tabs.map(t => ({
      id: t.id, name: t.name, method: t.method, url: t.url,
      sourceId: t.sourceId, pinned: t.pinned
    })),
    activeTabId,
    tabData: {},
    openFolders: Array.from(openFolders)
  };
  for (const tid in tabData) {
    const d = tabData[tid];
    data.tabData[tid] = {
      params: d.params, headers: d.headers, bodyForm: d.bodyForm,
      bodyType: d.bodyType, body: d.body, graphqlVars: d.graphqlVars || '',
      auth: d.auth, preRequestScript: d.preRequestScript || '',
      testScript: d.testScript || '', pinned: d.pinned || false
    };
  }
  return data;
}

function scheduleDiskPersist(jsonString) {
  if (!window.electronAPI || typeof window.electronAPI.persistRestifyState !== 'function') return;
  clearTimeout(_diskPersistTimer);
  _diskPersistTimer = setTimeout(() => {
    _diskPersistTimer = null;
    window.electronAPI.persistRestifyState(jsonString).catch(() => {});
  }, 400);
}

/**
 * Saves collections, environments, tabs, history, etc.
 * @param {{ forceDisk?: boolean }} opts - forceDisk: synchronous write to disk (e.g. before window close)
 */
function saveState(opts) {
  const forceDisk = opts && opts.forceDisk;
  let json;
  try {
    json = JSON.stringify(buildStateObject());
  } catch (e) {
    console.error('Save failed (serialize):', e);
    return;
  }

  try {
    lsSetDataRaw(json);
  } catch (e) {
    console.error('Save failed (localStorage):', e);
    if (window.electronAPI && typeof window.electronAPI.persistRestifyState === 'function') {
      window.electronAPI.persistRestifyState(json).catch(() => {});
    }
    if (forceDisk && window.electronAPI && typeof window.electronAPI.flushRestifyState === 'function') {
      window.electronAPI.flushRestifyState(json);
    }
    return;
  }

  if (window.electronAPI && typeof window.electronAPI.persistRestifyState === 'function') {
    if (forceDisk && typeof window.electronAPI.flushRestifyState === 'function') {
      window.electronAPI.flushRestifyState(json);
    } else {
      scheduleDiskPersist(json);
    }
  }
}

function applyStateFromData(d) {
  if (!d) return;
  if (d.version === 2) {
    collections = d.collections || [];
    environments = d.environments || [];
    activeEnvId = d.activeEnvId || null;
    if (activeEnvId && !environments.some(e => e.id === activeEnvId)) activeEnvId = null;
    globalVars = d.globalVars || [];
    history = d.history || [];
    openFolders = new Set(d.openFolders || []);
    if (d.openTabs && d.openTabs.length > 0) {
      tabs = d.openTabs;
      tabData = d.tabData || {};
      activeTabId = d.activeTabId || tabs[0].id;
    }
  } else {
    migrateV1(d);
  }
}

/**
 * Loads from localStorage and/or disk cache (whichever is newer / has data).
 * Disk backup recovers when localStorage is cleared or over quota.
 */
async function loadState() {
  let local = null;
  try {
    const raw = lsGetDataRaw();
    if (raw) local = JSON.parse(raw);
  } catch (e) {
    console.error('Load failed (localStorage):', e);
  }

  let file = null;
  if (window.electronAPI && typeof window.electronAPI.loadRestifyState === 'function') {
    try {
      const raw = await window.electronAPI.loadRestifyState();
      if (raw) file = JSON.parse(raw);
    } catch (e) {
      console.error('Load failed (disk cache):', e);
    }
  }

  let d = null;
  if (local && file) {
    const nLocal = (local.collections && local.collections.length) || 0;
    const nFile = (file.collections && file.collections.length) || 0;
    const tLocal = local.savedAt || 0;
    const tFile = file.savedAt || 0;
    if (nLocal === 0 && nFile > 0) d = file;
    else if (nFile === 0 && nLocal > 0) d = local;
    else d = tFile > tLocal ? file : local;
    // Union environments from both stores so newer disk snapshot cannot wipe envs only in localStorage
    const envMap = new Map();
    (local.environments || []).forEach(e => { if (e && e.id) envMap.set(e.id, e); });
    (file.environments || []).forEach(e => { if (e && e.id) envMap.set(e.id, e); });
    const mergedEnvs = Array.from(envMap.values());
    if (mergedEnvs.length) d = Object.assign({}, d, { environments: mergedEnvs });
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
  } catch (_) { /* quota — disk remains source of truth */ }
}

function migrateV1(d) {
  const old = d.collections || d;
  if (typeof old === 'object' && !Array.isArray(old)) {
    collections = Object.entries(old).map(([name, requests]) => {
      const col = makeCollection({ name });
      col.children = (requests || []).map(r => makeRequest({
        name: r.name, method: r.method, url: r.url,
        params: r.params || makeDefaultKv(),
        headers: r.headers || makeDefaultKv(),
        bodyType: r.bodyType || 'none',
        body: r.body || '',
        bodyForm: r.bodyForm || makeDefaultKv(),
        auth: r.auth || { type: 'none' }
      }));
      return col;
    });
  }
}

// ── Environment helpers ──

function resolveVariables(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const env = environments.find(e => e.id === activeEnvId);
    if (env) {
      const v = env.variables.find(v => v.enabled !== false && v.key === key);
      if (v) return v.value;
    }
    const g = globalVars.find(v => v.enabled !== false && v.key === key);
    if (g) return g.value;
    return match;
  });
}

/** Single key lookup for URL variable hover (same precedence as resolveVariables). */
function lookupVariableKey(key) {
  const env = environments.find(e => e.id === activeEnvId);
  if (env) {
    const v = env.variables.find(v => v.enabled !== false && v.key === key);
    if (v) return { value: v.value, source: 'environment' };
  }
  const g = globalVars.find(v => v.enabled !== false && v.key === key);
  if (g) return { value: g.value, source: 'global' };
  return { value: null, source: 'unresolved' };
}

// ── History helpers ──

function addToHistory(entry) {
  history.unshift({
    id: genId(),
    method: entry.method,
    url: entry.url,
    status: entry.status,
    time: entry.time,
    size: entry.size,
    timestamp: Date.now()
  });
  if (history.length > 500) history = history.slice(0, 500);
  saveState();
}
