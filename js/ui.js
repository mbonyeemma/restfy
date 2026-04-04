// ═══════════════════════════════════════════
// UI RENDERING & INTERACTION
// ═══════════════════════════════════════════

let _collectionTreeFilter = '';
let _treeDragActiveId = null;

function clearTreeDropTargetClasses() {
  document.querySelectorAll('.tree-drop-target, .tree-drop-after').forEach(el => {
    el.classList.remove('tree-drop-target', 'tree-drop-after');
  });
}

function bindTreeRowDnD(rowEl, nodeId) {
  if (_collectionTreeFilter) {
    rowEl.classList.add('tree-drag-disabled');
    return;
  }
  const handle = rowEl.querySelector('.tree-drag-handle');
  if (!handle) return;
  handle.setAttribute('draggable', 'true');
  handle.onmousedown = (e) => e.stopPropagation();
  handle.onclick = (e) => e.stopPropagation();
  handle.ondragstart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
    _treeDragActiveId = nodeId;
    rowEl.classList.add('dragging');
  };
  handle.ondragend = () => {
    _treeDragActiveId = null;
    rowEl.classList.remove('dragging');
    clearTreeDropTargetClasses();
  };
  rowEl.ondragover = (e) => {
    if (!_treeDragActiveId || _treeDragActiveId === nodeId) return;
    const arrA = getSiblingArrayForNode(_treeDragActiveId);
    const arrB = getSiblingArrayForNode(nodeId);
    if (!arrA || arrA !== arrB) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = rowEl.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    clearTreeDropTargetClasses();
    rowEl.classList.add('tree-drop-target');
    if (after) rowEl.classList.add('tree-drop-after');
  };
  rowEl.ondragleave = (e) => {
    if (!rowEl.contains(e.relatedTarget)) {
      rowEl.classList.remove('tree-drop-target', 'tree-drop-after');
    }
  };
  rowEl.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dragId = e.dataTransfer.getData('text/plain');
    rowEl.classList.remove('tree-drop-target', 'tree-drop-after');
    if (!dragId || dragId === nodeId) return;
    const rect = rowEl.getBoundingClientRect();
    const placeAfter = e.clientY > rect.top + rect.height / 2;
    if (reorderAmongSiblings(dragId, nodeId, placeAfter)) {
      saveState();
      const sb = document.querySelector('.sidebar-search');
      renderSidebar(sb ? sb.value : '');
    }
  };
}

// ── Tabs ──

function newTab(req, sourceId) {
  const id = 'tab_' + Date.now();
  const tab = {
    id,
    name: req ? req.name : 'New Request',
    method: req ? req.method : 'GET',
    url: req ? req.url : '',
    sourceId: sourceId || null,
    pinned: false
  };
  tabs.push(tab);
  tabData[id] = {
    params: req && req.params ? deepClone(req.params) : makeDefaultKv(),
    headers: req && req.headers ? deepClone(req.headers) : makeDefaultKv(),
    bodyForm: req && req.bodyForm ? deepClone(req.bodyForm) : makeDefaultKv(),
    bodyType: req ? (req.bodyType != null ? req.bodyType : 'json') : 'json',
    body: req ? (req.body != null ? req.body : '{}') : '{}',
    graphqlVars: req ? (req.graphqlVars || '') : '',
    auth: req ? deepClone(req.auth || { type: 'none' }) : { type: 'none' },
    preRequestScript: req ? (req.preRequestScript || '') : '',
    testScript: req ? (req.testScript || '') : '',
    response: null
  };
  setActiveTab(id);
  renderTabs();
}

function setActiveTab(id) {
  if (activeTabId && activeTabId !== id) saveCurrentTabState();
  activeTabId = id;
  editingNodeId = null;
  loadTabState(id);
  renderTabs();
  showWorkspace();
}

function closeTab(id, e) {
  if (e) e.stopPropagation();
  const td = tabData[id];
  if (td && td.pinned) return;
  const idx = tabs.findIndex(t => t.id === id);
  tabs.splice(idx, 1);
  delete tabData[id];
  if (tabs.length === 0) {
    activeTabId = null;
    showEmpty();
    renderTabs();
    return;
  }
  if (activeTabId === id) {
    const newIdx = Math.min(idx, tabs.length - 1);
    setActiveTab(tabs[newIdx].id);
  }
  renderTabs();
}

function togglePinTab(id) {
  const d = tabData[id];
  if (d) d.pinned = !d.pinned;
  renderTabs();
}

function saveCurrentTabState() {
  if (!activeTabId || !tabData[activeTabId]) return;
  const t = tabs.find(t => t.id === activeTabId);
  if (!t) return;
  const ms = document.getElementById('methodSelect');
  const ui = document.getElementById('urlInput');
  if (ms) t.method = ms.value;
  if (ui) t.url = ui.value;
  t.name = t.url ? (t.url.replace(/https?:\/\//, '').split('?')[0].split('/').filter(Boolean).pop() || t.url).substring(0, 30) : 'New Request';
  tabData[activeTabId].bodyType = currentBodyType;
  const bt = document.getElementById('bodyTextarea');
  if (bt) tabData[activeTabId].body = bt.value;
  const gv = document.getElementById('graphqlVarsTextarea');
  if (gv) tabData[activeTabId].graphqlVars = gv.value;
  tabData[activeTabId].auth = getAuthState();
  const prs = document.getElementById('preRequestScriptEditor');
  if (prs) tabData[activeTabId].preRequestScript = prs.value;
  const ts = document.getElementById('testScriptEditor');
  if (ts) tabData[activeTabId].testScript = ts.value;
}

function loadTabState(id) {
  const t = tabs.find(t => t.id === id);
  const d = tabData[id];
  if (!t || !d) return;
  document.getElementById('methodSelect').value = t.method || 'GET';
  document.getElementById('urlInput').value = t.url || '';
  updateMethodColor();
  updateUrlHighlight();
  renderKvEditor('paramsEditor', d.params, 'params');
  renderKvEditor('headersEditor', d.headers, 'headers');
  renderInheritedHeaders();
  renderAutoHeaders();
  updateHeaderBadge();
  renderKvEditor('bodyFormEditor', d.bodyForm, 'bodyForm');
  setBodyType(d.bodyType || 'none', null, true);
  document.getElementById('bodyTextarea').value = d.body || '';
  updateBodyHighlight();
  const gv = document.getElementById('graphqlVarsTextarea');
  if (gv) gv.value = d.graphqlVars || '';
  document.getElementById('authType').value = d.auth ? d.auth.type || 'none' : 'none';
  updateAuthFields(d.auth);
  const prs = document.getElementById('preRequestScriptEditor');
  if (prs) prs.value = d.preRequestScript || '';
  const ts = document.getElementById('testScriptEditor');
  if (ts) ts.value = d.testScript || '';
  if (d.response) {
    restoreResponse(d.response);
  } else {
    showResponsePlaceholder();
  }
  switchReqTab(t.sourceId ? 'body' : 'params');
}

function renderTabs() {
  const bar = document.getElementById('tabsBar');
  bar.innerHTML = '';
  tabs.forEach(t => {
    const d = tabData[t.id];
    const pinned = d && d.pinned;
    const div = document.createElement('div');
    div.className = 'tab' + (t.id === activeTabId ? ' active' : '');
    if (pinned) div.classList.add('pinned');
    if (d && d.dirty) div.classList.add('unsaved');
    div.onclick = () => setActiveTab(t.id);
    div.innerHTML = `
      <span class="tab-method m-${t.method}">${t.method}</span>
      <span class="tab-name">${escHtml(t.name)}</span>
      ${pinned ? '<span class="tab-pin" title="Pinned">&#128204;</span>' : ''}
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
  const menu = document.getElementById('contextMenu');
  const d = tabData[tabId];
  const pinned = d && d.pinned;
  menu.innerHTML = `
    <div class="ctx-item" onclick="togglePinTab('${tabId}'); hideContextMenu();">${pinned ? 'Unpin Tab' : 'Pin Tab'}</div>
    <div class="ctx-item" onclick="duplicateTab('${tabId}'); hideContextMenu();">Duplicate Tab</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" onclick="closeTab('${tabId}'); hideContextMenu();">Close Tab</div>
    <div class="ctx-item" onclick="closeOtherTabs('${tabId}'); hideContextMenu();">Close Other Tabs</div>
  `;
  positionContextMenu(menu, e);
}

function duplicateTab(tabId) {
  const t = tabs.find(t => t.id === tabId);
  const d = tabData[tabId];
  if (!t || !d) return;
  newTab({
    name: t.name, method: t.method, url: t.url,
    params: d.params, headers: d.headers, bodyForm: d.bodyForm,
    bodyType: d.bodyType, body: d.body, graphqlVars: d.graphqlVars,
    auth: d.auth, preRequestScript: d.preRequestScript, testScript: d.testScript
  });
}

function closeOtherTabs(keepId) {
  const toClose = tabs.filter(t => t.id !== keepId && !(tabData[t.id] && tabData[t.id].pinned));
  toClose.forEach(t => { delete tabData[t.id]; });
  tabs = tabs.filter(t => t.id === keepId || (tabData[t.id] && tabData[t.id].pinned));
  if (!tabs.find(t => t.id === activeTabId)) {
    setActiveTab(keepId);
  }
  renderTabs();
}

// ── Sidebar ──

function renderSidebar(filter) {
  if (sidebarMode === 'collections') {
    let f = filter;
    if (f === undefined) {
      const sb = document.querySelector('.sidebar-search');
      f = sb ? sb.value : '';
    }
    renderCollectionTree(f || '');
  } else {
    renderHistoryList(filter || '');
  }
}

function switchSidebarMode(mode) {
  sidebarMode = mode;
  document.querySelectorAll('.sidebar-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  renderSidebar();
}

function renderCollectionTree(filter) {
  _collectionTreeFilter = (filter || '').trim();
  const container = document.getElementById('sidebarContent');
  container.innerHTML = '';
  if (collections.length === 0) {
    container.innerHTML = `<div class="sidebar-empty">No collections yet.<br>Import a Postman collection<br>or save a request.</div>`;
    return;
  }
  collections.forEach(col => {
    const el = renderTreeNode(col, 0, col.id, filter);
    if (el) container.appendChild(el);
  });
}

function renderTreeNode(node, depth, collectionId, filter) {
  if (node.type === 'request') {
    if (filter && !node.name.toLowerCase().includes(filter.toLowerCase()) &&
        !node.url.toLowerCase().includes(filter.toLowerCase())) return null;
    const div = document.createElement('div');
    div.className = 'tree-node tree-request';
    div.style.paddingLeft = (12 + depth * 16) + 'px';
    div.dataset.id = node.id;
    div.innerHTML = `
      <span class="tree-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
      <span class="req-method-badge m-${node.method} bg-${node.method}">${node.method}</span>
      <span class="tree-label">${escHtml(node.name)}</span>
    `;
    div.onclick = () => openRequest(node.id);
    div.oncontextmenu = (e) => { e.preventDefault(); showNodeContextMenu(e, node.id, 'request', collectionId); };
    bindTreeRowDnD(div, node.id);
    return div;
  }

  const isOpen = openFolders.has(node.id) || !!filter;
  const count = countRequests(node);
  const isCollection = node.type === 'collection';

  const wrapper = document.createElement('div');
  wrapper.className = 'tree-group' + (isCollection ? ' tree-collection' : '');

  const header = document.createElement('div');
  header.className = 'tree-node tree-folder-header' + (isOpen ? ' open' : '');
  header.style.paddingLeft = (12 + depth * 16) + 'px';
  header.dataset.id = node.id;
  header.innerHTML = `
    <span class="tree-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
    <span class="tree-toggle">${isOpen ? '&#9660;' : '&#9654;'}</span>
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
    showNodeContextMenu(e, node.id, node.type, collectionId);
  };
  bindTreeRowDnD(header, node.id);

  wrapper.appendChild(header);

  if (isOpen && node.children) {
    const childContainer = document.createElement('div');
    childContainer.className = 'tree-children';
    let hasVisibleChild = false;
    node.children.forEach(child => {
      const childEl = renderTreeNode(child, depth + 1, collectionId, filter);
      if (childEl) { childContainer.appendChild(childEl); hasVisibleChild = true; }
    });
    if (hasVisibleChild || !filter) wrapper.appendChild(childContainer);
  }

  if (filter && count === 0 && !node.name.toLowerCase().includes(filter.toLowerCase())) return null;
  return wrapper;
}

function toggleFolder(id) {
  if (openFolders.has(id)) openFolders.delete(id);
  else openFolders.add(id);
  renderSidebar();
}

function filterSidebar(val) {
  renderSidebar(val);
}

function openRequest(nodeId) {
  const node = findNodeInAll(nodeId);
  if (!node || node.type !== 'request') return;
  const existing = tabs.find(t => t.sourceId === nodeId);
  if (existing) { setActiveTab(existing.id); return; }
  newTab(node, nodeId);
}

let _activeDocsColId = null;
let _docsFullDocsVisible = false;

function openCollectionDocs(colId) {
  const col = findNodeInAll(colId);
  if (!col || col.type !== 'collection') return;
  _activeDocsColId = colId;
  _docsFullDocsVisible = false;
  if (activeTabId) saveCurrentTabState();
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('requestWorkspace').style.display = 'none';
  document.getElementById('folderEditor').style.display = 'none';
  document.getElementById('collectionDocs').style.display = 'flex';
  switchCDocsTab('overview');
  renderCollectionDocs(col);
}

function switchCDocsTab(tab) {
  document.querySelectorAll('.cdocs-tab').forEach(t => t.classList.toggle('active', t.dataset.cdocsTab === tab));
  document.querySelectorAll('.cdocs-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('cdocsPanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.classList.add('active');

  if (tab !== 'overview') {
    const col = findNodeInAll(_activeDocsColId);
    if (!col) return;
    if (tab === 'authorization') _renderCDocsAuth(col);
    else if (tab === 'scripts') _renderCDocsScripts(col);
    else if (tab === 'variables') _renderCDocsVars(col);
    else if (tab === 'runs') _renderCDocsRuns(col);
  }
}

function renderCollectionDocs(col) {
  document.getElementById('cdocsTopbarName').textContent = col.name;
  document.getElementById('cdocsOverviewTitle').textContent = col.name;

  const reqCount = countRequests(col);
  const folderCount = _countFolders(col);
  const metaEl = document.getElementById('cdocsOverviewMeta');
  metaEl.innerHTML = '';
  const items = [
    { icon: '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>', text: reqCount + ' request' + (reqCount !== 1 ? 's' : '') },
    { icon: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>', text: folderCount + ' folder' + (folderCount !== 1 ? 's' : '') },
  ];
  items.forEach(it => {
    const span = document.createElement('span');
    span.className = 'cdocs-overview-meta-item';
    span.innerHTML = it.icon + ' ' + it.text;
    metaEl.appendChild(span);
  });

  const descEl = document.getElementById('cdocsDesc');
  descEl.value = col.description || '';
  descEl.oninput = function() { col.description = this.value; saveState(); };

  const authTab = document.querySelector('[data-cdocs-tab="authorization"]');
  if (authTab) {
    const hasAuth = col.auth && col.auth.type && col.auth.type !== 'none';
    const dot = authTab.querySelector('.cdocs-tab-dot');
    if (hasAuth && !dot) { authTab.innerHTML += '<span class="cdocs-tab-dot"></span>'; }
    else if (!hasAuth && dot) { dot.remove(); }
  }

  const viewLink = document.getElementById('cdocsViewDocsLink');
  viewLink.onclick = (e) => { e.preventDefault(); _toggleFullDocs(col); };

  document.getElementById('cdocsPublishBtn').onclick = () => shareCollection(col.id);
  document.getElementById('cdocsCopyLinkBtn').onclick = () => {
    const data = JSON.stringify(deepClone(col), null, 2);
    navigator.clipboard.writeText(data).then(() => showNotif('Collection JSON copied to clipboard', 'success'));
  };
  document.getElementById('cdocsRunCollectionBtn').onclick = () => runCollection(col.id);

  const fullDocs = document.getElementById('cdocsFullDocs');
  fullDocs.style.display = _docsFullDocsVisible ? 'block' : 'none';
  if (_docsFullDocsVisible) _buildFullDocs(col, fullDocs);
}

function _countFolders(node) {
  let c = 0;
  if (node.children) node.children.forEach(ch => {
    if (ch.type === 'folder') { c++; c += _countFolders(ch); }
  });
  return c;
}

function _toggleFullDocs(col) {
  _docsFullDocsVisible = !_docsFullDocsVisible;
  const el = document.getElementById('cdocsFullDocs');
  const link = document.getElementById('cdocsViewDocsLink');
  if (_docsFullDocsVisible) {
    el.style.display = 'block';
    _buildFullDocs(col, el);
    link.innerHTML = 'Hide documentation &uarr;';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    el.style.display = 'none';
    link.innerHTML = 'View complete documentation &rarr;';
  }
}

function _buildFullDocs(col, container) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'cdocs-full-docs-header';
  header.innerHTML = '<div class="cdocs-full-docs-title">' + escHtml(col.name) + '</div>';
  container.appendChild(header);

  if (col.description) {
    const descP = document.createElement('p');
    descP.style.cssText = 'font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0 0 20px;white-space:pre-wrap';
    descP.textContent = col.description;
    container.appendChild(descP);
  }

  if (col.auth && col.auth.type && col.auth.type !== 'none') {
    _renderDocAuthRow(container, col.auth, col.name);
  }

  if (!col.children || col.children.length === 0) {
    container.innerHTML += '<div style="text-align:center;color:var(--text-dim);padding:32px;font-size:13px">No requests in this collection yet.</div>';
    return;
  }

  const topReqs = col.children.filter(c => c.type === 'request');
  topReqs.forEach(req => _renderDocRequestCard(container, req));
  col.children.filter(c => c.type === 'folder').forEach(f => _renderDocFolderSection(container, f, col));
}

function _renderDocFolderSection(container, folder, parentCol) {
  const section = document.createElement('div');
  section.className = 'cdocs-folder-section';

  const heading = document.createElement('div');
  heading.className = 'cdocs-folder-heading';
  heading.textContent = folder.name;
  section.appendChild(heading);

  if (folder.description) {
    const desc = document.createElement('div');
    desc.className = 'cdocs-folder-desc';
    desc.textContent = folder.description;
    section.appendChild(desc);
  }

  const effectiveAuth = folder.auth && folder.auth.type && folder.auth.type !== 'none' ? folder.auth : null;
  if (effectiveAuth) {
    _renderDocAuthRow(section, effectiveAuth, null);
  } else if (parentCol.auth && parentCol.auth.type && parentCol.auth.type !== 'none') {
    const note = document.createElement('div');
    note.className = 'cdocs-folder-auth-row';
    note.innerHTML = '<strong>Authorization</strong> <span>' + escHtml(_authTypeLabel(parentCol.auth.type)) + '</span> <span style="margin-left:auto;font-style:italic">inherited from collection ' + escHtml(parentCol.name) + '</span>';
    section.appendChild(note);
  }

  const requests = folder.children ? folder.children.filter(c => c.type === 'request') : [];
  requests.forEach(req => _renderDocRequestCard(section, req));

  container.appendChild(section);

  if (folder.children) {
    folder.children.filter(c => c.type === 'folder').forEach(sub => _renderDocFolderSection(container, sub, parentCol));
  }
}

function _renderDocRequestCard(container, req) {
  const card = document.createElement('div');
  card.className = 'cdocs-req-card';

  const header = document.createElement('div');
  header.className = 'cdocs-req-card-header';
  header.onclick = () => openRequest(req.id);

  const badge = document.createElement('span');
  badge.className = 'cdocs-req-card-method bg-' + (req.method || 'GET');
  badge.textContent = req.method || 'GET';

  const name = document.createElement('span');
  name.className = 'cdocs-req-card-name';
  name.textContent = req.name || 'Untitled';

  const openLink = document.createElement('span');
  openLink.className = 'cdocs-req-card-open';
  openLink.textContent = 'Open request \u2192';

  header.appendChild(badge);
  header.appendChild(name);
  header.appendChild(openLink);
  card.appendChild(header);

  if (req.url) {
    const urlWrap = document.createElement('div');
    urlWrap.className = 'cdocs-req-card-url';
    urlWrap.innerHTML = '<code>' + escHtml(req.url) + '</code>';
    card.appendChild(urlWrap);
  }

  container.appendChild(card);
}

function _renderDocAuthRow(container, auth, sourceName) {
  const row = document.createElement('div');
  row.className = 'cdocs-folder-auth-row';
  let html = '<strong>Authorization</strong> <span>' + escHtml(_authTypeLabel(auth.type)) + '</span>';
  if (auth.type === 'bearer') html += ' &mdash; Token: <code style="font-size:11px;background:var(--bg-mid);padding:2px 6px;border-radius:3px">&lt;token&gt;</code>';
  if (auth.type === 'basic') html += ' &mdash; Username: ' + escHtml(auth.username || '');
  if (auth.type === 'apikey') html += ' &mdash; ' + escHtml(auth.key || 'X-API-Key') + ': &lt;value&gt;';
  row.innerHTML = html;
  container.appendChild(row);
}

function _authTypeLabel(t) {
  if (t === 'bearer') return 'Bearer Token';
  if (t === 'basic') return 'Basic Auth';
  if (t === 'apikey') return 'API Key';
  return t || 'No Auth';
}

function _renderCDocsAuth(col) {
  const el = document.getElementById('cdocsAuthContent');
  const auth = col.auth || { type: 'none' };
  if (!auth.type || auth.type === 'none') {
    el.innerHTML = '<div class="cdocs-auth-header">Authorization</div><div class="cdocs-auth-type">No Auth</div><div class="cdocs-auth-note">This collection does not have authorization configured. Individual requests may have their own authorization.</div><div style="margin-top:16px"><button class="btn-secondary" onclick="openFolderEditor(\'' + col.id + '\')">Configure Authorization</button></div>';
    return;
  }
  let tableRows = '';
  if (auth.type === 'bearer') {
    tableRows = '<tr><td>Type</td><td>Bearer Token</td></tr><tr><td>Token</td><td>' + escHtml(auth.token || '<token>') + '</td></tr>';
  } else if (auth.type === 'basic') {
    tableRows = '<tr><td>Type</td><td>Basic Auth</td></tr><tr><td>Username</td><td>' + escHtml(auth.username || '') + '</td></tr><tr><td>Password</td><td>••••••</td></tr>';
  } else if (auth.type === 'apikey') {
    tableRows = '<tr><td>Type</td><td>API Key</td></tr><tr><td>Header</td><td>' + escHtml(auth.key || 'X-API-Key') + '</td></tr><tr><td>Value</td><td>' + escHtml(auth.value || '') + '</td></tr>';
  }
  el.innerHTML = '<div class="cdocs-auth-header">Authorization</div><div class="cdocs-auth-type">' + _authTypeLabel(auth.type) + '</div><table class="cdocs-auth-table">' + tableRows + '</table><div class="cdocs-auth-note">This authorization is inherited by all requests in the collection unless overridden.</div><div style="margin-top:16px"><button class="btn-secondary" onclick="openFolderEditor(\'' + col.id + '\')">Edit Authorization</button></div>';
}

function _renderCDocsScripts(col) {
  document.getElementById('cdocsPreScript').value = col.preRequestScript || '';
  document.getElementById('cdocsTestScript').value = col.testScript || '';
  document.getElementById('cdocsSaveScriptsBtn').onclick = () => {
    col.preRequestScript = document.getElementById('cdocsPreScript').value;
    col.testScript = document.getElementById('cdocsTestScript').value;
    saveState();
    showNotif('Scripts saved', 'success');
  };
}

function _renderCDocsVars(col) {
  renderKvEditor('cdocsVarsEditor', col.variables || [], 'cdocsVars');
  document.getElementById('cdocsSaveVarsBtn').onclick = () => {
    const editor = document.getElementById('cdocsVarsEditor');
    const rows = [];
    editor.querySelectorAll('.kv-row').forEach(row => {
      const inputs = row.querySelectorAll('.kv-input');
      const checkbox = row.querySelector('.kv-enabled');
      if (inputs.length >= 2) {
        rows.push({ key: inputs[0].value, value: inputs[1].value, enabled: checkbox ? checkbox.checked : true });
      }
    });
    col.variables = rows;
    saveState();
    showNotif('Variables saved', 'success');
  };
}

function _renderCDocsRuns(col) {
  document.getElementById('cdocsRunCollectionBtn').onclick = () => runCollection(col.id);
}

function openFolderEditor(nodeId) {
  const node = findNodeInAll(nodeId);
  if (!node) return;
  _activeDocsColId = null;
  editingNodeId = nodeId;
  if (activeTabId) saveCurrentTabState();
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('requestWorkspace').style.display = 'none';
  document.getElementById('collectionDocs').style.display = 'none';
  const fe = document.getElementById('folderEditor');
  fe.style.display = 'flex';
  renderFolderEditor(node);
}

function renderFolderEditor(node) {
  document.getElementById('folderEditorTitle').textContent = node.name;
  document.getElementById('folderEditorIcon').textContent = node.type === 'collection' ? '\u{1F4E6}' : '\u{1F4C1}';
  renderKvEditor('folderHeadersEditor', node.headers || [], 'folderHeaders');
  document.getElementById('folderAuthType').value = node.auth ? node.auth.type || 'none' : 'none';
  updateFolderAuthFields(node.auth);
  if (node.type === 'collection') {
    document.getElementById('folderVarsPanel').style.display = 'block';
    renderKvEditor('folderVarsEditor', node.variables || [], 'folderVars');
  } else {
    document.getElementById('folderVarsPanel').style.display = 'none';
  }
  document.getElementById('folderPreRequestScript').value = node.preRequestScript || '';
  document.getElementById('folderTestScript').value = node.testScript || '';
}

function saveFolderEdits() {
  if (!editingNodeId) return;
  const node = findNodeInAll(editingNodeId);
  if (!node) return;
  node.headers = getFolderKvStore('folderHeaders');
  node.auth = getFolderAuthState();
  if (node.type === 'collection') {
    node.variables = getFolderKvStore('folderVars');
  }
  node.preRequestScript = document.getElementById('folderPreRequestScript').value;
  node.testScript = document.getElementById('folderTestScript').value;
  saveState();
  showNotif('Folder settings saved', 'success');
}

function getFolderKvStore(storeKey) {
  const editor = document.getElementById(storeKey.replace('folder', 'folder') + 'Editor');
  if (!editor) return [];
  const rows = [];
  editor.querySelectorAll('.kv-row').forEach(row => {
    const inputs = row.querySelectorAll('.kv-input');
    const checkbox = row.querySelector('.kv-enabled');
    if (inputs.length >= 2) {
      rows.push({ key: inputs[0].value, value: inputs[1].value, enabled: checkbox ? checkbox.checked : true });
    }
  });
  return rows;
}

function getFolderAuthState() {
  const type = document.getElementById('folderAuthType').value;
  if (type === 'bearer') return { type, token: document.getElementById('folderAuthToken')?.value || '' };
  if (type === 'basic') return { type, username: document.getElementById('folderAuthUser')?.value || '', password: document.getElementById('folderAuthPass')?.value || '' };
  if (type === 'apikey') return { type, key: document.getElementById('folderAuthKey')?.value || 'X-API-Key', value: document.getElementById('folderAuthValue')?.value || '' };
  return { type: 'none' };
}

function updateFolderAuthFields(authData) {
  const type = document.getElementById('folderAuthType').value;
  const container = document.getElementById('folderAuthFields');
  container.innerHTML = '';
  if (type === 'bearer') {
    const val = authData && authData.token ? authData.token : '';
    container.innerHTML = `<div><label class="auth-field-label">Token</label><input type="text" class="auth-input" id="folderAuthToken" placeholder="Bearer token..." value="${escHtml(val)}"></div>`;
  } else if (type === 'basic') {
    container.innerHTML = `<div><label class="auth-field-label">Username</label><input type="text" class="auth-input" id="folderAuthUser" value="${escHtml(authData?.username || '')}"></div>
    <div><label class="auth-field-label">Password</label><input type="password" class="auth-input" id="folderAuthPass" value="${escHtml(authData?.password || '')}"></div>`;
  } else if (type === 'apikey') {
    container.innerHTML = `<div><label class="auth-field-label">Header Name</label><input type="text" class="auth-input" id="folderAuthKey" value="${escHtml(authData?.key || 'X-API-Key')}"></div>
    <div><label class="auth-field-label">Value</label><input type="text" class="auth-input" id="folderAuthValue" value="${escHtml(authData?.value || '')}"></div>`;
  }
}

function quickAddRequest(parentId) {
  const parent = findNodeInAll(parentId);
  if (!parent || !parent.children) return;
  const req = makeRequest({ name: 'New Request' });
  parent.children.push(req);
  openFolders.add(parentId);
  saveState();
  renderSidebar();
  openRequest(req.id);
}

// ── Context Menu ──

function showNodeContextMenu(e, nodeId, nodeType, collectionId) {
  const menu = document.getElementById('contextMenu');
  let items = '';
  if (nodeType === 'collection' || nodeType === 'folder') {
    if (nodeType === 'collection') {
      items += `<div class="ctx-item" onclick="openCollectionDocs('${nodeId}'); hideContextMenu();">View Documentation</div>`;
    }
    items += `<div class="ctx-item" onclick="quickAddRequest('${nodeId}'); hideContextMenu();">New Request</div>`;
    items += `<div class="ctx-item" onclick="addSubfolder('${nodeId}'); hideContextMenu();">New Folder</div>`;
    items += `<div class="ctx-item" onclick="openFolderEditor('${nodeId}'); hideContextMenu();">Edit Settings</div>`;
    items += `<div class="ctx-sep"></div>`;
  }
  if (nodeType === 'request') {
    items += `<div class="ctx-item" onclick="openRequest('${nodeId}'); hideContextMenu();">Open</div>`;
    items += `<div class="ctx-sep"></div>`;
  }
  items += `<div class="ctx-item" onclick="startRename('${nodeId}'); hideContextMenu();">Rename</div>`;
  items += `<div class="ctx-item" onclick="doDuplicate('${nodeId}'); hideContextMenu();">Duplicate</div>`;
  if (nodeType === 'collection') {
    items += `<div class="ctx-item" onclick="exportCollectionAsPostman('${nodeId}'); hideContextMenu();">Export as Postman JSON</div>`;
    items += `<div class="ctx-item" onclick="shareCollection('${nodeId}'); hideContextMenu();">Share &amp; Publish Docs</div>`;
    items += `<div class="ctx-item" onclick="runCollection('${nodeId}'); hideContextMenu();">Run Collection</div>`;
  }
  items += `<div class="ctx-sep"></div>`;
  items += `<div class="ctx-item ctx-danger" onclick="doDelete('${nodeId}'); hideContextMenu();">Delete</div>`;
  menu.innerHTML = items;
  positionContextMenu(menu, e);
}

function positionContextMenu(menu, e) {
  menu.style.display = 'block';
  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 300) + 'px';
  setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 0);
}

function hideContextMenu() {
  document.getElementById('contextMenu').style.display = 'none';
}

function addSubfolder(parentId) {
  const parent = findNodeInAll(parentId);
  if (!parent || !parent.children) return;
  const folder = makeFolder({ name: 'New Folder' });
  parent.children.push(folder);
  openFolders.add(parentId);
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
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-rename';
  input.value = node.name;
  input.onclick = (e) => e.stopPropagation();
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { commitRename(nodeId, input.value); }
    if (e.key === 'Escape') { renderSidebar(); }
  };
  input.onblur = () => { commitRename(nodeId, input.value); };
  el.replaceWith(input);
  input.focus();
  input.select();
}

function commitRename(nodeId, newName) {
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
  showNotif('Duplicated', 'success');
}

async function doDelete(nodeId) {
  const node = findNodeInAll(nodeId);
  if (!node) return;
  const ok = await appConfirm('Delete item', `Delete "${node.name}"? This cannot be undone.`, { danger: true, okLabel: 'Delete' });
  if (!ok) return;
  tabs.filter(t => t.sourceId === nodeId).forEach(t => closeTab(t.id));
  deleteNode(nodeId);
  saveState();
  renderSidebar();
  showNotif('Deleted', 'success');
}

// ── History ──

function renderHistoryList(filter) {
  const container = document.getElementById('sidebarContent');
  container.innerHTML = '';
  if (history.length === 0) {
    container.innerHTML = '<div class="sidebar-empty">No history yet.<br>Send a request to see it here.</div>';
    return;
  }
  const clearBtn = document.createElement('div');
  clearBtn.className = 'history-clear';
  clearBtn.innerHTML = '<button class="btn-text" onclick="clearHistory()">Clear History</button>';
  container.appendChild(clearBtn);

  const groups = {};
  history.forEach(h => {
    if (filter && !h.url.toLowerCase().includes(filter.toLowerCase())) return;
    const date = new Date(h.timestamp).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(h);
  });

  Object.entries(groups).forEach(([date, items]) => {
    const group = document.createElement('div');
    group.className = 'history-group';
    group.innerHTML = `<div class="history-date">${date}</div>`;
    items.forEach(h => {
      const item = document.createElement('div');
      item.className = 'tree-node tree-request';
      item.style.paddingLeft = '12px';
      item.innerHTML = `
        <span class="req-method-badge m-${h.method} bg-${h.method}">${h.method}</span>
        <span class="tree-label">${escHtml(h.url.replace(/https?:\/\//, '').substring(0, 40))}</span>
        <span class="history-meta">${h.status || ''} &middot; ${h.time}ms</span>
      `;
      item.onclick = () => {
        newTab({ name: h.url.split('/').pop() || 'Request', method: h.method, url: h.url });
      };
      group.appendChild(item);
    });
    container.appendChild(group);
  });
}

async function clearHistory() {
  const ok = await appConfirm('Clear history', 'Clear all request history? This cannot be undone.', { danger: true, okLabel: 'Clear' });
  if (!ok) return;
  history = [];
  saveState();
  renderSidebar();
}

// ── Auto-generated Headers ──

const AUTO_HEADERS = [
  { key: 'User-Agent', value: 'Restfy/2.0' },
  { key: 'Accept', value: '*/*' },
  { key: 'Accept-Encoding', value: 'gzip, deflate, br' },
  { key: 'Connection', value: 'keep-alive' }
];

function getAutoHeaders() {
  const auto = [...AUTO_HEADERS];
  if (currentBodyType === 'json') auto.push({ key: 'Content-Type', value: 'application/json' });
  else if (currentBodyType === 'urlencoded') auto.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
  else if (currentBodyType === 'graphql') auto.push({ key: 'Content-Type', value: 'application/json' });
  else if (currentBodyType === 'raw') auto.push({ key: 'Content-Type', value: 'text/plain' });

  const auth = activeTabId && tabData[activeTabId] ? tabData[activeTabId].auth : { type: 'none' };
  if (auth.type === 'bearer' && auth.token) auto.push({ key: 'Authorization', value: 'Bearer <token>' });
  else if (auth.type === 'basic') auto.push({ key: 'Authorization', value: 'Basic <credentials>' });
  else if (auth.type === 'apikey') auto.push({ key: auth.key || 'X-API-Key', value: '<api-key>' });

  const userHeaders = activeTabId ? (getKvStore('headers') || []) : [];
  return auto.filter(a => !userHeaders.some(h => h.enabled && h.key.toLowerCase() === a.key.toLowerCase()));
}

function renderAutoHeaders() {
  const container = document.getElementById('autoHeadersSection');
  if (!container) return;
  const auto = getAutoHeaders();
  if (auto.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  container.innerHTML = '<div class="inherited-title">Auto-generated Headers</div>';
  auto.forEach(h => {
    container.innerHTML += `
      <div class="kv-row inherited-row auto-header-row">
        <input type="checkbox" class="kv-enabled" checked disabled>
        <input type="text" class="kv-input inherited" value="${escHtml(h.key)}" readonly>
        <input type="text" class="kv-input inherited" value="${escHtml(h.value)}" readonly>
        <span class="inherited-from">auto</span>
      </div>
    `;
  });
}

function updateHeaderBadge() {
  const badge = document.querySelector('.panel-tab[data-tab="headers"] .badge');
  const userHeaders = activeTabId ? (getKvStore('headers') || []).filter(h => h.key) : [];
  const autoCount = getAutoHeaders().length;
  const inherited = activeTabId && tabs.find(t => t.id === activeTabId)?.sourceId
    ? Object.keys(getInheritedHeaders(tabs.find(t => t.id === activeTabId).sourceId)).length : 0;
  const total = userHeaders.length + autoCount + inherited;
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
}

// ── Inherited Headers ──

function renderInheritedHeaders() {
  const container = document.getElementById('inheritedHeadersSection');
  if (!container) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.sourceId) { container.style.display = 'none'; return; }

  const inherited = getInheritedHeaders(tab.sourceId);
  const keys = Object.keys(inherited);
  if (keys.length === 0) { container.style.display = 'none'; return; }

  container.style.display = 'block';
  container.innerHTML = '<div class="inherited-title">Inherited Headers</div>';
  keys.forEach(key => {
    const h = inherited[key];
    container.innerHTML += `
      <div class="kv-row inherited-row">
        <input type="checkbox" class="kv-enabled" checked disabled>
        <input type="text" class="kv-input inherited" value="${escHtml(key)}" readonly>
        <input type="text" class="kv-input inherited" value="${escHtml(h.value)}" readonly>
        <span class="inherited-from">from ${escHtml(h.from)}</span>
      </div>
    `;
  });
}

// ── KV Editor ──

function renderKvEditor(containerId, rows, storeKey, options) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!rows || rows.length === 0) rows = makeDefaultKv();
  rows.forEach((row, i) => {
    container.appendChild(createKvRow(containerId, storeKey, row, i, options));
  });
}

function createKvRow(containerId, storeKey, row, idx, options) {
  const d = document.createElement('div');
  d.className = 'kv-row' + (row.enabled === false ? ' disabled' : '') + (idx % 2 === 1 ? ' kv-alt' : '');
  const isHeader = storeKey === 'headers';
  const isFormData = storeKey === 'bodyForm' && currentBodyType === 'form';

  let keyAttrs = `type="text" class="kv-input" placeholder="Key" value="${escHtml(row.key)}"`;
  if (isHeader) keyAttrs += ` list="headerSuggestions"`;

  let valueHtml = `<input type="text" class="kv-input" placeholder="Value" value="${escHtml(row.value)}" oninput="kvChange('${containerId}','${storeKey}',${idx},'value',this.value)">`;

  if (isFormData && row.type === 'file') {
    valueHtml = `<input type="file" class="kv-input kv-file" onchange="kvFileChange('${containerId}','${storeKey}',${idx},this.files[0])">`;
  }

  d.innerHTML = `
    <input type="checkbox" class="kv-enabled" ${row.enabled !== false ? 'checked' : ''} onchange="kvChange('${containerId}','${storeKey}',${idx},'enabled',this.checked)">
    <input ${keyAttrs} oninput="kvChange('${containerId}','${storeKey}',${idx},'key',this.value)">
    ${valueHtml}
    ${isFormData ? `<select class="kv-type-select" onchange="kvTypeChange('${containerId}','${storeKey}',${idx},this.value)"><option value="text" ${row.type !== 'file' ? 'selected' : ''}>Text</option><option value="file" ${row.type === 'file' ? 'selected' : ''}>File</option></select>` : ''}
    <button class="kv-delete" onclick="deleteKvRow('${containerId}','${storeKey}',${idx})">&times;</button>
  `;
  return d;
}

function kvChange(containerId, storeKey, idx, field, val) {
  const rows = getKvStore(storeKey);
  if (rows && rows[idx]) {
    rows[idx][field] = val;
    if (field === 'enabled') {
      const row = document.getElementById(containerId)?.children[idx];
      if (row) row.classList.toggle('disabled', !val);
    }
    if (storeKey === 'headers') { renderAutoHeaders(); updateHeaderBadge(); }
  }
}

function kvFileChange(containerId, storeKey, idx, file) {
  const rows = getKvStore(storeKey);
  if (rows && rows[idx]) { rows[idx].file = file; rows[idx].value = file ? file.name : ''; }
}

function kvTypeChange(containerId, storeKey, idx, type) {
  const rows = getKvStore(storeKey);
  if (rows && rows[idx]) {
    rows[idx].type = type;
    rows[idx].value = '';
    rows[idx].file = null;
    renderKvEditor(containerId, rows, storeKey);
  }
}

function getKvStore(storeKey) {
  if (storeKey === 'folderHeaders' || storeKey === 'folderVars') return null;
  if (!activeTabId || !tabData[activeTabId]) return [];
  const d = tabData[activeTabId];
  if (storeKey === 'params') return d.params;
  if (storeKey === 'headers') return d.headers;
  if (storeKey === 'bodyForm') return d.bodyForm;
  return [];
}

function addKvRow(containerId, storeKey) {
  if (storeKey === 'folderHeaders' || storeKey === 'folderVars') {
    const container = document.getElementById(containerId);
    const rows = [];
    container.querySelectorAll('.kv-row').forEach(r => {
      const inputs = r.querySelectorAll('.kv-input');
      const cb = r.querySelector('.kv-enabled');
      rows.push({ key: inputs[0]?.value || '', value: inputs[1]?.value || '', enabled: cb ? cb.checked : true });
    });
    rows.push({ key: '', value: '', enabled: true });
    renderKvEditor(containerId, rows, storeKey);
    return;
  }
  if (!activeTabId) return;
  const rows = getKvStore(storeKey);
  const newRow = { key: '', value: '', enabled: true };
  rows.push(newRow);
  const container = document.getElementById(containerId);
  container.appendChild(createKvRow(containerId, storeKey, newRow, rows.length - 1));
}

function deleteKvRow(containerId, storeKey, idx) {
  if (storeKey === 'folderHeaders' || storeKey === 'folderVars') {
    const container = document.getElementById(containerId);
    const rows = [];
    container.querySelectorAll('.kv-row').forEach((r, i) => {
      if (i === idx) return;
      const inputs = r.querySelectorAll('.kv-input');
      const cb = r.querySelector('.kv-enabled');
      rows.push({ key: inputs[0]?.value || '', value: inputs[1]?.value || '', enabled: cb ? cb.checked : true });
    });
    if (rows.length === 0) rows.push({ key: '', value: '', enabled: true });
    renderKvEditor(containerId, rows, storeKey);
    return;
  }
  const rows = getKvStore(storeKey);
  if (rows.length <= 1) {
    rows[0] = { key: '', value: '', enabled: true };
  } else {
    rows.splice(idx, 1);
  }
  renderKvEditor(containerId, rows, storeKey);
  if (storeKey === 'headers') { renderAutoHeaders(); updateHeaderBadge(); }
}

// ── Body Type ──

function setBodyType(type, btnEl, silent) {
  currentBodyType = type;
  if (activeTabId && tabData[activeTabId]) tabData[activeTabId].bodyType = type;
  document.querySelectorAll('.body-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.bodytype === type);
  });
  document.getElementById('bodyTextContainer').style.display = (type === 'json' || type === 'raw') ? 'flex' : 'none';
  document.getElementById('bodyFormContainer').style.display = (type === 'form' || type === 'urlencoded') ? 'flex' : 'none';
  document.getElementById('bodyNoneMsg').style.display = type === 'none' ? 'block' : 'none';
  document.getElementById('formatJsonBtn').style.display = (type === 'json' || type === 'raw') ? 'inline-flex' : 'none';
  document.getElementById('graphqlContainer').style.display = type === 'graphql' ? 'flex' : 'none';
  document.getElementById('binaryContainer').style.display = type === 'binary' ? 'flex' : 'none';
  updateBodySize();
  updateBodyHighlight();
  renderAutoHeaders();
  updateHeaderBadge();
}

function formatJson() {
  const ta = document.getElementById('bodyTextarea');
  try {
    ta.value = JSON.stringify(JSON.parse(ta.value), null, 2);
    showNotif('Beautified', 'success');
    updateBodySize();
    updateBodyHighlight();
  } catch (e) {
    showNotif('Invalid JSON', 'error');
  }
}

function beautifyResponse() {
  const content = document.getElementById('responseBodyContent');
  const raw = window._lastResponse;
  if (!raw) return;
  try {
    const json = JSON.parse(raw);
    const formatted = JSON.stringify(json, null, 2);
    content.innerHTML = syntaxHighlight(formatted);
    showNotif('Response beautified', 'success');
  } catch {
    try {
      const formatted = raw.replace(/></g, '>\n<');
      content.innerHTML = syntaxHighlightXml(formatted);
      showNotif('Response beautified', 'success');
    } catch {
      showNotif('Cannot beautify this response', 'error');
    }
  }
}

function updateBodySize() {
  const el = document.getElementById('bodySizeIndicator');
  if (!el) return;
  let size = 0;
  if (currentBodyType === 'json' || currentBodyType === 'raw') {
    size = new Blob([document.getElementById('bodyTextarea').value || '']).size;
  } else if (currentBodyType === 'graphql') {
    size = new Blob([document.getElementById('bodyTextarea').value || '']).size;
  }
  el.textContent = size > 0 ? formatBytes(size) : '';
}

// ── Body Syntax Highlighting ──

function highlightVarTokens(html) {
  return html.replace(/\{\{(\w+)\}\}/g, '<span class="var-token">{{$1}}</span>');
}

function updateUrlHighlight() {
  const input = document.getElementById('urlInput');
  const overlay = document.getElementById('urlHighlightOverlay');
  if (!input || !overlay) return;
  const val = input.value;
  if (!val || !/\{\{/.test(val)) {
    overlay.style.display = 'none';
    input.classList.remove('url-has-vars');
    return;
  }
  overlay.style.display = 'block';
  input.classList.add('url-has-vars');
  overlay.innerHTML = highlightVarTokens(escHtml(val));
  overlay.scrollLeft = input.scrollLeft;
}

function syncUrlHighlightScroll() {
  const input = document.getElementById('urlInput');
  const overlay = document.getElementById('urlHighlightOverlay');
  if (input && overlay) overlay.scrollLeft = input.scrollLeft;
}

function updateBodyHighlight() {
  const ta = document.getElementById('bodyTextarea');
  const overlay = document.getElementById('bodyHighlightOverlay');
  const lineNums = document.getElementById('bodyLineNumbers');
  if (!ta || !overlay || !lineNums) return;

  const val = ta.value || '';
  const isJsonBody = currentBodyType === 'json';
  const isRaw = currentBodyType === 'raw';
  const isGraphql = currentBodyType === 'graphql';

  if (!isJsonBody && !isRaw && !isGraphql) {
    overlay.style.display = 'none';
    lineNums.style.display = 'none';
    ta.style.color = 'var(--text-primary)';
    return;
  }

  overlay.style.display = 'block';
  lineNums.style.display = 'block';
  ta.style.color = 'transparent';
  ta.style.caretColor = 'var(--text-primary)';

  if (isJsonBody) {
    overlay.innerHTML = highlightVarTokens(syntaxHighlight(val));
  } else {
    overlay.innerHTML = highlightVarTokens(escHtml(val));
  }

  const lines = val.split('\n');
  lineNums.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
}

function syncBodyScroll() {
  const ta = document.getElementById('bodyTextarea');
  const overlay = document.getElementById('bodyHighlightOverlay');
  const lineNums = document.getElementById('bodyLineNumbers');
  if (!ta || !overlay) return;
  overlay.scrollTop = ta.scrollTop;
  overlay.scrollLeft = ta.scrollLeft;
  if (lineNums) lineNums.scrollTop = ta.scrollTop;
}

// ── Auth ──

function updateAuthFields(authData) {
  const type = document.getElementById('authType').value;
  const container = document.getElementById('authFields');
  container.innerHTML = '';
  const inheritedAuth = activeTabId && tabs.find(t => t.id === activeTabId)?.sourceId
    ? getInheritedAuth(tabs.find(t => t.id === activeTabId).sourceId) : null;

  if (type === 'inherit') {
    if (inheritedAuth) {
      container.innerHTML = `<div class="auth-inherit-info">Inheriting <strong>${inheritedAuth.auth.type}</strong> auth from <em>${escHtml(inheritedAuth.from)}</em></div>`;
    } else {
      container.innerHTML = `<div class="auth-inherit-info">No parent auth to inherit.</div>`;
    }
  } else if (type === 'bearer') {
    const val = authData && authData.token ? authData.token : '';
    container.innerHTML = `<div><label class="auth-field-label">Token</label><input type="text" class="auth-input" id="authToken" placeholder="Bearer token..." value="${escHtml(val)}"></div>`;
  } else if (type === 'jwt') {
    const algo = authData?.algorithm || 'HS256';
    container.innerHTML = `
    <div><label class="auth-field-label">Algorithm</label>
    <select class="auth-input" id="jwtAlgo"><option ${algo==='HS256'?'selected':''}>HS256</option><option ${algo==='HS384'?'selected':''}>HS384</option><option ${algo==='HS512'?'selected':''}>HS512</option><option ${algo==='RS256'?'selected':''}>RS256</option><option ${algo==='RS384'?'selected':''}>RS384</option><option ${algo==='RS512'?'selected':''}>RS512</option></select></div>
    <div><label class="auth-field-label">Secret / Private Key</label><input type="text" class="auth-input" id="jwtSecret" value="${escHtml(authData?.secret || '')}"></div>
    <div><label class="auth-field-label">Payload (JSON)</label><textarea class="auth-input" id="jwtPayload" rows="4" style="font-family:'JetBrains Mono',monospace;resize:vertical">${escHtml(authData?.payload || '{\n  "sub": "1234567890",\n  "iat": 1516239022\n}')}</textarea></div>
    <div><label class="auth-field-label">Header Prefix</label><input type="text" class="auth-input" id="jwtPrefix" value="${escHtml(authData?.prefix || 'Bearer')}" placeholder="Bearer"></div>`;
  } else if (type === 'basic') {
    const u = authData && authData.username ? authData.username : '';
    const p = authData && authData.password ? authData.password : '';
    container.innerHTML = `<div><label class="auth-field-label">Username</label><input type="text" class="auth-input" id="authUser" placeholder="username" value="${escHtml(u)}"></div>
    <div><label class="auth-field-label">Password</label><input type="password" class="auth-input" id="authPass" placeholder="password" value="${escHtml(p)}"></div>`;
  } else if (type === 'apikey') {
    const k = authData && authData.key ? authData.key : 'X-API-Key';
    const v = authData && authData.value ? authData.value : '';
    const addTo = authData?.addTo || 'header';
    container.innerHTML = `<div><label class="auth-field-label">Key</label><input type="text" class="auth-input" id="authKey" placeholder="X-API-Key" value="${escHtml(k)}"></div>
    <div><label class="auth-field-label">Value</label><input type="text" class="auth-input" id="authValue" placeholder="your-api-key" value="${escHtml(v)}"></div>
    <div><label class="auth-field-label">Add to</label><select class="auth-input" id="authAddTo"><option value="header" ${addTo==='header'?'selected':''}>Header</option><option value="query" ${addTo==='query'?'selected':''}>Query Params</option></select></div>`;
  } else if (type === 'oauth2') {
    container.innerHTML = `
    <div><label class="auth-field-label">Grant Type</label>
    <select class="auth-input" id="oauth2Grant"><option value="client_credentials">Client Credentials</option><option value="authorization_code">Authorization Code</option><option value="password">Password</option><option value="implicit">Implicit</option></select></div>
    <div><label class="auth-field-label">Token URL</label><input type="text" class="auth-input" id="oauth2TokenUrl" value="${escHtml(authData?.tokenUrl || '')}"></div>
    <div><label class="auth-field-label">Client ID</label><input type="text" class="auth-input" id="oauth2ClientId" value="${escHtml(authData?.clientId || '')}"></div>
    <div><label class="auth-field-label">Client Secret</label><input type="text" class="auth-input" id="oauth2ClientSecret" value="${escHtml(authData?.clientSecret || '')}"></div>
    <div><label class="auth-field-label">Scope</label><input type="text" class="auth-input" id="oauth2Scope" value="${escHtml(authData?.scope || '')}"></div>
    <button class="btn-primary" style="margin-top:8px" onclick="fetchOAuth2Token()">Get Token</button>
    <div id="oauth2TokenResult" style="margin-top:8px"></div>`;
  } else if (type === 'digest') {
    container.innerHTML = `
    <div><label class="auth-field-label">Username</label><input type="text" class="auth-input" id="digestUser" value="${escHtml(authData?.username || '')}"></div>
    <div><label class="auth-field-label">Password</label><input type="password" class="auth-input" id="digestPass" value="${escHtml(authData?.password || '')}"></div>`;
  } else if (type === 'hawk') {
    container.innerHTML = `
    <div><label class="auth-field-label">Hawk Auth ID</label><input type="text" class="auth-input" id="hawkId" value="${escHtml(authData?.hawkId || '')}"></div>
    <div><label class="auth-field-label">Hawk Auth Key</label><input type="text" class="auth-input" id="hawkKey" value="${escHtml(authData?.hawkKey || '')}"></div>
    <div><label class="auth-field-label">Algorithm</label><select class="auth-input" id="hawkAlgo"><option value="sha256" ${authData?.algorithm==='sha256'?'selected':''}>sha256</option><option value="sha1" ${authData?.algorithm==='sha1'?'selected':''}>sha1</option></select></div>
    <div><label class="auth-field-label">Extra Data</label><input type="text" class="auth-input" id="hawkExt" value="${escHtml(authData?.ext || '')}"></div>`;
  } else if (type === 'aws') {
    container.innerHTML = `
    <div><label class="auth-field-label">Access Key</label><input type="text" class="auth-input" id="awsAccessKey" value="${escHtml(authData?.accessKey || '')}"></div>
    <div><label class="auth-field-label">Secret Key</label><input type="password" class="auth-input" id="awsSecretKey" value="${escHtml(authData?.secretKey || '')}"></div>
    <div><label class="auth-field-label">Region</label><input type="text" class="auth-input" id="awsRegion" value="${escHtml(authData?.region || 'us-east-1')}" placeholder="us-east-1"></div>
    <div><label class="auth-field-label">Service Name</label><input type="text" class="auth-input" id="awsService" value="${escHtml(authData?.service || 'execute-api')}" placeholder="execute-api"></div>
    <div><label class="auth-field-label">Session Token (optional)</label><input type="text" class="auth-input" id="awsSessionToken" value="${escHtml(authData?.sessionToken || '')}"></div>`;
  } else if (type === 'ntlm') {
    container.innerHTML = `
    <div><label class="auth-field-label">Username</label><input type="text" class="auth-input" id="ntlmUser" value="${escHtml(authData?.username || '')}"></div>
    <div><label class="auth-field-label">Password</label><input type="password" class="auth-input" id="ntlmPass" value="${escHtml(authData?.password || '')}"></div>
    <div><label class="auth-field-label">Domain (optional)</label><input type="text" class="auth-input" id="ntlmDomain" value="${escHtml(authData?.domain || '')}"></div>
    <div><label class="auth-field-label">Workstation (optional)</label><input type="text" class="auth-input" id="ntlmWorkstation" value="${escHtml(authData?.workstation || '')}"></div>`;
  } else if (type === 'edgegrid') {
    container.innerHTML = `
    <div><label class="auth-field-label">Access Token</label><input type="text" class="auth-input" id="edgegridAccessToken" value="${escHtml(authData?.accessToken || '')}"></div>
    <div><label class="auth-field-label">Client Token</label><input type="text" class="auth-input" id="edgegridClientToken" value="${escHtml(authData?.clientToken || '')}"></div>
    <div><label class="auth-field-label">Client Secret</label><input type="text" class="auth-input" id="edgegridClientSecret" value="${escHtml(authData?.clientSecret || '')}"></div>
    <div><label class="auth-field-label">Base URL</label><input type="text" class="auth-input" id="edgegridBaseUrl" value="${escHtml(authData?.baseUrl || '')}"></div>`;
  } else if (type === 'asap') {
    container.innerHTML = `
    <div><label class="auth-field-label">Issuer</label><input type="text" class="auth-input" id="asapIssuer" value="${escHtml(authData?.issuer || '')}"></div>
    <div><label class="auth-field-label">Subject</label><input type="text" class="auth-input" id="asapSubject" value="${escHtml(authData?.subject || '')}"></div>
    <div><label class="auth-field-label">Audience</label><input type="text" class="auth-input" id="asapAudience" value="${escHtml(authData?.audience || '')}"></div>
    <div><label class="auth-field-label">Key ID</label><input type="text" class="auth-input" id="asapKeyId" value="${escHtml(authData?.keyId || '')}"></div>
    <div><label class="auth-field-label">Private Key</label><textarea class="auth-input" id="asapPrivateKey" rows="4" style="font-family:'JetBrains Mono',monospace;resize:vertical">${escHtml(authData?.privateKey || '')}</textarea></div>`;
  }

  renderAutoHeaders();
  updateHeaderBadge();
}

function getAuthState() {
  const type = document.getElementById('authType')?.value || 'none';
  if (type === 'bearer') return { type, token: document.getElementById('authToken')?.value || '' };
  if (type === 'jwt') return { type, algorithm: document.getElementById('jwtAlgo')?.value || 'HS256', secret: document.getElementById('jwtSecret')?.value || '', payload: document.getElementById('jwtPayload')?.value || '', prefix: document.getElementById('jwtPrefix')?.value || 'Bearer' };
  if (type === 'basic') return { type, username: document.getElementById('authUser')?.value || '', password: document.getElementById('authPass')?.value || '' };
  if (type === 'apikey') return { type, key: document.getElementById('authKey')?.value || 'X-API-Key', value: document.getElementById('authValue')?.value || '', addTo: document.getElementById('authAddTo')?.value || 'header' };
  if (type === 'oauth2') return {
    type, grant: document.getElementById('oauth2Grant')?.value || 'client_credentials',
    tokenUrl: document.getElementById('oauth2TokenUrl')?.value || '',
    clientId: document.getElementById('oauth2ClientId')?.value || '',
    clientSecret: document.getElementById('oauth2ClientSecret')?.value || '',
    scope: document.getElementById('oauth2Scope')?.value || '',
    token: document.getElementById('oauth2TokenResult')?.dataset?.token || ''
  };
  if (type === 'digest') return { type, username: document.getElementById('digestUser')?.value || '', password: document.getElementById('digestPass')?.value || '' };
  if (type === 'hawk') return { type, hawkId: document.getElementById('hawkId')?.value || '', hawkKey: document.getElementById('hawkKey')?.value || '', algorithm: document.getElementById('hawkAlgo')?.value || 'sha256', ext: document.getElementById('hawkExt')?.value || '' };
  if (type === 'aws') return { type, accessKey: document.getElementById('awsAccessKey')?.value || '', secretKey: document.getElementById('awsSecretKey')?.value || '', region: document.getElementById('awsRegion')?.value || 'us-east-1', service: document.getElementById('awsService')?.value || 'execute-api', sessionToken: document.getElementById('awsSessionToken')?.value || '' };
  if (type === 'ntlm') return { type, username: document.getElementById('ntlmUser')?.value || '', password: document.getElementById('ntlmPass')?.value || '', domain: document.getElementById('ntlmDomain')?.value || '', workstation: document.getElementById('ntlmWorkstation')?.value || '' };
  if (type === 'edgegrid') return { type, accessToken: document.getElementById('edgegridAccessToken')?.value || '', clientToken: document.getElementById('edgegridClientToken')?.value || '', clientSecret: document.getElementById('edgegridClientSecret')?.value || '', baseUrl: document.getElementById('edgegridBaseUrl')?.value || '' };
  if (type === 'asap') return { type, issuer: document.getElementById('asapIssuer')?.value || '', subject: document.getElementById('asapSubject')?.value || '', audience: document.getElementById('asapAudience')?.value || '', keyId: document.getElementById('asapKeyId')?.value || '', privateKey: document.getElementById('asapPrivateKey')?.value || '' };
  if (type === 'inherit') return { type: 'inherit' };
  return { type: 'none' };
}

async function fetchOAuth2Token() {
  const state = getAuthState();
  if (!state.tokenUrl) { showNotif('Token URL required', 'error'); return; }
  try {
    const body = new URLSearchParams();
    body.append('grant_type', state.grant);
    body.append('client_id', state.clientId);
    body.append('client_secret', state.clientSecret);
    if (state.scope) body.append('scope', state.scope);
    const resp = await restfyFetch(resolveVariables(state.tokenUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const data = await resp.json();
    const result = document.getElementById('oauth2TokenResult');
    if (data.access_token) {
      result.dataset.token = data.access_token;
      result.innerHTML = `<div style="color:var(--green)">Token acquired (${data.token_type || 'bearer'})</div><input class="auth-input" value="${escHtml(data.access_token)}" readonly style="margin-top:4px">`;
      showNotif('OAuth2 token acquired', 'success');
    } else {
      result.innerHTML = `<div style="color:var(--red)">Error: ${escHtml(JSON.stringify(data))}</div>`;
    }
  } catch (err) {
    showNotif('OAuth2 error: ' + err.message, 'error');
  }
}

// ── Theme Toggle ──

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('restfy_theme', next);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = next === 'dark' ? '\u{263E}' : '\u{2600}';
}

function loadTheme() {
  const saved = localStorage.getItem('restfy_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = saved === 'dark' ? '\u{263E}' : '\u{2600}';
}

// ── Panel Switching ──

function switchReqTab(name) {
  document.querySelectorAll('.panel-tabs .panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.request-panels .panel-content').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
}

function switchRespTab(name) {
  document.querySelectorAll('.response-tabs .response-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  ['resp-body', 'resp-headers', 'resp-cookies', 'resp-tests'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === 'resp-' + name ? 'flex' : 'none';
  });
}

// ── Workspace ──

function showWorkspace() {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('folderEditor').style.display = 'none';
  document.getElementById('collectionDocs').style.display = 'none';
  document.getElementById('requestWorkspace').style.display = 'flex';
  _activeDocsColId = null;
}

function showEmpty() {
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('requestWorkspace').style.display = 'none';
  document.getElementById('folderEditor').style.display = 'none';
  document.getElementById('collectionDocs').style.display = 'none';
  _activeDocsColId = null;
}

function updateMethodColor() {
  const sel = document.getElementById('methodSelect');
  const method = sel.value;
  sel.className = 'method-select m-' + method;
  const urlInput = document.getElementById('urlInput');
  urlInput.className = 'url-input method-border-' + method;
  const t = tabs.find(t => t.id === activeTabId);
  if (t) { t.method = method; renderTabs(); }
}

function copyResponse() {
  if (window._lastResponse) {
    navigator.clipboard.writeText(window._lastResponse).then(() => showNotif('Copied!', 'success'));
  }
}

function switchResponseMode(mode) {
  document.querySelectorAll('.resp-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const content = document.getElementById('responseBodyContent');
  const raw = document.getElementById('responseBodyRaw');
  const preview = document.getElementById('responseBodyPreview');
  content.style.display = mode === 'pretty' ? 'block' : 'none';
  raw.style.display = mode === 'raw' ? 'block' : 'none';
  preview.style.display = mode === 'preview' ? 'block' : 'none';
}

function showResponsePlaceholder() {
  document.getElementById('statusBadge').innerHTML = '';
  document.getElementById('respMeta').textContent = '';
  document.getElementById('copyRespBtn').style.display = 'none';
  document.getElementById('curlBtn').style.display = 'none';
  document.getElementById('codeGenBtn').style.display = 'none';
  document.getElementById('beautifyRespBtn').style.display = 'none';
  document.getElementById('responsePlaceholder').style.display = 'block';
  document.getElementById('responseBodyContent').style.display = 'none';
  document.getElementById('responseBodyRaw').style.display = 'none';
  document.getElementById('responseBodyPreview').style.display = 'none';
}

function restoreResponse(cached) {
  if (!cached) return showResponsePlaceholder();
  document.getElementById('statusBadge').innerHTML = cached.statusHtml || '';
  document.getElementById('respMeta').textContent = cached.meta || '';
  document.getElementById('copyRespBtn').style.display = 'inline-flex';
  document.getElementById('curlBtn').style.display = 'inline-flex';
  document.getElementById('codeGenBtn').style.display = 'inline-flex';
  document.getElementById('beautifyRespBtn').style.display = 'inline-flex';
  document.getElementById('responsePlaceholder').style.display = 'none';
  document.getElementById('responseBodyContent').style.display = 'block';
  document.getElementById('responseBodyContent').innerHTML = cached.bodyHtml || '';
  document.getElementById('responseBodyRaw').textContent = cached.bodyRaw || '';
  const preview = document.getElementById('responseBodyPreview');
  if (cached.bodyRaw && /<html/i.test(cached.bodyRaw)) {
    preview.srcdoc = cached.bodyRaw;
  }
  if (cached.headersHtml) document.getElementById('respHeadersBody').innerHTML = cached.headersHtml;
  if (cached.cookiesHtml) document.getElementById('respCookiesBody').innerHTML = cached.cookiesHtml;
  window._lastResponse = cached.bodyRaw;
  switchResponseMode('pretty');
}

// ── Save Modal ──

function openSaveModal() {
  const sel = document.getElementById('saveCollection');
  sel.innerHTML = '<option value="__new__">+ New Collection</option>';
  collections.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
  });
  sel.onchange = () => {
    document.getElementById('newCollectionGroup').style.display = sel.value === '__new__' ? 'block' : 'none';
    renderSaveTargetFolders(sel.value);
  };
  sel.value = '__new__';
  const t = tabs.find(t => t.id === activeTabId);
  document.getElementById('saveReqName').value = t ? t.name : '';
  document.getElementById('newCollectionName').value = '';
  document.getElementById('newCollectionGroup').style.display = 'block';
  document.getElementById('saveTargetFolder').innerHTML = '';
  document.getElementById('saveModal').classList.add('open');
}

function renderSaveTargetFolders(collectionId) {
  const sel = document.getElementById('saveTargetFolder');
  sel.innerHTML = '<option value="">Collection Root</option>';
  if (collectionId === '__new__') return;
  const col = collections.find(c => c.id === collectionId);
  if (!col) return;
  function addOptions(children, depth) {
    children.forEach(child => {
      if (child.type === 'folder') {
        sel.innerHTML += `<option value="${child.id}">${'  '.repeat(depth)}${escHtml(child.name)}</option>`;
        if (child.children) addOptions(child.children, depth + 1);
      }
    });
  }
  if (col.children) addOptions(col.children, 1);
}

function closeSaveModal() {
  document.getElementById('saveModal').classList.remove('open');
}

function saveRequest() {
  saveCurrentTabState();
  const name = document.getElementById('saveReqName').value.trim() || 'Request';
  let colId = document.getElementById('saveCollection').value;
  let targetFolderId = document.getElementById('saveTargetFolder')?.value || '';

  if (colId === '__new__') {
    const colName = document.getElementById('newCollectionName').value.trim() || 'My Collection';
    const col = makeCollection({ name: colName });
    collections.push(col);
    colId = col.id;
    openFolders.add(col.id);
  }

  const t = tabs.find(t => t.id === activeTabId);
  const d = tabData[activeTabId];
  if (!t || !d) return;

  const req = makeRequest({
    name, method: t.method, url: t.url,
    params: deepClone(d.params), headers: deepClone(d.headers),
    bodyForm: deepClone(d.bodyForm), bodyType: d.bodyType,
    body: d.body, graphqlVars: d.graphqlVars,
    auth: deepClone(d.auth),
    preRequestScript: d.preRequestScript, testScript: d.testScript
  });

  const target = targetFolderId ? findNodeInAll(targetFolderId) : findNodeInAll(colId);
  if (target && target.children) {
    target.children.push(req);
    t.sourceId = req.id;
  }

  if (d) d.dirty = false;
  saveState();
  renderSidebar();
  closeSaveModal();
  renderTabs();
  showNotif(`Saved to collection`, 'success');
}

// ── Environment Manager ──

function openEnvManager() {
  document.getElementById('envModal').classList.add('open');
  setEnvModalTab('envs');
  renderEnvSelector();
  renderEnvManager();
}

function setEnvModalTab(which) {
  document.querySelectorAll('#envModal .env-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.envTab === which);
  });
  const envs = document.getElementById('envTabEnvs');
  const globs = document.getElementById('envTabGlobals');
  if (envs) envs.style.display = which === 'envs' ? 'block' : 'none';
  if (globs) globs.style.display = which === 'globals' ? 'block' : 'none';
}

function clearActiveEnv() {
  activeEnvId = null;
  saveState();
  renderEnvManager();
  renderEnvSelector();
}

function closeEnvManager() {
  document.getElementById('envModal').classList.remove('open');
}

function renderEnvManager() {
  const summary = document.getElementById('envActiveSummary');
  if (summary) {
    const active = environments.find(e => e.id === activeEnvId);
    if (active) {
      summary.innerHTML = `
        <strong>Active environment:</strong> ${escHtml(active.name)}
        <button type="button" class="btn-text" style="margin-left:8px" onclick="clearActiveEnv()">No environment</button>`;
    } else {
      summary.innerHTML = 'No environment selected — globals still apply. Choose one below or from the title bar dropdown.';
    }
  }

  const hint = document.getElementById('envEmptyHint');
  if (hint) {
    if (environments.length === 0) {
      hint.style.display = 'block';
      hint.innerHTML = 'Create an environment (for example <strong>Local</strong> or <strong>Staging</strong>) to group variables. Use the <strong>Globals</strong> tab for values that apply everywhere (for example <code>base_url</code>).';
    } else {
      hint.style.display = 'none';
    }
  }

  const namedList = document.getElementById('envNamedList');
  if (namedList) {
    namedList.innerHTML = '';
    environments.forEach(env => {
      const sec = document.createElement('div');
      sec.className = 'env-section' + (env.id === activeEnvId ? ' active-env' : '');
      sec.innerHTML = `
        <div class="env-section-header">
          <span class="env-section-title">${escHtml(env.name)}</span>
          <div class="env-actions">
            <button type="button" class="btn-text ${env.id === activeEnvId ? 'active' : ''}" onclick="setActiveEnv('${env.id}')">${env.id === activeEnvId ? 'Active' : 'Set active'}</button>
            <button type="button" class="btn-text" onclick="renameEnv('${env.id}')">Rename</button>
            <button type="button" class="btn-text ctx-danger" onclick="deleteEnv('${env.id}')">Delete</button>
          </div>
        </div>
        <div class="kv-editor" id="envVars_${env.id}"></div>
        <button type="button" class="add-row-btn" onclick="addEnvVar('${env.id}')">+ Add variable</button>
      `;
      namedList.appendChild(sec);
      renderEnvVarsEditor(env);
    });
  }

  renderGlobalVarsEditor();
}

function renderGlobalVarsEditor() {
  const container = document.getElementById('globalVarsEditor');
  if (!container) return;
  container.innerHTML = '';
  if (globalVars.length === 0) globalVars = [{ key: '', value: '', enabled: true }];
  globalVars.forEach((v, i) => {
    const row = document.createElement('div');
    row.className = 'kv-row' + (i % 2 === 1 ? ' kv-alt' : '');
    row.innerHTML = `
      <input type="checkbox" class="kv-enabled" ${v.enabled !== false ? 'checked' : ''} onchange="globalVars[${i}].enabled=this.checked">
      <input type="text" class="kv-input" placeholder="Variable" value="${escHtml(v.key)}" oninput="globalVars[${i}].key=this.value">
      <input type="text" class="kv-input" placeholder="Value" value="${escHtml(v.value)}" oninput="globalVars[${i}].value=this.value">
      <button class="kv-delete" onclick="globalVars.splice(${i},1); renderEnvManager()">&times;</button>
    `;
    container.appendChild(row);
  });
}

function addGlobalVar() {
  globalVars.push({ key: '', value: '', enabled: true });
  renderEnvManager();
}

function renderEnvVarsEditor(env) {
  const container = document.getElementById('envVars_' + env.id);
  if (!container) return;
  container.innerHTML = '';
  if (!env.variables || env.variables.length === 0) env.variables = [{ key: '', value: '', enabled: true }];
  env.variables.forEach((v, i) => {
    const row = document.createElement('div');
    row.className = 'kv-row' + (i % 2 === 1 ? ' kv-alt' : '');
    row.innerHTML = `
      <input type="checkbox" class="kv-enabled" ${v.enabled !== false ? 'checked' : ''} onchange="updateEnvVar('${env.id}',${i},'enabled',this.checked)">
      <input type="text" class="kv-input" placeholder="Variable" value="${escHtml(v.key)}" oninput="updateEnvVar('${env.id}',${i},'key',this.value)">
      <input type="text" class="kv-input" placeholder="Value" value="${escHtml(v.value)}" oninput="updateEnvVar('${env.id}',${i},'value',this.value)">
      <button class="kv-delete" onclick="deleteEnvVar('${env.id}',${i})">&times;</button>
    `;
    container.appendChild(row);
  });
}

function updateEnvVar(envId, idx, field, val) {
  const env = environments.find(e => e.id === envId);
  if (env && env.variables[idx]) env.variables[idx][field] = val;
}

function addEnvVar(envId) {
  const env = environments.find(e => e.id === envId);
  if (env) { env.variables.push({ key: '', value: '', enabled: true }); renderEnvManager(); }
}

function deleteEnvVar(envId, idx) {
  const env = environments.find(e => e.id === envId);
  if (env) { env.variables.splice(idx, 1); if (env.variables.length === 0) env.variables.push({ key: '', value: '', enabled: true }); renderEnvManager(); }
}

function addEnvironmentFromInput() {
  const input = document.getElementById('envNewNameInput');
  const name = (input && input.value || '').trim();
  if (!name) {
    showNotif('Enter a name for the environment', 'info');
    return;
  }
  environments.push({ id: genId(), name, variables: [{ key: '', value: '', enabled: true }] });
  if (input) input.value = '';
  saveState();
  renderEnvManager();
  renderEnvSelector();
}

async function renameEnv(envId) {
  const env = environments.find(e => e.id === envId);
  if (!env) return;
  const name = await appPrompt('Rename environment', null, { placeholder: 'Environment name', defaultValue: env.name });
  if (name) { env.name = name; saveState(); renderEnvManager(); renderEnvSelector(); }
}

async function deleteEnv(envId) {
  const env = environments.find(e => e.id === envId);
  const ok = await appConfirm('Delete environment', `Delete "${env ? env.name : 'this environment'}"? This cannot be undone.`, { danger: true, okLabel: 'Delete' });
  if (!ok) return;
  environments = environments.filter(e => e.id !== envId);
  if (activeEnvId === envId) activeEnvId = null;
  saveState();
  renderEnvManager();
  renderEnvSelector();
}

function setActiveEnv(envId) {
  activeEnvId = activeEnvId === envId ? null : envId;
  saveState();
  renderEnvManager();
  renderEnvSelector();
}

function saveEnvChanges() {
  saveState();
  renderEnvSelector();
  closeEnvManager();
  showNotif('Environments saved', 'success');
}

function renderEnvSelector() {
  const sel = document.getElementById('envSelector');
  if (!sel) return;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No Environment';
  sel.appendChild(none);
  environments.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.name;
    sel.appendChild(opt);
  });
  sel.value = activeEnvId && environments.some(x => x.id === activeEnvId) ? activeEnvId : '';
  hideUrlVarPopover();
}

function exportEnvironments() {
  const data = {
    _type: 'restfy_environments',
    version: 1,
    environments: deepClone(environments),
    globalVars: deepClone(globalVars)
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'restfy-environments.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showNotif('Environments exported', 'success');
}

function importEnvironments(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    try {
      const data = JSON.parse(reader.result);
      if (data._type !== 'restfy_environments' || !Array.isArray(data.environments)) {
        showNotif('Invalid environment file', 'error');
        return;
      }
      let added = 0;
      data.environments.forEach(env => {
        if (!env.name || !env.variables) return;
        const existing = environments.find(e => e.name === env.name);
        if (!existing) {
          env.id = genId();
          environments.push(env);
          added++;
        }
      });
      if (data.globalVars && Array.isArray(data.globalVars)) {
        data.globalVars.forEach(g => {
          if (g.key && !globalVars.find(v => v.key === g.key)) {
            globalVars.push({ key: g.key, value: g.value, enabled: g.enabled !== false });
          }
        });
      }
      saveState();
      renderEnvManager();
      renderEnvSelector();
      showNotif(`Imported ${added} environment(s)`, 'success');
    } catch (e) {
      showNotif('Failed to parse environment file', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── URL bar: hover {{variables}} → resolved value + link (Postman-style) ──

let _urlVarMeasureCanvas = null;
let _urlVarPopoverHideTimer = null;
let _urlVarHitSig = null;
let _urlVarHoverWired = false;

function getUrlInputMeasureContext() {
  const input = document.getElementById('urlInput');
  if (!input) return null;
  if (!_urlVarMeasureCanvas) _urlVarMeasureCanvas = document.createElement('canvas');
  const ctx = _urlVarMeasureCanvas.getContext('2d');
  const cs = getComputedStyle(input);
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return { ctx, input };
}

function measureUrlSubstringWidth(upToIndex, fullText) {
  const o = getUrlInputMeasureContext();
  if (!o) return 0;
  return o.ctx.measureText(fullText.slice(0, upToIndex)).width;
}

function getUrlVariableRegions(value) {
  const regions = [];
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(value)) !== null) {
    regions.push({
      start: m.index,
      end: m.index + m[0].length,
      key: m[1],
      raw: m[0]
    });
  }
  return regions;
}

function hitTestUrlVariable(clientX) {
  const input = document.getElementById('urlInput');
  const ws = document.getElementById('requestWorkspace');
  if (!input || !ws || ws.style.display === 'none') return null;
  const rect = input.getBoundingClientRect();
  const cs = getComputedStyle(input);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const x = clientX - rect.left - padL + input.scrollLeft;
  if (x < 0) return null;
  const value = input.value;
  const regions = getUrlVariableRegions(value);
  const fudge = 2;
  for (const r of regions) {
    const w0 = measureUrlSubstringWidth(r.start, value);
    const w1 = measureUrlSubstringWidth(r.end, value);
    if (x >= w0 - fudge && x <= w1 + fudge) return r;
  }
  return null;
}

function isProbablyHttpUrl(s) {
  const t = (s || '').trim();
  return /^https?:\/\/.+/i.test(t);
}

function hideUrlVarPopover() {
  const pop = document.getElementById('urlVarPopover');
  if (pop) pop.hidden = true;
  const input = document.getElementById('urlInput');
  if (input) input.classList.remove('url-input--var-hover');
  _urlVarHitSig = null;
}

function positionUrlVarPopover(clientX, clientY) {
  const pop = document.getElementById('urlVarPopover');
  if (!pop || pop.hidden) return;
  const margin = 10;
  pop.style.left = '0px';
  pop.style.top = '0px';
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = clientX - pw / 2;
  let top = clientY + margin;
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
  if (top + ph > window.innerHeight - margin) top = clientY - ph - margin;
  pop.style.left = left + 'px';
  pop.style.top = Math.max(margin, top) + 'px';
}

function updateUrlVarPopover(hit, clientX, clientY) {
  const pop = document.getElementById('urlVarPopover');
  if (!pop || !hit) return;
  const { key, raw } = hit;
  const { value, source } = lookupVariableKey(key);

  const tokenEl = document.getElementById('urlVarPopoverToken');
  if (tokenEl) tokenEl.textContent = raw;

  const linkEl = document.getElementById('urlVarPopoverValueLink');
  const textEl = document.getElementById('urlVarPopoverValueText');
  if (linkEl) linkEl.style.display = 'none';
  if (textEl) {
    textEl.style.display = 'none';
    textEl.className = 'url-var-popover-value-text';
    textEl.textContent = '';
  }

  if (source === 'unresolved') {
    if (textEl) {
      textEl.style.display = 'block';
      textEl.textContent = 'No value — variable is not defined';
      textEl.classList.add('url-var-popover-value-muted');
    }
  } else if (value == null || String(value).trim() === '') {
    if (textEl) {
      textEl.style.display = 'block';
      textEl.textContent = '(empty value)';
      textEl.classList.add('url-var-popover-value-muted');
    }
  } else if (isProbablyHttpUrl(value)) {
    const v = String(value).trim();
    if (linkEl) {
      linkEl.style.display = 'inline-block';
      linkEl.href = v;
      linkEl.textContent = v;
      linkEl.title = v;
    }
  } else if (textEl) {
    textEl.style.display = 'block';
    textEl.textContent = value;
  }

  const badge = document.getElementById('urlVarPopoverBadge');
  if (badge) {
    if (source === 'environment') {
      badge.innerHTML = '<span class="url-var-popover-badge-icon env">E</span><span>Environment</span>';
    } else if (source === 'global') {
      badge.innerHTML = '<span class="url-var-popover-badge-icon glob">G</span><span>Global</span>';
    } else {
      badge.innerHTML = '<span class="url-var-popover-badge-icon miss">?</span><span>Unresolved</span>';
    }
  }

  const input = document.getElementById('urlInput');
  const fullResolved = input ? resolveVariables(input.value.trim()) : '';
  const resRow = document.getElementById('urlVarPopoverResolvedRow');
  const resLink = document.getElementById('urlVarPopoverResolvedLink');
  if (resRow && resLink) {
    if (fullResolved && isProbablyHttpUrl(fullResolved)) {
      resRow.style.display = 'block';
      resLink.href = fullResolved.trim();
      resLink.textContent = fullResolved.trim();
    } else {
      resRow.style.display = 'none';
    }
  }

  const manageBtn = document.getElementById('urlVarPopoverManageBtn');
  if (manageBtn) {
    manageBtn.onclick = () => {
      hideUrlVarPopover();
      openEnvManager();
    };
  }

  pop.hidden = false;
  requestAnimationFrame(() => positionUrlVarPopover(clientX, clientY));
}

function setupUrlVariableHover() {
  const input = document.getElementById('urlInput');
  const pop = document.getElementById('urlVarPopover');
  if (!input || !pop || _urlVarHoverWired) return;
  _urlVarHoverWired = true;

  input.addEventListener('mousemove', (e) => {
    const hit = hitTestUrlVariable(e.clientX);
    if (!hit) {
      input.classList.remove('url-input--var-hover');
      _urlVarHitSig = null;
      if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer);
      _urlVarPopoverHideTimer = setTimeout(() => {
        if (!pop.matches(':hover')) hideUrlVarPopover();
      }, 100);
      return;
    }
    if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer);
    input.classList.add('url-input--var-hover');
    const sig = hit.start + ':' + hit.end;
    if (sig !== _urlVarHitSig) {
      _urlVarHitSig = sig;
      updateUrlVarPopover(hit, e.clientX, e.clientY);
    } else {
      positionUrlVarPopover(e.clientX, e.clientY);
    }
  });

  input.addEventListener('mouseleave', (e) => {
    if (e.relatedTarget && pop.contains(e.relatedTarget)) return;
    if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer);
    _urlVarPopoverHideTimer = setTimeout(() => {
      if (!pop.matches(':hover')) hideUrlVarPopover();
    }, 120);
  });

  pop.addEventListener('mouseenter', () => {
    if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer);
  });

  pop.addEventListener('mouseleave', (e) => {
    if (e.relatedTarget && input.contains(e.relatedTarget)) return;
    hideUrlVarPopover();
  });

  input.addEventListener('scroll', () => { hideUrlVarPopover(); syncUrlHighlightScroll(); });
}

function setupInputVarTooltips() {
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches('.kv-input, .auth-input, .form-input')) return;
    const val = el.value || '';
    el.title = /\{\{\w+\}\}/.test(val) ? resolveVariables(val) : '';
  }, true);

  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el.matches('.kv-input, .auth-input, .form-input')) return;
    const val = el.value || '';
    el.title = /\{\{\w+\}\}/.test(val) ? resolveVariables(val) : '';
  }, true);
}
