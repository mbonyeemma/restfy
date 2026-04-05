import { genId } from './utils'
import type {
  CollectionNode, FolderNode, RequestNode, TreeNode,
  Environment, Tab, TabData, HistoryEntry, KvRow, Auth, SaveStateOptions
} from '../types'

// ── Mutable state singleton ──────────────────────────────────────

export const state = {
  collections: [] as CollectionNode[],
  environments: [] as Environment[],
  activeEnvId: null as string | null,
  globalVars: [] as KvRow[],
  history: [] as HistoryEntry[],
  tabs: [] as Tab[],
  activeTabId: null as string | null,
  tabData: {} as Record<string, TabData>,
  openFolders: new Set<string>(),
  sidebarMode: 'collections' as string,
  currentBodyType: 'none' as string,
  pendingImport: null as CollectionNode | null,
  editingNodeId: null as string | null
}

// ── LocalStorage keys ────────────────────────────────────────────

const LS_DATA = 'restify_data'
const LS_DATA_LEGACY = 'restfy_data'

function lsGetDataRaw(): string | null {
  return localStorage.getItem(LS_DATA) ?? localStorage.getItem(LS_DATA_LEGACY)
}

function lsSetDataRaw(json: string): void {
  localStorage.setItem(LS_DATA, json)
}

// ── Factory helpers ───────────────────────────────────────────────

export function makeDefaultKv(): KvRow[] {
  return [{ key: '', value: '', enabled: true }]
}

export function makeRequest(overrides?: Partial<RequestNode>): RequestNode {
  return Object.assign({
    id: genId(),
    type: 'request' as const,
    name: 'New Request',
    method: 'GET',
    url: '',
    params: makeDefaultKv(),
    headers: makeDefaultKv(),
    bodyType: 'json' as const,
    body: '{}',
    bodyForm: makeDefaultKv(),
    auth: { type: 'none' } as Auth,
    preRequestScript: '',
    testScript: ''
  }, overrides || {})
}

export function makeFolder(overrides?: Partial<FolderNode>): FolderNode {
  return Object.assign({
    id: genId(),
    type: 'folder' as const,
    name: 'New Folder',
    headers: [],
    auth: { type: 'none' } as Auth,
    children: []
  }, overrides || {})
}

export function makeCollection(overrides?: Partial<CollectionNode>): CollectionNode {
  return Object.assign({
    id: genId(),
    type: 'collection' as const,
    name: 'New Collection',
    description: '',
    headers: [],
    auth: { type: 'none' } as Auth,
    variables: [],
    preRequestScript: '',
    testScript: '',
    children: []
  }, overrides || {})
}

// ── Tree traversal ────────────────────────────────────────────────

export function findNodeById(id: string, nodes: TreeNode[]): TreeNode | null {
  if (!nodes) return null
  for (const node of nodes) {
    if (node.id === id) return node
    if ((node as any).children) {
      const found = findNodeById(id, (node as any).children)
      if (found) return found
    }
  }
  return null
}

export function findNodeInAll(id: string): TreeNode | null {
  return findNodeById(id, state.collections as TreeNode[])
}

export function findParentOf(id: string, nodes: TreeNode[], parent: TreeNode | null): TreeNode | null {
  if (!nodes) return null
  for (const node of nodes) {
    if (node.id === id) return parent
    if ((node as any).children) {
      const found = findParentOf(id, (node as any).children, node)
      if (found) return found
    }
  }
  return null
}

export function findParentInAll(id: string): TreeNode | null {
  for (const col of state.collections) {
    if (col.id === id) return null
    const found = findParentOf(id, col.children, col)
    if (found) return found
  }
  return null
}

export function findCollectionOf(id: string): CollectionNode | null {
  for (const col of state.collections) {
    if (col.id === id) return col
    if (findNodeById(id, col.children)) return col
  }
  return null
}

export function getAncestorChain(id: string): TreeNode[] {
  const chain: TreeNode[] = []
  let parent = findParentInAll(id)
  while (parent) {
    chain.unshift(parent)
    parent = findParentInAll(parent.id)
  }
  return chain
}

export function getInheritedHeaders(nodeId: string): Record<string, { value: string; from: string }> {
  const chain = getAncestorChain(nodeId)
  const merged: Record<string, { value: string; from: string }> = {}
  chain.forEach(ancestor => {
    if ((ancestor as any).headers) {
      (ancestor as any).headers.forEach((h: KvRow) => {
        if (h.enabled !== false && h.key) merged[h.key] = { value: h.value, from: ancestor.name || '' }
      })
    }
  })
  return merged
}

export function getInheritedAuth(nodeId: string): { auth: Auth; from: string } | null {
  const chain = getAncestorChain(nodeId)
  for (let i = chain.length - 1; i >= 0; i--) {
    const a = (chain[i] as any).auth
    if (a && a.type !== 'none') return { auth: a, from: chain[i].name || '' }
  }
  return null
}

export function countRequests(node: TreeNode): number {
  if (node.type === 'request') return 1
  if (!(node as any).children) return 0
  return ((node as any).children as TreeNode[]).reduce((sum, c) => sum + countRequests(c), 0)
}

export function deleteNode(id: string): boolean {
  for (let i = 0; i < state.collections.length; i++) {
    if (state.collections[i].id === id) {
      state.collections.splice(i, 1)
      return true
    }
  }
  const parent = findParentInAll(id)
  if (parent && (parent as any).children) {
    const idx = (parent as any).children.findIndex((c: TreeNode) => c.id === id)
    if (idx !== -1) { (parent as any).children.splice(idx, 1); return true }
  }
  return false
}

export function duplicateNode(id: string): TreeNode | null {
  const node = findNodeInAll(id)
  if (!node) return null
  const parent = findParentInAll(id)
  const clone = deepClone(node)
  assignNewIds(clone)
  clone.name = node.name + ' (copy)'
  if (parent && (parent as any).children) {
    const idx = (parent as any).children.findIndex((c: TreeNode) => c.id === id)
    ;(parent as any).children.splice(idx + 1, 0, clone)
  } else if (node.type === 'collection') {
    const idx = state.collections.findIndex(c => c.id === id)
    state.collections.splice(idx + 1, 0, clone as CollectionNode)
  }
  return clone
}

export function assignNewIds(node: any): void {
  node.id = genId()
  if (node.children) node.children.forEach((c: any) => assignNewIds(c))
}

export function moveNode(nodeId: string, targetParentId: string): void {
  const node = findNodeInAll(nodeId)
  if (!node) return
  const oldParent = findParentInAll(nodeId)
  const target = findNodeInAll(targetParentId) as any
  if (!target || !target.children) return
  if (oldParent && (oldParent as any).children) {
    const idx = (oldParent as any).children.findIndex((c: TreeNode) => c.id === nodeId)
    if (idx !== -1) (oldParent as any).children.splice(idx, 1)
  }
  target.children.push(node)
}

export function getSiblingArrayForNode(nodeId: string): TreeNode[] | null {
  const rootIdx = state.collections.findIndex(c => c.id === nodeId)
  if (rootIdx !== -1) return state.collections as TreeNode[]
  const parent = findParentInAll(nodeId)
  if (parent && (parent as any).children) return (parent as any).children
  return null
}

export function reorderAmongSiblings(dragId: string, targetId: string, placeAfter: boolean): boolean {
  if (dragId === targetId) return false
  const arr = getSiblingArrayForNode(dragId)
  if (!arr || arr !== getSiblingArrayForNode(targetId)) return false
  let from = arr.findIndex(n => n.id === dragId)
  let to = arr.findIndex(n => n.id === targetId)
  if (from < 0 || to < 0) return false
  const [item] = arr.splice(from, 1)
  if (from < to) to--
  if (placeAfter) to++
  arr.splice(to, 0, item)
  return true
}

// ── Persistence ───────────────────────────────────────────────────

let _diskPersistTimer: ReturnType<typeof setTimeout> | null = null

function buildStateObject() {
  const data: any = {
    version: 2,
    savedAt: Date.now(),
    collections: state.collections,
    environments: state.environments,
    activeEnvId: state.activeEnvId,
    globalVars: state.globalVars,
    history: state.history,
    openTabs: state.tabs.map(t => ({
      id: t.id, name: t.name, method: t.method, url: t.url,
      sourceId: t.sourceId, pinned: t.pinned
    })),
    activeTabId: state.activeTabId,
    tabData: {} as Record<string, any>,
    openFolders: Array.from(state.openFolders)
  }
  for (const tid in state.tabData) {
    const d = state.tabData[tid]
    data.tabData[tid] = {
      params: d.params, headers: d.headers, bodyForm: d.bodyForm,
      bodyType: d.bodyType, body: d.body, graphqlVars: d.graphqlVars || '',
      auth: d.auth, preRequestScript: d.preRequestScript || '',
      testScript: d.testScript || '', pinned: d.pinned || false
    }
  }
  return data
}

function scheduleDiskPersist(jsonString: string): void {
  if (!window.electronAPI?.persistRestifyState) return
  if (_diskPersistTimer) clearTimeout(_diskPersistTimer)
  _diskPersistTimer = setTimeout(() => {
    _diskPersistTimer = null
    window.electronAPI!.persistRestifyState(jsonString).catch(() => {})
  }, 400)
}

export function saveState(opts?: SaveStateOptions): void {
  const forceDisk = opts?.forceDisk
  let json: string
  try {
    json = JSON.stringify(buildStateObject())
  } catch (e) {
    console.error('Save failed (serialize):', e)
    return
  }
  try {
    lsSetDataRaw(json)
  } catch (e) {
    console.error('Save failed (localStorage):', e)
    if (window.electronAPI?.persistRestifyState) {
      window.electronAPI.persistRestifyState(json).catch(() => {})
    }
    if (forceDisk && window.electronAPI?.flushRestifyState) {
      window.electronAPI.flushRestifyState(json)
    }
    return
  }
  if (window.electronAPI?.persistRestifyState) {
    if (forceDisk && window.electronAPI?.flushRestifyState) {
      window.electronAPI.flushRestifyState(json)
    } else {
      scheduleDiskPersist(json)
    }
  }
}

function applyStateFromData(d: any): void {
  if (!d) return
  if (d.version === 2) {
    state.collections = d.collections || []
    state.environments = d.environments || []
    state.activeEnvId = d.activeEnvId || null
    if (state.activeEnvId && !state.environments.some(e => e.id === state.activeEnvId)) {
      state.activeEnvId = null
    }
    state.globalVars = d.globalVars || []
    state.history = d.history || []
    state.openFolders = new Set(d.openFolders || [])
    if (d.openTabs && d.openTabs.length > 0) {
      state.tabs = d.openTabs
      state.tabData = d.tabData || {}
      state.activeTabId = d.activeTabId || state.tabs[0].id
    }
  } else {
    migrateV1(d)
  }
}

export async function loadState(): Promise<void> {
  let local: any = null
  try {
    const raw = lsGetDataRaw()
    if (raw) local = JSON.parse(raw)
  } catch (e) { console.error('Load failed (localStorage):', e) }

  let file: any = null
  if (window.electronAPI?.loadRestifyState) {
    try {
      const raw = await window.electronAPI.loadRestifyState()
      if (raw) file = JSON.parse(raw)
    } catch (e) { console.error('Load failed (disk cache):', e) }
  }

  let d: any = null
  if (local && file) {
    const nLocal = (local.collections && local.collections.length) || 0
    const nFile = (file.collections && file.collections.length) || 0
    const tLocal = local.savedAt || 0
    const tFile = file.savedAt || 0
    if (nLocal === 0 && nFile > 0) d = file
    else if (nFile === 0 && nLocal > 0) d = local
    else d = tFile > tLocal ? file : local
    const envMap = new Map<string, Environment>()
    ;(local.environments || []).forEach((e: Environment) => { if (e?.id) envMap.set(e.id, e) })
    ;(file.environments || []).forEach((e: Environment) => { if (e?.id) envMap.set(e.id, e) })
    const mergedEnvs = Array.from(envMap.values())
    if (mergedEnvs.length) d = { ...d, environments: mergedEnvs }
  } else {
    d = local || file
  }

  if (!d) return
  applyStateFromData(d)

  try {
    if (!local && file) {
      lsSetDataRaw(JSON.stringify(buildStateObject()))
    } else if (file && local && d === file && (file.savedAt || 0) > (local.savedAt || 0)) {
      lsSetDataRaw(JSON.stringify(buildStateObject()))
    }
  } catch (_) {}
}

function migrateV1(d: any): void {
  const old = d.collections || d
  if (typeof old === 'object' && !Array.isArray(old)) {
    state.collections = Object.entries(old).map(([name, requests]: [string, any]) => {
      const col = makeCollection({ name })
      col.children = (requests || []).map((r: any) => makeRequest({
        name: r.name, method: r.method, url: r.url,
        params: r.params || makeDefaultKv(),
        headers: r.headers || makeDefaultKv(),
        bodyType: r.bodyType || 'none',
        body: r.body || '',
        bodyForm: r.bodyForm || makeDefaultKv(),
        auth: r.auth || { type: 'none' }
      }))
      return col
    })
  }
}

// ── Environment helpers ───────────────────────────────────────────

export function resolveVariables(str: string): string {
  if (!str || typeof str !== 'string') return str
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const env = state.environments.find(e => e.id === state.activeEnvId)
    if (env) {
      const v = env.variables.find(v => v.enabled !== false && v.key === key)
      if (v) return v.value
    }
    const g = state.globalVars.find(v => v.enabled !== false && v.key === key)
    if (g) return g.value
    return match
  })
}

export function lookupVariableKey(key: string): { value: string | null; source: string } {
  const env = state.environments.find(e => e.id === state.activeEnvId)
  if (env) {
    const v = env.variables.find(v => v.enabled !== false && v.key === key)
    if (v) return { value: v.value, source: 'environment' }
  }
  const g = state.globalVars.find(v => v.enabled !== false && v.key === key)
  if (g) return { value: g.value, source: 'global' }
  return { value: null, source: 'unresolved' }
}

// ── History helpers ───────────────────────────────────────────────

export function addToHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
  state.history.unshift({
    id: genId(),
    method: entry.method,
    url: entry.url,
    status: entry.status,
    time: entry.time,
    size: entry.size,
    timestamp: Date.now()
  })
  if (state.history.length > 500) state.history = state.history.slice(0, 500)
  saveState()
}

// ── deepClone (used across modules) ─────────────────────────────

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}
