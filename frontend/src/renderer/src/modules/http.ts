import { state, resolveVariables, getAncestorChain, getInheritedHeaders, getInheritedAuth, saveState, addToHistory } from './state'
import { escHtml, formatBytes, syntaxHighlight, syntaxHighlightXml, showNotif } from './utils'
import { runPreRequestScript, runTestScript } from './scripts'
import { getKvStore, getAuthState, showResponsePlaceholder, switchResponseMode } from './ui'

let _activeAbortController: AbortController | null = null
let _requestElapsedTimer: ReturnType<typeof setInterval> | null = null

export function cancelRequest() {
  if (_activeAbortController) { _activeAbortController.abort(); _activeAbortController = null }
}

export async function sendRequest() {
  const methodSel = document.getElementById('methodSelect') as HTMLSelectElement
  const urlInput = document.getElementById('urlInput') as HTMLInputElement
  let method = methodSel.value
  let url = urlInput.value.trim()
  if (!url) { showNotif('Please enter a URL', 'error'); return }
  if (!url.startsWith('http')) url = 'https://' + url
  url = resolveVariables(url)

  const params = getKvStore('params').filter((r: any) => r.enabled && r.key)
  if (params.length) {
    const qs = params.map((r: any) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }

  const headers: Record<string, string> = {}
  const tab = state.tabs.find(t => t.id === state.activeTabId)
  if (tab?.sourceId) {
    const inherited = getInheritedHeaders(tab.sourceId)
    Object.entries(inherited).forEach(([k, v]) => { headers[k] = v.value })
  }
  getKvStore('headers').filter((r: any) => r.enabled && r.key).forEach((r: any) => {
    headers[resolveVariables(r.key)] = resolveVariables(r.value)
  })

  let auth = getAuthState()
  if (auth.type === 'inherit' && tab?.sourceId) {
    const inherited = getInheritedAuth(tab.sourceId)
    if (inherited) auth = inherited.auth
  }
  if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${resolveVariables(auth.token)}`
  else if (auth.type === 'basic') headers['Authorization'] = 'Basic ' + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`)
  else if (auth.type === 'apikey') headers[resolveVariables(auth.key)] = resolveVariables(auth.value)
  else if (auth.type === 'oauth2' && auth.token) headers['Authorization'] = `Bearer ${auth.token}`

  let body: any = null
  const bodyType = state.currentBodyType
  if (method !== 'GET' && method !== 'HEAD') {
    if (bodyType === 'json' || bodyType === 'raw') {
      body = resolveVariables((document.getElementById('bodyTextarea') as HTMLTextAreaElement).value)
      if (bodyType === 'json' && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
    } else if (bodyType === 'graphql') {
      const query = resolveVariables((document.getElementById('bodyTextarea') as HTMLTextAreaElement).value)
      const vars = (document.getElementById('graphqlVarsTextarea') as HTMLTextAreaElement)?.value || '{}'
      try { body = JSON.stringify({ query, variables: JSON.parse(resolveVariables(vars)) }) }
      catch { body = JSON.stringify({ query, variables: {} }) }
      headers['Content-Type'] = 'application/json'
    } else if (bodyType === 'form') {
      const fd = new FormData()
      getKvStore('bodyForm').filter((r: any) => r.enabled && r.key).forEach((r: any) => {
        if (r.type === 'file' && r.file) fd.append(r.key, r.file)
        else fd.append(resolveVariables(r.key), resolveVariables(r.value))
      })
      body = fd
    } else if (bodyType === 'urlencoded') {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = getKvStore('bodyForm').filter((r: any) => r.enabled && r.key)
        .map((r: any) => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&')
    } else if (bodyType === 'binary') {
      const fileInput = document.getElementById('binaryFileInput') as HTMLInputElement | null
      if (fileInput?.files?.[0]) body = fileInput.files[0]
    }
  }

  let reqContext = { url, method, headers, body }
  if (tab?.sourceId) {
    const chain = getAncestorChain(tab.sourceId)
    for (const ancestor of chain) {
      if ((ancestor as any).preRequestScript) {
        try { const r = runPreRequestScript((ancestor as any).preRequestScript, reqContext); if (r) Object.assign(reqContext, r) }
        catch (e: any) { showNotif('Pre-request script error (' + ancestor.name + '): ' + e.message, 'error'); return }
      }
    }
  }
  const preScript = state.activeTabId ? state.tabData[state.activeTabId]?.preRequestScript : ''
  if (preScript) {
    try { const r = runPreRequestScript(preScript, reqContext); if (r) Object.assign(reqContext, r) }
    catch (e: any) { showNotif('Pre-request script error: ' + e.message, 'error'); return }
  }
  url = reqContext.url; method = reqContext.method
  Object.assign(headers, reqContext.headers)
  if (reqContext.body !== undefined) body = reqContext.body

  const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement
  sendBtn.innerHTML = '<span class="spinner"></span><span id="sendElapsed"></span>'
  sendBtn.classList.add('loading')
  sendBtn.onclick = cancelRequest

  const startTime = Date.now()
  _requestElapsedTimer = setInterval(() => {
    const el = document.getElementById('sendElapsed')
    if (el) el.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's'
  }, 100)

  _activeAbortController = new AbortController()
  const signal = _activeAbortController.signal

  try {
    const opts: any = { method, headers, signal }
    if (body) opts.body = body
    const response = await window.restifyFetch(url, opts)
    const elapsed = Date.now() - startTime
    const respText = await response.text()
    showResponse(response, respText, elapsed, url, method)

    const respCtx = { status: response.status, statusText: response.statusText, body: respText, headers: Object.fromEntries(response.headers.entries()) }
    let allTestResults: any[] = []
    if (tab?.sourceId) {
      const chain = getAncestorChain(tab.sourceId)
      for (const ancestor of chain) {
        if ((ancestor as any).testScript) {
          try { allTestResults = allTestResults.concat(runTestScript((ancestor as any).testScript, respCtx)) }
          catch (e) { console.error('Test script error (' + ancestor.name + '):', e) }
        }
      }
    }
    const testScript = state.activeTabId ? state.tabData[state.activeTabId]?.testScript : ''
    if (testScript) {
      try { allTestResults = allTestResults.concat(runTestScript(testScript, respCtx)) }
      catch (e) { console.error('Test script error:', e) }
    }
    if (allTestResults.length) renderTestResults(allTestResults)
  } catch (err: any) {
    if (err.name === 'AbortError') { showNotif('Request cancelled', 'info'); showResponsePlaceholder() }
    else showError(err.message)
  } finally {
    if (_requestElapsedTimer) { clearInterval(_requestElapsedTimer); _requestElapsedTimer = null }
    _activeAbortController = null
    sendBtn.innerHTML = '&#9654; Send'
    sendBtn.classList.remove('loading')
    sendBtn.onclick = sendRequest
  }
}

function showResponse(response: Response, text: string, elapsed: number, reqUrl: string, reqMethod: string) {
  const statusBadge = document.getElementById('statusBadge')!
  const cls = response.status < 300 ? '2xx' : response.status < 400 ? '3xx' : response.status < 500 ? '4xx' : '5xx'
  const statusHtml = `<span class="status-badge status-${cls}"><span class="status-dot"></span>${response.status} ${response.statusText}</span>`
  statusBadge.innerHTML = statusHtml
  const size = new Blob([text]).size
  const meta = `${elapsed}ms · ${formatBytes(size)}`
  const rm = document.getElementById('respMeta'); if (rm) rm.textContent = meta
  ;['copyRespBtn', 'curlBtn', 'codeGenBtn', 'beautifyRespBtn'].forEach(id => { const el = document.getElementById(id) as HTMLElement | null; if (el) el.style.display = 'inline-flex' })

  let bodyHtml = ''
  const content = document.getElementById('responseBodyContent')!
  try {
    const json = JSON.parse(text)
    bodyHtml = syntaxHighlight(JSON.stringify(json, null, 2))
    content.innerHTML = bodyHtml
  } catch {
    if (text.trim().startsWith('<') && (text.includes('</') || text.includes('/>'))) {
      bodyHtml = syntaxHighlightXml(text); content.innerHTML = bodyHtml
    } else { content.textContent = text; bodyHtml = escHtml(text) }
  }
  const ph = document.getElementById('responsePlaceholder') as HTMLElement | null; if (ph) ph.style.display = 'none'
  content.style.display = 'block'
  const raw = document.getElementById('responseBodyRaw') as HTMLElement | null; if (raw) { raw.style.display = 'none'; raw.textContent = text }
  const preview = document.getElementById('responseBodyPreview') as HTMLIFrameElement | null
  if (preview) (preview as any).srcdoc = text.trim().startsWith('<') ? text : `<pre style="font-family:monospace;white-space:pre-wrap;padding:12px">${escHtml(text)}</pre>`
  switchResponseMode('pretty')

  const tbody = document.getElementById('respHeadersBody')!
  tbody.innerHTML = ''
  let headersHtml = ''
  response.headers.forEach((val, name) => {
    const row = `<tr><td>${escHtml(name)}</td><td>${escHtml(val)}</td></tr>`
    headersHtml += row; tbody.innerHTML += row
  })

  let cookiesHtml = ''
  const cookieBody = document.getElementById('respCookiesBody')!
  cookieBody.innerHTML = ''
  response.headers.forEach((val, name) => {
    if (name.toLowerCase() === 'set-cookie') {
      const parts = val.split(';').map(s => s.trim())
      const [nameVal, ...attrs] = parts
      const [cName, cVal] = nameVal.split('=')
      const row = `<tr><td>${escHtml(cName)}</td><td>${escHtml(cVal || '')}</td><td>${escHtml(attrs.join('; '))}</td></tr>`
      cookiesHtml += row; cookieBody.innerHTML += row
    }
  })

  ;(window as any)._lastResponse = text
  if (state.activeTabId && state.tabData[state.activeTabId]) {
    ;(state.tabData[state.activeTabId] as any).response = { statusHtml, meta, bodyHtml, bodyRaw: text, headersHtml, cookiesHtml }
  }
  addToHistory({ method: reqMethod || 'GET', url: reqUrl || '', status: response.status, time: elapsed, size })
  saveState()
}

function showError(msg: string) {
  const sb = document.getElementById('statusBadge')!
  sb.innerHTML = '<span class="status-badge status-4xx"><span class="status-dot"></span>Error</span>'
  const rm = document.getElementById('respMeta'); if (rm) rm.textContent = ''
  const ph = document.getElementById('responsePlaceholder') as HTMLElement | null; if (ph) ph.style.display = 'none'
  const content = document.getElementById('responseBodyContent')!
  content.style.display = 'block'
  content.textContent = `Request failed\n\n${msg}\n\nIf you see CORS errors, the server doesn't allow browser requests.\nThe desktop app bypasses CORS restrictions.`
  const raw = document.getElementById('responseBodyRaw') as HTMLElement | null; if (raw) raw.textContent = msg
  ;['curlBtn', 'codeGenBtn'].forEach(id => { const el = document.getElementById(id) as HTMLElement | null; if (el) el.style.display = 'inline-flex' })
  ;(window as any)._lastResponse = msg
}

function renderTestResults(results: any[]) {
  const container = document.getElementById('testResultsContent')
  if (!container || !results?.length) return
  container.innerHTML = ''
  let passed = 0, failed = 0
  results.forEach(r => {
    if (r.passed) passed++; else failed++
    const div = document.createElement('div')
    div.className = 'test-result ' + (r.passed ? 'test-pass' : 'test-fail')
    div.innerHTML = `<span class="test-icon">${r.passed ? '✓' : '✗'}</span> <span>${escHtml(r.name)}</span>${r.error ? `<span class="test-error">${escHtml(r.error)}</span>` : ''}`
    container.appendChild(div)
  })
  const summary = document.createElement('div')
  summary.className = 'test-summary'
  summary.textContent = `${passed} passed, ${failed} failed`
  container.prepend(summary)
  const badge = document.querySelector<HTMLElement>('.response-tab[data-tab="tests"] .tab-badge')
  if (badge) { badge.textContent = String(failed > 0 ? failed : passed); badge.className = 'tab-badge ' + (failed > 0 ? 'badge-fail' : 'badge-pass') }
}
