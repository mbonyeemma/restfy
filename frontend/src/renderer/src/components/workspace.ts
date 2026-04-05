/**
 * Main workspace panel switcher.
 * The app has four mutually exclusive main views; this component manages them.
 */

export type MainView = 'workspace' | 'empty' | 'folder-editor' | 'collection-docs'

const VIEW_PANELS: Record<MainView, { id: string; display: string }> = {
  workspace: { id: 'requestWorkspace', display: 'flex' },
  empty: { id: 'emptyState', display: 'flex' },
  'folder-editor': { id: 'folderEditor', display: 'flex' },
  'collection-docs': { id: 'collectionDocs', display: 'flex' }
}

export function setMainView(view: MainView): void {
  Object.entries(VIEW_PANELS).forEach(([key, { id, display }]) => {
    const el = document.getElementById(id)
    if (el) el.style.display = key === view ? display : 'none'
  })
}
