import { state, findNodeInAll, deepClone, assignNewIds, saveState } from './state'
import { isCloudLoggedIn } from './cloud'
import { showNotif } from './utils'

const PENDING_IMPORT_KEY = 'restify_pending_import'

function _publishApiRoot(): string {
  if (typeof window.getRestifyApiBase === 'function') {
    const b = window.getRestifyApiBase()
    if (b) return String(b).replace(/\/+$/, '')
  }
  return 'https://api.restify.online'
}

function shareQuickUrl(): string {
  if (typeof window.restifyApiUrl === 'function') {
    const u = window.restifyApiUrl('/api/share/quick')
    if (/^https?:\/\//i.test(u)) return u
  }
  return _publishApiRoot() + '/api/share/quick'
}

function apiSharedUrl(id: string): string {
  if (typeof window.restifyApiUrl === 'function') {
    const u = window.restifyApiUrl('/api/shared/' + encodeURIComponent(id))
    if (/^https?:\/\//i.test(u)) return u
  }
  return _publishApiRoot() + '/api/shared/' + encodeURIComponent(id)
}

export async function shareCollection(colId: string): Promise<void> {
  const col = findNodeInAll(colId)
  if (!col) return

  const shareData = deepClone(col)

  try {
    const resp = await fetch(shareQuickUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: shareData, name: col.name })
    })
    const text = await resp.text()
    const trimmed = text.trimStart()
    if (trimmed.startsWith('<')) {
      throw new Error(
        'API returned a web page instead of JSON. On desktop, ensure the Restify API is running or reachable (default https://api.restify.online).'
      )
    }
    let result: any
    try {
      result = JSON.parse(text)
    } catch {
      throw new Error('Invalid response from server')
    }
    if (!resp.ok) throw new Error(result.error || 'Server returned ' + resp.status)

    showShareResult(result, col.name)
    showNotif('Published online — copy the documentation link to share', 'success')
  } catch (err: any) {
    showNotif('Publish failed: ' + err.message, 'error')
  }
}

function showShareResult(result: any, name: string): void {
  const nameEl = document.getElementById('shareCollectionName')
  const docUrlEl = document.getElementById('shareDocUrl') as HTMLInputElement | null
  const docLinkEl = document.getElementById('shareDocLink') as HTMLAnchorElement | null
  const shareModal = document.getElementById('shareModal')

  if (nameEl) nameEl.textContent = name
  if (docUrlEl) docUrlEl.value = result.docUrl
  if (docLinkEl) {
    docLinkEl.href = result.docUrl
    docLinkEl.rel = 'noopener noreferrer'
    docLinkEl.onclick = (e) => {
      e.preventDefault()
      const u = (docUrlEl?.value || result.docUrl || '').trim()
      if (!u) return
      const api = (window as any).electronAPI as { openExternal?: (x: string) => Promise<boolean> } | undefined
      if (api?.openExternal) {
        void api.openExternal(u)
      } else {
        window.open(u, '_blank', 'noopener,noreferrer')
      }
      closeShareModal()
    }
  }
  shareModal?.classList.add('open')
}

export function closeShareModal(): void {
  document.getElementById('shareModal')?.classList.remove('open')
}

export function copyShareUrl(inputId: string): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null
  if (!input) return
  navigator.clipboard.writeText(input.value).then(() => showNotif('Link copied!', 'success'))
}

/** If not signed in, keep `?import=` for after login (workspace is gated). */
export function stashSharedImportParamIfNeeded(): void {
  if (isCloudLoggedIn()) return
  const params = new URLSearchParams(window.location.search)
  const id = params.get('import')
  if (!id) return
  try {
    sessionStorage.setItem(PENDING_IMPORT_KEY, id)
    const u = new URL(window.location.href)
    u.searchParams.delete('import')
    window.history.replaceState({}, '', u.pathname + u.search + u.hash)
  } catch (_) {}
}

export async function checkAutoImport(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  let importId = params.get('import')
  if (!importId) {
    try {
      importId = sessionStorage.getItem(PENDING_IMPORT_KEY)
    } catch {
      return
    }
    if (!importId) return
  }

  try {
    const resp = await fetch(apiSharedUrl(importId))
    if (!resp.ok) throw new Error('Collection not found')
    const data = await resp.json()

    if (data.collection) {
      const col = data.collection
      assignNewIds(col)
      state.collections.push(col)
      state.openFolders.add(col.id)
      saveState()
      if (typeof (window as any).renderSidebar === 'function') (window as any).renderSidebar()
      showNotif(`Imported "${col.name}"`, 'success')
      window.history.replaceState({}, '', '/')
    }
    try {
      sessionStorage.removeItem(PENDING_IMPORT_KEY)
    } catch (_) {}
  } catch (err: any) {
    showNotif('Import failed: ' + err.message, 'error')
  }
}
