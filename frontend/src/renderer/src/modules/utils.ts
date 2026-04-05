// ── Pure utilities (no deps) ──────────────────────────────────────

export function genId(): string {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)
}

export function escHtml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), ms)
  }
}

export function syntaxHighlight(json: string | null | undefined): string {
  if (json == null) return ''
  const s = String(json)
  let result = ''
  let lastIndex = 0
  const re = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    result += escHtml(s.slice(lastIndex, m.index))
    const match = m[0]
    let cls = 'json-number'
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'json-key' : 'json-string'
    } else if (/true|false/.test(match)) {
      cls = 'json-bool'
    } else if (/null/.test(match)) {
      cls = 'json-null'
    }
    result += '<span class="' + cls + '">' + escHtml(match) + '</span>'
    lastIndex = re.lastIndex
  }
  result += escHtml(s.slice(lastIndex))
  return result
}

export function syntaxHighlightXml(xml: string): string {
  let out = escHtml(xml)
  out = out.replace(/(&lt;\/?[\w:-]+)/g, '<span class="xml-tag">$1</span>')
  out = out.replace(/([\w:-]+)(=)(&quot;[^&]*&quot;)/g, '<span class="xml-attr">$1</span>$2<span class="xml-value">$3</span>')
  out = out.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xml-comment">$1</span>')
  return out
}

export function showNotif(msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const n = document.getElementById('notif')
  if (!n) return
  n.textContent = msg
  n.className = 'notif ' + type
  setTimeout(() => n.classList.add('show'), 10)
  setTimeout(() => n.classList.remove('show'), 2500)
}

export const _isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
export const _modKey = _isMac ? '⌘' : 'Ctrl'

export function appConfirm(
  title: string,
  message: string,
  opts?: { okLabel?: string; cancelLabel?: string; danger?: boolean }
): Promise<boolean> {
  return new Promise(resolve => {
    const overlay = document.getElementById('appDialogOverlay')!
    const titleEl = document.getElementById('appDialogTitle')!
    const bodyEl = document.getElementById('appDialogBody')!
    const footerEl = document.getElementById('appDialogFooter')!
    titleEl.textContent = title || 'Confirm'
    bodyEl.innerHTML = ''
    bodyEl.textContent = message || ''
    footerEl.innerHTML = ''
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn-secondary'
    cancelBtn.textContent = opts?.cancelLabel || 'Cancel'
    cancelBtn.onclick = () => { overlay.classList.remove('open'); resolve(false) }
    const okBtn = document.createElement('button')
    okBtn.className = opts?.danger ? 'btn-danger' : 'btn-primary'
    okBtn.textContent = opts?.okLabel || 'OK'
    okBtn.onclick = () => { overlay.classList.remove('open'); resolve(true) }
    footerEl.appendChild(cancelBtn)
    footerEl.appendChild(okBtn)
    overlay.classList.add('open')
    okBtn.focus()
    overlay.onkeydown = (e) => {
      if (e.key === 'Escape') { overlay.classList.remove('open'); resolve(false) }
    }
  })
}

export function appPrompt(
  title: string,
  message?: string,
  opts?: { placeholder?: string; defaultValue?: string; okLabel?: string; cancelLabel?: string; textarea?: boolean; allowEmpty?: boolean }
): Promise<string | null> {
  return new Promise(resolve => {
    const overlay = document.getElementById('appDialogOverlay')!
    const titleEl = document.getElementById('appDialogTitle')!
    const bodyEl = document.getElementById('appDialogBody')!
    const footerEl = document.getElementById('appDialogFooter')!
    titleEl.textContent = title || ''
    bodyEl.innerHTML = ''
    if (message) {
      const p = document.createElement('div')
      p.textContent = message
      bodyEl.appendChild(p)
    }
    const isTextarea = opts?.textarea
    const input = document.createElement(isTextarea ? 'textarea' : 'input') as HTMLInputElement
    input.className = isTextarea ? 'app-dialog-textarea' : 'app-dialog-input'
    if (!isTextarea) (input as HTMLInputElement).type = 'text'
    input.placeholder = opts?.placeholder || ''
    input.value = opts?.defaultValue || ''
    bodyEl.appendChild(input)
    footerEl.innerHTML = ''
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn-secondary'
    cancelBtn.textContent = opts?.cancelLabel || 'Cancel'
    cancelBtn.onclick = () => { overlay.classList.remove('open'); resolve(null) }
    const okBtn = document.createElement('button')
    okBtn.className = 'btn-primary'
    okBtn.textContent = opts?.okLabel || 'OK'
    const submit = () => {
      const val = input.value.trim()
      if (!val && !opts?.allowEmpty) return
      overlay.classList.remove('open')
      resolve(val)
    }
    okBtn.onclick = submit
    if (!isTextarea) input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }
    footerEl.appendChild(cancelBtn)
    footerEl.appendChild(okBtn)
    overlay.classList.add('open')
    input.focus()
    if (!isTextarea) (input as HTMLInputElement).select()
    overlay.onkeydown = (e) => {
      if (e.key === 'Escape') { overlay.classList.remove('open'); resolve(null) }
    }
  })
}

export const COMMON_HEADERS = [
  'Accept', 'Accept-Encoding', 'Accept-Language', 'Authorization',
  'Cache-Control', 'Connection', 'Content-Type', 'Cookie',
  'Host', 'If-Modified-Since', 'If-None-Match', 'Origin',
  'Referer', 'User-Agent', 'X-API-Key', 'X-CSRF-Token',
  'X-Forwarded-For', 'X-Requested-With'
]

export const COMMON_CONTENT_TYPES = [
  'application/json', 'application/xml', 'application/x-www-form-urlencoded',
  'multipart/form-data', 'text/plain', 'text/html', 'text/xml'
]
