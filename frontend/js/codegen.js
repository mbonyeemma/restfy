// ═══════════════════════════════════════════
// IMPORT, EXPORT & CODE GENERATION
// ═══════════════════════════════════════════

// ── Import ──

function openImport() {
  pendingImport = null;
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('doImportBtn').style.display = 'none';
  document.getElementById('fileInput').value = '';
  const ta = document.getElementById('importJsonTextarea');
  if (ta) ta.value = '';
  const urlInput = document.getElementById('importUrlInput');
  if (urlInput) urlInput.value = '';
  const urlStatus = document.getElementById('importUrlStatus');
  if (urlStatus) urlStatus.textContent = '';
  switchImportTab('file');
  document.getElementById('importModal').classList.add('open');
}

function closeImport() {
  document.getElementById('importModal').classList.remove('open');
}

function switchImportTab(tab) {
  document.querySelectorAll('.import-tab-btn').forEach(b => {
    const active = b.dataset.tab === tab;
    b.style.background = active ? 'var(--bg-light)' : 'transparent';
    b.style.color = active ? 'var(--text-primary)' : 'var(--text-dim)';
    b.classList.toggle('active', active);
  });
  document.getElementById('importTabFile').style.display = tab === 'file' ? 'block' : 'none';
  document.getElementById('importTabText').style.display = tab === 'text' ? 'block' : 'none';
  document.getElementById('importTabLink').style.display = tab === 'link' ? 'block' : 'none';
}

function importFromText() {
  const ta = document.getElementById('importJsonTextarea');
  const raw = (ta && ta.value || '').trim();
  if (!raw) { showNotif('Paste some JSON first', 'error'); return; }
  try {
    const data = JSON.parse(raw);
    processImportData(data);
  } catch (err) {
    showNotif('Invalid JSON: ' + err.message, 'error');
  }
}

async function importFromUrl() {
  const input = document.getElementById('importUrlInput');
  let url = (input && input.value || '').trim();
  if (!url) { showNotif('Enter a URL', 'error'); return; }
  if (!url.startsWith('http')) url = 'https://' + url;

  const status = document.getElementById('importUrlStatus');
  status.textContent = 'Fetching...';
  status.style.color = 'var(--text-dim)';

  try {
    const resp = await restifyFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();
    const data = JSON.parse(text);
    status.textContent = '';
    processImportData(data);
  } catch (err) {
    status.textContent = 'Failed: ' + err.message;
    status.style.color = 'var(--red)';
  }
}

function handleDragOver(e) { e.preventDefault(); document.getElementById('dropZone').classList.add('drag-over'); }
function handleDragLeave(e) { document.getElementById('dropZone').classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processImportFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processImportFile(file);
}

function processImportFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      processImportData(data);
    } catch (err) {
      showNotif('Invalid JSON file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function processImportData(data) {
  const result = parsePostmanCollection(data);
  if (result) {
    pendingImport = result;
    const preview = document.getElementById('importPreview');
    preview.style.display = 'block';
    const requests = [];
    function collectReqs(node) {
      if (node.type === 'request') requests.push(node);
      if (node.children) node.children.forEach(collectReqs);
    }
    result.children.forEach(collectReqs);
    preview.innerHTML = `
      <div style="margin-bottom:8px; font-weight:600; color: var(--text-primary);">${escHtml(result.name)}</div>
      <div style="color: var(--text-secondary);">${requests.length} request${requests.length !== 1 ? 's' : ''}, ${result.children.filter(c => c.type === 'folder').length} folder(s)</div>
      <div style="margin-top:8px; max-height:150px; overflow-y:auto;">
        ${requests.slice(0, 30).map(r => `<div style="padding:3px 0; display:flex; gap:8px; align-items:center;">
          <span class="req-method-badge m-${r.method} bg-${r.method}" style="font-size:9px">${r.method}</span>
          <span style="font-size:12px; color:var(--text-secondary)">${escHtml(r.name)}</span>
        </div>`).join('')}
        ${requests.length > 30 ? `<div style="color:var(--text-dim);font-size:11px">...and ${requests.length - 30} more</div>` : ''}
      </div>
    `;
    document.getElementById('doImportBtn').style.display = 'inline-flex';
  }
}

function parsePostmanCollection(data) {
  if (!data.info || !data.item) {
    showNotif('Not a valid Postman collection', 'error');
    return null;
  }
  const col = makeCollection({ name: data.info.name || 'Imported Collection' });
  if (data.auth) col.auth = parsePostmanAuth(data.auth);

  function parseItems(items) {
    return items.map(item => {
      if (item.item) {
        const folder = makeFolder({ name: item.name || 'Folder' });
        if (item.auth) folder.auth = parsePostmanAuth(item.auth);
        folder.children = parseItems(item.item);
        return folder;
      }
      if (item.request) {
        const r = item.request;
        const method = (typeof r.method === 'string' ? r.method : 'GET').toUpperCase();
        let url = typeof r.url === 'string' ? r.url : (r.url?.raw || '');
        const params = [];
        if (r.url?.query) r.url.query.forEach(q => params.push({ key: q.key || '', value: q.value || '', enabled: !q.disabled }));
        if (params.length === 0) params.push({ key: '', value: '', enabled: true });
        const headers = [];
        if (r.header) r.header.forEach(h => headers.push({ key: h.key || '', value: h.value || '', enabled: !h.disabled }));
        if (headers.length === 0) headers.push({ key: '', value: '', enabled: true });
        let bodyType = 'none', body = '', bodyForm = [{ key: '', value: '', enabled: true }];
        if (r.body) {
          if (r.body.mode === 'raw') {
            body = r.body.raw || '';
            bodyType = (r.body.options?.raw?.language === 'json') ? 'json' : 'raw';
          } else if (r.body.mode === 'formdata') {
            bodyType = 'form';
            bodyForm = (r.body.formdata || []).map(f => ({ key: f.key || '', value: f.value || '', enabled: !f.disabled }));
          } else if (r.body.mode === 'urlencoded') {
            bodyType = 'urlencoded';
            bodyForm = (r.body.urlencoded || []).map(f => ({ key: f.key || '', value: f.value || '', enabled: !f.disabled }));
          } else if (r.body.mode === 'graphql') {
            bodyType = 'graphql';
            body = r.body.graphql?.query || '';
          }
          if (bodyForm.length === 0) bodyForm.push({ key: '', value: '', enabled: true });
        }
        const auth = r.auth ? parsePostmanAuth(r.auth) : { type: 'none' };
        return makeRequest({ name: item.name || 'Request', method, url, params, headers, bodyType, body, bodyForm, auth });
      }
      return null;
    }).filter(Boolean);
  }

  col.children = parseItems(data.item);
  return col;
}

function parsePostmanAuth(pmAuth) {
  if (!pmAuth) return { type: 'none' };
  if (pmAuth.type === 'bearer') {
    const t = (pmAuth.bearer || []).find(b => b.key === 'token');
    return { type: 'bearer', token: t?.value || '' };
  }
  if (pmAuth.type === 'basic') {
    const u = (pmAuth.basic || []).find(b => b.key === 'username');
    const p = (pmAuth.basic || []).find(b => b.key === 'password');
    return { type: 'basic', username: u?.value || '', password: p?.value || '' };
  }
  if (pmAuth.type === 'apikey') {
    const k = (pmAuth.apikey || []).find(b => b.key === 'key');
    const v = (pmAuth.apikey || []).find(b => b.key === 'value');
    return { type: 'apikey', key: k?.value || 'X-API-Key', value: v?.value || '' };
  }
  return { type: 'none' };
}

function doImport() {
  if (!pendingImport) return;
  collections.push(pendingImport);
  openFolders.add(pendingImport.id);
  saveState();
  renderSidebar();
  closeImport();
  showNotif(`Imported "${pendingImport.name}"`, 'success');
  pendingImport = null;
}

// ── Import cURL ──

async function openCurlImport() {
  const curl = await appPrompt('Import cURL', 'Paste a cURL command below.', { textarea: true, placeholder: 'curl https://api.example.com/endpoint -H "Authorization: Bearer ..."', okLabel: 'Import' });
  if (!curl) return;
  try {
    const req = parseCurl(curl);
    newTab(req);
    showNotif('Imported from cURL', 'success');
  } catch (e) {
    showNotif('Failed to parse cURL: ' + e.message, 'error');
  }
}

function parseCurl(curlStr) {
  const req = makeRequest();
  curlStr = curlStr.replace(/\\\n/g, ' ').trim();
  if (curlStr.startsWith('curl ')) curlStr = curlStr.substring(5);

  const urlMatch = curlStr.match(/(?:^|\s)(['"]?)(https?:\/\/[^\s'"]+)\1/);
  if (urlMatch) req.url = urlMatch[2];

  const methodMatch = curlStr.match(/-X\s+(\w+)/);
  if (methodMatch) req.method = methodMatch[1].toUpperCase();

  const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
  let hm;
  const headers = [];
  while ((hm = headerRegex.exec(curlStr)) !== null) {
    const [key, ...rest] = hm[1].split(':');
    headers.push({ key: key.trim(), value: rest.join(':').trim(), enabled: true });
  }
  if (headers.length > 0) req.headers = headers;

  const dataMatch = curlStr.match(/(?:-d|--data|--data-raw)\s+['"](.+?)['"]/);
  if (dataMatch) {
    req.body = dataMatch[1];
    if (!req.method || req.method === 'GET') req.method = 'POST';
    try { JSON.parse(req.body); req.bodyType = 'json'; } catch { req.bodyType = 'raw'; }
  }

  if (!req.method) req.method = 'GET';
  req.name = req.url ? req.url.replace(/https?:\/\//, '').split('?')[0].split('/').pop() || 'Request' : 'Request';
  return req;
}

// ── Export ──

function exportCollectionAsPostman(colId) {
  const col = findNodeInAll(colId);
  if (!col) return;
  const postmanData = {
    info: { name: col.name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: exportItems(col.children)
  };
  if (col.auth && col.auth.type !== 'none') postmanData.auth = exportAuth(col.auth);
  downloadJson(postmanData, col.name + '.postman_collection.json');
  showNotif('Collection exported', 'success');
}

function exportItems(children) {
  if (!children) return [];
  return children.map(child => {
    if (child.type === 'folder') {
      const item = { name: child.name, item: exportItems(child.children) };
      if (child.auth && child.auth.type !== 'none') item.auth = exportAuth(child.auth);
      return item;
    }
    const item = {
      name: child.name,
      request: {
        method: child.method,
        url: { raw: child.url, query: child.params?.filter(p => p.key).map(p => ({ key: p.key, value: p.value, disabled: !p.enabled })) || [] },
        header: child.headers?.filter(h => h.key).map(h => ({ key: h.key, value: h.value, disabled: !h.enabled })) || [],
      }
    };
    if (child.bodyType !== 'none') {
      if (child.bodyType === 'json') item.request.body = { mode: 'raw', raw: child.body, options: { raw: { language: 'json' } } };
      else if (child.bodyType === 'raw') item.request.body = { mode: 'raw', raw: child.body };
      else if (child.bodyType === 'form') item.request.body = { mode: 'formdata', formdata: child.bodyForm?.filter(f => f.key).map(f => ({ key: f.key, value: f.value, disabled: !f.enabled })) || [] };
      else if (child.bodyType === 'urlencoded') item.request.body = { mode: 'urlencoded', urlencoded: child.bodyForm?.filter(f => f.key).map(f => ({ key: f.key, value: f.value, disabled: !f.enabled })) || [] };
      else if (child.bodyType === 'graphql') item.request.body = { mode: 'graphql', graphql: { query: child.body } };
    }
    if (child.auth && child.auth.type !== 'none' && child.auth.type !== 'inherit') item.request.auth = exportAuth(child.auth);
    return item;
  });
}

function exportAuth(auth) {
  if (auth.type === 'bearer') return { type: 'bearer', bearer: [{ key: 'token', value: auth.token }] };
  if (auth.type === 'basic') return { type: 'basic', basic: [{ key: 'username', value: auth.username }, { key: 'password', value: auth.password }] };
  if (auth.type === 'apikey') return { type: 'apikey', apikey: [{ key: 'key', value: auth.key }, { key: 'value', value: auth.value }] };
  return { type: 'noauth' };
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── cURL Generation ──

function generateCurl() {
  saveCurrentTabState();
  const method = document.getElementById('methodSelect').value;
  let url = resolveVariables(document.getElementById('urlInput').value.trim());
  if (!url.startsWith('http')) url = 'https://' + url;

  const params = getKvStore('params').filter(r => r.enabled && r.key);
  if (params.length) {
    const qs = params.map(r => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&');
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  let parts = [`curl -X ${method}`];
  parts.push(`  '${url}'`);

  const allHeaders = {};
  getKvStore('headers').filter(r => r.enabled && r.key).forEach(r => {
    allHeaders[resolveVariables(r.key)] = resolveVariables(r.value);
  });
  const auth = getAuthState();
  if (auth.type === 'bearer') allHeaders['Authorization'] = `Bearer ${resolveVariables(auth.token)}`;
  else if (auth.type === 'basic') allHeaders['Authorization'] = 'Basic ' + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`);
  else if (auth.type === 'apikey') allHeaders[resolveVariables(auth.key)] = resolveVariables(auth.value);

  if (currentBodyType === 'json' && !allHeaders['Content-Type']) allHeaders['Content-Type'] = 'application/json';
  if (currentBodyType === 'urlencoded' && !allHeaders['Content-Type']) allHeaders['Content-Type'] = 'application/x-www-form-urlencoded';

  Object.entries(allHeaders).forEach(([k, v]) => {
    parts.push(`  -H '${k}: ${v}'`);
  });

  if (method !== 'GET' && method !== 'HEAD') {
    if (currentBodyType === 'json' || currentBodyType === 'raw') {
      const body = resolveVariables(document.getElementById('bodyTextarea').value);
      if (body) parts.push(`  -d '${body.replace(/'/g, "'\\''")}'`);
    } else if (currentBodyType === 'form') {
      getKvStore('bodyForm').filter(r => r.enabled && r.key).forEach(r => {
        parts.push(`  -F '${resolveVariables(r.key)}=${resolveVariables(r.value)}'`);
      });
    } else if (currentBodyType === 'urlencoded') {
      const body = getKvStore('bodyForm').filter(r => r.enabled && r.key)
        .map(r => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&');
      if (body) parts.push(`  -d '${body}'`);
    } else if (currentBodyType === 'graphql') {
      const query = resolveVariables(document.getElementById('bodyTextarea').value);
      const vars = document.getElementById('graphqlVarsTextarea')?.value || '{}';
      parts.push(`  -d '${JSON.stringify({ query, variables: JSON.parse(resolveVariables(vars) || '{}') }).replace(/'/g, "'\\''")}'`);
    }
  }

  const curl = parts.join(' \\\n');
  navigator.clipboard.writeText(curl).then(() => showNotif('cURL copied to clipboard', 'success'));
  return curl;
}

// ── Code Snippet Generator ──

function openCodeGen() {
  document.getElementById('codeGenModal').classList.add('open');
  generateCodeSnippet('javascript_fetch');
}

function closeCodeGen() {
  document.getElementById('codeGenModal').classList.remove('open');
  document.getElementById('codeGenTitle').textContent = 'Generate Code Snippet';
  const langs = document.querySelector('.codegen-langs');
  if (langs) langs.style.display = '';
}

function generateCodeSnippet(lang) {
  document.querySelectorAll('.codegen-lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  saveCurrentTabState();
  const method = document.getElementById('methodSelect').value;
  let url = resolveVariables(document.getElementById('urlInput').value.trim());
  if (!url.startsWith('http')) url = 'https://' + url;

  const params = getKvStore('params').filter(r => r.enabled && r.key);
  if (params.length) {
    const qs = params.map(r => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&');
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  const hdrs = {};
  getKvStore('headers').filter(r => r.enabled && r.key).forEach(r => hdrs[resolveVariables(r.key)] = resolveVariables(r.value));
  const auth = getAuthState();
  if (auth.type === 'bearer') hdrs['Authorization'] = `Bearer ${resolveVariables(auth.token)}`;
  else if (auth.type === 'basic') hdrs['Authorization'] = 'Basic ' + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`);
  else if (auth.type === 'apikey') hdrs[resolveVariables(auth.key)] = resolveVariables(auth.value);
  if (currentBodyType === 'json' && !hdrs['Content-Type']) hdrs['Content-Type'] = 'application/json';

  let bodyStr = '';
  if (method !== 'GET' && method !== 'HEAD' && (currentBodyType === 'json' || currentBodyType === 'raw')) {
    bodyStr = resolveVariables(document.getElementById('bodyTextarea').value);
  }

  let code = '';
  if (lang === 'javascript_fetch') {
    code = genJsFetch(method, url, hdrs, bodyStr);
  } else if (lang === 'javascript_axios') {
    code = genJsAxios(method, url, hdrs, bodyStr);
  } else if (lang === 'python') {
    code = genPython(method, url, hdrs, bodyStr);
  } else if (lang === 'go') {
    code = genGo(method, url, hdrs, bodyStr);
  } else if (lang === 'php') {
    code = genPhp(method, url, hdrs, bodyStr);
  } else if (lang === 'curl') {
    code = generateCurl();
  }

  document.getElementById('codeGenOutput').textContent = code;
}

function genJsFetch(method, url, hdrs, body) {
  let code = `const response = await fetch('${url}', {\n  method: '${method}'`;
  if (Object.keys(hdrs).length) code += `,\n  headers: ${JSON.stringify(hdrs, null, 4).replace(/\n/g, '\n  ')}`;
  if (body) code += `,\n  body: ${/^\{/.test(body.trim()) ? `JSON.stringify(${body})` : `'${body.replace(/'/g, "\\'")}'`}`;
  code += `\n});\n\nconst data = await response.json();\nconsole.log(data);`;
  return code;
}

function genJsAxios(method, url, hdrs, body) {
  let code = `const axios = require('axios');\n\nconst response = await axios({\n  method: '${method.toLowerCase()}',\n  url: '${url}'`;
  if (Object.keys(hdrs).length) code += `,\n  headers: ${JSON.stringify(hdrs, null, 4).replace(/\n/g, '\n  ')}`;
  if (body) code += `,\n  data: ${body}`;
  code += `\n});\n\nconsole.log(response.data);`;
  return code;
}

function genPython(method, url, hdrs, body) {
  let code = `import requests\n\nresponse = requests.${method.toLowerCase()}(\n    '${url}'`;
  if (Object.keys(hdrs).length) code += `,\n    headers=${JSON.stringify(hdrs).replace(/"/g, "'")}`;
  if (body) code += `,\n    json=${body}`;
  code += `\n)\n\nprint(response.json())`;
  return code;
}

function genGo(method, url, hdrs, body) {
  let code = `package main\n\nimport (\n    "fmt"\n    "io"\n    "net/http"\n`;
  if (body) code += `    "strings"\n`;
  code += `)\n\nfunc main() {\n`;
  if (body) code += `    body := strings.NewReader(\`${body}\`)\n    req, _ := http.NewRequest("${method}", "${url}", body)\n`;
  else code += `    req, _ := http.NewRequest("${method}", "${url}", nil)\n`;
  Object.entries(hdrs).forEach(([k, v]) => { code += `    req.Header.Set("${k}", "${v}")\n`; });
  code += `\n    client := &http.Client{}\n    resp, _ := client.Do(req)\n    defer resp.Body.Close()\n    data, _ := io.ReadAll(resp.Body)\n    fmt.Println(string(data))\n}`;
  return code;
}

function genPhp(method, url, hdrs, body) {
  let code = `<?php\n$ch = curl_init();\ncurl_setopt($ch, CURLOPT_URL, '${url}');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`;
  const hdrArr = Object.entries(hdrs).map(([k, v]) => `'${k}: ${v}'`);
  if (hdrArr.length) code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [${hdrArr.join(', ')}]);\n`;
  if (body) code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${body.replace(/'/g, "\\'")}');\n`;
  code += `\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;\n?>`;
  return code;
}

function copyCodeGen() {
  const code = document.getElementById('codeGenOutput').textContent;
  navigator.clipboard.writeText(code).then(() => showNotif('Code copied!', 'success'));
}

// ── Collection Runner ──

async function runCollection(colId) {
  const col = findNodeInAll(colId);
  if (!col) return;
  const requests = [];
  function collect(node, id) {
    if (node.type === 'request') requests.push({ req: node, id: id || node.id });
    if (node.children) node.children.forEach(c => collect(c, c.id));
  }
  collect(col, col.id);

  if (requests.length === 0) { showNotif('No requests to run', 'error'); return; }
  showNotif(`Running ${requests.length} requests...`, 'info');

  const results = [];
  for (const { req, id } of requests) {
    let url = resolveVariables(req.url);
    if (!url.startsWith('http')) url = 'https://' + url;
    const params = (req.params || []).filter(r => r.enabled && r.key);
    if (params.length) {
      const qs = params.map(r => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&');
      url += (url.includes('?') ? '&' : '?') + qs;
    }
    // Merge inherited headers from ancestor chain
    const headers = {};
    const chain = getAncestorChain(req.id);
    chain.forEach(ancestor => {
      if (ancestor.headers) ancestor.headers.forEach(h => {
        if (h.enabled !== false && h.key) headers[resolveVariables(h.key)] = resolveVariables(h.value);
      });
    });
    (req.headers || []).filter(r => r.enabled && r.key).forEach(r => headers[resolveVariables(r.key)] = resolveVariables(r.value));
    // Merge inherited auth
    let auth = req.auth || { type: 'none' };
    if (!auth || auth.type === 'none' || auth.type === 'inherit') {
      const inheritedAuth = getInheritedAuth(req.id);
      if (inheritedAuth) auth = inheritedAuth.auth;
    }
    if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${resolveVariables(auth.token)}`;
    else if (auth.type === 'basic') headers['Authorization'] = 'Basic ' + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`);
    else if (auth.type === 'apikey') headers[resolveVariables(auth.key)] = resolveVariables(auth.value);
    if ((req.bodyType === 'json') && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const opts = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.bodyType === 'json' || req.bodyType === 'raw') opts.body = resolveVariables(req.body);
      else if (req.bodyType === 'urlencoded') {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
        opts.body = (req.bodyForm || []).filter(r => r.enabled && r.key)
          .map(r => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&');
      }
    }
    // Run ancestor + request pre-request scripts
    let reqCtx = { url, method: req.method, headers, body: opts.body };
    for (const ancestor of chain) {
      if (ancestor.preRequestScript) {
        try { const r = runPreRequestScript(ancestor.preRequestScript, reqCtx); if (r) Object.assign(reqCtx, r); }
        catch (e) { results.push({ name: req.name, method: req.method, status: 'ERR', time: 0, passed: false, error: 'Pre-req script: ' + e.message }); continue; }
      }
    }
    if (req.preRequestScript) {
      try { const r = runPreRequestScript(req.preRequestScript, reqCtx); if (r) Object.assign(reqCtx, r); }
      catch (e) { results.push({ name: req.name, method: req.method, status: 'ERR', time: 0, passed: false, error: 'Pre-req script: ' + e.message }); continue; }
    }
    opts.method = reqCtx.method;
    Object.assign(opts.headers, reqCtx.headers);
    if (reqCtx.body !== undefined) opts.body = reqCtx.body;

    const start = Date.now();
    try {
      const resp = await restifyFetch(reqCtx.url, opts);
      const respText = await resp.text();
      let testResults = [];
      const respCtx = { status: resp.status, statusText: resp.statusText, body: respText, headers: Object.fromEntries(resp.headers.entries()) };
      for (const ancestor of chain) {
        if (ancestor.testScript) {
          try { testResults = testResults.concat(runTestScript(ancestor.testScript, respCtx)); } catch(e) {}
        }
      }
      if (req.testScript) {
        try { testResults = testResults.concat(runTestScript(req.testScript, respCtx)); } catch(e) {}
      }
      const testFailed = testResults.some(t => !t.passed);
      results.push({ name: req.name, method: req.method, status: resp.status, time: Date.now() - start, passed: resp.status < 400 && !testFailed, tests: testResults });
    } catch (e) {
      results.push({ name: req.name, method: req.method, status: 'ERR', time: Date.now() - start, passed: false, error: e.message });
    }
  }

  showRunnerResults(results);
}

function showRunnerResults(results) {
  const modal = document.getElementById('codeGenModal');
  modal.classList.add('open');
  document.getElementById('codeGenTitle').textContent = 'Collection Runner Results';
  const output = document.getElementById('codeGenOutput');
  let html = '';
  let passed = 0, failed = 0;
  results.forEach(r => {
    if (r.passed) passed++; else failed++;
    html += `${r.passed ? '\u2713' : '\u2717'} [${r.method}] ${r.name} - ${r.status} (${r.time}ms)${r.error ? ' - ' + r.error : ''}\n`;
  });
  html = `Results: ${passed} passed, ${failed} failed\n${'─'.repeat(50)}\n` + html;
  output.textContent = html;
  document.querySelector('.codegen-langs').style.display = 'none';
}
