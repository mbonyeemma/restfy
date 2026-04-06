import { getBodyEditorText } from './body-editor-cm'
import {
  state, findNodeInAll, makeCollection, makeFolder, makeRequest,
  deepClone, assignNewIds, saveState, resolveVariables,
  getAncestorChain, getInheritedAuth, getInheritedHeaders
} from './state'
import { escHtml, showNotif } from './utils'
import { runPreRequestScript, runTestScript } from './scripts'

// ── Import ────────────────────────────────────────────────────────

export function openImport(): void {
  state.pendingImport = null
  const preview = document.getElementById('importPreview') as HTMLElement | null
  const doImportBtn = document.getElementById('doImportBtn') as HTMLElement | null
  const fileInput = document.getElementById('fileInput') as HTMLInputElement | null
  const ta = document.getElementById('importJsonTextarea') as HTMLTextAreaElement | null
  const curlTa = document.getElementById('importCurlTextarea') as HTMLTextAreaElement | null
  const urlInput = document.getElementById('importUrlInput') as HTMLInputElement | null
  const urlStatus = document.getElementById('importUrlStatus')

  if (preview) preview.style.display = 'none'
  if (doImportBtn) doImportBtn.style.display = 'none'
  if (fileInput) fileInput.value = ''
  if (ta) ta.value = ''
  if (curlTa) curlTa.value = ''
  if (urlInput) urlInput.value = ''
  if (urlStatus) urlStatus.textContent = ''
  switchImportTab('file')
  document.getElementById('importModal')?.classList.add('open')
}

export function closeImport(): void {
  document.getElementById('importModal')?.classList.remove('open')
}

export function switchImportTab(tab: string): void {
  document.querySelectorAll<HTMLElement>('.import-tab-btn').forEach(b => {
    const active = (b as any).dataset.tab === tab
    b.style.background = active ? 'var(--bg-light)' : 'transparent'
    b.style.color = active ? 'var(--text-primary)' : 'var(--text-dim)'
    b.classList.toggle('active', active)
  })
  const fileTab = document.getElementById('importTabFile') as HTMLElement | null
  const textTab = document.getElementById('importTabText') as HTMLElement | null
  const curlTab = document.getElementById('importTabCurl') as HTMLElement | null
  const linkTab = document.getElementById('importTabLink') as HTMLElement | null
  if (fileTab) fileTab.style.display = tab === 'file' ? 'block' : 'none'
  if (textTab) textTab.style.display = tab === 'text' ? 'block' : 'none'
  if (curlTab) curlTab.style.display = tab === 'curl' ? 'block' : 'none'
  if (linkTab) linkTab.style.display = tab === 'link' ? 'block' : 'none'
}

export function importFromText(): void {
  const ta = document.getElementById('importJsonTextarea') as HTMLTextAreaElement | null
  const raw = (ta?.value || '').trim()
  if (!raw) { showNotif('Paste some JSON or cURL first', 'error'); return }
  try {
    const data = JSON.parse(raw)
    processImportData(data)
  } catch (err: any) {
    if (looksLikeCurl(raw)) {
      try {
        const col = buildCollectionFromCurl(raw)
        showCollectionImportPreview(col)
      } catch (e2: any) {
        showNotif('Invalid JSON and cURL: ' + (e2.message || err.message), 'error')
      }
      return
    }
    showNotif('Invalid JSON: ' + err.message, 'error')
  }
}

function looksLikeCurl(s: string): boolean {
  const t = s.trim()
  if (/^curl\s/i.test(t)) return true
  if (/\s--url\s/i.test(t) || /\s-(?:X|H|d)\s/i.test(t)) return true
  if (/\s--data(?:-raw|-binary|-urlencode)?\s/i.test(t)) return true
  return false
}

export function importFromCurlModal(): void {
  const ta = document.getElementById('importCurlTextarea') as HTMLTextAreaElement | null
  const raw = (ta?.value || '').trim()
  if (!raw) { showNotif('Paste a cURL command first', 'error'); return }
  try {
    const col = buildCollectionFromCurl(raw)
    showCollectionImportPreview(col)
    showNotif('cURL parsed — review and click Import', 'success')
  } catch (e: any) {
    showNotif('Failed to parse cURL: ' + (e.message || String(e)), 'error')
  }
}

export async function importFromUrl(): Promise<void> {
  const input = document.getElementById('importUrlInput') as HTMLInputElement | null
  let url = (input?.value || '').trim()
  if (!url) { showNotif('Enter a URL', 'error'); return }
  if (!url.startsWith('http')) url = 'https://' + url

  const status = document.getElementById('importUrlStatus')!
  status.textContent = 'Fetching...'
  ;(status as HTMLElement).style.color = 'var(--text-dim)'

  try {
    const resp = await window.restifyFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } })
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    const text = await resp.text()
    const data = JSON.parse(text)
    status.textContent = ''
    processImportData(data)
  } catch (err: any) {
    status.textContent = 'Failed: ' + err.message
    ;(status as HTMLElement).style.color = 'var(--red)'
  }
}

export function handleDragOver(e: DragEvent): void {
  e.preventDefault()
  document.getElementById('dropZone')?.classList.add('drag-over')
}
export function handleDragLeave(_e: DragEvent): void {
  document.getElementById('dropZone')?.classList.remove('drag-over')
}
export function handleDrop(e: DragEvent): void {
  e.preventDefault()
  document.getElementById('dropZone')?.classList.remove('drag-over')
  const file = e.dataTransfer?.files[0]
  if (file) processImportFile(file)
}
export function handleFileSelect(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) processImportFile(file)
}

function processImportFile(file: File): void {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target!.result as string)
      processImportData(data)
    } catch (err: any) {
      showNotif('Invalid JSON file: ' + err.message, 'error')
    }
  }
  reader.readAsText(file)
}

function processImportData(data: any): void {
  const result = parsePostmanCollection(data)
  if (result) showCollectionImportPreview(result)
}

function showCollectionImportPreview(result: any): void {
  state.pendingImport = result
  const preview = document.getElementById('importPreview') as HTMLElement
  if (!preview) return
  preview.style.display = 'block'
  const requests: any[] = []
  function collectReqs(node: any) {
    if (node.type === 'request') requests.push(node)
    if (node.children) node.children.forEach(collectReqs)
  }
  result.children.forEach(collectReqs)
  preview.innerHTML = `
      <div style="margin-bottom:8px; font-weight:600; color: var(--text-primary);">${escHtml(result.name)}</div>
      <div style="color: var(--text-secondary);">${requests.length} request${requests.length !== 1 ? 's' : ''}, ${result.children.filter((c: any) => c.type === 'folder').length} folder(s)</div>
      <div style="margin-top:8px; max-height:150px; overflow-y:auto;">
        ${requests.slice(0, 30).map(r => `<div style="padding:3px 0; display:flex; gap:8px; align-items:center;">
          <span class="req-method-badge m-${r.method} bg-${r.method}" style="font-size:9px">${r.method}</span>
          <span style="font-size:12px; color:var(--text-secondary)">${escHtml(r.name)}</span>
        </div>`).join('')}
        ${requests.length > 30 ? `<div style="color:var(--text-dim);font-size:11px">...and ${requests.length - 30} more</div>` : ''}
      </div>
    `
  const doImportBtn = document.getElementById('doImportBtn') as HTMLElement
  if (doImportBtn) doImportBtn.style.display = 'inline-flex'
}

function buildCollectionFromCurl(curlStr: string): any {
  const req = parseCurl(curlStr)
  if (!req.url || !String(req.url).trim()) {
    throw new Error('No URL found in cURL command')
  }
  let colName = 'Imported from cURL'
  try {
    const u = new URL(String(req.url).startsWith('http') ? req.url : 'https://' + req.url)
    colName = u.hostname + ' — cURL'
  } catch { /* keep default */ }
  const col = makeCollection({ name: colName })
  col.children = [req]
  return col
}

function parsePostmanCollection(data: any): any {
  if (!data.info || !data.item) {
    showNotif('Not a valid Postman collection', 'error')
    return null
  }
  const col = makeCollection({ name: data.info.name || 'Imported Collection' })
  if (data.auth) col.auth = parsePostmanAuth(data.auth)

  function parseItems(items: any[]): any[] {
    return items.map(item => {
      if (item.item) {
        const folder = makeFolder({ name: item.name || 'Folder' })
        if (item.auth) folder.auth = parsePostmanAuth(item.auth)
        folder.children = parseItems(item.item)
        return folder
      }
      if (item.request) {
        const r = item.request
        const method = (typeof r.method === 'string' ? r.method : 'GET').toUpperCase()
        const url = typeof r.url === 'string' ? r.url : (r.url?.raw || '')
        const params: any[] = []
        if (r.url?.query) r.url.query.forEach((q: any) => params.push({ key: q.key || '', value: q.value || '', enabled: !q.disabled }))
        if (params.length === 0) params.push({ key: '', value: '', enabled: true })
        const headers: any[] = []
        if (r.header) r.header.forEach((h: any) => headers.push({ key: h.key || '', value: h.value || '', enabled: !h.disabled }))
        if (headers.length === 0) headers.push({ key: '', value: '', enabled: true })
        let bodyType = 'none', body = '', bodyForm: any[] = [{ key: '', value: '', enabled: true }]
        if (r.body) {
          if (r.body.mode === 'raw') {
            body = r.body.raw || ''
            bodyType = (r.body.options?.raw?.language === 'json') ? 'json' : 'raw'
          } else if (r.body.mode === 'formdata') {
            bodyType = 'form'
            bodyForm = (r.body.formdata || []).map((f: any) => ({ key: f.key || '', value: f.value || '', enabled: !f.disabled }))
          } else if (r.body.mode === 'urlencoded') {
            bodyType = 'urlencoded'
            bodyForm = (r.body.urlencoded || []).map((f: any) => ({ key: f.key || '', value: f.value || '', enabled: !f.disabled }))
          } else if (r.body.mode === 'graphql') {
            bodyType = 'graphql'
            body = r.body.graphql?.query || ''
          }
          if (bodyForm.length === 0) bodyForm.push({ key: '', value: '', enabled: true })
        }
        const auth = r.auth ? parsePostmanAuth(r.auth) : { type: 'none' }
        return makeRequest({ name: item.name || 'Request', method, url, params, headers, bodyType: bodyType as any, body, bodyForm, auth })
      }
      return null
    }).filter(Boolean)
  }

  col.children = parseItems(data.item)
  return col
}

function parsePostmanAuth(pmAuth: any): any {
  if (!pmAuth) return { type: 'none' }
  if (pmAuth.type === 'bearer') {
    const t = (pmAuth.bearer || []).find((b: any) => b.key === 'token')
    return { type: 'bearer', token: t?.value || '' }
  }
  if (pmAuth.type === 'basic') {
    const u = (pmAuth.basic || []).find((b: any) => b.key === 'username')
    const p = (pmAuth.basic || []).find((b: any) => b.key === 'password')
    return { type: 'basic', username: u?.value || '', password: p?.value || '' }
  }
  if (pmAuth.type === 'apikey') {
    const k = (pmAuth.apikey || []).find((b: any) => b.key === 'key')
    const v = (pmAuth.apikey || []).find((b: any) => b.key === 'value')
    return { type: 'apikey', key: k?.value || 'X-API-Key', value: v?.value || '' }
  }
  return { type: 'none' }
}

export function doImport(): void {
  if (!state.pendingImport) return
  state.collections.push(state.pendingImport)
  state.openFolders.add(state.pendingImport.id)
  saveState()
  if (typeof (window as any).renderSidebar === 'function') (window as any).renderSidebar()
  closeImport()
  showNotif(`Imported "${state.pendingImport.name}"`, 'success')
  state.pendingImport = null
}

// ── Import cURL ───────────────────────────────────────────────────

export async function openCurlImport(): Promise<void> {
  const curl = await (window as any).appPrompt('Import cURL', 'Paste a cURL command below.', {
    textarea: true,
    placeholder: 'curl https://api.example.com/endpoint -H "Authorization: Bearer ..."',
    okLabel: 'Import'
  })
  if (!curl) return
  try {
    const req = parseCurl(curl)
    if (!req.url || !String(req.url).trim()) {
      showNotif('No URL found in cURL command', 'error')
      return
    }
    ;(window as any).newTab(req)
    showNotif('Imported from cURL', 'success')
  } catch (e: any) {
    showNotif('Failed to parse cURL: ' + e.message, 'error')
  }
}

function parseCurl(curlStr: string): any {
  const req = makeRequest()
  let s = curlStr.replace(/\r\n/g, '\n').trim()
  s = s.replace(/\\\n/g, ' ')
  if (s.toLowerCase().startsWith('curl ')) s = s.slice(5).trim()

  // Leading env assignments (curl ... on Unix)
  s = s.replace(/^(\s*[A-Za-z_][A-Za-z0-9_]*=[^\s]+\s+)+/, '')

  // --url
  const urlFlag = s.match(/--url(?:=|\s+)(['"]?)(https?:\/\/[^\s'"]+)\1/i)
  if (urlFlag) req.url = urlFlag[2]

  if (!req.url) {
    const m = s.match(/https?:\/\/[^\s'"]+/)
    if (m) req.url = m[0].replace(/['"]$/, '')
  }

  const methodMatch = s.match(/\s(?:-X|--request)\s+(\w+)/i)
  if (methodMatch) req.method = methodMatch[1].toUpperCase()

  const headers: any[] = []
  const hdrD = /(?:^|\s)-H\s+"((?:[^"\\]|\\.)*)"/g
  let hm: RegExpExecArray | null
  while ((hm = hdrD.exec(s)) !== null) {
    const line = hm[1].replace(/\\(.)/g, '$1')
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      headers.push({
        key: line.slice(0, colonIdx).trim(),
        value: line.slice(colonIdx + 1).trim(),
        enabled: true
      })
    }
  }
  const hdrS = /(?:^|\s)-H\s+'((?:[^'\\]|\\.)*)'/g
  while ((hm = hdrS.exec(s)) !== null) {
    const line = hm[1].replace(/\\(.)/g, '$1')
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      headers.push({
        key: line.slice(0, colonIdx).trim(),
        value: line.slice(colonIdx + 1).trim(),
        enabled: true
      })
    }
  }
  if (headers.length) req.headers = headers

  const formParts: any[] = []
  const fD = /(?:^|\s)-F\s+"((?:[^"\\]|\\.)*)"/g
  let fm: RegExpExecArray | null
  while ((fm = fD.exec(s)) !== null) {
    const part = fm[1].replace(/\\(.)/g, '$1')
    const eq = part.indexOf('=')
    if (eq > 0) {
      formParts.push({
        key: part.slice(0, eq).trim(),
        value: part.slice(eq + 1).trim(),
        enabled: true
      })
    }
  }
  const fS = /(?:^|\s)-F\s+'((?:[^'\\]|\\.)*)'/g
  while ((fm = fS.exec(s)) !== null) {
    const part = fm[1].replace(/\\(.)/g, '$1')
    const eq = part.indexOf('=')
    if (eq > 0) {
      formParts.push({
        key: part.slice(0, eq).trim(),
        value: part.slice(eq + 1).trim(),
        enabled: true
      })
    }
  }
  const fBare = /(?:^|\s)-F\s+([^\s'"=]+=[^\s]+)/g
  while ((fm = fBare.exec(s)) !== null) {
    const part = fm[1]
    const eq = part.indexOf('=')
    if (eq > 0) {
      formParts.push({
        key: part.slice(0, eq).trim(),
        value: part.slice(eq + 1).trim(),
        enabled: true
      })
    }
  }

  let bodyStr: string | null = null
  if (!formParts.length) {
    let md = s.match(/\s(?:-d|--data|--data-raw|--data-binary)\s+"((?:[^"\\]|\\.)*)"/)
    if (md) bodyStr = md[1].replace(/\\(.)/g, '$1')
    if (!bodyStr) {
      const ms = s.match(/\s(?:-d|--data|--data-raw|--data-binary)\s+'((?:[^'\\]|\\.)*)'/)
      if (ms) bodyStr = ms[1].replace(/\\(.)/g, '$1')
    }
    if (!bodyStr) {
      const dataJson = s.match(/\s(?:-d|--data|--data-raw)\s+(\{[\s\S]*\}|\[[\s\S]*\])(?=\s|$)/)
      if (dataJson) bodyStr = dataJson[1].trim()
    }
    if (!bodyStr) {
      const dataBare = s.match(/\s(?:-d|--data|--data-raw)\s+(\S+)/)
      if (dataBare && !/^-[a-zA-Z]/.test(dataBare[1])) bodyStr = dataBare[1]
    }

    if (bodyStr) {
      req.body = bodyStr
      if (!req.method || req.method === 'GET') req.method = 'POST'
      try {
        JSON.parse(req.body)
        req.bodyType = 'json'
      } catch {
        req.bodyType = 'raw'
      }
    }
  }

  if (formParts.length) {
    req.bodyType = 'form'
    req.bodyForm = formParts
    req.body = '{}'
    if (!req.method || req.method === 'GET') req.method = 'POST'
  }

  if (!req.method) req.method = 'GET'

  req.name = req.url
    ? (() => {
        try {
          const u = new URL(req.url.startsWith('http') ? req.url : 'https://' + req.url)
          const seg = u.pathname.split('/').filter(Boolean).pop()
          return (seg || u.hostname || 'Request').slice(0, 80)
        } catch {
          return 'Request'
        }
      })()
    : 'Request'

  return req
}

// ── Export ────────────────────────────────────────────────────────

export function exportCollectionAsPostman(colId: string): void {
  const col = findNodeInAll(colId)
  if (!col) return
  const postmanData: any = {
    info: { name: col.name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: exportItems((col as any).children)
  }
  if ((col as any).auth?.type !== 'none') postmanData.auth = exportAuth((col as any).auth)
  downloadJson(postmanData, col.name + '.postman_collection.json')
  showNotif('Collection exported', 'success')
}

function exportItems(children: any[]): any[] {
  if (!children) return []
  return children.map(child => {
    if (child.type === 'folder') {
      const item: any = { name: child.name, item: exportItems(child.children) }
      if (child.auth?.type !== 'none') item.auth = exportAuth(child.auth)
      return item
    }
    const item: any = {
      name: child.name,
      request: {
        method: child.method,
        url: { raw: child.url, query: child.params?.filter((p: any) => p.key).map((p: any) => ({ key: p.key, value: p.value, disabled: !p.enabled })) || [] },
        header: child.headers?.filter((h: any) => h.key).map((h: any) => ({ key: h.key, value: h.value, disabled: !h.enabled })) || []
      }
    }
    if (child.bodyType !== 'none') {
      if (child.bodyType === 'json') item.request.body = { mode: 'raw', raw: child.body, options: { raw: { language: 'json' } } }
      else if (child.bodyType === 'raw') item.request.body = { mode: 'raw', raw: child.body }
      else if (child.bodyType === 'form') item.request.body = { mode: 'formdata', formdata: child.bodyForm?.filter((f: any) => f.key).map((f: any) => ({ key: f.key, value: f.value, disabled: !f.enabled })) || [] }
      else if (child.bodyType === 'urlencoded') item.request.body = { mode: 'urlencoded', urlencoded: child.bodyForm?.filter((f: any) => f.key).map((f: any) => ({ key: f.key, value: f.value, disabled: !f.enabled })) || [] }
      else if (child.bodyType === 'graphql') item.request.body = { mode: 'graphql', graphql: { query: child.body } }
    }
    if (child.auth?.type !== 'none' && child.auth?.type !== 'inherit') item.request.auth = exportAuth(child.auth)
    return item
  })
}

function exportAuth(auth: any): any {
  if (auth.type === 'bearer') return { type: 'bearer', bearer: [{ key: 'token', value: auth.token }] }
  if (auth.type === 'basic') return { type: 'basic', basic: [{ key: 'username', value: auth.username }, { key: 'password', value: auth.password }] }
  if (auth.type === 'apikey') return { type: 'apikey', apikey: [{ key: 'key', value: auth.key }, { key: 'value', value: auth.value }] }
  return { type: 'noauth' }
}

function downloadJson(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── cURL Generation ───────────────────────────────────────────────

export function generateCurl(): string {
  if (typeof (window as any).saveCurrentTabState === 'function') (window as any).saveCurrentTabState()
  const method = (document.getElementById('methodSelect') as HTMLSelectElement).value
  let url = resolveVariables((document.getElementById('urlInput') as HTMLInputElement).value.trim())
  if (!url.startsWith('http')) url = 'https://' + url

  const getKvStore = (window as any).getKvStore
  const getAuthState = (window as any).getAuthState

  const params = getKvStore('params').filter((r: any) => r.enabled && r.key)
  if (params.length) {
    const qs = params.map((r: any) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }

  const parts = [`curl -X ${method}`, `  '${url}'`]
  const allHeaders: Record<string, string> = {}
  getKvStore('headers').filter((r: any) => r.enabled && r.key).forEach((r: any) => {
    allHeaders[resolveVariables(r.key)] = resolveVariables(r.value)
  })
  const auth = getAuthState()
  if (auth.type === 'bearer') allHeaders['Authorization'] = `Bearer ${resolveVariables(auth.token)}`
  else if (auth.type === 'basic') allHeaders['Authorization'] = 'Basic ' + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`)
  else if (auth.type === 'apikey') allHeaders[resolveVariables(auth.key)] = resolveVariables(auth.value)

  if (state.currentBodyType === 'json' && !allHeaders['Content-Type']) allHeaders['Content-Type'] = 'application/json'
  if (state.currentBodyType === 'urlencoded' && !allHeaders['Content-Type']) allHeaders['Content-Type'] = 'application/x-www-form-urlencoded'

  Object.entries(allHeaders).forEach(([k, v]) => { parts.push(`  -H '${k}: ${v}'`) })

  if (method !== 'GET' && method !== 'HEAD') {
    if (state.currentBodyType === 'json' || state.currentBodyType === 'raw') {
      const body = resolveVariables(getBodyEditorText())
      if (body) parts.push(`  -d '${body.replace(/'/g, "'\\''")}'`)
    } else if (state.currentBodyType === 'form') {
      getKvStore('bodyForm').filter((r: any) => r.enabled && r.key).forEach((r: any) => {
        parts.push(`  -F '${resolveVariables(r.key)}=${resolveVariables(r.value)}'`)
      })
    } else if (state.currentBodyType === 'urlencoded') {
      const body = getKvStore('bodyForm').filter((r: any) => r.enabled && r.key)
        .map((r: any) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&')
      if (body) parts.push(`  -d '${body}'`)
    } else if (state.currentBodyType === 'graphql') {
      const query = resolveVariables(getBodyEditorText())
      const vars = (document.getElementById('graphqlVarsTextarea') as HTMLTextAreaElement)?.value || '{}'
      parts.push(`  -d '${JSON.stringify({ query, variables: JSON.parse(resolveVariables(vars) || '{}') }).replace(/'/g, "'\\''")}'`)
    }
  }

  const curl = parts.join(' \\\n')
  navigator.clipboard.writeText(curl).then(() => showNotif('cURL copied to clipboard', 'success'))
  return curl
}

// ── Code Snippet Generator ────────────────────────────────────────

export function openCodeGen(): void {
  document.getElementById('codeGenModal')?.classList.add('open')
  generateCodeSnippet('javascript_fetch')
}

export function closeCodeGen(): void {
  document.getElementById('codeGenModal')?.classList.remove('open')
  const title = document.getElementById('codeGenTitle')
  if (title) title.textContent = 'Generate Code Snippet'
  const langs = document.querySelector<HTMLElement>('.codegen-langs')
  if (langs) langs.style.display = ''
}

export function generateCodeSnippet(lang: string): void {
  document.querySelectorAll<HTMLElement>('.codegen-lang-btn').forEach(b => b.classList.toggle('active', (b as any).dataset.lang === lang))
  if (typeof (window as any).saveCurrentTabState === 'function') (window as any).saveCurrentTabState()
  const method = (document.getElementById('methodSelect') as HTMLSelectElement).value
  let url = resolveVariables((document.getElementById('urlInput') as HTMLInputElement).value.trim())
  if (!url.startsWith('http')) url = 'https://' + url

  const getKvStore = (window as any).getKvStore
  const getAuthState = (window as any).getAuthState

  const params = getKvStore('params').filter((r: any) => r.enabled && r.key)
  if (params.length) {
    const qs = params.map((r: any) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }

  const hdrs: Record<string, string> = {}
  getKvStore('headers').filter((r: any) => r.enabled && r.key).forEach((r: any) => { hdrs[resolveVariables(r.key)] = resolveVariables(r.value) })
  const auth = getAuthState()
  if (auth.type === 'bearer') hdrs['Authorization'] = `Bearer ${resolveVariables(auth.token)}`
  else if (auth.type === 'basic') hdrs['Authorization'] = 'Basic ' + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`)
  else if (auth.type === 'apikey') hdrs[resolveVariables(auth.key)] = resolveVariables(auth.value)
  if (state.currentBodyType === 'json' && !hdrs['Content-Type']) hdrs['Content-Type'] = 'application/json'

  let bodyStr = ''
  if (method !== 'GET' && method !== 'HEAD' && (state.currentBodyType === 'json' || state.currentBodyType === 'raw')) {
    bodyStr = resolveVariables(getBodyEditorText())
  }

  let code = ''
  if (lang === 'javascript_fetch') code = genJsFetch(method, url, hdrs, bodyStr)
  else if (lang === 'javascript_axios') code = genJsAxios(method, url, hdrs, bodyStr)
  else if (lang === 'python') code = genPython(method, url, hdrs, bodyStr)
  else if (lang === 'go') code = genGo(method, url, hdrs, bodyStr)
  else if (lang === 'php') code = genPhp(method, url, hdrs, bodyStr)
  else if (lang === 'curl') code = generateCurl()

  const output = document.getElementById('codeGenOutput')
  if (output) output.textContent = code
}

function genJsFetch(method: string, url: string, hdrs: any, body: string): string {
  let code = `const response = await fetch('${url}', {\n  method: '${method}'`
  if (Object.keys(hdrs).length) code += `,\n  headers: ${JSON.stringify(hdrs, null, 4).replace(/\n/g, '\n  ')}`
  if (body) code += `,\n  body: ${/^\{/.test(body.trim()) ? `JSON.stringify(${body})` : `'${body.replace(/'/g, "\\'")}'`}`
  code += `\n});\n\nconst data = await response.json();\nconsole.log(data);`
  return code
}

function genJsAxios(method: string, url: string, hdrs: any, body: string): string {
  let code = `const axios = require('axios');\n\nconst response = await axios({\n  method: '${method.toLowerCase()}',\n  url: '${url}'`
  if (Object.keys(hdrs).length) code += `,\n  headers: ${JSON.stringify(hdrs, null, 4).replace(/\n/g, '\n  ')}`
  if (body) code += `,\n  data: ${body}`
  code += `\n});\n\nconsole.log(response.data);`
  return code
}

function genPython(method: string, url: string, hdrs: any, body: string): string {
  let code = `import requests\n\nresponse = requests.${method.toLowerCase()}(\n    '${url}'`
  if (Object.keys(hdrs).length) code += `,\n    headers=${JSON.stringify(hdrs).replace(/"/g, "'")}`
  if (body) code += `,\n    json=${body}`
  code += `\n)\n\nprint(response.json())`
  return code
}

function genGo(method: string, url: string, hdrs: any, body: string): string {
  let code = `package main\n\nimport (\n    "fmt"\n    "io"\n    "net/http"\n`
  if (body) code += `    "strings"\n`
  code += `)\n\nfunc main() {\n`
  if (body) code += `    body := strings.NewReader(\`${body}\`)\n    req, _ := http.NewRequest("${method}", "${url}", body)\n`
  else code += `    req, _ := http.NewRequest("${method}", "${url}", nil)\n`
  Object.entries(hdrs).forEach(([k, v]) => { code += `    req.Header.Set("${k}", "${v}")\n` })
  code += `\n    client := &http.Client{}\n    resp, _ := client.Do(req)\n    defer resp.Body.Close()\n    data, _ := io.ReadAll(resp.Body)\n    fmt.Println(string(data))\n}`
  return code
}

function genPhp(method: string, url: string, hdrs: any, body: string): string {
  let code = `<?php\n$ch = curl_init();\ncurl_setopt($ch, CURLOPT_URL, '${url}');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`
  const hdrArr = Object.entries(hdrs).map(([k, v]) => `'${k}: ${v}'`)
  if (hdrArr.length) code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [${hdrArr.join(', ')}]);\n`
  if (body) code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${body.replace(/'/g, "\\'")}');\n`
  code += `\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;\n?>`
  return code
}

export function copyCodeGen(): void {
  const code = (document.getElementById('codeGenOutput') as HTMLElement)?.textContent || ''
  navigator.clipboard.writeText(code).then(() => showNotif('Code copied!', 'success'))
}

// ── Collection Runner ─────────────────────────────────────────────

export async function runCollection(colId: string): Promise<void> {
  const col = findNodeInAll(colId)
  if (!col) return
  const requests: { req: any; id: string }[] = []
  function collect(node: any) {
    if (node.type === 'request') requests.push({ req: node, id: node.id })
    if (node.children) node.children.forEach((c: any) => collect(c))
  }
  collect(col)

  if (requests.length === 0) { showNotif('No requests to run', 'error'); return }
  showNotif(`Running ${requests.length} requests...`, 'info')

  const results: any[] = []

  for (const { req } of requests) {
    let url = resolveVariables(req.url)
    if (!url.startsWith('http')) url = 'https://' + url
    const params = (req.params || []).filter((r: any) => r.enabled && r.key)
    if (params.length) {
      const qs = params.map((r: any) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&')
      url += (url.includes('?') ? '&' : '?') + qs
    }
    const headers: Record<string, string> = {}
    const chain = getAncestorChain(req.id)
    chain.forEach((ancestor: any) => {
      if (ancestor.headers) ancestor.headers.forEach((h: any) => {
        if (h.enabled !== false && h.key) headers[resolveVariables(h.key)] = resolveVariables(h.value)
      })
    })
    ;(req.headers || []).filter((r: any) => r.enabled && r.key).forEach((r: any) => {
      headers[resolveVariables(r.key)] = resolveVariables(r.value)
    })
    let auth = req.auth || { type: 'none' }
    if (!auth || auth.type === 'none' || auth.type === 'inherit') {
      const inheritedAuth = getInheritedAuth(req.id)
      if (inheritedAuth) auth = inheritedAuth.auth
    }
    if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${resolveVariables(auth.token)}`
    else if (auth.type === 'basic') headers['Authorization'] = 'Basic ' + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`)
    else if (auth.type === 'apikey') headers[resolveVariables(auth.key)] = resolveVariables(auth.value)
    if ((req.bodyType === 'json') && !headers['Content-Type']) headers['Content-Type'] = 'application/json'

    const opts: RequestInit = { method: req.method, headers }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.bodyType === 'json' || req.bodyType === 'raw') (opts as any).body = resolveVariables(req.body)
      else if (req.bodyType === 'urlencoded') {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded'
        ;(opts as any).body = (req.bodyForm || []).filter((r: any) => r.enabled && r.key)
          .map((r: any) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&')
      }
    }
    let reqCtx = { url, method: req.method, headers, body: (opts as any).body }
    for (const ancestor of chain) {
      if ((ancestor as any).preRequestScript) {
        try {
          const r = runPreRequestScript((ancestor as any).preRequestScript, reqCtx)
          if (r) Object.assign(reqCtx, r)
        } catch (e: any) {
          results.push({ name: req.name, method: req.method, status: 'ERR', time: 0, passed: false, error: 'Pre-req script: ' + e.message })
          continue
        }
      }
    }
    if (req.preRequestScript) {
      try {
        const r = runPreRequestScript(req.preRequestScript, reqCtx)
        if (r) Object.assign(reqCtx, r)
      } catch (e: any) {
        results.push({ name: req.name, method: req.method, status: 'ERR', time: 0, passed: false, error: 'Pre-req script: ' + e.message })
        continue
      }
    }
    opts.method = reqCtx.method
    Object.assign(headers, reqCtx.headers)
    if (reqCtx.body !== undefined) (opts as any).body = reqCtx.body

    const start = Date.now()
    try {
      const resp = await window.restifyFetch(reqCtx.url, opts)
      const respText = await resp.text()
      let testResults: any[] = []
      const respCtx = { status: resp.status, statusText: resp.statusText, body: respText, headers: Object.fromEntries(resp.headers.entries()) }
      for (const ancestor of chain) {
        if ((ancestor as any).testScript) {
          try { testResults = testResults.concat(runTestScript((ancestor as any).testScript, respCtx)) } catch {}
        }
      }
      if (req.testScript) {
        try { testResults = testResults.concat(runTestScript(req.testScript, respCtx)) } catch {}
      }
      const testFailed = testResults.some(t => !t.passed)
      results.push({ name: req.name, method: req.method, status: resp.status, time: Date.now() - start, passed: resp.status < 400 && !testFailed, tests: testResults })
    } catch (e: any) {
      results.push({ name: req.name, method: req.method, status: 'ERR', time: Date.now() - start, passed: false, error: e.message })
    }
  }

  showRunnerResults(results)
}

function showRunnerResults(results: any[]): void {
  const modal = document.getElementById('codeGenModal')
  modal?.classList.add('open')
  const titleEl = document.getElementById('codeGenTitle')
  if (titleEl) titleEl.textContent = 'Collection Runner Results'
  const output = document.getElementById('codeGenOutput')
  if (!output) return
  let html = ''
  let passed = 0, failed = 0
  results.forEach(r => {
    if (r.passed) passed++; else failed++
    html += `${r.passed ? '✓' : '✗'} [${r.method}] ${r.name} - ${r.status} (${r.time}ms)${r.error ? ' - ' + r.error : ''}\n`
  })
  html = `Results: ${passed} passed, ${failed} failed\n${'─'.repeat(50)}\n` + html
  output.textContent = html
  const langs = document.querySelector<HTMLElement>('.codegen-langs')
  if (langs) langs.style.display = 'none'
}
