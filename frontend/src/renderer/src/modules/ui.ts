import {
  state, saveState, makeDefaultKv, makeRequest, makeFolder, makeCollection,
  deepClone, findNodeInAll, findParentInAll, getSiblingArrayForNode,
  reorderAmongSiblings, getInheritedHeaders, getInheritedAuth,
  deleteNode, duplicateNode, assignNewIds, countRequests, resolveVariables,
  lookupVariableKey, addToHistory
} from './state'
import {
  genId, escHtml, formatBytes, syntaxHighlight, syntaxHighlightXml,
  showNotif, appConfirm, appPrompt
} from './utils'

// ── Components ────────────────────────────────────────────────────
import { methodBadge, methodBadgeEl } from '../components/method-badge'
import { renderAuthFields, readAuthFields, authTypeLabel } from '../components/auth-fields'
import {
  createKvRow, createReadOnlyKvRow,
  renderKvEditor, readKvRows, getKvStore,
  addKvRow, deleteKvRow, kvChange, kvFileChange, kvTypeChange
} from '../components/kv-editor'
import { showCtxMenu, positionContextMenu, hideContextMenu, buildCtxHtml } from '../components/ctx-menu'
import { activateTabStrip, setActiveTabBtn } from '../components/tab-strip'
import { setMainView } from '../components/workspace'
import { buildDocsPreviewSrcdoc, tryPatchDocsPreviewContent } from '../docs-preview-page'
import {
  destroyBodyEditor,
  refreshBodyEditor,
  getBodyEditorText,
  setBodyEditorText,
  syncBodyEditorToTextarea
} from './body-editor-cm'

// Re-export KV helpers so app.ts / codegen.ts / http.ts can import from a single place
export {
  renderKvEditor, getKvStore, addKvRow, deleteKvRow,
  kvChange, kvFileChange, kvTypeChange, hideContextMenu, positionContextMenu
}

// ── Drag & Drop ──────────────────────────────────────────────────

let _collectionTreeFilter = ''
let _treeDragActiveId: string | null = null

function clearTreeDropTargetClasses() {
  document.querySelectorAll('.tree-drop-target, .tree-drop-after').forEach(el => {
    el.classList.remove('tree-drop-target', 'tree-drop-after')
  })
}

function bindTreeRowDnD(rowEl: HTMLElement, nodeId: string) {
  if (_collectionTreeFilter) { rowEl.classList.add('tree-drag-disabled'); return }
  const handle = rowEl.querySelector<HTMLElement>('.tree-drag-handle')
  if (!handle) return
  handle.setAttribute('draggable', 'true')
  handle.onmousedown = (e) => e.stopPropagation()
  handle.onclick = (e) => e.stopPropagation()
  handle.ondragstart = (e) => {
    e.stopPropagation()
    e.dataTransfer!.setData('text/plain', nodeId)
    e.dataTransfer!.effectAllowed = 'move'
    _treeDragActiveId = nodeId
    rowEl.classList.add('dragging')
  }
  handle.ondragend = () => {
    _treeDragActiveId = null
    rowEl.classList.remove('dragging')
    clearTreeDropTargetClasses()
  }
  rowEl.ondragover = (e) => {
    if (!_treeDragActiveId || _treeDragActiveId === nodeId) return
    const arrA = getSiblingArrayForNode(_treeDragActiveId)
    const arrB = getSiblingArrayForNode(nodeId)
    if (!arrA || arrA !== arrB) return
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    const rect = rowEl.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    clearTreeDropTargetClasses()
    rowEl.classList.add('tree-drop-target')
    if (after) rowEl.classList.add('tree-drop-after')
  }
  rowEl.ondragleave = (e) => {
    if (!rowEl.contains(e.relatedTarget as Node)) rowEl.classList.remove('tree-drop-target', 'tree-drop-after')
  }
  rowEl.ondrop = (e) => {
    e.preventDefault(); e.stopPropagation()
    const dragId = e.dataTransfer!.getData('text/plain')
    rowEl.classList.remove('tree-drop-target', 'tree-drop-after')
    if (!dragId || dragId === nodeId) return
    const rect = rowEl.getBoundingClientRect()
    const placeAfter = e.clientY > rect.top + rect.height / 2
    if (reorderAmongSiblings(dragId, nodeId, placeAfter)) {
      saveState()
      const sb = document.querySelector<HTMLInputElement>('.sidebar-search')
      renderSidebar(sb ? sb.value : '')
    }
  }
}

// ── Tabs ─────────────────────────────────────────────────────────

export function newTab(req?: any, sourceId?: string | null) {
  const id = 'tab_' + Date.now()
  const tab = {
    id, name: req ? req.name : 'New Request',
    method: req ? req.method : 'GET',
    url: req ? req.url : '',
    sourceId: sourceId || null, pinned: false
  }
  state.tabs.push(tab)
  state.tabData[id] = {
    params: req?.params ? deepClone(req.params) : makeDefaultKv(),
    headers: req?.headers ? deepClone(req.headers) : makeDefaultKv(),
    bodyForm: req?.bodyForm ? deepClone(req.bodyForm) : makeDefaultKv(),
    bodyType: req ? (req.bodyType != null ? req.bodyType : 'json') : 'json',
    body: req ? (req.body != null ? req.body : '{}') : '{}',
    graphqlVars: req ? (req.graphqlVars || '') : '',
    auth: req ? deepClone(req.auth || { type: 'none' }) : { type: 'none' },
    preRequestScript: req ? (req.preRequestScript || '') : '',
    testScript: req ? (req.testScript || '') : ''
  }
  setActiveTab(id)
  renderTabs()
}

export function setActiveTab(id: string) {
  if (state.activeTabId && state.activeTabId !== id) saveCurrentTabState()
  state.activeTabId = id
  state.editingNodeId = null
  loadTabState(id)
  renderTabs()
  showWorkspace()
}

export function closeTab(id: string, e?: Event) {
  if (e) e.stopPropagation()
  const td = state.tabData[id]
  if (td?.pinned) return
  const idx = state.tabs.findIndex(t => t.id === id)
  state.tabs.splice(idx, 1)
  delete state.tabData[id]
  if (state.tabs.length === 0) {
    state.activeTabId = null; showEmpty(); renderTabs(); return
  }
  if (state.activeTabId === id) {
    const newIdx = Math.min(idx, state.tabs.length - 1)
    setActiveTab(state.tabs[newIdx].id)
  }
  renderTabs()
}

export function togglePinTab(id: string) {
  const d = state.tabData[id]
  if (d) d.pinned = !d.pinned
  renderTabs()
}

export function saveCurrentTabState() {
  if (!state.activeTabId || !state.tabData[state.activeTabId]) return
  const t = state.tabs.find(t => t.id === state.activeTabId)
  if (!t) return
  const ms = document.getElementById('methodSelect') as HTMLSelectElement | null
  const ui = document.getElementById('urlInput') as HTMLInputElement | null
  if (ms) t.method = ms.value
  if (ui) t.url = ui.value
  t.name = t.url
    ? (t.url.replace(/https?:\/\//, '').split('?')[0].split('/').filter(Boolean).pop() || t.url).substring(0, 30)
    : 'New Request'
  state.tabData[state.activeTabId!].bodyType = state.currentBodyType as any
  syncBodyEditorToTextarea()
  state.tabData[state.activeTabId!].body = getBodyEditorText()
  const gv = document.getElementById('graphqlVarsTextarea') as HTMLTextAreaElement | null
  if (gv) state.tabData[state.activeTabId!].graphqlVars = gv.value
  state.tabData[state.activeTabId!].auth = getAuthState()
  const prs = document.getElementById('preRequestScriptEditor') as HTMLTextAreaElement | null
  if (prs) state.tabData[state.activeTabId!].preRequestScript = prs.value
  const ts = document.getElementById('testScriptEditor') as HTMLTextAreaElement | null
  if (ts) state.tabData[state.activeTabId!].testScript = ts.value
}

function loadTabState(id: string) {
  const t = state.tabs.find(t => t.id === id)
  const d = state.tabData[id]
  if (!t || !d) return

  // Destroy any live CodeMirror instance before loading new tab state so stale
  // editor content can never bleed into the incoming tab. This must happen
  // before we touch the hidden textarea or call setBodyType/refreshBodyEditor.
  destroyBodyEditor()

  ;(document.getElementById('methodSelect') as HTMLSelectElement).value = t.method || 'GET'
  ;(document.getElementById('urlInput') as HTMLInputElement).value = t.url || ''
  updateMethodColor(); updateUrlHighlight()
  renderKvEditor('paramsEditor', d.params, 'params')
  renderKvEditor('headersEditor', d.headers, 'headers')
  renderInheritedHeaders(); renderAutoHeaders(); updateHeaderBadge()
  renderKvEditor('bodyFormEditor', d.bodyForm, 'bodyForm')

  // Capture body content once so every branch below uses the same value and
  // we never accidentally fall back to whatever the textarea held previously.
  const bodyContent = d.body ?? ''
  ;(document.getElementById('bodyTextarea') as HTMLTextAreaElement).value = bodyContent

  const bt = d.bodyType || 'none'

  // silent=true → updates visibility/state flags without trying to rebuild the
  // CM editor (we do that explicitly below for json/raw).
  setBodyType(bt, null, true)

  if (bt === 'json' || bt === 'raw') {
    // Pass bodyContent explicitly so refreshBodyEditor never falls back to a
    // stale textarea value that might still reflect the previous tab.
    refreshBodyEditor(bt === 'json' ? 'json' : 'raw', bodyContent)
    _updateBodySize()
  }

  const gv = document.getElementById('graphqlVarsTextarea') as HTMLTextAreaElement | null
  if (gv) gv.value = d.graphqlVars || ''
  const bt2 = document.getElementById('bodyTextarea2') as HTMLTextAreaElement | null
  if (bt2) bt2.value = bodyContent
  ;(document.getElementById('authType') as HTMLSelectElement).value = d.auth ? d.auth.type || 'none' : 'none'
  updateAuthFields(d.auth)
  const prs = document.getElementById('preRequestScriptEditor') as HTMLTextAreaElement | null
  if (prs) prs.value = d.preRequestScript || ''
  const ts = document.getElementById('testScriptEditor') as HTMLTextAreaElement | null
  if (ts) ts.value = d.testScript || ''
  if ((d as any).response) restoreResponse((d as any).response)
  else showResponsePlaceholder()
  switchReqTab(t.sourceId ? 'body' : 'params')
}

export function renderTabs() {
  const bar = document.getElementById('tabsBar')
  if (!bar) return
  bar.innerHTML = ''
  state.tabs.forEach(t => {
    const d = state.tabData[t.id]
    const pinned = d?.pinned
    const div = document.createElement('div')
    div.className = 'tab' + (t.id === state.activeTabId ? ' active' : '') + (pinned ? ' pinned' : '') + (d?.dirty ? ' unsaved' : '')
    div.onclick = () => setActiveTab(t.id)
    div.innerHTML = `
      ${methodBadge(t.method, 'tab')}
      <span class="tab-name">${escHtml(t.name)}</span>
      ${pinned ? '<span class="tab-pin" title="Pinned">📌</span>' : ''}
      <span class="tab-close" onclick="closeTab('${t.id}', event)" title="Close tab">&times;</span>
    `
    div.oncontextmenu = (e) => { e.preventDefault(); showTabContextMenu(e, t.id) }
    bar.appendChild(div)
  })
}

function showTabContextMenu(e: MouseEvent, tabId: string) {
  const pinned = state.tabData[tabId]?.pinned
  showCtxMenu(e, [
    { label: pinned ? 'Unpin Tab' : 'Pin Tab', action: `togglePinTab('${tabId}'); hideContextMenu();` },
    { label: 'Duplicate Tab', action: `duplicateTab('${tabId}'); hideContextMenu();` },
    'separator',
    { label: 'Close Tab', action: `closeTab('${tabId}'); hideContextMenu();` },
    { label: 'Close Other Tabs', action: `closeOtherTabs('${tabId}'); hideContextMenu();` }
  ])
}

export function duplicateTab(tabId: string) {
  const t = state.tabs.find(t => t.id === tabId)
  const d = state.tabData[tabId]
  if (!t || !d) return
  newTab({ name: t.name, method: t.method, url: t.url, params: d.params, headers: d.headers, bodyForm: d.bodyForm, bodyType: d.bodyType, body: d.body, graphqlVars: d.graphqlVars, auth: d.auth, preRequestScript: d.preRequestScript, testScript: d.testScript })
}

export function closeOtherTabs(keepId: string) {
  const toClose = state.tabs.filter(t => t.id !== keepId && !state.tabData[t.id]?.pinned)
  toClose.forEach(t => { delete state.tabData[t.id] })
  state.tabs = state.tabs.filter(t => t.id === keepId || state.tabData[t.id]?.pinned)
  if (!state.tabs.find(t => t.id === state.activeTabId)) setActiveTab(keepId)
  renderTabs()
}

// ── Sidebar ───────────────────────────────────────────────────────

export function renderSidebar(filter?: string) {
  if (state.sidebarMode === 'collections') {
    let f = filter
    if (f === undefined) {
      const sb = document.querySelector<HTMLInputElement>('.sidebar-search')
      f = sb ? sb.value : ''
    }
    renderCollectionTree(f || '')
  } else {
    renderHistoryList(filter || '')
  }
}

export function switchSidebarMode(mode: string) {
  state.sidebarMode = mode
  setActiveTabBtn('.sidebar-mode-btn', mode, 'data-mode')
  renderSidebar()
}

function renderCollectionTree(filter: string) {
  _collectionTreeFilter = (filter || '').trim()
  const container = document.getElementById('sidebarContent')!
  container.innerHTML = ''
  if (state.collections.length === 0) {
    container.innerHTML = `<div class="sidebar-empty">No collections yet.<br>Import a Postman collection<br>or save a request.</div>`
    return
  }
  state.collections.forEach(col => {
    const el = renderTreeNode(col, 0, col.id, filter)
    if (el) container.appendChild(el)
  })
}

function renderTreeNode(node: any, depth: number, collectionId: string, filter: string): HTMLElement | null {
  if (node.type === 'request') {
    if (filter && !node.name.toLowerCase().includes(filter.toLowerCase()) && !node.url.toLowerCase().includes(filter.toLowerCase())) return null
    const div = document.createElement('div')
    div.className = 'tree-node tree-request'
    div.style.paddingLeft = (12 + depth * 16) + 'px'
    div.dataset.id = node.id
    div.innerHTML = `
      <span class="tree-drag-handle" title="Drag to reorder">⋮⋮</span>
      ${methodBadge(node.method)}
      <span class="tree-label">${escHtml(node.name)}</span>
    `
    div.onclick = () => openRequest(node.id)
    div.oncontextmenu = (e) => { e.preventDefault(); showNodeContextMenu(e, node.id, 'request', collectionId) }
    bindTreeRowDnD(div, node.id)
    return div
  }

  const isOpen = state.openFolders.has(node.id) || !!filter
  const count = countRequests(node)
  const isCollection = node.type === 'collection'

  const wrapper = document.createElement('div')
  wrapper.className = 'tree-group' + (isCollection ? ' tree-collection' : '')

  const header = document.createElement('div')
  header.className = 'tree-node tree-folder-header' + (isOpen ? ' open' : '')
  header.style.paddingLeft = (12 + depth * 16) + 'px'
  header.dataset.id = node.id
  header.innerHTML = `
    <span class="tree-drag-handle" title="Drag to reorder">⋮⋮</span>
    <span class="tree-toggle">${isOpen ? '▼' : '▶'}</span>
    <span class="tree-label">${escHtml(node.name)}</span>
    <span class="tree-count">${count}</span>
    <button class="tree-add-btn" onclick="event.stopPropagation(); quickAddRequest('${node.id}')" title="Add request">+</button>
  `
  header.onclick = () => { toggleFolder(node.id); if (isCollection) openCollectionDocs(node.id) }
  header.oncontextmenu = (e) => { e.preventDefault(); showNodeContextMenu(e, node.id, node.type, collectionId) }
  bindTreeRowDnD(header, node.id)
  wrapper.appendChild(header)

  if (isOpen && node.children) {
    const childContainer = document.createElement('div')
    childContainer.className = 'tree-children'
    let hasVisibleChild = false
    node.children.forEach((child: any) => {
      const childEl = renderTreeNode(child, depth + 1, collectionId, filter)
      if (childEl) { childContainer.appendChild(childEl); hasVisibleChild = true }
    })
    if (hasVisibleChild || !filter) wrapper.appendChild(childContainer)
  }

  if (filter && count === 0 && !node.name.toLowerCase().includes(filter.toLowerCase())) return null
  return wrapper
}

export function toggleFolder(id: string) {
  if (state.openFolders.has(id)) state.openFolders.delete(id)
  else state.openFolders.add(id)
  renderSidebar()
}

export function filterSidebar(val: string) { renderSidebar(val) }

export function openRequest(nodeId: string) {
  const node = findNodeInAll(nodeId)
  if (!node || node.type !== 'request') return
  const existing = state.tabs.find(t => t.sourceId === nodeId)
  if (existing) { setActiveTab(existing.id); return }
  newTab(node, nodeId)
}

// ── Collection Docs ───────────────────────────────────────────────

let _activeDocsColId: string | null = null
let _docsFullDocsVisible = false
let _docsPreviewRefreshTimer: ReturnType<typeof setTimeout> | null = null
let _cdocsPreviewThemeObs: MutationObserver | null = null

function _ensureDocsPreviewThemeObserver(): void {
  if (_cdocsPreviewThemeObs) return
  _cdocsPreviewThemeObs = new MutationObserver(() => {
    const col = _activeDocsColId ? findNodeInAll(_activeDocsColId) : null
    if (col && col.type === 'collection') _refreshDocsPreview(col)
  })
  _cdocsPreviewThemeObs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
}

function _refreshDocsPreview(col: any): void {
  const frame = document.getElementById('cdocsPreviewFrame') as HTMLIFrameElement | null
  if (!frame) return
  const theme = document.documentElement.getAttribute('data-theme') || 'light'
  try {
    if (tryPatchDocsPreviewContent(frame, col, theme)) return
    frame.srcdoc = buildDocsPreviewSrcdoc(col, theme)
  } catch (e) {
    console.error('[cdocs preview]', e)
  }
}

/** Debounced so typing updates preview without reloading the iframe every key (avoids UI shake). */
const DOCS_PREVIEW_DEBOUNCE_MS = 600

function scheduleDocsPreviewRefresh(): void {
  const id = _activeDocsColId
  if (!id) return
  if (_docsPreviewRefreshTimer) clearTimeout(_docsPreviewRefreshTimer)
  _docsPreviewRefreshTimer = setTimeout(() => {
    _docsPreviewRefreshTimer = null
    const col = findNodeInAll(id)
    if (col && col.type === 'collection') _refreshDocsPreview(col)
  }, DOCS_PREVIEW_DEBOUNCE_MS)
}

export function openCollectionDocs(colId: string) {
  const col = findNodeInAll(colId)
  if (!col || col.type !== 'collection') return
  _activeDocsColId = colId
  _docsFullDocsVisible = false
  if (state.activeTabId) saveCurrentTabState()
  setMainView('collection-docs')
  switchCDocsTab('overview')
  renderCollectionDocs(col)
}

export function switchCDocsTab(tab: string) {
  activateTabStrip(tab, {
    tabSelector: '.cdocs-tab',
    tabAttr: 'data-cdocs-tab',
    panelSelector: '.cdocs-panel',
    panelMatch: 'id'
  })
  // Manually set active panel since ids use mixed case
  document.querySelectorAll<HTMLElement>('.cdocs-panel').forEach(p => p.classList.remove('active'))
  const panel = document.getElementById('cdocsPanel' + tab.charAt(0).toUpperCase() + tab.slice(1))
  if (panel) panel.classList.add('active')

  if (tab !== 'overview') {
    const col = _activeDocsColId ? findNodeInAll(_activeDocsColId) : null
    if (!col) return
    if (tab === 'authorization') _renderCDocsAuth(col as any)
    else if (tab === 'scripts') _renderCDocsScripts(col as any)
    else if (tab === 'variables') _renderCDocsVars(col as any)
    else if (tab === 'runs') _renderCDocsRuns(col as any)
  }
}

function renderCollectionDocs(col: any) {
  const nameEl = document.getElementById('cdocsTopbarName')
  const titleEl = document.getElementById('cdocsOverviewTitle')
  if (nameEl) nameEl.textContent = col.name
  if (titleEl) titleEl.textContent = col.name

  const reqCount = countRequests(col)
  const folderCount = _countFolders(col)
  const metaEl = document.getElementById('cdocsOverviewMeta')
  if (metaEl) {
    metaEl.innerHTML = ''
    const items = [
      { icon: '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>', text: reqCount + ' request' + (reqCount !== 1 ? 's' : '') },
      { icon: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>', text: folderCount + ' folder' + (folderCount !== 1 ? 's' : '') }
    ]
    items.forEach(it => {
      const span = document.createElement('span')
      span.className = 'cdocs-overview-meta-item'
      span.innerHTML = it.icon + ' ' + it.text
      metaEl.appendChild(span)
    })
  }

  const descEl = document.getElementById('cdocsDesc') as HTMLTextAreaElement | null
  if (descEl) {
    if (document.activeElement !== descEl) descEl.value = col.description || ''
    descEl.oninput = function () {
      col.description = (this as HTMLTextAreaElement).value
      saveState()
      scheduleDocsPreviewRefresh()
    }
  }

  const authTab = document.querySelector('[data-cdocs-tab="authorization"]')
  if (authTab) {
    const hasAuth = col.auth?.type && col.auth.type !== 'none'
    const dot = authTab.querySelector('.cdocs-tab-dot')
    if (hasAuth && !dot) authTab.innerHTML += '<span class="cdocs-tab-dot"></span>'
    else if (!hasAuth && dot) dot.remove()
  }

  const viewLink = document.getElementById('cdocsViewDocsLink')
  if (viewLink) viewLink.onclick = (e) => { e.preventDefault(); _toggleFullDocs(col) }
  const publishBtn = document.getElementById('cdocsPublishBtn')
  if (publishBtn) publishBtn.onclick = () => (window as any).shareCollection(col.id)
  const copyBtn = document.getElementById('cdocsCopyLinkBtn')
  if (copyBtn) copyBtn.onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(deepClone(col), null, 2))
      .then(() => showNotif('Collection JSON copied to clipboard', 'success'))
  }
  const runBtn = document.getElementById('cdocsRunCollectionBtn')
  if (runBtn) runBtn.onclick = () => (window as any).runCollection(col.id)

  const fullDocs = document.getElementById('cdocsFullDocs') as HTMLElement | null
  if (fullDocs) {
    fullDocs.style.display = _docsFullDocsVisible ? 'block' : 'none'
    if (_docsFullDocsVisible) _buildFullDocs(col, fullDocs)
  }

  _ensureDocsPreviewThemeObserver()
  _refreshDocsPreview(col)
}

function _countFolders(node: any): number {
  let c = 0
  if (node.children) node.children.forEach((ch: any) => { if (ch.type === 'folder') { c++; c += _countFolders(ch) } })
  return c
}

function _toggleFullDocs(col: any) {
  _docsFullDocsVisible = !_docsFullDocsVisible
  const el = document.getElementById('cdocsFullDocs') as HTMLElement
  const link = document.getElementById('cdocsViewDocsLink')
  if (_docsFullDocsVisible) {
    el.style.display = 'block'; _buildFullDocs(col, el)
    if (link) link.innerHTML = 'Hide documentation &uarr;'
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else {
    el.style.display = 'none'
    if (link) link.innerHTML = 'View complete documentation &rarr;'
  }
}

function _buildFullDocs(col: any, container: HTMLElement) {
  container.innerHTML = ''
  const header = document.createElement('div')
  header.className = 'cdocs-full-docs-header'
  header.innerHTML = '<div class="cdocs-full-docs-title">' + escHtml(col.name) + '</div>'
  container.appendChild(header)
  if (col.description) {
    const descP = document.createElement('p')
    descP.style.cssText = 'font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0 0 20px;white-space:pre-wrap'
    descP.textContent = col.description
    container.appendChild(descP)
  }
  if (col.auth?.type && col.auth.type !== 'none') _renderDocAuthRow(container, col.auth, col.name)
  if (!col.children || col.children.length === 0) {
    container.innerHTML += '<div style="text-align:center;color:var(--text-dim);padding:32px;font-size:13px">No requests in this collection yet.</div>'
    scheduleDocsPreviewRefresh()
    return
  }
  col.children.filter((c: any) => c.type === 'request').forEach((req: any) => _renderDocRequestCard(container, req))
  col.children.filter((c: any) => c.type === 'folder').forEach((f: any) => _renderDocFolderSection(container, f, col))
  scheduleDocsPreviewRefresh()
}

function _renderDocFolderSection(container: HTMLElement, folder: any, parentCol: any) {
  const section = document.createElement('div')
  section.className = 'cdocs-folder-section'
  const heading = document.createElement('div')
  heading.className = 'cdocs-folder-heading'
  heading.textContent = folder.name
  section.appendChild(heading)
  const folderDesc = document.createElement('textarea')
  folderDesc.className = 'cdocs-desc cdocs-folder-desc-input'
  folderDesc.placeholder = 'Add folder description...'
  folderDesc.value = folder.description || ''
  folderDesc.oninput = function () {
    folder.description = (this as HTMLTextAreaElement).value
    saveState()
    scheduleDocsPreviewRefresh()
  }
  section.appendChild(folderDesc)
  const effectiveAuth = folder.auth?.type && folder.auth.type !== 'none' ? folder.auth : null
  if (effectiveAuth) {
    _renderDocAuthRow(section, effectiveAuth, null)
  } else if (parentCol.auth?.type && parentCol.auth.type !== 'none') {
    const note = document.createElement('div')
    note.className = 'cdocs-folder-auth-row'
    note.innerHTML = `<strong>Authorization</strong> <span>${escHtml(authTypeLabel(parentCol.auth.type))}</span> <span style="margin-left:auto;font-style:italic">inherited from collection ${escHtml(parentCol.name)}</span>`
    section.appendChild(note)
  }
  ;(folder.children || []).filter((c: any) => c.type === 'request').forEach((req: any) => _renderDocRequestCard(section, req))
  container.appendChild(section)
  if (folder.children) folder.children.filter((c: any) => c.type === 'folder').forEach((sub: any) => _renderDocFolderSection(container, sub, parentCol))
}

function _renderDocRequestCard(container: HTMLElement, req: any) {
  const card = document.createElement('div')
  card.className = 'cdocs-req-card'

  const header = document.createElement('div')
  header.className = 'cdocs-req-card-header'
  header.onclick = () => openRequest(req.id)

  const badge = methodBadgeEl(req.method || 'GET')
  badge.className = 'cdocs-req-card-method bg-' + (req.method || 'GET')

  const name = document.createElement('span')
  name.className = 'cdocs-req-card-name'
  name.textContent = req.name || 'Untitled'

  const openLink = document.createElement('span')
  openLink.className = 'cdocs-req-card-open'
  openLink.textContent = 'Open request →'

  header.appendChild(badge); header.appendChild(name); header.appendChild(openLink)
  card.appendChild(header)

  if (req.url) {
    const urlWrap = document.createElement('div')
    urlWrap.className = 'cdocs-req-card-url'
    urlWrap.innerHTML = '<code>' + escHtml(req.url) + '</code>'
    card.appendChild(urlWrap)
  }
  const reqDescWrap = document.createElement('div')
  reqDescWrap.className = 'cdocs-req-desc-wrap'
  const reqDesc = document.createElement('textarea')
  reqDesc.className = 'cdocs-desc cdocs-req-desc-input'
  reqDesc.placeholder = 'Add request description...'
  reqDesc.value = req.description || ''
  reqDesc.oninput = function () {
    req.description = (this as HTMLTextAreaElement).value
    saveState()
    scheduleDocsPreviewRefresh()
  }
  reqDescWrap.appendChild(reqDesc)
  card.appendChild(reqDescWrap)
  container.appendChild(card)
}

function _renderDocAuthRow(container: HTMLElement, auth: any, _sourceName: string | null) {
  const row = document.createElement('div')
  row.className = 'cdocs-folder-auth-row'
  let html = `<strong>Authorization</strong> <span>${escHtml(authTypeLabel(auth.type))}</span>`
  if (auth.type === 'bearer') html += ' &mdash; Token: <code style="font-size:11px;background:var(--bg-mid);padding:2px 6px;border-radius:3px">&lt;token&gt;</code>'
  if (auth.type === 'basic') html += ' &mdash; Username: ' + escHtml(auth.username || '')
  if (auth.type === 'apikey') html += ' &mdash; ' + escHtml(auth.key || 'X-API-Key') + ': &lt;value&gt;'
  row.innerHTML = html
  container.appendChild(row)
}

function _renderCDocsAuth(col: any) {
  const el = document.getElementById('cdocsAuthContent')
  if (!el) return
  const auth = col.auth || { type: 'none' }
  if (!auth.type || auth.type === 'none') {
    el.innerHTML = `<div class="cdocs-auth-header">Authorization</div>
      <div class="cdocs-auth-type">No Auth</div>
      <div class="cdocs-auth-note">This collection does not have authorization configured.</div>
      <div style="margin-top:16px"><button class="btn-secondary" onclick="openFolderEditor('${col.id}')">Configure Authorization</button></div>`
    return
  }
  let tableRows = ''
  if (auth.type === 'bearer') tableRows = `<tr><td>Type</td><td>Bearer Token</td></tr><tr><td>Token</td><td>${escHtml(auth.token || '<token>')}</td></tr>`
  else if (auth.type === 'basic') tableRows = `<tr><td>Type</td><td>Basic Auth</td></tr><tr><td>Username</td><td>${escHtml(auth.username || '')}</td></tr><tr><td>Password</td><td>••••••</td></tr>`
  else if (auth.type === 'apikey') tableRows = `<tr><td>Type</td><td>API Key</td></tr><tr><td>Header</td><td>${escHtml(auth.key || 'X-API-Key')}</td></tr><tr><td>Value</td><td>${escHtml(auth.value || '')}</td></tr>`
  el.innerHTML = `<div class="cdocs-auth-header">Authorization</div>
    <div class="cdocs-auth-type">${authTypeLabel(auth.type)}</div>
    <table class="cdocs-auth-table">${tableRows}</table>
    <div class="cdocs-auth-note">This authorization is inherited by all requests in the collection unless overridden.</div>
    <div style="margin-top:16px"><button class="btn-secondary" onclick="openFolderEditor('${col.id}')">Edit Authorization</button></div>`
}

function _renderCDocsScripts(col: any) {
  const pre = document.getElementById('cdocsPreScript') as HTMLTextAreaElement | null
  const test = document.getElementById('cdocsTestScript') as HTMLTextAreaElement | null
  if (pre) pre.value = col.preRequestScript || ''
  if (test) test.value = col.testScript || ''
  const saveBtn = document.getElementById('cdocsSaveScriptsBtn')
  if (saveBtn) saveBtn.onclick = () => {
    col.preRequestScript = (document.getElementById('cdocsPreScript') as HTMLTextAreaElement).value
    col.testScript = (document.getElementById('cdocsTestScript') as HTMLTextAreaElement).value
    saveState(); showNotif('Scripts saved', 'success')
  }
}

function _renderCDocsVars(col: any) {
  renderKvEditor('cdocsVarsEditor', col.variables || [], 'cdocsVars')
  const saveBtn = document.getElementById('cdocsSaveVarsBtn')
  if (saveBtn) saveBtn.onclick = () => {
    col.variables = readKvRows('cdocsVarsEditor')
    saveState(); showNotif('Variables saved', 'success')
  }
}

function _renderCDocsRuns(col: any) {
  const runBtn = document.getElementById('cdocsRunCollectionBtn')
  if (runBtn) runBtn.onclick = () => (window as any).runCollection(col.id)
}

// ── Folder / Collection Editor ────────────────────────────────────

export function openFolderEditor(nodeId: string) {
  const node = findNodeInAll(nodeId)
  if (!node) return
  _activeDocsColId = null
  state.editingNodeId = nodeId
  if (state.activeTabId) saveCurrentTabState()
  setMainView('folder-editor')
  renderFolderEditor(node as any)
}

function renderFolderEditor(node: any) {
  const titleEl = document.getElementById('folderEditorTitle')
  const iconEl = document.getElementById('folderEditorIcon')
  if (titleEl) titleEl.textContent = node.name
  if (iconEl) iconEl.textContent = node.type === 'collection' ? '📦' : '📁'
  renderKvEditor('folderHeadersEditor', node.headers || [], 'folderHeaders')
  ;(document.getElementById('folderAuthType') as HTMLSelectElement).value = node.auth?.type || 'none'
  updateFolderAuthFields(node.auth)
  const varsPanel = document.getElementById('folderVarsPanel') as HTMLElement | null
  if (node.type === 'collection') {
    if (varsPanel) varsPanel.style.display = 'block'
    renderKvEditor('folderVarsEditor', node.variables || [], 'folderVars')
  } else {
    if (varsPanel) varsPanel.style.display = 'none'
  }
  const pre = document.getElementById('folderPreRequestScript') as HTMLTextAreaElement | null
  const ts = document.getElementById('folderTestScript') as HTMLTextAreaElement | null
  if (pre) pre.value = node.preRequestScript || ''
  if (ts) ts.value = node.testScript || ''
}

export function saveFolderEdits() {
  if (!state.editingNodeId) return
  const node = findNodeInAll(state.editingNodeId) as any
  if (!node) return
  node.headers = readKvRows('folderHeadersEditor')
  node.auth = readAuthFields('folderAuth')
  if (node.type === 'collection') node.variables = readKvRows('folderVarsEditor')
  node.preRequestScript = (document.getElementById('folderPreRequestScript') as HTMLTextAreaElement).value
  node.testScript = (document.getElementById('folderTestScript') as HTMLTextAreaElement).value
  saveState(); showNotif('Folder settings saved', 'success')
}

export function updateFolderAuthFields(authData: any) {
  const type = (document.getElementById('folderAuthType') as HTMLSelectElement).value
  const container = document.getElementById('folderAuthFields')!
  renderAuthFields(container, type, authData, 'folderAuth', { showAddTo: false, showOAuth2: false })
}

export function quickAddRequest(parentId: string) {
  const parent = findNodeInAll(parentId) as any
  if (!parent || !parent.children) return
  const req = makeRequest({ name: 'New Request' })
  parent.children.push(req)
  state.openFolders.add(parentId)
  saveState(); renderSidebar(); openRequest(req.id)
}

// ── Context Menu ──────────────────────────────────────────────────

export function showNodeContextMenu(e: MouseEvent, nodeId: string, nodeType: string, _collectionId: string) {
  const items: any[] = []
  if (nodeType === 'collection' || nodeType === 'folder') {
    if (nodeType === 'collection') items.push({ label: 'View Documentation', action: `openCollectionDocs('${nodeId}'); hideContextMenu();` })
    items.push(
      { label: 'New Request', action: `quickAddRequest('${nodeId}'); hideContextMenu();` },
      { label: 'New Folder', action: `addSubfolder('${nodeId}'); hideContextMenu();` },
      { label: 'Edit Settings', action: `openFolderEditor('${nodeId}'); hideContextMenu();` },
      'separator'
    )
  }
  if (nodeType === 'request') {
    items.push({ label: 'Open', action: `openRequest('${nodeId}'); hideContextMenu();` }, 'separator')
  }
  items.push(
    { label: 'Rename', action: `startRename('${nodeId}'); hideContextMenu();` },
    { label: 'Duplicate', action: `doDuplicate('${nodeId}'); hideContextMenu();` }
  )
  if (nodeType === 'collection') {
    items.push(
      { label: 'Export as Postman JSON', action: `exportCollectionAsPostman('${nodeId}'); hideContextMenu();` },
      { label: 'Share &amp; Publish Docs', action: `shareCollection('${nodeId}'); hideContextMenu();` },
      { label: 'Run Collection', action: `runCollection('${nodeId}'); hideContextMenu();` }
    )
  }
  items.push('separator', { label: 'Delete', action: `doDelete('${nodeId}'); hideContextMenu();`, danger: true })
  showCtxMenu(e, items)
}

export function addSubfolder(parentId: string) {
  const parent = findNodeInAll(parentId) as any
  if (!parent || !parent.children) return
  const folder = makeFolder({ name: 'New Folder' })
  parent.children.push(folder)
  state.openFolders.add(parentId)
  saveState(); renderSidebar(); startRename(folder.id)
}

export function startRename(nodeId: string) {
  renderSidebar()
  const el = document.querySelector<HTMLElement>(`[data-id="${nodeId}"] .tree-label`)
  if (!el) return
  const node = findNodeInAll(nodeId)
  if (!node) return
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'inline-rename'
  input.value = node.name
  input.onclick = (e) => e.stopPropagation()
  input.onkeydown = (e) => {
    if (e.key === 'Enter') _commitRename(nodeId, input.value)
    if (e.key === 'Escape') renderSidebar()
  }
  input.onblur = () => { _commitRename(nodeId, input.value) }
  el.replaceWith(input); input.focus(); input.select()
}

function _commitRename(nodeId: string, newName: string) {
  const node = findNodeInAll(nodeId)
  if (node && newName.trim()) { node.name = newName.trim(); saveState() }
  renderSidebar()
}

export function doDuplicate(nodeId: string) {
  duplicateNode(nodeId); saveState(); renderSidebar(); showNotif('Duplicated', 'success')
}

export async function doDelete(nodeId: string) {
  const node = findNodeInAll(nodeId)
  if (!node) return
  const ok = await appConfirm('Delete item', `Delete "${node.name}"? This cannot be undone.`, { danger: true, okLabel: 'Delete' })
  if (!ok) return
  state.tabs.filter(t => t.sourceId === nodeId).forEach(t => closeTab(t.id))
  deleteNode(nodeId); saveState(); renderSidebar(); showNotif('Deleted', 'success')
}

// ── History ───────────────────────────────────────────────────────

function renderHistoryList(filter: string) {
  const container = document.getElementById('sidebarContent')!
  container.innerHTML = ''
  if (state.history.length === 0) {
    container.innerHTML = '<div class="sidebar-empty">No history yet.<br>Send a request to see it here.</div>'
    return
  }
  const clearBtn = document.createElement('div')
  clearBtn.className = 'history-clear'
  clearBtn.innerHTML = '<button class="btn-text" onclick="clearHistory()">Clear History</button>'
  container.appendChild(clearBtn)

  const groups: Record<string, any[]> = {}
  state.history.forEach(h => {
    if (filter && !h.url.toLowerCase().includes(filter.toLowerCase())) return
    const date = new Date(h.timestamp).toLocaleDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(h)
  })

  Object.entries(groups).forEach(([date, items]) => {
    const group = document.createElement('div')
    group.className = 'history-group'
    group.innerHTML = `<div class="history-date">${date}</div>`
    items.forEach(h => {
      const item = document.createElement('div')
      item.className = 'tree-node tree-request'
      item.style.paddingLeft = '12px'
      item.innerHTML = `
        ${methodBadge(h.method)}
        <span class="tree-label">${escHtml(h.url.replace(/https?:\/\//, '').substring(0, 40))}</span>
        <span class="history-meta">${h.status || ''} · ${h.time}ms</span>
      `
      item.onclick = () => newTab({ name: h.url.split('/').pop() || 'Request', method: h.method, url: h.url })
      group.appendChild(item)
    })
    container.appendChild(group)
  })
}

export async function clearHistory() {
  const ok = await appConfirm('Clear history', 'Clear all request history? This cannot be undone.', { danger: true, okLabel: 'Clear' })
  if (!ok) return
  state.history = []; saveState(); renderSidebar()
}

// ── Auto / Inherited Headers ──────────────────────────────────────

const AUTO_HEADERS = [
  { key: 'User-Agent', value: 'Restify/2.0' },
  { key: 'Accept', value: '*/*' },
  { key: 'Accept-Encoding', value: 'gzip, deflate, br' },
  { key: 'Connection', value: 'keep-alive' }
]

export function getAutoHeaders(): { key: string; value: string }[] {
  const auto = [...AUTO_HEADERS]
  if (state.currentBodyType === 'json') auto.push({ key: 'Content-Type', value: 'application/json' })
  else if (state.currentBodyType === 'urlencoded') auto.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' })
  else if (state.currentBodyType === 'graphql') auto.push({ key: 'Content-Type', value: 'application/json' })
  else if (state.currentBodyType === 'raw') auto.push({ key: 'Content-Type', value: 'text/plain' })
  const auth = state.activeTabId && state.tabData[state.activeTabId] ? state.tabData[state.activeTabId].auth : { type: 'none' }
  if ((auth as any).type === 'bearer' && (auth as any).token) auto.push({ key: 'Authorization', value: 'Bearer <token>' })
  else if ((auth as any).type === 'basic') auto.push({ key: 'Authorization', value: 'Basic <credentials>' })
  else if ((auth as any).type === 'apikey') auto.push({ key: (auth as any).key || 'X-API-Key', value: '<api-key>' })
  const userHeaders = state.activeTabId ? (getKvStore('headers') || []) : []
  return auto.filter(a => !userHeaders.some((h: any) => h.enabled && h.key.toLowerCase() === a.key.toLowerCase()))
}

function renderAutoHeaders() {
  const container = document.getElementById('autoHeadersSection')
  if (!container) return
  const auto = getAutoHeaders()
  if (auto.length === 0) { container.style.display = 'none'; return }
  container.style.display = 'block'
  container.innerHTML = '<div class="inherited-title">Auto-generated Headers</div>'
  auto.forEach(h => container.appendChild(createReadOnlyKvRow(h.key, h.value, 'auto')))
}

function updateHeaderBadge() {
  const badge = document.querySelector<HTMLElement>('.panel-tab[data-tab="headers"] .badge')
  const userHeaders = state.activeTabId ? (getKvStore('headers') || []).filter((h: any) => h.key) : []
  const autoCount = getAutoHeaders().length
  const sourceTab = state.activeTabId ? state.tabs.find(t => t.id === state.activeTabId) : null
  const inherited = sourceTab?.sourceId ? Object.keys(getInheritedHeaders(sourceTab.sourceId)).length : 0
  const total = userHeaders.length + autoCount + inherited
  if (badge) { badge.textContent = String(total); badge.style.display = total > 0 ? 'inline-flex' : 'none' }
}

function renderInheritedHeaders() {
  const container = document.getElementById('inheritedHeadersSection')
  if (!container) return
  const tab = state.tabs.find(t => t.id === state.activeTabId)
  if (!tab?.sourceId) { container.style.display = 'none'; return }
  const inherited = getInheritedHeaders(tab.sourceId)
  const keys = Object.keys(inherited)
  if (keys.length === 0) { container.style.display = 'none'; return }
  container.style.display = 'block'
  container.innerHTML = '<div class="inherited-title">Inherited Headers</div>'
  keys.forEach(key => {
    const h = inherited[key]
    container.appendChild(createReadOnlyKvRow(key, h.value, `from ${h.from}`))
  })
}

// Listen for header changes from kv-editor component
document.addEventListener('kv:headers-changed', () => { renderAutoHeaders(); updateHeaderBadge() })

// ── Body Type ─────────────────────────────────────────────────────

export function setBodyType(type: string, _btnEl?: any, silent?: boolean) {
  state.currentBodyType = type
  if (state.activeTabId && state.tabData[state.activeTabId]) state.tabData[state.activeTabId].bodyType = type as any
  document.querySelectorAll<HTMLElement>('.body-type-btn').forEach(b => b.classList.toggle('active', (b as any).dataset.bodytype === type))
  const show = (id: string, v: boolean) => { const el = document.getElementById(id) as HTMLElement | null; if (el) el.style.display = v ? 'flex' : 'none' }
  const showB = (id: string, v: boolean) => { const el = document.getElementById(id) as HTMLElement | null; if (el) el.style.display = v ? 'block' : 'none' }
  show('bodyTextContainer', type === 'json' || type === 'raw')
  show('bodyFormContainer', type === 'form' || type === 'urlencoded')
  showB('bodyNoneMsg', type === 'none')
  const fmtBtn = document.getElementById('formatJsonBtn') as HTMLElement | null
  if (fmtBtn) fmtBtn.style.display = (type === 'json' || type === 'raw') ? 'inline-flex' : 'none'
  show('graphqlContainer', type === 'graphql')
  show('binaryContainer', type === 'binary')
  _updateBodySize()
  if (!silent) {
    renderBodyEditorForType()
  } else if (type !== 'json' && type !== 'raw') {
    syncBodyEditorToTextarea()
    destroyBodyEditor()
  }
  renderAutoHeaders(); updateHeaderBadge()
}

function renderBodyEditorForType(): void {
  const t = state.currentBodyType
  if (t === 'json' || t === 'raw') {
    refreshBodyEditor(t === 'json' ? 'json' : 'raw')
  } else {
    syncBodyEditorToTextarea()
    destroyBodyEditor()
  }
}

export function formatJson() {
  try {
    const formatted = JSON.stringify(JSON.parse(getBodyEditorText()), null, 2)
    const ta = document.getElementById('bodyTextarea') as HTMLTextAreaElement
    ta.value = formatted
    setBodyEditorText(formatted)
    showNotif('Beautified', 'success')
    _updateBodySize()
  } catch {
    showNotif('Invalid JSON', 'error')
  }
}

export function beautifyResponse() {
  const content = document.getElementById('responseBodyContent')!
  const raw = (window as any)._lastResponse
  if (!raw) return
  try {
    content.innerHTML = syntaxHighlight(JSON.stringify(JSON.parse(raw), null, 2))
    showNotif('Response beautified', 'success')
  } catch {
    try { content.innerHTML = syntaxHighlightXml(raw.replace(/></g, '>\n<')); showNotif('Response beautified', 'success') }
    catch { showNotif('Cannot beautify this response', 'error') }
  }
}

function _updateBodySize() {
  const el = document.getElementById('bodySizeIndicator')
  if (!el) return
  let size = 0
  if (state.currentBodyType === 'json' || state.currentBodyType === 'raw' || state.currentBodyType === 'graphql') {
    syncBodyEditorToTextarea()
    size = new Blob([getBodyEditorText() || '']).size
  }
  el.textContent = size > 0 ? formatBytes(size) : ''
}

export function updateBodySize(): void {
  _updateBodySize()
}

function _highlightVarTokens(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, '<span class="var-token">{{$1}}</span>')
}

export function updateUrlHighlight() {
  const input = document.getElementById('urlInput') as HTMLInputElement | null
  const overlay = document.getElementById('urlHighlightOverlay')
  if (!input || !overlay) return
  const val = input.value
  if (!val || !/\{\{/.test(val)) {
    ;(overlay as HTMLElement).style.display = 'none'; input.classList.remove('url-has-vars'); return
  }
  ;(overlay as HTMLElement).style.display = 'block'
  input.classList.add('url-has-vars')
  overlay.innerHTML = _highlightVarTokens(escHtml(val))
  ;(overlay as HTMLElement).scrollLeft = input.scrollLeft
}

/** Legacy hook — body JSON colours are handled by CodeMirror. */
export function updateBodyHighlight(): void {}

export function syncBodyScroll(): void {}

// ── Auth ──────────────────────────────────────────────────────────

export function updateAuthFields(authData: any) {
  const type = (document.getElementById('authType') as HTMLSelectElement)?.value || 'none'
  const container = document.getElementById('authFields')!
  const sourceTab = state.activeTabId ? state.tabs.find(t => t.id === state.activeTabId) : null
  const inheritedAuth = sourceTab?.sourceId ? getInheritedAuth(sourceTab.sourceId) : null
  const inheritedInfo = inheritedAuth
    ? `Inheriting <strong>${inheritedAuth.auth.type}</strong> auth from <em>${escHtml(inheritedAuth.from)}</em>`
    : undefined
  renderAuthFields(container, type, authData, 'auth', { inheritedInfo })
  renderAutoHeaders(); updateHeaderBadge()
}

export function getAuthState(): any {
  return readAuthFields('auth')
}

export async function fetchOAuth2Token() {
  const s = getAuthState()
  if (!s.tokenUrl) { showNotif('Token URL required', 'error'); return }
  try {
    const body = new URLSearchParams()
    body.append('grant_type', s.grant)
    body.append('client_id', s.clientId)
    body.append('client_secret', s.clientSecret)
    if (s.scope) body.append('scope', s.scope)
    const resp = await window.restifyFetch(resolveVariables(s.tokenUrl), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
    const data = await resp.json()
    const result = document.getElementById('oauth2TokenResult') as any
    if (data.access_token) {
      result.dataset.token = data.access_token
      result.innerHTML = `<div style="color:var(--green)">Token acquired (${data.token_type || 'bearer'})</div>
        <input class="auth-input" value="${escHtml(data.access_token)}" readonly style="margin-top:4px">`
      showNotif('OAuth2 token acquired', 'success')
    } else {
      result.innerHTML = `<div style="color:var(--red)">Error: ${escHtml(JSON.stringify(data))}</div>`
    }
  } catch (err: any) { showNotif('OAuth2 error: ' + err.message, 'error') }
}

// ── Theme ─────────────────────────────────────────────────────────

export function toggleTheme() {
  const html = document.documentElement
  const next = (html.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light'
  html.setAttribute('data-theme', next)
  localStorage.setItem('restify_theme', next)
  const btn = document.getElementById('themeToggleBtn')
  if (btn) btn.textContent = next === 'dark' ? '☾' : '☀'
}

export function loadTheme() {
  const saved = localStorage.getItem('restify_theme') || localStorage.getItem('restfy_theme') || 'light'
  document.documentElement.setAttribute('data-theme', saved)
  const btn = document.getElementById('themeToggleBtn')
  if (btn) btn.textContent = saved === 'dark' ? '☾' : '☀'
}

// ── Panel Switching ───────────────────────────────────────────────

export function switchReqTab(name: string) {
  activateTabStrip(name, {
    tabSelector: '.panel-tabs .panel-tab',
    tabAttr: 'data-tab',
    panelSelector: '.request-panels .panel-content',
    panelMatch: 'suffix'
  })
  // The panel IDs are like "panel-params", so re-do with direct id match
  document.querySelectorAll<HTMLElement>('.request-panels .panel-content').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + name)
  )
}

export function switchRespTab(name: string) {
  setActiveTabBtn('.response-tabs .response-tab', name)
  ;['resp-body', 'resp-headers', 'resp-cookies', 'resp-tests'].forEach(id => {
    const el = document.getElementById(id) as HTMLElement | null
    if (el) el.style.display = id === 'resp-' + name ? 'flex' : 'none'
  })
}

// ── Workspace ─────────────────────────────────────────────────────

export function showWorkspace() {
  setMainView('workspace')
  _activeDocsColId = null
}

export function showEmpty() {
  setMainView('empty')
  _activeDocsColId = null
}

export function updateMethodColor() {
  const sel = document.getElementById('methodSelect') as HTMLSelectElement
  const method = sel.value
  sel.className = 'method-select m-' + method
  const urlInput = document.getElementById('urlInput') as HTMLInputElement
  if (urlInput) urlInput.className = 'url-input method-border-' + method
  const t = state.tabs.find(t => t.id === state.activeTabId)
  if (t) { t.method = method; renderTabs() }
}

export function copyResponse() {
  if ((window as any)._lastResponse) navigator.clipboard.writeText((window as any)._lastResponse).then(() => showNotif('Copied!', 'success'))
}

export function switchResponseMode(mode: string) {
  setActiveTabBtn('.resp-mode-btn', mode, 'data-mode')
  const content = document.getElementById('responseBodyContent') as HTMLElement
  const raw = document.getElementById('responseBodyRaw') as HTMLElement
  const preview = document.getElementById('responseBodyPreview') as HTMLElement
  if (content) content.style.display = mode === 'pretty' ? 'block' : 'none'
  if (raw) raw.style.display = mode === 'raw' ? 'block' : 'none'
  if (preview) preview.style.display = mode === 'preview' ? 'block' : 'none'
}

export function showResponsePlaceholder() {
  const el = (id: string) => document.getElementById(id) as HTMLElement | null
  const sb = el('statusBadge'); if (sb) sb.innerHTML = ''
  const rm = el('respMeta'); if (rm) (rm as any).textContent = ''
  ;['copyRespBtn', 'curlBtn', 'codeGenBtn', 'beautifyRespBtn'].forEach(id => { const e = el(id); if (e) e.style.display = 'none' })
  const ph = el('responsePlaceholder'); if (ph) ph.style.display = 'block'
  ;['responseBodyContent', 'responseBodyRaw', 'responseBodyPreview'].forEach(id => { const e = el(id); if (e) e.style.display = 'none' })
}

export function restoreResponse(cached: any) {
  if (!cached) return showResponsePlaceholder()
  const el = (id: string) => document.getElementById(id) as HTMLElement | null
  const sb = el('statusBadge'); if (sb) sb.innerHTML = cached.statusHtml || ''
  const rm = el('respMeta'); if (rm) rm.textContent = cached.meta || ''
  ;['copyRespBtn', 'curlBtn', 'codeGenBtn', 'beautifyRespBtn'].forEach(id => { const e = el(id); if (e) e.style.display = 'inline-flex' })
  const ph = el('responsePlaceholder'); if (ph) ph.style.display = 'none'
  const bc = el('responseBodyContent'); if (bc) { bc.style.display = 'block'; bc.innerHTML = cached.bodyHtml || '' }
  const br = el('responseBodyRaw'); if (br) { br.textContent = cached.bodyRaw || '' }
  const preview = el('responseBodyPreview') as HTMLIFrameElement | null
  if (preview && cached.bodyRaw && /<html/i.test(cached.bodyRaw)) (preview as any).srcdoc = cached.bodyRaw
  const rhb = el('respHeadersBody'); if (rhb && cached.headersHtml) rhb.innerHTML = cached.headersHtml
  const rcb = el('respCookiesBody'); if (rcb && cached.cookiesHtml) rcb.innerHTML = cached.cookiesHtml
  ;(window as any)._lastResponse = cached.bodyRaw
  switchResponseMode('pretty')
}

// ── Save Modal ────────────────────────────────────────────────────

export function openSaveModal() {
  const sel = document.getElementById('saveCollection') as HTMLSelectElement
  sel.innerHTML = '<option value="__new__">+ New Collection</option>'
  state.collections.forEach(c => { sel.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>` })
  sel.onchange = () => {
    const nCG = document.getElementById('newCollectionGroup') as HTMLElement | null
    if (nCG) nCG.style.display = sel.value === '__new__' ? 'block' : 'none'
    _renderSaveTargetFolders(sel.value)
  }
  sel.value = '__new__'
  const t = state.tabs.find(t => t.id === state.activeTabId)
  const rn = document.getElementById('saveReqName') as HTMLInputElement | null; if (rn) rn.value = t ? t.name : ''
  const ncn = document.getElementById('newCollectionName') as HTMLInputElement | null; if (ncn) ncn.value = ''
  const ncg = document.getElementById('newCollectionGroup') as HTMLElement | null; if (ncg) ncg.style.display = 'block'
  const stf = document.getElementById('saveTargetFolder') as HTMLElement | null; if (stf) stf.innerHTML = ''
  document.getElementById('saveModal')?.classList.add('open')
}

function _renderSaveTargetFolders(collectionId: string) {
  const sel = document.getElementById('saveTargetFolder') as HTMLSelectElement
  sel.innerHTML = '<option value="">Collection Root</option>'
  if (collectionId === '__new__') return
  const col = state.collections.find(c => c.id === collectionId)
  if (!col) return
  function addOptions(children: any[], depth: number) {
    children.forEach(child => {
      if (child.type === 'folder') {
        sel.innerHTML += `<option value="${child.id}">${'  '.repeat(depth)}${escHtml(child.name)}</option>`
        if (child.children) addOptions(child.children, depth + 1)
      }
    })
  }
  if (col.children) addOptions(col.children, 1)
}

export function closeSaveModal() { document.getElementById('saveModal')?.classList.remove('open') }

export function saveRequest() {
  saveCurrentTabState()
  const name = (document.getElementById('saveReqName') as HTMLInputElement).value.trim() || 'Request'
  let colId = (document.getElementById('saveCollection') as HTMLSelectElement).value
  const targetFolderId = (document.getElementById('saveTargetFolder') as HTMLSelectElement)?.value || ''
  if (colId === '__new__') {
    const colName = (document.getElementById('newCollectionName') as HTMLInputElement).value.trim() || 'My Collection'
    const col = makeCollection({ name: colName })
    state.collections.push(col); colId = col.id; state.openFolders.add(col.id)
  }
  const t = state.tabs.find(t => t.id === state.activeTabId)
  const d = state.activeTabId ? state.tabData[state.activeTabId] : null
  if (!t || !d) return
  const req = makeRequest({ name, method: t.method, url: t.url, params: deepClone(d.params), headers: deepClone(d.headers), bodyForm: deepClone(d.bodyForm), bodyType: d.bodyType, body: d.body, graphqlVars: d.graphqlVars, auth: deepClone(d.auth), preRequestScript: d.preRequestScript, testScript: d.testScript })
  const target = (targetFolderId ? findNodeInAll(targetFolderId) : findNodeInAll(colId)) as any
  if (target?.children) { target.children.push(req); t.sourceId = req.id }
  if (d) (d as any).dirty = false
  saveState(); renderSidebar(); closeSaveModal(); renderTabs(); showNotif('Saved to collection', 'success')
}

// ── Environment Manager ───────────────────────────────────────────

export function openEnvManager() {
  document.getElementById('envModal')?.classList.add('open')
  setEnvModalTab('envs'); renderEnvSelector(); renderEnvManager()
}

export function setEnvModalTab(which: string) {
  setActiveTabBtn('#envModal .env-tab-btn', which, 'data-env-tab')
  const envs = document.getElementById('envTabEnvs') as HTMLElement | null
  const globs = document.getElementById('envTabGlobals') as HTMLElement | null
  if (envs) envs.style.display = which === 'envs' ? 'block' : 'none'
  if (globs) globs.style.display = which === 'globals' ? 'block' : 'none'
}

export function clearActiveEnv() { state.activeEnvId = null; saveState(); renderEnvManager(); renderEnvSelector() }
export function closeEnvManager() { document.getElementById('envModal')?.classList.remove('open') }

export function renderEnvManager() {
  const summary = document.getElementById('envActiveSummary')
  if (summary) {
    const active = state.environments.find(e => e.id === state.activeEnvId)
    summary.innerHTML = active
      ? `<strong>Active environment:</strong> ${escHtml(active.name)} <button type="button" class="btn-text" style="margin-left:8px" onclick="clearActiveEnv()">No environment</button>`
      : 'No environment selected — globals still apply.'
  }
  const hint = document.getElementById('envEmptyHint') as HTMLElement | null
  if (hint) {
    if (state.environments.length === 0) { hint.style.display = 'block'; hint.innerHTML = 'Create an environment to group variables.' }
    else hint.style.display = 'none'
  }
  const namedList = document.getElementById('envNamedList')
  if (namedList) {
    namedList.innerHTML = ''
    state.environments.forEach(env => {
      const sec = document.createElement('div')
      sec.className = 'env-section' + (env.id === state.activeEnvId ? ' active-env' : '')
      sec.innerHTML = `
        <div class="env-section-header">
          <span class="env-section-title">${escHtml(env.name)}</span>
          <div class="env-actions">
            <button type="button" class="btn-text ${env.id === state.activeEnvId ? 'active' : ''}" onclick="setActiveEnv('${env.id}')">${env.id === state.activeEnvId ? 'Active' : 'Set active'}</button>
            <button type="button" class="btn-text" onclick="renameEnv('${env.id}')">Rename</button>
            <button type="button" class="btn-text ctx-danger" onclick="deleteEnv('${env.id}')">Delete</button>
          </div>
        </div>
        <div class="kv-editor" id="envVars_${env.id}"></div>
        <button type="button" class="add-row-btn" onclick="addEnvVar('${env.id}')">+ Add variable</button>
      `
      namedList.appendChild(sec)
      _renderEnvVarsEditor(env)
    })
  }
  _renderGlobalVarsEditor()
}

function _renderGlobalVarsEditor() {
  const container = document.getElementById('globalVarsEditor')
  if (!container) return
  container.innerHTML = ''
  if (state.globalVars.length === 0) state.globalVars = [{ key: '', value: '', enabled: true }]
  state.globalVars.forEach((v, i) => {
    const row = document.createElement('div')
    row.className = 'kv-row' + (i % 2 === 1 ? ' kv-alt' : '')
    row.innerHTML = `
      <input type="checkbox" class="kv-enabled" ${v.enabled !== false ? 'checked' : ''} onchange="state.globalVars[${i}].enabled=this.checked">
      <input type="text" class="kv-input" placeholder="Variable" value="${escHtml(v.key)}" oninput="state.globalVars[${i}].key=this.value">
      <input type="text" class="kv-input" placeholder="Value" value="${escHtml(v.value)}" oninput="state.globalVars[${i}].value=this.value">
      <button class="kv-delete" onclick="state.globalVars.splice(${i},1); renderEnvManager()">&times;</button>
    `
    container.appendChild(row)
  })
}

export function addGlobalVar() { state.globalVars.push({ key: '', value: '', enabled: true }); renderEnvManager() }

function _renderEnvVarsEditor(env: any) {
  const container = document.getElementById('envVars_' + env.id)
  if (!container) return
  container.innerHTML = ''
  if (!env.variables || env.variables.length === 0) env.variables = [{ key: '', value: '', enabled: true }]
  env.variables.forEach((v: any, i: number) => {
    const row = document.createElement('div')
    row.className = 'kv-row' + (i % 2 === 1 ? ' kv-alt' : '')
    row.innerHTML = `
      <input type="checkbox" class="kv-enabled" ${v.enabled !== false ? 'checked' : ''} onchange="updateEnvVar('${env.id}',${i},'enabled',this.checked)">
      <input type="text" class="kv-input" placeholder="Variable" value="${escHtml(v.key)}" oninput="updateEnvVar('${env.id}',${i},'key',this.value)">
      <input type="text" class="kv-input" placeholder="Value" value="${escHtml(v.value)}" oninput="updateEnvVar('${env.id}',${i},'value',this.value)">
      <button class="kv-delete" onclick="deleteEnvVar('${env.id}',${i})">&times;</button>
    `
    container.appendChild(row)
  })
}

export function updateEnvVar(envId: string, idx: number, field: string, val: any) {
  const env = state.environments.find(e => e.id === envId)
  if (env?.variables[idx]) (env.variables[idx] as any)[field] = val
}

export function addEnvVar(envId: string) {
  const env = state.environments.find(e => e.id === envId)
  if (env) { env.variables.push({ key: '', value: '', enabled: true }); renderEnvManager() }
}

export function deleteEnvVar(envId: string, idx: number) {
  const env = state.environments.find(e => e.id === envId)
  if (env) {
    env.variables.splice(idx, 1)
    if (env.variables.length === 0) env.variables.push({ key: '', value: '', enabled: true })
    renderEnvManager()
  }
}

export function addEnvironmentFromInput() {
  const input = document.getElementById('envNewNameInput') as HTMLInputElement | null
  const name = (input?.value || '').trim()
  if (!name) { showNotif('Enter a name for the environment', 'info'); return }
  state.environments.push({ id: genId(), name, variables: [{ key: '', value: '', enabled: true }] })
  if (input) input.value = ''
  saveState(); renderEnvManager(); renderEnvSelector()
}

export async function renameEnv(envId: string) {
  const env = state.environments.find(e => e.id === envId)
  if (!env) return
  const name = await appPrompt('Rename environment', undefined, { placeholder: 'Environment name', defaultValue: env.name })
  if (name) { env.name = name; saveState(); renderEnvManager(); renderEnvSelector() }
}

export async function deleteEnv(envId: string) {
  const env = state.environments.find(e => e.id === envId)
  const ok = await appConfirm('Delete environment', `Delete "${env ? env.name : 'this environment'}"? This cannot be undone.`, { danger: true, okLabel: 'Delete' })
  if (!ok) return
  state.environments = state.environments.filter(e => e.id !== envId)
  if (state.activeEnvId === envId) state.activeEnvId = null
  saveState(); renderEnvManager(); renderEnvSelector()
}

export function setActiveEnv(envId: string) {
  state.activeEnvId = state.activeEnvId === envId ? null : envId
  saveState(); renderEnvManager(); renderEnvSelector()
}

export function saveEnvChanges() { saveState(); renderEnvSelector(); closeEnvManager(); showNotif('Environments saved', 'success') }

export function renderEnvSelector() {
  const sel = document.getElementById('envSelector') as HTMLSelectElement | null
  if (!sel) return
  while (sel.firstChild) sel.removeChild(sel.firstChild)
  const none = document.createElement('option')
  none.value = ''; none.textContent = 'No Environment'
  sel.appendChild(none)
  state.environments.forEach(e => {
    const opt = document.createElement('option')
    opt.value = e.id; opt.textContent = e.name
    sel.appendChild(opt)
  })
  sel.value = state.activeEnvId && state.environments.some(x => x.id === state.activeEnvId) ? state.activeEnvId : ''
  hideUrlVarPopover()
}

export function exportEnvironments() {
  const data = { _type: 'restify_environments', version: 1, environments: deepClone(state.environments), globalVars: deepClone(state.globalVars) }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'restify-environments.json'; a.click()
  URL.revokeObjectURL(a.href); showNotif('Environments exported', 'success')
}

export function importEnvironments(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = function() {
    try {
      const data = JSON.parse(reader.result as string)
      if ((data._type !== 'restify_environments' && data._type !== 'restfy_environments') || !Array.isArray(data.environments)) {
        showNotif('Invalid environment file', 'error'); return
      }
      let added = 0
      data.environments.forEach((env: any) => {
        if (!env.name || !env.variables) return
        if (!state.environments.find(e => e.name === env.name)) { env.id = genId(); state.environments.push(env); added++ }
      })
      if (data.globalVars && Array.isArray(data.globalVars)) {
        data.globalVars.forEach((g: any) => {
          if (g.key && !state.globalVars.find(v => v.key === g.key)) state.globalVars.push({ key: g.key, value: g.value, enabled: g.enabled !== false })
        })
      }
      saveState(); renderEnvManager(); renderEnvSelector(); showNotif(`Imported ${added} environment(s)`, 'success')
    } catch { showNotif('Failed to parse environment file', 'error') }
  }
  reader.readAsText(file)
  ;(event.target as HTMLInputElement).value = ''
}

// ── URL Variable Hover Popover ────────────────────────────────────

let _urlVarMeasureCanvas: HTMLCanvasElement | null = null
let _urlVarPopoverHideTimer: ReturnType<typeof setTimeout> | null = null
let _urlVarHitSig: string | null = null
let _urlVarHoverWired = false

function _getUrlMeasureCtx() {
  const input = document.getElementById('urlInput') as HTMLInputElement | null
  if (!input) return null
  if (!_urlVarMeasureCanvas) _urlVarMeasureCanvas = document.createElement('canvas')
  const ctx = _urlVarMeasureCanvas.getContext('2d')!
  const cs = getComputedStyle(input)
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  return { ctx, input }
}

function _measureTextWidth(upToIndex: number, fullText: string): number {
  const o = _getUrlMeasureCtx()
  if (!o) return 0
  return o.ctx.measureText(fullText.slice(0, upToIndex)).width
}

function _getVarRegions(value: string): any[] {
  const regions: any[] = []
  const re = /\{\{(\w+)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) regions.push({ start: m.index, end: m.index + m[0].length, key: m[1], raw: m[0] })
  return regions
}

function _hitTestUrlVar(clientX: number): any {
  const input = document.getElementById('urlInput') as HTMLInputElement | null
  const ws = document.getElementById('requestWorkspace') as HTMLElement | null
  if (!input || !ws || ws.style.display === 'none') return null
  const rect = input.getBoundingClientRect()
  const cs = getComputedStyle(input)
  const x = clientX - rect.left - (parseFloat(cs.paddingLeft) || 0) + input.scrollLeft
  if (x < 0) return null
  const regions = _getVarRegions(input.value)
  for (const r of regions) {
    if (x >= _measureTextWidth(r.start, input.value) - 2 && x <= _measureTextWidth(r.end, input.value) + 2) return r
  }
  return null
}

export function hideUrlVarPopover() {
  const pop = document.getElementById('urlVarPopover')
  if (pop) pop.hidden = true
  const input = document.getElementById('urlInput') as HTMLInputElement | null
  if (input) input.classList.remove('url-input--var-hover')
  _urlVarHitSig = null
}

function _positionUrlVarPopover(clientX: number, clientY: number) {
  const pop = document.getElementById('urlVarPopover') as HTMLElement | null
  if (!pop || pop.hidden) return
  const margin = 10, pw = pop.offsetWidth, ph = pop.offsetHeight
  let left = clientX - pw / 2, top = clientY + margin
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin))
  if (top + ph > window.innerHeight - margin) top = clientY - ph - margin
  pop.style.left = left + 'px'; pop.style.top = Math.max(margin, top) + 'px'
}

function _updateUrlVarPopover(hit: any, clientX: number, clientY: number) {
  const pop = document.getElementById('urlVarPopover') as HTMLElement | null
  if (!pop || !hit) return
  const { key, raw } = hit
  const { value, source } = lookupVariableKey(key)
  const tokenEl = document.getElementById('urlVarPopoverToken')
  if (tokenEl) tokenEl.textContent = raw
  const linkEl = document.getElementById('urlVarPopoverValueLink') as HTMLAnchorElement | null
  const textEl = document.getElementById('urlVarPopoverValueText') as HTMLElement | null
  if (linkEl) linkEl.style.display = 'none'
  if (textEl) { textEl.style.display = 'none'; textEl.className = 'url-var-popover-value-text'; textEl.textContent = '' }
  const isHttp = (s: any) => /^https?:\/\/.+/i.test(String(s || '').trim())
  if (source === 'unresolved') { if (textEl) { textEl.style.display = 'block'; textEl.textContent = 'No value — variable is not defined'; textEl.classList.add('url-var-popover-value-muted') } }
  else if (value == null || String(value).trim() === '') { if (textEl) { textEl.style.display = 'block'; textEl.textContent = '(empty value)'; textEl.classList.add('url-var-popover-value-muted') } }
  else if (isHttp(value)) { if (linkEl) { linkEl.style.display = 'inline-block'; linkEl.href = String(value).trim(); linkEl.textContent = String(value).trim() } }
  else if (textEl) { textEl.style.display = 'block'; textEl.textContent = String(value) }
  const badge = document.getElementById('urlVarPopoverBadge')
  if (badge) {
    if (source === 'environment') badge.innerHTML = '<span class="url-var-popover-badge-icon env">E</span><span>Environment</span>'
    else if (source === 'global') badge.innerHTML = '<span class="url-var-popover-badge-icon glob">G</span><span>Global</span>'
    else badge.innerHTML = '<span class="url-var-popover-badge-icon miss">?</span><span>Unresolved</span>'
  }
  const input = document.getElementById('urlInput') as HTMLInputElement | null
  const fullResolved = input ? resolveVariables(input.value.trim()) : ''
  const resRow = document.getElementById('urlVarPopoverResolvedRow') as HTMLElement | null
  const resLink = document.getElementById('urlVarPopoverResolvedLink') as HTMLAnchorElement | null
  if (resRow && resLink) {
    if (fullResolved && isHttp(fullResolved)) { resRow.style.display = 'block'; resLink.href = fullResolved.trim(); resLink.textContent = fullResolved.trim() }
    else resRow.style.display = 'none'
  }
  const manageBtn = document.getElementById('urlVarPopoverManageBtn')
  if (manageBtn) manageBtn.onclick = () => { hideUrlVarPopover(); openEnvManager() }
  pop.hidden = false
  requestAnimationFrame(() => _positionUrlVarPopover(clientX, clientY))
}

export function setupUrlVariableHover() {
  const input = document.getElementById('urlInput') as HTMLInputElement | null
  const pop = document.getElementById('urlVarPopover') as HTMLElement | null
  if (!input || !pop || _urlVarHoverWired) return
  _urlVarHoverWired = true
  input.addEventListener('mousemove', (e) => {
    const hit = _hitTestUrlVar(e.clientX)
    if (!hit) {
      input.classList.remove('url-input--var-hover'); _urlVarHitSig = null
      if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer)
      _urlVarPopoverHideTimer = setTimeout(() => { if (!pop.matches(':hover')) hideUrlVarPopover() }, 100)
      return
    }
    if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer)
    input.classList.add('url-input--var-hover')
    const sig = hit.start + ':' + hit.end
    if (sig !== _urlVarHitSig) { _urlVarHitSig = sig; _updateUrlVarPopover(hit, e.clientX, e.clientY) }
    else _positionUrlVarPopover(e.clientX, e.clientY)
  })
  input.addEventListener('mouseleave', (e) => {
    if (e.relatedTarget && pop.contains(e.relatedTarget as Node)) return
    if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer)
    _urlVarPopoverHideTimer = setTimeout(() => { if (!pop.matches(':hover')) hideUrlVarPopover() }, 120)
  })
  pop.addEventListener('mouseenter', () => { if (_urlVarPopoverHideTimer) clearTimeout(_urlVarPopoverHideTimer) })
  pop.addEventListener('mouseleave', (e) => { if (e.relatedTarget && input.contains(e.relatedTarget as Node)) return; hideUrlVarPopover() })
  input.addEventListener('scroll', () => { hideUrlVarPopover(); _syncUrlHighlightScroll() })
}

function _syncUrlHighlightScroll() {
  const input = document.getElementById('urlInput') as HTMLInputElement | null
  const overlay = document.getElementById('urlHighlightOverlay') as HTMLElement | null
  if (input && overlay) overlay.scrollLeft = input.scrollLeft
}

export function setupInputVarTooltips() {
  const handler = (e: Event) => {
    const el = e.target as HTMLInputElement
    if (!el.matches('.kv-input, .auth-input, .form-input')) return
    const val = el.value || ''
    el.title = /\{\{\w+\}\}/.test(val) ? resolveVariables(val) : ''
  }
  document.addEventListener('input', handler, true)
  document.addEventListener('focusin', handler, true)
}

// ── Sidebar version display ───────────────────────────────────────

export async function renderSidebarAppVersion() {
  const row = document.getElementById('sidebarVersionRow')
  if (!row) return
  let v = typeof (window as any).RESTIFY_APP_VERSION === 'string' ? (window as any).RESTIFY_APP_VERSION : '1.0.1'
  if (window.electronAPI?.getAppVersion) {
    try { v = await window.electronAPI.getAppVersion() } catch {}
  }
  row.innerHTML = `<span style="font-size:11px;color:var(--text-dim)">Restify v${v}</span>`
}