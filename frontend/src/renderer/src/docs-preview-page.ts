import previewCss from './docs-preview.css?raw'
import previewRuntime from './docs-preview-runtime.js?raw'
import { buildDocsContentHtml, type PublishedDocsMeta } from './published-docs-html'

/** Stable “published” time per collection in this session — avoids preview stats jumping on every keystroke. */
let _previewMetaColId: string | null = null
let _previewMetaCreatedAt = Math.floor(Date.now() / 1000)

function ensurePreviewMetaForCol(colId: string): void {
  if (_previewMetaColId !== colId) {
    _previewMetaColId = colId
    _previewMetaCreatedAt = Math.floor(Date.now() / 1000)
  }
}

function previewMeta(): PublishedDocsMeta {
  return {
    createdAt: _previewMetaCreatedAt,
    views: 0,
    owner: { name: 'Preview' }
  }
}

/**
 * Update preview DOM without reloading the iframe (avoids layout shake in the parent).
 * Returns true if the patch ran; otherwise caller should set srcdoc.
 */
export function tryPatchDocsPreviewContent(
  frame: HTMLIFrameElement,
  col: any,
  theme: string
): boolean {
  ensurePreviewMetaForCol(col.id)
  const content = buildDocsContentHtml(col, previewMeta())
  try {
    const doc = frame.contentDocument
    if (!doc || doc.readyState !== 'complete') return false
    const root = doc.querySelector('.docs-content')
    if (!root) return false
    const safeTheme = theme === 'dark' ? 'dark' : 'light'
    doc.documentElement.setAttribute('data-theme', safeTheme)
    const scrollEl = doc.scrollingElement || doc.documentElement
    const prevScroll = scrollEl.scrollTop
    root.innerHTML = content
    scrollEl.scrollTop = prevScroll
    return true
  } catch {
    return false
  }
}

/** Full HTML document for iframe srcdoc — matches published docs layout & behavior. */
export function buildDocsPreviewSrcdoc(col: any, theme: string): string {
  ensurePreviewMetaForCol(col.id)
  const meta = previewMeta()
  const content = buildDocsContentHtml(col, meta)
  const safeTheme = theme === 'dark' ? 'dark' : 'light'
  return `<!DOCTYPE html>
<html lang="en" data-theme="${safeTheme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Published preview — Restify</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${previewCss}</style>
</head>
<body class="docs-preview-root">
<div class="docs-content">${content}</div>
<script>${previewRuntime}<\/script>
</body>
</html>`
}
