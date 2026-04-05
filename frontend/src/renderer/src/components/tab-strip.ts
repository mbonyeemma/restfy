/**
 * Generic tab-strip + panel switcher.
 * Works for request tabs, response tabs, collection-docs tabs, etc.
 */

export interface TabStripOptions {
  /** CSS selector for all tab buttons */
  tabSelector: string
  /** data-* attribute that holds the tab key */
  tabAttr?: string
  /** CSS selector for all panels — optional, skip if you handle panels yourself */
  panelSelector?: string
  /** How to map key → active panel: 'id' means panel id must equal key, 'suffix' means panel id ends with key */
  panelMatch?: 'id' | 'suffix'
}

export function activateTabStrip(key: string, opts: TabStripOptions): void {
  const { tabSelector, tabAttr = 'data-tab', panelSelector, panelMatch = 'id' } = opts

  document.querySelectorAll<HTMLElement>(tabSelector).forEach(t =>
    t.classList.toggle('active', t.getAttribute(tabAttr) === key)
  )

  if (panelSelector) {
    document.querySelectorAll<HTMLElement>(panelSelector).forEach(p => {
      const match = panelMatch === 'suffix' ? p.id.endsWith(key) : p.id === key
      p.classList.toggle('active', match)
    })
  }
}

/** Simpler helper when you just need to toggle active class on tabs by a data attribute */
export function setActiveTabBtn(selector: string, key: string, attr = 'data-tab'): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(t =>
    t.classList.toggle('active', t.getAttribute(attr) === key)
  )
}
