/* MaskFill - shared settings, defaults & storage helpers (classic script, shared isolated world) */
(function () {
  'use strict';

  var DEFAULTS = {
    locale: 'en',
    autoFill: false,
    fillOnlyEmpty: true,
    fillPasswords: true,
    passwordValue: '',
    autoCheckTerms: true,
    matchBy: { name: true, id: true, className: false, placeholder: true, label: true, ariaLabel: true, ariaLabelledby: true },
    ignorePatterns: ['captcha', 'g-recaptcha', 'h-captcha', 'recaptcha'],
    ignoredDomains: [],
    maxLength: 40,
    profileConsistent: true,
    flashFilled: true
  };

  function deepMerge(base, over) {
    if (over === undefined || over === null) return base;
    if (Array.isArray(base) || Array.isArray(over)) return over;
    if (typeof base === 'object' && typeof over === 'object') {
      var out = {};
      Object.keys(base).forEach(function (k) { out[k] = deepMerge(base[k], over[k]); });
      Object.keys(over).forEach(function (k) { if (out[k] === undefined && base[k] === undefined) out[k] = over[k]; });
      return out;
    }
    return over;
  }

  function isReDosSafe(p) {
    if (typeof p !== 'string' || !p || p.length > 40) return false;
    var core = p.replace(/\\./g, 'X').replace(/\[[^\]]*\]/g, 'X');
    // remove char-classes/escapes, then flag any group with nested ambiguity
    // A quantified group whose body contains `|`, `(`, or another quantifier is the dangerous class.
    var i = 0;
    while (i < core.length) {
      if (core[i] === ')') {
        // find matching open paren (naive: walk back)
        var j = i;
        while (j >= 0 && core[j] !== '(') j--;
        if (j >= 0) {
          var body = core.substring(j + 1, i);
          var q = core[i + 1];
          if ((q === '+' || q === '*' || q === '{')) {
            if (/[|(+*{]/.test(body)) return false;
          }
        }
        i++;
        continue;
      }
      i++;
    }
    return true;
  }

  function normalize(s) {
    var out = deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), s || {});
    if (!Array.isArray(out.ignorePatterns)) out.ignorePatterns = DEFAULTS.ignorePatterns.slice();
    if (!Array.isArray(out.ignoredDomains)) out.ignoredDomains = [];
    if (!out.matchBy || typeof out.matchBy !== 'object' || Array.isArray(out.matchBy)) out.matchBy = DEFAULTS.matchBy;
    if (typeof out.locale !== 'string' || !out.locale) out.locale = 'en';
    out.ignorePatterns = out.ignorePatterns.filter(function (p) { return typeof p === 'string' && p; });
    out.ignoredDomains = out.ignoredDomains.filter(function (p) { return typeof p === 'string' && p.trim(); });
    var ml = Number(out.maxLength);
    out.maxLength = !isNaN(ml) && ml > 0 ? Math.min(Math.max(Math.round(ml), 1), 200) : 40;
    return out;
  }

  var GlobalData = {
    DEFAULTS: DEFAULTS,
    normalize: normalize,
    isIgnoredDomain: function (hostname, patterns) {
      var host = String(hostname || '').slice(0, 253);
      patterns = patterns || [];
      for (var i = 0; i < patterns.length; i++) {
        var p = String(patterns[i]).trim();
        if (!p) continue;
        // ponytail: length + nested-quantifier guard prevents catastrophic-backtracking ReDoS
        if (!isReDosSafe(p)) continue;
        try { if (new RegExp(p, 'i').test(host)) return true; } catch (e) {}
      }
      return false;
    },
    loadSettings: function () {
      return new Promise(function (resolve) {
        try {
          chrome.storage.sync.get({ settings: null }, function (res) {
            if (chrome.runtime.lastError) return resolve(JSON.parse(JSON.stringify(DEFAULTS)));
            resolve(normalize(res && res.settings ? res.settings : DEFAULTS));
          });
        } catch (e) {
          resolve(normalize(DEFAULTS));
        }
      });
    },
    saveSettings: function (s) {
      return new Promise(function (resolve) {
        chrome.storage.sync.set({ settings: normalize(s) }, function () { resolve(); });
      });
    }
  };

  window.GlobalData = GlobalData;
  if (typeof module !== 'undefined' && module.exports) module.exports = GlobalData;
})();