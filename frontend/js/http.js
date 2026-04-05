// ═══════════════════════════════════════════
// HTTP REQUEST SENDING & RESPONSE
// ═══════════════════════════════════════════

let _activeAbortController = null;
let _requestElapsedTimer = null;

function cancelRequest() {
  if (_activeAbortController) {
    _activeAbortController.abort();
    _activeAbortController = null;
  }
}

async function sendRequest() {
  let method = document.getElementById('methodSelect').value;
  let url = document.getElementById('urlInput').value.trim();
  if (!url) { showNotif('Please enter a URL', 'error'); return; }
  if (!url.startsWith('http')) url = 'https://' + url;
  url = resolveVariables(url);

  const params = getKvStore('params').filter(r => r.enabled && r.key);
  if (params.length) {
    const qs = params.map(r => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&');
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  const headers = {};
  const inheritedHeaders = activeTabId && tabs.find(t => t.id === activeTabId)?.sourceId
    ? getInheritedHeaders(tabs.find(t => t.id === activeTabId).sourceId) : {};
  Object.entries(inheritedHeaders).forEach(([k, v]) => { headers[k] = v.value; });
  getKvStore('headers').filter(r => r.enabled && r.key).forEach(r => {
    headers[resolveVariables(r.key)] = resolveVariables(r.value);
  });

  let auth = getAuthState();
  if (auth.type === 'inherit') {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.sourceId) {
      const inherited = getInheritedAuth(tab.sourceId);
      if (inherited) auth = inherited.auth;
    }
  }
  if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${resolveVariables(auth.token)}`;
  else if (auth.type === 'basic') headers['Authorization'] = 'Basic ' + btoa(`${resolveVariables(auth.username)}:${resolveVariables(auth.password)}`);
  else if (auth.type === 'apikey') headers[resolveVariables(auth.key)] = resolveVariables(auth.value);
  else if (auth.type === 'oauth2' && auth.token) headers['Authorization'] = `Bearer ${auth.token}`;

  let body = null;
  const bodyType = currentBodyType;
  if (method !== 'GET' && method !== 'HEAD') {
    if (bodyType === 'json' || bodyType === 'raw') {
      body = resolveVariables(document.getElementById('bodyTextarea').value);
      if (bodyType === 'json' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    } else if (bodyType === 'graphql') {
      const query = resolveVariables(document.getElementById('bodyTextarea').value);
      const vars = document.getElementById('graphqlVarsTextarea')?.value || '{}';
      try {
        body = JSON.stringify({ query, variables: JSON.parse(resolveVariables(vars)) });
      } catch (e) {
        body = JSON.stringify({ query, variables: {} });
      }
      headers['Content-Type'] = 'application/json';
    } else if (bodyType === 'form') {
      const fd = new FormData();
      getKvStore('bodyForm').filter(r => r.enabled && r.key).forEach(r => {
        if (r.type === 'file' && r.file) fd.append(r.key, r.file);
        else fd.append(resolveVariables(r.key), resolveVariables(r.value));
      });
      body = fd;
    } else if (bodyType === 'urlencoded') {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = getKvStore('bodyForm').filter(r => r.enabled && r.key)
        .map(r => `${encodeURIComponent(resolveVariables(r.key))}=${encodeURIComponent(resolveVariables(r.value))}`).join('&');
    } else if (bodyType === 'binary') {
      const fileInput = document.getElementById('binaryFileInput');
      if (fileInput?.files?.[0]) body = fileInput.files[0];
    }
  }

  // Pre-request scripts: ancestor chain (collection → folder → …) then tab's own
  // Scripts can mutate url, method, headers, body via pm.request
  let reqContext = { url, method, headers, body };
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab?.sourceId) {
    const chain = getAncestorChain(tab.sourceId);
    for (const ancestor of chain) {
      if (ancestor.preRequestScript) {
        try {
          const result = runPreRequestScript(ancestor.preRequestScript, reqContext);
          if (result) Object.assign(reqContext, result);
        } catch (e) { showNotif('Pre-request script error (' + ancestor.name + '): ' + e.message, 'error'); return; }
      }
    }
  }
  const preScript = tabData[activeTabId]?.preRequestScript;
  if (preScript) {
    try {
      const result = runPreRequestScript(preScript, reqContext);
      if (result) Object.assign(reqContext, result);
    } catch (e) { showNotif('Pre-request script error: ' + e.message, 'error'); return; }
  }
  url = reqContext.url;
  method = reqContext.method;
  Object.assign(headers, reqContext.headers);
  if (reqContext.body !== undefined) body = reqContext.body;

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.innerHTML = '<span class="spinner"></span><span id="sendElapsed"></span>';
  sendBtn.classList.add('loading');
  sendBtn.onclick = cancelRequest;

  const startTime = Date.now();
  _requestElapsedTimer = setInterval(() => {
    const el = document.getElementById('sendElapsed');
    if (el) el.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
  }, 100);

  _activeAbortController = new AbortController();
  const signal = _activeAbortController.signal;

  try {
    const opts = { method, headers, signal };
    if (body) opts.body = body;
    const response = await restifyFetch(url, opts);
    const elapsed = Date.now() - startTime;
    const respText = await response.text();
    showResponse(response, respText, elapsed, url, method);

    const respCtx = {
      status: response.status, statusText: response.statusText,
      body: respText, headers: Object.fromEntries(response.headers.entries())
    };
    let allTestResults = [];
    // Ancestor test scripts (collection → folder → …)
    const sendTab = tabs.find(t => t.id === activeTabId);
    if (sendTab?.sourceId) {
      const chain = getAncestorChain(sendTab.sourceId);
      for (const ancestor of chain) {
        if (ancestor.testScript) {
          try { allTestResults = allTestResults.concat(runTestScript(ancestor.testScript, respCtx)); }
          catch (e) { console.error('Test script error (' + ancestor.name + '):', e); }
        }
      }
    }
    const testScript = tabData[activeTabId]?.testScript;
    if (testScript) {
      try { allTestResults = allTestResults.concat(runTestScript(testScript, respCtx)); }
      catch (e) { console.error('Test script error:', e); }
    }
    if (allTestResults.length) renderTestResults(allTestResults);
  } catch (err) {
    if (err.name === 'AbortError') {
      showNotif('Request cancelled', 'info');
      showResponsePlaceholder();
    } else {
      showError(err.message);
    }
  } finally {
    clearInterval(_requestElapsedTimer);
    _activeAbortController = null;
    sendBtn.innerHTML = '&#9654; Send';
    sendBtn.classList.remove('loading');
    sendBtn.onclick = sendRequest;
  }
}

function showResponse(response, text, elapsed, reqUrl, reqMethod) {
  const statusBadge = document.getElementById('statusBadge');
  const cls = response.status < 300 ? '2xx' : response.status < 400 ? '3xx' : response.status < 500 ? '4xx' : '5xx';
  const statusHtml = `<span class="status-badge status-${cls}"><span class="status-dot"></span>${response.status} ${response.statusText}</span>`;
  statusBadge.innerHTML = statusHtml;

  const size = new Blob([text]).size;
  const meta = `${elapsed}ms \u00B7 ${formatBytes(size)}`;
  document.getElementById('respMeta').textContent = meta;
  document.getElementById('copyRespBtn').style.display = 'inline-flex';
  document.getElementById('curlBtn').style.display = 'inline-flex';
  document.getElementById('codeGenBtn').style.display = 'inline-flex';
  document.getElementById('beautifyRespBtn').style.display = 'inline-flex';

  let bodyHtml = '';
  let isJson = false;
  try {
    const json = JSON.parse(text);
    bodyHtml = syntaxHighlight(JSON.stringify(json, null, 2));
    document.getElementById('responseBodyContent').innerHTML = bodyHtml;
    isJson = true;
  } catch {
    if (text.trim().startsWith('<') && (text.includes('</') || text.includes('/>'))) {
      bodyHtml = syntaxHighlightXml(text);
      document.getElementById('responseBodyContent').innerHTML = bodyHtml;
    } else {
      document.getElementById('responseBodyContent').textContent = text;
      bodyHtml = escHtml(text);
    }
  }
  document.getElementById('responsePlaceholder').style.display = 'none';
  document.getElementById('responseBodyContent').style.display = 'block';
  document.getElementById('responseBodyRaw').style.display = 'none';
  document.getElementById('responseBodyRaw').textContent = text;

  const preview = document.getElementById('responseBodyPreview');
  if (text.trim().startsWith('<')) {
    preview.srcdoc = text;
  } else {
    preview.srcdoc = `<pre style="font-family:monospace;white-space:pre-wrap;padding:12px">${escHtml(text)}</pre>`;
  }

  switchResponseMode('pretty');

  const tbody = document.getElementById('respHeadersBody');
  tbody.innerHTML = '';
  let headersHtml = '';
  response.headers.forEach((val, name) => {
    const row = `<tr><td>${escHtml(name)}</td><td>${escHtml(val)}</td></tr>`;
    headersHtml += row;
    tbody.innerHTML += row;
  });

  // Cookies
  let cookiesHtml = '';
  const cookieBody = document.getElementById('respCookiesBody');
  cookieBody.innerHTML = '';
  response.headers.forEach((val, name) => {
    if (name.toLowerCase() === 'set-cookie') {
      const parts = val.split(';').map(s => s.trim());
      const [nameVal, ...attrs] = parts;
      const [cName, cVal] = nameVal.split('=');
      const row = `<tr><td>${escHtml(cName)}</td><td>${escHtml(cVal || '')}</td><td>${escHtml(attrs.join('; '))}</td></tr>`;
      cookiesHtml += row;
      cookieBody.innerHTML += row;
    }
  });

  window._lastResponse = text;

  if (activeTabId && tabData[activeTabId]) {
    tabData[activeTabId].response = { statusHtml, meta, bodyHtml, bodyRaw: text, headersHtml, cookiesHtml };
  }

  addToHistory({ method: reqMethod || 'GET', url: reqUrl || '', status: response.status, time: elapsed, size });
  saveState();
}

function showError(msg) {
  document.getElementById('statusBadge').innerHTML = '<span class="status-badge status-4xx"><span class="status-dot"></span>Error</span>';
  document.getElementById('respMeta').textContent = '';
  document.getElementById('responsePlaceholder').style.display = 'none';
  document.getElementById('responseBodyContent').style.display = 'block';
  document.getElementById('responseBodyContent').textContent = `Request failed\n\n${msg}\n\nIf you see CORS errors, the server doesn't allow browser requests.\nThe desktop app bypasses CORS restrictions.`;
  document.getElementById('responseBodyRaw').textContent = msg;
  document.getElementById('curlBtn').style.display = 'inline-flex';
  document.getElementById('codeGenBtn').style.display = 'inline-flex';
  window._lastResponse = msg;
}

function renderTestResults(results) {
  const container = document.getElementById('testResultsContent');
  if (!container || !results || results.length === 0) return;
  container.innerHTML = '';
  let passed = 0, failed = 0;
  results.forEach(r => {
    if (r.passed) passed++; else failed++;
    const div = document.createElement('div');
    div.className = 'test-result ' + (r.passed ? 'test-pass' : 'test-fail');
    div.innerHTML = `<span class="test-icon">${r.passed ? '\u2713' : '\u2717'}</span> <span>${escHtml(r.name)}</span>${r.error ? `<span class="test-error">${escHtml(r.error)}</span>` : ''}`;
    container.appendChild(div);
  });
  const summary = document.createElement('div');
  summary.className = 'test-summary';
  summary.textContent = `${passed} passed, ${failed} failed`;
  container.prepend(summary);
  const badge = document.querySelector('.response-tab[data-tab="tests"] .tab-badge');
  if (badge) { badge.textContent = failed > 0 ? failed : passed; badge.className = 'tab-badge ' + (failed > 0 ? 'badge-fail' : 'badge-pass'); }
}
