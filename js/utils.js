// ═══════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════

function genId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function syntaxHighlight(json) {
  json = escHtml(json);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'json-key' : 'json-string';
    } else if (/true|false/.test(match)) {
      cls = 'json-bool';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

function syntaxHighlightXml(xml) {
  xml = escHtml(xml);
  xml = xml.replace(/(&lt;\/?[\w:-]+)/g, '<span class="xml-tag">$1</span>');
  xml = xml.replace(/([\w:-]+)(=)(&quot;[^&]*&quot;)/g, '<span class="xml-attr">$1</span>$2<span class="xml-value">$3</span>');
  xml = xml.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xml-comment">$1</span>');
  return xml;
}

function showNotif(msg, type) {
  type = type || 'info';
  const n = document.getElementById('notif');
  n.textContent = msg;
  n.className = 'notif ' + type;
  setTimeout(() => n.classList.add('show'), 10);
  setTimeout(() => n.classList.remove('show'), 2500);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const COMMON_HEADERS = [
  'Accept','Accept-Encoding','Accept-Language','Authorization',
  'Cache-Control','Connection','Content-Type','Cookie',
  'Host','If-Modified-Since','If-None-Match','Origin',
  'Referer','User-Agent','X-API-Key','X-CSRF-Token',
  'X-Forwarded-For','X-Requested-With'
];

const COMMON_CONTENT_TYPES = [
  'application/json','application/xml','application/x-www-form-urlencoded',
  'multipart/form-data','text/plain','text/html','text/xml'
];
