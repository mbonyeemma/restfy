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
  if (json == null) return '';
  const s = String(json);
  let result = '';
  let lastIndex = 0;
  const re = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    result += escHtml(s.slice(lastIndex, m.index));
    const match = m[0];
    let cls = 'json-number';
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'json-key' : 'json-string';
    } else if (/true|false/.test(match)) {
      cls = 'json-bool';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    result += '<span class="' + cls + '">' + escHtml(match) + '</span>';
    lastIndex = re.lastIndex;
  }
  result += escHtml(s.slice(lastIndex));
  return result;
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

const _isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const _modKey = _isMac ? '⌘' : 'Ctrl';

/** Promise-based in-app confirm dialog. Returns true/false. */
function appConfirm(title, message, opts) {
  return new Promise(resolve => {
    const overlay = document.getElementById('appDialogOverlay');
    const titleEl = document.getElementById('appDialogTitle');
    const bodyEl = document.getElementById('appDialogBody');
    const footerEl = document.getElementById('appDialogFooter');
    titleEl.textContent = title || 'Confirm';
    bodyEl.innerHTML = '';
    bodyEl.textContent = message || '';
    const danger = opts && opts.danger;
    footerEl.innerHTML = '';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = (opts && opts.cancelLabel) || 'Cancel';
    cancelBtn.onclick = () => { overlay.classList.remove('open'); resolve(false); };
    const okBtn = document.createElement('button');
    okBtn.className = danger ? 'btn-danger' : 'btn-primary';
    okBtn.textContent = (opts && opts.okLabel) || 'OK';
    okBtn.onclick = () => { overlay.classList.remove('open'); resolve(true); };
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(okBtn);
    overlay.classList.add('open');
    okBtn.focus();
    overlay.onkeydown = (e) => {
      if (e.key === 'Escape') { overlay.classList.remove('open'); resolve(false); }
    };
  });
}

/** Promise-based in-app prompt dialog. Returns string or null. */
function appPrompt(title, message, opts) {
  return new Promise(resolve => {
    const overlay = document.getElementById('appDialogOverlay');
    const titleEl = document.getElementById('appDialogTitle');
    const bodyEl = document.getElementById('appDialogBody');
    const footerEl = document.getElementById('appDialogFooter');
    titleEl.textContent = title || '';
    bodyEl.innerHTML = '';
    if (message) {
      const p = document.createElement('div');
      p.textContent = message;
      bodyEl.appendChild(p);
    }
    const isTextarea = opts && opts.textarea;
    const input = document.createElement(isTextarea ? 'textarea' : 'input');
    input.className = isTextarea ? 'app-dialog-textarea' : 'app-dialog-input';
    if (!isTextarea) input.type = 'text';
    input.placeholder = (opts && opts.placeholder) || '';
    input.value = (opts && opts.defaultValue) || '';
    bodyEl.appendChild(input);
    footerEl.innerHTML = '';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = (opts && opts.cancelLabel) || 'Cancel';
    cancelBtn.onclick = () => { overlay.classList.remove('open'); resolve(null); };
    const okBtn = document.createElement('button');
    okBtn.className = 'btn-primary';
    okBtn.textContent = (opts && opts.okLabel) || 'OK';
    const submit = () => {
      const val = input.value.trim();
      if (!val && !(opts && opts.allowEmpty)) return;
      overlay.classList.remove('open');
      resolve(val);
    };
    okBtn.onclick = submit;
    if (!isTextarea) input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(okBtn);
    overlay.classList.add('open');
    input.focus();
    if (!isTextarea) input.select();
    overlay.onkeydown = (e) => {
      if (e.key === 'Escape') { overlay.classList.remove('open'); resolve(null); }
    };
  });
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
