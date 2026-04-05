/**
 * Reusable context menu component.
 * Builds, positions, and hides the shared #contextMenu element.
 */

export interface CtxItem {
  label: string
  /** A JS expression string (e.g. "openRequest('id'); hideContextMenu()") */
  action: string
  danger?: boolean
}

export type CtxEntry = CtxItem | 'separator'

export function buildCtxHtml(items: CtxEntry[]): string {
  return items
    .map(item => {
      if (item === 'separator') return '<div class="ctx-sep"></div>'
      return `<div class="ctx-item${item.danger ? ' ctx-danger' : ''}" onclick="${item.action}">${item.label}</div>`
    })
    .join('')
}

export function showCtxMenu(e: MouseEvent, items: CtxEntry[]): void {
  const menu = document.getElementById('contextMenu')
  if (!menu) return
  menu.innerHTML = buildCtxHtml(items)
  positionContextMenu(menu, e)
}

export function positionContextMenu(menu: HTMLElement, e: MouseEvent): void {
  menu.style.display = 'block'
  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px'
  menu.style.top = Math.min(e.clientY, window.innerHeight - 300) + 'px'
  setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 0)
}

export function hideContextMenu(): void {
  const menu = document.getElementById('contextMenu')
  if (menu) menu.style.display = 'none'
}
