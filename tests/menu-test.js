/* Menu correctness: background.js must register all five context menu items on
   every service-worker start (regression for the stale/partial context menu). */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

const created = [];
let removeAllCalls = 0;
const listeners = { installed: [], startup: [] };

globalThis.chrome = {
  contextMenus: {
    create(props) { created.push({ id: props.id, title: props.title, contexts: props.contexts }); },
    removeAll(cb) { removeAllCalls++; if (cb) cb(); },
    onClicked: { addListener() {} }
  },
  runtime: {
    lastError: null,
    onInstalled: { addListener(fn) { listeners.installed.push(fn); } },
    onStartup: { addListener(fn) { listeners.startup.push(fn); } },
    onMessage: { addListener() {} }
  },
  action: { onClicked: { addListener() {} } },
  commands: { onCommand: { addListener() {} } },
  tabs: {}
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

created.length = 0;
listeners.startup[0]();
eq('re-register on startup still yields all 4', created.length === 4);
eq('no menu item lost on re-register', ['pf-fill-all', 'pf-fill-field', 'pf-undo', 'pf-settings'].every(id => created.some(c => c.id === id)));

console.log('MENU: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);