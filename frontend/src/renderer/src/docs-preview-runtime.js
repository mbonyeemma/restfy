/* eslint-disable */
function esc(s) {
  return s
    ? String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    : ''
}

window.switchCodeTab = function (epId, lang) {
  const tabs = document.getElementById('ct-' + epId)
  if (!tabs) return
  tabs.querySelectorAll('.code-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang)
  })
  const allLangs = ['curl', 'javascript', 'python', 'php', 'go']
  allLangs.forEach(function (l) {
    const block = document.getElementById('cb-' + epId + '-' + l)
    if (block) block.style.display = l === lang ? '' : 'none'
  })
}

window.sendTryIt = async function (epId, method, _origUrl) {
  const urlInput = document.getElementById('tryit-url-' + epId)
  const bodyInput = document.getElementById('tryit-body-' + epId)
  const resultDiv = document.getElementById('tryit-result-' + epId)
  const btn = document.getElementById('tryit-btn-' + epId)
  if (!urlInput || !resultDiv) return

  let url = urlInput.value.trim()
  if (!url) return
  if (!url.startsWith('http')) url = 'https://' + url

  btn.disabled = true
  btn.textContent = 'Sending…'
  resultDiv.innerHTML = ''

  const start = performance.now()
  try {
    const opts = { method: method, mode: 'cors' }
    if (bodyInput && bodyInput.value && method !== 'GET' && method !== 'HEAD') {
      opts.body = bodyInput.value
      opts.headers = { 'Content-Type': 'application/json' }
    }
    const resp = await fetch(url, opts)
    const elapsed = Math.round(performance.now() - start)
    const text = await resp.text()
    let display = text
    try {
      display = JSON.stringify(JSON.parse(text), null, 2)
    } catch (e) {}

    const statusClass = resp.status < 300 ? 's2xx' : resp.status < 500 ? 's4xx' : 's5xx'
    resultDiv.innerHTML =
      '<div class="try-it-response">' +
      '<div class="try-it-resp-header">' +
      '<span class="try-it-resp-status ' +
      statusClass +
      '">' +
      resp.status +
      ' ' +
      esc(resp.statusText) +
      '</span>' +
      '<span class="try-it-resp-time">' +
      elapsed +
      'ms</span>' +
      '<button class="copy-btn" style="margin-left:auto" onclick="copyInline(this,document.getElementById(\'tryit-resp-body-' +
      epId +
      '\').textContent)">Copy</button>' +
      '</div>' +
      '<div class="try-it-resp-body" id="tryit-resp-body-' +
      epId +
      '">' +
      esc(display) +
      '</div>' +
      '</div>'
  } catch (err) {
    resultDiv.innerHTML =
      '<div style="color:var(--red);font-size:12px;padding:8px">Error: ' + esc(err.message) + '</div>'
  } finally {
    btn.disabled = false
    btn.textContent = 'Send Request'
  }
}

window.copyInline = function (btn, text) {
  navigator.clipboard.writeText(String(text)).then(function () {
    const orig = btn.textContent
    btn.textContent = 'Copied!'
    setTimeout(function () {
      btn.textContent = orig
    }, 1500)
  }).catch(function () {})
}

window.copyBlock = function (blockId) {
  const block = document.getElementById(blockId)
  if (!block) return
  const pre = block.querySelector('pre')
  if (!pre) return
  const btn = block.querySelector('.copy-btn')
  navigator.clipboard.writeText(pre.textContent || '').then(function () {
    if (btn) {
      const orig = btn.textContent
      btn.textContent = 'Copied!'
      setTimeout(function () {
        btn.textContent = orig
      }, 1500)
    }
  }).catch(function () {})
}
