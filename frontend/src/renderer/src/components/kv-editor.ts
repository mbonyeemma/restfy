/**
 * Reusable key-value editor component.
 * Handles params, headers, body-form, folder headers/vars, env vars, and global vars.
 */
import { state, makeDefaultKv } from '../modules/state'
import { escHtml } from '../modules/utils'

// ── Read KV rows from DOM ─────────────────────────────────────────

export function readKvRows(containerId: string): any[] {
  const container = document.getElementById(containerId)
  if (!container) return []
  const rows: any[] = []
  container.querySelectorAll('.kv-row').forEach(row => {
    const inputs = row.querySelectorAll<HTMLInputElement>('.kv-input')
    const cb = row.querySelector<HTMLInputElement>('.kv-enabled')
    if (inputs.length >= 2) {
      rows.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb ? cb.checked : true })
    }
  })
  return rows
}

// ── Editable row ─────────────────────────────────────────────────

export function createKvRow(
  containerId: string,
  storeKey: string,
  row: any,
  idx: number
): HTMLElement {
  const d = document.createElement('div')
  d.className = 'kv-row' + (row.enabled === false ? ' disabled' : '') + (idx % 2 === 1 ? ' kv-alt' : '')

  const isHeader = storeKey === 'headers'
  const isFormData = storeKey === 'bodyForm' && state.currentBodyType === 'form'

  let keyAttrs = `type="text" class="kv-input" placeholder="Key" value="${escHtml(row.key)}"`
  if (isHeader) keyAttrs += ` list="headerSuggestions"`

  let valueHtml = `<input type="text" class="kv-input" placeholder="Value" value="${escHtml(row.value)}"
    oninput="kvChange('${containerId}','${storeKey}',${idx},'value',this.value)">`
  if (isFormData && row.type === 'file') {
    valueHtml = `<input type="file" class="kv-input kv-file"
      onchange="kvFileChange('${containerId}','${storeKey}',${idx},this.files[0])">`
  }

  const typeSelect = isFormData
    ? `<select class="kv-type-select" onchange="kvTypeChange('${containerId}','${storeKey}',${idx},this.value)">
        <option value="text" ${row.type !== 'file' ? 'selected' : ''}>Text</option>
        <option value="file" ${row.type === 'file' ? 'selected' : ''}>File</option>
       </select>`
    : ''

  d.innerHTML = `
    <input type="checkbox" class="kv-enabled" ${row.enabled !== false ? 'checked' : ''}
      onchange="kvChange('${containerId}','${storeKey}',${idx},'enabled',this.checked)">
    <input ${keyAttrs} oninput="kvChange('${containerId}','${storeKey}',${idx},'key',this.value)">
    ${valueHtml}
    ${typeSelect}
    <button class="kv-delete" onclick="deleteKvRow('${containerId}','${storeKey}',${idx})">&times;</button>
  `
  return d
}

// ── Read-only inherited/auto row ──────────────────────────────────

export function createReadOnlyKvRow(
  key: string,
  value: string,
  fromLabel?: string
): HTMLElement {
  const d = document.createElement('div')
  d.className = 'kv-row inherited-row'
  d.innerHTML = `
    <input type="checkbox" class="kv-enabled" checked disabled>
    <input type="text" class="kv-input inherited" value="${escHtml(key)}" readonly>
    <input type="text" class="kv-input inherited" value="${escHtml(value)}" readonly>
    ${fromLabel ? `<span class="inherited-from">${escHtml(fromLabel)}</span>` : ''}
  `
  return d
}

// ── Render full KV editor ─────────────────────────────────────────

export function renderKvEditor(
  containerId: string,
  rows: any[],
  storeKey: string
): void {
  const container = document.getElementById(containerId)
  if (!container) return
  container.innerHTML = ''
  if (!rows || rows.length === 0) rows = makeDefaultKv()
  rows.forEach((row, i) => container.appendChild(createKvRow(containerId, storeKey, row, i)))
}

// ── Get live store for tab-bound KV ──────────────────────────────

export function getKvStore(storeKey: string): any[] {
  if (storeKey === 'folderHeaders' || storeKey === 'folderVars') return []
  if (!state.activeTabId || !state.tabData[state.activeTabId]) return []
  const d = state.tabData[state.activeTabId]
  if (storeKey === 'params') return d.params
  if (storeKey === 'headers') return d.headers
  if (storeKey === 'bodyForm') return d.bodyForm
  return []
}

// ── Add / Delete rows ─────────────────────────────────────────────

const FOLDER_KEYS = new Set(['folderHeaders', 'folderVars', 'cdocsVars'])

export function addKvRow(containerId: string, storeKey: string): void {
  if (FOLDER_KEYS.has(storeKey)) {
    const rows = readKvRows(containerId)
    rows.push({ key: '', value: '', enabled: true })
    renderKvEditor(containerId, rows, storeKey)
    return
  }
  if (!state.activeTabId) return
  const rows = getKvStore(storeKey)
  const newRow = { key: '', value: '', enabled: true }
  rows.push(newRow)
  const container = document.getElementById(containerId)!
  container.appendChild(createKvRow(containerId, storeKey, newRow, rows.length - 1))
}

export function deleteKvRow(containerId: string, storeKey: string, idx: number): void {
  if (FOLDER_KEYS.has(storeKey)) {
    const rows = readKvRows(containerId).filter((_, i) => i !== idx)
    if (rows.length === 0) rows.push({ key: '', value: '', enabled: true })
    renderKvEditor(containerId, rows, storeKey)
    return
  }
  const rows = getKvStore(storeKey)
  if (rows.length <= 1) {
    rows[0] = { key: '', value: '', enabled: true }
  } else {
    rows.splice(idx, 1)
  }
  renderKvEditor(containerId, rows, storeKey)
  if (storeKey === 'headers') {
    // caller (ui.ts) re-renders auto-headers and badge
    document.dispatchEvent(new CustomEvent('kv:headers-changed'))
  }
}

// ── Live mutation ─────────────────────────────────────────────────

export function kvChange(
  containerId: string,
  storeKey: string,
  idx: number,
  field: string,
  val: any
): void {
  const rows = getKvStore(storeKey)
  if (rows && rows[idx]) {
    rows[idx][field] = val
    if (field === 'enabled') {
      const row = document.getElementById(containerId)?.children[idx]
      if (row) row.classList.toggle('disabled', !val)
    }
    if (storeKey === 'headers') {
      document.dispatchEvent(new CustomEvent('kv:headers-changed'))
    }
  }
}

export function kvFileChange(
  _containerId: string,
  storeKey: string,
  idx: number,
  file: File
): void {
  const rows = getKvStore(storeKey)
  if (rows && rows[idx]) {
    rows[idx].file = file
    rows[idx].value = file ? file.name : ''
  }
}

export function kvTypeChange(
  containerId: string,
  storeKey: string,
  idx: number,
  type: string
): void {
  const rows = getKvStore(storeKey)
  if (rows && rows[idx]) {
    rows[idx].type = type
    rows[idx].value = ''
    rows[idx].file = null
    renderKvEditor(containerId, rows, storeKey)
  }
}
