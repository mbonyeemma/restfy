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
    bodyType: 'none',
    body: '',
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

// ── Persistence ──

function saveState() {
  try {
    const data = {
      version: 2,
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
    localStorage.setItem('restfy_data', JSON.stringify(data));
  } catch (e) { console.error('Save failed:', e); }
}

function loadState() {
  try {
    const saved = localStorage.getItem('restfy_data');
    if (!saved) return;
    const d = JSON.parse(saved);
    if (d.version === 2) {
      collections = d.collections || [];
      environments = d.environments || [];
      activeEnvId = d.activeEnvId || null;
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
  } catch (e) { console.error('Load failed:', e); }
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
