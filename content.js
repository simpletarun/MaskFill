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

  /* --- lazy lib loading: only content.js is static now; GlobalData/FormFiller/
         FieldDetector are injected on request via the background ENSURE_LIBS handler --- */
  function libsPresent() {
    return !!(window.GlobalData && window.FormFiller && window.FieldDetector);
  }

  var libsRequested = false;
  var libsResolve = null;
  var libsReady = libsPresent()
    ? Promise.resolve(true)
    : new Promise(function (resolve) { libsResolve = resolve; });

  function requestLibs() {
    if (libsPresent()) {
      if (libsResolve) { var r0 = libsResolve; libsResolve = null; r0(true); }
      return true;
    }
    if (libsRequested) return false;
    libsRequested = true;
    var fail = function () { libsRequested = false; };
    try {
      chrome.runtime.sendMessage({ type: 'ENSURE_LIBS' }, function (resp) {
        var ok = !!(resp && resp.ok);
        if (!ok) fail(); // transient (e.g. worker asleep) → allow a later click to retry
        if (libsResolve) { var r1 = libsResolve; libsResolve = null; r1(ok); }
      });
      setTimeout(function () {
        if (libsResolve) { var r2 = libsResolve; libsResolve = null; fail(); r2(false); }
      }, 3000);
    } catch (e) {
      fail();
      if (libsResolve) { libsResolve(false); libsResolve = null; }
    }
    return false;
  }

  /* --- persisted last fill: lets UNDO work after a page reload --- */
  function elIndexPath(el) {
    try {
      var node = el;
      var segs = [];
      while (node && node.nodeType === 1) {
        var tag = String(node.tagName || '').toLowerCase();
        var nth = 0;
        if (node.parentNode && node.parentNode.nodeType === 1) {
          var kids = Array.prototype.slice.call(node.parentNode.children).filter(function (s) {
            return String(s.tagName || '').toLowerCase() === tag;
          });
          nth = kids.indexOf(node) + 1;
        }
        segs.unshift(nth > 0 ? tag + ':nth-of-type(' + nth + ')' : tag);
        node = node.parentNode;
      }
      return segs.join(' > ');
    } catch (e) {
      return String(el && el.tagName || 'input').toLowerCase();
    }
  }

  function elLocator(el) {
    try {
      if (!el || !el.tagName) return null;
      if (el.id && typeof document !== 'undefined' && document.getElementById(el.id) === el) return '#' + el.id;
      var name = el.getAttribute && el.getAttribute('name');
      if (name && typeof document !== 'undefined') {
        var named = document.querySelectorAll('[name="' + name + '"]');
        if (named.length === 1 && named[0] === el) return '[name="' + name + '"]';
      }
    } catch (e) {}
    return elIndexPath(el);
  }

  function resolveLocator(loc) {
    try {
      if (!loc) return null;
      var el = document.querySelector(loc);
      if (el) return [el];
      if (loc.charAt(0) === '#') {
        var byId = document.getElementById(loc.slice(1));
        if (byId) return [byId];
      }
      var m = /^\[name="([^"]*)"\]$/.exec(loc);
      if (m) return Array.prototype.slice.call(document.querySelectorAll('[name="' + m[1] + '"]'));
      return null;
    } catch (e) { return null; }
  }

  function elementMatchesKind(el, kind) {
    try {
      if (!el || !el.tagName) return false;
      var tag = String(el.tagName).toUpperCase();
      var t = String(el.type || '').toLowerCase();
      if (kind === 'select') return tag === 'SELECT';
      if (kind === 'group') return tag === 'INPUT' && t === 'radio';
      if (kind === 'check') return tag === 'INPUT' && t === 'checkbox';
      return tag === 'INPUT' || tag === 'TEXTAREA' || (!!el.isContentEditable) || (el.getAttribute && el.getAttribute('contenteditable') === 'true');
    } catch (e) { return false; }
  }

  function samePage(a, b) {
    try {
      if (a === b) return true;
      return String(a).replace(/#.*$/, '') === String(b).replace(/#.*$/, '');
    } catch (e) { return a === b; }
  }

  function persistLastFill() {
    try {
      if (!chrome.storage || !chrome.storage.local) return;
      var run = window.__pfUndo && window.__pfUndo.length ? window.__pfUndo[window.__pfUndo.length - 1] : null;
      if (!run || !run.recs || !run.recs.length) return;
      var items = [];
      for (var i = 0; i < run.recs.length && items.length < 500; i++) {
        var rec = run.recs[i];
        try {
          if (rec.kind === 'group') {
            items.push({
              locator: elLocator(rec.items && rec.items[0] && rec.items[0].el),
              kind: 'group',
              items: (rec.items || []).map(function (it) {
                return { locator: elLocator(it.el), checked: !!it.checked };
              })
            });
          } else {
            items.push({
              locator: elLocator(rec.el),
              kind: rec.kind,
              checked: !!rec.checked,
              selectedIndex: typeof rec.selectedIndex === 'number' ? rec.selectedIndex : undefined,
              value: rec.value
            });
          }
        } catch (e) {}
      }
      if (!items.length) return;
      chrome.storage.local.set({ pfLastFill: { url: location.href, items: items } }, function () {});
    } catch (e) {}
  }

  function restorePersistedUndo() {
    try {
      if (!chrome.storage || !chrome.storage.local) { showToast('Nothing to undo', 0, true); return; }
      chrome.storage.local.get('pfLastFill', function (resp) {
        try {
          if (chrome.runtime.lastError) { showToast('Nothing to undo', 0, true); return; }
          var snap = resp && resp.pfLastFill;
          if (!snap || !snap.items || !snap.items.length) { showToast('Nothing to undo', 0, true); return; }
          if (!samePage(snap.url, location.href)) { showToast('Nothing to undo', 0, true); return; }
          var n = 0;
          var items = snap.items.slice().reverse();
          items.forEach(function (item) {
            try {
              var apply = function (el) {
                if (!elementMatchesKind(el, item.kind)) return;
                if (item.kind === 'check') el.checked = !!item.checked;
                else if (item.kind === 'select') { if (typeof item.selectedIndex === 'number') el.selectedIndex = item.selectedIndex; }
                else FormFiller.setNativeValue(el, item.value == null ? '' : item.value, true);
                n++;
              };
              if (item.kind === 'group') {
                (item.items || []).forEach(function (sub) {
                  var subEls = resolveLocator(sub.locator) || [];
                  subEls.forEach(function (el) {
                    if (!elementMatchesKind(el, 'group')) return;
                    el.checked = !!sub.checked;
                    n++;
                  });
                });
              } else {
                var els = resolveLocator(item.locator) || [];
                els.forEach(apply);
              }
            } catch (e) {}
          });
          try { chrome.storage.local.remove('pfLastFill', function () {}); } catch (e2) {}
          if (n > 0) showToast('Restored ' + n + ' from previous session', 0, true);
          else showToast('Nothing to undo', 0, true);
        } catch (e) {}
      });
    } catch (e) { showToast('Nothing to undo', 0, true); }
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
      restorePersistedUndo();
      return { ok: true, restored: 0 };
    }
    var run = null;
    while (stack.length) {
      run = stack.pop();
      if (run && run.recs && run.recs.length) break;
      run = null;
    }
    if (!run) {
      restorePersistedUndo();
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

  /* --- coherent day/month/year birthday pickers (3 scroll selects) --- */
  var BDAY_PART_RE = { d: /(^|\s)(day|dd)($|\s)/i, m: /(^|\s)(month|mm)($|\s)/i, y: /(^|\s)(year|yyyy|yr)($|\s)/i };
  var BDAY_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function collectBdayGroups(els, settings) {
    var parts = [];
    var groups = [];
    function gp(node) {
      for (var i = 0; i < groups.length; i++) if (groups[i].node === node) return groups[i];
      var g = { node: node, has: {}, birth: false, date: null };
      groups.push(g);
      return g;
    }
    // nearest ancestor shared with another day/month/year select (handles each
    // select being wrapped in its own <label>) → same cluster key for all three
    function clusterKey(el) {
      var node = el.parentNode;
      for (var d = 0; node && node.nodeType === 1 && d < 4; d++) {
        try {
          for (var i = 0; i < parts.length; i++) {
            if (parts[i].el === el) continue;
            if (node.contains(parts[i].el)) return node;
          }
        } catch (e) {}
        node = node.parentNode;
      }
      return el.parentNode;
    }
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      if (!el || !el.tagName || el.tagName !== 'SELECT') continue;
      var joined = '';
      try { joined = FieldDetector.getElementSignals(el, settings.matchBy).signals.join(' '); } catch (e) {}
      var part = null;
      try {
        var ac = String((el.getAttribute && el.getAttribute('autocomplete')) || '').toLowerCase();
        if (ac === 'bday-day') part = 'd';
        else if (ac === 'bday-month') part = 'm';
        else if (ac === 'bday-year') part = 'y';
      } catch (e) {}
      if (!part) { for (var k in BDAY_PART_RE) { if (joined && BDAY_PART_RE[k].test(joined)) { part = k; break; } } }
      if (!part) continue;
      var g = gp(clusterKey(el));
      if (/\b(birth|dob)\b/.test(joined)) g.birth = true;
      g.has[part] = true;
      parts.push({ el: el, part: part, group: g });
    }
    for (var gi = 0; gi < groups.length; gi++) {
      var gg = groups[gi];
      var nParts = (gg.has.d ? 1 : 0) + (gg.has.m ? 1 : 0) + (gg.has.y ? 1 : 0);
      // need a real date only when the group is a birth picker (day present, or labelled birth/dob)
      if (nParts >= 2 && (gg.has.d || gg.birth)) {
        var dstr = String(RandomData.generate('dob', {}));
        var bits = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dstr);
        if (bits) gg.date = { y: +bits[1], m: +bits[2], d: +bits[3] };
      }
    }
    return parts;
  }

  function bdayCandidates(part, date) {
    if (part === 'd') {
      var ds = String(date.d);
      return [ds, date.d < 10 ? '0' + ds : ds];
    }
    if (part === 'y') {
      var ys = String(date.y);
      return [ys, ys.slice(2)];
    }
    var ms = String(date.m);
    var cands = [ms, date.m < 10 ? '0' + ms : ms];
    var name = BDAY_MONTHS[date.m - 1];
    cands.push(name, name.slice(0, 3));
    return cands;
  }

  function selectValueFor(el, cands) {
    try {
      for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].disabled) continue;
        var v = String(el.options[i].value || '').trim();
        var t = String(el.options[i].text || '').trim();
        for (var c = 0; c < cands.length; c++) {
          if (v === cands[c] || (t && t.toLowerCase() === String(cands[c]).toLowerCase())) return v || t;
        }
      }
    } catch (e) {}
    return null;
  }

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
    var bdaySel = collectBdayGroups(els, settings);

    var filled = 0, skipped = 0, lastValue = '';
    beginUndoRun();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      try {
        if (FieldDetector.isIgnorable(el, settings.ignorePatterns, !!settings.fillHiddenFields)) { skipped++; continue; }

        var siteSkipped = false;
        for (var ri = 0; ri < (settings.siteRules || []).length; ri++) {
          if (FieldDetector.siteRuleMatches(el, settings.siteRules[ri], location.hostname)) { siteSkipped = true; break; }
        }
        if (siteSkipped) { skipped++; continue; }

        var sig = FieldDetector.getElementSignals(el, settings.matchBy);
        var joined = sig ? sig.signals.join(' ') : '';
        var isPwd = (el.type === 'password') || signalsContain(sig, /password|pwd/i);
        if (isPwd && !settings.fillPasswords) { skipped++; continue; }

        if (!opts.force && settings.fillOnlyEmpty && FieldDetector.hasValue(el)) { skipped++; continue; }

        var type = FieldDetector.detectType(el, settings.matchBy) || null;

        if (type === 'password' && !settings.fillPasswords) { skipped++; continue; }

        var undoRec = undoCapture(el);

        if (el.tagName === 'SELECT') {
          var _sres = null;
          for (var bi = 0; bi < bdaySel.length; bi++) {
            if (bdaySel[bi].el === el && bdaySel[bi].group.date) {
              var bv = selectValueFor(el, bdayCandidates(bdaySel[bi].part, bdaySel[bi].group.date));
              _sres = FormFiller.fill(el, bv != null ? { type: 'select', value: bv } : { type: 'select' });
              break;
            }
          }
          if (_sres === null) _sres = FormFiller.fill(el, { type: 'select' });
          if (_sres && _sres.filled) { pushUndo(undoRec); if (flashing) flashEl(el); filled++; } else skipped++; continue;
        }
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
        // keep a country-code prefix the field already has (e.g. "+91 " or a lone "+91") and refill the number
        if ((type === 'mobile' || type === 'phone') && typeof value === 'string') {
          const prev = String(el.value || '').trim();
          const pure = prev.match(/^(\+[0-9]{1,3})[-\s.]*$/);
          const withNum = prev.match(/^(\+[0-9]{1,3})[-\s. ]+\d/);
          const ccMatch = pure || withNum;
          if (ccMatch) {
            const fits = (sig && sig.maxlength > 0) ? sig.maxlength : Infinity;
            const combined = ccMatch[1] + ' ' + value;
            if (fits >= combined.length) value = combined;
          }
        }

        var res = FormFiller.fill(el, { type: type || 'text', value: value });
        if (res && res.filled) { pushUndo(undoRec); if (flashing) flashEl(el); filled++; } else skipped++;

        if (type !== 'boolean' && type !== 'password') lastValue = value;
      } catch (e) {
        skipped++;
      }
    }

    if (filled > 0) {
      try { persistLastFill(); } catch (e) {}
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
      requestLibs();
      libsReady.then(function (ok) {
        if (!ok) { sendResponse({ ok: false, count: 0 }); return; }
        GlobalData.loadSettings().then(function (s) {
          var root = (msg.scope === 'field') ? (window.__pfCtxEl || null)
            : (msg.scope === 'form') ? ((window.__pfCtxEl && window.__pfCtxEl.closest('form')) || document)
            : document;
          var n = root ? countFillable(root) : 0;
          sendResponse({ ok: true, count: n });
        });
      });
      return true;
    }
    if (msg.type === 'UNDO') {
      requestLibs();
      libsReady.then(function (ok) {
        if (!ok) { sendResponse({ ok: false, err: 'libs-unavailable' }); return; }
        sendResponse(undoLastFill());
      });
      return true;
    }
    if (msg.type === 'FILL') {
      requestLibs();
      libsReady.then(function (ok) {
        if (!ok) { sendResponse({ ok: false, err: 'libs-unavailable' }); return; }
        fillOrchestrate(msg.scope || 'all', { force: !!msg.force }).then(function (res) {
          sendResponse(res);
        }, function (err) {
          sendResponse({ ok: false, err: String(err && err.message || err) });
        });
      });
      return true;
    }
    return false;
  });

  function maybeAutoFill() {
    try {
      if (!libsPresent()) { requestLibs(); return; }
      GlobalData.loadSettings().then(function (s) {
        if (!(s && s.autoFill)) return;
        if (window.__pfAutoUrl === location.href) return;
        window.__pfAutoUrl = location.href;
        setTimeout(function () { fillOrchestrate('all'); }, 400);
      }, function () {});
    } catch (e) {}
  }

  function boot() {
    try {
      if (libsPresent()) maybeAutoFill();
      else if (document.querySelector && document.querySelector('input, textarea, select, [contenteditable="true"]') !== null) requestLibs();
    } catch (e) {}
    try {
      if (!document.body) return;
      var lastUrl = location.href;
      var navTimer = null;
      var dynTimer = null;
      var dynBusy = false;
      var mo = new MutationObserver(function (mutations) {
        try {
          if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (navTimer) clearTimeout(navTimer);
            navTimer = setTimeout(maybeAutoFill, 800);
          }
          var formAppeared = false;
          for (var i = 0; i < mutations.length; i++) {
            var added = mutations[i].addedNodes;
            if (!added) continue;
            for (var j = 0; j < added.length; j++) {
              var nd = added[j];
              try {
                if (nd && nd.nodeType === 1) {
                  if (nd.matches && nd.matches('input, textarea, select, [contenteditable="true"]')) formAppeared = true;
                  else if (nd.querySelector && nd.querySelector('input, textarea, select, [contenteditable="true"]')) formAppeared = true;
                }
              } catch (e2) {}
            }
          }
          if (!formAppeared) return;
          if (!libsPresent()) { requestLibs(); return; }
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
