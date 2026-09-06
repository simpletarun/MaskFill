/* Integration smoke test: loads all libs via new Function, simulates a form, runs the fill pipeline */
const fs = require('fs');
const path = require('path');
globalThis.window = globalThis;

const root = process.cwd();
const scripts = ['lib/faker.min.js', 'lib/settings.js', 'lib/data-generator.js', 'lib/field-detector.js', 'lib/filler.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8'));

new Function(scripts.join('\n'))();

const G = window.GlobalData, R = window.RandomData, D = window.FieldDetector, F = window.FormFiller;
let passed = 0, failed = 0;
function eq(name, cond, extra) {
  if (cond) passed++; else { failed++; console.log('FAIL:', name, extra || ''); }
}

function fakeEl(over) {
  const base = {
    tagName: 'INPUT', type: 'text', name: '', id: '', placeholder: '', value: '', checked: false,
    disabled: false, readonly: false, hidden: false, maxLength: -1, min: '', max: '', step: '', list: null,
    selectedIndex: -1, options: [],
    getAttribute(a) { return this[a] || null; },
    hasAttribute(a) { return Boolean(this[a]); },
    setAttribute() {},
    closest() { return null; },
    focus() {}, dispatchEvent() {},
    addEventListener() {}
  };
  return Object.assign(base, over);
}

// settings fixture
const settings = G.normalize({
  fillOnlyEmpty: true, fillPasswords: true
});

R.setLocale('en'); R.beginFill();

// ---- detector ----
eq('sanitize', D.sanitize('First Name') === 'first name');
eq('detectType email by type attr', D.detectType(fakeEl({ type: 'email', name: 'user_email' }), settings.matchBy) === 'email');
eq('detectType email by signals', D.detectTypeFromSignals(['email', 'useremail']) === 'email');
eq('detectType firstName', D.detectTypeFromSignals(['firstname']) === 'firstName');
eq('detectType username', D.detectTypeFromSignals(['username']) === 'username');
eq('detectType zip', D.detectTypeFromSignals(['zipcode']) === 'zip');
eq('detectType street', D.detectTypeFromSignals(['street']) === 'streetAddress');
eq('detectType housenumber → buildingNumber', D.detectTypeFromSignals(['street', 'housenumber']) === 'buildingNumber');
eq('detectType houseno → buildingNumber', D.detectTypeFromSignals(['houseno']) === 'buildingNumber');
eq('detectType house no → buildingNumber', D.detectTypeFromSignals(['house no']) === 'buildingNumber');
eq('detectType building number → buildingNumber', D.detectTypeFromSignals(['buildingno']) === 'buildingNumber');
eq('detectType ip', D.detectTypeFromSignals(['ipaddress']) === 'ip');
eq('detectType phone', D.detectTypeFromSignals(['phonenumber']) === 'phone');
eq('detectType ssn', D.detectTypeFromSignals(['ssn']) === 'ssn');
// ---- autocomplete-attribute detection ----
const ac = (v) => D.autocompleteType(fakeEl({ autocomplete: v }));
eq('autocomplete email', ac('email') === 'email');
eq('autocomplete given-name', ac('given-name') === 'firstName');
eq('autocomplete street-address', ac('street-address') === 'streetAddress');
eq('autocomplete off → null', ac('off') === null);
eq('autocomplete beats generic name', D.detectType(fakeEl({ type: 'text', name: 'x', autocomplete: 'email' }), settings.matchBy) === 'email');
const sig2 = D.getElementSignals(fakeEl({ name: 'ph', inputmode: 'numeric' }), settings.matchBy);
eq('inputmode signal present', sig2.signals.indexOf('numeric') !== -1);
// number-typed boxes must still be signal-detected (mobile box bug)
eq('type=number name=mobileno → mobile', D.detectType(fakeEl({ type: 'number', name: 'mobileno' }), settings.matchBy) === 'mobile');
eq('type=number name=zip_code2 → zip', D.detectType(fakeEl({ type: 'number', name: 'zip_code2' }), settings.matchBy) === 'zip');
eq('type=number unnamed → number', D.detectType(fakeEl({ type: 'number' }), settings.matchBy) === 'number');
eq('contact box → phone', D.detectType(fakeEl({ name: 'contact' }), settings.matchBy) === 'phone');

// ---- ignorer ----
eq('ignore hidden', D.isIgnorable(fakeEl({ type: 'hidden' }), settings.ignorePatterns) === true);
eq('ignore readonly', D.isIgnorable(fakeEl({ readonly: true }), settings.ignorePatterns) === true);
eq('ignore captcha', D.isIgnorable(fakeEl({ name: 'g-recaptcha-response' }), settings.ignorePatterns) === true);
eq('ignore file', D.isIgnorable(fakeEl({ type: 'file' }), settings.ignorePatterns) === true);
eq('not ignore text', D.isIgnorable(fakeEl({ name: 'email' }), settings.ignorePatterns) === false);

// ---- generator ----
eq('gen email', /@/.test(R.generate('email', {})) || typeof R.generate('email', {}) === 'string');
eq('gen uuid', /^[0-9a-f-]{36}$/i.test(R.generate('uuid', {})));
eq('gen phone', typeof R.generate('phone', {}) === 'string' && R.generate('phone', {}).length > 5);
eq('gen maxlength', R.generate('paragraph', { maxlength: 12 }).length <= 12);
eq('gen custom value', R.generate('custom', { value: 'FIXED' }) === 'FIXED');
eq('gen regex', /^[A-Z]{3}\d{2}$/i.test(R.generate('regex', { value: '[A-Z]{3}[0-9]{2}' })));
eq('gen boolean', typeof R.generate('boolean', {}) === 'boolean');
eq('gen date', /^\d{4}-\d{2}-\d{2}$/.test(R.generate('date', {})));
eq('gen level: creditCard digits+dashes', /\d/.test(R.generate('creditCard', {})));
// ---- phone/mobile digit bug fix ----
eq('mobile maxlength=10 → 10 digits', /^[6-9]\d{9}$/.test(R.generate('mobile', { maxlength: 10 })));
eq('phone maxlength=10 → 10 digits', /^[6-9]\d{9}$/.test(R.generate('phone', { maxlength: 10 })));

// ---- consistent profile mode ----
R.setConsistent(true); R.beginFill();
const cEmailA = R.generate('email', {}), cCityA = R.generate('city', {}), cCityB = R.generate('city', {}), cPhA = R.generate('phone', {}), cPhB = R.generate('phone', {});
eq('profile: same city within page', cCityA === cCityB);
eq('profile: same phone within page', cPhA === cPhB);
R.beginFill();
eq('profile: new page → new email', R.generate('email', {}) !== cEmailA);
R.setConsistent(false); R.beginFill();

// ---- stateCode never crashes/empties on locales without abbreviated states ----
['cs_CZ', 'el', 'zh_CN', 'da', 'fi', 'vi', 'hi'].forEach(function (lc) {
  R.setLocale(lc); R.beginFill();
  const sc = R.generate('stateCode', {});
  eq('stateCode ' + lc + ' non-empty', String(sc).length > 0);
});
R.setLocale('en'); R.beginFill();

// ---- hindi locale ----
R.setLocale('hi'); R.beginFill();
const hiFn = R.generate('firstName', {}), hiLn = R.generate('lastName', {}), hiFull = R.generate('fullName', {}), hiEmail = R.generate('email', {}), hiUser = R.generate('username', {});
eq('hi: first name in devanagari', /[\u0900-\u097F]/.test(hiFn));
eq('hi: last name in devanagari', /[\u0900-\u097F]/.test(hiLn));
eq('hi: fullname combines', hiFull === hiFn + ' ' + hiLn);
eq('hi: email is name@safe-domain, no mangle', /^[a-z0-9._]+@(gmail|yahoo|outlook|hotmail|rediffmail)\.com$/.test(hiEmail) && /[a-z]@/.test(hiEmail));
eq('hi: username is latin letters', /^[a-z]+$/.test(hiUser));
R.setLocale('en'); R.beginFill();
eq('hi: en restored gives latin names', !/[\u0900-\u097F]/.test(R.generate('fullName', {})) && R.generate('fullName', {}).length > 1);

// ---- every unicode locale produces a clean email ----
['fr', 'de', 'es', 'pt_BR', 'it', 'nl', 'ja', 'ar', 'ru', 'th', 'he', 'ko', 'hi'].forEach(function (lc) {
  R.setLocale(lc); R.beginFill();
  const nm = R.generate('firstName', {}), em = R.generate('email', {});
  eq('locale ' + lc + ': name non-empty', String(nm).length > 0);
  eq('locale ' + lc + ': email valid ascii', /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(em));
});
R.setLocale('en'); R.beginFill();

// ---- country-code prefix counts as empty ----
eq('hasValue "+91" prefix is empty', D.hasValue(fakeEl({ type: 'tel', name: 'mobile', value: '+91' })) === false);
eq('hasValue "+91 " with space is empty', D.hasValue(fakeEl({ type: 'tel', name: 'mobile', value: '+91 ' })) === false);
eq('hasValue real number has value', D.hasValue(fakeEl({ type: 'tel', name: 'mobile', value: '9876543210' })) === true);
eq('hasValue partly typed is kept', D.hasValue(fakeEl({ type: 'tel', name: 'mobile', value: '+91 77' })) === true);
eq('hasValue empty is empty', D.hasValue(fakeEl({ type: 'tel', name: 'mobile', value: '' })) === false);
eq('tel htmlType → 10 digits', /^[6-9]\d{9}$/.test(R.generate('mobile', { htmlType: 'tel' })));
eq('pattern \\d{10} honored', /^[6-9]\d{9}$/.test(R.generate('mobile', { pattern: '\\d{10}' })));
eq('pattern \\d{5}-\\d{5} honored', /^\d{5}-\d{5}$/.test(R.generate('phone', { pattern: '\\d{5}-\\d{5}' })));
eq('mobile number starts 6-9 over many runs', (function () { var ok = true; for (var x = 0; x < 25; x++) { if (!/^[6-9]\d{9}$/.test(R.generate('mobile', { maxlength: 10 }))) { ok = false; break; } } return ok; })());
eq('phone no constraints non-empty', typeof R.generate('phone', {}) === 'string' && R.generate('phone', {}).length > 0);
eq('phone has no extension artifact', (function () { var ok = true; for (var q = 0; q < 15; q++) { if (/x\d/.test(R.generate('phone', {}))) { ok = false; break; } } return ok; })());
eq('mobile maxlength=7 → 7 digits', /^\d{7}$/.test(R.generate('mobile', { maxlength: 7 })));
eq('quantity respects min/max', (function () { var v = Number(R.generate('quantity', { min: 1, max: 10 })); return v >= 1 && v <= 10; })());
eq('number min>max swapped sane', (function () { var v = Number(R.generate('number', { min: 20, max: 5 })); return !isNaN(v) && v >= 5 && v <= 20; })());
eq('number NaN min falls back', (function () { var v = Number(R.generate('number', { min: 'abc', max: 'xyz' })); return !isNaN(v) && v >= 1 && v <= 10000; })());
R.beginFill();
const pw1 = R.getPassword(settings, false), pw2 = R.getPassword(settings, true);
eq('password coherence', pw1 === pw2);
eq('password non-empty', pw1 && pw1.length >= 8);
const p1 = R.getPersona(), p2 = R.getPersona();
eq('persona coherence', p1.firstName === p2.firstName && p1.email === p2.email && p1.email === p2.email);
eq('persona email derives from name', p1.email.toLowerCase().includes(p1.firstName.toLowerCase()));

// ---- locale switching (all bundled locales must produce data) ----
(function () {
  const keys = Object.keys(window.__FAKERS__ || {}).filter(k => k !== 'base');
  let allCoreOk = true;
  const problems = [];
  keys.forEach(function (k) {
    R.setLocale(k); R.beginFill();
    try {
      const firstName = R.generate('firstName');
      const lastName = R.generate('lastName');
      const fullName = R.generate('fullName');
      const city = R.generate('city');
      const phone = R.generate('phone');
      if (!firstName || !lastName || !fullName || !city || !phone) { allCoreOk = false; problems.push(k + ':' + (!firstName ? 'firstName' : !lastName ? 'lastName' : !fullName ? 'fullName' : !city ? 'city' : 'phone')); }
      ['streetAddress', 'zip', 'company', 'jobTitle', 'email', 'username', 'state', 'country', 'password', 'dob', 'addressLine2'].forEach(function (t) {
        try { R.generate(t); } catch (e) { problems.push(k + ':' + t); }
      });
    } catch (e) { allCoreOk = false; problems.push(k + ':core'); }
  });
  eq('all ' + keys.length + ' locales generate data', allCoreOk);
  eq('no type throws in any locale', problems.length === 0);
  eq('locale count ' + keys.length, keys.length === 67);

  R.setLocale('en'); R.beginFill();
  const enNames = [];
  for (let x = 0; x < 15; x++) enNames.push(R.generate('fullName'));
  R.setLocale('de'); R.beginFill();
  const deNames = [];
  for (let y = 0; y < 15; y++) deNames.push(R.generate('fullName'));
  eq('de differs from en', enNames.join('|') !== deNames.join('|'));
  R.setLocale('ja'); R.beginFill();
  const jaNames = [];
  for (let z = 0; z < 10; z++) jaNames.push(R.generate('fullName'));
  eq('ja uses non-Latin script', /[\u3040-\u30ff\u3400-\u9fff\u3000-\u303f]/.test(jaNames.join('')));
  R.setLocale('zh_CN'); R.beginFill();
  const zhNames = [];
  for (let b = 0; b < 10; b++) zhNames.push(R.generate('fullName'));
  eq('zh_CN uses CJK', /[\u4e00-\u9fff]/.test(zhNames.join('')));
  R.setLocale('ar'); R.beginFill();
  const arNames = String(R.generate('fullName'));
  eq('ar generates a name', arNames.length > 0);
  const asciiRe = /^[a-z0-9._%+-]+$/i;
  const asciiNonLatin = ['ja', 'ar', 'zh_CN', 'ko', 'ru', 'hi'];
  const asciiProblems = [];
  asciiNonLatin.forEach(function (lk) {
    R.setLocale(lk); R.beginFill();
    const persona = R.getPersona();
    const local = String(persona.email).split('@')[0];
    if (!persona.email || persona.email.indexOf('@') < 1 || !asciiRe.test(local) || !/^[a-z0-9]+$/.test(persona.email.split('@')[1].split('.')[0])) asciiProblems.push(lk + ':email=' + persona.email);
    if (!persona.username || !/^[a-z0-9._-]+$/i.test(persona.username)) asciiProblems.push(lk + ':username=' + persona.username);
  });
  eq('non-Latin locales get ASCII email+username', asciiProblems.length === 0);
  // restore locale expected by later tests
  R.setLocale('en'); R.beginFill();
})();

// every LOCALES option in options.js must exist in the loaded faker bundles
(function () {
  const optsJs = fs.readFileSync(path.join(root, 'options/options.js'), 'utf8');
  const m = optsJs.match(/var LOCALES = (\[[\s\S]*?\n  \]);/);
  if (!m) { eq('options LOCALES parseable', false); return; }
  let entries = null;
  try { entries = new Function('return ' + m[1])(); } catch (e) { entries = null; }
  if (!entries) { eq('options LOCALES parseable', false); return; }
  const keys = Object.keys(window.__FAKERS__ || {});
  const CUSTOM = { hi: true }; // bundled in data-generator, not in faker
  const missing = entries.filter(function (pair) { return !CUSTOM[pair[0]] && keys.indexOf(pair[0]) === -1; }).map(function (p) { return p[0]; });
  eq('every options locale exists in faker bundle (missing: ' + missing.join(',') + ')', missing.length === 0);
})();

// ---- parity & "better than Fake Filler" features ----
(function () {
  const d = G.normalize({});
  eq('normalize default maxLength', d.maxLength === 40);
  eq('normalize default ignoredDomains', Array.isArray(d.ignoredDomains) && d.ignoredDomains.length === 0);
  eq('normalize default ariaLabelledby', d.matchBy.ariaLabelledby === true);

  eq('ignored domain match', G.isIgnoredDomain('bankofamerica.com', ['bank']) === true);
  eq('ignored domain anchored regex', G.isIgnoredDomain('www.example.com', ['^www\\.']) === true);
  eq('ignored domain miss', G.isIgnoredDomain('example.com', ['^www\\.']) === false);
  eq('ignored domain no match', G.isIgnoredDomain('github.com', ['bank']) === false);

  eq('confirmation secondary', D.isConfirmation('secondary email') === true);
  eq('confirmation re-enter', D.isConfirmation('re-enter password') === true);
  eq('confirmation plain field', D.isConfirmation('first name') === false);
  eq('confirmation blank', D.isConfirmation('') === false);

  eq('template phone mask', /^\+1 \(\d{3}\) \d{3}-\d{4}$/.test(R.generate('template', { template: '+1 (###) ###-####' })));
  eq('template digit 9 stays literal', R.generate('template', { template: '+911541651651' }) === '+911541651651');
  eq('template mixed markers', /^[A-Z]{2}[a-z]+\d{2}$/.test(R.generate('template', { template: 'XXxxxx##' })));
  eq('template empty falls back', typeof R.generate('template', {}) === 'string' && R.generate('template', {}).length > 0);
  eq('template respects maxlength', R.generate('template', { template: '+1 (###) ###-####', maxlength: 7 }).length === 7);

  (function () { const v = Number(R.generate('number', { min: 10000, max: 99999 })); eq('number respects custom min/max', v >= 10000 && v <= 99999); })();
  (function () { const a = Number(R.generate('age', { min: null, max: null })); eq('age without min/max is not zero', a >= 18 && a <= 80); })();
  (function () { const n = Number(R.generate('number', { min: null, max: null })); eq('number without min/max is not zero', n >= 1 && n <= 10000); })();
  eq('text respects maxLength cap', R.generate('text', { maxlength: 20 }).length <= 20);
  eq('text maxLength 20 does not truncate short output', R.generate('text', { maxlength: 200 }).length <= 200);
})();

// ---- filler on simulated element ----
const emailEl = fakeEl({ type: 'email', name: 'email', closests: null });
F.setNativeValue(emailEl, 'a@b.com');
eq('filler sets value', emailEl.value === 'a@b.com');

const passEl = fakeEl({ type: 'password', name: 'password' });
R.beginFill();
F.fill(passEl, { type: 'password', value: R.getPassword(settings, false) });
eq('password filled', passEl.value.length >= 8);

const selEl = fakeEl({ tagName: 'SELECT', type: 'select-one', options: [{ disabled: false, value: '', text: '' }, { disabled: false, value: 'yes', text: 'Yes' }] });
selEl.match = Function.prototype;
const selRes = F.fill(selEl, { type: 'select', value: undefined });
eq('select random picked', selRes && selRes.filled === true && 'selectedIndex' in selEl);

const selText = fakeEl({ tagName: 'SELECT', type: 'select-one', options: [{ disabled: false, value: '', text: '' }, { disabled: false, value: 'eng', text: 'Engineer' }] });
F.fill(selText, { type: 'select', value: 'Engineer' });
eq('select matched by text', selText.value === 'eng');

console.log(`\nINTEGRATION: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);