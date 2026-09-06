/* MaskFill - cross-framework form filler (classic script, shared isolated world) */
'use strict';
(function () {
  if (window.FormFiller) return;

  function dispatch(el, name) {
    try {
      el.dispatchEvent(new Event(name, { bubbles: true }));
    } catch (e) {}
  }

  var FormFiller = {
    setNativeValue: function (el, value, silent) {
      if (el.isContentEditable || el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        try { el.textContent = String(value == null ? '' : value); } catch (e) { }
        if (!silent) {
          dispatch(el, 'input');
          dispatch(el, 'change');
          dispatch(el, 'blur');
        }
        return;
      }
      var tag = el.tagName;
      var proto = null;
      try {
        if (tag === 'TEXTAREA') proto = window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype;
        else if (tag === 'SELECT') proto = window.HTMLSelectElement && window.HTMLSelectElement.prototype;
        else proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
      } catch (e) {}
      var setter = proto && Object.getOwnPropertyDescriptor(proto, 'value');
      try {
        if (setter && setter.set) setter.set.call(el, value == null ? '' : value);
        else el.value = value == null ? '' : value;
      } catch (e) {
        el.value = value == null ? '' : value;
      }
      if (!silent) {
        dispatch(el, 'input');
        dispatch(el, 'change');
        dispatch(el, 'blur');
      }
    },

    selectRandomOption: function (el) {
      var options = Array.prototype.slice.call(el.options || []).filter(function (o) {
        return !o.disabled && String(o.value || '').trim() !== '';
      });
      if (!options.length) {
        if (el.selectedIndex >= 0) el.selectedIndex = -1;
        return null;
      }
      var pick = options[Math.floor(Math.random() * options.length)];
      el.selectedIndex = pick.index;
      el.value = pick.value;
      return pick;
    },

    fill: function (el, opts) {
      opts = opts || {};
      try {
        var tag = el.tagName;

        if (tag === 'SELECT') {
          var prevIdx = el.selectedIndex;
          var matched = false;
          if (opts.value !== undefined && opts.value !== null) {
            for (var i = 0; i < el.options.length; i++) {
              if (String(el.options[i].value) === String(opts.value) && !el.options[i].disabled) {
                el.value = String(opts.value);
                if (el.value === String(opts.value)) { matched = true; break; }
              }
            }
            if (!matched) {
              for (var j = 0; j < el.options.length; j++) {
                if (!el.options[j].disabled && String(el.options[j].text || '').trim().toLowerCase() === String(opts.value).trim().toLowerCase()) {
                  el.selectedIndex = el.options[j].index;
                  el.value = el.options[j].value;
                  matched = true;
                  break;
                }
              }
            }
            if (!matched) {
              var opt = this.selectRandomOption(el);
              if (opt) { matched = true; }
            }
          } else {
            var r = this.selectRandomOption(el);
            if (!r) return { ok: false, reason: 'no-option' };
            matched = true;
          }
          if (!matched) {
            el.selectedIndex = prevIdx;
            return { ok: false, reason: 'no-option' };
          }
          dispatch(el, 'change');
          return { ok: true, filled: true };
        }

        if (el.type === 'radio') {
          el.checked = true;
          dispatch(el, 'click');
          dispatch(el, 'input');
          dispatch(el, 'change');
          return { ok: true, filled: true };
        }

        if (el.type === 'checkbox') {
          var boolV = opts.value === undefined ? true : !!opts.value;
          el.checked = boolV;
          dispatch(el, 'click');
          dispatch(el, 'input');
          dispatch(el, 'change');
          return { ok: true, filled: true };
        }

        if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
          this.setNativeValue(el, String(opts.value == null ? '' : opts.value));
          return { ok: true, filled: true };
        }

        if (el.type === 'range') {
          var min = el.min !== '' && el.min !== undefined && el.min !== null ? Number(el.min) : 0;
          var max = el.max !== '' && el.max !== undefined && el.max !== null ? Number(el.max) : 100;
          if (isNaN(min)) min = 0;
          if (isNaN(max)) max = 100;
          var n = Number(opts.value);
          if (isNaN(n)) n = min;
          if (n < min) n = min;
          if (n > max) n = max;
          el.value = String(n);
          dispatch(el, 'input');
          dispatch(el, 'change');
          dispatch(el, 'blur');
          return { ok: true, filled: true };
        }

        var fmt = ['date', 'month', 'week', 'time', 'datetime-local', 'color'];
        if (fmt.indexOf(el.type) !== -1) {
          var want = String(opts.value == null ? '' : opts.value);
          try {
            el.value = want;
          } catch (e) {
            return { ok: false, reason: 'rejected-value' };
          }
          if (String(el.value) !== want) return { ok: false, reason: 'rejected-value' };
          dispatch(el, 'input');
          dispatch(el, 'change');
          dispatch(el, 'blur');
          return { ok: true, filled: true };
        }

        if (el.type === 'number') {
          var numeric = String(opts.value == null ? '' : opts.value);
          this.setNativeValue(el, numeric);
          if (el.value === '' && numeric.trim() !== '') {
            var cleaned = numeric.replace(/[^\d.\-+eE]/g, '');
            if (cleaned !== numeric && cleaned !== '') this.setNativeValue(el, cleaned);
            else return { ok: false, reason: 'rejected-value' };
          }
          return { ok: true, filled: true };
        }

        this.setNativeValue(el, opts.value == null ? '' : opts.value);
        return { ok: true, filled: true };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    },

    fillCheckbox: function (el, settings) {
      var checked = false;
      if (settings && settings.autoCheckTerms) {
        try {
          var sig = window.FieldDetector && FieldDetector.getElementSignals(el, settings.matchBy);
          var joined = sig && sig.signals ? sig.signals.join(' ') : '';
          // normalize separators so remember_me / rememberMe / remember-me all match
          joined = joined.replace(/[^a-z0-9]+/gi, ' ');
          if (/(agree|accept|consent|terms|conditions|tos|opt ?in|newsletter|subscribe|remember ?me|sign ?up)/i.test(joined)) checked = true;
        } catch (e) {}
      }
      if (checked === false && (!settings || !settings.autoCheckTerms)) {
        var fb = (window.__FAKER__ && window.__FAKER__.datatype && window.__FAKER__.datatype.boolean) ? window.__FAKER__.datatype.boolean() : false;
        checked = !!fb;
      }
      el.checked = checked;
      try {
        el.dispatchEvent(new Event('click', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
      return checked;
    },

    fillRadioGroup: function (el, settings, randomInt) {
      var group = [];
      try { group = window.FieldDetector && FieldDetector.groupRadios(el) || [el]; } catch (e) { group = [el]; }
      if (!group.length) group = [el];
      group = group.filter(function (r) { return !r.disabled; });
      if (!group.length) return { ok: false, reason: 'no-enabled' };
      var idx = randomInt !== undefined ? randomInt : Math.floor(Math.random() * group.length);
      if (idx < 0 || idx >= group.length) idx = 0;
      var pick = group[idx];
      pick.checked = true;
      try {
        pick.dispatchEvent(new Event('click', { bubbles: true }));
        pick.dispatchEvent(new Event('input', { bubbles: true }));
        pick.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
      return pick;
    }
  };

  window.FormFiller = FormFiller;
  if (typeof module !== 'undefined' && module.exports) module.exports = FormFiller;
})();
