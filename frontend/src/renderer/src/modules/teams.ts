import { state, saveState } from './state'
import { escHtml, showNotif, appPrompt, appConfirm } from './utils'

let _teams: any[] = []
let _activeTeamId: string | null = null
let _teamDetail: any = null

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
  _renderTeamsList()
  document.getElementById('teamsModal')?.classList.add('open')
  void loadTeams()
}

export function closeTeamsModal(): void {
  document.getElementById('teamsModal')?.classList.remove('open')
}

// ── Load teams ────────────────────────────────────────────────

async function loadTeams(): Promise<void> {
  try {
    const resp = await fetch(teamApiUrl('/api/teams'), {
      credentials: 'include',
      headers: _cloudHeaders(),
    })
    if (!resp.ok) throw new Error('Failed to load teams')
    const data = await resp.json()
    _teams = data.teams || []
    _renderTeamsList()
  } catch (err: any) {
    showNotif('Could not load teams: ' + err.message, 'error')
  }
}

// ── Create team ───────────────────────────────────────────────

export async function createTeam(): Promise<void> {
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
      body: JSON.stringify({ name: name.trim() }),
    })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}))
      throw new Error((d as any).error || 'Failed to create team')
    }
    showNotif('Team created', 'success')
    void loadTeams()
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
    _renderTeamDetail()
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
    void loadTeams()
  } catch {
    showNotif('Failed to process invite', 'error')
  }
}

// ── Remove member ─────────────────────────────────────────────

export async function removeMember(teamId: string, userId: string, name: string): Promise<void> {
  const ok = await appConfirm(`Remove ${name} from this team?`)
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
  const ok = await appConfirm(`Leave team "${teamName}"? You will lose access to shared collections.`)
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
    void loadTeams()
    _renderTeamsList()
  } catch (err: any) {
    showNotif(err.message, 'error')
  }
}

// ── Delete team ───────────────────────────────────────────────

export async function deleteTeam(teamId: string, teamName: string): Promise<void> {
  const ok = await appConfirm(`Delete team "${teamName}"? This cannot be undone. All team collections and environments will be deleted.`)
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
    void loadTeams()
    _renderTeamsList()
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
  title.textContent = 'Teams'

  if (_teams.length === 0) {
    body.innerHTML = `
      <div class="teams-list">
        <div style="text-align:center;padding:32px 0;color:var(--text-dim)">
          <div style="font-size:36px;opacity:.25;margin-bottom:12px">👥</div>
          <div style="font-size:14px;font-weight:500;margin-bottom:6px;color:var(--text-secondary)">No teams yet</div>
          <div style="font-size:12px;margin-bottom:16px">Create a team to collaborate with others on API collections and environments.</div>
          <button class="btn-primary" onclick="createTeam()">+ Create Team</button>
        </div>
      </div>`
    return
  }

  let html = `<div class="teams-list">
    <div class="teams-list-header">
      <h3>Your Teams</h3>
      <button class="btn-primary" style="font-size:12px;padding:5px 14px" onclick="createTeam()">+ New Team</button>
    </div>`
  for (const t of _teams) {
    const initial = (t.name || '?').charAt(0).toUpperCase()
    html += `<div class="team-card" onclick="openTeamDetail('${escHtml(t.id)}')">
      <div class="team-card-icon">${initial}</div>
      <div class="team-card-info">
        <div class="team-card-name">${escHtml(t.name)}</div>
        <div class="team-card-meta">${t.member_count || 1} member${(t.member_count || 1) !== 1 ? 's' : ''}</div>
      </div>
      <span class="team-card-role">${escHtml(t.role)}</span>
    </div>`
  }
  html += '</div>'
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

  let html = `<div class="team-detail">
    <div class="team-detail-header">
      <button class="team-detail-back" onclick="openTeamsModal()" title="Back to teams">←</button>
      <div class="team-detail-name">${escHtml(team.name)}</div>
      <span class="team-card-role">${escHtml(myRole)}</span>
    </div>

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
