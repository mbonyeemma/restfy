/**
 * Shared HTML for published API docs (used by docs viewer + in-app preview).
 */

export function esc(s: any): string {
  return s
    ? String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    : ''
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--green)',
  POST: 'var(--yellow)',
  PUT: 'var(--blue)',
  PATCH: 'var(--purple)',
  DELETE: 'var(--red)',
  HEAD: 'var(--cyan)',
  OPTIONS: 'var(--orange)'
}
const METHOD_BG: Record<string, string> = {
  GET: 'var(--green-bg)',
  POST: 'var(--yellow-bg)',
  PUT: 'var(--blue-bg)',
  PATCH: 'var(--purple-bg)',
  DELETE: 'var(--red-bg)',
  HEAD: 'var(--cyan-bg)',
  OPTIONS: 'var(--orange-bg)'
}

export function methodStyle(m: string): string {
  return `color:${METHOD_COLOR[m] || 'var(--text-dim)'};background:${METHOD_BG[m] || 'var(--bg-hover)'}`
}

export function countAll(node: any): number {
  if (node.type === 'request') return 1
  if (!node.children) return 0
  return node.children.reduce((s: number, c: any) => s + countAll(c), 0)
}

export function allRequests(node: any, acc: any[] = []): any[] {
  if (node.type === 'request') acc.push(node)
  if (node.children) node.children.forEach((c: any) => allRequests(c, acc))
  return acc
}

export function renderAuth(auth: any): string {
  if (!auth?.type || auth.type === 'none') return ''
  if (auth.type === 'bearer') return `<div class="auth-badge">🔒 <strong>Bearer Token</strong></div>`
  if (auth.type === 'basic')
    return `<div class="auth-badge">🔒 <strong>Basic Auth</strong>${auth.username ? ` — ${esc(auth.username)}` : ''}</div>`
  if (auth.type === 'apikey')
    return `<div class="auth-badge">🔑 <strong>API Key</strong>${auth.key ? ` — ${esc(auth.key)} in ${esc(auth.in || 'header')}` : ''}</div>`
  if (auth.type === 'oauth2') return `<div class="auth-badge">🔐 <strong>OAuth 2.0</strong></div>`
  return `<div class="auth-badge">🔒 <strong>${esc(auth.type)}</strong></div>`
}

function langLabel(lang: string): string {
  const labels: Record<string, string> = {
    curl: 'cURL',
    javascript: 'JavaScript',
    python: 'Python',
    php: 'PHP',
    go: 'Go'
  }
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
  if (req.bodyType === 'json' && !hdrs.find((h: any) => h.key.toLowerCase() === 'content-type'))
    hdrs.push({ key: 'Content-Type', value: 'application/json' })
  if (req.auth?.type === 'bearer' && req.auth.token)
    hdrs.push({ key: 'Authorization', value: 'Bearer ' + req.auth.token })

  const body =
    m !== 'GET' && m !== 'HEAD' && (req.bodyType === 'json' || req.bodyType === 'raw') && req.body ? req.body : ''

  switch (lang) {
    case 'curl': {
      const parts = [`curl -X ${m}`, `  '${url}'`]
      hdrs.forEach((h: any) => {
        parts.push(`  -H '${h.key}: ${h.value}'`)
      })
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
          hdrs.forEach((h: any) => {
            s += `\n    '${h.key}': '${h.value}',`
          })
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
        hdrs.forEach((h: any) => {
          s += `    '${h.key}': '${h.value}',\n`
        })
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
        hdrs.forEach((h: any) => {
          s += `\n        '${h.key}: ${h.value}',`
        })
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
      hdrs.forEach((h: any) => {
        s += `\treq.Header.Set("${h.key}", "${h.value}")\n`
      })
      s += `\n\tresp, _ := http.DefaultClient.Do(req)\n\tdefer resp.Body.Close()\n\n\tdata, _ := io.ReadAll(resp.Body)\n\tfmt.Println(string(data))\n}`
      return s
    }
    default:
      return ''
  }
}

function renderEndpoint(req: any): string {
  const m = req.method || 'GET'
  const mstyle = methodStyle(m)
  const params = (req.params || []).filter((p: any) => p.key && p.enabled !== false)
  const headers = (req.headers || []).filter((h: any) => h.key && h.enabled !== false)
  const hasBody = req.bodyType && req.bodyType !== 'none'
  const hasAuth = req.auth?.type && req.auth.type !== 'none' && req.auth.type !== 'inherit'
  const epId = req.id

  let left = `<div class="ep-headline"><span class="ep-method" style="${mstyle}">${esc(m)}</span><span class="ep-name">${esc(req.name)}</span></div>`
  if (req.description) left += `<div class="ep-desc">${esc(req.description)}</div>`
  if (req.url)
    left += `<div class="ep-url"><span>${esc(req.url)}</span><button class="copy-btn" onclick="copyInline(this,'${esc(req.url)}')">Copy</button></div>`
  if (hasAuth) left += `<div class="section-label">Authorization</div>${renderAuth(req.auth)}`
  if (params.length) {
    left += `<div class="section-label">Query Parameters</div><table class="params-table"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>`
    params.forEach((p: any) => {
      left += `<tr><td>${esc(p.key)}</td><td>${esc(p.value)}</td></tr>`
    })
    left += `</tbody></table>`
  }
  if (headers.length) {
    left += `<div class="section-label">Headers</div><table class="params-table"><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>`
    headers.forEach((h: any) => {
      left += `<tr><td>${esc(h.key)}</td><td>${esc(h.value)}</td></tr>`
    })
    left += `</tbody></table>`
  }
  if (hasBody) {
    left += `<div class="section-label">Body <span style="text-transform:none;letter-spacing:0;font-weight:400">(${esc(req.bodyType)})</span></div>`
    if (req.bodyType === 'json' || req.bodyType === 'raw' || req.bodyType === 'graphql') {
      let display = req.body || ''
      if (req.bodyType === 'json') {
        try {
          display = JSON.stringify(JSON.parse(display), null, 2)
        } catch {
          /* keep */
        }
      }
      left += `<div class="code-block"><pre>${esc(display)}</pre></div>`
    } else if (req.bodyType === 'form' || req.bodyType === 'urlencoded') {
      const fields = (req.bodyForm || []).filter((f: any) => f.key)
      if (fields.length) {
        left += `<table class="params-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>`
        fields.forEach((f: any) => {
          left += `<tr><td>${esc(f.key)}</td><td>${esc(f.value)}</td></tr>`
        })
        left += `</tbody></table>`
      }
    }
  }

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

export interface PublishedDocsMeta {
  createdAt: number
  views?: number
  owner?: { name?: string }
}

export function buildDocsContentHtml(col: any, meta: PublishedDocsMeta): string {
  let html = ''
  const reqs = allRequests(col)
  const folderCount = (col.children || []).filter((c: any) => c.type === 'folder').length
  const desc = col.description || ''
  const published = new Date(meta.createdAt * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

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
        const fd = child.description ? `<div class="folder-desc">${esc(child.description)}</div>` : ''
        html += `<div class="folder-section">
          <div class="folder-header">
            <span class="folder-icon">📁</span>
            <span class="folder-name">${esc(child.name)}</span>
            ${auth ? `<span class="folder-auth-badge">${esc(child.auth.type)}</span>` : ''}
          </div>${fd}`
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

  return html
}
