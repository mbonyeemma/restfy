// ═══════════════════════════════════════════
// SHARING & DOCUMENTATION (online publish + links)
// ═══════════════════════════════════════════

function _publishApiRoot() {
  if (typeof getRestifyApiBase === 'function') {
    const b = getRestifyApiBase();
    if (b) return String(b).replace(/\/+$/, '');
  }
  return 'https://api.restify.online';
}

function shareQuickUrl() {
  if (typeof restifyApiUrl === 'function') {
    const u = restifyApiUrl('/api/share/quick');
    if (/^https?:\/\//i.test(u)) return u;
  }
  return _publishApiRoot() + '/api/share/quick';
}

function apiSharedUrl(id) {
  if (typeof restifyApiUrl === 'function') {
    const u = restifyApiUrl('/api/shared/' + encodeURIComponent(id));
    if (/^https?:\/\//i.test(u)) return u;
  }
  return _publishApiRoot() + '/api/shared/' + encodeURIComponent(id);
}

async function shareCollection(colId) {
  const col = findNodeInAll(colId);
  if (!col) return;

  const shareData = deepClone(col);

  try {
    const resp = await fetch(shareQuickUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: shareData, name: col.name })
    });
    const text = await resp.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<')) {
      throw new Error(
        'API returned a web page instead of JSON. On desktop, ensure the Restify API is running or reachable (default https://api.restify.online).'
      );
    }
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Invalid response from server');
    }
    if (!resp.ok) throw new Error(result.error || 'Server returned ' + resp.status);

    showShareResult(result, col.name);
    showNotif('Published online — copy the documentation link to share', 'success');
  } catch (err) {
    showNotif('Publish failed: ' + err.message, 'error');
  }
}

function showShareResult(result, name) {
  document.getElementById('shareCollectionName').textContent = name;
  document.getElementById('shareDocUrl').value = result.docUrl;
  document.getElementById('shareImportUrl').value = result.importUrl;
  document.getElementById('shareDocLink').href = result.docUrl;
  document.getElementById('shareModal').classList.add('open');
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('open');
}

function copyShareUrl(inputId) {
  const input = document.getElementById(inputId);
  navigator.clipboard.writeText(input.value).then(() => showNotif('Link copied!', 'success'));
}

async function checkAutoImport() {
  const params = new URLSearchParams(window.location.search);
  const importId = params.get('import');
  if (!importId) return;

  try {
    const resp = await fetch(apiSharedUrl(importId));
    if (!resp.ok) throw new Error('Collection not found');
    const data = await resp.json();

    if (data.collection) {
      const col = data.collection;
      assignNewIds(col);
      collections.push(col);
      openFolders.add(col.id);
      saveState();
      renderSidebar();
      showNotif(`Imported "${col.name}"`, 'success');
      window.history.replaceState({}, '', '/');
    }
  } catch (err) {
    showNotif('Import failed: ' + err.message, 'error');
  }
}
