/* Menu correctness: background.js must register all five context menu items on
   every service-worker start (regression for the stale/partial context menu). */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

const created = [];
let removeAllCalls = 0;
const listeners = { installed: [], startup: [], message: null, menuClick: null };
let scripted = 0;

// every rejected chrome.* promise from a closed tab must be absorbed, not
// surface as an unhandled rejection (Node ≥22 exits 1 on unhandled rejections)
const unhandled = [];
process.on('unhandledRejection', (reason) => { unhandled.push(String(reason)); });

globalThis.chrome = {
  contextMenus: {
    create(props) { created.push({ id: props.id, title: props.title, contexts: props.contexts }); },
    removeAll(cb) { removeAllCalls++; if (cb) cb(); },
    onClicked: { addListener(fn) { listeners.menuClick = fn; } }
  },
  runtime: {
    id: 'maskfill-self',
    lastError: null,
    openOptionsPage() {},
    onInstalled: { addListener(fn) { listeners.installed.push(fn); } },
    onStartup: { addListener(fn) { listeners.startup.push(fn); } },
    onMessage: { addListener(fn) { listeners.message = fn; } }
  },
  scripting: { executeScript(opts, cb) { scripted++; if (cb) cb(); } },
  action: {
    onClicked: { addListener(fn) { listeners.menuClick = fn; } },
    setBadgeText() { return Promise.reject(new Error('No tab with id: 1')); },
    setBadgeBackgroundColor() { return Promise.reject(new Error('No tab with id: 1')); }
  },
  commands: { onCommand: { addListener() {} } },
  tabs: {
    query() { return Promise.resolve([{ id: 1, url: 'https://example.com/' }]); },
    sendMessage(tabId, msg, cb) {
      // closed/reloaded tab: callback sees lastError AND the promise rejects
      chrome.runtime.lastError = { message: 'No tab with id: ' + tabId };
      cb(undefined);
      return Promise.reject(new Error('No tab with id: ' + tabId));
    }
  }
};

let passed = 0, failed = 0;
function eq(name, cond) { if (cond) passed++; else { failed++; console.log('FAIL: ' + name); } }

eval(src); // top-level ensureMenus() runs through the stub

eq('all 4 menu items created at boot', created.length === 4);
eq('fill-all registered (all context)', created.some(c => c.id === 'pf-fill-all' && c.contexts.join() === 'all'));
eq('fill-field registered (editable context)', created.some(c => c.id === 'pf-fill-field' && c.contexts.join() === 'editable'));
eq('undo registered (all context)', created.some(c => c.id === 'pf-undo' && c.contexts.join() === 'all'));
eq('settings registered (action context)', created.some(c => c.id === 'pf-settings' && c.contexts.join() === 'action'));
eq('fill-form item removed', !created.some(c => c.id === 'pf-fill-form'));
eq('removeAll ran before create', removeAllCalls >= 1);

// ENSURE_LIBS must only be honored from our own extension (hostile extensions
// could otherwise force the heavy libs into arbitrary frames)
scripted = 0;
listeners.message({ type: 'ENSURE_LIBS' }, { id: 'maskfill-self', tab: { id: 1 }, frameId: 0 }, () => {});
eq('ENSURE_LIBS from own extension injects libs', scripted === 1);
listeners.message({ type: 'ENSURE_LIBS' }, { id: 'evil-extension', tab: { id: 1 }, frameId: 0 }, () => {});
eq('ENSURE_LIBS from foreign extension ignored', scripted === 1);
listeners.message({ type: 'ENSURE_LIBS' }, { id: 'maskfill-self' }, () => {});
eq('ENSURE_LIBS without a tab ignored', scripted === 1);

created.length = 0;
listeners.startup[0]();
eq('re-register on startup still yields all 4', created.length === 4);
eq('no menu item lost on re-register', ['pf-fill-all', 'pf-fill-field', 'pf-undo', 'pf-settings'].every(id => created.some(c => c.id === id)));

// overlapping ensureMenus calls (e.g. onInstalled + cold-start) must not double-create
created.length = 0;
let pendingRemove = [];
chrome.contextMenus.removeAll = function (cb) { pendingRemove.push(cb); };
listeners.installed[0]();
listeners.installed[0](); // second call while the first removeAll is still in flight
eq('nothing created while a rebuild is in flight', created.length === 0);
while (pendingRemove.length) pendingRemove.shift()();
eq('single create cycle after overlap completes', created.length === 4);
eq('no duplicate ids after overlap', new Set(created.map(c => c.id)).size === created.length);

// every path that can hit a vanished tab must absorb the rejected chrome.* promise,
// never leaving "Uncaught (in promise) Error: No tab with id" in the worker console.
(async () => {
  const deadTab = { id: 1, url: 'https://example.com/' };
  listeners.message({ type: 'FILL_DONE', count: 7 }, { id: 'maskfill-self', tab: deadTab }, () => {});
  listeners.message({ type: 'ENSURE_LIBS' }, { id: 'maskfill-self', tab: deadTab, frameId: 0 }, () => {});
  // fill via context menu: query → sendFill rejects → injectAndFill → badge, all on a dead tab
  listeners.menuClick({ menuItemId: 'pf-fill-all' }, deadTab);
  await new Promise((r) => setImmediate(r)); // flush microtasks/macrotask so rejections surface
  await new Promise((r) => setImmediate(r));
  eq('closed-tab chrome.* rejections all absorbed', unhandled.length === 0);
  if (unhandled.length) unhandled.forEach((u) => console.log('UNHANDLED REJECTION: ' + u));

  console.log('MENU: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();