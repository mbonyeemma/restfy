function genId() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 9);
}
function escHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
function syntaxHighlight(json) {
  if (json == null) return "";
  const s = String(json);
  let result = "";
  let lastIndex = 0;
  const re = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    result += escHtml(s.slice(lastIndex, m.index));
    const match = m[0];
    let cls = "json-number";
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? "json-key" : "json-string";
    } else if (/true|false/.test(match)) {
      cls = "json-bool";
    } else if (/null/.test(match)) {
      cls = "json-null";
    }
    result += '<span class="' + cls + '">' + escHtml(match) + "</span>";
    lastIndex = re.lastIndex;
  }
  result += escHtml(s.slice(lastIndex));
  return result;
}
function syntaxHighlightXml(xml) {
  let out = escHtml(xml);
  out = out.replace(/(&lt;\/?[\w:-]+)/g, '<span class="xml-tag">$1</span>');
  out = out.replace(/([\w:-]+)(=)(&quot;[^&]*&quot;)/g, '<span class="xml-attr">$1</span>$2<span class="xml-value">$3</span>');
  out = out.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xml-comment">$1</span>');
  return out;
}
function showNotif(msg, type = "info") {
  const n = document.getElementById("notif");
  if (!n) return;
  n.textContent = msg;
  n.className = "notif " + type;
  setTimeout(() => n.classList.add("show"), 10);
  setTimeout(() => n.classList.remove("show"), 2500);
}
navigator.platform.toUpperCase().indexOf("MAC") >= 0;
function appConfirm(title, message, opts) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("appDialogOverlay");
    const titleEl = document.getElementById("appDialogTitle");
    const bodyEl = document.getElementById("appDialogBody");
    const footerEl = document.getElementById("appDialogFooter");
    titleEl.textContent = title || "Confirm";
    bodyEl.innerHTML = "";
    bodyEl.textContent = message || "";
    footerEl.innerHTML = "";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-secondary";
    cancelBtn.textContent = opts?.cancelLabel || "Cancel";
    cancelBtn.onclick = () => {
      overlay.classList.remove("open");
      resolve(false);
    };
    const okBtn = document.createElement("button");
    okBtn.className = opts?.danger ? "btn-danger" : "btn-primary";
    okBtn.textContent = opts?.okLabel || "OK";
    okBtn.onclick = () => {
      overlay.classList.remove("open");
      resolve(true);
    };
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(okBtn);
    overlay.classList.add("open");
    okBtn.focus();
    overlay.onkeydown = (e) => {
      if (e.key === "Escape") {
        overlay.classList.remove("open");
        resolve(false);
      }
    };
  });
}
function appPrompt(title, message, opts) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("appDialogOverlay");
    const titleEl = document.getElementById("appDialogTitle");
    const bodyEl = document.getElementById("appDialogBody");
    const footerEl = document.getElementById("appDialogFooter");
    titleEl.textContent = title || "";
    bodyEl.innerHTML = "";
    if (message) {
      const p = document.createElement("div");
      p.textContent = message;
      bodyEl.appendChild(p);
    }
    const isTextarea = opts?.textarea;
    const input = document.createElement(isTextarea ? "textarea" : "input");
    input.className = isTextarea ? "app-dialog-textarea" : "app-dialog-input";
    if (!isTextarea) {
      input.type = opts?.inputType === "password" ? "password" : "text";
    }
    input.placeholder = opts?.placeholder || "";
    input.value = opts?.defaultValue || "";
    bodyEl.appendChild(input);
    footerEl.innerHTML = "";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-secondary";
    cancelBtn.textContent = opts?.cancelLabel || "Cancel";
    cancelBtn.onclick = () => {
      overlay.classList.remove("open");
      resolve(null);
    };
    const okBtn = document.createElement("button");
    okBtn.className = "btn-primary";
    okBtn.textContent = opts?.okLabel || "OK";
    const submit = () => {
      const val = input.value.trim();
      if (!val && !opts?.allowEmpty) return;
      overlay.classList.remove("open");
      resolve(val);
    };
    okBtn.onclick = submit;
    if (!isTextarea) input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(okBtn);
    overlay.classList.add("open");
    input.focus();
    if (!isTextarea && input.type !== "password") input.select();
    overlay.onkeydown = (e) => {
      if (e.key === "Escape") {
        overlay.classList.remove("open");
        resolve(null);
      }
    };
  });
}
function esc(s) {
  return s ? String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
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
function renderAuth(auth) {
  if (!auth?.type || auth.type === "none") return "";
  if (auth.type === "bearer") return `<div class="auth-badge"><strong>Bearer Token</strong></div>`;
  if (auth.type === "basic")
    return `<div class="auth-badge"><strong>Basic Auth</strong>${auth.username ? ` — ${esc(auth.username)}` : ""}</div>`;
  if (auth.type === "apikey")
    return `<div class="auth-badge"><strong>API Key</strong>${auth.key ? ` — ${esc(auth.key)} in ${esc(auth.in || "header")}` : ""}</div>`;
  if (auth.type === "oauth2") return `<div class="auth-badge"><strong>OAuth 2.0</strong></div>`;
  return `<div class="auth-badge"><strong>${esc(auth.type)}</strong></div>`;
}
function langLabel(lang) {
  const labels = {
    curl: "cURL",
    javascript: "JavaScript",
    python: "Python",
    php: "PHP",
    go: "Go"
  };
  return labels[lang] || lang;
}
const JSON_MARKER_START = "__RESTIFY_JSON_START__";
const JSON_MARKER_END = "__RESTIFY_JSON_END__";
function buildCodeSample(req, lang) {
  const m = req.method || "GET";
  let url = req.url || "";
  if (!url.startsWith("http")) url = "https://" + url;
  const params = (req.params || []).filter((p) => p.enabled !== false && p.key);
  if (params.length) {
    const qs = params.map((p) => encodeURIComponent(p.key) + "=" + encodeURIComponent(p.value)).join("&");
    url += (url.includes("?") ? "&" : "?") + qs;
  }
  const hdrs = (req.headers || []).filter((h) => h.enabled !== false && h.key);
  if (req.bodyType === "json" && !hdrs.find((h) => h.key.toLowerCase() === "content-type"))
    hdrs.push({ key: "Content-Type", value: "application/json" });
  if (req.auth?.type === "bearer" && req.auth.token)
    hdrs.push({ key: "Authorization", value: "Bearer " + req.auth.token });
  const body = m !== "GET" && m !== "HEAD" && (req.bodyType === "json" || req.bodyType === "raw") && req.body ? req.body : "";
  const isJsonBody = req.bodyType === "json" && !!body;
  const markJsonSegment = (segment) => isJsonBody ? `${JSON_MARKER_START}${segment}${JSON_MARKER_END}` : segment;
  switch (lang) {
    case "curl": {
      const parts = [`curl -X ${m}`, `  '${url}'`];
      hdrs.forEach((h) => {
        parts.push(`  -H '${h.key}: ${h.value}'`);
      });
      if (body) parts.push(`  -d '${markJsonSegment(body.replace(/'/g, "'\\''"))}'`);
      return parts.join(" \\\n");
    }
    case "javascript": {
      let s = "";
      if (!body && !hdrs.length) {
        s = `const response = await fetch('${url}'${m !== "GET" ? `, {
  method: '${m}'
}` : ""});
const data = await response.json();
console.log(data);`;
      } else {
        s = `const response = await fetch('${url}', {
  method: '${m}',`;
        if (hdrs.length) {
          s += `
  headers: {`;
          hdrs.forEach((h) => {
            s += `
    '${h.key}': '${h.value}',`;
          });
          s += `
  },`;
        }
        if (body) s += `
  body: JSON.stringify(${markJsonSegment(body)}),`;
        s += `
});
const data = await response.json();
console.log(data);`;
      }
      return s;
    }
    case "python": {
      let s = `import requests

`;
      if (hdrs.length) {
        s += `headers = {
`;
        hdrs.forEach((h) => {
          s += `    '${h.key}': '${h.value}',
`;
        });
        s += `}

`;
      }
      if (body) {
        s += `payload = ${markJsonSegment(body)}

`;
      }
      s += `response = requests.${m.toLowerCase()}(
    '${url}'`;
      if (hdrs.length) s += `,
    headers=headers`;
      if (body) s += `,
    json=payload`;
      s += `
)

print(response.json())`;
      return s;
    }
    case "php": {
      let s = `<?php
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => '${url}',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => '${m}',`;
      if (hdrs.length) {
        s += `
    CURLOPT_HTTPHEADER => [`;
        hdrs.forEach((h) => {
          s += `
        '${h.key}: ${h.value}',`;
        });
        s += `
    ],`;
      }
      if (body) s += `
    CURLOPT_POSTFIELDS => '${markJsonSegment(body.replace(/'/g, "\\'"))}',`;
      s += `
]);

$response = curl_exec($ch);
curl_close($ch);

echo $response;`;
      return s;
    }
    case "go": {
      let s = `package main

import (
	"fmt"
	"io"
	"net/http"
`;
      if (body) s += `	"strings"
`;
      s += `)

func main() {
`;
      if (body) {
        s += `	body := strings.NewReader(\`${markJsonSegment(body)}\`)
`;
        s += `	req, _ := http.NewRequest("${m}", "${url}", body)
`;
      } else {
        s += `	req, _ := http.NewRequest("${m}", "${url}", nil)
`;
      }
      hdrs.forEach((h) => {
        s += `	req.Header.Set("${h.key}", "${h.value}")
`;
      });
      s += `
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	fmt.Println(string(data))
}`;
      return s;
    }
    default:
      return "";
  }
}
function formatMaybeJsonBody(body, forceJson = false) {
  const raw = String(body || "");
  if (!raw) return { html: "", isJson: false };
  const trimmed = raw.trim();
  if (!trimmed) return { html: esc(raw), isJson: false };
  const shouldTryParse = forceJson || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!shouldTryParse) return { html: esc(raw), isJson: false };
  try {
    const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
    return { html: syntaxHighlight(pretty), isJson: true };
  } catch {
    return { html: esc(raw), isJson: false };
  }
}
function renderCodeSampleHtml(sample) {
  const src = String(sample || "");
  if (!src.includes(JSON_MARKER_START) || !src.includes(JSON_MARKER_END)) {
    return { html: esc(src), isJson: false };
  }
  let out = "";
  let cursor = 0;
  let hasJson = false;
  while (cursor < src.length) {
    const start = src.indexOf(JSON_MARKER_START, cursor);
    if (start === -1) {
      out += esc(src.slice(cursor));
      break;
    }
    out += esc(src.slice(cursor, start));
    const jsonStart = start + JSON_MARKER_START.length;
    const end = src.indexOf(JSON_MARKER_END, jsonStart);
    if (end === -1) {
      out += esc(src.slice(start));
      break;
    }
    const jsonFragment = src.slice(jsonStart, end);
    out += syntaxHighlight(jsonFragment);
    hasJson = true;
    cursor = end + JSON_MARKER_END.length;
  }
  return { html: out, isJson: hasJson };
}
function renderEndpoint(req) {
  const m = req.method || "GET";
  const mstyle = methodStyle(m);
  const params = (req.params || []).filter((p) => p.key && p.enabled !== false);
  const headers = (req.headers || []).filter((h) => h.key && h.enabled !== false);
  const hasBody = req.bodyType && req.bodyType !== "none";
  const hasAuth = req.auth?.type && req.auth.type !== "none" && req.auth.type !== "inherit";
  const epId = req.id;
  let left = `<div class="ep-headline"><span class="ep-method" style="${mstyle}">${esc(m)}</span><span class="ep-name">${esc(req.name)}</span></div>`;
  if (req.description) left += `<div class="ep-desc">${esc(req.description)}</div>`;
  if (req.url)
    left += `<div class="ep-url"><span>${esc(req.url)}</span><button class="copy-btn" onclick="copyInline(this,'${esc(req.url)}')">Copy</button></div>`;
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
      const body = formatMaybeJsonBody(req.body || "", req.bodyType === "json");
      left += `<div class="code-block${body.isJson ? " json-highlighted" : ""}"><pre>${body.html}</pre></div>`;
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
  const langs = ["curl", "javascript", "python", "php", "go"];
  const codeSamples = {};
  for (const lang of langs) codeSamples[lang] = buildCodeSample(req, lang);
  let right = `<div class="code-tabs" id="ct-${esc(epId)}">`;
  langs.forEach((lang, i) => {
    right += `<button class="code-tab${i === 0 ? " active" : ""}" data-lang="${lang}" onclick="switchCodeTab('${esc(epId)}','${lang}')">${langLabel(lang)}</button>`;
  });
  right += `</div>`;
  langs.forEach((lang, i) => {
    const sample = renderCodeSampleHtml(codeSamples[lang]);
    right += `<div class="code-block${sample.isJson ? " json-highlighted" : ""}" id="cb-${esc(epId)}-${lang}" style="${i > 0 ? "display:none" : ""}">
      <div class="code-block-header"><span>${langLabel(lang)}</span><button class="copy-btn" onclick="copyBlock('cb-${esc(epId)}-${lang}')">Copy</button></div>
      <pre>${sample.html}</pre>
    </div>`;
  });
  right += `<div class="try-it" id="tryit-${esc(epId)}">
    <div class="try-it-header">
      <span class="try-it-label">Try It</span>
      <button class="try-it-btn" id="tryit-btn-${esc(epId)}" onclick="sendTryIt('${esc(epId)}','${esc(m)}','${esc(req.url || "")}')">Send Request</button>
    </div>
    <div class="try-it-body">
      <input class="try-it-input" id="tryit-url-${esc(epId)}" value="${esc(req.url || "")}" placeholder="Request URL">
      ${hasBody && (req.bodyType === "json" || req.bodyType === "raw") ? `<textarea class="try-it-textarea" id="tryit-body-${esc(epId)}" placeholder="Request body">${esc(req.body || "")}</textarea>` : ""}
      <div id="tryit-result-${esc(epId)}"></div>
    </div>
  </div>`;
  return `<div class="endpoint" id="ep-${esc(epId)}"><div class="endpoint-row"><div class="ep-left">${left}</div><div class="ep-right">${right}</div></div></div>`;
}
function buildDocsContentHtml(col, meta) {
  let html = "";
  const reqs = allRequests(col);
  const folderCount = (col.children || []).filter((c) => c.type === "folder").length;
  const desc = col.description || "";
  const published = new Date(meta.createdAt * 1e3).toLocaleDateString(void 0, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  html += `<div class="collection-hero">
    <div class="collection-name">${esc(col.name)}</div>
    ${desc ? `<div class="collection-desc">${esc(desc)}</div>` : ""}
    <div class="collection-stats">
      <div class="stat-chip"><strong>${reqs.length}</strong> endpoint${reqs.length !== 1 ? "s" : ""}</div>
      ${folderCount ? `<div class="stat-chip"><strong>${folderCount}</strong> folder${folderCount !== 1 ? "s" : ""}</div>` : ""}
      ${meta.views ? `<div class="stat-chip"><strong>${meta.views}</strong> view${meta.views !== 1 ? "s" : ""}</div>` : ""}
      <div class="stat-chip">Published ${esc(published)}</div>
      ${meta.owner?.name ? `<div class="stat-chip">By <strong>${esc(meta.owner.name)}</strong></div>` : ""}
    </div>
  </div>`;
  if (col.auth?.type && col.auth.type !== "none") {
    html += `<div class="intro-auth"><div class="intro-auth-label">Collection Authorization</div>${renderAuth(col.auth)}</div>`;
  }
  function walkContent(children) {
    (children || []).forEach((child) => {
      if (child.type === "folder") {
        const auth = child.auth?.type && child.auth.type !== "none" && child.auth.type !== "inherit";
        const fid = child.id;
        const fd = child.description ? `<div class="folder-desc">${esc(child.description)}</div>` : "";
        const childCount = (child.children || []).filter((c) => c.type === "request").length;
        html += `<div class="folder-section open" id="fs-${esc(fid)}">
          <div class="folder-header" onclick="toggleFolderSection('${esc(fid)}')">
            <span class="folder-toggle"></span>
            <span class="folder-name">${esc(child.name)}</span>
            <span class="folder-count">${childCount}</span>
            ${auth ? `<span class="folder-auth-badge">${esc(child.auth.type)}</span>` : ""}
          </div>
          <div class="folder-body">${fd}`;
        walkContent(child.children);
        html += `</div></div>`;
      } else if (child.type === "request") {
        html += renderEndpoint(child);
      }
    });
  }
  walkContent(col.children || []);
  if (reqs.length === 0) {
    html += `<div class="error-wrap"><div class="error-title">No endpoints</div><div class="error-sub">This collection has no requests yet.</div></div>`;
  }
  return html;
}
export {
  appConfirm as a,
  buildDocsContentHtml as b,
  appPrompt as c,
  syntaxHighlight as d,
  escHtml as e,
  syntaxHighlightXml as f,
  genId as g,
  formatBytes as h,
  esc as i,
  countAll as j,
  showNotif as s
};
