/* MaskFill - content script orchestrator (runs in real page context) */
'use strict';
(function () {
  if (window.__pfLoaded) return;
  window.__pfLoaded = true;

  function signalsContain(sig, re) {
    if (!sig) return false;
    var joined = '';
    try { joined = sig.signals.join(' '); } catch (e) { joined = String(sig); }
    return re.test(joined);
  }

  try {
    document.addEventListener('contextmenu', function (evt) {
      try {
        var el = document.elementFromPoint(evt.clientX, evt.clientY);
        window.__pfCtxEl = (el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]')) || null;
      } catch (e) {
        window.__pfCtxEl = null;
      }
    }, true);
  } catch (e) {}

  function countFillable(root) {
    try {
      return FieldDetector.detectFields(root).length;
    } catch (e) {
      return 0;
    }
  }

  /* --- flash highlight for just-filled fields --- */
  function flashEl(el) {
    try {
      var prev = el.style.outline;
      el.style.outline = '2px solid #22c55e';
      el.style.outlineOffset = '1px';
      setTimeout(function () {
        try { el.style.outline = prev; el.style.outlineOffset = ''; } catch (e2) {}
      }, 2000);
    } catch (e) {}
  }

  /* --- fill report toast + undo --- */
  var pfToastEl = null;

  function showToast(filled, skippedTotal, plain) {
    try {
      if (pfToastEl && pfToastEl.parentNode) pfToastEl.parentNode.removeChild(pfToastEl);
      var d = document.createElement('div');
      d.setAttribute('role', 'status');
      d.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#111827;color:#f9fafb;font:13px/1.4 system-ui,-apple-system,sans-serif;padding:10px 14px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;max-width:320px;';
      var text = document.createElement('span');
      text.textContent = plain ? String(filled) : ('MaskFill: filled ' + filled + ' · skipped ' + skippedTotal);
      d.appendChild(text);
      if (!plain && filled > 0) {
        var u = document.createElement('button');
        u.textContent = 'Undo';
        u.style.cssText = 'background:#2563eb;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;';
        u.addEventListener('click', function () {
          try { if (d.parentNode) d.parentNode.removeChild(d); } catch (e2) {}
          undoLastFill();
        });
        d.appendChild(u);
      }
      var x = document.createElement('button');
      x.textContent = '\u00d7';
      x.setAttribute('aria-label', 'Dismiss');
      x.style.cssText = 'background:transparent;border:0;color:#9ca3af;cursor:pointer;font-size:14px;padding:0 2px;';
      x.addEventListener('click', function () { try { if (d.parentNode) d.parentNode.removeChild(d); } catch (e2) {} });
      d.appendChild(x);
      document.body.appendChild(d);
      setTimeout(function () { try { if (d.parentNode) d.parentNode.removeChild(d); } catch (e2) {} }, 6000);
      pfToastEl = d;
    } catch (e) {}
  }

  function undoCapture(el) {
    try {
      if (!el || !el.tagName) return null;
      if (el.type === 'radio') {
        var group = FieldDetector.groupRadios(el) || [el];
        return { kind: 'group', items: group.map(function (r) { return { el: r, checked: !!r.checked }; }) };
      }
      var tag = String(el.tagName || '').toUpperCase();
      if (tag === 'SELECT') return { kind: 'select', el: el, selectedIndex: el.selectedIndex };
      if (el.type === 'checkbox') return { kind: 'check', el: el, checked: !!el.checked };
      return { kind: 'text', el: el, value: el.value };
    } catch (e) { return null; }
  }

  function beginUndoRun() {
    window.__pfUndo = window.__pfUndo || [];
    window.__pfUndo.push({ recs: [] });
    if (window.__pfUndo.length > 50) window.__pfUndo.shift();
  }

  function pushUndo(rec) {
    if (!rec) return;
    var stack = window.__pfUndo;
    if (!stack || !stack.length) return;
    stack[stack.length - 1].recs.push(rec);
  }

  function undoLastFill() {
    var stack = window.__pfUndo;
    if (!stack || !stack.length) {
      showToast('Nothing to undo', 0, true);
      return { ok: true, restored: 0 };
    }
    var run = null;
    while (stack.length) {
      run = stack.pop();
      if (run && run.recs && run.recs.length) break;
      run = null;
    }
    if (!run) {
      showToast('Nothing to undo', 0, true);
      return { ok: true, restored: 0 };
    }
    var recs = run.recs;
    var restored = 0;
    for (var i = recs.length - 1; i >= 0; i--) {
      var rec = recs[i];
      try {
        if (rec.kind === 'group') {
          rec.items.forEach(function (it) { it.el.checked = it.checked; });
        } else if (rec.kind === 'check') {
          rec.el.checked = rec.checked;
        } else if (rec.kind === 'select') {
          rec.el.selectedIndex = rec.selectedIndex;
        } else {
          FormFiller.setNativeValue(rec.el, rec.value == null ? '' : rec.value, true);
        }
        restored++;
      } catch (e) {}
    }
    showToast('Undid ' + restored + ' field' + (restored === 1 ? '' : 's') + ' (' + recs.length + ' total)', 0, true);
    return { ok: true, restored: restored };
  }

  var SPECIFIC = ['email', 'password', 'dob', 'date', 'time', 'datetimeLocal', 'month', 'week', 'year', 'color', 'hexColor', 'creditCard', 'cvv', 'boolean'];

  async function fillOrchestrate(scope, opts) {
    opts = opts || {};
    var settings = await GlobalData.loadSettings();
    if (GlobalData.isIgnoredDomain((location.hostname || '').toLowerCase(), settings.ignoredDomains)) {
      return { ok: true, count: 0, filled: 0, skipped: 0, ignored: true };
    }
    try { RandomData.setLocale(settings.locale || 'en'); } catch (e) {}
    try { RandomData.setConsistent(!!settings.profileConsistent); } catch (e) {}
    if (opts.resetPersona !== false) { try { RandomData.beginFill(); } catch (e) {} }
    var flashing = !!settings.flashFilled;

    var root;
    if (scope === 'field') root = window.__pfCtxEl || null;
    else if (scope === 'form') {
      var f = window.__pfCtxEl && window.__pfCtxEl.closest ? window.__pfCtxEl.closest('form') : null;
      if (!f) return { ok: false, err: 'no-form-target' };
      root = f;
    } else root = document;
    if (!root) return { ok: false, err: 'no-target' };

    var els = [];
    try { els = FieldDetector.detectFields(root); } catch (e) { els = []; }

    var filled = 0, skipped = 0, lastValue = '';
    beginUndoRun();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      try {
        if (FieldDetector.isIgnorable(el, settings.ignorePatterns)) { skipped++; continue; }

        var sig = FieldDetector.getElementSignals(el, settings.matchBy);
        var joined = sig ? sig.signals.join(' ') : '';
        var isPwd = (el.type === 'password') || signalsContain(sig, /password|pwd/i);
        if (isPwd && !settings.fillPasswords) { skipped++; continue; }

        if (settings.fillOnlyEmpty && FieldDetector.hasValue(el)) { skipped++; continue; }

        var type = FieldDetector.detectType(el, settings.matchBy) || null;

        if (type === 'password' && !settings.fillPasswords) { skipped++; continue; }

        var undoRec = undoCapture(el);

        if (el.tagName === 'SELECT') { var _sres = FormFiller.fill(el, { type: 'select' }); if (_sres && _sres.filled) { pushUndo(undoRec); if (flashing) flashEl(el); filled++; } else skipped++; continue; }
        if (el.type === 'radio') { var _rres = FormFiller.fillRadioGroup(el, settings); if (_rres) { pushUndo(undoRec); if (flashing) flashEl(el); filled++; } else skipped++; continue; }
        if (el.type === 'checkbox') { pushUndo(undoRec); if (flashing) flashEl(el); FormFiller.fillCheckbox(el, settings); filled++; continue; }

        var value;
        if (type === 'password') {
          value = RandomData.getPassword(settings, /confirm|retype|repeat|reenter|re-enter|verify|match|secondary/i.test(joined));
        } else if (sig && sig.pattern && SPECIFIC.indexOf(type) === -1) {
          value = RandomData.generate('regex', {
            pattern: sig.pattern,
            maxlength: (sig && sig.maxlength > 0) ? sig.maxlength : undefined
          });
          if (!value) {
            value = RandomData.generate(type || 'text', {
              minlength: (sig && sig.minlength > 0) ? sig.minlength : undefined,
              maxlength: (sig && sig.maxlength > 0) ? sig.maxlength : settings.maxLength,
              min: sig ? sig.min : undefined,
              max: sig ? sig.max : undefined,
              step: sig ? sig.step : undefined,
              htmlType: sig ? sig.type : undefined,
              settings: settings
            });
          }
        } else {
          if (FieldDetector.isConfirmation(joined) && type !== 'password' && type !== 'boolean' && (type === null || type === 'text') && lastValue !== '') {
            value = lastValue;
          } else {
            value = RandomData.generate(type || 'text', {
              pattern: sig ? sig.pattern : undefined,
              minlength: (sig && sig.minlength > 0) ? sig.minlength : undefined,
              maxlength: (sig && sig.maxlength > 0) ? sig.maxlength : settings.maxLength,
              min: sig ? sig.min : undefined,
              max: sig ? sig.max : undefined,
              step: sig ? sig.step : undefined,
              htmlType: sig ? sig.type : undefined,
              settings: settings
            });
          }
          if (type === 'boolean' && el.type !== 'checkbox') value = value ? 'yes' : 'no';
        }

        if ((type === 'dob' || type === 'date') && el.type !== 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
          // masked text dates like DD/MM/YYYY reject ISO; honor the placeholder layout
          var ph = String(el.placeholder || el.getAttribute('aria-label') || '').toLowerCase();
          if (/^(dd|mm)\D+?(dd|mm)\D+?[d-]{2,4}\d?/.test(ph) || /^(dd|mm)\s*[\/\-\.]\s*(dd|mm)/.test(ph)) {
            var sep = (ph.match(/[^\w]/) || ['/'])[0];
            var yyy = String(value).slice(0, 4), mm = String(value).slice(5, 7), d = String(value).slice(8, 10);
            if (/^dd/.test(ph)) value = d + sep + mm + sep + yyy;
            else if (/^mm/.test(ph)) value = mm + sep + d + sep + yyy;
          }
        }

        if ((type === 'mobile' || type === 'phone') && /^[0-5]\d{9}$/.test(String(value || ''))) {
          value = String(6 + Math.floor(Math.random() * 4)) + String(value).substring(1);
        }
        // field still shows a lone country-code prefix like "+91" → keep the prefix, add the number
        if ((type === 'mobile' || type === 'phone') && typeof value === 'string') {
          const ccMatch = String(el.value || '').trim().match(/^(\+[0-9]{1,3})[-\s.]*$/);
          if (ccMatch) {
            const fits = (sig && sig.maxlength > 0) ? sig.maxlength : Infinity;
            if (fits >= 13) value = ccMatch[1] + ' ' + value;
          }
        }

        var res = FormFiller.fill(el, { type: type || 'text', value: value });
        if (res && res.filled) { pushUndo(undoRec); if (flashing) flashEl(el); filled++; } else skipped++;

        if (type !== 'boolean' && type !== 'password') lastValue = value;
      } catch (e) {
        skipped++;
      }
    }

    if (!opts.silent) {
      try { chrome.runtime.sendMessage({ type: 'FILL_DONE', count: filled }); } catch (e) {}
      if (filled > 0) showToast(filled, skipped);
    }

    return { ok: true, count: els.length, filled: filled, skipped: skipped };
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return false;
    if (msg.type === 'PING') { sendResponse({ ok: true }); return false; }
    if (msg.type === 'COUNT') {
      GlobalData.loadSettings().then(function (s) {
        var root = (msg.scope === 'field') ? (window.__pfCtxEl || null)
          : (msg.scope === 'form') ? ((window.__pfCtxEl && window.__pfCtxEl.closest('form')) || document)
          : document;
        var n = root ? countFillable(root) : 0;
        sendResponse({ ok: true, count: n });
      });
      return true;
    }
    if (msg.type === 'UNDO') { sendResponse(undoLastFill()); return false; }
    if (msg.type === 'FILL') {
      fillOrchestrate(msg.scope || 'all').then(function (res) {
        sendResponse(res);
      }, function (err) {
        sendResponse({ ok: false, err: String(err && err.message || err) });
      });
      return true;
    }
    return false;
  });

  function maybeAutoFill() {
    try {
      GlobalData.loadSettings().then(function (s) {
        if (!(s && s.autoFill)) return;
        if (window.__pfAutoUrl === location.href) return;
        window.__pfAutoUrl = location.href;
        setTimeout(function () { fillOrchestrate('all'); }, 400);
      }, function () {});
    } catch (e) {}
  }

  function boot() {
    try { maybeAutoFill(); } catch (e) {}
    try {
      if (!document.body) return;
      var lastUrl = location.href;
      var navTimer = null;
      var dynTimer = null;
      var dynBusy = false;
      var mo = new MutationObserver(function () {
        try {
          if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (navTimer) clearTimeout(navTimer);
            navTimer = setTimeout(maybeAutoFill, 800);
          }
          if (dynTimer) clearTimeout(dynTimer);
          dynTimer = setTimeout(function () {
            if (dynBusy) return;
            dynBusy = true;
            try {
              GlobalData.loadSettings().then(function (s) {
                if (!(s && s.autoFill)) { dynBusy = false; return; }
                fillOrchestrate('all', { silent: true, resetPersona: false }).then(function () { dynBusy = false; }, function () { dynBusy = false; });
              }, function () { dynBusy = false; });
            } catch (e) { dynBusy = false; }
          }, 700);
        } catch (e) {}
      });
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['name', 'id'] });
      window.addEventListener('pagehide', function () {
        try { if (navTimer) clearTimeout(navTimer); if (dynTimer) clearTimeout(dynTimer); mo.disconnect(); } catch (e) {}
      }, { once: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
