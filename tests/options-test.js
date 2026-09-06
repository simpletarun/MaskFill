/* Options page logic test: boots options.html + settings.js + options.js in jsdom
   and exercises rendering, maxLength clamp, chips, reset + responsive CSS. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'options/options.html'), 'utf8')
  .replace(/<script[^>]*><\/script>/g, ''); // external scripts eval'd manually

const dom = new JSDOM(html, { url: 'chrome-extension://test/options/options.html', runScripts: 'dangerously' });
const w = dom.window;
globalThis.window = w;

let savedSettings = { locale: 'en', matchBy: { name: true, id: true, className: false, placeholder: true, label: true, ariaLabel: true, ariaLabelledby: true }, ignorePatterns: ['captcha'] };
w.chrome = {
  runtime: { lastError: null },
  storage: { sync: {
    get(obj, cb) { cb({ settings: savedSettings }); },
    set(obj, cb) { savedSettings = JSON.parse(JSON.stringify(obj.settings)); if (cb) cb(); }
  } }
};
let passed = 0, failed = 0;
function eq(name, cond) {
  cond = !!cond;
  if (cond) passed++; else { failed++; console.log('FAIL: ' + name); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function change(el, val) { el.value = val; el.dispatchEvent(new w.Event('change', { bubbles: true })); }

(async function () {
  w.eval(fs.readFileSync(path.join(root, 'lib/settings.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'options/options.js'), 'utf8'));
  await wait(50);

  const $id = (id) => w.document.getElementById(id);
  eq('locale select has 66 options', $id('locale').options.length === 66);
  eq('locale en selected', $id('locale').value === 'en');

  // maxLength clamp
  change($id('maxLength'), 0); await wait(400);
  eq('maxLength 0 → 40', Number($id('maxLength').value) === 40 && savedSettings.maxLength === 40);
  change($id('maxLength'), 999); await wait(400);
  eq('maxLength 999 → 200', Number($id('maxLength').value) === 200);

  // Phase-1 toggles render from defaults and persist
  eq('profileConsistent defaults on', $id('profileConsistent').checked === true);
  eq('flashFilled defaults on', $id('flashFilled').checked === true);
  $id('flashFilled').click(); await wait(400);
  eq('flashFilled persists', savedSettings.flashFilled === false);
  $id('profileConsistent').click(); await wait(400);
  eq('profileConsistent persists', savedSettings.profileConsistent === false);

  // chips add
  $id('chipInput').value = 'honeypot';
  $id('chipAdd').click();
  eq('chip rendered', $id('chips').textContent.indexOf('honeypot') !== -1);
  await wait(400);
  eq('chip persisted', savedSettings.ignorePatterns.indexOf('honeypot') !== -1);

  // responsive CSS media queries present
  const css = fs.readFileSync(path.join(root, 'options/options.css'), 'utf8');
  eq('mobile breakpoint + CSS 16px inputs', css.indexOf('@media(max-width:520px)') !== -1 && /input\[type="text"\],input\[type="number"\],select,textarea\{\s*font-size:16px/.test(css));
  eq('dark-mode chip styles', css.indexOf('.chip{background:#2e3148;color:#a5b4fc}') !== -1);

  console.log('OPTIONS: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(function (err) { console.error(err); process.exit(1); });