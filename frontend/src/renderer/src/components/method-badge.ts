/**
 * Renders an HTTP method badge.
 * Used in tabs, sidebar tree, history list, and collection docs cards.
 */

export type BadgeVariant = 'tree' | 'tab' | 'card'

export function methodBadge(method: string, variant: BadgeVariant = 'tree'): string {
  const m = (method || 'GET').toUpperCase()
  if (variant === 'tab') {
    return `<span class="tab-method m-${m}">${m}</span>`
  }
  return `<span class="req-method-badge m-${m} bg-${m}">${m}</span>`
}

export function methodBadgeEl(method: string): HTMLElement {
  const span = document.createElement('span')
  const m = (method || 'GET').toUpperCase()
  span.className = `req-method-badge m-${m} bg-${m}`
  span.textContent = m
  return span
}
