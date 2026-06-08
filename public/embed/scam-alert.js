/*! asq-growth-cta-v1 — embeddable ScamCheck "scam alert" signup widget.
 * Drop into any A Square Solutions blog post:
 *   <div data-scamcheck-alert data-source="blog:<post-slug>"></div>
 *   <script src="https://scamcheck.asquaresolution.com/embed/scam-alert.js" defer></script>
 * Posts to the CORS-enabled /api/newsletter (double opt-in + honeypot + rate
 * limit + idempotency handled server-side). Self-contained: no deps, scoped
 * styles, progressive enhancement (renders nothing if JS is off → no CLS risk).
 * Rollback: remove the markup + this file (asq-growth-cta-v1).
 */
(function () {
  'use strict'
  var DEFAULT_ENDPOINT = 'https://scamcheck.asquaresolution.com/api/newsletter'
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

  function device() {
    try {
      var ua = navigator.userAgent || ''
      if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet'
      if (/Mobi|iPhone|Android|IEMobile|Opera Mini/i.test(ua)) return 'mobile'
    } catch (e) {}
    var w = window.innerWidth || 1280
    return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'
  }

  function el(tag, attrs, html) {
    var n = document.createElement(tag)
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k])
    if (html != null) n.innerHTML = html
    return n
  }

  function styleOnce() {
    if (document.getElementById('asq-sca-style')) return
    var css =
      '.asq-sca{border:1px solid rgba(14,165,233,.3);background:rgba(14,165,233,.06);border-radius:12px;padding:16px;margin:20px 0;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#18181b}' +
      '.asq-sca h4{margin:0 0 4px;font-size:16px;font-weight:700;color:#0c4a6e}' +
      '.asq-sca p{margin:0 0 10px;font-size:13px;color:#3f3f46}' +
      '.asq-sca form{display:flex;gap:8px;flex-wrap:wrap}' +
      '.asq-sca input[type=email]{flex:1;min-width:200px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font-size:14px}' +
      '.asq-sca button{background:#0ea5e9;color:#fff;font-weight:600;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer}' +
      '.asq-sca button:disabled{opacity:.6;cursor:default}' +
      '.asq-sca .asq-fine{margin:8px 0 0;font-size:11px;color:#71717a}' +
      '.asq-sca .asq-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
      '.asq-sca .asq-msg{margin:8px 0 0;font-size:13px}' +
      '.asq-sca .asq-ok{color:#047857}.asq-sca .asq-err{color:#dc2626}'
    var s = el('style', { id: 'asq-sca-style' })
    s.appendChild(document.createTextNode(css))
    document.head.appendChild(s)
  }

  function mount(host) {
    if (host.getAttribute('data-asq-mounted') === '1') return
    host.setAttribute('data-asq-mounted', '1')
    var endpoint = host.getAttribute('data-endpoint') || DEFAULT_ENDPOINT
    var source = host.getAttribute('data-source') || 'blog-scam-alert'
    var heading = host.getAttribute('data-heading') || '⚠️ New scams every week. Stay one step ahead.'
    var sub = host.getAttribute('data-sub') || 'Get a free 2-minute weekly heads-up on the scams doing the rounds. Unsubscribe anytime.'

    host.className = 'asq-sca'
    host.appendChild(el('h4', null, heading))
    host.appendChild(el('p', null, sub))

    var form = el('form', { novalidate: 'novalidate' })
    var input = el('input', { type: 'email', required: 'required', placeholder: 'your@email.com', 'aria-label': 'Email address', autocomplete: 'email' })
    var hp = el('input', { type: 'text', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', class: 'asq-hp' })
    var btn = el('button', { type: 'submit' }, 'Send me scam alerts')
    form.appendChild(input); form.appendChild(hp); form.appendChild(btn)
    host.appendChild(form)
    host.appendChild(el('p', { class: 'asq-fine' }, 'Free. Unsubscribe anytime. We never share your email.'))
    var msg = el('p', { class: 'asq-msg', role: 'status', 'aria-live': 'polite' })
    host.appendChild(msg)

    function track(ev) { try { (window.dataLayer = window.dataLayer || []).push({ event: ev, source: source }) } catch (e) {} }
    track('newsletter_prompt_shown')

    form.addEventListener('submit', function (e) {
      e.preventDefault()
      var email = (input.value || '').trim()
      if (!EMAIL_RE.test(email)) { msg.className = 'asq-msg asq-err'; msg.textContent = 'Please enter a valid email.'; return }
      btn.disabled = true; var label = btn.textContent; btn.textContent = 'Sending…'; msg.textContent = ''
      track('newsletter_submit_attempt')
      fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email, consent: true, source: source, verdict: 'na', device: device(), hp: hp.value || '' }),
      }).then(function (r) {
        return r.json().catch(function () { return {} }).then(function (d) { return { ok: r.ok, status: r.status, d: d } })
      }).then(function (res) {
        if (res.ok) {
          msg.className = 'asq-msg asq-ok'
          msg.textContent = res.d && res.d.duplicate
            ? '✓ You’re already subscribed — you’re all set.'
            : '✓ You’re in — check your inbox to confirm.'
          form.style.display = 'none'
          track(res.d && res.d.duplicate ? 'newsletter_already_subscribed' : 'newsletter_submit_success')
        } else if (res.status === 429) {
          msg.className = 'asq-msg asq-err'; msg.textContent = 'Too many tries — please wait a minute.'
          btn.disabled = false; btn.textContent = label; track('newsletter_submit_error')
        } else {
          msg.className = 'asq-msg asq-err'; msg.textContent = 'Couldn’t sign you up — please try again.'
          btn.disabled = false; btn.textContent = label; track('newsletter_submit_error')
        }
      }).catch(function () {
        msg.className = 'asq-msg asq-err'; msg.textContent = 'Network error — please try again.'
        btn.disabled = false; btn.textContent = label; track('newsletter_submit_error')
      })
    })
  }

  function init() {
    styleOnce()
    var hosts = document.querySelectorAll('[data-scamcheck-alert]')
    for (var i = 0; i < hosts.length; i++) mount(hosts[i])
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})();
