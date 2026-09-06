/* MaskFill - MV3 service worker: context menu, one-click action, keyboard shortcut, message routing */
'use strict';

// MV3 chrome APIs return a promise that REJECTS when the target tab disappears
// mid-operation (badge clear after 2.5s, message send, injection). The callback
// form still surfaces failures via lastError, but the returned promise can
// reject independently → "Uncaught (in promise) Error: No tab with id". Absorb
// every chrome promise explicitly so closed tabs never produce unhandled errors.
function swallow(p) {
  if (p && typeof p.then === 'function') p.catch(function () {});
}

const MENU = {
  all: 'pf-fill-all',
  field: 'pf-fill-field',
  undo: 'pf-undo',
  settings: 'pf-settings'
};

const MENU_ITEMS = [
  { id: MENU.all, title: 'MaskFill: fill all fields', contexts: ['all'] },
  { id: MENU.field, title: 'MaskFill: fill this field', contexts: ['editable'] },
  { id: MENU.undo, title: 'MaskFill: undo last fill', contexts: ['all'] },
  { id: MENU.settings, title: 'MaskFill: settings', contexts: ['action'] }
];

function guardedCreate(props) {
  try {
    swallow(chrome.contextMenus.create(props));
    if (chrome.runtime.lastError) void chrome.runtime.lastError;
  } catch (e) {
    console.error('MaskFill: failed to create context menu "' + props.id + '"', e);
  }
}

// Serialize menu rebuilds: onInstalled/onStartup/cold-start can all fire together,
// and removeAll→createAll is async, so overlapping calls raced on duplicate ids.
// One cycle recreates every item, so overlapping calls can safely skip.
var menusPending = false;

function ensureMenus() {
  if (!chrome.contextMenus) return;
  const createAll = () => { MENU_ITEMS.forEach((p) => guardedCreate(p)); };
  if (typeof chrome.contextMenus.removeAll === 'function') {
    if (menusPending) return;
    menusPending = true;
    swallow(chrome.contextMenus.removeAll(() => { menusPending = false; createAll(); }));
  } else {
    createAll();
  }
}

chrome.runtime.onInstalled.addListener(() => ensureMenus());
chrome.runtime.onStartup.addListener(() => ensureMenus());
// Re-register on every service-worker start so the menu can never go stale
// (Chrome shows the last-registered menu until the worker boots again).
ensureMenus();

function sendFill(tabId, scope) {
  return new Promise((resolve) => {
    // force=1 → repeated clicks regenerate fresh data and overwrite (Fake Filler style)
    swallow(chrome.tabs.sendMessage(tabId, { type: 'FILL', scope, force: 1 }, (resp) => {
      if (chrome.runtime.lastError) return resolve({ err: chrome.runtime.lastError.message });
      resolve(resp || { err: 'no response' });
    }));
  });
}

async function injectAndFill(tabId, scope) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['lib/faker.min.js', 'lib/settings.js', 'lib/data-generator.js', 'lib/field-detector.js', 'lib/filler.js', 'content.js']
    });
    return sendFill(tabId, scope);
  } catch (e) {
    return { err: 'inject:' + e.message };
  }
}

async function fillActiveTab(scope) {
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); }
  catch (e) { return { err: 'query:' + e.message }; }
  if (!tab || tab.id === undefined || !/^https?:/i.test(tab.url || '')) {
    return { err: 'no-fillable-page' };
  }
  let res = await sendFill(tab.id, scope);
  if (res && res.err) res = await injectAndFill(tab.id, scope);
  if (res && res.ok) badge(tab.id, String(res.filled || ''));
  return res;
}

function badge(tabId, text) {
  try {
    swallow(chrome.action.setBadgeBackgroundColor({ color: '#2563eb' }));
    swallow(chrome.action.setBadgeText({ tabId, text }));
    // clear the badge a beat later; the tab may be closed by then, and the
    // returned promise would reject with "No tab with id" → swallow() absorbs it
    setTimeout(() => { swallow(chrome.action.setBadgeText({ tabId, text: '' })); }, 2500);
  } catch (e) { }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.menuItemId || !tab || tab.id === undefined) return;
  if (info.menuItemId === MENU.settings) { swallow(chrome.runtime.openOptionsPage()); return; }
  if (info.menuItemId === MENU.undo) { sendUndo(tab.id); return; }
  const scope = info.menuItemId === MENU.field ? 'field' : 'all';
  fillActiveTab(scope);
});

function sendUndo(tabId) {
  swallow(chrome.tabs.sendMessage(tabId, { type: 'UNDO' }, (resp) => {
    // content script missing → nothing was filled → nothing to undo
    void resp;
  }));
}

async function undoActiveTab() {
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); }
  catch (e) { return; }
  if (tab && tab.id !== undefined) sendUndo(tab.id);
}

chrome.action.onClicked.addListener((tab) => {
  // one-click fill like Fake Filler
  fillActiveTab('all');
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'fill-all') fillActiveTab('all');
  if (command === 'undo-last-fill') undoActiveTab();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // content script announces a completed fill so we can show a badge
  if (msg && msg.type === 'FILL_DONE' && typeof msg.count === 'number' && sender && sender.tab && sender.tab.id !== undefined) {
    badge(sender.tab.id, String(msg.count));
  }
  // content script asks for the heavy libs to be injected into its frame on demand
  if (msg && msg.type === 'ENSURE_LIBS' && sender && sender.id === chrome.runtime.id && sender.tab && sender.tab.id !== undefined) {
    const files = ['lib/faker.min.js', 'lib/settings.js', 'lib/data-generator.js', 'lib/field-detector.js', 'lib/filler.js'];
    const target = { tabId: sender.tab.id };
    if (sender.frameId !== undefined) target.frameIds = [sender.frameId];
    swallow(chrome.scripting.executeScript({ target, files }, () => {
      const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
      sendResponse({ ok: !err, err: err || null });
    }));
    return true;
  }
  return false;
});