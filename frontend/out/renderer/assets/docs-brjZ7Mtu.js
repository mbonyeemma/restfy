(function initConfigDomains() {
  if (typeof window === "undefined" || !window.location) return;
  const h = String(window.location.hostname || "").toLowerCase();
  if (h === "app.restify.online") {
    window.__RESTIFY_API_BASE__ = "https://api.restify.online";
  }
})();
(function initApiBase() {
  function trimSlash(s) {
    return String(s || "").replace(/\/+$/, "");
  }
  function getApiBase() {
    const w = window.__RESTIFY_API_BASE__;
    if (w != null && String(w).trim() !== "") return trimSlash(w);
    const leg = window.__RESTFY_API_BASE__;
    if (leg != null && String(leg).trim() !== "") return trimSlash(leg);
    return "";
  }
  window.getRestifyApiBase = getApiBase;
  window.restifyApiUrl = function(path) {
    const p = path.charAt(0) === "/" ? path : "/" + path;
    const base = getApiBase();
    return base ? base + p : p;
  };
  window.restifyFetch = (url, opts) => fetch(url, opts);
})();
function esc(s) {
  return s ? String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
}
function getCollectionId() {
  const path = window.location.pathname || "";
  const qs = new URLSearchParams(window.location.search);
  const fromQuery = qs.get("slug") || qs.get("id");
  if (fromQuery) return fromQuery;
  const m = path.match(/^\/docs\/(.+?)\/?$/);
  if (m) return decodeURIComponent(m[1]);
  const parts = path.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}
const METHOD_COLOR = {
  GET: "var(--green)",
  POST: "var(--yellow)",
  PUT: "var(--blue)",
  PATCH: "var(--purple)",
  DELETE: "var(--red)",
  HEAD: "var(--cyan)",
  OPTIONS: "var(--orange)"
};
const METHOD_BG = {
  GET: "var(--green-bg)",
  POST: "var(--yellow-bg)",
  PUT: "var(--blue-bg)",
  PATCH: "var(--purple-bg)",
  DELETE: "var(--red-bg)",
  HEAD: "var(--cyan-bg)",
  OPTIONS: "var(--orange-bg)"
};
function methodStyle(m) {
  return `color:${METHOD_COLOR[m] || "var(--text-dim)"};background:${METHOD_BG[m] || "var(--bg-hover)"}`;
}
async function loadDocs() {
  const id = getCollectionId();
  if (!id) {
    showError("No collection ID in URL.");
    return;
  }
  try {
    const resp = await fetch(window.restifyApiUrl(`/api/shared/${id}`));
    if (!resp.ok) throw new Error(resp.status === 404 ? "Documentation not found" : "Server error " + resp.status);
    const data = await resp.json();
    render(data);
  } catch (err) {
    showError(err.message);
  }
}
function showError(msg) {
  const content = document.getElementById("docsContent");
  if (content) content.innerHTML = `
    <div class="error-wrap">
      <div class="error-icon">📄</div>
      <div class="error-title">${esc(msg)}</div>
      <div class="error-sub">This link may have expired or the collection is private.</div>
    </div>`;
  const title = document.getElementById("topbarTitle");
  if (title) title.textContent = "Not Found";
}
function countAll(node) {
  if (node.type === "request") return 1;
  if (!node.children) return 0;
  return node.children.reduce((s, c) => s + countAll(c), 0);
}
function allRequests(node, acc = []) {
  if (node.type === "request") acc.push(node);
  if (node.children) node.children.forEach((c) => allRequests(c, acc));
  return acc;
}
function render(data) {
  const col = data.collection;
  const total = countAll(col);
  document.title = data.name + " — API Docs — Restify";
  const topbarTitle = document.getElementById("topbarTitle");
  if (topbarTitle) topbarTitle.textContent = data.name;
  const topbarMeta = document.getElementById("topbarMeta");
  if (topbarMeta) topbarMeta.innerHTML = `<span>${total} endpoint${total !== 1 ? "s" : ""}</span>${data.views > 0 ? `<span>· ${data.views} view${data.views !== 1 ? "s" : ""}</span>` : ""}`;
  const openBtn = document.getElementById("openBtn");
  if (openBtn) openBtn.href = `https://app.restify.online/?import=${data.id}`;
  const sidebarTitle = document.getElementById("sidebarTitle");
  if (sidebarTitle) sidebarTitle.textContent = data.name;
  const sidebarCount = document.getElementById("sidebarCount");
  if (sidebarCount) sidebarCount.textContent = total + " endpoint" + (total !== 1 ? "s" : "");
  buildSidebar(col);
  buildContent(col, data);
}
function buildSidebar(col) {
  const nav = document.getElementById("sidebarNav");
  if (!nav) return;
  let html = "";
  function walk(children, depth) {
    (children || []).forEach((child) => {
      if (child.type === "folder") {
        const fid = "sf-" + child.id;
        html += `<div class="sidebar-folder" onclick="toggleFolder('${esc(child.id)}')" id="sfh-${esc(child.id)}">
          <span class="sidebar-folder-arrow open" id="sfa-${esc(child.id)}">▶</span>
          <span>📁 ${esc(child.name)}</span>
        </div>
        <div id="${fid}">`;
        walk(child.children, depth + 1);
        html += "</div>";
      } else if (child.type === "request") {
        const cls = depth === 0 ? "sidebar-item root-level" : "sidebar-item";
        html += `<div class="${cls}" data-id="${child.id}" onclick="scrollToEndpoint('${child.id}')">
          <span class="m-badge m-${esc(child.method || "GET")}">${esc(child.method || "GET")}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(child.name)}</span>
        </div>`;
      }
    });
  }
  walk(col.children || [], 0);
  nav.innerHTML = html;
}
window.toggleFolder = function(fid) {
  const el = document.getElementById("sf-" + fid);
  const arrow = document.getElementById("sfa-" + fid);
  if (!el) return;
  const open = el.style.display !== "none";
  el.style.display = open ? "none" : "";
  if (arrow) arrow.classList.toggle("open", !open);
};
window.scrollToEndpoint = function(id) {
  const el = document.getElementById("ep-" + id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelectorAll(".sidebar-item").forEach((s) => s.classList.remove("active"));
    const sideItem = document.querySelector(`.sidebar-item[data-id="${id}"]`);
    if (sideItem) sideItem.classList.add("active");
  }
};
function buildContent(col, meta) {
  const container = document.getElementById("docsContent");
  if (!container) return;
  let html = "";
  const reqs = allRequests(col);
  const folderCount = (col.children || []).filter((c) => c.type === "folder").length;
  const desc = col.description || "";
  const published = new Date(meta.createdAt * 1e3).toLocaleDateString(void 0, { year: "numeric", month: "short", day: "numeric" });
  html += `<div class="collection-intro">
    <div class="collection-name">${esc(col.name)}</div>
    ${desc ? `<div class="collection-desc">${esc(desc)}</div>` : ""}
    <div class="collection-meta">
      <div class="meta-pill"><strong>${reqs.length}</strong> endpoint${reqs.length !== 1 ? "s" : ""}</div>
      ${folderCount ? `<div class="meta-pill"><strong>${folderCount}</strong> folder${folderCount !== 1 ? "s" : ""}</div>` : ""}
      ${meta.views ? `<div class="meta-pill"><strong>${meta.views}</strong> view${meta.views !== 1 ? "s" : ""}</div>` : ""}
      <div class="meta-pill">Published ${esc(published)}</div>
      ${meta.owner?.name ? `<div class="meta-pill">By <strong>${esc(meta.owner.name)}</strong></div>` : ""}
    </div>
  </div>`;
  if (col.auth?.type && col.auth.type !== "none") {
    html += `<div class="intro-auth"><div class="intro-auth-label">Collection Authorization</div>${renderAuth(col.auth)}</div>`;
  }
  function walkContent(children) {
    (children || []).forEach((child) => {
      if (child.type === "folder") {
        const auth = child.auth?.type && child.auth.type !== "none" && child.auth.type !== "inherit";
        html += `<div class="folder-section">
          <div class="folder-header">
            <span class="folder-icon">📁</span>
            <span class="folder-name">${esc(child.name)}</span>
            ${auth ? `<span class="folder-auth-badge">${esc(child.auth.type)}</span>` : ""}
          </div>`;
        walkContent(child.children);
        html += `</div>`;
      } else if (child.type === "request") {
        html += renderEndpoint(child);
      }
    });
  }
  walkContent(col.children || []);
  if (reqs.length === 0) {
    html += `<div class="error-wrap"><div class="error-icon">📭</div><div class="error-title">No endpoints</div><div class="error-sub">This collection has no requests yet.</div></div>`;
  }
  container.innerHTML = html;
}
function renderEndpoint(req) {
  const m = req.method || "GET";
  const mstyle = methodStyle(m);
  const params = (req.params || []).filter((p) => p.key && p.enabled !== false);
  const headers = (req.headers || []).filter((h) => h.key && h.enabled !== false);
  const hasBody = req.bodyType && req.bodyType !== "none";
  const hasAuth = req.auth?.type && req.auth.type !== "none" && req.auth.type !== "inherit";
  let left = `<div class="ep-headline"><span class="ep-method" style="${mstyle}">${esc(m)}</span><span class="ep-name">${esc(req.name)}</span></div>`;
  if (req.description) left += `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.7;white-space:pre-wrap">${esc(req.description)}</div>`;
  if (req.url) left += `<div class="ep-url"><span>${esc(req.url)}</span><button class="copy-btn" onclick="copyInline(this,'${esc(req.url)}')">Copy</button></div>`;
  if (hasAuth) left += `<div class="section-label">Authorization</div>${renderAuth(req.auth)}`;
  if (params.length) {
    left += `<div class="section-label">Query Parameters</div><table class="params-table"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>`;
    params.forEach((p) => {
      left += `<tr><td>${esc(p.key)}</td><td>${esc(p.value)}</td></tr>`;
    });
    left += `</tbody></table>`;
  }
  if (headers.length) {
    left += `<div class="section-label">Headers</div><table class="params-table"><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>`;
    headers.forEach((h) => {
      left += `<tr><td>${esc(h.key)}</td><td>${esc(h.value)}</td></tr>`;
    });
    left += `</tbody></table>`;
  }
  if (hasBody) {
    left += `<div class="section-label">Body <span style="text-transform:none;letter-spacing:0;font-weight:400">(${esc(req.bodyType)})</span></div>`;
    if (req.bodyType === "json" || req.bodyType === "raw" || req.bodyType === "graphql") {
      let display = req.body || "";
      if (req.bodyType === "json") {
        try {
          display = JSON.stringify(JSON.parse(display), null, 2);
        } catch {
        }
      }
      left += `<div class="curl-block"><pre>${esc(display)}</pre><div class="curl-copy"><button class="copy-btn" onclick="copyInline(this,\`${display.replace(/`/g, "\\`")}\`)">Copy</button></div></div>`;
    } else if (req.bodyType === "form" || req.bodyType === "urlencoded") {
      const fields = (req.bodyForm || []).filter((f) => f.key);
      if (fields.length) {
        left += `<table class="params-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>`;
        fields.forEach((f) => {
          left += `<tr><td>${esc(f.key)}</td><td>${esc(f.value)}</td></tr>`;
        });
        left += `</tbody></table>`;
      }
    }
  }
  const curl = buildCurl(req);
  const right = `<div class="curl-label"><span>Example Request</span></div><div class="curl-block"><pre>${esc(curl)}</pre><div class="curl-copy"><button class="copy-btn" onclick="copyInline(this,\`${curl.replace(/`/g, "\\`")}\`)">Copy</button></div></div>`;
  return `<div class="endpoint" id="ep-${esc(req.id)}"><div class="endpoint-row"><div class="ep-left">${left}</div><div class="ep-right">${right}</div></div></div>`;
}
function renderAuth(auth) {
  if (!auth?.type || auth.type === "none") return "";
  if (auth.type === "bearer") return `<div class="auth-badge">🔒 <strong>Bearer Token</strong></div>`;
  if (auth.type === "basic") return `<div class="auth-badge">🔒 <strong>Basic Auth</strong>${auth.username ? ` — ${esc(auth.username)}` : ""}</div>`;
  if (auth.type === "apikey") return `<div class="auth-badge">🔑 <strong>API Key</strong>${auth.key ? ` — ${esc(auth.key)} in ${esc(auth.in || "header")}` : ""}</div>`;
  if (auth.type === "oauth2") return `<div class="auth-badge">🔐 <strong>OAuth 2.0</strong></div>`;
  return `<div class="auth-badge">🔒 <strong>${esc(auth.type)}</strong></div>`;
}
function buildCurl(req) {
  let url = req.url || "";
  if (!url.startsWith("http")) url = "https://" + url;
  const params = (req.params || []).filter((p) => p.enabled !== false && p.key);
  if (params.length) {
    const qs = params.map((p) => encodeURIComponent(p.key) + "=" + encodeURIComponent(p.value)).join("&");
    url += (url.includes("?") ? "&" : "?") + qs;
  }
  const m = req.method || "GET";
  const parts = [`curl -X ${m}`, `  '${url}'`];
  const hdrs = (req.headers || []).filter((h) => h.enabled !== false && h.key);
  if (req.bodyType === "json" && !hdrs.find((h) => h.key.toLowerCase() === "content-type")) hdrs.push({ key: "Content-Type", value: "application/json" });
  if (req.auth?.type === "bearer" && req.auth.token) hdrs.push({ key: "Authorization", value: "Bearer " + req.auth.token });
  hdrs.forEach((h) => {
    parts.push(`  -H '${h.key}: ${h.value}'`);
  });
  if (m !== "GET" && m !== "HEAD" && (req.bodyType === "json" || req.bodyType === "raw") && req.body) {
    parts.push(`  -d '${req.body.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(" \\\n");
}
window.copyInline = function(btn, text) {
  navigator.clipboard.writeText(String(text)).then(() => {
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.textContent = orig;
    }, 1500);
  }).catch(() => {
  });
};
window.toggleTheme = function() {
  const html = document.documentElement;
  const next = (html.getAttribute("data-theme") || "dark") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("restify_docs_theme", next);
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) themeBtn.textContent = next === "dark" ? "☾" : "☀";
};
(function initTheme() {
  const saved = localStorage.getItem("restify_docs_theme") || localStorage.getItem("restfy_docs_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) themeBtn.textContent = saved === "dark" ? "☾" : "☀";
})();
loadDocs();
