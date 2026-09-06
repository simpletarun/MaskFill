/* MaskFill - MV3 service worker: context menu, one-click action, keyboard shortcut, message routing */
'use strict';

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
    chrome.contextMenus.create(props);
  } catch (e) {
    console.error('MaskFill: failed to create context menu "' + props.id + '"', e);
  }
}

function ensureMenus() {
  if (!chrome.contextMenus) return;
  const createAll = () => MENU_ITEMS.forEach((p) => guardedCreate(p));
  if (typeof chrome.contextMenus.removeAll === 'function') {
    chrome.contextMenus.removeAll(createAll);
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
    chrome.tabs.sendMessage(tabId, { type: 'FILL', scope }, (resp) => {
      if (chrome.runtime.lastError) return resolve({ err: chrome.runtime.lastError.message });
      resolve(resp || { err: 'no response' });
    });
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
    chrome.action.setBadgeText({ tabId, text });
    setTimeout(() => { try { chrome.action.setBadgeText({ tabId, text: '' }); } catch (e) { } }, 2500);
  } catch (e) { }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.menuItemId || !tab || tab.id === undefined) return;
  if (info.menuItemId === MENU.settings) { chrome.runtime.openOptionsPage(); return; }
  if (info.menuItemId === MENU.undo) { sendUndo(tab.id); return; }
  const scope = info.menuItemId === MENU.field ? 'field' : 'all';
  fillActiveTab(scope);
});

function sendUndo(tabId) {
  chrome.tabs.sendMessage(tabId, { type: 'UNDO' }, (resp) => {
    // content script missing → nothing was filled → nothing to undo
    void resp;
  });
}

async function undoActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

chrome.runtime.onMessage.addListener((msg, sender) => {
  // content script announces a completed fill so we can show a badge
  if (msg && msg.type === 'FILL_DONE' && typeof msg.count === 'number' && sender && sender.tab && sender.tab.id !== undefined) {
    badge(sender.tab.id, String(msg.count));
  }
  return false;
});