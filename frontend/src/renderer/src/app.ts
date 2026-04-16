import { initConfigDomains } from './modules/config-domains'
import { initApiBase } from './modules/api-base'
import { state, loadState, saveState, makeCollection, clearLocalWorkspaceAndPersist } from './modules/state'
import { showNotif, appConfirm, appPrompt, _isMac, _modKey } from './modules/utils'
import {
  newTab, setActiveTab, closeTab, togglePinTab, saveCurrentTabState, renderTabs,
  duplicateTab, closeOtherTabs, renderSidebar, switchSidebarMode, toggleFolder,
  filterSidebar, openRequest, openCollectionDocs, switchCDocsTab, openFolderEditor,
  saveFolderEdits, updateFolderAuthFields, quickAddRequest, showNodeContextMenu,
  hideContextMenu, addSubfolder, startRename, doDuplicate, doDelete,
  clearHistory, getKvStore, renderKvEditor, addKvRow, deleteKvRow, kvChange,
  kvFileChange, kvTypeChange, getAuthState, updateAuthFields, fetchOAuth2Token,
  setBodyType, formatJson, beautifyResponse, updateBodyHighlight, syncBodyScroll, updateBodySize,
  updateUrlHighlight, toggleTheme, loadTheme, switchReqTab, switchRespTab,
  showWorkspace, showEmpty, updateMethodColor, copyResponse, switchResponseMode,
  showResponsePlaceholder, restoreResponse, saveCurrentResponseSnapshot, selectSavedResponse,
  openSaveModal, closeSaveModal, saveRequest,
  openEnvManager, setEnvModalTab, clearActiveEnv, closeEnvManager, renderEnvManager,
  addGlobalVar, addEnvVar, deleteEnvVar, updateEnvVar, addEnvironmentFromInput,
  renameEnv, deleteEnv, setActiveEnv, saveEnvChanges, renderEnvSelector,
  exportEnvironments, importEnvironments, hideUrlVarPopover, setupUrlVariableHover,
  setupInputVarTooltips, renderSidebarAppVersion, getAutoHeaders
} from './modules/ui'
import {
  openImport, closeImport, switchImportTab, importFromText, importFromUrl,
  handleDragOver, handleDragLeave, handleDrop, handleFileSelect, doImport,
  openCurlImport, exportCollectionAsPostman, generateCurl, openCodeGen,
  closeCodeGen, generateCodeSnippet, copyCodeGen, runCollection
} from './modules/codegen'
import { shareCollection, closeShareModal, copyShareUrl, checkAutoImport, stashSharedImportParamIfNeeded } from './modules/share'
import {
  cloudSync, isCloudLoggedIn, renderCloudStatus, openCloudModal, closeCloudModal,
  _switchCloudTab, _submitCloudAuth, _requestCloudRegisterOtp, _cloudAutoSync, cloudLogout,
  cloudForgotPassword, maybeOpenPasswordResetFromUrl,
  showAuthRequiredGate
} from './modules/cloud'
import { sendRequest, cancelRequest } from './modules/http'
import {
  openTeamsModal, closeTeamsModal, createWorkspace, createTeam, openTeamDetail,
  openWorkspaceDetail, inviteToTeam, inviteToWorkspace, removeMember, changeMemberRole, leaveTeam,
  leaveWorkspace, deleteTeam, deleteWorkspace, cancelInvite, cancelWorkspaceInvite,
  syncTeamWorkspace, maybeAcceptTeamInvite, maybeAcceptWorkspaceInvite,
  initWorkspaceBanner, toggleWsSwitcher, _closeWsSwitcher, _switchActiveWorkspace,
  inviteToActiveWorkspace, openTeamsInActiveWorkspace
} from './modules/teams'

// ── Bootstrap ─────────────────────────────────────────────────────

initConfigDomains()
initApiBase()

/** True while waiting for electron-updater response after user clicked “Check for updates”. */
let _manualUpdateCheck = false

export function checkForAppUpdates(): void {
  if (!window.electronAPI?.checkForUpdates) {
    showNotif('App updates are checked from the installed desktop app (Electron).', 'info')
    return
  }
  _manualUpdateCheck = true
  showNotif('Checking for updates…', 'info')
  void window.electronAPI
    .checkForUpdates()
    .then((r) => {
      if (r?.dev) {
        _manualUpdateCheck = false
        showNotif('Updates are only checked in packaged builds, not dev mode.', 'info')
      }
    })
    .catch(() => {
      _manualUpdateCheck = false
      showNotif('Could not reach the update server.', 'error')
    })
}

// Expose all public functions globally so HTML onclick handlers work
Object.assign(window, {
  // Tabs
  newTab, setActiveTab, closeTab, togglePinTab, saveCurrentTabState, renderTabs,
  duplicateTab, closeOtherTabs,
  // Sidebar
  renderSidebar, switchSidebarMode, toggleFolder, filterSidebar,
  openRequest, openCollectionDocs, switchCDocsTab, openFolderEditor, saveFolderEdits,
  updateFolderAuthFields, quickAddRequest, showNodeContextMenu, hideContextMenu,
  addSubfolder, startRename, doDuplicate, doDelete, clearHistory,
  // KV Editor
  getKvStore, renderKvEditor, addKvRow, deleteKvRow, kvChange, kvFileChange, kvTypeChange,
  // Auth
  getAuthState, updateAuthFields, fetchOAuth2Token,
  // Body
  setBodyType, formatJson, beautifyResponse, updateBodyHighlight, syncBodyScroll, updateBodySize,
  updateUrlHighlight,
  // Theme
  toggleTheme, loadTheme,
  // Panels
  switchReqTab, switchRespTab, showWorkspace, showEmpty,
  // Workspace
  updateMethodColor, copyResponse, switchResponseMode,
  showResponsePlaceholder, restoreResponse, saveCurrentResponseSnapshot, selectSavedResponse,
  // Save Modal
  openSaveModal, closeSaveModal, saveRequest,
  // Environments
  openEnvManager, setEnvModalTab, clearActiveEnv, closeEnvManager, renderEnvManager,
  addGlobalVar, addEnvVar, deleteEnvVar, updateEnvVar, addEnvironmentFromInput,
  renameEnv, deleteEnv, setActiveEnv, saveEnvChanges, renderEnvSelector,
  exportEnvironments, importEnvironments,
  // URL variable hover
  hideUrlVarPopover, setupUrlVariableHover, setupInputVarTooltips,
  // Version / updates
  renderSidebarAppVersion, getAutoHeaders, checkForAppUpdates,
  // Import/Export/Codegen
  openImport, closeImport, switchImportTab, importFromText, importFromUrl,
  handleDragOver, handleDragLeave, handleDrop, handleFileSelect, doImport,
  openCurlImport, exportCollectionAsPostman, generateCurl,
  openCodeGen, closeCodeGen, generateCodeSnippet, copyCodeGen, runCollection,
  // Share
  shareCollection, closeShareModal, copyShareUrl,
  // Cloud
  cloudSync, renderCloudStatus, openCloudModal, closeCloudModal,
  _switchCloudTab, _submitCloudAuth, _requestCloudRegisterOtp, _cloudAutoSync, cloudLogout,
  cloudForgotPassword,
  // Teams & workspaces
  openTeamsModal, closeTeamsModal, createWorkspace, createTeam, openTeamDetail,
  openWorkspaceDetail, inviteToTeam, inviteToWorkspace, removeMember, changeMemberRole, leaveTeam,
  leaveWorkspace, deleteTeam, deleteWorkspace, cancelInvite, cancelWorkspaceInvite,
  syncTeamWorkspace,
  // Workspace banner
  initWorkspaceBanner, toggleWsSwitcher, _closeWsSwitcher, _switchActiveWorkspace,
  inviteToActiveWorkspace, openTeamsInActiveWorkspace,
  // HTTP
  sendRequest, cancelRequest,
  // Utils (used in inline HTML)
  appConfirm, appPrompt, showNotif,
  // State (for inline globalVars mutation in env editor)
  state,
})

// ── Main init ─────────────────────────────────────────────────────

let _workspaceBootstrapped = false

async function bootstrapWorkspace(): Promise<void> {
  if (_workspaceBootstrapped) return
  await maybeAcceptTeamInvite()
  await maybeAcceptWorkspaceInvite()
  void initWorkspaceBanner()
  await loadState()

  if (state.tabs.length === 0) {
    newTab()
  } else {
    const id = state.activeTabId || state.tabs[0].id
    setActiveTab(id)
  }

  renderSidebar()
  renderEnvSelector()
  renderCloudStatus()
  renderSidebarAppVersion()
  setupUrlVariableHover()
  setupInputVarTooltips()

  // URL input watcher
  document.getElementById('urlInput')?.addEventListener('input', function(this: HTMLInputElement) {
    const t = state.tabs.find(t => t.id === state.activeTabId)
    if (t) {
      t.url = this.value
      t.name = this.value
        ? (this.value.replace(/https?:\/\//, '').split('?')[0].split('/').filter(Boolean).pop() || this.value).substring(0, 30)
        : 'New Request'
      if (state.activeTabId && state.tabData[state.activeTabId]) (state.tabData[state.activeTabId] as any).dirty = true
      renderTabs()
    }
  })

  // GraphQL textarea sync
  document.getElementById('bodyTextarea2')?.addEventListener('input', function(this: HTMLTextAreaElement) {
    const bt = document.getElementById('bodyTextarea') as HTMLTextAreaElement | null
    if (bt) { bt.value = this.value; (window as any).updateBodySize?.() }
  })
  document.getElementById('bodyTextarea')?.addEventListener('input', function(this: HTMLTextAreaElement) {
    if (state.currentBodyType === 'graphql') {
      const bt2 = document.getElementById('bodyTextarea2') as HTMLTextAreaElement | null
      if (bt2) bt2.value = this.value
    }
  })

  // Resize handle
  const handle = document.getElementById('resizeHandle')
  if (handle) {
    let dragging = false, startY = 0, startH = 0
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      dragging = true; startY = e.clientY
      startH = (document.getElementById('responseArea') as HTMLElement).offsetHeight
      document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none'
    })
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!dragging) return
      const delta = startY - e.clientY
      const newH = Math.max(100, Math.min(startH + delta, window.innerHeight - 300))
      ;(document.getElementById('responseArea') as HTMLElement).style.height = newH + 'px'
    })
    document.addEventListener('mouseup', () => {
      if (!dragging) return
      dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''
    })
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!isCloudLoggedIn()) return
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key === 'n') { e.preventDefault(); newTab() }
    if (mod && e.key === 'w') { e.preventDefault(); if (state.activeTabId) closeTab(state.activeTabId) }
    if (mod && e.key === 's') {
      e.preventDefault()
      if (state.activeTabId) saveCurrentTabState()
      saveState({ forceDisk: true })
      void cloudSync()
    }
    if (mod && e.key === 'l') { e.preventDefault(); (document.getElementById('urlInput') as HTMLInputElement)?.focus() }
    if (mod && e.key === 'Enter') { e.preventDefault(); sendRequest() }
    if (mod && e.key === 'e') { e.preventDefault(); openEnvManager() }
    if (mod && e.key === 'd') { e.preventDefault(); if (state.activeTabId) duplicateTab(state.activeTabId) }
    if (mod && e.shiftKey && e.key === 'C') { e.preventDefault(); generateCurl() }
    if (mod && e.key === 'b') { e.preventDefault(); formatJson() }
    if (e.key === 'Escape') {
      hideContextMenu()
      document.querySelectorAll<HTMLElement>('.modal-overlay.open').forEach(m => m.classList.remove('open'))
      const dlg = document.getElementById('appDialogOverlay') as HTMLElement | null
      if (dlg?.classList.contains('open')) dlg.classList.remove('open')
    }
  })

  // Environment selector change
  const envSel = document.getElementById('envSelector') as HTMLSelectElement | null
  if (envSel) {
    envSel.addEventListener('change', function(this: HTMLSelectElement) {
      state.activeEnvId = this.value === '' ? null : this.value
      saveState()
      hideUrlVarPopover()
    })
  }

  // Auto-save on interval
  setInterval(() => {
    if (state.activeTabId) saveCurrentTabState()
    saveState()
  }, 30000)

  // Save on unload
  window.addEventListener('beforeunload', () => {
    if (state.activeTabId) saveCurrentTabState()
    saveState({ forceDisk: true })
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (state.activeTabId) saveCurrentTabState()
      saveState({ forceDisk: true })
    }
  })

  // Electron auto-updater
  setupElectronUpdateListener()

  // Auto-import from URL ?import=id
  checkAutoImport()

  // Create new collection
  ;(window as any).createNewCollection = async () => {
    const name = await appPrompt('New collection', 'Enter a name for the new collection.', { placeholder: 'My Collection' })
    if (!name) return
    const col = makeCollection({ name })
    state.collections.push(col)
    state.openFolders.add(col.id)
    saveState(); renderSidebar()
  }

  _workspaceBootstrapped = true
}

;(window as any).bootstrapWorkspaceAfterLogin = async () => {
  await bootstrapWorkspace()
}

async function init() {
  loadTheme()
  await maybeOpenPasswordResetFromUrl()
  stashSharedImportParamIfNeeded()
  if (!isCloudLoggedIn()) {
    clearLocalWorkspaceAndPersist()
    showAuthRequiredGate()
    return
  }
  await bootstrapWorkspace()
}

function setupElectronUpdateListener() {
  if (!window.electronAPI?.onUpdateStatus) return
  window.electronAPI.onUpdateStatus((p) => {
    if (!p?.event) return
    if (p.event === 'available') {
      _manualUpdateCheck = false
      showNotif('Update v' + (p.version || '') + ' is downloading…', 'info')
    } else if (p.event === 'downloaded') {
      const v = p.version ? ' version ' + p.version : ''
      appConfirm('Update ready', 'Restart Restify to finish installing' + v + '.', { okLabel: 'Restart now', cancelLabel: 'Later' }).then(ok => {
        if (ok && window.electronAPI?.quitAndInstall) window.electronAPI.quitAndInstall()
      })
    } else if (p.event === 'none' && _manualUpdateCheck) {
      _manualUpdateCheck = false; showNotif('You\'re on the latest version.', 'info')
    } else if (p.event === 'error' && _manualUpdateCheck) {
      _manualUpdateCheck = false; showNotif('Update check failed: ' + (p.message || 'unknown error'), 'error')
    }
  })
}

init().catch(console.error)
