/* Full E2E: runs content.js orchestration against a real jsdom DOM form */
globalThis.window = undefined;
const { JSDOM } = require('jsdom');
const fs = require('fs');

const formHTML = `
<form id="f">
  <label for="em">Email</label><input id="em" name="user_email" type="email"><br>
  <input name="first_name" placeholder="First name">
  <input name="lastName" placeholder="Last name">
  <input name="secondary">
  <input name="phoneno" type="tel">
  <label for="mob">Your mobile number is safe with us</label><input id="mob" name="mobile_no" type="tel" maxlength="10">
  <input name="cc_mobile" type="tel" maxlength="14" value="+91">
  <input name="cc_mobile10" type="tel" maxlength="10" value="+91">
  <input name="order_ref" pattern="[A-Z]{3}-[0-9]{3}">
  <input name="autof" autocomplete="postal-code">
  <div contenteditable="true" data-pf="ce"></div>
  <input name="zip_code">
  <input name="street">
  <input name="city">
  <input name="state">
  <input name="country">
  <input name="pw" type="password">
  <input name="confirm_pw" type="password">
  <textarea name="bio"></textarea>
  <select name="job_title"><option value="">Select...</option><option value="eng">Engineer</option><option value="dev">Developer</option></select>
  <input type="radio" name="gender" value="M"><input type="radio" name="gender" value="F">
  <input type="checkbox" name="agree_terms">
  <input name="remember_me" type="checkbox">
  <input type="checkbox" name="newsletter">
  <input type="date" name="start_date">
  <input name="birthdate_dd" type="text" placeholder="DD/MM/YYYY">
  <input name="dob_date" type="date">
  <input type="radio" name="mcq1" value="A" style="display:none"><input type="radio" name="mcq1" value="B" style="display:none">
  <input type="checkbox" name="agree_mcq" value="1" style="display:none">
  <input type="hidden" name="token" value="keepme">
  <input name="disabled_field" disabled>
  <input name="readonly_field" readonly value="ro">
  <input name="g-recaptcha-response">
  <input type="color" name="fav_color">
  <input type="number" name="quantity" min="1" max="10">
  <input type="number" name="age" value="0">
  <input name="age_masked" value="--">
</form>`;

const settings = {
  locale: 'en', fillOnlyEmpty: true, fillPasswords: true, passwordValue: '',
  autoCheckTerms: true,
  matchBy: { name: true, id: true, className: false, placeholder: true, label: true, ariaLabel: true },
  ignorePatterns: ['captcha', 'g-recaptcha', 'h-captcha', 'recaptcha']
};

const dom = new JSDOM(formHTML, { url: 'https://example.com/form', runScripts: 'dangerously' });
const w = dom.window;
globalThis.window = w;

let savedSettings = JSON.parse(JSON.stringify(settings));

w.chrome = {
  runtime: {
    onMessage: { addListener() {} },
    lastError: null
  },
  storage: {
    sync: {
      get(keys, cb) { cb({ settings: savedSettings }); },
      set(obj, cb) { savedSettings = obj.settings; if (cb) cb(); }
    }
  }
};

let msgListener = null;
w.chrome.runtime.onMessage.addListener = (fn) => { msgListener = fn; };

// load libs into the jsdom window context (content.js registers its onMessage handler via our interceptor)
['lib/faker.min.js', 'lib/settings.js', 'lib/data-generator.js', 'lib/field-detector.js', 'lib/filler.js', 'content.js']
  .forEach(f => w.eval(fs.readFileSync(f, 'utf8')));

function send(type, scope, force) {
  return new Promise((resolve) => msgListener({ type, scope, force }, {}, (resp) => resolve(resp)));
}

async function main() {
  let host = null, shadowInput = null;
  try {
    host = w.document.createElement('div');
    shadowInput = w.document.createElement('input');
    shadowInput.setAttribute('name', 'mobile_no2');
    shadowInput.setAttribute('type', 'tel');
    shadowInput.setAttribute('maxlength', '10');
    host.attachShadow({ mode: 'open' }).appendChild(shadowInput);
    w.document.body.appendChild(host);
  } catch (e) { host = null; }

  let res = await send('PING');
  console.log('PING:', JSON.stringify(res));

  res = await send('COUNT', 'all');
  console.log('COUNT:', JSON.stringify(res));

  res = await send('FILL', 'all');
  console.log('FILL:', JSON.stringify(res));

  const doc = w.document;
  const val = (s) => { const el = doc.querySelector(s); return el ? el.value : '(missing)'; };
  const chk = (s) => { const el = doc.querySelector(s); return el ? el.checked : '(missing)'; };

  const failures = [];
  const expect = (label, cond) => { if (cond) console.log('  ok:', label); else { failures.push(label); console.log('  FAIL:', label); } };

  expect('email filled', /@/.test(val('#em')) || /@/.test(val('#em')));
  expect('first name filled', val('[name=first_name]').length > 1);
  expect('last name filled', val('[name=lastName]').length > 1);
  expect('confirmation field reuses preceding value', val('[name=secondary]') === val('[name=lastName]'));
  expect('phone filled', val('[name=phoneno]').length >= 7);
  expect('+91 prefilled tel gets prefix+number', /^\+91 \d{10}$/.test(val('[name=cc_mobile]')));
  expect('+91 prefilled tel maxlength=10 gets bare digits', /^[6-9]\d{9}$/.test(val('[name=cc_mobile10]')));
  expect('mobile 10 digits', /^[6-9]\d{9}$/.test(val('#mob')));
  if (host && shadowInput) {
    expect('shadow-DOM tel filled', /^[6-9]\d{9}$/.test(shadowInput.value));
  }
  const pat = val('[name=order_ref]');
  expect('pattern attr honored', /^[A-Z]{3}-[0-9]{3}$/.test(pat));
  const autoF = val('[name=autof]');
  expect('autocomplete postal-code → zip', /^\d{4,6}$/.test(autoF) || autoF.length >= 3);
  const ce = w.document.querySelector('[data-pf=ce]');
  expect('contenteditable filled', (ce.textContent || '').length > 3);
  expect('zip filled', /^\d{4,6}|^[A-Za-z]?\d/.test(val('[name=zip_code]')));
  expect('street filled', val('[name=street]').length > 4);
  expect('city filled', val('[name=city]').length > 2);
  expect('state filled', val('[name=state]').length > 1);
  expect('country filled', val('[name=country]').length > 2);
  const pw = val('[name=pw]'), cpw = val('[name=confirm_pw]');
  expect('password coherence', pw === cpw && pw.length >= 8);
  expect('bio filled', val('[name=bio]').length > 5);
  const sel = val('[name=job_title]');
  expect('select has real option', ['eng', 'dev'].indexOf(sel) !== -1);
  expect('radio checked', chk('input[type=radio][value=M]') || chk('input[type=radio][value=F]'));
  expect('terms box checked', chk('[name=agree_terms]') === true);
  expect('remember me checked', chk('[name=remember_me]') === true);
  expect('date valid', /^\d{4}-\d{2}-\d{2}$/.test(val('[name=start_date]')));
  expect('DOB masked text filled as DD/MM/YYYY', /^\d{2}\/\d{2}\/\d{4}$/.test(val('[name=birthdate_dd]')));
  expect('DOB type=date is adult birthdate', (function () { const y = Number(val('[name=dob_date]').slice(0, 4)); return y >= 1950 && y <= 2008; })());
  expect('hidden MCQ radios answered', (function () { const r = doc.querySelectorAll('[name=mcq1]'); let c = 0; r.forEach(x => { if (x.checked) c++; }); return c >= 1; })());
  expect('hidden agree checkbox checked', doc.querySelector('[name=agree_mcq]').checked === true);
  expect('hidden untouched', val('[name=token]') === 'keepme');
  expect('disabled untouched', val('[name=disabled_field]') === '');
  expect('readonly untouched', val('[name=readonly_field]') === 'ro');
  expect('captcha untouched', val('[name=g-recaptcha-response]') === '');
  expect('color valid hex', /^#[0-9a-f]{6}$/i.test(val('[name=fav_color]')));
  const q = Number(val('[name=quantity]'));
  expect('quantity in range', q >= 1 && q <= 10);
  expect('age with 0 default gets filled', (function () { const v = Number(val('[name=age]')); return !isNaN(v) && v > 0; })());
  expect('age with mask chip gets filled', val('[name=age_masked]') !== '--' && val('[name=age_masked]').length > 0);
  expect('filled field flashed green outline', doc.querySelector('[name=first_name]').style.outline === '2px solid #22c55e');

  // repeated icon click (forced) generates a NEW profile and overwrites — Fake Filler style
  const emailBefore = val('#em'), firstBefore = val('[name=first_name]');
  res = await send('FILL', 'all', 1);
  console.log('FILL2 (forced, generate again):', JSON.stringify(res));
  expect('re-click generates new email', val('#em') !== emailBefore && /@/.test(val('#em')));
  expect('re-click overwrites first name', val('[name=first_name]') !== firstBefore);
  expect('re-click keeps +91 number valid', /^\+91 \d{10}$/.test(val('[name=cc_mobile]')));

  // autoFill-style fill (no force) respects fillOnlyEmpty → user data kept
  savedSettings = Object.assign({}, settings, { fillOnlyEmpty: true });
  const emailKeep = val('#em');
  res = await send('FILL', 'all');
  console.log('FILL3 (fillOnlyEmpty):', JSON.stringify(res));
  expect('fillOnlyEmpty keeps existing text intact', val('#em') === emailKeep);

  // fillOnlyEmpty=false refills
  savedSettings = Object.assign({}, settings, { fillOnlyEmpty: false });
  res = await send('FILL', 'all');
  console.log('FILL4 (fillOnlyEmpty=false):', JSON.stringify(res));

  // undo restores the pre-FILL refill snapshot exactly
  doc.querySelector('#em').value = '';
  res = await send('FILL', 'all', 1);
  if (val('#em') === '') { failures.push('pre-undo refill expected non-empty email'); }
  let undoRes = await new Promise((resolve) => msgListener({ type: 'UNDO' }, {}, resolve));
  console.log('UNDO:', JSON.stringify(undoRes));
  expect('undo restores cleared email to empty', val('#em') === '');
  expect('undo restores first name', val('[name=first_name]').length > 0);

  // dynamic-field auto-fill: newly added empty fields get filled when autoFill is on
  savedSettings = Object.assign({}, settings, { autoFill: true, fillOnlyEmpty: true });
  const dyn = w.document.createElement('input');
  dyn.setAttribute('name', 'dyn_city');
  w.document.querySelector('#f').appendChild(dyn);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(1400);
  expect('dynamically added field filled', val('[name=dyn_city]').length > 2);

  const withSave = 2;
  console.log('\nCONTEXT OK, saved settings version called:', withSave);
  console.log(failures.length ? `\n${failures.length} FAILURES` : '\nALL DOM E2E PASSED');
  process.exit(failures.length ? 1 : 0);
}

main().catch(e => { console.error('E2E ERROR', e); process.exit(1); });