import { state, saveState } from './state'
import { escHtml, showNotif, appPrompt, appConfirm } from './utils'

let _teams: any[] = []
let _workspaces: any[] = []
let _activeTeamId: string | null = null
let _teamDetail: any = null
let _workspaceDetail: any = null

function _cloudHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const sess = localStorage.getItem('restify_cloud_session') || localStorage.getItem('restfy_cloud_session')
  if (sess) {
    try {
      const parsed = JSON.parse(sess)
      if (parsed.token) h['Authorization'] = 'Bearer ' + parsed.token
    } catch {}
  }
  return h
}

function _cloudToken(): string | null {
  const sess = localStorage.getItem('restify_cloud_session') || localStorage.getItem('restfy_cloud_session')
  if (!sess) return null
  try {
    return JSON.parse(sess).token || null
  } catch {
    return null
  }
}

function cloudBase(): string {
  const u = localStorage.getItem('restify_cloud_url') || localStorage.getItem('restfy_cloud_url')
  const t = u && String(u).trim()
  if (t) return String(t).replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const w = (window as any).__RESTIFY_API_BASE__ ?? (window as any).__RESTFY_API_BASE__
    if (w != null && String(w).trim() !== '') return String(w).trim().replace(/\/+$/, '')
  }
  return 'https://api.restify.online'
}

function teamApiUrl(path: string): string {
  const p = path.charAt(0) === '/' ? path : '/' + path
  return cloudBase() + p
}

// ── Open / Close ──────────────────────────────────────────────

export function openTeamsModal(): void {
  if (!_cloudToken()) {
    showNotif('Sign in to Restify Cloud to use Teams', 'info')
    return
  }
  _teamDetail = null
  _workspaceDetail = null
  _renderTeamsList()
  document.getElementById('teamsModal')?.classList.add('open')
  void loadTeamsAndWorkspaces()
}

export function closeTeamsModal(): void {
  document.getElementById('teamsModal')?.classList.remove('open')
}

// ── Load teams ────────────────────────────────────────────────

async function loadTeamsAndWorkspaces(): Promise<void> {
  try {
    const [teamsResp, wsResp] = await Promise.all([
      fetch(teamApiUrl('/api/teams'), { credentials: 'include', headers: _cloudHeaders() }),
      fetch(teamApiUrl('/api/workspaces'), { credentials: 'include', headers: _cloudHeaders() }),
    ])
    if (!teamsResp.ok) throw new Error('Failed to load teams')
    if (!wsResp.ok) throw new Error('Failed to load workspaces')
    const teamsData = await teamsResp.json()
    const wsData = await wsResp.json()
    _teams = teamsData.teams || []
    _workspaces = wsData.workspaces || []
    if (_workspaces.length > 0) {
      const still = _workspaces.find((w: any) => w.id === _activeWorkspaceId)
      if (!still) _persistActiveWorkspace(_workspaces[0].id)
    }
    _renderTeamsList()
    _renderWorkspaceBanner()
  } catch (err: any) {
    showNotif('Could not load teams: ' + err.message, 'error')
  }
}

// ── Create team ───────────────────────────────────────────────

export async function createWorkspace(): Promise<void> {
  const name = await appPrompt('Create Workspace', 'Enter a name for your organization (workspace).', {
    placeholder: 'My Company',
    okLabel: 'Create',
  })
  if (!name?.trim()) return
  try {
    const resp = await fetch(teamApiUrl('/api/workspaces'), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ name: name.trim() }),
    })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}))
      throw new Error((d as any).error || 'Failed to create workspace')
    }
    showNotif('Workspace created', 'success')
    void loadTeamsAndWorkspaces()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

export async function createTeam(workspaceId?: string): Promise<void> {
  let wsId = workspaceId
  if (!wsId) {
    if (_workspaces.length === 1) {
      wsId = _workspaces[0].id
    } else {
      showNotif('Choose a workspace and use “New team” under it, or create a workspace first.', 'info')
      return
    }
  }
  const name = await appPrompt('Create Team', 'Enter a name for your team.', {
    placeholder: 'My Team',
    okLabel: 'Create',
  })
  if (!name?.trim()) return
  try {
    const resp = await fetch(teamApiUrl('/api/teams'), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ name: name.trim(), workspaceId: wsId }),
    })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}))
      throw new Error((d as any).error || 'Failed to create team')
    }
    showNotif('Team created', 'success')
    void loadTeamsAndWorkspaces()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Team detail ───────────────────────────────────────────────

export async function openTeamDetail(teamId: string): Promise<void> {
  try {
    const resp = await fetch(teamApiUrl(`/api/teams/${teamId}`), {
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed to load team')
    _teamDetail = await resp.json()
    _workspaceDetail = null
    _renderTeamDetail()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Workspace detail ──────────────────────────────────────────

export async function openWorkspaceDetail(workspaceId: string): Promise<void> {
  try {
    const resp = await fetch(teamApiUrl(`/api/workspaces/${workspaceId}`), {
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed to load workspace')
    _workspaceDetail = await resp.json()
    _teamDetail = null
    _renderWorkspaceDetail()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

export async function inviteToWorkspace(workspaceId: string): Promise<void> {
  const email = await appPrompt('Invite to workspace', 'Enter the email address to invite to this organization.', {
    placeholder: 'colleague@example.com',
    okLabel: 'Send Invite',
  })
  if (!email?.trim()) return
  try {
    const resp = await fetch(teamApiUrl(`/api/workspaces/${workspaceId}/invite`), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ email: email.trim(), role: 'member' }),
    })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}))
      throw new Error((d as any).error || 'Failed to invite')
    }
    showNotif('Invitation sent', 'success')
    void openWorkspaceDetail(workspaceId)
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

export async function cancelWorkspaceInvite(workspaceId: string, inviteId: string): Promise<void> {
  try {
    const resp = await fetch(teamApiUrl(`/api/workspaces/${workspaceId}/invites/${inviteId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed')
    showNotif('Invite cancelled', 'success')
    void openWorkspaceDetail(workspaceId)
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

export async function leaveWorkspace(workspaceId: string, workspaceName: string): Promise<void> {
  const ok = await appConfirm(
    'Leave workspace',
    `Leave "${workspaceName}"? You will lose access to its teams and shared data.`
  )
  if (!ok) return
  try {
    const resp = await fetch(teamApiUrl(`/api/workspaces/${workspaceId}/leave`), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed to leave workspace')
    showNotif('Left workspace', 'success')
    _workspaceDetail = null
    void loadTeamsAndWorkspaces()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

export async function deleteWorkspace(workspaceId: string, workspaceName: string): Promise<void> {
  const ok = await appConfirm(
    'Delete workspace',
    `Delete "${workspaceName}"? This removes all teams and shared data in this organization.`,
    { danger: true, okLabel: 'Delete' }
  )
  if (!ok) return
  try {
    const resp = await fetch(teamApiUrl(`/api/workspaces/${workspaceId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed to delete workspace')
    showNotif('Workspace deleted', 'success')
    _workspaceDetail = null
    void loadTeamsAndWorkspaces()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Invite ────────────────────────────────────────────────────

export async function inviteToTeam(teamId: string): Promise<void> {
  const email = await appPrompt('Invite Member', 'Enter the email address of the person to invite.', {
    placeholder: 'teammate@example.com',
    okLabel: 'Send Invite',
  })
  if (!email?.trim()) return
  try {
    const resp = await fetch(teamApiUrl(`/api/teams/${teamId}/invite`), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ email: email.trim(), role: 'member' }),
    })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}))
      throw new Error((d as any).error || 'Failed to invite')
    }
    showNotif('Invitation sent', 'success')
    void openTeamDetail(teamId)
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Accept invite from URL ────────────────────────────────────

export async function maybeAcceptTeamInvite(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(window.location.href)
    const token = u.searchParams.get('teamInvite')
    if (!token) return
    u.searchParams.delete('teamInvite')
    window.history.replaceState({}, '', u.pathname + u.search + u.hash)

    if (!_cloudToken()) {
      showNotif('Sign in first, then use the invite link again.', 'info')
      return
    }

    const resp = await fetch(teamApiUrl('/api/teams/accept-invite'), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ token }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      showNotif((data as any).error || 'Invalid invite', 'error')
      return
    }
    if ((data as any).team) {
      showNotif(`You joined team "${(data as any).team.name}"!`, 'success')
    } else {
      showNotif('Invite accepted', 'success')
    }
    void loadTeamsAndWorkspaces()
  } catch {
    showNotif('Failed to process invite', 'error')
  }
}

export async function maybeAcceptWorkspaceInvite(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(window.location.href)
    const token = u.searchParams.get('workspaceInvite')
    if (!token) return
    u.searchParams.delete('workspaceInvite')
    window.history.replaceState({}, '', u.pathname + u.search + u.hash)

    if (!_cloudToken()) {
      showNotif('Sign in first, then use the invite link again.', 'info')
      return
    }

    const resp = await fetch(teamApiUrl('/api/workspaces/accept-invite'), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ token }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      showNotif((data as any).error || 'Invalid invite', 'error')
      return
    }
    if ((data as any).workspace) {
      showNotif(`You joined workspace "${(data as any).workspace.name}"!`, 'success')
    } else {
      showNotif('Invite accepted', 'success')
    }
    void loadTeamsAndWorkspaces()
  } catch {
    showNotif('Failed to process invite', 'error')
  }
}

// ── Remove member ─────────────────────────────────────────────

export async function removeMember(teamId: string, userId: string, name: string): Promise<void> {
  const ok = await appConfirm('Remove member', `Remove ${name} from this team?`)
  if (!ok) return
  try {
    const resp = await fetch(teamApiUrl(`/api/teams/${teamId}/members/${userId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}))
      throw new Error((d as any).error || 'Failed')
    }
    showNotif('Member removed', 'success')
    void openTeamDetail(teamId)
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Change role ───────────────────────────────────────────────

export async function changeMemberRole(teamId: string, userId: string, newRole: string): Promise<void> {
  try {
    const resp = await fetch(teamApiUrl(`/api/teams/${teamId}/members/${userId}`), {
      method: 'PATCH',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ role: newRole }),
    })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}))
      throw new Error((d as any).error || 'Failed')
    }
    showNotif('Role updated', 'success')
    void openTeamDetail(teamId)
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Leave team ────────────────────────────────────────────────

export async function leaveTeam(teamId: string, teamName: string): Promise<void> {
  const ok = await appConfirm(
    'Leave team',
    `Leave "${teamName}"? You will lose access to shared collections.`
  )
  if (!ok) return
  try {
    const resp = await fetch(teamApiUrl(`/api/teams/${teamId}/leave`), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed to leave team')
    showNotif('Left team', 'success')
    _teamDetail = null
    void loadTeamsAndWorkspaces()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Delete team ───────────────────────────────────────────────

export async function deleteTeam(teamId: string, teamName: string): Promise<void> {
  const ok = await appConfirm(
    'Delete team',
    `Delete "${teamName}"? This cannot be undone. All team collections and environments will be deleted.`,
    { danger: true, okLabel: 'Delete' }
  )
  if (!ok) return
  try {
    const resp = await fetch(teamApiUrl(`/api/teams/${teamId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed to delete team')
    showNotif('Team deleted', 'success')
    _teamDetail = null
    void loadTeamsAndWorkspaces()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Cancel invite ─────────────────────────────────────────────

export async function cancelInvite(teamId: string, inviteId: string): Promise<void> {
  try {
    const resp = await fetch(teamApiUrl(`/api/teams/${teamId}/invites/${inviteId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed')
    showNotif('Invite cancelled', 'success')
    void openTeamDetail(teamId)
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Team Sync ─────────────────────────────────────────────────

export async function syncTeamWorkspace(teamId: string): Promise<void> {
  if (!_cloudToken()) return
  try {
    const colResp = await fetch(teamApiUrl(`/api/teams/${teamId}/collections/sync`), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ collections: state.collections }),
    })
    if (!colResp.ok) throw new Error('Sync failed')
    const colData = await colResp.json()

    const envResp = await fetch(teamApiUrl(`/api/teams/${teamId}/environments/sync`), {
      method: 'POST',
      credentials: 'include',
      headers: _cloudHeaders(),
      body: JSON.stringify({ environments: state.environments, globalVars: state.globalVars }),
    })
    const envData = await envResp.json()

    if (colData.collections) {
      state.collections.length = 0
      colData.collections.forEach((c: any) => { delete c._syncedAt; state.collections.push(c) })
    }
    if (envData.environments) {
      state.environments.length = 0
      envData.environments.forEach((e: any) => { delete e._syncedAt; state.environments.push(e) })
    }
    if (envData.globalVars) {
      state.globalVars.length = 0
      envData.globalVars.forEach((v: any) => state.globalVars.push(v))
    }

    saveState()
    if (typeof (window as any).renderSidebar === 'function') (window as any).renderSidebar()
    if (typeof (window as any).renderEnvSelector === 'function') (window as any).renderEnvSelector()
    showNotif('Team workspace synced', 'success')
  } catch (err: any) {
    showNotif('Team sync error: ' + err.message, 'error')
  }
}

// ── Render: Teams List ────────────────────────────────────────

function _renderTeamsList(): void {
  const body = document.getElementById('teamsModalBody')
  const title = document.getElementById('teamsModalTitle')
  if (!body || !title) return

  if (_workspaceDetail) {
    _renderWorkspaceDetail()
    return
  }
  if (_teamDetail) {
    _renderTeamDetail()
    return
  }

  title.textContent = 'Teams & Workspaces'

  if (_workspaces.length === 0) {
    body.innerHTML = `
      <div class="teams-list">
        <div style="text-align:center;padding:32px 0;color:var(--text-dim)">
          <div style="font-size:36px;opacity:.25;margin-bottom:12px">🏢</div>
          <div style="font-size:14px;font-weight:500;margin-bottom:6px;color:var(--text-secondary)">No workspace yet</div>
          <div style="font-size:12px;margin-bottom:16px">Create an organization (workspace), then add teams to share collections.</div>
          <button class="btn-primary" onclick="createWorkspace()">+ Create Workspace</button>
        </div>
      </div>`
    return
  }

  let html = `<div class="teams-list">
    <div class="teams-list-header">
      <h3>Your workspaces</h3>
      <button class="btn-primary" style="font-size:12px;padding:5px 14px" onclick="createWorkspace()">+ New Workspace</button>
    </div>`

  for (const ws of _workspaces) {
    const wsTeams = _teams.filter((t: any) => t.workspace_id === ws.id)
    const wInitial = (ws.name || '?').charAt(0).toUpperCase()
    html += `<div class="workspace-block" style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div class="team-card" style="border:none;border-radius:0" onclick="openWorkspaceDetail('${escHtml(ws.id)}')">
        <div class="team-card-icon">${wInitial}</div>
        <div class="team-card-info">
          <div class="team-card-name">${escHtml(ws.name)}</div>
          <div class="team-card-meta">${ws.member_count || 1} org member${(ws.member_count || 1) !== 1 ? 's' : ''}</div>
        </div>
        <span class="team-card-role">${escHtml(ws.role)}</span>
      </div>
      <div style="padding:8px 12px 12px;background:var(--bg-mid);border-top:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase">Teams</span>
          <button class="btn-text" style="font-size:12px" onclick="event.stopPropagation();createTeam('${escHtml(ws.id)}')">+ New team</button>
        </div>`
    if (wsTeams.length === 0) {
      html += `<div style="font-size:12px;color:var(--text-dim);padding:4px 0">No teams yet — create one to collaborate.</div>`
    } else {
      for (const t of wsTeams) {
        const initial = (t.name || '?').charAt(0).toUpperCase()
        html += `<div class="team-card" style="margin-bottom:6px" onclick="event.stopPropagation();openTeamDetail('${escHtml(t.id)}')">
          <div class="team-card-icon" style="width:32px;height:32px;font-size:13px">${initial}</div>
          <div class="team-card-info">
            <div class="team-card-name">${escHtml(t.name)}</div>
            <div class="team-card-meta">${t.member_count || 1} member${(t.member_count || 1) !== 1 ? 's' : ''}</div>
          </div>
          <span class="team-card-role">${escHtml(t.role)}</span>
        </div>`
      }
    }
    html += '</div></div>'
  }
  html += '</div>'
  body.innerHTML = html
}

function _renderWorkspaceDetail(): void {
  const body = document.getElementById('teamsModalBody')
  const title = document.getElementById('teamsModalTitle')
  if (!body || !title || !_workspaceDetail) return

  const ws = _workspaceDetail.workspace
  const members: any[] = _workspaceDetail.members || []
  const invites: any[] = _workspaceDetail.pendingInvites || []
  const teams: any[] = _workspaceDetail.teams || []
  const myRole: string = _workspaceDetail.myRole
  const canManage = myRole === 'owner' || myRole === 'admin'

  title.textContent = ws.name

  let html = `<div class="team-detail">
    <div class="team-detail-header">
      <button class="team-detail-back" onclick="openTeamsModal()" title="Back">←</button>
      <div class="team-detail-name">${escHtml(ws.name)}</div>
      <span class="team-card-role">${escHtml(myRole)}</span>
    </div>
    <div style="font-size:11px;color:var(--text-dim);margin:-4px 0 12px 28px">Organization · ${teams.length} team${teams.length !== 1 ? 's' : ''}</div>

    <div class="team-section">
      <div class="team-section-title">
        <span>Members (${members.length})</span>
        ${canManage ? `<button class="btn-text" onclick="inviteToWorkspace('${escHtml(ws.id)}')">+ Invite</button>` : ''}
      </div>`

  for (const m of members) {
    const initial = (m.name || m.email || '?').charAt(0).toUpperCase()
    const roleClass = m.role === 'owner' ? ' owner' : ''
    html += `<div class="team-member-row">
      <div class="team-member-avatar">${initial}</div>
      <div class="team-member-info">
        <div class="team-member-name">${escHtml(m.name || 'Unnamed')}</div>
        <div class="team-member-email">${escHtml(m.email)}</div>
      </div>
      <span class="team-member-role${roleClass}">${escHtml(m.role)}</span>
    </div>`
  }
  html += '</div>'

  if (invites.length > 0) {
    html += `<div class="team-section">
      <div class="team-section-title"><span>Pending invitations (${invites.length})</span></div>`
    for (const inv of invites) {
      html += `<div class="team-invite-row">
        <span class="team-invite-email">✉ ${escHtml(inv.email)}</span>
        <span class="team-member-role">${escHtml(inv.role)}</span>
        ${canManage ? `<button class="btn-text ctx-danger" onclick="cancelWorkspaceInvite('${escHtml(ws.id)}','${escHtml(inv.id)}')" title="Cancel">✕</button>` : ''}
      </div>`
    }
    html += '</div>'
  }

  html += `<div class="team-section">
    <div class="team-section-title">
      <span>Teams (${teams.length})</span>
      ${['owner', 'admin', 'member'].includes(myRole) ? `<button class="btn-text" onclick="createTeam('${escHtml(ws.id)}')">+ New team</button>` : ''}
    </div>`
  for (const t of teams) {
    const initial = (t.name || '?').charAt(0).toUpperCase()
    html += `<div class="team-card" onclick="openTeamDetail('${escHtml(t.id)}')">
      <div class="team-card-icon" style="width:32px;height:32px;font-size:13px">${initial}</div>
      <div class="team-card-info">
        <div class="team-card-name">${escHtml(t.name)}</div>
        <div class="team-card-meta">${t.member_count || 1} member${(t.member_count || 1) !== 1 ? 's' : ''}</div>
      </div>
    </div>`
  }
  if (teams.length === 0) {
    html += `<div style="font-size:12px;color:var(--text-dim)">No teams yet.</div>`
  }
  html += '</div>'

  html += `<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:12px;display:flex;gap:8px">`
  if (myRole !== 'owner') {
    html += `<button class="btn-secondary" style="color:var(--red);border-color:var(--red);flex:1" onclick="leaveWorkspace('${escHtml(ws.id)}','${escHtml(ws.name)}')">Leave workspace</button>`
  }
  if (myRole === 'owner') {
    html += `<button class="btn-secondary" style="color:var(--red);border-color:var(--red);flex:1" onclick="deleteWorkspace('${escHtml(ws.id)}','${escHtml(ws.name)}')">Delete workspace</button>`
  }
  html += '</div></div>'

  body.innerHTML = html
}

// ── Render: Team Detail ───────────────────────────────────────

function _renderTeamDetail(): void {
  const body = document.getElementById('teamsModalBody')
  const title = document.getElementById('teamsModalTitle')
  if (!body || !title || !_teamDetail) return

  const team = _teamDetail.team
  const members: any[] = _teamDetail.members || []
  const invites: any[] = _teamDetail.pendingInvites || []
  const myRole: string = _teamDetail.myRole
  const canManage = myRole === 'owner' || myRole === 'admin'

  title.textContent = team.name

  const wsLabel = team.workspace_name
    ? `<div style="font-size:11px;color:var(--text-dim);margin:-4px 0 8px 28px">${escHtml(team.workspace_name)}</div>`
    : ''

  let html = `<div class="team-detail">
    <div class="team-detail-header">
      <button class="team-detail-back" onclick="openTeamsModal()" title="Back to teams">←</button>
      <div class="team-detail-name">${escHtml(team.name)}</div>
      <span class="team-card-role">${escHtml(myRole)}</span>
    </div>
    ${wsLabel}

    <button class="team-workspace-btn" onclick="syncTeamWorkspace('${escHtml(team.id)}'); closeTeamsModal()">↻ Sync Team Workspace</button>

    <div class="team-section">
      <div class="team-section-title">
        <span>Members (${members.length})</span>
        ${canManage ? `<button class="btn-text" onclick="inviteToTeam('${escHtml(team.id)}')">+ Invite</button>` : ''}
      </div>`

  for (const m of members) {
    const initial = (m.name || m.email || '?').charAt(0).toUpperCase()
    const roleClass = m.role === 'owner' ? ' owner' : ''
    html += `<div class="team-member-row">
      <div class="team-member-avatar">${initial}</div>
      <div class="team-member-info">
        <div class="team-member-name">${escHtml(m.name || 'Unnamed')}</div>
        <div class="team-member-email">${escHtml(m.email)}</div>
      </div>
      <span class="team-member-role${roleClass}">${escHtml(m.role)}</span>`

    if (canManage && m.role !== 'owner' && myRole === 'owner') {
      html += `<select style="font-size:10px;background:var(--bg-mid);border:1px solid var(--border);border-radius:4px;color:var(--text-secondary);padding:2px 4px;cursor:pointer" onchange="changeMemberRole('${escHtml(team.id)}','${escHtml(m.user_id)}',this.value)">
        <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option>
        <option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option>
        <option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>Viewer</option>
      </select>
      <button class="btn-text ctx-danger" onclick="removeMember('${escHtml(team.id)}','${escHtml(m.user_id)}','${escHtml(m.name || m.email)}')" title="Remove">✕</button>`
    }
    html += '</div>'
  }
  html += '</div>'

  if (invites.length > 0) {
    html += `<div class="team-section">
      <div class="team-section-title"><span>Pending Invitations (${invites.length})</span></div>`
    for (const inv of invites) {
      html += `<div class="team-invite-row">
        <span class="team-invite-email">✉ ${escHtml(inv.email)}</span>
        <span class="team-member-role">${escHtml(inv.role)}</span>
        ${canManage ? `<button class="btn-text ctx-danger" onclick="cancelInvite('${escHtml(team.id)}','${escHtml(inv.id)}')" title="Cancel invite">✕</button>` : ''}
      </div>`
    }
    html += '</div>'
  }

  html += `<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:12px;display:flex;gap:8px">`
  if (myRole !== 'owner') {
    html += `<button class="btn-secondary" style="color:var(--red);border-color:var(--red);flex:1" onclick="leaveTeam('${escHtml(team.id)}','${escHtml(team.name)}')">Leave Team</button>`
  }
  if (myRole === 'owner') {
    html += `<button class="btn-secondary" style="color:var(--red);border-color:var(--red);flex:1" onclick="deleteTeam('${escHtml(team.id)}','${escHtml(team.name)}')">Delete Team</button>`
  }
  html += '</div></div>'

  body.innerHTML = html
}

export function getActiveTeamId(): string | null {
  return _activeTeamId
}

// ── Workspace Banner ──────────────────────────────────────────

const LS_ACTIVE_WS = 'restify_active_workspace'
let _activeWorkspaceId: string | null = null
let _wsSwitcherOpen = false

export function getActiveWorkspaceId(): string | null {
  return _activeWorkspaceId
}

function _persistActiveWorkspace(id: string): void {
  _activeWorkspaceId = id
  try { localStorage.setItem(LS_ACTIVE_WS, id) } catch {}
}

function _renderWorkspaceBanner(): void {
  const nameEl = document.getElementById('workspaceBannerNameText')
  const banner = document.getElementById('workspaceBanner')
  if (!nameEl || !banner) return

  // Always show the banner
  banner.style.display = 'flex'

  if (!_cloudToken()) {
    nameEl.textContent = 'My Workspace'
    return
  }

  const ws = _workspaces.find((w: any) => w.id === _activeWorkspaceId) || _workspaces[0]
  if (ws) {
    nameEl.textContent = ws.name
    if (!_activeWorkspaceId) _persistActiveWorkspace(ws.id)
  } else {
    nameEl.textContent = 'My Workspace'
  }
}

export async function initWorkspaceBanner(): Promise<void> {
  const banner = document.getElementById('workspaceBanner')

  // Show immediately — even before the cloud check resolves
  if (banner) {
    banner.style.display = 'flex'
    const nameEl = document.getElementById('workspaceBannerNameText')
    if (nameEl) nameEl.textContent = 'My Workspace'
  }

  if (!_cloudToken()) {
    return
  }

  const stored = localStorage.getItem(LS_ACTIVE_WS)
  if (stored) _activeWorkspaceId = stored

  try {
    const [teamsResp, wsResp] = await Promise.all([
      fetch(teamApiUrl('/api/teams'), { credentials: 'include', headers: _cloudHeaders() }),
      fetch(teamApiUrl('/api/workspaces'), { credentials: 'include', headers: _cloudHeaders() }),
    ])
    if (teamsResp.ok && wsResp.ok) {
      const teamsData = await teamsResp.json()
      const wsData = await wsResp.json()
      _teams = teamsData.teams || []
      _workspaces = wsData.workspaces || []

      if (_workspaces.length > 0) {
        const still = _workspaces.find((w: any) => w.id === _activeWorkspaceId)
        if (!still) _persistActiveWorkspace(_workspaces[0].id)
      }
    }
  } catch {}
  _renderWorkspaceBanner()
}

export function toggleWsSwitcher(): void {
  if (_wsSwitcherOpen) {
    _closeWsSwitcher()
    return
  }
  _wsSwitcherOpen = true

  const btn = document.getElementById('workspaceBannerName')
  const rect = btn?.getBoundingClientRect()
  const top = rect ? rect.bottom + 2 : 32
  const left = rect ? rect.left : 80

  const menu = document.createElement('div')
  menu.className = 'ws-switcher-menu'
  menu.id = 'wsSwitcherMenu'
  menu.style.top = top + 'px'
  menu.style.left = left + 'px'

  let html = '<div class="ws-switcher-header">Your Workspaces</div>'

  if (_workspaces.length === 0) {
    html += `<div class="ws-switcher-item" style="color:var(--text-dim)">No workspaces yet</div>`
  } else {
    for (const ws of _workspaces) {
      const initial = (ws.name || '?').charAt(0).toUpperCase()
      const isActive = ws.id === _activeWorkspaceId
      html += `<div class="ws-switcher-item${isActive ? ' active' : ''}" onclick="_switchActiveWorkspace('${escHtml(ws.id)}')">
        <span class="ws-switcher-check">✓</span>
        <div class="ws-switcher-icon">${initial}</div>
        <div class="ws-switcher-info">
          <div class="ws-switcher-name">${escHtml(ws.name)}</div>
          <div class="ws-switcher-role">${escHtml(ws.role)}</div>
        </div>
      </div>`
    }
  }

  html += `<div class="ws-switcher-divider"></div>
    <div class="ws-switcher-action" onclick="_closeWsSwitcher(); createWorkspace()">
      <span class="ws-switcher-action-icon">＋</span> Create workspace
    </div>
    <div class="ws-switcher-action" onclick="_closeWsSwitcher(); openTeamsModal()">
      <span class="ws-switcher-action-icon">🏢</span> Manage workspaces
    </div>`

  menu.innerHTML = html
  document.body.appendChild(menu)

  const closeOnOutside = (e: MouseEvent) => {
    const t = e.target as Node
    if (!menu.contains(t) && t !== btn) {
      _closeWsSwitcher()
      document.removeEventListener('mousedown', closeOnOutside)
    }
  }
  document.addEventListener('mousedown', closeOnOutside)
}

export function _closeWsSwitcher(): void {
  _wsSwitcherOpen = false
  document.getElementById('wsSwitcherMenu')?.remove()
}

export function _switchActiveWorkspace(workspaceId: string): void {
  _closeWsSwitcher()
  _persistActiveWorkspace(workspaceId)
  _renderWorkspaceBanner()
}

export function inviteToActiveWorkspace(): void {
  if (!_cloudToken()) {
    showNotif('Sign in to use workspaces', 'info')
    return
  }
  const ws = _workspaces.find((w: any) => w.id === _activeWorkspaceId)
  if (!ws) {
    showNotif('No active workspace', 'info')
    return
  }
  void inviteToWorkspace(ws.id)
}

export function openTeamsInActiveWorkspace(): void {
  if (!_cloudToken()) {
    showNotif('Sign in to use teams', 'info')
    return
  }
  const ws = _workspaces.find((w: any) => w.id === _activeWorkspaceId)
  if (ws) {
    void openWorkspaceDetail(ws.id)
    document.getElementById('teamsModal')?.classList.add('open')
  } else {
    openTeamsModal()
  }
}
