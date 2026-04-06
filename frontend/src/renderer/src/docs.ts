// Enhanced API docs viewer — search, multi-lang code, try-it, scroll-tracking

;(function initConfigDomains() {
  if (typeof window === 'undefined' || !window.location) return
  const h = String(window.location.hostname || '').toLowerCase()
  if (h === 'app.restify.online') {
    window.__RESTIFY_API_BASE__ = 'https://api.restify.online'
  }
})()

;(function initApiBase() {
  function trimSlash(s: string) { return String(s || '').replace(/\/+$/, '') }
  function getApiBase(): string {
    const w = window.__RESTIFY_API_BASE__
    if (w != null && String(w).trim() !== '') return trimSlash(w)
    const leg = window.__RESTFY_API_BASE__
    if (leg != null && String(leg).trim() !== '') return trimSlash(leg)
    return ''
  }
  window.getRestifyApiBase = getApiBase
  window.restifyApiUrl = function (path: string): string {
    const p = path.charAt(0) === '/' ? path : '/' + path
    const base = getApiBase()
    return base ? base + p : p
  }
  window.restifyFetch = (url: string, opts?: RequestInit) => fetch(url, opts)
})()

// ── Helpers ───────────────────────────────────────────────────

function esc(s: any): string {
  return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''
}

function getCollectionId(): string {
  const path = window.location.pathname || ''
  const qs = new URLSearchParams(window.location.search)
  const fromQuery = qs.get('slug') || qs.get('id')
  if (fromQuery) return fromQuery
  const m = path.match(/^\/docs\/(.+?)\/?$/)
  if (m) return decodeURIComponent(m[1])
  const parts = path.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--green)', POST: 'var(--yellow)', PUT: 'var(--blue)',
  PATCH: 'var(--purple)', DELETE: 'var(--red)', HEAD: 'var(--cyan)', OPTIONS: 'var(--orange)'
}
const METHOD_BG: Record<string, string> = {
  GET: 'var(--green-bg)', POST: 'var(--yellow-bg)', PUT: 'var(--blue-bg)',
  PATCH: 'var(--purple-bg)', DELETE: 'var(--red-bg)', HEAD: 'var(--cyan-bg)', OPTIONS: 'var(--orange-bg)'
}

function methodStyle(m: string): string {
  return `color:${METHOD_COLOR[m] || 'var(--text-dim)'};background:${METHOD_BG[m] || 'var(--bg-hover)'}`
}

// ── Data ──────────────────────────────────────────────────────

let _allEndpoints: HTMLElement[] = []
let _sidebarItems: HTMLElement[] = []

// ── Load ──────────────────────────────────────────────────────

async function loadDocs(): Promise<void> {
  const id = getCollectionId()
  if (!id) { showError('No collection ID in URL.'); return }
  try {
    const resp = await fetch(window.restifyApiUrl(`/api/shared/${id}`))
    if (!resp.ok) throw new Error(resp.status === 404 ? 'Documentation not found' : 'Server error ' + resp.status)
    const data = await resp.json()
    render(data)
  } catch (err: any) {
    showError(err.message)
  }
}

function showError(msg: string): void {
  const content = document.getElementById('docsContent')
  if (content) content.innerHTML = `
    <div class="error-wrap">
      <div class="error-icon">📄</div>
      <div class="error-title">${esc(msg)}</div>
      <div class="error-sub">This link may have expired or the collection is private.</div>
    </div>`
  const title = document.getElementById('topbarTitle')
  if (title) title.textContent = 'Not Found'
}

function countAll(node: any): number {
  if (node.type === 'request') return 1
  if (!node.children) return 0
  return node.children.reduce((s: number, c: any) => s + countAll(c), 0)
}

function allRequests(node: any, acc: any[] = []): any[] {
  if (node.type === 'request') acc.push(node)
  if (node.children) node.children.forEach((c: any) => allRequests(c, acc))
  return acc
}

// ── Render ────────────────────────────────────────────────────

function render(data: any): void {
  const col = data.collection
  const total = countAll(col)
  document.title = data.name + ' — API Docs — Restify'
  const topbarTitle = document.getElementById('topbarTitle')
  if (topbarTitle) topbarTitle.textContent = data.name
  const topbarMeta = document.getElementById('topbarMeta')
  if (topbarMeta) topbarMeta.innerHTML = `<span>${total} endpoint${total !== 1 ? 's' : ''}</span>${data.views > 0 ? `<span>· ${data.views} view${data.views !== 1 ? 's' : ''}</span>` : ''}`
  const openBtn = document.getElementById('openBtn') as HTMLAnchorElement | null
  if (openBtn) openBtn.href = `https://app.restify.online/?import=${data.id}`
  const sidebarTitle = document.getElementById('sidebarTitle')
  if (sidebarTitle) sidebarTitle.textContent = data.name
  const sidebarCount = document.getElementById('sidebarCount')
  if (sidebarCount) sidebarCount.textContent = total + ' endpoint' + (total !== 1 ? 's' : '')
  buildSidebar(col)
  buildContent(col, data)
  setupScrollTracking()
}

// ── Sidebar ───────────────────────────────────────────────────

function buildSidebar(col: any): void {
  const nav = document.getElementById('sidebarNav')
  if (!nav) return
  let html = ''
  function walk(children: any[], depth: number) {
    ;(children || []).forEach(child => {
      if (child.type === 'folder') {
        const count = countAll(child)
        html += `<div class="sidebar-folder" onclick="toggleFolder('${esc(child.id)}')" id="sfh-${esc(child.id)}">
          <span class="sidebar-folder-arrow open" id="sfa-${esc(child.id)}">▶</span>
          <span>📁 ${esc(child.name)}</span>
          <span class="sidebar-folder-count">${count}</span>
        </div>
        <div id="sf-${esc(child.id)}">`
        walk(child.children, depth + 1)
        html += '</div>'
      } else if (child.type === 'request') {
        const cls = depth === 0 ? 'sidebar-item root-level' : 'sidebar-item'
        html += `<div class="${cls}" data-id="${child.id}" data-name="${esc((child.name || '').toLowerCase())}" data-method="${esc(child.method || 'GET')}" onclick="scrollToEndpoint('${child.id}')">
          <span class="m-badge m-${esc(child.method || 'GET')}">${esc(child.method || 'GET')}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(child.name)}</span>
        </div>`
      }
    })
  }
  walk(col.children || [], 0)
  nav.innerHTML = html
  _sidebarItems = Array.from(nav.querySelectorAll('.sidebar-item'))
}

;(window as any).toggleFolder = function (fid: string) {
  const el = document.getElementById('sf-' + fid)
  const arrow = document.getElementById('sfa-' + fid)
  if (!el) return
  const open = el.style.display !== 'none'
  el.style.display = open ? 'none' : ''
  if (arrow) arrow.classList.toggle('open', !open)
}

;(window as any).scrollToEndpoint = function (id: string) {
  const el = document.getElementById('ep-' + id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    _setActiveEndpoint(id)
  }
}

function _setActiveEndpoint(id: string) {
  _sidebarItems.forEach(s => s.classList.remove('active'))
  const sideItem = document.querySelector<HTMLElement>(`.sidebar-item[data-id="${id}"]`)
  if (sideItem) {
    sideItem.classList.add('active')
    sideItem.scrollIntoView({ block: 'nearest' })
  }
}

// ── Search ────────────────────────────────────────────────────

;(window as any).filterEndpoints = function (query: string) {
  const q = query.trim().toLowerCase()
  _sidebarItems.forEach(item => {
    const name = item.getAttribute('data-name') || ''
    const method = (item.getAttribute('data-method') || '').toLowerCase()
    const match = !q || name.includes(q) || method.includes(q)
    ;(item as HTMLElement).style.display = match ? '' : 'none'
  })
  _allEndpoints.forEach(ep => {
    const id = ep.id.replace('ep-', '')
    const sideItem = document.querySelector<HTMLElement>(`.sidebar-item[data-id="${id}"]`)
    if (sideItem) {
      ep.style.display = sideItem.style.display
    }
  })
}

// ── Scroll Tracking ───────────────────────────────────────────

function setupScrollTracking(): void {
  const content = document.getElementById('docsContent')
  if (!content) return
  _allEndpoints = Array.from(content.querySelectorAll('.endpoint'))

  let ticking = false
  content.addEventListener('scroll', () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      const scrollTop = content.scrollTop + 120
      let activeId = ''
      for (const ep of _allEndpoints) {
        if (ep.offsetTop <= scrollTop) {
          activeId = ep.id.replace('ep-', '')
        }
      }
      if (activeId) _setActiveEndpoint(activeId)
    })
  })
}

// ── Build Content ─────────────────────────────────────────────

function buildContent(col: any, meta: any): void {
  const container = document.getElementById('docsContent')
  if (!container) return
  let html = ''
  const reqs = allRequests(col)
  const folderCount = (col.children || []).filter((c: any) => c.type === 'folder').length
  const desc = col.description || ''
  const published = new Date(meta.createdAt * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

  html += `<div class="collection-hero">
    <div class="collection-name">${esc(col.name)}</div>
    ${desc ? `<div class="collection-desc">${esc(desc)}</div>` : ''}
    <div class="collection-stats">
      <div class="stat-chip"><strong>${reqs.length}</strong> endpoint${reqs.length !== 1 ? 's' : ''}</div>
      ${folderCount ? `<div class="stat-chip"><strong>${folderCount}</strong> folder${folderCount !== 1 ? 's' : ''}</div>` : ''}
      ${meta.views ? `<div class="stat-chip"><strong>${meta.views}</strong> view${meta.views !== 1 ? 's' : ''}</div>` : ''}
      <div class="stat-chip">Published ${esc(published)}</div>
      ${meta.owner?.name ? `<div class="stat-chip">By <strong>${esc(meta.owner.name)}</strong></div>` : ''}
    </div>
  </div>`

  if (col.auth?.type && col.auth.type !== 'none') {
    html += `<div class="intro-auth"><div class="intro-auth-label">Collection Authorization</div>${renderAuth(col.auth)}</div>`
  }

  function walkContent(children: any[]) {
    ;(children || []).forEach(child => {
      if (child.type === 'folder') {
        const auth = child.auth?.type && child.auth.type !== 'none' && child.auth.type !== 'inherit'
        html += `<div class="folder-section">
          <div class="folder-header">
            <span class="folder-icon">📁</span>
            <span class="folder-name">${esc(child.name)}</span>
            ${auth ? `<span class="folder-auth-badge">${esc(child.auth.type)}</span>` : ''}
          </div>`
        walkContent(child.children)
        html += `</div>`
      } else if (child.type === 'request') {
        html += renderEndpoint(child)
      }
    })
  }
  walkContent(col.children || [])

  if (reqs.length === 0) {
    html += `<div class="error-wrap"><div class="error-icon">📭</div><div class="error-title">No endpoints</div><div class="error-sub">This collection has no requests yet.</div></div>`
  }

  container.innerHTML = html
}

// ── Endpoint Card ─────────────────────────────────────────────

function renderEndpoint(req: any): string {
  const m = req.method || 'GET'
  const mstyle = methodStyle(m)
  const params = (req.params || []).filter((p: any) => p.key && p.enabled !== false)
  const headers = (req.headers || []).filter((h: any) => h.key && h.enabled !== false)
  const hasBody = req.bodyType && req.bodyType !== 'none'
  const hasAuth = req.auth?.type && req.auth.type !== 'none' && req.auth.type !== 'inherit'
  const epId = req.id

  // Left side
  let left = `<div class="ep-headline"><span class="ep-method" style="${mstyle}">${esc(m)}</span><span class="ep-name">${esc(req.name)}</span></div>`
  if (req.description) left += `<div class="ep-desc">${esc(req.description)}</div>`
  if (req.url) left += `<div class="ep-url"><span>${esc(req.url)}</span><button class="copy-btn" onclick="copyInline(this,'${esc(req.url)}')">Copy</button></div>`
  if (hasAuth) left += `<div class="section-label">Authorization</div>${renderAuth(req.auth)}`
  if (params.length) {
    left += `<div class="section-label">Query Parameters</div><table class="params-table"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>`
    params.forEach((p: any) => { left += `<tr><td>${esc(p.key)}</td><td>${esc(p.value)}</td></tr>` })
    left += `</tbody></table>`
  }
  if (headers.length) {
    left += `<div class="section-label">Headers</div><table class="params-table"><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>`
    headers.forEach((h: any) => { left += `<tr><td>${esc(h.key)}</td><td>${esc(h.value)}</td></tr>` })
    left += `</tbody></table>`
  }
  if (hasBody) {
    left += `<div class="section-label">Body <span style="text-transform:none;letter-spacing:0;font-weight:400">(${esc(req.bodyType)})</span></div>`
    if (req.bodyType === 'json' || req.bodyType === 'raw' || req.bodyType === 'graphql') {
      let display = req.body || ''
      if (req.bodyType === 'json') { try { display = JSON.stringify(JSON.parse(display), null, 2) } catch {} }
      left += `<div class="code-block"><pre>${esc(display)}</pre></div>`
    } else if (req.bodyType === 'form' || req.bodyType === 'urlencoded') {
      const fields = (req.bodyForm || []).filter((f: any) => f.key)
      if (fields.length) {
        left += `<table class="params-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>`
        fields.forEach((f: any) => { left += `<tr><td>${esc(f.key)}</td><td>${esc(f.value)}</td></tr>` })
        left += `</tbody></table>`
      }
    }
  }

  // Right side — code samples
  const langs = ['curl', 'javascript', 'python', 'php', 'go']
  const codeSamples: Record<string, string> = {}
  for (const lang of langs) codeSamples[lang] = buildCodeSample(req, lang)

  let right = `<div class="code-tabs" id="ct-${esc(epId)}">`
  langs.forEach((lang, i) => {
    right += `<button class="code-tab${i === 0 ? ' active' : ''}" data-lang="${lang}" onclick="switchCodeTab('${esc(epId)}','${lang}')">${langLabel(lang)}</button>`
  })
  right += `</div>`

  langs.forEach((lang, i) => {
    right += `<div class="code-block" id="cb-${esc(epId)}-${lang}" style="${i > 0 ? 'display:none' : ''}">
      <div class="code-block-header"><span>${langLabel(lang)}</span><button class="copy-btn" onclick="copyBlock('cb-${esc(epId)}-${lang}')">Copy</button></div>
      <pre>${esc(codeSamples[lang])}</pre>
    </div>`
  })

  // Try It section
  right += `<div class="try-it" id="tryit-${esc(epId)}">
    <div class="try-it-header">
      <span class="try-it-label">Try It</span>
      <button class="try-it-btn" id="tryit-btn-${esc(epId)}" onclick="sendTryIt('${esc(epId)}','${esc(m)}','${esc(req.url || '')}')">Send Request</button>
    </div>
    <div class="try-it-body">
      <input class="try-it-input" id="tryit-url-${esc(epId)}" value="${esc(req.url || '')}" placeholder="Request URL">
      ${hasBody && (req.bodyType === 'json' || req.bodyType === 'raw') ? `<textarea class="try-it-textarea" id="tryit-body-${esc(epId)}" placeholder="Request body">${esc(req.body || '')}</textarea>` : ''}
      <div id="tryit-result-${esc(epId)}"></div>
    </div>
  </div>`

  return `<div class="endpoint" id="ep-${esc(epId)}"><div class="endpoint-row"><div class="ep-left">${left}</div><div class="ep-right">${right}</div></div></div>`
}

// ── Code Samples ──────────────────────────────────────────────

function langLabel(lang: string): string {
  const labels: Record<string, string> = { curl: 'cURL', javascript: 'JavaScript', python: 'Python', php: 'PHP', go: 'Go' }
  return labels[lang] || lang
}

function buildCodeSample(req: any, lang: string): string {
  const m = req.method || 'GET'
  let url = req.url || ''
  if (!url.startsWith('http')) url = 'https://' + url
  const params = (req.params || []).filter((p: any) => p.enabled !== false && p.key)
  if (params.length) {
    const qs = params.map((p: any) => encodeURIComponent(p.key) + '=' + encodeURIComponent(p.value)).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  const hdrs = (req.headers || []).filter((h: any) => h.enabled !== false && h.key)
  if (req.bodyType === 'json' && !hdrs.find((h: any) => h.key.toLowerCase() === 'content-type')) hdrs.push({ key: 'Content-Type', value: 'application/json' })
  if (req.auth?.type === 'bearer' && req.auth.token) hdrs.push({ key: 'Authorization', value: 'Bearer ' + req.auth.token })

  const body = (m !== 'GET' && m !== 'HEAD' && (req.bodyType === 'json' || req.bodyType === 'raw') && req.body) ? req.body : ''

  switch (lang) {
    case 'curl': {
      const parts = [`curl -X ${m}`, `  '${url}'`]
      hdrs.forEach((h: any) => { parts.push(`  -H '${h.key}: ${h.value}'`) })
      if (body) parts.push(`  -d '${body.replace(/'/g, "'\\''")}'`)
      return parts.join(' \\\n')
    }
    case 'javascript': {
      let s = ''
      if (!body && !hdrs.length) {
        s = `const response = await fetch('${url}'${m !== 'GET' ? `, {\n  method: '${m}'\n}` : ''});\nconst data = await response.json();\nconsole.log(data);`
      } else {
        s = `const response = await fetch('${url}', {\n  method: '${m}',`
        if (hdrs.length) {
          s += `\n  headers: {`
          hdrs.forEach((h: any) => { s += `\n    '${h.key}': '${h.value}',` })
          s += `\n  },`
        }
        if (body) s += `\n  body: JSON.stringify(${body}),`
        s += `\n});\nconst data = await response.json();\nconsole.log(data);`
      }
      return s
    }
    case 'python': {
      let s = `import requests\n\n`
      if (hdrs.length) {
        s += `headers = {\n`
        hdrs.forEach((h: any) => { s += `    '${h.key}': '${h.value}',\n` })
        s += `}\n\n`
      }
      if (body) {
        s += `payload = ${body}\n\n`
      }
      s += `response = requests.${m.toLowerCase()}(\n    '${url}'`
      if (hdrs.length) s += `,\n    headers=headers`
      if (body) s += `,\n    json=payload`
      s += `\n)\n\nprint(response.json())`
      return s
    }
    case 'php': {
      let s = `<?php\n$ch = curl_init();\n\ncurl_setopt_array($ch, [\n    CURLOPT_URL => '${url}',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_CUSTOMREQUEST => '${m}',`
      if (hdrs.length) {
        s += `\n    CURLOPT_HTTPHEADER => [`
        hdrs.forEach((h: any) => { s += `\n        '${h.key}: ${h.value}',` })
        s += `\n    ],`
      }
      if (body) s += `\n    CURLOPT_POSTFIELDS => '${body.replace(/'/g, "\\'")}',`
      s += `\n]);\n\n$response = curl_exec($ch);\ncurl_close($ch);\n\necho $response;`
      return s
    }
    case 'go': {
      let s = `package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"net/http"\n`
      if (body) s += `\t"strings"\n`
      s += `)\n\nfunc main() {\n`
      if (body) {
        s += `\tbody := strings.NewReader(\`${body}\`)\n`
        s += `\treq, _ := http.NewRequest("${m}", "${url}", body)\n`
      } else {
        s += `\treq, _ := http.NewRequest("${m}", "${url}", nil)\n`
      }
      hdrs.forEach((h: any) => { s += `\treq.Header.Set("${h.key}", "${h.value}")\n` })
      s += `\n\tresp, _ := http.DefaultClient.Do(req)\n\tdefer resp.Body.Close()\n\n\tdata, _ := io.ReadAll(resp.Body)\n\tfmt.Println(string(data))\n}`
      return s
    }
    default:
      return ''
  }
}

// ── Code Tab Switching ────────────────────────────────────────

;(window as any).switchCodeTab = function (epId: string, lang: string) {
  const tabs = document.getElementById('ct-' + epId)
  if (!tabs) return
  tabs.querySelectorAll('.code-tab').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).getAttribute('data-lang') === lang)
  })
  const allLangs = ['curl', 'javascript', 'python', 'php', 'go']
  allLangs.forEach(l => {
    const block = document.getElementById(`cb-${epId}-${l}`)
    if (block) block.style.display = l === lang ? '' : 'none'
  })
}

// ── Try It ────────────────────────────────────────────────────

;(window as any).sendTryIt = async function (epId: string, method: string, _origUrl: string) {
  const urlInput = document.getElementById(`tryit-url-${epId}`) as HTMLInputElement
  const bodyInput = document.getElementById(`tryit-body-${epId}`) as HTMLTextAreaElement | null
  const resultDiv = document.getElementById(`tryit-result-${epId}`)
  const btn = document.getElementById(`tryit-btn-${epId}`) as HTMLButtonElement
  if (!urlInput || !resultDiv) return

  let url = urlInput.value.trim()
  if (!url) return
  if (!url.startsWith('http')) url = 'https://' + url

  btn.disabled = true
  btn.textContent = 'Sending…'
  resultDiv.innerHTML = ''

  const start = performance.now()
  try {
    const opts: RequestInit = { method, mode: 'cors' }
    if (bodyInput?.value && method !== 'GET' && method !== 'HEAD') {
      opts.body = bodyInput.value
      opts.headers = { 'Content-Type': 'application/json' }
    }
    const resp = await fetch(url, opts)
    const elapsed = Math.round(performance.now() - start)
    const text = await resp.text()
    let display = text
    try { display = JSON.stringify(JSON.parse(text), null, 2) } catch {}

    const statusClass = resp.status < 300 ? 's2xx' : resp.status < 500 ? 's4xx' : 's5xx'
    resultDiv.innerHTML = `<div class="try-it-response">
      <div class="try-it-resp-header">
        <span class="try-it-resp-status ${statusClass}">${resp.status} ${resp.statusText}</span>
        <span class="try-it-resp-time">${elapsed}ms</span>
        <button class="copy-btn" style="margin-left:auto" onclick="copyInline(this,document.getElementById('tryit-resp-body-${esc(epId)}').textContent)">Copy</button>
      </div>
      <div class="try-it-resp-body" id="tryit-resp-body-${esc(epId)}">${esc(display)}</div>
    </div>`
  } catch (err: any) {
    resultDiv.innerHTML = `<div style="color:var(--red);font-size:12px;padding:8px">Error: ${esc(err.message)}</div>`
  } finally {
    btn.disabled = false
    btn.textContent = 'Send Request'
  }
}

// ── Auth ──────────────────────────────────────────────────────

function renderAuth(auth: any): string {
  if (!auth?.type || auth.type === 'none') return ''
  if (auth.type === 'bearer') return `<div class="auth-badge">🔒 <strong>Bearer Token</strong></div>`
  if (auth.type === 'basic') return `<div class="auth-badge">🔒 <strong>Basic Auth</strong>${auth.username ? ` — ${esc(auth.username)}` : ''}</div>`
  if (auth.type === 'apikey') return `<div class="auth-badge">🔑 <strong>API Key</strong>${auth.key ? ` — ${esc(auth.key)} in ${esc(auth.in || 'header')}` : ''}</div>`
  if (auth.type === 'oauth2') return `<div class="auth-badge">🔐 <strong>OAuth 2.0</strong></div>`
  return `<div class="auth-badge">🔒 <strong>${esc(auth.type)}</strong></div>`
}

// ── Copy ──────────────────────────────────────────────────────

;(window as any).copyInline = function (btn: HTMLButtonElement, text: string) {
  navigator.clipboard.writeText(String(text)).then(() => {
    const orig = btn.textContent
    btn.textContent = 'Copied!'
    setTimeout(() => { btn.textContent = orig }, 1500)
  }).catch(() => {})
}

;(window as any).copyBlock = function (blockId: string) {
  const block = document.getElementById(blockId)
  if (!block) return
  const pre = block.querySelector('pre')
  if (!pre) return
  const btn = block.querySelector('.copy-btn') as HTMLButtonElement
  navigator.clipboard.writeText(pre.textContent || '').then(() => {
    if (btn) {
      const orig = btn.textContent
      btn.textContent = 'Copied!'
      setTimeout(() => { btn.textContent = orig }, 1500)
    }
  }).catch(() => {})
}

// ── Theme ─────────────────────────────────────────────────────

;(window as any).toggleTheme = function () {
  const html = document.documentElement
  const next = (html.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark'
  html.setAttribute('data-theme', next)
  localStorage.setItem('restify_docs_theme', next)
  const themeBtn = document.getElementById('themeBtn')
  if (themeBtn) themeBtn.textContent = next === 'dark' ? '☾' : '☀'
}

;(function initTheme() {
  const saved = localStorage.getItem('restify_docs_theme') || localStorage.getItem('restfy_docs_theme') || 'dark'
  document.documentElement.setAttribute('data-theme', saved)
  const themeBtn = document.getElementById('themeBtn')
  if (themeBtn) themeBtn.textContent = saved === 'dark' ? '☾' : '☀'
})()

loadDocs()
