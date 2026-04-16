import { i as esc, d as syntaxHighlight, j as countAll, b as buildDocsContentHtml } from "./published-docs-html-Cm_jmT7Y.js";
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
function formatMaybeJson(raw) {
  const text = String(raw || "");
  const trimmed = text.trim();
  if (!trimmed) return { html: esc(text), isJson: false };
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return { html: esc(text), isJson: false };
  try {
    const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
    return { html: syntaxHighlight(pretty), isJson: true };
  } catch {
    return { html: esc(text), isJson: false };
  }
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
let _allEndpoints = [];
let _sidebarItems = [];
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
      <div class="error-icon"></div>
      <div class="error-title">${esc(msg)}</div>
      <div class="error-sub">This link may have expired or the collection is private.</div>
    </div>`;
  const title = document.getElementById("topbarTitle");
  if (title) title.textContent = "Not Found";
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
  setupScrollTracking();
}
function buildSidebar(col) {
  const nav = document.getElementById("sidebarNav");
  if (!nav) return;
  let html = "";
  function walk(children, depth) {
    (children || []).forEach((child) => {
      if (child.type === "folder") {
        const count = countAll(child);
        html += `<div class="sidebar-folder" onclick="toggleFolder('${esc(child.id)}')" id="sfh-${esc(child.id)}">
          <span class="sidebar-folder-arrow open" id="sfa-${esc(child.id)}">▶</span>
          <span>${esc(child.name)}</span>
          <span class="sidebar-folder-count">${count}</span>
        </div>
        <div id="sf-${esc(child.id)}">`;
        walk(child.children, depth + 1);
        html += "</div>";
      } else if (child.type === "request") {
        const cls = depth === 0 ? "sidebar-item root-level" : "sidebar-item";
        html += `<div class="${cls}" data-id="${child.id}" data-name="${esc((child.name || "").toLowerCase())}" data-method="${esc(child.method || "GET")}" onclick="scrollToEndpoint('${child.id}')">
          <span class="m-badge m-${esc(child.method || "GET")}">${esc(child.method || "GET")}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(child.name)}</span>
        </div>`;
      }
    });
  }
  walk(col.children || [], 0);
  nav.innerHTML = html;
  _sidebarItems = Array.from(nav.querySelectorAll(".sidebar-item"));
}
window.toggleFolderSection = function(fid) {
  const el = document.getElementById("fs-" + fid);
  if (el) el.classList.toggle("open");
};
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
    _setActiveEndpoint(id);
  }
};
function _setActiveEndpoint(id) {
  _sidebarItems.forEach((s) => s.classList.remove("active"));
  const sideItem = document.querySelector(`.sidebar-item[data-id="${id}"]`);
  if (sideItem) {
    sideItem.classList.add("active");
    sideItem.scrollIntoView({ block: "nearest" });
  }
}
window.filterEndpoints = function(query) {
  const q = query.trim().toLowerCase();
  _sidebarItems.forEach((item) => {
    const name = item.getAttribute("data-name") || "";
    const method = (item.getAttribute("data-method") || "").toLowerCase();
    const match = !q || name.includes(q) || method.includes(q);
    item.style.display = match ? "" : "none";
  });
  _allEndpoints.forEach((ep) => {
    const id = ep.id.replace("ep-", "");
    const sideItem = document.querySelector(`.sidebar-item[data-id="${id}"]`);
    if (sideItem) {
      ep.style.display = sideItem.style.display;
    }
  });
};
function setupScrollTracking() {
  const content = document.getElementById("docsContent");
  if (!content) return;
  _allEndpoints = Array.from(content.querySelectorAll(".endpoint"));
  let ticking = false;
  content.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const scrollTop = content.scrollTop + 120;
      let activeId = "";
      for (const ep of _allEndpoints) {
        if (ep.offsetTop <= scrollTop) {
          activeId = ep.id.replace("ep-", "");
        }
      }
      if (activeId) _setActiveEndpoint(activeId);
    });
  });
}
function buildContent(col, meta) {
  const container = document.getElementById("docsContent");
  if (!container) return;
  container.innerHTML = buildDocsContentHtml(col, meta);
}
window.switchCodeTab = function(epId, lang) {
  const tabs = document.getElementById("ct-" + epId);
  if (!tabs) return;
  tabs.querySelectorAll(".code-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
  });
  const allLangs = ["curl", "javascript", "python", "php", "go"];
  allLangs.forEach((l) => {
    const block = document.getElementById(`cb-${epId}-${l}`);
    if (block) block.style.display = l === lang ? "" : "none";
  });
};
window.sendTryIt = async function(epId, method, _origUrl) {
  const urlInput = document.getElementById(`tryit-url-${epId}`);
  const bodyInput = document.getElementById(`tryit-body-${epId}`);
  const resultDiv = document.getElementById(`tryit-result-${epId}`);
  const btn = document.getElementById(`tryit-btn-${epId}`);
  if (!urlInput || !resultDiv) return;
  let url = urlInput.value.trim();
  if (!url) return;
  if (!url.startsWith("http")) url = "https://" + url;
  btn.disabled = true;
  btn.textContent = "Sending…";
  resultDiv.innerHTML = "";
  const start = performance.now();
  try {
    const opts = { method, mode: "cors" };
    if (bodyInput?.value && method !== "GET" && method !== "HEAD") {
      opts.body = bodyInput.value;
      opts.headers = { "Content-Type": "application/json" };
    }
    const resp = await fetch(url, opts);
    const elapsed = Math.round(performance.now() - start);
    const text = await resp.text();
    const formatted = formatMaybeJson(text);
    const statusClass = resp.status < 300 ? "s2xx" : resp.status < 500 ? "s4xx" : "s5xx";
    resultDiv.innerHTML = `<div class="try-it-response">
      <div class="try-it-resp-header">
        <span class="try-it-resp-status ${statusClass}">${resp.status} ${resp.statusText}</span>
        <span class="try-it-resp-time">${elapsed}ms</span>
        <button class="copy-btn" style="margin-left:auto" onclick="copyInline(this,document.getElementById('tryit-resp-body-${esc(epId)}').textContent)">Copy</button>
      </div>
      <div class="try-it-resp-body${formatted.isJson ? " json-highlighted" : ""}" id="tryit-resp-body-${esc(epId)}">${formatted.html}</div>
    </div>`;
  } catch (err) {
    resultDiv.innerHTML = `<div style="color:var(--red);font-size:12px;padding:8px">Error: ${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Send Request";
  }
};
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
window.copyBlock = function(blockId) {
  const block = document.getElementById(blockId);
  if (!block) return;
  const pre = block.querySelector("pre");
  if (!pre) return;
  const btn = block.querySelector(".copy-btn");
  navigator.clipboard.writeText(pre.textContent || "").then(() => {
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = orig;
      }, 1500);
    }
  }).catch(() => {
  });
};
window.toggleTheme = function() {
  const html = document.documentElement;
  const next = (html.getAttribute("data-theme") || "light") === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("restify_docs_theme", next);
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) themeBtn.textContent = next === "dark" ? "☾" : "☀";
};
(function initTheme() {
  const saved = localStorage.getItem("restify_docs_theme") || localStorage.getItem("restfy_docs_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) themeBtn.textContent = saved === "dark" ? "☾" : "☀";
})();
loadDocs();
