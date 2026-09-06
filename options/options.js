(function () {
  'use strict';

  var LOCALES = [
    ['af_ZA', 'Afrikaans (South Africa)'], ['ar', 'Arabic'], ['az', 'Azerbaijani'],
    ['zh_CN', 'Chinese (Simplified)'], ['zh_TW', 'Chinese (Traditional)'],
    ['hr', 'Croatian'], ['cs_CZ', 'Czech'], ['da', 'Danish'], ['dv', 'Dhivehi'],
    ['nl', 'Dutch'], ['nl_BE', 'Dutch (Belgium)'], ['en', 'English'],
    ['en_AU', 'English (Australia)'], ['en_CA', 'English (Canada)'],
    ['en_GB', 'English (UK)'], ['en_GH', 'English (Ghana)'], ['en_HK', 'English (Hong Kong)'],
    ['en_IN', 'English (India)'], ['en_IE', 'English (Ireland)'],
    ['en_NG', 'English (Nigeria)'], ['en_US', 'English (US)'], ['en_ZA', 'English (South Africa)'],
    ['eo', 'Esperanto'], ['fi', 'Finnish'],
    ['fr', 'French'], ['fr_BE', 'French (Belgium)'], ['fr_CA', 'French (Canada)'],
    ['fr_CH', 'French (Switzerland)'], ['fr_LU', 'French (Luxembourg)'], ['fr_SN', 'French (Senegal)'],
    ['de', 'German'], ['de_AT', 'German (Austria)'], ['de_CH', 'German (Switzerland)'],
    ['el', 'Greek'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['hu', 'Hungarian'],
    ['hy', 'Armenian'], ['id_ID', 'Indonesian'], ['it', 'Italian'],
    ['ja', 'Japanese'], ['ka_GE', 'Georgian'], ['ko', 'Korean'],
    ['lv', 'Latvian'], ['mk', 'Macedonian'], ['ne', 'Nepali'],
    ['nb_NO', 'Norwegian'], ['fa', 'Persian'], ['pl', 'Polish'],
    ['pt_BR', 'Portuguese (Brazil)'], ['pt_PT', 'Portuguese (Portugal)'],
    ['ro', 'Romanian'], ['ro_MD', 'Romanian (Moldova)'], ['ru', 'Russian'],
    ['sk', 'Slovak'], ['sr_RS_latin', 'Serbian (Latin)'], ['es', 'Spanish'],
    ['es_MX', 'Spanish (Mexico)'], ['sv', 'Swedish'], ['th', 'Thai'],
    ['tr', 'Turkish'], ['uk', 'Ukrainian'], ['ur', 'Urdu'], ['vi', 'Vietnamese'],
    ['yo_NG', 'Yoruba (Nigeria)'], ['zu_ZA', 'Zulu (South Africa)']
  ];

  var settings;
  var saveTimer;

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      GlobalData.saveSettings(settings).then(function () { toast('Saved ✓'); });
    }, 300);
  }

  function toast(msg, isError) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = 'toast'; }, 2000);
  }

  function el(tag, attrs, parent) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'checked') e.checked = !!attrs[k];
      else if (k === 'className') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(e);
    return e;
  }

  function renderLocale() {
    var sel = document.getElementById('locale');
    sel.innerHTML = '';
    LOCALES.forEach(function (pair) {
      var o = document.createElement('option');
      o.value = pair[0];
      o.textContent = pair[1];
      if (pair[0] === settings.locale) o.selected = true;
      sel.appendChild(o);
    });
  }

  function renderChips() {
    var box = document.getElementById('chips');
    box.innerHTML = '';
    settings.ignorePatterns.forEach(function (p, i) {
      var c = el('span', { className: 'chip' }, box);
      el('span', { text: p }, c);
      var b = el('button', { text: '×' }, c);
      b.addEventListener('click', function () {
        settings.ignorePatterns.splice(i, 1);
        renderChips();
        save();
      });
    });
  }

  function renderAll() {
    renderLocale();
    document.getElementById('fillOnlyEmpty').checked = settings.fillOnlyEmpty;
    document.getElementById('opt-autofill').checked = !!settings.autoFill;
    document.getElementById('fillPasswords').checked = settings.fillPasswords;
    document.getElementById('passwordValue').value = settings.passwordValue;
    document.getElementById('autoCheckTerms').checked = settings.autoCheckTerms;
    document.getElementById('profileConsistent').checked = settings.profileConsistent;
    document.getElementById('flashFilled').checked = settings.flashFilled;
    document.getElementById('maxLength').value = settings.maxLength;
    document.getElementById('ignoredDomains').value = (settings.ignoredDomains || []).join('\n');
    ['name', 'id', 'className', 'placeholder', 'label', 'ariaLabel', 'ariaLabelledby'].forEach(function (k) {
      document.getElementById('match-' + k).checked = settings.matchBy[k];
    });
    renderChips();
  }

  function init() {
    GlobalData.loadSettings().then(function (s) {
      settings = s;
      renderAll();

      document.getElementById('locale').addEventListener('change', function () {
        settings.locale = this.value; save();
      });

      document.getElementById('maxLength').addEventListener('change', function () {
        var v = Number(this.value);
        settings.maxLength = !isNaN(v) && v > 0 ? Math.min(Math.max(Math.round(v), 1), 200) : 40;
        this.value = settings.maxLength;
        save();
      });

      document.getElementById('ignoredDomains').addEventListener('change', function () {
        settings.ignoredDomains = this.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
        save();
      });

      document.getElementById('fillOnlyEmpty').addEventListener('change', function () {
        settings.fillOnlyEmpty = this.checked; save();
      });
      document.getElementById('opt-autofill').addEventListener('change', function () {
        settings.autoFill = this.checked; save();
      });
      document.getElementById('fillPasswords').addEventListener('change', function () {
        settings.fillPasswords = this.checked; save();
      });
      document.getElementById('passwordValue').addEventListener('change', function () {
        settings.passwordValue = this.value; save();
      });
      document.getElementById('autoCheckTerms').addEventListener('change', function () {
        settings.autoCheckTerms = this.checked; save();
      });
      document.getElementById('profileConsistent').addEventListener('change', function () {
        settings.profileConsistent = this.checked; save();
      });
      document.getElementById('flashFilled').addEventListener('change', function () {
        settings.flashFilled = this.checked; save();
      });

      ['name', 'id', 'className', 'placeholder', 'label', 'ariaLabel', 'ariaLabelledby'].forEach(function (k) {
        document.getElementById('match-' + k).addEventListener('change', function () {
          settings.matchBy[k] = this.checked; save();
        });
      });

      document.getElementById('chipAdd').addEventListener('click', addChip);
      document.getElementById('chipInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addChip(); }
      });
    });
  }

  function addChip() {
    var input = document.getElementById('chipInput');
    var val = input.value.trim().toLowerCase();
    if (!val || settings.ignorePatterns.indexOf(val) !== -1) { input.value = ''; return; }
    settings.ignorePatterns.push(val);
    input.value = '';
    renderChips(); save();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
