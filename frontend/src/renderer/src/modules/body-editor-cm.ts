/**
 * CodeMirror 6 body editor for JSON / raw — real syntax highlighting without
 * the transparent-textarea overlay (which breaks editing on Electron/macOS).
 */
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, type Extension } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

let view: EditorView | null = null

const restifyJsonHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--cm-json-key)' },
  { tag: tags.string, color: 'var(--cm-json-string)' },
  { tag: tags.number, color: 'var(--cm-json-number)' },
  { tag: tags.bool, color: 'var(--cm-json-bool)' },
  { tag: tags.null, color: 'var(--cm-json-null)' },
  { tag: tags.bracket, color: 'var(--cm-json-punct)' },
  { tag: tags.separator, color: 'var(--cm-json-punct)' }
])

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontWeight: '300' },
  '.cm-editor': { height: '100%' },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '13px',
    fontWeight: '300',
    lineHeight: 1.6
  },
  '.cm-content': { caretColor: 'var(--text-primary)' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-dark)',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-dim)'
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' }
})

/**
 * Tear down the CodeMirror view without writing to the hidden textarea.
 * Call `syncBodyEditorToTextarea()` first when you need to persist the doc
 * (e.g. before switching body type away from JSON, or in saveCurrentTabState).
 */
export function destroyBodyEditor(): void {
  if (view) {
    view.destroy()
    view = null
  }
}

export function mountBodyEditor(
  host: HTMLElement,
  doc: string,
  mode: 'json' | 'raw',
  onDocChange?: () => void
): void {
  destroyBodyEditor()

  const extensions: Extension[] = [
    basicSetup,
    EditorView.lineWrapping,
    baseTheme,
    EditorView.updateListener.of((u) => {
      if (u.docChanged && onDocChange) onDocChange()
    })
  ]

  if (mode === 'json') {
    extensions.push(json())
    extensions.push(syntaxHighlighting(restifyJsonHighlight, { fallback: true }))
  }

  const state = EditorState.create({ doc, extensions })
  view = new EditorView({ state, parent: host })
}

export function isBodyEditorActive(): boolean {
  return view !== null
}

export function getBodyEditorText(): string {
  if (view) return view.state.doc.toString()
  const ta = document.getElementById('bodyTextarea') as HTMLTextAreaElement | null
  return ta?.value ?? ''
}

/** Sync CodeMirror doc into the hidden textarea (for GraphQL sync and safety). */
export function syncBodyEditorToTextarea(): void {
  const ta = document.getElementById('bodyTextarea') as HTMLTextAreaElement | null
  if (!ta || !view) return
  ta.value = view.state.doc.toString()
}

export function setBodyEditorText(doc: string): void {
  if (!view) {
    const ta = document.getElementById('bodyTextarea') as HTMLTextAreaElement | null
    if (ta) ta.value = doc
    return
  }
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc }
  })
}

/**
 * Rebuild the JSON/raw editor. Pass `doc` when loading a tab so the document
 * always matches `state.tabData` (never rely on textarea alone during tab switches).
 */
export function refreshBodyEditor(mode: 'json' | 'raw', doc?: string): void {
  const ta = document.getElementById('bodyTextarea') as HTMLTextAreaElement | null
  const host = document.getElementById('bodyCmRoot') as HTMLElement | null
  if (!ta || !host) return
  const text = doc !== undefined ? doc : ta.value
  ta.value = text
  destroyBodyEditor()
  host.innerHTML = ''
  mountBodyEditor(host, text, mode, () => {
    syncBodyEditorToTextarea()
    ;(window as any).updateBodySize?.()
  })
  syncBodyEditorToTextarea()
}
