// ── Domain types ──────────────────────────────────────────────

export interface KvRow {
  key: string
  value: string
  enabled?: boolean
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'inherit'

export interface Auth {
  type: AuthType
  token?: string
  username?: string
  password?: string
  key?: string
  value?: string
  in?: string
  clientId?: string
  clientSecret?: string
  accessTokenUrl?: string
  scope?: string
}

export type BodyType = 'none' | 'json' | 'raw' | 'form' | 'urlencoded' | 'graphql'

export interface RequestNode {
  id: string
  type: 'request'
  name: string
  method: string
  url: string
  params: KvRow[]
  headers: KvRow[]
  bodyType: BodyType
  body: string
  graphqlVars?: string
  bodyForm: KvRow[]
  auth: Auth
  preRequestScript: string
  testScript: string
  description?: string
}

export interface FolderNode {
  id: string
  type: 'folder'
  name: string
  headers: KvRow[]
  auth: Auth
  children: TreeNode[]
  preRequestScript?: string
  testScript?: string
  description?: string
  variables?: KvRow[]
}

export interface CollectionNode {
  id: string
  type: 'collection'
  name: string
  description: string
  headers: KvRow[]
  auth: Auth
  variables: KvRow[]
  preRequestScript: string
  testScript: string
  children: TreeNode[]
}

export type TreeNode = RequestNode | FolderNode | CollectionNode

export interface Environment {
  id: string
  name: string
  variables: KvRow[]
}

export interface Tab {
  id: string
  name: string
  method: string
  url: string
  sourceId: string | null
  pinned?: boolean
}

export interface TabData {
  params: KvRow[]
  headers: KvRow[]
  bodyForm: KvRow[]
  bodyType: BodyType
  body: string
  graphqlVars?: string
  auth: Auth
  preRequestScript: string
  testScript: string
  response?: any
  responses?: any[]
  activeResponseId?: string
  pinned?: boolean
  dirty?: boolean
}

export interface HistoryEntry {
  id: string
  method: string
  url: string
  status: number | string
  time: number
  size?: number
  timestamp: number
}

export interface SaveStateOptions {
  forceDisk?: boolean
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface RunnerResult {
  name: string
  method: string
  status: number | string
  time: number
  passed: boolean
  error?: string
  tests?: TestResult[]
}

// ── Electron API (exposed via preload) ─────────────────────────

export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  persistRestifyState: (json: string) => Promise<boolean>
  loadRestifyState: () => Promise<string | null>
  flushRestifyState: (json: string) => boolean
  getAppVersion: () => Promise<string>
  checkForUpdates: () => Promise<{ ok: boolean; dev?: boolean; error?: string }>
  quitAndInstall: () => void
  onUpdateStatus: (cb: (payload: { event: string; version?: string; message?: string }) => void) => void
  openExternal: (url: string) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    RESTIFY_APP_VERSION?: string
    __RESTIFY_API_BASE__?: string
    __RESTFY_API_BASE__?: string
    getRestifyApiBase: () => string
    restifyApiUrl: (path: string) => string
    restifyFetch: (url: string, opts?: RequestInit) => Promise<Response>
    // All public app functions exposed for HTML onclick handlers
    [key: string]: any
  }
}
